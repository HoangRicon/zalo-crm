// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * churn-risk/churn-routes.ts — Sprint 3 R9 (2026-07-21).
 *
 * GET /api/v1/churn/top → top 10 high risk contacts (dashboard widget).
 * POST /api/v1/churn/rerun → trigger cron thủ công (admin only).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { getTopHighRisk } from './churn-service.js';
import { runChurnScan } from './churn-cron.js';
import { logger } from '../../shared/utils/logger.js';

export async function churnRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /churn/top — Dashboard widget data
  app.get('/api/v1/churn/top', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    try {
      const limit = Math.min(50, Math.max(1, parseInt((request.query as Record<string, string>)?.limit ?? '10', 10)));
      const rows = await getTopHighRisk(user.orgId, limit);
      return { rows };
    } catch (err) {
      logger.error('[churn] top error:', err);
      return reply.status(500).send({ error: 'Failed to fetch churn risk' });
    }
  });

  // POST /churn/rerun — Manual trigger (admin only)
  app.post('/api/v1/churn/rerun', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user!.role !== 'admin' && request.user!.role !== 'owner') {
      return reply.status(403).send({ error: 'forbidden' });
    }
    try {
      const result = await runChurnScan();
      return { ok: true, ...result };
    } catch (err) {
      logger.error('[churn] rerun error:', err);
      return reply.status(500).send({ error: 'Rerun failed' });
    }
  });
}