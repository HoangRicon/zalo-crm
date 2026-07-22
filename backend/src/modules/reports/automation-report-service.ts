// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Automation Report Service
import { prisma } from '../../shared/database/prisma-client.js';

export async function getHistory(
  orgId: string,
  filters: { type?: string; oaAccountId?: string; from?: Date; to?: Date; page?: number; limit?: number },
) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 50, 200);
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = { orgId };
  if (filters.type) where.type = filters.type;
  if (filters.oaAccountId) where.oaAccountId = filters.oaAccountId;
  if (filters.from || filters.to) {
    where.startedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.automationExecutionLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      include: { oaAccount: { select: { displayName: true } } },
    }),
    prisma.automationExecutionLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      jobId: l.jobId,
      status: l.status,
      sent: l.sent,
      failed: l.failed,
      startedAt: l.startedAt,
      completedAt: l.completedAt,
      oaAccountName: l.oaAccount?.displayName ?? null,
    })),
    total,
    page,
    limit,
  };
}

export async function getSummary(orgId: string) {
  const [total, completed, failed, byType] = await Promise.all([
    prisma.automationExecutionLog.count({ where: { orgId } }),
    prisma.automationExecutionLog.count({ where: { orgId, status: 'completed' } }),
    prisma.automationExecutionLog.count({ where: { orgId, status: 'failed' } }),
    prisma.automationExecutionLog.groupBy({
      by: ['type'],
      where: { orgId },
      _count: { id: true },
      _sum: { sent: true, failed: true },
    }),
  ]);

  return {
    total,
    completed,
    failed,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    byType: byType.map((g) => ({
      type: g.type,
      count: g._count.id,
      sent: g._sum.sent ?? 0,
      failed: g._sum.failed ?? 0,
    })),
  };
}