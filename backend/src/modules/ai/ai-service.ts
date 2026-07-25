// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
import { prisma, tenantTransaction } from '../../shared/database/prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { getProviderConfig, getAvailableProviders, resolveProviderApiKey, getProviderBaseUrl } from './provider-registry.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenaiCompat } from './providers/openai-compat.js';
import { generateWithCustom } from './providers/custom.js';
import { buildReplyDraftPrompt } from './prompts/reply-draft.js';
import { buildSummaryPrompt } from './prompts/summary.js';
import { buildSentimentPrompt } from './prompts/sentiment.js';
import { parseAppointmentRuleBased } from './appointment-fallback-parser.js';

export type AiTaskType = 'reply_draft' | 'summary' | 'sentiment';

type MessageContext = { senderType: string; senderName: string | null; content: string | null; sentAt: Date };
type SentimentResult = { label: 'positive' | 'neutral' | 'negative'; confidence: number; reason: string };

function detectLanguage(_text: string): 'vi' | 'en' {
  // Luôn dùng tiếng Việt — các prompt đã được viết hoàn toàn bằng tiếng Việt
  return 'vi';
}

function escapeXmlBoundary(text: string): string {
  return text.replace(/<\/?conversation_context>/gi, '');
}

function buildConversationContext(messages: MessageContext[]) {
  return messages
    .map((msg) => {
      const author = msg.senderType === 'self' ? 'staff' : (msg.senderName || 'customer');
      const content = escapeXmlBoundary(msg.content || '(empty)');
      return `[${msg.sentAt.toISOString()}] ${author}: ${content}`;
    })
    .join('\n');
}

// M53 2026-05-30: exported để ai-virtual-chat-service reuse
export async function getProviderApiKey(orgId: string, provider: string) {
  /* Ưu tiên key per-org (UI, mã hoá) → legacy plain → env fallback. */
  return resolveProviderApiKey(orgId, provider);
}

/* Resolve model mặc định cho 1 provider từ env, theo thứ tự ưu tiên:
 *   1) config.aiDefaultModel                       (global — áp dụng mọi provider)
 *   2) config.customDefaultModel (CHỈ khi provider='custom') (per-provider fallback
 *      vì custom model thường khác hẳn model của vendor chuẩn)
 * Trả về '' nếu cả 2 đều rỗng → caller sẽ fail-fast ở providers/custom.ts
 * với error "AI provider model not configured". */
function resolveDefaultModel(provider: string): string {
  const globalDefault = config.aiDefaultModel?.trim();
  if (globalDefault) return globalDefault;
  if (provider === 'custom') return config.customDefaultModel?.trim() || '';
  return '';
}

export async function getAiConfig(orgId: string) {
  let aiConfig = await prisma.aiConfig.findUnique({ where: { orgId } });
  if (!aiConfig) {
    const provider = config.aiDefaultProvider;
    aiConfig = await prisma.aiConfig.create({
      data: { orgId, provider, model: resolveDefaultModel(provider), maxDaily: 500, enabled: true },
    });
  }
  const availableProviders = await getAvailableProviders(orgId);
  return { ...aiConfig, availableProviders };
}

export async function updateAiConfig(orgId: string, input: { provider?: string; model?: string; maxDaily?: number; enabled?: boolean }) {
  const provider = input.provider || config.aiDefaultProvider;
  return prisma.aiConfig.upsert({
    where: { orgId },
    create: {
      orgId,
      provider,
      model: input.model || resolveDefaultModel(provider),
      maxDaily: input.maxDaily ?? 500,
      enabled: input.enabled ?? true,
    },
    update: {
      provider: input.provider,
      model: input.model,
      maxDaily: input.maxDaily,
      enabled: input.enabled,
    },
  });
}

export async function getAiUsage(orgId: string) {
  const currentConfig = await getAiConfig(orgId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.aiSuggestion.count({ where: { orgId, createdAt: { gte: startOfDay } } });
  return {
    usedToday,
    maxDaily: currentConfig.maxDaily,
    remaining: Math.max(0, currentConfig.maxDaily - usedToday),
    enabled: currentConfig.enabled,
  };
}

async function loadConversation(conversationId: string, orgId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: {
      contact: { select: { fullName: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { sentAt: 'desc' },
        take: 40,
        select: { senderType: true, senderName: true, content: true, sentAt: true },
      },
    },
  });
  if (!conversation) throw new Error('Conversation not found');
  return { ...conversation, messages: [...conversation.messages].reverse() };
}

// M53 2026-05-30: exported để ai-virtual-chat-service reuse
export async function generateText(provider: string, apiKey: string, model: string, system: string, prompt: string, maxTokens?: number, baseUrlOverride?: string) {
  const providerDef = getProviderConfig(provider);
  const baseUrl = baseUrlOverride || providerDef?.baseUrl || '';

  if (provider === 'anthropic') return generateWithAnthropic(baseUrl, apiKey, model, system, prompt, maxTokens);
  if (provider === 'gemini') return generateWithGemini(baseUrl, apiKey, model, system, prompt, maxTokens);

  /* OpenAI, Qwen, Kimi all use OpenAI-compatible chat/completions API */
  if (provider === 'openai') return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt, maxTokens, 'max_completion_tokens');
  if (provider === 'qwen') return generateWithOpenaiCompat(`${baseUrl}/compatible-mode/v1/chat/completions`, apiKey, model, system, prompt, maxTokens);
  if (provider === 'kimi') return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt, maxTokens);

  // 2026-07-21: provider 'custom' — OpenAI-compat endpoint tự host (vLLM, Ollama, internal proxy...).
  // baseUrl append `/v1/chat/completions` nếu chưa có path; handler tự xử lý.
  if (provider === 'custom') return generateWithCustom(baseUrl, apiKey, model, system, prompt, maxTokens);

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function saveSuggestion(input: { orgId: string; conversationId: string | null; messageId?: string; type: AiTaskType; content: string; confidence: number }) {
  return prisma.aiSuggestion.create({
    data: {
      orgId: input.orgId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: input.type,
      content: input.content,
      confidence: input.confidence,
    },
  });
}

export async function generateAiOutput(input: { orgId: string; conversationId: string; type: AiTaskType; messageId?: string }) {
  const [currentConfig, conversation] = await Promise.all([
    getAiConfig(input.orgId),
    loadConversation(input.conversationId, input.orgId),
  ]);

  if (!currentConfig.enabled) throw new Error('AI is disabled for this organization');

  // Atomic quota check — count inside transaction to prevent TOCTOU race
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const withinQuota = await tenantTransaction(async (tx) => {
    const usedToday = await tx.aiSuggestion.count({ where: { orgId: input.orgId, createdAt: { gte: startOfDay } } });
    return usedToday < currentConfig.maxDaily;
  });
  if (!withinQuota) throw new Error('AI daily quota exceeded');

  const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
  if (!apiKey) throw new Error('AI provider key is not configured');

  const contextText = buildConversationContext(conversation.messages);
  const language = detectLanguage(contextText);
  const customerName = conversation.contact?.fullName || 'customer';

  // 2026-07-24: Knowledge Base injection (chỉ áp dụng cho reply_draft).
  // Lấy top-K chunks theo last 5 tin nhắn gần nhất (KH hỏi gì → retrieve theo câu hỏi đó).
  // Lỗi (chưa cấu hình embedding provider, hết quota embedding) → KHÔNG block reply_draft, fallback không có KB.
  const taskCfg = currentConfig.aiTaskConfig as { useKnowledgeBase?: boolean; kbTopK?: number } | null;
  const useKb = input.type === 'reply_draft' && (taskCfg?.useKnowledgeBase !== false);
  let kbBlock = '';
  let kbImageRefs: string[] = [];
  if (useKb) {
    try {
      const topK = Math.max(1, Math.min(8, taskCfg?.kbTopK ?? 4));
      const recentText = conversation.messages
        .slice(-5)
        .map((m) => m.content || '')
        .filter(Boolean)
        .join('\n')
        .slice(0, 1500);
      if (recentText.length >= 10) {
        const { retrieveTopK, formatKbContextBlock } = await import('../knowledge/knowledge-service.js');
        const top = await retrieveTopK(input.orgId, recentText, topK);
        if (top.length) {
          kbBlock = formatKbContextBlock(top);
          // Dedup image refs
          kbImageRefs = Array.from(new Set(top.flatMap((c) => c.mediaAssetIds)));
        }
      }
    } catch (kbErr) {
      // KB retrieval fail (chưa có OpenAI key cho embedding, network, ...) → KHÔNG block reply_draft.
      // Log warning để admin debug, FE vẫn nhận reply bình thường.
      logger.warn('[ai-reply-draft] KB inject skipped: %s', (kbErr as Error).message);
    }
  }

  const userPrompt = [
    `<conversation_context>`,
    `Customer: ${customerName}`,
    contextText,
    `</conversation_context>`,
    kbBlock ? `${kbBlock}` : '',
  ].filter(Boolean).join('\n');

  const system = input.type === 'reply_draft'
    ? buildReplyDraftPrompt(language)
    : input.type === 'summary'
      ? buildSummaryPrompt(language)
      : buildSentimentPrompt(language);

  const raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, system, userPrompt, undefined, await getProviderBaseUrl(input.orgId, currentConfig.provider));

  if (input.type === 'sentiment') {
    let parsed: SentimentResult;
    try {
      parsed = JSON.parse(raw) as SentimentResult;
    } catch {
      parsed = { label: 'neutral', confidence: 0.4, reason: raw };
    }
    const normalized = {
      label: ['positive', 'negative', 'neutral'].includes(parsed.label) ? parsed.label : 'neutral',
      confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.4,
      reason: parsed.reason || raw,
    };
    // Map label sang tiếng Việt nếu BE trả English
    if (normalized.label === 'positive') normalized.label = 'positive';
    else if (normalized.label === 'negative') normalized.label = 'negative';
    else normalized.label = 'neutral';
    await saveSuggestion({
      orgId: input.orgId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      type: 'sentiment',
      content: JSON.stringify(normalized),
      confidence: normalized.confidence,
    });
    return normalized;
  }

  const text = raw.trim();
  await saveSuggestion({
    orgId: input.orgId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    type: input.type,
    content: text,
    confidence: 0.8,
  });
  // 2026-07-24: trả về KB image refs để FE hiển thị "Ảnh liên quan" kèm gợi ý.
  const result: { content: string; confidence: number; kbImages?: string[]; kbUsed?: boolean } = { content: text, confidence: 0.8 };
  if (useKb && kbImageRefs.length) {
    result.kbImages = kbImageRefs;
    result.kbUsed = true;
  } else if (useKb) {
    result.kbUsed = false;
  }
  return result;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Parse a free-form note ("Thứ 6 gọi lại khách", "3 ngày nữa nhắn tin chốt giá")
 * into a structured appointment proposal. Returns null if AI can't find a clear
 * date/time intent — caller falls back to manual create.
 * ────────────────────────────────────────────────────────────────────────── */
export type ParsedAppointment = {
  date: string | null;       // YYYY-MM-DD
  time: string | null;       // HH:MM (24h)
  type: string | null;       // 'call' | 'message' | 'meeting' | 'follow_up' | null
  location: string | null;   // địa điểm gặp (nếu detect)
  summary: string;           // tiêu đề ngắn cho lịch hẹn
  hasIntent: boolean;        // true nếu phát hiện ý định lập lịch (kể cả thông tin chưa đủ)
  missingFields: string[];   // ['date','time','location'] — field nào AI thiếu, FE prompt user điền
  confidence: number;        // 0..1
  source?: 'ai' | 'fallback'; // 'ai'=Gemini OK, 'fallback'=rule-based (AI fail/quota)
};

export async function parseAppointmentFromText(input: { orgId: string; text: string; now?: Date }): Promise<ParsedAppointment & { source?: 'ai' | 'fallback' } | null> {
  const now = input.now || new Date();
  const currentConfig = await getAiConfig(input.orgId);

  // ── Fallback rule-based parser luôn chạy trước/song song để có kết quả nếu AI fail.
  //    Result được trả nếu AI throw (429 quota, timeout, network). source='fallback'
  //    để FE hiển thị hint "AI hết quota — đã dùng rule-based".
  const fallback = parseAppointmentRuleBased(input.text, now);

  if (!currentConfig.enabled) {
    // AI tắt → chỉ trả fallback nếu có intent
    return fallback.hasIntent ? { ...fallback, source: 'fallback' } : null;
  }
  const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
  if (!apiKey) {
    logger.warn('[ai-parse] No API key — using rule-based fallback');
    return fallback.hasIntent ? { ...fallback, source: 'fallback' } : null;
  }
  const today = now.toISOString().slice(0, 10);
  const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][now.getDay()];

  const system = [
    'You parse a Vietnamese CRM note into an appointment proposal. Return STRICT JSON ONLY, no prose.',
    'Output schema:',
    '{ "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "type": "call"|"message"|"meeting"|"follow_up"|null, "location": string|null, "summary": string, "hasIntent": boolean, "missingFields": string[], "confidence": number_0_to_1 }',
    '',
    'PHÁT HIỆN Ý ĐỊNH RỘNG (hasIntent=true):',
    '- BẤT KỲ từ khoá thời gian: "thứ X", "ngày N", "DD/MM", "mai", "kia", "tuần sau", "tháng sau", "N ngày nữa", "sáng/chiều/tối", "lúc HH giờ", "trước/sau Tết", "đầu/giữa/cuối tháng", "đầu/cuối tuần"',
    '- HOẶC từ khoá hành động hẹn: "gọi lại", "nhắn lại", "gặp", "ghé", "đến", "chốt", "ký", "xem nhà", "qua văn phòng", "tới chỗ"',
    '- HOẶC từ khoá địa điểm: "tại [địa điểm]", "ở [địa điểm]", "[tên building/đường/quận]", "VP", "showroom", "căn hộ", "dự án [name]"',
    '- HOẶC từ khoá quan tâm cần theo dõi: "follow up", "theo dõi", "check lại", "phải gọi"',
    '→ Có 1 trong các nhóm trên → hasIntent=true. Trả các field detect được, field nào không có → null + thêm vào missingFields.',
    '',
    `Hôm nay là ${today} (${weekday}). Tính ngày tuyệt đối cho "thứ X" (sang tuần tới nếu thứ đã qua), "N ngày nữa", "mai"=ngày mai, "kia"=ngày kia.`,
    '"sáng"=09:00, "chiều"=14:00, "tối"=19:00. "trưa"=12:00.',
    'type rules: "gọi"/"call"→call, "nhắn"→message, "gặp"/"ghé"/"đến"/"xem nhà"→meeting, fallback→follow_up.',
    'location: trích nguyên văn cụm địa điểm nếu có. KHÔNG có → null + thêm "location" vào missingFields.',
    'summary: 1 câu ≤120 ký tự mô tả việc cần làm.',
    '',
    'missingFields: liệt kê field thiếu trong ["date","time","location"] để FE prompt user điền tiếp.',
    'confidence: > 0.7 khi date+time+intent rõ, 0.4-0.7 khi 1-2 field có, < 0.4 khi mơ hồ.',
    '',
    'CHỈ trả hasIntent=false khi note hoàn toàn KHÔNG liên quan hẹn (vd "khách thích nhà 3pn", "đã gửi báo giá").',
    'Khi hasIntent=false → tất cả field null/empty array, confidence=0.',
  ].join('\n');

  const userPrompt = `<note>\n${escapeXmlBoundary(input.text)}\n</note>\nReturn JSON only.`;

  let raw: string;
  try {
    raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, system, userPrompt, undefined, await getProviderBaseUrl(input.orgId, currentConfig.provider));
  } catch (err: unknown) {
    // AI fail (429 quota, timeout, network) → fallback to rule-based parser
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429');
    if (fallback.hasIntent) {
      logger.warn(`[ai-parse] AI failed (${is429 ? 'quota/rate-limit 429' : msg}) — using rule-based fallback`);
      return { ...fallback, source: 'fallback' };
    }
    // Không fallback được nữa → rethrow để FE biết là AI fail
    throw new Error(is429 ? 'AI hết quota (429) — vui lòng đợi reset hoặc đổi provider' : msg);
  }

  // Strip code fences if model wrapped JSON in ```json ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: Partial<ParsedAppointment> & { hasIntent?: boolean; missingFields?: string[]; location?: string | null };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // AI trả response không parse được → fallback
    if (fallback.hasIntent) {
      logger.warn('[ai-parse] AI returned unparseable JSON — using rule-based fallback');
      return { ...fallback, source: 'fallback' };
    }
    return null;
  }

  const hasIntent = !!parsed.hasIntent;
  if (!hasIntent) {
    // AI says no intent — nhưng rule-based có thể detect ra → ưu tiên fallback nếu nó tự tin
    if (fallback.hasIntent && fallback.confidence >= 0.5) {
      logger.info('[ai-parse] AI says no intent but rule-based detected → using fallback');
      return { ...fallback, source: 'fallback' };
    }
    return {
      date: null, time: null, type: null, location: null,
      summary: '', hasIntent: false, missingFields: [], confidence: 0,
    };
  }

  const confidence = Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence as number)) : 0.4;
  const validType = parsed.type && ['call', 'message', 'meeting', 'follow_up'].includes(parsed.type) ? parsed.type : null;
  const dateOk = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);
  const timeOk = parsed.time && /^\d{2}:\d{2}$/.test(parsed.time);
  const location = parsed.location ? String(parsed.location).slice(0, 200) : null;

  const missing: string[] = Array.isArray(parsed.missingFields) ? parsed.missingFields.filter((f: string) => ['date', 'time', 'location'].includes(f)) : [];
  // Sanity: đảm bảo missing đúng với data
  if (!dateOk && !missing.includes('date')) missing.push('date');
  if (!timeOk && !missing.includes('time')) missing.push('time');
  if (!location && !missing.includes('location')) missing.push('location');

  return {
    date: dateOk ? parsed.date! : null,
    time: timeOk ? parsed.time! : null,
    type: validType,
    location,
    summary: (parsed.summary || '').slice(0, 200),
    hasIntent: true,
    missingFields: missing,
    confidence,
    source: 'ai',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * AI Format Rich Text (2026-05-21) — anh paste 1 đoạn raw text (vd giới thiệu
 * dự án bất động sản) → AI return {text, styles[]} format Zalo (bold/italic/
 * color/size). Sale chỉ việc bấm gửi → KH nhận tin sinh động.
 * ────────────────────────────────────────────────────────────────────────── */
export interface ZaloRichStyle { st: string; start: number; len: number }
export interface AiFormatResult { text: string; styles: ZaloRichStyle[]; source: 'ai' | 'fallback' }

// 2026-05-21 v4 fix: switch từ offset-based sang phrase-based. AI bị off-by-one khi
// đếm character với tiếng Việt diacritics + bullets. Format mới: AI trả chuỗi cần
// highlight, BE tự indexOf để tính offset chính xác → robust 100%.
const AI_FORMAT_SYSTEM_PROMPT = `Bạn là chuyên gia format tin nhắn bán hàng tiếng Việt cho Zalo. Nhận 1 đoạn text → trả JSON {"ranges": [...]} liệt kê các chuỗi cần highlight.

OUTPUT SCHEMA:
{
  "ranges": [
    {"phrase": "chuỗi cần highlight", "styles": ["b", "c_db342e"]},
    ...
  ]
}

QUY TẮC:
1. "phrase" PHẢI là chuỗi GIỐNG NGUYÊN VĂN xuất hiện trong input (case-sensitive, đầy đủ dấu tiếng Việt). KHÔNG sửa, KHÔNG bỏ ký tự, KHÔNG thêm khoảng trắng thừa.
2. "styles" là array các style code áp cho phrase đó.
3. Mỗi phrase chỉ apply 1 lần (lần xuất hiện đầu tiên trong text). Nếu cần highlight 2 chỗ giống nhau → list 2 lần.
4. KHÔNG wrap JSON trong markdown. Output JSON thuần.

STYLE CODES:
- "b" = đậm | "i" = nghiêng | "u" = gạch chân | "s" = gạch ngang
- "c_db342e" = đỏ | "c_f27806" = cam | "c_15a85f" = xanh lá | "c_2962ff" = xanh dương

NGUYÊN TẮC FORMAT (chọn lọc, không bôi quá nhiều):
- Tên sản phẩm / dòng đầu nổi bật → ["b", "c_db342e"]
- Số tiền / % giảm / giá → ["b", "c_db342e"]
- Địa chỉ / vị trí → ["b", "c_f27806"]
- Thời gian / deadline / khoảng cách phút → ["b", "c_db342e"]
- USP / lợi ích chính → ["b", "c_15a85f"]
- SĐT / hotline → ["b", "c_2962ff"]
- Highlight quan trọng KHÁC → "b" only

MAX 15 ranges per response. Chọn lọc highlight quan trọng nhất. KHÔNG bôi bullet "- " / "+ ".

VÍ DỤ INPUT:
"- Dự án Sunshine City tọa lạc tại Q.7\\n- Giá từ 2.5 tỷ (giảm 200tr)\\n- Hotline: 0901-123-456"

VÍ DỤ OUTPUT:
{"ranges":[
  {"phrase":"Sunshine City","styles":["b","c_db342e"]},
  {"phrase":"Q.7","styles":["b","c_f27806"]},
  {"phrase":"2.5 tỷ","styles":["b","c_db342e"]},
  {"phrase":"giảm 200tr","styles":["b","c_db342e"]},
  {"phrase":"0901-123-456","styles":["b","c_2962ff"]}
]}`;

function isValidStyleCode(st: string): boolean {
  return /^(b|i|u|s|c_[0-9a-fA-F]{6}|f_\d{1,3}|lst_[12])$/.test(st);
}

/**
 * 2026-05-21 v4: Convert AI response ranges (phrase-based) → Zalo styles (offset-based).
 * Robust với Vietnamese diacritics — KHÔNG dùng AI offset, dùng JS String.indexOf chuẩn.
 *
 * AI return: [{phrase: "Sunshine City", styles: ["b", "c_db342e"]}, ...]
 * Convert: text.indexOf(phrase) → start. phrase.length → len.
 *
 * Edge cases:
 * - phrase không tìm thấy trong text → bỏ qua (AI hallucinate phrase không tồn tại)
 * - Cùng phrase xuất hiện 2 lần trong AI list → highlight 2 chỗ (first + next after first)
 */
function rangesToStyles(text: string, rangesRaw: unknown): ZaloRichStyle[] {
  if (!Array.isArray(rangesRaw)) return [];
  const styles: ZaloRichStyle[] = [];
  // Track lần xuất hiện đã dùng để hỗ trợ phrase duplicate (highlight 2 chỗ).
  const usedOffsets = new Map<string, number>(); // phrase → next searchFrom

  for (const r of rangesRaw) {
    if (!r || typeof r !== 'object') continue;
    const phrase = String((r as { phrase: unknown }).phrase || '').trim();
    const styleCodes = (r as { styles: unknown }).styles;
    if (!phrase || !Array.isArray(styleCodes)) continue;

    const searchFrom = usedOffsets.get(phrase) ?? 0;
    const idx = text.indexOf(phrase, searchFrom);
    if (idx < 0) continue; // phrase không tồn tại trong text → skip (AI hallucinated)
    usedOffsets.set(phrase, idx + phrase.length); // lần sau search sau range này

    const len = phrase.length;
    for (const code of styleCodes) {
      const st = String(code || '');
      if (!isValidStyleCode(st)) continue;
      styles.push({ st, start: idx, len });
    }
  }
  return styles;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sales-to-sales handoff message (2026-05-22 v2) — anh chốt template cứng
 * cho tab "🎯 CRM" widget "Đồng đội cùng chăm KH". Khi sale A click "AI nhắn
 * sale B phối hợp" → assemble tin nội bộ theo template KHÔNG dùng AI (tránh
 * bug AI fail lần 1, predictable output, không tốn quota).
 *
 * Template anh cho (2026-05-22):
 *   "Anh/Chị {toSaleName} ơi, KH {khName} em đang chăm đã ở trạng thái
 *    {status} và tương tác được Nhiệt {priorityScore}, điểm {leadScore} rồi.
 *    [Có lịch hẹn {appt}] Em thấy KH này có tương tác với Anh/Chị ngày gần
 *    nhất là {lastInteractionWithTarget}, Anh/Chị review lại KH này để mình
 *    cùng chăm tìm phương án chuyển đổi nhé."
 * ────────────────────────────────────────────────────────────────────────── */
export type SalesHandoffInput = {
  orgId: string;
  fromSaleName: string;
  toSaleName: string;
  contact: {
    displayName: string;
    phone?: string | null;
    statusLabel?: string | null;
    priorityScore?: number | null;
    leadScore?: number | null;
    engagementPattern?: string | null;
    nextAppointmentAt?: Date | null;
    nextAppointmentLocation?: string | null;
  };
  targetActivity?: {
    lastInboundAt?: Date | null;     // KH gửi tin cuối cho nick của target sale
    lastOutboundAt?: Date | null;    // Target sale gửi tin cuối cho KH
    lastInteractionAt?: Date | null; // Tổng quát (max(inbound, outbound))
    totalInbound?: number;
    totalOutbound?: number;
  };
};

export type SalesHandoffResult = { content: string; source: 'template' };

function formatVnDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function relativeVnDays(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(diffMs / 3600000));
    return `${hours} giờ trước`;
  }
  if (days === 1) return 'hôm qua';
  return `${days} ngày trước`;
}

function patternLabel(p?: string | null): string {
  switch (p) {
    case 'hot': return 'nóng';
    case 'champion': return 'champion';
    case 'stable': return 'ổn định';
    case 'cooling': return 'đang nguội';
    case 'cold': return 'lạnh';
    case 'noise': return 'chưa đủ data';
    default: return '';
  }
}

export function aiGenerateSalesHandoffMessage(input: SalesHandoffInput): SalesHandoffResult {
  const t = input.targetActivity || {};

  // Trạng thái: statusLabel (CRM status) hoặc engagementPattern
  const statusText = input.contact.statusLabel?.trim()
    || patternLabel(input.contact.engagementPattern)
    || 'đang chăm';

  // Số liệu Nhiệt + Điểm — chỉ thêm nếu có
  const numBits: string[] = [];
  if (input.contact.priorityScore != null) numBits.push(`Nhiệt ${input.contact.priorityScore}`);
  if (input.contact.leadScore != null) numBits.push(`điểm ${input.contact.leadScore}`);
  const numText = numBits.length ? ` và tương tác được ${numBits.join(', ')}` : '';

  // Lịch hẹn (nếu có)
  let apptText = '';
  if (input.contact.nextAppointmentAt) {
    const at = formatVnDateTime(input.contact.nextAppointmentAt);
    const loc = input.contact.nextAppointmentLocation ? ` tại ${input.contact.nextAppointmentLocation}` : '';
    apptText = ` KH có lịch hẹn vào ${at}${loc}.`;
  }

  // Lần tương tác gần nhất giữa target sale × KH
  // Ưu tiên lastInteractionAt → lastInboundAt → lastOutboundAt
  const lastTouch = t.lastInteractionAt || t.lastInboundAt || t.lastOutboundAt;
  let touchText = '';
  if (lastTouch) {
    touchText = `Em thấy KH này có tương tác với Anh/Chị ngày gần nhất là ${relativeVnDays(lastTouch)}, `;
  } else {
    touchText = `Em thấy KH này chưa có nhiều tương tác với Anh/Chị, `;
  }

  const content = [
    `Anh/Chị ${input.toSaleName} ơi, `,
    `KH ${input.contact.displayName} em đang chăm đã ở trạng thái ${statusText}${numText} rồi.`,
    apptText,
    ` ${touchText}`,
    `Anh/Chị review lại KH này để mình cùng chăm tìm phương án chuyển đổi nhé.`,
  ].join('').replace(/\s+/g, ' ').trim();

  // Save vào aiSuggestion để track (best-effort, nullable conversationId 2026-05-28)
  saveSuggestion({
    orgId: input.orgId,
    conversationId: null,
    type: 'reply_draft',
    content: JSON.stringify({ kind: 'sales_handoff', content }),
    confidence: 1.0,
  }).catch(() => {});

  return { content, source: 'template' };
}

export async function aiFormatRichText(input: { orgId: string; rawText: string }): Promise<AiFormatResult> {
  const text = (input.rawText || '').toString();
  if (!text.trim()) return { text, styles: [], source: 'fallback' };

  const currentConfig = await getAiConfig(input.orgId);
  if (!currentConfig.enabled) return { text, styles: [], source: 'fallback' };

  // Quota check (cùng counter với các AI task khác)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.aiSuggestion.count({ where: { orgId: input.orgId, createdAt: { gte: startOfDay } } });
  if (usedToday >= currentConfig.maxDaily) throw new Error('AI daily quota exceeded');

  const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
  if (!apiKey) return { text, styles: [], source: 'fallback' };

  try {
    // 2026-05-21 fix: cap đủ cho JSON output dài (text + nhiều style overlap per range).
    // Test với đoạn dự án 800 chars input → Gemini muốn trả ~7900 chars JSON ≈ 5000 tokens.
    // Set 8000 = sát limit Gemini 2.5 Flash (8192) + buffer. Nếu vẫn cap → cần shrink prompt.
    const raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, AI_FORMAT_SYSTEM_PROMPT, text, 8000, await getProviderBaseUrl(input.orgId, currentConfig.provider));

    let parsed: { ranges?: unknown } | null = null;
    try {
      // Strip robust: bỏ ```json/```js/``` wrapper + BOM + leading text trước `{`.
      let cleaned = raw.replace(/^﻿/, '').trim();
      cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      if (!cleaned.startsWith('{')) {
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
      }
      parsed = JSON.parse(cleaned);
    } catch (e) {
      logger.warn(`[ai-format-rich] JSON parse fail (len=${raw.length}): ${raw.slice(0, 300)}... [end:${raw.slice(-100)}]`);
      return { text, styles: [], source: 'fallback' };
    }
    // v4: phrase-based → BE tự indexOf → offsets chính xác 100%
    const styles = rangesToStyles(text, parsed?.ranges);

    // Save vào aiSuggestion để track quota (nullable conversationId 2026-05-28)
    await saveSuggestion({
      orgId: input.orgId,
      conversationId: null,               // format-rich không gắn vào conv cụ thể
      type: 'reply_draft',                // reuse type để tránh schema migration
      content: JSON.stringify({ kind: 'format_rich', styles }),
      confidence: 0.85,
    }).catch(() => {});

    return { text, styles, source: 'ai' };
  } catch (err) {
    logger.warn('[ai-format-rich] AI call failed:', err);
    return { text, styles: [], source: 'fallback' };
  }
}

// ── Sprint 2 R5 (2026-07-21): AI suggest content blocks ────────────────────
// Sprint 3 R9: AI churn risk scoring

import { buildContentBlockSuggestPrompt, FALLBACK_CONTENT_BLOCKS } from './prompts/content-block-suggest.js';
import { buildChurnDetectorPrompt, ruleBasedChurn } from './prompts/churn-detector.js';
// Sprint 5 R11 2026-07-21: Campaign planner
import { buildCampaignPlannerPrompt, ruleBasedCampaignPlan, type CampaignPlan } from './prompts/campaign-planner.js';
import { computeNextRunAt } from '../broadcast/broadcast-service.js';

export interface ContentBlockSuggestion {
  name: string;
  messageText: string;
  imageKeyword?: string;
}

/**
 * Gợi ý 3-5 biến thể tin nhắn cho Content Block.
 * - Timeout 8s (race Promise).
 * - AI fail / parse fail / JSON lỗi → trả 3 fallback templates.
 * - Quota tracking: chỉ tăng khi source='ai'.
 */
export async function suggestContentBlocks(input: {
  orgId: string;
  userIntent: string;
  count?: number;
}): Promise<{ suggestions: ContentBlockSuggestion[]; source: 'ai' | 'fallback' }> {
  const cfg = await getAiConfig(input.orgId);
  if (!cfg.enabled) {
    return { suggestions: FALLBACK_CONTENT_BLOCKS, source: 'fallback' };
  }
  const { system, user } = buildContentBlockSuggestPrompt({ userIntent: input.userIntent, count: input.count });
  const apiKey = await resolveProviderApiKey(input.orgId, cfg.provider);
  const baseUrl = await getProviderBaseUrl(input.orgId, cfg.provider);

  try {
    const raw = await Promise.race([
      generateText(cfg.provider, apiKey, cfg.model, system, user, 800, baseUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout_8s')), 8000)),
    ]);

    // Parse JSON robust
    let cleaned = raw.replace(/^﻿/, '').trim();
    cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!cleaned.startsWith('[')) {
      const first = cleaned.indexOf('[');
      if (first >= 0) cleaned = cleaned.slice(first);
    }
    const parsed = JSON.parse(cleaned) as ContentBlockSuggestion[];
    // Validate
    const valid = parsed
      .filter((s) => s?.messageText && s.messageText.length <= 200 && s.messageText.includes('{{ten}}'))
      .slice(0, 5);
    if (!valid.length) throw new Error('no_valid_suggestions');

    // Track quota
    await saveSuggestion({
      orgId: input.orgId,
      conversationId: null,
      type: 'reply_draft',
      content: JSON.stringify({ kind: 'content_block_suggest', count: valid.length }),
      confidence: 0.85,
    }).catch(() => {});

    return { suggestions: valid, source: 'ai' };
  } catch (err) {
    logger.warn('[ai-suggest-content-blocks] AI failed:', err);
    return { suggestions: FALLBACK_CONTENT_BLOCKS, source: 'fallback' };
  }
}

export interface ChurnScoreResult {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  suggestedAction: string;
  source: 'ai' | 'rule_based';
}

/**
 * Đánh giá churn risk cho 1 contact dựa trên 10 tin gần nhất.
 * - Timeout 10s.
 * - AI fail → rule-based fallback (dựa trên lastInteractionDays + sentiment).
 * - Quota tracking: chỉ tăng khi source='ai'.
 */
export async function scoreChurnForContact(input: {
  orgId: string;
  messages: Array<{ sender: 'self' | 'contact'; text: string; sentAt: string }>;
  lastInteractionDays: number;
  avgSentiment?: number | null;
}): Promise<ChurnScoreResult> {
  const cfg = await getAiConfig(input.orgId);
  // Nếu AI tắt hoặc quá ít message cho AI (>= 2 mới gọi) → rule-based
  const useAi = cfg.enabled && input.messages.length >= 2;
  if (!useAi) {
    return { ...ruleBasedChurn({ lastInteractionDays: input.lastInteractionDays, avgSentiment: input.avgSentiment }), source: 'rule_based' };
  }

  const { system, user } = buildChurnDetectorPrompt({
    messages: input.messages,
    lastInteractionDays: input.lastInteractionDays,
  });
  const apiKey = await resolveProviderApiKey(input.orgId, cfg.provider);
  const baseUrl = await getProviderBaseUrl(input.orgId, cfg.provider);

  try {
    const raw = await Promise.race([
      generateText(cfg.provider, apiKey, cfg.model, system, user, 400, baseUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout_10s')), 10000)),
    ]);
    let cleaned = raw.replace(/^﻿/, '').trim();
    cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!cleaned.startsWith('{')) {
      const first = cleaned.indexOf('{');
      if (first >= 0) cleaned = cleaned.slice(first);
    }
    const parsed = JSON.parse(cleaned) as { riskLevel: string; reasons: string[]; suggestedAction: string };
    if (!['low', 'medium', 'high'].includes(parsed.riskLevel)) throw new Error('invalid_risk_level');
    if (!Array.isArray(parsed.reasons)) parsed.reasons = [];
    if (typeof parsed.suggestedAction !== 'string') parsed.suggestedAction = '';

    await saveSuggestion({
      orgId: input.orgId,
      conversationId: null,
      type: 'reply_draft',
      content: JSON.stringify({ kind: 'churn_risk', level: parsed.riskLevel }),
      confidence: 0.75,
    }).catch(() => {});

    return { ...parsed, source: 'ai' } as ChurnScoreResult;
  } catch (err) {
    logger.warn('[ai-churn] AI failed:', err);
    return { ...ruleBasedChurn({ lastInteractionDays: input.lastInteractionDays, avgSentiment: input.avgSentiment }), source: 'rule_based' };
  }
}

/**
 * Sprint 5 R11 2026-07-21: AI sinh plan campaign.
 * Returns { plan, planId, source } — planId dùng để apply sau.
 */
export async function planCampaign(input: {
  orgId: string;
  userGoal: string;
  userId: string;
}): Promise<{ plan: CampaignPlan; planId: string; source: 'ai' | 'rule_based' }> {
  const orgStats = await getOrgStatsForPlanning(input.orgId);
  const cfg = await getAiConfig(input.orgId);
  const ruleBasedFallback = ruleBasedCampaignPlan({ userGoal: input.userGoal, orgStats });

  if (!cfg.enabled) {
    const planRow = await persistCampaignPlan(input, ruleBasedFallback, 'rule_based');
    return { plan: ruleBasedFallback, planId: planRow.id, source: 'rule_based' };
  }

  const { system, user } = buildCampaignPlannerPrompt({ userGoal: input.userGoal, orgStats });
  const apiKey = await resolveProviderApiKey(input.orgId, cfg.provider);
  const baseUrl = await getProviderBaseUrl(input.orgId, cfg.provider);

  try {
    const raw = await Promise.race([
      generateText(cfg.provider, apiKey, cfg.model, system, user, 1200, baseUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout_8s')), 8000)),
    ]);
    let cleaned = raw.replace(/^﻿/, '').trim();
    cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!cleaned.startsWith('{')) {
      const first = cleaned.indexOf('{');
      if (first >= 0) cleaned = cleaned.slice(first);
    }
    const parsed = JSON.parse(cleaned) as CampaignPlan;
    // Validate cơ bản
    if (!parsed.audience?.segments || !Array.isArray(parsed.messages) || !parsed.schedule?.sendAtISO) {
      throw new Error('invalid_plan_structure');
    }
    if (parsed.audience.estimatedReach > orgStats.totalContacts) {
      parsed.audience.estimatedReach = orgStats.totalContacts;
    }
    const planRow = await persistCampaignPlan(input, parsed, 'ai');
    return { plan: parsed, planId: planRow.id, source: 'ai' };
  } catch (err) {
    logger.warn('[ai-campaign-planner] AI failed:', err);
    const planRow = await persistCampaignPlan(input, ruleBasedFallback, 'rule_based');
    return { plan: ruleBasedFallback, planId: planRow.id, source: 'rule_based' };
  }
}

async function persistCampaignPlan(input: { orgId: string; userId: string; userGoal: string }, plan: CampaignPlan, source: string) {
  return prisma.campaignPlan.create({
    data: {
      orgId: input.orgId,
      createdById: input.userId,
      userGoal: input.userGoal,
      plan: plan as unknown as object,
      source,
    },
  });
}

async function getOrgStatsForPlanning(orgId: string): Promise<{ totalContacts: number; activeContacts: number; hotCount: number; coolingCount: number }> {
  const [total, active, hot, cooling] = await Promise.all([
    prisma.contact.count({ where: { orgId } }),
    prisma.contact.count({ where: { orgId, lastInteractionAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.contact.count({ where: { orgId, priorityScore: { gt: 70 } } }),
    prisma.contact.count({ where: { orgId, engagementPattern: { in: ['cooling', 'cold'] } } }),
  ]);
  return { totalContacts: total, activeContacts: active, hotCount: hot, coolingCount: cooling };
}

/**
 * Apply CampaignPlan → tạo BroadcastJob (1 lần gửi).
 */
export async function applyCampaignPlan(input: { orgId: string; planId: string; userId: string }): Promise<{ jobId: string }> {
  const planRow = await prisma.campaignPlan.findFirst({
    where: { id: input.planId, orgId: input.orgId },
  });
  if (!planRow) throw new Error('plan_not_found');
  if (planRow.appliedToJobId) {
    return { jobId: planRow.appliedToJobId };
  }
  const plan = planRow.plan as unknown as CampaignPlan;
  if (!plan.messages?.length) throw new Error('plan_no_messages');

  // Tìm nick đầu tiên của org để gắn job (admin tự chỉnh sau)
  const nick = await prisma.zaloAccount.findFirst({
    where: { orgId: input.orgId, archivedAt: null },
    select: { id: true },
  });
  if (!nick) throw new Error('no_active_nick');

  const firstMsg = plan.messages[0];
  const sendAt = new Date(plan.schedule.sendAtISO);

  const job = await prisma.broadcastJob.create({
    data: {
      orgId: input.orgId,
      createdById: input.userId,
      name: `AI Plan: ${planRow.userGoal.slice(0, 30)}`,
      sourceType: 'friends', // AI Plan default — user chỉnh sau
      zaloAccountId: nick.id,
      messageText: firstMsg.text,
      scheduleType: 'once',
      scheduledAt: sendAt,
      timeOfDay: null,
      daysOfWeek: [],
      nextRunAt: computeNextRunAt({ scheduleType: 'once', scheduledAt: sendAt, timeOfDay: null, daysOfWeek: [] }),
    },
  });
  await prisma.campaignPlan.update({
    where: { id: planRow.id },
    data: { appliedToJobId: job.id },
  });
  return { jobId: job.id };
}
