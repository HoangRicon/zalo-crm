# Spec: Blacklist Nick cho Broadcast

> Parent: [proposal.md](../proposal.md)

## ADDED Requirements

### Requirement: Schema field broadcastBlacklisted
`ZaloAccount` MUST have `broadcastBlacklisted` (Boolean default false) and `broadcastBlacklistReason` (String?).

#### Scenario: Migration thêm 2 cột
- **WHEN** migration runs
- **THEN** table zalo_accounts has 2 new columns: broadcast_blacklisted (boolean default false), broadcast_blacklist_reason (text nullable)

### Requirement: Toggle blacklist trong Settings
Settings → Zalo Accounts MUST show a toggle "Không dùng nick này cho broadcast" per account. When toggled on, a reason field appears (optional, max 200 chars).

#### Scenario: Toggle blacklist on
- **WHEN** admin toggles "Blacklist broadcast" for account Z to ON with reason="Bị Zalo rate-limit 3 lần trong tuần"
- **THEN** PUT /api/v1/zalo-accounts/:id saves broadcastBlacklisted=true and broadcastBlacklistReason=<reason>
- **AND** the account card shows a red "🚫 Broadcast disabled" badge

#### Scenario: Toggle blacklist off
- **WHEN** admin toggles OFF for account Z
- **THEN** PUT /api/v1/zalo-accounts/:id saves broadcastBlacklisted=false
- **AND** the badge disappears

### Requirement: Cron broadcast skip blacklisted nick
When the broadcast cron picks a job to run, it MUST skip any zaloAccountId where broadcastBlacklisted=true and log a warning.

#### Scenario: Job với blacklisted nick bị skip
- **WHEN** job J has zaloAccountId=Z and Z is blacklisted
- **THEN** the cron logs `[broadcast] skip job=J name=... reason=account_blacklisted`
- **AND** the run is NOT created (no items processed)
- **AND** job.status remains 'queued' so user can manually retry after re-enabling account

#### Scenario: Tất cả nick của job đều bị blacklist
- **WHEN** job J has multiple zaloAccounts and ALL are blacklisted
- **THEN** the cron logs the skip and emits a toast on next dashboard refresh: "Job '...' không thể chạy: tất cả nick đều bị blacklist"

### Requirement: Warning trước khi submit broadcast nếu nick bị blacklist
When user submits a broadcast form, if the chosen zaloAccountId is blacklisted, the form MUST show a confirm dialog: "Nick này đã bị blacklist broadcast. Lý do: '<reason>'. Bạn có chắc muốn tạo job với nick này?"

#### Scenario: Submit form với blacklisted nick
- **WHEN** user clicks "Tạo broadcast" with blacklisted account Z
- **THEN** a confirm dialog appears with the reason
- **AND** only after confirming "Có, tạo" does the job get created
- **AND** the job can be saved (admin can override), but it will be skipped at runtime as per REQ above