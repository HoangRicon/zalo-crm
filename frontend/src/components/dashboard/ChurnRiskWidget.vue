<template>
  <div class="churn-widget">
    <div class="churn-header">
      <h3>🚨 Top KH có nguy cơ rời bỏ</h3>
      <span class="churn-sub">{{ rows.length }} high-risk trong 24h qua</span>
    </div>
    <div v-if="loading" class="churn-loading">Đang tải…</div>
    <div v-else-if="!rows.length" class="churn-empty">
      <v-icon size="32">mdi-check-decagram</v-icon>
      <p>Không có KH high-risk trong 24h qua. Tốt!</p>
    </div>
    <div v-else class="churn-list">
      <div
        v-for="row in rows"
        :key="row.contactId"
        class="churn-row"
        @click="openContact(row.contactId)"
      >
        <div class="churn-row-main">
          <strong>{{ row.contactName }}</strong>
          <span v-if="row.daysSinceLastInteraction != null" class="churn-meta">
            {{ row.daysSinceLastInteraction }} ngày không tương tác
          </span>
        </div>
        <div class="churn-reasons">
          <span v-for="(r, i) in row.reasons.slice(0, 2)" :key="i" class="reason-chip">{{ r }}</span>
        </div>
        <div v-if="row.suggestedAction" class="churn-action">
          💡 {{ row.suggestedAction }}
        </div>
        <span class="churn-age">{{ relativeAge(row.scoredAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/index';

interface ChurnRow {
  contactId: string;
  contactName: string | null;
  riskLevel: string;
  reasons: string[];
  suggestedAction: string | null;
  source: string;
  scoredAt: string;
  daysSinceLastInteraction: number | null;
}

const rows = ref<ChurnRow[]>([]);
const loading = ref(true);
const router = useRouter();

onMounted(async () => {
  try {
    const res = await api.get('/api/v1/churn/top', { params: { limit: 10 } });
    rows.value = res.data.rows ?? [];
  } catch (e) {
    console.error('[ChurnRiskWidget] load error', e);
  } finally {
    loading.value = false;
  }
});

function openContact(contactId: string) {
  router.push(`/contacts/${contactId}`);
}

function relativeAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}
</script>

<style scoped>
.churn-widget {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-surface, #fff);
}
.churn-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.churn-header h3 {
  margin: 0;
  font-size: 16px;
}
.churn-sub {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}
.churn-loading,
.churn-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted, #64748b);
}
.churn-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.churn-row {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
}
.churn-row:hover {
  background: #fee2e2;
}
.churn-row-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.churn-meta {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}
.churn-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
.reason-chip {
  background: white;
  color: #b91c1c;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid #fca5a5;
}
.churn-action {
  font-size: 12px;
  color: #7c2d12;
}
.churn-age {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
}
</style>
