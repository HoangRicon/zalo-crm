<template>
  <transition name="fade">
    <div v-if="open" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>👁 Xem trước</h3>
          <button class="btn-close" @click="$emit('close')">×</button>
        </div>
        <div v-if="loading" class="modal-body loading">Đang tải mẫu…</div>
        <div v-else class="modal-body">
          <p class="hint">{{ samples.length }} mẫu KH sẽ nhận được:</p>
          <div v-for="(s, i) in samples" :key="i" class="sample">
            <div class="sample-meta">
              <strong>{{ s.recipientName }}</strong>
              <span v-if="s.recipientPhone" class="phone">{{ s.recipientPhone }}</span>
            </div>
            <div class="sample-message">{{ s.renderedMessage }}</div>
          </div>
          <div v-if="!samples.length" class="empty">
            Không có mẫu (danh sách rỗng hoặc nick chưa có bạn bè).
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{
  open: boolean;
  sourceType: 'customer_list' | 'friends';
  customerListId?: string;
  zaloAccountId: string;
  messageText: string;
  count?: number;
}>();
defineEmits<{ close: [] }>();

interface Sample {
  recipientName: string;
  recipientPhone: string | null;
  renderedMessage: string;
}

const samples = ref<Sample[]>([]);
const loading = ref(false);

watch(
  () => [props.open, props.messageText, props.zaloAccountId, props.customerListId, props.sourceType] as const,
  async ([open]) => {
    if (!open) return;
    if (!props.messageText?.trim() || !props.zaloAccountId) {
      samples.value = [];
      return;
    }
    loading.value = true;
    try {
      const res = await api.post('/broadcast/preview', {
        sourceType: props.sourceType,
        customerListId: props.customerListId,
        zaloAccountId: props.zaloAccountId,
        messageText: props.messageText,
        count: props.count ?? 3,
      });
      samples.value = res.data.samples ?? [];
    } catch (e) {
      console.error('[PreviewModal] load error', e);
      samples.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
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
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
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
  line-height: 1;
}
.modal-body {
  padding: 16px 20px;
}
.modal-body.loading {
  text-align: center;
  color: var(--text-muted, #64748b);
}
.hint {
  font-size: 13px;
  color: var(--text-muted, #64748b);
  margin: 0 0 12px;
}
.sample {
  background: var(--bg-subtle, #f8fafc);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.sample-meta {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 13px;
}
.phone {
  color: var(--text-muted, #64748b);
  font-size: 12px;
}
.sample-message {
  background: var(--bg-surface, #fff);
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--accent, #10b981);
  white-space: pre-wrap;
  font-size: 14px;
}
.empty {
  text-align: center;
  color: var(--text-muted, #64748b);
  padding: 24px;
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
