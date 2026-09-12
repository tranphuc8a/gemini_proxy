import axios, { type AxiosInstance } from 'axios';

/**
 * Root of the API, including the backend's API_PREFIX if it sets one.
 *
 * The two halves have to agree: the backend mounts its routers under
 * `settings.API_PREFIX`, which ships empty, so the default below carries no
 * prefix either. Point VITE_API_BASE_URL at `http://localhost:6789/api/v1` if
 * you set API_PREFIX=/api/v1 on the backend.
 */
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:6789').replace(/\/+$/, '');

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
