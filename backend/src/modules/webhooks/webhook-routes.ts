// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * webhook-routes.ts — Sprint 8 R13 (2026-07-21).
 *
 * Owner/admin CRUD cho outbound webhooks + read delivery log.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { prisma } from '../../shared/database/prisma-client.js';
import { dispatchEvent, fireNow } from './webhook-service.js';
import { logger } from '../../shared/utils/logger.js';

interface CreateBody {
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

const ALLOWED_EVENTS = [
  'contact.created',
  'contact.updated',
  'deal.closed',
  'lead.score_changed',
  'churn.high_risk',
  'broadcast.run_completed',
];

function requireOwnerAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.user!.role !== 'owner' && request.user!.role !== 'admin') {
    reply.status(403).send({ error: 'forbidden' });
    return false;
  }
  return true;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/webhooks — list.
  app.get('/api/v1/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const rows = await prisma.webhook.findMany({
      where: { orgId: request.user!.orgId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ items: rows });
  });

  // POST /api/v1/webhooks — create.
  app.post('/api/v1/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const body = request.body as CreateBody;
    if (!body?.url || !Array.isArray(body?.events) || body.events.length === 0) {
      return reply.status(400).send({ error: 'invalid_payload' });
    }
    const bad = body.events.filter((e) => !ALLOWED_EVENTS.includes(e));
    if (bad.length > 0) return reply.status(400).send({ error: 'unsupported_events', invalid: bad });
    const row = await prisma.webhook.create({
      data: {
        orgId: request.user!.orgId,
        url: body.url,
        events: body.events,
        secret: body.secret ?? crypto.randomBytes(24).toString('hex'),
        active: body.active ?? true,
        createdBy: request.user!.id,
      },
    });
    return reply.send(row);
  });

  // PATCH /api/v1/webhooks/:id — update.
  app.patch<{ Params: { id: string }; Body: Partial<CreateBody> }>('/api/v1/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateBody> }>, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const body = request.body;
    const updated = await prisma.webhook.update({
      where: { id: request.params.id, orgId: request.user!.orgId },
      data: {
        url: body.url,
        events: body.events,
        secret: body.secret,
        active: body.active,
      },
    }).catch(() => null);
    if (!updated) return reply.status(404).send({ error: 'not_found' });
    return reply.send(updated);
  });

  // DELETE /api/v1/webhooks/:id.
  app.delete<{ Params: { id: string } }>('/api/v1/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    await prisma.webhook.delete({
      where: { id: request.params.id, orgId: request.user!.orgId },
    }).catch(() => null);
    return reply.send({ ok: true });
  });

  // POST /api/v1/webhooks/:id/test — fire 1 dummy payload ngay lập tức.
  app.post<{ Params: { id: string } }>('/api/v1/webhooks/:id/test', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const w = await prisma.webhook.findFirst({
      where: { id: request.params.id, orgId: request.user!.orgId },
    });
    if (!w) return reply.status(404).send({ error: 'not_found' });
    const payload = { hello: 'world', orgId: w.orgId, ts: new Date().toISOString() };
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: w.id,
        event: 'webhook.test',
        payload,
        attempt: 0,
        status: 'pending',
        nextAttemptAt: new Date(),
      },
    });
    await fireNow(delivery.id, w.id, w.url, w.secret, 'webhook.test', payload);
    const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    return reply.send(updated);
  });

  // GET /api/v1/webhooks/:id/deliveries — log.
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/api/v1/webhooks/:id/deliveries', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    if (!requireOwnerAdmin(request, reply)) return;
    const limit = Math.min(200, Math.max(1, Number(request.query?.limit ?? 50)));
    const items = await prisma.webhookDelivery.findMany({
      where: { webhookId: request.params.id, webhook: { orgId: request.user!.orgId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send({ items });
  });

  // GET /api/v1/webhooks/events — liệt kê events được phép (cho UI dropdown).
  app.get('/api/v1/webhooks/events', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ events: ALLOWED_EVENTS });
  });
}