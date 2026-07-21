// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * churn-risk/churn-service.ts — Sprint 3 R9 (2026-07-21).
 *
 * - scoreAndSave: lấy 10 tin gần nhất → gọi scoreChurnForContact → upsert ChurnRiskScore.
 * - getTopHighRisk: dashboard widget.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { scoreChurnForContact } from '../ai/ai-service.js';
import { logger } from '../../shared/utils/logger.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function scoreContactForChurn(orgId: string, contactId: string): Promise<void> {
  // 1) Lấy contact + lastInteractionAt
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId },
    select: {
      id: true,
      lastInteractionAt: true,
      engagementPattern: true,
    },
  });
  if (!contact) return;

  const now = Date.now();
  const lastAt = contact.lastInteractionAt?.getTime() ?? 0;
  const lastInteractionDays = lastAt > 0 ? Math.floor((now - lastAt) / (24 * 60 * 60 * 1000)) : 999;

  // 2) Lấy 10 tin nhắn gần nhất
  const messages = await prisma.message.findMany({
    where: { conversation: { contactId, orgId } },
    orderBy: { sentAt: 'desc' },
    take: 10,
    select: {
      senderType: true,
      content: true,
      sentAt: true,
    },
  });
  const formattedMessages = messages.reverse().map((m) => ({
    sender: (m.senderType === 'self' ? 'self' : 'contact') as 'self' | 'contact',
    text: m.content ?? '',
    sentAt: m.sentAt.toISOString(),
  }));
  const sentiments: number[] = []; // sentimentScore không có trên Message model, dùng rule-based.
  const avgSentiment: number | null = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : null;

  // 3) AI score
  const result = await scoreChurnForContact({
    orgId,
    messages: formattedMessages,
    lastInteractionDays,
    avgSentiment,
  });

  // 4) Upsert ChurnRiskScore (theo contactId + scoredAt hôm nay)
  const nowDate = new Date();
  const expiresAt = new Date(nowDate.getTime() + ONE_DAY_MS);

  await prisma.churnRiskScore.create({
    data: {
      orgId,
      contactId,
      riskLevel: result.riskLevel,
      reasons: result.reasons as unknown as object, // Prisma Json
      suggestedAction: result.suggestedAction,
      source: result.source,
      scoredAt: nowDate,
      expiresAt,
    },
  });

  logger.info(`[churn] contact=${contactId} level=${result.riskLevel} source=${result.source}`);
}

export async function getTopHighRisk(orgId: string, limit = 10): Promise<Array<{
  contactId: string;
  riskLevel: string;
  reasons: string[];
  suggestedAction: string | null;
  source: string;
  scoredAt: string;
  contactName: string | null;
  daysSinceLastInteraction: number | null;
}>> {
  const rows = await prisma.churnRiskScore.findMany({
    where: { orgId, riskLevel: 'high', expiresAt: { gt: new Date() } },
    orderBy: { scoredAt: 'desc' },
    take: limit,
  });

  if (!rows.length) return [];

  // Hydrate contact info
  const contacts = await prisma.contact.findMany({
    where: { id: { in: rows.map((r) => r.contactId) }, orgId },
    select: { id: true, crmName: true, fullName: true, lastInteractionAt: true },
  });
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const now = Date.now();

  return rows.map((r) => {
    const c = contactMap.get(r.contactId);
    const lastAt = c?.lastInteractionAt?.getTime() ?? 0;
    const days = lastAt > 0 ? Math.floor((now - lastAt) / (24 * 60 * 60 * 1000)) : null;
    return {
      contactId: r.contactId,
      riskLevel: r.riskLevel,
      reasons: (r.reasons as string[]) ?? [],
      suggestedAction: r.suggestedAction,
      source: r.source,
      scoredAt: r.scoredAt.toISOString(),
      contactName: c?.crmName ?? c?.fullName ?? '(no name)',
      daysSinceLastInteraction: days,
    };
  });
}