# Spec: Knowledge Base (RAG-lite) for AI Assistant

## MODIFIED Requirements

### REQ-KB-001: Embed KB context vào AI reply_draft
Khi AI sinh reply suggestion (`generateAiOutput(type='reply_draft')`), nếu `aiTaskConfig.useKnowledgeBase !== false` thì:
- Hệ thống phải retrieve top-K chunks (mặc định K=4, max 8) từ `knowledge_chunks` của org dựa trên cosine similarity với last 5 tin nhắn gần nhất trong conversation.
- Inject top-K text + associated media refs vào user prompt trong `<knowledge_base>` block.
- Nếu top-1 score < 0.3 → KHÔNG inject (tránh AI hallucinate).
- KHÔNG tính retrieval vào `maxDaily` quota (chỉ compute + embed query, không gọi LLM).

### REQ-KB-002: AiTaskConfig toggle cho KB
Schema hiện tại `AiConfig.aiTaskConfig` (JSON) phải support thêm:
- `useKnowledgeBase: boolean` (default true) — global toggle.
- `kbTopK: number` (default 4, range 1–8) — số chunks retrieve.
- `embeddingProvider: 'openai' | 'custom'` (default 'openai') — provider cho embedding API.

UI thêm 1 section "Kho tri thức" trong `/settings/crm/ai-assistant` để edit 3 field trên.

### REQ-KB-003: AI hỏi KB task mới
API `POST /api/v1/knowledge/qa { question: string }` → return:
- `answer: string` — AI compose từ chunks, hoặc fallback "Không tìm thấy tài liệu liên quan" nếu score < 0.3.
- `sources: Array<{ docId, docTitle, ordinal, score, textSnippet }>` — top-K chunks đã dùng.
- `images: Array<{ mediaAssetId, url, caption }>` — ảnh liên quan (từ `knowledge_docs.mediaAssetIds`).
- `source: 'ai' | 'no_match'`.

Quota: Task này TÍNH vào `maxDaily` AI quota (giống `reply_draft`).

## ADDED Requirements

### REQ-KB-NEW-001: Schema KnowledgeDoc + KnowledgeChunk
2 table mới (xem `design.md` section 2):
- `KnowledgeDoc`: `id, orgId, title, kind, sourceUrl, mediaAssetIds[], tags[], isActive, createdById, createdAt, updatedAt, deletedAt`.
- `KnowledgeChunk`: `id, docId, ordinal, text, embedding (Json?), tokenCount, charStart, charEnd, createdAt`.

Indexes:
- `KnowledgeDoc(orgId, isActive, deletedAt)`
- `KnowledgeDoc(orgId, tags)` — GIN
- `KnowledgeChunk(docId, ordinal)` UNIQUE
- `KnowledgeChunk(docId)` INDEX

### REQ-KB-NEW-002: CRUD API
- `POST /api/v1/knowledge/docs` — tạo doc (input: title, kind, text/markdown | mediaAssetIds, tags). Background embed + chunk + lưu.
- `GET /api/v1/knowledge/docs?search=&tags=&limit=&offset=` — list + filter.
- `GET /api/v1/knowledge/docs/:id` — read.
- `PATCH /api/v1/knowledge/docs/:id` — update. Nếu text/mediaAssetIds đổi → re-embed nguyên doc.
- `DELETE /api/v1/knowledge/docs/:id` — soft-delete (set deletedAt).
- `POST /api/v1/knowledge/docs/:id/reembed` — force re-embed (sau khi đổi embedding model).

Auth: tất cả endpoint require `requiresAuth` + check `orgId === user.orgId`.

### REQ-KB-NEW-003: UI quản lý KB
Trang mới `/settings/knowledge-base` (link từ Settings sidebar):
- Table list (title, tags, kind, # chunks, updatedAt, actions).
- Upload .md dialog (paste + tags).
- FAQ dialog (Q + A → 1 chunk).
- Thêm ảnh từ Media Library (multi-select + caption chung).
- Drawer edit (xem chunks + re-embed button).

### REQ-KB-NEW-004: AI hỏi KB panel trong chat
Popup mở từ MessageThread toolbar + ChatContactPanel button "Hỏi KB":
- Input câu hỏi → POST `/knowledge/qa`.
- Hiển thị `answer` + danh sách ảnh liên quan (thumb) + sources (collapsible).
- Nút "Đặt vào ô nhập" → fill textarea với answer.
- Nút "Đính kèm ảnh" → attach `images[]` vào message composer.

## REMOVED Requirements
Không có.

## Rationale
Xem `design.md` đầy đủ. Tóm tắt:
- **JSON vector (không pgvector)**: tránh migration extension sudo; compute cosine in-process đủ nhanh cho ≤10K chunks/org (~1ms / query).
- **OpenAI-compatible embedding**: tận dụng key OpenAI đã có của org; dễ mở rộng sang custom endpoint.
- **Image chỉ lưu metadata, không embed vector**: effort cao (cần CLIP/BLIP), use case chính (KB sản phẩm) đã đủ với text+caption. Migrate sau nếu cần.
- **Reuse MediaAssetItem cho ảnh**: 0 duplicate storage; KB chunk chỉ lưu reference IDs.
- **Quota exemption cho retrieval**: retrieval chỉ embed 1 query + cosine ~1ms, không nên ăn quota AI (user complaint nếu 1 câu hỏi KB ăn quota).
