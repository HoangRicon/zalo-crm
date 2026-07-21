// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * prompts/churn-detector.ts — Sprint 3 R9 (2026-07-21).
 *
 * Prompt builder cho AI đánh giá churn risk từ 10 tin nhắn gần nhất.
 *
 * Input: messages (10 tin gần nhất) + lastInteractionDays
 * Output: JSON strict { riskLevel, reasons[], suggestedAction }
 */

export interface ChurnPromptArgs {
  messages: Array<{ sender: 'self' | 'contact'; text: string; sentAt: string }>;
  lastInteractionDays: number;
}

export function buildChurnDetectorPrompt(args: ChurnPromptArgs): { system: string; user: string } {
  const system = [
    'Bạn là chuyên gia phân tích churn risk cho CRM bất động sản Việt Nam.',
    'Nhiệm vụ: đọc 10 tin nhắn gần nhất giữa sale và khách hàng, đánh giá khả năng khách rời bỏ.',
    '',
    'Quy tắc:',
    '- riskLevel: "low" | "medium" | "high".',
    '  + "high": KH dừng trả lời >2 tuần + giọng điệu lạnh nhạt, hoặc từ chối rõ ràng.',
    '  + "medium": KH chậm trả lời >1 tuần, hoặc câu trả lời ngắn, không hẹn gặp.',
    '  + "low": KH vẫn tương tác đều, có hứa hẹn xem/tư vấn.',
    '- reasons: mảng 1-3 lý do ngắn gọn (≤80 ký tự/lý do), tiếng Việt.',
    '- suggestedAction: 1 câu hành động cụ thể (≤200 ký tự), tiếng Việt, dùng được luôn.',
    '',
    'Trả ĐÚNG JSON (không markdown):',
    '{ "riskLevel": "low|medium|high", "reasons": ["...", "..."], "suggestedAction": "..." }',
  ].join('\n');

  const userJson = JSON.stringify({
    lastInteractionDays: args.lastInteractionDays,
    messages: args.messages.map((m) => ({
      sender: m.sender,
      text: m.text.slice(0, 500), // truncate to keep prompt short
      sentAt: m.sentAt,
    })),
  });

  const user = `Dữ liệu 10 tin nhắn gần nhất:\n${userJson}\n\nHãy đánh giá churn risk.`;
  return { system, user };
}

/** Rule-based fallback khi AI fail. */
export interface ChurnResult {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  suggestedAction: string;
}

export function ruleBasedChurn(args: { lastInteractionDays: number; avgSentiment?: number | null }): ChurnResult {
  const days = args.lastInteractionDays;
  let level: 'low' | 'medium' | 'high';
  const reasons: string[] = [];
  let action: string;

  if (days > 30) {
    level = 'high';
    reasons.push(`Không tương tác ${days} ngày (quá 30 ngày)`);
    action = 'Gửi tin chăm sóc đặc biệt kèm ưu đãi riêng, hoặc gọi điện trực tiếp';
  } else if (days > 14) {
    level = 'medium';
    reasons.push(`Không tương tác ${days} ngày (quá 14 ngày)`);
    action = 'Gửi tin nhắn thăm hỏi, đề xuất lịch xem dự án mới';
  } else {
    level = 'low';
    reasons.push(`Tương tác gần đây (${days} ngày)`);
    action = 'Tiếp tục nuôi dưỡng theo lịch broadcast định kỳ';
  }

  // Sentiment upgrade
  if (args.avgSentiment != null && args.avgSentiment < 0.3) {
    if (level === 'low') level = 'medium';
    else if (level === 'medium') level = 'high';
    reasons.push(`Sentiment trung bình thấp (${args.avgSentiment.toFixed(2)})`);
  }

  return { riskLevel: level, reasons, suggestedAction: action };
}
