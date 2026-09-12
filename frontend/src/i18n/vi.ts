export default {
  translation: {
    // Common
    common: {
      loading: 'Đang tải...',
      error: 'Lỗi',
      success: 'Thành công',
      cancel: 'Hủy',
      confirm: 'Xác nhận',
      delete: 'Xóa',
      edit: 'Đổi tên',
      save: 'Lưu',
      send: 'Gửi',
      search: 'Tìm kiếm',
      close: 'Đóng',
      copy: 'Sao chép',
      retry: 'Thử lại',
    },

    // Sidebar
    sidebar: {
      newChat: 'Cuộc trò chuyện mới',
      conversations: 'Cuộc trò chuyện',
      noConversations: 'Chưa có cuộc trò chuyện nào',
      noSearchResults: 'Không tìm thấy cuộc trò chuyện phù hợp',
      searchPlaceholder: 'Tìm cuộc trò chuyện...',
      loadMore: 'Tải thêm',
      confirmDelete: 'Bạn có chắc muốn xóa cuộc trò chuyện này?',
      deleteSuccess: 'Đã xóa cuộc trò chuyện',
      deleteError: 'Không thể xóa cuộc trò chuyện',
      messageCount: '{{count}} tin nhắn',
      conversationActions: 'Tùy chọn cuộc trò chuyện',
      toggle: 'Ẩn/hiện danh sách cuộc trò chuyện',
    },

    // Chat
    chat: {
      typeMessage: 'Nhập tin nhắn...',
      selectModel: 'Chọn mô hình',
      noMessages: 'Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!',
      welcomeTitle: 'Bắt đầu trò chuyện với Gemini',
      welcomeSubtitle: 'Tạo một cuộc trò chuyện mới hoặc chọn một cuộc trò chuyện có sẵn ở thanh bên.',
      loadOlderMessages: 'Tải tin nhắn cũ hơn',
      loadingOlderMessages: 'Đang tải tin nhắn cũ hơn...',
      jumpToLatest: 'Xuống tin nhắn mới nhất',
      sending: 'Đang gửi...',
      streaming: 'Đang nhận phản hồi...',
      stop: 'Dừng',
      stopped: 'Đã dừng phản hồi',
      retry: 'Thử lại',
      errorSending: 'Lỗi khi gửi tin nhắn',
      streamIncomplete: 'Kết nối bị ngắt trước khi nhận được câu trả lời',
      sendHint: 'Enter để gửi, Shift + Enter để xuống dòng',
      rename: 'Đổi tên cuộc trò chuyện',
      renamePrompt: 'Nhập tên mới cho cuộc trò chuyện',
      renameSuccess: 'Đã đổi tên cuộc trò chuyện',
      renameError: 'Không thể đổi tên cuộc trò chuyện',
      you: 'Bạn',
      copied: 'Đã chép!',
      copiedToClipboard: 'Đã sao chép vào clipboard',
      copyFailed: 'Không thể sao chép',
      copyMessage: 'Sao chép tin nhắn',
      plainText: 'văn bản',
      diagramError: 'Không thể vẽ sơ đồ, hiển thị mã nguồn:',
      exportMarkdown: 'Xuất Markdown',
      exportedOn: 'Xuất lúc {{date}}',
      exportSuccess: 'Đã xuất cuộc trò chuyện thành công',
      noMessagesToExport: 'Không có tin nhắn để xuất',
    },

    // Settings
    settings: {
      theme: 'Chủ đề',
      light: 'Chuyển sang nền sáng',
      dark: 'Chuyển sang nền tối',
      language: 'Ngôn ngữ',
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
      network: 'Lỗi kết nối mạng',
      loadConversations: 'Không thể tải danh sách cuộc trò chuyện',
      loadMessages: 'Không thể tải tin nhắn',
      createConversation: 'Không thể tạo cuộc trò chuyện mới',
      unexpected: 'Đã xảy ra lỗi ngoài dự kiến',
      reload: 'Tải lại trang',
    },
  },
};
