# Capability: Group Scan page scroll
## ADDED Requirements

### Requirement: Group Scan Scroll

The system SHALL implement group scan scroll as described in this change.

#### Scenario: Implementation complete

- **WHEN** the corresponding commit is merged
- **THEN** the implementation SHALL satisfy the scenarios described below in this spec file.

---


## Goal
Khôi phục khả năng cuộn dọc cho bảng kết quả trong trang Quét nhóm (`/marketing/group-scan`).

## Background
- `frontend/src/views/GroupScanView.vue` dùng flex container.
- Container scroll bên trong thiếu `max-height` và parent thiếu `min-height: 0` → nội dung tràn ra
  ngoài viewport, không cuộn được.

## Scenarios

### S1 — Cuộn được khi nhiều nhóm

**Given** đã quét được 50 nhóm
**When** user ở `/marketing/group-scan`
**Then** vùng bảng kết quả có scroll bar dọc
**And** user cuộn xuống để xem các nhóm còn lại.

### S2 — Không ảnh hưởng các phần khác

**Given** user đang cuộn bảng kết quả
**When** header "Kết quả quét" và sidebar đứng yên
**Then** header vẫn hiển thị cố định (sticky nếu có), không bị cuộn theo.

## Acceptance

- [ ] Thêm `class="overflow-y-auto"` + `style="max-height: calc(100vh - 240px)"` (hoặc tương đương)
  cho container bảng.
- [ ] Parent flex có `min-height: 0`.

## Out-of-scope

- Không phân trang.
- Không sticky column.
- Không đổi logic filter.
