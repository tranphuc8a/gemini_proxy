# Troubleshooting: Màn Hình Trắng (White Screen)

## Vấn đề
Khi truy cập `http://localhost:5173/` thấy màn hình trắng, không có gì hiển thị.

## Các bước kiểm tra và sửa lỗi

### 1. Kiểm tra Browser Console (QUAN TRỌNG NHẤT)

**Cách làm:**
1. Mở trình duyệt tại `http://localhost:5173/`
2. Nhấn **F12** để mở DevTools
3. Click tab **Console**
4. Xem error messages màu đỏ

**Lỗi thường gặp:**

#### A. CORS Error
```
Access to fetch at 'http://localhost:6789/api/v1/...' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Giải pháp:**
- ✅ Đã fix: File `backend/fastapi/src/main.py` đã có CORS middleware
- Restart backend nếu đã chạy trước khi thêm CORS:
  ```powershell
  cd backend\fastapi
  python -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0
  ```

#### B. Cannot read properties of undefined
```
TypeError: Cannot read properties of undefined (reading '...')
```

**Giải pháp:**
- Có thể có lỗi trong code
- Check file nào báo lỗi và xem line number
- Thường do import sai hoặc component chưa render đúng

#### C. Module not found
```
Error: Cannot find module '...'
```

**Giải pháp:**
```powershell
cd frontend
npm install
```

### 2. Kiểm tra Backend có chạy không

**Test:**
```powershell
curl http://localhost:6789/health
```

**Kết quả mong đợi:**
```json
{"data": "ok", "message": "ok", "status_code": 200}
```

**Nếu không connect được:**
```powershell
# Start backend
cd backend\fastapi
python -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0
```

### 3. Kiểm tra Frontend dev server

**Terminal output phải thấy:**
```
VITE v7.2.2  ready in XXX ms
➜  Local:   http://localhost:5173/
```

**Nếu có lỗi compile:**
```powershell
cd frontend
npm run build
```
Xem lỗi TypeScript và fix theo error messages.

### 4. Clear cache và restart

```powershell
# Trong thư mục frontend
rm -r node_modules\.vite
npm run dev
```

Hoặc trong browser:
- Nhấn **Ctrl + Shift + R** (hard refresh)
- Hoặc **Ctrl + F5**

### 5. Kiểm tra Network tab

1. Mở DevTools (F12) → Tab **Network**
2. Refresh trang
3. Xem request nào bị fail (màu đỏ)
4. Click vào request đó xem error details

**Request quan trọng:**
- `GET /api/v1/conversations` - Load danh sách conversations
- Status 200 = OK
- Status 404/500 = Backend error
- Status 0 / Failed = CORS hoặc backend không chạy

### 6. Test với trang đơn giản

Tạm thời sửa `frontend/src/App.tsx` thành:

```tsx
function App() {
  return <div style={{ padding: '20px' }}>
    <h1>Hello Gemini Chat!</h1>
    <p>If you see this, React is working.</p>
  </div>;
}

export default App;
```

Refresh browser:
- **Thấy text** → React OK, vấn đề ở components phức tạp
- **Vẫn trắng** → Vấn đề ở build/config

### 7. Check file .env

File `frontend/.env` phải có:
```env
VITE_API_BASE_URL=http://localhost:6789/api/v1
```

Sau khi sửa `.env`, **PHẢI restart** dev server:
```powershell
# Ctrl+C để stop
npm run dev  # start lại
```

### 8. Port đã được sử dụng

**Error:**
```
Port 5173 is already in use
```

**Giải pháp:**
```powershell
# Kill process trên port 5173
netstat -ano | findstr :5173
# Tìm PID, sau đó:
taskkill /PID <PID> /F

# Hoặc dùng port khác
npm run dev -- --port 3000
```

## Quick Fix Script

Chạy script này để start cả backend và frontend:

```powershell
.\start-app.ps1
```

Hoặc manual:

**Terminal 1 (Backend):**
```powershell
cd backend\fastapi
python -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```

## Checklist Cuối Cùng

- [ ] Backend đang chạy ở port 6789
- [ ] Frontend dev server chạy ở port 5173
- [ ] File `.env` có đúng API URL
- [ ] CORS middleware đã được thêm vào `main.py`
- [ ] Browser console không có error màu đỏ
- [ ] Network tab không có failed requests
- [ ] Đã clear cache và hard refresh (Ctrl+Shift+R)

## Vẫn không được?

1. **Check lại tất cả files đã tạo đúng chưa:**
   ```powershell
   cd frontend\src
   dir
   # Phải có: components, services, store, types, i18n, hooks, utils
   ```

2. **Reinstall dependencies:**
   ```powershell
   cd frontend
   rm -r node_modules
   rm package-lock.json
   npm install
   npm run dev
   ```

3. **Check version Node.js:**
   ```powershell
   node --version  # >= 18.x
   npm --version
   ```

4. **Try production build:**
   ```powershell
   npm run build
   npm run preview
   # Mở http://localhost:4173
   ```

5. **Tạo issue với thông tin:**
   - Screenshot browser console errors
   - Terminal output
   - `npm run build` output
   - Node version

## Log Debug

Enable verbose logging:

**Frontend:**
```tsx
// Trong App.tsx, thêm:
console.log('App loading...');
console.log('Theme:', useAppStore.getState().theme);
```

**Network logging:**
```tsx
// Trong apiClient.ts, thêm:
this.client.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method, config.url);
    return config;
  }
);
```

## Liên hệ

Nếu vẫn gặp vấn đề, cung cấp:
1. Browser console errors (screenshot)
2. Network tab (screenshot requests failed)
3. Terminal output của cả frontend và backend
4. OS và Node version

Good luck! 🚀
