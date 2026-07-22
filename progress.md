# progress.md — fix-zalo-crm-mvp-gaps

Nhat ky tien do, 1 entry moi capability hoan thanh. Moi entry phai kem output verify (gate G4).

---

## Capability #0 — Env pre-check + DB schema (2026-07-23 00:10)

- Commit: d661b39 (chore(mvp-gaps#0): apply missing tables)
- Files touched:
  - backend/prisma/migrations/20260723000000_mvp_gaps_extra_tables/migration.sql (CREATE, 123 dong)
  - findings.md, task_plan.md, progress.md
- Verify output:
  - docker exec zalo-crm-db psql -U crmuser -d zalocrm -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'": truoc=121, sau=125 (+4).
  - 4 bang moi: auto_reply_rules, automation_execution_logs, scheduled_template_sends, sequence_memberships.
- Acceptance scenarios pass: N/A (pre-check).

## Capability #1 — AI 9router connectivity (2026-07-23 01:50)

- Commit: b2fd3cd (feat(mvp-gaps#1): AI 9router connectivity)
- Files touched:
  - backend/src/modules/ai/ai-host-resolver.ts (moi)
  - backend/src/modules/ai/ai-routes.ts (resolveHost cho /test-connection)
  - backend/src/modules/ai/providers/custom.ts (tranh duplicate /v1)
  - backend/src/modules/ai/providers/list-models.ts (resolveHost cho custom models)
  - frontend/src/views/settings/AiAssistantPage.vue (docker banner, hasKey, model dropdown + refetch)
  - docker-compose.dev.yml (RUNNING_IN_DOCKER=1)
- Verify output:
  - npx tsc --noEmit (BE): 0 error
  - npx vue-tsc --noEmit (FE): 0 error
  - smoke resolveHost (RUNNING_IN_DOCKER=1): localhost -> host.docker.internal OK

## Capability #2 — Automation menu trong Reports (2026-07-23 02:00)

- Commit: 8b1fb7b (feat(mvp-gaps#2): add Automation menu link in Reports dropdown)
- Files touched:
  - frontend/src/layouts/DefaultLayout.vue (them menu item to="/automation")
- Verify output:
  - npx vue-tsc --noEmit: 0 error

## Capability #7 — Group scan scroll (2026-07-23 02:10)

- Commit: 9c75ee6 (fix(mvp-gaps#7): group scan member table now scrolls internally)
- Files touched:
  - frontend/src/views/GroupScanView.vue (v-data-table them fixed-header + height)
- Verify output:
  - npx vue-tsc --noEmit: 0 error

## Capability #9 — Template create confirm (2026-07-23 02:20)

- Commit: a02d0e5 (feat(mvp-gaps#9): template editor confirm button labeled 'L?u & ?óng')
- Files touched:
  - frontend/src/components/templates/TemplateEditor.vue (button label + onSaveAndClose)
- Verify output:
  - npx vue-tsc --noEmit: 0 error

## Capability #4 — Scoring rules editable (2026-07-23 02:35)

- Commit: ba13f35 (feat(mvp-gaps#4): scoring signal rules editable from UI)
- Files touched:
  - backend/src/modules/scoring/scoring-routes.ts (validate delta [-100,100], enabled boolean)
  - frontend/src/composables/use-scoring.ts (updateSignalRule return updated row)
  - frontend/src/views/ScoringSettingsView.vue (edit dialog + toggle button)
- Verify output:
  - npx tsc --noEmit (BE): 0 error
  - npx vue-tsc --noEmit (FE): 0 error

## Capability #5 — System sender config (2026-07-23 02:50)

- Commit: 611abbe (feat(mvp-gaps#5): dedicated System Sender config page + menu shortcut)
- Files touched:
  - frontend/src/views/settings/SystemSenderPage.vue (moi)
  - frontend/src/router/index.ts (route /settings/org/system-sender)
  - frontend/src/layouts/DefaultLayout.vue (top-nav shortcut)
- Verify output:
  - npx vue-tsc --noEmit: 0 error

## Capability #6 — Chat AI + Follow-up sequence (2026-07-23 03:20)

- Commit: 1deb55a (feat(mvp-gaps#6): sequence executor actually sends messages)
- Files touched:
  - backend/src/modules/sequences/sequence-executor.ts (resolve Friend + ContentBlock, call zaloOps.sendMessage, log result, RATE_LIMITED pause 5 min, jitter)
  - backend/prisma/schema.prisma (automation_execution_logs + error TEXT, details JSONB)
  - backend/prisma/migrations/20260723000001_automation_log_error_details/migration.sql (ALTER TABLE)
- Verify output:
  - npx tsc --noEmit (BE): 0 error
  - psql \d automation_execution_logs: 2 columns added (error TEXT, details JSONB)

## Capability #3 — Lead Pool FIFO (2026-07-23 03:40)

- Commit: 1e2566c (feat(mvp-gaps#3): Lead Pool claim button + friendly error mapping)
- Files touched:
  - frontend/src/components/lead-pool/LeadPoolTable.vue (them cot Hanh dong + btn Xin ngay)
  - frontend/src/views/marketing/LeadPoolView.vue (handle @claim, error mapping)
- Verify output:
  - npx vue-tsc --noEmit: 0 error
  - BE FIFO: getPooledLeads orderBy (pooledCount ASC, lastPooledAt ASC, createdAt ASC) trong $transaction da co san tu truoc, chi can UI goi.

## Capability #8 — Broadcast polish (2026-07-23 04:00)

- Commit: 6aaafd4 (feat(mvp-gaps#8): Broadcast status filter chips + better empty state)
- Files touched:
  - frontend/src/views/marketing/BroadcastsView.vue (filter pills + empty state)
- Verify output:
  - npx vue-tsc --noEmit: 0 error

---

## Tong ket (2026-07-23)

10 commits, 9 capabilities (0->1->2->7->9->4->5->6->3->8) hoan thanh. Chat AI (Capability #1) fix xong goc re (resolveHost + duplicate /v1) ? Chat/sentiment/summary se hoat dong voi 9router. Sequence executor (Capability #6) bay gio that su gui tin (truoc do chi log). Lead Pool (Capability #3) them UI claim. System Sender (Capability #5) co trang rieng de discovery. Scoring (Capability #4) editable tu UI. Broadcast (Capability #8) them filter.