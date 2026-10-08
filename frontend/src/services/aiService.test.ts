import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiError,
  adminSessionKey,
  aiRoot,
  aiModelKey,
  aiSessionKey,
  canOffer,
  createAiClient,
  type AiStatus,
} from './aiService';

const BASE = 'https://api.example.com/api/v1';
const ROOT = 'https://api.example.com/api/v1';

const STATUS: AiStatus = {
  enabled: true,
  access: 'code',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 5, perDay: 100 },
};

const ANSWER = {
  model: 'gemini-2.5-pro',
  text: '**Hi**',
  ms: 1234,
  promptTokens: 7,
  outputTokens: 42,
  finishReason: 'STOP',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const mockFetch = (impl: () => Promise<Response>) => {
  // Typed as fetch so `mock.calls` carries fetch's (input, init) tuple.
  const spy = vi.fn<typeof fetch>(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
};

/** The headers of the n-th fetch call, as a plain object. */
const headersOf = (spy: ReturnType<typeof mockFetch>, call = 0) =>
  (spy.mock.calls[call][1]?.headers ?? {}) as Record<string, string>;

const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiRoot', () => {
  it('keeps an absolute base, without trailing slashes', () => {
    expect(aiRoot('https://api.example.com/api/v1/')).toBe(ROOT);
  });

  it('resolves a prefix or an empty base against the page', () => {
    expect(aiRoot('/api/v1')).toBe(`${window.location.origin}/api/v1`);
    expect(aiRoot('')).toBe(window.location.origin);
  });
});

describe('identity headers', () => {
  it('sends the admin session the Manage page stored for this API root', () => {
    store(adminSessionKey(ROOT), 'admin-token');
    expect(createAiClient(BASE).identityHeaders()).toEqual({ 'X-Admin-Session': 'admin-token' });
  });

  it('never sends a token filed under another API root', () => {
    store(adminSessionKey('https://other.example.com'), 'admin-token');
    store(aiSessionKey('https://other.example.com'), { token: 'ai-token', het: 0 });
    expect(createAiClient(BASE).identityHeaders()).toEqual({});
  });

  it('ignores an admin token that is not a non-empty string', () => {
    store(adminSessionKey(ROOT), '');
    expect(createAiClient(BASE).identityHeaders()).toEqual({});
    store(adminSessionKey(ROOT), { token: 'x' });
    expect(createAiClient(BASE).identityHeaders()).toEqual({});
  });

  it('sends an AI session with no expiry', () => {
    store(aiSessionKey(ROOT), { token: 'ai-token', het: 0 });
    expect(createAiClient(BASE).identityHeaders()).toEqual({ 'X-AI-Session': 'ai-token' });
  });

  it('reads the expiry as seconds or milliseconds', () => {
    const client = createAiClient(BASE);
    store(aiSessionKey(ROOT), { token: 'in-seconds', het: Math.floor(Date.now() / 1000) + 3600 });
    expect(client.identityHeaders()['X-AI-Session']).toBe('in-seconds');
    store(aiSessionKey(ROOT), { token: 'in-ms', het: Date.now() + 3_600_000 });
    expect(client.identityHeaders()['X-AI-Session']).toBe('in-ms');
  });

  it('drops an expired AI session and removes it from storage', () => {
    store(aiSessionKey(ROOT), { token: 'stale', het: Math.floor(Date.now() / 1000) - 60 });
    store(adminSessionKey(ROOT), 'admin-token');

    expect(createAiClient(BASE).identityHeaders()).toEqual({ 'X-Admin-Session': 'admin-token' });
    expect(localStorage.getItem(aiSessionKey(ROOT))).toBeNull();
  });

  it('files tokens under the page origin when the API is same-origin', () => {
    store(aiSessionKey(window.location.origin), { token: 'ai-token', het: 0 });
    expect(createAiClient('').identityHeaders()).toEqual({ 'X-AI-Session': 'ai-token' });
  });

  it('treats unreadable storage as no identity rather than throwing', () => {
    localStorage.setItem(adminSessionKey(ROOT), '{not json');
    localStorage.setItem(aiSessionKey(ROOT), 'also not json');
    expect(createAiClient(BASE).identityHeaders()).toEqual({});
  });
});

describe('requests', () => {
  it('posts JSON with the identity headers and returns the bare JSON answer', async () => {
    store(aiSessionKey(ROOT), { token: 'ai-token', het: 0 });
    const spy = mockFetch(async () => json(ANSWER));

    const answer = await createAiClient(BASE).chat({ prompt: 'hello', model: 'gemini-2.5-pro' });

    expect(answer).toEqual(ANSWER);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/ai/chat`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: 'hello', model: 'gemini-2.5-pro' });
    expect(headersOf(spy)).toEqual({ 'Content-Type': 'application/json', 'X-AI-Session': 'ai-token' });
  });

  it('turns the error envelope into an AiError with the server message, code and status', async () => {
    mockFetch(async () =>
      json(
        {
          status_code: 429,
          message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
          data: { code: 'ai_rate_limited', retryAfter: 12 },
        },
        429
      )
    );

    const error = await createAiClient(BASE)
      .chat({ prompt: 'hello', model: 'gemini-2.5-pro' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({
      message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
      code: 'ai_rate_limited',
      status: 429,
      retryAfter: 12,
    });
  });

  it('keeps an empty code when the envelope carries none', async () => {
    mockFetch(async () => json({ status_code: 502, message: 'gemini-2.5-pro không trả lời', data: null }, 502));

    const error = await createAiClient(BASE).chat({ prompt: 'hi', model: 'x' }).catch((e: unknown) => e);

    expect(error).toMatchObject({ message: 'gemini-2.5-pro không trả lời', code: '', status: 502 });
  });

  it('falls back to the HTTP status when the error body is not ours', async () => {
    mockFetch(async () => new Response('<html>504 Gateway Time-out</html>', { status: 504 }));

    const error = await createAiClient(BASE).chat({ prompt: 'hi', model: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).status).toBe(504);
    expect((error as AiError).message).toContain('504');
  });

  it('reports an unreachable server as a network AiError', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await createAiClient(BASE).chat({ prompt: 'hi', model: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'network', status: 0 });
    expect((error as AiError).message).toMatch(/không kết nối được máy chủ|cannot reach the server/i);
  });

  it('refuses a successful response that is not JSON', async () => {
    mockFetch(async () => new Response('<!doctype html><html></html>', { status: 200 }));

    const error = await createAiClient(BASE).getStatus().catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'bad_response', status: 200 });
  });
});

describe('getStatus', () => {
  it('asks once, shares the answer, and asks again on refresh', async () => {
    const spy = mockFetch(async () => json(STATUS));
    const client = createAiClient(BASE);

    expect(await client.getStatus()).toEqual(STATUS);
    await client.getStatus();
    expect(spy).toHaveBeenCalledTimes(1);

    await client.getStatus(true);
    expect(spy).toHaveBeenCalledTimes(2);

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/ai/status`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('does not keep a failure: the next call asks again', async () => {
    const spy = mockFetch(async () => {
      throw new TypeError('offline');
    });
    const client = createAiClient(BASE);

    await expect(client.getStatus()).rejects.toBeInstanceOf(AiError);
    spy.mockImplementation(async () => json(STATUS));
    await expect(client.getStatus()).resolves.toEqual(STATUS);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('unlock', () => {
  it('exchanges the code for a session, keeps it for this root, then refreshes the status', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const spy = mockFetch(async () => json(STATUS));
    spy.mockImplementationOnce(async () => json({ ok: true, session: 'ai-token', expiresAt }));
    const client = createAiClient(BASE);

    await expect(client.unlock('open sesame')).resolves.toEqual(STATUS);

    const [sessionUrl, sessionInit] = spy.mock.calls[0];
    expect(sessionUrl).toBe(`${BASE}/ai/session`);
    expect(JSON.parse(String(sessionInit?.body))).toEqual({ code: 'open sesame' });
    expect(JSON.parse(localStorage.getItem(aiSessionKey(ROOT)) ?? 'null')).toEqual({
      token: 'ai-token',
      het: expiresAt,
    });
    // The status is asked again, now carrying the new token.
    expect(spy.mock.calls[1][0]).toBe(`${BASE}/ai/status`);
    expect(headersOf(spy, 1)['X-AI-Session']).toBe('ai-token');
  });

  it('keeps nothing when the code is refused', async () => {
    mockFetch(async () =>
      json({ status_code: 403, message: 'Mã truy cập không đúng', data: { code: 'ai_bad_code' } }, 403)
    );

    await expect(createAiClient(BASE).unlock('wrong')).rejects.toMatchObject({
      message: 'Mã truy cập không đúng',
      status: 403,
    });
    expect(localStorage.getItem(aiSessionKey(ROOT))).toBeNull();
  });
});

describe('models', () => {
  const MODELS = {
    default: 'gemini-3.5-flash',
    source: 'api',
    admin: false,
    models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', tier: 'flash', preview: false, alias: false,
               adminOnly: false, default: false, allowed: true }],
  };

  it('lists them once, shares the answer, and asks again on refresh', async () => {
    const spy = mockFetch(async () => json(MODELS));
    const client = createAiClient(BASE);
    const [a, b] = await Promise.all([client.listModels(), client.listModels()]);
    expect(a).toEqual(MODELS);
    expect(b).toBe(a);
    expect(String(spy.mock.calls[0][0])).toBe(`${BASE}/ai/models`);
    await client.listModels(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refuses an answer without a model list, and does not keep the failure', async () => {
    mockFetch(async () => json({ default: 'x' }));
    const client = createAiClient(BASE);
    await expect(client.listModels()).rejects.toMatchObject({ code: 'bad_response' });
    mockFetch(async () => json(MODELS));
    await expect(client.listModels()).resolves.toEqual(MODELS);
  });

  it('remembers the pick under the key every page of this server shares', () => {
    const client = createAiClient(BASE);
    expect(client.chosenModel()).toBe('');
    client.chooseModel('gemini-3.8-flash');
    expect(JSON.parse(localStorage.getItem(aiModelKey(ROOT)) ?? 'null')).toBe('gemini-3.8-flash');
    expect(client.chosenModel()).toBe('gemini-3.8-flash');
    client.chooseModel('');
    expect(localStorage.getItem(aiModelKey(ROOT))).toBeNull();
    store(aiModelKey(ROOT), 'not a model!');
    expect(client.chosenModel()).toBe('');
  });
});

describe('canOffer', () => {
  it.each([
    ['allowed', { ...STATUS }, true],
    ['missing only the access code', { ...STATUS, allowed: false, needs: 'code' as const }, true],
    ['admin-only, for a guest', { ...STATUS, access: 'admin' as const, allowed: false, needs: 'admin' as const }, false],
    ['switched off', { ...STATUS, enabled: false }, false],
  ])('when %s', (_label, status, expected) => {
    expect(canOffer(status)).toBe(expected);
  });

  it('offers nothing before the status is known', () => {
    expect(canOffer(null)).toBe(false);
  });
});
