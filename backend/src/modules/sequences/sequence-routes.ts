// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Sequence Routes - CRUD for sequences
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';
import {
  listSequences,
  getSequence,
  createSequence,
  updateSequence,
  deleteSequence,
  setSequenceStatus,
  enrollContact,
  getSequenceHistory,
  type SequenceStepInput,
} from './sequence-service.js';
import { logger } from '../../shared/utils/logger.js';

export async function sequenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/sequences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await listSequences(request.user!.orgId);
    } catch (err) {
      logger.error('[sequences] list error:', err);
      return reply.status(500).send({ error: 'Failed to list sequences' });
    }
  });

  app.post(
    '/api/v1/sequences',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { name?: string; description?: string; steps?: SequenceStepInput[] };
        const safeBody = {
          name: body.name ?? '',
          description: body.description,
          steps: body.steps,
        };
        return await createSequence(request.user!.orgId, request.user!.id, safeBody);
      } catch (err) {
        logger.error('[sequences] create error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to create sequence' });
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/sequences/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const seq = await getSequence(request.user!.orgId, request.params.id);
        if (!seq) return reply.status(404).send({ error: 'Not found' });
        return seq;
      } catch (err) {
        logger.error('[sequences] get error:', err);
        return reply.status(500).send({ error: 'Failed to get sequence' });
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    '/api/v1/sequences/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const body = request.body as { name?: string; description?: string; steps?: SequenceStepInput[]; status?: string };
        return await updateSequence(request.user!.orgId, request.params.id, body);
      } catch (err) {
        logger.error('[sequences] update error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to update sequence' });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/sequences/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await deleteSequence(request.user!.orgId, request.params.id);
        return { ok: true };
      } catch (err) {
        logger.error('[sequences] delete error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to delete' });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/sequences/:id/activate',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        return await setSequenceStatus(request.user!.orgId, request.params.id, 'active');
      } catch (err) {
        logger.error('[sequences] activate error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to activate' });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/sequences/:id/pause',
    { preHandler: requireGrant('settings', 'edit') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        return await setSequenceStatus(request.user!.orgId, request.params.id, 'paused');
      } catch (err) {
        logger.error('[sequences] pause error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to pause' });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/sequences/:id/enroll',
    { preHandler: requireGrant('broadcast', 'create') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const body = request.body as { contactId?: string; oaAccountId?: string };
        if (!body.contactId || !body.oaAccountId) {
          return reply.status(400).send({ error: 'contactId + oaAccountId required' });
        }
        const m = await enrollContact(request.user!.orgId, request.params.id, body.contactId, body.oaAccountId);
        return m;
      } catch (err) {
        logger.error('[sequences] enroll error:', err);
        return reply.status(400).send({ error: (err as Error).message || 'Failed to enroll' });
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/sequences/:id/history',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        return await getSequenceHistory(request.user!.orgId, request.params.id);
      } catch (err) {
        logger.error('[sequences] history error:', err);
        return reply.status(500).send({ error: 'Failed to get history' });
      }
    },
  );
}