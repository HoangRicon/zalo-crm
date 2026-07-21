# Tasks: AI Campaign Studio + Multi-channel

---

## Phase 1 — Schema + Channel enum (0.5 ngày)

### 1.1. Migration channel + CampaignPlan
- **File**: `C:backend/prisma/migrations/<ts>_channel_and_plan/migration.sql`
- **Nội dung**: CREATE TYPE channel + ALTER conversations + CREATE TABLE campaign_plans
- **Verify**: `npx prisma migrate dev`

### 1.2. Update schema.prisma
- **File**: `M:backend/prisma/schema.prisma`
- **Nội dung**: +enum Channel, +Conversation.channel, +model CampaignPlan
- **Verify**: `npx prisma generate`

---

## Phase 2 — AI Campaign Studio (1.5 ngày)

### 2.1. Campaign planner prompt
- **File**: `C:backend/src/modules/ai/prompts/campaign-planner.ts`
- **Nội dung**: buildCampaignPlannerPrompt({ userGoal, orgStats }) → { system, user }
- **Verify**: unit test

### 2.2. planCampaign trong ai-service
- **File**: `M:backend/src/modules/ai/ai-service.ts`
- **Nội dung**: planCampaign(orgId, userGoal) → plan JSON + save CampaignPlan + return
- **Verify**: unit test

### 2.3. Rule-based fallback
- **File**: `M:backend/src/modules/ai/prompts/campaign-planner.ts`
- **Nội dung**: ruleBasedPlan(orgStats, userGoal) → default plan
- **Verify**: unit test

### 2.4. POST /ai/plan-campaign endpoint
- **File**: `M:backend/src/modules/ai/ai-routes.ts`
- **Nội dung**: validate, gọi planCampaign, save, return { plan, planId, source }
- **Verify**: curl

### 2.5. POST /ai/plan-campaign/:id/apply
- **File**: `M:backend/src/modules/ai/ai-routes.ts`
- **Nội dung**: lookup plan, tạo BroadcastJob từ plan, update plan.appliedToJobId
- **Verify**: curl

### 2.6. AiCampaignStudioView
- **File**: `C:frontend/src/views/marketing/AiCampaignStudioView.vue`
- **Nội dung**: textarea → submit → 5 plan cards → apply button
- **Verify**: UI render

### 2.7. Router route
- **File**: `M:frontend/src/router/index.ts`
- **Nội dung**: +/marketing/ai-studio
- **Verify**: navigate

---

## Phase 3 — Channel Adapter Interface (1 ngày)

### 3.1. ChannelAdapter interface
- **File**: `C:backend/src/modules/integrations/channel-adapter.interface.ts`
- **Nội dung**: TypeScript interface với 4 methods
- **Verify**: typecheck

### 3.2. Facebook Messenger adapter
- **File**: `C:backend/src/modules/integrations/providers/facebook-messenger.ts`
- **Nội dung**: stub class implement interface
- **Verify**: unit test (mock webhook)

### 3.3. Instagram DM adapter
- **File**: `C:backend/src/modules/integrations/providers/instagram-dm.ts`
- **Nội dung**: stub class
- **Verify**: unit test

### 3.4. SMS brandname adapter
- **File**: `C:backend/src/modules/integrations/providers/sms-brandname.ts`
- **Nội dung**: configurable HTTP gateway + Bearer auth
- **Verify**: unit test (mock HTTP)

---

## Phase 4 — Facebook Webhook (1 ngày)

### 4.1. FB webhook route
- **File**: `C:backend/src/modules/webhooks/facebook-webhook-route.ts`
- **Nội dung**: GET verification + POST receive payload → adapter.parseIncomingMessage
- **Verify**: curl verify endpoint + POST payload

### 4.2. Register webhooks in app.ts
- **File**: `M:backend/src/app.ts`
- **Nội dung**: await app.register(facebookWebhookRoutes)
- **Verify**: server khởi động OK

---

## Phase 5 — Multi-channel Inbox UI (1.5 ngày)

### 5.1. ChannelFilter component
- **File**: `C:frontend/src/components/chat/ChannelFilter.vue`
- **Nội dung**: dropdown filter 6 options (all + 5 channels)
- **Verify**: UI

### 5.2. ChannelBadge component
- **File**: `C:frontend/src/components/chat/ChannelBadge.vue`
- **Nội dung**: icon small cho mỗi channel
- **Verify**: UI

### 5.3. Wire vào ChatView
- **File**: `M:frontend/src/views/ChatView.vue`
- **Nội dung**: mount ChannelFilter trên conversation list + ChannelBadge trên mỗi row
- **Verify**: UI

### 5.4. API integration
- **File**: `M:frontend/src/views/ChatView.vue`
- **Nội dung**: GET /conversations?channel=... thay đổi khi filter thay đổi
- **Verify**: fetch + render

---

## Phase 6 — Verification (0.5 ngày)

### 6.1. Backend typecheck
### 6.2. Frontend typecheck
### 6.3. AI Studio e2e (input goal → plan display → apply → job created)
### 6.4. Inbox e2e (filter → list updates)
### 6.5. FB webhook unit test