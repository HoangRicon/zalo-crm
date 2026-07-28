// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
/**
 * lead-pool-cron.ts — Background sweeper auto-return LeadRequest hết hạn.
 *
 * BUG #1 fix (2026-07-28): trước đây CHỈ có schema (LeadRequest.expiresAt,
 * autoReturnedAt, releaseReason) + comment "auto_return: cron 2am hoặc lazy
 * reaper" trong activity/action-types.ts, nhưng KHÔNG có code cron nào thực
 * sự quét `expiresAt < now() AND autoReturnedAt IS NULL` để trả lead về pool.
 *
 * Hệ quả: lead kẹt trên tay sale vĩnh viễn, dashboard hardcode `ok: true`
 * → ngụy trạng thái xanh. Lead pool cạn dần, sale nghỉ phép không trả được.
 *
 * Fix: tick mỗi 15 phút, sweep batch 100 lead hết hạn, transaction cập nhật
 * `autoReturnedAt + releaseReason='auto_return'`, đồng thời reset
 * `Contact.assignedUserId = null` (với điều kiện assignedUserId = requestedByUserId
 * để tránh ghi đè assignment mới).
 */

import cron from 'node-cron';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const TICK_CRON = '*/15 * * * *';   // mỗi 15 phút
const BATCH_SIZE = 100;

let task: cron.ScheduledTask | null = null;

export function startLeadPoolCron(): void {
  if (task) return;
  task = cron.schedule(TICK_CRON, async () => {
    try {
      const expired = await prisma.leadRequest.findMany({
        where: {
          expiresAt: { lt: new Date() },
          autoReturnedAt: null,
          releaseReason: null,
        },
        select: {
          id: true,
          contactId: true,
          requestedByUserId: true,
        },
        take: BATCH_SIZE,
        orderBy: { expiresAt: 'asc' },
      });

      if (expired.length === 0) return;

      let returned = 0;
      for (const req of expired) {
        try {
          await prisma.$transaction([
            prisma.leadRequest.update({
              where: { id: req.id },
              data: {
                autoReturnedAt: new Date(),
                releaseReason: 'auto_return',
              },
            }),
            prisma.contact.updateMany({
              where: {
                id: req.contactId,
                assignedUserId: req.requestedByUserId,
              },
              data: { assignedUserId: null },
            }),
          ]);
          returned++;
        } catch (err) {
          logger.error(
            { err, leadRequestId: req.id },
            '[lead-pool-cron] auto-return failed',
          );
        }
      }

      if (returned > 0) {
        logger.info(
          { returned, total: expired.length },
          '[lead-pool-cron] auto-return batch done',
        );
      }
    } catch (err) {
      logger.error({ err }, '[lead-pool-cron] tick failed');
    }
  });
  logger.info(`[lead-pool-cron] scheduled (${TICK_CRON})`);
}

export function stopLeadPoolCron(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info('[lead-pool-cron] stopped');
  }
}