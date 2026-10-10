/* Thực hành — Bài 4: Đo lường — dựng bộ chấm và làm thực nghiệm tử tế. */

/* ---------------------------------------------------------------------------------------------
   Bài toán tự dựng 1 — so sánh hai thuật toán trên CÙNG N test: độc lập (compareLine) và theo cặp (§3.4).
   Dữ liệu: điểm của A và B trên từng test; mỗi test có "độ khó" chung (nhiễu chung) + nhiễu riêng của từng thuật toán.
   Tham `mong` = [vIndep, vPair] ép kết luận mong muốn (và tránh sát ngưỡng) để bài học luôn rõ ràng.
   --------------------------------------------------------------------------------------------- */
(function () {
  var TI = TH.tienIch;
  function tb(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s / v.length; }
  function se(v) {
    var m = tb(v), s = 0;
    for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
    return Math.sqrt(s / (v.length - 1)) / Math.sqrt(v.length);
  }
  /* 12 số: x̄A x̄B SE_A SE_B Δ ngưỡng vIndep SE_d ngưỡng_d vPair nIndep nPair */
  function ketQua(inst) {
    var N = inst.a.length, d = inst.b.map(function (v, i) { return v - inst.a[i]; });
    var mA = tb(inst.a), mB = tb(inst.b), seA = se(inst.a), seB = se(inst.b);
    var delta = mB - mA, nguong = 2 * Math.sqrt(seA * seA + seB * seB), seD = se(d), nguongD = 2 * seD;
    var ad = Math.abs(delta);
    return [mA, mB, seA, seB, delta, nguong, ad > nguong ? 1 : 0, seD, nguongD, ad > nguongD ? 1 : 0,
      N * Math.pow(nguong / ad, 2), N * Math.pow(nguongD / ad, 2)];
  }
  TH.vande.dangKy("b04-so-sanh-ghep-cap", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var N = tham.N || 30, gain = tham.gain == null ? 1100 : tham.gain, sdTest = tham.sdTest || 3400, sdNhieu = tham.sdNhieu || 700;
      var inst = null;
      for (var lan = 0; lan < 80; lan++) {
        var r = TI.rng(seed * 131 + lan * 7919 + 1);
        var z = function () { var t = 0; for (var k = 0; k < 12; k++) t += r(); return t - 6; };   /* xấp xỉ chuẩn */
        var a = [], b = [];
        for (var i = 0; i < N; i++) {
          var kho = 60000 + sdTest * z();                      /* độ khó của test: chung cho cả hai thuật toán */
          a.push(Math.round(kho + sdNhieu * z()));
          b.push(Math.round(kho + gain + sdNhieu * z()));
        }
        inst = { a: a, b: b };
        if (!tham.mong) break;
        var k2 = ketQua(inst), ad = Math.abs(k2[4]);
        var xaNguong = ad > 20 && Math.abs(ad / k2[5] - 1) > 0.1 && Math.abs(ad / k2[8] - 1) > 0.1;
        if (xaNguong && k2[6] === tham.mong[0] && k2[9] === tham.mong[1]) break;
      }
      return inst;
    },
    viet: function (inst) {
      var o = inst.a.length + "\n";
      for (var i = 0; i < inst.a.length; i++) o += inst.a[i] + " " + inst.b[i] + "\n";
      return o;
    },
    giai: ketQua,
    saiSo: 0.01,
    dinhDang: {
      vao: "Dòng 1: `N` — số test. Tiếp theo `N` dòng `a b` — điểm của thuật toán A và B trên cùng một test.",
      ra: "Một dòng 12 số, theo thứ tự: `x̄A x̄B SE_A SE_B Δ ngưỡng vIndep SE_d ngưỡng_d vPair nIndep nPair` (xem đề)."
    }
  }));
})();

/* ---------------------------------------------------------------------------------------------
   Bài toán tự dựng 2 — bộ sinh tất định xorshift32 + hai greedy cái túi + so sánh trên N test.
   --------------------------------------------------------------------------------------------- */
(function () {
  function bo(seed) {
    var s = seed >>> 0;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  }
  function tb(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s / v.length; }
  function se(v) {
    var m = tb(v), s = 0;
    for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
    return Math.sqrt(s / (v.length - 1)) / Math.sqrt(v.length);
  }
  function giai(inst) {
    var dau = bo(inst.seed), raw = [];
    for (var i = 0; i < 5; i++) raw.push(dau());
    var next = bo(inst.seed), A = [], B = [];
    for (var t = 0; t < inst.N; t++) {
      var w = [], p = [], sw = 0, mw = 0;
      for (var j = 0; j < inst.n; j++) {
        w.push(5 + next() % 56); p.push(5 + next() % 96); sw += w[j]; mw = Math.max(mw, w[j]);
      }
      var cap = Math.max(mw, Math.floor(2 * sw / 5));
      var dem = function (cc) {
        var o = w.map(function (_, k) { return k; }).sort(function (a, b) { return (p[b] * (w[a] + cc) - p[a] * (w[b] + cc)) || (a - b); });
        var con = cap, tot = 0;
        o.forEach(function (k) { if (w[k] <= con) { con -= w[k]; tot += p[k]; } });
        return tot;
      };
      A.push(dem(0)); B.push(dem(inst.c));
    }
    var d = B.map(function (v, k) { return v - A[k]; });
    var delta = tb(B) - tb(A), seA = se(A), seB = se(B);
    return raw.concat([tb(A), tb(B), seA, seB,
      Math.abs(delta) > 2 * Math.sqrt(seA * seA + seB * seB) ? 1 : 0, Math.abs(delta) > 2 * se(d) ? 1 : 0]);
  }
  TH.vande.dangKy("b04-bo-sinh-tat-dinh", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      return { seed: (seed * 7919 + 12345) % 1000003 + 1, N: tham.N || 30, n: tham.n || 60, c: tham.c == null ? 20 : tham.c };
    },
    viet: function (inst) { return inst.seed + " " + inst.N + " " + inst.n + " " + inst.c + "\n"; },
    giai: giai,
    saiSo: 0.01,
    dinhDang: {
      vao: "Một dòng `seed N n c` — hạt giống (khác 0), số test, số món mỗi test, hằng số `c` của thuật toán B.",
      ra: "Một dòng 11 số: 5 giá trị đầu của bộ sinh, rồi `x̄A x̄B SE_A SE_B vIndep vPair` (xem đề)."
    }
  }));
})();

TH.dangKy({
  id: "bai-04-do-luong",

  tomTat: [
    "Trong heuristic **không có `expected`**: một test case là vô nghĩa vì tín hiệu (61 420 so với 65 425, chênh 4 005) chỉ cỡ nhiễu giữa các test (σ ≈ 3 400). Nhiễu đến từ chính dữ liệu — mỗi test là một bài toán khác — chứ không từ thuật toán.",
    "Đừng lẫn hai đại lượng: **σ** đo các test case phân tán thế nào (không đổi khi N tăng); **SEM = σ/√N** đo trung bình của bạn đáng tin tới đâu. Muốn SEM giảm một nửa phải chạy **gấp bốn** số test.",
    "Chênh lệch **có ý nghĩa** khi |Δ| > 2·√(SEM_A² + SEM_B²). Không thoả ≠ “hai cái như nhau”: nó chỉ nói “với dữ liệu này tôi chưa phân biệt được” — và còn cho phép chạy thêm test.",
    "Số test cần: **N ≳ 8·(σ/Δ)²** — bình phương: Δ nhỏ đi một nửa thì N gấp bốn. Phát hiện chênh 1 % khi σ/x̄ = 10 % cần 800 test, nên bộ chấm phải chạy nhanh.",
    "Mẹo rẻ nhất: **so theo cặp** — ghi hiệu B − A trên từng test thay vì hai trung bình. Var(B − A) = Var(A) + Var(B) − 2·Cov(A, B) nên nhiễu chung triệt tiêu; thường giảm σ hiệu dụng một nửa ⇒ giảm số test bốn lần, hoàn toàn miễn phí (chỉ cần cùng seed).",
    "Bốn thành phần của hạ tầng đo: **bộ sinh tất định** (tự viết RNG — `std::uniform_int_distribution` cho kết quả khác nhau giữa các thư viện chuẩn), **bộ chấm trung thực** (sao chép nguyên văn luật chấm, có cờ vi phạm và phân rã tài nguyên), **bộ thống kê** (avg, min, sd, sem, time, viol), **nhật ký thực nghiệm** (ghi cả thất bại).",
    "**Ablation:** tắt từng thành phần (không phải bật từng cái), đo lại, và chạy trên phiên bản cuối — một bảng ablation cũ là bảng sai (tailFill từng che giấu tác dụng của phạt thời gian chết: −1,33 % hoá −2,43 %). Thành phần đóng góp 0 % thì xoá đi, vì nó còn ăn thời gian chạy.",
    "Thời gian: lấy **MIN** của ≥ 6 lần chạy (nhiễu thời gian một chiều, chỉ làm chậm) và để mắt tới **worst** (giới hạn áp lên từng test); điểm số thì lấy trung bình. Cột `viol` phải luôn bằng 0. Năm điều cấm: viết lại bộ chấm cho gọn, so trên seed khác nhau, đổi nhiều thứ cùng lúc, tinh chỉnh và báo cáo trên cùng bộ test, bỏ qua số vi phạm."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§2",
      hoi: "Greedy tỉ số có điểm trung bình 61 420 (σ ≈ 3 449) và “chèn rẻ nhất” có 65 425 (σ ≈ 2 816) trên cùng họ test. Nếu chỉ chạy MỘT test case để so hai thuật toán thì điều gì có thể xảy ra?",
      chon: [
        "Luôn đúng, vì cả hai thuật toán đều tất định",
        "Có thể ra kết luận ngược hẳn, vì chênh lệch 4 005 chỉ cỡ độ dao động giữa các test case",
        "Luôn đúng nếu test được chọn là test khó, vì test khó ít nhiễu hơn",
        "Chỉ sai khi thuật toán có dùng số ngẫu nhiên"
      ],
      dung: 1,
      giaiThich: "Mỗi thuật toán tất định, nhưng mỗi test case là một bài toán khác nhau (có test may, test xui). Tín hiệu (4 005) và nhiễu (~3 400) gần bằng nhau nên một test hoàn toàn có thể cho greedy tỉ số 66 000 còn chèn rẻ nhất 60 000 — kết luận ngược. Tính tất định của thuật toán không loại được nhiễu đến từ dữ liệu, và test khó không có nhiễu nhỏ hơn."
    },
    {
      id: "q2", loai: "nhieu", doKho: 2, ref: "§3.1",
      hoi: "Chọn mọi phát biểu ĐÚNG về độ lệch chuẩn σ và sai số chuẩn SEM = σ/√N.",
      chon: [
        "σ đo các test case phân tán thế nào quanh trung bình; đó là tính chất của dữ liệu nên không đổi khi N tăng",
        "SEM đo trung bình của bạn còn xê dịch bao nhiêu nếu chạy lại với bộ dữ liệu khác; nó giảm khi N tăng",
        "Muốn giảm SEM đi một nửa phải chạy gấp bốn lần số test",
        "Khi N tăng thì σ cũng giảm theo 1/√N",
        "SEM và σ là hai tên gọi của cùng một đại lượng"
      ],
      dung: [0, 1, 2],
      giaiThich: "§3.1: σ là tính chất của dữ liệu (không đổi khi N tăng); SEM = σ/√N mới giảm theo 1/√N, nên giảm một nửa cần gấp bốn số test. Hai ý còn lại là nhầm lẫn phổ biến nhất của cả bài: σ không giảm khi chạy thêm test (chỉ ước lượng của nó chính xác hơn), và σ với SEM là hai đại lượng khác nhau."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§5.2", donVi: "(%)",
      hoi: "Ablation đề 2607 trên 300 test: bản đầy đủ đạt 32 915 840 điểm; bỏ “khung ngày thứ 31” còn 31 900 896. Thành phần đó đóng góp bao nhiêu phần trăm điểm của bản đầy đủ? (làm tròn 2 chữ số thập phân)",
      dapAn: 3.08, saiSo: 0.01,
      giaiThich: "(32 915 840 − 31 900 896) / 32 915 840 = 1 014 944 / 32 915 840 ≈ 0,0308 = 3,08 %. Phần trăm tính trên bản đầy đủ (điểm đang có); nếu chia cho bản đã tắt sẽ ra 3,18 %, lệch khỏi bảng của bài."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§3.2–3.3, Bài tập 4.1", donVi: "(test mỗi bên)",
      hoi: "Thuật toán A có x̄ = 100, σ = 12; B có x̄ = 104, σ = 15; so độc lập. Tối thiểu bao nhiêu test case mỗi bên để chênh lệch 4 có ý nghĩa theo quy tắc |Δ| > 2·√(SEM_A² + SEM_B²)? (giữ nguyên σ và Δ)",
      dapAn: 93, saiSo: 0,
      giaiThich: "Với N test mỗi bên, ngưỡng = 2·√((12² + 15²)/N) = 2·√(369/N). Cần 4 > 2·√(369/N) ⇒ N > 4·369/16 = 92,25 ⇒ N = 93. (Ở N = 25 ngưỡng là 7,68 > 4 nên hiện chưa có ý nghĩa.)"
    },
    {
      id: "q5", loai: "so", doKho: 3, ref: "§3.4", donVi: "(test)",
      hoi: "Cùng dữ liệu ở câu trước, nhưng so **theo cặp** và độ lệch chuẩn của dãy hiệu (B − A) chỉ bằng một nửa √(σ_A² + σ_B²) ≈ 19,2, tức khoảng 9,6. Tối thiểu bao nhiêu test để chênh lệch 4 có ý nghĩa?",
      dapAn: 24, saiSo: 0,
      giaiThich: "Ngưỡng theo cặp là 2·σ_d/√N với σ_d ≈ 9,6: cần 4 > 19,2/√N ⇒ N > 23,06 ⇒ N = 24 — đúng một phần tư của 93, khớp ý “giảm σ một nửa ⇒ giảm số test bốn lần” của §3.4. Với 25 test đã chạy, ngưỡng theo cặp chỉ còn 3,84 < 4, tức đã có ý nghĩa."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§3.2",
      hoi: "Bất đẳng thức |Δ| > 2·√(SEM_A² + SEM_B²) KHÔNG thoả. Kết luận đúng là gì?",
      chon: [
        "Hai thuật toán như nhau",
        "Thuật toán có điểm trung bình thấp hơn chắc chắn tệ hơn",
        "Với dữ liệu hiện có chưa phân biệt được hai thuật toán; có thể chạy thêm test để phân biệt",
        "Phải đổi seed và chạy lại cho tới khi bất đẳng thức thoả"
      ],
      dung: 2,
      giaiThich: "§3.2: bất đẳng thức không thoả không có nghĩa là “như nhau” mà là “với dữ liệu tôi có, tôi không phân biệt được” — câu sau còn cho phép chạy thêm test. Chọn seed cho tới khi bất đẳng thức thoả là chọn dữ liệu theo kết quả, tức tự lừa mình."
    },
    {
      id: "q7", loai: "nhieu", doKho: 2, ref: "§9",
      hoi: "Hành động nào sau đây làm kết luận so sánh hai phiên bản KHÔNG đáng tin?",
      chon: [
        "Chạy phiên bản cũ với seed 111 và phiên bản mới với seed 222",
        "Trong một lần sửa, vừa đổi λ, vừa đổi bề rộng beam, vừa thêm toán tử mới, rồi chỉ đo điểm tổng",
        "Quét 50 giá trị tham số trên 30 test và báo cáo điểm tốt nhất đo được trên chính 30 test đó",
        "Chạy hai phiên bản trên cùng seed, cùng số test, rồi so theo cặp",
        "Tinh chỉnh tham số trên một bộ test, rồi báo cáo bằng một bộ test khác chạy đúng một lần"
      ],
      dung: [0, 1, 2],
      giaiThich: "Ba ý đầu là ba cạm bẫy của §9: so trên seed khác nhau (cạm bẫy 2), đổi nhiều thứ cùng lúc nên không biết cái nào có công (cạm bẫy 3), và tinh chỉnh với báo cáo trên cùng bộ test — lấy cực đại của 50 mẫu nhiễu thì thiên lệch lên (cạm bẫy 4). Hai ý cuối chính là cách làm đúng: cùng seed để tận dụng so theo cặp; bộ tinh chỉnh tách khỏi bộ báo cáo."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§6.2",
      hoi: "Chạy cùng một chương trình 6 lần cho thời gian 24,5 · 31,8 · 27,4 · 80,9 · 26,1 · 28,7 ms. Vì sao nên báo cáo MIN thay vì trung bình?",
      chon: [
        "Tải nền, page fault, chuyển ngữ cảnh chỉ có thể làm chương trình chậm hơn, không bao giờ nhanh hơn — nên min là ước lượng gần nhất của thời gian “sạch”",
        "Nhiễu thời gian và nhiễu điểm số đều đối xứng nên min và trung bình như nhau",
        "Min luôn bằng thời gian của trường hợp xấu nhất nên an toàn hơn",
        "Trung bình không tính được khi có một giá trị ngoại lai"
      ],
      dung: 0,
      giaiThich: "§6.2 quy tắc 1: nhiễu thời gian là một chiều nên làm trung bình lệch lên — ở đây trung bình ≈ 36,6 ms chỉ vì một lần 80,9 ms, còn min 24,5 ms mới gần thời gian sạch. Điểm số mới có nhiễu đối xứng (test may bù test xui). Min không phải worst: quy tắc 3 nói giới hạn thời gian áp lên từng test nên còn phải theo dõi worst."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§5.2",
      hoi: "Ở đề 2607, thành phần “phạt thời gian chết” ban đầu đo được −1,33 % khi tắt, nhưng sau khi xoá thành phần tailFill thì đo lại được −2,43 %. Kết luận phương pháp luận đúng là gì?",
      chon: [
        "Phép đo đầu chỉ là nhiễu ngẫu nhiên, lấy trung bình hai lần đo là đủ",
        "Nên bật từng thành phần thay vì tắt từng thành phần để tránh hiệu ứng này",
        "Thành phần phạt thời gian chết tự mạnh lên mỗi khi mã nguồn ngắn đi",
        "tailFill đã che giấu tác dụng của nó (hai thành phần làm cùng một việc); ablation phải chạy lại trên phiên bản cuối cùng, một bảng ablation cũ là một bảng sai"
      ],
      dung: 3,
      giaiThich: "§5.2: hai thành phần làm cùng một việc nên tắt một cái thì cái kia gánh — tailFill che giấu tác dụng của phạt thời gian chết; xoá tailFill rồi đo lại mới thấy −2,43 %. Bài học: chạy lại ablation trên phiên bản cuối. “Bật từng cái” không chữa được vì hiệu ứng phụ thuộc ngữ cảnh: ablation đo đóng góp của thành phần trong hệ thống hiện tại (§5.1)."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§4.3, §9 (cạm bẫy 5)",
      hoi: "Thuật toán X có điểm trung bình cao hơn Y 1 % nhưng thỉnh thoảng một test vi phạm ràng buộc (cột viol > 0). Đề thi tích luỹ điểm xuyên test và một vi phạm đưa toàn bộ về 0. Bạn chọn gì?",
      chon: [
        "X, vì kỳ vọng điểm cao hơn",
        "X, nhưng trừ thêm một khoản phạt nhỏ vào điểm mỗi khi vi phạm",
        "Y, vì đây là trò chơi có rủi ro phá sản: phải sống sót (viol = 0) trước, kỳ vọng không phải đại lượng đúng để tối ưu",
        "Chọn ngẫu nhiên vì chênh 1 % nằm trong nhiễu"
      ],
      dung: 2,
      giaiThich: "§4.3 và §9: cột viol phải luôn bằng 0 — hai vi phạm trên 300 test nghĩa là 0 điểm toàn bộ. Khi một lần hỏng xoá sạch mọi thứ, tối ưu kỳ vọng là sai mục tiêu: bạn phải sống sót trước. Phạt nhỏ không phản ánh luật chấm thật (vi phạm = 0 cả bài), và chênh 1 % có ý nghĩa hay không cũng không cứu được rủi ro vi phạm."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 4.1",
      hoi: "Thuật toán A có x̄ = 100, σ = 12; thuật toán B có x̄ = 104, σ = 15. Mỗi bên chạy 25 test case. Chênh lệch có ý nghĩa không? Cần bao nhiêu test để có ý nghĩa? Nếu so theo cặp và σ hiệu dụng giảm còn một nửa thì cần bao nhiêu — và với 25 test đã có, kết luận có đổi không?",
      goiY: ["Tính SEM của từng bên, rồi ngưỡng 2·√(SEM_A² + SEM_B²).", "Giải bất đẳng thức |Δ| > 2·√((σ_A² + σ_B²)/N) theo N."],
      mau: "SEM_A = 12/√25 = 2,4; SEM_B = 15/√25 = 3,0. Ngưỡng = 2·√(2,4² + 3²) = 2·3,84 ≈ 7,68. Δ = 4 < 7,68 nên **chưa có ý nghĩa**.\n\nSố test: 4 > 2·√((12² + 15²)/N) ⇒ N > 4·369/16 = 92,25 ⇒ **cần ≈ 93 test**.\n\nSo theo cặp: σ hiệu dụng giảm một nửa ⇒ ngưỡng giảm một nửa ⇒ N giảm bốn lần: 92,25/4 ≈ 23,1 ⇒ **≈ 24 test**. Với 25 test đã có, ngưỡng theo cặp chỉ còn 7,68/2 = 3,84 < 4, nên kết luận **đổi thành có ý nghĩa** (đáp án bài tập không nêu phần này).\n\nNhắc lại: “chưa có ý nghĩa” không có nghĩa A và B như nhau, chỉ là chưa phân biệt được.",
      tieuChi: ["Tính đúng SEM_A = 2,4, SEM_B = 3,0 và ngưỡng ≈ 7,68 > Δ = 4, kết luận chưa có ý nghĩa", "Tính được N ≈ 93 từ N > 4·(12² + 15²)/4²", "Nêu so theo cặp giảm N khoảng bốn lần (≈ 24) và nhận ra 25 test hiện có đã đủ khi so theo cặp", "Không kết luận “A và B như nhau” khi chưa có ý nghĩa"]
    },
    {
      id: "l2", doKho: 2, ref: "§7.3(a)",
      hoi: "Trong bảng `p1_compare` 60 test, simulated anneal có avg 65 929, sem 337,4 và ALNS có avg 65 892, sem 352,9 (chênh 37 điểm). Chênh lệch này có ý nghĩa không? Cần cỡ bao nhiêu test để kết luận được? Nếu bắt buộc chọn một trong hai để dùng, bạn chọn theo tiêu chí nào?",
      goiY: ["Ngưỡng 2·√(sem_A² + sem_B²) bằng bao nhiêu so với 37?", "SEM co theo 1/√N: cần N lớn gấp bao nhiêu lần 60 để ngưỡng bằng 37?"],
      mau: "Ngưỡng = 2·√(337,4² + 352,9²) = 2·488 ≈ 976 ≫ 37 ⇒ **không có ý nghĩa**: với 60 test không thể kết luận SA tốt hơn ALNS.\n\nSEM co theo 1/√N nên cần N ≈ 60·(976/37)² — cỡ bốn chục nghìn test (bài ghi ≈ 41 000; con số chính xác phụ thuộc làm tròn 37) — mới đủ để ngưỡng bằng chênh lệch. Chênh ~0,06 % vì thế **về mặt thực tiễn là không đo được**, và cũng không nên cố.\n\nKhi hai phương án chênh dưới ngưỡng đo được, hãy chọn theo tiêu chí khác: đơn giản hơn, nhanh hơn, dễ gỡ lỗi hơn. Ở đây ALNS nhanh hơn SA (14,9 ms so với 21,0 ms), đó mới là lý do chọn dùng.",
      tieuChi: ["Tính ngưỡng ≈ 976 và kết luận không có ý nghĩa", "Nêu N ≈ 60·(976/37)², cỡ bốn chục nghìn test, vì SEM co theo 1/√N", "Chọn theo tiêu chí khác (nhanh hơn, đơn giản hơn, dễ gỡ lỗi) và chỉ ra ALNS nhanh hơn (14,9 so với 21,0 ms)"]
    },
    {
      id: "l3", doKho: 2, ref: "Bài tập 4.4, §5.3, §8.2",
      hoi: "Thiết kế một ablation cho `chen re nhat` (chèn rẻ nhất): thành phần nào tắt được và bạn đo thế nào? Hãy viết kết quả theo mẫu nhật ký 5 dòng của §8.2, dùng số: bản đầy đủ 65 425, bản đã tắt khoảng 59 800 (theo đáp án bài tập).",
      goiY: ["Gợi ý của bài tập: tắt việc xét mọi vị trí chèn, chỉ nối vào cuối.", "Nhật ký gồm: giả thuyết, lệnh, kết quả, kết luận (và đừng quên ngày + bài toán ở tiêu đề)."],
      mau: "Thành phần tắt: **xét mọi vị trí chèn** — chỉ cho nối vào cuối tuyến, khi đó thuật toán thoái thành greedy theo chỉ số giá mờ (≈ bản “greedy GIA MO” 59 775 ở §7.2). Chạy trên cùng seed và cùng số test, đổi đúng MỘT thứ, và tạo bản tắt bằng thay chuỗi từ file gốc để ablation luôn khớp phiên bản hiện tại.\n\n```\n### <ngày> · P1 · ablation: tắt chèn-vào-giữa của chen re nhat\n- Giả thuyết: chèn vào mọi vị trí là đòn bẩy lớn nhất; tắt nó điểm tụt hơn 5 %.\n- Lệnh: ./bin/p1_compare 60 777 120 0 (bản tắt sinh từ file gốc)\n- Kết quả: 65 425 → ~59 800 (−8,6 % so với bản đầy đủ; +9,4 % nếu tính trên bản đã tắt)\n- Kết luận: ĐÚNG, đóng góp lớn. Giữ lại.\n```\n\nChênh ~5 600 điểm lớn hơn xa ngưỡng 2·SE của các dòng trong bảng §7.2 (chỉ khoảng 1 000–2 000 điểm) nên có ý nghĩa. Nhớ ghi rõ phần trăm tính trên cơ sở nào: đáp án bài tập nói +9,4 % (chia cho bản đã tắt) còn bảng ablation ở §5.2 tính trên bản đầy đủ (−8,6 %).",
      tieuChi: ["Chỉ ra thành phần tắt được (xét mọi vị trí chèn) và nó thoái hoá thành greedy", "Giữ nguyên seed và số test, chỉ đổi đúng một thứ", "Viết đủ nhật ký: giả thuyết, lệnh, kết quả có số, kết luận", "Ghi rõ phần trăm tính trên cơ sở nào và so chênh lệch với ngưỡng 2·SE"]
    },
    {
      id: "l4", doKho: 2, ref: "§9 (cạm bẫy 4)",
      hoi: "Bạn quét 50 giá trị của một tham số trên 30 test case rồi báo cáo giá trị tốt nhất cùng điểm của nó. Vì sao con số đó gần như chắc chắn cao hơn thực lực? Quy trình đúng là gì?",
      goiY: ["Điểm tốt nhất trong 50 điểm có nhiễu là một cực đại — cực đại có thiên lệch không?", "Cần hai bộ test với hai vai trò khác nhau."],
      mau: "Quét 50 giá trị rồi lấy cái tốt nhất nghĩa là lấy **cực đại của 50 mẫu nhiễu**, mà cực đại thì **thiên lệch lên theo thiết kế**: bạn đã “học thuộc nhiễu” (overfitting) của đúng 30 test đó. Con số báo cáo cao hơn thực lực, và bạn chỉ biết điều này khi nộp bài.\n\nQuy trình đúng: dùng **bộ test tinh chỉnh** (ví dụ seed 111, 200 test) để chọn tham số, và một **bộ test báo cáo** khác hẳn (ví dụ seed 999, 300 test) chỉ chạy **một lần cuối**. Thêm nữa: hai giá trị tham số chênh nhau dưới ngưỡng 2·SE là chưa phân biệt được, nên đừng đọc ý nghĩa vào chuyện cái nào nhỉnh hơn trên bộ tinh chỉnh.",
      tieuChi: ["Nêu được vì sao: cực đại của nhiều mẫu nhiễu thì thiên lệch lên (overfitting vào 30 test)", "Nêu quy trình hai bộ test: tinh chỉnh và báo cáo, bộ báo cáo chạy đúng một lần cuối", "Nêu hệ quả: con số báo cáo cao hơn thực lực và chỉ lộ ra khi nộp"]
    }
  ],

  lab: [
    {
      id: "so-sanh-ghep-cap",
      ten: "So sánh hai thuật toán: độc lập và theo cặp",
      doKho: 2,
      ref: "§3.2, §3.4, §7.3(a)",
      de: "Hai thuật toán A và B đã chạy trên **cùng** `N` test (cùng seed). Mỗi dòng đầu vào là điểm của A và B trên một test. Hãy làm đúng việc của `compareLine()` rồi làm lại **theo cặp**:\n\n" +
          "1. **So độc lập:** `x̄A`, `x̄B`, `SE_A`, `SE_B` (SE = sd/√N, sd mẫu chia `N − 1`); `Δ = x̄B − x̄A`; ngưỡng `2·√(SE_A² + SE_B²)`; `vIndep = 1` nếu `|Δ| >` ngưỡng, ngược lại `0`.\n" +
          "2. **So theo cặp:** lập dãy hiệu `d_i = B_i − A_i`, `SE_d = sd(d)/√N`, ngưỡng `2·SE_d`, `vPair = 1` nếu `|Δ| >` ngưỡng này.\n" +
          "3. **Số test cần:** `N·(ngưỡng/|Δ|)²` cho từng cách — số test (số thực, không làm tròn) để ngưỡng co lại bằng đúng `|Δ|` nếu σ và Δ giữ nguyên (cách làm ở §7.3a).\n\n" +
          "In **một dòng 12 số** theo thứ tự `x̄A x̄B SE_A SE_B Δ ngưỡng vIndep SE_d ngưỡng_d vPair nIndep nPair`, số thực với ít nhất 3 chữ số thập phân. Chấm trên 10 bộ dữ liệu, sai số cho phép 0,01.\n\n" +
          "**Suy ngẫm:** ở tab *Test chung nhiễu lớn*, `vIndep` và `vPair` cho hai kết luận khác nhau trên cùng một dữ liệu. Vì sao `SE_d` nhỏ hơn rất nhiều so với `√(SE_A² + SE_B²)`? Hãy dùng công thức Var(B − A) = Var(A) + Var(B) − 2·Cov(A, B) và so `nIndep` với `nPair`.",
      vanDe: "b04-so-sanh-ghep-cap",
      bienThe: [
        { ten: "Test chung nhiễu lớn (ghép cặp cứu được)", tham: { N: 30, gain: 1100, mong: [0, 1] } },
        { ten: "Chênh rõ ràng", tham: { N: 30, gain: 6000, mong: [1, 1] } },
        { ten: "Chênh nằm trong nhiễu", tham: { N: 30, gain: 150, mong: [0, 0] } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là N; rồi N dòng "a b" — điểm của A và B trên cùng một test.
// Đầu ra : MỘT dòng 12 số: xA xB seA seB delta nguong vIndep seD nguongD vPair nIndep nPair
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const N = t[0];
const a = [], b = [];
for (let i = 0; i < N; i++) { a.push(t[1 + 2 * i]); b.push(t[2 + 2 * i]); }

// TODO 1: hàm trungBinh(v) và saiSoChuan(v) = sd / sqrt(N), với sd là độ lệch chuẩn MẪU (chia N - 1).
// TODO 2: so độc lập — delta = xB - xA, nguong = 2 * sqrt(seA^2 + seB^2), vIndep (1 nếu |delta| > nguong).
// TODO 3: so theo cặp — dãy d[i] = b[i] - a[i], seD, nguongD = 2 * seD, vPair.
// TODO 4: nIndep = N * (nguong / |delta|)^2 và nPair = N * (nguongD / |delta|)^2.
const kq = [];
print(kq.map((x) => x.toFixed(3)).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int N;
    scanf("%d", &N);
    vector<double> a(N), b(N);
    for (int i = 0; i < N; i++) scanf("%lf %lf", &a[i], &b[i]);

    // TODO 1: hàm trung bình và sai số chuẩn SE = sd / sqrt(N), với sd là độ lệch chuẩn MẪU (chia N - 1).
    // TODO 2: so độc lập — delta = xB - xA, nguong = 2 * sqrt(seA^2 + seB^2), vIndep (1 nếu |delta| > nguong).
    // TODO 3: so theo cặp — dãy d[i] = b[i] - a[i], seD, nguongD = 2 * seD, vPair.
    // TODO 4: nIndep = N * (nguong / |delta|)^2 và nPair = N * (nguongD / |delta|)^2.
    vector<double> kq;   // 12 số theo đúng thứ tự trong đề
    for (size_t i = 0; i < kq.size(); i++) printf("%.3f%c", kq[i], i + 1 < kq.size() ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const N = t[0];
const a = [], b = [];
for (let i = 0; i < N; i++) { a.push(t[1 + 2 * i]); b.push(t[2 + 2 * i]); }

const trungBinh = (v) => v.reduce((u, w) => u + w, 0) / v.length;
function saiSoChuan(v) {                         // SE = sd / sqrt(N), sd mẫu (chia N - 1)
  const m = trungBinh(v);
  let s = 0;
  for (const w of v) s += (w - m) * (w - m);
  return Math.sqrt(s / (v.length - 1)) / Math.sqrt(v.length);
}

const xA = trungBinh(a), xB = trungBinh(b), seA = saiSoChuan(a), seB = saiSoChuan(b);
const delta = xB - xA;
const nguong = 2 * Math.sqrt(seA * seA + seB * seB);       // so độc lập: phương sai cộng, không cộng thẳng SE

const d = a.map((v, i) => b[i] - v);                        // so theo cặp: hiệu từng test
const seD = saiSoChuan(d), nguongD = 2 * seD;

const ad = Math.abs(delta);
const kq = [xA, xB, seA, seB, delta, nguong, ad > nguong ? 1 : 0, seD, nguongD, ad > nguongD ? 1 : 0,
  N * (nguong / ad) * (nguong / ad), N * (nguongD / ad) * (nguongD / ad)];
print(kq.map((x) => x.toFixed(3)).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

static double trungBinh(const vector<double>& v) {
    double s = 0;
    for (double x : v) s += x;
    return s / v.size();
}
static double saiSoChuan(const vector<double>& v) {          // SE = sd / sqrt(N), sd mẫu (chia N - 1)
    double m = trungBinh(v), s = 0;
    for (double x : v) s += (x - m) * (x - m);
    return sqrt(s / (v.size() - 1)) / sqrt((double)v.size());
}

int main() {
    int N;
    scanf("%d", &N);
    vector<double> a(N), b(N), d(N);
    for (int i = 0; i < N; i++) { scanf("%lf %lf", &a[i], &b[i]); d[i] = b[i] - a[i]; }

    double xA = trungBinh(a), xB = trungBinh(b), seA = saiSoChuan(a), seB = saiSoChuan(b);
    double delta = xB - xA;
    double nguong = 2 * sqrt(seA * seA + seB * seB);          // so độc lập: phương sai cộng, không cộng thẳng SE
    double seD = saiSoChuan(d), nguongD = 2 * seD;            // so theo cặp: hiệu từng test
    double ad = fabs(delta);

    double kq[12] = {xA, xB, seA, seB, delta, nguong, ad > nguong ? 1.0 : 0.0, seD, nguongD, ad > nguongD ? 1.0 : 0.0,
                     N * (nguong / ad) * (nguong / ad), N * (nguongD / ad) * (nguongD / ad)};
    for (int i = 0; i < 12; i++) printf("%.3f%c", kq[i], i + 1 < 12 ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Cả `trungBinh` và `saiSoChuan` chỉ cần viết một lần; dùng lại cho A, cho B và cho dãy hiệu d. Nhớ chia `N − 1` khi tính sd mẫu.",
        "Ngưỡng độc lập cộng **bình phương** của hai SE rồi mới khai căn (§3.2). Ngưỡng theo cặp đơn giản hơn nhiều: `2·SE_d`, vì dãy hiệu chỉ có một nguồn sai số.",
        "`Δ = x̄B − x̄A` cũng chính là trung bình của dãy hiệu — hai cách so chỉ khác nhau ở **sai số**, không khác ở chênh lệch."
      ]
    },
    {
      id: "bo-sinh-tat-dinh",
      ten: "Bộ sinh tất định xorshift32 và so sánh hai greedy trên N test",
      doKho: 3,
      ref: "§4.1, §3.4",
      de: "Dựng cả chuỗi đo lường của Bài 4 trong một chương trình: bộ sinh **tất định** tự viết → `N` test → hai heuristic → thống kê → kết luận.\n\n" +
          "**Bộ sinh (xorshift32)** — cùng họ với `Rng` ở §4.1 nhưng 32 bit để chạy được trong JS: trạng thái `s` là số nguyên **không dấu** 32 bit, khởi tạo bằng `seed`. Mỗi lần gọi `next()`: `s ^= s << 13; s ^= s >> 17; s ^= s << 5` (mọi phép tính modulo 2³², `>>` là dịch bit không dấu), rồi trả về `s`. Cùng seed ⇒ cùng dãy trên mọi máy và mọi ngôn ngữ — đó là cả mục đích.\n\n" +
          "**Một test** (`n` món): với `i = 1..n` lấy `w_i = 5 + next() % 56` rồi `p_i = 5 + next() % 96`. Sức chứa `B = max(max w, ⌊2·Σw/5⌋)`. **Các test sinh liên tiếp từ cùng một dãy:** test 1 dùng các giá trị đầu, test 2 dùng tiếp ngay sau, …\n\n" +
          "**Hai heuristic cái túi** (duyệt một lần theo thứ tự, lấy món nào còn vừa; hoà thì chỉ số nhỏ hơn đứng trước; so sánh bằng phép nhân chéo số nguyên): **A** theo tỉ số `p/w` giảm dần; **B** theo `p/(w + c)` giảm dần.\n\n" +
          "**In một dòng 11 số:** 5 giá trị đầu của dãy (chính là các giá trị mà test 1 dùng cho `w₁, p₁, w₂, p₂, w₃` — để bạn tự kiểm bộ sinh trước), rồi `x̄A x̄B SE_A SE_B` (điểm tổng của từng thuật toán trên `N` test; sd mẫu; 3 chữ số thập phân), rồi `vIndep vPair` (1 nếu có ý nghĩa: độc lập theo `2·√(SE_A² + SE_B²)`, theo cặp theo `2·SE_d`).\n\n" +
          "Nếu lệch ngay ở 5 giá trị đầu thì lỗi nằm ở bộ sinh (gợi ý: `>>>` và `>>> 0` trong JS, `uint32_t` trong C++). Sau đó thử các tab: khi `c` nhỏ hai thuật toán gần nhau; khi `c` lớn thì sao? Hai kết luận `vIndep`, `vPair` có luôn trùng nhau không?",
      vanDe: "b04-bo-sinh-tat-dinh",
      bienThe: [
        { ten: "Khác nhau vừa (c = 20)", tham: { N: 30, n: 60, c: 20 } },
        { ten: "Sát nhau (c = 4)", tham: { N: 30, n: 60, c: 4 } },
        { ten: "Khác nhau rõ (c = 150)", tham: { N: 30, n: 60, c: 150 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: một dòng "seed N n c".
// Đầu ra : MỘT dòng 11 số: 5 giá trị đầu của dãy, rồi xA xB seA seB vIndep vPair (số thực in 3 chữ số thập phân).
const [seed, N, n, c] = readInput().split(/\s+/).filter(Boolean).map(Number);

// TODO 1: bộ sinh xorshift32 — trạng thái s không dấu 32 bit, khởi tạo bằng seed.
//         s ^= s << 13; s ^= s >> 17 (không dấu); s ^= s << 5. Trong JS nhớ ép về không dấu bằng ">>> 0".
// TODO 2: in-trước 5 giá trị đầu của dãy (dùng một bộ sinh riêng khởi tạo cùng seed).
// TODO 3: sinh N test liên tiếp; mỗi test n món: w = 5 + next() % 56, rồi p = 5 + next() % 96;
//         sức chứa B = max(max w, floor(2 * tổng w / 5)).
// TODO 4: điểm của A (greedy theo p/w) và B (greedy theo p/(w + c)) trên từng test; so sánh bằng nhân chéo.
// TODO 5: trung bình, SE (sd mẫu chia N - 1), kết luận độc lập và theo cặp.
const kq = [];
print(kq.map((x) => String(x)).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

// TODO 1: bộ sinh xorshift32 — trạng thái s kiểu uint32_t, khởi tạo bằng seed.
//         s ^= s << 13; s ^= s >> 17; s ^= s << 5.

int main() {
    unsigned seed;
    int N, n, c;
    scanf("%u %d %d %d", &seed, &N, &n, &c);

    // TODO 2: in-trước 5 giá trị đầu của dãy (dùng một bộ sinh riêng khởi tạo cùng seed).
    // TODO 3: sinh N test liên tiếp; mỗi test n món: w = 5 + next() % 56, rồi p = 5 + next() % 96;
    //         sức chứa B = max(max w, 2 * tổng w / 5).
    // TODO 4: điểm của A (greedy theo p/w) và B (greedy theo p/(w + c)) trên từng test; so sánh bằng nhân chéo.
    // TODO 5: trung bình, SE (sd mẫu chia N - 1), kết luận độc lập và theo cặp.
    printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const [seed, N, n, c] = readInput().split(/\s+/).filter(Boolean).map(Number);

// xorshift32: mọi phép tính modulo 2^32; ép về không dấu bằng ">>> 0" sau mỗi phép dịch trái.
function boSinh(hat) {
  let s = hat >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

const dau = boSinh(seed), ra = [];
for (let i = 0; i < 5; i++) ra.push(dau());                 // tự kiểm bộ sinh

const next = boSinh(seed);
const A = [], B = [];
for (let t = 0; t < N; t++) {
  const w = [], p = [];
  let tongW = 0, maxW = 0;
  for (let i = 0; i < n; i++) {
    w.push(5 + next() % 56);
    p.push(5 + next() % 96);
    tongW += w[i]; maxW = Math.max(maxW, w[i]);
  }
  const suc = Math.max(maxW, Math.floor(2 * tongW / 5));
  const diem = (hs) => {                                    // greedy theo p / (w + hs), nhân chéo, hoà: chỉ số nhỏ
    const thuTu = w.map((_, i) => i).sort((x, y) => (p[y] * (w[x] + hs) - p[x] * (w[y] + hs)) || (x - y));
    let con = suc, tong = 0;
    for (const i of thuTu) if (w[i] <= con) { con -= w[i]; tong += p[i]; }
    return tong;
  };
  A.push(diem(0)); B.push(diem(c));
}

const trungBinh = (v) => v.reduce((u, x) => u + x, 0) / v.length;
function saiSoChuan(v) {
  const m = trungBinh(v);
  let s = 0;
  for (const x of v) s += (x - m) * (x - m);
  return Math.sqrt(s / (v.length - 1)) / Math.sqrt(v.length);
}
const d = B.map((v, i) => v - A[i]);
const delta = trungBinh(B) - trungBinh(A), seA = saiSoChuan(A), seB = saiSoChuan(B);
const vIndep = Math.abs(delta) > 2 * Math.sqrt(seA * seA + seB * seB) ? 1 : 0;
const vPair = Math.abs(delta) > 2 * saiSoChuan(d) ? 1 : 0;
print(ra.join(" ") + " " + [trungBinh(A), trungBinh(B), seA, seB].map((x) => x.toFixed(3)).join(" ") + " " + vIndep + " " + vPair);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

struct BoSinh {                       // xorshift32: cùng seed ⇒ cùng dãy trên mọi máy
    uint32_t s;
    explicit BoSinh(uint32_t hat) : s(hat) {}
    uint32_t next() { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return s; }
};

static double trungBinh(const vector<double>& v) {
    double s = 0;
    for (double x : v) s += x;
    return s / v.size();
}
static double saiSoChuan(const vector<double>& v) {
    double m = trungBinh(v), s = 0;
    for (double x : v) s += (x - m) * (x - m);
    return sqrt(s / (v.size() - 1)) / sqrt((double)v.size());
}

int main() {
    unsigned seed;
    int N, n, c;
    scanf("%u %d %d %d", &seed, &N, &n, &c);

    BoSinh dau(seed);
    uint32_t ra[5];
    for (int i = 0; i < 5; i++) ra[i] = dau.next();            // tự kiểm bộ sinh

    BoSinh bs(seed);
    vector<double> A, B;
    for (int t = 0; t < N; t++) {
        vector<int> w(n), p(n);
        int tongW = 0, maxW = 0;
        for (int i = 0; i < n; i++) {
            w[i] = 5 + (int)(bs.next() % 56);
            p[i] = 5 + (int)(bs.next() % 96);
            tongW += w[i]; maxW = max(maxW, w[i]);
        }
        int suc = max(maxW, 2 * tongW / 5);
        auto diem = [&](int hs) {                               // greedy theo p / (w + hs), nhân chéo, hoà: chỉ số nhỏ
            vector<int> thuTu(n);
            iota(thuTu.begin(), thuTu.end(), 0);
            sort(thuTu.begin(), thuTu.end(), [&](int x, int y) {
                long long l = (long long)p[x] * (w[y] + hs), r = (long long)p[y] * (w[x] + hs);
                if (l != r) return l > r;
                return x < y;
            });
            int con = suc, tong = 0;
            for (int i : thuTu) if (w[i] <= con) { con -= w[i]; tong += p[i]; }
            return tong;
        };
        A.push_back(diem(0)); B.push_back(diem(c));
    }

    vector<double> d(N);
    for (int i = 0; i < N; i++) d[i] = B[i] - A[i];
    double delta = trungBinh(B) - trungBinh(A), seA = saiSoChuan(A), seB = saiSoChuan(B);
    int vIndep = fabs(delta) > 2 * sqrt(seA * seA + seB * seB) ? 1 : 0;
    int vPair = fabs(delta) > 2 * saiSoChuan(d) ? 1 : 0;
    printf("%u %u %u %u %u %.3f %.3f %.3f %.3f %d %d\n", ra[0], ra[1], ra[2], ra[3], ra[4],
           trungBinh(A), trungBinh(B), seA, seB, vIndep, vPair);
    return 0;
}
`
      },
      goiY: [
        "Bộ sinh: `s ^= s << 13; s ^= s >> 17; s ^= s << 5`. Trong JS, `<<` và `^` trả về số **có dấu** 32 bit: sau mỗi phép dịch trái hãy ép về không dấu bằng `>>> 0` (và dịch phải phải là `>>>`, không phải `>>`). Trong C++ chỉ cần `uint32_t`.",
        "In 5 giá trị đầu trước: nếu chúng khớp thì bộ sinh đúng, mọi lỗi còn lại nằm ở sinh test, greedy hoặc thống kê. Nhớ `w` rồi mới tới `p` cho mỗi món, và `B = max(max w, ⌊2·Σw/5⌋)`.",
        "Hai heuristic dùng **cùng** `N` test — đúng yêu cầu của so theo cặp. So sánh `p_a/(w_a + c) > p_b/(w_b + c)` bằng `p_a·(w_b + c) > p_b·(w_a + c)` để không dính số thực.",
        "Khi `vIndep = 0` mà `vPair = 1` thì chênh lệch có thật nhưng nằm trong nhiễu của hai trung bình độc lập — đúng điều §3.4 hứa: cùng dữ liệu, kết luận mạnh hơn, hoàn toàn miễn phí."
      ]
    }
  ]
});
