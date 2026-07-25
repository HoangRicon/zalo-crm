<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  MobileDashboardView (2026-07-26 redesign clean).
  Cards số liệu nhanh + quick actions cho mobile.
-->
<template>
  <div class="md-root">
    <header class="md-hero">
      <div class="md-greeting">
        <div class="md-greet-sub">{{ greeting }}</div>
        <div class="md-greet-name">{{ userFullName }}</div>
      </div>
      <v-avatar size="40" color="primary" class="md-avatar">
        <span class="text-white font-weight-bold">{{ initials(userFullName) }}</span>
      </v-avatar>
    </header>

    <!-- Stats cards -->
    <div class="md-stats">
      <div class="md-stat md-stat-primary">
        <v-icon size="22" color="white">mdi-message-text</v-icon>
        <div class="md-stat-value">{{ stats.unread }}</div>
        <div class="md-stat-label">Tin chưa đọc</div>
      </div>
      <div class="md-stat md-stat-success">
        <v-icon size="22" color="white">mdi-account-group</v-icon>
        <div class="md-stat-value">{{ stats.contactsToday }}</div>
        <div class="md-stat-label">KH mới hôm nay</div>
      </div>
      <div class="md-stat md-stat-warning">
        <v-icon size="22" color="white">mdi-clock-alert</v-icon>
        <div class="md-stat-value">{{ stats.appointmentsToday }}</div>
        <div class="md-stat-label">Lịch hôm nay</div>
      </div>
      <div class="md-stat md-stat-info">
        <v-icon size="22" color="white">mdi-cellphone-link</v-icon>
        <div class="md-stat-value">{{ stats.connectedNicks }}/{{ stats.totalNicks }}</div>
        <div class="md-stat-label">Nick online</div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="md-section">
      <div class="md-section-title">Thao tác nhanh</div>
      <div class="md-actions">
        <button class="md-action" @click="goChat">
          <div class="md-action-icon" style="background: #0077b6;"><v-icon size="22" color="white">mdi-message-text-outline</v-icon></div>
          <div class="md-action-label">Tin nhắn</div>
        </button>
        <button class="md-action" @click="goContacts">
          <div class="md-action-icon" style="background: #00b894;"><v-icon size="22" color="white">mdi-account-group-outline</v-icon></div>
          <div class="md-action-label">Khách hàng</div>
        </button>
        <button class="md-action" @click="goAppointments">
          <div class="md-action-icon" style="background: #fdcb6e;"><v-icon size="22" color="white">mdi-calendar-clock-outline</v-icon></div>
          <div class="md-action-label">Lịch hẹn</div>
        </button>
        <button class="md-action" @click="goBroadcast">
          <div class="md-action-icon" style="background: #e17055;"><v-icon size="22" color="white">mdi-bullhorn-outline</v-icon></div>
          <div class="md-action-label">Broadcast</div>
        </button>
      </div>
    </div>

    <!-- Today's appointments -->
    <div v-if="upcoming.length" class="md-section">
      <div class="md-section-title">Sắp diễn ra hôm nay</div>
      <div class="md-list">
        <div v-for="a in upcoming" :key="a.id" class="md-list-item" @click="goAppointment(a.id)">
          <div class="md-list-time">{{ formatTime(a.scheduledAt) }}</div>
          <div class="md-list-info">
            <div class="md-list-title">{{ a.title }}</div>
            <div class="md-list-sub">{{ a.contactName ?? '—' }} · {{ a.location ?? 'Online' }}</div>
          </div>
          <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
        </div>
      </div>
    </div>

    <!-- Refresh -->
    <div v-if="loading" class="md-loading">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>
    <div v-else class="md-refresh">
      <button class="md-refresh-btn" @click="loadAll"><v-icon size="16">mdi-refresh</v-icon> Làm mới</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/index';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const userFullName = computed(() => auth.user?.fullName ?? auth.user?.email ?? 'Bạn');
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
});

const loading = ref(false);
const stats = ref({
  unread: 0,
  contactsToday: 0,
  appointmentsToday: 0,
  connectedNicks: 0,
  totalNicks: 0,
});
interface Appointment {
  id: string;
  title: string;
  scheduledAt: string;
  contactName: string | null;
  location: string | null;
}
const upcoming = ref<Appointment[]>([]);

function initials(n: string | null | undefined): string {
  if (!n) return '?';
  const parts = n.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase();
}
function formatTime(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const [dashRes, apptRes] = await Promise.all([
      api.get('/dashboard/stats'),
      api.get('/appointments?today=true&limit=5').catch(() => ({ data: [] })),
    ]);
    stats.value = { ...stats.value, ...dashRes.data };
    upcoming.value = apptRes.data?.items ?? apptRes.data ?? [];
  } catch (err) {
    console.error('[mobile-dashboard] load error', err);
  } finally {
    loading.value = false;
  }
}

const goChat = () => router.push('/chat');
const goContacts = () => router.push('/contacts');
const goAppointments = () => router.push('/appointments');
const goBroadcast = () => router.push('/marketing/broadcasts');
const goAppointment = (id: string) => router.push(`/appointments/${id}`);

onMounted(() => { void loadAll(); });
</script>

<style scoped>
.md-root {
  padding: 16px;
  padding-bottom: 88px; /* trừ bottom nav */
  background: #f7f8fb;
  min-height: 100%;
}
.md-hero {
  display: flex; align-items: center;
  background: linear-gradient(135deg, #0077b6, #00b4ff);
  color: white;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
.md-greeting { flex: 1; }
.md-greet-sub { font-size: 12px; opacity: 0.85; }
.md-greet-name { font-size: 18px; font-weight: 700; margin-top: 2px; }
.md-avatar {
  background: rgba(255,255,255,0.2) !important;
}
.md-avatar span { color: white; }
.md-stats {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}
.md-stat {
  border-radius: 14px;
  padding: 14px;
  color: white;
  display: flex; flex-direction: column; gap: 4px;
  min-height: 88px;
}
.md-stat-primary { background: linear-gradient(135deg, #0077b6, #00b4ff); }
.md-stat-success { background: linear-gradient(135deg, #00b894, #00cec9); }
.md-stat-warning { background: linear-gradient(135deg, #fdcb6e, #f39c12); }
.md-stat-info    { background: linear-gradient(135deg, #6c5ce7, #a29bfe); }
.md-stat-value { font-size: 22px; font-weight: 800; line-height: 1; }
.md-stat-label { font-size: 11px; opacity: 0.9; }

.md-section { margin-bottom: 20px; }
.md-section-title {
  font-size: 13px; font-weight: 600; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.4px;
  margin-bottom: 10px;
}
.md-actions {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.md-action {
  background: white; border: 1px solid #eef0f4;
  border-radius: 12px;
  padding: 12px 6px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  cursor: pointer;
}
.md-action:active { background: #f7f8fb; }
.md-action-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.md-action-label { font-size: 11px; color: #0c2233; font-weight: 500; }
.md-list {
  background: white;
  border: 1px solid #eef0f4;
  border-radius: 12px;
  overflow: hidden;
}
.md-list-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f3f7;
  cursor: pointer;
}
.md-list-item:last-child { border-bottom: none; }
.md-list-time {
  font-size: 13px; font-weight: 700; color: #0077b6;
  min-width: 48px;
}
.md-list-info { flex: 1; min-width: 0; }
.md-list-title {
  font-size: 13px; font-weight: 600; color: #0c2233;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.md-list-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
.md-loading {
  display: flex; justify-content: center; padding: 24px;
}
.md-refresh { text-align: center; padding: 8px 0; }
.md-refresh-btn {
  background: white; border: 1px solid #eef0f4;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px; color: #0077b6;
  display: inline-flex; align-items: center; gap: 6px;
  cursor: pointer;
}
</style>
