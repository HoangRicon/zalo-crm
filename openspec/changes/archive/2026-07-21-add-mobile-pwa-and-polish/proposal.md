# Change: Add Mobile PWA + UI Polish

> **Sprint**: 7 — Mobile PWA & Polish
> **Date**: 2026-07-21
> **Owner**: ZCRM Core team

## Why

CRM users increasingly operate from mobile (sales đi gặp khách, owner check inbox ngoài giờ).
Hiện tại web app responsive nhưng không thể cài như app, không có push notification khi offline,
và một số view marketing thiếu empty state rõ ràng → gây khó hiểu cho user mới.

Cộng thêm: dark mode chưa áp dụng đồng bộ các view marketing mới (Heatmap, AI Campaign Studio,
Journey Funnel, Pipeline Kanban) — user có dark mode nhưng trải nghiệm không liền mạch.

## What Changes

1. **R12. Mobile PWA**: Thêm `vite-plugin-pwa` cho phép:
   - Install "Add to Home Screen" trên Chrome mobile (manifest.json + service worker).
   - Push notification khi có tin nhắn mới (qua service worker + backend POST /push/subscribe).
   - Offline cache cho /chat (route + last-known conversation list) — read-only.
2. **UI Polish**:
   - Empty states thân thiện (illustration SVG + 1 dòng mô tả + CTA) cho 6 view: Lists, Broadcasts, Targets, Content Blocks, Pipeline Kanban, Journey Funnel.
   - Loading skeletons (CSS shimmer) thay vì spinner cho 3 danh sách: Lists, Broadcasts, Inbox.
   - Dark mode áp dụng cho 4 view mới thêm ở Sprint 2-6.

## Non-Goals

- Không build native iOS/Android app (chỉ web PWA).
- Không làm full offline CRUD (chỉ read-only chat cache).
- Không touch backend AI / marketing logic (pure frontend).

## Acceptance Summary

| # | Feature | Verified by |
|---|---------|-------------|
| A1 | PWA manifest + icon (192, 512, maskable) | Lighthouse PWA audit ≥ 90 |
| A2 | Service worker register thành công | DevTools → Application → Service Workers |
| A3 | Push notification opt-in flow (banner + Settings toggle) | Manual: bật → nhận 1 noti test |
| A4 | Offline /chat mở được + hiện last-known list | DevTools → Network offline → /chat vẫn render |
| A5 | Empty state cho 6 view | Snapshot test |
| A6 | Loading skeleton cho 3 view | Visual |
| A7 | Dark mode cho 4 view mới | Visual + computed style |

## Risk & Rollback

- **Risk PWA**: SW caching có thể giữ file cũ sau deploy → fix bằng `skipWaiting + clientsClaim` + version bump trong `manifest`.
- **Risk Push**: Browser push cần HTTPS + VAPID key → fail silently nếu thiếu, sẽ log warning rõ.
- **Rollback**: feature flag `pwa.enabled` (default true), `polish.enabled` (default true). Disable trong runtime qua env vars.

## Dependencies

- New dep: `vite-plugin-pwa` (~50kb).
- Backend dep: thêm `web-push` package + 2 endpoint mới (`POST /api/v1/push/subscribe`, `POST /api/v1/push/test`).
- Schema: thêm `PushSubscription` model (orgId, userId, endpoint, p256dh, auth, createdAt) + `orgId,userId,type,ip,userAgent,before,after` cho AuditLog.

## Out of Scope

- i18n (đã yêu cầu bỏ qua — không thuộc Sprint 7).
