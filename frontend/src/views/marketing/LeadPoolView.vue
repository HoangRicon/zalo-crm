<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- LeadPoolView.vue — Lead Pool Dashboard -->
<template>
  <div class="lead-pool-view">
    <!-- Header -->
    <div class="lpv-header">
      <div class="lpv-title-row">
        <div>
          <h1 class="lpv-title">Lead Pool</h1>
          <p class="lpv-subtitle">Quản lý và phân phối lead cho đội ngũ sale — nhân viên tự nhận lead từ pool theo thứ tự FIFO (ai nhận trước được lead cũ nhất).</p>
        </div>
        <div class="lpv-actions">
          <button class="btn btn-ghost" @click="refresh">
            <v-icon size="16">mdi-refresh</v-icon>
            Làm mới
          </button>
        </div>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="lpv-stats">
      <div class="lpv-stat">
        <div class="lpv-stat-icon pool">
          <v-icon size="20">mdi-account-group-outline</v-icon>
        </div>
        <div class="lpv-stat-content">
          <div class="lpv-stat-value">{{ stats.leadsInPool.toLocaleString('vi-VN') }}</div>
          <div class="lpv-stat-label">Lead trong pool</div>
        </div>
      </div>

      <div class="lpv-stat">
        <div class="lpv-stat-icon assigned">
          <v-icon size="20">mdi-account-check-outline</v-icon>
        </div>
        <div class="lpv-stat-content">
          <div class="lpv-stat-value">{{ stats.assignedToday.toLocaleString('vi-VN') }}</div>
          <div class="lpv-stat-label">Đã chia hôm nay</div>
        </div>
      </div>

      <div class="lpv-stat">
        <div class="lpv-stat-icon pending">
          <v-icon size="20">mdi-clock-outline</v-icon>
        </div>
        <div class="lpv-stat-content">
          <div class="lpv-stat-value">{{ stats.pendingRequests.toLocaleString('vi-VN') }}</div>
          <div class="lpv-stat-label">Yêu cầu chờ</div>
        </div>
      </div>

      <div class="lpv-stat">
        <div class="lpv-stat-icon auto-return">
          <v-icon size="20">mdi-autorenew</v-icon>
        </div>
        <div class="lpv-stat-content">
          <div class="lpv-stat-value">{{ stats.upcomingAutoReturns.toLocaleString('vi-VN') }}</div>
          <div class="lpv-stat-label">Sắp tự trả (24h)</div>
        </div>
      </div>
    </div>

    <!-- User quota info bar -->
    <div v-if="quota" class="lpv-quota-bar">
      <div class="lpv-quota-item">
        <v-icon size="14">mdi-counter</v-icon>
        <span>Hôm nay: <strong>{{ quota.usedToday }}</strong> / {{ quota.dailyLimit }} lead đã nhận</span>
      </div>
      <div v-if="quota.remaining > 0" class="lpv-quota-item ok">
        <v-icon size="14">mdi-check-circle-outline</v-icon>
        <span>Còn <strong>{{ quota.remaining }}</strong> lead có thể nhận</span>
      </div>
      <div v-else class="lpv-quota-item warn">
        <v-icon size="14">mdi-alert-circle-outline</v-icon>
        <span>Đã hết quota hôm nay</span>
      </div>
      <div v-if="quota.cooldownSeconds > 0" class="lpv-quota-item warn">
        <v-icon size="14">mdi-timer-outline</v-icon>
        <span>Cooldown {{ Math.ceil(quota.cooldownSeconds / 60) }} phút</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="lpv-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="lpv-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <v-icon size="16">{{ tab.icon }}</v-icon>
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="lpv-content">
      <!-- Pool leads tab -->
      <div v-if="activeTab === 'pool'" class="lpv-panel">
        <div class="lpv-panel-header">
          <h2 class="lpv-panel-title">Danh sách Lead trong Pool</h2>
        </div>
        <LeadPoolTable
          :leads="poolLeads"
          :loading="loadingLeads"
          :total="poolTotal"
          :page="poolPage"
          :limit="poolLimit"
          :total-pages="poolTotalPages"
          :claiming-id="claimingId"
          @update:page="poolPage = $event"
          @update:search="onPoolSearch"
          @update:source="onPoolSourceChange"
          @row-click="onLeadClick"
          @claim="onClaimLead"
        />
      </div>

      <!-- Distribution history tab -->
      <div v-if="activeTab === 'history'" class="lpv-panel">
        <div class="lpv-panel-header">
          <h2 class="lpv-panel-title">Nhật ký phân phối</h2>
        </div>
        <div class="lpv-wrapper">
          <table class="lpv-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Khách hàng</th>
                <th>SĐT</th>
                <th>Sale nhận</th>
                <th>Nguồn</th>
                <th>Lần thứ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingDist && distributions.length === 0">
                <td colspan="6" class="lpv-empty">Đang tải...</td>
              </tr>
              <tr v-else-if="!loadingDist && distributions.length === 0">
                <td colspan="6" class="lpv-empty">
                  <v-icon size="32">mdi-inbox-outline</v-icon>
                  <p>Chưa có lịch sử phân phối</p>
                </td>
              </tr>
              <tr v-for="dist in distributions" :key="dist.id" class="lpv-row">
                <td>
                  <div>{{ formatDate(dist.distributedAt) }}</div>
                </td>
                <td>{{ dist.contact?.fullName || '—' }}</td>
                <td>{{ dist.contact?.phone || '—' }}</td>
                <td>{{ dist.assignedTo?.fullName || '—' }}</td>
                <td>
                  <span class="lpv-badge" :class="`source-${dist.source}`">
                    {{ getSourceLabel(dist.source) }}
                  </span>
                </td>
                <td>{{ dist.round }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="lpv-pagination" v-if="distTotalPages > 1">
          <button class="lpv-btn" :disabled="distPage <= 1" @click="distPage--">
            <v-icon size="16">mdi-chevron-left</v-icon>
          </button>
          <span>Trang {{ distPage }} / {{ distTotalPages }}</span>
          <button class="lpv-btn" :disabled="distPage >= distTotalPages" @click="distPage++">
            <v-icon size="16">mdi-chevron-right</v-icon>
          </button>
        </div>
      </div>

      <!-- My requests tab -->
      <div v-if="activeTab === 'requests'" class="lpv-panel">
        <div class="lpv-panel-header">
          <h2 class="lpv-panel-title">Yêu cầu của tôi</h2>
        </div>
        <div class="lpv-wrapper">
          <table class="lpv-table">
            <thead>
              <tr>
                <th>Thời gian yêu cầu</th>
                <th>Khách hàng</th>
                <th>SĐT</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingRequests && requests.length === 0">
                <td colspan="4" class="lpv-empty">Đang tải...</td>
              </tr>
              <tr v-else-if="!loadingRequests && requests.length === 0">
                <td colspan="4" class="lpv-empty">
                  <v-icon size="32">mdi-inbox-outline</v-icon>
                  <p>Chưa có yêu cầu nào</p>
                </td>
              </tr>
              <tr v-for="req in requests" :key="req.id" class="lpv-row">
                <td>{{ formatDate(req.requestedAt) }}</td>
                <td>{{ req.contact?.fullName || '—' }}</td>
                <td>{{ req.contact?.phone || '—' }}</td>
                <td>
                  <span class="lpv-badge" :class="getRequestBadgeClass(req)">
                    {{ getRequestStatusLabel(req) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="lpv-pagination" v-if="reqTotalPages > 1">
          <button class="lpv-btn" :disabled="reqPage <= 1" @click="reqPage--">
            <v-icon size="16">mdi-chevron-left</v-icon>
          </button>
          <span>Trang {{ reqPage }} / {{ reqTotalPages }}</span>
          <button class="lpv-btn" :disabled="reqPage >= reqTotalPages" @click="reqPage++">
            <v-icon size="16">mdi-chevron-right</v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Contact detail dialog -->
    <v-dialog v-model="showContactDialog" max-width="600">
      <v-card v-if="selectedLead">
        <v-card-title class="lpv-dialog-title">
          <v-icon class="mr-2">mdi-account-outline</v-icon>
          {{ selectedLead.fullName }}
        </v-card-title>
        <v-card-text>
          <div class="lpv-dialog-grid">
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">SĐT</span>
              <span class="lpv-dialog-value">{{ selectedLead.phone || '—' }}</span>
            </div>
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">Trạng thái</span>
              <span class="lpv-dialog-value">{{ getStatusLabel(selectedLead.status) }}</span>
            </div>
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">Nguồn</span>
              <span class="lpv-dialog-value">{{ getSourceLabel(selectedLead.source) }}</span>
            </div>
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">Ngày vào pool</span>
              <span class="lpv-dialog-value">{{ formatDate(selectedLead.pooledAt) }}</span>
            </div>
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">Số lần chia</span>
              <span class="lpv-dialog-value">{{ selectedLead.pooledCount }}</span>
            </div>
            <div class="lpv-dialog-item">
              <span class="lpv-dialog-label">Tự động trả lúc</span>
              <span class="lpv-dialog-value">{{ formatDate(selectedLead.autoReturnAt) }}</span>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showContactDialog = false">Đóng</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import LeadPoolTable from '@/components/lead-pool/LeadPoolTable.vue';
import { useConfirm } from '@/composables/use-confirm';
import {
  getLeadPoolStats,
  getPooledLeads,
  getDistributions,
  getLeadRequests,
  getUserQuota,
} from '@/api/lead-pool';
import type { PooledLead, LeadDistribution, LeadRequest } from '@/api/lead-pool';

const TABS = [
  { id: 'pool', label: 'Lead trong Pool', icon: 'mdi-format-list-bulleted' },
  { id: 'history', label: 'Nhật ký chia', icon: 'mdi-history' },
  { id: 'requests', label: 'Yêu cầu của tôi', icon: 'mdi-file-document-outline' },
];

const activeTab = ref('pool');
const confirm = useConfirm();
const stats = ref({ leadsInPool: 0, assignedToday: 0, pendingRequests: 0, upcomingAutoReturns: 0 });
const quota = ref<{ usedToday: number; dailyLimit: number; remaining: number; cooldownSeconds: number } | null>(null);

// Pool leads state
const poolLeads = ref<PooledLead[]>([]);
const poolTotal = ref(0);
const poolPage = ref(1);
const poolLimit = ref(20);
const poolTotalPages = ref(1);
const poolSearch = ref('');
const poolSource = ref('');
const loadingLeads = ref(false);

// Distribution history state
const distributions = ref<LeadDistribution[]>([]);
const distPage = ref(1);
const distTotalPages = ref(1);
const loadingDist = ref(false);

// Requests state
const requests = ref<LeadRequest[]>([]);
const reqPage = ref(1);
const reqTotalPages = ref(1);
const loadingRequests = ref(false);

// Dialog state
const showContactDialog = ref(false);
const selectedLead = ref<PooledLead | null>(null);

const SOURCE_LABELS: Record<string, string> = {
  forgotten: 'Quên',
  customer_list: 'Tệp KH',
  external_sync: 'Sync ngoài',
  unknown: 'Không rõ',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới',
  cold: 'Tiềm năng',
  warm: 'Quan tâm',
  hot: 'Nhiệt tình',
  potential: 'Tiềm năng',
  won: 'Thành công',
  lost: 'Mất',
};

function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function getRequestStatusLabel(req: LeadRequest): string {
  if (req.releaseReason === null) return 'Đang chăm sóc';
  if (req.releaseReason === 'auto_return') return 'Tự động trả';
  if (req.releaseReason === 'manual_return') return 'Trả thủ công';
  return req.releaseReason || 'Không rõ';
}

function getRequestBadgeClass(req: LeadRequest): string {
  if (req.releaseReason === null) return 'status-pending';
  if (req.releaseReason === 'auto_return') return 'status-expired';
  if (req.releaseReason === 'manual_return') return 'status-returned';
  return 'status-pending';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchStats() {
  try {
    stats.value = await getLeadPoolStats();
  } catch (e) {
    console.error('[LeadPoolView] failed to fetch stats', e);
  }
}

async function fetchPoolLeads() {
  loadingLeads.value = true;
  try {
    const res = await getPooledLeads({
      page: poolPage.value,
      limit: poolLimit.value,
      source: poolSource.value || undefined,
      search: poolSearch.value || undefined,
    });
    poolLeads.value = res.leads;
    poolTotal.value = res.total;
    poolTotalPages.value = res.totalPages;
  } catch (e) {
    console.error('[LeadPoolView] failed to fetch pool leads', e);
  } finally {
    loadingLeads.value = false;
  }
}

async function fetchDistributions() {
  loadingDist.value = true;
  try {
    const res = await getDistributions({ page: distPage.value, limit: 20 });
    distributions.value = res.distributions;
    distTotalPages.value = res.totalPages;
  } catch (e) {
    console.error('[LeadPoolView] failed to fetch distributions', e);
  } finally {
    loadingDist.value = false;
  }
}

async function fetchRequests() {
  loadingRequests.value = true;
  try {
    const res = await getLeadRequests({ page: reqPage.value, limit: 20 });
    requests.value = res.requests;
    reqTotalPages.value = res.totalPages;
  } catch (e) {
    console.error('[LeadPoolView] failed to fetch requests', e);
  } finally {
    loadingRequests.value = false;
  }
}

function refresh() {
  fetchStats();
  if (activeTab.value === 'pool') fetchPoolLeads();
  else if (activeTab.value === 'history') fetchDistributions();
  else if (activeTab.value === 'requests') fetchRequests();
}

function onPoolSearch(search: string) {
  poolSearch.value = search;
  poolPage.value = 1;
  fetchPoolLeads();
}

function onPoolSourceChange(source: string) {
  poolSource.value = source;
  poolPage.value = 1;
  fetchPoolLeads();
}

function onLeadClick(lead: PooledLead) {
  selectedLead.value = lead;
  showContactDialog.value = true;
}

watch(activeTab, (tab) => {
  if (tab === 'pool') fetchPoolLeads();
  else if (tab === 'history') fetchDistributions();
  else if (tab === 'requests') fetchRequests();
});

watch(poolPage, () => fetchPoolLeads());
watch(distPage, () => fetchDistributions());
watch(reqPage, () => fetchRequests());

// 2026-07-22 fix-zalo-crm-mvp-gaps#3: claim lead from pool
const claimingId = ref<string | null>(null);
const claimError = ref('');

async function onClaimLead(lead: PooledLead) {
  if (!(await confirm({ title: `Xin lead "${lead.fullName || lead.phone}" vào danh sách của anh/chị?`, confirmText: 'Xin lead', cancelText: 'Hủy' }))) return;
  claimingId.value = lead.id;
  claimError.value = '';
  try {
    const { requestLead } = await import('@/api/lead-pool');
    await requestLead({ leadId: lead.id });
    // Refresh list + stats
    await Promise.all([fetchPoolLeads(), fetchStats()]);
  } catch (e: any) {
    // BE error code (vd 'in_cooldown', 'quota_exceeded', 'no_leads_in_pool') → thân thiện hơn
    const code = e?.response?.data?.error || '';
    const friendly: Record<string, string> = {
      lead_pool_disabled: 'Lead Pool đang tắt',
      in_cooldown: 'Anh/chị đang trong thời gian cooldown',
      quota_exceeded: 'Hết quota hôm nay',
      no_leads_in_pool: 'Pool đã hết lead',
    };
    claimError.value = friendly[code] || code || e?.message || 'Lỗi claim lead';
  } finally {
    claimingId.value = null;
    setTimeout(() => (claimError.value = ''), 5000);
  }
}

onMounted(() => {
  fetchStats();
  fetchPoolLeads();
  fetchQuota();
});

async function fetchQuota() {
  try {
    const q = await getUserQuota();
    quota.value = { usedToday: q.usedToday, dailyLimit: q.dailyLimit, remaining: q.remaining, cooldownSeconds: q.cooldownSeconds ?? 0 };
  } catch (e) {
    // ignore
  }
}
</script>

<style scoped>
.lead-pool-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.lpv-header {
  margin-bottom: 24px;
}

.lpv-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.lpv-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.lpv-subtitle {
  font-size: 14px;
  color: var(--text-muted, #64748b);
  margin: 4px 0 0;
}

.lpv-actions {
  display: flex;
  gap: 8px;
}

/* Stats cards */
.lpv-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .lpv-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

.lpv-stat {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.lpv-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.lpv-stat-icon.pool {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.lpv-stat-icon.assigned {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.lpv-stat-icon.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.lpv-stat-icon.auto-return {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.lpv-stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  line-height: 1;
}

.lpv-stat-label {
  font-size: 13px;
  color: var(--text-muted, #64748b);
  margin-top: 4px;
}

/* Tabs */
.lpv-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.lpv-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s ease;
}

.lpv-tab:hover {
  color: var(--text-primary, #1e293b);
}

.lpv-tab.active {
  color: var(--primary, #3b82f6);
  border-bottom-color: var(--primary, #3b82f6);
}

/* Content */
.lpv-content {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
}

.lpv-panel-header {
  margin-bottom: 16px;
}

.lpv-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

/* Table */
.lpv-wrapper {
  overflow-x: auto;
}

.lpv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.lpv-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--bg-subtle, #f8fafc);
  color: var(--text-secondary, #64748b);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.lpv-table td {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
  vertical-align: middle;
}

.lpv-row {
  transition: background-color 0.15s ease;
}

.lpv-row:hover {
  background: var(--bg-subtle, #f8fafc);
}

.lpv-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-muted, #94a3b8);
}

.lpv-empty p {
  margin: 8px 0 0;
}

.lpv-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.lpv-badge.source-forgotten { background: #fef3c7; color: #92400e; }
.lpv-badge.source-customer_list { background: #dbeafe; color: #1e40af; }
.lpv-badge.source-external_sync { background: #d1fae5; color: #166534; }
.lpv-badge.status-pending { background: #fef3c7; color: #92400e; }
.lpv-badge.status-distributed { background: #d1fae5; color: #166534; }
.lpv-badge.status-returned { background: #e2e8f0; color: #475569; }
.lpv-badge.status-expired { background: #fee2e2; color: #991b1b; }

/* Pagination */
.lpv-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted, #64748b);
}

.lpv-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: var(--bg-surface, #fff);
  color: var(--text-primary, #1e293b);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lpv-btn:hover:not(:disabled) {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.lpv-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dialog */
.lpv-dialog-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  padding: 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.lpv-dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.lpv-dialog-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lpv-dialog-label {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lpv-dialog-value {
  font-size: 14px;
  color: var(--text-primary, #1e293b);
}

/* User quota bar */
.lpv-quota-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
.lpv-quota-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1e40af;
}
.lpv-quota-item.ok { color: #15803d; }
.lpv-quota-item.warn { color: #c2410c; }
.lpv-quota-item strong { font-weight: 700; }
</style>
