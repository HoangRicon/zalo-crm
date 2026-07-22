// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Automation Report Routes
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { getHistory, getSummary } from './automation-report-service.js';
import { logger } from '../../shared/utils/logger.js';

export async function automationReportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/reports/automation/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as { type?: string; oaAccountId?: string; from?: string; to?: string; page?: string; limit?: string };
      return await getHistory(request.user!.orgId, {
        type: q.type,
        oaAccountId: q.oaAccountId,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
    } catch (err) {
      logger.error('[automation-report] history error:', err);
      return reply.status(500).send({ error: 'Failed to get history' });
    }
  });

  app.get('/api/v1/reports/automation/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await getSummary(request.user!.orgId);
    } catch (err) {
      logger.error('[automation-report] summary error:', err);
      return reply.status(500).send({ error: 'Failed to get summary' });
    }
  });
}