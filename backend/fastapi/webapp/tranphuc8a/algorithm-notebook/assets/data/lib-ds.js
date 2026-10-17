/* lib-ds.js — cấu trúc dữ liệu: dãy & truy vấn tĩnh, ngăn xếp / hàng đợi / heap, DSU, cây truy vấn đoạn, cây nhị phân tìm kiếm cân bằng.
   Định dạng theo HUONG-DAN-SOAN.md; mẫu code đều dùng đoạn nửa mở [l, r) và chỉ số 0-based (trừ khi ghi khác). */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    /* ============================== Dãy & truy vấn tĩnh ============================== */
    {
      id: "array-prefix-sum",
      name: "Mảng & Prefix Sum",
      aliases: ["prefix sum", "prefix sums", "tổng tiền tố", "mảng cộng dồn", "cumulative sum", "partial sums", "tổng đoạn con", "tổng hình chữ nhật", "prefix sum 2d", "range sum static"],
      category: "ds",
      sub: "Dãy & truy vấn tĩnh",
      level: 1,
      tags: ["array", "prefix-sum", "range-query", "static", "offline"],
      summary: "Tiền xử lý O(N) để trả lời tổng của bất kỳ đoạn con (hoặc hình chữ nhật con) nào trong O(1) khi mảng không thay đổi.",
      description:
        "Gọi `pre[i]` là tổng `i` phần tử đầu (`pre[0] = 0`). Khi đó tổng đoạn `[l, r)` bằng `pre[r] - pre[l]`: một phép trừ thay cho một vòng lặp. Chỉ cần một mảng phụ và một lần quét O(N).\n\n" +
        "Ý tưởng áp dụng được cho mọi phép toán **có nghịch đảo**: tổng, xor (vì `x ^ x = 0`), tổng theo modulo, số lần xuất hiện của một giá trị (mỗi giá trị một mảng đếm). Với lưới hai chiều dùng nguyên lý bao hàm – loại trừ: `S(r2,c2) - S(r1,c2) - S(r2,c1) + S(r1,c1)`.\n\n" +
        "Prefix sum còn là bước đệm của nhiều kỹ thuật: hai prefix bằng nhau nghĩa là đoạn giữa có tổng 0 (kết hợp bảng băm để đếm đoạn có tổng cho trước), hai prefix cùng số dư khi chia cho K nghĩa là đoạn giữa chia hết cho K, và nó là phép nghịch đảo của mảng hiệu.",
      conditions: ["Mảng không thay đổi giữa các truy vấn (tĩnh / offline); có cập nhật xen kẽ thì dùng Fenwick Tree", "Phép gộp phải có nghịch đảo (cộng–trừ, xor); min / max / gcd không dùng được → Sparse Table"],
      complexity: { time: "O(N + Q)", space: "O(N)", note: "Xây O(N), mỗi truy vấn O(1). Lưới N×M: xây O(NM), truy vấn O(1), bộ nhớ O(NM)." },
      ops: [["Xây dựng", "O(N)"], ["Tổng đoạn", "O(1)"], ["Cập nhật một phần tử", "O(N) (xây lại)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Nhiều truy vấn tổng / xor đoạn trên mảng cố định", "Đếm số đoạn con có tổng bằng K hoặc chia hết cho K (prefix + bảng băm / mảng đếm số dư)", "Tổng hình chữ nhật con trên lưới (prefix sum 2D)", "Đếm số lần xuất hiện của một giá trị trong đoạn bằng một mảng prefix cho mỗi giá trị"],
      not_for: ["Có cập nhật xen kẽ truy vấn → Fenwick Tree hoặc Segment Tree", "Truy vấn min / max / gcd trên đoạn → Sparse Table (tĩnh) hoặc Segment Tree (động)", "Chỉ có các cập nhật cộng đoạn rồi đọc kết quả cuối cùng → Mảng hiệu"],
      pitfalls: [
        "Tràn int: tổng nhiều phần tử cỡ 10⁹ vượt 2³¹ — dùng long long cho mảng pre.",
        "Lệch chỉ số: nếu mảng 1-based thì tổng [l..r] là pre[r] - pre[l-1]; mẫu này dùng 0-based với đoạn nửa mở [l, r), tức pre[r] - pre[l].",
        "Quên rằng pre có N+1 phần tử (pre[0] = 0) nên truy cập pre[-1] hoặc ghi ngoài mảng.",
        "Prefix theo modulo: số dư có thể âm, phải chuẩn hoá ((x % K) + K) % K trước khi so sánh hay đếm.",
        "Prefix sum 2D: quên cộng lại góc pre[r1][c1] (bị trừ hai lần)."
      ],
      code: {
        lang: "cpp", title: "prefix_sum.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Prefix sum 1 chiều. Mảng 0-based; pre[i] = a[0] + ... + a[i-1], pre[0] = 0.
// sum(l, r) = tổng a[l..r-1] (đoạn nửa mở [l, r)), O(1). Dùng long long để khỏi tràn.
struct PrefixSum {
    vector<long long> pre;
    PrefixSum() {}
    explicit PrefixSum(const vector<long long>& a) : pre(a.size() + 1, 0) {
        for (size_t i = 0; i < a.size(); i++) pre[i + 1] = pre[i] + a[i];
    }
    long long sum(int l, int r) const { return pre[r] - pre[l]; }
};

// Prefix sum 2 chiều trên lưới g (n hàng, m cột, 0-based).
// sum(r1, c1, r2, c2) = tổng các ô có hàng thuộc [r1, r2) và cột thuộc [c1, c2), O(1).
struct PrefixSum2D {
    vector<vector<long long>> pre;
    explicit PrefixSum2D(const vector<vector<long long>>& g) {
        int n = g.size(), m = n ? g[0].size() : 0;
        pre.assign(n + 1, vector<long long>(m + 1, 0));
        for (int i = 0; i < n; i++)
            for (int j = 0; j < m; j++)
                pre[i + 1][j + 1] = g[i][j] + pre[i][j + 1] + pre[i + 1][j] - pre[i][j];
    }
    long long sum(int r1, int c1, int r2, int c2) const {
        return pre[r2][c2] - pre[r1][c2] - pre[r2][c1] + pre[r1][c1];
    }
};
`
      },
      example: {
        input: "6 3\n2 -1 4 3 0 5\n1 3\n2 6\n4 4",
        output: "5\n11\n3",
        explain: "Mảng 6 phần tử, 3 truy vấn tổng đoạn [l, r] (1-based, gồm cả hai đầu). pre = 0 2 1 5 8 8 13. Đoạn [1,3]: 2-1+4 = 5 = pre[3]-pre[0]. Đoạn [2,6]: pre[6]-pre[1] = 13-2 = 11. Đoạn [4,4]: pre[4]-pre[3] = 8-5 = 3."
      },
      problems: [
        { site: "cses", id: "1646", name: "Static Range Sum Queries" },
        { site: "cses", id: "1650", name: "Range Xor Queries" },
        { site: "cses", id: "1652", name: "Forest Queries" },
        { site: "cses", id: "1661", name: "Subarray Sums II" },
        { site: "cses", id: "1662", name: "Subarray Divisibility" }
      ],
      related: ["difference-array", "fenwick-tree", "sparse-table", "two-pointers", "kadane"],
      compare: { "Truy vấn": "O(1) (tổng / xor đoạn)", "Cập nhật điểm": "O(N) (xây lại)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Mở rộng 2D; nền tảng của mảng hiệu và đếm đoạn con bằng bảng băm" },
      cards: [
        { q: "Prefix sum trả lời tổng đoạn [l, r) trong bao lâu và cần xây bao lâu?", a: "Xây O(N), mỗi truy vấn O(1): sum(l, r) = pre[r] - pre[l]." },
        { q: "Khi nào KHÔNG dùng prefix sum?", a: "Khi mảng bị cập nhật xen kẽ truy vấn (dùng Fenwick / Segment Tree) hoặc phép toán không có nghịch đảo như min, max, gcd (dùng Sparse Table / Segment Tree)." },
        { q: "Làm sao đếm số đoạn con có tổng chia hết cho K bằng prefix sum?", a: "Hai prefix có cùng số dư mod K thì đoạn giữa chia hết cho K. Đếm số prefix theo từng số dư (chuẩn hoá số dư âm) rồi cộng C(cnt, 2) cho mỗi số dư." },
        { q: "Công thức tổng hình chữ nhật bằng prefix sum 2D?", a: "S(r2,c2) - S(r1,c2) - S(r2,c1) + S(r1,c1) với đoạn nửa mở theo hàng và cột (bao hàm – loại trừ)." }
      ]
    },

    {
      id: "difference-array",
      name: "Mảng hiệu (Difference Array)",
      aliases: ["difference array", "mảng hiệu", "mảng chênh lệch", "cộng đoạn", "range update offline", "diff array", "imos method", "cộng đoạn O(1)"],
      category: "ds",
      sub: "Dãy & truy vấn tĩnh",
      level: 1,
      tags: ["array", "difference-array", "range-update", "offline", "sweep"],
      summary: "Cộng một giá trị vào cả đoạn [l, r) trong O(1) bằng cách ghi nhận ở hai đầu, rồi khôi phục mảng bằng một lần cộng dồn O(N).",
      description:
        "Mảng hiệu `d` lưu chênh lệch giữa hai phần tử liền kề: `d[i] = a[i] - a[i-1]`. Cộng `v` vào mọi `a[i]` với `i` thuộc `[l, r)` chỉ làm đổi hai giá trị: `d[l] += v` và `d[r] -= v`. Khi đã làm xong **mọi** cập nhật, cộng dồn `d` (prefix sum) để được mảng cuối cùng.\n\n" +
        "Đây là phép nghịch đảo của prefix sum: prefix sum biến “cập nhật điểm” thành “tổng đoạn”, mảng hiệu biến “cập nhật đoạn” thành “cập nhật điểm”. Kỹ thuật mở rộng sang 2D (bốn góc: `+v, -v, -v, +v`) và sang nhiều tầng (mảng hiệu của mảng hiệu cho cộng cấp số cộng).\n\n" +
        "Nếu toạ độ rất lớn nhưng số sự kiện ít, ghi các cặp (vị trí, ±v) rồi sắp xếp: quét một lượt là ra độ phủ tại từng điểm (kỹ thuật sweep / “imos”). Khi truy vấn xen kẽ giữa các cập nhật thì mảng hiệu không còn đủ — dùng Fenwick Tree hoặc Segment Tree.",
      conditions: ["Chỉ cần đọc kết quả SAU khi hết các cập nhật (offline), hoặc chỉ đọc một lần ở cuối", "Cập nhật có dạng cộng (hoặc xor) cùng một hằng số lên cả đoạn"],
      complexity: { time: "O(N + M)", space: "O(N)", note: "M cập nhật đoạn mỗi cái O(1), một lần dựng O(N). Lưới N×M: mỗi cập nhật O(1), dựng O(NM)." },
      ops: [["Cộng đoạn", "O(1)"], ["Dựng lại mảng", "O(N)"], ["Đọc một phần tử giữa chừng", "O(N) (cần dựng lại)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Nhiều lệnh “cộng v vào đoạn [l, r]” rồi in mảng cuối", "Đếm độ phủ: mỗi điểm bị bao bởi bao nhiêu đoạn / khoảng thời gian", "Tìm thời điểm đông khách nhất từ danh sách (đến, đi) — sắp xếp sự kiện", "Cộng hình chữ nhật trên lưới (mảng hiệu 2D) rồi đọc toàn bộ lưới"],
      not_for: ["Truy vấn giá trị / tổng xen kẽ với cập nhật (online) → Fenwick Tree hoặc Segment Tree lười", "Cập nhật không phải cộng (gán, nhân) → Segment Tree lười", "Mảng cố định, chỉ có truy vấn → Prefix Sum"],
      pitfalls: [
        "Quên chừa ô d[n] khi r = n (đoạn nửa mở) hoặc d[n+1] khi đoạn đóng [l, r]: ghi ngoài mảng.",
        "Lẫn đoạn đóng và nửa mở: với đoạn đóng [l, r] phải trừ ở r+1, với nửa mở [l, r) trừ ở r.",
        "Tràn int khi cộng nhiều lần: dùng long long cho d và kết quả.",
        "Đọc a[i] giữa chừng mà chưa gọi dựng lại (build) — d[i] chưa phải a[i].",
        "Mảng hiệu 2D: bốn góc phải đúng dấu (+v, -v, -v, +v) và có thêm hàng, cột thừa phía cuối."
      ],
      code: {
        lang: "cpp", title: "difference_array.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Mảng hiệu 1 chiều: add(l, r, v) cộng v vào a[l..r-1] (0 <= l <= r <= n) trong O(1).
// Sau khi xong mọi cập nhật gọi build() một lần (O(N)) để lấy mảng a. d[i] = a[i] - a[i-1].
struct DiffArray {
    int n;
    vector<long long> d;                      // có n+1 ô để r = n không ghi ngoài mảng
    explicit DiffArray(int n) : n(n), d(n + 1, 0) {}
    explicit DiffArray(const vector<long long>& a) : n(a.size()), d(a.size() + 1, 0) {
        for (int i = 0; i < n; i++) d[i] = a[i] - (i ? a[i - 1] : 0);
    }
    void add(int l, int r, long long v) { d[l] += v; d[r] -= v; }
    vector<long long> build() const {
        vector<long long> a(n);
        long long cur = 0;
        for (int i = 0; i < n; i++) { cur += d[i]; a[i] = cur; }
        return a;
    }
};

// Mảng hiệu 2 chiều: add(r1, c1, r2, c2, v) cộng v vào hàng [r1, r2), cột [c1, c2) trong O(1); build() trả lưới n x m.
struct DiffArray2D {
    int n, m;
    vector<vector<long long>> d;
    DiffArray2D(int n, int m) : n(n), m(m), d(n + 1, vector<long long>(m + 1, 0)) {}
    void add(int r1, int c1, int r2, int c2, long long v) {
        d[r1][c1] += v; d[r1][c2] -= v; d[r2][c1] -= v; d[r2][c2] += v;
    }
    vector<vector<long long>> build() const {
        vector<vector<long long>> a(n, vector<long long>(m, 0));
        for (int i = 0; i < n; i++)
            for (int j = 0; j < m; j++)
                a[i][j] = d[i][j] + (i ? a[i - 1][j] : 0) + (j ? a[i][j - 1] : 0) - (i && j ? a[i - 1][j - 1] : 0);
        return a;
    }
};
`
      },
      example: {
        input: "5 3\n1 3 2\n2 5 3\n3 4 -1",
        output: "2 5 4 2 3",
        explain: "Mảng 5 phần tử ban đầu toàn 0, ba lệnh “cộng v vào đoạn [l, r]” (1-based, đóng): +2 vào [1,3], +3 vào [2,5], -1 vào [3,4]. Mảng hiệu cuối cùng d = 2 3 -1 -2 1; cộng dồn được 2 5 4 2 3. Kiểm tra vị trí 3: 2+3-1 = 4."
      },
      problems: [
        { site: "cses", id: "1619", name: "Restaurant Customers" },
        { site: "cf", id: "295A", name: "Greg and Array" },
        { site: "cf", id: "816B", name: "Karen and Coffee" },
        { site: "lc", name: "Corporate Flight Bookings" }
      ],
      related: ["array-prefix-sum", "fenwick-tree", "lazy-segment-tree", "coordinate-compression", "greedy-interval-scheduling"],
      compare: { "Truy vấn": "O(N) đọc cả mảng sau khi dựng (không truy vấn xen kẽ)", "Cập nhật điểm": "O(1)", "Cập nhật đoạn": "O(1)", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Mở rộng 2D; là nghịch đảo của prefix sum; sweep độ phủ" },
      cards: [
        { q: "Cộng v vào đoạn [l, r) bằng mảng hiệu thì làm gì?", a: "d[l] += v và d[r] -= v (O(1)); khi xong mọi cập nhật, cộng dồn d để được mảng thật." },
        { q: "Vì sao mảng hiệu không dùng được khi vừa cập nhật vừa truy vấn xen kẽ?", a: "Để đọc một phần tử phải cộng dồn d, tốn O(N) mỗi lần. Khi đó dùng Fenwick Tree (cập nhật đoạn, truy vấn điểm) hoặc Segment Tree lười." },
        { q: "Mảng hiệu và prefix sum liên hệ thế nào?", a: "Là hai phép nghịch đảo của nhau: cộng dồn mảng hiệu cho ra mảng gốc, hiệu liên tiếp của prefix sum cho ra mảng gốc." },
        { q: "Mảng hiệu 2D cập nhật hình chữ nhật thế nào?", a: "Bốn góc: d[r1][c1] += v, d[r1][c2] -= v, d[r2][c1] -= v, d[r2][c2] += v (đoạn nửa mở), rồi prefix sum 2D để dựng lại." }
      ]
    },

    {
      id: "sparse-table",
      name: "Sparse Table",
      aliases: ["sparse table", "bảng thưa", "rmq", "range minimum query", "range maximum query", "rmq tĩnh", "min đoạn tĩnh", "truy vấn min o(1)", "bảng nhảy"],
      category: "ds",
      sub: "Dãy & truy vấn tĩnh",
      level: 2,
      tags: ["sparse-table", "rmq", "range-query", "static", "idempotent"],
      summary: "Bảng nhảy luỹ thừa hai cho phép tính min / max / gcd của một đoạn bất kỳ trong O(1) trên mảng không thay đổi, dựng O(N log N).",
      description:
        "Gọi `t[k][i]` là kết quả gộp của đoạn độ dài `2^k` bắt đầu tại `i`. Dựng theo `k` tăng dần: `t[k][i] = op(t[k-1][i], t[k-1][i + 2^(k-1)])`, tổng O(N log N). Truy vấn đoạn `[l, r)` độ dài `len`: lấy `k = ⌊log2 len⌋`, rồi gộp **hai** đoạn độ dài `2^k` phủ kín `[l, r)` — một bắt đầu tại `l`, một kết thúc tại `r`. Hai đoạn **chồng lên nhau**, nên phép gộp phải **luỹ đẳng**: `op(x, x) = x`.\n\n" +
        "Luỹ đẳng gồm min, max, gcd, and, or. **Tổng, xor, tích thì không** vì phần chồng bị tính hai lần — dùng Prefix Sum, hoặc Sparse Table rời rạc (disjoint sparse table) nếu cần O(1) cho phép bất kỳ có tính kết hợp (bộ nhớ vẫn O(N log N)).\n\n" +
        "Sparse Table tốt nhất khi mảng tĩnh và rất nhiều truy vấn (cỡ 10⁶–10⁷): truy vấn O(1) với hằng số rất nhỏ. Muốn biết **vị trí** của min thì lưu cặp `(giá trị, chỉ số)`. Nó cũng là cách phổ biến để tính LCA trong O(1) qua Euler tour + RMQ.",
      conditions: ["Mảng không đổi sau khi dựng (tĩnh)", "Phép gộp luỹ đẳng: op(x, x) = x (min, max, gcd, and, or)"],
      complexity: { time: "O(N log N) xây, O(1) truy vấn", space: "O(N log N)", note: "Bộ nhớ nhân với kích thước kiểu: N = 10⁶ với long long khoảng 160 MB, với int khoảng 80 MB." },
      ops: [["Dựng", "O(N log N)"], ["Truy vấn đoạn", "O(1)"], ["Cập nhật", "O(N log N) (dựng lại)"], ["Bộ nhớ", "O(N log N)"]],
      use_case: ["Rất nhiều truy vấn min / max đoạn trên mảng tĩnh", "gcd / and / or của đoạn trên mảng tĩnh", "RMQ trong LCA bằng Euler tour; tính LCP của hai hậu tố bất kỳ từ mảng LCP của Suffix Array", "Chia để trị trên đáp án khi cần min của đoạn nhiều lần"],
      not_for: ["Có cập nhật xen kẽ → Segment Tree hoặc Fenwick", "Tổng / xor / tích đoạn → Prefix Sum (hoặc disjoint sparse table)", "Bộ nhớ chặt với N rất lớn → Segment Tree (O(N) bộ nhớ)"],
      pitfalls: [
        "Dùng cho phép không luỹ đẳng (tổng, xor, đếm): hai đoạn chồng nhau làm phần giữa bị tính hai lần, kết quả sai.",
        "Truy vấn đoạn rỗng (l == r): log của 0 không xác định (__builtin_clz(0)); chỉ gọi khi l < r.",
        "Bộ nhớ N·log N phần tử: N = 10⁶ với long long là cỡ 160 MB — dùng kiểu hẹp hơn (int) hoặc đổi sang Segment Tree.",
        "Lẫn đoạn đóng [l, r] và nửa mở [l, r): mẫu này nửa mở, độ dài đoạn là r − l.",
        "Cần chỉ số của min mà chỉ lưu giá trị: lưu cặp (giá trị, chỉ số) để lấy được cả hai."
      ],
      code: {
        lang: "cpp", title: "sparse_table.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Sparse Table cho phép gộp LUỸ ĐẲNG (op(x, x) = x): min, max, gcd, and, or. Mảng tĩnh.
// Dựng O(N log N); query(l, r) trên đoạn nửa mở [l, r) (0 <= l < r <= n, đoạn không rỗng) trong O(1).
//   SparseTable st(a, [](long long x, long long y) { return min(x, y); });     // a là vector<long long>
//   SparseTable st(a, [](int x, int y) { return __gcd(x, y); });               // a là vector<int>
template <class T, class Op>
struct SparseTable {
    vector<vector<T>> t;                         // t[k][i] = gộp a[i .. i + 2^k - 1]
    Op op;
    SparseTable(const vector<T>& a, Op op) : op(op) {
        int n = a.size();
        t.push_back(a);
        for (int k = 1; (1 << k) <= n; k++) {
            t.emplace_back(n - (1 << k) + 1);
            for (int i = 0; i + (1 << k) <= n; i++)
                t[k][i] = op(t[k - 1][i], t[k - 1][i + (1 << (k - 1))]);
        }
    }
    T query(int l, int r) const {
        int k = 31 - __builtin_clz(r - l);       // 2^k <= r - l < 2^(k+1)
        return op(t[k][l], t[k][r - (1 << k)]);  // hai đoạn độ dài 2^k phủ [l, r), được phép chồng nhau
    }
};
`
      },
      example: {
        input: "9\n7 2 3 0 5 10 3 12 18\n0 4\n4 9\n1 3",
        output: "0\n3\n2",
        explain: "Mảng 9 phần tử, truy vấn min trên đoạn nửa mở [l, r). [0,4) gồm 7 2 3 0 → 0. [4,9) gồm 5 10 3 12 18 → 3. [1,3) gồm 2 3 → 2. Đoạn [4,9) dài 5 nên k = 2: gộp [4,8) và [5,9) chồng nhau, min vẫn đúng vì min luỹ đẳng."
      },
      problems: [
        { site: "cses", id: "1647", name: "Static Range Minimum Queries" },
        { site: "spoj", name: "Range Minimum Query" }
      ],
      related: ["segment-tree", "array-prefix-sum", "fenwick-tree", "monotonic-stack", "lca", "sqrt-decomposition"],
      compare: { "Truy vấn": "O(1) (phép luỹ đẳng: min, max, gcd)", "Cập nhật điểm": "Không hỗ trợ (dựng lại O(N log N))", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N log N)", "Hỗ trợ thêm": "Đoạn không rỗng; RMQ cho LCA qua Euler tour; lưu (giá trị, chỉ số) để lấy vị trí" },
      cards: [
        { q: "Sparse Table dựng và truy vấn trong bao lâu?", a: "Dựng O(N log N), mỗi truy vấn O(1); bộ nhớ O(N log N)." },
        { q: "Vì sao Sparse Table chỉ dùng được cho phép luỹ đẳng?", a: "Truy vấn gộp hai đoạn 2^k chồng nhau; chỉ khi op(x, x) = x thì phần chồng không làm sai (min, max, gcd, and, or). Tổng và xor thì sai." },
        { q: "Truy vấn Sparse Table trên [l, r) tính thế nào?", a: "k = ⌊log2(r − l)⌋; kết quả = op(t[k][l], t[k][r − 2^k])." },
        { q: "Khi nào chọn Segment Tree thay Sparse Table?", a: "Khi mảng có cập nhật, hoặc khi bộ nhớ O(N log N) quá nặng." }
      ]
    },

    /* ============================== Ngăn xếp, hàng đợi & heap ============================== */
    {
      id: "stack",
      name: "Ngăn xếp (Stack)",
      aliases: ["stack", "ngăn xếp", "LIFO", "ngoặc hợp lệ", "balanced brackets", "biểu thức hậu tố", "tính biểu thức", "shunting yard", "undo"],
      category: "ds",
      sub: "Ngăn xếp, hàng đợi & heap",
      level: 1,
      tags: ["stack", "lifo", "parsing", "expression", "data-structure"],
      summary: "Cấu trúc vào sau ra trước (LIFO): thêm và lấy ở một đầu trong O(1), nền tảng cho ngoặc hợp lệ, tính biểu thức, DFS không đệ quy, hoàn tác.",
      description:
        "Ngăn xếp chỉ cho phép thao tác ở **đỉnh**: `push` thêm vào, `pop` bỏ ra, `top` xem phần tử trên cùng, tất cả O(1). Mọi bài toán “việc xảy ra sau phải xong trước” (ngoặc lồng nhau, lời gọi hàm, hoàn tác) đều hợp với stack.\n\n" +
        "Hai mẫu kinh điển: (1) **kiểm tra dãy ngoặc** — ngoặc mở thì đẩy vào, ngoặc đóng phải khớp với đỉnh; (2) **tính biểu thức** — dùng hai stack (số và toán tử), toán tử ở đỉnh có độ ưu tiên cao hơn hoặc bằng thì được tính trước; dấu ngoặc đóng làm các toán tử bên trong được tính hết. Thuật toán shunting-yard chuyển trung tố sang hậu tố cũng dựa trên cùng ý tưởng.\n\n" +
        "Trong C++ dùng `std::stack`, hoặc tốt hơn thường là `vector` / `string` với `push_back`, `back`, `pop_back` (nhanh hơn, duyệt và xoá hết được). Stack thay đệ quy khi độ sâu có thể lên tới hàng trăm nghìn (DFS trên cây dạng đường thẳng) và là cơ sở của stack đơn điệu.",
      conditions: ["Quan hệ lồng nhau / vào sau ra trước: phần tử thêm sau cùng phải được xử lý trước", "Chỉ cần truy cập đỉnh; cần duyệt hay xoá giữa chừng thì dùng vector hoặc list"],
      complexity: { time: "O(1) mỗi thao tác", space: "O(N)", note: "Kiểm tra ngoặc và tính biểu thức độ dài L: O(L) thời gian, O(L) bộ nhớ." },
      ops: [["push", "O(1)"], ["pop", "O(1)"], ["top", "O(1)"], ["Duyệt / xoá giữa chừng", "O(N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Kiểm tra dãy ngoặc () [] {} hợp lệ, tìm đoạn ngoặc đúng dài nhất", "Tính giá trị biểu thức số học có ngoặc, độ ưu tiên và dấu trừ đơn ngôi", "DFS không đệ quy (tránh tràn stack hệ thống) và duyệt cây theo thứ tự", "Hoàn tác (undo) các thao tác, hoặc lưu trạng thái để quay lui"],
      not_for: ["Cần xử lý theo thứ tự đến trước, ra trước (FIFO) → Hàng đợi", "Cần luôn lấy phần tử lớn nhất / nhỏ nhất → Heap", "Tìm phần tử lớn hơn / nhỏ hơn gần nhất cho mọi vị trí → Monotonic Stack"],
      pitfalls: [
        "top() / pop() trên stack rỗng là hành vi không xác định — luôn kiểm tra empty() trước.",
        "Dãy ngoặc: quên kiểm tra stack rỗng khi gặp ngoặc đóng, hoặc quên kiểm tra stack phải rỗng ở cuối (còn ngoặc mở chưa đóng).",
        "Tính biểu thức: dấu trừ đơn ngôi (-3, 2*-3) phải phân biệt với trừ hai ngôi; thứ tự lấy hai toán hạng khi trừ và chia là (a, b) = (sâu, đỉnh) chứ không đảo.",
        "Chia nguyên của C++ cắt về 0 (-7 / 2 = -3); chia cho 0 phải chặn trước.",
        "Độ sâu đệ quy lớn làm tràn stack hệ thống — chuyển sang stack tự quản bằng vector."
      ],
      code: {
        lang: "cpp", title: "stack_expression.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// (1) Kiểm tra dãy ngoặc () [] {} hợp lệ (các ký tự khác bị bỏ qua). O(L).
// Gặp ngoặc mở thì push; gặp ngoặc đóng thì đỉnh phải là ngoặc mở cùng loại.
bool balancedBrackets(const string& s) {
    string st;                                   // dùng string làm stack ký tự
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') {
            st.push_back(c);
        } else if (c == ')' || c == ']' || c == '}') {
            if (st.empty()) return false;
            char o = st.back();
            if ((c == ')' && o != '(') || (c == ']' && o != '[') || (c == '}' && o != '{')) return false;
            st.pop_back();
        }
    }
    return st.empty();
}

// (2) Tính biểu thức trung tố: số nguyên không dấu, + - * / ( ), dấu - đơn ngôi, khoảng trắng tuỳ ý. O(L).
// Hai stack: nums (số) và ops (toán tử). Toán tử ở đỉnh có ưu tiên >= toán tử mới thì tính trước (kết hợp trái).
// 'n' đại diện dấu trừ đơn ngôi. '/' là chia nguyên cắt về 0 như C++. Giả định biểu thức hợp lệ, không chia cho 0.
long long evalExpr(const string& s) {
    vector<long long> nums;
    vector<char> ops;
    auto prec = [](char c) { return (c == '*' || c == '/') ? 2 : (c == '+' || c == '-') ? 1 : 0; };
    auto applyTop = [&]() {
        char op = ops.back();
        ops.pop_back();
        if (op == 'n') { nums.back() = -nums.back(); return; }
        long long b = nums.back();
        nums.pop_back();
        long long a = nums.back();
        nums.back() = op == '+' ? a + b : op == '-' ? a - b : op == '*' ? a * b : a / b;
    };
    bool expectOperand = true;                   // true: vị trí kế tiếp phải là số, '(' hoặc dấu trừ đơn ngôi
    for (size_t i = 0; i < s.size(); i++) {
        char c = s[i];
        if (c == ' ') continue;
        if (isdigit((unsigned char)c)) {
            long long v = 0;
            while (i < s.size() && isdigit((unsigned char)s[i])) v = v * 10 + (s[i++] - '0');
            i--;
            nums.push_back(v);
            expectOperand = false;
        } else if (c == '(') {
            ops.push_back(c);
            expectOperand = true;
        } else if (c == ')') {
            while (ops.back() != '(') applyTop();
            ops.pop_back();
            expectOperand = false;
        } else if (c == '-' && expectOperand) {
            ops.push_back('n');                  // đơn ngôi: ưu tiên cao nhất, chưa cần tính gì trước
        } else {
            while (!ops.empty() && ops.back() != '(' && (ops.back() == 'n' || prec(ops.back()) >= prec(c))) applyTop();
            ops.push_back(c);
            expectOperand = true;
        }
    }
    while (!ops.empty()) applyTop();
    return nums.back();
}
`
      },
      example: {
        input: "[({})]\n([)]\n2+3*(4-1)",
        output: "true\nfalse\n11",
        explain: "Ba lần gọi: balancedBrackets(\"[({})]\") = true vì mọi ngoặc khớp từ trong ra ngoài; balancedBrackets(\"([)]\") = false vì khi gặp ')' đỉnh stack là '['; evalExpr(\"2+3*(4-1)\") = 2 + 3*3 = 11."
      },
      problems: [
        { site: "cf", id: "5C", name: "Longest Regular Bracket Sequence" },
        { site: "lc", name: "Valid Parentheses" },
        { site: "lc", name: "Basic Calculator" },
        { site: "lc", name: "Evaluate Reverse Polish Notation" }
      ],
      related: ["queue", "monotonic-stack", "dfs", "heap"],
      compare: { "Truy vấn": "Chỉ đỉnh, O(1)", "Cập nhật điểm": "Không hỗ trợ (chỉ push / pop ở đỉnh)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Vào sau ra trước; nền tảng của stack đơn điệu, DFS không đệ quy, hoàn tác" },
      cards: [
        { q: "Stack hoạt động theo nguyên tắc nào và các thao tác tốn bao lâu?", a: "LIFO (vào sau ra trước); push, pop, top đều O(1)." },
        { q: "Thuật toán kiểm tra dãy ngoặc hợp lệ bằng stack?", a: "Ngoặc mở thì push; ngoặc đóng thì stack phải không rỗng và đỉnh là ngoặc mở cùng loại, rồi pop. Cuối cùng stack phải rỗng." },
        { q: "Khi tính biểu thức bằng hai stack, khi nào tính toán tử ở đỉnh?", a: "Khi gặp toán tử mới có độ ưu tiên thấp hơn hoặc bằng toán tử ở đỉnh (kết hợp trái), hoặc khi gặp ')' (tính đến '(')." },
        { q: "Vì sao nên dùng stack tự quản thay đệ quy cho DFS trên cây rất sâu?", a: "Stack hệ thống có giới hạn (thường vài MB); đệ quy sâu hàng trăm nghìn tầng có thể gây tràn. Stack bằng vector nằm trên heap nên không bị giới hạn đó." }
      ]
    },

    {
      id: "queue",
      name: "Hàng đợi & Deque",
      aliases: ["queue", "deque", "hàng đợi", "FIFO", "double ended queue", "hàng đợi hai đầu", "circular buffer", "ring buffer", "queue bằng hai stack"],
      category: "ds",
      sub: "Ngăn xếp, hàng đợi & heap",
      level: 1,
      tags: ["queue", "deque", "fifo", "bfs", "data-structure"],
      summary: "Hàng đợi vào trước ra trước (FIFO) và deque hai đầu: thêm ở cuối, lấy ở đầu (deque cả hai đầu) đều O(1); nền tảng của BFS và mô phỏng.",
      description:
        "Hàng đợi giữ thứ tự đến: `push` thêm vào **cuối**, `pop` bỏ phần tử ở **đầu**, `front` xem đầu hàng, mọi thao tác O(1). **Deque** (double-ended queue) cho phép thêm / bỏ ở cả hai đầu và truy cập theo chỉ số trong O(1) — dùng cho 0-1 BFS, cửa sổ trượt, mô phỏng vòng tròn.\n\n" +
        "Trong C++ có sẵn `std::queue` và `std::deque`. Khi biết trước số phần tử tối đa tồn tại cùng lúc, một **buffer vòng** (ring buffer) bằng mảng cố định nhanh hơn và tiết kiệm bộ nhớ: chỉ cần chỉ số đầu và số phần tử, mọi chỉ số lấy modulo dung lượng.\n\n" +
        "Một câu hỏi phỏng vấn kinh điển là cài hàng đợi bằng **hai ngăn xếp**: đẩy vào stack `in`; khi cần lấy mà stack `out` rỗng thì đổ cả `in` sang `out` (đảo ngược thứ tự). Mỗi phần tử bị đổ tối đa một lần nên chi phí amortized O(1) — cùng ý tưởng được dùng để làm hàng đợi lưu thêm min / max hoặc “hàng đợi có hoàn tác”.",
      conditions: ["Xử lý theo đúng thứ tự đến (FIFO) hoặc cần thêm / bỏ ở cả hai đầu (deque)", "Buffer vòng: biết trước số phần tử tồn tại đồng thời tối đa"],
      complexity: { time: "O(1) mỗi thao tác", space: "O(N)", note: "Hàng đợi hai stack: pop là O(1) amortized (một lần đổ có thể tốn O(N) nhưng cả dãy N thao tác vẫn O(N))." },
      ops: [["push (cuối)", "O(1)"], ["pop (đầu)", "O(1)"], ["Thêm / bỏ ở đầu còn lại (deque)", "O(1)"], ["Truy cập theo chỉ số (deque)", "O(1)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["BFS: hàng đợi các đỉnh chờ duyệt, 0-1 BFS dùng deque", "Mô phỏng quy trình theo thứ tự đến (xếp hàng, vòng tròn Josephus bước k = 2, round-robin)", "Cửa sổ trượt khi cần bỏ phần tử cũ nhất", "Làm đệm (producer–consumer, giới hạn tốc độ theo cửa sổ thời gian)"],
      not_for: ["Cần lấy phần tử lớn nhất / nhỏ nhất theo độ ưu tiên → Heap / Priority Queue", "Cần max / min của cửa sổ trượt trong O(1) → Monotonic Queue", "Vào sau ra trước → Ngăn xếp"],
      pitfalls: [
        "front() / pop() trên hàng đợi rỗng là hành vi không xác định — kiểm tra empty() trước.",
        "BFS: đánh dấu đã thăm lúc đẩy vào hàng đợi, không phải lúc lấy ra; nếu không một đỉnh có thể bị đẩy vào nhiều lần làm hàng đợi phình to.",
        "Buffer vòng: dung lượng phải đủ cho số phần tử đồng thời tối đa — không tự kiểm tra tràn; push_front phải cộng thêm (dung lượng − 1) trước khi lấy modulo để tránh chỉ số âm.",
        "std::queue không có clear() và không duyệt được; cần thao tác đó thì dùng std::deque.",
        "Mô phỏng Josephus với k lớn: đẩy–bỏ k lần mỗi vòng tốn O(N·k) — dùng ordered set / Fenwick để nhảy thẳng tới vị trí kế."
      ],
      code: {
        lang: "cpp", title: "ring_deque.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// (1) Deque vòng dung lượng cố định cap: push/pop hai đầu và truy cập d[i] (0 = đầu hàng) đều O(1).
// Không tự kiểm tra tràn / rỗng: người dùng bảo đảm size() < cap khi push và size() > 0 khi pop / front / back.
template <class T>
struct RingDeque {
    vector<T> buf;
    int head = 0, cnt = 0;                       // head: vị trí phần tử đầu; cnt: số phần tử
    explicit RingDeque(int cap) : buf(max(cap, 1)) {}
    int cap() const { return buf.size(); }
    int size() const { return cnt; }
    bool empty() const { return cnt == 0; }
    int idx(int i) const { return (head + i) % cap(); }
    T& operator[](int i) { return buf[idx(i)]; }
    T& front() { return buf[head]; }
    T& back() { return buf[idx(cnt - 1)]; }
    void push_back(const T& x) { buf[idx(cnt)] = x; cnt++; }
    void push_front(const T& x) { head = (head + cap() - 1) % cap(); buf[head] = x; cnt++; }
    void pop_front() { head = (head + 1) % cap(); cnt--; }
    void pop_back() { cnt--; }
};

// (2) Hàng đợi bằng hai stack: push O(1), pop / front O(1) amortized.
// Phần tử đầu hàng nằm ở out.back(); khi out rỗng thì đổ toàn bộ in sang out (đảo thứ tự).
template <class T>
struct TwoStackQueue {
    vector<T> in, out;
    void push(const T& x) { in.push_back(x); }
    void refill() {
        if (!out.empty()) return;
        while (!in.empty()) { out.push_back(in.back()); in.pop_back(); }
    }
    T& front() { refill(); return out.back(); }
    void pop() { refill(); out.pop_back(); }
    int size() const { return in.size() + out.size(); }
    bool empty() const { return in.empty() && out.empty(); }
};
`
      },
      example: {
        input: "pushBack 1\npushBack 2\npushFront 0\npopBack\npopFront\nfront",
        output: "1",
        explain: "Thao tác trên RingDeque: sau pushBack 1, pushBack 2, pushFront 0 hàng là [0, 1, 2]; popBack bỏ 2 → [0, 1]; popFront bỏ 0 → [1]; front() = 1."
      },
      problems: [
        { site: "cses", id: "2162", name: "Josephus Problem I" },
        { site: "lc", name: "Implement Queue using Stacks" },
        { site: "lc", name: "Design Circular Deque" }
      ],
      related: ["stack", "monotonic-queue", "heap", "bfs", "bfs-01", "sliding-window"],
      compare: { "Truy vấn": "Đầu / cuối O(1); theo chỉ số O(1) (deque)", "Cập nhật điểm": "Không hỗ trợ (chỉ thêm cuối, bỏ đầu; deque thêm cả hai đầu)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "FIFO; deque 2 đầu; làm bằng hai stack; nền tảng BFS" },
      cards: [
        { q: "Hàng đợi hoạt động theo nguyên tắc nào?", a: "FIFO — vào trước ra trước: thêm ở cuối, lấy ở đầu, đều O(1)." },
        { q: "Cài hàng đợi bằng hai stack như thế nào và chi phí ra sao?", a: "Push vào stack in; khi lấy mà out rỗng thì đổ hết in sang out. Mỗi phần tử bị đổ tối đa một lần nên amortized O(1)." },
        { q: "Vì sao BFS nên đánh dấu đã thăm lúc đẩy vào hàng đợi?", a: "Để mỗi đỉnh chỉ vào hàng đợi một lần; đánh dấu lúc lấy ra thì đỉnh có thể bị đẩy nhiều lần, tốn bộ nhớ và thời gian." },
        { q: "Khi nào chọn buffer vòng thay cho std::deque?", a: "Khi biết số phần tử đồng thời tối đa: mảng cố định nhanh hơn, ít cấp phát, nhưng phải tự bảo đảm không tràn." }
      ]
    },

    {
      id: "monotonic-stack",
      name: "Monotonic Stack",
      aliases: ["monotonic stack", "stack đơn điệu", "next greater element", "nearest smaller values", "phần tử lớn hơn gần nhất", "phần tử nhỏ hơn gần nhất", "largest rectangle in histogram", "hình chữ nhật lớn nhất trong histogram", "stock span"],
      category: "ds",
      sub: "Ngăn xếp, hàng đợi & heap",
      level: 2,
      tags: ["stack", "monotonic-stack", "next-greater", "histogram", "array"],
      summary: "Ngăn xếp luôn đơn điệu để tìm, cho mọi phần tử, phần tử lớn hơn / nhỏ hơn gần nhất bên trái hoặc phải trong tổng thời gian O(N).",
      description:
        "Duyệt mảng từ trái sang phải và giữ một stack các **chỉ số** sao cho giá trị tương ứng đơn điệu (ví dụ giảm dần). Khi gặp `a[i]` lớn hơn đỉnh, đỉnh đó đã tìm được “phần tử lớn hơn gần nhất bên phải” chính là `i` — ghi kết quả rồi pop; lặp tới khi đỉnh không nhỏ hơn `a[i]`, sau đó push `i`. Mỗi chỉ số vào và ra stack đúng một lần nên tổng O(N).\n\n" +
        "Cùng một lượt duyệt, phần tử còn nằm trên stack ngay dưới `i` sau khi pop xong chính là “phần tử gần nhất bên trái không nhỏ hơn `a[i]`”. Đổi chiều so sánh được các biến thể lớn hơn / nhỏ hơn, gần nhất bên trái / phải.\n\n" +
        "Ứng dụng nổi tiếng: **hình chữ nhật lớn nhất trong histogram** (với mỗi cột, mở rộng sang hai bên tới cột thấp hơn đầu tiên), **tổng min / max của mọi đoạn con** (kỹ thuật đóng góp: đếm số đoạn mà `a[i]` là min), stock span. Khi đếm đoạn con theo min / max phải dùng **một bên so sánh chặt, một bên không chặt** để các giá trị bằng nhau không bị đếm hai lần hoặc bỏ sót.",
      conditions: ["Bài toán hỏi “gần nhất bên trái / phải thoả điều kiện so sánh” cho từng vị trí", "Xử lý offline trong một lượt duyệt, không có cập nhật xen kẽ"],
      complexity: { time: "O(N)", space: "O(N)", note: "Mỗi chỉ số push và pop tối đa một lần." },
      ops: [["Next / previous greater (smaller) cho cả mảng", "O(N)"], ["Hình chữ nhật lớn nhất trong histogram", "O(N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Next greater element, nearest smaller values (cho mọi vị trí)", "Hình chữ nhật lớn nhất trong histogram và biến thể trên ma trận 0/1", "Tổng (hoặc số lượng) min / max của mọi đoạn con bằng kỹ thuật đóng góp", "Stock span, tính chiều rộng “tầm nhìn” của từng phần tử"],
      not_for: ["Có cập nhật phần tử xen kẽ truy vấn → Segment Tree với descent", "Cần min / max của đoạn tuỳ ý [l, r] → Sparse Table hoặc Segment Tree", "Cần max / min của cửa sổ trượt cố định → Monotonic Queue"],
      pitfalls: [
        "Xử lý bằng nhau sai: một bên phải chặt (>), bên kia không chặt (>=), nếu không các đoạn có nhiều phần tử bằng nhau bị đếm trùng hoặc thiếu.",
        "Lưu giá trị thay vì chỉ số trong stack nên không tính được độ rộng — hầu hết ứng dụng cần chỉ số.",
        "Quên điều kiện biên: không có phần tử thoả thì trả -1 (bên trái) hoặc n (bên phải) và độ rộng là right - left - 1.",
        "Tràn số: diện tích histogram và tổng đóng góp cần long long (chiều cao × độ rộng, giá trị × số đoạn).",
        "Nhầm chiều so sánh khi đổi từ “lớn hơn” sang “nhỏ hơn”: nên dùng chung một hàm mẫu và truyền comparator."
      ],
      code: {
        lang: "cpp", title: "monotonic_stack.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Stack đơn điệu: gần nhất bên phải / bên trái thoả điều kiện so sánh. Mảng 0-based, mỗi hàm O(N).
// before(x, y) = "x đứng trước y trong thứ tự được tìm". Hai cách dùng thường gặp:
//   nearestRight(a, less<>())    -> res[i] = j > i nhỏ nhất có a[j] >  a[i]   (n nếu không có)   "next greater"
//   nearestLeft (a, less<>())    -> res[i] = j < i lớn nhất có a[j] >= a[i]   (-1 nếu không có)  "previous greater or equal"
//   nearestRight(a, greater<>()) -> j > i nhỏ nhất có a[j] <  a[i]                               "next smaller"
//   nearestLeft (a, greater<>()) -> j < i lớn nhất có a[j] <= a[i]                               "previous smaller or equal"
// Cặp (chặt phải, không chặt trái) cho phép đếm mỗi đoạn con đúng một lần khi có giá trị bằng nhau.
template <class T, class F>
vector<int> nearestRight(const vector<T>& a, F before) {
    int n = a.size();
    vector<int> res(n, n), st;                   // st: các chỉ số chưa tìm được đáp án
    for (int i = 0; i < n; i++) {
        while (!st.empty() && before(a[st.back()], a[i])) { res[st.back()] = i; st.pop_back(); }
        st.push_back(i);
    }
    return res;
}

template <class T, class F>
vector<int> nearestLeft(const vector<T>& a, F before) {
    int n = a.size();
    vector<int> res(n, -1), st;
    for (int i = 0; i < n; i++) {
        while (!st.empty() && before(a[st.back()], a[i])) st.pop_back();
        if (!st.empty()) res[i] = st.back();
        st.push_back(i);
    }
    return res;
}

// Hình chữ nhật lớn nhất trong histogram (cột rộng 1, chiều cao h[i] >= 0): O(N).
// Với mỗi cột i: mở rộng sang hai bên tới cột thấp hơn đầu tiên, diện tích = h[i] * (R - L - 1).
long long largestRectangle(const vector<long long>& h) {
    int n = h.size();
    vector<int> L = nearestLeft(h, greater<>()), R = nearestRight(h, greater<>());
    long long best = 0;
    for (int i = 0; i < n; i++) best = max(best, h[i] * (R[i] - L[i] - 1));
    return best;
}
`
      },
      example: {
        input: "6\n2 1 5 6 2 3",
        output: "2 2 3 6 5 6\n10",
        explain: "Mảng 6 phần tử (0-based). Dòng 1 là nearestRight(a, less<>()): phần tử lớn hơn đầu tiên bên phải của từng vị trí (6 nghĩa là không có): 2→5 ở chỉ số 2, 1→5 ở chỉ số 2, 5→6 ở chỉ số 3, 6→không có, 2→3 ở chỉ số 5, 3→không có. Dòng 2 là largestRectangle: hai cột cao 5 và 6 cho hình chữ nhật cao 5 rộng 2 = 10."
      },
      problems: [
        { site: "cses", id: "1645", name: "Nearest Smaller Values" },
        { site: "lc", name: "Largest Rectangle in Histogram" },
        { site: "lc", name: "Daily Temperatures" },
        { site: "spoj", name: "Largest Rectangle in a Histogram" }
      ],
      related: ["stack", "monotonic-queue", "sparse-table", "segment-tree", "kadane"],
      compare: { "Truy vấn": "O(1) amortized (gần nhất lớn / nhỏ hơn cho mọi vị trí, offline)", "Cập nhật điểm": "Không hỗ trợ", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Duyệt một lượt; đếm đoạn con theo min / max; histogram" },
      cards: [
        { q: "Vì sao stack đơn điệu chạy O(N) dù có vòng while lồng trong vòng for?", a: "Mỗi chỉ số được push đúng một lần và pop tối đa một lần, nên tổng số lần pop không quá N." },
        { q: "Stack đơn điệu lưu giá trị hay chỉ số?", a: "Thường lưu chỉ số: cần chỉ số để ghi đáp án và tính độ rộng; giá trị lấy qua a[chỉ số]." },
        { q: "Làm sao tránh đếm trùng khi tính tổng min của mọi đoạn con có giá trị bằng nhau?", a: "Một bên dùng so sánh chặt, bên kia không chặt (ví dụ trái: nhỏ hơn hoặc bằng, phải: nhỏ hơn thật sự) để mỗi đoạn có đúng một “min đại diện”." },
        { q: "Hình chữ nhật lớn nhất trong histogram giải thế nào bằng stack đơn điệu?", a: "Với mỗi cột tìm cột thấp hơn gần nhất bên trái và bên phải; diện tích = chiều cao × (R - L - 1); lấy max, tổng O(N)." }
      ]
    },

    {
      id: "monotonic-queue",
      name: "Monotonic Queue (Sliding Window Max)",
      aliases: ["monotonic queue", "hàng đợi đơn điệu", "sliding window maximum", "sliding window minimum", "cửa sổ trượt max", "deque tối ưu dp", "max trong cửa sổ", "min trong cửa sổ"],
      category: "ds",
      sub: "Ngăn xếp, hàng đợi & heap",
      level: 2,
      tags: ["queue", "monotonic-queue", "deque", "sliding-window", "dp-optimization"],
      summary: "Deque đơn điệu giữ max (hoặc min) của cửa sổ trượt: mỗi phần tử vào ra một lần nên cả dãy N phần tử tốn O(N), mỗi truy vấn max O(1).",
      description:
        "Duy trì một deque các phần tử của cửa sổ sao cho giá trị **giảm dần** từ đầu tới cuối. Khi thêm `x` vào cuối: bỏ khỏi cuối mọi phần tử nhỏ hơn `x` — chúng ở trước `x` (sẽ rời cửa sổ sớm hơn) và nhỏ hơn nên không bao giờ trở thành max nữa. Khi cửa sổ trượt, bỏ khỏi đầu phần tử đã ra khỏi cửa sổ. Max hiện tại luôn ở đầu deque.\n\n" +
        "Mỗi phần tử vào và ra deque tối đa một lần nên tổng O(N), nhanh hơn heap có xoá lười (O(N log N)) và segment tree. Hai cách cài: lưu **chỉ số** (dễ kiểm tra phần tử đã rời cửa sổ) hoặc lưu **giá trị** (tổng quát hơn: dùng như hàng đợi thật có thao tác `max()`, bỏ phần tử đầu thật bằng `pop(x)`).\n\n" +
        "Ứng dụng mạnh nhất là tối ưu DP dạng `dp[i] = cost(i) + min/max của dp[j]` với `j` nằm trong cửa sổ `[i-K, i-1]`: thay vòng lặp K phần tử bằng một monotonic queue, đưa O(NK) xuống O(N).",
      conditions: ["Cửa sổ chỉ trượt về một phía: thêm ở cuối, bỏ ở đầu (FIFO), không xoá phần tử bất kỳ", "Phép cần là max hoặc min (hoặc một thứ tự toàn phần nào khác)"],
      complexity: { time: "O(N)", space: "O(K)", note: "Tổng cho cả dãy N phần tử là O(N) (amortized O(1) mỗi phần tử); bộ nhớ O(K) với K là kích thước cửa sổ." },
      ops: [["push (kèm dọn đuôi)", "O(1) amortized"], ["pop đầu", "O(1)"], ["max / min hiện tại", "O(1)"], ["Cả dãy N phần tử", "O(N)"], ["Bộ nhớ", "O(K)"]],
      use_case: ["Max / min của mọi cửa sổ độ dài K trên mảng N phần tử", "Tối ưu DP có chuyển trạng thái từ cửa sổ [i−K, i−1] (dp[i] = a[i] + max dp[j])", "Đoạn con có độ dài ≤ L với tổng lớn nhất: min của prefix sum trong cửa sổ", "Hàng đợi hỗ trợ lấy max / min trong O(1)"],
      not_for: ["Xoá phần tử bất kỳ khỏi cửa sổ → heap / multiset có xoá hoặc Segment Tree", "Truy vấn max / min của đoạn tuỳ ý [l, r] → Sparse Table hoặc Segment Tree", "Tổng hoặc xor của cửa sổ → Prefix Sum / Cửa sổ trượt thường"],
      pitfalls: [
        "Lưu chỉ số: bỏ khỏi đuôi khi a[đuôi] <= a[i] (hoặc <); lưu giá trị: dùng < để giữ các bản sao bằng nhau, nếu không pop(x) sau đó có thể bỏ nhầm.",
        "Điều kiện rời cửa sổ là dq.front() <= i - k (chỉ số), không phải < : sai một đơn vị làm cửa sổ dài K+1 hoặc K-1.",
        "Kết quả chỉ hợp lệ từ i >= k - 1; trước đó cửa sổ chưa đủ K phần tử. Yêu cầu 1 <= K <= N.",
        "Muốn min thì đảo dấu so sánh (hoặc nhân giá trị với -1); đừng quên đảo cả hai chỗ.",
        "Kiểu dữ liệu: dp và tổng prefix dễ vượt int — dùng long long cả trong deque."
      ],
      code: {
        lang: "cpp", title: "monotonic_queue.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// (1) Cửa sổ trượt: res[i] = max(a[i..i+k-1]) với i = 0..n-k. Yêu cầu 1 <= k <= n. O(N).
// Deque lưu CHỈ SỐ, giá trị a giảm dần từ đầu tới cuối; đầu deque là max của cửa sổ hiện tại.
// Muốn min: đổi <= thành >= ở dòng dọn đuôi.
vector<long long> slidingMax(const vector<long long>& a, int k) {
    int n = a.size();
    deque<int> dq;
    vector<long long> res;
    for (int i = 0; i < n; i++) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();   // phần tử nhỏ hơn không bao giờ là max nữa
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();                      // đầu deque đã rời cửa sổ
        if (i >= k - 1) res.push_back(a[dq.front()]);
    }
    return res;
}

// (2) Hàng đợi có max(): push(x) vào cuối, pop(x) bỏ phần tử ĐẦU thật của hàng đợi (x chính là giá trị của nó),
// getMax() là max của mọi phần tử đang có. Mọi thao tác O(1) amortized. Dùng < khi push để giữ các bản sao bằng nhau.
template <class T>
struct MaxQueue {
    deque<T> dq;
    void push(const T& x) {
        while (!dq.empty() && dq.back() < x) dq.pop_back();
        dq.push_back(x);
    }
    void pop(const T& x) { if (!dq.empty() && dq.front() == x) dq.pop_front(); }
    const T& getMax() const { return dq.front(); }
    bool empty() const { return dq.empty(); }
};
`
      },
      example: {
        input: "8 3\n1 3 -1 -3 5 3 6 7",
        output: "3 3 5 5 6 7",
        explain: "Mảng 8 phần tử, cửa sổ độ dài 3: [1,3,-1]→3, [3,-1,-3]→3, [-1,-3,5]→5, [-3,5,3]→5, [5,3,6]→6, [3,6,7]→7. Mỗi phần tử vào và ra deque đúng một lần nên tổng O(N)."
      },
      problems: [
        { site: "cses", id: "3221", name: "Sliding Window Minimum" },
        { site: "cses", id: "1644", name: "Maximum Subarray Sum II" },
        { site: "lc", name: "Sliding Window Maximum" },
        { site: "lc", name: "Jump Game VI" }
      ],
      related: ["queue", "monotonic-stack", "sliding-window", "heap", "sparse-table", "two-pointers"],
      compare: { "Truy vấn": "O(1) (max / min của cửa sổ hiện tại)", "Cập nhật điểm": "Không hỗ trợ (chỉ thêm cuối, bỏ đầu)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(K)", "Hỗ trợ thêm": "Tối ưu DP với cửa sổ chuyển trạng thái; hàng đợi có max / min" },
      cards: [
        { q: "Vì sao có thể bỏ khỏi đuôi deque mọi phần tử nhỏ hơn phần tử mới?", a: "Chúng đứng trước phần tử mới nên rời cửa sổ sớm hơn, mà lại nhỏ hơn: không bao giờ có thể là max của cửa sổ nào nữa." },
        { q: "Độ phức tạp của sliding window max bằng monotonic queue?", a: "O(N) tổng (mỗi phần tử vào ra deque tối đa một lần), bộ nhớ O(K)." },
        { q: "Khi nào phần tử ở đầu deque phải bị bỏ?", a: "Khi chỉ số của nó <= i - k (đã ra khỏi cửa sổ [i-k+1, i])." },
        { q: "Monotonic queue giúp tối ưu DP dạng nào?", a: "dp[i] = cost(i) + min/max của dp[j] với j trong [i-K, i-1]: đưa từ O(N·K) xuống O(N)." }
      ]
    },

    {
      id: "heap",
      name: "Heap / Priority Queue",
      aliases: ["heap", "priority queue", "hàng đợi ưu tiên", "min heap", "max heap", "binary heap", "đống", "decrease key", "top k", "indexed heap", "std::priority_queue"],
      category: "ds",
      sub: "Ngăn xếp, hàng đợi & heap",
      level: 2,
      tags: ["heap", "priority-queue", "data-structure", "greedy", "top-k"],
      summary: "Cấu trúc lấy phần tử nhỏ nhất (hoặc lớn nhất) trong O(1), thêm và lấy ra trong O(log N); nền tảng của Dijkstra, tham lam và top-K.",
      description:
        "Heap nhị phân là cây nhị phân gần đầy lưu trong mảng, thoả tính chất heap: cha không lớn hơn hai con (min-heap). Phần tử nhỏ nhất luôn ở gốc. `push` đặt phần tử vào cuối rồi **sift-up**; `pop` đổi gốc với phần tử cuối, bỏ đi rồi **sift-down**; cả hai O(log N). Dựng heap từ N phần tử có sẵn chỉ tốn O(N).\n\n" +
        "`std::priority_queue` là **max-heap** mặc định; min-heap dùng `priority_queue<T, vector<T>, greater<T>>`. Nó không có `erase` hay giảm khoá, nên khi cần “giảm khoá” (Dijkstra, Prim) có hai cách: **xoá lười** (đẩy bản ghi mới, bỏ qua bản cũ khi lấy ra) hoặc **heap có chỉ mục** như mẫu bên dưới — lưu vị trí của từng id để cập nhật / xoá trực tiếp trong O(log N).\n\n" +
        "Các mẫu hay gặp: top-K lớn nhất bằng min-heap kích thước K (O(N log K)), trung vị trực tuyến bằng hai heap (max-heap nửa dưới, min-heap nửa trên), gộp K dãy đã sắp xếp, tham lam “luôn xử lý việc có độ ưu tiên cao nhất / hạn chót sớm nhất”.",
      conditions: ["Chỉ cần phần tử nhỏ nhất / lớn nhất tại mỗi thời điểm, không cần thứ tự toàn bộ", "Thứ tự so sánh là một thứ tự yếu nghiêm ngặt (strict weak ordering)"],
      complexity: { time: "O(log N) mỗi push / pop", space: "O(N)", note: "top O(1); dựng heap từ N phần tử O(N); heap có chỉ mục: update / erase theo id O(log N)." },
      ops: [["push / đặt khoá (update)", "O(log N)"], ["top (nhỏ nhất)", "O(1)"], ["pop", "O(log N)"], ["Xoá theo id (heap có chỉ mục)", "O(log N)"], ["Dựng heap từ N phần tử", "O(N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Dijkstra, Prim: luôn lấy đỉnh có khoảng cách nhỏ nhất", "Tham lam theo độ ưu tiên: lập lịch với hạn chót, xếp phòng, ghép cặp nhỏ nhất", "Top-K phần tử lớn nhất / nhỏ nhất, K dãy đã sắp xếp gộp thành một", "Trung vị của dòng dữ liệu bằng hai heap"],
      not_for: ["Cần phần tử thứ k bất kỳ, đếm số phần tử nhỏ hơn, duyệt theo thứ tự → Ordered Set / Treap / Fenwick", "Cần cả min và max, hoặc xoá phần tử tuỳ ý rất nhiều → std::multiset hoặc Ordered Set", "Cần max của cửa sổ trượt tối ưu O(N) → Monotonic Queue"],
      pitfalls: [
        "priority_queue mặc định là MAX-heap: min-heap phải dùng greater<> (với pair so sánh theo first rồi second).",
        "Mẹo đảo dấu để dùng max-heap làm min-heap bị sai khi gặp LLONG_MIN hoặc UINT: -LLONG_MIN tràn.",
        "pop() / top() trên heap rỗng là hành vi không xác định — kiểm tra empty().",
        "Xoá lười: nhớ kiểm tra bản ghi lấy ra còn hợp lệ (ví dụ d > dist[u] thì bỏ), nếu không xử lý cùng một đỉnh nhiều lần và độ phức tạp xấu đi.",
        "Comparator không phải thứ tự yếu nghiêm ngặt (dùng <= thay vì <) làm heap hỏng hoặc treo."
      ],
      code: {
        lang: "cpp", title: "indexed_min_heap.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Min-heap có chỉ mục: id thuộc [0, n), mỗi id có khoá key[id] (long long). update / erase theo id đều O(log n) —
// dùng cho giảm khoá trong Dijkstra / Prim mà không để lại bản ghi cũ như priority_queue.
// Heap thường: priority_queue<T, vector<T>, greater<T>> pq; pq.push(x); pq.top(); pq.pop();
struct IndexedMinHeap {
    vector<long long> key;                       // key[id]
    vector<int> heap, pos;                       // heap[i] = id ở vị trí i; pos[id] = vị trí trong heap, -1 nếu không có
    explicit IndexedMinHeap(int n) : key(n, 0), pos(n, -1) {}
    bool empty() const { return heap.empty(); }
    int size() const { return heap.size(); }
    bool contains(int id) const { return pos[id] >= 0; }
    int topId() const { return heap[0]; }
    long long topKey() const { return key[heap[0]]; }
    void swapAt(int i, int j) {
        swap(heap[i], heap[j]);
        pos[heap[i]] = i;
        pos[heap[j]] = j;
    }
    void up(int i) {
        while (i > 0 && key[heap[i]] < key[heap[(i - 1) / 2]]) { swapAt(i, (i - 1) / 2); i = (i - 1) / 2; }
    }
    void down(int i) {
        int n = heap.size();
        for (;;) {
            int m = i, l = 2 * i + 1, r = l + 1;
            if (l < n && key[heap[l]] < key[heap[m]]) m = l;
            if (r < n && key[heap[r]] < key[heap[m]]) m = r;
            if (m == i) return;
            swapAt(i, m);
            i = m;
        }
    }
    void update(int id, long long k) {           // đặt khoá = k (thêm id nếu chưa có); tăng hay giảm đều được
        bool had = contains(id);
        key[id] = k;
        if (!had) { pos[id] = heap.size(); heap.push_back(id); }
        up(pos[id]);
        down(pos[id]);
    }
    void erase(int id) {                         // xoá id (không có thì bỏ qua)
        int i = pos[id];
        if (i < 0) return;
        swapAt(i, (int)heap.size() - 1);
        heap.pop_back();
        pos[id] = -1;
        if (i < (int)heap.size()) { up(i); down(i); }
    }
    int pop() {                                  // lấy ra và trả id có khoá nhỏ nhất
        int id = heap[0];
        erase(id);
        return id;
    }
};
`
      },
      example: {
        input: "update 0 5\nupdate 1 3\nupdate 2 8\nupdate 2 1\npop\npop\npop",
        output: "2 1 0",
        explain: "Đặt khoá: id0=5, id1=3, id2=8, rồi giảm khoá id2 xuống 1. Ba lần pop lần lượt cho id có khoá nhỏ nhất: id2 (khoá 1), id1 (khoá 3), id0 (khoá 5) → in 2 1 0."
      },
      problems: [
        { site: "cses", id: "1671", name: "Shortest Routes I" },
        { site: "cses", id: "1164", name: "Room Allocation" },
        { site: "lc", name: "Kth Largest Element in an Array" },
        { site: "lc", name: "Find Median from Data Stream" },
        { site: "lc", name: "Merge k Sorted Lists" }
      ],
      related: ["dijkstra", "prim", "monotonic-queue", "ordered-set", "treap", "lfu-cache"],
      compare: { "Truy vấn": "Min / max O(1); phần tử khác O(N)", "Cập nhật điểm": "O(log N) (đặt lại khoá khi có chỉ mục)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "push / pop O(log N); top-K; trung vị bằng hai heap; dựng O(N)" },
      cards: [
        { q: "Độ phức tạp các thao tác của heap nhị phân?", a: "top O(1); push và pop O(log N); dựng heap từ N phần tử O(N); bộ nhớ O(N)." },
        { q: "Làm sao có min-heap với std::priority_queue?", a: "priority_queue<T, vector<T>, greater<T>>; mặc định nó là max-heap." },
        { q: "priority_queue không giảm khoá được thì Dijkstra làm sao?", a: "Xoá lười: đẩy bản ghi mới (khoảng cách nhỏ hơn), khi lấy ra bỏ qua nếu d > dist[u]. Hoặc dùng heap có chỉ mục để cập nhật trực tiếp." },
        { q: "Tìm K phần tử lớn nhất của dãy N phần tử bằng heap?", a: "Giữ min-heap kích thước K: với mỗi phần tử đẩy vào, nếu size > K thì pop phần tử nhỏ nhất. Tổng O(N log K)." }
      ]
    },

    /* ============================== Tập hợp rời nhau ============================== */
    {
      id: "dsu",
      name: "DSU (Union-Find)",
      aliases: ["dsu", "union find", "union-find", "disjoint set union", "tập rời nhau", "hợp nhất tập", "disjoint set", "rollback dsu", "gộp tập", "thành phần liên thông động"],
      category: "ds",
      sub: "Tập hợp rời nhau",
      level: 2,
      tags: ["dsu", "union-find", "disjoint-set", "connectivity", "graph"],
      summary: "Quản lý các tập rời nhau: gộp hai tập và hỏi hai phần tử có cùng tập không, mỗi thao tác gần như O(1) nhờ nén đường đi và gộp theo kích thước.",
      description:
        "Mỗi tập được biểu diễn bằng một **cây** với một gốc đại diện; `find(x)` đi lên gốc, `unite(a, b)` nối gốc của tập nhỏ vào gốc của tập lớn. Hai tối ưu cùng nhau cho thời gian amortized **O(α(N))** mỗi thao tác — α là hàm Ackermann ngược, tăng chậm tới mức không vượt quá 4 với mọi N thực tế: **gộp theo kích thước** (giữ cây thấp) và **nén đường đi** (mỗi nút trên đường tìm được trỏ thẳng về gốc).\n\n" +
        "Mẫu dùng mảng `p` duy nhất: `p[x] < 0` nghĩa là `x` là gốc và `-p[x]` là kích thước tập; ngược lại `p[x]` là cha. `find` viết bằng vòng lặp để không tràn stack khi cây lệch. DSU chỉ hỗ trợ **gộp**; không tách tập được.\n\n" +
        "Bài toán “thêm và xoá cạnh” (dynamic connectivity) giải được **offline**: mỗi cạnh tồn tại trong một khoảng thời gian, đặt các cạnh vào segment tree trên trục thời gian, DFS cây đó và dùng **DSU có rollback** (không nén đường đi, `find` O(log N), có `snapshot` / `rollback`). Mẫu thứ hai bên dưới là bản rollback đó. DSU còn là lõi của Kruskal, kiểm tra chu trình vô hướng và gom nhóm tương đương.",
      conditions: ["Chỉ gộp tập, không tách (hoặc có tách nhưng chạy offline với rollback)", "Các phần tử đánh số 0..N−1 (hoặc nén toạ độ trước)"],
      complexity: { time: "O(α(N)) mỗi thao tác (amortized)", space: "O(N)", note: "Bản rollback (không nén đường đi): find / unite O(log N) mỗi thao tác, hoàn tác O(1) cho mỗi lần gộp." },
      ops: [["Find", "O(α(N))"], ["Union", "O(α(N))"], ["Cùng tập? / kích thước tập", "O(α(N))"], ["Rollback (bản không nén)", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Kruskal (cây khung nhỏ nhất): kiểm tra hai đầu cạnh đã cùng thành phần chưa", "Thêm cạnh dần và đếm / hỏi thành phần liên thông (bài online chỉ thêm cạnh)", "Phát hiện chu trình trong đồ thị vô hướng khi thêm cạnh", "Dynamic connectivity offline với rollback; gom nhóm các phần tử tương đương"],
      not_for: ["Xoá cạnh trực tuyến (online) → Link-Cut Tree; xoá cạnh offline → DSU rollback + chia để trị theo thời gian", "Liên thông mạnh trong đồ thị có hướng → SCC", "Cần duyệt các phần tử của một tập theo thứ tự hay khoảng cách → BFS / DFS"],
      pitfalls: [
        "Quên gọi find trước khi so sánh hay dùng gốc: so sánh p[a] với p[b] mà chưa tìm gốc cho kết quả sai.",
        "Nén đường đi KHÔNG dùng chung được với rollback (làm đổi nhiều nút, không hoàn tác được): bản rollback chỉ gộp theo kích thước.",
        "find đệ quy trên cây lệch có thể tràn stack hệ thống khi N lớn — viết vòng lặp.",
        "Với p[x] < 0 là gốc, so sánh kích thước phải đổi dấu: tập lớn hơn có p âm hơn (p[a] > p[b] → đổi chỗ).",
        "Dùng DSU cho đồ thị CÓ HƯỚNG để hỏi “tới được không”: DSU chỉ biểu diễn liên thông vô hướng."
      ],
      code: {
        lang: "cpp", title: "dsu.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// DSU (Union-Find): nén đường đi + gộp theo kích thước, O(α(N)) mỗi thao tác. Phần tử 0..n-1.
// p[x] < 0: x là gốc và -p[x] là kích thước tập; ngược lại p[x] là cha của x. comps = số tập hiện có.
struct DSU {
    vector<int> p;
    int comps;
    explicit DSU(int n = 0) : p(n, -1), comps(n) {}
    int find(int x) {                            // vòng lặp, không đệ quy
        int r = x;
        while (p[r] >= 0) r = p[r];
        while (p[x] >= 0) { int nx = p[x]; p[x] = r; x = nx; }   // nén đường đi
        return r;
    }
    bool unite(int a, int b) {                   // true nếu thật sự gộp hai tập khác nhau
        a = find(a); b = find(b);
        if (a == b) return false;
        if (p[a] > p[b]) swap(a, b);             // a là gốc của tập lớn hơn
        p[a] += p[b];
        p[b] = a;
        comps--;
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
    int size(int x) { return -p[find(x)]; }
};

// DSU có hoàn tác: KHÔNG nén đường đi (find O(log N)), chỉ gộp theo kích thước.
// snapshot() ghi lại thời điểm; rollback(s) hoàn tác mọi lần gộp từ sau thời điểm đó. Dùng cho dynamic connectivity offline.
struct RollbackDSU {
    vector<int> p;
    vector<array<int, 3>> hist;                  // mỗi lần gộp: (gốc a, gốc b gắn vào a, p[b] cũ)
    explicit RollbackDSU(int n = 0) : p(n, -1) {}
    int find(int x) const { while (p[x] >= 0) x = p[x]; return x; }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (p[a] > p[b]) swap(a, b);
        hist.push_back({a, b, p[b]});
        p[a] += p[b];
        p[b] = a;
        return true;
    }
    int size(int x) const { return -p[find(x)]; }
    int snapshot() const { return hist.size(); }
    void rollback(int snap) {
        while ((int)hist.size() > snap) {
            auto [a, b, pb] = hist.back();
            hist.pop_back();
            p[b] = pb;
            p[a] -= pb;
        }
    }
};
`
      },
      example: {
        input: "6\nunite 1 2\nunite 3 4\nunite 2 3\nsame 1 4\nsame 5 6\ncomponents",
        output: "true\nfalse\n3",
        explain: "6 phần tử (1-based) ban đầu mỗi phần tử một tập. Gộp {1,2}, {3,4}, rồi gộp 2 với 3 được {1,2,3,4}. same 1 4 = true; same 5 6 = false (5 và 6 chưa gộp); còn 3 tập: {1,2,3,4}, {5}, {6}."
      },
      problems: [
        { site: "cses", id: "1676", name: "Road Construction" },
        { site: "cses", id: "1666", name: "Building Roads" },
        { site: "cses", id: "1675", name: "Road Reparation" },
        { site: "cses", id: "2133", name: "Dynamic Connectivity" },
        { site: "lc", name: "Redundant Connection" }
      ],
      related: ["kruskal", "scc", "bfs", "dfs", "segment-tree", "bridges-articulation"],
      compare: { "Truy vấn": "Cùng tập? O(α(N))", "Cập nhật điểm": "Gộp hai tập O(α(N)); không tách được", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Kích thước tập; rollback offline; DSU có trọng số / tính chẵn lẻ" },
      cards: [
        { q: "Hai tối ưu của DSU và độ phức tạp thu được?", a: "Gộp theo kích thước (hoặc hạng) và nén đường đi; cùng nhau cho O(α(N)) amortized mỗi thao tác, α rất nhỏ (≤ 4 với N thực tế)." },
        { q: "DSU có tách được một tập không?", a: "Không. Chỉ gộp. Xoá cạnh offline giải bằng DSU rollback và chia để trị / segment tree theo thời gian." },
        { q: "Vì sao DSU rollback không dùng nén đường đi?", a: "Nén đường đi đổi cha của nhiều nút trong một lần find, khó hoàn tác trong O(1); bản rollback chỉ gộp theo kích thước nên find là O(log N) nhưng mỗi lần gộp chỉ đổi hai giá trị." },
        { q: "Kruskal dùng DSU ở đâu?", a: "Duyệt cạnh theo trọng số tăng dần; nếu hai đầu cạnh chưa cùng tập (unite trả true) thì lấy cạnh đó vào cây khung." }
      ]
    },

    /* ============================== Cây truy vấn đoạn ============================== */
    {
      id: "fenwick-tree",
      name: "Fenwick Tree (BIT)",
      aliases: ["fenwick tree", "fenwick", "binary indexed tree", "bit", "cây chỉ số nhị phân", "tổng tiền tố động", "range update point query", "bit 2d", "cây fenwick"],
      category: "ds",
      sub: "Cây truy vấn đoạn",
      level: 2,
      tags: ["fenwick", "bit", "range-query", "point-update", "prefix-sum"],
      summary: "Cây chỉ số nhị phân: cập nhật một phần tử và tính tổng tiền tố (hoặc đoạn) đều O(log N), code ngắn và hằng số rất nhỏ.",
      description:
        "Phần tử `t[i]` (1-based) lưu tổng của đoạn `(i − lowbit(i), i]` với `lowbit(i) = i & -i`. **Tổng tiền tố** tới `r`: cộng `t[r]`, rồi `r -= lowbit(r)`, lặp tới 0 — tối đa log N bước. **Cập nhật** `a[i] += v`: cộng vào `t[i]`, rồi `i += lowbit(i)` tới hết mảng. Hai phép lặp theo hai chiều ngược nhau trên cùng một cấu trúc.\n\n" +
        "Fenwick hoạt động với mọi phép gộp có **nghịch đảo** (tổng, xor). Đoạn `[l, r)` = `prefix(r) − prefix(l)`. Cập nhật đoạn + truy vấn điểm: Fenwick trên mảng hiệu. Cập nhật đoạn + tổng đoạn: **hai** Fenwick (mẫu `RangeFenwick`). Khi mọi giá trị không âm, có thể **đi xuống nhị phân** để tìm vị trí nhỏ nhất có tổng tiền tố ≥ x (phần tử thứ k trong tập đánh dấu) trong O(log N).\n\n" +
        "So với Segment Tree: ngắn hơn nhiều và nhanh hơn do hằng số nhỏ, nhưng chỉ làm được các phép khả nghịch (không có min / max tuỳ ý) và khó mở rộng. Có thể mở rộng sang 2D với `O(log N · log M)` mỗi thao tác.",
      conditions: ["Phép gộp là tổng hoặc xor (có nghịch đảo); truy vấn dạng tiền tố hoặc đoạn", "Cập nhật là cộng vào một phần tử (hoặc cộng đoạn với mảng hiệu)"],
      complexity: { time: "O(log N) mỗi thao tác", space: "O(N)", note: "Dựng từ mảng có sẵn O(N). Fenwick 2D: O(log N · log M) mỗi thao tác, bộ nhớ O(NM)." },
      ops: [["Cập nhật điểm (cộng)", "O(log N)"], ["Tổng tiền tố / đoạn", "O(log N)"], ["Dựng từ mảng", "O(N)"], ["Tìm vị trí thứ k (đi xuống)", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Tổng đoạn với cập nhật điểm xen kẽ (online)", "Đếm nghịch thế và LIS đếm số cách (dùng với nén toạ độ)", "Cập nhật đoạn + truy vấn điểm; cập nhật đoạn + tổng đoạn bằng hai BIT", "Tìm phần tử thứ k trong tập có thêm / xoá giá trị trong miền nhỏ"],
      not_for: ["Truy vấn min / max đoạn → Segment Tree hoặc Sparse Table", "Cập nhật không phải cộng (gán, nhân) trên đoạn → Segment Tree lười", "Mảng tĩnh không có cập nhật → Prefix Sum (nhanh hơn và đơn giản hơn)"],
      pitfalls: [
        "BIT bắt buộc đánh số từ 1: với chỉ số 0, i & -i = 0 làm vòng lặp cập nhật không bao giờ dừng. Mẫu này nhận chỉ số 0-based và tự cộng 1 bên trong.",
        "Tràn int: tổng nhiều phần tử lớn — dùng long long.",
        "Muốn ĐẶT a[i] = x thì phải add(i, x − giá trị hiện tại): cần giữ thêm mảng a, vì BIT không đọc lại một phần tử rẻ.",
        "Tìm vị trí thứ k bằng đi xuống nhị phân chỉ đúng khi mọi phần tử không âm.",
        "Cập nhật đoạn + tổng đoạn: công thức hai BIT dễ sai dấu — nhớ prefix(x) = x·B1(x) − B2(x) với B2 lưu d[i]·i."
      ],
      code: {
        lang: "cpp", title: "fenwick.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Fenwick Tree (BIT) cho tổng. API 0-based, đoạn nửa mở; bên trong 1-based.
// add(i, v): a[i] += v. prefix(r): tổng a[0..r-1]. sum(l, r): tổng a[l..r-1]. Tất cả O(log N).
struct Fenwick {
    int n;
    vector<long long> t;
    explicit Fenwick(int n = 0) : n(n), t(n + 1, 0) {}
    explicit Fenwick(const vector<long long>& a) : n(a.size()), t(a.size() + 1, 0) {   // dựng O(N)
        for (int i = 1; i <= n; i++) {
            t[i] += a[i - 1];
            int j = i + (i & -i);
            if (j <= n) t[j] += t[i];
        }
    }
    void add(int i, long long v) { for (i++; i <= n; i += i & -i) t[i] += v; }
    long long prefix(int r) const { long long s = 0; for (; r > 0; r -= r & -r) s += t[r]; return s; }
    long long sum(int l, int r) const { return prefix(r) - prefix(l); }
    // Vị trí p (0-based) nhỏ nhất có tổng a[0..p] >= x; trả n nếu tổng toàn mảng < x. Chỉ đúng khi mọi a[i] >= 0.
    int lowerBound(long long x) const {
        int pos = 0;
        for (int pw = 1 << (31 - __builtin_clz(max(n, 1))); pw; pw >>= 1)
            if (pos + pw <= n && t[pos + pw] < x) { pos += pw; x -= t[pos]; }
        return pos;
    }
};

// Cập nhật đoạn + tổng đoạn bằng hai BIT trên mảng hiệu d: sum a[0..x-1] = x * sum d[0..x-1] - sum (d[i] * i).
// add(l, r, v): a[l..r-1] += v. sum(l, r): tổng a[l..r-1]. O(log N).
struct RangeFenwick {
    Fenwick b1, b2;
    explicit RangeFenwick(int n) : b1(n), b2(n) {}
    void add(int l, int r, long long v) {
        b1.add(l, v); b1.add(r, -v);
        b2.add(l, v * l); b2.add(r, -v * r);
    }
    long long prefix(int x) const { return x * b1.prefix(x) - b2.prefix(x); }
    long long sum(int l, int r) const { return prefix(r) - prefix(l); }
};
`
      },
      example: {
        input: "5\n3 1 4 1 5\nprefix 3\nadd 1 6\nsum 1 4",
        output: "8\n12",
        explain: "Mảng a = [3, 1, 4, 1, 5] (0-based). prefix 3 = tổng 3 phần tử đầu = 3+1+4 = 8. add 1 6 làm a[1] = 7, mảng thành [3, 7, 4, 1, 5]. sum 1 4 = a[1] + a[2] + a[3] = 7+4+1 = 12."
      },
      problems: [
        { site: "cses", id: "1648", name: "Dynamic Range Sum Queries" },
        { site: "cses", id: "1651", name: "Range Update Queries" },
        { site: "cses", id: "1749", name: "List Removals" },
        { site: "cses", id: "1739", name: "Forest Queries II" },
        { site: "cses", id: "1748", name: "Increasing Subsequence II" }
      ],
      related: ["array-prefix-sum", "difference-array", "segment-tree", "lazy-segment-tree", "count-inversions", "coordinate-compression"],
      compare: { "Truy vấn": "O(log N) (tổng tiền tố / đoạn)", "Cập nhật điểm": "O(log N)", "Cập nhật đoạn": "O(log N) (hai BIT, chỉ cho tổng)", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Tìm vị trí thứ k O(log N); chỉ phép có nghịch đảo (tổng, xor); mở rộng 2D" },
      cards: [
        { q: "Fenwick Tree trả lời tổng tiền tố và cập nhật điểm trong bao lâu?", a: "Cả hai O(log N); bộ nhớ O(N), dựng từ mảng O(N)." },
        { q: "lowbit(i) là gì và dùng ở đâu?", a: "lowbit(i) = i & -i, bit 1 thấp nhất của i. Truy vấn: r -= lowbit(r); cập nhật: i += lowbit(i)." },
        { q: "Vì sao Fenwick không dùng được cho min / max đoạn?", a: "Nó dựa trên phép trừ: prefix(r) − prefix(l). Min / max không có nghịch đảo nên không tách đoạn từ hai tiền tố." },
        { q: "Làm sao cập nhật đoạn và tổng đoạn bằng Fenwick?", a: "Dùng hai BIT trên mảng hiệu d: B1 lưu d[i], B2 lưu d[i]·i; tổng tiền tố x = x·B1(x) − B2(x)." },
        { q: "Tìm phần tử thứ k bằng Fenwick như thế nào?", a: "Đi xuống nhị phân từ bit cao nhất: nếu t[pos + 2^j] < x thì nhảy tới đó và trừ x. Chỉ đúng khi giá trị không âm; O(log N)." }
      ]
    },

    {
      id: "segment-tree",
      name: "Segment Tree",
      aliases: ["segment tree", "cây phân đoạn", "interval tree", "cây đoạn", "range minimum query động", "rmq động", "iterative segment tree", "bottom up segment tree", "cây quản lý đoạn"],
      category: "ds",
      sub: "Cây truy vấn đoạn",
      level: 3,
      tags: ["segment-tree", "range-query", "point-update", "monoid", "data-structure"],
      summary: "Cây nhị phân trên các đoạn: cập nhật điểm và truy vấn đoạn cho mọi phép gộp có tính kết hợp (tổng, min, max, gcd…) đều O(log N).",
      description:
        "Mỗi nút lưu kết quả gộp của một đoạn; nút cha gộp từ hai con. **Cập nhật điểm**: ghi vào lá rồi tính lại các nút tổ tiên (log N nút). **Truy vấn đoạn** `[l, r)`: tách đoạn thành tối đa O(log N) nút trọn vẹn rồi gộp. Cây dùng mảng `2N` phần tử, lá nằm ở `[N, 2N)`, nút `i` có hai con `2i` và `2i+1` — cài đặt bottom-up không đệ quy, ngắn và nhanh.\n\n" +
        "Phép gộp chỉ cần **tính kết hợp** và có **phần tử đơn vị** (monoid): tổng (đơn vị 0), min (đơn vị +∞), max, gcd, xor, tích ma trận, hay một bộ (tổng, tiền tố lớn nhất, hậu tố lớn nhất, đoạn con lớn nhất) cho bài đoạn con có tổng lớn nhất. **Không** cần giao hoán: mẫu giữ riêng kết quả bên trái và bên phải nên đúng cả cho nối xâu, nhân ma trận.\n\n" +
        "Muốn cập nhật cả đoạn thì cần bản **lười** (xem Lazy Propagation). Muốn “tìm vị trí đầu tiên thoả điều kiện” (ví dụ phần tử đầu tiên ≥ x trên cây max) thì dùng bản đệ quy / đi xuống từ gốc, mỗi bước chọn con trái hay phải nhờ giá trị lưu ở nút — cũng O(log N).",
      conditions: ["Phép gộp có tính kết hợp và có phần tử đơn vị (monoid)", "Cập nhật là thay một phần tử; cập nhật đoạn cần bản lười"],
      complexity: { time: "O(log N) mỗi thao tác; dựng O(N)", space: "O(N)", note: "Bottom-up: đúng 2N phần tử. Bản đệ quy thường dùng 4N." },
      ops: [["Dựng cây", "O(N)"], ["Cập nhật điểm", "O(log N)"], ["Truy vấn đoạn", "O(log N)"], ["Đi xuống tìm vị trí đầu tiên thoả điều kiện", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Min / max / tổng / gcd đoạn với cập nhật điểm xen kẽ", "Đoạn con có tổng lớn nhất trong một đoạn (bộ bốn giá trị)", "Tìm vị trí đầu tiên có giá trị ≥ x (đặt chỗ, khách sạn) bằng đi xuống cây", "Nền tảng của lazy segment tree, merge sort tree, segment tree trên thời gian"],
      not_for: ["Chỉ cần tổng với cập nhật điểm → Fenwick Tree (ngắn và nhanh hơn)", "Mảng tĩnh, chỉ min / max → Sparse Table (truy vấn O(1))", "Cập nhật cả đoạn → Segment Tree lười", "Không có cập nhật, chỉ tổng → Prefix Sum"],
      pitfalls: [
        "Phần tử đơn vị sai: min cần +∞ (LLONG_MAX), max cần −∞, tổng cần 0. Cộng thêm vào +∞ rồi dễ tràn — chỉ so sánh, không cộng.",
        "Không dùng t[1] làm kết quả của cả mảng khi N không phải luỹ thừa 2 (thứ tự gộp trong nút đó bị trộn, sai với phép không giao hoán): luôn gọi query(0, n).",
        "Lẫn đoạn đóng [l, r] và nửa mở [l, r): mẫu này dùng nửa mở, đổi sang đóng chỉ cần query(l, r + 1).",
        "Gộp theo thứ tự với phép không giao hoán: kết quả bên trái phải ở bên trái (mẫu giữ left, right riêng).",
        "CTAD của C++17 đòi vector<T> và đơn vị cùng kiểu: SegTree(vector<long long>, 0LL, ...) chứ không phải 0."
      ],
      code: {
        lang: "cpp", title: "segment_tree.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Segment Tree bottom-up tổng quát. T = kiểu nút, op(a, b) = phép gộp KẾT HỢP (không cần giao hoán), id = phần tử đơn vị.
// Chỉ số 0-based; truy vấn nửa mở [l, r). Cập nhật điểm / truy vấn O(log N), bộ nhớ 2N.
//   Tổng: SegTree st(a, 0LL, [](long long x, long long y) { return x + y; });         // a là vector<long long>
//   Min : SegTree st(a, LLONG_MAX, [](long long x, long long y) { return min(x, y); });
template <class T, class Op>
struct SegTree {
    int n;
    T id;
    Op op;
    vector<T> t;                                 // lá nằm ở [n, 2n); nút i có hai con 2i và 2i+1
    SegTree(const vector<T>& a, T id, Op op) : n(a.size()), id(id), op(op), t(2 * a.size(), id) {
        for (int i = 0; i < n; i++) t[n + i] = a[i];
        for (int i = n - 1; i >= 1; i--) t[i] = op(t[2 * i], t[2 * i + 1]);
    }
    void set(int i, T v) {                       // a[i] = v
        for (t[i += n] = v; i > 1; i >>= 1) t[i >> 1] = op(t[i & ~1], t[i | 1]);
    }
    T get(int i) const { return t[i + n]; }
    T query(int l, int r) const {                // gộp a[l], a[l+1], ..., a[r-1] theo đúng thứ tự (r <= l -> id)
        T left = id, right = id;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if (l & 1) left = op(left, t[l++]);
            if (r & 1) right = op(t[--r], right);
        }
        return op(left, right);
    }
};
`
      },
      example: {
        input: "6\n5 2 8 1 9 3\nmin 1 5\nset 3 10\nmin 1 5\nsum 0 6",
        output: "1\n2\n37",
        explain: "Mảng a = [5, 2, 8, 1, 9, 3] (0-based, đoạn nửa mở). min 1 5 là min của a[1..4] = min(2, 8, 1, 9) = 1. Sau set 3 10, mảng là [5, 2, 8, 10, 9, 3] nên min 1 5 = min(2, 8, 10, 9) = 2. sum 0 6 = 5+2+8+10+9+3 = 37."
      },
      problems: [
        { site: "cses", id: "1649", name: "Dynamic Range Minimum Queries" },
        { site: "cses", id: "1143", name: "Hotel Queries" },
        { site: "cses", id: "1190", name: "Subarray Sum Queries" },
        { site: "cses", id: "2166", name: "Prefix Sum Queries" },
        { site: "cses", id: "2206", name: "Pizzeria Queries" }
      ],
      related: ["fenwick-tree", "lazy-segment-tree", "sparse-table", "sqrt-decomposition", "hld", "monotonic-stack"],
      compare: { "Truy vấn": "O(log N) (mọi phép kết hợp)", "Cập nhật điểm": "O(log N)", "Cập nhật đoạn": "O(N) nếu không lười (xem Lazy Segment Tree)", "Bộ nhớ": "O(N) (2N)", "Hỗ trợ thêm": "Đi xuống tìm vị trí đầu tiên thoả điều kiện; phép không giao hoán" },
      cards: [
        { q: "Segment Tree cập nhật điểm và truy vấn đoạn tốn bao nhiêu?", a: "Cả hai O(log N); dựng O(N); bộ nhớ O(N) (2N bottom-up, 4N đệ quy)." },
        { q: "Phép gộp của Segment Tree cần tính chất gì?", a: "Tính kết hợp và có phần tử đơn vị (monoid). Không cần giao hoán nếu giữ thứ tự trái – phải khi gộp." },
        { q: "Khi nào chọn Fenwick thay Segment Tree?", a: "Khi chỉ cần tổng (hoặc xor) với cập nhật điểm: Fenwick ngắn hơn, nhanh hơn. Min / max / phép tuỳ ý thì cần Segment Tree." },
        { q: "Bài đoạn con có tổng lớn nhất trong một đoạn lưu gì ở mỗi nút?", a: "Bốn giá trị: tổng cả đoạn, tiền tố lớn nhất, hậu tố lớn nhất, đoạn con lớn nhất; gộp hai con theo công thức kết hợp." },
        { q: "Phần tử đơn vị của min, max, tổng lần lượt là gì?", a: "+∞ (LLONG_MAX), −∞ (LLONG_MIN), 0." }
      ]
    },

    {
      id: "lazy-segment-tree",
      name: "Segment Tree lười (Lazy Propagation)",
      aliases: ["lazy segment tree", "lazy propagation", "segment tree lười", "cập nhật đoạn", "range update range query", "range add range sum", "range assign", "cộng đoạn tổng đoạn"],
      category: "ds",
      sub: "Cây truy vấn đoạn",
      level: 4,
      tags: ["segment-tree", "lazy-propagation", "range-update", "range-query", "data-structure"],
      summary: "Segment Tree hoãn việc áp cập nhật đoạn xuống các nút con: cộng / gán trên đoạn rồi hỏi tổng hay min đoạn, mọi thao tác O(log N).",
      description:
        "Mỗi nút lưu kết quả gộp cho đoạn của nó **và** một nhãn “lười” (cập nhật chưa chuyển xuống con). Khi cập nhật đoạn `[l, r)`, nút nào nằm trọn trong đoạn chỉ cần áp nhãn lên giá trị của chính nó (ví dụ `sum += v · độ_dài`) và ghi nhãn, **không** đi xuống tiếp. Chỉ khi phải đi xuống một nút có nhãn mới đẩy nhãn (push) cho hai con trước, và sau khi quay lên thì tính lại nút (pull).\n\n" +
        "Điều kiện để dùng: (1) áp một nhãn lên giá trị tổng hợp của nút tính được trong O(1) chỉ biết độ dài đoạn; (2) hai nhãn **hợp nhất** được thành một nhãn (kết hợp). Mẫu bên dưới hỗ trợ cả **cộng đoạn** lẫn **gán đoạn**, trả về **tổng đoạn** và **min đoạn**: gán xoá mọi nhãn cộng trước đó, còn cộng sau khi gán gộp vào giá trị gán (`setVal += v`). Cờ `hasSet` riêng biệt vì giá trị gán 0 vẫn hợp lệ nên không thể dùng 0 làm “không có nhãn”.\n\n" +
        "Cập nhật đoạn + tổng đoạn chỉ với phép cộng còn làm được bằng hai Fenwick (nhẹ hơn nhiều). Lazy cần thiết khi có gán, nhân, hoặc min / max kèm cộng.",
      conditions: ["Nhãn áp lên nút trong O(1) và hai nhãn hợp nhất thành một (có tính kết hợp)", "Cập nhật trên đoạn xen kẽ truy vấn trên đoạn (online)"],
      complexity: { time: "O(log N) mỗi thao tác; dựng O(N)", space: "O(N)", note: "Mẫu đệ quy dùng khoảng 2·2^⌈log2 N⌉ nút, mỗi nút 40 byte." },
      ops: [["Dựng cây", "O(N)"], ["Cộng đoạn", "O(log N)"], ["Gán đoạn", "O(log N)"], ["Tổng / min đoạn", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Cộng / gán trên đoạn rồi hỏi tổng hoặc min của đoạn", "Cập nhật đoạn với phép không có nghịch đảo (gán, max theo đoạn)", "Bài nhiều loại cập nhật đoạn trộn lẫn (cộng, nhân, gán) với nhãn hợp nhất được", "Cộng cấp số cộng lên đoạn (nhãn gồm hai tham số) rồi hỏi tổng đoạn"],
      not_for: ["Chỉ cần cập nhật đoạn + tổng đoạn bằng phép cộng → Fenwick Tree (hai BIT)", "Cập nhật đoạn offline rồi đọc cuối → Mảng hiệu", "Cập nhật điểm + truy vấn đoạn → Segment Tree thường (không cần lười)"],
      pitfalls: [
        "Quên push trước khi đi xuống con (lỗi hay gặp nhất): giá trị con sai vì còn nhãn của cha chưa áp.",
        "Quên pull sau khi cập nhật con: nút cha giữ giá trị cũ.",
        "Thứ tự hợp nhất nhãn: gán rồi cộng thì ra giá trị gán + cộng; cộng rồi gán thì gán thắng hết. Không dùng một giá trị đặc biệt làm “chưa gán” nếu giá trị đó hợp lệ.",
        "Cập nhật trên nút trọn đoạn phải nhân với độ dài đoạn của NÚT, không phải độ dài đoạn cập nhật.",
        "Tràn int: sum += v · len cần long long; mảng nút 4N phần tử lớn dễ vượt bộ nhớ khi N ~ 10⁶."
      ],
      code: {
        lang: "cpp", title: "lazy_segment_tree.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Segment Tree lười: cộng đoạn, gán đoạn, tổng đoạn, min đoạn — mỗi thao tác O(log N). 0-based, đoạn nửa mở [l, r).
// Mỗi nút giữ sum, mn của đoạn nút và nhãn chờ: hasSet (gán cả đoạn = setVal) hoặc add (cộng chờ).
// Quy ước: khi hasSet = true thì add luôn = 0 (phép cộng đến sau được gộp vào setVal).
struct LazySegTree {
    struct Node {
        long long sum = 0, mn = 0, add = 0, setVal = 0;
        bool hasSet = false;
    };
    int n;
    vector<Node> t;
    explicit LazySegTree(const vector<long long>& a) : n(a.size()) {
        int sz = 1;
        while (sz < n) sz <<= 1;
        t.assign(2 * sz, Node());                // chỉ số nút luôn < 2 * sz
        if (n) build(1, 0, n, a);
    }
    void pull(int x) {
        t[x].sum = t[2 * x].sum + t[2 * x + 1].sum;
        t[x].mn = min(t[2 * x].mn, t[2 * x + 1].mn);
    }
    void applySet(int x, int len, long long v) {
        t[x].sum = v * len; t[x].mn = v;
        t[x].hasSet = true; t[x].setVal = v; t[x].add = 0;
    }
    void applyAdd(int x, int len, long long v) {
        t[x].sum += v * len; t[x].mn += v;
        if (t[x].hasSet) t[x].setVal += v; else t[x].add += v;
    }
    void push(int x, int lo, int hi) {           // đẩy nhãn của x xuống hai con
        int mid = (lo + hi) / 2;
        if (t[x].hasSet) {
            applySet(2 * x, mid - lo, t[x].setVal);
            applySet(2 * x + 1, hi - mid, t[x].setVal);
            t[x].hasSet = false;
        }
        if (t[x].add) {
            applyAdd(2 * x, mid - lo, t[x].add);
            applyAdd(2 * x + 1, hi - mid, t[x].add);
            t[x].add = 0;
        }
    }
    void build(int x, int lo, int hi, const vector<long long>& a) {
        if (hi - lo == 1) { t[x].sum = t[x].mn = a[lo]; return; }
        int mid = (lo + hi) / 2;
        build(2 * x, lo, mid, a);
        build(2 * x + 1, mid, hi, a);
        pull(x);
    }
    void update(int x, int lo, int hi, int l, int r, long long v, bool isSet) {
        if (r <= lo || hi <= l) return;
        if (l <= lo && hi <= r) {
            if (isSet) applySet(x, hi - lo, v); else applyAdd(x, hi - lo, v);
            return;
        }
        push(x, lo, hi);
        int mid = (lo + hi) / 2;
        update(2 * x, lo, mid, l, r, v, isSet);
        update(2 * x + 1, mid, hi, l, r, v, isSet);
        pull(x);
    }
    pair<long long, long long> query(int x, int lo, int hi, int l, int r) {   // (tổng, min) trên [l, r) ∩ [lo, hi)
        if (r <= lo || hi <= l) return {0, LLONG_MAX};
        if (l <= lo && hi <= r) return {t[x].sum, t[x].mn};
        push(x, lo, hi);
        int mid = (lo + hi) / 2;
        auto L = query(2 * x, lo, mid, l, r), R = query(2 * x + 1, mid, hi, l, r);
        return {L.first + R.first, min(L.second, R.second)};
    }
    void add(int l, int r, long long v) { if (l < r) update(1, 0, n, l, r, v, false); }
    void assign(int l, int r, long long v) { if (l < r) update(1, 0, n, l, r, v, true); }
    long long sum(int l, int r) { return l < r ? query(1, 0, n, l, r).first : 0; }
    long long minimum(int l, int r) { return l < r ? query(1, 0, n, l, r).second : LLONG_MAX; }
};
`
      },
      example: {
        input: "5\n1 2 3 4 5\nadd 1 4 10\nsum 0 3\nassign 2 5 0\nsum 0 5\nmin 0 5",
        output: "26\n13\n0",
        explain: "Mảng [1, 2, 3, 4, 5]. add 1 4 10 → [1, 12, 13, 14, 5]; sum 0 3 = 1+12+13 = 26. assign 2 5 0 → [1, 12, 0, 0, 0]; sum 0 5 = 13; min 0 5 = 0."
      },
      problems: [
        { site: "cses", id: "1735", name: "Range Updates and Sums" },
        { site: "cses", id: "1736", name: "Polynomial Queries" },
        { site: "cf", id: "52C", name: "Circular RMQ" },
        { site: "spoj", name: "Horrible Queries" }
      ],
      related: ["segment-tree", "fenwick-tree", "difference-array", "sqrt-decomposition", "hld"],
      compare: { "Truy vấn": "O(log N)", "Cập nhật điểm": "O(log N)", "Cập nhật đoạn": "O(log N) (cộng, gán, ...)", "Bộ nhớ": "O(N) (khoảng 2–4N nút, mỗi nút thêm nhãn)", "Hỗ trợ thêm": "Cộng / gán đoạn + tổng / min đoạn; cần nhãn hợp nhất được" },
      cards: [
        { q: "Ý tưởng của lazy propagation?", a: "Cập nhật đoạn chỉ áp lên các nút trọn đoạn và ghi nhãn chờ; nhãn được đẩy xuống con (push) chỉ khi phải đi xuống nút đó. Nhờ vậy mỗi cập nhật đoạn là O(log N)." },
        { q: "Lazy cần hai điều kiện gì về nhãn?", a: "Áp một nhãn lên giá trị tổng hợp của nút tính được trong O(1) (biết độ dài đoạn), và hai nhãn hợp nhất được thành một nhãn." },
        { q: "Gán đoạn rồi cộng đoạn thì nhãn hợp nhất thế nào?", a: "Giá trị gán tăng thêm v (setVal += v). Ngược lại, cộng rồi gán thì gán thắng và xoá nhãn cộng." },
        { q: "Hai bug hay gặp nhất của lazy segment tree?", a: "Quên push trước khi đi xuống con, và quên pull sau khi cập nhật con." }
      ]
    },

    {
      id: "sqrt-decomposition",
      name: "Sqrt Decomposition",
      aliases: ["sqrt decomposition", "phân rã căn", "chia khối", "block decomposition", "chia căn bậc hai", "sqrt blocks", "căn N"],
      category: "ds",
      sub: "Cây truy vấn đoạn",
      level: 3,
      tags: ["sqrt-decomposition", "blocks", "range-query", "range-update", "data-structure"],
      summary: "Chia mảng thành các khối cỡ √N, mỗi khối giữ thông tin tóm tắt: truy vấn và cập nhật đoạn O(√N) cho cả những thao tác Segment Tree khó gộp.",
      description:
        "Chia mảng N phần tử thành khoảng `N/B` khối, mỗi khối `B ≈ √N` phần tử, và giữ một **bản tóm tắt** cho từng khối (tổng, min, bản đã sắp xếp, bảng đếm…). Một thao tác trên đoạn `[l, r)` gồm hai phần: các khối **nằm trọn** trong đoạn dùng bản tóm tắt (và nhãn lười) trong O(1) hoặc O(log B) mỗi khối; hai khối **lẻ** ở hai đầu xử lý trực tiếp từng phần tử rồi dựng lại bản tóm tắt. Tổng khoảng O(√N) đến O(√N log N).\n\n" +
        "Điểm mạnh là **tính linh hoạt**: miễn là bản tóm tắt của khối dựng lại được trong thời gian vừa phải, bạn đếm được những thứ rất khó gộp trong Segment Tree. Mẫu bên dưới giữ mỗi khối một bản sao đã **sắp xếp** nên trả lời được “có bao nhiêu phần tử ≥ x trong đoạn” cùng với cộng đoạn và tổng đoạn — Segment Tree thông thường không làm được kết hợp này.\n\n" +
        "Chọn `B ≈ √N` làm hai nhóm chi phí cân bằng; thực tế nên đo để chỉnh hệ số (thường B nhỏ hơn √N khi mỗi khối lẻ phải sắp xếp lại). Cùng tư tưởng xuất hiện ở thuật toán Mo (chia truy vấn theo khối) và kỹ thuật “dựng lại sau mỗi √Q cập nhật”.",
      conditions: ["Mỗi khối có bản tóm tắt dựng lại được nhanh (O(B) hoặc O(B log B)) sau khi sửa phần tử lẻ", "N, Q cỡ 10⁵ trở xuống để O(Q·√N) kịp thời gian (thường vài giây)"],
      complexity: { time: "O(√N) đến O(√N log N) mỗi thao tác", space: "O(N)", note: "Mẫu này: sum O(√N); add và countGE O(√N log N) (sắp xếp lại khối lẻ, tìm nhị phân mỗi khối trọn). Dựng O(N log N)." },
      ops: [["Dựng", "O(N log N)"], ["Tổng đoạn", "O(√N)"], ["Cộng đoạn", "O(√N log N)"], ["Đếm phần tử ≥ x trong đoạn", "O(√N log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Đếm phần tử ≥ x (hoặc < x) trong đoạn với cập nhật cộng đoạn xen kẽ", "Bài mà phép gộp / nhãn khó cài trong Segment Tree nhưng dựng lại một khối thì dễ", "Chèn / xoá phần tử ở giữa dãy bằng cách giữ mỗi khối là một deque, dựng lại toàn bộ sau √Q thao tác", "Nền tảng hiểu thuật toán Mo và các thủ thuật chia khối"],
      not_for: ["Truy vấn tổng / min đoạn với cập nhật điểm đơn thuần → Fenwick / Segment Tree (O(log N), nhanh hơn)", "Dữ liệu lớn N, Q ~ 10⁶ → các cấu trúc O(log N)", "Mảng tĩnh chỉ cần min / max → Sparse Table"],
      pitfalls: [
        "Khối lẻ ở hai đầu xử lý lại sai khi l và r nằm trong CÙNG một khối: phải tách trường hợp, mẫu xử lý bằng đoạn con [max(l, lo), min(r, hi)).",
        "Quên cộng nhãn lười của khối khi đọc một phần tử lẻ (a[k] + lazy[b]), hoặc quên trừ nhãn khi so với x trong khối trọn (tìm x − lazy[b]).",
        "Quên sắp xếp lại bản sao của khối sau khi sửa phần tử lẻ: countGE trên khối trọn sẽ sai.",
        "Chia khối làm tròn sai: số khối là (N + B − 1) / B, khối cuối có thể ngắn hơn B.",
        "Chọn B quá nhỏ hay quá lớn làm chậm hẳn; B = 1 hoặc B = N biến thành vét cạn."
      ],
      code: {
        lang: "cpp", title: "sqrt_decomposition.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Sqrt decomposition trên đoạn [l, r) (0-based). Mảng chia thành các khối kích thước B ~ sqrt(N).
//   add(l, r, v)      cộng v vào mọi phần tử của đoạn
//   sum(l, r)         tổng của đoạn
//   countGE(l, r, x)  số phần tử >= x trong đoạn
// Mỗi khối giữ: lazy (cộng chờ), bsum (tổng thật của khối), sorted (bản sao đã sắp xếp, chưa gồm lazy).
// Khối trọn đoạn: O(1) cho add / sum, O(log B) cho countGE. Khối lẻ: duyệt trực tiếp (add còn sắp xếp lại, O(B log B)).
struct SqrtDecomp {
    int n, B, nb;
    vector<long long> a, lazy, bsum;             // a[i] chưa gồm lazy của khối chứa i
    vector<vector<long long>> sorted;
    explicit SqrtDecomp(const vector<long long>& init)
        : n(init.size()), B(max(1, (int)sqrt((double)init.size()))), nb((n + B - 1) / B),
          a(init), lazy(nb, 0), bsum(nb, 0), sorted(nb) {
        for (int b = 0; b < nb; b++) {
            int lo = b * B, hi = min(n, lo + B);
            for (int i = lo; i < hi; i++) bsum[b] += a[i];
            resort(b);
        }
    }
    void resort(int b) {
        sorted[b].assign(a.begin() + b * B, a.begin() + min(n, (b + 1) * B));
        sort(sorted[b].begin(), sorted[b].end());
    }
    // Duyệt các khối giao với [l, r): full(b, độ_dài) cho khối trọn, part(b, i, j) cho khối lẻ (đoạn con [i, j) của khối b).
    template <class Full, class Part>
    void walk(int l, int r, Full full, Part part) {
        if (l >= r) return;
        for (int b = l / B; b <= (r - 1) / B; b++) {
            int lo = b * B, hi = min(n, lo + B);
            if (l <= lo && hi <= r) full(b, hi - lo);
            else part(b, max(l, lo), min(r, hi));
        }
    }
    void add(int l, int r, long long v) {
        walk(l, r,
            [&](int b, int len) { lazy[b] += v; bsum[b] += v * len; },
            [&](int b, int i, int j) {
                for (int k = i; k < j; k++) a[k] += v;
                bsum[b] += v * (j - i);
                resort(b);
            });
    }
    long long sum(int l, int r) {
        long long s = 0;
        walk(l, r,
            [&](int b, int) { s += bsum[b]; },
            [&](int b, int i, int j) { for (int k = i; k < j; k++) s += a[k] + lazy[b]; });
        return s;
    }
    int countGE(int l, int r, long long x) {
        int c = 0;
        walk(l, r,
            [&](int b, int len) {
                c += len - (int)(lower_bound(sorted[b].begin(), sorted[b].end(), x - lazy[b]) - sorted[b].begin());
            },
            [&](int b, int i, int j) { for (int k = i; k < j; k++) c += (a[k] + lazy[b] >= x); });
        return c;
    }
};
`
      },
      example: {
        input: "5\n5 1 4 2 3\nadd 1 4 10\nsum 0 3\ncountGE 0 5 12",
        output: "30\n2",
        explain: "Mảng [5, 1, 4, 2, 3]. add 1 4 10 → [5, 11, 14, 12, 3]. sum 0 3 = 5+11+14 = 30. countGE 0 5 12 đếm các phần tử ≥ 12 là 14 và 12 → 2."
      },
      problems: [
        { site: "cf", id: "13E", name: "Holes" },
        { site: "cf", id: "455D", name: "Serega and Fun" }
      ],
      related: ["segment-tree", "lazy-segment-tree", "fenwick-tree", "mo-algorithm", "sparse-table"],
      compare: { "Truy vấn": "O(√N) (đến O(√N log N))", "Cập nhật điểm": "O(√N) hoặc O(B)", "Cập nhật đoạn": "O(√N) (đến O(√N log N))", "Bộ nhớ": "O(N)", "Hỗ trợ thêm": "Linh hoạt: mỗi khối giữ thông tin tuỳ ý (sắp xếp, đếm); đếm ≥ x kèm cộng đoạn" },
      cards: [
        { q: "Ý tưởng sqrt decomposition?", a: "Chia mảng thành các khối cỡ √N, giữ bản tóm tắt cho mỗi khối. Khối trọn đoạn dùng bản tóm tắt, hai khối lẻ ở đầu xử lý từng phần tử; mỗi thao tác O(√N)." },
        { q: "Khi nào chọn sqrt decomposition thay Segment Tree?", a: "Khi bản tóm tắt của khối dựng lại được dễ nhưng phép gộp / nhãn khó cài trong Segment Tree (ví dụ đếm phần tử ≥ x kèm cộng đoạn), hoặc để cài nhanh khi ràng buộc đủ rộng." },
        { q: "Kích thước khối tối ưu?", a: "Khoảng √N để cân bằng chi phí khối trọn (N/B) và khối lẻ (B); thực tế đo để chỉnh hệ số khi khối lẻ phải sắp xếp lại." },
        { q: "Lỗi thường gặp khi đọc phần tử lẻ có nhãn lười?", a: "Quên cộng lazy[b] vào a[k] (hoặc quên trừ lazy khi so sánh với x trên bản sắp xếp của khối)." }
      ]
    },

    /* ============================== Cây nhị phân tìm kiếm cân bằng ============================== */
    {
      id: "treap",
      name: "Treap",
      aliases: ["treap", "cây treap", "cartesian tree ngẫu nhiên", "implicit treap", "treap ẩn", "split merge", "cây nhị phân cân bằng", "randomized bst", "rope", "đảo đoạn", "cắt dán đoạn"],
      category: "ds",
      sub: "Cây nhị phân tìm kiếm cân bằng",
      level: 4,
      tags: ["treap", "bst", "randomized", "split-merge", "sequence"],
      summary: "Cây nhị phân tìm kiếm cân bằng ngẫu nhiên bằng split / merge: tập có thứ tự, phần tử thứ k, và (bản ẩn) chèn / xoá / đảo đoạn trên dãy.",
      description:
        "Treap là cây nhị phân thoả đồng thời hai tính chất: **BST theo khoá** và **heap theo độ ưu tiên** gán ngẫu nhiên. Vì độ ưu tiên ngẫu nhiên nên hình dạng cây cũng như một BST dựng từ dãy ngẫu nhiên: độ sâu kỳ vọng O(log N). Mọi thao tác đều dựng trên hai phép cơ bản: **split(t, k)** tách cây thành hai cây (khoá < k và còn lại) và **merge(a, b)** nối hai cây khi mọi khoá của a nhỏ hơn mọi khoá của b, chọn gốc theo độ ưu tiên.\n\n" +
        "Chèn = split rồi merge ba phần; xoá = split ra phần khoá bằng, bỏ gốc rồi merge lại. Mỗi nút giữ thêm **kích thước cây con** để đếm số khoá nhỏ hơn và tìm phần tử thứ k. Mẫu thứ nhất là multiset có thứ tự theo khoá.\n\n" +
        "**Treap ẩn (implicit treap)** bỏ khoá, vị trí của một nút suy ra từ kích thước cây con. Khi đó split theo *số phần tử* cho phép chèn / xoá ở vị trí bất kỳ, cắt một đoạn rồi dán sang chỗ khác, và **đảo ngược đoạn** bằng cờ lười (đổi chỗ hai con khi đẩy cờ xuống). Đó là chỗ Treap thắng pb_ds và Segment Tree. Mẫu thứ hai cài đặt đúng điều này.",
      conditions: ["Độ ưu tiên phải ngẫu nhiên (mt19937) để cây cân bằng kỳ vọng", "Cần thao tác tách / nối dãy hoặc khoá tuỳ ý mà std::set / pb_ds không hỗ trợ"],
      complexity: { time: "O(log N) kỳ vọng mỗi thao tác", space: "O(N)", note: "Kỳ vọng theo độ ưu tiên ngẫu nhiên; không đảm bảo xấu nhất. Hằng số lớn hơn Fenwick / Segment Tree." },
      ops: [["Chèn / xoá theo khoá", "O(log N) kỳ vọng"], ["Đếm khoá nhỏ hơn, phần tử thứ k", "O(log N) kỳ vọng"], ["Split / merge", "O(log N) kỳ vọng"], ["Treap ẩn: chèn / xoá / đảo đoạn", "O(log N) kỳ vọng"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Chèn / xoá phần tử ở vị trí tuỳ ý trong dãy, truy cập theo chỉ số", "Cắt một đoạn rồi dán sang vị trí khác; đảo ngược đoạn", "Multiset có thứ tự kèm đếm số nhỏ hơn và phần tử thứ k khi không dùng được pb_ds", "Cài đặt thủ công khi môi trường không phải GCC (không có pb_ds)"],
      not_for: ["Chỉ cần thứ tự và phần tử thứ k trên GCC → Ordered Set (pb_ds) nhanh hơn và ngắn hơn", "Tổng / min đoạn với cập nhật điểm → Fenwick / Segment Tree", "Dãy ít thay đổi cấu trúc, chỉ đọc → mảng thường"],
      pitfalls: [
        "Dùng rand() có RAND_MAX nhỏ (32767 trên Windows) hay độ ưu tiên cố định làm cây mất cân bằng — dùng mt19937 (hoặc mt19937_64).",
        "Quên cập nhật kích thước cây con (pull) sau split / merge, hoặc quên đẩy cờ đảo (push) trước khi đọc con của một nút — kết quả sai âm thầm.",
        "Mẫu không thu hồi nút đã xoá nên bộ nhớ tăng theo tổng số lần chèn; với rất nhiều thao tác cần tái dùng nút.",
        "Xoá theo khoá dùng split(k + 1): cần k < LLONG_MAX, và chỉ xoá MỘT bản sao (multiset).",
        "Phân biệt split theo khoá (< k, ≥ k) với split theo số phần tử (k phần tử đầu) — hai hàm khác nhau cho hai loại treap."
      ],
      code: {
        lang: "cpp", title: "treap.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// (1) Treap theo khoá: multiset có thứ tự; đếm số khoá < k và lấy khoá nhỏ thứ k. Kỳ vọng O(log N) mỗi thao tác.
// Nút 0 là nút rỗng (sz = 0). Nút bị xoá không được thu hồi (bộ nhớ tăng theo số lần insert).
struct Treap {
    struct Node { int l = 0, r = 0, sz = 1; unsigned pri = 0; long long key = 0; };
    vector<Node> t;
    int root = 0;
    mt19937 rng;
    Treap() : t(1), rng(712367) { t[0].sz = 0; }
    int size() const { return t[root].sz; }
    void pull(int x) { t[x].sz = t[t[x].l].sz + t[t[x].r].sz + 1; }
    void split(int x, long long k, int& a, int& b) {          // a: các khoá < k, b: các khoá >= k
        if (!x) { a = b = 0; return; }
        if (t[x].key < k) { a = x; split(t[x].r, k, t[x].r, b); }
        else { b = x; split(t[x].l, k, a, t[x].l); }
        pull(x);
    }
    int merge(int a, int b) {                                 // mọi khoá của a <= mọi khoá của b
        if (!a || !b) return a ^ b;
        if (t[a].pri > t[b].pri) { t[a].r = merge(t[a].r, b); pull(a); return a; }
        t[b].l = merge(a, t[b].l); pull(b); return b;
    }
    void insert(long long k) {
        t.push_back(Node());
        int x = t.size() - 1;
        t[x].key = k; t[x].pri = rng();
        int a, b;
        split(root, k, a, b);
        root = merge(merge(a, x), b);
    }
    bool erase(long long k) {                                 // xoá MỘT khoá bằng k; false nếu không có. Cần k < LLONG_MAX
        int a, b, c, d;
        split(root, k, a, b);                                 // a: < k, b: >= k
        split(b, k + 1, c, d);                                // c: == k, d: > k
        bool found = c != 0;
        if (c) c = merge(t[c].l, t[c].r);                     // bỏ gốc của c (một bản sao)
        root = merge(a, merge(c, d));
        return found;
    }
    int countLess(long long k) const {                        // số khoá < k
        int x = root, res = 0;
        while (x) {
            if (t[x].key < k) { res += t[t[x].l].sz + 1; x = t[x].r; }
            else x = t[x].l;
        }
        return res;
    }
    long long kth(int i) const {                              // khoá nhỏ thứ i (0-based), 0 <= i < size()
        int x = root;
        for (;;) {
            int ls = t[t[x].l].sz;
            if (i < ls) x = t[x].l;
            else if (i == ls) return t[x].key;
            else { i -= ls + 1; x = t[x].r; }
        }
    }
};

// (2) Treap ẩn (implicit treap): một dãy phần tử, vị trí suy ra từ kích thước cây con.
// Chèn / xoá ở vị trí bất kỳ, đảo đoạn [l, r), truy cập at(i): kỳ vọng O(log N). Cờ rev là cờ lười "đảo cây con này".
struct ImplicitTreap {
    struct Node { int l = 0, r = 0, sz = 1; unsigned pri = 0; long long val = 0; bool rev = false; };
    vector<Node> t;
    int root = 0;
    mt19937 rng;
    ImplicitTreap() : t(1), rng(918273) { t[0].sz = 0; }
    int size() const { return t[root].sz; }
    void pull(int x) { t[x].sz = t[t[x].l].sz + t[t[x].r].sz + 1; }
    void push(int x) {                                        // đẩy cờ đảo xuống hai con
        if (!t[x].rev) return;
        swap(t[x].l, t[x].r);
        if (t[x].l) t[t[x].l].rev = !t[t[x].l].rev;
        if (t[x].r) t[t[x].r].rev = !t[t[x].r].rev;
        t[x].rev = false;
    }
    void split(int x, int k, int& a, int& b) {                // a: k phần tử đầu, b: phần còn lại
        if (!x) { a = b = 0; return; }
        push(x);
        if (t[t[x].l].sz < k) { a = x; split(t[x].r, k - t[t[x].l].sz - 1, t[x].r, b); }
        else { b = x; split(t[x].l, k, a, t[x].l); }
        pull(x);
    }
    int merge(int a, int b) {
        if (!a || !b) return a ^ b;
        if (t[a].pri > t[b].pri) { push(a); t[a].r = merge(t[a].r, b); pull(a); return a; }
        push(b); t[b].l = merge(a, t[b].l); pull(b); return b;
    }
    int newNode(long long v) {
        t.push_back(Node());
        int x = t.size() - 1;
        t[x].val = v; t[x].pri = rng();
        return x;
    }
    void pushBack(long long v) { root = merge(root, newNode(v)); }
    void insert(int pos, long long v) {                       // v sẽ nằm ở chỉ số pos (0 <= pos <= size())
        int x = newNode(v), a, b;
        split(root, pos, a, b);
        root = merge(merge(a, x), b);
    }
    void erase(int pos) {                                     // xoá phần tử ở chỉ số pos
        int a, b, m, c;
        split(root, pos, a, b);
        split(b, 1, m, c);
        root = merge(a, c);
    }
    void reverse(int l, int r) {                              // đảo đoạn [l, r)
        int a, b, m, c;
        split(root, l, a, b);
        split(b, r - l, m, c);
        if (m) t[m].rev = !t[m].rev;
        root = merge(a, merge(m, c));
    }
    long long at(int i) {                                     // phần tử ở chỉ số i
        int x = root;
        for (;;) {
            push(x);
            int ls = t[t[x].l].sz;
            if (i < ls) x = t[x].l;
            else if (i == ls) return t[x].val;
            else { i -= ls + 1; x = t[x].r; }
        }
    }
    void collect(int x, vector<long long>& out) {             // duyệt trung thứ tự (độ sâu kỳ vọng O(log N))
        if (!x) return;
        push(x);
        collect(t[x].l, out);
        out.push_back(t[x].val);
        collect(t[x].r, out);
    }
    vector<long long> toVector() { vector<long long> out; collect(root, out); return out; }
};
`
      },
      example: {
        input: "Treap: insert 5 3 8 3; countLess 5; kth 2; erase 3; size\nTreap ẩn: 1 2 3 4 5; reverse 1 4; erase 0",
        output: "2\n5\n3\n4 3 2 5",
        explain: "Treap theo khoá: sau khi chèn 5, 3, 8, 3 dãy sắp xếp là [3, 3, 5, 8]; countLess 5 = 2; kth 2 (0-based) = 5; erase 3 bỏ một bản sao còn [3, 5, 8] nên size = 3. Treap ẩn [1, 2, 3, 4, 5]: reverse [1, 4) đảo 2 3 4 thành 4 3 2 → [1, 4, 3, 2, 5]; erase vị trí 0 → [4, 3, 2, 5]."
      },
      problems: [
        { site: "cses", id: "2072", name: "Cut and Paste" },
        { site: "cses", id: "2073", name: "Substring Reversals" },
        { site: "cses", id: "2074", name: "Reversals and Sums" },
        { site: "cses", id: "1749", name: "List Removals" },
        { site: "cses", id: "2163", name: "Josephus Problem II" }
      ],
      related: ["ordered-set", "segment-tree", "fenwick-tree", "skip-list", "sqrt-decomposition", "heap"],
      compare: { "Truy vấn": "O(log N) kỳ vọng (đếm nhỏ hơn, phần tử thứ k)", "Cập nhật điểm": "O(log N) kỳ vọng (chèn / xoá)", "Cập nhật đoạn": "O(log N) kỳ vọng (cắt / nối / đảo đoạn với treap ẩn)", "Bộ nhớ": "O(N) (nút + con trỏ)", "Hỗ trợ thêm": "Chèn / xoá tuỳ ý, đảo đoạn, tách / ghép dãy; tự cài được không cần pb_ds" },
      cards: [
        { q: "Hai tính chất của treap?", a: "BST theo khoá và heap theo độ ưu tiên ngẫu nhiên; nhờ ngẫu nhiên nên độ sâu kỳ vọng O(log N)." },
        { q: "Hai phép cơ bản của treap?", a: "split (tách cây thành hai theo khoá hoặc theo số phần tử) và merge (nối hai cây, chọn gốc theo độ ưu tiên). Mọi thao tác khác dựng trên chúng." },
        { q: "Treap ẩn (implicit treap) khác treap thường ở đâu và mạnh ở đâu?", a: "Không lưu khoá; vị trí suy ra từ kích thước cây con nên split theo số phần tử. Mạnh ở chèn / xoá tại vị trí bất kỳ, cắt dán và đảo ngược đoạn bằng cờ lười." },
        { q: "Treap có đảm bảo O(log N) trong trường hợp xấu nhất không?", a: "Không, chỉ kỳ vọng (theo độ ưu tiên ngẫu nhiên). Cần dùng bộ sinh ngẫu nhiên tốt như mt19937." }
      ]
    },

    {
      id: "ordered-set",
      name: "Ordered Set (pb_ds)",
      aliases: ["ordered set", "pb_ds", "policy based data structure", "order of key", "find by order", "tree order statistics", "gnu pbds", "ordered multiset", "tập có thứ tự thống kê", "__gnu_pbds"],
      category: "ds",
      sub: "Cây nhị phân tìm kiếm cân bằng",
      level: 2,
      tags: ["ordered-set", "pb-ds", "gcc", "bst", "order-statistics"],
      summary: "Tập có thứ tự của GCC (pb_ds) có thêm order_of_key và find_by_order: đếm số phần tử nhỏ hơn x và lấy phần tử thứ k, mọi thao tác O(log N).",
      description:
        "`__gnu_pbds::tree` với chính sách `tree_order_statistics_node_update` là cây đỏ–đen mỗi nút lưu thêm kích thước cây con. Ngoài các thao tác như `std::set` (`insert`, `erase`, `find`, `lower_bound`) nó có hai thao tác thống kê thứ tự: **`order_of_key(x)`** — số phần tử **nhỏ hơn hẳn** `x`, và **`find_by_order(k)`** — iterator tới phần tử nhỏ thứ `k` (đếm từ 0). Cả hai O(log N).\n\n" +
        "`tree` là *tập* nên không chứa trùng. Muốn **multiset**, lưu cặp `(giá trị, số thứ tự lần chèn)` để mọi phần tử khác nhau; mẫu `OrderedMultiset` bên dưới làm đúng việc này và tìm / xoá một bản sao bằng `lower_bound({x, INT_MIN})`. Đừng dùng `less_equal` để giả lập multiset: `find`, `erase(giá trị)` và `lower_bound` sẽ cho kết quả sai.\n\n" +
        "**Chỉ có trên GCC (libstdc++)**; trình biên dịch khác (MSVC, Clang + libc++) không có `<ext/pb_ds>`. Hằng số lớn hơn một Fenwick Tree: nếu có thể nén toạ độ offline thì Fenwick nhanh hơn. Khi cần thao tác tách / nối hay đảo đoạn thì pb_ds không hỗ trợ — dùng Treap.",
      conditions: ["Dùng trình biên dịch GCC / libstdc++ (Codeforces, nhiều judge)", "Cần đếm số phần tử nhỏ hơn x hoặc lấy phần tử thứ k trong tập thay đổi liên tục (online)"],
      complexity: { time: "O(log N) mỗi thao tác", space: "O(N)", note: "Hằng số lớn hơn Fenwick / Treap tự cài; bộ nhớ mỗi nút khá nặng." },
      ops: [["Chèn / xoá", "O(log N)"], ["order_of_key (đếm < x)", "O(log N)"], ["find_by_order (phần tử thứ k)", "O(log N)"], ["lower_bound / find", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Đếm số phần tử nhỏ hơn x trong tập động (online), đếm nghịch thế", "Phần tử thứ k trong tập có thêm / xoá (Josephus, danh sách xoá phần tử)", "Median / percentile của dòng dữ liệu có xoá phần tử", "Cài nhanh trong cuộc thi, thay Treap khi chắc chắn có GCC"],
      not_for: ["Môi trường không phải GCC → Treap hoặc Fenwick tự cài", "Tách / nối / đảo đoạn dãy → Treap ẩn", "Giá trị nén được offline và chỉ cần đếm → Fenwick Tree (nhanh hơn)", "Chỉ cần thứ tự, không cần thống kê → std::set / std::multiset"],
      pitfalls: [
        "Dùng less_equal để giả lập multiset: find / erase(giá trị) / lower_bound cho kết quả sai. Dùng cặp (giá trị, id) như mẫu.",
        "find_by_order(k) khi k >= size() trả end() — giải tham chiếu là hành vi không xác định; kiểm tra k trước.",
        "order_of_key(x) đếm phần tử NHỎ HƠN HẲN x, không gồm x; muốn đếm <= x thì dùng order_of_key(x + 1) với số nguyên hoặc cặp (x, giá trị id tối đa).",
        "Chỉ biên dịch được trên GCC; nhớ ghi chú trong bài nộp và cần #include <ext/pb_ds/...> sau bits/stdc++.h.",
        "Xoá phần tử khi đang duyệt bằng iterator: lấy iterator kế tiếp trước khi erase."
      ],
      code: {
        lang: "cpp", title: "ordered_set.cpp",
        src: String.raw`#include <bits/stdc++.h>
#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>
using namespace std;
using namespace __gnu_pbds;

// CHỈ CÓ TRÊN GCC (libstdc++): MSVC và Clang + libc++ không có <ext/pb_ds>.
// Tập có thứ tự + thống kê thứ tự: insert / erase / find O(log N),
//   order_of_key(x)   = số phần tử < x
//   find_by_order(k)  = iterator tới phần tử nhỏ thứ k (0-based), hợp lệ khi k < size()
template <class T>
using OrderedSet = tree<T, null_type, less<T>, rb_tree_tag, tree_order_statistics_node_update>;

// Multiset có thứ tự: lưu cặp (giá trị, số thứ tự lần chèn) để các bản sao khác nhau. Mọi thao tác O(log N).
template <class T>
struct OrderedMultiset {
    OrderedSet<pair<T, int>> s;
    int stamp = 0;
    void insert(const T& x) { s.insert({x, stamp++}); }
    bool erase(const T& x) {                     // xoá MỘT bản sao của x; false nếu không có
        auto it = s.lower_bound({x, INT_MIN});
        if (it == s.end() || it->first != x) return false;
        s.erase(it);
        return true;
    }
    int countLess(const T& x) const { return s.order_of_key({x, INT_MIN}); }       // số phần tử < x
    int countLessEq(const T& x) const { return s.order_of_key({x, INT_MAX}); }     // số phần tử <= x
    const T& kth(int k) const { return s.find_by_order(k)->first; }                // phần tử nhỏ thứ k (0-based)
    int size() const { return s.size(); }
};
`
      },
      example: {
        input: "insert 10 20 30 20\ncountLess 20\nkth 3\ninsert 25\ncountLess 26",
        output: "1\n30\n4",
        explain: "Sau khi chèn 10, 20, 30, 20 dãy sắp xếp là [10, 20, 20, 30]: countLess 20 = 1 (chỉ có 10); kth 3 (0-based) = 30. Chèn thêm 25 được [10, 20, 20, 25, 30]; countLess 26 = 4."
      },
      problems: [
        { site: "cses", id: "2163", name: "Josephus Problem II" },
        { site: "cses", id: "1749", name: "List Removals" },
        { site: "cses", id: "1076", name: "Sliding Window Median" },
        { site: "cses", id: "1144", name: "Salary Queries" }
      ],
      related: ["treap", "fenwick-tree", "segment-tree", "skip-list", "coordinate-compression", "heap"],
      compare: { "Truy vấn": "O(log N) (phần tử thứ k, đếm nhỏ hơn)", "Cập nhật điểm": "O(log N) (chèn / xoá)", "Cập nhật đoạn": "Không hỗ trợ", "Bộ nhớ": "O(N) (hằng số lớn)", "Hỗ trợ thêm": "Chỉ trên GCC (pb_ds); multiset qua cặp (giá trị, id)" },
      cards: [
        { q: "Hai thao tác thêm của ordered set pb_ds so với std::set?", a: "order_of_key(x): số phần tử nhỏ hơn x; find_by_order(k): iterator tới phần tử nhỏ thứ k (0-based). Cả hai O(log N)." },
        { q: "Làm multiset bằng pb_ds tree thế nào?", a: "Lưu cặp (giá trị, số thứ tự lần chèn) để mọi phần tử khác nhau; tìm một bản sao bằng lower_bound({x, INT_MIN}). Không dùng less_equal vì find / erase sẽ sai." },
        { q: "Hạn chế lớn nhất của pb_ds?", a: "Chỉ có trên GCC / libstdc++ và hằng số lớn hơn Fenwick Tree; không hỗ trợ tách / nối hoặc đảo đoạn." },
        { q: "order_of_key(x) đếm phần tử nào?", a: "Chỉ những phần tử nhỏ hơn hẳn x, không tính x." }
      ]
    }
  ]);

  /* ------------------------------------------------------------------ Kịch bản Quiz ------------------------------------------------------------------ */
  A.lib.scenarios([
    { id: "q-array-prefix-sum-1",
      prompt: "Cho mảng N = 2·10⁵ số nguyên (có thể âm), cố định, không bao giờ thay đổi. Có Q = 2·10⁵ truy vấn, mỗi truy vấn hỏi tổng các phần tử trong đoạn [l, r].",
      answer: ["array-prefix-sum"], also: ["fenwick-tree", "segment-tree"], wrong: ["sparse-table", "sqrt-decomposition", "treap"],
      why: "Mảng tĩnh và phép tổng có nghịch đảo: prefix sum xây O(N) rồi mỗi truy vấn O(1). Fenwick / Segment Tree cũng đúng nhưng O(log N) và phức tạp hơn cần thiết. Sparse Table không dùng được cho tổng (không luỹ đẳng); sqrt decomposition và Treap chậm và thừa.", level: 1 },
    { id: "q-array-prefix-sum-2",
      prompt: "Cho mảng N = 2·10⁵ số nguyên có thể âm và số K ≤ 10⁹. Đếm số đoạn con liên tiếp có tổng chia hết cho K. Chỉ chạy một lần, không có cập nhật.",
      answer: ["array-prefix-sum"], also: [], wrong: ["two-pointers", "sliding-window", "monotonic-queue", "dsu"],
      why: "Đoạn (i, j] có tổng chia hết cho K khi prefix[i] và prefix[j] cùng số dư mod K: đếm số prefix theo từng số dư (bảng băm hoặc mảng) và cộng số cặp, tổng O(N). Hai con trỏ / cửa sổ trượt cần tính đơn điệu (phần tử dương) nên sai với số âm; monotonic queue và DSU không liên quan.", level: 2 },
    { id: "q-difference-array-1",
      prompt: "Có mảng N = 2·10⁵ phần tử ban đầu bằng 0. Nhận M = 2·10⁵ lệnh dạng “cộng v vào mọi phần tử trong đoạn [l, r]”. Chỉ cần in mảng cuối cùng sau khi đã đọc hết mọi lệnh; không có truy vấn xen kẽ.",
      answer: ["difference-array"], also: ["fenwick-tree", "lazy-segment-tree"], wrong: ["sparse-table", "treap", "dsu"],
      why: "Offline và chỉ cộng: mỗi lệnh chỉ đổi hai ô của mảng hiệu (O(1)), cuối cùng cộng dồn một lần O(N). Fenwick và Segment Tree lười đúng nhưng O(log N) mỗi lệnh. Sparse Table là cấu trúc tĩnh, Treap và DSU không phục vụ cập nhật đoạn.", level: 1 },
    { id: "q-difference-array-2",
      prompt: "N = 2·10⁵ khách, khách i có mặt từ thời điểm a_i đến b_i (cỡ 10⁹). Toàn bộ khoảng thời gian đã biết trước. Tìm số khách đông nhất có mặt cùng lúc.",
      answer: ["difference-array"], also: ["heap", "lazy-segment-tree"], wrong: ["monotonic-stack", "sparse-table", "dsu"],
      why: "Mỗi khách là một đoạn thời gian: đặt +1 ở lúc đến, −1 ngay sau lúc đi (mảng hiệu trên các mốc đã sắp xếp), duyệt cộng dồn và lấy max: O(N log N) do sắp xếp. Sắp xếp rồi dùng min-heap các giờ đi, hoặc segment tree lười trên toạ độ nén cũng được nhưng nặng hơn.", level: 2 },
    { id: "q-stack-1",
      prompt: "Cho xâu độ dài tới 10⁶ gồm ba loại ngoặc ( ) [ ] { }. Kiểm tra xâu có là dãy ngoặc hợp lệ hay không: mỗi ngoặc mở có ngoặc đóng cùng loại và chúng lồng nhau đúng thứ tự.",
      answer: ["stack"], also: [], wrong: ["queue", "heap", "dsu", "monotonic-stack"],
      why: "Ngoặc mở xuất hiện sau cùng phải được đóng trước tiên — đúng quy tắc vào sau ra trước, một stack giải trong O(L). Hàng đợi (FIFO) đảo thứ tự, heap không giữ thứ tự xuất hiện, DSU không biểu diễn lồng nhau, monotonic stack giải bài so sánh giá trị chứ không phải khớp ngoặc.", level: 1 },
    { id: "q-stack-2",
      prompt: "Tính giá trị của một biểu thức số học độ dài tới 10⁶ gồm số nguyên, các toán tử + - * /, dấu ngoặc với độ ưu tiên thông thường, có thể có dấu trừ đơn ngôi. Mỗi biểu thức chỉ tính một lần.",
      answer: ["stack"], also: [], wrong: ["queue", "heap", "monotonic-queue"],
      why: "Hai stack (số và toán tử): toán tử ở đỉnh có ưu tiên cao hơn hoặc bằng thì được tính trước, ')' kéo tính tới '('. Tổng O(L). Hàng đợi hay heap không biểu diễn được quan hệ lồng nhau của ngoặc, monotonic queue dành cho cửa sổ trượt.", level: 2 },
    { id: "q-queue-1",
      prompt: "N = 2·10⁵ người đứng thành vòng tròn đánh số 1..N. Bắt đầu từ người 1, lần lượt: bỏ qua một người, loại người kế tiếp, rồi tiếp tục đếm vòng quanh cho tới khi hết. In thứ tự bị loại.",
      answer: ["queue"], also: ["ordered-set"], wrong: ["stack", "heap", "sparse-table"],
      why: "Mỗi lượt đưa người bị bỏ qua xuống cuối hàng và loại người ở đầu: đúng FIFO, tổng O(N) với hàng đợi. Ordered set cũng làm được (và cần cho bước tổng quát lớn) nhưng thừa ở đây. Stack và heap không giữ thứ tự đến; Sparse Table là cấu trúc tĩnh.", level: 1 },
    { id: "q-queue-2",
      prompt: "Cần một cấu trúc chứa tối đa 10⁶ phần tử, hỗ trợ thêm / bỏ ở CẢ HAI đầu và truy cập phần tử thứ i (đếm từ 0) trong O(1) cho mỗi thao tác. Không cần tìm min / max.",
      answer: ["queue"], also: [], wrong: ["stack", "heap", "ordered-set"],
      why: "Deque (buffer vòng hai đầu) làm đúng yêu cầu: thêm / bỏ hai đầu và truy cập theo chỉ số đều O(1). Stack chỉ thao tác một đầu, heap không giữ vị trí, ordered set tốn O(log N) cho mỗi thao tác.", level: 1 },
    { id: "q-monotonic-stack-1",
      prompt: "Cho mảng N = 3·10⁵ số nguyên cố định. Với mỗi vị trí i hãy tìm vị trí j < i gần nhất sao cho a[j] < a[i] (hoặc báo không có).",
      answer: ["monotonic-stack"], also: ["segment-tree"], wrong: ["monotonic-queue", "heap", "fenwick-tree"],
      why: "Stack giữ các ứng viên có giá trị tăng dần: mỗi chỉ số vào và ra đúng một lần nên tổng O(N). Segment tree với đi xuống cũng làm được nhưng O(N log N) và dài hơn. Monotonic queue dành cho cửa sổ độ dài cố định; heap và Fenwick không cho phần tử gần nhất theo vị trí.", level: 2 },
    { id: "q-monotonic-stack-2",
      prompt: "Có N = 10⁵ cột liền nhau, cột i cao h_i (≤ 10⁹), mỗi cột rộng 1. Tìm hình chữ nhật có diện tích lớn nhất nằm trọn bên trong các cột (đáy trên trục hoành).",
      answer: ["monotonic-stack"], also: ["sparse-table", "segment-tree"], wrong: ["monotonic-queue", "heap", "queue"],
      why: "Với mỗi cột, hình chữ nhật cao h_i mở rộng sang hai bên tới cột thấp hơn đầu tiên: hai biên đó tìm cho mọi cột bằng stack đơn điệu trong O(N). Cũng làm được bằng chia để trị quanh vị trí min nhờ RMQ (Sparse Table / Segment Tree) nhưng phức tạp hơn.", level: 3 },
    { id: "q-monotonic-queue-1",
      prompt: "Cho mảng N = 10⁶ số nguyên và số K. In giá trị lớn nhất của từng cửa sổ K phần tử liên tiếp (N − K + 1 cửa sổ). Giới hạn thời gian chặt, cần thuật toán tuyến tính.",
      answer: ["monotonic-queue"], also: ["sparse-table", "segment-tree", "heap"], wrong: ["array-prefix-sum", "difference-array", "stack"],
      why: "Deque đơn điệu giữ ứng viên max của cửa sổ: mỗi phần tử vào ra một lần, tổng O(N). Sparse Table, Segment Tree hay heap xoá lười cũng đúng nhưng O(N log N) hoặc tốn bộ nhớ. Prefix sum và mảng hiệu chỉ dùng cho phép có nghịch đảo (max thì không); stack không biết phần tử nào đã rời cửa sổ.", level: 2 },
    { id: "q-monotonic-queue-2",
      prompt: "Con ếch nhảy trên N = 10⁶ ô liên tiếp; từ ô j nhảy được tới ô i nếu 0 < i − j ≤ K (K ≤ 10⁵). Đáp xuống ô i nhận điểm a[i] (có thể âm). Tính tổng điểm lớn nhất khi đi từ ô đầu tới ô cuối, biết dp[i] = a[i] + max(dp[i−K], ..., dp[i−1]).",
      answer: ["monotonic-queue"], also: ["segment-tree", "heap"], wrong: ["fenwick-tree", "array-prefix-sum", "dsu"],
      why: "Mỗi dp[i] cần max trên cửa sổ K giá trị liền trước, cửa sổ chỉ trượt về một phía: monotonic queue đưa O(N·K) xuống O(N). Segment Tree hay heap cho O(N log N), vẫn qua nhưng chậm hơn. Fenwick và prefix sum không tính được max đoạn (không có nghịch đảo).", level: 3 },
    { id: "q-heap-1",
      prompt: "Có N = 5·10⁵ thao tác trên một tập số: “thêm x” hoặc “lấy ra và in số nhỏ nhất hiện có”. Không có truy vấn nào khác.",
      answer: ["heap"], also: ["ordered-set"], wrong: ["stack", "queue", "monotonic-queue"],
      why: "Chỉ cần thêm và lấy phần tử nhỏ nhất: min-heap, mỗi thao tác O(log N). Ordered set cũng làm được nhưng thừa tính năng và chậm hơn. Stack và hàng đợi không lấy được phần tử nhỏ nhất theo giá trị; monotonic queue chỉ dùng cho cửa sổ trượt FIFO.", level: 1 },
    { id: "q-heap-2",
      prompt: "Cho K = 10⁴ dãy số đã sắp xếp tăng dần, tổng độ dài N = 10⁶. Hãy gộp chúng thành một dãy tăng dần duy nhất.",
      answer: ["heap"], also: ["sorting"], wrong: ["stack", "queue", "dsu"],
      why: "Giữ K phần tử đầu của các dãy trong một min-heap, mỗi lần lấy nhỏ nhất rồi đẩy phần tử kế của dãy đó: O(N log K). Dồn hết lại rồi sắp xếp cũng đúng nhưng O(N log N) và không tận dụng việc đã sắp xếp. Stack, hàng đợi, DSU không chọn được phần tử nhỏ nhất.", level: 2 },
    { id: "q-heap-3",
      prompt: "Dijkstra trên đồ thị 2·10⁵ đỉnh: bạn muốn cập nhật khoảng cách của một đỉnh ngay khi tìm được đường ngắn hơn và luôn lấy được đỉnh có khoảng cách nhỏ nhất, mà không để lại bản ghi cũ trong cấu trúc.",
      answer: ["heap"], also: ["ordered-set"], wrong: ["stack", "queue", "fenwick-tree"],
      why: "Cần lấy nhỏ nhất kèm giảm khoá theo id: heap có chỉ mục (decrease-key) làm O(log N) mỗi thao tác và không có bản ghi cũ. set<pair> (ordered set) cũng xoá và chèn lại được. Stack, hàng đợi, Fenwick không cho lấy nhỏ nhất.", level: 3 },
    { id: "q-dsu-1",
      prompt: "Đồ thị N = 2·10⁵ đỉnh, ban đầu không có cạnh. Lần lượt thêm M = 2·10⁵ cạnh (không bao giờ xoá). Sau mỗi lần thêm hãy in số thành phần liên thông hiện tại và kích thước thành phần lớn nhất.",
      answer: ["dsu"], also: [], wrong: ["fenwick-tree", "segment-tree", "sqrt-decomposition"],
      why: "Chỉ thêm cạnh và hỏi liên thông: DSU gộp hai tập và lưu kích thước, mỗi thao tác gần O(1). Fenwick, Segment Tree, sqrt decomposition là cấu trúc truy vấn đoạn trên mảng, không biểu diễn việc gộp các tập đỉnh.", level: 2 },
    { id: "q-dsu-2",
      prompt: "Đồ thị N = 10⁵ đỉnh, Q = 10⁵ thao tác: thêm cạnh, xoá cạnh, hoặc hỏi hai đỉnh có cùng thành phần liên thông không. Toàn bộ thao tác được biết trước (offline).",
      answer: ["dsu"], also: ["segment-tree"], wrong: ["sparse-table", "fenwick-tree", "heap"],
      why: "DSU thường không xoá được, nhưng offline mỗi cạnh tồn tại trong một khoảng thời gian: đặt cạnh vào segment tree trên trục thời gian rồi DFS cây đó với DSU có rollback (không nén đường đi), tổng O(Q log Q log N). Segment tree chỉ là phần khung, nên được chấp nhận; Sparse Table, Fenwick, heap không biểu diễn liên thông.", level: 4 },
    { id: "q-dsu-3",
      prompt: "Cho đồ thị vô hướng có trọng số, V = 10⁵ đỉnh, E = 3·10⁵ cạnh. Tìm tổng trọng số của cây khung nhỏ nhất. Bạn duyệt cạnh theo trọng số tăng dần và cần một cấu trúc để kiểm tra nhanh hai đầu cạnh đã nằm trong cùng thành phần chưa.",
      answer: ["dsu"], also: [], wrong: ["heap", "segment-tree", "stack"],
      why: "Kruskal cần “cùng thành phần?” và “gộp hai thành phần”: DSU làm cả hai gần O(1). Heap dùng cho Prim (chọn cạnh nhỏ nhất đi ra), không trả lời được truy vấn liên thông; Segment Tree và stack không biểu diễn việc gộp tập.", level: 2 },
    { id: "q-fenwick-tree-1",
      prompt: "N = 100000. Cần làm hai việc: cập nhật giá trị một phần tử và hỏi tổng tiền tố. Q = 100000 thao tác xen kẽ nhau, trả lời ngay (online).",
      answer: ["fenwick-tree"], also: ["segment-tree", "sqrt-decomposition"], wrong: ["array-prefix-sum", "sparse-table", "difference-array", "treap"],
      why: "Cập nhật điểm + tổng tiền tố online: Fenwick O(log N) mỗi thao tác, code ngắn. Segment Tree và sqrt decomposition cũng qua được nhưng nặng hơn. Prefix sum chỉ cho mảng tĩnh (cập nhật tốn O(N)); Sparse Table không cập nhật được và không dùng cho tổng; mảng hiệu không đọc giá trị xen kẽ.", level: 2 },
    { id: "q-fenwick-tree-2",
      prompt: "Mảng N = 2·10⁵ có giá trị ban đầu. Q = 2·10⁵ thao tác xen kẽ, trả lời ngay: loại 1 “cộng v vào mọi phần tử của đoạn [l, r]”; loại 2 “in giá trị hiện tại của phần tử i”.",
      answer: ["fenwick-tree"], also: ["segment-tree", "lazy-segment-tree", "sqrt-decomposition"], wrong: ["difference-array", "array-prefix-sum", "sparse-table"],
      why: "Cập nhật đoạn + truy vấn điểm: Fenwick trên mảng hiệu (hai cập nhật điểm, truy vấn là một tổng tiền tố) O(log N). Mảng hiệu thuần phải cộng dồn O(N) mỗi lần đọc khi hỏi xen kẽ; prefix sum và Sparse Table là cấu trúc tĩnh.", level: 2 },
    { id: "q-fenwick-tree-3",
      prompt: "Một tập số nguyên trong khoảng [1, 10⁶], ban đầu rỗng. Q = 2·10⁵ thao tác: chèn x, xoá x (nếu có), hoặc hỏi số nhỏ thứ k trong tập. Giá trị luôn nằm trong [1, 10⁶].",
      answer: ["fenwick-tree"], also: ["segment-tree", "ordered-set", "treap"], wrong: ["heap", "array-prefix-sum", "sparse-table"],
      why: "Fenwick trên mảng đếm theo giá trị, tìm phần tử thứ k bằng đi xuống nhị phân O(log N); miền nhỏ nên không cần cấu trúc cây phức tạp. Segment Tree, ordered set, Treap cũng đúng. Heap chỉ cho phần tử nhỏ nhất, prefix sum và Sparse Table là cấu trúc tĩnh.", level: 3 },
    { id: "q-segment-tree-1",
      prompt: "Mảng N = 2·10⁵ số nguyên. Q = 2·10⁵ thao tác xen kẽ: “gán a[i] = x” hoặc “in giá trị nhỏ nhất trong đoạn [l, r]”. Trả lời ngay (online).",
      answer: ["segment-tree"], also: ["sqrt-decomposition"], wrong: ["fenwick-tree", "sparse-table", "array-prefix-sum"],
      why: "Min đoạn với cập nhật điểm: Segment Tree cho phép gộp min, mỗi thao tác O(log N). Fenwick dựa trên phép trừ nên không có min đoạn; Sparse Table và prefix sum là cấu trúc tĩnh. Sqrt decomposition qua được nhưng chậm hơn.", level: 2 },
    { id: "q-segment-tree-2",
      prompt: "Mảng N = 2·10⁵ số dương là sức chứa của các phòng. Q = 2·10⁵ yêu cầu, mỗi yêu cầu có số x: tìm chỉ số nhỏ nhất i có a[i] ≥ x rồi trừ x khỏi a[i] (không có phòng nào thì in 0).",
      answer: ["segment-tree"], also: ["sqrt-decomposition"], wrong: ["fenwick-tree", "sparse-table", "heap"],
      why: "Segment Tree lưu max của từng đoạn; từ gốc đi xuống chọn con trái nếu max của nó ≥ x, tìm được vị trí đầu tiên trong O(log N), rồi cập nhật điểm. Fenwick không có max, Sparse Table không cập nhật được, heap không giữ thứ tự vị trí.", level: 3 },
    { id: "q-segment-tree-3",
      prompt: "Mảng N = 2·10⁵ số nguyên (có thể âm). Q = 2·10⁵ thao tác xen kẽ: đổi một phần tử, hoặc hỏi tổng lớn nhất của một đoạn con liên tiếp (có thể rỗng) nằm trong đoạn [l, r].",
      answer: ["segment-tree"], also: ["sqrt-decomposition"], wrong: ["fenwick-tree", "sparse-table", "kadane"],
      why: "Mỗi nút lưu bộ (tổng, tiền tố lớn nhất, hậu tố lớn nhất, đoạn con lớn nhất) — phép gộp kết hợp nhưng không giao hoán — nên Segment Tree trả lời trong O(log N). Kadane chạy O(N) mỗi truy vấn (quá chậm), Fenwick và Sparse Table không biểu diễn được phép gộp này.", level: 3 },
    { id: "q-lazy-segment-tree-1",
      prompt: "Mảng N = 2·10⁵ số nguyên. Q = 2·10⁵ thao tác xen kẽ: “cộng v vào mọi phần tử của đoạn [l, r]” hoặc “in tổng các phần tử của đoạn [l, r]”. Trả lời ngay (online).",
      answer: ["lazy-segment-tree"], also: ["fenwick-tree", "sqrt-decomposition"], wrong: ["segment-tree", "difference-array", "sparse-table"],
      why: "Cập nhật đoạn + tổng đoạn online: Segment Tree lười O(log N) mỗi thao tác. Fenwick với hai BIT cũng được (chỉ cho phép cộng), sqrt decomposition O(√N). Segment Tree thường phải cập nhật từng phần tử (O(N) mỗi lệnh); mảng hiệu cần dựng lại khi đọc; Sparse Table không cập nhật.", level: 3 },
    { id: "q-lazy-segment-tree-2",
      prompt: "Mảng N = 2·10⁵. Q = 2·10⁵ thao tác trộn lẫn: “gán mọi phần tử của đoạn [l, r] bằng x”, “cộng v vào mọi phần tử của đoạn [l, r]”, hoặc “in tổng đoạn [l, r]”.",
      answer: ["lazy-segment-tree"], also: ["sqrt-decomposition"], wrong: ["fenwick-tree", "difference-array", "segment-tree"],
      why: "Có thao tác gán đoạn xen với cộng đoạn: cần nhãn lười có thể hợp nhất (gán xoá nhãn cộng cũ, cộng sau gán gộp vào giá trị gán): Segment Tree lười O(log N). Fenwick và mảng hiệu chỉ xử lý được phép cộng, không xử lý gán; Segment Tree thường không cập nhật đoạn nhanh.", level: 4 },
    { id: "q-sparse-table-1",
      prompt: "Mảng cố định N = 10⁶ số nguyên (≤ 10⁹), không bao giờ đổi. Q = 10⁷ truy vấn: giá trị nhỏ nhất trong đoạn [l, r]. Giới hạn thời gian rất chặt, bộ nhớ 512 MB.",
      answer: ["sparse-table"], also: ["segment-tree"], wrong: ["fenwick-tree", "array-prefix-sum", "difference-array"],
      why: "Mảng tĩnh và min là phép luỹ đẳng: Sparse Table dựng O(N log N), mỗi truy vấn O(1) — với 10⁷ truy vấn đây là lựa chọn nhanh nhất (80 MB với int). Segment Tree đúng nhưng O(log N) mỗi truy vấn. Fenwick, prefix sum và mảng hiệu dựa trên phép có nghịch đảo, không áp dụng cho min.", level: 2 },
    { id: "q-sparse-table-2",
      prompt: "Mảng cố định N = 2·10⁵ số nguyên dương, không đổi. Q = 5·10⁵ truy vấn: ước chung lớn nhất của các phần tử trong đoạn [l, r].",
      answer: ["sparse-table"], also: ["segment-tree"], wrong: ["array-prefix-sum", "fenwick-tree", "difference-array"],
      why: "gcd luỹ đẳng (gcd(x, x) = x) nên Sparse Table trả lời O(1) sau khi dựng O(N log N). Segment Tree cũng đúng nhưng chậm hơn. gcd không có phép nghịch đảo nên prefix sum, Fenwick và mảng hiệu không dùng được.", level: 3 },
    { id: "q-treap-1",
      prompt: "Cho dãy N = 2·10⁵ số. Q = 2·10⁵ thao tác trên vị trí: “cắt đoạn [l, r] rồi dán vào cuối dãy” hoặc “đảo ngược thứ tự các phần tử trong đoạn [l, r]”. In dãy cuối cùng.",
      answer: ["treap"], also: ["sqrt-decomposition"], wrong: ["segment-tree", "fenwick-tree", "ordered-set", "sparse-table"],
      why: "Cắt, dán và đảo đoạn là phép tách / nối dãy: Treap ẩn làm bằng split / merge và cờ đảo lười, mỗi thao tác O(log N) kỳ vọng. Segment Tree, Fenwick, Sparse Table giữ vị trí cố định nên không thay đổi thứ tự; ordered set không có đảo hay nối theo vị trí.", level: 4 },
    { id: "q-ordered-set-1",
      prompt: "N = 2·10⁵ người đứng vòng tròn. Mỗi lượt: bỏ qua k người (k lên tới 10⁹), loại người kế tiếp rồi tiếp tục đếm từ người sau đó. In thứ tự bị loại. (Dùng GCC.)",
      answer: ["ordered-set"], also: ["treap", "fenwick-tree", "segment-tree"], wrong: ["queue", "stack", "dsu"],
      why: "Gọi m là số người còn lại, người bị loại ở chỉ số (cur + k) mod m: cần lấy phần tử thứ ở chỉ số đó và xoá: ordered set (find_by_order + erase) O(log N). Treap, Fenwick (đi xuống) hay Segment Tree cũng làm được. Hàng đợi mô phỏng O(N·k) quá chậm khi k lớn; stack và DSU không lấy phần tử theo thứ hạng.", level: 3 },
    { id: "q-ordered-set-2",
      prompt: "Dòng 2·10⁵ số nguyên cỡ 10¹⁸ lần lượt tới. Sau mỗi số mới hãy in số lượng số tới trước đó mà nhỏ hơn nó; phải trả lời ngay trước khi đọc số kế tiếp (online). (Dùng GCC.)",
      answer: ["ordered-set"], also: ["treap"], wrong: ["fenwick-tree", "array-prefix-sum", "sparse-table"],
      why: "Chèn và đếm số phần tử nhỏ hơn x online: order_of_key của ordered set O(log N), giá trị lớn không cần nén. Fenwick cần nén toạ độ nên chỉ dùng được khi biết trước toàn bộ dãy (offline); prefix sum và Sparse Table là cấu trúc tĩnh.", level: 2 },
    { id: "q-sqrt-decomposition-1",
      prompt: "Mảng N = 10⁵ số nguyên. Q = 10⁵ thao tác xen kẽ: “cộng v vào mọi phần tử của đoạn [l, r]” hoặc “đếm số phần tử của đoạn [l, r] có giá trị ≥ x”. Giới hạn thời gian 4 giây.",
      answer: ["sqrt-decomposition"], also: [], wrong: ["fenwick-tree", "lazy-segment-tree", "sparse-table", "segment-tree"],
      why: "Đếm phần tử ≥ x kèm cộng đoạn: mỗi khối giữ bản sao đã sắp xếp và nhãn cộng, khối trọn tìm nhị phân, khối lẻ sắp xếp lại: O(√N log N) mỗi thao tác. Segment Tree (kể cả lười) không gộp được “số phần tử ≥ x” khi cộng đoạn; Fenwick và Sparse Table không có phép gộp này.", level: 3 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
