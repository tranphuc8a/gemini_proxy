/* lib-string.js — xâu: so khớp mẫu (KMP, Z), hash, Trie, Aho-Corasick, Suffix Array + LCP, Manacher, Suffix Automaton, Binary Trie (XOR), dịch vòng nhỏ nhất.
   Định dạng theo HUONG-DAN-SOAN.md; mẫu chuẩn: mục `dijkstra` trong lib-graph-1.js. */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    {
      id: "kmp",
      name: "KMP",
      aliases: ["kmp", "knuth morris pratt", "prefix function", "hàm tiền tố", "hàm lỗi", "failure function", "tìm mẫu trong xâu", "string matching", "border", "chu kỳ xâu", "period"],
      category: "string",
      sub: "So khớp mẫu",
      level: 2,
      tags: ["string", "string-matching", "prefix-function", "border", "period"],
      summary: "Tìm mọi vị trí xuất hiện của một mẫu trong văn bản trong O(N+M) nhờ hàm tiền tố; đồng thời cho ra mọi border và chu kỳ của xâu.",
      description:
        "**Hàm tiền tố** `pi[i]` là độ dài **border** dài nhất của `s[0..i]`: tiền tố thật sự của `s[0..i]` đồng thời là hậu tố của nó. Border là mấu chốt: khi gặp ký tự lệch, thay vì lùi con trỏ văn bản, ta rút phần đã khớp về border dài nhất của nó (`k = pi[k-1]`) — phần đó vẫn là tiền tố của mẫu và vẫn khớp với đuôi văn bản vừa đọc.\n\n" +
        "Mỗi ký tự văn bản làm `k` tăng tối đa 1, mỗi lần lùi làm `k` giảm ít nhất 1 mà `k ≥ 0`, nên tổng số lần lùi không vượt tổng số lần tăng: **O(N+M)** theo phân tích khấu hao. Mẫu chỉ được tiền xử lý một lần; có thể dùng lại `pi` cho nhiều văn bản.\n\n" +
        "**Liên hệ border – chu kỳ**: xâu `s` độ dài `n` có chu kỳ `p` (`s[i] = s[i+p]` với mọi `i` hợp lệ) khi và chỉ khi `s` có border độ dài `n − p`. Vì vậy chu kỳ nhỏ nhất là `n − pi[n−1]`, và mọi border liệt kê được bằng chuỗi `pi[n−1], pi[pi[n−1]−1], …` cho tới 0. Xâu là lặp trọn vẹn của một khối ngắn hơn khi `p = n − pi[n−1]` chia hết `n` và `p < n`.",
      conditions: ["Chỉ cần so sánh bằng nhau từng ký tự, nên dùng được với bảng chữ cái bất kỳ (kể cả mảng số nguyên)", "Một mẫu, một (hoặc vài) văn bản; mẫu được tiền xử lý một lần"],
      complexity: { time: "O(N + M)", space: "O(M)", note: "N = độ dài văn bản, M = độ dài mẫu. Hàm tiền tố của một xâu độ dài n tốn O(n)." },
      ops: [["Dựng hàm tiền tố", "O(M)"], ["Tìm mọi vị trí khớp", "O(N + M)"], ["Chu kỳ nhỏ nhất của xâu", "O(n)"], ["Liệt kê mọi border", "O(n)"]],
      use_case: ["Tìm mọi lần xuất hiện (kể cả chồng nhau) của một mẫu trong văn bản dài", "Tìm border, chu kỳ nhỏ nhất, kiểm tra xâu có phải lặp của một khối ngắn hơn", "Xây automaton KMP rồi quy hoạch động đếm xâu chứa / không chứa một mẫu cho trước"],
      not_for: ["Nhiều mẫu cùng lúc → Aho-Corasick (KMP tổng quát lên Trie)", "Hỏi so sánh / LCP của các xâu con bất kỳ nhiều lần → Rolling Hash hoặc Suffix Array", "Khớp có ký tự đại diện hoặc cho phép sai khác → FFT hoặc quy hoạch động (KMP không dùng được)"],
      pitfalls: [
        "Vòng `while` thiếu điều kiện `k > 0` làm truy cập `pi[-1]`; khi đã khớp trọn mẫu (`k == m`) phải lùi `k = pi[k-1]` trước khi so ký tự kế tiếp, nếu không sẽ đọc `p[m]` ngoài mẫu.",
        "Vị trí trả về là chỉ số ĐẦU của lần khớp (`i - m + 1`, 0-based), không phải chỉ số cuối `i`.",
        "Nếu ghép `p + '#' + t` rồi chạy hàm tiền tố, ký tự phân cách phải không xuất hiện trong `p` và `t`; nếu không, `pi` có thể vượt quá |p|.",
        "Chu kỳ nhỏ nhất `n − pi[n−1]` chưa chắc là khối lặp trọn vẹn: 'abcab' có chu kỳ nhỏ nhất 3 nhưng không phải lặp của 'abc'. Khi đề hỏi 'xâu có phải lặp lại một xâu ngắn hơn' phải kiểm tra thêm `n % p == 0`.",
        "Mẫu rỗng không có nghĩa rõ ràng (khớp ở mọi vị trí?) — mẫu trả về rỗng; tự quy ước theo đề."
      ],
      code: {
        lang: "cpp", title: "kmp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hàm tiền tố: pi[i] = độ dài border dài nhất (tiền tố thật sự đồng thời là hậu tố) của s[0..i]. Chỉ số 0-based. O(|s|).
vector<int> prefixFunction(const string& s) {
    int n = s.size();
    vector<int> pi(n, 0);
    for (int i = 1; i < n; i++) {
        int k = pi[i - 1];
        while (k > 0 && s[i] != s[k]) k = pi[k - 1];  // lùi về border ngắn hơn
        if (s[i] == s[k]) k++;
        pi[i] = k;
    }
    return pi;
}

// Mọi vị trí bắt đầu (0-based) mà mẫu p xuất hiện trong t, kể cả các lần chồng nhau. O(|t| + |p|).
// Mẫu rỗng hoặc dài hơn t -> không có vị trí nào (quy ước).
vector<int> kmpFind(const string& t, const string& p) {
    vector<int> res;
    int n = t.size(), m = p.size();
    if (m == 0 || m > n) return res;
    vector<int> pi = prefixFunction(p);
    for (int i = 0, k = 0; i < n; i++) {
        while (k > 0 && (k == m || t[i] != p[k])) k = pi[k - 1];  // k == m: vừa khớp trọn, lùi trước khi so tiếp
        if (t[i] == p[k]) k++;
        if (k == m) res.push_back(i - m + 1);
    }
    return res;
}

// Chu kỳ nhỏ nhất của s (0 nếu s rỗng): p nhỏ nhất sao cho s[i] == s[i + p] với mọi i hợp lệ.
// s lặp trọn vẹn khối s[0..p) khi p < n và n % p == 0.
int smallestPeriod(const string& s) {
    if (s.empty()) return 0;
    return (int)s.size() - prefixFunction(s).back();
}

// Mọi border thật sự của s, theo thứ tự giảm dần: pi[n-1], pi[pi[n-1]-1], ... (chu kỳ p <=> border n - p).
vector<int> allBorders(const string& s) {
    vector<int> pi = prefixFunction(s), res;
    for (int k = s.empty() ? 0 : pi.back(); k > 0; k = pi[k - 1]) res.push_back(k);
    return res;
}
`
      },
      example: {
        input: "abracadabra\nabra",
        output: "0 7",
        explain: "Văn bản 'abracadabra', mẫu 'abra' có hàm tiền tố [0, 0, 0, 1]. Mẫu khớp ở vị trí 0 và 7 (0-based). Sau lần khớp trọn đầu tiên, `k` lùi về pi[3] = 1 (border 'a') thay vì về 0, nên phần 'a' đã khớp được tận dụng."
      },
      problems: [
        { site: "cses", id: "1753", name: "String Matching" },
        { site: "cses", id: "1732", name: "Finding Borders" },
        { site: "cses", id: "1733", name: "Finding Periods" },
        { site: "cses", id: "1112", name: "Required Substring" },
        { site: "cf", id: "126B", name: "Password" }
      ],
      related: ["z-function", "aho-corasick", "rolling-hash", "suffix-array", "manacher"],
      compare: { "Bài toán giải": "Tìm một mẫu; border / chu kỳ", "Xây dựng": "O(M) (hàm tiền tố của mẫu)", "Truy vấn": "O(N) cho mỗi văn bản", "Bộ nhớ": "O(M)" },
      cards: [
        { q: "Hàm tiền tố pi[i] là gì?", a: "Độ dài border dài nhất của s[0..i]: tiền tố thật sự của s[0..i] đồng thời là hậu tố của nó (độ dài nhỏ hơn i+1)." },
        { q: "Vì sao KMP chạy O(N+M)?", a: "Mỗi ký tự văn bản làm k tăng tối đa 1; mỗi lần lùi k = pi[k-1] làm k giảm ít nhất 1 và k không âm, nên tổng số lần lùi ≤ tổng số lần tăng ≤ N (khấu hao)." },
        { q: "Lấy chu kỳ nhỏ nhất của xâu từ hàm tiền tố thế nào?", a: "p = n − pi[n−1]. Xâu là lặp trọn vẹn của khối p chỉ khi thêm điều kiện p < n và n chia hết cho p." },
        { q: "Liệt kê mọi border của s ra sao?", a: "Đi theo chuỗi pi[n−1], pi[pi[n−1]−1], … cho tới khi về 0; mỗi giá trị là độ dài một border." },
        { q: "Khi nào chuyển từ KMP sang Aho-Corasick?", a: "Khi có nhiều mẫu cùng lúc: Aho-Corasick là KMP tổng quát hoá lên Trie, vẫn O(N + tổng độ dài mẫu + số lần khớp) cho phần tìm." }
      ]
    },
    {
      id: "z-function",
      name: "Z-function",
      aliases: ["z function", "z algorithm", "z array", "mảng z", "thuật toán z", "tiền tố chung dài nhất", "lcp với tiền tố"],
      category: "string",
      sub: "So khớp mẫu",
      level: 2,
      tags: ["string", "string-matching", "z-function", "period", "lcp"],
      summary: "Với mỗi vị trí i, tính độ dài tiền tố chung dài nhất của xâu và hậu tố s[i..] trong O(n); dùng để tìm mẫu, tìm chu kỳ, so sánh với tiền tố.",
      description:
        "`z[i]` là độ dài tiền tố chung dài nhất của `s` và hậu tố `s[i..]` (quy ước `z[0] = n`). Thuật toán giữ **hộp Z** `[l, r)`: đoạn đã khớp với một tiền tố của `s` mà `r` xa nhất bên phải. Với `i` nằm trong hộp, `s[i..r)` trùng `s[i−l..r−l)` nên `z[i] ≥ min(r − i, z[i − l])`; chỉ phần vượt ra ngoài `r` mới phải so thêm từng ký tự, và mỗi lần so thành công đều đẩy `r` sang phải, nên tổng là **O(n)**.\n\n" +
        "Tìm mẫu `P` trong `T`: tính `z` của `P + '$' + T` rồi vị trí `i` của `T` khớp khi `z[|P| + 1 + i] ≥ |P|` (ký tự phân cách làm `z` không vượt quá |P|). Xâu có chu kỳ `p` khi và chỉ khi `p + z[p] = n`, nên chu kỳ nhỏ nhất là `p` nhỏ nhất thoả điều đó.\n\n" +
        "Z-function và hàm tiền tố (KMP) mang cùng lượng thông tin và đổi qua lại được trong O(n). Z trả lời 'tại mỗi vị trí, khớp với tiền tố bao nhiêu ký tự'; hàm tiền tố trả lời 'mỗi tiền tố có border dài nhất bao nhiêu'. Chọn cái hợp với cách đề phát biểu.",
      conditions: ["Chỉ cần so sánh bằng nhau từng ký tự", "Câu hỏi xoay quanh tiền tố của CHÍNH xâu đó (hoặc của mẫu khi ghép mẫu + ký tự phân cách + văn bản)"],
      complexity: { time: "O(n)", space: "O(n)", note: "Tìm mẫu qua xâu ghép: O(N + M) thời gian, O(N + M) bộ nhớ (KMP chỉ cần O(M))." },
      ops: [["Dựng mảng Z", "O(n)"], ["Tìm mọi vị trí của mẫu", "O(N + M)"], ["Chu kỳ nhỏ nhất", "O(n)"]],
      use_case: ["Tìm mẫu trong văn bản, gọn hơn KMP khi cần LCP với tiền tố", "Chu kỳ nhỏ nhất, kiểm tra xâu là lặp của khối ngắn hơn", "Đếm / liệt kê các hậu tố trùng tiền tố (border) bằng điều kiện i + z[i] = n", "Bài 'với mỗi i tính độ dài khớp với tiền tố'"],
      not_for: ["Nhiều mẫu cùng lúc → Aho-Corasick", "LCP của hai hậu tố bất kỳ → Suffix Array + LCP hoặc Rolling Hash", "Chỉ cần border của từng tiền tố → hàm tiền tố trong KMP viết trực tiếp hơn"],
      pitfalls: [
        "Thiếu `min` với `r − i` khi `i` nằm trong hộp Z: `z[i − l]` có thể kéo dài quá `r`, kết quả sai mà vẫn trông hợp lý.",
        "Phải kiểm tra `i + z[i] < n` TRƯỚC khi đọc `s[i + z[i]]`, nếu không đọc ngoài mảng.",
        "Quy ước `z[0]`: mẫu đặt `z[0] = n`, nhiều tài liệu để 0; vòng lặp bắt đầu từ 1 nên không ảnh hưởng, nhưng khi dùng `z[0]` trong công thức phải nhớ quy ước.",
        "Ký tự phân cách khi ghép `P + '$' + T` phải không xuất hiện trong P và T (mẫu dùng '\\0'); thiếu nó, `z` có thể vượt quá |P|.",
        "Chu kỳ nhỏ nhất `p` (thoả `p + z[p] = n`) chỉ là khối lặp trọn vẹn khi `n % p == 0`."
      ],
      code: {
        lang: "cpp", title: "z_function.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Mảng Z: z[i] = độ dài tiền tố chung dài nhất của s và s[i..]. Quy ước z[0] = n. O(n).
vector<int> zFunction(const string& s) {
    int n = s.size();
    vector<int> z(n, 0);
    if (n) z[0] = n;
    for (int i = 1, l = 0, r = 0; i < n; i++) {  // [l, r): đoạn khớp tiền tố, r xa nhất bên phải
        if (i < r) z[i] = min(r - i, z[i - l]);
        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) z[i]++;
        if (i + z[i] > r) l = i, r = i + z[i];
    }
    return z;
}

// Mọi vị trí bắt đầu (0-based) của mẫu p trong t. O(|t| + |p|).
// Ghép p + '\0' + t: ký tự '\0' không được xuất hiện trong p hoặc t. Mẫu rỗng -> không có vị trí nào (quy ước).
vector<int> zFind(const string& t, const string& p) {
    vector<int> res;
    int m = p.size();
    if (m == 0) return res;
    vector<int> z = zFunction(p + '\0' + t);
    for (int i = 0; i < (int)t.size(); i++)
        if (z[m + 1 + i] >= m) res.push_back(i);
    return res;
}

// Chu kỳ nhỏ nhất của s (p nhỏ nhất sao cho p + z[p] == n; trả n nếu không có chu kỳ ngắn hơn, 0 nếu s rỗng).
// s lặp trọn vẹn khối s[0..p) khi p < n và n % p == 0.
int smallestPeriod(const string& s) {
    int n = s.size();
    vector<int> z = zFunction(s);
    for (int p = 1; p < n; p++)
        if (p + z[p] == n) return p;
    return n;
}
`
      },
      example: {
        input: "aabcaab",
        output: "7 1 0 0 3 1 0",
        explain: "z[0] = 7 theo quy ước. Hậu tố 'abcaab' chung với 'aabcaab' đúng 1 ký tự ('a'), 'bcaab' và 'caab' không chung ký tự nào, 'aab' trùng trọn 3 ký tự đầu, 'ab' chung 1, 'b' chung 0. Vì 4 + z[4] = 7 nên xâu có chu kỳ 4 (border 'aab')."
      },
      problems: [
        { site: "cses", id: "1753", name: "String Matching" },
        { site: "cses", id: "1732", name: "Finding Borders" },
        { site: "cses", id: "1733", name: "Finding Periods" },
        { site: "cses", id: "2107", name: "String Functions" },
        { site: "cf", id: "126B", name: "Password" }
      ],
      related: ["kmp", "rolling-hash", "suffix-array", "aho-corasick"],
      compare: { "Bài toán giải": "Tìm một mẫu; LCP với tiền tố", "Xây dựng": "O(n)", "Truy vấn": "O(N + M) trên xâu ghép", "Bộ nhớ": "O(N + M)" },
      cards: [
        { q: "z[i] nghĩa là gì?", a: "Độ dài tiền tố chung dài nhất của s và hậu tố s[i..] (quy ước z[0] = n)." },
        { q: "Dùng Z-function tìm mẫu P trong T thế nào?", a: "Tính z của P + '$' + T. Vị trí i của T khớp khi z[|P| + 1 + i] ≥ |P|. Ký tự '$' không được xuất hiện trong P, T." },
        { q: "Chu kỳ nhỏ nhất của xâu theo Z?", a: "p nhỏ nhất (p ≥ 1) thoả p + z[p] = n. Lặp trọn vẹn khối p khi thêm điều kiện n chia hết cho p." },
        { q: "Tại sao Z-function là O(n)?", a: "r chỉ tăng; mỗi lần so ký tự thành công đẩy r sang phải, còn phần nằm trong hộp [l, r) được lấy từ z[i − l] mà không so lại." },
        { q: "Quan hệ giữa mảng Z và hàm tiền tố?", a: "Cùng thông tin, đổi qua lại được trong O(n); Z cho khớp tiền tố tại mỗi vị trí, hàm tiền tố cho border dài nhất của mỗi tiền tố." }
      ]
    },
    {
      id: "rolling-hash",
      name: "Hash xâu (Rolling Hash)",
      aliases: ["rolling hash", "polynomial hash", "hash đa thức", "băm xâu", "hash xâu con", "so sánh xâu con", "anti-hash", "karp rabin", "rabin karp", "thue-morse"],
      category: "string",
      sub: "Hash",
      level: 2,
      tags: ["string", "hash", "rolling-hash", "randomized", "substring-compare"],
      summary: "Biến xâu thành một số bằng hash đa thức để so sánh hai xâu con bất kỳ trong O(1) và tìm LCP bằng tìm nhị phân; đúng với xác suất cao, không tuyệt đối.",
      description:
        "Hash đa thức: `H(s) = Σ s[i]·B^(n−1−i) mod M`. Tính hash tiền tố `h[i]` một lần O(N); hash xâu con `[l, r)` là `h[r] − h[l]·B^(r−l)` (mod M). Nhờ đó **so sánh hai xâu con bất kỳ trong O(1)**, và tìm LCP của hai hậu tố bằng tìm nhị phân trên độ dài chung trong O(log N).\n\n" +
        "Hash là thuật toán **xác suất**: hai xâu bằng nhau luôn cùng hash, nhưng hai xâu khác nhau vẫn có thể trùng hash (**va chạm**). Với M nguyên tố và cơ số B chọn ngẫu nhiên, hai xâu khác nhau dài tối đa N va chạm với xác suất ≤ N/M. Mod đơn cỡ 10^9 là quá yếu: so sánh nhiều cặp thì nghịch lý ngày sinh khiến va chạm gần như chắc chắn. Nên dùng **mod 2^61−1** (số nguyên tố Mersenne, nhân bằng `__int128`) hoặc hai mod cỡ 10^9, cùng **cơ số ngẫu nhiên** chọn lúc chạy.\n\n" +
        "**Anti-hash**: cơ số và mod cố định bị đối thủ dựng test va chạm (trên Codeforces người ta hack bằng cách này). Hash theo mod 2^64 bằng cách để số nguyên tràn tự nhiên bị phá bằng xâu **Thue–Morse**: xâu Thue–Morse dài 2^10 và xâu bù của nó có hash trùng nhau với MỌI cơ số lẻ; cơ số chẵn còn tệ hơn vì chỉ 64 ký tự cuối ảnh hưởng tới hash.",
      conditions: ["Xâu không đổi, hoặc có cập nhật điểm nhưng kết hợp được với Fenwick / Segment Tree (hash là tổng có trọng số)", "Chấp nhận kết quả đúng với xác suất cao (không dùng được khi cần chắc chắn tuyệt đối)", "Cơ số chọn ngẫu nhiên lúc chạy, nhỏ hơn M và lớn hơn kích thước bảng chữ cái"],
      complexity: { time: "O(N) dựng + O(1) mỗi lần so sánh", space: "O(N)", note: "LCP hai hậu tố: O(log N) mỗi truy vấn. Xác suất va chạm một cặp xâu khác nhau ≤ N/M với M nguyên tố và cơ số ngẫu nhiên." },
      ops: [["Dựng hash tiền tố", "O(N)"], ["Hash một xâu con", "O(1)"], ["So sánh hai xâu con", "O(1)"], ["LCP hai hậu tố (tìm nhị phân)", "O(log N)"]],
      use_case: ["So sánh xâu con nhiều lần trên xâu cố định (hai xâu con có bằng nhau không?)", "Tìm xâu con lặp dài nhất, xâu con chung dài nhất bằng tìm nhị phân độ dài + bảng băm", "Kiểm tra palindrome xâu con (hash xuôi và hash ngược), kể cả khi có cập nhật từng ký tự nhờ Fenwick Tree", "Phát hiện xâu trùng lặp: đưa hash của cả tập xâu vào bảng băm"],
      not_for: ["Cần kết quả chắc chắn tuyệt đối → KMP / Z / Suffix Array", "Chỉ khớp một mẫu một lần → KMP / Z đơn giản và tất định", "Cần thứ tự từ điển của các xâu con hoặc đếm xâu con phân biệt có thứ tự → Suffix Array / Suffix Automaton"],
      pitfalls: [
        "Hash mod 2^64 (để unsigned tràn số) bị phá bằng xâu Thue–Morse với mọi cơ số: không dùng khi bài có thể bị hack hoặc có test đối kháng.",
        "Một mod cỡ 10^9+7 mà so sánh nhiều cặp xâu con: va chạm gần như chắc chắn khi có cỡ 10^5 xâu con (nghịch lý ngày sinh). Dùng 2^61−1 hoặc hai mod.",
        "Cơ số cố định (31, 131, 911382323…) bị hack trên Codeforces; luôn lấy cơ số ngẫu nhiên theo thời gian lúc chạy.",
        "Dùng `c - 'a'` (có thể bằng 0) làm giá trị ký tự thì 'a' và 'aa' đều có hash 0. Mẫu dùng `s[i] + 1` để mọi ký tự khác 0.",
        "Quên cộng MOD trước khi trừ trong `h[r] − h[l]·B^(r−l)` cho kết quả âm hoặc sai.",
        "`__int128` là phần mở rộng của GCC/Clang 64-bit, MSVC không có; khi đó dùng hai mod cỡ 10^9 với nhân bằng `long long`.",
        "Hash khác nhau thì chắc chắn xâu khác nhau; hash bằng nhau chỉ là 'rất có thể' bằng. Khi cần chắc chắn, kiểm lại bằng so sánh ký tự."
      ],
      code: {
        lang: "cpp", title: "rolling_hash.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hash đa thức theo mod 2^61 - 1 với cơ số ngẫu nhiên: so sánh xâu con O(1), LCP hai hậu tố O(log N).
// Xâu con [l, r) 0-based, nửa mở. Cần __int128 (GCC/Clang 64-bit). Kết quả đúng với xác suất cao (không tuyệt đối).
struct RollingHash {
    typedef unsigned long long u64;
    static constexpr u64 MOD = (1ULL << 61) - 1;
    static u64 mul(u64 a, u64 b) {
        __uint128_t t = (__uint128_t)a * b;
        u64 r = (u64)(t & MOD) + (u64)(t >> 61);  // 2^61 ≡ 1 (mod MOD)
        return r >= MOD ? r - MOD : r;
    }
    static u64 randomBase() {  // cơ số ngẫu nhiên trong [500, MOD - 500)
        static mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());
        return rng() % (MOD - 1000) + 500;
    }
    int n;
    vector<u64> h, pw;  // h[i] = hash của s[0..i), pw[i] = B^i
    RollingHash(const string& s, u64 base = randomBase()) : n(s.size()), h(n + 1, 0), pw(n + 1, 1) {
        for (int i = 0; i < n; i++) {
            h[i + 1] = mul(h[i], base) + (unsigned char)s[i] + 1;  // +1: ký tự khác 0
            if (h[i + 1] >= MOD) h[i + 1] -= MOD;
            pw[i + 1] = mul(pw[i], base);
        }
    }
    u64 get(int l, int r) const {  // hash của s[l..r)
        u64 x = h[r] + MOD - mul(h[l], pw[r - l]);
        return x >= MOD ? x - MOD : x;
    }
    bool equal(int l1, int r1, int l2, int r2) const {  // s[l1..r1) == s[l2..r2) ?
        return r1 - l1 == r2 - l2 && get(l1, r1) == get(l2, r2);
    }
    int lcp(int i, int j) const {  // LCP của hậu tố bắt đầu tại i và tại j
        int lo = 0, hi = n - max(i, j);
        while (lo < hi) {
            int mid = (lo + hi + 1) / 2;
            if (get(i, i + mid) == get(j, j + mid)) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }
};
`
      },
      example: {
        input: "abracadabra\nequal 0 4 7 11\nlcp 0 7",
        output: "true\n4",
        explain: "Xâu 'abracadabra'. Hai xâu con [0,4) = 'abra' và [7,11) = 'abra' có cùng độ dài và cùng hash nên bằng nhau (true). Hai hậu tố bắt đầu tại 0 và tại 7 chung tiền tố 'abra' dài 4 (ký tự kế tiếp là 'c' và hết xâu nên dừng)."
      },
      problems: [
        { site: "cses", id: "1753", name: "String Matching" },
        { site: "cses", id: "1732", name: "Finding Borders" },
        { site: "cses", id: "2420", name: "Palindrome Queries" },
        { site: "cses", id: "2106", name: "Repeating Substring" }
      ],
      related: ["kmp", "z-function", "suffix-array", "manacher", "fenwick-tree", "binary-search"],
      compare: { "Bài toán giải": "So sánh xâu con (xác suất)", "Xây dựng": "O(N)", "Truy vấn": "O(1) so sánh hai xâu con; O(log N) tìm LCP", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "Công thức hash của xâu con [l, r) từ hash tiền tố?", a: "get(l, r) = h[r] − h[l]·B^(r−l) mod M (nhớ cộng M trước khi trừ để không âm)." },
        { q: "Vì sao không nên dùng hash mod 2^64 bằng cách để số nguyên tràn?", a: "Xâu Thue–Morse dài 2^10 và xâu bù của nó có hash trùng nhau với mọi cơ số lẻ; bài có hack sẽ bị phá." },
        { q: "Lựa chọn mod và cơ số an toàn?", a: "Mod 2^61−1 (nhân bằng __int128) hoặc hai mod cỡ 10^9, cùng cơ số ngẫu nhiên chọn lúc chạy." },
        { q: "Hash sai theo hướng nào?", a: "Một chiều: hai xâu bằng nhau luôn cùng hash, nhưng hai xâu khác nhau có thể trùng hash (va chạm)." },
        { q: "Tìm LCP của hai hậu tố bằng hash thế nào?", a: "Tìm nhị phân độ dài chung: hai đoạn cùng độ dài có hash bằng nhau thì thử dài hơn; tổng O(log N)." }
      ]
    },
    {
      id: "trie",
      name: "Trie",
      aliases: ["trie", "prefix tree", "cây tiền tố", "digital tree", "từ điển", "tự động gợi ý", "autocomplete", "radix tree"],
      category: "string",
      sub: "Cây tiền tố (Trie)",
      level: 1,
      tags: ["string", "trie", "prefix-tree", "dictionary", "data-structure"],
      summary: "Cây gốc mà mỗi cạnh là một ký tự, cho phép chèn, tìm, xoá và đếm số từ theo tiền tố trong O(độ dài xâu), không phụ thuộc kích thước từ điển.",
      description:
        "**Trie** là cây gốc, mỗi cạnh gắn một ký tự; đường từ gốc tới một nút chính là một tiền tố, nút có thể đánh dấu là kết thúc của một (hoặc nhiều) từ. Chèn, tìm hoặc xoá một xâu tốn **O(|s|)** — không phụ thuộc số từ trong từ điển.\n\n" +
        "Mỗi nút giữ hai bộ đếm: `pass` (số từ đi qua nút, cũng là số từ có tiền tố này) và `end` (số từ kết thúc đúng tại nút). Nhờ đó `countPrefix` và `countWord` đều tốn O(|mẫu|), và xoá chỉ việc trừ bộ đếm dọc đường đi.\n\n" +
        "Biểu diễn các con: mảng `next[26]` (nhanh, tốn 26 số nguyên mỗi nút) hoặc `map` / vector cặp (tiết kiệm khi bảng chữ cái lớn). Trie là nền của **Aho-Corasick** (thêm link suffix) và của **Binary Trie** (khoá là các bit, dùng cho XOR lớn nhất).",
      conditions: ["Truy vấn xoay quanh TIỀN TỐ của các xâu trong một tập", "Bảng chữ cái nhỏ (hoặc chấp nhận biểu diễn con bằng map)"],
      complexity: { time: "O(|s|) mỗi thao tác", space: "O(tổng độ dài · |Σ|)", note: "Số nút tối đa = tổng độ dài các xâu + 1. Dạng mảng tốn |Σ| số nguyên mỗi nút; dạng map chỉ tốn cho cạnh có thật nhưng chậm hơn (thêm log |Σ|)." },
      ops: [["Chèn một xâu", "O(|s|)"], ["Tìm / đếm một từ", "O(|s|)"], ["Đếm số từ có tiền tố cho trước", "O(|s|)"], ["Xoá một xâu", "O(|s|)"]],
      use_case: ["Từ điển, gợi ý tự động theo tiền tố, đếm số từ bắt đầu bằng một tiền tố", "Tiền tố chung dài nhất của một tập xâu", "Quy hoạch động trên từ điển (tách từ: dp[i] dùng các từ khớp bắt đầu tại i)", "Nền để dựng Aho-Corasick hoặc Binary Trie"],
      not_for: ["Tìm một mẫu trong văn bản dài → KMP / Z", "Hỏi về xâu con bất kỳ (không chỉ tiền tố) → Suffix Array / Suffix Automaton", "Bộ nhớ chặt, bảng chữ cái lớn, từ điển cố định → sắp xếp các từ rồi tìm nhị phân, hoặc trie dùng map"],
      pitfalls: [
        "Mỗi nút dạng mảng tốn 112 byte (26 chỉ số int + 2 bộ đếm): 10^6 nút ≈ 112 MB, dễ vượt giới hạn bộ nhớ — dùng bảng chữ cái nhỏ hơn hoặc map.",
        "Nhầm hai bộ đếm: `pass` đếm các từ đi qua (tiền tố), `end` đếm các từ kết thúc tại nút; lẫn lộn làm `countPrefix` và `countWord` sai.",
        "Xoá chỉ giảm bộ đếm, không giải phóng nút; nếu cần thu hồi bộ nhớ thật sự thì phải tự cài thêm.",
        "Từ rỗng nằm ở gốc (`end` của gốc); `countPrefix(\"\")` bằng tổng số từ — dễ bỏ sót khi tự cài.",
        "Ký tự ngoài 'a'..'z' làm chỉ số ra ngoài mảng; đổi `A` và phép trừ khi bảng chữ cái khác (chữ hoa, chữ số, bit)."
      ],
      code: {
        lang: "cpp", title: "trie.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Trie cho chữ thường 'a'..'z' (A = 26; đổi A và phép trừ 'a' nếu bảng chữ cái khác). Cho phép từ trùng và từ rỗng.
// pass = số từ đi qua nút (= số từ có tiền tố là xâu của nút), end = số từ kết thúc đúng tại nút. Mỗi thao tác O(|s|).
struct Trie {
    static const int A = 26;
    struct Node {
        int next[A];
        int pass = 0, end = 0;
        Node() { fill(next, next + A, -1); }
    };
    vector<Node> t;
    Trie() : t(1) {}

    void insert(const string& s) {
        int v = 0;
        t[0].pass++;
        for (char ch : s) {
            int c = ch - 'a';
            if (t[v].next[c] < 0) {
                int u = t.size();
                t.emplace_back();
                t[v].next[c] = u;
            }
            v = t[v].next[c];
            t[v].pass++;
        }
        t[v].end++;
    }
    int find(const string& s) const {  // nút ứng với s, hoặc -1 nếu không có
        int v = 0;
        for (char ch : s) {
            v = t[v].next[ch - 'a'];
            if (v < 0) return -1;
        }
        return v;
    }
    int countWord(const string& s) const {  // số lần s đã được thêm
        int v = find(s);
        return v < 0 ? 0 : t[v].end;
    }
    int countPrefix(const string& s) const {  // số từ có tiền tố s
        int v = find(s);
        return v < 0 ? 0 : t[v].pass;
    }
    bool erase(const string& s) {  // xoá MỘT bản sao của s; false nếu s không có (nút không bị giải phóng)
        if (countWord(s) == 0) return false;
        int v = 0;
        t[0].pass--;
        for (char ch : s) {
            v = t[v].next[ch - 'a'];
            t[v].pass--;
        }
        t[v].end--;
        return true;
    }
};
`
      },
      example: {
        input: "4\ncat\ncar\ncart\ndog\n3\nprefix car\nprefix ca\nword car",
        output: "2\n3\n1",
        explain: "Từ điển {cat, car, cart, dog}. Có 2 từ bắt đầu bằng 'car' (car, cart), 3 từ bắt đầu bằng 'ca' (cat, car, cart), và đúng 1 từ là 'car'."
      },
      problems: [
        { site: "cses", id: "1731", name: "Word Combinations" },
        { site: "lc", name: "Implement Trie (Prefix Tree)" },
        { site: "lc", name: "Word Search II" }
      ],
      related: ["aho-corasick", "xor-trie", "suffix-array", "suffix-automaton", "kmp", "binary-search"],
      compare: { "Bài toán giải": "Từ điển, truy vấn theo tiền tố", "Xây dựng": "O(tổng độ dài)", "Truy vấn": "O(|mẫu|)", "Bộ nhớ": "O(tổng độ dài · |Σ|) khi dùng mảng" },
      cards: [
        { q: "Độ phức tạp chèn / tìm một xâu trong Trie?", a: "O(|s|), độc lập với số từ trong từ điển." },
        { q: "Làm sao đếm số từ có tiền tố p trong O(|p|)?", a: "Mỗi nút giữ bộ đếm pass (số từ đi qua). Đi theo p tới nút cuối rồi lấy pass của nút đó." },
        { q: "Trie dạng mảng next[26] tốn bao nhiêu bộ nhớ?", a: "O(số nút · 26) số nguyên; số nút ≤ tổng độ dài các từ + 1. Với bảng chữ cái lớn nên dùng map." },
        { q: "Trie liên hệ thế nào với Aho-Corasick?", a: "Aho-Corasick là Trie của các mẫu cộng thêm link suffix, để quét một văn bản tìm đồng thời mọi mẫu." }
      ]
    },
    {
      id: "aho-corasick",
      name: "Aho-Corasick",
      aliases: ["aho corasick", "aho-corasick automaton", "ac automaton", "tìm nhiều mẫu", "multi pattern matching", "suffix link", "dictionary link", "failure link"],
      category: "string",
      sub: "Cây tiền tố (Trie)",
      level: 4,
      tags: ["string", "trie", "automaton", "multi-pattern", "string-matching"],
      summary: "Dựng automaton từ Trie của nhiều mẫu để quét văn bản một lần, đếm hoặc liệt kê mọi lần xuất hiện của mọi mẫu trong O(N + tổng độ dài mẫu + số lần khớp).",
      description:
        "**Aho-Corasick** ghép các mẫu vào một Trie rồi thêm **link suffix** `link[v]`: nút ứng với hậu tố dài nhất (thật sự) của xâu `v` mà cũng là tiền tố của một mẫu. Link tính bằng BFS, giống cách KMP tính hàm tiền tố nhưng trên Trie. Gộp luôn các bước đi theo link vào bảng chuyển `go[v][c]` để mỗi ký tự văn bản tốn đúng O(1).\n\n" +
        "Có hai cách thu kết quả. **Đếm** số lần mỗi mẫu xuất hiện: đếm số lần đi vào mỗi nút rồi cộng dồn theo cây link theo thứ tự BFS ngược (mỗi mẫu là hậu tố của mọi xâu nút nằm trong cây con của nó) — O(N + tổng mẫu). **Liệt kê** từng lần khớp: tại mỗi vị trí, đi theo **link từ điển** `dict[v]` (nút kết thúc mẫu gần nhất trên chuỗi link) — O(1) cho mỗi lần khớp được in.\n\n" +
        "Số lần khớp có thể lớn: mỗi vị trí khớp tối đa một mẫu cho mỗi độ dài mẫu, mà tổng các độ dài phân biệt ≤ L (tổng độ dài mẫu), nên tổng số khớp tối đa cỡ N·√L. Nếu chỉ cần đếm thì đừng liệt kê.",
      conditions: ["Tập mẫu biết trước và cố định trước khi quét văn bản", "Mọi mẫu khác rỗng", "Bảng chữ cái nhỏ (hoặc chấp nhận dùng map và thêm hệ số log)"],
      complexity: { time: "O(L·|Σ| + N + số lần khớp)", space: "O(L·|Σ|)", note: "L = tổng độ dài các mẫu, N = độ dài văn bản. Chỉ đếm (không liệt kê) thì bỏ số hạng số lần khớp." },
      ops: [["Thêm một mẫu (trước build)", "O(|mẫu|)"], ["Dựng automaton", "O(L·|Σ|)"], ["Đếm số lần mỗi mẫu xuất hiện", "O(N + L)"], ["Liệt kê mọi lần khớp", "O(N + số lần khớp)"]],
      use_case: ["Tìm hoặc đếm nhiều mẫu cùng lúc trong một văn bản", "Lọc từ cấm, nhận diện từ khoá trên luồng ký tự (mỗi ký tự O(1))", "Quy hoạch động trên automaton: đếm xâu độ dài n chứa hoặc không chứa các mẫu cho trước", "Tìm mọi từ của một từ điển xuất hiện trong văn bản"],
      not_for: ["Chỉ một mẫu → KMP / Z gọn hơn", "Văn bản cố định và các mẫu đến sau từng cái một → Suffix Array / Suffix Automaton của văn bản", "Khớp có ký tự đại diện hoặc cho phép sai khác → FFT / quy hoạch động"],
      pitfalls: [
        "Phải gọi `build()` sau khi thêm hết mẫu và trước khi quét; thêm mẫu sau build làm `go` và `link` sai.",
        "Mẫu trùng nhau rơi vào cùng nút; mẫu lưu danh sách chỉ số mẫu theo nút để cả hai đều được đếm / liệt kê.",
        "Mẫu rỗng không được hỗ trợ (số lần xuất hiện của xâu rỗng không có nghĩa rõ ràng).",
        "Số lần khớp có thể rất lớn (cỡ N·√L): đừng nhét mọi khớp vào vector nếu chỉ cần đếm; dùng `countAll` với `long long`.",
        "Quên cộng dồn theo link suffix: chỉ đếm số lần ĐI VÀO nút sẽ bỏ sót các mẫu là hậu tố của xâu nút đó.",
        "Bộ nhớ L·|Σ|·4 byte: L = 10^6 với 26 chữ cái ≈ 104 MB; giảm bằng bảng chữ cái nhỏ hơn hoặc map."
      ],
      code: {
        lang: "cpp", title: "aho_corasick.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Aho-Corasick: Trie của các mẫu + link suffix; gộp bước đi theo link vào go[v][c] nên mỗi ký tự văn bản O(1).
// Bảng chữ cái 'a'..'z' (đổi A và phép trừ 'a' nếu khác). Mẫu phải khác rỗng. Gọi build() sau khi add hết mẫu.
struct AhoCorasick {
    static const int A = 26;
    vector<array<int, A>> go;  // go[v][c]: nút kế tiếp khi đang ở v và đọc c (sau build: đã gộp link suffix)
    vector<int> link;          // link[v]: nút của hậu tố dài nhất (thật sự) của v mà cũng là tiền tố của một mẫu
    vector<int> dict;          // dict[v]: nút kết thúc mẫu gần nhất trên chuỗi link của v (không tính v), -1 nếu không có
    vector<vector<int>> ids;   // ids[v]: các chỉ số mẫu kết thúc đúng tại v (mẫu trùng nhau cùng một nút)
    vector<int> patNode;       // patNode[i]: nút kết thúc của mẫu i
    vector<int> order;         // các nút (trừ gốc) theo thứ tự BFS

    AhoCorasick() { newNode(); }
    int newNode() {
        go.emplace_back();
        go.back().fill(-1);
        link.push_back(0);
        dict.push_back(-1);
        ids.emplace_back();
        return (int)go.size() - 1;
    }
    int add(const string& s) {  // thêm mẫu, trả về chỉ số mẫu (0, 1, 2, ...)
        int v = 0;
        for (char ch : s) {
            int c = ch - 'a';
            if (go[v][c] < 0) {
                int u = newNode();
                go[v][c] = u;
            }
            v = go[v][c];
        }
        ids[v].push_back(patNode.size());
        patNode.push_back(v);
        return (int)patNode.size() - 1;
    }
    void build() {  // BFS: tính link, dict và hoàn thiện go
        order.clear();
        queue<int> q;
        for (int c = 0; c < A; c++) {
            int u = go[0][c];
            if (u < 0) go[0][c] = 0;
            else q.push(u);  // con của gốc: link = 0, dict = -1 (đã là giá trị mặc định)
        }
        while (!q.empty()) {
            int v = q.front();
            q.pop();
            order.push_back(v);
            for (int c = 0; c < A; c++) {
                int u = go[v][c];
                if (u < 0) {
                    go[v][c] = go[link[v]][c];
                } else {
                    link[u] = go[link[v]][c];
                    dict[u] = ids[link[u]].empty() ? dict[link[u]] : link[u];
                    q.push(u);
                }
            }
        }
    }
    // Số lần mỗi mẫu xuất hiện trong t (kể cả chồng nhau). O(|t| + số nút).
    vector<long long> countAll(const string& t) const {
        vector<long long> cnt(go.size(), 0);
        int v = 0;
        for (char ch : t) {
            v = go[v][ch - 'a'];
            cnt[v]++;
        }
        for (int i = (int)order.size() - 1; i >= 0; i--) cnt[link[order[i]]] += cnt[order[i]];  // cộng dồn theo cây link
        vector<long long> res(patNode.size());
        for (size_t i = 0; i < patNode.size(); i++) res[i] = cnt[patNode[i]];
        return res;
    }
    // Mọi lần khớp: (chỉ số kết thúc trong t, chỉ số mẫu). O(|t| + số lần khớp).
    vector<pair<int, int>> findAll(const string& t) const {
        vector<pair<int, int>> res;
        int v = 0;
        for (int i = 0; i < (int)t.size(); i++) {
            v = go[v][t[i] - 'a'];
            for (int u = ids[v].empty() ? dict[v] : v; u >= 0; u = dict[u])
                for (int id : ids[u]) res.push_back({i, id});
        }
        return res;
    }
};
`
      },
      example: {
        input: "4\nhe\nshe\nhis\nhers\nushers",
        output: "1 1 0 1",
        explain: "Bốn mẫu he, she, his, hers; văn bản 'ushers'. Mẫu 'she' khớp ở vị trí 1..3, 'he' ở 2..3, 'hers' ở 2..5 (0-based); 'his' không xuất hiện. Kết quả đếm theo thứ tự mẫu: 1 1 0 1. Lần khớp 'she' tại vị trí kết thúc 3 còn kéo theo 'he' nhờ link từ điển."
      },
      problems: [
        { site: "cses", id: "2102", name: "Finding Patterns" },
        { site: "cses", id: "2103", name: "Counting Patterns" },
        { site: "cses", id: "1112", name: "Required Substring" }
      ],
      related: ["kmp", "trie", "suffix-automaton", "suffix-array", "z-function"],
      compare: { "Bài toán giải": "Tìm nhiều mẫu cùng lúc", "Xây dựng": "O(tổng độ dài mẫu · |Σ|)", "Truy vấn": "O(N + số lần khớp) cho cả văn bản", "Bộ nhớ": "O(tổng độ dài mẫu · |Σ|)" },
      cards: [
        { q: "Link suffix của nút v là gì?", a: "Nút ứng với hậu tố dài nhất (thật sự) của xâu v mà cũng là tiền tố của một mẫu; tính bằng BFS như hàm tiền tố trên Trie." },
        { q: "Link từ điển (dictionary link) dùng để làm gì?", a: "Nhảy thẳng tới nút kết thúc mẫu gần nhất trên chuỗi link suffix, để liệt kê mọi mẫu kết thúc tại một vị trí mà chỉ tốn O(1) cho mỗi lần khớp." },
        { q: "Đếm số lần mỗi mẫu xuất hiện bằng Aho-Corasick ra sao?", a: "Đếm số lần đi vào mỗi nút khi quét văn bản, rồi cộng dồn cnt[link[v]] += cnt[v] theo thứ tự BFS ngược; đáp án của mẫu i là cnt tại nút kết thúc của nó." },
        { q: "Khi nào số lần khớp lớn và phải tránh liệt kê?", a: "Có thể tới cỡ N·√L (mỗi vị trí khớp tối đa một mẫu mỗi độ dài). Nếu chỉ cần số lần thì dùng đếm cộng dồn." },
        { q: "Chi phí dựng automaton đầy đủ?", a: "O(L·|Σ|) thời gian và bộ nhớ với L là tổng độ dài các mẫu." }
      ]
    },
    {
      id: "suffix-array",
      name: "Suffix Array + LCP",
      aliases: ["suffix array", "sa", "mảng hậu tố", "lcp array", "kasai", "mảng lcp", "xâu con phân biệt", "distinct substrings", "xâu con lặp dài nhất", "longest repeated substring"],
      category: "string",
      sub: "Hậu tố",
      level: 4,
      tags: ["string", "suffix-array", "lcp", "substring", "sorting"],
      summary: "Sắp xếp mọi hậu tố của xâu theo thứ tự từ điển (O(N log N)) kèm mảng LCP (Kasai, O(N)) để đếm xâu con phân biệt, tìm mẫu, tìm xâu con lặp dài nhất.",
      description:
        "**Suffix Array** `sa` là danh sách vị trí đầu của mọi hậu tố, xếp theo thứ tự từ điển của hậu tố. Dựng bằng **nhân đôi**: sau vòng `k`, các hậu tố đã xếp theo `2^k` ký tự đầu; vòng sau xếp theo cặp (hạng của `2^k` ký tự đầu, hạng của `2^k` ký tự kế tiếp) bằng counting sort hai lượt. Mỗi vòng O(N), có log N vòng nên **O(N log N)** (dùng `std::sort` cho cặp thì O(N log² N), dễ viết hơn nhưng chậm hơn). Có thuật toán O(N) (SA-IS) nhưng phức tạp, hiếm khi cần.\n\n" +
        "**Mảng LCP**: `lcp[i]` là độ dài tiền tố chung của hai hậu tố kề nhau `sa[i−1]` và `sa[i]`. **Kasai** tính trong O(N) nhờ nhận xét: nếu hậu tố `i` có LCP `h` với hậu tố đứng ngay trước nó trong thứ tự, thì hậu tố `i+1` có LCP ≥ `h − 1` với hậu tố đứng ngay trước nó. LCP của hai hậu tố bất kỳ là min của `lcp` trên đoạn tương ứng (hỏi bằng Sparse Table).\n\n" +
        "Từ hai mảng này: **số xâu con phân biệt** = N(N+1)/2 − Σ lcp; **xâu con lặp dài nhất** = max lcp; **tìm mẫu** P bằng tìm nhị phân trên `sa` trong O(|P| log N) vì mọi hậu tố bắt đầu bằng P tạo thành một khoảng liên tiếp; **xâu con chung dài nhất** của hai xâu bằng cách ghép chúng với một ký tự phân cách.",
      conditions: ["Xâu cố định (offline) và cần trả lời nhiều truy vấn về xâu con / hậu tố", "Ký tự so sánh được với nhau (mảng số nguyên dùng được sau khi nén toạ độ)"],
      complexity: { time: "O(N log N) dựng + O(N) LCP", space: "O(N)", note: "Tìm một mẫu P: O(|P| log N). LCP của hai hậu tố bất kỳ: O(1) sau khi dựng Sparse Table trên lcp (tốn thêm O(N log N) bộ nhớ)." },
      ops: [["Dựng Suffix Array (nhân đôi + counting sort)", "O(N log N)"], ["Dựng LCP (Kasai)", "O(N)"], ["Tìm một mẫu P", "O(|P| log N)"], ["LCP hai hậu tố bất kỳ (kèm Sparse Table)", "O(1)"], ["Đếm xâu con phân biệt", "O(N)"]],
      use_case: ["Đếm xâu con phân biệt, tìm xâu con lặp dài nhất, xâu con chung dài nhất của hai xâu", "Tìm mẫu, đếm số lần xuất hiện của các mẫu đến lần lượt (online) trên một xâu cố định", "Tìm xâu con nhỏ thứ k theo thứ tự từ điển", "So sánh hai xâu con bất kỳ theo thứ tự từ điển (kèm Sparse Table)"],
      not_for: ["Chỉ một mẫu cố định → KMP / Z", "Xâu bị cập nhật liên tục → Suffix Array là tĩnh; cân nhắc Rolling Hash kèm Segment Tree / Fenwick Tree", "Cần kiểm tra / đếm một mẫu trong O(|P|) và có thể đủ bộ nhớ → Suffix Automaton"],
      pitfalls: [
        "Mảng `lcp` có nhiều quy ước (kích thước N hay N−1, lcp[i] giữa i và i−1 hay giữa i và i+1). Mẫu: kích thước N, `lcp[0] = 0`, `lcp[i]` = LCP(sa[i−1], sa[i]).",
        "Kasai: đặt `h = 0` khi `rank[i] == 0` và giảm `h` đi 1 sau mỗi bước (khi h > 0); thiếu bước giảm làm thuật toán lùi về O(N²).",
        "Số xâu con phân biệt N(N+1)/2 vượt int khi N cỡ 6·10^4 trở lên — dùng long long.",
        "`char` có dấu phải ép `(unsigned char)` trước khi làm chỉ số counting sort, nếu không ký tự mã > 127 cho chỉ số âm.",
        "Hậu tố ngắn hơn `k` có khoá thứ hai rỗng và phải đứng TRƯỚC; cài kiểu xâu vòng thì phải thêm ký tự kết thúc nhỏ nhất rồi bỏ nó đi sau cùng.",
        "Mỗi bước tìm nhị phân tốn O(|P|) khi so sánh; tổng O(|P| log N) mỗi mẫu — nhiều mẫu rất dài và rất nhiều truy vấn thì cân nhắc Suffix Automaton."
      ],
      code: {
        lang: "cpp", title: "suffix_array.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Suffix Array bằng nhân đôi + counting sort: O(N log N). Trả về sa: sa[i] = vị trí đầu của hậu tố nhỏ thứ i (0-based).
vector<int> suffixArray(const string& s) {
    int n = s.size(), m = 256;  // m = số hạng (lớp) hiện có
    vector<int> sa(n), rk(n), tmp(n), cnt(max(n, m) + 1, 0);
    for (int i = 0; i < n; i++) cnt[rk[i] = (unsigned char)s[i]]++;
    for (int i = 1; i < m; i++) cnt[i] += cnt[i - 1];
    for (int i = n - 1; i >= 0; i--) sa[--cnt[rk[i]]] = i;
    for (int k = 1; k < n; k <<= 1) {
        int p = 0;  // xếp theo khoá thứ hai: hậu tố ngắn hơn k (khoá thứ hai rỗng) đứng trước
        for (int i = n - k; i < n; i++) tmp[p++] = i;
        for (int i = 0; i < n; i++)
            if (sa[i] >= k) tmp[p++] = sa[i] - k;
        fill(cnt.begin(), cnt.begin() + m, 0);  // rồi xếp ổn định theo khoá thứ nhất
        for (int i = 0; i < n; i++) cnt[rk[i]]++;
        for (int i = 1; i < m; i++) cnt[i] += cnt[i - 1];
        for (int i = n - 1; i >= 0; i--) sa[--cnt[rk[tmp[i]]]] = tmp[i];
        tmp[sa[0]] = 0;  // tính lại hạng
        p = 1;
        for (int i = 1; i < n; i++) {
            int a = sa[i - 1], b = sa[i];
            bool same = rk[a] == rk[b] && (a + k < n ? rk[a + k] : -1) == (b + k < n ? rk[b + k] : -1);
            tmp[b] = same ? p - 1 : p++;
        }
        swap(rk, tmp);
        m = p;
        if (m == n) break;  // mọi hạng đã khác nhau
    }
    return sa;
}

// lcp[i] = độ dài tiền tố chung của hậu tố sa[i-1] và sa[i] (lcp[0] = 0). Thuật toán Kasai, O(N).
vector<int> kasai(const string& s, const vector<int>& sa) {
    int n = s.size(), h = 0;
    vector<int> rk(n), lcp(n, 0);
    for (int i = 0; i < n; i++) rk[sa[i]] = i;
    for (int i = 0; i < n; i++) {
        if (rk[i] == 0) { h = 0; continue; }
        int j = sa[rk[i] - 1];
        while (i + h < n && j + h < n && s[i + h] == s[j + h]) h++;
        lcp[rk[i]] = h;
        if (h > 0) h--;  // hậu tố i+1 có LCP >= h - 1
    }
    return lcp;
}

// Số xâu con phân biệt = N(N+1)/2 - tổng lcp.
long long distinctSubstrings(const string& s, const vector<int>& lcp) {
    long long n = s.size(), total = n * (n + 1) / 2;
    for (int x : lcp) total -= x;
    return total;
}

// Khoảng [lo, hi) các chỉ số của sa mà hậu tố tương ứng bắt đầu bằng p. Số lần p xuất hiện = hi - lo. O(|p| log N).
pair<int, int> saRange(const string& s, const vector<int>& sa, const string& p) {
    int m = p.size();
    auto lo = partition_point(sa.begin(), sa.end(), [&](int pos) { return s.compare(pos, m, p) < 0; });
    auto hi = partition_point(sa.begin(), sa.end(), [&](int pos) { return s.compare(pos, m, p) <= 0; });
    return {int(lo - sa.begin()), int(hi - sa.begin())};
}
`
      },
      example: {
        input: "banana",
        output: "sa = 5 3 1 0 4 2\nlcp = 0 1 3 0 0 2\nsố xâu con phân biệt = 15",
        explain: "Các hậu tố theo thứ tự: a(5), ana(3), anana(1), banana(0), na(4), nana(2). LCP kề nhau: a/ana = 1, ana/anana = 3, anana/banana = 0, banana/na = 0, na/nana = 2. Số xâu con phân biệt = 6·7/2 − (1+3+0+0+2) = 21 − 6 = 15."
      },
      problems: [
        { site: "cses", id: "2105", name: "Distinct Substrings" },
        { site: "cses", id: "2106", name: "Repeating Substring" },
        { site: "cses", id: "2108", name: "Substring Order I" },
        { site: "cses", id: "2103", name: "Counting Patterns" },
        { site: "cses", id: "2104", name: "Pattern Positions" }
      ],
      related: ["suffix-automaton", "kmp", "z-function", "rolling-hash", "sparse-table", "manacher", "trie"],
      compare: { "Bài toán giải": "Sắp xếp hậu tố; đếm và so sánh xâu con", "Xây dựng": "O(N log N)", "Truy vấn": "O(|P| log N) tìm mẫu; O(1) LCP (kèm Sparse Table)", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "Cách dựng Suffix Array trong O(N log N)?", a: "Nhân đôi: xếp hậu tố theo 1, 2, 4, … ký tự đầu; mỗi vòng xếp theo cặp hạng (counting sort hai lượt) trong O(N), log N vòng." },
        { q: "Công thức đếm xâu con phân biệt từ SA + LCP?", a: "N(N+1)/2 − Σ lcp[i]. Mỗi hậu tố đóng góp (độ dài − lcp với hậu tố đứng trước) xâu con mới." },
        { q: "Ý tưởng của Kasai?", a: "Nếu hậu tố i có LCP h với hậu tố đứng trước nó trong thứ tự thì hậu tố i+1 có LCP ≥ h − 1. Vì h giảm tối đa 1 mỗi bước và h ≤ N nên tổng số lần h tăng ≤ 2N: thuật toán O(N)." },
        { q: "Tìm mẫu P trong xâu bằng Suffix Array?", a: "Tìm nhị phân khoảng liên tiếp các hậu tố bắt đầu bằng P: O(|P| log N); số lần xuất hiện = độ dài khoảng." },
        { q: "LCP của hai hậu tố bất kỳ?", a: "Min của lcp trên khoảng thứ hạng giữa chúng (không tính đầu trái); hỏi O(1) bằng Sparse Table." }
      ]
    },
    {
      id: "manacher",
      name: "Manacher",
      aliases: ["manacher", "palindrome", "xâu đối xứng", "palindrome con", "longest palindromic substring", "palindrome dài nhất", "đếm palindrome"],
      category: "string",
      sub: "Đối xứng & dịch vòng",
      level: 3,
      tags: ["string", "palindrome", "manacher", "linear"],
      summary: "Tìm mọi palindrome con liên tiếp của xâu trong O(N): với mỗi tâm cho bán kính lớn nhất; dùng hỏi một đoạn có là palindrome, palindrome dài nhất, đếm palindrome.",
      description:
        "Manacher tính mọi palindrome con trong **O(N)** bằng hai mảng: `d1[i]` = số palindrome độ dài lẻ có tâm tại `i` (palindrome dài nhất có độ dài `2·d1[i] − 1`), `d2[i]` = số palindrome độ dài chẵn có tâm nằm giữa `i−1` và `i` (dài nhất `2·d2[i]`).\n\n" +
        "Giữ palindrome `[l, r]` đã tìm được có `r` xa nhất. Với `i` nằm trong nó, đối xứng của `i` qua tâm là `l + r − i`, nên `d[i] ≥ min(d[l + r − i], r − i + 1)`; chỉ phần vượt ra ngoài `r` mới phải mở rộng từng ký tự, mà mỗi lần mở rộng thành công đẩy `r` sang phải nên tổng là O(N).\n\n" +
        "Từ `d1`, `d2`: hỏi `s[l..r]` có là palindrome trong O(1) (so `d` của tâm đoạn với nửa độ dài), tìm palindrome con dài nhất, và đếm số palindrome con bằng Σ(d1[i] + d2[i]). Cũng có thể chèn ký tự phân cách giữa các ký tự để gộp hai mảng thành một, nhưng mẫu giữ hai mảng cho khỏi đổi chỉ số.",
      conditions: ["Xâu cố định (không cập nhật ký tự)", "Palindrome là xâu con LIÊN TIẾP, không phải dãy con"],
      complexity: { time: "O(N)", space: "O(N)", note: "Mở rộng từng tâm một cách ngây thơ là O(N²) — vẫn ổn với N ≤ 5000." },
      ops: [["Dựng d1, d2", "O(N)"], ["Hỏi s[l..r] có là palindrome", "O(1)"], ["Palindrome con dài nhất", "O(N)"], ["Đếm mọi palindrome con", "O(N)"]],
      use_case: ["Palindrome con liên tiếp dài nhất", "Đếm mọi palindrome con liên tiếp", "Hỏi nhiều lần 's[l..r] có là palindrome không' trên xâu cố định", "Quy hoạch động chia xâu thành các palindrome (kiểm tra palindrome O(1))"],
      not_for: ["Xâu có cập nhật từng ký tự → Rolling Hash (hash xuôi + ngược) kèm Fenwick Tree", "Dãy con palindrome dài nhất → quy hoạch động (LCS của xâu và xâu đảo ngược)", "Đếm palindrome PHÂN BIỆT → Palindromic Tree (eertree)"],
      pitfalls: [
        "Hai quy ước: `d1` (lẻ) đã tính cả ký tự tâm (≥ 1); `d2` (chẵn) có thể bằng 0 và tâm nằm GIỮA `i−1` và `i`. Nhầm quy ước là lỗi off-by-one thường gặp.",
        "Hỏi `s[l..r]` (độ dài len): len lẻ → `d1[(l+r)/2] ≥ (len+1)/2`; len chẵn → `d2[(l+r+1)/2] ≥ len/2`. Quên tách hai trường hợp.",
        "Vị trí đầu của palindrome dài nhất là `i − d1[i] + 1` (lẻ) hoặc `i − d2[i]` (chẵn), không phải `i`.",
        "Tổng số palindrome con tới N(N+1)/2 — dùng long long.",
        "Nhầm xâu con (liên tiếp) với dãy con: Manacher chỉ trả lời xâu con."
      ],
      code: {
        lang: "cpp", title: "manacher.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Manacher O(N). d1[i] = số palindrome độ dài lẻ có tâm i (dài nhất 2*d1[i]-1);
// d2[i] = số palindrome độ dài chẵn có tâm giữa i-1 và i (dài nhất 2*d2[i], có thể 0). Chỉ số 0-based.
struct Manacher {
    vector<int> d1, d2;
    Manacher(const string& s) {
        int n = s.size();
        d1.assign(n, 0);
        d2.assign(n, 0);
        for (int i = 0, l = 0, r = -1; i < n; i++) {  // [l, r]: palindrome lẻ có r xa nhất
            int k = i > r ? 1 : min(d1[l + r - i], r - i + 1);
            while (i - k >= 0 && i + k < n && s[i - k] == s[i + k]) k++;
            d1[i] = k--;
            if (i + k > r) l = i - k, r = i + k;
        }
        for (int i = 0, l = 0, r = -1; i < n; i++) {  // [l, r]: palindrome chẵn có r xa nhất
            int k = i > r ? 0 : min(d2[l + r - i + 1], r - i + 1);
            while (i - k - 1 >= 0 && i + k < n && s[i - k - 1] == s[i + k]) k++;
            d2[i] = k--;
            if (i + k > r) l = i - k - 1, r = i + k;
        }
    }
    bool isPalindrome(int l, int r) const {  // s[l..r] (đóng, l <= r) có là palindrome? O(1)
        int len = r - l + 1;
        return len & 1 ? d1[(l + r) / 2] >= (len + 1) / 2 : d2[(l + r + 1) / 2] >= len / 2;
    }
    pair<int, int> longest() const {  // (vị trí đầu, độ dài) của palindrome dài nhất; xâu rỗng -> (0, 0)
        pair<int, int> best = {0, 0};
        for (int i = 0; i < (int)d1.size(); i++) {
            if (2 * d1[i] - 1 > best.second) best = {i - d1[i] + 1, 2 * d1[i] - 1};
            if (2 * d2[i] > best.second) best = {i - d2[i], 2 * d2[i]};
        }
        return best;
    }
    long long countAll() const {  // tổng số palindrome con (tính theo vị trí, không loại trùng nội dung)
        long long c = 0;
        for (int i = 0; i < (int)d1.size(); i++) c += d1[i] + d2[i];
        return c;
    }
};
`
      },
      example: {
        input: "abaaba",
        output: "d1 = 1 2 1 1 2 1\nd2 = 0 0 0 3 0 0\nsố palindrome con = 11, dài nhất = 6",
        explain: "d1[1] = 2 vì 'aba' có tâm 'b'; d1[4] = 2 vì 'aba' có tâm 'b' thứ hai. d2[3] = 3 vì tâm giữa vị trí 2 và 3 mở rộng được 'aa', 'baab', 'abaaba'. Tổng = (1+2+1+1+2+1) + 3 = 11 palindrome con (tính theo vị trí); dài nhất là cả xâu, độ dài 6."
      },
      problems: [
        { site: "cses", id: "1111", name: "Longest Palindrome" },
        { site: "cses", id: "3138", name: "All Palindromes" },
        { site: "lc", name: "Longest Palindromic Substring" },
        { site: "lc", name: "Palindromic Substrings" }
      ],
      related: ["rolling-hash", "kmp", "z-function", "suffix-array", "suffix-automaton", "lcs"],
      compare: { "Bài toán giải": "Mọi palindrome con liên tiếp", "Xây dựng": "O(N)", "Truy vấn": "O(1) hỏi một đoạn có là palindrome", "Bộ nhớ": "O(N)" },
      cards: [
        { q: "d1[i] và d2[i] của Manacher nghĩa là gì?", a: "d1[i]: số palindrome độ dài lẻ tâm i (dài nhất 2·d1[i]−1). d2[i]: số palindrome độ dài chẵn có tâm giữa i−1 và i (dài nhất 2·d2[i])." },
        { q: "Vì sao Manacher là O(N)?", a: "Giữ palindrome [l, r] có r xa nhất; trong đó tận dụng đối xứng d[i] ≥ min(d[l+r−i], r−i+1); mỗi lần mở rộng thành công đẩy r sang phải nên tổng O(N)." },
        { q: "Tổng số palindrome con tính thế nào?", a: "Σ(d1[i] + d2[i]) — đếm theo vị trí, có thể tới N(N+1)/2 nên dùng long long." },
        { q: "Xâu có cập nhật ký tự thì hỏi palindrome bằng gì?", a: "Manacher tĩnh không dùng được; dùng hash xuôi và ngược kết hợp Fenwick Tree để so sánh hash." }
      ]
    },
    {
      id: "suffix-automaton",
      name: "Suffix Automaton",
      aliases: ["suffix automaton", "sam", "ôtômat hậu tố", "suffix link", "endpos", "đếm xâu con phân biệt", "xâu con chung dài nhất", "longest common substring"],
      category: "string",
      sub: "Hậu tố",
      level: 5,
      tags: ["string", "automaton", "suffix-automaton", "substring", "counting"],
      summary: "Ôtômat tất định nhỏ nhất nhận mọi hậu tố của xâu, dựng online trong O(N·|Σ|): đếm xâu con phân biệt, đếm số lần xuất hiện, xâu con chung dài nhất.",
      description:
        "**Suffix Automaton** (SAM) là ôtômat tất định nhỏ nhất nhận đúng mọi hậu tố của `s`; vì vậy nó cũng nhận mọi xâu con. Mỗi trạng thái là một lớp các xâu con có chung tập vị trí kết thúc (**endpos**); các xâu trong lớp là các hậu tố liên tiếp của xâu dài nhất, độ dài trong khoảng `(len[link[v]], len[v]]`. `link[v]` (**suffix link**) trỏ tới lớp của hậu tố dài nhất không thuộc lớp `v`; các link tạo thành một cây gốc là trạng thái rỗng.\n\n" +
        "Dựng **online**: thêm từng ký tự, mỗi lần tạo trạng thái `cur` rồi đi ngược theo suffix link để thêm chuyển trạng thái; chỉ khi gặp chuyển trạng thái tới `q` mà `len[p] + 1 ≠ len[q]` mới phải **clone** `q`. Tổng cộng tối đa 2N − 1 trạng thái (N ≥ 2), thời gian khấu hao O(N·|Σ|) với bảng chuyển dạng mảng (O(N log |Σ|) nếu dùng map).\n\n" +
        "Ứng dụng: **số xâu con phân biệt** = Σ (len[v] − len[link[v]]) trên mọi trạng thái `v` khác gốc; **số lần xuất hiện** của một xâu con = số vị trí kết thúc của trạng thái ứng với nó (cộng dồn theo cây suffix link, theo thứ tự `len` giảm dần); **xâu con chung dài nhất** của hai xâu bằng cách cho xâu thứ hai chạy qua automaton của xâu thứ nhất; kiểm tra xâu con trong O(|P|).",
      conditions: ["Bảng chữ cái nhỏ (hoặc chấp nhận dùng map thay cho mảng chuyển)", "Cần truy vấn về MỌI xâu con: tồn tại, số lần, đếm phân biệt", "Xâu được thêm ký tự ở cuối (online) hoặc cố định"],
      complexity: { time: "O(N·|Σ|) dựng", space: "O(N·|Σ|)", note: "Tối đa 2N − 1 trạng thái. Kiểm tra hoặc đếm một mẫu P: O(|P|). Bảng chuyển dạng map: O(N log |Σ|) thời gian và ít bộ nhớ hơn khi |Σ| lớn." },
      ops: [["Thêm một ký tự (online)", "O(|Σ|) khấu hao"], ["Số xâu con phân biệt", "O(N)"], ["Số lần xuất hiện của một xâu con", "O(|P|)"], ["Kiểm tra là xâu con", "O(|P|)"], ["Xâu con chung dài nhất với xâu thứ hai", "O(|T|)"]],
      use_case: ["Đếm xâu con phân biệt (kể cả sau mỗi lần thêm ký tự)", "Kiểm tra mẫu có là xâu con không / đếm số lần xuất hiện, với các mẫu đến lần lượt (online)", "Xâu con chung dài nhất của hai xâu", "Xâu con nhỏ thứ k theo từ điển (quy hoạch động trên DAG chuyển trạng thái)"],
      not_for: ["Chỉ một mẫu một lần → KMP / Z", "Cần thứ tự hậu tố hoặc LCP của hai hậu tố bất kỳ → Suffix Array + LCP", "Bộ nhớ chặt hoặc bảng chữ cái lớn → Suffix Array (O(N) bộ nhớ) hoặc SAM dùng map"],
      pitfalls: [
        "Bộ nhớ 2N·|Σ|·4 byte: N = 10^6 với 26 chữ cái cỡ 200 MB, dễ vượt giới hạn; với |Σ| lớn dùng map hoặc chuyển sang Suffix Array.",
        "Số lần xuất hiện: trạng thái mới tạo có `cnt = 1`, trạng thái clone có `cnt = 0`, và phải cộng dồn theo `len` giảm dần sau khi thêm xong (hàm `calcOccurrences`, gọi một lần).",
        "Khi clone phải sao chép toàn bộ chuyển trạng thái và `link` của `q`, rồi sửa chuyển của các tổ tiên (vòng `while next[p][c] == q`); quên một trong hai làm automaton sai âm thầm.",
        "Số xâu con phân biệt cỡ N²/2 — dùng long long.",
        "Đổi bảng chữ cái khác 26 chữ thường phải sửa `A` và phép trừ 'a'; truy vấn chứa ký tự ngoài bảng chữ cái làm truy cập ngoài mảng."
      ],
      code: {
        lang: "cpp", title: "suffix_automaton.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Suffix Automaton cho chữ thường 'a'..'z' (đổi A và phép trừ 'a' nếu khác). Tối đa 2N - 1 trạng thái; trạng thái 0 là gốc.
// len[v] = độ dài xâu dài nhất của lớp v; link[v] = suffix link; cnt[v] = số vị trí kết thúc (sau calcOccurrences).
struct SuffixAutomaton {
    static const int A = 26;
    vector<array<int, A>> next;
    vector<int> len, link;
    vector<long long> cnt;
    int last = 0;

    SuffixAutomaton() { newState(0, -1); }
    explicit SuffixAutomaton(const string& s) : SuffixAutomaton() {
        for (char ch : s) extend(ch);
        calcOccurrences();
    }
    int newState(int l, int lk) {
        next.emplace_back();
        next.back().fill(-1);
        len.push_back(l);
        link.push_back(lk);
        cnt.push_back(0);
        return (int)len.size() - 1;
    }
    void extend(char ch) {  // thêm một ký tự vào cuối (online), khấu hao O(|Σ|)
        int c = ch - 'a';
        int cur = newState(len[last] + 1, 0);
        cnt[cur] = 1;  // trạng thái mới ứng với một vị trí kết thúc mới
        int p = last;
        while (p != -1 && next[p][c] == -1) {
            next[p][c] = cur;
            p = link[p];
        }
        if (p != -1) {
            int q = next[p][c];
            if (len[p] + 1 == len[q]) {
                link[cur] = q;
            } else {
                int cl = newState(len[p] + 1, link[q]);  // clone q (cnt = 0)
                next[cl] = next[q];
                while (p != -1 && next[p][c] == q) {
                    next[p][c] = cl;
                    p = link[p];
                }
                link[q] = link[cur] = cl;
            }
        }
        last = cur;
    }
    void calcOccurrences() {  // gọi MỘT lần sau khi thêm hết ký tự: cộng dồn cnt theo cây suffix link
        int n = len.size(), mx = len[last];
        vector<int> byLen(mx + 2, 0), order(n);
        for (int v = 0; v < n; v++) byLen[len[v]]++;
        for (int i = 1; i <= mx; i++) byLen[i] += byLen[i - 1];
        for (int v = n - 1; v >= 0; v--) order[--byLen[len[v]]] = v;  // sắp theo len tăng dần
        for (int i = n - 1; i > 0; i--) cnt[link[order[i]]] += cnt[order[i]];
    }
    long long distinctSubstrings() const {  // tổng len[v] - len[link[v]] trên mọi trạng thái khác gốc
        long long total = 0;
        for (int v = 1; v < (int)len.size(); v++) total += len[v] - len[link[v]];
        return total;
    }
    int walk(const string& p) const {  // trạng thái sau khi đọc p, hoặc -1 nếu p không là xâu con
        int v = 0;
        for (char ch : p) {
            v = next[v][ch - 'a'];
            if (v < 0) return -1;
        }
        return v;
    }
    bool contains(const string& p) const { return walk(p) >= 0; }
    long long occurrences(const string& p) const {  // số lần p xuất hiện (kể cả chồng nhau)
        int v = walk(p);
        return v < 0 ? 0 : cnt[v];
    }
    int longestCommonSubstring(const string& t) const {  // độ dài xâu con chung dài nhất của xâu đã dựng và t
        int v = 0, l = 0, best = 0;
        for (char ch : t) {
            int c = ch - 'a';
            while (v != 0 && next[v][c] == -1) {
                v = link[v];
                l = len[v];
            }
            if (next[v][c] != -1) {
                v = next[v][c];
                l++;
            }
            best = max(best, l);
        }
        return best;
    }
};
`
      },
      example: {
        input: "abcbc\nbc",
        output: "12\n2",
        explain: "Xâu 'abcbc' có 12 xâu con phân biệt (3 độ dài 1: a, b, c; 3 độ dài 2: ab, bc, cb; 3 độ dài 3: abc, bcb, cbc; 2 độ dài 4: abcb, bcbc; 1 độ dài 5). Xâu con 'bc' xuất hiện 2 lần (vị trí 1 và 3)."
      },
      problems: [
        { site: "cses", id: "2105", name: "Distinct Substrings" },
        { site: "cses", id: "2110", name: "Substring Distribution" },
        { site: "cses", id: "2102", name: "Finding Patterns" },
        { site: "cses", id: "2103", name: "Counting Patterns" }
      ],
      related: ["suffix-array", "kmp", "aho-corasick", "trie", "rolling-hash", "z-function"],
      compare: { "Bài toán giải": "Mọi xâu con: tồn tại, số lần, đếm phân biệt", "Xây dựng": "O(N·|Σ|) (online)", "Truy vấn": "O(|P|) kiểm tra hoặc đếm", "Bộ nhớ": "O(N·|Σ|)" },
      cards: [
        { q: "Mỗi trạng thái của Suffix Automaton đại diện cho gì?", a: "Một lớp các xâu con có cùng tập vị trí kết thúc (endpos); độ dài các xâu trong lớp thuộc (len[link[v]], len[v]]." },
        { q: "Số xâu con phân biệt tính thế nào?", a: "Σ (len[v] − len[link[v]]) trên mọi trạng thái v khác gốc; dùng long long." },
        { q: "Số trạng thái tối đa và vì sao cần clone?", a: "Tối đa 2N − 1 (N ≥ 2). Clone khi chuyển trạng thái tới q có len[p]+1 ≠ len[q], để tách lớp endpos mà vẫn giữ tính tất định." },
        { q: "Cách đếm số lần xuất hiện của một xâu con?", a: "Trạng thái mới: cnt = 1, clone: cnt = 0; cộng dồn cnt[link[v]] += cnt[v] theo len giảm dần; đáp án là cnt của trạng thái sau khi đọc xâu con." },
        { q: "Xâu con chung dài nhất của hai xâu bằng SAM?", a: "Dựng SAM của xâu thứ nhất, cho xâu thứ hai chạy qua: khi lệch thì lùi theo suffix link và đặt l = len; lấy max của độ dài khớp hiện tại." }
      ]
    },
    {
      id: "xor-trie",
      name: "Binary Trie (XOR lớn nhất)",
      aliases: ["binary trie", "xor trie", "trie nhị phân", "xor lớn nhất", "maximum xor", "max xor pair", "xor subarray", "cây tiền tố nhị phân", "bitwise trie"],
      category: "string",
      sub: "Cây tiền tố (Trie)",
      level: 2,
      tags: ["trie", "xor", "bitwise", "greedy", "binary-trie"],
      summary: "Trie trên biểu diễn nhị phân của số nguyên để tìm số cho XOR lớn nhất với một giá trị trong O(số bit), có hỗ trợ xoá và đếm số phần tử có XOR nhỏ hơn K.",
      description:
        "**Binary Trie** lưu các số nguyên không âm theo biểu diễn nhị phân `B` bit (từ bit cao xuống bit thấp); mỗi nút có hai con ứng với bit 0 và 1. Để tìm `y` trong tập làm `x XOR y` lớn nhất, đi từ bit cao xuống thấp một cách **tham lam**: ở mỗi bit chọn nhánh có bit ĐỐI với bit của `x` nếu nhánh đó tồn tại (một bit cao luôn nặng hơn mọi bit thấp cộng lại), nếu không thì buộc phải đi nhánh còn lại. Mỗi truy vấn tốn O(B). XOR nhỏ nhất làm tương tự nhưng ưu tiên nhánh CÙNG bit.\n\n" +
        "Mỗi nút giữ bộ đếm số phần tử đi qua nên hỗ trợ **xoá** (trừ bộ đếm; nhánh có bộ đếm 0 coi như không tồn tại) và **đếm** số `y` thoả `x XOR y < K`: duyệt theo bit của `K`; mỗi khi bit của `K` là 1, mọi `y` đi nhánh làm bit XOR bằng 0 đều cho kết quả nhỏ hơn `K` nên cộng bộ đếm của cả nhánh, rồi đi tiếp nhánh làm bit XOR bằng 1.\n\n" +
        "XOR lớn nhất của một **đoạn con liên tiếp**: đặt `pre[i]` là XOR của `i` phần tử đầu, khi đó XOR đoạn `(i, j]` bằng `pre[j] XOR pre[i]`. Bài toán thành tìm cặp XOR lớn nhất trong các tiền tố: duyệt `j` và hỏi trie đang chứa `pre[0..j−1]` (nhớ chèn `pre[0] = 0` trước).",
      conditions: ["Giá trị là số nguyên không âm chứa vừa trong B bit", "Truy vấn dạng XOR lớn nhất / nhỏ nhất với một giá trị, hoặc đếm theo ngưỡng XOR"],
      complexity: { time: "O(B) mỗi thao tác (B = số bit)", space: "O(N·B)", note: "B = 30 cho số < 2^30, B = 60 cho số tới 10^18. Số nút tối đa N·B + 1." },
      ops: [["Thêm / xoá một số", "O(B)"], ["XOR lớn nhất với x cho trước", "O(B)"], ["Đếm y có x XOR y < K", "O(B)"], ["XOR lớn nhất của một cặp trong mảng", "O(N·B)"]],
      use_case: ["Chọn một số trong tập (có thêm / xoá) để XOR với x lớn nhất", "XOR lớn nhất của một đoạn con liên tiếp, qua XOR tiền tố", "Đếm số cặp (hoặc số phần tử) có XOR nhỏ hơn K", "XOR nhỏ nhất với x: đi nhánh cùng bit thay vì nhánh ngược bit"],
      not_for: ["XOR lớn nhất của một tập con tuỳ ý (không cần liên tiếp) → cơ sở tuyến tính XOR (khử Gauss trên GF(2))", "Bộ nhớ chặt khi N·B nút quá lớn → duyệt từng bit với tập băm các tiền tố (O(N·B) thời gian, O(N) bộ nhớ)", "Xâu ký tự thường → Trie thường"],
      pitfalls: [
        "Số bit `B` phải phủ mọi giá trị: B = 30 cho số < 2^30, B = 60 cho số tới 10^18 (mẫu dùng long long); thiếu bit cao thì kết quả sai.",
        "Bộ nhớ N·B nút × 12 byte: N = 2·10^5, B = 30 cỡ 72 MB; N = 10^6 vượt giới hạn thường gặp.",
        "`maxXor` trên tập rỗng (hoặc đã xoá hết) là hành vi không xác định: kiểm tra `size() > 0` trước.",
        "Khi xoá phải trừ bộ đếm dọc đường đi và coi nhánh có bộ đếm 0 là không tồn tại; nếu không `maxXor` đi vào nhánh đã bị xoá.",
        "XOR đoạn con: phải chèn `pre[0] = 0` trước khi duyệt, để đoạn bắt đầu từ phần tử đầu tiên được xét.",
        "`countLess(x, k)` yêu cầu 0 ≤ x, y, k < 2^B; giá trị âm hoặc k ≥ 2^B phải xử lý riêng."
      ],
      code: {
        lang: "cpp", title: "xor_trie.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Binary Trie (XOR): lưu các số nguyên không âm < 2^B từ bit cao xuống bit thấp; mỗi nút giữ số phần tử đi qua (hỗ trợ xoá).
// B = 30 cho số < 2^30; dùng B = 60 nếu số tới 10^18. Số nút tối đa N*B + 1.
struct XorTrie {
    static const int B = 30;
    vector<array<int, 2>> ch;
    vector<int> cnt;  // cnt[v] = số phần tử đi qua nút v
    XorTrie() { newNode(); }
    int newNode() {
        ch.push_back({-1, -1});
        cnt.push_back(0);
        return (int)ch.size() - 1;
    }
    int size() const { return cnt[0]; }
    void add(long long x, int d = 1) {  // d = +1 thêm, -1 xoá (x phải đang có trong tập)
        int v = 0;
        cnt[0] += d;
        for (int b = B - 1; b >= 0; b--) {
            int c = (x >> b) & 1;
            if (ch[v][c] < 0) {
                int u = newNode();
                ch[v][c] = u;
            }
            v = ch[v][c];
            cnt[v] += d;
        }
    }
    long long maxXor(long long x) const {  // max của x ^ y với y trong tập; tập phải khác rỗng
        int v = 0;
        long long res = 0;
        for (int b = B - 1; b >= 0; b--) {
            int c = ((x >> b) & 1) ^ 1;  // ưu tiên nhánh có bit đối với bit của x
            int u = ch[v][c];
            if (u >= 0 && cnt[u] > 0) {
                res |= 1LL << b;
                v = u;
            } else {
                v = ch[v][c ^ 1];
            }
        }
        return res;
    }
    long long countLess(long long x, long long k) const {  // số y trong tập thoả (x ^ y) < k; cần 0 <= x, y, k < 2^B
        int v = 0;
        long long res = 0;
        for (int b = B - 1; b >= 0 && v >= 0; b--) {
            int xb = (x >> b) & 1;
            if ((k >> b) & 1) {  // bit của x^y bằng 0 thì chắc chắn nhỏ hơn k: lấy cả nhánh đó
                int u = ch[v][xb];
                if (u >= 0) res += cnt[u];
                v = ch[v][xb ^ 1];  // đi tiếp nhánh làm bit xor bằng 1
            } else {
                v = ch[v][xb];  // bit xor phải bằng 0
            }
        }
        return res;
    }
};

// XOR lớn nhất của hai phần tử ở hai chỉ số khác nhau (0 nếu n < 2). O(N*B).
long long maxXorPair(const vector<long long>& a) {
    XorTrie tr;
    long long best = 0;
    for (long long x : a) {
        if (tr.size() > 0) best = max(best, tr.maxXor(x));
        tr.add(x);
    }
    return best;
}

// XOR lớn nhất của một đoạn con liên tiếp (0 nếu mảng rỗng): max của pre[j] ^ pre[i] với i < j, pre[0] = 0. O(N*B).
long long maxXorSubarray(const vector<long long>& a) {
    XorTrie tr;
    tr.add(0);
    long long best = 0, pre = 0;
    for (long long x : a) {
        pre ^= x;
        best = max(best, tr.maxXor(pre));
        tr.add(pre);
    }
    return best;
}
`
      },
      example: {
        input: "6\n3 10 5 25 2 8",
        output: "28",
        explain: "Cặp (5, 25): 00101 XOR 11001 = 11100 = 28, lớn nhất trong mọi cặp. Trên trie, khi hỏi x = 5 ta đi từ bit cao xuống: bit 4 của 5 là 0 nên chọn nhánh bit 1 (có 25), rồi tiếp tục chọn nhánh ngược bit của 5 ở từng bit còn lại."
      },
      problems: [
        { site: "cses", id: "1655", name: "Maximum Xor Subarray" },
        { site: "cf", id: "706D", name: "Vasiliy's Multiset" },
        { site: "lc", name: "Maximum XOR of Two Numbers in an Array" }
      ],
      related: ["trie", "bit-manipulation", "array-prefix-sum"],
      compare: { "Bài toán giải": "XOR lớn nhất / nhỏ nhất; đếm XOR nhỏ hơn K", "Xây dựng": "O(N·B)", "Truy vấn": "O(B) mỗi truy vấn", "Bộ nhớ": "O(N·B)" },
      cards: [
        { q: "Tìm y trong tập sao cho x XOR y lớn nhất bằng Binary Trie thế nào?", a: "Đi từ bit cao xuống thấp, ở mỗi bit ưu tiên nhánh có bit đối với bit của x (nếu có phần tử trong nhánh); mỗi lần chọn được nhánh đối thì cộng 2^bit vào đáp án. O(B)." },
        { q: "XOR lớn nhất của một đoạn con liên tiếp quy về bài nào?", a: "Cặp XOR lớn nhất giữa các XOR tiền tố pre[i] (nhớ pre[0] = 0): XOR đoạn (i, j] = pre[j] XOR pre[i]." },
        { q: "Làm sao hỗ trợ xoá phần tử khỏi Binary Trie?", a: "Mỗi nút giữ bộ đếm số phần tử đi qua; xoá thì trừ bộ đếm dọc đường, nhánh có bộ đếm 0 coi như không có." },
        { q: "Đếm số y có x XOR y < K bằng trie ra sao?", a: "Duyệt bit từ cao xuống: khi bit của K là 1, cộng bộ đếm cả nhánh làm bit XOR bằng 0 rồi đi tiếp nhánh làm bit XOR bằng 1; khi bit của K là 0 phải đi nhánh làm bit XOR bằng 0." }
      ]
    },
    {
      id: "minimal-rotation",
      name: "Dịch vòng nhỏ nhất (Booth / Lyndon)",
      aliases: ["minimal rotation", "lexicographically smallest rotation", "dịch vòng nhỏ nhất", "booth", "lyndon", "duval", "lyndon factorization", "necklace", "xâu vòng", "cyclic shift", "minimum representation"],
      category: "string",
      sub: "Đối xứng & dịch vòng",
      level: 3,
      tags: ["string", "rotation", "lyndon", "duval", "canonical-form"],
      summary: "Tìm dịch vòng nhỏ nhất theo từ điển của xâu trong O(n) (hai con trỏ / Booth) và phân rã Lyndon bằng Duval; dùng làm dạng chuẩn của xâu vòng.",
      description:
        "**Dịch vòng** của xâu `s` là `s[i..] + s[..i)`. Dịch vòng nhỏ nhất theo thứ tự từ điển là **dạng chuẩn** của xâu vòng: hai xâu là dịch vòng của nhau khi và chỉ khi dạng chuẩn của chúng bằng nhau. Thử cả n dịch vòng tốn O(n²); có thuật toán O(n).\n\n" +
        "**Hai con trỏ** (mẫu): giữ hai ứng viên `i`, `j` và độ dài khớp `k` của hai dịch vòng bắt đầu tại `i` và `j`. Khi `s[i+k] ≠ s[j+k]`, ứng viên mang ký tự lớn hơn bị loại cùng `k` vị trí kế tiếp (mỗi dịch vòng bắt đầu ở `i..i+k` đều lớn hơn dịch vòng tương ứng bắt đầu ở `j..j+k`), nên `i += k + 1` hoặc `j += k + 1`; tổng số bước O(n). **Booth** đạt cùng O(n) bằng hàm lỗi kiểu KMP trên `s + s`.\n\n" +
        "**Phân rã Lyndon (Duval)**: **từ Lyndon** là xâu nhỏ hơn mọi hậu tố thật sự của nó (tương đương nhỏ hơn mọi dịch vòng khác). Mọi xâu viết được duy nhất thành tích các từ Lyndon không tăng `w1 ≥ w2 ≥ … ≥ wk`; Duval tìm trong O(n) thời gian và O(1) bộ nhớ thêm. Chạy Duval trên `s + s` thì dịch vòng nhỏ nhất bắt đầu tại đầu nhóm thừa số cuối cùng bắt đầu ở vị trí nhỏ hơn n.",
      conditions: ["Xâu coi như vòng (ký tự cuối nối với ký tự đầu)", "Ký tự so sánh được theo thứ tự từ điển"],
      complexity: { time: "O(n)", space: "O(1)", note: "Bộ nhớ thêm O(1) (không kể kết quả phân rã Lyndon). Thử mọi dịch vòng bằng vét cạn là O(n²)." },
      ops: [["Dịch vòng nhỏ nhất (hai con trỏ)", "O(n)"], ["Phân rã Lyndon (Duval)", "O(n)"], ["So sánh hai xâu vòng qua dạng chuẩn", "O(n)"]],
      use_case: ["Dạng chuẩn của xâu vòng: gom hoặc đếm các xâu đồng nhất qua phép dịch vòng (necklace)", "Chuyển ký tự đầu xuống cuối nhiều lần để thu được xâu nhỏ nhất", "Kiểm tra hai xâu có là dịch vòng của nhau", "Phân rã xâu thành tích các từ Lyndon không tăng (Duval)"],
      not_for: ["Chỉ hỏi một cặp xâu a, b có là dịch vòng của nhau không → KMP: tìm b trong a + a", "Cần xếp thứ tự mọi hậu tố hoặc so sánh nhiều đoạn con → Suffix Array"],
      pitfalls: [
        "Điều kiện dừng phải có `k < n`: khi `k` chạm `n`, mọi dịch vòng tại `i` và `j` bằng nhau (xâu tuần hoàn), lấy `min(i, j)`; thiếu thì lặp vô hạn.",
        "Sau `i += k + 1` hoặc `j += k + 1` nếu `i == j` phải tăng `j`; quên thì hai con trỏ dính nhau và thuật toán sai.",
        "Hàm trả VỊ TRÍ bắt đầu, không phải xâu; muốn xâu thì `s.substr(p) + s.substr(0, p)`. Xâu tuần hoàn có nhiều vị trí cho cùng dịch vòng; mẫu trả về vị trí nhỏ nhất.",
        "Duval trả các thừa số KHÔNG TĂNG (`w1 ≥ w2 ≥ …`), và một thừa số có thể lặp liên tiếp nhiều lần; đừng giả sử chúng đôi một khác nhau.",
        "Xâu rỗng: hàm trả 0, phân rã rỗng."
      ],
      code: {
        lang: "cpp", title: "minimal_rotation.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Dịch vòng nhỏ nhất theo từ điển bằng hai con trỏ, O(n): trả về vị trí NHỎ NHẤT p (0-based) sao cho
// s[p..] + s[..p) là dịch vòng nhỏ nhất. Xâu rỗng -> 0. Muốn xâu kết quả: s.substr(p) + s.substr(0, p).
int minimalRotation(const string& s) {
    int n = s.size(), i = 0, j = 1, k = 0;
    while (i < n && j < n && k < n) {
        char a = s[(i + k) % n], b = s[(j + k) % n];
        if (a == b) {
            k++;
            continue;
        }
        if (a > b) i += k + 1;  // các dịch vòng bắt đầu ở i..i+k đều lớn hơn dịch vòng tương ứng ở j..j+k
        else j += k + 1;
        if (i == j) j++;
        k = 0;
    }
    return min(i, j);
}

// Phân rã Lyndon (Duval), O(n): s = w1 w2 ... wk, mỗi wi là từ Lyndon (nhỏ hơn mọi hậu tố thật sự), w1 >= w2 >= ... >= wk.
// Trả về các cặp (vị trí đầu, độ dài).
vector<pair<int, int>> lyndonFactorization(const string& s) {
    int n = s.size();
    vector<pair<int, int>> res;
    for (int i = 0; i < n;) {
        int j = i + 1, k = i;
        while (j < n && s[k] <= s[j]) {
            k = (s[k] < s[j]) ? i : k + 1;
            j++;
        }
        while (i <= k) {  // thừa số lặp lại (j - k) ký tự, có thể nhiều lần liên tiếp
            res.push_back({i, j - k});
            i += j - k;
        }
    }
    return res;
}
`
      },
      example: {
        input: "cabcab",
        output: "1\nabcabc\nc | abc | ab",
        explain: "Dịch vòng nhỏ nhất của 'cabcab' bắt đầu ở vị trí 1 và là 'abcabc' (cũng bắt đầu ở vị trí 4 nhưng hàm trả vị trí nhỏ nhất). Phân rã Lyndon: 'c' ≥ 'abc' ≥ 'ab', mỗi thừa số nhỏ hơn mọi hậu tố thật sự của nó."
      },
      problems: [
        { site: "cses", id: "1110", name: "Minimal Rotation" },
        { site: "lc", name: "Orderly Queue" }
      ],
      related: ["kmp", "suffix-array", "z-function", "manacher", "rolling-hash"],
      compare: { "Bài toán giải": "Dạng chuẩn của xâu vòng; phân rã Lyndon", "Xây dựng": "O(n)", "Truy vấn": "Không có truy vấn: một lần chạy O(n)", "Bộ nhớ": "O(1) thêm" },
      cards: [
        { q: "Dạng chuẩn của xâu vòng là gì?", a: "Dịch vòng nhỏ nhất theo từ điển: hai xâu là dịch vòng của nhau khi và chỉ khi dạng chuẩn bằng nhau." },
        { q: "Khi so sánh hai dịch vòng ở i và j thấy s[i+k] > s[j+k] thì làm gì?", a: "Loại các vị trí i..i+k (i += k + 1): mỗi dịch vòng đó lớn hơn dịch vòng tương ứng ở j..j+k nên không thể nhỏ nhất." },
        { q: "Từ Lyndon là gì và Duval làm gì?", a: "Từ Lyndon là xâu nhỏ hơn mọi hậu tố thật sự của nó. Duval phân rã xâu thành tích các từ Lyndon không tăng trong O(n)." },
        { q: "Kiểm tra b có là dịch vòng của a không?", a: "Độ dài bằng nhau và b là xâu con của a + a: dùng KMP trong O(n)." }
      ]
    },
  ]);

  A.lib.scenarios([
    {
      id: "q-kmp-1",
      prompt: "Văn bản T dài 10^6 ký tự và một mẫu P dài 10^5 ký tự, cả hai gồm chữ thường. Cần in mọi vị trí mà P xuất hiện trong T (các lần xuất hiện được phép chồng lên nhau). Chỉ có MỘT mẫu và văn bản chỉ cần xử lý một lần.",
      answer: ["kmp"],
      also: ["z-function", "rolling-hash", "aho-corasick", "suffix-array"],
      wrong: ["trie", "manacher", "xor-trie", "minimal-rotation"],
      why: "Một mẫu, một văn bản: KMP (hoặc Z-function) giải tất định trong O(N + M). Rolling Hash cũng được nhưng là xác suất; Aho-Corasick và Suffix Array chạy đúng nhưng thừa cho một mẫu. Trie lưu tập xâu theo tiền tố chứ không quét văn bản; Manacher dành cho palindrome; Binary Trie dành cho XOR; dịch vòng nhỏ nhất không liên quan tới tìm mẫu.",
      level: 1
    },
    {
      id: "q-kmp-2",
      prompt: "Cho xâu s dài 2·10^5. Hãy liệt kê TẤT CẢ độ dài p (1 ≤ p ≤ |s|) sao cho s[i] = s[i + p] với mọi i hợp lệ (mọi chu kỳ của s), chỉ trong O(|s|).",
      answer: ["kmp"],
      also: ["z-function"],
      wrong: ["manacher", "suffix-automaton", "trie", "xor-trie"],
      why: "Chu kỳ p tương đương border độ dài |s| − p, và mọi border đọc ra từ chuỗi pi[n−1], pi[pi[n−1]−1], … của hàm tiền tố KMP. Z-function cũng được: p là chu kỳ khi p + z[p] = n. Manacher chỉ xét tính đối xứng; Suffix Automaton và Trie nặng và không cho chu kỳ trực tiếp.",
      level: 2
    },
    {
      id: "q-z-function-1",
      prompt: "Cho xâu S dài 10^6. Với MỖI vị trí i (0 ≤ i < |S|), cần độ dài tiền tố chung dài nhất của S và hậu tố S[i..]. Toàn bộ phải xong trong thời gian O(|S|).",
      answer: ["z-function"],
      also: ["kmp", "rolling-hash", "suffix-array"],
      wrong: ["manacher", "trie", "xor-trie", "aho-corasick"],
      why: "Đây chính là định nghĩa của mảng Z, tính trong O(n). Hàm tiền tố KMP mang cùng thông tin nhưng phải đổi qua lại; Hash kèm tìm nhị phân hoặc Suffix Array + Sparse Table tính được nhưng O(N log N) và nặng hơn. Manacher, Trie, Binary Trie và Aho-Corasick giải các bài khác (palindrome, tiền tố tập xâu, XOR, nhiều mẫu).",
      level: 2
    },
    {
      id: "q-rolling-hash-1",
      prompt: "Xâu s dài 2·10^5 cố định. Có Q = 2·10^5 truy vấn, mỗi truy vấn cho hai đoạn (l1, r1) và (l2, r2) và hỏi hai xâu con s[l1..r1], s[l2..r2] có bằng nhau không. Mỗi truy vấn phải trả lời nhanh, gần O(1).",
      answer: ["rolling-hash"],
      also: ["suffix-array"],
      wrong: ["kmp", "z-function", "trie", "manacher"],
      why: "Hash tiền tố cho phép lấy hash của bất kỳ xâu con nào trong O(1) rồi so sánh; Suffix Array + LCP (kèm Sparse Table) cũng so sánh được nhưng cài đặt nặng hơn và cho kết quả chắc chắn. KMP và Z-function chỉ xử lý một mẫu cố định hoặc tiền tố của chính xâu, không trả lời được cặp đoạn bất kỳ; Trie lưu tập xâu theo tiền tố; Manacher chỉ xét palindrome.",
      level: 2
    },
    {
      id: "q-rolling-hash-2",
      prompt: "Xâu s dài 2·10^5. Có Q = 2·10^5 thao tác xen kẽ: (1) đổi ký tự ở vị trí i thành c; (2) hỏi xâu con s[l..r] hiện tại có phải palindrome không. Cần trả lời ngay sau từng thao tác.",
      answer: ["rolling-hash"],
      also: [],
      wrong: ["manacher", "suffix-array", "kmp", "suffix-automaton"],
      why: "Giữ hash xuôi và hash ngược của xâu bằng Fenwick Tree (tổng có trọng số B^i), cập nhật một ký tự O(log N), rồi so hai hash của xâu con. Manacher, Suffix Array và Suffix Automaton chỉ tính trên xâu cố định: mỗi lần đổi ký tự phải dựng lại O(N). KMP không trả lời được palindrome của đoạn bất kỳ.",
      level: 3
    },
    {
      id: "q-trie-1",
      prompt: "Từ điển cố định có N = 10^5 từ chữ thường, tổng độ dài ≤ 10^6. Có Q = 10^5 truy vấn, mỗi truy vấn cho một tiền tố p và hỏi có bao nhiêu từ trong từ điển bắt đầu bằng p. Tổng độ dài các tiền tố được hỏi ≤ 10^6.",
      answer: ["trie"],
      also: ["binary-search", "rolling-hash"],
      wrong: ["kmp", "manacher", "suffix-automaton", "minimal-rotation"],
      why: "Trie giữ bộ đếm số từ đi qua mỗi nút nên mỗi truy vấn O(|p|). Sắp xếp các từ rồi tìm nhị phân hai đầu của khoảng bắt đầu bằng p cũng đúng; đưa hash của mọi tiền tố vào bảng băm cũng được nhưng là xác suất. KMP tìm một mẫu trong một văn bản; Manacher là palindrome; Suffix Automaton trả lời xâu con chứ không phải tiền tố của một tập từ; dịch vòng nhỏ nhất không liên quan.",
      level: 1
    },
    {
      id: "q-aho-corasick-1",
      prompt: "Văn bản T dài 10^6 và K = 10^4 mẫu cho trước, tổng độ dài các mẫu ≤ 10^6. Với MỖI mẫu cần biết nó xuất hiện bao nhiêu lần trong T (cho phép chồng nhau). Mọi mẫu đều biết trước khi xử lý T.",
      answer: ["aho-corasick"],
      also: ["suffix-automaton", "suffix-array"],
      wrong: ["kmp", "z-function", "trie", "manacher"],
      why: "Aho-Corasick quét T đúng một lần rồi cộng dồn theo cây link suffix, tổng O(|T| + tổng độ dài mẫu). Chạy KMP hoặc Z cho từng mẫu tốn K·|T| cỡ 10^10. Trie chỉ lưu các mẫu, không có link nên không quét văn bản hiệu quả. Suffix Automaton hoặc Suffix Array của T trả lời được từng mẫu nhưng tốn bộ nhớ hơn; Manacher dành cho palindrome.",
      level: 3
    },
    {
      id: "q-aho-corasick-2",
      prompt: "Đếm số xâu độ dài n = 1000 gồm 26 chữ thường mà KHÔNG chứa xâu nào trong K = 50 xâu cấm (mỗi xâu cấm dài tối đa 10) làm xâu con. In kết quả modulo 10^9 + 7.",
      answer: ["aho-corasick"],
      also: [],
      wrong: ["kmp", "trie", "rolling-hash", "suffix-automaton"],
      why: "Dựng automaton Aho-Corasick của các xâu cấm, đánh dấu các nút xấu (kể cả nút có hậu tố là xâu cấm, qua link suffix) rồi quy hoạch động dp[i][nút] = số xâu độ dài i kết thúc ở nút đó. KMP chỉ có automaton cho một mẫu; Trie không có link nên không biết trạng thái sau khi lệch; hash không cho trạng thái hữu hạn để quy hoạch động; Suffix Automaton là automaton của MỘT xâu cho trước, không phải của tập mẫu cấm.",
      level: 4
    },
    {
      id: "q-suffix-array-1",
      prompt: "Xâu s cố định dài 2·10^5 (chữ thường). Sau đó các mẫu P đến lần lượt, mỗi mẫu phải được trả lời NGAY (online, không biết trước các mẫu sau): P xuất hiện bao nhiêu lần trong s. Có Q = 10^5 mẫu, tổng độ dài ≤ 10^6.",
      answer: ["suffix-array"],
      also: ["suffix-automaton"],
      wrong: ["kmp", "aho-corasick", "z-function", "trie"],
      why: "Dựng Suffix Array một lần; mỗi mẫu tìm nhị phân khoảng các hậu tố bắt đầu bằng P trong O(|P| log N) và số lần xuất hiện là độ dài khoảng. Suffix Automaton cũng trả lời trong O(|P|). Chạy KMP hoặc Z cho từng mẫu tốn Q·N cỡ 2·10^10. Aho-Corasick đòi biết trước toàn bộ mẫu (offline). Trie của mọi hậu tố có O(N²) nút.",
      level: 4
    },
    {
      id: "q-suffix-automaton-1",
      prompt: "Cho xâu s dài 10^5 gồm chữ thường. Đếm số xâu con khác nhau (hai xâu con có cùng nội dung chỉ tính một lần). Đáp án có thể tới cỡ 5·10^9.",
      answer: ["suffix-automaton"],
      also: ["suffix-array"],
      wrong: ["trie", "rolling-hash", "kmp", "manacher"],
      why: "Suffix Automaton: tổng len[v] − len[link[v]] trên mọi trạng thái; Suffix Array: N(N+1)/2 − Σ lcp. Cả hai chạy gần tuyến tính (nhớ long long). Trie chứa mọi xâu con cần O(N²) nút, hash mọi xâu con cũng O(N²) — quá chậm; KMP và Manacher giải các bài khác (tìm mẫu, palindrome).",
      level: 3
    },
    {
      id: "q-suffix-automaton-2",
      prompt: "Cho hai xâu a và b, mỗi xâu dài 3·10^5. Tìm độ dài của xâu con CHUNG dài nhất: hai đoạn liên tiếp, giống hệt nhau, một đoạn lấy từ a và một đoạn lấy từ b.",
      answer: ["suffix-automaton"],
      also: ["suffix-array", "rolling-hash"],
      wrong: ["lcs", "kmp", "trie", "manacher"],
      why: "Dựng Suffix Automaton của a rồi cho b chạy qua, giữ độ dài khớp hiện tại: O(|a|·|Σ| + |b|). Suffix Array của a + '#' + b hoặc hash kèm tìm nhị phân độ dài cũng được. 'lcs' là dãy con chung (không cần liên tiếp) và quy hoạch động O(|a||b|) quá chậm với 3·10^5, đồng thời là bài khác. KMP là một mẫu cố định; Trie của mọi xâu con tốn O(N²).",
      level: 4
    },
    {
      id: "q-manacher-1",
      prompt: "Cho xâu s dài 10^6. Tìm palindrome con LIÊN TIẾP dài nhất (một đoạn đọc xuôi ngược như nhau) và in vị trí đầu cùng độ dài. Xâu không thay đổi.",
      answer: ["manacher"],
      also: ["rolling-hash", "suffix-array"],
      wrong: ["kmp", "z-function", "trie", "suffix-automaton"],
      why: "Manacher tìm bán kính palindrome lớn nhất tại mọi tâm trong O(N). Hash + tìm nhị phân bán kính cho từng tâm cũng được (O(N log N), xác suất); Suffix Array của s + '#' + đảo ngược s đúng nhưng nặng. KMP và Z-function xử lý border và tiền tố, không cho palindrome trực tiếp; Trie và Suffix Automaton không khai thác tính đối xứng.",
      level: 2
    },
    {
      id: "q-manacher-2",
      prompt: "Xâu s dài 2·10^5, KHÔNG đổi. Có Q = 2·10^5 truy vấn (l, r): xâu con s[l..r] có phải palindrome không? Mỗi truy vấn cần trả lời nhanh (gần O(1)).",
      answer: ["manacher"],
      also: ["rolling-hash"],
      wrong: ["kmp", "trie", "suffix-automaton", "z-function"],
      why: "Chạy Manacher một lần O(N); mỗi truy vấn so d1 hoặc d2 của tâm đoạn với nửa độ dài, O(1) và chắc chắn. Hash xuôi và ngược cũng O(1) nhưng xác suất. KMP và Z-function chỉ trả lời về một mẫu hoặc tiền tố, không về đoạn bất kỳ; Trie và Suffix Automaton không cho biết tính đối xứng.",
      level: 2
    },
    {
      id: "q-xor-trie-1",
      prompt: "Cho mảng gồm n = 2·10^5 số nguyên không âm nhỏ hơn 2^30. Tìm hai phần tử ở hai chỉ số khác nhau sao cho XOR của chúng lớn nhất và in giá trị XOR đó.",
      answer: ["xor-trie"],
      also: [],
      wrong: ["sorting", "two-pointers", "segment-tree", "bit-manipulation"],
      why: "Duyệt từng phần tử và hỏi Binary Trie của các phần tử đã chèn: tham lam chọn nhánh bit đối ở mỗi bit từ cao xuống thấp, O(n·30). Sắp xếp rồi hai con trỏ không dùng được vì XOR không đơn điệu theo giá trị; Segment Tree không hỗ trợ truy vấn 'XOR lớn nhất với x'; thao tác bit chỉ là công cụ, tự nó không giải bài.",
      level: 2
    },
    {
      id: "q-xor-trie-2",
      prompt: "Cho dãy a gồm n = 10^5 số nguyên không âm nhỏ hơn 2^30. Tìm giá trị lớn nhất của a[l] XOR a[l+1] XOR … XOR a[r] trên mọi đoạn con liên tiếp 1 ≤ l ≤ r ≤ n.",
      answer: ["xor-trie"],
      also: [],
      wrong: ["kadane", "sliding-window", "two-pointers", "segment-tree"],
      why: "Đặt pre[i] là XOR của i phần tử đầu; XOR đoạn (l−1, r] = pre[r] XOR pre[l−1]. Bài trở thành tìm cặp XOR lớn nhất giữa các tiền tố: duyệt r và hỏi Binary Trie chứa pre[0..r−1]. Kadane dành cho tổng (cộng) và dựa vào việc bỏ tiền tố âm, XOR không có tính chất đó; cửa sổ trượt và hai con trỏ cần tính đơn điệu; Segment Tree cho XOR của một đoạn cho trước chứ không tìm đoạn tốt nhất.",
      level: 3
    },
    {
      id: "q-minimal-rotation-1",
      prompt: "Cho xâu s dài 10^6 gồm chữ thường. Được phép lặp lại thao tác 'chuyển ký tự đầu xuống cuối' tuỳ ý số lần. Tìm xâu nhỏ nhất theo thứ tự từ điển có thể thu được.",
      answer: ["minimal-rotation"],
      also: ["suffix-array"],
      wrong: ["kmp", "manacher", "z-function", "trie"],
      why: "Các xâu thu được chính là các dịch vòng của s; dịch vòng nhỏ nhất tìm trong O(n) bằng hai con trỏ (hoặc Booth, Duval). Suffix Array của s + s cũng cho kết quả nhưng nặng hơn O(n log n). KMP, Z-function tìm mẫu và border, Manacher tìm palindrome, Trie lưu tập xâu: không giải trực tiếp bài này.",
      level: 3
    },
    {
      id: "q-minimal-rotation-2",
      prompt: "Có N = 10^5 xâu chữ thường, tổng độ dài ≤ 10^6. Hai xâu được coi là giống nhau nếu xâu này thu được từ xâu kia bằng các lần chuyển ký tự đầu xuống cuối. Đếm số lớp xâu đôi một khác nhau.",
      answer: ["minimal-rotation"],
      also: [],
      wrong: ["kmp", "manacher", "aho-corasick", "suffix-automaton"],
      why: "Đưa mỗi xâu về dạng chuẩn là dịch vòng nhỏ nhất (O(độ dài)), rồi đếm các dạng chuẩn phân biệt bằng sắp xếp hoặc bảng băm. KMP kiểm tra được một CẶP xâu có là dịch vòng nhau (tìm b trong a + a) nhưng so mọi cặp là N² cặp. Manacher xét palindrome; Aho-Corasick và Suffix Automaton không cho dạng chuẩn của xâu vòng.",
      level: 4
    }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
