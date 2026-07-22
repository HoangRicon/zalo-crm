# SPEC: Trang Automation (Quản lý Tự động hóa)

## 1. Overview

**Mục tiêu:** Tạo trang `/automation` (hoặc `/settings/crm/automation`) để quản lý các quy tắc tự động hóa workflow trong CRM.

**Phạm vi phiên bản:** Community Edition (Community Extension)

**Phụ thuộc:**
- Backend: Trigger system (broadcast cron, target cron đã có)
- Frontend: Vue 3 + Vuetify 3 + TypeScript

---

## 2. Chức năng chính

### 2.1 Trang Tổng quan (Dashboard Automation)

**Mục đích:** Hiển thị danh sách các automation rules và trạng thái hoạt động.

**Thành phần:**
- **Header:** Tiêu đề "Tự động hóa" + nút "Tạo mới automation"
- **Stats Cards:**
  - Tổng số automation rules
  - Đang chạy (active)
  - Đang tạm dừng (paused)
  - Đã chạy hôm nay
- **Bảng danh sách Automation:**
  | Cột | Mô tả |
  |-----|--------|
  | Tên | Tên automation |
  | Loại | Broadcast / Target / Welcome / Follow-up / Tagging |
  | Trigger | Sự kiện kích hoạt |
  | Trạng thái | Active / Paused / Draft |
  | Lần chạy cuối | Thời gian |
  | Hành động | Sửa / Tạm dừng / Xóa |

### 2.2 Loại Automation Rules

| Loại | Trigger | Action | Mô tả |
|------|---------|--------|--------|
| **Welcome Message** | Khách hàng mới được thêm | Gửi tin nhắn chào mừng | Tự động gửi tin khi có KH mới |
| **Follow-up** | Khách không phản hồi sau X ngày | Gửi tin nhắc / Gắn tag | Duy trì engagement |
| **Tagging** | Điều kiện thỏa mãn | Gắn/bỏ tag | Phân loại tự động |
| **Assignment** | Lead mới | Gán cho sale | Tự động phân công |
| **Broadcast** | Đặt lịch | Gửi broadcast | Gửi tin hàng loạt |
| **Target** | Đặt lịch | Kết bạn tự động | Auto friend-add |

### 2.3 Modal/Form Tạo Automation

**Trigger Section:**
- Dropdown chọn loại trigger:
  - `manual` - Thủ công
  - `scheduled` - Đặt lịch (cron)
  - `event` - Theo sự kiện (khách mới, sinh nhật, v.v.)
- Cấu hình chi tiết trigger (depends on type)

**Conditions Section (Optional):**
- Thêm điều kiện lọc:
  - Tag chứa / không chứa
  - Trạng thái khách hàng
  - Nguồn (source)
  - Ngày tạo

**Actions Section:**
- Thêm actions (có thể nhiều actions):
  - Send message (chọn template)
  - Add/Remove tag
  - Assign to user/department
  - Send notification (in-app)

### 2.4 Notifications Panel

**Mục đích:** Trang cài đặt thông báo cá nhân cho người dùng.

**Thành phần:**
- Toggle notifications theo loại sự kiện:
  - Tin nhắn mới
  - Lead mới được gán
  - Lịch hẹn sắp tới
  - Engagement score thay đổi
  - Broadcast hoàn thành
- Sound toggle
- Quiet hours settings

---

## 3. Data Model (Frontend Types)

```typescript
interface AutomationRule {
  id: string;
  name: string;
  type: 'welcome' | 'followup' | 'tagging' | 'assignment' | 'broadcast' | 'target';
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  status: 'active' | 'paused' | 'draft';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
}

interface AutomationTrigger {
  type: 'manual' | 'scheduled' | 'event';
  config: Record<string, any>;
}

interface AutomationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value: any;
}

interface AutomationAction {
  type: 'send_message' | 'add_tag' | 'remove_tag' | 'assign' | 'notification';
  config: Record<string, any>;
}
```

---

## 4. API Endpoints (Frontend Calls)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/automations` | Lấy danh sách automation rules |
| GET | `/automations/:id` | Lấy chi tiết 1 rule |
| POST | `/automations` | Tạo mới automation |
| PUT | `/automations/:id` | Cập nhật automation |
| DELETE | `/automations/:id` | Xóa automation |
| POST | `/automations/:id/toggle` | Bật/tắt automation |
| POST | `/automations/:id/run` | Chạy thủ công |
| GET | `/automations/:id/logs` | Lịch sử chạy |

---

## 5. Routing

**Thêm route mới:**

```typescript
// Trong router/index.ts
{
  path: '/automation',
  name: 'Automation',
  component: () => import('@/views/AutomationView.vue'),
  meta: { requiresAuth: true, resource: 'automation' }
}
```

**Thêm vào navigation (DefaultLayout.vue):**

```typescript
// Trong primaryTabs hoặc marketing menu
{ path: '/automation', label: 'Tự động hóa', icon: 'mdi-robot-outline' }
```

---

## 6. UI/UX Design

**Design System:** Theo Atlas v2 / HS Holding theme hiện tại

**Color Palette:**
- Primary: `#6366F1` (Indigo)
- Success: `#36B37E` (Green)
- Warning: `#FF8B00` (Orange)
- Danger: `#DE350B` (Red)

**Spacing:** 8px grid system

**Typography:** System font stack (Segoe UI / SF Pro)

---

## 7. File Structure

```
frontend/src/
├── views/
│   └── AutomationView.vue          # Trang chính automation
├── components/automation/
│   ├── AutomationTable.vue         # Bảng danh sách
│   ├── AutomationForm.vue          # Form tạo/sửa
│   ├── AutomationStats.vue        # Stats cards
│   └── AutomationLogs.vue         # Lịch sử chạy
├── api/
│   └── automation.ts              # API calls
└── types/
    └── automation.ts              # TypeScript interfaces

backend/src/
├── modules/automation/
│   ├── automation-routes.ts      # API routes
│   ├── automation-controller.ts   # Controller
│   └── automation-service.ts      # Business logic
└── prisma/
    └── schema.prisma              # Thêm model AutomationRule
```

---

## 8. Backend Schema (Prisma Extension)

```prisma
model AutomationRule {
  id          String   @id @default(uuid())
  name        String
  type        String   // welcome, followup, tagging, assignment, broadcast, target
  triggerType String   // manual, scheduled, event
  triggerConfig Json
  conditions  Json?
  actions    Json
  status     String   @default("active") // active, paused, draft
  runCount   Int      @default(0)
  lastRunAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  orgId      String
  
  @@map("automation_rules")
}

model AutomationLog {
  id          String   @id @default(uuid())
  ruleId      String
  status      String   // success, failed, skipped
  triggeredBy String?
  result      Json?
  error       String?
  createdAt   DateTime @default(now())
  
  @@map("automation_logs")
}
```

---

## 9. Acceptance Criteria

### Must Have (P0)
- [ ] Trang Automation hiển thị danh sách rules
- [ ] Form tạo automation với trigger và action cơ bản
- [ ] Toggle bật/tắt automation
- [ ] Xóa automation
- [ ] Stats cards hiển thị số liệu

### Should Have (P1)
- [ ] Conditions (điều kiện lọc)
- [ ] Logs xem lịch sử chạy
- [ ] Chạy thủ công (run now)

### Nice to Have (P2)
- [ ] Drag-drop reorder actions
- [ ] Preview trigger simulation
- [ ] Duplicate automation

---

## 10. Dependencies & Blockers

- [ ] Backend: Cần API endpoints `/automations/*` (hiện tại chưa có)
- [ ] Database: Cần migration thêm bảng `automation_rules` và `automation_logs`
- [ ] Frontend: Cần tạo components và API client

**Ghi chú:** Nếu backend chưa sẵn sàng, có thể implement frontend với mock data trước.

---

---

# SPEC BỔ SUNG: Lead Pool (Leads Pool)

## 11. Overview - Lead Pool

**Mục tiêu:** Tạo UI cho Lead Pool - hệ thống phân phối và quản lý leads tự động.

**Phạm vi phiên bản:** Community Edition

**Tình trạng hiện tại:**
- ✅ Backend: Đã có schema `LeadPoolConfig`, `LeadPoolDistribution`, `LeadRequest`
- ❌ Frontend: Chỉ có stub `LeadFloatingButton.vue` (EE-only)

---

## 12. Chức năng chính - Lead Pool

### 12.1 Lead Pool Dashboard

**Mục đích:** Trang tổng quan Lead Pool cho quản lý.

**Thành phần:**
- **Header:** "Lead Pool" + cấu hình (settings icon)
- **Stats Cards:**
  - Leads trong pool (chưa gán)
  - Đã gán hôm nay
  - Đang chờ (pending requests)
  - Auto-return sắp触发
- **Bảng Leads trong Pool:**
  | Cột | Mô tả |
  |-----|--------|
  | Phone | SĐT (masked) |
  | Nguồn | forgotten / customer_list / external_sync |
  | Ngày vào pool | Thời gian |
  | SLA | Thời gian còn lại trước khi auto-return |
  | Hành động | Gán / Xem chi tiết |

### 12.2 Lead Request Management

**Mục đích:** Sale xin lead từ pool.

**Luồng:**
1. Sale bấm "Nhận Lead" (LeadFloatingButton trong Chat)
2. Hệ thống kiểm tra quota (daily limit)
3. Nếu còn quota → gán 1 lead từ pool
4. Sale phải note trước khi xin lead tiếp

### 12.3 Lead Pool Settings

**Route:** `/settings/crm/lead-pool` (thay thế Coming Soon)

**Thành phần:**
- Toggle Enable/Disable Lead Pool
- Max requests per day (default: 10)
- Cooldown minutes giữa các request
- Forgotten threshold days
- Auto-return after minutes (30 min - 7 days)
- Require phone in pool toggle
- Force note before next request toggle
- Enabled sources checkboxes

### 12.4 Lead Distribution History

**Mục đích:** Xem lịch sử phân phối lead.

**Bảng:**
| Cột | Mô tả |
|-----|--------|
| Round | Lần phân phối thứ mấy |
| Sale nhận | Tên sale |
| Phone | SĐT (masked) |
| Nguồn | Loại nguồn |
| Thời gian | Thời điểm nhận |

---

## 13. API Endpoints - Lead Pool

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/v1/lead-pool/config` | Lấy cấu hình |
| PUT | `/api/v1/lead-pool/config` | Cập nhật cấu hình |
| GET | `/api/v1/lead-pool/leads` | Danh sách leads trong pool |
| GET | `/api/v1/lead-pool/requests` | Danh sách requests |
| POST | `/api/v1/lead-pool/request` | Sale xin 1 lead |
| GET | `/api/v1/lead-pool/distributions` | Lịch sử phân phối |
| GET | `/api/v1/lead-pool/quota` | Lấy quota còn lại của user |

---

## 14. Routing - Lead Pool

```typescript
// Thêm vào router/index.ts
{
  path: '/marketing/lead-pool',
  name: 'Marketing.LeadPool',
  component: () => import('@/views/marketing/LeadPoolView.vue'),
  meta: { requiresAuth: true, resource: 'lead_pool' }
}

// Thêm route settings
{
  path: 'settings/crm/lead-pool',
  name: 'Settings.LeadPool',
  component: () => import('@/views/settings/LeadPoolSettingsPage.vue'),
  meta: { requiresAuth: true, resource: 'settings' }
}
```

---

## 15. Lead Pool Component Structure

```
frontend/src/
├── views/
│   ├── marketing/
│   │   └── LeadPoolView.vue           # Dashboard + list
│   └── settings/
│       └── LeadPoolSettingsPage.vue   # Settings
├── components/
│   └── lead-pool/
│       ├── LeadPoolTable.vue          # Bảng leads
│       ├── LeadRequestList.vue       # Bảng requests
│       ├── LeadDistributionHistory.vue # Lịch sử
│       └── LeadPoolConfigForm.vue     # Form cấu hình
└── api/
    └── lead-pool.ts                   # API calls
```

---

---

# SPEC BỔ SUNG: Lead Ads (Facebook & Zalo Ads)

## 16. Overview - Lead Ads

**Mục tiêu:** Quản lý Lead Ads từ Facebook và Zalo Ads.

**Tình trạng hiện tại:**
- ✅ Backend: Đã có schema `FacebookLeadgenForm`, webhook handlers
- ❌ Frontend: Chưa có UI

---

## 17. Chức năng chính - Lead Ads

### 17.1 Lead Ads Dashboard

**Route:** `/settings/channels/lead-ads` (thay thế Coming Soon)

**Thành phần:**
- **Tabs:** Facebook Lead Ads | Zalo Ads Lead Forms
- **Stats Cards:**
  - Tổng leads hôm nay
  - Tổng leads tuần này
  - Forms đang active
  - Last sync time

### 17.2 Facebook Lead Ads

**Bảng Forms:**
| Cột | Mô tả |
|-----|--------|
| Form Name | Tên form |
| Page | Facebook Page |
| Status | Active / Archived |
| Leads hôm nay | Số leads |
| Last Pull | Thời gian sync cuối |
| Hành động | Chi tiết / Pull now / Archive |

**Chi tiết Form:**
- Thông tin form
- Danh sách leads gần đây
- Nút "Pull Now" để sync thủ công
- Lịch sử sync

### 17.3 Zalo Ads Lead Forms

**Tương tự Facebook:**
- Bảng forms
- Chi tiết từng form
- Sync manual

### 17.4 Lead Preview

**Modal hiển thị chi tiết lead:**
- Thông tin khách hàng (từ form)
- Nguồn form
- Thời gian submit
- Nút "Chuyển thành Contact"

---

## 18. API Endpoints - Lead Ads

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/v1/facebook-lead-ads/forms` | Danh sách Facebook forms |
| GET | `/api/v1/facebook-lead-ads/forms/:id` | Chi tiết form |
| GET | `/api/v1/facebook-lead-ads/forms/:id/leads` | Leads từ form |
| POST | `/api/v1/facebook-lead-ads/forms/:id/pull` | Pull leads thủ công |
| PATCH | `/api/v1/facebook-lead-ads/forms/:id` | Cập nhật form |
| GET | `/api/v1/zalo-ads/forms` | Danh sách Zalo forms |
| GET | `/api/v1/zalo-ads/forms/:id` | Chi tiết form |
| GET | `/api/v1/zalo-ads/forms/:id/leads` | Leads từ form |

---

## 19. Routing - Lead Ads

```typescript
// Trong settings children
{
  path: 'channels/lead-ads',
  name: 'Settings.LeadAds',
  component: () => import('@/views/settings/LeadAdsPage.vue'),
  meta: { requiresAuth: true, resource: 'settings' }
}
```

---

## 20. Component Structure - Lead Ads

```
frontend/src/
├── views/
│   └── settings/
│       └── LeadAdsPage.vue            # Main page with tabs
├── components/
│   └── lead-ads/
│       ├── FacebookFormsTable.vue     # Facebook forms
│       ├── ZaloFormsTable.vue        # Zalo forms
│       ├── LeadAdsDetail.vue         # Chi tiết form
│       └── LeadPreview.vue           # Preview lead modal
└── api/
    └── lead-ads.ts                   # API calls
```

---

## 21. Acceptance Criteria - Lead Pool & Lead Ads

### Lead Pool
- [ ] Lead Pool Dashboard hiển thị stats + bảng
- [ ] Sale có thể request lead (với quota check)
- [ ] Admin có thể cấu hình Lead Pool
- [ ] Xem lịch sử phân phối
- [ ] LeadFloatingButton hoạt động trong Chat

### Lead Ads
- [ ] Trang Lead Ads với tabs Facebook / Zalo
- [ ] Bảng forms với thông tin sync
- [ ] Chi tiết form + danh sách leads
- [ ] Pull now thủ công
- [ ] Preview lead details

---

## 22. Dependencies - Lead Pool & Lead Ads

### Lead Pool
- [x] Backend: Schema đã có (`LeadPoolConfig`, `LeadPoolDistribution`)
- [ ] Backend: API routes cho Lead Pool
- [ ] Frontend: UI components

### Lead Ads
- [x] Backend: Schema đã có (`FacebookLeadgenForm`)
- [ ] Backend: API routes cho Lead Ads
- [ ] Frontend: UI components
