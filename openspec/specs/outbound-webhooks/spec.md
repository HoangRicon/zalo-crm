# outbound-webhooks Specification

## Purpose
TBD - created by archiving change add-webhooks-audit-and-backup. Update Purpose after archive.
## Requirements
### Requirement: Webhook subscription management
The system SHALL allow owner/admin to create, list, edit, and delete webhook subscriptions, each containing a URL, a list of subscribed events, an optional secret, and an active flag.

#### Scenario: WHEN an owner creates a webhook with `{ url: "https://example.com/hook", events: ["contact.created", "deal.closed"], secret: "shh" }`
THEN the system SHALL persist a `Webhook` row scoped to that org, return its id, and immediately start firing events matching the subscriptions.

#### Scenario: WHEN a webhook is set inactive
THEN the dispatcher SHALL skip it but SHALL keep the row and delivery history.

### Requirement: Event delivery with retry
The system SHALL deliver every event to all matching active webhooks, with a signed payload (HMAC-SHA256 over body using the webhook secret), and SHALL retry up to 3 times with exponential backoff (30s / 5min / 30min) on non-2xx responses.

#### Scenario: WHEN a `contact.created` event fires
THEN the dispatcher SHALL call `webhookService.deliverEvent("contact.created", payload)` which:
  1. Loads all active webhooks subscribed to this event for the org.
  2. For each webhook, sends `POST <webhook.url>` with header `X-Webhook-Signature: sha256=<hmac>` and `X-Webhook-Event: contact.created`.
  3. Writes a `WebhookDelivery` row (status: success|fail, httpStatus, responseBody[:500], attempt).

#### Scenario: WHEN the receiver returns 500
THEN the dispatcher SHALL schedule retry #1 in 30s; if it fails again, retry #2 in 5min; retry #3 in 30min. After 3 failures, mark `WebhookDelivery.status='failed'` permanently.

### Requirement: Webhook delivery log
The system SHALL expose a per-webhook delivery history (`GET /api/v1/webhooks/:id/deliveries?limit=50`) for debugging.

#### Scenario: WHEN an owner opens a webhook's log
THEN the UI SHALL show the last 50 deliveries with timestamp, event, attempt number, http status, and the first 200 chars of the response body.

