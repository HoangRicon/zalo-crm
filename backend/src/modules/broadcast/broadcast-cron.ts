// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Huỳnh Ngọc Thuận — Community extension
/**
 * broadcast-cron.ts — Worker Broadcast tự động.
 *
 * Tick mỗi 30s:
 *   1. Job đến hạn (status=active, nextRunAt <= now, chưa có run đang chạy)
 *      → tạo BroadcastRun + tính nextRunAt kế tiếp (daily/weekly) hoặc chờ done (once).
 *   2. Run đang chạy → gửi TỐI ĐA 1 tin/tick/run, tôn trọng giãn cách
 *      delaySecMin..Max (chống block). zaloOps tự gate thêm SdkLimit
 *      (trần tin/ngày/nick) — chạm trần thì run tự tạm dừng tới tick sau.
 *
 * Người nhận: CustomerListEntry của tệp với hasZalo=true. UID per-nick:
 *   - entry.resolvedByNickId === nick gửi → dùng entry.zaloUid có sẵn
 *   - khác nick → findUser(phone) resolve UID theo nick gửi (category friend_lookup)
 */
import cron from 'node-cron';
import type { Server } from 'socket.io';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { runSystemQuery, withTenant } from '../../shared/tenant/tenant-context.js';
import { zaloOps, ZaloOpError } from '../../shared/zalo-operations.js';
import { zaloRateLimiter } from '../zalo/zalo-rate-limiter.js';
import { downloadMediaToTemp } from '../chat/chat-media-helpers.js';
import { renderMessage, computeNextRunAt, randomDelayMs, isWithinSendWindow, type ScheduleType } from './broadcast-service.js';

let running = false;

export function startBroadcastCron(io: Server | null): void {
  cron.schedule('*/30 * * * * *', async () => {
    if (running) return; // chống chồng tick khi gửi ảnh chậm
    running = true;
    try {
      await runBroadcastTick(io);
    } catch (err) {
      logger.error('[broadcast-cron] tick error', err);
    } finally {
      running = false;
    }
  });
  logger.info('[broadcast-cron] scheduled every 30s');
}

export async function runBroadcastTick(io: Server | null): Promise<void> {
  const now = new Date();

  // ── 1. Kích hoạt job đến hạn (SYSTEM scope để quét cross-org) ────────────
  const dueJobs = await runSystemQuery(() =>
    prisma.broadcastJob.findMany({
      where: { status: 'active', nextRunAt: { lte: now } },
      select: { id: true, orgId: true, scheduleType: true, scheduledAt: true, timeOfDay: true, daysOfWeek: true, zaloAccountId: true },
    }),
  );

  for (const job of dueJobs) {
    await withTenant(job.orgId, async () => {
      // Sprint 2 R4 2026-07-21: SKIP job nếu nick Zalo bị blacklist broadcast.
      // Job.status vẫn 'active' để admin re-enable nick → cron tự chạy tick sau.
      const nick = await prisma.zaloAccount.findFirst({
        where: { id: job.zaloAccountId },
        select: { broadcastBlacklisted: true, broadcastBlacklistReason: true },
      });
      if (nick?.broadcastBlacklisted) {
        logger.warn(`[broadcast-cron] skip job=${job.id} reason=account_blacklisted reason_note=${nick.broadcastBlacklistReason ?? ''}`);
        return;
      }

      const hasRunning = await prisma.broadcastRun.findFirst({
        where: { jobId: job.id, status: 'running' }, select: { id: true },
      });
      if (hasRunning) return; // run cũ chưa xong — không chồng run

      await prisma.broadcastRun.create({ data: { jobId: job.id, orgId: job.orgId } });
      // once → nextRunAt=null (job sẽ done khi run kết thúc);
      // daily/weekly → tính lần kế tiếp ngay để không kích lặp lại trong lúc run chạy.
      const next = computeNextRunAt({
        scheduleType: job.scheduleType as ScheduleType,
        scheduledAt: job.scheduledAt, timeOfDay: job.timeOfDay,
        daysOfWeek: job.daysOfWeek, after: now,
      });
      await prisma.broadcastJob.update({
        where: { id: job.id },
        data: { lastRunAt: now, nextRunAt: next },
      });
      logger.info(`[broadcast-cron] job=${job.id} run started, next=${next?.toISOString() ?? 'none'}`);
    }).catch((err) => logger.error(`[broadcast-cron] activate job=${job.id} error`, err));
  }

  // ── 2. Xử lý run đang chạy ───────────────────────────────────────────────
  const runs = await runSystemQuery(() =>
    prisma.broadcastRun.findMany({
      where: { status: 'running' },
      select: { id: true, orgId: true, jobId: true, lastSentAt: true, sentCount: true, failedCount: true, skippedCount: true },
    }),
  );

  for (const run of runs) {
    await withTenant(run.orgId, () => processRun(run, io))
      .catch((err) => logger.error(`[broadcast-cron] run=${run.id} error`, err));
  }
}

type RunRow = { id: string; orgId: string; jobId: string; lastSentAt: Date | null; sentCount: number; failedCount: number; skippedCount: number };

/**
 * Sprint 2 R4 2026-07-21: assign A/B group cho recipient dựa trên deterministic hash.
 * - jobAbVariantCount = 2 → 'A' hoặc 'B'
 * - jobAbVariantCount = 3 → 'A', 'B' hoặc 'C'
 * - null → null (job không phải A/B)
 *
 * Dùng hash(entryId + runId) để deterministic: cùng (entryId, runId) → cùng group.
 * Phân bố ~đều vì hash ngẫu nhiên đủ tốt (CyRB32 → 32-bit space).
 */
function assignAbGroup(jobAbVariantCount: number | null | undefined, entryId: string, runId: string): 'A' | 'B' | 'C' | null {
  if (!jobAbVariantCount || jobAbVariantCount < 2 || jobAbVariantCount > 3) return null;
  // Simple FNV-1a hash (32-bit) — đủ để random phân bố, không cần crypto
  let hash = 0x811c9dc5;
  const s = `${entryId}|${runId}`;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned 32-bit → mod variantCount → index
  const idx = (hash >>> 0) % jobAbVariantCount;
  return (['A', 'B', 'C'] as const)[idx];
}

async function processRun(run: RunRow, io: Server | null): Promise<void> {
  const job = await prisma.broadcastJob.findUnique({ where: { id: run.jobId } });
  if (!job || job.status === 'paused') return; // paused: giữ run, chờ resume
  const now = new Date();

  // Ngoài khung giờ gửi (8h-21h VN) — chờ tick sau, không tính lỗi cho khách
  if (!isWithinSendWindow(now)) return;

  // Giãn cách chống block giữa 2 tin
  if (run.lastSentAt && now.getTime() - run.lastSentAt.getTime() < randomDelayMs(job.delaySecMin, job.delaySecMax)) {
    return;
  }

  // Trần mỗi lần chạy
  const processed = run.sentCount + run.failedCount + run.skippedCount;
  if (processed >= job.maxPerRun) {
    await finishRun(run.id, job, 'done');
    return;
  }

  // Người nhận kế tiếp — tuỳ nguồn (tệp KH SĐT hoặc bạn bè đã kết bạn của nick)
  const done = await prisma.broadcastRunItem.findMany({
    where: { runId: run.id }, select: { entryId: true },
  });
  const doneIds = done.map((d) => d.entryId);

  const recipient = job.sourceType === 'friends'
    ? await pickFriendRecipient(job, doneIds)
    : await pickListRecipient(job, doneIds);
  if (!recipient) {
    await finishRun(run.id, job, 'done');
    return;
  }
  const { entryId, phone, name } = recipient;

  // 2026-07-26 fix: pick sender nick (multi-acc round-robin). Resolve TRƯỚC
  // claim để mọi rate-limit/check dùng đúng nick sẽ gửi.
  const senderNickId = pickSenderNickForEntry(job, entryId);

  // P5 (D1) — pre-check fail-CLOSED cho luồng gửi hàng loạt: limiter (Redis/Postgres) lỗi
  // → HOÃN, không xả tin vượt trần lúc hạ tầng sự cố. Thao tác tay của sale đi thẳng
  // zaloOps.exec (fail-open) nên không bị chặn oan. Pre-check KHÔNG ghi nhận (recordSend
  // vẫn do exec làm sau khi gửi thật).
  const gate = await zaloRateLimiter.checkLimits(senderNickId, 'message', { failClosed: true });
  if (!gate.allowed) {
    logger.warn(`[broadcast-cron] run=${run.id} hoãn tick: ${gate.reason ?? 'rate limited'}`);
    return;
  }

  // P4 (C2) — CLAIM recipient TRƯỚC khi gọi Zalo: tạo item 'sending'. unique(runId, entryId)
  // đảm bảo đúng 1 lần gửi dù tick chết giữa chừng / 2 instance chạy song song. P2002 =
  // recipient đã được tick khác claim/gửi → bỏ, KHÔNG gửi lại (biến duplicate-window thành
  // constraint-violation vô hại). Item 'sending' kẹt (crash sau claim) sẽ bị bỏ qua vĩnh
  // viễn — trade-off at-most-once (thà thiếu 1 tin còn hơn gửi trùng); cần sweeper reclaim nếu muốn.
  let itemId: string;
  try {
    // Sprint 2 R4: gán abGroupId nếu job là A/B.
    const abGroupId = job.abMode === 'ab_split' ? assignAbGroup(job.abVariantCount, entryId, run.id) : null;
    const item = await prisma.broadcastRunItem.create({
      data: { runId: run.id, orgId: run.orgId, entryId, phone: phone ?? '', name, status: 'sending', abGroupId, zaloAccountId: senderNickId },
      select: { id: true },
    });
    itemId = item.id;
  } catch (err: any) {
    if (err?.code === 'P2002') return; // đã claim ở tick khác — không gửi lại
    throw err;
  }

  try {
    // 1. Resolve UID theo nick gửi (UID Zalo là per-nick).
    //    Ưu tiên Friend table đã match (cache) → nhanh, không tốn findUser quota.
    //    Fallback findUser chỉ khi chưa có cache.
    let uid: string | null = recipient.uid;
    if (!uid && phone) {
      // Thử Friend table trước (match theo nick gửi + phoneNormalized)
      const noPlus = phone.replace(/^\+/, '');
      const friend = await prisma.friend.findFirst({
        where: { zaloAccountId: senderNickId, contact: { phoneNormalized: noPlus }, friendshipStatus: 'accepted' },
        select: { zaloUidInNick: true },
      });
      uid = friend?.zaloUidInNick ?? null;
      // Fallback Zalo SDK findUser — tốn quota friend_lookup (15 burst / 1000 ngày)
      if (!uid) {
        try {
          const user = await zaloOps.findUser(senderNickId, phone);
          uid = (user as any)?.uid ?? null;
        } catch (sdkErr: any) {
          // 2026-07-26: Zalo error 225 = "Sender not friend of user" → SKIP thay vì FAIL
          // để không spam counter fail. SĐT này chưa được nick này kết bạn → chờ Mục tiêu.
          const code = sdkErr?.code;
          if (code === 225 || code === '225') {
            await finalizeItem(itemId, run, 'skipped', null, 'nick_chua_ket_ban_voi_so_nay');
            logger.info(`[broadcast-cron] run=${run.id} entry=${entryId} skip: nick chưa kết bạn với SĐT này (Zalo 225)`);
            return;
          }
          throw sdkErr;
        }
      }
    }
    if (!uid) {
      await finalizeItem(itemId, run, 'skipped', null, 'khong_tim_thay_uid');
      return;
    }

    // 2. Nội dung: xoay vòng Khối nội dung (spin content) nếu job có contentBlockIds,
    //    ngược lại dùng messageText/imageUrl gõ tay như cũ.
    const content = await resolveJobContent(job, processed, job.orgId);

    // 3. Gửi tin (text hoặc ảnh + caption)
    const text = renderMessage(content.messageText, { name, phone });
    if (content.imageUrl) {
      const media = await downloadMediaToTemp({ url: content.imageUrl }, 'image/jpeg');
      try {
        await zaloOps.sendImage(senderNickId, uid, 0, [media.path], io, text);
      } finally {
        await media.cleanup().catch(() => {});
      }
    } else {
      await zaloOps.sendMessage(senderNickId, uid, 0, { msg: text }, io);
    }
    await finalizeItem(itemId, run, 'sent', uid, null);
    if (content.blockId) {
      await prisma.contentBlock.update({ where: { id: content.blockId }, data: { usageCount: { increment: 1 } } }).catch(() => {});
    }
    logger.info(`[broadcast-cron] run=${run.id} sent via nick=${senderNickId} → ${phone ?? uid}`);
  } catch (err: any) {
    if (err instanceof ZaloOpError && (err.code === 'RATE_LIMITED' || err.code === 'NOT_CONNECTED')) {
      // Nick chạm trần hoặc mất kết nối — NHẢ claim để tick sau thử lại recipient này
      // (KHÔNG tính fail cho khách).
      await releaseItem(itemId).catch(() => {});
      logger.warn(`[broadcast-cron] run=${run.id} paused by nick: ${err.code}`);
      return;
    }
    // 2026-07-26: detect Zalo 225 từ sendMessage (trường hợp Friend table có UID
    // nhưng thực tế nick này unfriended khách) → skip thay vì fail spam.
    const msg = String(err?.message ?? err);
    const zaloCode = err?.cause?.code ?? err?.code;
    if (msg.includes('225') || zaloCode === 225) {
      await finalizeItem(itemId, run, 'skipped', null, 'nick_chua_ket_ban_voi_so_nay');
      logger.info(`[broadcast-cron] run=${run.id} entry=${entryId} skip: nick chưa kết bạn (Zalo 225)`);
      return;
    }
    await finalizeItem(itemId, run, 'failed', null, msg.slice(0, 500));
  }
}

type Recipient = { entryId: string; phone: string | null; name: string | null; uid: string | null };

/**
 * 2026-07-26 fix: Multi-account round-robin.
 * Resolve nick Zalo gửi cho 1 recipient dựa trên job.zaloAccountIds (Json array)
 * và entryId hash (sticky — cùng entry luôn gán cùng nick để tránh
 * gửi trùng nếu run retry).
 *  - 1 nick   → dùng zaloAccountId (backward compat).
 *  - sendMode='round_robin' + N nick → hash(entryId) % N.
 *  - sendMode='duplicate' → luôn dùng nick[0] (giữ semantics cũ; admin dùng cẩn thận
 *    vì mỗi tin gửi trên N nick = N quota).
 */
export function pickSenderNickForEntry(
  job: { zaloAccountId: string; zaloAccountIds: unknown; sendMode: string | null },
  entryId: string,
): string {
  const ids = Array.isArray(job.zaloAccountIds)
    ? (job.zaloAccountIds as string[]).filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) return job.zaloAccountId;
  if ((job.sendMode ?? 'duplicate') === 'round_robin') {
    // FNV-1a 32-bit — sticky per entryId, đủ rải đều
    let hash = 0x811c9dc5;
    for (let i = 0; i < entryId.length; i++) {
      hash ^= entryId.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return ids[(hash >>> 0) % ids.length];
  }
  return ids[0] ?? job.zaloAccountId;
}

/** Nguồn Tệp khách hàng: entry SĐT có Zalo, UID resolve theo nick (findUser nếu khác nick). */
async function pickListRecipient(
  job: { customerListId: string | null; zaloAccountId: string },
  doneIds: string[],
): Promise<Recipient | null> {
  if (!job.customerListId) return null;
  const entry = await prisma.customerListEntry.findFirst({
    where: {
      customerListId: job.customerListId,
      hasZalo: true,
      ...(doneIds.length ? { id: { notIn: doneIds } } : {}),
    },
    orderBy: { rowIndex: 'asc' },
    select: { id: true, phoneLocal: true, phoneE164: true, nameRaw: true, zaloName: true, zaloUid: true, resolvedByNickId: true },
  });
  if (!entry) return null;
  return {
    entryId: entry.id,
    phone: entry.phoneLocal ?? entry.phoneE164 ?? null,
    name: entry.zaloName ?? entry.nameRaw ?? null,
    // UID có sẵn nếu chính nick này đã resolve; khác nick → để null, processRun findUser theo phone
    uid: entry.resolvedByNickId === job.zaloAccountId ? entry.zaloUid : null,
  };
}

/** Nguồn Bạn bè: Friend đã kết bạn (accepted) của nick — UID sẵn (zaloUidInNick), không cần findUser. */
async function pickFriendRecipient(
  job: { zaloAccountId: string },
  doneIds: string[],
): Promise<Recipient | null> {
  const friend = await prisma.friend.findFirst({
    where: {
      zaloAccountId: job.zaloAccountId,
      friendshipStatus: 'accepted',
      ...(doneIds.length ? { id: { notIn: doneIds } } : {}),
    },
    orderBy: { becameFriendAt: 'asc' },
    select: { id: true, zaloUidInNick: true, zaloDisplayName: true },
  });
  if (!friend) return null;
  return { entryId: friend.id, phone: null, name: friend.zaloDisplayName, uid: friend.zaloUidInNick };
}

/**
 * Xoay vòng nội dung theo Khối nội dung (spin content chống spam): mỗi tin thứ N
 * trong run lấy block thứ (N % số block) theo đúng thứ tự job.contentBlockIds.
 * contentBlockIds rỗng → dùng messageText/imageUrl gõ tay của job (như cũ).
 * (export: target-cron dùng lại cho tin chào khi khách chấp nhận kết bạn — vòng 6)
 */
export async function resolveJobContent(
  job: { messageText: string; imageUrl: string | null; contentBlockIds: string[] },
  processedCount: number,
  orgId: string,
): Promise<{ messageText: string; imageUrl: string | null; blockId: string | null }> {
  if (job.contentBlockIds.length === 0) {
    return { messageText: job.messageText, imageUrl: job.imageUrl, blockId: null };
  }
  // Lọc orgId (defense-in-depth): dù DB có row bẩn (id khối của org khác lọt qua route),
  // findMany trả rỗng → fallback messageText, KHÔNG bao giờ gửi nội dung ngoài org của job.
  const blocks = await prisma.contentBlock.findMany({
    where: { id: { in: job.contentBlockIds }, orgId },
    select: { id: true, messageText: true, imageUrl: true },
  });
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  // Giữ đúng thứ tự đã chọn trong job.contentBlockIds (Map lookup bỏ qua block đã xoá).
  const ordered = job.contentBlockIds.map((id) => blockMap.get(id)).filter((b): b is NonNullable<typeof b> => !!b);
  if (ordered.length === 0) {
    return { messageText: job.messageText, imageUrl: job.imageUrl, blockId: null };
  }
  const pick = ordered[processedCount % ordered.length];
  return { messageText: pick.messageText, imageUrl: pick.imageUrl, blockId: pick.id };
}

/** P4 — chốt kết quả claim: update item 'sending' → trạng thái cuối + tăng counter (atomic). */
async function finalizeItem(
  itemId: string, run: RunRow,
  status: 'sent' | 'failed' | 'skipped', zaloUid: string | null, error: string | null,
): Promise<void> {
  const counter = status === 'sent' ? 'sentCount' : status === 'failed' ? 'failedCount' : 'skippedCount';
  await prisma.$transaction([
    prisma.broadcastRunItem.update({
      where: { id: itemId },
      data: { status, zaloUid, error },
    }),
    prisma.broadcastRun.update({
      where: { id: run.id },
      data: { [counter]: { increment: 1 }, ...(status === 'sent' ? { lastSentAt: new Date() } : {}) },
    }),
  ]);
}

/** P4 — nhả claim (xoá item 'sending') khi nick chạm trần/mất kết nối → recipient thử lại tick sau. */
async function releaseItem(itemId: string): Promise<void> {
  await prisma.broadcastRunItem.delete({ where: { id: itemId } });
}

async function finishRun(runId: string, job: { id: string; scheduleType: string }, status: 'done' | 'error'): Promise<void> {
  await prisma.broadcastRun.update({
    where: { id: runId },
    data: { status, endedAt: new Date() },
  });
  if (job.scheduleType === 'once') {
    await prisma.broadcastJob.update({ where: { id: job.id }, data: { status: 'done' } });
  }
  logger.info(`[broadcast-cron] run=${runId} finished (${status})`);
}
