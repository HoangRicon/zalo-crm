<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận -->
<template>
  <div class="tpe-form">
    <!-- Name -->
    <v-text-field
      v-model="form.name"
      label="Tên mẫu tin"
      variant="outlined"
      density="comfortable"
      hide-details="auto"
      class="mb-3"
      :rules="[v => !!v?.trim() || 'Tên bắt buộc']"
      autofocus
    />

    <!-- Shortcut -->
    <v-text-field
      v-model="form.shortcut"
      label="Phím tắt (shortcut)"
      placeholder="VD: /giaEGV"
      variant="outlined"
      density="comfortable"
      hide-details="auto"
      hint="Gõ shortcut để nhanh chóng chèn mẫu tin vào hội thoại"
      persistent-hint
      class="mb-3"
    >
      <template #prepend-inner>
        <span class="tpe-shortcut-prefix">/</span>
      </template>
    </v-text-field>

    <!-- Content -->
    <div class="mb-3">
      <label class="tpe-label">Nội dung tin nhắn</label>
      <v-textarea
        v-model="form.content"
        placeholder="Nhập nội dung tin nhắn..."
        variant="outlined"
        density="comfortable"
        rows="6"
        auto-grow
        hide-details
        class="tpe-textarea"
      />
      <div class="tpe-char-count">{{ form.content?.length || 0 }} ký tự</div>
    </div>

    <!-- Variable picker -->
    <div class="mb-3">
      <label class="tpe-label">Chèn biến (bấm để chèn)</label>
      <div class="tpe-var-bar">
        <button
          v-for="v in COMMON_VARIABLES"
          :key="v.key"
          type="button"
          class="tpe-var-chip"
          :title="v.desc"
          @click="insertVariable(v.key)"
        >
          <code>{{ getVarChip(v.key) }}</code>
          <span class="tpe-var-chip-label">{{ v.short }}</span>
        </button>
      </div>
    </div>

    <!-- Folder -->
    <v-select
      v-model="form.folderId"
      :items="folderOptions"
      item-title="name"
      item-value="id"
      label="Thư mục"
      variant="outlined"
      density="comfortable"
      hide-details
      clearable
      placeholder="Không chọn = lưu ở ngoài"
      class="mb-3"
    />

    <!-- Visibility -->
    <v-select
      v-model="form.visibility"
      :items="visibilityOptions"
      item-title="label"
      item-value="value"
      label="Phạm vi"
      variant="outlined"
      density="comfortable"
      hide-details
      class="mb-4"
    />

    <!-- Actions -->
    <div class="tpe-actions">
      <v-btn variant="text" @click="$emit('cancel')">Huỷ</v-btn>
      <v-btn
        color="primary"
        :loading="loading"
        :disabled="!isValid"
        prepend-icon="mdi-content-save"
        @click="onSaveAndClose"
      >
        {{ template?.id ? 'Lưu &amp; Đóng' : 'Lưu &amp; Đóng' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MessageTemplate, MessageTemplateFolder, CreateTemplateData } from '@/api/message-templates';

const props = defineProps<{
  template?: Partial<MessageTemplate> | null;
  folders: MessageTemplateFolder[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', data: CreateTemplateData): void;
  (e: 'cancel'): void;
}>();

const COMMON_VARIABLES = [
  { key: 'customerName', short: 'Tên KH', desc: 'Tên khách hàng' },
  { key: 'phone', short: 'SĐT', desc: 'Số điện thoại' },
  { key: 'fullName', short: 'Tên đầy đủ', desc: 'Họ tên đầy đủ' },
  { key: 'email', short: 'Email', desc: 'Địa chỉ email' },
  { key: 'company', short: 'Công ty', desc: 'Tên công ty' },
  { key: 'product', short: 'Sản phẩm', desc: 'Tên sản phẩm' },
  { key: 'price', short: 'Giá', desc: 'Giá sản phẩm' },
  { key: 'date', short: 'Ngày', desc: 'Ngày tháng' },
  { key: 'time', short: 'Giờ', desc: 'Thời gian' },
  { key: 'staffName', short: 'Tên NV', desc: 'Tên nhân viên tư vấn' },
];

const visibilityOptions = [
  { value: 'private', label: 'Riêng tư (chỉ mình tôi)' },
  { value: 'public', label: 'Công khai (mọi người trong tổ chức)' },
];

// Form state
const form = ref({
  name: '',
  shortcut: '',
  content: '',
  folderId: null as string | null,
  visibility: 'private' as 'public' | 'private',
});

// Initialize form from props
watch(
  () => props.template,
  (t) => {
    if (t) {
      form.value = {
        name: t.name ?? '',
        shortcut: t.shortcut ?? '',
        content: t.content ?? '',
        folderId: t.folderId ?? null,
        visibility: t.visibility ?? 'private',
      };
    } else {
      form.value = {
        name: '',
        shortcut: '',
        content: '',
        folderId: null,
        visibility: 'private',
      };
    }
  },
  { immediate: true },
);

const isValid = computed(() => {
  return !!form.value.name?.trim() && !!form.value.content?.trim();
});

// Flatten folder options for v-select
const folderOptions = computed(() => {
  const options: { id: string; name: string; depth: number }[] = [];

  const flatten = (folders: MessageTemplateFolder[], depth = 0) => {
    for (const folder of folders) {
      options.push({
        id: folder.id,
        name: folder.name,
        depth,
      });
      if (folder.children?.length) {
        flatten(folder.children, depth + 1);
      }
    }
  };

  flatten(props.folders);
  return options.map((o) => ({
    ...o,
    name: '  '.repeat(o.depth) + o.name,
  }));
});

// Insert variable at cursor position
function insertVariable(key: string) {
  form.value.content += `{{${key}}}`;
}

// Helper to display variable chip (avoids template expression issues with curly braces)
function getVarChip(key: string) {
  return `{{${key}}}`;
}

function onSaveAndClose() {
  if (!isValid.value) return;
  const shortcut = form.value.shortcut?.trim();
  emit('save', {
    name: form.value.name.trim(),
    shortcut: shortcut || undefined,
    content: form.value.content,
    folderId: form.value.folderId,
    visibility: form.value.visibility,
  });
}
</script>

<style scoped>
.tpe-form {
  padding: 4px 0;
}

.tpe-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7785;
  margin-bottom: 6px;
}

.tpe-shortcut-prefix {
  font-family: ui-monospace, monospace;
  font-size: 14px;
  color: #5e6ad2;
  margin-right: 2px;
}

.tpe-textarea :deep(.v-field__input) {
  font-size: 13.5px;
  line-height: 1.6;
}

.tpe-char-count {
  font-size: 11px;
  color: #97a0ac;
  text-align: right;
  margin-top: 4px;
}

.tpe-var-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e4e5e9;
}

.tpe-var-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 9999px;
  border: 1px solid #b9d4ff;
  background: #e7f0ff;
  color: #5e6ad2;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}

.tpe-var-chip:hover {
  background: #d8e8ff;
  transform: translateY(-1px);
}

.tpe-var-chip code {
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
  background: transparent;
  color: inherit;
}

.tpe-var-chip-label {
  color: #6b7785;
  font-weight: 500;
  font-size: 10px;
}

.tpe-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #e4e5e9;
}
</style>
