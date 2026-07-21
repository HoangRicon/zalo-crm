// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * push-routes.ts — Sprint 7 R12 (2026-07-21).
 *
 * REST endpoints cho PWA push subscriptions. Phase 1 stub đầy đủ flow nhưng
 * service no-op khi chưa config VAPID (xem push-service.ts).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { upsertSubscription, deleteSubscription, sendToUser } from './push-service.js';
import { logger } from '../../shared/utils/logger.js';

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/push/subscribe — đăng ký 1 push sub cho user hiện tại.
  app.post('/api/v1/push/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as SubscribeBody;
      if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
        return reply.status(400).send({ error: 'invalid_payload' });
      }
      await upsertSubscription({
        userId: request.user!.id,
        orgId: request.user!.orgId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: request.headers['user-agent'] ?? undefined,
      });
      return reply.send({ ok: true });
    } catch (err) {
      logger.error('[push] subscribe error:', err);
      return reply.status(500).send({ error: 'subscribe_failed' });
    }
  });

  // DELETE /api/v1/push/subscribe — hủy 1 push sub.
  app.delete('/api/v1/push/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { endpoint: string };
      if (!body?.endpoint) return reply.status(400).send({ error: 'missing_endpoint' });
      await deleteSubscription(request.user!.id, body.endpoint);
      return reply.send({ ok: true });
    } catch (err) {
      logger.error('[push] unsubscribe error:', err);
      return reply.status(500).send({ error: 'unsubscribe_failed' });
    }
  });

  // GET /api/v1/push/vapid-public-key — return public VAPID key cho frontend subscribe.
  app.get('/api/v1/push/vapid-public-key', async (_request: FastifyRequest, reply: FastifyReply) => {
    const key = process.env.VAPID_PUBLIC_KEY ?? '';
    return reply.send({ key, configured: Boolean(key) });
  });

  // POST /api/v1/push/test — admin-only, fire 1 test push cho self.
  app.post('/api/v1/push/test', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user!.role !== 'owner' && request.user!.role !== 'admin') {
      return reply.status(403).send({ error: 'forbidden' });
    }
    const res = await sendToUser(request.user!.id, {
      title: 'ZCRM test',
      body: 'Đây là test push notification từ ZCRM',
      icon: '/icons/icon-192.png',
    });
    return reply.send(res);
  });
}