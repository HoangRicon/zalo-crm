<template>
  <div class="ss-page">
    <header class="ss-header">
      <button class="ss-back" @click="$router.back()">← Quay lại</button>
      <div>
        <h1 class="ss-title">🔔 Nick gửi thông báo hệ thống</h1>
        <p class="ss-sub">
          Chọn nick Zalo dùng để gửi tin nhắn nội bộ (nhắc lịch hẹn, thông báo hệ thống cho nhân viên…).
          Nick phải <b>đang connected</b>.
        </p>
      </div>
    </header>

    <div class="ss-card">
      <div v-if="loading" class="ss-loading">⏳ Đang tải…</div>
      <template v-else>
        <div class="ss-row">
          <label class="ss-label">Nick Zalo gửi</label>
          <v-select
            v-model="selectedId"
            :items="options"
            item-title="title"
            item-value="value"
            placeholder="Chọn nick Zalo"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
            :loading="saving"
            class="ss-select"
            @update:model-value="save"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps">
                <template #prepend>
                  <v-avatar size="32" :color="item.raw.online ? 'success' : 'grey'">
                    <span class="text-white text-caption">{{ initials(item.raw.displayName) }}</span>
                  </v-avatar>
                </template>
                <template #append>
                  <v-chip
                    size="x-small"
                    :color="item.raw.online ? 'success' : 'error'"
                    variant="tonal"
                  >
                    {{ item.raw.online ? 'Online' : 'Offline' }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-select>
        </div>

        <div v-if="error" class="ss-error">❌ {{ error }}</div>
        <div v-if="message" class="ss-ok">✅ {{ message }}</div>

        <div class="ss-tip">
          💡 Nếu nick đang offline, hệ thống sẽ chặn gửi. Cắm lại nick trước khi chọn.
        </div>
      </template>
    </div>

    <div class="ss-card">
      <h2 class="ss-h2">📌 Phạm vi áp dụng</h2>
      <ul class="ss-list">
        <li>Nhắc lịch hẹn cho nhân viên</li>
        <li>Thông báo deal stuck từ Scoring Engine</li>
        <li>Tag tự động → ping owner</li>
        <li>Các sự kiện chăm sóc KH tự động</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api/index';

interface NickOption {
  id: string;
  displayName: string;
  online: boolean;
}

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const selectedId = ref<string | null>(null);
const nicks = ref<NickOption[]>([]);

const options = computed(() =>
  nicks.value.map((n) => ({
    value: n.id,
    title: n.displayName,
    raw: n,
  })),
);

function initials(name: string | undefined | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get<{ systemNotifyZaloAccountId: string | null; nicks: Array<{ id: string; displayName: string; status: string }> }>(
      '/system-notifications/settings',
    );
    selectedId.value = data.systemNotifyZaloAccountId ?? null;
    nicks.value = (data.nicks || []).map((n) => ({
      id: n.id,
      displayName: n.displayName,
      online: n.status === 'connected',
    }));
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'Lỗi tải cấu hình';
  } finally {
    loading.value = false;
  }
}

async function save(value: string | null) {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    await api.patch('/system-notifications/settings/sender', { zaloAccountId: value || null });
    message.value = value ? 'Đã lưu nick gửi' : 'Đã bỏ chọn nick';
    setTimeout(() => (message.value = ''), 3000);
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'Lỗi lưu';
    // Reload to reset to actual state
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ss-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
}
.ss-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.ss-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
}
.ss-sub {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}
.ss-back {
  background: #fff;
  border: 1px solid #e5e7eb;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.ss-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
}
.ss-loading { padding: 24px; text-align: center; color: #6b7280; }
.ss-row { display: grid; grid-template-columns: 200px 1fr; gap: 16px; align-items: center; }
.ss-label { font-size: 13px; font-weight: 600; }
.ss-error {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  font-size: 13px;
}
.ss-ok {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  font-size: 13px;
}
.ss-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  padding: 8px 12px;
  border-radius: 6px;
}
.ss-h2 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.ss-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #374151;
  line-height: 1.8;
}
</style>
