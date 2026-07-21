<template>
  <div class="heatmap-widget">
    <div class="heatmap-header">
      <h3>🔥 Heatmap giờ gửi</h3>
      <span class="heatmap-sub">{{ days }} ngày qua · {{ totalBroadcasts }} lượt gửi</span>
    </div>

    <div v-if="!loaded" class="heatmap-loading">Đang tải heatmap…</div>

    <div v-else-if="totalBroadcasts < 5" class="heatmap-empty">
      <p>Chưa đủ dữ liệu để gợi ý khung giờ. Cần ≥5 broadcasts.</p>
      <a href="/marketing/broadcasts">Cấu hình giờ gửi thủ công →</a>
    </div>

    <div v-else class="heatmap-body">
      <div class="heatmap-grid" :style="gridStyle">
        <div v-for="d in 7" :key="`hdr-${d}`" class="heatmap-row-hdr">{{ dayLabel(d - 1) }}</div>
        <template v-for="d in 7" :key="`row-${d}`">
          <template v-for="h in 24" :key="`cell-${d}-${h}`">
            <div
              class="heatmap-cell"
              :title="cellTooltip(d - 1, h - 1)"
              :style="cellStyle(d - 1, h - 1)"
            ></div>
          </template>
        </template>
      </div>

      <div v-if="suggestions.length" class="heatmap-suggestions">
        <span class="lbl">🎯 Gợi ý gửi:</span>
        <span v-for="(s, i) in suggestions" :key="i" class="chip" :title="s.detail">
          {{ s.label }} ({{ Math.round(s.rate * 100) }}%)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/index';

const props = withDefaults(defineProps<{ days?: number }>(), { days: 30 });

const loaded = ref(false);
const totalBroadcasts = ref(0);
const matrix = ref<Array<{ hour: number; dayOfWeek: number; rate: number; count: number; avgReplyMs: number }>>([]);

onMounted(async () => {
  try {
    const res = await api.get(`/api/v1/broadcast/heatmap?days=${props.days}`);
    matrix.value = res.data.matrix ?? [];
    totalBroadcasts.value = res.data.totalBroadcasts ?? 0;
  } catch (e) {
    console.error('[HeatmapWidget] load error', e);
  } finally {
    loaded.value = true;
  }
});

const dayLabel = (d: number): string => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d] ?? '';

const gridStyle = computed(() => ({
  gridTemplateColumns: `60px repeat(24, 1fr)`,
  gridTemplateRows: `repeat(7, 1fr)`,
}));

const cellRate = (d: number, h: number): number =>
  matrix.value.find((c) => c.dayOfWeek === d && c.hour === h)?.rate ?? 0;

const cellCount = (d: number, h: number): number =>
  matrix.value.find((c) => c.dayOfWeek === d && c.hour === h)?.count ?? 0;

const cellAvgReplyMin = (d: number, h: number): number => {
  const ms = matrix.value.find((c) => c.dayOfWeek === d && c.hour === h)?.avgReplyMs ?? 0;
  return Math.round(ms / 60000);
};

const cellStyle = (d: number, h: number) => {
  const rate = cellRate(d, h);
  // 0% = red, 10% = yellow, 20%+ = green
  let bg = '#fef2f2';
  if (rate >= 0.2) bg = '#bbf7d0';
  else if (rate >= 0.1) bg = '#fde68a';
  else if (rate > 0) bg = '#fecaca';
  return { background: bg };
};

const cellTooltip = (d: number, h: number): string => {
  const rate = cellRate(d, h);
  const cnt = cellCount(d, h);
  const avgMin = cellAvgReplyMin(d, h);
  return `${dayLabel(d)} ${h}h: ${(rate * 100).toFixed(1)}% reply (${cnt} broadcasts, avg reply ${avgMin} phút)`;
};

// Top-3 suggestions: best rate, min 3 samples
const suggestions = computed(() => {
  const valid = matrix.value.filter((c) => c.count >= 3);
  if (!valid.length) return [];
  return [...valid]
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map((c) => ({
      label: `${dayLabel(c.dayOfWeek)} ${c.hour}h`,
      rate: c.rate,
      detail: cellTooltip(c.dayOfWeek, c.hour),
    }));
});
</script>

<style scoped>
.heatmap-widget {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-surface, #fff);
}
.heatmap-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.heatmap-header h3 {
  margin: 0;
  font-size: 16px;
}
.heatmap-sub {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}
.heatmap-loading,
.heatmap-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted, #64748b);
}
.heatmap-grid {
  display: grid;
  gap: 2px;
  margin-bottom: 12px;
}
.heatmap-row-hdr {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  align-self: center;
}
.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  cursor: help;
}
.heatmap-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 13px;
}
.heatmap-suggestions .lbl {
  color: var(--text-muted, #64748b);
}
.heatmap-suggestions .chip {
  background: var(--accent-bg, #ecfdf5);
  color: var(--accent-text, #047857);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  cursor: help;
}
</style>
