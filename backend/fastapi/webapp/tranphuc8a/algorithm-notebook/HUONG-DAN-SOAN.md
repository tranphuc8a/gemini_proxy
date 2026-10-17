# Hướng dẫn soạn thư viện thuật toán (Algorithm Notebook)

Thư viện dựng sẵn là các tệp `assets/data/lib-*.js`; mỗi tệp gọi `Algo.lib.add([...])` (các mục) và `Algo.lib.scenarios([...])` (câu hỏi cho Quiz).
Người đọc: sinh viên CNTT, người luyện ICPC/Codeforces/AtCoder, kỹ sư phần mềm cần ôn phỏng vấn. Mục tiêu của mỗi mục: **tra trong 5 giây là biết dùng khi nào,
độ phức tạp bao nhiêu, dán template vào bài là chạy được, và tránh được các lỗi thường gặp**. Viết như một chương ngắn, chính xác, của một cuốn handbook CP.

## 1. Việc của bạn
- Chỉ sửa tệp lib của mình, các tệp `kiem-code/<id>.test.cpp` của các id của mình (và đọc mục `dijkstra` trong `assets/data/lib-graph-1.js` làm MẪU CHUẨN).
- Id, tên, nhóm của từng mục đã chốt trong `master-ids.json` — **không đổi, không thêm id mới**. `related` và `answer`/`wrong` của kịch bản chỉ được trỏ tới id có trong đó.
- Ngôn ngữ: tiếng Việt (giữ nguyên thuật ngữ tiếng Anh quen dùng: relax, heap, lazy…), UTF-8. **Ghi tệp bằng công cụ Write/Edit, không dùng heredoc của bash** (heredoc làm mất dấu `\`).
- KHÔNG bịa: độ phức tạp, điều kiện, bài tập phải đúng. Điều gì không chắc thì bỏ, đừng viết.

## 2. Định dạng một mục (tất cả trường bắt buộc, trừ chỗ ghi tuỳ chọn)
```js
{
  id: "dijkstra", name: "Dijkstra",
  aliases: ["..."],         // tên khác / viết tắt / từ khoá tiếng Việt người ta sẽ gõ để tìm (ví dụ "đường đi ngắn nhất một nguồn"). Có thể rỗng [].
  category: "graph",        // theo master-ids.json
  sub: "Đường đi ngắn nhất",// nhóm con để gom trong danh sách (3–6 nhóm con mỗi nhóm lớn)
  level: 2,                 // 1 rất dễ … 5 rất khó (độ khó để HIỂU và CÀI ĐẶT)
  tags: ["graph", "shortest-path"],   // ≥ 2, chữ thường a-z0-9 và - + # .  (tag là thứ người ta search: "shortest-path", "range-query", "greedy", "dp", "string-matching"…)
  summary: "Một câu 20–220 ký tự: nó giải bài toán gì.",
  description: "Markdown 2–4 đoạn: ý tưởng cốt lõi, vì sao đúng, cài đặt thế nào. Dùng **đậm**, `code`, danh sách. Không chép nguyên văn sách/blog.",
  conditions: ["Điều kiện áp dụng (mỗi dòng một ý)"],
  complexity: { time: "O((V+E) log V)", space: "O(V+E)", note: "tuỳ chọn: biến thể / trường hợp đặc biệt" },
  ops: [["tên thao tác", "O(...)"]],     // tuỳ chọn nhưng NÊN có với cấu trúc dữ liệu (Cheat Sheet): vd ["Union", "O(α(N))"], ["Find", "O(α(N))"]
  use_case: ["Khi nào dùng (mỗi dòng một tình huống)"],
  not_for: ["Khi nào KHÔNG dùng → dùng gì thay"],   // tuỳ chọn, rất nên có
  pitfalls: ["Lỗi thường gặp (cụ thể: tràn số, off-by-one, quên reset…)"],
  code: { lang: "cpp", title: "dijkstra.cpp", src: String.raw`...` },
  nocode: true,             // CHỈ khi thật sự không có mẫu code ngắn hợp lý (vd raft); khi đó bỏ trường code
  example: { input: "...", output: "...", explain: "..." },   // ví dụ vào/ra NHỎ, bạn tự tính tay và phải đúng
  problems: [{ site: "cses", id: "1671", name: "Shortest Routes I" }],
  related: ["bellman-ford"],            // id có trong master-ids.json, KHÔNG tự trỏ vào chính nó
  compare: { "Cạnh âm": "Không cho phép" },   // thuộc tính so sánh; chỉ dùng khoá của nhóm (xem §4); ĐIỀN ĐỦ mọi khoá hợp lý
  cards: [{ q: "…?", a: "…" }],         // ≥ 3 flashcard hỏi–đáp ngắn (điều kiện, độ phức tạp, lỗi hay gặp, so sánh với thuật toán gần)
}
```
Không đặt trường `viz` (người điều phối gán sau). Dùng `String.raw` cho code để `\n` trong chuỗi C++ không bị đổi nghĩa; trong code không được có dấu backtick hoặc `${`.

### Mẫu code (`code.src`)
- C++17, **dán là chạy**: bắt đầu bằng `#include <bits/stdc++.h>` và `using namespace std;`, **không có `main()`** (ví dụ chạy thử nằm ở `example`), không phụ thuộc mẫu khác. Dùng 4 dấu cách, không tab.
- Nên gói trong `struct`/hàm có tên riêng (người dùng dán nhiều mẫu vào một tệp): tránh biến toàn cục tên chung chung (`n`, `a`, `adj`, `dist`) — đưa vào struct hoặc tham số. Hằng `INF` toàn cục dạng `const long long INF = (long long)4e18;` thì được.
- Có chú thích tiếng Việt ngắn: đầu vào/đầu ra, quy ước chỉ số (0-based/1-based), độ phức tạp, chỗ dễ sai. Dài vừa phải (thường 20–70 dòng).
- Phải **đúng với dữ liệu lớn** (long long khi cần, đệ quy sâu thì cảnh báo hoặc dùng vòng lặp).
- Với mục `sys` / `opt` (heuristic, hệ thống): mẫu là một cài đặt tối giản nhưng chạy được (vd LRU bằng list+unordered_map; SA tối ưu một hàm mẫu). Chỉ dùng `nocode: true` với `raft`, `two-phase-commit`, `lsm-tree`, `b-plus-tree` nếu cài đặt thật quá dài — khi đó `description` phải mô tả rõ cấu trúc/giao thức và có sơ đồ chữ.

### Kiểm thử mẫu code (BẮT BUỘC với mọi mục có `code`)
Tạo `kiem-code/<id>.test.cpp`: một dòng đúng nguyên văn `// @TEMPLATE` (script thay bằng mẫu code), rồi `int main()` thử **thật**: dữ liệu ngẫu nhiên (`mt19937` hạt giống cố định) so với cách vét cạnh / công thức / thư viện khác, gồm ca biên (rỗng, một phần tử, không tồn tại đáp án, trùng lặp, giá trị lớn gây tràn). Thành công in đúng dòng `OK` rồi `return 0`; sai thì in lý do và `return 1`. Một lần chạy ≤ 10 giây. Xem `kiem-code/dijkstra.test.cpp`. Heuristic ngẫu nhiên (SA, GA…) thử bằng tính chất có thể kiểm (kết quả hợp lệ, không tệ hơn nghiệm ban đầu, đạt tối ưu trên bài nhỏ với hạt giống cố định).

## 3. Kịch bản Quiz (`Algo.lib.scenarios([...])`, đặt cuối tệp)
Mỗi mục ≥ 1 kịch bản (trung bình ~1,5): một bài toán được tả bằng lời + ràng buộc, người học chọn thuật toán/cấu trúc phù hợp.
```js
{ id: "q-fenwick-tree-1", prompt: "N = 100000. Cần làm hai việc: cập nhật giá trị một phần tử và hỏi tổng tiền tố. Q = 100000 thao tác.",
  answer: ["fenwick-tree"],        // đáp án đúng chính (≥ 1 id); có thể thêm also: ["segment-tree"] = cũng chấp nhận được nhưng không tối ưu
  also: [], wrong: ["array-prefix-sum", "sparse-table", "sqrt-decomposition"],   // ≥ 3 phương án sai NHƯNG dễ nhầm (cùng nhóm hoặc gần ý)
  why: "Giải thích vì sao đúng, vì sao từng phương án sai không hợp (≥ 30 ký tự).", level: 2 }
```
Prompt phải đủ dữ kiện để chọn được (kích thước N, loại thao tác, có online/offline, có cạnh âm không…), không gợi tên đáp án.

## 4. Khoá `compare` theo nhóm (dùng đúng chính tả; giá trị là chuỗi ngắn)
- ds: Truy vấn · Cập nhật điểm · Cập nhật đoạn · Bộ nhớ · Hỗ trợ thêm
- graph: Bài toán giải · Cạnh âm · Hợp với đồ thị · Kết quả cho ra
- string: Bài toán giải · Xây dựng · Truy vấn · Bộ nhớ
- dp: Dạng trạng thái · Số trạng thái · Chuyển trạng thái · Bộ nhớ
- math: Bài toán giải · Ràng buộc · Độ chính xác
- tech: Dùng khi · Điều kiện · Cần dữ liệu đã sắp xếp
- geo: Bài toán giải · Độ chính xác · Ràng buộc
- opt: Loại · Bảo đảm tối ưu · Tham số cần chỉnh · Bộ nhớ
- sys: Mục đích · Đánh đổi · Dùng trong
Bảng so sánh sẽ đặt các mục cạnh nhau theo những khoá này, nên giá trị phải so được với nhau (cùng thang: "Có/Không/Khó/Dễ", "O(log N)", "ít/nhiều"…).

## 5. Bài tập liên quan (`problems`)
- CSES: **chỉ** dùng id có trong `tasks/2610/261017/algorithm-notebook/cses-tasks.txt` với **tên đúng nguyên văn** (script kiểm). Chọn 2–5 bài thật sự cần đúng thuật toán đó.
- Codeforces: chỉ khi bạn **chắc chắn** về id và tên (dạng `20C`, `1000A1`); không chắc thì không ghi. AtCoder/VNOI/LeetCode/SPOJ: chỉ ghi tên bài bạn chắc chắn tồn tại (`site: "lc"|"atcoder"|"vnoi"|"spoj"|"other"`, không có link). Mảng rỗng `[]` là chấp nhận được (ví dụ nhóm `sys`).

## 6. Chạy kiểm trước khi báo xong
```
cd backend/fastapi/webapp/tranphuc8a/algorithm-notebook
node kiem-lib.js --partial <lib-của-bạn>.js                         # dữ liệu hợp lệ? (lặp tới khi "Dữ liệu hợp lệ.")
../../../.venv/Scripts/python.exe kiem-code.py --lo <lib-của-bạn>.js   # mọi mẫu code biên dịch + chạy thử OK (g++ 17, -Wall)
```
Đặt `PYTHONUTF8=1`. Sửa tới khi cả hai sạch. Cảnh báo `-Wall` nên sửa (biến không dùng, so sánh signed/unsigned).

## 7. Báo cáo cuối (ngắn, không dán code)
Số mục + số kịch bản đã viết, kết quả hai lệnh kiểm, và **mọi chỗ bạn không chắc** (thông tin chưa kiểm được, mục phải bỏ code, id bài tập bỏ vì không xác minh được).
