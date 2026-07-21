<template>
  <transition name="fade">
    <div v-if="open" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>✨ AI gợi ý khối nội dung</h3>
          <button class="btn-close" @click="$emit('close')">×</button>
        </div>
        <div class="modal-body">
          <label class="f-label">Mục đích / ngữ cảnh</label>
          <textarea
            v-model="userIntent"
            rows="3"
            maxlength="500"
            placeholder="VD: Gửi cho KH quan tâm căn 3PN quận 7 tháng trước, giọng thân thiện"
            class="f-input"
            :disabled="loading"
          />
          <div class="hint-row">
            <label class="count-row">
              Số mẫu:
              <select v-model.number="count" class="count-select" :disabled="loading">
                <option :value="3">3</option>
                <option :value="4">4</option>
                <option :value="5">5</option>
              </select>
            </label>
            <button
              class="btn btn-primary btn-sm"
              :disabled="!userIntent.trim() || loading"
              @click="fetchSuggestions"
            >
              <v-icon size="14">mdi-sparkles</v-icon>
              {{ loading ? 'Đang tạo…' : 'Gợi ý' }}
            </button>
          </div>

          <div v-if="source === 'fallback' && suggestions.length" class="ai-note">
            🤖 AI tắt hoặc lỗi — dùng {{ suggestions.length }} template có sẵn.
          </div>

          <div v-if="suggestions.length" class="suggestions-list">
            <div v-for="(s, i) in suggestions" :key="i" class="suggestion-card">
              <div class="suggestion-head">
                <strong>{{ s.name }}</strong>
                <button class="btn btn-primary btn-xs" @click="selectSuggestion(s)">Chọn</button>
              </div>
              <div class="suggestion-text">{{ s.messageText }}</div>
              <div v-if="s.imageKeyword" class="suggestion-kw">📷 {{ s.imageKeyword }}</div>
            </div>
          </div>

          <div v-if="error" class="error-msg">{{ error }}</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; selected: [s: { name: string; messageText: string; imageKeyword?: string }] }>();

const userIntent = ref('');
const count = ref(4);
const loading = ref(false);
const suggestions = ref<Array<{ name: string; messageText: string; imageKeyword?: string }>>([]);
const source = ref<'ai' | 'fallback' | null>(null);
const error = ref('');

async function fetchSuggestions() {
  if (!userIntent.value.trim()) return;
  loading.value = true;
  error.value = '';
  suggestions.value = [];
  source.value = null;
  try {
    const res = await api.post('/api/v1/ai/suggest-content-blocks', {
      userIntent: userIntent.value,
      count: count.value,
    });
    suggestions.value = res.data.suggestions ?? [];
    source.value = res.data.source ?? 'fallback';
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? 'Lỗi không xác định';
  } finally {
    loading.value = false;
  }
}

function selectSuggestion(s: { name: string; messageText: string; imageKeyword?: string }) {
  emit('selected', s);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--bg-surface, #fff);
  border-radius: 12px;
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  overflow: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.modal-header h3 {
  margin: 0;
}
.btn-close {
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
}
.f-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
}
.f-input {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 8px 10px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}
.hint-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10px 0 12px;
}
.count-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.count-select {
  border-radius: 4px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 2px 6px;
}
.ai-note {
  background: var(--accent-bg, #fef3c7);
  color: var(--accent-text, #92400e);
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 13px;
}
.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.suggestion-card {
  background: var(--bg-subtle, #f8fafc);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}
.suggestion-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.btn-xs {
  font-size: 11px;
  padding: 3px 8px;
}
.suggestion-text {
  background: var(--bg-surface, #fff);
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 3px solid var(--accent, #10b981);
  font-size: 13px;
  white-space: pre-wrap;
  margin-bottom: 4px;
}
.suggestion-kw {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}
.error-msg {
  color: #b91c1c;
  font-size: 13px;
  padding: 6px 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
