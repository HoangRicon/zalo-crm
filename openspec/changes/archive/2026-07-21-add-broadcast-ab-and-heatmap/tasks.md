# Tasks: Broadcast A/B + Heatmap

> Parent: [proposal.md](../proposal.md) · [Specs](./specs/) · [Design](../design.md)

---

## Phase 1 — Schema + Backend foundation (1 ngày)

### 1.1. Schema migration
- **File**: `C:backend/prisma/migrations/<ts>_broadcast_ab_tracking/migration.sql`
- **Nội dung**: 3 ALTER TABLE (jobs / run_items / zalo_accounts) + 2 indexes
- **Verify**: `npx prisma migrate dev` apply thành công; `npx prisma db pull` match schema
- **AC**: tất cả specs (schema mới)

### 1.2. Update Prisma schema
- **File**: `M:backend/prisma/schema.prisma`
- **Nội dung**: +abMode/abVariantCount/variantMessageTexts trên BroadcastJob; +replyMessageId/repliedAt/abGroupId trên BroadcastRunItem; +broadcastBlacklisted/broadcastBlacklistReason trên ZaloAccount
- **Verify**: `npx prisma generate` exit 0

### 1.3. Preview service (backend)
- **File**: `C:backend/src/modules/broadcast/broadcast-preview-service.ts`
- **Nội dung**: `getPreview(orgId, {sourceType, customerListId|zaloAccountId, messageText, count=3})` → return 3 sample recipients với rendered message
- **Verify**: unit test với mock data

### 1.4. Preview route
- **File**: `M:backend/src/modules/broadcast/broadcast-routes.ts`
- **Nội dung**: `POST /broadcast/jobs/preview` → gọi preview service
- **Verify**: curl thành công trả 3 samples

---

## Phase 2 — A/B Test (1.5 ngày)

### 2.1. ABVariantsEditor (FE)
- **File**: `C:frontend/src/components/marketing/ABVariantsEditor.vue`
- **Nội dung**: component chọn 2-3 variants, mỗi variant có messageText/imageUrl/contentBlockIds riêng
- **Verify**: render + edit được

### 2.2. Wire ABVariantsEditor vào form broadcast
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**: thêm toggle "A/B test", show editor khi toggle on
- **Verify**: UI hiển thị 2-3 variants

### 2.3. Submit A/B job
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue` (submit handler)
- **Nội dung**: gửi abMode='ab_split', abVariantCount=N, messageText (variant A), variantMessageTexts=[B, C]
- **Verify**: API nhận payload đúng

### 2.4. Cron assign abGroupId khi run
- **File**: `M:backend/src/modules/broadcast/broadcast-cron.ts`
- **Nội dung**: trong processRun, với job.abMode='ab_split', hash(recipientId + runSeed) % abVariantCount → 'A'/'B'/'C'; render message theo variant tương ứng
- **Verify**: 100 items → 50A/50B

### 2.5. Report route A/B groups
- **File**: `M:backend/src/modules/broadcast/broadcast-report-routes.ts`
- **Nội dung**: thêm field `groups: [{group, rate, count}]` vào report response
- **Verify**: curl với A/B run → trả groups

### 2.6. RunReportCard hiển thị A/B
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**: card run có A/B → show groups + winner badge
- **Verify**: UI render đúng

---

## Phase 3 — Reply Tracking (1.5 ngày)

### 3.1. Message handler hook
- **File**: `M:backend/src/modules/messages/message-handler.ts` (hoặc new hook file)
- **Nội dung**: khi nhận inbound message, query `broadcast_run_items` where zaloUid=... AND status='sent' AND repliedAt IS NULL AND run.startedAt > now-7d → update repliedAt + replyMessageId
- **Verify**: e2e test gửi broadcast → reply → check repliedAt

### 3.2. responseRate calculation
- **File**: `M:backend/src/modules/broadcast/broadcast-report-routes.ts`
- **Nội dung**: thêm field responseRate, repliedCount, groups
- **Verify**: unit test

### 3.3. UI badge %reply
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**: card run show badge "10% reply" colored
- **Verify**: UI render

### 3.4. Test reply scenario
- **File**: `C:backend/tests/broadcast-reply-tracking.test.ts`
- **Nội dung**: mock prisma, test 3 cases (reply in window / reply out of window / multiple replies)
- **Verify**: vitest pass

---

## Phase 4 — Heatmap (1 ngày)

### 4.1. Heatmap service
- **File**: `C:backend/src/modules/broadcast/broadcast-heatmap-service.ts`
- **Nội dung**: aggregate 30 ngày broadcasts + replies → matrix 24x7. Cache 60 phút in-memory per orgId.
- **Verify**: unit test với sample data

### 4.2. Heatmap route
- **File**: `M:backend/src/modules/broadcast/broadcast-routes.ts`
- **Nội dung**: `GET /broadcast/heatmap?days=30`
- **Verify**: curl trả JSON 24x7

### 4.3. HeatmapWidget UI
- **File**: `C:frontend/src/components/marketing/HeatmapWidget.vue`
- **Nội dung**: grid 24x7 colored, tooltip per cell, top-3 suggestions
- **Verify**: UI render với mock data

### 4.4. Mount HeatmapWidget trong BroadcastsView
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**: thêm widget ở top dashboard
- **Verify**: UI render

---

## Phase 5 — Nick Blacklist (1 ngày)

### 5.1. BlacklistToggle UI
- **File**: `C:frontend/src/components/marketing/BlacklistToggle.vue`
- **Nội dung**: switch + textarea reason (200 chars)
- **Verify**: UI render

### 5.2. Wire vào ZaloAccountsView
- **File**: `M:frontend/src/views/settings/ZaloAccountsView.vue`
- **Nội dung**: mỗi account card có BlacklistToggle
- **Verify**: toggle save được

### 5.3. PUT /zalo-accounts/:id nhận blacklist
- **File**: `M:backend/src/modules/zalo-accounts/...` (find right file)
- **Nội dung**: accept broadcastBlacklisted + broadcastBlacklistReason, save
- **Verify**: curl OK

### 5.4. Cron skip blacklisted
- **File**: `M:backend/src/modules/broadcast/broadcast-cron.ts`
- **Nội dung**: trong processRun, check zaloAccount.broadcastBlacklisted → skip + log
- **Verify**: unit test

### 5.5. Confirm dialog khi submit blacklist nick
- **File**: `M:frontend/src/views/marketing/BroadcastsView.vue`
- **Nội dung**: check trước submit, hiển thị dialog nếu account blacklist
- **Verify**: UI flow

---

## Verification (G4)

### V1. Backend typecheck
- `cd backend && npx tsc --noEmit` exit 0

### V2. Backend tests
- `npx vitest run tests/broadcast-reply-tracking.test.ts tests/broadcast-preview.test.ts tests/broadcast-heatmap.test.ts` all pass

### V3. Backend smoke
- curl 5 endpoints (preview, jobs POST A/B, report, heatmap, zalo-accounts PUT blacklist)

### V4. Frontend typecheck
- `cd frontend && npx vue-tsc --noEmit` exit 0

### V5. Frontend UI manual
- 6 bước trên browser (preview modal, A/B submit, report card, heatmap, blacklist toggle, skip cron)

### V6. Migration verify
- `npx prisma migrate status` show applied