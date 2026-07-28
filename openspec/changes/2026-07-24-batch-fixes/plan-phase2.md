# Plan Phase 2 — Hookup gửi ảnh từ Mẫu tin nhắn vào chat

> **Ngày:** 2026-07-24
> **Phụ thuộc:** Phase 1 (`e93c064`), Việc 3 (`7965806`)

---

## Phát hiện quan trọng từ investigation

`/conversations/:id/attachments` ĐÃ HỖ TRỢ `caption` field (BE file `chat-attachment-routes.ts:109-114`). zalo API call `sendMessage({ msg: caption, attachments: paths }, threadId, threadType)` đã nhận cả text + attachments trong 1 message.

**Vấn đề còn lại**:
1. FE không sử dụng `caption` field — chỉ gửi files
2. BE lưu message ảnh với `content = JSON {href, thumb, size}` → TEXT BỊ MẤT (caption không được lưu vào DB)
3. `pendingTemplateImage` ở FE chỉ là base64 — chưa convert thành File để gửi

## Phạm vi Phase 2

### BE thay đổi (1 file)

**File**: `backend/src/modules/chat/chat-attachment-routes.ts`

**Thay đổi**:
- Lưu `caption` vào `metadata.caption` của từng `Message` được tạo (ảnh + video + file)
- Để `metadata` dạng `{ sender: {...}, caption: '...' }`

### FE thay đổi (2 files)

**File 1**: `frontend/src/components/chat/MessageThread.vue`

**Thay đổi**:
- Thêm helper `dataUrlToFile(dataUrl, filename)` — convert base64 data URL → File
- Update `handleSend`:
  - Nếu có `pendingTemplateImage.value`:
    - Convert base64 → File
    - POST multipart với `caption=textToSend` + `files=[file]` đến `/conversations/:id/attachments`
    - Không gọi `emit('send', text, ...)` (text đã gửi kèm attachment)
    - Refresh thread + clear state

**File 2**: `frontend/src/components/chat/message-bubble.vue` (hoặc tương đương)

**Thay đổi**:
- Hiển thị `metadata.caption` (nếu có) dưới ảnh như caption Zalo

### Out of scope

- Multiple ảnh trong 1 mẫu (chỉ 1 ảnh/mẫu)
- Album (Zalo có album riêng)
- Resize ảnh (giữ nguyên size base64)

### Verify

- Tạo mẫu có ảnh
- Mở chat → gõ `/` → chọn mẫu có ảnh → ảnh preview dưới editor
- Bấm Enter → gửi 1 tin nhắn có cả text + ảnh (caption đính kèm)
- Reload → tin nhắn hiển thị text + ảnh

### Risk

| Risk | Mitigation |
|------|-----------|
| BE thay đổi metadata → break tin nhắn cũ | Default `metadata.caption` undefined → render như cũ |
| Convert base64 → File lỗi memory | Validate size 1MB trước |
| Multipart FE gọi endpoint đang xử lý paste file | Tái sử dụng `handleImageFiles` flow |
| Mất text khi ảnh gửi lỗi | Toast error, KHÔNG clear inputText nếu fail |
