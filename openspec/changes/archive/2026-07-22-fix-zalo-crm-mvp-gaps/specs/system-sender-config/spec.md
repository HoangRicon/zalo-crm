# Capability: System Sender Account trong trang Thông báo hệ thống
## ADDED Requirements

### Requirement: System Sender Config

The system SHALL implement system sender config as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Bổ sung khả năng chọn tài khoản Zalo OA / cá nhân dùng để gửi thông báo hệ thống (campaign report,
broadcast error, broadcast done) ngay trong trang Thông báo hệ thống.

## Background
- Trang `/settings/crm/system-notifications` đã có UI cho toggle email/in-app + chọn người nhận.
- Chưa có UI chọn tài khoản gửi (mặc định lấy acc đầu tiên trong DB, dễ sai).
- Schema đã có trường `senderAccountId` (cần verify).

## Scenarios

### S1 — Hiển thị danh sách tài khoản khả dụng

**Given** admin truy cập `/settings/crm/system-notifications`
**When** trang load
**Then** thấy block "Tài khoản Zalo gửi thông báo hệ thống" ngay đầu trang
**And** dropdown liệt kê các tài khoản đang connected, kèm tên + số điện thoại (masked).

### S2 — Lưu lựa chọn

**Given** admin chọn "Zalo OA Bán hàng" trong dropdown
**When** admin bấm "Lưu"
**Then** gọi `PUT /api/v1/system-notifications/sender-account` body `{ accountId: "..." }`
**And** toast "Đã lưu"
**And** reload giữ nguyên lựa chọn.

### S3 — Không có tài khoản nào

**Given** org chưa kết nối tài khoản Zalo nào
**When** trang load
**Then** dropdown hiển thị "Chưa có tài khoản"
**And** nút "Lưu" bị disable
**And** có link "Kết nối tài khoản ngay" đi tới `/settings/channels`.

## Acceptance

- [ ] Block "Tài khoản Zalo gửi thông báo" hiển thị ở đầu trang `SystemNotificationsPage.vue`.
- [ ] API mới `PUT /api/v1/system-notifications/sender-account` hoạt động.
- [ ] Có unit test cho API.

## Out-of-scope

- Không tạo trang riêng.
- Không thêm OAuth flow cho tài khoản mới.
- Không cho phép nhiều tài khoản gửi cùng lúc.
