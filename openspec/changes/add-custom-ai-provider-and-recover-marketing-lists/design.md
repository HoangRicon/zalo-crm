# Design: AI Provider 'custom' + Khôi phục Marketing Lists

> Parent: [proposal.md](../proposal.md) · [Specs](./specs/)

---

## Architecture Overview

Change này không thay đổi kiến trúc tổng thể — chỉ thêm 1 provider vào registry hiện có, thêm 1 trang detail, và wire 2 nút navigation. Tất cả dùng lại infrastructure sẵn có (ai-service, list-routes, use-customer-lists).

```
┌────────────────────────────────────────────────────────────────────┐
│                        Frontend (Vue 3)                             │
│  Settings → AI Assistant → Providers → Custom [NEW]                │
│  ListsView → Import CSV tab [MODIFY]                               │
│  ListsView → row-actions [MODIFY: +1 nút]                          │
│  ListDetailView [NEW] → 4 tabs → Action bar                        │
│        ↓ router.push                                                │
│  BroadcastsView?listId= [MODIFY: read query]                       │
│  TargetsView?listId= [MODIFY: read query]                          │
└────────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌────────────────────────────────────────────────────────────────────┐
│                      Backend (Fastify)                              │
│  ai-routes.ts [MODIFY: add 'custom' provider id]                   │
│    GET /api/v1/ai/providers → 6 entries                             │
│    PUT /api/v1/ai/providers/custom → save per-org                   │
│    GET /api/v1/ai/providers/custom/models → list models             │
│  provider-registry.ts [MODIFY: +1 catalog entry, +1 type guard]    │
│  config/index.ts [MODIFY: +3 env vars]                              │
│  providers/custom.ts [NEW: thin wrapper over openai-compat]        │
│                                                                     │
│  list-routes.ts [VERIFY: import endpoint already exists]           │
│  list-import-service.ts [VERIFY: ready]                            │
└────────────────────────────────────────────────────────────────────┘
                              ↓ Prisma
┌────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL — NO MIGRATION NEEDED                   │
│  app_settings(orgId, settingKey='ai_custom_api_key'|'ai_custom_    │
│               base_url', value_plain | value_encrypted)  [EXISTING]│
│  customer_list, customer_list_entry                                │
│  activity_log (cho tab Lịch sử)                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: Custom provider dùng OpenAI-compatible API

**Context**: Hầu hết custom LLM endpoint (vLLM, LM Studio, Ollama, llama.cpp server, internal proxy) theo chuẩn OpenAI `/v1/chat/completions`. Anthropic + Gemini dùng chuẩn riêng.

**Decision**: Provider `custom` **mặc định** dùng `generateWithOpenaiCompat(baseUrl + '/v1/chat/completions', apiKey, model, system, prompt, maxTokens)`.

**Rationale**:
- 95% trường hợp user custom cũng theo OpenAI-compat → zero code mới.
- Nếu cần chuẩn khác (vd Anthropic-compat), user mở issue riêng → viết handler mới tương tự `anthropic.ts`.

**Alternatives considered**:
- ❌ Detect protocol tự động (vì baseUrl có thể là bất kỳ) → quá phức tạp, dễ sai.
- ✅ Cứ định nghĩa rõ: "custom = OpenAI-compatible". Document trong `config/index.ts`.

### D2: Per-org config qua app_settings (KHÔNG qua env)

**Context**: User nói "cài đặt config trong database". 5 provider hiện có dùng `app_settings` per-org (AES-GCM cho key, plain cho url).

**Decision**: Provider `custom` dùng **đúng cùng pattern**:
- `settingKey = 'ai_custom_api_key'` → lưu AES-GCM vào `value_encrypted`.
- `settingKey = 'ai_custom_base_url'` → lưu plain vào `value_plain`.
- Env `CUSTOM_AUTH_TOKEN` + `CUSTOM_BASE_URL` chỉ là **fallback** khi DB không có (giống 5 provider khác).

**Rationale**:
- Nhất quán codebase.
- Mỗi org có thể dùng baseUrl riêng (multi-tenant).
- UI Set Key đã có sẵn ở Settings → AI Assistant → chỉ thêm 1 row "Custom" vào bảng.

**Alternatives considered**:
- ❌ Hardcode vào `.env` toàn cục → không đúng yêu cầu user.
- ❌ Tạo bảng mới `AiCustomConfig` → over-engineer, app_settings đủ dùng.

### D3: ListDetailView dùng polling 5s thay vì websocket

**Context**: List có thể được thêm SĐT mới bởi cron `list-counter-refresh.ts` hoặc worker khác.

**Decision**: ListDetailView dùng `setInterval(fetchList, 5000)` để refresh stats + bảng KH. Dừng polling khi user rời trang.

**Rationale**:
- Đơn giản, không cần thêm socket event mới.
- Polling 5s đủ nhanh cho UX, không spam DB (mỗi org có 1 view active).

**Alternatives considered**:
- ❌ Websocket event mới → phải đụng `emit-*` modules, scope quá rộng cho change này.
- ❌ Manual refresh button → UX kém.

### D4: Import CSV — tab trong modal, không phải route mới

**Context**: CreateListModal hiện chỉ tạo tệp rỗng. Import là flow phổ biến.

**Decision**: Thêm tab "Tạo rỗng / Import CSV" trong cùng modal hiện có.

**Rationale**:
- Cùng 1 workflow: tạo tệp → chọn nguồn dữ liệu.
- Tái dùng validation + submit logic.
- User không phải navigate sang trang khác.

**Alternatives considered**:
- ❌ Route `/marketing/lists/import` riêng → fragment flow, UX kém.
- ❌ Modal riêng → duplicate code.

### D5: Không có migration DB

**Context**: Toàn bộ data model cần thiết đã có:
- `app_settings` — cho provider config.
- `customer_list`, `customer_list_entry` — cho import + detail.
- `activity_log` — cho tab Lịch sử.
- `broadcast_job.customerListId` — nullable, đã có.
- `friend_request_attempt.customerListId` (?) — cần verify trong apply.

**Decision**: Change này **không** thêm Prisma migration. Nếu apply phát hiện FK thiếu → mở sub-change riêng.

**Rationale**:
- Sprint 0 + Sprint 1 là khôi phục UI/API từ code đã có.
- Migration chỉ cần khi Sprint 2+ (A/B test cần cột mới trong BroadcastRunItem).

---

## Sequence Diagrams

### AI Provider 'custom' — Set Key + Generate

```
User (Settings UI)         Fastify              provider-registry      app_settings DB       custom provider
       │                      │                        │                      │                     │
       │ PUT /providers/custom {baseUrl, apiKey}       │                      │                     │
       ├─────────────────────►│                        │                      │                     │
       │                      │ setProviderApiKey()    │                      │                     │
       │                      ├───────────────────────►│                      │                     │
       │                      │                        │ encryptToken(apiKey) │                     │
       │                      │                        ├─────────────────────►│                     │
       │                      │                        │   {ok}               │                     │
       │                      │ setProviderBaseUrl()   │                      │                     │
       │                      ├───────────────────────►│                      │                     │
       │                      │                        │ upsert app_settings  │                     │
       │                      │                        ├─────────────────────►│                     │
       │                      │                        │   {ok}               │                     │
       │  {ok: true}          │                        │                      │                     │
       │◄─────────────────────┤                        │                      │                     │
       │                      │                        │                      │                     │
       │ ... 5 phút sau ...   │                        │                      │                     │
       │                      │                        │                      │                     │
       │ POST /ai/reply-draft {convId}                 │                      │                     │
       ├─────────────────────►│                        │                      │                     │
       │                      │ generateAiOutput()     │                      │                     │
       │                      ├───────────────────────►│ generateText()       │                     │
       │                      │                        ├ resolveProviderApiKey(orgId, 'custom')        │
       │                      │                        ├─────────────────────►│                     │
       │                      │                        │  apiKey (decrypted)  │                     │
       │                      │                        │◄─────────────────────┤                     │
       │                      │                        │ getProviderBaseUrl() │                     │
       │                      │                        ├─────────────────────►│                     │
       │                      │                        │  baseUrl             │                     │
       │                      │                        │◄─────────────────────┤                     │
       │                      │                        │ generateWithOpenaiCompat(baseUrl, key, model)
       │                      │                        ├────────────────────────────────────────────►│
       │                      │                        │  {text}                                          │
       │                      │                        │◄─────────────────────────────────────────────┤
       │  {content, conf}     │                        │                      │                     │
       │◄─────────────────────┤                        │                      │                     │
```

### Import CSV — Paste SĐT + Submit

```
User              CreateListModal       use-customer-lists        Fastify          list-import-service      PostgreSQL
  │                    │                       │                       │                    │                    │
  │ Paste 100 SĐT     │                       │                       │                    │                    │
  ├───────────────────►│                       │                       │                    │                    │
  │                    │ detectDelimiter()     │                       │                    │                    │
  │                    │ validatePhones()      │                       │                    │                    │
  │                    │ renderPreview(10rows) │                       │                    │                    │
  │◄───────────────────┤                       │                       │                    │                    │
  │                    │                       │                       │                    │                    │
  │ Click "Import"     │                       │                       │                    │                    │
  ├───────────────────►│                       │                       │                    │                    │
  │  confirmDialog     │                       │                       │                    │                    │
  │  "Import 80 valid?"│                       │                       │                    │                    │
  │◄───────────────────┤                       │                       │                    │                    │
  │ Click OK           │                       │                       │                    │                    │
  ├───────────────────►│                       │                       │                    │                    │
  │                    │ importList(payload)   │                       │                    │                    │
  │                    ├──────────────────────►│                       │                    │                    │
  │                    │                       │ POST /customer-lists/import                    │                    │
  │                    │                       ├──────────────────────►│                    │                    │
  │                    │                       │                       │ parse + validate   │                    │
  │                    │                       │                       ├───────────────────►│                    │
  │                    │                       │                       │  insert entries    │                    │
  │                    │                       │                       ├─────────────────────────────────────────►│
  │                    │                       │                       │  {id, totalEntries}│                    │
  │                    │                       │                       │◄─────────────────────────────────────────┤
  │                    │                       │  {id, totalEntries}   │                    │                    │
  │                    │                       │◄──────────────────────┤                    │                    │
  │                    │  {id}                 │                       │                    │                    │
  │                    │◄──────────────────────┤                       │                    │                    │
  │  toast + route     │                       │                       │                    │                    │
  │  to /lists/:id     │                       │                       │                    │                    │
  │◄───────────────────┤                       │                       │                    │                    │
```

---

## File Structure

### Files to CREATE

```
backend/src/modules/ai/providers/
  └── custom.ts                        # OpenAI-compat wrapper cho 'custom' provider

frontend/src/views/marketing/
  └── ListDetailView.vue               # 4-tab detail page

frontend/src/components/lists/
  └── (no new files — extend existing CreateListModal.vue + ListsView.vue)
```

### Files to MODIFY

```
backend/src/modules/ai/
  ├── provider-registry.ts             # +1 catalog entry, +1 type guard
  └── ai-routes.ts                     # (đã loop qua PROVIDER_IDS, không cần sửa)

backend/src/
  └── config/index.ts                  # +3 env vars: CUSTOM_BASE_URL, CUSTOM_AUTH_TOKEN, CUSTOM_DEFAULT_MODEL

frontend/src/views/marketing/
  ├── ListsView.vue                    # bỏ disabled, wire 2 nút, +1 nút mới
  ├── BroadcastsView.vue               # đọc route.query.listId → pre-fill
  └── TargetsView.vue                  # đọc route.query.listId → pre-fill

frontend/src/components/lists/
  └── CreateListModal.vue              # thêm tab Import CSV

frontend/src/router/  (or wherever route /marketing/lists/:id is registered)
  └── (verify route đã có — chỉ thêm nếu thiếu)
```

### Files NOT touched (verify only)

```
backend/src/modules/lists/
  ├── list-routes.ts                   # đã có POST /import
  ├── list-import-service.ts           # đã có logic
  ├── list-entry-routes.ts             # GET /:id/entries (cho tab Khách hàng)
  └── list-counter-refresh.ts          # (cho polling)
```

---

## Rollback Strategy

| Capability | Rollback |
|---|---|
| Provider 'custom' | Revert 1 commit (3 files: provider-registry.ts, config/index.ts, providers/custom.ts). Existing 5 providers vẫn hoạt động bình thường. |
| Import CSV tab | Revert 1 commit (1 file: CreateListModal.vue). ListsView nút bị disabled lại như cũ. |
| ListDetailView | Revert 1 commit (1 file: ListDetailView.vue). Route vẫn tồn tại nhưng trống — cần xoá route registration nếu gây 404 UI. |
| Wire 2 nút | Revert 1 commit (2 files: ListsView.vue + BroadcastsView.vue + TargetsView.vue). Query param bị bỏ qua. |

**Cách revert**:
```bash
git revert <commit-sha>     # an toàn, tạo commit mới undo
# hoặc
git reset --hard HEAD~N     # nếu chưa push
```

---

## Open Questions

Cần user xác nhận trước khi implement:

1. **Custom provider dùng OpenAI-compat** — OK? Nếu user cần chuẩn riêng (vd Anthropic-compatible), mở issue riêng?
2. **Polling 5s cho ListDetailView** — OK? Hay muốn manual refresh button?
3. **Package `xlsx`** — thêm vào `package.json` frontend (tăng bundle ~200KB). OK?

Tôi sẽ đợi user confirm proposal + specs trước khi qua tasks.md.