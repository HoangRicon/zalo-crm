<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- LeadPoolConfigForm.vue — Settings form for Lead Pool configuration -->
<template>
  <div class="lpcf">
    <div class="lpcf-grid">
      <!-- Enable/Disable -->
      <section class="lpcf-section lpcf-full">
        <div class="lpcf-row">
          <div class="lpcf-row-text">
            <div class="lpcf-title">Bật Lead Pool</div>
            <div class="lpcf-desc">Khi bật, lead quên sẽ tự động vào pool và sale có thể xin nhận lead.</div>
          </div>
          <v-switch
            v-model="form.enabled"
            color="primary"
            hide-details
            density="comfortable"
            :disabled="saving"
          />
        </div>
      </section>

      <!-- Quota settings -->
      <section class="lpcf-section">
        <h3 class="lpcf-section-title">Giới hạn yêu cầu</h3>

        <div class="lpcf-field">
          <label class="lpcf-label">Số lead được xin mỗi ngày</label>
          <v-text-field
            v-model.number="form.maxRequestsPerDay"
            type="number"
            :min="1"
            :max="100"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="saving"
          />
          <span class="lpcf-hint">Số lead tối đa mỗi sale được xin trong 1 ngày</span>
        </div>

        <div class="lpcf-field">
          <label class="lpcf-label">Thời gian chờ giữa các lần xin (phút)</label>
          <v-text-field
            v-model.number="form.cooldownMinutes"
            type="number"
            :min="1"
            :max="1440"
            suffix="phút"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="saving"
          />
          <span class="lpcf-hint">Sau khi xin 1 lead, phải chờ N phút trước khi xin tiếp</span>
        </div>
      </section>

      <!-- Auto-return settings -->
      <section class="lpcf-section">
        <h3 class="lpcf-section-title">Tự động trả lại pool</h3>

        <div class="lpcf-field">
          <label class="lpcf-label">Tự động trả sau</label>
          <div class="lpcf-quick">
            <button
              v-for="q in AUTO_RETURN_OPTIONS"
              :key="q.value"
              type="button"
              class="lpcf-chip"
              :class="{ active: form.autoReturnAfterMinutes === q.value }"
              :disabled="saving"
              @click="form.autoReturnAfterMinutes = q.value"
            >
              {{ q.label }}
            </button>
          </div>
          <v-text-field
            v-model.number="form.autoReturnAfterMinutes"
            type="number"
            :min="30"
            :max="10080"
            suffix="phút"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 160px"
            :disabled="saving"
          />
          <span class="lpcf-hint">Lead không được chăm sóc sẽ tự động trả về pool sau N phút</span>
        </div>
      </section>

      <!-- Lead requirements -->
      <section class="lpcf-section lpcf-full">
        <h3 class="lpcf-section-title">Yêu cầu lead trong pool</h3>

        <div class="lpcf-row">
          <div class="lpcf-row-text">
            <div class="lpcf-title">Bắt buộc có SĐT</div>
            <div class="lpcf-desc">Chỉ lead có số điện thoại mới được vào pool. Tắt nếu muốn redistribute UID-only lead.</div>
          </div>
          <v-switch
            v-model="form.requirePhoneInPool"
            color="primary"
            hide-details
            density="comfortable"
            :disabled="saving"
          />
        </div>

        <div class="lpcf-row">
          <div class="lpcf-row-text">
            <div class="lpcf-title">Buộc ghi chú trước khi xin lead tiếp</div>
            <div class="lpcf-desc">Sale phải ghi ít nhất {{ form.noteMinLength }} ký tự về lead trước khi xin lead mới.</div>
          </div>
          <v-switch
            v-model="form.forceNoteBeforeNext"
            color="primary"
            hide-details
            density="comfortable"
            :disabled="saving"
          />
        </div>

        <div v-if="form.forceNoteBeforeNext" class="lpcf-field">
          <label class="lpcf-label">Số ký tự tối thiểu của ghi chú</label>
          <v-text-field
            v-model.number="form.noteMinLength"
            type="number"
            :min="1"
            :max="500"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 120px"
            :disabled="saving"
          />
        </div>
      </section>

      <!-- Source settings -->
      <section class="lpcf-section lpcf-full">
        <h3 class="lpcf-section-title">Nguồn lead</h3>
        <div class="lpcf-sources">
          <label
            v-for="src in SOURCE_OPTIONS"
            :key="src.value"
            class="lpcf-source"
            :class="{ checked: form.enabledSources.includes(src.value) }"
          >
            <input
              type="checkbox"
              :value="src.value"
              :checked="form.enabledSources.includes(src.value)"
              :disabled="saving"
              @change="toggleSource(src.value)"
            />
            <v-icon size="16">{{ src.icon }}</v-icon>
            <div>
              <div class="lpcf-source-label">{{ src.label }}</div>
              <div class="lpcf-source-desc">{{ src.desc }}</div>
            </div>
          </label>
        </div>
      </section>

      <!-- Cooldown after note -->
      <section class="lpcf-section">
        <h3 class="lpcf-section-title">Cooldown sau ghi chú</h3>

        <div class="lpcf-field">
          <label class="lpcf-label">Sau khi ghi chú, KH này không vào pool ai khác trong</label>
          <div class="lpcf-quick">
            <button
              v-for="q in COOLDOWN_OPTIONS"
              :key="q.value"
              type="button"
              class="lpcf-chip"
              :class="{ active: form.cooldownAfterNoteDays === q.value }"
              :disabled="saving"
              @click="form.cooldownAfterNoteDays = q.value"
            >
              {{ q.label }}
            </button>
          </div>
        </div>

        <div class="lpcf-field">
          <label class="lpcf-label">Khóa tự nhận lại trong</label>
          <div class="lpcf-quick">
            <button
              v-for="q in LOCK_OPTIONS"
              :key="q.value"
              type="button"
              class="lpcf-chip"
              :class="{ active: form.selfReclaimLockDays === q.value }"
              :disabled="saving"
              @click="form.selfReclaimLockDays = q.value"
            >
              {{ q.label }}
            </button>
          </div>
          <span class="lpcf-hint">Sale trả lead thì không được nhận lại chính KH đó trong N ngày</span>
        </div>
      </section>

      <!-- Excluded statuses -->
      <section class="lpcf-section">
        <h3 class="lpcf-section-title">Trạng thái loại khỏi pool</h3>
        <p class="lpcf-hint" style="margin-bottom: 12px">Những trạng thái này sẽ không bao giờ vào pool.</p>
        <div class="lpcf-statuses">
          <label
            v-for="status in availableStatuses"
            :key="status.key"
            class="lpcf-status"
            :class="{ checked: form.excludedStatuses.includes(status.key) }"
          >
            <input
              type="checkbox"
              :checked="form.excludedStatuses.includes(status.key)"
              :disabled="saving"
              @change="toggleExcludeStatus(status.key)"
            />
            {{ status.label }}
          </label>
        </div>
      </section>
    </div>

    <!-- Actions -->
    <div class="lpcf-actions">
      <button class="btn btn-ghost" :disabled="saving" @click="$emit('cancel')">
        Hủy
      </button>
      <button class="btn btn-primary" :disabled="saving || !hasChanges" @click="save">
        <v-icon v-if="saving" size="16" class="spin">mdi-loading</v-icon>
        {{ saving ? 'Đang lưu...' : 'Lưu cài đặt' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import type { LeadPoolConfig } from '@/api/lead-pool';

const props = defineProps<{
  config: LeadPoolConfig;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', data: Partial<LeadPoolConfig>): void;
  (e: 'cancel'): void;
}>();

const AUTO_RETURN_OPTIONS = [
  { label: '30p', value: 30 },
  { label: '1h', value: 60 },
  { label: '6h', value: 360 },
  { label: '12h', value: 720 },
  { label: '1 ngày', value: 1440 },
  { label: '3 ngày', value: 4320 },
  { label: '7 ngày', value: 10080 },
];

const COOLDOWN_OPTIONS = [
  { label: '7 ngày', value: 7 },
  { label: '15 ngày', value: 15 },
  { label: '30 ngày', value: 30 },
  { label: '60 ngày', value: 60 },
];

const LOCK_OPTIONS = [
  { label: '3 ngày', value: 3 },
  { label: '7 ngày', value: 7 },
  { label: '14 ngày', value: 14 },
  { label: '30 ngày', value: 30 },
];

const SOURCE_OPTIONS = [
  { value: 'forgotten', label: 'Lead quên', icon: 'mdi-account-clock-outline', desc: 'Lead không có tương tác trong N ngày' },
  { value: 'customer_list', label: 'Tệp khách hàng', icon: 'mdi-file-multiple-outline', desc: 'Lead từ danh sách KH' },
  { value: 'external_sync', label: 'Sync ngoài', icon: 'mdi-sync-circle-outline', desc: 'Lead đồng bộ từ hệ thống bên ngoài' },
];

const availableStatuses = [
  { key: 'hot', label: 'Nhiệt tình' },
  { key: 'warm', label: 'Quan tâm' },
  { key: 'potential', label: 'Tiềm năng' },
  { key: 'won', label: 'Thành công' },
  { key: 'cold', label: 'Lạnh' },
  { key: 'new', label: 'Mới' },
];

const form = reactive({
  enabled: props.config?.enabled ?? true,
  maxRequestsPerDay: props.config?.maxRequestsPerDay ?? 10,
  cooldownMinutes: props.config?.cooldownMinutes ?? 15,
  autoReturnAfterMinutes: props.config?.autoReturnAfterMinutes ?? 1440,
  requirePhoneInPool: props.config?.requirePhoneInPool ?? true,
  forceNoteBeforeNext: props.config?.forceNoteBeforeNext ?? true,
  noteMinLength: props.config?.noteMinLength ?? 20,
  enabledSources: [...(props.config?.enabledSources ?? ['forgotten', 'customer_list'])],
  excludedStatuses: [...(props.config?.excludedStatuses ?? ['hot', 'potential', 'won'])],
  cooldownAfterNoteDays: props.config?.cooldownAfterNoteDays ?? 30,
  selfReclaimLockDays: props.config?.selfReclaimLockDays ?? 7,
});

const defaultConfig = {
  enabled: true,
  maxRequestsPerDay: 10,
  cooldownMinutes: 15,
  autoReturnAfterMinutes: 1440,
  requirePhoneInPool: true,
  forceNoteBeforeNext: true,
  noteMinLength: 20,
  enabledSources: ['forgotten', 'customer_list'],
  excludedStatuses: ['hot', 'potential', 'won'],
  cooldownAfterNoteDays: 30,
  selfReclaimLockDays: 7,
};

const hasChanges = computed(() => {
  return JSON.stringify(form) !== JSON.stringify({
    ...defaultConfig,
    ...props.config,
  });
});

function toggleSource(value: string) {
  const idx = form.enabledSources.indexOf(value);
  if (idx >= 0) {
    form.enabledSources.splice(idx, 1);
  } else {
    form.enabledSources.push(value);
  }
}

function toggleExcludeStatus(value: string) {
  const idx = form.excludedStatuses.indexOf(value);
  if (idx >= 0) {
    form.excludedStatuses.splice(idx, 1);
  } else {
    form.excludedStatuses.push(value);
  }
}

function save() {
  emit('save', {
    enabled: form.enabled,
    maxRequestsPerDay: form.maxRequestsPerDay,
    cooldownMinutes: form.cooldownMinutes,
    autoReturnAfterMinutes: form.autoReturnAfterMinutes,
    requirePhoneInPool: form.requirePhoneInPool,
    forceNoteBeforeNext: form.forceNoteBeforeNext,
    noteMinLength: form.noteMinLength,
    enabledSources: form.enabledSources,
    excludedStatuses: form.excludedStatuses,
    cooldownAfterNoteDays: form.cooldownAfterNoteDays,
    selfReclaimLockDays: form.selfReclaimLockDays,
  });
}
</script>

<style scoped>
.lpcf {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lpcf-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.lpcf-full {
  grid-column: 1 / -1;
}

.lpcf-section {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
}

.lpcf-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 16px;
}

.lpcf-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 0;
}

.lpcf-row + .lpcf-row {
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.lpcf-row-text {
  flex: 1;
}

.lpcf-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.lpcf-desc {
  font-size: 13px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

.lpcf-field {
  margin-bottom: 16px;
}

.lpcf-field:last-child {
  margin-bottom: 0;
}

.lpcf-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin-bottom: 8px;
}

.lpcf-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 4px;
}

.lpcf-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.lpcf-chip {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: var(--bg-surface, #fff);
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lpcf-chip:hover:not(:disabled) {
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.lpcf-chip.active {
  background: var(--primary, #3b82f6);
  border-color: var(--primary, #3b82f6);
  color: #fff;
}

.lpcf-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lpcf-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lpcf-source {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lpcf-source:hover {
  background: var(--bg-subtle, #f8fafc);
}

.lpcf-source.checked {
  border-color: var(--primary, #3b82f6);
  background: rgba(59, 130, 246, 0.05);
}

.lpcf-source input {
  margin-top: 2px;
  accent-color: var(--primary, #3b82f6);
}

.lpcf-source-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.lpcf-source-desc {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

.lpcf-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lpcf-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lpcf-status:hover {
  background: var(--bg-subtle, #f8fafc);
}

.lpcf-status.checked {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #dc2626;
}

.lpcf-status input {
  accent-color: var(--primary, #3b82f6);
}

.lpcf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
