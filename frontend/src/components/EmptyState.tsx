import React, { useState } from 'react';
import { Button, Typography } from 'antd';
import { PlusOutlined, MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { describeApiError } from '../services/apiClient';
import { showToast } from '../utils/toast';

const { Title, Paragraph } = Typography;

interface EmptyStateProps {
  /** Overrides the default behaviour of creating a conversation. */
  onCreateConversation?: () => void;
}

/**
 * What a user sees before picking a conversation.
 *
 * The call-to-action used to be conditional on an `onCreateConversation` prop
 * that no caller passed, so the only screen a first-time visitor saw offered
 * them nothing to click. Creating a conversation is now the component's own job,
 * and the prop is just an override.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ onCreateConversation }) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const { addConversation, setCurrentConversation } = useChatStore();

  const handleCreate = async () => {
    if (onCreateConversation) {
      onCreateConversation();
      return;
    }

    setCreating(true);
    try {
      const conversation = await conversationService.create();
      addConversation(conversation);
      setCurrentConversation(conversation.id);
    } catch (error) {
      showToast.error(describeApiError(error, t('errors.createConversation')));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <MessageOutlined />
      </div>
      <Title level={3} style={{ marginBottom: 8 }}>
        {t('chat.welcomeTitle')}
      </Title>
      <Paragraph type="secondary" className="empty-state-text">
        {t('chat.welcomeSubtitle')}
      </Paragraph>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        size="large"
        loading={creating}
        onClick={handleCreate}
      >
        {t('sidebar.newChat')}
      </Button>
    </div>
  );
};
