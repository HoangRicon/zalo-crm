# Tasks: Mobile PWA + UI Polish

> Estimated: 1.5–2 days (smaller than 5–7 in plan since reuse vite-plugin-pwa + existing CSS vars).

## Phase 1 — PWA foundation (priority HIGH)

- [ ] T1.1 Install `vite-plugin-pwa` in frontend dependencies
- [ ] T1.2 Add VitePWA plugin to `frontend/vite.config.ts` (registerType: 'autoUpdate', includeAssets, manifest, workbox runtimeCaching for /chat)
- [ ] T1.3 Create `frontend/public/manifest.webmanifest` (name, short_name, theme_color, icons 192/512/maskable)
- [ ] T1.4 Generate 3 icons (192×192, 512×512, 512×512 maskable) — simple ZCRM logo variant
  - file: `frontend/public/icons/icon-{192,512}.png`, `maskable-512.png`
- [ ] T1.5 Update `frontend/index.html` with `<link rel="manifest">`, `<meta name="theme-color">`, apple-touch-icon
- [ ] T1.6 Backend: add `web-push` package + generate VAPID keys (env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
- [ ] T1.7 Backend: create `push-service.ts` with `sendToUser(userId, payload)`, `subscribe()`, `unsubscribe()`
- [ ] T1.8 Backend: `prisma/schema.prisma` — add `PushSubscription` model
  - file: `backend/prisma/schema.prisma`
  - migration: `add_push_subscriptions`
- [ ] T1.9 Backend: `push-routes.ts` — POST /api/v1/push/subscribe (auth), POST /api/v1/push/unsubscribe, POST /api/v1/push/test (admin)
- [ ] T1.10 Frontend: `use-push-notifications.ts` composable — opt-in flow + service worker registration
- [ ] T1.11 Frontend: inject push banner into `ChatView.vue` (show once per session if supported + not yet subscribed)

**Verify**: lighthouse audit PWA ≥ 90, push opt-in flow works locally, manifest valid.

## Phase 2 — Offline cache

- [ ] T2.1 Add Workbox `registerRoute` for `/chat` (NetworkFirst with 3s timeout, cache fallback)
- [ ] T2.2 Add Workbox `registerRoute` for `/api/v1/conversations/sidebar` (StaleWhileRevalidate)
- [ ] T2.3 Frontend: `use-online-status.ts` composable (wraps navigator.onLine + 'online'/'offline' events)
- [ ] T2.4 Frontend: offline banner in `ChatView.vue` (shows when isOnline=false)
- [ ] T2.5 Frontend: IndexedDB queue for outbound messages (Phase 2 — out of scope per spec, add stub TODO)

**Verify**: devtools offline mode → /chat renders last-known data + banner shown.

## Phase 3 — UI Polish: empty states

- [ ] T3.1 Create reusable `frontend/src/components/common/EmptyState.vue` (props: icon-name, title, description, cta-label, cta-action)
- [ ] T3.2 Inline 6 SVG illustrations (lists, broadcasts, targets, content-blocks, pipeline, journey)
- [ ] T3.3 Wire `EmptyState` into 6 views:
  - `ListsView.vue`
  - `BroadcastsView.vue`
  - `TargetsView.vue`
  - `ContentBlocksView.vue`
  - `PipelineKanbanView.vue`
  - `JourneyFunnelView.vue`

**Verify**: snapshot test (vitest) — view renders `<empty-state>` when data is empty.

## Phase 4 — Loading skeletons

- [ ] T4.1 Create reusable `SkeletonList.vue` (props: count, height)
- [ ] T4.2 Wire into `ListsView.vue`, `BroadcastsView.vue`, `ChatView.vue` inbox column
- [ ] T4.3 CSS shimmer `@keyframes` in `_skeleton.scss` partial

**Verify**: visual no-layout-shift test.

## Phase 5 — Dark mode coverage for new views

- [ ] T5.1 Audit 4 new views for hard-coded colors → replace with `var(--bg-card)`, `var(--text-main)`, `var(--border-color)`
  - `HeatmapWidget.vue`
  - `AiCampaignStudioView.vue`
  - `JourneyFunnelView.vue`
  - `PipelineKanbanView.vue`
- [ ] T5.2 Update `EmptyState.vue` + `SkeletonList.vue` to use theme tokens
- [ ] T5.3 Visual check: toggle dark mode → no white flash

**Verify**: visual + Lighthouse dark-mode-audit.

## Phase 6 — Hook push delivery

- [ ] T6.1 Wire `message-handler.ts` → on inbound message + recipient has no active socket → call `pushService.sendToUser(userId, payload)`
- [ ] T6.2 Verify one subscription per (user, endpoint) — upsert on conflict

**Verify**: simulate socket disconnect → send Zalo message → browser shows notification.

## Phase 7 — Polish + commit

- [ ] T7.1 Run linter on changed files
- [ ] T7.2 Verify `vite build` succeeds (PWA generates sw.js + manifest)
- [ ] T7.3 `openspec archive add-mobile-pwa-and-polish`
- [ ] T7.4 Single commit `feat(pwa+polish): mobile PWA + UI polish — Sprint 7`
