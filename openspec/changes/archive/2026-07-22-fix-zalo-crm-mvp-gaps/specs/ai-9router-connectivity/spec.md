# Capability: AI 9router Connectivity
## ADDED Requirements

### Requirement: AI 9router Connectivity

The system SHALL implement ai 9router connectivity as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Khôi phục khả năng kết nối từ backend (đang chạy trong Docker container) đến AI router (9router) đang
chạy trên máy host. Người dùng đã bật 9router ở cổng 20128 và lưu Base URL trong UI nhưng vẫn thấy
lỗi "không kết nối được".

## Background

- AI provider `custom` gọi OpenAI-compatible API trỏ đến `http://localhost:20128/v1`.
- Khi chạy trong Docker, `localhost` trỏ về chính container, không phải host → `ECONNREFUSED`.
- `host.docker.internal` là DNS do Docker cung cấp trỏ về host gateway.
- Một số trường hợp `baseUrl` đã chứa `/v1` nhưng code nối thêm `/v1/chat/completions` → trở thành
  `/v1/v1/chat/completions` → 404.

## Scenarios

### S1 — Lưu Base URL và test kết nối thành công

**Given** admin đang ở trang `/settings/crm/ai-assistant`, provider `custom` được bật
**And** Base URL = `http://host.docker.internal:20128/v1` và API key hợp lệ
**When** admin bấm "Test kết nối"
**Then** hệ thống gọi `GET <baseUrl>/models` (endpoint chuẩn OpenAI, đã xác nhận với người dùng)
**And** trả về `{ ok: true, models: ["gpt-4o-mini", ...] }`
**And** UI hiển thị "Kết nối thành công — N model khả dụng".

### S2 — Host resolver tự động khi gặp localhost trong container

**Given** container backend đang chạy
**And** `process.env.RUNNING_IN_DOCKER === '1'`
**When** provider `custom` resolve host cho Base URL chứa `localhost`
**Then** nó thay bằng `host.docker.internal` trước khi gọi HTTP
**And** không thay đổi Base URL đã lưu trong DB.

### S3 — Tránh duplicate `/v1` trong path

**Given** Base URL = `http://host.docker.internal:20128/v1`
**When** provider tạo URL cho `chat/completions`
**Then** kết quả là `http://host.docker.internal:20128/v1/chat/completions`
**And** không chứa `/v1/v1/`.

### S4 — Test kết nối thất bại có thông điệp rõ

**Given** Base URL trỏ đến host không tồn tại (`http://127.0.0.1:1`)
**When** admin bấm "Test kết nối"
**Then** UI hiển thị "Không kết nối được AI (ECONNREFUSED). Kiểm tra 9router đang chạy và Base URL đúng."
**And** không crash UI.

## Acceptance

- [ ] `backend/src/modules/ai/ai-host-resolver.ts` tồn tại và có unit test.
- [ ] `generateWithCustom` không tạo URL có `/v1/v1/`.
- [ ] Có log `ai.custom.resolved_url` in ra URL cuối cùng để debug.
- [ ] Nút "Test kết nối" ở `AiAssistantPage.vue` hoạt động.

## Out-of-scope

- Không tự động phát hiện cổng 9router; admin tự nhập.
- Không sửa các provider khác (anthropic, gemini, openai, qwen, kimi).
- Không thêm caching cho danh sách model.
