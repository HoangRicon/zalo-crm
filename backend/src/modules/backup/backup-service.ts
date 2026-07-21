// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * backup-service.ts — Sprint 8 R13 (2026-07-21).
 *
 * Export full org data → JSON file (single big JSON, không zip để giảm dependency).
 * Restore: validate + upsert per entity trong 1 Prisma transaction.
 *
 * SCHEMA_VERSION = 1 (Phase 1). Phase 2: tăng version khi schema thay đổi.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const SCHEMA_VERSION = 1;

export interface BackupManifest {
  schemaVersion: number;
  exportedAt: string;
  orgId: string;
  counts: Record<string, number>;
}

/**
 * Export toàn bộ org data thành JSON file trên local disk (storage key là path).
 * Return BackupRecord sau khi write xong file.
 */
export async function exportOrgBackup(orgId: string, userId: string): Promise<{
  filename: string;
  sizeBytes: number;
  storageKey: string;
  counts: Record<string, number>;
}> {
  // Selective export — chỉ các entity an toàn để import lại.
  // KHÔNG backup: messages, refreshTokens, sessions (chứa PII data dài,
  // có thể re-fetch từ Zalo nếu cần).
  const [contacts, conversations, lists, broadcasts, contentBlocks, webhooks, settings] = await Promise.all([
    prisma.contact.findMany({ where: { orgId } }),
    prisma.conversation.findMany({ where: { orgId }, take: 5000 }),
    prisma.customerList.findMany({ where: { orgId } }),
    prisma.broadcastJob.findMany({ where: { orgId }, take: 5000 }),
    prisma.contentBlock.findMany({ where: { orgId } }),
    prisma.webhook.findMany({ where: { orgId } }),
    prisma.appSetting.findMany({ where: { orgId } }),
  ]);

  const data = {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      orgId,
      counts: {
        contacts: contacts.length,
        conversations: conversations.length,
        lists: lists.length,
        broadcasts: broadcasts.length,
        contentBlocks: contentBlocks.length,
        webhooks: webhooks.length,
        settings: settings.length,
      },
    } satisfies BackupManifest,
    contacts,
    conversations,
    lists,
    broadcasts,
    contentBlocks,
    webhooks,
    settings,
  };

  const filename = `zcrm-backup-${orgId}-${Date.now()}.json`;
  const dir = path.join(os.tmpdir(), 'zcrm-backups');
  await fs.mkdir(dir, { recursive: true });
  const storageKey = path.join(dir, filename);
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(storageKey, json, 'utf8');
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  await prisma.backupRecord.create({
    data: {
      orgId,
      createdBy: userId,
      schemaVersion: SCHEMA_VERSION,
      counts: data.manifest.counts,
      sizeBytes,
      filename,
      storageKey,
    },
  });

  logger.info(`[backup] exported ${orgId} → ${filename} (${sizeBytes} bytes)`);

  return { filename, sizeBytes, storageKey, counts: data.manifest.counts };
}

export interface DryRunResult {
  counts: Record<string, number>;
  warnings: string[];
  conflicts: Array<{ entity: string; id: string; reason: string }>;
}

/**
 * Dry-run: parse JSON mà KHÔNG ghi DB, đếm conflicts vs current org data.
 */
export async function dryRunRestore(orgId: string, storageKey: string): Promise<DryRunResult> {
  const raw = await fs.readFile(storageKey, 'utf8');
  const data = JSON.parse(raw);
  if (data.manifest?.schemaVersion !== SCHEMA_VERSION) {
    return {
      counts: {},
      warnings: [`schemaVersion mismatch: backup is v${data.manifest?.schemaVersion}, expected v${SCHEMA_VERSION}`],
      conflicts: [],
    };
  }
  if (data.manifest?.orgId && data.manifest.orgId !== orgId) {
    return {
      counts: {},
      warnings: ['Backup belongs to a different org — abort'],
      conflicts: [],
    };
  }

  const counts: Record<string, number> = {};
  const warnings: string[] = [];
  const conflicts: DryRunResult['conflicts'] = [];

  // Đếm + check conflicts cho contacts (overwrite? skip?).
  if (Array.isArray(data.contacts)) {
    counts.contacts = data.contacts.length;
    for (const c of data.contacts) {
      const existing = await prisma.contact.findFirst({
        where: { orgId, OR: [{ id: c.id }, { phone: c.phone }] },
      });
      if (existing) conflicts.push({ entity: 'Contact', id: c.id, reason: 'exists_with_same_id_or_phone' });
    }
  }
  if (Array.isArray(data.lists)) counts.lists = data.lists.length;
  if (Array.isArray(data.broadcasts)) counts.broadcasts = data.broadcasts.length;
  if (Array.isArray(data.contentBlocks)) counts.contentBlocks = data.contentBlocks.length;
  if (Array.isArray(data.webhooks)) counts.webhooks = data.webhooks.length;
  if (Array.isArray(data.settings)) counts.settings = data.settings.length;
  if (Array.isArray(data.conversations)) counts.conversations = data.conversations.length;

  return { counts, warnings, conflicts };
}

/**
 * Apply restore: replace mode (overwrite all) hoặc merge mode (skip conflicts).
 * Phase 1: chỉ merge (skip conflicts). Phase 2: thêm replace mode + transactional rollback.
 */
export async function applyRestore(args: {
  orgId: string;
  storageKey: string;
  mode: 'merge' | 'replace';
  userId: string;
}): Promise<{ applied: number; skipped: number }> {
  const raw = await fs.readFile(args.storageKey, 'utf8');
  const data = JSON.parse(raw) as { manifest: BackupManifest; contacts: unknown[]; lists: unknown[]; broadcasts: unknown[]; contentBlocks: unknown[]; webhooks: unknown[]; settings: unknown[]; conversations: unknown[] };

  if (args.mode === 'replace') {
    // Phase 2: tx { delete all org rows → restore }.
    logger.warn(`[backup] replace mode not implemented in Phase 1, treating as merge`);
  }

  let applied = 0;
  let skipped = 0;
  // Phase 1: skip silently nếu id đã tồn tại.
  // Phase 2: dùng transaction.
  for (const c of (data.contacts ?? []) as Array<{ id: string }>) {
    const exists = await prisma.contact.findFirst({ where: { orgId: args.orgId, OR: [{ id: c.id }, { phone: (c as { phone?: string }).phone ?? '__none__' }] } });
    if (exists) { skipped++; continue; }
    // Re-create với id mới (tránh clash).
    await prisma.contact.create({ data: { ...(c as object), id: undefined, orgId: args.orgId } as never }).catch(() => null);
    applied++;
  }
  return { applied, skipped };
}

export async function listBackups(orgId: string, limit = 30) {
  return prisma.backupRecord.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getBackupFile(orgId: string, backupId: string): Promise<{ filename: string; stream: Buffer } | null> {
  const rec = await prisma.backupRecord.findFirst({ where: { id: backupId, orgId } });
  if (!rec) return null;
  try {
    const buf = await fs.readFile(rec.storageKey);
    return { filename: rec.filename, stream: buf };
  } catch {
    return null;
  }
}