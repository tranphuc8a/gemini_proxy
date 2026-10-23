# M2b — Toán cho gemini-chat (Làn A, 23/10/2026)

**Trạng thái: xong.** ke-hoach §1.5: gemini-chat (`frontend/`) dùng chung bộ chuẩn hoá toán của Markdown Editor Pro (bản phiên 4
của M2), kèm script đồng bộ + kiểm lệch, bộ vectơ test dùng chung, mhchem và macro KaTeX. Đã xuất bản lại gemini-chat.
Không commit, không lệnh git ghi. Không gọi Gemini, không đụng database (phép kiểm Edge dùng máy chủ giả, không cần backend).
Không đụng tệp Làn B.

> **Cập nhật 23/10 tối (M2 phiên 5):** bản sao `frontend/src/lib/mathDelimiters.ts` đã đồng bộ lại sang **bản phiên 5** bằng
> `node scripts/sync-math.mjs`. Bản này gỡ 8 đường bậc hai còn sót ở bản phiên 4: `<?`/`<!X`/`<![CDATA[` không đóng, các dấu mở
> `\(`/`\[` chung dấu đóng, lượt tìm sau vùng bỏ qua; chi tiết ở `dot/M2.md`. Đã xuất bản lại gemini-chat thành `index-5hTNGPNP.js`.
> Kết quả: frontend 17 tệp / 353 test xanh, `kiem-toan-edge.py` Đạt 9 · SAI 0. Chỗ ghi "bản phiên 4, tuyến tính" dưới đây là trạng
> thái lúc làm M2b.

## Đã làm

### 1. Mô-đun thuần + script đồng bộ `scripts/sync-math.mjs` (mới)
- Nguồn thật ở `markdown-editor/src/lib/`; bản sao ở `frontend/src/lib/`, dòng đầu "FILE SINH RA — ĐỪNG SỬA Ở ĐÂY":

  | Nguồn | Bản sao |
  | --- | --- |
  | `mathDelimiters.ts` (bản phiên 4, tuyến tính) | `frontend/src/lib/mathDelimiters.ts` |
  | `remarkMathPromote.ts` | `frontend/src/lib/remarkMathPromote.ts` |
  | `katexOptions.ts` (**mới**, tách từ `markdownPipeline.ts`) | `frontend/src/lib/katexOptions.ts` |
  | `__tests__/mathVectors.ts` (**mới**, bộ vectơ dùng chung) | `frontend/src/lib/__tests__/mathVectors.ts` |

- `node scripts/sync-math.mjs` chép (chỉ ghi tệp lệch); `--thu` chỉ báo; `--kiem` exit 1 khi lệch (đã thử đột biến: thêm một dòng
  vào bản sao → exit 1 "LỆCH", chép lại → exit 0).
- Chặn "không thuần": nguồn chỉ được import tệp trong cùng bộ chép (`./…`), tệp test được thêm `vitest`. Import khác → exit 2.
- So sánh bỏ qua CRLF/LF (Git trên Windows báo sẽ đổi LF→CRLF ở `markdown-editor/`).

### 2. `katexOptions` tách thành mô-đun thuần (theo ghi chú M2 "nhớ chép cả katexOptions")
- `markdown-editor/src/lib/katexOptions.ts`: `KATEX_MACROS` (đóng băng: `\label`, `\eqref`, `\ref`) + `katexOptions()` (macro mới mỗi
  lần, `strict:'ignore'`). `markdownPipeline.ts` import rồi re-export, nên mọi nơi gọi cũ và `markdownPipeline.test.ts` giữ nguyên.
- Vì đổi nguồn markdown-editor nên **đã build lại markdown-editor-pro** (xem bảng lệnh kiểm).

### 3. Bộ vectơ dùng chung `mathVectors.ts`
- Chuyển nguyên văn (bằng script, không gõ lại) từ hai tệp test của editor:
  - `NORMALIZE_VECTORS` (88 cũ + **10 vectơ streaming** mới = 98): `\[` chưa đóng (riêng dòng, cùng dòng, trong danh sách), dấu đóng
    mới tới `\`, `\begin` chưa có `\end`, `\begin` trong `\[` đang mở, công thức xong trước một `\[` mở vẫn đổi, `$` chưa có dấu đóng →
    `\$` (thành công thức khi dấu đóng tới), dấu đóng tới thì thành khối.
  - `RENDER_VECTORS` (61 vectơ hiển thị) + `countMaths`/`textOf`.
  - `STREAM_ANSWERS` (2 câu trả lời: kiểu ChatGPT 3 display/6 inline, kiểu Gemini 2/1), `streamCuts`, `openDelimiterAt`,
    `streamPrefixFailure`.
- Vectơ hiển thị duy nhất phụ thuộc editor (`p[data-line="4"]`) đổi thành kiểm chung "đoạn cuối là `after`"; phép `data-line` chuyển
  sang một test riêng của editor (`markdownRender.test.tsx`, mục "source line anchors").
- Test mới ở editor: streaming cắt ở **mọi ký tự** (`mathDelimiters.test.ts`), streaming hiển thị (`markdownRender.test.tsx`).

### 4. Gắn vào `frontend/src/components/MarkdownRenderer.tsx`
- `useMemo(() => normalizeMath(content), [content])` → `ReactMarkdown` nhận `prepared.text`.
- remark: `remarkGfm, remarkMath, [remarkMathPromote, {display, generated, text}]` (đúng thứ tự của editor).
- rehype: `[[rehypeKatex, katexOptions()]]` (macro mới mỗi lần render).
- **mhchem: áp** — `import 'katex/contrib/mhchem'` + `frontend/src/types/katex-mhchem.d.ts`; `katex` khai báo tường minh trong
  `package.json` + `package-lock.json` (^0.16.47, đúng bản đã cài qua rehype-katex, **0 gói mới**, `npm ls katex` gọn).
- **Bộ chặn style: KHÔNG áp, có lý do** — gemini-chat không bật `rehype-raw` (HTML thô bị escape thành chữ, có test
  "does not execute raw HTML"), nên thuộc tính `style` từ nội dung không bao giờ tới DOM; KaTeX chạy với `trust:false` mặc định nên
  `\htmlStyle` cũng tắt. Schema sanitize `code` math-* cũng không áp dụng (không có rehype-sanitize).
- Streaming: chuẩn hoá chạy lại trên chuỗi chưa đủ mỗi mẩu; `\[`/`\(`/`\begin` chưa đóng giữ nguyên chữ (đã kiểm ở mọi ký tự).
- Thêm script `type-check` (bí danh của `typecheck`) vào `frontend/package.json` để lệnh kiểm chuẩn `npm run type-check` chạy được.

### 5. Kiểm trình duyệt thật `frontend/scripts/kiem-toan-edge.py` (mới, Edge, `channel="msedge"`)
- Phục vụ **bản xuất bản** trên cổng trống, chèn `__WEBAPP_CONFIG__` như `webapp_controller`, giả `/api/*` (hội thoại, tin nhắn,
  `/ai/status`, `/ai/models`, `/gemini/stream` SSE từng mẩu **dừng 2,5 s đúng lúc `\[` đang mở**).
- 9 phép: tin cũ kiểu ChatGPT (3 display, 6 inline, 0 lỗi; giá `$49/$15/$64` là chữ; không còn `\(`/`\[` trần; `\eqref` → `(eq:1)`,
  `\ce` vẽ được); giữa stream `\[` mở vẫn là chữ ("[ x = \frac{-b"), công thức trước còn nguyên, 0 lỗi; xong stream thành display,
  `\ce` inline, "Giá $5 và $10." là chữ; `$$E = mc^2$$` một dòng thành khối; 0 pageerror. `--anh <thư-mục>` chụp 3 ảnh.

## Tệp

- Mới: `scripts/sync-math.mjs`, `markdown-editor/src/lib/katexOptions.ts`, `markdown-editor/src/lib/__tests__/mathVectors.ts`,
  `frontend/src/lib/{mathDelimiters,remarkMathPromote,katexOptions}.ts` + `frontend/src/lib/__tests__/mathVectors.ts` (**sinh ra**),
  `frontend/src/lib/__tests__/mathDelimiters.test.ts`, `frontend/src/types/katex-mhchem.d.ts`, `frontend/scripts/kiem-toan-edge.py`.
- Sửa: `markdown-editor/src/lib/markdownPipeline.ts` (import/re-export katexOptions), `markdown-editor/src/lib/__tests__/mathDelimiters.test.ts`,
  `markdown-editor/src/__tests__/markdownRender.test.tsx` (lấy vectơ từ `mathVectors.ts`, thêm test streaming + test data-line),
  `frontend/src/components/MarkdownRenderer.tsx`, `frontend/src/components/MarkdownRenderer.test.tsx`, `frontend/package.json`,
  `frontend/package-lock.json`.
- Sinh lại bằng công cụ: `backend/fastapi/webapp/tranphuc8a/gemini-chat/**` (`build-webapps.mjs --only frontend`),
  `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/**` (`build-webapps.mjs --only markdown-editor`).

## Lệnh kiểm (chạy thật 23/10)

| Lệnh | Kết quả |
| --- | --- |
| `cd frontend && npm test` | exit 0 — **17 tệp, 353 test** (trước 16 tệp/181: +104 `lib/__tests__/mathDelimiters.test.ts`, +68 trong `MarkdownRenderer.test.tsx`); 2 phút 12 s |
| `cd frontend && npm run type-check` | exit 0 |
| `cd frontend && npm run lint` | exit 0 |
| `cd frontend && npm run build` | exit 0 (`index-DRrYwY8f.js`, cùng băm với bản xuất bản) |
| `node scripts/sync-math.mjs --kiem` | exit 0 — "Đạt: 4 bản sao khớp nguồn." |
| `node scripts/build-webapps.mjs --only frontend` | exit 0 — published 157 files, audit clean |
| `node scripts/build-webapps.mjs --check` | exit 0 — 7 app ok |
| `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe frontend/scripts/kiem-toan-edge.py` (Edge, trên bản xuất bản cuối) | exit 0 — **Đạt 9 · SAI 0** |
| `cd markdown-editor && npm test` | exit 0 — **35 tệp, 721 test** (M2: 706; +15: 10 vectơ streaming, 2 streaming mọi ký tự, 2 streaming hiển thị, 1 data-line) |
| `cd markdown-editor && npm run type-check && npm run lint` | exit 0 / exit 0 |
| `node scripts/build-webapps.mjs --only markdown-editor` | exit 0 — make-sw: build **`65b8053d95b6`** (trước `67c5876ed3bb` của M2 phiên 4), 425 tệp precache, SW audit clean. Băm chunk mermaid đổi dây chuyền vì chunk chính đổi tên (nội dung không đổi) |
| `PYTHONUTF8=1 MONGO_URI="" backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-pwa.py` | exit 0 — **Đạt 57 · SAI 0** (1 phút 20 s, máy chủ thật trên SQLite tạm, cổng trống) |

Không chạy lại `kiem-hieu-nang.py` (không đổi đường render của editor; chỉ chuyển `katexOptions` sang mô-đun khác).

Kiểm đột biến (chạy thật, đã trả lại mã đúng):
- `MarkdownRenderer` đưa `content` thay `prepared.text` → **37 test toán đỏ**.
- Bỏ `import 'katex/contrib/mhchem'` + bỏ `katexOptions()` → **5 test đỏ** (2 mhchem, `\ref`, `\label/\eqref`, streaming ChatGPT).
- Bản sao lệch nguồn → `sync-math.mjs --kiem` exit 1.
- `streamPrefixFailure` có test "không mù" (đổi `\[` mở thành `$$` → báo lỗi).

## Số đo
- Bundle chính gemini-chat `index-*.js`: 2.198.463 → 2.245.296 B (**+46,8 KB thô, +13,8 KB gzip -9**; gzip -9: 700.812 → 714.593; Vite báo 726,86 kB gzip). Bản xuất
  bản trước dựng từ đúng nguồn của commit `7c2b194` (không có thay đổi frontend nào khác từ đó), nên phần tăng là của M2b: mhchem
  ≈ 8,4 KB gzip (số của M2) + chuẩn hoá/promote/macro ≈ 5 KB.
- `normalizeMath` trên câu trả lời 20 KB: 1,3 ms (0,066 ms/KB). Stream 20 KB thành 500 mẩu, chuẩn hoá lại cả tiền tố mỗi mẩu: tổng
  750 ms, **trung bình 1,5 ms/mẩu** (máy chung với Làn B), nhỏ so với parse markdown + KaTeX mỗi mẩu.
- Test streaming hiển thị (vitest, jsdom, máy bận): câu ChatGPT ~7 s (≈ 150 lát cắt), Gemini 0,4 s; đã nhớ đệm phần "trước dấu mở".

## Lệch thiết kế
1. Chép thêm `katexOptions.ts` (tách khỏi `markdownPipeline.ts`) và bộ vectơ `mathVectors.ts` — ke-hoach chỉ nêu hai tệp; M2 dặn
   chép cả katexOptions; "dùng chung bộ vectơ" được làm thành chép tệp vectơ, không chép tệp test (editor giữ test thời gian/ngẫu
   nhiên, frontend không chạy lại các phép đo nặng).
2. Script đặt ở `scripts/sync-math.mjs` (Node, cạnh `build-webapps.mjs`) thay vì Python như `engine/sync.py`; cờ `--kiem`/`--thu`
   theo đúng quy ước của `engine/sync.py`.
3. Không áp `rehypeStyleGuard` và schema sanitize cho gemini-chat (lý do ở mục 4).
4. Vectơ hiển thị dùng chung: kiểm `p[data-line="4"]` đổi thành kiểm chung, phần `data-line` thành test riêng của editor.

## Còn tồn
- Kiểu Gemini `$$ x^2 +` (có chữ sau `$$`) **giữa stream**: micromark đọc dòng đó là rào `$$` có info → khối toán rỗng tới khi `$$`
  đóng tới trên cùng dòng (rồi `remarkMathPromote` đưa lên khối). Chớp một nhịp, không lỗi, không mất chữ khi xong; đây là cú pháp
  `$$` của tác giả nên không đổi trong M2b.
- Các giới hạn đã biết của `normalizeMath` (M2 "Còn tồn": mã thụt lề trong mục danh sách, bẫy `$$ chữ` qua container, giá `5$/…`
  hai lần trong một đoạn) áp dụng y hệt cho gemini-chat. Sửa ở `markdown-editor/src/lib/mathDelimiters.ts` rồi chạy
  `node scripts/sync-math.mjs` — gemini-chat chạy lại cùng vectơ.
- **Quy tắc mới cho đợt sau:** sửa `mathDelimiters.ts`/`remarkMathPromote.ts`/`katexOptions.ts`/`mathVectors.ts` ở markdown-editor ⇒
  chạy `node scripts/sync-math.mjs`, test frontend và xuất bản lại cả hai app. Nên ghi thêm vào bảng "Không sửa tệp sinh ra" của
  CLAUDE.md và skill `webapp-react` (agent không tự sửa CLAUDE.md).
- `kiem-toan-edge.py` chưa nối vào CI; chạy tay sau mỗi lần xuất bản gemini-chat.
