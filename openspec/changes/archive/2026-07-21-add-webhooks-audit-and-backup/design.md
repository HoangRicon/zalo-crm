# Design: Webhooks + Audit + Backup

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Owner/Admin UI: Settings → Webhooks / Audit / Backup        │
└─────────────────────────────────────────────────────────────┘
              │ axios CRUD
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Fastify backend                                             │
│                                                              │
│  ┌────────────────────────┐  ┌─────────────────────────┐    │
│  │ webhooks module         │  │ audit module            │    │
│  │  • routes (CRUD)        │  │  • log-on-mutate hook   │    │
│  │  • dispatcher           │  │  • routes (filter+diff) │    │
│  │  • retry queue          │  └─────────────────────────┘    │
│  │  • deliveries table     │                                  │
│  └────────────────────────┘  ┌─────────────────────────┐    │
│                              │ backup module            │    │
│                              │  • export zip stream     │    │
│                              │  • restore + dry-run     │    │
│                              │  • BackupRecord table    │    │
│                              └─────────────────────────┘    │
│                                                              │
│  prisma schema: Webhook, WebhookDelivery, AuditLog,         │
│                 BackupRecord                                  │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

1. **Webhook signing: HMAC-SHA256** với secret per-webhook (hoặc global nếu không set).
   Header `X-Webhook-Signature: sha256=<hex>`. Receiver verify bằng recompute.
2. **Retry dùng cron tick** mỗi 30s, quét `WebhookDelivery` rows có `nextAttemptAt <= now()`.
   Không dùng external queue (Redis, BullMQ) cho đơn giản.
3. **Audit log "log-on-mutate"**: hook centralized trong `prisma-extension-audit.ts`
   wrap mọi `update`/`delete`/`create` trên entity whitelist (Contact, Conversation, BroadcastJob,
   AppSetting, Webhook, List). Lưu before/after JSON, không lưu secrets.
4. **Backup format: ZipArchive từ `archiver` package** (đã có trong node_modules).
   Schema-versioned để restore của v1 vẫn work khi schema v2 đã thêm field.
5. **Restore dry-run**: parse JSON mà KHÔNG ghi DB, return counts + conflicts.
   Confirmed restore chạy trong 1 Prisma transaction.

## File Structure

### Created
- `backend/src/modules/webhooks/webhook-service.ts` — sign + dispatch + retry
- `backend/src/modules/webhooks/webhook-routes.ts` — CRUD + deliveries log
- `backend/src/modules/webhooks/webhook-cron.ts` — retry queue scan mỗi 30s
- `backend/src/modules/audit/audit-service.ts` — log-on-mutate hook
- `backend/src/modules/audit/audit-routes.ts` — filter + diff read
- `backend/src/modules/backup/backup-service.ts` — export zip + restore
- `backend/src/modules/backup/backup-routes.ts` — export, dry-run, confirm, list
- `backend/src/shared/prisma-extension-audit.ts` — middleware auto-log
- `frontend/src/views/settings/WebhooksView.vue`
- `frontend/src/views/settings/AuditLogView.vue` (replace skeleton nếu có)
- `frontend/src/views/settings/BackupView.vue`
- `frontend/src/components/settings/WebhookForm.vue`
- `frontend/src/components/settings/WebhookDeliveryLog.vue`
- `frontend/src/components/settings/AuditDiffViewer.vue`
- `frontend/src/components/settings/BackupRestoreDialog.vue`

### Modified
- `backend/src/app.ts` — register webhook/audit/backup routes + cron
- `backend/prisma/schema.prisma` — add Webhook, WebhookDelivery, AuditLog, BackupRecord
- `backend/src/shared/database/prisma-client.ts` — apply audit extension
- `frontend/src/router/index.ts` — add /settings/webhooks, /settings/audit, /settings/backup
- `frontend/src/layouts/DefaultLayout.vue` — add menu items (owner only)

### NOT touched
- AI / Broadcast business logic
- Auth flow
- Public schema (giữ nguyên)

## Sequence: Webhook delivery + retry

```
Backend cron (every 30s)
  │ scan WebhookDelivery where nextAttemptAt <= now AND status='pending'
  │
  ├─► for each: POST <webhook.url> with X-Webhook-Signature
  │     ├─ 2xx → status=success, write to log
  │     └─ non-2xx
  │         ├─ attempt < 3 → bump attempts, nextAttemptAt = now + backoff[attempt]
  │         └─ attempt >= 3 → status=failed
  │
  ▼ Fire new event (e.g., Contact created)
    ├─► webhookService.dispatch("contact.created", payload)
    │   ├─► INSERT WebhookDelivery (status='pending', attempts=0, nextAttemptAt=now)
    │   └─► async fire POST
    └─► INSERT done, log visible in /webhooks/:id/deliveries
```

## Sequence: Backup restore with dry-run

```
Owner ──► POST /api/v1/backup/restore/dry-run (multipart .zip)
         │
         ▼ Parse zip → manifest.json + data/*.json
         │ validate schema version compat
         │ for each entity: count + check conflicts vs current DB
         │
         ▼ Return { counts, warnings, conflicts[] }
         │
Owner ──► review in UI → POST /api/v1/backup/restore { mode, payload }
         │
         ▼ BEGIN TRANSACTION
         │   for each entity: upsert/create
         │   on error: ROLLBACK → return 500 partial
         ▼ COMMIT → return 200
```

## Rollback

| Risk | Trigger | Action |
|------|---------|--------|
| Webhook retry flood | many deliveries stuck | Add rate-limit per webhook URL (10/min) |
| Audit table bloat | query slow | add `idx_audit_entity_createdAt`, partition in Phase 2 |
| Backup import corrupts org | invalid zip | strong validation + dry-run default |