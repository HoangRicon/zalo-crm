// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Knowledge Base routes — 2026-07-24.
 * Xem openspec/changes/add-knowledge-base-and-chat-drag/.
 *
 * Endpoints:
 *   POST   /api/v1/knowledge/docs                create + auto chunk + embed
 *   GET    /api/v1/knowledge/docs                list + filter (search/tags)
 *   GET    /api/v1/knowledge/docs/:id            read + chunks
 *   PATCH  /api/v1/knowledge/docs/:id            update (re-embed nếu content đổi)
 *   DELETE /api/v1/knowledge/docs/:id            soft-delete
 *   POST   /api/v1/knowledge/docs/:id/reembed    force re-embed toàn bộ chunks
 *   POST   /api/v1/knowledge/qa                  Q&A trực tiếp từ KB
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import {
  chunkMarkdown,
  embedForOrg,
  retrieveTopK,
  type KnowledgeDocKind,
} from './knowledge-service.js';
import { getAiConfig, getProviderApiKey, generateText, getAiUsage } from '../ai/ai-service.js';

type CreateDocBody = {
  title?: string;
  kind?: KnowledgeDocKind;
  text?: string;
  mediaAssetIds?: string[];
  tags?: string[];
  sourceUrl?: string;
  faq?: { question: string; answer: string };
};

type UpdateDocBody = Partial<Pick<CreateDocBody, 'title' | 'text' | 'mediaAssetIds' | 'tags' | 'sourceUrl' | 'faq'>> & {
  isActive?: boolean;
};

type ListQuery = {
  search?: string;
  tags?: string;       // comma-separated
  limit?: string;
  offset?: string;
  kind?: KnowledgeDocKind;
  includeInactive?: string;
};

type QaBody = { question?: string };

function trimText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

async function embedAndPersistDoc(docId: string, orgId: string, text: string) {
  // 1. Chunk
  const chunks = chunkMarkdown(text);
  if (chunks.length === 0) return { chunks: 0, message: 'empty document' };
  // 2. Embed
  const embeddings = await embedForOrg(orgId, chunks.map((c) => c.text));
  // 3. Delete existing chunks
  await prisma.knowledgeChunk.deleteMany({ where: { docId } });
  // 4. Insert new chunks (createMany không hỗ trợ Json? trong 1 số version → dùng loop)
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const emb = embeddings[i];
    if (!c || !emb) continue;
    await prisma.knowledgeChunk.create({
      data: {
        docId,
        ordinal: c.ordinal,
        text: c.text,
        embedding: emb as unknown as object,
        tokenCount: c.tokenCount ?? null,
        charStart: c.charStart,
        charEnd: c.charEnd,
      },
    });
  }
  return { chunks: chunks.length };
}

export async function knowledgeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  /* ──────────────── POST /knowledge/docs ──────────────── */
  app.post('/api/v1/knowledge/docs', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const userId = request.user!.id;
      const body = (request.body ?? {}) as CreateDocBody;
      const title = trimText(body.title || '', 200);
      if (!title) return reply.status(400).send({ error: 'title is required' });
      const kind: KnowledgeDocKind = body.kind || (body.faq ? 'faq' : body.mediaAssetIds?.length ? 'media_collection' : 'markdown');
      if (!['markdown', 'media_collection', 'faq'].includes(kind)) {
        return reply.status(400).send({ error: 'kind không hợp lệ' });
      }
      const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string').slice(0, 30).map((t) => t.trim().slice(0, 50)).filter(Boolean) : [];
      const mediaAssetIds = Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds.filter((t) => typeof t === 'string').slice(0, 200) : [];

      let text = '';
      if (kind === 'faq') {
        if (!body.faq?.question?.trim() || !body.faq?.answer?.trim()) {
          return reply.status(400).send({ error: 'FAQ cần question + answer' });
        }
        text = `## Câu hỏi: ${body.faq.question.trim()}\n\n${body.faq.answer.trim()}`;
      } else if (kind === 'markdown') {
        text = body.text || '';
        if (!text.trim()) return reply.status(400).send({ error: 'text is required cho markdown doc' });
        if (text.length > 200_000) return reply.status(400).send({ error: 'text quá dài (tối đa 200KB)' });
      } else {
        // media_collection: nội dung chính là caption chung + URL refs
        if (!mediaAssetIds.length && !body.text?.trim()) {
          return reply.status(400).send({ error: 'media_collection cần mediaAssetIds hoặc text caption' });
        }
        text = body.text || `Bộ sưu tập gồm ${mediaAssetIds.length} ảnh liên quan đến "${title}".`;
      }

      const doc = await prisma.knowledgeDoc.create({
        data: {
          orgId,
          title,
          kind,
          sourceUrl: body.sourceUrl?.trim() || null,
          mediaAssetIds,
          tags,
          createdById: userId,
        },
      });

      // Embed + persist chunks (background để response nhanh; nhưng MVP chạy sync để đơn giản)
      try {
        const result = await embedAndPersistDoc(doc.id, orgId, text);
        return { ok: true, id: doc.id, chunks: result.chunks };
      } catch (embedErr) {
        logger.error('[kb] Embed fail doc=%s: %s', doc.id, (embedErr as Error).message);
        // Doc đã lưu nhưng chưa embed → trả về id + warning để UI cho retry reembed
        return reply.status(207).send({
          ok: true,
          partial: true,
          id: doc.id,
          warning: 'Doc đã tạo nhưng embed fail. Bấm "Re-embed" để thử lại.',
        });
      }
    } catch (err) {
      logger.error('[kb] Create doc error:', err);
      return reply.status(500).send({ error: 'Failed to create doc' });
    }
  });

  /* ──────────────── GET /knowledge/docs ──────────────── */
  app.get('/api/v1/knowledge/docs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const q = request.query as ListQuery;
      const limit = Math.min(100, Math.max(1, parseInt(q.limit || '20', 10)));
      const offset = Math.max(0, parseInt(q.offset || '0', 10));
      const includeInactive = q.includeInactive === 'true';
      const where: any = { orgId, deletedAt: null };
      if (!includeInactive) where.isActive = true;
      if (q.search?.trim()) {
        where.title = { contains: q.search.trim(), mode: 'insensitive' };
      }
      if (q.tags?.trim()) {
        const tagArr = q.tags.split(',').map((t) => t.trim()).filter(Boolean);
        if (tagArr.length) where.tags = { hasEvery: tagArr };
      }
      if (q.kind) where.kind = q.kind;

      const [docs, total] = await Promise.all([
        prisma.knowledgeDoc.findMany({
          where,
          select: {
            id: true, title: true, kind: true, sourceUrl: true, mediaAssetIds: true,
            tags: true, isActive: true, createdAt: true, updatedAt: true,
            _count: { select: { chunks: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.knowledgeDoc.count({ where }),
      ]);
      return { items: docs, total, limit, offset };
    } catch (err) {
      logger.error('[kb] List docs error:', err);
      return reply.status(500).send({ error: 'Failed to list docs' });
    }
  });

  /* ──────────────── GET /knowledge/docs/:id ──────────────── */
  app.get('/api/v1/knowledge/docs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const { id } = request.params as { id: string };
      const doc = await prisma.knowledgeDoc.findFirst({
        where: { id, orgId, deletedAt: null },
        include: {
          chunks: {
            orderBy: { ordinal: 'asc' },
            select: { id: true, ordinal: true, text: true, charStart: true, charEnd: true, tokenCount: true },
          },
        },
      });
      if (!doc) return reply.status(404).send({ error: 'Doc not found' });
      // Strip embedding khỏi response (chỉ trả text + metadata)
      return {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        sourceUrl: doc.sourceUrl,
        mediaAssetIds: doc.mediaAssetIds,
        tags: doc.tags,
        isActive: doc.isActive,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        chunks: doc.chunks,
        chunkCount: doc.chunks.length,
      };
    } catch (err) {
      logger.error('[kb] Read doc error:', err);
      return reply.status(500).send({ error: 'Failed to read doc' });
    }
  });

  /* ──────────────── PATCH /knowledge/docs/:id ──────────────── */
  app.patch('/api/v1/knowledge/docs/:id', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as UpdateDocBody;

      const existing = await prisma.knowledgeDoc.findFirst({ where: { id, orgId, deletedAt: null }, include: { chunks: { orderBy: { ordinal: 'asc' } } } });
      if (!existing) return reply.status(404).send({ error: 'Doc not found' });

      const data: any = {};
      if (typeof body.title === 'string') data.title = trimText(body.title, 200) || existing.title;
      if (Array.isArray(body.tags)) data.tags = body.tags.slice(0, 30).map((t) => String(t).trim().slice(0, 50)).filter(Boolean);
      if (Array.isArray(body.mediaAssetIds)) data.mediaAssetIds = body.mediaAssetIds.slice(0, 200);
      if (typeof body.sourceUrl === 'string') data.sourceUrl = body.sourceUrl.trim() || null;
      if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

      // Nếu content đổi → rebuild chunks
      const contentChanged =
        existing.kind === 'faq'
          ? (body.faq?.question !== undefined || body.faq?.answer !== undefined)
          : (typeof body.text === 'string' && body.text.trim().length > 0) ||
            (Array.isArray(body.mediaAssetIds) && JSON.stringify(body.mediaAssetIds) !== JSON.stringify(existing.mediaAssetIds));

      await prisma.knowledgeDoc.update({ where: { id }, data });

      if (contentChanged) {
        let text = '';
        if (existing.kind === 'faq') {
          if (!body.faq?.question?.trim() || !body.faq?.answer?.trim()) {
            return reply.status(400).send({ error: 'FAQ cần question + answer' });
          }
          text = `## Câu hỏi: ${body.faq.question.trim()}\n\n${body.faq.answer.trim()}`;
        } else {
          text = body.text && body.text.trim().length > 0
            ? body.text
            : `Bộ sưu tập gồm ${(body.mediaAssetIds || existing.mediaAssetIds).length} ảnh liên quan đến "${data.title || existing.title}".`;
        }
        if (text.length > 200_000) return reply.status(400).send({ error: 'text quá dài' });
        try {
          const result = await embedAndPersistDoc(id, orgId, text);
          return { ok: true, chunks: result.chunks, reembedded: true };
        } catch (embedErr) {
          return reply.status(207).send({ ok: true, partial: true, warning: 'Update OK nhưng re-embed fail', error: (embedErr as Error).message });
        }
      }
      return { ok: true, chunks: existing.chunks.length, reembedded: false };
    } catch (err) {
      logger.error('[kb] Update doc error:', err);
      return reply.status(500).send({ error: 'Failed to update doc' });
    }
  });

  /* ──────────────── DELETE /knowledge/docs/:id (soft) ──────────────── */
  app.delete('/api/v1/knowledge/docs/:id', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const { id } = request.params as { id: string };
      const existing = await prisma.knowledgeDoc.findFirst({ where: { id, orgId, deletedAt: null }, select: { id: true } });
      if (!existing) return reply.status(404).send({ error: 'Doc not found' });
      await prisma.knowledgeDoc.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { ok: true };
    } catch (err) {
      logger.error('[kb] Delete doc error:', err);
      return reply.status(500).send({ error: 'Failed to delete doc' });
    }
  });

  /* ──────────────── POST /knowledge/docs/:id/reembed ──────────────── */
  app.post('/api/v1/knowledge/docs/:id/reembed', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const { id } = request.params as { id: string };
      const doc = await prisma.knowledgeDoc.findFirst({
        where: { id, orgId, deletedAt: null },
        include: { chunks: { orderBy: { ordinal: 'asc' }, select: { text: true } } },
      });
      if (!doc) return reply.status(404).send({ error: 'Doc not found' });
      if (!doc.chunks.length) return reply.status(400).send({ error: 'Doc rỗng — không có chunk để re-embed' });

      const texts = doc.chunks.map((c) => c.text);
      const embeddings = await embedForOrg(orgId, texts);
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunkId = (await prisma.knowledgeChunk.findFirst({ where: { docId: id, ordinal: i }, select: { id: true } }))?.id;
        if (!chunkId) continue;
        await prisma.knowledgeChunk.update({
          where: { id: chunkId },
          data: { embedding: embeddings[i] as unknown as object },
        });
      }
      return { ok: true, chunks: doc.chunks.length };
    } catch (err) {
      logger.error('[kb] Reembed error:', err);
      return reply.status(500).send({ error: (err as Error).message || 'Re-embed failed' });
    }
  });

  /* ──────────────── POST /knowledge/qa ──────────────── */
  app.post('/api/v1/knowledge/qa', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = request.user!.orgId;
      const userId = request.user!.id;
      const body = (request.body ?? {}) as QaBody;
      const question = (body.question || '').trim();
      if (!question) return reply.status(400).send({ error: 'question is required' });
      if (question.length > 1000) return reply.status(400).send({ error: 'question quá dài (tối đa 1000 ký tự)' });

      const cfg = await getAiConfig(orgId);
      if (!cfg.enabled) return reply.status(400).send({ error: 'AI đang bị tắt' });

      // Quota check
      const usage = await getAiUsage(orgId);
      if (usage.remaining <= 0) return reply.status(429).send({ error: 'AI đã hết quota hôm nay' });

      let chunks: Awaited<ReturnType<typeof retrieveTopK>>;
      try {
        chunks = await retrieveTopK(orgId, question, 6);
      } catch (embedErr) {
        logger.warn('[kb-qa] retrieveTopK fail: %s', (embedErr as Error).message);
        return reply.status(400).send({ error: (embedErr as Error).message || 'Không retrieve được KB' });
      }

      if (chunks.length === 0) {
        return reply.send({
          answer: 'Không tìm thấy thông tin liên quan trong kho tri thức. Hãy bổ sung tài liệu hoặc thử diễn đạt khác.',
          sources: [],
          images: [],
          source: 'no_match',
        });
      }

      const apiKey = await getProviderApiKey(orgId, cfg.provider);
      if (!apiKey) return reply.status(400).send({ error: 'Chưa cấu hình API key' });
      const { getProviderBaseUrl } = await import('../ai/provider-registry.js');
      const baseUrl = await getProviderBaseUrl(orgId, cfg.provider);

      const system = [
        'Bạn là trợ lý tra cứu kho tri thức cho nhân viên CRM.',
        'Nhiệm vụ: trả lời câu hỏi của nhân viên dựa trên <documents> bên dưới.',
        'Quy tắc:',
        '1. Trả lời bằng TIẾNG VIỆT, ngắn gọn, chính xác.',
        '2. Trích dẫn nguồn theo format [1], [2]... tương ứng số thứ tự chunk trong <documents>.',
        '3. Nếu tài liệu không đủ thông tin để trả lời, nói rõ "Tài liệu hiện không có thông tin này" — KHÔNG bịa.',
        '4. Có thể dùng nhiều nguồn để tổng hợp nếu cần.',
      ].join('\n');

      const user = [
        '<question>',
        question,
        '</question>',
        '',
        '<documents>',
        chunks.map((c, i) => `[${i + 1}] (${c.docTitle}, score=${c.score.toFixed(2)}):\n${c.text}`).join('\n\n'),
        '</documents>',
      ].join('\n');

      const raw = await generateText(cfg.provider, apiKey, cfg.model, system, user, 800, baseUrl);

      // Track quota
      await prisma.aiSuggestion.create({
        data: {
          orgId,
          conversationId: null,
          type: 'reply_draft',
          content: JSON.stringify({ kind: 'kb_qa', question: question.slice(0, 200), sources: chunks.length }),
          confidence: Math.min(0.95, chunks[0].score),
        },
      }).catch(() => {});

      return {
        answer: raw.trim(),
        sources: chunks.map((c) => ({
          docId: c.docId,
          docTitle: c.docTitle,
          ordinal: c.ordinal,
          score: c.score,
          textSnippet: c.text.length > 200 ? `${c.text.slice(0, 200)}…` : c.text,
        })),
        images: chunks.flatMap((c) => c.mediaAssetIds),
        source: 'ai',
      };
    } catch (err) {
      logger.error('[kb] QA error:', err);
      return reply.status(500).send({ error: 'Q&A failed' });
    }
  });
}
