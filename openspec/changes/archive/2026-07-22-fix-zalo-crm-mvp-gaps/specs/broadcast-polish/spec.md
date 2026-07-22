# Capability: Broadcast page polish
## ADDED Requirements

### Requirement: Broadcast Polish

The system SHALL implement broadcast polish as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Cải thiện UX trang Broadcast: validate rõ ràng, loading state, empty state.

## Background
- Trang `/marketing/broadcast` đã hoạt động nhưng thiếu feedback khi submit thiếu trường hoặc khi list rỗng.
- Người dùng phản hồi "trang broadcast bị lỗi" — chủ yếu là UX, không phải bug logic.

## Scenarios

### S1 — Validate thiếu template

**Given** user mở form tạo broadcast, chưa chọn template
**When** user bấm "Gửi"
**Then** hiển thị `v-alert` đỏ "Vui lòng chọn mẫu tin nhắn"
**And** có link "Tạo mẫu ngay" mở `/settings/crm/message-templates`.

### S2 — Loading khi submit

**Given** form broadcast hợp lệ
**When** user bấm "Gửi"
**Then** button chuyển sang `loading` và disable
**And** hiển thị overlay mờ toàn trang.

### S3 — Empty state

**Given** org chưa có broadcast nào
**When** user vào `/marketing/broadcast`
**Then** hiển thị illustration + text "Chưa có broadcast nào. Tạo chiến dịch đầu tiên của bạn"
**And** nút CTA "Tạo broadcast".

## Acceptance

- [ ] Có `v-alert` validate cho từng trường bắt buộc.
- [ ] Loading state khi submit.
- [ ] Empty state khi list rỗng.

## Out-of-scope

- Không đổi luồng backend.
- Không thêm analytics (đã có spec `send-heatmap`).
