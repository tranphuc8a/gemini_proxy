# Markdown Editor Pro — HIỂN THỊ: công thức toán, PlantUML, định dạng của Gemini/Claude/ChatGPT

Pha: HIỂU + THIẾT KẾ (chưa sửa mã). Ngày 22/10/2026. Nguồn app: `markdown-editor/` (React 18 + Vite), bản phục vụ
`backend/fastapi/webapp/tranphuc8a/markdown-editor-pro`. Kèm: Personal Wiki + Algorithm Notebook (viết tay).

Ký hiệu: **[đã kiểm]** = đã chạy thật (lệnh/tệp nháp ghi bên cạnh); **[đọc mã]** = đọc nguồn có dẫn dòng; **[suy đoán]** = chưa kiểm được.

Tệp nháp đã dùng (chỉ trong scratch `…/scratchpad/md-render/`): `render.mjs` (dựng lại ĐÚNG pipeline của
`MarkdownView.tsx` bằng react-markdown + react-dom/server, plugin thật, `rehypeEnhance.ts` thật được transpile bằng
`gen.mjs`), `cases-math.mjs`, `cases-formats.mjs`, `katex-probe.mjs`, `proto-llm-math.mjs` + `cases-proto.mjs`
(bản mẫu của thiết kế toán, đã chạy đạt), `perf.mjs`, `perf2.mjs`. Khi chạy, `node_modules` trong scratch là junction
tới `markdown-editor/node_modules` (tạo: `cmd //c "mklink /J node_modules C:\Users\tranphuc8a\Desktop\gemini_proxy\markdown-editor\node_modules"`;
đã gỡ sau khi đo bằng `cmd //c "rmdir node_modules"` — KHÔNG BAO GIỜ `rm -rf` junction). `git status` sạch sau pha này.

---

## 1. Hiện trạng

### 1.1 Pipeline (một đường duy nhất cho mọi chế độ) [đọc mã]

`src/components/MarkdownView.tsx`:

| Bước | Mã | Ghi chú |
| --- | --- | --- |
| parse | react-markdown 9.1.0 → remark-parse 11 (micromark) | |
| remark | `[remarkGfm, remarkMath]` (`MarkdownView.tsx:14`) | remark-math 6.0.0 / micromark-extension-math 3.1.0: **chỉ hiểu `$…$` và `$$…$$`** |
| remark→rehype | `allowDangerousHtml: true` (react-markdown) | |
| rehype | `[rehypeRaw, rehypeEnhance, [rehypeSanitize, sanitizeSchema], rehypeKatex]` (`MarkdownView.tsx:17`) | KaTeX chạy SAU sanitizer |
| components | `code` → `MermaidDiagram` nếu `language-mermaid`, còn lại `CodeBlock` (`MarkdownView.tsx:53-68`); `pre` bỏ vỏ (`:71`) | regex `language-([\w-]+)` (`:55`) |
| CSS | `import 'katex/dist/katex.min.css'` (`:12`) | `katex` không có trong `package.json` (đến qua rehype-katex, 0.16.47) |

Dùng chung: khung xem trước `Preview.tsx:117` (có debounce 120 ms, `:19`), chế độ đọc `ReadingView.tsx:335-340`
(idPrefix + `codeBackground`), xem trước Smart format `SmartFormatModal.tsx:369`. Xuất HTML/PDF/PNG **không render lại**:
`Header.tsx:150` lấy `document.querySelector('.markdown-body')` (DOM đã render) → `exportHtml` chép `innerHTML` + mọi luật
CSS cùng origin (`exporters.ts:35-71`), PDF/PNG chụp bằng html2canvas (`exporters.ts:82-147`). ⇒ Sửa `MarkdownView`
là sửa cho cả soạn/đọc/Smart format/xuất.

`data-line` (đồng bộ cuộn, nhấp đúp nhảy dòng) do `rehypeEnhance` gắn từ `position.start.line` (`rehypeEnhance.ts:76-81`) →
**mọi tiền xử lý phải giữ nguyên số dòng**. Tick checkbox dựa vào thứ tự checkbox (`Preview.tsx:101-103`), không dựa vị trí.

### 1.2 Kết quả chạy thử pipeline hiện tại [đã kiểm: `node cases-math.mjs`, `node cases-formats.mjs`]

Toán:

| Đầu vào | Kết quả hiện tại |
| --- | --- |
| `$x$`, `$$\n…\n$$`, ```` ```math ````, `$$\n\begin{align}…\n$$`, `\boxed`, `\tag` | ✅ hiện đúng |
| `\[\nE=mc^2\n\]` (ChatGPT) | ❌ ra chữ `[ E = mc^2 ]` |
| `\[ E=mc^2 \]` một dòng | ❌ `[ E = mc^2 ]` |
| `\( E=mc^2 \)` | ❌ `( E = mc^2 )` |
| `\( x_1 * x_2 \)` | ❌ và còn bị nuốt `_`/`*` thành nghiêng nếu có cặp |
| `\[\n\begin{aligned} a &= b \\ …` | ❌ `\\` bị markdown đổi thành `\` (mất xuống dòng) |
| `\begin{align}…\end{align}` trần, `\begin{equation}`, `\begin{pmatrix}` | ❌ ra chữ, `\\` cũng mất |
| `$$x = \frac{-b}{2a}$$` một mình một dòng (Gemini hay dùng) | ⚠️ ra công thức **inline** (nhỏ, không căn giữa) |
| `$$ x^2 +\ny^2 $$` (mở `$$` có chữ ngay sau rồi xuống dòng) | ❌ **lỗi đỏ**: micromark coi `$$ x^2 +` là rào mở khối, phần sau `$$` thành *meta* và **bị vứt** |
| `It costs $5 and $10 total` / `$20/month and $200/month` | ❌ ghép thành công thức `5 and ` (giá tiền trong câu trả lời ChatGPT rất hay gặp) |
| `$\ce{H2O}$`, `\pu{…}` (mhchem) | ❌ chữ đỏ (KaTeX chưa nạp mhchem) |
| `\label{}`, `\eqref{}`, `\ref{}`, `\require{}` | ❌ lỗi đỏ [đã kiểm `katex-probe.mjs`] |
| `multline`, `eqnarray`, `flalign` | ❌ KaTeX không có môi trường này [đã kiểm] |
| `\\[ x \\]` (chép từ JSON, gạch kép) | hiện `\[ x \]` nguyên văn — **không xử lý** (đúng ngữ nghĩa markdown) |

Định dạng khác (chi tiết ở §3.6): footnote, task list, bảng căn lề, `<details>`, `<sup>/<sub>/<kbd>/<mark>`, `<p align>`,
autolink, ảnh data URL, mermaid trong `<details>` → ✅. GitHub alert `> [!NOTE]`, `==mark==`, emoji `:smile:`,
definition list, `:::note`, `!!! note`, `[TOC]`, front matter YAML (ra `<hr>` + `<h2>`!), ```` ```plantuml ````/```` ```dot ````/
vega-lite/abc/wavedrom/geojson (chỉ là khối mã), `<svg>` thô (bị sanitizer xoá sạch, còn `<p></p>`), ```` ```mmd ```` → ❌.
`H~2~O` → gạch ngang chữ `2` (GFM single tilde). Tên tệp trong khối mã (```` ```python title="main.py" ````, ```` ```js:app.js ````) bị bỏ.
Dấu trích dẫn của LLM (`[cite_start]`, `[cite: 1, 2]` của Gemini; `【4†source】`, `:contentReference[oaicite:0]{index=0}` của
ChatGPT) hiện nguyên văn.

---

## 2. Phát hiện (nguyên nhân gốc)

1. **`\[ \]` và `\( \)` không bao giờ là toán** trong pipeline này: remark-math chỉ có cú pháp `$`; micromark gặp `\[` thì
   coi là *character escape* CommonMark → còn `[`. Không có plugin/tiền xử lý nào đổi delimiter. (`MarkdownView.tsx:14`;
   kết quả chạy ở §1.2.) Cùng lý do, nội dung toán chưa được bảo vệ khỏi markdown: `\\`→`\`, `_…_`/`*…*` → nghiêng.
2. **Sanitizer xoá class `math-display`/`math-inline` trên `<code>`**: `defaultSchema` của hast-util-sanitize ghim
   `code: [['className', /^language-./]]` (`node_modules/hast-util-sanitize/lib/schema.js:37`); khoá riêng của thẻ thắng
   khoá `'*'` mà `rehypeEnhance.ts:144` thêm. Hiện "tình cờ" vẫn chạy vì KaTeX chỉ cần `language-math` (+ cha là `<pre>` →
   hiển thị khối). Chú thích ở `rehypeEnhance.ts:115-117` nói schema giữ `math-inline`/`math-display` là **sai**.
   Hệ quả: không thể đánh dấu một công thức inline là display nếu không sửa schema [đã kiểm `debug2.mjs`].
3. **Khối toán mất `data-line`**: rehype-katex thay cả `<pre>` (nơi có `data-line`) bằng kết quả KaTeX
   (`node_modules/rehype-katex/lib/index.js:66-76,138-139`) → đồng bộ cuộn bỏ qua mọi khối công thức.
4. **Bẫy `$$` + chữ cùng dòng** (micromark-extension-math: rào mở + meta) → mất nửa công thức, đỏ [đã kiểm].
5. **`$` giá tiền** bị ghép thành công thức vì micromark không có luật pandoc (mở phải có ký tự khác trắng bên phải; đóng phải
   có ký tự khác trắng bên trái và không có chữ số ngay sau) [đã kiểm].
6. `katex/contrib/mhchem` có sẵn trong `node_modules/katex` (34 KB min, 8,4 KB gzip) nhưng không được nạp [đã kiểm].
7. Phụ: regex `language-([\w-]+)` (`MarkdownView.tsx:55`) cắt ```` ```c++ ```` thành `c` → bí danh `'c++': 'cpp'`
   ở `codeLanguages.ts:35` không bao giờ tới (C++ tô màu như C).
8. **Bảo mật** [đọc mã + đã kiểm]: `sanitizeSchema` cho phép `style` trên mọi thẻ (`rehypeEnhance.ts:144`) →
   `<span style="background:url(https://…)">` đi qua nguyên vẹn (pixel theo dõi người đọc ẩn danh), `position:fixed` có thể
   phủ kín trang (giả giao diện) trên tài liệu chia sẻ chỉ đọc. Không phải XSS nhưng đáng chặn. `clobberPrefix: ''`
   (`rehypeEnhance.ts:124`) là đánh đổi có chủ đích, giữ nguyên. KaTeX ra SAU sanitizer nhưng an toàn (`trust: false` mặc
   định: `\href{javascript:…}` ra chữ đỏ [đã kiểm]).
9. Xuất HTML: `collectStyles` chép `@font-face` của KaTeX với URL tương đối → tệp `.html` mở ngoài máy chủ có thể mất font
   KaTeX [suy đoán — cần kiểm trên Edge xem `cssText` giữ URL tương đối hay tuyệt đối].
10. Hiệu năng parse hiện tại khá chậm: ~5–8 ms/KB trên máy này (12 KB tài liệu thật: 55 ms; 50 KB: 300–400 ms)
    [đã kiểm `perf.mjs`, `perf2.mjs`] → mọi giải pháp **không được parse 2 lần**.

---

## 3. Thiết kế

### 3.1 Toán học — `prepareMarkdown` (tiền xử lý giữ dòng) + `remarkMathPromote`

**Nguyên tắc**: biến mọi kiểu delimiter LLM về cú pháp `$` mà remark-math hiểu, **trước khi parse, giữ nguyên số dòng**
(đổi cột thì được — `data-line` chỉ dùng số dòng), không parse 2 lần. Sau parse, một plugin remark nâng công thức "đứng một
mình" lên khối hiển thị. Bản mẫu `proto-llm-math.mjs` đã chạy đạt toàn bộ ca ở bảng dưới [đã kiểm `cases-proto.mjs`].

#### 3.1.1 API (tệp mới `src/lib/mathDelimiters.ts`, hàm thuần)

```ts
export type Range = [start: number, end: number]
/** Vùng không được đụng: rào ``` / ~~~ (kể cả trong > và danh sách), khối $$…$$ (rào riêng dòng),
 *  mã thụt 4 cách ở cấp gốc, khối HTML <pre|script|style|textarea>…</…>, <!-- -->, code span `…`. */
export function findSkipRanges(src: string): Range[]
export interface PreparedMath { text: string; display: Set<number>; generated: Set<number> }
/** Giữ số dòng. display/generated = offset (trong `text`) của dấu `$` mở do hàm sinh ra. */
export function normalizeMath(src: string, skip?: Range[]): PreparedMath
```

Đường nhanh: `if (!/[\\$]/.test(src)) return {text: src, …}`.
Bộ quét O(n): dùng regex sticky (`y`) + `lastIndex`, **không** `slice` phần đuôi (bản mẫu đầu dùng `src.slice(i)` bị bậc 2;
sửa xong: 10 ms/50 KB, 41 ms/300 KB [đã kiểm `perf2.mjs`]).

#### 3.1.2 Luật đổi (theo thứ tự quét, bỏ qua `skip`)

Gọi "tiền tố khung" = khoảng trắng + các dấu `>` của trích dẫn + (dấu danh sách `-`,`+`,`*`,`1.`,`1)` + cách).

| Gặp | Điều kiện | Đổi thành | Ghi chú |
| --- | --- | --- | --- |
| Chuỗi `\` độ dài chẵn | — | giữ nguyên | `\\[2pt]`, `\\(` không phải delimiter |
| `\` lẻ + ký tự X (không phải `(`/`[`) | — | giữ cả hai | `\$` vẫn là đô la thường |
| `\[ … \]` | `\[` một mình sau tiền tố khung, `\]` một mình (sau `>`/khoảng trắng), nội dung nhiều dòng | `$$`…`$$` | thành khối toán thật (flow), nội dung không bị parse khối |
| `\[ … \]` | còn lại, đóng trước dòng trống | `$`ⁿ…`$`ⁿ (text math) + ghi `display` | **giữa câu** chỉ đổi khi nội dung "giống TeX" (`/[\\^_{}=]/`) hoặc đứng một mình trong đoạn — tránh nhầm `Bấm \[Enter\]` |
| `\( … \)` | đóng trước dòng trống | `$`ⁿ…`$`ⁿ + ghi `generated` | luôn đổi (ChatGPT viết `\(n\)` rất nhiều) |
| `\begin{ENV}` trần ở đầu dòng (sau tiền tố khung) | tìm `\end{ENV}` cùng tên (đếm lồng), không vượt dòng trống | `$`ⁿ`\begin…\end{ENV}``$`ⁿ + `display` | ENV ∈ equation, align, gather, multline, flalign, alignat, eqnarray, split, cases, (p/b/B/v/V/small)matrix, array, CD, aligned, gathered (+ `*`) |
| `$$…$$` cùng đoạn | — | giữ nguyên (bỏ qua nội dung) | |
| `$` đơn | **luật pandoc**: mở cần ký tự khác trắng bên phải; cặp đóng = `$` đơn gần nhất trong đoạn, phải có ký tự khác trắng bên trái và không có chữ số ngay sau | hợp lệ: giữ; không hợp lệ: `\$` | sửa `$5 and $10`, `$20/month`, `Pay $5 for $x$` [đã kiểm] |

- `n` = (dãy `$` dài nhất trong nội dung) + 1. Nếu `n ≥ 2` mà dấu mở nằm ngay đầu dòng và nội dung nhiều dòng (bẫy rào
  `$$`) → **không đổi** (để nguyên văn; cực hiếm).
- **Chống ngắt khối** trong text math nhiều dòng: dòng tiếp theo (sau tiền tố trích dẫn cùng độ sâu với dòng mở) bắt đầu
  bằng `- + * = # < > ~ \` |` hoặc `1.`/`1)` → chèn `\relax ` (KaTeX hiểu, không đổi hình; thay cho `{}` vốn đổi
  khoảng cách dấu `-` thành phép hai ngôi) [đã kiểm `katex-probe.mjs`: `\relax -b` ok].
- Không đụng: code span, rào code, `$$` khối có sẵn (nên `$$\n\begin{align}…$$` của Gemini giữ nguyên) [đã kiểm].

#### 3.1.3 Plugin `src/lib/remarkMathPromote.ts` (chạy sau remark-math)

```ts
export default function remarkMathPromote(options: { display: Set<number>; generated: Set<number> }): Transformer
```
Duyệt mdast (dùng `file.value` = văn bản đã chuẩn hoá):
1. `math`/`inlineMath`: `value = fixTex(value)`; **phải cập nhật cả `data.hChildren`** (mdast-util-math dựng hast từ
   `hChildren`, không từ `value`: `node_modules/mdast-util-math/lib/index.js:52-69,123-135`).
   `fixTex`: `multline`→`gather`, `eqnarray`/`flalign`→`align` (giữ `*`), xoá `\require{…}`.
2. `paragraph` chỉ có đúng một `inlineMath` (bỏ text trắng) và (offset ∈ `display` **hoặc** không thuộc `generated` mà văn
   bản tại offset bắt đầu bằng `$$`) → thay cả đoạn bằng nút `math` (pre>code.language-math.math-display, `position` của
   đoạn) ⇒ `$$x$$` một mình một dòng (Gemini) và `\[ x \]` một dòng thành khối như GitHub. `$$…$$` giữa câu vẫn inline.
3. `inlineMath` có offset ∈ `display` (giữa câu) → `data.hProperties.className = ['language-math','math-display']`.

#### 3.1.4 Sửa kèm

- `sanitizeSchema.attributes.code = [['className', /^language-./, 'math-inline', 'math-display']]` + sửa chú thích sai.
- `rehypeEnhance`: bọc `pre` có `code.language-math` trong `div.math-block[data-line]` trước khi KaTeX thay `pre`
  (div đã được phép `className` + `data-line` ở `rehypeEnhance.ts:150`).
- `rehypeKatex` nhận tuỳ chọn `{ strict: 'ignore', macros: {'\\eqref': '\\text{(#1)}', '\\ref': '\\text{#1}',
  '\\label': '\\mathrlap{\\phantom{\\text{#1}}}'} }` (đã thử: hết lỗi đỏ [đã kiểm]); tạo object `macros` mới mỗi lần
  dựng plugin (KaTeX ghi `\gdef` vào chính object này).
- `import 'katex/contrib/mhchem'` trong `MarkdownView.tsx` (đăng ký `\ce`, `\pu` vào cùng thể hiện katex — đã thử
  render được [đã kiểm]); khai báo `declare module 'katex/contrib/mhchem'` ở `src/vite-env.d.ts`.
- `MarkdownView`: `const prepared = useMemo(() => prepareMarkdown(source), [source])` → truyền `prepared.text` cho
  ReactMarkdown và `[remarkMathPromote, prepared.math]` vào remarkPlugins (useMemo theo `prepared`).
  `prepareMarkdown` (tệp `src/lib/prepareMarkdown.ts`) xâu chuỗi: front matter (§3.6) → `@startuml` trần (§3.3) → toán.
- `MarkdownView.tsx:55` regex → `/language-(\S+)/`.
- `HelpModal.tsx:114-115` thêm `\(…\)`, `\[…\]`, `\begin{align}`, `\ce{}`; tài liệu chào (`store.ts:68`) thêm một ví dụ.

Ví dụ (đều đã chạy qua bản mẫu):

```text
Energy \( E = mc^2 \) here        → Energy $ E = mc^2 $ here             (inline)
\[ E = mc^2 \]                    → $ E = mc^2 $  + display → khối
\[\nE = mc^2\n\]                  → $$\nE = mc^2\n$$                      (khối flow)
\begin{align}\na &= b \\\n…       → $\begin{align}…\end{align}$ + display → khối, `\\` còn nguyên
It costs $5 and $10 total         → It costs \$5 and $10 total           (không còn công thức giả)
```

#### 3.1.5 Phương án đã cân nhắc và loại

- *Parse 2 lần* (parse lấy vùng code chính xác rồi parse lại văn bản đã sửa — gọi `this.parse()` trong plugin): chạy
  đúng [đã kiểm], chính xác hơn với code lồng, nhưng tốn +55–145 % thời gian parse với tài liệu có toán (50 KB: 334→507 ms;
  300 KB: 1,86→3,65 s) [đã kiểm `perf.mjs`] → loại; giữ làm phương án dự phòng nếu bộ quét tay sai nhiều.
- *Viết micromark extension* cho `\(`/`\[`: đúng nhất về lý thuyết nhưng ~300 dòng, phải khai báo thêm các gói
  `micromark-util-*` vào package.json, khó kiểm → loại.
- *Đổi sang placeholder* như `courses/engine/hien-thi.js:459-498` (rút toán ra trước, chèn `<span>` rồi KaTeX sau): hợp
  với marked, nhưng ở đây làm hỏng `data-line`/vị trí và sanitizer → không dùng cho React; **dùng cho Wiki** (§3.7).

### 3.2 PlantUML — so sánh phương án

| | (a) URL tới plantuml.com / kroki.io (trình duyệt gọi thẳng) | (b) Route backend `/diagram/render` (proxy Kroki, hoặc plantuml.jar) | (c) Bộ dịch JS → Mermaid (offline) |
| --- | --- | --- | --- |
| Riêng tư | Gửi nội dung sơ đồ (trong URL) cho bên thứ ba, cả khi người đọc ẩn danh mở | Máy chủ mình gửi tiếp cho Kroki công khai; tự dựng Kroki thì kín | Không rời máy |
| Offline / PWA | Không | Không (có thể đệm SVG phía client theo băm) | **Có** (mermaid đã được precache) |
| Độ trung thực | 100 % | 100 % | Xấp xỉ; chỉ tập con |
| Chi phí | S (nén deflate bằng `CompressionStream`, mã hoá base64 riêng của PlantUML) | M (usecase + adapter + test; Vercel có thể gọi https ra ngoài) | L (5–6 loại sơ đồ) |
| Bảo mật | `<img>` chéo origin; html2canvas cần CORS [suy đoán: chưa kiểm được header CORS vì sandbox chặn mạng] | Kiểm loại/kích thước, chặn `!include`, giới hạn tần suất; trả SVG để vẽ bằng `<img>` | Mermaid `securityLevel: 'strict'` như hiện có |
| Java | — | Máy dev có Java 20 [đã kiểm `java -version`], **không** có Graphviz (`which dot` trống); bản deploy là Vercel Python (`backend/fastapi/vercel.json`) → không chạy được jar ở deploy [suy luận từ cấu hình] | — |

**Đề xuất**: (c) làm mặc định (offline, riêng tư, dùng lại `MermaidDiagram`) + (b) làm tuỳ chọn "Vẽ chính xác bằng máy chủ"
(theo từng khối hoặc bật hẳn), dùng chung cho các loại Mermaid không có (graphviz, vega-lite, wavedrom, d2, ditaa, svgbob,
nomnoml, erd, bpmn…). Không làm (a) (lộ nội dung cho bên thứ ba ngay khi người lạ mở tài liệu chia sẻ).

**Bất biến bảo mật**: SVG từ máy chủ **chỉ** được hiển thị bằng `<img src="data:image/svg+xml;base64,…">` (trong ngữ cảnh
ảnh, SVG không chạy script, không nạp tài nguyên ngoài) — **không bao giờ** `innerHTML`/`dangerouslySetInnerHTML`. Có test
khẳng định điều này. Data URL (không phải blob:) để bản xuất HTML tự chứa và html2canvas không bị "nhiễm bẩn".
Nếu sau này cần SVG inline (chọn chữ, liên kết) mới tính DOMPurify (đã có trong node_modules qua mermaid, 3.4.14, 29 KB) —
phải hỏi trước vì là khai báo phụ thuộc.

#### 3.2.1 Nhận diện

- Rào: ```` ```plantuml ````, ```` ```puml ````, ```` ```uml ```` (+ `plantuml` với meta), và khối bắt đầu `@start(uml|mindmap|wbs|gantt|json|yaml|salt)`.
- `@startuml … @enduml` **trần** (không rào) trong `prepareMarkdown`, giữ dòng: dòng `@startxxx` → ```` ```plantuml @startxxx ````
  (meta giữ loại), dòng `@enduml` → ```` ``` ````. Bỏ qua trong code/`skip`.

#### 3.2.2 Bộ dịch (`src/lib/diagrams/plantuml/`, hàm thuần)

```ts
export interface Translation { kind: 'sequence'|'class'|'state'|'activity'|'usecase'|'component'|'mindmap'; mermaid: string; warnings: string[] }
export class PlantUmlUnsupported extends Error { kind: string }
export function plantumlToMermaid(source: string, meta?: string): Translation   // ném PlantUmlUnsupported
```
`common.ts`: bỏ chú thích `'…` và `/' … '/`, `skinparam`, `!theme`, `hide`, `scale`, `left to right direction` (→ hướng),
`title`/`caption`/`legend…endlegend`/`header`/`footer` (title giữ, còn lại → warning), `!include`/`!define`/`!procedure` →
Unsupported. Nhãn luôn bọc `"…"`, `"` → `#quot;`, xuống dòng `\n` → `<br/>`. Phát hiện loại theo `@startmindmap`/từ khoá
(class/interface/enum/`<|--` → class; `[*]`/`state` → state; `start`/`:…;`/`if (…) then` → activity; `usecase`/`(…)`
→ usecase; `component`/`[X]`/`node`/`database` không có mũi tên tin nhắn → component; còn lại có `->` + `:` → sequence).

| Loại | PlantUML → Mermaid |
| --- | --- |
| sequence → `sequenceDiagram` | `participant "Dài" as L` → `participant L as Dài`; `actor`; boundary/control/entity/database/collections/queue → `participant X@{ "type": "…" }` (chuỗi `collections`/`queue` có trong `mermaid/dist/chunks/mermaid.core/sequenceDiagram-*.mjs` [đã kiểm], cú pháp chính xác cần `mermaid.parse` xác nhận); `->`→`->>`, `-->`→`-->>`, `->>`→`-)`, `-->>`→`--)`, `->x`→`-x`, `<-`/`<--` đảo chiều, `-[#red]->` bỏ màu; `activate/deactivate`, `alt/else/opt/loop/par(and)/break/critical/end` giữ; `group x` → `critical x`; `note left of/right of/over A,B` (+ nhiều dòng `end note`) → `Note …: a<br/>b`; `return x` → mũi tên đứt về người gọi gần nhất (ngăn xếp activate); `== mục ==` → `Note over <đầu>,<cuối>: mục`; `autonumber`, `title`, `box "x" #màu … end box` → `box màu x … end`; `create`/`destroy`; `...`, `|||` → bỏ + warning |
| class → `classDiagram` | `class A { +f : T \n +m() : R }` → `class A { +T f \n +m() R }`; `interface/abstract/enum` → `class X { <<interface>> }`…; quan hệ `<|-- *-- o-- --> ..> ..|> --` và nhãn/bội số `A "1" *-- "n" B : chứa` giữ nguyên cú pháp; bỏ từ chỉ hướng `-up->`; `List<T>` → `List~T~`; `package x { }` → `namespace x { }`; `note for`/`note "…" as N` → `note for A "…"` |
| state → `stateDiagram-v2` | gần như 1–1: `[*] --> S`, `S --> T : e`, `state "Dài" as L`, `state X { }`, `--` song song, `<<fork>>/<<join>>/<<choice>>`, `S : mô tả`, `note left of S : …` |
| activity (cú pháp mới) → `flowchart TD` | dựng cây lệnh (`start`, `stop/end/kill/detach`, `:việc;` nhiều dòng tới `;`, `if/elseif/else/endif`, `while/endwhile`, `repeat/repeat while`, `fork/fork again/end fork`, `split`, `|Làn|` → `subgraph`, `note`) rồi sinh đồ thị kiểu Thompson: mỗi khối trả (vào, các lối ra + nhãn chờ); start `((●))`, stop `(((■)))`, việc `["…"]`, điều kiện `{"…"}`; cú pháp activity CŨ `(*) -->` → Unsupported |
| usecase → `flowchart LR` | `actor A`/`:A:` → `A(["👤 A"])`; `(Đăng nhập)`/`usecase "x" as U` → `U(["x"])`; `rectangle Hệ thống { }` → `subgraph`; `-->`, `..>` (+ `<<include>>/<<extend>>` làm nhãn) |
| component/deployment → `flowchart` | `[C]`/`component C` → `C["C"]`, `database D` → `D[("D")]`, `node/package/folder/frame/cloud { }` → `subgraph`, `interface I`/`() I` → `I(("I"))`, `-->`, `..>` → `-.->` |
| mindmap (`@startmindmap`) → `mindmap` | `*`/`+`/`-` theo cấp → thụt lề; `*_` (không khung) bỏ dấu; `[#màu]` bỏ |
| gantt, wbs, json, yaml, salt, timing, ditaa, cú pháp cũ | Unsupported → hiện mã + nút máy chủ |

#### 3.2.3 Giao diện

`src/components/PlantUmlDiagram.tsx` (props `{source, meta, theme}`): dịch trong `useMemo`; thành công → thanh nhỏ
"PlantUML · vẽ gần đúng bằng Mermaid" + nút **Mã** (bật/tắt xem nguồn) + (nếu bật máy chủ) **Vẽ chính xác** + danh sách
warning gập; rồi `<MermaidDiagram source={mermaid} theme={theme}/>`. Thất bại → `CodeBlock` ngôn ngữ `plantuml` + ghi chú
"Chưa vẽ offline được loại sơ đồ này" + nút **Vẽ bằng máy chủ** (nếu bật). Nối trong `MarkdownView` component `code`:
`plantuml|puml|uml` → `PlantUmlDiagram`; `dot|graphviz|vega-lite|vegalite|wavedrom|d2|ditaa|svgbob|nomnoml|erd|bpmn` →
`ServerDiagram` (khi tắt máy chủ: CodeBlock như hiện nay); `mmd` → `MermaidDiagram`.

Cài đặt (per máy, `localStorage` bọc try/catch): `markdown-editor:diagram-server` = `off | ask | auto` (mặc định `ask`:
chỉ gửi khi người dùng bấm, kể cả người xem ẩn danh). Đặt trong menu View + giải thích quyền riêng tư.

### 3.3 Backend `/diagram` (route mới, theo mẫu `run_controller.py` + `run_usecase.py`)

```text
GET  /diagram/status   → {enabled, types:[…], maxBytes}               (không lộ URL Kroki)
POST /diagram/render   body {type: Literal[...], source: str (max_length 65536)}
     → 200 {ok: true, svg: "<svg…", cached: bool} | 200 {ok: false, error: "thông báo lỗi cú pháp (tiếng Việt + nguyên văn)"}
     lỗi: 400 diagram_type_unknown | diagram_too_large | diagram_include_forbidden ; 429 diagram_rate_limited ;
          502 diagram_upstream_failed ; 503 diagram_disabled  (phong bì {status_code, message, data:{code}})
     Cache-Control: no-store (như /run)
```
- Lớp: `domain/vo/diagram_vo.py` (Pydantic + Literal loại), `application/ports/input/diagram_input_port.py`,
  `application/ports/output/diagram_renderer_port.py` (`async render(type, source) -> DiagramResult`),
  `application/usecases/diagram_usecase.py` (kiểm loại ∈ cấu hình, đếm **byte** UTF-8, từ chối `!include`, `!includeurl`,
  `!import`, `%load_json`, `%getenv` (phòng thủ chiều sâu dù Kroki chạy chế độ secure [suy đoán]), giới hạn theo IP bằng
  `as_rate_limiter`/`MemoryRateLimiter` như `/run`, quản trị miễn; LRU trong RAM 256 mục theo `sha256(type+source)`),
  `adapter/output/diagram/kroki_renderer.py` (httpx `POST {KROKI_URL}/{type}/svg`, `text/plain`, timeout 10 s, trần
  2 MB, kiểm `content-type` image/svg+xml và gốc `<svg`; lỗi 400 của Kroki → `ok:false`), `adapter/factory/diagram_factory.py`,
  `adapter/input/controllers/diagram_controller.py`, đăng ký ở `src/main.py`.
- URL Kroki **chỉ** từ cấu hình (client gửi tên loại, không gửi địa chỉ → không SSRF), giống luật 1 của `run_usecase.py`.
- Cấu hình (`application/config/config.py` + `.env.example` + README): `DIAGRAM_ENABLED=true`,
  `DIAGRAM_KROKI_URL=https://kroki.io`, `DIAGRAM_TIMEOUT_SECONDS=10`, `DIAGRAM_MAX_SOURCE_BYTES=65536`,
  `DIAGRAM_RATE_PER_MINUTE=30`, `DIAGRAM_TYPES=plantuml,graphviz,vegalite,vega,wavedrom,d2,ditaa,svgbob,nomnoml,erd,bpmn,c4plantuml`.
  Tuỳ chọn sau: nhà cung cấp `local` (`java -jar plantuml.jar -tsvg -pipe`, chỉ quản trị, như `local` của `/run`);
  `deploy/kroki/docker-compose.yml` (ảnh `yuzutech/kroki`) cho ai muốn tự dựng.
- Test: `tests/application/test_diagram_usecase.py` (renderer giả), `tests/adapter/input/controller/test_diagram_controller.py`
  (TestClient + `dependency_overrides`), `tests/adapter/output/diagram/test_kroki_renderer.py` (`httpx.MockTransport`) —
  không gọi mạng thật.

Client: `src/services/diagramClient.ts` (`resolveApiBase()` từ `runtimeConfig.ts`, như `aiClient.ts`; đệm RAM theo băm;
lỗi theo `data.code`), `src/components/ServerDiagram.tsx` (nút → fetch → `<img alt>` data URL; `role="img"`).
Service worker **không** cache `/diagram/*` (đúng bất biến ở `pwa/sw.js:11-12,114`).

### 3.4 Graphviz `dot` và đuôi dài

- Mặc định: `ServerDiagram` qua Kroki (nếu bật) — cùng route.
- Tuỳ chọn (chờ quyết): bộ dịch `dot → mermaid flowchart` tập con (`digraph/graph`, `a -> b [label=x]`, `rankdir`,
  `node [shape=box]`, `subgraph cluster_x`), cỡ S–M, offline. Hoặc `@viz-js/viz` (Graphviz WASM, ~1,4 MB, phụ thuộc mới) — không đề xuất lúc này.
- vega-lite, wavedrom: chỉ qua máy chủ. abc notation: Kroki không hỗ trợ → giữ khối mã (abcjs ~500 KB, không đề xuất).
  geojson/topojson/STL: giữ khối mã (cần bản đồ/3D + mạng).

### 3.5 Xuất HTML / PDF / PNG

Tự động hưởng mọi sửa (cùng DOM). Việc riêng:
- `exportHtml`: khi chép `@font-face`, đổi `url(…)` tương đối thành tuyệt đối theo `sheet.href` (online vẫn có font); tuỳ
  chọn "nhúng font KaTeX" (data URL các woff2 thật sự dùng, ≤ ~300 KB) cho bản offline hoàn toàn — chờ quyết.
- PNG/PDF: kiểm bằng trình duyệt thật rằng KaTeX, `<svg>` mermaid, `<img data:image/svg+xml>` (PlantUML máy chủ, SVG người
  dùng) đều có trong ảnh [suy đoán: html2canvas vẽ được; Safari có thể "nhiễm bẩn" với SVG chứa foreignObject].

### 3.6 Định dạng LLM — kiểm kê, trạng thái, ưu tiên, cách thêm

| Định dạng (ai hay dùng) | Hiện tại [đã kiểm] | Ưu tiên | Cách thêm |
| --- | --- | --- | --- |
| `$…$`, `$$…$$` khối (Claude, Gemini) | ✅ | — | — |
| `\(…\)`, `\[…\]` (ChatGPT, Claude đôi khi) | ❌ | **P0** | §3.1 |
| `$$x$$` một dòng (Gemini) | ⚠️ inline | **P0** | §3.1.3 |
| `\begin{align}` trần, `\\` | ❌ | **P0** | §3.1 |
| `$` giá tiền (ChatGPT) | ❌ công thức giả | **P0** | luật pandoc §3.1.2 |
| `\ce{}`/`\pu{}` mhchem | ❌ đỏ | P1 | `katex/contrib/mhchem` |
| `\label/\eqref/\ref/\require`, multline/eqnarray/flalign | ❌ đỏ | P1 | macros + `fixTex` |
| `\boxed`, `\tag`, `\operatorname`, `\bm`, `cases`, `pmatrix`, `CD` | ✅ | — | — |
| `\SI` (siunitx) | ❌ | P3 | không làm |
| mermaid (cả 3) | ✅ ; ```` ```mmd ```` ❌ | P2 | bí danh `mmd` |
| PlantUML ```` ```plantuml ````/`puml`/`@startuml` trần | ❌ | **P0** (yêu cầu 2) | §3.2–3.3 |
| graphviz `dot` (Claude, ChatGPT) | ❌ | P2 | §3.4 |
| GitHub alerts `> [!NOTE]` … `[!CAUTION]` (Claude, Gemini, ChatGPT; Obsidian `> [!info] Tiêu đề`, `[!faq]-` gập) | ❌ | **P1** | `remarkAlerts.ts`: blockquote có đoạn đầu bắt đầu `[!TYPE]` → bỏ dấu, thêm `data.hProperties.className = ['markdown-alert','markdown-alert-note']` (giữ thẻ `blockquote` ⇒ giữ `data-line`) + đoạn tiêu đề `p.markdown-alert-title`; bí danh info/hint/success/danger/error/question/faq…; CSS sáng/tối + biểu tượng bằng `::before` |
| Dấu trích dẫn LLM: `[cite_start]`, `[cite: 1, 2]` (Gemini), `【4†source】`, `:contentReference[oaicite:0]{index=0}` (ChatGPT) | ❌ rác | **P1** | `remarkLlmCitations.ts` duyệt nút `text`: bỏ `[cite_start]` và `:contentReference[…]{…}`; `[cite: …]`/`【n†…】` → `<sup class="llm-cite">[1, 2]</sup>` (hName) — tuỳ chọn ẩn hẳn |
| Footnote `[^1]` | ✅ | — | — |
| Task list | ✅ (tick sửa nguồn) | — | — |
| Bảng căn lề | ✅ | — | — |
| `<details>/<summary>` | ✅ | — | — |
| `<sup>/<sub>/<kbd>/<mark>/<ins>/<u>` | ✅ | — | — |
| `<br>` trong ô bảng, hard break | ✅ | — | — |
| `==highlight==` (Obsidian, đôi khi Claude) | ❌ | P2 | `remarkHighlight.ts`: tách nút `text` theo `/==(?=\S)([^=\n]*?\S)==/` → `mark` (hạn chế: không bọc qua `**…**` lồng — ghi rõ) |
| Front matter YAML/TOML | ❌ ra `<hr>`+`<h2>` | P2 | trong `prepareMarkdown`, giữ dòng: dòng `---` đầu → ```` ```yaml front-matter ````, dòng `---` đóng → ```` ``` ```` → khối gập "Front matter" |
| Tên tệp khối mã (```` ```python title="x" ````, ```` ```js:app.js ````) | ❌ mất | P2 | rehype plugin chép `node.data.meta` → `data-meta` (sanitizer cho phép trên `code`); `CodeBlock` hiện tên tệp; regex `language-(\S+)` tách `js:app.js` |
| ```` ```diff ```` | ✅ (Prism `diff`) | — | màu chưa kiểm bằng mắt |
| SVG: ```` ```svg ```` và `<svg>` thô | ❌ (thô bị xoá sạch) | P2 | ```` ```svg ```` → `<img data:image/svg+xml>` + nút xem mã; `<svg>` thô: rehype plugin TRƯỚC sanitizer cắt nguyên văn theo `position` từ `file.value` → `img` data URL |
| `~sub~`/`^sup^` (pandoc) | ❌ (`H~2~O` thành gạch ngang) | P3 | chờ quyết `remarkGfm({singleTilde:false})` |
| Emoji `:smile:` | ❌ | P3 | LLM gần như luôn xuất emoji Unicode (✅); nếu cần: bảng ~150 mã phổ biến tự viết (~3 KB) |
| Definition list `Term\n: def` | ❌ | P3 | plugin đoạn → `dl/dt/dd`; hiếm |
| `:::note`, `!!! note`, `[TOC]` | ❌ | P3 | `:::` → alert trong `prepareMarkdown` (thêm `> ` từng dòng, giữ dòng); `[TOC]` → danh sách từ `extractHeadings` |
| vega-lite / chart, wavedrom | ❌ | P3 | §3.4 (máy chủ) ; biểu đồ đơn giản: mermaid `pie`/`xychart-beta` đã chạy |
| abc, geojson, STL | ❌ | P3 | không làm (giữ khối mã) |
| Citation `[1]` có định nghĩa | ✅ (liên kết) | — | — |
| `<p align="center">` | ✅ | — | — |
| `style="…"` thô | ✅ nhưng **rủi ro** | **P1 bảo mật** | `rehypeStyleGuard.ts` trước sanitizer: bỏ khai báo có `url(`, `expression`, `behavior`, `-moz-binding`, `@import`, `position: fixed/sticky`; giữ phần còn lại |

### 3.7 Personal Wiki và Algorithm Notebook (viết tay)

Hiện trạng [đọc mã]: `personal-wiki/assets/js/core/markdown.js` (244 dòng, tự viết, "an toàn bằng cấu trúc": mọi chữ qua
`esc()`, HTML thô hiện nguyên văn) **không có toán, không có sơ đồ**: `\[`/`\(` bị luật escape biến thành `[`/`(`
(`markdown.js:60`), `_…_`/`*…*` trong công thức thành nghiêng (`:97-101`), ```` ```mermaid ```` chỉ là khối mã (`:133-140`).
Algorithm Notebook dùng bản chép (`algorithm-notebook/sync.py:19-36`, đổi `Wiki`→`Algo`). Hai app được chủ dự án duyệt
"không thêm thư viện" (`tasks/2610/261017/personal-wiki/ban-giao.md:3`, `…/algorithm-notebook/ban-giao.md:3`).

Tiền lệ trong repo [đọc mã]: khoá học nạp KaTeX 0.16.9 từ cdnjs bằng `<script>` (`courses/khoa-hoc/index.html:13,108`) và
mermaid 10.9.1 **nạp lười** từ cdnjs (`courses/engine/hien-thi.js:623-664`); cách bảo vệ toán = rút ra placeholder trước khi
markdown chạy (`hien-thi.js:459-498`, có luật "`$ 5 và $ 7` không phải công thức"). Không có bản KaTeX/mermaid nào chép cục bộ
cho app viết tay (bản trong `markdown-editor-pro/assets` là tệp băm của bản build — không dùng chéo).

Thiết kế (nguồn thật ở personal-wiki, chép sang notebook bằng `sync.py`):
1. `markdown.js` (không thư viện, làm ngay — tự nó đã sửa được "toán bị phá"):
   - Khối: dòng `$$` / `\[` một mình → gom tới `$$` / `\]`; `$$…$$` hoặc `\[…\]` một mình một dòng; `\begin{ENV}` đầu dòng
     → tới `\end{ENV}`; rào ```` ```math ```` → `<div class="math math-d" data-tex="…">TeX đã esc</div>`.
     `startsBlock` nhận các mở khối này để đoạn văn ngắt đúng.
   - Inline trong `inline()`, **trước** luật escape ở dòng 60: `\(…\)`, `$$…$$`, `$…$` (luật pandoc như §3.1.2) →
     `hold('<span class="math" data-tex="…">TeX</span>')` (placeholder sẵn có ⇒ nhấn mạnh không đụng vào).
   - ```` ```mermaid ```` → `<pre class="code mmd" data-lang="mermaid">` (nguồn đã esc); ```` ```plantuml ```` giữ khối mã (pha sau).
   - Hiển thị dự phòng khi chưa có KaTeX: TeX nguyên văn, kiểu `code`, `title="Công thức"`.
2. `ui/rich.js` mới (nguồn thật ở wiki, thêm vào `FILES` của `sync.py`): `Wiki.rich.hydrate(rootEl) → Promise` — nếu có
   `.math`/`.mmd` thì nạp lười thư viện **theo quyết định của chủ dự án** (xem mục cần quyết): (i) không thư viện = chỉ dự
   phòng; (ii) KaTeX chép cục bộ `assets/vendor/katex/` (272 KB js + 24 KB css + 20 woff2 296 KB, đệm runtime cache-first
   trong `sw.js` cùng origin); (iii) cdnjs có `integrity` như khoá học, offline → dự phòng. Mermaid: chỉ (iii) (3,5 MB quá
   nặng để chép), `securityLevel: 'strict'`. `katex.render(tex, el, {displayMode, throwOnError:false, trust:false, strict:'ignore'})`.
3. Nối: `ui/editor.js:163` (xem trước), `ui/views.js:14`, `ui/exporters.js:11-27` (**chờ** `hydrate(area)` xong rồi mới
   `print()`; vẽ PNG coi `.math` là đoạn `code` trong `runsOf`). Notebook: `ui/detail.js:9-10`, `ui/exporters.js:7`.
4. Rủi ro dữ liệu notebook [đã kiểm grep]: `assets/data/lib-string.js:185` có hai `'$'` trong một câu trả lời thẻ ôn → theo
   luật pandoc vẫn thành công thức giả. Sửa dữ liệu thành code span `` `'$'` `` và thêm luật vào `kiem-lib.js`: render mọi
   trường thư viện, khẳng định không sinh `.math` ngoài ý muốn.
5. Sau sửa: `node …/personal-wiki/kiem.js`, `check.py --tinh --chuc-nang --co-gian` (XSS: `data-tex` phải esc), `tao-pwa.py`
   (cả hai app), `sync.py` rồi `sync.py --kiem`, notebook `kiem.js`, `kiem-lib.js`, `check.py`. Kiểm trình duyệt dùng
   `page.route` phục vụ KaTeX từ `markdown-editor/node_modules/katex/dist` (không cần mạng).

---

## 4. Danh sách việc (theo thứ tự phụ thuộc)

| # | Việc | Tệp | Kiểm | Cỡ |
| --- | --- | --- | --- | --- |
| 0 | Chạy nền: `npm test && npm run type-check && npm run lint` ghi số test hiện có | — | xanh | S |
| 1 | Sửa schema `code` (math-inline/display) + chú thích; bọc khối toán `div.math-block[data-line]`; regex `language-(\S+)`; tạo bộ test render `MarkdownView` bằng `renderToStaticMarkup` (mermaid mock) | `src/lib/rehypeEnhance.ts`, `src/components/MarkdownView.tsx`, `src/__tests__/markdownRender.test.tsx` | khối `$$` có `data-line`; ```` ```c++ ```` → `cpp`; test cũ xanh | S |
| 2 | `findSkipRanges` + `normalizeMath` (thuần) | `src/lib/mathDelimiters.ts`, `src/lib/__tests__/mathDelimiters.test.ts` | ≥40 vectơ ở §1.2/§3.1.2 + tính chất "số dòng không đổi" + code/rào/`$$` không đổi + 300 KB < 100 ms | M |
| 3 | `remarkMathPromote` + `fixTex` + `prepareMarkdown` + nối vào `MarkdownView` (useMemo), tuỳ chọn KaTeX (strict, macros mới mỗi lần), `katex/contrib/mhchem`, khai báo module; cập nhật HelpModal + tài liệu chào | `src/lib/remarkMathPromote.ts`, `src/lib/prepareMarkdown.ts`, `src/components/MarkdownView.tsx`, `src/vite-env.d.ts`, `src/components/HelpModal.tsx`, `src/store.ts`, (`package.json` nếu được duyệt khai báo `katex`) | test render: `\[…\]` → `.katex-display`, `\(…\)` inline, align trần, `$5 and $10` không có `.katex`, `\ce` không đỏ, không `katex-error` | M |
| 4 | GitHub alerts + callout Obsidian + CSS | `src/lib/remarkAlerts.ts`, `src/components/Preview.css`, `src/components/ReadingView.css` | test 5 loại + bí danh + gập `-`; tương phản sáng/tối | S |
| 5 | Dấu trích dẫn LLM | `src/lib/remarkLlmCitations.ts` (+ CSS) | test 4 kiểu, không đụng code span | S |
| 6 | `==mark==` + bí danh `mmd` + front matter (giữ dòng) + tên tệp khối mã | `src/lib/remarkHighlight.ts`, `src/lib/prepareMarkdown.ts`, `src/lib/rehypeCodeMeta.ts`, `src/components/CodeBlock.tsx`, `rehypeEnhance.ts` (schema `data-meta`) | test từng mục; số dòng giữ nguyên | S |
| 7 | Chặn `style` nguy hiểm | `src/lib/rehypeStyleGuard.ts`, `MarkdownView.tsx` | test: `url(`, `position:fixed`, `expression` bị bỏ; `color:red` giữ; KaTeX vẫn có style (chạy sau) | S |
| 8 | SVG: ```` ```svg ```` + `<svg>` thô → `<img data:>` | `src/lib/rehypeSvgImage.ts`, `MarkdownView.tsx` | test: không còn phần tử `svg` từ người dùng, có `img[src^="data:image/svg+xml"]`; `<svg onload>` không thành thuộc tính | S |
| 9 | Bộ dịch PlantUML: lõi + sequence | `src/lib/diagrams/plantuml/{index,common,sequence}.ts` + test | vectơ vào→ra; lỗi rõ cho cú pháp không hỗ trợ | M |
| 10 | class + state | `…/plantuml/{classDiagram,state}.ts` + test | vectơ | M |
| 11 | activity (mới) + usecase/component + mindmap | `…/plantuml/{activity,usecase,mindmap}.ts` + test | vectơ; cấu trúc if/while lồng 3 cấp | M |
| 12 | `PlantUmlDiagram` + `@startuml` trần → rào (giữ dòng) + nối `MarkdownView` + CSS | `src/components/PlantUmlDiagram.tsx`, `prepareMarkdown.ts`, `MarkdownView.tsx`, `Preview.css` | test component (mermaid mock nhận đúng nguồn); Unsupported → CodeBlock + thông báo | M |
| 13 | Backend `/diagram` | `backend/fastapi/src/{domain/vo/diagram_vo.py, application/ports/{input,output}/diagram_*.py, application/usecases/diagram_usecase.py, adapter/output/diagram/kroki_renderer.py, adapter/factory/diagram_factory.py, adapter/input/controllers/diagram_controller.py, main.py, application/config/config.py}`, `.env.example`, README; 3 tệp test | `pytest tests/application/test_diagram_usecase.py tests/adapter/input/controller/test_diagram_controller.py tests/adapter/output/diagram -q` rồi toàn bộ | M |
| 14 | Client máy chủ: `diagramClient` + `ServerDiagram` + cài đặt off/ask/auto + nút trong PlantUML + rào dot/vega-lite/… | `src/services/diagramClient.ts` (+test), `src/components/ServerDiagram.tsx`, `PlantUmlDiagram.tsx`, `MarkdownView.tsx`, `Header.tsx` (menu View), `store.ts` | test fetch giả: chỉ gửi khi bấm (ask); hiển thị bằng `img` (khẳng định không có `svg` inline); lỗi 429/400 có thông báo tiếng Việt | M |
| 15 | Xuất HTML: URL font tuyệt đối (+ tuỳ chọn nhúng) | `src/lib/exporters.ts` (+test hàm đổi URL) | test thuần; kiểm Edge ở việc 16 | S |
| 16 | Kiểm trình duyệt thật + xuất bản: `scripts/kiem-hien-thi.py` (Edge, server thật SQLite tạm, tài liệu mẫu mọi định dạng, đếm `.katex-display`/`katex-error`/svg mermaid/alert/`img` SVG, cuộn đồng bộ tới khối toán, xuất HTML có KaTeX, ảnh chụp) → `node scripts/build-webapps.mjs --only markdown-editor` + `--check` → `kiem-pwa.py` (PlantUML/KaTeX offline) | `markdown-editor/scripts/kiem-hien-thi.py` | exit 0 | M |
| 17 | Wiki `markdown.js`: toán (khối + inline + pandoc + `\begin`) + mermaid đánh dấu, dự phòng không thư viện | `personal-wiki/assets/js/core/markdown.js`, `assets/css/app.css`, `kiem.js` | `node …/personal-wiki/kiem.js`; XSS `data-tex` | M |
| 18 | Wiki `ui/rich.js` hydrate (theo quyết định thư viện) + nối editor/views/exporters + `check.py` | `personal-wiki/assets/js/ui/{rich,editor,views,exporters}.js`, `index.html`, (`assets/vendor/katex/` nếu duyệt), `sw.js` qua `tao-pwa.py`, `check.py` | `check.py --tinh --chuc-nang --co-gian --song-sot` | M |
| 19 | Notebook: `sync.py` (+rich.js), sửa `lib-string.js` `'$'`, luật `kiem-lib.js`, nối `detail.js`/`exporters.js`, `tao-pwa.py` | `algorithm-notebook/{sync.py, assets/data/lib-string.js, kiem-lib.js, assets/js/ui/detail.js, assets/js/ui/exporters.js, index.html}` | `sync.py --kiem`, `kiem.js`, `kiem-lib.js`, `check.py --tat-ca` | S |
| 20 | Bàn giao | `tasks/2610/2610xx/markdown-hien-thi/ban-giao.md`, `.claude/skills/ban-do-ung-dung/SKILL.md` | — | S |

Việc 1–8 độc lập với 9–16 sau việc 3; 13 độc lập với frontend; 17–19 độc lập với React (chỉ chung luật §3.1.2 — dùng
chung bộ vectơ test dạng JSON nếu muốn).

## 5. Phụ thuộc

- `katex` (khai báo tường minh trong `package.json`, cùng bản 0.16.47 đã cài qua rehype-katex) — **0 byte thêm**; chỉ
  mhchem +34 KB min (8,4 KB gzip) vào chunk `markdown`. Thay thế không phụ thuộc: bỏ mhchem (`\ce` vẫn đỏ). Mã hiện tại đã
  `import 'katex/dist/katex.min.css'` mà không khai báo.
- Backend: không (httpx đã có, `requirements.txt:46`).
- Tuỳ chọn, KHÔNG đề xuất ngay: `@viz-js/viz` (~1,4 MB) cho Graphviz offline — thay bằng Kroki hoặc bộ dịch dot→mermaid;
  `dompurify` (khai báo, đã có 3.4.14 qua mermaid, 29 KB) chỉ khi cần SVG inline — thay bằng `<img>` data URL.
- Wiki/notebook: bản chép KaTeX cục bộ (~590 KB) **nếu** chủ dự án chọn; thay thế: dự phòng TeX nguyên văn hoặc cdnjs.

## 6. Cần chủ dự án quyết

1. PlantUML mặc định: (c) dịch offline sang Mermaid [đề xuất] / chỉ máy chủ / gọi thẳng plantuml.com từ trình duyệt.
2. Máy vẽ phía máy chủ: Kroki công khai `kroki.io` (nội dung sơ đồ rời máy chủ mình) / tự dựng Kroki (docker) / tắt;
   chế độ mặc định phía client `ask` [đề xuất] / `auto` / `off`.
3. Luật `$` pandoc đầy đủ [đề xuất] (đổi cách hiện `$ x $` có khoảng trắng — thành chữ thường) hay chỉ luật "đóng không
   được theo sau bởi chữ số".
4. Dấu trích dẫn LLM: hiện thành chip `[1]` [đề xuất] / ẩn hẳn.
5. Thư viện cho Wiki + Notebook: không thư viện (chỉ dự phòng TeX) / chép KaTeX cục bộ (offline) [đề xuất] / cdnjs nạp lười như khoá học.
6. Khai báo `katex` trong `package.json` + nạp mhchem (+8,4 KB gzip) — có/không.
7. Graphviz: chỉ máy chủ [đề xuất] / thêm bộ dịch dot→mermaid / `@viz-js/viz`.
8. GFM single tilde: giữ như GitHub [đề xuất] / tắt để hỗ trợ `~sub~`.

## 7. Rủi ro

- Heuristic delimiter nhận nhầm văn bản thường (`\(` trong bài viết về regex, `\[x\]` thoát ngoặc) → giảm bằng: bỏ qua code,
  đóng phải trong cùng đoạn, `\[` giữa câu phải "giống TeX"; ghi cách tránh (dùng code span hoặc `\\[`).
- Bộ quét code tự viết sai ở ca lạ (rào lồng trong danh sách thụt khác, khối HTML) → có phương án dự phòng parse 2 lần (đã đo).
- Luật `$` pandoc đổi hình hiển thị tài liệu cũ viết `$ x $`.
- Bộ dịch PlantUML chỉ xấp xỉ, phải theo kịp cú pháp Mermaid (11.17.2); cần `mermaid.parse` trong kiểm trình duyệt.
- Kroki công khai: riêng tư, sẵn sàng, giới hạn; Vercel cold start + timeout 10 s; giới hạn tần suất RAM theo instance.
- Parse vốn chậm (5–8 ms/KB) — thêm plugin phải đo lại; mục tiêu bộ quét ≤ 0,2 ms/KB.
- html2canvas với SVG/`img` SVG trên Safari; font KaTeX trong HTML xuất ra.
- Wiki/notebook: `$` trong ghi chú/thư viện thành công thức giả (đã thấy `lib-string.js:185`).
- Nếu tạo lại junction `node_modules` trong scratch để chạy nháp: dọn bằng `cmd //c "rmdir node_modules"`, không `rm -rf`.
- Luật "`\[` giữa câu phải giống TeX" và bộ quét code tự viết (`findSkipRanges`) là phần THIẾT KẾ thêm sau bản mẫu (bản mẫu
  dùng vùng code lấy từ lần parse đầu) → phải có vectơ test riêng ở việc 2.

## 8. Lệnh kiểm

```text
cd markdown-editor && npm test && npm run type-check && npm run lint && npm run build
node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check
backend\fastapi\.venv\Scripts\python.exe markdown-editor\scripts\kiem-hien-thi.py        (mới, việc 16)
backend\fastapi\.venv\Scripts\python.exe markdown-editor\scripts\kiem-pwa.py
cd backend/fastapi && .venv/Scripts/python.exe -m pytest tests/application/test_diagram_usecase.py tests/adapter/input/controller/test_diagram_controller.py tests/adapter/output/diagram -q
cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q
node backend/fastapi/webapp/tranphuc8a/personal-wiki/kiem.js
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/personal-wiki/check.py --tinh --chuc-nang --co-gian --song-sot
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/personal-wiki/tao-pwa.py
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/sync.py --kiem
node backend/fastapi/webapp/tranphuc8a/algorithm-notebook/kiem.js && node backend/fastapi/webapp/tranphuc8a/algorithm-notebook/kiem-lib.js
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/check.py --tat-ca
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/tao-pwa.py
(nháp, tái hiện kết quả ở §1.2/§3.1) cd <scratch>/md-render && node gen.mjs && node cases-math.mjs && node cases-proto.mjs && node perf2.mjs
```
