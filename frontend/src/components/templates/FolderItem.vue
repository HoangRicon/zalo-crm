<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận -->
<template>
  <div class="fi-item-wrapper">
    <div
      class="fi-item"
      :class="{ active: folder.id === selectedId }"
      :style="{ paddingLeft: `${10 + depth * 16}px` }"
      @click="$emit('select', folder.id)"
    >
      <!-- Expand/collapse toggle -->
      <button
        v-if="folder.children?.length"
        type="button"
        class="fi-toggle"
        @click.stop="expanded = !expanded"
      >
        <v-icon size="14" :class="{ rotated: expanded }">mdi-chevron-right</v-icon>
      </button>
      <span v-else class="fi-toggle-placeholder"></span>

      <!-- Folder icon -->
      <v-icon class="fi-icon" size="18" :color="expanded ? 'warning' : undefined">
        {{ expanded ? 'mdi-folder-open' : 'mdi-folder' }}
      </v-icon>

      <!-- Folder name -->
      <span class="fi-name">{{ folder.name }}</span>

      <!-- Count badge -->
      <span class="fi-count">{{ folder.templateCount ?? 0 }}</span>

      <!-- Actions -->
      <div class="fi-actions" @click.stop>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn icon size="x-small" variant="text" v-bind="menuProps">
              <v-icon size="14">mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list density="compact" class="fi-context-menu">
            <v-list-item
              prepend-icon="mdi-plus"
              title="Thêm thư mục con"
              @click="$emit('create-child')"
            />
            <v-list-item
              prepend-icon="mdi-pencil"
              title="Sửa thư mục"
              @click="$emit('edit', folder)"
            />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-delete"
              title="Xoá thư mục"
              class="text-error"
              @click="$emit('delete', folder)"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Children -->
    <template v-if="expanded && folder.children?.length">
      <FolderItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :selected-id="selectedId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @create-child="$emit('create-child')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { MessageTemplateFolder } from '@/api/message-templates';

defineProps<{
  folder: MessageTemplateFolder;
  selectedId: string | null;
  depth: number;
}>();

defineEmits<{
  (e: 'select', folderId: string): void;
  (e: 'edit', folder: MessageTemplateFolder): void;
  (e: 'delete', folder: MessageTemplateFolder): void;
  (e: 'create-child'): void;
}>();

const expanded = ref(false);
</script>

<style scoped>
.fi-item-wrapper {
  user-select: none;
}

.fi-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}

.fi-item:hover {
  background: #f4f4f7;
}

.fi-item.active {
  background: #eef0ff;
  color: #5e6ad2;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #5e6ad2;
}

.fi-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: #97a0ac;
  transition: all 0.15s;
  flex-shrink: 0;
}

.fi-toggle:hover {
  background: #e4e5e9;
  color: #5e6ad2;
}

.fi-toggle .rotated {
  transform: rotate(90deg);
}

.fi-toggle-placeholder {
  width: 18px;
  flex-shrink: 0;
}

.fi-icon {
  flex-shrink: 0;
  color: #f59e0b;
}

.fi-item.active .fi-icon {
  color: #5e6ad2;
}

.fi-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fi-count {
  font-size: 10.5px;
  color: #97a0ac;
  background: #f0f0f5;
  padding: 1px 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.fi-item.active .fi-count {
  background: rgba(94, 106, 210, 0.15);
  color: #5e6ad2;
}

.fi-actions {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.fi-item:hover .fi-actions {
  opacity: 1;
}

.fi-context-menu {
  min-width: 160px;
}
</style>
