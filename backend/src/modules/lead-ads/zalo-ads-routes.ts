// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Zalo Ads Lead Forms API routes.
 * Endpoints:
 *   GET /api/v1/zalo-ads/forms        — list all Zalo forms with stats
 *   GET /api/v1/zalo-ads/forms/:id   — form detail
 *   GET /api/v1/zalo-ads/forms/:id/leads — leads from a form
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import {
  listZaloForms,
  getZaloFormById,
  listZaloLeads,
} from './lead-ads-service.js';

export async function zaloAdsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/zalo-ads/forms
  app.get('/api/v1/zalo-ads/forms', async (request) => {
    const user = request.user!;
    return listZaloForms(user.orgId);
  });

  // GET /api/v1/zalo-ads/forms/:id
  app.get<{ Params: { id: string } }>(
    '/api/v1/zalo-ads/forms/:id',
    async (request, reply) => {
      const user = request.user!;
      const form = await getZaloFormById(user.orgId, request.params.id);
      if (!form) {
        return reply.status(404).send({ error: 'Form not found' });
      }
      return form;
    },
  );

  // GET /api/v1/zalo-ads/forms/:id/leads
  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/zalo-ads/forms/:id/leads',
    async (request) => {
      const user = request.user!;
      const limit = parseInt((request.query as Record<string, string>).limit ?? '20', 10);
      const offset = parseInt((request.query as Record<string, string>).offset ?? '0', 10);
      return listZaloLeads(user.orgId, request.params.id, { limit, offset });
    },
  );
}
