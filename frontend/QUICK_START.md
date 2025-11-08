# Gemini Chat App - Quick Start Guide

## Khởi động ứng dụng

### 1. Khởi động Backend (FastAPI)

Mở terminal và chạy:

```powershell
cd backend\fastapi
.\run_fastapi.ps1
```

Hoặc:

```powershell
cd backend\fastapi
python -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0
```

Backend sẽ chạy tại: `http://localhost:6789`

### 2. Khởi động Frontend (React)

Mở terminal mới và chạy:

```powershell
cd frontend
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

## Sử dụng ứng dụng

### Tạo cuộc trò chuyện mới

1. Click nút **"Cuộc trò chuyện mới"** ở sidebar bên trái
2. Hoặc nếu chưa có conversation nào, click nút ở giữa màn hình

### Gửi tin nhắn

1. Chọn model Gemini từ dropdown ở góc phải trên (mặc định: Gemini 2.5 Flash)
2. Nhập tin nhắn vào ô input ở dưới cùng
3. Nhấn **Enter** hoặc click nút **Gửi**
4. Đợi phản hồi streaming từ Gemini (text sẽ xuất hiện từ từ)

### Quản lý cuộc trò chuyện

**Đổi tên:**
- Click icon 3 chấm bên phải tên conversation
- Chọn "Sửa"
- Nhập tên mới và nhấn OK

**Xóa:**
- Click icon 3 chấm
- Chọn "Xóa"
- Xác nhận xóa

**Chuyển đổi:**
- Click vào tên conversation trong sidebar để chuyển sang

### Xem tin nhắn cũ

- Cuộn lên đầu danh sách tin nhắn
- Click nút **"Tải tin nhắn cũ hơn"**
- Messages sẽ được load thêm (20 messages mỗi lần)

### Tải thêm conversations

- Cuộn xuống cuối sidebar
- Click nút **"Tải thêm"** nếu có
- Sẽ load thêm 20 conversations

## Tính năng giao diện

### Thay đổi chủ đề

- Click switch **"Tối/Sáng"** ở góc phải trên
- Mặc định: **Tối** (Dark mode)

### Thay đổi ngôn ngữ

- Click dropdown ngôn ngữ (VI/EN) ở góc phải trên
- Chọn **Tiếng Việt** hoặc **English**
- Mặc định: **Tiếng Việt**

### Thu gọn Sidebar

- Click icon menu (3 gạch ngang) ở góc trái trên
- Sidebar sẽ thu gọn chỉ còn icons
- Click lại để mở rộng

### Responsive (Mobile)

- Trên mobile/tablet, sidebar tự động chuyển thành drawer
- Swipe hoặc click menu để mở/đóng sidebar
- Giao diện tự động điều chỉnh cho màn hình nhỏ

## Tính năng Markdown

App hỗ trợ hiển thị đầy đủ markdown trong tin nhắn:

### Code blocks với syntax highlighting

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

### Công thức toán học (KaTeX)

**Inline:** `$E = mc^2$`

**Block:**
```
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### Mermaid diagrams

\`\`\`mermaid
graph LR
    A[Client] --> B[FastAPI]
    B --> C[Gemini API]
    C --> B
    B --> A
\`\`\`

### Tables

```
| Feature | Status |
|---------|--------|
| Chat    | ✅     |
| Stream  | ✅     |
```

## Models có sẵn

1. **Gemini 2.5 Pro** - Model mạnh nhất, phù hợp với tasks phức tạp
2. **Gemini 2.5 Flash** - Cân bằng tốc độ và chất lượng (mặc định)
3. **Gemini 2.5 Flash Lite** - Nhanh nhất, phù hợp queries đơn giản
4. **Gemini 2.0 Flash** - Phiên bản 2.0
5. **Gemini 2.0 Flash Lite** - Lite version 2.0
6. **Gemini Flash Latest** - Luôn là phiên bản Flash mới nhất

## Xử lý lỗi

### Backend không kết nối được

- Kiểm tra backend có đang chạy không (port 6789)
- Kiểm tra file `.env` có đúng `VITE_API_BASE_URL` không
- Mở DevTools (F12) xem lỗi trong Console

### Tin nhắn không gửi được

- Kiểm tra đã chọn conversation chưa
- Kiểm tra input không để trống
- Kiểm tra API key Gemini trong backend config

### Mermaid diagram không hiển thị

- Kiểm tra syntax mermaid có đúng không
- Mở Console xem error message
- Thử refresh lại trang

## Phím tắt

- **Enter**: Gửi tin nhắn
- **Shift + Enter**: Xuống dòng trong input
- **Ctrl/Cmd + K**: Focus vào search (nếu có)

## Performance Tips

- App sử dụng **cursor pagination** nên load rất nhanh
- Tin nhắn được load lazy (chỉ load khi cần)
- Streaming giúp phản hồi nhanh hơn
- Zustand store giữ state trong memory, không cần reload khi switch conversations

## Troubleshooting

### CORS errors

Nếu gặp CORS error, thêm vào FastAPI backend:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Port đã được sử dụng

**Frontend:**
```powershell
# Thay đổi port trong vite.config.ts
export default defineConfig({
  server: { port: 3000 }
})
```

**Backend:**
```powershell
# Dùng port khác
python -m uvicorn src.main:app --reload --port 8000
# Nhớ update VITE_API_BASE_URL trong .env
```

## Development

### Cấu trúc thư mục quan trọng

```
frontend/
├── src/
│   ├── components/     # React components
│   ├── services/       # API calls
│   ├── store/          # Zustand state
│   ├── types/          # TypeScript types
│   ├── i18n/           # Translations
│   └── utils/          # Helper functions
├── .env                # Environment variables
└── package.json        # Dependencies
```

### Thêm dependencies mới

```powershell
npm install <package-name>
npm install --save-dev @types/<package-name>
```

### Build production

```powershell
npm run build
npm run preview  # Preview production build
```

## Support

Nếu gặp vấn đề:
1. Check Console trong Browser DevTools (F12)
2. Check terminal Backend để xem lỗi API
3. Check file `.env` có đúng config không
4. Kiểm tra network requests trong DevTools Network tab

Chúc bạn sử dụng app vui vẻ! 🚀
