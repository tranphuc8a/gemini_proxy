import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore';
import { ERole, type ChatMessage, type ConversationResponse } from '../types';

const conversation = (id: string, overrides: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id,
  name: `Conversation ${id}`,
  created_at: 1_000,
  updated_at: null,
  ...overrides,
});

const message = (id: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conversation_id: 'c1',
  role: ERole.USER,
  content: 'hello',
  created_at: 1_000,
  ...overrides,
});

const reset = () =>
  useChatStore.setState({
    conversations: [],
    currentConversationId: null,
    messages: {},
    hasMoreMessages: {},
    nextMessageCursor: {},
  });

beforeEach(reset);

describe('conversations', () => {
  it('puts a new conversation at the top', () => {
    const store = useChatStore.getState();
    store.setConversations([conversation('a')]);
    store.addConversation(conversation('b'));

    expect(useChatStore.getState().conversations.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('survives a response that is not an array', () => {
    // The store defended against this before; keep the guarantee under test.
    useChatStore.getState().setConversations(undefined as never);
    expect(useChatStore.getState().conversations).toEqual([]);
  });

  it('moves a conversation to the top when it is used', () => {
    const store = useChatStore.getState();
    store.setConversations([conversation('a'), conversation('b'), conversation('c')]);
    store.markConversationActive('c');

    const { conversations } = useChatStore.getState();
    expect(conversations.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(conversations[0].updated_at).toBeGreaterThan(0);
  });

  it('ignores activity on a conversation it does not know', () => {
    const store = useChatStore.getState();
    store.setConversations([conversation('a')]);
    store.markConversationActive('missing');

    expect(useChatStore.getState().conversations.map((c) => c.id)).toEqual(['a']);
  });

  it('clears the selection and the cached messages when the open conversation is deleted', () => {
    const store = useChatStore.getState();
    store.setConversations([conversation('c1'), conversation('c2')]);
    store.setCurrentConversation('c1');
    store.setMessages('c1', [message('m1')]);

    store.removeConversation('c1');

    const state = useChatStore.getState();
    expect(state.conversations.map((c) => c.id)).toEqual(['c2']);
    expect(state.currentConversationId).toBeNull();
    expect(state.messages.c1).toBeUndefined();
  });

  it('keeps the selection when a different conversation is deleted', () => {
    const store = useChatStore.getState();
    store.setConversations([conversation('c1'), conversation('c2')]);
    store.setCurrentConversation('c1');

    store.removeConversation('c2');

    expect(useChatStore.getState().currentConversationId).toBe('c1');
  });
});

describe('messages', () => {
  it('appends and then updates in place', () => {
    const store = useChatStore.getState();
    store.addMessage('c1', message('m1', { content: '' , isStreaming: true }));
    store.updateMessage('c1', 'm1', { content: 'streamed', isStreaming: false });

    expect(useChatStore.getState().messages.c1).toEqual([
      expect.objectContaining({ id: 'm1', content: 'streamed', isStreaming: false }),
    ]);
  });

  it('adopts the server id in place of the placeholder', () => {
    // Regression: placeholder ids leaked into the pagination cursor, so the next
    // "load older" asked the server to page from an id it had never issued.
    const store = useChatStore.getState();
    store.addMessage('c1', message('temp-user-1', { pending: true }));
    store.replaceMessageId('c1', 'temp-user-1', 'msg-real-1');

    const [stored] = useChatStore.getState().messages.c1;
    expect(stored.id).toBe('msg-real-1');
    expect(stored.pending).toBe(false);
  });

  it('leaves other messages alone when replacing an id', () => {
    const store = useChatStore.getState();
    store.addMessage('c1', message('m1'));
    store.addMessage('c1', message('temp-2'));
    store.replaceMessageId('c1', 'temp-2', 'msg-2');

    expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['m1', 'msg-2']);
  });

  it('removes a single message', () => {
    const store = useChatStore.getState();
    store.setMessages('c1', [message('m1'), message('m2')]);
    store.removeMessage('c1', 'm1');

    expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['m2']);
  });

  it('tracks pagination state per conversation', () => {
    const store = useChatStore.getState();
    store.setHasMoreMessages('c1', true);
    store.setNextMessageCursor('c1', 'msg-1');
    store.setHasMoreMessages('c2', false);

    const state = useChatStore.getState();
    expect(state.hasMoreMessages).toEqual({ c1: true, c2: false });
    expect(state.nextMessageCursor).toEqual({ c1: 'msg-1' });
  });
});
