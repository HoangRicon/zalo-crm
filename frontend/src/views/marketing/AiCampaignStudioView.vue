<template>
  <div class="ai-studio">
    <div class="mkt-top">
      <div>
        <div class="mtt">🪄 AI Campaign Studio</div>
        <div class="mts">
          Mô tả mục tiêu chiến dịch bằng 1 câu — AI sẽ sinh plan đầy đủ
          (đối tượng + tin nhắn + lịch + KPI + rủi ro) trong 8 giây.
        </div>
      </div>
    </div>

    <div class="input-area">
      <textarea
        v-model="userGoal"
        rows="3"
        maxlength="1000"
        placeholder="VD: Bán căn 3PN Q7 cho khách quan tâm tháng trước, giọng thân thiện"
        class="f-textarea"
        :disabled="loading"
      />
      <button
        class="btn btn-primary btn-lg"
        :disabled="!userGoal.trim() || loading"
        @click="generatePlan"
      >
        <v-icon size="16">mdi-sparkles</v-icon>
        {{ loading ? 'Đang lên kế hoạch…' : 'Lên kế hoạch' }}
      </button>
    </div>

    <div v-if="plan" class="plan-cards">
      <div v-if="source === 'rule_based'" class="ai-note">
        🤖 AI tắt hoặc lỗi — kế hoạch dựa trên rule mặc định.
      </div>

      <div class="card">
        <h3>👥 Đối tượng</h3>
        <ul class="segments">
          <li v-for="(s, i) in plan.audience.segments" :key="i">{{ s }}</li>
        </ul>
        <div class="reach">Ước lượng: <strong>{{ plan.audience.estimatedReach }} KH</strong></div>
      </div>

      <div class="card">
        <h3>💬 Tin nhắn ({{ plan.messages.length }} variants)</h3>
        <div v-for="(m, i) in plan.messages" :key="i" class="msg-card">
          <span class="variant-badge">{{ m.variant }}</span>
          <strong>{{ m.name }}</strong>
          <div class="msg-text">{{ m.text }}</div>
        </div>
      </div>

      <div class="card">
        <h3>📅 Lịch gửi</h3>
        <p>Tần suất: <strong>{{ plan.schedule.frequency }}</strong></p>
        <p>Thời điểm: <strong>{{ fmtDate(plan.schedule.sendAtISO) }}</strong></p>
      </div>

      <div class="card">
        <h3>📊 KPI dự kiến</h3>
        <p>Tỉ lệ reply: <strong>{{ Math.round(plan.kpi.expectedReplyRate * 100) }}%</strong></p>
        <p>Reach: <strong>{{ plan.kpi.expectedReach }} KH</strong></p>
      </div>

      <div class="card warn-card">
        <h3>⚠️ Rủi ro</h3>
        <ul>
          <li v-for="(r, i) in plan.risks" :key="i">{{ r }}</li>
        </ul>
      </div>

      <div class="actions-row">
        <button
          class="btn btn-primary btn-lg"
          :disabled="applying"
          @click="applyPlan"
        >
          {{ applying ? 'Đang tạo…' : '✨ Tạo campaign từ plan này' }}
        </button>
      </div>

      <div v-if="applyResult" class="success-note">
        ✅ Đã tạo broadcast job #{{ applyResult.jobId }}. <RouterLink to="/marketing/broadcasts">Xem →</RouterLink>
      </div>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/api/index';
import { useToast } from '@/composables/use-toast';

interface Plan {
  audience: { segments: string[]; estimatedReach: number };
  messages: Array<{ variant: string; name: string; text: string }>;
  schedule: { frequency: string; sendAtISO: string };
  kpi: { expectedReplyRate: number; expectedReach: number };
  risks: string[];
}

const userGoal = ref('');
const loading = ref(false);
const applying = ref(false);
const plan = ref<Plan | null>(null);
const planId = ref('');
const source = ref<'ai' | 'rule_based' | null>(null);
const applyResult = ref<{ jobId: string } | null>(null);
const error = ref('');
const { push: toast } = useToast();

async function generatePlan() {
  if (!userGoal.value.trim()) return;
  loading.value = true;
  error.value = '';
  applyResult.value = null;
  try {
    const res = await api.post('/api/v1/ai/plan-campaign', { userGoal: userGoal.value });
    plan.value = res.data.plan;
    planId.value = res.data.planId;
    source.value = res.data.source;
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? 'Lỗi không xác định';
  } finally {
    loading.value = false;
  }
}

async function applyPlan() {
  if (!planId.value) return;
  applying.value = true;
  try {
    const res = await api.post(`/api/v1/ai/plan-campaign/${planId.value}/apply`);
    applyResult.value = { jobId: res.data.jobId };
    toast('Đã tạo broadcast job', 'success');
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? 'Lỗi apply';
  } finally {
    applying.value = false;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<style scoped>
.ai-studio {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.mtt {
  font-size: 22px;
  font-weight: 700;
}
.mts {
  color: var(--text-muted, #64748b);
  font-size: 14px;
  margin-bottom: 16px;
}
.input-area {
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.f-textarea {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  margin-bottom: 10px;
  resize: vertical;
}
.ai-note {
  background: #fef3c7;
  color: #92400e;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
}
.plan-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.card {
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  padding: 14px;
}
.warn-card {
  background: #fef2f2;
  border-color: #fecaca;
}
.card h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.card ul {
  margin: 0;
  padding-left: 18px;
}
.card p {
  margin: 4px 0;
  font-size: 13px;
}
.segments li {
  font-size: 13px;
  margin-bottom: 2px;
}
.reach {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color, #e2e8f0);
  font-size: 13px;
}
.msg-card {
  background: var(--bg-subtle, #f8fafc);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.variant-badge {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: var(--accent, #10b981);
  color: white;
  font-weight: 700;
  font-size: 11px;
}
.msg-text {
  font-size: 13px;
  color: var(--text-main, #1e293b);
}
.actions-row {
  grid-column: span 2;
  text-align: center;
  padding: 16px 0;
}
.success-note {
  grid-column: span 2;
  background: #ecfdf5;
  color: #047857;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}
.error-msg {
  color: #b91c1c;
  background: #fee2e2;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 12px;
}
</style>
