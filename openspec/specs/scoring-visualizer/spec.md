# scoring-visualizer Specification

## Purpose
TBD - created by archiving change add-scoring-visualizer-and-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Tab "Điểm & Tín hiệu" trong ContactProfileView
ContactProfileView MUST have a tab "Điểm & Tín hiệu" showing:
- Current priorityScore (big number)
- Trendline 30 ngày (sparkline Chart.js)
- Top 10 signals (table: signal key, dimension, delta, timestamp, reason)
- Median comparison text ("Cao hơn 65% KH cùng phân khúc")

#### Scenario: Contact có 30 signals, score 75
- **WHEN** user opens contact A's profile and clicks tab "Điểm & Tín hiệu"
- **THEN** page renders in <500ms showing:
  - priorityScore: 75
  - trendline chart with 30 points
  - 10 most recent signals (signal_key, dimension, delta, timestamp, reason)
  - "Cao hơn 65% KH cùng phân khúc"

### Requirement: Trendline endpoint
`GET /api/v1/contacts/:id/scoring/trend?days=30` MUST return array of `{ date: ISO, score: number }` for the last N days. Days with no score change MUST be included as `{ date, score: <last-known score> }`.

#### Scenario: 30 days trendline
- **WHEN** user GETs trend endpoint with days=30
- **THEN** response is `{ points: [{date: '2026-06-21', score: 50}, ..., {date: '2026-07-21', score: 75}] }`
- **AND** array has exactly 30 entries

### Requirement: Top signals endpoint
`GET /api/v1/contacts/:id/scoring/signals?limit=10` MUST return the most recent N signals (sorted by timestamp desc), each with `{ signalKey, dimension, delta, timestamp, reason }`.

#### Scenario: 50 signals → top 10
- **WHEN** contact has 50 signals in scoring history
- **THEN** endpoint returns the 10 most recent (last 10)

### Requirement: Tooltip giải thích signal
Hovering a signal row MUST show a tooltip explaining the signal key in plain Vietnamese (e.g., "Reply trong 5 phút → +5 điểm dimension response").

#### Scenario: Tooltip cho signal "fast_reply"
- **WHEN** user hovers a row with signalKey='fast_reply'
- **THEN** tooltip shows: "Reply trong 5 phút → +5 điểm dimension 'response'"

### Requirement: Median comparison text
The tab MUST display a comparison text comparing the contact's score to median of contacts with the same `engagementPattern` (cooling/cold/warm/hot).

#### Scenario: So sánh với median
- **WHEN** contact A has score=75 and engagementPattern='hot' AND median of 'hot' = 45
- **THEN** text reads: "Cao hơn 95% KH cùng phân khúc (hot)"

