# AI Fix, Auto Chat & Settings Upgrade

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

1. **AI Config broken:** AiAssistantPage.vue only shows enable toggle + prompt template. Custom provider settings (baseUrl, apiKey, model) are not configurable via UI.
2. **Auto Chat missing:** No rule-based auto-reply when customers message the Zalo OA. No AI suggestion integrated into chat sidebar.
3. **AI Settings minimal:** Provider/model/per-feature config spread across different places.

## 2. Goals

- Fix custom provider configuration from UI (baseUrl, apiKey, model)
- Add AI Auto Chat with two modes: rule-based (keyword/regex trigger) and AI Suggest (context-aware reply draft)
- Upgrade AI Settings page with full provider config + Auto Chat rules tab

## 3. Architecture

### 3A. Custom Provider Config (Fix)

**Backend:** `PUT /api/v1/ai/providers/:id` already exists in `ai-routes.ts`. Accepts `{ baseUrl, apiKey, model, temperature, maxTokens }`. The `custom` provider is already implemented in `provider-registry.ts`.

**Frontend:** Add a form to `AiAssistantPage.vue` to configure the custom provider:
- Input: Base URL (e.g. `http://localhost:20128/v1`)
- Input: API Key
- Input: Model name (e.g. `cx/gpt-5.4`)
- Input: Temperature (0-2, default 0.7)
- Input: Max tokens (default 1000)
- Test connection button → calls `POST /api/v1/ai/test-connection` (new endpoint)

### 3B. AI Auto Chat — Rule-Based Engine

**Database:** New table `auto_reply_rules` in Prisma schema:

```prisma
model AutoReplyRule {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  oaAccountId String?  @map("oa_account_id") // null = all accounts
  name        String
  triggerType String   // "keyword" | "regex" | "tag" | "time_window"
  triggerValue String // the keyword/regex pattern/time window JSON
  actionType  String  // "text" | "image" | "template" | "ai_suggest"
  actionContent String // text content, or media ID, or template ID
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([orgId, enabled])
  @@map("auto_reply_rules")
}
```

**Backend module:** `backend/src/modules/auto-reply/`

- `auto-reply-routes.ts`: CRUD for rules + webhook handler for incoming Zalo messages
- `auto-reply-service.ts`: Match incoming message against rules → return auto-reply

**Flow:**
1. Zalo webhook → `POST /api/v1/webhooks/zalo/incoming` → check if auto-reply enabled
2. If enabled: call `matchAutoReply(orgId, oaAccountId, messageText)`
3. If rule matches: send auto-reply via Zalo API
4. If rule is `ai_suggest`: call `generateAiOutput(type='auto_reply', context)` → send AI reply

### 3C. AI Auto Chat — AI Suggest in Chat

**Existing:** `generateAiOutput(type='reply_draft')` in `ai-service.ts` already builds conversation context and calls AI.

**Frontend:** Integrate into ChatView sidebar:
- When user opens a conversation, call `GET /api/v1/ai/suggest/:conversationId`
- Show suggestion in `AISuggestBar.vue` as clickable pills
- Click pill → insert into composer, user reviews and sends

### 3D. AI Auto Chat — Phần của Trang Automation

**Auto Chat Rules được quản lý ở trang `/automation` (Trang Automation), không phải tab trên AI Settings.**

Xem spec riêng: `docs/plans/2026-07-22-automation-page-unified.md`.

## 4. API Endpoints (New)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ai/auto-reply` | List rules for org |
| POST | `/api/v1/ai/auto-reply` | Create rule |
| PUT | `/api/v1/ai/auto-reply/:id` | Update rule |
| DELETE | `/api/v1/ai/auto-reply/:id` | Delete rule |
| POST | `/api/v1/ai/auto-reply/test` | Test rule against sample message |
| GET | `/api/v1/ai/suggest/:conversationId` | Get AI reply draft for conversation |

## 5. Files to Create/Modify

### Create
- `backend/src/modules/auto-reply/auto-reply-routes.ts`
- `backend/src/modules/auto-reply/auto-reply-service.ts`
- `frontend/src/components/chat/AutoReplyRulesTab.vue`

### Modify
- `backend/prisma/schema.prisma` — add `AutoReplyRule` model
- `backend/src/modules/ai/ai-routes.ts` — add `/ai/suggest/:conversationId` endpoint
- `frontend/src/views/settings/AiAssistantPage.vue` — add provider config form + Auto Chat tab
- `frontend/src/api/ai.ts` — add auto-reply API functions
- `frontend/src/components/chat/AISuggestBar.vue` — load suggestion on conversation open

## 6. Testing

- Manual: Configure custom provider → send test message → check auto-reply fires
- Manual: Open chat → verify AI suggest appears → click to insert
- Automated: Unit test `auto-reply-service.matchAutoReply()` with keyword/regex/trigger inputs
