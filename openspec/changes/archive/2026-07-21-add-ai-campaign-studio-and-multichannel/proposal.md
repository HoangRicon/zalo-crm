# Proposal: AI Campaign Studio + Multi-channel Inbox

> **Change ID**: `add-ai-campaign-studio-and-multichannel`
> **Created**: 2026-07-21
> **Plan**: [docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 5 R11 + Sprint 6 R10

---

## Why

CRM hiện cho phép tạo broadcast job thủ công (chọn tệp + viết tin), nhưng sale không có trợ lý AI **gợi ý toàn bộ kế hoạch campaign** (đối tượng + tin nhắn + lịch + KPI dự kiến) từ 1 câu "Bán căn 3PN Q7 cho KH quan tâm tháng trước". AI Campaign Studio sẽ sinh plan đầy đủ trong 8s, user chỉ cần review + 1 click để tạo broadcast job thật.

Đồng thời, inbox hiện chỉ hiển thị Zalo. Trong khi khách đã liên hệ qua Facebook Messenger, Instagram DM, SMS brandname. Multi-channel Inbox hợp nhất tất cả kênh vào 1 nơi với channel badge + filter.

---

## What Changes

### Capability 1: AI Campaign Studio
- View mới `/marketing/ai-studio`.
- Input: free-form userGoal ("Bán căn 3PN Q7 cho KH quan tâm tháng trước").
- AI sinh plan: `{ audience: { filters[] }, messages: [{ variant, text }], schedule: { sendAt, frequency }, kpi: { expectedReplyRate, expectedReach }, risks: string[] }`.
- Fallback rule-based khi AI fail.
- Button "Tạo campaign từ plan này" → tạo BroadcastJob + ContentBlocks + Target list.

### Capability 2: Multi-channel Inbox
- Schema: thêm `Channel` enum (zalo, telegram, facebook, instagram, sms) + field `channel` vào Conversation.
- Frontend ChatView: filter theo channel + icon badge mỗi tin nhắn.
- Channel adapters (queue worker) cho:
  - **Telegram** (đã có qua `telegram-bridge`) — chỉ cần filter
  - **Facebook Messenger** (mới) — adapter stub tích hợp Zalo OA-style API
  - **SMS brandname** (mới) — provider gateway abstraction

---

## Schema Changes (1 migration)

```prisma
enum Channel {
  zalo
  telegram
  facebook
  instagram
  sms
}

model Conversation {
  // ... existing
  channel Channel @default(zalo)
}

model CampaignPlan {
  id              String   @id @default(uuid())
  orgId           String   @map("org_id")
  createdById     String   @map("created_by_id")
  userGoal        String   @map("user_goal") @db.Text
  plan            Json     // { audience, messages, schedule, kpi, risks }
  source          String   // 'ai' | 'rule_based'
  appliedToJobId  String?  @map("applied_to_job_id")  // broadcast job nếu user tạo từ plan
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@index([orgId, createdAt])
  @@map("campaign_plans")
}
```

---

## Non-Goals

- KHÔNG tích hợp thật với Facebook/Instagram API (OAuth flow, webhook verify) — chỉ stub adapter.
- KHÔNG tạo UI reply composer riêng cho từng channel (giữ 1 composer thống nhất).
- KHÔNG multi-account cho FB/IG (1 org = 1 page).
- KHÔNG auto-reply cho FB/IG (Phase sau).

---

## Acceptance Summary

| # | Tiêu chí | Verify |
|---|---|---|
| A1 | Input goal → AI trả plan trong 8s | UI manual |
| A2 | Plan có 5 phần: audience, messages, schedule, kpi, risks | curl |
| A3 | AI fail → fallback rule-based plan | Test |
| A4 | Button "Tạo campaign" tạo BroadcastJob | UI manual |
| A5 | Inbox filter Zalo/Telegram/FB/SMS hoạt động | UI |
| A6 | Message bubble hiển thị channel badge | UI |
| A7 | FB/SMS adapter unit test (chưa cần real API) | vitest |

---

## Estimated: 7-10 ngày