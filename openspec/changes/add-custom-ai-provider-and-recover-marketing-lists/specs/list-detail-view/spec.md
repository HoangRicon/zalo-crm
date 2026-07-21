# Spec: ListDetailView phiên bản Community

> Parent: [proposal.md](../proposal.md)
> Capability: 3 — Sprint 1, R2

## ADDED Requirements

### Requirement: Route `/marketing/lists/:id`
A new route MUST be registered that renders `ListDetailView` for `:id`. When `:id` does not exist or belongs to a different org, the view MUST show an empty state with a "Quay lại danh sách" button.

#### Scenario: Mở chi tiết tệp hợp lệ
- **WHEN** user clicks the name of a list in `ListsView`
- **THEN** router navigates to `/marketing/lists/<id>`
- **AND** `ListDetailView` renders with the list's data
- **AND** breadcrumb shows: "Marketing / Tệp khách hàng / <tên tệp>"

#### Scenario: id không tồn tại
- **WHEN** user navigates to `/marketing/lists/<invalid-id>`
- **THEN** an empty state appears: "Không tìm thấy tệp" with a "Quay lại danh sách" button

### Requirement: Tab Tổng quan
The first tab of `ListDetailView` MUST display: list name, creator, creation date, status chip, 4 stat cards (Tổng KH / Hợp lệ / Có Zalo / Trùng CRM), a 3-segment progress bar (valid/dup/invalid), a mini donut chart of source distribution, and a floating action bar with buttons "Tạo broadcast từ tệp này", "Tạo campaign mục tiêu", "Export CSV".

#### Scenario: Render tab Tổng quan với data thật
- **WHEN** user opens a list with 1000 entries (800 valid, 100 dup, 100 invalid, 600 có Zalo)
- **THEN** 4 stat cards show: "Tổng KH: 1.000", "Hợp lệ: 800", "Có Zalo: 600", "Trùng CRM: 100"
- **AND** progress bar segments: 80% green, 10% yellow, 10% red
- **AND** the action bar is visible at the bottom of the tab

### Requirement: Tab Khách hàng
The second tab MUST show a paginated table of customers in the list, with columns: #, Tên, SĐT, Trạng thái (valid/dup/no-zalo), Có Zalo (✓/✗), Ngày thêm, Notes. The tab MUST support search (debounced 300ms), filter dropdown (Tất cả / Hợp lệ / Trùng trong file / Đã có trong CRM / Không có Zalo), column sort (click header Tên or Ngày thêm), and pagination (25/50/100 per page).

#### Scenario: Search filter
- **WHEN** user types "Nguyễn" in the search box
- **THEN** the table refreshes (after 300ms debounce) to show only entries whose name or phone contains "Nguyễn"

#### Scenario: Filter theo trạng thái
- **WHEN** user selects "Đã có trong CRM" from the filter dropdown
- **THEN** the table shows only entries flagged as duplicate in CRM

#### Scenario: Hiển thị KH có Friend record
- **WHEN** a customer in the list has a Friend record
- **THEN** the "Có Zalo" column shows ✓ with tooltip "Đã kết bạn ngày X"
- **AND** a mini `scoreBreakdown` is visible (if scoring exists)

### Requirement: Tab Lịch sử
The third tab MUST display a chronological list (DESC by time) of events related to this list (imports, status changes, shareable toggle changes). Each event MUST show: an icon, a human-readable message, and a relative timestamp.

#### Scenario: Hiển thị lịch sử archive
- **WHEN** a list was archived on 2026-07-15
- **THEN** the "Lịch sử" tab shows: icon + "Ngày X, User Y archive tệp" + relative time

### Requirement: Tab Cài đặt
The fourth tab MUST provide a form to edit list properties (name, integration key, shareable-to-pool toggle) and admin actions (archive, delete). The "fbLocked" state MUST disable editing of name and deletion. Only admin/owner roles can see the destructive action buttons.

#### Scenario: Admin edit tên tệp
- **WHEN** admin (role=admin/owner) changes the list name and clicks "Lưu thay đổi"
- **THEN** a PATCH request to `/api/v1/customer-lists/:id` succeeds
- **AND** the list's name updates in `ListsView` on next refresh

#### Scenario: fbLocked list không cho đổi tên
- **WHEN** user views a list with `fbLocked=true`
- **THEN** the "Tên tệp" input is disabled with tooltip "Tệp khoá: tạo tự động từ FB Form"
- **AND** the "Xoá" button is disabled with tooltip

### Requirement: Action bar — Tạo broadcast từ tệp
A button labeled "Tạo broadcast từ tệp này" MUST navigate to `/marketing/broadcasts?listId=<id>`. The `BroadcastsView` MUST read `route.query.listId` and pre-fill the form.

#### Scenario: Click nút tạo broadcast
- **WHEN** user clicks "Tạo broadcast từ tệp này" on the detail view of list A
- **THEN** router navigates to `/marketing/broadcasts?listId=<id của A>`
- **AND** `BroadcastsView` opens the create modal with `form.customerListId` pre-filled
- **AND** a toast appears: "📂 Đã chọn tệp '<tên tệp A>'"

### Requirement: Action bar — Tạo campaign mục tiêu
A button labeled "Tạo campaign mục tiêu" MUST navigate to `/marketing/targets?listId=<id>`. The `TargetsView` MUST read `route.query.listId` and pre-fill the form.

#### Scenario: Click nút tạo campaign
- **WHEN** user clicks "Tạo campaign mục tiêu" on the detail view of list A
- **THEN** router navigates to `/marketing/targets?listId=<id của A>`
- **AND** `TargetsView` opens the create wizard with `form.customerListId` pre-filled
- **AND** a toast appears: "📂 Đã chọn tệp '<tên tệp A>'"

### Requirement: Polling refresh stats
The `ListDetailView` MUST poll the list data every 5 seconds via `setInterval` to keep stats in sync with cron workers (e.g. `list-counter-refresh.ts`). The interval MUST be cleared on component unmount.

#### Scenario: Auto-refresh khi cron cập nhật
- **WHEN** user is on the detail view of list A AND a background cron updates list A's `hasZaloEntries` from 100 to 150
- **THEN** within 5 seconds, the "Có Zalo" stat card shows the new value (150)