import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { describeApiError } from '../services/apiClient';
import { showToast } from '../utils/toast';

const CONVERSATION_PAGE_SIZE = 20;

/** Fetches the first page of conversations once, when the app mounts. */
export const useLoadConversations = () => {
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    // Read the actions off the store directly: subscribing to them would make
    // this effect depend on values that are stable anyway.
    const {
      setConversations,
      setLoadingConversations,
      setHasMoreConversations,
      setNextConversationCursor,
    } = useChatStore.getState();

    const loadInitialConversations = async () => {
      setLoadingConversations(true);
      try {
        const result = await conversationService.list({
          limit: CONVERSATION_PAGE_SIZE,
          order: 'desc',
        });
        if (cancelled) return;

        if (!result || !Array.isArray(result.data)) {
          setConversations([]);
          setHasMoreConversations(false);
          setNextConversationCursor(null);
          return;
        }

        setConversations(result.data);
        setHasMoreConversations(result.has_more || false);
        setNextConversationCursor(result.last_id || null);
      } catch (error) {
        if (cancelled) return;
        showToast.error(describeApiError(error, t('errors.loadConversations')));
        setConversations([]);
        setHasMoreConversations(false);
        setNextConversationCursor(null);
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    };

    loadInitialConversations();
    return () => {
      cancelled = true;
    };
  }, [t]);
};
