import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiService } from './geminiService';
import type { StreamCompletion } from '../types';

const REQUEST = { conversation_id: 'c1', content: 'hi', model: 'gemini-2.5-flash' };

/** A Response whose body streams the given chunks, as the browser would. */
const streamingResponse = (chunks: string[], init: ResponseInit = { status: 200 }) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, init);
};

const mockFetch = (response: Response | (() => Promise<Response>)) => {
  const impl = typeof response === 'function' ? response : async () => response;
  // Typed as fetch so `mock.calls` carries fetch's (input, init) tuple.
  const spy = vi.fn<typeof fetch>(() => impl());
  vi.stubGlobal('fetch', spy);
  return spy;
};

/** Collects every callback the service invoked, so order and exclusivity are testable. */
const makeHandlers = () => {
  const chunks: string[] = [];
  const calls: string[] = [];
  let completion: StreamCompletion | undefined;
  let error: Error | undefined;

  return {
    chunks,
    calls,
    get completion() {
      return completion;
    },
    get error() {
      return error;
    },
    handlers: {
      onChunk: (chunk: string) => {
        chunks.push(chunk);
      },
      onComplete: (value: StreamCompletion) => {
        calls.push('complete');
        completion = value;
      },
      onError: (value: Error) => {
        calls.push('error');
        error = value;
      },
      onAbort: () => {
        calls.push('abort');
      },
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('queryStream', () => {
  it('delivers each delta then completes with the server ids', async () => {
    mockFetch(
      streamingResponse([
        'data: "Hel"\n\n',
        'data: "lo!"\n\n',
        'event: done\ndata: {"conversation_id":"c1","user_message_id":"u1","message_id":"m1"}\n\n',
      ])
    );

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks.join('')).toBe('Hello!');
    expect(probe.calls).toEqual(['complete']);
    expect(probe.completion).toEqual({
      conversation_id: 'c1',
      user_message_id: 'u1',
      message_id: 'm1',
    });
  });

  it('reassembles a frame split across network chunks', async () => {
    mockFetch(streamingResponse(['data: "par', 'tial"\n\n', 'event: done\ndata: {}\n\n']));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['partial']);
    expect(probe.calls).toEqual(['complete']);
  });

  it('reports a terminal error event as an error', async () => {
    mockFetch(
      streamingResponse([
        'data: "some text"\n\n',
        'event: error\ndata: {"message":"Gemini API returned HTTP 429"}\n\n',
      ])
    );

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['some text']);
    expect(probe.calls).toEqual(['error']);
    expect(probe.error?.message).toBe('Gemini API returned HTTP 429');
  });

  it('completes a stream that delivered an answer without a terminal frame', async () => {
    // A server older than the done/error protocol ends exactly this way.
    // Failing here made the app unusable against a backend not yet redeployed.
    mockFetch(streamingResponse(['data: "a complete answer"\n\n']));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['a complete answer']);
    expect(probe.calls).toEqual(['complete']);
    // No ids: the old protocol has no way to report them.
    expect(probe.completion).toEqual({});
  });

  it('fails a stream that ended having delivered nothing', async () => {
    mockFetch(streamingResponse([]));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual([]);
    expect(probe.calls).toEqual(['error']);
  });

  it('reads a final frame that arrives without its blank-line terminator', async () => {
    // The body can end right after the frame, with no trailing newlines.
    mockFetch(
      streamingResponse(['data: "text"\n\n', 'event: done\ndata: {"message_id":"m1"}'])
    );

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['text']);
    expect(probe.calls).toEqual(['complete']);
    expect(probe.completion).toEqual({ message_id: 'm1' });
  });

  it('reads a delta split across a multi-byte character boundary', async () => {
    // The two-byte à of 'chào' is cut between two network chunks.
    const encoded = new TextEncoder().encode('data: "chào"\n\nevent: done\ndata: {}\n\n');
    const cut = encoded.indexOf(0xc3) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, cut));
        controller.enqueue(encoded.slice(cut));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['chào']);
    expect(probe.calls).toEqual(['complete']);
  });

  it('surfaces the backend message when the request fails before streaming', async () => {
    mockFetch(
      new Response(JSON.stringify({ status_code: 400, message: 'message is too large', data: null }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.calls).toEqual(['error']);
    expect(probe.error?.message).toBe('message is too large');
  });

  it('falls back to the status code when the error body is not ours', async () => {
    mockFetch(new Response('<html>502</html>', { status: 502 }));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.error?.message).toContain('502');
  });

  it('ignores keepalive comments', async () => {
    mockFetch(streamingResponse([': ping\n\n', 'data: "ok"\n\n', 'event: done\ndata: {}\n\n']));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['ok']);
    expect(probe.calls).toEqual(['complete']);
  });

  it('preserves non-ASCII text', async () => {
    mockFetch(streamingResponse(['data: "Xin chào"\n\n', 'event: done\ndata: {}\n\n']));

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual(['Xin chào']);
  });

  it('reports an abort as an abort rather than an error', async () => {
    const controller = new AbortController();
    mockFetch(async () => {
      controller.abort();
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      throw abortError;
    });

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers, controller.signal);

    expect(probe.calls).toEqual(['abort']);
  });

  it('passes the abort signal to fetch so the request is really cancelled', async () => {
    const controller = new AbortController();
    const spy = mockFetch(streamingResponse(['event: done\ndata: {}\n\n']));

    await geminiService.queryStream(REQUEST, makeHandlers().handlers, controller.signal);

    expect(spy.mock.calls[0][1]).toMatchObject({ method: 'POST', signal: controller.signal });
  });

  it('stops reading once a terminal frame arrives', async () => {
    mockFetch(
      streamingResponse([
        'event: done\ndata: {"message_id":"m1"}\n\n',
        'data: "should never be delivered"\n\n',
      ])
    );

    const probe = makeHandlers();
    await geminiService.queryStream(REQUEST, probe.handlers);

    expect(probe.chunks).toEqual([]);
    expect(probe.calls).toEqual(['complete']);
  });
});
