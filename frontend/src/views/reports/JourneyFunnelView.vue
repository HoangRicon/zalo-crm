<template>
  <div class="journey-view">
    <div class="mkt-top">
      <div>
        <div class="mtt">📊 Customer Journey Funnel</div>
        <div class="mts">
          Phễu chuyển đổi KH qua 6 giai đoạn ({{ days }} ngày qua).
          {{ totalContacts }} KH bắt đầu.
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Đang tải…</div>
    <div v-else class="funnel">
      <div
        v-for="(stage, i) in stages"
        :key="stage.stage"
        class="funnel-stage"
        :class="{ 'is-drop-off': stage.dropOff > 0 && stage.dropOff === maxDropoff }"
        :style="{ '--width': widthPct(stage.count) }"
        @click="goToStage(stage.stage)"
      >
        <div class="stage-header">
          <span class="stage-num">{{ i + 1 }}</span>
          <span class="stage-name">{{ stage.label }}</span>
          <span class="stage-count">{{ stage.count }}</span>
        </div>
        <div class="stage-bar">
          <div class="stage-fill" :style="{ width: widthPct(stage.count) + '%' }"></div>
        </div>
        <div class="stage-meta">
          <span v-if="i > 0" class="conversion">→ {{ Math.round(stage.conversionRate * 100) }}% của stage trước</span>
          <span v-if="stage.dropOff > 0" class="drop-off">🔥 -{{ stage.dropOff }} rời</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/index';

interface Stage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number;
  avgDurationMs: number;
  dropOff: number;
}

const props = withDefaults(defineProps<{ days?: number }>(), { days: 90 });

const stages = ref<Stage[]>([]);
const totalContacts = ref(0);
const loading = ref(true);
const router = useRouter();

const maxDropoff = computed(() =>
  stages.value.reduce((max, s) => (s.dropOff > max ? s.dropOff : max), 0),
);

onMounted(async () => {
  try {
    const res = await api.get(`/api/v1/reports/journey?days=${props.days}`);
    stages.value = res.data.stages ?? [];
    totalContacts.value = res.data.totalContacts ?? 0;
  } catch (e) {
    console.error('[JourneyFunnelView] load error', e);
  } finally {
    loading.value = false;
  }
});

function widthPct(count: number): number {
  if (!stages.value.length) return 0;
  const max = Math.max(1, stages.value[0].count);
  return Math.max(8, Math.round((count / max) * 100));
}

function goToStage(stage: string) {
  router.push(`/reports/journey/${stage}`);
}
</script>

<style scoped>
.journey-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.loading {
  text-align: center;
  padding: 40px;
}
.mkt-top {
  margin-bottom: 16px;
}
.mtt {
  font-size: 20px;
  font-weight: 700;
}
.mts {
  color: var(--text-muted, #64748b);
  font-size: 13px;
}
.funnel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.funnel-stage {
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-left: 4px solid #94a3b8;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.funnel-stage:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.funnel-stage.is-drop-off {
  border-left-color: #ef4444;
  background: #fef2f2;
}
.stage-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.stage-num {
  display: inline-block;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  border-radius: 50%;
  background: #f1f5f9;
  font-weight: 700;
  font-size: 13px;
}
.stage-name {
  font-weight: 600;
  flex: 1;
}
.stage-count {
  font-size: 18px;
  font-weight: 700;
  color: #047857;
}
.stage-bar {
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}
.stage-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  transition: width 0.3s;
}
.stage-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}
.conversion {
  color: #047857;
}
.drop-off {
  color: #b91c1c;
  font-weight: 600;
}
</style>
