/* lib-tech.js — Kỹ thuật cơ bản (tech: tìm kiếm, hai con trỏ, cửa sổ trượt, sắp xếp, vét cạn thông minh, truy vấn offline, tham lam, bit)
   và Hình học (geo: bao lồi, quét đường, cặp điểm gần nhất, điểm trong đa giác, giao hai đoạn). Định dạng theo HUONG-DAN-SOAN.md. */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ============================================================================================ TECH
    {
      id: "binary-search",
      name: "Tìm kiếm nhị phân (và trên đáp án)",
      aliases: ["binary search", "nhị phân", "chặt nhị phân", "lower_bound", "upper_bound", "bsearch", "nhị phân trên đáp án", "binary search on answer", "parametric search"],
      category: "tech",
      sub: "Tìm kiếm",
      level: 2,
      tags: ["binary-search", "search", "monotonic", "lower-bound", "binary-search-on-answer"],
      summary: "Thu hẹp khoảng tìm kiếm một nửa mỗi bước nhờ vị từ đơn điệu: tìm vị trí trong mảng sắp xếp, hoặc tìm giá trị nhỏ nhất/lớn nhất thoả điều kiện (nhị phân trên đáp án).",
      description:
        "Nhị phân dựa trên một **vị từ đơn điệu** `pred(x)`: sai ở phần đầu rồi đúng mãi từ một điểm trở đi. Mỗi bước xét `mid`; nếu `pred(mid)` đúng thì đáp án nằm trong `[lo, mid]`, ngược lại nằm trong `[mid+1, hi)`. Khoảng tìm kiếm giảm một nửa nên chỉ cần O(log N) lần gọi `pred`.\n\n" +
        "Có hai dạng thường gặp:\n" +
        "- **Tìm trong mảng sắp xếp**: `pred(i) = a[i] >= x` cho `lower_bound`, `a[i] > x` cho `upper_bound`; số phần tử bằng x là hiệu hai vị trí.\n" +
        "- **Nhị phân trên đáp án**: đề hỏi giá trị NHỎ NHẤT (hoặc LỚN NHẤT) thoả một điều kiện, và nếu x thoả thì mọi giá trị lớn hơn cũng thoả (đơn điệu). Viết hàm `ok(x)` kiểm tra một giá trị cụ thể trong O(f), rồi nhị phân: tổng O(f · log(miền)).\n\n" +
        "Mẫu dùng khoảng nửa mở `[lo, hi)` với quy tắc ‘`hi = mid` hoặc `lo = mid + 1`’ nên luôn thu hẹp được, không lặp vô hạn, và trả về `hi` khi không có đáp án. Với số thực, lặp một số lần CỐ ĐỊNH (khoảng 100) thay vì so sánh với epsilon.",
      conditions: [
        "Vị từ đơn điệu: sai…sai đúng…đúng (hoặc ngược lại); với mảng thì phải đã sắp xếp đúng theo thứ tự so sánh đang dùng",
        "Truy cập ngẫu nhiên O(1) (mảng) hoặc kiểm tra ok(x) đủ nhanh"
      ],
      complexity: { time: "O(log N)", space: "O(1)", note: "Nhị phân trên đáp án: O(log(miền) · chi phí một lần kiểm tra ok). Số lần lặp với số thực: cố định ~100." },
      ops: [["Tìm vị trí (lower_bound / upper_bound)", "O(log N)"], ["Đếm số phần tử bằng x", "O(log N)"], ["Nhị phân trên đáp án", "O(log(miền) · T(ok))"]],
      use_case: [
        "Tra cứu / đếm trong mảng đã sắp xếp (lower_bound, upper_bound)",
        "Tìm giá trị nhỏ nhất thoả điều kiện: thời gian tối thiểu, sức chứa tối thiểu, chia mảng sao cho đoạn lớn nhất nhỏ nhất…",
        "Tìm nghiệm của hàm đơn điệu (số thực): căn bậc hai, thời điểm gặp nhau",
        "Bước con của LIS O(N log N), hai con trỏ + nhị phân, đếm cặp"
      ],
      not_for: [
        "Vị từ không đơn điệu → tìm kiếm tam phân (hàm một đỉnh) hoặc quét tuyến tính / cấu trúc dữ liệu",
        "Tìm một lần trên dữ liệu chưa sắp xếp → duyệt tuyến tính O(N) rẻ hơn việc sắp xếp trước",
        "Cần thêm/xoá phần tử xen kẽ tìm kiếm → ordered-set / set có lower_bound"
      ],
      pitfalls: [
        "Vòng lặp vô hạn: với `lo = mid` mà mid làm tròn xuống, khi hi = lo + 1 thì mid == lo và không thu hẹp. Dùng mẫu [lo, hi) với `hi = mid` / `lo = mid + 1`, hoặc làm tròn mid lên khi dùng `lo = mid`.",
        "Tràn số: `(l + r) / 2` tràn int khi l + r > 2³¹ − 1 (và tràn long long với cận ~10¹⁸); dùng `l + (r − l) / 2`.",
        "Vị từ không đơn điệu cho kết quả vô nghĩa mà không báo lỗi — thử tay vài ví dụ nhỏ trước khi tin.",
        "Số thực: `while (hi - lo > eps)` có thể không dừng khi giá trị lớn (hai double kề nhau cách nhau hơn eps); lặp cố định 60–100 lần.",
        "Cận miền sai: cận trên phải đủ lớn để chắc chắn ok(hi) đúng, và phải kiểm tra trường hợp ‘không có đáp án’ (mẫu trả về hi).",
        "Tính ok(x) bị tràn (ví dụ tổng floor(T / t_i) với T ~ 10¹⁸): cắt tổng ngay khi vượt ngưỡng cần so sánh."
      ],
      code: {
        lang: "cpp", title: "binary-search.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Nhị phân tổng quát trên đoạn NỬA MỞ [lo, hi) với vị từ đơn điệu pred: false...false true...true.
// Dùng cho cả hai dạng: tìm vị trí trong mảng sắp xếp và nhị phân trên đáp án. Chỉ số 0-based.
template <class Pred>
long long bsFirstTrue(long long lo, long long hi, Pred pred) {  // nhỏ nhất x có pred(x); không có thì trả hi
    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;      // không tràn
        if (pred(mid)) hi = mid;                 // mid vẫn có thể là đáp án nên giữ lại
        else lo = mid + 1;
    }
    return lo;
}

// Lớn nhất x có pred(x) với pred đơn điệu kiểu true...true false...false; không có thì trả lo - 1.
template <class Pred>
long long bsLastTrue(long long lo, long long hi, Pred pred) {
    return bsFirstTrue(lo, hi, [&](long long x) { return !pred(x); }) - 1;
}

// Dạng 1: mảng a sắp xếp tăng (tương đương std::lower_bound / std::upper_bound).
int lowerBoundIdx(const vector<long long>& a, long long x) {   // chỉ số đầu tiên có a[i] >= x
    return (int)bsFirstTrue(0, (long long)a.size(), [&](long long i) { return a[i] >= x; });
}
int upperBoundIdx(const vector<long long>& a, long long x) {   // chỉ số đầu tiên có a[i] > x
    return (int)bsFirstTrue(0, (long long)a.size(), [&](long long i) { return a[i] > x; });
}
// Số phần tử bằng x = upperBoundIdx(a, x) - lowerBoundIdx(a, x).

// Dạng 2 (nhị phân trên đáp án): bsFirstTrue(1, 2e18, [&](long long T) { return ok(T); })
// với ok(T) đơn điệu, ví dụ "trong T giây làm được ít nhất K sản phẩm".

// Dạng 3: số thực — lặp CỐ ĐỊNH, không dùng while (hi - lo > eps). Trả về hi ~ nhỏ nhất x có pred(x).
template <class Pred>
double bsRealFirstTrue(double lo, double hi, Pred pred, int iters = 100) {
    for (int it = 0; it < iters; it++) {
        double mid = (lo + hi) / 2;
        if (pred(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}
`
      },
      example: {
        input: "a = [1, 2, 2, 2, 5, 7, 7, 9], x = 2.\nNhị phân trên đáp án: nhỏ nhất số nguyên t ≥ 0 sao cho t·t ≥ 50.",
        output: "lowerBoundIdx = 1, upperBoundIdx = 4 (có 4 − 1 = 3 phần tử bằng 2).\nĐáp án t = 8.",
        explain: "Phần tử đầu tiên ≥ 2 nằm ở chỉ số 1, phần tử đầu tiên > 2 nằm ở chỉ số 4. Với bài thứ hai, vị từ t·t ≥ 50 sai với t ≤ 7 (49 < 50) và đúng từ t = 8 (64 ≥ 50), nên nhị phân trả về 8."
      },
      problems: [
        { site: "cses", id: "1620", name: "Factory Machines" },
        { site: "cses", id: "1085", name: "Array Division" },
        { site: "cses", id: "1091", name: "Concert Tickets" },
        { site: "lc", name: "Koko Eating Bananas" },
        { site: "lc", name: "Capacity To Ship Packages Within D Days" }
      ],
      related: ["ternary-search", "two-pointers", "sorting", "ordered-set", "lis"],
      compare: {
        "Dùng khi": "Hàm/vị từ đơn điệu; tìm vị trí hoặc đáp án nhỏ nhất/lớn nhất thoả điều kiện",
        "Điều kiện": "Đơn điệu (false…true) và truy cập ngẫu nhiên hoặc kiểm tra ok(x) nhanh",
        "Cần dữ liệu đã sắp xếp": "Có (dạng tìm trong mảng); dạng nhị phân trên đáp án thì không"
      },
      cards: [
        { q: "Khác nhau giữa lower_bound và upper_bound?", a: "lower_bound: phần tử đầu tiên ≥ x; upper_bound: phần tử đầu tiên > x. Số phần tử bằng x = upper − lower." },
        { q: "Vì sao viết mid = l + (r − l) / 2?", a: "(l + r) có thể tràn kiểu số; l + (r − l) / 2 không bao giờ tràn." },
        { q: "Dấu hiệu nhận ra bài nhị phân trên đáp án?", a: "Đề hỏi giá trị nhỏ nhất/lớn nhất thoả điều kiện; nếu x thoả thì mọi giá trị lớn hơn (hoặc nhỏ hơn) cũng thoả; kiểm tra một giá trị cho trước dễ hơn việc tìm thẳng." },
        { q: "Số thực nên dừng nhị phân thế nào?", a: "Lặp cố định 60–100 lần thay vì while (r − l > eps), tránh không dừng do làm tròn." },
        { q: "Độ phức tạp nhị phân trên đáp án?", a: "O(log(miền) · chi phí một lần kiểm tra ok)." }
      ]
    },

    {
      id: "ternary-search",
      name: "Tìm kiếm tam phân",
      aliases: ["ternary search", "tam phân", "tìm cực đại hàm lõm", "unimodal", "golden section", "tìm cực trị hàm một đỉnh"],
      category: "tech",
      sub: "Tìm kiếm",
      level: 2,
      tags: ["ternary-search", "search", "unimodal", "optimization", "binary-search"],
      summary: "Tìm cực đại (hoặc cực tiểu) của hàm một đỉnh — tăng ngặt rồi giảm ngặt — mà không cần đạo hàm, bằng cách loại một phần ba đoạn tìm kiếm mỗi bước.",
      description:
        "Hàm **unimodal** có đúng một đỉnh: tăng ngặt tới điểm cực đại rồi giảm ngặt. Lấy hai điểm `m1 < m2` chia đoạn thành ba phần. Nếu `f(m1) < f(m2)` thì đỉnh nằm bên phải `m1` nên bỏ `[lo, m1]`; ngược lại đỉnh nằm bên trái `m2` nên bỏ `[m2, hi]`. Mỗi bước giữ lại 2/3 đoạn.\n\n" +
        "Với số thực lặp cố định khoảng 100 lần. Với số nguyên dừng khi đoạn còn ≤ 3 phần tử rồi duyệt nốt. **Cách tốt hơn cho số nguyên**: nhị phân theo dấu độ dốc `f(x) >= f(x+1)` (hàm `peakBySlope`) — ít lần gọi `f` hơn và không phải chia ba.\n\n" +
        "Hàm lõm (hoặc lồi, sau khi đổi dấu) luôn là unimodal, như khoảng cách từ một điểm tới điểm chạy trên đường thẳng, tổng bình phương độ lệch, thời điểm hai vật gần nhau nhất. **Đoạn bằng nhau (bình nguyên) nằm ngoài đỉnh phá hỏng thuật toán**, vì khi `f(m1) = f(m2)` ta không biết đỉnh ở phía nào.",
      conditions: [
        "f tăng ngặt rồi giảm ngặt trên [lo, hi] (đỉnh có thể gồm hai điểm bằng nhau); không có đoạn bằng nhau ngoài đỉnh",
        "Tính được f(x) tại một điểm; không cần đạo hàm"
      ],
      complexity: { time: "O(log N · T(f))", space: "O(1)", note: "Số lần gọi f khoảng 2·log₁,₅(độ dài miền / sai số). Với số nguyên, nhị phân theo độ dốc cần ít lần gọi hơn." },
      ops: [["Tam phân số thực (100 vòng)", "O(100 · T(f))"], ["Tam phân số nguyên", "O(log N · T(f))"], ["Nhị phân theo độ dốc (số nguyên)", "O(log N · T(f))"]],
      use_case: [
        "Cực đại/cực tiểu của hàm lõm hoặc lồi không có công thức đạo hàm tiện dụng",
        "Bài hình học: khoảng cách nhỏ nhất giữa hai điểm chuyển động, vị trí đặt điểm để tổng khoảng cách nhỏ nhất",
        "Tối ưu một tham số liên tục/nguyên với hàm chi phí lồi",
        "Biến thể lồng nhau (tam phân trong tam phân) cho hàm lồi hai biến"
      ],
      not_for: [
        "Hàm chỉ tăng hoặc chỉ giảm (đơn điệu) → tìm kiếm nhị phân",
        "Hàm có bình nguyên hoặc nhiều đỉnh cục bộ → chia nhỏ miền, quy hoạch động hoặc heuristic (hill climbing, simulated annealing)",
        "Tối ưu hàm lồi một biến có đạo hàm rẻ → nhị phân theo dấu đạo hàm"
      ],
      pitfalls: [
        "Hàm có bình nguyên ngoài đỉnh có thể làm loại nhầm phần chứa đỉnh; kiểm tra tính unimodal ngặt trước khi dùng.",
        "Số thực: dùng số lần lặp cố định thay vì eps. Quanh đỉnh f gần phẳng nên x chỉ chính xác cỡ căn bậc hai của epsilon máy (~1e-8), đừng đòi sai số nhỏ hơn.",
        "Số nguyên: phải dừng khi hi − lo ≤ 2 rồi duyệt nốt (`while (hi - lo > 2)`), nếu không m1, m2 trùng nhau và vòng lặp không thu hẹp.",
        "Tìm cực tiểu: đổi dấu hàm hoặc đảo chiều so sánh (bỏ [lo, m1] khi f(m1) > f(m2)).",
        "Tràn số khi tính f (ví dụ bình phương của hiệu ~10⁹ đã tới 10¹⁸): dùng long long hoặc long double."
      ],
      code: {
        lang: "cpp", title: "ternary-search.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Cực ĐẠI của hàm f unimodal (tăng ngặt rồi giảm ngặt). Cực tiểu: truyền -f.

// Số thực trên [lo, hi]: lặp cố định, trả về x xấp xỉ điểm đỉnh.
template <class F>
double ternaryMaxReal(double lo, double hi, F f, int iters = 100) {
    for (int it = 0; it < iters; it++) {
        double m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (f(m1) < f(m2)) lo = m1;      // đỉnh nằm bên phải m1
        else hi = m2;                    // đỉnh nằm bên trái m2
    }
    return (lo + hi) / 2;
}

// Số nguyên trên [lo, hi]: trả về x đạt giá trị lớn nhất. Dừng khi còn <= 3 phần tử rồi duyệt nốt.
template <class F>
long long ternaryMaxInt(long long lo, long long hi, F f) {
    while (hi - lo > 2) {
        long long m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (f(m1) < f(m2)) lo = m1;
        else hi = m2;
    }
    long long best = lo;
    for (long long x = lo + 1; x <= hi; x++)
        if (f(x) > f(best)) best = x;
    return best;
}

// Số nguyên, cách tốt hơn: nhị phân theo độ dốc. Đỉnh là x đầu tiên có f(x) >= f(x + 1) (f(hi + 1) không bao giờ được gọi).
template <class F>
long long peakBySlope(long long lo, long long hi, F f) {
    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (f(mid) >= f(mid + 1)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
`
      },
      example: {
        input: "f(x) = −(x − 3)² + 10 trên các số nguyên x trong [0, 10]",
        output: "x = 3, f(3) = 10",
        explain: "f(0) = 1, f(1) = 6, f(2) = 9, f(3) = 10, f(4) = 9, … f(10) = −39: hàm tăng ngặt tới x = 3 rồi giảm ngặt nên tam phân (hoặc nhị phân theo độ dốc) tìm ra đỉnh x = 3."
      },
      problems: [
        { site: "lc", name: "Peak Index in a Mountain Array" },
        { site: "lc", name: "Find Peak Element" }
      ],
      related: ["binary-search", "hill-climbing", "convex-hull-trick", "simulated-annealing"],
      compare: {
        "Dùng khi": "Tìm cực trị của hàm có đúng một đỉnh, không cần đạo hàm",
        "Điều kiện": "Unimodal ngặt (không có bình nguyên ngoài đỉnh)",
        "Cần dữ liệu đã sắp xếp": "Không"
      },
      cards: [
        { q: "Hàm cần thoả gì để tam phân đúng?", a: "Tăng ngặt rồi giảm ngặt (unimodal) trên đoạn tìm, không có đoạn bằng nhau ngoài đỉnh." },
        { q: "Khi nào dùng nhị phân thay tam phân?", a: "Khi so sánh được f(x) với f(x+1) (số nguyên) hoặc biết dấu đạo hàm: nhị phân theo độ dốc, ít lần gọi f hơn." },
        { q: "Mỗi bước tam phân loại bao nhiêu đoạn?", a: "Một phần ba, giữ lại 2/3; muốn sai số ε cần cỡ log₁,₅(độ dài / ε) vòng." },
        { q: "Muốn tìm cực tiểu thì sửa thế nào?", a: "Đổi dấu hàm hoặc đảo so sánh: bỏ [lo, m1] khi f(m1) > f(m2)." }
      ]
    },

    {
      id: "two-pointers",
      name: "Hai con trỏ",
      aliases: ["two pointers", "hai con trỏ", "2 pointers", "two-pointer", "con trỏ chậm nhanh", "two sum sorted", "3sum"],
      category: "tech",
      sub: "Duyệt hai đầu / cửa sổ",
      level: 2,
      tags: ["two-pointers", "sorted-array", "array", "pairs", "linear-time"],
      summary: "Dùng hai chỉ số cùng duyệt một mảng (từ hai đầu vào giữa, hoặc cùng chiều với tốc độ khác nhau) để thay vòng lặp lồng nhau O(N²) bằng O(N).",
      description:
        "**Hai đầu**: trên mảng đã sắp xếp, đặt `i` ở đầu và `j` ở cuối. Nếu tổng `a[i] + a[j]` quá nhỏ thì chỉ có thể tăng bằng cách dời `i` sang phải; nếu quá lớn thì dời `j` sang trái. Mỗi bước loại ít nhất một phần tử khỏi mọi cặp còn có thể là đáp án nên tổng cộng O(N) thay vì O(N²).\n\n" +
        "**Cùng chiều (chậm / nhanh)**: một con trỏ đọc, một con trỏ ghi — xoá phần tử trùng, gộp hai mảng sắp xếp, giao hai tập, phân hoạch. Khi con trỏ thứ hai chỉ tiến theo một điều kiện trên đoạn liên tục, kỹ thuật chuyển thành *cửa sổ trượt*.\n\n" +
        "Cách tự kiểm tra tính đúng của dạng hai đầu: ‘nếu bước này dời con trỏ thì mọi cặp bị bỏ qua đều không thể là đáp án’. Hãy tự chứng minh câu đó trước khi áp dụng cho một bài mới; nếu không chứng minh được thường là điều kiện chưa đơn điệu.",
      conditions: [
        "Dạng hai đầu: mảng đã sắp xếp (hoặc sắp xếp trước, O(N log N))",
        "Điều kiện đơn điệu theo từng con trỏ: dời một đầu luôn làm đại lượng đang xét tăng (hoặc giảm)"
      ],
      complexity: { time: "O(N)", space: "O(1)", note: "Cộng O(N log N) nếu phải sắp xếp trước. 3-sum: cố định một số rồi hai đầu → O(N²)." },
      ops: [["Tìm cặp có tổng cho trước (đã sắp xếp)", "O(N)"], ["Đếm cặp có tổng ≤ X", "O(N)"], ["Giao / hợp hai mảng sắp xếp", "O(N + M)"], ["Xoá trùng tại chỗ", "O(N)"]],
      use_case: [
        "Two-sum / three-sum / four-sum trên mảng sắp xếp",
        "Đếm cặp (hoặc bộ ba) có tổng, hiệu thoả một bất đẳng thức",
        "Gộp, giao, xoá trùng, phân hoạch mảng đã sắp xếp",
        "Ghép hai nhóm theo thứ tự (xe và người, ổ khoá và chìa) bằng tham lam trên mảng đã sắp xếp"
      ],
      not_for: [
        "Đoạn con liên tiếp có tổng ≤ K khi mảng có số âm → cửa sổ trượt không còn đúng; dùng prefix sum + cấu trúc dữ liệu",
        "Mảng chưa sắp xếp mà phải giữ chỉ số gốc và không thể sắp lại → bảng băm (unordered_map)",
        "Điều kiện không đơn điệu (ví dụ tích khi có cả số âm) → xét lại điều kiện hoặc dùng cấu trúc khác"
      ],
      pitfalls: [
        "Quên sắp xếp mảng trước khi dùng hai đầu — kết quả sai mà không báo lỗi.",
        "Sau khi sắp xếp mất chỉ số gốc: lưu cặp (giá trị, chỉ số) nếu đề hỏi chỉ số.",
        "`while (i < j)` (hai phần tử phân biệt) khác `while (i <= j)` (cho dùng cùng một phần tử hai lần) — chọn theo đề.",
        "Tổng a[i] + a[j] tràn int; dùng long long.",
        "Giá trị trùng khi đếm hoặc liệt kê cặp: dời cả đoạn bằng nhau cùng lúc để không đếm lặp hoặc bỏ sót (3-sum cần bỏ bộ trùng)."
      ],
      code: {
        lang: "cpp", title: "two-pointers.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hai con trỏ trên mảng a ĐÃ SẮP XẾP tăng. Chỉ số 0-based. Giá trị |a[i]| <= 1e18 để tổng không tràn long long.

// Tìm một cặp i < j có a[i] + a[j] == target; không có thì trả {-1, -1}. O(n).
pair<int, int> twoSumSorted(const vector<long long>& a, long long target) {
    int i = 0, j = (int)a.size() - 1;
    while (i < j) {
        long long s = a[i] + a[j];
        if (s == target) return {i, j};
        if (s < target) i++;      // tổng nhỏ quá: chỉ tăng được bằng cách dời đầu trái sang phải
        else j--;                 // tổng lớn quá: dời đầu phải sang trái
    }
    return {-1, -1};
}

// Đếm số cặp i < j có a[i] + a[j] <= x. O(n).
long long countPairsSumAtMost(const vector<long long>& a, long long x) {
    long long cnt = 0;
    int i = 0, j = (int)a.size() - 1;
    while (i < j) {
        if (a[i] + a[j] <= x) { cnt += j - i; i++; }   // a[i] ghép được với MỌI chỉ số trong (i, j]
        else j--;                                       // a[j] quá lớn kể cả với phần tử nhỏ nhất còn lại
    }
    return cnt;
}

// Giao của hai mảng sắp xếp, giữ số lần lặp: mỗi giá trị xuất hiện min(đếm trong a, đếm trong b) lần. O(n + m).
vector<long long> intersectSorted(const vector<long long>& a, const vector<long long>& b) {
    vector<long long> res;
    size_t i = 0, j = 0;
    while (i < a.size() && j < b.size()) {
        if (a[i] < b[j]) i++;
        else if (a[i] > b[j]) j++;
        else { res.push_back(a[i]); i++; j++; }
    }
    return res;
}

// Dạng cùng chiều (chậm / nhanh): xoá phần tử trùng liên tiếp trong mảng đã sắp xếp, trả về độ dài mới. O(n).
int uniqueSorted(vector<long long>& a) {
    int k = 0;                                            // k = số phần tử đã giữ (con trỏ ghi)
    for (int r = 0; r < (int)a.size(); r++)               // r = con trỏ đọc
        if (k == 0 || a[r] != a[k - 1]) a[k++] = a[r];
    a.resize(k);
    return k;
}
`
      },
      example: {
        input: "a = [1, 3, 4, 6, 8, 11], target = 10 (twoSumSorted)",
        output: "(2, 3)  — a[2] + a[3] = 4 + 6 = 10",
        explain: "i=0, j=5: 1+11=12 > 10 → j=4. 1+8=9 < 10 → i=1. 3+8=11 > 10 → j=3. 3+6=9 < 10 → i=2. 4+6=10 = target nên trả về (2, 3). Mỗi chỉ số chỉ được dời tối đa một lần nên tổng O(N)."
      },
      problems: [
        { site: "cses", id: "1640", name: "Sum of Two Values" },
        { site: "cses", id: "1641", name: "Sum of Three Values" },
        { site: "cses", id: "1642", name: "Sum of Four Values" },
        { site: "cses", id: "1084", name: "Apartments" },
        { site: "cses", id: "1090", name: "Ferris Wheel" }
      ],
      related: ["sliding-window", "binary-search", "sorting", "monotonic-queue"],
      compare: {
        "Dùng khi": "Mảng sắp xếp, tìm hoặc đếm cặp theo tổng/hiệu; gộp, giao mảng",
        "Điều kiện": "Đơn điệu theo từng con trỏ",
        "Cần dữ liệu đã sắp xếp": "Có (dạng hai đầu); không bắt buộc (dạng chậm/nhanh)"
      },
      cards: [
        { q: "Hai con trỏ hai đầu tìm cặp có tổng cho trước chạy trong bao lâu?", a: "O(N) sau khi mảng đã sắp xếp (O(N log N) gồm cả sắp xếp)." },
        { q: "Khi tổng a[i] + a[j] nhỏ hơn mục tiêu thì dời con trỏ nào?", a: "Dời i sang phải: a[j] đã là lớn nhất còn lại ghép với a[i], nên a[i] không thể đạt tổng đủ lớn." },
        { q: "Đếm cặp i < j có a[i] + a[j] ≤ x: khi a[i] + a[j] ≤ x thì cộng bao nhiêu?", a: "j − i: a[i] ghép được với mọi chỉ số trong (i, j] vì mảng tăng dần; rồi dời i." },
        { q: "Hai con trỏ khác cửa sổ trượt thế nào?", a: "Hai con trỏ hai đầu cần mảng sắp xếp và đi vào nhau; cửa sổ trượt cùng đi một chiều trên đoạn liên tiếp, không cần sắp xếp nhưng cần điều kiện đơn điệu." }
      ]
    },

    {
      id: "sliding-window",
      name: "Cửa sổ trượt",
      aliases: ["sliding window", "cửa sổ trượt", "window", "đoạn con liên tiếp dài nhất", "shortest subarray sum", "longest substring without repeating"],
      category: "tech",
      sub: "Duyệt hai đầu / cửa sổ",
      level: 2,
      tags: ["sliding-window", "two-pointers", "subarray", "array", "string"],
      summary: "Duy trì đoạn liên tiếp [l, r] trượt dọc mảng hoặc xâu: mở rộng r, thu hẹp l khi vi phạm điều kiện, để tìm đoạn tốt nhất hoặc đếm đoạn trong O(N).",
      description:
        "Cửa sổ giữ một **bất biến** (tổng ≤ K, không ký tự lặp, ≤ k giá trị khác nhau…). Với mỗi `r`, thêm `a[r]` vào trạng thái; nếu bất biến bị phá thì dời `l` tới khi hợp lệ trở lại. Mỗi phần tử vào và ra cửa sổ đúng một lần nên tổng O(N) (cộng chi phí cập nhật trạng thái).\n\n" +
        "Hai kiểu: **cửa sổ độ dài cố định k** (cộng phần tử mới, trừ phần tử cũ; với max/min dùng hàng đợi đơn điệu) và **cửa sổ độ dài thay đổi** (như trên).\n\n" +
        "Tính đúng cần **đơn điệu**: nếu một cửa sổ hợp lệ thì mọi cửa sổ con của nó cũng hợp lệ (hoặc ngược lại). Vì thế bài ‘tổng ≤ K’ đòi hỏi phần tử không âm. Muốn đếm đoạn có *đúng* k giá trị khác nhau, dùng `atMost(k) − atMost(k − 1)`; mỗi vị trí `r` đóng góp `r − l + 1` đoạn kết thúc tại `r`.",
      conditions: [
        "Hợp lệ có tính đơn điệu: thu hẹp cửa sổ không bao giờ làm nó hết hợp lệ (ví dụ tổng ≤ K với phần tử ≥ 0)",
        "Cập nhật trạng thái khi thêm hoặc bớt một phần tử đủ nhanh (O(1) hoặc O(log))"
      ],
      complexity: { time: "O(N)", space: "O(1) với tổng, O(D) với D giá trị khác nhau trong cửa sổ", note: "Mỗi chỉ số vào và ra cửa sổ đúng một lần; nếu trạng thái dùng map thì thêm hệ số log." },
      ops: [["Đoạn dài nhất có tổng ≤ K", "O(N)"], ["Đoạn ngắn nhất có tổng ≥ S", "O(N)"], ["Đoạn dài nhất không giá trị lặp", "O(N)"], ["Đếm đoạn có ≤ k giá trị khác nhau", "O(N)"]],
      use_case: [
        "Đoạn dài nhất / ngắn nhất thoả một ràng buộc đơn điệu (tổng, số giá trị khác nhau, số ký tự lặp)",
        "Đếm số đoạn con thoả ràng buộc (atMost − atMost)",
        "Cửa sổ cố định k: tổng, trung bình, số giá trị phân biệt trong mọi cửa sổ",
        "Xâu con dài nhất không lặp ký tự, xâu con chứa đủ tập ký tự yêu cầu"
      ],
      not_for: [
        "Mảng có số âm và bài hỏi tổng ≤ K → prefix sum + ordered-set hoặc cấu trúc khác",
        "Max/min của mọi cửa sổ độ dài cố định → hàng đợi đơn điệu (monotonic-queue)",
        "Truy vấn đoạn tuỳ ý (không liên tiếp theo thứ tự) → sparse table, segment tree, thuật toán Mo"
      ],
      pitfalls: [
        "Có số âm: thu hẹp trái không còn làm tổng nhỏ đi nên cửa sổ không còn đúng.",
        "Ghi nhận kết quả sai chỗ: với ‘dài nhất’ ghi nhận SAU khi thu hẹp; với ‘ngắn nhất’ ghi nhận TRONG vòng thu hẹp.",
        "Đếm đoạn phải cộng `r - l + 1` (số đoạn kết thúc tại r), không phải cộng 1.",
        "Tràn tổng int; dùng long long cho tổng.",
        "unordered_map có thể bị tấn công băm trên Codeforces; nén giá trị trước hoặc dùng mảng đếm / map.",
        "Cửa sổ rỗng: kiểm tra `l <= r` trong vòng thu hẹp (khi K âm hoặc một phần tử đơn lẻ đã vi phạm) để không chạy ra ngoài mảng."
      ],
      code: {
        lang: "cpp", title: "sliding-window.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Cửa sổ trượt [l, r] trên mảng a (0-based): mở rộng r, thu hẹp l khi cửa sổ hết hợp lệ.
// Mỗi chỉ số vào và ra cửa sổ đúng một lần nên các hàm dưới đều O(n) (cộng chi phí map nếu có).

// Đoạn liên tiếp DÀI NHẤT có tổng <= K. Yêu cầu mọi a[i] >= 0. Trả về độ dài (0 nếu không có).
int longestSumAtMost(const vector<long long>& a, long long K) {
    int best = 0, l = 0;
    long long sum = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        sum += a[r];
        while (l <= r && sum > K) sum -= a[l++];     // thu hẹp tới khi hợp lệ trở lại
        best = max(best, r - l + 1);                  // "dài nhất": ghi nhận sau khi thu hẹp
    }
    return best;
}

// Đoạn liên tiếp NGẮN NHẤT có tổng >= S. Yêu cầu mọi a[i] >= 0. Trả về độ dài (0 nếu không có).
int shortestSumAtLeast(const vector<long long>& a, long long S) {
    int best = INT_MAX, l = 0;
    long long sum = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        sum += a[r];
        while (l <= r && sum >= S) {                 // còn hợp lệ: ghi nhận rồi thử thu hẹp tiếp
            best = min(best, r - l + 1);              // "ngắn nhất": ghi nhận trong vòng thu hẹp
            sum -= a[l++];
        }
    }
    return best == INT_MAX ? 0 : best;
}

// Đoạn liên tiếp dài nhất gồm toàn giá trị khác nhau (kiểu giá trị bất kỳ).
int longestAllDistinct(const vector<long long>& a) {
    unordered_map<long long, int> last;               // vị trí xuất hiện gần nhất
    int best = 0, l = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        auto it = last.find(a[r]);
        if (it != last.end() && it->second >= l) l = it->second + 1;
        last[a[r]] = r;
        best = max(best, r - l + 1);
    }
    return best;
}

// Số đoạn con có TỐI ĐA k giá trị khác nhau (k >= 0). Đúng k giá trị = atMost(k) - atMost(k - 1).
long long countAtMostKDistinct(const vector<long long>& a, int k) {
    if (k < 0) return 0;
    unordered_map<long long, int> cnt;
    long long res = 0;
    int l = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        cnt[a[r]]++;
        while ((int)cnt.size() > k) {                 // quá k giá trị khác nhau: thu hẹp
            if (--cnt[a[l]] == 0) cnt.erase(a[l]);
            l++;
        }
        res += r - l + 1;                             // mọi đoạn kết thúc tại r, bắt đầu từ l..r
    }
    return res;
}
`
      },
      example: {
        input: "a = [2, 1, 5, 2, 3, 2], S = 7 (shortestSumAtLeast)",
        output: "2",
        explain: "Đoạn [5, 2] có tổng 7 và độ dài 2. Không đoạn độ dài 1 nào có tổng ≥ 7 (lớn nhất là 5). Khi r = 3 cửa sổ [1, 5, 2] có tổng 8 ≥ 7 (độ dài 3); thu hẹp thành [5, 2] có tổng 7 (độ dài 2, ghi nhận); thu hẹp tiếp thành [2] có tổng 2 < 7 thì dừng."
      },
      problems: [
        { site: "cses", id: "1141", name: "Playlist" },
        { site: "cses", id: "3420", name: "Distinct Values Subarrays" },
        { site: "cses", id: "2428", name: "Distinct Values Subarrays II" },
        { site: "cses", id: "1660", name: "Subarray Sums I" },
        { site: "lc", name: "Longest Substring Without Repeating Characters" },
        { site: "lc", name: "Minimum Window Substring" }
      ],
      related: ["two-pointers", "monotonic-queue", "array-prefix-sum", "binary-search", "mo-algorithm"],
      compare: {
        "Dùng khi": "Đoạn liên tiếp dài/ngắn nhất hoặc đếm đoạn với ràng buộc đơn điệu",
        "Điều kiện": "Hợp lệ đơn điệu khi thu hẹp; cập nhật trạng thái nhanh",
        "Cần dữ liệu đã sắp xếp": "Không"
      },
      cards: [
        { q: "Điều kiện để cửa sổ trượt cho kết quả đúng?", a: "Hợp lệ phải đơn điệu: thu hẹp cửa sổ hợp lệ vẫn hợp lệ (ví dụ tổng ≤ K cần phần tử không âm)." },
        { q: "Đếm đoạn có đúng k giá trị khác nhau?", a: "atMost(k) − atMost(k − 1); mỗi r cộng thêm r − l + 1 đoạn." },
        { q: "Độ phức tạp cửa sổ trượt và vì sao?", a: "O(N): hai con trỏ chỉ tiến, mỗi chỉ số vào và ra cửa sổ đúng một lần." },
        { q: "Có số âm thì sao với bài tổng ≤ K?", a: "Cửa sổ không còn đúng; dùng prefix sum kết hợp cấu trúc dữ liệu thứ tự (ordered-set) hoặc bài toán khác." }
      ]
    },

    {
      id: "sorting",
      name: "Sắp xếp (merge / quick / counting)",
      aliases: ["sorting", "sắp xếp", "sort", "std::sort", "stable_sort", "merge sort", "quick sort", "counting sort", "radix sort", "sắp xếp đếm phân phối"],
      category: "tech",
      sub: "Sắp xếp & đếm",
      level: 2,
      tags: ["sorting", "merge-sort", "quick-sort", "counting-sort", "radix-sort"],
      summary: "Các cách sắp xếp dùng trong thi đấu: std::sort và stable_sort cho O(N log N) tổng quát, merge sort, quick sort 3 đường, counting và radix sort cho số nguyên trong miền hẹp.",
      description:
        "**Dựa trên so sánh** có cận dưới Ω(N log N). `std::sort` (introsort, không ổn định) thường nhanh nhất trên thực tế. `std::stable_sort` (merge sort) giữ thứ tự tương đối của các phần tử bằng nhau — cần khi sắp xếp theo nhiều khoá lần lượt. Merge sort còn là nền của bài đếm nghịch thế. Quick sort 3 đường chia thành ba phần (nhỏ hơn / bằng / lớn hơn pivot chọn ngẫu nhiên) nên nhiều phần tử trùng vẫn nhanh.\n\n" +
        "**Không dựa trên so sánh**: counting sort đếm số lần xuất hiện của mỗi giá trị trong `[0, M]` rồi ghi lại → O(N + M). Radix sort (LSD) sắp xếp lần lượt từng byte/chữ số bằng counting sort ổn định → O(N · d), d là số lượt (4 lượt cho số 32-bit với base 256). Chúng thắng khi N lớn, khoá là số nguyên và miền nhỏ.\n\n" +
        "Cách chọn: mặc định `sort`; cần ổn định → `stable_sort`; khoá nguyên với miền ≲ 10⁶ → counting; hàng chục triệu số 32/64-bit → radix; khoá phức tạp → viết comparator thoả *strict weak ordering* (dùng `<`, không dùng `<=`).",
      conditions: [
        "Sắp xếp so sánh: cần quan hệ thứ tự chặt (strict weak ordering): không phản xạ, bắc cầu, tương đương bắc cầu",
        "Counting / radix: khoá là số nguyên (hoặc ánh xạ được thành số nguyên) trong miền biết trước"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Counting sort O(N + M) thời gian, O(M) bộ nhớ phụ. Radix sort LSD 32-bit (base 256) O(4·(N + 256)). Quick sort 3 đường: O(N log N) kỳ vọng. std::sort: O(N log N) trường hợp xấu nhất, bộ nhớ phụ O(log N)." },
      ops: [["std::sort (introsort)", "O(N log N)"], ["std::stable_sort / merge sort", "O(N log N)"], ["Quick sort 3 đường, pivot ngẫu nhiên", "O(N log N) kỳ vọng"], ["Counting sort", "O(N + M)"], ["Radix sort 32-bit (base 256)", "O(N)"]],
      use_case: [
        "Chuẩn bị dữ liệu cho nhị phân, hai con trỏ, tham lam (sắp theo thời điểm kết thúc, theo tỉ lệ…)",
        "Loại phần tử trùng hoặc đếm giá trị phân biệt: sort + unique",
        "Nén toạ độ, xếp hạng, đếm nghịch thế, ghép cặp nhỏ–lớn",
        "Sắp xếp theo nhiều khoá: một comparator tổng hợp hoặc stable_sort lần lượt từ khoá phụ tới khoá chính"
      ],
      not_for: [
        "Chỉ cần k phần tử nhỏ nhất → nth_element O(N) hoặc heap",
        "Dữ liệu thay đổi liên tục và cần luôn có thứ tự → set / ordered-set / heap",
        "Chỉ cần phần tử lớn nhất hoặc nhỏ nhất → duyệt một lần O(N)"
      ],
      pitfalls: [
        "Comparator dùng `<=` hoặc không nhất quán vi phạm strict weak ordering: std::sort có thể truy cập ngoài mảng hoặc crash. Luôn dùng `<`.",
        "So sánh số thực bằng epsilon trong comparator làm ‘bằng nhau’ không bắc cầu — cũng làm sort hỏng.",
        "Quick sort tự viết với pivot đầu/giữa bị test xấu kéo về O(N²): chọn pivot ngẫu nhiên và chia 3 đường khi có nhiều phần tử trùng.",
        "Counting sort với miền M lớn (10⁹) tốn bộ nhớ O(M): nén toạ độ trước hoặc dùng radix sort.",
        "Radix sort số có dấu: phải lật bit dấu (XOR 0x80000000) trước và sau, nếu không số âm đứng sau số dương.",
        "`sort` không ổn định: muốn giữ thứ tự ban đầu của các phần tử bằng nhau phải dùng stable_sort hoặc thêm chỉ số làm khoá phụ."
      ],
      code: {
        lang: "cpp", title: "sorting.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Các hàm sắp xếp TĂNG DẦN, tại chỗ, trên vector<int>. Đời thường cứ dùng sort / stable_sort; đây là cài đặt để nắm ý tưởng.

// 1) Counting sort: mọi giá trị nằm trong [0, maxVal]. O(n + maxVal).
void countingSort(vector<int>& a, int maxVal) {
    vector<int> cnt(maxVal + 1, 0);
    for (int x : a) cnt[x]++;
    int k = 0;
    for (int v = 0; v <= maxVal; v++)
        for (int c = cnt[v]; c > 0; c--) a[k++] = v;
}

// 2) Radix sort LSD, base 256, có xử lý số âm. 4 lượt, mỗi lượt O(n + 256).
void radixSort(vector<int>& a) {
    int n = a.size();
    vector<unsigned> cur(n), tmp(n);
    for (int i = 0; i < n; i++) cur[i] = (unsigned)a[i] ^ 0x80000000u;   // lật bit dấu: so sánh không dấu = so sánh có dấu
    for (int shift = 0; shift < 32; shift += 8) {
        int cnt[257] = {0};
        for (unsigned x : cur) cnt[((x >> shift) & 255) + 1]++;
        for (int d = 0; d < 256; d++) cnt[d + 1] += cnt[d];                // cnt[d] = vị trí bắt đầu của chữ số d
        for (unsigned x : cur) tmp[cnt[(x >> shift) & 255]++] = x;        // duyệt xuôi giữ tính ổn định
        cur.swap(tmp);
    }
    for (int i = 0; i < n; i++) a[i] = (int)(cur[i] ^ 0x80000000u);
}

// 3) Merge sort (ổn định): chia đôi, sắp từng nửa, trộn. O(n log n), bộ nhớ phụ O(n).
void mergeSortRec(vector<int>& a, vector<int>& buf, int lo, int hi) {     // sắp a[lo..hi)
    if (hi - lo < 2) return;
    int mid = (lo + hi) / 2;
    mergeSortRec(a, buf, lo, mid);
    mergeSortRec(a, buf, mid, hi);
    int i = lo, j = mid, k = lo;
    while (i < mid || j < hi) {
        if (j == hi || (i < mid && a[i] <= a[j])) buf[k++] = a[i++];       // bằng nhau lấy bên trái trước: ổn định
        else buf[k++] = a[j++];
    }
    copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
}
void mergeSort(vector<int>& a) {
    vector<int> buf(a.size());
    mergeSortRec(a, buf, 0, (int)a.size());
}

// 4) Quick sort 3 đường, pivot ngẫu nhiên: nhiều phần tử trùng vẫn O(n log n) kỳ vọng.
void quickSort3(vector<int>& a, int lo, int hi) {                         // sắp a[lo..hi] (đóng)
    static mt19937 rng(712367);
    while (lo < hi) {
        int p = a[lo + rng() % (hi - lo + 1)];
        int lt = lo, i = lo, gt = hi;                // [lo,lt) < p, [lt,i) == p, (gt,hi] > p
        while (i <= gt) {
            if (a[i] < p) swap(a[lt++], a[i++]);
            else if (a[i] > p) swap(a[i], a[gt--]);
            else i++;
        }
        if (lt - lo < hi - gt) { quickSort3(a, lo, lt - 1); lo = gt + 1; }    // đệ quy nửa nhỏ, lặp nửa lớn:
        else { quickSort3(a, gt + 1, hi); hi = lt - 1; }                       // ngăn xếp luôn O(log n)
    }
}
void quickSort(vector<int>& a) {
    if (!a.empty()) quickSort3(a, 0, (int)a.size() - 1);
}
`
      },
      example: {
        input: "a = [5, −1, 3, 3, 0]",
        output: "[−1, 0, 3, 3, 5]",
        explain: "Mọi hàm trên đều cho cùng kết quả. Counting sort (sau khi cộng 1 để hết số âm, M = 6) đếm cnt = {−1:1, 0:1, 3:2, 5:1} rồi ghi lại theo thứ tự giá trị; radix sort xử lý 4 byte; merge sort chia [5, −1, 3 | 3, 0] rồi trộn."
      },
      problems: [
        { site: "cses", id: "1621", name: "Distinct Numbers" },
        { site: "cses", id: "1074", name: "Stick Lengths" },
        { site: "cses", id: "1630", name: "Tasks and Deadlines" },
        { site: "cses", id: "1084", name: "Apartments" }
      ],
      related: ["count-inversions", "binary-search", "two-pointers", "coordinate-compression", "heap"],
      compare: {
        "Dùng khi": "Cần thứ tự trước khi nhị phân / hai con trỏ / tham lam; xếp hạng, loại trùng",
        "Điều kiện": "Có quan hệ thứ tự chặt (hoặc khoá nguyên cho counting/radix)",
        "Cần dữ liệu đã sắp xếp": "Không — chính là bước tạo ra dữ liệu đã sắp xếp"
      },
      cards: [
        { q: "std::sort có ổn định không? Muốn ổn định dùng gì?", a: "Không ổn định. Dùng std::stable_sort (merge sort) hoặc thêm chỉ số vào khoá." },
        { q: "Khi nào counting sort tốt hơn std::sort?", a: "Khoá nguyên trong miền nhỏ M (≲ 10⁶): O(N + M) thay vì O(N log N)." },
        { q: "Vì sao comparator dùng <= là lỗi nguy hiểm?", a: "Vi phạm strict weak ordering (a <= a đúng): std::sort có thể đọc ngoài mảng hoặc crash." },
        { q: "Radix sort số 32-bit base 256 cần mấy lượt?", a: "4 lượt (mỗi lượt một byte), mỗi lượt O(N + 256); số có dấu phải lật bit dấu." }
      ]
    },

    {
      id: "count-inversions",
      name: "Đếm nghịch thế",
      aliases: ["count inversions", "đếm nghịch thế", "inversion count", "số nghịch thế", "inversions", "kendall tau", "số lần đổi chỗ kề nhau"],
      category: "tech",
      sub: "Sắp xếp & đếm",
      level: 3,
      tags: ["inversions", "merge-sort", "divide-and-conquer", "counting", "permutation"],
      summary: "Đếm số cặp (i < j) có a[i] > a[j] bằng merge sort: mỗi lần trộn, phần tử nửa phải được lấy trước k phần tử còn lại của nửa trái thì tạo thêm k nghịch thế.",
      description:
        "**Nghịch thế** là cặp `i < j` mà `a[i] > a[j]`. Số nghịch thế đo độ ‘mất trật tự’ của dãy: nó bằng đúng số lần **đổi chỗ hai phần tử kề nhau** tối thiểu để sắp xếp (số bước của bubble sort), và chẵn/lẻ của nó chính là tính chẵn/lẻ của hoán vị.\n\n" +
        "Merge sort: chia đôi, đếm nghịch thế trong từng nửa (đệ quy), rồi đếm các cặp ‘bắc cầu’ có `a[i]` ở nửa trái và `a[j]` ở nửa phải. Khi trộn hai nửa đã sắp xếp, mỗi lần phải lấy `a[j]` của nửa phải trong lúc nửa trái còn `mid − i` phần tử thì cả `mid − i` phần tử đó đều lớn hơn `a[j]` (nửa trái đã sắp xếp), nên cộng `mid − i`. Tổng O(N log N).\n\n" +
        "Cách khác: duyệt từ trái sang, dùng **Fenwick tree** trên giá trị đã nén; với mỗi phần tử đếm số phần tử đã gặp lớn hơn nó. Cũng O(N log N), linh hoạt hơn khi cần đếm theo từng phần tử hoặc biến thể có điều kiện. Đáp án có thể tới N(N−1)/2 nên phải dùng `long long`.",
      conditions: [
        "So sánh được hai phần tử (thứ tự toàn phần)",
        "Với phần tử bằng nhau cần quyết định có tính là nghịch thế hay không (mẫu: không tính, nghịch thế chặt)"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Bản Fenwick tree cũng O(N log N) và cần nén giá trị trước." },
      ops: [["Đếm nghịch thế (merge sort)", "O(N log N)"], ["Đếm nghịch thế (Fenwick tree)", "O(N log N)"]],
      use_case: [
        "Số lần đổi chỗ hai phần tử kề nhau tối thiểu để sắp xếp (bubble sort)",
        "Đo độ khác nhau giữa hai thứ hạng (khoảng cách Kendall tau)",
        "Đếm cặp (i < j) thoả a[i] > a[j] hoặc biến thể a[i] > 2·a[j] (đổi điều kiện đếm trong bước trộn)",
        "Xác định tính chẵn/lẻ của hoán vị"
      ],
      not_for: [
        "Cần đếm riêng cho từng phần tử (mỗi phần tử có bao nhiêu phần tử nhỏ hơn đứng sau) → Fenwick tree hoặc merge sort có theo dõi chỉ số",
        "Có cập nhật xen kẽ với truy vấn → cấu trúc dữ liệu động (Fenwick lồng, sqrt decomposition, cây cân bằng)"
      ],
      pitfalls: [
        "Đáp án vượt int (tới N(N−1)/2 ≈ 5·10⁹ khi N = 10⁵): dùng long long.",
        "Dấu so sánh quyết định có đếm cặp bằng nhau: lấy bên trái khi `a[i] <= a[j]` thì cặp bằng nhau KHÔNG tính; đổi thành `<` sẽ đếm cả cặp bằng nhau.",
        "Cộng 1 thay vì cộng `mid − i` mỗi lần lấy phần tử bên phải.",
        "Mẫu sắp xếp luôn mảng nên nhận bản sao; nếu truyền tham chiếu mà còn dùng lại mảng gốc thì nó đã bị sắp xếp.",
        "Cấp phát vector phụ ở mỗi tầng đệ quy làm chậm; dùng một buffer dùng chung như mẫu."
      ],
      code: {
        lang: "cpp", title: "count-inversions.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Đếm số cặp i < j có a[i] > a[j] (nghịch thế CHẶT: cặp bằng nhau không tính) bằng merge sort. O(n log n).
// Nhận bản sao của mảng (hàm sắp xếp bản sao). Kết quả có thể tới n(n-1)/2 nên dùng long long.
struct InversionCounter {
    vector<long long> buf;

    long long rec(vector<long long>& a, int lo, int hi) {         // đếm trong a[lo..hi) và sắp xếp nó
        if (hi - lo < 2) return 0;
        int mid = (lo + hi) / 2;
        long long cnt = rec(a, lo, mid) + rec(a, mid, hi);
        int i = lo, j = mid, k = lo;
        while (i < mid || j < hi) {
            if (j == hi || (i < mid && a[i] <= a[j])) buf[k++] = a[i++];   // "<=" : cặp bằng nhau không tính
            else {
                cnt += mid - i;                    // a[j] đứng trước mid - i phần tử còn lại của nửa trái, đều lớn hơn a[j]
                buf[k++] = a[j++];
            }
        }
        copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
        return cnt;
    }
};

long long countInversions(vector<long long> a) {
    InversionCounter c;
    c.buf.assign(a.size(), 0);
    return c.rec(a, 0, (int)a.size());
}
`
      },
      example: {
        input: "a = [3, 1, 2, 5, 4]",
        output: "3",
        explain: "Các nghịch thế: (3, 1), (3, 2) và (5, 4). Chia [3, 1, 2 | 5, 4]: nửa trái có 2 nghịch thế, nửa phải có 1, ghép hai nửa đã sắp xếp [1, 2, 3] và [4, 5] không thêm nghịch thế nào. Tổng 3 — cũng là số lần đổi chỗ hai phần tử kề nhau tối thiểu để sắp xếp dãy."
      },
      problems: [
        { site: "lc", name: "Count of Smaller Numbers After Self" },
        { site: "lc", name: "Reverse Pairs" },
        { site: "lc", name: "Global and Local Inversions" },
        { site: "spoj", name: "INVCNT - Inversion Count" }
      ],
      related: ["sorting", "fenwick-tree", "coordinate-compression", "segment-tree"],
      compare: {
        "Dùng khi": "Đếm cặp (i < j) có a[i] > a[j]; số lần đổi kề tối thiểu để sắp xếp",
        "Điều kiện": "Thứ tự toàn phần; quyết định đếm chặt hay không chặt với giá trị trùng",
        "Cần dữ liệu đã sắp xếp": "Không (sắp xếp xảy ra như hệ quả của merge sort)"
      },
      cards: [
        { q: "Nghịch thế là gì?", a: "Cặp chỉ số i < j có a[i] > a[j]." },
        { q: "Khi trộn, lấy phần tử nửa phải a[j] thì cộng bao nhiêu?", a: "mid − i: số phần tử còn lại của nửa trái, vì nửa trái đã sắp xếp nên tất cả đều lớn hơn a[j]." },
        { q: "Số nghịch thế liên hệ gì với bubble sort?", a: "Bằng số lần đổi chỗ hai phần tử kề nhau tối thiểu để sắp xếp (đúng bằng số phép đổi của bubble sort)." },
        { q: "Có cách nào khác ngoài merge sort?", a: "Fenwick tree trên giá trị đã nén: với mỗi phần tử đếm số phần tử đã gặp lớn hơn nó, O(N log N)." }
      ]
    },

    {
      id: "meet-in-the-middle",
      name: "Meet in the Middle",
      aliases: ["meet in the middle", "mitm", "gặp nhau ở giữa", "chia đôi tập con", "subset sum n=40", "chia đôi và ghép"],
      category: "tech",
      sub: "Vét cạn thông minh",
      level: 3,
      tags: ["meet-in-the-middle", "subset-sum", "brute-force", "sorting", "two-pointers"],
      summary: "Chia bài toán 2^N thành hai nửa 2^(N/2): liệt kê riêng từng nửa rồi ghép hai danh sách bằng sắp xếp và hai con trỏ; dùng cho N ≲ 40 khi giá trị quá lớn để quy hoạch động.",
      description:
        "Khi phải duyệt mọi tập con của N ≈ 40 phần tử thì 2⁴⁰ ≈ 10¹² quá lớn, nhưng 2²⁰ ≈ 10⁶ rất nhỏ. Tách tập thành hai nửa; với **mỗi nửa** liệt kê toàn bộ tập con và tổng của nó (2^(N/2) giá trị). Một tập con của cả tập là (tập con nửa trái) ∪ (tập con nửa phải), nên đáp án là ghép cặp (x, y), x từ danh sách trái, y từ danh sách phải, thoả điều kiện của bài.\n\n" +
        "Ghép cặp thường **sắp xếp hai danh sách** rồi dùng hai con trỏ hoặc nhị phân: đếm cặp `x + y = S` (nhóm các giá trị trùng và nhân số lượng), hoặc tìm `x + y ≤ W` lớn nhất (knapsack với trọng số khổng lồ). Thời gian O(2^(N/2) · N) do sắp xếp, hoặc O(2^(N/2)) nếu sinh sẵn danh sách đã sắp xếp bằng merge.\n\n" +
        "Dùng khi N nhỏ nhưng **giá trị lớn** khiến DP theo giá trị (knapsack) bất khả thi, và N đủ lớn để vét cạn 2^N không kịp. Sinh tổng tập con bằng cách *nhân đôi* danh sách mỗi khi thêm một phần tử (`s[j] + a[i]`), tránh đệ quy.",
      conditions: [
        "N nhỏ (khoảng 30–44) để liệt kê 2^(N/2) tập con của mỗi nửa (~10⁶–4·10⁶ phần tử, đủ bộ nhớ)",
        "Đáp án của cả tập kết hợp được từ hai nửa độc lập (tổng, xor…) và ghép hai danh sách được bằng sắp xếp"
      ],
      complexity: { time: "O(2^(N/2) · N)", space: "O(2^(N/2))", note: "Thành phần N đến từ sắp xếp; sinh sẵn danh sách đã sắp xếp bằng merge cho O(2^(N/2))." },
      ops: [["Liệt kê tổng các tập con của một nửa", "O(2^(N/2))"], ["Sắp xếp hai danh sách", "O(2^(N/2) · N)"], ["Ghép hai con trỏ đếm cặp có tổng S", "O(2^(N/2))"]],
      use_case: [
        "Đếm hoặc tìm tập con có tổng đúng S khi N ≤ 40, giá trị tới 10⁹–10¹⁸",
        "Knapsack 0/1 với trọng số lớn, N ≤ 40",
        "Tìm tổng tập con gần S nhất hoặc không vượt W lớn nhất",
        "Bài ‘bốn số có tổng S’ chia thành hai cặp (2 + 2) và các bài tương tự chia hai nửa"
      ],
      not_for: [
        "N ≤ 20 → vét cạn 2^N hoặc bitmask là đủ",
        "Giá trị nhỏ (tổng ≤ 10⁶–10⁷) → DP knapsack theo tổng",
        "N ≥ 50 → thường phải dùng ý tưởng khác (DP, toán, tham lam)"
      ],
      pitfalls: [
        "Sinh tập con bằng đệ quy rồi nối vector tốn thời gian và bộ nhớ; hãy nhân đôi danh sách (thêm phần tử mới → s[j] + a[i]).",
        "Giá trị trùng: hai con trỏ phải đếm theo nhóm (cnt_x · cnt_y), không phải từng cặp chỉ số.",
        "Số cách có thể tới 2^N (≈ 10¹²) và tích hai nhóm tới 2⁴⁰: dùng long long.",
        "Chia lệch (ví dụ 10/30) làm mất lợi thế; chia đều N/2.",
        "Tập rỗng được tính là một tập con (tổng 0): kiểm tra đề có cho phép; mẫu có tính.",
        "Tổng của một nửa vẫn có thể vượt int (10⁹ · 20): dùng long long."
      ],
      code: {
        lang: "cpp", title: "meet-in-the-middle.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Tổng của mọi tập con của a[from..to): 2^(to-from) giá trị, sinh bằng cách nhân đôi danh sách.
vector<long long> subsetSums(const vector<long long>& a, int from, int to) {
    vector<long long> s = {0};                      // tập rỗng
    for (int i = from; i < to; i++) {
        size_t m = s.size();
        for (size_t j = 0; j < m; j++) s.push_back(s[j] + a[i]);   // không chọn a[i] (đã có) / chọn a[i]
    }
    return s;
}

// Đếm số tập con (tính cả tập rỗng) của a có tổng đúng S. n tới ~40, a[i] bất kỳ (âm, 0, trùng đều được),
// tổng dùng long long. Thời gian O(2^(n/2) * n), bộ nhớ O(2^(n/2)).
long long countSubsetsWithSum(const vector<long long>& a, long long S) {
    int n = a.size(), h = n / 2;
    vector<long long> L = subsetSums(a, 0, h), R = subsetSums(a, h, n);
    sort(L.begin(), L.end());
    sort(R.begin(), R.end());
    long long cnt = 0;
    int i = 0, j = (int)R.size() - 1;               // i đi lên trên L, j đi xuống trên R
    while (i < (int)L.size() && j >= 0) {
        long long t = L[i] + R[j];
        if (t < S) i++;
        else if (t > S) j--;
        else {                                      // gom nhóm giá trị trùng ở cả hai phía
            long long x = L[i], y = R[j], ci = 0, cj = 0;
            while (i < (int)L.size() && L[i] == x) { i++; ci++; }
            while (j >= 0 && R[j] == y) { j--; cj++; }
            cnt += ci * cj;
        }
    }
    return cnt;
}
`
      },
      example: {
        input: "a = [1, 2, 3, 4], S = 5",
        output: "2",
        explain: "Nửa trái [1, 2] cho các tổng {0, 1, 2, 3}, nửa phải [3, 4] cho {0, 3, 4, 7}. Các cặp có tổng 5: (1, 4) ứng với {1} ∪ {4} và (2, 3) ứng với {2} ∪ {3}; vậy có 2 tập con ({1,4} và {2,3})."
      },
      problems: [
        { site: "cses", id: "1628", name: "Meet in the Middle" },
        { site: "cses", id: "1623", name: "Apple Division" },
        { site: "cses", id: "1642", name: "Sum of Four Values" },
        { site: "lc", name: "Closest Subsequence Sum" },
        { site: "lc", name: "Partition Array Into Two Arrays to Minimize Sum Difference" }
      ],
      related: ["backtracking", "bit-manipulation", "two-pointers", "binary-search", "knapsack-01", "bitmask-dp"],
      compare: {
        "Dùng khi": "N ≲ 40, giá trị lớn, cần xét mọi tập con",
        "Điều kiện": "Kết quả tách được thành hai nửa độc lập; 2^(N/2) vừa bộ nhớ",
        "Cần dữ liệu đã sắp xếp": "Sắp xếp danh sách tổng của mỗi nửa (bước ghép)"
      },
      cards: [
        { q: "Meet in the Middle giảm độ phức tạp từ đâu tới đâu?", a: "Từ O(2^N) xuống cỡ O(2^(N/2) · N) bằng cách chia hai nửa và ghép bằng sắp xếp + hai con trỏ." },
        { q: "Khi nào chọn MITM thay vì DP knapsack?", a: "Khi N ≲ 40 nhưng giá trị/trọng số rất lớn nên DP theo tổng không khả thi." },
        { q: "Ghép hai danh sách tổng bằng hai con trỏ cần chú ý gì?", a: "Gom nhóm giá trị trùng và nhân số lượng hai phía (cnt_x · cnt_y), dùng long long." },
        { q: "Sinh tổng mọi tập con của một nửa thế nào?", a: "Bắt đầu s = {0}; với mỗi phần tử a[i], thêm s[j] + a[i] cho mọi j hiện có (nhân đôi danh sách)." }
      ]
    },

    {
      id: "backtracking",
      name: "Quay lui (Backtracking)",
      aliases: ["backtracking", "quay lui", "vét cạn có cắt tỉa", "pruning", "n queens", "n quân hậu", "dfs trạng thái", "sinh hoán vị"],
      category: "tech",
      sub: "Vét cạn thông minh",
      level: 2,
      tags: ["backtracking", "brute-force", "pruning", "recursion", "n-queens"],
      summary: "Xây nghiệm từng bước, đào sâu rồi hoàn tác khi gặp ngõ cụt, và cắt tỉa sớm các nhánh chắc chắn không dẫn tới nghiệm để duyệt không gian tìm kiếm rất lớn.",
      description:
        "Quay lui duyệt **cây quyết định**: ở mỗi tầng chọn giá trị cho biến tiếp theo và kiểm tra ràng buộc; nếu còn khả thi thì đệ quy xuống, nếu không (hoặc đã xong) thì **hoàn tác** lựa chọn và thử giá trị khác. Khuôn chung: *chọn → đào sâu → hoàn tác*.\n\n" +
        "Sức mạnh nằm ở **cắt tỉa**: bỏ nhánh ngay khi vi phạm ràng buộc (hai quân hậu cùng cột hoặc đường chéo), khi một cận cho thấy không thể tốt hơn nghiệm hiện có, hoặc nhờ thứ tự thử hợp lý (biến bị ràng buộc nhiều nhất trước). Biểu diễn trạng thái bằng bitmask giúp kiểm tra ràng buộc trong O(1) và nhanh hơn nhiều so với duyệt mảng.\n\n" +
        "Điển hình: n quân hậu (n ≈ 14 đếm hết trong chưa tới một giây), hoán vị / tổ hợp có điều kiện, Sudoku, tô màu đồ thị, tìm đường trên lưới — những nơi không có cấu trúc con tối ưu để quy hoạch động. Hai mẫu: đếm nghiệm bằng bitmask và tìm một nghiệm theo khuôn chọn–đào sâu–hoàn tác.",
      conditions: [
        "Nghiệm xây dần được và kiểm tra ràng buộc từng phần để phát hiện nhánh sai sớm",
        "Không gian nhỏ sau cắt tỉa (nghiệm dài ≲ 20–30 bước với cắt tỉa tốt) hoặc cần liệt kê / đếm mọi nghiệm"
      ],
      complexity: { time: "O(N!)", space: "O(N)", note: "Cận trên xấu nhất cho bài hoán vị / n quân hậu; thực tế nhỏ hơn rất nhiều nhờ cắt tỉa. Bộ nhớ là độ sâu đệ quy." },
      use_case: [
        "Liệt kê hoặc đếm hoán vị, tổ hợp, tập con có ràng buộc",
        "n quân hậu, Sudoku, tô màu đồ thị, xếp lịch nhỏ, tìm đường đi trên lưới nhỏ",
        "Tìm một nghiệm (dừng ngay khi thấy) hoặc đếm mọi nghiệm khi không gian nhỏ",
        "Nền tảng của nhánh cận (branch and bound) và tìm kiếm có heuristic"
      ],
      not_for: [
        "Có cấu trúc con tối ưu và số trạng thái nhỏ → quy hoạch động (bitmask DP)",
        "N lớn và mục tiêu cộng tính → tham lam hoặc DP",
        "Cần nghiệm xấp xỉ rất nhanh cho bài khó (NP-hard cỡ lớn) → heuristic (SA, GA, beam search)"
      ],
      pitfalls: [
        "Quên hoàn tác (undo) trạng thái khi quay lui làm nghiệm sai lệch giữa các nhánh.",
        "Kiểm tra ràng buộc quá muộn (sau khi chọn đủ biến) làm số nhánh bùng nổ; kiểm tra ngay khi đặt từng biến.",
        "Sinh trùng nghiệm khi các lựa chọn hoán vị lẫn nhau: ép thứ tự (chỉ chọn phần tử có chỉ số lớn hơn phần tử trước) để không đếm cả các hoán vị của cùng một tập.",
        "Đệ quy quá sâu (≥ 10⁵ tầng) tràn stack; quay lui thường nông nhưng hãy kiểm tra.",
        "Bitmask `1u << n` tràn khi n ≥ 32 (mẫu đúng cho n ≤ 31); đếm số nghiệm dùng long long.",
        "Không có ước lượng thời gian: thử n nhỏ trước, đo số nút thăm để biết cắt tỉa đủ chưa."
      ],
      code: {
        lang: "cpp", title: "backtracking.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Mẫu 1 — ĐẾM số cách đặt n quân hậu (không ăn nhau) bằng quay lui + bitmask. n <= 31 (thực tế n <= 16).
// Mỗi bit của cols/d1/d2 = 1 nghĩa là cột / đường chéo đó đã bị chiếm. O(1) kiểm tra ràng buộc.
struct NQueens {
    int n = 0;
    long long cnt = 0;

    void go(unsigned cols, unsigned d1, unsigned d2) {
        unsigned full = (n == 0) ? 0u : (0xFFFFFFFFu >> (32 - n));   // n bit 1
        if (cols == full) { cnt++; return; }                          // đã xếp đủ n hàng
        unsigned avail = full & ~(cols | d1 | d2);                    // các cột còn đặt được ở hàng này
        while (avail) {
            unsigned bit = avail & (~avail + 1);                      // lấy lowbit
            avail ^= bit;
            go(cols | bit, ((d1 | bit) << 1) & full, (d2 | bit) >> 1);   // sang hàng sau: các đường chéo dịch 1 ô
        }
    }
    long long solve(int n_) {
        n = n_;
        cnt = 0;
        go(0, 0, 0);
        return cnt;
    }
};

// Mẫu 2 — khuôn tổng quát CHỌN - ĐÀO SÂU - HOÀN TÁC, tìm MỘT nghiệm (n >= 1). Trả về col[r] = cột của quân hậu ở hàng r;
// rỗng nếu vô nghiệm (n = 2, 3).
struct QueensFirst {
    int n = 0;
    vector<int> col;
    vector<char> usedCol, usedD1, usedD2;

    bool go(int r) {
        if (r == n) return true;
        for (int c = 0; c < n; c++) {
            if (usedCol[c] || usedD1[r + c] || usedD2[r - c + n - 1]) continue;     // cắt tỉa: ô bị chiếu
            usedCol[c] = usedD1[r + c] = usedD2[r - c + n - 1] = 1;                 // chọn
            col[r] = c;
            if (go(r + 1)) return true;                                             // đào sâu
            usedCol[c] = usedD1[r + c] = usedD2[r - c + n - 1] = 0;                 // hoàn tác
        }
        return false;
    }
    vector<int> solve(int n_) {
        n = n_;
        col.assign(n, -1);
        usedCol.assign(n, 0);
        usedD1.assign(2 * n, 0);
        usedD2.assign(2 * n, 0);
        return go(0) ? col : vector<int>();
    }
};
`
      },
      example: {
        input: "n = 4 (QueensFirst) và n = 6 (NQueens)",
        output: "n = 4: col = [1, 3, 0, 2]; n = 6: 4 cách đặt",
        explain: "Với n = 4 nghiệm đầu tiên theo thứ tự cột tăng dần là hàng 0 cột 1, hàng 1 cột 3, hàng 2 cột 0, hàng 3 cột 2 (có đúng 2 nghiệm, nghiệm kia là [2, 0, 3, 1]). Với n = 6 có 4 cách. Các giá trị đã biết: n = 8 có 92 cách, n = 10 có 724, n = 12 có 14200."
      },
      problems: [
        { site: "cses", id: "1624", name: "Chessboard and Queens" },
        { site: "cses", id: "1625", name: "Grid Path Description" },
        { site: "cses", id: "1622", name: "Creating Strings" },
        { site: "cses", id: "1623", name: "Apple Division" },
        { site: "lc", name: "N-Queens" },
        { site: "lc", name: "Sudoku Solver" }
      ],
      related: ["meet-in-the-middle", "bitmask-dp", "bit-manipulation", "branch-and-bound"],
      compare: {
        "Dùng khi": "Liệt kê / đếm / tìm nghiệm có ràng buộc, không gian lớn nhưng cắt tỉa tốt",
        "Điều kiện": "Kiểm tra ràng buộc từng phần; kích thước nghiệm nhỏ",
        "Cần dữ liệu đã sắp xếp": "Không (thứ tự thử có thể ảnh hưởng tốc độ)"
      },
      cards: [
        { q: "Ba bước của khuôn quay lui?", a: "Chọn một giá trị hợp lệ → đệ quy đào sâu → hoàn tác lựa chọn để thử giá trị khác." },
        { q: "Cắt tỉa (pruning) là gì?", a: "Bỏ ngay các nhánh chắc chắn không dẫn tới nghiệm (vi phạm ràng buộc, không thể tốt hơn nghiệm tốt nhất hiện có) để giảm số trạng thái thăm." },
        { q: "Bitmask giúp gì cho n quân hậu?", a: "Ba mặt nạ cột, đường chéo chính, đường chéo phụ cho biết các ô cấm; tìm cột còn trống bằng lowbit trong O(1), nhanh hơn nhiều so với kiểm tra từng quân." },
        { q: "Khi nào chuyển từ quay lui sang quy hoạch động?", a: "Khi các nhánh lặp lại cùng một trạng thái con (có cấu trúc con tối ưu / trạng thái nhỏ), ghi nhớ kết quả thay vì tính lại." }
      ]
    },

    {
      id: "mo-algorithm",
      name: "Thuật toán Mo",
      aliases: ["mo algorithm", "mo's algorithm", "thuật toán mo", "sqrt trên truy vấn", "offline range queries", "mo"],
      category: "tech",
      sub: "Truy vấn offline",
      level: 4,
      tags: ["mo-algorithm", "offline", "range-query", "sqrt-decomposition", "queries"],
      summary: "Trả lời OFFLINE nhiều truy vấn đoạn [l, r] bằng cách sắp truy vấn theo khối của l rồi dời hai đầu đoạn hiện tại: O((N + Q)·√N) khi thêm/bớt một phần tử khỏi đoạn tốn O(1).",
      description:
        "Mo giữ một đoạn hiện tại `[curL, curR]` cùng trạng thái của nó (ví dụ bảng đếm và số giá trị phân biệt) rồi dịch hai đầu bằng các thao tác **thêm** / **bớt** một phần tử tới đoạn của truy vấn kế tiếp. Điểm mấu chốt là **thứ tự trả lời**: chia chỉ số thành khối kích thước B, sắp truy vấn theo (khối của `l`, rồi `r`). Đầu `l` chỉ dao động trong một khối (≤ B bước mỗi truy vấn), đầu `r` chỉ đi một chiều trong mỗi khối (≤ N bước mỗi khối).\n\n" +
        "Chọn `B ≈ N / √Q` cho tổng khoảng O(N·√Q) bước dời. Mẹo ‘zig-zag’: với khối lẻ sắp `r` giảm dần, đầu `r` không phải chạy ngược về đầu mỗi khối, giảm gần một nửa hằng số.\n\n" +
        "Trong mẫu (đếm số giá trị phân biệt) chỉ cần đổi **trạng thái, `add`, `rem` và cách đọc đáp án** để giải bài khác: giá trị xuất hiện nhiều nhất, số cặp phần tử bằng nhau, tổng bình phương số lần xuất hiện… Luôn **mở rộng đoạn trước, thu hẹp sau** để bảng đếm không bao giờ âm.",
      conditions: [
        "Truy vấn OFFLINE: đọc hết rồi mới trả lời, không cần theo thứ tự",
        "Thêm hoặc bớt MỘT phần tử ở biên đoạn tốn O(1) (hoặc rẻ), đáp án đọc được từ trạng thái",
        "Không có cập nhật mảng xen kẽ (nếu có: Mo có cập nhật thêm chiều thời gian)"
      ],
      complexity: { time: "O((N + Q) · √N)", space: "O(N + Q)", note: "Chọn B = N/√Q cho O(N·√Q) bước dời. Mo có cập nhật (ba chiều l, r, thời gian) đạt O(N^(5/3))." },
      ops: [["Dời đầu đoạn một bước (add / rem)", "O(1)"], ["Tổng số bước dời", "O((N + Q) · √N)"], ["Sắp xếp truy vấn", "O(Q log Q)"]],
      use_case: [
        "Số giá trị phân biệt trong đoạn khi không muốn dùng BIT offline",
        "Giá trị xuất hiện nhiều nhất, số cặp phần tử bằng nhau, tổng bình phương số lần xuất hiện trong đoạn",
        "Bài đoạn khó hợp hai nửa nhưng dễ thêm/bớt một phần tử ở biên",
        "Truy vấn trên cây (qua Euler tour) hoặc Mo với cập nhật cho bài khó hơn"
      ],
      not_for: [
        "Truy vấn online bắt buộc → cấu trúc dữ liệu (segment tree, persistent tree)",
        "Hàm đoạn kết hợp được (tổng, min, gcd…) → prefix sum / sparse table / segment tree nhanh hơn",
        "Có phép hợp hai trạng thái nhưng không có phép ‘bớt’ → Mo với rollback hoặc chia để trị"
      ],
      pitfalls: [
        "Thứ tự dời sai (thu hẹp trước khi mở rộng) làm bộ đếm âm hoặc đoạn có l > r tạm thời → sai im lặng. Luôn mở rộng trước, thu hẹp sau.",
        "Quên nén giá trị: mảng đếm cỡ max(a) lớn hoặc phải dùng map làm chậm; nén toạ độ trước (mẫu tự nén).",
        "Chọn B sai: B = 1 hoặc B > N làm mất lợi thế; dùng N/√Q, tối thiểu 1 (Q ≪ N thì khối lớn hơn √N có lợi).",
        "Comparator sắp xếp truy vấn phải là thứ tự yếu chặt, quy tắc zig-zag theo khối chẵn/lẻ phải nhất quán; không dùng `<=`.",
        "Trả đáp án theo chỉ số truy vấn gốc (lưu id), không theo thứ tự đã sắp xếp.",
        "Thêm/bớt không phải O(1) (ví dụ dùng set) làm tổng thành O(N√N log N), dễ quá giờ."
      ],
      code: {
        lang: "cpp", title: "mo-algorithm.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Thuật toán Mo: trả lời OFFLINE số giá trị phân biệt trong a[l..r] (0-based, đóng) cho nhiều truy vấn {l, r}.
// Muốn giải bài khác: chỉ đổi phần "ĐỔI TẠI ĐÂY" (trạng thái, add, rem, cách đọc đáp án).
vector<int> moDistinct(const vector<int>& a, const vector<pair<int, int>>& qs) {
    int n = a.size(), q = qs.size();
    if (q == 0) return {};
    vector<int> c(a);                                    // nén giá trị về 0..k-1 để dùng mảng đếm
    sort(c.begin(), c.end());
    c.erase(unique(c.begin(), c.end()), c.end());
    vector<int> v(n);
    for (int i = 0; i < n; i++) v[i] = lower_bound(c.begin(), c.end(), a[i]) - c.begin();

    int B = max(1, (int)(n / sqrt((double)q)));          // kích thước khối ~ N / sqrt(Q)
    vector<int> order(q);
    iota(order.begin(), order.end(), 0);
    sort(order.begin(), order.end(), [&](int x, int y) {
        int bx = qs[x].first / B, by = qs[y].first / B;
        if (bx != by) return bx < by;
        return (bx & 1) ? qs[x].second > qs[y].second : qs[x].second < qs[y].second;   // zig-zag theo r
    });

    // ---- ĐỔI TẠI ĐÂY: trạng thái + add/rem ----
    vector<int> cnt(c.size(), 0);
    int distinct = 0;
    auto add = [&](int i) { if (cnt[v[i]]++ == 0) distinct++; };
    auto rem = [&](int i) { if (--cnt[v[i]] == 0) distinct--; };

    vector<int> ans(q);
    int curL = 0, curR = -1;                             // đoạn hiện tại [curL, curR], ban đầu rỗng
    for (int id : order) {
        int l = qs[id].first, r = qs[id].second;
        while (curL > l) add(--curL);                    // MỞ RỘNG trước, THU HẸP sau:
        while (curR < r) add(++curR);                    // bộ đếm không bao giờ âm
        while (curL < l) rem(curL++);
        while (curR > r) rem(curR--);
        ans[id] = distinct;                              // ---- ĐỔI TẠI ĐÂY: đọc đáp án ----
    }
    return ans;
}
`
      },
      example: {
        input: "a = [1, 2, 1, 3, 2]; truy vấn (l, r) = (0, 2), (1, 4), (2, 2)",
        output: "2 3 1",
        explain: "a[0..2] = {1, 2, 1} có 2 giá trị phân biệt; a[1..4] = {2, 1, 3, 2} có 3; a[2..2] = {1} có 1. Mo sắp xếp ba truy vấn theo khối rồi dời hai đầu đoạn hiện tại thay vì đếm lại từ đầu."
      },
      problems: [
        { site: "cses", id: "1734", name: "Distinct Values Queries" },
        { site: "cf", id: "86D", name: "Powerful array" },
        { site: "spoj", name: "DQUERY - D-query" }
      ],
      related: ["sqrt-decomposition", "fenwick-tree", "segment-tree", "coordinate-compression", "sparse-table", "array-prefix-sum"],
      compare: {
        "Dùng khi": "Truy vấn đoạn offline mà thêm/bớt một phần tử ở biên rẻ",
        "Điều kiện": "Offline; thêm/bớt O(1); không có cập nhật mảng",
        "Cần dữ liệu đã sắp xếp": "Không (sắp xếp truy vấn, không phải dữ liệu)"
      },
      cards: [
        { q: "Mo có độ phức tạp bao nhiêu?", a: "O((N + Q)·√N) (hay O(N·√Q) với B = N/√Q), nếu thêm/bớt một phần tử là O(1)." },
        { q: "Truy vấn được sắp xếp theo tiêu chí nào?", a: "Theo khối của l (kích thước B ~ N/√Q), rồi theo r (tăng ở khối chẵn, giảm ở khối lẻ — zig-zag)." },
        { q: "Vì sao phải mở rộng đoạn trước khi thu hẹp?", a: "Để bộ đếm không âm và đoạn không bị l > r giữa chừng; thứ tự ngược lại gây sai im lặng." },
        { q: "Điều kiện để dùng Mo?", a: "Truy vấn offline, không cập nhật mảng, thêm/bớt một phần tử ở biên đoạn rẻ và đáp án đọc được từ trạng thái." }
      ]
    },

    {
      id: "coordinate-compression",
      name: "Nén toạ độ",
      aliases: ["coordinate compression", "nén toạ độ", "rời rạc hoá", "discretization", "rank compression", "nén giá trị"],
      category: "tech",
      sub: "Truy vấn offline",
      level: 1,
      tags: ["coordinate-compression", "discretization", "offline", "sorting", "rank"],
      summary: "Thay các giá trị rất lớn hoặc rời rạc bằng thứ hạng 0..k−1 giữ nguyên thứ tự, để dùng được mảng, Fenwick tree, segment tree hay bảng đếm theo chỉ số.",
      description:
        "Nhiều bài chỉ quan tâm **thứ tự tương đối** của các giá trị, không phải bản thân giá trị: toạ độ tới 10⁹ nhưng chỉ có 2·10⁵ điểm. Sắp xếp các giá trị, bỏ trùng (`sort` + `unique`), rồi thay mỗi giá trị bằng vị trí của nó trong danh sách đó (`lower_bound`). Kết quả là các số trong `[0, k)` với k ≤ N giữ nguyên quan hệ <, =, > nên mọi đáp án chỉ phụ thuộc thứ tự đều không đổi.\n\n" +
        "Với **khoảng** thì nén cả hai đầu mút; nếu đáp án phụ thuộc độ dài thật (diện tích, độ dài phủ) thì ô thứ i đại diện đoạn `[vals[i], vals[i+1])` có độ dài `vals[i+1] − vals[i]`. Với đoạn đóng nguyên `[l, r]` thường nén cả `l` và `r + 1`.\n\n" +
        "Truy vấn một giá trị chưa có trong tập: `id(x)` (chính là `lower_bound`) cho số giá trị phân biệt **nhỏ hơn x**; `upTo(x)` cho số giá trị phân biệt **≤ x** — đủ để làm tiền tố trên Fenwick tree mà x không cần nằm trong tập.",
      conditions: [
        "Chỉ cần quan hệ thứ tự / bằng nhau giữa các giá trị (không dùng hiệu hay tổng giá trị thật ở bước sau, hoặc có xử lý riêng)",
        "Biết trước mọi giá trị cần nén (offline); chưa biết trước thì dùng map / ordered-set"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Xây dựng O(N log N); tra mỗi giá trị O(log N) bằng nhị phân hoặc O(1) nếu dùng bảng băm." },
      ops: [["Xây dựng (sort + unique)", "O(N log N)"], ["Tra chỉ số một giá trị", "O(log N)"], ["Tra ngược chỉ số → giá trị", "O(1)"]],
      use_case: [
        "Fenwick tree / segment tree trên giá trị lớn (đếm nghịch thế, truy vấn offline theo giá trị)",
        "Sweep line: nén toạ độ y của hình chữ nhật, đoạn thẳng",
        "Đếm tần suất bằng mảng thay vì map; đánh số lại các đỉnh / trạng thái có nhãn lớn",
        "Xếp hạng (rank) các phần tử của mảng"
      ],
      not_for: [
        "Bước sau dùng giá trị thật (tổng, hiệu, khoảng cách) → nén làm sai, trừ khi lưu vals[] để khôi phục",
        "Dữ liệu đến online → map, cấu trúc cân bằng hoặc segment tree động"
      ],
      pitfalls: [
        "Nhớ `erase(unique(...), end())`; thiếu bước erase làm kích thước sai.",
        "`id(x)` với x không có trong tập trả về vị trí chèn chứ không báo lỗi — dùng `has(x)` khi cần kiểm tra tồn tại.",
        "Nén khoảng nhưng quên khoảng trống giữa hai toạ độ liên tiếp khi tính độ dài / diện tích: ô i phải nhân độ dài vals[i+1] − vals[i].",
        "Cần so sánh giữa nhiều mảng thì nén chung MỘT lần (gộp mọi giá trị), không nén riêng từng mảng.",
        "Fenwick tree dùng chỉ số bắt đầu từ 1: dùng `id + 1`.",
        "Nén hai chiều: nén từng trục độc lập."
      ],
      code: {
        lang: "cpp", title: "coordinate-compression.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Nén toạ độ: ánh xạ giá trị bất kỳ (lớn, âm, chuỗi...) về 0..k-1 mà GIỮ NGUYÊN thứ tự.
// vals = các giá trị phân biệt đã sắp xếp (k = vals.size()). Dùng: Compressor<long long> cp(a); int i = cp.id(x);
template <class T>
struct Compressor {
    vector<T> vals;
    explicit Compressor(vector<T> v) : vals(move(v)) {
        sort(vals.begin(), vals.end());
        vals.erase(unique(vals.begin(), vals.end()), vals.end());
    }
    int size() const { return (int)vals.size(); }
    // Vị trí của x trong vals. Với x KHÔNG có trong tập: số giá trị phân biệt nhỏ hơn x (vị trí chèn).
    int id(const T& x) const { return (int)(lower_bound(vals.begin(), vals.end(), x) - vals.begin()); }
    bool has(const T& x) const { int i = id(x); return i < size() && vals[i] == x; }
    int upTo(const T& x) const { return (int)(upper_bound(vals.begin(), vals.end(), x) - vals.begin()); }  // số giá trị phân biệt <= x
    const T& value(int i) const { return vals[i]; }                                                      // giá trị gốc của chỉ số i
    vector<int> compress(const vector<T>& a) const {                                                     // thay cả mảng bằng chỉ số
        vector<int> r(a.size());
        for (size_t i = 0; i < a.size(); i++) r[i] = id(a[i]);
        return r;
    }
};
`
      },
      example: {
        input: "a = [100, 5, 5000, 5, 100]",
        output: "compress(a) = [1, 0, 2, 0, 1], k = 3",
        explain: "Giá trị phân biệt sắp xếp: [5, 100, 5000] nên 5 → 0, 100 → 1, 5000 → 2. Thứ tự và quan hệ bằng nhau giữ nguyên, nhưng giá trị chỉ còn từ 0 đến 2 nên dùng được Fenwick tree cỡ 3 thay vì cỡ 5000."
      },
      problems: [
        { site: "cses", id: "1144", name: "Salary Queries" },
        { site: "cses", id: "1734", name: "Distinct Values Queries" },
        { site: "cses", id: "1741", name: "Area of Rectangles" },
        { site: "lc", name: "Rank Transform of an Array" },
        { site: "lc", name: "Count of Smaller Numbers After Self" }
      ],
      related: ["fenwick-tree", "sweep-line", "count-inversions", "sorting", "segment-tree", "mo-algorithm"],
      compare: {
        "Dùng khi": "Giá trị lớn hoặc rời rạc nhưng chỉ cần thứ tự tương đối",
        "Điều kiện": "Biết trước mọi giá trị (offline); chỉ cần thứ tự",
        "Cần dữ liệu đã sắp xếp": "Sắp xếp các giá trị phân biệt (bước xây dựng)"
      },
      cards: [
        { q: "Nén toạ độ làm gì và cần giữ điều gì?", a: "Thay giá trị bằng thứ hạng 0..k−1 và giữ nguyên quan hệ thứ tự (<, =, >) giữa các giá trị." },
        { q: "Cách cài đặt chuẩn?", a: "sort + unique + erase để có vals; chỉ số của x là lower_bound(vals, x) − vals.begin()." },
        { q: "Khi nén các đoạn [l, r) cần chú ý gì?", a: "Nén cả hai đầu mút; nếu cần độ dài/diện tích thật, ô i đại diện [vals[i], vals[i+1]) có độ dài vals[i+1] − vals[i]." },
        { q: "id(x) với x không có trong tập trả về gì?", a: "Số giá trị phân biệt nhỏ hơn x (vị trí chèn); dùng has(x) để kiểm tra tồn tại." }
      ]
    },

    {
      id: "greedy-interval-scheduling",
      name: "Tham lam — lập lịch khoảng",
      aliases: ["interval scheduling", "activity selection", "lập lịch khoảng", "chọn hoạt động", "greedy intervals", "movie festival", "số phòng tối thiểu", "meeting rooms"],
      category: "tech",
      sub: "Tham lam & bit",
      level: 2,
      tags: ["greedy", "intervals", "scheduling", "sorting", "activity-selection"],
      summary: "Chọn nhiều đoạn đôi một không giao nhau nhất: sắp xếp theo thời điểm kết thúc rồi luôn lấy đoạn có kết thúc sớm nhất còn tương thích với các đoạn đã chọn.",
      description:
        "Cho N đoạn `[l, r)`; chọn tập lớn nhất sao cho không hai đoạn nào giao nhau (đầu mút chạm nhau thì được). **Thuật toán**: sắp theo `r` tăng dần; duyệt, lấy đoạn nếu `l ≥ lastEnd` rồi đặt `lastEnd = r`.\n\n" +
        "**Vì sao đúng (trao đổi)**: gọi g là đoạn kết thúc sớm nhất. Lấy một nghiệm tối ưu bất kỳ, thay đoạn đầu tiên của nó (đoạn kết thúc sớm nhất trong nghiệm) bằng g: g kết thúc không muộn hơn nên vẫn tương thích với phần còn lại, số đoạn không đổi. Vậy có nghiệm tối ưu chứa g; bỏ g cùng mọi đoạn giao với g rồi lặp lại cho bài toán con. Sắp theo thời điểm **bắt đầu** hoặc theo **độ dài** là SAI (đoạn dài [0, 10) chặn hai đoạn ngắn [1, 2) và [3, 4)).\n\n" +
        "Biến thể cùng ý tưởng: **số phòng / máy tối thiểu** để xếp mọi đoạn bằng số đoạn chồng nhau nhiều nhất tại một thời điểm (hàm `minRooms`: sắp riêng điểm bắt đầu và điểm kết thúc rồi quét); **số điểm tối thiểu cắt mọi đoạn đóng** bằng số đoạn đôi một rời nhau tối đa; k máy cùng lúc dùng multiset các thời điểm kết thúc (CSES Movie Festival II).",
      conditions: [
        "Mỗi đoạn có l < r và mục tiêu là SỐ LƯỢNG đoạn (không có trọng số)",
        "Quy ước đầu mút [l, r): chạm nhau (r của đoạn trước = l của đoạn sau) vẫn hợp lệ. Nếu đề coi chạm là giao, đổi `>=` thành `>`"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Sau khi đã sắp xếp theo thời điểm kết thúc, quét chỉ tốn O(N)." },
      ops: [["Chọn nhiều đoạn không giao nhất", "O(N log N)"], ["Số phòng tối thiểu (minRooms)", "O(N log N)"]],
      use_case: [
        "Xem được nhiều phim / sự kiện nhất khi không thể xem trùng giờ",
        "Xếp nhiều cuộc họp nhất vào một phòng",
        "Số mũi tên / điểm tối thiểu cắt mọi đoạn (đoạn đóng)",
        "Số phòng / máy tối thiểu để xếp mọi đoạn (qua quét sự kiện)"
      ],
      not_for: [
        "Mỗi đoạn có trọng số / lợi nhuận → quy hoạch động (sắp theo r + nhị phân tìm đoạn kết thúc trước đó)",
        "Có k thực thể xử lý song song → tham lam với multiset các thời điểm kết thúc",
        "Được chọn một phần của đoạn (cắt ngắn) → bài toán khác"
      ],
      pitfalls: [
        "Sắp theo thời điểm bắt đầu hoặc theo độ dài là SAI (phản ví dụ: [0, 10), [1, 2), [3, 4)).",
        "Sai quy ước đầu mút (`>=` hay `>`): đọc kỹ đề có cho chạm nhau không.",
        "Hai đoạn cùng kết thúc: thứ tự phụ không đổi đáp án nhưng nên cố định (theo l tăng) để kết quả tái lập được.",
        "Đoạn có l ≥ r hoặc độ dài 0 làm điều kiện sai; chuẩn hoá đầu vào.",
        "Số phòng tối thiểu: khi một đoạn kết thúc đúng lúc đoạn khác bắt đầu, phải giải phóng phòng trước khi nhận (điều kiện `end <= start`)."
      ],
      code: {
        lang: "cpp", title: "greedy-interval-scheduling.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Đoạn nửa mở [l, r), mỗi đoạn có l < r. Chạm đầu mút (r của đoạn này = l của đoạn kia) KHÔNG tính là giao.

// Chọn nhiều đoạn đôi một không giao nhất. Trả về số đoạn; nếu truyền chosen thì điền chỉ số các đoạn đã chọn (theo thứ tự thời gian).
int maxNonOverlapping(const vector<pair<long long, long long>>& iv, vector<int>* chosen = nullptr) {
    int n = iv.size();
    vector<int> ord(n);
    iota(ord.begin(), ord.end(), 0);
    sort(ord.begin(), ord.end(), [&](int x, int y) {               // theo thời điểm KẾT THÚC tăng dần
        return iv[x].second != iv[y].second ? iv[x].second < iv[y].second : iv[x].first < iv[y].first;
    });
    if (chosen) chosen->clear();
    long long lastEnd = LLONG_MIN;
    int cnt = 0;
    for (int i : ord) {
        if (iv[i].first >= lastEnd) {                               // tương thích với đoạn đã chọn cuối cùng
            cnt++;
            lastEnd = iv[i].second;
            if (chosen) chosen->push_back(i);
        }
    }
    return cnt;
}

// Số phòng (máy) tối thiểu để xếp mọi đoạn = số đoạn chồng nhau nhiều nhất tại một thời điểm.
int minRooms(const vector<pair<long long, long long>>& iv) {
    vector<long long> st, en;
    for (auto& p : iv) { st.push_back(p.first); en.push_back(p.second); }
    sort(st.begin(), st.end());
    sort(en.begin(), en.end());
    int j = 0, cur = 0, best = 0;
    for (long long s : st) {
        while (en[j] <= s) { j++; cur--; }                          // đoạn đã kết thúc: giải phóng phòng trước
        cur++;
        best = max(best, cur);
    }
    return best;
}
`
      },
      example: {
        input: "Các đoạn [l, r): (1,4) (3,5) (0,6) (5,7) (3,9) (5,9) (6,10) (8,11) (8,12) (2,14) (12,16)",
        output: "4 — chọn (1,4), (5,7), (8,11), (12,16)",
        explain: "Sắp theo r: (1,4) (3,5) (0,6) (5,7) (3,9) … Lấy (1,4) (lastEnd = 4); bỏ (3,5) và (0,6) vì bắt đầu trước 4; lấy (5,7); bỏ các đoạn bắt đầu trước 7; lấy (8,11); bỏ các đoạn bắt đầu trước 11; lấy (12,16). Không thể chọn 5 đoạn."
      },
      problems: [
        { site: "cses", id: "1629", name: "Movie Festival" },
        { site: "cses", id: "1632", name: "Movie Festival II" },
        { site: "cses", id: "1164", name: "Room Allocation" },
        { site: "cses", id: "1619", name: "Restaurant Customers" },
        { site: "lc", name: "Non-overlapping Intervals" }
      ],
      related: ["sorting", "sweep-line", "heap", "difference-array", "binary-search"],
      compare: {
        "Dùng khi": "Chọn nhiều đoạn không giao nhất; số phòng tối thiểu",
        "Điều kiện": "Không trọng số; quy ước đầu mút rõ ràng",
        "Cần dữ liệu đã sắp xếp": "Có — sắp theo thời điểm kết thúc"
      },
      cards: [
        { q: "Tiêu chí tham lam đúng cho lập lịch khoảng?", a: "Sắp theo thời điểm kết thúc tăng dần; lấy đoạn có kết thúc sớm nhất còn tương thích." },
        { q: "Vì sao sắp theo thời điểm bắt đầu hoặc độ dài là sai?", a: "Đoạn dài [0,10) bắt đầu sớm nhưng chặn hai đoạn ngắn [1,2), [3,4); đoạn có độ dài nhỏ vẫn có thể chặn hai đoạn tốt." },
        { q: "Tóm tắt chứng minh tham lam?", a: "Thay đoạn đầu của một nghiệm tối ưu bằng đoạn kết thúc sớm nhất: vẫn tương thích với phần còn lại nên số đoạn không giảm; lặp lại cho bài toán con." },
        { q: "Số phòng tối thiểu để xếp mọi đoạn là bao nhiêu?", a: "Số đoạn chồng nhau nhiều nhất tại một thời điểm — quét sự kiện, giải phóng đoạn kết thúc trước khi nhận đoạn bắt đầu cùng lúc." }
      ]
    },

    {
      id: "bit-manipulation",
      name: "Thao tác bit",
      aliases: ["bit manipulation", "thao tác bit", "bitwise", "bitmask", "lowbit", "popcount", "xor trick", "gosper", "duyệt tập con", "submask"],
      category: "tech",
      sub: "Tham lam & bit",
      level: 2,
      tags: ["bit-manipulation", "bitmask", "xor", "subsets", "bitwise"],
      summary: "Các phép toán và mẹo trên biểu diễn nhị phân (lowbit, đếm bit, duyệt tập con, mã Gray, XOR) giúp biểu diễn tập hợp gọn và xử lý trong O(1) trên cả từ máy.",
      description:
        "Số nguyên n-bit có thể biểu diễn **một tập con của {0, …, n−1}** (bit i bằng 1 ⇔ i thuộc tập). Khi đó hợp = `|`, giao = `&`, hiệu = `a & ~b`, bù = `~a & full`, kiểm tra thuộc tập = `(m >> i) & 1`. Các phép này xử lý cả 64 phần tử cùng lúc.\n\n" +
        "Mẹo thiết yếu: `x & (x − 1)` tắt bit 1 thấp nhất; `x & −x` lấy bit đó (`lowbit`, nền của Fenwick tree); `__builtin_popcountll` đếm bit 1; `__builtin_ctzll` và `63 − __builtin_clzll` cho chỉ số bit thấp nhất / cao nhất; `x ^ (x >> 1)` là mã Gray; `a ^ a = 0` nên XOR cả mảng triệt tiêu các số xuất hiện chẵn lần.\n\n" +
        "Duyệt **mọi tập con của một mask**: `for (s = mask; s > 0; s = (s − 1) & mask)` — tổng cộng 3ⁿ khi lặp trên mọi mask (nền của bitmask DP và SOS DP). Duyệt **mọi mask có đúng k bit 1** theo thứ tự tăng dần bằng hack của Gosper. Mẫu gom các hàm nhỏ này vào một đoạn dán là chạy.",
      conditions: [
        "Dữ liệu biểu diễn được bằng ≤ 64 bit (nhiều hơn dùng bitset<N>)",
        "Dùng kiểu không dấu (unsigned / unsigned long long) và `1ULL << i` để tránh tràn và hành vi không xác định khi dịch bit"
      ],
      complexity: { time: "O(1)", space: "O(1)", note: "Mỗi phép bit trên một từ máy là O(1). Duyệt tập con của mask: O(2^popcount(mask)); mọi mask cùng tập con của nó: O(3^n); Gosper: O(C(n, k))." },
      ops: [["Kiểm tra / bật / tắt / đảo một bit", "O(1)"], ["lowbit, đếm bit 1, chỉ số bit cao nhất", "O(1)"], ["Duyệt mọi tập con của mask", "O(2^k)"], ["Duyệt mọi mask đúng k bit (Gosper)", "O(C(n, k))"]],
      use_case: [
        "Biểu diễn tập hợp nhỏ (n ≤ 20–25 cho bitmask DP, n ≤ 64 với unsigned long long)",
        "Duyệt tập con / tổ hợp: 2ⁿ, 3ⁿ, C(n, k)",
        "Tìm số xuất hiện lẻ lần bằng XOR; hoán đổi hai biến không cần biến phụ",
        "Kiểm tra luỹ thừa của 2, đếm bit, tách bit thấp nhất (Fenwick tree), mã Gray"
      ],
      not_for: [
        "Tập có hơn 64 phần tử → bitset<N> hoặc vector<bool>",
        "Cần xử lý số lớn hoặc số thực → không dùng toán tử bit",
        "Tập có giá trị/thứ tự phức tạp, cần cấu trúc khác → set, map, cấu trúc dữ liệu thích hợp"
      ],
      pitfalls: [
        "`1 << i` là int: i ≥ 31 gây tràn/hành vi không xác định; dùng `1LL << i` hoặc `1ULL << i`.",
        "Độ ưu tiên: `x & 1 == 0` hiểu thành `x & (1 == 0)`; luôn đặt ngoặc `(x & 1) == 0`.",
        "`__builtin_clz(0)` / `__builtin_ctz(0)` không xác định: kiểm tra x ≠ 0 trước. `__builtin_popcount` (không có ll) chỉ nhìn 32 bit thấp.",
        "Dịch phải số âm do trình biên dịch quy định (thường là dịch số học); dùng kiểu không dấu cho phép toán bit.",
        "XOR swap hỏng khi hai tham chiếu là cùng một ô nhớ (a ^= a → 0): kiểm tra địa chỉ.",
        "Vòng duyệt tập con với điều kiện `s > 0` bỏ sót tập rỗng; muốn gồm tập rỗng dùng vòng ‘xử lý s rồi if (s == 0) break’."
      ],
      code: {
        lang: "cpp", title: "bit-manipulation.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;
typedef unsigned long long ull;

// Các thủ thuật bit hay dùng. Bit 0 là bit thấp nhất. Dùng 1ULL << i (1 << i tràn khi i >= 31).
inline bool bitTest(ull x, int i) { return (x >> i) & 1; }
inline ull bitSet(ull x, int i) { return x | (1ULL << i); }
inline ull bitClear(ull x, int i) { return x & ~(1ULL << i); }
inline ull bitToggle(ull x, int i) { return x ^ (1ULL << i); }
inline ull lowbit(ull x) { return x & (~x + 1); }               // bit 1 thấp nhất (= x & -x); 0 nếu x = 0
inline ull clearLowbit(ull x) { return x & (x - 1); }           // tắt bit 1 thấp nhất
inline bool isPow2(ull x) { return x != 0 && (x & (x - 1)) == 0; }
inline int popCount(ull x) { return __builtin_popcountll(x); }  // số bit 1
inline int lowIndex(ull x) { return __builtin_ctzll(x); }       // chỉ số bit 1 thấp nhất; x != 0
inline int highIndex(ull x) { return 63 - __builtin_clzll(x); } // chỉ số bit 1 cao nhất; x != 0
inline ull grayCode(ull i) { return i ^ (i >> 1); }             // hai số liên tiếp có mã Gray khác nhau đúng 1 bit
inline void xorSwap(int& a, int& b) {                           // đổi chỗ không cần biến phụ
    if (&a != &b) { a ^= b; b ^= a; a ^= b; }                   // phải kiểm &a != &b, nếu không a ^= a = 0
}

// Duyệt mọi tập con KHÁC RỖNG của mask, từ lớn xuống nhỏ: 2^popcount(mask) - 1 phần tử.
// Lặp trên mọi mask rồi mọi tập con của nó: tổng 3^n.
template <class F>
void forEachSubmask(unsigned mask, F f) {
    for (unsigned s = mask; s > 0; s = (s - 1) & mask) f(s);
}

// Duyệt mọi mask có đúng k bit 1 trong n bit, theo thứ tự tăng dần (hack Gosper). 0 <= k <= n <= 31.
template <class F>
void forEachKSubset(int n, int k, F f) {
    if (k == 0) { f(0u); return; }
    unsigned limit = 1u << n;
    for (unsigned c = (1u << k) - 1; c < limit; ) {
        f(c);
        unsigned lo = c & (~c + 1), r = c + lo;
        c = (((r ^ c) >> 2) / lo) | r;                          // mask kế tiếp có cùng số bit 1
    }
}
`
      },
      example: {
        input: "x = 12 (1100₂); mask = 5 (101₂)",
        output: "lowbit(12) = 4, popCount(12) = 2, highIndex(12) = 3; tập con khác rỗng của 5: 5, 4, 1",
        explain: "12 = 1100₂: bit 1 thấp nhất có giá trị 4 (chỉ số 2), có 2 bit 1, bit cao nhất ở chỉ số 3. Tập con của mask 101₂ duyệt bằng s = (s − 1) & mask: 101 → 100 → 001 → 000 (dừng), tức 5, 4, 1."
      },
      problems: [
        { site: "cses", id: "1617", name: "Bit Strings" },
        { site: "cses", id: "2205", name: "Gray Code" },
        { site: "cses", id: "1146", name: "Counting Bits" },
        { site: "cses", id: "1623", name: "Apple Division" },
        { site: "cses", id: "1655", name: "Maximum Xor Subarray" },
        { site: "lc", name: "Single Number" }
      ],
      related: ["bitmask-dp", "sos-dp", "xor-trie", "fenwick-tree", "backtracking", "meet-in-the-middle"],
      compare: {
        "Dùng khi": "Biểu diễn tập nhỏ; duyệt tập con; mẹo O(1) trên bit",
        "Điều kiện": "≤ 64 phần tử trên một từ máy; dùng kiểu không dấu",
        "Cần dữ liệu đã sắp xếp": "Không"
      },
      cards: [
        { q: "x & (x − 1) và x & −x làm gì?", a: "x & (x − 1) tắt bit 1 thấp nhất; x & −x (lowbit) lấy ra bit 1 thấp nhất." },
        { q: "Cách duyệt mọi tập con của mask?", a: "for (s = mask; s > 0; s = (s − 1) & mask) — 2^popcount(mask) − 1 tập con khác rỗng; xử lý tập rỗng riêng." },
        { q: "Vì sao `1 << i` nguy hiểm với i ≥ 31?", a: "Kết quả kiểu int bị tràn (hành vi không xác định); dùng 1LL << i hoặc 1ULL << i." },
        { q: "Tìm số duy nhất xuất hiện lẻ lần trong mảng bằng cách nào?", a: "XOR tất cả phần tử: a ^ a = 0 nên các cặp triệt tiêu, còn lại số duy nhất; O(N) thời gian, O(1) bộ nhớ." }
      ]
    },

    // ============================================================================================ GEO
    {
      id: "convex-hull",
      name: "Bao lồi (Convex Hull)",
      aliases: ["convex hull", "bao lồi", "andrew monotone chain", "graham scan", "monotone chain", "đa giác lồi nhỏ nhất", "hàng rào ngắn nhất"],
      category: "geo",
      sub: "Bao & đa giác",
      level: 3,
      tags: ["convex-hull", "geometry", "cross-product", "monotone-chain", "sorting"],
      summary: "Bao lồi của tập điểm là đa giác lồi nhỏ nhất chứa mọi điểm; Andrew monotone chain dựng nó trong O(N log N) chỉ bằng tích có hướng với số nguyên.",
      description:
        "**Andrew monotone chain**: sắp điểm theo (x, y), dựng *chuỗi dưới* từ trái sang phải bằng một ngăn xếp: trước khi thêm điểm mới, nếu ba điểm cuối không tạo ‘rẽ trái’ chặt (`cross ≤ 0`) thì bỏ điểm giữa. Sau đó dựng *chuỗi trên* theo chiều ngược lại. Ghép hai chuỗi (bỏ điểm trùng ở hai đầu) ta được đa giác ngược chiều kim đồng hồ.\n\n" +
        "Dùng `cross ≤ 0` thì bỏ cả điểm **thẳng hàng** nằm trên cạnh (chỉ giữ đỉnh thật); đổi thành `< 0` nếu bài muốn giữ cả điểm trên biên. Điểm trùng được loại bằng `unique` trước; trường hợp suy biến (một điểm, mọi điểm thẳng hàng) trả về 1 hoặc 2 điểm.\n\n" +
        "Toàn bộ dùng `long long` và tích có hướng nguyên nên **chính xác tuyệt đối** khi |toạ độ| ≤ 10⁹ (hiệu ≤ 2·10⁹, mỗi tích ≤ 4·10¹⁸, hiệu hai tích ≤ 8·10¹⁸ < 9,22·10¹⁸). Không cần double hay epsilon ở bước này. Hàm đi kèm tính gấp đôi diện tích (số nguyên) của bao bằng các tam giác quạt từ một đỉnh.",
      conditions: [
        "Toạ độ nguyên với |x|, |y| ≤ 10⁹ để tích có hướng vừa long long (lớn hơn: dùng __int128)",
        "Có ít nhất một điểm; các trường hợp suy biến đã được xử lý"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Sau khi sắp xếp, dựng bao là O(N): mỗi điểm vào và ra ngăn xếp tối đa một lần." },
      ops: [["Dựng bao lồi", "O(N log N)"], ["Gấp đôi diện tích của bao", "O(H)"]],
      use_case: [
        "Hàng rào / chu vi ngắn nhất bao quanh mọi điểm",
        "Đường kính tập điểm (cặp xa nhất) bằng rotating calipers trên bao lồi",
        "Bài tối ưu tuyến tính: cực trị của hàm tuyến tính luôn đạt tại một đỉnh của bao lồi",
        "Nền cho nhiều bài hình học: kiểm tra điểm thuộc bao, hai tập điểm tách được bởi đường thẳng không"
      ],
      not_for: [
        "Chỉ cần xác định điểm trong một đa giác đã cho → point-in-polygon",
        "Điểm thêm/bớt động → bao lồi động (cấu trúc phức tạp hơn)",
        "Toạ độ thực: dùng double hoặc long double có epsilon và cẩn thận với các điểm gần thẳng hàng"
      ],
      pitfalls: [
        "`cross <= 0` bỏ điểm thẳng hàng, `< 0` giữ: chọn đúng theo đề (chu vi không đổi nhưng số đỉnh đổi).",
        "Quên loại điểm trùng làm bao có cạnh độ dài 0 và cross = 0 gây lỗi.",
        "Tích có hướng tràn khi toạ độ vượt 10⁹: dùng __int128 hoặc đổi sang long double có epsilon.",
        "Mọi điểm thẳng hàng hoặc chỉ có 1–2 điểm: kiểm tra riêng (mẫu trả về 1–2 điểm).",
        "Chuỗi trên cần ngưỡng `t = k + 1` để không xoá chuỗi dưới đã dựng.",
        "Chiều quay: mẫu trả về NGƯỢC chiều kim đồng hồ; đề yêu cầu cùng chiều thì đảo mảng.",
        "Diện tích bằng công thức dây giày với toạ độ lớn có thể tràn số ở bước trung gian; tính theo tam giác quạt từ một đỉnh như mẫu."
      ],
      code: {
        lang: "cpp", title: "convex-hull.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Bao lồi Andrew monotone chain. Toạ độ nguyên |x|, |y| <= 1e9 (tích có hướng tối đa ~8e18 vừa long long).
struct HullPt {
    long long x, y;
    bool operator<(const HullPt& o) const { return x != o.x ? x < o.x : y < o.y; }
    bool operator==(const HullPt& o) const { return x == o.x && y == o.y; }
};

// cross(o→a, o→b): > 0 rẽ trái (ngược chiều kim đồng hồ), = 0 thẳng hàng, < 0 rẽ phải.
long long hullCross(const HullPt& o, const HullPt& a, const HullPt& b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Các đỉnh bao lồi theo thứ tự NGƯỢC chiều kim đồng hồ, bắt đầu từ điểm nhỏ nhất theo (x, y).
// Điểm trùng bị gộp; điểm thẳng hàng nằm trên cạnh bị BỎ (đổi <= 0 thành < 0 để giữ).
// Suy biến: rỗng -> rỗng; mọi điểm trùng -> 1 điểm; mọi điểm thẳng hàng -> 2 đầu mút.
vector<HullPt> convexHull(vector<HullPt> p) {
    sort(p.begin(), p.end());
    p.erase(unique(p.begin(), p.end()), p.end());
    int n = p.size();
    if (n < 3) return p;
    vector<HullPt> h(2 * n);
    int k = 0;
    for (int i = 0; i < n; i++) {                                   // chuỗi dưới: trái -> phải
        while (k >= 2 && hullCross(h[k - 2], h[k - 1], p[i]) <= 0) k--;
        h[k++] = p[i];
    }
    for (int i = n - 2, t = k + 1; i >= 0; i--) {                   // chuỗi trên: phải -> trái
        while (k >= t && hullCross(h[k - 2], h[k - 1], p[i]) <= 0) k--;
        h[k++] = p[i];
    }
    h.resize(k - 1);                                                // điểm cuối trùng điểm đầu
    return h;
}

// Gấp đôi diện tích đa giác LỒI h (số nguyên; chia 2 khi in). Tam giác quạt từ h[0] nên không tràn ở bước trung gian.
long long polygonArea2(const vector<HullPt>& h) {
    long long s = 0;
    for (size_t i = 1; i + 1 < h.size(); i++) s += hullCross(h[0], h[i], h[i + 1]);
    return s;
}
`
      },
      example: {
        input: "Điểm: (0,0) (2,0) (1,1) (2,2) (0,2) (1,0)",
        output: "(0,0) (2,0) (2,2) (0,2); gấp đôi diện tích = 8",
        explain: "(1,1) nằm trong hình vuông nên bị loại; (1,0) nằm trên cạnh dưới (thẳng hàng với (0,0) và (2,0)) nên bị bỏ vì dùng cross ≤ 0. Bao là hình vuông cạnh 2 theo chiều ngược kim đồng hồ bắt đầu từ (0,0), diện tích 4 nên gấp đôi là 8."
      },
      problems: [
        { site: "cses", id: "2195", name: "Convex Hull" },
        { site: "cses", id: "2191", name: "Polygon Area" },
        { site: "cses", id: "2193", name: "Polygon Lattice Points" },
        { site: "lc", name: "Erect the Fence" }
      ],
      related: ["sweep-line", "point-in-polygon", "closest-pair", "segment-intersection", "convex-hull-trick", "sorting"],
      compare: {
        "Bài toán giải": "Bao lồi: đa giác lồi nhỏ nhất chứa mọi điểm",
        "Độ chính xác": "Chính xác tuyệt đối (số nguyên long long)",
        "Ràng buộc": "|toạ độ| ≤ 10⁹; N cỡ 10⁵–10⁶"
      },
      cards: [
        { q: "Độ phức tạp của Andrew monotone chain?", a: "O(N log N) cho bước sắp xếp; dựng chuỗi dưới và trên là O(N)." },
        { q: "Điều kiện bỏ điểm giữa khi dựng chuỗi?", a: "cross(h[k−2], h[k−1], p) ≤ 0 (không rẽ trái chặt): bỏ cả điểm thẳng hàng; dùng < 0 để giữ điểm trên cạnh." },
        { q: "Tích có hướng cross(o, a, b) dương nghĩa là gì?", a: "Đi o → a → b rẽ trái (ngược chiều kim đồng hồ); bằng 0 là thẳng hàng; âm là rẽ phải." },
        { q: "Giới hạn toạ độ để dùng long long cho cross?", a: "|x|, |y| ≤ 10⁹: hiệu ≤ 2·10⁹, tích ≤ 4·10¹⁸, hiệu hai tích ≤ 8·10¹⁸ vẫn nhỏ hơn 9,22·10¹⁸." }
      ]
    },

    {
      id: "sweep-line",
      name: "Quét đường (Sweep Line)",
      aliases: ["sweep line", "quét đường", "scanline", "line sweep", "đường quét", "events", "đếm giao điểm đoạn ngang dọc", "union of rectangles"],
      category: "geo",
      sub: "Quét & cặp gần nhất",
      level: 4,
      tags: ["sweep-line", "geometry", "events", "fenwick-tree", "offline"],
      summary: "Quét một đường thẳng tưởng tượng qua mặt phẳng, xử lý các sự kiện theo thứ tự và duy trì cấu trúc dữ liệu cho các đối tượng đang cắt đường quét, biến bài toán 2D thành chuỗi thao tác 1D.",
      description:
        "Ý tưởng: chọn một trục (thường là x), biến mỗi đối tượng hình học thành **sự kiện** (đoạn ngang bắt đầu / kết thúc, đoạn dọc, điểm…), **sắp xếp sự kiện** theo toạ độ quét và duy trì một **trạng thái hoạt động** (tập đối tượng đang cắt đường quét) bằng Fenwick tree, segment tree hoặc set. Thứ tự các sự kiện cùng toạ độ quyết định đúng sai ở các trường hợp biên.\n\n" +
        "Mẫu trong thẻ này **đếm số giao điểm giữa đoạn ngang và đoạn dọc**. Quét theo x: gặp đầu trái đoạn ngang thì thêm y của nó vào Fenwick tree (y đã nén), gặp đầu phải thì xoá, gặp một đoạn dọc tại x thì hỏi tổng số y thuộc `[y1, y2]` của các đoạn ngang đang hoạt động. Cùng toạ độ x: *thêm trước, hỏi giữa, xoá sau* để chạm đầu mút cũng được tính.\n\n" +
        "Khuôn dùng lại cho nhiều bài: **diện tích hợp các hình chữ nhật** (segment tree giữ độ dài phủ), **độ phủ / chồng nhau lớn nhất** (cộng trừ tại điểm sự kiện), **cặp điểm gần nhất** (set theo y), **phát hiện cặp đoạn cắt nhau** (Shamos–Hoey), skyline và các bài đếm điểm trong hình chữ nhật theo kiểu offline.",
      conditions: [
        "Sắp xếp được mọi sự kiện theo một trục và duy trì được trạng thái hoạt động bằng cấu trúc hỗ trợ thêm / xoá / truy vấn O(log N)",
        "Quy ước đầu mút (đoạn đóng hay nửa mở) rõ ràng để chọn đúng thứ tự sự kiện cùng toạ độ"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "N sự kiện, mỗi sự kiện một thao tác O(log N). Liệt kê K giao điểm bất kỳ giữa N đoạn (Bentley–Ottmann): O((N + K) log N)." },
      ops: [["Sắp xếp sự kiện", "O(N log N)"], ["Mỗi sự kiện (thêm / xoá / hỏi)", "O(log N)"]],
      use_case: [
        "Đếm giao điểm giữa đoạn ngang và đoạn dọc",
        "Diện tích hợp các hình chữ nhật, độ dài hợp các đoạn",
        "Số đoạn / khoảng chồng nhau nhiều nhất tại một điểm",
        "Phát hiện cặp đoạn cắt nhau, skyline, đếm cặp 2D (điểm trong hình chữ nhật) theo kiểu offline"
      ],
      not_for: [
        "Chỉ có truy vấn 1D đơn giản → difference array / prefix sum",
        "Chỉ cần cặp điểm gần nhất → chia để trị (closest-pair) gọn hơn",
        "Truy vấn online trên dữ liệu động 2D → cây phân đoạn 2D, cây lồng nhau"
      ],
      pitfalls: [
        "Thứ tự sự kiện cùng toạ độ sai (xoá trước khi hỏi) làm mất giao điểm chạm đầu mút; hãy tự thử một ca nhỏ có chạm.",
        "Quên nén toạ độ khi dùng Fenwick tree / segment tree theo y.",
        "Số giao điểm có thể tới N²/4 (≈ 10¹⁰ khi N = 2·10⁵): dùng long long cho tổng.",
        "Đoạn suy biến (một điểm) là cả ngang lẫn dọc: quy ước rõ để không đếm hai lần.",
        "Mẫu chỉ đếm cặp ngang–dọc; các đoạn cùng hướng chồng nhau không được tính.",
        "Dùng double cho toạ độ sự kiện dễ làm sai thứ tự khi hai toạ độ rất gần nhau; giữ số nguyên khi có thể."
      ],
      code: {
        lang: "cpp", title: "sweep-line.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

struct HSeg { long long y, x1, x2; };    // đoạn ngang: y cố định, x trong [x1, x2] (x1 <= x2)
struct VSeg { long long x, y1, y2; };    // đoạn dọc:   x cố định, y trong [y1, y2] (y1 <= y2)

// Đếm số cặp (đoạn ngang, đoạn dọc) cắt nhau; chạm đầu mút cũng tính. Quét theo x, Fenwick tree theo y đã nén.
// Thời gian O((H + V) log (H + V)); kết quả có thể tới H * V nên dùng long long.
long long countHVIntersections(const vector<HSeg>& hs, const vector<VSeg>& vs) {
    vector<long long> ys;                                           // nén toạ độ y của các đoạn ngang
    for (auto& h : hs) ys.push_back(h.y);
    sort(ys.begin(), ys.end());
    ys.erase(unique(ys.begin(), ys.end()), ys.end());
    int m = ys.size();
    vector<int> bit(m + 1, 0);
    auto upd = [&](int i, int d) { for (i++; i <= m; i += i & -i) bit[i] += d; };
    auto pre = [&](int i) { int s = 0; for (; i > 0; i -= i & -i) s += bit[i]; return s; };   // số đoạn ngang hoạt động có chỉ số y < i

    // sự kiện {x, loại, chỉ số}: loại 0 = bắt đầu đoạn ngang, 1 = hỏi đoạn dọc, 2 = kết thúc đoạn ngang
    // cùng x thì thêm (0) trước, hỏi (1) giữa, xoá (2) sau => chạm đầu mút vẫn tính
    vector<array<long long, 3>> ev;
    for (int i = 0; i < (int)hs.size(); i++) {
        ev.push_back({hs[i].x1, 0, i});
        ev.push_back({hs[i].x2, 2, i});
    }
    for (int i = 0; i < (int)vs.size(); i++) ev.push_back({vs[i].x, 1, i});
    sort(ev.begin(), ev.end());

    long long total = 0;
    for (auto& e : ev) {
        if (e[1] == 1) {
            const VSeg& v = vs[e[2]];
            int lo = lower_bound(ys.begin(), ys.end(), v.y1) - ys.begin();   // chỉ số y đầu tiên >= y1
            int hi = upper_bound(ys.begin(), ys.end(), v.y2) - ys.begin();   // chỉ số y đầu tiên > y2
            total += pre(hi) - pre(lo);
        } else {
            int yi = lower_bound(ys.begin(), ys.end(), hs[e[2]].y) - ys.begin();
            upd(yi, e[1] == 0 ? 1 : -1);
        }
    }
    return total;
}
`
      },
      example: {
        input: "Ngang: y=1 x∈[0,4]; y=3 x∈[2,6]. Dọc: x=3 y∈[0,2]; x=5 y∈[2,4].",
        output: "2",
        explain: "Giao tại (3, 1) giữa đoạn ngang y=1 và đoạn dọc x=3, và tại (5, 3) giữa đoạn ngang y=3 và đoạn dọc x=5. Đoạn dọc x=3 không với tới y=3, đoạn dọc x=5 nằm ngoài [0,4] của đoạn ngang y=1. Khi quét: tại x=0 thêm y=1; x=2 thêm y=3; x=3 hỏi [0,2] → thấy y=1 (1 giao điểm); x=4 xoá y=1; x=5 hỏi [2,4] → thấy y=3 (1 giao điểm)."
      },
      problems: [
        { site: "cses", id: "1740", name: "Intersection Points" },
        { site: "cses", id: "1741", name: "Area of Rectangles" },
        { site: "cses", id: "1619", name: "Restaurant Customers" },
        { site: "cses", id: "1164", name: "Room Allocation" }
      ],
      related: ["coordinate-compression", "fenwick-tree", "segment-tree", "closest-pair", "segment-intersection", "greedy-interval-scheduling", "difference-array"],
      compare: {
        "Bài toán giải": "Đếm / duy trì tương tác giữa các đối tượng 2D bằng sự kiện đã sắp xếp",
        "Độ chính xác": "Chính xác (số nguyên)",
        "Ràng buộc": "Sắp xếp được theo một trục; N cỡ 10⁵–2·10⁵"
      },
      cards: [
        { q: "Ba thành phần của một thuật toán quét đường?", a: "Danh sách sự kiện đã sắp xếp theo toạ độ quét, trạng thái hoạt động (cấu trúc dữ liệu), và quy tắc xử lý từng loại sự kiện." },
        { q: "Cùng toạ độ x, thứ tự sự kiện khi đếm giao điểm đoạn ngang–dọc (tính cả chạm đầu mút)?", a: "Thêm đoạn ngang → hỏi đoạn dọc → xoá đoạn ngang." },
        { q: "Độ phức tạp đếm giao điểm đoạn ngang–dọc?", a: "O(N log N) với Fenwick tree theo y đã nén, N là tổng số đoạn." },
        { q: "Vì sao tổng phải dùng long long?", a: "Số giao điểm tới H·V (cỡ 10¹⁰ với 2·10⁵ đoạn mỗi loại), vượt int32." }
      ]
    },

    {
      id: "closest-pair",
      name: "Cặp điểm gần nhất",
      aliases: ["closest pair", "cặp điểm gần nhất", "closest pair of points", "minimum euclidean distance", "khoảng cách nhỏ nhất giữa hai điểm"],
      category: "geo",
      sub: "Quét & cặp gần nhất",
      level: 4,
      tags: ["closest-pair", "geometry", "divide-and-conquer", "euclidean-distance", "sorting"],
      summary: "Tìm hai điểm có khoảng cách nhỏ nhất trong N điểm bằng chia để trị O(N log N): giải hai nửa rồi chỉ xét dải hẹp quanh đường chia, mỗi điểm so với một số hằng điểm.",
      description:
        "Sắp điểm theo x rồi chia đôi tại đường thẳng `x = midx`. Giải đệ quy hai nửa và gọi `d` là khoảng cách nhỏ nhất tìm được. Cặp tốt hơn (nếu có) gồm một điểm mỗi bên và cả hai nằm trong **dải** `|x − midx| < d`. Trong dải, sắp theo y; mỗi điểm chỉ cần so với các điểm phía trước có hiệu y nhỏ hơn d — theo nguyên lý chuồng bồ câu có không quá một số hằng điểm như vậy (tối đa khoảng 6–8). Trộn theo y khi quay lên đệ quy nên tổng O(N log N).\n\n" +
        "Mẫu làm việc với **bình phương khoảng cách bằng số nguyên** (không căn, không sai số) và trả về `d²`; lấy căn khi in. Có một cách khác cùng O(N log N): quét theo x và giữ set các điểm theo y trong khoảng d quanh điểm hiện tại — xem thêm quét đường.",
      conditions: [
        "N ≥ 2; điểm có thể trùng (khi đó đáp án 0)",
        "Toạ độ nguyên |x|, |y| ≤ 10⁹ để d² ≤ 8·10¹⁸ vừa long long"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Vét cạn O(N²) chỉ ổn khi N ≲ 5·10³." },
      use_case: [
        "Cặp điểm gần nhất trong N điểm (N tới 2·10⁵–10⁶)",
        "Phát hiện hai điểm quá gần nhau (va chạm, trùng lặp, nhiễu)",
        "Khuôn chia để trị trên mặt phẳng: đếm hoặc tối ưu cặp điểm trong dải quanh đường chia"
      ],
      not_for: [
        "Cần k cặp gần nhất, hoặc điểm gần nhất cho từng điểm → kd-tree hoặc cấu trúc láng giềng chuyên dụng",
        "N nhỏ (≲ 5000) → vét cạn O(N²) đủ nhanh và ít lỗi hơn",
        "Toạ độ thực với yêu cầu độ chính xác cao → cân nhắc long double và kiểm tra so sánh d² thay vì căn"
      ],
      pitfalls: [
        "Tràn: d² tới 8·10¹⁸ nằm sát giới hạn long long; toạ độ lớn hơn 10⁹ cần __int128 hoặc đổi sang số thực.",
        "So sánh `dx*dx >= best` thay vì lấy căn để tránh sai số; `best` ban đầu là LLONG_MAX nên chỉ nhân khi hiệu đã nhỏ.",
        "Lấy `midx` TRƯỚC khi gọi đệ quy (đệ quy làm xáo thứ tự các điểm theo y).",
        "Nhiều điểm cùng x hoặc trùng nhau: chia theo chỉ số (không theo giá trị x) để mỗi nửa luôn nhỏ hơn.",
        "Quên nhánh cơ sở cho N = 2, 3 (vét cạn).",
        "Dùng set với toạ độ double và epsilon trong bản quét dễ sai; giữ số nguyên."
      ],
      code: {
        lang: "cpp", title: "closest-pair.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

struct CpPt { long long x, y; };

// Cặp điểm gần nhất bằng chia để trị: trả về BÌNH PHƯƠNG khoảng cách nhỏ nhất (lấy sqrt khi in).
// Cần n >= 2 điểm; điểm trùng cho 0. |x|, |y| <= 1e9 để d^2 <= 8e18 vừa long long. O(n log n).
struct ClosestPair {
    vector<CpPt> p, buf;
    long long best = LLONG_MAX;

    static long long d2(const CpPt& a, const CpPt& b) {
        long long dx = a.x - b.x, dy = a.y - b.y;
        return dx * dx + dy * dy;
    }
    static bool byY(const CpPt& a, const CpPt& b) { return a.y < b.y; }

    void rec(int l, int r) {          // p[l..r) đã sắp theo x; xong hàm thì p[l..r) được sắp theo y
        if (r - l <= 3) {
            for (int i = l; i < r; i++)
                for (int j = i + 1; j < r; j++) best = min(best, d2(p[i], p[j]));
            sort(p.begin() + l, p.begin() + r, byY);
            return;
        }
        int m = (l + r) / 2;
        long long midx = p[m].x;      // lấy TRƯỚC khi đệ quy (đệ quy xáo thứ tự các điểm)
        rec(l, m);
        rec(m, r);
        inplace_merge(p.begin() + l, p.begin() + m, p.begin() + r, byY);
        int k = 0;                    // buf = các điểm trong dải |x - midx| < d, theo y tăng dần
        for (int i = l; i < r; i++) {
            long long dx = p[i].x - midx;
            if (dx * dx >= best) continue;
            for (int j = k - 1; j >= 0 && (p[i].y - buf[j].y) * (p[i].y - buf[j].y) < best; j--)
                best = min(best, d2(p[i], buf[j]));
            buf[k++] = p[i];
        }
    }

    long long solve(vector<CpPt> pts) {
        sort(pts.begin(), pts.end(), [](const CpPt& a, const CpPt& b) { return a.x != b.x ? a.x < b.x : a.y < b.y; });
        p = move(pts);
        buf.assign(p.size(), CpPt{0, 0});
        best = LLONG_MAX;
        rec(0, (int)p.size());
        return best;
    }
};
`
      },
      example: {
        input: "Điểm: (0,0) (5,5) (1,1) (9,0) (4,5)",
        output: "1  (cặp (4,5) và (5,5), khoảng cách 1)",
        explain: "Sắp theo x: (0,0) (1,1) (4,5) (5,5) (9,0). Nửa trái cho d² = 2 (cặp (0,0)–(1,1)); nửa phải [(4,5), (5,5), (9,0)] cho d² = 1. Cặp qua đường chia có d² ≥ 1 nên đáp án là 1."
      },
      problems: [
        { site: "cses", id: "2194", name: "Minimum Euclidean Distance" },
        { site: "other", name: "UVa 10245 — The Closest Pair Problem" }
      ],
      related: ["sweep-line", "sorting", "convex-hull"],
      compare: {
        "Bài toán giải": "Cặp điểm có khoảng cách Euclid nhỏ nhất",
        "Độ chính xác": "Chính xác (d² nguyên, không dùng căn)",
        "Ràng buộc": "|toạ độ| ≤ 10⁹; N tới cỡ 10⁶"
      },
      cards: [
        { q: "Ý tưởng chia để trị của closest pair?", a: "Giải hai nửa theo x, lấy d nhỏ nhất, rồi chỉ xét dải |x − midx| < d: mỗi điểm so với một số hằng điểm kề theo y." },
        { q: "Độ phức tạp và vì sao?", a: "O(N log N): T(N) = 2T(N/2) + O(N) với bước trộn theo y và quét dải." },
        { q: "Vì sao trả về d² thay vì d?", a: "Toạ độ nguyên nên d² nguyên: so sánh chính xác, không sai số căn bậc hai." },
        { q: "Lỗi hay gặp khi chia theo x?", a: "Lấy midx sau khi đệ quy (mảng đã bị trộn theo y) hoặc chia theo giá trị x khi nhiều điểm cùng x; phải chia theo chỉ số." }
      ]
    },

    {
      id: "point-in-polygon",
      name: "Điểm trong đa giác",
      aliases: ["point in polygon", "điểm trong đa giác", "ray casting", "winding number", "pip", "even-odd rule", "điểm nằm trong đa giác"],
      category: "geo",
      sub: "Bao & đa giác",
      level: 2,
      tags: ["point-in-polygon", "geometry", "ray-casting", "cross-product", "polygon"],
      summary: "Xác định điểm nằm trong, trên biên hay ngoài một đa giác đơn (lồi hoặc không) bằng tia ngang và tích có hướng nguyên, chính xác, O(N) mỗi truy vấn.",
      description:
        "**Ray casting**: bắn tia nằm ngang từ điểm hỏi sang phải; số cạnh của đa giác mà tia cắt **lẻ** thì điểm ở trong, **chẵn** thì ở ngoài. Điểm nằm trên biên phải được kiểm tra riêng (tích có hướng bằng 0 và điểm nằm trong hộp bao của cạnh) trước khi đếm.\n\n" +
        "Chi tiết quyết định đúng: một cạnh chỉ được tính khi hai đầu mút nằm ở **hai phía** đường `y = q.y` theo quy ước nửa mở (`(a.y > q.y) != (b.y > q.y)`), nên tia đi qua đỉnh không bị đếm hai lần hay bỏ sót, còn cạnh ngang không bao giờ được tính. Vị trí giao điểm so với `q.x` được suy ra từ dấu của tích có hướng (và chiều của cạnh), nên **không có phép chia và không có epsilon**.\n\n" +
        "Mỗi truy vấn O(N). Đa giác **lồi** có thể trả lời O(log N) sau tiền xử lý (nhị phân theo góc quanh một đỉnh). Nhiều truy vấn trên một đa giác bất kỳ rất lớn cần cấu trúc định vị điểm chuyên dụng.",
      conditions: [
        "Đa giác đơn (không tự cắt, không tự chạm); đỉnh liệt kê theo thứ tự quanh biên, chiều nào cũng được",
        "Toạ độ nguyên |x|, |y| ≤ 10⁹ (chính xác); toạ độ thực cần epsilon và xử lý biên thận trọng"
      ],
      complexity: { time: "O(N)", space: "O(1)", note: "Mỗi truy vấn O(N). Đa giác lồi: O(log N) mỗi truy vấn sau khi tiền xử lý." },
      use_case: [
        "Phân loại điểm: trong / trên biên / ngoài đa giác (CSES Point in Polygon)",
        "Đếm số điểm cho trước nằm trong một vùng đa giác",
        "Nền cho các bài định vị điểm, kiểm tra va chạm đơn giản"
      ],
      not_for: [
        "Đa giác tự cắt: quy tắc chẵn/lẻ (ray casting) và winding number cho kết quả khác nhau — chọn đúng quy ước của bài",
        "Rất nhiều truy vấn trên đa giác lớn → cấu trúc định vị điểm, hoặc O(log N) nếu đa giác lồi",
        "Chỉ cần biết điểm nằm bên nào của một đường thẳng → tích có hướng (CSES Point Location Test)"
      ],
      pitfalls: [
        "Điểm trên biên (kể cả trùng đỉnh) phải kiểm tra TRƯỚC khi đếm cắt; sót sẽ phân loại sai thành trong hoặc ngoài.",
        "Quy ước nửa mở `(a.y > q.y) != (b.y > q.y)` là bắt buộc: dùng `>=` ở một phía và `>` ở phía kia sẽ đếm sai khi tia chạm đỉnh.",
        "Tràn số khi toạ độ vượt 10⁹: tích của hiệu hai toạ độ vượt long long → __int128.",
        "Dùng double và epsilon làm điểm sát biên bị phân loại sai; giữ số nguyên khi có thể.",
        "Đa giác có đỉnh trùng hoặc ba đỉnh thẳng hàng liên tiếp vẫn xử lý đúng nhưng nên loại bớt nếu có thể."
      ],
      code: {
        lang: "cpp", title: "point-in-polygon.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

struct PipPt { long long x, y; };

// Vị trí điểm q so với đa giác ĐƠN poly (n >= 3 đỉnh, thứ tự quanh biên, chiều nào cũng được):
// trả 0 = ngoài, 1 = trong, 2 = trên biên. Toàn số nguyên nên chính xác khi |x|, |y| <= 1e9. O(n).
int pointInPolygon(const vector<PipPt>& poly, const PipPt& q) {
    int n = poly.size();
    bool in = false;
    for (int i = 0, j = n - 1; i < n; j = i++) {                    // cạnh a = poly[j] → b = poly[i]
        const PipPt &a = poly[j], &b = poly[i];
        long long cr = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);   // cross(a→b, a→q)
        if (cr == 0 && min(a.x, b.x) <= q.x && q.x <= max(a.x, b.x) &&
            min(a.y, b.y) <= q.y && q.y <= max(a.y, b.y)) return 2;             // q nằm trên đoạn ab
        // Tia ngang từ q sang phải cắt ab khi a, b ở hai phía đường y = q.y (quy ước nửa mở)
        // và giao điểm nằm bên phải q; điều đó tương đương dấu của cr cùng chiều với (b.y - a.y).
        if ((a.y > q.y) != (b.y > q.y) && ((b.y > a.y) ? cr > 0 : cr < 0)) in = !in;
    }
    return in ? 1 : 0;
}
`
      },
      example: {
        input: "Đa giác chữ L: (0,0) (4,0) (4,2) (2,2) (2,4) (0,4). Điểm hỏi: (3,3), (1,3), (2,3), (3,1)",
        output: "(3,3) → 0 ngoài; (1,3) → 1 trong; (2,3) → 2 trên biên; (3,1) → 1 trong",
        explain: "Hình chữ L gồm [0,4]×[0,2] và [0,2]×[2,4]. (3,3) nằm ở góc bị khuyết nên ngoài. (1,3) thuộc phần đứng nên trong. (2,3) nằm đúng trên cạnh x = 2 nối (2,2)–(2,4) nên là biên. (3,1) thuộc phần ngang nên trong."
      },
      problems: [
        { site: "cses", id: "2192", name: "Point in Polygon" },
        { site: "cses", id: "2189", name: "Point Location Test" },
        { site: "cses", id: "2191", name: "Polygon Area" }
      ],
      related: ["convex-hull", "segment-intersection", "sweep-line"],
      compare: {
        "Bài toán giải": "Phân loại điểm: trong / trên biên / ngoài đa giác",
        "Độ chính xác": "Chính xác (số nguyên long long)",
        "Ràng buộc": "Đa giác đơn; |toạ độ| ≤ 10⁹; O(N) mỗi truy vấn"
      },
      cards: [
        { q: "Nguyên tắc của ray casting?", a: "Bắn tia từ điểm; số lần cắt biên đa giác lẻ → trong, chẵn → ngoài (điểm trên biên xử lý riêng trước)." },
        { q: "Vì sao dùng quy ước (a.y > q.y) != (b.y > q.y)?", a: "Quy ước nửa mở để tia đi qua đỉnh được đếm đúng một lần hoặc không đếm, và cạnh ngang không được tính." },
        { q: "Vì sao không cần epsilon?", a: "Vị trí giao điểm so với q.x suy ra từ dấu tích có hướng nguyên, không dùng phép chia hay số thực." },
        { q: "Truy vấn đa giác lồi nhanh hơn thế nào?", a: "Sau tiền xử lý, nhị phân theo góc quanh một đỉnh để tìm tam giác chứa điểm: O(log N) mỗi truy vấn." }
      ]
    },

    {
      id: "segment-intersection",
      name: "Giao hai đoạn thẳng",
      aliases: ["segment intersection", "giao hai đoạn thẳng", "line segment intersection", "hai đoạn cắt nhau", "orientation test", "ccw test"],
      category: "geo",
      sub: "Bao & đa giác",
      level: 3,
      tags: ["segment-intersection", "geometry", "cross-product", "orientation", "line-segment"],
      summary: "Kiểm tra hai đoạn thẳng có điểm chung không (gồm chạm đầu mút, chồng lấn thẳng hàng, đoạn suy biến thành điểm), phân loại giao điểm, chỉ bằng tích có hướng nguyên.",
      description:
        "Với đoạn `AB` và `CD`, tính dấu của bốn tích có hướng: vị trí của `C`, `D` so với đường thẳng `AB` (d1, d2) và của `A`, `B` so với đường thẳng `CD` (d3, d4). Hai đoạn **cắt thật sự** tại điểm nằm trong cả hai đoạn khi `d1·d2 < 0` và `d3·d4 < 0`.\n\n" +
        "Các trường hợp còn lại là **suy biến**: nếu một dấu bằng 0 thì điểm tương ứng nằm trên đường thẳng chứa đoạn kia, và hai đoạn chạm nhau khi điểm ấy thuộc *hộp bao* của đoạn kia (`min ≤ p ≤ max` theo cả hai trục). Cách này gom luôn chạm đầu mút (chữ T), đầu mút trùng nhau, hai đoạn thẳng hàng chồng lấn hay rời nhau, và đoạn suy biến thành điểm.\n\n" +
        "Mẫu có thêm `segmentIntersectionKind` (0 = không giao, 1 = một điểm, 2 = chồng lấn thành đoạn có độ dài dương) và `intersectionPoint` cho trường hợp cắt không song song — nơi **duy nhất** dùng `long double`, vì giao điểm là số hữu tỉ. Việc quyết định ‘có giao hay không’ không cần số thực, nên không bị ảnh hưởng bởi sai số.",
      conditions: [
        "Toạ độ nguyên |x|, |y| ≤ 10⁹ để tích có hướng vừa long long",
        "Mỗi đoạn cho bằng hai đầu mút; đoạn có thể suy biến thành một điểm"
      ],
      complexity: { time: "O(1)", space: "O(1)", note: "Tìm mọi cặp đoạn cắt nhau trong N đoạn: vét cạn O(N²); Shamos–Hoey phát hiện có cặp cắt O(N log N); Bentley–Ottmann liệt kê O((N + K) log N)." },
      use_case: [
        "Kiểm tra hai đoạn có cắt nhau (CSES Line Segment Intersection)",
        "Kiểm tra đa giác có tự cắt (xét từng cặp cạnh), đường đi có xuyên tường không",
        "Thành phần cơ bản của sweep line, bao lồi, cắt đa giác"
      ],
      not_for: [
        "Cần giao điểm chính xác dạng phân số → tính tử và mẫu nguyên (__int128), không làm tròn",
        "Rất nhiều đoạn (N ≳ 5000) → quét đường thay vì xét mọi cặp",
        "Đường thẳng hoặc tia (không phải đoạn) → bài đơn giản hơn: chỉ cần dấu tích có hướng"
      ],
      pitfalls: [
        "Chỉ kiểm `d1*d2 <= 0 && d3*d4 <= 0` sai khi hai đoạn thẳng hàng nhưng rời nhau (cả bốn dấu đều 0); phải kiểm hộp bao / thứ tự theo trục.",
        "Nhân hai GIÁ TRỊ cross (mỗi cái tới ~8·10¹⁸) bị tràn; lấy dấu rồi mới nhân (hoặc so sánh dấu).",
        "Tràn số tích có hướng khi toạ độ vượt 10⁹: dùng __int128.",
        "Dùng double và epsilon để QUYẾT ĐỊNH giao hay không làm sai ở ca chạm đầu mút; chỉ dùng số thực để TÍNH toạ độ giao điểm.",
        "Đoạn suy biến thành điểm (A = B) phải xử lý (mẫu đúng); nhiều cài đặt chia cho 0 khi tính tham số.",
        "Phân biệt ‘giao tại một điểm’ và ‘chồng lấn’ khi đề hỏi số điểm chung hoặc độ dài phần giao."
      ],
      code: {
        lang: "cpp", title: "segment-intersection.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

struct SgPt { long long x, y; };

// Toạ độ nguyên |x|, |y| <= 1e9. cross(o→a, o→b): > 0 rẽ trái, = 0 thẳng hàng, < 0 rẽ phải.
inline long long sgCross(const SgPt& o, const SgPt& a, const SgPt& b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
inline int sgSign(long long v) { return (v > 0) - (v < 0); }
// p nằm trong hộp bao của đoạn [a, b] (khi p đã thẳng hàng với a, b thì nghĩa là p thuộc đoạn).
inline bool sgInBox(const SgPt& p, const SgPt& a, const SgPt& b) {
    return min(a.x, b.x) <= p.x && p.x <= max(a.x, b.x) && min(a.y, b.y) <= p.y && p.y <= max(a.y, b.y);
}

// Hai đoạn [a, b] và [c, d] có điểm chung không? Chạm đầu mút, chồng lấn thẳng hàng và đoạn suy biến thành điểm đều tính.
bool segmentsIntersect(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d) {
    int d1 = sgSign(sgCross(a, b, c)), d2 = sgSign(sgCross(a, b, d));
    int d3 = sgSign(sgCross(c, d, a)), d4 = sgSign(sgCross(c, d, b));
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;                    // cắt thật sự tại điểm trong của cả hai đoạn
    return (d1 == 0 && sgInBox(c, a, b)) || (d2 == 0 && sgInBox(d, a, b)) ||
           (d3 == 0 && sgInBox(a, c, d)) || (d4 == 0 && sgInBox(b, c, d));   // một đầu mút nằm trên đoạn kia
}

// 0 = không giao, 1 = đúng một điểm chung, 2 = chồng lấn thành một đoạn có độ dài > 0.
int segmentIntersectionKind(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d) {
    if (!segmentsIntersect(a, b, c, d)) return 0;
    bool point = (a.x == b.x && a.y == b.y) || (c.x == d.x && c.y == d.y);
    if (point || sgCross(a, b, c) != 0 || sgCross(a, b, d) != 0) return 1;   // có đoạn suy biến, hoặc không thẳng hàng
    auto lessPt = [](const SgPt& p, const SgPt& q) { return p.x != q.x ? p.x < q.x : p.y < q.y; };
    const SgPt& lo = max(min(a, b, lessPt), min(c, d, lessPt), lessPt);      // hai đoạn thẳng hàng: đoạn giao = [lo, hi]
    const SgPt& hi = min(max(a, b, lessPt), max(c, d, lessPt), lessPt);
    return (lo.x == hi.x && lo.y == hi.y) ? 1 : 2;
}

// Giao điểm của hai đường thẳng AB và CD khi KHÔNG song song (chỉ gọi khi segmentsIntersect đúng); false nếu song song.
// Đây là chỗ duy nhất dùng số thực, vì giao điểm là số hữu tỉ.
bool intersectionPoint(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d, long double& px, long double& py) {
    long long rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    long long den = rx * sy - ry * sx;                              // cross(r, s)
    if (den == 0) return false;
    long long num = (c.x - a.x) * sy - (c.y - a.y) * sx;            // cross(c - a, s)
    long double t = (long double)num / (long double)den;            // a + t * r nằm trên CD
    px = a.x + t * rx;
    py = a.y + t * ry;
    return true;
}
`
      },
      example: {
        input: "A=(0,0) B=(4,4). Với CD: (0,4)-(4,0); (5,5)-(8,8); (2,2)-(6,6)",
        output: "(0,4)-(4,0): cắt tại (2,2) (loại 1); (5,5)-(8,8): không giao (loại 0); (2,2)-(6,6): chồng lấn (loại 2)",
        explain: "Hai đường chéo cắt nhau thật sự tại (2,2). Đoạn (5,5)-(8,8) thẳng hàng với AB nhưng nằm ngoài hộp bao của AB nên rời nhau. Đoạn (2,2)-(6,6) thẳng hàng và chồng lấn với AB trên [(2,2), (4,4)] có độ dài dương nên là loại 2."
      },
      problems: [
        { site: "cses", id: "2190", name: "Line Segment Intersection" },
        { site: "cses", id: "2189", name: "Point Location Test" },
        { site: "cses", id: "1740", name: "Intersection Points" }
      ],
      related: ["sweep-line", "point-in-polygon", "convex-hull"],
      compare: {
        "Bài toán giải": "Hai đoạn có điểm chung không, và loại giao (điểm / chồng lấn)",
        "Độ chính xác": "Quyết định chính xác (số nguyên); long double chỉ để tính toạ độ giao điểm",
        "Ràng buộc": "|toạ độ| ≤ 10⁹; O(1) mỗi cặp"
      },
      cards: [
        { q: "Điều kiện hai đoạn cắt thật sự (không suy biến)?", a: "C, D nằm hai phía đường AB và A, B nằm hai phía đường CD: dấu cross d1·d2 < 0 và d3·d4 < 0." },
        { q: "Trường hợp cross bằng 0 xử lý thế nào?", a: "Điểm đó nằm trên đường thẳng chứa đoạn kia; hai đoạn chạm khi điểm thuộc hộp bao (min ≤ p ≤ max theo cả hai trục)." },
        { q: "Vì sao không nhân hai giá trị cross trực tiếp?", a: "Mỗi cross có thể tới ~8·10¹⁸ nên tích bị tràn; lấy dấu của từng cross rồi mới nhân." },
        { q: "Khi nào mới dùng số thực?", a: "Chỉ khi cần toạ độ giao điểm; quyết định giao hay không luôn làm bằng số nguyên để chính xác." }
      ]
    }
  ]);

  // ================================================================================================ KỊCH BẢN QUIZ
  A.lib.scenarios([
    // ---- binary-search
    { id: "q-binary-search-1",
      prompt: "Mảng N = 10⁶ số nguyên đã sắp xếp tăng dần, cố định, có nhiều giá trị trùng nhau. Có Q = 10⁶ truy vấn độc lập, mỗi truy vấn cho một số x và hỏi trong mảng có bao nhiêu phần tử đúng bằng x.",
      answer: ["binary-search"], also: ["ordered-set"], wrong: ["two-pointers", "sliding-window", "sparse-table", "sorting"],
      why: "Mảng đã có thứ tự nên số phần tử bằng x là hiệu của upper_bound và lower_bound: mỗi truy vấn O(log N). Ordered set cũng trả lời được nhưng phải dựng thêm cây cho dữ liệu tĩnh. Hai con trỏ / cửa sổ trượt mà quét tay cho từng truy vấn tốn O(N) mỗi lần, tổng 10¹²; Sparse Table dành cho truy vấn đoạn min / max / gcd, không đếm số lần xuất hiện; sắp xếp lại một mảng đã sắp xếp không giúp gì.", level: 1 },
    { id: "q-binary-search-2",
      prompt: "Có N = 10⁵ máy chạy song song và độc lập; máy i làm xong một sản phẩm mất t_i giây (t_i ≤ 10⁹), làm liên tục hết sản phẩm này tới sản phẩm khác. Cần làm K = 10⁹ sản phẩm. Hỏi thời gian nhỏ nhất để các máy cùng làm đủ K sản phẩm.",
      answer: ["binary-search"], also: [], wrong: ["ternary-search", "heap", "two-pointers", "sorting"],
      why: "Số sản phẩm làm được trong T giây là tổng floor(T / t_i), tăng không giảm theo T: đây là vị từ đơn điệu, nhị phân trên đáp án T trong [1, K · min t_i] mất O(N log(miền)). Tam phân dành cho hàm có một đỉnh, còn ở đây hàm chỉ tăng. Mô phỏng bằng heap phải xử lý tới K = 10⁹ sản phẩm nên quá chậm; hai con trỏ và sắp xếp không cho biết T.", level: 3 },

    // ---- ternary-search
    { id: "q-ternary-search-1",
      prompt: "Hai vật chuyển động thẳng đều trong mặt phẳng; cho vị trí ban đầu và vận tốc (số thực) của từng vật, hai vận tốc khác nhau. Tìm thời điểm t trong [0, 10⁶] mà khoảng cách giữa hai vật nhỏ nhất, sai số cho phép 10⁻⁶. Bạn không muốn rút công thức đạo hàm.",
      answer: ["ternary-search"], also: [], wrong: ["binary-search", "closest-pair", "simulated-annealing", "convex-hull-trick"],
      why: "Khoảng cách f(t) là độ dài của một vectơ tuyến tính theo t nên là hàm lồi: giảm rồi tăng, có đúng một đáy. Tìm kiếm tam phân loại một phần ba đoạn mỗi bước, lặp cố định khoảng 100 lần là đủ. Nhị phân cần vị từ đơn điệu mà f không đơn điệu; cặp điểm gần nhất xét tập điểm tĩnh; simulated annealing không bảo đảm sai số và thừa cho hàm một biến lồi; Convex Hull Trick tối ưu họ đường thẳng tại các hoành độ truy vấn, không phải bài toán này.", level: 2 },

    // ---- two-pointers
    { id: "q-two-pointers-1",
      prompt: "Mảng N = 2·10⁵ số nguyên (có thể âm, |a_i| ≤ 10⁹), chưa sắp xếp. Chỉ cần trả lời CÓ hay KHÔNG: tồn tại hai phần tử ở hai vị trí khác nhau có tổng đúng bằng S hay không (không cần chỉ số). Chạy một lần.",
      answer: ["two-pointers"], also: ["binary-search"], wrong: ["sliding-window", "array-prefix-sum", "monotonic-queue", "kadane"],
      why: "Sắp xếp O(N log N) rồi đặt hai con trỏ ở hai đầu: tổng nhỏ hơn S thì dời đầu trái, lớn hơn thì dời đầu phải, mỗi bước loại một phần tử nên quét O(N). Với mỗi a_i nhị phân tìm S − a_i cũng đúng nhưng cài dài hơn. Cửa sổ trượt, prefix sum, hàng đợi đơn điệu và Kadane đều xử lý đoạn con LIÊN TIẾP, còn hai số của cặp không cần kề nhau, và mảng có số âm nên không có tính đơn điệu.", level: 2 },
    { id: "q-two-pointers-2",
      prompt: "N = 2·10⁵ người, người i nặng w_i (w_i ≤ X). Mỗi thuyền chở tối đa 2 người và tổng cân nặng không vượt X. Hỏi số thuyền ít nhất để chở hết mọi người.",
      answer: ["two-pointers"], also: [], wrong: ["knapsack-01", "bitmask-dp", "sliding-window", "greedy-interval-scheduling"],
      why: "Sắp xếp cân nặng rồi đặt con trỏ ở người nhẹ nhất và nặng nhất: nếu hai người này đi chung được thì ghép (dời cả hai), nếu không thì người nặng nhất đi một mình; mỗi bước loại ít nhất một người nên O(N log N). Knapsack và bitmask DP quá chậm với N = 2·10⁵ và không cần thiết vì mỗi thuyền chỉ ghép đôi; cửa sổ trượt cần đoạn liên tiếp; lập lịch khoảng chọn đoạn thời gian không giao nhau, không ghép cặp theo tải trọng.", level: 2 },

    // ---- sliding-window
    { id: "q-sliding-window-1",
      prompt: "Mảng N = 2·10⁵ số nguyên DƯƠNG (≤ 10⁹) và một số K ≤ 10¹⁴. Tìm độ dài lớn nhất của một đoạn con liên tiếp có tổng không vượt quá K. Chạy một lần.",
      answer: ["sliding-window"], also: ["two-pointers", "binary-search"], wrong: ["kadane", "monotonic-queue", "difference-array", "sparse-table"],
      why: "Phần tử dương nên thu hẹp bên trái luôn làm tổng nhỏ đi: mở rộng r, thu hẹp l khi tổng vượt K, ghi nhận độ dài dài nhất, mỗi chỉ số vào ra một lần nên O(N). Hai con trỏ cùng chiều chính là kỹ thuật này; nhị phân theo độ dài kèm prefix sum cũng đúng nhưng O(N log N). Kadane tìm tổng LỚN nhất, không có ràng buộc ≤ K; hàng đợi đơn điệu lấy max / min của cửa sổ; mảng hiệu và Sparse Table không phục vụ bài này.", level: 2 },
    { id: "q-sliding-window-2",
      prompt: "Mảng N = 2·10⁵ số nguyên dương (giá trị ≤ N) và số k. Đếm số đoạn con liên tiếp có ĐÚNG k giá trị khác nhau. Chạy một lần, không có cập nhật.",
      answer: ["sliding-window"], also: ["two-pointers"], wrong: ["array-prefix-sum", "kadane", "monotonic-queue", "kmp"],
      why: "Số đoạn có đúng k giá trị phân biệt bằng atMost(k) − atMost(k − 1). Mỗi atMost chạy cửa sổ với bảng đếm: với mỗi r, thu hẹp l tới khi có không quá k giá trị phân biệt rồi cộng r − l + 1 đoạn kết thúc tại r, tổng O(N). Tính đơn điệu có sẵn: bỏ bớt phần tử không làm tăng số giá trị phân biệt. Prefix sum và Kadane làm việc với tổng, không đếm giá trị khác nhau; hàng đợi đơn điệu lấy max / min cửa sổ; KMP là khớp xâu.", level: 3 },

    // ---- sorting
    { id: "q-sorting-1",
      prompt: "Có N = 2·10⁵ nhiệm vụ, nhiệm vụ i cần d_i đơn vị thời gian làm và có hạn chót t_i. Bạn phải làm LẦN LƯỢT cả N nhiệm vụ trên một máy, nhiệm vụ hoàn thành ở thời điểm f thì nhận phần thưởng t_i − f (có thể âm). Tối đa hoá tổng phần thưởng.",
      answer: ["sorting"], also: [], wrong: ["greedy-interval-scheduling", "knapsack-01", "bitmask-dp", "interval-dp"],
      why: "Tổng phần thưởng = Σ t_i − Σ f_i, mà Σ t_i cố định nên phải cực tiểu hoá tổng thời điểm hoàn thành: làm nhiệm vụ ngắn trước (đổi chỗ hai nhiệm vụ kề nhau không có lợi khi nhiệm vụ dài đứng trước). Chỉ cần sắp xếp theo d_i tăng dần, O(N log N); hạn chót không ảnh hưởng thứ tự. Lập lịch khoảng chọn một tập đoạn thời gian cố định không giao nhau, còn ở đây phải làm mọi nhiệm vụ; knapsack, bitmask DP và interval DP vừa quá chậm với N = 2·10⁵ vừa không cần thiết.", level: 2 },

    // ---- count-inversions
    { id: "q-count-inversions-1",
      prompt: "Cho một hoán vị của 1..N với N = 2·10⁵. Mỗi bước được đổi chỗ hai phần tử đứng KỀ NHAU. Hỏi số bước tối thiểu để sắp xếp hoán vị tăng dần.",
      answer: ["count-inversions"], also: ["fenwick-tree", "segment-tree"], wrong: ["lis", "edit-distance", "two-pointers", "monotonic-stack"],
      why: "Mỗi lần đổi chỗ hai phần tử kề nhau xoá đúng một nghịch thế nên đáp án chính là số cặp (i < j) có a_i > a_j: đếm khi trộn của merge sort, O(N log N), nhớ dùng long long vì đáp án tới N(N − 1)/2. Fenwick hoặc Segment Tree duyệt từ trái sang phải cũng đúng, cài dài hơn. N − LIS là số lần chuyển MỘT phần tử tới vị trí tuỳ ý, không phải đổi chỗ kề nhau; edit distance là bài hai xâu; hai con trỏ và ngăn xếp đơn điệu không đếm hết các cặp không kề nhau.", level: 3 },
    { id: "q-count-inversions-2",
      prompt: "Mảng N = 10⁵ số nguyên 32-bit. Đếm số cặp chỉ số (i < j) thoả a_i > 2·a_j. Chạy một lần, không có cập nhật.",
      answer: ["count-inversions"], also: ["fenwick-tree", "ordered-set"], wrong: ["two-pointers", "sliding-window", "mo-algorithm", "sparse-table"],
      why: "Đây là biến thể của đếm nghịch thế: trong merge sort, trước khi trộn hai nửa đã sắp xếp, dùng hai con trỏ đếm số cặp (i ở nửa trái, j ở nửa phải) thoả a_i > 2·a_j rồi mới trộn bình thường; O(N log N), dùng long long cho 2·a_j và cho kết quả. Fenwick trên giá trị đã nén hoặc ordered set cũng làm được nhưng nặng hơn. Hai con trỏ / cửa sổ trượt trên mảng chưa sắp xếp không đếm được cặp không kề nhau; Mo dành cho truy vấn đoạn; Sparse Table là cấu trúc tĩnh cho min / max / gcd.", level: 4 },

    // ---- meet-in-the-middle
    { id: "q-meet-in-the-middle-1",
      prompt: "Cho N = 40 số nguyên dương, mỗi số tới 10¹⁵, và một số S. Đếm số tập con (tập rỗng tính là một tập con) có tổng đúng bằng S. Giới hạn thời gian 3 giây, bộ nhớ 256 MB.",
      answer: ["meet-in-the-middle"], also: [], wrong: ["knapsack-01", "bitmask-dp", "backtracking", "sos-dp"],
      why: "Chia 40 số thành hai nửa 20 số, mỗi nửa có 2²⁰ ≈ 10⁶ tập con; sắp xếp tổng của hai nửa rồi dùng hai con trỏ ghép các cặp x + y = S, nhóm giá trị trùng và nhân số lượng (long long): O(2^(N/2) · N). Knapsack theo tổng cần mảng cỡ tổng các số, tới 4·10¹⁶; bitmask DP và quay lui duyệt 2⁴⁰ ≈ 10¹² trường hợp; SOS DP cần bảng 2^N.", level: 3 },
    { id: "q-meet-in-the-middle-2",
      prompt: "Có N = 36 vật, vật i nặng w_i (w_i ≤ 10¹⁵). Chia các vật vào hai nhóm (mỗi vật vào đúng một nhóm) sao cho chênh lệch tổng khối lượng của hai nhóm nhỏ nhất. In ra chênh lệch đó.",
      answer: ["meet-in-the-middle"], also: [], wrong: ["knapsack-01", "bitmask-dp", "backtracking", "simulated-annealing"],
      why: "Gọi T là tổng cả hai nhóm, cần tập con có tổng x gần T/2 nhất (chênh lệch = |T − 2x|). Chia hai nửa 18 vật (2¹⁸ ≈ 2,6·10⁵ tập con mỗi nửa), sắp xếp tổng nửa phải, với mỗi tổng nửa trái tìm tổng nửa phải gần T/2 − x nhất bằng nhị phân hoặc hai con trỏ. Knapsack theo tổng bất khả thi vì T lên tới ~10¹⁶; bitmask DP và quay lui duyệt 2³⁶ ≈ 7·10¹⁰; simulated annealing là heuristic, không bảo đảm tối ưu.", level: 3 },

    // ---- backtracking
    { id: "q-backtracking-1",
      prompt: "Đặt N = 12 quân hậu lên bàn cờ N × N sao cho không hai quân nào cùng hàng, cùng cột hoặc cùng đường chéo. Đếm số cách đặt. Giới hạn thời gian 2 giây.",
      answer: ["backtracking"], also: [], wrong: ["hungarian", "bipartite-matching", "meet-in-the-middle", "two-sat"],
      why: "Đặt lần lượt từng hàng, thử từng cột và kiểm tra ràng buộc cột / hai đường chéo bằng bitmask trong O(1); nhánh vi phạm bị cắt ngay nên với N = 12 chạy rất nhanh dù cận trên là N!. Ghép cặp và Hungarian chỉ xử lý ràng buộc hàng–cột, không có ràng buộc đường chéo; Meet in the Middle không có cách ghép hai nửa độc lập; 2-SAT chỉ giải ràng buộc hai biến, còn việc ‘đúng N quân’ không mô tả được bằng hai biến.", level: 2 },
    { id: "q-backtracking-2",
      prompt: "Cho đồ thị vô hướng n = 15 đỉnh, nhiều cạnh. Hỏi có tô được mỗi đỉnh một trong 3 màu sao cho hai đỉnh kề nhau khác màu hay không; nếu có, in một cách tô.",
      answer: ["backtracking"], also: ["bitmask-dp"], wrong: ["bfs", "two-sat", "dsu", "bipartite-matching"],
      why: "Tô 3 màu tổng quát là NP-đầy đủ, nên với n nhỏ ta gán màu từng đỉnh, kiểm tra ngay với các láng giềng đã tô và quay lui khi vướng: tối đa 3¹⁵ ≈ 1,4·10⁷ cách, cắt tỉa còn ít hơn nhiều. DP trên tập con cũng làm được nhưng cài đặt dài hơn. BFS tô hai màu và 2-SAT chỉ giải đúng trường hợp 2 màu (đồ thị hai phía), còn 3 màu thì không; DSU và ghép cặp không biểu diễn được ràng buộc ‘khác màu’ với 3 giá trị.", level: 3 },

    // ---- mo-algorithm
    { id: "q-mo-algorithm-1",
      prompt: "Mảng N = 2·10⁵ số nguyên dương (≤ 10⁶), không đổi. Q = 2·10⁵ truy vấn [l, r]; với mỗi truy vấn tính Σ cnt(v)² · v trên các giá trị v trong đoạn, với cnt(v) là số lần v xuất hiện trong đoạn. Được đọc hết các truy vấn rồi mới trả lời, giới hạn 4 giây.",
      answer: ["mo-algorithm"], also: [], wrong: ["segment-tree", "fenwick-tree", "sparse-table", "array-prefix-sum"],
      why: "Đáp án của đoạn không tính được bằng cách gộp hai nửa (cnt không cộng lại thành tổng bình phương), nhưng thêm hoặc bớt MỘT phần tử ở biên đổi đáp án trong O(1): cộng v · (2·cnt + 1) rồi tăng cnt, hoặc ngược lại. Sắp truy vấn theo khối của l rồi r, dời hai đầu: O((N + Q)·√N) ≈ 2·10⁸ bước dời. Segment Tree cần phép gộp hai nút O(1), Fenwick và prefix sum cần phép nghịch đảo đơn giản, Sparse Table cần phép luỹ đẳng; hàm này không có tính chất nào.", level: 4 },
    { id: "q-mo-algorithm-2",
      prompt: "Mảng N = 5·10⁴ số nguyên (≤ 10⁹). Có Q = 5·10⁴ thao tác theo thứ tự thời gian, gồm hai loại: ‘đặt a_p = x’ và ‘đếm số giá trị phân biệt trong đoạn [l, r]’. Toàn bộ thao tác được đọc trước khi trả lời, giới hạn 4 giây.",
      answer: ["mo-algorithm"], also: [], wrong: ["segment-tree", "lazy-segment-tree", "sparse-table", "array-prefix-sum"],
      why: "Offline, đoạn hiện tại có thể thêm / bớt một phần tử trong O(1) và đọc đáp án ngay từ bảng đếm: đây là Mo có cập nhật, thêm chiều thời gian vào trạng thái (l, r, t), sắp xếp theo khối kích thước ≈ N^(2/3) và dời cả ba con trỏ: O(N^(5/3)) ≈ 7·10⁷. Segment Tree (kể cả lười) không gộp được số giá trị phân biệt của hai nửa vì giá trị có thể trùng giữa hai nửa; prefix sum và Sparse Table là cấu trúc tĩnh, không chịu được cập nhật.", level: 5 },

    // ---- coordinate-compression
    { id: "q-coordinate-compression-1",
      prompt: "Cho sẵn toàn bộ N = 2·10⁵ điểm (x_i, y_i) với |x_i|, |y_i| ≤ 10⁹, đôi một khác nhau. Đếm số cặp (i, j) thoả x_i < x_j và y_i < y_j. Bạn định xử lý các điểm theo x tăng dần và hỏi ‘đã có bao nhiêu điểm với y nhỏ hơn’ trên một cấu trúc đếm theo chỉ số y, nhưng không thể cấp phát mảng 10⁹ ô. Kết quả chỉ phụ thuộc thứ tự tương đối của các y.",
      answer: ["coordinate-compression"], also: ["ordered-set"], wrong: ["sparse-table", "difference-array", "dsu", "monotonic-stack"],
      why: "Chỉ thứ tự tương đối của y quan trọng nên sắp xếp, bỏ trùng, rồi thay mỗi y bằng thứ hạng trong [0, 2·10⁵): cấu trúc đếm theo chỉ số (Fenwick) chỉ cần O(N) bộ nhớ, tổng O(N log N). Ordered set cũng đếm được trên giá trị gốc nhưng hằng số lớn hơn. Mảng hiệu vẫn phải cấp mảng theo giá trị; Sparse Table là cấu trúc tĩnh cho min / max / gcd; DSU và ngăn xếp đơn điệu không đếm số phần tử nhỏ hơn.", level: 2 },
    { id: "q-coordinate-compression-2",
      prompt: "Lưới 10⁹ × 10⁹ ô, trong đó có N = 500 hình chữ nhật đen (cạnh song song trục, có thể chồng nhau), các ô còn lại trắng. Đếm số vùng trắng liên thông (hai ô trắng cùng vùng nếu nối được bằng đường đi 4 hướng qua các ô trắng).",
      answer: ["coordinate-compression"], also: [], wrong: ["segment-tree", "sqrt-decomposition", "sparse-table", "fenwick-tree"],
      why: "Duyệt từng ô là bất khả thi, nhưng màu của lưới chỉ đổi tại biên các hình chữ nhật: nén mỗi trục còn không quá 2N + 2 toạ độ (nhớ giữ cả biên x2 + 1 và hai mép lưới) để lưới nén có tối đa khoảng 10⁶ ô, mỗi ô nén có màu đồng nhất và liên thông giữ nguyên; rồi đếm vùng bằng BFS hoặc DFS. Segment Tree, Fenwick, Sparse Table và sqrt decomposition là cấu trúc cho truy vấn trên dãy, không phải công cụ thu nhỏ lưới 2D.", level: 3 },

    // ---- greedy-interval-scheduling
    { id: "q-greedy-interval-scheduling-1",
      prompt: "Liên hoan phim có N = 2·10⁵ bộ phim, phim i chiếu từ a_i tới b_i (xem phim này xong lúc b_i thì được xem phim bắt đầu đúng lúc b_i). Bạn chỉ xem một phim tại một thời điểm và phải xem trọn phim đã chọn. Chọn xem được nhiều phim nhất.",
      answer: ["greedy-interval-scheduling"], also: [], wrong: ["knapsack-01", "interval-dp", "lis", "bitmask-dp"],
      why: "Sắp phim theo thời điểm KẾT THÚC tăng dần rồi duyệt: lấy phim nếu a_i ≥ thời điểm kết thúc của phim đã chọn gần nhất. Chứng minh bằng trao đổi: phim kết thúc sớm nhất luôn nằm trong một nghiệm tối ưu nào đó. O(N log N). Bài không có trọng số nên không cần knapsack hay quy hoạch động trên đoạn; LIS tìm dãy con tăng, không phải tập đoạn không giao nhau; bitmask DP vô lý với N = 2·10⁵.", level: 2 },
    { id: "q-greedy-interval-scheduling-2",
      prompt: "Có N = 2·10⁵ cuộc họp, cuộc họp i diễn ra trong [s_i, e_i) (cuộc họp kết thúc đúng lúc cuộc khác bắt đầu thì có thể dùng chung phòng). Phải tổ chức mọi cuộc họp, mỗi phòng không có hai cuộc họp chồng nhau. Hỏi số phòng ít nhất.",
      answer: ["greedy-interval-scheduling"], also: ["heap", "sweep-line"], wrong: ["knapsack-01", "dsu", "topological-sort", "interval-dp"],
      why: "Số phòng ít nhất bằng số cuộc họp chồng nhau nhiều nhất tại một thời điểm: sắp điểm bắt đầu và điểm kết thúc rồi quét, khi một cuộc họp kết thúc đúng lúc cuộc khác bắt đầu thì giải phóng phòng trước khi nhận (điều kiện e ≤ s); O(N log N). Heap giữ thời điểm kết thúc của các phòng đang dùng hoặc quét sự kiện là cùng ý tưởng cài theo cách khác. Knapsack và interval DP không có vai trò, DSU và sắp xếp topo là bài đồ thị.", level: 3 },

    // ---- bit-manipulation
    { id: "q-bit-manipulation-1",
      prompt: "Mảng N = 10⁶ số nguyên 32-bit, trong đó mọi giá trị xuất hiện đúng hai lần, trừ một giá trị chỉ xuất hiện đúng một lần. Tìm giá trị đó với thời gian O(N) và bộ nhớ phụ O(1).",
      answer: ["bit-manipulation"], also: [], wrong: ["sorting", "binary-search", "two-pointers", "array-prefix-sum"],
      why: "XOR có a ^ a = 0 và giao hoán: XOR toàn bộ mảng triệt tiêu mọi cặp, chỉ còn giá trị xuất hiện một lần, O(N) thời gian, O(1) bộ nhớ. Sắp xếp rồi so sánh các phần tử kề nhau tốn O(N log N), vi phạm yêu cầu thời gian; nhị phân cần mảng đã sắp xếp; hai con trỏ và prefix sum không tách được số duy nhất trong mảng chưa sắp xếp.", level: 2 },
    { id: "q-bit-manipulation-2",
      prompt: "Trong một nhóm có tối đa 60 người, mỗi tập thành viên của một đội được lưu thành một số nguyên 64-bit. Cần thực hiện Q = 10⁷ thao tác trên các đội: hai đội có chung người không, số người của hợp hai đội, loại người thứ i khỏi một đội. Mỗi thao tác phải gần O(1).",
      answer: ["bit-manipulation"], also: [], wrong: ["bitmask-dp", "sos-dp", "dsu", "sqrt-decomposition"],
      why: "Mỗi tập ≤ 64 phần tử nằm gọn trong một unsigned long long: giao khác rỗng là a & b ≠ 0, hợp là a | b, kích thước là __builtin_popcountll, loại người i là a &= ~(1ULL << i) — mọi thao tác O(1) trên một từ máy. Bitmask DP và SOS DP là quy hoạch động trên các mask, ở đây không có bài toán tối ưu hay đếm trên tập con; DSU chỉ gộp nhóm mà không có giao hay xoá phần tử; sqrt decomposition thừa.", level: 2 },

    // ---- convex-hull
    { id: "q-convex-hull-1",
      prompt: "N = 2·10⁵ cây trồng ở các điểm có toạ độ nguyên |x|, |y| ≤ 10⁹ (có thể có điểm trùng và thẳng hàng). Cần căng một sợi dây khép kín ngắn nhất bao quanh mọi cây. Tính độ dài sợi dây.",
      answer: ["convex-hull"], also: [], wrong: ["closest-pair", "sweep-line", "point-in-polygon", "segment-intersection"],
      why: "Đường khép kín ngắn nhất bao mọi điểm chính là chu vi bao lồi: sắp xếp điểm, loại điểm trùng, dựng bao bằng monotone chain với tích có hướng số nguyên (long long đủ cho |toạ độ| ≤ 10⁹), cộng độ dài các cạnh: O(N log N). Cặp điểm gần nhất là bài khác hẳn; quét đường là khuôn tổng quát cho các bài sự kiện; điểm trong đa giác và giao hai đoạn là phép thử cho một đa giác hoặc một cặp đoạn đã cho.", level: 3 },
    { id: "q-convex-hull-2",
      prompt: "Cho N = 10⁵ điểm trên mặt phẳng, toạ độ nguyên |x|, |y| ≤ 10⁹. Tìm hai điểm có khoảng cách LỚN nhất (đường kính của tập điểm), in bình phương khoảng cách đó. Vét cạn O(N²) không kịp.",
      answer: ["convex-hull"], also: [], wrong: ["closest-pair", "sweep-line", "ternary-search", "sorting"],
      why: "Cặp xa nhất luôn là hai đỉnh của bao lồi: dựng bao O(N log N) rồi dùng rotating calipers (hoặc duyệt O(h²) khi bao nhỏ) để tìm cặp đỉnh xa nhất; bình phương khoảng cách tối đa 8·10¹⁸ vừa long long. Cặp điểm gần nhất tìm cặp NGƯỢC lại và không giúp bài này; quét đường và sắp xếp đơn thuần không rút gọn được tập ứng viên; tam phân không áp dụng được trực tiếp lên tập điểm rời rạc.", level: 4 },

    // ---- sweep-line
    { id: "q-sweep-line-1",
      prompt: "Cho N = 10⁵ hình chữ nhật có cạnh song song hai trục, toạ độ nguyên từ 0 tới 10⁹ (các hình có thể chồng lên nhau). Tính diện tích của phần mặt phẳng được phủ bởi ít nhất một hình chữ nhật.",
      answer: ["sweep-line"], also: [], wrong: ["difference-array", "closest-pair", "convex-hull", "sparse-table"],
      why: "Quét theo trục x: mỗi hình chữ nhật cho hai sự kiện (mở khoảng y tại cạnh trái, đóng tại cạnh phải); Segment Tree trên toạ độ y đã nén giữ tổng độ dài đang bị phủ, và diện tích cộng thêm (độ dài phủ) · (x mới − x cũ) giữa hai sự kiện liên tiếp: O(N log N). Mảng hiệu hai chiều cần lưới 10⁹ × 10⁹ hoặc O(N²) ô sau khi nén, quá lớn với N = 10⁵; cặp gần nhất và bao lồi là bài khác; Sparse Table không cập nhật được.", level: 4 },
    { id: "q-sweep-line-2",
      prompt: "Có N = 2·10⁵ đoạn thẳng, mỗi đoạn hoặc nằm ngang hoặc thẳng đứng, toạ độ nguyên tới 10⁹. Đếm số cặp (một đoạn ngang, một đoạn dọc) có điểm chung, kể cả khi chỉ chạm ở đầu mút. Giả sử không có hai đoạn cùng hướng chồng nhau.",
      answer: ["sweep-line"], also: [], wrong: ["segment-intersection", "closest-pair", "convex-hull", "point-in-polygon"],
      why: "Quét theo x với Fenwick tree trên toạ độ y đã nén: gặp đầu trái đoạn ngang thì thêm y, gặp đầu phải thì xoá, gặp đoạn dọc thì hỏi số y thuộc [y1, y2] đang hoạt động; cùng toạ độ x thì thêm trước, hỏi giữa, xoá sau để chạm đầu mút vẫn được tính; O(N log N), tổng đếm dùng long long vì có thể tới 10¹⁰. Kiểm tra giao hai đoạn bằng tích có hướng chỉ trả lời cho MỘT cặp; xét hết các cặp ngang–dọc là cỡ 10¹⁰ phép thử, quá chậm.", level: 4 },

    // ---- closest-pair
    { id: "q-closest-pair-1",
      prompt: "N = 2·10⁵ điểm có toạ độ nguyên |x|, |y| ≤ 10⁹, có thể có điểm trùng nhau. Tìm khoảng cách nhỏ nhất giữa hai điểm (hai điểm khác chỉ số), in bình phương khoảng cách. Giới hạn thời gian 2 giây.",
      answer: ["closest-pair"], also: ["sweep-line"], wrong: ["convex-hull", "segment-intersection", "point-in-polygon", "two-pointers"],
      why: "Chia để trị theo x: giải hai nửa, đặt d là nghiệm tốt hơn, rồi chỉ xét dải |x − midx| < d, sắp theo y và so mỗi điểm với một số hằng điểm kế tiếp: O(N log N), làm việc với bình phương khoảng cách nguyên (tối đa 8·10¹⁸). Quét đường với set theo y cũng cùng độ phức tạp. Vét cạn O(N²) ≈ 4·10¹⁰ quá chậm; bao lồi, giao đoạn, điểm trong đa giác là các bài khác; hai con trỏ không dùng được vì hai điểm gần nhất có thể không kề nhau khi sắp theo x.", level: 3 },

    // ---- point-in-polygon
    { id: "q-point-in-polygon-1",
      prompt: "Cho một đa giác đơn (không tự cắt, có thể LÕM) gồm N = 1000 đỉnh toạ độ nguyên |x|, |y| ≤ 10⁹ và Q = 1000 điểm hỏi. Với mỗi điểm hãy cho biết nó nằm trong, nằm trên biên hay nằm ngoài đa giác.",
      answer: ["point-in-polygon"], also: [], wrong: ["convex-hull", "closest-pair", "sweep-line", "bfs"],
      why: "Mỗi truy vấn: trước hết kiểm tra điểm có nằm trên một cạnh không (tích có hướng bằng 0 và nằm trong hộp bao), nếu không thì bắn tia ngang và đếm số cạnh bị cắt theo quy ước nửa mở: lẻ là trong, chẵn là ngoài; O(N) mỗi truy vấn, tổng 10⁶ phép, toàn số nguyên. Bao lồi của đa giác lõm chứa cả phần ngoài của nó nên không phân biệt được trong / ngoài; cặp gần nhất không liên quan; quét đường thừa với 10⁶ phép; BFS cần lưới ô, không phải toạ độ 10⁹.", level: 2 },

    // ---- segment-intersection
    { id: "q-segment-intersection-1",
      prompt: "Có T = 10⁵ bộ test độc lập, mỗi bộ cho hai đoạn thẳng AB và CD với toạ độ nguyên |x|, |y| ≤ 10⁹. Hai đoạn có thể chạm nhau ở đầu mút, thẳng hàng chồng lên nhau, rời nhau, hoặc một đoạn suy biến thành một điểm. Với mỗi bộ, cho biết hai đoạn có ít nhất một điểm chung hay không.",
      answer: ["segment-intersection"], also: [], wrong: ["sweep-line", "convex-hull", "point-in-polygon", "closest-pair"],
      why: "Mỗi cặp: tính dấu của bốn tích có hướng (C, D so với AB; A, B so với CD); trái dấu cả hai cặp thì cắt thật sự, còn dấu 0 thì xét điểm đó có nằm trong hộp bao của đoạn kia không — gom luôn chạm đầu mút, chồng lấn thẳng hàng và đoạn suy biến; O(1) mỗi cặp, chính xác bằng số nguyên. Quét đường chỉ có lợi khi phải tìm cặp cắt nhau trong rất NHIỀU đoạn, còn đây mỗi test chỉ có hai đoạn; bao lồi, điểm trong đa giác, cặp gần nhất giải bài khác.", level: 2 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
