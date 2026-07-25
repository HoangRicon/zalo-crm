-- 2026-07-26 fix: Thêm cột zalo_account_id vào broadcast_run_items để track
-- nick thực sự đã gửi (multi-acc round-robin).
-- Nullable: backward-compat với items cũ chỉ dùng job.zaloAccountId.

ALTER TABLE "broadcast_run_items"
  ADD COLUMN IF NOT EXISTS "zalo_account_id" TEXT;

CREATE INDEX IF NOT EXISTS "broadcast_run_items_zalo_account_id_idx"
  ON "broadcast_run_items" ("zalo_account_id");