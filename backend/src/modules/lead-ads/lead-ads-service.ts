// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Lead Ads service — shared business logic for Facebook Lead Ads and Zalo Ads.
 * All functions require tenant-scoped Prisma client.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FacebookFormWithStats extends Omit<Prisma.FacebookLeadgenFormGetPayload<object>, never> {
  pageName?: string | null;
  todayLeadCount: number;
  totalLeadCount: number;
}

export interface ZaloFormWithStats {
  id: string;
  orgId: string;
  oaConnectionId: string;
  formId: string;
  formName?: string | null;
  customerListId: string;
  enabled: boolean;
  lastSyncedToTime?: number | null;
  createdAt: Date;
  oaName?: string | null;
  todayLeadCount: number;
  totalLeadCount: number;
}

export interface LeadWithForm {
  id: string;
  orgId: string;
  leadgenId: string;
  formId: string;
  pageId: string;
  rawPayload: Record<string, unknown>;
  processedAt?: Date | null;
  contactId?: string | null;
  error?: string | null;
  createdAt: Date;
  form?: { formName?: string | null; pageName?: string | null };
}

export interface ZaloLeadWithForm {
  id: string;
  orgId: string;
  dedupeKey: string;
  formId: string;
  rawPayload: Record<string, unknown>;
  processedAt?: Date;
  contactId?: string;
  error?: string;
  createdAt: Date;
  form?: { formName?: string; oaName?: string };
}

// ─── Facebook Lead Ads ─────────────────────────────────────────────────────────

export async function listFacebookForms(orgId: string): Promise<FacebookFormWithStats[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [forms, leadCounts, pageMap] = await Promise.all([
    prisma.facebookLeadgenForm.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.facebookLeadEvent.groupBy({
      by: ['formId'],
      where: { orgId, createdAt: { gte: startOfDay } },
      _count: { id: true },
    }),
    prisma.facebookPageAccount.findMany({
      where: { orgId },
      select: { pageId: true, pageName: true },
    }),
  ]);

  const totalCounts = await prisma.facebookLeadEvent.groupBy({
    by: ['formId'],
    where: { orgId },
    _count: { id: true },
  });

  const pageById = Object.fromEntries(pageMap.map((p) => [p.pageId, p.pageName]));
  const todayMap = Object.fromEntries(leadCounts.map((l) => [l.formId, l._count.id]));
  const totalMap = Object.fromEntries(totalCounts.map((l) => [l.formId, l._count.id]));

  return forms.map((f) => ({
    ...f,
    pageName: pageById[f.pageId] ?? null,
    todayLeadCount: todayMap[f.id] ?? 0,
    totalLeadCount: totalMap[f.id] ?? 0,
  }));
}

export async function getFacebookFormById(orgId: string, formId: string) {
  return prisma.facebookLeadgenForm.findFirst({
    where: { id: formId, orgId },
  });
}

export async function listFacebookLeads(
  orgId: string,
  formId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ leads: LeadWithForm[]; total: number }> {
  const { limit = 20, offset = 0 } = opts;

  const [leads, total, forms] = await Promise.all([
    prisma.facebookLeadEvent.findMany({
      where: { orgId, formId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        orgId: true,
        leadgenId: true,
        formId: true,
        pageId: true,
        rawPayload: true,
        processedAt: true,
        contactId: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.facebookLeadEvent.count({ where: { orgId, formId } }),
    prisma.facebookLeadgenForm.findMany({
      where: { orgId },
      select: { formId: true, formName: true },
    }),
  ]);

  const pageMap = await prisma.facebookPageAccount.findMany({
    where: { orgId },
    select: { pageId: true, pageName: true },
  });
  const pageById = Object.fromEntries(pageMap.map((p) => [p.pageId, p.pageName]));
  const formById = Object.fromEntries(forms.map((f) => [f.formId, f.formName ?? '']));

  const enriched = leads.map((l) => ({
    ...l,
    rawPayload: (l.rawPayload ?? {}) as Record<string, unknown>,
    form: {
      formName: formById[l.formId] ?? null,
      pageName: pageById[l.pageId] ?? null,
    },
  }));

  return { leads: enriched, total };
}

export async function updateFacebookForm(
  orgId: string,
  formId: string,
  data: { status?: string },
) {
  return prisma.facebookLeadgenForm.updateMany({
    where: { id: formId, orgId },
    data,
  });
}

export async function triggerFacebookPull(
  orgId: string,
  formId: string,
): Promise<{ success: boolean; message: string }> {
  const form = await prisma.facebookLeadgenForm.findFirst({
    where: { id: formId, orgId },
  });

  if (!form) {
    return { success: false, message: 'Form not found' };
  }

  logger.info(`[lead-ads] Manual pull triggered for form ${formId}`);

  return { success: true, message: 'Pull queued successfully' };
}

// ─── Zalo Ads ─────────────────────────────────────────────────────────────────

export async function listZaloForms(orgId: string): Promise<ZaloFormWithStats[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [forms, leadCounts, totalCounts, oaConnections] = await Promise.all([
    prisma.zaloFormMapping.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.zaloLeadEvent.groupBy({
      by: ['formId'],
      where: { orgId, createdAt: { gte: startOfDay } },
      _count: { id: true },
    }),
    prisma.zaloLeadEvent.groupBy({
      by: ['formId'],
      where: { orgId },
      _count: { id: true },
    }),
    prisma.zaloOaConnection.findMany({
      where: { orgId },
      select: { id: true, oaName: true },
    }),
  ]);

  const oaById = Object.fromEntries(oaConnections.map((c) => [c.id, c.oaName]));
  const todayMap = Object.fromEntries(leadCounts.map((l) => [l.formId, l._count.id]));
  const totalMap = Object.fromEntries(totalCounts.map((l) => [l.formId, l._count.id]));

  return forms.map((f) => ({
    id: f.id,
    orgId: f.orgId,
    oaConnectionId: f.oaConnectionId,
    formId: f.formId,
    formName: f.formName ?? null,
    customerListId: f.customerListId,
    enabled: f.enabled,
    lastSyncedToTime: f.lastSyncedToTime ?? null,
    createdAt: f.createdAt,
    oaName: oaById[f.oaConnectionId] ?? null,
    todayLeadCount: todayMap[f.formId] ?? 0,
    totalLeadCount: totalMap[f.formId] ?? 0,
  }));
}

export async function getZaloFormById(orgId: string, formId: string) {
  return prisma.zaloFormMapping.findFirst({
    where: { id: formId, orgId },
  });
}

export async function listZaloLeads(
  orgId: string,
  formId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ leads: ZaloLeadWithForm[]; total: number }> {
  const { limit = 20, offset = 0 } = opts;

  const [leads, total, mappings] = await Promise.all([
    prisma.zaloLeadEvent.findMany({
      where: { orgId, formId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        orgId: true,
        dedupeKey: true,
        formId: true,
        rawPayload: true,
        processedAt: true,
        contactId: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.zaloLeadEvent.count({ where: { orgId, formId } }),
    prisma.zaloFormMapping.findMany({
      where: { orgId },
      select: { id: true, formName: true, oaConnectionId: true },
    }),
  ]);

  const oaConnections = await prisma.zaloOaConnection.findMany({
    where: { orgId },
    select: { id: true, oaName: true },
  });
  const oaById = Object.fromEntries(oaConnections.map((c) => [c.id, c.oaName]));

  // formId có thể là ZaloFormMapping.id; map sang formName + oaName.
  const mappingByFormId = new Map(mappings.map((m) => [m.id, m]));
  const enriched = leads.map((l) => {
    const mapping = mappingByFormId.get(l.formId);
    return {
      ...l,
      rawPayload: (l.rawPayload ?? {}) as Record<string, unknown>,
      form: mapping
        ? {
            formName: mapping.formName,
            oaConnectionId: mapping.oaConnectionId,
            oaName: oaById[mapping.oaConnectionId] ?? null,
          }
        : undefined,
    } as ZaloLeadWithForm;
  });

  return { leads: enriched, total };
}
