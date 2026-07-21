# Tasks: Scoring Visualizer + Journey + Pipeline

---

## Phase 1 — Backend endpoints (1 ngày)

### 1.1. Scoring trend endpoint
- **File**: `C:backend/src/modules/contacts/scoring-routes.ts`
- **Nội dung**: GET /contacts/:id/scoring/trend?days=30 — aggregate từ signals JSON
- **Verify**: unit test

### 1.2. Scoring signals endpoint
- **File**: `M:backend/src/modules/contacts/scoring-routes.ts`
- **Nội dung**: GET /contacts/:id/scoring/signals?limit=10
- **Verify**: unit test

### 1.3. Journey aggregation endpoint
- **File**: `C:backend/src/modules/reports/journey-routes.ts`
- **Nội dung**: GET /reports/journey — 6 stages + counts + conversion + avg duration
- **Verify**: unit test

### 1.4. Journey drill-down endpoint
- **File**: `M:backend/src/modules/reports/journey-routes.ts`
- **Nội dung**: GET /reports/journey/:stage — contacts ở stage đó
- **Verify**: unit test

### 1.5. Pipeline status update
- **File**: `M:backend/src/modules/contacts/contact-routes.ts`
- **Nội dung**: thêm filter ?status=... vào GET /contacts
- **Verify**: curl

---

## Phase 2 — Scoring Visualizer UI (1 ngày)

### 2.1. ScoringTab component
- **File**: `C:frontend/src/components/contacts/ScoringTab.vue`
- **Nội dung**: priorityScore + Chart.js sparkline + signals table + median text
- **Verify**: UI render

### 2.2. Wire vào ContactProfileView
- **File**: `M:frontend/src/views/contacts/ContactProfileView.vue`
- **Nội dung**: thêm tab "Điểm & Tín hiệu", mount ScoringTab
- **Verify**: UI flow

### 2.3. Signal tooltip explanation
- **File**: `M:frontend/src/components/contacts/ScoringTab.vue`
- **Nội dung**: map signalKey → Vietnamese description
- **Verify**: UI

---

## Phase 3 — Journey Funnel UI (1 ngày)

### 3.1. JourneyFunnelView
- **File**: `C:frontend/src/views/reports/JourneyFunnelView.vue`
- **Nội dung**: 6 stages với count/conversion/avg duration + drop-off highlight
- **Verify**: UI render

### 3.2. JourneyStageDetailView
- **File**: `C:frontend/src/views/reports/JourneyStageDetailView.vue`
- **Nội dung**: table contacts ở stage
- **Verify**: UI

### 3.3. Router route
- **File**: `M:frontend/src/router/index.ts`
- **Nội dung**: +/reports/journey + /reports/journey/:stage
- **Verify**: navigate

---

## Phase 4 — Pipeline Kanban (1.5 ngày)

### 4.1. KanbanCard component
- **File**: `C:frontend/src/components/kanban/KanbanCard.vue`
- **Nội dung**: contact name, score, days, owner, draggable
- **Verify**: UI render

### 4.2. PipelineKanbanView
- **File**: `C:frontend/src/views/marketing/PipelineKanbanView.vue`
- **Nội dung**: 6 columns + drag-drop logic + filters
- **Verify**: UI flow

### 4.3. Drag-drop + status update
- **File**: `M:frontend/src/views/marketing/PipelineKanbanView.vue`
- **Nội dung**: HTML5 drag-drop API, optimistic update, rollback on error
- **Verify**: e2e manual

### 4.4. Router route
- **File**: `M:frontend/src/router/index.ts`
- **Nội dung**: +/marketing/pipeline
- **Verify**: navigate

---

## Phase 5 — Verification (0.5 ngày)

### 5.1. Backend typecheck
### 5.2. Frontend typecheck
### 5.3. E2E manual (3 flows: Scoring tab, Journey, Pipeline drag)