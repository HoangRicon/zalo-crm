// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * providers/custom.ts — Handler cho AI provider 'custom'.
 *
 * Mặc định dùng OpenAI-compatible API (`/v1/chat/completions`). Phù hợp với:
 *   - vLLM, LM Studio, llama.cpp server
 *   - Ollama (qua OpenAI-compat mode)
 *   - Internal proxy (vd LiteLLM)
 *   - Bất kỳ endpoint nào theo chuẩn OpenAI
 *
 * Nếu cần chuẩn khác (vd Anthropic-compatible), viết handler riêng tương tự anthropic.ts.
 *
 * baseUrl phải KHÔNG kèm trailing slash và KHÔNG kèm path `/v1/chat/completions`
 * (function sẽ append).
 */
import { generateWithOpenaiCompat } from './openai-compat.js';

export async function generateWithCustom(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens = 600,
): Promise<string> {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('AI provider baseUrl not configured');
  }
  if (!apiKey) {
    throw new Error('AI provider key not configured');
  }
  if (!model) {
    throw new Error('AI provider model not configured');
  }
  return generateWithOpenaiCompat(
    `${trimmed}/v1/chat/completions`,
    apiKey,
    model,
    system,
    prompt,
    maxTokens,
  );
}