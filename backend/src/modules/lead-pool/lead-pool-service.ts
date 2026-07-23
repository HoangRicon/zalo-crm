// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
/**
 * lead-pool-service.ts — Business logic for Lead Pool.
 *
 * Handles:
 * - Lead distribution FIFO
 * - Quota checking (daily limit)
 * - Auto-return countdown calculation
 * - Eligibility checks
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

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
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadPoolDistributionRecord {
  id: string;
  orgId: string;
  contactId: string | null;
  phoneNormalized: string | null;
  assignedToUserId: string;
  source: string;
  round: number;
  leadRequestId: string | null;
  distributedAt: Date;
  assignedTo?: {
    id: string;
    fullName: string;
  };
  contact?: {
    id: string;
    fullName: string | null;
    phone: string | null;
    status: string | null;
  };
}

export interface UserQuota {
  userId: string;
  usedToday: number;
  bonusQuota: number;
  maxRequestsPerDay: number;
  remainingQuota: number;
  lastRequestAt: Date | null;
  inCooldown: boolean;
  cooldownSecondsLeft: number;
}

export interface PooledLead {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  source: string | null;
  pooledAt: Date;
  pooledByUserId: string | null;
  pooledByUser?: {
    id: string;
    fullName: string;
  } | null;
  autoReturnAt: Date;
  pooledCount: number;
  daysInPool: number;
}

export interface LeadRequestRecord {
  id: string;
  orgId: string;
  requestedByUserId: string;
  contactId: string;
  source: string;
  priorityScore: number;
  noteContent: string | null;
  noteSubmittedAt: Date | null;
  expiresAt: Date;
  autoReturnedAt: Date | null;
  releaseReason: string | null;
  previousAssigneeId: string | null;
  requestedAt: Date;
  contact?: {
    id: string;
    fullName: string;
    phone: string | null;
  };
  user?: {
    id: string;
    fullName: string;
  };
}

// VN timezone date key (YYYY-MM-DD)
function getDateKeyVN(): string {
  const vn = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vn).toISOString().split('T')[0];
}

function getVnNow(): Date {
  const vn = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Date(vn);
}

function getTodayRange(): { start: Date; end: Date } {
  const now = getVnNow();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

/** Get or create lead pool config for org */
export async function getLeadPoolConfig(orgId: string): Promise<LeadPoolConfig | null> {
  const config = await prisma.leadPoolConfig.findUnique({
    where: { orgId },
  });
  if (!config) return null;
  return {
    ...config,
    excludedStatuses: (config.excludedStatuses as string[]) || [],
    enabledSources: (config.enabledSources as string[]) || ['forgotten', 'customer_list'],
    greetingTemplates: (config.greetingTemplates as string[]) || [],
    sourceListIds: (config.sourceListIds as string[]) || [],
  };
}

/** Update lead pool config */
export async function updateLeadPoolConfig(
  orgId: string,
  data: Partial<Omit<LeadPoolConfig, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>
): Promise<LeadPoolConfig> {
  const updateData: Record<string, unknown> = {};
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.maxRequestsPerDay !== undefined) updateData.maxRequestsPerDay = data.maxRequestsPerDay;
  if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;
  if (data.forgottenThresholdDays !== undefined) updateData.forgottenThresholdDays = data.forgottenThresholdDays;
  if (data.excludedStatuses !== undefined) updateData.excludedStatuses = data.excludedStatuses;
  if (data.autoReturnAfterDays !== undefined) updateData.autoReturnAfterDays = data.autoReturnAfterDays;
  if (data.autoReturnAfterMinutes !== undefined) updateData.autoReturnAfterMinutes = data.autoReturnAfterMinutes;
  if (data.requirePhoneInPool !== undefined) updateData.requirePhoneInPool = data.requirePhoneInPool;
  if (data.forceNoteBeforeNext !== undefined) updateData.forceNoteBeforeNext = data.forceNoteBeforeNext;
  if (data.enabledSources !== undefined) updateData.enabledSources = data.enabledSources;
  if (data.noteMinLength !== undefined) updateData.noteMinLength = data.noteMinLength;
  if (data.cooldownAfterNoteDays !== undefined) updateData.cooldownAfterNoteDays = data.cooldownAfterNoteDays;
  if (data.selfReclaimLockDays !== undefined) updateData.selfReclaimLockDays = data.selfReclaimLockDays;
  if (data.greetingTemplates !== undefined) updateData.greetingTemplates = data.greetingTemplates;
  if (data.sourceListIds !== undefined) updateData.sourceListIds = data.sourceListIds;

  const config = await prisma.leadPoolConfig.upsert({
    where: { orgId },
    update: updateData,
    create: {
      orgId,
      enabled: data.enabled ?? true,
      maxRequestsPerDay: data.maxRequestsPerDay ?? 10,
      cooldownMinutes: data.cooldownMinutes ?? 15,
      forgottenThresholdDays: data.forgottenThresholdDays ?? 30,
      excludedStatuses: data.excludedStatuses ?? ['hot', 'potential', 'won'],
      autoReturnAfterDays: data.autoReturnAfterDays ?? 7,
      autoReturnAfterMinutes: data.autoReturnAfterMinutes ?? 1440,
      requirePhoneInPool: data.requirePhoneInPool ?? true,
      forceNoteBeforeNext: data.forceNoteBeforeNext ?? true,
      enabledSources: data.enabledSources ?? ['forgotten', 'customer_list'],
      noteMinLength: data.noteMinLength ?? 20,
      cooldownAfterNoteDays: data.cooldownAfterNoteDays ?? 30,
      selfReclaimLockDays: data.selfReclaimLockDays ?? 7,
      greetingTemplates: data.greetingTemplates ?? [],
      sourceListIds: data.sourceListIds ?? [],
    },
  });

  return {
    ...config,
    excludedStatuses: (config.excludedStatuses as string[]) || [],
    enabledSources: (config.enabledSources as string[]) || ['forgotten', 'customer_list'],
    greetingTemplates: (config.greetingTemplates as string[]) || [],
    sourceListIds: (config.sourceListIds as string[]) || [],
  };
}

/** Get user's remaining quota and cooldown status */
export async function getUserQuota(orgId: string, userId: string): Promise<UserQuota> {
  const config = await getLeadPoolConfig(orgId);
  const maxRequests = config?.maxRequestsPerDay ?? 10;
  const cooldownMinutes = config?.cooldownMinutes ?? 15;

  const { start, end } = getTodayRange();

  // Count requests today using requestedAt date range
  const requestCount = await prisma.leadRequest.count({
    where: {
      orgId,
      requestedByUserId: userId,
      requestedAt: { gte: start, lt: end },
    },
  });

  // Get bonus quota for today using dateKey
  const today = getDateKeyVN();
  const bonusQuota = await prisma.leadPoolBonusQuota.aggregate({
    where: { orgId, userId, dateKey: today },
    _sum: { bonusCount: true },
  });

  const totalBonus = bonusQuota._sum.bonusCount ?? 0;
  const totalQuota = maxRequests + totalBonus;
  const remainingQuota = Math.max(0, totalQuota - requestCount);

  // Get last request time for cooldown
  const lastRequest = await prisma.leadRequest.findFirst({
    where: { orgId, requestedByUserId: userId },
    orderBy: { requestedAt: 'desc' },
    select: { requestedAt: true },
  });

  const now = getVnNow();
  let inCooldown = false;
  let cooldownSecondsLeft = 0;
  if (lastRequest) {
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const cooldownEnd = new Date(lastRequest.requestedAt.getTime() + cooldownMs);
    if (now < cooldownEnd) {
      inCooldown = true;
      cooldownSecondsLeft = Math.max(0, Math.floor((cooldownEnd.getTime() - now.getTime()) / 1000));
    }
  }

  return {
    userId,
    usedToday: requestCount,
    bonusQuota: totalBonus,
    maxRequestsPerDay: totalQuota,
    remainingQuota,
    lastRequestAt: lastRequest?.requestedAt ?? null,
    inCooldown,
    cooldownSecondsLeft,
  };
}

/** Get leads in the pool for an org */
export async function getPooledLeads(
  orgId: string,
  options: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
  } = {}
): Promise<{ leads: PooledLead[]; total: number }> {
  const { page = 1, limit = 20, source, search } = options;
  const skip = (page - 1) * limit;
  const now = getVnNow();

  const config = await getLeadPoolConfig(orgId);
  const autoReturnMinutes = config?.autoReturnAfterMinutes ?? 1440;

  const where: Record<string, unknown> = {
    orgId,
    // Schema thật không có poolStatus/poolSource/pooledAt/pooledByUserId trên Contact.
    // Tạm thời: lấy contact chưa được gán cho sale nào (assignedUserId IS NULL) làm proxy
    // cho "đang trong pool". Sau khi Phase Lead Pool schema được add vào migration, sẽ
    // đổi sang query LeadPoolDistribution table.
    assignedUserId: null,
    // Exclude statuses
    ...(config?.excludedStatuses?.length
      ? { status: { notIn: config.excludedStatuses } }
      : {}),
  };

  if (source) {
    where.source = source;
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  // If requirePhoneInPool is true, only show leads with phone
  if (config?.requirePhoneInPool) {
    where.phone = { not: null };
  }

  const [leads, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ pooledCount: 'asc' }, { lastPooledAt: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        source: true,
        lastPooledAt: true,
        pooledCount: true,
        createdAt: true,
      },
    }),
    prisma.contact.count({ where }),
  ]);

  const pooledLeads: PooledLead[] = leads.map((lead) => {
    const pooledAtDate = lead.lastPooledAt ?? lead.createdAt ?? now;
    const autoReturnAt = new Date(pooledAtDate.getTime() + autoReturnMinutes * 60 * 1000);
    const daysInPool = Math.floor((now.getTime() - pooledAtDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: lead.id,
      fullName: lead.fullName ?? '',
      phone: lead.phone,
      status: lead.status ?? 'new',
      source: lead.source,
      pooledAt: pooledAtDate,
      pooledByUserId: null,
      pooledByUser: null,
      autoReturnAt,
      pooledCount: lead.pooledCount ?? 0,
      daysInPool,
    };
  });

  return { leads: pooledLeads, total };
}

/** Request a lead from the pool (sale action).
 *  FIX 2026-07-24: accepts optional `leadId` so UI can claim a SPECIFIC lead row.
 *  When provided, looks up the lead first; if not in pool → error 'lead_unavailable'.
 *  When undefined → falls back to FIFO (next available). */
export async function requestLead(
  orgId: string,
  userId: string,
  leadId?: string
): Promise<{ success: boolean; error?: string; distribution?: LeadPoolDistributionRecord }> {
  const config = await getLeadPoolConfig(orgId);

  if (!config?.enabled) {
    return { success: false, error: 'lead_pool_disabled' };
  }

  // Check cooldown
  const quota = await getUserQuota(orgId, userId);
  if (quota.inCooldown) {
    return { success: false, error: 'in_cooldown' };
  }

  if (quota.remainingQuota <= 0) {
    return { success: false, error: 'quota_exceeded' };
  }

  // Find lead (specific or next in pool via FIFO).
  // SPECIFIC path: validate leadId belongs to orgId AND is actually in pool
  // (assignedUserId IS NULL AND not in excluded statuses).
  let lead: PooledLead | null | undefined;
  if (leadId) {
    lead = await getPooledLeadById(orgId, leadId);
    if (!lead) return { success: false, error: 'lead_unavailable' };
  } else {
    const { leads } = await getPooledLeads(orgId, { limit: 1 });
    if (leads.length === 0) return { success: false, error: 'no_leads_in_pool' };
    lead = leads[0];
  }
  if (!lead) return { success: false, error: 'no_leads_in_pool' };
  const now = getVnNow();
  const autoReturnMinutes = config.autoReturnAfterMinutes ?? 1440;
  const expiresAt = new Date(now.getTime() + autoReturnMinutes * 60 * 1000);

  // Create lead request and distribution in transaction
  const [request, distribution] = await prisma.$transaction(async (tx) => {
    // Create lead request
    const request = await tx.leadRequest.create({
      data: {
        orgId,
        requestedByUserId: userId,
        contactId: lead.id,
        source: lead.source ?? 'unknown',
        priorityScore: 0,
        expiresAt,
      },
    });

    // Update contact: assign to user (remove from pool bằng cách gán assignedUserId)
    await tx.contact.update({
      where: { id: lead.id },
      data: {
        assignedUserId: userId,
        pooledCount: { increment: 1 },
        lastPooledAt: now,
      },
    });

    // Create distribution record
    const distRecord = await tx.leadPoolDistribution.create({
      data: {
        orgId,
        contactId: lead.id,
        phoneNormalized: lead.phone?.replace(/\D/g, '') ?? null,
        assignedToUserId: userId,
        source: lead.source ?? 'unknown',
        round: (lead.pooledCount ?? 0) + 1,
        leadRequestId: request.id,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        contact: { select: { id: true, fullName: true, phone: true, status: true } },
      },
    });

    return [request, distRecord];
  });

  logger.info(`[lead-pool] lead distributed: contact=${lead.id} to user=${userId} org=${orgId}`);

  return {
    success: true,
    distribution: {
      ...distribution,
      assignedTo: distribution.assignedTo ?? undefined,
      contact: distribution.contact ?? undefined,
    },
  };
}

/** Get distribution history */
export async function getDistributions(
  orgId: string,
  options: {
    page?: number;
    limit?: number;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}
): Promise<{ distributions: LeadPoolDistributionRecord[]; total: number }> {
  const { page = 1, limit = 20, userId, dateFrom, dateTo } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { orgId };
  if (userId) where.assignedToUserId = userId;
  if (dateFrom || dateTo) {
    where.distributedAt = {};
    if (dateFrom) (where.distributedAt as Record<string, Date>).gte = dateFrom;
    if (dateTo) (where.distributedAt as Record<string, Date>).lte = dateTo;
  }

  const [distributions, total] = await Promise.all([
    prisma.leadPoolDistribution.findMany({
      where,
      orderBy: { distributedAt: 'desc' },
      skip,
      take: limit,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        contact: { select: { id: true, fullName: true, phone: true, status: true } },
      },
    }),
    prisma.leadPoolDistribution.count({ where }),
  ]);

  return {
    distributions: distributions.map((d) => ({
      ...d,
      assignedTo: d.assignedTo ?? undefined,
      contact: d.contact
        ? {
            id: d.contact.id,
            fullName: d.contact.fullName ?? '',
            phone: d.contact.phone,
            status: d.contact.status ?? 'new',
          }
        : undefined,
    })),
    total,
  };
}

/** Get lead requests */
export async function getLeadRequests(
  orgId: string,
  options: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
  } = {}
): Promise<{ requests: LeadRequestRecord[]; total: number }> {
  const { page = 1, limit = 20, userId, status } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { orgId };
  if (userId) where.requestedByUserId = userId;
  if (status) {
    if (status === 'pending') {
      where.releaseReason = null;
    } else {
      where.releaseReason = status;
    }
  }

  const [requests, total] = await Promise.all([
    prisma.leadRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true } },
        contact: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.leadRequest.count({ where }),
  ]);

  return {
    requests: requests.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      requestedByUserId: r.requestedByUserId,
      contactId: r.contactId,
      source: r.source,
      priorityScore: r.priorityScore,
      noteContent: r.noteContent,
      noteSubmittedAt: r.noteSubmittedAt,
      expiresAt: r.expiresAt,
      autoReturnedAt: r.autoReturnedAt,
      releaseReason: r.releaseReason,
      previousAssigneeId: r.previousAssigneeId,
      requestedAt: r.requestedAt,
      user: r.user ?? undefined,
      contact: r.contact
        ? {
            id: r.contact.id,
            fullName: r.contact.fullName ?? '',
            phone: r.contact.phone,
          }
        : undefined,
    })),
    total,
  };
}

/** Get stats for dashboard */
export async function getLeadPoolStats(orgId: string): Promise<{
  leadsInPool: number;
  assignedToday: number;
  pendingRequests: number;
  upcomingAutoReturns: number;
}> {
  const config = await getLeadPoolConfig(orgId);
  const now = getVnNow();
  const { start, end } = getTodayRange();
  const autoReturnMinutes = config?.autoReturnAfterMinutes ?? 1440;

  // Leads in pool (proxy: assignedUserId IS NULL)
  const poolWhere: Record<string, unknown> = {
    orgId,
    assignedUserId: null,
  };
  if (config?.excludedStatuses?.length) {
    poolWhere.status = { notIn: config.excludedStatuses };
  }
  if (config?.requirePhoneInPool) {
    poolWhere.phone = { not: null };
  }

  const [leadsInPool, assignedToday, pendingRequests] = await Promise.all([
    prisma.contact.count({ where: poolWhere }),
    prisma.leadPoolDistribution.count({
      where: {
        orgId,
        distributedAt: { gte: start, lt: end },
      },
    }),
    prisma.leadRequest.count({
      where: {
        orgId,
        releaseReason: null,
        requestedAt: { gte: start, lt: end },
      },
    }),
  ]);

  // Auto-returns in next 24h (proxy: lastPooledAt gần đây + còn trong pool)
  const autoReturnCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingAutoReturns = await prisma.contact.count({
    where: {
      ...poolWhere,
      lastPooledAt: {
        gte: new Date(now.getTime() - autoReturnMinutes * 60 * 1000),
        lte: autoReturnCutoff,
      },
    },
  });

  return {
    leadsInPool,
    assignedToday,
    pendingRequests,
    upcomingAutoReturns,
  };
}

/** Add bonus quota for a user (admin action) */
export async function addBonusQuota(
  orgId: string,
  userId: string,
  bonusCount: number,
  grantedByUserId: string,
  reason?: string,
  reviewedLeadIds: string[] = []
): Promise<void> {
  const today = getDateKeyVN();

  await prisma.leadPoolBonusQuota.create({
    data: {
      orgId,
      userId,
      dateKey: today,
      bonusCount,
      grantedByUserId,
      reason,
      reviewedLeadIds,
    },
  });

  logger.info(`[lead-pool] bonus quota: +${bonusCount} to user=${userId} by=${grantedByUserId} org=${orgId}`);
}

/** Lookup a single pooled lead by id (must be in pool: assignedUserId null + not in excluded statuses).
 *  FIX 2026-07-24: support SPECIFIC leadId claim from UI. Returns null if not in pool.
 *  Reuses getLeadPoolConfig for excludedStatuses logic (matches getPooledLeads filter). */
export async function getPooledLeadById(orgId: string, leadId: string): Promise<PooledLead | null> {
  const config = await getLeadPoolConfig(orgId);
  const now = getVnNow();
  const autoReturnMinutes = config?.autoReturnAfterMinutes ?? 1440;

  const lead = await prisma.contact.findFirst({
    where: {
      id: leadId,
      orgId,
      assignedUserId: null,
      ...(config?.excludedStatuses?.length
        ? { status: { notIn: config.excludedStatuses } }
        : {}),
      ...(config?.requirePhoneInPool ? { phone: { not: null } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      status: true,
      source: true,
      lastPooledAt: true,
      pooledCount: true,
      createdAt: true,
    },
  });

  if (!lead) return null;

  const pooledAtDate = lead.lastPooledAt ?? lead.createdAt ?? now;
  const autoReturnAt = new Date(pooledAtDate.getTime() + autoReturnMinutes * 60 * 1000);
  const daysInPool = Math.floor((now.getTime() - pooledAtDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: lead.id,
    fullName: lead.fullName ?? '',
    phone: lead.phone,
    status: lead.status ?? 'new',
    source: lead.source,
    pooledAt: pooledAtDate,
    pooledByUserId: '',
    pooledByUser: undefined,
    autoReturnAt,
    pooledCount: lead.pooledCount ?? 0,
    daysInPool,
  };
}
