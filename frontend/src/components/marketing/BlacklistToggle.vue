<template>
  <div class="blacklist-toggle">
    <label class="switch">
      <input
        type="checkbox"
        :checked="blacklisted"
        :disabled="saving"
        @change="onToggle"
      />
      <span class="slider"></span>
      <span class="switch-label">🚫 Không dùng nick này cho Broadcast</span>
    </label>
    <textarea
      v-if="blacklisted"
      v-model="reason"
      maxlength="200"
      placeholder="Lý do (vd: Bị Zalo rate-limit 3 lần trong tuần)"
      rows="2"
      class="reason-input"
      :disabled="saving"
      @blur="onSaveReason"
    />
    <span v-if="blacklisted" class="badge">🚫 Broadcast disabled</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{
  accountId: string;
  modelValue: boolean;
  modelReason?: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>();

const blacklisted = ref(props.modelValue);
const reason = ref(props.modelReason ?? '');
const saving = ref(false);

watch(() => props.modelValue, (v) => { blacklisted.value = v; });
watch(() => props.modelReason, (v) => { reason.value = v ?? ''; });

async function onToggle(e: Event) {
  const target = e.target as HTMLInputElement;
  const newVal = target.checked;
  saving.value = true;
  try {
    await api.put(`/zalo-accounts/${props.accountId}/broadcast-blacklist`, {
      blacklisted: newVal,
      reason: newVal ? reason.value : null,
    });
    blacklisted.value = newVal;
    emit('update:modelValue', newVal);
  } catch (err) {
    console.error('[BlacklistToggle] save error', err);
    target.checked = !newVal; // revert
  } finally {
    saving.value = false;
  }
}

async function onSaveReason() {
  if (!blacklisted.value) return;
  if ((reason.value ?? '').trim() === (props.modelReason ?? '').trim()) return;
  saving.value = true;
  try {
    await api.put(`/zalo-accounts/${props.accountId}/broadcast-blacklist`, {
      blacklisted: true,
      reason: reason.value,
    });
  } catch (err) {
    console.error('[BlacklistToggle] save reason error', err);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.blacklist-toggle {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.switch input {
  display: none;
}
.slider {
  width: 36px;
  height: 20px;
  background: #cbd5e1;
  border-radius: 999px;
  position: relative;
  transition: background 0.18s;
}
.slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: left 0.18s;
}
.switch input:checked + .slider {
  background: #ef4444;
}
.switch input:checked + .slider::before {
  left: 18px;
}
.switch-label {
  font-size: 13px;
}
.reason-input {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}
.badge {
  display: inline-block;
  background: #fee2e2;
  color: #b91c1c;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  align-self: flex-start;
}
</style>
