# Automation Dialog: Multi-Account & Multi-Message Broadcast

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

Current `BroadcastsView.vue` "Tạo broadcast" dialog only supports:
- Single Zalo account
- Single message type (text OR image OR content block)
- Single recipient type (friends or list)

User needs:
- Multi-account broadcast: choose multiple Zalo accounts to send simultaneously
- Multi-message: one step can have text + image + content block (multiple content types)
- Cross-account × multi-recipient: N accounts × M recipients

## 2. Goals

Upgrade the broadcast creation dialog to support multi-account selection and multi-message content in one flow.

## 3. Architecture

### 3A. Multi-Account Selection

**UI Change:** Replace single Zalo account dropdown with a multi-select checkbox list:
- Fetch available accounts: `GET /api/v1/zalo-accounts`
- Display: checkbox + account name + avatar
- Visual: card-style list with select all / deselect all
- Send mode options:
  - **Round-robin:** Each account sends to 1/#accounts of recipients
  - **Duplicate:** All accounts send the same message to all recipients

### 3B. Multi-Message Content (Step Builder)

**Current:** Single `content` field + optional `imageUrl`.

**New:** "Content Steps" — each broadcast can have multiple content steps:

```typescript
interface BroadcastStep {
  id: string;
  type: 'text' | 'image' | 'block';
  content: string; // text content or media URL or block ID
  delayMinutes?: number; // delay before sending this step after previous
}
```

**UI:** Add "Add Step" button below content input:
- Click → add new step row
- Each row: type dropdown (Text/Image/Block) + content input + delay input
- Drag to reorder steps (use `vuedraggable` or similar)
- Remove step button

**Backend:** `broadcastJob.create()` already supports `steps` field as JSON.

### 3C. Dialog Layout

```
┌─ Tạo Broadcast ──────────────────────────────────┐
│ Account: [All accounts ▾] [Select accounts]       │
│   ☐ Nick 1 - Tên OA 1                          │
│   ☑ Nick 2 - Tên OA 2  ← selected              │
│   ☐ Nick 3 - Tên OA 3                          │
│                                                   │
│ Recipients: [Friends ▾] [Customer List ▾]         │
│ Filter: [All friends / Tagged: ...]               │
│                                                   │
│ Content Steps:                                    │
│   [1] Text: [Nhập tin nhắn...         ] [×]    │
│       + Add: Image | Block | Text                  │
│   [2] Image: [media_123.jpg] [×] Delay: 30s   │
│       + Add: Image | Block | Text                  │
│                                                   │
│ A/B Testing: [Toggle]                            │
│   Variant B: [Nhập tin...              ]          │
│                                                   │
│ Schedule: [Once ▾] [Date picker] [Time picker]    │
│ Anti-block: Max [50] / run, Delay [5-15]s        │
│                                                   │
│              [Huỷ]  [Tạo Broadcast]              │
└─────────────────────────────────────────────────┘
```

## 4. API Changes

**Existing:** `POST /api/v1/broadcast-jobs`

**Extend payload:**
```json
{
  "oaAccountIds": ["acc1", "acc2"],  // NEW: array, null = single account (backward compat)
  "sendMode": "duplicate" | "round_robin",  // NEW
  "steps": [
    { "type": "text", "content": "Hello!" },
    { "type": "image", "content": "media_id_123" },
    { "type": "block", "content": "block_uuid" }
  ]
}
```

**Backend:** Update `broadcast-job-service.ts` to:
1. Expand `oaAccountIds` into multiple send jobs (one per account)
2. Execute steps sequentially with delays
3. Log per-account delivery results

## 5. Files to Modify

- `frontend/src/views/marketing/BroadcastsView.vue` — upgrade dialog
- `frontend/src/components/broadcast/BroadcastForm.vue` (create if missing) — extracted form component
- `frontend/src/api/broadcast.ts` — update `CreateBroadcastPayload` type
- `backend/src/modules/broadcast/broadcast-job-service.ts` — handle multi-account + steps
- `backend/src/modules/broadcast/broadcast-routes.ts` — accept new payload fields

## 6. Testing

- Manual: Select 2 accounts → create broadcast → verify each account sends
- Manual: Add 2 steps (text + image) → verify both sent in order with delay
- Unit: `broadcast-job-service.expandMultiAccount()` with various `sendMode` options
