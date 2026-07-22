<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="forms-table-wrap">
    <!-- Loading skeleton -->
    <div v-if="loading" class="skeleton-rows">
      <div v-for="i in 4" :key="i" class="skeleton-row">
        <div class="sk sk-name" />
        <div class="sk sk-oa" />
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
      <p>Chưa có form Zalo Ads nào</p>
      <span>Thiết lập kết nối Zalo OA để bắt đầu nhận lead</span>
    </div>

    <!-- Table -->
    <div v-else class="table-scroll">
      <table class="forms-table">
        <thead>
          <tr>
            <th>Form Name</th>
            <th>Zalo OA</th>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 9h6M9 12h6M9 15h4"/>
                  </svg>
                </div>
                <div class="name-info">
                  <span class="form-name">{{ form.formName || 'Unnamed Form' }}</span>
                  <span class="form-id">ID: {{ form.formId.slice(0, 12) }}...</span>
                </div>
              </div>
            </td>
            <td>
              <div class="oa-cell">
                <div class="oa-avatar">{{ (form.oaName || 'Z')[0] }}</div>
                <span>{{ form.oaName || 'Zalo OA' }}</span>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="form.enabled ? 'active' : 'disabled'">
                <span class="status-dot" />
                {{ form.enabled ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td>
              <span class="lead-count today">{{ form.todayLeadCount }}</span>
            </td>
            <td>
              <span class="lead-count total">{{ form.totalLeadCount.toLocaleString('vi-VN') }}</span>
            </td>
            <td>
              <span v-if="form.lastSyncedToTime" class="sync-time">
                {{ formatTimestamp(form.lastSyncedToTime) }}
              </span>
              <span v-else class="sync-time never">Chưa sync</span>
            </td>
            <td class="td-actions">
              <div class="actions">
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
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ZaloForm } from '@/api/lead-ads';

defineProps<{
  forms: ZaloForm[];
  loading: boolean;
  error: string | null;
}>();

defineEmits<{
  (e: 'view-detail', form: ZaloForm): void;
  (e: 'reload'): void;
}>();

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
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

.skeleton-rows { padding: 12px; }
.skeleton-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1.5fr 100px;
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
.empty-state span { font-size: 12.5px; color: #6B7785; }
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

.name-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.form-icon {
  width: 28px;
  height: 28px;
  background: #F0F9FF;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0284C7;
  flex-shrink: 0;
}
.name-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.form-name { font-weight: 600; color: #1F2D3D; }
.form-id { font-size: 11px; color: #97A0AC; }

.oa-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6B7785;
  font-size: 12px;
}
.oa-avatar {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #0068FF 0%, #004FC4 100%);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}
.status-badge .status-dot { width: 6px; height: 6px; border-radius: 50%; }
.status-badge.active { background: #F0FDF4; color: #15803D; }
.status-badge.active .status-dot { background: #22C55E; }
.status-badge.disabled { background: #F4F4F7; color: #6B7785; }
.status-badge.disabled .status-dot { background: #9CA3AF; }

.lead-count { font-weight: 700; font-variant-numeric: tabular-nums; }
.lead-count.today { color: #15803D; }
.lead-count.total { color: #6B7785; font-size: 12px; }

.sync-time { font-size: 12px; color: #6B7785; }
.sync-time.never { color: #97A0AC; font-style: italic; }

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
.action-btn.view:hover { background: #EEF0FF; color: #5E6AD2; border-color: #5E6AD2; }
</style>
