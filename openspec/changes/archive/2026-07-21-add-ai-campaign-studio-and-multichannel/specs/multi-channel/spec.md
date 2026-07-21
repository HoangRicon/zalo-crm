# Spec: Multi-channel Inbox

> Parent: [proposal.md](../proposal.md)

## ADDED Requirements

### Requirement: Channel enum + Conversation.channel
`Conversation.channel` MUST be a `Channel` enum: zalo, telegram, facebook, instagram, sms. Default zalo. Existing conversations MUST be treated as 'zalo'.

#### Scenario: Migration thêm field
- **WHEN** migration runs
- **THEN** column channel exists with default 'zalo'
- **AND** existing rows default to 'zalo'

### Requirement: Filter inbox by channel
ChatView MUST have a filter dropdown with options: All · Zalo · Telegram · Facebook · Instagram · SMS. Selecting a filter MUST show only conversations matching that channel.

#### Scenario: Filter Facebook
- **WHEN** user selects "Facebook" in filter
- **THEN** conversation list shows only channel='facebook'
- **AND** URL query `?channel=facebook` updates

### Requirement: Channel badge on conversation row
Each conversation row MUST display a small icon (Zalo blue / Telegram blue / Facebook blue / Instagram gradient / SMS gray) representing the channel.

#### Scenario: Multi-channel conversation list
- **WHEN** user opens /chat with mixed channels
- **THEN** each row shows: contact name + channel badge + last message preview
- **AND** badge color matches channel

### Requirement: Channel filter in API
`GET /api/v1/conversations?channel=facebook` MUST return only facebook conversations.

#### Scenario: API filter
- **WHEN** frontend calls /conversations?channel=sms
- **THEN** response includes only conversations with channel='sms'

### Requirement: Multi-channel adapter interface
Backend MUST have an abstract `ChannelAdapter` interface with methods: `sendMessage()`, `receiveWebhook(payload)`, `parseIncomingMessage(payload)`. Each channel (FB, IG, SMS) MUST implement this interface.

#### Scenario: Facebook adapter stub
- **WHEN** FB webhook hits /api/v1/webhooks/facebook
- **THEN** adapter parses incoming message
- **AND** creates/finds conversation với channel='facebook'
- **AND** creates Message record

### Requirement: SMS brandname provider
SMS channel MUST have an adapter supporting generic HTTP gateway (e.g., VNPT brandname). Config per org: API key + sender + endpoint.

#### Scenario: SMS send
- **WHEN** sale sends SMS to contact via ChatView
- **THEN** adapter POSTs to org's configured SMS endpoint with { to, text, sender }
- **AND** Message record saved with channel='sms', status='sent' if 200 OK