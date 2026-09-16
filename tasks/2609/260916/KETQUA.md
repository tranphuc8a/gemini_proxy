# Kết quả — 9 hạng mục (2026-09-16)

Tài liệu ghi **nguyên nhân gốc**, **chỗ sửa**, **cách kiểm chứng**. Mỗi mục đều
đã chạy qua trình duyệt thật, không chỉ unit test.

Trạng thái kiểm thử cuối phiên:

| Nơi | Kết quả |
|---|---|
| backend pytest | 635 pass |
| gemini frontend | 97 pass |
| postman-lite | 69 pass |
| casio-fx580vnx | 70 pass, lint sạch, typecheck sạch |
| casio-fx580vnx trên trình duyệt | 25/25 check, 0 lỗi console |
| light-grid v1/v2/v3 trên trình duyệt | 8/8 |
| portal trên trình duyệt | 22/22 |

---

## 1. Gemini webapp

### 1a. Message box quá hẹp

Bong bóng chat bị giới hạn `max-width: 50%`. Nới ra, và cho nội dung rộng
(bảng, khối code, sơ đồ) được rộng thêm nữa:

```css
.chat-row > div { max-width: min(120ch, 92%); min-width: 0; }
.chat-row > div:has(.code-block-wrapper, table, .mermaid-diagram) { max-width: 96%; }
```

### 1b. Mermaid luôn báo "Không thể vẽ sơ đồ"

**Nguyên nhân.** Component render có điều kiện: khi lỗi thì thay thẻ chứa sơ đồ
bằng khối mã nguồn. Nhưng `mermaid.render` cần thẻ đó **tồn tại** để gắn SVG vào.
Một lần lỗi là thẻ biến mất vĩnh viễn → không bao giờ vẽ lại được nữa, kể cả khi
mã hoàn toàn hợp lệ. Đây là ngõ cụt một chiều, không phải lỗi cú pháp mermaid.

**Cách sửa.** Thẻ chứa không bao giờ bị gỡ, chỉ bị `hidden`
([`MarkdownRenderer.tsx`](frontend/src/components/MarkdownRenderer.tsx)):

```tsx
const showSource = Boolean(error) && !rendered
<div className="mermaid-host" ref={hostRef} hidden={showSource} />
```

kèm `.mermaid-host[hidden] { display: none !important; }` — vì một class khác
đang đặt `display`, mà `[hidden]` thua class.

### 1c. Scroll giật, nạp trùng tin cũ

Ba lỗi riêng biệt trong [`ChatArea.tsx`](frontend/src/components/ChatArea.tsx):

- **nạp trùng**: cờ chống trùng là state, nên handler đọc phải giá trị cũ →
  chuyển sang `loadingOlderRef`.
- **giật**: handler scroll chạy mỗi sự kiện → gom lại một `requestAnimationFrame`
  mỗi khung hình, và `setShowJumpToLatest` chỉ gọi khi giá trị **đổi**.
- **nhảy vị trí**: neo vị trí đặt trong `useEffect` (chạy sau khi vẽ, thấy được
  cú nhảy) → chuyển sang `useLayoutEffect`.

---

## 2. Portal

Viết lại toàn bộ [`portal.js`](backend/fastapi/webapp/_portal/portal.js),
`portal.html`, `portal.css`:

- **Tìm kiếm có chấm điểm** theo trường: `title 100, name 80, tag 45,
  collection 30, description 12`; khớp đầu chuỗi ×1.6, khớp đúng ×2.2.
- **Bỏ dấu tiếng Việt** khi so khớp (chuẩn hoá NFD) — gõ "may tinh" ra "máy tính".
- **Sắp xếp**: liên quan / phổ biến / gần đây / tên A–Z / tên Z–A / bộ sưu tập.
- **Lọc** theo collection và tag, có đếm số lượng, chuyển được giữa "bất kỳ" và
  "tất cả".
- **Độ phổ biến** lưu ở `localStorage` khoá `portal:usage` dạng `{count, last}`.
- Bộ lọc phản chiếu vào query string nên chia sẻ được đường dẫn.
- Phím `/` nhảy vào ô tìm kiếm; có dải "gần đây"; chuyển được lưới/danh sách.

---

## 3. light-grid-v1 — bật "Xem trước nước bấm" thì không click được

**Nguyên nhân.** `pointerenter` gọi `render()`, mà `render` **xoá rỗng** thẻ
`<svg>` rồi dựng lại toàn bộ. Phần tử dưới con trỏ bị huỷ giữa chừng cử chỉ bấm,
nên `pointerdown` và `pointerup` không rơi vào **cùng một** phần tử → trình duyệt
không phát sinh `click` nào cả.

**Cách sửa.** Thêm `decorate()` vào
[`light-grid-shared/render.js`](backend/fastapi/webapp/tranphuc8a/light-grid-shared/render.js):
chỉ sửa thuộc tính `class` của các ô **đã vẽ**, không dựng lại DOM. `onHover` gọi
`decorate()` thay cho `render()`.

---

## 4 & 5. light-grid-v2, v3 — không chọn được hình dạng / luật khác

**Nguyên nhân.** `syncControls()` ghi giá trị của **bàn cờ hiện tại** ngược lại
vào các ô chọn, và nó được gọi ngay trong handler `change`. Người dùng chọn
"Hình tròn", handler chạy, `syncControls` lập tức ghi đè về "Hình chữ nhật".

**Cách sửa.** Tách đôi: `updateDependentFields()` (đọc **từ ô chọn**) cho handler
`change`; `syncControls()` (ghi **từ bàn cờ**) chỉ gọi sau khi bàn cờ thật sự đổi
— import, apply, preset, khởi động.

### v3 — toggle và vừa một màn hình

- "Mọi lời giải" và "Mẫu im lặng" giờ bật/tắt khi bấm lại, qua `toggleHighlight`;
  chip đang hiện có dấu `✕`.
- Bố cục bỏ con số ma thuật `calc(100vh - 62px)` (vẫn tràn 8px) và chuyển sang
  `body` flex dọc `height: 100vh; overflow: hidden`, các cột `min-height: 0`.

---

## 6. mongo-administrator & sql-administrator — hay bị "Session expired"

**Nguyên nhân.** Session **có** dùng token và vốn sống tới khi logout. Vấn đề là
nhiều worker: mỗi worker giữ bản sao trong RAM và chỉ đọc file mirror **một lần**
lúc khởi động. Worker B không thấy session worker A vừa tạo → "Session expired".

**Cách sửa** (giống nhau ở
[`sqlgateway/session_store.py`](backend/fastapi/src/adapter/output/sqlgateway/session_store.py)
và [`mongogateway/session_store.py`](backend/fastapi/src/adapter/output/mongogateway/session_store.py)):

```python
RELOAD_MIN_INTERVAL_SECONDS = 1.0   # đọc lại khi tra không thấy, tối đa 1 lần/giây
RELOAD_MAX_AGE_SECONDS = 15.0       # dữ liệu cũ quá 15 giây thì đọc lại
```

Lúc viết test mới phát hiện thêm **một lỗ hổng thật**: nếu chỉ đọc lại ở nhánh
"không thấy", một session **đã logout** vẫn dùng được vô thời hạn trên worker
khác. Vì vậy `_reload_locked` **thay thế** chứ không trộn, và nhánh "thấy" cũng
kiểm tra tuổi dữ liệu. Có 4 test phủ đúng bốn tình huống này trong
[`test_session_records.py`](backend/fastapi/tests/adapter/output/sessionstore/test_session_records.py).

---

## 7. postman-lite-pro

- **Giao diện**: METHOD, URL và nút Send cao 40px, nền nổi, các nút phụ chuyển
  sang kiểu chìm — [`app.css`](postman-lite/src/styles/app.css).
- **Xoá response**: thêm `clearResponse(tabId)` trong `store.ts` (đồng thời xoá
  các ô so sánh đang trỏ vào response đó) và nút **Xoá** trong `ResponsePanel.tsx`.
- **`https://u` → `https: /u`**: ⚠️ **chưa tái hiện được.** Đã thử 12 kịch bản
  trên trình duyệt thật (gõ từng ký tự ở 0/5/15/60 ms, `fill`, dán, blur, có/không
  query, có dấu cách, có dấu `+`, phát sự kiện input bằng code, tải lại trang).
  `onUrlChange` truyền thẳng giá trị, không chỗ nào khác ghi vào `url`, và
  `buildUrl`/`stripQuery`/`extractParams` đã được test chứng minh là truyền
  nguyên văn (2 test mới trong `src/test/lib.test.ts` ghim các trạng thái gõ dở
  `'h'`, `'https:'`, `'https:/'`, `'https://'`, `'https://u'`).
  **Cần anh cho biết**: trình duyệt nào, gõ chính xác những phím gì, và lúc đó có
  đang chọn environment không.

  Ngoài lề, phát hiện một lỗi nhỏ khác: tải lại trang thì ô URL trở về rỗng.

---

## 8. Icon cho các ứng dụng

Thêm [`scripts/generate-app-metadata.mjs`](scripts/generate-app-metadata.mjs):
suy ra title/icon/tags từ tên thư mục và bộ sưu tập. **Không bao giờ ghi đè**
`metadata.json` viết tay; file sinh ra có cờ `"generated": true`. Chạy với
`--write`, ép ghi với `--force`.

Kết quả: **219 file sinh mới, 22 file viết tay được giữ nguyên, tổng 240 ứng dụng**.

---

## 9. Webapp mới — CASIO fx-580VN X

Thư mục nguồn [`casio-fx580vnx/`](casio-fx580vnx/), đã publish vào
`backend/fastapi/webapp/tranphuc8a/casio-fx580vnx/` và đã đăng ký trong
`scripts/build-webapps.mjs`. Công nghệ: Vite + React 18 + TypeScript + zustand,
không thêm dependency nào ngoài bộ đã dùng ở các app khác trong repo.

### Quyết định thiết kế quan trọng nhất: số hữu tỉ, không phải float

Máy thật hiển thị `1/3` là phân số, `√8` là `2√2`, và chỉ rơi về thập phân khi
buộc phải thế. Đó không phải chuyện thẩm mỹ — đó là khác biệt giữa một máy tính
**đồng ý với sách giáo khoa** và một máy trả lời `0.333333333`. Nên kiểu số nền
tảng là **phân số BigInt**, có cờ `exact`; thập phân chỉ xuất hiện khi không tồn
tại đáp án đúng (sin, ln, √2 đứng một mình).

Hệ quả kiểm chứng được: `20!÷19!` đúng bằng `20`, `0.1+0.2` đúng bằng `3/10`,
`(2÷3)^3` đúng bằng `8/27`.

### Kiến trúc

```
src/engine/    value → tokens → parser → evaluate → format   (thuần, không React)
               solve (EQN), stats (STAT), program (biến nhớ, CALC, nhiều lệnh)
src/store.ts   trạng thái máy: dòng nhập, con trỏ, SHIFT/ALPHA, lịch sử, ngữ cảnh
src/keypad.ts  bàn phím mô tả bằng dữ liệu (nhãn chính / vàng SHIFT / đỏ ALPHA)
src/components/ màn LCD, bàn phím, và các bảng làm việc theo từng mode
```

Engine không biết gì về React nên toàn bộ phần toán kiểm thử được bằng unit test.

### Luật ưu tiên của máy — được ghim bằng test, không phải bằng bình luận

`src/engine/__tests__/engine.test.ts` ghim đúng những gì docstring của parser hứa:

| Biểu thức | Kết quả | Vì sao |
|---|---|---|
| `−2²` | `−4` | luỹ thừa bám chặt hơn dấu trừ đơn |
| `2^3^2` | `512` | luỹ thừa kết hợp phải |
| `sin 30 + 1` | `3/2` | đối số không ngoặc dừng trước `+` |
| `sin 2×30` | `sin 60` | nhưng vẫn nuốt hết qua `×` |
| `1÷2π` | `1÷(2π)` | phép nhân **ngầm** bám chặt hơn phép chia |

Điểm cuối cùng chỉ diễn đạt được vì tokenizer phát ra token `·` riêng cho phép
nhân do nó tự chèn, khác với `×` người dùng gõ.

### Bốn lỗi tìm ra khi viết test (đều là lỗi thật, đã sửa)

1. **`7 Mod 3` báo lỗi cú pháp.** Tokenizer chèn phép nhân ngầm trước *mọi* tên
   hàm, kể cả những tên viết **giữa** hai đối số → `7 × Mod 3`. Sửa: thêm
   `INFIX_NAMES = {Mod, MOD, nPr, nCr}`, không chèn nhân ngầm trước chúng.
2. **Biến `C` không dùng được.** `'C'` và `'P'` nằm trong danh sách tên hàm, mà
   danh sách đó được thử **trước** danh sách biến → `C` luôn bị đọc là hàm và báo
   "C cần dấu ngoặc". Bỏ hai tên này (chúng không phải cú pháp của máy thật).
3. **`i²` ra `−1 + 1.2×10⁻¹⁶i`.** Luỹ thừa số phức đi đường cực (`e^(ln z · w)`),
   mà `atan2` và `cos` lệch nhau ở bit cuối. Sửa: số mũ nguyên thì nhân lặp — vẫn
   chính xác tuyệt đối.
4. **Phép chia dư sai quy ước dấu.** Code làm mod Euclid (dấu theo số chia);
   phím `÷R` của máy lấy **dấu theo số bị chia**: `−7 ÷R 3` là `−2` dư `−1`.
   Đã đổi theo máy.

Ngoài ra `'°'` có một biểu thức thừa không làm gì (`? 1 : 1`) — thay bằng
`inUnit()` chuyển đúng đơn vị, nên `sin(30°)` bằng ½ **kể cả khi đang ở chế độ
radian**, đúng như máy thật.

### Chức năng đã có

- **COMP** — số học chính xác, phân số/hỗn số/thập phân đổi qua lại bằng S⇔D,
  luỹ thừa, căn, giai thừa, nPr/nCr, GCD/LCM, chia lấy dư, phần trăm, làm tròn.
- **Lượng giác** — độ/radian/grad, giá trị **đúng** cho các góc đặc biệt
  (`sin 30 = ½`, không phải `0.49999999999999994`), `tan 90` báo lỗi thay vì trả
  `1.6×10¹⁶`; hyperbolic và các hàm ngược; đánh dấu đơn vị `°`, `ʳ`, `ᵍ`.
- **Giải tích** — `∫(f, a, b)` (Simpson thích nghi), `d/dx(f, x)` (sai phân đối
  xứng), `Σ(f, đầu, cuối)`, `∏(f, đầu, cuối)`.
- **CMPLX** — bốn phép tính, `Abs`, `Arg`, `Conjg`, nhập dạng `r∠θ`, hiển thị
  được cả dạng đại số và dạng lượng giác.
- **MATRIX** — MatA–MatD, `det`, `Trn`, `Identity`, nghịch đảo; **tất cả tính
  bằng phân số chính xác**, nên định thức ra số nguyên chứ không phải
  `2.9999999999999996`.
- **STAT** — một biến (n, Σx, Σx², x̄, **σx và sx ghi rõ chia cho n hay n−1**,
  min/Q1/trung vị/Q3/max) và hai biến với sáu kiểu hồi quy (tuyến tính, bậc hai,
  logarit, mũ, luỹ thừa, nghịch đảo), có dự đoán ŷ.
- **EQN** — bậc hai (cho ra cặp nghiệm phức khi Δ < 0), bậc ba, hệ 2/3/4 ẩn.
  Ô hệ số nhận **biểu thức**, nên gõ `1÷3` thì nghiệm vẫn ở dạng đúng.
- **TABLE** — bảng f(x) và g(x) theo khoảng và bước.
- **BASE-N** — xem đồng thời cả bốn hệ 2/8/10/16, số âm dạng bù hai 32 bit,
  phép and/or/xor/xnor/not/neg.
- **Bộ nhớ & "lập trình"** — A–F, M, x, y, z, n, `Ans`, `PreAns`; gán bằng `→`;
  nhiều câu lệnh một dòng bằng `:`; `CALC` (thay giá trị vào công thức) và
  `SOLVE` (Newton, tự chuyển sang chia đôi khi Newton đi sai hướng).
- **SETUP** — đơn vị góc, Norm/Fix/Sci. Đổi Fix/Sci vẽ lại **toàn bộ lịch sử**,
  vì lịch sử lưu *giá trị* chứ không lưu chuỗi đã định dạng.

### Hai chỗ cố tình khác máy thật

1. **Bàn phím máy tính gõ thẳng được**, kể cả chữ cái — `sin(30)`, `det(MatA)`,
   `GCD(12,18)`. Săn chữ `A` in đỏ trên phím `x²` không phải tính năng đáng mô phỏng.
2. **Bảng làm việc nằm cạnh bàn phím**, không nấp sau menu mode. Màn hình hai
   dòng là giới hạn của phần cứng, không phải của bài toán.

### Kiểm chứng trên trình duyệt

Kịch bản Playwright mở **bản đã publish**, bấm phím thật và đối chiếu đáp án:
25/25 check, 0 lỗi console. Bao gồm: dựng dòng nhập bằng phím, quy tắc "chữ số
sau kết quả thì nhập mới, toán tử thì nối vào Ans", sáu biểu thức ưu tiên,
ba nấc S⇔D của `7/3`, gán `12→A` rồi đọc lại, EQN giải `x²−5x+6`, STAT tính
trung bình, BASE-N đổi 255, `det(MatA)` sau khi lưu ma trận đơn vị, TABLE lập
bảng, và **không tràn ngang ở cả ba bề rộng 1440/900/420px**.

---

## Việc còn lại

1. **Lỗi `https://u`** — chờ anh cho các bước tái hiện chính xác (mục 7).
2. **Hai lỗi tràn ngang có sẵn từ trước**, chưa động tới vì ngoài phạm vi đợt này:
   `markdown-editor-pro` tràn 178px và `postman-lite-pro` tràn 276px ở bề rộng
   420px.
3. **Ô URL của postman rỗng sau khi tải lại trang** (phát hiện tình cờ, chưa sửa).

## Ba lỗi sửa thêm trong `scripts/audit-webapps.mjs`

Công cụ audit dùng chung, phát hiện khi chạy nó trên app mới.

1. **Bỏ mất tên app đầu tiên.** Khi **không** truyền `--shots`, `shotIndex` là `-1`
   nên biểu thức lọc `index !== shotIndex + 1` thành `index !== 0` — nó âm thầm bỏ
   tham số đầu tiên và đi audit danh sách mặc định. Chính vì vậy lần chạy đầu tiên
   báo kết quả của light-grid chứ không phải của app mình vừa truyền vào.

2. **Chờ 30 giây mỗi nút.** Vòng lặp lấy **tất cả** handle của nút từ đầu, rồi một
   cú click làm React vẽ lại sẽ **detach** toàn bộ handle còn lại. `textContent()`
   không có timeout riêng nên mỗi handle chết phải chờ hết 30 giây mặc định của
   Playwright. Trang có 92 nút → gần một tiếng chỉ để chờ. Thêm
   `{ timeout: 500 }`.

3. **Mù với hộp thoại.** Click trúng nút mở modal là lớp nền phủ kín màn hình;
   mọi click sau đó rơi vào lớp nền chứ không vào nút được gọi tên — audit ngừng
   là audit từ thời điểm đó. Thêm `dismissDialog()` đóng hộp thoại giữa hai lần
   bấm.

**Kết quả:** audit app máy tính từ **>25 phút không xong** xuống **41 giây**, và
`✓ no findings`. Đã chạy lại toàn bộ danh sách cũ (light-grid v1/v2/v3, graphuc)
để chắc bản sửa không làm hỏng gì: 130 giây, không phát hiện nào.

> Đây là lỗi của **công cụ**, không phải của trang. Trước khi tìm ra, tôi đã nghi
> oan cho engine (đoán rằng bấm phím loạn tạo ra biểu thức tính rất lâu). Đo thử thì
> sai: `999999999^1024` mất 4ms, `(9^900)^900` mất 52ms, `∏(x,1,10000)` mất 41ms.

## Ghi chú kỹ thuật cho phiên sau

- Playwright không phải dependency của repo. Cài tạm vào thư mục scratchpad rồi
  trỏ `NODE_PATH` vào đó; trình duyệt Chromium đã có sẵn trong cache của máy.
