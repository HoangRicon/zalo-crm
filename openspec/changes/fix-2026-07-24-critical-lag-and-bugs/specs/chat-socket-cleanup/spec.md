# Spec: chat-socket-cleanup

## Purpose

Trang Chat (`ChatView.vue`, `use-chat.ts`, `use-chat-operations.ts`) hiện đăng ký nhiều socket handler nhưng cleanup function không unregister các handler đó. Hậu quả: mỗi lần user navigate đi/về giữa các trang, handler mới xếp chồng lên handler cũ → sau 5-10 lần mount, một sự kiện socket chạy 5-10× O(N) → lag tăng dần toàn hệ thống.

## Requirements

### REQ-1: `use-chat.ts destroySocket()` phải unregister tất cả socket handler

Khi component unmount hoặc socket bị destroy, function `destroySocket()` phải gọi `socket.off(eventName)` cho tất cả 11 event đã đăng ký trong `initSocket()`:

- `chat:message`
- `chat:deleted`
- `chat:message-edited`
- `chat:reactions`
- `chat:pinned`
- `chat:unpinned`
- `chat:group-info-updated`
- `zalo:access-changed`
- `zalo:typing`
- `zalo:message-status`
- `friend:updated`

### REQ-2: `destroySocket()` phải clear tất cả pending timers

Các timer sau phải được `clearTimeout` trước khi set `socket = null`:

- Tất cả timer trong Map `typingTimers` (line 322)
- `offlineGraceTimer` (line 356)
- `convSyncTimer` (line 344)

### REQ-3: `use-chat-operations.ts` phải export `unregisterSocketListeners`

Composable `useChatOperations` hiện đăng ký handler `chat:typing` và `chat:message-edited` qua `registerSocketListeners(socket)` nhưng không có function tương ứng để unregister.

#### Scenario

- **WHEN** `ChatView.vue` unmount (route rời `/chat`)
- **AND** trước đó `registerSocketListeners(getSocket())` đã được gọi trong `onMounted`
- **THEN** `ChatView.vue` phải gọi `unregisterSocketListeners(getSocket())` trong `onUnmounted`
- **AND** số lượng handler `chat:typing` trên socket instance phải trở về 0.

### REQ-4: `ChatView.vue` phải unregister handler `friend:updated`

Handler `friend:updated` được đăng ký inline trong `onMounted` của `ChatView.vue:798`. Hiện không có cleanup tương ứng.

#### Scenario

- **WHEN** `ChatView.vue` mount lần đầu
- **THEN** handler `friend:updated` được đăng ký trên socket instance
- **WHEN** `ChatView.vue` unmount
- **THEN** cùng handler đó phải được `socket.off('friend:updated', handlerRef)` trước khi `destroySocket()` được gọi

### REQ-5: Verify không có handler accumulation

#### Scenario

- **GIVEN** User ở trang `/chat`
- **WHEN** User navigate `/chat` → `/dashboard` → `/chat` → `/dashboard` → `/chat` (5 lần mount/unmount)
- **THEN** `socket.listeners('chat:message').length` phải bằng 1 (không phải 5)
- **AND** `socket.listeners('chat:typing').length` phải bằng 1
- **AND** `socket.listeners('friend:updated').length` phải bằng 1
- **AND** Browser DevTools "Performance" không có dấu hiệu memory leak sau 10 lần navigate.

### REQ-6: Không phá vỡ tính năng hiện có

#### Scenario

- **WHEN** User ở `/chat` và nhận tin nhắn mới
- **THEN** Tin nhắn phải hiển thị trong thread bình thường (handler `chat:message` vẫn hoạt động)
- **WHEN** User mở 1 conversation
- **THEN** typing indicator phải hoạt động khi người khác đang gõ (handler `zalo:typing` vẫn hoạt động)
- **WHEN** Lead chuyển status
- **THEN** badge trên conversation list phải update (handler `friend:updated` vẫn hoạt động)

## Constraints

- Không thay đổi API event name hoặc payload structure.
- Không thay đổi logic nghiệp vụ bên trong các handler.
- Phải tương thích với cả socket singleton (`use-friend-socket.ts`) — không được gọi `off` trên event mà singleton khác cũng đăng ký nếu singleton chưa cleanup trước.
