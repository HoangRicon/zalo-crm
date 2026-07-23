<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  KbQaPanel — 2026-07-24 — panel hỏi đáp trực tiếp kho tri thức trong chat.
  Hiển thị dạng popup/dropdown gắn vào toolbar chat (icon 🔍).
  Xem openspec/changes/add-knowledge-base-and-chat-drag/.
-->
<template>
  <div v-if="modelValue" class="kbq-overlay" role="dialog" aria-modal="true" aria-labelledby="kbq-title" @click.self="close">
    <div class="kbq-panel">
      <header class="kbq-head">
        <h3 id="kbq-title" class="kbq-title">
          <v-icon icon="mdi-book-search-outline" size="20" color="primary" />
          Hỏi kho tri thức
        </h3>
        <button class="kbq-close" aria-label="Đóng" @click="close">
          <v-icon icon="mdi-close" size="18" />
        </button>
      </header>

      <div class="kbq-suggest" v-if="suggestions.length">
        <span class="kbq-suggest-label">Gợi ý:</span>
        <button v-for="s in suggestions" :key="s" class="kbq-suggest-chip" @click="ask(s)">{{ s }}</button>
      </div>

      <form class="kbq-form" @submit.prevent="submit">
        <textarea
          ref="inputEl"
          v-model="question"
          class="kbq-input"
          rows="2"
          maxlength="1000"
          placeholder="VD: Sản phẩm X có chống nước không?"
          @keydown.enter.exact.prevent="submit"
        />
        <button type="submit" class="kbq-submit" :disabled="loading || !question.trim()">
          <v-progress-circular v-if="loading" indeterminate :size="14" :width="2" />
          <span v-else>Hỏi</span>
        </button>
      </form>

      <div class="kbq-body">
        <div v-if="!answer && !loading && !error" class="kbq-empty">
          <v-icon icon="mdi-database-search-outline" size="48" color="grey-lighten-1" />
          <div>Nhập câu hỏi để tìm trong kho tri thức của org.</div>
        </div>
        <div v-else-if="loading" class="kbq-loading">
          <v-progress-circular indeterminate color="primary" :size="24" :width="3" />
          <span>Đang tra cứu…</span>
        </div>
        <div v-else-if="error" class="kbq-error">
          <v-icon icon="mdi-alert-circle-outline" size="20" />
          {{ error }}
        </div>
        <template v-else>
          <div class="kbq-answer">
            <div class="kbq-answer-label">
              <v-icon icon="mdi-robot-outline" size="14" />
              Trả lời:
            </div>
            <div class="kbq-answer-text">{{ answer }}</div>
          </div>
          <div v-if="images.length" class="kbq-images">
            <div class="kbq-images-label">
              <v-icon icon="mdi-image-multiple-outline" size="14" />
              Ảnh liên quan:
            </div>
            <div class="kbq-images-grid">
              <div v-for="id in images.slice(0, 6)" :key="id" class="kbq-image-slot">
                <KbImagePreview :asset-id="id" />
              </div>
            </div>
          </div>
          <div v-if="sources.length" class="kbq-sources">
            <div class="kbq-sources-label">
              <v-icon icon="mdi-link-variant" size="14" />
              Nguồn ({{ sources.length }}):
            </div>
            <div
              v-for="(src, i) in sources"
              :key="`${src.docId}-${src.ordinal}`"
              class="kbq-source"
            >
              <span class="kbq-source-num">[{{ i + 1 }}]</span>
              <span class="kbq-source-title">{{ src.docTitle }}</span>
              <span class="kbq-source-score">score {{ src.score.toFixed(2) }}</span>
              <div class="kbq-source-snippet">{{ src.textSnippet }}</div>
            </div>
          </div>
          <div v-if="!noMatch" class="kbq-actions">
            <button class="kbq-action" @click="copyAnswer">
              <v-icon icon="mdi-content-copy" size="14" /> Copy trả lời
            </button>
            <button class="kbq-action kbq-action--primary" @click="insertAnswer">
              <v-icon icon="mdi-arrow-down-bold-box-outline" size="14" /> Chèn vào ô chat
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { kbQa, type KbQaResponse } from '@/api/knowledge';
import KbImagePreview from './KbImagePreview.vue';

const props = defineProps<{
  modelValue: boolean;
  defaultQuestion?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  insert: [text: string];
}>();

const question = ref('');
const answer = ref('');
const sources = ref<KbQaResponse['sources']>([]);
const images = ref<string[]>([]);
const noMatch = ref(false);
const loading = ref(false);
const error = ref('');
const inputEl = ref<HTMLTextAreaElement | null>(null);

const suggestions = [
  'Bảng giá 2026',
  'Chính sách bảo hành',
  'Sản phẩm nào phù hợp cho dân văn phòng?',
];

function close() {
  emit('update:modelValue', false);
}

function ask(s: string) {
  question.value = s;
  submit();
}

async function submit() {
  const q = question.value.trim();
  if (!q || loading.value) return;
  loading.value = true;
  error.value = '';
  answer.value = '';
  sources.value = [];
  images.value = [];
  noMatch.value = false;
  try {
    const res = await kbQa(q);
    if (res.source === 'no_match') {
      answer.value = res.answer;
      noMatch.value = true;
    } else {
      answer.value = res.answer;
      sources.value = res.sources;
      images.value = res.images;
    }
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Tra cứu thất bại';
  } finally {
    loading.value = false;
  }
}

async function copyAnswer() {
  try { await navigator.clipboard.writeText(answer.value); }
  catch { /* ignore */ }
}

function insertAnswer() {
  emit('insert', answer.value);
  close();
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    question.value = props.defaultQuestion || '';
    answer.value = '';
    sources.value = [];
    images.value = [];
    images.value = [];
    noMatch.value = false;
    error.value = '';
    await nextTick();
    inputEl.value?.focus();
  }
});

// ESC đóng
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close();
}
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.kbq-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 9990; display: flex; align-items: center; justify-content: center; padding: 20px; }
.kbq-panel { background: white; border-radius: 12px; width: 100%; max-width: 620px; max-height: calc(100vh - 40px); display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
.kbq-head { padding: 14px 18px; border-bottom: 1px solid #E4E5E9; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.kbq-title { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.kbq-close { background: transparent; border: none; cursor: pointer; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #6B7280; }
.kbq-close:hover { background: #F4F4F7; color: #1F2D3D; }

.kbq-suggest { padding: 10px 18px; border-bottom: 1px solid #F0F1F4; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.kbq-suggest-label { font-size: 12px; color: #97A0AC; }
.kbq-suggest-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid #E4E5E9; background: white; font-size: 12px; cursor: pointer; transition: all 0.15s; color: #4B5563; }
.kbq-suggest-chip:hover { border-color: #5E6AD2; color: #5E6AD2; background: #EEF2FF; }

.kbq-form { display: flex; gap: 8px; padding: 12px 18px; border-bottom: 1px solid #E4E5E9; flex-shrink: 0; }
.kbq-input { flex: 1; padding: 8px 10px; border: 1px solid #E4E5E9; border-radius: 6px; font-size: 13.5px; font-family: inherit; resize: vertical; min-height: 44px; line-height: 1.5; outline: none; }
.kbq-input:focus { border-color: #5E6AD2; box-shadow: 0 0 0 2px rgba(94,106,210,0.1); }
.kbq-submit { padding: 0 16px; border-radius: 6px; border: none; background: #5E6AD2; color: white; font-size: 13px; font-weight: 500; cursor: pointer; min-width: 60px; }
.kbq-submit:hover:not(:disabled) { background: #4F5BBE; }
.kbq-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.kbq-body { padding: 14px 18px; overflow-y: auto; flex: 1; }
.kbq-empty { text-align: center; color: #97A0AC; padding: 32px 12px; font-size: 13.5px; }
.kbq-empty .v-icon { margin-bottom: 8px; }
.kbq-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 28px; color: #6B7280; font-size: 13.5px; }
.kbq-error { display: flex; align-items: center; gap: 8px; padding: 14px; background: #FEF2F2; color: #B91C1C; border-radius: 8px; font-size: 13px; }

.kbq-answer { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
.kbq-answer-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #0369A1; margin-bottom: 6px; }
.kbq-answer-text { font-size: 13.5px; line-height: 1.6; color: #1F2D3D; white-space: pre-wrap; }

.kbq-images { margin-bottom: 12px; }
.kbq-images-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #4B5563; margin-bottom: 6px; }
.kbq-images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 6px; }
.kbq-image-slot { aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #F4F4F7; }

.kbq-sources { border-top: 1px solid #E4E5E9; padding-top: 12px; }
.kbq-sources-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #4B5563; margin-bottom: 8px; }
.kbq-source { padding: 8px 10px; background: #FAFAFC; border-radius: 6px; margin-bottom: 6px; font-size: 12.5px; }
.kbq-source-num { color: #5E6AD2; font-weight: 600; margin-right: 4px; }
.kbq-source-title { font-weight: 500; color: #1F2D3D; }
.kbq-source-score { float: right; color: #97A0AC; font-size: 11.5px; }
.kbq-source-snippet { color: #6B7280; margin-top: 4px; line-height: 1.5; font-size: 12px; }

.kbq-actions { display: flex; gap: 8px; margin-top: 12px; }
.kbq-action { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 6px; border: 1px solid #E4E5E9; background: white; cursor: pointer; font-size: 12.5px; color: #4B5563; }
.kbq-action:hover { background: #F4F4F7; }
.kbq-action--primary { background: #5E6AD2; color: white; border-color: #5E6AD2; }
.kbq-action--primary:hover { background: #4F5BBE; }
</style>
