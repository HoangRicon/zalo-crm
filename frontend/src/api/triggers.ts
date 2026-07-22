// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Triggers API client (Community stub — declarative CRUD only).
import { api } from '@/api/index';

export interface TriggerRow {
  id: string;
  name: string;
  category: string;
  eventType: string;
  bindingKind: 'sequence' | 'block' | 'broadcast';
  sequenceId: string | null;
  blockId: string | null;
  broadcastId: string | null;
  enabled: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
}

interface TriggerBody {
  name?: string;
  category?: string;
  eventType?: string;
  bindingKind?: 'sequence' | 'block' | 'broadcast';
  sequenceId?: string | null;
  blockId?: string | null;
  broadcastId?: string | null;
  enabled?: boolean;
}

export async function list(): Promise<TriggerRow[]> {
  const res = await api.get('/triggers');
  return res.data.triggers ?? [];
}

export async function create(body: TriggerBody): Promise<TriggerRow> {
  const res = await api.post('/triggers', body);
  return res.data.trigger;
}

export async function update(id: string, body: TriggerBody): Promise<TriggerRow> {
  const res = await api.patch(`/triggers/${id}`, body);
  return res.data.trigger;
}

export async function toggle(id: string): Promise<TriggerRow> {
  const res = await api.post(`/triggers/${id}/toggle`);
  return res.data.trigger;
}

export async function remove(id: string): Promise<void> {
  await api.delete(`/triggers/${id}`);
}

export const EVENT_TYPES = [
  { value: 'friend_accepted', label: 'Khi khách đồng ý kết bạn' },
  { value: 'friend_rejected', label: 'Khi khách từ chối kết bạn' },
  { value: 'message_inbound', label: 'Khi nhận tin nhắn từ khách' },
  { value: 'new_lead_received', label: 'Khi nhận lead mới (Lead Pool / Lead Ads)' },
  { value: 'tag_added', label: 'Khi gắn tag cho khách' },
  { value: 'schedule_cron', label: 'Theo lịch (cron)' },
  { value: 'manual', label: 'Kích hoạt thủ công' },
];

export const BINDING_KINDS = [
  { value: 'sequence', label: 'Sequence (kịch bản nhiều bước)' },
  { value: 'block', label: 'Content Block (1 khối nội dung)' },
  { value: 'broadcast', label: 'Broadcast (gửi 1 lần)' },
] as const;
