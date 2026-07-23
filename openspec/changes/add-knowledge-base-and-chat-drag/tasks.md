# Tasks: add-knowledge-base-and-chat-drag

## Phase 1 — Foundation

- [ ] 1.1. Thêm 2 model mới `KnowledgeDoc` + `KnowledgeChunk` vào `backend/prisma/schema.prisma` (xem design.md section 2).
- [ ] 1.2. Chạy `npx prisma migrate dev --name add_knowledge_base` để generate migration.
- [ ] 1.3. Verify migration apply thành công trên local DB.
- [ ] 1.4. Tạo file `backend/src/modules/knowledge/knowledge-service.ts` với skeleton:
  - `chunkMarkdown(text)` — chunk 500–800 chars, return `{text, charStart, charEnd}[]`.
  - `embedBatch(texts)` — gọi OpenAI `/v1/embeddings` 1536-dim, batch 96.
  - `searchTopK(orgId, query, k)` — embed query → cosine sim trên knowledge_chunks của org → return top-K.

## Phase 2 — Knowledge Doc CRUD (API)

- [ ] 2.1. Tạo file `backend/src/modules/knowledge/knowledge-routes.ts` với:
  - `POST /api/v1/knowledge/docs` — create + auto chunk + embed background.
  - `GET /api/v1/knowledge/docs?search=&tags=` — list + filter (search dùng title/tags ILIKE; vector search qua endpoint riêng).
  - `GET /api/v1/knowledge/docs/:id` — read + chunks.
  - `PATCH /api/v1/knowledge/docs/:id` — update (nếu text đổi → re-embed).
  - `DELETE /api/v1/knowledge/docs/:id` — soft delete.
  - `POST /api/v1/knowledge/docs/:id/reembed` — force re-embed.
- [ ] 2.2. Tạo file `backend/src/modules/knowledge/knowledge-types.ts` (Fastify type augmentation cho request shapes).
- [ ] 2.3. Register routes trong `backend/src/server.ts` / plugin index.
- [ ] 2.4. Permission check: tất cả endpoint require auth + `orgId === user.orgId`. Admin role only cho create/delete.
- [ ] 2.5. Unit test: `chunkMarkdown('...')` returns ≥1 chunk với charRange valid.
- [ ] 2.6. Unit test: `embedBatch(['hi'])` returns `[[number]]` đúng 1536 dim (skip nếu không có OPENAI key trong CI).

## Phase 3 — KB Retrieval & Q&A

- [ ] 3.1. Tạo file `backend/src/modules/knowledge/qa-service.ts`:
  - `knowledgeQA(orgId, question)` — embed question → searchTopK(6) → build system + user prompt → generateText → return `{answer, sources, images, source}`.
- [ ] 3.2. Tạo `POST /api/v1/knowledge/qa` route → gọi `qa-service` → return structured response.
- [ ] 3.3. Modify `backend/src/modules/ai/ai-service.ts`:
  - Trong `generateAiOutput`, sau khi build conversation context: gọi `searchKbContext(orgId, contextText, topK)` và inject vào userPrompt nếu có.
  - Honor `aiTaskConfig.useKnowledgeBase` + `kbTopK`.
- [ ] 3.4. Modify `buildReplyDraftPrompt` để add 1 đoạn hướng dẫn "dựa trên KIẾN THỨC TRÊN nếu phù hợp, không bịa".
- [ ] 3.5. Verify quota: retrieval KHÔNG tính vào `maxDaily`; Q&A (`/knowledge/qa`) CÓ tính (track qua `aiSuggestion`).

## Phase 4 — UI: KB Management Page

- [ ] 4.1. Tạo `frontend/src/views/settings/KnowledgeBasePage.vue` — table list + filter + upload dialog.
- [ ] 4.2. Tạo `frontend/src/api/knowledge.ts` — wrapper cho 5 endpoints + types.
- [ ] 4.3. Upload .md dialog (textarea + title + tags multi-input).
- [ ] 4.4. FAQ dialog (Q + A form).
- [ ] 4.5. Thêm Media multi-select dialog (re-use MediaPicker từ MediaView).
- [ ] 4.6. Edit drawer (xem chunks detail + re-embed button + delete confirm).
- [ ] 4.7. Soft-delete confirm modal (`useConfirm()`).
- [ ] 4.8. Register route `/settings/knowledge-base` trong `frontend/src/router/index.ts`.
- [ ] 4.9. Add entry "Kho tri thức" trong Settings sidebar.
- [ ] 4.10. AiConfig.toggle KB section trong `frontend/src/views/settings/AiAssistantPage.vue` (3 fields mới).

## Phase 5 — UI: AI Q&A Panel trong Chat

- [ ] 5.1. Tạo `frontend/src/components/chat/KnowledgeQaPanel.vue`:
  - Input câu hỏi + submit.
  - Hiển thị answer.
  - Hiển thị images grid (thumbnails).
  - Sources collapsible.
- [ ] 5.2. Button "Hỏi KB" trong `MessageThread.vue` toolbar (icon `mdi-book-search-outline`).
- [ ] 5.3. Button "Hỏi KB" trong `ChatContactPanel.vue` (cùng vị trí nút AI summary/sentiment).
- [ ] 5.4. "Đặt vào ô nhập" → emit event để parent fill textarea.
- [ ] 5.5. "Đính kèm ảnh" → emit images array để parent attach vào composer (cần update MessageInput component nếu chưa support multi-image attach).

## Phase 6 — Chat Drag Divider

- [ ] 6.1. Modify `frontend/src/views/ChatView.vue`:
  - Replace `@mousedown="startDrag"` bằng `@pointerdown="startDrag"` cho 3 dividers.
  - Reuse logic `onMouseMove` → đổi tên `onPointerMove`, dùng `pointermove` global listener.
  - Add `endDrag` listener.
- [ ] 6.2. Add localStorage persistence (load on mount, save on endDrag).
- [ ] 6.3. Add `applyWidths(widths)` helper (refactor từ logic inline hiện tại).
- [ ] 6.4. Add ESC keydown handler trong drag → revert + abort.
- [ ] 6.5. Add double-click handler trên divider → resetColumn(target).
- [ ] 6.6. Add keyboard a11y:
  - Tab focus → Arrow ←/→ resize ±10px.
  - Shift+Arrow ±50px, Home/End min/max, Enter reset.
- [ ] 6.7. Modify CSS `.smax-divider`:
  - Add `:hover`, `.is-dragging` states.
  - Add `::before` pseudo +8px hit-area.
  - Add `touch-action: none`.
- [ ] 6.8. Add ARIA attrs: `role="separator"`, `aria-orientation`, `aria-valuenow`, `aria-valuemin/max`, `aria-label`.
- [ ] 6.9. Add aria-live region thông báo khi resize.
- [ ] 6.10. Verify trên Chrome desktop + Chrome DevTools mobile emulator + thật nếu có thiết bị.

## Phase 7 — Verify & Document

- [ ] 7.1. `npx vue-tsc --noEmit` (frontend) pass.
- [ ] 7.2. `npx tsc --noEmit` (backend) pass.
- [ ] 7.3. `npm run build` (frontend) pass.
- [ ] 7.4. Manual test scenario:
  - Tạo 1 doc markdown → vào chat → gửi câu hỏi → AI trả lời có trích dẫn doc.
  - Tạo 1 doc media collection 3 ảnh → hỏi "ảnh căn 3PN" → AI trả + 3 ảnh.
  - Drag divider → release → refresh → giữ width.
  - Drag trên mobile → release → widths persist.
- [ ] 7.5. Update `OPENSPEC.md` với link tới change này.
- [ ] 7.6. Update `docs/KNOWLEDGE_BASE.md` mới (nếu có thư mục docs).
- [ ] 7.7. OpenSpec archive: `openspec archive add-knowledge-base-and-chat-drag --yes` (sau khi ship).

## Out of Scope (sprint sau)

- ❌ Image embedding (CLIP/BLIP) — chỉ metadata search.
- ❌ Binary file parsing (.pdf/.docx) — chỉ .md/text.
- ❌ pgvector extension — dùng JSON vector.
- ❌ Audit log cho KB updates.
- ❌ Auto-suggest tags khi upload (chỉ manual tags MVP).
- ❌ AI auto-extract KB từ conversation history (sprint 2).
