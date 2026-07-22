// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Huỳnh Ngọc Thuận
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  incrementUsageCount,
  incrementManualSendCount,
  searchTemplates,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from './message-template-service.js';
import { generateWithOpenaiCompat } from '../ai/providers/openai-compat.js';
import { resolveProviderApiKey, getProviderBaseUrl } from '../ai/provider-registry.js';

interface TemplateBody {
  name?: string;
  shortcut?: string | null;
  content?: string;
  contentRich?: unknown | null;
  category?: string | null;
  tagIds?: string[];
  folderId?: string | null;
  visibility?: 'public' | 'private';
}

interface FolderBody {
  name?: string;
  visibility?: 'public' | 'private';
  parentId?: string | null;
}

export async function messageTemplateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // ── Templates CRUD ──────────────────────────────────────────────────────────

  // GET /api/v1/message-templates — list all templates
  app.get('/api/v1/message-templates', async (request) => {
    const user = request.user!;
    const { folderId, q } = request.query as { folderId?: string; q?: string };

    if (q) {
      const templates = await searchTemplates(user.orgId, q, user.id);
      return { templates };
    }

    const templates = await listTemplates(user.orgId, folderId ?? undefined, user.id);
    return { templates };
  });

  // POST /api/v1/message-templates — create template
  app.post<{ Body: TemplateBody }>('/api/v1/message-templates', async (request, reply) => {
    const user = request.user!;
    const body = request.body ?? {};

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'name_required' });
    }
    if (!body.content?.trim()) {
      return reply.status(400).send({ error: 'content_required' });
    }

    // Validate folder if provided
    if (body.folderId) {
      const folder = await import('../../modules/templates/message-template-service.js')
        .then(m => m.listFolders(user.orgId, user.id));
      const folderExists = folder.some(f => f.id === body.folderId);
      if (!folderExists) {
        return reply.status(400).send({ error: 'folder_not_found' });
      }
    }

    const template = await createTemplate({
      orgId: user.orgId,
      ownerUserId: body.visibility === 'private' ? user.id : null,
      folderId: body.folderId ?? null,
      visibility: body.visibility ?? 'private',
      name: body.name.trim(),
      shortcut: body.shortcut ?? null,
      content: body.content,
      contentRich: body.contentRich ?? null,
      category: body.category ?? null,
      tagIds: body.tagIds ?? [],
      createdById: user.id,
    });

    logger.info(`[message-template] created id=${template.id} by=${user.id}`);
    return reply.status(201).send({ template });
  });

  // GET /api/v1/message-templates/:id — get single template
  app.get<{ Params: { id: string } }>('/api/v1/message-templates/:id', async (request, reply) => {
    const user = request.user!;
    const template = await getTemplate(request.params.id, user.orgId);

    if (!template) {
      return reply.status(404).send({ error: 'not_found' });
    }

    // Check visibility
    if (template.visibility === 'private' && template.ownerUserId !== user.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }

    return { template };
  });

  // PUT /api/v1/message-templates/:id — update template
  app.put<{ Params: { id: string }; Body: TemplateBody }>(
    '/api/v1/message-templates/:id',
    async (request, reply) => {
      const user = request.user!;
      const existing = await getTemplate(request.params.id, user.orgId);

      if (!existing) {
        return reply.status(404).send({ error: 'not_found' });
      }

      // Only owner or admin can update
      if (existing.visibility === 'private' && existing.ownerUserId !== user.id) {
        if (user.role !== 'admin' && user.role !== 'owner') {
          return reply.status(403).send({ error: 'forbidden' });
        }
      }

      const body = request.body ?? {};
      const template = await updateTemplate(request.params.id, user.orgId, {
        name: body.name?.trim(),
        shortcut: body.shortcut,
        content: body.content,
        contentRich: body.contentRich,
        category: body.category,
        tagIds: body.tagIds,
        folderId: body.folderId,
        visibility: body.visibility,
        ownerUserId: body.visibility === 'private' ? user.id : null,
      });

      return { template };
    },
  );

  // DELETE /api/v1/message-templates/:id — soft delete
  app.delete<{ Params: { id: string } }>('/api/v1/message-templates/:id', async (request, reply) => {
    const user = request.user!;
    const existing = await getTemplate(request.params.id, user.orgId);

    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }

    // Only owner or admin can delete
    if (existing.visibility === 'private' && existing.ownerUserId !== user.id) {
      if (user.role !== 'admin' && user.role !== 'owner') {
        return reply.status(403).send({ error: 'forbidden' });
      }
    }

    await deleteTemplate(request.params.id, user.orgId);
    return { ok: true };
  });

  // POST /api/v1/message-templates/:id/increment-usage — track usage
  app.post<{ Params: { id: string } }>(
    '/api/v1/message-templates/:id/increment-usage',
    async (request, reply) => {
      const user = request.user!;
      const existing = await getTemplate(request.params.id, user.orgId);

      if (!existing) {
        return reply.status(404).send({ error: 'not_found' });
      }

      await incrementUsageCount(request.params.id, user.orgId);
      return { ok: true };
    },
  );

  // POST /api/v1/message-templates/:id/increment-manual-send — track manual send
  app.post<{ Params: { id: string } }>(
    '/api/v1/message-templates/:id/increment-manual-send',
    async (request, reply) => {
      const user = request.user!;
      const existing = await getTemplate(request.params.id, user.orgId);

      if (!existing) {
        return reply.status(404).send({ error: 'not_found' });
      }

      await incrementManualSendCount(request.params.id, user.orgId);
      return { ok: true };
    },
  );

  // ── Folder CRUD ─────────────────────────────────────────────────────────────

  // GET /api/v1/message-template-folders — list folders
  app.get('/api/v1/message-template-folders', async (request) => {
    const user = request.user!;
    const folders = await listFolders(user.orgId, user.id);

    // Get root-level template count
    const { prisma } = await import('../../shared/database/prisma-client.js');
    const rootCount = await prisma.messageTemplate.count({
      where: {
        orgId: user.orgId,
        archivedAt: null,
        folderId: null,
        OR: [
          { visibility: 'public' },
          { ownerUserId: user.id },
        ],
      },
    });

    return { folders, rootTemplateCount: rootCount };
  });

  // POST /api/v1/message-template-folders — create folder
  app.post<{ Body: FolderBody }>('/api/v1/message-template-folders', async (request, reply) => {
    const user = request.user!;
    const body = request.body ?? {};

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'name_required' });
    }

    // Validate parent folder if provided
    if (body.parentId) {
      const { listFolders: getFolders } = await import('./message-template-service.js');
      const folders = await getFolders(user.orgId, user.id);
      const parentExists = folders.some(f => f.id === body.parentId);
      if (!parentExists) {
        return reply.status(400).send({ error: 'parent_folder_not_found' });
      }
    }

    const folder = await createFolder({
      orgId: user.orgId,
      name: body.name.trim(),
      visibility: body.visibility ?? 'public',
      parentId: body.parentId ?? null,
      ownerUserId: body.visibility === 'private' ? user.id : null,
      createdById: user.id,
    });

    logger.info(`[message-template-folder] created id=${folder.id} by=${user.id}`);
    return reply.status(201).send({ folder });
  });

  // PUT /api/v1/message-template-folders/:id — update folder
  app.put<{ Params: { id: string }; Body: FolderBody }>(
    '/api/v1/message-template-folders/:id',
    async (request, reply) => {
      const user = request.user!;
      const body = request.body ?? {};

      const { listFolders: getFolders } = await import('./message-template-service.js');
      const folders = await getFolders(user.orgId, user.id);
      const existing = folders.find(f => f.id === request.params.id);

      if (!existing) {
        return reply.status(404).send({ error: 'not_found' });
      }

      const folder = await updateFolder(request.params.id, user.orgId, {
        name: body.name?.trim(),
        visibility: body.visibility,
        parentId: body.parentId,
        ownerUserId: body.visibility === 'private' ? user.id : null,
      });

      return { folder };
    },
  );

  // ── AI Generate (2026-07-22) ────────────────────────────────────────────────
  // POST /api/v1/message-templates/ai-generate
  // Body: { description: string, category?: string }
  // Response: { content: string, suggestedName: string }
  app.post('/api/v1/message-templates/ai-generate', async (request, reply) => {
    const user = request.user!;
    const body = request.body as { description?: string; category?: string };
    if (!body.description?.trim()) {
      return reply.status(400).send({ error: 'description_required' });
    }
    try {
      const orgId = user.orgId;
      const cfg = await import('../../shared/database/prisma-client.js')
        .then((m) => m.prisma.aiConfig.findUnique({ where: { orgId } }));
      const provider = cfg?.provider || 'anthropic';
      const model = cfg?.model || 'claude-sonnet-4-6';
      const [apiKey, baseUrl] = await Promise.all([
        resolveProviderApiKey(orgId, provider),
        getProviderBaseUrl(orgId, provider),
      ]);
      if (!apiKey) {
        return reply.status(400).send({ error: 'ai_not_configured' });
      }
      const systemPrompt = 'Bạn là trợ lý viết mẫu tin nhắn Zalo chuyên nghiệp. Trả về JSON {"content": "<nội dung tin nhắn>", "suggestedName": "<tên ngắn gợi nhớ>"}';
      const userPrompt = `Viết mẫu tin nhắn Zalo cho: ${body.description}${body.category ? ` (danh mục: ${body.category})` : ''}. Tin nhắn phải tự nhiên, ngắn gọn, thân thiện. Có thể dùng {{contact.name}}, {{contact.phone}} để cá nhân hoá.`;
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const text = await generateWithOpenaiCompat(
        url,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        500,
        provider === 'openai' && /^gpt-5/i.test(model) ? 'max_completion_tokens' : 'max_tokens',
      );
      // Parse JSON từ AI response (có thể wrap trong ```json ... ```)
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let parsed: { content: string; suggestedName: string };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback: treat whole text as content
        parsed = {
          content: text,
          suggestedName: body.description.slice(0, 50),
        };
      }
      return {
        content: parsed.content || text,
        suggestedName: parsed.suggestedName || body.description.slice(0, 50),
      };
    } catch (err: any) {
      logger.error('[message-template] AI generate error:', err);
      return reply.status(500).send({ error: 'ai_generate_failed', message: err?.message });
    }
  });

  // DELETE /api/v1/message-template-folders/:id — delete folder
  app.delete<{ Params: { id: string } }>(
    '/api/v1/message-template-folders/:id',
    async (request, reply) => {
      const user = request.user!;

      const { listFolders: getFolders } = await import('./message-template-service.js');
      const folders = await getFolders(user.orgId, user.id);
      const existing = folders.find(f => f.id === request.params.id);

      if (!existing) {
        return reply.status(404).send({ error: 'not_found' });
      }

      await deleteFolder(request.params.id, user.orgId);
      return { ok: true };
    },
  );
}
