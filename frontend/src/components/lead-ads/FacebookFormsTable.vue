<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="forms-table-wrap">
    <!-- Loading skeleton -->
    <div v-if="loading" class="skeleton-rows">
      <div v-for="i in 4" :key="i" class="skeleton-row">
        <div class="sk sk-name" />
        <div class="sk sk-page" />
        <div class="sk sk-status" />
        <div class="sk sk-count" />
        <div class="sk sk-time" />
        <div class="sk sk-actions" />
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ error }}</p>
      <button class="btn-retry" @click="$emit('reload')">Thử lại</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="forms.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      <p>Chưa có form Facebook Lead Ads nào</p>
      <span>Kết nối tài khoản Facebook để bắt đầu nhận lead</span>
    </div>

    <!-- Table -->
    <div v-else class="table-scroll">
      <table class="forms-table">
        <thead>
          <tr>
            <th>Form Name</th>
            <th>Facebook Page</th>
            <th>Status</th>
            <th>Lead hôm nay</th>
            <th>Tổng lead</th>
            <th>Last Sync</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="form in forms" :key="form.id" class="form-row">
            <td>
              <div class="name-cell">
                <div class="form-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M9 11.75A2.25 2.25 0 1 1 9 7.25a2.25 2.25 0 0 1 0 4.5zM15 11.75A2.25 2.25 0 1 1 15 7.25a2.25 2.25 0 0 1 0 4.5zM9 19.25A2.25 2.25 0 1 1 9 14.75a2.25 2.25 0 0 1 0 4.5zM15 19.25A2.25 2.25 0 1 1 15 14.75a2.25 2.25 0 0 1 0 4.5z"/>
                  </svg>
                </div>
                <div class="name-info">
                  <span class="form-name">{{ form.formName || 'Unnamed Form' }}</span>
                  <span class="form-id">ID: {{ form.formId.slice(0, 12) }}...</span>
                </div>
              </div>
            </td>
            <td>
              <div class="page-cell">
                <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" class="page-icon">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {{ form.pageName || form.pageId.slice(0, 12) + '...' }}
              </div>
            </td>
            <td>
              <span class="status-badge" :class="statusClass(form.status)">
                <span class="status-dot" />
                {{ statusLabel(form.status) }}
              </span>
            </td>
            <td>
              <span class="lead-count today">{{ form.todayLeadCount }}</span>
            </td>
            <td>
              <span class="lead-count total">{{ form.totalLeadCount.toLocaleString('vi-VN') }}</span>
            </td>
            <td>
              <div class="sync-cell">
                <span v-if="form.lastPullAt" class="sync-time">{{ formatDate(form.lastPullAt) }}</span>
                <span v-else class="sync-time never">Chưa sync</span>
                <span v-if="form.lastPullError" class="sync-error" title="Lỗi: form.lastPullError">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </span>
              </div>
            </td>
            <td class="td-actions">
              <div class="actions">
                <button
                  class="action-btn pull"
                  title="Pull Now"
                  :disabled="pullingId === form.id"
                  @click="$emit('pull', form)"
                >
                  <svg v-if="pullingId !== form.id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  <span v-else class="mini-spinner" />
                </button>
                <button
                  class="action-btn view"
                  title="View Details"
                  @click="$emit('view-detail', form)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                <button
                  v-if="form.status === 'active'"
                  class="action-btn archive"
                  title="Archive"
                  @click="$emit('archive', form)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <polyline points="21 8 21 21 3 21 3 8"/>
                    <rect x="1" y="3" width="22" height="5"/>
                    <line x1="10" y1="12" x2="14" y2="12"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FacebookForm } from '@/api/lead-ads';

const props = defineProps<{
  forms: FacebookForm[];
  loading: boolean;
  error: string | null;
}>();

defineEmits<{
  (e: 'view-detail', form: FacebookForm): void;
  (e: 'pull', form: FacebookForm): void;
  (e: 'archive', form: FacebookForm): void;
  (e: 'reload'): void;
}>();

const pullingId = ref<string | null>(null);

function statusClass(status: string): string {
  switch (status) {
    case 'active': return 'active';
    case 'archived': return 'archived';
    case 'deleted': return 'deleted';
    default: return 'active';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'archived': return 'Archived';
    case 'deleted': return 'Deleted';
    default: return status;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin}m trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.forms-table-wrap {
  background: white;
  border: 1px solid #E4E5E9;
  border-radius: 10px;
  overflow: hidden;
}

/* ── Skeleton ── */
.skeleton-rows { padding: 12px; }
.skeleton-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1.5fr 120px;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #F0F0F5;
}
.skeleton-row:last-child { border-bottom: none; }
.sk {
  height: 14px;
  background: linear-gradient(90deg, #F0F0F5 25%, #E8E8EE 50%, #F0F0F5 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Error ── */
.error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  text-align: center;
  color: #6B7785;
  gap: 8px;
}
.error-state svg { color: #EF4444; opacity: 0.7; }
.empty-state svg { color: #D4D6DB; }
.error-state p, .empty-state p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1F2D3D;
}
.empty-state span {
  font-size: 12.5px;
  color: #6B7785;
}
.btn-retry {
  margin-top: 8px;
  padding: 6px 16px;
  background: #5E6AD2;
  color: white;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-retry:hover { background: #4a55b8; }

/* ── Table ── */
.table-scroll { overflow-x: auto; }
.table-scroll::-webkit-scrollbar { height: 5px; }
.table-scroll::-webkit-scrollbar-thumb { background: #D4D6DB; border-radius: 2px; }

.forms-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.forms-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: #6B7785;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: #FAFAFC;
  border-bottom: 1px solid #E4E5E9;
  white-space: nowrap;
}
.forms-table td {
  padding: 11px 14px;
  border-bottom: 1px solid #F0F0F5;
  color: #1F2D3D;
  vertical-align: middle;
}
.form-row:last-child td { border-bottom: none; }
.form-row:hover td { background: #FAFAFC; }

/* ── Cells ── */
.name-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.form-icon {
  width: 28px;
  height: 28px;
  background: #EEF0FF;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5E6AD2;
  flex-shrink: 0;
}
.name-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.form-name {
  font-weight: 600;
  color: #1F2D3D;
}
.form-id {
  font-size: 11px;
  color: #97A0AC;
}

.page-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6B7785;
  font-size: 12px;
}
.page-icon { color: #1877F2; }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}
.status-badge .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.status-badge.active {
  background: #F0FDF4;
  color: #15803D;
}
.status-badge.active .status-dot { background: #22C55E; }
.status-badge.archived {
  background: #FFF7ED;
  color: #C2410C;
}
.status-badge.archived .status-dot { background: #FB923C; }
.status-badge.deleted {
  background: #FEF2F2;
  color: #B91C1C;
}
.status-badge.deleted .status-dot { background: #EF4444; }

.lead-count {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.lead-count.today { color: #15803D; }
.lead-count.total { color: #6B7785; font-size: 12px; }

.sync-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}
.sync-time {
  font-size: 12px;
  color: #6B7785;
}
.sync-time.never { color: #97A0AC; font-style: italic; }
.sync-error { color: #EF4444; cursor: help; }

/* ── Actions ── */
.th-actions { text-align: right; }
.td-actions { text-align: right; }
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.form-row:hover .actions { opacity: 1; }
.action-btn {
  width: 28px;
  height: 28px;
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
.action-btn:hover { background: #F4F4F7; color: #1F2D3D; }
.action-btn.pull:hover { background: #EEF0FF; color: #5E6AD2; border-color: #5E6AD2; }
.action-btn.archive:hover { background: #FFF7ED; color: #EA580C; border-color: #FB923C; }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mini-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(94,106,210,0.3);
  border-top-color: #5E6AD2;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
