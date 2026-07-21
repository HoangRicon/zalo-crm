// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * Unit test cho providers/custom.ts (Sprint 0, task 1.6).
 *
 * Verify:
 *  - baseUrl rỗng → throw với message rõ ràng
 *  - apiKey rỗng → throw
 *  - model rỗng → throw
 *  - baseUrl có trailing slash → strip trước khi append
 *  - Thành công: gọi đúng URL `${baseUrl}/v1/chat/completions` với Bearer auth
 *  - HTTP error từ provider → throw với status code
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWithCustom } from '../src/modules/ai/providers/custom.js';

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('generateWithCustom', () => {
  it('throws when baseUrl is empty', async () => {
    await expect(
      generateWithCustom('', 'sk-test', 'model-x', 'system', 'prompt'),
    ).rejects.toThrow('AI provider baseUrl not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when baseUrl is whitespace only', async () => {
    await expect(
      generateWithCustom('   ', 'sk-test', 'model-x', 'system', 'prompt'),
    ).rejects.toThrow('AI provider baseUrl not configured');
  });

  it('throws when apiKey is empty', async () => {
    await expect(
      generateWithCustom('https://example.com', '', 'model-x', 'system', 'prompt'),
    ).rejects.toThrow('AI provider key not configured');
  });

  it('throws when model is empty', async () => {
    await expect(
      generateWithCustom('https://example.com', 'sk-test', '', 'system', 'prompt'),
    ).rejects.toThrow('AI provider model not configured');
  });

  it('strips trailing slash before appending /v1/chat/completions', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] }),
    });
    await generateWithCustom('https://example.com/', 'sk-test', 'model-x', 'sys', 'pr');
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://example.com/v1/chat/completions');
  });

  it('strips multiple trailing slashes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] }),
    });
    await generateWithCustom('https://example.com///', 'sk-test', 'model-x', 'sys', 'pr');
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://example.com/v1/chat/completions');
  });

  it('sends Bearer auth + correct body shape', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await generateWithCustom('https://api.test', 'sk-abc', 'gpt-test', 'system prompt', 'user prompt');
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.test/v1/chat/completions');
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-abc');
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-test');
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
  });

  it('returns the trimmed text from the response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  trả lời tiếng Việt  ' } }] }),
    });
    const text = await generateWithCustom('https://api.test', 'sk-test', 'm', 's', 'p');
    // generateWithOpenaiCompat returns the trim() of the content
    expect(text).toBe('trả lời tiếng Việt');
  });

  it('throws with status code on HTTP error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'internal error' });
    await expect(
      generateWithCustom('https://api.test', 'sk-test', 'm', 's', 'p'),
    ).rejects.toThrow(/status 500/);
  });

  it('throws on empty content response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });
    await expect(
      generateWithCustom('https://api.test', 'sk-test', 'm', 's', 'p'),
    ).rejects.toThrow(/empty content/);
  });
});