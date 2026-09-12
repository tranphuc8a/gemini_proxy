import React, { useMemo, useState } from 'react';
import { Layout, Menu, Button, Input, Modal, Spin, Empty, Dropdown, Drawer, Grid } from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { useAppStore } from '../store/appStore';
import { conversationService } from '../services/conversationService';
import { describeApiError } from '../services/apiClient';
import { showToast } from '../utils/toast';
import { formatTimestamp } from '../utils/helpers';
import type { MenuProps } from 'antd';
import type { ConversationResponse } from '../types';

const { Sider } = Layout;
const { useBreakpoint } = Grid;

const CONVERSATION_PAGE_SIZE = 20;
const MAX_NAME_LENGTH = 100;

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

/** Diacritic-insensitive match, so "cuoc" finds "cuộc". */
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const language = useAppStore((state) => state.language);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [query, setQuery] = useState('');

  // Below `md` the sider would eat most of a phone screen even when collapsed,
  // so it becomes an overlay drawer instead.
  const isMobile = !screens.md;

  const {
    conversations = [],
    currentConversationId,
    isLoadingConversations,
    hasMoreConversations,
    nextConversationCursor,
    setCurrentConversation,
    addConversation,
    updateConversation,
    removeConversation,
    addConversations,
    setHasMoreConversations,
    setNextConversationCursor,
  } = useChatStore();

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return conversations;
    return conversations.filter((c) => normalize(c.name || '').includes(needle));
  }, [conversations, query]);

  const handleNewChat = async () => {
    setCreating(true);
    try {
      const newConv = await conversationService.create();
      addConversation(newConv);
      setCurrentConversation(newConv.id);
      setQuery('');
      if (isMobile) onCollapse(true);
    } catch (error) {
      showToast.error(describeApiError(error, t('errors.createConversation')));
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    const name = newTitle.trim();
    if (!name) {
      showToast.warning(t('chat.renamePrompt'));
      return;
    }

    setRenaming(true);
    try {
      const updated = await conversationService.update({ id, name });
      updateConversation(id, { name: updated.name, updated_at: updated.updated_at });
      showToast.success(t('chat.renameSuccess'));
      setRenamingId(null);
      setNewTitle('');
    } catch (error) {
      showToast.error(describeApiError(error, t('chat.renameError')));
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = (conversation: ConversationResponse) => {
    Modal.confirm({
      title: t('sidebar.confirmDelete'),
      content: conversation.name,
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await conversationService.delete(conversation.id);
          removeConversation(conversation.id);
          showToast.success(t('sidebar.deleteSuccess'));
        } catch (error) {
          showToast.error(describeApiError(error, t('sidebar.deleteError')));
        }
      },
    });
  };

  const handleLoadMore = async () => {
    if (!hasMoreConversations || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await conversationService.list({
        after: nextConversationCursor || undefined,
        limit: CONVERSATION_PAGE_SIZE,
        order: 'desc',
      });
      addConversations(result.data);
      setHasMoreConversations(result.has_more);
      setNextConversationCursor(result.last_id);
    } catch (error) {
      showToast.error(describeApiError(error, t('errors.loadConversations')));
    } finally {
      setLoadingMore(false);
    }
  };

  const menuItems: MenuProps['items'] = filtered.map((conv) => ({
    key: conv.id,
    icon: <MessageOutlined />,
    label: (
      <div className="conversation-item">
        <div className="conversation-item-text">
          <span className="conversation-item-name">{conv.name}</span>
          <span className="conversation-item-meta">
            {formatTimestamp(conv.updated_at ?? conv.created_at, language)}
            {conv.messages_count ? ` · ${t('sidebar.messageCount', { count: conv.messages_count })}` : ''}
          </span>
        </div>
        <Dropdown
          menu={{
            items: [
              {
                key: 'rename',
                icon: <EditOutlined />,
                label: t('common.edit'),
                onClick: () => {
                  setRenamingId(conv.id);
                  setNewTitle(conv.name);
                },
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('common.delete'),
                danger: true,
                onClick: () => handleDelete(conv),
              },
            ],
          }}
          trigger={['click']}
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={t('sidebar.conversationActions')}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
        </Dropdown>
      </div>
    ),
  }));

  const body = (
    <div className="sidebar-body">
      <div className="sidebar-actions">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={handleNewChat}
          loading={creating}
          size="large"
        >
          {t('sidebar.newChat')}
        </Button>
        {conversations.length > 0 && (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('sidebar.searchPlaceholder')}
            aria-label={t('sidebar.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {isLoadingConversations ? (
        <div className="sidebar-status">
          <Spin indicator={<LoadingOutlined spin />} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="sidebar-status">
          <Empty
            description={query ? t('sidebar.noSearchResults') : t('sidebar.noConversations')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <>
          <Menu
            mode="inline"
            selectedKeys={currentConversationId ? [currentConversationId] : []}
            items={menuItems}
            onClick={({ key }) => {
              setCurrentConversation(key);
              if (isMobile) onCollapse(true);
            }}
            style={{ borderRight: 0 }}
          />

          {hasMoreConversations && !query && (
            <div className="sidebar-load-more">
              <Button onClick={handleLoadMore} loading={loadingMore} block>
                {t('sidebar.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renameModal = (
    <Modal
      title={t('chat.rename')}
      open={renamingId !== null}
      confirmLoading={renaming}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      onOk={() => renamingId && handleRename(renamingId)}
      onCancel={() => {
        setRenamingId(null);
        setNewTitle('');
      }}
    >
      <Input
        autoFocus
        maxLength={MAX_NAME_LENGTH}
        showCount
        placeholder={t('chat.renamePrompt')}
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onPressEnter={() => renamingId && handleRename(renamingId)}
      />
    </Modal>
  );

  if (isMobile) {
    return (
      <>
        <Drawer
          placement="left"
          open={!collapsed}
          onClose={() => onCollapse(true)}
          width={300}
          styles={{ body: { padding: 0 } }}
          title={t('sidebar.conversations')}
          className="sidebar-drawer"
        >
          {body}
        </Drawer>
        {renameModal}
      </>
    );
  }

  return (
    <>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={onCollapse}
        breakpoint="lg"
        width={300}
        collapsedWidth={80}
        className="app-sider"
      >
        {collapsed ? (
          <div className="sidebar-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={handleNewChat}
              loading={creating}
              size="large"
              title={t('sidebar.newChat')}
              aria-label={t('sidebar.newChat')}
            />
          </div>
        ) : (
          body
        )}
      </Sider>
      {renameModal}
    </>
  );
};
