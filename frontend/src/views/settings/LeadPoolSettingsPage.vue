<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- LeadPoolSettingsPage.vue — Settings page for Lead Pool configuration -->
<template>
  <div class="lps-page">
    <header class="lps-header">
      <div class="lps-ico">🎯</div>
      <div>
        <h1 class="lps-h1">Lead Pool</h1>
        <p class="lps-sub">
          Cấu hình pool chia lead tự động cho đội ngũ sale. Lead quên sẽ tự động quay về pool và được phân phối theo FIFO.
        </p>
      </div>
    </header>

    <div v-if="loading" class="lps-loading">Đang tải cài đặt…</div>

    <template v-else>
      <LeadPoolConfigForm
        v-if="config"
        :config="config"
        :saving="saving"
        @save="onSave"
        @cancel="$router.back()"
      />
    </template>

    <!-- Success toast -->
    <v-snackbar v-model="showSuccess" color="success" timeout="3000">
      <v-icon class="mr-2">mdi-check-circle</v-icon>
      Đã lưu cài đặt thành công
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@/composables/use-toast';
import LeadPoolConfigForm from '@/components/lead-pool/LeadPoolConfigForm.vue';
import { getLeadPoolConfig, updateLeadPoolConfig } from '@/api/lead-pool';
import type { LeadPoolConfig } from '@/api/lead-pool';

const router = useRouter();
const toast = useToast();

const config = ref<LeadPoolConfig | null>(null);
const loading = ref(true);
const saving = ref(false);
const showSuccess = ref(false);

async function fetchConfig() {
  loading.value = true;
  try {
    config.value = await getLeadPoolConfig();
  } catch (e) {
    console.error('[LeadPoolSettings] failed to fetch config', e);
    toast.error('Không thể tải cài đặt. Vui lòng thử lại.');
  } finally {
    loading.value = false;
  }
}

async function onSave(data: Partial<LeadPoolConfig>) {
  saving.value = true;
  try {
    config.value = await updateLeadPoolConfig(data);
    showSuccess.value = true;
  } catch (e) {
    console.error('[LeadPoolSettings] failed to save config', e);
    toast.error('Không thể lưu cài đặt. Vui lòng thử lại.');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  fetchConfig();
});
</script>

<style scoped>
.lps-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.lps-header {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.lps-ico {
  font-size: 32px;
  line-height: 1;
}

.lps-h1 {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.lps-sub {
  font-size: 14px;
  color: var(--text-muted, #64748b);
  margin: 6px 0 0;
  max-width: 600px;
}

.lps-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  color: var(--text-muted, #64748b);
  font-size: 14px;
}
</style>
