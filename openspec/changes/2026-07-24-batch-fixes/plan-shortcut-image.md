# Plan — Tích hợp ảnh Mẫu tin nhắn vào shortcut popup (Approach A)

> **Ngày:** 2026-07-24
> **Status:** DRAFT — chờ confirm trước khi code
> **Spec:** `openspec/changes/2026-07-24-batch-fixes/follow-up-shortcut-image.md`
> **Phụ thuộc:** Commit `7965806` (lưu ảnh) đã merge

---

## Mục tiêu

User gõ `/chiaEGV` trong chat → popup hiện → chọn template CÓ ẢNH → ảnh attach + text insert vào editor → user bấm Enter → gửi cả text + ảnh như Zalo draft.

## Phát hiện trong investigation

1. `MessageThread.vue` đang gọi `GET /automation/templates` → endpoint **không tồn tại** → popup shortcut **đã broken từ trước**.
2. `handleImageFiles` upload NGAY khi user paste → không có state pending → khó kết hợp với Approach A.
3. `RichTextEditor` đã có `applyRichPayload` để insert text + styles.

## Phạm vi

### Phase 1 — Client only (có thể stand-alone) ✅
- Fix endpoint sai
- Update type
- UI ảnh trong popup
- Inline preview ảnh (chỉ xem, không qua BE)

### Phase 2 — Client + BE (cần batch khác) ⏸
- State machine `pendingAttachments[]`
- Refactor `handleImageFiles` để hỗ trợ pending
- Modify BE endpoint `/conversations/:id/attachments` để gửi text + attachments
- Hookup vào `handleSend`

**Đề xuất**: Làm Phase 1 trong batch này (anh nói "làm hết"). Phase 2 đợi batch riêng vì cần refactor BE endpoint sâu.

---

## Phase 1 — Chi tiết

### Files thay đổi

| File | Thay đổi | Risk |
|------|----------|------|
| `frontend/src/components/chat/MessageThread.vue` | Sửa `loadTemplates` endpoint + update `TemplateItem` type | Thấp |
| `frontend/src/components/chat/quick-template-popup.vue` | Thêm `imageBase64` vào Template interface + UI thumbnail | Thấp |

### Step 1 — Fix endpoint (MessageThread.vue)

**Code change:**
```typescript
// Trước
const res = await api.get<{ templates: TemplateItem[] }>('/automation/templates');

// Sau
const res = await api.get<{ templates: TemplateItem[] }>('/message-templates');
```

### Step 2 — Update TemplateItem type

```typescript
interface TemplateItem {
  id: string;
  name: string;
  shortcut?: string | null;
  content: string;
  contentRich?: { text: string; styles?: ... } | null;
  imageBase64?: string | null;  // ← NEW
  category: string | null;
  isPersonal: boolean;
  tagIds?: string[];
}
```

### Step 3 — UI thumbnail trong popup (quick-template-popup.vue)

Trong `<qtp-item>`:
```vue
<button class="qtp-item" ...>
  <img v-if="tpl.imageBase64" :src="tpl.imageBase64" class="qtp-item-thumb" />
  <v-icon v-else :icon="tpl.isPersonal ? 'mdi-account' : 'mdi-account-group'" ... />
  ...
</button>
```

CSS:
```css
.qtp-item-thumb {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
```

### Step 4 — Preview ảnh trong popup

Trong popup preview section:
```vue
<div v-if="previewText" class="qtp-preview">
  <span class="qtp-preview-lbl">Xem trước:</span>
  <div class="qtp-preview-text">{{ previewText }}</div>
  <img v-if="previewImage" :src="previewImage" class="qtp-preview-img" />
</div>
```

### Step 5 — Inline preview ảnh dưới editor (Phase 1)

Khi user chọn template có ảnh → hiển thị thumbnail ảnh dưới editor (thay vì tự upload):

```vue
<div v-if="pendingTemplateImage" class="mt-preview-row">
  <img :src="pendingTemplateImage" class="mt-preview-thumb" />
  <button @click="pendingTemplateImage = null" class="mt-preview-remove">×</button>
</div>
```

Đây là **chỉ preview trực quan** — ảnh chưa được upload. Khi user bấm Enter → imageBase64 sẽ được gửi kèm theo text trong Phase 2 (`handleSend` cần update).

### Step 6 — `onTemplateSelect` update

```typescript
function onTemplateSelect(
  payload: { text: string; styles?: ... },
  templateId: string,
  imageBase64?: string | null,
) {
  // ... existing text insert logic ...
  
  // NEW: lưu imageBase64 để gửi kèm khi Enter
  if (imageBase64) {
    pendingTemplateImage.value = imageBase64;
  }
}
```

### Phase 1 limitation (ghi rõ trong toast)

Khi user bấm Enter với pending image:
- Phase 1: gửi text thường, **ảnh bị bỏ qua** (vì chưa có endpoint accept)
- Phase 2: gửi kèm ảnh

Hiển thị toast warning: "⚠️ Ảnh đính kèm chưa gửi được - sẽ hỗ trợ trong bản cập nhật sau"

### Verify

- Tạo template có ảnh qua Settings → Templates
- Mở chat → gõ `/` → popup hiện các mẫu → template có ảnh hiển thị thumbnail
- Chọn template có ảnh → text insert + thumbnail ảnh hiển thị dưới editor
- Bấm Enter → text gửi thành công, warning "ảnh chưa gửi được"
- Popup shortcut hiện có data (không rỗng như trước)

### Out of scope (Phase 2)

- BE endpoint chấp nhận text + attachments
- Auto-upload ảnh từ base64 lên server
- Refactor `handleImageFiles` sang pending
- Multiple ảnh cùng template
- Album ảnh

---

## Decision point

Anh OK Phase 1 (client only) trong batch này? Phase 2 sẽ là 1 batch riêng.
