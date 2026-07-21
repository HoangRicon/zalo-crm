// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * broadcast-heatmap-service.ts — Sprint 2 R4 (2026-07-21).
 *
 * Aggregate broadcasts + replies trong N ngày gần nhất → ma trận
 * [24 giờ][7 ngày] của response rate. Cache 60 phút in-memory per orgId.
 *
 * - Mỗi cell = (responseRate, sampleCount, avgReplyMs) cho (dayOfWeek, hourOfDay).
 * - dayOfWeek: 0=CN..6=T7 (theo VN timezone, dùng Intl.DateTimeFormat).
 * - hourOfDay: 0..23 theo giờ VN.
 * - "responseRate" của cell = tổng replies ở cell / tổng sent ở cell.
 */
import { prisma } from '../../shared/database/prisma-client.js';

export interface HeatmapCell {
  hour: number;
  dayOfWeek: number;
  rate: number;
  count: number;
  avgReplyMs: number;
}

export interface HeatmapResult {
  days: number;
  matrix: HeatmapCell[];
  totalBroadcasts: number;
  generatedAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 phút
const cache = new Map<string, { at: number; data: HeatmapResult }>();

/** Lấy dayOfWeek theo giờ VN (UTC+7). 0=CN, 1=T2..6=T7. */
function vnDayOfWeek(d: Date): number {
  const vnHour = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnHour.getUTCDay();
}

/** Lấy hour theo giờ VN (0..23). */
function vnHourOfDay(d: Date): number {
  const vnHour = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnHour.getUTCHours();
}

export async function getBroadcastHeatmap(orgId: string, days = 30): Promise<HeatmapResult> {
  const cached = cache.get(orgId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Lấy tất cả items sent trong N ngày (kèm repliedAt nếu có)
  const items = await prisma.broadcastRunItem.findMany({
    where: {
      orgId,
      status: 'sent',
      createdAt: { gte: since },
    },
    select: {
      createdAt: true,
      repliedAt: true,
    },
  });

  // Aggregate vào 168 cells (24h × 7d)
  const grid = new Map<string, { sent: number; replied: number; replyMsSum: number; replyCount: number }>();
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 7; d++) {
      grid.set(`${d}-${h}`, { sent: 0, replied: 0, replyMsSum: 0, replyCount: 0 });
    }
  }

  for (const item of items) {
    const d = vnDayOfWeek(item.createdAt);
    const h = vnHourOfDay(item.createdAt);
    const cell = grid.get(`${d}-${h}`)!;
    cell.sent++;
    if (item.repliedAt) {
      cell.replied++;
      const replyMs = item.repliedAt.getTime() - item.createdAt.getTime();
      if (replyMs > 0) {
        cell.replyMsSum += replyMs;
        cell.replyCount++;
      }
    }
  }

  const matrix: HeatmapCell[] = [];
  for (const [key, val] of grid) {
    const [dayOfWeek, hour] = key.split('-').map(Number);
    matrix.push({
      hour,
      dayOfWeek,
      rate: val.sent > 0 ? val.replied / val.sent : 0,
      count: val.sent,
      avgReplyMs: val.replyCount > 0 ? Math.round(val.replyMsSum / val.replyCount) : 0,
    });
  }

  const result: HeatmapResult = {
    days,
    matrix,
    totalBroadcasts: items.length,
    generatedAt: new Date().toISOString(),
  };

  cache.set(orgId, { at: Date.now(), data: result });
  return result;
}

/** Xoá cache khi có broadcast mới hoặc reply mới (gọi từ cron / message handler). */
export function invalidateHeatmapCache(orgId: string): void {
  cache.delete(orgId);
}