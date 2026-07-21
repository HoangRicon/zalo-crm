// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * prompts/content-block-suggest.ts — Sprint 2 R5 (2026-07-21).
 *
 * Prompt builder cho AI gợi ý 3-5 biến thể tin nhắn Zalo (Content Block).
 *
 * Input: userIntent (string, vd: "Gửi cho KH quan tâm căn 3PN quận 7")
 * Output: JSON strict [{ name, messageText, imageKeyword? }, ...]
 *
 * Constraints:
 * - messageText ≤ 200 chars
 * - Phải có {{ten}} (ít nhất)
 * - Tiếng Việt tự nhiên, không spam keyword
 */

export interface SuggestArgs {
  userIntent: string;
  count?: number; // 3..5
}

export function buildContentBlockSuggestPrompt(args: SuggestArgs): { system: string; user: string } {
  const count = Math.max(3, Math.min(5, args.count ?? 4));
  const system = [
    'Bạn là chuyên gia content marketing bất động sản Việt Nam.',
    'Nhiệm vụ: tạo các mẫu tin nhắn Zalo ngắn gọn, dùng để sale gửi cho khách hàng tiềm năng.',
    '',
    'Quy tắc bắt buộc:',
    '- Mỗi mẫu tối đa 200 ký tự (bao gồm cả biến).',
    '- BẮT BUỘC có placeholder {{ten}} (tên khách) trong mỗi messageText.',
    '- Giọng văn tự nhiên, lịch sự, KHÔNG dùng từ spam (MIỄN PHÍ, GIẢM GIÁ SỐC, ...).',
    '- Đa dạng phong cách: thân thiện, chuyên nghiệp, hài hước nhẹ, ... để sale chọn.',
    '- Tiếng Việt có dấu chuẩn.',
    '',
    'Trả về ĐÚNG JSON (không markdown, không giải thích), theo schema:',
    '[{ "name": "<tên mẫu ngắn ≤ 30 ký tự>", "messageText": "<tin ≤ 200 ký tự có {{ten}}>", "imageKeyword": "<1-3 từ khoá tìm ảnh minh hoạ, optional>" }, ...]',
    `Trả đúng ${count} mẫu.`,
  ].join('\n');

  const user = [
    `Mục đích / ngữ cảnh: ${args.userIntent.trim()}`,
    '',
    'Hãy gợi ý các mẫu tin nhắn phù hợp.',
  ].join('\n');

  return { system, user };
}

/** 3 fallback templates khi AI fail (BĐS). */
export const FALLBACK_CONTENT_BLOCKS: Array<{ name: string; messageText: string; imageKeyword: string }> = [
  {
    name: 'Mở bán',
    messageText: 'Chào {{ten}}, bên em vừa mở bán căn 3PN view sông tại Q7. Anh/chị quan tâm thì em gửi thêm thông tin chi tiết nhé.',
    imageKeyword: 'căn hộ mở bán',
  },
  {
    name: 'Tái khách',
    messageText: 'Anh/chị {{ten}} ơi, lâu rồi chưa ghé. Bên em có căn phù hợp với nhu cầu trước đó của anh/chị, em gửi anh/chị xem qua nha.',
    imageKeyword: 'tái hẹn',
  },
  {
    name: 'Giới thiệu dự án',
    messageText: 'Xin chào {{ten}}, giới thiệu dự án X — vị trí đắc địa, tiện ích đầy đủ. Em gửi brochure anh/chị tham khảo nhé.',
    imageKeyword: 'dự án mới',
  },
];
