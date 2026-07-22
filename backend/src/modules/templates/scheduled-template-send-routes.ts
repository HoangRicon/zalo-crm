// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Scheduled Template Send - routes for creating/managing scheduled template sends
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

export async function scheduledTemplateSendRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.post(
    '/api/v1/templates/schedule-send',
    { preHandler: requireGrant('broadcast', 'create') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        const body = request.body as {
          templateId?: string;
          oaAccountId?: string;
          contactIds?: string[];
          scheduledAt?: string;
        };
        if (!body.templateId || !body.oaAccountId || !Array.isArray(body.contactIds) || !body.scheduledAt) {
          return reply.status(400).send({ error: 'templateId + oaAccountId + contactIds[] + scheduledAt required' });
        }
        if (body.contactIds.length === 0) return reply.status(400).send({ error: 'contactIds cannot be empty' });
        const scheduledAt = new Date(body.scheduledAt);
        if (isNaN(scheduledAt.getTime())) return reply.status(400).send({ error: 'Invalid scheduledAt' });

        const send = await prisma.scheduledTemplateSend.create({
          data: {
            orgId,
            templateId: body.templateId,
            oaAccountId: body.oaAccountId,
            contactIds: body.contactIds,
            scheduledAt,
            status: 'pending',
          },
        });
        return send;
      } catch (err) {
        logger.error('[scheduled-send] create error:', err);
        return reply.status(400).send({ error: 'Failed to schedule send' });
      }
    },
  );

  app.get(
    '/api/v1/templates/schedule-send',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        const sends = await prisma.scheduledTemplateSend.findMany({
          where: { orgId },
          orderBy: { scheduledAt: 'desc' },
          take: 100,
          include: { template: { select: { name: true } } },
        });
        return sends;
      } catch (err) {
        logger.error('[scheduled-send] list error:', err);
        return reply.status(500).send({ error: 'Failed to list sends' });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/templates/schedule-send/:id',
    { preHandler: requireGrant('broadcast', 'create') },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const orgId = request.user!.orgId;
        const existing = await prisma.scheduledTemplateSend.findFirst({ where: { id: request.params.id, orgId } });
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        if (existing.status !== 'pending') return reply.status(400).send({ error: 'Cannot cancel processed send' });
        await prisma.scheduledTemplateSend.delete({ where: { id: request.params.id } });
        return { ok: true };
      } catch (err) {
        logger.error('[scheduled-send] delete error:', err);
        return reply.status(500).send({ error: 'Failed to delete' });
      }
    },
  );
}