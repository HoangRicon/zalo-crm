# ZCRM — Kế hoạch khôi phục & nâng cấp Marketing/Automation

> **Phạm vi**: Toàn bộ 12 đề xuất từ phân tích (đã chốt với user ngày 21/07/2026 — chọn `full_vision`, tích hợp AI qua **provider riêng**).
>
> **Nguyên tắc**:
> - Tận dụng tối đa infrastructure sẵn có (`ai-service.ts`, `broadcast-*`, `lists/*`, `scoring/*`, `engagement/*`, OpenAI-compat provider).
> - Mỗi sprint tự chứa test + verify trước khi sang sprint sau.
> - Mọi tính năng AI mới phải có fallback rule-based (đề xuất ngày 21/07).

---

## 0. Tình trạng hiện tại (đã khảo sát)

### Module Community đang chạy
| Module | Path | Trạng thái |
|---|---|---|
| AI Service (5 provider, 6 task type) | `backend/src/modules/ai/` | ✅ |
| Broadcast tự động | `backend/src/modules/broadcast/` | ✅ (thiếu A/B, reply tracking, heatmap) |
| Tệp khách hàng (Lists) | `backend/src/modules/lists/` | ✅ (thiếu Import CSV UI) |
| Mục tiêu (auto kết bạn) | `backend/src/modules/campaign/` | ✅ (thiếu dashboard) |
| Khối nội dung | `backend/src/modules/content-blocks/` | ✅ (thiếu AI suggest, biến mở rộng) |
| Scoring engine | `backend/src/modules/scoring/` | ✅ |
| Engagement tracking | `backend/src/modules/engagement/` | ✅ |
| Reports | `backend/src/modules/analytics/` | ✅ |
| Lead Ads integrations | `backend/src/modules/contacts/zinstant-proxy-routes.ts` + … | ✅ (FB, TikTok, Zalo Ads, Google) |
| Telegram bridge | `backend/src/modules/integrations/providers/telegram-bot.ts` | ✅ |

### Module EE (đã tách ra repo riêng, có stub ở Community)
- Triggers, Sequences, Blocks, Care Session, Lead Notify, Lead Pool, Friend-Invite → **KHÔNG đụng** trong plan này.

### Provider AI
- Hiện có: Anthropic, Gemini, OpenAI, Qwen, Kimi (qua `provider-registry.ts`).
- Bạn có baseurl + apikey + model riêng → **sẽ thêm provider mới** trong Sprint 0.

---

## Sprint 0 — Chuẩn bị (0.5 ngày)

**Mục tiêu**: Thêm AI provider riêng, set up test harness cho các tính năng AI mới.

### 0.1. Thêm provider mới (`provider riêng`)
**File**: `backend/src/modules/ai/provider-registry.ts`, `backend/src/modules/ai/providers/<custom>.ts`, `backend/src/config/index.ts`

- Thêm provider id mới (vd: `custom`, hoặc tên cụ thể bạn cung cấp).
- Reuse `generateWithOpenaiCompat` nếu API là OpenAI-compatible; nếu không, viết handler mới tương tự `anthropic.ts`.
- Cấu hình env: `CUSTOM_BASE_URL`, `CUSTOM_AUTH_TOKEN`, `CUSTOM_DEFAULT_MODEL`.
- Thêm vào `PROVIDER_IDS` array.

**Verify**:
- `GET /api/v1/ai/providers` trả về provider mới.
- `GET /api/v1/ai/providers/:id/models` list được model.
- Test generate 1 câu reply_draft OK.

### 0.2. Test harness
**File mới**: `backend/src/modules/ai/__tests__/prompts-e2e.test.ts`

- Snapshot test cho mỗi prompt builder mới (sprint 1-4).
- Verify quota counter tăng đúng.
- Verify fallback rule-based khi AI fail/timeout/quota.

---

## Sprint 1 — Khôi phục tính năng đã mất (R1-R3) [3-5 ngày]

### R1. Bật Import CSV cho Tệp khách hàng
**Files**:
- `frontend/src/views/marketing/ListsView.vue` — bỏ `disabled`, wire handler.
- `frontend/src/components/lists/CreateListModal.vue` — thêm tab "Import CSV".
- `backend/src/modules/lists/list-routes.ts` + `list-import-service.ts` (đã có sẵn).

**Tính năng**:
- Paste SĐT (1 cột hoặc nhiều cột).
- Upload file `.csv` / `.xlsx` (cần `xlsx` package).
- Auto-detect delimiter (`;`, `,`, `\t`).
- Preview 10 dòng đầu trước khi import.
- Thống kê: bao nhiêu valid, trùng trong tệp, trùng CRM.

**Verify**:
- Upload file 1000 SĐT → import → list hiển thị `totalEntries=1000`, `validEntries` đúng.
- Click "Quét lại Zalo" → status chuyển `processing` → `done`.

### R2. Tạo ListDetailView phiên bản Community
**File mới**: `frontend/src/views/marketing/ListDetailView.vue`

**Tính năng**:
- Tabs: Tổng quan · Khách hàng · Lịch sử import · Cài đặt.
- Tab Khách hàng: bảng (search, filter valid/dup/no-zalo, sort, phân trang).
- Hiển thị `scoreBreakdown` (mini) cho từng KH nếu có.
- Nút: "Tạo broadcast từ tệp này", "Tạo campaign mục tiêu từ tệp này", "Export CSV".

**Verify**:
- Mở 1 tệp có 500 KH → render < 1s, scroll mượt.
- Click "Tạo broadcast" → route sang `/marketing/broadcasts` với `customerListId` pre-fill.

### R3. Wire nút "Tạo broadcast/campaign" từ ListsView
**File**: `frontend/src/views/marketing/ListsView.vue`

- Nút `<v-icon>mdi-send</v-icon>` đã có ở `row-actions` — wire `@click` → route sang broadcast wizard với pre-fill list ID.
- Thêm nút "Tạo campaign" tương tự → route `/marketing/targets` với pre-fill.

**Verify**:
- Từ 1 list, click 2 nút → cả 2 form mở đúng với list đã chọn.

---

## Sprint 2 — Nâng cấp Broadcast + Khối nội dung (R4-R5) [5-7 ngày]

### R4. Preview & A/B test cho Broadcast
**Files**:
- `frontend/src/views/marketing/BroadcastsView.vue` — thêm tab "A/B test", preview modal.
- `backend/src/modules/broadcast/broadcast-routes.ts` + schema mới.

**Tính năng**:
- **Preview**: trước khi gửi, hiển thị 5 KH mẫu + tin họ sẽ nhận (render biến `{{ten}}`).
- **A/B test**: chọn 2+ mẫu tin → hệ thống chia đều đối tượng → đo reply rate → tự chọn winner sau 24h.
- **Reply tracking**: khi KH reply sau broadcast → link `broadcastRunItem` ↔ reply message → tính `responseRate`.
- **Heatmap giờ gửi**: aggregate 30 ngày → gợi ý khung giờ có response rate cao nhất.
- **Blacklist nick**: thêm cờ "đừng dùng nick này cho broadcast" ở `/settings/zalo`.

**Schema**:
```prisma
model BroadcastRunItem {
  // ... existing
  replyMessageId  String?  // FK tới Message.id (KH reply)
  repliedAt       DateTime?
  abGroupId       String?  // null = không phải A/B, 'A'/'B'/...
}
```

**Verify**:
- Tạo broadcast A/B 2 mẫu → 100 KH → check chia đều 50/50.
- 10 KH reply → `responseRate = 10%` hiển thị trên card.

### R5. AI Suggest cho Khối nội dung
**Files**:
- `frontend/src/views/marketing/ContentBlocksView.vue` — nút "✨ AI gợi ý".
- `backend/src/modules/ai/prompts/content-block-suggest.ts` (mới).
- `backend/src/modules/ai/ai-routes.ts` — endpoint mới `POST /ai/suggest-content-blocks`.
- `frontend/src/components/ai/ai-suggestion-panel.vue` (đã có, mở rộng).

**Prompt sketch**:
```
Bạn là chuyên gia content marketing bất động sản. Sale đang nhắn tin cho khách.
Tạo 3-5 mẫu tin nhắn Zalo ngắn gọn (≤200 ký tự), dùng biến {{ten}} {{sdt}}, 
phù hợp với mục đích: "{userIntent}".
Tránh spam keyword. Trả JSON: [{ "name": "...", "messageText": "...", "imageKeyword": "..." }, ...]
```

**Fallback rule-based**: nếu AI fail → gợi ý 3 template cứng (mở bán, tái khách, giới thiệu dự án).

**Verify**:
- Click "AI gợi ý" → trong 5s hiện 3-5 mẫu → click chọn → fill form.
- Tắt AI trong settings → vẫn dùng được (fallback templates).

---

## Sprint 3 — AI Customer Intelligence (R6, R9) [7-10 ngày]

### R6. Lead Scoring Visualizer
**Files**:
- `frontend/src/views/reports/...` hoặc tab mới trong `ContactProfileView.vue`.
- `backend/src/modules/scoring/score-engine.ts` (đã có `scoreBreakdown` + `signals`).
- `backend/src/modules/contacts/cockpit-routes.ts` (đã có endpoint `/cockpit`).

**Tính năng**:
- Tab "Điểm & Tín hiệu" trong hồ sơ KH:
  - Điểm hiện tại + trendline 30 ngày (Chart.js sparkline).
  - Bảng "50 tín hiệu gần nhất": signal key, dimension, delta, timestamp, lý do.
  - So sánh với median KH cùng phân khúc.
- Hover tín hiệu → tooltip giải thích (vd: "Reply trong 5 phút → +5 điểm dimension response").

**Verify**:
- 1 KH có 30 signals → render < 500ms.
- Scroll timeline → mượt.

### R9. Churn Risk Detector
**Files**:
- `backend/src/modules/ai/prompts/churn-detector.ts` (mới).
- `backend/src/modules/ai/ai-service.ts` → thêm task type `churn_risk`.
- `frontend/src/views/reports/...` hoặc dashboard widget.

**Tính năng**:
- Cron nightly: với mỗi KH đang `engagementPattern: cooling/cold` trong 14 ngày → gọi AI đọc 10 tin gần nhất → trả `{ riskLevel: 'low'|'medium'|'high', reasons: [], suggestedAction: string }`.
- Lưu vào bảng `ChurnRiskScore` (mới).
- UI widget trên Dashboard: "Top 10 KH có nguy cơ rời bỏ" → click → mở hồ sơ.

**Fallback rule-based**: nếu AI fail → tính risk dựa trên:
- `daysSinceLastInteraction > 14` → medium
- `daysSinceLastInteraction > 30` → high
- sentiment trung bình < 0.3 → +1 mức.

**Verify**:
- Seed data 50 KH → chạy cron → check 5 KH high risk xuất hiện trên widget.
- Tắt AI → vẫn có risk score (rule-based).

---

## Sprint 4 — Visual Pipeline & Journey (R7-R8) [5-7 ngày]

### R7. Customer Journey Map
**Files**:
- `frontend/src/views/reports/.../JourneyReport.vue` (mới).
- `backend/src/modules/analytics/reports/customer-journey.ts` (mới).

**Tính năng**:
- Funnel visualization: First Contact → Friend Accept → First Reply → Quote → Appointment → Closed.
- Mỗi giai đoạn: số KH, tỉ lệ chuyển đổi, thời gian trung bình.
- Drill-down: click giai đoạn → danh sách KH đang ở đó.
- Heatmap rơi: giai đoạn nào KH rời nhiều nhất.

**Verify**:
- Có 100 KH trong seed → render đầy đủ funnel.
- Click giai đoạn "Quote → Appointment" → hiển thị 30 KH kẹt ở đây.

### R8. Sales Pipeline Kanban (Community)
**Files**:
- `frontend/src/views/reports/PipelineReport.vue` (đã có nhưng ẩn ở CE — show lại).
- Hoặc tạo `frontend/src/views/marketing/PipelineKanban.vue` mới.

**Tính năng**:
- Cột: Mới → Đang nuôi → Quan tâm → Lên lịch → Chốt → Chăm sóc sau.
- Card KH: tên, điểm, ngày tương tác cuối, owner.
- Kéo-thả card giữa các cột → update `Contact.status` + log activity.
- Filter theo owner, score range, source.

**Verify**:
- Kéo 1 card từ "Quan tâm" → "Lên lịch" → status update + activity log.
- Refresh trang → giữ nguyên trạng thái.

---

## Sprint 5 — AI Campaign Studio (R11) [7-10 ngày]

### R11. AI Campaign Studio
**Files**:
- `frontend/src/views/marketing/AiCampaignStudio.vue` (mới).
- `backend/src/modules/ai/prompts/campaign-planner.ts` (mới).
- `backend/src/modules/ai/ai-routes.ts` → endpoint `POST /ai/plan-campaign`.
- `backend/src/modules/campaign/campaign-service.ts` → thêm `createCampaignFromPlan`.

**Prompt sketch**:
```
Bạn là chuyên gia marketing BĐS. User mô tả mục tiêu chiến dịch: "{userGoal}".
Context: org có {totalContacts} KH, đang chăm {activeContacts}, trong đó:
- {hotCount} KH "nóng" (priorityScore > 70)
- {coolingCount} KH đang nguội
- {newCount} KH mới tuần này

Hãy đề xuất:
1. Audience: lọc KH nào (segments, scoring range, lý do)
2. Message: 3 mẫu tin (A/B/C variants) ≤200 ký tự, có {{ten}}
3. Schedule: lịch gửi tối ưu theo engagement pattern (giờ nào, ngày nào)
4. KPI dự kiến: expectedReplyRate, expectedReach
5. Risk: cảnh báo gì (vd: KH đang "cooling" có thể bị block)

Trả JSON strict.
```

**Fallback**: nếu AI fail → dùng rule:
- Mặc định segment: priorityScore > 50 + lastInteraction < 30 ngày.
- Mặc định lịch: hàng ngày 9h sáng T2-T6.
- Mặc định mẫu: lấy từ Khối nội dung có sẵn (random 3).

**Verify**:
- Nhập "Bán căn 3PN Q7 cho khách quan tâm tháng trước" → AI trả plan trong 8s.
- Click "Tạo campaign từ plan này" → tự tạo Broadcast job + Content blocks + Target list.

---

## Sprint 6 — Multi-channel Inbox (R10) [7-10 ngày]

### R10. Multi-channel Inbox
**Files**:
- `frontend/src/views/ChatView.vue` — thêm filter theo channel.
- `backend/src/modules/contacts/zinstant-proxy-routes.ts` (Facebook).
- `backend/src/modules/integrations/providers/facebook-messenger.ts` (mới).
- `backend/src/modules/integrations/providers/instagram-dm.ts` (mới).
- `backend/src/modules/integrations/providers/sms-brandname.ts` (mới).
- `prisma/schema.prisma` → thêm `channel` enum vào `Conversation`.

**Schema**:
```prisma
enum Channel {
  zalo
  telegram
  facebook
  instagram
  sms
}

model Conversation {
  // ... existing
  channel  Channel @default(zalo)
}
```

**Tính năng**:
- Sidebar chat có filter theo channel.
- Bubble tin nhắn hiển thị icon kênh (Zalo/Telegram/FB/IG/SMS).
- Unified inbox: 1 nơi quản lý mọi kênh.
- Mỗi kênh có adapter riêng (queue worker, send/receive).

**Verify**:
- Cấu hình FB Messenger + IG DM trong settings → 1 KH liên hệ qua FB → xuất hiện trong inbox.
- Reply từ inbox → tin gửi qua đúng kênh FB.

---

## Sprint 7 — Mobile PWA & Polish (R12 + final polish) [5-7 ngày]

### R12. Mobile PWA
**Files**:
- `frontend/vite.config.ts` → thêm `vite-plugin-pwa`.
- `frontend/public/manifest.json` (mới).
- `frontend/public/icons/...` (PWA icons).
- `frontend/src/main.ts` → register service worker.

**Tính năng**:
- Cài đặt như native app (Add to Home Screen).
- Push notification khi có tin mới (qua service worker + backend push).
- Offline cache cho chat list (đọc-only).

**Verify**:
- Mở trên Chrome mobile → popup "Add to Home Screen".
- Cài đặt → mở app → hoạt động offline (đọc), online (ghi).

### Polish tổng thể
- Mobile responsive toàn bộ Marketing views.
- Empty states thân thiện (illustration + CTA).
- Loading skeletons thay vì spinner.
- Dark mode hoàn chỉnh (đã có CSS variables).

---

## Sprint 8 — Hạ tầng nâng cao (R13+) [tuỳ chọn, 5-10 ngày]

### Webhook Outbound
- `backend/src/modules/integrations/webhooks/outbound-routes.ts` (mới).
- Trigger: contact.created, deal.closed, lead.score_changed, churn.high_risk.
- UI: Settings → Webhooks → CRUD endpoint.

### Audit Log nâng cao
- `frontend/src/views/settings/AuditLogView.vue` (đã có).
- Thêm filter (actor, action, entity, time range) + diff view.

### i18n
- Cài `vue-i18n`, dịch sang EN/ZH.
- File `frontend/src/i18n/vi.ts`, `en.ts`, `zh.ts`.

### Backup & Restore
- `backend/src/modules/admin/backup-routes.ts` (mới).
- UI: Settings → Backup → Export / Import.

---

## Tổng kết timeline

| Sprint | Đề xuất | Effort | Ngày |
|---|---|---|---|
| 0 | Chuẩn bị (provider + harness) | — | 0.5 |
| 1 | R1, R2, R3 — Khôi phục CSV + ListDetail | 3-5d | T+1 |
| 2 | R4, R5 — Broadcast A/B + AI Suggest | 5-7d | T+8 |
| 3 | R6, R9 — Scoring Visualizer + Churn | 7-10d | T+17 |
| 4 | R7, R8 — Journey Map + Pipeline Kanban | 5-7d | T+25 |
| 5 | R11 — AI Campaign Studio | 7-10d | T+33 |
| 6 | R10 — Multi-channel Inbox | 7-10d | T+42 |
| 7 | R12 — Mobile PWA + Polish | 5-7d | T+50 |
| 8 | Webhook/Audit/i18n/Backup | 5-10d | T+58 |

**Tổng ước tính**: ~58-66 ngày làm việc (1 dev fulltime) = ~3 tháng.

---

## Nguyên tắc triển khai

1. **Mỗi sprint kết thúc phải có demo được** trên bản Community.
2. **AI mới luôn có fallback rule-based** (đề xuất ngày 21/07).
3. **Reuse tối đa** infrastructure hiện có: `ai-service`, `provider-registry`, `scoring`, `engagement`, `broadcast`.
4. **Test**: unit test cho AI prompts (snapshot), e2e cho flow UI chính, manual cho UX.
5. **Performance budget**: mỗi trang render < 1s, AI call < 8s.
6. **Privacy**: AI không bao giờ đọc content nick Private (đã có gate ở `ai-routes.ts`).
7. **Tenant isolation**: mọi query mới phải scope theo `orgId` (đã có `tenant-guard`).

---

## Bước tiếp theo

Bạn vui lòng cho biết:
1. **Tên provider riêng** bạn muốn thêm (vd: `custom`, `zlocal`, `internal-llm`…)?
2. **Base URL + Model name** để tôi config chính xác?
3. **Bạn muốn bắt đầu sprint nào trước**? (Gợi ý: Sprint 0 → Sprint 1 → …).
4. **Có cần spec-first workflow** không? (Rule `00-spec-first-superpowers.mdc` yêu cầu spec user-confirmed trước khi code.)

Tôi sẽ đợi xác nhận trước khi bắt đầu code.
