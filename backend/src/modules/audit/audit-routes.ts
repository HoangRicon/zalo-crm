// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * audit-routes.ts — Sprint 8 R13 (2026-07-21).
 *
 * Filter + read audit logs (owner/admin only). Phase 1 dùng logAudit helper
 * cho writable events (manual call từ service). Phase 2 wrap Prisma extension.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listAuditLogs, getAuditLog } from './audit-service.js';

function requireOwnerAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.user!.role !== 'owner' && request.user!.role !== 'admin') {
    reply.status(403).send({ error: 'forbidden' });
    return false;
  }
  return true;
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/audit — filter by actor, action, entity, from, to.
  app.get('/api/v1/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const q = request.query as Record<string, string>;
    const items = await listAuditLogs({
      orgId: request.user!.orgId,
      actorId: q.actorId,
      action: q.action,
      entity: q.entity,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return reply.send({ items });
  });

  // GET /api/v1/audit/:id — diff detail.
  app.get<{ Params: { id: string } }>('/api/v1/audit/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const item = await getAuditLog(request.params.id);
    if (!item || item.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return reply.send(item);
  });
}