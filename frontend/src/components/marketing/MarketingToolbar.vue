<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!--
  MarketingToolbar — Toolbar chuẩn cho view marketing (2026-07-28 redesign).
  Search input + filter slot + sort slot + actions slot. Responsive wrap.
  Dùng cho LeadPoolView, BroadcastsView, SequencesView.
-->
<template>
  <div class="mk-toolbar">
    <div v-if="search !== undefined || $slots.search" class="mk-toolbar-search">
      <slot name="search">
        <v-text-field
          :model-value="search"
          :placeholder="searchPlaceholder"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          style="max-width: 320px;"
          @update:model-value="$emit('update:search', String($event ?? ''))"
        />
      </slot>
    </div>
    <div v-if="$slots.filter" class="mk-toolbar-filter">
      <slot name="filter" />
    </div>
    <v-spacer />
    <div v-if="$slots.actions" class="mk-toolbar-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  search?: string;
  searchPlaceholder?: string;
}>();
defineEmits<{ 'update:search': [value: string] }>();
</script>

<style scoped>
.mk-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--smax-bg, #fff);
  border-bottom: 1px solid var(--smax-grey-200, #e5e7eb);
  flex-wrap: wrap;
}
.mk-toolbar-search { flex-shrink: 0; }
.mk-toolbar-filter { flex-shrink: 0; }
.mk-toolbar-actions { display: flex; gap: 8px; }

@media (max-width: 768px) {
  .mk-toolbar { gap: 8px; }
}
</style>