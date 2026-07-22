// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * backup.ts — API client cho Backup Settings (Sprint 8 R13).
 */
import { api } from './index';

export interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  counts: Record<string, number>;
  storageKey: string;
}

export interface DryRunResult {
  counts: Record<string, number>;
  warnings: string[];
  conflicts: Array<{ entity: string; id: string; reason: string }>;
}

export interface RestoreResult {
  applied: number;
  skipped: number;
}

/** Tạo backup mới — export toàn bộ org data. */
export async function exportBackup(): Promise<{ filename: string; sizeBytes: number; storageKey: string; counts: Record<string, number> }> {
  const { data } = await api.post('/backup/export');
  return data;
}

/** Liệt kê các backup đã tạo. */
export async function listBackups(): Promise<BackupRecord[]> {
  const { data } = await api.get('/backup/list');
  return (data.items ?? []) as BackupRecord[];
}

/** Tải file backup về máy. */
export async function downloadBackup(id: string): Promise<Blob> {
  const response = await api.get(`/backup/download/${id}`, { responseType: 'blob' });
  return response.data as Blob;
}

/** Dry-run restore — kiểm tra conflicts trước khi apply. */
export async function dryRunRestore(storageKey: string): Promise<DryRunResult> {
  const { data } = await api.post('/backup/restore/dry-run', { storageKey });
  return data as DryRunResult;
}

/** Apply restore — xác nhận khôi phục backup. */
export async function applyRestore(storageKey: string, mode: 'merge' | 'replace' = 'merge'): Promise<RestoreResult> {
  const { data } = await api.post('/backup/restore/confirm', { storageKey, mode });
  return data as RestoreResult;
}
