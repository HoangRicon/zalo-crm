# Proposal: fix-2026-07-24-critical-lag-and-bugs

## Why

Audit toàn diện (ngày 2026-07-24) phát hiện 9 bug HIGH-severity đang làm hệ thống lag dần và phá vỡ các chức năng nghiệp vụ cốt lõi:

1. **Socket handlers accumulate trên trang Chat** — mỗi lần mount/unmount `ChatView`, các listener không được unregister → sau 10 lần navigate có 10× O(N) handler chạy cho mỗi sự kiện socket. Nguyên nhân chính gây **lag tăng dần** toàn hệ thống.
2. **Cache backend report không bao giờ HIT** — 8/8 endpoint dashboard/report có `setCached(cacheKey, result)` nhưng `result` không tồn tại → mỗi request đều re-query toàn bộ DB. Đây là nguyên nhân chính gây **lag dashboard**.
3. **`LeadPoolView.onClaimLead` mất `lead.id`** — user bấm "Nhận" trên dòng A nhưng backend nhận lead khác → nghiêm trọng về nghiệp vụ.
4. **`BroadcastBlacklistPage` toggle không persist** — bật/tắt blacklist bị mất khi reload trang.

Tổng cộng có ~25 MEDIUM và ~15 LOW bug liên quan nhưng đợt này tập trung vào 4 capability trên để sửa nhanh và tạo tác động lớn nhất.

## What Changes

| # | Capability | Spec file | Mức độ |
|---|------------|-----------|--------|
| 1 | Cleanup tất cả socket listener + timer ở chat (`use-chat.ts`, `use-chat-operations.ts`, `ChatView.vue`) | `specs/chat-socket-cleanup/spec.md` | HIGH |
| 2 | Sửa cache write + N+1 query ở backend report (`report-analytics-routes.ts`) | `specs/report-cache-fix/spec.md` | HIGH |
| 3 | Truyền `lead.id` cho `requestLead()` trong `LeadPoolView.vue` | `specs/lead-pool-claim/spec.md` | HIGH |
| 4 | Gọi API persist khi toggle blacklist trong `BroadcastBlacklistPage.vue` | `specs/broadcast-blacklist-persist/spec.md` | HIGH |

## Bối cảnh

Audit bằng 4 subagents song song đọc chi tiết 60+ file (toàn bộ src/views + composables + backend reports/ai). Sau đó tôi trực tiếp đọc xác minh các phát hiện HIGH-severity. Tất cả 9 bug HIGH đều đã được xác minh bằng cách đọc code thực tế tại dòng cụ thể (xem báo cáo audit).

## Mục tiêu (Goals)

- Trang Chat không còn leak socket handler / timer sau khi navigate đi/về nhiều lần.
- Backend report cache thực sự hoạt động (TTL 1 phút theo thiết kế).
- Lead Pool claim đúng lead user click.
- Toggle blacklist thực sự persist lên backend.

## Non-goals (phạm vi loại trừ)

- KHÔNG sửa các bug MEDIUM-LOW ở các trang: `SequencesView`, `ListDetailView`, `TagTaxonomyV2Page`, `MessageTemplatesPage`, `SystemNotificationsPage`, `DashboardView`, `JourneyFunnelView`. Sẽ để cho sprint tiếp theo.
- KHÔNG refactor kiến trúc (chuyển sang Pinia store, batch query N+1 sâu, v.v.) — chỉ sửa lỗi tối thiểu.
- KHÔNG thay đổi schema Prisma.
- KHÔNG thay đổi API endpoint (chỉ sửa implementation nội bộ).

## Phụ thuộc

- Frontend: Vue 3 + Vuetify 4 + Pinia + socket.io-client 4.8.
- Backend: Fastify + Prisma + TypeScript.
- Cache backend: in-memory Map trong `report-analytics-routes.ts` (đã có sẵn `getCached`/`setCached`).

## Rủi ro & rollback

| Rủi ro | Giảm thiểu | Rollback |
|--------|-----------|----------|
| Fix `setCached` có thể làm tăng memory nếu cache key không đa dạng đủ | Cache key đã có orgId+from+to (đủ đa dạng); TTL 1 phút | `git revert` |
| Cleanup socket handler có thể miss handler nào đó → mất tính năng | List đầy đủ 11 event names được document trong spec; test lại từng flow | `git revert` |
| Truyền `lead.id` cho `requestLead` có thể sai format backend expect | Đọc signature `requestLead()` trong `frontend/src/api/lead-pool.ts` trước khi sửa | `git revert` |
| Gọi API blacklist có thể fail nếu endpoint chưa tồn tại | Verify endpoint trong backend trước khi sửa; nếu thiếu thì tạo mới | `git revert` |

## Liên kết

- Báo cáo audit đầy đủ: (xem message chat trước — có line numbers cho từng bug).
- Spec anh em: `openspec/changes/archive/2026-07-22-fix-zalo-crm-mvp-gaps/` (cùng pattern OpenSpec).
