// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Sequence Executor - cron job to fire due sequence steps
// 2026-07-22 fix-zalo-crm-mvp-gaps#6: actually send message instead of just advancing step
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { zaloOps, ZaloOpError } from '../../shared/zalo-operations.js';

const POLL_INTERVAL_MS = 60_000;
const MAX_BATCH = 25;
let interval: NodeJS.Timeout | null = null;

export function startSequenceExecutor() {
  if (interval) return;
  logger.info('[sequence-executor] started (every 60s)');
  interval = setInterval(processDueSteps, POLL_INTERVAL_MS);
  processDueSteps().catch((err) => logger.error('[sequence-executor] boot error:', err));
}

export function stopSequenceExecutor() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null || v === '' ? '' : String(v);
  });
}

/**
 * Process due sequence memberships and fire their next step.
 * 2026-07-22 fix-zalo-crm-mvp-gaps#6: now actually resolves the Friend + ContentBlock
 * and calls zaloOps.sendMessage. Failure is recorded in automation_execution_logs.
 */
async function processDueSteps() {
  const now = new Date();
  const due = await prisma.sequenceMembership.findMany({
    where: { status: 'active', nextStepAt: { lte: now } },
    take: MAX_BATCH,
    orderBy: { nextStepAt: 'asc' },
    include: { sequence: { select: { enabled: true, id: true, orgId: true } } },
  });
  if (!due.length) return;

  for (const m of due) {
    if (!m.sequence.enabled) continue;

    const steps = await prisma.sequenceStep.findMany({
      where: { sequenceId: m.sequenceId },
      orderBy: { stepOrder: 'asc' },
    });
    const step = steps[m.currentStep];
    if (!step) {
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { status: 'completed', completedAt: new Date(), nextStepAt: null },
      });
      continue;
    }

    const log = await prisma.automationExecutionLog.create({
      data: {
        orgId: m.orgId,
        oaAccountId: m.oaAccountId,
        type: 'sequence',
        jobId: m.id,
        status: 'running',
        startedAt: now,
      },
    });

    try {
      // BUG SQ1 fix (2026-07-28): resolve Friend + check nick connected trước khi gửi.
      // Trước đây sequence chỉ check zaloUidInNick tồn tại → nick offline vẫn attempt
      // gửi → zaloOp NOT_CONNECTED → KHÔNG fatal (logged error) nhưng vẫn đốt 1 tick
      // và log error. Filter sớm ở Friend query: chỉ pick Friend mà nick của nó đang connected.
      const friend = await prisma.friend.findFirst({
        where: { zaloAccountId: m.oaAccountId, contactId: m.contactId },
        select: {
          zaloUidInNick: true,
          zaloAccount: { select: { status: true } },
        },
      });
      if (!friend?.zaloUidInNick) {
        throw new Error('friend_not_found_or_no_uid');
      }
      if (friend.zaloAccount.status !== 'connected') {
        throw new Error('nick_not_connected');
      }

      // Resolve ContentBlock for the step's blockId
      let messageText = '';
      if (step.blockId) {
        const block = await prisma.contentBlock.findFirst({
          where: { id: step.blockId, orgId: m.orgId },
          select: { messageText: true },
        });
        if (!block) throw new Error('content_block_not_found');
        messageText = block.messageText;
      }

      if (!messageText.trim()) {
        throw new Error('step_has_no_message');
      }

      // Render with contact vars
      const contact = await prisma.contact.findFirst({
        where: { id: m.contactId, orgId: m.orgId },
        select: { fullName: true, phone: true, crmName: true },
      });
      const rendered = renderTemplate(messageText, {
        ten: contact?.crmName || contact?.fullName || '',
        name: contact?.fullName || '',
        phone: contact?.phone || '',
      });

      await zaloOps.sendMessage(m.oaAccountId, friend.zaloUidInNick, 0, { msg: rendered });

      await prisma.automationExecutionLog.update({
        where: { id: log.id },
        data: {
          status: 'completed',
          sent: 1,
          failed: 0,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimited = err instanceof ZaloOpError && err.code === 'RATE_LIMITED';
      // BUG SQ1 fix (2026-07-28): nick offline → retry sau 15 phút (không phải fail cứng,
      // nick có thể reconnect). Trước đây nick_not_connected → 'failed' → KH mất step này.
      const isNickOffline = msg === 'nick_not_connected';
      logger.warn(`[sequence-executor] step fail membership=${m.id}: ${msg}`);
      await prisma.automationExecutionLog.update({
        where: { id: log.id },
        data: {
          status: isRateLimited || isNickOffline ? 'paused' : 'failed',
          sent: 0,
          failed: 1,
          error: msg.slice(0, 500),
          completedAt: new Date(),
        },
      }).catch(() => {});

      // Pause this membership on RATE_LIMIT or nick offline to avoid tight loop; advance otherwise.
      if (isRateLimited) {
        // Retry in 5 minutes
        await prisma.sequenceMembership.update({
          where: { id: m.id },
          data: { nextStepAt: new Date(Date.now() + 5 * 60_000) },
        });
        continue;
      }
      if (isNickOffline) {
        // Retry in 15 minutes (nick reconnect chậm hơn rate limit)
        await prisma.sequenceMembership.update({
          where: { id: m.id },
          data: { nextStepAt: new Date(Date.now() + 15 * 60_000) },
        });
        continue;
      }
    }

    // Advance to next step (or complete)
    const stepsRefresh = await prisma.sequenceStep.findMany({
      where: { sequenceId: m.sequenceId },
      orderBy: { stepOrder: 'asc' },
    });
    const nextStepIdx = m.currentStep + 1;
    if (nextStepIdx >= stepsRefresh.length) {
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { status: 'completed', completedAt: new Date(), currentStep: nextStepIdx, nextStepAt: null },
      });
    } else {
      const nextStep = stepsRefresh[nextStepIdx];
      const jitter = nextStep.jitterMinutes ? Math.floor(Math.random() * nextStep.jitterMinutes * 60_000) : 0;
      const nextAt = new Date(Date.now() + nextStep.delayMinutes * 60_000 + jitter);
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { currentStep: nextStepIdx, nextStepAt: nextAt },
      });
    }
  }
}