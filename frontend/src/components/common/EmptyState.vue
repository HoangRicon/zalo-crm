<template>
  <div class="empty-state">
    <div class="empty-icon">
      <slot name="icon">
        <!-- Default placeholder (override bằng SVG component-specific) -->
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </slot>
    </div>
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <button v-if="ctaLabel" class="empty-cta" @click="$emit('cta')">
      {{ ctaLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  ctaLabel?: string;
}>();
defineEmits<{ cta: [] }>();
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
  color: var(--text-muted, #64748b);
  min-height: 280px;
}
.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-subtle, #f1f5f9);
  color: var(--text-muted, #64748b);
  margin-bottom: 16px;
  opacity: 0.7;
}
.empty-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}
.empty-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 320px;
}
.empty-cta {
  background: var(--accent, #1f6feb);
  color: #fff;
  border: 0;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.empty-cta:hover { background: #1858c4; }
</style>
