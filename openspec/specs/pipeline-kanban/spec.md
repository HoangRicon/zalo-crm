# pipeline-kanban Specification

## Purpose
TBD - created by archiving change add-scoring-visualizer-and-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Pipeline Kanban view
A new route `/marketing/pipeline` MUST show a Kanban board with 6 columns:
1. Mới (default for new contacts)
2. Đang nuôi
3. Quan tâm
4. Lên lịch
5. Chốt
6. Chăm sóc sau

Each column MUST list contact cards with: name, priorityScore, daysSinceLastInteraction, owner.

#### Scenario: Kanban render
- **WHEN** user opens /marketing/pipeline
- **THEN** 6 columns are shown
- **AND** each column lists up to 20 contacts (with "Xem thêm" link for more)

### Requirement: Drag-and-drop status update
Dragging a card from column X to column Y MUST update the contact's `status` to Y and write an ActivityLog entry.

#### Scenario: Kéo Quan tâm → Lên lịch
- **WHEN** user drags contact card from "Quan tâm" column to "Lên lịch" column
- **THEN** PUT /api/v1/contacts/:id with `{ status: 'appointment_scheduled' }` is called
- **AND** ActivityLog entry is created: `{ action: 'status_change', from: 'interested', to: 'appointment_scheduled', actor: currentUser }`
- **AND** the card moves visually to the new column

### Requirement: Optimistic update + rollback on error
Drag MUST apply optimistically. If API fails, the card MUST snap back to original column and a toast error appears.

#### Scenario: API fail rollback
- **WHEN** drag succeeds locally but PUT /contacts/:id returns 500
- **THEN** the card animates back to original column
- **AND** toast: "Không cập nhật được, thử lại"

### Requirement: Filters
The Kanban MUST support filters: owner (single), score range (min-max), source (channel/lead_ads/friend).

#### Scenario: Filter by owner
- **WHEN** user selects "Owner: Nguyễn A"
- **THEN** all columns show only contacts where owner=Nguyễn A
- **AND** filter persists across page reloads (URL query param)

### Requirement: Stage labels mapping
The 6 frontend columns MUST map to Contact.status enum:
- Mới → 'new'
- Đang nuôi → 'nurturing'
- Quan tâm → 'interested'
- Lên lịch → 'appointment_scheduled'
- Chốt → 'closed_won'
- Chăm sóc sau → 'post_sale'

#### Scenario: Status mapping
- **WHEN** user drags to "Chốt"
- **THEN** contact.status = 'closed_won' (camelCase string)
- **AND** column "Chốt" displays "Chốt" label

