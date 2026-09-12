import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatArea } from './ChatArea';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { geminiService } from '../services/geminiService';
import type { StreamHandlers } from '../services/geminiService';
import { ERole, type ChatMessage } from '../types';

vi.mock('../services/conversationService', () => ({
  conversationService: {
    create: vi.fn(),
    get: vi.fn(),
    getMessages: vi.fn(),
  },
}));

vi.mock('../services/geminiService', () => ({
  geminiService: { queryStream: vi.fn() },
}));

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockResolvedValue({ svg: '<svg />' }) },
}));

const CONVERSATION = {
  id: 'c1',
  name: 'Planning',
  created_at: 1_789_223_400,
  updated_at: null,
};

/** Opens conversation `c1` with `messages` already loaded. */
const openConversation = (messages: ChatMessage[] = []) => {
  useChatStore.setState({
    conversations: [CONVERSATION],
    currentConversationId: 'c1',
    messages: { c1: messages },
    hasMoreMessages: { c1: false },
    nextMessageCursor: {},
    isLoadingMessages: false,
  });
};

/** Captures the handlers ChatArea passes to the streaming service. */
const captureStream = () => {
  const captured: { handlers?: StreamHandlers; signal?: AbortSignal } = {};
  vi.mocked(geminiService.queryStream).mockImplementation(
    async (_request, handlers: StreamHandlers, signal?: AbortSignal) => {
      captured.handlers = handlers;
      captured.signal = signal;
    }
  );
  return captured;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationService.getMessages).mockResolvedValue({
    data: [],
    first_id: null,
    last_id: null,
    has_more: false,
  });
  vi.mocked(conversationService.get).mockResolvedValue(CONVERSATION);
  openConversation();
});

const typeAndSend = async (text: string) => {
  const user = userEvent.setup();
  const textarea = screen.getByRole('textbox');
  await user.type(textarea, text);
  await user.click(screen.getByRole('button', { name: /gửi|send/i }));
  return user;
};

describe('ChatArea', () => {
  it('shows the empty state with no conversation selected', () => {
    useChatStore.setState({ currentConversationId: null });
    render(<ChatArea />);
    expect(screen.getByRole('button', { name: /cuộc trò chuyện mới|new chat/i })).toBeInTheDocument();
  });

  it('shows the conversation name', () => {
    render(<ChatArea />);
    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument();
  });

  it('sends a message and streams the answer into the transcript', async () => {
    const captured = captureStream();
    render(<ChatArea />);
    await typeAndSend('what is the plan?');

    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalled());
    expect(vi.mocked(geminiService.queryStream).mock.calls[0][0]).toMatchObject({
      conversation_id: 'c1',
      content: 'what is the plan?',
    });

    act(() => {
      captured.handlers?.onChunk('Step ');
      captured.handlers?.onChunk('one.');
    });
    await waitFor(() => expect(screen.getByText('Step one.')).toBeInTheDocument());
  });

  it('adopts the server ids once the answer completes', async () => {
    // Regression: placeholder ids stayed in the store and leaked into the
    // pagination cursor on the next "load older".
    const captured = captureStream();
    render(<ChatArea />);
    await typeAndSend('hello');

    await waitFor(() => expect(captured.handlers).toBeDefined());
    act(() => {
      captured.handlers?.onChunk('hi');
      captured.handlers?.onComplete({ user_message_id: 'msg-u1', message_id: 'msg-a1' });
    });

    await waitFor(() => {
      const ids = useChatStore.getState().messages.c1.map((m) => m.id);
      expect(ids).toEqual(['msg-u1', 'msg-a1']);
    });
  });

  it('reports a failed answer in the message and offers a retry', async () => {
    const captured = captureStream();
    render(<ChatArea />);
    await typeAndSend('hello');

    await waitFor(() => expect(captured.handlers).toBeDefined());
    act(() => captured.handlers?.onError(new Error('Gemini API returned HTTP 429')));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Gemini API returned HTTP 429');
    });
    expect(screen.getByRole('button', { name: /thử lại|retry/i })).toBeInTheDocument();
  });

  it('re-asks the previous question when retried, without duplicating it', async () => {
    const captured = captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);
    await typeAndSend('original question');

    await waitFor(() => expect(captured.handlers).toBeDefined());
    act(() => captured.handlers?.onError(new Error('boom'), { user_message_id: 'msg-u1' }));

    await user.click(await screen.findByRole('button', { name: /thử lại|retry/i }));

    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalledTimes(2));
    // The retry names the record the failed attempt stored, so the backend
    // updates it instead of filing the same question twice.
    expect(vi.mocked(geminiService.queryStream).mock.calls[1][0]).toMatchObject({
      content: 'original question',
      message_id: 'msg-u1',
    });

    // And the question appears once on screen, not twice.
    const questions = useChatStore
      .getState()
      .messages.c1.filter((m) => m.role === ERole.USER && m.content === 'original question');
    expect(questions).toHaveLength(1);
  });

  it('files the question fresh when the failed attempt never reached the server', async () => {
    const captured = captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);
    await typeAndSend('offline question');

    // No user_message_id: the request never got far enough to store anything.
    await waitFor(() => expect(captured.handlers).toBeDefined());
    act(() => captured.handlers?.onError(new Error('network unreachable')));

    await user.click(await screen.findByRole('button', { name: /thử lại|retry/i }));

    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalledTimes(2));
    expect(vi.mocked(geminiService.queryStream).mock.calls[1][0].message_id).toBeUndefined();
  });

  it('swaps Send for Stop while an answer is arriving, and aborts on click', async () => {
    const captured = captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);
    await typeAndSend('hello');

    const stop = await screen.findByRole('button', { name: /dừng|stop/i });
    expect(captured.signal?.aborted).toBe(false);

    await user.click(stop);
    expect(captured.signal?.aborted).toBe(true);
  });

  it('sends on Enter', async () => {
    captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);

    await user.type(screen.getByRole('textbox'), 'quick question{Enter}');

    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalled());
  });

  it('does not send on Shift+Enter', async () => {
    captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);

    await user.type(screen.getByRole('textbox'), 'line one{Shift>}{Enter}{/Shift}line two');

    expect(geminiService.queryStream).not.toHaveBeenCalled();
  });

  it('does not send on Enter while an IME composition is open', async () => {
    // Regression: typing Vietnamese with Unikey, the Enter that accepts a
    // candidate used to send the half-finished word.
    captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'xin cha');
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(geminiService.queryStream).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalled());
  });

  it('refuses to send an empty or whitespace-only message', async () => {
    captureStream();
    const user = userEvent.setup();
    render(<ChatArea />);

    await user.type(screen.getByRole('textbox'), '   ');
    expect(screen.getByRole('button', { name: /gửi|send/i })).toBeDisabled();
    expect(geminiService.queryStream).not.toHaveBeenCalled();
  });

  it('disables export with nothing to export', () => {
    render(<ChatArea />);
    expect(screen.getByRole('button', { name: /markdown/i })).toBeDisabled();
  });

  it('shows a timestamp next to each message', () => {
    openConversation([
      {
        id: 'm1',
        conversation_id: 'c1',
        role: ERole.USER,
        content: 'hello',
        created_at: 1_789_223_400,
      },
    ]);
    render(<ChatArea />);

    expect(screen.getByTestId('message-m1')).toHaveTextContent(/\d{1,2}:\d{2}/);
  });
});
