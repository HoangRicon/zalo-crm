<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  KnowledgeBasePage — 2026-07-24 — quản lý kho tri thức (RAG-lite) cho AI Assistant.
  - List docs (search + filter by kind/tags)
  - Create doc (markdown / media_collection / faq)
  - Edit / re-embed / delete (soft)
  - Preview chunks của 1 doc
  Xem openspec/changes/add-knowledge-base-and-chat-drag/.
-->
<template>
  <div class="kb-page">
    <header class="kb-header">
      <div class="kb-title-row">
        <div>
          <h2 class="kb-title">
            <v-icon icon="mdi-bookshelf" size="22" color="primary" />
            Kho tri thức
          </h2>
          <p class="kb-sub">
            Thêm tài liệu (markdown / FAQ / bộ sưu tập ảnh) để AI Assistant trả lời chính xác hơn khi nhân viên cần tra cứu nhanh.
          </p>
        </div>
        <button class="kb-btn kb-btn--primary" @click="openCreate()">
          <v-icon icon="mdi-plus" size="16" />
          Thêm tài liệu
        </button>
      </div>

      <div class="kb-toolbar">
        <div class="kb-search">
          <v-icon icon="mdi-magnify" size="16" />
          <input
            v-model="search"
            type="text"
            placeholder="Tìm theo tiêu đề…"
            @input="debouncedReload"
          />
          <button v-if="search" class="kb-clear" @click="search = ''; reload()" aria-label="Xoá">✕</button>
        </div>
        <select v-model="kindFilter" class="kb-select" @change="reload">
          <option value="">Tất cả loại</option>
          <option value="markdown">Markdown</option>
          <option value="media_collection">Bộ sưu tập ảnh</option>
          <option value="faq">FAQ</option>
        </select>
        <label class="kb-toggle">
          <input v-model="includeInactive" type="checkbox" @change="reload" />
          <span>Hiện cả đã tắt</span>
        </label>
        <span class="kb-count">{{ total }} tài liệu</span>
      </div>
    </header>

    <div v-if="loading" class="kb-loading">
      <v-progress-circular indeterminate color="primary" :size="28" :width="3" />
      <span>Đang tải kho tri thức…</span>
    </div>

    <div v-else-if="docs.length === 0" class="kb-empty">
      <v-icon icon="mdi-bookshelf" size="64" color="grey-lighten-1" />
      <div class="kb-empty-title">Kho tri thức đang trống</div>
      <div class="kb-empty-sub">
        Bắt đầu bằng cách thêm <strong>Markdown</strong> (hướng dẫn / bảng giá / chính sách),<br />
        <strong>FAQ</strong> (câu hỏi thường gặp), hoặc <strong>Bộ sưu tập ảnh</strong> (sản phẩm).
      </div>
      <button class="kb-btn kb-btn--primary" @click="openCreate()">
        <v-icon icon="mdi-plus" size="16" />
        Thêm tài liệu đầu tiên
      </button>
    </div>

    <div v-else class="kb-list">
      <article
        v-for="doc in docs"
        :key="doc.id"
        class="kb-card"
        :class="{ 'kb-card--inactive': !doc.isActive }"
      >
        <header class="kb-card-head">
          <div class="kb-card-title-row">
            <v-icon :icon="kindIcon(doc.kind)" size="18" color="primary" />
            <h3 class="kb-card-title">{{ doc.title }}</h3>
            <span v-if="!doc.isActive" class="kb-pill kb-pill--grey">Đã tắt</span>
          </div>
          <div class="kb-card-actions">
            <button class="kb-icon-btn" title="Xem chunks" @click="openPreview(doc)">
              <v-icon icon="mdi-eye-outline" size="16" />
            </button>
            <button class="kb-icon-btn" title="Sửa" @click="openEdit(doc)">
              <v-icon icon="mdi-pencil-outline" size="16" />
            </button>
            <button class="kb-icon-btn" title="Re-embed" :disabled="reembeddingId === doc.id" @click="onReembed(doc)">
              <v-progress-circular v-if="reembeddingId === doc.id" indeterminate :size="14" :width="2" />
              <v-icon v-else icon="mdi-refresh" size="16" />
            </button>
            <button class="kb-icon-btn kb-icon-btn--danger" title="Xóa" @click="onDelete(doc)">
              <v-icon icon="mdi-trash-can-outline" size="16" />
            </button>
          </div>
        </header>

        <div class="kb-card-meta">
          <span class="kb-pill kb-pill--kind">{{ kindLabel(doc.kind) }}</span>
          <span class="kb-meta-item">
            <v-icon icon="mdi-format-text" size="13" />
            {{ doc._count.chunks }} chunk{{ doc._count.chunks === 1 ? '' : 's' }}
          </span>
          <span class="kb-meta-item" v-if="doc.mediaAssetIds.length">
            <v-icon icon="mdi-image-multiple-outline" size="13" />
            {{ doc.mediaAssetIds.length }} ảnh
          </span>
          <span class="kb-meta-item">
            <v-icon icon="mdi-clock-outline" size="13" />
            {{ formatDate(doc.updatedAt) }}
          </span>
        </div>

        <div v-if="doc.tags.length" class="kb-tags">
          <span v-for="t in doc.tags" :key="t" class="kb-tag">#{{ t }}</span>
        </div>
      </article>
    </div>

    <!-- Edit/Create modal -->
    <div v-if="editing" class="kb-modal-overlay" role="dialog" aria-modal="true" @click.self="closeEdit">
      <div class="kb-modal">
        <header class="kb-modal-head">
          <h3>{{ editing.id ? 'Sửa tài liệu' : 'Thêm tài liệu' }}</h3>
          <button class="kb-icon-btn" @click="closeEdit" aria-label="Đóng">
            <v-icon icon="mdi-close" size="18" />
          </button>
        </header>
        <div class="kb-modal-body">
          <label class="kb-field">
            <span class="kb-label">Tiêu đề *</span>
            <input v-model="editing.title" type="text" maxlength="200" placeholder="VD: Bảng giá sản phẩm 2026" />
          </label>

          <label class="kb-field">
            <span class="kb-label">Loại</span>
            <select v-model="editing.kind" class="kb-select">
              <option value="markdown">Markdown (tài liệu dài)</option>
              <option value="faq">FAQ (1 câu hỏi - 1 câu trả lời)</option>
              <option value="media_collection">Bộ sưu tập ảnh</option>
            </select>
          </label>

          <template v-if="editing.kind === 'faq'">
            <label class="kb-field">
              <span class="kb-label">Câu hỏi *</span>
              <input v-model="editing.faqQ" type="text" maxlength="300" placeholder="VD: Sản phẩm có chống nước không?" />
            </label>
            <label class="kb-field">
              <span class="kb-label">Câu trả lời *</span>
              <textarea v-model="editing.faqA" rows="6" placeholder="Câu trả lời chi tiết (tối đa ~5000 ký tự)" maxlength="5000" />
            </label>
          </template>

          <template v-else-if="editing.kind === 'markdown'">
            <label class="kb-field">
              <span class="kb-label">Nội dung Markdown *</span>
              <textarea
                v-model="editing.text"
                rows="14"
                placeholder="# Tiêu đề&#10;&#10;Nội dung markdown… Hỗ trợ ## heading, **bold**, *italic*, danh sách."
                maxlength="200000"
              />
              <span class="kb-hint">{{ editing.text.length }} / 200000 ký tự — sẽ tự chia nhỏ ~500–800 ký tự mỗi chunk.</span>
            </label>
          </template>

          <template v-else>
            <label class="kb-field">
              <span class="kb-label">Caption chung (tùy chọn)</span>
              <textarea v-model="editing.text" rows="4" maxlength="5000" placeholder="Mô tả ngắn cho bộ sưu tập" />
            </label>
            <label class="kb-field">
              <span class="kb-label">Media Asset IDs *</span>
              <textarea
                v-model="editing.mediaAssetIdsRaw"
                rows="3"
                placeholder="Nhập ID cách nhau bởi dấu phẩy, VD: 7c1...f4, 8b2...a1"
              />
              <span class="kb-hint">{{ parsedMediaIds.length }} ID hợp lệ (UUID format)</span>
            </label>
          </template>

          <label class="kb-field">
            <span class="kb-label">Tags (phân cách bởi dấu phẩy)</span>
            <input v-model="editing.tagsRaw" type="text" placeholder="bảng-giá, sản-phẩm, 2026" maxlength="500" />
          </label>

          <label class="kb-field">
            <span class="kb-label">URL nguồn (tùy chọn)</span>
            <input v-model="editing.sourceUrl" type="text" placeholder="https://docs.example.com/..." maxlength="500" />
          </label>
        </div>
        <footer class="kb-modal-foot">
          <button class="kb-btn kb-btn--ghost" :disabled="saving" @click="closeEdit">Huỷ</button>
          <button class="kb-btn kb-btn--primary" :disabled="saving || !canSave" @click="save">
            <v-progress-circular v-if="saving" indeterminate :size="14" :width="2" />
            <span v-else>{{ editing.id ? 'Lưu & re-embed' : 'Tạo & embed' }}</span>
          </button>
        </footer>
      </div>
    </div>

    <!-- Preview chunks modal -->
    <div v-if="previewDoc" class="kb-modal-overlay" role="dialog" aria-modal="true" @click.self="previewDoc = null">
      <div class="kb-modal kb-modal--wide">
        <header class="kb-modal-head">
          <h3>{{ previewDoc.title }} — {{ previewDoc.chunkCount }} chunk{{ previewDoc.chunkCount === 1 ? '' : 's' }}</h3>
          <button class="kb-icon-btn" @click="previewDoc = null" aria-label="Đóng">
            <v-icon icon="mdi-close" size="18" />
          </button>
        </header>
        <div class="kb-modal-body">
          <div v-for="c in previewDoc.chunks" :key="c.id" class="kb-chunk">
            <div class="kb-chunk-head">
              <span class="kb-chunk-num">#{{ c.ordinal + 1 }}</span>
              <span class="kb-chunk-meta">{{ c.text.length }} chars</span>
              <button v-if="previewDoc.chunks.length > 1" class="kb-icon-btn" title="Copy chunk" @click="copyChunk(c.text)">
                <v-icon icon="mdi-content-copy" size="13" />
              </button>
            </div>
            <pre class="kb-chunk-text">{{ c.text }}</pre>
          </div>
        </div>
      </div>
    </div>

    <transition name="kb-fade">
      <div v-if="toast" class="kb-toast" :class="`kb-toast--${toast.kind}`">{{ toast.text }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  listKbDocs, getKbDoc, createKbDoc, updateKbDoc, deleteKbDoc, reembedKbDoc,
  type KnowledgeDocKind, type KnowledgeDocListItem, type KnowledgeDocDetail,
} from '@/api/knowledge';

const docs = ref<KnowledgeDocListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const reembeddingId = ref<string | null>(null);
const search = ref('');
const kindFilter = ref<'' | KnowledgeDocKind>('');
const includeInactive = ref(false);

const editing = ref<null | {
  id?: string;
  title: string;
  kind: KnowledgeDocKind;
  text: string;
  tagsRaw: string;
  sourceUrl: string;
  mediaAssetIdsRaw: string;
  faqQ: string;
  faqA: string;
}>(null);

const previewDoc = ref<KnowledgeDocDetail | null>(null);
const toast = ref<{ kind: 'ok' | 'err'; text: string } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(kind: 'ok' | 'err', text: string) {
  toast.value = { kind, text };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 3000);
}

function debouncedReload() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(reload, 300);
}

async function reload() {
  loading.value = true;
  try {
    const res = await listKbDocs({
      search: search.value || undefined,
      kind: (kindFilter.value || undefined) as KnowledgeDocKind | undefined,
      includeInactive: includeInactive.value,
      limit: 100,
    });
    docs.value = res.items;
    total.value = res.total;
  } catch (e: any) {
    showToast('err', e?.response?.data?.error || 'Tải kho tri thức thất bại');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = {
    title: '', kind: 'markdown', text: '', tagsRaw: '', sourceUrl: '',
    mediaAssetIdsRaw: '', faqQ: '', faqA: '',
  };
}
function openEdit(doc: KnowledgeDocListItem) {
  // Load full doc (with chunks text) để prefill content.
  getKbDoc(doc.id).then((full) => {
    const mediaRaw = (full.mediaAssetIds || []).join(', ');
    const tagsRaw = (full.tags || []).join(', ');
    let text = '';
    let faqQ = '';
    let faqA = '';
    if (full.kind === 'faq') {
      const last = full.chunks[full.chunks.length - 1];
      if (last) {
        const m = last.text.match(/^## Câu hỏi:\s*(.+?)\n\n([\s\S]+)$/);
        if (m) { faqQ = m[1]; faqA = m[2]; }
        else { faqA = last.text; }
      }
    } else {
      // Markdown: ghép lại từ chunks (gần đúng).
      text = full.chunks.map((c) => c.text).join('\n\n');
    }
    editing.value = {
      id: full.id,
      title: full.title,
      kind: full.kind,
      text,
      tagsRaw,
      sourceUrl: full.sourceUrl || '',
      mediaAssetIdsRaw: mediaRaw,
      faqQ,
      faqA,
    };
  }).catch(() => showToast('err', 'Không tải được nội dung tài liệu'));
}
function closeEdit() { editing.value = null; }

const parsedMediaIds = computed(() => {
  if (!editing.value) return [];
  return (editing.value.mediaAssetIdsRaw || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
});

const canSave = computed(() => {
  if (!editing.value) return false;
  if (!editing.value.title.trim()) return false;
  if (editing.value.kind === 'markdown') return editing.value.text.trim().length > 0;
  if (editing.value.kind === 'faq') return editing.value.faqQ.trim() && editing.value.faqA.trim();
  return parsedMediaIds.value.length > 0 || editing.value.text.trim();
});

async function save() {
  if (!editing.value) return;
  saving.value = true;
  try {
    const tags = (editing.value.tagsRaw || '').split(',').map((t) => t.trim()).filter(Boolean);
    const mediaAssetIds = parsedMediaIds.value;
    let payload: Parameters<typeof createKbDoc>[0] | Parameters<typeof updateKbDoc>[1];
    if (editing.value.kind === 'faq') {
      payload = {
        title: editing.value.title.trim(),
        kind: 'faq',
        faq: { question: editing.value.faqQ.trim(), answer: editing.value.faqA.trim() },
        tags,
        sourceUrl: editing.value.sourceUrl.trim() || undefined,
      };
    } else if (editing.value.kind === 'markdown') {
      payload = {
        title: editing.value.title.trim(),
        kind: 'markdown',
        text: editing.value.text,
        tags,
        sourceUrl: editing.value.sourceUrl.trim() || undefined,
      };
    } else {
      payload = {
        title: editing.value.title.trim(),
        kind: 'media_collection',
        text: editing.value.text || undefined,
        mediaAssetIds,
        tags,
        sourceUrl: editing.value.sourceUrl.trim() || undefined,
      };
    }
    let res: { ok: boolean; chunks: number; partial?: boolean; warning?: string };
    if (editing.value.id) {
      res = await updateKbDoc(editing.value.id, payload);
    } else {
      res = await createKbDoc(payload as Parameters<typeof createKbDoc>[0]);
    }
    if (res.partial) {
      showToast('err', res.warning || 'Embed không thành công. Thử re-embed.');
    } else {
      showToast('ok', `${editing.value.id ? 'Đã cập nhật' : 'Đã tạo'} — ${res.chunks} chunks`);
    }
    editing.value = null;
    reload();
  } catch (e: any) {
    showToast('err', e?.response?.data?.error || 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function onReembed(doc: KnowledgeDocListItem) {
  reembeddingId.value = doc.id;
  try {
    const r = await reembedKbDoc(doc.id);
    showToast('ok', `Re-embed ${r.chunks} chunks`);
    reload();
  } catch (e: any) {
    showToast('err', e?.response?.data?.error || 'Re-embed thất bại');
  } finally {
    reembeddingId.value = null;
  }
}

async function onDelete(doc: KnowledgeDocListItem) {
  if (!confirm(`Xoá tài liệu "${doc.title}"?\n\nTài liệu sẽ được đánh dấu đã xoá (vẫn có thể khôi phục trong DB).`)) return;
  try {
    await deleteKbDoc(doc.id);
    showToast('ok', 'Đã xoá');
    reload();
  } catch (e: any) {
    showToast('err', e?.response?.data?.error || 'Xoá thất bại');
  }
}

async function openPreview(doc: KnowledgeDocListItem) {
  try {
    previewDoc.value = await getKbDoc(doc.id);
  } catch (e: any) {
    showToast('err', 'Không tải được chunks');
  }
}

async function copyChunk(text: string) {
  try { await navigator.clipboard.writeText(text); showToast('ok', 'Đã copy chunk'); }
  catch { showToast('err', 'Clipboard không khả dụng'); }
}

function kindIcon(k: KnowledgeDocKind): string {
  if (k === 'markdown') return 'mdi-language-markdown-outline';
  if (k === 'faq') return 'mdi-frequently-asked-questions';
  return 'mdi-image-multiple-outline';
}
function kindLabel(k: KnowledgeDocKind): string {
  if (k === 'markdown') return 'Markdown';
  if (k === 'faq') return 'FAQ';
  return 'Bộ sưu tập';
}
function formatDate(s: string): string {
  try { return new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

onMounted(reload);
onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.kb-page { padding: 24px 28px; max-width: 1100px; }
.kb-header { margin-bottom: 20px; }
.kb-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.kb-title { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #1F2D3D; }
.kb-sub { color: #6B7280; margin: 0; font-size: 13.5px; max-width: 640px; line-height: 1.5; }

.kb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.kb-search { position: relative; flex: 1; min-width: 220px; display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: white; border: 1px solid #E4E5E9; border-radius: 8px; }
.kb-search:focus-within { border-color: #5E6AD2; box-shadow: 0 0 0 2px rgba(94,106,210,0.1); }
.kb-search input { border: none; outline: none; flex: 1; font-size: 13.5px; background: transparent; }
.kb-clear { background: transparent; border: none; cursor: pointer; color: #97A0AC; font-size: 14px; padding: 0 4px; }
.kb-select { padding: 7px 10px; border: 1px solid #E4E5E9; border-radius: 8px; background: white; font-size: 13px; cursor: pointer; }
.kb-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4B5563; cursor: pointer; }
.kb-count { font-size: 12.5px; color: #97A0AC; margin-left: auto; }

.kb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.kb-btn--primary { background: #5E6AD2; color: white; }
.kb-btn--primary:hover:not(:disabled) { background: #4F5BBE; }
.kb-btn--ghost { background: transparent; border-color: #E4E5E9; color: #4B5563; }
.kb-btn--ghost:hover:not(:disabled) { background: #F4F4F7; }
.kb-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.kb-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: #6B7280; font-size: 13.5px; }
.kb-empty { text-align: center; padding: 60px 20px; background: white; border: 1px dashed #E4E5E9; border-radius: 12px; }
.kb-empty-title { font-size: 17px; font-weight: 600; color: #1F2D3D; margin: 12px 0 6px; }
.kb-empty-sub { font-size: 13.5px; color: #6B7280; line-height: 1.6; margin-bottom: 20px; }

.kb-list { display: flex; flex-direction: column; gap: 12px; }
.kb-card { background: white; border: 1px solid #E4E5E9; border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s; }
.kb-card:hover { border-color: #C7C9D1; }
.kb-card--inactive { opacity: 0.6; background: #FAFAFC; }
.kb-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
.kb-card-title-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.kb-card-title { font-size: 15px; font-weight: 600; margin: 0; color: #1F2D3D; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.kb-icon-btn { width: 30px; height: 30px; border-radius: 6px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6B7280; transition: all 0.15s; }
.kb-icon-btn:hover:not(:disabled) { background: #F4F4F7; color: #1F2D3D; }
.kb-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.kb-icon-btn--danger:hover { background: #FEE2E2; color: #DC2626; }

.kb-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.kb-meta-item { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #6B7280; }
.kb-pill { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 500; }
.kb-pill--kind { background: #EEF2FF; color: #5E6AD2; }
.kb-pill--grey { background: #F4F4F7; color: #6B7280; }

.kb-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.kb-tag { font-size: 11.5px; color: #5E6AD2; background: #EEF2FF; padding: 2px 8px; border-radius: 999px; }

.kb-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.kb-modal { background: white; border-radius: 12px; width: 100%; max-width: 640px; max-height: calc(100vh - 40px); display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.kb-modal--wide { max-width: 820px; }
.kb-modal-head { padding: 16px 20px; border-bottom: 1px solid #E4E5E9; display: flex; justify-content: space-between; align-items: center; }
.kb-modal-head h3 { margin: 0; font-size: 16px; font-weight: 600; }
.kb-modal-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
.kb-modal-foot { padding: 12px 20px; border-top: 1px solid #E4E5E9; display: flex; justify-content: flex-end; gap: 8px; }

.kb-field { display: flex; flex-direction: column; gap: 4px; }
.kb-label { font-size: 12.5px; font-weight: 500; color: #4B5563; }
.kb-field input, .kb-field textarea, .kb-field select { padding: 8px 10px; border: 1px solid #E4E5E9; border-radius: 6px; font-size: 13px; font-family: inherit; outline: none; transition: border-color 0.15s; }
.kb-field input:focus, .kb-field textarea:focus, .kb-field select:focus { border-color: #5E6AD2; box-shadow: 0 0 0 2px rgba(94,106,210,0.1); }
.kb-field textarea { resize: vertical; min-height: 60px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; line-height: 1.5; }
.kb-hint { font-size: 11.5px; color: #97A0AC; }

.kb-chunk { border: 1px solid #E4E5E9; border-radius: 8px; padding: 10px 12px; background: #FAFAFC; margin-bottom: 10px; }
.kb-chunk-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.kb-chunk-num { font-size: 12px; font-weight: 600; color: #5E6AD2; }
.kb-chunk-meta { font-size: 11.5px; color: #97A0AC; }
.kb-chunk-head .kb-icon-btn { margin-left: auto; }
.kb-chunk-text { font-size: 13px; line-height: 1.55; color: #1F2D3D; white-space: pre-wrap; word-break: break-word; margin: 0; font-family: inherit; }

.kb-toast { position: fixed; top: 72px; right: 20px; padding: 10px 14px; border-radius: 8px; font-size: 13px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.kb-toast--ok { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
.kb-toast--err { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
.kb-fade-enter-active, .kb-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.kb-fade-enter-from, .kb-fade-leave-to { opacity: 0; transform: translateY(-4px); }

@media (max-width: 768px) {
  .kb-page { padding: 16px; }
  .kb-title-row { flex-direction: column; }
  .kb-modal { max-height: 90vh; }
}
</style>
