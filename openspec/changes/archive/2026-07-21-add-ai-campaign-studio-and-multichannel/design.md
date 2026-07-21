# Design: AI Campaign Studio + Multi-channel

> Parent: [proposal.md](../proposal.md)

---

## Schema Migration

```sql
-- 1. Channel enum
CREATE TYPE channel AS ENUM ('zalo', 'telegram', 'facebook', 'instagram', 'sms');

ALTER TABLE conversations
  ADD COLUMN channel channel NOT NULL DEFAULT 'zalo';

CREATE INDEX idx_conv_channel ON conversations(org_id, channel);

-- 2. CampaignPlan table
CREATE TABLE campaign_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,
  created_by_id   TEXT NOT NULL,
  user_goal       TEXT NOT NULL,
  plan            JSONB NOT NULL,
  source          VARCHAR(20) NOT NULL,
  applied_to_job_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_plans_org ON campaign_plans(org_id, created_at);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Vue 3)                                         │
│  /marketing/ai-studio (NEW):                            │
│    + AiCampaignStudioView.vue (NEW)    ← Capability 1   │
│    + PlanCard.vue (NEW)                                   │
│                                                         │
│  /chat (MODIFY — Conversation list):                    │
│    + ChannelFilter.vue (NEW)           ← Capability 2   │
│    + ChannelBadge.vue (NEW)                              │
│    + ChannelIcon.vue (NEW)                               │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│ Backend (Fastify)                                        │
│  ai/prompts/campaign-planner.ts (NEW)                   │
│  ai/ai-service.ts (MODIFY: + planCampaign)              │
│  ai/ai-routes.ts (MODIFY: + plan-campaign + apply)      │
│                                                         │
│  campaign/campaign-service.ts (MODIFY: + createFromPlan)│
│                                                         │
│  integrations/                                          │
│    channel-adapter.interface.ts (NEW) ← contract        │
│    providers/facebook-messenger.ts (NEW)               │
│    providers/instagram-dm.ts (NEW)                     │
│    providers/sms-brandname.ts (NEW)                    │
│                                                         │
│  webhooks/                                              │
│    facebook-webhook-route.ts (NEW)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: ChannelAdapter interface là contract, không kế thừa
TypeScript interface — không có abstract class. Mỗi provider implement riêng, có thể swap dễ dàng.

### D2: SMS provider abstraction = generic HTTP
80% SMS brandname VN dùng HTTP API JSON tương tự. 1 adapter "generic" cover được. Specific providers (VNPT/Viettel) = Phase sau.

### D3: FB/IG stub — không OAuth verify
Spec chỉ yêu cầu interface + endpoint stub. Real OAuth + verify_token Phase sau. Beat: chi phí < 1 ngày.

### D4: Plan apply = tạo BroadcastJob async
Plan có audience (filters) + 1 message. Cần resolve filters → contactListId. Approximate: tìm list có sẵn khớp priorityScore/lastInteraction hoặc tạo "AI Segment" list mới.

### D5: Telegram đã có (skip integration)
Telegram bridge đã có sẵn (`integrations/providers/telegram-bridge/`). Spec chỉ thêm channel enum + UI filter. KHÔNG code provider mới cho Telegram.

---

## Sequence: Campaign Apply

```
User (FE)                Fastify                  DB                 Zalo/Telegram/FB/SMS
   │                        │                     │                          │
   │ POST /plan-campaign    │                     │                          │
   ├───────────────────────►│                     │                          │
   │                        │ AI call              │                          │
   │                        │ (8s timeout)         │                          │
   │  plan + planId         │                     │                          │
   │◄───────────────────────┤                     │                          │
   │                        │ SAVE plan           │                          │
   │                        ├────────────────────►│                          │
   │                        │                     │                          │
   │ POST /plan-campaign/:id/apply                 │                          │
   ├───────────────────────►│                     │                          │
   │                        │ create BroadcastJob │                          │
   │                        ├────────────────────►│                          │
   │  jobId                 │                     │                          │
   │◄───────────────────────┤                     │                          │
```

---

## File Structure

### Files CREATE (8)
- `backend/prisma/migrations/<ts>_channel_and_plan/migration.sql`
- `backend/src/modules/ai/prompts/campaign-planner.ts`
- `backend/src/modules/integrations/channel-adapter.interface.ts`
- `backend/src/modules/integrations/providers/facebook-messenger.ts`
- `backend/src/modules/integrations/providers/instagram-dm.ts`
- `backend/src/modules/integrations/providers/sms-brandname.ts`
- `backend/src/modules/webhooks/facebook-webhook-route.ts`
- `frontend/src/views/marketing/AiCampaignStudioView.vue`
- `frontend/src/components/chat/ChannelFilter.vue`

### Files MODIFY (5)
- `backend/prisma/schema.prisma` (+CampaignPlan + Channel enum + conversation.channel)
- `backend/src/modules/ai/ai-service.ts` (+planCampaign)
- `backend/src/modules/ai/ai-routes.ts` (+plan-campaign routes)
- `backend/src/app.ts` (register new routes)
- `frontend/src/views/ChatView.vue` (add ChannelFilter + badge)