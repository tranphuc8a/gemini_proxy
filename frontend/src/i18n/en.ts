export default {
  translation: {
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Rename',
      save: 'Save',
      send: 'Send',
      search: 'Search',
      close: 'Close',
      copy: 'Copy',
      retry: 'Retry',
    },

    // Sidebar
    sidebar: {
      newChat: 'New Chat',
      conversations: 'Conversations',
      noConversations: 'No conversations yet',
      noSearchResults: 'No conversations match your search',
      searchPlaceholder: 'Search conversations...',
      loadMore: 'Load More',
      confirmDelete: 'Are you sure you want to delete this conversation?',
      deleteSuccess: 'Conversation deleted',
      deleteError: 'Failed to delete conversation',
      messageCount: '{{count}} message',
      messageCount_other: '{{count}} messages',
      conversationActions: 'Conversation actions',
      toggle: 'Toggle conversation list',
    },

    // Chat
    chat: {
      typeMessage: 'Type a message...',
      selectModel: 'Select Model',
      noMessages: 'No messages yet. Start a conversation!',
      welcomeTitle: 'Start chatting with Gemini',
      welcomeSubtitle: 'Create a new conversation, or pick one from the sidebar.',
      loadOlderMessages: 'Load Older Messages',
      loadingOlderMessages: 'Loading older messages...',
      jumpToLatest: 'Jump to latest',
      sending: 'Sending...',
      streaming: 'Receiving response...',
      stop: 'Stop',
      stopped: 'Generation stopped',
      retry: 'Retry',
      errorSending: 'Error sending message',
      sendHint: 'Enter to send, Shift + Enter for a new line',
      rename: 'Rename Conversation',
      renamePrompt: 'Enter new conversation name',
      renameSuccess: 'Conversation renamed',
      renameError: 'Failed to rename conversation',
      you: 'You',
      copied: 'Copied!',
      copiedToClipboard: 'Copied to clipboard',
      copyFailed: 'Failed to copy',
      copyMessage: 'Copy message',
      plainText: 'text',
      diagramError: 'Could not render the diagram; showing its source:',
      exportMarkdown: 'Export Markdown',
      exportedOn: 'Exported on {{date}}',
      exportSuccess: 'Conversation exported successfully',
      noMessagesToExport: 'No messages to export',
    },

    // Settings
    settings: {
      theme: 'Theme',
      light: 'Switch to light theme',
      dark: 'Switch to dark theme',
      language: 'Language',
      vietnamese: 'Tiếng Việt',
      english: 'English',
    },

    // Models
    models: {
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
      'gemini-flash-latest': 'Gemini Flash Latest',
    },

    // Errors
    errors: {
      network: 'Network error',
      loadConversations: 'Failed to load conversations',
      loadMessages: 'Failed to load messages',
      createConversation: 'Failed to create new conversation',
      unexpected: 'An unexpected error occurred',
      reload: 'Reload page',
    },
  },
};
