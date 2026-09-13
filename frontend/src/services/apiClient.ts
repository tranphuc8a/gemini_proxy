import axios, { type AxiosInstance } from 'axios';
import { resolveApiBase } from './runtimeConfig';

/**
 * Where the backend sits while developing.
 *
 * The dev server puts this app on its own port, so it cannot be same-origin with
 * the API and needs an absolute URL. Guarded by `import.meta.env.DEV` so the
 * string is dropped from a production build: a localhost address shipped inside
 * a bundle is exactly the bug this whole arrangement exists to prevent.
 */
const devFallbackBaseUrl = (): string | undefined =>
  import.meta.env.DEV ? 'http://localhost:6789' : undefined;

/**
 * Root of the API, including the backend's API_PREFIX if it sets one.
 *
 * When this build is served from the FastAPI web-app collection the server
 * injects the live prefix, so the value follows the deployment rather than the
 * machine that ran `vite build`. Outside that (the dev server, or a standalone
 * deploy on another origin) VITE_API_BASE_URL still applies.
 */
export const BASE_URL = resolveApiBase(
  import.meta.env.VITE_API_BASE_URL || devFallbackBaseUrl()
);

/**
 * Ceiling for a single request.
 *
 * Non-streaming answers are generated inline, and the backend allows Gemini up
 * to GEMINI_TIMEOUT_SECONDS (300s by default) to produce one. A 30s client
 * timeout aborted long answers that the server was still happily working on.
 */
export const REQUEST_TIMEOUT_MS = 300_000;

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getClient();

/**
 * Human-readable reason a request failed, for display in a toast or a message
 * bubble. Prefers the backend's own `message` field, which every endpoint sets
 * through the shared response envelope.
 */
export const describeApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return fallback;
    const payload = error.response?.data as { message?: string } | undefined;
    if (payload?.message) return payload.message;
    if (!error.response) return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
