<template>
  <select :value="modelValue" class="channel-filter" @change="onChange">
    <option value="all">📬 Tất cả</option>
    <option value="zalo">💬 Zalo</option>
    <option value="telegram">✈️ Telegram</option>
    <option value="facebook">📘 Facebook</option>
    <option value="instagram">📸 Instagram</option>
    <option value="sms">📱 SMS</option>
  </select>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

function onChange(e: Event) {
  const t = e.target as HTMLSelectElement;
  emit('update:modelValue', t.value);
}
</script>

<style scoped>
.channel-filter {
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 4px 10px;
  font-size: 13px;
  font-family: inherit;
  background: white;
  cursor: pointer;
}
</style>
