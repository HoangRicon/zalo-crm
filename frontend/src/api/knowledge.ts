// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * knowledge.ts — API client cho Knowledge Base (RAG-lite cho AI Assistant).
 * 2026-07-24 — xem openspec/changes/add-knowledge-base-and-chat-drag/.
 */
import { api } from './index';

export type KnowledgeDocKind = 'markdown' | 'media_collection' | 'faq';

export interface KnowledgeDocListItem {
  id: string;
  title: string;
  kind: KnowledgeDocKind;
  sourceUrl: string | null;
  mediaAssetIds: string[];
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { chunks: number };
}

export interface KnowledgeChunk {
  id: string;
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  tokenCount: number | null;
}

export interface KnowledgeDocDetail extends Omit<KnowledgeDocListItem, '_count'> {
  chunks: KnowledgeChunk[];
  chunkCount: number;
}

export interface CreateKbDocInput {
  title: string;
  kind?: KnowledgeDocKind;
  text?: string;
  mediaAssetIds?: string[];
  tags?: string[];
  sourceUrl?: string;
  faq?: { question: string; answer: string };
}

export interface KbQaSource {
  docId: string;
  docTitle: string;
  ordinal: number;
  score: number;
  textSnippet: string;
}

export interface KbQaResponse {
  answer: string;
  sources: KbQaSource[];
  images: string[];
  source: 'ai' | 'no_match';
}

export async function listKbDocs(params: { search?: string; tags?: string; kind?: KnowledgeDocKind; limit?: number; offset?: number; includeInactive?: boolean } = {}): Promise<{ items: KnowledgeDocListItem[]; total: number; limit: number; offset: number }> {
  const { data } = await api.get('/knowledge/docs', { params });
  return data;
}

export async function getKbDoc(id: string): Promise<KnowledgeDocDetail> {
  const { data } = await api.get(`/knowledge/docs/${id}`);
  return data;
}

export async function createKbDoc(input: CreateKbDocInput): Promise<{ ok: boolean; id: string; chunks: number; partial?: boolean; warning?: string }> {
  const { data } = await api.post('/knowledge/docs', input);
  return data;
}

export async function updateKbDoc(id: string, patch: Partial<CreateKbDocInput> & { isActive?: boolean }): Promise<{ ok: boolean; chunks: number; reembedded?: boolean; partial?: boolean; warning?: string }> {
  const { data } = await api.patch(`/knowledge/docs/${id}`, patch);
  return data;
}

export async function deleteKbDoc(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/knowledge/docs/${id}`);
  return data;
}

export async function reembedKbDoc(id: string): Promise<{ ok: boolean; chunks: number }> {
  const { data } = await api.post(`/knowledge/docs/${id}/reembed`);
  return data;
}

export async function kbQa(question: string): Promise<KbQaResponse> {
  try {
    const { data } = await api.post('/knowledge/qa', { question });
    return data;
  } catch (err: any) {
    // 2026-07-26: propagate BE error code để FE show action phù hợp (mở AI Settings, ...).
    const body = err?.response?.data;
    const code = body?.code as string | undefined;
    if (code) err.code = code;
    throw err;
  }
}
