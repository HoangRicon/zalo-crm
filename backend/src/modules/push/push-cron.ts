// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * push-cron.ts — Sprint 7 R12 (2026-07-21).
 *
 * Cleanup expired push subscriptions mỗi ngày.
 * Browser có thể xóa sub khi user clear data → backend không biết.
 * Sau 30 ngày không thấy lastSeen → drop.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function cleanupStalePushSubs(): Promise<number> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  const result = await prisma.pushSubscription.deleteMany({
    where: {
      OR: [
        { lastSeen: { lt: cutoff } },
        { lastSeen: null, createdAt: { lt: cutoff } },
      ],
    },
  });
  if (result.count > 0) logger.info(`[push] cleanup ${result.count} stale subscriptions`);
  return result.count;
}

let cronHandle: NodeJS.Timeout | null = null;

export function startPushCleanupCron(): void {
  if (cronHandle) return;
  // Run mỗi ngày 1 lần (24h = 86_400_000ms). Phase 2: dùng croner lib có sẵn.
  cronHandle = setInterval(() => {
    cleanupStalePushSubs().catch((err) => logger.error('[push] cleanup cron error:', err));
  }, 86_400_000);
}

export function stopPushCleanupCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}