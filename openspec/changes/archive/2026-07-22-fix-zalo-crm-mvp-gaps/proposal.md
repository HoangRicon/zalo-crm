# Proposal: Sửa các lỗi và bổ sung các chức năng thiếu trong Zalo CRM (đợt MVP)

## Why

Người dùng đã thông báo 10 điểm đau thực tế trên UI/UX + AI tích hợp. Change này khắc phục tất cả để hệ thống usable trở lại.

## What Changes

## Bối cảnh

Người dùng phản hồi nhiều điểm đau trên UI/UX và tích hợp AI trong Zalo CRM (Community + Enterprise
edition), bao gồm:

1. AI không kết nối được mặc dù đã bật 9router — nghi vấn do môi trường Docker (`localhost` ↔ `host.docker.internal`).
2. Trang Quét nhóm không cuộn được xuống dưới.
3. Trang Automation đã có nhưng chưa có đường dẫn trong menu "Báo cáo".
4. Chưa có chức năng bắn data cho nhân viên tự nhận khách (Lead Pool FIFO).
5. Trang tạo mẫu tin nhắn thiếu nút xác nhận rõ ràng khi tạo mới.
6. Trang lead-score chỉ hiển thị rule read-only, không sửa được.
7. Chưa tìm được chức năng cấu hình acc làm tin nhắn hệ thống.
8. Trang chat: AI suggestion + luồng follow-up chưa hoạt động.
9. Trang broadcast: còn lỗi/thiếu tiện ích (ngoài phạm vi MVP này sẽ polish nhỏ).

Change này đề xuất một đợt thay đổi tập trung, có thể chia thành các task 2 giờ theo OpenSpec.

## Mục tiêu (Goals)

- Khôi phục kết nối AI custom provider (9router) từ trong container backend.
- Khôi phục khả năng cuộn trang Quét nhóm.
- Thêm liên kết "Tự động hóa" (`/automation`) vào dropdown Báo cáo (Reports) trên top nav.
- Triển khai Lead Pool FIFO: giao diện nhận lead + dashboard + cấu hình.
- Cho phép chỉnh sửa signal rules của Lead Scoring ngay trên trang Scoring Settings.
- Bổ sung chọn acc hệ thống vào trang Thông báo hệ thống (tích hợp tại chỗ, không tạo trang mới).
- Khôi phục luồng AI suggestion và follow-up sequence trong trang Chat.
- Cung cấp nút "Lưu & Đóng" rõ ràng cho form tạo mẫu tin nhắn.
- Polish nhỏ trang Broadcast (validate + trạng thái loading).

## Non-goals (phạm vi loại trừ)

- Không thay đổi luồng Authentication / RBAC.
- Không đụng vào các module Enterprise Edition ngoài các seam đã công bố.
- Không thay đổi cấu trúc dữ liệu Prisma của Lead Pool, Sequence, Trigger — chỉ thêm/sửa schema nếu
  thật sự cần (sẽ ghi rõ trong từng capability).
- Không tích hợp Lead Ads (Facebook/Zalo) trong đợt này (đã có spec khác).
- Không thiết kế lại UI tổng thể — chỉ áp Atlas v2 hiện hành.

## Capabilities (mỗi capability một file spec)

| # | Capability | Spec |
|---|------------|------|
| 1 | AI 9router connectivity | `specs/ai-9router-connectivity/spec.md` |
| 2 | Automation menu in Reports | `specs/automation-report-menu/spec.md` |
| 3 | Lead Pool FIFO + UI | `specs/lead-pool-fifo/spec.md` |
| 4 | Scoring rules editable | `specs/scoring-rules-edit/spec.md` |
| 5 | System sender account in Notifications | `specs/system-sender-config/spec.md` |
| 6 | Chat AI + follow-up flows | `specs/chat-ai-followup/spec.md` |
| 7 | Group scan page scroll | `specs/group-scan-scroll/spec.md` |
| 8 | Broadcast page polish | `specs/broadcast-polish/spec.md` |
| 9 | Message template create confirm | `specs/template-create-confirm/spec.md` |

## Phụ thuộc

- Backend: `app_settings`, `ai_configs`, `lead_pool_*`, `signal_rules`, `automation_execution_logs`
  đã có (nhưng migration chưa apply do schema.prisma UTF-8). Cần sửa encoding trước khi chạy
  `prisma migrate deploy`.
- Frontend: Vue 3 + Vuetify 3 + TypeScript; Vue Router; Pinia.
- Docker: file `docker-compose.dev.yml` đã mount volume hot-reload.

## Rủi ro & rollback

| Rủi ro | Giảm thiểu | Rollback |
|--------|-----------|----------|
| Đổi Base URL sang `host.docker.internal` có thể không hoạt động trên môi trường Linux host cũ | Cung cấn fallback env `AI_BASE_URL` trong docker-compose | Revert thay đổi `ai-service.ts` |
| Sửa encoding `schema.prisma` có thể mất comment tiếng Việt | Save file dưới BOM UTF-8 sau khi sửa | `git checkout -- backend/prisma/schema.prisma` |
| Lead Pool FIFO có thể tranh chấp khi nhiều user cùng bấm "Nhận" | Dùng transaction + `SELECT … FOR UPDATE SKIP LOCKED` | Tắt toggle "Enable Lead Pool" trong cấu hình |

## Liên kết

- Parent plan: `docs/plans/2026-07-22-automation-page-unified.md`,
  `docs/plans/2026-07-22-ai-fix-auto-chat-settings.md`.
- Tài liệu đang chạy: `docs/BROADCAST-TU-DONG-VA-ROADMAP.md`.
