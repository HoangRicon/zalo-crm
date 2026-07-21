# Spec: Import CSV/Excel cho Tệp khách hàng

> Parent: [proposal.md](../proposal.md)
> Capability: 2 — Sprint 1, R1

## ADDED Requirements

### Requirement: Bỏ disabled nút Import CSV
The "Import CSV" button on `/marketing/lists` MUST NOT have a `disabled` attribute and MUST open `CreateListModal` with the "Import CSV" tab active when clicked.

#### Scenario: Click nút Import CSV
- **WHEN** user (with `customer_lists:create` permission) clicks the "Import CSV" button on `/marketing/lists`
- **THEN** `CreateListModal` opens with the "Import CSV" tab visible and active

### Requirement: Tab "Import CSV" trong CreateListModal
The `CreateListModal` MUST show two tabs: "Tạo rỗng" (existing) and "Import CSV" (new). The "Import CSV" tab MUST contain:
- A textarea for pasting SĐT
- A file input accepting `.csv` and `.xlsx`
- A preview table (first 10 rows)
- A stats panel showing total/valid/dup-in-file/dup-in-CRM/invalid counts
- A submit button labeled "Tạo tệp & Import", disabled when no data is provided.

#### Scenario: Chuyển tab sang Import CSV
- **WHEN** user clicks the "Import CSV" tab in `CreateListModal`
- **THEN** the tab content with textarea, file input, preview area, and stats panel becomes visible

### Requirement: Auto-detect delimiter
The system MUST auto-detect whether pasted/uploaded content uses `,`, `;`, or `\t` as delimiter by counting occurrences of each in the first row.

#### Scenario: Delimiter là dấu chấm phẩy
- **WHEN** user pastes `0901234567;Nguyễn Văn A;note\n0902345678;Trần Thị B;note`
- **THEN** the preview shows 3 columns (SĐT, Tên, Note) and column 1 is highlighted as "SĐT"

#### Scenario: Delimiter là dấu phẩy
- **WHEN** user pastes `0901234567,Nguyen Van A\n0902345678,Tran Thi B`
- **THEN** the preview shows 2 columns and column 1 is highlighted as "SĐT"

### Requirement: Validation real-time SĐT Việt Nam
The system MUST validate each SĐT entry as it is entered (debounced 500ms). A phone is "valid" if it matches `0[3|5|7|8|9]xxxxxxxx` (10 digits, starts with 03/05/07/08/09).

#### Scenario: 100 SĐT với tỉ lệ 80/5/5/10
- **WHEN** user pastes/uploads 100 SĐT containing 80 valid, 10 invalid (non-phone strings), 5 duplicate within the file, and 5 already-existing CRM contacts
- **THEN** the stats panel shows: "Tổng: 100", "Hợp lệ: 80" (green), "Trùng trong file: 5" (yellow), "Đã có trong CRM: 5" (orange), "Không hợp lệ: 10" (red)
- **AND** the submit button is enabled (because there is at least 1 valid entry)

### Requirement: Confirm dialog trước khi submit
Before sending the import request to the server, the UI MUST show a confirmation dialog summarizing the stats and the chosen list name.

#### Scenario: User xác nhận import
- **WHEN** user clicks "Tạo tệp & Import" with 80 valid SĐT and a list name
- **THEN** a confirm dialog shows: "Tạo tệp mới tên '<name>' với 80 SĐT hợp lệ?" with stats breakdown and two buttons "Import" / "Huỷ"
- **AND** only clicking "Import" triggers `POST /api/v1/customer-lists/import`

### Requirement: Handle import thành công
After a successful import (HTTP 201), the UI MUST close the modal, show a success toast, and navigate to `/marketing/lists/<id>` for the newly created list. The ListsView MUST refresh to show the new list.

#### Scenario: API trả 201 với id mới
- **WHEN** import API returns `{id: "new-id", totalEntries: 100, validEntries: 80}`
- **THEN** a success toast appears: "Đã tạo tệp '<name>' với 80 SĐT hợp lệ"
- **AND** the modal closes
- **AND** the user is navigated to `/marketing/lists/new-id`

### Requirement: Handle import lỗi
On import failure, the UI MUST display a clear error toast and MUST keep the modal open with the user's data intact for retry.

#### Scenario: Server trả 400 rate_limited
- **WHEN** server returns 400 `{error: "rate_limited"}`
- **THEN** an error toast appears: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút."
- **AND** the modal stays open with the data intact

#### Scenario: File upload > 5MB
- **WHEN** user selects a file larger than 5MB
- **THEN** a client-side guard blocks the request and shows toast: "File quá lớn (>5MB). Vui lòng tách nhỏ."
- **AND** no request is sent to the server