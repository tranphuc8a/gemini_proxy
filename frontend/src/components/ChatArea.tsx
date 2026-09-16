import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Layout,
  Input,
  Button,
  Select,
  Space,
  Empty,
  Spin,
  Avatar,
  Tooltip,
  Typography,
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  LoadingOutlined,
  CopyOutlined,
  DownloadOutlined,
  StopOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { useAppStore } from '../store/appStore';
import { conversationService } from '../services/conversationService';
import { geminiService } from '../services/geminiService';
import { describeApiError } from '../services/apiClient';
import { EModel, ERole, type ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EmptyState } from './EmptyState';
import { showToast } from '../utils/toast';
import { formatDateTime, formatTime, toSafeFilename } from '../utils/helpers';

const { Content } = Layout;
const { TextArea } = Input;
const { Title } = Typography;

const MESSAGE_PAGE_SIZE = 20;
/** How close to the bottom still counts as "following along". */
const FOLLOW_THRESHOLD_PX = 120;
/** How close to the top triggers loading the previous page. */
const LOAD_OLDER_THRESHOLD_PX = 120;

/** A locally-created id, not yet confirmed by the server. */
const isTemporaryId = (id: string) => id.startsWith('temp-');

interface MessageBubbleProps {
  message: ChatMessage;
  language: string;
  onCopy: (content: string) => void;
  onRetry?: () => void;
}

/**
 * One message.
 *
 * Memoised because streaming updates the store on every chunk: without this,
 * each chunk re-rendered — and re-parsed the Markdown of — every message in the
 * conversation, which is what made long answers stutter.
 */
const MessageBubble = memo<MessageBubbleProps>(({ message, language, onCopy, onRetry }) => {
  const { t } = useTranslation();
  const isUser = message.role === ERole.USER;

  return (
    <div
      className={`chat-row ${isUser ? 'chat-row-user' : 'chat-row-assistant'}`}
      data-testid={`message-${message.id}`}
    >
      <div className={isUser ? 'chat-message-user' : 'chat-message-assistant'}>
        <div className="chat-message-head">
          <Space align="center" size="small">
            <Avatar
              size="small"
              icon={isUser ? <UserOutlined /> : <RobotOutlined />}
              style={{ backgroundColor: isUser ? '#40a9ff' : '#52c41a' }}
            />
            <span className="chat-message-author">{isUser ? t('chat.you') : 'Gemini'}</span>
            <Tooltip title={formatDateTime(message.created_at, language)}>
              <span className="chat-message-time">{formatTime(message.created_at, language)}</span>
            </Tooltip>
          </Space>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => onCopy(message.content)}
            title={t('chat.copyMessage')}
            aria-label={t('chat.copyMessage')}
            className="message-copy-btn"
          />
        </div>

        <div className="chat-message-body">
          {message.isStreaming && !message.content ? (
            <Space size="small">
              <Spin indicator={<LoadingOutlined spin />} size="small" />
              <span className="chat-message-time">{t('chat.streaming')}</span>
            </Space>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}

          {message.error && (
            <div className="chat-message-error" role="alert">
              <span>{message.error}</span>
              {onRetry && (
                <Button type="link" size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                  {t('chat.retry')}
                </Button>
              )}
            </div>
          )}
        </div>

        {!message.isStreaming && message.content && (
          <div className="chat-message-foot">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopy(message.content)}
              className="message-copy-btn-bottom"
            >
              {t('chat.copyMessage')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

export const ChatArea: React.FC = () => {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<EModel>(EModel.GEMINI_2_5_FLASH);
  const [isSending, setIsSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Whether the viewport should track new content; false once the user scrolls up. */
  const followOutputRef = useRef(true);
  /**
   * In-flight guard for paging, as a ref rather than the `loadingOlder` state.
   *
   * A scroll fires dozens of events per gesture. Reading the state meant every
   * one of them saw the stale `false` that was captured when the handler was
   * built, so hitting the top fetched the same page several times over and the
   * list jumped as each arrival was prepended.
   */
  const loadingOlderRef = useRef(false);
  /** Scroll anchor captured before older messages are prepended. */
  const anchorRef = useRef<{ height: number; top: number } | null>(null);
  /** Coalesces scroll handling to one run per frame. */
  const scrollFrameRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** True while an IME composition is in progress (Vietnamese, Chinese, …). */
  const composingRef = useRef(false);

  const {
    currentConversationId,
    conversations,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    nextMessageCursor,
    addMessage,
    updateMessage,
    replaceMessageId,
    removeMessage,
    setMessages,
    setLoadingMessages,
    setHasMoreMessages,
    setNextMessageCursor,
    markConversationActive,
    updateConversation,
  } = useChatStore();

  const currentMessages = currentConversationId ? messages[currentConversationId] || [] : [];
  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const handleCopyMessage = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        showToast.success(t('chat.copiedToClipboard'));
      } catch {
        showToast.error(t('chat.copyFailed'));
      }
    },
    [t]
  );

  // Export conversation to markdown
  const handleExportMarkdown = () => {
    if (!currentConversationId || currentMessages.length === 0) {
      showToast.warning(t('chat.noMessagesToExport'));
      return;
    }

    const conversationName = currentConversation?.name || 'Conversation';

    let markdown = `# ${conversationName}\n\n`;
    markdown += `*${t('chat.exportedOn', { date: formatDateTime(Math.floor(Date.now() / 1000), language) })}*\n\n`;
    markdown += `---\n\n`;

    currentMessages.forEach((msg) => {
      const role = msg.role === ERole.USER ? t('chat.you') : 'Gemini';
      markdown += `## ${role} - ${formatDateTime(msg.created_at, language)}\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${toSafeFilename(conversationName)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast.success(t('chat.exportSuccess'));
  };

  const loadRecentMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      try {
        // Newest first from the API, then reversed for chronological display.
        const result = await conversationService.getMessages(conversationId, {
          limit: MESSAGE_PAGE_SIZE,
          order: 'desc',
        });

        const messagesInOrder = [...result.data].reverse();
        setMessages(conversationId, messagesInOrder);
        setHasMoreMessages(conversationId, result.has_more);
        // The cursor is the oldest message on screen: the next page continues
        // backwards from there.
        setNextMessageCursor(conversationId, messagesInOrder[0]?.id ?? null);

        followOutputRef.current = true;
        scrollToBottom('auto');
      } catch (error) {
        showToast.error(describeApiError(error, t('errors.loadMessages')));
      } finally {
        setLoadingMessages(false);
      }
    },
    [scrollToBottom, setHasMoreMessages, setLoadingMessages, setMessages, setNextMessageCursor, t]
  );

  const loadOlderMessages = useCallback(async () => {
    if (!currentConversationId || !hasMoreMessages[currentConversationId] || loadingOlderRef.current) return;

    const cursor = nextMessageCursor[currentConversationId];
    // A cursor that never reached the server is not a cursor the server can
    // resolve; skip rather than asking it to page from a placeholder id.
    if (!cursor || isTemporaryId(cursor)) {
      setHasMoreMessages(currentConversationId, false);
      return;
    }

    // Set before the first await, so a second scroll event in the same gesture
    // sees it. `setLoadingOlder` only drives the spinner.
    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const listElement = listRef.current;
    // Handed to the layout effect below, which restores the position once React
    // has actually put the new messages in the DOM.
    anchorRef.current = listElement
      ? { height: listElement.scrollHeight, top: listElement.scrollTop }
      : null;

    try {
      const result = await conversationService.getMessages(currentConversationId, {
        after: cursor,
        limit: MESSAGE_PAGE_SIZE,
        order: 'desc',
      });

      const olderMessagesInOrder = [...result.data].reverse();
      const existingMessages = useChatStore.getState().messages[currentConversationId] || [];
      setMessages(currentConversationId, [...olderMessagesInOrder, ...existingMessages]);
      setHasMoreMessages(currentConversationId, result.has_more);
      if (olderMessagesInOrder.length > 0) {
        setNextMessageCursor(currentConversationId, olderMessagesInOrder[0].id);
      }

    } catch (error) {
      showToast.error(describeApiError(error, t('errors.loadMessages')));
      anchorRef.current = null;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [
    currentConversationId,
    hasMoreMessages,
    nextMessageCursor,
    setHasMoreMessages,
    setMessages,
    setNextMessageCursor,
    t,
  ]);

  // Load messages the first time a conversation is opened.
  useEffect(() => {
    if (currentConversationId && !useChatStore.getState().messages[currentConversationId]) {
      loadRecentMessages(currentConversationId);
    }
  }, [currentConversationId, loadRecentMessages]);

  // Abandon an in-flight answer when the user navigates away from it.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [currentConversationId]);

  /**
   * Track the scroll position.
   *
   * Auto-scroll follows new content only while the user is already at the
   * bottom — reading back through an answer should not yank the view forward —
   * and reaching the top pulls in the previous page.
   */
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const measure = () => {
      scrollFrameRef.current = null;
      const { scrollTop, scrollHeight, clientHeight } = listElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      followOutputRef.current = distanceFromBottom < FOLLOW_THRESHOLD_PX;
      // Only when it actually flips: this used to run on every scroll event, so
      // a single flick re-rendered the whole message list dozens of times and
      // the scrolling stuttered.
      setShowJumpToLatest((shown) => {
        const next = distanceFromBottom > FOLLOW_THRESHOLD_PX * 3;
        return next === shown ? shown : next;
      });

      if (scrollTop < LOAD_OLDER_THRESHOLD_PX) loadOlderMessages();
    };

    // Scroll fires far faster than the screen refreshes; coalescing to one run
    // per frame is what makes reading back through a long chat smooth.
    const handleScroll = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(measure);
    };

    listElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      listElement.removeEventListener('scroll', handleScroll);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    };
  }, [loadOlderMessages]);

  /**
   * Put the reading position back where it was after older messages are added.
   *
   * A layout effect, not `requestAnimationFrame`: this has to run after React
   * has put the new nodes in the DOM but *before* the browser paints, or the
   * user sees the list jump to the top and snap back. The old rAF version
   * measured whenever the next frame happened to arrive, which was sometimes
   * before the commit and so corrected by the wrong amount.
   */
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const listElement = listRef.current;
    if (!anchor || !listElement) return;
    anchorRef.current = null;
    listElement.scrollTop = anchor.top + (listElement.scrollHeight - anchor.height);
  }, [currentMessages.length]);

  // Follow the answer as it streams in, but only if the user is still at the bottom.
  const lastMessage = currentMessages[currentMessages.length - 1];
  const streamedLength = lastMessage?.isStreaming ? lastMessage.content.length : 0;
  useEffect(() => {
    if (followOutputRef.current) scrollToBottom('auto');
  }, [streamedLength, currentMessages.length, scrollToBottom]);

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  /**
   * Ask a question and stream the answer.
   *
   * `existingQuestion` marks a retry: the question is already on screen and
   * already stored server-side, so it is neither re-rendered nor re-filed —
   * only a fresh answer is requested against the same record.
   */
  const sendMessage = useCallback(
    async (text: string, existingQuestion?: { localId: string; serverId?: string }) => {
      const conversationId = currentConversationId;
      if (!conversationId) return;

      const now = Math.floor(Date.now() / 1000);
      const userMessageId = existingQuestion?.localId ?? `temp-user-${Date.now()}`;
      const assistantMessageId = `temp-assistant-${Date.now()}`;

      if (!existingQuestion) {
        addMessage(conversationId, {
          id: userMessageId,
          conversation_id: conversationId,
          role: ERole.USER,
          content: text,
          created_at: now,
          pending: true,
        });
      }
      addMessage(conversationId, {
        id: assistantMessageId,
        conversation_id: conversationId,
        role: ERole.MODEL,
        content: '',
        created_at: now,
        isStreaming: true,
        pending: true,
      });

      setIsSending(true);
      followOutputRef.current = true;
      scrollToBottom('auto');

      const controller = new AbortController();
      abortRef.current = controller;

      // Accumulated outside the store so each chunk is one cheap string append
      // rather than a read-modify-write of the whole message list.
      let answer = '';

      const finish = () => {
        setIsSending(false);
        abortRef.current = null;
      };

      await geminiService.queryStream(
        {
          conversation_id: conversationId,
          content: text,
          model: selectedModel,
          message_id: existingQuestion?.serverId,
        },
        {
          onChunk: (chunk) => {
            answer += chunk;
            updateMessage(conversationId, assistantMessageId, { content: answer });
          },
          onComplete: (completion) => {
            updateMessage(conversationId, assistantMessageId, { isStreaming: false, pending: false });
            // Adopt the server's ids so pagination and future reloads line up.
            if (completion.user_message_id) {
              replaceMessageId(conversationId, userMessageId, completion.user_message_id);
            }
            if (completion.message_id) {
              replaceMessageId(conversationId, assistantMessageId, completion.message_id);
            }
            markConversationActive(conversationId);
            // The backend titles a new conversation from its first message.
            conversationService
              .get(conversationId)
              .then((conv) => updateConversation(conversationId, { name: conv.name, updated_at: conv.updated_at }))
              .catch(() => undefined);
            finish();
          },
          onError: (error, failure) => {
            const detail = error.message || t('chat.errorSending');
            updateMessage(conversationId, assistantMessageId, { isStreaming: false, error: detail });
            // The server stored the question before it failed; adopting that id
            // lets a retry update the record instead of filing a duplicate.
            if (failure?.user_message_id) {
              replaceMessageId(conversationId, userMessageId, failure.user_message_id);
            }
            showToast.error(detail);
            finish();
          },
          onAbort: () => {
            updateMessage(conversationId, assistantMessageId, {
              isStreaming: false,
              error: answer ? undefined : t('chat.stopped'),
            });
            showToast.info(t('chat.stopped'));
            finish();
          },
        },
        controller.signal
      );
    },
    [
      addMessage,
      currentConversationId,
      markConversationActive,
      replaceMessageId,
      scrollToBottom,
      selectedModel,
      t,
      updateConversation,
      updateMessage,
    ]
  );

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || !currentConversationId || isSending) return;
    setInputValue('');
    sendMessage(text);
  };

  /** Re-ask the last question after a failure, dropping the failed answer. */
  const handleRetry = (failedMessage: ChatMessage) => {
    if (!currentConversationId || isSending) return;
    const index = currentMessages.findIndex((m) => m.id === failedMessage.id);
    const question = [...currentMessages.slice(0, index)].reverse().find((m) => m.role === ERole.USER);
    if (!question) return;

    removeMessage(currentConversationId, failedMessage.id);
    sendMessage(question.content, {
      localId: question.id,
      // Only a server id is meaningful here; a placeholder means the question
      // never reached the database, so it should be filed fresh.
      serverId: isTemporaryId(question.id) ? undefined : question.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter mid-composition is the IME accepting a candidate — for Vietnamese
    // or Chinese input that keystroke belongs to the editor, not to us.
    if (e.key !== 'Enter' || e.shiftKey || composingRef.current || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSend();
  };

  if (!currentConversationId) {
    return (
      <Content className="chat-empty-content">
        <EmptyState />
      </Content>
    );
  }

  return (
    <Content className="chat-content">
      <div className="chat-header">
        <div className="chat-header-title">
          <Title level={4} ellipsis={{ tooltip: currentConversation?.name }} style={{ margin: 0 }}>
            {currentConversation?.name || t('sidebar.conversations')}
          </Title>
        </div>
        <Space wrap>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            aria-label={t('chat.selectModel')}
            className="chat-model-select"
            options={Object.values(EModel).map((model) => ({
              label: t(`models.${model}`),
              value: model,
            }))}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportMarkdown}
            disabled={currentMessages.length === 0}
          >
            {t('chat.exportMarkdown')}
          </Button>
        </Space>
      </div>

      <div className="chat-messages" ref={listRef}>
        {loadingOlder && (
          <div className="chat-list-status">
            <Spin size="small" /> <span>{t('chat.loadingOlderMessages')}</span>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="chat-list-status chat-list-status-large">
            <Spin size="large" />
          </div>
        ) : currentMessages.length === 0 ? (
          <Empty description={t('chat.noMessages')} />
        ) : (
          currentMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              language={language}
              onCopy={handleCopyMessage}
              onRetry={msg.error ? () => handleRetry(msg) : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {showJumpToLatest && (
        <Button
          className="chat-jump-latest"
          shape="circle"
          icon={<ArrowDownOutlined />}
          onClick={() => {
            followOutputRef.current = true;
            scrollToBottom();
          }}
          title={t('chat.jumpToLatest')}
          aria-label={t('chat.jumpToLatest')}
        />
      )}

      <div className="chat-input-area">
        <div className="chat-input-row">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            placeholder={t('chat.typeMessage')}
            autoSize={{ minRows: 2, maxRows: 8 }}
            className="chat-input"
            aria-label={t('chat.typeMessage')}
          />
          {isSending ? (
            <Button danger icon={<StopOutlined />} onClick={handleStop} size="large" className="chat-send-btn">
              {t('chat.stop')}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!inputValue.trim()}
              size="large"
              className="chat-send-btn"
            >
              {t('common.send')}
            </Button>
          )}
        </div>
        <div className="chat-input-hint">{t('chat.sendHint')}</div>
      </div>
    </Content>
  );
};
