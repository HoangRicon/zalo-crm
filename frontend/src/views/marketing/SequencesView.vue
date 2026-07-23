<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- SequencesView.vue - Sequences Builder UI -->
<template>
  <div class="sv-view">
    <header class="sv-header">
      <div>
        <h1 class="sv-title">🔄 Sequences</h1>
        <p class="sv-sub">Drip campaigns tự động cho KH đã enroll</p>
      </div>
      <div class="sv-actions">
        <button class="btn-secondary" @click="goBack">← Quay lại Automation Hub</button>
        <button class="btn-primary" @click="newSequence">+ Sequence mới</button>
      </div>
    </header>

    <div v-if="loading" class="loading">⏳ Đang tải...</div>
    <div v-else-if="!current" class="empty">
      <p>Chưa có sequence nào. Nhấn <strong>+ Sequence mới</strong> để tạo.</p>
    </div>
    <div v-else class="sv-body">
      <!-- Left: List -->
      <aside class="sv-sidebar">
        <div
          v-for="s in sequences"
          :key="s.id"
          class="sv-item"
          :class="{ active: current?.id === s.id }"
          @click="select(s)"
        >
          <div class="sv-item-name">{{ s.name }}</div>
          <div class="sv-item-meta">{{ s.steps?.length || 0 }} bước · {{ s.status }}</div>
        </div>
      </aside>

      <!-- Right: Editor -->
      <main class="sv-main">
        <div class="sv-field">
          <label>Tên sequence</label>
          <input v-model="form.name" placeholder="VD: Chăm sóc sau mua" />
        </div>
        <div class="sv-field">
          <label>Mô tả</label>
          <input v-model="form.description" placeholder="Mô tả ngắn về sequence" />
        </div>

        <h3 class="sv-section">Các bước</h3>
        <div v-for="(step, idx) in form.steps" :key="idx" class="sv-step">
          <div class="sv-step-header">
            <span class="sv-step-num">Step {{ idx + 1 }}</span>
            <button class="btn-danger-small" @click="form.steps.splice(idx, 1)">Xóa</button>
          </div>
          <div class="sv-step-row">
            <div class="sv-field">
              <label>Delay (phút)</label>
              <input type="number" v-model.number="step.delayMinutes" min="0" />
            </div>
            <div class="sv-field">
              <label>Block ID (UUID)</label>
              <input v-model="step.blockId" placeholder="UUID của content block" />
            </div>
          </div>
        </div>
        <button class="btn-secondary" @click="addStep">+ Thêm bước</button>

        <div class="sv-actions-bottom">
          <button class="btn-secondary" @click="del" v-if="form.id">Xóa sequence</button>
          <button class="btn-secondary" @click="toggle" v-if="form.id">
            {{ form.status === 'active' ? '⏸ Pause' : '▶ Activate' }}
          </button>
          <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? '⏳ Đang lưu...' : '💾 Lưu' }}</button>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { sequencesApi, type Sequence, type SequenceStep } from '@/api/sequences';

const router = useRouter();
const sequences = ref<Sequence[]>([]);
const current = ref<Sequence | null>(null);
const loading = ref(true);
const saving = ref(false);

const form = ref<{
  id?: string;
  name: string;
  description: string;
  status: 'active' | 'paused';
  steps: SequenceStep[];
}>({
  name: '',
  description: '',
  status: 'paused',
  steps: [],
});

async function load() {
  loading.value = true;
  try {
    sequences.value = await sequencesApi.list();
    if (sequences.value.length > 0) {
      select(sequences.value[0]);
    }
  } finally {
    loading.value = false;
  }
}

function select(s: Sequence) {
  current.value = s;
  form.value = {
    id: s.id,
    name: s.name,
    description: s.description || '',
    status: s.status,
    steps: JSON.parse(JSON.stringify(s.steps || [])),
  };
}

function newSequence() {
  current.value = null;
  form.value = { name: '', description: '', status: 'paused', steps: [] };
}

function addStep() {
  form.value.steps.push({
    stepOrder: form.value.steps.length,
    blockId: null,
    delayMinutes: 0,
    jitterMinutes: 0,
  });
}

async function save() {
  if (!form.value.name?.trim()) {
    alert('Tên sequence là bắt buộc');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      steps: form.value.steps,
      status: form.value.status,
    };
    if (form.value.id) {
      await sequencesApi.update(form.value.id, payload);
    } else {
      await sequencesApi.create(payload);
    }
    await load();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Lỗi lưu');
  } finally {
    saving.value = false;
  }
}

async function toggle() {
  if (!form.value.id) return;
  try {
    if (form.value.status === 'active') {
      await sequencesApi.pause(form.value.id);
    } else {
      await sequencesApi.activate(form.value.id);
    }
    await load();
  } catch (e: any) {
    alert('Lỗi cập nhật');
  }
}

async function del() {
  if (!form.value.id) return;
  if (!confirm(`Xóa sequence "${form.value.name}"?`)) return;
  try {
    await sequencesApi.delete(form.value.id);
    newSequence();
    await load();
  } catch (e: any) {
    alert('Lỗi xóa');
  }
}

function goBack() {
  router.push('/marketing');
}

onMounted(load);
</script>

<style scoped>
.sv-view { display: flex; flex-direction: column; height: 100%; padding: 20px; }
.sv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-shrink: 0; }
.sv-title { font-size: 22px; font-weight: 700; margin: 0; }
.sv-sub { color: #64748b; font-size: 13px; margin: 0; }
.sv-actions { display: flex; gap: 8px; }
.sv-body { display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
.sv-sidebar { display: flex; flex-direction: column; gap: 4px; }
.sv-item { padding: 10px 12px; border-radius: 6px; cursor: pointer; border: 1px solid #e2e8f0; background: #fff; }
.sv-item:hover { background: #f8fafc; }
.sv-item.active { background: #eff6ff; border-color: #2563eb; }
.sv-item-name { font-weight: 600; font-size: 13px; }
.sv-item-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
.sv-main { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
.sv-field { margin-bottom: 12px; }
.sv-field label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
.sv-field input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
.sv-section { font-size: 14px; font-weight: 700; margin: 16px 0 8px; }
.sv-step { background: #f8fafc; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.sv-step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sv-step-num { font-size: 13px; font-weight: 600; }
.sv-step-row { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
.sv-actions-bottom { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
.empty, .loading { padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; }
.btn-primary { background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-secondary { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-danger-small { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
</style>