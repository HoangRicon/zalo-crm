# Capability: Lead Pool (FIFO) + UI nhận khách
## ADDED Requirements

### Requirement: Lead Pool FIFO

The system SHALL implement lead pool fifo as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Cho phép sale tự nhận khách từ Lead Pool theo cơ chế FIFO (vào trước ra trước), có quota kiểm soát,
đồng thời cung cấp dashboard cho quản lý theo dõi.

## Background
- Backend schema `LeadPoolConfig`, `LeadPoolDistribution`, `LeadRequest` đã có (cần verify migration).
- Frontend hiện chỉ có stub `LeadFloatingButton.vue` (EE-only).
- Quyết định: dùng FIFO (First-In-First-Out) — ai đến trước thì nhận trước. Round-robin sẽ làm
  phiên bản sau.

## Scenarios

### S1 — Sale nhận lead thành công

**Given** có 3 lead available trong pool (lead A vào 9h, B vào 9h05, C vào 9h10)
**And** user `sale-1` còn quota (3/10 hôm nay)
**When** `sale-1` bấm "Nhận Lead"
**Then** hệ thống trả về lead A
**And** lead A chuyển trạng thái `assigned` với `assignedTo = sale-1`
**And** quota `sale-1` còn 2/10.

### S2 — Nhiều sale cùng bấm "Nhận" không trùng lead

**Given** có 1 lead D trong pool
**And** 2 user `sale-1`, `sale-2` cùng bấm "Nhận" trong cùng 1 giây
**When** 2 request song song đến backend
**Then** chỉ 1 user nhận được D, user còn lại nhận thông báo "Hết lead trong pool"
**And** transaction dùng `SELECT … FOR UPDATE SKIP LOCKED` đảm bảo không double-assign.

### S3 — Hết quota

**Given** `sale-1` đã nhận 10 lead hôm nay
**When** `sale-1` bấm "Nhận Lead"
**Then** backend trả 429 với message "Đã hết quota hôm nay"
**And** UI hiển thị `v-alert` đỏ.

### S4 — Admin xem dashboard Lead Pool

**Given** admin truy cập `/marketing/lead-pool`
**When** trang load
**Then** thấy 4 stats cards: Leads trong pool, Đã gán hôm nay, Đang chờ, Auto-return sắp tới
**And** thấy bảng 10 lead mới nhất với cột Phone (masked), Nguồn, Ngày vào, SLA, Hành động.

### S5 — Cấu hình Lead Pool

**Given** admin vào `/settings/crm/lead-pool`
**When** admin đổi "Max requests per day" từ 10 → 5
**And** bấm "Lưu"
**Then** `PUT /api/v1/lead-pool/config` thành công
**And** lần nhận tiếp theo của sale sẽ bị giới hạn 5/ngày.

## Acceptance

- [ ] Backend: 3 endpoint mới (`/leads`, `/request`, `/quota`, `/distributions`, `/config`) đều có
  unit test.
- [ ] Frontend: `LeadPoolView.vue`, `LeadPoolSettingsPage.vue`, `LeadRequestButton.vue` tồn tại.
- [ ] Quota enforce đúng (5 lần/ngày, reset lúc 00:00 theo timezone server).
- [ ] Concurrent test với 10 user cùng bấm → không có lead nào được gán 2 lần.

## Out-of-scope

- Round-robin.
- Auto-assign thông minh (theo skill, ca làm việc, geo).
- Notification real-time khi có lead mới vào pool.
