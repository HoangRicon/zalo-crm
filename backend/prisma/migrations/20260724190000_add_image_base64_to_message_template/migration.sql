-- 2026-07-24 fix-batch#3: Thêm ảnh đính kèm cho Mẫu tin nhắn.
-- Lưu trực tiếp base64 (TEXT) vào DB — ảnh mẫu tin thường nhỏ (< 500KB), tránh phụ thuộc S3.
-- Validate size 1.4MB raw ở route layer (tương đương ~1MB decode).

ALTER TABLE "message_templates" ADD COLUMN "image_base64" TEXT;
