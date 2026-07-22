<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- TriggersTab.vue - Quản lý Triggers (event-based). CRUD cơ bản cho Community. -->
<template>
  <div class="trg-tab">
    <header class="trg-head">
      <div>
        <h2 class="trg-title">⚡ Triggers</h2>
        <p class="trg-desc">
          Trigger là rule <b>event → hành động</b> — khi có sự kiện (kết bạn, tin nhắn đến, nhận lead…)
          thì tự động chạy 1 Sequence / Content Block / Broadcast.
        </p>
      </div>
      <button class="btn btn-primary" :disabled="loading || saving" @click="openCreate">
        <v-icon size="16">mdi-plus-circle-outline</v-icon> Tạo trigger
      </button>
    </header>

    <div v-if="loading" class="trg-empty">Đang tải…</div>
    <div v-else-if="!triggers.length" class="trg-empty">
      <v-icon size="40" color="primary">mdi-flash-outline</v-icon>
      <p>Chưa có trigger nào. Bấm <b>Tạo trigger</b> để bắt đầu.</p>
      <small>Có 7 loại event: kết bạn, tin nhắn đến, lead mới, gắn tag, lịch cron, manual…</small>
    </div>

    <table v-else class="trg-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>Sự kiện</th>
          <th>Hành động</th>
          <th>Trạng thái</th>
          <th>Cập nhật</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in triggers" :key="t.id">
          <td>
            <div class="trg-name">
              <b>{{ t.name }}</b>
              <span class="trg-cat">{{ t.category }}</span>
            </div>
          </td>
          <td><code class="trg-event">{{ eventLabel(t.eventType) }}</code></td>
          <td>
            <span class="trg-binding">
              <v-icon size="14">{{ bindingIcon(t.bindingKind) }}</v-icon>
              {{ bindingLabel(t.bindingKind) }}
            </span>
          </td>
          <td>
            <span class="trg-pill" :class="{ 'is-on': t.enabled }">
              {{ t.enabled ? 'Đang bật' : 'Đã tắt' }} · {{ t.state }}
            </span>
          </td>
          <td class="trg-time">{{ formatDate(t.updatedAt) }}</td>
          <td class="trg-actions">
            <button class="btn btn-ghost btn-sm" :title="t.enabled ? 'Tắt' : 'Bật'" @click="onToggle(t)">
              <v-icon size="14">{{ t.enabled ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline' }}</v-icon>
            </button>
            <button class="btn btn-ghost btn-sm" title="Sửa" @click="openEdit(t)">
              <v-icon size="14">mdi-pencil-outline</v-icon>
            </button>
            <button class="btn btn-ghost btn-sm danger" title="Xoá" @click="onDelete(t)">
              <v-icon size="14">mdi-trash-can-outline</v-icon>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Modal tạo / sửa -->
    <div v-if="showForm" class="trg-overlay" @click.self="showForm = false">
      <div class="trg-modal">
        <div class="trg-modal-head">
          <b>{{ editing ? 'Sửa trigger' : 'Tạo trigger' }}</b>
          <button class="btn-x" @click="showForm = false"><v-icon size="18">mdi-close</v-icon></button>
        </div>

        <label class="f-label">Tên trigger</label>
        <input v-model="form.name" class="f-input" placeholder="VD: Chào khách mới khi bạn mới" />

        <div class="grid-2">
          <div>
            <label class="f-label">Loại sự kiện</label>
            <select v-model="form.eventType" class="f-input">
              <option v-for="e in EVENT_TYPES" :key="e.value" :value="e.value">{{ e.label }}</option>
            </select>
          </div>
          <div>
            <label class="f-label">Danh mục</label>
            <input v-model="form.category" class="f-input" placeholder="general / keyword / livechat…" />
          </div>
        </div>

        <label class="f-label">Khi event xảy ra thì chạy</label>
        <div class="binding-grid">
          <label v-for="b in BINDING_KINDS" :key="b.value" class="binding-card" :class="{ active: form.bindingKind === b.value }">
            <input v-model="form.bindingKind" type="radio" :value="b.value" />
            <span>{{ b.label }}</span>
          </label>
        </div>

        <div v-if="form.bindingKind === 'sequence'" class="grid-2">
          <div>
            <label class="f-label">Sequence ID</label>
            <input v-model="form.sequenceId" class="f-input" placeholder="UUID của sequence" />
          </div>
          <div>
            <label class="f-label">Ghi chú</label>
            <input class="f-input" :value="`'Sequence' = kịch bản nhiều bước`" readonly />
          </div>
        </div>
        <div v-else>
          <label class="f-label">{{ form.bindingKind === 'block' ? 'Content Block ID' : 'Broadcast ID' }}</label>
          <input v-model="form.targetId" class="f-input" :placeholder="form.bindingKind === 'block' ? 'UUID khối nội dung' : 'UUID broadcast'" />
        </div>

        <label class="f-check">
          <input v-model="form.enabled" type="checkbox" />
          Kích hoạt ngay khi lưu
        </label>

        <div class="trg-modal-foot">
          <button class="btn btn-ghost btn-sm" :disabled="saving" @click="showForm = false">Huỷ</button>
          <button class="btn btn-primary btn-sm" :disabled="saving || !canSave" @click="onSave">
            {{ saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo trigger' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  BINDING_KINDS,
  EVENT_TYPES,
  type TriggerRow,
  create as apiCreate,
  list as apiList,
  remove as apiRemove,
  toggle as apiToggle,
  update as apiUpdate,
} from '@/api/triggers';
import { useToast } from '@/composables/use-toast';
import { useConfirm } from '@/composables/use-confirm';

const { push: toast } = useToast();
const { confirm } = useConfirm();

const triggers = ref<TriggerRow[]>([]);
const loading = ref(true);
const saving = ref(false);
const showForm = ref(false);
const editing = ref<TriggerRow | null>(null);

const form = reactive({
  name: '',
  category: 'general',
  eventType: 'friend_accepted',
  bindingKind: 'sequence' as 'sequence' | 'block' | 'broadcast',
  sequenceId: '',
  targetId: '',
  enabled: true,
});

const canSave = computed(() =>
  form.name.trim().length > 0
  && form.eventType.length > 0
  && !!form.bindingKind
  && (form.bindingKind !== 'sequence' ? form.targetId.trim().length > 0 : true),
);

function eventLabel(v: string): string {
  return EVENT_TYPES.find((e) => e.value === v)?.label ?? v;
}
function bindingLabel(v: string): string {
  return BINDING_KINDS.find((b) => b.value === v)?.label ?? v;
}
function bindingIcon(v: string): string {
  return v === 'sequence' ? 'mdi-pulse' : v === 'block' ? 'mdi-view-grid-plus-outline' : 'mdi-bullhorn-outline';
}
function formatDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    triggers.value = await apiList();
  } catch (e: any) {
    toast(`Lỗi: ${e?.response?.data?.error ?? e?.message ?? 'không tải được'}`, 'error');
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  Object.assign(form, {
    name: '',
    category: 'general',
    eventType: 'friend_accepted',
    bindingKind: 'sequence',
    sequenceId: '',
    targetId: '',
    enabled: true,
  });
  showForm.value = true;
}

function openEdit(t: TriggerRow): void {
  editing.value = t;
  Object.assign(form, {
    name: t.name,
    category: t.category,
    eventType: t.eventType,
    bindingKind: t.bindingKind,
    sequenceId: t.sequenceId ?? '',
    targetId: (t.bindingKind === 'block' ? t.blockId : t.broadcastId) ?? '',
    enabled: t.enabled,
  });
  showForm.value = true;
}

async function onSave(): Promise<void> {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const body = {
      name: form.name,
      category: form.category,
      eventType: form.eventType,
      bindingKind: form.bindingKind,
      sequenceId: form.bindingKind === 'sequence' ? form.sequenceId || null : null,
      blockId: form.bindingKind === 'block' ? form.targetId || null : null,
      broadcastId: form.bindingKind === 'broadcast' ? form.targetId || null : null,
      enabled: form.enabled,
    };
    if (editing.value) await apiUpdate(editing.value.id, body);
    else await apiCreate(body);
    toast(editing.value ? 'Đã lưu thay đổi' : 'Đã tạo trigger', 'success');
    showForm.value = false;
    await load();
  } catch (e: any) {
    toast(`Lỗi: ${e?.response?.data?.error ?? e?.message ?? 'không lưu được'}`, 'error');
  } finally {
    saving.value = false;
  }
}

async function onToggle(t: TriggerRow): Promise<void> {
  try {
    await apiToggle(t.id);
    toast(t.enabled ? 'Đã tắt trigger' : 'Đã bật trigger', 'success');
    await load();
  } catch (e: any) {
    toast(`Lỗi: ${e?.response?.data?.error ?? e?.message ?? 'không toggle được'}`, 'error');
  }
}

async function onDelete(t: TriggerRow): Promise<void> {
  if (!(await confirm({
    title: 'Xoá trigger?',
    message: `Xoá "${t.name}". Không thể hoàn tác.`,
    confirmText: 'Xoá',
    tone: 'danger',
  }))) return;
  try {
    await apiRemove(t.id);
    toast('Đã xoá', 'success');
    await load();
  } catch (e: any) {
    toast(`Lỗi: ${e?.response?.data?.error ?? e?.message ?? 'không xoá được'}`, 'error');
  }
}

onMounted(load);
</script>

<style scoped>
.trg-tab { display: flex; flex-direction: column; gap: 14px; }
.trg-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.trg-title { font-size: 18px; font-weight: 700; margin: 0; }
.trg-desc { color: #64748b; font-size: 13px; margin: 4px 0 0; max-width: 720px; }
.trg-empty { padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; }
.trg-empty small { display: block; margin-top: 6px; color: #94a3b8; }
.trg-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--border, #e5e4e7); border-radius: 8px; overflow: hidden; }
.trg-table th, .trg-table td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid var(--border, #f0f0f3); }
.trg-table th { background: #fafbfc; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.trg-table tr:last-child td { border-bottom: none; }
.trg-name { display: flex; flex-direction: column; gap: 2px; }
.trg-name b { font-weight: 700; }
.trg-cat { font-size: 11px; color: #94a3b8; }
.trg-event { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11.5px; color: #475569; }
.trg-binding { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #334155; }
.trg-pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #64748b; }
.trg-pill.is-on { background: #dcfce7; color: #166534; }
.trg-time { font-size: 12px; color: #64748b; }
.trg-actions { text-align: right; white-space: nowrap; }
.trg-actions .btn + .btn { margin-left: 4px; }
.danger { color: #a12318; }

.trg-overlay { position: fixed; inset: 0; background: rgba(20, 20, 30, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.trg-modal { background: #fff; border-radius: 12px; padding: 18px 20px; width: 620px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow: auto; }
.trg-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; }
.btn-x { background: none; border: none; cursor: pointer; padding: 2px; }
.trg-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.f-label { display: block; font-size: 12.5px; font-weight: 600; margin: 10px 0 4px; }
.f-input { width: 100%; border: 1px solid var(--border, #d5d4d8); border-radius: 8px; padding: 7px 10px; font-size: 13.5px; background: #fff; color: inherit; box-sizing: border-box; }
.f-check { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.binding-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
.binding-card { display: flex; align-items: center; gap: 6px; padding: 10px; border: 1px solid var(--border, #d5d4d8); border-radius: 8px; cursor: pointer; font-size: 13px; }
.binding-card.active { border-color: #0e445a; background: rgba(14,68,90,.06); font-weight: 600; }
.binding-card input { margin: 0; }

@media (max-width: 640px) {
  .grid-2, .binding-grid { grid-template-columns: 1fr; }
}
</style>
