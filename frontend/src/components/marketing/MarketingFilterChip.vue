<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!--
  MarketingFilterChip — Chip filter row chuẩn (2026-07-28 redesign).
  Dùng cho BroadcastsView, LeadPoolView, SequencesView.
-->
<template>
  <div class="mk-filter-row">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      class="mk-filter-chip"
      :class="{ 'mk-filter-active': modelValue === opt.value }"
      type="button"
      @click="$emit('update:modelValue', opt.value)"
    >
      <span class="mk-filter-label">{{ opt.label }}</span>
      <span v-if="opt.count !== undefined" class="mk-filter-count">{{ opt.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
defineProps<{
  modelValue: T;
  options: Array<{ value: T; label: string; count?: number }>;
}>();
defineEmits<{ 'update:modelValue': [value: T] }>();
</script>

<style scoped>
.mk-filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
}
.mk-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid var(--smax-grey-200, #e5e7eb);
  background: var(--smax-bg, #fff);
  color: var(--smax-grey-700, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}
.mk-filter-chip:hover {
  border-color: var(--smax-grey-400, #9ca3af);
  color: var(--smax-text, #111827);
}
.mk-filter-active {
  background: var(--smax-primary, #3b82f6);
  border-color: var(--smax-primary, #3b82f6);
  color: #fff;
}
.mk-filter-active:hover {
  background: var(--smax-primary-dark, #2563eb);
  border-color: var(--smax-primary-dark, #2563eb);
  color: #fff;
}
.mk-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}
.mk-filter-active .mk-filter-count { background: rgba(255, 255, 255, 0.25); }
.mk-filter-chip:not(.mk-filter-active) .mk-filter-count {
  background: var(--smax-grey-100, #f3f4f6);
  color: var(--smax-grey-700, #6b7280);
}
</style>