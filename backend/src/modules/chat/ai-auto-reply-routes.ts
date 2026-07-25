// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * ai-auto-reply-routes.ts (2026-07-26)
 *
 * API: bật/tắt + xem auto-reply per-conversation.
 *   GET  /api/v1/conversations/:id/ai-auto-reply
 *   PATCH /api/v1/conversations/:id/ai-auto-reply { enabled: boolean }
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';

interface Params { id: string }
interface PatchBody { enabled?: boolean }

export async function aiAutoReplyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get(
    '/api/v1/conversations/:id/ai-auto-reply',
    async (request, reply: FastifyReply) => {
      const user = request.user!;
      const id = (request.params as Params).id;
      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: user.orgId },
        select: { id: true, aiAutoReplyEnabled: true, aiAutoReplyLastAt: true },
      });
      if (!conv) return reply.status(404).send({ error: 'not_found' });
      return {
        enabled: conv.aiAutoReplyEnabled,
        lastAutoReplyAt: conv.aiAutoReplyLastAt,
      };
    },
  );

  app.patch<{ Params: Params; Body: PatchBody }>(
    '/api/v1/conversations/:id/ai-auto-reply',
    async (request, reply) => {
      const user = request.user!;
      const enabled = !!(request.body as PatchBody | undefined)?.enabled;
      const id = request.params.id;
      const updated = await prisma.conversation.updateMany({
        where: { id, orgId: user.orgId },
        data: { aiAutoReplyEnabled: enabled },
      });
      if (updated.count === 0) return reply.status(404).send({ error: 'not_found' });
      logger.info(`[ai-auto-reply] conv=${id} toggle=${enabled} by=${user.id}`);
      return { enabled };
    },
  );
}
