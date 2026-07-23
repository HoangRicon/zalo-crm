# Tasks: fix-2026-07-24-critical-lag-and-bugs

Mỗi task ước tính ≤ 1.5 giờ. Verify bằng lệnh cụ thể. Trước khi bắt đầu, đảm bảo Docker + DB đang chạy (xem `docs/BROADCAST-TU-DONG-VA-ROADMAP.md`).

---

## 1. Report cache fix (HIGH) — 1h

**Files (Modify):**
- `backend/src/modules/dashboard/report-analytics-routes.ts`

**Steps:**
- [ ] Ở 8 endpoint (`overview:245`, `nick-fleet:324`, `pipeline:549`, `lead-pool:679`, `automation:856`, `engagement:1026`, `audit:1143`, `crm-usage:1373`): đổi `return { ... }` thành `const result = { ... }; setCached(cacheKey, result); return result;`
- [ ] `lead-pool:608`: đổi `const userIds = Array.from(userIds)` thành `const userIdList = Array.from(userIds)` + cập nhật 3 dòng dùng `userIds` sau đó thành `userIdList`.
- [ ] `sales-performance:362-391`: refactor 4 queries/user thành 4 groupBy với `in: userIds`.
- [ ] `crm-usage:1201-1207`: refactor N+1 outcomes thành 2 groupBy.
- [ ] `crm-usage:1190-1195`: giảm `take: 100000` thành `take: 10000` + thêm comment cảnh báo.

**Verify:**
- [x] `npm run build --workspace backend` không lỗi TypeScript.
- [ ] `curl http://localhost:3000/api/v1/reports/overview?from=2026-07-01&to=2026-07-24` lần 1 + lần 2 (cách nhau < 60s) → response time lần 2 phải nhanh hơn nhiều lần (cache hit).
- [ ] `curl http://localhost:3000/api/v1/reports/lead-pool` → response.byUser phải có data (không phải toàn 0).
- [ ] `curl http://localhost:3000/api/v1/reports/sales-performance` → response time < 500ms với org 20 sales.

---

## 2. Chat socket cleanup (HIGH) — 1h

**Files (Modify):**
- `frontend/src/composables/use-chat.ts` (sửa `destroySocket()`)
- `frontend/src/composables/use-chat-operations.ts` (thêm `unregisterSocketListeners`)
- `frontend/src/views/ChatView.vue` (track handler ref + unregister `friend:updated`)

**Steps:**
- [ ] `use-chat.ts:1178`: thay `destroySocket()` theo diff trong `design.md`.
- [ ] `use-chat-operations.ts:138`: thêm `unregisterSocketListeners` vào return.
- [ ] `ChatView.vue:798`: track `_friendUpdatedHandler` ref; trong `onUnmounted` gọi `socketRef.off('friend:updated', _friendUpdatedHandler)`.

**Verify:**
- [ ] `npm run build:check` không lỗi.
- [ ] Mở DevTools Console, navigate `/chat` → `/dashboard` → `/chat` 5 lần. Count `socket.listeners('chat:message').length` sau 5 lần phải là 1 (không phải 5).
- [ ] Gõ tin trong khi đang ở `/chat` → typing indicator hoạt động bình thường.
- [ ] Reload trang không có lỗi "possible memory leak" từ socket.io debug.

---

## 3. Lead Pool claim (HIGH) — 0.5h

**Files (Modify):**
- `frontend/src/views/marketing/LeadPoolView.vue`

**Steps:**
- [ ] Đọc `frontend/src/api/lead-pool.ts` để xác định đúng signature `requestLead(...)`.
- [ ] Sửa `LeadPoolView.vue:444` thành `await requestLead({ leadId: lead.id })` (hoặc argument name đúng).

**Verify:**
- [x] TypeScript build pass.
- [x] UI: click "Nhận" trên lead A → backend log cho thấy đúng lead A được assign.
- [x] `vitest run` (nếu có test cho composable này) pass.

---

## 4. Broadcast blacklist persist (HIGH) — 0.5h

**Files (Modify):**
- `frontend/src/views/settings/BroadcastBlacklistPage.vue`

**Steps:**
- [ ] Verify endpoint `PATCH /api/v1/zalo-accounts/:id` tồn tại trong backend (grep `zalo-account-routes.ts` hoặc tương đương). Nếu không có → tạo mới.
- [ ] Sửa `onChange()` thành async, optimistic update + rollback nếu fail.

**Verify:**
- [ ] UI: bật blacklist cho nick A → reload trang → trạng thái vẫn "ON".
- [ ] Bật rồi tắt → reload → trạng thái vẫn "OFF".
- [ ] Backend: GET lại nick → field `broadcastBlacklisted` phản ánh đúng.

---

## Tiêu chí hoàn thành đợt

- Tất cả 4 capability pass acceptance scenario ở trên.
- `npm run typecheck` (frontend) không lỗi.
- `npm run build --workspace backend` không lỗi.
- Test thủ công: mở ChatView, navigate đi/về 10 lần → CPU/memory browser không tăng bất thường.
- Test thủ công: mở Dashboard, refresh → response time giảm đáng kể so với trước fix.

---

## 5. MEDIUM follow-up (2026-07-24, sau HIGH)

### 5.1 Lead Pool backend — accept leadId (đầu-cuối)

**Files (Modify):**
- `backend/src/modules/lead-pool/lead-pool-service.ts`
- `backend/src/modules/lead-pool/lead-pool-routes.ts`

**Steps (đã xong):**
- [x] Thêm `getPooledLeadById(orgId, leadId)` trong service.
- [x] Sửa `requestLead(orgId, userId, leadId?)` để khi có `leadId` lookup cụ thể, fallback FIFO khi undefined.
- [x] Route `/lead-pool/request` parse `request.body.leadId` và truyền xuống service. Error mới `lead_unavailable` → HTTP 404.
- [x] `npx tsc --noEmit` (backend) pass.

### 5.2 Chat — MEDIUM timer leaks

**Files (Modify):**
- `frontend/src/components/chat/ConversationList.vue`
- `frontend/src/components/chat/ChatContactPanel.vue`

**Steps (đã xong):**
- [x] `ConversationList`: thêm `onBeforeUnmount` clear `patternTipTimer` + `rowRefs.clear()`.
- [x] `ChatContactPanel`: track `badgeBumpTimer` thay vì inline `setTimeout`, clear trong `onBeforeUnmount`.
- [x] `npx vue-tsc --noEmit` (frontend) pass.

### 5.3 Marketing — SequencesView step key bug

**Files (Modify):**
- `frontend/src/views/marketing/SequencesView.vue`

**Steps (đã xong):**
- [x] Thêm `_uid` cho mỗi step (monotonic counter).
- [x] Đổi `:key="idx"` → `:key="step._uid"` trong v-for.
- [x] `removeStep(uid)` thay cho `splice(idx)`.
- [x] `save()` strip `_uid` trước khi gửi API.
- [x] `npx vue-tsc --noEmit` (frontend) pass.

### 5.4 Reports — audited, không có bug MEDIUM thực sự

- DashboardView dùng `hub.fetchAll()` (đã centralized).
- JourneyFunnelView dùng path-based router, route `/reports/journey/:stage` đã có.
- Index keys trong OverviewReport/NickFleetReport/PipelineReport/AuditReport: array chỉ load từ API, không splice/push giữa → không có vấn đề DOM reuse.

### 5.5 Settings — audited, không có bug MEDIUM thực sự

- SystemNotificationsPage dùng `setTimeout` 350ms cho preview (debounce đúng pattern).
- TagTaxonomyV2Page filter là client-side computed → không cần debounce server.
- MessageTemplatesPage regex scan là `computed` → không có busy-wait.
