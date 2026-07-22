<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- ReportsTab.vue - Tab báo cáo automation -->
<template>
  <div class="rpt-tab">
    <h2 class="rpt-title">📊 Automation Reports</h2>
    <p class="rpt-desc">Lịch sử các automation đã chạy (broadcast, sequence, template send).</p>

    <div v-if="summary" class="rpt-summary">
      <div class="rpt-stat">
        <div class="rpt-stat-value">{{ summary.total }}</div>
        <div class="rpt-stat-label">Tổng chạy</div>
      </div>
      <div class="rpt-stat success">
        <div class="rpt-stat-value">{{ summary.completed }}</div>
        <div class="rpt-stat-label">Thành công</div>
      </div>
      <div class="rpt-stat danger">
        <div class="rpt-stat-value">{{ summary.failed }}</div>
        <div class="rpt-stat-label">Lỗi</div>
      </div>
      <div class="rpt-stat">
        <div class="rpt-stat-value">{{ summary.successRate }}%</div>
        <div class="rpt-stat-label">Tỷ lệ thành công</div>
      </div>
    </div>

    <div v-if="loading" class="loading">⏳ Đang tải...</div>
    <table v-else-if="logs.length > 0" class="rpt-table">
      <thead>
        <tr>
          <th>Loại</th>
          <th>Nick Zalo</th>
          <th>Trạng thái</th>
          <th>Gửi</th>
          <th>Lỗi</th>
          <th>Bắt đầu</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id">
          <td><code>{{ log.type }}</code></td>
          <td>{{ log.oaAccountName || '—' }}</td>
          <td>{{ statusLabel(log.status) }}</td>
          <td>{{ log.sent }}</td>
          <td>{{ log.failed }}</td>
          <td>{{ formatTime(log.startedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">Chưa có lịch sử automation nào.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { automationReportApi, type AutomationLog, type AutomationSummary } from '@/api/automation-report';

const logs = ref<AutomationLog[]>([]);
const summary = ref<AutomationSummary | null>(null);
const loading = ref(true);

function statusLabel(s: string) {
  if (s === 'completed') return '✓ Done';
  if (s === 'failed') return '✗ Failed';
  return s;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function load() {
  loading.value = true;
  try {
    const [h, s] = await Promise.all([
      automationReportApi.history({ limit: 50 }),
      automationReportApi.summary(),
    ]);
    logs.value = h.logs;
    summary.value = s;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.rpt-tab { display: flex; flex-direction: column; gap: 16px; }
.rpt-title { font-size: 16px; font-weight: 700; margin: 0; }
.rpt-desc { color: #64748b; font-size: 13px; margin: 0; }
.rpt-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.rpt-stat { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
.rpt-stat.success { background: #ecfdf5; }
.rpt-stat.danger { background: #fef2f2; }
.rpt-stat-value { font-size: 24px; font-weight: 700; }
.rpt-stat-label { font-size: 11px; color: #64748b; margin-top: 4px; }
.rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rpt-table th, .rpt-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
.rpt-table th { background: #f8fafc; font-weight: 600; }
.rpt-table code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.empty, .loading { padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; }
</style>