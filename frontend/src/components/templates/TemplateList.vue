<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận -->
<template>
  <div class="tpl-list">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 5" :key="i" class="tpl-skeleton">
        <div class="tpl-skeleton-name"></div>
        <div class="tpl-skeleton-content"></div>
      </div>
    </template>

    <!-- Template items -->
    <template v-else>
      <div
        v-for="template in templates"
        :key="template.id"
        class="tpl-item"
        :class="{ active: template.id === selectedTemplateId }"
        @click="$emit('select', template)"
      >
        <div class="tpl-item-header">
          <!-- 2026-07-24 fix-batch#3: thumbnail ảnh (nếu có) để list dễ scan -->
          <img v-if="template.imageBase64" :src="template.imageBase64" class="tpl-item-thumb" />
          <v-icon v-else size="20" color="grey-lighten-1" class="tpl-item-thumb-icon">mdi-text-box-outline</v-icon>
          <div class="tpl-item-name">{{ template.name }}</div>
          <div class="tpl-item-actions">
            <v-btn
              icon
              size="x-small"
              variant="text"
              title="Sửa"
              @click.stop="$emit('edit', template)"
            >
              <v-icon size="16">mdi-pencil</v-icon>
            </v-btn>
            <v-btn
              icon
              size="x-small"
              variant="text"
              color="error"
              title="Xoá"
              @click.stop="$emit('delete', template)"
            >
              <v-icon size="16">mdi-delete</v-icon>
            </v-btn>
          </div>
        </div>

        <div v-if="template.shortcut" class="tpl-item-shortcut">
          <code>{{ template.shortcut }}</code>
        </div>

        <div class="tpl-item-content">{{ truncateContent(template.content) }}</div>

        <div class="tpl-item-footer">
          <v-chip
            size="x-small"
            :color="template.visibility === 'public' ? 'success' : 'default'"
            variant="tonal"
          >
            {{ template.visibility === 'public' ? 'Công khai' : 'Riêng tư' }}
          </v-chip>
          <span class="tpl-item-count">
            <v-icon size="12">mdi-counter</v-icon>
            {{ template.usageCount }}
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="templates.length === 0" class="tpl-empty">
        <v-icon size="48" color="grey-lighten-1">mdi-text-box-plus-outline</v-icon>
        <div>Chưa có mẫu tin nào</div>
        <div class="tpl-empty-hint">Tạo mẫu tin đầu tiên để bắt đầu</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MessageTemplate } from '@/api/message-templates';

defineProps<{
  templates: MessageTemplate[];
  loading: boolean;
  selectedTemplateId?: string | null;
}>();

defineEmits<{
  (e: 'select', template: MessageTemplate): void;
  (e: 'edit', template: MessageTemplate): void;
  (e: 'delete', template: MessageTemplate): void;
}>();

function truncateContent(content: string, maxLength = 120): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
</script>

<style scoped>
.tpl-list {
  padding: 8px;
}

.tpl-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.tpl-item:hover {
  background: #f4f4f7;
}

.tpl-item.active {
  background: #eef0ff;
  box-shadow: inset 3px 0 0 #5e6ad2;
}

.tpl-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

/* 2026-07-24 fix-batch#3: thumbnail style */
.tpl-item-thumb {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.tpl-item-thumb-icon {
  flex-shrink: 0;
}

.tpl-item-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f2d3d;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tpl-item:hover .tpl-item-actions {
  opacity: 1;
}

.tpl-item-shortcut {
  margin-bottom: 6px;
}

.tpl-item-shortcut code {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  background: #e3eaff;
  color: #5e6ad2;
  padding: 2px 6px;
  border-radius: 4px;
}

.tpl-item-content {
  font-size: 12.5px;
  color: #6b7785;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tpl-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tpl-item-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #97a0ac;
}

.tpl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: #97a0ac;
  text-align: center;
}

.tpl-empty-hint {
  font-size: 12px;
  margin-top: 4px;
}

/* Skeleton loading */
.tpl-skeleton {
  padding: 12px;
  margin-bottom: 4px;
}

.tpl-skeleton-name {
  height: 14px;
  width: 60%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 8px;
}

.tpl-skeleton-content {
  height: 12px;
  width: 90%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
