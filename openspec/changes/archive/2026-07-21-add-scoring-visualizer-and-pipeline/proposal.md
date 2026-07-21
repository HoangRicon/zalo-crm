# Proposal: Scoring Visualizer + Journey Funnel + Pipeline Kanban

> **Change ID**: `add-scoring-visualizer-and-pipeline`
> **Created**: 2026-07-21
> **Plan**: [docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md](../../docs/plans/MARKETING-AUTOMATION-RECOVERY-PLAN.md) — Sprint 3 R6 + Sprint 4 R7-R8

---

## Why

CRM đã có **lead scoring engine** (tính scoreBreakdown + signals) nhưng UI chỉ hiển thị con số `priorityScore` đơn lẻ. Sale/manager không hiểu:
- Vì sao KH này được X điểm?
- Score tăng/giảm thế nào trong 30 ngày qua?
- KH "nóng" hay "nguội" so với median?

Cũng thiếu:
- **Customer Journey Funnel**: không thấy KH rơi ở giai đoạn nào (First Contact → Friend Accept → Reply → Quote → Appointment → Closed).
- **Sales Pipeline Kanban** (Community): chỉ có EE có, CE chưa — sale cần kéo thẻ KH qua các cột để update status.

3 capability này cùng nhau tạo bức tranh visual cho sale/manager.

---

## What Changes

### Capability 1: Lead Scoring Visualizer (Sprint 3 R6)
- Tab "Điểm & Tín hiệu" trong ContactProfileView.
- Hiển thị: priorityScore + trendline 30 ngày (Chart.js sparkline), top 10 signals, so sánh median cùng phân khúc.
- Hover signal → tooltip giải thích.

### Capability 2: Customer Journey Funnel (Sprint 4 R7)
- View mới `/reports/journey`: funnel 6 giai đoạn.
- Mỗi giai đoạn: số KH, tỉ lệ chuyển đổi, thời gian TB.
- Click stage → drill-down danh sách KH đang kẹt ở đó.

### Capability 3: Sales Pipeline Kanban (Sprint 4 R8, Community)
- View mới `/marketing/pipeline`.
- 6 cột: Mới → Đang nuôi → Quan tâm → Lên lịch → Chốt → Chăm sóc sau.
- Kéo thả card → update `Contact.status` + log activity.
- Filter theo owner, score range, source.

---

## Schema Changes (0 — reuse existing)

- Contact.status đã có sẵn (string, default 'new').
- scoreBreakdown, signals, priorityScore đã có.
- ActivityLog đã có (cho audit trail khi kéo-thả).
- KHÔNG cần migration.

---

## Non-Goals

- KHÔNG thêm funnel cho multi-channel (chỉ Zalo hiện tại).
- KHÔNG thêm custom fields cho stages (dùng hard-coded 6 stages).
- KHÔNG làm mobile-friendly cho drag-drop (desktop-first, mobile = scroll ngang).

---

## Acceptance Summary

| # | Tiêu chí | Verify |
|---|---|---|
| A1 | ContactProfile tab "Điểm & Tín hiệu" render trong <500ms | UI manual |
| A2 | Trendline 30 ngày hiển thị qua Chart.js | UI |
| A3 | Hover signal → tooltip giải thích rõ ràng | UI |
| A4 | Journey funnel render 6 stages với % conversion | UI |
| A5 | Click stage → drill-down danh sách KH | UI |
| A6 | Pipeline Kanban kéo thẻ → status update + activity log | UI manual |
| A7 | Refresh page → status giữ nguyên (persisted) | UI |

---

## Estimated: 5-7 ngày