<template>
  <div class="stage-detail">
    <div class="mkt-top">
      <button class="btn btn-ghost btn-sm" @click="router.back()">← Quay lại funnel</button>
      <div class="mtt">Khách ở giai đoạn {{ label }} ({{ totalCount }})</div>
    </div>

    <div v-if="loading" class="loading">Đang tải…</div>
    <div v-else-if="!contacts.length" class="empty">Không có KH ở giai đoạn này.</div>
    <table v-else class="contact-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>priorityScore</th>
          <th>Trạng thái</th>
          <th>Lần tương tác cuối</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in contacts" :key="c.id">
          <td>{{ c.crmName || c.fullName || '(no name)' }}</td>
          <td>{{ c.priorityScore ?? '—' }}</td>
          <td>{{ c.status }}</td>
          <td>{{ c.lastInteractionAt ? fmtDate(c.lastInteractionAt) : '—' }}</td>
          <td>
            <button class="btn btn-primary btn-sm" @click="open(c.id)">Mở</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/index';

interface Contact {
  id: string;
  crmName: string | null;
  fullName: string | null;
  status: string;
  priorityScore: number | null;
  lastInteractionAt: string | null;
  createdAt: string;
}

const route = useRoute();
const router = useRouter();
const stage = computed(() => String(route.params.stage ?? ''));

const contacts = ref<Contact[]>([]);
const label = ref('');
const totalCount = ref(0);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await api.get(`/reports/journey/${stage.value}`);
    contacts.value = res.data.contacts ?? [];
    label.value = res.data.label ?? stage.value;
    totalCount.value = res.data.totalCount ?? 0;
  } catch (e) {
    console.error('[JourneyStageDetail] load error', e);
  } finally {
    loading.value = false;
  }
});

function open(id: string) {
  router.push(`/contacts/${id}`);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}
</script>

<style scoped>
.stage-detail {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}
.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted, #64748b);
}
.mtt {
  font-size: 18px;
  font-weight: 700;
  margin: 12px 0;
}
.contact-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  font-size: 14px;
}
.contact-table th,
.contact-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.contact-table th {
  background: var(--bg-subtle, #f8fafc);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
}
</style>
