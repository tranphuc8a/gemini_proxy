import React, { useState } from 'react';
import { Layout, Menu, Button, Input, Modal, Spin, Empty, Dropdown } from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { showToast } from '../utils/toast';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const { t } = useTranslation();
  const [loadingMore, setLoadingMore] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

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

  const handleNewChat = async () => {
    try {
      const newConv = await conversationService.create();
      addConversation(newConv);
      setCurrentConversation(newConv.id);
      showToast.success(t('common.success'));
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast.error(t('errors.createConversation'));
    }
  };

  const handleRename = async (id: string) => {
    if (!newTitle.trim()) {
      showToast.warning(t('chat.renamePrompt'));
      return;
    }

    try {
      await conversationService.update({ id, name: newTitle });
      updateConversation(id, { name: newTitle });
      showToast.success(t('chat.renameSuccess'));
      setRenamingId(null);
      setNewTitle('');
    } catch (error) {
      showToast.error(t('chat.renameError'));
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('sidebar.confirmDelete'),
      onOk: async () => {
        try {
          await conversationService.delete(id);
          removeConversation(id);
          
          // If deleting current conversation, reset to null
          if (currentConversationId === id) {
            setCurrentConversation(null);
          }
          
          showToast.success(t('sidebar.deleteSuccess'));
        } catch (error) {
          showToast.error(t('sidebar.deleteError'));
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
        limit: 20,
        order: 'desc',
      });
      addConversations(result.data);
      setHasMoreConversations(result.has_more);
      setNextConversationCursor(result.last_id);
    } catch (error) {
      showToast.error(t('errors.loadConversations'));
    } finally {
      setLoadingMore(false);
    }
  };

  const getMenuItems = (): MenuProps['items'] => {
    return conversations.map((conv) => ({
      key: conv.id,
      icon: <MessageOutlined />,
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conv.name}
          </span>
          {!collapsed && (
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
                    onClick: () => handleDelete(conv.id),
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          )}
        </div>
      ),
    }));
  };

  return (
    <>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={onCollapse}
        breakpoint="lg"
        width={280}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        <div style={{ padding: '16px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={handleNewChat}
            size="large"
          >
            {!collapsed && t('sidebar.newChat')}
          </Button>
        </div>

        {isLoadingConversations ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : conversations.length === 0 ? (
          !collapsed && (
            <div style={{ padding: '20px' }}>
              <Empty
                description={t('sidebar.noConversations')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )
        ) : (
          <>
            <Menu
              mode="inline"
              selectedKeys={currentConversationId ? [currentConversationId] : []}
              items={getMenuItems()}
              onClick={({ key }) => setCurrentConversation(key)}
              style={{ borderRight: 0 }}
            />

            {!collapsed && hasMoreConversations && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <Button onClick={handleLoadMore} loading={loadingMore} block>
                  {t('sidebar.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </Sider>

      {/* Rename Modal */}
      <Modal
        title={t('chat.rename')}
        open={renamingId !== null}
        onOk={() => renamingId && handleRename(renamingId)}
        onCancel={() => {
          setRenamingId(null);
          setNewTitle('');
        }}
      >
        <Input
          placeholder={t('chat.renamePrompt')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={() => renamingId && handleRename(renamingId)}
        />
      </Modal>
    </>
  );
};
