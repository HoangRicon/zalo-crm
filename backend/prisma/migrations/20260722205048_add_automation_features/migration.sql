-- 2026-07-22: Add automation features
-- - Auto Reply Rules (rule-based auto chat)
-- - Automation Execution Logs (for /reports/automation)
-- - Scheduled Template Sends (one-time schedule)
-- - Sequence Memberships (drip campaign enrollments)

CREATE TABLE IF NOT EXISTS "auto_reply_rules" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"        TEXT NOT NULL,
  "oa_account_id" TEXT,
  "name"          TEXT NOT NULL,
  "trigger_type"  TEXT NOT NULL,
  "trigger_value" TEXT NOT NULL,
  "action_type"   TEXT NOT NULL,
  "action_content" TEXT NOT NULL,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "enabled"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auto_reply_rules_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "auto_reply_rules_oa_account_id_fkey"
    FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "auto_reply_rules_org_id_enabled_idx"
  ON "auto_reply_rules"("org_id", "enabled");
CREATE INDEX IF NOT EXISTS "auto_reply_rules_oa_account_id_idx"
  ON "auto_reply_rules"("oa_account_id");

CREATE TABLE IF NOT EXISTS "automation_execution_logs" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"        TEXT NOT NULL,
  "oa_account_id" TEXT,
  "type"          TEXT NOT NULL,
  "job_id"        TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'running',
  "sent"          INTEGER NOT NULL DEFAULT 0,
  "failed"        INTEGER NOT NULL DEFAULT 0,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"  TIMESTAMP(3),
  CONSTRAINT "automation_execution_logs_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "automation_execution_logs_oa_account_id_fkey"
    FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "automation_execution_logs_org_id_started_at_idx"
  ON "automation_execution_logs"("org_id", "started_at");
CREATE INDEX IF NOT EXISTS "automation_execution_logs_type_idx"
  ON "automation_execution_logs"("type");

CREATE TABLE IF NOT EXISTS "scheduled_template_sends" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"         TEXT NOT NULL,
  "oa_account_id"  TEXT NOT NULL,
  "template_id"    TEXT NOT NULL,
  "contact_ids"    JSONB NOT NULL,
  "scheduled_at"   TIMESTAMP(3) NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "sent_at"        TIMESTAMP(3),
  "error_message"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_template_sends_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "scheduled_template_sends_oa_account_id_fkey"
    FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "scheduled_template_sends_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "scheduled_template_sends_org_id_status_scheduled_at_idx"
  ON "scheduled_template_sends"("org_id", "status", "scheduled_at");

CREATE TABLE IF NOT EXISTS "sequence_memberships" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"        TEXT NOT NULL,
  "sequence_id"   TEXT NOT NULL,
  "contact_id"    TEXT NOT NULL,
  "oa_account_id" TEXT NOT NULL,
  "current_step"  INTEGER NOT NULL DEFAULT 0,
  "next_step_at"  TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'active',
  "enrolled_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"  TIMESTAMP(3),
  CONSTRAINT "sequence_memberships_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "sequence_memberships_sequence_id_fkey"
    FOREIGN KEY ("sequence_id") REFERENCES "automation_sequences"("id") ON DELETE CASCADE,
  CONSTRAINT "sequence_memberships_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE,
  CONSTRAINT "sequence_memberships_oa_account_id_fkey"
    FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "sequence_memberships_sequence_id_contact_id_key"
  ON "sequence_memberships"("sequence_id", "contact_id");
CREATE INDEX IF NOT EXISTS "sequence_memberships_status_next_step_at_idx"
  ON "sequence_memberships"("status", "next_step_at");