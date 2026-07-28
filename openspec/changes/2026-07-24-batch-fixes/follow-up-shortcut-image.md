# Follow-up — Tích hợp ảnh Mẫu tin nhắn vào shortcut popup trong chat

> **Ngày tạo:** 2026-07-24
> **Trạng thái:** DRAFT — chờ confirm approach

---

## Bối cảnh

Việc 3 đã làm: lưu ảnh vào MessageTemplate + hiển thị ở TemplateList/Preview. Còn thiếu:
- Khi user gõ shortcut `/chiaEGV` trong cửa sổ chat → popup mở → user chọn template CÓ ẢNH → ảnh phải attach vào editor để gửi kèm text.

## Bug phát hiện đồng thời

`MessageThread.vue` đang gọi `GET /automation/templates` nhưng endpoint này **không tồn tại** (đã grep `backend/src` → 0 file match). Kết quả: popup shortcut hiện tại **luôn rỗng** → đã broken từ trước khi em chạm vào.

→ Cần fix song song:
1. Đổi `MessageThread.vue` từ `/automation/templates` → đúng endpoint `/message-templates`
2. Update `TemplateItem` type ở `MessageThread.vue` để có `imageBase64: string | null`
3. Update `QuickTemplatePopup` để hiển thị thumbnail ảnh trong list + preview
4. Update `onTemplateSelect` để attach ảnh vào editor (chọn cách A hoặc B bên dưới)

## 2 approach — cần anh chọn

### Approach A: Attach + chờ user bấm Enter (khuyến nghị)
- User chọn template có ảnh → ảnh hiển thị trong editor preview (giống Zalo) + text được fill
- User có thể sửa text trước khi gửi
- User bấm Enter → gửi cả text + ảnh
- **Pros**: tự nhiên, khớp UX Zalo, cho phép sửa text
- **Cons**: cần sửa `handleImageFiles` hoặc refactor cách attach file vào editor

### Approach B: Auto-gửi ảnh + text khi chọn template
- User chọn template có ảnh → ngay lập tức gửi text + ảnh
- **Pros**: đơn giản, 1 click
- **Cons**: disruptive, user không sửa text được, khác UX Zalo

## Đề xuất: Approach A

Em recommend A vì:
- UX nhất quán với Zalo (draft ảnh + text)
- Khớp với cách `MessageThread.vue` đã handle khi user paste file (cho vào pending, đợi Enter)
- Ít phá vỡ flow hiện tại

## Out of scope (cần batch khác)
- Update BE `sendMessage` để nhận ảnh base64 + upload qua Zalo API (cần hookup với zca-js sendImage)
- Optimize UX (resize ảnh, crop)
- Track use count cho shortcut có ảnh

## Câu hỏi cần anh confirm

1. **Approach A hay B?**
2. Có cần em làm tiếp trong batch này không? Hay để follow-up riêng?
