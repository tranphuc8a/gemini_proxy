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
      openInEditor: 'Mở trong Markdown Editor',
      sendToEditor: 'Gửi sang Markdown Editor',
      editorInboxFailed: 'Không chuyển được tài liệu sang Markdown Editor: trình duyệt chặn bộ nhớ cục bộ',
      preview: 'Xem trước',
      previewTitle: 'Xem trước {{language}}',
    },

    // So sánh hai model
    compare: {
      open: 'So sánh model',
      title: 'So sánh hai model',
      promptLabel: 'Câu hỏi (prompt)',
      promptPlaceholder: 'Hỏi cả hai model cùng một câu… (Ctrl + Enter để so sánh)',
      modelA: 'Model thứ nhất',
      modelB: 'Model thứ hai',
      versus: 'vs',
      run: 'So sánh',
      sameModel: 'Hãy chọn hai model khác nhau',
      note: 'Mỗi lần so sánh gửi hai yêu cầu và tính hai lượt vào hạn mức AI. Không có gì được lưu vào cuộc trò chuyện.',
      idle: 'Câu trả lời sẽ hiện ở đây',
      waiting: 'Đang tạo câu trả lời…',
      meta: '{{ms}} ms · {{count}} token',
    },

    // Thư viện prompt
    prompts: {
      open: 'Thư viện prompt',
      title: 'Thư viện prompt',
      search: 'Tìm prompt…',
      insertHint: 'Bấm vào một prompt để chèn vào ô nhập — chưa gửi gì cho tới khi bạn bấm Gửi.',
      mine: 'Prompt của tôi',
      saveCurrent: 'Lưu nội dung ô nhập thành prompt',
      saved: 'Đã lưu prompt',
      alreadySaved: 'Prompt này đã có trong Prompt của tôi',
      saveFailed: 'Trình duyệt chặn bộ nhớ cục bộ: prompt chỉ còn đến khi tải lại trang',
      delete: 'Xoá prompt “{{title}}”',
      emptyMine: 'Chưa có prompt nào. Nhập nội dung vào ô tin nhắn rồi lưu ở đây để dùng lại.',
      noResults: 'Không có prompt phù hợp',
      groups: {
        writing: 'Viết',
        code: 'Code',
        learning: 'Học tập',
        translate: 'Dịch',
        analysis: 'Phân tích',
        summarize: 'Tóm tắt',
      },
      templates: {
        professionalEmail: {
          title: 'Email chuyên nghiệp',
          text: 'Viết một email ngắn gọn, chuyên nghiệp gửi [người nhận] về [chủ đề]. Giữ giọng văn lịch sự, thân thiện và kết thúc bằng bước tiếp theo rõ ràng.',
        },
        polishWriting: {
          title: 'Trau chuốt văn bản',
          text: 'Hãy cải thiện độ rõ ràng, ngữ pháp và mạch văn của đoạn dưới đây mà không đổi ý nghĩa, sau đó liệt kê những thay đổi chính:\n\n',
        },
        blogOutline: {
          title: 'Dàn ý bài blog',
          text: 'Lập dàn ý chi tiết cho một bài blog về [chủ đề] dành cho [đối tượng độc giả]: tiêu đề hấp dẫn, các đề mục và ý chính của từng phần.',
        },
        explainCode: {
          title: 'Giải thích code',
          text: 'Giải thích từng bước đoạn code sau làm gì, và chỉ ra lỗi hoặc trường hợp biên nếu có:\n\n```\n\n```',
        },
        reviewCode: {
          title: 'Review code',
          text: 'Review đoạn code sau về tính đúng đắn, dễ đọc, hiệu năng và bảo mật. Đề xuất cải tiến cụ thể kèm ví dụ code:\n\n```\n\n```',
        },
        writeTests: {
          title: 'Viết unit test',
          text: 'Viết unit test đầy đủ bằng [framework] cho đoạn code sau, gồm trường hợp thường, trường hợp biên và lỗi:\n\n```\n\n```',
        },
        explainSimply: {
          title: 'Giải thích dễ hiểu',
          text: 'Giải thích [khái niệm] cho người mới bắt đầu bằng một phép so sánh đơn giản và một ví dụ ngắn, rồi hỏi tôi ba câu để kiểm tra xem tôi đã hiểu chưa.',
        },
        studyPlan: {
          title: 'Kế hoạch học tập',
          text: 'Lập kế hoạch 4 tuần để học [chủ đề], mỗi tuần khoảng [số giờ] giờ: mục tiêu từng tuần, tài liệu và bài tập nhỏ.',
        },
        quizMe: {
          title: 'Kiểm tra kiến thức',
          text: 'Hỏi tôi 5 câu trắc nghiệm về [chủ đề], lần lượt từng câu. Chờ tôi trả lời rồi mới cho biết đúng hay sai và vì sao.',
        },
        translateToEnglish: {
          title: 'Dịch sang tiếng Anh',
          text: 'Dịch đoạn văn sau sang tiếng Anh tự nhiên, giữ nguyên ý nghĩa và giọng văn:\n\n',
        },
        translateToVietnamese: {
          title: 'Dịch sang tiếng Việt',
          text: 'Dịch đoạn văn sau sang tiếng Việt tự nhiên, giữ nguyên ý nghĩa và giọng văn:\n\n',
        },
        prosCons: {
          title: 'Ưu và nhược điểm',
          text: 'So sánh [phương án A] và [phương án B] cho [mục đích]: lập bảng ưu, nhược điểm của từng phương án, rồi đề xuất một phương án và giải thích lý do.',
        },
        swot: {
          title: 'Phân tích SWOT',
          text: 'Phân tích SWOT (điểm mạnh, điểm yếu, cơ hội, thách thức) cho [dự án hoặc doanh nghiệp], rồi đề xuất ba hành động dựa trên kết quả đó.',
        },
        rootCause: {
          title: 'Tìm nguyên nhân gốc',
          text: 'Dùng kỹ thuật "5 câu hỏi tại sao" giúp tôi tìm nguyên nhân gốc của vấn đề này: [mô tả vấn đề]',
        },
        keyPoints: {
          title: 'Ý chính',
          text: 'Tóm tắt đoạn văn sau thành 5 gạch đầu dòng, giữ lại những dữ kiện và số liệu quan trọng nhất:\n\n',
        },
        shortSummary: {
          title: 'Tóm tắt một đoạn',
          text: 'Tóm tắt nội dung sau trong một đoạn ngắn (dưới 80 từ) cho người chưa đọc:\n\n',
        },
        meetingNotes: {
          title: 'Biên bản cuộc họp',
          text: 'Chuyển ghi chép cuộc họp sau thành bản tóm tắt gồm: các quyết định, việc cần làm (người phụ trách, hạn chót) và các câu hỏi còn bỏ ngỏ:\n\n',
        },
      },
    },

    // Cổng AI (so sánh model)
    ai: {
      codeLabel: 'Mã truy cập AI',
      unlock: 'Mở khoá',
      codeHint: 'Tính năng này dùng AI của máy chủ và cần mã truy cập.',
      unlocked: 'Đã mở khoá AI',
      errors: {
        network: 'Không kết nối được máy chủ',
        aborted: 'Đã huỷ yêu cầu',
        badResponse: 'Máy chủ trả về phản hồi không hợp lệ (HTTP {{status}})',
        http: 'Yêu cầu AI thất bại (HTTP {{status}})',
      },
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
