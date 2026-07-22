# Capability: Scoring Rules Editable UI
## ADDED Requirements

### Requirement: Scoring Rules Edit

The system SHALL implement scoring rules edit as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Cho phép chỉnh sửa signal rules của Lead Scoring ngay trong trang `/settings/crm/scoring` (frontend
`ScoringSettingsView.vue`), không cần gọi API trực tiếp.

## Background
- Backend đã có endpoint `PUT /api/v1/scoring/rules/:id` và `PATCH` tương đương.
- `ScoringSettingsView.vue` hiện đang hiển thị bảng rule ở chế độ read-only.
- Một số field (`code`, `conditions`) thuộc dạng JSON phức tạp — không sửa qua UI đơn giản.

## Scenarios

### S1 — Mở dialog sửa rule

**Given** user truy cập `/settings/crm/scoring`
**When** user bấm nút "Sửa" trên 1 hàng rule
**Then** dialog mở với form: Tên, Mô tả, Trọng số (slider -100 → 100), Trạng thái (switch)
**And** các field `code`, `conditions` chỉ hiển thị read-only.

### S2 — Lưu rule thành công

**Given** dialog sửa đang mở với `weight = 50`, `enabled = true`
**When** user bấm "Lưu"
**Then** gọi `PUT /api/v1/scoring/rules/:id`
**And** toast "Đã lưu"
**And** bảng refresh với giá trị mới.

### S3 — Validate input

**Given** user nhập `weight = 200` (ngoài khoảng)
**When** bấm "Lưu"
**Then** form hiển thị lỗi "Trọng số phải trong khoảng -100 đến 100"
**And** không gọi API.

### S4 — Toggle nhanh bật/tắt rule

**Given** user bấm nút "Tắt" trên 1 rule đang enabled
**When** xác nhận
**Then** gọi `PATCH /api/v1/scoring/rules/:id` với `{ enabled: false }`
**And** icon chuyển sang xám.

## Acceptance

- [ ] Bảng rule trong `ScoringSettingsView.vue` có cột "Hành động" với 2 nút: Sửa, Bật/Tắt.
- [ ] Validate client + server cùng ràng buộc.
- [ ] Có unit test cho composable `use-scoring.ts` (hàm `updateSignalRule`).

## Out-of-scope

- Sửa `code` (định danh rule) hoặc `conditions` JSON.
- Tạo rule mới (chỉ seed từ migration; tạo mới là phase sau).
- Xóa rule (chỉ soft-disable).
