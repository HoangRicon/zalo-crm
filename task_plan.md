# Task Plan: AI Provider 'custom' + Khôi phục Marketing Lists

> **Change**: `add-custom-ai-provider-and-recover-marketing-lists`
> **Plan link**: [MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 0 + Sprint 1
> **OpenSpec artifacts**: [proposal.md](../../openspec/changes/add-custom-ai-provider-and-recover-marketing-lists/proposal.md) · [specs/](../../openspec/changes/add-custom-ai-provider-and-recover-marketing-lists/specs/) · [design.md](../../openspec/changes/add-custom-ai-provider-and-recover-marketing-lists/design.md) · [tasks.md](../../openspec/changes/add-custom-ai-provider-and-recover-marketing-lists/tasks.md)
> **Created**: 2026-07-21
> **Estimated**: 5.5 ngày (1 dev fulltime)

---

## Legend

- `[ ]` = chưa làm
- `[x]` = hoàn tất
- `[~]` = in-progress
- `[!]` = blocked / có concern

---

## Phase 1 — AI Provider 'custom' (Sprint 0) — 0.5 ngày

- [ ] **1.1** Thêm env vars `CUSTOM_BASE_URL` + `CUSTOM_AUTH_TOKEN` + `CUSTOM_DEFAULT_MODEL` vào `backend/src/config/index.ts`
  - Files: `M:backend/src/config/index.ts`
  - Verify: `cd backend && npx tsc --noEmit` exit 0
  - AC: REQ-CUSTOM-1 (chuẩn bị)
  - Risk: env var đụng các provider khác — KHÔNG (các provider khác có prefix riêng)

- [ ] **1.2** Thêm `'custom'` vào `PROVIDER_IDS` array + catalog entry trong `provider-registry.ts`
  - Files: `M:backend/src/modules/ai/provider-registry.ts`
  - Verify: `npx tsc --noEmit` pass
  - AC: REQ-CUSTOM-1

- [ ] **1.3** Tạo file `providers/custom.ts` — thin wrapper gọi `generateWithOpenaiCompat`
  - Files: `C:backend/src/modules/ai/providers/custom.ts`
  - Verify: `npx tsc --noEmit` pass
  - AC: REQ-CUSTOM-4

- [ ] **1.4** Wire `'custom'` vào `generateText()` trong `ai-service.ts`
  - Files: `M:backend/src/modules/ai/ai-service.ts`
  - Verify: curl `GET /api/v1/ai/providers` trả 6 entries
  - AC: REQ-CUSTOM-1, REQ-CUSTOM-4

- [ ] **1.5** Verify `list-models.ts` đã loop qua catalog (không cần sửa)
  - Files: `M:backend/src/modules/ai/providers/list-models.ts` (verify only)
  - Verify: curl `GET /api/v1/ai/providers/custom/models` trả 200
  - AC: REQ-CUSTOM-3

- [ ] **1.6** Unit test cho `custom.ts`
  - Files: `C:backend/src/modules/ai/providers/custom.test.ts`
  - Verify: `npx vitest run modules/ai/providers/custom.test.ts` all pass
  - AC: REQ-CUSTOM-4

---

## Phase 2 — Import CSV/Excel (Sprint 1, R1) — 2 ngày

- [ ] **2.1** Cài `xlsx` package nếu chưa có
  - Files: `M:frontend/package.json`
  - Verify: `npm ls xlsx` hiển thị version
  - AC: REQ-IMPORT-2 (chuẩn bị)

- [ ] **2.2** Bỏ `disabled` ở nút Import CSV trong `ListsView.vue`
  - Files: `M:frontend/src/views/marketing/ListsView.vue`
  - Verify: UI click không còn disabled
  - AC: REQ-IMPORT-1

- [ ] **2.3** Thêm tab "Import CSV" vào `CreateListModal.vue`
  - Files: `M:frontend/src/components/lists/CreateListModal.vue`
  - Verify: Modal có 2 tab, chuyển hoạt động
  - AC: REQ-IMPORT-2

- [ ] **2.4** Tạo composable `use-csv-parser.ts`
  - Files: `C:frontend/src/composables/use-csv-parser.ts`
  - Verify: Manual test paste 5 SĐT
  - AC: REQ-IMPORT-3, REQ-IMPORT-4

- [ ] **2.5** Parse CSV (paste + upload) trong `CreateListModal.vue`
  - Files: `M:frontend/src/components/lists/CreateListModal.vue`
  - Verify: Upload file 100 SĐT → preview đúng 10 dòng
  - AC: REQ-IMPORT-2, REQ-IMPORT-3

- [ ] **2.6** Render stats panel real-time trong `CreateListModal.vue`
  - Files: `M:frontend/src/components/lists/CreateListModal.vue`
  - Verify: Stats hiển thị đúng "Hợp lệ: 80"
  - AC: REQ-IMPORT-4

- [ ] **2.7** Confirm dialog + submit + handle success/error
  - Files: `M:frontend/src/components/lists/CreateListModal.vue`
  - Verify: Submit → navigate đến `/marketing/lists/<id>`
  - AC: REQ-IMPORT-5, REQ-IMPORT-6, REQ-IMPORT-7

- [ ] **2.8** Client-side file size guard (>5MB)
  - Files: `M:frontend/src/components/lists/CreateListModal.vue`
  - Verify: Upload 10MB → toast lỗi
  - AC: REQ-IMPORT-7 (edge case)

---

## Phase 3 — ListDetailView (Sprint 1, R2) — 2 ngày

- [ ] **3.1** Tạo skeleton `ListDetailView.vue` (4 tabs + breadcrumb + polling)
  - Files: `C:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: Navigate đến `/marketing/lists/<id>` → render skeleton
  - AC: REQ-DETAIL-1

- [ ] **3.2** Verify route đã đăng ký trong `router/index.ts`
  - Files: `M:frontend/src/router/index.ts` (verify only, thêm nếu thiếu)
  - Verify: Grep `marketing/lists/:id`
  - AC: REQ-DETAIL-1

- [ ] **3.3** Tab Tổng quan — stats + progress bar + mini donut
  - Files: `M:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: Tab render với data thật
  - AC: REQ-DETAIL-2

- [ ] **3.4** Tab Khách hàng — table + search/filter/sort/pagination
  - Files: `M:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: List 500 KH → render < 1s
  - AC: REQ-DETAIL-3

- [ ] **3.5** Tab Lịch sử
  - Files: `M:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: Archive → hiển thị event
  - AC: REQ-DETAIL-4

- [ ] **3.6** Tab Cài đặt — form edit + admin actions
  - Files: `M:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: Admin edit tên → save
  - AC: REQ-DETAIL-5

- [ ] **3.7** Action bar — Tạo broadcast + Tạo campaign + Export CSV
  - Files: `M:frontend/src/views/marketing/ListDetailView.vue`
  - Verify: Click nút → navigate đúng
  - AC: REQ-DETAIL-6, REQ-DETAIL-7

---

## Phase 4 — Wire nút từ ListsView (Sprint 1, R3) — 0.5 ngày

- [ ] **4.1** Wire nút "Tạo broadcast" trong `ListsView.vue` row-actions
  - Files: `M:frontend/src/views/marketing/ListsView.vue`
  - Verify: Click → navigate, không bubble
  - AC: REQ-WIRE-1

- [ ] **4.2** Thêm nút "Tạo campaign mục tiêu" trong `ListsView.vue` row-actions
  - Files: `M:frontend/src/views/marketing/ListsView.vue`
  - Verify: Click → navigate
  - AC: REQ-WIRE-2

- [ ] **4.3** `BroadcastsView.vue` đọc `route.query.listId` → pre-fill
  - Files: `M:frontend/src/views/marketing/BroadcastsView.vue`
  - Verify: Navigate từ ListsView → pre-fill xong
  - AC: REQ-WIRE-3, REQ-WIRE-5

- [ ] **4.4** `TargetsView.vue` đọc `route.query.listId` → pre-fill
  - Files: `M:frontend/src/views/marketing/TargetsView.vue`
  - Verify: Navigate từ ListsView → pre-fill xong
  - AC: REQ-WIRE-4, REQ-WIRE-5

---

## Verification (Gate G4) — 0.5 ngày

- [ ] **5.1** Backend typecheck: `cd backend && npx tsc --noEmit` exit 0
- [ ] **5.2** Backend unit test: `npx vitest run modules/ai/providers/custom.test.ts` all pass
- [ ] **5.3** Backend manual smoke test: 3 curl command cho AI providers
- [ ] **5.4** Frontend typecheck: `cd frontend && npx vue-tsc --noEmit` exit 0
- [ ] **5.5** Frontend manual UI test: 6 bước trên browser
- [ ] **5.6** Spec conformance review: 0 missing, 0 extra

---

## Total: 27 tasks / 4 phases / ~5.5 ngày

---

## Dependencies (đã verify)

| Task | Phụ thuộc |
|---|---|
| 1.1 | (none) |
| 1.2 | 1.1 |
| 1.3 | 1.1 |
| 1.4 | 1.2, 1.3 |
| 1.5 | 1.2 |
| 1.6 | 1.3 |
| 2.2 | (none) |
| 2.3 | 2.2 |
| 2.4 | (none) |
| 2.5 | 2.3, 2.4 |
| 2.6 | 2.5 |
| 2.7 | 2.5, 2.6 |
| 2.8 | 2.5 |
| 3.1 | (none — verify route in 3.2 first) |
| 3.2 | (none) |
| 3.3 | 3.1, 3.2 |
| 3.4 | 3.1, 3.2 |
| 3.5 | 3.1 |
| 3.6 | 3.1 |
| 3.7 | 3.1 |
| 4.1 | (none) |
| 4.2 | (none) |
| 4.3 | 4.1 (logical) |
| 4.4 | 4.2 (logical) |
| 5.x | tất cả tasks trên |

**Critical path**: 1.1 → 1.2 → 1.3 → 1.4 (Phase 1) → 2.1 → 2.5 → 2.7 (Phase 2 critical) → 3.2 → 3.1 → 3.7 (Phase 3) → 4.1, 4.2, 4.3, 4.4 (Phase 4) → 5.x (verify)