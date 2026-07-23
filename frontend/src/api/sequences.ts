// Sequences API (2026-07-22)
import { api } from './index';

export interface SequenceStep {
  id?: string;
  stepOrder: number;
  blockId: string | null;
  delayMinutes?: number;
  jitterMinutes?: number;
  exitCondition?: Record<string, unknown> | null;
}

export interface Sequence {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused';
  steps: SequenceStep[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const sequencesApi = {
  async list() {
    const r = await api.get<Sequence[]>('/sequences');
    return r.data;
  },
  async get(id: string) {
    const r = await api.get<Sequence>(`/sequences/${id}`);
    return r.data;
  },
  async create(data: { name: string; description?: string; steps?: SequenceStep[] }) {
    const r = await api.post<Sequence>('/sequences', data);
    return r.data;
  },
  async update(id: string, data: { name?: string; description?: string; steps?: SequenceStep[]; status?: string }) {
    const r = await api.put<Sequence>(`/sequences/${id}`, data);
    return r.data;
  },
  async delete(id: string) {
    await api.delete(`/sequences/${id}`);
  },
  async activate(id: string) {
    const r = await api.post<Sequence>(`/sequences/${id}/activate`);
    return r.data;
  },
  async pause(id: string) {
    const r = await api.post<Sequence>(`/sequences/${id}/pause`);
    return r.data;
  },
  async history(id: string) {
    const r = await api.get(`/sequences/${id}/history`);
    return r.data;
  },
  async enroll(sequenceId: string, contactId: string, oaAccountId: string) {
    await api.post(`/sequences/${sequenceId}/enroll`, { contactId, oaAccountId });
  },
};