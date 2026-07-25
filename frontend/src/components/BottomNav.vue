<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  BottomNav (2026-07-26 redesign clean).
  - 5 tab: Tổng quan / Chat / Khách / Lịch / Broadcast.
  - Active glow + bubble icon style.
-->
<template>
  <v-bottom-navigation grow :model-value="activeTab" @update:model-value="navigate" class="bn-bar">
    <v-btn
      v-for="tab in tabs"
      :key="tab.path"
      :value="tab.path"
      :aria-label="tab.title"
      :aria-current="activeTab === tab.path ? 'page' : undefined"
      class="bn-btn"
      :class="{ active: activeTab === tab.path }"
    >
      <v-icon aria-hidden="true" size="22">{{ tab.icon }}</v-icon>
      <span class="bn-label">{{ tab.title }}</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tabs = [
  { title: 'Tổng quan', icon: 'mdi-view-dashboard-outline', path: '/' },
  { title: 'Chat', icon: 'mdi-message-text-outline', path: '/chat' },
  { title: 'Khách hàng', icon: 'mdi-account-group-outline', path: '/contacts' },
  { title: 'Lịch hẹn', icon: 'mdi-calendar-clock-outline', path: '/appointments' },
  { title: 'Broadcast', icon: 'mdi-bullhorn-outline', path: '/marketing/broadcasts' },
];

const activeTab = computed(() => {
  return tabs.find((t) => t.path === route.path)?.path ?? '/';
});

function navigate(path: string) {
  if (path !== route.path) router.push(path);
}
</script>

<style scoped>
.bn-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
  background: white !important;
  border-top: 1px solid #eef0f4;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.04) !important;
  height: 64px !important;
}
.bn-btn {
  flex-direction: column !important;
  gap: 2px !important;
  min-width: 0 !important;
  color: #9ca3af !important;
  transition: color 0.15s, transform 0.15s;
}
.bn-btn.active {
  color: #0077b6 !important;
}
.bn-btn.active :deep(.v-icon) {
  background: linear-gradient(135deg, #d0ebff, #e3f6ff);
  border-radius: 12px;
  padding: 4px 10px;
  margin-bottom: 2px;
  color: #0077b6 !important;
}
.bn-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.2px;
}
</style>
