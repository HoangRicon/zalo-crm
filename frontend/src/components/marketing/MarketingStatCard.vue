<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!--
  MarketingStatCard — Stat card chuẩn (2026-07-28 redesign).
  Dùng cho LeadPoolView, BroadcastsView, AutomationHubView.
-->
<template>
  <div class="mk-stat-card" :class="{ 'mk-stat-clickable': clickable }" @click="$emit('click')">
    <div v-if="icon" class="mk-stat-icon" :class="iconClass">
      <v-icon size="20">{{ icon }}</v-icon>
    </div>
    <div class="mk-stat-body">
      <div class="mk-stat-value">{{ formattedValue }}</div>
      <div class="mk-stat-label">{{ label }}</div>
      <div v-if="hint" class="mk-stat-hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number | string;
  label: string;
  icon?: string;
  iconClass?: string; // 'pool' | 'assigned' | 'pending' | 'auto-return'
  hint?: string;
  clickable?: boolean;
}>();
defineEmits<{ click: [] }>();

const formattedValue = computed(() => {
  if (typeof props.value === 'number') return props.value.toLocaleString('vi-VN');
  return props.value;
});
</script>

<style scoped>
.mk-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--smax-bg, #fff);
  border: 1px solid var(--smax-grey-200, #e5e7eb);
  border-radius: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.mk-stat-clickable { cursor: pointer; }
.mk-stat-clickable:hover {
  border-color: var(--smax-primary, #3b82f6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.mk-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mk-stat-icon.pool { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.mk-stat-icon.assigned { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.mk-stat-icon.pending { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.mk-stat-icon.auto-return { background: rgba(168, 85, 247, 0.12); color: #a855f7; }
.mk-stat-body { flex: 1; min-width: 0; }
.mk-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--smax-text, #111827);
  line-height: 1.2;
}
.mk-stat-label {
  font-size: 13px;
  color: var(--smax-grey-700, #6b7280);
  margin-top: 2px;
}
.mk-stat-hint {
  font-size: 11px;
  color: var(--smax-grey-500, #9ca3af);
  margin-top: 4px;
}
</style>