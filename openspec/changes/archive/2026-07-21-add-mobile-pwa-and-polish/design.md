# Design: Mobile PWA + UI Polish

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (Chrome/Safari)                                     │
│   ┌──────────────────────────────┐                          │
│   │ Service Worker (sw.js)       │  ← precaches shell       │
│   │   • fetch → cache or net     │                          │
│   │   • push → Notification API  │                          │
│   └──────────────────────────────┘                          │
│   ┌──────────────────────────────┐                          │
│   │ PushManager                  │                          │
│   │   subscription → POST /push/subscribe                   │
│   └──────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
              │ HTTPS push (VAPID)
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Fastify                                              │
│   • modules/push/push-service.ts    (web-push)              │
│   • modules/push/push-routes.ts     (POST /subscribe, /test) │
│   • prisma model PushSubscription    (per-user per-browser) │
│   • Hook from chat/message-handler.ts on inbound message    │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

1. **vite-plugin-pwa (generateSW mode)** — không cần viết SW thủ công.
   Workbox tự generate SW với precache manifest + runtime caching cho `/chat`.
2. **Push delivery scope = per-user not per-org** — mỗi user có nhiều browser, mỗi
   browser có 1 `PushSubscription`. Lưu theo `userId` để khi user login thiết bị
   mới vẫn nhận push trên thiết bị cũ.
3. **Offline send queue dùng IndexedDB** (không dùng localStorage vì quota nhỏ).
4. **Empty state SVG inline component** (`<EmptyState />`) — không dùng ảnh tĩnh
   để dễ theme + bundle size tối thiểu.
5. **Dark mode tận dụng biến có sẵn** trong `frontend/src/assets/styles/_theme.scss`
   — chỉ thay hard-coded color bằng `var(...)` trong 4 view mới.

## File Structure

### Created
- `frontend/src/sw.ts` — service worker (Workbox runtime caching + push handler)
- `frontend/src/components/common/EmptyState.vue` — reusable empty state
- `frontend/src/components/common/SkeletonList.vue` — shimmer skeleton list
- `frontend/src/composables/use-push-notifications.ts` — opt-in + subscribe flow
- `frontend/src/composables/use-online-status.ts` — wrap navigator.onLine + event
- `frontend/public/manifest.webmanifest` — PWA manifest
- `frontend/public/icons/icon-192.png` + `icon-512.png` + `maskable-512.png`
- `frontend/src/assets/illustrations/empty-{lists,broadcasts,targets,content-blocks,pipeline,journey}.svg`
- `backend/src/modules/push/push-service.ts` — web-push wrapper
- `backend/src/modules/push/push-routes.ts` — POST /subscribe, POST /test
- `backend/src/modules/push/push-cron.ts` — cleanup expired subscriptions daily

### Modified
- `frontend/vite.config.ts` — add VitePWA plugin
- `frontend/src/main.ts` — register service worker
- `frontend/src/views/ChatView.vue` — inject PushOptIn banner + offline banner
- `frontend/src/views/marketing/ListsView.vue` — empty state + skeleton + dark mode
- `frontend/src/views/marketing/BroadcastsView.vue` — empty state + skeleton
- `frontend/src/views/marketing/TargetsView.vue` — empty state
- `frontend/src/views/marketing/ContentBlocksView.vue` — empty state
- `frontend/src/views/marketing/PipelineKanbanView.vue` — empty state + dark mode
- `frontend/src/views/marketing/AiCampaignStudioView.vue` — dark mode
- `frontend/src/components/marketing/HeatmapWidget.vue` — dark mode
- `frontend/src/views/reports/JourneyFunnelView.vue` — empty state + dark mode
- `frontend/src/app.ts` — register push routes
- `backend/prisma/schema.prisma` — add `PushSubscription` model
- `backend/src/modules/chat/message-handler.ts` — fire push on inbound (no-socket clients)

### NOT touched
- Backend AI module (no change).
- Broadcast / Scoring / Lists business logic (no change).
- Auth flow (no change).

## Sequence: Push opt-in

```
User ──► ChatView mount
        │ detect PushManager supported
        │ show banner "Bật thông báo để nhận tin nhắn mới?"
        │
        ▼ User clicks "Bật"
        │
        ├─► Notification.requestPermission() → 'granted'
        ├─► pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
        ├─► POST /api/v1/push/subscribe { endpoint, keys: { p256dh, auth } }
        │     └─► DB: prisma.pushSubscription.create({ userId, ... })
        │
        ▼ Success → toast "Đã bật thông báo"
        │
        ▼ Later: inbound message + socket offline
        │   backend → web-push.sendNotification(subscription, payload)
        │   browser → Notification API → system tray
```

## Sequence: Offline /chat

```
User ──► open /chat while offline
        │
        ▼ Service Worker intercept fetch
        │ 1. navigation request → serve cached HTML (precached at install)
        │ 2. API /api/v1/conversations → cache miss → return { offline: true }
        │
        ▼ ChatView renders last-known list (from localStorage or IndexedDB)
        │ banner: "Đang offline — dữ liệu có thể cũ"
        │
        ▼ User sends message
        │ write to IndexedDB queue, show toast "Sẽ gửi khi có mạng"
        │
        ▼ Online → background-sync (if supported) or fallback retry on next mount
```

## Rollback

| Risk | Trigger | Action |
|------|---------|--------|
| SW caches old JS after deploy | Lighthouse fails PWA audit | bump `pwa.cacheName` version → invalidates old cache |
| Push fails silently (no VAPID key) | 401 from push service | log warning, banner stays opt-in-able |
| Empty states cause layout shift | Snapshot test fails | revert component import in each view |
