// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * providers/instagram-dm.ts — Sprint 6 R10 (2026-07-21).
 * Stub tương tự Facebook Messenger. Sẽ share nhiều code trong Phase 2
 * (Instagram Graph API dùng cùng PSID-style).
 */
import type { ChannelAdapter, ParsedMessage, SendResult } from '../channel-adapter.interface.js';
import { logger } from '../../../shared/utils/logger.js';

export class InstagramDmAdapter implements ChannelAdapter {
  readonly channelKey = 'instagram' as const;

  async sendMessage(_orgId: string, _conversationId: string, _text: string): Promise<SendResult> {
    logger.warn('[ig-dm] sendMessage stub — chưa tích hợp thật');
    return { providerMessageId: '', status: 'failed', errorMessage: 'Instagram DM not configured' };
  }

  async receiveWebhook(payload: unknown): Promise<ParsedMessage | null> {
    // Tương tự FB — IG webhook gửi cùng shape qua Graph API
    try {
      const p = payload as { object?: string; entry?: Array<{ messaging?: Array<{ sender: { id: string }; message?: { text?: string; mid?: string } }> }> };
      if (p?.object !== 'instagram' || !p.entry?.length) return null;
      for (const entry of p.entry) {
        for (const evt of entry.messaging ?? []) {
          if (!evt.message) continue;
          return {
            channel: 'instagram',
            externalUserId: evt.sender.id,
            externalThreadId: evt.sender.id,
            senderType: 'contact',
            externalMessageId: evt.message.mid ?? `ig-${Date.now()}`,
            text: evt.message.text ?? '',
            contentType: 'text',
            sentAt: new Date(),
          };
        }
      }
    } catch { /* noop */ }
    return null;
  }
}