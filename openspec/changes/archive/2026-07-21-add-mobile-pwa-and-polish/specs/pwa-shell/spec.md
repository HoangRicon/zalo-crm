# Spec: Mobile PWA + Push shell

## ADDED Requirements

### Requirement: PWA manifest + service worker
The system SHALL provide a Progressive Web App shell that allows users to install the CRM to their mobile home screen, with offline read access to the chat view and push notification support for new incoming messages.

#### Scenario: WHEN a user visits the site on Chrome Android
THEN the browser SHALL show the "Add to Home Screen" install prompt if the manifest is valid and a service worker is registered.

#### Scenario: WHEN a service worker activates
THEN it SHALL precache the `/chat` route shell + assets, and `clientsClaim` so users get the new SW immediately.

### Requirement: Push notification opt-in
The system SHALL allow users to opt in to browser push notifications through a banner in the chat view, and SHALL store a `PushSubscription` per user per browser.

#### Scenario: WHEN a user clicks "Bật thông báo" in the banner
THEN the app SHALL request `Notification.permission`, create a `PushSubscription`, and POST it to `/api/v1/push/subscribe` with `{ endpoint, keys: { p256dh, auth } }`.

#### Scenario: WHEN a new message arrives AND the user has an active `PushSubscription`
THEN the backend SHALL send a push to that endpoint with payload `{ title: "<senderName>", body: "<previewText>", icon: "/icons/icon-192.png" }`.

### Requirement: Offline chat cache
The system SHALL cache the last-known conversation list and the most recently opened message thread so users can read them while offline.

#### Scenario: WHEN the user opens `/chat` with no network
THEN the service worker SHALL serve the cached HTML shell and last-known conversation JSON, displaying an offline banner ("Bạn đang xem dữ liệu cũ — kết nối lại để cập nhật").

#### Scenario: WHEN the user attempts to send a message while offline
THEN the app SHALL queue the message in IndexedDB and show a toast "Đã lưu — sẽ gửi khi có mạng".
