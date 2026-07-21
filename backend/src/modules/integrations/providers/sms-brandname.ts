// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * providers/sms-brandname.ts — Sprint 6 R10 (2026-07-21).
 *
 * SMS brandname adapter với generic HTTP gateway (cover 80% VN provider).
 * Mỗi org cấu hình trong app_settings:
 *   - sms_api_url: https://api.example.com/sms
 *   - sms_api_key: Bearer token
 *   - sms_sender: "BRANDNAME" (chuỗi tên đã đăng ký)
 *   - sms_provider: 'vnpt' | 'viettel' | 'generic' (default 'generic')
 */
import type { ChannelAdapter, ParsedMessage, SendResult } from '../channel-adapter.interface.js';
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';

interface SmsConfig {
  apiUrl: string;
  apiKey: string;
  sender: string;
  provider: string;
}

async function getSmsConfig(orgId: string): Promise<SmsConfig | null> {
  const rows = await prisma.appSetting.findMany({
    where: { orgId, settingKey: { in: ['sms_api_url', 'sms_api_key', 'sms_sender', 'sms_provider'] } },
  });
  const map = new Map(rows.map((r) => [r.settingKey, r.valuePlain ?? '']));
  const apiUrl = String(map.get('sms_api_url') ?? '').trim();
  const apiKey = String(map.get('sms_api_key') ?? '').trim();
  const sender = String(map.get('sms_sender') ?? '').trim();
  if (!apiUrl || !apiKey || !sender) return null;
  return {
    apiUrl,
    apiKey,
    sender,
    provider: String(map.get('sms_provider') ?? 'generic'),
  };
}

export class SmsBrandnameAdapter implements ChannelAdapter {
  readonly channelKey = 'sms' as const;

  async sendMessage(orgId: string, _conversationId: string, text: string): Promise<SendResult> {
    const cfg = await getSmsConfig(orgId);
    if (!cfg) {
      return { providerMessageId: '', status: 'failed', errorMessage: 'SMS not configured for this org' };
    }
    // Lấy SĐT KH từ conversation
    const conversation = await prisma.conversation.findFirst({
      where: { id: _conversationId, orgId },
      include: { contact: { select: { phone: true } } },
    });
    const phone = conversation?.contact?.phone;
    if (!phone) return { providerMessageId: '', status: 'failed', errorMessage: 'Contact has no phone number' };

    try {
      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: phone, text, sender: cfg.sender }),
      });
      if (res.ok) {
        return { providerMessageId: `sms-${Date.now()}`, status: 'sent' };
      }
      const errText = await res.text().catch(() => '');
      return { providerMessageId: '', status: 'failed', errorMessage: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    } catch (err) {
      logger.error('[sms-brandname] send error:', err);
      return { providerMessageId: '', status: 'failed', errorMessage: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async receiveWebhook(_payload: unknown): Promise<ParsedMessage | null> {
    // SMS brandname VN thường dùng DLR (delivery receipt) qua POST callback.
    // Inbound SMS (KH reply SMS) ít phổ biến → return null cho Phase 1.
    return null;
  }
}