<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!--
  MarketingEmptyState — Empty state chuẩn (2026-07-28 redesign).
  Dùng cho mọi view marketing khi list rỗng / loading / lỗi.
-->
<template>
  <div class="mk-empty" :class="{ 'mk-empty-loading': loading }">
    <v-icon v-if="icon" size="48" class="mk-empty-icon">{{ icon }}</v-icon>
    <p v-if="title" class="mk-empty-title">{{ title }}</p>
    <p v-if="hint" class="mk-empty-hint">{{ hint }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
  hint?: string;
  loading?: boolean;
}>();
</script>

<style scoped>
.mk-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 8px;
  color: var(--smax-grey-700, #6b7280);
}
.mk-empty-icon {
  color: var(--smax-grey-400, #9ca3af);
  margin-bottom: 4px;
}
.mk-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--smax-text, #111827);
  margin: 0;
}
.mk-empty-hint {
  font-size: 13px;
  color: var(--smax-grey-700, #6b7280);
  margin: 0;
  line-height: 1.5;
  max-width: 380px;
}
.mk-empty-loading .mk-empty-icon {
  animation: mk-spin 1.4s linear infinite;
}
@keyframes mk-spin {
  to { transform: rotate(360deg); }
}
</style>