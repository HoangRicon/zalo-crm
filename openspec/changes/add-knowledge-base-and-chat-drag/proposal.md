# Proposal: add-knowledge-base-and-chat-drag

> **Status**: Awaiting user approval. Spec-first gate (G1) — DO NOT proceed to implementation until user explicitly confirms.

## Why

### Vấn đề 1 — AI suggestions quá "generic"

Hiện tại AI reply/suggest chỉ dựa trên **1 system prompt duy nhất** (`aiAssistantPromptTemplate` trong `AiConfig`). Sale thuộc 1 ngành đặc thù (bất động sản, y tế, giáo dục...) thì:

- AI không biết tên sản phẩm/dự án cụ thể của org → trả lời sai tên, sai giá, sai chính sách.
- Khi KH hỏi "Phí quản lý bao nhiêu?" hay "Có loại 3PN view sông không?", AI không có nguồn tham chiếu → bịa hoặc lặp lại câu chung chung.
- Khi KH gửi **ảnh** (sản phẩm, lỗi, hợp đồng), AI chỉ nhìn caption text — không hiểu ngữ cảnh nội dung ảnh.
- Ảnh sản phẩm đã có trong **Media Library** (`/media`) nhưng AI không retrieve được → sale phải tự attach thủ công.

### Vấn đề 2 — Drag divider bị disable cứng

`ChatView.vue` hàm `startDrag(e, target)` chỉ gọi `e.preventDefault()` rồi return — comment nói rõ "Draggable disabled - fixed layout". User than phiền:

- Không resize được các cột (sidebar filters / conversations / messages / contact panel) theo ý muốn.
- Khi đọc message dài → phải scroll ngang → thiếu chỗ cho message thread.
- Khi mở contact panel mà KH có nhiều tab → không gian quá hẹp.
- Trên màn hình 27" thì sidebar 220px chiếm chỗ thừa, kéo được thì gọn hơn nhiều.

## What Changes

Triển khai **Knowledge Base (RAG-lite)** + **enable drag divider** cho trang Chat.

| # | Capability | Spec file | Mức độ |
|---|------------|-----------|--------|
| 1 | Schema `KnowledgeDoc` + `KnowledgeChunk` | `specs/knowledge-base/spec.md` | HIGH |
| 2 | Embed chunks (OpenAI text-embedding-3-small 1536-dim) + retrieve top-K qua cosine sim in-process | `specs/knowledge-base/spec.md` | HIGH |
| 3 | CRUD `/api/v1/knowledge/*` + UI `/settings/knowledge-base` | `specs/knowledge-base/spec.md` | HIGH |
| 4 | Inject KB vào `buildReplyDraftPrompt` + `qa_answer` task | `specs/knowledge-base/spec.md` | HIGH |
| 5 | Đính kèm ảnh tự động từ KB vào gợi ý reply | `specs/knowledge-base/spec.md` | MEDIUM |
| 6 | Enable drag 3 cột + visual feedback + persist localStorage + ESC revert + double-click reset | `specs/chat-drag/spec.md` | MEDIUM |
| 7 | Touch + a11y (keyboard, aria) cho drag divider | `specs/chat-drag/spec.md` | MEDIUM |

## User chọn (gate cho spec-first)

User chọn:
- ✅ **OpenSpec đầy đủ** để chờ duyệt
- ✅ **Full RAG strategy = text + ảnh + embed vector + cosine in-app (JSONB)**
- ✅ **Inject vào Q&A** (hỏi trực tiếp từ KB)
- ✅ **Enable drag toàn bộ 3 cột + polish UX**

## Out of scope (để sprint sau)

- Image embedding thực sự (CLIP/BLIP) — chỉ metadata search.
- Binary file parsing (.pdf/.docx) — chỉ markdown/text.
- pgvector extension — tính cosine trong Node.js với JSONB vector.
- Audit log KB updates.
- Auto-suggest tags / auto-extract KB từ conversation history.

## Bối cảnh kỹ thuật

- AI đã có sẵn multi-provider (anthropic/gemini/openai/qwen/kimi/custom). Embedding dùng OpenAI-compatible endpoint (`/v1/embeddings` chuẩn OpenAI 2024) — tận dùng key OpenAI đã có.
- Media Library đã có schema `MediaAssetItem`. KB sẽ tái sử dụng thay vì tạo bảng file mới.
- Drag divider code đã có sẵn trong `ChatView.vue` (hàm `onMouseMove` đầy đủ), chỉ bị disable ở `startDrag`. Reuse hoàn toàn, không viết lại.

## Đọc tiếp

- `design.md` — kiến trúc chi tiết (schema, chunking, embedding, retrieval, UX)
- `tasks.md` — checklist 7 phase, từng task có verification
- `specs/knowledge-base/spec.md` — REQ format chuẩn OpenSpec
- `specs/chat-drag/spec.md` — REQ format chuẩn OpenSpec

## Bước tiếp theo

**⏸ DỪNG — chờ user duyệt proposal này** trước khi đụng code.

Sau duyệt → implement theo `tasks.md` (7 phase).
