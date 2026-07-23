// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
/**
 * lead-pool.ts — API client cho Lead Pool.
 */
import { api } from './index';

export interface LeadPoolConfig {
  id: string;
  orgId: string;
  enabled: boolean;
  maxRequestsPerDay: number;
  cooldownMinutes: number;
  forgottenThresholdDays: number;
  excludedStatuses: string[];
  autoReturnAfterDays: number;
  autoReturnAfterMinutes: number;
  requirePhoneInPool: boolean;
  forceNoteBeforeNext: boolean;
  enabledSources: string[];
  noteMinLength: number;
  cooldownAfterNoteDays: number;
  selfReclaimLockDays: number;
  greetingTemplates: string[];
  sourceListIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadPoolStats {
  leadsInPool: number;
  assignedToday: number;
  pendingRequests: number;
  upcomingAutoReturns: number;
}

export interface PooledLead {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  source: string;
  pooledAt: string;
  pooledByUserId: string;
  pooledByUser?: {
    id: string;
    fullName: string;
  };
  autoReturnAt: string;
  pooledCount: number;
  daysInPool: number;
}

export interface UserQuota {
  userId: string;
  usedToday: number;
  bonusQuota: number;
  maxRequestsPerDay: number;
  remainingQuota: number;
  lastRequestAt: string | null;
  inCooldown: boolean;
  cooldownSecondsLeft: number;
}

export interface LeadDistribution {
  id: string;
  orgId: string;
  contactId: string | null;
  phoneNormalized: string | null;
  assignedToUserId: string;
  source: string;
  round: number;
  leadRequestId: string | null;
  distributedAt: string;
  assignedTo?: {
    id: string;
    fullName: string;
  };
  contact?: {
    id: string;
    fullName: string;
    phone: string | null;
    status: string;
  };
}

export interface LeadRequest {
  id: string;
  orgId: string;
  requestedByUserId: string;
  contactId: string;
  source: string;
  priorityScore: number;
  noteContent: string | null;
  noteSubmittedAt: string | null;
  expiresAt: string;
  autoReturnedAt: string | null;
  releaseReason: string | null;
  previousAssigneeId: string | null;
  requestedAt: string;
  user?: {
    id: string;
    fullName: string;
  };
  contact?: {
    id: string;
    fullName: string;
    phone: string | null;
  };
}

export interface PaginatedResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Get lead pool config */
export async function getLeadPoolConfig(): Promise<LeadPoolConfig> {
  const res = await api.get<{ config: LeadPoolConfig }>('/lead-pool/config');
  return res.data.config;
}

/** Update lead pool config (admin only) */
export async function updateLeadPoolConfig(data: Partial<LeadPoolConfig>): Promise<LeadPoolConfig> {
  const res = await api.put<{ config: LeadPoolConfig }>('/lead-pool/config', data);
  return res.data.config;
}

/** Get lead pool stats */
export async function getLeadPoolStats(): Promise<LeadPoolStats> {
  const res = await api.get<{ stats: LeadPoolStats }>('/lead-pool/stats');
  return res.data.stats;
}

/** Get leads in pool */
export async function getPooledLeads(params: {
  page?: number;
  limit?: number;
  source?: string;
  search?: string;
} = {}): Promise<PaginatedResponse<PooledLead> & { leads: PooledLead[] }> {
  const res = await api.get<{ leads: PooledLead[] } & PaginatedResponse<PooledLead> & { total: number }>('/lead-pool/leads', { params });
  return res.data;
}

/** Request a lead from pool.
 *  FIX 2026-07-24: accepts optional `{ leadId }` so UI can claim a SPECIFIC lead row
 *  (was silently claiming the next-default lead → user click on row A got row B).
 *  Backend service should respect `leadId` when provided and fall back to FIFO otherwise. */
export async function requestLead(data?: { leadId?: string }): Promise<LeadDistribution> {
  const res = await api.post<{ distribution: LeadDistribution }>(
    '/lead-pool/request',
    data ?? {},
  );
  return res.data.distribution;
}

/** Get user's remaining quota */
export async function getUserQuota(): Promise<UserQuota> {
  const res = await api.get<{ quota: UserQuota }>('/lead-pool/quota');
  return res.data.quota;
}

/** Get distributions */
export async function getDistributions(params: {
  page?: number;
  limit?: number;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<PaginatedResponse<LeadDistribution> & { distributions: LeadDistribution[] }> {
  const res = await api.get<{ distributions: LeadDistribution[] } & PaginatedResponse<LeadDistribution> & { total: number }>('/lead-pool/distributions', { params });
  return res.data;
}

/** Get lead requests */
export async function getLeadRequests(params: {
  page?: number;
  limit?: number;
  userId?: string;
  status?: string;
} = {}): Promise<PaginatedResponse<LeadRequest> & { requests: LeadRequest[] }> {
  const res = await api.get<{ requests: LeadRequest[] } & PaginatedResponse<LeadRequest> & { total: number }>('/lead-pool/requests', { params });
  return res.data;
}

/** Add bonus quota for user (admin only) */
export async function addBonusQuota(data: {
  userId: string;
  bonusCount: number;
  reason?: string;
  reviewedLeadIds?: string[];
}): Promise<void> {
  await api.post('/lead-pool/bonus-quota', data);
}
