// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
/**
 * trigger-routes.ts — CRUD AutomationTrigger (Community stub).
 *
 * Triggers EE-aware — full engine (welcome/thankYou/remind/rejected pipeline,
 * Friend-Invite dispatching, segment spec, rule overrides…) lives in EE bundle.
 * Endpoint surface Community needs:
 *   GET    /api/v1/triggers              — list (id, name, category, eventType, state, enabled, bindingKind)
 *   POST   /api/v1/triggers              — create draft
 *   PATCH  /api/v1/triggers/:id          — update name / enabled / state
 *   DELETE /api/v1/triggers/:id          — delete
 *   POST   /api/v1/triggers/:id/toggle   — flip enabled
 *
 * Engine side-effects are NOT wired — caller treats triggers as declarative
 * records. EE bundle picks them up on its own cron when present.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';

interface TriggerBody {
  name?: string;
  category?: string;
  eventType?: string;
  bindingKind?: 'sequence' | 'block' | 'broadcast';
  sequenceId?: string | null;
  blockId?: string | null;
  broadcastId?: string | null;
  enabled?: boolean;
}

const SAFE_SELECT = {
  id: true,
  name: true,
  category: true,
  eventType: true,
  bindingKind: true,
  sequenceId: true,
  blockId: true,
  broadcastId: true,
  enabled: true,
  state: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function triggerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/triggers', async (request: FastifyRequest) => {
    const user = request.user!;
    const list = await prisma.automationTrigger.findMany({
      where: { orgId: user.orgId },
      orderBy: { updatedAt: 'desc' },
      select: SAFE_SELECT,
    });
    return { triggers: list };
  });

  app.post<{ Body: TriggerBody }>('/api/v1/triggers', async (request, reply) => {
    const user = request.user!;
    const b = request.body ?? {};
    if (!b.name?.trim()) return reply.status(400).send({ error: 'name_required' });
    if (!b.eventType?.trim()) return reply.status(400).send({ error: 'eventType_required' });
    if (!b.bindingKind) return reply.status(400).send({ error: 'bindingKind_required' });
    if (!['sequence', 'block', 'broadcast'].includes(b.bindingKind)) {
      return reply.status(400).send({ error: 'invalid_bindingKind' });
    }

    const trigger = await prisma.automationTrigger.create({
      data: {
        orgId: user.orgId,
        name: b.name.trim(),
        category: b.category?.trim() || 'general',
        eventType: b.eventType.trim(),
        bindingKind: b.bindingKind,
        sequenceId: b.sequenceId?.trim() || null,
        blockId: b.blockId?.trim() || null,
        broadcastId: b.broadcastId?.trim() || null,
        enabled: b.enabled ?? true,
        state: 'draft',
        createdById: user.id,
      },
      select: SAFE_SELECT,
    });
    return reply.status(201).send({ trigger });
  });

  app.patch<{ Params: { id: string }; Body: TriggerBody }>('/api/v1/triggers/:id', async (request, reply) => {
    const user = request.user!;
    const existing = await prisma.automationTrigger.findFirst({
      where: { id: request.params.id, orgId: user.orgId },
      select: { id: true },
    });
    if (!existing) return reply.status(404).send({ error: 'not_found' });

    const b = request.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = b.name.trim();
    if (b.eventType !== undefined) data.eventType = b.eventType.trim();
    if (b.bindingKind !== undefined) data.bindingKind = b.bindingKind;
    if (b.sequenceId !== undefined) data.sequenceId = b.sequenceId?.trim() || null;
    if (b.blockId !== undefined) data.blockId = b.blockId?.trim() || null;
    if (b.broadcastId !== undefined) data.broadcastId = b.broadcastId?.trim() || null;
    if (b.enabled !== undefined) data.enabled = !!b.enabled;

    const trigger = await prisma.automationTrigger.update({
      where: { id: existing.id },
      data,
      select: SAFE_SELECT,
    });
    return { trigger };
  });

  app.post<{ Params: { id: string } }>('/api/v1/triggers/:id/toggle', async (request, reply) => {
    const user = request.user!;
    const existing = await prisma.automationTrigger.findFirst({
      where: { id: request.params.id, orgId: user.orgId },
      select: { id: true, enabled: true },
    });
    if (!existing) return reply.status(404).send({ error: 'not_found' });
    const trigger = await prisma.automationTrigger.update({
      where: { id: existing.id },
      data: { enabled: !existing.enabled },
      select: SAFE_SELECT,
    });
    return { trigger };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/triggers/:id', async (request, reply) => {
    const user = request.user!;
    const existing = await prisma.automationTrigger.findFirst({
      where: { id: request.params.id, orgId: user.orgId },
      select: { id: true },
    });
    if (!existing) return reply.status(404).send({ error: 'not_found' });
    await prisma.automationTrigger.delete({ where: { id: existing.id } });
    return { ok: true };
  });

  // ── Care Sessions: manual listen (follow/unfollow) ─────────────────────────

  // POST /api/v1/care-sessions/listen — start manual follow session for contact×nick
  app.post('/api/v1/care-sessions/listen', async (request, reply) => {
    const user = request.user!;
    const { contactId, nickId } = request.body as { contactId?: string; nickId?: string };
    if (!contactId) return reply.status(400).send({ error: 'contactId required' });
    if (!nickId) return reply.status(400).send({ error: 'nickId required' });

    // Upsert: find existing active manual session first
    const existing = await prisma.careSession.findFirst({
      where: {
        orgId: user.orgId,
        contactId,
        nickId,
        ownerUserId: user.id,
        state: 'active',
      },
      select: { id: true },
    });
    if (existing) return { sessionId: existing.id, alreadyListening: true };

    const session = await prisma.careSession.create({
      data: {
        id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orgId: user.orgId,
        contactId,
        nickId,
        ownerUserId: user.id,
        enrolledByUserId: user.id,
        sourceType: 'manual',
        // manual listen sessions have 7-day interest window by default
        interestWindowUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        state: 'active',
      },
      select: { id: true },
    });
    return { sessionId: session.id, alreadyListening: false };
  });

  // DELETE /api/v1/care-sessions/listen — stop manual follow session
  app.delete('/api/v1/care-sessions/listen', async (request, reply) => {
    const user = request.user!;
    const { contactId, nickId } = (request.body || {}) as { contactId?: string; nickId?: string };
    if (!contactId) return reply.status(400).send({ error: 'contactId required' });
    if (!nickId) return reply.status(400).send({ error: 'nickId required' });

    const result = await prisma.careSession.updateMany({
      where: {
        orgId: user.orgId,
        contactId,
        nickId,
        ownerUserId: user.id,
        state: 'active',
      },
      data: { state: 'closed' },
    });
    return { ok: true, closed: result.count };
  });

  // GET /api/v1/care-sessions/listening-pairs — for bell icon in ConversationList
  app.get('/api/v1/care-sessions/listening-pairs', async (request, reply) => {
    const user = request.user!;
    const sessions = await prisma.careSession.findMany({
      where: {
        orgId: user.orgId,
        state: 'active',
      },
      select: { contactId: true, nickId: true, externalThreadId: true },
    });
    const pairs = sessions.map((s) => ({
      contactId: s.contactId,
      nickId: s.nickId,
      externalThreadId: s.externalThreadId,
    }));
    return { pairs };
  });
}
