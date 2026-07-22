# Sequences — Multi-Step Drip Campaign Builder

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

No `/marketing/sequences` page or API module exists. Prisma schema already has `SequenceStep`, `AutomationSequence`, `AutomationTrigger`, `AutomationCampaign` models — but no backend service or frontend UI.

## 2. Goals

Build a complete Sequences feature:
- List view of all sequences
- Visual step builder (trigger → step → step → ... → end)
- Each step: delay + action (send message/image/block)
- Activate/deactivate sequences
- Run history per sequence

## 3. Architecture

### 3A. Page Route

**Frontend:** `frontend/src/views/marketing/SequencesView.vue`
- Layout similar to `BroadcastsView.vue` but for drip sequences
- Sidebar: sequence list
- Main: sequence detail / builder

**Route:** Add to `CommunityMarketingShell.children`:
```typescript
{ path: 'sequences', name: 'CE.Sequences', component: () => import('@/views/marketing/SequencesView.vue'), meta: { requiresAuth: true } }
```

### 3B. Sequence Data Model (already in Prisma)

```prisma
model AutomationSequence {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  name        String
  description String?
  status      String   @default("draft") // draft | active | paused | completed
  triggerType String?  // "manual" | "event" | "scheduled"
  triggerConfig Json?
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  steps      AutomationSequenceStep[]
  @@map("automation_sequences")
}

model AutomationSequenceStep {
  id          String @id @default(cuid())
  sequenceId  String @map("sequence_id")
  order       Int
  delayMinutes Int   @default(0)  // wait this many minutes before this step
  actionType  String // "send_message" | "send_image" | "send_block"
  actionConfig Json   // { content, oaAccountId?, mediaId? }
  createdAt   DateTime @default(now())

  sequence    AutomationSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  @@index([sequenceId, order])
  @@map("automation_sequence_steps")
}
```

### 3C. Backend Module: `backend/src/modules/sequences/`

**Files:**
- `sequence-routes.ts` — CRUD routes
- `sequence-service.ts` — business logic
- `sequence-executor.ts` — cron job to execute due sequence steps

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/sequences` | List sequences for org |
| POST | `/api/v1/sequences` | Create sequence |
| GET | `/api/v1/sequences/:id` | Get sequence with steps |
| PUT | `/api/v1/sequences/:id` | Update sequence |
| DELETE | `/api/v1/sequences/:id` | Delete sequence |
| POST | `/api/v1/sequences/:id/activate` | Activate sequence |
| POST | `/api/v1/sequences/:id/pause` | Pause sequence |
| GET | `/api/v1/sequences/:id/history` | Run history |

**Sequence Executor (cron):**
- Runs every minute
- Finds `sequence_memberships` where `nextStepAt <= now`
- Executes the step → sends message via Zalo API
- Updates `nextStepAt` to `now + step.delayMinutes`
- If last step, marks membership as `completed`

**New table for sequence membership:**
```prisma
model SequenceMembership {
  id          String   @id @default(cuid())
  sequenceId  String   @map("sequence_id")
  contactId   String   @map("contact_id")
  oaAccountId String   @map("oa_account_id")
  currentStep Int      @default(0)
  nextStepAt  DateTime? @map("next_step_at")
  status      String   @default("active") // active | completed | unsubscribed
  enrolledAt  DateTime @default(now()) @map("enrolled_at")

  @@unique([sequenceId, contactId])
  @@map("sequence_memberships")
}
```

### 3D. Frontend Sequence Builder

**Component:** `frontend/src/views/marketing/SequencesView.vue`

**Builder UI (vertical step list):**
```
┌─ Tạo Sequence ───────────────────────────────────┐
│ Tên: [Tên sequence                    ]           │
│ Mô tả: [Mô tả ngắn                  ]          │
│ Trigger: [Manual ▾]                               │
│                                                     │
│ Các bước:                                           │
│ ┌ Step 1 ─────────────────────────────────────┐  │
│ │ Delay: [0] phút sau khi enroll               │  │
│ │ Action: [Gửi tin nhắn ▾]                    │  │
│ │ Content: [Nhập tin nhắn...                  ]│  │
│ │ Account: [Tất cả ▾]                          │  │
│ └──────────────────────────────────────────────┘  │
│                         [+ Thêm bước]              │
│ ┌ Step 2 ─────────────────────────────────────┐  │
│ │ Delay: [60] phút sau bước trước             │  │
│ │ Action: [Gửi ảnh ▾]                        │  │
│ │ Media: [Chọn ảnh từ Media Library]         │  │
│ └──────────────────────────────────────────────┘  │
│                                                     │
│            [Huỷ]  [Lưu nháp]  [Kích hoạt]        │
└───────────────────────────────────────────────────┘
```

**List view:**
- Table: Tên | Trigger | Số bước | Trạng thái | Enrolled | Actions
- Actions: Edit, Duplicate, Activate/Pause, Delete

## 4. Files to Create/Modify

### Create (backend)
- `backend/src/modules/sequences/sequence-routes.ts`
- `backend/src/modules/sequences/sequence-service.ts`
- `backend/src/modules/sequences/sequence-executor.ts`
- `backend/prisma/migrations/YYYYMMDDHHMMSS_add_sequence_memberships/migration.sql`

### Create (frontend)
- `frontend/src/views/marketing/SequencesView.vue`
- `frontend/src/components/sequences/SequenceBuilder.vue`
- `frontend/src/components/sequences/SequenceStepRow.vue`
- `frontend/src/api/sequences.ts`

### Modify
- `frontend/src/router/index.ts` — add sequences route to CommunityMarketingShell
- `backend/src/app.ts` — register `sequence-routes`
- `backend/src/app.ts` — register `sequence-executor` cron

## 5. Testing

- Create sequence with 3 steps → verify steps saved in DB
- Activate sequence → enroll a contact → verify step 1 fires after delay
- Verify step 2 fires after step 1's delay
- Pause sequence → verify no more steps fire
- Check history shows each step execution
