-- 2026-07-24: Knowledge Base (RAG-lite) cho AI Assistant.
-- Xem openspec/changes/add-knowledge-base-and-chat-drag/. Lưu vector dạng JSONB (không cần
-- extension pgvector) để giữ migration đơn giản; cosine similarity compute in-process.
-- TypeScript-side model: KnowledgeDoc + KnowledgeChunk trong backend/prisma/schema.prisma.

CREATE TABLE "knowledge_docs" (
    "id" UUID NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source_url" TEXT,
    "media_asset_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_docs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" JSONB,
    "token_count" INTEGER,
    "char_start" INTEGER NOT NULL,
    "char_end" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_docs_org_id_is_active_deleted_at_idx" ON "knowledge_docs"("org_id", "is_active", "deleted_at");
CREATE INDEX "knowledge_docs_tags_idx" ON "knowledge_docs" USING GIN ("tags");
CREATE UNIQUE INDEX "knowledge_chunks_doc_id_ordinal_key" ON "knowledge_chunks"("doc_id", "ordinal");
CREATE INDEX "knowledge_chunks_doc_id_idx" ON "knowledge_chunks"("doc_id");

ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "knowledge_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
