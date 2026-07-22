# Tasks: fix-zalo-crm-mvp-gaps

Mỗi task ước tính ≤ 2 giờ. Verify bằng lệnh cụ thể. Trước khi bắt đầu bất kỳ task nào, chạy
`docs/plans/MVP-PRECHECK.md` (xem cuối file) để xác nhận Docker + DB đang chạy.

---

## 0. Môi trường (Pre-check) — 0.5h

**Files:**
- `backend/prisma/schema.prisma` (sửa encoding UTF-8 + comment tiếng Việt nếu cần)
- `docker-compose.dev.yml` (thêm env default cho AI nếu cần)

**Steps:**
- [x] Mở `backend/prisma/schema.prisma` bằng VS Code → "Save with Encoding" → UTF-8 (with BOM).
- [x] Chạy: `docker compose -f docker-compose.dev.yml exec app npx prisma migrate status` → phải báo "up to date" hoặc liệt kê pending.
- [x] Chạy: `docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy`.

**Verify:** `prisma migrate status` không còn lỗi UTF-8; các bảng `scheduled_template_sends`, `sequence_memberships`, `auto_reply_rules`, `automation_execution_logs` tồn tại (`docker compose exec db psql -U zalo -d zalocrm -c "\dt"`).

---

## 1. AI 9router connectivity — 1.5h

**Files (Create):**
- `backend/src/modules/ai/ai-host-resolver.ts`

**Files (Modify):**
- `backend/src/modules/ai/ai-service.ts`
- `backend/src/modules/ai/providers/custom.ts`
- `frontend/src/views/settings/AiAssistantPage.vue`
- `frontend/src/api/ai.ts` (nếu chưa có hàm `testConnection`)

**Steps:**
- [x] Tạo helper `resolveHost(baseUrl)` thay `localhost`/`127.0.0.1` thành `host.docker.internal` khi chạy trong container.
- [x] Trong `generateWithCustom` & `generateWithOpenaiCompat`: gọi `resolveHost`, đồng thời loại bỏ `/v1` trùng lặp khi nối `/v1/chat/completions`.
- [x] Cập nhật `AiAssistantPage.vue`: thêm cảnh báo "Đang chạy trong Docker — dùng host.docker.internal".
- [x] Nút "Test kết nối" phải hiển thị kết quả HTTP code + model đầu tiên trong response.

**Verify:**
- `curl http://host.docker.internal:20128/v1/models` từ trong container trả 200.
- Gọi `POST /api/v1/ai/test-connection` với provider=custom, baseUrl=http://host.docker.internal:20128/v1 → trả `{ ok: true, models: [...] }`.

---

## 2. Automation menu trong Reports — 0.5h

**Files (Modify):**
- `frontend/src/layouts/DefaultLayout.vue`

**Steps:**
- [x] Mở dropdown Báo cáo, thêm mục "Tự động hóa" (`to: /automation`, icon `mdi-robot-outline`).
- [x] Đặt `v-if` cho phép cả Community và Enterprise, bỏ điều kiện `isExtension`.

**Verify:** Mở UI, vào Báo cáo → thấy mục "Tự động hóa" → click mở `/automation`.

---

## 3. Lead Pool FIFO + UI — 2h (chia 2 task)

### 3a. Backend Lead Pool endpoints — 1h

**Files (Create):**
- `backend/src/modules/lead-pool/lead-pool-routes.ts`
- `backend/src/modules/lead-pool/lead-pool-service.ts`

**Steps:**
- [x] `GET /api/v1/lead-pool/leads?status=available` — danh sách (phân trang).
- [x] `POST /api/v1/lead-pool/request` — body `{ note?: string }`, kiểm tra quota trong transaction, lấy 1 lead `FOR UPDATE SKIP LOCKED`, gán cho user, log vào `lead_pool_distributions`.
- [x] `GET /api/v1/lead-pool/quota` — quota còn lại của user hiện tại.

**Verify:** `vitest run src/modules/lead-pool` + Postman: tạo 2 user, mỗi user request 1 lead → không trùng.

### 3b. Frontend Lead Pool UI — 1h

**Files (Create):**
- `frontend/src/views/marketing/LeadPoolView.vue`
- `frontend/src/components/lead-pool/LeadRequestButton.vue`
- `frontend/src/api/lead-pool.ts`

**Files (Modify):**
- `frontend/src/views/marketing/CommunityMarketingShell.vue` — thêm nút "Lead Pool".
- `frontend/src/router/index.ts`

**Verify:** Mở `/marketing/lead-pool` thấy dashboard + bảng; sale bấm "Nhận Lead" được 1 khách mới.

---

## 4. Scoring rules editable — 1.5h

**Files (Modify):**
- `frontend/src/views/ScoringSettingsView.vue`
- `frontend/src/composables/use-scoring.ts`
- `backend/src/modules/scoring/scoring-routes.ts` (thêm validate input)

**Steps:**
- [x] Trong `ScoringSettingsView`, đổi bảng rule từ read-only sang `v-data-table` có cột "Hành động" với nút Sửa (mở dialog) và Bật/Tắt.
- [x] Dialog cho phép đổi `name`, `description`, `weight`, `enabled`. (Không cho đổi `code` và `conditions` trong đợt này.)
- [x] Bổ sung validate: weight ∈ [-100, 100], enabled ∈ boolean.

**Verify:** Gọi `PUT /scoring/rules/:id` qua UI, refresh trang thấy giá trị mới.

---

## 5. System sender account trong Notifications — 1h

**Files (Modify):**
- `frontend/src/views/settings/SystemNotificationsPage.vue`

**Files (Create):**
- `frontend/src/api/system-sender.ts`

**Steps:**
- [x] Thêm block "Tài khoản Zalo gửi thông báo hệ thống" ngay đầu trang.
- [x] `v-select` liệt kê các tài khoản Zalo OA/cá nhân đang kết nối, cho phép chọn 1.
- [x] Lưu qua `PUT /api/v1/system-notifications/sender-account`.

**Verify:** UI lưu thành công; reload giữ nguyên giá trị đã chọn.

---

## 6. Chat AI + Follow-up — 2h (chia 2 task)

### 6a. AI suggestion trong Chat — 1h

**Files (Modify):**
- `frontend/src/views/ChatView.vue`
- `frontend/src/api/chat.ts`

**Steps:**
- [x] Đảm bảo nút "Gợi ý AI" gọi `POST /api/v1/ai/suggest` với `conversationId`.
- [x] Khi nhận `{ suggestions: [...] }`, render 3 chip có thể click để chèn vào textarea.
- [x] Nếu backend lỗi, hiển thị `v-alert` với thông điệp + link đến trang AI Settings.

**Verify:** Mở 1 conversation, bấm "Gợi ý AI" → thấy 3 gợi ý.

### 6b. Follow-up sequence — 1h

**Files (Modify):**
- `backend/src/modules/sequences/sequence-executor.ts` (đảm bảo cron chạy)
- `frontend/src/views/automation/SequencesTab.vue` (làm mới trạng thái)

**Steps:**
- [x] Chạy `npm run cron:status` (hoặc log) để xác nhận worker sequence đang chạy.
- [x] Nếu cron không chạy → thêm vào `app.ts` `setupSequenceWorker()` khi boot.
- [x] Trên UI, thêm cột "Lần chạy tiếp theo" + "Số KH đang active".

**Verify:** Tạo 1 sequence có 1 step "Sau 1 ngày"; thêm 1 contact vào sequence; sau 1 ngày (hoặc chạy tay) → step chuyển trạng thái.

---

## 7. Group scan scroll — 0.5h

**Files (Modify):**
- `frontend/src/views/GroupScanView.vue`
- `frontend/src/components/marketing/GroupScanResults.vue` (nếu tồn tại)

**Steps:**
- [x] Tìm container scroll của bảng kết quả, thêm `class="overflow-y-auto"` + `style="max-height: calc(100vh - 240px)"`.
- [x] Đảm bảo parent flex container có `min-height: 0`.

**Verify:** Mở `/marketing/group-scan`, có >20 nhóm → cuộn được xuống dưới.

---

## 8. Broadcast polish — 1h

**Files (Modify):**
- `frontend/src/views/marketing/BroadcastPage.vue`
- `frontend/src/components/marketing/broadcast/*` (nếu có)

**Steps:**
- [x] Khi submit broadcast chưa có template → `v-alert` cảnh báo + link "Tạo mẫu ngay".
- [x] Loading spinner toàn trang khi gọi `POST /broadcasts`.
- [x] Empty state: hiển thị hướng dẫn khi chưa có campaign nào.

**Verify:** Tạo broadcast thiếu trường → thấy cảnh báo rõ ràng.

---

## 9. Message template create confirm — 0.5h

**Files (Modify):**
- `frontend/src/views/settings/MessageTemplatesPage.vue`
- `frontend/src/components/templates/TemplateEditor.vue`

**Steps:**
- [x] Khi mở form "Tạo mẫu mới", hiển thị 2 nút ở footer: "Hủy" và "Lưu & Đóng".
- [x] Nút "Lưu & Đóng" chỉ enable khi đã nhập `name` + `content`.

**Verify:** Mở dialog tạo mẫu mới → thấy nút "Lưu & Đóng".

---

## Tiêu chí hoàn thành đợt

- Tất cả 9 capability trên đều có acceptance scenario pass.
- `npm run typecheck` (frontend) không lỗi.
- `npm run test --workspace backend` pass.
- Build Docker thành công.
