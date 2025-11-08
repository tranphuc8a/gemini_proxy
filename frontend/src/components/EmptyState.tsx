import React from 'react';
import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  onCreateConversation?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onCreateConversation }) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
      }}
    >
      <Empty
        description={
          <div>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>
              {t('chat.noMessages')}
            </p>
            {onCreateConversation && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                onClick={onCreateConversation}
              >
                {t('sidebar.newChat')}
              </Button>
            )}
          </div>
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </div>
  );
};
