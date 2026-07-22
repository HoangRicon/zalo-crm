// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Facebook Lead Ads API routes.
 * Endpoints:
 *   GET  /api/v1/facebook-lead-ads/forms        — list all forms with stats
 *   GET  /api/v1/facebook-lead-ads/forms/:id    — form detail
 *   GET  /api/v1/facebook-lead-ads/forms/:id/leads — leads from a form
 *   POST /api/v1/facebook-lead-ads/forms/:id/pull  — trigger manual pull
 *   PATCH /api/v1/facebook-lead-ads/forms/:id    — update form (archive/restore)
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import {
  listFacebookForms,
  getFacebookFormById,
  listFacebookLeads,
  updateFacebookForm,
  triggerFacebookPull,
} from './lead-ads-service.js';

export async function facebookLeadAdsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/facebook-lead-ads/forms
  app.get('/api/v1/facebook-lead-ads/forms', async (request) => {
    const user = request.user!;
    return listFacebookForms(user.orgId);
  });

  // GET /api/v1/facebook-lead-ads/forms/:id
  app.get<{ Params: { id: string } }>(
    '/api/v1/facebook-lead-ads/forms/:id',
    async (request, reply) => {
      const user = request.user!;
      const form = await getFacebookFormById(user.orgId, request.params.id);
      if (!form) {
        return reply.status(404).send({ error: 'Form not found' });
      }
      return form;
    },
  );

  // GET /api/v1/facebook-lead-ads/forms/:id/leads
  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/facebook-lead-ads/forms/:id/leads',
    async (request) => {
      const user = request.user!;
      const limit = parseInt((request.query as Record<string, string>).limit ?? '20', 10);
      const offset = parseInt((request.query as Record<string, string>).offset ?? '0', 10);
      return listFacebookLeads(user.orgId, request.params.id, { limit, offset });
    },
  );

  // POST /api/v1/facebook-lead-ads/forms/:id/pull
  app.post<{ Params: { id: string } }>(
    '/api/v1/facebook-lead-ads/forms/:id/pull',
    async (request, reply) => {
      const user = request.user!;
      const result = await triggerFacebookPull(user.orgId, request.params.id);
      if (!result.success) {
        return reply.status(400).send({ error: result.message });
      }
      return { success: true, message: result.message };
    },
  );

  // PATCH /api/v1/facebook-lead-ads/forms/:id
  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/api/v1/facebook-lead-ads/forms/:id',
    async (request, reply) => {
      const user = request.user!;
      const { status } = request.body ?? {};

      if (!status || !['active', 'archived', 'deleted'].includes(status)) {
        return reply.status(400).send({ error: 'Invalid status. Must be one of: active, archived, deleted' });
      }

      const updated = await updateFacebookForm(user.orgId, request.params.id, { status });
      if (updated.count === 0) {
        return reply.status(404).send({ error: 'Form not found' });
      }

      return { success: true };
    },
  );
}
