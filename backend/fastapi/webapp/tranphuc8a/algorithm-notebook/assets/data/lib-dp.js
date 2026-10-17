/* lib-dp.js — quy hoạch động: balô (0/1, không giới hạn, có giới hạn), đổi tiền, LIS, LCS, edit distance, bitmask, digit, trên cây,
   SOS, Convex Hull Trick / Li Chao, chia để trị, trên đoạn, Kadane. Cách soạn: HUONG-DAN-SOAN.md. */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ============================================================================================================== Balô
    {
      id: "knapsack-01",
      name: "Knapsack 0/1",
      aliases: ["knapsack 0/1", "01 knapsack", "balô 0/1", "ba lô", "bài toán cái túi", "bài toán xếp balô", "subset sum có giá trị"],
      category: "dp",
      sub: "Balô (Knapsack)",
      level: 2,
      tags: ["dp", "knapsack", "subset-sum", "optimization"],
      summary: "Chọn một tập con các vật (mỗi vật dùng tối đa một lần) có tổng khối lượng không quá W sao cho tổng giá trị lớn nhất.",
      description:
        "Mỗi vật chỉ có hai khả năng: lấy hoặc không lấy. Gọi `dp[c]` là tổng giá trị lớn nhất đạt được bằng các vật đã xét với tổng khối lượng **không quá** `c`. Khi thêm vật `i` (nặng `w`, giá trị `v`), mỗi `dp[c]` hoặc giữ nguyên (bỏ vật) hoặc bằng `dp[c-w] + v` (lấy vật).\n\n" +
        "- **Trạng thái:** `dp[i][c]` = giá trị lớn nhất khi chỉ dùng `i` vật đầu và sức chứa `c` (nén thành một mảng `dp[c]`).\n" +
        "- **Công thức chuyển:** `dp[i][c] = max(dp[i-1][c], dp[i-1][c-w_i] + v_i)` khi `c ≥ w_i`.\n" +
        "- **Thứ tự duyệt:** vật ở vòng ngoài; sức chứa ở vòng trong và đi **từ W xuống w_i** (ngược), để `dp[c-w_i]` còn là giá trị của `i-1` vật đầu.\n" +
        "- **Khởi tạo:** `dp[c] = 0` với mọi `c` (không bắt buộc đầy túi). Nếu đề đòi tổng khối lượng **đúng bằng** W thì `dp[0] = 0`, các ô còn lại `-INF`.\n" +
        "- **Đáp án:** `dp[W]`.\n\n" +
        "Muốn biết **những vật nào** được chọn thì lưu thêm bảng bit `take[i][c]` (vật `i` có làm `dp[c]` tốt hơn không) rồi lần ngược từ vật cuối, tốn O(n·W) bit. Khi W rất lớn mà tổng giá trị nhỏ, đổi vai trò: `dp[giá trị] = khối lượng nhỏ nhất`; khi W rất lớn và n ≤ 40, dùng meet in the middle.",
      conditions: ["Mỗi vật dùng tối đa một lần", "Khối lượng w_i là số nguyên không âm; W đủ nhỏ để cấp mảng O(W) (thường W ≤ 10^5–10^6 khi n cỡ vài trăm–nghìn)", "Tổng giá trị vừa long long"],
      complexity: { time: "O(n·W)", space: "O(W)", note: "Thời gian giả đa thức (phụ thuộc giá trị W, không phải số bit của W). Dựng lại tập vật tốn thêm O(n·W) bit." },
      ops: [["Xét thêm một vật", "O(W)"], ["Toàn bộ thuật toán", "O(n·W)"], ["Bộ nhớ (nén một chiều)", "O(W)"]],
      use_case: ["Chọn dự án / món đồ / bài thi với ngân sách (khối lượng) cố định, mỗi cái một lần", "Subset sum: tổng có đạt được đúng S không (giá trị = 0 hoặc dùng bitset)", "Đếm số tập con có tổng bằng S (đổi max thành +, dp[0] = 1)"],
      not_for: ["Vật có thể dùng nhiều lần → knapsack-unbounded", "Mỗi loại có số lượng cho trước → knapsack-bounded (tách nhị phân)", "W cỡ 10^9, n ≤ 40 → meet-in-the-middle; W cỡ 10^9 nhưng tổng giá trị nhỏ → dp theo giá trị"],
      pitfalls: [
        "Duyệt sức chứa từ nhỏ lên lớn: vật bị dùng lặp lại nhiều lần (thành balô không giới hạn). Với mảng một chiều phải duyệt c từ W xuống w_i.",
        "Khởi tạo sai: \"không quá W\" khởi tạo toàn 0; \"đúng bằng W\" phải là dp[0] = 0 và -INF cho các ô còn lại.",
        "Quên điều kiện c ≥ w_i (hoặc để vật nặng hơn W chạy vòng lặp) gây truy cập chỉ số âm.",
        "Tràn số: giá trị lớn (10^9 × n) phải dùng long long cho dp.",
        "Bài đếm số cách (không phải tối ưu): dp[0] = 1, dùng phép cộng modulo thay vì max; vòng lặp vẫn phải ngược."
      ],
      code: {
        lang: "cpp", title: "knapsack01.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Knapsack 0/1: vật i nặng w[i] (>= 0), giá trị v[i]; mỗi vật dùng tối đa một lần.
// Trả về tổng giá trị lớn nhất với tổng khối lượng <= W. O(n*W) thời gian, O(W) bộ nhớ.
// Nếu truyền chosen != nullptr: dựng lại chỉ số các vật được chọn (tốn thêm n*W bit).
long long knapsack01(const vector<int>& w, const vector<long long>& v, int W, vector<int>* chosen = nullptr) {
    int n = w.size();
    vector<long long> dp(W + 1, 0);  // dp[c] = giá trị lớn nhất khi sức chứa c (không cần đầy túi)
    vector<vector<bool>> take(chosen ? n : 0, vector<bool>(W + 1, false));
    for (int i = 0; i < n; i++)
        for (int c = W; c >= w[i]; c--)  // duyệt NGƯỢC: dp[c - w[i]] vẫn là của các vật 0..i-1
            if (dp[c - w[i]] + v[i] > dp[c]) {
                dp[c] = dp[c - w[i]] + v[i];
                if (chosen) take[i][c] = true;
            }
    if (chosen) {  // lần ngược từ vật cuối: take[i][c] cho biết vật i có được lấy ở sức chứa c
        chosen->clear();
        for (int i = n - 1, c = W; i >= 0; i--)
            if (take[i][c]) { chosen->push_back(i); c -= w[i]; }
        reverse(chosen->begin(), chosen->end());
    }
    return dp[W];
}
`
      },
      example: {
        input: "4 7\n3 4\n4 5\n2 3\n5 8",
        output: "11",
        explain: "4 vật (khối lượng giá trị): (3,4), (4,5), (2,3), (5,8); sức chứa W = 7. Chọn vật 3 và vật 4 (nặng 2 + 5 = 7) được 3 + 8 = 11; chọn vật 1 và vật 2 (nặng 7) chỉ được 9."
      },
      problems: [
        { site: "cses", id: "1158", name: "Book Shop" },
        { site: "cses", id: "1745", name: "Money Sums" },
        { site: "cses", id: "1093", name: "Two Sets II" },
        { site: "atcoder", name: "Knapsack 1" },
        { site: "lc", name: "Partition Equal Subset Sum" }
      ],
      related: ["knapsack-unbounded", "knapsack-bounded", "coin-change", "meet-in-the-middle", "bitmask-dp"],
      compare: { "Dạng trạng thái": "dp[i][c]: i vật đầu, sức chứa c", "Số trạng thái": "n·W", "Chuyển trạng thái": "Lấy hoặc bỏ vật i — O(1)", "Bộ nhớ": "O(W) khi nén một chiều (duyệt ngược)" },
      cards: [
        { q: "Vì sao balô 0/1 nén một chiều phải duyệt sức chứa từ lớn xuống nhỏ?", a: "Để dp[c - w] khi đọc còn là giá trị trước khi xét vật i. Duyệt xuôi thì dp[c - w] đã chứa vật i, vật bị lấy lặp lại (thành balô không giới hạn)." },
        { q: "Độ phức tạp của knapsack 0/1?", a: "O(n·W) thời gian, O(W) bộ nhớ; đây là thời gian giả đa thức (phụ thuộc giá trị W)." },
        { q: "W = 10^9 mà vẫn giải được balô 0/1 trong những trường hợp nào?", a: "n ≤ 40: meet in the middle (O(2^(n/2) · n)). Tổng giá trị nhỏ: đổi vai trò, dp[giá trị] = khối lượng nhỏ nhất." },
        { q: "Khởi tạo dp thế nào cho \"tổng khối lượng ĐÚNG bằng W\"?", a: "dp[0] = 0 và dp[c > 0] = -INF (chỉ cộng khi ô nguồn khác -INF). Với \"không quá W\" thì khởi tạo toàn 0." }
      ]
    },

    {
      id: "knapsack-unbounded",
      name: "Knapsack không giới hạn",
      aliases: ["unbounded knapsack", "complete knapsack", "balô không giới hạn", "balô đầy đủ", "rod cutting", "cắt thanh", "balô dùng nhiều lần"],
      category: "dp",
      sub: "Balô (Knapsack)",
      level: 2,
      tags: ["dp", "knapsack", "unbounded", "optimization"],
      summary: "Chọn các vật, mỗi loại dùng bao nhiêu lần cũng được, tổng khối lượng không quá W (hoặc đúng bằng W) sao cho tổng giá trị lớn nhất.",
      description:
        "Giống balô 0/1 nhưng mỗi loại có vô hạn bản. Chỉ cần đổi **chiều duyệt sức chứa**: đi từ nhỏ lên lớn, nhờ đó `dp[c - w]` đã có thể chứa chính loại vật đang xét, tức là loại đó được lấy lặp lại.\n\n" +
        "- **Trạng thái:** `dp[c]` = giá trị lớn nhất với sức chứa `c` (chỉ cần một chiều).\n" +
        "- **Công thức chuyển:** `dp[c] = max(dp[c], dp[c - w_i] + v_i)` với mọi loại `i` có `w_i ≤ c`.\n" +
        "- **Thứ tự duyệt:** loại vật ở vòng ngoài, `c` đi **từ w_i lên W** (xuôi). Đổi chỗ hai vòng lặp vẫn đúng với bài tối ưu.\n" +
        "- **Khởi tạo:** \"không quá W\": toàn 0. \"Đúng bằng W\": `dp[0] = 0`, còn lại `-INF`.\n" +
        "- **Đáp án:** `dp[W]` (với bản \"đúng bằng W\" mà vẫn `-INF` thì không có cách).\n\n" +
        "Cắt thanh (rod cutting) và đổi tiền tối thiểu đều là balô không giới hạn bản \"đúng bằng\". Có thể loại trước các loại bị lấn át (nặng hơn mà giá trị không lớn hơn) để chạy nhanh hơn.",
      conditions: ["Mỗi loại dùng số lần tuỳ ý", "w_i ≥ 1 (w_i = 0 với v_i > 0 cho đáp án vô hạn)", "v_i ≥ 0 trong mẫu code (để dùng -1 báo vô nghiệm ở bản \"đúng bằng W\")"],
      complexity: { time: "O(n·W)", space: "O(W)", note: "Thời gian giả đa thức; W cỡ 10^9 với w_i nhỏ cần kỹ thuật khác (ví dụ đồng dư theo vật có tỉ lệ giá trị / khối lượng tốt nhất)." },
      ops: [["Xét thêm một loại vật", "O(W)"], ["Toàn bộ thuật toán", "O(n·W)"]],
      use_case: ["Cắt thanh thành các đoạn có giá khác nhau để doanh thu lớn nhất", "Đổi tiền với số tờ ít nhất (bản đúng bằng W, mỗi tờ có giá trị -1 hoặc đổi max thành min)", "Mỗi loại sản phẩm sản xuất không hạn chế, ngân sách / nguyên liệu cố định"],
      not_for: ["Mỗi vật chỉ có một bản → knapsack-01", "Mỗi loại có số lượng giới hạn → knapsack-bounded", "Chỉ cần số cách tạo tổng → coin-change"],
      pitfalls: [
        "Duyệt ngược như balô 0/1 sẽ làm mỗi loại chỉ được lấy tối đa một lần (nhầm hai dạng).",
        "w_i = 0 và v_i > 0: đáp án thực sự vô hạn, nhưng vòng lặp chỉ cộng một lần nên kết quả sai âm thầm — loại các loại này trước.",
        "Bản \"đúng bằng W\" mà khởi tạo toàn 0 sẽ cho phép \"bỏ trống\", đáp án lớn hơn thực tế.",
        "Cộng vào -INF gây tràn / sai: luôn kiểm tra dp[c - w] khác -INF trước khi cộng.",
        "Bài đếm số cách: thứ tự hai vòng lặp quyết định tính tổ hợp hay dãy có thứ tự (xem coin-change)."
      ],
      code: {
        lang: "cpp", title: "knapsack_unbounded.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Knapsack không giới hạn: loại i nặng w[i] (>= 1), giá trị v[i] (>= 0), dùng bao nhiêu bản cũng được.
// exact = false: tổng khối lượng <= W; exact = true: tổng khối lượng ĐÚNG bằng W (không có cách → trả -1).
// O(n*W) thời gian, O(W) bộ nhớ.
long long knapsackUnbounded(const vector<int>& w, const vector<long long>& v, int W, bool exact = false) {
    const long long NEG = LLONG_MIN;  // đánh dấu "không đạt được"
    vector<long long> dp(W + 1, exact ? NEG : 0);
    dp[0] = 0;
    for (size_t i = 0; i < w.size(); i++)
        for (int c = w[i]; c <= W; c++)  // duyệt XUÔI: dp[c - w[i]] có thể đã chứa loại i → lấy lặp lại được
            if (dp[c - w[i]] != NEG) dp[c] = max(dp[c], dp[c - w[i]] + v[i]);
    return dp[W] == NEG ? -1 : dp[W];
}
`
      },
      example: {
        input: "3 10\n3 5\n4 7\n5 9",
        output: "18",
        explain: "3 loại vật (khối lượng giá trị): (3,5), (4,7), (5,9); W = 10. Lấy hai vật loại 3 (nặng 5 + 5 = 10) được 9 + 9 = 18. Các phương án khác thấp hơn: loại 1 + loại 1 + loại 2 (nặng 3 + 3 + 4 = 10) được 17; loại 3 + loại 2 (nặng 9) được 16."
      },
      problems: [
        { site: "cses", id: "1634", name: "Minimizing Coins" },
        { site: "lc", name: "Perfect Squares" },
        { site: "lc", name: "Coin Change" }
      ],
      related: ["knapsack-01", "knapsack-bounded", "coin-change", "interval-dp"],
      compare: { "Dạng trạng thái": "dp[c]: sức chứa c", "Số trạng thái": "W (một chiều)", "Chuyển trạng thái": "Lấy thêm một bản của loại i — O(1), duyệt xuôi", "Bộ nhớ": "O(W)" },
      cards: [
        { q: "Khác biệt duy nhất giữa code balô 0/1 và balô không giới hạn?", a: "Chiều duyệt sức chứa: 0/1 duyệt ngược (từ W xuống), không giới hạn duyệt xuôi (từ w lên W) để cho phép lấy lặp lại." },
        { q: "Khi nào balô không giới hạn có đáp án vô hạn?", a: "Khi có loại w_i = 0 với v_i > 0 (hoặc w_i < 0): lấy vô số bản mà không tốn sức chứa." },
        { q: "Khởi tạo dp cho bản \"đúng bằng W\"?", a: "dp[0] = 0 và các ô còn lại -INF; khi cập nhật bỏ qua ô nguồn là -INF. Kết quả -INF nghĩa là không có cách." },
        { q: "Độ phức tạp?", a: "O(n·W) thời gian, O(W) bộ nhớ." }
      ]
    },

    {
      id: "knapsack-bounded",
      name: "Knapsack có giới hạn số lượng",
      aliases: ["bounded knapsack", "balô có giới hạn", "balô nhiều bản", "tách nhị phân", "binary splitting", "multiple knapsack", "balô số lượng"],
      category: "dp",
      sub: "Balô (Knapsack)",
      level: 3,
      tags: ["dp", "knapsack", "bounded", "binary-splitting"],
      summary: "Mỗi loại vật có số lượng c_i bản; chọn sao cho tổng khối lượng không quá W và tổng giá trị lớn nhất — tách nhị phân đưa về balô 0/1.",
      description:
        "Nếu mở rộng mỗi loại thành `c_i` vật 0/1 thì tốn O(W · Σc_i). **Tách nhị phân**: viết `c = 1 + 2 + 4 + … + 2^(k-1) + r` với `r` là phần dư (`0 ≤ r < 2^k`) sao cho các tổng con của các \"gói\" này biểu diễn được **mọi** số lượng từ 0 tới `c`. Mỗi gói `p` bản là một vật 0/1 có khối lượng `w·p` và giá trị `v·p`.\n\n" +
        "- **Trạng thái:** `dp[c]` = giá trị lớn nhất với sức chứa `c` (một chiều).\n" +
        "- **Công thức chuyển (mỗi gói):** `dp[c] = max(dp[c], dp[c - w·p] + v·p)`.\n" +
        "- **Thứ tự duyệt:** mỗi gói là vật 0/1 nên `c` đi **ngược từ W xuống w·p**.\n" +
        "- **Khởi tạo:** `dp[c] = 0` (không quá W) — như balô 0/1.\n" +
        "- **Đáp án:** `dp[W]`.\n\n" +
        "Số gói của loại `i` là O(log c_i), nên tổng O(W · Σ log c_i). Vì dùng quá `W / w` bản của một loại là vô ích nên ta chặn `c_i` xuống `min(c_i, W / w)` trước khi tách (vừa nhanh hơn, vừa tránh tràn). Muốn O(n·W) thì dùng hàng đợi đơn điệu trên từng lớp đồng dư `c mod w`.",
      conditions: ["Loại i có tối đa c_i bản (c_i có thể rất lớn)", "w_i ≥ 0 nguyên; W đủ nhỏ cho mảng O(W)", "Tích w·p và v·p vừa long long"],
      complexity: { time: "O(W · Σ log c_i)", space: "O(W)", note: "Hàng đợi đơn điệu theo lớp đồng dư (c mod w_i) cho O(n·W)." },
      use_case: ["Mỗi sản phẩm / dụng cụ có số lượng tồn kho giới hạn", "Bài balô mà số bản mỗi loại lên tới 10^9 (mở rộng từng bản không khả thi)", "Subset sum với giá trị lặp lại nhiều lần (ví dụ có bao nhiêu tổng đạt được)"],
      not_for: ["Mỗi loại chỉ một bản → knapsack-01 (không cần tách)", "Số bản không giới hạn → knapsack-unbounded", "Cần đếm số cách thay vì tối ưu → dùng dp đếm riêng (tách nhị phân không đếm đúng số cách)"],
      pitfalls: [
        "Quên phần dư r: chỉ tách các luỹ thừa 2 không biểu diễn được mọi số lượng khi c không có dạng 2^k - 1.",
        "Gói p bản phải nhân CẢ khối lượng và giá trị (w·p và v·p); quên nhân giá trị là lỗi phổ biến.",
        "w·p có thể tràn khi c_i rất lớn (10^9 trở lên): dùng long long và chặn c_i ≤ W / w_i trước khi tách (dùng quá W / w_i bản là vô ích).",
        "Mở rộng c_i bản 0/1 khi c_i lớn → quá chậm / hết bộ nhớ; luôn tách nhị phân.",
        "Sau khi tách, vẫn phải duyệt sức chứa ngược như balô 0/1; tách nhị phân không dùng để đếm số cách (cùng một số lượng có nhiều cách tách)."
      ],
      code: {
        lang: "cpp", title: "knapsack_bounded.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Knapsack có giới hạn: loại i nặng w[i] (>= 0), giá trị v[i], có tối đa cnt[i] bản.
// Tách nhị phân cnt[i] = 1 + 2 + 4 + ... + phần dư, mỗi gói là một vật 0/1. O(W * tổng log cnt[i]), O(W) bộ nhớ.
// cnt[i] có thể rất lớn (tới 1e18): dùng quá W / w[i] bản là vô ích nên ta chặn số bản trước (tránh tràn w*take).
// (Loại có w = 0 không bị chặn: khi đó cần cnt[i] * v[i] vừa long long.)
long long knapsackBounded(const vector<int>& w, const vector<long long>& v, const vector<long long>& cnt, int W) {
    vector<long long> dp(W + 1, 0);
    for (size_t i = 0; i < w.size(); i++) {
        long long left = w[i] > 0 ? min(cnt[i], (long long)W / w[i]) : cnt[i];
        for (long long p = 1; left > 0; p <<= 1) {
            long long take = min(p, left);  // số bản trong gói này
            left -= take;
            long long ww = (long long)w[i] * take, vv = v[i] * take;  // gói nặng w*take (<= W), giá trị v*take
            for (int c = W; c >= ww; c--) dp[c] = max(dp[c], dp[c - ww] + vv);  // như 0/1: duyệt ngược
        }
    }
    return dp[W];
}
`
      },
      example: {
        input: "3 10\n3 4 2\n5 7 1\n2 3 3",
        output: "14",
        explain: "3 loại (khối lượng, giá trị, số bản): (3,4,2), (5,7,1), (2,3,3); W = 10. Chọn 1 vật loại 2 (5), 1 vật loại 1 (3), 1 vật loại 3 (2): nặng 10, giá trị 7 + 4 + 3 = 14. Nếu không giới hạn số bản, năm vật loại 3 (nặng 10) sẽ được 15."
      },
      problems: [
        { site: "cses", id: "1159", name: "Book Shop II" },
        { site: "cf", id: "106C", name: "Buns" }
      ],
      related: ["knapsack-01", "knapsack-unbounded", "coin-change", "monotonic-queue"],
      compare: { "Dạng trạng thái": "dp[c]: sức chứa c, sau khi tách gói nhị phân", "Số trạng thái": "W (số vật 0/1 là Σ log c_i)", "Chuyển trạng thái": "Mỗi gói: lấy hoặc bỏ — O(1), duyệt ngược", "Bộ nhớ": "O(W)" },
      cards: [
        { q: "Tách nhị phân biểu diễn số lượng c thế nào?", a: "c = 1 + 2 + 4 + … + 2^(k-1) + r (r là phần dư < 2^k). Các tổng con của các gói này tạo ra mọi số từ 0 đến c." },
        { q: "Độ phức tạp của knapsack có giới hạn bằng tách nhị phân?", a: "O(W · Σ log c_i) thời gian, O(W) bộ nhớ. Tối ưu hơn: O(n·W) bằng hàng đợi đơn điệu theo lớp đồng dư." },
        { q: "Gói p bản của loại (w, v) trở thành vật 0/1 như thế nào?", a: "Vật có khối lượng w·p và giá trị v·p; sau đó duyệt sức chứa ngược như balô 0/1." },
        { q: "Có dùng tách nhị phân để đếm số cách chọn không?", a: "Không: cùng một số lượng có thể được tạo bằng nhiều tổ hợp gói khác nhau, nên đếm sẽ bị lặp." }
      ]
    },

    {
      id: "coin-change",
      name: "Đổi tiền (Coin Change)",
      aliases: ["coin change", "đổi tiền", "số xu ít nhất", "minimum coins", "số cách đổi tiền", "coin combinations", "dice combinations"],
      category: "dp",
      sub: "Balô (Knapsack)",
      level: 2,
      tags: ["dp", "coin-change", "counting", "unbounded"],
      summary: "Với các mệnh giá cho trước (dùng tuỳ ý số lần), tìm số đồng ít nhất để tạo đúng tổng X, hoặc đếm số cách (tổ hợp / dãy có thứ tự) tạo tổng X.",
      description:
        "Ba bài cùng gốc, khác ở cách tính trên mảng `dp[x]` (`x` từ 0 tới X, `dp[0]` là cơ sở):\n\n" +
        "- **Số đồng ít nhất:** `dp[x] = min(dp[x - c] + 1)` với mọi mệnh giá `c ≤ x`. Khởi tạo `dp[0] = 0`, còn lại `INF`; đáp án `dp[X]` (`INF` nghĩa là không đổi được).\n" +
        "- **Số tổ hợp** (1+2 và 2+1 là một cách): `dp[x] += dp[x - c]`, vòng ngoài là **loại tiền**, vòng trong `x` từ `c` lên `X`. Khởi tạo `dp[0] = 1`.\n" +
        "- **Số dãy có thứ tự** (1+2 khác 2+1): cùng công thức nhưng vòng ngoài là **tổng `x`**, vòng trong là loại tiền. Khởi tạo `dp[0] = 1`.\n\n" +
        "Vòng ngoài là loại tiền thì mỗi tổ hợp chỉ được sinh theo một thứ tự loại cố định nên không bị đếm lặp; vòng ngoài là tổng thì mọi thứ tự đều được cộng riêng. Tham lam (luôn lấy mệnh giá lớn nhất) chỉ đúng với một số hệ \"chuẩn\" (ví dụ 1, 5, 10, 25), nên DP là cách an toàn.",
      conditions: ["Mệnh giá nguyên dương, các loại khác nhau đôi một", "Mỗi loại dùng số lần tuỳ ý", "X đủ nhỏ để cấp mảng O(X) (thường X ≤ 10^6–10^7)"],
      complexity: { time: "O(n·X)", space: "O(X)", note: "n là số loại mệnh giá. Số cách thường yêu cầu modulo (10^9 + 7)." },
      ops: [["Số đồng ít nhất", "O(n·X)"], ["Số tổ hợp", "O(n·X)"], ["Số dãy có thứ tự", "O(n·X)"]],
      use_case: ["Trả tiền thối bằng ít tờ nhất khi hệ tiền không chuẩn", "Đếm số cách tạo một tổng bằng các mệnh giá (cùng gốc với tung xúc xắc liên tiếp)", "Mô hình hoá bước nhảy: leo cầu thang với bước nhảy cho trước (đếm số dãy)"],
      not_for: ["Mỗi mệnh giá có số lượng giới hạn → knapsack-bounded", "X rất lớn (10^18) và mệnh giá nhỏ → nhân ma trận / công thức truy hồi tuyến tính", "Mỗi tờ dùng nhiều nhất một lần → knapsack-01 (dạng subset sum)"],
      pitfalls: [
        "Tham lam sai với hệ không chuẩn: {1,3,4}, X = 6 → tham lam 4+1+1 (3 đồng) nhưng tối ưu 3+3 (2 đồng).",
        "Đổi chỗ hai vòng lặp làm đổi bài toán: vòng ngoài là loại tiền → tổ hợp; vòng ngoài là tổng → dãy có thứ tự.",
        "Dùng INF rồi cộng 1 gây tràn: kiểm tra dp[x - c] khác INF (hoặc dùng INF vừa phải).",
        "Quên lấy modulo sau mỗi phép cộng, hoặc quên dp[0] = 1 % mod khi mod có thể là 1.",
        "Mệnh giá 0 hoặc trùng nhau: 0 làm công thức vô nghĩa, trùng làm đếm thừa — loại và khử trùng trước khi chạy."
      ],
      code: {
        lang: "cpp", title: "coin_change.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Đổi tiền: mệnh giá coin[i] >= 1 (khác nhau đôi một), mỗi loại dùng tuỳ ý. Mọi hàm O(n*X) thời gian, O(X) bộ nhớ.

// Số đồng ÍT NHẤT để tạo đúng tổng X; -1 nếu không tạo được.
int minCoins(const vector<int>& coin, int X) {
    const int INF = INT_MAX;
    vector<int> dp(X + 1, INF);
    dp[0] = 0;
    for (int x = 1; x <= X; x++)
        for (int c : coin)
            if (c <= x && dp[x - c] != INF) dp[x] = min(dp[x], dp[x - c] + 1);
    return dp[X] == INF ? -1 : dp[X];
}

// Số TỔ HỢP tạo tổng X (không tính thứ tự: 1+2 và 2+1 là một), chia dư mod. Vòng ngoài là LOẠI TIỀN.
long long countCombinations(const vector<int>& coin, int X, long long mod) {
    vector<long long> dp(X + 1, 0);
    dp[0] = 1 % mod;
    for (int c : coin)
        for (int x = c; x <= X; x++) dp[x] = (dp[x] + dp[x - c]) % mod;
    return dp[X];
}

// Số DÃY CÓ THỨ TỰ tạo tổng X (1+2 khác 2+1), chia dư mod. Vòng ngoài là TỔNG x.
long long countSequences(const vector<int>& coin, int X, long long mod) {
    vector<long long> dp(X + 1, 0);
    dp[0] = 1 % mod;
    for (int x = 1; x <= X; x++)
        for (int c : coin)
            if (c <= x) dp[x] = (dp[x] + dp[x - c]) % mod;
    return dp[X];
}
`
      },
      example: {
        input: "3 6\n1 3 4",
        output: "2 4 9",
        explain: "Mệnh giá {1, 3, 4}, X = 6. Ít nhất 2 đồng (3 + 3). Có 4 tổ hợp: 1·6; 3 + 1·3; 3 + 3; 4 + 1 + 1. Có 9 dãy có thứ tự (dp: 1, 1, 1, 2, 4, 6, 9 cho x = 0..6)."
      },
      problems: [
        { site: "cses", id: "1634", name: "Minimizing Coins" },
        { site: "cses", id: "1635", name: "Coin Combinations I" },
        { site: "cses", id: "1636", name: "Coin Combinations II" },
        { site: "lc", name: "Coin Change" },
        { site: "lc", name: "Coin Change II" }
      ],
      related: ["knapsack-unbounded", "knapsack-01", "knapsack-bounded", "matrix-exponentiation"],
      compare: { "Dạng trạng thái": "dp[x]: tổng x đã tạo", "Số trạng thái": "X", "Chuyển trạng thái": "Duyệt n mệnh giá — O(n) mỗi trạng thái", "Bộ nhớ": "O(X)" },
      cards: [
        { q: "Vì sao đếm tổ hợp đặt vòng lặp loại tiền ở ngoài còn đếm dãy có thứ tự đặt tổng ở ngoài?", a: "Loại tiền ở ngoài: mỗi tổ hợp chỉ được sinh một lần theo thứ tự loại cố định. Tổng ở ngoài: ở mỗi tổng, mọi mệnh giá cuối cùng đều được cộng riêng, nên mọi thứ tự đều được đếm." },
        { q: "Công thức số đồng ít nhất?", a: "dp[0] = 0, dp[x] = min(dp[x - c] + 1) với c ≤ x; dp[X] = INF thì không đổi được." },
        { q: "Phản ví dụ cho tham lam trong đổi tiền?", a: "Mệnh giá {1, 3, 4}, X = 6: tham lam 4+1+1 (3 đồng) nhưng tối ưu 3+3 (2 đồng)." },
        { q: "Độ phức tạp?", a: "O(n·X) thời gian, O(X) bộ nhớ (n là số loại mệnh giá)." }
      ]
    },

    // ============================================================================================================== Dãy & xâu
    {
      id: "lis",
      name: "Dãy con tăng dài nhất (LIS)",
      aliases: ["lis", "longest increasing subsequence", "dãy con tăng dài nhất", "dãy con đơn điệu", "patience sorting", "dãy con không giảm"],
      category: "dp",
      sub: "Dãy & xâu",
      level: 2,
      tags: ["dp", "lis", "subsequence", "binary-search"],
      summary: "Tìm độ dài (và một phương án) của dãy con tăng dài nhất trong dãy N phần tử trong O(N log N) bằng mảng tail và tìm nhị phân.",
      description:
        "Bản DP cơ bản: `dp[i]` = độ dài LIS kết thúc tại `i` = `1 + max(dp[j])` với `j < i` và `a[j] < a[i]`, tốn O(N²). Bản nhanh giữ mảng `tail[k]` = **giá trị cuối nhỏ nhất** của một dãy con tăng độ dài `k+1` đã thấy. `tail` luôn tăng, nên với phần tử mới `x` ta tìm nhị phân vị trí đầu tiên có `tail[k] ≥ x` và ghi đè `tail[k] = x`; nếu không có vị trí nào thì nối thêm — độ dài LIS là kích thước `tail`.\n\n" +
        "- **Trạng thái:** `tail[k]` (và `tailIdx[k]` là chỉ số của phần tử đó).\n" +
        "- **Công thức chuyển:** `k = lower_bound(tail, x)`; `tail[k] = x`; `prev[i] = tailIdx[k-1]`.\n" +
        "- **Thứ tự duyệt:** từ trái sang phải một lượt.\n" +
        "- **Khởi tạo:** `tail` rỗng.\n" +
        "- **Đáp án:** `tail.size()`; dựng lại bằng cách đi ngược theo `prev` từ `tailIdx.back()`.\n\n" +
        "Tăng **ngặt** dùng `lower_bound`; **không giảm** dùng `upper_bound`. Lưu ý `tail` không phải là dãy con hợp lệ, chỉ là công cụ đếm — phải dùng `prev` để dựng lại. Với hoán vị, LCS của hai hoán vị quy về LIS nên cũng làm được trong O(N log N).",
      conditions: ["Dãy con không cần liên tiếp", "Chọn rõ \"tăng ngặt\" hay \"không giảm\" (quyết định lower_bound hay upper_bound)", "So sánh được giữa các phần tử (số nguyên, thực, hoặc cặp đã quy về một khoá)"],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Bản DP đơn giản: O(N²) thời gian, dùng khi N ≤ 5000 hoặc cần trọng số tuỳ ý." },
      ops: [["Xử lý một phần tử", "O(log N)"], ["Toàn bộ thuật toán", "O(N log N)"]],
      use_case: ["Số phần tử lớn nhất giữ lại để dãy tăng dần (số phần tử phải xoá = N - LIS)", "Lồng phong bì / xếp búp bê (sắp theo một khoá, LIS theo khoá kia)", "Bước con của LCS hai hoán vị, đếm số dãy giảm tối thiểu cần để phủ dãy"],
      not_for: ["Cần đoạn con LIÊN TIẾP tăng dài nhất → một lượt duyệt đếm đơn giản", "LIS có trọng số hoặc đếm số dãy con tăng → Fenwick / segment tree theo giá trị (sau nén toạ độ)", "Dãy con chung của hai xâu bất kỳ → lcs"],
      pitfalls: [
        "lower_bound cho tăng ngặt, upper_bound cho không giảm: nhầm hai hàm cho kết quả sai khi có phần tử bằng nhau.",
        "Mảng tail KHÔNG phải một dãy con tăng thực sự; muốn in dãy phải lưu prev và tailIdx như trong mẫu.",
        "Nhầm \"dãy con\" (có thể bỏ phần tử) với \"đoạn con\" (liên tiếp).",
        "Dãy con GIẢM dài nhất: đảo dấu mọi phần tử hoặc đảo dãy rồi chạy LIS; đừng đổi chiều so sánh nửa chừng.",
        "Với cặp (x, y) cần LIS theo cả hai: sắp xếp x tăng và với x bằng nhau sắp y giảm khi cần tăng ngặt theo y."
      ],
      code: {
        lang: "cpp", title: "lis.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LIS O(N log N) kèm dựng lại. Trả về CHỈ SỐ (0-based, tăng dần) của một dãy con tăng dài nhất.
// strict = true: tăng ngặt (a[i1] < a[i2] < ...); false: không giảm (<=).
vector<int> lis(const vector<long long>& a, bool strict = true) {
    int n = a.size();
    vector<long long> tail;  // tail[k] = giá trị cuối nhỏ nhất của dãy con tăng độ dài k+1
    vector<int> tailIdx;     // tailIdx[k] = chỉ số của phần tử tail[k]
    vector<int> prev(n, -1); // prev[i] = phần tử đứng trước i trong dãy tìm được
    for (int i = 0; i < n; i++) {
        auto it = strict ? lower_bound(tail.begin(), tail.end(), a[i]) : upper_bound(tail.begin(), tail.end(), a[i]);
        int k = it - tail.begin();
        if (k == (int)tail.size()) { tail.push_back(a[i]); tailIdx.push_back(i); }
        else { tail[k] = a[i]; tailIdx[k] = i; }
        prev[i] = k ? tailIdx[k - 1] : -1;
    }
    vector<int> res;
    for (int i = tailIdx.empty() ? -1 : tailIdx.back(); i != -1; i = prev[i]) res.push_back(i);
    reverse(res.begin(), res.end());
    return res;  // res.size() là độ dài LIS
}
`
      },
      example: {
        input: "8\n3 1 4 1 5 9 2 6",
        output: "4\n1 4 5 6",
        explain: "Dãy 3 1 4 1 5 9 2 6. tail biến đổi: [3] → [1] → [1,4] → [1,4] → [1,4,5] → [1,4,5,9] → [1,2,5,9] → [1,2,5,6]. Độ dài 4; một dãy con tăng ngặt dài nhất là 1 4 5 6."
      },
      problems: [
        { site: "cses", id: "1145", name: "Increasing Subsequence" },
        { site: "cf", id: "340D", name: "Bubble Sort Graph" },
        { site: "lc", name: "Longest Increasing Subsequence" },
        { site: "lc", name: "Russian Doll Envelopes" }
      ],
      related: ["lcs", "fenwick-tree", "binary-search", "count-inversions"],
      compare: { "Dạng trạng thái": "tail[k]: giá trị cuối nhỏ nhất của dãy độ dài k+1 (hoặc dp[i] kết thúc tại i)", "Số trạng thái": "N", "Chuyển trạng thái": "Tìm nhị phân vị trí thay thế — O(log N)", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "Ý nghĩa của tail[k] trong LIS O(N log N)?", a: "Giá trị cuối nhỏ nhất của một dãy con tăng có độ dài k+1 trong phần đã duyệt. Mảng tail luôn tăng nên tìm nhị phân được." },
        { q: "lower_bound hay upper_bound cho dãy con tăng NGẶT?", a: "lower_bound (vị trí đầu tiên ≥ x). upper_bound dùng cho dãy không giảm." },
        { q: "Mảng tail có phải là một dãy con tăng dài nhất không?", a: "Không nhất thiết. Muốn dựng lại dãy phải lưu tailIdx và prev rồi đi ngược." },
        { q: "Độ phức tạp của LIS nhanh và của bản DP cơ bản?", a: "O(N log N) và O(N²)." }
      ]
    },

    {
      id: "lcs",
      name: "Dãy con chung dài nhất (LCS)",
      aliases: ["lcs", "longest common subsequence", "dãy con chung dài nhất", "xâu con chung", "common subsequence"],
      category: "dp",
      sub: "Dãy & xâu",
      level: 2,
      tags: ["dp", "lcs", "subsequence", "string"],
      summary: "Tìm dãy con chung dài nhất của hai xâu (hoặc hai dãy) bằng bảng DP O(n·m), có dựng lại và bản tiết kiệm bộ nhớ chỉ lấy độ dài.",
      description:
        "Hai ký tự cuối giống nhau thì chắc chắn có một LCS dùng cặp này; ngược lại bỏ ký tự cuối của một trong hai xâu. Từ đó có bảng DP trên các tiền tố.\n\n" +
        "- **Trạng thái:** `dp[i][j]` = độ dài LCS của `a[0..i)` và `b[0..j)`.\n" +
        "- **Công thức chuyển:** nếu `a[i-1] == b[j-1]` thì `dp[i][j] = dp[i-1][j-1] + 1`, ngược lại `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`.\n" +
        "- **Thứ tự duyệt:** `i` tăng, trong đó `j` tăng (mọi ô cần đã có sẵn).\n" +
        "- **Khởi tạo:** hàng 0 và cột 0 bằng 0 (một xâu rỗng).\n" +
        "- **Đáp án:** `dp[n][m]`; dựng lại bằng cách đi ngược từ `(n, m)`: khớp thì lấy ký tự và đi chéo, không thì đi về ô lớn hơn.\n\n" +
        "Chỉ cần độ dài thì giữ hai hàng (O(min(n, m)) bộ nhớ). Cần cả dãy với bộ nhớ nhỏ thì dùng Hirschberg; với bộ ký tự nhỏ có LCS dạng bitset O(n·m/64). LCS còn dùng cho độ dài dãy con đối xứng dài nhất: LCS(s, đảo ngược s).",
      conditions: ["Dãy con có thể bỏ phần tử (không cần liên tiếp)", "n·m đủ nhỏ để chạy (thường n, m ≤ 5000; bảng đầy đủ tốn n·m ô)", "Chỉ so sánh bằng ký tự / phần tử"],
      complexity: { time: "O(n·m)", space: "O(n·m)", note: "Chỉ lấy độ dài: O(min(n, m)) bộ nhớ (hai hàng). Hirschberg dựng lại dãy trong O(n + m) bộ nhớ." },
      ops: [["Điền bảng DP", "O(n·m)"], ["Dựng lại một LCS", "O(n + m)"]],
      use_case: ["So sánh hai chuỗi (diff, độ tương đồng) bằng số ký tự chung theo thứ tự", "Dãy con đối xứng dài nhất bằng LCS(s, đảo ngược s)", "Bài hai dãy cần ghép các phần tử bằng nhau theo thứ tự (độ dài tối đa)"],
      not_for: ["Chèn / xoá / thay ký tự với chi phí → edit-distance", "Hai hoán vị độ dài 10^5 → quy về lis (O(N log N))", "Tìm xâu con LIÊN TIẾP chung dài nhất → suffix automaton / DP khác (đoạn liên tiếp)"],
      pitfalls: [
        "Nhầm xâu con (liên tiếp) với dãy con (có thể bỏ phần tử): công thức max(trên, trái) chỉ đúng cho dãy con.",
        "Lệch chỉ số: dp[i][j] ứng với a[i - 1], b[j - 1] khi dùng mảng 1-based cho bảng; so sánh nhầm a[i] gây sai một.",
        "Hết bộ nhớ: n = m = 10^5 không thể tạo bảng n·m — chỉ giữ hai hàng hoặc dùng bitset / quy về LIS.",
        "Dựng lại khi dùng hai hàng không làm được; cần giữ cả bảng hoặc dùng Hirschberg.",
        "Nhiều LCS cùng độ dài: đề đòi \"nhỏ nhất theo từ điển\" cần cách chọn khi hoà riêng."
      ],
      code: {
        lang: "cpp", title: "lcs.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LCS của hai xâu a (n ký tự) và b (m ký tự): trả về MỘT dãy con chung dài nhất. O(n*m) thời gian và bộ nhớ.
string lcs(const string& a, const string& b) {
    int n = a.size(), m = b.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));  // dp[i][j] = LCS của a[0..i) và b[0..j)
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            dp[i][j] = a[i - 1] == b[j - 1] ? dp[i - 1][j - 1] + 1 : max(dp[i - 1][j], dp[i][j - 1]);
    string res;
    for (int i = n, j = m; i > 0 && j > 0;) {  // lần ngược từ (n, m)
        if (a[i - 1] == b[j - 1]) { res += a[i - 1]; i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
        else j--;
    }
    reverse(res.begin(), res.end());
    return res;
}

// Chỉ cần ĐỘ DÀI: hai hàng, O(min(n, m)) bộ nhớ.
int lcsLength(const string& a, const string& b) {
    const string& s = a.size() >= b.size() ? a : b;  // s: xâu dài hơn (duyệt từng ký tự)
    const string& t = a.size() >= b.size() ? b : a;  // t: xâu ngắn hơn (độ rộng một hàng)
    vector<int> prev(t.size() + 1, 0), cur(t.size() + 1, 0);
    for (char ch : s) {
        for (size_t j = 1; j <= t.size(); j++)
            cur[j] = ch == t[j - 1] ? prev[j - 1] + 1 : max(prev[j], cur[j - 1]);
        swap(prev, cur);
    }
    return prev.back();
}
`
      },
      example: {
        input: "AGGTAB\nGXTXAYB",
        output: "4\nGTAB",
        explain: "LCS của AGGTAB và GXTXAYB là GTAB (độ dài 4): G, T, A, B xuất hiện theo đúng thứ tự trong cả hai xâu."
      },
      problems: [
        { site: "cses", id: "3403", name: "Longest Common Subsequence" },
        { site: "atcoder", name: "LCS" },
        { site: "lc", name: "Longest Common Subsequence" }
      ],
      related: ["edit-distance", "lis", "interval-dp"],
      compare: { "Dạng trạng thái": "dp[i][j]: tiền tố i của A, tiền tố j của B", "Số trạng thái": "n·m", "Chuyển trạng thái": "Khớp: +1 theo đường chéo; không: max(trên, trái) — O(1)", "Bộ nhớ": "O(n·m); O(min(n, m)) nếu chỉ cần độ dài" },
      cards: [
        { q: "Công thức chuyển của LCS?", a: "Nếu a[i-1] == b[j-1]: dp[i][j] = dp[i-1][j-1] + 1; ngược lại dp[i][j] = max(dp[i-1][j], dp[i][j-1])." },
        { q: "Độ phức tạp của LCS và cách giảm bộ nhớ?", a: "O(n·m) thời gian; chỉ cần độ dài thì giữ hai hàng (O(min(n, m)) bộ nhớ); dựng lại với bộ nhớ nhỏ dùng Hirschberg." },
        { q: "LCS khác edit distance ở điểm nào?", a: "LCS chỉ đếm ký tự chung theo thứ tự; edit distance tính số thao tác chèn/xoá/thay tối thiểu. Khoảng cách chỉ chèn/xoá = n + m - 2·LCS." },
        { q: "Hai hoán vị độ dài 10^5, tìm LCS nhanh thế nào?", a: "Đánh số lại theo vị trí trong hoán vị thứ nhất rồi tìm LIS của hoán vị thứ hai: O(N log N)." }
      ]
    },

    {
      id: "edit-distance",
      name: "Khoảng cách chỉnh sửa (Edit Distance)",
      aliases: ["edit distance", "levenshtein", "khoảng cách levenshtein", "khoảng cách chỉnh sửa", "số thao tác biến đổi xâu", "string distance"],
      category: "dp",
      sub: "Dãy & xâu",
      level: 2,
      tags: ["dp", "edit-distance", "levenshtein", "string"],
      summary: "Số thao tác chèn, xoá, thay một ký tự ít nhất để biến xâu a thành xâu b, tính bằng DP O(n·m).",
      description:
        "Xét tiền tố `a[0..i)` biến thành `b[0..j)`. Ký tự cuối của a có thể bị xoá, ký tự cuối của b có thể được chèn, hoặc hai ký tự cuối ghép với nhau (không tốn nếu bằng nhau, tốn 1 nếu thay).\n\n" +
        "- **Trạng thái:** `dp[i][j]` = số thao tác ít nhất biến `a[0..i)` thành `b[0..j)`.\n" +
        "- **Công thức chuyển:** `dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] != b[j-1]))`.\n" +
        "- **Thứ tự duyệt:** `i` tăng, trong đó `j` tăng.\n" +
        "- **Khởi tạo:** `dp[i][0] = i` (xoá hết), `dp[0][j] = j` (chèn hết).\n" +
        "- **Đáp án:** `dp[n][m]`.\n\n" +
        "Giữ hai hàng cho O(m) bộ nhớ; để in dãy thao tác thì giữ cả bảng và đi ngược từ `(n, m)`. Chi phí khác nhau cho từng thao tác chỉ cần thay các số `+1` bằng chi phí tương ứng; thêm thao tác hoán vị hai ký tự kề nhau là khoảng cách Damerau–Levenshtein. Nếu biết khoảng cách không vượt k, chỉ cần dải đường chéo rộng 2k+1: O(n·k).",
      conditions: ["Ba thao tác: chèn, xoá, thay một ký tự (mỗi thao tác chi phí 1 trong mẫu)", "n·m đủ nhỏ (thường n, m ≤ 5000)", "Hai xâu hoặc hai dãy so sánh được từng phần tử"],
      complexity: { time: "O(n·m)", space: "O(m)", note: "Hai hàng cuộn: O(min(n, m)); dựng lại thao tác cần giữ bảng O(n·m). Có giới hạn khoảng cách k: O(n·k)." },
      ops: [["Điền bảng DP", "O(n·m)"], ["Dựng lại dãy thao tác", "O(n + m)"]],
      use_case: ["Gợi ý sửa chính tả, so khớp mờ (fuzzy matching)", "So sánh hai chuỗi trong diff / đồng bộ dữ liệu", "Bài \"biến A thành B bằng ít thao tác nhất\""],
      not_for: ["Chỉ cho phép chèn / xoá → n + m - 2·LCS (lcs)", "Tìm mẫu xuất hiện trong văn bản với ít lỗi cho phép → thuật toán xấp xỉ khớp (Sellers / bitap)", "Xâu rất dài (10^5 trở lên) với khoảng cách lớn → cần kỹ thuật khác"],
      pitfalls: [
        "Quên khởi tạo hàng 0 và cột 0: dp[i][0] = i, dp[0][j] = j; để toàn 0 cho đáp án quá nhỏ.",
        "Lệch chỉ số: dp[i][j] ứng với a[i - 1] và b[j - 1]; so sánh a[i] với b[j] gây sai một.",
        "Nhầm thay thế (một thao tác) với xoá + chèn (hai thao tác): thay luôn rẻ hơn khi hai ký tự khác nhau.",
        "Khi đổi chi phí thao tác không đối xứng (chèn khác xoá), phải giữ đúng hướng a → b trong từng hạng tử.",
        "Dùng hai hàng thì không dựng lại được dãy thao tác."
      ],
      code: {
        lang: "cpp", title: "edit_distance.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Khoảng cách chỉnh sửa (Levenshtein): số thao tác chèn / xoá / thay một ký tự ít nhất biến a thành b.
// O(n*m) thời gian, O(m) bộ nhớ (hai hàng cuộn).
int editDistance(const string& a, const string& b) {
    int n = a.size(), m = b.size();
    vector<int> prev(m + 1), cur(m + 1);
    for (int j = 0; j <= m; j++) prev[j] = j;  // a rỗng → b: chèn j ký tự
    for (int i = 1; i <= n; i++) {
        cur[0] = i;  // xoá i ký tự của a
        for (int j = 1; j <= m; j++)
            cur[j] = min({prev[j] + 1,                                 // xoá a[i-1]
                          cur[j - 1] + 1,                              // chèn b[j-1]
                          prev[j - 1] + (a[i - 1] != b[j - 1] ? 1 : 0)});  // khớp (0) hoặc thay (1)
        swap(prev, cur);
    }
    return prev[m];
}
`
      },
      example: {
        input: "kitten\nsitting",
        output: "3",
        explain: "kitten → sitten (thay k thành s) → sittin (thay e thành i) → sitting (chèn g): 3 thao tác, và không thể ít hơn."
      },
      problems: [
        { site: "cses", id: "1639", name: "Edit Distance" },
        { site: "lc", name: "Edit Distance" }
      ],
      related: ["lcs", "kmp", "rolling-hash"],
      compare: { "Dạng trạng thái": "dp[i][j]: biến tiền tố i của A thành tiền tố j của B", "Số trạng thái": "n·m", "Chuyển trạng thái": "min(xoá, chèn, thay/khớp) — O(1)", "Bộ nhớ": "O(m) hai hàng; O(n·m) nếu cần dựng lại" },
      cards: [
        { q: "Công thức chuyển của edit distance?", a: "dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] != b[j-1]))." },
        { q: "Khởi tạo dp của edit distance?", a: "dp[i][0] = i (xoá hết i ký tự) và dp[0][j] = j (chèn j ký tự)." },
        { q: "Khoảng cách chỉ cho chèn và xoá liên hệ với LCS thế nào?", a: "n + m - 2·LCS(a, b)." },
        { q: "Độ phức tạp và cách tiết kiệm bộ nhớ?", a: "O(n·m) thời gian; giữ hai hàng cho O(m) bộ nhớ (mất khả năng dựng lại thao tác)." }
      ]
    },

    // ============================================================================================================== Trạng thái nén
    {
      id: "bitmask-dp",
      name: "Bitmask DP",
      aliases: ["bitmask dp", "dp bitmask", "dp trạng thái nén", "dp tập con", "tsp", "người bán hàng", "travelling salesman", "chu trình hamilton", "dp trên tập con"],
      category: "dp",
      sub: "Trạng thái nén",
      level: 3,
      tags: ["dp", "bitmask", "tsp", "subset", "hamilton"],
      summary: "Dùng một số nguyên (mặt nạ bit) làm trạng thái cho tập con của n ≤ ~20 phần tử; mẫu chuẩn là chu trình Hamilton ngắn nhất (TSP) O(2^n · n^2).",
      description:
        "Khi n nhỏ (≤ 20), một tập con của {0..n-1} chính là số `mask` trong `[0, 2^n)`: bit `j` bật nghĩa là phần tử `j` đã nằm trong tập. DP lưu thêm thông tin cần thiết (thường là phần tử cuối cùng) rồi mở rộng tập từng phần tử.\n\n" +
        "**Mẫu TSP:**\n" +
        "- **Trạng thái:** `dp[mask][j]` = chi phí nhỏ nhất để đi từ thành phố xuất phát qua đúng các thành phố trong `mask` và dừng ở `j` (`j` thuộc `mask`).\n" +
        "- **Công thức chuyển:** `dp[mask | (1<<k)][k] = min(dp[mask][j] + d[j][k])` với `k` chưa thuộc `mask`.\n" +
        "- **Thứ tự duyệt:** `mask` tăng dần (mọi tập con thật sự của `mask` nhỏ hơn `mask`).\n" +
        "- **Khởi tạo:** `dp[{j}][j] = d[0][j]`; mọi ô còn lại `INF`. Cố định thành phố 0 làm điểm xuất phát nên chỉ cần mặt nạ trên n-1 thành phố còn lại (giảm một nửa bộ nhớ).\n" +
        "- **Đáp án:** `min_j dp[full][j] + d[j][0]` (nhớ đóng chu trình).\n\n" +
        "Cùng khung này giải bài gán việc (`dp[mask]` = người thứ `popcount(mask)` làm việc nào), đếm hoán vị thoả điều kiện kề nhau, hoặc đếm đường đi Hamilton. Duyệt mọi tập con của mọi tập (`for (sub = mask; sub; sub = (sub - 1) & mask)`) tổng cộng 3^n bước.",
      conditions: ["Số phần tử n nhỏ (thường n ≤ 20; n ≤ 16–18 khi có thêm một chiều trạng thái)", "Thứ tự thăm / chọn có thể biểu diễn qua tập đã dùng và vài thông tin phụ (phần tử cuối)", "Bộ nhớ cho 2^n · n số (n = 20 với long long tốn ~80 MB nếu cố định điểm xuất phát)"],
      complexity: { time: "O(2^n · n^2)", space: "O(2^n · n)", note: "Gán việc dp[mask]: O(2^n · n). Duyệt mọi tập con của mọi tập: O(3^n)." },
      ops: [["TSP đầy đủ", "O(2^n · n^2)"], ["Gán việc theo mặt nạ", "O(2^n · n)"], ["Duyệt tập con của mọi tập", "O(3^n)"]],
      use_case: ["Người bán hàng (TSP) với n ≤ 20: chu trình hoặc đường đi Hamilton ngắn nhất / đếm đường", "Gán n người cho n việc có điều kiện, đếm ghép cặp hoàn hảo khi n ≤ 20", "Chia n phần tử thành nhóm theo ràng buộc (ví dụ thang máy chở người)"],
      not_for: ["n lớn (≥ 25) → heuristic (simulated-annealing, ...) hoặc thuật toán khác", "Gán việc cực tiểu với n lớn → hungarian (O(n^3))", "Ghép cặp cực đại trên đồ thị hai phía → bipartite-matching"],
      pitfalls: [
        "Thiếu ngoặc khi kiểm tra bit: if (mask & (1 << j) == 0) sai vì == ưu tiên hơn &; viết !(mask & (1 << j)).",
        "1 << j tràn int khi j ≥ 31 (dùng 1LL << j nếu n > 31 — thực tế n ≤ 20 nên ổn).",
        "Bộ nhớ 2^n · n · 8 byte: n = 20 với long long là ~168 MB; cố định điểm xuất phát (giảm một bit) hoặc dùng int.",
        "Quên đóng chu trình (cộng d[cuối][0]) hoặc quên khả năng không có chu trình (INF): đừng cộng INF vào tổng.",
        "Duyệt mask sai thứ tự (giảm dần) làm trạng thái nguồn chưa được tính."
      ],
      code: {
        lang: "cpp", title: "tsp_bitmask.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// TSP (bitmask DP): chu trình ngắn nhất xuất phát từ thành phố 0, qua mọi thành phố đúng một lần rồi về 0.
// d[i][j] = chi phí đi i -> j (có thể bất đối xứng); d[i][j] >= TSP_INF nghĩa là không có đường. n <= ~20.
// Bộ nhớ 2^(n-1) * (n-1) số long long (cố định thành phố 0 nên bỏ bớt một bit). O(2^n * n^2) thời gian.
// Trả về TSP_INF nếu không có chu trình. tour (tuỳ chọn): thứ tự thăm bắt đầu từ 0 (n thành phố; quay về 0 ngầm hiểu).
const long long TSP_INF = (long long)4e18;

long long tspBitmask(const vector<vector<long long>>& d, vector<int>* tour = nullptr) {
    int n = d.size();
    if (tour) tour->clear();
    if (n == 0) return 0;
    if (n == 1) { if (tour) tour->push_back(0); return 0; }
    int m = n - 1, full = (1 << m) - 1;  // thành phố 1..n-1 ứng với bit 0..m-1
    vector<long long> dp((size_t)(full + 1) * m, TSP_INF);  // dp[mask * m + j]: đã thăm mask, đang ở thành phố j+1
    for (int j = 0; j < m; j++)
        if (d[0][j + 1] < TSP_INF) dp[(size_t)(1 << j) * m + j] = d[0][j + 1];
    for (int mask = 1; mask <= full; mask++)  // mask tăng dần: mọi trạng thái nguồn đã xong
        for (int j = 0; j < m; j++) {
            long long cur = dp[(size_t)mask * m + j];
            if (!((mask >> j) & 1) || cur >= TSP_INF) continue;
            for (int k = 0; k < m; k++) {
                if (((mask >> k) & 1) || d[j + 1][k + 1] >= TSP_INF) continue;
                long long& nxt = dp[(size_t)(mask | (1 << k)) * m + k];
                nxt = min(nxt, cur + d[j + 1][k + 1]);
            }
        }
    long long best = TSP_INF;
    int last = -1;
    for (int j = 0; j < m; j++) {  // đóng chu trình: quay về thành phố 0
        long long cur = dp[(size_t)full * m + j];
        if (cur < TSP_INF && d[j + 1][0] < TSP_INF && cur + d[j + 1][0] < best) { best = cur + d[j + 1][0]; last = j; }
    }
    if (last < 0) return TSP_INF;
    if (tour) {  // lần ngược: tìm trạng thái nguồn cho ra đúng giá trị dp hiện tại
        vector<int> rev;
        for (int mask = full, cur = last;;) {
            rev.push_back(cur + 1);
            int pm = mask ^ (1 << cur), pick = -1;
            if (pm == 0) break;
            for (int i = 0; i < m && pick < 0; i++) {
                long long f = dp[(size_t)pm * m + i];
                if (((pm >> i) & 1) && f < TSP_INF && d[i + 1][cur + 1] < TSP_INF && f + d[i + 1][cur + 1] == dp[(size_t)mask * m + cur]) pick = i;
            }
            mask = pm;
            cur = pick;
        }
        tour->push_back(0);
        tour->insert(tour->end(), rev.rbegin(), rev.rend());
    }
    return best;
}
`
      },
      example: {
        input: "4\n0 10 15 20\n10 0 35 25\n15 35 0 30\n20 25 30 0",
        output: "80\n0 2 3 1",
        explain: "4 thành phố (đánh số từ 0) với ma trận chi phí đối xứng. Chu trình 0 → 2 → 3 → 1 → 0 tốn 15 + 30 + 25 + 10 = 80 (chiều ngược lại 0 → 1 → 3 → 2 → 0 cũng 80), tốt hơn 0 → 1 → 2 → 3 → 0 (10 + 35 + 30 + 20 = 95)."
      },
      problems: [
        { site: "cses", id: "1690", name: "Hamiltonian Flights" },
        { site: "cses", id: "1653", name: "Elevator Rides" },
        { site: "cf", id: "580D", name: "Kefa and Dishes" },
        { site: "atcoder", name: "Matching" }
      ],
      related: ["meet-in-the-middle", "hungarian", "bit-manipulation", "sos-dp", "backtracking"],
      compare: { "Dạng trạng thái": "dp[mask][last]: tập đã chọn + phần tử cuối", "Số trạng thái": "2^n · n", "Chuyển trạng thái": "Thêm một phần tử mới — O(n)", "Bộ nhớ": "O(2^n · n)" },
      cards: [
        { q: "Bitmask DP dùng được khi nào?", a: "Khi số phần tử n nhỏ (thường ≤ 20) để duyệt hết 2^n tập con, và trạng thái chỉ cần tập đã dùng (+ vài thông tin phụ như phần tử cuối)." },
        { q: "Độ phức tạp TSP bitmask?", a: "O(2^n · n^2) thời gian, O(2^n · n) bộ nhớ." },
        { q: "Cách duyệt mọi tập con sub của mask?", a: "for (int sub = mask; sub; sub = (sub - 1) & mask); tổng chi phí qua mọi mask là O(3^n)." },
        { q: "Lỗi ưu tiên toán tử hay gặp khi kiểm tra bit?", a: "mask & (1 << j) == 0 bị hiểu thành mask & ((1 << j) == 0). Phải viết !(mask & (1 << j)) hoặc ((mask >> j) & 1) == 0." }
      ]
    },

    // ============================================================================================================== Trên cây & chữ số
    {
      id: "digit-dp",
      name: "Digit DP",
      aliases: ["digit dp", "dp chữ số", "đếm số theo chữ số", "dp theo chữ số", "count numbers digit", "đếm số trong đoạn"],
      category: "dp",
      sub: "Trên cây & chữ số",
      level: 4,
      tags: ["dp", "digit-dp", "counting", "number-theory"],
      summary: "Đếm các số trong [0, N] (hoặc [L, R]) có tính chất phụ thuộc vào các chữ số, bằng DP trên vị trí chữ số có cờ bị chặn bởi N.",
      description:
        "Số nguyên được xem là chuỗi chữ số. Duyệt từ chữ số cao tới thấp; trạng thái gồm vị trí, **trạng thái phụ** mô tả tính chất cần kiểm (chữ số trước đó, tổng chữ số, số dư...), cờ `tight` (tiền tố đang bằng tiền tố của N hay đã nhỏ hơn) và đôi khi cờ `started` (đã gặp chữ số khác 0, để bỏ qua số 0 đứng đầu). Mẫu dưới đếm các số trong `[0, N]` **không có hai chữ số liền kề bằng nhau**.\n\n" +
        "- **Trạng thái:** `f[pos][p]` = số cách điền các vị trí `pos..len-1` **tự do** (không còn bị N chặn) khi chữ số liền trước là `p` (`p = 10`: chưa có chữ số khác 0).\n" +
        "- **Công thức chuyển:** `f[pos][p] = Σ f[pos+1][d]` với `d ≠ p` (và `d = 0` khi `p = 10` giữ `p = 10`).\n" +
        "- **Thứ tự duyệt:** `pos` từ cuối về đầu để tính `f`; sau đó đi dọc các chữ số của N (nhánh tight): tại mỗi `pos`, cộng `f[pos+1][·]` cho mọi chữ số `d` nhỏ hơn chữ số của N.\n" +
        "- **Khởi tạo:** `f[len][·] = 1` (điền xong một số hợp lệ, kể cả số 0).\n" +
        "- **Đáp án:** tổng các nhánh nhỏ hơn N cộng 1 nếu chính N hợp lệ.\n\n" +
        "Đếm trong `[L, R]` bằng `f(R) - f(L - 1)`. Thay trạng thái phụ bằng tổng chữ số (hoặc tổng chữ số mod K) để đếm số có tổng chữ số đặc biệt. Độ phức tạp O(số chữ số × số trạng thái phụ × 10).",
      conditions: ["Tính chất cần đếm kiểm được từng chữ số một và gói được trong trạng thái nhỏ (chữ số trước, tổng, số dư...)", "Cận N cho dưới dạng chuỗi chữ số (N tới 10^18 trở lên)", "Trạng thái phụ có số giá trị nhỏ (cỡ vài trăm đến vài nghìn)"],
      complexity: { time: "O(L · S · 10)", space: "O(L · S)", note: "L là số chữ số của N, S là số giá trị của trạng thái phụ (mẫu: 11 giá trị chữ số trước)." },
      use_case: ["Đếm số trong [L, R] có tổng chữ số chia hết cho K hoặc có chữ số cấm", "Đếm số không có hai chữ số liền kề bằng nhau hoặc có mẫu chữ số đặc biệt", "Đếm / tính tổng các số \"đẹp\" khi R lên tới 10^18"],
      not_for: ["Tính chất không quy được về từng chữ số (ví dụ số nguyên tố) → sàng, Miller-Rabin", "Khoảng ngắn (R - L ≤ 10^7) → duyệt thẳng", "Cần liệt kê thật các số → backtracking"],
      pitfalls: [
        "Số 0 đứng đầu không phải chữ số thật: nếu không phân biệt (cờ started / p = 10) sẽ đếm sai điều kiện như \"hai chữ số liền kề bằng nhau\" với 007.",
        "Đếm [L, R] bằng f(R) - f(L - 1) cần L ≥ 1; với L = 0 phải xử lý riêng, tránh L - 1 âm.",
        "Quên nhánh tight cuối cùng (chính N) hoặc vẫn đếm tiếp khi tiền tố của N đã vi phạm điều kiện.",
        "Chỉ nên ghi nhớ trạng thái KHÔNG còn bị chặn (tight = false); ghi nhớ trạng thái tight dùng chung giữa các N khác nhau cho kết quả sai.",
        "Tràn số khi đếm có trọng số hoặc cần tổng các số: dùng long long / __int128 hoặc modulo."
      ],
      code: {
        lang: "cpp", title: "digit_dp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Digit DP: đếm số nguyên x trong [0, N] mà biểu diễn thập phân KHÔNG có hai chữ số liền kề bằng nhau (0 được tính).
// N là chuỗi chữ số thập phân (không có số 0 thừa đầu, "0" cho N = 0). Đếm trong [L, R] (L >= 1):
//     countNoAdjacentEqual(to_string(R)) - countNoAdjacentEqual(to_string(L - 1)).
// O(len * 11 * 10). Đổi trạng thái p (chữ số trước) thành tổng chữ số / số dư để làm bài khác.
long long countNoAdjacentEqual(const string& N) {
    int len = N.size();
    // f[pos][p]: số cách điền TỰ DO các vị trí pos..len-1 khi chữ số khác 0 liền trước là p (p = 10: chưa bắt đầu)
    vector<array<long long, 11>> f(len + 1);
    f[len].fill(1);
    for (int pos = len - 1; pos >= 0; pos--)
        for (int p = 0; p <= 10; p++) {
            long long s = 0;
            for (int d = 0; d <= 9; d++) {
                if (p == 10 && d == 0) s += f[pos + 1][10];  // vẫn là số 0 đứng đầu
                else if (d != p) s += f[pos + 1][d];
            }
            f[pos][p] = s;
        }
    long long ans = 0;
    int p = 10;  // đi dọc các chữ số của N (nhánh tight)
    for (int pos = 0; pos < len; pos++) {
        int lim = N[pos] - '0';
        for (int d = 0; d < lim; d++) {  // chọn chữ số nhỏ hơn lim → phần sau tự do
            if (p == 10 && d == 0) ans += f[pos + 1][10];
            else if (d != p) ans += f[pos + 1][d];
        }
        if (p != 10 && lim == p) return ans;  // chữ số của N đã vi phạm: N và mọi số cùng tiền tố bị loại
        p = (p == 10 && lim == 0) ? 10 : lim;
    }
    return ans + 1;  // chính N hợp lệ
}
`
      },
      example: {
        input: "120",
        output: "101",
        explain: "Trong [0, 120]: 0..9 đều hợp lệ (10 số); 10..99 có 81 số (90 trừ 9 số 11, 22, ..., 99); 100..120 chỉ 101..109 và 120 hợp lệ (10 số). Tổng 10 + 81 + 10 = 101."
      },
      problems: [
        { site: "cses", id: "2220", name: "Counting Numbers" },
        { site: "cf", id: "55D", name: "Beautiful numbers" },
        { site: "atcoder", name: "Digit Sum" },
        { site: "lc", name: "Numbers With Repeated Digits" }
      ],
      related: ["bitmask-dp", "knapsack-01", "tree-dp", "binary-search"],
      compare: { "Dạng trạng thái": "(vị trí, tight, started, trạng thái phụ)", "Số trạng thái": "L · S (L chữ số, S trạng thái phụ)", "Chuyển trạng thái": "Thử 10 chữ số — O(10)", "Bộ nhớ": "O(L · S)" },
      cards: [
        { q: "Digit DP dùng để giải loại bài nào?", a: "Đếm (hoặc tính tổng) các số trong [L, R] có tính chất phụ thuộc từng chữ số, khi R rất lớn (10^18)." },
        { q: "Cờ tight nghĩa là gì?", a: "Tiền tố đã chọn đang bằng đúng tiền tố của N: chữ số tiếp theo bị chặn trên bởi chữ số của N. Khi đã nhỏ hơn, các chữ số sau tự do (0..9)." },
        { q: "Đếm trong [L, R] thế nào?", a: "f(R) - f(L - 1) với f(N) đếm trong [0, N]; chú ý L = 0 phải xử lý riêng." },
        { q: "Số 0 đứng đầu gây lỗi gì?", a: "Nếu coi là chữ số thật thì các điều kiện như \"hai chữ số liền kề khác nhau\" hoặc \"chữ số khác 0\" bị tính sai; cần cờ started (hoặc trạng thái \"chưa bắt đầu\")." }
      ]
    },

    {
      id: "tree-dp",
      name: "Tree DP",
      aliases: ["tree dp", "dp trên cây", "dp cây", "tập độc lập lớn nhất trên cây", "maximum independent set tree", "đường kính cây dp", "rerooting"],
      category: "dp",
      sub: "Trên cây & chữ số",
      level: 3,
      tags: ["dp", "tree", "independent-set", "dfs"],
      summary: "DP gộp kết quả của các cây con vào đỉnh cha; mẫu là tập độc lập trọng số lớn nhất trên cây/rừng, O(N), không đệ quy.",
      description:
        "Với cây có gốc, bài toán của cây con gốc `v` được suy ra từ bài toán của các con. Ta tính từ lá lên gốc (thứ tự hậu tự), mỗi đỉnh giữ một vài giá trị theo trạng thái của chính nó. Mẫu: chọn tập đỉnh **không có hai đỉnh kề nhau** sao cho tổng trọng số lớn nhất.\n\n" +
        "- **Trạng thái:** `in[v]` = tổng lớn nhất trong cây con của `v` khi **chọn** `v`; `out[v]` = khi **không chọn** `v`.\n" +
        "- **Công thức chuyển:** `in[v] = w[v] + Σ out[c]`, `out[v] = Σ max(in[c], out[c])` (duyệt mọi con `c`).\n" +
        "- **Thứ tự duyệt:** hậu tự — mọi con xử lý trước cha. Mẫu sinh thứ tự bằng BFS rồi duyệt ngược, nên **không đệ quy** (an toàn với cây dạng đường 10^6 đỉnh).\n" +
        "- **Khởi tạo:** `in[v] = w[v]`, `out[v] = 0` trước khi cộng các con.\n" +
        "- **Đáp án:** `max(in[gốc], out[gốc])`; dựng lại bằng cách đi từ gốc xuống: cha được chọn thì con không chọn.\n\n" +
        "Cùng khung này giải đường kính cây (lưu hai nhánh sâu nhất qua mỗi đỉnh), ghép cặp tối đa trên cây, đếm cách tô màu, balô trên cây (gộp mảng con theo kiểu balô). Khi cần đáp án cho **mọi** đỉnh làm gốc, dùng kỹ thuật dời gốc (rerooting): một lượt xuống và một lượt lên.",
      conditions: ["Đồ thị là cây hoặc rừng (không có chu trình)", "Bài toán trên cây con gốc v suy ra được từ các con (tính chất tối ưu con)", "Trạng thái mỗi đỉnh nhỏ (vài giá trị)"],
      complexity: { time: "O(N)", space: "O(N)", note: "Balô trên cây có số trạng thái k mỗi đỉnh: O(N·K) hoặc O(N·K^2) tuỳ cách gộp; rerooting vẫn O(N)." },
      use_case: ["Tập độc lập / phủ đỉnh / tập thống trị tối ưu trên cây", "Đường kính cây, khoảng cách xa nhất từ mỗi đỉnh (rerooting)", "Đếm cách tô màu hoặc chọn đỉnh thoả điều kiện kề nhau trên cây"],
      not_for: ["Đồ thị có chu trình tổng quát → bài NP-khó; dùng cách khác tuỳ cấu trúc", "Chỉ cần LCA / khoảng cách hai đỉnh → lca", "Truy vấn đường đi / cập nhật cây động → hld, centroid-decomposition"],
      pitfalls: [
        "Đệ quy DFS trên cây dạng đường 10^5–10^6 đỉnh dễ tràn ngăn xếp: dùng thứ tự BFS và duyệt ngược (như mẫu) hoặc tăng kích thước stack.",
        "Quên ràng buộc cha–con: chọn v thì các con bắt buộc không chọn (in[v] chỉ cộng out[c]).",
        "Đồ thị có chu trình thì kết quả sai âm thầm; rừng nhiều thành phần cần cộng đáp án từng cây.",
        "Trọng số âm: đừng ép chọn lá; lấy max(in, out) ở mọi đỉnh.",
        "Cần đáp án cho mọi gốc mà chạy lại O(N) cho mỗi gốc → O(N^2); dùng rerooting."
      ],
      code: {
        lang: "cpp", title: "tree_dp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Tree DP: tập độc lập trọng số lớn nhất trên CÂY hoặc RỪNG (không chọn hai đỉnh kề nhau). w[v] có thể âm.
// Đỉnh 0..n-1; g[u] = danh sách kề (vô hướng, không có chu trình). KHÔNG đệ quy: thứ tự BFS rồi duyệt ngược → an toàn với cây sâu 10^6.
// pick (tuỳ chọn): pick[v] = 1 nếu v được chọn. Trả về tổng trọng số lớn nhất (0 nếu không chọn gì). O(n).
long long treeMaxWeightIndependentSet(const vector<vector<int>>& g, const vector<long long>& w, vector<char>* pick = nullptr) {
    int n = g.size();
    vector<int> par(n, -1), order;
    order.reserve(n);
    vector<char> seen(n, 0);
    for (int s = 0; s < n; s++) {  // mỗi thành phần liên thông lấy một gốc
        if (seen[s]) continue;
        seen[s] = 1;
        size_t head = order.size();
        order.push_back(s);
        for (size_t h = head; h < order.size(); h++)
            for (int v : g[order[h]])
                if (!seen[v]) { seen[v] = 1; par[v] = order[h]; order.push_back(v); }
    }
    vector<long long> in(w), out(n, 0);  // in[v]: chọn v; out[v]: không chọn v (trong cây con của v)
    long long total = 0;
    for (int i = n - 1; i >= 0; i--) {  // con luôn nằm sau cha trong order → duyệt ngược: con xong trước cha
        int v = order[i];
        if (par[v] >= 0) {
            in[par[v]] += out[v];
            out[par[v]] += max(in[v], out[v]);
        } else {
            total += max(in[v], out[v]);
        }
    }
    if (pick) {
        pick->assign(n, 0);
        for (int v : order) {  // cha luôn được xét trước con
            bool parentTaken = par[v] >= 0 && (*pick)[par[v]];
            (*pick)[v] = !parentTaken && in[v] > out[v];
        }
    }
    return total;
}
`
      },
      example: {
        input: "5\n4 3 5 2 6\n1 2\n1 3\n3 4\n3 5",
        output: "12\n1 4 5",
        explain: "Cây 5 đỉnh với trọng số 4 3 5 2 6 và cạnh 1-2, 1-3, 3-4, 3-5. Chọn đỉnh 1, 4, 5 (không cặp nào kề nhau): 4 + 2 + 6 = 12; chọn 2, 4, 5 chỉ được 11; chọn 2 và 3 chỉ được 8."
      },
      problems: [
        { site: "cses", id: "1130", name: "Tree Matching" },
        { site: "cses", id: "1131", name: "Tree Diameter" },
        { site: "cses", id: "1132", name: "Tree Distances I" },
        { site: "atcoder", name: "Independent Set" },
        { site: "lc", name: "House Robber III" }
      ],
      related: ["tree-diameter", "lca", "hld", "centroid-decomposition", "dfs"],
      compare: { "Dạng trạng thái": "dp[v][trạng thái của v] trên cây con của v", "Số trạng thái": "N · (số trạng thái mỗi đỉnh)", "Chuyển trạng thái": "Gộp kết quả các con — tổng O(N) cho mọi đỉnh", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "Công thức tập độc lập trọng số lớn nhất trên cây?", a: "in[v] = w[v] + Σ out[c]; out[v] = Σ max(in[c], out[c]); đáp án max(in[gốc], out[gốc])." },
        { q: "Làm sao tránh tràn ngăn xếp khi cây là đường dài 10^6 đỉnh?", a: "Sinh thứ tự BFS/DFS bằng vòng lặp, rồi xử lý các đỉnh theo thứ tự ngược (con trước cha), không dùng đệ quy." },
        { q: "Cần đáp án cho mọi đỉnh làm gốc thì làm sao?", a: "Dời gốc (rerooting): một lượt xuống tính dp cây con, một lượt lên truyền phần còn lại của cây, tổng O(N)." },
        { q: "Độ phức tạp tree dp?", a: "O(N) thời gian và O(N) bộ nhớ khi mỗi đỉnh có số trạng thái hằng số." }
      ]
    },

    // ============================================================================================================== Tối ưu DP
    {
      id: "sos-dp",
      name: "SOS DP (tổng trên tập con)",
      aliases: ["sos dp", "sum over subsets", "tổng trên tập con", "tổng trên tập cha", "zeta transform", "subset zeta", "dp trên submask", "mobius subset"],
      category: "dp",
      sub: "Trạng thái nén",
      level: 4,
      tags: ["dp", "sos", "bitmask", "subset-sum", "zeta-transform"],
      summary: "Tính f[mask] = tổng a[s] trên mọi tập con s của mask cho cả 2^k mặt nạ trong O(k · 2^k), thay vì O(3^k).",
      description:
        "Biến đổi zeta trên dàn các tập con: với mỗi bit, tập có bit đó nhận thêm giá trị của tập giống nó nhưng thiếu bit. Sau khi xử lý lần lượt từng bit, mỗi `mask` đã cộng đúng một lần mọi tập con của nó.\n\n" +
        "- **Trạng thái:** sau khi xử lý các bit `0..b`, `f[mask]` là tổng `a[s]` trên các tập con `s` của `mask` mà **chỉ khác `mask` ở các bit `0..b`**.\n" +
        "- **Công thức chuyển:** khi xử lý bit `b`: `f[mask] += f[mask ^ (1<<b)]` với mọi `mask` có bit `b` bật.\n" +
        "- **Thứ tự duyệt:** vòng **ngoài là bit**, vòng trong là `mask` (thứ tự `mask` bất kỳ).\n" +
        "- **Khởi tạo:** `f = a`.\n" +
        "- **Đáp án:** mảng `f` sau khi xử lý hết `k` bit.\n\n" +
        "Biến thể: tổng trên **tập cha** (`mask` là tập con của `s`): với mask có bit `b` TẮT, `f[mask] += f[mask | (1<<b)]`. Phép trừ tương ứng (đổi `+=` thành `-=`, cùng thứ tự bit) khôi phục `a` từ `f` (Möbius). Cách làm đúng với mọi phép gộp giao hoán (cộng, max, OR...). Ứng dụng điển hình: với mỗi `x` đếm số `a_i` là tập con (hoặc tập cha) của `x`, đếm cặp có `a_i & a_j = 0`.",
      conditions: ["Phần tử đánh số bằng mặt nạ k bit (k ≤ ~20–22) và mảng kích thước 2^k vừa bộ nhớ", "Phép gộp giao hoán và kết hợp (cộng, max, OR...); đảo ngược cần có phép trừ", "Câu hỏi dạng \"tổng / đếm / tối ưu trên mọi tập con (hoặc tập cha)\""],
      complexity: { time: "O(k · 2^k)", space: "O(2^k)", note: "So với duyệt trực tiếp mọi tập con của mọi mask: O(3^k)." },
      ops: [["Tổng trên tập con (zeta)", "O(k · 2^k)"], ["Tổng trên tập cha", "O(k · 2^k)"], ["Khôi phục (Möbius)", "O(k · 2^k)"]],
      use_case: ["Với mỗi x đếm số phần tử a_i là tập con bit của x (hoặc tập cha)", "Đếm số cặp (i, j) có a_i & a_j = 0 bằng bảng tập con của phần bù", "Bước con của tích chập tập con (subset convolution) và nhiều bài đếm dựa trên mặt nạ"],
      not_for: ["Chỉ cần vài mặt nạ riêng lẻ → duyệt trực tiếp 2^popcount mặt nạ con của từng mask", "Số bit k lớn (> 25) → không đủ bộ nhớ / thời gian", "Bài chọn dãy phần tử có thứ tự → bitmask-dp"],
      pitfalls: [
        "Đảo vòng lặp (mask ở ngoài, bit ở trong): kết quả sai vì một tập con có thể được cộng nhiều lần hoặc thiếu. Bit phải là vòng ngoài.",
        "Nhầm hướng tập con và tập cha: tập con cộng từ mask ^ bit khi mask có bit; tập cha cộng từ mask | bit khi mask KHÔNG có bit.",
        "Kích thước mảng phải đúng 2^k: k = 20 → 10^6 phần tử, k = 25 đã ~3·10^7 phần tử long long (~270 MB).",
        "Tràn int khi cộng dồn trên 2^k phần tử: dùng long long hoặc modulo.",
        "Đếm cặp có a_i & a_j = 0: tra tại phần bù (~a_i) & (2^k - 1), nhớ che các bit cao hơn k."
      ],
      code: {
        lang: "cpp", title: "sos_dp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// SOS DP. a.size() phải là 2^k (mặt nạ k bit). O(k * 2^k) thời gian, O(2^k) bộ nhớ.

// f[mask] = tổng a[s] với mọi s là TẬP CON của mask (s & mask == s).
vector<long long> sumOverSubsets(vector<long long> a) {
    int n = a.size();
    for (int bit = 1; bit < n; bit <<= 1)  // vòng NGOÀI là bit, vòng trong là mask (đảo chỗ sẽ sai)
        for (int mask = 0; mask < n; mask++)
            if (mask & bit) a[mask] += a[mask ^ bit];
    return a;
}

// f[mask] = tổng a[s] với mọi s là TẬP CHA của mask (mask & s == mask).
vector<long long> sumOverSupersets(vector<long long> a) {
    int n = a.size();
    for (int bit = 1; bit < n; bit <<= 1)
        for (int mask = 0; mask < n; mask++)
            if (!(mask & bit)) a[mask] += a[mask | bit];
    return a;
}

// Nghịch đảo của sumOverSubsets (Möbius): từ f khôi phục a.
vector<long long> inverseSumOverSubsets(vector<long long> f) {
    int n = f.size();
    for (int bit = 1; bit < n; bit <<= 1)
        for (int mask = 0; mask < n; mask++)
            if (mask & bit) f[mask] -= f[mask ^ bit];
    return f;
}
`
      },
      example: {
        input: "2\n1 2 3 4",
        output: "1 3 4 10",
        explain: "k = 2 bit, a[0..3] = 1 2 3 4. f[0] = a0 = 1; f[1] = a0 + a1 = 3; f[2] = a0 + a2 = 4; f[3] = a0 + a1 + a2 + a3 = 10."
      },
      problems: [
        { site: "cses", id: "1654", name: "SOS Bit Problem" },
        { site: "cf", id: "165E", name: "Compatible Numbers" },
        { site: "cf", id: "449D", name: "Jzzhu and Numbers" }
      ],
      related: ["bitmask-dp", "bit-manipulation", "xor-trie"],
      compare: { "Dạng trạng thái": "f[mask]: tổng trên các tập con (hoặc cha) của mask", "Số trạng thái": "2^k", "Chuyển trạng thái": "Mỗi bit: cộng ô thiếu bit — O(1), tổng k·2^k", "Bộ nhớ": "O(2^k)" },
      cards: [
        { q: "Độ phức tạp SOS DP so với duyệt trực tiếp?", a: "O(k · 2^k) so với O(3^k) khi duyệt mọi tập con của mọi mặt nạ." },
        { q: "Vì sao bit phải là vòng lặp ngoài?", a: "Mỗi lượt bit mở rộng tập nguồn thêm một chiều; đảo vòng lặp làm tập con bị cộng thiếu hoặc lặp, không còn là đúng một lần." },
        { q: "Đổi sang tổng trên tập cha thế nào?", a: "Với mask có bit TẮT: f[mask] += f[mask | bit] (thay vì với mask có bit bật cộng f[mask ^ bit])." },
        { q: "Khôi phục mảng gốc từ f (tổng trên tập con) thế nào?", a: "Chạy cùng vòng lặp nhưng dùng -= (Möbius): f[mask] -= f[mask ^ bit] khi mask có bit." }
      ]
    },

    {
      id: "convex-hull-trick",
      name: "Convex Hull Trick / Li Chao Tree",
      aliases: ["convex hull trick", "cht", "li chao", "li chao tree", "tối ưu dp bao lồi", "dp tối ưu đường thẳng", "min của các đường thẳng", "kinetic"],
      category: "dp",
      sub: "Tối ưu DP",
      level: 4,
      tags: ["dp", "cht", "li-chao", "convex-hull", "optimization"],
      summary: "Tối ưu dp[i] = min_j (m_j · x_i + c_j) bằng cách duy trì cực tiểu của các đường thẳng; Li Chao Tree xử lý thêm đường và truy vấn bất kỳ thứ tự, O(log C).",
      description:
        "Nhiều công thức DP có dạng `dp[i] = min_{j<i}(m_j · x_i + c_j) + d_i`, trong đó `m_j`, `c_j` chỉ phụ thuộc `j` (ví dụ `(p_i - p_j)^2` khai triển thành `p_i^2 - 2p_j·p_i + p_j^2`). Mỗi `j` là một đường thẳng `y = m_j x + c_j`; đáp án là giá trị cực tiểu của các đường tại `x_i`.\n\n" +
        "- **CHT đơn điệu (deque):** nếu hệ số góc được thêm theo thứ tự đơn điệu thì giữ bao dưới; nếu thêm cả **x truy vấn đơn điệu** thì mỗi thao tác O(1) khấu hao (con trỏ). Nếu chỉ hệ số góc đơn điệu mà x bất kỳ thì tìm nhị phân trên bao: O(log N).\n" +
        "- **Li Chao Tree (mẫu dưới):** không đòi hỏi gì về thứ tự thêm hay truy vấn. Mỗi nút của cây phân đoạn trên miền x giữ **một** đường: đường tốt hơn tại điểm giữa. Khi thêm đường mới, đường thua ở giữa chỉ có thể thắng ở **một** nửa (hai đường thẳng cắt nhau tối đa một lần) nên đẩy xuống nửa đó. Truy vấn lấy cực tiểu của các đường dọc đường từ gốc xuống lá chứa x.\n\n" +
        "Mẫu: miền x nguyên `[lo, hi]` cấp phát nút động nên lên tới ~2·10^9; muốn **max** thì thêm `(-m, -c)` rồi đổi dấu kết quả. Điều kiện quan trọng là mọi `m·x + c` không tràn long long trong miền.",
      conditions: ["Công thức DP viết được dưới dạng cực tiểu / cực đại của các hàm bậc nhất theo x_i (hệ số chỉ phụ thuộc j)", "Li Chao: x nguyên trong miền [lo, hi] đã biết; |m·x + c| < 9.2·10^18", "CHT đơn điệu: hệ số góc thêm theo thứ tự đơn điệu (và x truy vấn đơn điệu để đạt O(1) khấu hao)"],
      complexity: { time: "O(log C) mỗi thao tác (Li Chao)", space: "O(số đường)", note: "C = hi - lo + 1. CHT deque: O(1) khấu hao khi hệ số góc và x đều đơn điệu; O(log N) mỗi truy vấn nếu chỉ hệ số góc đơn điệu." },
      ops: [["Thêm một đường thẳng (Li Chao)", "O(log C)"], ["Truy vấn min tại x (Li Chao)", "O(log C)"], ["CHT deque khi cả hai đơn điệu", "O(1)"]],
      use_case: ["dp[i] = min_j dp[j] + (p_i - p_j)^2 + C (chia dãy, đặt trạm với chi phí bình phương)", "Tối ưu dp có tích hai biến tách được thành m_j · x_i", "Truy vấn online giá trị cực tiểu / cực đại của tập đường thẳng thêm dần"],
      not_for: ["Chi phí không tách được thành tích m_j · x_i (ví dụ phụ thuộc cả hai theo kiểu khác) → divide-conquer-opt hoặc Knuth", "Đúng K nhóm với chi phí thoả bất đẳng thức tứ giác → divide-conquer-opt cũng dùng được", "Cần cả xoá đường thẳng → Li Chao tree rollback / cây phân đoạn + CHT"],
      pitfalls: [
        "Tràn số khi tính m·x + c (hoặc khi so sánh giao điểm bằng phép nhân chéo): kiểm tra |m·x + c| < 9.2·10^18, dùng __int128 khi cần.",
        "Truy vấn x ngoài miền [lo, hi] của Li Chao cho kết quả sai (không báo lỗi); khai báo miền phủ hết x sẽ hỏi.",
        "CHT deque đòi hệ số góc đơn điệu khi thêm (cùng hệ số góc chỉ giữ c tốt hơn); vi phạm làm bao sai. Li Chao không có yêu cầu này.",
        "Tính giao điểm bằng chia số thực gây sai số: so sánh bằng nhân chéo số nguyên.",
        "Muốn max mà quên đổi dấu (thêm -m, -c rồi nhân kết quả với -1); hoặc truy vấn khi chưa có đường nào (mẫu trả INF)."
      ],
      code: {
        lang: "cpp", title: "li_chao.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Li Chao Tree: tập đường thẳng y = k*x + b; thêm đường theo THỨ TỰ BẤT KỲ, hỏi MIN tại x nguyên bất kỳ (online).
// Mỗi thao tác O(log C), C = hi - lo + 1. Miền x là [lo, hi] (khai báo lúc dựng), nút cấp phát động nên C có thể ~2e9.
// Cần |k*x + b| < 9.2e18 với mọi x trong miền. Muốn MAX: thêm (-k, -b) và đổi dấu kết quả.
struct LiChao {
    static constexpr long long INF = (long long)4e18;
    struct Line {
        long long k, b;
        long long eval(long long x) const { return k * x + b; }
    };
    struct Node {
        Line ln;
        int lc = -1, rc = -1;
    };
    long long lo, hi;
    vector<Node> t;  // t[0] là gốc

    LiChao(long long lo, long long hi) : lo(lo), hi(hi) {}

    void addLine(long long k, long long b) {
        Line nw{k, b};
        if (t.empty()) { t.push_back(Node{nw}); return; }
        int cur = 0;
        long long l = lo, r = hi;
        while (true) {
            long long m = l + (r - l) / 2;
            if (nw.eval(m) < t[cur].ln.eval(m)) swap(nw, t[cur].ln);  // nút giữ đường tốt hơn tại giữa đoạn
            if (l == r) return;
            bool left = nw.eval(l) < t[cur].ln.eval(l);   // đường thua ở giữa nhưng thắng ở đầu trái → đẩy xuống nửa trái
            bool right = nw.eval(r) < t[cur].ln.eval(r);  // hoặc thắng ở đầu phải → đẩy xuống nửa phải (không thể cả hai)
            if (!left && !right) return;
            int next = left ? t[cur].lc : t[cur].rc;
            if (next < 0) {
                next = t.size();
                t.push_back(Node{nw});
                (left ? t[cur].lc : t[cur].rc) = next;
                return;
            }
            cur = next;
            if (left) r = m; else l = m + 1;
        }
    }

    long long query(long long x) const {  // min tại x thuộc [lo, hi]; chưa có đường nào → INF
        long long res = INF, l = lo, r = hi;
        int cur = t.empty() ? -1 : 0;
        while (cur >= 0) {
            res = min(res, t[cur].ln.eval(x));
            if (l == r) break;
            long long m = l + (r - l) / 2;
            if (x <= m) { cur = t[cur].lc; r = m; } else { cur = t[cur].rc; l = m + 1; }
        }
        return res;
    }
};
`
      },
      example: {
        input: "3\n2 3\n-1 8\n0 5\n4\n0 2 5 10",
        output: "3 5 3 -2",
        explain: "3 đường thẳng y = 2x + 3, y = -x + 8, y = 5; hỏi min tại x = 0, 2, 5, 10: tại 0 là min(3, 8, 5) = 3; tại 2 là min(7, 6, 5) = 5; tại 5 là min(13, 3, 5) = 3; tại 10 là min(23, -2, 5) = -2."
      },
      problems: [
        { site: "cses", id: "2084", name: "Monster Game I" },
        { site: "cses", id: "2085", name: "Monster Game II" },
        { site: "cf", id: "319C", name: "Kalila and Dimna in the Logging Industry" },
        { site: "cf", id: "1083E", name: "The Fair Nut and Rectangles" }
      ],
      related: ["divide-conquer-opt", "segment-tree", "convex-hull", "monotonic-queue"],
      compare: { "Dạng trạng thái": "dp[i] = min_j (m_j · x_i + c_j) + d_i", "Số trạng thái": "N", "Chuyển trạng thái": "Truy vấn min của các đường: O(log C) (Li Chao) hoặc O(1) khấu hao (CHT deque)", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "Dạng dp nào dùng được Convex Hull Trick?", a: "dp[i] = min_j (m_j · x_i + c_j) + d_i, với m_j, c_j chỉ phụ thuộc j: mỗi j là một đường thẳng, dp[i] là cực tiểu của chúng tại x_i." },
        { q: "Điều kiện của CHT deque so với Li Chao?", a: "CHT deque cần hệ số góc thêm theo thứ tự đơn điệu (và x truy vấn đơn điệu để đạt O(1) khấu hao). Li Chao không cần thứ tự gì, mỗi thao tác O(log C)." },
        { q: "Vì sao Li Chao chỉ đẩy đường thua xuống MỘT nửa?", a: "Hai đường thẳng cắt nhau tối đa một lần: đường thua tại điểm giữa chỉ có thể thắng ở một trong hai nửa đoạn." },
        { q: "Muốn tìm max các đường thẳng bằng Li Chao Tree min?", a: "Thêm đường (-k, -b) và đổi dấu kết quả truy vấn." }
      ]
    },

    {
      id: "divide-conquer-opt",
      name: "Tối ưu DP chia để trị",
      aliases: ["divide and conquer optimization", "dp chia để trị", "tối ưu dp chia để trị", "dc optimization", "d&c dp", "monotone opt", "bất đẳng thức tứ giác"],
      category: "dp",
      sub: "Tối ưu DP",
      level: 4,
      tags: ["dp", "divide-and-conquer", "optimization", "quadrangle-inequality"],
      summary: "Giảm dp[g][i] = min_j (dp[g-1][j] + cost(j, i)) từ O(K·n^2) xuống O(K·n log n) khi vị trí tối ưu opt(i) không giảm theo i.",
      description:
        "Với bài chia dãy thành đúng `K` đoạn liên tiếp, công thức là `dp[g][i] = min_{j<i}(dp[g-1][j] + cost(j, i))`. Nếu vị trí tối ưu `opt(i)` của mỗi `i` **không giảm** khi `i` tăng, ta không cần thử mọi `j`: tính `opt(mid)` cho `i = mid` trong khoảng `[optL, optR]`, rồi đệ quy nửa trái với `[optL, opt(mid)]` và nửa phải với `[opt(mid), optR]`.\n\n" +
        "- **Trạng thái:** `dp[g][i]` = chi phí nhỏ nhất chia `i` phần tử đầu thành đúng `g` đoạn (chỉ giữ hai lớp `prev`, `cur`).\n" +
        "- **Công thức chuyển:** `dp[g][i] = min_{g-1 ≤ j < i}(dp[g-1][j] + cost(j, i))`, `cost(j, i)` là chi phí đoạn gồm các phần tử `j+1..i`.\n" +
        "- **Thứ tự duyệt:** theo lớp `g = 1..K`; trong mỗi lớp là đệ quy chia để trị trên `i`.\n" +
        "- **Khởi tạo:** `dp[0][0] = 0`, các ô còn lại của lớp 0 là `INF`.\n" +
        "- **Đáp án:** `dp[K][n]`.\n\n" +
        "Điều kiện đủ để `opt` đơn điệu là `cost` thoả **bất đẳng thức tứ giác**: `cost(a, c) + cost(b, d) ≤ cost(a, d) + cost(b, c)` với `a ≤ b ≤ c ≤ d` (ví dụ bình phương tổng đoạn với phần tử không âm, hay hàm lồi của độ dài đoạn). Mỗi lớp tốn O(n log n) lần gọi `cost`, nên `cost` phải tính được O(1) bằng tổng tiền tố. Với `K` lớn hơn nhiều có thể dùng thủ thuật Aliens; với interval DP dùng tối ưu Knuth.",
      conditions: ["Dạng dp[g][i] = min_j (dp[g-1][j] + cost(j, i)) với đúng K nhóm", "opt(i) không giảm theo i (đủ khi cost thoả bất đẳng thức tứ giác)", "cost(j, i) tính được O(1) (tổng tiền tố)"],
      complexity: { time: "O(K · n log n)", space: "O(n)", note: "Chỉ giữ hai lớp dp. Mỗi lớp gọi cost O(n log n) lần. Thông thường K · n log n < 10^8 là ổn." },
      use_case: ["Chia dãy thành K đoạn với chi phí đoạn lồi (bình phương tổng, số cặp khác nhau...)", "Đặt K trường học / trạm tối ưu dọc một đường với chi phí theo khoảng cách", "Bài chia nhóm liên tiếp mà chi phí đoạn tính nhanh bằng tiền tố"],
      not_for: ["opt không đơn điệu → kết quả sai âm thầm; dùng DP O(K·n^2) hoặc kỹ thuật khác", "Chi phí tách được dạng m_j · x_i → convex-hull-trick (thường O(n) mỗi lớp)", "Interval DP dp[l][r] → tối ưu Knuth (không phải chia để trị trên lớp)"],
      pitfalls: [
        "Dùng khi opt KHÔNG đơn điệu: không có lỗi báo, chỉ sai. Kiểm tra bất đẳng thức tứ giác hoặc đối chiếu với DP O(K·n^2) trên dữ liệu nhỏ.",
        "Phạm vi ứng viên sai: lớp g chỉ hợp lệ với i ≥ g và j ≥ g - 1; để INF lọt vào so sánh làm hỏng tính đơn điệu.",
        "cost(j, i) tốn O(n) thay vì O(1) làm mất ý nghĩa của tối ưu.",
        "Tràn số trong cost (bình phương tổng đoạn): kiểm tra giới hạn, dùng long long.",
        "Ghi đè lớp dp cũ khi đang đọc: dùng hai mảng prev / cur riêng."
      ],
      code: {
        lang: "cpp", title: "divide_conquer_dp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Tối ưu DP chia để trị: chia n phần tử thành ĐÚNG K đoạn liên tiếp (không rỗng), cực tiểu tổng chi phí đoạn.
//     dp[g][i] = min_{g-1 <= j < i} dp[g-1][j] + cost(j, i),  cost(j, i) = chi phí đoạn gồm phần tử j+1..i (1-based), tính O(1).
// Điều kiện: vị trí tối ưu không giảm theo i (đủ khi cost thoả cost(a,c)+cost(b,d) <= cost(a,d)+cost(b,c), a<=b<=c<=d).
// Trả về dp[K][n] (1 <= K <= n). O(K * n log n) thời gian, O(n) bộ nhớ.
template <class Cost>
long long divideConquerDP(int n, int K, Cost cost) {
    const long long INF = (long long)4e18;
    vector<long long> prev(n + 1, INF), cur(n + 1, INF);
    prev[0] = 0;  // lớp 0: chỉ dp[0][0] = 0
    for (int g = 1; g <= K; g++) {
        fill(cur.begin(), cur.end(), INF);
        // tính cur[i] cho i trong [lo, hi], opt nằm trong [optLo, optHi]
        function<void(int, int, int, int)> solve = [&](int lo, int hi, int optLo, int optHi) {
            if (lo > hi) return;
            int mid = (lo + hi) / 2, best = optLo;
            long long bestVal = INF;
            for (int j = optLo; j <= min(mid - 1, optHi); j++) {
                if (prev[j] >= INF) continue;
                long long val = prev[j] + cost(j, mid);
                if (val < bestVal) { bestVal = val; best = j; }
            }
            cur[mid] = bestVal;
            solve(lo, mid - 1, optLo, best);
            solve(mid + 1, hi, best, optHi);
        };
        solve(g, n, g - 1, n - 1);  // lớp g: i từ g, ứng viên j từ g-1
        swap(prev, cur);
    }
    return prev[n];
}
`
      },
      example: {
        input: "5 2\n3 1 4 1 5",
        output: "100",
        explain: "Chia dãy 3 1 4 1 5 thành K = 2 đoạn, chi phí đoạn = (tổng đoạn)^2. Cắt sau phần tử thứ 3: (3+1+4)^2 + (1+5)^2 = 64 + 36 = 100, nhỏ nhất (cắt sau phần tử 1: 9 + 121 = 130; sau 2: 16 + 100 = 116; sau 4: 81 + 25 = 106)."
      },
      problems: [
        { site: "cses", id: "2086", name: "Subarray Squares" },
        { site: "cses", id: "2087", name: "Houses and Schools" },
        { site: "cf", id: "321E", name: "Ciel and Gondolas" },
        { site: "cf", id: "868F", name: "Yet Another Minimization Problem" }
      ],
      related: ["convex-hull-trick", "interval-dp", "knapsack-01", "binary-search"],
      compare: { "Dạng trạng thái": "dp[g][i]: i phần tử đầu chia thành g đoạn", "Số trạng thái": "K · n", "Chuyển trạng thái": "Chia để trị trên opt đơn điệu — O(log n) khấu hao mỗi trạng thái", "Bộ nhớ": "O(n) (hai lớp)" },
      cards: [
        { q: "Điều kiện để dùng tối ưu DP chia để trị?", a: "Vị trí tối ưu opt(i) không giảm theo i; đủ khi cost thoả bất đẳng thức tứ giác cost(a,c) + cost(b,d) ≤ cost(a,d) + cost(b,c) với a ≤ b ≤ c ≤ d." },
        { q: "Độ phức tạp?", a: "O(K · n log n) thời gian và O(n) bộ nhớ (hai lớp), với cost tính O(1)." },
        { q: "Ý tưởng đệ quy?", a: "Tính opt cho i = mid bằng cách duyệt [optL, optR]; nửa trái chỉ cần thử [optL, opt(mid)], nửa phải thử [opt(mid), optR]." },
        { q: "Nếu opt không đơn điệu thì sao?", a: "Thuật toán vẫn chạy nhưng cho kết quả sai (không báo lỗi). Cần đối chiếu với DP O(K·n^2) trên test nhỏ." }
      ]
    },

    {
      id: "interval-dp",
      name: "DP trên đoạn (Interval DP)",
      aliases: ["interval dp", "dp trên đoạn", "dp khoảng", "nhân dãy ma trận", "matrix chain multiplication", "gộp đá", "merge stones", "dp l r"],
      category: "dp",
      sub: "Tối ưu DP",
      level: 3,
      tags: ["dp", "interval", "matrix-chain", "optimization"],
      summary: "Tính dp[l][r] cho mọi đoạn con [l, r] bằng cách thử điểm chia k; mẫu là nhân dãy ma trận tối ưu O(n^3), kèm dựng lại cách đặt ngoặc.",
      description:
        "Khi lời giải của đoạn `[l, r]` được ghép từ lời giải của hai đoạn con liền kề `[l, k]` và `[k+1, r]` (hoặc bỏ đầu/cuối), ta tính dp cho mọi đoạn theo thứ tự độ dài tăng dần. Mẫu: nhân dãy ma trận `A_0 … A_{n-1}` (ma trận `A_i` kích thước `dims[i] × dims[i+1]`) với số phép nhân vô hướng ít nhất.\n\n" +
        "- **Trạng thái:** `dp[i][j]` = chi phí nhỏ nhất để nhân các ma trận `A_i … A_j`.\n" +
        "- **Công thức chuyển:** `dp[i][j] = min_{i ≤ k < j}(dp[i][k] + dp[k+1][j] + dims[i] · dims[k+1] · dims[j+1])`.\n" +
        "- **Thứ tự duyệt:** độ dài đoạn `len = 2..n` tăng dần, rồi `i`; như vậy `dp[i][k]` và `dp[k+1][j]` (ngắn hơn) đã có.\n" +
        "- **Khởi tạo:** `dp[i][i] = 0` (một ma trận không tốn phép nhân).\n" +
        "- **Đáp án:** `dp[0][n-1]`; lưu `cut[i][j]` rồi dựng lại cách đặt ngoặc.\n\n" +
        "Cùng khung này giải gộp đá kề nhau (chi phí là tổng đoạn), bắn bóng (Burst Balloons), xoá xâu đối xứng, trò chơi lấy hai đầu dãy. Thường O(n^3) thời gian, O(n^2) bộ nhớ; khi `cost` thoả bất đẳng thức tứ giác và đơn điệu, tối ưu Knuth cho O(n^2).",
      conditions: ["Bài toán trên đoạn [l, r] ghép được từ các đoạn con liền kề", "n nhỏ (thường n ≤ 500 với O(n^3); n ≤ 5000 nếu O(n^2) nhờ Knuth)", "Chi phí ghép tính được O(1)"],
      complexity: { time: "O(n^3)", space: "O(n^2)", note: "Tối ưu Knuth: O(n^2) khi opt[l][r-1] ≤ opt[l][r] ≤ opt[l+1][r] (cost thoả bất đẳng thức tứ giác)." },
      ops: [["Điền bảng dp", "O(n^3)"], ["Dựng lại cách ghép", "O(n)"], ["Bộ nhớ", "O(n^2)"]],
      use_case: ["Nhân dãy ma trận / gộp các đống kề nhau với chi phí ghép", "Trò chơi hai người lấy từ hai đầu dãy (dp[l][r] = hiệu số tối ưu)", "Xoá / đếm cách phá bỏ trong xâu (xâu đối xứng, bắn bóng)"],
      not_for: ["Gộp các đống KHÔNG cần kề nhau → heap (Huffman) tham lam", "Chia dãy thành K đoạn → divide-conquer-opt", "n lớn (> 1000) với O(n^3) → tìm cấu trúc tốt hơn (Knuth, tham lam)"],
      pitfalls: [
        "Sai thứ tự duyệt: phải theo độ dài đoạn tăng dần (hoặc l giảm dần, r tăng dần), nếu không dp con chưa sẵn sàng.",
        "Sai khoảng k: k chạy i..j-1 với dp[i][k] + dp[k+1][j]; chạy tới j gây truy cập ngoài đoạn.",
        "Quên cơ sở dp[i][i] (một phần tử) hoặc để INF/giá trị rác.",
        "Tràn số khi nhân ba kích thước (long long) hoặc cộng INF; tích có thể lên tới 10^15.",
        "O(n^3) với n quá lớn → chậm; kiểm tra có áp dụng được tối ưu Knuth không."
      ],
      code: {
        lang: "cpp", title: "matrix_chain.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Interval DP — nhân dãy ma trận tối ưu. Ma trận i (0..n-1) có kích thước dims[i] x dims[i+1] (dims có n+1 phần tử).
// Trả về số phép nhân vô hướng ít nhất để nhân cả dãy A0 * A1 * ... * A(n-1). order (tuỳ chọn): cách đặt ngoặc, vd "((A0 A1) A2)".
// O(n^3) thời gian, O(n^2) bộ nhớ. Kích thước <= 1e5 để tích ba số vừa long long.
long long matrixChain(const vector<long long>& dims, string* order = nullptr) {
    int n = (int)dims.size() - 1;
    if (n <= 0) { if (order) order->clear(); return 0; }
    vector<vector<long long>> dp(n, vector<long long>(n, 0));  // dp[i][i] = 0
    vector<vector<int>> cut(n, vector<int>(n, 0));
    for (int len = 2; len <= n; len++)  // theo độ dài đoạn tăng dần
        for (int i = 0; i + len - 1 < n; i++) {
            int j = i + len - 1;
            dp[i][j] = LLONG_MAX;
            for (int k = i; k < j; k++) {  // chia thành [i, k] và [k+1, j]
                long long c = dp[i][k] + dp[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1];
                if (c < dp[i][j]) { dp[i][j] = c; cut[i][j] = k; }
            }
        }
    if (order) {
        function<string(int, int)> build = [&](int i, int j) -> string {
            if (i == j) return "A" + to_string(i);
            return "(" + build(i, cut[i][j]) + " " + build(cut[i][j] + 1, j) + ")";
        };
        *order = build(0, n - 1);
    }
    return dp[0][n - 1];
}
`
      },
      example: {
        input: "3\n10 30 5 60",
        output: "4500\n((A0 A1) A2)",
        explain: "Ba ma trận A0 (10×30), A1 (30×5), A2 (5×60). Nhân (A0·A1) trước tốn 10·30·5 = 1500, rồi nhân với A2 tốn 10·5·60 = 3000: tổng 4500. Cách A0·(A1·A2) tốn 30·5·60 + 10·30·60 = 27000."
      },
      problems: [
        { site: "cses", id: "1097", name: "Removal Game" },
        { site: "cses", id: "1080", name: "Empty String" },
        { site: "cf", id: "607B", name: "Zuma" },
        { site: "lc", name: "Burst Balloons" }
      ],
      related: ["divide-conquer-opt", "lcs", "heap"],
      compare: { "Dạng trạng thái": "dp[l][r]: đoạn [l, r]", "Số trạng thái": "n^2", "Chuyển trạng thái": "Thử điểm chia k — O(n)", "Bộ nhớ": "O(n^2)" },
      cards: [
        { q: "Công thức interval dp cho nhân dãy ma trận?", a: "dp[i][j] = min_{i≤k<j}(dp[i][k] + dp[k+1][j] + dims[i]·dims[k+1]·dims[j+1]), dp[i][i] = 0." },
        { q: "Thứ tự duyệt đúng của interval dp?", a: "Theo độ dài đoạn tăng dần (len = 2..n) rồi vị trí đầu i, để các đoạn con ngắn hơn đã được tính." },
        { q: "Độ phức tạp và cách tăng tốc?", a: "O(n^3) thời gian, O(n^2) bộ nhớ; tối ưu Knuth xuống O(n^2) khi cost thoả bất đẳng thức tứ giác và đơn điệu." },
        { q: "Gộp các đống đá kề nhau khác gộp đống bất kỳ ở chỗ nào?", a: "Kề nhau: interval dp (không dùng tham lam). Bất kỳ: tham lam Huffman bằng heap." }
      ]
    },

    {
      id: "kadane",
      name: "Kadane (đoạn con lớn nhất)",
      aliases: ["kadane", "maximum subarray", "đoạn con có tổng lớn nhất", "dãy con liên tiếp tổng lớn nhất", "max subarray sum", "tổng đoạn lớn nhất"],
      category: "dp",
      sub: "Dãy & xâu",
      level: 1,
      tags: ["dp", "kadane", "subarray", "greedy"],
      summary: "Tìm đoạn con liên tiếp không rỗng có tổng lớn nhất của dãy số (có thể âm) trong O(N), kèm trả về hai đầu đoạn.",
      description:
        "Gọi `best[i]` là tổng lớn nhất của đoạn **kết thúc tại `i`**. Đoạn đó hoặc chỉ gồm `a[i]`, hoặc nối thêm vào đoạn tốt nhất kết thúc tại `i-1`. Đáp án là giá trị lớn nhất của `best[i]` qua mọi `i`.\n\n" +
        "- **Trạng thái:** `best[i]` = tổng lớn nhất của một đoạn kết thúc tại `i` (chỉ cần biến `cur`).\n" +
        "- **Công thức chuyển:** `best[i] = max(a[i], best[i-1] + a[i])` (tương đương: nếu `best[i-1] < 0` thì bắt đầu đoạn mới tại `i`).\n" +
        "- **Thứ tự duyệt:** trái sang phải một lượt.\n" +
        "- **Khởi tạo:** `best[0] = a[0]`, đáp án ban đầu `a[0]` (đoạn phải không rỗng).\n" +
        "- **Đáp án:** `max_i best[i]`; theo dõi `start` khi mở đoạn mới để trả về `[l, r]`.\n\n" +
        "Biến thể: cho phép đoạn rỗng (đáp án tối thiểu 0); dãy vòng tròn: `max(Kadane, tổng - đoạn nhỏ nhất)` (toàn âm thì chỉ lấy Kadane); giới hạn độ dài thì dùng tổng tiền tố với hàng đợi đơn điệu; đoạn con lớn nhất trong ma trận bằng cách nén dòng rồi Kadane trên mảng cột (O(n^3)); truy vấn trên đoạn con của dãy thì dùng segment tree lưu 4 giá trị.",
      conditions: ["Đoạn con liên tiếp và không rỗng (nếu cho phép rỗng thì đáp án ≥ 0)", "Phần tử có thể âm, dương hoặc 0", "Tổng vừa long long"],
      complexity: { time: "O(N)", space: "O(1)", note: "Dãy vòng tròn vẫn O(N). Truy vấn đoạn con lớn nhất trên nhiều khoảng: segment tree O(log N) mỗi truy vấn." },
      use_case: ["Lợi nhuận liên tiếp lớn nhất của chuỗi biến động (có lỗ, có lãi)", "Bước con của bài đoạn con có điều kiện (một lần đảo dấu, thay thế)", "Đoạn con lớn nhất của dãy vòng hoặc của ma trận (sau khi nén dòng)"],
      not_for: ["Đoạn có giới hạn độ dài L..R → tổng tiền tố + monotonic-queue", "Nhiều truy vấn đoạn con lớn nhất trên khoảng khác nhau → segment-tree", "Dãy con KHÔNG liên tiếp → chọn các phần tử dương (hoặc dp khác)"],
      pitfalls: [
        "Khởi tạo cur / best bằng 0 coi như cho phép đoạn rỗng: sai khi toàn số âm (đáp án phải là phần tử lớn nhất).",
        "Khởi tạo best = -INF quá nhỏ rồi cộng thêm gây tràn: dùng best = a[0].",
        "Dãy vòng tròn: đáp án max(Kadane, tổng - đoạn nhỏ nhất) sai khi toàn số âm vì đoạn nhỏ nhất là cả dãy (đoạn bù rỗng).",
        "Lệch chỉ số đoạn: cập nhật start đúng lúc mở đoạn mới (cur < 0), nếu không l, r sai một.",
        "Tràn int khi N · |a_i| lớn: dùng long long."
      ],
      code: {
        lang: "cpp", title: "kadane.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Kadane: đoạn con liên tiếp KHÔNG RỖNG có tổng lớn nhất. O(n) thời gian, O(1) bộ nhớ.
// Trả về tổng và hai đầu đoạn [l, r] (0-based, gồm cả hai đầu). a rỗng → {0, -1, -1}.
struct KadaneResult {
    long long sum;
    int l, r;
};

KadaneResult kadane(const vector<long long>& a) {
    int n = a.size();
    if (n == 0) return {0, -1, -1};
    KadaneResult best{a[0], 0, 0};
    long long cur = a[0];  // tổng lớn nhất của đoạn kết thúc tại i
    int start = 0;         // đầu đoạn tương ứng với cur
    for (int i = 1; i < n; i++) {
        if (cur < 0) { cur = a[i]; start = i; }  // phần trước kéo tổng xuống: bắt đầu đoạn mới
        else cur += a[i];
        if (cur > best.sum) best = {cur, start, i};
    }
    return best;
}
`
      },
      example: {
        input: "9\n-2 1 -3 4 -1 2 1 -5 4",
        output: "6 3 6",
        explain: "Dãy -2 1 -3 4 -1 2 1 -5 4. Đoạn có tổng lớn nhất là 4 -1 2 1 (chỉ số 3 đến 6) với tổng 6."
      },
      problems: [
        { site: "cses", id: "1643", name: "Maximum Subarray Sum" },
        { site: "cf", id: "1373D", name: "Maximum Sum on Even Positions" },
        { site: "lc", name: "Maximum Subarray" }
      ],
      related: ["array-prefix-sum", "monotonic-queue", "segment-tree", "two-pointers"],
      compare: { "Dạng trạng thái": "best[i]: tổng lớn nhất của đoạn kết thúc tại i", "Số trạng thái": "N", "Chuyển trạng thái": "max(a[i], best[i-1] + a[i]) — O(1)", "Bộ nhớ": "O(1)" },
      cards: [
        { q: "Công thức Kadane?", a: "best[i] = max(a[i], best[i-1] + a[i]); đáp án = max_i best[i]." },
        { q: "Kadane xử lý thế nào khi toàn số âm?", a: "Khởi tạo bằng a[0] (không phải 0): đáp án là phần tử lớn nhất (đoạn phải không rỗng)." },
        { q: "Dãy vòng tròn thì sao?", a: "Đáp án = max(Kadane, tổng cả dãy - tổng đoạn nhỏ nhất); riêng trường hợp toàn âm thì chỉ lấy Kadane." },
        { q: "Độ phức tạp Kadane?", a: "O(N) thời gian, O(1) bộ nhớ." }
      ]
    }
  ]);

  // ================================================================================================================ Kịch bản Quiz
  A.lib.scenarios([
    { id: "q-knapsack-01-1", prompt: "Có 200 món đồ; món i nặng w_i ≤ 100 và có giá trị v_i ≤ 10^9, mỗi món chỉ có đúng một cái. Balô chịu tối đa W = 10^4. Chọn một tập món để tổng giá trị lớn nhất.",
      answer: ["knapsack-01"], also: [], wrong: ["knapsack-unbounded", "knapsack-bounded", "meet-in-the-middle", "backtracking"],
      why: "Mỗi món hoặc lấy hoặc không và sức chứa W nhỏ: balô 0/1 O(n·W) = 2·10^6. Không giới hạn / có giới hạn sai vì mỗi món chỉ có một cái; meet in the middle và backtracking hợp với n ≤ 40, còn ở đây n = 200 nên bùng nổ tổ hợp.", level: 2 },
    { id: "q-knapsack-01-2", prompt: "Cho n = 100 số nguyên dương a_i ≤ 100. Đếm số cách chọn một tập con (tính theo chỉ số) có tổng đúng bằng S = 5000, chia dư 10^9 + 7.",
      answer: ["knapsack-01"], also: [], wrong: ["coin-change", "bitmask-dp", "meet-in-the-middle", "sos-dp"],
      why: "Mỗi số dùng tối đa một lần và tổng cần nhỏ: dp[s] += dp[s - a_i] duyệt ngược (balô 0/1 dạng đếm). Đổi tiền cho dùng lặp nên sai; bitmask và meet in the middle cần n ≤ 40; SOS dp hoạt động trên mặt nạ bit, không phải tổng số.", level: 2 },
    { id: "q-knapsack-unbounded-1", prompt: "Một thanh thép dài L = 100000 được cắt thành các đoạn nguyên; đoạn dài i (1 ≤ i ≤ 20) bán được p_i đồng và mỗi độ dài cắt bao nhiêu đoạn cũng được. Tìm doanh thu lớn nhất.",
      answer: ["knapsack-unbounded"], also: [], wrong: ["knapsack-01", "knapsack-bounded", "interval-dp", "kadane"],
      why: "Mỗi độ dài dùng số lần tuỳ ý với tổng độ dài đúng bằng L: balô không giới hạn (cắt thanh), duyệt xuôi O(20·L). Balô 0/1 và có giới hạn giới hạn số lần; interval dp tốn O(L^2) trở lên; Kadane không liên quan.", level: 2 },
    { id: "q-knapsack-bounded-1", prompt: "Có 20 loại hàng; loại i có c_i cái (c_i lên tới 10^9), mỗi cái nặng w_i ≥ 1 (w_i ≤ 100) và có giá trị v_i. Balô chịu tối đa W = 10^5. Tìm tổng giá trị lớn nhất.",
      answer: ["knapsack-bounded"], also: [], wrong: ["knapsack-01", "knapsack-unbounded", "coin-change", "meet-in-the-middle"],
      why: "Mỗi loại có số lượng cho trước, rất lớn: tách nhị phân thành O(log c_i) gói 0/1, tổng O(W · 20 · log). Mở rộng từng cái (balô 0/1) là 10^9 vật; balô không giới hạn bỏ qua giới hạn c_i; đổi tiền chỉ tính số cách / số đồng.", level: 3 },
    { id: "q-coin-change-1", prompt: "Có n ≤ 100 mệnh giá c_i ≤ 10^6, mỗi loại dùng bao nhiêu tờ cũng được. Tìm số tờ ÍT NHẤT để trả đúng X = 10^6 đồng (hoặc báo không thể). Hệ mệnh giá có thể là {1, 3, 4}.",
      answer: ["coin-change"], also: ["knapsack-unbounded"], wrong: ["knapsack-01", "greedy-interval-scheduling", "binary-search", "interval-dp"],
      why: "Cần tối thiểu số tờ trên hệ không chuẩn: DP dp[x] = min(dp[x - c] + 1), O(n·X). Tham lam (lấy mệnh giá lớn nhất) sai với {1, 3, 4}; balô 0/1 chỉ cho mỗi loại một tờ; tìm nhị phân và interval dp không áp dụng.", level: 2 },
    { id: "q-coin-change-2", prompt: "Có n ≤ 100 mệnh giá cho trước. Đếm số cách trả đúng X = 10^5 đồng, trong đó 1 + 2 và 2 + 1 chỉ tính là một cách (không phân biệt thứ tự), chia dư 10^9 + 7.",
      answer: ["coin-change"], also: [], wrong: ["knapsack-01", "knapsack-bounded", "meet-in-the-middle", "digit-dp"],
      why: "Đếm tổ hợp với mệnh giá dùng lặp: dp[x] += dp[x - c] với vòng ngoài là loại tiền (O(n·X)). Balô 0/1 và có giới hạn bị chặn số tờ; meet in the middle không hợp với X lớn; digit dp xử lý theo chữ số.", level: 2 },
    { id: "q-lis-1", prompt: "Cho dãy N = 200000 số nguyên. Tìm độ dài dãy con (các phần tử không cần liên tiếp) tăng ngặt dài nhất.",
      answer: ["lis"], also: [], wrong: ["kadane", "lcs", "two-pointers", "sliding-window"],
      why: "LIS O(N log N) với mảng tail và tìm nhị phân. LCS giữa dãy và dãy đã sắp xếp đúng nhưng O(N^2), quá chậm với N = 2·10^5; Kadane tìm đoạn con liên tiếp; hai con trỏ / cửa sổ trượt không giữ được thứ tự dãy con.", level: 2 },
    { id: "q-lis-2", prompt: "Dãy nhiệt độ t_1..t_N với N = 100000 ngày. Chọn nhiều ngày nhất theo thứ tự thời gian sao cho nhiệt độ các ngày chọn không giảm dần (hai ngày liền nhau có thể bằng nhau).",
      answer: ["lis"], also: [], wrong: ["kadane", "lcs", "monotonic-stack", "sparse-table"],
      why: "Đây là dãy con không giảm dài nhất: LIS với upper_bound, O(N log N). Kadane là đoạn liên tiếp có tổng lớn nhất; LCS hợp với hai dãy; monotonic stack chỉ tìm phần tử lớn hơn kế tiếp; sparse table trả lời truy vấn min/max đoạn.", level: 2 },
    { id: "q-lcs-1", prompt: "Cho hai xâu A và B, độ dài mỗi xâu ≤ 5000. Tìm độ dài dãy con chung dài nhất của chúng (các ký tự lấy theo thứ tự, không cần liên tiếp).",
      answer: ["lcs"], also: [], wrong: ["edit-distance", "kmp", "lis", "z-function"],
      why: "Dãy con chung dài nhất: bảng DP O(n·m) = 2.5·10^7. Edit distance tính số thao tác chỉnh sửa; KMP và Z tìm xâu mẫu liên tiếp; LIS chỉ có một dãy và không so khớp hai xâu bất kỳ.", level: 2 },
    { id: "q-edit-distance-1", prompt: "Cho hai xâu A, B độ dài ≤ 3000. Mỗi thao tác chèn, xoá hoặc đổi một ký tự tốn 1. Tìm số thao tác ít nhất biến A thành B.",
      answer: ["edit-distance"], also: [], wrong: ["lcs", "kmp", "rolling-hash", "manacher"],
      why: "Đúng là Levenshtein: DP O(n·m) với ba lựa chọn xoá / chèn / thay. LCS chỉ cho khoảng cách khi cấm thay; KMP và hash so khớp xâu chính xác; Manacher tìm xâu đối xứng.", level: 2 },
    { id: "q-bitmask-dp-1", prompt: "Có n = 16 thành phố với ma trận chi phí d[i][j]. Người giao hàng xuất phát từ thành phố 1, đi qua mỗi thành phố đúng một lần rồi quay về thành phố 1. Tìm tổng chi phí nhỏ nhất.",
      answer: ["bitmask-dp"], also: [], wrong: ["dijkstra", "kruskal", "floyd-warshall", "backtracking"],
      why: "Chu trình Hamilton ngắn nhất (TSP) với n nhỏ: bitmask DP dp[mask][j], O(2^n · n^2) ≈ 1.7·10^7. Dijkstra / Floyd tìm đường ngắn giữa hai điểm, không ép qua mọi đỉnh một lần; Kruskal ra cây khung; backtracking 15! quá chậm.", level: 3 },
    { id: "q-bitmask-dp-2", prompt: "Có n = 20 người và n việc. Mỗi cặp (người i, việc j) cho biết người i có làm được việc j hay không. Đếm số cách giao việc sao cho mỗi người đúng một việc và mỗi việc đúng một người.",
      answer: ["bitmask-dp"], also: [], wrong: ["hungarian", "bipartite-matching", "hopcroft-karp", "dsu"],
      why: "Cần ĐẾM số phép ghép hoàn hảo với n ≤ 20: dp[mask] = số cách giao n người đầu cho tập việc mask, O(2^n · n). Hungarian tìm chi phí nhỏ nhất, còn ghép cặp / Hopcroft-Karp chỉ cho ghép cực đại, không đếm số cách; DSU không liên quan.", level: 3 },
    { id: "q-digit-dp-1", prompt: "Cho N ≤ 10^18. Đếm số nguyên x trong [1, N] mà tổng các chữ số thập phân của x chia hết cho 7.",
      answer: ["digit-dp"], also: [], wrong: ["sieve", "binary-search", "fast-pow", "meet-in-the-middle"],
      why: "Đếm theo tính chất của từng chữ số với N rất lớn: digit dp với trạng thái (vị trí, tổng mod 7, tight). Sàng không duyệt nổi 10^18; tìm nhị phân cần tính đơn điệu; luỹ thừa nhanh và meet in the middle không đếm theo chữ số.", level: 4 },
    { id: "q-tree-dp-1", prompt: "Cho cây N = 100000 đỉnh, đỉnh v có trọng số w_v (có thể âm). Chọn một tập đỉnh sao cho không có hai đỉnh kề nhau cùng được chọn và tổng trọng số lớn nhất.",
      answer: ["tree-dp"], also: [], wrong: ["dsu", "lca", "bitmask-dp", "kadane"],
      why: "Tập độc lập trọng số lớn nhất trên cây: tree dp với hai trạng thái chọn / không chọn mỗi đỉnh, O(N). Bitmask DP cần N ≤ 20; DSU và LCA xử lý liên thông / tổ tiên chung; Kadane làm việc trên dãy, không phải cây.", level: 3 },
    { id: "q-sos-dp-1", prompt: "Cho mảng a gồm N = 10^6 số nguyên 0 ≤ a_i < 2^20. Với mỗi a_i, đếm số phần tử a_j (j khác i) mà mọi bit bật của a_j cũng bật trong a_i (a_j & a_i = a_j).",
      answer: ["sos-dp"], also: [], wrong: ["bitmask-dp", "xor-trie", "fenwick-tree", "bit-manipulation"],
      why: "Cần tổng trên mọi tập con của mỗi mặt nạ: SOS dp O(20 · 2^20) thay vì O(3^20) hoặc O(N^2). Bitmask DP duyệt thứ tự phần tử; Trie XOR tối ưu XOR lớn nhất; Fenwick đếm theo thứ tự giá trị, không theo tập con bit.", level: 4 },
    { id: "q-cht-1", prompt: "Có N = 200000 trạm xếp theo vị trí tăng dần p_i. Chọn một số trạm làm điểm dừng: chặng đi từ trạm j tới trạm i tốn (p_i - p_j)^2 + C. Tìm tổng chi phí nhỏ nhất đi từ trạm 1 tới trạm N.",
      answer: ["convex-hull-trick"], also: [], wrong: ["divide-conquer-opt", "interval-dp", "segment-tree", "lis"],
      why: "dp[i] = min_j dp[j] + (p_i - p_j)^2 + C khai triển thành p_i^2 + C + min_j (-2p_j · p_i + dp[j] + p_j^2): cực tiểu các đường thẳng tại x = p_i, O(N) hoặc O(N log N). Chia để trị cần đúng K nhóm với dp lớp trước đã biết; interval dp O(N^3); segment tree không biểu diễn được min của hàm bậc nhất; LIS không liên quan.", level: 4 },
    { id: "q-dc-opt-1", prompt: "Chia dãy N = 20000 số không âm thành đúng K = 100 đoạn liên tiếp; chi phí mỗi đoạn là bình phương tổng của nó. Cực tiểu tổng chi phí các đoạn.",
      answer: ["divide-conquer-opt"], also: ["convex-hull-trick"], wrong: ["knapsack-01", "interval-dp", "lis", "kadane"],
      why: "dp[g][i] = min_j dp[g-1][j] + (P_i - P_j)^2 với cost thoả bất đẳng thức tứ giác nên opt đơn điệu: chia để trị O(K · N log N); CHT cũng được vì hệ số góc và x đều đơn điệu. DP O(K·N^2) = 4·10^10 quá chậm; balô, interval dp, LIS, Kadane không cho cấu trúc chia đúng K đoạn.", level: 4 },
    { id: "q-interval-dp-1", prompt: "Có N = 400 đống đá xếp thành hàng. Mỗi lần được gộp hai đống KỀ NHAU thành một đống, chi phí bằng tổng khối lượng hai đống. Tìm tổng chi phí nhỏ nhất để gộp thành một đống.",
      answer: ["interval-dp"], also: [], wrong: ["heap", "greedy-interval-scheduling", "knapsack-01", "lis"],
      why: "Chỉ được gộp hai đống kề nhau nên tham lam kiểu Huffman (heap) sai; dp[l][r] = min_k dp[l][k] + dp[k+1][r] + tổng(l..r), O(N^3) = 6.4·10^7. Chọn khoảng, balô và LIS không mô tả việc ghép đoạn liên tiếp.", level: 3 },
    { id: "q-kadane-1", prompt: "Cho dãy N = 10^6 số nguyên (có thể âm, |a_i| ≤ 10^9). Tìm tổng lớn nhất của một đoạn con liên tiếp không rỗng.",
      answer: ["kadane"], also: ["array-prefix-sum"], wrong: ["lis", "two-pointers", "sliding-window", "binary-search"],
      why: "Kadane O(N): cur = max(a[i], cur + a[i]) (tổng tiền tố trừ tiền tố nhỏ nhất cũng được). LIS xét dãy con không liên tiếp; hai con trỏ và cửa sổ trượt chỉ đúng khi phần tử không âm hoặc độ dài cố định; tìm nhị phân cần tính đơn điệu không có ở đây.", level: 1 },
    { id: "q-lis-3", prompt: "Cho hai hoán vị P và Q của 1..N với N = 100000. Tìm độ dài dãy con chung dài nhất của P và Q.",
      answer: ["lis"], also: [], wrong: ["lcs", "edit-distance", "kmp", "z-function"],
      why: "Mỗi giá trị xuất hiện đúng một lần trong mỗi hoán vị: đánh số lại các giá trị theo vị trí trong P rồi tìm LIS của Q, O(N log N). LCS bảng n·m = 10^10 quá chậm với N = 10^5; edit distance cũng O(n·m) và là bài khác; KMP / Z tìm mẫu liên tiếp.", level: 3 },
    { id: "q-coin-change-3", prompt: "Một người leo thang gồm n = 10^6 bậc, mỗi bước leo 1, 2, 3, 4, 5 hoặc 6 bậc. Đếm số cách khác nhau (thứ tự các bước quan trọng) để leo đúng n bậc, chia dư 10^9 + 7.",
      answer: ["coin-change"], also: ["knapsack-unbounded"], wrong: ["knapsack-01", "digit-dp", "interval-dp", "bitmask-dp"],
      why: "Đếm dãy có thứ tự các bước từ tập {1..6} với tổng đúng n: dp[x] = Σ dp[x - c] với vòng ngoài là tổng (đổi tiền dạng dãy), O(6·n). Balô 0/1 mỗi bước một lần; digit dp xử lý chữ số; interval dp và bitmask không có cấu trúc này.", level: 2 },
    { id: "q-digit-dp-2", prompt: "Cho 1 ≤ L ≤ R ≤ 10^18. Đếm số nguyên trong [L, R] mà trong biểu diễn thập phân không có hai chữ số liền kề nào bằng nhau.",
      answer: ["digit-dp"], also: [], wrong: ["bitmask-dp", "sieve", "binary-search", "knapsack-01"],
      why: "Điều kiện chỉ phụ thuộc chữ số liền trước và cận R rất lớn: digit dp đếm f(R) - f(L - 1) với trạng thái (vị trí, chữ số trước, tight). Bitmask DP tập con không phù hợp; sàng không duyệt nổi 10^18; tìm nhị phân cần tính đơn điệu; balô tính theo tổng, không theo chữ số.", level: 4 },
    { id: "q-tree-dp-2", prompt: "Cho cây N = 200000 đỉnh. Chọn được nhiều cạnh nhất có thể sao cho không có hai cạnh nào chung một đỉnh (ghép cặp cực đại trên cây).",
      answer: ["tree-dp"], also: ["bipartite-matching", "hopcroft-karp"], wrong: ["lca", "kruskal", "bitmask-dp"],
      why: "Cây là đồ thị hai phía nên có thể dùng ghép cặp (Hopcroft-Karp), nhưng tree dp O(N) với hai trạng thái \"đỉnh đã ghép / chưa ghép\" nhanh và gọn hơn. LCA trả lời truy vấn tổ tiên; Kruskal tìm cây khung nhỏ nhất; bitmask chỉ cho N ≤ 20.", level: 3 },
    { id: "q-dc-opt-2", prompt: "N = 5000 ngôi nhà nằm trên một đường thẳng, mỗi nhà có c_i trẻ em. Cần xây đúng K = 50 trường học tại vị trí các ngôi nhà để tổng quãng đường mọi trẻ đi tới trường gần nhất nhỏ nhất.",
      answer: ["divide-conquer-opt"], also: [], wrong: ["knapsack-01", "interval-dp", "kadane", "binary-search"],
      why: "Các nhà theo thứ tự; mỗi trường phục vụ một đoạn liên tiếp, chi phí đoạn (theo trung vị) thoả bất đẳng thức tứ giác nên opt đơn điệu: dp[g][i] chia để trị O(K · N log N). Balô 0/1 không có cấu trúc đoạn; interval dp tốn thêm cận O(N^3); Kadane và tìm nhị phân không giải bài chia K nhóm.", level: 4 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
