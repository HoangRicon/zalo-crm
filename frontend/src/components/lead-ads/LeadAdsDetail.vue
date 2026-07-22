<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="detail-overlay" @click.self="$emit('close')">
    <aside class="detail-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-info">
          <div class="source-badge" :class="source">
            <svg v-if="source === 'facebook'" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            {{ source === 'facebook' ? 'Facebook Lead Ads' : 'Zalo Ads' }}
          </div>
          <h2 class="form-title">{{ displayName }}</h2>
          <p class="form-meta">{{ sourceMeta }}</p>
        </div>
        <button class="close-btn" @click="$emit('close')" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-chip">
          <span class="chip-label">Hôm nay</span>
          <span class="chip-value today">{{ todayCount }}</span>
        </div>
        <div class="stat-chip">
          <span class="chip-label">Tổng lead</span>
          <span class="chip-value">{{ totalCount }}</span>
        </div>
        <div class="stat-chip" v-if="lastSync">
          <span class="chip-label">Last sync</span>
          <span class="chip-value muted">{{ lastSync }}</span>
        </div>
      </div>

      <!-- Pull button (Facebook only) -->
      <div v-if="source === 'facebook'" class="pull-section">
        <button
          class="btn-pull"
          :disabled="pulling"
          @click="handlePull"
        >
          <svg v-if="!pulling" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span v-else class="mini-spinner" />
          {{ pulling ? 'Đang sync...' : 'Pull Now (Sync Lead)' }}
        </button>
        <span v-if="pullSuccess" class="pull-msg success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Đã gửi yêu cầu sync
        </span>
        <span v-if="pullError" class="pull-msg error">{{ pullError }}</span>
      </div>

      <!-- Recent leads -->
      <div class="leads-section">
        <div class="section-header">
          <h3>Recent Leads</h3>
          <span class="total-label">{{ leadsTotal.toLocaleString('vi-VN') }} total</span>
        </div>

        <div v-if="leadsLoading" class="leads-loading">
          <div v-for="i in 5" :key="i" class="lead-skeleton">
            <div class="ls ls-avatar" />
            <div class="ls-info">
              <div class="ls ls-name" />
              <div class="ls ls-time" />
            </div>
          </div>
        </div>

        <div v-else-if="leadsError" class="leads-error">
          <p>{{ leadsError }}</p>
        </div>

        <div v-else-if="leads.length === 0" class="leads-empty">
          <p>Chưa có lead nào được ghi nhận</p>
        </div>

        <div v-else class="leads-list">
          <div
            v-for="lead in leads"
            :key="lead.id"
            class="lead-item"
            @click="$emit('preview', lead)"
          >
            <div class="lead-avatar">{{ leadInitial }}</div>
            <div class="lead-info">
              <span class="lead-name">{{ extractLeadName(lead) || 'Lead ' + lead.id.slice(-6) }}</span>
              <span class="lead-time">{{ formatLeadTime(lead.createdAt) }}</span>
            </div>
            <div class="lead-status" :class="leadStatusClass(lead)">
              <span class="lead-dot" />
              {{ leadStatusLabel(lead) }}
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="leadsTotal > pageSize" class="pagination">
          <button
            class="page-btn"
            :disabled="pageOffset <= 0"
            @click="prevPage"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="page-info">{{ paginationLabel }}</span>
          <button
            class="page-btn"
            :disabled="pageOffset + pageSize >= leadsTotal"
            @click="nextPage"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/use-toast';
import { facebookLeadAdsApi, zaloAdsApi } from '@/api/lead-ads';
import type { FacebookForm, ZaloForm, FacebookLead, ZaloLead } from '@/api/lead-ads';

type AnyForm = (FacebookForm & { _type?: string }) | (ZaloForm & { _type?: string });
type AnyLead = (FacebookLead & { _type?: string }) | (ZaloLead & { _type?: string });

const props = defineProps<{
  form: AnyForm;
  source: 'facebook' | 'zalo';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'preview', lead: AnyLead): void;
}>();

const { toast } = useToast();

const pageSize = 20;
const pageOffset = ref(0);
const leads = ref<AnyLead[]>([]);
const leadsTotal = ref(0);
const leadsLoading = ref(false);
const leadsError = ref<string | null>(null);

const pulling = ref(false);
const pullSuccess = ref(false);
const pullError = ref<string | null>(null);

const leadInitial = computed(() => 'L');

// ─── Computed form data ────────────────────────────────────────────────────
const isFacebook = computed(() => props.source === 'facebook');
const fbForm = computed(() => (isFacebook.value ? (props.form as FacebookForm) : null));
const zaloForm = computed(() => (!isFacebook.value ? (props.form as ZaloForm) : null));

const displayName = computed(() => {
  return fbForm.value?.formName || zaloForm.value?.formName || 'Unnamed Form';
});

const sourceMeta = computed(() => {
  if (isFacebook.value) {
    return `Page: ${fbForm.value?.pageName || fbForm.value?.pageId || 'N/A'}`;
  }
  return `OA: ${zaloForm.value?.oaName || 'N/A'}`;
});

const todayCount = computed(() => {
  return isFacebook.value ? fbForm.value?.todayLeadCount ?? 0 : zaloForm.value?.todayLeadCount ?? 0;
});

const totalCount = computed(() => {
  return isFacebook.value ? fbForm.value?.totalLeadCount ?? 0 : zaloForm.value?.totalLeadCount ?? 0;
});

const lastSync = computed(() => {
  if (isFacebook.value) {
    const t = fbForm.value?.lastPullAt;
    return t ? formatDate(t) : null;
  }
  const ts = zaloForm.value?.lastSyncedToTime;
  return ts ? formatDate(new Date(ts * 1000).toISOString()) : null;
});

const paginationLabel = computed(() => {
  const from = pageOffset.value + 1;
  const to = Math.min(pageOffset.value + pageSize, leadsTotal.value);
  return `${from}–${to} / ${leadsTotal.value.toLocaleString('vi-VN')}`;
});

// ─── Leads loading ─────────────────────────────────────────────────────────
async function loadLeads() {
  leadsLoading.value = true;
  leadsError.value = null;
  try {
    const formId = isFacebook.value
      ? (props.form as FacebookForm).id
      : (props.form as ZaloForm).id;

    if (isFacebook.value) {
      const res = await facebookLeadAdsApi.listLeads(formId, {
        limit: pageSize,
        offset: pageOffset.value,
      });
      leads.value = res.leads.map((l) => ({ ...l, _type: 'facebook' as const }));
      leadsTotal.value = res.total;
    } else {
      const res = await zaloAdsApi.listLeads(formId, {
        limit: pageSize,
        offset: pageOffset.value,
      });
      leads.value = res.leads.map((l) => ({ ...l, _type: 'zalo' as const }));
      leadsTotal.value = res.total;
    }
  } catch (err: unknown) {
    leadsError.value = 'Không thể tải danh sách lead';
  } finally {
    leadsLoading.value = false;
  }
}

function prevPage() {
  pageOffset.value = Math.max(0, pageOffset.value - pageSize);
  loadLeads();
}

function nextPage() {
  if (pageOffset.value + pageSize < leadsTotal.value) {
    pageOffset.value += pageSize;
    loadLeads();
  }
}

// ─── Pull (Facebook only) ──────────────────────────────────────────────────
async function handlePull() {
  if (!isFacebook.value) return;
  pulling.value = true;
  pullSuccess.value = false;
  pullError.value = null;
  try {
    await facebookLeadAdsApi.triggerPull((props.form as FacebookForm).id);
    pullSuccess.value = true;
    setTimeout(() => { pullSuccess.value = false; }, 3000);
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Sync thất bại';
    pullError.value = msg;
  } finally {
    pulling.value = false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function extractLeadName(lead: AnyLead): string {
  const payload = lead.rawPayload as Record<string, unknown>;
  const nameField = payload.full_name || payload.name || payload.fullname
    || payload['Họ và tên'] || payload['Tên'] || payload['Họ'] || payload['Name'];
  return typeof nameField === 'string' ? nameField : '';
}

function formatLeadTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin}m trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function leadStatusClass(lead: AnyLead): string {
  if (lead.processedAt) return 'processed';
  if (lead.error) return 'error';
  return 'pending';
}

function leadStatusLabel(lead: AnyLead): string {
  if (lead.processedAt) return 'Converted';
  if (lead.error) return 'Failed';
  return 'Pending';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────
watch(
  () => [props.form.id, props.source],
  () => {
    pageOffset.value = 0;
    loadLeads();
  },
  { immediate: true },
);
</script>

<style scoped>
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  animation: overlayIn 0.2s ease;
}
@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.detail-drawer {
  width: 460px;
  max-width: 100%;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  animation: drawerIn 0.25s ease;
  overflow: hidden;
}
@keyframes drawerIn {
  from { transform: translateX(40px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* ── Header ── */
.drawer-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #E4E5E9;
  flex-shrink: 0;
}
.header-info { flex: 1; }
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 6px;
}
.source-badge.facebook { background: #EEF0FF; color: #1877F2; }
.source-badge.zalo { background: #F0F9FF; color: #0284C7; }
.form-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #1F2D3D;
}
.form-meta { margin: 0; font-size: 12px; color: #6B7785; }
.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #E4E5E9;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  color: #6B7785;
  flex-shrink: 0;
  transition: all 0.12s;
}
.close-btn:hover { background: #FEF2F2; color: #EF4444; border-color: #FECACA; }

/* ── Stats ── */
.stats-row {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #F0F0F5;
  flex-shrink: 0;
}
.stat-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #FAFAFC;
  border: 1px solid #E4E5E9;
  border-radius: 8px;
  padding: 8px 12px;
}
.chip-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #97A0AC;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.chip-value {
  font-size: 20px;
  font-weight: 700;
  color: #1F2D3D;
  font-variant-numeric: tabular-nums;
}
.chip-value.today { color: #15803D; }
.chip-value.muted { font-size: 12px; font-weight: 600; color: #6B7785; }

/* ── Pull ── */
.pull-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid #F0F0F5;
  flex-shrink: 0;
}
.btn-pull {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  background: #5E6AD2;
  color: white;
  border: none;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-pull:hover:not(:disabled) { background: #4a55b8; box-shadow: 0 2px 8px rgba(94,106,210,0.3); }
.btn-pull:disabled { opacity: 0.6; cursor: not-allowed; }
.mini-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pull-msg {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}
.pull-msg.success { color: #15803D; }
.pull-msg.error { color: #EF4444; }

/* ── Leads ── */
.leads-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  flex-shrink: 0;
}
.section-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #1F2D3D;
}
.total-label {
  font-size: 11.5px;
  color: #6B7785;
  font-weight: 500;
}

.leads-loading, .leads-empty, .leads-error {
  padding: 8px 20px;
  flex: 1;
}
.leads-loading { display: flex; flex-direction: column; gap: 2px; }
.lead-skeleton {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #F0F0F5;
}
.ls {
  background: linear-gradient(90deg, #F0F0F5 25%, #E8E8EE 50%, #F0F0F5 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.ls-avatar { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; }
.ls-info { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.ls-name { height: 13px; width: 60%; }
.ls-time { height: 11px; width: 35%; }

.leads-error p, .leads-empty p {
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: #6B7785;
  padding: 24px 0;
}

.leads-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}
.leads-list::-webkit-scrollbar { width: 5px; }
.leads-list::-webkit-scrollbar-thumb { background: #D4D6DB; border-radius: 2px; }

.lead-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #F0F0F5;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}
.lead-item:last-child { border-bottom: none; }
.lead-item:hover { background: #FAFAFC; padding-left: 6px; }
.lead-avatar {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, #EEF0FF 0%, #E0E4FF 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #5E6AD2;
  flex-shrink: 0;
}
.lead-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.lead-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #1F2D3D;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lead-time {
  font-size: 11px;
  color: #97A0AC;
}
.lead-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.lead-dot { width: 5px; height: 5px; border-radius: 50%; }
.lead-status.processed { background: #F0FDF4; color: #15803D; }
.lead-status.processed .lead-dot { background: #22C55E; }
.lead-status.pending { background: #FEF9C3; color: #854D0E; }
.lead-status.pending .lead-dot { background: #FACC15; }
.lead-status.error { background: #FEF2F2; color: #B91C1C; }
.lead-status.error .lead-dot { background: #EF4444; }

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid #F0F0F5;
  flex-shrink: 0;
}
.page-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #E4E5E9;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7785;
  transition: all 0.12s;
}
.page-btn:hover:not(:disabled) { background: #EEF0FF; color: #5E6AD2; border-color: #5E6AD2; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 12px; color: #6B7785; font-weight: 500; }
</style>
