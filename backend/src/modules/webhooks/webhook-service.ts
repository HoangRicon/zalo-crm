// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * webhook-service.ts — Sprint 8 R13 (2026-07-21).
 *
 * Outbound webhook dispatcher:
 *  - HMAC-SHA256 sign payload với per-webhook secret (or org default).
 *  - Send POST đến URL, write WebhookDelivery row.
 *  - Mark next attempt on non-2xx. cron sẽ retry.
 *  - 3 attempts: 30s, 5min, 30min (exponential).
 */
import crypto from 'node:crypto';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

const BACKOFF_MS = [30_000, 300_000, 1_800_000]; // 30s, 5min, 30min

function signPayload(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Fire 1 event to all matching active webhooks of an org.
 * Lưu WebhookDelivery rows, gọi fireNow() async.
 */
export async function dispatchEvent(args: {
  orgId: string;
  event: string;
  payload: unknown;
}): Promise<number> {
  const webhooks = await prisma.webhook.findMany({
    where: { orgId: args.orgId, active: true, events: { has: args.event } },
  });
  if (webhooks.length === 0) return 0;

  let queued = 0;
  for (const w of webhooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: w.id,
        event: args.event,
        payload: args.payload as object,
        attempt: 0,
        status: 'pending',
        nextAttemptAt: new Date(), // sẵn sàng gửi ngay
      },
    });
    void fireNow(delivery.id, w.id, w.url, w.secret, args.event, args.payload);
    queued++;
  }
  return queued;
}

/**
 * Thực hiện 1 lần POST tới webhook URL.
 * Được gọi bởi dispatchEvent (lần đầu) hoặc webhook-cron (retry).
 */
export async function fireNow(
  deliveryId: string,
  webhookId: string,
  url: string,
  secret: string | null,
  event: string,
  payload: unknown,
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, deliveredAt: new Date().toISOString() });
  const signatureSecret = secret ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Delivery': deliveryId,
  };
  if (signatureSecret) headers['X-Webhook-Signature'] = signPayload(body, signatureSecret);

  let httpStatus: number | null = null;
  let responseBody = '';
  let ok = false;
  try {
    const res = await fetch(url, { method: 'POST', body, headers });
    httpStatus = res.status;
    responseBody = await res.text().catch(() => '');
    responseBody = responseBody.slice(0, 500);
    ok = httpStatus >= 200 && httpStatus < 300;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'network_error';
  }

  // Update delivery row.
  const existing = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!existing) return;
  const attempt = existing.attempt + 1;

  if (ok) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'success', httpStatus, responseBody, attempt, nextAttemptAt: null },
    });
    return;
  }

  // Failed → schedule retry
  if (attempt >= 3) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'failed', httpStatus, responseBody, attempt, nextAttemptAt: null },
    });
    logger.warn(`[webhook] delivery ${deliveryId} failed after 3 attempts, status=${httpStatus}`);
    return;
  }
  const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[2];
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      httpStatus,
      responseBody,
      attempt,
      nextAttemptAt: new Date(Date.now() + backoff),
    },
  });
}

/** Retry scan: tìm deliveries pending + nextAttemptAt <= now. */
export async function retryDue(): Promise<number> {
  const now = new Date();
  const due = await prisma.webhookDelivery.findMany({
    where: { status: 'pending', nextAttemptAt: { lte: now } },
    include: { webhook: true },
  });
  let processed = 0;
  for (const d of due) {
    if (!d.webhook.active) continue;
    await fireNow(d.id, d.webhookId, d.webhook.url, d.webhook.secret, d.event, d.payload);
    processed++;
  }
  return processed;
}