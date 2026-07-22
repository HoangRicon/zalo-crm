<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- LeadPoolTable.vue — Reusable table component for Lead Pool -->
<template>
  <div class="lead-pool-table">
    <!-- Filter bar -->
    <div class="lpt-toolbar">
      <div class="lpt-search">
        <v-icon size="16">mdi-magnify</v-icon>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm tên, SĐT..."
          @input="onSearchInput"
        />
      </div>
      <div class="lpt-filters">
        <select v-model="sourceFilter" @change="onSourceChange">
          <option value="">Tất cả nguồn</option>
          <option value="forgotten">Quên</option>
          <option value="customer_list">Tệp KH</option>
          <option value="external_sync">Sync ngoài</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="lpt-wrapper">
      <table class="lpt">
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th>SĐT</th>
            <th>Trạng thái</th>
            <th>Nguồn</th>
            <th>Ngày vào pool</th>
            <th>Tự động trả</th>
            <th>Lần chia</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && leads.length === 0">
            <td colspan="8" class="lpt-empty">Đang tải...</td>
          </tr>
          <tr v-else-if="!loading && leads.length === 0">
            <td colspan="8" class="lpt-empty">
              <v-icon size="32">mdi-inbox-outline</v-icon>
              <p>Không có lead nào trong pool</p>
            </td>
          </tr>
          <tr
            v-for="lead in leads"
            :key="lead.id"
            class="lpt-row"
            :class="{ 'row-urgent': isUrgent(lead) }"
            @click="$emit('row-click', lead)"
          >
            <td>
              <div class="lpt-name">{{ lead.fullName || '—' }}</div>
            </td>
            <td>
              <span class="lpt-phone">{{ formatPhone(lead.phone) }}</span>
            </td>
            <td>
              <span class="lpt-badge" :class="`status-${lead.status}`">
                {{ getStatusLabel(lead.status) }}
              </span>
            </td>
            <td>
              <span class="lpt-source" :class="`source-${lead.source}`">
                {{ getSourceLabel(lead.source) }}
              </span>
            </td>
            <td>
              <div class="lpt-date">{{ formatDate(lead.pooledAt) }}</div>
              <div class="lpt-ago">{{ formatAgo(lead.pooledAt) }}</div>
            </td>
            <td>
              <div v-if="getRemainingTime(lead.autoReturnAt)" class="lpt-sla" :class="{ 'sla-warning': isWarning(lead), 'sla-critical': isCritical(lead) }">
                <v-icon size="12">mdi-clock-outline</v-icon>
                {{ getRemainingTime(lead.autoReturnAt) }}
              </div>
              <span v-else class="lpt-overdue">Đã quá hạn</span>
            </td>
            <td>
              <span class="lpt-count">{{ lead.pooledCount }}</span>
            </td>
            <td @click.stop>
              <button
                class="lpt-claim-btn"
                :disabled="claimingId === lead.id"
                @click="$emit('claim', lead)"
              >
                {{ claimingId === lead.id ? '⏳' : '🎯 Xin ngay' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="lpt-pagination" v-if="totalPages > 1 || leads.length > 0">
      <span class="lpt-info">
        Hiển thị {{ leads.length }} / {{ total }} lead
      </span>
      <div class="lpt-pages">
        <button
          class="lpt-btn"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          <v-icon size="16">mdi-chevron-left</v-icon>
        </button>
        <button
          v-for="p in visiblePages"
          :key="p"
          class="lpt-btn"
          :class="{ active: p === page }"
          @click="goToPage(p)"
        >
          {{ p }}
        </button>
        <button
          class="lpt-btn"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          <v-icon size="16">mdi-chevron-right</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PooledLead } from '@/api/lead-pool';

const props = defineProps<{
  leads: PooledLead[];
  loading?: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  claimingId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:page', page: number): void;
  (e: 'update:search', search: string): void;
  (e: 'update:source', source: string): void;
  (e: 'row-click', lead: PooledLead): void;
  (e: 'claim', lead: PooledLead): void;
}>();

const searchQuery = ref('');
const sourceFilter = ref('');

const visiblePages = computed(() => {
  const pages: number[] = [];
  const start = Math.max(1, props.page - 2);
  const end = Math.min(props.totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

let searchTimeout: ReturnType<typeof setTimeout>;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    emit('update:search', searchQuery.value);
  }, 300);
}

function onSourceChange() {
  emit('update:source', sourceFilter.value);
}

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages) {
    emit('update:page', page);
  }
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  return phone;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins} phút trước`;
}

function getRemainingTime(autoReturnAt: string): string | null {
  const diff = new Date(autoReturnAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} ngày`;
  }
  if (hours > 0) return `${hours}h ${mins}p`;
  return `${mins} phút`;
}

function isUrgent(lead: PooledLead): boolean {
  const diff = new Date(lead.autoReturnAt).getTime() - Date.now();
  return diff <= 0 || diff < 30 * 60 * 1000; // overdue or < 30 min
}

function isWarning(lead: PooledLead): boolean {
  const diff = new Date(lead.autoReturnAt).getTime() - Date.now();
  return diff > 0 && diff < 2 * 60 * 60 * 1000; // < 2 hours
}

function isCritical(lead: PooledLead): boolean {
  const diff = new Date(lead.autoReturnAt).getTime() - Date.now();
  return diff > 0 && diff < 30 * 60 * 1000; // < 30 min
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới',
  cold: 'Tiềm năng',
  warm: 'Quan tâm',
  hot: 'Nhiệt tình',
  potential: 'Tiềm năng',
  won: 'Thành công',
  lost: 'Mất',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

const SOURCE_LABELS: Record<string, string> = {
  forgotten: 'Quên',
  customer_list: 'Tệp KH',
  external_sync: 'Sync ngoài',
  unknown: 'Không rõ',
};

function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}
</script>

<style scoped>
.lead-pool-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lpt-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.lpt-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 8px 12px;
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}

.lpt-search input {
  border: none;
  outline: none;
  background: transparent;
  flex: 1;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
}

.lpt-search input::placeholder {
  color: var(--text-muted, #94a3b8);
}

.lpt-filters select {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  background: var(--bg-surface, #fff);
  font-size: 14px;
  color: var(--text-primary, #1e293b);
  cursor: pointer;
}

.lpt-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.lpt {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.lpt th {
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

.lpt td {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
  vertical-align: middle;
}

.lpt-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.lpt-row:hover {
  background: var(--bg-subtle, #f8fafc);
}

.lpt-row.row-urgent {
  background: rgba(239, 68, 68, 0.05);
}

.lpt-row.row-urgent:hover {
  background: rgba(239, 68, 68, 0.1);
}

.lpt-name {
  font-weight: 500;
}

.lpt-phone {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.lpt-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-subtle, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.lpt-badge.status-new { background: #dbeafe; color: #1e40af; }
.lpt-badge.status-hot { background: #fee2e2; color: #991b1b; }
.lpt-badge.status-warm { background: #fef3c7; color: #92400e; }
.lpt-badge.status-cold { background: #e2e8f0; color: #475569; }
.lpt-badge.status-potential { background: #dcfce7; color: #166534; }
.lpt-badge.status-won { background: #d1fae5; color: #065f46; }
.lpt-badge.status-lost { background: #fee2e2; color: #991b1b; }

.lpt-source {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-subtle, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.lpt-source.source-forgotten { background: #fef3c7; color: #92400e; }
.lpt-source.source-customer_list { background: #dbeafe; color: #1e40af; }
.lpt-source.source-external_sync { background: #d1fae5; color: #166534; }

.lpt-date {
  font-size: 13px;
}

.lpt-ago {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
}

.lpt-sla {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-subtle, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.lpt-sla.sla-warning {
  background: #fef3c7;
  color: #92400e;
}

.lpt-sla.sla-critical {
  background: #fee2e2;
  color: #991b1b;
}

.lpt-overdue {
  font-size: 12px;
  color: #ef4444;
  font-weight: 500;
}

.lpt-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-subtle, #f1f5f9);
  font-size: 12px;
  font-weight: 600;
}

.lpt-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-muted, #94a3b8);
}

.lpt-empty p {
  margin: 8px 0 0;
}

.lpt-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.lpt-info {
  font-size: 13px;
  color: var(--text-muted, #94a3b8);
}

.lpt-pages {
  display: flex;
  gap: 4px;
}

.lpt-btn {
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

.lpt-btn:hover:not(:disabled) {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.lpt-btn.active {
  background: var(--primary, #3b82f6);
  border-color: var(--primary, #3b82f6);
  color: #fff;
}

.lpt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lpt-claim-btn {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}
.lpt-claim-btn:hover:not(:disabled) {
  background: #2563eb;
}
.lpt-claim-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
