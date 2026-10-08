import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatArea } from './ChatArea';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { geminiService } from '../services/geminiService';
import type { StreamHandlers } from '../services/geminiService';
import { aiService, type AiStatus } from '../services/aiService';
import { MARKDOWN_EDITOR_INBOX_KEY } from '../utils/markdownExport';
import { ERole, type ChatMessage } from '../types';
import i18n from '../i18n';

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

// The gateway's status decides whether "Compare models" is offered at all.
vi.mock('../services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/aiService')>();
  return {
    ...actual,
    aiService: {
      ...actual.aiService,
      getStatus: vi.fn(),
      chat: vi.fn(),
      unlock: vi.fn(),
      listModels: vi.fn(),
      chooseModel: vi.fn(),
      chosenModel: vi.fn(),
      identityHeaders: vi.fn(() => ({})),
    },
  };
});

const AI_ALLOWED: AiStatus = {
  enabled: true,
  access: 'public',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 5, perDay: 100 },
};
const AI_ADMIN_ONLY: AiStatus = { ...AI_ALLOWED, access: 'admin', allowed: false, needs: 'admin' };

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
  vi.mocked(aiService.getStatus).mockResolvedValue(AI_ADMIN_ONLY);
  vi.mocked(aiService.chosenModel).mockReturnValue('');
  vi.mocked(aiService.listModels).mockResolvedValue({
    default: 'gemini-3.5-flash',
    source: 'api',
    admin: false,
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'flash', preview: false, alias: false, adminOnly: false, default: true, allowed: true },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', tier: 'flash', preview: false, alias: false, adminOnly: false, default: false, allowed: true },
    ],
  });
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

  it("asks with the server's default model, or the one picked (remembered for every page)", async () => {
    captureStream();
    render(<ChatArea />);
    const user = await typeAndSend('first');
    await waitFor(() => expect(geminiService.queryStream).toHaveBeenCalledTimes(1));
    expect(vi.mocked(geminiService.queryStream).mock.calls[0][0].model).toBe('gemini-3.5-flash');

    await user.click(screen.getByRole('combobox', { name: /mô hình|select model/i }));
    const option = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="Gemini 3.8 Flash"]'
      );
      if (!element) throw new Error('Gemini 3.8 Flash is not offered');
      return element;
    });
    await user.click(option);
    expect(aiService.chooseModel).toHaveBeenCalledWith('gemini-3.8-flash');
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
    expect(screen.getByRole('button', { name: /xuất markdown|export markdown/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /mở trong markdown editor|open in markdown editor/i })).toBeDisabled();
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

  describe('compare models', () => {
    const COMPARE = /so sánh model|compare models/i;

    it('is not offered when the AI gateway is admin-only for this visitor', async () => {
      render(<ChatArea />);

      await waitFor(() => expect(aiService.getStatus).toHaveBeenCalled());
      // Let the status arrive before checking that nothing appeared.
      await act(async () => undefined);
      expect(screen.queryByRole('button', { name: COMPARE })).not.toBeInTheDocument();
    });

    it('is offered when the gateway allows it, prefilled from the message box', async () => {
      vi.mocked(aiService.getStatus).mockResolvedValue(AI_ALLOWED);
      const user = userEvent.setup();
      render(<ChatArea />);

      await user.type(screen.getByRole('textbox'), 'Which model is faster?');
      await user.click(await screen.findByRole('button', { name: COMPARE }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('textbox', { name: /câu hỏi|prompt/i })).toHaveValue('Which model is faster?');
    });
  });

  describe('Markdown Editor', () => {
    const MESSAGES: ChatMessage[] = [
      { id: 'm1', conversation_id: 'c1', role: ERole.USER, content: 'what is the plan?', created_at: 1_789_223_400 },
      { id: 'm2', conversation_id: 'c1', role: ERole.MODEL, content: 'Step **one**.', created_at: 1_789_223_460 },
    ];

    const readInbox = () => JSON.parse(localStorage.getItem(MARKDOWN_EDITOR_INBOX_KEY) ?? 'null');

    it('opens the whole conversation in the editor', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      openConversation(MESSAGES);
      const user = userEvent.setup();
      render(<ChatArea />);

      await user.click(screen.getByRole('button', { name: /mở trong markdown editor|open in markdown editor/i }));

      const inbox = readInbox();
      expect(inbox).toMatchObject({ name: 'Planning.md', from: 'Gemini Chat', at: expect.any(Number) });
      // The same document the download produces.
      expect(inbox.content).toMatch(/^# Planning\n/);
      expect(inbox.content).toContain('what is the plan?');
      expect(inbox.content).toContain('Step **one**.');
      expect(open).toHaveBeenCalledWith('/webapp/tranphuc8a/markdown-editor-pro/?import=1', '_blank', 'noopener');
      open.mockRestore();
    });

    it('sends a single message to the editor', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      openConversation(MESSAGES);
      const user = userEvent.setup();
      render(<ChatArea />);

      await user.click(
        within(screen.getByTestId('message-m2')).getByRole('button', {
          name: /gửi sang markdown editor|send to markdown editor/i,
        })
      );

      expect(readInbox()).toMatchObject({ name: 'Planning-Gemini.md', content: 'Step **one**.', from: 'Gemini Chat' });
      expect(open).toHaveBeenCalledTimes(1);
      open.mockRestore();
    });
  });

  it('puts a prompt from the library in the message box, below what is already there', async () => {
    const user = userEvent.setup();
    render(<ChatArea />);
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'Some context');
    await user.click(screen.getByRole('button', { name: /thư viện prompt|prompt library/i }));
    await user.click(await screen.findByRole('button', { name: /^(dịch sang tiếng anh|translate to english)$/i }));

    expect(textarea).toHaveValue(`Some context\n${i18n.t('prompts.templates.translateToEnglish.text')}`);
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(geminiService.queryStream).not.toHaveBeenCalled();
  });
});
