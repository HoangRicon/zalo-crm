-- AlterTable
ALTER TABLE "ai_configs" ALTER COLUMN "ai_assistant_skip_noise_pattern" SET DEFAULT '^(ok|oke|okay|uhm|um|?|�|?|a|o|yes|no|y|n|\.|\.\.|\.\.\.)\s*$';

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "oa_account_id" TEXT,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_value" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_execution_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "oa_account_id" TEXT,
    "type" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "automation_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_template_sends" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "oa_account_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "contactIds" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_template_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_memberships" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "oa_account_id" TEXT NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_step_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sequence_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_reply_rules_org_id_enabled_idx" ON "auto_reply_rules"("org_id", "enabled");

-- CreateIndex
CREATE INDEX "auto_reply_rules_oa_account_id_idx" ON "auto_reply_rules"("oa_account_id");

-- CreateIndex
CREATE INDEX "automation_execution_logs_org_id_started_at_idx" ON "automation_execution_logs"("org_id", "started_at");

-- CreateIndex
CREATE INDEX "automation_execution_logs_type_idx" ON "automation_execution_logs"("type");

-- CreateIndex
CREATE INDEX "scheduled_template_sends_org_id_status_scheduled_at_idx" ON "scheduled_template_sends"("org_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "sequence_memberships_status_next_step_at_idx" ON "sequence_memberships"("status", "next_step_at");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_memberships_sequence_id_contact_id_key" ON "sequence_memberships"("sequence_id", "contact_id");

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_oa_account_id_fkey" FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_oa_account_id_fkey" FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_template_sends" ADD CONSTRAINT "scheduled_template_sends_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_template_sends" ADD CONSTRAINT "scheduled_template_sends_oa_account_id_fkey" FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_template_sends" ADD CONSTRAINT "scheduled_template_sends_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_memberships" ADD CONSTRAINT "sequence_memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_memberships" ADD CONSTRAINT "sequence_memberships_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "automation_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_memberships" ADD CONSTRAINT "sequence_memberships_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_memberships" ADD CONSTRAINT "sequence_memberships_oa_account_id_fkey" FOREIGN KEY ("oa_account_id") REFERENCES "zalo_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
