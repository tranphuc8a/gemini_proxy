import { apiClient, BASE_URL } from './apiClient';
import type { MessageRequest, ApiResponse, StreamCompletion, StreamFailure } from '../types';

/** Callbacks a caller supplies to follow a streaming answer. */
export interface StreamHandlers {
  /** Next fragment of the answer. */
  onChunk: (chunk: string) => void;
  /** The answer finished. `completion` carries the ids it was persisted under. */
  onComplete: (completion: StreamCompletion) => void;
  /**
   * The answer failed, or the request could not be made at all. `failure` is
   * present only when the server reported it, and names the record the question
   * was stored under.
   */
  onError: (error: Error, failure?: StreamFailure) => void;
  /** The caller aborted the request; nothing further will arrive. */
  onAbort?: () => void;
}

/**
 * One frame of the SSE body.
 *
 * The server sends answer fragments as anonymous frames carrying a bare JSON
 * string, and terminal outcomes as named `done` / `error` events carrying a JSON
 * object.
 */
interface SseFrame {
  event: string | null;
  data: string;
}

const parseFrame = (raw: string): SseFrame | null => {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    // A line starting with ':' is a keepalive comment.
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
};

export const geminiService = {
  // Non-streaming query
  async query(request: MessageRequest): Promise<string> {
    const response = await apiClient.post<ApiResponse<string>>('/gemini/query', request);
    return response.data.data;
  },

  /**
   * Stream an answer over Server-Sent Events.
   *
   * Exactly one of `onComplete`, `onError` or `onAbort` runs. A stream that ends
   * without a terminal frame is treated as an error rather than a success: the
   * connection dropped mid-answer, and reporting it as complete is what used to
   * leave an empty bubble with no explanation.
   *
   * Pass `signal` to cancel; the browser tears down the request and the server
   * keeps whatever text had arrived.
   */
  async queryStream(
    request: MessageRequest,
    handlers: StreamHandlers,
    signal?: AbortSignal
  ): Promise<void> {
    const { onChunk, onComplete, onError, onAbort } = handlers;
    let terminated = false;

    try {
      const response = await fetch(`${BASE_URL}/gemini/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        // An error before the stream opens still arrives as our JSON envelope.
        const detail = await response
          .json()
          .then((body: { message?: string }) => body?.message)
          .catch(() => undefined);
        throw new Error(detail || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body reader not available');
      }

      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line; keep any partial tail.
        const rawFrames = buffer.split('\n\n');
        buffer = rawFrames.pop() || '';

        for (const raw of rawFrames) {
          const frame = parseFrame(raw);
          if (!frame) continue;

          if (frame.event === 'error') {
            terminated = true;
            const payload = JSON.parse(frame.data) as StreamFailure;
            onError(new Error(payload.message || 'Streaming failed'), payload);
            return;
          }

          if (frame.event === 'done') {
            terminated = true;
            onComplete(JSON.parse(frame.data) as StreamCompletion);
            return;
          }

          onChunk(JSON.parse(frame.data) as string);
        }
      }

      if (!terminated) {
        throw new Error('Connection closed before the answer finished');
      }
    } catch (error) {
      if (terminated) return;
      if (signal?.aborted || (error as Error)?.name === 'AbortError') {
        onAbort?.();
        return;
      }
      onError(error as Error);
    }
  },
};
