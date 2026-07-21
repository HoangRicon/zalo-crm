// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * push-service.ts — Sprint 7 R12 (2026-07-21).
 *
 * Stub Web Push wrapper cho PWA push notification. Phase 1 chưa cài `web-push` package
 * nên service này hoạt động ở chế độ no-op + log. Khi bật push thật:
 *  1. npm i web-push
 *  2. Generate VAPID: npx web-push generate-vapid-keys
 *  3. Set env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:admin@<yourdomain>
 *  4. Webhook signature dùng crypto module (đã có sẵn Node stdlib).
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Send push tới tất cả subscriptions của 1 user (mọi browser đã đăng ký).
 * Nếu chưa cấu hình VAPID → log warning và trả về 0 (no-op).
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushConfigured()) {
    logger.debug(`[push] VAPID chưa cấu hình → skip sendToUser(${userId})`);
    return { sent: 0, failed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, failed: 0 };

  // TODO Phase 2: dynamic import web-push và fire cho từng subscription.
  // for (const sub of subs) {
  //   await webpush.sendNotification(
  //     { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  //     JSON.stringify(payload),
  //     { vapidDetails: { publicKey, privateKey, subject } }
  //   );
  // }
  logger.info(`[push] (stub) would send to ${subs.length} subs for user ${userId}`);
  return { sent: subs.length, failed: 0 };
}

/**
 * Send push tới tất cả subscriptions của tất cả users trong 1 org.
 * Dùng cho system-level events (org-wide announcement).
 */
export async function sendToOrg(orgId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushConfigured()) {
    logger.debug(`[push] VAPID chưa cấu hình → skip sendToOrg(${orgId})`);
    return { sent: 0, failed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { orgId, lastSeen: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
  if (subs.length === 0) return { sent: 0, failed: 0 };

  // TODO Phase 2: bulk send with rate-limit (1 every 100ms to avoid 429).
  logger.info(`[push] (stub) would send to ${subs.length} subs for org ${orgId}`);
  return { sent: subs.length, failed: 0 };
}

export async function upsertSubscription(args: {
  userId: string;
  orgId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: args.userId, endpoint: args.endpoint } },
    create: {
      userId: args.userId,
      orgId: args.orgId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      lastSeen: new Date(),
    },
    update: {
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      lastSeen: new Date(),
    },
  });
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}