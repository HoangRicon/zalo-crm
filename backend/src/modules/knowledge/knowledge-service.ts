// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Knowledge Base (RAG-lite) service — 2026-07-24.
 * Xem openspec/changes/add-knowledge-base-and-chat-drag/.
 *
 * Pipeline:
 *   createDoc() → chunkMarkdown(text) → embedBatch(texts) → persist KnowledgeDoc + chunks
 *   retrieveTopK() → embedBatch([query]) → cosine sim trên knowledge_chunks → top-K
 *
 * Lưu vector dạng JSONB (không cần pgvector extension); compute cosine in-process.
 * Đủ nhanh cho ≤10K chunks/org (~1ms / 1 query).
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { resolveProviderApiKey, getProviderBaseUrl } from '../ai/provider-registry.js';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;
const EMBED_BATCH_SIZE = 96;
// Đặt ngưỡng tin cậy tối thiểu: top-1 dưới ngưỡng này → coi như không có tài liệu liên quan,
// tránh AI hallucinate. 0.3 là con số thực nghiệm với text-embedding-3-small trên tiếng Việt.
export const MIN_RELEVANCE_SCORE = 0.3;
// Cap cứng cho 1 query — tránh load 50K chunks khi org scale.
const MAX_CHUNKS_PER_QUERY = 5000;

export type KnowledgeDocKind = 'markdown' | 'media_collection' | 'faq';

export type ChunkInput = {
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  tokenCount?: number;
};

export type ScoredChunk = {
  id: string;
  docId: string;
  docTitle: string;
  docTags: string[];
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  score: number;
  mediaAssetIds: string[];
};

/**
 * Chunk markdown text theo semantic boundary.
 * B1: tách theo heading level 1–3.
 * B2: nếu section > 800 chars → split theo paragraph (\n\n).
 * B3: nếu vẫn > 800 chars → split theo câu (. ! ?) giữ chunk ~500–800 chars.
 * B4: bỏ chunk < 50 chars (noise).
 * B5: trả về charStart/charEnd trong text gốc.
 */
export function chunkMarkdown(text: string): ChunkInput[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // B1: split theo heading boundary, giữ delimiter.
  const sections: { text: string; offset: number }[] = [];
  const headingRe = /^(#{1,3}\s+[^\n]+)$/gm;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(normalized)) !== null) {
    if (match.index > last) {
      sections.push({ text: normalized.slice(last, match.index), offset: last });
    }
    last = match.index;
  }
  if (last < normalized.length) sections.push({ text: normalized.slice(last), offset: last });

  // B2/B3: chia nhỏ từng section nếu quá dài.
  const MAX = 800;
  const MIN = 50;
  const out: { text: string; charStart: number; charEnd: number }[] = [];
  for (const section of sections) {
    const trimmed = section.text.trim();
    if (!trimmed) continue;
    if (trimmed.length <= MAX) {
      if (trimmed.length >= MIN) {
        out.push({ text: trimmed, charStart: section.offset + section.text.indexOf(trimmed), charEnd: section.offset + section.text.indexOf(trimmed) + trimmed.length });
      }
      continue;
    }
    // Quá dài → split theo paragraph trước.
    const paragraphs = trimmed.split(/\n\n+/);
    let cursor = section.offset + section.text.indexOf(trimmed);
    for (const paraRaw of paragraphs) {
      const para = paraRaw.trim();
      if (!para) continue;
      if (para.length <= MAX) {
        if (para.length >= MIN) out.push({ text: para, charStart: cursor + paraRaw.indexOf(para), charEnd: cursor + paraRaw.indexOf(para) + para.length });
        cursor += paraRaw.length + 2;
        continue;
      }
      // Vẫn quá dài → split theo câu.
      const sentenceRe = /[^.!?\n]+[.!?]?(\s|$)/g;
      let sLast = 0;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = sentenceRe.exec(para)) !== null) {
        const sentence = sMatch[0].trim();
        if (sentence.length >= MIN) {
          out.push({ text: sentence, charStart: cursor + sMatch.index, charEnd: cursor + sMatch.index + sentence.length });
        }
        sLast = sMatch.index + sMatch[0].length;
      }
      if (sLast < para.length) {
        const tail = para.slice(sLast).trim();
        if (tail.length >= MIN) out.push({ text: tail, charStart: cursor + sLast, charEnd: cursor + para.length });
      }
      cursor += paraRaw.length + 2;
    }
  }

  // Gán ordinal 0..N + ước lượng tokenCount ~4 chars/token cho mixed VI/EN
  const withOrdinal: ChunkInput[] = [];
  out.forEach((c, i) => {
    withOrdinal.push({
      ordinal: i,
      text: c.text,
      charStart: c.charStart,
      charEnd: c.charEnd,
      tokenCount: Math.ceil(c.text.length / 4),
    });
  });
  return withOrdinal;
}

/**
 * Gọi OpenAI-compatible embedding endpoint.
 * Provider: 'openai' (mặc định) hoặc 'custom' (OpenAI-compatible, vd vLLM/Ollama/internal proxy).
 * Throw nếu provider không support embedding (anthropic/gemini/qwen/kimi) — FE phải cấu hình
 * embeddingProvider = 'openai' hoặc 'custom' trước.
 */
export async function embedBatch(texts: string[], providerOverride?: string): Promise<number[][]> {
  if (!texts.length) return [];
  const provider = providerOverride || 'openai';
  const apiKey = await resolveProviderApiKey('__global__', provider).catch(() => '');
  // resolveProviderApiKey yêu cầu orgId — gọi với '__global__' cho fallback env;
  // thực tế sẽ truyền orgId thật khi gọi từ caller. Để tương thích, helper bên dưới sẽ
  // override với orgId của caller.
  if (!apiKey) throw new Error(`No API key configured for embedding provider '${provider}'. Set AI key in Settings.`);
  const baseUrl = await getProviderBaseUrl('__global__', provider).catch(() => '');
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/embeddings`;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: batch, model: EMBEDDING_MODEL, encoding_format: 'float' }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding API ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
    // OpenAI trả data.unsorted (theo index) — sắp xếp lại.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) {
      if (!Array.isArray(d.embedding) || d.embedding.length !== EMBEDDING_DIM) {
        throw new Error(`Bad embedding dim: got ${d.embedding?.length}, expected ${EMBEDDING_DIM}`);
      }
      all.push(d.embedding);
    }
  }
  return all;
}

/** Helper: resolve API key theo orgId thật (an toàn hơn '__global__'). */
async function resolveEmbedder(orgId: string, provider: string) {
  const apiKey = await resolveProviderApiKey(orgId, provider);
  if (apiKey) {
    const baseUrl = await getProviderBaseUrl(orgId, provider);
    return { apiKey, baseUrl: baseUrl.replace(/\/+$/, '') };
  }
  // 2026-07-26: fallback nếu provider user chọn chưa có key — thử 'custom' (nhiều org
  // dùng Custom Endpoint cho cả chat lẫn embedding, ví dụ self-hosted OpenAI-compat proxy).
  // Không fallback cho openai (anthropic/gemini/qwen/kimi đã chặn ở caller).
  if (provider === 'openai') {
    const customKey = await resolveProviderApiKey(orgId, 'custom').catch(() => '');
    if (customKey) {
      const customUrl = await getProviderBaseUrl(orgId, 'custom');
      logger.info('[embed] openai no key → fallback to custom (org=%s)', orgId);
      return { apiKey: customKey, baseUrl: customUrl.replace(/\/+$/, '') };
    }
  }
  throw new Error(`No API key for embedding provider '${provider}' (org ${orgId}). Configure in AI Settings.`);
}

/** Embed với provider theo org + AiConfig.aiTaskConfig.embeddingProvider. */
export async function embedForOrg(orgId: string, texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const cfg = await prisma.aiConfig.findUnique({ where: { orgId } });
  const provider = (cfg?.aiTaskConfig as { embeddingProvider?: string } | null)?.embeddingProvider || 'openai';
  if (provider !== 'openai' && provider !== 'custom') {
    throw new Error(`Embedding provider '${provider}' không hỗ trợ. Set embeddingProvider = 'openai' hoặc 'custom' trong AI Settings.`);
  }
  const { apiKey, baseUrl } = await resolveEmbedder(orgId, provider);
  const url = `${baseUrl}/v1/embeddings`;
  // 2026-07-26: cảnh báo URL chứa 'localhost' — khi app chạy trong Docker container,
  // 'localhost' trỏ về container nó chứ không phải host. Cần dùng 'host.docker.internal'
  // (Docker Desktop) hoặc IP host. Phát hiện ở đây để báo user trước khi fetch fail.
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl)) {
    logger.warn('[embed] baseUrl chứa localhost/loopback (%s) — nếu app chạy trong Docker, đổi sang host.docker.internal hoặc IP host', baseUrl);
  }
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: batch, model: EMBEDDING_MODEL, encoding_format: 'float' }),
        // 2026-07-26: timeout 30s cho fetch (Node default không có).
        signal: AbortSignal.timeout(30_000),
      });
    } catch (netErr) {
      // 2026-07-26: phân loại lỗi mạng để user biết phải làm gì.
      const msg = (netErr as Error).message || 'fetch failed';
      const cause = (netErr as any)?.cause?.code || '';
      const isContainer = process.env.NODE_ENV === 'production' || process.env.DOCKER === '1';
      const isLocalhost = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);
      if (cause === 'ECONNREFUSED' && isContainer && isLocalhost) {
        throw new Error(`Không kết nối được embedding endpoint tại ${baseUrl}. App đang chạy trong Docker — 'localhost' trỏ về container. Đổi sang 'host.docker.internal' hoặc IP host.`);
      }
      if (cause === 'ECONNREFUSED') {
        throw new Error(`Connection refused tới ${url}. Kiểm tra custom endpoint có đang chạy và baseUrl đúng.`);
      }
      if (cause === 'ENOTFOUND') {
        throw new Error(`Không resolve được host trong ${url}. Kiểm tra baseUrl.`);
      }
      throw new Error(`Lỗi mạng khi gọi embedding endpoint: ${msg}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding API ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) {
      if (!Array.isArray(d.embedding) || d.embedding.length !== EMBEDDING_DIM) {
        throw new Error(`Bad embedding dim: got ${d.embedding?.length ?? '?'}, expected ${EMBEDDING_DIM}`);
      }
      all.push(d.embedding);
    }
  }
  return all;
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Retrieve top-K chunks của org theo cosine similarity với query.
 * Trả về `ScoredChunk[]` (đã hydrate doc metadata) hoặc [] nếu:
 *   - org chưa có doc nào có embedding
 *   - top-1 score < MIN_RELEVANCE_SCORE
 */
export async function retrieveTopK(orgId: string, query: string, k: number): Promise<ScoredChunk[]> {
  const safeK = Math.max(1, Math.min(8, k));
  const [qVec] = await embedForOrg(orgId, [query]);
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { doc: { orgId, isActive: true, deletedAt: null } },
    select: {
      id: true,
      docId: true,
      ordinal: true,
      text: true,
      charStart: true,
      charEnd: true,
      embedding: true,
      doc: { select: { title: true, tags: true, mediaAssetIds: true } },
    },
    take: MAX_CHUNKS_PER_QUERY,
  });
  if (chunks.length >= MAX_CHUNKS_PER_QUERY) {
    logger.warn(`[kb] org=${orgId} có ≥${MAX_CHUNKS_PER_QUERY} chunks — consider nâng cap hoặc filter theo tag`);
  }
  const scored: ScoredChunk[] = [];
  for (const c of chunks) {
    if (!Array.isArray(c.embedding) || c.embedding.length !== EMBEDDING_DIM) continue;
    const score = cosineSim(qVec, c.embedding as unknown as number[]);
    scored.push({
      id: c.id,
      docId: c.docId,
      docTitle: c.doc.title,
      docTags: c.doc.tags,
      ordinal: c.ordinal,
      text: c.text,
      charStart: c.charStart,
      charEnd: c.charEnd,
      score,
      mediaAssetIds: c.doc.mediaAssetIds,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, safeK);
  if (top.length === 0 || top[0].score < MIN_RELEVANCE_SCORE) return [];
  return top;
}

/**
 * Format top-K chunks thành block XML để inject vào AI prompt.
 * Caller ghép vào userPrompt hoặc systemPrompt.
 */
export function formatKbContextBlock(top: ScoredChunk[]): string {
  if (top.length === 0) return '';
  const lines: string[] = ['<knowledge_base>'];
  top.forEach((c, i) => {
    lines.push(`[${i + 1}] (from "${c.docTitle}", score=${c.score.toFixed(2)}):\n${c.text}`);
    if (c.mediaAssetIds.length) {
      lines.push(`[Related images: mediaAssetIds=${c.mediaAssetIds.join(', ')}]`);
    }
    lines.push('');
  });
  lines.push('</knowledge_base>');
  return lines.join('\n');
}
