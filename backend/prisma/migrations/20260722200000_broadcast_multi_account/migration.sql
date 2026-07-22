-- Migration: add multi-account broadcast fields to broadcast_jobs.
-- 2026-07-22: support chọn nhiều Zalo account gửi cùng 1 broadcast.
ALTER TABLE "broadcast_jobs"
  ADD COLUMN IF NOT EXISTS "zalo_account_ids" JSONB,
  ADD COLUMN IF NOT EXISTS "send_mode" TEXT;

CREATE INDEX IF NOT EXISTS "broadcast_jobs_org_status_idx"
  ON "broadcast_jobs" ("org_id", "status");