-- 2026-07-22 fix-zalo-crm-mvp-gaps#6: track error message + per-recipient details
-- for sequence executor (was silently failing when content block missing or
-- friend not resolved).
ALTER TABLE "automation_execution_logs" ADD COLUMN     "details" JSONB,
ADD COLUMN     "error" TEXT;
