// Automation Report API (2026-07-22)
import { api } from './index';

export interface AutomationLog {
  id: string;
  type: string;
  jobId: string;
  status: string;
  sent: number;
  failed: number;
  startedAt: string;
  completedAt: string | null;
  oaAccountName: string | null;
}

export interface AutomationSummary {
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  byType: Array<{ type: string; count: number; sent: number; failed: number }>;
}

export const automationReportApi = {
  async history(filters: { type?: string; from?: string; to?: string; page?: number; limit?: number } = {}) {
    const r = await api.get<{ logs: AutomationLog[]; total: number; page: number; limit: number }>(
      '/reports/automation/history',
      { params: filters },
    );
    return r.data;
  },
  async summary() {
    const r = await api.get<AutomationSummary>('/reports/automation/summary');
    return r.data;
  },
};