<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Huỳnh Ngọc Thuận — Community extension -->
<!--
  BroadcastsView — Broadcast tự động (Community).
  Gửi tin hàng loạt tới Tệp khách hàng theo lịch: 1 lần / hàng ngày / hàng tuần.
  Backend: /api/v1/broadcast-jobs (+ worker cron 30s gửi rải tin chống block).
-->
<template>
  <div class="bc-view">
    <div class="mkt-top">
      <div>
        <div class="mtt">Broadcast tự động</div>
        <div class="mts">
          Gửi tin hàng loạt tới <b>Tệp khách hàng</b> theo lịch (1 lần · hàng ngày · hàng tuần).
          Tin được <b>gửi rải</b> (giãn cách ngẫu nhiên) + tôn trọng <b>trần tin/ngày của nick</b> để chống block.
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary btn-sm" @click="openCreate">
          <v-icon size="16">mdi-plus-circle-outline</v-icon> Tạo broadcast
        </button>
      </div>
    </div>

    <div class="bc-body">
      <HeatmapWidget :days="30" class="heatmap-container" />

      <!-- 2026-07-22 fix-zalo-crm-mvp-gaps#8: status filter + quick stats -->
      <div class="bc-filter-row">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          class="bc-filter-btn"
          :class="{ active: statusFilter === opt.value }"
          @click="statusFilter = opt.value"
        >
          {{ opt.label }}
          <span v-if="opt.count !== undefined" class="bc-filter-count">{{ opt.count }}</span>
        </button>
      </div>

      <div v-if="loading" class="bc-empty">Đang tải…</div>
      <template v-else>
        <div v-if="filteredJobs.length === 0" class="bc-empty">
          <v-icon size="40">mdi-bullhorn-outline</v-icon>
          <p v-if="jobs.length === 0">
            Chưa có broadcast nào. Bấm <b>Tạo broadcast</b> để bắt đầu.
          </p>
          <p v-else>Không có broadcast nào ở trạng thái <b>{{ statusFilterLabel }}</b>.</p>
        </div>

        <div v-for="job in filteredJobs" :key="job.id" class="bc-card" :class="'st-' + job.status">
        <div class="bc-card-main">
          <div class="bc-card-head">
            <span class="bc-name">{{ job.name }}</span>
            <span class="bc-badge" :class="'b-' + job.status">{{ statusLabel(job.status) }}</span>
          </div>
          <div class="bc-meta">
            <span v-if="job.sourceType === 'friends'">
              <v-icon size="14">mdi-account-heart-outline</v-icon> Bạn bè đã kết bạn của nick
            </span>
            <span v-else><v-icon size="14">mdi-format-list-bulleted</v-icon> {{ job.list?.name ?? 'Tệp đã xoá' }}
              <template v-if="job.list"> ({{ job.list.hasZaloEntries }} có Zalo)</template></span>
            <span><v-icon size="14">mdi-account-circle-outline</v-icon> {{ job.nick?.displayName ?? job.nick?.phone ?? '—' }}</span>
            <span><v-icon size="14">mdi-clock-outline</v-icon> {{ scheduleLabel(job) }}</span>
            <span v-if="job.nextRunAt"><v-icon size="14">mdi-calendar-arrow-right</v-icon> Lần tới: {{ fmtDate(job.nextRunAt) }}</span>
          </div>
          <div v-if="job.contentBlocks?.length" class="bc-msg">
            <v-icon size="14">mdi-shuffle-variant</v-icon>
            Xoay vòng {{ job.contentBlocks.length }} khối: {{ job.contentBlocks.map((b) => b.name).join(', ') }}
          </div>
          <div v-else class="bc-msg" :title="job.messageText">{{ job.messageText }}</div>
          <div v-if="job.latestRun" class="bc-run">
            <span class="run-badge" :class="'r-' + job.latestRun.status">
              {{ job.latestRun.status === 'running' ? 'Đang gửi' : 'Lần gần nhất' }}
            </span>
            ✅ {{ job.latestRun.sentCount }} gửi ·
            ❌ {{ job.latestRun.failedCount }} lỗi ·
            ⏭ {{ job.latestRun.skippedCount }} bỏ qua
            <button class="btn-link" @click="viewItems(job, job.latestRun)">chi tiết</button>
          </div>
        </div>
        <div class="bc-card-actions">
          <button v-if="job.status === 'active'" class="btn btn-ghost btn-sm" title="Tạm dừng" @click="setStatus(job, 'paused')">
            <v-icon size="16">mdi-pause</v-icon>
          </button>
          <button v-if="job.status === 'paused'" class="btn btn-ghost btn-sm" title="Tiếp tục" @click="setStatus(job, 'active')">
            <v-icon size="16">mdi-play</v-icon>
          </button>
          <button v-if="job.status !== 'done'" class="btn btn-ghost btn-sm" title="Chạy ngay" @click="runNow(job)">
            <v-icon size="16">mdi-send</v-icon>
          </button>
          <button class="btn btn-ghost btn-sm danger" title="Xoá" @click="removeJob(job)">
            <v-icon size="16">mdi-trash-can-outline</v-icon>
          </button>
        </div>
      </div>
      </template>
    </div>

    <!-- ============ Modal tạo broadcast ============ -->
    <div v-if="showCreate" class="bc-overlay" @click.self="showCreate = false">
      <div class="bc-modal">
        <div class="bc-modal-head">
          <b>Tạo broadcast</b>
          <button class="btn-x" @click="showCreate = false"><v-icon size="18">mdi-close</v-icon></button>
        </div>

        <label class="f-label">Tên broadcast</label>
        <input v-model="form.name" class="f-input" placeholder="VD: Khuyến mãi tháng 7" />

        <label class="f-label">Nick Zalo gửi (chọn 1 hoặc nhiều)</label>
        <div class="f-nick-list">
          <label v-for="n in nicks" :key="n.id" class="f-nick-item" :class="{ disabled: n.status !== 'connected' }">
            <input
              type="checkbox"
              :checked="form.zaloAccountIds.includes(n.id)"
              :disabled="n.status !== 'connected'"
              @change="toggleNick(n.id)"
            />
            <span>{{ n.displayName || n.phone }} {{ n.status !== 'connected' ? '(mất kết nối)' : '' }}</span>
          </label>
        </div>
        <div v-if="form.zaloAccountIds.length > 1" class="f-note" style="margin-top:6px">
          <v-icon size="14">mdi-information-outline</v-icon>
          Chọn chế độ gửi:
          <select v-model="form.sendMode" class="f-input-sm" style="margin-left:6px">
            <option value="duplicate">Tất cả nick gửi cùng tin (duplicate)</option>
            <option value="round_robin">Mỗi nick gửi một phần (round-robin)</option>
          </select>
        </div>

        <label class="f-label">Người nhận</label>
        <div class="f-tabs">
          <button type="button" class="f-tab" :class="{ on: form.sourceType === 'friends' }" @click="form.sourceType = 'friends'">
            <v-icon size="14">mdi-account-heart-outline</v-icon> Bạn bè đã kết bạn
          </button>
          <button type="button" class="f-tab" :class="{ on: form.sourceType === 'customer_list' }" @click="form.sourceType = 'customer_list'">
            <v-icon size="14">mdi-format-list-bulleted</v-icon> Tệp khách hàng
          </button>
        </div>

        <template v-if="form.sourceType === 'friends'">
          <div class="f-note" style="margin-top:8px">
            <v-icon size="15">mdi-shield-check-outline</v-icon>
            Gửi tới <b>toàn bộ bạn bè đã kết bạn</b> của nick đang chọn — tin vào thẳng hộp chat, an toàn hơn.
            <template v-if="form.zaloAccountId">
              <b>{{ friendCount === null ? '…' : friendCount.toLocaleString('vi-VN') }}</b> bạn bè.
            </template>
            <template v-else>Chọn nick để xem số bạn bè.</template>
          </div>
        </template>
        <template v-else>
          <label class="f-label" style="margin-top:8px">Tệp khách hàng</label>
          <select v-model="form.customerListId" class="f-input">
            <option value="" disabled>— chọn tệp —</option>
            <option v-for="l in lists" :key="l.id" :value="l.id">
              {{ l.name }} ({{ l.hasZaloEntries }} có Zalo)
            </option>
          </select>
          <div class="f-note warn" style="margin-top:6px">
            <v-icon size="15">mdi-alert-outline</v-icon>
            Tệp SĐT có thể gồm <b>người chưa kết bạn</b> — tin dễ rơi vào hộp "người lạ" hoặc bị chặn.
            Nên chạy <RouterLink to="/marketing/targets">Mục tiêu</RouterLink> kết bạn trước, hoặc dùng nguồn Bạn bè.
          </div>
        </template>

        <label class="f-label">Nội dung</label>
        <div class="f-tabs">
          <button type="button" class="f-tab" :class="{ on: form.contentMode === 'text' }" @click="form.contentMode = 'text'">Gõ tay</button>
          <button type="button" class="f-tab" :class="{ on: form.contentMode === 'blocks' }" @click="onSelectBlocksMode">
            <v-icon size="14">mdi-shuffle-variant</v-icon> Khối nội dung (xoay vòng chống spam)
          </button>
        </div>

        <template v-if="form.contentMode === 'text'">
          <label class="f-label" style="margin-top:10px">Nội dung tin <span class="f-hint">— biến: <code v-pre>{{ten}}</code> tên khách, <code v-pre>{{sdt}}</code> SĐT</span></label>
          <textarea v-model="form.messageText" class="f-input" rows="4"
            placeholder="Chào {{ten}}, bên em đang có chương trình ưu đãi…"></textarea>

          <label class="f-label">Ảnh kèm (tuỳ chọn)</label>
          <div class="f-image-row">
            <img v-if="form.imageUrl" :src="form.imageUrl" class="f-image-preview" />
            <div class="f-image-actions">
              <button type="button" class="btn btn-ghost btn-sm" @click="openMediaPicker">
                <v-icon size="16">mdi-image-multiple-outline</v-icon> Chọn từ Kho media
              </button>
              <button v-if="form.imageUrl" type="button" class="btn btn-ghost btn-sm danger" @click="form.imageUrl = ''">
                <v-icon size="16">mdi-close</v-icon> Bỏ ảnh
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="f-hint" style="margin:10px 0 6px">
            Chọn nhiều khối — mỗi tin gửi sẽ lấy 1 khối kế tiếp theo thứ tự chọn, tránh gửi
            1 mẫu giống hệt nhau. Chưa có khối? Tạo ở <RouterLink to="/marketing/content-blocks">Khối nội dung</RouterLink>.
          </div>
          <div v-if="contentBlocks.length === 0" class="bc-empty" style="padding:16px 0">Chưa có khối nội dung nào.</div>
          <div v-else class="f-block-list">
            <label v-for="b in contentBlocks" :key="b.id" class="f-block-item">
              <input type="checkbox" :checked="form.contentBlockIds.includes(b.id)" @change="toggleBlock(b.id)" />
              <img v-if="b.imageUrl" :src="b.imageUrl" class="f-block-thumb" />
              <div class="f-block-info">
                <div class="f-block-name">
                  <span v-if="form.contentBlockIds.includes(b.id)" class="f-block-order">{{ form.contentBlockIds.indexOf(b.id) + 1 }}</span>
                  {{ b.name }}
                </div>
                <div class="f-block-text">{{ b.messageText }}</div>
              </div>
            </label>
          </div>
        </template>

        <!-- Sprint 2 R4 2026-07-21: A/B test toggle + Preview button -->
        <div class="f-row" style="margin-top: 12px; gap: 12px;">
          <button type="button" class="btn btn-ghost btn-sm" @click="showPreview = true"
            :disabled="!form.messageText.trim() || !form.zaloAccountId">
            <v-icon size="14">mdi-eye-outline</v-icon> Xem trước
          </button>
          <label class="switch-ab">
            <input type="checkbox" v-model="form.abMode" true-value="ab_split" false-value="off" />
            <span>🧪 A/B test ({{ form.abMode === 'ab_split' ? form.variantTexts.length + 1 + ' variants' : 'tắt' }})</span>
          </label>
        </div>
        <ABVariantsEditor v-if="form.abMode === 'ab_split'" v-model="form.variantTexts" class="mt-2" />

        <label class="f-label">Lịch gửi</label>
        <div class="f-tabs">
          <button v-for="t in scheduleTypes" :key="t.value" class="f-tab"
            :class="{ on: form.scheduleType === t.value }" @click="form.scheduleType = t.value">{{ t.label }}</button>
        </div>
        <div class="f-row">
          <div v-if="form.scheduleType === 'once'" class="f-col">
            <label class="f-label">Ngày giờ gửi</label>
            <input v-model="form.scheduledAtLocal" type="datetime-local" class="f-input" />
          </div>
          <div v-else class="f-col">
            <label class="f-label">Giờ gửi (VN)</label>
            <input v-model="form.timeOfDay" type="time" class="f-input" />
          </div>
          <div v-if="form.scheduleType === 'weekly'" class="f-col f-grow">
            <label class="f-label">Ngày trong tuần</label>
            <div class="f-dows">
              <button v-for="d in dowOptions" :key="d.value" class="f-dow"
                :class="{ on: form.daysOfWeek.includes(d.value) }" @click="toggleDow(d.value)">{{ d.label }}</button>
            </div>
          </div>
        </div>

        <details class="f-adv">
          <summary>Chống block (nâng cao)</summary>
          <div class="f-row">
            <div class="f-col">
              <label class="f-label">Tối đa tin / lần chạy</label>
              <input v-model.number="form.maxPerRun" type="number" min="1" max="500" class="f-input" />
            </div>
            <div class="f-col">
              <label class="f-label">Giãn cách tối thiểu (giây)</label>
              <input v-model.number="form.delaySecMin" type="number" min="5" class="f-input" />
            </div>
            <div class="f-col">
              <label class="f-label">Giãn cách tối đa (giây)</label>
              <input v-model.number="form.delaySecMax" type="number" min="5" class="f-input" />
            </div>
          </div>
          <div class="f-hint">Tin còn bị chặn thêm bởi <b>trần tin/ngày của nick</b> (Cài đặt → Tài khoản Zalo).</div>
        </details>

        <div class="bc-modal-foot">
          <button class="btn btn-ghost btn-sm" @click="showCreate = false">Huỷ</button>
          <button class="btn btn-primary btn-sm" :disabled="creating" @click="createJob">
            {{ creating ? 'Đang tạo…' : 'Tạo broadcast' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============ Modal log người nhận ============ -->
    <div v-if="itemsModal.open" class="bc-overlay" @click.self="itemsModal.open = false">
      <div class="bc-modal bc-modal-wide">
        <div class="bc-modal-head">
          <b>Log gửi — {{ itemsModal.jobName }}</b>
          <button class="btn-x" @click="itemsModal.open = false"><v-icon size="18">mdi-close</v-icon></button>
        </div>
        <table class="bc-table">
          <thead><tr><th>#</th><th>Tên</th><th>SĐT</th><th>Trạng thái</th><th>Lỗi</th><th>Lúc</th></tr></thead>
          <tbody>
            <tr v-for="(it, i) in itemsModal.items" :key="it.id">
              <td class="num">{{ i + 1 }}</td>
              <td>{{ it.name ?? '—' }}</td>
              <td class="num">{{ it.phone ?? '—' }}</td>
              <td><span class="run-badge" :class="'r-' + it.status">{{ itemStatusLabel(it.status) }}</span></td>
              <td class="err">{{ it.error ?? '' }}</td>
              <td class="num">{{ fmtDate(it.createdAt) }}</td>
            </tr>
            <tr v-if="itemsModal.items.length === 0"><td colspan="6" class="bc-empty">Chưa có tin nào được gửi.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ Modal chọn ảnh từ Kho media ============ -->
    <div v-if="mediaPicker.open" class="bc-overlay" @click.self="mediaPicker.open = false">
      <div class="bc-modal bc-modal-wide">
        <div class="bc-modal-head">
          <b>Chọn ảnh từ Kho media</b>
          <button class="btn-x" @click="mediaPicker.open = false"><v-icon size="18">mdi-close</v-icon></button>
        </div>
        <div v-if="mediaPicker.loading" class="bc-empty">Đang tải…</div>
        <div v-else-if="mediaPicker.items.length === 0" class="bc-empty">Kho media chưa có ảnh nào.</div>
        <div v-else class="f-media-grid">
          <button v-for="m in mediaPicker.items" :key="m.id" type="button" class="f-media-item" @click="selectMedia(m)">
            <img :src="m.thumbnailUrl || m.url || ''" :alt="m.name" />
          </button>
        </div>
      </div>
    </div>

    <!-- Sprint 2 R4 2026-07-21: Preview modal render biến {{ten}} {{sdt}} -->
    <PreviewModal
      :open="showPreview"
      :source-type="form.sourceType"
      :customer-list-id="form.customerListId"
      :zalo-account-id="form.zaloAccountId"
      :message-text="form.messageText"
      :count="3"
      @close="showPreview = false"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api/index';
import { listMedia, type MediaAssetItem } from '@/api/media';
import { useToast } from '@/composables/use-toast';
import { useConfirm } from '@/composables/use-confirm';
import HeatmapWidget from '@/components/marketing/HeatmapWidget.vue';
import PreviewModal from '@/components/marketing/PreviewModal.vue';
import ABVariantsEditor from '@/components/marketing/ABVariantsEditor.vue';

const { push: toast } = useToast();
const { confirm } = useConfirm();
const route = useRoute();

interface JobRow {
  id: string; name: string; status: string; messageText: string; imageUrl: string | null;
  sourceType: 'customer_list' | 'friends';
  scheduleType: 'once' | 'daily' | 'weekly'; scheduledAt: string | null;
  timeOfDay: string | null; daysOfWeek: number[]; nextRunAt: string | null;
  list: { id: string; name: string; hasZaloEntries: number } | null;
  nick: { id: string; displayName: string | null; phone: string | null; status: string } | null;
  contentBlocks?: Array<{ id: string; name: string }>;
  latestRun: { id: string; status: string; sentCount: number; failedCount: number; skippedCount: number } | null;
}
interface ContentBlockRow {
  id: string; name: string; messageText: string; imageUrl: string | null;
}

const jobs = ref<JobRow[]>([]);
const lists = ref<Array<{ id: string; name: string; hasZaloEntries: number }>>([]);
const nicks = ref<Array<{ id: string; displayName: string | null; phone: string | null; status: string }>>([]);
const contentBlocks = ref<ContentBlockRow[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const creating = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

// 2026-07-22 fix-zalo-crm-mvp-gaps#8: status filter
const statusFilter = ref<'all' | 'active' | 'paused' | 'done'>('all');
const filterOptions = computed(() => [
  { value: 'all' as const,     label: 'Tất cả',     count: jobs.value.length },
  { value: 'active' as const,  label: '🟢 Đang chạy', count: jobs.value.filter((j) => j.status === 'active').length },
  { value: 'paused' as const,  label: '⏸ Tạm dừng',  count: jobs.value.filter((j) => j.status === 'paused').length },
  { value: 'done' as const,    label: '✓ Hoàn thành', count: jobs.value.filter((j) => j.status === 'done').length },
]);
const filteredJobs = computed(() =>
  statusFilter.value === 'all' ? jobs.value : jobs.value.filter((j) => j.status === statusFilter.value),
);
const statusFilterLabel = computed(() => filterOptions.value.find((f) => f.value === statusFilter.value)?.label ?? '');

const scheduleTypes = [
  { value: 'once' as const, label: 'Gửi 1 lần' },
  { value: 'daily' as const, label: 'Hàng ngày' },
  { value: 'weekly' as const, label: 'Hàng tuần' },
];
const dowOptions = [
  { value: 1, label: 'T2' }, { value: 2, label: 'T3' }, { value: 3, label: 'T4' },
  { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' }, { value: 0, label: 'CN' },
];

const form = reactive({
  name: '', sourceType: 'friends' as 'customer_list' | 'friends',
  customerListId: '', zaloAccountId: '', zaloAccountIds: [] as string[], sendMode: 'duplicate' as 'duplicate' | 'round_robin', messageText: '', imageUrl: '',
  contentMode: 'text' as 'text' | 'blocks', contentBlockIds: [] as string[],
  scheduleType: 'once' as 'once' | 'daily' | 'weekly',
  scheduledAtLocal: '', timeOfDay: '08:00', daysOfWeek: [] as number[],
  maxPerRun: 50, delaySecMin: 30, delaySecMax: 90,
  // Sprint 2 R4 2026-07-21: A/B test
  abMode: 'off' as 'off' | 'ab_split',
  variantTexts: ['', ''] as string[], // variant A = messageText, B,C = variantTexts[0..1]
});

function toggleNick(id: string): void {
  const idx = form.zaloAccountIds.indexOf(id);
  if (idx >= 0) {
    form.zaloAccountIds.splice(idx, 1);
  } else {
    form.zaloAccountIds.push(id);
  }
  // Keep zaloAccountId in sync for backward compat
  form.zaloAccountId = form.zaloAccountIds[0] || '';
}

// Sprint 2 R4: preview state
const showPreview = ref(false);

const friendCount = ref<number | null>(null);

async function onNickChange(): Promise<void> {
  friendCount.value = null;
  if (!form.zaloAccountId) return;
  try {
    const res = await api.get(`/broadcast-jobs/friend-count/${form.zaloAccountId}`);
    friendCount.value = res.data.count;
  } catch { friendCount.value = 0; }
}

const itemsModal = reactive({
  open: false, jobName: '',
  items: [] as Array<{ id: string; name: string | null; phone: string | null; status: string; error: string | null; createdAt: string }>,
});

const mediaPicker = reactive({ open: false, loading: false, items: [] as MediaAssetItem[] });

async function openMediaPicker(): Promise<void> {
  mediaPicker.open = true;
  mediaPicker.loading = true;
  try {
    mediaPicker.items = await listMedia({ kind: 'image', limit: 60, sort: 'recent' });
  } finally {
    mediaPicker.loading = false;
  }
}

function selectMedia(m: MediaAssetItem): void {
  form.imageUrl = m.url ?? '';
  mediaPicker.open = false;
}

async function load(): Promise<void> {
  try {
    const res = await api.get('/broadcast-jobs');
    jobs.value = res.data.jobs ?? [];
  } catch (err: any) {
    console.error('[broadcasts] load failed', err);
    toast(`Lỗi tải danh sách: ${err?.response?.data?.error ?? err.message}`, 'error');
    jobs.value = [];
  } finally {
    loading.value = false;
  }
}

async function openCreate(): Promise<void> {
  showCreate.value = true;
  if (lists.value.length === 0) {
    const [lr, nr] = await Promise.all([
      api.get('/customer-lists', { params: { status: 'active', limit: 100 } }),
      api.get('/zalo-accounts'),
    ]);
    lists.value = (lr.data.lists ?? lr.data ?? []).map((l: any) => ({
      id: l.id, name: l.name, hasZaloEntries: l.hasZaloEntries ?? 0,
    }));
    nicks.value = (nr.data.accounts ?? nr.data ?? []).map((n: any) => ({
      id: n.id, displayName: n.displayName, phone: n.phone, status: n.status,
    }));
  }
}

async function onSelectBlocksMode(): Promise<void> {
  form.contentMode = 'blocks';
  if (contentBlocks.value.length === 0) {
    const res = await api.get('/content-blocks');
    contentBlocks.value = res.data.blocks;
  }
}

function toggleBlock(id: string): void {
  const i = form.contentBlockIds.indexOf(id);
  if (i >= 0) form.contentBlockIds.splice(i, 1);
  else form.contentBlockIds.push(id);
}

function toggleDow(d: number): void {
  const i = form.daysOfWeek.indexOf(d);
  if (i >= 0) form.daysOfWeek.splice(i, 1);
  else form.daysOfWeek.push(d);
}

async function createJob(): Promise<void> {
  if (!form.name.trim()) return void toast('Nhập tên broadcast', 'error');
  if (!form.zaloAccountIds.length) return void toast('Chọn nick Zalo gửi', 'error');
  if (form.sourceType === 'customer_list' && !form.customerListId) return void toast('Chọn tệp khách hàng', 'error');
  if (form.sourceType === 'friends' && !friendCount.value) return void toast('Nick này chưa có bạn bè đã kết bạn', 'error');
  if (form.contentMode === 'text' && !form.messageText.trim()) return void toast('Nhập nội dung tin', 'error');
  if (form.contentMode === 'blocks' && form.contentBlockIds.length === 0) return void toast('Chọn ít nhất 1 khối nội dung', 'error');
  if (form.scheduleType === 'once' && !form.scheduledAtLocal) return void toast('Chọn ngày giờ gửi', 'error');
  if (form.scheduleType === 'weekly' && form.daysOfWeek.length === 0) return void toast('Chọn ngày trong tuần', 'error');

  creating.value = true;
  try {
    // Sprint 2 R4: build payload A/B nếu abMode='ab_split'.
    // Variant A = messageText, Variants B,C = variantTexts[0..abVariantCount-2]
    const isAb = form.abMode === 'ab_split';
    const abVariantCount = isAb ? Math.max(2, Math.min(3, form.variantTexts.length + 1)) : null;
    await api.post('/broadcast-jobs', {
      name: form.name, sourceType: form.sourceType,
      zaloAccountId: form.zaloAccountIds[0],
      zaloAccountIds: form.zaloAccountIds,
      sendMode: form.sendMode,
      customerListId: form.sourceType === 'customer_list' ? form.customerListId : undefined,
      messageText: isAb ? (form.variantTexts[0] || form.messageText) : (form.contentMode === 'text' ? form.messageText : ''),
      imageUrl: form.contentMode === 'text' ? form.imageUrl || null : null,
      contentBlockIds: form.contentMode === 'blocks' ? form.contentBlockIds : [],
      scheduleType: form.scheduleType,
      scheduledAt: form.scheduleType === 'once' ? new Date(form.scheduledAtLocal).toISOString() : null,
      timeOfDay: form.scheduleType !== 'once' ? form.timeOfDay : null,
      daysOfWeek: form.scheduleType === 'weekly' ? form.daysOfWeek : [],
      maxPerRun: form.maxPerRun, delaySecMin: form.delaySecMin, delaySecMax: form.delaySecMax,
      abMode: isAb ? 'ab_split' : 'off',
      abVariantCount: isAb ? abVariantCount : undefined,
      variantMessageTexts: isAb ? form.variantTexts.slice(1, abVariantCount! - 1) : undefined,
    });
    toast(isAb ? `Đã tạo broadcast A/B (${abVariantCount} variants)` : 'Đã tạo broadcast', 'success');
    showCreate.value = false;
    Object.assign(form, { name: '', sourceType: 'friends', customerListId: '', messageText: '', imageUrl: '', contentMode: 'text', contentBlockIds: [], scheduledAtLocal: '', daysOfWeek: [], abMode: 'off', variantTexts: ['', ''] });
    friendCount.value = null;
    await load();
  } catch (err: any) {
    toast(`Lỗi: ${err?.response?.data?.error ?? 'không tạo được'}`, 'error');
  } finally {
    creating.value = false;
  }
}

async function setStatus(job: JobRow, status: 'active' | 'paused'): Promise<void> {
  await api.patch(`/broadcast-jobs/${job.id}`, { status });
  await load();
}

async function runNow(job: JobRow): Promise<void> {
  if (!(await confirm({
    title: 'Chạy ngay?',
    message: `Gửi broadcast "${job.name}" tới ${job.sourceType === 'friends' ? 'bạn bè đã kết bạn của nick' : `tệp "${job.list?.name}"`} ngay bây giờ (worker bắt đầu trong ~30 giây).`,
    confirmText: 'Chạy ngay',
  }))) return;
  await api.post(`/broadcast-jobs/${job.id}/run-now`);
  toast('Đã xếp lịch chạy ngay', 'success');
  await load();
}

async function removeJob(job: JobRow): Promise<void> {
  if (!(await confirm({
    title: 'Xoá broadcast?',
    message: `Xoá "${job.name}" cùng toàn bộ log gửi. Không thể hoàn tác.`,
    confirmText: 'Xoá', tone: 'danger',
  }))) return;
  await api.delete(`/broadcast-jobs/${job.id}`);
  toast('Đã xoá', 'success');
  await load();
}

async function viewItems(job: JobRow, run: { id: string }): Promise<void> {
  const res = await api.get(`/broadcast-jobs/${job.id}/runs/${run.id}/items`);
  itemsModal.items = res.data.items;
  itemsModal.jobName = job.name;
  itemsModal.open = true;
}

function statusLabel(s: string): string {
  return s === 'active' ? 'Đang hoạt động' : s === 'paused' ? 'Tạm dừng' : 'Đã xong';
}
function itemStatusLabel(s: string): string {
  return s === 'sent' ? 'Đã gửi' : s === 'failed' ? 'Lỗi' : 'Bỏ qua';
}
function scheduleLabel(job: JobRow): string {
  if (job.scheduleType === 'once') return `1 lần — ${fmtDate(job.scheduledAt)}`;
  if (job.scheduleType === 'daily') return `Hàng ngày ${job.timeOfDay}`;
  const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `Hàng tuần ${job.daysOfWeek.map((d) => names[d]).join(', ')} lúc ${job.timeOfDay}`;
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(async () => {
  await load();
  pollTimer = setInterval(load, 15_000); // run đang chạy → cập nhật số liệu

  // Sprint 1 R3 2026-07-21: Phase 4 — pre-fill từ query.listId khi navigate từ ListsView.
  // Toast feedback cho user biết tệp đã được chọn.
  const qListId = route.query.listId;
  if (typeof qListId === 'string' && qListId) {
    await openCreate();
    form.sourceType = 'customer_list';
    form.customerListId = qListId;
    const picked = lists.value.find((l) => l.id === qListId);
    toast(`📂 Đã chọn tệp "${picked?.name ?? qListId}"`, 'success');
  }
});
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.bc-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.mkt-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 16px 20px 12px; border-bottom: 1px solid var(--border, #e5e4e7); flex-shrink: 0; }
.mtt { font-size: 18px; font-weight: 700; }
.mts { font-size: 13px; color: var(--text-secondary, #666); margin-top: 2px; max-width: 720px; }
.actions { display: flex; gap: 8px; flex-shrink: 0; }
.bc-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: auto; }
.heatmap-container { flex-shrink: 0; max-height: 140px; }

.bc-filter-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.bc-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 9999px;
  font-size: 12.5px;
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.15s ease;
}
.bc-filter-btn:hover {
  border-color: #0e445a;
  color: #0e445a;
}
.bc-filter-btn.active {
  background: #0e445a;
  border-color: #0e445a;
  color: #fff;
}
.bc-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 9px;
  font-size: 10.5px;
  font-weight: 700;
}
.bc-filter-btn:not(.active) .bc-filter-count {
  background: var(--bg-subtle, #f1f1f3);
}
.bc-empty { text-align: center; color: var(--text-secondary, #888); padding: 32px 0; }
.bc-card { display: flex; justify-content: space-between; gap: 12px; border: 1px solid var(--border, #e5e4e7); border-radius: 10px; padding: 12px 14px; background: var(--surface, #fff); }
.bc-card.st-paused { opacity: 0.75; }
.bc-card-head { display: flex; align-items: center; gap: 8px; }
.bc-name { font-weight: 700; }
.bc-badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
.b-active { background: #e1f5e9; color: #1b7a3d; }
.b-paused { background: #fdf3d7; color: #8a6d00; }
.b-done { background: #ececf0; color: #555; }
.bc-meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; color: var(--text-secondary, #666); margin-top: 4px; }
.bc-msg { font-size: 13px; margin-top: 6px; color: var(--text, #333); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 640px; }
.bc-run { margin-top: 6px; font-size: 12.5px; color: var(--text-secondary, #555); }
.run-badge { font-size: 11px; padding: 1px 7px; border-radius: 99px; font-weight: 600; margin-right: 6px; }
.r-running { background: #dcedff; color: #135ba1; }
.r-done, .r-sent { background: #e1f5e9; color: #1b7a3d; }
.r-error, .r-failed { background: #fde3e1; color: #a12318; }
.r-skipped { background: #ececf0; color: #555; }
.bc-card-actions { display: flex; gap: 4px; align-items: flex-start; flex-shrink: 0; }
.btn-link { background: none; border: none; color: #135ba1; cursor: pointer; font-size: 12.5px; text-decoration: underline; padding: 0; }
.danger { color: #a12318; }

.bc-overlay { position: fixed; inset: 0; background: rgba(20, 20, 30, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.bc-modal { background: var(--surface, #fff); border-radius: 12px; padding: 18px 20px; width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow: auto; }
.bc-modal-wide { width: 760px; }
.bc-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; }
.btn-x { background: none; border: none; cursor: pointer; padding: 2px; }
.bc-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.f-label { display: block; font-size: 12.5px; font-weight: 600; margin: 10px 0 4px; }
.f-hint { font-weight: 400; color: var(--text-secondary, #888); }
.f-note { font-size: 12.5px; line-height: 1.5; color: var(--text-secondary, #555); background: #f0f7f3; border: 1px solid #d3e8dd; border-radius: 8px; padding: 8px 10px; }
.f-note.warn { background: #fdf6e3; border-color: #f0e2b8; }
.f-input { width: 100%; border: 1px solid var(--border, #d5d4d8); border-radius: 8px; padding: 7px 10px; font-size: 13.5px; background: var(--surface, #fff); color: inherit; }
.f-row { display: flex; gap: 10px; }
.f-col { flex: 1; min-width: 0; }
.f-grow { flex: 2; }
.f-tabs { display: flex; gap: 6px; }
.f-tab { border: 1px solid var(--border, #d5d4d8); background: none; border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
.f-tab.on { background: #0e445a; color: #fff; border-color: #0e445a; }
.f-dows { display: flex; gap: 4px; flex-wrap: wrap; }
.f-dow { border: 1px solid var(--border, #d5d4d8); background: none; border-radius: 6px; padding: 5px 9px; font-size: 12.5px; cursor: pointer; }
.f-dow.on { background: #0e445a; color: #fff; border-color: #0e445a; }
.f-adv { margin-top: 12px; font-size: 13px; }
.f-adv summary { cursor: pointer; font-weight: 600; }
.bc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bc-table th, .bc-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border, #eee); }
.err { color: #a12318; font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.f-image-row { display: flex; align-items: center; gap: 10px; }
.f-image-preview { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border, #d5d4d8); flex-shrink: 0; }
.f-image-actions { display: flex; gap: 6px; }
.f-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; max-height: 60vh; overflow: auto; }
.f-media-item { border: 1px solid var(--border, #d5d4d8); border-radius: 8px; padding: 0; cursor: pointer; overflow: hidden; aspect-ratio: 1; background: none; }
.f-media-item:hover { border-color: #0e445a; }
.f-media-item img { width: 100%; height: 100%; object-fit: cover; display: block; }

.f-block-list { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow: auto; }
.f-block-item { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border, #d5d4d8); border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.f-block-item:hover { border-color: #0e445a; }
.f-block-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.f-block-info { min-width: 0; flex: 1; }
.f-block-name { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.f-block-order { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #0e445a; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.f-block-text { font-size: 12px; color: var(--text-secondary, #888); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
