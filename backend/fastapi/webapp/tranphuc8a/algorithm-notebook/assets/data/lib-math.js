/* lib-math.js — Toán: số học cơ bản, modulo & tổ hợp, số nguyên tố & phân tích, đại số tuyến tính, biến đổi nhanh (FFT / NTT).
   Định dạng theo HUONG-DAN-SOAN.md (mẫu chuẩn: mục `dijkstra` trong lib-graph-1.js). */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ============================================================================================================ Số học cơ bản
    {
      id: "gcd-extgcd",
      name: "GCD & Euclid mở rộng",
      aliases: ["gcd", "ước chung lớn nhất", "euclid", "euclid mở rộng", "extended euclid", "extended gcd", "bezout", "đẳng thức bezout", "phương trình diophantine", "diophantine tuyến tính", "lcm", "bội chung nhỏ nhất", "bcnn", "ucln"],
      category: "math",
      sub: "Số học cơ bản",
      level: 2,
      tags: ["math", "number-theory", "gcd", "euclid", "diophantine"],
      summary: "Tìm ước chung lớn nhất của hai số và cặp hệ số Bezout (x, y) thoả a·x + b·y = gcd(a, b); nền tảng của nghịch đảo modulo, CRT và phương trình Diophantine tuyến tính.",
      description:
        "**Euclid**: gcd(a, b) = gcd(b, a mod b), dừng khi b = 0. Sau hai bước số nhỏ hơn giảm ít nhất một nửa nên chỉ cần O(log min(a, b)) phép chia. C++17 có sẵn `std::gcd` / `std::lcm` trong `<numeric>` (và `__gcd` của GCC).\n\n" +
        "**Euclid mở rộng** chạy cùng quá trình đó nhưng truy hồi thêm hệ số: nếu b·x' + (a mod b)·y' = g thì a·y' + b·(x' − ⌊a/b⌋·y') = g, tức x = y', y = x' − ⌊a/b⌋·y'. Kết quả là đẳng thức Bezout a·x + b·y = g. Từ đó có ba ứng dụng lớn: nghịch đảo modulo (khi g = 1), gộp đồng dư (CRT) và giải phương trình Diophantine a·x + b·y = c, có nghiệm khi và chỉ khi g | c.\n\n" +
        "Nghiệm tổng quát của a·x + b·y = c là (x₀ + k·b/g, y₀ − k·a/g) với mọi số nguyên k, nên nghiệm x không âm nhỏ nhất là x₀ mod (b/g). Hàm `diophantine` trong mẫu trả đúng nghiệm đó và nhân bằng `__int128` để không tràn. Với bội chung nhỏ nhất: lcm = a / gcd · b (chia trước khi nhân).",
      conditions: [
        "Số nguyên có dấu, |a|, |b|, |c| ≤ 10^18 (mẫu không hỗ trợ LLONG_MIN)",
        "a·x + b·y = c có nghiệm khi và chỉ khi gcd(a, b) chia hết c",
        "Quy ước của mẫu: gcd(0, 0) = 0, gcd(a, 0) = |a|, lcm với số 0 bằng 0"
      ],
      complexity: { time: "O(log min(|a|, |b|))", space: "O(log min(|a|, |b|))", note: "Độ sâu đệ quy của ext_gcd chưa tới 100 tầng với số 64 bit (tệ nhất là hai số Fibonacci liên tiếp), không lo tràn stack. Hệ số trả về thoả |x|, |y| ≤ max(|a|, |b|)." },
      ops: [["gcd", "O(log min(a, b))"], ["Euclid mở rộng", "O(log min(a, b))"], ["Giải a·x + b·y = c", "O(log min(a, b))"], ["lcm", "O(log min(a, b))"]],
      use_case: [
        "Rút gọn phân số, kiểm tra hai số nguyên tố cùng nhau",
        "Tính nghịch đảo modulo với modulo bất kỳ (không cần nguyên tố)",
        "Phương trình Diophantine tuyến tính: bài đong nước, bài cân, bài tìm điểm nguyên trên đường thẳng",
        "Gộp hai đồng dư khi mô-đun không nguyên tố cùng nhau (CRT)",
        "Tìm thời điểm hai quá trình tuần hoàn gặp nhau (dùng lcm)"
      ],
      not_for: [
        "Nghịch đảo modulo nguyên tố cho rất nhiều số → bảng nghịch đảo tuyến tính hoặc nghịch đảo hàng loạt (xem mục Nghịch đảo modulo)",
        "Phân tích số ra thừa số nguyên tố → sàng hoặc Pollard's Rho, gcd không làm được việc đó"
      ],
      pitfalls: [
        "Quên điều kiện gcd(a, b) | c nên in một nghiệm sai thay vì báo vô nghiệm.",
        "Nhân x₀ với c/g bằng long long thì tràn — dùng __int128 trước khi rút gọn theo b/g (mẫu đã làm).",
        "Với a âm, `a % b` trong C++ mang dấu của a; Euclid mở rộng vẫn đúng nhưng x, y có thể âm — chuẩn hoá bằng ((x % m) + m) % m khi cần nghịch đảo.",
        "lcm = a * b / gcd tràn trước khi chia; luôn viết a / gcd * b và kiểm tra giới hạn kết quả.",
        "gcd(0, 0) không xác định trong toán — đề thường quy ước bằng 0; coi chừng chia cho gcd này."
      ],
      code: {
        lang: "cpp", title: "gcd-extgcd.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// GCD, lcm, Euclid mở rộng và phương trình Diophantine a*x + b*y = c.
// Quy ước: gcd(0, 0) = 0; gcd luôn >= 0; số nguyên có dấu, |a|, |b|, |c| <= 1e18.

long long gcd_ll(long long a, long long b) {
    while (b != 0) { long long t = a % b; a = b; b = t; }
    return a < 0 ? -a : a;
}

long long lcm_ll(long long a, long long b) {      // lcm >= 0; chia trước khi nhân, nhưng kết quả vẫn có thể tràn
    if (a == 0 || b == 0) return 0;
    return llabs(a / gcd_ll(a, b) * b);
}

// Trả g = gcd(a, b) >= 0 và tìm x, y sao cho a*x + b*y = g (|x|, |y| <= max(|a|, |b|)).
long long ext_gcd(long long a, long long b, long long& x, long long& y) {
    if (b == 0) {
        x = a >= 0 ? 1 : -1; y = 0;
        return a >= 0 ? a : -a;
    }
    long long x1, y1;
    long long g = ext_gcd(b, a % b, x1, y1);
    x = y1;
    y = x1 - (a / b) * y1;
    return g;
}

// Giải a*x + b*y = c. false nếu vô nghiệm. Nghiệm tổng quát: (x + k*b/g, y - k*a/g), g = gcd(a, b).
// Khi b != 0 trả về nghiệm có x nhỏ nhất không âm (0 <= x < |b/g|).
bool diophantine(long long a, long long b, long long c, long long& x, long long& y) {
    long long x0, y0;
    long long g = ext_gcd(a, b, x0, y0);
    if (g == 0) { x = y = 0; return c == 0; }          // a = b = 0
    if (c % g != 0) return false;
    if (b == 0) { x = c / a; y = 0; return true; }
    long long step = llabs(b / g);
    __int128 xx = (__int128)x0 * (c / g) % step;       // rút gọn theo b/g, không tràn nhờ __int128
    if (xx < 0) xx += step;
    x = (long long)xx;
    y = (long long)(((__int128)c - (__int128)a * x) / b);
    return true;
}
`
      },
      example: {
        input: "a = 240, b = 46",
        output: "gcd = 2, x = -9, y = 47",
        explain: "240·(−9) + 46·47 = −2160 + 2162 = 2. Euclid: 240 = 5·46 + 10, 46 = 4·10 + 6, 10 = 1·6 + 4, 6 = 1·4 + 2, 4 = 2·2 nên gcd = 2; lùi lại từng bước để lấy (x, y). Phương trình 240x + 46y = 7 vô nghiệm vì 2 không chia hết 7."
      },
      problems: [
        { site: "cf", id: "7C", name: "Line" },
        { site: "cf", id: "710D", name: "Two Arithmetic Progressions" }
      ],
      related: ["modular-inverse", "crt", "euler-phi", "fast-pow"],
      compare: { "Bài toán giải": "Ước chung lớn nhất, hệ số Bezout, phương trình Diophantine tuyến tính", "Ràng buộc": "Mọi số nguyên có dấu, không cần nguyên tố", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Phương trình a·x + b·y = c có nghiệm nguyên khi nào?", a: "Khi và chỉ khi gcd(a, b) chia hết c. Khi đó nghiệm tổng quát là (x₀ + k·b/g, y₀ − k·a/g)." },
        { q: "Độ phức tạp của Euclid (và Euclid mở rộng)?", a: "O(log min(a, b)); trường hợp tệ nhất là hai số Fibonacci liên tiếp." },
        { q: "Hệ thức truy hồi của Euclid mở rộng?", a: "Nếu b·x' + (a mod b)·y' = g thì x = y', y = x' − ⌊a/b⌋·y'; đáy: b = 0 cho x = 1, y = 0, g = a." },
        { q: "Vì sao tính lcm là a / gcd · b mà không phải a · b / gcd?", a: "a · b có thể tràn dù lcm vừa kiểu số; chia trước khi nhân tránh được tràn trung gian." }
      ]
    },

    {
      id: "fast-pow",
      name: "Luỹ thừa nhanh",
      aliases: ["luỹ thừa nhanh", "binary exponentiation", "exponentiation by squaring", "fast exponentiation", "pow mod", "modular exponentiation", "bình phương liên tiếp", "square and multiply", "luỹ thừa modulo"],
      category: "math",
      sub: "Số học cơ bản",
      level: 1,
      tags: ["math", "number-theory", "modular-arithmetic", "binary-exponentiation", "divide-and-conquer"],
      summary: "Tính a^e (mod m) trong O(log e) phép nhân bằng cách bình phương liên tiếp theo các bit của e; nền tảng của nghịch đảo Fermat, luỹ thừa ma trận và kiểm tra nguyên tố.",
      description:
        "Luỹ thừa nhanh (**binary exponentiation**) viết e theo nhị phân: a^e = Π a^(2^i) lấy trên các bit i của e bằng 1. Mỗi bước bình phương cơ số và nhân vào kết quả khi bit hiện tại là 1, nên chỉ cần O(log e) phép nhân thay vì e phép.\n\n" +
        "Trong modulo, mọi phép nhân lấy dư ngay. Với modulo cỡ 10^9 tích vừa `long long`; với modulo tới ~9·10^18 phải nhân 128 bit (`__int128`) — mẫu dùng `mul_mod` an toàn cho cả hai trường hợp.\n\n" +
        "Cùng khung này dùng được cho mọi phép toán **kết hợp**: nhân ma trận (xem Luỹ thừa ma trận), nhân đa thức modulo, hợp hàm. Hai ứng dụng kinh điển khác: nghịch đảo theo Fermat a^(p−2) khi p nguyên tố, và rút gọn số mũ rất lớn nhờ định lý Euler (a^e ≡ a^(e mod φ(m)) khi gcd(a, m) = 1; xem Hàm phi Euler).",
      conditions: [
        "Phép nhân phải có tính kết hợp (số, ma trận, hàm…)",
        "Số mũ e ≥ 0 (số mũ âm: lấy nghịch đảo của cơ số trước)",
        "Modulo m ≥ 1; m tới ~9·10^18 vẫn đúng nhờ nhân bằng __int128"
      ],
      complexity: { time: "O(log e)", space: "O(1)", note: "Mỗi bước 1–2 phép nhân modulo; số mũ 10^18 chỉ cần khoảng 60 bước." },
      ops: [["a^e mod m", "O(log e)"], ["Nghịch đảo Fermat a^(p−2) mod p", "O(log p)"]],
      use_case: [
        "Tính a^b mod p với b tới 10^18 (rất nhiều bài đếm)",
        "Nghịch đảo modulo nguyên tố bằng định lý Fermat",
        "Kiểm tra nguyên tố (Fermat, Miller–Rabin) và Pollard's Rho",
        "Công thức đếm dạng k^n, 2^n trong các bài tổ hợp",
        "Khung cho luỹ thừa ma trận và nhân đa thức modulo"
      ],
      not_for: [
        "Cần a^e chính xác (không modulo) với kết quả khổng lồ → số lớn (BigInteger); luỹ thừa nhanh chỉ nhanh phần nhân",
        "Tính a^(b^c) mod m với b^c rất lớn → rút gọn số mũ bằng Euler/Fermat trước (xem Hàm phi Euler), rồi mới luỹ thừa nhanh"
      ],
      pitfalls: [
        "Tràn khi nhân hai số cỡ 10^10 trở lên bằng long long — nhân qua __int128 (mul_mod).",
        "Quên lấy dư a trước khi vào vòng lặp (a âm hoặc a ≥ m).",
        "Quy ước 0^0 = 1; với m = 1 kết quả luôn 0 (khởi tạo r = 1 % m chứ không phải 1).",
        "Dùng int cho số mũ khi e tới 10^18 — dùng unsigned long long / long long.",
        "Rút gọn số mũ theo (p − 1) chỉ đúng khi gcd(a, p) = 1; với a ≡ 0 (mod p) kết quả là 0 (nếu e > 0), phải xử lý riêng.",
        "Luỹ thừa không modulo: bước bình phương cuối cũng có thể tràn dù kết quả vừa — mẫu pow_ll chỉ bình phương khi còn bit."
      ],
      code: {
        lang: "cpp", title: "fast-pow.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Luỹ thừa nhanh. a^e mod m với e >= 0, m >= 1, m tới ~9e18 (nhân 128 bit).

// a * b mod m an toàn khi m lớn. (Với m < 2^31 có thể nhân thẳng bằng long long.)
long long mul_mod(long long a, long long b, long long m) {
    return (long long)((__int128)a * b % m);
}

// a^e mod m; a có thể âm hoặc lớn; quy ước 0^0 = 1; với m = 1 trả 0.
long long pow_mod(long long a, unsigned long long e, long long m) {
    long long r = 1 % m;
    a %= m;
    if (a < 0) a += m;
    while (e > 0) {
        if (e & 1) r = mul_mod(r, a, m);
        a = mul_mod(a, a, m);
        e >>= 1;
    }
    return r;
}

// a^e không modulo (e >= 0). CẢNH BÁO: tràn nếu kết quả vượt long long.
long long pow_ll(long long a, int e) {
    long long r = 1;
    for (; e > 0; e >>= 1) {
        if (e & 1) r *= a;
        if (e > 1) a *= a;                              // không bình phương khi đã hết bit: tránh tràn thừa
    }
    return r;
}
`
      },
      example: {
        input: "a = 2, e = 10, m = 1000",
        output: "24",
        explain: "2^10 = 1024, 1024 mod 1000 = 24. Nhị phân của 10 là 1010 nên chỉ nhân các luỹ thừa a^2 = 4 và a^8 = 256: 4 · 256 = 1024 ≡ 24."
      },
      problems: [
        { site: "cses", id: "1095", name: "Exponentiation" },
        { site: "cses", id: "1712", name: "Exponentiation II" }
      ],
      related: ["modular-inverse", "matrix-exponentiation", "euler-phi", "miller-rabin"],
      compare: { "Bài toán giải": "a^e mod m", "Ràng buộc": "e ≥ 0, phép nhân có tính kết hợp", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Luỹ thừa nhanh tốn bao nhiêu phép nhân?", a: "O(log e): mỗi bit của e tốn tối đa 2 phép nhân (bình phương và nhân vào kết quả)." },
        { q: "Làm sao tính a^(−1) mod p khi p nguyên tố?", a: "Theo định lý Fermat nhỏ: a^(p−2) mod p, bằng một lần luỹ thừa nhanh." },
        { q: "Vì sao cần __int128 khi nhân modulo?", a: "Hai số < m có tích tới m²; với m > 3·10^9 tích vượt long long. __int128 chứa được tích tới ~1.7·10^38." },
        { q: "Khi rút gọn số mũ theo p − 1 (a^e mod p) cần lưu ý gì?", a: "Chỉ đúng khi gcd(a, p) = 1. Nếu p | a thì a^e ≡ 0 với mọi e > 0 và phải xử lý riêng." }
      ]
    },

    // ============================================================================================================ Modulo & tổ hợp
    {
      id: "modular-inverse",
      name: "Nghịch đảo modulo",
      aliases: ["nghịch đảo modulo", "modular inverse", "inverse mod", "modular multiplicative inverse", "chia modulo", "định lý fermat nhỏ", "fermat little theorem", "nghịch đảo hàng loạt", "batch inverse", "a mũ -1"],
      category: "math",
      sub: "Modulo & tổ hợp",
      level: 2,
      tags: ["math", "number-theory", "modular-arithmetic", "inverse", "fermat"],
      summary: "Tìm x thoả a·x ≡ 1 (mod m) để chia trong số học modulo: bằng Euclid mở rộng cho m bất kỳ, bằng Fermat khi m nguyên tố, và bảng/hàng loạt khi cần nhiều giá trị.",
      description:
        "Nghịch đảo của a theo modulo m là số x thoả a·x ≡ 1 (mod m). Nó tồn tại **khi và chỉ khi gcd(a, m) = 1** và khi đó duy nhất theo modulo m. Dùng để \"chia\" trong số học modulo: a / b ≡ a · b⁻¹.\n\n" +
        "Ba cách chính: (1) **Euclid mở rộng** — dùng được với mọi m, O(log m); (2) **Fermat** khi m = p nguyên tố: a⁻¹ ≡ a^(p−2) (mod p), tức một lần luỹ thừa nhanh; (3) **Euler** khi m bất kỳ: a⁻¹ ≡ a^(φ(m)−1), nhưng cần biết φ(m).\n\n" +
        "Khi cần nghịch đảo của nhiều số, đừng gọi từng lần O(log p). Bảng nghịch đảo **1..n** theo công thức inv[i] = −⌊p/i⌋ · inv[p mod i] chạy O(n) (suy từ p = ⌊p/i⌋·i + p mod i). Nghịch đảo hàng loạt của một dãy bất kỳ chỉ tốn **một** lần nghịch đảo cộng khoảng 3n phép nhân nhờ tích tiền tố: nghịch đảo tích toàn dãy, rồi lùi dần để tách từng phần tử.",
      conditions: [
        "gcd(a, m) = 1 (nếu không, nghịch đảo không tồn tại — mẫu mod_inv trả −1)",
        "Cách Fermat và bảng tuyến tính chỉ đúng khi m = p là số nguyên tố",
        "Bảng 1..n cần n < p; bảng và nghịch đảo hàng loạt giả sử p ≲ 3·10^9 để tích vừa long long"
      ],
      complexity: { time: "O(log m) cho một số", space: "O(1)", note: "Bảng nghịch đảo 1..n: O(n) thời gian và bộ nhớ. Nghịch đảo hàng loạt n số: O(n + log p)." },
      ops: [["Một nghịch đảo (Euclid mở rộng / Fermat)", "O(log m)"], ["Bảng nghịch đảo 1..n", "O(n)"], ["Nghịch đảo hàng loạt n số", "O(n + log p)"]],
      use_case: [
        "Chia trong modulo: tính a / b mod p trong bài đếm, xác suất, kỳ vọng",
        "Tổ hợp C(n, r) mod p cần nghịch đảo giai thừa",
        "Giải phương trình đồng dư a·x ≡ b (mod m)",
        "Hash đa thức, chia khoảng cách trong các bài xác suất modulo",
        "Khử các phép chia khi dùng công thức nội suy Lagrange modulo"
      ],
      not_for: [
        "Modulo hợp số mà gcd(a, m) > 1 → nghịch đảo không tồn tại; chia cả hai vế cho gcd rồi giải trên modulo nhỏ hơn",
        "Cần nghịch đảo của mọi số 1..n với p nguyên tố → dùng bảng tuyến tính thay vì gọi từng lần luỹ thừa nhanh"
      ],
      pitfalls: [
        "Dùng a^(m−2) khi m là hợp số cho kết quả sai (và không báo lỗi).",
        "Quên chuẩn hoá a âm hoặc a ≥ m, hoặc trả về số âm từ Euclid mở rộng.",
        "a ≡ 0 (mod p) không có nghịch đảo — thường gặp khi n ≥ p trong các bài tổ hợp (giai thừa chứa p).",
        "Nhân hai số cỡ 10^9 vẫn vừa long long, nhưng modulo cỡ 10^18 phải dùng __int128 (mod_inv_prime của mẫu đã dùng).",
        "Công thức bảng tuyến tính inv[i] = −⌊p/i⌋·inv[p mod i] cần p nguyên tố và i < p."
      ],
      code: {
        lang: "cpp", title: "modular-inverse.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Nghịch đảo modulo. Mọi hàm tự chuẩn hoá a âm / a >= m.

// 1) Euclid mở rộng (lặp): modulo m BẤT KỲ (1 <= m <= ~1e18). Trả -1 nếu gcd(a, m) != 1.
long long mod_inv(long long a, long long m) {
    a %= m;
    if (a < 0) a += m;
    long long r0 = a, r1 = m, s0 = 1, s1 = 0;          // luôn có r_i ≡ s_i * a (mod m)
    while (r1 != 0) {
        long long q = r0 / r1, t = r0 - q * r1;
        r0 = r1; r1 = t;
        t = s0 - q * s1; s0 = s1; s1 = t;
    }
    if (r0 != 1) return -1;                             // gcd(a, m) = r0 != 1
    return (s0 % m + m) % m;
}

// 2) Fermat: p NGUYÊN TỐ, a không chia hết cho p. a^(p-2) mod p, nhân 128 bit nên p tới ~1e18.
long long mod_inv_prime(long long a, long long p) {
    unsigned long long r = 1, b = ((a % p) + p) % p, e = p - 2;
    for (; e > 0; e >>= 1, b = (__int128)b * b % p)
        if (e & 1) r = (__int128)r * b % p;
    return r;
}

// 3) Bảng inv[1..n] trong O(n): p nguyên tố, n < p, p <= ~3e9.
vector<long long> inv_table(int n, long long p) {
    vector<long long> inv(n + 1, 0);
    if (n >= 1) inv[1] = 1;
    for (int i = 2; i <= n; i++) inv[i] = (p - (p / i) * inv[p % i] % p) % p;
    return inv;
}

// 4) Nghịch đảo hàng loạt: chỉ MỘT lần nghịch đảo. p nguyên tố, p <= ~3e9, mọi a[i] không chia hết cho p.
vector<long long> inv_batch(const vector<long long>& a, long long p) {
    int n = a.size();
    vector<long long> pre(n + 1, 1), res(n);
    for (int i = 0; i < n; i++) pre[i + 1] = pre[i] * (((a[i] % p) + p) % p) % p;
    long long cur = n ? mod_inv_prime(pre[n], p) : 1;   // nghịch đảo của tích cả dãy
    for (int i = n - 1; i >= 0; i--) {
        res[i] = cur * pre[i] % p;                      // = 1 / a[i]
        cur = cur * (((a[i] % p) + p) % p) % p;         // bỏ a[i] khỏi tích
    }
    return res;
}
`
      },
      example: {
        input: "a = 3, m = 11",
        output: "4",
        explain: "3·4 = 12 ≡ 1 (mod 11). Với a = 6, m = 9: gcd(6, 9) = 3 ≠ 1 nên không có nghịch đảo (mod_inv trả −1)."
      },
      problems: [
        { site: "cses", id: "1079", name: "Binomial Coefficients" },
        { site: "cses", id: "1715", name: "Creating Strings II" },
        { site: "cses", id: "1716", name: "Distributing Apples" }
      ],
      related: ["gcd-extgcd", "fast-pow", "ncr-mod", "euler-phi", "crt"],
      compare: { "Bài toán giải": "Chia trong số học modulo (tìm a⁻¹)", "Ràng buộc": "gcd(a, m) = 1; cách Fermat cần m nguyên tố", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Nghịch đảo của a theo modulo m tồn tại khi nào?", a: "Khi và chỉ khi gcd(a, m) = 1; khi đó duy nhất theo modulo m." },
        { q: "Hai cách tính a⁻¹ mod p khi p nguyên tố?", a: "Fermat: a^(p−2) mod p bằng luỹ thừa nhanh, hoặc Euclid mở rộng O(log p). Cả hai O(log p)." },
        { q: "Nghịch đảo của n số liên tiếp 1..n trong O(n)?", a: "inv[i] = −⌊p/i⌋ · inv[p mod i] (mod p), với p nguyên tố và n < p." },
        { q: "Nghịch đảo hàng loạt hoạt động thế nào?", a: "Tính tích tiền tố, lấy MỘT nghịch đảo của tích toàn dãy, rồi lùi: inv[i] = (nghịch đảo tích đến i) · (tích đến i−1), sau đó nhân a[i] vào để chuyển sang phần tử trước." }
      ]
    },

    {
      id: "crt",
      name: "Định lý phần dư Trung Hoa (CRT)",
      aliases: ["crt", "chinese remainder theorem", "định lý phần dư trung hoa", "đồng dư", "hệ đồng dư", "garner", "system of congruences", "hệ phương trình đồng dư", "gộp đồng dư"],
      category: "math",
      sub: "Modulo & tổ hợp",
      level: 3,
      tags: ["math", "number-theory", "modular-arithmetic", "crt", "congruence"],
      summary: "Giải hệ x ≡ a_i (mod m_i) với mô-đun bất kỳ bằng cách gộp từng cặp qua Euclid mở rộng: vô nghiệm hoặc nghiệm duy nhất modulo lcm(m_i).",
      description:
        "**Định lý phần dư Trung Hoa**: hệ x ≡ a_i (mod m_i) với các m_i đôi một nguyên tố cùng nhau luôn có nghiệm duy nhất modulo M = Π m_i. Trong thực tế đề thường cho m_i **không** nguyên tố cùng nhau; khi đó hệ có thể vô nghiệm, và nếu có nghiệm thì nghiệm duy nhất modulo **lcm(m_i)**.\n\n" +
        "Cách gọn nhất là **gộp từng cặp**: x ≡ a₁ (mod m₁) và x ≡ a₂ (mod m₂). Đặt g = gcd(m₁, m₂) và Euclid mở rộng m₁·u + m₂·v = g. Hệ có nghiệm khi và chỉ khi g | (a₂ − a₁); khi đó x = a₁ + m₁·t với t ≡ ((a₂ − a₁)/g) · u (mod m₂/g), và nghiệm là x ≡ x₀ (mod lcm(m₁, m₂)). Kết quả lại là một đồng dư, gộp tiếp với phương trình sau.\n\n" +
        "Gộp từng cặp tránh được công thức giáo khoa M · (M/m_i)⁻¹ (dễ tràn và đòi hỏi nguyên tố cùng nhau). Các phép nhân dùng `__int128` nên lcm tới ~9·10^18 vẫn an toàn.",
      conditions: [
        "m_i ≥ 1; lcm của tất cả m_i phải vừa long long (< ~9.2·10^18) — mẫu không kiểm tra tràn",
        "a_i có thể âm hoặc ≥ m_i (mẫu tự chuẩn hoá)",
        "Không yêu cầu m_i nguyên tố cùng nhau; vô nghiệm → trả {-1, -1}"
      ],
      complexity: { time: "O(k log m)", space: "O(1)", note: "k = số phương trình; mỗi lần gộp tốn một Euclid mở rộng O(log m)." },
      ops: [["Gộp hai đồng dư", "O(log m)"], ["Gộp k đồng dư", "O(k log m)"]],
      use_case: [
        "Tìm số khi biết số dư theo nhiều modulo (lịch lặp chu kỳ, vòng quay, đồng hồ)",
        "Tính nCr hoặc giá trị khác modulo hợp số: tách modulo thành các luỹ thừa nguyên tố, tính riêng rồi ghép",
        "Khôi phục đáp án lớn từ nhiều modulo nhỏ (NTT nhiều modulo, Garner)",
        "Giao của nhiều cấp số cộng a_i + m_i·k (số chung của các dãy)"
      ],
      not_for: [
        "Hệ có hệ số trước biến tuỳ ý (a·x ≡ b) → đưa về dạng x ≡ c bằng nghịch đảo hoặc dùng Euclid mở rộng trước",
        "lcm vượt 64 bit → cần số lớn, hoặc giữ kết quả dạng từng phần (Garner)"
      ],
      pitfalls: [
        "Giả sử modulo nguyên tố cùng nhau rồi dùng công thức Σ a_i·M_i·inv(M_i): sai (hoặc không có nghịch đảo) khi gcd > 1.",
        "Quên kiểm tra g | (a₂ − a₁): hệ vô nghiệm bị in ra một số vô nghĩa.",
        "Nhân (a₂ − a₁)/g với u bằng long long thì tràn — dùng __int128 và rút gọn theo m₂/g.",
        "lcm = m₁·m₂/g tràn nếu tính m₁·m₂ trước; chia g trước (mẫu: m1 / g * m2).",
        "Quên chuẩn hoá a_i âm hoặc ≥ m_i trước khi gộp."
      ],
      code: {
        lang: "cpp", title: "crt.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// CRT cho mô-đun BẤT KỲ (không cần nguyên tố cùng nhau), gộp từng cặp. x ≡ a (mod m), m >= 1.
// Kết quả {r, M}: mọi x ≡ r (mod M), 0 <= r < M = lcm các mô-đun; vô nghiệm -> {-1, -1}.
// Yêu cầu lcm vừa long long (< ~9.2e18).

// Euclid mở rộng (lặp), a, b >= 0: trả g = gcd(a, b) và x sao cho a*x ≡ g (mod b).
static long long crt_egcd(long long a, long long b, long long& x) {
    long long x0 = 1, x1 = 0;
    while (b != 0) {
        long long q = a / b, t = a - q * b;
        a = b; b = t;
        t = x0 - q * x1; x0 = x1; x1 = t;
    }
    x = x0;
    return a;
}

pair<long long, long long> crt_merge(long long a1, long long m1, long long a2, long long m2) {
    a1 %= m1; if (a1 < 0) a1 += m1;
    a2 %= m2; if (a2 < 0) a2 += m2;
    long long x, g = crt_egcd(m1, m2, x);               // m1 * x ≡ g (mod m2)
    long long diff = a2 - a1;
    if (diff % g != 0) return {-1, -1};                 // vô nghiệm
    long long m2g = m2 / g;
    __int128 t = (__int128)(diff / g) % m2g * x % m2g;  // m1 * t ≡ a2 - a1 (mod m2)
    if (t < 0) t += m2g;
    long long lcm = m1 / g * m2;                        // chia g trước khi nhân
    return {(long long)((a1 + (__int128)m1 * t) % lcm), lcm};
}

pair<long long, long long> crt(const vector<long long>& a, const vector<long long>& m) {
    pair<long long, long long> cur = {0, 1};            // x ≡ 0 (mod 1): mọi số
    for (size_t i = 0; i < a.size(); i++) {
        cur = crt_merge(cur.first, cur.second, a[i], m[i]);
        if (cur.second < 0) return {-1, -1};
    }
    return cur;
}
`
      },
      example: {
        input: "x ≡ 2 (mod 3), x ≡ 3 (mod 5), x ≡ 2 (mod 7)",
        output: "x ≡ 23 (mod 105)",
        explain: "23 mod 3 = 2, 23 mod 5 = 3, 23 mod 7 = 2 và 105 = 3·5·7. Mô-đun không nguyên tố cùng nhau: x ≡ 1 (mod 4), x ≡ 3 (mod 6) có g = 2 chia hết 3 − 1 nên nghiệm là x ≡ 9 (mod 12); còn x ≡ 0 (mod 4), x ≡ 1 (mod 6) vô nghiệm vì x chẵn theo phương trình đầu nhưng lẻ theo phương trình sau."
      },
      problems: [
        { site: "cf", id: "710D", name: "Two Arithmetic Progressions" },
        { site: "cf", id: "338D", name: "GCD Table" }
      ],
      related: ["gcd-extgcd", "modular-inverse", "euler-phi", "ntt"],
      compare: { "Bài toán giải": "Tìm x khi biết x mod nhiều modulo", "Ràng buộc": "m_i bất kỳ; lcm vừa 64 bit", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "CRT cho hệ x ≡ a_i (mod m_i) với m_i đôi một nguyên tố cùng nhau cho kết quả gì?", a: "Một nghiệm duy nhất modulo M = Π m_i." },
        { q: "Khi m_i không nguyên tố cùng nhau thì sao?", a: "Có thể vô nghiệm; nếu có nghiệm thì duy nhất modulo lcm(m_i). Cặp (a₁, m₁), (a₂, m₂) giải được khi và chỉ khi gcd(m₁, m₂) | (a₂ − a₁)." },
        { q: "Cách gộp hai đồng dư?", a: "g = gcd(m₁, m₂), m₁·u + m₂·v = g, x = a₁ + m₁·t với t ≡ ((a₂ − a₁)/g)·u (mod m₂/g); kết quả modulo lcm(m₁, m₂)." },
        { q: "Hai rủi ro tràn khi cài CRT?", a: "Tích (a₂ − a₁)/g · u (dùng __int128, rút gọn theo m₂/g) và lcm = m₁·m₂/g (chia g trước khi nhân)." }
      ]
    },

    {
      id: "ncr-mod",
      name: "Tổ hợp modulo (nCr)",
      aliases: ["ncr mod", "tổ hợp modulo", "binomial coefficient mod", "hệ số nhị thức", "chỉnh hợp", "giai thừa nghịch đảo", "lucas theorem", "định lý lucas", "catalan", "c(n, k) mod p", "stars and bars"],
      category: "math",
      sub: "Modulo & tổ hợp",
      level: 2,
      tags: ["math", "combinatorics", "modular-arithmetic", "binomial", "lucas"],
      summary: "Tính C(n, r) mod p nguyên tố: tiền xử lý giai thừa và nghịch đảo giai thừa để mỗi truy vấn O(1); định lý Lucas khi n ≥ p; số Catalan từ cùng bảng.",
      description:
        "C(n, r) mod p với p **nguyên tố** và n < p tính nhanh bằng **giai thừa**: C(n, r) = n! · (r!)⁻¹ · ((n−r)!)⁻¹. Tiền xử lý fact[0..N] và inv_fact[0..N] tốn O(N); chỉ cần **một** lần luỹ thừa Fermat cho inv_fact[N], các giá trị còn lại suy ra bằng inv_fact[i−1] = inv_fact[i]·i. Mỗi truy vấn sau đó chỉ là hai phép nhân modulo.\n\n" +
        "Khi n ≥ p (hoặc p nhỏ như 2, 3, 10007), giai thừa chứa thừa số p nên không có nghịch đảo — dùng **định lý Lucas**: viết n, r theo cơ số p, C(n, r) ≡ Π C(n_i, r_i) (mod p), bằng 0 nếu có r_i > n_i. Mẫu cài Lucas cần bảng giai thừa tới p − 1; mỗi truy vấn O(log_p n).\n\n" +
        "Modulo hợp số: nếu n nhỏ (≲ 5000) dùng tam giác Pascal O(n²), không cần nghịch đảo; nếu n lớn thì tách modulo thành các luỹ thừa nguyên tố, tính từng phần (khái quát Lucas theo Granville, khá phức tạp) rồi ghép bằng CRT. Số Catalan C(2n, n) / (n+1) lấy luôn từ bảng này.",
      conditions: [
        "p nguyên tố và N < p để giai thừa có nghịch đảo (p = 10^9 + 7 hoặc 998244353 là hai modulo thường gặp)",
        "N cỡ ≤ 10^7 (hai bảng long long tốn 16·N byte); tích hai số < p phải vừa long long (p ≲ 3·10^9)",
        "Lucas: p nhỏ (≲ 10^6) vì cần bảng tới p − 1"
      ],
      complexity: { time: "O(N + log p) tiền xử lý, O(1) mỗi truy vấn", space: "O(N)", note: "Lucas: O(log_p n) mỗi truy vấn. Pascal modulo bất kỳ: O(N²) thời gian." },
      ops: [["Tiền xử lý fact và inv_fact", "O(N + log p)"], ["Một truy vấn C(n, r)", "O(1)"], ["Một truy vấn Lucas (p nhỏ)", "O(log_p n)"], ["Tam giác Pascal modulo bất kỳ", "O(N²)"]],
      use_case: [
        "Đếm số cách chọn / sắp xếp modulo 10^9 + 7",
        "Đếm đường đi trên lưới (có vật cản: kết hợp bao hàm–loại trừ)",
        "Số Catalan, dãy ngoặc đúng, bài chia kẹo (stars and bars)",
        "Rất nhiều truy vấn C(n, r) với n ≤ 10^6–10^7",
        "n tới 10^18 nhưng p nhỏ (Lucas)"
      ],
      not_for: [
        "Modulo hợp số → tam giác Pascal nếu n nhỏ, hoặc tách luỹ thừa nguyên tố + CRT",
        "Cần C(n, r) chính xác (không modulo) với kết quả lớn → số lớn hoặc __int128 cho n nhỏ",
        "n ≥ p mà p lớn (≳ 10^7) → không dựng nổi bảng tới p; dùng công thức Legendre / nhân từng đoạn"
      ],
      pitfalls: [
        "Dựng bảng tới N ≥ p: fact[p] ≡ 0 nên inv_fact không tồn tại — phải dùng Lucas (mẫu có assert).",
        "Tràn: viết fact[n] * inv_fact[r] % p * inv_fact[n − r] % p — lấy % sau MỖI phép nhân, không nhân ba số rồi mới %.",
        "Quên trường hợp r < 0 hoặc r > n (phải trả 0, không được truy cập ngoài mảng).",
        "Tính từng inv_fact[i] bằng luỹ thừa riêng thì O(N log p) — chỉ tính inv_fact[N] rồi lùi.",
        "Lucas mà bảng giai thừa chưa tới p − 1: n_i, r_i có thể lên tới p − 1 nên truy cập ngoài bảng."
      ],
      code: {
        lang: "cpp", title: "ncr-mod.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// C(n, r) mod p, p NGUYÊN TỐ, n <= N < p (p <= ~3e9 để tích vừa long long). Dựng O(N); mỗi truy vấn O(1).
// lucas(n, r): dùng khi n >= p (p nhỏ) — dựng bảng với N = p - 1; mỗi truy vấn O(log_p n).
struct Binomial {
    long long p;
    vector<long long> fact, inv_fact;

    static long long power(long long a, long long e, long long m) {
        long long r = 1;
        for (a %= m; e > 0; e >>= 1, a = a * a % m)
            if (e & 1) r = r * a % m;
        return r;
    }
    Binomial(int N, long long mod) : p(mod), fact(N + 1), inv_fact(N + 1) {
        assert(N < mod);
        fact[0] = 1;
        for (int i = 1; i <= N; i++) fact[i] = fact[i - 1] * i % p;
        inv_fact[N] = power(fact[N], p - 2, p);          // chỉ MỘT lần luỹ thừa
        for (int i = N; i >= 1; i--) inv_fact[i - 1] = inv_fact[i] * i % p;
    }
    long long C(long long n, long long r) const {         // yêu cầu n <= N
        if (r < 0 || r > n) return 0;
        return fact[n] * inv_fact[r] % p * inv_fact[n - r] % p;
    }
    long long lucas(long long n, long long r) const {     // yêu cầu bảng tới p - 1
        long long res = 1;
        while (n > 0 || r > 0) {
            long long ni = n % p, ri = r % p;
            if (ri > ni) return 0;
            res = res * C(ni, ri) % p;
            n /= p; r /= p;
        }
        return res;
    }
    long long catalan(int n) const {                      // cần bảng tới 2n
        return (C(2LL * n, n) - C(2LL * n, n + 1) + p) % p;
    }
};
`
      },
      example: {
        input: "n = 10, r = 3, mod = 1000000007",
        output: "120",
        explain: "C(10, 3) = 10·9·8 / 3! = 120. Với p = 7 < n dùng Lucas: 10 = 1·7 + 3 và 3 = 0·7 + 3 nên C(10, 3) ≡ C(1, 0) · C(3, 3) = 1 (mod 7), khớp 120 mod 7 = 1."
      },
      problems: [
        { site: "cses", id: "1079", name: "Binomial Coefficients" },
        { site: "cses", id: "1715", name: "Creating Strings II" },
        { site: "cses", id: "1716", name: "Distributing Apples" },
        { site: "cses", id: "1078", name: "Grid Paths II" },
        { site: "cses", id: "2187", name: "Bracket Sequences II" }
      ],
      related: ["modular-inverse", "fast-pow", "euler-phi", "crt"],
      compare: { "Bài toán giải": "C(n, r) mod p cho nhiều truy vấn", "Ràng buộc": "p nguyên tố, n < p (n ≥ p dùng Lucas)", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Công thức tính C(n, r) mod p bằng giai thừa?", a: "n! · (r!)⁻¹ · ((n−r)!)⁻¹ mod p, với p nguyên tố và n < p; tiền xử lý O(N), mỗi truy vấn O(1)." },
        { q: "Cách dựng nghịch đảo giai thừa trong O(N)?", a: "Chỉ tính inv_fact[N] = fact[N]^(p−2), rồi lùi: inv_fact[i−1] = inv_fact[i] · i." },
        { q: "Khi nào phải dùng định lý Lucas?", a: "Khi n ≥ p (giai thừa chứa p nên không có nghịch đảo): C(n, r) ≡ Π C(n_i, r_i) với n_i, r_i là chữ số cơ số p; có r_i > n_i thì bằng 0." },
        { q: "Modulo hợp số và n nhỏ thì tính C(n, r) thế nào?", a: "Tam giác Pascal C(n, r) = C(n−1, r−1) + C(n−1, r) trong O(n²), không cần phép chia." }
      ]
    },

    {
      id: "discrete-log",
      name: "Logarit rời rạc (BSGS)",
      aliases: ["discrete log", "logarit rời rạc", "baby step giant step", "bsgs", "shanks", "exbsgs", "a^x = b mod m", "chỉ số modulo", "index calculus", "bậc của phần tử"],
      category: "math",
      sub: "Modulo & tổ hợp",
      level: 4,
      tags: ["math", "number-theory", "modular-arithmetic", "discrete-log", "meet-in-the-middle"],
      summary: "Tìm x nhỏ nhất ≥ 0 thoả a^x ≡ b (mod m) bằng baby-step giant-step trong O(√m) (bản mở rộng xử lý cả gcd(a, m) > 1).",
      description:
        "Logarit rời rạc: tìm x nhỏ nhất ≥ 0 thoả **a^x ≡ b (mod m)**. Thuật toán **baby-step giant-step (BSGS)** của Shanks đặt k = ⌈√m⌉ và viết x = i·k − j với 1 ≤ i ≤ k, 0 ≤ j < k. Khi đó a^(i·k) ≡ b · a^j. Lưu các **baby step** b·a^j (j = 0..k−1) vào bảng, rồi duyệt **giant step** a^(i·k) và tra bảng; khi trùng ta có x = i·k − j. Cho mỗi giá trị giữ j lớn nhất và duyệt i tăng dần thì x tìm được là **nhỏ nhất**.\n\n" +
        "Dạng chuẩn của BSGS đòi hỏi gcd(a, m) = 1. Mẫu cài **BSGS mở rộng** cho m bất kỳ: khi g = gcd(a, m) > 1, nếu g không chia hết b thì vô nghiệm; ngược lại chia cả hai vế cho g (b/g, m/g), gom hệ số a/g vào một hằng số, và lặp đến khi gcd = 1 rồi chạy BSGS. Mỗi lần chia là một bước x phải đi qua nên nghiệm cộng thêm số lần chia; các x nhỏ hơn số lần chia được kiểm riêng ngay trong vòng chia.\n\n" +
        "Thời gian và bộ nhớ O(√m). Mẫu dùng mảng đã sắp xếp cộng tìm nhị phân thay cho hash map để không bị tấn công hash và cho kết quả xác định. Khi m cực lớn nhưng φ(m) có toàn ước nhỏ thì thuật toán Pohlig–Hellman nhanh hơn, nhưng phức tạp và hiếm gặp trong thi đấu.",
      conditions: [
        "m ≥ 1; nhân bằng __int128 nên đúng với m lớn, nhưng bảng cỡ √m chỉ chạy được với m ≲ 10^12–10^13",
        "a, b có thể âm hoặc ≥ m (mẫu chuẩn hoá); quy ước a^0 = 1",
        "Trả −1 nếu không tồn tại x; nếu tồn tại trả x nhỏ nhất ≥ 0"
      ],
      complexity: { time: "O(√m log m)", space: "O(√m)", note: "Thừa log m do sắp xếp + tìm nhị phân; dùng bảng băm thì O(√m) kỳ vọng. Phần chia gcd phụ tốn thêm O(log m) lần lặp." },
      ops: [["Dựng bảng baby step (⌈√m⌉ phần tử)", "O(√m log m)"], ["Duyệt giant step", "O(√m log m)"]],
      use_case: [
        "Tìm x trong a^x ≡ b (mod m) với m cỡ 10^9–10^12",
        "Tìm bậc (chu kỳ) của một phần tử trong nhóm nhân modulo",
        "Bài đếm có hàm mũ trong modulo, kết hợp căn nguyên thuỷ",
        "Mô phỏng phá khoá Diffie–Hellman nhỏ"
      ],
      not_for: [
        "Phương trình tuyến tính a·x ≡ b (mod m) → Euclid mở rộng / nghịch đảo modulo, không cần logarit",
        "m rất lớn (≳ 10^14) nên bảng √m không đủ bộ nhớ → Pohlig–Hellman nếu φ(m) trơn, còn lại không giải được trong thi đấu"
      ],
      pitfalls: [
        "Quên trường hợp gcd(a, m) > 1: BSGS chuẩn trả sai hoặc bỏ sót nghiệm — cần bản mở rộng.",
        "Nhầm vai: bảng baby step chứa b·a^j còn giant step là a^(i·k); duyệt i từ 1 vì x = 0 (b ≡ 1) kiểm riêng trước.",
        "Không giữ j lớn nhất cho giá trị trùng (hoặc duyệt i giảm dần) thì x tìm được không nhỏ nhất.",
        "Nhân modulo tràn long long khi m > 3·10^9 — dùng __int128 (mẫu đã dùng).",
        "Quy ước a^0 = 1: b ≡ 1 cho x = 0, và m = 1 luôn cho x = 0.",
        "unordered_map với khoá thô có thể bị chống hash trên Codeforces; dùng mảng sắp xếp hoặc hàm băm riêng."
      ],
      code: {
        lang: "cpp", title: "discrete-log.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Logarit rời rạc: x nhỏ nhất >= 0 sao cho a^x ≡ b (mod m); -1 nếu không có. BSGS mở rộng (gcd(a, m) > 1 vẫn đúng).
// Quy ước a^0 = 1. Thời gian O(sqrt(m) log m), bộ nhớ O(sqrt(m)); nhân 128 bit nên m lớn vẫn đúng (nhưng m <= ~1e13 mới đủ bộ nhớ).
long long discrete_log(long long a, long long b, long long m) {
    a %= m; if (a < 0) a += m;
    b %= m; if (b < 0) b += m;
    if (m == 1 || b == 1) return 0;                     // x = 0 (1 % m = 1 khi m >= 2)
    auto mul = [&](long long x, long long y) { return (long long)((__int128)x * y % m); };
    long long k = 0, add = 1 % m, g;                    // sau vòng chia: add * a^(x - k) ≡ b (mod m)
    while ((g = std::gcd(a, m)) != 1) {
        if (b % g != 0) return -1;
        b /= g; m /= g; k++;
        add = mul(add, a / g);
        if (add == b) return k;                         // x = k
    }
    a %= m;
    long long s = (long long)sqrtl((long double)m);
    while (s * s < m) s++;                              // s = ceil(sqrt(m))
    vector<pair<long long, int>> baby;                  // (b * a^j, j), j = 0..s-1
    baby.reserve(s);
    long long cur = b;
    for (int j = 0; j < s; j++) { baby.push_back({cur, j}); cur = mul(cur, a); }
    sort(baby.begin(), baby.end());
    long long as = 1;
    for (int j = 0; j < s; j++) as = mul(as, a);        // a^s
    long long giant = add;
    for (long long i = 1; i <= s; i++) {                // giant = add * a^(i*s)
        giant = mul(giant, as);
        auto it = upper_bound(baby.begin(), baby.end(), make_pair(giant, INT_MAX));
        if (it != baby.begin() && prev(it)->first == giant)   // j lớn nhất cho giá trị này => x nhỏ nhất
            return i * s - prev(it)->second + k;
    }
    return -1;
}
`
      },
      example: {
        input: "a = 2, b = 3, m = 5",
        output: "3",
        explain: "2¹ = 2, 2² = 4, 2³ = 8 ≡ 3 (mod 5) nên x = 3. Với m = 7: các luỹ thừa của 2 chỉ nhận giá trị 2, 4, 1 lặp lại nên 2^x ≡ 3 (mod 7) vô nghiệm (kết quả −1)."
      },
      problems: [{ site: "other", name: "Library Checker: Discrete Logarithm" }],
      related: ["fast-pow", "euler-phi", "gcd-extgcd", "modular-inverse"],
      compare: { "Bài toán giải": "Tìm x nhỏ nhất với a^x ≡ b (mod m)", "Ràng buộc": "m ≲ 10^12–10^13 (bộ nhớ √m); mẫu hỗ trợ cả gcd(a, m) > 1", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Ý tưởng của baby-step giant-step?", a: "Viết x = i·k − j với k = ⌈√m⌉: a^(i·k) ≡ b·a^j. Lưu b·a^j (baby step), duyệt a^(i·k) (giant step) và tra bảng. Thời gian và bộ nhớ O(√m)." },
        { q: "BSGS chuẩn đòi hỏi điều kiện gì và xử lý gcd(a, m) > 1 thế nào?", a: "Cần gcd(a, m) = 1. Nếu gcd = g > 1: g phải chia b (nếu không vô nghiệm), chia a^x ≡ b cho g, giảm m thành m/g, lặp đến khi gcd = 1, nghiệm cộng thêm số lần chia." },
        { q: "Để x tìm được là nhỏ nhất cần giữ gì?", a: "Với mỗi giá trị baby step giữ j lớn nhất và duyệt giant step i tăng dần; kiểm riêng x = 0." },
        { q: "Chi phí bộ nhớ của BSGS và hệ quả?", a: "O(√m): m cỡ 10^12 cần khoảng 10^6 phần tử — ổn; m cỡ 10^18 thì không thực tế." }
      ]
    },

    // ============================================================================================================ Số nguyên tố & phân tích
    {
      id: "sieve",
      name: "Sàng nguyên tố (Prime Sieve)",
      aliases: ["sàng nguyên tố", "sieve of eratosthenes", "sàng eratosthenes", "linear sieve", "sàng tuyến tính", "segmented sieve", "sàng phân đoạn", "smallest prime factor", "spf", "liệt kê số nguyên tố", "phân tích thừa số nhanh"],
      category: "math",
      sub: "Số nguyên tố & phân tích",
      level: 2,
      tags: ["math", "number-theory", "primes", "sieve", "factorization"],
      summary: "Liệt kê mọi số nguyên tố ≤ N trong O(N) và cho luôn ước nguyên tố nhỏ nhất để phân tích nhanh; sàng phân đoạn cho đoạn [L, R] với R lớn.",
      description:
        "**Sàng Eratosthenes** gạch bội của từng số nguyên tố: với mỗi p chưa bị gạch, đánh dấu p², p² + p, … là hợp số (bắt đầu từ p² vì bội nhỏ hơn đã bị gạch bởi ước nguyên tố nhỏ hơn). Tổng thời gian O(N log log N).\n\n" +
        "**Sàng tuyến tính (Euler)** gạch mỗi hợp số **đúng một lần**, bởi ước nguyên tố nhỏ nhất của nó, nên chạy O(N) và cho luôn mảng `spf` (smallest prime factor). Có `spf`, phân tích một số x ≤ N ra thừa số nguyên tố chỉ tốn O(log x). Mẫu code dùng cách này.\n\n" +
        "Khi miền quá rộng (R tới 10^12–10^14 nhưng R − L chỉ cỡ 10^6–10^7) dùng **sàng phân đoạn**: sàng các nguyên tố tới √R rồi gạch bội của chúng trong đoạn [L, R]. Nếu chỉ cần biết một số lớn có nguyên tố hay không thì dùng Miller–Rabin, không sàng.",
      conditions: [
        "N đủ nhỏ để cấp phát mảng (N = 10^7 với spf kiểu int tốn khoảng 40 MB)",
        "Sàng phân đoạn: cần sàng cơ sở tới √R nên R ≲ 10^14, và R − L + 1 cỡ ≤ 10^7",
        "Mẫu: spf[0] = spf[1] = 0; Sieve(n) cho phép x ∈ [0, n]"
      ],
      complexity: { time: "O(N)", space: "O(N)", note: "Eratosthenes thường: O(N log log N). Sàng phân đoạn: O((R − L + 1) log log R + √R) thời gian, O(R − L + √R) bộ nhớ. Chỉ cần cờ nguyên tố thì dùng bitset / vector<bool> (N/8 byte)." },
      ops: [["Dựng sàng tuyến tính tới N", "O(N)"], ["Hỏi x có nguyên tố không", "O(1)"], ["Phân tích x ≤ N ra thừa số nguyên tố", "O(log x)"], ["Sàng phân đoạn [L, R]", "O((R−L+1) log log R + √R)"]],
      use_case: [
        "Liệt kê / đếm số nguyên tố ≤ N",
        "Phân tích nhanh nhiều số ≤ N (đếm ước, tổng ước, hàm nhân tính)",
        "Tiền xử lý φ, Möbius, số ước cho cả đoạn 1..N",
        "Tìm nguyên tố trong đoạn dài [L, R] với R lớn (sàng phân đoạn)",
        "Truy vấn nhiều với N cỡ 10^6–10^7"
      ],
      not_for: [
        "Chỉ hỏi một số n ≤ 10^18 có nguyên tố không → Miller–Rabin",
        "Phân tích một số rất lớn (> 10^12) ra thừa số → Pollard's Rho",
        "N cỡ 10^9–10^10 chỉ cần ĐẾM nguyên tố → thuật toán Meissel–Lehmer (ngoài phạm vi mẫu)"
      ],
      pitfalls: [
        "Tính i * p bằng int rồi so sánh với N: tràn khi N lớn (mẫu ép sang long long).",
        "Quên bắt đầu gạch từ p² (hoặc từ bội ≥ L của p trong sàng phân đoạn) làm chậm hoặc gạch luôn chính số nguyên tố.",
        "Sàng phân đoạn: quên rằng 0 và 1 không phải nguyên tố khi L ≤ 1 (mẫu cắt L lên 2).",
        "Vòng phân tích dùng spf phải dừng khi x = 1; spf của số nguyên tố là chính nó.",
        "Cấp phát 10^8 phần tử int tốn ~400 MB — dùng bitset hoặc sàng phân đoạn."
      ],
      code: {
        lang: "cpp", title: "sieve.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Sàng tuyến tính: spf[x] = ước nguyên tố nhỏ nhất của x (spf[x] == x <=> x nguyên tố), thời gian O(N).
// Phân tích x <= N ra thừa số nguyên tố trong O(log x). Dùng: Sieve s(10000000); s.is_prime(x); s.factorize(x).
struct Sieve {
    int n;
    vector<int> spf, primes;
    explicit Sieve(int n_) : n(n_), spf(n_ + 1, 0) {
        for (int i = 2; i <= n; i++) {
            if (spf[i] == 0) { spf[i] = i; primes.push_back(i); }
            for (int p : primes) {
                if (p > spf[i] || (long long)i * p > n) break;   // mỗi hợp số bị gạch đúng 1 lần, bởi ước nhỏ nhất
                spf[i * p] = p;
            }
        }
    }
    bool is_prime(int x) const { return x >= 2 && spf[x] == x; }
    vector<pair<int, int>> factorize(int x) const {              // {(nguyên tố, số mũ)} tăng dần, x >= 1
        vector<pair<int, int>> res;
        while (x > 1) {
            int p = spf[x], e = 0;
            while (x % p == 0) { x /= p; e++; }
            res.push_back({p, e});
        }
        return res;
    }
};

// Các số nguyên tố trong [L, R] (sàng phân đoạn): R <= ~1e14 (sàng cơ sở tới sqrt(R)), R - L + 1 cỡ <= 1e7.
vector<long long> primes_in_range(long long L, long long R) {
    L = max(L, 2LL);
    if (L > R) return {};
    long long lim = (long long)sqrtl((long double)R);
    while (lim * lim > R) lim--;
    while ((lim + 1) * (lim + 1) <= R) lim++;
    Sieve base((int)lim);
    vector<char> is_p(R - L + 1, 1);
    for (int p : base.primes) {
        long long start = max((long long)p * p, (L + p - 1) / p * p);   // bội đầu tiên >= L, không gạch chính p
        for (long long j = start; j <= R; j += p) is_p[j - L] = 0;
    }
    vector<long long> res;
    for (long long v = L; v <= R; v++) if (is_p[v - L]) res.push_back(v);
    return res;
}
`
      },
      example: {
        input: "N = 30",
        output: "2 3 5 7 11 13 17 19 23 29",
        explain: "Có 10 số nguyên tố ≤ 30. Phân tích bằng spf: factorize(84) lấy spf[84] = 2 (84 → 42 → 21), rồi spf[21] = 3, rồi 7, nên 84 = 2² · 3 · 7."
      },
      problems: [
        { site: "cses", id: "1713", name: "Counting Divisors" },
        { site: "cses", id: "2417", name: "Counting Coprime Pairs" },
        { site: "cf", id: "26A", name: "Almost Prime" }
      ],
      related: ["euler-phi", "miller-rabin", "pollard-rho"],
      compare: { "Bài toán giải": "Liệt kê / đếm nguyên tố, phân tích nhanh các số ≤ N", "Ràng buộc": "N ≲ 10^7–10^8 (bộ nhớ O(N)); đoạn [L, R]: R ≲ 10^14", "Độ chính xác": "Chính xác (tất định)" },
      cards: [
        { q: "Độ phức tạp của sàng Eratosthenes và sàng tuyến tính?", a: "Eratosthenes O(N log log N); sàng tuyến tính O(N) vì mỗi hợp số bị gạch đúng một lần bởi ước nguyên tố nhỏ nhất." },
        { q: "Mảng spf dùng để làm gì?", a: "Lưu ước nguyên tố nhỏ nhất của mỗi số ≤ N, nên phân tích một số ra thừa số nguyên tố trong O(log x)." },
        { q: "Khi nào dùng sàng phân đoạn?", a: "Khi cần nguyên tố trong [L, R] với R lớn (10^12–10^14) nhưng R − L nhỏ; sàng cơ sở tới √R rồi gạch bội trong đoạn." },
        { q: "Vì sao bắt đầu gạch từ p²?", a: "Bội nhỏ hơn p² có ước nguyên tố nhỏ hơn p nên đã bị gạch ở bước trước." }
      ]
    },

    {
      id: "miller-rabin",
      name: "Miller–Rabin",
      aliases: ["miller rabin", "miller-rabin", "kiểm tra nguyên tố", "primality test", "kiểm tra số nguyên tố lớn", "strong probable prime", "isprime 1e18", "số carmichael"],
      category: "math",
      sub: "Số nguyên tố & phân tích",
      level: 3,
      tags: ["math", "number-theory", "primes", "primality-test", "randomized"],
      summary: "Kiểm tra một số n < 2^64 có nguyên tố không, tất định, chỉ với khoảng 12 luỹ thừa modulo; không bị đánh lừa bởi số Carmichael.",
      description:
        "Miller–Rabin dựa trên định lý Fermat nhỏ nhưng chặt hơn: viết n − 1 = d · 2^s với d lẻ. Nếu n nguyên tố thì với mọi cơ số a (không chia hết cho n) **hoặc** a^d ≡ 1 **hoặc** tồn tại r < s sao cho a^(d·2^r) ≡ −1 (mod n). Cơ số a vi phạm cả hai điều kiện là **chứng cứ** n là hợp số.\n\n" +
        "Với một cơ số bất kỳ, hợp số có thể lọt lưới (\"giả nguyên tố mạnh\"), nhưng với bộ cơ số chọn sẵn thì không: 12 số nguyên tố đầu tiên {2, 3, …, 37} cho kết quả **tất định đúng với mọi n < 3·10^23** — dư cho mọi số 64 bit (< 1,85·10^19). (Bộ 7 cơ số {2, 325, 9375, 28178, 450775, 9780504, 1795265022} của Jim Sinclair cũng đủ cho n < 2^64 và ít cơ số hơn nên nhanh hơn.)\n\n" +
        "Khác với kiểm tra Fermat đơn giản, Miller–Rabin **không bị đánh lừa bởi số Carmichael** (561, 1105, 1729, …). Phép nhân modulo dùng `__uint128_t` nên n tới 2^64 − 1 vẫn đúng; mỗi lần kiểm tra chỉ khoảng 12 luỹ thừa modulo, mỗi luỹ thừa ~64 bước.",
      conditions: [
        "n là số nguyên không âm, n < 2^64 để bộ cơ số của mẫu cho kết quả tất định",
        "Cần nhân modulo 128 bit (`__uint128_t`) khi n > 2^32",
        "Các trường hợp n < 2, n chẵn, n bằng một cơ số được xử lý riêng trước vòng kiểm tra"
      ],
      complexity: { time: "O(k log n)", space: "O(1)", note: "k = 12 cơ số, mỗi cơ số một luỹ thừa modulo O(log n) phép nhân 128 bit." },
      ops: [["Kiểm tra một số n < 2^64", "O(12 · log n)"]],
      use_case: [
        "Hỏi n ≤ 10^18 có nguyên tố không, hàng nghìn đến hàng trăm nghìn truy vấn",
        "Tìm số nguyên tố kế tiếp / trước đó của một số lớn (thử lần lượt từng ứng viên)",
        "Bước kiểm tra bên trong Pollard's Rho để biết khi nào dừng chia",
        "Sinh số nguyên tố lớn cho hash, mô phỏng RSA"
      ],
      not_for: [
        "Cần mọi số nguyên tố trong một đoạn nhỏ (N ≤ 10^7) → sàng nguyên tố nhanh hơn nhiều",
        "Cần thừa số, không chỉ nguyên tố hay không → Pollard's Rho (Miller–Rabin chỉ trả lời có/không)",
        "n ≥ 2^64 → bộ cơ số của mẫu không còn bảo đảm; cần số lớn và kiểm tra khác (ví dụ Baillie–PSW)"
      ],
      pitfalls: [
        "Chỉ thử cơ số 2 (hoặc vài cơ số ngẫu nhiên nhỏ) rồi coi là tất định: có hợp số vượt qua — phải dùng đúng bộ cơ số đã chứng minh.",
        "Dùng kiểm tra Fermat a^(n−1) ≡ 1 thay cho Miller–Rabin: số Carmichael (561, 1105, 1729…) qua mặt nó với mọi cơ số nguyên tố cùng nhau với n.",
        "Nhân modulo bằng long long: a·b tràn khi n > 3·10^9 — phải dùng 128 bit.",
        "Không xử lý riêng n nhỏ (n < 2, n bằng một cơ số): a mod n = 0 làm kết luận sai.",
        "Vòng bình phương lặp s − 1 lần và dừng ngay khi gặp n − 1; lặp thừa hoặc thiếu làm sai kết quả."
      ],
      code: {
        lang: "cpp", title: "miller-rabin.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Miller–Rabin TẤT ĐỊNH cho mọi n < 2^64: mr::is_prime(n). Bộ cơ số 12 nguyên tố đầu tiên đúng cho n < 3e23.
namespace mr {
typedef unsigned long long u64;
typedef __uint128_t u128;

inline u64 mulmod(u64 a, u64 b, u64 m) { return (u128)a * b % m; }

u64 powmod(u64 a, u64 e, u64 m) {
    u64 r = 1;
    for (a %= m; e > 0; e >>= 1, a = mulmod(a, a, m))
        if (e & 1) r = mulmod(r, a, m);
    return r;
}

bool is_prime(u64 n) {
    if (n < 2) return false;
    static const u64 bases[12] = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37};
    for (u64 p : bases)
        if (n % p == 0) return n == p;                  // n nhỏ hoặc có ước nhỏ: kết luận ngay
    u64 d = n - 1;
    int s = 0;
    while ((d & 1) == 0) { d >>= 1; s++; }              // n - 1 = d * 2^s, d lẻ
    for (u64 a : bases) {                               // n > 37 nên a < n
        u64 x = powmod(a, d, n);
        if (x == 1 || x == n - 1) continue;
        bool composite = true;
        for (int i = 1; i < s; i++) {
            x = mulmod(x, x, n);
            if (x == n - 1) { composite = false; break; }
        }
        if (composite) return false;                    // a là chứng cứ n hợp số
    }
    return true;
}
}  // namespace mr
`
      },
      example: {
        input: "n = 561; n = 1000000007; n = 2305843009213693951",
        output: "hợp số; nguyên tố; nguyên tố",
        explain: "561 = 3·11·17 là số Carmichael — qua được kiểm tra Fermat nhưng Miller–Rabin với cơ số 2 lộ ra: 560 = 35·2⁴, 2^35 mod 561 = 263 (khác ±1) và các bình phương liên tiếp 166, 67, 1 không có giá trị 560 nên 561 là hợp số. 1000000007 và 2^61 − 1 = 2305843009213693951 là số nguyên tố. (Mẫu loại 561 ngay vì chia hết cho 3, nhưng cơ chế Miller–Rabin cũng nhận ra như trên khi n không có ước nhỏ.)"
      },
      problems: [
        { site: "cses", id: "3396", name: "Next Prime" },
        { site: "other", name: "Library Checker: Primality Test" }
      ],
      related: ["pollard-rho", "sieve", "fast-pow"],
      compare: { "Bài toán giải": "Kiểm tra một số lớn có nguyên tố không", "Ràng buộc": "n < 2^64 (tất định); nhân 128 bit", "Độ chính xác": "Tất định trong phạm vi n < 2^64 (không có xác suất sai)" },
      cards: [
        { q: "Miller–Rabin kiểm tra điều kiện gì?", a: "Viết n − 1 = d·2^s; n nguyên tố thì a^d ≡ 1 hoặc a^(d·2^r) ≡ −1 với một r < s. Vi phạm cả hai là chứng cứ hợp số." },
        { q: "Bộ cơ số nào cho kết quả tất định với mọi số 64 bit?", a: "12 số nguyên tố đầu tiên {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37} (đúng cho n < 3·10^23); hoặc bộ 7 cơ số của Sinclair." },
        { q: "Số Carmichael là gì và nó ảnh hưởng thế nào?", a: "Hợp số thoả a^(n−1) ≡ 1 với mọi a nguyên tố cùng nhau với n (561, 1105, …); chúng đánh lừa kiểm tra Fermat nhưng không đánh lừa Miller–Rabin." },
        { q: "Vì sao cần 128 bit?", a: "Với n tới 2^64, tích hai số modulo n vượt 64 bit; __uint128_t giữ được tích để lấy dư." }
      ]
    },

    {
      id: "pollard-rho",
      name: "Pollard's Rho",
      aliases: ["pollard rho", "pollard's rho", "phân tích thừa số", "factorization", "phân tích thừa số nguyên tố số lớn", "brent", "factor 1e18", "tìm ước số lớn"],
      category: "math",
      sub: "Số nguyên tố & phân tích",
      level: 4,
      tags: ["math", "number-theory", "primes", "factorization", "randomized"],
      summary: "Phân tích một số n < 2^64 ra thừa số nguyên tố trong khoảng O(n^(1/4)) phép nhân modulo (kỳ vọng), bằng Pollard's Rho dạng Brent kết hợp Miller–Rabin.",
      description:
        "Pollard's Rho tìm **một ước thực sự** của hợp số n mà không cần chia thử. Dãy giả ngẫu nhiên x → x² + c (mod n), khi xét theo một ước nguyên tố p của n, sẽ lặp lại sau cỡ √p bước (nghịch lý ngày sinh) trong khi theo n thì chưa lặp. Khi hai giá trị x_i, x_j trùng nhau modulo p nhưng khác nhau modulo n thì gcd(|x_i − x_j|, n) là ước thực sự. Với p ≤ √n, kỳ vọng chỉ cần ~n^(1/4) bước.\n\n" +
        "Mẫu dùng dạng **Brent**: tìm chu kỳ bằng các luỹ thừa của 2 và **gộp nhiều hiệu thành một tích** rồi mới tính gcd một lần cho mỗi 128 bước (gcd đắt hơn một phép nhân modulo). Nếu tích về 0 (mod n) thì lùi từng bước để tìm đúng ước; nếu gcd = n thì đổi hằng c và thử lại.\n\n" +
        "Phân tích hoàn chỉnh: chia thử các nguyên tố nhỏ (≤ 37) trước; sau đó đệ quy — nếu số hiện tại là nguyên tố (kiểm bằng **Miller–Rabin** tất định) thì ghi nhận, ngược lại tìm một ước d bằng rho rồi phân tích d và n/d. Mẫu đã gộp luôn Miller–Rabin vào namespace `pr`, không phụ thuộc mẫu khác.",
      conditions: [
        "n < 2^64 (nhân modulo bằng `__uint128_t`)",
        "Thuộc loại Las Vegas: kết quả luôn đúng, thời gian chỉ là kỳ vọng (mẫu dùng bộ sinh ngẫu nhiên cố định hạt giống)",
        "rho chỉ được gọi trên hợp số lẻ không có ước nguyên tố ≤ 37 (mẫu đã loại sẵn)"
      ],
      complexity: { time: "O(n^(1/4)) phép nhân modulo (kỳ vọng)", space: "O(log n)", note: "Đây là kỳ vọng theo phân tích heuristic, không phải chứng minh chặt. Số có ước nguyên tố nhỏ p được tìm sau cỡ √p bước, nên trường hợp khó nhất là tích hai nguyên tố cùng cỡ √n." },
      ops: [["Tìm một ước thực sự (rho)", "O(n^(1/4))"], ["Phân tích hoàn chỉnh n < 2^64", "O(n^(1/4))"]],
      use_case: [
        "Phân tích thừa số một số ≤ 10^18 (T cỡ vài trăm test)",
        "Tính φ(n), số ước, tổng ước của số rất lớn",
        "Tìm ước nguyên tố nhỏ nhất / lớn nhất của một số rất lớn",
        "Bài cần liệt kê mọi ước của n lớn mà không sàng được"
      ],
      not_for: [
        "Nhiều số ≤ 10^7 cần phân tích → sàng spf (O(log x) mỗi số)",
        "Chỉ cần biết có nguyên tố hay không → Miller–Rabin (nhanh hơn nhiều)",
        "n khổng lồ (ví dụ RSA ~10^300) → n^(1/4) quá lớn; cần sàng trường số (GNFS)"
      ],
      pitfalls: [
        "Gọi rho trên số nguyên tố sẽ chạy rất lâu hoặc vô hạn — luôn kiểm tra nguyên tố (Miller–Rabin) trước.",
        "Gọi rho trên số chẵn hoặc luỹ thừa nhỏ của nguyên tố nhỏ: chia thử các nguyên tố nhỏ trước.",
        "Nhân modulo bằng long long tràn khi n > 3·10^9: dùng 128 bit trong f(x) = x² + c và trong tích gộp.",
        "Khi gcd ra n (không phải ước thực sự) phải đổi hằng c và thử lại, không kết luận n nguyên tố.",
        "Danh sách thừa số tìm được không theo thứ tự — phải sắp xếp (mẫu đã sắp tăng dần).",
        "n = 0 hoặc 1: không có thừa số; không kiểm tra thì n = 0 làm vòng chia thử không bao giờ dừng."
      ],
      code: {
        lang: "cpp", title: "pollard-rho.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Phân tích thừa số nguyên tố n < 2^64: pr::factorize(n) -> thừa số nguyên tố, tăng dần, lặp theo số mũ (n < 2 -> rỗng).
// Gồm Miller–Rabin tất định (kiểm nguyên tố) + Pollard's Rho dạng Brent (tìm ước). Thời gian kỳ vọng O(n^(1/4)).
namespace pr {
typedef unsigned long long u64;
typedef __uint128_t u128;

const u64 BASES[12] = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37};

inline u64 mulmod(u64 a, u64 b, u64 m) { return (u128)a * b % m; }

u64 powmod(u64 a, u64 e, u64 m) {
    u64 r = 1;
    for (a %= m; e > 0; e >>= 1, a = mulmod(a, a, m))
        if (e & 1) r = mulmod(r, a, m);
    return r;
}

bool is_prime(u64 n) {                                  // Miller–Rabin, đúng với mọi n < 2^64
    if (n < 2) return false;
    for (u64 p : BASES)
        if (n % p == 0) return n == p;
    u64 d = n - 1;
    int s = 0;
    while ((d & 1) == 0) { d >>= 1; s++; }
    for (u64 a : BASES) {
        u64 x = powmod(a, d, n);
        if (x == 1 || x == n - 1) continue;
        bool composite = true;
        for (int i = 1; i < s; i++) {
            x = mulmod(x, x, n);
            if (x == n - 1) { composite = false; break; }
        }
        if (composite) return false;
    }
    return true;
}

// n: hợp số lẻ, không có ước nguyên tố <= 37. Trả về một ước d với 1 < d < n.
u64 rho(u64 n) {
    static mt19937_64 rng(712367);
    while (true) {
        u64 c = rng() % (n - 1) + 1, y = rng() % n, x = y, ys = y, q = 1, g = 1;
        auto f = [&](u64 v) { return (u64)(((u128)v * v + c) % n); };
        auto diff = [](u64 p, u64 r) { return p > r ? p - r : r - p; };
        for (u64 r = 1; g == 1; r <<= 1) {              // Brent: so x (mốc) với y sau r bước
            x = y;
            for (u64 i = 0; i < r; i++) y = f(y);
            for (u64 k = 0; k < r && g == 1; k += 128) {
                ys = y;
                for (u64 i = 0; i < 128 && i < r - k; i++) { y = f(y); q = mulmod(q, diff(x, y), n); }
                g = std::gcd(q, n);                     // một gcd cho mỗi 128 bước
            }
        }
        if (g == n) {                                   // tích về 0 (mod n): lùi từng bước tìm ước thật
            do { ys = f(ys); g = std::gcd(diff(x, ys), n); } while (g == 1);
        }
        if (g != n) return g;                           // g == n: đổi c, thử lại
    }
}

void split(u64 n, vector<u64>& out) {
    if (n == 1) return;
    if (is_prime(n)) { out.push_back(n); return; }
    u64 d = rho(n);
    split(d, out);
    split(n / d, out);
}

vector<u64> factorize(u64 n) {
    vector<u64> out;
    if (n < 2) return out;
    for (u64 p : BASES)                                 // loại ước nguyên tố nhỏ trước
        while (n % p == 0) { out.push_back(p); n /= p; }
    split(n, out);
    sort(out.begin(), out.end());
    return out;
}
}  // namespace pr
`
      },
      example: {
        input: "n = 600851475143",
        output: "71 839 1471 6857",
        explain: "600851475143 = 71 · 839 · 1471 · 6857 (đều nguyên tố; không có ước ≤ 37 nên phải dùng rho). Thứ tự rho tìm ra các ước có thể khác nhau giữa các lần chạy nhưng sau khi sắp xếp luôn được cùng một danh sách."
      },
      problems: [{ site: "other", name: "Library Checker: Factorize" }],
      related: ["miller-rabin", "sieve", "euler-phi"],
      compare: { "Bài toán giải": "Phân tích thừa số nguyên tố một số lớn", "Ràng buộc": "n < 2^64; nhanh nhất khi n có ước nguyên tố nhỏ", "Độ chính xác": "Kết quả luôn đúng; thời gian là kỳ vọng" },
      cards: [
        { q: "Ý tưởng của Pollard's Rho?", a: "Dãy x → x² + c (mod n) lặp theo modulo một ước nguyên tố p sau ~√p bước nhưng chưa lặp theo n; gcd(|x_i − x_j|, n) khi đó là ước thực sự." },
        { q: "Độ phức tạp kỳ vọng?", a: "O(n^(1/4)) phép nhân modulo (heuristic); số có ước nhỏ p tìm được sau ~√p bước." },
        { q: "Vì sao phải kiểm tra nguyên tố trước khi gọi rho?", a: "Trên số nguyên tố rho không tìm được ước thực sự (gcd luôn 1 hoặc n) nên lặp mãi; Miller–Rabin cho biết khi nào dừng." },
        { q: "Mẹo Brent làm gì?", a: "Gộp tích |x − y| của nhiều bước và chỉ gcd một lần mỗi 128 bước; nếu tích về 0 thì lùi từng bước để lấy đúng ước." }
      ]
    },

    {
      id: "euler-phi",
      name: "Hàm phi Euler",
      aliases: ["euler phi", "phi euler", "hàm phi euler", "euler totient", "totient function", "định lý euler", "euler theorem", "φ(n)", "số nguyên tố cùng nhau", "coprime count"],
      category: "math",
      sub: "Số nguyên tố & phân tích",
      level: 2,
      tags: ["math", "number-theory", "totient", "multiplicative-function", "sieve"],
      summary: "Tính φ(n) — số các số trong [1, n] nguyên tố cùng nhau với n — bằng chia thử O(√n) hoặc cho cả bảng 1..N bằng sàng tuyến tính O(N).",
      description:
        "φ(n) là số các số nguyên trong [1, n] nguyên tố cùng nhau với n. Đây là hàm **nhân tính**: φ(ab) = φ(a)·φ(b) khi gcd(a, b) = 1, và φ(p^k) = p^k − p^(k−1) với p nguyên tố. Do đó nếu n = Π p_i^(k_i) thì **φ(n) = n · Π (1 − 1/p_i)** — chỉ phụ thuộc các ước nguyên tố khác nhau của n.\n\n" +
        "Hai cách tính: (1) một số n bằng chia thử đến √n (mẫu `euler_phi`); (2) mọi φ(1..N) bằng sàng tuyến tính O(N) (mẫu `phi_sieve`: khi gạch i·p, nếu p | i thì φ(i·p) = φ(i)·p, ngược lại φ(i·p) = φ(i)·(p − 1)).\n\n" +
        "Ứng dụng: **định lý Euler** a^φ(m) ≡ 1 (mod m) khi gcd(a, m) = 1 (tổng quát hoá Fermat nhỏ); rút gọn số mũ lớn trong a^e mod m; nghịch đảo modulo hợp số; và đồng nhất thức Σ_{d | n} φ(d) = n.",
      conditions: [
        "n ≥ 1 (φ(1) = 1)",
        "Một số: chia thử đến √n nên thực tế n ≲ 10^14 (10^7 bước); lớn hơn thì phân tích bằng Pollard's Rho rồi áp công thức",
        "Sàng: N ≲ 10^7–10^8 vì tốn bộ nhớ O(N)"
      ],
      complexity: { time: "O(√n) cho một số", space: "O(1)", note: "φ(1..N) bằng sàng tuyến tính: O(N) thời gian và bộ nhớ. Nếu đã có spf (ước nguyên tố nhỏ nhất) thì φ(x) tính trong O(log x)." },
      ops: [["φ(n) cho một số (chia thử)", "O(√n)"], ["φ(1..N) (sàng tuyến tính)", "O(N)"], ["φ(x) khi đã có spf", "O(log x)"]],
      use_case: [
        "Rút gọn số mũ: a^e mod m với e rất lớn (a^e ≡ a^(e mod φ(m) + φ(m)) khi e ≥ φ(m))",
        "Đếm số k ≤ n nguyên tố cùng nhau với n",
        "Nghịch đảo modulo hợp số: a^(φ(m) − 1) khi biết φ(m)",
        "Tổng gcd: Σ_{i=1..n} gcd(i, n) = Σ_{d | n} d·φ(n/d)",
        "Số căn nguyên thuỷ modulo nguyên tố p là φ(p − 1)"
      ],
      not_for: [
        "Chỉ cần nghịch đảo của một số theo modulo bất kỳ → Euclid mở rộng nhanh hơn và không cần φ",
        "Số rất lớn chưa biết phân tích → phải phân tích trước (Pollard's Rho) rồi mới áp công thức",
        "Hàm số học khác (Möbius, số ước, tổng ước) → cùng cách sàng nhưng công thức khác"
      ],
      pitfalls: [
        "Tính n * (p − 1) / p thay vì res -= res / p: nhân trước có thể tràn hoặc chia không hết.",
        "Quên bước cuối: sau vòng chia, nếu n > 1 thì n còn là một nguyên tố lớn cần trừ thêm (res -= res / n).",
        "Trừ nhiều lần cho cùng một nguyên tố: phải chia hết luỹ thừa p rồi mới trừ đúng một lần.",
        "Định lý Euler cần gcd(a, m) = 1; với gcd > 1 dùng dạng tổng quát (cộng φ(m) vào số mũ) hoặc xử lý riêng.",
        "Sàng tuyến tính: ép i * p sang long long; phi[i] * p có thể tràn int nếu N gần 2·10^9."
      ],
      code: {
        lang: "cpp", title: "euler-phi.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// φ(n) bằng chia thử đến sqrt(n): O(sqrt n). n >= 1 (n <= ~1e14 là thực tế).
long long euler_phi(long long n) {
    long long res = n;
    for (long long p = 2; p * p <= n; p++) {
        if (n % p == 0) {
            while (n % p == 0) n /= p;
            res -= res / p;                              // res *= (1 - 1/p); chia trước nên không tràn
        }
    }
    if (n > 1) res -= res / n;                           // còn một nguyên tố lớn
    return res;
}

// φ(0..n) bằng sàng tuyến tính: O(n). phi[0] = 0, phi[1] = 1. n <= ~1e8.
vector<int> phi_sieve(int n) {
    vector<int> phi(n + 1, 0), primes;
    vector<char> composite(n + 1, 0);
    if (n >= 1) phi[1] = 1;
    for (int i = 2; i <= n; i++) {
        if (!composite[i]) { primes.push_back(i); phi[i] = i - 1; }
        for (int p : primes) {
            if ((long long)i * p > n) break;
            composite[i * p] = 1;
            if (i % p == 0) { phi[i * p] = phi[i] * p; break; }   // p đã là ước của i: không thêm nguyên tố mới
            phi[i * p] = phi[i] * (p - 1);
        }
    }
    return phi;
}
`
      },
      example: {
        input: "n = 36",
        output: "12",
        explain: "36 = 2²·3², φ(36) = 36 · (1 − 1/2) · (1 − 1/3) = 12 (các số nguyên tố cùng nhau với 36 trong 1..36: 1 5 7 11 13 17 19 23 25 29 31 35 — đúng 12 số). Bảng φ(1..10) = 1 1 2 2 4 2 6 4 6 4."
      },
      problems: [
        { site: "cses", id: "1712", name: "Exponentiation II" },
        { site: "spoj", name: "ETF" }
      ],
      related: ["sieve", "fast-pow", "pollard-rho", "modular-inverse"],
      compare: { "Bài toán giải": "Đếm số nguyên tố cùng nhau với n; rút gọn số mũ", "Ràng buộc": "n ≲ 10^14 (một số), N ≲ 10^7–10^8 (cả bảng)", "Độ chính xác": "Chính xác (số nguyên)" },
      cards: [
        { q: "Công thức tính φ(n) từ phân tích thừa số?", a: "φ(n) = n · Π (1 − 1/p) lấy trên các ước nguyên tố p của n; φ(p^k) = p^k − p^(k−1)." },
        { q: "Định lý Euler nói gì?", a: "a^φ(m) ≡ 1 (mod m) khi gcd(a, m) = 1 (Fermat nhỏ là trường hợp m nguyên tố: φ(p) = p − 1)." },
        { q: "Tính φ(1..N) trong bao lâu?", a: "O(N) bằng sàng tuyến tính: φ(i·p) = φ(i)·p nếu p | i, ngược lại φ(i)·(p − 1)." },
        { q: "Đồng nhất thức nổi tiếng của φ?", a: "Σ_{d | n} φ(d) = n." }
      ]
    },

    // ============================================================================================================ Đại số tuyến tính
    {
      id: "matrix-exponentiation",
      name: "Luỹ thừa ma trận",
      aliases: ["luỹ thừa ma trận", "matrix exponentiation", "matrix power", "matrix fast power", "nhân ma trận", "fibonacci n lớn", "truy hồi tuyến tính", "linear recurrence", "đếm đường đi độ dài k", "min plus matrix"],
      category: "math",
      sub: "Đại số tuyến tính",
      level: 3,
      tags: ["math", "linear-algebra", "matrix", "linear-recurrence", "binary-exponentiation"],
      summary: "Tính Mⁿ bằng bình phương liên tiếp để lấy số hạng thứ n của truy hồi tuyến tính, đếm đường đi độ dài đúng L, hoặc (min, +) cho đường đi ngắn nhất đúng L cạnh.",
      description:
        "Nhiều quá trình tuyến tính (dãy truy hồi, đếm đường đi, chuyển trạng thái tuyến tính) có dạng **v_(n+1) = M · v_n**, suy ra v_n = Mⁿ · v₀. Tính Mⁿ bằng **luỹ thừa nhanh** (bình phương liên tiếp) chỉ cần O(log n) phép nhân ma trận, mỗi phép O(d³) với ma trận d × d.\n\n" +
        "Ví dụ Fibonacci: [F(n+1), F(n)]ᵀ = [[1, 1], [1, 0]]ⁿ · [1, 0]ᵀ. Truy hồi bậc k a_n = c₁·a_(n−1) + … + c_k·a_(n−k) dùng ma trận k × k (hàng đầu là c₁…c_k, các hàng sau dịch chuyển); thêm một chiều hằng 1 nếu có số hạng tự do. Số đường đi độ dài đúng L trong đồ thị là phần tử (A^L)[u][v] với A là ma trận kề.\n\n" +
        "Thay (+, ×) bằng (min, +) ta có luỹ thừa ma trận trên **bán vòng tropical**: (A^L)[u][v] là đường đi ngắn nhất dùng **đúng** L cạnh. Mẫu có cả hai bản.",
      conditions: [
        "Quan hệ truy hồi tuyến tính với hệ số cố định (không phụ thuộc n)",
        "Bản modulo: mod ≲ 3·10^9 để tích hai phần tử vừa long long",
        "d nhỏ (cỡ ≤ 100–200) để d³ log n chấp nhận được",
        "Bản (min, +): mọi độ dài đường đi hữu hạn phải nhỏ hơn MAT_INF = 4·10^18"
      ],
      complexity: { time: "O(d³ log n)", space: "O(d²)", note: "Truy hồi bậc k có thể giảm xuống O(k² log n) bằng Kitamasa (không nằm trong mẫu)." },
      ops: [["Nhân hai ma trận d × d", "O(d³)"], ["Mⁿ bằng bình phương liên tiếp", "O(d³ log n)"], ["Một số hạng truy hồi bậc k", "O(k³ log n)"]],
      use_case: [
        "Số hạng thứ n của truy hồi tuyến tính (Fibonacci, tribonacci…) với n tới 10^18",
        "Đếm số đường đi / số xâu độ dài L thoả ràng buộc kề nhau trên đồ thị trạng thái nhỏ",
        "Đường đi ngắn nhất có đúng L cạnh (bán vòng (min, +))",
        "Bài quy hoạch động chuyển trạng thái tuyến tính cố định lặp rất nhiều lần"
      ],
      not_for: [
        "Truy hồi không tuyến tính hoặc hệ số đổi theo n → quy hoạch động thường hoặc công thức khác",
        "Chỉ cần Fibonacci F(n) mod p → fast doubling gọn hơn, hằng số nhỏ hơn",
        "Kích thước d lớn (d ≳ 500) → d³ log n quá chậm; cân nhắc Kitamasa / Bostan–Mori cho truy hồi bậc cao"
      ],
      pitfalls: [
        "Quên khởi tạo kết quả bằng ma trận đơn vị (không phải ma trận 0).",
        "Cộng dồn nhiều tích a·b rồi mới lấy % có thể tràn: mỗi tích tới ~10^18, long long chỉ chứa ~9 tích — mẫu lấy % sau từng tích.",
        "Sai thứ tự nhân: M^n · v₀ khác v₀ · M^n; phép nhân ma trận không giao hoán (và cách đặt hàng/cột của v_n).",
        "Bản (min, +): phần tử đơn vị là đường chéo 0 và INF ở mọi ô khác (không phải 1/0); bỏ qua INF khi cộng kẻo tràn.",
        "Truy hồi có hằng số hoặc số hạng phụ thuộc n cần thêm chiều phụ vào ma trận.",
        "Với mod = 1 mọi phần tử đều bằng 0, kể cả ma trận đơn vị (mẫu xử lý bằng x %= mod)."
      ],
      code: {
        lang: "cpp", title: "matrix-exponentiation.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Luỹ thừa ma trận vuông d x d modulo mod (mod <= ~3e9 để tích vừa long long) và bản (min, +).
typedef vector<vector<long long>> Mat;

Mat mat_identity(int d) {
    Mat I(d, vector<long long>(d, 0));
    for (int i = 0; i < d; i++) I[i][i] = 1;
    return I;
}

Mat mat_mul(const Mat& A, const Mat& B, long long mod) {   // phần tử A, B trong [0, mod)
    int d = A.size();
    Mat C(d, vector<long long>(d, 0));
    for (int i = 0; i < d; i++)
        for (int k = 0; k < d; k++) {
            if (A[i][k] == 0) continue;
            for (int j = 0; j < d; j++) C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % mod;
        }
    return C;
}

// A^e mod mod, e >= 0. Ví dụ Fibonacci: mat_pow({{1, 1}, {1, 0}}, n, mod)[0][1] = F(n).
Mat mat_pow(Mat A, unsigned long long e, long long mod) {
    for (auto& row : A) for (auto& x : row) x = ((x % mod) + mod) % mod;
    Mat R = mat_identity(A.size());
    for (auto& row : R) for (auto& x : row) x %= mod;      // mod = 1: ma trận đơn vị thành ma trận 0
    while (e > 0) {
        if (e & 1) R = mat_mul(R, A, mod);
        e >>= 1;
        if (e > 0) A = mat_mul(A, A, mod);
    }
    return R;
}

// ---- Bản (min, +): (A^e)[u][v] = độ dài đường đi ngắn nhất dùng ĐÚNG e cạnh. MAT_INF = không có đường.
const long long MAT_INF = (long long)4e18;

Mat mat_mul_minplus(const Mat& A, const Mat& B) {
    int d = A.size();
    Mat C(d, vector<long long>(d, MAT_INF));
    for (int i = 0; i < d; i++)
        for (int k = 0; k < d; k++) {
            if (A[i][k] >= MAT_INF) continue;
            for (int j = 0; j < d; j++)
                if (B[k][j] < MAT_INF) C[i][j] = min(C[i][j], A[i][k] + B[k][j]);
        }
    return C;
}

Mat mat_pow_minplus(Mat A, unsigned long long e) {
    int d = A.size();
    Mat R(d, vector<long long>(d, MAT_INF));
    for (int i = 0; i < d; i++) R[i][i] = 0;               // đơn vị của (min, +)
    while (e > 0) {
        if (e & 1) R = mat_mul_minplus(R, A);
        e >>= 1;
        if (e > 0) A = mat_mul_minplus(A, A);
    }
    return R;
}
`
      },
      example: {
        input: "Fibonacci: [[1, 1], [1, 0]]^10",
        output: "[[89, 55], [55, 34]] nên F(10) = 55",
        explain: "Mⁿ = [[F(n+1), F(n)], [F(n), F(n−1)]]. Với n = 10: F(11) = 89, F(10) = 55, F(9) = 34. Cùng mẫu, tribonacci dùng ma trận [[1,1,1],[1,0,0],[0,1,0]]."
      },
      problems: [
        { site: "cses", id: "1722", name: "Fibonacci Numbers" },
        { site: "cses", id: "1723", name: "Graph Paths I" },
        { site: "cses", id: "1724", name: "Graph Paths II" },
        { site: "cses", id: "1096", name: "Throwing Dice" }
      ],
      related: ["fast-pow", "gaussian-elimination", "floyd-warshall"],
      compare: { "Bài toán giải": "Số hạng thứ n của truy hồi tuyến tính, đếm đường đi độ dài L", "Ràng buộc": "Quan hệ tuyến tính hệ số cố định; d nhỏ (≲ 100)", "Độ chính xác": "Chính xác (modulo)" },
      cards: [
        { q: "Số hạng thứ n của truy hồi tuyến tính bậc k tính trong bao lâu bằng luỹ thừa ma trận?", a: "O(k³ log n): ma trận k × k mũ n bằng bình phương liên tiếp." },
        { q: "Ma trận nào cho Fibonacci?", a: "[[1, 1], [1, 0]]ⁿ = [[F(n+1), F(n)], [F(n), F(n−1)]]." },
        { q: "Số đường đi độ dài đúng L giữa u và v trong đồ thị?", a: "Phần tử (A^L)[u][v] của ma trận kề A mũ L (số đếm modulo nếu lớn)." },
        { q: "Làm gì để tính đường đi ngắn nhất dùng đúng L cạnh?", a: "Luỹ thừa ma trận trên bán vòng (min, +): phép nhân thành min của tổng, đơn vị là 0 trên đường chéo và INF còn lại." }
      ]
    },

    {
      id: "gaussian-elimination",
      name: "Khử Gauss",
      aliases: ["khử gauss", "gaussian elimination", "gauss jordan", "giải hệ phương trình tuyến tính", "hệ phương trình tuyến tính", "system of linear equations", "hạng ma trận", "định thức", "xor gauss", "gauss modulo"],
      category: "math",
      sub: "Đại số tuyến tính",
      level: 3,
      tags: ["math", "linear-algebra", "gauss", "matrix", "equations"],
      summary: "Giải hệ phương trình tuyến tính A·x = b (số thực hoặc modulo nguyên tố), phân biệt vô nghiệm / duy nhất / vô số nghiệm, đồng thời cho hạng và định thức.",
      description:
        "Khử Gauss (Gauss–Jordan) biến ma trận mở rộng [A | b] về dạng bậc thang bằng ba phép biến đổi hàng: đổi chỗ hai hàng, nhân một hàng với số khác 0, cộng bội của hàng này vào hàng khác. Với mỗi cột chọn một **pivot** (phần tử khác 0 ở hàng chưa dùng) rồi khử cột đó ở mọi hàng còn lại. Số cột có pivot là **hạng** của A.\n\n" +
        "Đọc kết quả: có hàng dạng [0 … 0 | c] với c ≠ 0 thì **vô nghiệm**; mọi hàng nhất quán và hạng < số ẩn thì **vô số nghiệm** (cột không có pivot là ẩn tự do); hạng = số ẩn thì **nghiệm duy nhất**. Mẫu đặt các ẩn tự do bằng 0 để trả một nghiệm cụ thể.\n\n" +
        "**Số thực**: chọn pivot có giá trị tuyệt đối lớn nhất trong cột (partial pivoting) cho bớt sai số, và so với epsilon thay vì so với 0 (mẫu `gauss_real`, EPS = 1e-9 — chọn theo thang dữ liệu). **Modulo nguyên tố p**: mọi phép chia là nhân nghịch đảo, không có sai số, chỉ cần pivot ≠ 0 (mẫu `gauss_mod`). Hệ trên GF(2) dùng `bitset` để nhanh hơn ~64 lần. Định thức bằng tích các pivot (đổi dấu mỗi lần đổi hàng).",
      conditions: [
        "Hệ A·x = b có n phương trình, m ẩn (n và m có thể khác nhau)",
        "Số thực: chọn EPS theo thang dữ liệu; hệ gần suy biến (điều kiện xấu) cho nghiệm kém tin cậy",
        "Modulo: p nguyên tố (để mọi phần tử khác 0 có nghịch đảo) và p ≲ 3·10^9 để tích vừa long long"
      ],
      complexity: { time: "O(n·m·min(n, m))", space: "O(n·m)", note: "Hệ vuông n × n: O(n³). Modulo: thêm O(min(n, m) log p) cho các nghịch đảo. GF(2) với bitset: chia thêm ~64." },
      ops: [["Khử Gauss ma trận n × m", "O(n·m·min(n, m))"], ["Hạng ma trận", "O(n·m·min(n, m))"], ["Định thức n × n", "O(n³)"]],
      use_case: [
        "Giải hệ phương trình tuyến tính cỡ n ≤ ~500 (số thực) hoặc ~2000 (modulo)",
        "Tính hạng, định thức, ma trận nghịch đảo",
        "Bài về công tắc / đèn / XOR trên GF(2)",
        "Tính xác suất và kỳ vọng bằng hệ phương trình (chuỗi Markov hấp thụ)",
        "Tìm nghiệm modulo nguyên tố trong các bài đếm"
      ],
      not_for: [
        "Hệ rất lớn và thưa → phương pháp lặp (Gauss–Seidel, conjugate gradient) hoặc thuật toán chuyên dụng",
        "Hệ có cấu trúc đặc biệt (tam giác, ba đường chéo) → giải trực tiếp O(n)",
        "Cần nghiệm nguyên/hữu tỉ chính xác của hệ nguyên → phân số / thuật toán Bareiss hoặc modulo + CRT (double có sai số)"
      ],
      pitfalls: [
        "So sánh số thực với 0 bằng == : phải so |x| < EPS; ngược lại pivot cỡ 1e-17 làm nổ nghiệm.",
        "Không chọn pivot lớn nhất (partial pivoting): sai số tích luỹ với hệ gần suy biến.",
        "Quên kiểm tra nhất quán các hàng [0 … 0 | c ≠ 0]: hệ vô nghiệm bị báo là có nghiệm.",
        "Modulo: dùng p hợp số (phép chia sai) hoặc quên chuẩn hoá phần tử âm về [0, p).",
        "Nhầm 'hạng < m' (vô số nghiệm) với 'hạng < n' (có phương trình thừa, vẫn có thể có nghiệm duy nhất).",
        "Tính định thức mà quên đổi dấu sau mỗi lần đổi hàng."
      ],
      code: {
        lang: "cpp", title: "gaussian-elimination.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Khử Gauss–Jordan giải A x = b. a là ma trận mở rộng n x (m + 1): a[i][m] = b[i]; n phương trình, m ẩn.
// Trả: 0 = vô nghiệm, 1 = nghiệm duy nhất, 2 = vô số nghiệm. x = một nghiệm (ẩn tự do = 0) nếu có nghiệm.

const double GAUSS_EPS = 1e-9;                           // chọn theo thang dữ liệu

int gauss_real(vector<vector<double>> a, int m, vector<double>& x) {
    int n = a.size();
    vector<int> where(m, -1);                            // where[c] = hàng chứa pivot của cột c
    for (int col = 0, row = 0; col < m && row < n; col++) {
        int sel = row;
        for (int i = row; i < n; i++)
            if (fabs(a[i][col]) > fabs(a[sel][col])) sel = i;      // pivot có |giá trị| lớn nhất
        if (fabs(a[sel][col]) < GAUSS_EPS) continue;     // cột không có pivot: ẩn tự do
        swap(a[sel], a[row]);
        where[col] = row;
        for (int i = 0; i < n; i++) {
            if (i == row) continue;
            double c = a[i][col] / a[row][col];
            for (int j = col; j <= m; j++) a[i][j] -= a[row][j] * c;
        }
        row++;
    }
    x.assign(m, 0.0);
    int rk = 0;
    for (int c = 0; c < m; c++)
        if (where[c] != -1) { x[c] = a[where[c]][m] / a[where[c]][c]; rk++; }
    for (int i = 0; i < n; i++) {                        // hàng [0 ... 0 | c != 0] -> vô nghiệm
        double s = 0;
        for (int j = 0; j < m; j++) s += x[j] * a[i][j];
        if (fabs(s - a[i][m]) > GAUSS_EPS) return 0;
    }
    return rk == m ? 1 : 2;
}

// Cùng thuật toán trên modulo p NGUYÊN TỐ (p <= ~3e9): không có sai số. a có thể chứa số âm / >= p.
int gauss_mod(vector<vector<long long>> a, int m, long long p, vector<long long>& x) {
    int n = a.size();
    for (auto& row : a) for (auto& v : row) { v %= p; if (v < 0) v += p; }
    auto power = [&](long long b, long long e) {
        long long r = 1;
        for (b %= p; e > 0; e >>= 1, b = b * b % p) if (e & 1) r = r * b % p;
        return r;
    };
    vector<int> where(m, -1);
    for (int col = 0, row = 0; col < m && row < n; col++) {
        int sel = -1;
        for (int i = row; i < n; i++) if (a[i][col] != 0) { sel = i; break; }
        if (sel == -1) continue;
        swap(a[sel], a[row]);
        where[col] = row;
        long long inv = power(a[row][col], p - 2);
        for (int j = col; j <= m; j++) a[row][j] = a[row][j] * inv % p;          // pivot = 1
        for (int i = 0; i < n; i++) {
            if (i == row || a[i][col] == 0) continue;
            long long c = a[i][col];
            for (int j = col; j <= m; j++) a[i][j] = ((a[i][j] - c * a[row][j]) % p + p) % p;
        }
        row++;
    }
    x.assign(m, 0);
    int rk = 0;
    for (int c = 0; c < m; c++) if (where[c] != -1) { x[c] = a[where[c]][m]; rk++; }
    for (int i = 0; i < n; i++) {                        // hàng toàn 0 mà vế phải khác 0 -> vô nghiệm
        bool zero = true;
        for (int j = 0; j < m && zero; j++) if (a[i][j] != 0) zero = false;
        if (zero && a[i][m] != 0) return 0;
    }
    return rk == m ? 1 : 2;
}
`
      },
      example: {
        input: "2 2\n1 1 3\n1 -1 1",
        output: "nghiệm duy nhất: x = 2, y = 1",
        explain: "Hệ x + y = 3, x − y = 1; cộng hai phương trình được 2x = 4. Hệ x + y = 2, 2x + 2y = 4 có hạng 1 < 2 ẩn nên vô số nghiệm; hệ x + y = 2, 2x + 2y = 5 vô nghiệm vì sau khử hàng thứ hai thành [0 0 | 1]."
      },
      problems: [
        { site: "cses", id: "3154", name: "System of Linear Equations" },
        { site: "other", name: "Library Checker: System of Linear Equations" }
      ],
      related: ["matrix-exponentiation", "modular-inverse"],
      compare: { "Bài toán giải": "Giải hệ phương trình tuyến tính, hạng, định thức", "Ràng buộc": "n ≲ 500 (thực) / ~2000 (modulo); modulo cần p nguyên tố", "Độ chính xác": "Số thực: sai số làm tròn (dùng EPS); modulo: chính xác" },
      cards: [
        { q: "Khử Gauss phân biệt ba loại nghiệm thế nào?", a: "Có hàng [0 … 0 | c ≠ 0] → vô nghiệm; hạng = số ẩn → duy nhất; hạng < số ẩn (và nhất quán) → vô số nghiệm." },
        { q: "Độ phức tạp của khử Gauss?", a: "O(n·m·min(n, m)); hệ vuông n × n là O(n³)." },
        { q: "Vì sao chọn pivot có giá trị tuyệt đối lớn nhất với số thực?", a: "Để giảm sai số làm tròn: chia cho pivot nhỏ phóng đại sai số và có thể làm nổ nghiệm." },
        { q: "Khử Gauss trên modulo nguyên tố khác gì?", a: "Chia thành nhân với nghịch đảo modulo; chỉ cần pivot khác 0; không có sai số. Cần modulo nguyên tố." }
      ]
    },

    // ============================================================================================================ Biến đổi nhanh
    {
      id: "fft",
      name: "FFT",
      aliases: ["fft", "fast fourier transform", "biến đổi fourier nhanh", "nhân đa thức", "polynomial multiplication", "tích chập", "convolution", "nhân số lớn", "complex fft", "dft"],
      category: "math",
      sub: "Biến đổi nhanh",
      level: 4,
      tags: ["math", "fft", "convolution", "polynomial", "divide-and-conquer"],
      summary: "Nhân hai đa thức độ dài N trong O(N log N) bằng biến đổi Fourier nhanh trên số phức (complex<double>), nhưng có sai số nên chỉ dùng khi kết quả đủ nhỏ.",
      description:
        "**FFT** (biến đổi Fourier nhanh) nhân hai đa thức bậc N trong O(N log N) thay vì O(N²). Đa thức được biểu diễn theo **hệ số** hoặc theo **giá trị tại N điểm**; nhân theo giá trị chỉ là nhân từng điểm (O(N)). FFT đổi hệ số → giá trị tại các **căn đơn vị bậc n** trong O(N log N) nhờ chia đôi: P(x) = P_chẵn(x²) + x·P_lẻ(x²), và hai nửa dùng chung phép tính nhờ ω^(k+n/2) = −ω^k.\n\n" +
        "Quy trình: đệm hai dãy tới n = luỹ thừa 2 ≥ len(a) + len(b) − 1; FFT cả hai; nhân từng phần tử; **FFT ngược** (đổi dấu góc quay, chia n); làm tròn phần thực. Tích chập mở rộng ra rất nhiều bài: đếm cặp có tổng cho trước, so khớp xâu có ký tự đại diện, đếm cặp có hiệu cho trước (đảo một dãy rồi nhân)…\n\n" +
        "**Cảnh báo sai số**: dùng `complex<double>` nên chỉ có ~15–16 chữ số hữu hiệu, sai số tăng theo độ lớn hệ số và log N. Thử nghiệm với dữ liệu ngẫu nhiên cho thấy mẫu còn đúng khi hệ số kết quả tới ~10^15 và sai từ ~10^16–10^17; dữ liệu xấu có thể sai sớm hơn nên coi vùng an toàn là ≲ 10^13–10^14. Mẫu tính bảng căn đơn vị bằng cos/sin trực tiếp (không nhân dồn) để sai số nhỏ. Cần kết quả modulo, hoặc kết quả lớn chính xác → dùng NTT (modulo nguyên tố đặc biệt), tách hệ số, hoặc nhiều modulo + CRT.",
      conditions: [
        "Độ dài đệm n là luỹ thừa của 2 và n ≥ len(a) + len(b) − 1 (mẫu tự đệm)",
        "Hệ số nguyên; độ lớn hệ số kết quả phải đủ nhỏ để làm tròn đúng (bộ test của mẫu kiểm đúng tới ~5·10^11 với N ≈ 10^6 và 2·10^13 với N = 2000; coi ≲ 10^13–10^14 là an toàn, từ ~10^16 chắc chắn sai)",
        "Cần kết quả modulo p nguyên tố đặc biệt → NTT; modulo bất kỳ → tách hệ số hoặc NTT ba modulo + CRT"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "N = len(a) + len(b) làm tròn lên luỹ thừa 2. Có thể bớt một trong ba lần FFT bằng mẹo nhét hai dãy thực vào phần thực / ảo của một dãy phức (không có trong mẫu)." },
      ops: [["FFT / FFT ngược độ dài n", "O(n log n)"], ["Nhân hai đa thức độ dài N", "O(N log N)"]],
      use_case: [
        "Nhân hai số lớn hoặc hai đa thức bậc 10^5–10^6",
        "Tích chập: số cách chọn hai phần tử có tổng cho trước (mỗi tổng một hệ số)",
        "So khớp xâu với ký tự đại diện (wildcard) và so khớp có sai số",
        "Đếm cặp (i, j) với a_i − a_j = d (đảo một dãy rồi tích chập)",
        "Phân phối xác suất của tổng hai biến độc lập (dùng cả số thực)"
      ],
      not_for: [
        "Kết quả cần modulo 998244353 (hoặc modulo NTT-friendly khác) → NTT, không sai số",
        "Hệ số tới 10^9, kết quả modulo 10^9 + 7 → cần tách hệ số (split FFT) hoặc NTT ba modulo + CRT",
        "Dãy ngắn (N ≲ 50) → nhân O(N²) đơn giản và nhanh hơn"
      ],
      pitfalls: [
        "Làm tròn sai: với số âm, (long long)(x + 0.5) lệch — mẫu dùng llround.",
        "Sai số tăng theo độ lớn hệ số: hai dãy hệ số 10^6, N = 10^6 đẩy kết quả lên ~10^18 — không còn chính xác.",
        "Nhân dồn w *= wlen qua từng tầng làm tích luỹ sai số: mẫu dựng bảng cos/sin trực tiếp cho từng chỉ số.",
        "Quên đệm n ≥ len(a) + len(b) − 1: tích chập vòng 'quấn' các hệ số cao về hệ số thấp.",
        "Độ dài kết quả đúng là len(a) + len(b) − 1 — đừng giữ phần thừa do đệm."
      ],
      code: {
        lang: "cpp", title: "fft.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// FFT trên complex<double>. CẢNH BÁO sai số: chỉ đáng tin khi hệ số kết quả nhỏ hơn ~1e13..1e14 (xem NTT cho modulo / kết quả lớn).
typedef complex<double> cd;

// FFT tại chỗ, a.size() là luỹ thừa của 2; invert = true: FFT ngược (đã chia n).
void fft(vector<cd>& a, bool invert) {
    int n = a.size();
    for (int i = 1, j = 0; i < n; i++) {                 // hoán vị đảo bit
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) swap(a[i], a[j]);
    }
    const double PI = acos(-1.0);
    vector<cd> root(max(1, n / 2));                       // root[k] = e^(2*pi*i*k/n), tính trực tiếp cho ít sai số
    for (int k = 0; k < n / 2; k++) root[k] = cd(cos(2 * PI * k / n), sin(2 * PI * k / n));
    for (int len = 2; len <= n; len <<= 1) {
        int step = n / len;
        for (int i = 0; i < n; i += len)
            for (int j = 0; j < len / 2; j++) {
                cd w = invert ? conj(root[j * step]) : root[j * step];
                cd u = a[i + j], v = a[i + j + len / 2] * w;
                a[i + j] = u + v;
                a[i + j + len / 2] = u - v;
            }
    }
    if (invert) for (auto& x : a) x /= n;
}

// Tích hai đa thức hệ số nguyên (có thể âm). Độ dài kết quả a.size() + b.size() - 1; rỗng nếu một dãy rỗng.
vector<long long> fft_multiply(const vector<long long>& a, const vector<long long>& b) {
    if (a.empty() || b.empty()) return {};
    int need = a.size() + b.size() - 1, n = 1;
    while (n < need) n <<= 1;
    vector<cd> fa(n), fb(n);
    for (size_t i = 0; i < a.size(); i++) fa[i] = (double)a[i];
    for (size_t i = 0; i < b.size(); i++) fb[i] = (double)b[i];
    fft(fa, false);
    fft(fb, false);
    for (int i = 0; i < n; i++) fa[i] *= fb[i];
    fft(fa, true);
    vector<long long> res(need);
    for (int i = 0; i < need; i++) res[i] = llround(fa[i].real());
    return res;
}
`
      },
      example: {
        input: "A = [1, 2, 3], B = [4, 5]",
        output: "[4, 13, 22, 15]",
        explain: "(1 + 2x + 3x²)(4 + 5x) = 4 + (5 + 8)x + (10 + 12)x² + 15x³ = 4 + 13x + 22x² + 15x³."
      },
      problems: [
        { site: "cses", id: "2111", name: "Apples and Bananas" },
        { site: "cses", id: "2112", name: "One Bit Positions" },
        { site: "cses", id: "2113", name: "Signal Processing" },
        { site: "cf", id: "528D", name: "Fuzzy Search" }
      ],
      related: ["ntt", "fast-pow"],
      compare: { "Bài toán giải": "Nhân đa thức / tích chập", "Ràng buộc": "N tới ~10^6; hệ số kết quả ≲ 10^13–10^14", "Độ chính xác": "Sai số số thực (phải làm tròn)" },
      cards: [
        { q: "FFT nhân hai đa thức trong bao lâu?", a: "O(N log N): FFT cả hai, nhân từng điểm, FFT ngược." },
        { q: "Độ dài đệm cần là bao nhiêu?", a: "Luỹ thừa của 2 không nhỏ hơn len(a) + len(b) − 1; nếu thiếu, tích chập vòng sẽ quấn hệ số." },
        { q: "FFT dùng complex<double> có hạn chế gì?", a: "Sai số làm tròn: hệ số kết quả cỡ 10^14 trở lên có thể sai; cần kết quả chính xác/ modulo thì dùng NTT hoặc tách hệ số." },
        { q: "FFT ngược khác FFT thuận ở đâu?", a: "Dùng căn đơn vị liên hợp (đổi dấu góc) và chia kết quả cho n." }
      ]
    },

    {
      id: "ntt",
      name: "NTT",
      aliases: ["ntt", "number theoretic transform", "fft modulo", "nhân đa thức modulo 998244353", "998244353", "tích chập modulo", "fft trên trường modulo", "convolution mod"],
      category: "math",
      sub: "Biến đổi nhanh",
      level: 4,
      tags: ["math", "ntt", "convolution", "polynomial", "modular-arithmetic"],
      summary: "Nhân đa thức modulo p = c·2^k + 1 (như 998244353) trong O(N log N), chính xác tuyệt đối vì dùng căn nguyên thuỷ modulo thay cho số phức.",
      description:
        "**NTT** (Number Theoretic Transform) là FFT trên **trường modulo** thay vì số phức: căn đơn vị phức được thay bằng **căn nguyên thuỷ bậc n** modulo p. Cần p = c · 2^k + 1 nguyên tố để có căn bậc 2^k: với p = 998244353 = 119 · 2^23 + 1, căn nguyên thuỷ g = 3, nên hỗ trợ độ dài tới 2^23. Không có số thực nên **chính xác tuyệt đối** — kết quả là tích đa thức modulo p.\n\n" +
        "Cấu trúc giống hệt FFT: đảo bit, rồi lần lượt các tầng len = 2, 4, …, n với w_len = g^((p−1)/len); NTT ngược dùng w_len⁻¹ và nhân kết quả với n⁻¹. Mẫu dùng modulo 998244353 và g = 3.\n\n" +
        "Các modulo NTT thông dụng (g = 3 cho tất cả): 998244353 = 119·2^23 + 1, 469762049 = 7·2^26 + 1, 167772161 = 5·2^25 + 1, 7340033 = 7·2^20 + 1, 1004535809 = 479·2^21 + 1. Cần modulo bất kỳ (ví dụ 10^9 + 7) hoặc kết quả chính xác lớn: chạy NTT với ba modulo trên rồi ghép bằng CRT (Garner).",
      conditions: [
        "Modulo NTT-friendly p = c·2^k + 1; mẫu cố định p = 998244353 và g = 3",
        "Độ dài biến đổi n là luỹ thừa 2 và n ≤ 2^23",
        "Kết quả là tích chập modulo p (hệ số thật phải < p nếu muốn đọc ra giá trị chính xác)",
        "Đầu vào có thể âm hoặc ≥ p: mẫu tự chuẩn hoá về [0, p)"
      ],
      complexity: { time: "O(N log N)", space: "O(N)", note: "Mỗi tầng cập nhật w bằng một phép nhân modulo nên hằng số lớn hơn FFT chút ít; nếu cần nhanh hơn thì dựng sẵn bảng luỹ thừa căn." },
      ops: [["NTT / NTT ngược độ dài n", "O(n log n)"], ["Nhân hai đa thức độ dài N modulo p", "O(N log N)"]],
      use_case: [
        "Nhân đa thức modulo 998244353 (rất phổ biến trong đề)",
        "Đếm tổ hợp bằng hàm sinh (hệ số của tích hai chuỗi luỹ thừa)",
        "Tích chập cần kết quả chính xác (không sai số số thực) với hệ số vừa phải",
        "Nền tảng cho nghịch đảo / exp / ln đa thức, chia đa thức",
        "Ghép ba modulo NTT bằng CRT để nhân đa thức modulo bất kỳ"
      ],
      not_for: [
        "Modulo 10^9 + 7 trực tiếp → p − 1 chỉ chia hết cho 2 một lần nên không có căn bậc 2^k; dùng ba modulo + CRT hoặc split FFT",
        "Dãy ngắn (N ≲ 50) → nhân O(N²) đơn giản hơn",
        "Phép tính trên số thực → FFT"
      ],
      pitfalls: [
        "Dùng modulo 10^9 + 7 với NTT: p − 1 = 2 · 500000003 nên không có căn bậc 2^k.",
        "Nhầm căn nguyên thuỷ: mỗi modulo có g riêng (998244353 → 3, nhưng 2013265921 = 15·2^27 + 1 dùng g = 31).",
        "Quên chuẩn hoá hệ số âm hoặc ≥ p trước khi biến đổi (mẫu đã chuẩn hoá).",
        "Độ dài vượt 2^23 với 998244353: không tồn tại căn bậc đủ lớn.",
        "Hệ số kết quả thật ≥ p: giá trị đọc ra đã bị modulo — nếu cần đúng giá trị phải ghép CRT với modulo khác.",
        "Quên nhân n⁻¹ ở bước NTT ngược."
      ],
      code: {
        lang: "cpp", title: "ntt.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// NTT modulo 998244353 = 119 * 2^23 + 1, căn nguyên thuỷ g = 3. Độ dài biến đổi: luỹ thừa của 2, <= 2^23.
const long long NTT_MOD = 998244353, NTT_G = 3;

long long ntt_pow(long long a, long long e) {
    long long r = 1;
    for (a %= NTT_MOD; e > 0; e >>= 1, a = a * a % NTT_MOD)
        if (e & 1) r = r * a % NTT_MOD;
    return r;
}

// NTT tại chỗ; a[i] trong [0, NTT_MOD); invert = true: NTT ngược (đã nhân n^-1).
void ntt(vector<long long>& a, bool invert) {
    int n = a.size();
    for (int i = 1, j = 0; i < n; i++) {                  // hoán vị đảo bit
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) swap(a[i], a[j]);
    }
    for (int len = 2; len <= n; len <<= 1) {
        long long w = ntt_pow(NTT_G, (NTT_MOD - 1) / len);          // căn nguyên thuỷ bậc len
        if (invert) w = ntt_pow(w, NTT_MOD - 2);
        for (int i = 0; i < n; i += len) {
            long long wn = 1;
            for (int j = 0; j < len / 2; j++) {
                long long u = a[i + j], v = a[i + j + len / 2] * wn % NTT_MOD;
                a[i + j] = u + v >= NTT_MOD ? u + v - NTT_MOD : u + v;
                a[i + j + len / 2] = u - v < 0 ? u - v + NTT_MOD : u - v;
                wn = wn * w % NTT_MOD;
            }
        }
    }
    if (invert) {
        long long n_inv = ntt_pow(n, NTT_MOD - 2);
        for (auto& x : a) x = x * n_inv % NTT_MOD;
    }
}

// Tích hai đa thức modulo 998244353 (hệ số âm / >= mod được chuẩn hoá). Độ dài kết quả a.size() + b.size() - 1.
vector<long long> ntt_multiply(vector<long long> a, vector<long long> b) {
    if (a.empty() || b.empty()) return {};
    size_t need = a.size() + b.size() - 1, n = 1;
    while (n < need) n <<= 1;
    for (auto& x : a) x = ((x % NTT_MOD) + NTT_MOD) % NTT_MOD;
    for (auto& x : b) x = ((x % NTT_MOD) + NTT_MOD) % NTT_MOD;
    a.resize(n);
    b.resize(n);
    ntt(a, false);
    ntt(b, false);
    for (size_t i = 0; i < n; i++) a[i] = a[i] * b[i] % NTT_MOD;
    ntt(a, true);
    a.resize(need);
    return a;
}
`
      },
      example: {
        input: "A = [1, 2, 3], B = [4, 5] (modulo 998244353)",
        output: "[4, 13, 22, 15]",
        explain: "Như FFT nhưng chính xác theo modulo. Với A = B = [998244352, 1] (tức [−1, 1]) tích là 1 − 2x + x² nên cho [1, 998244351, 1]."
      },
      problems: [
        { site: "atcoder", name: "ACL Practice Contest F: Convolution" },
        { site: "other", name: "Library Checker: Convolution" }
      ],
      related: ["fft", "fast-pow", "crt"],
      compare: { "Bài toán giải": "Nhân đa thức modulo p (tích chập chính xác)", "Ràng buộc": "p = c·2^k + 1 (vd. 998244353), n ≤ 2^23", "Độ chính xác": "Chính xác (số nguyên modulo)" },
      cards: [
        { q: "NTT khác FFT ở điểm chính nào?", a: "Làm việc trong trường modulo p với căn nguyên thuỷ thay cho căn đơn vị phức, nên không có sai số số thực; kết quả là modulo p." },
        { q: "Modulo nào dùng được cho NTT?", a: "p = c·2^k + 1 nguyên tố, ví dụ 998244353 = 119·2^23 + 1 (g = 3); độ dài tối đa 2^k." },
        { q: "Vì sao không dùng NTT trực tiếp với 10^9 + 7?", a: "p − 1 = 2 · 500000003 chỉ chia hết cho 2 một lần nên không có căn bậc 2^k; phải dùng ba modulo + CRT hoặc split FFT." },
        { q: "Các bước của NTT ngược?", a: "Dùng w⁻¹ thay cho w ở mọi tầng rồi nhân kết quả với n⁻¹ (mod p)." }
      ]
    }
  ]);

  A.lib.scenarios([
    { id: "q-gcd-extgcd-1", prompt: "Cho hai số nguyên a, b với |a|, |b| ≤ 10^18 và T = 10^5 test. Mỗi test cần tìm một cặp số nguyên (x, y) sao cho a·x + b·y bằng ước chung lớn nhất của a và b; x, y phải vừa kiểu 64 bit.",
      answer: ["gcd-extgcd"], also: [], wrong: ["sieve", "euler-phi", "fft", "discrete-log"],
      why: "Đây chính là đẳng thức Bezout: Euclid mở rộng cho (x, y) trong O(log) mỗi test và các hệ số không vượt max(|a|, |b|) nên vừa 64 bit. Sàng, hàm phi Euler và FFT không liên quan; logarit rời rạc giải a^x ≡ b chứ không phải phương trình tuyến tính.", level: 1 },
    { id: "q-gcd-extgcd-2", prompt: "Có hai loại bình dung tích a và b lít (a, b ≤ 10^9). Có thể đong được đúng c lít (c ≤ 10^18) hay không, và nếu được thì phải dùng mỗi loại bình mấy lần (cho phép số lần âm tức là đổ ra)? Có 10^5 truy vấn (a, b, c).",
      answer: ["gcd-extgcd"], also: [], wrong: ["crt", "modular-inverse", "ncr-mod", "fft"],
      why: "Bài toán là phương trình Diophantine a·x + b·y = c: có nghiệm khi và chỉ khi gcd(a, b) | c, và Euclid mở rộng cho một nghiệm trong O(log). CRT và nghịch đảo modulo chỉ dùng cho đồng dư (nghịch đảo còn đòi hỏi gcd = 1 và chỉ cho một hệ số); tổ hợp và FFT không liên quan.", level: 2 },
    { id: "q-modular-inverse-1", prompt: "Mỗi truy vấn cho hai số a và M với M ≤ 10^18 là hợp số tuỳ ý (mỗi truy vấn M khác nhau, không biết phân tích của nó) và gcd(a, M) = 1. Cần tìm x thoả a·x ≡ 1 (mod M). Có 10^5 truy vấn.",
      answer: ["modular-inverse"], also: ["gcd-extgcd"], wrong: ["fast-pow", "euler-phi", "discrete-log", "sieve"],
      why: "Với modulo hợp số bất kỳ dùng Euclid mở rộng: O(log M) mỗi truy vấn. Cách Fermat a^(M−2) chỉ đúng khi M nguyên tố; cách Euler a^(φ(M)−1) cần φ(M), tức phải phân tích M ≤ 10^18 cho từng truy vấn — quá chậm. Logarit rời rạc và sàng không liên quan.", level: 2 },
    { id: "q-modular-inverse-2", prompt: "Cho p = 998244353 và một dãy 10^6 số nguyên a_1..a_n, không số nào chia hết cho p. Cần in nghịch đảo modulo p của từng số, và thời gian chỉ đủ cho vài lần quét O(n) cộng một số ít phép luỹ thừa.",
      answer: ["modular-inverse"], also: ["fast-pow"], wrong: ["pollard-rho", "ntt", "discrete-log", "sieve"],
      why: "Nghịch đảo hàng loạt: tích tiền tố, một lần nghịch đảo của tích cả dãy (luỹ thừa Fermat), rồi lùi để tách từng phần tử — O(n + log p). Gọi luỹ thừa nhanh từng số cũng được nhưng thêm hệ số log p. Các mục còn lại (phân tích thừa số, NTT, logarit rời rạc, sàng) không giải bài toán này.", level: 2 },
    { id: "q-fast-pow-1", prompt: "Cho T = 10^5 bộ ba (a, n, p) với a < p, n tới 10^18 và p = 10^9 + 7. Cần in a^n mod p cho từng bộ.",
      answer: ["fast-pow"], also: ["matrix-exponentiation"], wrong: ["discrete-log", "ntt", "sieve"],
      why: "Luỹ thừa nhanh cho kết quả trong O(log n) ≈ 60 phép nhân modulo mỗi bộ. Luỹ thừa ma trận 1 × 1 cho cùng kết quả nhưng chỉ là cách làm rườm rà. Logarit rời rạc làm bài toán ngược (tìm n); NTT và sàng không liên quan.", level: 1 },
    { id: "q-sieve-1", prompt: "N = 10^7. Cần liệt kê mọi số nguyên tố ≤ N, và sau đó trả lời 10^6 truy vấn dạng 'in phân tích ra thừa số nguyên tố của x' với mỗi x ≤ N.",
      answer: ["sieve"], also: [], wrong: ["miller-rabin", "pollard-rho", "euler-phi"],
      why: "Sàng tuyến tính dựng mảng ước nguyên tố nhỏ nhất trong O(N), sau đó mỗi truy vấn phân tích O(log x). Miller–Rabin chỉ trả lời nguyên tố hay không; Pollard's Rho phân tích được nhưng 10^6 lần quá chậm khi có sàng; hàm phi Euler tính một giá trị khác.", level: 2 },
    { id: "q-sieve-2", prompt: "Cho hai số L và R với R ≤ 10^12 và R − L ≤ 10^6. Cần liệt kê tất cả các số nguyên tố trong đoạn [L, R].",
      answer: ["sieve"], also: ["miller-rabin"], wrong: ["pollard-rho", "euler-phi", "ntt"],
      why: "Sàng phân đoạn: sàng các nguyên tố tới √R ≤ 10^6 rồi gạch bội của chúng trong [L, R], tổng cỡ (R − L) log log R. Có thể chấp nhận Miller–Rabin cho từng số (10^6 lần kiểm tra) nhưng chậm hơn; Pollard's Rho là thừa, phi Euler và NTT không liên quan.", level: 3 },
    { id: "q-miller-rabin-1", prompt: "Cho T = 10^5 số nguyên n ≤ 10^18. Với mỗi số cần cho biết n có phải số nguyên tố hay không.",
      answer: ["miller-rabin"], also: [], wrong: ["sieve", "pollard-rho", "euler-phi"],
      why: "Miller–Rabin tất định với bộ cơ số cố định trả lời trong vài trăm phép nhân 128 bit mỗi số. Sàng không dựng nổi mảng tới 10^18; Pollard's Rho phân tích hẳn n (chậm hơn nhiều, đặc biệt với n nguyên tố hoặc bán nguyên tố lớn); phi Euler không kiểm tra nguyên tố.", level: 3 },
    { id: "q-pollard-rho-1", prompt: "Cho T = 100 số nguyên n ≤ 10^18. Với mỗi số cần in tất cả ước nguyên tố cùng số mũ của n (có thể n là tích của hai nguyên tố khoảng 10^9).",
      answer: ["pollard-rho"], also: [], wrong: ["sieve", "miller-rabin", "euler-phi", "crt"],
      why: "Cần phân tích thừa số của số tới 10^18: Pollard's Rho (kèm Miller–Rabin để biết khi nào dừng) mất khoảng n^(1/4) ≈ 3·10^4 bước. Sàng chỉ phủ tới ~10^8; Miller–Rabin một mình chỉ trả lời nguyên tố hay không; phi Euler và CRT không phân tích thừa số.", level: 4 },
    { id: "q-euler-phi-1", prompt: "N = 2·10^6. Cần φ(i) — số các số trong [1, i] nguyên tố cùng nhau với i — cho mọi i từ 1 đến N, rồi tính tổng.",
      answer: ["euler-phi"], also: ["sieve"], wrong: ["gcd-extgcd", "fast-pow", "fft", "pollard-rho"],
      why: "Hàm phi Euler tính cả bảng bằng sàng tuyến tính trong O(N). Đếm bằng gcd từng cặp là O(N² log N); luỹ thừa nhanh, FFT không liên quan; Pollard's Rho là thừa cho số nhỏ ≤ 2·10^6.", level: 2 },
    { id: "q-euler-phi-2", prompt: "Cho a ≤ 10^9, m ≤ 10^9 là số bất kỳ (không nhất thiết nguyên tố) và b là số có tới 10^5 chữ số thập phân cho dưới dạng chuỗi. Cần tính a^b mod m.",
      answer: ["euler-phi"], also: ["fast-pow"], wrong: ["discrete-log", "crt", "ntt", "matrix-exponentiation"],
      why: "Số mũ quá lớn nên phải rút gọn: a^b ≡ a^(b mod φ(m) + φ(m)) (mod m) khi b ≥ φ(m), với φ(m) tính bằng chia thử √m; sau đó mới dùng luỹ thừa nhanh. Logarit rời rạc giải bài toán ngược; CRT, NTT và luỹ thừa ma trận không giúp rút gọn số mũ.", level: 3 },
    { id: "q-crt-1", prompt: "Một số nguyên x chưa biết thoả x mod 1000000007 = 123 và x mod 998244353 = 456. Cần tìm x nhỏ nhất không âm (x nhỏ hơn tích hai modulo, vừa 64 bit). Có 10^5 test với các cặp số dư khác nhau.",
      answer: ["crt"], also: ["modular-inverse", "gcd-extgcd"], wrong: ["euler-phi", "discrete-log", "ntt"],
      why: "Đó là hệ hai đồng dư với modulo nguyên tố cùng nhau: CRT cho nghiệm duy nhất modulo tích, gộp bằng Euclid mở rộng/nghịch đảo trong O(log). Tự dùng nghịch đảo modulo cũng được (thuật toán Garner) nhưng đó chính là cách CRT làm. Phi Euler, logarit rời rạc và NTT không giải hệ đồng dư.", level: 2 },
    { id: "q-crt-2", prompt: "Có tối đa 20 điều kiện dạng x ≡ a_i (mod m_i) với m_i ≤ 10^9 KHÔNG nguyên tố cùng nhau, và biết bội chung nhỏ nhất của các m_i vừa trong số 64 bit. Cần tìm x nhỏ nhất không âm thoả mọi điều kiện hoặc báo vô nghiệm.",
      answer: ["crt"], also: ["gcd-extgcd"], wrong: ["modular-inverse", "euler-phi", "gaussian-elimination", "discrete-log"],
      why: "Mô-đun không nguyên tố cùng nhau cần CRT tổng quát: gộp từng cặp, kiểm gcd(m₁, m₂) | (a₂ − a₁) và nghiệm modulo lcm. Công thức dùng nghịch đảo của M/m_i không áp dụng được khi gcd > 1; Gauss, phi Euler, logarit rời rạc giải bài toán khác.", level: 3 },
    { id: "q-ncr-mod-1", prompt: "Có Q = 10^6 truy vấn, mỗi truy vấn cho n, r với n ≤ 10^6. Cần C(n, r) mod (10^9 + 7).",
      answer: ["ncr-mod"], also: [], wrong: ["matrix-exponentiation", "fft", "gaussian-elimination", "sieve"],
      why: "Tiền xử lý giai thừa và nghịch đảo giai thừa một lần O(n), mỗi truy vấn sau đó O(1). Luỹ thừa ma trận, FFT, khử Gauss và sàng không phải công cụ tính hệ số nhị thức modulo; tính trực tiếp mỗi truy vấn O(r) sẽ quá chậm cho 10^6 truy vấn.", level: 2 },
    { id: "q-ncr-mod-2", prompt: "Có Q = 10^5 truy vấn, mỗi truy vấn cho n, r với 0 ≤ r ≤ n ≤ 10^18 và modulo cố định p = 10007 (số nguyên tố). Cần C(n, r) mod p.",
      answer: ["ncr-mod"], also: [], wrong: ["fast-pow", "crt", "euler-phi", "fft"],
      why: "n lớn hơn p nên giai thừa chứa thừa số p: dùng định lý Lucas với bảng giai thừa tới p − 1, mỗi truy vấn O(log_p n). Luỹ thừa nhanh, CRT, phi Euler và FFT không tự tính được hệ số nhị thức khi n ≥ p.", level: 3 },
    { id: "q-matrix-exponentiation-1", prompt: "Dãy a_n = 3·a_(n−1) + 2·a_(n−2) − a_(n−3) với a_0, a_1, a_2 cho trước. Cần a_N mod (10^9 + 7) với N lên tới 10^18, có 10 test.",
      answer: ["matrix-exponentiation"], also: [], wrong: ["fft", "ntt", "fast-pow", "gaussian-elimination"],
      why: "Truy hồi tuyến tính bậc 3 hệ số cố định: ma trận 3 × 3 mũ N bằng bình phương liên tiếp, O(27 log N). Luỹ thừa nhanh trên số không xử lý được truy hồi nhiều biến; FFT/NTT nhân đa thức; Gauss giải hệ phương trình chứ không sinh số hạng thứ N.", level: 3 },
    { id: "q-matrix-exponentiation-2", prompt: "Một đồ thị có hướng 100 đỉnh (có thể có cạnh song song và vòng). Cần đếm số đường đi (cho phép lặp đỉnh/cạnh) có độ dài đúng K = 10^9 từ đỉnh u tới đỉnh v, modulo 10^9 + 7.",
      answer: ["matrix-exponentiation"], also: [], wrong: ["floyd-warshall", "bfs", "dfs", "fast-pow"],
      why: "Số đường đi độ dài K chính là phần tử (A^K)[u][v] của ma trận kề: luỹ thừa ma trận 100 × 100 trong O(100³ · log K). BFS/DFS/Floyd–Warshall tìm đường ngắn nhất hoặc liên thông, không đếm theo độ dài cố định lớn; luỹ thừa nhanh thuần số không đủ cho ma trận.", level: 3 },
    { id: "q-gaussian-elimination-1", prompt: "Cho hệ 500 phương trình tuyến tính, 500 ẩn với hệ số thực. Cần tìm nghiệm hoặc cho biết hệ vô nghiệm / có vô số nghiệm.",
      answer: ["gaussian-elimination"], also: [], wrong: ["matrix-exponentiation", "fft", "crt", "modular-inverse"],
      why: "Khử Gauss (partial pivoting, so với epsilon) giải hệ O(n³) ≈ 1,25·10^8 và phân loại ba trường hợp theo hạng. Luỹ thừa ma trận, FFT, CRT và nghịch đảo modulo không giải hệ phương trình thực.", level: 2 },
    { id: "q-gaussian-elimination-2", prompt: "Cho hệ n = 300 phương trình tuyến tính, 300 ẩn, hệ số và vế phải là số nguyên; cần in nghiệm theo modulo 10^9 + 7 hoặc báo không tồn tại nghiệm duy nhất.",
      answer: ["gaussian-elimination"], also: [], wrong: ["crt", "discrete-log", "matrix-exponentiation", "ncr-mod"],
      why: "Khử Gauss trên modulo nguyên tố (phép chia là nhân nghịch đảo) giải hệ O(n³) không sai số và cho biết hạng để phân biệt nghiệm duy nhất. CRT, logarit rời rạc, luỹ thừa ma trận và tổ hợp không giải hệ tuyến tính.", level: 3 },
    { id: "q-fft-1", prompt: "Cho hai dãy số nguyên không âm A và B, mỗi dãy dài 2·10^5, mọi giá trị ≤ 100. Cần mọi tổng C[k] = Σ A[i]·B[k − i] (không lấy modulo; mỗi C[k] tối đa 2·10^9).",
      answer: ["fft"], also: [], wrong: ["ntt", "matrix-exponentiation", "gaussian-elimination", "sieve"],
      why: "Tích chập của hai dãy dài 2·10^5: FFT O(N log N); kết quả ≤ 2·10^9 nhỏ nên complex<double> làm tròn đúng. NTT một modulo 998244353 chỉ cho kết quả modulo 998244353 mà giá trị thật tới 2·10^9 vượt modulo nên không dùng riêng được; hai mục còn lại giải bài khác.", level: 3 },
    { id: "q-ntt-1", prompt: "Cho hai đa thức, mỗi đa thức có 5·10^5 hệ số và mỗi hệ số là số nguyên trong [0, 998244352]. Cần tích của hai đa thức, in mỗi hệ số modulo 998244353.",
      answer: ["ntt"], also: [], wrong: ["fft", "matrix-exponentiation", "gaussian-elimination", "crt"],
      why: "Modulo 998244353 = 119·2^23 + 1 là modulo NTT: nhân đa thức O(N log N) chính xác tuyệt đối. FFT số phức không đủ chính xác vì hệ số tới 10^9 làm kết quả tới ~10^23; luỹ thừa ma trận, Gauss, CRT không nhân đa thức.", level: 3 },
    { id: "q-discrete-log-1", prompt: "Cho p = 10^9 + 7 (nguyên tố) và các số a, b. Cần tìm số nguyên x không âm nhỏ nhất thoả a^x ≡ b (mod p), hoặc báo không tồn tại. Có 10 test.",
      answer: ["discrete-log"], also: [], wrong: ["fast-pow", "modular-inverse", "euler-phi", "crt"],
      why: "Đây là logarit rời rạc: baby-step giant-step O(√p) ≈ 3·10^4 mỗi test. Luỹ thừa nhanh chỉ tính a^x khi biết x; nghịch đảo modulo, hàm phi và CRT không tìm được số mũ.", level: 4 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
