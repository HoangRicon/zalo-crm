// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
/**
 * lead-pool-routes.ts — API endpoints for Lead Pool.
 *
 * Endpoints:
 *   GET    /api/v1/lead-pool/config          — Get config
 *   PUT    /api/v1/lead-pool/config         — Update config (admin only)
 *   GET    /api/v1/lead-pool/stats         — Get dashboard stats
 *   GET    /api/v1/lead-pool/leads          — List leads in pool
 *   GET    /api/v1/lead-pool/requests      — List requests
 *   POST   /api/v1/lead-pool/request       — Request a lead (sale action)
 *   GET    /api/v1/lead-pool/quota         — User's remaining quota
 *   GET    /api/v1/lead-pool/distributions — Distribution history
 *   POST   /api/v1/lead-pool/bonus-quota   — Add bonus quota (admin only)
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import {
  getLeadPoolConfig,
  updateLeadPoolConfig,
  getUserQuota,
  getPooledLeads,
  requestLead,
  getDistributions,
  getLeadRequests,
  getLeadPoolStats,
  addBonusQuota,
  type LeadPoolConfig,
} from './lead-pool-service.js';

function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply): boolean {
  const user = request.user!;
  if (user.role !== 'admin' && user.role !== 'owner') {
    reply.status(403).send({ error: 'forbidden', code: 'admin_only' });
    return false;
  }
  return true;
}

interface ConfigBody {
  enabled?: boolean;
  maxRequestsPerDay?: number;
  cooldownMinutes?: number;
  forgottenThresholdDays?: number;
  excludedStatuses?: string[];
  autoReturnAfterDays?: number;
  autoReturnAfterMinutes?: number;
  requirePhoneInPool?: boolean;
  forceNoteBeforeNext?: boolean;
  enabledSources?: string[];
  noteMinLength?: number;
  cooldownAfterNoteDays?: number;
  selfReclaimLockDays?: number;
  greetingTemplates?: string[];
  sourceListIds?: string[];
}

interface BonusQuotaBody {
  userId: string;
  bonusCount: number;
  reason?: string;
  reviewedLeadIds?: string[];
}

export async function leadPoolRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // ── GET /lead-pool/config ───────────────────────────────────────────────
  app.get('/api/v1/lead-pool/config', async (request) => {
    const user = request.user!;
    let config = await getLeadPoolConfig(user.orgId);

    // Auto-create config if not exists
    if (!config) {
      config = await updateLeadPoolConfig(user.orgId, {});
    }

    return { config };
  });

  // ── PUT /lead-pool/config — Admin only ─────────────────────────────────
  app.put<{ Body: ConfigBody }>('/api/v1/lead-pool/config', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const user = request.user!;
    const body = request.body ?? {};

    const config = await updateLeadPoolConfig(user.orgId, {
      enabled: body.enabled,
      maxRequestsPerDay: body.maxRequestsPerDay,
      cooldownMinutes: body.cooldownMinutes,
      forgottenThresholdDays: body.forgottenThresholdDays,
      excludedStatuses: body.excludedStatuses,
      autoReturnAfterDays: body.autoReturnAfterDays,
      autoReturnAfterMinutes: body.autoReturnAfterMinutes,
      requirePhoneInPool: body.requirePhoneInPool,
      forceNoteBeforeNext: body.forceNoteBeforeNext,
      enabledSources: body.enabledSources,
      noteMinLength: body.noteMinLength,
      cooldownAfterNoteDays: body.cooldownAfterNoteDays,
      selfReclaimLockDays: body.selfReclaimLockDays,
      greetingTemplates: body.greetingTemplates,
      sourceListIds: body.sourceListIds,
    });

    logger.info(`[lead-pool] config updated by admin=${user.id} org=${user.orgId}`);
    return { config };
  });

  // ── GET /lead-pool/stats ───────────────────────────────────────────────
  app.get('/api/v1/lead-pool/stats', async (request) => {
    const user = request.user!;
    const stats = await getLeadPoolStats(user.orgId);
    return { stats };
  });

  // ── GET /lead-pool/leads ───────────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; source?: string; search?: string };
  }>('/api/v1/lead-pool/leads', async (request, reply) => {
    const user = request.user!;
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20));
    const source = request.query.source;
    const search = request.query.search;

    const result = await getPooledLeads(user.orgId, { page, limit, source, search });
    return {
      leads: result.leads,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  });

  // ── GET /lead-pool/requests ───────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; userId?: string; status?: string };
  }>('/api/v1/lead-pool/requests', async (request, reply) => {
    const user = request.user!;
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20));
    const userId = request.query.userId;
    const status = request.query.status;

    // Non-admin can only see their own requests
    const effectiveUserId = (user.role === 'admin' || user.role === 'owner') ? userId : user.id;

    const result = await getLeadRequests(user.orgId, { page, limit, userId: effectiveUserId, status });
    return {
      requests: result.requests,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  });

  // ── POST /lead-pool/request ────────────────────────────────────────────
  // FIX 2026-07-24: accepts optional `{ leadId }` in body so UI can claim a SPECIFIC
  // lead row (was silently claiming the next FIFO lead → user click on row A got row B).
  app.post<{ Body: { leadId?: string } }>('/api/v1/lead-pool/request', async (request, reply) => {
    const user = request.user!;
    const leadId = request.body?.leadId;

    const result = await requestLead(user.orgId, user.id, leadId);

    if (!result.success) {
      const statusCodes: Record<string, number> = {
        lead_pool_disabled: 400,
        in_cooldown: 429,
        quota_exceeded: 429,
        no_leads_in_pool: 404,
        lead_unavailable: 404, // new — when specific leadId not in pool
      };
      const status = statusCodes[result.error!] ?? 400;
      return reply.status(status).send({ error: result.error });
    }

    return { distribution: result.distribution };
  });

  // ── GET /lead-pool/quota ───────────────────────────────────────────────
  app.get('/api/v1/lead-pool/quota', async (request) => {
    const user = request.user!;
    const quota = await getUserQuota(user.orgId, user.id);
    return { quota };
  });

  // ── GET /lead-pool/distributions ──────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; userId?: string; dateFrom?: string; dateTo?: string };
  }>('/api/v1/lead-pool/distributions', async (request, reply) => {
    const user = request.user!;
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20));
    const userId = request.query.userId;
    const dateFrom = request.query.dateFrom ? new Date(request.query.dateFrom) : undefined;
    const dateTo = request.query.dateTo ? new Date(request.query.dateTo) : undefined;

    // Non-admin can only see their own distributions
    const effectiveUserId = (user.role === 'admin' || user.role === 'owner') ? userId : user.id;

    const result = await getDistributions(user.orgId, { page, limit, userId: effectiveUserId, dateFrom, dateTo });
    return {
      distributions: result.distributions,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  });

  // ── POST /lead-pool/bonus-quota — Admin only ───────────────────────────
  app.post<{ Body: BonusQuotaBody }>('/api/v1/lead-pool/bonus-quota', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const user = request.user!;
    const body = request.body ?? {};

    if (!body.userId || typeof body.bonusCount !== 'number' || body.bonusCount < 1) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    await addBonusQuota(
      user.orgId,
      body.userId,
      body.bonusCount,
      user.id,
      body.reason,
      body.reviewedLeadIds ?? []
    );

    logger.info(`[lead-pool] bonus quota granted: user=${body.userId} +${body.bonusCount} by=${user.id}`);
    return { ok: true };
  });
}
