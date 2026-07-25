<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  MobileContactView (2026-07-26 redesign clean).
  -->
<template>
  <div class="mcb-root">
    <header class="mcb-topbar">
      <div class="mcb-title">Khách hàng</div>
      <v-btn icon variant="text" size="small" @click="openCreate">
        <v-icon>mdi-plus</v-icon>
      </v-btn>
    </header>

    <div class="mcb-search">
      <v-text-field
        v-model="filters.search"
        placeholder="Tìm tên hoặc SĐT..."
        prepend-inner-icon="mdi-magnify"
        variant="filled"
        density="compact"
        hide-details
        clearable
        rounded="lg"
        @update:model-value="onSearch"
      />
    </div>

    <div class="mcb-filters">
      <button
        v-for="status in STATUS_OPTIONS"
        :key="status.value"
        class="mcb-tab"
        :class="{ active: filters.status === status.value }"
        @click="toggleStatus(status.value)"
      >
        <span :class="['mcb-dot', status.value]" />
        {{ status.text }}
      </button>
    </div>

    <div v-if="loading" class="mcb-loading">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="!contacts.length" class="mcb-empty">
      <v-icon size="48" color="grey">mdi-account-search-outline</v-icon>
      <div class="mt-2 text-grey">Không tìm thấy khách</div>
    </div>
    <div v-else class="mcb-list">
      <button
        v-for="contact in contacts"
        :key="contact.id"
        class="mcb-row"
        @click="openContact(contact)"
      >
        <v-avatar :color="statusColor(contact.status)" size="40" class="mr-3">
          <span class="text-white font-weight-bold">{{ initials(contact.fullName) }}</span>
        </v-avatar>
        <div class="mcb-info">
          <div class="mcb-name">
            {{ contact.fullName || 'Chưa đặt tên' }}
            <v-icon v-if="contact.hasZalo" size="14" color="success" class="ml-1">mdi-check-circle</v-icon>
          </div>
          <div class="mcb-phone">{{ contact.phone || 'Chưa có SĐT' }}</div>
        </div>
        <div class="mcb-meta">
          <span v-if="contact.status" class="mcb-pill" :class="contact.status">
            {{ statusLabel(contact.status) }}
          </span>
        </div>
      </button>
    </div>

    <ContactDetailDialog
      v-model="showDialog"
      :contact="selectedContact"
      @saved="onSaved"
      @deleted="onDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import ContactDetailDialog from '@/components/contacts/ContactDetailDialog.vue';
import { useContacts, STATUS_OPTIONS } from '@/composables/use-contacts';
import type { Contact } from '@/composables/use-contacts';

const { contacts, loading, filters, fetchContacts } = useContacts();

const showDialog = ref(false);
const selectedContact = ref<Contact | null>(null);

function statusColor(status: string): string {
  const map: Record<string, string> = {
    new: '#9ca3af', contacted: '#3b82f6', interested: '#f59e0b',
    converted: '#10b981', lost: '#ef4444',
  };
  return map[status] ?? '#9ca3af';
}
function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.text ?? value;
}
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function toggleStatus(value: string) {
  filters.status = filters.status === value ? '' : value;
  fetchContacts();
}

let searchTimeout: ReturnType<typeof setTimeout>;
function onSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchContacts(), 300);
}

function openContact(contact: Contact) {
  selectedContact.value = contact;
  showDialog.value = true;
}
function openCreate() {
  selectedContact.value = null;
  showDialog.value = true;
}
function onSaved() { fetchContacts(); }
function onDeleted() { fetchContacts(); }

onMounted(() => fetchContacts());
onUnmounted(() => clearTimeout(searchTimeout));
</script>

<style scoped>
.mcb-root {
  background: #f7f8fb;
  min-height: 100%;
  padding-bottom: 88px;
}
.mcb-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eef0f4;
}
.mcb-title { font-size: 18px; font-weight: 700; color: #0c2233; }
.mcb-search { padding: 12px 16px; background: white; }
.mcb-search :deep(.v-field) { border-radius: 12px; }
.mcb-filters {
  display: flex; gap: 6px;
  padding: 4px 12px 12px;
  background: white;
  border-bottom: 1px solid #eef0f4;
  overflow-x: auto;
}
.mcb-tab {
  flex: none;
  padding: 8px 12px;
  border-radius: 999px;
  background: #f1f3f7;
  color: #4a5568;
  font-size: 12px; font-weight: 500;
  border: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.mcb-tab.active { background: #0c2233; color: white; }
.mcb-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.mcb-loading, .mcb-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 48px 16px;
}
.mcb-list { padding-top: 8px; }
.mcb-row {
  display: flex; align-items: center;
  width: 100%; padding: 12px 16px;
  background: white; border: none; border-bottom: 1px solid #f1f3f7;
  cursor: pointer; text-align: left;
}
.mcb-row:active { background: #f7f8fb; }
.mcb-info { flex: 1; min-width: 0; }
.mcb-name {
  font-size: 14px; font-weight: 600; color: #0c2233;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center;
}
.mcb-phone { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mcb-meta { margin-left: 8px; }
.mcb-pill {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px; font-weight: 600;
  color: white;
}
.mcb-pill.new { background: #9ca3af; }
.mcb-pill.contacted { background: #3b82f6; }
.mcb-pill.interested { background: #f59e0b; }
.mcb-pill.converted { background: #10b981; }
.mcb-pill.lost { background: #ef4444; }
</style>
