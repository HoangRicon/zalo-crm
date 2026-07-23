# Spec: broadcast-blacklist-persist

## Purpose

`BroadcastBlacklistPage.vue:onChange` hiện chỉ mutate local state `acc.broadcastBlacklisted = val` mà không gọi API backend. Hậu quả: toggle blacklist bị mất khi reload trang → chức năng cốt lõi của trang này không hoạt động.

## Requirements

### REQ-1: `onChange` phải gọi API persist lên backend

#### Scenario

- **GIVEN** User ở trang `/settings/broadcast-blacklist`
- **AND** nick A hiện đang `broadcastBlacklisted = false`
- **WHEN** User bật toggle ở nick A
- **THEN** gọi `await api.patch('/zalo-accounts/<id>', { broadcastBlacklisted: true })`
- **AND** UI hiển thị trạng thái "ON" ngay (optimistic update)
- **AND** response 200/204 từ backend.

### REQ-2: Reload trang giữ nguyên trạng thái

#### Scenario

- **WHEN** User đã bật blacklist cho nick A (REQ-1)
- **THEN** reload trang (F5 hoặc navigate đi/về)
- **AND** trạng thái nick A phải vẫn "ON"
- **WHEN** User tắt blacklist cho nick A
- **THEN** reload trang
- **AND** trạng thái nick A phải là "OFF".

### REQ-3: Rollback nếu API fail

#### Scenario

- **WHEN** API `PATCH /zalo-accounts/<id>` trả về lỗi (4xx, 5xx, network)
- **THEN** revert `acc.broadcastBlacklisted` về giá trị trước đó
- **AND** hiển thị thông báo lỗi cho user (alert hoặc toast)
- **AND** UI không ở trạng thái không khớp với backend.

### REQ-4: Verify backend endpoint tồn tại

#### Scenario

- **WHEN** implementation bắt đầu
- **THEN** grep `backend/src/modules/zalo/` để xác nhận `PATCH /api/v1/zalo-accounts/:id` tồn tại
- **AND** field `broadcastBlacklisted` nằm trong schema Prisma (`zaloAccount.broadcastBlacklisted`)
- **IF** endpoint chưa tồn tại
- **THEN** tạo mới endpoint theo pattern của các update field khác (xem `nick-metrics-service.ts` hoặc tương đương).

### REQ-5: Optimistic update cho UX mượt

#### Scenario

- **WHEN** User click toggle
- **THEN** UI phải update ngay lập tức (trước khi API response)
- **AND** không có delay > 100ms
- **WHEN** API chậm (> 2s)
- **THEN** vẫn hiển thị trạng thái mới (optimistic)
- **AND** rollback chỉ xảy ra khi API fail thực sự.

## Constraints

- Không thay đổi schema Prisma.
- Không thay đổi UI layout hoặc style của toggle.
- Không thay đổi `BlacklistToggle` component (chỉ sửa logic ở parent page).
- Phải giữ nguyên fetch logic ở `onMounted(fetchAccounts)`.
