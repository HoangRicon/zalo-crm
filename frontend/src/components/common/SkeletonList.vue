<template>
  <div class="skeleton-list">
    <div
      v-for="i in count"
      :key="i"
      class="skeleton-row"
      :style="{ height: typeof height === 'number' ? height + 'px' : height }"
    >
      <div class="skeleton-bar w-40" />
      <div class="skeleton-bar w-60" />
      <div class="skeleton-bar w-30" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
    height?: number | string;
  }>(),
  { count: 5, height: 56 }
);
</script>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.skeleton-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  background: var(--bg-subtle, #f8fafc);
  border-radius: 8px;
}
.skeleton-bar {
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--bg-card, #e2e8f0) 0%,
    var(--bg-muted, #f1f5f9) 50%,
    var(--bg-card, #e2e8f0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.w-30 { width: 30%; }
.w-40 { width: 40%; }
.w-60 { width: 60%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-bar { animation: none; }
}
</style>
