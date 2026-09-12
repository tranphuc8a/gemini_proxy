import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import type { ConversationResponse } from '../types';

vi.mock('../services/conversationService', () => ({
  conversationService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  },
}));

const conversation = (id: string, name: string, overrides: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id,
  name,
  created_at: 1_789_223_400,
  updated_at: null,
  ...overrides,
});

const CONVERSATIONS = [
  conversation('c1', 'Kế hoạch du lịch'),
  conversation('c2', 'Deployment notes'),
  conversation('c3', 'Ôn tập tiếng Anh'),
];

const renderSidebar = (collapsed = false) => {
  const onCollapse = vi.fn();
  render(<Sidebar collapsed={collapsed} onCollapse={onCollapse} />);
  return { onCollapse };
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    conversations: CONVERSATIONS,
    currentConversationId: 'c1',
    messages: {},
    isLoadingConversations: false,
    hasMoreConversations: false,
    nextConversationCursor: null,
  });
});

describe('Sidebar', () => {
  it('lists every conversation', () => {
    renderSidebar();
    CONVERSATIONS.forEach((c) => expect(screen.getByText(c.name)).toBeInTheDocument());
  });

  it('selects a conversation on click', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText('Deployment notes'));

    expect(useChatStore.getState().currentConversationId).toBe('c2');
  });

  describe('search', () => {
    it('filters by name', async () => {
      const user = userEvent.setup();
      renderSidebar();

      await user.type(screen.getByRole('textbox'), 'deployment');

      expect(screen.getByText('Deployment notes')).toBeInTheDocument();
      expect(screen.queryByText('Kế hoạch du lịch')).not.toBeInTheDocument();
    });

    it('matches Vietnamese text typed without diacritics', async () => {
      // "ke hoach" should find "Kế hoạch" — nobody types the accents to search.
      const user = userEvent.setup();
      renderSidebar();

      await user.type(screen.getByRole('textbox'), 'ke hoach');

      expect(screen.getByText('Kế hoạch du lịch')).toBeInTheDocument();
      expect(screen.queryByText('Deployment notes')).not.toBeInTheDocument();
    });

    it('says so when nothing matches', async () => {
      const user = userEvent.setup();
      renderSidebar();

      await user.type(screen.getByRole('textbox'), 'zzzz');

      expect(screen.getByText(/không tìm thấy|no conversations match/i)).toBeInTheDocument();
    });
  });

  describe('new chat', () => {
    it('creates a conversation and opens it', async () => {
      const created = conversation('c4', 'New Conversation');
      vi.mocked(conversationService.create).mockResolvedValue(created);
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: /cuộc trò chuyện mới|new chat/i }));

      await waitFor(() => {
        const state = useChatStore.getState();
        expect(state.currentConversationId).toBe('c4');
        expect(state.conversations[0].id).toBe('c4');
      });
    });

    it('leaves the list untouched when creation fails', async () => {
      vi.mocked(conversationService.create).mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: /cuộc trò chuyện mới|new chat/i }));

      await waitFor(() => {
        expect(useChatStore.getState().conversations).toHaveLength(3);
      });
    });
  });

  describe('rename', () => {
    /** The rename modal, told apart from the dropdown overlay that shares its role. */
    const findRenameDialog = () =>
      screen.findByRole('dialog', { name: /đổi tên cuộc trò chuyện|rename conversation/i });

    const openRenameDialog = async () => {
      const user = userEvent.setup();
      renderSidebar();

      const row = screen.getByText('Deployment notes').closest('.conversation-item') as HTMLElement;
      await user.click(within(row).getByRole('button'));
      await user.click(await screen.findByText(/đổi tên|rename/i));

      return user;
    };

    it('saves a new name', async () => {
      vi.mocked(conversationService.update).mockResolvedValue(
        conversation('c2', 'Release checklist', { updated_at: 1_789_300_000 })
      );
      const user = await openRenameDialog();

      const dialog = await findRenameDialog();
      const input = within(dialog).getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Release checklist');
      await user.click(within(dialog).getByRole('button', { name: /lưu|save/i }));

      await waitFor(() => {
        expect(conversationService.update).toHaveBeenCalledWith({ id: 'c2', name: 'Release checklist' });
        expect(useChatStore.getState().conversations.find((c) => c.id === 'c2')?.name).toBe(
          'Release checklist'
        );
      });
    });

    it('refuses to save a blank name', async () => {
      const user = await openRenameDialog();

      const dialog = await findRenameDialog();
      await user.clear(within(dialog).getByRole('textbox'));
      await user.click(within(dialog).getByRole('button', { name: /lưu|save/i }));

      expect(conversationService.update).not.toHaveBeenCalled();
    });
  });

  describe('pagination', () => {
    it('hides Load more when the server says there is no more', () => {
      renderSidebar();
      expect(screen.queryByRole('button', { name: /tải thêm|load more/i })).not.toBeInTheDocument();
    });

    it('appends the next page and advances the cursor', async () => {
      useChatStore.setState({ hasMoreConversations: true, nextConversationCursor: 'c3' });
      vi.mocked(conversationService.list).mockResolvedValue({
        data: [conversation('c4', 'Older chat')],
        first_id: 'c4',
        last_id: 'c4',
        has_more: false,
      });
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: /tải thêm|load more/i }));

      await waitFor(() => {
        const state = useChatStore.getState();
        expect(state.conversations.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
        expect(state.hasMoreConversations).toBe(false);
      });
      expect(conversationService.list).toHaveBeenCalledWith(
        expect.objectContaining({ after: 'c3', order: 'desc' })
      );
    });
  });

  it('shows an empty state with no conversations at all', () => {
    useChatStore.setState({ conversations: [] });
    renderSidebar();
    expect(screen.getByText(/chưa có cuộc trò chuyện|no conversations yet/i)).toBeInTheDocument();
  });
});
