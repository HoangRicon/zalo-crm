// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * webhooks/facebook-webhook-route.ts — Sprint 6 R10 (2026-07-21).
 *
 * Facebook Messenger webhook:
 * - GET /webhooks/facebook — verification endpoint (Facebook sends hub.challenge)
 * - POST /webhooks/facebook — nhận payload, parse qua adapter, tạo Conversation+Message
 *
 * Stub: KHÔNG verify webhook signature ở Phase 1 (cần app secret).
 * Real: Phase 2 thêm X-Hub-Signature-256 HMAC verify + verify_token query param.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { FacebookMessengerAdapter } from '../integrations/providers/facebook-messenger.js';

const adapter = new FacebookMessengerAdapter();

export async function facebookWebhookRoutes(app: FastifyInstance): Promise<void> {
  // GET — verification (Facebook sends ?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...)
  app.get('/api/v1/webhooks/facebook', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe') {
      // Phase 1: luôn accept (verify_token check ở Phase 2)
      logger.info('[fb-webhook] verification challenge accepted');
      return reply.status(200).send(q['hub.challenge'] ?? '');
    }
    return reply.status(400).send({ error: 'unknown_mode' });
  });

  // POST — inbound messages
  app.post('/api/v1/webhooks/facebook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = await adapter.receiveWebhook(request.body);
      if (!parsed) return reply.status(200).send({ ok: true, skipped: true });
      // TODO: ở Phase 2, xác định orgId từ page ID trong payload.
      // Phase 1: chỉ log + return 200 (Facebook không cần payload lưu ngay).
      logger.info(`[fb-webhook] received from ${parsed.externalUserId}: ${parsed.text.slice(0, 50)}`);
      // Future: prisma.conversation.upsert({ where: { extThread }, create: {...}, update: {...} })
      //         prisma.message.create({ data: {...} })
      return reply.status(200).send({ ok: true });
    } catch (err) {
      logger.error('[fb-webhook] error:', err);
      return reply.status(200).send({ ok: false }); // Facebook không retry
    }
  });
}