// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Lead Ads API client — Facebook Lead Ads & Zalo Ads.
 */
import { api } from './index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FacebookForm {
  id: string;
  orgId: string;
  pageId: string;
  formId: string;
  formName: string | null;
  status: string;
  lastPulledLeadCreatedTime: string | null;
  lastPulledCursor: string | null;
  lastPullAt: string | null;
  lastPullLeadCount: number;
  lastPullError: string | null;
  consecutiveErrors: number;
  historyBackfilled: boolean;
  createdAt: string;
  updatedAt: string;
  pageName: string | null;
  todayLeadCount: number;
  totalLeadCount: number;
}

export interface FacebookLead {
  id: string;
  orgId: string;
  leadgenId: string;
  formId: string;
  pageId: string;
  rawPayload: Record<string, unknown>;
  processedAt: string | null;
  contactId: string | null;
  error: string | null;
  createdAt: string;
  form?: { formName: string | null; pageName: string | null };
}

export interface FacebookLeadsResponse {
  leads: FacebookLead[];
  total: number;
}

export interface ZaloForm {
  id: string;
  orgId: string;
  oaConnectionId: string;
  formId: string;
  formName: string | null;
  customerListId: string;
  enabled: boolean;
  lastSyncedToTime: number | null;
  createdAt: string;
  oaName: string | null;
  todayLeadCount: number;
  totalLeadCount: number;
}

export interface ZaloLead {
  id: string;
  orgId: string;
  dedupeKey: string;
  formId: string;
  rawPayload: Record<string, unknown>;
  processedAt: string | null;
  contactId: string | null;
  error: string | null;
  createdAt: string;
  form?: { formName: string | null; oaName: string | null };
}

export interface ZaloLeadsResponse {
  leads: ZaloLead[];
  total: number;
}

// ─── Facebook Lead Ads ─────────────────────────────────────────────────────────

export const facebookLeadAdsApi = {
  listForms: (): Promise<FacebookForm[]> =>
    api.get('/facebook-lead-ads/forms').then((r) => r.data),

  getForm: (id: string): Promise<FacebookForm> =>
    api.get(`/facebook-lead-ads/forms/${id}`).then((r) => r.data),

  listLeads: (
    formId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<FacebookLeadsResponse> =>
    api
      .get(`/facebook-lead-ads/forms/${formId}/leads`, {
        params: { limit: opts.limit ?? 20, offset: opts.offset ?? 0 },
      })
      .then((r) => r.data),

  triggerPull: (id: string): Promise<{ success: boolean; message: string }> =>
    api.post(`/facebook-lead-ads/forms/${id}/pull`).then((r) => r.data),

  updateForm: (
    id: string,
    data: { status?: string },
  ): Promise<{ success: boolean }> =>
    api.patch(`/facebook-lead-ads/forms/${id}`, data).then((r) => r.data),
};

// ─── Zalo Ads ─────────────────────────────────────────────────────────────────

export const zaloAdsApi = {
  listForms: (): Promise<ZaloForm[]> =>
    api.get('/zalo-ads/forms').then((r) => r.data),

  getForm: (id: string): Promise<ZaloForm> =>
    api.get(`/zalo-ads/forms/${id}`).then((r) => r.data),

  listLeads: (
    formId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ZaloLeadsResponse> =>
    api
      .get(`/zalo-ads/forms/${formId}/leads`, {
        params: { limit: opts.limit ?? 20, offset: opts.offset ?? 0 },
      })
      .then((r) => r.data),
};
