<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="ai-page">
    <header class="ai-page-header">
      <div>
        <h1 class="ai-page-title">🤖 Cấu hình Trợ lý AI</h1>
        <p class="ai-page-sub">Quản lý provider, prompt, và các tác vụ AI cho toàn bộ hệ thống.</p>
      </div>
      <div v-if="loading" class="loading-pill">⏳ Đang tải...</div>
    </header>

    <div v-if="config" class="ai-page-body">

      <!-- ═══════════════════════════════════════════════
           TAB NAVIGATION
      ═══════════════════════════════════════════════ -->
      <div class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- ═══════════════════════════════════════════════
           TAB 1: KẾT NỐI PROVIDER
      ═══════════════════════════════════════════════ -->
      <div v-show="activeTab === 'provider'" class="tab-panel">

        <div class="provider-card">
          <div class="section-title">
            <span>🔌 Kết nối AI Provider</span>
            <span class="section-hint">Chọn và cấu hình nhà cung cấp AI cho toàn hệ thống</span>
          </div>

          <div v-if="dockerDetected" class="docker-banner">
            🐳 Backend đang chạy trong Docker — nếu AI endpoint chạy ở máy host,
            dùng <code>http://host.docker.internal:PORT/v1</code> thay vì <code>localhost</code>.
          </div>

          <div class="field-group">
            <label class="field-label">Provider</label>
            <div class="provider-grid">
              <button
                v-for="p in providerList"
                :key="p.id"
                class="provider-btn"
                :class="{ selected: selectedProvider === p.id }"
                @click="selectProvider(p.id)"
              >
                <span class="p-icon">{{ p.icon }}</span>
                <span class="p-name">{{ p.name }}</span>
                <span v-if="p.hasKey" class="p-badge">✅ Đã cấu hình</span>
                <span v-else class="p-badge dim">⚠️ Chưa cấu hình</span>
              </button>
            </div>
          </div>

          <!-- Custom Provider fields -->
          <div v-if="selectedProvider === 'custom'" class="field-group">
            <label class="field-label">Base URL</label>
            <input v-model="customProvider.baseUrl" class="regex-input" placeholder="http://localhost:20128/v1" spellcheck="false" />
            <div class="field-hint">URL endpoint OpenAI-compatible. VD: <code>http://host.docker.internal:20128/v1</code> cho vLLM/Ollama</div>
            <!-- 2026-07-26: cảnh báo khi baseUrl chứa localhost/loopback — nếu app chạy trong
                 Docker container, 'localhost' trỏ về container (không phải host). Dùng
                 host.docker.internal (Docker Desktop) hoặc IP host. -->
            <div v-if="isLocalhostUrl" class="ai-warn" style="margin-top: 8px;">
              ⚠ Base URL chứa <code>localhost/127.0.0.1</code>. Nếu app chạy trong Docker,
              <code>localhost</code> trỏ về container, không phải host. Đổi sang
              <code>host.docker.internal</code> hoặc IP host (ví dụ <code>192.168.1.x</code>).
            </div>
          </div>

          <div v-if="selectedProvider === 'custom'" class="field-group">
            <label class="field-label">API Key</label>
            <div class="api-key-row">
              <input
                v-model="customProvider.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="regex-input"
                placeholder="sk-..."
                autocomplete="off"
              />
              <button class="btn-icon" @click="showApiKey = !showApiKey" :title="showApiKey ? 'Ẩn key' : 'Hiện key'">
                {{ showApiKey ? '🙈' : '👁️' }}
              </button>
            </div>
            <div class="field-hint" v-if="customProvider.hasKey">Key đã lưu ({{ customProvider.keyMask }}). Để trống nếu muốn giữ nguyên.</div>
            <div class="field-hint" v-else>Key sẽ được mã hoá AES-GCM khi lưu.</div>
          </div>

          <div v-if="selectedProvider === 'custom'" class="field-group">
            <label class="field-label">Model</label>
            <div class="model-row">
              <select v-model="customProvider.model" class="regex-input model-select">
                <option value="">— Chọn model —</option>
                <option v-for="m in modelOptions" :key="m.value" :value="m.value">{{ m.title }}</option>
              </select>
              <button class="btn-secondary btn-sm" @click="refetchModels" :disabled="loadingModels">
                {{ loadingModels ? '⏳' : '🔄' }} Models
              </button>
              <input
                v-if="!modelOptions.length"
                v-model="customProvider.model"
                class="regex-input"
                placeholder="cx/gpt-5.4"
                spellcheck="false"
              />
            </div>
            <div class="field-hint">Tên model trên endpoint. Bấm 🔄 để fetch danh sách từ endpoint.</div>
          </div>

          <div class="provider-actions">
            <button class="btn-secondary" @click="saveCustomProvider" :disabled="savingProvider">
              {{ savingProvider ? '⏳ Đang lưu...' : '💾 Lưu Provider' }}
            </button>
            <button class="btn-primary" @click="testCustomConnection" :disabled="testingConnection">
              {{ testingConnection ? '⏳ Đang test...' : '🧪 Test kết nối' }}
            </button>
          </div>

          <div v-if="connectionResult" class="connection-result" :class="{ ok: connectionResult.ok, err: !connectionResult.ok }">
            <span>{{ connectionResult.ok ? '✅' : '❌' }} {{ connectionResult.message }}</span>
            <span v-if="connectionResult.url" class="connection-url">{{ connectionResult.url }}</span>
          </div>
        </div>

        <!-- Quota settings -->
        <div class="field-group">
          <div class="section-title">
            <span>📊 Quota & Giới hạn</span>
          </div>
          <div class="quota-row">
            <div class="quota-field">
              <label class="field-label">Số lượt gọi AI mỗi ngày</label>
              <input v-model.number="config.maxDaily" type="number" min="1" max="10000" class="regex-input" />
              <div class="field-hint">Giới hạn số lần gọi AI mỗi ngày cho toàn tổ chức.</div>
            </div>
            <div class="quota-stats">
              <div class="quota-stat">
                <span class="qs-label">Đã dùng hôm nay</span>
                <span class="qs-value">{{ usage?.usedToday ?? 0 }}</span>
              </div>
              <div class="quota-stat">
                <span class="qs-label">Còn lại</span>
                <span class="qs-value" :class="{ danger: lowQuota }">{{ usage?.remaining ?? config.maxDaily }}</span>
              </div>
              <div class="quota-stat">
                <span class="qs-label">Reset lúc</span>
                <span class="qs-value">00:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════
           TAB 2: CHAT ASSISTANT (Virtual Chat)
      ═══════════════════════════════════════════════ -->
      <div v-show="activeTab === 'assistant'" class="tab-panel">

        <!-- Toggle & Noise pattern -->
        <div class="toggle-card">
          <label class="toggle-row">
            <input type="checkbox" v-model="config.aiAssistantEnabled" />
            <div>
              <div class="toggle-label">Bật Trợ lý AI Chat</div>
              <div class="toggle-hint">
                Khi tắt: virtual chat vẫn lưu nhật ký bình thường, nhưng AI sẽ không gợi ý + extract thông tin nữa.
              </div>
            </div>
          </label>
        </div>

        <div class="field-group">
          <label class="field-label">
            📝 Prompt mẫu cho Trợ lý AI Chat
            <span class="field-meta">(Admin edit để thay đổi cách AI nói chuyện với sale)</span>
          </label>
          <textarea
            v-model="config.aiAssistantPromptTemplate"
            class="prompt-editor"
            rows="22"
            spellcheck="false"
          />
          <div class="field-hint">
            Dùng markdown. Template mặc định ở dưới cùng. Lưu thay đổi sẽ áp dụng ngay cho mọi sale trong tổ chức.
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">
            ⏩ Quy tắc bỏ qua tin nhắn ngắn (regex)
            <span class="field-meta">(Tiết kiệm token — AI không trả lời tin "ok", "ờ", "uhm"…)</span>
          </label>
          <input
            v-model="config.aiAssistantSkipNoisePattern"
            class="regex-input mono"
            spellcheck="false"
          />
          <div class="field-hint">
            Tin nhắn matching regex này sẽ KHÔNG kích hoạt AI. Mặc định bỏ qua "ok", "ờ", "uhm"…
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button class="btn-danger-ghost" @click="restoreDefault" :disabled="saving">
            ↺ Khôi phục prompt mặc định
          </button>
          <button class="btn-primary" @click="save" :disabled="saving">
            {{ saving ? '⏳ Đang lưu...' : '💾 Lưu cài đặt' }}
          </button>
        </div>
        <div v-if="saveMessage" class="save-msg" :class="saveOk ? 'ok' : 'err'">{{ saveMessage }}</div>

        <!-- Default prompt preview -->
        <details class="default-prompt-preview">
          <summary>📋 Xem prompt mặc định</summary>
          <pre class="default-prompt-text">{{ config.defaultPrompt }}</pre>
        </details>
      </div>

      <!-- ═══════════════════════════════════════════════
           TAB 3: TÁC VỤ PHÂN TÍCH
      ═══════════════════════════════════════════════ -->
      <div v-show="activeTab === 'analysis'" class="tab-panel">

        <div class="section-title">
          <span>🔍 Tác vụ phân tích AI</span>
          <span class="section-hint">Bật/tắt các tác vụ AI phân tích hội thoại trong trang Chat</span>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">💡</span>
              <div>
                <div class="task-name">Gợi ý trả lời</div>
                <div class="task-desc">AI phân tích hội thoại và đề xuất tin nhắn trả lời phù hợp cho sale.</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.suggestEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Mô tả:</strong> Sale nhấn nút ✨ trong khung chat → AI đọc 40 tin gần nhất → trả về 1-3 gợi ý trả lời.
            AI luôn phản hồi bằng <strong>tiếng Việt</strong>.
          </div>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">📋</span>
              <div>
                <div class="task-name">Tóm tắt hội thoại</div>
                <div class="task-desc">AI tóm tắt nội dung cuộc trò chuyện thành 1 đoạn văn bản ngắn.</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.summaryEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Mô tả:</strong> Sale nhấn "Tóm tắt" trong tab AI của khung chat → AI đọc 40 tin gần nhất → trả về bản tóm tắt ngắn gọn.
            Tóm tắt luôn bằng <strong>tiếng Việt</strong>, tập trung vào: nhu cầu khách hàng, vấn đề, mức độ quan tâm, bước tiếp theo.
          </div>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">😊</span>
              <div>
                <div class="task-name">Phân tích cảm xúc</div>
                <div class="task-desc">AI đánh giá cảm xúc tổng thể của khách hàng (tích cực / trung tính / tiêu cực).</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.sentimentEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
          <strong>Mô tả:</strong> Sale nhấn "Cảm xúc" trong tab AI → AI phân tích toàn bộ hội thoại → trả về nhãn (Tích cực / Trung tính / Tiêu cực)
          kèm điểm tin cậy và lý do ngắn bằng <strong>tiếng Việt</strong>.
        </div>
        </div>

        <!-- 2026-07-26: Embedding Provider cho Kho tri thức (RAG-lite).
             Anthropic/Gemini/Qwen/Kimi không hỗ trợ embedding → user chọn 'openai' (mặc định)
             hoặc 'custom' (self-hosted OpenAI-compatible proxy) để chạy KB retrieval. -->
        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">📚</span>
              <div>
                <div class="task-name">Embedding Provider (Kho tri thức)</div>
                <div class="task-desc">
                  Provider dùng để tạo vector embedding cho KB.
                  Anthropic/Gemini/Qwen/Kimi không hỗ trợ — chọn OpenAI hoặc Custom.
                </div>
              </div>
            </div>
          </div>
          <div class="task-note">
            <strong>Cấu hình:</strong>
            <select v-model="taskConfig.embeddingProvider" class="ai-select">
              <option value="openai">OpenAI (mặc định — cần API key OpenAI)</option>
              <option value="custom">Custom Endpoint (dùng baseUrl + key của custom provider)</option>
            </select>
            <div v-if="taskConfig.embeddingProvider === 'custom' && !customProvider.hasKey" class="ai-warn">
              ⚠ Custom Provider chưa có API key. Vào tab <strong>Kết nối Provider → Custom Endpoint</strong> để nhập key.
            </div>
            <div v-if="taskConfig.embeddingProvider === 'openai' && !providerKeyStatus.openai" class="ai-warn">
              ⚠ OpenAI chưa có API key. Vào tab <strong>Kết nối Provider → OpenAI</strong> để nhập key.
            </div>
          </div>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">🤖</span>
              <div>
                <div class="task-name">Trò chuyện với AI</div>
                <div class="task-desc">Cho phép sale chat trực tiếp với AI trong khung chat — AI đọc ngữ cảnh cuộc trò chuyện.</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.chatEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Mô tả:</strong> Bật tab "Chat AI" trong khung chat. Sale nhắn tin cho AI — AI đọc toàn bộ ngữ cảnh hội thoại
            và trả lời bằng <strong>tiếng Việt</strong>. Khác với "Gợi ý trả lời" (1 lần gọi), Chat AI duy trì ngữ cảnh và cho phép
            sale đặt câu hỏi liên tiếp.
          </div>
        </div>

        <div class="actions">
          <button class="btn-primary" @click="saveTaskConfig" :disabled="savingTaskConfig">
            {{ savingTaskConfig ? '⏳ Đang lưu...' : '💾 Lưu cấu hình tác vụ' }}
          </button>
        </div>
        <div v-if="saveTaskMsg" class="save-msg" :class="saveTaskOk ? 'ok' : 'err'">{{ saveTaskMsg }}</div>

        <!-- Usage breakdown -->
        <div class="field-group">
          <div class="section-title">
            <span>📊 Thống kê sử dụng hôm nay</span>
          </div>
          <div class="usage-grid">
            <div class="usage-item">
              <span class="usage-num">{{ usage?.usedToday ?? 0 }}</span>
              <span class="usage-label">Tổng lượt gọi</span>
            </div>
            <div class="usage-item">
              <span class="usage-num" :class="{ danger: lowQuota }">{{ usage?.remaining ?? config.maxDaily }}</span>
              <span class="usage-label">Còn lại</span>
            </div>
            <div class="usage-item">
              <span class="usage-num">{{ config.maxDaily }}</span>
              <span class="usage-label">Giới hạn / ngày</span>
            </div>
            <div class="usage-item">
              <div class="usage-bar-wrap">
                <div
                  class="usage-bar-fill"
                  :style="{ width: usagePercent + '%' }"
                  :class="{ danger: usagePercent > 80 }"
                ></div>
              </div>
              <span class="usage-label">{{ usagePercent.toFixed(1) }}% đã dùng</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════
           TAB 4: CONTENT & CAMPAIGN AI
      ═══════════════════════════════════════════════ -->
      <div v-show="activeTab === 'content'" class="tab-panel">

        <div class="section-title">
          <span>🎯 AI cho Marketing & Content</span>
          <span class="section-hint">Các tác vụ AI phục vụ cho chiến dịch marketing và nội dung</span>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">📝</span>
              <div>
                <div class="task-name">Gợi ý nội dung Broadcast</div>
                <div class="task-desc">AI gợi ý các biến thể tin nhắn cho khối nội dung (Content Block) trong Broadcast.</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.contentBlockEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Đường dẫn:</strong> Marketing → Broadcast → Thêm mẫu tin nhắn → Bấm "🤖 Gợi ý bằng AI".<br/>
            AI phân tích ý định người dùng và đề xuất 3-5 biến thể tin nhắn theo mẫu <code v-pre>{{ten}}</code>.
            Luôn trả về bằng <strong>tiếng Việt</strong>.
          </div>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">📡</span>
              <div>
                <div class="task-name">Lập kế hoạch chiến dịch</div>
                <div class="task-desc">AI lập kế hoạch chiến dịch broadcast hoàn chỉnh: đối tượng, tin nhắn, lịch gửi, KPI.</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.campaignPlannerEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Đường dẫn:</strong> Marketing → Chiến dịch → Tạo mới → Chọn "🤖 Lên kế hoạch bằng AI".<br/>
            AI hỏi mục tiêu chiến dịch → trả về plan hoàn chỉnh: đối tượng, các biến thể tin nhắn, lịch gửi, KPI dự kiến.
            Luôn trả về bằng <strong>tiếng Việt</strong>.
          </div>
        </div>

        <div class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-icon">💬</span>
              <div>
                <div class="task-name">Format tin nhắn đẹp</div>
                <div class="task-desc">AI tự động format đoạn text thành tin nhắn Zalo sinh động (đậm, màu, nghiêng).</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="taskConfig.formatRichEnabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-note">
            <strong>Đường dẫn:</strong> Marketing → Broadcast → Soạn tin → Bấm "✨ Format" trong ô soạn tin.<br/>
            AI phân tích đoạn text → trả về đoạn đã được bold/couleur cho Zalo.
          </div>
        </div>

        <div class="actions">
          <button class="btn-primary" @click="saveTaskConfig" :disabled="savingTaskConfig">
            {{ savingTaskConfig ? '⏳ Đang lưu...' : '💾 Lưu cấu hình' }}
          </button>
        </div>
        <div v-if="saveTaskMsg" class="save-msg" :class="saveTaskOk ? 'ok' : 'err'">{{ saveTaskMsg }}</div>
      </div>

    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="loading-skeleton">
      <div class="skel skel-header"></div>
      <div class="skel skel-card"></div>
      <div class="skel skel-card"></div>
      <div class="skel skel-card"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api/index';
import { useConfirm } from '@/composables/use-confirm';

const confirm = useConfirm();

interface AiAssistantConfig {
  aiAssistantEnabled: boolean;
  aiAssistantPromptTemplate: string | null;
  aiAssistantSkipNoisePattern: string;
  defaultPrompt: string;
  provider: string;
  model: string;
  maxDaily: number;
  enabled: boolean;
}

interface AiUsage {
  usedToday: number;
  maxDaily: number;
  remaining: number;
  enabled: boolean;
}

interface TaskConfig {
  suggestEnabled: boolean;
  summaryEnabled: boolean;
  sentimentEnabled: boolean;
  chatEnabled: boolean;
  contentBlockEnabled: boolean;
  campaignPlannerEnabled: boolean;
  formatRichEnabled: boolean;
  // 2026-07-26: Provider cho embedding (RAG-lite KB retrieval).
  // 'openai' | 'custom'. Nếu không set → fallback openai (trừ khi org chỉ có custom key
  // — auto-fallback đã thêm ở backend).
  embeddingProvider?: 'openai' | 'custom';
}

const loading = ref(true);
const saving = ref(false);
const config = ref<AiAssistantConfig | null>(null);
const usage = ref<AiUsage | null>(null);
const saveMessage = ref('');
const saveOk = ref(false);
const activeTab = ref('provider');

const tabs = [
  { key: 'provider', label: 'Kết nối Provider', icon: '🔌' },
  { key: 'assistant', label: 'Chat Assistant', icon: '🤖' },
  { key: 'analysis', label: 'Tác vụ phân tích', icon: '🔍' },
  { key: 'content', label: 'Content & Campaign', icon: '🎯' },
];

const providerList = [
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🧠', hasKey: false },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', hasKey: false },
  { id: 'openai', name: 'OpenAI', icon: '🔵', hasKey: false },
  { id: 'qwen', name: 'Alibaba Qwen', icon: '🐉', hasKey: false },
  { id: 'kimi', name: 'Moonshot Kimi', icon: '🌙', hasKey: false },
  { id: 'custom', name: 'Custom Endpoint', icon: '⚙️', hasKey: false },
];

const selectedProvider = ref('anthropic');
const showApiKey = ref(false);

const customProvider = ref({ baseUrl: '', apiKey: '', model: '', hasKey: false, keyMask: '' });
const savingProvider = ref(false);
const testingConnection = ref(false);
const connectionResult = ref<{ ok: boolean; message: string; url?: string } | null>(null);
const dockerDetected = ref(false);
const modelOptions = ref<Array<{ title: string; value: string }>>([]);
const loadingModels = ref(false);

// Task config
const taskConfig = ref<TaskConfig>({
  suggestEnabled: true,
  summaryEnabled: true,
  sentimentEnabled: true,
  chatEnabled: true,
  contentBlockEnabled: true,
  campaignPlannerEnabled: true,
  formatRichEnabled: true,
  embeddingProvider: 'openai',
});
const savingTaskConfig = ref(false);
const saveTaskMsg = ref('');
const saveTaskOk = ref(false);

// 2026-07-26: trạng thái key của từng provider (dùng cho cảnh báo khi chọn embedding).
// Lấy từ endpoint /ai/providers đã có (xem ai-routes.ts line 89).
const providerKeyStatus = ref<Record<string, boolean>>({});

const lowQuota = computed(() => {
  if (!usage.value || !config.value) return false;
  return usage.value.remaining < config.value.maxDaily * 0.2;
});

// 2026-07-26: cảnh báo khi baseUrl chứa localhost/loopback (không chạy được từ Docker container).
const isLocalhostUrl = computed(() => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(customProvider.value.baseUrl || ''));

const usagePercent = computed(() => {
  if (!usage.value || !config.value) return 0;
  return (usage.value.usedToday / config.value.maxDaily) * 100;
});

async function load() {
  loading.value = true;
  try {
    const [cfgRes, usageRes, providersRes] = await Promise.all([
      api.get<AiAssistantConfig>('/ai/assistant-config'),
      api.get<AiUsage>('/ai/usage'),
      api.get<Array<{ id: string; hasKey: boolean }>>('/ai/providers'),
    ]);
    config.value = cfgRes.data;
    usage.value = usageRes.data;
    selectedProvider.value = cfgRes.data.provider || 'anthropic';
    // 2026-07-26: gom hasKey của từng provider để cảnh báo khi chọn embedding.
    providerKeyStatus.value = Object.fromEntries(providersRes.data.map((p) => [p.id, p.hasKey]));
    await loadCustomProvider();
    await loadTaskConfig();
  } catch (e: any) {
    saveMessage.value = e?.response?.data?.error || e?.message || 'Lỗi tải cài đặt';
    saveOk.value = false;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!config.value || saving.value) return;
  saving.value = true;
  saveMessage.value = '';
  try {
    try { new RegExp(config.value.aiAssistantSkipNoisePattern); }
    catch {
      saveMessage.value = 'Regex không hợp lệ';
      saveOk.value = false;
      saving.value = false;
      return;
    }
    await api.put('/ai/assistant-config', {
      aiAssistantEnabled: config.value.aiAssistantEnabled,
      aiAssistantPromptTemplate: config.value.aiAssistantPromptTemplate,
      aiAssistantSkipNoisePattern: config.value.aiAssistantSkipNoisePattern,
    });
    saveMessage.value = '✓ Đã lưu cài đặt';
    saveOk.value = true;
    setTimeout(() => (saveMessage.value = ''), 3000);
  } catch (e: any) {
    saveMessage.value = e?.response?.data?.error || e?.message || 'Lỗi lưu cài đặt';
    saveOk.value = false;
  } finally {
    saving.value = false;
  }
}

function restoreDefault() {
  if (!config.value) return;
  confirm({ title: 'Khôi phục prompt mặc định?', description: 'Prompt đã edit sẽ bị thay thế.', tone: 'warning', confirmText: 'Khôi phục', cancelText: 'Hủy' }).then((ok) => {
    if (!ok) return;
    config.value!.aiAssistantPromptTemplate = config.value!.defaultPrompt;
  });
}

function selectProvider(id: string) {
  selectedProvider.value = id;
}

async function loadCustomProvider() {
  try {
    const res = await api.get<{ providers: Array<{ id: string; baseUrl: string; hasKey: boolean; keyMask: string }> }>('/ai/providers');
    const custom = res.data.providers?.find((p) => p.id === 'custom');
    if (custom) {
      customProvider.value.baseUrl = custom.baseUrl || '';
      customProvider.value.hasKey = custom.hasKey;
      customProvider.value.keyMask = custom.keyMask;
    }
    // Update provider hasKey flags
    for (const p of providerList) {
      const prov = res.data.providers?.find((x) => x.id === p.id);
      if (prov) p.hasKey = prov.hasKey;
    }
    if (config.value?.provider === 'custom') {
      customProvider.value.model = config.value.model;
      refetchModels();
    }
  } catch { /* silently ignore */ }
}

async function loadTaskConfig() {
  try {
    const res = await api.get<{ aiTaskConfig: TaskConfig }>('/ai/assistant-config');
    if (res.data.aiTaskConfig) {
      taskConfig.value = { ...taskConfig.value, ...res.data.aiTaskConfig };
    }
  } catch { /* use defaults */ }
}

async function refetchModels() {
  if (!customProvider.value.baseUrl) { modelOptions.value = []; return; }
  loadingModels.value = true;
  try {
    const res = await api.get<{ models: Array<{ title: string; value: string }>; error?: string }>('/ai/providers/custom/models');
    modelOptions.value = res.data.models || [];
    if (res.data.error) {
      connectionResult.value = { ok: false, message: `Không load được model: ${res.data.error}` };
    }
  } catch (e: any) {
    modelOptions.value = [];
    connectionResult.value = { ok: false, message: e?.response?.data?.error || 'Lỗi load models' };
  } finally {
    loadingModels.value = false;
  }
}

async function saveCustomProvider() {
  savingProvider.value = true;
  try {
    if (selectedProvider.value !== 'custom') {
      await api.put('/ai/config', { provider: selectedProvider.value });
      connectionResult.value = { ok: true, message: `Đã chọn provider: ${selectedProvider.value}` };
    } else {
      if (customProvider.value.baseUrl) await api.put('/ai/providers/custom', { baseUrl: customProvider.value.baseUrl });
      if (customProvider.value.apiKey) await api.put('/ai/providers/custom', { apiKey: customProvider.value.apiKey });
      if (customProvider.value.model) await api.put('/ai/config', { provider: 'custom', model: customProvider.value.model });
      connectionResult.value = { ok: true, message: 'Đã lưu Custom Provider' };
    }
    await loadCustomProvider();
  } catch (e: any) {
    connectionResult.value = { ok: false, message: e?.response?.data?.error || e?.message || 'Lỗi lưu' };
  } finally {
    savingProvider.value = false;
    setTimeout(() => (connectionResult.value = null), 5000);
  }
}

async function testCustomConnection() {
  testingConnection.value = true;
  connectionResult.value = null;
  try {
    const res = await api.post<{ ok: boolean; error?: string; model?: string; url?: string; docker?: boolean }>('/ai/test-connection', {
      provider: selectedProvider.value,
      baseUrl: selectedProvider.value === 'custom' ? (customProvider.value.baseUrl || undefined) : undefined,
      apiKey: selectedProvider.value === 'custom' ? (customProvider.value.apiKey || undefined) : undefined,
      model: selectedProvider.value === 'custom' ? (customProvider.value.model || undefined) : undefined,
    });
    dockerDetected.value = !!res.data.docker;
    if (res.data.ok) {
      connectionResult.value = { ok: true, message: `Kết nối OK với model ${res.data.model}`, url: res.data.url };
      if (selectedProvider.value === 'custom') refetchModels();
    } else {
      connectionResult.value = { ok: false, message: res.data.error || 'Kết nối thất bại', url: res.data.url };
    }
  } catch (e: any) {
    connectionResult.value = { ok: false, message: e?.response?.data?.error || e?.message || 'Test thất bại' };
  } finally {
    testingConnection.value = false;
  }
}

async function saveTaskConfig() {
  savingTaskConfig.value = true;
  saveTaskMsg.value = '';
  try {
    await api.put('/ai/assistant-config', { aiTaskConfig: taskConfig.value });
    saveTaskMsg.value = '✓ Đã lưu cấu hình tác vụ AI';
    saveTaskOk.value = true;
    setTimeout(() => (saveTaskMsg.value = ''), 3000);
  } catch (e: any) {
    saveTaskMsg.value = e?.response?.data?.error || e?.message || 'Lỗi lưu cấu hình';
    saveTaskOk.value = false;
  } finally {
    savingTaskConfig.value = false;
  }
}

onMounted(() => { load(); });
</script>

<style scoped>
.ai-page {
  max-width: 1024px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.ai-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}
.ai-page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}
.ai-page-sub {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}
.loading-pill {
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 12px;
  color: #64748b;
}
.ai-page-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Tab nav */
.tab-nav {
  display: flex;
  gap: 4px;
  background: #f8fafc;
  border-radius: 10px;
  padding: 4px;
  border: 1px solid #e2e8f0;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 7px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  transition: all 0.15s;
}
.tab-btn:hover { background: #f1f5f9; color: #334155; }
.tab-btn.active { background: #fff; color: #1e40af; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 600; }
.tab-icon { font-size: 15px; }

/* Section titles */
.section-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}
.section-hint {
  font-size: 11px;
  color: #64748b;
  font-weight: 400;
}

/* Cards */
.provider-card, .field-group, .toggle-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}
.field-group { display: flex; flex-direction: column; gap: 8px; }
.toggle-card { padding: 14px 16px; }

.docker-banner {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 12px;
}
.docker-banner code {
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0,0,0,0.06);
  padding: 1px 5px;
  border-radius: 3px;
}

/* Provider grid */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.provider-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: #fafbfc;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.provider-btn:hover { border-color: #93c5fd; background: #eff6ff; }
.provider-btn.selected { border-color: #3b82f6; background: #eff6ff; }
.p-icon { font-size: 24px; }
.p-name { font-weight: 600; font-size: 12px; color: #1f2937; }
.p-badge { font-size: 10px; color: #059669; }
.p-badge.dim { color: #94a3b8; }

/* Model row */
.model-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.model-select { flex: 1; min-width: 160px; }

/* API key */
.api-key-row { display: flex; gap: 8px; align-items: center; }
.api-key-row .regex-input { flex: 1; }
.btn-icon { background: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-size: 14px; }
.btn-icon:hover { background: #f1f5f9; }

.provider-actions { display: flex; gap: 8px; margin-top: 8px; }
.connection-result {
  margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px;
  display: flex; flex-direction: column; gap: 4px;
}
.connection-result.ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.connection-result.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.connection-url { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.8; }

/* Quota */
.quota-row { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
.quota-field { flex: 1; min-width: 200px; }
.quota-stats { display: flex; gap: 16px; flex-wrap: wrap; }
.quota-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
.qs-label { font-size: 10px; color: #64748b; }
.qs-value { font-size: 20px; font-weight: 700; color: #1f2937; }
.qs-value.danger { color: #b91c1c; }

/* Toggle */
.toggle-row { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.toggle-row input { margin-top: 2px; }
.toggle-label { font-weight: 600; font-size: 14px; }
.toggle-hint { font-size: 11px; color: #64748b; margin-top: 2px; }

/* Toggle switch */
.toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; inset: 0;
  background-color: #cbd5e1; border-radius: 24px;
  transition: 0.2s;
}
.toggle-slider:before {
  position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background-color: white; border-radius: 50%; transition: 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background-color: #3b82f6; }
.toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }

/* Prompt editor */
.prompt-editor {
  width: 100%; min-height: 420px; padding: 12px;
  border: 1px solid #e2e8f0; border-radius: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px; line-height: 1.7; background: #1e293b; color: #e2e8f0;
  resize: vertical;
}
.regex-input {
  width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 7px;
  font-size: 13px;
}
.regex-input.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.field-label {
  display: block; font-size: 13px; font-weight: 600; color: #1f2937;
}
.field-meta { color: #64748b; font-weight: 400; font-size: 11px; }
.field-hint { font-size: 11px; color: #64748b; }
.field-hint code { font-family: 'JetBrains Mono', monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }

/* Actions */
.actions { display: flex; gap: 8px; justify-content: flex-end; padding: 8px 0; }
.btn-primary {
  padding: 8px 16px; border-radius: 7px; border: none;
  background: #3b82f6; color: #fff; font-weight: 600; cursor: pointer; font-size: 13px;
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  padding: 8px 16px; border-radius: 7px; border: 1px solid #e2e8f0;
  background: #fff; color: #475569; font-weight: 500; cursor: pointer; font-size: 13px;
}
.btn-secondary:hover { background: #f8fafc; }
.btn-danger-ghost {
  padding: 8px 16px; border-radius: 7px; border: 1px solid #fecaca;
  background: #fff; color: #b91c1c; font-weight: 500; cursor: pointer; font-size: 13px;
}
.btn-danger-ghost:hover { background: #fef2f2; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.save-msg { text-align: right; font-size: 12px; padding: 6px 0; }
.save-msg.ok { color: #166534; }
.save-msg.err { color: #b91c1c; }

/* Default prompt preview */
.default-prompt-preview {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
}
.default-prompt-preview summary {
  padding: 10px 14px; font-size: 13px; font-weight: 500; cursor: pointer;
  background: #f8fafc; border-bottom: 1px solid #e2e8f0;
}
.default-prompt-preview summary:hover { background: #f1f5f9; }
.default-prompt-text {
  padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
  line-height: 1.7; color: #475569; white-space: pre-wrap; margin: 0;
  max-height: 300px; overflow-y: auto;
}

/* Task cards */
.task-card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.task-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.task-info { display: flex; gap: 10px; align-items: flex-start; }
.task-icon { font-size: 22px; }
.task-name { font-weight: 700; font-size: 14px; color: #1f2937; }
.task-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
.task-note {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px;
  padding: 10px 12px; font-size: 12px; color: #475569; line-height: 1.6;
}
.task-note strong { color: #1e40af; }
.task-note code { font-family: 'JetBrains Mono', monospace; background: #e2e8f0; padding: 1px 4px; border-radius: 3px; font-size: 11px; }

/* 2026-07-26: select + warn cho embedding provider */
.ai-select {
  display: block;
  width: 100%;
  max-width: 360px;
  margin-top: 8px;
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: white;
  font-size: 13px;
  color: #1f2937;
  cursor: pointer;
}
.ai-select:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
.ai-warn {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  color: #c2410c;
  font-size: 12px;
  line-height: 1.5;
}

/* Usage */
.usage-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
.usage-item {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.usage-num { font-size: 28px; font-weight: 800; color: #1e40af; }
.usage-num.danger { color: #b91c1c; }
.usage-label { font-size: 10px; color: #64748b; text-align: center; }
.usage-bar-wrap {
  width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;
}
.usage-bar-fill {
  height: 100%; background: #3b82f6; border-radius: 3px; transition: width 0.5s;
}
.usage-bar-fill.danger { background: #ef4444; }

/* Loading skeleton */
.loading-skeleton { display: flex; flex-direction: column; gap: 12px; }
.skel {
  border-radius: 10px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
}
.skel-header { height: 60px; }
.skel-card { height: 120px; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
