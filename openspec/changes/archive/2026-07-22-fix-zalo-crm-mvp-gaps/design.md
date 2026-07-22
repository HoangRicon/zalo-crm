# Design: fix-zalo-crm-mvp-gaps

> Companion file cho `proposal.md` và `tasks.md`. Định nghĩa kiến trúc, sequence diagram, schema
> deltas, rollback chi tiết cho từng capability.

---

## 0. Môi trường & tiền đề

| Thành phần | Trạng thái hiện tại | Hành động |
|------------|---------------------|-----------|
| `backend/prisma/schema.prisma` | Lỗi UTF-8, `prisma migrate status` không chạy được | Save lại UTF-8 (BOM) trước khi chạy mọi migration |
| `docker-compose.dev.yml` | Container `zalo-crm-dev` chạy OK; env `RUNNING_IN_DOCKER` có thể chưa có | Thêm `RUNNING_IN_DOCKER=1` |
| Migration `20260722205048_add_automation_features` | Chưa apply (bảng `scheduled_template_sends`, `sequence_memberships` thiếu) | `npx prisma migrate deploy` |
| `app_settings` rows | Có sẵn `ai_custom_base_url`, `ai_custom_api_key` | Chỉ đọc |

---

## 1. AI 9router Connectivity

### Sequence diagram

```
[UI: AiAssistantPage] --POST /ai/test-connection--> [Fastify route]
                                                        |
                                                        v
                                              [provider-registry]
                                                        |
                                                        v
                              [resolveHost(baseUrl)] -> host.docker.internal
                                                        |
                                                        v
                              [GET {resolvedUrl}/models] --> [9router on host]
                                                        |
                                            200 {data:[...]} -> UI render
```

### Code map

| File | Vai trò |
|------|---------|
| `backend/src/modules/ai/ai-host-resolver.ts` (NEW) | `resolveHost(url: string): string` — thay localhost bằng host.docker.internal khi `RUNNING_IN_DOCKER===1` |
| `backend/src/modules/ai/ai-service.ts` | Gọi `resolveHost(baseUrl)` trước khi build URL |
| `backend/src/modules/ai/providers/custom.ts` | Gọi `resolveHost`; check `/v1` trùng lặp |
| `backend/src/modules/ai/providers/openai-compat.ts` | Nhận đã-trim baseUrl, không tự nối `/v1` |
| `frontend/src/views/settings/AiAssistantPage.vue` | UI banner cảnh báo + nút Test kết nối |

### Helper mẫu (chỉ tham khảo, chưa implement)

```ts
// ai-host-resolver.ts
export function resolveHost(rawUrl: string): string {
  if (process.env.RUNNING_IN_DOCKER !== '1') return rawUrl;
  return rawUrl
    .replace('localhost', 'host.docker.internal')
    .replace('127.0.0.1', 'host.docker.internal');
}
```

### Schema delta

Không thay đổi schema. Chỉ thay đổi code runtime.

### Rollback

- Revert 4 file trên.
- Xóa env `RUNNING_IN_DOCKER=1` khỏi `docker-compose.dev.yml`.

---

## 2. Automation menu in Reports

### Diff tóm tắt (DefaultLayout.vue)

```diff
  <v-list>
+   <v-list-item link to="/automation" prepend-icon="mdi-robot-outline">
+     Tự động hóa
+   </v-list-item>
    <v-list-item v-if="isExtension" ...>
  </v-list>
```

### Schema delta

Không.

### Rollback

`git checkout -- frontend/src/layouts/DefaultLayout.vue`.

---

## 3. Lead Pool FIFO + UI

### Sequence diagram (nhận lead)

```
[Sale UI: Nhận Lead]
        |
        v
[POST /lead-pool/request]
        |
        v
[LeadPoolService.requestLead(orgId, userId)]
        |
        v
[Prisma transaction:
   SELECT id FROM lead_pool
    WHERE orgId = $1 AND status='available'
    ORDER BY createdAt ASC
    FOR UPDATE SKIP LOCKED
   LIMIT 1]
        |
        v
[UPDATE lead_pool SET assignedTo=$userId, status='assigned']
        |
        v
[INSERT lead_pool_distributions(...)]
        |
        v
[Decrement quota.user.remaining]
        |
        v
[Return lead {id, phone, source, createdAt}]
```

### Schema delta

Không — `lead_pool`, `lead_pool_distributions`, `lead_pool_config` đã có (sẽ verify sau khi
migration thành công). Nếu thiếu `lead_pool_config` thì migration mới:

```sql
-- chỉ thêm nếu chưa có
CREATE TABLE IF NOT EXISTS lead_pool_config (
  org_id        TEXT PRIMARY KEY REFERENCES orgs(id),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  max_per_day   INT     NOT NULL DEFAULT 10,
  cooldown_min  INT     NOT NULL DEFAULT 0,
  auto_return_min INT   NOT NULL DEFAULT 1440,
  enabled_sources TEXT[] NOT NULL DEFAULT ARRAY['forgotten','customer_list','external_sync'],
  require_phone BOOLEAN NOT NULL DEFAULT true,
  force_note    BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Endpoint mới

| Method | Path | Service |
|--------|------|---------|
| GET | `/api/v1/lead-pool/leads` | list available + paging |
| GET | `/api/v1/lead-pool/quota` | quota user |
| POST | `/api/v1/lead-pool/request` | body `{note?}`, transaction |
| GET | `/api/v1/lead-pool/distributions` | history |
| GET/PUT | `/api/v1/lead-pool/config` | admin |

### Code map (Create)

```
backend/src/modules/lead-pool/
  lead-pool-routes.ts        # Fastify routes + RBAC
  lead-pool-service.ts       # transaction logic
  lead-pool.test.ts          # vitest (concurrent)

frontend/src/
  api/lead-pool.ts           # axios wrapper
  views/marketing/LeadPoolView.vue
  components/lead-pool/LeadRequestButton.vue
  views/settings/LeadPoolSettingsPage.vue
```

### Rollback

- Drop route → tắt `lead_pool_config.enabled=true` → revert code.

---

## 4. Scoring rules editable UI

### Diff tóm tắt

- `ScoringSettingsView.vue`: bảng rule đổi từ `<v-list>` read-only sang `<v-data-table>` có cột hành động.
- Dialog mới: `<SignalRuleEditDialog>` (component cùng folder).
- `use-scoring.ts`: thêm hàm `toggleSignalRule(id, enabled)` gọi `PATCH /scoring/rules/:id`.

### Schema delta

Không.

### Rollback

Revert 3 file.

---

## 5. System sender account trong Thông báo hệ thống

### Diff tóm tắt

- `SystemNotificationsPage.vue`: thêm block "Tài khoản Zalo gửi thông báo" đầu trang.
- `system-sender.ts` (NEW): gọi `GET /system-notifications/sender-account-options` + `PUT /system-notifications/sender-account`.

### Backend mới

```ts
// backend/src/modules/system-notifications/system-notifications-routes.ts
fastify.put('/api/v1/system-notifications/sender-account', {
  preHandler: [requireGrant('settings:write')],
}, async (req) => {
  const { accountId } = req.body as { accountId: string };
  await setSetting(req.orgId, 'system_sender_account_id', accountId);
  return { ok: true };
});
```

### Schema delta

Nếu `system_sender_account_id` chưa có trong `app_settings` key/value table → không cần migration.

### Rollback

Revert 2 file frontend + 1 route backend.

---

## 6. Chat AI + Follow-up

### Diff tóm tắt

- `ChatView.vue`: gọi lại `POST /api/v1/ai/suggest`, render 3 chip, có `v-alert` khi lỗi.
- `backend/src/app.ts`: thêm `setupSequenceWorker()` nếu chưa có.

### Sequence diagram (sequence worker boot)

```
[backend boot]
   |
   v
[registerRoutes() → app.ts]
   |
   v
[if ENABLE_SEQUENCE_WORKER === '1': sequenceExecutor.start()]
   |
   v
[cron every 60s: SELECT sequence_memberships WHERE nextRunAt <= now()]
   |
   v
[for each: executeStep()]
```

### Schema delta

Không.

### Rollback

Revert 2 file.

---

## 7. Group scan scroll

### Diff tóm tắt (GroupScanView.vue)

```diff
- <div class="overflow-auto">
+ <div class="overflow-y-auto" style="max-height: calc(100vh - 240px)">
    <v-data-table ... />
  </div>
```

Và parent flex:

```diff
- <div class="d-flex flex-column">
+ <div class="d-flex flex-column" style="min-height: 0">
```

### Schema delta

Không.

### Rollback

Revert 1 file.

---

## 8. Broadcast polish

### Diff tóm tắt

- Thêm `<v-alert v-if="errors.length">` đầu form.
- `<v-btn :loading="submitting">Gửi</v-btn>`.
- `<v-overlay v-model="submitting" />`.
- `<v-empty-state>` khi list rỗng.

### Schema delta

Không.

### Rollback

Revert file.

---

## 9. Message template create confirm

### Diff tóm tắt (`TemplateEditor.vue`)

```diff
- <v-card-actions>
-   <v-btn @click="close">Đóng</v-btn>
- </v-card-actions>
+ <v-card-actions>
+   <v-btn variant="text" @click="close">Hủy</v-btn>
+   <v-btn
+     color="primary"
+     :disabled="!form.name || !form.content"
+     :loading="saving"
+     @click="saveAndClose"
+   >Lưu & Đóng</v-btn>
+ </v-card-actions>
```

### Schema delta

Không.

### Rollback

Revert file.

---

## Tổng kết file cần đụng

| Capability | Backend (M/C) | Frontend (M/C) | Schema (Y/N) |
|------------|---------------|----------------|--------------|
| 1 AI 9router | M: 3, C: 1 | M: 1, C: 0 | N |
| 2 Automation menu | 0 | M: 1 | N |
| 3 Lead Pool | C: 3 | C: 5 | N (or Y nếu thiếu) |
| 4 Scoring edit | M: 1 | M: 2 | N |
| 5 System sender | C: 1 | C: 1, M: 1 | N |
| 6 Chat AI + follow-up | M: 1 | M: 1 | N |
| 7 Group scroll | 0 | M: 1 | N |
| 8 Broadcast polish | 0 | M: 1 | N |
| 9 Template confirm | 0 | M: 1 | N |

**Tổng:** ~13 file backend, ~14 file frontend, 0–1 schema migration.

## Thứ tự triển khai đề xuất

1. Task 0 — sửa UTF-8 + chạy `migrate deploy` (mở khóa mọi thứ sau).
2. Task 1 — AI 9router (mở khóa Chat AI + AI suggestion).
3. Task 2 — Automation menu (nhỏ, nhanh).
4. Task 7 — Group scan scroll (nhỏ, nhanh).
5. Task 9 — Template confirm (nhỏ, nhanh).
6. Task 4 — Scoring edit.
7. Task 5 — System sender.
8. Task 6 — Chat AI + sequence worker.
9. Task 3 — Lead Pool (lớn nhất).
10. Task 8 — Broadcast polish (cuối).
