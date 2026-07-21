# Findings: AI Provider 'custom' + Khôi phục Marketing Lists

> Ghi chép các phát hiện trong quá trình phân tích + planning. Đọc song song với `task_plan.md`.

---

## F1. Open-core model đã tách EE ra repo riêng
- **Ngày**: 2026-07-21
- **Context**: Khi user yêu cầu "khôi phục các trang marketing/automation", tôi đã kiểm tra git log và phát hiện:
  - 21 file trong `frontend/src/views/automation/` bị xóa trong commit `24160d7` "B6 — move Automation + Marketing behind _ee".
  - ~50 file trong `backend/src/modules/automation/` cũng bị xóa trong cùng commit.
- **Implication**: Đây không phải "xóa nhầm" mà là **kiến trúc open-core có chủ đích**. Các tính năng EE (Trigger/Sequence/Block/Care Session/Lead Notify/Lead Pool/Friend-Invite) nằm ở EE private repo, KHÔNG phải phần user muốn khôi phục.
- **Quyết định**: Change này chỉ làm việc với Community Edition (Quét nhóm, Lists, Broadcast, Khối nội dung, Mục tiêu) và thêm tính năng mới.

## F2. AI provider registry có pattern rõ ràng để thêm provider mới
- **Ngày**: 2026-07-21
- **Context**: `backend/src/modules/ai/provider-registry.ts` đã có cấu trúc `PROVIDER_IDS` + `buildCatalog()` để thêm provider.
- **Implication**: Thêm provider `'custom'` chỉ cần:
  1. Thêm vào `PROVIDER_IDS` array.
  2. Thêm entry vào `buildCatalog()`.
  3. Thêm 3 env vars vào `config/index.ts`.
  4. Viết handler (hoặc reuse `generateWithOpenaiCompat`).
- **Lợi ích**: Per-org config tự động hoạt động qua `app_settings` (đã có pattern với 5 provider hiện tại).

## F3. User yêu cầu "cài đặt config trong database" — đã có pattern
- **Ngày**: 2026-07-21
- **Context**: User chọn option "cài đặt qua app_settings trong DB (per-org)" — giống 5 provider hiện có.
- **Implication**: KHÔNG cần hardcode vào `.env`. Mỗi org tự nhập baseUrl + apiKey ở Settings → AI Assistant. UI không cần thêm (đã có form chung cho 5 provider, chỉ cần provider `custom` xuất hiện thêm 1 row).

## F4. ListsView có sẵn service `use-customer-lists` composable
- **Ngày**: 2026-07-21
- **Context**: Khi đọc `ListsView.vue`, thấy nó dùng `useCustomerLists()` composable với các method: `fetchLists`, `archiveList`, `unarchiveList`, `rescanZalo`, `deleteList`.
- **Implication**: ListDetailView có thể dùng cùng composable + thêm `fetchList(id)`, `fetchEntries(id, filter)`, `updateList(id, data)`.

## F5. CreateListModal đã có sẵn đầy đủ 4 tabs (paste/excel/csv/leadads)
- **Ngày**: 2026-07-21
- **Context**: Khi đọc `CreateListModal.vue`, thấy modal này đã có đủ:
  - Tab "Paste danh sách" (textarea)
  - Tab "Upload Excel" (.xlsx/.xls)
  - Tab "Upload CSV" (.csv)
  - Tab "Lead Ads" (FB/TikTok/Google/Zalo/custom)
  - Dry-run stats panel (total/valid/invalid/dup)
  - Column mapping UI cho file upload
  - Lazy-load `exceljs` đã có sẵn
- **Implication**: Nút "Import CSV" trong `ListsView.vue` chỉ cần wire `@click="showCreate=true"` + chuyển `activeTab='csv'` (hoặc để user tự chọn). KHÔNG cần thêm tab mới, KHÔNG cần thêm composable CSV parser, KHÔNG cần validation real-time (đã có).
- **Action cập nhật**: Phase 2 R1 đơn giản hơn dự kiến — chỉ cần 2 thay đổi nhỏ trong `ListsView.vue`. Bỏ qua các tasks 2.3-2.8 (đã có sẵn trong modal).

## F6. Route `/marketing/lists/:id` có thể đã đăng ký ở EE
- **Ngày**: 2026-07-21
- **Context**: Khi đọc Community shell `CommunityMarketingShell.vue`, thấy các route con của `/marketing`. Cần verify trong apply xem route `/marketing/lists/:id` đã đăng ký chưa.
- **Implication**: Task 3.2 sẽ verify, có thể chỉ cần thêm nếu thiếu.

## F7. UI test phải manual, không có e2e tự động cho frontend
- **Ngày**: 2026-07-21
- **Context**: Repo chỉ có backend Vitest tests; frontend không có Cypress/Playwright.
- **Implication**: Verification cho frontend chỉ là `npx vue-tsc --noEmit` + manual test. Cần document rõ trong `progress.md`.

## F8. Polling 5s cho ListDetailView — chọn thay vì websocket
- **Ngày**: 2026-07-21
- **Context**: Có thể dùng socket event `customer-list:updated` (đã có pattern ở nhiều module), nhưng thêm socket event là scope creep.
- **Quyết định**: Polling 5s bằng `setInterval` cho đơn giản. Có thể upgrade sau.

## F9. `xlsx` package tăng bundle ~200KB
- **Ngày**: 2026-07-21
- **Context**: `xlsx` là dependency nặng (200KB+ gzipped). Nếu thêm vào bundle chính, sẽ tăng TTI cho user chưa dùng import.
- **Mitigation**: Lazy import chỉ khi user click tab "Import CSV" (dynamic `import('xlsx')` trong handler).
- **Action**: Task 2.5 phải dùng lazy import, không `import xlsx from 'xlsx'` ở top.

## F11. ListDetailView đã có sẵn (1863 dòng, Phase 3 R2 chỉ sửa nhỏ)
- **Ngày**: 2026-07-21
- **Context**: Phát hiện `frontend/src/views/marketing/ListDetailView.vue` đã được khôi phục trước đó (có date 2026-07-21 ở các commit gần). Đã có sẵn:
  - Breadcrumb "Tệp khách hàng > [tên]"
  - Hero stats với sub-tabs filter (all/valid/invalid/dup/dup_in_list/dup_cross_list/dup_with_crm/has_zalo/no_zalo)
  - Entries table với sortable, inline edit
  - Nút "Tạo Mục tiêu từ tệp này" (đã trỏ EE route)
  - Nút "Tự động giao & báo" (EE-only)
  - Nút "Quét lại Zalo"
  - Nút "Export CSV"
  - Menu Archive/Delete
- **Route** `/marketing/lists/:id` đã đăng ký ở `frontend/src/router/index.ts:227`.
- **Implication**: Phase 3 R2 chỉ cần:
  1. Sửa `onCreateMucTieu()` trỏ sang Community route `/marketing/targets` (thay vì EE `/marketing/triggers/tao-moi`).
  2. Thêm nút "Tạo Broadcast từ tệp này" + hàm `onCreateBroadcast()`.
- **Không cần**: tạo file mới, đăng ký route, làm 4 tabs (đã có sub-tabs tương đương).

## F12. CommunityMarketingShell đã đăng ký đủ các route cần thiết
- **Ngày**: 2026-07-21
- **Context**: Tất cả routes `/marketing/lists`, `/marketing/lists/:id`, `/marketing/broadcasts`, `/marketing/content-blocks`, `/marketing/targets` đều đã đăng ký trong router. Phase 3/4 không cần thêm route.

## F13. exceljs đã có sẵn thay vì xlsx
- **Ngày**: 2026-07-21
- **Context**: `frontend/package.json` đã có `exceljs@^4.4.0` (comment trong CreateListModal ghi rõ: "Phase 08 of security plan: replaced xlsx (GHSA-4r6h-8v6p-xvw6, unpatched prototype pollution + ReDoS) with exceljs, lazy-imported"). KHÔNG cần thêm `xlsx` package.
- **Implication**: Task 2.1 (cài package) → không cần. Lazy-import đã có sẵn.

---

## Open Questions (chờ user confirm trong Gate G1)

| # | Câu hỏi | Mặc định tôi dùng |
|---|---|---|
| Q1 | Custom provider dùng OpenAI-compat OK không? | Có |
| Q2 | Polling 5s cho ListDetailView OK không? | Có |
| Q3 | Lazy import `xlsx` OK không? | Có |
| Q4 | Có cần confirm dialog trước khi navigate sang broadcast/campaign? | Không, navigate trực tiếp + toast |

Nếu user không phản hồi Q1-Q3 trong Gate G1, tôi sẽ dùng mặc định trên.