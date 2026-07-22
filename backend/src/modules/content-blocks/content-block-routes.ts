// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Huỳnh Ngọc Thuận — Community extension
/**
 * content-block-routes.ts — Khối nội dung: kho nội dung tái dùng cho Broadcast tự động.
 *
 * Endpoints:
 *   GET    /api/v1/content-blocks       — danh sách (org scope, enrich: creatorName, usedByBroadcastCount, variables)
 *   GET    /api/v1/content-blocks/:id   — chi tiết 1 block
 *   POST   /api/v1/content-blocks       — tạo
 *   PATCH  /api/v1/content-blocks/:id   — sửa
 *   DELETE /api/v1/content-blocks/:id   — xoá
 *
 * Mở cho mọi user đăng nhập trong org (giống Mẫu tin nhắn) — không cần owner/admin
 * vì bản thân khối nội dung không gửi gì, chỉ là nội dung soạn sẵn để Broadcast chọn.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';

interface BlockBody {
  name?: string;
  messageText?: string;
  imageUrl?: string | null;
}

export async function contentBlockRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/content-blocks', async (request) => {
    const user = request.user!;
    const [blocks, users] = await Promise.all([
      prisma.contentBlock.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { orgId: user.orgId },
        select: { id: true, fullName: true, email: true },
      }),
    ]);
    // Count broadcast jobs using this block id (contentBlockIds array contains element)
    const blockIds = blocks.map((b) => b.id);
    const usageRows = blockIds.length
      ? await prisma.broadcastJob.findMany({
          where: { orgId: user.orgId, contentBlockIds: { hasSome: blockIds } },
          select: { id: true, name: true, contentBlockIds: true, status: true },
        })
      : [];
    const usageMap = new Map<string, Array<{ id: string; name: string; status: string }>>();
    for (const r of usageRows) {
      for (const cid of r.contentBlockIds) {
        if (!blockIds.includes(cid)) continue;
        const arr = usageMap.get(cid) ?? [];
        arr.push({ id: r.id, name: r.name, status: r.status });
        usageMap.set(cid, arr);
      }
    }
    const userMap = new Map(users.map((u) => [u.id, u.fullName || u.email]));

    const enriched = blocks.map((b) => ({
      ...b,
      createdByName: userMap.get(b.createdById) ?? null,
      usedByBroadcastCount: (usageMap.get(b.id) ?? []).length,
      usedByBroadcasts: usageMap.get(b.id) ?? [],
      variables: extractVariables(b.messageText),
      textLength: b.messageText.length,
    }));
    return { blocks: enriched };
  });

  app.get<{ Params: { id: string } }>('/api/v1/content-blocks/:id', async (request, reply) => {
    const user = request.user!;
    const block = await prisma.contentBlock.findFirst({
      where: { id: request.params.id, orgId: user.orgId },
    });
    if (!block) return reply.status(404).send({ error: 'not_found' });
    const [creator, usedByBroadcasts] = await Promise.all([
      prisma.user.findFirst({
        where: { id: block.createdById },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.broadcastJob.findMany({
        where: { orgId: user.orgId, contentBlockIds: { has: block.id } },
        select: { id: true, name: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return {
      block: {
        ...block,
        createdByName: creator?.fullName || creator?.email || null,
        usedByBroadcasts,
        variables: extractVariables(block.messageText),
        textLength: block.messageText.length,
      },
    };
  });

  app.post<{ Body: BlockBody }>('/api/v1/content-blocks', async (request, reply) => {
    const user = request.user!;
    const b = request.body ?? {};
    if (!b.name?.trim()) return reply.status(400).send({ error: 'name_required' });
    if (!b.messageText?.trim()) return reply.status(400).send({ error: 'messageText_required' });

    const block = await prisma.contentBlock.create({
      data: {
        orgId: user.orgId,
        createdById: user.id,
        name: b.name.trim(),
        messageText: b.messageText,
        imageUrl: b.imageUrl?.trim() || null,
      },
    });
    return reply.status(201).send({ block });
  });

  app.patch<{ Params: { id: string }; Body: BlockBody }>('/api/v1/content-blocks/:id', async (request, reply) => {
    const user = request.user!;
    const existing = await prisma.contentBlock.findFirst({ where: { id: request.params.id, orgId: user.orgId } });
    if (!existing) return reply.status(404).send({ error: 'not_found' });

    const b = request.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = b.name.trim();
    if (b.messageText !== undefined) data.messageText = b.messageText;
    if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl?.trim() || null;

    const block = await prisma.contentBlock.update({ where: { id: existing.id }, data });
    return { block };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/content-blocks/:id', async (request, reply) => {
    const user = request.user!;
    const existing = await prisma.contentBlock.findFirst({ where: { id: request.params.id, orgId: user.orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'not_found' });
    await prisma.contentBlock.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}

/**
 * Trích các biến {{key}} ra khỏi nội dung (unique, dedup, khoảng trắng trim).
 * Ví dụ: "Chào {{ten}}, SĐT {{sdt}}" → ["ten", "sdt"]
 */
function extractVariables(text: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1]);
  return Array.from(out);
}
