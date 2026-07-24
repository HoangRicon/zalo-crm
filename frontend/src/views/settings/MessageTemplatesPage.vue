<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận -->
<template>
  <div class="mtp-layout">
    <!-- Sidebar: Folder tree -->
    <aside class="mtp-sidebar">
      <div class="mtp-sidebar-header">
        <h2 class="mtp-sidebar-title">Thư mục</h2>
        <v-btn
          icon
          size="x-small"
          variant="tonal"
          color="primary"
          title="Tạo thư mục mới"
          @click="showCreateFolderDialog = true"
        >
          <v-icon size="18">mdi-folder-plus</v-icon>
        </v-btn>
      </div>

      <div class="mtp-folder-list">
        <TemplateFolderTree
          :folders="folders"
          :selected-folder-id="selectedFolderId"
          :root-count="rootTemplateCount"
          :loading="loadingFolders"
          @select="onSelectFolder"
          @create-folder="showCreateFolderDialog = true"
          @edit-folder="onEditFolder"
          @delete-folder="onDeleteFolder"
        />
      </div>
    </aside>

    <!-- Main: Template list + Editor -->
    <main class="mtp-main">
      <!-- Toolbar -->
      <div class="mtp-toolbar">
        <div class="mtp-toolbar-left">
          <v-text-field
            v-model="searchQuery"
            placeholder="Tìm mẫu tin..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="max-width: 320px"
            @update:model-value="onSearch"
          />
        </div>
        <div class="mtp-toolbar-right">
          <v-chip
            v-if="selectedFolder"
            size="small"
            variant="tonal"
            closable
            @click:close="selectedFolderId = null"
          >
            <v-icon start size="14">mdi-folder</v-icon>
            {{ selectedFolder.name }}
          </v-chip>
          <v-btn
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openCreateTemplate"
          >
            Tạo mẫu tin
          </v-btn>
        </div>
      </div>

      <!-- Content: List + Preview/Editor -->
      <div class="mtp-content">
        <!-- Template list -->
        <div class="mtp-list-panel">
          <TemplateList
            :templates="filteredTemplates"
            :loading="loadingTemplates"
            :selected-template-id="selectedTemplateId"
            @select="onSelectTemplate"
            @edit="openEditTemplate"
            @delete="onDeleteTemplate"
          />
        </div>

        <!-- Preview/Editor panel -->
        <div class="mtp-preview-panel">
          <v-card v-if="selectedTemplate || editingTemplate" variant="flat" class="mtp-editor-card">
            <template v-if="editingTemplate">
              <v-card-title class="d-flex align-center ga-2">
                <v-icon>mdi-pencil</v-icon>
                {{ editingTemplate.id ? 'Sửa mẫu tin' : 'Tạo mẫu tin mới' }}
                <v-spacer />
                <v-btn icon size="small" variant="text" @click="closeEditor">
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </v-card-title>
              <v-card-text>
                <TemplateEditor
                  ref="editorRef"
                  :template="editingTemplate"
                  :folders="folders"
                  :loading="savingTemplate"
                  @save="onSaveTemplate"
                  @cancel="closeEditor"
                />
              </v-card-text>
            </template>

            <template v-else-if="selectedTemplate">
              <v-card-title class="d-flex align-center ga-2">
                <span class="mtp-template-name">{{ selectedTemplate.name }}</span>
                <v-spacer />
                <v-chip
                  size="x-small"
                  :color="selectedTemplate.visibility === 'public' ? 'success' : 'default'"
                  variant="tonal"
                >
                  {{ selectedTemplate.visibility === 'public' ? 'Công khai' : 'Riêng tư' }}
                </v-chip>
                <v-btn icon size="small" variant="text" @click="openEditTemplate(selectedTemplate)">
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
              </v-card-title>
              <v-card-text>
                <!-- Shortcut display -->
                <div v-if="selectedTemplate.shortcut" class="mtp-shortcut-display">
                  <v-chip size="small" color="primary" variant="outlined">
                    <v-icon start size="14">mdi-alpha-s-circle-outline</v-icon>
                    {{ selectedTemplate.shortcut }}
                  </v-chip>
                </div>

                <!-- Template content preview -->
                <div class="mtp-preview-content">
                  <div class="mtp-preview-label">Nội dung:</div>
                  <div class="mtp-preview-text">{{ selectedTemplate.content }}</div>
                </div>

                <!-- 2026-07-24 fix-batch#3: ảnh đính kèm (nếu có) -->
                <div v-if="selectedTemplate.imageBase64" class="mtp-preview-image">
                  <div class="mtp-preview-label">Ảnh đính kèm:</div>
                  <img :src="selectedTemplate.imageBase64" class="mtp-preview-image-img" />
                </div>

                <!-- Variables -->
                <div v-if="templateVariables.length > 0" class="mtp-variables">
                  <div class="mtp-preview-label">Biến sử dụng:</div>
                  <div class="mtp-var-list">
                    <v-chip
                      v-for="v in templateVariables"
                      :key="v"
                      size="x-small"
                      variant="tonal"
                      class="mtp-var-chip"
                    >
                                            <span>{{ getVarChip(v) }}</span>
                    </v-chip>
                  </div>
                </div>

                <!-- Stats -->
                <div class="mtp-stats">
                  <div class="mtp-stat-item">
                    <v-icon size="14">mdi-counter</v-icon>
                    <span>{{ selectedTemplate.usageCount }} lần sử dụng</span>
                  </div>
                  <div v-if="selectedTemplate.manualSendCount > 0" class="mtp-stat-item">
                    <v-icon size="14">mdi-send</v-icon>
                    <span>{{ selectedTemplate.manualSendCount }} lần gửi tay</span>
                  </div>
                </div>
              </v-card-text>
            </template>
          </v-card>

          <!-- Empty state -->
          <div v-else class="mtp-empty-state">
            <v-icon size="64" color="grey-lighten-1">mdi-text-box-outline</v-icon>
            <div class="mtp-empty-text">Chọn một mẫu tin để xem chi tiết</div>
            <v-btn color="primary" variant="tonal" size="small" @click="openCreateTemplate">
              Tạo mẫu tin mới
            </v-btn>
          </div>
        </div>
      </div>
    </main>

    <!-- Create/Edit Folder Dialog -->
    <v-dialog v-model="showCreateFolderDialog" max-width="400">
      <v-card>
        <v-card-title>{{ editingFolder?.id ? 'Sửa thư mục' : 'Tạo thư mục mới' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="folderForm.name"
            label="Tên thư mục"
            variant="outlined"
            density="comfortable"
            hide-details
            autofocus
            @keyup.enter="onSaveFolder"
          />
          <v-select
            v-model="folderForm.visibility"
            :items="visibilityOptions"
            item-title="label"
            item-value="value"
            label="Phạm vi"
            variant="outlined"
            density="comfortable"
            hide-details
            class="mt-3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeFolderDialog">Huỷ</v-btn>
          <v-btn color="primary" :loading="savingFolder" @click="onSaveFolder">
            {{ editingFolder?.id ? 'Lưu' : 'Tạo' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from '@/composables/use-toast';
import { useConfirm } from '@/composables/use-confirm';
import {
  getTemplates,
  searchTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  type MessageTemplate,
  type MessageTemplateFolder,
  type CreateTemplateData,
} from '@/api/message-templates';
import TemplateList from '@/components/templates/TemplateList.vue';
import TemplateEditor from '@/components/templates/TemplateEditor.vue';
import TemplateFolderTree from '@/components/templates/TemplateFolderTree.vue';

const toast = useToast();
const confirm = useConfirm();

// ── State ────────────────────────────────────────────────────────────────────
const templates = ref<MessageTemplate[]>([]);
const folders = ref<MessageTemplateFolder[]>([]);
const rootTemplateCount = ref(0);
const selectedFolderId = ref<string | null>(null);
const selectedTemplateId = ref<string | null>(null);
const selectedTemplate = ref<MessageTemplate | null>(null);
const editingTemplate = ref<Partial<MessageTemplate> | null>(null);
const editorRef = ref<InstanceType<typeof TemplateEditor> | null>(null);

const loadingTemplates = ref(false);
const loadingFolders = ref(false);
const savingTemplate = ref(false);
const savingFolder = ref(false);

const searchQuery = ref('');
const showCreateFolderDialog = ref(false);
const editingFolder = ref<MessageTemplateFolder | null>(null);
const folderForm = ref({
  name: '',
  visibility: 'public' as 'public' | 'private',
});

const visibilityOptions = [
  { value: 'public', label: 'Công khai (mọi người trong tổ chức)' },
  { value: 'private', label: 'Riêng tư (chỉ mình tôi)' },
];

// ── Computed ─────────────────────────────────────────────────────────────────
const selectedFolder = computed(() => {
  if (!selectedFolderId.value) return null;
  const findFolder = (items: MessageTemplateFolder[]): MessageTemplateFolder | null => {
    for (const item of items) {
      if (item.id === selectedFolderId.value) return item;
      if (item.children) {
        const found = findFolder(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  return findFolder(folders.value);
});

const filteredTemplates = computed(() => {
  let result = templates.value;
  if (selectedFolderId.value) {
    result = result.filter((t) => t.folderId === selectedFolderId.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (t) => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q),
    );
  }
  return result;
});

const templateVariables = computed(() => {
  if (!selectedTemplate.value) return [];
  const regex = /\{\{(\w+)\}\}/g;
  const vars: string[] = [];
  let match;
  const content = selectedTemplate.value.content;
  while ((match = regex.exec(content)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  return vars;
});

// Helper to display variable chip (avoids template expression issues)
function getVarChip(v: string) {
  return `{{${v}}}`;
}

// ── Data fetching ────────────────────────────────────────────────────────────
async function fetchTemplates() {
  loadingTemplates.value = true;
  try {
    templates.value = await getTemplates(selectedFolderId.value);
  } catch (err: any) {
    toast.error('Không tải được danh sách mẫu tin');
  } finally {
    loadingTemplates.value = false;
  }
}

async function fetchFolders() {
  loadingFolders.value = true;
  try {
    const result = await getFolders();
    folders.value = result.folders;
    rootTemplateCount.value = result.rootTemplateCount;
  } catch (err: any) {
    toast.error('Không tải được danh sách thư mục');
  } finally {
    loadingFolders.value = false;
  }
}

async function onSearch(query: string | null) {
  searchQuery.value = query ?? '';
  if (searchQuery.value.trim()) {
    loadingTemplates.value = true;
    try {
      templates.value = await searchTemplates(searchQuery.value);
    } catch (err: any) {
      toast.error('Không tìm kiếm được');
    } finally {
      loadingTemplates.value = false;
    }
  } else {
    await fetchTemplates();
  }
}

// ── Template actions ──────────────────────────────────────────────────────────
function onSelectFolder(folderId: string | null) {
  selectedFolderId.value = folderId;
  selectedTemplateId.value = null;
  selectedTemplate.value = null;
  searchQuery.value = '';
  void fetchTemplates();
}

function onSelectTemplate(template: MessageTemplate) {
  selectedTemplateId.value = template.id;
  selectedTemplate.value = template;
  editingTemplate.value = null;
}

function openCreateTemplate() {
  editingTemplate.value = {
    name: '',
    shortcut: '',
    content: '',
    folderId: selectedFolderId.value,
    visibility: 'private',
  };
  selectedTemplate.value = null;
}

function openEditTemplate(template: MessageTemplate) {
  editingTemplate.value = { ...template };
  selectedTemplate.value = null;
}

function closeEditor() {
  editingTemplate.value = null;
  if (selectedTemplateId.value) {
    const t = templates.value.find(t => t.id === selectedTemplateId.value);
    if (t) selectedTemplate.value = t;
  }
}

async function onSaveTemplate(formData: CreateTemplateData) {
  savingTemplate.value = true;
  try {
    if (editingTemplate.value?.id) {
      const updated = await updateTemplate(editingTemplate.value.id, formData);
      const idx = templates.value.findIndex(t => t.id === updated.id);
      if (idx >= 0) templates.value[idx] = updated;
      toast.success('Đã cập nhật mẫu tin');
      selectedTemplate.value = updated;
      editingTemplate.value = null;
    } else {
      const created = await createTemplate(formData);
      templates.value.unshift(created);
      toast.success('Đã tạo mẫu tin');
      selectedTemplate.value = created;
      editingTemplate.value = null;
    }
    await fetchFolders(); // Update folder counts
  } catch (err: any) {
    toast.error(err?.response?.data?.error || 'Không lưu được mẫu tin');
  } finally {
    savingTemplate.value = false;
  }
}

async function onDeleteTemplate(template: MessageTemplate) {
  if (!(await confirm({ title: `Xoá mẫu tin "${template.name}"?`, tone: 'danger', confirmText: 'Xoá', cancelText: 'Huỷ' }))) return;
  try {
    await deleteTemplate(template.id);
    templates.value = templates.value.filter(t => t.id !== template.id);
    if (selectedTemplateId.value === template.id) {
      selectedTemplateId.value = null;
      selectedTemplate.value = null;
    }
    toast.success('Đã xoá mẫu tin');
    await fetchFolders();
  } catch (err: any) {
    toast.error('Không xoá được mẫu tin');
  }
}

// ── Folder actions ─────────────────────────────────────────────────────────────
function onEditFolder(folder: MessageTemplateFolder) {
  editingFolder.value = folder;
  folderForm.value = {
    name: folder.name,
    visibility: folder.visibility,
  };
  showCreateFolderDialog.value = true;
}

function closeFolderDialog() {
  showCreateFolderDialog.value = false;
  editingFolder.value = null;
  folderForm.value = { name: '', visibility: 'public' };
}

async function onSaveFolder() {
  if (!folderForm.value.name.trim()) {
    toast.error('Vui lòng nhập tên thư mục');
    return;
  }
  savingFolder.value = true;
  try {
    if (editingFolder.value?.id) {
      await updateFolder(editingFolder.value.id, {
        name: folderForm.value.name.trim(),
        visibility: folderForm.value.visibility,
      });
      toast.success('Đã cập nhật thư mục');
    } else {
      await createFolder({
        name: folderForm.value.name.trim(),
        visibility: folderForm.value.visibility,
      });
      toast.success('Đã tạo thư mục');
    }
    closeFolderDialog();
    await fetchFolders();
  } catch (err: any) {
    toast.error(err?.response?.data?.error || 'Không lưu được thư mục');
  } finally {
    savingFolder.value = false;
  }
}

async function onDeleteFolder(folder: MessageTemplateFolder) {
  if (!(await confirm({ title: `Xoá thư mục "${folder.name}"?`, description: 'Mẫu tin trong thư mục sẽ chuyển ra ngoài.', tone: 'danger', confirmText: 'Xoá', cancelText: 'Huỷ' }))) return;
  try {
    await deleteFolder(folder.id);
    toast.success('Đã xoá thư mục');
    if (selectedFolderId.value === folder.id) {
      selectedFolderId.value = null;
    }
    await fetchFolders();
    await fetchTemplates();
  } catch (err: any) {
    toast.error('Không xoá được thư mục');
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchFolders(), fetchTemplates()]);
});
</script>

<style scoped>
.mtp-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: calc(100vh - 56px);
  background: #fafafa;
}

.mtp-sidebar {
  background: white;
  border-right: 1px solid #e4e5e9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mtp-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e4e5e9;
  flex-shrink: 0;
}

.mtp-sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2d3d;
  margin: 0;
}

.mtp-folder-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.mtp-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mtp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e4e5e9;
  flex-shrink: 0;
}

.mtp-toolbar-left,
.mtp-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mtp-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 20px;
  overflow: hidden;
}

.mtp-list-panel {
  overflow-y: auto;
  background: white;
  border-radius: 12px;
  border: 1px solid #e4e5e9;
}

.mtp-preview-panel {
  overflow-y: auto;
}

.mtp-editor-card {
  height: 100%;
}

.mtp-template-name {
  font-size: 16px;
  font-weight: 600;
}

.mtp-shortcut-display {
  margin-bottom: 16px;
}

.mtp-preview-content {
  margin-bottom: 16px;
}

.mtp-preview-label {
  font-size: 11px;
  font-weight: 700;
  color: #6b7785;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.mtp-preview-text {
  background: #f4f4f7;
  padding: 12px;
  border-radius: 8px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 2026-07-24 fix-batch#3: hiển thị ảnh preview */
.mtp-preview-image { margin-bottom: 16px; }
.mtp-preview-image-img {
  max-width: 100%;
  max-height: 280px;
  border-radius: 8px;
  border: 1px solid #e4e5e9;
  display: block;
}

.mtp-variables {
  margin-bottom: 16px;
}

.mtp-var-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mtp-var-chip {
  font-family: ui-monospace, monospace;
}

.mtp-stats {
  display: flex;
  gap: 20px;
  padding-top: 12px;
  border-top: 1px solid #e4e5e9;
}

.mtp-stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #6b7785;
}

.mtp-empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #97a0ac;
}

.mtp-empty-text {
  font-size: 14px;
}
</style>
