# Design: AI Content Suggest + Churn Risk Detector

> Parent: [proposal.md](../proposal.md)

---

## Schema Migration

```sql
CREATE TABLE churn_risk_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,
  contact_id      TEXT NOT NULL,
  risk_level      VARCHAR(10) NOT NULL CHECK (risk_level IN ('low','medium','high')),
  reasons         JSONB NOT NULL,
  suggested_action TEXT,
  source          VARCHAR(20) NOT NULL CHECK (source IN ('ai','rule_based')),
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE(contact_id, scored_at)
);
CREATE INDEX idx_churn_org_level_scored ON churn_risk_scores(org_id, risk_level, scored_at);
CREATE INDEX idx_churn_expires ON churn_risk_scores(expires_at);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Vue 3)                                         │
│  ContentBlocksView.vue:                                   │
│    + AiSuggestModal.vue (NEW)         ← Capability 1    │
│                                                         │
│  Dashboard.vue (or HomeView):                            │
│    + ChurnRiskWidget.vue (NEW)        ← Capability 2    │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│ Backend (Fastify)                                        │
│  ai-routes.ts (MODIFY):                                 │
│    POST /ai/suggest-content-blocks (NEW)                │
│                                                         │
│  ai/prompts/content-block-suggest.ts (NEW)               │
│  ai/prompts/churn-detector.ts (NEW)                      │
│                                                         │
│  ai/ai-service.ts (MODIFY):                             │
│    add task type 'content_suggest'                      │
│    add task type 'churn_risk'                           │
│                                                         │
│  churn-risk/                                            │
│    churn-cron.ts (NEW)               ← 02:00 VN nightly │
│    churn-service.ts (NEW)            ← AI + fallback    │
│    churn-routes.ts (NEW)             ← GET /churn/top   │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: Prompt builder trả string trực tiếp, không cache
Mỗi prompt là template + vars (system + user). Cache vì dynamic content — không có lợi.

### D2: Churn fallback dựa trên daysSinceLastInteraction + sentiment
Đơn giản, deterministic, không cần AI. Khi AI fail → dùng ngay.

### D3: 1 cron cho tất cả orgs (runSystemQuery)
Cross-tenant cron scan. Mỗi org ~ 5-100 KH cooling → tổng ~5K rows/quét = OK.

### D4: Không xóa ChurnRiskScore cũ
Audit trail. expiresAt chỉ filter dashboard.

### D5: SuggestedAction Vietnamese
Target user là sale Việt → action phải tiếng Việt.

---

## Sequence: Churn Cron

```
Cron 02:00 VN                Per org (sequential)
    │                              │
    ├── query contacts ─────────► │
    │   (engagementPattern IN     │
    │    cooling,cold AND         │
    │    lastInteractionAt >14d)  │
    │                              │
    │   for each contact:         │
    │   ├── fetch 10 latest msgs  │
    │   ├── call AI churn_risk   │
    │   │   timeout 10s           │
    │   │   on fail → rule-based  │
    │   ├── upsert ChurnRiskScore │
    │   │   scoredAt=now          │
    │   │   expiresAt=now+24h     │
    │                              │
```

---

## File Structure

### Files CREATE (8)
- `backend/prisma/migrations/<ts>_churn_risk_score/migration.sql`
- `backend/src/modules/ai/prompts/content-block-suggest.ts`
- `backend/src/modules/ai/prompts/churn-detector.ts`
- `backend/src/modules/churn-risk/churn-service.ts`
- `backend/src/modules/churn-risk/churn-cron.ts`
- `backend/src/modules/churn-risk/churn-routes.ts`
- `frontend/src/components/marketing/AiSuggestModal.vue`
- `frontend/src/components/dashboard/ChurnRiskWidget.vue`

### Files MODIFY (4)
- `backend/prisma/schema.prisma` (+ChurnRiskScore model)
- `backend/src/modules/ai/ai-routes.ts` (+suggest-content-blocks endpoint)
- `backend/src/modules/ai/ai-service.ts` (+task type handlers)
- `frontend/src/views/marketing/ContentBlocksView.vue` (+AI button)
- `frontend/src/views/Dashboard.vue` (or HomeView, mount ChurnRiskWidget)