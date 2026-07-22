# Capability: Message Template create confirm button
## ADDED Requirements

### Requirement: Template Create Confirm

The system SHALL implement template create confirm as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Cung cấp nút xác nhận rõ ràng khi tạo mẫu tin nhắn mới.

## Background
- Trang `/settings/crm/message-templates` đã có `TemplateEditor.vue` với nút "Lưu thay đổi".
- Tuy nhiên khi mở dialog "Tạo mẫu mới" (`openCreateTemplate`), footer chỉ có nút "Đóng" — không có nút
  lưu riêng, dễ khiến user tưởng phải bấm vào trang chính.

## Scenarios

### S1 — Dialog tạo mẫu có 2 nút

**Given** user mở dialog "Tạo mẫu tin nhắn"
**When** dialog hiển thị
**Then** footer có 2 nút: "Hủy" (trái) và "Lưu & Đóng" (phải)
**And** nút "Lưu & Đóng" disable khi `name` hoặc `content` rỗng.

### S2 — Lưu thành công

**Given** user nhập `name = "Welcome"` và `content = "Xin chào {{name}}"`
**When** user bấm "Lưu & Đóng"
**Then** gọi `POST /api/v1/message-templates`
**And** toast "Đã tạo mẫu"
**And** dialog đóng, danh sách refresh có mẫu mới.

### S3 — Hủy không lưu

**Given** user đã nhập một số field nhưng chưa lưu
**When** user bấm "Hủy"
**Then** dialog đóng, không có request nào gửi đi
**And** không lưu draft vào localStorage.

## Acceptance

- [ ] Dialog tạo mẫu có 2 nút rõ ràng.
- [ ] Nút "Lưu & Đóng" chỉ enable khi hợp lệ.
- [ ] Test thủ công: tạo 1 mẫu → thấy trong danh sách.

## Out-of-scope

- Không thêm auto-save draft.
- Không đổi cấu trúc template content.
