// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * audit-service.ts — Sprint 8 R13 (2026-07-21).
 *
 * CRUD read cho audit log + filter (actor, action, entity, time range).
 * Ghi log thực hiện bởi prisma-extension-audit.ts (auto-hook).
 */
import { prisma } from '../../shared/database/prisma-client.js';

export interface AuditFilter {
  orgId: string;
  actorId?: string;
  action?: string;
  entity?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

export async function listAuditLogs(filter: AuditFilter) {
  const where: Record<string, unknown> = { orgId: filter.orgId };
  if (filter.actorId) where.actorId = filter.actorId;
  if (filter.action) where.action = filter.action;
  if (filter.entity) where.entity = filter.entity;
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.gte = filter.from;
    if (filter.to) range.lte = filter.to;
    where.createdAt = range;
  }
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, filter.limit ?? 50),
  });
}

export async function getAuditLog(id: string) {
  return prisma.auditLog.findUnique({ where: { id } });
}