// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Auto Reply Routes - CRUD for rule-based auto chat
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  testRule,
  type AutoReplyRuleRecord,
} from './auto-reply-service.js';
import { logger } from '../../shared/utils/logger.js';

export async function autoReplyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/ai/auto-reply', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      return await listRules(orgId);
    } catch (err) {
      logger.error('[auto-reply] list error:', err);
      return reply.status(500).send({ error: 'Failed to list rules' });
    }
  });

  app.post(
    '/api/v1/ai/auto-reply',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        const body = request.body as Partial<AutoReplyRuleRecord>;
        return await createRule(orgId, body);
      } catch (err) {
        logger.error('[auto-reply] create error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to create rule' });
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    '/api/v1/ai/auto-reply/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        const body = request.body as Partial<AutoReplyRuleRecord>;
        return await updateRule(orgId, request.params.id, body);
      } catch (err) {
        logger.error('[auto-reply] update error:', err);
        const msg = (err as Error).message;
        return reply.status(msg === 'Rule not found' ? 404 : 400).send({ error: msg });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/ai/auto-reply/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        await deleteRule(orgId, request.params.id);
        return { ok: true };
      } catch (err) {
        logger.error('[auto-reply] delete error:', err);
        const msg = (err as Error).message;
        return reply.status(msg === 'Rule not found' ? 404 : 400).send({ error: msg });
      }
    },
  );

  app.post(
    '/api/v1/ai/auto-reply/test',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { triggerType?: string; triggerValue?: string; sampleMessage?: string };
        if (!body.triggerType || !body.triggerValue || !body.sampleMessage) {
          return reply.status(400).send({ error: 'triggerType + triggerValue + sampleMessage required' });
        }
        return await testRule(body.triggerType, body.triggerValue, body.sampleMessage);
      } catch (err) {
        logger.error('[auto-reply] test error:', err);
        return reply.status(400).send({ error: 'Failed to test rule' });
      }
    },
  );
}