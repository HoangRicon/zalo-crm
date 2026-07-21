# Spec: Backup & Restore

## ADDED Requirements

### Requirement: Export full org data as JSON
The system SHALL allow owner to download a `.zip` containing a `manifest.json` (schema version, exportedAt, orgId, counts) and `data/*.json` for each table: contacts, conversations, messages, lists, broadcasts, contentBlocks, settings, webhooks.

#### Scenario: WHEN an owner clicks "Export backup" in Settings → Backup
THEN the server SHALL stream a `.zip` download with file name `zcrm-backup-<orgId>-<yyyyMMddHHmmss>.zip` and total size ≤ 50MB (return 413 if exceeds).

### Requirement: Restore from backup with dry-run
The system SHALL allow owner to upload a backup `.zip`, parse it, show a dry-run preview ("Will import 1247 contacts, 8932 messages, replace 5 webhooks"), and require explicit confirmation before applying.

#### Scenario: WHEN an owner uploads a backup file
THEN the server SHALL return `POST /api/v1/backup/restore/dry-run` → JSON with `{ counts, warnings[], conflicts[] }` (e.g., contact already exists → "skip" vs "replace").

#### Scenario: WHEN the owner confirms restore with `{ mode: 'replace' | 'merge' }`
THEN `POST /api/v1/backup/restore` SHALL apply the changes within a transaction; rollback on any error → return 500 with `{ partial: true, completed: 5, total: 12 }`.

### Requirement: Backup listing
The system SHALL keep a `BackupRecord` row for every export so users can re-download.

#### Scenario: WHEN the owner opens Settings → Backup
THEN the list SHALL show the last 30 exports with timestamp, size, schema version, and a re-download button.
