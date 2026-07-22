<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- LeadRequestButton.vue — Sale request button for Lead Pool -->
<template>
  <div class="lrb-wrapper">
    <!-- Quota display -->
    <div class="lrb-quota" v-if="showQuota">
      <div class="lrb-quota-info">
        <span class="lrb-quota-label">Hạn mức hôm nay</span>
        <span class="lrb-quota-value">
          <strong>{{ quota?.remainingQuota ?? '—' }}</strong> / {{ quota?.maxRequestsPerDay ?? '—' }}
        </span>
      </div>
      <div class="lrb-progress">
        <div
          class="lrb-progress-bar"
          :style="{ width: `${quotaProgress}%` }"
          :class="{ warning: quotaProgress > 70, danger: quotaProgress > 90 }"
        ></div>
      </div>
    </div>

    <!-- Request button -->
    <button
      class="lrb-btn"
      :class="{ loading: requesting, cooldown: isInCooldown, disabled: !canRequest }"
      :disabled="!canRequest || requesting"
      @click="requestLead"
    >
      <v-icon v-if="requesting" size="18" class="spin">mdi-loading</v-icon>
      <v-icon v-else-if="isInCooldown" size="18">mdi-clock-outline</v-icon>
      <v-icon v-else size="18">mdi-account-plus-outline</v-icon>
      <span>{{ buttonLabel }}</span>
    </button>

    <!-- Cooldown timer -->
    <div v-if="isInCooldown && cooldownDisplay" class="lrb-cooldown">
      <span>Thử lại sau: {{ cooldownDisplay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useToast } from '@/composables/use-toast';
import { getUserQuota, requestLead as apiRequestLead } from '@/api/lead-pool';
import type { UserQuota } from '@/api/lead-pool';

const props = defineProps<{
  showQuota?: boolean;
}>();

const emit = defineEmits<{
  (e: 'success', contactId: string): void;
}>();

const toast = useToast();
const quota = ref<UserQuota | null>(null);
const requesting = ref(false);
let cooldownInterval: ReturnType<typeof setInterval> | null = null;

const quotaProgress = computed(() => {
  if (!quota.value) return 0;
  return Math.min(100, (quota.value.usedToday / quota.value.maxRequestsPerDay) * 100);
});

const isInCooldown = computed(() => quota.value?.inCooldown ?? false);

const cooldownDisplay = computed(() => {
  if (!quota.value || !isInCooldown.value) return null;
  const seconds = quota.value.cooldownSecondsLeft;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

const canRequest = computed(() => {
  if (!quota.value) return true;
  return !isInCooldown.value && quota.value.remainingQuota > 0;
});

const buttonLabel = computed(() => {
  if (requesting.value) return 'Đang xin...';
  if (isInCooldown.value) return 'Đang chờ...';
  if (!quota.value) return 'Nhận Lead';
  if (quota.value.remainingQuota <= 0) return 'Hết hạn mức';
  return 'Nhận Lead';
});

async function fetchQuota() {
  try {
    quota.value = await getUserQuota();
  } catch (e) {
    console.error('[LeadRequestButton] failed to fetch quota', e);
  }
}

async function requestLead() {
  if (!canRequest.value || requesting.value) return;

  requesting.value = true;
  try {
    const distribution = await apiRequestLead();
    toast.success(`Đã nhận lead thành công!`);
    emit('success', distribution.contactId ?? '');
    await fetchQuota(); // Refresh quota
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    const errorCode = err.response?.data?.error;
    const messages: Record<string, string> = {
      lead_pool_disabled: 'Lead Pool đang tắt',
      in_cooldown: 'Vui lòng chờ hết thời gian cooldown',
      quota_exceeded: 'Bạn đã hết hạn mức nhận lead hôm nay',
      no_leads_in_pool: 'Hiện không có lead nào trong pool',
    };
    toast.error(messages[errorCode ?? ''] ?? 'Không thể nhận lead. Vui lòng thử lại.');
  } finally {
    requesting.value = false;
  }
}

function startCooldownTimer() {
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    if (quota.value && quota.value.cooldownSecondsLeft > 0) {
      quota.value = {
        ...quota.value,
        cooldownSecondsLeft: quota.value.cooldownSecondsLeft - 1,
      };
      if (quota.value.cooldownSecondsLeft <= 0) {
        quota.value = { ...quota.value, inCooldown: false, cooldownSecondsLeft: 0 };
        if (cooldownInterval) clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }
  }, 1000);
}

onMounted(() => {
  fetchQuota();
});

onUnmounted(() => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
});
</script>

<style scoped>
.lrb-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.lrb-quota {
  width: 100%;
  max-width: 240px;
  text-align: center;
}

.lrb-quota-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.lrb-quota-label {
  color: var(--text-muted, #64748b);
}

.lrb-quota-value {
  color: var(--text-secondary, #475569);
}

.lrb-quota-value strong {
  color: var(--primary, #3b82f6);
}

.lrb-progress {
  height: 4px;
  background: var(--bg-subtle, #f1f5f9);
  border-radius: 2px;
  overflow: hidden;
}

.lrb-progress-bar {
  height: 100%;
  background: var(--primary, #3b82f6);
  transition: width 0.3s ease, background-color 0.3s ease;
}

.lrb-progress-bar.warning {
  background: #f59e0b;
}

.lrb-progress-bar.danger {
  background: #ef4444;
}

.lrb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  background: var(--primary, #3b82f6);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.lrb-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.lrb-btn:active:not(:disabled) {
  transform: translateY(0);
}

.lrb-btn.loading {
  opacity: 0.8;
  cursor: not-allowed;
}

.lrb-btn.cooldown {
  background: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}

.lrb-btn.disabled,
.lrb-btn:disabled {
  background: var(--bg-subtle, #f1f5f9);
  color: var(--text-muted, #94a3b8);
  box-shadow: none;
  cursor: not-allowed;
}

.lrb-cooldown {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
