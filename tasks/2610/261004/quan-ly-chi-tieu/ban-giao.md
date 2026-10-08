# Bàn giao nhanh — Quản lý chi tiêu (cập nhật 2026-10-08: nhóm người, sổ khoản chung, nhập bằng AI)

Ngữ cảnh cô đọng cho phiên làm việc sau. Chi tiết: `design.md` (§12 cho đợt 2026-10-08, §11 khác biệt cũ), `requirements.md` (§3.8 FR-80…84), `report.md`, `implement-progress.md`.

## Đã xong

- App web **`backend/fastapi/webapp/tranphuc8a/quan-ly-chi-tieu/`** (HTML/CSS/JS thuần, không build, ≈ 340 KB / giới hạn NFR-06 **350 KB**). URL `/webapp/tranphuc8a/quan-ly-chi-tieu/`. App cũ `tranphuc8a/chi-tieu` không đụng.
- API **`/api/v1/spending/*`** (5 route, 3 kho json/mysql/mongo, lưu có điều kiện nguyên tử).
- **PWA** (06/10): `manifest.webmanifest`, `sw.js` ở gốc app, `assets/pwa.js`, icon vẽ bằng `quan-ly-chi-tieu/tao-bieu-tuong.py`.
- **Đợt 08/10**:
  1. **Nhóm người**: `groups[]`, `tx.groupId`, `settings.defaultGroupId` (vẫn schema 1). Thẻ nhóm + quyết toán nhóm (bảng đã trả/phần/còn lại, cách chuyển, tin nhắn, ghi nhận phần của tôi). Nhập nhanh `nhóm <tên>` / `@<tên>` / `57/N` theo nhóm mặc định. CSV thêm cột `nhom`. Mã: `ledger.js` (`groupMembers`, `personBalances(doc, groupId)`, `groupStatement`, `settleUp`, `groupSettlementMessage`), `parser.js`, `model.js` (`removePerson`), `chung.js` (UI), `views.sharing`.
  2. **Các khoản chung** (người hoặc nhóm): `ledger.sharedLedger` (lọc tháng/loại/ai trả/thành viên/nhóm/tìm) + `chung.js` (thanh lọc dính đầu hộp, 50 dòng/lần + "Hiện thêm").
  3. **Nhập bằng AI**: `POST /api/v1/ai/spending` (`ai_spending_usecase.py`, route trong `ai_controller.py`, factory) qua cổng `AiUseCase.ask` — không cache, chỉ nhận tên + id, kiểm lại mọi id/số tiền/ngày/phần chia. Client: `assets/ai.js` (cùng khoá token với `courses/engine/ai-khach.js`), `parser.fromAi` + `parser.aiContext`, hộp "Nhập từ văn bản" (nút ✨) + nút "✨ Nhập bằng AI" ở trang Giao dịch.

## Chạy kiểm

```powershell
node backend\fastapi\webapp\tranphuc8a\quan-ly-chi-tieu\kiem.js                       # 498 phép kiểm
backend\fastapi\.venv\Scripts\python.exe quan-ly-chi-tieu\selftest\run.py [--shots]   # 208 đạt, 0 sai, 1 bỏ qua (Mongo thật)
cd backend\fastapi; .\.venv\Scripts\python.exe -m pytest -q                            # 1007 đạt (993 + 14 AI chi tiêu)
```

Selftest trình duyệt mới: `selftest/nhom_ai.py` (nhóm qua UI, 600 khoản chung để thử lọc/phân trang/cuộn/điện thoại 390px; AI: máy chủ thật với AI tắt, rồi `/ai/*` giả lập bằng `page.route` — **không gọi Gemini thật**).

## Kiến trúc trong 7 dòng

1. Logic thuần (`money dates model ledger parser sync csv charts text`) đăng ký `globalThis.QL`, `require` được trong node → `kiem.js`.
2. `store.js` = Engine: ghi localStorage trước, đồng bộ sau; 409 → `sync.merge` (LWW + bia mộ, lặp theo `model.COLLECTIONS` — nay có `groups`).
3. Một tài liệu JSON/sổ (`schema 1`): accounts, categories, people, **groups**, transactions, budgets, recurring, tombstones.
4. Tiền là số nguyên đồng; chia bằng `money.allocate`. Số dư từng cặp (tôi ↔ người) là nguồn sự thật; nhóm chỉ lọc theo `groupId`.
5. UI: `views.js` trả HTML; `dialogs.js` + `chung.js` (nhóm/khoản chung) + `ai.js`; `app.js` uỷ quyền `data-act`; mọi chuỗi người dùng qua `esc()`.
6. Backend chi tiêu: `spending_controller → SpendingUseCase → SpendingRepositoryPort → json | mysql | mongo`.
7. Backend AI: `ai_controller /ai/spending → AiSpendingUseCase → AiUseCase.ask (quyền, hạn mức, ngân sách) → Gemini`.

## Cạm bẫy đã gặp

- **Nhóm = cách nhìn "sổ của tôi"** (phương án A đã duyệt): cách chuyển phần của tôi theo đúng nợ từng cặp, phần giữa người khác thì gộp. Tiền hai người khác chuyển cho nhau KHÔNG có trong sổ. Thanh toán ghi ở thẻ **người** không trừ vào số của **nhóm** (UI có ghi chú).
- AI: không bao giờ lưu thẳng; mọi khoản qua `parser.fromAi` → `validateTx` (trên sổ đã thêm người hẹn tạo) → người dùng chọn → lưu + hoàn tác một bước. Người mới chỉ tạo khi có dòng cần họ được chọn.
- AI mặc định `AI_ACCESS=admin`: phải đăng nhập quản trị ở trang Quản lý khoá học cùng máy chủ (token `qlkh.phien@<gốc API>.token` dùng chung localStorage), hoặc đặt `AI_ACCESS=code`.
- `ai.js` nhớ `/ai/status` 30 giây; mở hộp thì hỏi lại (quyền đổi ở trang khác).
- Không nạp `courses/engine/ai-khach.js` trực tiếp: ngoài phạm vi service worker → offline/`file://` hỏng.
- **Dấu `\` bị mất khi chèn code qua heredoc bash** (gặp lại 2 lần đợt này): ghi script Python bằng công cụ Write với chuỗi raw `r'''…'''`, rồi `node --check` + `kiem.js`/pytest.
- Ngân sách kích thước còn ~10 KB (340/350 KB, tiếng Việt UTF-8 tốn 2–3 byte/ký tự) — thêm tính năng lớn nữa thì phải cân lại.
- PWA: `sw.js` chỉ đụng GET cùng origin dưới phạm vi app (API ngoài phạm vi ⇒ không bị cache) — đừng nới. Cài được cần HTTPS. iOS app màn hình chính có localStorage riêng.
- Nhập nhanh đầu trang chỉ lưu thẳng khi có số tiền + danh mục + không cảnh báo. Hoàn tác phải là hàm ngược tạo bản ghi mới hơn.

## Còn nợ

1. **Thử AI với Gemini thật** (cần `GEMINI_URL/GEMINI_API_KEY`, `AI_ENABLED=true`, quyền): chất lượng tách câu thật chưa được đo — chỉ có test với model giả.
2. Selftest với Mongo/MySQL thật; thử Safari/iOS, Firefox, điện thoại thật (cả cài PWA); xác nhận deploy có HTTPS.
3. Nếu cần sổ nhóm đầy đủ kiểu Splitwise (ghi tiền giữa hai người khác): phương án B — loại thanh toán giữa hai người bất kỳ, sửa `effects`/`validateTx`/CSV.
4. Tuỳ chọn cũ: chuyển giao dịch năm cũ ra file; gom ba kho workspace+khoá+revision. Ngoài phạm vi: `/storage/backends` lộ tên DB/host.

## Trạng thái git

Chưa commit. Nhánh `lab/261004`. Đợt 08/10 thêm: `assets/{chung,ai}.js`, `selftest/nhom_ai.py`, `src/application/usecases/ai_spending_usecase.py`, `tests/application/test_ai_spending_usecase.py`; sửa `model/ledger/parser/csv/dialogs/views/app.js`, `kieu.css`, `index.html`, `metadata.json`, `ai_controller.py`, `ai_factory.py`, `test_ai_controller.py`, `kiem.js`, `static_checks.py`, `browser_checks.py`, README (dự án + backend), `design.md`, `requirements.md`.
