# Tasks: AI Content Suggest + Churn Risk

> Parent: [proposal.md](../proposal.md) · [Specs](./specs/) · [Design](../design.md)

---

## Phase 1 — Schema + AI prompt builders (0.5 ngày)

### 1.1. Schema migration ChurnRiskScore
- **File**: `C:backend/prisma/migrations/<ts>_churn_risk_score/migration.sql`
- **Nội dung**: CREATE TABLE churn_risk_scores + 2 indexes
- **Verify**: `npx prisma migrate dev`

### 1.2. Prisma model ChurnRiskScore
- **File**: `M:backend/prisma/schema.prisma`
- **Nội dung**: model ChurnRiskScore
- **Verify**: `npx prisma generate` exit 0

### 1.3. Prompt content-block-suggest
- **File**: `C:backend/src/modules/ai/prompts/content-block-suggest.ts`
- **Nội dung**: buildPrompt({ userIntent, count }) → { system, user }
- **Verify**: unit test

### 1.4. Prompt churn-detector
- **File**: `C:backend/src/modules/ai/prompts/churn-detector.ts`
- **Nội dung**: buildPrompt({ messages, lastInteractionDays }) → { system, user }
- **Verify**: unit test

---

## Phase 2 — AI service integration (0.5 ngày)

### 2.1. Add task type 'content_suggest' trong ai-service
- **File**: `M:backend/src/modules/ai/ai-service.ts`
- **Nội dung**: route task type → prompt builder → generate
- **Verify**: unit test

### 2.2. Add task type 'churn_risk' trong ai-service
- **File**: `M:backend/src/modules/ai/ai-service.ts`
- **Nội dung**: route task type → churn-detector prompt → generate
- **Verify**: unit test

---

## Phase 3 — Content Block Suggest (1 ngày)

### 3.1. Endpoint POST /ai/suggest-content-blocks
- **File**: `M:backend/src/modules/ai/ai-routes.ts`
- **Nội dung**: validate body, gọi ai-service task 'content_suggest', return JSON
- **Verify**: curl + timeout 8s

### 3.2. AiSuggestModal component
- **File**: `C:frontend/src/components/marketing/AiSuggestModal.vue`
- **Nội dung**: input userIntent, count selector, gọi API, render suggestions list
- **Verify**: UI render

### 3.3. Wire nút AI gợi ý vào ContentBlocksView
- **File**: `M:frontend/src/views/marketing/ContentBlocksView.vue`
- **Nội dung**: thêm button + modal, emit 'selected' → fill form
- **Verify**: UI flow

---

## Phase 4 — Churn Service + Cron (1.5 ngày)

### 4.1. Churn service (AI + fallback)
- **File**: `C:backend/src/modules/churn-risk/churn-service.ts`
- **Nội dung**: `scoreChurn(orgId, contactId, messages, lastInteractionDays)` → { riskLevel, reasons, suggestedAction, source }
- **Verify**: unit test (3 cases: AI success, AI fail, rule-based)

### 4.2. Churn cron
- **File**: `C:backend/src/modules/churn-risk/churn-cron.ts`
- **Nội dung**: scan contacts cooling/cold, for each → scoreChurn → upsert ChurnRiskScore
- **Verify**: integration test (mock data)

### 4.3. Wire churn-cron vào server startup
- **File**: `M:backend/src/server.ts` (or app.ts)
- **Nội dung**: register churn cron schedule '0 2 * * *'
- **Verify**: log khi khởi động

### 4.4. Churn routes (dashboard widget)
- **File**: `C:backend/src/modules/churn-risk/churn-routes.ts`
- **Nội dung**: GET /api/v1/churn/top → top 10 high risk, expiresAt > now
- **Verify**: curl

---

## Phase 5 — Frontend Churn Widget (1 ngày)

### 5.1. ChurnRiskWidget component
- **File**: `C:frontend/src/components/dashboard/ChurnRiskWidget.vue`
- **Nội dung**: fetch /churn/top, render list, click → navigate /contacts/:id
- **Verify**: UI render với mock data

### 5.2. Mount vào Dashboard
- **File**: `M:frontend/src/views/Dashboard.vue` (hoặc HomeView)
- **Nội dung**: import + <ChurnRiskWidget />
- **Verify**: UI render

---

## Phase 6 — Tests + Verification (0.5 ngày)

### 6.1. Backend unit tests
- `tests/ai-content-suggest.test.ts` — 3 cases (success / timeout / fallback)
- `tests/churn-service.test.ts` — 4 cases (high risk / medium / sentiment upgrade / rule fallback)

### 6.2. Backend typecheck
- `cd backend && npx tsc --noEmit` exit 0

### 6.3. Frontend typecheck
- `cd frontend && npx vue-tsc --noEmit` exit 0

### 6.4. Migration verify
- `npx prisma migrate status` show applied

### 6.5. UI manual
- 4 bước (AI gợi ý → chọn → fill form; dashboard widget render; click row → navigate)