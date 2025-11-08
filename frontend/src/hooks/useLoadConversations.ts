import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { showToast } from '../utils/toast';

export const useLoadConversations = () => {
  const { t } = useTranslation();
  const {
    setConversations,
    setLoadingConversations,
    setHasMoreConversations,
    setNextConversationCursor,
  } = useChatStore();

  useEffect(() => {
    const loadInitialConversations = async () => {
      setLoadingConversations(true);
      try {
        const result = await conversationService.list({
          limit: 20,
          order: 'desc',
        });
        
        // Check if result is valid
        if (!result || !Array.isArray(result.data)) {
          console.warn('⚠️ Invalid API response:', result);
          setConversations([]);
          setHasMoreConversations(false);
          setNextConversationCursor(null);
          return;
        }
        
        console.log('📋 Loaded conversations:', result.data.length);
        setConversations(result.data);
        setHasMoreConversations(result.has_more || false);
        setNextConversationCursor(result.last_id || null);
      } catch (error) {
        console.error('❌ Failed to load conversations:', error);
        showToast.error(t('errors.loadConversations'));
        // Set default empty state on error
        setConversations([]);
        setHasMoreConversations(false);
        setNextConversationCursor(null);
      } finally {
        setLoadingConversations(false);
      }
    };

    loadInitialConversations();
  }, []);
};
