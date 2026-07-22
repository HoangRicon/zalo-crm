# Trang Automation — Unified Management Page

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

User muốn có **1 trang Automation duy nhất** quản lý tất cả automation:
- Auto Reply Rules (rule-based auto chat)
- Sequences (drip campaigns)
- Triggers (event-based triggers)
- Reports (lịch sử automation)

Hiện tại:
- Không có `/automation` route
- Auto Reply Rules → chưa có UI
- Sequences → đang xây ở `/marketing/sequences` (spec riêng)
- Triggers → đã có trong schema nhưng chưa có UI
- Reports → đang xây ở `/reports/automation` (spec riêng)

## 2. Goals

Tạo trang `/automation` (route standalone) làm hub quản lý tất cả automation features, với 4 tab:
1. **Auto Reply** — Rule-based auto chat (shorthand cho spec 1)
2. **Sequences** — Embed/list link đến drip campaigns (spec 5)
3. **Triggers** — CRUD triggers (event-based, keyword, schedule)
4. **Reports** — Embed/link đến automation history (spec 4)

## 3. Architecture

### 3A. Trang Lead Pool — `/lead-pool` (đã có)

**Trang nhận khách** = Lead Pool Dashboard. Đã có ở `/lead-pool` (route standalone). Xem các file:
- `frontend/src/views/marketing/LeadPoolView.vue` (đã có)
- `backend/src/modules/lead-pool/` (đã có)

### 3B. Trang Automation — `/automation` (mới)

**Route:** Thêm vào `frontend/src/router/index.ts`:

```typescript
{ path: '/automation', name: 'Automation',
  component: () => import('@/views/automation/AutomationHubView.vue'),
  meta: { requiresAuth: true } }
```

**Layout:**
```
┌─ Automation Hub ────────────────────────────────────────┐
│ Trang quản lý tất cả tự động hóa marketing             │
│                                                          │
│ ┌─ Tabs ─────────────────────────────────────────────┐  │
│ │ [Auto Reply] [Sequences] [Triggers] [Reports]      │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ Tab Auto Reply:                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Rules:                                              │ │
│ │  ☑ Chào khách mới        Trigger: keyword "xin chào" │ │
│ │  ☑ Sau 24h không rep     Trigger: time_window        │ │
│ │  ☐ Khuyến mãi cuối tuần  Trigger: weekly             │ │
│ │                                                     │ │
│ │                          [+ Tạo rule mới]           │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Tab Sequences:                                            │
│   Nhúng danh sách sequences (hoặc link đến /marketing/sequences)
│                                                          │
│ Tab Triggers:                                            │
│   Table of triggers với CRUD                            │
│                                                          │
│ Tab Reports:                                             │
│   Link đến /reports/automation                          │
└──────────────────────────────────────────────────────────┘
```

### 3C. Auto Reply Rules Tab

UI lấy từ spec 1 (`2026-07-22-ai-fix-auto-chat-settings.md`):
- Bảng rules với columns: Name | Trigger | Action | Enabled | Actions
- Add/Edit/Delete buttons
- Mỗi rule: trigger config (keyword/regex/tag/time) + action config

API endpoints (từ spec 1):
- `GET /api/v1/ai/auto-reply`
- `POST /api/v1/ai/auto-reply`
- `PUT /api/v1/ai/auto-reply/:id`
- `DELETE /api/v1/ai/auto-reply/:id`

### 3D. Sequences Tab

Nhúng danh sách sequences từ `/marketing/sequences`:
- Hoặc embed view trực tiếp (gọi component `<SequencesView>`)
- Hoặc hiển thị summary cards + "Quản lý chi tiết" button → link `/marketing/sequences`

**Recommendation:** Dùng embed với `<router-link>` cho UX liền mạch.

### 3E. Triggers Tab

`AutomationTrigger` đã có trong Prisma schema (xem `backend/prisma/schema.prisma` line 2515).

**Cần tạo:**
- Backend module `backend/src/modules/automation/trigger-routes.ts` + `trigger-service.ts`
- Frontend `frontend/src/components/automation/TriggerList.vue` + `TriggerFormDialog.vue`

**Trigger types supported:**
- `event` — triggered by system event (new friend, message received)
- `keyword` — keyword in message
- `schedule` — at specific date/time
- `manual` — only via API call

**API endpoints:**
- `GET /api/v1/automation/triggers`
- `POST /api/v1/automation/triggers`
- `PUT /api/v1/automation/triggers/:id`
- `DELETE /api/v1/automation/triggers/:id`

### 3F. Reports Tab

Link/iframe đến `/reports/automation`. Xem spec riêng.

## 4. API Endpoints

Tổng hợp (một số đã có ở các spec khác):

| Module | Endpoint | Spec |
|--------|----------|------|
| Auto Reply | `/api/v1/ai/auto-reply` (CRUD) | spec 1 |
| Sequences | `/api/v1/sequences` (CRUD) | spec 5 |
| Triggers | `/api/v1/automation/triggers` (CRUD) | **mới (spec này)** |
| Reports | `/api/v1/reports/automation/history` | spec 4 |

## 5. Files to Create/Modify

### Create (backend)
- `backend/src/modules/automation/trigger-routes.ts`
- `backend/src/modules/automation/trigger-service.ts`
- `backend/src/modules/automation/automation-hub-routes.ts` (optional, để aggregate)

### Create (frontend)
- `frontend/src/views/automation/AutomationHubView.vue`
- `frontend/src/components/automation/AutoReplyRulesTab.vue`
- `frontend/src/components/automation/SequencesSummaryTab.vue`
- `frontend/src/components/automation/TriggerListTab.vue`
- `frontend/src/components/automation/ReportsLinkTab.vue`
- `frontend/src/api/automation.ts`

### Modify
- `frontend/src/router/index.ts` — add `/automation` route standalone
- `backend/src/app.ts` — register `trigger-routes`

## 6. Testing

- Manual: Navigate to `/automation` → all 4 tabs work
- Auto Reply tab: Create rule → verify saves → check active behavior
- Sequences tab: Embedded list shows all sequences
- Triggers tab: CRUD triggers
- Reports tab: Link opens `/reports/automation`

## 7. Migrations

Không cần migration mới — `AutomationTrigger` đã có trong schema. Chỉ cần build route + UI.