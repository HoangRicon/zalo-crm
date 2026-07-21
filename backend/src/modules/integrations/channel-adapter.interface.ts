// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * integrations/channel-adapter.interface.ts — Sprint 6 R10 (2026-07-21).
 *
 * Contract cho mỗi kênh communication (Zalo là canonical, không cần adapter).
 * Channel providers (Facebook/Instagram/SMS) implement interface này.
 */

export type ChannelKey = 'zalo' | 'telegram' | 'facebook' | 'instagram' | 'sms';

export interface ParsedMessage {
  channel: ChannelKey;
  externalUserId: string;        // PSID (FB), IG handle, SĐT (SMS)
  externalThreadId: string;      // PSID || thread key
  senderType: 'self' | 'contact'; // contact cho inbound
  externalMessageId: string;
  text: string;
  contentType: 'text' | 'image' | 'video' | 'file';
  sentAt: Date;
  attachments?: Array<{ url: string; contentType: string; fileName?: string }>;
}

export interface SendResult {
  providerMessageId: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export interface ChannelAdapter {
  /** Gửi 1 tin nhắn qua channel này */
  sendMessage(orgId: string, conversationId: string, text: string, attachments?: Array<{ url: string; contentType: string }>): Promise<SendResult>;

  /** Xử lý inbound webhook payload, return parsed message hoặc null nếu không phải message */
  receiveWebhook(payload: unknown): Promise<ParsedMessage | null>;

  /** Tên kênh (cho logs) */
  readonly channelKey: ChannelKey;
}