import { create } from 'zustand';
import type { ConversationResponse, MessageResponse, ChatMessage } from '../types';

interface ChatState {
  conversations: ConversationResponse[];
  currentConversationId: string | null;
  messages: Record<string, ChatMessage[]>; // conversationId -> messages
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  hasMoreConversations: boolean;
  nextConversationCursor: string | null;
  hasMoreMessages: Record<string, boolean>;
  nextMessageCursor: Record<string, string | null>;

  // Actions
  setConversations: (conversations: ConversationResponse[]) => void;
  addConversations: (conversations: ConversationResponse[]) => void;
  setCurrentConversation: (id: string | null) => void;
  addConversation: (conversation: ConversationResponse) => void;
  updateConversation: (id: string, updates: Partial<ConversationResponse>) => void;
  /** Move a conversation to the top of the list and stamp it as just used. */
  markConversationActive: (id: string) => void;
  removeConversation: (id: string) => void;
  setMessages: (conversationId: string, messages: MessageResponse[]) => void;
  addMessages: (conversationId: string, messages: MessageResponse[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  /** Swap a locally-generated message id for the one the server persisted. */
  replaceMessageId: (conversationId: string, temporaryId: string, serverId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setLoadingConversations: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setHasMoreConversations: (hasMore: boolean) => void;
  setNextConversationCursor: (cursor: string | null) => void;
  setHasMoreMessages: (conversationId: string, hasMore: boolean) => void;
  setNextMessageCursor: (conversationId: string, cursor: string | null) => void;
}

const initialState = {
  conversations: [],
  currentConversationId: null,
  messages: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  hasMoreConversations: false,
  nextConversationCursor: null,
  hasMoreMessages: {},
  nextMessageCursor: {},
};

/** Defends against an API response that is not the array we expect. */
const asArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations: asArray(conversations) }),

  addConversations: (newConversations) =>
    set((state) => ({
      conversations: [...asArray(state.conversations), ...asArray(newConversations)],
    })),

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...asArray(state.conversations)],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: asArray(state.conversations).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  markConversationActive: (id) =>
    set((state) => {
      const conversations = asArray(state.conversations);
      const target = conversations.find((c) => c.id === id);
      if (!target) return {};
      // The server sorts the list by last activity; mirror that locally so the
      // sidebar does not wait for a refetch to reflect what just happened.
      const touched = { ...target, updated_at: Math.floor(Date.now() / 1000) };
      return { conversations: [touched, ...conversations.filter((c) => c.id !== id)] };
    }),

  removeConversation: (id) =>
    set((state) => {
      // Drop the cached messages too, so re-creating an id never shows stale ones.
      const messages = { ...state.messages };
      delete messages[id];
      return {
        conversations: asArray(state.conversations).filter((c) => c.id !== id),
        messages,
        currentConversationId:
          state.currentConversationId === id ? null : state.currentConversationId,
      };
    }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  addMessages: (conversationId, newMessages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          ...newMessages,
        ],
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    })),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  replaceMessageId: (conversationId, temporaryId, serverId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === temporaryId ? { ...m, id: serverId, pending: false } : m
        ),
      },
    })),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter((m) => m.id !== messageId),
      },
    })),

  setLoadingConversations: (loading) => set({ isLoadingConversations: loading }),
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  setHasMoreConversations: (hasMore) => set({ hasMoreConversations: hasMore }),
  setNextConversationCursor: (cursor) => set({ nextConversationCursor: cursor }),

  setHasMoreMessages: (conversationId, hasMore) =>
    set((state) => ({
      hasMoreMessages: {
        ...state.hasMoreMessages,
        [conversationId]: hasMore,
      },
    })),

  setNextMessageCursor: (conversationId, cursor) =>
    set((state) => ({
      nextMessageCursor: {
        ...state.nextMessageCursor,
        [conversationId]: cursor,
      },
    })),
}));
