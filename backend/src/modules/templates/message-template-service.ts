// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Huỳnh Ngọc Thuận
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';

export interface MessageTemplate {
  id: string;
  orgId: string;
  ownerUserId: string | null;
  folderId: string | null;
  visibility: 'public' | 'private';
  name: string;
  shortcut: string | null;
  content: string;
  contentRich: unknown | null;
  imageBase64: string | null;
  category: string | null;
  tagIds: string[];
  usageCount: number;
  lastUsedAt: string | null;
  manualSendCount: number;
  lastManualSentAt: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplateFolder {
  id: string;
  orgId: string;
  name: string;
  visibility: 'public' | 'private';
  parentId: string | null;
  ownerUserId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  children?: MessageTemplateFolder[];
  templateCount?: number;
}

/**
 * Normalize a raw Prisma row to the MessageTemplate/MessageTemplateFolder shape.
 * Prisma returns `visibility` as `string` (Postgres enum casts to text in raw queries);
 * we narrow it to the literal union so callers can rely on a strict type.
 */
function normalizeTemplate<T extends { visibility: string; contentRich?: unknown; lastUsedAt?: Date | null; lastManualSentAt?: Date | null; archivedAt?: Date | null; createdAt: Date; updatedAt: Date }>(row: T): MessageTemplate {
  return {
    ...(row as unknown as MessageTemplate),
    visibility: (row.visibility === 'public' ? 'public' : 'private') as 'public' | 'private',
  } as MessageTemplate;
}

function normalizeFolder<T extends { visibility: string; createdAt: Date; updatedAt: Date }>(row: T): MessageTemplateFolder {
  return {
    ...(row as unknown as MessageTemplateFolder),
    visibility: (row.visibility === 'public' ? 'public' : 'private') as 'public' | 'private',
  } as MessageTemplateFolder;
}

// List templates with optional folder filter
export async function listTemplates(orgId: string, folderId?: string | null, userId?: string): Promise<MessageTemplate[]> {
  const where: Record<string, unknown> = {
    orgId,
    archivedAt: null,
    OR: [
      { visibility: 'public' },
      { ownerUserId: userId ?? null },
    ],
  };

  if (folderId !== undefined) {
    where.folderId = folderId;
  }

  return prisma.messageTemplate.findMany({
    where,
    orderBy: { usageCount: 'desc' },
  }).then(rows => rows.map(normalizeTemplate));
}

// Get single template
export async function getTemplate(id: string, orgId: string): Promise<MessageTemplate | null> {
  const row = await prisma.messageTemplate.findFirst({
    where: { id, orgId, archivedAt: null },
  });
  return row ? normalizeTemplate(row) : null;
}

// Create template
export async function createTemplate(data: {
  orgId: string;
  ownerUserId?: string | null;
  folderId?: string | null;
  visibility?: 'public' | 'private';
  name: string;
  shortcut?: string | null;
  content: string;
  contentRich?: unknown | null;
  imageBase64?: string | null;
  category?: string | null;
  tagIds?: string[];
  createdById?: string;
}): Promise<MessageTemplate> {
  const row = await prisma.messageTemplate.create({
    data: {
      orgId: data.orgId,
      ownerUserId: data.ownerUserId ?? null,
      folderId: data.folderId ?? null,
      visibility: data.visibility ?? 'private',
      name: data.name,
      shortcut: data.shortcut?.toLowerCase().trim() || null,
      content: data.content,
      contentRich: (data.contentRich ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      imageBase64: data.imageBase64 ?? null,
      category: data.category ?? null,
      tagIds: data.tagIds ?? [],
      createdById: data.createdById ?? null,
    },
  });
  return normalizeTemplate(row);
}

// Update template
export async function updateTemplate(
  id: string,
  orgId: string,
  data: Partial<{
    name: string;
    shortcut: string | null;
    content: string;
    contentRich: unknown | null;
    imageBase64: string | null;
    category: string | null;
    tagIds: string[];
    folderId: string | null;
    visibility: 'public' | 'private';
    ownerUserId: string | null;
    archivedAt: Date | null;
    usageCount: number;
    lastUsedAt: Date | null;
    manualSendCount: number;
    lastManualSentAt: Date | null;
  }>,
): Promise<MessageTemplate | null> {
  const existing = await prisma.messageTemplate.findFirst({
    where: { id, orgId },
  });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.shortcut !== undefined) updateData.shortcut = data.shortcut?.toLowerCase().trim() || null;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.contentRich !== undefined) updateData.contentRich = data.contentRich;
  if (data.imageBase64 !== undefined) updateData.imageBase64 = data.imageBase64;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tagIds !== undefined) updateData.tagIds = data.tagIds;
  if (data.folderId !== undefined) updateData.folderId = data.folderId;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.ownerUserId !== undefined) updateData.ownerUserId = data.ownerUserId;
  if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
  if (data.usageCount !== undefined) updateData.usageCount = data.usageCount;
  if (data.lastUsedAt !== undefined) updateData.lastUsedAt = data.lastUsedAt;
  if (data.manualSendCount !== undefined) updateData.manualSendCount = data.manualSendCount;
  if (data.lastManualSentAt !== undefined) updateData.lastManualSentAt = data.lastManualSentAt;

  const row = await prisma.messageTemplate.update({
    where: { id },
    data: updateData,
  });
  return normalizeTemplate(row);
}

// Soft delete template
export async function deleteTemplate(id: string, orgId: string): Promise<boolean> {
  const existing = await prisma.messageTemplate.findFirst({
    where: { id, orgId },
  });
  if (!existing) return false;

  await prisma.messageTemplate.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  return true;
}

// Increment usage count
export async function incrementUsageCount(id: string, orgId: string): Promise<void> {
  await prisma.messageTemplate.updateMany({
    where: { id, orgId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

// Increment manual send count
export async function incrementManualSendCount(id: string, orgId: string): Promise<void> {
  await prisma.messageTemplate.updateMany({
    where: { id, orgId },
    data: {
      manualSendCount: { increment: 1 },
      lastManualSentAt: new Date(),
    },
  });
}

// ── Folder operations ───────────────────────────────────────────────────────

// List folders with template counts
export async function listFolders(orgId: string, userId?: string): Promise<MessageTemplateFolder[]> {
  const folders = await prisma.messageTemplateFolder.findMany({
    where: {
      orgId,
      OR: [
        { visibility: 'public' },
        { ownerUserId: userId ?? null },
      ],
    },
    orderBy: { name: 'asc' },
    include: {
      children: {
        where: {
          OR: [
            { visibility: 'public' },
            { ownerUserId: userId ?? null },
          ],
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  // Get template counts per folder
  const folderIds = folders.map(f => f.id);
  const childFolderIds = folders.flatMap(f => f.children?.map(c => c.id) ?? []);
  const allFolderIds = [...folderIds, ...childFolderIds];

  const templateCounts = await prisma.messageTemplate.groupBy({
    by: ['folderId'],
    where: {
      orgId,
      archivedAt: null,
      folderId: { in: allFolderIds },
      OR: [
        { visibility: 'public' },
        { ownerUserId: userId ?? null },
      ],
    },
    _count: { id: true },
  });

  const countMap = new Map(templateCounts.map(t => [t.folderId, t._count.id]));

  // Also count templates without folder (root level)
  const rootCount = await prisma.messageTemplate.count({
    where: {
      orgId,
      archivedAt: null,
      folderId: null,
      OR: [
        { visibility: 'public' },
        { ownerUserId: userId ?? null },
      ],
    },
  });

  return folders.map(folder => ({
    ...normalizeFolder(folder),
    templateCount: countMap.get(folder.id) ?? 0,
    children: folder.children?.map(child => ({
      ...normalizeFolder(child),
      templateCount: countMap.get(child.id) ?? 0,
    })),
  }));
}

// Create folder
export async function createFolder(data: {
  orgId: string;
  name: string;
  visibility?: 'public' | 'private';
  parentId?: string | null;
  ownerUserId?: string | null;
  createdById: string;
}): Promise<MessageTemplateFolder> {
  const row = await prisma.messageTemplateFolder.create({
    data: {
      orgId: data.orgId,
      name: data.name,
      visibility: data.visibility ?? 'public',
      parentId: data.parentId ?? null,
      ownerUserId: data.ownerUserId ?? null,
      createdById: data.createdById,
    },
  });
  return normalizeFolder(row);
}

// Update folder
export async function updateFolder(
  id: string,
  orgId: string,
  data: Partial<{
    name: string;
    visibility: 'public' | 'private';
    parentId: string | null;
    ownerUserId: string | null;
  }>,
): Promise<MessageTemplateFolder | null> {
  const existing = await prisma.messageTemplateFolder.findFirst({
    where: { id, orgId },
  });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.ownerUserId !== undefined) updateData.ownerUserId = data.ownerUserId;

  const row = await prisma.messageTemplateFolder.update({
    where: { id },
    data: updateData,
  });
  return normalizeFolder(row);
}

// Delete folder (templates become root-level)
export async function deleteFolder(id: string, orgId: string): Promise<boolean> {
  const existing = await prisma.messageTemplateFolder.findFirst({
    where: { id, orgId },
  });
  if (!existing) return false;

  // Move templates to root (folderId = null)
  await prisma.messageTemplate.updateMany({
    where: { folderId: id, orgId },
    data: { folderId: null },
  });

  // Move child folders to parent
  await prisma.messageTemplateFolder.updateMany({
    where: { parentId: id },
    data: { parentId: existing.parentId },
  });

  await prisma.messageTemplateFolder.delete({ where: { id } });
  return true;
}

// Search templates by shortcut, name, or content
export async function searchTemplates(
  orgId: string,
  query: string,
  userId?: string,
  limit = 20,
): Promise<MessageTemplate[]> {
  const q = query.toLowerCase().trim();
  if (!q) return listTemplates(orgId, null, userId);

  const rows = await prisma.messageTemplate.findMany({
    where: {
      orgId,
      archivedAt: null,
      OR: [
        { visibility: 'public' },
        { ownerUserId: userId ?? null },
      ],
      AND: [
        {
          OR: [
            { shortcut: { contains: q } },
            { name: { contains: q } },
            { content: { contains: q } },
          ],
        },
      ],
    },
    orderBy: [
      // Prioritize shortcut matches
      { usageCount: 'desc' },
    ],
    take: limit,
  });
  return rows.map(normalizeTemplate);
}

// Get variable placeholders from content
export function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

// Render template with variables replaced
export function renderTemplate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}
