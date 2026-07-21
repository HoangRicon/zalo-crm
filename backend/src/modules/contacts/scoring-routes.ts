// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * contacts/scoring-routes.ts — Sprint 3 R6 (2026-07-21).
 *
 * Endpoints visualizer scoring cho ContactProfileView.
 * Tận dụng fields đã có: priorityScore, priorityUpdatedAt, scoreBreakdown,
 * activity log signals (category='score').
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  fast_reply: 'Reply trong 5 phút → +5 điểm dimension "response"',
  slow_reply: 'Reply >24h → -3 điểm dimension "response"',
  inbound_msg: 'KH nhắn tin (inbound) → +2 điểm dimension "engagement"',
  outbound_sent: 'Gửi tin → +1 điểm dimension "engagement"',
  media_shared: 'Gửi ảnh/video → +3 điểm dimension "intent"',
  appointment_booked: 'Đặt lịch hẹn → +10 điểm dimension "intent"',
  appointment_cancelled: 'Huỷ lịch → -8 điểm dimension "intent"',
  friend_added: 'KH đồng ý kết bạn → +15 điểm dimension "fit"',
  friend_removed: 'KH chặn nick → -20 điểm dimension "fit"',
  price_inquiry: 'Hỏi giá → +5 điểm dimension "intent"',
  no_reply_7d: '7 ngày không reply → -10 điểm dimension "engagement"',
  positive_word: 'Tin nhắn positive sentiment → +3 điểm dimension "intent"',
  negative_word: 'Tin nhắn negative sentiment → -5 điểm dimension "intent"',
  media_engagement: 'KH mở ảnh/video → +4 điểm dimension "engagement"',
  re_engagement: 'KH tương tác lại sau silence → +8 điểm dimension "velocity"',
};

export const SIGNAL_LABELS: typeof SIGNAL_DESCRIPTIONS = SIGNAL_DESCRIPTIONS;

/** Convert description không có trong map → fallback 'Tín hiệu tự động'. */
export function describeSignal(key: string): string {
  return SIGNAL_DESCRIPTIONS[key] ?? `Tín hiệu tự động (${key})`;
}

export async function scoringRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /contacts/:id/scoring/trend?days=30 — Trendline 30 ngày
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>(
    '/api/v1/contacts/:id/scoring/trend',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { days?: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      const days = Math.max(1, Math.min(365, parseInt((request.query as Record<string, string>).days ?? '30', 10) || 30));
      try {
        const contact = await prisma.contact.findFirst({
          where: { id: request.params.id, orgId: user.orgId },
          select: { id: true, priorityScore: true, priorityUpdatedAt: true },
        });
        if (!contact) return reply.status(404).send({ error: 'not_found' });

        // Lấy activity log signals (category='score') trong N ngày.
        // ActivityLog không có contactId trực tiếp → filter qua entityId == contact.id.
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const logs = await prisma.activityLog.findMany({
          where: { orgId: user.orgId, entityId: contact.id, category: 'score', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, details: true },
        });

        // Tính trend: build day-by-day array, duyệt backward từ score hiện tại
        // Lưu ý: logs là desc → đảo lại asc.
        const points: Array<{ date: string; score: number }> = [];
        let runningScore = contact.priorityScore ?? 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Tạo map date → list of deltas (delta là {signalKey, deltaValue, ts})
        const dailyDeltas = new Map<string, number>();
        for (const log of logs) {
          const meta = (log.details as Record<string, unknown>) ?? {};
          const signalKey = String(meta.signalKey ?? meta.kind ?? '');
          const delta = Number(meta.delta ?? 0);
          if (!signalKey || !delta) continue;
          const d = new Date(log.createdAt);
          d.setHours(0, 0, 0, 0);
          const k = d.toISOString().slice(0, 10);
          dailyDeltas.set(k, (dailyDeltas.get(k) ?? 0) + delta);
        }
        // Build points N ngày gần nhất (mỗi ngày 1 point)
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const k = d.toISOString().slice(0, 10);
          const delta = dailyDeltas.get(k) ?? 0;
          runningScore = Math.max(0, Math.min(100, runningScore - delta));
          points.push({ date: k, score: runningScore });
        }
        return { points, currentScore: contact.priorityScore ?? 0 };
      } catch (err) {
        logger.error('[scoring] trend error:', err);
        return reply.status(500).send({ error: 'Failed to compute trend' });
      }
    },
  );

  // GET /contacts/:id/scoring/signals?limit=10 — Top N signals
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/v1/contacts/:id/scoring/signals',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      const limit = Math.max(1, Math.min(100, parseInt((request.query as Record<string, string>).limit ?? '10', 10) || 10));
      try {
        const contact = await prisma.contact.findFirst({
          where: { id: request.params.id, orgId: user.orgId },
          select: { id: true },
        });
        if (!contact) return reply.status(404).send({ error: 'not_found' });
        const logs = await prisma.activityLog.findMany({
          where: { orgId: user.orgId, entityId: contact.id, category: 'score' },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        const signals = logs.map((l) => {
          const meta = (l.details as Record<string, unknown>) ?? {};
          return {
            signalKey: String(meta.signalKey ?? meta.kind ?? 'unknown'),
            dimension: String(meta.dimension ?? 'engagement'),
            delta: Number(meta.delta ?? 0),
            timestamp: l.createdAt.toISOString(),
            reason: describeSignal(String(meta.signalKey ?? meta.kind ?? '')),
          };
        });
        return { signals };
      } catch (err) {
        logger.error('[scoring] signals error:', err);
        return reply.status(500).send({ error: 'Failed to fetch signals' });
      }
    },
  );

  // GET /contacts/:id/scoring/median — So sánh với median cùng engagementPattern
  app.get<{ Params: { id: string } }>(
    '/api/v1/contacts/:id/scoring/median',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = request.user!;
      try {
        const contact = await prisma.contact.findFirst({
          where: { id: request.params.id, orgId: user.orgId },
          select: { id: true, priorityScore: true, engagementPattern: true },
        });
        if (!contact) return reply.status(404).send({ error: 'not_found' });
        // Tính percentile rank
        const lower = await prisma.contact.count({
          where: {
            orgId: user.orgId,
            engagementPattern: contact.engagementPattern,
            priorityScore: { lt: contact.priorityScore ?? 0 },
          },
        });
        const total = await prisma.contact.count({
          where: { orgId: user.orgId, engagementPattern: contact.engagementPattern },
        });
        const percentile = total > 0 ? Math.round((lower / total) * 100) : 0;
        const comparison = `Cao hơn ${percentile}% KH cùng phân khúc (${contact.engagementPattern})`;
        return { percentile, comparison, score: contact.priorityScore ?? 0, segment: contact.engagementPattern };
      } catch (err) {
        logger.error('[scoring] median error:', err);
        return reply.status(500).send({ error: 'Failed to compute median' });
      }
    },
  );
}