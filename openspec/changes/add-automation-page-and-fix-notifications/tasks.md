# Task Plan: Automation Page + Notifications Fix

## Project: Zalo CRM - Sprint Automation

---

## Phase 1: Analysis & Spec (COMPLETED)

### Files Created
- [x] `openspec/changes/add-automation-page-and-fix-notifications/spec.md`

### Key Decisions
1. **Routing:** Sử dụng `/automation` top-level route (không nested trong settings)
2. **Design:** Theo Atlas v2 theme system hiện tại
3. **Backend:** Cần tạo API endpoints mới

---

## Phase 4: Implementation Tasks

### Task 1: Backend - Automation API
**Status:** PENDING

**Files to create/modify:**
- [ ] `backend/src/modules/automation/automation-routes.ts`
- [ ] `backend/src/modules/automation/automation-controller.ts`
- [ ] `backend/src/modules/automation/automation-service.ts`
- [ ] `backend/src/app.ts`

### Task 2: Backend - Lead Pool API
**Status:** PENDING

**Files to create/modify:**
- [ ] `backend/src/modules/lead-pool/lead-pool-routes.ts`
- [ ] `backend/src/modules/lead-pool/lead-pool-controller.ts`
- [ ] `backend/src/modules/lead-pool/lead-pool-service.ts`

### Task 3: Backend - Lead Ads API
**Status:** PENDING

**Files to create/modify:**
- [ ] `backend/src/modules/lead-ads/lead-ads-routes.ts`
- [ ] `backend/src/modules/lead-ads/lead-ads-controller.ts`

### Task 4: Frontend - Automation View
**Status:** PENDING

**Files to create:**
- [ ] `frontend/src/views/AutomationView.vue`
- [ ] `frontend/src/components/automation/AutomationTable.vue`
- [ ] `frontend/src/components/automation/AutomationForm.vue`
- [ ] `frontend/src/components/automation/AutomationStats.vue`
- [ ] `frontend/src/api/automation.ts`
- [ ] `frontend/src/types/automation.ts`

### Task 5: Frontend - Lead Pool View
**Status:** PENDING

**Files to create:**
- [ ] `frontend/src/views/marketing/LeadPoolView.vue`
- [ ] `frontend/src/views/settings/LeadPoolSettingsPage.vue`
- [ ] `frontend/src/components/lead-pool/LeadPoolTable.vue`
- [ ] `frontend/src/components/lead-pool/LeadPoolConfigForm.vue`
- [ ] `frontend/src/api/lead-pool.ts`

### Task 6: Frontend - Lead Ads View
**Status:** PENDING

**Files to create:**
- [ ] `frontend/src/views/settings/LeadAdsPage.vue`
- [ ] `frontend/src/components/lead-ads/FacebookFormsTable.vue`
- [ ] `frontend/src/components/lead-ads/ZaloFormsTable.vue`
- [ ] `frontend/src/components/lead-ads/LeadPreview.vue`
- [ ] `frontend/src/api/lead-ads.ts`

### Task 7: Frontend - Notifications Page
**Status:** PENDING

**Files to modify:**
- [ ] Replace `SettingsComingSoon.vue` with real component
- [ ] Create `frontend/src/views/settings/PersonalNotificationsPage.vue`

### Task 8: Frontend - Routing & Navigation
**Status:** PENDING

**Files to modify:**
- [ ] `frontend/src/router/index.ts`
- [ ] `frontend/src/layouts/DefaultLayout.vue`

### Task 9: Docker - Rebuild
**Status:** PENDING

---

## Phase 3: Testing

### Manual Testing Checklist
- [ ] Navigate to `/automation` - page loads
- [ ] Click "Tạo mới" - form opens
- [ ] Fill form and submit - rule created
- [ ] Toggle status - status changes
- [ ] Delete rule - rule removed
- [ ] Navigate to `/settings/personal/notifications` - page loads

### API Testing
```bash
# Test endpoints
curl http://localhost:3080/api/v1/automations
curl -X POST http://localhost:3080/api/v1/automations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","type":"welcome","triggerType":"event","actions":[]}'
```

---

## Phase 4: Documentation

- [ ] Update README if needed
- [ ] Add comments to complex code
- [ ] Update API documentation

---

## File Structure Map

```
zalo-crm/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma                    [MODIFY]
│   └── src/
│       ├── app.ts                           [MODIFY]
│       └── modules/
│           └── automation/                   [CREATE]
│               ├── automation-routes.ts     [CREATE]
│               ├── automation-controller.ts [CREATE]
│               └── automation-service.ts    [CREATE]
├── frontend/
│   └── src/
│       ├── api/
│       │   └── automation.ts               [CREATE]
│       ├── components/
│       │   └── automation/                 [CREATE]
│       │       ├── AutomationTable.vue     [CREATE]
│       │       ├── AutomationForm.vue      [CREATE]
│       │       └── AutomationStats.vue    [CREATE]
│       ├── router/
│       │   └── index.ts                    [MODIFY]
│       ├── types/
│       │   └── automation.ts               [CREATE]
│       └── views/
│           ├── AutomationView.vue           [CREATE]
│           └── settings/
│               └── PersonalNotificationsPage.vue [CREATE/REPLACE]
└── docker/
    └── Dockerfile.dev                      [MODIFY - if needed]
```

---

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Backend API | ⏳ Pending | |
| Task 2: DB Schema | ⏳ Pending | |
| Task 3: Frontend View | ⏳ Pending | |
| Task 4: Routing/Nav | ⏳ Pending | |
| Task 5: Notifications | ⏳ Pending | |
| Task 6: Docker Rebuild | ⏳ Pending | |

---

## Notes & Blockers

1. **Backend API:** Cần tạo hoàn toàn mới - no existing automation module
2. **Permissions:** Cần thêm resource 'automation' vào RBAC
3. **Design:** Sử dụng existing Atlas v2 design tokens
4. **Mock Data:** Có thể bắt đầu với mock data nếu backend chưa ready
