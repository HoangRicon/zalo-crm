# Change: Add Webhooks Outbound + Audit Log Advanced + Backup/Restore

> **Sprint**: 8 — Infrastructure nâng cao (bỏ i18n)
> **Date**: 2026-07-21

## Why

CRM phải tích hợp với hệ thống bên ngoài (CRM khác, ERP, BI tool, Zapier, n8n…) để tự động hoá
end-to-end: khi deal close → ERP tạo đơn, khi lead nóng → notification Slack, khi churn high risk
→ CRM Manager nhận alert.

Hiện tại backend KHÔNG có cơ chế outbound webhook → user phải thao tác thủ công từng case.

Đồng thời, audit log chỉ ghi "ai làm gì" ở dạng text. Khi điều tra sự cố cần filter nhanh + xem
diff before/after để truy nguyên nhân (vd: "Contact X bị đổi status từ 'Moi' → 'Quan tam' bởi user Y lúc 14h").

Cuối cùng, không có backup/restore → mất DB = mất dữ liệu CRM. Backup export/import JSON hàng ngày
là nhu cầu thiết yếu cho SMB.

## What Changes

1. **Outbound Webhooks**: CRUD endpoints cho user đăng ký URL nhận event.
   - Events: `contact.created`, `contact.updated`, `deal.closed`, `lead.score_changed`, `churn.high_risk`, `broadcast.run_completed`.
   - Retry với exponential backoff (3 lần: 30s, 5min, 30min).
   - UI Settings → Webhooks: list, create, edit, delete, test, log lịch sử gửi.
2. **Audit Log Advanced**: filter (actor, action, entity, time range, org) + diff view (before/after JSON side-by-side).
3. **Backup & Restore**: export toàn bộ org data (contacts, conversations, settings, lists…) thành JSON file; import từ JSON với validation + dry-run mode.

## Non-Goals

- i18n (đã yêu cầu bỏ qua).
- Cloud-native storage (S3, GCS) — dùng local download/upload.
- Real-time sync giữa các org.

## Acceptance Summary

| # | Feature | Verified by |
|---|---------|-------------|
| A1 | Webhook CRUD + secret signing (HMAC-SHA256) | Test create → trigger → receiver validates signature |
| A2 | Retry logic (3 attempts) | Test 500 response → retry sau 30s |
| A3 | Webhook delivery log | Test 5 lần gửi → log shows 5 rows |
| A4 | Audit filter UI | Test filter by actor + time range |
| A5 | Audit diff view | Test before/after JSON render |
| A6 | Backup export JSON | Test export 100 contacts → JSON valid |
| A7 | Backup import + dry-run | Test import → preview count → confirm |

## Risk & Rollback

- **Webhook retry storm** nếu receiver luôn 500 → cap 3 retry, log final failure.
- **Backup restore** có thể ghi đè data thật → default dry-run, yêu cầu explicit `confirm` + backup version stale check.
- **Performance** khi audit log grows → partition by month (Phase 2).

## Dependencies

- New deps backend: `croner` (đã có sẵn).
- New deps frontend: `vue-diff` (~10kb) cho audit diff.
- Schema: thêm `Webhook`, `WebhookDelivery`, `BackupRecord` model.

## Out of Scope

- i18n
- S3/GCS storage
- Multi-org backup restore
