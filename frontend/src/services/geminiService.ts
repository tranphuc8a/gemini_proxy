import { apiClient, BASE_URL } from './apiClient';
import i18n from '../i18n';
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

/** How a stream ended, once a terminal frame has been seen. */
type StreamOutcome =
  | { kind: 'done'; completion: StreamCompletion }
  | { kind: 'error'; error: Error; failure?: StreamFailure }
  | null;

export const geminiService = {
  // Non-streaming query
  async query(request: MessageRequest): Promise<string> {
    const response = await apiClient.post<ApiResponse<string>>('/gemini/query', request);
    return response.data.data;
  },

  /**
   * Stream an answer over Server-Sent Events.
   *
   * Exactly one of `onComplete`, `onError` or `onAbort` runs.
   *
   * The server ends a stream with a terminal `done` or `error` frame, which is
   * what lets a failed answer be told apart from a short one. A server older
   * than that protocol just closes the connection instead, so a stream that
   * delivered an answer and then ended is completed rather than failed — only a
   * stream that ended having delivered nothing is reported as an error.
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
      let outcome: StreamOutcome = null;
      // Mutated from inside `consume`; a plain `let` assigned only in a closure
      // is not something TypeScript can narrow at the read sites below.
      const seen = { content: false };

      /** Handle complete frames, stopping at the first terminal one. */
      const consume = (frames: string[]): StreamOutcome => {
        for (const raw of frames) {
          const frame = parseFrame(raw);
          if (!frame) continue;

          if (frame.event === 'error') {
            const payload = JSON.parse(frame.data) as StreamFailure;
            return {
              kind: 'error',
              error: new Error(payload.message || 'Streaming failed'),
              failure: payload,
            };
          }

          if (frame.event === 'done') {
            return { kind: 'done', completion: JSON.parse(frame.data) as StreamCompletion };
          }

          seen.content = true;
          onChunk(JSON.parse(frame.data) as string);
        }
        return null;
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush the decoder (a multi-byte character can straddle the last
            // chunk) and process what is left: the final frame may arrive
            // without its blank-line terminator.
            buffer += decoder.decode();
            if (buffer.trim()) outcome = consume([buffer]);
            buffer = '';
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Frames are separated by a blank line; keep any partial tail.
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          outcome = consume(frames);

          if (outcome) break;
        }
      } finally {
        // Release the connection whether we finished, failed or stopped early.
        reader.cancel().catch(() => undefined);
      }

      if (outcome?.kind === 'error') {
        terminated = true;
        onError(outcome.error, outcome.failure);
        return;
      }

      if (outcome?.kind === 'done') {
        terminated = true;
        onComplete(outcome.completion);
        return;
      }

      if (seen.content) {
        // A server that predates the terminal-frame protocol ends exactly here:
        // it delivered an answer and then simply closed the connection.
        terminated = true;
        onComplete({});
        return;
      }

      throw new Error(i18n.t('chat.streamIncomplete'));
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
