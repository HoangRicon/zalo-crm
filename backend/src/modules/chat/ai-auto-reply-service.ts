// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * ai-auto-reply-service.ts (2026-07-26)
 *
 * Auto-reply per-conversation khi sale KHÔNG phản hồi.
 * Flow:
 *   1. Worker mỗi 20s quét các conv có aiAutoReplyEnabled=true.
 *   2. Lấy tin NHẮN MỚI NHẤT từ khách (senderType != 'self') của conv.
 *   3. Nếu tin khách > 30s mà KHÔNG có tin nào từ nick (senderType='self') sau nó
 *      → gọi /ai/suggest + Zalo sendMessage qua nick.
 *   4. Set aiAutoReplyLastAt, KHÔNG spam cooldown 60s.
 *
 * Background job chạy riêng (setInterval) — không qua cron để dễ control dev hot-reload.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { zaloOps } from '../../shared/zalo-operations.js';
import { generateAiOutput } from '../ai/ai-service.js';

const AUTO_REPLY_DELAY_MS = 30 * 1000; // 30s chờ sau tin khách
const AUTO_REPLY_COOLDOWN_MS = 60 * 1000; // 60s giữa 2 auto-reply liên tiếp
const TICK_INTERVAL_MS = 20 * 1000;

let workerTimer: NodeJS.Timeout | null = null;
let inFlight = false;

async function tickOnce(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const now = new Date();
    const since = new Date(now.getTime() - AUTO_REPLY_DELAY_MS);

    // Lấy các conv đang bật auto-reply + có tin khách gần đây hơn 30s
    // + cách lần gửi trước ít nhất 60s (cooldown).
    const candidates = await prisma.conversation.findMany({
      where: {
        aiAutoReplyEnabled: true,
        deletedAt: null,
        isVirtual: false,
        threadType: 'user',
        lastMessageAt: { lte: since },
        OR: [
          { aiAutoReplyLastAt: null },
          { aiAutoReplyLastAt: { lte: new Date(now.getTime() - AUTO_REPLY_COOLDOWN_MS) } },
        ],
      },
      take: 10,
      orderBy: { lastMessageAt: 'asc' },
      select: { id: true },
    });

    for (const conv of candidates) {
      try {
        await processConversation(conv.id);
      } catch (err: any) {
        logger.warn(`[ai-auto-reply] conv=${conv.id} error: ${err?.message ?? err}`);
      }
    }
  } catch (err: any) {
    logger.error('[ai-auto-reply] tick error', err);
  } finally {
    inFlight = false;
  }
}

async function processConversation(convId: string): Promise<void> {
  // 2026-07-26: dùng generateAiOutput(conversationId) để có cùng prompt + KB
  // injection như /ai/suggest. AI sẽ đọc 6 tin gần nhất + 1 tin trigger,
  // trả về 1 draft reply trong tiếng Việt.
  const out = await generateAiOutput({
    orgId: (await prisma.conversation.findUnique({ where: { id: convId }, select: { orgId: true } }))!.orgId,
    conversationId: convId,
    type: 'reply_draft',
  });
  // generateAiOutput trả { content, confidence, kbImages?, kbUsed? } (xem ai-service.ts:263)
  const suggestion = (out as any)?.content?.toString().trim() ?? '';
  if (!suggestion || suggestion.length < 2) {
    logger.info(`[ai-auto-reply] conv=${convId} AI trả rỗng → skip`);
    return;
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    select: { id: true, orgId: true, zaloAccountId: true, contactId: true },
  });
  if (!conv) return;

  // Lấy UID của khách theo nick + Contact (per-nick UID)
  const friend = await prisma.friend.findFirst({
    where: { zaloAccountId: conv.zaloAccountId, contactId: conv.contactId ?? undefined },
    select: { zaloUidInNick: true },
  });
  const uid: string | null = friend?.zaloUidInNick ?? null;
  if (!uid) {
    // BUG 2026-07-28: trước đây fallback findUser qua SDK, vừa tốn friend_lookup
    // quota (1000/ngày) vừa không cần thiết (Friend table đã cache từ sync
    // nick đầy đủ). Nếu Friend null → chứng tỏ nick này chưa sync KH này → skip,
    // log để admin biết phải đợi sync. Fallback chỉ giữ nếu cần scan SĐT mới (đã
    // có endpoint /customer-lists/:id/rescan-zalo cho việc đó).
    logger.info(`[ai-auto-reply] conv=${convId} missing Friend.uid for nick=${conv.zaloAccountId} contact=${conv.contactId} → skip (no fallback findUser to avoid burning friend_lookup quota)`);
    return;
  }

  // Gửi qua Zalo SDK
  await zaloOps.sendMessage(conv.zaloAccountId, uid, 0, { msg: suggestion });
  await prisma.conversation.update({
    where: { id: convId },
    data: { aiAutoReplyLastAt: new Date() },
  });
  logger.info(`[ai-auto-reply] conv=${convId} sent via nick=${conv.zaloAccountId} → uid=${uid}`);
}

export function startAiAutoReplyWorker(): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => { void tickOnce(); }, TICK_INTERVAL_MS);
  logger.info('[ai-auto-reply] worker started (tick 20s, delay 30s, cooldown 60s)');
}

export function stopAiAutoReplyWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
