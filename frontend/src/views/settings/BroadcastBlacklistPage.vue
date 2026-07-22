<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<template>
  <div class="bb-page">
    <header class="bb-header">
      <div class="bb-ico">🚫</div>
      <div>
        <h1 class="bb-h1">Blacklist broadcast</h1>
        <p class="bb-sub">Nick bị blacklist sẽ bị cron broadcast skip. Job vẫn ở trạng thái 'active' — re-enable nick sẽ tự chạy lại.</p>
      </div>
    </header>

    <div v-if="loading" class="bb-loading">Đang tải danh sách nick…</div>

    <div v-else-if="!accounts.length" class="bb-empty">Chưa có nick nào.</div>

    <div v-else class="bb-list">
      <div v-for="acc in accounts" :key="acc.id" class="bb-item">
        <div class="bb-meta">
          <strong>{{ acc.displayName || acc.phone || acc.id.slice(0, 8) }}</strong>
          <span v-if="isBlacklisted(acc) && acc.broadcastBlacklistReason" class="bb-reason">
            "{{ acc.broadcastBlacklistReason }}"
          </span>
        </div>
        <BlacklistToggle
          :account-id="acc.id"
          :model-value="isBlacklisted(acc)"
          :model-reason="acc.broadcastBlacklistReason"
          @update:model-value="onChange(acc, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api/index';
import BlacklistToggle from '@/components/marketing/BlacklistToggle.vue';

interface Account {
  id: string;
  displayName?: string | null;
  phone?: string | null;
  broadcastBlacklisted?: boolean;
  broadcastBlacklistReason?: string | null;
}

const accounts = ref<Account[]>([]);
const loading = ref(true);

function isBlacklisted(acc: Account): boolean {
  return acc.broadcastBlacklisted === true;
}

async function fetchAccounts() {
  loading.value = true;
  try {
    const { data } = await api.get('/zalo-accounts/enriched');
    accounts.value = data as Account[];
  } catch (e) {
    console.error('[BroadcastBlacklist] fetch failed', e);
  } finally {
    loading.value = false;
  }
}

function onChange(acc: Account, val: boolean) {
  acc.broadcastBlacklisted = val;
}

onMounted(fetchAccounts);
</script>

<style scoped>
.bb-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}
.bb-header { display: flex; gap: 16px; margin-bottom: 24px; }
.bb-ico { font-size: 32px; line-height: 1; }
.bb-h1 { font-size: 22px; font-weight: 600; color: #1e293b; margin: 0; }
.bb-sub { font-size: 14px; color: #64748b; margin: 6px 0 0; max-width: 600px; }
.bb-loading, .bb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  color: #64748b;
  font-size: 14px;
}
.bb-list { display: flex; flex-direction: column; gap: 12px; }
.bb-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 18px;
}
.bb-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.bb-meta strong { font-size: 14px; color: #1e293b; }
.bb-reason { font-size: 12px; color: #b91c1c; font-style: italic; }
</style>