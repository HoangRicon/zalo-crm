// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * webhook-cron.ts — Sprint 8 R13 (2026-07-21).
 *
 * Retry queue scan mỗi 30s. Mark pending deliveries whose nextAttemptAt <= now.
 */
import { retryDue } from './webhook-service.js';
import { logger } from '../../shared/utils/logger.js';

let handle: NodeJS.Timeout | null = null;

export function startWebhookCron(): void {
  if (handle) return;
  handle = setInterval(() => {
    retryDue()
      .then((n) => {
        if (n > 0) logger.debug(`[webhook-cron] processed ${n} retries`);
      })
      .catch((err) => logger.error('[webhook-cron] retry error:', err));
  }, 30_000);
}

export function stopWebhookCron(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}