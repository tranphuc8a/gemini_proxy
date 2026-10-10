/* Thực hành — Bài 19: Kỹ thuật C++ cho bài heuristic (cấm header, stack 1 MB, không đồng hồ, RNG tự viết). */

/* ---------------------------------------------------------------------------------------------
   Bài toán 1 — b19-xorshift (tuDapAn): cài xorshift64* đúng từng bit, kể cả seed = 0 và seed > 2^53.
   stdin : "seed k n"        stdout: k số below(n), rồi 3 số unit()
   --------------------------------------------------------------------------------------------- */
TH.vande.dangKy("b19-xorshift", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    var r = TH.tienIch.rng(seed), loai = seed % 5, hat;
    function so64(cao) {                     /* số nguyên không dấu 64 bit, trả về chuỗi thập phân */
      var hi = r.int(4294967296), lo = r.int(4294967296);
      if (cao) hi = (hi | 0x80000000) >>> 0;
      return ((BigInt(hi) << 32n) | BigInt(lo)).toString();
    }
    if (loai === 0) hat = "0";                              /* seed 0: phải đổi sang hằng số mặc định */
    else if (loai === 1) hat = String(r.khoang(1, 9999));   /* seed nhỏ */
    else if (loai === 2) hat = "88172645463325252";         /* chính hằng số mặc định */
    else if (loai === 3) hat = so64(true);                  /* ≥ 2^63: tràn cả số nguyên có dấu 64 bit */
    else hat = so64(false);                                 /* ngẫu nhiên 64 bit, thường > 2^53: Number làm mất chữ số */
    var gocN = [100, 1000, 1000000, 4000000000];            /* n gần 4·10^9: in bằng %d sẽ ra số âm */
    return { hat: hat, k: (tham && tham.k) || 10, n: gocN[r.int(gocN.length)] };
  },
  viet: function (inst) { return inst.hat + " " + inst.k + " " + inst.n + "\n"; },
  giai: function (inst) {
    var M = (1n << 64n) - 1n, s = BigInt(inst.hat) & M, kq = [];
    if (s === 0n) s = 88172645463325252n;
    function next() {
      s ^= s >> 12n; s ^= (s << 25n) & M; s ^= s >> 27n;
      return (s * 2685821657736338717n) & M;
    }
    for (var i = 0; i < 8; i++) next();                     /* làm nóng */
    for (var j = 0; j < inst.k; j++) kq.push(Number(next() % BigInt(inst.n)));
    for (var u = 0; u < 3; u++) kq.push(Number(next() >> 11n) / 9007199254740992);
    return kq;
  },
  saiSo: 1e-9,
  dinhDang: {
    vao: "Một dòng `seed k n`: `seed` là số nguyên không dấu 64 bit (có thể lớn hơn 2⁵³), `k` là số giá trị cần in, `n` là cận trên của `below(n)` (`n` ≤ 4 294 967 295).",
    ra: "`k` dòng, mỗi dòng một giá trị `below(n)` theo thứ tự sinh; rồi 3 dòng, mỗi dòng một giá trị `unit()` in với ít nhất 12 chữ số thập phân."
  }
}));

/* ---------------------------------------------------------------------------------------------
   Bài toán 2 — b19-2opt-ngan-sach (tuDapAn): 2-opt first-improvement chạy dưới OpBudget; kết quả tất định tuyệt đối.
   stdin : "n B" rồi n dòng "x y"     stdout: "soDelta soLanDoi doDai"
   --------------------------------------------------------------------------------------------- */
TH.vande.dangKy("b19-2opt-ngan-sach", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    var r = TH.tienIch.rng(seed), n = (tham && tham.n) || 60, x = [], y = [];
    for (var i = 0; i < n; i++) { x.push(r.khoang(0, 99)); y.push(r.khoang(0, 99)); }
    return { n: n, B: (tham && tham.B) || 7000, x: x, y: y };
  },
  viet: function (inst) {
    var s = inst.n + " " + inst.B + "\n";
    for (var i = 0; i < inst.n; i++) s += inst.x[i] + " " + inst.y[i] + "\n";
    return s;
  },
  giai: function (inst) {
    var n = inst.n, x = inst.x, y = inst.y, p = [], i, j;
    for (i = 0; i < n; i++) p.push(i);
    function d(a, b) { return Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]); }
    var left = inst.B, soDelta = 0, soLanDoi = 0, cai = true;
    xong: while (cai) {
      cai = false;
      for (i = 0; i < n - 1; i++) {
        for (j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          left -= 1;                                  /* spend(1): trừ trước… */
          if (!(left > 0)) break xong;                /* …rồi mới hỏi còn ngân sách không */
          soDelta++;
          var a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
          if (d(a, c) + d(b, e) - d(a, b) - d(c, e) < 0) {
            for (var l = i + 1, h = j; l < h; l++, h--) { var t = p[l]; p[l] = p[h]; p[h] = t; }
            soLanDoi++; cai = true;
          }
        }
      }
    }
    var dai = 0;
    for (i = 0; i < n; i++) dai += d(p[i], p[(i + 1) % n]);
    return [soDelta, soLanDoi, dai];
  },
  saiSo: 0,
  dinhDang: {
    vao: "Dòng 1: `n B` — số điểm và ngân sách (khởi tạo `left = B` của `OpBudget`). Tiếp theo `n` dòng `x y` — toạ độ nguyên. Chu trình ban đầu là thứ tự nhập `0, 1, …, n−1`; khoảng cách là Manhattan `|Δx| + |Δy|`.",
    ra: "Một dòng ba số nguyên: `soDelta soLanDoi doDai` — số lần đã đánh giá delta, số lần đảo đoạn thành công, độ dài chu trình lúc dừng."
  }
}));

TH.dangKy({
  id: "bai-19-ky-thuat-cpp",

  tomTat: [
    "Đề thi cấm header, stack chỉ 1 MB, không có đồng hồ và 100 ms mỗi test — như nấu ăn trong căn bếp lạ. Mọi kỹ thuật của bài là **một cách quay lại nhìn dữ liệu**: bỏ được `sort` vì chỉ cần 3 phần tử, bỏ được `int` vì khoảng cách không quá 198.",
    "Không có `<algorithm>`: chọn **top-K bằng chèn** vào bảng K ô luôn giữ thứ tự (O(n·K), một lượt duyệt) hoặc **counting sort** khi khoảng cách là số nguyên nhỏ (O(n) mỗi đỉnh). `vector` → mảng tĩnh + biến độ dài, `memset` → vòng `for`, `exp` → Threshold Accepting.",
    "Stack chỉ 1 MB: mảng cục bộ `int dm[400][400]` là 640 000 byte (625 KB), cộng thêm vài mảng nữa là chương trình chết im lặng. Quy tắc: **mọi mảng > 1 KB phải là `static` hoặc global**.",
    "Thu nhỏ kiểu: khoảng cách Manhattan trên lưới 100×100 tối đa 198 < 255 nên `unsigned char` đủ — 160 000 byte thay vì 640 000, lại nhanh hơn nhờ cache. Nhưng lưới 200×200 cho 398 > 255 là **tràn âm thầm**: luôn kiểm tra miền giá trị.",
    "Điểm tích luỹ qua 1 000 test lên cỡ 3×10¹⁰, vượt 2,1×10⁹ của `int`: tràn số quay vòng **không báo lỗi**. Điểm tích luỹ luôn là `long long`.",
    "RNG tự viết `xorshift64*`: **seed ≠ 0** (seed 0 kẹt vĩnh viễn ở 0), **làm nóng 8 lần**, và tất định trên mọi trình biên dịch — còn `std::uniform_int_distribution` cho kết quả khác nhau giữa libstdc++ và libc++.",
    "Không đọc được đồng hồ thì thiết kế **ngân sách phép toán cố định** theo hằng số biên dịch, hiệu chuẩn một lần trên máy dev (27,4 ms trung bình, 37,8 ms xấu nhất so với giới hạn 100 ms, hệ số an toàn ≈ 2,6). `OpBudget` giữ **khối lượng công việc** cố định, không giữ thời gian cố định.",
    "Tám kỹ thuật vòng nóng: nhân chéo thay chia; tra bảng; thoát sớm; duyệt theo hàng; free list; dấu thời gian thay `memset`; tránh `%`; nhánh hay xảy ra lên trước. Build phải sạch với `-Wall -Wextra -Wshadow -Wconversion`; khi debug thêm `-fsanitize=address,undefined`."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§1.2, §6.1",
      hoi: "Đoạn mã sau chạy trong môi trường có stack tối đa 1 MB. Chương trình chết ngay khi vào `tinhToan()`, không in một dòng lỗi nào. Nguyên nhân và cách sửa đúng là gì?\n\n```cpp\nvoid tinhToan() {\n    int dm[600][600];      // bảng khoảng cách\n    /* ... */\n}\n```",
      chon: [
        "Thiếu `#include <cstring>`; thêm header để mảng được khởi tạo",
        "Mảng 600 × 600 × 4 = 1 440 000 byte vượt stack 1 MB (tràn ngăn xếp); thêm `static` để chuyển nó sang vùng tĩnh",
        "Chỉ số mảng chạy ra ngoài biên; phải đổi 600 thành 599",
        "`int` không đủ chứa khoảng cách; phải đổi sang `long long`"
      ],
      dung: 1,
      giaiThich: "600 × 600 × 4 byte = 1 440 000 byte ≈ 1 406 KB, lớn hơn 1 024 KB của stack nên tiến trình bị giết im lặng. `static` đưa mảng sang vùng tĩnh (.bss) nên stack không còn dính gì. Thiếu header không làm crash lúc chạy; khai báo [600][600] hợp lệ với chỉ số 0…599; còn `int` hoàn toàn đủ cho bảng khoảng cách nhỏ — vấn đề là kích thước, không phải miền giá trị."
    },
    {
      id: "q2", loai: "nhieu", doKho: 2, ref: "§6.1",
      hoi: "Theo quy tắc “mọi mảng > 1 KB phải là `static` hoặc global” (1 KB = 1 024 byte), những khai báo **cục bộ trong hàm** nào dưới đây vi phạm?",
      chon: [
        "`int dem[200];`",
        "`unsigned char dm[400][400];`",
        "`char ten[64];`",
        "`short nbr[400][24];`",
        "`double top[8];`",
        "`long long best[512];`"
      ],
      dung: [1, 3, 5],
      giaiThich: "Tính kích thước: 400 × 400 × 1 = 160 000 byte, 400 × 24 × 2 = 19 200 byte, 512 × 8 = 4 096 byte — cả ba vượt 1 KB. `int dem[200]` chỉ 800 byte, còn `char ten[64]` và `double top[8]` đều 64 byte, dưới ngưỡng. Ngưỡng 1 KB là quy tắc thực hành: các mảng lớn cộng dồn qua nhiều lời gọi hàm lồng nhau mới làm cạn stack, nên ta cho hết sang `static`."
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "§1.2, §10 (cạm bẫy 3)",
      hoi: "Bạn lưu khoảng cách Manhattan trong `static unsigned char dm[400][400]` và mọi thứ chạy tốt trên lưới 100×100. Đề mới đổi sang lưới 200×200 và bạn giữ nguyên kiểu. Điều gì xảy ra?",
      chon: [
        "Trình biên dịch báo lỗi vì giá trị không vừa `unsigned char`",
        "Chương trình crash với lỗi tràn stack",
        "Chạy chậm đi vì mỗi khoảng cách giờ cần hai byte",
        "Khoảng cách lớn hơn 255 bị quay vòng âm thầm (tối đa 398), thuật toán vẫn chạy và cho kết quả vô nghĩa"
      ],
      dung: 3,
      giaiThich: "Lưới 200×200 có khoảng cách tối đa 199 + 199 = 398 > 255. Gán vào `unsigned char` không báo lỗi mà lấy phần dư theo 256, nên bảng khoảng cách sai mà không ai biết. Mảng là `static` nên không liên quan đến stack, và kiểu không tự nới rộng khi giá trị lớn hơn — vì vậy phải kiểm tra miền giá trị mỗi khi đổi đề."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§4.2",
      hoi: "Một bạn viết bộ sinh xorshift như dưới đây, rồi chạy thí nghiệm với `Rng r(0);`. Mọi số sinh ra đều bằng 0.\n\n```cpp\nstruct Rng {\n    unsigned long long s;\n    explicit Rng(unsigned long long seed) : s(seed) {}\n    unsigned long long next() {\n        s ^= s >> 12;  s ^= s << 25;  s ^= s >> 27;\n        return s * 2685821657736338717ULL;\n    }\n};\n```\nCách sửa nào **thật sự** giải quyết?",
      chon: [
        "Gọi `next()` tám lần trong hàm khởi tạo để làm nóng",
        "Đổi hằng số nhân sang một số nguyên tố lớn hơn",
        "Dùng `next() % n` với n lớn để phân tán giá trị",
        "Thay seed 0 bằng một hằng số khác 0 ngay trong hàm khởi tạo (ví dụ `seed ? seed : 88172645463325252ULL`)"
      ],
      dung: 3,
      giaiThich: "Trạng thái 0 là điểm bất động của xorshift: dịch và XOR của 0 vẫn là 0, rồi 0 nhân hằng số cũng là 0, nên seed 0 kẹt vĩnh viễn. Làm nóng 8 lần chỉ lặp lại 0; đổi hằng số nhân không dời được điểm bất động; còn `%` chỉ gây lệch nhẹ khi n lớn. Chỉ việc thay seed 0 bằng giá trị khác 0 mới phá được."
    },
    {
      id: "q5", loai: "mot", doKho: 3, ref: "§3.2",
      hoi: "Bạn sửa hàm top-K của bài để giữ K khoảng cách **nhỏ nhất** (đổi `>` thành `<`), nhưng mảng `topVal` vẫn chỉ là `static` với giá trị khởi tạo mặc định.\n\n```cpp\nstatic int    topIdx[K];\nstatic double topVal[K];\n\ninline void push(int j, double v) {\n    for (int q = 0; q < K; ++q) {\n        if (v < topVal[q]) {\n            for (int r = K-1; r > q; --r) { topVal[r]=topVal[r-1]; topIdx[r]=topIdx[r-1]; }\n            topVal[q] = v; topIdx[q] = j; return;\n        }\n    }\n}\n```\nVới mọi khoảng cách dương, bảng ra sao sau khi duyệt hết n ứng viên?",
      chon: [
        "Không ứng viên nào được chèn, vì `topVal` toàn 0 và không khoảng cách dương nào nhỏ hơn 0; bảng phải khởi tạo bằng một số rất lớn",
        "Chứa đúng K ứng viên gần nhất như mong muốn",
        "Chứa K ứng viên xa nhất vì phép so sánh bị ngược",
        "Báo lỗi biên dịch vì mảng `static` chưa được khởi tạo"
      ],
      dung: 0,
      giaiThich: "Mảng `static` được khởi tạo bằng 0. Với khoảng cách dương, điều kiện `v < 0` không bao giờ đúng nên không ai được chèn và `topIdx` giữ nguyên toàn 0. Khi đổi từ “K lớn nhất” sang “K nhỏ nhất”, phải đặt `topVal[q]` bằng một số rất lớn lúc bắt đầu (và nhớ làm lại cho mỗi lần dùng). Không có phép chèn nào xảy ra nên hai kết quả “K gần nhất”, “K xa nhất” đều sai; `static` chưa khởi tạo là hợp lệ nên không có lỗi biên dịch."
    },
    {
      id: "q6", loai: "so", doKho: 2, ref: "§5.4", donVi: "(lần)",
      hoi: "Với cấu trúc dưới đây, thân vòng lặp `while` chạy bao nhiêu lần?\n\n```cpp\nstruct OpBudget {\n    long long left;\n    bool spend(long long cost = 1) { left -= cost; return left > 0; }\n};\n\nOpBudget nganSach{1000};\nint dem = 0;\nwhile (nganSach.spend(100)) { ++dem; }\n```",
      dapAn: 9, saiSo: 0,
      giaiThich: "`spend` trừ trước rồi mới kiểm tra `left > 0`: sau lần gọi thứ k, left = 1000 − 100k. Các lần k = 1…9 cho left = 900…100 > 0 nên trả `true`; lần thứ 10 ra left = 0 nên trả `false` và thân vòng không chạy. Vậy thân chạy 9 lần chứ không phải 10. Cùng lý do, ngân sách 30 000 000 với cost 100 ở bài chỉ cho 299 999 vòng (đã chạy thử bằng code)."
    },
    {
      id: "q7", loai: "so", doKho: 1, ref: "§6.2", donVi: "(byte)",
      hoi: "Tổng bộ nhớ (tính bằng byte) của ba mảng toàn cục sau là bao nhiêu?\n\n```cpp\nstatic unsigned char dm[400][400];\nstatic short         nbr[400][24];\nstatic unsigned char occAll[100][100];\n```",
      dapAn: 189200, saiSo: 0,
      giaiThich: "dm: 400 × 400 × 1 = 160 000 byte; nbr: 400 × 24 × 2 = 19 200 byte; occAll: 100 × 100 × 1 = 10 000 byte. Tổng = 160 000 + 19 200 + 10 000 = 189 200 byte (khoảng 185 KB). Nếu `dm` là `int` thì riêng nó đã 640 000 byte — gấp 4 lần."
    },
    {
      id: "q8", loai: "nhieu", doKho: 2, ref: "§7",
      hoi: "Những cách viết nào dưới đây đúng với các kỹ thuật tăng tốc vòng nóng của bài?",
      chon: [
        "`if ((long long)p[j] * cBest > (long long)pBest * c[j])` thay cho `(double)p[j] / c[j] > best`",
        "Duyệt `dm[j][i]` với `j` chạy trong vòng lặp để tận dụng cache",
        "Dùng `stamp[i] == curStamp` và tăng `++curStamp` mỗi vòng, thay cho `memset(visited, 0, …)` mỗi vòng",
        "Đặt phép kiểm tra hiếm khi xảy ra lên đầu để loại sớm, các nhánh hay xảy ra để sau",
        "`int next = (i + 1 == n) ? 0 : i + 1;` thay cho `(i + 1) % n`"
      ],
      dung: [0, 2, 4],
      giaiThich: "Nhân chéo bằng số nguyên tránh chia và số thực; dấu thời gian đổi việc xoá mảng O(n) thành O(1) mỗi vòng; so sánh với n thay cho `%` tránh phép chia. Duyệt theo cột nhảy 400 byte mỗi bước nên cache miss — phải duyệt theo hàng `dm[i][j]`. Và quy tắc đặt nhánh là ngược lại: nhánh hay xảy ra kiểm tra trước (ví dụ `if (khongVuaThoiGian) continue;`)."
    },
    {
      id: "q9", loai: "nhieu", doKho: 1, ref: "§8",
      hoi: "Về bốn cờ cảnh báo `-Wall -Wextra -Wshadow -Wconversion` và `-fsanitize=address`, những phát biểu nào đúng?",
      chon: [
        "`-Wshadow` báo khi một biến cục bộ che khuất biến ở phạm vi ngoài",
        "`-Wconversion` báo khi ép kiểu có thể mất dữ liệu, như `int` → `short` hoặc `double` → `int`",
        "`-fsanitize=address` bắt truy cập ngoài biên mảng lúc chạy nên dùng khi debug",
        "`-Wall -Wextra` đủ để cảnh báo khi điểm tích luỹ kiểu `int` bị tràn lúc chạy",
        "Có cảnh báo mà vẫn biên dịch được thì cứ nộp, vì tiêu chuẩn của khoá chỉ đòi biên dịch được"
      ],
      dung: [0, 1, 2],
      giaiThich: "`-Wshadow` bắt biến che biến, `-Wconversion` bắt ép kiểu mất dữ liệu, `-fsanitize=address` bắt truy cập ngoài biên — lỗi nguy hiểm nhất khi dùng mảng tĩnh. `-Wall -Wextra` bắt biến không dùng, so sánh có dấu/không dấu, thiếu khởi tạo; tràn `int` xảy ra lúc chạy và không cảnh báo nào báo trước. Tiêu chuẩn của khoá là file nộp build **không một cảnh báo nào** với cả bốn cờ."
    },
    {
      id: "q10", loai: "mot", doKho: 1, ref: "§6.3, §10 (cạm bẫy 2)",
      hoi: "Mỗi test cho điểm cỡ 3×10⁷. Đoạn mã dưới cộng điểm qua 1 000 test:\n\n```cpp\nint tong = 0;\nfor (int t = 0; t < 1000; ++t) tong += chayMotTest(t);\nprintf(\"%d\\n\", tong);\n```\nĐiều gì xảy ra, và cách sửa nào đúng?",
      chon: [
        "Trình biên dịch báo lỗi tràn số; phải sửa theo thông báo",
        "Tổng lên cỡ 3×10¹⁰, vượt giới hạn 2,1×10⁹ của `int` nên quay vòng im lặng và in ra một số trông bình thường; sửa bằng `long long tong` và in bằng `%lld`",
        "Kết quả vẫn đúng vì `int` 32 bit chứa được tới 10¹⁰",
        "Chỉ cần đổi `%d` thành `%lld`, vẫn giữ `int tong`"
      ],
      dung: 1,
      giaiThich: "3×10⁷ × 1 000 = 3×10¹⁰, khoảng 14 lần giới hạn 2 147 483 647 của `int`. Tràn số không báo lỗi — nó lặng lẽ quay vòng (thực ra với `int` có dấu còn là hành vi không xác định). Phải khai `long long` ở nơi tích luỹ; đổi mỗi chỗ in thì vô ích vì tổng đã hỏng trước khi in."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "§1.1, §3.2, Bài tập 19.1",
      hoi: "Bạn phải chọn **3 nhà gần nhất** trong 8 nhà có khoảng cách `17 4 23 9 4 31 12 6` (đúng thứ tự mảng) mà **không được dùng `sort`**. Mô tả cách làm bằng bảng ba ô, chạy tay từng bước, rồi so sánh chi phí với sắp xếp: khi nào cách của bạn thua?",
      goiY: ["Bảng luôn giữ thứ tự từ gần tới xa; mỗi số mới chỉ hỏi “mày có gần hơn ô nào đang có không?”.", "Đếm số phép so sánh tối đa mỗi phần tử, rồi so n·K với n·log n."],
      mau: "Giữ bảng 3 ô sắp tăng. Với mỗi khoảng cách `v` mới, duyệt ô từ đầu: gặp ô đầu tiên có `v < ô` thì dịch các ô sau xuống một nấc (ô cuối rớt ra) và đặt `v` vào đó; nếu không nhỏ hơn ô nào nhưng bảng còn ô trống thì đưa vào ô trống; thua cả ba ô thì vứt.\n\n| Xét | Bảng sau đó |\n|---|---|\n| 17 | `17 · — · —` |\n| 4 | `4 · 17 · —` |\n| 23 | `4 · 17 · 23` |\n| 9 | `4 · 9 · 17` |\n| 4 | `4 · 4 · 9` |\n| 31 | vứt, vẫn `4 · 4 · 9` |\n| 12 | vứt, vẫn `4 · 4 · 9` |\n| 6 | `4 · 4 · 6` |\n\nKết quả: ba khoảng cách 4, 4, 6 là các nhà ②, ⑤, ⑧. Mỗi phần tử tốn tối đa K = 3 phép so sánh, cả thảy cỡ n·K ≈ 24, một lượt duyệt, không cần bộ nhớ phụ hay đệ quy.\n\nSắp xếp tốn cỡ n·log n nên chèn top-K chỉ nhanh hơn khi K < log n. Với n = 400, K = 24 thì n·K = 9 600 còn n·log₂n cỡ 3 460, tức sắp xếp ít phép hơn — nhưng khi `sort` bị cấm ta vẫn dùng chèn, hoặc counting sort (§3.3) nếu khoảng cách là số nguyên nhỏ.",
      tieuChi: [
        "Mô tả bảng K ô luôn sắp thứ tự và quy tắc chèn / dịch / vứt cho từng số mới",
        "Chạy tay ra đúng 4, 4, 6 (các nhà ②, ⑤, ⑧)",
        "Nêu chi phí O(n·K) so với O(n log n) và điều kiện K < log n để chèn thắng",
        "Nhắc được cách thay thế khi `sort` bị cấm và khoảng cách là số nguyên nhỏ: counting sort"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§1.2, §6",
      hoi: "Giải thích: (a) vì sao `int dm[400][400]` khai báo trong hàm có thể làm chương trình chết im lặng, còn thêm chữ `static` thì hết; (b) vì sao đổi sang `unsigned char` vừa tiết kiệm bộ nhớ vừa chạy nhanh hơn; (c) mỗi lần dùng kiểu nhỏ đó ta phải kiểm tra điều gì?",
      goiY: ["Tính 400 × 400 × 4 byte rồi so với 1 024 KB của stack.", "Nhớ khối 64 byte mà CPU đọc mỗi lần (cache line)."],
      mau: "(a) 400 × 400 × 4 = 640 000 byte = 625 KB. Một bảng thì vừa stack 1 024 KB, nhưng cộng thêm các mảng khác trong hàm và trong các hàm gọi nhau là vượt: tiến trình chết ngay, **không exception, không dòng lỗi**. `static` chuyển mảng từ stack sang vùng tĩnh (có sẵn từ lúc chạy, to thoải mái) nên stack không còn dính gì.\n\n(b) Khoảng cách Manhattan trên lưới 100×100 tối đa 99 + 99 = 198 < 255 nên một byte là đủ: bảng còn 160 000 byte (156 KB), nhỏ đi 4 lần. Mỗi lần CPU lấy một khối 64 byte, nó lấy được 64 khoảng cách thay vì 16 — nên vừa cache hơn và nhanh hơn bản `int`.\n\n(c) Phải kiểm tra **miền giá trị** mỗi lần: lưới 200×200 cho khoảng cách tối đa 398 > 255 sẽ quay vòng âm thầm, bảng sai mà thuật toán vẫn chạy ra kết quả vô nghĩa. Bài học chung: khi bị tước công cụ, hãy quay lại nhìn dữ liệu.",
      tieuChi: [
        "Tính đúng 640 000 byte ≈ 625 KB, so với stack 1 024 KB và nêu hậu quả: chết không thông báo",
        "Giải thích `static` đưa mảng sang vùng tĩnh nên không chiếm stack",
        "Nêu 198 < 255, lợi ích 4 lần bộ nhớ và cache line 64 byte",
        "Nêu cạm bẫy miền giá trị: lưới 200×200 cho 398 > 255 nên tràn âm thầm"
      ]
    },
    {
      id: "l3", doKho: 2, ref: "§4, Bài tập 19.2–19.4 (RNG)",
      hoi: "Nêu hai lý do (ngoài chuyện bị cấm header) khiến khoá học dùng `xorshift64*` tự viết thay cho `<random>`; rồi nêu ba lỗi thường gặp khi cài xorshift, mỗi lỗi kèm hậu quả và cách phòng.",
      goiY: ["Nghĩ đến chuyện cùng một đoạn mã chạy trên hai thư viện chuẩn khác nhau.", "Điểm bất động của xorshift là gì?"],
      mau: "Hai lý do: (1) `std::uniform_int_distribution` cho **kết quả khác nhau** giữa libstdc++ và libc++, nên thí nghiệm không tái lập được — trong khi so sánh hai phiên bản thuật toán cần tính **tất định**; (2) bài nêu `std::mt19937` chậm hơn xorshift 3–5 lần.\n\nBa lỗi thường gặp:\n\n1. **Seed = 0** → xorshift kẹt vĩnh viễn ở 0 (dịch và XOR của 0 vẫn là 0, 0 nhân hằng số cũng là 0). Phòng: `s = seed ? seed : 88172645463325252ULL`.\n2. **Không làm nóng** → vài giá trị đầu chất lượng kém. Phòng: gọi `next()` 8 lần trong hàm khởi tạo.\n3. **`next() % n` với n lớn** → lệch nhẹ (một số giá trị xuất hiện nhiều hơn). Không quan trọng với heuristic, nhưng cần biết.\n\n(Thêm) Trong môi trường cấm mọi header, kiểu `uint64_t` cũng đến từ `<cstdint>`; hãy tự khai `typedef unsigned long long uint64;` như ở lab bên dưới.",
      tieuChi: [
        "Nêu `uniform_int_distribution` khác nhau giữa libstdc++ và libc++ nên mất tính tất định / tái lập",
        "Nêu lỗi seed = 0 kẹt ở 0 và cách phòng bằng seed mặc định khác 0",
        "Nêu lỗi không làm nóng (bỏ khoảng 8 giá trị đầu)",
        "Nêu `next() % n` lệch nhẹ khi n lớn và nói được khi nào có thể bỏ qua"
      ]
    },
    {
      id: "l4", doKho: 3, ref: "§5, Bài tập 19.4",
      hoi: "Đề cấm `<chrono>` và giới hạn 100 ms mỗi test. Hãy thiết kế cách quản lý ngân sách cho một simulated annealing: (a) “ngân sách cố định theo cấu trúc” nghĩa là gì; (b) quy trình hiệu chuẩn một lần; (c) khi một phần phụ thuộc dữ liệu thì dùng gì, và nó đảm bảo / không đảm bảo điều gì?",
      goiY: ["Số phép tính có thể tính trước từ các hằng số biên dịch như BEAM_W, MAX_DEPTH…", "Lời giải đề thi đạt 27,4 ms trung bình và 37,8 ms xấu nhất trên giới hạn 100 ms."],
      mau: "(a) Thiết kế để số phép tính **không phụ thuộc dữ liệu**: mọi tham số là hằng số biên dịch (`#define BEAM_W 24`, `BEAM_B 10`, `MAX_DEPTH 13`, `SO_NGAY 31`, `SO_PRESET 3`), nên tổng chi phí 3 × 31 × 13 × 24 × 10 × (chi phí mở rộng) **tính được trước**, không đổi.\n\n(b) Hiệu chuẩn một lần trên máy dev: đo (ví dụ 27 ms) → giả định máy chấm chậm hơn 2–3 lần (54–81 ms) → chừa hệ số an toàn ≥ 2 → mục tiêu ≤ 40 ms trên dev → chỉnh hằng số cho vừa. Số liệu thật: 27,4 ms trung bình, 37,8 ms xấu nhất, giới hạn 100 ms, hệ số ≈ 2,6.\n\n(c) Với phần phụ thuộc dữ liệu dùng bộ đếm phép toán `OpBudget { long long left; bool spend(c) { left -= c; return left > 0; } }`, hiệu chuẩn `left` một lần trên máy dev. Nó đảm bảo **khối lượng công việc cố định** (nên kết quả tái lập được, và bảo vệ khỏi TLE nếu hệ số an toàn đủ lớn); nó **không** đảm bảo thời gian thực cố định — thời gian vẫn dao động theo tốc độ và tải của máy.",
      tieuChi: [
        "Giải thích ngân sách cấu trúc: hằng số biên dịch nên tổng phép tính tính được trước",
        "Nêu đủ các bước hiệu chuẩn, gồm hệ số an toàn ≥ 2 và mục tiêu ≈ 40 ms trên máy dev",
        "Mô tả OpBudget cho phần phụ thuộc dữ liệu (trừ trước rồi kiểm tra `left > 0`)",
        "Nói rõ OpBudget đảm bảo khối lượng công việc / tái lập nhưng không đảm bảo thời gian thực"
      ]
    }
  ],

  lab: [
    {
      id: "xorshift-tat-dinh",
      ten: "Cài xorshift64* tất định (seed 0, seed 64 bit)",
      doKho: 2,
      ref: "§4, §3",
      de: "Cài bộ sinh `xorshift64*` đúng như §4.2 — không `<random>`, không `rand()`:\n\n" +
          "- trạng thái `s` là số nguyên **không dấu 64 bit**; hàm dựng nhận `seed`, đổi seed `0` thành hằng số mặc định `88172645463325252`, rồi **làm nóng 8 lần** `next()`;\n" +
          "- `next()`: `s ^= s >> 12; s ^= s << 25; s ^= s >> 27; return s * 2685821657736338717` (mọi phép tính modulo 2⁶⁴);\n" +
          "- `below(n) = next() % n`; `unit() = (next() >> 11) / 2⁵³`.\n\n" +
          "Đọc một dòng `seed k n`; in **k** giá trị `below(n)` (mỗi dòng một số, theo thứ tự sinh), rồi **3** giá trị `unit()` (mỗi dòng một số, in ít nhất 12 chữ số thập phân). Chấm trên 10 bộ dữ liệu, có seed = 0, seed lớn hơn 2⁶³ và `n` gần 4×10⁹. Chỉ có một mức: bộ sinh phải **đúng từng bit**.\n\n" +
          "**JS:** số 64 bit không biểu diễn đúng bằng `Number` — dùng `BigInt` và giữ trong 64 bit bằng `& MASK`. **C++:** đề thi cấm cả `<cstdint>`, nên ta tự khai `typedef unsigned long long`; ở đây chỉ dùng `<cstdio>` để đọc/ghi, và in `below` bằng `%u` (không phải `%d`).\n\n" +
          "**Suy ngẫm:** (1) Chuyện gì xảy ra nếu bạn bỏ dòng đổi seed 0? (2) Bỏ bước làm nóng thì dãy còn tất định không — vậy vì sao bài vẫn khuyên làm nóng?",
      vanDe: "b19-xorshift",
      tham: { k: 10 },
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: một dòng "seed k n". seed là số nguyên không dấu 64 bit (có thể > 2^53) — đọc bằng BigInt.
// Đầu ra : k số below(n), mỗi dòng một số; rồi 3 số unit() (>= 12 chữ số thập phân).
const t = readInput().split(/\s+/).filter(Boolean);
const seed = BigInt(t[0]), k = Number(t[1]), n = BigInt(t[2]);

const MASK = (1n << 64n) - 1n;       // giữ mọi kết quả trong 64 bit: x & MASK
let s = 0n;                          // TODO: gán từ seed (nhớ: seed = 0 kẹt vĩnh viễn ở 0)

function next() {
  // TODO: xorshift64* — s ^= s >> 12n; s ^= s << 25n; s ^= s >> 27n; trả về s * 2685821657736338717n (mod 2^64)
  return 0n;
}

// TODO: làm nóng 8 lần

for (let i = 0; i < k; i++) print(String(next() % n));                                   // below(n)
for (let i = 0; i < 3; i++) print((Number(next() >> 11n) / 9007199254740992).toFixed(12)); // unit()
`,
        cpp: String.raw`#include <cstdio>
// Đề thi cấm cả <cstdint>: tự khai kiểu 64/32 bit. Chỉ dùng <cstdio> để đọc/ghi.
typedef unsigned long long u64;
typedef unsigned int u32;

struct Rng {
    u64 s;
    explicit Rng(u64 seed) {
        s = 0;                       // TODO: gán từ seed (nhớ: seed = 0 kẹt vĩnh viễn ở 0), rồi làm nóng 8 lần
    }
    u64 next() {
        // TODO: xorshift64* — s ^= s >> 12; s ^= s << 25; s ^= s >> 27; return s * 2685821657736338717ULL;
        return 0;
    }
    u32 below(u32 n) { return (u32)(next() % n); }
    double unit() { return (double)(next() >> 11) * (1.0 / 9007199254740992.0); }
};

int main() {
    u64 seed; int k; u32 n;
    scanf("%llu %d %u", &seed, &k, &n);
    Rng r(seed);
    for (int i = 0; i < k; ++i) printf("%u\n", r.below(n));
    for (int i = 0; i < 3; ++i) printf("%.12f\n", r.unit());
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean);
const seed = BigInt(t[0]), k = Number(t[1]), n = BigInt(t[2]);

const MASK = (1n << 64n) - 1n;
let s = seed & MASK;
if (s === 0n) s = 88172645463325252n;        // seed 0 sẽ kẹt ở 0 mãi mãi

function next() {
  s ^= s >> 12n;
  s ^= (s << 25n) & MASK;                    // dịch trái làm tràn 64 bit: phải cắt lại
  s ^= s >> 27n;
  return (s * 2685821657736338717n) & MASK;
}
for (let i = 0; i < 8; i++) next();          // làm nóng

for (let i = 0; i < k; i++) print(String(next() % n));
for (let i = 0; i < 3; i++) print((Number(next() >> 11n) / 9007199254740992).toFixed(12));
`,
        cpp: String.raw`#include <cstdio>
// Đề thi cấm cả <cstdint>: tự khai kiểu 64/32 bit. Chỉ dùng <cstdio> để đọc/ghi.
typedef unsigned long long u64;
typedef unsigned int u32;

struct Rng {
    u64 s;
    explicit Rng(u64 seed) {
        s = seed ? seed : 88172645463325252ULL;      // seed 0 sẽ kẹt ở 0 mãi mãi
        for (int i = 0; i < 8; ++i) next();          // làm nóng
    }
    u64 next() {
        s ^= s >> 12;  s ^= s << 25;  s ^= s >> 27;
        return s * 2685821657736338717ULL;
    }
    u32 below(u32 n) { return (u32)(next() % n); }
    double unit() { return (double)(next() >> 11) * (1.0 / 9007199254740992.0); }
};

int main() {
    u64 seed; int k; u32 n;
    scanf("%llu %d %u", &seed, &k, &n);
    Rng r(seed);
    for (int i = 0; i < k; ++i) printf("%u\n", r.below(n));
    for (int i = 0; i < 3; ++i) printf("%.12f\n", r.unit());
    return 0;
}
`
      },
      goiY: [
        "Trong JS, `s << 25n` làm số phình quá 64 bit: nhớ `& MASK` sau phép dịch trái và sau phép nhân (phép dịch phải thì không cần).",
        "Hàm dựng: `s = seed ? seed : 88172645463325252` rồi gọi `next()` tám lần và bỏ kết quả. Với BigInt, cách rõ ràng nhất để bắt seed 0 là `if (s === 0n) s = 88172645463325252n;`.",
        "In `below` trong C++ bằng `%u` vì `n` có thể gần 4×10⁹ (`%d` sẽ ra số âm); `unit()` in bằng `%.12f`."
      ]
    },
    {
      id: "hai-opt-ngan-sach",
      ten: "2-opt dưới ngân sách phép toán (OpBudget)",
      doKho: 3,
      ref: "§5, §3, §6",
      de: "Đề cấm `<chrono>`: thay vì hỏi đồng hồ, ta **đếm phép toán**. Cài 2-opt cho chu trình ngắn nhất với đúng cấu trúc của §5.4:\n\n" +
          "```cpp\nstruct OpBudget {\n    long long left;\n    bool spend(long long cost = 1) { left -= cost; return left > 0; }\n};\n```\n\n" +
          "Chu trình ban đầu là thứ tự nhập `0, 1, …, n−1`; khoảng cách là Manhattan `|Δx| + |Δy|` (số nguyên — không có sai số thực). Làm **đúng từng bước** để kết quả trùng khớp trên mọi máy:\n\n" +
          "1. lặp `while (còn cải thiện)`: duyệt `i = 0 … n−2`, trong đó `j = i+2 … n−1` (bỏ cặp `i = 0, j = n−1`);\n" +
          "2. với mỗi cặp `(i, j)` **gọi `spend(1)` trước**; nếu trả `false` thì dừng **toàn bộ** ngay (chưa đánh giá cặp đó). Ngược lại tính `delta = d(p[i],p[j]) + d(p[i+1],p[j+1]) − d(p[i],p[i+1]) − d(p[j],p[j+1])`, chỉ số `j+1` lấy modulo `n`;\n" +
          "3. nếu `delta < 0` thì đảo đoạn `p[i+1..j]` ngay, rồi cứ quét tiếp với `j+1` (không quay lại), và đánh dấu “có cải thiện”.\n\n" +
          "In **một dòng** `soDelta soLanDoi doDai`: số lần đã đánh giá delta, số lần đảo thành công, độ dài chu trình lúc dừng. Chấm trên 10 bộ dữ liệu (n = 60); chỉ có một mức — kết quả phải **khớp từng số**.\n\n" +
          "Đổi sang các biến thể ngân sách (tab bên dưới): `B` nhỏ cắt giữa chừng thế nào? Với `B` dư, `soDelta` dừng ở đâu?\n\n" +
          "**Suy ngẫm:** (1) Vì sao `B = 500` chỉ cho `soDelta = 499`? (2) Nếu máy chấm chậm gấp 3, kết quả của bạn đổi không? Còn nếu bạn dùng `while (now() < 15)` thì sao? (3) `OpBudget` đảm bảo điều gì và không đảm bảo điều gì? (4) Ở bản C++, vì sao mảng phải là `static`?",
      vanDe: "b19-2opt-ngan-sach",
      tham: { n: 60, B: 7000 },
      bienThe: [
        { ten: "Vừa đủ (B = 7 000): vài test hội tụ trước, vài test bị cắt", tham: { n: 60, B: 7000 } },
        { ten: "Ngân sách nhỏ (B = 500)", tham: { n: 60, B: 500 } },
        { ten: "Ngân sách dư (B = 40 000): mọi test hội tụ", tham: { n: 60, B: 40000 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "n B", rồi n dòng "x y". Chu trình ban đầu là 0,1,...,n-1; khoảng cách Manhattan.
// Đầu ra : một dòng "soDelta soLanDoi doDai".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [], p = [];
for (let i = 0; i < n; i++) { x.push(t[2 + 2 * i]); y.push(t[3 + 2 * i]); p.push(i); }
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

class OpBudget {
  constructor(left) { this.left = left; }
  spend(cost = 1) { this.left -= cost; return this.left > 0; }
}
const nganSach = new OpBudget(t[1]);

let soDelta = 0, soLanDoi = 0;
// TODO: lặp "còn cải thiện": với mỗi cặp (i, j), j từ i+2 (bỏ i = 0, j = n-1):
//         nếu !nganSach.spend() thì dừng TOÀN BỘ; ++soDelta; tính delta;
//         delta < 0 thì đảo p[i+1..j], ++soLanDoi, đánh dấu cải thiện.

let dai = 0;
for (let i = 0; i < n; i++) dai += d(p[i], p[(i + 1) % n]);
print(soDelta + " " + soLanDoi + " " + dai);
`,
        cpp: String.raw`#include <cstdio>
// Đề thi cấm header: chỉ dùng <cstdio> để đọc/ghi; mọi mảng đều static (stack chỉ 1 MB).
#define MAXN 128

struct OpBudget {
    long long left;
    bool spend(long long cost = 1) { left -= cost; return left > 0; }
};

static int px[MAXN], py[MAXN], p[MAXN];

static inline int iabs(int v) { return v < 0 ? -v : v; }
static inline int d(int a, int b) { return iabs(px[a] - px[b]) + iabs(py[a] - py[b]); }

int main() {
    int n; long long B;
    scanf("%d %lld", &n, &B);
    for (int i = 0; i < n; ++i) { scanf("%d %d", &px[i], &py[i]); p[i] = i; }

    OpBudget nganSach{B};
    long long soDelta = 0, soLanDoi = 0;
    // TODO: lặp "còn cải thiện": với mỗi cặp (i, j), j từ i+2 (bỏ i = 0, j = n-1):
    //         nếu !nganSach.spend() thì dừng TOÀN BỘ; ++soDelta; tính delta;
    //         delta < 0 thì đảo p[i+1..j], ++soLanDoi, đánh dấu cải thiện.

    int dai = 0;
    for (int i = 0; i < n; ++i) dai += d(p[i], p[i + 1 == n ? 0 : i + 1]);
    printf("%lld %lld %d\n", soDelta, soLanDoi, dai);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [], p = [];
for (let i = 0; i < n; i++) { x.push(t[2 + 2 * i]); y.push(t[3 + 2 * i]); p.push(i); }
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

class OpBudget {
  constructor(left) { this.left = left; }
  spend(cost = 1) { this.left -= cost; return this.left > 0; }
}
const nganSach = new OpBudget(t[1]);

let soDelta = 0, soLanDoi = 0, cai = true;
xong: while (cai) {
  cai = false;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (!nganSach.spend()) break xong;            // hết ngân sách: dừng TOÀN BỘ, chưa đánh giá cặp này
      soDelta++;
      const a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
      if (d(a, c) + d(b, e) - d(a, b) - d(c, e) < 0) {
        for (let l = i + 1, h = j; l < h; l++, h--) { const tmp = p[l]; p[l] = p[h]; p[h] = tmp; }
        soLanDoi++; cai = true;
      }
    }
  }
}

let dai = 0;
for (let i = 0; i < n; i++) dai += d(p[i], p[(i + 1) % n]);
print(soDelta + " " + soLanDoi + " " + dai);
`,
        cpp: String.raw`#include <cstdio>
// Đề thi cấm header: chỉ dùng <cstdio> để đọc/ghi; mọi mảng đều static (stack chỉ 1 MB).
#define MAXN 128

struct OpBudget {
    long long left;
    bool spend(long long cost = 1) { left -= cost; return left > 0; }
};

static int px[MAXN], py[MAXN], p[MAXN];

static inline int iabs(int v) { return v < 0 ? -v : v; }
static inline int d(int a, int b) { return iabs(px[a] - px[b]) + iabs(py[a] - py[b]); }

int main() {
    int n; long long B;
    scanf("%d %lld", &n, &B);
    for (int i = 0; i < n; ++i) { scanf("%d %d", &px[i], &py[i]); p[i] = i; }

    OpBudget nganSach{B};
    long long soDelta = 0, soLanDoi = 0;
    bool cai = true;
    while (cai) {
        cai = false;
        for (int i = 0; i + 1 < n; ++i) {
            for (int j = i + 2; j < n; ++j) {
                if (i == 0 && j == n - 1) continue;
                if (!nganSach.spend()) goto xong;           // hết ngân sách: dừng TOÀN BỘ
                ++soDelta;
                int a = p[i], b = p[i + 1], c = p[j], e = p[j + 1 == n ? 0 : j + 1];
                if (d(a, c) + d(b, e) - d(a, b) - d(c, e) < 0) {
                    for (int l = i + 1, h = j; l < h; ++l, --h) { int tmp = p[l]; p[l] = p[h]; p[h] = tmp; }
                    ++soLanDoi; cai = true;
                }
            }
        }
    }
xong:
    int dai = 0;
    for (int i = 0; i < n; ++i) dai += d(p[i], p[i + 1 == n ? 0 : i + 1]);
    printf("%lld %lld %d\n", soDelta, soLanDoi, dai);
    return 0;
}
`
      },
      goiY: [
        "Hai vòng lặp lồng nhau + một cờ “còn cải thiện”. Để thoát cả hai vòng cùng lúc: JS dùng nhãn `xong: while (...)` và `break xong`; C++ dùng `goto xong` hoặc một hàm trả về sớm.",
        "`spend` trừ **trước** rồi mới kiểm tra `left > 0` — nên với `B` thì nó cho phép tối đa `B − 1` lần đánh giá. Gọi `spend()` ngay trước khi tính delta, và chỉ tăng `soDelta` khi `spend` trả `true`.",
        "Phần đảo đoạn: `for (l = i+1, h = j; l < h; l++, h--) swap(p[l], p[h])`. Chỉ số `j+1` của cặp cuối phải lấy modulo `n` (`j + 1 == n ? 0 : j + 1`)."
      ]
    }
  ]
});
