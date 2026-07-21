# reply-tracking Specification

## Purpose
TBD - created by archiving change add-broadcast-ab-and-heatmap. Update Purpose after archive.
## Requirements
### Requirement: Schema fields cho reply tracking
`BroadcastRunItem` MUST have `replyMessageId` (String?, FK to Message.id), `repliedAt` (DateTime?), and `abGroupId` (String?, values 'A'/'B'/'C'/null).

#### Scenario: Migration tạo 3 cột mới
- **WHEN** migration runs
- **THEN** table broadcast_run_items has 3 new columns: reply_message_id (text, nullable), replied_at (timestamptz, nullable), ab_group_id (varchar(2), nullable)
- **AND** index on (run_id, ab_group_id) for fast A/B aggregation

### Requirement: Tự động set repliedAt khi KH reply
The message-receive handler MUST check if an inbound message belongs to a recipient who received a broadcast within the last 7 days and hasn't replied yet. If yes, the corresponding `BroadcastRunItem` MUST be updated with `replyMessageId=<message.id>` and `repliedAt=<message.createdAt>`.

#### Scenario: Reply sau broadcast 10 phút
- **WHEN** user sends broadcast at 10:00 to entry X, and X replies at 10:10
- **THEN** the BroadcastRunItem for X has repliedAt=10:10 and replyMessageId=<reply msg id>
- **AND** the responseRate counter increments

#### Scenario: Reply sau 14 ngày (ngoài window)
- **WHEN** user sends broadcast on day 1, and recipient replies on day 15
- **THEN** NO update happens (window is 7 days)
- **AND** the reply is treated as a normal inbound message, not linked to broadcast

#### Scenario: Multiple replies từ cùng KH
- **WHEN** recipient X replies twice after broadcast (e.g., 10:10 and 10:15)
- **THEN** only the FIRST reply updates repliedAt (subsequent replies are ignored for responseRate)
- **AND** the second reply still appears in the conversation as normal

### Requirement: responseRate calculation
The broadcast report MUST compute `responseRate = count(items where repliedAt != null) / count(items where status='sent')`. This MUST be exposed in `GET /api/v1/broadcast/runs/:id/report`.

#### Scenario: Report của run có 100 sent, 10 replies
- **WHEN** user calls GET /broadcast/runs/:id/report
- **THEN** response includes `{ responseRate: 0.10, repliedCount: 10, sentCount: 100 }`

#### Scenario: Report của A/B run
- **WHEN** run has abMode='ab_split', 50 in A with 7 replies, 50 in B with 3 replies
- **THEN** response includes `{ responseRate: 0.10, groups: [{group: 'A', rate: 0.14}, {group: 'B', rate: 0.06}] }`

### Requirement: UI hiển thị "Tỉ lệ reply" trên run card
The BroadcastsView run card MUST display responseRate as a percentage badge (e.g., "10% reply"). Color: red <5%, yellow 5-15%, green >15%.

#### Scenario: Card run có 15% reply
- **WHEN** run has responseRate=0.15
- **THEN** the card shows a green badge "15% reply"

