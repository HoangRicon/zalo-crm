# Spec: lead-pool-claim

## Purpose

`LeadPoolView.vue:onClaimLead` hiện gọi `requestLead()` không truyền argument, khiến backend xử lý lead mặc định (lead đầu tiên available trong pool) thay vì lead user click. Hậu như chắc chắn backend đang assign sai lead cho user, gây hậu quả nghiêm trọng về nghiệp vụ.

## Requirements

### REQ-1: `onClaimLead` phải truyền `lead.id` cho `requestLead()`

#### Scenario

- **GIVEN** User ở trang `/marketing/lead-pool`
- **AND** bảng hiển thị 3 lead available: A (id=lead_aaa), B (lead_bbb), C (lead_ccc)
- **WHEN** User click button "Nhận" ở dòng B
- **THEN** function `onClaimLead(lead)` phải được gọi với `lead.id === 'lead_bbb'`
- **AND** gọi API `requestLead({ leadId: 'lead_bbb' })` (hoặc argument name đúng theo `frontend/src/api/lead-pool.ts`)
- **AND** backend log cho thấy `lead_bbb` được assign cho user đó.

### REQ-2: Argument name phải khớp với backend API

#### Scenario

- **WHEN** đọc file `frontend/src/api/lead-pool.ts` để xác định signature `requestLead(...)`
- **THEN** argument name là `leadId` (HOẶC `id` — tùy theo file hiện tại)
- **AND** cùng argument name phải được truyền trong `LeadPoolView.vue:onClaimLead`.
- **AND** backend `lead-pool-service.ts:requestLead(orgId, userId, leadId?)` đã được cập nhật để nhận optional `leadId`.
- **AND** route `POST /api/v1/lead-pool/request` đã cập nhật để parse `request.body.leadId` và truyền xuống service.
- **AND** khi `leadId` không thuộc pool (đã bị assign hoặc nằm trong excludedStatuses), service trả về `{ success: false, error: 'lead_unavailable' }` → HTTP 404.

### REQ-3: Error handling giữ nguyên

#### Scenario

- **WHEN** `requestLead()` fail với error code `in_cooldown`, `quota_exceeded`, `no_leads_in_pool`
- **THEN** UI phải hiển thị thông báo thân thiện (mapping ở line 450-455) như trước fix
- **AND** `claimingId.value` được reset về `null`
- **AND** `claimError.value` tự clear sau 5 giây.

### REQ-4: Refresh list + stats sau khi claim

#### Scenario

- **WHEN** `requestLead()` thành công
- **THEN** gọi `await Promise.all([fetchPoolLeads(), fetchStats()])`
- **AND** UI cập nhật: lead đó biến mất khỏi pool list, stats giảm `leadsInPool` đi 1.

## Constraints

- Không thay đổi API endpoint backend (`/api/v1/lead-pool/request`).
- Không thay đổi UI layout hoặc button placement.
- Không thay đổi error code mapping ở line 450-455.
- Phải giữ `await import('@/api/lead-pool')` dynamic import (lazy load).
