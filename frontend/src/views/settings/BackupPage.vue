<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!-- BackupPage — Sprint 8 R13 (2026-07-22). Owner-only backup/restore settings. -->
<template>
  <div class="bp-wrap">
    <!-- Header -->
    <header class="bp-head">
      <div class="bp-head-ico">☁️</div>
      <div>
        <h1 class="bp-title">Backup & Khôi phục</h1>
        <p class="bp-sub">Tạo backup toàn bộ dữ liệu tổ chức hoặc khôi phục từ file backup. <strong>Chỉ chủ sở hữu</strong> được thực hiện.</p>
      </div>
      <button class="bp-export-btn" :disabled="exporting" @click="handleExport">
        <span v-if="exporting">⏳ Đang tạo backup…</span>
        <span v-else>📦 Tạo Backup mới</span>
      </button>
    </header>

    <!-- Stats Cards -->
    <div class="bp-stats">
      <div class="bp-stat-card">
        <div class="bp-stat-ico">📦</div>
        <div class="bp-stat-info">
          <span class="bp-stat-value">{{ backups.length }}</span>
          <span class="bp-stat-label">Tổng backup</span>
        </div>
      </div>
      <div class="bp-stat-card">
        <div class="bp-stat-ico">🕒</div>
        <div class="bp-stat-info">
          <span class="bp-stat-value">{{ lastBackupDate || '—' }}</span>
          <span class="bp-stat-label">Backup gần nhất</span>
        </div>
      </div>
      <div class="bp-stat-card">
        <div class="bp-stat-ico">💾</div>
        <div class="bp-stat-info">
          <span class="bp-stat-value">{{ formatBytes(totalStorage) }}</span>
          <span class="bp-stat-label">Dung lượng sử dụng</span>
        </div>
      </div>
    </div>

    <!-- Loading / Empty -->
    <div v-if="loading" class="bp-loading">
      <span>⏳ Đang tải danh sách backup…</span>
    </div>
    <div v-else-if="backups.length === 0" class="bp-empty">
      <span class="bp-empty-ico">☁️</span>
      <p>Chưa có backup nào. Nhấn <strong>Tạo Backup mới</strong> để bắt đầu.</p>
    </div>

    <!-- Backup Table -->
    <div v-else class="bp-table-wrap">
      <table class="bp-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Ngày tạo</th>
            <th>Dung lượng</th>
            <th>Chi tiết</th>
            <th class="bp-th-actions">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in backups" :key="b.id">
            <td class="bp-filename">
              <span class="bp-file-ico">📄</span>
              {{ b.filename }}
            </td>
            <td class="bp-date">{{ fmtDate(b.createdAt) }}</td>
            <td class="bp-size">{{ formatBytes(b.sizeBytes) }}</td>
            <td class="bp-detail">
              <span v-if="b.counts" class="bp-counts">
                <span v-for="(val, key) in b.counts" :key="key" class="bp-count-chip">
                  {{ key }}: {{ val }}
                </span>
              </span>
              <span v-else class="bp-no-counts">—</span>
            </td>
            <td class="bp-actions">
              <button class="bp-btn bp-btn-ghost" title="Tải về" @click="handleDownload(b)">
                ⬇️ Tải về
              </button>
              <button class="bp-btn bp-btn-ghost" title="Dry-run khôi phục" @click="openDryRun(b)">
                🔍 Dry-run
              </button>
              <button class="bp-btn bp-btn-danger-ghost" title="Khôi phục" @click="openRestore(b)">
                🔄 Khôi phục
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Restore Modal -->
    <div v-if="showRestoreModal" class="bp-modal-overlay" @click.self="closeModal">
      <div class="bp-modal">
        <header class="bp-modal-head">
          <h2>Khôi phục Backup</h2>
          <button class="bp-modal-close" @click="closeModal">✕</button>
        </header>

        <!-- Dry-run result -->
        <div v-if="dryRunLoading" class="bp-modal-body bp-modal-center">
          <span>⏳ Đang kiểm tra backup…</span>
        </div>
        <div v-else-if="dryRunResult" class="bp-modal-body">
          <!-- Warnings -->
          <div v-if="dryRunResult.warnings.length > 0" class="bp-alert bp-alert-warn">
            <strong>⚠️ Cảnh báo:</strong>
            <ul class="bp-alert-list">
              <li v-for="(w, i) in dryRunResult.warnings" :key="i">{{ w }}</li>
            </ul>
          </div>

          <!-- Conflicts -->
          <div v-if="dryRunResult.conflicts.length > 0" class="bp-alert bp-alert-error">
            <strong>🚫 Conflict ({{ dryRunResult.conflicts.length }}):</strong>
            <ul class="bp-alert-list">
              <li v-for="(c, i) in dryRunResult.conflicts.slice(0, 10)" :key="i">
                {{ c.entity }} ({{ c.id }}): {{ c.reason }}
              </li>
              <li v-if="dryRunResult.conflicts.length > 10">
                …và {{ dryRunResult.conflicts.length - 10 }} conflict khác
              </li>
            </ul>
          </div>

          <!-- Counts -->
          <div class="bp-dry-run-counts">
            <h3>📊 Dữ liệu trong backup:</h3>
            <div class="bp-counts-grid">
              <div v-for="(val, key) in dryRunResult.counts" :key="key" class="bp-count-item">
                <span class="bp-count-key">{{ key }}</span>
                <span class="bp-count-val">{{ val }}</span>
              </div>
            </div>
          </div>

          <!-- Restore mode selection -->
          <div class="bp-restore-mode">
            <h3>Chế độ khôi phục:</h3>
            <label class="bp-radio">
              <input type="radio" value="merge" v-model="restoreMode" />
              <strong>Merge</strong> — bỏ qua dữ liệu trùng lặp, chỉ thêm mới
            </label>
            <label class="bp-radio">
              <input type="radio" value="replace" v-model="restoreMode" />
              <strong>Replace</strong> — thay thế toàn bộ dữ liệu hiện tại
              <span class="bp-badge-warn">Cảnh báo: dữ liệu hiện tại có thể bị ghi đè</span>
            </label>
          </div>
        </div>

        <!-- Restore error -->
        <div v-if="dryRunError" class="bp-modal-body bp-modal-center">
          <div class="bp-alert bp-alert-error">
            <strong>❌ Lỗi:</strong> {{ dryRunError }}
          </div>
        </div>

        <!-- Actions -->
        <footer class="bp-modal-foot">
          <button class="bp-btn" @click="closeModal" :disabled="restoring">Huỷ</button>
          <button
            class="bp-btn bp-btn-primary"
            @click="handleRestore"
            :disabled="restoring || dryRunLoading || !!dryRunError"
          >
            <span v-if="restoring">⏳ Đang khôi phục…</span>
            <span v-else>🔄 Xác nhận khôi phục</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/use-toast';
import { exportBackup, listBackups, downloadBackup, dryRunRestore, applyRestore, type BackupRecord, type DryRunResult } from '@/api/backup';

const toast = useToast();

// State
const backups = ref<BackupRecord[]>([]);
const loading = ref(false);
const exporting = ref(false);
const restoring = ref(false);

// Restore modal state
const showRestoreModal = ref(false);
const selectedBackup = ref<BackupRecord | null>(null);
const dryRunLoading = ref(false);
const dryRunResult = ref<DryRunResult | null>(null);
const dryRunError = ref<string | null>(null);
const restoreMode = ref<'merge' | 'replace'>('merge');

// Computed stats
const totalStorage = computed(() => backups.value.reduce((s, b) => s + (b.sizeBytes || 0), 0));
const lastBackupDate = computed(() => {
  if (backups.value.length === 0) return '';
  const latest = backups.value[0]?.createdAt;
  return latest ? fmtDate(latest) : '';
});

// Load backups
async function load() {
  loading.value = true;
  try {
    backups.value = await listBackups();
  } catch {
    toast.error('Không tải được danh sách backup');
    backups.value = [];
  } finally {
    loading.value = false;
  }
}

// Export new backup
async function handleExport() {
  exporting.value = true;
  try {
    const result = await exportBackup();
    toast.success(`Đã tạo backup: ${result.filename}`);
    await load();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Tạo backup thất bại';
    toast.error(msg);
  } finally {
    exporting.value = false;
  }
}

// Download backup
async function handleDownload(b: BackupRecord) {
  try {
    const blob = await downloadBackup(b.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = b.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Đã tải: ${b.filename}`);
  } catch {
    toast.error('Tải backup thất bại');
  }
}

// Open restore modal (trigger dry-run)
async function openDryRun(b: BackupRecord) {
  selectedBackup.value = b;
  showRestoreModal.value = true;
  dryRunLoading.value = true;
  dryRunResult.value = null;
  dryRunError.value = null;
  restoreMode.value = 'merge';

  try {
    dryRunResult.value = await dryRunRestore(b.storageKey);
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Dry-run thất bại';
    dryRunError.value = msg;
  } finally {
    dryRunLoading.value = false;
  }
}

async function openRestore(b: BackupRecord) {
  await openDryRun(b);
}

// Confirm restore
async function handleRestore() {
  if (!selectedBackup.value) return;
  restoring.value = true;
  try {
    const result = await applyRestore(selectedBackup.value.storageKey, restoreMode.value);
    toast.success(`Khôi phục xong: ${result.applied} bản ghi, ${result.skipped} bị bỏ qua`);
    closeModal();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Khôi phục thất bại';
    toast.error(msg);
  } finally {
    restoring.value = false;
  }
}

function closeModal() {
  showRestoreModal.value = false;
  selectedBackup.value = null;
  dryRunResult.value = null;
  dryRunError.value = null;
}

// Helpers
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

onMounted(load);
</script>

<style scoped>
.bp-wrap { padding: 20px 24px; max-width: 1200px; }

/* Header */
.bp-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.bp-head-ico { width: 48px; height: 48px; border-radius: 14px; background: #eff6ff; display: grid; place-items: center; font-size: 24px; flex: none; }
.bp-title { font-size: 20px; font-weight: 700; color: #0e445a; margin: 0 0 4px; }
.bp-sub { font-size: 13px; color: #6b7280; margin: 0; line-height: 1.5; }
.bp-export-btn {
  margin-left: auto; background: #5e6ad2; color: #fff; border: none;
  padding: 10px 20px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.bp-export-btn:hover:not(:disabled) { background: #4b55c0; }
.bp-export-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Stats */
.bp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.bp-stat-card { background: #fff; border: 1px solid #e4e5e9; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; }
.bp-stat-ico { font-size: 26px; }
.bp-stat-info { display: flex; flex-direction: column; gap: 2px; }
.bp-stat-value { font-size: 18px; font-weight: 700; color: #1f2d3d; }
.bp-stat-label { font-size: 11.5px; color: #97a0ac; }

/* Loading / Empty */
.bp-loading, .bp-empty { text-align: center; padding: 48px; color: #6b7280; background: #fff; border: 1px solid #e4e5e9; border-radius: 12px; }
.bp-empty-ico { font-size: 40px; display: block; margin-bottom: 8px; }
.bp-empty p { margin: 0; font-size: 13.5px; }

/* Table */
.bp-table-wrap { background: #fff; border: 1px solid #e4e5e9; border-radius: 12px; overflow: hidden; }
.bp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bp-table th {
  text-align: left; padding: 10px 14px; background: #f7f8fa; color: #6b7280;
  font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
  border-bottom: 1px solid #e4e5e9;
}
.bp-table td { padding: 11px 14px; border-bottom: 1px solid #f0f1f3; color: #2b2f36; vertical-align: middle; }
.bp-table tr:last-child td { border-bottom: none; }
.bp-table tr:hover td { background: #fafbfc; }
.bp-th-actions { text-align: right; }

.bp-filename { font-weight: 500; white-space: nowrap; }
.bp-file-ico { margin-right: 6px; }
.bp-date { color: #6b7280; white-space: nowrap; font-size: 12.5px; }
.bp-size { font-variant-numeric: tabular-nums; white-space: nowrap; }

.bp-detail { max-width: 280px; }
.bp-counts { display: flex; flex-wrap: wrap; gap: 4px; }
.bp-count-chip { font-size: 11px; background: #f0f1f3; color: #41454d; padding: 2px 7px; border-radius: 4px; }
.bp-no-counts { color: #97a0ac; }

.bp-actions { text-align: right; white-space: nowrap; }

/* Buttons */
.bp-btn {
  font-size: 12.5px; font-weight: 500; padding: 6px 12px;
  border-radius: 7px; cursor: pointer; border: 1px solid #d4d6db;
  background: #fff; color: #41454d; transition: all 0.12s;
}
.bp-btn:hover:not(:disabled) { background: #f0f1f3; }
.bp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bp-btn-ghost { border-color: transparent; }
.bp-btn-ghost:hover:not(:disabled) { background: #f0f1f3; border-color: #d4d6db; }
.bp-btn-danger-ghost { border-color: transparent; color: #dc2626; }
.bp-btn-danger-ghost:hover:not(:disabled) { background: #fef2f2; border-color: #fca5a5; }
.bp-btn-primary { background: #5e6ad2; color: #fff; border-color: #5e6ad2; }
.bp-btn-primary:hover:not(:disabled) { background: #4b55c0; border-color: #4b55c0; }

/* Modal */
.bp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: grid; place-items: center; z-index: 9999; }
.bp-modal { background: #fff; border-radius: 16px; width: 640px; max-width: 95vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
.bp-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #e4e5e9; }
.bp-modal-head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #0e445a; }
.bp-modal-close { background: transparent; border: none; font-size: 18px; cursor: pointer; color: #97a0ac; padding: 4px 8px; border-radius: 6px; }
.bp-modal-close:hover { background: #f0f1f3; color: #41454d; }
.bp-modal-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
.bp-modal-center { display: grid; place-items: center; min-height: 100px; color: #6b7280; }
.bp-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #e4e5e9; background: #fafbfc; }

/* Alerts */
.bp-alert { border-radius: 8px; padding: 12px 14px; font-size: 13px; margin-bottom: 14px; }
.bp-alert-warn { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.bp-alert-error { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
.bp-alert-list { margin: 6px 0 0; padding-left: 20px; }
.bp-alert-list li { margin-bottom: 2px; }

/* Dry-run counts */
.bp-dry-run-counts { margin-bottom: 16px; }
.bp-dry-run-counts h3 { font-size: 13.5px; font-weight: 600; color: #1f2d3d; margin: 0 0 10px; }
.bp-counts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.bp-count-item { background: #f7f8fa; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
.bp-count-key { font-size: 11px; color: #6b7280; text-transform: capitalize; }
.bp-count-val { font-size: 18px; font-weight: 700; color: #1f2d3d; }

/* Restore mode */
.bp-restore-mode { }
.bp-restore-mode h3 { font-size: 13.5px; font-weight: 600; color: #1f2d3d; margin: 0 0 10px; }
.bp-radio { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid #e4e5e9; border-radius: 8px; cursor: pointer; margin-bottom: 8px; font-size: 13px; color: #2b2f36; transition: background 0.12s; }
.bp-radio:has(input:checked) { background: #eef0ff; border-color: #5e6ad2; }
.bp-radio input { margin-top: 3px; flex-shrink: 0; accent-color: #5e6ad2; }
.bp-badge-warn { font-size: 11.5px; color: #dc2626; display: block; margin-top: 2px; }
</style>
