<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận -->
<template>
  <div class="tft-tree">
    <!-- Loading -->
    <div v-if="loading" class="tft-loading">
      <v-progress-circular size="16" width="2" indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- Root level (no folder) -->
      <div
        class="tft-item"
        :class="{ active: selectedFolderId === null }"
        @click="$emit('select', null)"
      >
        <v-icon class="tft-icon" size="18">mdi-file-document-outline</v-icon>
        <span class="tft-name">Không phân thư mục</span>
        <span class="tft-count">{{ rootCount }}</span>
      </div>

      <!-- Folders -->
      <template v-for="folder in folders" :key="folder.id">
        <FolderItem
          :folder="folder"
          :selected-id="selectedFolderId"
          :depth="0"
          @select="$emit('select', $event)"
          @edit="$emit('edit-folder', $event)"
          @delete="$emit('delete-folder', $event)"
          @create-child="$emit('create-folder')"
        />
      </template>
    </template>

    <!-- Add folder button at bottom -->
    <button class="tft-add-btn" type="button" @click="$emit('create-folder')">
      <v-icon size="16">mdi-plus</v-icon>
      <span>Thêm thư mục</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { MessageTemplateFolder } from '@/api/message-templates';
import FolderItem from './FolderItem.vue';

defineProps<{
  folders: MessageTemplateFolder[];
  selectedFolderId: string | null;
  rootCount: number;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'select', folderId: string | null): void;
  (e: 'create-folder'): void;
  (e: 'edit-folder', folder: MessageTemplateFolder): void;
  (e: 'delete-folder', folder: MessageTemplateFolder): void;
}>();
</script>

<style scoped>
.tft-tree {
  padding: 4px 8px;
}

.tft-loading {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.tft-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
  user-select: none;
}

.tft-item:hover {
  background: #f4f4f7;
}

.tft-item.active {
  background: #eef0ff;
  color: #5e6ad2;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #5e6ad2;
}

.tft-icon {
  flex-shrink: 0;
  color: #97a0ac;
}

.tft-item.active .tft-icon {
  color: #5e6ad2;
}

.tft-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tft-count {
  font-size: 11px;
  color: #97a0ac;
  background: #f0f0f5;
  padding: 1px 7px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.tft-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: 1px dashed #d4d6db;
  border-radius: 6px;
  background: transparent;
  color: #6b7785;
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
}

.tft-add-btn:hover {
  border-color: #5e6ad2;
  color: #5e6ad2;
  background: #eef0ff;
}
</style>
