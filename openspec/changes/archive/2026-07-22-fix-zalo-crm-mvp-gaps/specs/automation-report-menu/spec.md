# Capability: Automation menu in Reports
## ADDED Requirements

### Requirement: Automation Report Menu

The system SHALL implement automation report menu as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Thêm liên kết "Tự động hóa" tới trang `/automation` vào dropdown "Báo cáo" trên top nav, áp dụng cho
cả Community Edition và Enterprise Edition.

## Background
- `frontend/src/views/automation/AutomationHubView.vue` đã có, mount ở route `/automation`.
- Hiện tại dropdown Báo cáo trong `DefaultLayout.vue` chỉ hiển thị mục Automation nếu `isExtension`
  (EE). Người dùng không thấy nút trong Community.

## Scenarios

### S1 — Thấy mục Tự động hóa trong Báo cáo

**Given** user đã đăng nhập và có quyền `automation:read`
**When** user bấm vào dropdown "Báo cáo" trên top nav
**Then** thấy mục "Tự động hóa" với icon `mdi-robot-outline`
**And** click mở route `/automation`.

### S2 — Không phụ thuộc Enterprise

**Given** user đang dùng Community Edition (`isExtension === false`)
**When** mở dropdown Báo cáo
**Then** vẫn thấy mục "Tự động hóa".

## Acceptance

- [ ] `DefaultLayout.vue` thêm 1 `v-list-item` trỏ tới `/automation`, không điều kiện `isExtension`.
- [ ] Highlight đúng khi đang ở `/automation`.

## Out-of-scope

- Không thêm top-nav riêng cho Automation.
- Không đổi tên trang.
- Không phân quyền mới (dùng `automation:read` đã có).
