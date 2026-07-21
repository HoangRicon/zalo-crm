# Design: Scoring Visualizer + Journey Funnel + Pipeline Kanban

> Parent: [proposal.md](../proposal.md)

---

## Schema Changes

**0 migration** — reuse Contact.status, ActivityLog, scoring signals.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Vue 3)                                         │
│  ContactProfileView.vue (MODIFY):                        │
│    + ScoringTab.vue (NEW)            ← Capability 1     │
│      Chart.js sparkline + signals table + tooltip       │
│                                                         │
│  /reports/journey (NEW):                                │
│    + JourneyFunnelView.vue (NEW)     ← Capability 2     │
│    + JourneyStageDetailView.vue (NEW)                   │
│                                                         │
│  /marketing/pipeline (NEW):                             │
│    + PipelineKanbanView.vue (NEW)    ← Capability 3     │
│    + KanbanCard.vue (NEW)                               │
│    + KanbanColumn.vue (NEW)                             │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│ Backend (Fastify)                                        │
│  contacts/scoring-routes.ts (NEW):                      │
│    GET /contacts/:id/scoring/trend?days=30              │
│    GET /contacts/:id/scoring/signals?limit=10           │
│                                                         │
│  reports/journey-routes.ts (NEW):                       │
│    GET /reports/journey                  ← Capability 2 │
│    GET /reports/journey/:stage          ← drill-down    │
│                                                         │
│  contacts/pipeline-routes.ts (NEW):                     │
│    PATCH /contacts/:id/status { status, reason }        │
│    GET /contacts?status=new|nurturing|...               │
│    (existing contact-routes có sẵn, mở rộng filter)    │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: Trendline dùng scoring_history table nếu có, fallback aggregate từ signals
Nếu schema có `ScoringSnapshot` (daily snapshot) → dùng trực tiếp. Nếu không → aggregate từ `signals` JSON field. **Hiện tại chưa có snapshot table** → tạo helper `aggregateTrendFromSignals(contactId, days)`.

### D2: Funnel aggregation on-demand, cache 5 phút
Mỗi lần user mở /reports/journey → query tất cả contacts + count stage → cache 5 phút. Org có 1000 contacts → query ~200ms.

### D3: Pipeline Kanban chỉ 1 contact update mỗi lần kéo
PUT /contacts/:id/status gọi 1 API. Nếu user kéo nhiều card liên tục → debounce 200ms.

### D4: Stage mapping hard-coded trong FE
6 stages cố định. Nếu user muốn custom → Phase sau.

### D5: Chart.js đã có sẵn (dùng cho dashboard)
Reuse chartjs, không thêm dep.

---

## Sequence: Kanban Drag

```
User (FE)                    Fastify                DB
   │                            │                    │
   │ drag card col1→col2        │                    │
   ├── PUT /contacts/:id/status │                    │
   │   { status: 'col2' }       │                    │
   ├──────────────────────────► │                    │
   │                            │ UPDATE status      │
   │                            ├───────────────────►│
   │                            │ INSERT ActivityLog │
   │                            ├───────────────────►│
   │  200 OK                    │                    │
   │◄──────────────────────────┤                    │
   │                            │                    │
```

---

## File Structure

### Files CREATE (8)
- `backend/src/modules/contacts/scoring-routes.ts`
- `backend/src/modules/reports/journey-routes.ts`
- `backend/src/modules/contacts/pipeline-routes.ts` (optional, có thể add vào contact-routes)
- `frontend/src/components/contacts/ScoringTab.vue`
- `frontend/src/views/reports/JourneyFunnelView.vue`
- `frontend/src/views/reports/JourneyStageDetailView.vue`
- `frontend/src/views/marketing/PipelineKanbanView.vue`
- `frontend/src/components/kanban/KanbanCard.vue`

### Files MODIFY (3)
- `frontend/src/views/contacts/ContactProfileView.vue` (+ScoringTab)
- `frontend/src/router/index.ts` (+2 routes)

---

## Verification

- Backend typecheck OK
- Frontend typecheck OK
- E2E test 1 contact mở tab → trendline + signals hiển thị
- E2E test journey → 6 stages render với counts
- E2E test pipeline → drag card → status update + persist