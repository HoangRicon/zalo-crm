<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!--
  MarketingHeader — Header chuẩn cho 5 view marketing (2026-07-28 redesign).
  Layout: subtitle (caption) + title (h5) + actions slot
  Refactor: thay thế pattern lặp lại ở GroupScanView, LeadPoolView, BroadcastsView.
-->
<template>
  <header class="mk-header">
    <div class="mk-header-text">
      <div v-if="subtitle" class="mk-header-subtitle">{{ subtitle }}</div>
      <h1 class="mk-header-title">{{ title }}</h1>
      <p v-if="description" class="mk-header-desc">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="mk-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  description?: string;
}>();
</script>

<style scoped>
.mk-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--smax-grey-200, #e5e7eb);
  background: var(--smax-bg, #fff);
}
.mk-header-text { flex: 1; min-width: 0; }
.mk-header-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--smax-grey-700, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.mk-header-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--smax-text, #111827);
  line-height: 1.3;
}
.mk-header-desc {
  font-size: 13px;
  color: var(--smax-grey-700, #6b7280);
  margin: 6px 0 0;
  line-height: 1.5;
}
.mk-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .mk-header { flex-direction: column; align-items: stretch; }
  .mk-header-actions { flex-wrap: wrap; }
}
</style>