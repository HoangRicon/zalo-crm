// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * prompts/campaign-planner.ts — Sprint 5 R11 (2026-07-21).
 *
 * AI sinh plan campaign đầy đủ từ 1 câu userGoal.
 * Plan gồm 5 phần: audience / messages / schedule / kpi / risks.
 */

export interface CampaignPlan {
  audience: {
    segments: string[];          // vd ["priorityScore > 50", "lastInteractionAt < 30d ago"]
    estimatedReach: number;       // ước lượng KH phù hợp
  };
  messages: Array<{
    variant: 'A' | 'B' | 'C';
    name: string;
    text: string;                 // ≤200 chars, có {{ten}}
  }>;
  schedule: {
    frequency: 'once' | 'daily' | 'weekly';
    sendAtISO: string;            // ISO datetime
  };
  kpi: {
    expectedReplyRate: number;    // 0..1
    expectedReach: number;
  };
  risks: string[];                // lý do có thể fail
}

export function buildCampaignPlannerPrompt(args: {
  userGoal: string;
  orgStats: { totalContacts: number; activeContacts: number; hotCount: number; coolingCount: number };
}): { system: string; user: string } {
  const system = [
    'Bạn là chuyên gia marketing automation bất động sản Việt Nam.',
    'Nhiệm vụ: từ 1 câu mục tiêu chiến dịch, sinh plan chi tiết gồm 5 phần:',
    '1. audience: ai sẽ nhận (segments, estimatedReach)',
    '2. messages: 3 biến thể tin nhắn (A/B/C, mỗi cái ≤200 chars, có {{ten}})',
    '3. schedule: tần suất + thời điểm gửi tối ưu',
    '4. kpi: dự kiến expectedReplyRate (0-1) + expectedReach',
    '5. risks: cảnh báo (vd: KH cooling dễ bị block, giờ gửi không phù hợp)',
    '',
    'Trả về ĐÚNG JSON (không markdown):',
    '{"audience":{"segments":["..."],"estimatedReach":N},"messages":[{"variant":"A","name":"...","text":"..."}],"schedule":{"frequency":"...","sendAtISO":"ISO8601"},"kpi":{"expectedReplyRate":0.0,"expectedReach":N},"risks":["..."]}',
    'Lưu ý: sendAtISO phải là thời điểm trong tương lai (ISO 8601).',
    'estimatedReach MUST ≤ orgStats.totalContacts.',
  ].join('\n');

  const user = [
    `Mục tiêu: ${args.userGoal}`,
    '',
    `Context công ty: ${args.orgStats.totalContacts} KH, ${args.orgStats.activeContacts} đang active,`,
    `${args.orgStats.hotCount} KH nóng (priorityScore > 70), ${args.orgStats.coolingCount} KH đang nguội.`,
    '',
    'Hãy sinh plan.',
  ].join('\n');

  return { system, user };
}

/** Rule-based fallback khi AI fail. */
export function ruleBasedCampaignPlan(args: {
  userGoal: string;
  orgStats: { totalContacts: number };
}): CampaignPlan {
  // Default: pick next Monday 9am VN
  const next = new Date();
  const dayOfWeek = next.getDay();
  const daysUntilMon = (8 - dayOfWeek) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMon);
  next.setHours(9, 0, 0, 0);

  return {
    audience: {
      segments: ['priorityScore > 50', 'lastInteractionAt < 30 ngày trước'],
      estimatedReach: Math.min(Math.round(args.orgStats.totalContacts * 0.3), args.orgStats.totalContacts),
    },
    messages: [
      { variant: 'A', name: 'Mở bán', text: 'Chào {{ten}}, bên em có căn phù hợp với nhu cầu của anh/chị. Em gửi thông tin chi tiết nhé.' },
      { variant: 'B', name: 'Tái khách', text: 'Anh/chị {{ten}} ơi, lâu rồi chưa ghé. Bên em có chương trình mới, ghé xem nha.' },
      { variant: 'C', name: 'Giới thiệu', text: 'Xin chào {{ten}}, giới thiệu dự án X phù hợp với anh/chị. Em gửi brochure nhé.' },
    ],
    schedule: {
      frequency: 'once',
      sendAtISO: next.toISOString(),
    },
    kpi: {
      expectedReplyRate: 0.10,
      expectedReach: Math.round(args.orgStats.totalContacts * 0.3),
    },
    risks: [
      'AI đang tắt hoặc lỗi — kế hoạch dựa trên rule mặc định',
      'KPI chỉ là ước lượng, cần A/B test để tối ưu',
      '30% KH ước lượng có thể không có Zalo nên không nhận được',
    ],
  };
}