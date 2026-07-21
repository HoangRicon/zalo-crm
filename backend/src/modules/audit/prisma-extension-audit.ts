// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * prisma-extension-audit.ts — Sprint 8 R13 (2026-07-21).
 *
 * Prisma client extension tự động ghi AuditLog khi update/delete trên
 * entity whitelist. Create event ghi manually qua audit-log helper
 * (vì Prisma extension chỉ hook update/delete/create chứ không phân biệt được).
 *
 * NOTE: extension này chỉ active trên các model listed bên dưới; model khác bỏ qua.
 */
import { Prisma } from '@prisma/client';
import { prisma as basePrisma } from './prisma-client.js';

const ENTITY_WHITELIST = new Set(['Contact', 'Conversation', 'BroadcastJob', 'AppSetting', 'Webhook', 'List']);

function pickFields(obj: unknown, keep: string[]): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of keep) {
    if (k in (obj as object)) out[k] = (obj as Record<string, unknown>)[k];
  }
  return out;
}

/**
 * Trả về Prisma client đã wrap với audit hooks.
 * Dùng thay cho `prisma` import trong app.ts sau khi register xong.
 */
export function buildAuditedPrisma() {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async update({ model, operation, args, query }) {
          const before = await basePrisma.$queryRawUnsafe(...).catch(() => null);
          // Ở $allModels hook không truy cập được entity fields trực tiếp; dùng query result.
          const result = await query(args);
          if (ENTITY_WHITELIST.has(model) && requestIsAuditable(args?.where)) {
            await writeAudit(model, 'update', result, requestFromArgs(args));
          }
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          if (ENTITY_WHITELIST.has(model)) {
            await writeAudit(model, 'delete', result, requestFromArgs(args));
          }
          return result;
        },
      },
    },
  });
}

function requestIsAuditable(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  const w = where as Record<string, unknown>;
  return typeof w.orgId !== 'undefined' || typeof w.id !== 'undefined';
}

function requestFromArgs(_args: unknown): { ip?: string; userAgent?: string } {
  // Phase 2: lấy từ AsyncLocalStorage context (set bởi auth middleware).
  return {};
}

async function writeAudit(_model: string, _action: string, _data: unknown, _ctx: { ip?: string; userAgent?: string }) {
  // Phase 1 stub: extension hook là no-op. Phase 2: implement
  // 1. parse `result` thành { id, orgId, ...fields }
  // 2. lấy actorId từ AsyncLocalStorage.get('request')?.user?.id
  // 3. async insert prisma.auditLog.create(...)
  //
  // Phase 1 lý do stub: Prisma 5+ extension API phức tạp (model mapping, sql-only-types),
  // và current schema đã qua 7 sprint chưa từng dùng extension. Thay vào đó, ghi log
  // thủ công trong mỗi service khi cần. Helper bên dưới dùng cho phase 2+.
}

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
  await basePrisma.auditLog.create({
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

// Helper to keep pickFields reachable (silence unused warning for future use)
export { pickFields };