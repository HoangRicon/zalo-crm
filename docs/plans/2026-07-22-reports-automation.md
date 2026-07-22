# Reports/Automation — Automation History Dashboard

> **Spec Version:** 1.0 | **Date:** 2026-07-22 | **Status:** Draft

## 1. Problem Statement

No dedicated page for viewing automation/broadcast history. Users need to see which automations ran, when, and their outcomes.

## 2. Goals

Create a new page `/reports/automation` showing:
- History of all broadcast jobs and automation sequences that ran
- Status, timing, delivery stats per run
- Filter by account, date range, type

## 3. Architecture

### 3A. New Page

**Route:** `frontend/src/views/reports/AutomationReportView.vue`

**Layout:**
```
┌─ Báo cáo Automation ────────────────────────────────┐
│ Filters: [Account ▾] [Loại ▾] [Từ ngày] [Đến] │
│                                                     │
│ ┌─ Summary Cards ───────────────────────────────┐   │
│ │ Tổng chạy: 142  Thành công: 138  Lỗi: 4  │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ Bảng lịch sử:                                     │
│ │ Tên          │ Loại   │ Trạng thái │ Gửi │ Thời gian │
│ │ Broadcast A   │ Bcast   │ ✓ Done     │ 234  │ 20:00     │
│ │ Sequence B    │ Sequence│ ✓ Done     │ 56   │ 19:30     │
│ │ Auto-reply C  │ Rule   │ ✓ Done     │ 12   │ 18:45     │
└─────────────────────────────────────────────────────┘
```

### 3B. Backend Data Sources

Aggregate data from existing tables:
- `broadcast_jobs` — status, account, sent count, scheduledAt
- `broadcast_runs` — per-run stats (delivered, failed, pending)
- `automation_sequences` — sequence run history
- `auto_reply_rules` executions — from new `auto_reply_execution_log` (add this)

**New table for execution log:**
```prisma
model AutomationExecutionLog {
  id          String   @id @default(cuid())
  orgId       String   @map("org_id")
  oaAccountId String   @map("oa_account_id")
  type        String   // "broadcast" | "sequence" | "auto_reply"
  jobId       String   @map("job_id")  // references broadcast_job.id etc.
  status      String   // "running" | "completed" | "failed"
  sent        Int      @default(0)
  failed      Int      @default(0)
  startedAt   DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@index([orgId, startedAt])
  @@map("automation_execution_logs")
}
```

### 3C. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reports/automation/history` | Paginated history with filters |
| GET | `/api/v1/reports/automation/summary` | Aggregated stats (total, success rate) |

**Query params:** `?oaAccountId=&type=&from=&to=&page=&limit=`

## 4. Files to Create/Modify

### Create
- `frontend/src/views/reports/AutomationReportView.vue`
- `backend/src/modules/reports/automation-report-routes.ts`
- `backend/src/modules/reports/automation-report-service.ts`
- `backend/prisma/migrations/YYYYMMDDHHMMSS_add_automation_execution_log/migration.sql`

### Modify
- `frontend/src/router/index.ts` — add route `{ path: 'automation', name: 'Reports.Automation', component: () => import('@/views/reports/AutomationReportView.vue'), meta: { resource: 'engagement_score' } }`
- `backend/src/modules/automation/automation-execution-log.ts` (new service to log executions)
- Wire logging into `broadcast-job-service.ts` and `auto-reply-service.ts`

## 5. Testing

- Create broadcast → verify it appears in history
- Filter by account → verify filtered results
- Check summary cards match real data
