# Proposal: Thêm AI provider 'custom' + Khôi phục tính năng Marketing Lists

> **Change ID**: `add-custom-ai-provider-and-recover-marketing-lists`
> **Created**: 2026-07-21
> **Schema**: spec-driven (OpenSpec)
> **Plan**: [docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 0 + Sprint 1

---

## Why

ZCRM có 5 AI provider (anthropic, gemini, openai, qwen, kimi) nhưng user có baseurl/apikey/model **riêng** cần tích hợp. Provider mới phải dùng chung cơ chế `app_settings` để quản lý per-org, không hardcode env.

Đồng thời, trang Marketing "Tệp khách hàng" (ListsView) thiếu 3 chức năng quan trọng đã từng chạy trước khi tách EE:
1. **Import CSV/Excel** — nút bị `disabled` dù backend `list-import-service.ts` đã có sẵn.
2. **ListDetailView phiên bản Community** — không có (chỉ có ở EE private).
3. **Wire nút "Tạo broadcast/campaign"** — icon đã hiển thị nhưng chưa có handler.

User đã chọn full_vision và tích hợp provider qua DB config. Sprint 0 + Sprint 1 được gộp vào 1 change vì chia sẻ hạ tầng AI provider.

---

## What Changes

### Capability 1: AI Provider 'custom' (Sprint 0)
- Thêm provider id `'custom'` vào `PROVIDER_IDS` array trong `provider-registry.ts`.
- Thêm `CUSTOM_BASE_URL`, `CUSTOM_AUTH_TOKEN`, `CUSTOM_DEFAULT_MODEL` vào `config/index.ts`.
- Viết `providers/custom.ts` — handler cho custom provider. Mặc định dùng `generateWithOpenaiCompat` (vì hầu hết custom provider theo chuẩn OpenAI). Nếu cần chuẩn riêng, viết handler mới tương tự `anthropic.ts`.
- Provider phải:
  - Hiển thị trong `GET /api/v1/ai/providers` (UI "Cài đặt AI").
  - Nhận baseUrl + apiKey per-org qua `PUT /api/v1/ai/providers/custom` (lưu AES-GCM vào `app_settings`).
  - List models qua `GET /api/v1/ai/providers/custom/models` (gọi API `/models` của provider hoặc fallback gõ tay).
  - Generate qua `generateText(provider='custom', ...)` — reuse `generateWithOpenaiCompat` nếu API tương thích.

### Capability 2: Import CSV/Excel cho Tệp khách hàng (R1)
- Bỏ `disabled` ở nút "Import CSV" trong `ListsView.vue`.
- Tab mới "Import CSV" trong `CreateListModal.vue` (cùng modal với tạo tệp rỗng).
- Hỗ trợ:
  - **Paste SĐT** (1 cột hoặc nhiều cột, auto-detect delimiter).
  - **Upload `.csv`** (dùng `papaparse` hoặc native split).
  - **Upload `.xlsx`** (dùng `xlsx` package).
- Preview 10 dòng đầu trước khi import (tên cột + 3 dòng mẫu).
- Thống kê real-time: tổng dòng, valid (đúng format SĐT VN), trùng trong file, trùng CRM.
- Gọi endpoint backend đã có: `POST /api/v1/customer-lists/import` (verify trong `list-routes.ts`).

### Capability 3: ListDetailView phiên bản Community (R2)
- File mới: `frontend/src/views/marketing/ListDetailView.vue`.
- 4 tabs:
  1. **Tổng quan** — stats (tổng KH, valid, trùng, có Zalo), progress bar, biểu đồ mini.
  2. **Khách hàng** — bảng KH trong tệp (search, filter valid/dup/no-zalo, sort, phân trang).
  3. **Lịch sử** — danh sách import events (thời gian, người import, bao nhiêu dòng).
  4. **Cài đặt** — đổi tên, archive, integration key (#mã cho Lead Ads), shareable-to-pool toggle.
- Mini `scoreBreakdown` hiển thị nếu KH đã có Friend records.
- Action bar: **"Tạo broadcast từ tệp"** (route → `/marketing/broadcasts?listId=...`), **"Tạo campaign mục tiêu"** (route → `/marketing/targets?listId=...`), **"Export CSV"** (download).

### Capability 4: Wire nút tạo Broadcast/Campaign từ ListsView (R3)
- Wire 2 nút trong `row-actions` của `ListsView.vue`:
  - `<v-icon>mdi-send</v-icon>` → router.push sang `/marketing/broadcasts` với query `listId=<id>`.
  - Nút mới `<v-icon>mdi-account-multiple-plus-outline</v-icon>` → router.push sang `/marketing/targets` với query `listId=<id>`.
- Cả 2 view đích (BroadcastsView, TargetsView) đọc `route.query.listId` để pre-fill form.

---

## Non-Goals

- **Không đụng EE private** — Trigger/Sequence/Block/Care Session/Lead Notify/Lead Pool **KHÔNG** nằm trong change này. Stub ở Community vẫn render `<span/>`.
- **Không làm A/B test, Preview, Reply tracking cho Broadcast** — đó là Sprint 2 (R4).
- **Không làm AI Suggest cho Khối nội dung** — đó là Sprint 2 (R5).
- **Không viết provider mới dạng khác OpenAI-compat** — nếu cần, mở change riêng. Change này mặc định `custom` dùng `generateWithOpenaiCompat`.
- **Không thay đổi schema Prisma** — không cần migration cho capability nào trong change này. (Provider dùng `app_settings` đã có; ListDetailView dùng query API đã có; Import dùng `customerListEntry` đã có.)
- **Không viết test e2e tự động** cho UI — chỉ manual verify trên bản Community. Unit test cho provider handler mới.

---

## Acceptance Summary

| # | Tiêu chí | Verify |
|---|---|---|
| A1 | Provider 'custom' xuất hiện trong `GET /api/v1/ai/providers` | curl + check JSON response |
| A2 | Set baseUrl+apiKey per-org → generate 1 câu reply_draft OK | curl + check response không lỗi |
| A3 | Import CSV từ UI → list mới có đúng số dòng | UI test manual |
| A4 | ListDetailView render 4 tabs với data thật | UI test manual |
| A5 | Click "Tạo broadcast từ list" → BroadcastsView mở với listId pre-fill | UI test manual |

Xem chi tiết trong `specs/`.

---

## Risk & Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Thêm provider 'custom' làm hỏng type check các file khác | Sửa đúng 2 chỗ (PROVIDER_IDS + config), chạy `npm run typecheck` | Revert 1 commit |
| `xlsx` package tăng bundle size ~200KB | Lazy import chỉ khi user click tab Import | Revert commit |
| Import file 100K dòng gây timeout UI | Parse + validate streaming; backend xử lý async (đã có sẵn pattern ở `list-import-service.ts`) | Disable nút nếu file > 10K dòng, cảnh báo user |
| ListDetailView render chậm với list 50K KH | Phân trang 50 dòng/trang; filter/sort server-side | Tăng limit lên 200, hoặc thêm virtualization |

---

## Dependencies

- Có sẵn: `ai-service.ts`, `provider-registry.ts`, `list-routes.ts`, `list-import-service.ts`, `use-customer-lists` composable, route `/marketing/lists/:id` (đã đăng ký).
- Cần thêm: package `xlsx` (nếu chưa có — check `package.json`).
- Không cần migration DB.