# Spec: Chat Panel Drag Divider

## MODIFIED Requirements

### REQ-DRAG-001: Drag resize columns trong ChatView
User phải có thể kéo các divider giữa 4 cột (filter sidebar | conversation list | message thread | contact panel) để thay đổi width bằng:
- Mouse (desktop)
- Touch (mobile/tablet)
- Keyboard (Tab đến divider + arrow keys, Home/End, Enter reset)

Behavior:
- Real-time visual feedback khi đang kéo (highlight divider).
- Clamp min/max để không phá layout.
- Persist width vào `localStorage` (key `chat.columnWidths.v1`).
- ESC trong drag → revert về width trước khi kéo.
- Double-click divider → reset column về default.

## ADDED Requirements

### REQ-DRAG-NEW-001: Accessibility
Divider phải có:
- `role="separator"`
- `aria-orientation="vertical"`
- `aria-valuenow={currentWidth}`
- `aria-valuemin={200}`
- `aria-valuemax={700}`
- `aria-label` mô tả cột resize

Keyboard interaction khi divider focused:
- `←` / `→`: giảm / tăng ±10px
- `Shift+←` / `Shift+→`: ±50px
- `Home` / `End`: min / max
- `Enter` / `Space`: reset default
- `Escape`: revert nếu vừa drag

### REQ-DRAG-NEW-002: Touch support
Divider phải hoạt động trên touch device (mobile/tablet qua browser):
- Dùng `pointerdown` / `pointermove` / `pointerup` (chuẩn W3C).
- `setPointerCapture` để drag không bị mất khi ra khỏi divider.
- CSS `touch-action: none` để ngăn browser scroll ngang trong khi drag.

### REQ-DRAG-NEW-003: Visual feedback
- Default: cursor `col-resize`, divider `background: transparent`.
- Hover: `background: var(--smax-primary-soft)`.
- Đang kéo (`is-dragging`): `background: var(--smax-primary)`, width 6px (phình ra cho dễ thấy).
- Body cursor `col-resize` + `user-select: none` suốt lúc drag.

## REMOVED Requirements
Không có.

## Rationale
Xem `design.md` đầy đủ. Tóm tắt:
- **Reuse code cũ**: `onMouseMove` đã có logic resize đúng → chỉ enable + bổ sung pointer events + persist + a11y. Không viết lại.
- **Pointer events thay mouse events**: dùng `pointerdown` thay vì `mousedown` để handle mouse + touch thống nhất (touch mobile là use case quan trọng).
- **localStorage per-user**: widths cá nhân (mỗi user có preference riêng về cột rộng/hẹp). Nếu sau cần multi-device sync → migrate sang backend.
- **ESC revert + double-click reset**: pattern chuẩn cho resize widget, user expectation cao.
- **Clamp 200–700**: thử nghiệm với min 200 (sidebar chỉ hiển thị emoji icon + tooltip), max 700 (sidebar >700 chiếm chỗ thừa, conv >700 cản message thread).
