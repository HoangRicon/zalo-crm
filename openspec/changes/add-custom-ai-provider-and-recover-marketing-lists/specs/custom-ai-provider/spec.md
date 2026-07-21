# Spec: AI Provider 'custom'

> Parent: [proposal.md](../proposal.md)
> Capability: 1 — Sprint 0

## ADDED Requirements

### Requirement: Đăng ký provider 'custom' trong registry
The provider catalog MUST expose a new entry with id `custom` so that all downstream consumers (`getAvailableProviders`, `setProviderApiKey`, `setProviderBaseUrl`, `resolveProviderApiKey`, `generateText`) can recognize and operate on it. Env vars `CUSTOM_BASE_URL`, `CUSTOM_AUTH_TOKEN`, `CUSTOM_DEFAULT_MODEL` MUST be read from config.

#### Scenario: Provider xuất hiện trong danh sách
- **WHEN** `GET /api/v1/ai/providers` is called
- **THEN** the response includes an entry with `id: "custom"`, `name: "Custom"`, `hasKey: true` (if env token set), and `keyMask: "••••XXXX"`

#### Scenario: ProviderId type guard chấp nhận 'custom'
- **WHEN** `setProviderApiKey(orgId, 'custom', key)` is called
- **THEN** the function does NOT throw `Unknown provider: custom`

#### Scenario: Env fallback khi DB không có
- **WHEN** `resolveProviderApiKey(orgId, 'custom')` is called AND `app_settings` has no `ai_custom_api_key` row
- **THEN** the function returns `CUSTOM_AUTH_TOKEN` from env (empty string if unset)

### Requirement: Set baseUrl + apiKey per-org qua UI
The UI MUST allow an org admin to set the base URL and API key for provider `custom` via `PUT /api/v1/ai/providers/custom`. The key MUST be encrypted with AES-GCM and stored in `app_settings.value_encrypted`. The base URL MUST be stored plain in `app_settings.value_plain`. Per-org values MUST take priority over env defaults.

#### Scenario: Set baseUrl + apiKey thành công
- **WHEN** admin calls `PUT /api/v1/ai/providers/custom` with `{baseUrl: "https://x", apiKey: "sk-abc"}`
- **THEN** response is `{ok: true}`
- **AND** `app_settings` row exists with `settingKey="ai_custom_base_url"`, `valuePlain="https://x"`
- **AND** `app_settings` row exists with `settingKey="ai_custom_api_key"`, `valueEncrypted=<non-empty base64>`

#### Scenario: Xoá apiKey bằng cách gửi rỗng
- **WHEN** admin calls `PUT /api/v1/ai/providers/custom` with `{apiKey: ""}`
- **THEN** the `ai_custom_api_key` row is deleted from `app_settings`
- **AND** subsequent calls fall back to env token

### Requirement: List models của custom provider
The endpoint `GET /api/v1/ai/providers/custom/models` MUST return a list of available models for the provider. If the provider does not expose a `/models` endpoint, the response MUST be `{models: [], error: "<reason>"}` (200 status) so the UI can fall back to manual input.

#### Scenario: Provider có /models endpoint
- **WHEN** provider's `GET <baseUrl>/models` returns `{data: [{id: "model-a"}, {id: "model-b"}]}`
- **THEN** response is `{models: [{title: "model-a", value: "model-a"}, {title: "model-b", value: "model-b"}]}`

#### Scenario: Provider không có /models endpoint hoặc timeout
- **WHEN** provider's `/models` call fails or returns 404
- **THEN** response is `{models: [], error: "<reason>"}` with status 200

### Requirement: Generate text qua provider custom
The `generateText(provider='custom', ...)` function MUST delegate to an OpenAI-compatible chat completions call at `<baseUrl>/v1/chat/completions`. It MUST reuse the existing `generateWithOpenaiCompat` helper and return text in the same format as other providers.

#### Scenario: Generate thành công
- **WHEN** provider custom is configured AND `generateText('custom', key, 'model-x', system, prompt)` is called
- **THEN** a POST request is made to `<baseUrl>/v1/chat/completions`
- **AND** response text is returned

#### Scenario: baseUrl rỗng
- **WHEN** provider custom has empty baseUrl AND `generateText('custom', ...)` is called
- **THEN** the function throws `Error("AI provider baseUrl not configured")`

#### Scenario: HTTP error từ provider
- **WHEN** provider returns 500
- **THEN** the function throws `Error("OpenAI-compat request failed with status 500")`

### Requirement: Quota counter chung cho mọi provider
Every AI call (including those via provider `custom`) MUST increment the `aiSuggestion` table for the org, and MUST be subject to the org's `maxDaily` quota in `aiConfig`.

#### Scenario: Quota exceeded
- **WHEN** org has `maxDaily=500` AND 500 suggestions already saved today AND user triggers another AI task
- **THEN** the call is rejected with `Error("AI daily quota exceeded")` regardless of which provider is used