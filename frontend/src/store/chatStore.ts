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
  removeConversation: (id: string) => void;
  setMessages: (conversationId: string, messages: MessageResponse[]) => void;
  addMessages: (conversationId: string, messages: MessageResponse[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
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

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations }),
  
  addConversations: (newConversations) =>
    set((state) => ({
      conversations: [...(Array.isArray(state.conversations) ? state.conversations : []), ...newConversations],
    })),

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...(Array.isArray(state.conversations) ? state.conversations : [])],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: (Array.isArray(state.conversations) ? state.conversations : []).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: (Array.isArray(state.conversations) ? state.conversations : []).filter((c) => c.id !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    })),

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
