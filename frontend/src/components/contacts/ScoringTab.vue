<template>
  <div class="scoring-tab">
    <div v-if="loading" class="loading">Đang tải…</div>
    <div v-else class="scoring-content">
      <div class="scoring-hero">
        <div class="hero-score">
          <span class="hero-num">{{ median?.score ?? currentScore ?? 0 }}</span>
          <span class="hero-label">priorityScore</span>
        </div>
        <div class="hero-comparison">
          <p class="comparison">{{ median?.comparison ?? 'Đang tính…' }}</p>
        </div>
      </div>

      <div v-if="trendPoints.length" class="trend-chart">
        <h3>Xu hướng 30 ngày</h3>
        <canvas ref="trendCanvas" width="600" height="80"></canvas>
      </div>

      <div class="signals-list">
        <h3>Tín hiệu gần nhất ({{ signals.length }})</h3>
        <table v-if="signals.length" class="signals-table">
          <thead>
            <tr>
              <th>Tín hiệu</th>
              <th>Chiều</th>
              <th>Δ</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in signals" :key="i" :title="s.reason">
              <td>{{ s.signalKey }}</td>
              <td>{{ s.dimension }}</td>
              <td :class="s.delta > 0 ? 'delta-pos' : 'delta-neg'">
                {{ s.delta > 0 ? '+' : '' }}{{ s.delta }}
              </td>
              <td>{{ ago(s.timestamp) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">Chưa có tín hiệu nào.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{ contactId: string }>();

const loading = ref(true);
const currentScore = ref<number | null>(null);
const trendPoints = ref<Array<{ date: string; score: number }>>([]);
const signals = ref<Array<{ signalKey: string; dimension: string; delta: number; timestamp: string; reason: string }>>([]);
const median = ref<{ score: number; percentile: number; comparison: string; segment: string | null } | null>(null);

const trendCanvas = ref<HTMLCanvasElement | null>(null);

onMounted(async () => {
  try {
    const [trendRes, signalsRes, medianRes] = await Promise.all([
      api.get(`/contacts/${props.contactId}/scoring/trend?days=30`),
      api.get(`/contacts/${props.contactId}/scoring/signals?limit=10`),
      api.get(`/contacts/${props.contactId}/scoring/median`),
    ]);
    trendPoints.value = trendRes.data.points ?? [];
    currentScore.value = trendRes.data.currentScore ?? 0;
    signals.value = signalsRes.data.signals ?? [];
    median.value = medianRes.data ?? null;
    await nextTick();
    drawTrend();
  } catch (e) {
    console.error('[ScoringTab] load error', e);
  } finally {
    loading.value = false;
  }
});

import { nextTick } from 'vue';

function drawTrend(): void {
  const canvas = trendCanvas.value;
  if (!canvas || trendPoints.value.length === 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const points = trendPoints.value;
  const max = 100;
  const xStep = w / Math.max(1, points.length - 1);
  // Vẽ line
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = i * xStep;
    const y = h - (p.score / max) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // Fill dưới line
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fill();
}

function ago(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}
</script>

<style scoped>
.scoring-tab {
  padding: 16px;
}
.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-muted, #64748b);
}
.scoring-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f0fdf4, #ecfeff);
  border-radius: 10px;
  margin-bottom: 16px;
}
.hero-score {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.hero-num {
  font-size: 36px;
  font-weight: 700;
  color: #047857;
}
.hero-label {
  font-size: 13px;
  color: var(--text-muted, #64748b);
}
.hero-comparison {
  margin-left: auto;
  font-size: 14px;
  font-weight: 500;
}
.trend-chart {
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  margin-bottom: 16px;
}
.trend-chart h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.signals-list h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.signals-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.signals-table th,
.signals-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.signals-table th {
  background: var(--bg-subtle, #f8fafc);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
}
.delta-pos {
  color: #047857;
  font-weight: 600;
}
.delta-neg {
  color: #b91c1c;
  font-weight: 600;
}
.empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted, #64748b);
}
</style>
