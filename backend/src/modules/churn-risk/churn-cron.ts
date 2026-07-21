// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * churn-risk/churn-cron.ts — Sprint 3 R9 (2026-07-21).
 *
 * Cron nightly 02:00 VN: quét tất cả org, cho mỗi org quét contact có
 * engagementPattern ∈ {cooling, cold} AND lastInteractionAt 14-90 ngày trước,
 * sau đó gọi churn-service.scoreContactForChurn.
 */
import cron from 'node-cron';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { scoreContactForChurn } from './churn-service.js';
import { withTenant, runSystemQuery } from '../../shared/database/tenant-context.js';

let running = false;

export function startChurnCron(): void {
  // Mỗi đêm 02:00 VN (UTC+7 = 19:00 UTC ngày hôm trước).
  // node-cron dùng local timezone của server — nếu server ở UTC thì set 19:00.
  // Cứ dùng '0 2 * * *' và assume server local time = VN. Nếu deploy container
  // chạy UTC, hãy set TZ=Asia/Ho_Chi_Minh env var.
  cron.schedule('0 2 * * *', async () => {
    if (running) {
      logger.warn('[churn-cron] previous run still in progress, skip');
      return;
    }
    running = true;
    try {
      await runChurnScan();
    } catch (err) {
      logger.error('[churn-cron] tick error', err);
    } finally {
      running = false;
    }
  });
  logger.info('[churn-cron] scheduled daily at 02:00 local time');
}

/** Cho phép chạy thủ công (test, dashboard button "rerun now"). */
export async function runChurnScan(): Promise<{ scannedOrgs: number; scoredContacts: number }> {
  const now = Date.now();
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const since90d = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const orgs = await runSystemQuery(() =>
    prisma.organization.findMany({ select: { id: true } }),
  );

  let scoredContacts = 0;
  for (const org of orgs) {
    await withTenant(org.id, async () => {
      // Quét contact cooling/cold trong 14-90 ngày (KH active < 14d bỏ qua;
      // KH > 90d đã rời bỏ thật, không cần churn risk nữa).
      const contacts = await prisma.contact.findMany({
        where: {
          orgId: org.id,
          engagementPattern: { in: ['cooling', 'cold'] },
          lastInteractionAt: { gte: since90d, lte: since14d },
        },
        select: { id: true },
      });
      for (const c of contacts) {
        try {
          await scoreContactForChurn(org.id, c.id);
          scoredContacts++;
        } catch (err) {
          logger.warn(`[churn-cron] org=${org.id} contact=${c.id} fail`, err);
        }
      }
    });
  }

  logger.info(`[churn-cron] scanned ${orgs.length} orgs, scored ${scoredContacts} contacts`);
  return { scannedOrgs: orgs.length, scoredContacts };
}