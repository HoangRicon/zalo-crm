# Design: fix-2026-07-24-critical-lag-and-bugs

> Companion file cho `proposal.md` và `tasks.md`. Định nghĩa diff cụ thể cho 4 capability.

---

## Capability 1 — chat-socket-cleanup

### Phân tích hiện trạng

3 file đăng ký handler nhưng không unregister:

| File | Handler đăng ký | Cleanup hiện tại |
|------|----------------|-------------------|
| `use-chat.ts:829-1135` | 11 socket.on() | `destroySocket()` chỉ `socket.disconnect()` |
| `use-chat-operations.ts:97-119` | `chat:typing` + `chat:message-edited` | Không có unregister |
| `ChatView.vue:798-826` | `friend:updated` | Không có unregister |

Timer leak:
- `use-chat.ts:322` `typingTimers` Map không iterate clear trên destroy.
- `use-chat.ts:356` `offlineGraceTimer` không clear trên destroy.

### Diff cụ thể

**`use-chat.ts:1178-1184`** — thay thế `destroySocket`:

```typescript
function destroySocket() {
  window.removeEventListener('friend-crm-tags-changed', onFriendCrmTagsChanged);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  // FIX 2026-07-24: unregister ALL socket handlers to prevent accumulate across mounts
  socket?.off('chat:message');
  socket?.off('chat:deleted');
  socket?.off('chat:message-edited');
  socket?.off('chat:reactions');
  socket?.off('chat:pinned');
  socket?.off('chat:unpinned');
  socket?.off('chat:group-info-updated');
  socket?.off('zalo:access-changed');
  socket?.off('zalo:typing');
  socket?.off('zalo:message-status');
  socket?.off('friend:updated');
  // FIX 2026-07-24: clear typing timers map
  for (const t of typingTimers.values()) window.clearTimeout(t);
  typingTimers.clear();
  // FIX 2026-07-24: clear offline grace timer
  if (offlineGraceTimer) { clearTimeout(offlineGraceTimer); offlineGraceTimer = null; }
  // FIX 2026-07-24: clear conv sync timer
  if (convSyncTimer) { clearTimeout(convSyncTimer); convSyncTimer = null; }
  socket?.disconnect();
  socket = null;
}
```

**`use-chat-operations.ts:97-119`** — export `unregisterSocketListeners`:

```typescript
function unregisterSocketListeners(socket: Socket | null) {
  if (!socket) return;
  socket.off('chat:typing');
  socket.off('chat:message-edited');
}
// Trong return object thêm: unregisterSocketListeners
```

**`ChatView.vue:798`** — track handler ref + unregister:

```typescript
const _friendUpdatedHandler = (p) => { /* logic cũ */ };
_socket.on('friend:updated', _friendUpdatedHandler);
// onUnmounted thêm:
if (socketRef) socketRef.off('friend:updated', _friendUpdatedHandler);
```

### Schema delta

Không.

### Rollback

`git checkout -- frontend/src/composables/use-chat.ts frontend/src/composables/use-chat-operations.ts frontend/src/views/ChatView.vue`

---

## Capability 2 — report-cache-fix

### Phân tích hiện trạng

`report-analytics-routes.ts` có cache helper (`getCached`/`setCached`) nhưng 8/8 endpoint return thẳng object mà không gán `const result = ...`, khiến `setCached(cacheKey, result)` thành dead code.

Thêm bug `userIds` duplicate ở `lead-pool` endpoint (line 608) làm `byUser` rỗng.

N+1 queries ở `sales-performance` (line 362-391): 4 queries × N users.

100K rows fetch + N+1 outcomes ở `crm-usage` (line 1190-1207).

### Diff cụ thể

**Pattern chung cho 8 endpoint** (`overview`, `nick-fleet`, `pipeline`, `lead-pool`, `automation`, `engagement`, `audit`, `crm-usage`):

```typescript
// TRƯỚC:
return { from, to, kpis: {...}, ... };
setCached(cacheKey, result);  // result không tồn tại
return result;

// SAU:
const result = { from, to, kpis: {...}, ... };
setCached(cacheKey, result);
return result;
```

**`lead-pool` endpoint line 603-608** — đổi tên biến:

```typescript
const userIds = new Set<string>();
for (const g of distGroups) if (g.assignedToUserId) userIds.add(g.assignedToUserId);
for (const g of reqGroups) if (g.requestedByUserId) userIds.add(g.requestedByUserId);
const userIdList = Array.from(userIds);  // ← đổi tên để không shadow
```

**`sales-performance` line 362-391** — batch thành 4 groupBy:

```typescript
const userIds = users.map(u => u.id);
const [contactCounts, apptGroups, closedCounts, leadPoolUsed] = await Promise.all([
  prisma.contact.groupBy({ by: ['assignedUserId'], where: { orgId, mergedInto: null, assignedUserId: { in: userIds } }, _count: true }),
  prisma.appointment.groupBy({ by: ['assignedUserId', 'status'], where: { orgId, assignedUserId: { in: userIds }, appointmentDate: { gte: start, lt: end } }, _count: true }),
  prisma.contact.groupBy({ by: ['assignedUserId'], where: { orgId, mergedInto: null, assignedUserId: { in: userIds }, statusId: { in: closedFilter } }, _count: true }),
  prisma.leadRequest.groupBy({ by: ['requestedByUserId'], where: { orgId, requestedByUserId: { in: userIds }, requestedAt: { gte: start, lt: end } }, _count: true }),
]);
// Build Maps + join in JS
```

**`crm-usage` line 1201-1207** — batch outcomes:

```typescript
const [closedGroups, apptGroups] = await Promise.all([
  prisma.contact.groupBy({ by: ['assignedUserId'], where: { orgId, mergedInto: null, assignedUserId: { in: saleIds }, statusId: { in: closedFilter } }, _count: true }),
  prisma.appointment.groupBy({ by: ['assignedUserId'], where: { orgId, assignedUserId: { in: saleIds }, status: 'completed', appointmentDate: { gte: start, lt: end } }, _count: true }),
]);
```

**`crm-usage` line 1190-1195** — giảm `take: 100000` xuống `take: 10000` + thêm comment cảnh báo:

```typescript
take: 10000, // LIMIT: 10K rows in-memory; production nên aggregate SQL hoặc materialized view
```

### Schema delta

Không.

### Rollback

`git checkout -- backend/src/modules/dashboard/report-analytics-routes.ts`

---

## Capability 3 — lead-pool-claim

### Phân tích hiện trạng

`LeadPoolView.vue:438-461`:

```typescript
async function onClaimLead(lead: PooledLead) {
  ...
  const { requestLead } = await import('@/api/lead-pool');
  await requestLead();  // ← không truyền leadId
  ...
}
```

Cần đọc signature `requestLead()` trong `frontend/src/api/lead-pool.ts` để biết argument name.

### Diff cụ thể

**Bước 1**: Đọc `frontend/src/api/lead-pool.ts` để xác định đúng tên tham số (dự kiến `{ leadId: string }` hoặc `{ id: string }`).

**Bước 2**: Sửa `LeadPoolView.vue:438-461`:

```typescript
const { requestLead } = await import('@/api/lead-pool');
await requestLead({ leadId: lead.id });  // FIX 2026-07-24: truyền lead.id
```

### Schema delta

Không.

### Rollback

`git checkout -- frontend/src/views/marketing/LeadPoolView.vue`

---

## Capability 4 — broadcast-blacklist-persist

### Phân tích hiện trạng

`BroadcastBlacklistPage.vue:67-69`:

```typescript
function onChange(acc: Account, val: boolean) {
  acc.broadcastBlacklisted = val;  // ← chỉ mutate UI, không gọi API
}
```

Cần verify backend endpoint update account blacklist.

### Diff cụ thể

**Bước 1**: Tìm endpoint update account trong `backend/src/modules/zalo/` (dự kiến `PATCH /api/v1/zalo-accounts/:id` với field `broadcastBlacklisted`).

**Bước 2**: Sửa `BroadcastBlacklistPage.vue:67-69`:

```typescript
async function onChange(acc: Account, val: boolean) {
  const prev = acc.broadcastBlacklisted;
  acc.broadcastBlacklisted = val;  // optimistic
  try {
    await api.patch(`/zalo-accounts/${acc.id}`, { broadcastBlacklisted: val });
  } catch (e) {
    acc.broadcastBlacklisted = prev;  // rollback
    console.error('[BroadcastBlacklist] update failed', e);
    alert('Cập nhật thất bại');
  }
}
```

### Schema delta

Không.

### Rollback

`git checkout -- frontend/src/views/settings/BroadcastBlacklistPage.vue`

---

## Tổng kết file cần đụng

| Capability | Backend | Frontend | Schema |
|------------|---------|----------|--------|
| 1 chat-socket-cleanup | 0 | 3 file (M) | N |
| 2 report-cache-fix | 1 file (M) | 0 | N |
| 3 lead-pool-claim | 0 | 1 file (M) | N |
| 4 broadcast-blacklist-persist | 0 (verify) | 1 file (M) | N |
| **Tổng** | **1 file** | **5 file** | **0** |

## Thứ tự triển khai đề xuất

1. Capability 2 (report cache fix) — lớn nhất nhưng chỉ 1 file backend, verify nhanh bằng curl.
2. Capability 1 (socket cleanup) — 3 file frontend, dễ test bằng cách navigate qua lại nhiều lần.
3. Capability 3 (lead-pool claim) — 1 dòng thay đổi, test bằng cách click claim.
4. Capability 4 (blacklist persist) — cần verify backend endpoint trước.
