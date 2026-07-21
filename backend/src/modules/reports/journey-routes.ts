// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * reports/journey-routes.ts — Sprint 4 R7 (2026-07-21).
 *
 * Customer Journey Funnel — 6 giai đoạn.
 * Sử dụng các cột/flags trên Contact để xác định stage của mỗi KH.
 *
 * Stage definitions (ordered):
 *   first_contact → friend_accept → first_reply → quote → appointment → closed
 *
 *   firstContactAt: createdAt (hoặc firstInboundAt nếu có)
 *   friendAcceptAt: Friend.friendshipStatus='accepted' timestamp
 *   firstReplyAt:   Message.senderType='contact' first timestamp
 *   quoteAt:        Contact có gắn Quote (không có bảng Quote — dùng tag 'quote_sent')
 *   appointmentAt:  Contact.appointmentDate (đã có)
 *   closedAt:       Contact.status='closed_won'
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';

interface StageRow {
  stage: string;
  label: string;
  count: number;
  conversionRate: number; // % của stage trước (hoặc 100% cho stage đầu)
  avgDurationMs: number;
  dropOff: number; // # KH rời ở stage này (= previous - current)
}

const STAGE_DEFINITIONS = [
  { key: 'first_contact', label: 'First Contact' },
  { key: 'friend_accept', label: 'Friend Accept' },
  { key: 'first_reply', label: 'First Reply' },
  { key: 'quote', label: 'Quote' },
  { key: 'appointment', label: 'Appointment' },
  { key: 'closed', label: 'Closed' },
];

export async function journeyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /reports/journey?days=90 — Funnel aggregation
  app.get<{ Querystring: { days?: string } }>(
    '/api/v1/reports/journey',
    async (request: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      const days = Math.max(1, Math.min(365, parseInt((request.query as Record<string, string>).days ?? '90', 10) || 90));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      try {
        // Lấy tất cả contacts org trong N ngày (createdAt > since)
        const contacts = await prisma.contact.findMany({
          where: { orgId: user.orgId, createdAt: { gte: since } },
          select: {
            id: true, status: true, createdAt: true,
            // Friend accept thông qua Friend.friendshipStatus
            // First reply thông qua Message
            // Appointment thông qua Conversation.appointmentDate
          },
        });
        // Tính từng stage
        // Stage 1 — first_contact: tất cả contacts created trong window
        const firstContactCount = contacts.length;
        // Stage 2 — friend_accept: contacts có Friend với friendshipStatus='accepted'
        // Prisma StringFilter không cho phép `not: null`; lấy all rồi filter trong JS.
        const acceptedIdsRaw = await prisma.friend.findMany({
          where: { orgId: user.orgId, friendshipStatus: 'accepted' },
          select: { contactId: true, createdAt: true },
        }).catch(() => [] as Array<{ contactId: string | null; createdAt: Date }>);
        const acceptedIds = acceptedIdsRaw.filter((f): f is { contactId: string; createdAt: Date } => !!f.contactId);
        const acceptedSet = new Set(acceptedIds.map((f) => f.contactId));
        // Stage 3 — first_reply: contacts có inbound message
        const repliedContactIds = await prisma.message.findMany({
          where: { conversation: { orgId: user.orgId }, senderType: 'contact' },
          distinct: ['conversationId'],
          select: { conversation: { select: { contactId: true } } },
        });
        const repliedSet = new Set(
          repliedContactIds.map((m) => m.conversation?.contactId).filter((x): x is string => !!x),
        );
        // Stage 4 — quote: contacts có Conversation.appointmentDate set hoặc status='quoted'
        // Tạm dùng status flags: 'quoted' nếu có
        const quotedSet = new Set(contacts.filter((c) => c.status === 'quoted').map((c) => c.id));
        // Stage 5 — appointment: contacts có status='appointment_scheduled'
        const apptSet = new Set(contacts.filter((c) => c.status === 'appointment_scheduled').map((c) => c.id));
        // Stage 6 — closed: contacts có status='closed_won'
        const closedSet = new Set(contacts.filter((c) => c.status === 'closed_won').map((c) => c.id));

        const stageCounts = [
          firstContactCount,
          acceptedSet.size,
          repliedSet.size,
          quotedSet.size,
          apptSet.size,
          closedSet.size,
        ];

        const stages: StageRow[] = STAGE_DEFINITIONS.map((def, i) => {
          const count = stageCounts[i];
          const prev = i > 0 ? stageCounts[i - 1] : null;
          const conversion = prev != null && prev > 0 ? count / prev : 1;
          const dropOff = prev != null ? Math.max(0, prev - count) : 0;
          return {
            stage: def.key,
            label: def.label,
            count,
            conversionRate: Math.round(conversion * 1000) / 1000,
            avgDurationMs: 0, // NOTE: omitted for simplicity (requires per-stage timestamps)
            dropOff,
          };
        });

        return { stages, totalContacts: firstContactCount, days, generatedAt: new Date().toISOString() };
      } catch (err) {
        logger.error('[journey] report error:', err);
        return reply.status(500).send({ error: 'Failed to compute journey' });
      }
    },
  );

  // GET /reports/journey/:stage — Drill-down contacts ở stage
  app.get<{ Params: { stage: string } }>(
    '/api/v1/reports/journey/:stage',
    async (request: FastifyRequest<{ Params: { stage: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      const stageKey = request.params.stage;
      const stageIdx = STAGE_DEFINITIONS.findIndex((s) => s.key === stageKey);
      if (stageIdx < 0) return reply.status(400).send({ error: 'invalid_stage' });

      try {
        // Lấy contacts theo stage đó (đã đạt stage này nhưng CHƯA đạt stage kế tiếp)
        const contacts = await prisma.contact.findMany({
          where: { orgId: user.orgId, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
          select: { id: true, crmName: true, fullName: true, status: true, priorityScore: true, lastInteractionAt: true, createdAt: true },
        });

        // Build sets giống trên
        const acceptedSet = new Set(
          (await prisma.friend.findMany({
            where: { orgId: user.orgId, friendshipStatus: 'accepted' },
            select: { contactId: true },
          }).catch(() => [] as Array<{ contactId: string | null }>)).map((f) => f.contactId).filter((x): x is string => !!x),
        );
        const repliedSet = new Set(
          (await prisma.message.findMany({
            where: { conversation: { orgId: user.orgId }, senderType: 'contact' },
            distinct: ['conversationId'],
            select: { conversation: { select: { contactId: true } } },
          })).map((m) => m.conversation?.contactId).filter((x): x is string => !!x),
        );
        const quotedSet = new Set(contacts.filter((c) => c.status === 'quoted').map((c) => c.id));
        const apptSet = new Set(contacts.filter((c) => c.status === 'appointment_scheduled').map((c) => c.id));
        const closedSet = new Set(contacts.filter((c) => c.status === 'closed_won').map((c) => c.id));

        const allSets = [null, acceptedSet, repliedSet, quotedSet, apptSet, closedSet];
        const nextSets = [allSets[1], allSets[2], allSets[3], allSets[4], allSets[5], null];
        // Stage i: KH thuộc allSets[i] (nếu i>0) AND KHÔNG thuộc nextSets[i] (nếu i<5).
        // Lưu ý stage 0 là tất cả contacts (first_contact).
        // Stage 5 (closed) là KH closed.
        let filtered: typeof contacts;
        if (stageIdx === 0) {
          // First contact = tất cả
          filtered = contacts;
        } else if (stageIdx === 5) {
          filtered = contacts.filter((c) => closedSet.has(c.id));
        } else {
          filtered = contacts.filter((c) => {
            const inThis = allSets[stageIdx]?.has(c.id) ?? false;
            const inNext = nextSets[stageIdx]?.has(c.id) ?? false;
            return inThis && !inNext;
          });
        }

        return {
          stage: stageKey,
          label: STAGE_DEFINITIONS[stageIdx].label,
          contacts: filtered.slice(0, 200),
          totalCount: filtered.length,
        };
      } catch (err) {
        logger.error('[journey] drill-down error:', err);
        return reply.status(500).send({ error: 'Failed to load stage contacts' });
      }
    },
  );
}