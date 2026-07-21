// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * prisma-extension-audit.ts — Sprint 8 R13 (2026-07-21).
 *
 * Phase 1: chỉ cung cấp helper logAudit() cho service ghi log thủ công.
 * Phase 2: wrap Prisma client extension để auto-log mọi update/delete/create trên
 * entity whitelist (Contact, Conversation, BroadcastJob, AppSetting, Webhook, List).
 * Hiện tại Prisma 5+ extension API phức tạp + AsyncLocalStorage cần wire toàn bộ
 * request pipeline → làm sau để không phá vỡ 7 sprint đã ship.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma-client.js';

const ENTITY_WHITELIST = new Set(['Contact', 'Conversation', 'BroadcastJob', 'AppSetting', 'Webhook', 'List']);

/**
 * Helper để ghi log thủ công từ service code. Phase 1 dùng đây.
 * Extension sẽ wrap helper này ở Phase 2 để auto-log.
 */
export async function logAudit(args: {
  orgId: string;
  actorId?: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  if (!ENTITY_WHITELIST.has(args.entity)) return;
  await prisma.auditLog.create({
    data: {
      orgId: args.orgId,
      actorId: args.actorId ?? null,
      action: args.action,
      entity: args.entity,
      entityId: args.entityId,
      before: (args.before ?? null) as Prisma.InputJsonValue,
      after: (args.after ?? null) as Prisma.InputJsonValue,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    },
  }).catch(() => null); // silent fail — audit log không nên block business logic
}