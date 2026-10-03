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
      streamIncomplete: 'The connection closed before any answer arrived',
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
      openInEditor: 'Open in Markdown Editor',
      sendToEditor: 'Send to Markdown Editor',
      editorInboxFailed: 'Could not hand the document to Markdown Editor: browser storage is unavailable',
      preview: 'Preview',
      previewTitle: '{{language}} preview',
    },

    // Compare two models
    compare: {
      open: 'Compare models',
      title: 'Compare two models',
      promptLabel: 'Prompt',
      promptPlaceholder: 'Ask both models the same thing… (Ctrl + Enter to compare)',
      modelA: 'First model',
      modelB: 'Second model',
      versus: 'vs',
      run: 'Compare',
      sameModel: 'Pick two different models',
      note: 'Each comparison sends two requests and counts twice against the AI limits. Nothing is saved to the conversation.',
      idle: 'The answer will appear here',
      waiting: 'Generating the answer…',
      meta: '{{ms}} ms · {{count}} token',
      meta_other: '{{ms}} ms · {{count}} tokens',
    },

    // Prompt library
    prompts: {
      open: 'Prompt library',
      title: 'Prompt library',
      search: 'Search prompts…',
      insertHint: 'Click a prompt to put it in the message box — nothing is sent until you press Send.',
      mine: 'My prompts',
      saveCurrent: 'Save the message box as a prompt',
      saved: 'Prompt saved',
      alreadySaved: 'This prompt is already in My prompts',
      saveFailed: 'Browser storage is unavailable: the prompt only lasts until you reload',
      delete: 'Delete prompt “{{title}}”',
      emptyMine: 'No prompts yet. Type one in the message box, then save it here to reuse it.',
      noResults: 'No prompts match your search',
      groups: {
        writing: 'Writing',
        code: 'Code',
        learning: 'Learning',
        translate: 'Translate',
        analysis: 'Analysis',
        summarize: 'Summarize',
      },
      templates: {
        professionalEmail: {
          title: 'Professional email',
          text: 'Write a concise, professional email to [recipient] about [topic]. Keep the tone polite and friendly, and end with a clear next step.',
        },
        polishWriting: {
          title: 'Polish my writing',
          text: 'Improve the clarity, grammar and flow of the text below without changing its meaning, then list the main changes you made:\n\n',
        },
        blogOutline: {
          title: 'Blog post outline',
          text: 'Draft a detailed outline for a blog post about [topic] for [audience]: a catchy title, section headings and the key points of each section.',
        },
        explainCode: {
          title: 'Explain code',
          text: 'Explain step by step what the following code does, and point out any bugs or edge cases:\n\n```\n\n```',
        },
        reviewCode: {
          title: 'Code review',
          text: 'Review the following code for correctness, readability, performance and security. Suggest concrete improvements with code examples:\n\n```\n\n```',
        },
        writeTests: {
          title: 'Write unit tests',
          text: 'Write thorough unit tests with [framework] for the following code, covering normal cases, edge cases and errors:\n\n```\n\n```',
        },
        explainSimply: {
          title: 'Explain it simply',
          text: 'Explain [concept] to a beginner with a simple analogy and a short example, then ask me three questions to check that I understood.',
        },
        studyPlan: {
          title: 'Study plan',
          text: 'Make a 4-week plan to learn [topic] in about [hours] hours a week: weekly goals, resources and small exercises.',
        },
        quizMe: {
          title: 'Quiz me',
          text: 'Ask me 5 multiple-choice questions about [topic], one at a time. Wait for my answer before saying whether it is right and why.',
        },
        translateToEnglish: {
          title: 'Translate to English',
          text: 'Translate the following text into natural English, keeping its meaning and tone:\n\n',
        },
        translateToVietnamese: {
          title: 'Translate to Vietnamese',
          text: 'Translate the following text into natural Vietnamese, keeping its meaning and tone:\n\n',
        },
        prosCons: {
          title: 'Pros and cons',
          text: 'Compare [option A] and [option B] for [purpose]: put the pros and cons of each in a table, then recommend one and say why.',
        },
        swot: {
          title: 'SWOT analysis',
          text: 'Do a SWOT analysis (strengths, weaknesses, opportunities, threats) of [project or business], then suggest three actions based on it.',
        },
        rootCause: {
          title: 'Find the root cause',
          text: 'Use the "5 whys" technique to help me find the root cause of this problem: [describe the problem]',
        },
        keyPoints: {
          title: 'Key points',
          text: 'Summarize the following text in 5 bullet points, keeping the most important facts and figures:\n\n',
        },
        shortSummary: {
          title: 'One-paragraph summary',
          text: 'Summarize the following in one short paragraph (under 80 words) for someone who has not read it:\n\n',
        },
        meetingNotes: {
          title: 'Meeting notes',
          text: 'Turn these meeting notes into a summary with the decisions made, the action items (owner and deadline) and the open questions:\n\n',
        },
      },
    },

    // AI gateway (compare models)
    ai: {
      codeLabel: 'AI access code',
      unlock: 'Unlock',
      codeHint: 'This feature runs on the server’s AI and needs its access code.',
      unlocked: 'AI unlocked',
      errors: {
        network: 'Cannot reach the server',
        aborted: 'The request was cancelled',
        badResponse: 'The server sent an unexpected response (HTTP {{status}})',
        http: 'The AI request failed (HTTP {{status}})',
      },
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
