import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Input,
  Button,
  Select,
  Space,
  List,
  Empty,
  Spin,
  Avatar,
  Typography,
} from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, LoadingOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../store/chatStore';
import { conversationService } from '../services/conversationService';
import { geminiService } from '../services/geminiService';
import { EModel, ERole, type ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EmptyState } from './EmptyState';
import { showToast } from '../utils/toast';

const { Content } = Layout;
const { TextArea } = Input;
const { Title } = Typography;

export const ChatArea: React.FC = () => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState<EModel>(EModel.GEMINI_2_5_FLASH);
  const [isSending, setIsSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);

  const {
    currentConversationId,
    conversations,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    nextMessageCursor,
    addMessage,
    updateMessage,
    setMessages,
    setLoadingMessages,
    setHasMoreMessages,
    setNextMessageCursor,
  } = useChatStore();

  const currentMessages = currentConversationId ? messages[currentConversationId] || [] : [];

  // Copy message content to clipboard
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast.success(t('chat.copiedToClipboard'));
    } catch (error) {
      showToast.error(t('chat.copyFailed'));
    }
  };

  // Export conversation to markdown
  const handleExportMarkdown = () => {
    if (!currentConversationId || currentMessages.length === 0) {
      showToast.warning(t('chat.noMessagesToExport'));
      return;
    }

    // Get current conversation
    const currentConv = conversations.find(c => c.id === currentConversationId);
    const conversationName = currentConv?.name || 'Conversation';
    
    // Build markdown content
    let markdown = `# ${conversationName}\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;
    
    currentMessages.forEach((msg) => {
      const role = msg.role === ERole.USER ? t('chat.you') : 'Gemini';
      const timestamp = new Date(msg.created_at).toLocaleString();
      
      markdown += `## ${role} - ${timestamp}\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `---\n\n`;
    });
    
    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${conversationName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast.success(t('chat.exportSuccess'));
  };

  // Load recent messages when conversation changes
  useEffect(() => {
    if (currentConversationId && !messages[currentConversationId]) {
      loadRecentMessages();
    }
  }, [currentConversationId]);

  // Scroll to bottom only when flag is set
  useEffect(() => {
    if (shouldScrollToBottom && currentMessages.length > 0) {
      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom, currentMessages.length]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      // Check if user is near bottom before auto-scrolling
      const shouldAutoScroll = () => {
        if (!listRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        // Only auto-scroll if user is within 200px of bottom
        return distanceFromBottom < 200;
      };

      // Set interval to scroll during streaming
      autoScrollIntervalRef.current = window.setInterval(() => {
        if (shouldAutoScroll()) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100); // Scroll every 100ms during streaming

      return () => {
        if (autoScrollIntervalRef.current) {
          clearInterval(autoScrollIntervalRef.current);
          autoScrollIntervalRef.current = null;
        }
      };
    }
  }, [isStreaming]);

  // Auto load older messages when scrolling to top
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement || !currentConversationId) return;

    const handleScroll = () => {
      const { scrollTop } = listElement;
      
      // If scrolled near top (within 100px threshold) and can load more
      if (
        scrollTop < 100 && 
        hasMoreMessages[currentConversationId] && 
        !loadingOlder && 
        !isLoadingMessages
      ) {
        console.log('🔄 Scroll trigger: Loading older messages', { scrollTop });
        
        // Store current scroll position
        const previousScrollHeight = listElement.scrollHeight;
        const previousScrollTop = scrollTop;
        
        loadOlderMessages().then(() => {
          // Maintain scroll position after loading older messages
          requestAnimationFrame(() => {
            if (listElement) {
              const newScrollHeight = listElement.scrollHeight;
              const addedHeight = newScrollHeight - previousScrollHeight;
              const newScrollTop = previousScrollTop + addedHeight;
              listElement.scrollTop = newScrollTop;
              console.log('📍 Scroll adjusted:', {
                previousScrollTop,
                addedHeight,
                newScrollTop
              });
            }
          });
        });
      }
    };

    listElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => listElement.removeEventListener('scroll', handleScroll);
  }, [currentConversationId, hasMoreMessages, loadingOlder, isLoadingMessages]);

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadRecentMessages = async () => {
    if (!currentConversationId) return;

    setLoadingMessages(true);
    try {
      // Load most recent messages with descending order (newest first)
      const result = await conversationService.getMessages(currentConversationId, {
        limit: 20,
        order: 'desc', // Get newest messages first
      });
      
      // Reverse to display in chronological order (oldest at top, newest at bottom)
      const messagesInOrder = [...result.data].reverse();
      setMessages(currentConversationId, messagesInOrder);
      setHasMoreMessages(currentConversationId, result.has_more);
      
      // Store the ID of the FIRST message (oldest in current view) for pagination
      if (messagesInOrder.length > 0) {
        setNextMessageCursor(currentConversationId, messagesInOrder[0].id);
      }
      
      // Set flag to scroll to bottom after messages are rendered
      setShouldScrollToBottom(true);
    } catch (error) {
      showToast.error(t('errors.loadMessages'));
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!currentConversationId || !hasMoreMessages[currentConversationId] || loadingOlder) {
      console.log('⏭️ Skip loading older messages:', {
        hasConversation: !!currentConversationId,
        hasMore: currentConversationId ? hasMoreMessages[currentConversationId] : false,
        loading: loadingOlder
      });
      return Promise.resolve();
    }

    console.log('📥 Loading older messages...', {
      cursor: nextMessageCursor[currentConversationId],
      currentCount: messages[currentConversationId]?.length || 0
    });

    setLoadingOlder(true);
    try {
      // Load older messages using desc order and cursor
      const result = await conversationService.getMessages(currentConversationId, {
        after: nextMessageCursor[currentConversationId] || undefined,
        limit: 20,
        order: 'desc', // Get older messages (before cursor)
      });
      
      console.log('✅ Loaded older messages:', {
        loaded: result.data.length,
        hasMore: result.has_more
      });
      
      // Reverse API result to get chronological order, then prepend to existing messages
      const olderMessagesInOrder = [...result.data].reverse();
      const existingMessages = messages[currentConversationId] || [];
      setMessages(currentConversationId, [...olderMessagesInOrder, ...existingMessages]);
      
      setHasMoreMessages(currentConversationId, result.has_more);
      
      // Update cursor to the oldest message in the newly loaded batch
      if (olderMessagesInOrder.length > 0) {
        setNextMessageCursor(currentConversationId, olderMessagesInOrder[0].id);
      }
    } catch (error) {
      console.error('❌ Error loading older messages:', error);
      showToast.error(t('errors.loadMessages'));
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !currentConversationId || isSending) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: currentConversationId,
      role: ERole.USER,
      content: inputValue,
      created_at: Date.now(),
    };

    addMessage(currentConversationId, userMessage);
    const userContent = inputValue;
    setInputValue('');
    setIsSending(true);
    
    // Scroll to bottom when sending new message
    setShouldScrollToBottom(true);

    // Create placeholder for assistant message
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      conversation_id: currentConversationId,
      role: ERole.MODEL,
      content: '',
      created_at: Date.now(),
      isStreaming: true,
    };
    addMessage(currentConversationId, assistantMessage);
    setIsStreaming(true); // Start auto-scroll

    try {
      // Use streaming API
      await geminiService.queryStream(
        {
          conversation_id: currentConversationId,
          content: userContent,
          model: selectedModel,
        },
        (chunk) => {
          // Update assistant message with streamed content
          updateMessage(currentConversationId, assistantMessageId, {
            content: assistantMessage.content + chunk,
          });
          assistantMessage.content += chunk;
        },
        () => {
          // Stream complete
          updateMessage(currentConversationId, assistantMessageId, {
            isStreaming: false,
          });
          setIsSending(false);
          setIsStreaming(false); // Stop auto-scroll
        },
        (error) => {
          console.error('Streaming error:', error);
          updateMessage(currentConversationId, assistantMessageId, {
            isStreaming: false,
            error: t('chat.errorSending'),
          });
          setIsSending(false);
          setIsStreaming(false); // Stop auto-scroll
          showToast.error(t('chat.errorSending'));
        }
      );
    } catch (error) {
      console.error('Send error:', error);
      updateMessage(currentConversationId, assistantMessageId, {
        isStreaming: false,
        error: t('chat.errorSending'),
      });
      setIsSending(false);
      showToast.error(t('chat.errorSending'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentConversationId) {
    return (
      <Content style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState />
      </Content>
    );
  }

  return (
    <Content style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div
        className="chat-header"
        style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {conversations.find(c => c.id === currentConversationId)?.name || t('sidebar.conversations')}
        </Title>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportMarkdown}
            disabled={!currentConversationId || currentMessages.length === 0}
          >
            {t('chat.exportMarkdown')}
          </Button>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            style={{ width: 200 }}
            options={Object.values(EModel).map((model) => ({
              label: t(`models.${model}`),
              value: model,
            }))}
          />
        </Space>
      </div>

      {/* Messages List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}
      >
        {/* Loading indicator for older messages at top */}
        {loadingOlder && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <Spin tip={t('chat.loadingOlderMessages')} />
          </div>
        )}

        {isLoadingMessages ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : currentMessages.length === 0 ? (
          <Empty description={t('chat.noMessages')} />
        ) : (
          <List
            dataSource={currentMessages}
            renderItem={(msg) => (
              <List.Item
                style={{
                  border: 'none',
                  padding: '12px 0',
                  display: 'flex',
                  justifyContent: msg.role === ERole.USER ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  className={msg.role === ERole.USER ? 'chat-message-user' : 'chat-message-assistant'}
                  style={{
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space align="center" size="small">
                      <Avatar
                        size="small"
                        icon={msg.role === ERole.USER ? <UserOutlined /> : <RobotOutlined />}
                        style={{
                          backgroundColor: msg.role === ERole.USER ? '#40a9ff' : '#52c41a',
                        }}
                      />
                      <span style={{ 
                        fontWeight: 600,
                        fontSize: '13px',
                        color: msg.role === ERole.USER ? '#fff' : 'inherit',
                      }}>
                        {msg.role === ERole.USER ? t('chat.you') : 'Gemini'}
                      </span>
                    </Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopyMessage(msg.content)}
                      title={t('chat.copyMessage')}
                      className="message-copy-btn"
                      style={{
                        color: msg.role === ERole.USER ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.45)',
                      }}
                    />
                  </div>
                  <div style={{ 
                    lineHeight: '1.6',
                    color: msg.role === ERole.USER ? '#fff' : 'inherit',
                  }}>
                    {msg.isStreaming && !msg.content ? (
                      <Spin indicator={<LoadingOutlined spin />} size="small" />
                    ) : msg.error ? (
                      <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{msg.error}</span>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>
                  
                  {/* Bottom copy button */}
                  {!msg.isStreaming && msg.content && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: msg.role === ERole.USER ? 'flex-end' : 'flex-start',
                      marginTop: '4px',
                    }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyMessage(msg.content)}
                        className="message-copy-btn-bottom"
                        style={{
                          fontSize: '12px',
                          height: '24px',
                          padding: '0 8px',
                          color: msg.role === ERole.USER ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.45)',
                        }}
                      >
                        {t('chat.copyMessage')}
                      </Button>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <Space.Compact style={{ width: '100%', display: 'flex', gap: '8px' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.typeMessage')}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={isSending}
            className="chat-input"
            style={{ flex: 1, resize: 'none', fontSize: '15px' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isSending}
            disabled={!inputValue.trim() || isSending}
            size="large"
            style={{ height: 'auto', minHeight: '48px' }}
          >
            {t('common.send')}
          </Button>
        </Space.Compact>
      </div>
    </Content>
  );
};
