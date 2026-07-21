# Proposal: AI Content Suggest + Churn Risk Detector

> **Change ID**: `add-ai-content-suggest-and-churn`
> **Created**: 2026-07-21
> **Plan**: [docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 2 R5 + Sprint 3 R9

---

## Why

Hệ thống đã có AI provider registry (6 providers: anthropic, gemini, openai, qwen, kimi, custom), đã có prompt builder cho reply draft và scoring analysis, nhưng còn **2 use case quan trọng**:

1. **AI gợi ý Khối nội dung (Content Block)** — sale tốn 10-20 phút mỗi lần nghĩ ra 5 biến thể tin nhắn cho 1 campaign. AI sinh 3-5 mẫu trong 5s → sale chọn/sửa → apply.
2. **Churn Risk Detector** — 30% KH "cooling/cold" sau 14 ngày sẽ rời đi. Cần cron nightly quét + AI đọc 10 tin gần nhất → đánh dấu "nguy cơ rời bỏ" + gợi ý hành động.

Cả 2 đều phải có **fallback rule-based** khi AI fail (timeout, quota, network).

---

## What Changes

### Capability 1: AI Suggest Content Blocks
- Thêm prompt builder `content-block-suggest.ts`.
- Endpoint `POST /api/v1/ai/suggest-content-blocks` body `{ userIntent: string, count?: number }` → AI gợi ý 3-5 mẫu.
- Frontend: nút "✨ AI gợi ý" trong ContentBlocksView, modal hiển thị mẫu, click chọn → fill form.
- Fallback: 3 template cứng (mở bán, tái khách, giới thiệu dự án).

### Capability 2: Churn Risk Detector
- Cron nightly 02:00 VN: quét KH `engagementPattern` ∈ {cooling, cold} trong 14 ngày.
- Với mỗi KH: lấy 10 message gần nhất → gọi AI (task type `churn_risk`).
- Lưu kết quả vào `ChurnRiskScore` (bảng mới).
- UI widget trên Dashboard: "Top 10 KH có nguy cơ rời bỏ".
- Fallback rule-based: `daysSinceLastInteraction > 14` → medium; `> 30` → high; sentiment < 0.3 → +1 mức.

---

## Schema Changes (1 migration)

```prisma
model ChurnRiskScore {
  id              String   @id @default(uuid())
  orgId           String   @map("org_id")
  contactId       String   @map("contact_id")
  riskLevel       String   @map("risk_level")  // 'low' | 'medium' | 'high'
  reasons         Json     @map("reasons")     // string[]
  suggestedAction String?  @map("suggested_action") @db.Text
  source          String   @map("source")      // 'ai' | 'rule_based'
  scoredAt        DateTime @default(now()) @map("scored_at")
  expiresAt       DateTime @map("expires_at")  // 24h sau scoredAt → cron rerun

  @@unique([contactId, scoredAt])
  @@index([orgId, riskLevel, scoredAt])
  @@map("churn_risk_scores")
}
```

---

## Non-Goals

- KHÔNG gửi auto-message cho churn-risk KH (chỉ hiển thị).
- KHÔNG tích hợp webhook outbound cho churn event (Phase sau).
- KHÔNG thêm sentiment analyzer riêng — dùng `message.sentimentScore` đã có (nếu schema chưa có thì skip).

---

## Acceptance Summary

| # | Tiêu chí | Verify |
|---|---|---|
| A1 | POST /ai/suggest-content-blocks trả 3-5 mẫu trong 5s | curl |
| A2 | Click "AI gợi ý" → modal hiển thị → chọn → fill form | UI manual |
| A3 | AI fail (mock 500) → vẫn trả 3 template fallback | Test |
| A4 | Cron nightly chạy → tạo ChurnRiskScore | DB check |
| A5 | Dashboard widget "Top 10 rời bỏ" hiển thị | UI |
| A6 | Fallback rule-based chạy khi AI disable | Test |

---

## Estimated: 5-7 ngày