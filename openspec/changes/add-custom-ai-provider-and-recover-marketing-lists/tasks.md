# Tasks: AI Provider 'custom' + Khôi phục Marketing Lists

> Parent: [proposal.md](../proposal.md) · [Specs](./specs/) · [Design](../design.md)
>
> **Quy ước**: Mỗi task ≤ 2 giờ. File paths dùng prefix `M` (Modify), `C` (Create), `T` (Test). Mỗi task có 1+ acceptance criterion từ specs và 1 verify command.

---

## Phase 1 — AI Provider 'custom' (Sprint 0)

### 1.1. Thêm env vars cho custom provider
- **File**: `M:backend/src/config/index.ts`
- **Nội dung**: Thêm 3 fields vào schema env: `CUSTOM_BASE_URL` (string, default=''), `CUSTOM_AUTH_TOKEN` (string, default=''), `CUSTOM_DEFAULT_MODEL` (string, default='gpt-3.5-turbo').
- **Verify**: `cd backend && npx tsc --noEmit` không lỗi; log `[config] CUSTOM_BASE_URL=...` xuất hiện khi boot.
- **AC**: REQ-CUSTOM-1 (chuẩn bị).

### 1.2. Thêm 'custom' vào catalog + type guard
- **File**: `M:backend/src/modules/ai/provider-registry.ts`
- **Nội dung**:
  - Thêm `'custom'` vào `PROVIDER_IDS` array.
  - Thêm `Catalog entry: { id: 'custom', name: 'Custom', baseUrl: config.customBaseUrl, authToken: config.customAuthToken }`.
  - Update `ProviderId` type → bao gồm 'custom'.
- **Verify**: `npx tsc --noEmit` pass; `getProviderConfig('custom')` trả về entry đúng.
- **AC**: REQ-CUSTOM-1.

### 1.3. Viết provider handler
- **File**: `C:backend/src/modules/ai/providers/custom.ts`
- **Nội dung**: Export `generateWithCustom(baseUrl, apiKey, model, system, prompt, maxTokens)` — thin wrapper gọi `generateWithOpenaiCompat(baseUrl + '/v1/chat/completions', apiKey, model, system, prompt, maxTokens)`. Log rõ ràng nếu baseUrl rỗng.
- **Verify**: `npx tsc --noEmit` pass; manual test với provider thật nếu user cung cấp baseUrl.
- **AC**: REQ-CUSTOM-4.

### 1.4. Wire 'custom' vào ai-service.ts
- **File**: `M:backend/src/modules/ai/ai-service.ts`
- **Nội dung**: Trong `generateText()`, thêm `if (provider === 'custom') return generateWithCustom(...)`.
- **Verify**: `npx tsc --noEmit` pass; curl `GET /api/v1/ai/providers` trả 6 entries có 'Custom'.
- **AC**: REQ-CUSTOM-1, REQ-CUSTOM-4.

### 1.5. Verify list models hoạt động
- **File**: `M:backend/src/modules/ai/providers/list-models.ts` (verify only, có thể đã loop qua catalog)
- **Nội dung**: Verify function `listProviderModels(orgId, 'custom')` được gọi từ route. Nếu `list-models.ts` đã enumerate qua catalog → không cần sửa.
- **Verify**: `curl /api/v1/ai/providers/custom/models` trả response hợp lệ (200 hoặc 200 + empty + error).
- **AC**: REQ-CUSTOM-3.

### 1.6. Unit test cho custom provider
- **File**: `C:backend/src/modules/ai/providers/custom.test.ts`
- **Nội dung**: Test (1) success path với fetch mock trả `{choices:[{message:{content:'hi'}}]}`, (2) empty baseUrl → throw, (3) HTTP 500 → throw với status code trong message.
- **Verify**: `npx vitest run backend/src/modules/ai/providers/custom.test.ts` → all pass.
- **AC**: REQ-CUSTOM-4.

---

## Phase 2 — Import CSV/Excel (Sprint 1, R1)

### 2.1. Cài package xlsx (nếu chưa có)
- **File**: `M:frontend/package.json`
- **Nội dung**: Thêm `"xlsx": "^0.18.5"` vào dependencies. Chạy `npm install`.
- **Verify**: `npm ls xlsx` → xlsx@0.18.5.
- **AC**: REQ-IMPORT-2 (chuẩn bị).

### 2.2. Bỏ disabled nút Import CSV trong ListsView
- **File**: `M:frontend/src/views/marketing/ListsView.vue`
- **Nội dung**: Bỏ attribute `disabled` + `title="Nhập danh sách từ tệp CSV"` ở nút `<button class="btn btn-ghost btn-sm" disabled title="...">`. Thay bằng `@click="openImport"`. Thêm hàm `openImport()`: emit event hoặc mở modal ở tab "Import CSV".
- **Verify**: UI test — click nút không còn bị disable.
- **AC**: REQ-IMPORT-1.

### 2.3. Thêm tab "Import CSV" vào CreateListModal
- **File**: `M:frontend/src/components/lists/CreateListModal.vue`
- **Nội dung**:
  - Thêm state `activeTab: 'create' | 'import'`.
  - Render 2 tab ở header modal.
  - Tab "Import": textarea + 2 input file (csv, xlsx) + preview table + stats panel + nút submit.
- **Verify**: UI test — modal có 2 tab, chuyển tab hoạt động.
- **AC**: REQ-IMPORT-2.

### 2.4. Viết composable detectDelimiter + validatePhones
- **File**: `C:frontend/src/composables/use-csv-parser.ts`
- **Nội dung**: Export 2 functions:
  - `detectDelimiter(text: string): ',' | ';' | '\t'` — count từng delimiter ở dòng đầu, lấy max.
  - `validatePhoneVn(phone: string): boolean` — match `0[3|5|7|8|9]xxxxxxxx` (10 số, bắt đầu 03/05/07/08/09).
- **Verify**: Manual test paste 5 SĐT → check.
- **AC**: REQ-IMPORT-3, REQ-IMPORT-4.

### 2.5. Parse CSV (paste + upload)
- **File**: `M:frontend/src/components/lists/CreateListModal.vue`
- **Nội dung**:
  - Khi user paste vào textarea → debounce 500ms → split dòng → detectDelimiter → split cột → validate từng dòng.
  - Khi user upload `.csv` → FileReader.readAsText → cùng pipeline.
  - Khi user upload `.xlsx` → `XLSX.read(file, {type:'array'})` → `XLSX.utils.sheet_to_json(sheet, {header:1})` → cùng pipeline.
- **Verify**: Upload file 100 SĐT → preview render đúng 10 dòng đầu.
- **AC**: REQ-IMPORT-2, REQ-IMPORT-3.

### 2.6. Render stats panel real-time
- **File**: `M:frontend/src/components/lists/CreateListModal.vue`
- **Nội dung**: Computed `stats` = `{ total, valid, dupInFile, dupInCrm, invalid }`. Render grid 4 cards với màu (xanh/vàng/cam/đỏ).
- **Verify**: Paste 100 SĐT có 80 valid → stats hiển thị "Hợp lệ: 80".
- **AC**: REQ-IMPORT-4.

### 2.7. Confirm dialog + submit
- **File**: `M:frontend/src/components/lists/CreateListModal.vue`
- **Nội dung**:
  - Nút "Tạo tệp & Import" → mở confirm với stats + tên tệp.
  - Khi confirm → POST `/api/v1/customer-lists/import` với `{ name, source: 'paste'|'csv'|'xlsx', entries: [...] }`.
  - Success → emit `created` event với `{id}`, modal đóng, parent router.push.
  - Error → toast error, modal giữ nguyên để retry.
- **Verify**: Submit thành công → navigate đến `/marketing/lists/<id>`.
- **AC**: REQ-IMPORT-5, REQ-IMPORT-6, REQ-IMPORT-7.

### 2.8. Client-side file size guard
- **File**: `M:frontend/src/components/lists/CreateListModal.vue`
- **Nội dung**: Trước khi upload → check `file.size > 5 * 1024 * 1024` → toast error "File quá lớn (>5MB)".
- **Verify**: Upload file 10MB → toast lỗi, không gửi request.
- **AC**: REQ-IMPORT-7 (edge case).

---

## Phase 3 — ListDetailView (Sprint 1, R2)

### 3.1. Tạo file ListDetailView.vue (skeleton + 4 tabs)
- **File**: `C:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Setup script: `useRoute`, `useRouter`, fetch list by id.
  - Template: breadcrumb + 4 tab buttons (Tổng quan / Khách hàng / Lịch sử / Cài đặt) + router-view cho tab content.
  - Empty state nếu list không tồn tại.
  - Polling 5s `setInterval(fetchList, 5000)` + clear on unmount.
- **Verify**: Navigate đến `/marketing/lists/<id>` → render skeleton.
- **AC**: REQ-DETAIL-1.

### 3.2. Verify route đã đăng ký
- **File**: `M:frontend/src/router/index.ts` (verify only)
- **Nội dung**: Tìm `path: '/marketing/lists/:id'`. Nếu có → không sửa. Nếu thiếu → thêm route với component `ListDetailView`.
- **Verify**: Grep `marketing/lists/:id` trong router.
- **AC**: REQ-DETAIL-1.

### 3.3. Tab Tổng quan — stats + chart
- **File**: `M:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Header: tên tệp + chips (status, người tạo, ngày).
  - 4 stat cards dùng `.mstat` class (giống ListsView).
  - Progress bar 3 đoạn (valid/dup/invalid).
  - Mini donut chart "Phân bổ nguồn" (dùng inline SVG, không cần Chart.js).
- **Verify**: Tab render với data thật, progress bar đúng %.
- **AC**: REQ-DETAIL-2.

### 3.4. Tab Khách hàng — table + filter + pagination
- **File**: `M:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Bảng với 7 cột (REMAINING nội dung trong spec).
  - Search input debounce 300ms → fetch entries với filter `search`.
  - Filter dropdown → fetch với filter `status`.
  - Sort click header → fetch với `sortBy` + `sortDir`.
  - Pagination 25/50/100 dòng/trang.
  - Polling 5s refresh data (D3 decision).
- **Verify**: List 500 KH → render < 1s, search "Nguyễn" filter OK.
- **AC**: REQ-DETAIL-3.

### 3.5. Tab Lịch sử
- **File**: `M:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Fetch `GET /api/v1/activity-log?entityType=customer_list&entityId=<id>` (verify endpoint có sẵn).
  - Render danh sách theo thời gian DESC.
  - Mỗi item: icon + message + thời gian (relative).
- **Verify**: Sau khi archive list → tab Lịch sử hiển thị event "Archive".
- **AC**: REQ-DETAIL-4.

### 3.6. Tab Cài đặt — form edit
- **File**: `M:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Form input tên, integration key (validate không trùng), shareable toggle.
  - Nút "Lưu thay đổi" → PATCH `/api/v1/customer-lists/:id`.
  - Nút "Lưu trữ tệp" (admin only) → archive flow.
  - Nút "Xoá vĩnh viễn" (admin only) → confirm 2 bước → delete flow.
  - Nếu `fbLocked=true` → disable các input + nút liên quan.
- **Verify**: Admin edit tên → save → list cập nhật ở ListsView.
- **AC**: REQ-DETAIL-5.

### 3.7. Action bar — Tạo broadcast từ tệp
- **File**: `M:frontend/src/views/marketing/ListDetailView.vue`
- **Nội dung**:
  - Nút "📢 Tạo broadcast" → `router.push('/marketing/broadcasts?listId=' + listId)`.
  - Nút "🎯 Tạo campaign mục tiêu" → `router.push('/marketing/targets?listId=' + listId)`.
  - Nút "📥 Export CSV" → gọi API export hoặc generate client-side từ data hiện có.
- **Verify**: Click nút → navigate đúng.
- **AC**: REQ-DETAIL-6, REQ-DETAIL-7.

---

## Phase 4 — Wire nút từ ListsView (Sprint 1, R3)

### 4.1. Wire nút "Tạo broadcast" trong ListsView row-actions
- **File**: `M:frontend/src/views/marketing/ListsView.vue`
- **Nội dung**: Thêm `@click.stop="goCreateBroadcast(list.id)"` cho icon `<v-icon>mdi-send</v-icon>`. Hàm `goCreateBroadcast(id)` gọi `router.push('/marketing/broadcasts?listId=' + id)`.
- **Verify**: Click nút → navigate, không bubble lên row-click.
- **AC**: REQ-WIRE-1.

### 4.2. Thêm nút "Tạo campaign mục tiêu" trong ListsView row-actions
- **File**: `M:frontend/src/views/marketing/ListsView.vue`
- **Nội dung**: Thêm 1 button mới với `<v-icon>mdi-account-multiple-plus-outline</v-icon>` + `@click.stop="goCreateCampaign(list.id)"`. Hàm `goCreateCampaign(id)` gọi `router.push('/marketing/targets?listId=' + id)`. Có tooltip "Tạo campaign mục tiêu".
- **Verify**: Click nút → navigate.
- **AC**: REQ-WIRE-2.

### 4.3. BroadcastsView đọc query.listId
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**:
  - Import `useRoute` từ 'vue-router'.
  - Trong `onMounted`: check `route.query.listId`. Nếu có → call `openCreate()` với `form.customerListId = route.query.listId`.
  - Hiển thị toast info "📂 Đã chọn tệp '<tên>'" — cần fetch tên tệp từ id trước (gọi GET `/customer-lists/:id`).
- **Verify**: Navigate từ ListsView → BroadcastsView pre-fill xong.
- **AC**: REQ-WIRE-3, REQ-WIRE-5.

### 4.4. TargetsView đọc query.listId
- **File**: `M:frontend/src/views/marketing/TargetsView.vue`
- **Nội dung**: Tương tự 4.3 nhưng cho TargetsView. Verify form có field `customerListId` để pre-fill.
- **Verify**: Navigate từ ListsView → TargetsView pre-fill xong.
- **AC**: REQ-WIRE-4, REQ-WIRE-5.

---

## Verification (Gate G4)

### 5.1. Backend typecheck
- **Command**: `cd backend && npx tsc --noEmit`
- **Pass criteria**: Exit 0, 0 errors.

### 5.2. Backend unit test (custom provider)
- **Command**: `cd backend && npx vitest run modules/ai/providers/custom.test.ts`
- **Pass criteria**: All tests pass.

### 5.3. Backend manual smoke test
- **Command**:
  ```bash
  curl -X GET http://localhost:3000/api/v1/ai/providers -H "Authorization: Bearer <token>"
  # expect 6 providers including "Custom"
  
  curl -X PUT http://localhost:3000/api/v1/ai/providers/custom \
    -H "Authorization: Bearer <token>" \
    -d '{"baseUrl":"https://my-llm.example.com","apiKey":"sk-test"}'
  # expect {ok: true}
  
  curl -X GET http://localhost:3000/api/v1/ai/providers/custom/models -H "Authorization: Bearer <token>"
  # expect 200 + {models: []} hoặc danh sách
  ```

### 5.4. Frontend typecheck
- **Command**: `cd frontend && npx vue-tsc --noEmit`
- **Pass criteria**: Exit 0, 0 errors.

### 5.5. Frontend manual UI test
- **Steps**:
  1. Login → vào /marketing/lists.
  2. Click "Import CSV" → modal mở tab Import.
  3. Paste 100 SĐT → preview render đúng.
  4. Submit → navigate đến /marketing/lists/<id>.
  5. Từ /marketing/lists/<id> → click "📢 Tạo broadcast" → BroadcastsView mở với listId pre-fill.
  6. Vào /settings/ai → thấy provider "Custom" → set baseUrl+apiKey → save OK.

### 5.6. Spec conformance review
- **Tool**: Code reviewer subagent hoặc inline review.
- **Check**:
  - REQ-CUSTOM-1..5: tất cả implemented.
  - REQ-IMPORT-1..7: tất cả implemented.
  - REQ-DETAIL-1..7: tất cả implemented.
  - REQ-WIRE-1..5: tất cả implemented.
- **Pass criteria**: 0 missing, 0 extra (không làm ngoài spec).

---

## Estimated Timeline

| Phase | Tasks | Effort |
|---|---|---|
| Phase 1 — Provider | 1.1 → 1.6 | 0.5 ngày |
| Phase 2 — Import | 2.1 → 2.8 | 2 ngày |
| Phase 3 — ListDetail | 3.1 → 3.7 | 2 ngày |
| Phase 4 — Wire | 4.1 → 4.4 | 0.5 ngày |
| Verification | 5.1 → 5.6 | 0.5 ngày |
| **Tổng** | | **~5.5 ngày** |

---

## Out of Scope (sẽ làm ở change riêng)

- A/B test Broadcast, Reply tracking, Heatmap giờ gửi → change `add-broadcast-ab-testing`.
- AI Suggest cho Khối nội dung → change `add-ai-content-suggest`.
- Lead Scoring Visualizer → change `add-scoring-visualizer`.
- Mọi tính năng EE (Trigger/Sequence/Block/Care/Lead Notify/Lead Pool) → KHÔNG làm ở Community.

---

## Dependencies đã verify

- ✅ `ai-service.ts` đã loop qua provider id trong `generateText`.
- ✅ `provider-registry.ts` có pattern thêm provider qua `PROVIDER_IDS`.
- ✅ `list-routes.ts` đã có POST `/customer-lists/import` (verify trong apply).
- ✅ `use-customer-lists` composable có `archiveList`, `unarchiveList`, `rescanZalo`, `deleteList`.
- ✅ `use-toast`, `use-confirm` composables đã có sẵn.
- ✅ Route `/marketing/lists/:id` — cần verify trong apply.
- ⚠️ Endpoint `/activity-log` cho tab Lịch sử — cần verify trong apply (nếu thiếu → dùng fallback query trực tiếp bảng activity).