# Spec: AI Campaign Studio

> Parent: [proposal.md](../proposal.md)

## ADDED Requirements

### Requirement: AI plan endpoint
`POST /api/v1/ai/plan-campaign` MUST accept `{ userGoal: string }` and return `{ plan: { audience, messages, schedule, kpi, risks }, source: 'ai' | 'fallback' }`. Timeout 8s.

#### Scenario: Plan với goal rõ ràng
- **WHEN** user POSTs `{ userGoal: "Bán căn 3PN Q7 cho KH quan tâm tháng trước" }`
- **THEN** response has plan với:
  - audience: `{ segments: ['priorityScore > 50', 'lastInteraction < 30d'] }`
  - messages: 3 variants A/B/C, mỗi cái ≤200 chars, có `{{ten}}`
  - schedule: `{ frequency: 'once', sendAtISO: <next T2 9h> }`
  - kpi: `{ expectedReplyRate: 0.15, expectedReach: 200 }`
  - risks: ['KH cooling có thể bị block', '...']

#### Scenario: AI timeout 8s → fallback
- **WHEN** AI takes >8s
- **THEN** endpoint returns `source: 'fallback'` với plan dựa trên rule-based:
  - audience: `priorityScore > 50, lastInteraction < 30d`
  - messages: 3 from ContentBlocks random
  - schedule: next Mon 9am
  - kpi: `expectedReplyRate = 0.10 (default)`
  - risks: ['AI disabled, KPI chỉ là ước lượng']

### Requirement: CampaignPlan persistence
The endpoint MUST persist plan trong `CampaignPlan` table, return `id` để FE có thể review lại.

#### Scenario: Plan saved
- **WHEN** user calls plan endpoint
- **THEN** CampaignPlan row created với plan JSON + userGoal
- **AND** response includes `planId: '...'`

### Requirement: Apply plan to campaign
`POST /api/v1/ai/plan-campaign/:id/apply` MUST create a BroadcastJob using the plan's audience + messages + schedule. Returns the new jobId.

#### Scenario: Apply plan → tạo BroadcastJob
- **WHEN** user POSTs /plan-campaign/<id>/apply
- **THEN** BroadcastJob created với:
  - name = <first 30 chars of userGoal>
  - customerListId = (lookup hoặc tạo Target list từ filters)
  - messageText = plan.messages[0]
  - scheduleType = 'once'
  - scheduledAt = plan.schedule.sendAtISO
- **AND** CampaignPlan.appliedToJobId = new jobId

### Requirement: AI Studio UI
A new route `/marketing/ai-studio` MUST show:
- Big textarea cho userGoal
- Submit button "✨ Lên kế hoạch"
- Plan display: 5 cards (audience / messages / schedule / kpi / risks)
- "Tạo campaign từ plan này" button (after plan loaded)

#### Scenario: Studio flow
- **WHEN** user enters "Bán căn 3PN Q7 cho KH quan tâm tháng trước" + click "Lên kế hoạch"
- **THEN** within 8s plan displays
- **AND** user can click "Tạo campaign" → toast "Đã tạo broadcast job #X" → navigate to /marketing/broadcasts