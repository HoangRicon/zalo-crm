# Design: Broadcast Preview + A/B + Reply Tracking + Heatmap

> Parent: [proposal.md](../proposal.md)

---

## Schema Migration

**1 file**: `backend/prisma/migrations/<timestamp>_broadcast_ab_tracking/migration.sql`

```sql
-- 1. A/B mode
ALTER TABLE broadcast_jobs
  ADD COLUMN ab_mode VARCHAR(16) NULL,         -- 'off' | 'ab_split'
  ADD COLUMN ab_variant_count SMALLINT NULL,    -- 2 | 3
  ADD COLUMN variant_message_texts JSONB NULL;  -- array<string> cho variants B, C

-- 2. Reply tracking + A/B group
ALTER TABLE broadcast_run_items
  ADD COLUMN reply_message_id TEXT NULL,
  ADD COLUMN replied_at TIMESTAMPTZ NULL,
  ADD COLUMN ab_group_id VARCHAR(2) NULL;       -- 'A' | 'B' | 'C' | null

CREATE INDEX idx_bri_replied ON broadcast_run_items(run_id, replied_at)
  WHERE replied_at IS NOT NULL;

CREATE INDEX idx_bri_ab_group ON broadcast_run_items(run_id, ab_group_id);

-- 3. Nick blacklist
ALTER TABLE zalo_accounts
  ADD COLUMN broadcast_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN broadcast_blacklist_reason TEXT NULL;
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Vue 3)                                         │
│  BroadcastsView.vue:                                     │
│    + PreviewModal.vue (NEW)        ← Capability 1       │
│    + ABVariantsEditor.vue (NEW)    ← Capability 1       │
│    + HeatmapWidget.vue (NEW)       ← Capability 3       │
│    + RunReportCard.vue             (MODIFY — add %reply)│
│                                                         │
│  SettingsZaloAccountsView.vue:                          │
│    + BlacklistToggle.vue (NEW)     ← Capability 4       │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│ Backend (Fastify)                                        │
│  broadcast-routes.ts (MODIFY):                          │
│    POST /broadcast/jobs     ← AB fields accepted        │
│    POST /broadcast/jobs/preview (NEW) ← Capability 1    │
│    GET  /broadcast/runs/:id/report (MODIFY) ← %reply    │
│    GET  /broadcast/heatmap (NEW)        ← Capability 3   │
│                                                         │
│  zalo-account-routes.ts (MODIFY):                       │
│    PUT /zalo-accounts/:id    ← blacklist fields          │
│                                                         │
│  broadcast-cron.ts (MODIFY):                            │
│    skip job nếu zaloAccountId bị blacklist              │
│                                                         │
│  message-handler.ts (NEW HOOK):                          │
│    on inbound message → check broadcast_run_items       │
│    chưa có reply trong 7 ngày → set repliedAt           │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: A/B variant lưu JSON array (không tạo bảng mới)
**Context**: 2-3 variants per job — không cần schema riêng.

**Decision**: Lưu variant B, C vào `variantMessageTexts` (JSONB array). Variant A = `messageText` (existing).

**Rationale**: 
- Đơn giản, 0 JOIN thêm.
- Variants ngắn (≤500 chars) nên JSON OK.
- Nếu sau này cần thêm `imageUrl`/contentBlocks riêng cho từng variant → mở issue riêng.

### D2: Reply window = 7 ngày
**Context**: Reply có thể đến sau nhiều ngày; window càng dài càng nhiều false positive.

**Decision**: Window = 7 ngày (configurable sau).

**Rationale**: Tuần đầu là window cao nhất cho reply. Sau 7 ngày, correlation < 30% (rule-of-thumb industry).

### D3: Heatmap aggregation cron-batch
**Context**: 168 cells × N runs × orgId → full-table scan đắt.

**Decision**: Aggregation chạy **on-demand** khi GET /heatmap được gọi, kết quả cache 60 phút in-memory. Không có cron precompute.

**Rationale**: Đơn giản, ít orgs (hàng trăm). Nếu scale lên → migrate sang materialized view.

### D4: Nick blacklist cờ đơn giản, không cần history
**Context**: Admin toggle ON/OFF + reason.

**Decision**: 2 cột boolean + reason. Không log history thay đổi (dùng activity_log đã có).

### D5: Skip-on-blacklist (không reject job)
**Context**: Admin có thể blacklist nick khi job đã queued.

**Decision**: Cron skip job nếu nick blacklist, KHÔNG fail job — chỉ log + emit toast. Admin có thể re-enable nick và job tự chạy tick sau.

---

## Sequence: A/B Submit

```
User (FE)               Fastify               DB                   Cron
   │                      │                   │                      │
   │ POST /jobs (abMode)  │                   │                      │
   ├─────────────────────►│                   │                      │
   │                      │ insert job (ab)   │                      │
   │                      ├──────────────────►│                      │
   │  {id}                │                   │                      │
   │◄─────────────────────┤                   │                      │
   │                      │                   │                      │
   │                                          │ tick 30s            │
   │                                          │◄─────────────────────┤
   │                                          │ select jobs queued   │
   │                                          │ for each job:        │
   │                                          │   fetch recipients   │
   │                                          │   assign abGroupId   │
   │                                          │     = hash(round)    │
   │                                          │     % variantCount   │
   │                                          │   create Run + Items │
   │                                          │   send via Zalo API  │
   │                                          │   update item.status │
```

---

## File Structure

### Files CREATE (5)
- `backend/prisma/migrations/<timestamp>_broadcast_ab_tracking/migration.sql`
- `backend/src/modules/broadcast/broadcast-preview-service.ts`
- `backend/src/modules/broadcast/broadcast-heatmap-service.ts`
- `frontend/src/components/marketing/PreviewModal.vue`
- `frontend/src/components/marketing/HeatmapWidget.vue`
- `frontend/src/components/marketing/BlacklistToggle.vue`

### Files MODIFY (6)
- `backend/prisma/schema.prisma` (+3 model fields)
- `backend/src/modules/broadcast/broadcast-routes.ts`
- `backend/src/modules/broadcast/broadcast-cron.ts`
- `backend/src/modules/broadcast/broadcast-report-routes.ts`
- `backend/src/modules/messages/message-handler.ts` (or hook)
- `frontend/src/views/marketing/BroadcastsView.vue`
- `frontend/src/views/settings/ZaloAccountsView.vue`

### Files NOT touched (verify only)
- `backend/src/modules/broadcast/broadcast-service.ts` — renderMessage có sẵn, reuse