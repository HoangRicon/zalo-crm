# Spec: Customer Journey Funnel

> Parent: [proposal.md](../proposal.md)

## ADDED Requirements

### Requirement: Journey Funnel view
A new route `/reports/journey` MUST show a funnel visualization with 6 stages:
1. First Contact (lần đầu nhắn)
2. Friend Accept (KH đồng ý kết bạn)
3. First Reply (KH reply lần đầu)
4. Quote (có báo giá)
5. Appointment (có lịch hẹn xem)
6. Closed (đã chốt)

#### Scenario: Funnel render
- **WHEN** user navigates to /reports/journey
- **THEN** page shows 6 stages stacked vertically (or horizontal funnel)
- **AND** each stage shows: stage name, count of contacts, % of previous stage, avg time spent in stage

### Requirement: Journey aggregation endpoint
`GET /api/v1/reports/journey` MUST return `{ stages: [{ stage, count, conversionRate, avgDurationMs }] }` aggregated across all contacts in org (default last 90 days).

#### Scenario: 100 contacts → funnel
- **WHEN** org has 100 contacts in last 90 days
- **THEN** response has 6 stages with counts:
  - First Contact: 100 (100%)
  - Friend Accept: 70 (70%)
  - First Reply: 50 (71%)
  - Quote: 30 (60%)
  - Appointment: 20 (67%)
  - Closed: 10 (50%)

### Requirement: Drill-down contacts ở stage
Clicking a stage MUST navigate to `/reports/journey/:stage` showing a list of contacts currently at or past this stage but not yet at the next.

#### Scenario: Click stage Quote
- **WHEN** user clicks "Quote" stage
- **THEN** navigate to /reports/journey/quote
- **AND** show list of contacts having Quote but NOT Appointment yet

### Requirement: Heatmap "rơi" (drop-off)
The funnel MUST highlight the stage with highest drop-off (largest absolute count loss vs previous) with a red border.

#### Scenario: Highlight drop-off
- **WHEN** Friend Accept → First Reply drops from 70 to 50 (loss 20, biggest)
- **THEN** stage "First Reply" has red border + "🔥 -20 KH rời" badge