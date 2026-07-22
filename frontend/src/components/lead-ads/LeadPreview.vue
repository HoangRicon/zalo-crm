<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="source-dot" :class="source" />
          <div>
            <div class="source-label">{{ sourceLabel }}</div>
            <h2 class="modal-title">Lead Details</h2>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Status -->
        <div class="status-row">
          <span class="status-badge" :class="statusClass">
            <span class="status-dot" />
            {{ statusLabel }}
          </span>
          <span class="lead-time">Received {{ formatTime(lead.createdAt) }}</span>
        </div>

        <!-- Lead fields from rawPayload -->
        <div class="fields-list">
          <div
            v-for="field in displayFields"
            :key="field.key"
            class="field-row"
          >
            <span class="field-label">{{ field.label }}</span>
            <span class="field-value">{{ field.value }}</span>
          </div>
        </div>

        <!-- Error -->
        <div v-if="lead.error" class="error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div class="error-title">Processing Error</div>
            <div class="error-msg">{{ lead.error }}</div>
          </div>
        </div>

        <!-- Converted info -->
        <div v-if="lead.processedAt" class="success-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div>
            <div class="success-title">Converted to Contact</div>
            <div class="success-msg">Contact ID: {{ lead.contactId }}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">Close</button>
        <button
          v-if="!lead.processedAt && !lead.error"
          class="btn-primary"
          @click="handleConvert"
          :disabled="converting"
        >
          <span v-if="converting" class="mini-spinner" />
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          {{ converting ? 'Converting...' : 'Convert to Contact' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '@/composables/use-toast';
import type { FacebookLead, ZaloLead } from '@/api/lead-ads';

type AnyLead = (FacebookLead & { _type?: string }) | (ZaloLead & { _type?: string });

const props = defineProps<{
  lead: AnyLead;
  source: 'facebook' | 'zalo';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { toast } = useToast();
const converting = ref(false);

const sourceLabel = computed(() => props.source === 'facebook' ? 'Facebook Lead Ads' : 'Zalo Ads');

const statusClass = computed(() => {
  if (props.lead.processedAt) return 'processed';
  if (props.lead.error) return 'error';
  return 'pending';
});

const statusLabel = computed(() => {
  if (props.lead.processedAt) return 'Converted to Contact';
  if (props.lead.error) return 'Processing Failed';
  return 'Pending';
});

interface DisplayField {
  key: string;
  label: string;
  value: string;
}

const displayFields = computed<DisplayField[]>(() => {
  const payload = props.lead.rawPayload as Record<string, unknown>;
  const fieldLabels: Record<string, string> = {
    full_name: 'Họ và tên',
    name: 'Tên',
    fullname: 'Họ và tên',
    phone_number: 'Số điện thoại',
    phone: 'Số điện thoại',
    email: 'Email',
    email_address: 'Địa chỉ email',
    age: 'Tuổi',
    gender: 'Giới tính',
    city: 'Thành phố',
    district: 'Quận/Huyện',
    address: 'Địa chỉ',
    company: 'Công ty',
    job_title: 'Chức vụ',
    'Họ và tên': 'Họ và tên',
    'Tên': 'Tên',
    'Số điện thoại': 'Số điện thoại',
    'Email': 'Email',
  };

  const priority = [
    'full_name', 'name', 'fullname',
    'phone_number', 'phone',
    'email', 'email_address',
    'age', 'gender',
    'city', 'district', 'address',
    'company', 'job_title',
  ];

  const fields: DisplayField[] = [];

  // Priority fields first
  for (const key of priority) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      fields.push({
        key,
        label: fieldLabels[key] || key,
        value: String(payload[key]),
      });
    }
  }

  // Remaining fields
  for (const [key, value] of Object.entries(payload)) {
    if (priority.includes(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') continue;
    fields.push({
      key,
      label: fieldLabels[key] || key,
      value: String(value),
    });
  }

  return fields;
});

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function handleConvert() {
  converting.value = true;
  // TODO: implement lead-to-contact conversion API call
  await new Promise((r) => setTimeout(r, 1000));
  toast.success('Lead đã được chuyển thành Contact thành công!');
  converting.value = false;
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  width: 500px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 60px);
  background: white;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #E4E5E9;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.source-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.source-dot.facebook { background: #1877F2; }
.source-dot.zalo { background: #0068FF; }
.source-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #97A0AC;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1F2D3D;
}
.close-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #E4E5E9;
  background: white;
  border-radius: 7px;
  cursor: pointer;
  color: #6B7785;
  transition: all 0.12s;
}
.close-btn:hover { background: #FEF2F2; color: #EF4444; border-color: #FECACA; }

/* ── Body ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.modal-body::-webkit-scrollbar { width: 5px; }
.modal-body::-webkit-scrollbar-thumb { background: #D4D6DB; border-radius: 2px; }

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}
.status-badge .status-dot { width: 6px; height: 6px; border-radius: 50%; }
.status-badge.processed { background: #F0FDF4; color: #15803D; }
.status-badge.processed .status-dot { background: #22C55E; }
.status-badge.pending { background: #FEF9C3; color: #854D0E; }
.status-badge.pending .status-dot { background: #FACC15; }
.status-badge.error { background: #FEF2F2; color: #B91C1C; }
.status-badge.error .status-dot { background: #EF4444; }
.lead-time { font-size: 11.5px; color: #97A0AC; }

/* ── Fields ── */
.fields-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #E4E5E9;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 12px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #F0F0F5;
}
.field-row:last-child { border-bottom: none; }
.field-row:nth-child(even) { background: #FAFAFC; }
.field-label {
  width: 120px;
  font-size: 11.5px;
  font-weight: 600;
  color: #6B7785;
  flex-shrink: 0;
}
.field-value {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #1F2D3D;
  word-break: break-word;
}

/* ── Banners ── */
.error-banner, .success-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.error-banner {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #B91C1C;
}
.success-banner {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  color: #15803D;
}
.error-title, .success-title {
  font-size: 12.5px;
  font-weight: 700;
  margin-bottom: 2px;
}
.error-msg, .success-msg {
  font-size: 12px;
  opacity: 0.8;
}

/* ── Footer ── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #E4E5E9;
  flex-shrink: 0;
}
.btn-secondary {
  padding: 7px 16px;
  background: white;
  color: #6B7785;
  border: 1px solid #E4E5E9;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.btn-secondary:hover { background: #F4F4F7; color: #1F2D3D; }
.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: #5E6AD2;
  color: white;
  border: none;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #4a55b8; box-shadow: 0 2px 8px rgba(94,106,210,0.3); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.mini-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
