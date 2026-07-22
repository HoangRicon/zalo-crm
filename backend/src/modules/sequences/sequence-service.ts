// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Sequence Service - CRUD for sequences (drip campaigns)
// Note: SequenceStep dùng blockId (FK Block) thay vì actionType/actionConfig
import { prisma } from '../../shared/database/prisma-client.js';

export interface SequenceStepInput {
  blockId: string | null;
  stepOrder: number;
  delayMinutes?: number;
  jitterMinutes?: number;
  exitCondition?: Record<string, unknown> | null;
}

export interface SequenceRecord {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: string;
  steps: unknown[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listSequences(orgId: string): Promise<SequenceRecord[]> {
  const seqs = await prisma.automationSequence.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
  return seqs.map((s) => ({
    id: s.id,
    orgId: s.orgId,
    name: s.name,
    description: s.description,
    status: s.enabled ? 'active' : 'paused',
    steps: [],
    createdById: s.createdById,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function getSequence(orgId: string, id: string): Promise<SequenceRecord | null> {
  const s = await prisma.automationSequence.findFirst({ where: { id, orgId } });
  if (!s) return null;
  const steps = await prisma.sequenceStep.findMany({
    where: { sequenceId: id },
    orderBy: { stepOrder: 'asc' },
  });
  return {
    id: s.id,
    orgId: s.orgId,
    name: s.name,
    description: s.description,
    status: s.enabled ? 'active' : 'paused',
    steps,
    createdById: s.createdById,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function createSequence(
  orgId: string,
  userId: string,
  data: { name: string; description?: string; steps?: SequenceStepInput[] },
): Promise<SequenceRecord> {
  if (!data.name?.trim()) throw new Error('name is required');
  const created = await prisma.automationSequence.create({
    data: {
      orgId,
      name: data.name.trim(),
      description: data.description ?? null,
      createdById: userId,
      enabled: false,
    },
  });
  if (data.steps && data.steps.length > 0) {
    await prisma.sequenceStep.createMany({
      data: data.steps.map((st, idx) => ({
        sequenceId: created.id,
        stepOrder: st.stepOrder ?? idx,
        blockId: st.blockId,
        delayMinutes: st.delayMinutes ?? 0,
        jitterMinutes: st.jitterMinutes ?? 0,
        exitCondition: st.exitCondition ?? undefined,
      })),
    });
  }
  return (await getSequence(orgId, created.id))!;
}

export async function updateSequence(
  orgId: string,
  id: string,
  data: { name?: string; description?: string; steps?: SequenceStepInput[]; status?: string },
): Promise<SequenceRecord> {
  const existing = await prisma.automationSequence.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error('Sequence not found');

  await prisma.automationSequence.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      enabled: data.status ? data.status === 'active' : existing.enabled,
    },
  });

  if (data.steps) {
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: id } });
    if (data.steps.length > 0) {
      await prisma.sequenceStep.createMany({
        data: data.steps.map((st, idx) => ({
          sequenceId: id,
          stepOrder: st.stepOrder ?? idx,
          blockId: st.blockId,
          delayMinutes: st.delayMinutes ?? 0,
          jitterMinutes: st.jitterMinutes ?? 0,
          exitCondition: st.exitCondition ?? undefined,
        })),
      });
    }
  }

  return (await getSequence(orgId, id))!;
}

export async function deleteSequence(orgId: string, id: string): Promise<void> {
  const existing = await prisma.automationSequence.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error('Sequence not found');
  await prisma.automationSequence.delete({ where: { id } });
}

export async function setSequenceStatus(orgId: string, id: string, status: 'active' | 'paused'): Promise<SequenceRecord> {
  const existing = await prisma.automationSequence.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error('Sequence not found');
  await prisma.automationSequence.update({ where: { id }, data: { enabled: status === 'active' } });
  return (await getSequence(orgId, id))!;
}

export async function enrollContact(
  orgId: string,
  sequenceId: string,
  contactId: string,
  oaAccountId: string,
): Promise<{ id: string }> {
  const steps = await prisma.sequenceStep.findMany({
    where: { sequenceId },
    orderBy: { stepOrder: 'asc' },
    take: 1,
  });
  const firstStep = steps[0];
  const nextStepAt = firstStep
    ? new Date(Date.now() + firstStep.delayMinutes * 60_000)
    : null;
  return prisma.sequenceMembership.create({
    data: {
      orgId,
      sequenceId,
      contactId,
      oaAccountId,
      currentStep: 0,
      nextStepAt,
      status: 'active',
    },
  });
}

export async function getSequenceHistory(orgId: string, sequenceId: string): Promise<unknown[]> {
  const memberships = await prisma.sequenceMembership.findMany({
    where: { orgId, sequenceId },
    orderBy: { enrolledAt: 'desc' },
    take: 200,
    include: { contact: { select: { fullName: true, phone: true } } },
  });
  return memberships.map((m) => ({
    id: m.id,
    contactName: m.contact.fullName,
    contactPhone: m.contact.phone,
    currentStep: m.currentStep,
    status: m.status,
    enrolledAt: m.enrolledAt,
    completedAt: m.completedAt,
    nextStepAt: m.nextStepAt,
  }));
}