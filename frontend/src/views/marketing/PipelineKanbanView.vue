<template>
  <div class="pipeline-view">
    <div class="mkt-top">
      <div>
        <div class="mtt">📋 Sales Pipeline</div>
        <div class="mts">Kéo thẻ KH qua các cột để update trạng thái. Refresh page giữ nguyên.</div>
      </div>
    </div>

    <div class="filters">
      <select v-model="filterOwner" class="f-select" @change="loadAll">
        <option value="">Tất cả owner</option>
        <option v-for="o in owners" :key="o.id" :value="o.id">{{ o.fullName || o.email }}</option>
      </select>
      <input v-model.number="filterMinScore" type="number" placeholder="Score min" class="f-input" @change="loadAll" />
      <input v-model.number="filterMaxScore" type="number" placeholder="Score max" class="f-input" @change="loadAll" />
    </div>

    <div v-if="loading" class="loading">Đang tải…</div>
    <div v-else class="kanban">
      <div
        v-for="col in COLUMNS"
        :key="col.key"
        class="kanban-col"
        @dragover.prevent
        @drop="onDrop($event, col.key)"
      >
        <div class="col-header">
          <span class="col-label">{{ col.label }}</span>
          <span class="col-count">{{ (byStatus[col.key] ?? []).length }}</span>
        </div>
        <div
          v-for="c in byStatus[col.key] ?? []"
          :key="c.id"
          class="kanban-card"
          draggable="true"
          @dragstart="onDragStart($event, c.id)"
          @click="open(c.id)"
        >
          <div class="card-name">{{ c.crmName || c.fullName || '(no name)' }}</div>
          <div class="card-meta">
            <span class="card-score">⭐ {{ c.priorityScore ?? 0 }}</span>
            <span v-if="c.lastInteractionDays != null" class="card-days">
              {{ c.lastInteractionDays }}d
            </span>
          </div>
          <div v-if="c.ownerName" class="card-owner">{{ c.ownerName }}</div>
        </div>
        <div v-if="!(byStatus[col.key] ?? []).length" class="col-empty">—</div>
      </div>
    </div>

    <div v-if="error" class="error-toast">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/index';
import { useToast } from '@/composables/use-toast';

interface CardContact {
  id: string;
  crmName: string | null;
  fullName: string | null;
  status: string;
  priorityScore: number | null;
  lastInteractionAt: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  lastInteractionDays: number | null;
}

interface Owner {
  id: string;
  fullName: string | null;
  email: string;
}

// Mapping 6 cột FE → Contact.status enum
const COLUMNS = [
  { key: 'new', label: '🆕 Mới' },
  { key: 'nurturing', label: '🌱 Đang nuôi' },
  { key: 'interested', label: '👀 Quan tâm' },
  { key: 'appointment_scheduled', label: '📅 Lên lịch' },
  { key: 'closed_won', label: '✅ Chốt' },
  { key: 'post_sale', label: '🤝 Chăm sóc sau' },
];

const contacts = ref<CardContact[]>([]);
const owners = ref<Owner[]>([]);
const loading = ref(true);
const filterOwner = ref('');
const filterMinScore = ref<number | null>(null);
const filterMaxScore = ref<number | null>(null);
const dragId = ref<string | null>(null);
const error = ref('');
const router = useRouter();
const { push: toast } = useToast();

const byStatus = computed(() => {
  const map: Record<string, CardContact[]> = {};
  for (const col of COLUMNS) map[col.key] = [];
  for (const c of contacts.value) {
    if (!map[c.status]) map[c.status] = [];
    map[c.status].push(c);
  }
  return map;
});

async function loadAll(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const params: Record<string, string | number> = { limit: 500 };
    if (filterOwner.value) params.ownerUserId = filterOwner.value;
    if (filterMinScore.value != null && filterMinScore.value > 0) params.minScore = filterMinScore.value;
    if (filterMaxScore.value != null && filterMaxScore.value > 0) params.maxScore = filterMaxScore.value;
    const res = await api.get('/api/v1/contacts', { params });
    const list = (res.data.contacts ?? res.data ?? []) as Array<Record<string, unknown>>;
    const now = Date.now();
    contacts.value = list.map((c) => {
      const lastAt = c.lastInteractionAt ? new Date(String(c.lastInteractionAt)).getTime() : 0;
      return {
        id: String(c.id),
        crmName: (c.crmName as string) ?? null,
        fullName: (c.fullName as string) ?? null,
        status: String(c.status ?? 'new'),
        priorityScore: (c.priorityScore as number) ?? null,
        lastInteractionAt: (c.lastInteractionAt as string) ?? null,
        ownerUserId: (c.ownerUserId as string) ?? null,
        ownerName: ((c.owner as Record<string, unknown> | null)?.fullName as string) ?? null,
        lastInteractionDays: lastAt > 0 ? Math.floor((now - lastAt) / 86400000) : null,
      };
    });
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? 'Lỗi tải';
  } finally {
    loading.value = false;
  }
}

async function loadOwners(): Promise<void> {
  try {
    // Optional: load org users. Reuse /me/org-users or simple list
    const res = await api.get('/api/v1/org/users', { params: { limit: 100 } }).catch(() => ({ data: { users: [] } }));
    owners.value = (res.data.users ?? res.data ?? []) as Owner[];
  } catch { /* silent */ }
}

function onDragStart(e: DragEvent, id: string) {
  dragId.value = id;
  e.dataTransfer?.setData('text/plain', id);
}

async function onDrop(e: DragEvent, targetStatus: string) {
  e.preventDefault();
  const id = dragId.value ?? e.dataTransfer?.getData('text/plain');
  if (!id) return;
  dragId.value = null;
  const card = contacts.value.find((c) => c.id === id);
  if (!card || card.status === targetStatus) return;
  const oldStatus = card.status;
  card.status = targetStatus; // optimistic
  try {
    await api.patch(`/api/v1/contacts/${id}`, { status: targetStatus });
    toast(`Đã chuyển sang "${COLUMNS.find((c) => c.key === targetStatus)?.label}"`, 'success');
  } catch (err: any) {
    card.status = oldStatus; // rollback
    toast(`Không cập nhật được: ${err?.response?.data?.error ?? 'lỗi'}`, 'error');
  }
}

function open(id: string) {
  router.push(`/contacts/${id}`);
}

onMounted(async () => {
  await Promise.all([loadAll(), loadOwners()]);
});
</script>

<style scoped>
.pipeline-view {
  padding: 20px;
}
.loading {
  text-align: center;
  padding: 40px;
}
.mtt {
  font-size: 20px;
  font-weight: 700;
}
.mts {
  color: var(--text-muted, #64748b);
  font-size: 13px;
  margin-bottom: 12px;
}
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.f-select,
.f-input {
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
}
.f-input {
  width: 100px;
}
.kanban {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  overflow-x: auto;
}
.kanban-col {
  background: var(--bg-subtle, #f8fafc);
  border-radius: 8px;
  padding: 8px;
  min-height: 60vh;
}
.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 4px;
}
.col-label {
  font-weight: 600;
  font-size: 13px;
}
.col-count {
  background: white;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
}
.kanban-card {
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 6px;
  cursor: grab;
  transition: box-shadow 0.15s;
}
.kanban-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.kanban-card:active {
  cursor: grabbing;
  opacity: 0.6;
}
.card-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}
.card-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #64748b);
  margin-bottom: 2px;
}
.card-score {
  color: #d97706;
  font-weight: 600;
}
.card-owner {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}
.col-empty {
  text-align: center;
  color: var(--text-muted, #94a3b8);
  font-size: 11px;
  padding: 8px;
}
.error-toast {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: #fee2e2;
  color: #b91c1c;
  padding: 8px 12px;
  border-radius: 6px;
  z-index: 100;
}
</style>
