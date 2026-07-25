<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  MobileLayout (2026-07-26 redesign clean).
  - App bar slim, brand gradient teal-navy.
  - Bottom nav với 5 tab + active glow.
-->
<template>
  <v-app>
    <OfflineIndicator />

    <!-- Slim mobile app bar -->
    <v-app-bar density="compact" flat class="ml-appbar">
      <div class="ml-brand">
        <div class="ml-logo">
          <v-icon size="18" color="white">mdi-message-text</v-icon>
        </div>
        <span class="ml-name">CRM</span>
      </div>

      <v-spacer />

      <NotificationBell />
      <v-btn icon size="small" variant="text" class="ml-1" @click="logout">
        <v-icon size="20">mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <div class="ml-content">
        <slot />
      </div>
    </v-main>

    <BottomNav />
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import NotificationBell from '@/components/NotificationBell.vue';
import BottomNav from '@/components/BottomNav.vue';
import OfflineIndicator from '@/components/OfflineIndicator.vue';

const theme = useTheme();
const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  theme.change('hsLight');
  localStorage.setItem('theme', 'hsLight');
});

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.ml-appbar {
  background: linear-gradient(90deg, #0077b6, #00b4ff) !important;
  color: white !important;
  box-shadow: 0 1px 8px rgba(0, 119, 182, 0.18) !important;
}
.ml-brand {
  display: flex; align-items: center; gap: 8px;
  padding-left: 12px;
}
.ml-logo {
  width: 28px; height: 28px;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.ml-name {
  font-weight: 700; font-size: 16px;
  color: white;
  letter-spacing: -0.3px;
}
.ml-appbar :deep(.v-btn) { color: white !important; }
.ml-content {
  padding-bottom: 0; /* bottom nav có padding riêng */
}
</style>
