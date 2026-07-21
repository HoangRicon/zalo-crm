# Spec: Wire nút Tạo Broadcast/Campaign từ ListsView

> Parent: [proposal.md](../proposal.md)
> Capability: 4 — Sprint 1, R3

## ADDED Requirements

### Requirement: Nút "Tạo broadcast từ tệp" trong ListsView
The existing `<v-icon>mdi-send</v-icon>` icon button in the row-actions of `ListsView` MUST be wired to navigate to `/marketing/broadcasts?listId=<id>`. The click event MUST NOT bubble up to the row (which would trigger detail navigation).

#### Scenario: Click nút broadcast
- **WHEN** user clicks the "send" icon on row of list A
- **THEN** router navigates to `/marketing/broadcasts?listId=<id>`
- **AND** the click does NOT navigate to `/marketing/lists/<id>`

### Requirement: Nút mới "Tạo campaign mục tiêu từ tệp"
A new button MUST be added to the row-actions of `ListsView` using `<v-icon>mdi-account-multiple-plus-outline</v-icon>` icon with tooltip "Tạo campaign mục tiêu". Clicking MUST navigate to `/marketing/targets?listId=<id>` without bubbling.

#### Scenario: Click nút campaign
- **WHEN** user clicks the new "account-multiple-plus" icon on row of list A
- **THEN** router navigates to `/marketing/targets?listId=<id>`
- **AND** the click does NOT navigate to `/marketing/lists/<id>`

### Requirement: BroadcastsView đọc route.query.listId
The `BroadcastsView` component MUST check `route.query.listId` on mount. If present, it MUST call `openCreate()` with `form.customerListId` pre-filled. If absent, the view MUST behave as before (empty form).

#### Scenario: Có query.listId
- **WHEN** `BroadcastsView` mounts with `route.query.listId = "abc123"`
- **THEN** `form.customerListId = "abc123"` (pre-filled)
- **AND** a success toast appears: "📂 Đã chọn tệp '<tên tệp>'"

#### Scenario: Không có query.listId
- **WHEN** `BroadcastsView` mounts without `route.query.listId`
- **THEN** behavior is unchanged from before (form starts empty)

### Requirement: TargetsView đọc route.query.listId
The `TargetsView` component MUST check `route.query.listId` on mount and pre-fill the create wizard's `customerListId` field similarly to `BroadcastsView`.

#### Scenario: Có query.listId
- **WHEN** `TargetsView` mounts with `route.query.listId = "abc123"`
- **THEN** the create wizard opens with `customerListId = "abc123"`
- **AND** a success toast appears: "📂 Đã chọn tệp '<tên tệp>'"

### Requirement: Toast feedback sau navigation
After successful pre-fill, the destination view MUST show a confirmation toast so the user knows the list was selected.

#### Scenario: Toast tự đóng
- **WHEN** the toast appears
- **THEN** it auto-dismisses after 3 seconds