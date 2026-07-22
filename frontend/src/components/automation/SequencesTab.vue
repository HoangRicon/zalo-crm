<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- SequencesTab.vue - Tab quản lý Sequences -->
<template>
  <div class="seq-tab">
    <div class="seq-header">
      <h2 class="seq-title">🔄 Sequences (Drip Campaigns)</h2>
      <button class="btn-primary" @click="openCreate">+ Tạo sequence</button>
    </div>

    <p class="seq-desc">Drip campaigns tự động: gửi tin nhắn theo các bước có delay cho KH đã enroll.</p>

    <div v-if="loading" class="loading">⏳ Đang tải...</div>
    <div v-else-if="sequences.length === 0" class="empty">
      Chưa có sequence nào. Nhấn <strong>+ Tạo sequence</strong> để bắt đầu.
    </div>
    <table v-else class="seq-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>Mô tả</th>
          <th>Trạng thái</th>
          <th>Số bước</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sequences" :key="s.id">
          <td><strong>{{ s.name }}</strong></td>
          <td>{{ s.description || '—' }}</td>
          <td>
            <span :class="['status-pill', s.status]">{{ s.status === 'active' ? '✓ Active' : '⏸ Paused' }}</span>
          </td>
          <td>{{ s.steps?.length || 0 }}</td>
          <td>
            <button class="btn-secondary" @click="toggle(s)">{{ s.status === 'active' ? 'Pause' : 'Activate' }}</button>
            <button class="btn-secondary" @click="del(s)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { sequencesApi, type Sequence } from '@/api/sequences';

const router = useRouter();
const sequences = ref<Sequence[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    sequences.value = await sequencesApi.list();
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  router.push('/marketing/sequences');
}

async function toggle(s: Sequence) {
  try {
    if (s.status === 'active') {
      await sequencesApi.pause(s.id);
    } else {
      await sequencesApi.activate(s.id);
    }
    await load();
  } catch (e: any) {
    alert('Lỗi cập nhật');
  }
}

async function del(s: Sequence) {
  if (!confirm(`Xóa sequence "${s.name}"?`)) return;
  try {
    await sequencesApi.delete(s.id);
    await load();
  } catch (e: any) {
    alert('Lỗi xóa');
  }
}

onMounted(load);
</script>

<style scoped>
.seq-tab { display: flex; flex-direction: column; gap: 12px; }
.seq-header { display: flex; justify-content: space-between; align-items: center; }
.seq-title { font-size: 16px; font-weight: 700; margin: 0; }
.seq-desc { color: #64748b; font-size: 13px; margin: 0; }
.seq-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.seq-table th, .seq-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
.seq-table th { background: #f8fafc; font-weight: 600; }
.status-pill { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
.status-pill.active { background: #ecfdf5; color: #047857; }
.status-pill.paused { background: #fef3c7; color: #b45309; }
.empty, .loading { padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; }
.btn-primary { background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-secondary { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; margin-right: 4px; }
</style>