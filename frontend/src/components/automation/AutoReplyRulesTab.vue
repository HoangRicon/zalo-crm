<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Zalo CRM Team -->
<!-- AutoReplyRulesTab.vue - Tab quản lý Auto Reply Rules -->
<template>
  <div class="arr-tab">
    <div class="arr-header">
      <h2 class="arr-title">🤖 Auto Reply Rules</h2>
      <button class="btn-primary" @click="openCreate">+ Tạo rule mới</button>
    </div>

    <p class="arr-desc">Rule-based auto-reply: khi KH nhắn đến Zalo OA, hệ thống tự động trả lời theo rule đã cấu hình.</p>

    <div v-if="loading" class="loading">⏳ Đang tải...</div>
    <div v-else-if="rules.length === 0" class="empty">
      Chưa có rule nào. Nhấn <strong>+ Tạo rule mới</strong> để bắt đầu.
    </div>
    <table v-else class="arr-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>Trigger</th>
          <th>Action</th>
          <th>Ưu tiên</th>
          <th>Bật</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rules" :key="r.id">
          <td>{{ r.name }}</td>
          <td><code>{{ r.triggerType }}: {{ r.triggerValue.slice(0, 50) }}{{ r.triggerValue.length > 50 ? '...' : '' }}</code></td>
          <td><code>{{ r.actionType }}</code></td>
          <td>{{ r.priority }}</td>
          <td>
            <input type="checkbox" :checked="r.enabled" @change="toggleEnabled(r)" />
          </td>
          <td>
            <button class="btn-secondary" @click="openEdit(r)">Sửa</button>
            <button class="btn-danger" @click="del(r)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Create/Edit dialog -->
    <div v-if="dialogOpen" class="modal-overlay" @click.self="dialogOpen = false">
      <div class="modal-body">
        <h3>{{ editing ? 'Sửa rule' : 'Tạo rule mới' }}</h3>
        <div class="field">
          <label>Tên rule</label>
          <input v-model="form.name" placeholder="VD: Chào khách mới" />
        </div>
        <div class="field">
          <label>Trigger type</label>
          <select v-model="form.triggerType">
            <option value="keyword">Keyword (chứa từ khoá)</option>
            <option value="regex">Regex (biểu thức chính quy)</option>
            <option value="tag">Tag (có #tag trong tin)</option>
            <option value="time_window">Time window (trong khung giờ)</option>
          </select>
        </div>
        <div class="field">
          <label>Trigger value</label>
          <input v-model="form.triggerValue" :placeholder="triggerValuePlaceholder" />
          <small v-if="form.triggerType === 'time_window'">VD: 09:00-18:00 hoặc [{"dayOfWeek":1,"from":"09:00","to":"17:00"}]</small>
        </div>
        <div class="field">
          <label>Action type</label>
          <select v-model="form.actionType">
            <option value="text">Text (gửi text cố định)</option>
            <option value="image">Image (gửi ảnh)</option>
            <option value="template">Template (gửi mẫu)</option>
            <option value="ai_suggest">AI Suggest (AI tự trả lời)</option>
          </select>
        </div>
        <div class="field">
          <label>Action content</label>
          <textarea v-model="form.actionContent" rows="3" placeholder="Nội dung tin nhắn / template id / URL ảnh" />
        </div>
        <div class="field">
          <label>Ưu tiên (cao = chạy trước)</label>
          <input type="number" v-model.number="form.priority" />
        </div>
        <div class="field">
          <label>
            <input type="checkbox" v-model="form.enabled" />
            Bật rule này
          </label>
        </div>
        <div class="actions">
          <button class="btn-secondary" @click="dialogOpen = false">Huỷ</button>
          <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? '⏳ Đang lưu...' : '💾 Lưu' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { autoReplyApi, type AutoReplyRule, type TriggerType, type ActionType } from '@/api/auto-reply';
import { useToast } from '@/composables/use-toast';
import { useConfirm } from '@/composables/use-confirm';

const toast = useToast();
const confirm = useConfirm();
const rules = ref<AutoReplyRule[]>([]);
const loading = ref(true);
const saving = ref(false);
const dialogOpen = ref(false);
const editing = ref<AutoReplyRule | null>(null);
const form = ref({
  name: '',
  triggerType: 'keyword' as TriggerType,
  triggerValue: '',
  actionType: 'text' as ActionType,
  actionContent: '',
  priority: 0,
  enabled: true,
});

const triggerValuePlaceholder = computed(() => {
  switch (form.value.triggerType) {
    case 'keyword': return 'VD: xin chào, hello, hi (phân cách dấu phẩy)';
    case 'regex': return 'VD: ^(\\+|0)\\d{9,10}$';
    case 'tag': return 'VD: urgent, hot (phân cách dấu phẩy)';
    case 'time_window': return '09:00-18:00';
    default: return '';
  }
});

async function load() {
  loading.value = true;
  try {
    rules.value = await autoReplyApi.list();
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    triggerType: 'keyword',
    triggerValue: '',
    actionType: 'text',
    actionContent: '',
    priority: 0,
    enabled: true,
  };
  dialogOpen.value = true;
}

function openEdit(r: AutoReplyRule) {
  editing.value = r;
  form.value = {
    name: r.name,
    triggerType: r.triggerType,
    triggerValue: r.triggerValue,
    actionType: r.actionType,
    actionContent: r.actionContent,
    priority: r.priority,
    enabled: r.enabled,
  };
  dialogOpen.value = true;
}

async function save() {
  if (!form.value.name?.trim()) {
    toast.error('Tên rule là bắt buộc');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await autoReplyApi.update(editing.value.id, form.value);
    } else {
      await autoReplyApi.create(form.value);
    }
    dialogOpen.value = false;
    await load();
  } catch (e: any) {
    toast.error(e?.response?.data?.error || 'Lỗi lưu rule');
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled(r: AutoReplyRule) {
  try {
    await autoReplyApi.update(r.id, { enabled: !r.enabled });
    r.enabled = !r.enabled;
  } catch (e: any) {
    toast.error('Lỗi cập nhật');
  }
}

async function del(r: AutoReplyRule) {
  if (!(await confirm({ title: `Xóa rule "${r.name}"?`, tone: 'danger', confirmText: 'Xóa', cancelText: 'Hủy' }))) return;
  try {
    await autoReplyApi.delete(r.id);
    await load();
  } catch (e: any) {
    toast.error('Lỗi xóa');
  }
}

onMounted(load);
</script>

<style scoped>
.arr-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.arr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.arr-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.arr-desc {
  color: #64748b;
  font-size: 13px;
  margin: 0;
}
.arr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.arr-table th, .arr-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}
.arr-table th {
  background: #f8fafc;
  font-weight: 600;
}
.arr-table code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.empty, .loading {
  padding: 40px;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-body {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-body h3 {
  margin: 0 0 16px;
  font-size: 16px;
}
.field {
  margin-bottom: 12px;
}
.field label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 500;
}
.field input, .field select, .field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
}
.field small {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.btn-primary {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-secondary {
  background: #f1f5f9;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 4px;
}
.btn-danger {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
</style>