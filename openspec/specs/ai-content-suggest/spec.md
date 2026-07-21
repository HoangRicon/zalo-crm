# ai-content-suggest Specification

## Purpose
TBD - created by archiving change add-ai-content-suggest-and-churn. Update Purpose after archive.
## Requirements
### Requirement: AI suggest endpoint
`POST /api/v1/ai/suggest-content-blocks` MUST accept `{ userIntent: string, count?: number }` and return `{ suggestions: Array<{ name: string, messageText: string, imageKeyword?: string }>, source: 'ai' | 'fallback' }`. The system MUST respect the configured AI provider (per-org) and timeout after 8 seconds.

#### Scenario: Suggest với 1 intent
- **WHEN** user POSTs `{ userIntent: "Gửi cho KH quan tâm căn 3PN quận 7" }`
- **THEN** response has 3-5 suggestions
- **AND** each suggestion.messageText ≤ 200 chars
- **AND** each suggestion contains `{{ten}}` placeholder

#### Scenario: Timeout 8s → fallback
- **WHEN** AI provider takes >8s (mock slow response)
- **THEN** endpoint returns `{ suggestions: [...3 hardcoded...], source: 'fallback' }` with status 200

#### Scenario: AI quota exceeded → fallback
- **WHEN** AI service throws `quota_exceeded` error
- **THEN** endpoint returns fallback 3 templates + `source: 'fallback'`

### Requirement: Frontend "AI gợi ý" button
ContentBlocksView MUST show a "✨ AI gợi ý" button next to the create form. Clicking opens a modal with input `userIntent` + count selector (3-5). Submitting calls the endpoint and displays results in a list where each item has a "Chọn" button.

#### Scenario: Modal flow
- **WHEN** user clicks "AI gợi ý", enters "Tin nhắn cho KH quan tâm tháng trước", submits
- **THEN** within 5s modal shows 3-5 suggestions
- **AND** clicking "Chọn" on suggestion #2 fills the create form with `name=#2.name, messageText=#2.messageText`
- **AND** modal closes

#### Scenario: AI tắt trong settings
- **WHEN** org has AI disabled (provider='off' trong app_settings)
- **THEN** button still works, fallback templates shown with note "🤖 AI tắt — dùng template có sẵn"

### Requirement: Fallback templates
The fallback MUST be 3 Vietnamese templates relevant to BĐS:
1. "Mở bán" — giới thiệu dự án mới
2. "Tái khách" — nhắc lại KH cũ
3. "Giới thiệu dự án" — share thông tin dự án

Each MUST have `{{ten}}` placeholder and ≤200 chars.

#### Scenario: Fallback structure
- **WHEN** AI fail
- **THEN** 3 hardcoded templates returned:
  - name="Mở bán", text="Chào {{ten}}, bên em vừa mở bán căn 3PN view sông tại Q7..."
  - name="Tái khách", text="Anh/chị {{ten}} ơi, lâu rồi chưa ghé, bên em có căn phù hợp..."
  - name="Giới thiệu dự án", text="Xin chào {{ten}}, giới thiệu dự án X..."

### Requirement: Quota tracking
Each successful AI call MUST increment org's quota counter. Fallback MUST NOT increment quota.

#### Scenario: Quota tăng sau call
- **WHEN** AI call succeeds (source='ai')
- **THEN** `app_settings['ai_call_count']` increments by 1

