# Hướng dẫn soạn bài thực hành

Mỗi bài giảng của khoá `heuristic-2` có một tệp `data/<id>.js` (id = đuôi slug bài giảng, xem `data/khoa.js`). Tệp gọi `TH.dangKy({...})` đúng một lần.
**Bài mẫu: `data/bai-05-greedy.js`** — đọc nó trước, rồi bắt chước cấu trúc và độ sâu.

## 1. Một bài gồm gì

| Khoá | Số lượng | Vai trò |
|---|---|---|
| `tomTat` | 4–8 ý | "Nhớ trong một phút" — ôn lại bằng điện thoại. Mỗi ý một câu đầy đủ, có số liệu cụ thể của bài. |
| `trac` | 8–10 câu (bài chính), 5+ (ca nghiên cứu) | Trắc nghiệm: `mot` (một đáp án), `nhieu` (chọn mọi ý đúng), `so` (điền số). |
| `luan` | 3–4 câu | Tự luận: người học viết ra, rồi xem đáp án mẫu và **tự chấm theo `tieuChi`**. |
| `lab` | 1–2 lab (hoặc `khongLab: "lý do"`) | Bài thực hành lập trình chấm tự động, giải bằng JavaScript hoặc C++. |

Chất lượng quan trọng hơn số lượng. Nội dung phải **bám đúng bài giảng**: mọi con số, tên gọi, công thức trích từ bài; không bịa "sự thật".
Nếu bài giảng có phần *Bài tập* (3–5 câu) và có đáp án trong `backend/course-content/…/dap-an.md` (hoặc bản trích ở scratchpad), hãy chuyển phần lớn chúng thành `luan` / `lab`, kiểm lại đáp án — nếu đáp án trong tài liệu sai hay mâu thuẫn với đề, **dùng đáp án đúng và ghi lại** trong báo cáo cuối của bạn.

### Văn phong và định dạng
- Tiếng Việt có dấu, giọng giảng viên thân thiện, ngắn gọn. Ngôi "bạn".
- **Không dùng TeX/LaTeX.** Viết công thức bằng Unicode: `Σ ≤ ≥ ≈ √ × · σ λ α Δ ε x₁ n² 10⁹ p/w`. Số lớn dùng khoảng trắng nghìn trong văn xuôi (61 420) nhưng **không** trong `dapAn`.
- Markup trong chuỗi: đoạn văn, `**đậm**`, `*nghiêng*`, `` `mã` ``, danh sách `- ` / `1. `, bảng `| a | b |`, trích dẫn `> `, khối mã ``` ```cpp ```. Tránh `*` làm dấu nhân (dùng `×` hoặc `·`).
- Không HTML.

## 2. Trắc nghiệm (`trac`)

```js
{ id: "q1", loai: "mot", doKho: 1, ref: "§4.3",          // ref = mục trong bài giảng (tuỳ chọn)
  hoi: "…", chon: ["…", "…", "…", "…"], dung: 2,           // dung = chỉ số của đáp án đúng
  giaiThich: "Vì sao đúng VÀ vì sao từng lựa chọn sai kia sai (≥ 20 ký tự)." }
{ id: "q2", loai: "nhieu", …, chon: [5 lựa chọn], dung: [0, 2, 3] }       // ít hơn tổng số lựa chọn
{ id: "q3", loai: "so", …, dapAn: 390, saiSo: 0, donVi: "(nghìn)" }       // saiSo tuyệt đối; hoặc tuongDoi: 0.01
```
Quy tắc chất lượng:
- Đáp án sẽ bị **xáo thứ tự** khi hiển thị ⇒ cấm “tất cả các đáp án trên”, “cả A và B”, “không đáp án nào đúng”, và cấm câu hỏi/giải thích nhắc “đáp án A/B”. Lược đồ tự bắt các cụm này.
- Phương án nhiễu phải **hợp lý**: lấy từ hiểu lầm thật, từ mục “Cạm bẫy”, từ ví dụ phản trực giác của bài. Không đáp án ngớ ngẩn.
- Đa dạng: khái niệm, tính toán, tình huống “nên làm gì”, nhận ra lỗi. Trải `dung` đều (đừng để toàn `0`). Độ khó 1–3.
- Câu `so`: **tính bằng code** (node) để chắc đáp án; ghi cách tính trong `giaiThich`.
- Mỗi câu kiểm một ý. Không hỏi thuộc lòng vô nghĩa.

## 3. Tự luận (`luan`)

```js
{ id: "l1", doKho: 2, ref: "Bài tập 5.2",
  hoi: "…", goiY: ["…"],                        // gợi ý (tuỳ chọn), mở dần
  mau: "Đáp án mẫu đầy đủ, có lập luận (markup).",
  tieuChi: ["ý bắt buộc 1", "ý bắt buộc 2", "…"] }   // 2–6 ý để người học TỰ tick
```
`tieuChi` là danh sách kiểm: người học đọc `mau` rồi tick những ý mình đã viết đúng. Mỗi tiêu chí phải kiểm chứng được, không mơ hồ.

## 4. Lab (chấm tự động)

Giao thức kiểu judge: trang sinh dữ liệu từ seed, đưa vào **stdin**; lời giải in kết quả ra **stdout**; bộ chấm của bài toán chấm. Cùng một lab giải được bằng **JavaScript** (chạy ngay trong trình duyệt) hoặc **C++** (biên dịch bằng Clang-WASM).

```js
{ id: "tui-ti-so", ten: "…", doKho: 1, ref: "§3.3",
  de: "Đề bài (markup, ≥ 60 ký tự). Nói rõ nhiệm vụ, số test, các mức đạt, câu hỏi suy ngẫm.",
  vanDe: "tui",                       // tên bài toán đã đăng ký (xem §5)
  tham: { n: 100 },                   // tham số sinh dữ liệu; hoặc dùng bienThe:
  bienThe: [{ ten: "Rải đều", tham: {…} }, { ten: "Gom cụm", tham: {…} }],   // (tuỳ chọn) các kiểu dữ liệu để người học đổi
  soTest: 10, gioiHanMs: 1000,        // mỗi test; JS và C++ dùng chung
  muc: [ { ten: "Bằng greedy theo giá trị", so: "giaTri", heSo: 1 },          // mức 2, 3, … : tổng điểm / điểm tham chiếu ≥ heSo
         { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 } ],            // (bài toán cực tiểu: tham chiếu / điểm bạn ≥ heSo)
  khoiDau: { js: String.raw`…`, cpp: String.raw`…` },    // khung người học sửa (có TODO), KHÔNG được tự đạt mức cao nhất
  loiGiai: { js: String.raw`…`, cpp: String.raw`…` },    // lời giải tham chiếu, ĐƯỢC KIỂM TỰ ĐỘNG, đạt mức cao nhất
  goiY: ["gợi ý 1 (nhẹ)", "gợi ý 2", "gợi ý 3 (gần như lời giải)"] }
```
- Mức 0 = có test không hợp lệ/quá giờ; mức 1 = hợp lệ mọi test; mức 2.. = các `muc` theo thứ tự (phải đạt mức trước mới tính mức sau). `muc` rỗng nghĩa là chỉ có “đúng/sai”.
- **Mỗi lab phải dạy được một ý của bài.** Đề nên có câu hỏi suy ngẫm gắn với bài giảng; `bienThe` dùng để cho người học tự thấy kết luận của bài (ví dụ thứ hạng đảo ngược khi đổi dữ liệu).
- Dùng `String.raw` cho mã; **không** để dấu huyền (`) và `${` trong mã bên trong. Mã JS/C++ nhớ đặt tên biến tiếng Việt không dấu hoặc tiếng Anh theo thói quen của bài.
- **Tất định**: mọi ngẫu nhiên phải theo seed. JS: `rng(seed)` có sẵn. Ngân sách tìm kiếm tính bằng **số vòng lặp**, không bằng đồng hồ, để kết quả không phụ thuộc máy; chỉ dùng `now()` khi bài học chính là về ngân sách thời gian, và khi đó chừa lề an toàn lớn.
- Lời giải tham chiếu phải đạt mức cao nhất với **lề ≥ 1–2 %** so với `heSo` (để chạy trong trình duyệt/máy khác vẫn qua) và chạy ≤ ~300 ms mỗi test trong node.
- Khung JS: script thường (không cần bọc hàm) với `readInput()` (stdin), `print(...)` (stdout, mỗi lần một dòng), `log(...)`/`console.log` (stderr, không bị chấm), `rng(seed)`, `now()`. Khung C++: `#include <bits/stdc++.h>` (có sẵn trên trang) + `scanf/printf` hoặc `cin/cout`.
- **C++ chạy bằng Clang→WebAssembly: không có ngoại lệ (`try/catch/throw` không dùng được), không luồng (`std::thread`), không tệp.** Chuẩn `-std=c++17 -O2`, stack 8 MB. Kiểu `long long`, `vector`, `sort`, `mt19937`, `chrono` đều dùng được. In nhiều dòng: dùng `printf` hoặc `'\n'`, đừng `endl`.
- Với lab giải bài toán tối ưu (nhất là ở Phần 2 trở đi), **cung cấp cả C++** (`khoiDau.cpp` + `loiGiai.cpp`) — khoá học dùng C++. Lab chỉ kiểm tính toán nhỏ thì JS là đủ.

### 5. Các bài toán có sẵn (`vanDe`) — `assets/core/vande.js`

| Tên | Bài toán | stdin | stdout | Tham chiếu (`so`) | `tot` |
|---|---|---|---|---|---|
| `tui` | P0 cái túi 0/1 | `n B` / n dòng `w p` | `k` / k chỉ số (từ 1) | `giaTri`, `tiSo`, `toiUu` (quy hoạch động) | cao |
| `ship1` | P1 ship hàng một ngày, lưới 100×100, kho (50,50), Manhattan, T=480, **không quay về**, vượt giờ = không hợp lệ | `n T` / `50 50` / n dòng `x y p s` | `k` / k chỉ số theo thứ tự ghé | `giaTri`, `ganNhat`, `tiSo`, `tot` (LNS 250 vòng) | cao |
| `tsp` | chu trình ngắn nhất | `n` / n dòng `x y` | n chỉ số (hoán vị) | `ganNhat`, `haiOpt`, `toiUu` (Held–Karp nếu n ≤ 13) | **thấp** |

`tham` của từng bài: `tui` `{n, kieu: "ngau-nhien"|"tuong-quan"|"deu", tyLe}`; `ship1` `{n, T, cum, soCum}`; `tsp` `{n, cum, soCum}`.
Xem `VD.tui.diemToiUu(inst)`, `VD.tui.canTrenPhanSo(inst)`, `VD.tsp.dai(inst, perm)` … trong `vande.js`.

### Tự dựng bài toán nhỏ cho bài của bạn

Không bắt buộc dùng bài toán có sẵn. Khi bài cần một việc **tính toán có một đáp án đúng** (đánh giá delta của 2-opt, tính cận, tính nhiệt độ chấp nhận…), dựng bài toán `tuDapAn` ngay đầu tệp, **trước `TH.dangKy`**. Tên **phải duy nhất toàn khoá — dùng tiền tố mã bài**:

```js
TH.vande.dangKy("b10-delta-2opt", TH.vande.tuDapAn({
  sinh: function (seed, tham) { var r = TH.tienIch.rng(seed); /* … trả về inst … */ },
  viet: function (inst) { return /* chuỗi stdin */; },
  giai: function (inst) { return [/* các số/chuỗi đúng, in cách nhau khoảng trắng; mảng lồng được */]; },
  saiSo: 0,                                              // sai số cho phép với số thực
  dinhDang: { vao: "mô tả stdin (markup)", ra: "mô tả stdout" }
}));
```
Mỗi test chấm đúng/sai (điểm 1/0), thông báo lỗi nói rõ giá trị thứ mấy lệch, mong đợi bao nhiêu. Cần thêm lời giải tham chiếu cho bài toán có sẵn (ví dụ một SA chuẩn cho `tsp`)? `TH.vande.keThua("tsp", "b13-tsp-sa", { thamChieu: { sa: function (inst) { … trả chuỗi stdout … } } })`.

## 6. Kiểm tra (bắt buộc, chạy tới khi xanh)

```bash
cd backend/fastapi/webapp/courses/heuristic-practice-2
node kiem.js --bai=<id1>,<id2> --cpp        # chỉ các bài của bạn; --cpp biên dịch lời giải/khung C++ bằng g++ trên máy
```
Bộ kiểm: lược đồ đúng; mọi lời giải JS tham chiếu **đạt mức cao nhất**; khung khởi đầu **không** tự đạt mức cao nhất; mọi biến thể dữ liệu cho kết quả hợp lệ; mã C++ biên dịch (g++ `-std=c++17 -fno-exceptions`) và qua bộ chấm.
**Không sửa** `assets/core/*`, `data/khoa.js`, `kiem.js`, tệp của bài khác. Cần một bài toán chung mới? Tự dựng trong tệp của bạn (tiền tố mã bài).

## 7. Báo cáo cuối của bạn

Trả về ngắn gọn: các tệp đã viết; số câu hỏi/lab từng bài; kết quả lần chạy `kiem.js` cuối; **mọi chỗ bài giảng/đáp án có vẻ sai hoặc mâu thuẫn** (kèm trích dẫn); mọi lab bạn muốn làm nhưng chưa làm được và vì sao.
