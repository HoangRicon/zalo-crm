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
      class="mb-3"
    />

    <!-- Image attachment -->
    <div class="mb-3">
      <label class="tpe-label">Đính kèm ảnh (tùy chọn)</label>
      <div class="tpe-image-row">
        <img v-if="previewImage" :src="previewImage" class="tpe-image-preview" />
        <button v-if="!previewImage" class="tpe-image-pick-btn" type="button" @click="pickImage">
          <v-icon size="20">mdi-image-plus</v-icon>
          <span>Chọn ảnh</span>
        </button>
        <button v-if="previewImage" class="tpe-image-remove-btn" type="button" title="Gỡ ảnh" @click="removeImage">
          <v-icon size="16">mdi-close</v-icon>
        </button>
      </div>
      <input ref="imageInputRef" type="file" accept="image/*" style="display:none" @change="onImageFileChange" />
      <div v-if="imageError" class="tpe-image-error">{{ imageError }}</div>
    </div>

    <!-- Actions -->
    <div class="tpe-actions">
      <v-btn variant="text" @click="$emit('cancel')">Huỷ</v-btn>
      <v-btn variant="outlined" color="secondary" prepend-icon="mdi-eye-outline" @click="onPreview">
        Xem trước
      </v-btn>
      <v-btn
        color="primary"
        :loading="loading"
        :disabled="!isValid"
        prepend-icon="mdi-content-save"
        @click="onSaveAndClose"
      >
        {{ template?.id ? 'Lưu & Đóng' : 'Tạo mẫu tin' }}
      </v-btn>
    </div>

    <!-- Preview modal -->
    <div v-if="showPreview" class="tpe-preview-overlay" @click.self="showPreview = false">
      <div class="tpe-preview-card">
        <div class="tpe-preview-header">
          <span>👁 Xem trước: {{ form.name || 'Mẫu tin' }}</span>
          <button class="tpe-preview-close" @click="showPreview = false">×</button>
        </div>
        <div class="tpe-preview-body">
          <div v-if="form.content" class="tpe-preview-message">{{ form.content }}</div>
          <img v-if="previewImage" :src="previewImage" class="tpe-preview-img" />
        </div>
        <div class="tpe-preview-footer">
          <button class="tpe-preview-copy" @click="copyPreview">
            📋 Copy nội dung
          </button>
          <button class="tpe-preview-ok" @click="showPreview = false">OK</button>
        </div>
      </div>
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

// ── Image attachment ────────────────────────────────────────────────────────
const imageInputRef = ref<HTMLInputElement | null>(null);
const previewImage = ref<string | null>(null);
const imageError = ref<string>('');
const showPreview = ref(false);

function pickImage() {
  imageInputRef.value?.click();
}

async function onImageFileChange(e: Event) {
  imageError.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    imageError.value = 'Chỉ chấp nhận file ảnh (jpg, png, gif, webp)';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    imageError.value = 'Ảnh tối đa 5MB';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImage.value = ev.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  previewImage.value = null;
  imageError.value = '';
  if (imageInputRef.value) imageInputRef.value.value = '';
}

function onPreview() {
  showPreview.value = true;
}

function copyPreview() {
  const text = form.value.content || '';
  navigator.clipboard.writeText(text).catch(() => {});
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
    imageBase64: previewImage.value ?? undefined,
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

.tpe-image-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tpe-image-preview {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.tpe-image-pick-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.tpe-image-pick-btn:hover {
  border-color: #0e445a;
  color: #0e445a;
  background: #f0f7fa;
}
.tpe-image-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 50%;
  color: #dc2626;
  cursor: pointer;
  transition: background 0.15s;
}
.tpe-image-remove-btn:hover { background: #fecaca; }
.tpe-image-error { font-size: 12px; color: #dc2626; margin-top: 4px; }

/* Preview modal */
.tpe-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.tpe-preview-card {
  background: #fff;
  border-radius: 12px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}
.tpe-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  font-size: 14px;
}
.tpe-preview-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #64748b;
  line-height: 1;
}
.tpe-preview-body {
  padding: 16px;
}
.tpe-preview-message {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  white-space: pre-wrap;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
}
.tpe-preview-img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-top: 10px;
}
.tpe-preview-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  justify-content: flex-end;
}
.tpe-preview-copy,
.tpe-preview-ok {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.tpe-preview-copy:hover { background: #f1f5f9; }
.tpe-preview-ok {
  background: #0e445a;
  color: #fff;
  border-color: #0e445a;
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
