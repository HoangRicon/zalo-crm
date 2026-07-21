// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * providers/facebook-messenger.ts — Sprint 6 R10 (2026-07-21).
 *
 * Stub adapter cho Facebook Messenger. Interface hoàn chỉnh,
 * logic thật (OAuth verify, send API) sẽ thêm trong Phase 2.
 *
 * Real API reference: https://developers.facebook.com/docs/messenger-platform
 */
import type { ChannelAdapter, ParsedMessage, SendResult } from '../channel-adapter.interface.js';
import { logger } from '../../../shared/utils/logger.js';

export class FacebookMessengerAdapter implements ChannelAdapter {
  readonly channelKey = 'facebook' as const;

  async sendMessage(_orgId: string, _conversationId: string, _text: string, _attachments?: Array<{ url: string; contentType: string }>): Promise<SendResult> {
    logger.warn('[fb-messenger] sendMessage stub — chưa tích hợp thật, cần OAuth token trong app_settings');
    return { providerMessageId: '', status: 'failed', errorMessage: 'Facebook Messenger not configured' };
  }

  async receiveWebhook(payload: unknown): Promise<ParsedMessage | null> {
    // Shape: { object: 'page', entry: [{ messaging: [{ sender: { id }, message: { text, mid } }] }] }
    try {
      const p = payload as { object?: string; entry?: Array<{ messaging?: Array<{ sender: { id: string }; message?: { text?: string; mid?: string; attachments?: Array<{ payload: { url: string } }> } }> }> };
      if (p?.object !== 'page' || !p.entry?.length) return null;
      for (const entry of p.entry) {
        for (const evt of entry.messaging ?? []) {
          if (!evt.message) continue;
          return {
            channel: 'facebook',
            externalUserId: evt.sender.id,
            externalThreadId: evt.sender.id,
            senderType: 'contact',
            externalMessageId: evt.message.mid ?? `fb-${Date.now()}`,
            text: evt.message.text ?? '',
            contentType: 'text',
            sentAt: new Date(),
          };
        }
      }
    } catch (err) {
      logger.warn('[fb-messenger] receiveWebhook parse error:', err);
    }
    return null;
  }
}