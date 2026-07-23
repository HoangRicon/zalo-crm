# Spec: report-cache-fix

## Purpose

Backend report endpoints (`/api/v1/reports/*`) đã implement cache helper `getCached`/`setCached` với TTL 1 phút, nhưng do lỗi implementation, cache **không bao giờ HIT**: 8/8 endpoint `return { ... }` trực tiếp mà không gán `const result = ...`, khiến `setCached(cacheKey, result)` thành dead code. Kết quả: mỗi request dashboard đều re-query toàn bộ DB → nguyên nhân chính gây lag dashboard.

Ngoài ra còn 3 bug khác ở cùng file:
- `lead-pool:608`: duplicate `const userIds` → bảng `byUser` luôn rỗng.
- `sales-performance:362-391`: N+1 query (4 queries × N users).
- `crm-usage:1190-1207`: load 100K rows + N+1 outcomes.

## Requirements

### REQ-1: Tất cả 8 cached endpoint phải ghi cache thực sự

Áp dụng cho: `overview`, `nick-fleet`, `pipeline`, `lead-pool`, `automation`, `engagement`, `audit`, `crm-usage`.

#### Scenario

- **WHEN** endpoint `/api/v1/reports/overview` được gọi lần đầu (cache miss)
- **THEN** handler thực thi query DB, gán kết quả vào `const result`, gọi `setCached(cacheKey, result)`, return `result`
- **WHEN** cùng endpoint được gọi lần 2 trong vòng 60 giây (cache hit)
- **THEN** handler phải return cached value ngay lập tức, KHÔNG query DB
- **AND** response time phải < 50ms (so với > 500ms khi cache miss).

### REQ-2: `lead-pool` endpoint fix duplicate `userIds`

#### Scenario

- **GIVEN** Org có 3 sales đã từng nhận lead
- **WHEN** gọi `GET /api/v1/reports/lead-pool`
- **THEN** response phải có `byUser` array với 3 entries
- **AND** mỗi entry có `holding`, `returned`, `overdue` đúng theo data DB
- **WHEN** chạy TypeScript build
- **THEN** không có compile error về duplicate identifier.

### REQ-3: `sales-performance` batch query thành 4 groupBy

#### Scenario

- **GIVEN** Org có 20 sales active
- **WHEN** gọi `GET /api/v1/reports/sales-performance`
- **THEN** số lượng Prisma queries phải ≤ 10 (batch: 4 groupBy + 1 status findMany + 1 user findMany)
- **AND** response time < 500ms
- **AND** data trả về giống hệt như trước khi refactor (verified bằng cách so sánh với response từ phiên chưa fix).

### REQ-4: `crm-usage` batch outcomes thành 2 groupBy + giảm row cap

#### Scenario

- **GIVEN** Org có 30 sales
- **WHEN** gọi `GET /api/v1/reports/crm-usage`
- **THEN** số lượng Prisma queries phải ≤ 15 (thay vì 60+)
- **AND** `take: 10000` (giảm từ 100000) nhưng giữ nguyên logic aggregation
- **AND** memory peak của Node process < 500MB khi xử lý.

### REQ-5: Cache TTL và key đúng

#### Scenario

- **WHEN** request với `?from=2026-07-01&to=2026-07-24`
- **THEN** cache key phải là `<endpoint>:<orgId>:2026-07-01:2026-07-24`
- **WHEN** request từ org khác với cùng date range
- **THEN** cache phải MISS (org isolation)
- **WHEN** request vượt quá TTL
- **THEN** cache phải MISS và re-query.

### REQ-6: Không thay đổi response shape

#### Scenario

- **WHEN** response được trả về
- **THEN** JSON schema phải giống hệt phiên chưa fix
- **AND** tất cả field hiện có (`kpis`, `funnel`, `bySale`, `byDept`, v.v.) phải xuất hiện đầy đủ với cùng type.

## Constraints

- Không thay đổi Prisma schema.
- Không thay đổi endpoint path hoặc HTTP method.
- Không thay đổi response shape (chỉ sửa implementation).
- Phải giữ nguyên RBAC (`gateReportAccess`).
- Cache chỉ là in-memory Map (không Redis) — chấp nhận restart backend làm mất cache.
