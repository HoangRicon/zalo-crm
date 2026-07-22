# Message Templates: Fix Filter + AI Generate + Merge Fields + Schedule

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

1. **Bug:** `filteredTemplates` in `MessageTemplatesPage.vue` returns all templates regardless of folder selection or search
2. **Missing features:** No AI generate, no merge fields UI, no schedule send for individual templates

## 2. Goals

- Fix filter bug
- Add AI template generation (prompt → AI writes template)
- Add merge field tagging in template editor
- Add one-time schedule send for individual templates

## 3. Bug Fix: filteredTemplates

**Current broken code (line 291-296 of MessageTemplatesPage.vue):**
```typescript
const filteredTemplates = computed(() => {
  return templates.value; // ← always returns all, no filtering
});
```

**Fix:**
```typescript
const filteredTemplates = computed(() => {
  let result = templates.value;
  if (selectedFolderId.value) {
    result = result.filter(t => t.folderId === selectedFolderId.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q)
    );
  }
  return result;
});
```

## 4. AI Template Generation

**Flow:** User clicks "Tạo bằng AI" button → modal opens → enters description → AI generates template content → user reviews and saves.

**New endpoint:** `POST /api/v1/ai/template/generate`
- Body: `{ description: string, category?: string }`
- Response: `{ content: string, suggestedName: string }`
- Backend: calls `generateText(type='template_draft', prompt="Tạo template tin nhắn Zalo cho: {description}")`

**Frontend:**
- Add button in template header: `[+ Tạo bằng AI]`
- Modal: description textarea + Generate button → show result → Edit/Save

## 5. Merge Fields

**Backend:** `broadcast-service.ts` already replaces `{{contact.name}}`, `{{contact.phone}}` tokens.

**Frontend:** In template editor, add a toolbar:
```
[Merge fields ▾] → { {contact.name} } { {contact.phone} } { {contact.email} } { {custom_1} }
```
- Click → insert `{{field_name}}` at cursor position
- Highlight all merge fields with a distinct style (e.g., blue background)
- When saving, validate that referenced fields exist in contact schema

**Supported fields:** `contact.name`, `contact.phone`, `contact.email`, `contact.id`, `user.fullName`, `org.name`, `date.today`, `date.now`

## 6. Schedule Send (One-Time)

**Use case:** Send a single template to a contact list at a specific time (not a recurring campaign).

**New endpoint:** `POST /api/v1/templates/schedule-send`
- Body: `{ templateId: string, oaAccountId: string, contactIds: string[], scheduledAt: ISO8601 }`
- Creates a `ScheduledTemplateSend` record
- Background job checks every minute for due sends

**New table:**
```prisma
model ScheduledTemplateSend {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  oaAccountId String   @map("oa_account_id")
  templateId  String   @map("template_id")
  contactIds  Json     // string[]
  scheduledAt DateTime @map("scheduled_at")
  status      String   @default("pending") // pending | sent | failed
  sentAt      DateTime? @map("sent_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([orgId, status, scheduledAt])
  @@map("scheduled_template_sends")
}
```

**Frontend:** In template detail view, add "Gửi theo lịch" button:
- Opens modal: select account → select contacts/list → pick datetime
- Shows scheduled sends in a small table below template info

## 7. Files to Create/Modify

### Create
- `backend/prisma/migrations/YYYYMMDDHHMMSS_add_scheduled_template_sends/migration.sql`
- `backend/src/modules/templates/scheduled-template-send-service.ts`
- `backend/src/modules/templates/scheduled-template-send-routes.ts`
- `frontend/src/components/templates/AiGenerateTemplateModal.vue`
- `frontend/src/components/templates/MergeFieldToolbar.vue`
- `frontend/src/components/templates/ScheduleSendModal.vue`

### Modify
- `frontend/src/views/settings/MessageTemplatesPage.vue` — fix filteredTemplates + add AI button + schedule button
- `frontend/src/api/message-templates.ts` — add `generateTemplate`, `scheduleSend` functions
- `backend/src/modules/templates/message-template-routes.ts` — add `/template/generate` + `/schedule-send`
- `backend/src/modules/templates/message-template-service.ts` — add `generateTemplateDraft`
- `backend/src/app.ts` — register scheduled-template-send cron job

## 8. Testing

- Bug: Select folder → only templates in that folder appear
- Bug: Type in search → filtered results
- AI: Enter "khách hàng mới chào hỏi" → AI returns draft → save as template
- Merge: Insert {{contact.name}} → send broadcast → recipient sees their name
- Schedule: Schedule send 1 min ahead → verify sent on time
