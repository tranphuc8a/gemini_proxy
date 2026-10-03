import i18n from '../i18n';
import { BASE_URL } from './apiClient';

/**
 * Client for the platform's AI gateway, `${base}/ai/...`.
 *
 * The same contract as the course pages' `ai-khach.js`, so a visitor who
 * unlocked AI (or signed in as course administrator) on one page of this origin
 * is recognised here too:
 *
 * - the caller is identified by headers built from tokens other pages left in
 *   localStorage, filed under the absolute API root so a token is never sent to
 *   a different backend;
 * - answers are bare JSON, while errors use the shared envelope
 *   `{status_code, message, data: {code, retryAfter?}}`.
 *
 * Unlike the regular chat (`/gemini/*`, public), every call here follows the
 * gateway's access mode and counts against its rate limits and daily budget.
 */

export type AiAccess = 'admin' | 'code' | 'public';

/** GET /ai/status: what this visitor may do, so a page can decide what to offer. */
export interface AiStatus {
  enabled: boolean;
  access: AiAccess;
  allowed: boolean;
  /** What would let this visitor in when `allowed` is false. */
  needs: null | 'code' | 'admin';
  admin: boolean;
  model: string;
  limits: { perMinute: number; perDay: number };
}

export interface AiChatRequest {
  prompt: string;
  model: string;
}

/** POST /ai/chat: one stateless answer from one model. */
export interface AiChatAnswer {
  model: string;
  /** Markdown. */
  text: string;
  ms: number;
  promptTokens: number;
  outputTokens: number;
  finishReason: string;
}

/** POST /ai/session: an access code exchanged for a token. */
export interface AiSession {
  ok: boolean;
  session: string;
  /** Unix time; seconds or milliseconds (see `expiryMs`). */
  expiresAt: number;
}

/** Longest prompt /ai/chat accepts. */
export const AI_PROMPT_MAX_CHARS = 8000;

/**
 * A failed AI call.
 *
 * `code` is the server's `data.code` (`ai_rate_limited`, `ai_code_required`, …),
 * `'network'` when the server could not be reached, `'aborted'` when the caller
 * cancelled, and empty when the server gave none. `status` is 0 without a response.
 */
export class AiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Seconds to wait, when the server said (rate limit, budget). */
  readonly retryAfter?: number;

  constructor(message: string, code = '', status = 0, retryAfter?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Whether a page should offer an AI feature at all. */
export const canOffer = (status: AiStatus | null | undefined): boolean =>
  Boolean(status?.enabled && (status.allowed || status.needs === 'code'));

/**
 * Absolute root the identity tokens are filed under, e.g. "https://host/api/v1"
 * or "https://host" — the API base resolved against the page, without trailing
 * slashes.
 */
export const aiRoot = (base: string): string => {
  try {
    return new URL(base || '/', window.location.href).href.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

/** Token key of the course administrator session the Manage page stores. */
export const adminSessionKey = (root: string) => `qlkh.phien@${root}.token`;
/** Key of the token an AI access code was exchanged for. */
export const aiSessionKey = (root: string) => `ai.phien@${root}`;

/** `het` is seconds or milliseconds depending on who wrote it; tell them apart by size. */
const expiryMs = (het: number) => (het > 1e12 ? het : het * 1000);

// Storage can be disabled outright (private windows, a blocked site); the AI
// features then behave as for an anonymous visitor rather than throwing.
const readStored = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: unknown): void => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: the session simply will not survive a reload.
  }
};

interface ErrorEnvelope {
  message?: unknown;
  detail?: unknown;
  data?: { code?: unknown; retryAfter?: unknown } | null;
}

export interface AiClient {
  /** The headers that identify this visitor; drops an expired AI token on the way. */
  identityHeaders(): Record<string, string>;
  /** GET /ai/status, asked once and shared; `refresh` asks again. */
  getStatus(refresh?: boolean): Promise<AiStatus>;
  /** POST /ai/session with an access code, keep the token, then refresh the status. */
  unlock(code: string): Promise<AiStatus>;
  /** POST /ai/chat. */
  chat(request: AiChatRequest, signal?: AbortSignal): Promise<AiChatAnswer>;
}

/** A client bound to one API base (the app's resolved base, '' for same origin). */
export const createAiClient = (base: string): AiClient => {
  const apiBase = base.replace(/\/+$/, '');
  let statusRequest: Promise<AiStatus> | null = null;

  // Resolved per call rather than once: cheap, and immune to when the module loads.
  const keys = () => {
    const root = aiRoot(apiBase);
    return { admin: adminSessionKey(root), ai: aiSessionKey(root) };
  };

  const identityHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    const { admin, ai } = keys();

    const adminToken = readStored(admin);
    if (typeof adminToken === 'string' && adminToken) headers['X-Admin-Session'] = adminToken;

    const aiSession = readStored(ai);
    if (aiSession && typeof aiSession === 'object') {
      const { token, het } = aiSession as { token?: unknown; het?: unknown };
      if (typeof token === 'string' && token) {
        const expiry = Number(het) || 0;
        if (!expiry || expiryMs(expiry) > Date.now()) headers['X-AI-Session'] = token;
        else writeStored(ai, null);
      }
    }
    return headers;
  };

  async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const headers = identityHeaders();
    const init: RequestInit = { method: 'GET', headers, credentials: 'same-origin', signal };
    if (body !== undefined) {
      init.method = 'POST';
      init.headers = { 'Content-Type': 'application/json', ...headers };
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(`${apiBase}/ai/${path}`, init);
    } catch (error) {
      if (signal?.aborted || (error as Error)?.name === 'AbortError') {
        throw new AiError(i18n.t('ai.errors.aborted'), 'aborted', 0);
      }
      throw new AiError(i18n.t('ai.errors.network'), 'network', 0);
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (signal?.aborted) throw new AiError(i18n.t('ai.errors.aborted'), 'aborted', 0);

    if (response.ok) {
      // A 200 that is not JSON is a page from something other than the
      // gateway (an older backend's fallback, a captive portal).
      if (!payload || typeof payload !== 'object') {
        throw new AiError(
          i18n.t('ai.errors.badResponse', { status: response.status }),
          'bad_response',
          response.status
        );
      }
      return payload as T;
    }

    const envelope = (payload && typeof payload === 'object' ? payload : {}) as ErrorEnvelope;
    const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : {};
    const message =
      (typeof envelope.message === 'string' && envelope.message) ||
      (typeof envelope.detail === 'string' && envelope.detail) ||
      i18n.t('ai.errors.http', { status: response.status });
    throw new AiError(
      message,
      typeof data.code === 'string' ? data.code : '',
      response.status,
      typeof data.retryAfter === 'number' ? data.retryAfter : undefined
    );
  }

  const getStatus = (refresh = false): Promise<AiStatus> => {
    if (!statusRequest || refresh) {
      const pending = call<AiStatus>('status');
      statusRequest = pending;
      // A failure is not cached: the next caller asks again.
      pending.catch(() => {
        if (statusRequest === pending) statusRequest = null;
      });
    }
    return statusRequest;
  };

  const unlock = async (code: string): Promise<AiStatus> => {
    const issued = await call<AiSession>('session', { code });
    if (typeof issued.session !== 'string' || !issued.session) {
      throw new AiError(i18n.t('ai.errors.badResponse', { status: 200 }), 'bad_response', 200);
    }
    writeStored(keys().ai, { token: issued.session, het: issued.expiresAt });
    return getStatus(true);
  };

  const chat = (request: AiChatRequest, signal?: AbortSignal) =>
    call<AiChatAnswer>('chat', { prompt: request.prompt, model: request.model }, signal);

  return { identityHeaders, getStatus, unlock, chat };
};

/** The app's client, on the same resolved API base as every other call. */
export const aiService = createAiClient(BASE_URL);
