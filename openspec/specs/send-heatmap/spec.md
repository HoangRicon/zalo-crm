# send-heatmap Specification

## Purpose
TBD - created by archiving change add-broadcast-ab-and-heatmap. Update Purpose after archive.
## Requirements
### Requirement: Heatmap endpoint
`GET /api/v1/broadcast/heatmap?days=30` MUST return a matrix of `[24 hours][7 days]` of aggregated response rate. Each cell MUST include: responseRate (0-1), sampleCount (number of broadcasts in that slot), and averageReplyTime (ms).

#### Scenario: Endpoint trả JSON hợp lệ
- **WHEN** user calls GET /broadcast/heatmap?days=30 with at least 30 days of broadcast history
- **THEN** response is `{ days: 30, matrix: Array<{hour: number, dayOfWeek: number, rate: number, count: number, avgReplyMs: number}>, totalBroadcasts: N, generatedAt: ISO }`
- **AND** matrix has 24*7 = 168 cells

#### Scenario: Org mới chưa có data
- **WHEN** org has 0 broadcast runs
- **THEN** response is `{ days: 30, matrix: [], totalBroadcasts: 0 }` (status 200, not 404)

### Requirement: Cache heatmap 1 giờ
The heatmap endpoint MUST cache results per orgId for 60 minutes (to avoid recomputing aggregation on every dashboard load).

#### Scenario: First call chậm, subsequent calls nhanh
- **WHEN** first GET takes 800ms, subsequent GETs within 60 minutes
- **THEN** cached responses return in <50ms with header `X-Cache: HIT`

### Requirement: Heatmap UI widget
BroadcastsView dashboard MUST include a heatmap widget at the top showing the 24x7 matrix as a colored grid. Days (T2-CN) on Y-axis, hours (0-23) on X-axis. Color: red=0%, yellow=10%, green≥20%.

#### Scenario: Heatmap render với data thật
- **WHEN** org has 30 days of broadcast history
- **THEN** widget shows a 24x7 colored grid
- **AND** hovering a cell shows tooltip: "T2 9h: 15% reply (12 broadcasts, avg reply 8 phút)"

#### Scenario: Heatmap với data ít
- **WHEN** org has <5 broadcasts total
- **THEN** widget shows empty state: "Chưa đủ dữ liệu để gợi ý khung giờ. Cần ≥5 broadcasts."
- **AND** a "Cấu hình giờ gửi thủ công" link is visible

### Requirement: Gợi ý giờ gửi tốt nhất
The heatmap widget MUST highlight the top-3 cells (best response rate, min 3 samples) as "Gợi ý gửi" badges.

#### Scenario: Top-3 suggestion
- **WHEN** top-3 cells have rates 25%, 22%, 19%
- **THEN** widget shows "🎯 Gợi ý gửi: T2 9h (25%), T3 10h (22%), T5 8h (19%)"
- **AND** clicking a suggestion opens a tooltip with details

