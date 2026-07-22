# Capability: Chat AI suggestion + Follow-up sequence
## ADDED Requirements

### Requirement: Chat AI Follow-up

The system SHALL implement chat ai follow-up as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Khôi phục hai tính năng trong trang Chat:
1. Nút "Gợi ý AI" trả về 3 phản hồi mẫu dựa trên lịch sử hội thoại.
2. Sequence (luồng follow-up tự động) chạy đúng theo cron.

## Background
- `frontend/src/views/ChatView.vue` có nút "Gợi ý AI" nhưng gọi API bị lỗi do AI provider chưa kết nối
  (xem capability AI 9router Connectivity).
- Worker sequence (`sequence-executor.ts`) có thể chưa được đăng ký khi backend boot, dẫn tới step
  không chuyển trạng thái.

## Scenarios

### S1 — Gợi ý AI trả 3 suggestion

**Given** user mở conversation với khách hàng có 5 tin nhắn
**And** AI provider `custom` đã kết nối thành công
**When** user bấm "Gợi ý AI"
**Then** backend gọi `POST /api/v1/ai/suggest` với `conversationId`
**And** trả `{ suggestions: ["...", "...", "..."] }`
**And** UI render 3 chip có thể click để chèn vào textarea.

### S2 — Lỗi AI được hiển thị rõ

**Given** AI provider đang lỗi
**When** user bấm "Gợi ý AI"
**Then** UI hiển thị `v-alert` đỏ: "Không kết nối được AI. Kiểm tra cấu hình tại [link]"
**And** không crash.

### S3 — Sequence step chuyển trạng thái

**Given** sequence `welcome-day1` có 1 step "Sau 1 ngày gửi tin nhắn X"
**And** contact A vào sequence ngày D
**When** worker cron chạy lúc D+1
**Then** step chuyển sang `completed`
**And** `nextRunAt` của step tiếp theo (nếu có) được set = D+2.

### S4 — Sequence không chạy khi cron thiếu

**Given** worker sequence chưa được register trong `app.ts`
**When** restart backend
**Then** log cảnh báo `sequence_worker.disabled` xuất hiện
**And** UI tab "Sequences" hiển thị banner "Sequence worker chưa bật — liên hệ admin".

## Acceptance

- [ ] Nút "Gợi ý AI" hoạt động khi AI provider OK.
- [ ] Sequence executor được register trong `app.ts`.
- [ ] UI có banner cảnh báo khi worker tắt.

## Out-of-scope

- Không thêm AI summarization, sentiment analysis cho conversation.
- Không cho phép tạo sequence mới trong chat (đã có trang Automation).
- Không đổi cấu trúc bảng `sequence_memberships`.
