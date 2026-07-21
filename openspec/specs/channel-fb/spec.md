# channel-fb Specification

## Purpose
TBD - created by archiving change add-ai-campaign-studio-and-multichannel. Update Purpose after archive.
## Requirements
### Requirement: Facebook Messenger adapter interface
The Facebook Messenger adapter MUST be a class implementing `ChannelAdapter` with the following methods:
- `sendMessage(orgId, conversationId, text): Promise<{ providerMessageId, status }>`
- `receiveWebhook(payload): Promise<{ conversationId, messageId }>`
- `parseIncomingMessage(payload): ParsedMessage`

#### Scenario: Adapter class structure
- **WHEN** developer inspects `backend/src/modules/integrations/providers/facebook-messenger.ts`
- **THEN** class exports `sendMessage`, `receiveWebhook`, `parseIncomingMessage` methods with correct signatures

### Requirement: Facebook webhook stub
`POST /api/v1/webhooks/facebook` MUST accept Facebook Messenger payload (`{ object, entry }`), parse incoming message via adapter, upsert Conversation với channel='facebook', create Message record.

#### Scenario: FB webhook payload → Message record
- **WHEN** FB POSTs `{ object: 'page', entry: [{ messaging: [{ sender: { id }, message: { text } }] }] }`
- **THEN** backend creates Message với `channel='facebook'`, content=text
- **AND** Conversation upserted (key: psid)
- **AND** HTTP 200 returned within 5s

### Requirement: SMS brandname adapter
The SMS adapter MUST support configurable HTTP gateway (org sets in app_settings):
- `sms_api_url`
- `sms_api_key`
- `sms_sender` (brandname)
- `sms_provider` ('vnpt' | 'viettel' | 'generic' default 'generic')

#### Scenario: SMS với config generic
- **WHEN** sale sends SMS with org config `sms_api_url=https://api.example.com/sms, sms_api_key=XXX`
- **THEN** adapter POSTs `{ to, text, sender }` to API with Bearer auth
- **AND** Message.status='sent' nếu 200 OK, 'failed' nếu 4xx/5xx

#### Scenario: SMS config missing
- **WHEN** org chưa config SMS
- **THEN** adapter returns error "SMS not configured for this org"

### Requirement: Multi-channel inbox filter UI
ChatView MUST have channel filter dropdown. Default 'all'. Selecting 'zalo' hides non-Zalo conversations.

#### Scenario: Dropdown với 5 channels
- **WHEN** user clicks dropdown
- **THEN** options: All, Zalo, Telegram, Facebook, Instagram, SMS

