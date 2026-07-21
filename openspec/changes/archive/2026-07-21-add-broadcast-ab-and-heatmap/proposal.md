# Proposal: Broadcast Preview + A/B test + Reply tracking + Heatmap

> **Change ID**: `add-broadcast-ab-and-heatmap`
> **Created**: 2026-07-21
> **Schema**: spec-driven
> **Plan**: [docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 2 R4

---

## Why

Broadcast hiện cho phép tạo job + gửi 1 mẫu tin cho hàng loạt KH, nhưng thiếu 4 tính năng quan trọng cho marketing chuyên nghiệp:

1. **Preview trước khi gửi** — sale không thấy được biến `{{ten}}` render thành gì, không thấy KH mẫu.
2. **A/B test** — chỉ có 1 mẫu, không đo được mẫu nào reply nhiều hơn.
3. **Reply tracking** — khi KH reply sau broadcast, không link được ngược về `BroadcastRunItem` để tính `responseRate`.
4. **Heatmap giờ gửi** — không có dữ liệu lịch sử để gợi ý "gửi lúc 9h sáng có reply 30%, gửi lúc 22h chỉ 5%".

Ngoài ra, **blacklist nick**: khi nick Zalo bị rate limit, cần cờ "không dùng nick này cho broadcast" để cron tự skip.

---

## What Changes

### Capability 1: Preview modal + A/B test UI
- **Preview**: trước khi submit, hiển thị modal với 3 KH mẫu + tin họ sẽ nhận (render biến `{{ten}}`, `{{sdt}}`).
- **A/B test**: trong form tạo broadcast, thêm section "Mẫu tin" cho phép chọn 2-3 mẫu (multi-select). Hệ thống chia đều đối tượng random → mỗi mẫu 1 nhóm `A/B/C`.

### Capability 2: Reply tracking cho Broadcast
- Schema: thêm `replyMessageId` + `repliedAt` + `abGroupId` vào `BroadcastRunItem`.
- Logic: khi nhận message mới trong conversation → check xem có `BroadcastRunItem` nào chưa có reply trong vòng 7 ngày không → set `repliedAt`.
- Report: `responseRate = items.filter(repliedAt != null).length / items.length`.

### Capability 3: Heatmap giờ gửi
- Endpoint `GET /api/v1/broadcast/heatmap?days=30` trả về ma trận `[24 giờ][7 ngày]` của response rate.
- UI widget trên Broadcast dashboard: bảng màu (đỏ = thấp, xanh = cao).

### Capability 4: Blacklist nick cho Broadcast
- Schema: thêm `broadcastBlacklisted` boolean vào `ZaloAccount`.
- UI toggle ở `/settings/zalo-accounts` → tab "Blacklist broadcast".
- Logic: cron broadcast skip nick có flag này.

---

## Non-Goals

- KHÔNG thêm A/B winner auto-select (Phase 2 — chỉ compute + show stats, user tự quyết).
- KHÔNG thêm Heatmap cho Campaign (auto kết bạn) — chỉ broadcast.
- KHÔNG thêm multi-language cho heatmap labels — giữ tiếng Việt.
- KHÔNG đụng EE (Sequence, Trigger) — chỉ Broadcast.

---

## Schema Changes (chỉ cần 1 migration)

```prisma
model BroadcastJob {
  // ... existing
  abMode         String? @map("ab_mode")     // 'off' | 'ab_split' | 'ab_three'
  abGroupCount   Int?    @map("ab_group_count") // 2 hoặc 3
}

model BroadcastRunItem {
  // ... existing
  replyMessageId String?   @map("reply_message_id")
  repliedAt      DateTime? @map("replied_at")
  abGroupId      String?   @map("ab_group_id")  // 'A' | 'B' | 'C' | null
}

model ZaloAccount {
  // ... existing
  broadcastBlacklisted Boolean @default(false) @map("broadcast_blacklisted")
  broadcastBlacklistReason String? @map("broadcast_blacklist_reason")
}
```

---

## Acceptance Summary

| # | Tiêu chí | Verify |
|---|---|---|
| A1 | Preview modal hiển thị 3 KH mẫu + tin render biến | UI manual |
| A2 | A/B mode = 2 nhóm: items chia đều 50/50 | Math test |
| A3 | KH reply sau 10 phút → `repliedAt` set, responseRate tăng | E2E test |
| A4 | Heatmap endpoint trả JSON 24x7 | curl |
| A5 | Toggle blacklist → cron skip nick | Manual UI |

---

## Estimated: 5-7 ngày