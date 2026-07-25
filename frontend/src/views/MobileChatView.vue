<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  MobileChatView (2026-07-26 redesign clean) — UX tối ưu cho mobile < 768px.
  Layout 1-cột stack: list ↔ thread (điều hướng back).
  Tính năng:
   - AI suggest: nút ✨ trong thread → gọi /ai/suggest → pill "Dùng" chèn vào input.
   - AI auto-reply: toggle bật/tắt ở header thread. Bật → worker BE tự gửi sau 30s không reply.
   - Search: ô search dính trên cùng, filter sub-tab ngay dưới (Tất cả / Chưa đọc / Của tôi).
-->
<template>
  <div class="mc-root">
    <!-- ════════ STATE 1: CONVERSATION LIST ════════ -->
    <div v-if="!selectedConvId" class="mc-list">
      <header class="mc-topbar">
        <div class="mc-brand">
          <div class="mc-logo"><v-icon size="18" color="white">mdi-message-text</v-icon></div>
          <span class="mc-title">Tin nhắn</span>
        </div>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="reload">
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
      </header>

      <div class="mc-search">
        <v-text-field
          v-model="searchQuery"
          placeholder="Tìm khách hàng..."
          prepend-inner-icon="mdi-magnify"
          variant="filled"
          density="compact"
          hide-details
          clearable
          rounded="lg"
          @update:model-value="onSearch"
        />
      </div>

      <div class="mc-filters">
        <button
          v-for="tab in listTabs"
          :key="tab.value"
          class="mc-tab"
          :class="{ active: listTab === tab.value }"
          @click="listTab = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.count > 0" class="mc-tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="loadingConvs" class="mc-empty">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <div v-else-if="!filteredConvs.length" class="mc-empty">
        <v-icon size="48" color="grey">mdi-message-outline</v-icon>
        <div class="mt-2 text-grey">Chưa có hội thoại nào</div>
      </div>
      <div v-else class="mc-conv-scroll">
        <button
          v-for="c in filteredConvs"
          :key="c.id"
          class="mc-conv-row"
          :class="{ unread: (c.unreadCount ?? 0) > 0 }"
          @click="selectConversation(c.id)"
        >
          <v-avatar size="44" :color="avatarColor(c.id)" class="mr-3">
            <span class="text-white font-weight-bold">{{ initials(c.contact?.fullName) }}</span>
          </v-avatar>
          <div class="mc-conv-info">
            <div class="mc-conv-name">{{ c.contact?.fullName || 'Khách lạ' }}</div>
            <div class="mc-conv-preview">
              {{ c.lastMessagePreview || 'Chưa có tin nhắn' }}
            </div>
          </div>
          <div class="mc-conv-meta">
            <div class="mc-conv-time">{{ formatTime(c.lastMessageAt) }}</div>
            <span v-if="(c.unreadCount ?? 0) > 0" class="mc-unread-badge">{{ c.unreadCount }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ════════ STATE 2: MESSAGE THREAD ════════ -->
    <div v-else class="mc-thread">
      <!-- Header -->
      <header class="mc-thread-header">
        <v-btn icon variant="text" size="small" @click="goBack" aria-label="Quay lại">
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>
        <div class="mc-thread-info">
          <div class="mc-thread-name">{{ selectedConv?.contact?.fullName || 'Hội thoại' }}</div>
          <div class="mc-thread-sub">{{ selectedConv?.contact?.phone || selectedConv?.zaloAccount?.displayName || '' }}</div>
        </div>
        <v-spacer />
        <!-- AI Auto-reply toggle -->
        <button
          class="mc-ai-toggle"
          :class="{ on: autoReplyEnabled }"
          :title="autoReplyEnabled ? 'AI đang bật — tự reply sau 30s nếu bạn không phản hồi' : 'AI tự động trả lời'"
          :aria-pressed="autoReplyEnabled"
          @click="toggleAutoReply"
        >
          <v-icon size="18">mdi-robot-outline</v-icon>
          <span class="mc-ai-toggle-dot" />
        </button>
      </header>

      <MessageThread
        :conversation="selectedConv"
        :messages="allMessages"
        :loading="loadingMsgs"
        :sending="sendingMsg"
        :ai-suggestion="aiSuggestion"
        :ai-suggestion-loading="aiSuggestionLoading"
        :ai-suggestion-error="aiSuggestionError"
        :show-contact-panel="false"
        @send="handleSend"
        @ask-ai="generateAiSuggestion"
        @refresh-thread="fetchMessages(selectedConvId)"
        class="mc-thread-body"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageThread from '@/components/chat/MessageThread.vue';
import { useChat } from '@/composables/use-chat';
import { useOfflineQueue } from '@/composables/use-offline-queue';
import { api } from '@/api/index';
import { useToast } from '@/composables/use-toast';

const router = useRouter();
const toast = useToast();

const {
  conversations, selectedConvId, selectedConv, messages,
  loadingConvs, loadingMsgs, sendingMsg, searchQuery, accountFilter,
  aiSuggestion, aiSuggestionLoading, aiSuggestionError,
  fetchConversations, fetchMessages, selectConversation, sendMessage, sendMessageTo,
  generateAiSuggestion, initSocket, destroySocket, clearAiState,
} = useChat();

const { pendingMessages, enqueue, flush } = useOfflineQueue();

// Filter tab cho list
type ListTab = 'all' | 'unread';
const listTab = ref<ListTab>('all');
const listTabs = computed(() => [
  { value: 'all' as ListTab, label: 'Tất cả', count: conversations.value.length },
  { value: 'unread' as ListTab, label: 'Chưa đọc', count: conversations.value.filter((c) => (c.unreadCount ?? 0) > 0).length },
]);

const filteredConvs = computed(() => {
  if (listTab.value === 'unread') return conversations.value.filter((c) => (c.unreadCount ?? 0) > 0);
  return conversations.value;
});

// Helpers
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}
function avatarColor(id: string): string {
  // Stable color from id hash
  const colors = ['#0077B6', '#00B894', '#6C5CE7', '#E17055', '#0984E3', '#FDCB6E'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}
function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  const day = 24 * 3600 * 1000;
  if (diff < day && dt.getDate() === now.getDate()) return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  if (diff < 2 * day) return 'Hôm qua';
  return `${dt.getDate()}/${dt.getMonth() + 1}`;
}

// Merge offline pending
const allMessages = computed(() => {
  const pending = pendingMessages.value
    .filter((p) => p.conversationId === selectedConvId.value)
    .map((p) => ({
      id: p.id, content: p.content, contentType: 'text',
      senderType: 'self', senderName: null, sentAt: p.createdAt,
      isDeleted: false, zaloMsgId: null, albumKey: null,
      albumIndex: null, albumTotal: null, _pending: true,
    }));
  return [...messages.value, ...pending];
});

function goBack() {
  selectedConvId.value = null;
  clearAiState();
}
function reload() {
  fetchConversations();
}
async function handleSend(content: string, replyMessageId?: string | null) {
  if (!selectedConvId.value) return;
  if (!navigator.onLine) {
    enqueue(selectedConvId.value, content);
    toast('Đã lưu tin, sẽ gửi khi có mạng');
    return;
  }
  await sendMessage(content, replyMessageId);
  // Sau khi sale gửi thành công → bật auto-reply lại (worker sẽ cooldown 30s)
  if (autoReplyEnabled.value) {
    // Không cần làm gì — UI đã đồng bộ, worker sẽ tự skip nếu sale reply
  }
}
function onOnline() {
  flush(sendMessageTo);
}

// AI auto-reply toggle (per-conv)
const autoReplyEnabled = ref(false);
const autoReplyLoading = ref(false);
async function fetchAutoReply(): Promise<void> {
  if (!selectedConvId.value) return;
  try {
    const res = await api.get(`/conversations/${selectedConvId.value}/ai-auto-reply`);
    autoReplyEnabled.value = !!res.data.enabled;
  } catch {
    autoReplyEnabled.value = false;
  }
}
async function toggleAutoReply(): Promise<void> {
  if (!selectedConvId.value || autoReplyLoading.value) return;
  const next = !autoReplyEnabled.value;
  autoReplyLoading.value = true;
  // Optimistic
  const prev = autoReplyEnabled.value;
  autoReplyEnabled.value = next;
  try {
    const res = await api.patch(`/conversations/${selectedConvId.value}/ai-auto-reply`, { enabled: next });
    autoReplyEnabled.value = !!res.data.enabled;
    toast[next ? 'success' : 'info'](
      next ? 'AI tự reply: BẬT — sau 30s không có reply sẽ tự gửi' : 'AI tự reply: TẮT — chỉ gợi ý cho bạn',
    );
  } catch (err: any) {
    autoReplyEnabled.value = prev; // rollback
    toast.error('Không thể cập nhật: ' + (err.response?.data?.error ?? err.message));
  } finally {
    autoReplyLoading.value = false;
  }
}

// Khi đổi conv → load trạng thái auto-reply
watch(selectedConvId, async (id) => {
  if (id) await fetchAutoReply();
  else autoReplyEnabled.value = false;
});

let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchConversations(), 300);
});

onMounted(() => {
  fetchConversations();
  initSocket();
  window.addEventListener('online', onOnline);
});
onUnmounted(() => {
  destroySocket();
  window.removeEventListener('online', onOnline);
  clearTimeout(searchTimeout);
});
</script>

<style scoped>
.mc-root {
  display: flex; flex-direction: column;
  height: calc(100vh - 56px - 72px); /* trừ appbar + bottom nav */
  background: #f7f8fb;
}
.mc-topbar {
  display: flex; align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eef0f4;
}
.mc-brand { display: flex; align-items: center; gap: 10px; }
.mc-logo {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #00b4ff, #0077b6);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.mc-title { font-size: 18px; font-weight: 700; color: #0c2233; }
.mc-search { padding: 12px 16px; background: white; }
.mc-search :deep(.v-field) { border-radius: 12px; }
.mc-filters {
  display: flex; gap: 6px;
  padding: 4px 12px 12px;
  background: white;
  border-bottom: 1px solid #eef0f4;
  overflow-x: auto;
}
.mc-tab {
  flex: none;
  padding: 8px 14px; border-radius: 999px;
  background: #f1f3f7; color: #4a5568;
  font-size: 13px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px;
  border: none; cursor: pointer;
}
.mc-tab.active {
  background: linear-gradient(135deg, #0077b6, #00b4ff); color: white;
}
.mc-tab-count {
  background: rgba(255,255,255,0.4);
  padding: 1px 6px; border-radius: 999px; font-size: 11px;
}
.mc-tab:not(.active) .mc-tab-count { background: #e2e8f0; color: #4a5568; }
.mc-empty {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 32px 16px;
}
.mc-conv-scroll { flex: 1; overflow-y: auto; }
.mc-conv-row {
  display: flex; align-items: center;
  width: 100%; padding: 12px 16px;
  background: white; border: none; border-bottom: 1px solid #f1f3f7;
  cursor: pointer; text-align: left;
}
.mc-conv-row:active { background: #f7f8fb; }
.mc-conv-info { flex: 1; min-width: 0; }
.mc-conv-name {
  font-size: 14px; font-weight: 600; color: #0c2233;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mc-conv-preview {
  font-size: 12px; color: #6b7280;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
}
.mc-conv-meta {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  margin-left: 8px; min-width: 50px;
}
.mc-conv-time { font-size: 11px; color: #9ca3af; }
.mc-unread-badge {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white; font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 999px;
}
.mc-conv-row.unread .mc-conv-name { color: #0077b6; }

/* Thread */
.mc-thread { display: flex; flex-direction: column; height: 100%; }
.mc-thread-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: white;
  border-bottom: 1px solid #eef0f4;
}
.mc-thread-info { display: flex; flex-direction: column; min-width: 0; }
.mc-thread-name { font-size: 15px; font-weight: 600; color: #0c2233; line-height: 1.2; }
.mc-thread-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.mc-ai-toggle {
  position: relative;
  width: 40px; height: 40px;
  border-radius: 12px;
  background: #f1f3f7;
  color: #6b7280;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.mc-ai-toggle.on {
  background: linear-gradient(135deg, #a855f7, #6366f1);
  color: white;
}
.mc-ai-toggle-dot {
  position: absolute;
  top: 6px; right: 6px;
  width: 8px; height: 8px;
  background: #22c55e;
  border-radius: 50%;
  border: 2px solid white;
}
.mc-thread-body { flex: 1; min-height: 0; }
</style>
