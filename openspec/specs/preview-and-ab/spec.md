# preview-and-ab Specification

## Purpose
TBD - created by archiving change add-broadcast-ab-and-heatmap. Update Purpose after archive.
## Requirements
### Requirement: Preview modal trước khi gửi
The create-broadcast modal MUST show a "Xem trước" button before submit. Clicking it MUST open a preview panel showing 3 sample recipients from the chosen list (or 3 random friends if sourceType='friends') with their rendered message text (variables `{{ten}}`, `{{sdt}}` substituted).

#### Scenario: Preview với customer_list source
- **WHEN** user clicks "Xem trước" with sourceType='customer_list', customerListId='A', and messageText="Xin chào {{ten}}, chúng tôi có căn 3PN phù hợp"
- **THEN** preview panel shows 3 sample entries from list A (the first 3 by rowIndex)
- **AND** each sample displays the rendered message (e.g., "Xin chào Nguyễn Văn A, chúng tôi có căn 3PN phù hợp")
- **AND** if any sample has missing `name`, the rendered text substitutes "bạn"

#### Scenario: Preview với friends source
- **WHEN** user clicks "Xem trước" with sourceType='friends' and zaloAccountId='Z'
- **THEN** preview panel shows 3 random friends of account Z (or first 3 if <3)
- **AND** each sample's rendered message uses their zaloName as `{{ten}}`

### Requirement: A/B test mode
The create-broadcast modal MUST support an A/B mode toggle. When enabled, user MUST select 2-3 message variants (each variant = own messageText or own set of contentBlockIds). The system MUST randomly assign each recipient to a group ('A', 'B', 'C') so that group sizes are equal (within 1 recipient of each other).

#### Scenario: Toggle A/B mode với 2 variants
- **WHEN** user toggles A/B on and adds 2 variants (variant A: "Tin A", variant B: "Tin B")
- **THEN** the form shows 2 variant cards, each with its own messageText/imageUrl/contentBlockIds
- **AND** the submit button label changes to "Tạo broadcast A/B (2 variants)"

#### Scenario: Chia đều đối tượng với 100 KH
- **WHEN** A/B mode is enabled with 2 variants and the run starts with 100 recipients
- **THEN** 50 recipients are assigned abGroupId='A' and 50 are assigned abGroupId='B' (or 50/50 within ±1)
- **AND** the assignment is random but seeded for reproducibility (same seed → same split for same run)

#### Scenario: A/B mode với 3 variants
- **WHEN** user enables A/B and adds 3 variants with 100 recipients
- **THEN** groups are split ~33/33/34 (or 34/33/33, depending on assignment order)

### Requirement: Persist A/B config vào BroadcastJob
The `BroadcastJob` MUST store `abMode` ('off' | 'ab_split') and `abVariantCount` (2 or 3). Each variant's message text MUST be stored in `BroadcastJob.messageText` (variant A) and a new `BroadcastJob.variantMessageTexts` JSON array (variants B, C).

#### Scenario: Lưu A/B job
- **WHEN** user submits A/B broadcast with 2 variants
- **THEN** BroadcastJob.abMode='ab_split' and abVariantCount=2
- **AND** BroadcastJob.messageText = variant A's messageText
- **AND** BroadcastJob.variantMessageTexts = JSON string of [variant B's messageText]
- **AND** when the run starts, each BroadcastRunItem gets abGroupId='A'/'B' and the rendered message from the matching variant

### Requirement: Hiển thị A/B results trên report card
The broadcast report card MUST show response rate per A/B group (e.g., "A: 12% reply | B: 8% reply") if abMode='ab_split'.

#### Scenario: Report card với A/B
- **WHEN** user views the report of an A/B run with 100 items (50 in A, 50 in B) and 10 replies (7 in A, 3 in B)
- **THEN** the card shows: "Tỉ lệ reply: A=14%, B=6%, tổng=10%"
- **AND** highlights the winner group (A) with a "🏆" badge

