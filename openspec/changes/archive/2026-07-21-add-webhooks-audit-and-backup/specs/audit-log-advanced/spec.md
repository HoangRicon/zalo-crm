# Spec: Audit Log Advanced Filtering + Diff

## ADDED Requirements

### Requirement: Audit log entries with before/after diff
The system SHALL record every mutation to sensitive entities (Contact, Conversation, BroadcastJob, AppSetting, Webhook, List) in an `AuditLog` row capturing `{ actorId, action, entity, entityId, before, after, ip, userAgent, createdAt }`.

#### Scenario: WHEN a user updates a contact's `status` field
THEN the system SHALL write an `AuditLog` row with `action='update'`, `entity='Contact'`, `entityId=<id>`, `before={status:'moi'}`, `after={status:'quan_tam'}`, `actorId=<userId>`.

### Requirement: Filter UI
The system SHALL provide a Settings page that lets owner/admin filter AuditLog by actor, action, entity, and a time range (default last 7 days).

#### Scenario: WHEN an owner filters by `entity=Contact` and `actor=Jane` and last 24h
THEN the list SHALL reload with `GET /api/v1/audit?entity=Contact&actor=Jane&from=2026-07-20T00:00:00Z` and render the rows.

### Requirement: Diff view
The system SHALL render a side-by-side JSON diff for each `AuditLog` row, with red strikethrough for `before` keys and green highlight for `after` keys.

#### Scenario: WHEN the owner clicks "Xem diff" on a row
THEN a modal SHALL open with two columns: "Trước" (before) and "Sau" (after), each field either shown in red (removed), green (added), or plain (unchanged). Both SHALL be valid JSON.
