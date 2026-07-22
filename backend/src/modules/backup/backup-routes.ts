// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * backup-routes.ts — Sprint 8 R13 (2026-07-21).
 *
 * Owner-only endpoints cho backup export, restore dry-run + confirm, list, download.
 * Phase 1: lưu trữ local disk (os.tmpdir/zcrm-backups). Phase 2: S3/R2.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exportOrgBackup, dryRunRestore, applyRestore, listBackups, getBackupFile } from './backup-service.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';

function requireOwner(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.user!.role !== 'owner') {
    reply.status(403).send({ error: 'forbidden_owner_only' });
    return false;
  }
  return true;
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // Fix 2026-07-22: trang backup lỗi 500 "Cannot read properties of null (reading 'role')" do
  // THIẾU authMiddleware preHandler. Mọi module route khác (audit, webhooks, broadcasts…)
  // đều có dòng này đầu file; backup-routes bị thiếu → request.user không được populate
  // → requireOwner() đọc .role trên null → 500.
  app.addHook('preHandler', authMiddleware);
  // POST /api/v1/backup/export — tạo backup record trả filename.
  app.post('/api/v1/backup/export', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwner(request, reply)) return;
    try {
      const result = await exportOrgBackup(request.user!.orgId, request.user!.id);
      return reply.send(result);
    } catch (err) {
      logger.error('[backup] export error:', err);
      return reply.status(500).send({ error: 'export_failed' });
    }
  });

  // GET /api/v1/backup/list — list các backup đã tạo.
  app.get('/api/v1/backup/list', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwner(request, reply)) return;
    const items = await listBackups(request.user!.orgId);
    return reply.send({ items });
  });

  // GET /api/v1/backup/download/:id — download file backup.
  app.get<{ Params: { id: string } }>('/api/v1/backup/download/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!requireOwner(request, reply)) return;
    const file = await getBackupFile(request.user!.orgId, request.params.id);
    if (!file) return reply.status(404).send({ error: 'not_found' });
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
    return reply.send(file.stream);
  });

  // POST /api/v1/backup/restore/dry-run — body: { backupId } hoặc { storageKey }.
  app.post('/api/v1/backup/restore/dry-run', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwner(request, reply)) return;
    const body = request.body as { storageKey?: string };
    if (!body?.storageKey) return reply.status(400).send({ error: 'missing_storageKey' });
    try {
      const result = await dryRunRestore(request.user!.orgId, body.storageKey);
      return reply.send(result);
    } catch (err) {
      logger.error('[backup] dry-run error:', err);
      return reply.status(500).send({ error: 'dry_run_failed' });
    }
  });

  // POST /api/v1/backup/restore/confirm — apply.
  app.post('/api/v1/backup/restore/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwner(request, reply)) return;
    const body = request.body as { storageKey: string; mode: 'merge' | 'replace' };
    if (!body?.storageKey || !body?.mode) return reply.status(400).send({ error: 'missing_fields' });
    try {
      const result = await applyRestore({
        orgId: request.user!.orgId,
        storageKey: body.storageKey,
        mode: body.mode,
        userId: request.user!.id,
      });
      return reply.send(result);
    } catch (err) {
      logger.error('[backup] restore error:', err);
      return reply.status(500).send({ error: 'restore_failed' });
    }
  });
}