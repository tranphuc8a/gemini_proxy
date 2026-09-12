import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';

vi.mock('../services/conversationService', () => ({
  conversationService: { create: vi.fn() },
}));

const created = {
  id: 'conv-1',
  name: 'New Conversation',
  created_at: 1_789_223_400,
  updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({ conversations: [], currentConversationId: null, messages: {} });
});

describe('EmptyState', () => {
  it('offers a way to start a conversation', () => {
    // Regression: the button was gated behind an onCreateConversation prop that
    // no caller passed, so the first screen a new user saw had nothing to click.
    render(<EmptyState />);
    expect(screen.getByRole('button', { name: /cuộc trò chuyện mới|new chat/i })).toBeInTheDocument();
  });

  it('creates a conversation and opens it', async () => {
    vi.mocked(conversationService.create).mockResolvedValue(created);
    const user = userEvent.setup();

    render(<EmptyState />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      const state = useChatStore.getState();
      expect(state.conversations).toEqual([created]);
      expect(state.currentConversationId).toBe('conv-1');
    });
  });

  it('lets a caller take over the action', async () => {
    const onCreateConversation = vi.fn();
    const user = userEvent.setup();

    render(<EmptyState onCreateConversation={onCreateConversation} />);
    await user.click(screen.getByRole('button'));

    expect(onCreateConversation).toHaveBeenCalledOnce();
    expect(conversationService.create).not.toHaveBeenCalled();
  });

  it('stays usable when creation fails', async () => {
    vi.mocked(conversationService.create).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    render(<EmptyState />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
    expect(useChatStore.getState().currentConversationId).toBeNull();
  });
});
