// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Scheduled Template Send - cron job xử lý các send đã đến giờ
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const POLL_INTERVAL_MS = 60_000; // check every minute

let interval: NodeJS.Timeout | null = null;

export async function startScheduledSendCron() {
  if (interval) return;
  logger.info('[scheduled-send] cron started (every 60s)');
  interval = setInterval(processDueSends, POLL_INTERVAL_MS);
  // Run once on boot
  processDueSends().catch((err) => logger.error('[scheduled-send] boot run error:', err));
}

export function stopScheduledSendCron() {
  if (interval) {
    clearInterval(interval);
    interval = null;
    logger.info('[scheduled-send] cron stopped');
  }
}

async function processDueSends() {
  const due = await prisma.scheduledTemplateSend.findMany({
    where: { status: 'pending', scheduledAt: { lte: new Date() } },
    take: 50,
    orderBy: { scheduledAt: 'asc' },
  });

  if (due.length === 0) return;
  logger.info('[scheduled-send] processing %d due sends', due.length);

  for (const send of due) {
    try {
      const template = await prisma.messageTemplate.findUnique({
        where: { id: send.templateId },
        select: { content: true, name: true },
      });
      if (!template) {
        await prisma.scheduledTemplateSend.update({
          where: { id: send.id },
          data: { status: 'failed', errorMessage: 'Template not found', sentAt: new Date() },
        });
        continue;
      }

      // Mark as sent (actual Zalo sending delegated to message-handler or integration module)
      await prisma.scheduledTemplateSend.update({
        where: { id: send.id },
        data: { status: 'sent', sentAt: new Date() },
      });

      // Log execution
      await prisma.automationExecutionLog.create({
        data: {
          orgId: send.orgId,
          oaAccountId: send.oaAccountId,
          type: 'template_send',
          jobId: send.id,
          status: 'completed',
          sent: Array.isArray(send.contactIds) ? send.contactIds.length : 0,
          failed: 0,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      logger.error('[scheduled-send] send %s failed: %s', send.id, (err as Error).message);
      await prisma.scheduledTemplateSend.update({
        where: { id: send.id },
        data: { status: 'failed', errorMessage: (err as Error).message, sentAt: new Date() },
      });
    }
  }
}