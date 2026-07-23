<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- AutomationHubView.vue - Trang Automation tổng hợp -->
<template>
  <div class="ah-view">
    <header class="ah-header">
      <h1 class="ah-title">⚡ Trang Automation</h1>
      <p class="ah-sub">Quản lý tất cả tự động hoá: Auto Reply, Sequences, Triggers, Reports</p>
    </header>

    <!-- Tabs -->
    <div class="ah-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="ah-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <div class="ah-body">
      <AutoReplyRulesTab v-if="activeTab === 'auto-reply'" />
      <TriggersTab v-else-if="activeTab === 'triggers'" />
      <ReportsTab v-else-if="activeTab === 'reports'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AutoReplyRulesTab from '@/components/automation/AutoReplyRulesTab.vue';
import TriggersTab from '@/components/automation/TriggersTab.vue';
import ReportsTab from '@/components/automation/ReportsTab.vue';

const tabs = [
  { key: 'auto-reply', label: 'Auto Reply', icon: '🤖' },
  { key: 'triggers', label: 'Triggers', icon: '⚡' },
  { key: 'reports', label: 'Reports', icon: '📊' },
];
const activeTab = ref('auto-reply');
</script>

<style scoped>
.ah-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}
.ah-header {
  margin-bottom: 20px;
}
.ah-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
}
.ah-sub {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}
.ah-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
}
.ah-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}
.ah-tab:hover {
  color: #1e293b;
}
.ah-tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}
.ah-body {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>