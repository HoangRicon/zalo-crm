// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * broadcast-preview-service.ts — Sprint 2 R4 (2026-07-21).
 *
 * Tạo 3 mẫu KH + render message (thay biến {{ten}}, {{sdt}}) trước khi
 * user submit broadcast. Giúp sale thấy được biến render thành gì + KH
 * mẫu sẽ nhận được gì.
 *
 * Source: 'customer_list' → 3 entry đầu trong tệp.
 *         'friends' → 3 friend đầu của nick gửi.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { renderMessage, type RecipientVars } from './broadcast-service.js';

export interface PreviewArgs {
  sourceType: 'customer_list' | 'friends';
  customerListId?: string;
  zaloAccountId: string;
  messageText: string;
  count?: number;
}

export interface PreviewSample {
  recipientName: string;
  recipientPhone: string | null;
  renderedMessage: string;
}

const DEFAULT_COUNT = 3;

export async function getBroadcastPreview(orgId: string, args: PreviewArgs): Promise<PreviewSample[]> {
  const limit = Math.max(1, Math.min(args.count ?? DEFAULT_COUNT, 10));
  let rows: RecipientVars[];

  if (args.sourceType === 'customer_list') {
    if (!args.customerListId) return [];
    const entries = await prisma.customerListEntry.findMany({
      where: { customerList: { orgId }, customerListId: args.customerListId },
      orderBy: { rowIndex: 'asc' },
      take: limit,
      select: { nameRaw: true, phoneRaw: true },
    });
    rows = entries.map((e) => ({ name: e.nameRaw, phone: e.phoneRaw }));
  } else {
    const friends = await prisma.friend.findMany({
      where: { orgId, zaloAccountId: args.zaloAccountId, friendshipStatus: 'accepted' },
      take: limit,
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    rows = friends.map(() => ({ name: null, phone: null }));
  }

  return rows.map((r) => ({
    recipientName: r.name?.trim() || '(không tên)',
    recipientPhone: r.phone ?? null,
    renderedMessage: renderMessage(args.messageText, r),
  }));
}