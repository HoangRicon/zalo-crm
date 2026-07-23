# Design: Chat Panel Drag Divider

## 1. Vấn đề hiện tại

`ChatView.vue` có đầy đủ logic resize (`onMouseMove` tính dx, set `flexBasis` cho 2 cột liền kề), nhưng `startDrag(e, target)` chỉ gọi `e.preventDefault()` rồi return → user không thể kéo được.

Comment trong code: `// Draggable disabled - fixed layout`. Không rõ lý do disable (có thể dev trước để tránh regression, hoặc drag bị conflict với horizontal scrollbar conversation list).

## 2. Mục tiêu

Enable drag divider hoạt động **đúng + UX chuyên nghiệp**:

- Mouse + touch support
- Hover hiển thị cursor `col-resize`
- Visual feedback khi đang drag (divider highlight)
- Double-click divider → reset cột về default width
- Persist width vào `localStorage` (per-org, per-user nhưng test MVP chỉ per-user-key)
- ESC trong lúc drag → cancel + revert
- Constrain min/max width không phá layout

## 3. Layout hiện tại

```
┌──────────────────────────────────────────────────────────────────┐
│  .smax-chat-grid (display: flex; width: 100%; height: 100%)    │
│                                                                  │
│  ┌──────┬──┬────────┬──┬─────────┬──┬──────────┐                │
│  │filter│  │  conv  │  │  msg    │  │ contact  │                │
│  │sidebar│D1│  list  │D2│  thread │D3│  panel   │                │
│  │ 220px │  │ 290px  │  │  1fr    │  │  350px   │                │
│  └──────┴──┴────────┴──┴─────────┴──┴──────────┘                │
│                                                                  │
│  D1, D2, D3 = .smax-divider (width 4px, cursor col-resize)     │
└──────────────────────────────────────────────────────────────────┘
```

CSS các divider (existing):

```css
.smax-divider {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
}
.smax-divider:hover { background: var(--smax-primary-soft, #e3f2fd); }
```

## 4. Constant

```ts
const MIN_PX = 200;   // tối thiểu 200px mỗi cột
const MAX_PX = 700;   // tối đa 700px mỗi cột (sidebar max 700, conv max 700)
const DEFAULT_WIDTHS: Record<string, number> = {
  sidebar: 220,
  conv: 290,
  msg: 380,  // hint initial khi contact panel đóng
  contact: 350,
};
const STORAGE_KEY = 'chat.columnWidths.v1';

function loadWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_WIDTHS };
}
function saveWidths(w: Record<string, number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)); } catch {}
}
```

## 5. Drag flow

```ts
type DragTarget = 'sidebar' | 'conv' | 'thread';

const dragState = ref<{
  target: DragTarget;
  startX: number;
  startSidebar: number;
  startConv: number;
  startMsg: number;
  startContact: number;
  initialWidths: Record<string, number>;
} | null>(null);

function startDrag(e: PointerEvent, target: DragTarget) {
  e.preventDefault();
  e.stopPropagation();
  const widths = loadWidths();
  dragState.value = {
    target,
    startX: e.clientX,
    startSidebar: widths.sidebar,
    startConv: widths.conv,
    startMsg: widths.msg,
    startContact: widths.contact,
    initialWidths: { ...widths },
  };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onPointerMove(e: PointerEvent) {
  if (!dragState.value || !chatGridEl.value) return;
  const dx = e.clientX - dragState.value.startX;

  const widths = { ...dragState.value.initialWidths };
  if (dragState.value.target === 'sidebar') {
    widths.sidebar = clamp(widths.sidebar + dx, 180, 500);
  } else if (dragState.value.target === 'conv') {
    widths.conv = clamp(widths.conv + dx, 220, 600);
  } else {
    widths.msg = clamp(widths.msg + dx, 320, 800);
  }
  applyWidths(widths);
}

function endDrag(e: PointerEvent) {
  if (!dragState.value) return;
  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  // Save final widths
  const widths = captureCurrentWidths();
  saveWidths(widths);
  dragState.value = null;
}

function onKeydownWhileDrag(e: KeyboardEvent) {
  if (dragState.value && e.key === 'Escape') {
    applyWidths(dragState.value.initialWidths);
    dragState.value = null;
  }
}

function resetColumn(target: DragTarget) {
  const widths = { ...loadWidths() };
  if (target === 'sidebar') widths.sidebar = DEFAULT_WIDTHS.sidebar;
  else if (target === 'conv') widths.conv = DEFAULT_WIDTHS.conv;
  else if (target === 'thread') widths.msg = DEFAULT_WIDTHS.msg;
  applyWidths(widths);
  saveWidths(widths);
}

function applyWidths(w: Record<string, number>) {
  const sidebar = chatGridEl.value?.querySelector('.filter-sidebar') as HTMLElement | null;
  const convCol = chatGridEl.value?.querySelector('.smax-conv-col') as HTMLElement | null;
  const msgCol = chatGridEl.value?.querySelector('.smax-msg-col') as HTMLElement | null;
  const infoCol = chatGridEl.value?.querySelector('.smax-info-col') as HTMLElement | null;
  if (sidebar) sidebar.style.flexBasis = w.sidebar + 'px';
  if (convCol) convCol.style.flexBasis = w.conv + 'px';
  if (msgCol) {
    msgCol.style.flexBasis = w.msg + 'px';
    msgCol.style.flexGrow = '0'; // lock msg width when user drags msg↔contact or msg↔conv
  }
  if (infoCol) infoCol.style.flexBasis = w.contact + 'px';
}

function captureCurrentWidths(): Record<string, number> {
  const sidebar = chatGridEl.value?.querySelector('.filter-sidebar') as HTMLElement | null;
  const convCol = chatGridEl.value?.querySelector('.smax-conv-col') as HTMLElement | null;
  const msgCol = chatGridEl.value?.querySelector('.smax-msg-col') as HTMLElement | null;
  const infoCol = chatGridEl.value?.querySelector('.smax-info-col') as HTMLElement | null;
  return {
    sidebar: parseInt(getComputedStyle(sidebar).flexBasis) || DEFAULT_WIDTHS.sidebar,
    conv: parseInt(getComputedStyle(convCol).flexBasis) || DEFAULT_WIDTHS.conv,
    msg: parseInt(getComputedStyle(msgCol).flexBasis) || DEFAULT_WIDTHS.msg,
    contact: infoCol ? parseInt(getComputedStyle(infoCol).flexBasis) || DEFAULT_WIDTHS.contact : 0,
  };
}
```

## 6. Template changes

```vue
<!-- Replace @mousedown="startDrag($event, 'sidebar')" with @pointerdown -->
<div
  class="smax-divider"
  role="separator"
  aria-orientation="vertical"
  :aria-valuenow="currentSidebarWidth"
  :aria-label="targetLabel(target)"
  @pointerdown="startDrag($event, 'sidebar')"
  @dblclick="resetColumn('sidebar')"
></div>
```

- `role="separator"` + `aria-orientation="vertical"` cho a11y.
- `aria-valuenow` update realtime khi drag (keydown a11y).
- `aria-label` mô tả cột bên trái ("Filter sidebar — kéo để resize, double-click để reset").

## 7. CSS polish

```css
.smax-divider {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;
  /* Tăng hit-area 8px visual 4px để touch dễ bắt */
}
.smax-divider:hover { background: var(--smax-primary-soft, #e3f2fd); }
.smax-divider:active,
.smax-divider.is-dragging {
  background: var(--smax-primary, #2962ff);
  width: 6px; /* phình ra khi đang kéo */
}

/* Touch: hit-area mở rộng ~10px mỗi bên */
.smax-divider::before {
  content: '';
  position: absolute;
  inset: 0 -8px 0 -8px;
  cursor: col-resize;
}

/* Khi màn hình ≤ 1024px: ẩn filter sidebar + contact panel mặc định */
@media (max-width: 1024px) {
  .filter-sidebar { display: none; }
}
```

## 8. Lifecycle (giữ khi navigate)

- Widths persist qua route change (lưu localStorage).
- Khi mount ChatView lần đầu → apply widths từ localStorage (nếu có).
- Khi width vượt viewport (mở rồi thu nhỏ browser) → fallback về default (đo viewport, nếu sum > viewport * 0.95 → reset).

## 9. Touch / iOS support

- Dùng `pointerdown`/`pointermove`/`pointerup` (chuẩn W3C, support đủ touch + mouse + pen).
- `setPointerCapture` để drag không bị mất khi cursor rời khỏi divider.
- `touch-action: none` trên divider CSS để ngăn browser hijack gesture (scroll ngang).

## 10. Accessibility

- Divider có `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow={width}`, `aria-valuemin={200}`, `aria-valuemax={700}`.
- Keyboard: `Tab` đến divider → bấm `←` `→` resize ±10px, `Home`/`End` min/max, `Enter` reset default.
- Live region `aria-live="polite"` thông báo khi resize.

## 11. Backward compatibility

- Code hiện tại (`startDrag`, `onMouseMove`) chỉ thiếu event binding → KHÔNG phá logic cũ, chỉ enable + bổ sung UX.
- Existing `flexBasis` inline style sẽ được ghi đè nếu có localStorage widths → vẫn OK (CSS specificity inline > class).
- KHÔNG thay đổi `MIN_PX` cũ (60) thành giá trị mới (200) — vì nếu tăng có thể phá conv list rỗng khi sidebar thu nhỏ. Verify với conv empty state.

## 12. Test plan

| Test | Expected |
|------|----------|
| Mouse drag divider → release | 2 cột liền kề đổi width đúng, `msgCol.flexBasis` khớp |
| Double-click divider → reset | Width về default |
| Refresh page | Widths giữ nguyên (đọc localStorage) |
| Drag vượt MAX → release | Clamp về MAX, KHÔNG tràn viewport |
| Touch drag (mobile browser) | Drag mượt, không bị browser scroll ngang |
| ESC trong drag | Width revert về initial |
| Resize browser viewport | Widths persist trừ khi vượt viewport → reset |
| Keyboard Tab đến divider → Enter | Reset default |
| `role="separator"` + aria values | Đọc được bằng screen reader |
