// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Huỳnh Ngọc Thuận
import { api } from './index';

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

export interface CreateTemplateData {
  name: string;
  shortcut?: string;
  content: string;
  contentRich?: unknown;
  category?: string;
  tagIds?: string[];
  folderId?: string | null;
  visibility?: 'public' | 'private';
  imageBase64?: string;
}

export interface UpdateTemplateData {
  name?: string;
  shortcut?: string | null;
  content?: string;
  contentRich?: unknown | null;
  category?: string | null;
  tagIds?: string[];
  folderId?: string | null;
  visibility?: 'public' | 'private';
  imageBase64?: string | null;
}

export interface CreateFolderData {
  name: string;
  visibility?: 'public' | 'private';
  parentId?: string | null;
}

export interface UpdateFolderData {
  name?: string;
  visibility?: 'public' | 'private';
  parentId?: string | null;
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(folderId?: string | null): Promise<MessageTemplate[]> {
  const params: Record<string, string> = {};
  if (folderId !== undefined && folderId !== null) {
    params.folderId = folderId;
  }
  const { data } = await api.get('/message-templates', { params });
  return data.templates;
}

export async function searchTemplates(query: string): Promise<MessageTemplate[]> {
  const { data } = await api.get('/message-templates', { params: { q: query } });
  return data.templates;
}

export async function getTemplate(id: string): Promise<MessageTemplate> {
  const { data } = await api.get(`/message-templates/${id}`);
  return data.template;
}

export async function createTemplate(payload: CreateTemplateData): Promise<MessageTemplate> {
  const { data } = await api.post('/message-templates', payload);
  return data.template;
}

export async function updateTemplate(id: string, payload: UpdateTemplateData): Promise<MessageTemplate> {
  const { data } = await api.put(`/message-templates/${id}`, payload);
  return data.template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/message-templates/${id}`);
}

export async function incrementTemplateUsage(id: string): Promise<void> {
  await api.post(`/message-templates/${id}/increment-usage`);
}

export async function incrementTemplateManualSend(id: string): Promise<void> {
  await api.post(`/message-templates/${id}/increment-manual-send`);
}

// ── Folders ──────────────────────────────────────────────────────────────────

export interface FolderListResponse {
  folders: MessageTemplateFolder[];
  rootTemplateCount: number;
}

export async function getFolders(): Promise<FolderListResponse> {
  const { data } = await api.get('/message-template-folders');
  return data;
}

export async function createFolder(payload: CreateFolderData): Promise<MessageTemplateFolder> {
  const { data } = await api.post('/message-template-folders', payload);
  return data.folder;
}

export async function updateFolder(id: string, payload: UpdateFolderData): Promise<MessageTemplateFolder> {
  const { data } = await api.put(`/message-template-folders/${id}`, payload);
  return data.folder;
}

export async function deleteFolder(id: string): Promise<void> {
  await api.delete(`/message-template-folders/${id}`);
}

// ── AI Generate (2026-07-22) ────────────────────────────────────────────────
export interface AiGenerateTemplateRequest {
  description: string;
  category?: string;
}

export interface AiGenerateTemplateResponse {
  content: string;
  suggestedName: string;
}

export async function generateTemplateWithAi(
  payload: AiGenerateTemplateRequest,
): Promise<AiGenerateTemplateResponse> {
  const { data } = await api.post('/message-templates/ai-generate', payload);
  return data;
}

// ── Schedule Send (2026-07-22) ───────────────────────────────────────────────
export interface ScheduleSendRequest {
  templateId: string;
  oaAccountId: string;
  contactIds: string[];
  scheduledAt: string; // ISO8601
}

export interface ScheduledSend {
  id: string;
  templateId: string;
  oaAccountId: string;
  contactIds: string[];
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function scheduleTemplateSend(payload: ScheduleSendRequest): Promise<ScheduledSend> {
  const { data } = await api.post('/templates/schedule-send', payload);
  return data;
}

export async function listScheduledSends(): Promise<ScheduledSend[]> {
  const { data } = await api.get('/templates/schedule-send');
  return Array.isArray(data) ? data : (data.sends || []);
}
