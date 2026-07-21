# Tasks: Webhooks + Audit + Backup/Restore

> Estimated: 5–6 days (split into 3 sub-features, each independent).

## Phase 1 — Outbound Webhooks (HIGH)

- [ ] T1.1 `prisma/schema.prisma` — add `Webhook`, `WebhookDelivery` models
  - migration: `add_webhooks`
- [ ] T1.2 `webhook-service.ts` — sign payload HMAC-SHA256, dispatch per event
- [ ] T1.3 `webhook-cron.ts` — retry queue scan every 30s
- [ ] T1.4 `webhook-routes.ts` — CRUD + POST /test + GET /deliveries
- [ ] T1.5 Hook dispatch từ 6 events:
  - `contact.created` (`contacts` module post-create)
  - `contact.updated` (prisma extension auto)
  - `deal.closed` (broadcast-report-run finish)
  - `lead.score_changed` (scoring service threshold crossing)
  - `churn.high_risk` (churn-cron khi score > 70)
  - `broadcast.run_completed` (broadcast-cron)
- [ ] T1.6 `app.ts` — register routes + start cron
- [ ] T1.7 `frontend/.../WebhooksView.vue` — list + create form + delivery log
- [ ] T1.8 `router/index.ts` — `/settings/webhooks` (owner only)
- [ ] T1.9 `DefaultLayout.vue` — Settings → Webhooks menu (owner only)
- [ ] T1.10 Unit test: `webhook-service.test.ts` — sign + retry edge cases

**Verify**: tạo webhook → trigger event → receiver call đúng với signature đúng → fail 1 lần → retry.

## Phase 2 — Audit Log Advanced (MEDIUM)

- [ ] T2.1 `prisma/schema.prisma` — add `AuditLog` model
  - migration: `add_audit_log`
- [ ] T2.2 `prisma-extension-audit.ts` — middleware auto-log update/delete trên 6 entity whitelist
- [ ] T2.3 Hook extension vào `prisma-client.ts`
- [ ] T2.4 `audit-routes.ts` — GET /api/v1/audit?actor=&action=&entity=&from=&to=
- [ ] T2.5 `audit-service.ts` — filter + cursor pagination
- [ ] T2.6 `frontend/.../AuditLogView.vue` — filter bar (actor, action, entity, date range)
- [ ] T2.7 `AuditDiffViewer.vue` — side-by-side JSON diff (dùng `vue-diff` hoặc manual)
- [ ] T2.8 `router/index.ts` — `/settings/audit` (owner only)
- [ ] T2.9 Backfill existing data (optional, off by default): one-shot script `backfill-audit.ts` chạy offline

**Verify**: đổi 1 contact status → audit có row before/after → filter UI hiển thị → click row → diff render.

## Phase 3 — Backup & Restore (LOW)

- [ ] T3.1 `prisma/schema.prisma` — add `BackupRecord` model
  - migration: `add_backup_records`
- [ ] T3.2 `backup-service.ts` — export zip stream + restore with transaction
- [ ] T3.3 `backup-routes.ts` — POST /export (download), POST /restore/dry-run, POST /restore/confirm, GET /list
- [ ] T3.4 Manifest schema versioning (`schemaVersion: 1`)
- [ ] T3.5 Dry-run: parse zip → count entities → return conflicts vs current org
- [ ] T3.6 Restore: transactional upsert/create per entity
- [ ] T3.7 `frontend/.../BackupView.vue` — list backup + restore dialog with dry-run preview
- [ ] T3.8 `BackupRestoreDialog.vue` — file picker + count preview + confirm
- [ ] T3.9 `router/index.ts` — `/settings/backup` (owner only)
- [ ] T3.10 Unit test: `backup-service.test.ts` — export roundtrip integrity, dry-run detection of conflicts

**Verify**: export 100 contacts → zip valid → re-import → contacts identical → dry-run returns same counts.

## Phase 4 — Polish + commit

- [ ] T4.1 Lint changed files
- [ ] T4.2 Verify `npx prisma validate`
- [ ] T4.3 Verify `vite build` succeeds (frontend bundle)
- [ ] T4.4 `openspec archive add-webhooks-audit-and-backup`
- [ ] T4.5 Commit `feat(infra): outbound webhooks + audit log + backup/restore — Sprint 8`
