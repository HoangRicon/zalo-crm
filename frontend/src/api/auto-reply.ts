// Auto Reply Rules API (2026-07-22)
import { api } from './index';

export type TriggerType = 'keyword' | 'regex' | 'tag' | 'time_window';
export type ActionType = 'text' | 'image' | 'template' | 'ai_suggest';

export interface AutoReplyRule {
  id: string;
  orgId: string;
  oaAccountId: string | null;
  name: string;
  triggerType: TriggerType;
  triggerValue: string;
  actionType: ActionType;
  actionContent: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const autoReplyApi = {
  async list() {
    const r = await api.get<AutoReplyRule[]>('/ai/auto-reply');
    return r.data;
  },
  async create(data: Partial<AutoReplyRule>) {
    const r = await api.post<AutoReplyRule>('/ai/auto-reply', data);
    return r.data;
  },
  async update(id: string, data: Partial<AutoReplyRule>) {
    const r = await api.put<AutoReplyRule>(`/ai/auto-reply/${id}`, data);
    return r.data;
  },
  async delete(id: string) {
    await api.delete(`/ai/auto-reply/${id}`);
  },
  async test(triggerType: TriggerType, triggerValue: string, sampleMessage: string) {
    const r = await api.post<{ matched: boolean }>('/ai/auto-reply/test', {
      triggerType,
      triggerValue,
      sampleMessage,
    });
    return r.data;
  },
};