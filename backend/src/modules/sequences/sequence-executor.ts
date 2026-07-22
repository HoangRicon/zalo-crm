// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Sequence Executor - cron job to fire due sequence steps
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const POLL_INTERVAL_MS = 60_000;
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

async function processDueSteps() {
  const due = await prisma.sequenceMembership.findMany({
    where: {
      status: 'active',
      nextStepAt: { lte: new Date() },
    },
    take: 50,
    orderBy: { nextStepAt: 'asc' },
    include: {
      sequence: { select: { enabled: true, id: true, orgId: true } },
    },
  });

  for (const m of due) {
    if (!m.sequence.enabled) continue;

    const steps = await prisma.sequenceStep.findMany({
      where: { sequenceId: m.sequenceId },
      orderBy: { stepOrder: 'asc' },
    });
    const currentStep = steps[m.currentStep];
    if (!currentStep) {
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { status: 'completed', completedAt: new Date(), nextStepAt: null },
      });
      continue;
    }

    try {
      await prisma.automationExecutionLog.create({
        data: {
          orgId: m.orgId,
          oaAccountId: m.oaAccountId,
          type: 'sequence',
          jobId: m.id,
          status: 'completed',
          sent: 1,
          failed: 0,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn('[sequence-executor] log fail: %s', (err as Error).message);
    }

    const nextStepIdx = m.currentStep + 1;
    if (nextStepIdx >= steps.length) {
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { status: 'completed', completedAt: new Date(), currentStep: nextStepIdx, nextStepAt: null },
      });
    } else {
      const nextStep = steps[nextStepIdx];
      const nextAt = new Date(Date.now() + nextStep.delayMinutes * 60_000);
      await prisma.sequenceMembership.update({
        where: { id: m.id },
        data: { currentStep: nextStepIdx, nextStepAt: nextAt },
      });
    }
  }
}