<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="lead-ads-page">
    <!-- Page header -->
    <div class="page-header">
      <div class="header-title">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <div>
          <h1 class="title">Lead Ads</h1>
          <p class="subtitle">Quản lý lead từ Facebook Lead Ads & Zalo Ads</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'facebook' }"
        @click="activeTab = 'facebook'"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Facebook Lead Ads
        <span v-if="fbLoading" class="tab-spinner" />
        <span v-else-if="fbForms.length > 0" class="tab-count">{{ fbForms.length }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'zalo' }"
        @click="activeTab = 'zalo'"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        Zalo Ads Lead Forms
        <span v-if="zaloLoading" class="tab-spinner" />
        <span v-else-if="zaloForms.length > 0" class="tab-count">{{ zaloForms.length }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="tab-content">
      <!-- Facebook tab -->
      <div v-if="activeTab === 'facebook'" class="tab-panel">
        <FacebookFormsTable
          :forms="fbForms"
          :loading="fbLoading"
          :error="fbError"
          @view-detail="onFbViewDetail"
          @pull="onFbPull"
          @archive="onFbArchive"
          @reload="loadFacebookForms"
        />
      </div>

      <!-- Zalo tab -->
      <div v-else-if="activeTab === 'zalo'" class="tab-panel">
        <ZaloFormsTable
          :forms="zaloForms"
          :loading="zaloLoading"
          :error="zaloError"
          @view-detail="onZaloViewDetail"
          @reload="loadZaloForms"
        />
      </div>
    </div>

    <!-- Detail drawer -->
    <LeadAdsDetail
      v-if="detailForm"
      :form="detailForm"
      :source="detailSource"
      @close="detailForm = null"
      @preview="onPreviewLead"
    />

    <!-- Lead preview modal -->
    <LeadPreview
      v-if="previewLead"
      :lead="previewLead"
      :source="detailSource"
      @close="previewLead = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useToast } from '@/composables/use-toast';
import { facebookLeadAdsApi, zaloAdsApi } from '@/api/lead-ads';
import type { FacebookForm, ZaloForm, FacebookLead, ZaloLead } from '@/api/lead-ads';
import FacebookFormsTable from '@/components/lead-ads/FacebookFormsTable.vue';
import ZaloFormsTable from '@/components/lead-ads/ZaloFormsTable.vue';
import LeadAdsDetail from '@/components/lead-ads/LeadAdsDetail.vue';
import LeadPreview from '@/components/lead-ads/LeadPreview.vue';

type DetailSource = 'facebook' | 'zalo';

const { toast } = useToast();

// ─── Tab state ────────────────────────────────────────────────────────────────
const activeTab = ref<'facebook' | 'zalo'>('facebook');

// ─── Facebook state ────────────────────────────────────────────────────────────
const fbForms = ref<FacebookForm[]>([]);
const fbLoading = ref(false);
const fbError = ref<string | null>(null);

// ─── Zalo state ────────────────────────────────────────────────────────────────
const zaloForms = ref<ZaloForm[]>([]);
const zaloLoading = ref(false);
const zaloError = ref<string | null>(null);

// ─── Detail drawer ────────────────────────────────────────────────────────────
const detailForm = ref<(FacebookForm & { _type?: string }) | (ZaloForm & { _type?: string }) | null>(null);
const detailSource = ref<DetailSource>('facebook');

// ─── Preview modal ────────────────────────────────────────────────────────────
const previewLead = ref<(FacebookLead & { _type?: string }) | (ZaloLead & { _type?: string }) | null>(null);

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadFacebookForms() {
  fbLoading.value = true;
  fbError.value = null;
  try {
    fbForms.value = await facebookLeadAdsApi.listForms();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thể tải danh sách form';
    fbError.value = msg;
    toast.error(msg);
  } finally {
    fbLoading.value = false;
  }
}

async function loadZaloForms() {
  zaloLoading.value = true;
  zaloError.value = null;
  try {
    zaloForms.value = await zaloAdsApi.listForms();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thể tải danh sách form';
    zaloError.value = msg;
    toast.error(msg);
  } finally {
    zaloLoading.value = false;
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
function onFbViewDetail(form: FacebookForm) {
  detailForm.value = { ...form, _type: 'facebook' };
  detailSource.value = 'facebook';
}

function onZaloViewDetail(form: ZaloForm) {
  detailForm.value = { ...form, _type: 'zalo' };
  detailSource.value = 'zalo';
}

async function onFbPull(form: FacebookForm) {
  try {
    await facebookLeadAdsApi.triggerPull(form.id);
    toast.success('Đã gửi yêu cầu sync cho form');
    loadFacebookForms();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Pull thất bại';
    toast.error(msg);
  }
}

async function onFbArchive(form: FacebookForm) {
  try {
    await facebookLeadAdsApi.updateForm(form.id, { status: 'archived' });
    toast.success('Đã lưu trữ form');
    loadFacebookForms();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Cập nhật thất bại';
    toast.error(msg);
  }
}

function onPreviewLead(lead: FacebookLead | ZaloLead) {
  previewLead.value = { ...lead, _type: detailSource.value } as typeof previewLead.value;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
watch(activeTab, (tab) => {
  if (tab === 'zalo' && zaloForms.value.length === 0 && !zaloLoading.value) {
    loadZaloForms();
  }
});

onMounted(() => {
  loadFacebookForms();
});
</script>

<style scoped>
.lead-ads-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-icon {
  color: #5E6AD2;
  flex-shrink: 0;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1F2D3D;
  letter-spacing: -0.02em;
}
.subtitle {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: #6B7785;
}

/* ── Tabs ── */
.tabs-bar {
  display: flex;
  gap: 4px;
  background: white;
  border: 1px solid #E4E5E9;
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 20px;
  width: fit-content;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: #6B7785;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.tab-btn:hover {
  background: #F4F4F7;
  color: #1F2D3D;
}
.tab-btn.active {
  background: #5E6AD2;
  color: white;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(94, 106, 210, 0.3);
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(255,255,255,0.25);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.tab-btn:not(.active) .tab-count {
  background: #EEF0FF;
  color: #5E6AD2;
}
.tab-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.tab-btn:not(.active) .tab-spinner {
  border-color: rgba(94,106,210,0.2);
  border-top-color: #5E6AD2;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Content ── */
.tab-content {
  flex: 1;
}
.tab-panel {
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
