# Spec: Churn Risk Detector

> Parent: [proposal.md](../proposal.md)

## ADDED Requirements

### Requirement: Schema ChurnRiskScore
`ChurnRiskScore` MUST exist with fields: id, orgId, contactId, riskLevel ('low'|'medium'|'high'), reasons (Json array<string>), suggestedAction (String?), source ('ai'|'rule_based'), scoredAt (DateTime), expiresAt (DateTime).

#### Scenario: Migration tạo bảng
- **WHEN** migration runs
- **THEN** table churn_risk_scores exists with the fields above
- **AND** index on (orgId, riskLevel, scoredAt) for dashboard query

### Requirement: Cron nightly scan
A cron MUST run at 02:00 VN every night. For each org, it MUST scan contacts where `engagementPattern` ∈ {cooling, cold} AND `lastInteractionAt` is between 14-90 days ago. For each matched contact, it MUST compute churn risk (via AI or rule-based) and upsert a `ChurnRiskScore` with `expiresAt = now + 24h`.

#### Scenario: Cron pick 50 KH cooling/cold
- **WHEN** org has 50 contacts with engagementPattern='cooling' AND lastInteractionAt > 14 days ago
- **THEN** cron processes all 50, creating 50 ChurnRiskScore rows (or upserting existing)
- **AND** rows have expiresAt = now + 24h

#### Scenario: Skip KH active trong 14 ngày
- **WHEN** contact has lastInteractionAt < 14 days ago
- **THEN** cron skips this contact (no ChurnRiskScore row created)

### Requirement: AI-based scoring
For each contact, the AI prompt MUST ask: "Đọc 10 tin nhắn gần nhất, đánh giá nguy cơ KH rời bỏ (low/medium/high) và đề xuất hành động tiếp theo. Trả JSON strict: { riskLevel, reasons[], suggestedAction }."

#### Scenario: AI returns high risk
- **WHEN** AI returns `{ riskLevel: 'high', reasons: ['No reply 30 days', 'Sentiment declining'], suggestedAction: 'Gửi tin chăm sóc đặc biệt' }`
- **THEN** ChurnRiskScore row is created with riskLevel='high', reasons=['No reply 30 days', 'Sentiment declining'], suggestedAction=...

#### Scenario: AI timeout 10s → fallback
- **WHEN** AI call times out
- **THEN** system uses rule-based fallback (see REQ below) and marks source='rule_based'

### Requirement: Rule-based fallback
The fallback MUST compute:
- `daysSinceLastInteraction > 30` → riskLevel='high'
- `daysSinceLastInteraction > 14` (and ≤30) → riskLevel='medium'
- else → riskLevel='low'
- If avg sentiment in last 10 messages < 0.3 → upgrade riskLevel by 1 step
- `suggestedAction` MUST be a Vietnamese sentence based on level: 'Gửi tin chăm sóc', 'Giảm tần suất gửi', v.v.

#### Scenario: Fallback high risk
- **WHEN** contact has lastInteractionAt = 35 days ago
- **THEN** ChurnRiskScore row has riskLevel='high', source='rule_based', suggestedAction='Gửi tin chăm sóc đặc biệt'

#### Scenario: Fallback sentiment upgrade
- **WHEN** contact daysSinceLastInteraction = 16 (medium) BUT avg sentiment = 0.2 (< 0.3)
- **THEN** riskLevel becomes 'high' (upgraded)

### Requirement: Dashboard widget
The Dashboard MUST show a "Top 10 KH có nguy cơ rời bỏ" widget. It MUST query `ChurnRiskScore` where `orgId = current, expiresAt > now, riskLevel = 'high'` order by scoredAt desc limit 10.

#### Scenario: Widget render 10 KH
- **WHEN** org has 15 high-risk contacts scored within last 24h
- **THEN** widget shows top 10 (most recent scoredAt first)
- **AND** each row shows: contact name, daysSinceLastInteraction, score age (e.g., "2h ago"), suggestedAction

#### Scenario: Click row → mở profile
- **WHEN** user clicks a row
- **THEN** navigate to `/contacts/:contactId` (or ContactProfileView)

### Requirement: Cache trong 24h
`ChurnRiskScore.expiresAt` MUST be 24h after `scoredAt`. Dashboard query MUST filter `expiresAt > now`. Expired rows MAY stay in DB for audit but are not shown.

#### Scenario: Expired row ẩn
- **WHEN** row has expiresAt < now
- **THEN** widget excludes it (next cron will rerun and create new row)