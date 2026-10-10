/* Thực hành — Bài 13: Simulated Annealing. */
(function () {
  "use strict";
  var TI = TH.tienIch, VD = TH.vande;

  /* ===================================================================================
     Bài toán 1: ba công thức của SA — Metropolis, lịch hạ nhiệt, hiệu chuẩn (một đáp án đúng)
     ===================================================================================*/
  VD.dangKy("b13-metropolis", VD.tuDapAn({
    sinh: function (seed) {
      var r = TI.rng(seed), Ts = [50, 100, 200, 250, 500, 1000, 2000, 5000], rho = [0.2, 0.5, 1.5, 2, 3, 4], i;
      var d0 = r.khoang(2, 40) * 50, A = [[-d0, d0]];                       /* câu đầu luôn có T = |Δ| (mốc 1/e) */
      while (A.length < 5) { var T = Ts[r.int(Ts.length)]; A.push([-Math.round(rho[r.int(rho.length)] * T), T]); }
      A.push([r.khoang(1, 8) * 50, Ts[r.int(Ts.length)]]);                  /* một nước tốt hơn: Δ ≥ 0 */
      var ps = [0.5, 0.2, 0.1, 0.05, 0.3, 0.01], B = [[r.khoang(4, 60) * 50, ps[r.int(ps.length)]], [r.khoang(4, 60) * 50, ps[r.int(ps.length)]]];
      var T0 = r.khoang(8, 80) * 100, Tend = r.khoang(1, 40), K = [1000, 5000, 20000, 60000, 100000][r.int(5)], ks = [0, K];
      for (i = 0; i < 3; i++) ks.push(r.khoang(1, K - 1));
      var nd = 12, ds = [], p0 = [0.5, 0.4, 0.6, 0.3, 0.25][r.int(5)], pend = [0.001, 0.01, 0.005, 0.0001][r.int(4)];
      for (i = 0; i < nd; i++) ds.push(r.khoang(5, 900));
      var T0a, Tenda, al, x;
      do {
        T0a = r.khoang(10, 80) * 100; Tenda = r.khoang(1, 20); al = [0.99, 0.995, 0.999, 0.9995, 0.9999][r.int(5)];
        x = Math.log(Tenda / T0a) / Math.log(al);
      } while (x - Math.floor(x) < 0.03 || x - Math.floor(x) > 0.97);
      return { A: A, B: B, T0: T0, Tend: Tend, K: K, ks: ks, ds: ds, p0: p0, pend: pend, T0a: T0a, Tenda: Tenda, al: al };
    },
    viet: function (q) {
      var s = q.A.length + "\n";
      q.A.forEach(function (a) { s += a[0] + " " + a[1] + "\n"; });
      s += q.B.length + "\n";
      q.B.forEach(function (b) { s += b[0] + " " + b[1] + "\n"; });
      s += q.T0 + " " + q.Tend + " " + q.K + " " + q.ks.length + "\n" + q.ks.join(" ") + "\n";
      s += q.ds.length + " " + q.p0 + " " + q.pend + "\n" + q.ds.join(" ") + "\n";
      s += q.T0a + " " + q.Tenda + " " + q.al + "\n";
      return s;
    },
    giai: function (q) {
      var tb = q.ds.reduce(function (a, b) { return a + b; }, 0) / q.ds.length, mn = Math.min.apply(null, q.ds);
      return [
        q.A.map(function (a) { return a[0] >= 0 ? 100 : 100 * Math.exp(a[0] / a[1]); }),
        q.B.map(function (b) { return b[0] / Math.log(1 / b[1]); }),
        q.ks.map(function (k) { return q.T0 * Math.pow(q.Tend / q.T0, k / q.K); }),
        [tb / Math.log(1 / q.p0), mn / Math.log(1 / q.pend)],
        [Math.ceil(Math.log(q.Tenda / q.T0a) / Math.log(q.al))]
      ];
    },
    saiSo: 0.01,
    dinhDang: {
      vao: "Năm phần liên tiếp. (1) `m`, rồi `m` dòng `Δ T`. (2) `b`, rồi `b` dòng `|Δ| p`. (3) dòng `T0 Tend K q`, rồi một dòng `q` mốc `k`. (4) dòng `nd p0 pend`, rồi một dòng `nd` giá trị `|Δ|`. (5) dòng `T0 Tend α`.",
      ra: "Theo thứ tự, mỗi số cách nhau khoảng trắng: (1) `m` xác suất chấp nhận **theo %**; (2) `b` nhiệt độ `T`; (3) `q` giá trị `T_k`; (4) hai số `T0`, `T_end` đã hiệu chuẩn; (5) một số nguyên `K`. Sai lệch cho phép 0,01."
    }
  }));

  /* ===================================================================================
     Bài toán 2: SA cho TSP với số vòng cố định. Dòng đầu: "n K T0 Tend" — K bắt buộc, T0/Tend chỉ là GỢI Ý.
     ===================================================================================*/
  var tsp = VD.lay("tsp");
  function goiYNhietDo(inst) {                       /* hiệu chuẩn như §3.1, trên nghiệm láng giềng gần nhất */
    var n = inst.n, p = tsp.ganNhat(inst), r = TI.rng(TI.bam(inst.x.join(",") + "|" + inst.y.join(","))), tong = 0, dem = 0, dmin = Infinity;
    function d(a, b) { var dx = inst.x[a] - inst.x[b], dy = inst.y[a] - inst.y[b]; return Math.sqrt(dx * dx + dy * dy); }
    for (var k = 0; k < 1000; k++) {
      var i = r.int(n), j = r.int(n);
      if (i > j) { var t = i; i = j; j = t; }
      if (j - i < 2 || (i === 0 && j === n - 1)) continue;
      var dl = d(p[i], p[j]) + d(p[i + 1], p[(j + 1) % n]) - d(p[i], p[i + 1]) - d(p[j], p[(j + 1) % n]);
      if (dl > 0) { tong += dl; dem++; if (dl < dmin) dmin = dl; }
    }
    return { T0: tong / dem / Math.log(2), Tend: dmin / Math.log(1000) };
  }
  VD.keThua("tsp", "b13-tsp-sa", {
    sinh: function (seed, tham) {
      tham = tham || {};
      var inst = tsp.sinh(seed, tham), h = goiYNhietDo(inst), f = tham.heSoT0 == null ? 1 : tham.heSoT0;
      inst.K = tham.K || 300000;
      inst.T0 = Number((h.T0 * f).toPrecision(5));
      inst.Tend = Number((h.Tend * (f < 1 ? f : 1)).toPrecision(4));
      return inst;
    },
    viet: function (inst) {
      var o = inst.n + " " + inst.K + " " + inst.T0 + " " + inst.Tend + "\n";
      for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + "\n";
      return o;
    },
    dinhDang: {
      vao: "Dòng 1: `n K T0 Tend` — số điểm, **số vòng lặp** của SA (mỗi vòng thử đúng một nước đi), và hai nhiệt độ **gợi ý** do đồng nghiệp đưa. Tiếp theo `n` dòng `x y` — toạ độ nguyên của điểm `i` (đánh số từ 1).",
      ra: "Một dòng gồm `n` chỉ số: hoán vị của `1..n` theo thứ tự đi (chu trình khép kín). Độ dài là tổng khoảng cách Euclid, càng **ngắn** càng tốt."
    }
  });

  TH.dangKy({
    id: "bai-13-simulated-annealing",

    tomTat: [
      "SA = leo đồi nhưng **thỉnh thoảng cho phép đi xuống**, với mức cho phép **giảm dần**. Cố định cao thì đi lang thang mãi; cố định thấp thì thành leo đồi và kẹt như cũ.",
      "Tiêu chuẩn Metropolis (cực đại hoá, Δ = f(y) − f(x)): nhận luôn nếu Δ ≥ 0; nếu Δ < 0 nhận với xác suất exp(Δ/T). Khi T ≈ |Δ| thì P ≈ 1/e ≈ 37 % — T **cùng đơn vị với điểm số** nên hiệu chuẩn được.",
      "Lịch hạ nhiệt nên dùng T_k = T₀·(T_end/T₀)^(k/K): chỉ cần ba số có ý nghĩa rõ ràng (T₀, T_end, số bước K). Dạng T₀·α^k thì bạn phải dò α cho T vừa hạ hết đúng K bước.",
      "Hiệu chuẩn bằng cách giải ngược Metropolis: T = |Δ| / ln(1/p). T₀ = |Δ| trung bình / ln 2 (p₀ = 0,5); T_end = |Δ| nhỏ nhất / ln 1 000 (p_end = 0,001). Rồi kiểm lại tỉ lệ chấp nhận: đầu 40–60 %, giữa 5–20 %, cuối < 1 %.",
      "Hai lỗi kinh điển: (1) không lưu `best` — SA đi lên đi xuống nên nghiệm cuối chưa chắc là tốt nhất; (2) trộn hàm phạt vào nước “bỏ” khiến SA tối ưu sai mục tiêu (điểm tụt từ 65 929 xuống 42 483).",
      "Trên P1 (60 test): SA 60 000 bước (16 ms) đạt 65 929, GRASP + chèn (3 ms) đạt 66 074 — chênh 145 nằm trong nhiễu đo (2·SE ≈ 930). SA không tự động thắng; nó thắng khi có nhiều thời gian: lợi ích tăng **chậm dần** theo log số bước (mỗi bậc 10× thêm ít điểm hơn bậc trước: ≈ 1 320 → 670 → 570), chưa bão hoà trong khoảng đã đo.",
      "Ba dấu hiệu SA hỏng: điểm cuối tệ hơn khởi tạo (quên `best`), điểm không đổi suốt quá trình (T₀ quá thấp), điểm dao động tới tận cuối (T_end quá cao). f hiện tại tụt xuống giữa chừng là **bình thường**; chỉ f tốt nhất mới được phép chỉ tăng.",
      "Biến thể đáng thử: tái nung (reheat), SA lai leo đồi, chấp nhận theo ngưỡng (không cần `exp`), và LAHC — chỉ một tham số L, hiệu ứng “nguội dần” tự xuất hiện mà không cần nhiệt độ."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§1.2",
        hoi: "Giữ “mức cho phép đi xuống” cố định thì hỏng theo cả hai hướng: quá cao thì xáo tung mãi, quá thấp thì kẹt như leo đồi. SA chữa việc đó bằng cách nào?",
        chon: [
          "Cho mức cho phép đi xuống cao lúc đầu rồi giảm dần",
          "Giữ cố định ở mức rất cao để không bao giờ kẹt",
          "Giữ cố định ở mức rất thấp để thuật toán ổn định",
          "Tăng dần mức cho phép theo thời gian để khám phá ngày càng nhiều"
        ],
        dung: 0,
        giaiThich: "Giai đoạn đầu (T cao) cho phép đi xa để tìm vùng hứa hẹn; giai đoạn cuối (T thấp) siết lại để lắng xuống đáy vùng đó. Cố định cao cho ra một lời giải ngẫu nhiên, cố định thấp chính là leo đồi; tăng dần thì ngược với mục tiêu “lắng xuống” nên cuối cùng vẫn đi lang thang."
      },
      {
        id: "q2", loai: "so", doKho: 1, ref: "§2.1–2.2", donVi: "(%)",
        hoi: "Bài toán cực đại hoá. Bạn đang ở lời giải x, hàng xóm y kém hơn 500 điểm (Δ = −500) và nhiệt độ hiện tại T = 250. Xác suất SA nhận y là bao nhiêu phần trăm? (làm tròn một chữ số thập phân)",
        dapAn: 13.5, saiSo: 0.1,
        giaiThich: "Δ < 0 nên P = exp(Δ/T) = exp(−500/250) = exp(−2) ≈ 0,1353, tức 13,5 %. Nếu nhầm Δ ≥ 0 thì xác suất là 100 %; nếu quên dấu trừ trong số mũ, bạn sẽ ra exp(2) ≈ 7,39 — xác suất không thể lớn hơn 1."
      },
      {
        id: "q3", loai: "mot", doKho: 2, ref: "§2.2",
        hoi: "Khi nhiệt độ T đúng bằng độ lớn |Δ| của một nước đi xấu thì xác suất chấp nhận xấp xỉ bao nhiêu, và vì sao điều này giúp hiệu chuẩn T?",
        chon: [
          "≈ 50 %, vì khi T = |Δ| hai khả năng nhận và từ chối cân bằng nhau",
          "≈ 13,5 %, vì luôn có exp(−2) khi T = |Δ|",
          "≈ 37 % (1/e); T cùng đơn vị với điểm số nên có thể chọn T theo độ lớn của nước đi điển hình",
          "≈ 5 %, vì exp(−3) là mốc bắt đầu chấp nhận"
        ],
        dung: 2,
        giaiThich: "exp(−|Δ|/T) với T = |Δ| là exp(−1) = 1/e ≈ 0,368. Vì T có cùng đơn vị với điểm số, nếu nước đi điển hình đổi điểm cỡ 500 thì T = 500 là “ấm vừa”, 5 000 là “nóng”, 50 là “nguội” — không phải mò. 50 % chỉ đạt khi T = |Δ|/ln 2 ≈ 1,44·|Δ|; 13,5 % ứng với T = |Δ|/2 và 5 % ứng với T = |Δ|/3."
      },
      {
        id: "q4", loai: "so", doKho: 2, ref: "§3.1",
        hoi: "Giải ngược tiêu chuẩn Metropolis: cần nhiệt độ T bằng bao nhiêu để một nước đi xấu Δ = −500 được nhận với xác suất 10 %? (làm tròn đến một chữ số thập phân)",
        dapAn: 217.1, saiSo: 0.5,
        giaiThich: "exp(−500/T) = 0,1 ⇒ −500/T = ln 0,1 ⇒ T = 500 / ln 10 = 500 / 2,3026 ≈ 217,1. Công thức tổng quát T = |Δ| / ln(1/p). Kiểm lại với bảng §2.2: T nhỏ hơn |Δ|/2 thì xác suất phải thấp hơn 13,5 % — khớp với 10 %."
      },
      {
        id: "q5", loai: "mot", doKho: 2, ref: "§2.3",
        hoi: "Vì sao bài khuyên dùng lịch T_k = T₀·(T_end/T₀)^(k/K) thay vì T_k = T₀·α^k?",
        chon: [
          "Vì dạng α^k không hạ nhiệt độ xuống được",
          "Vì dạng này chỉ cần chọn ba số có ý nghĩa rõ ràng (T₀, T_end, K), còn với α bạn phải dò cho T vừa hạ hết đúng K bước",
          "Vì dạng này hạ nhiệt nhanh hơn hẳn dạng α^k",
          "Vì dạng này không cần tính luỹ thừa trong vòng lặp"
        ],
        dung: 1,
        giaiThich: "Hai dạng thực ra cùng một họ hàm — chỉ khác cách đặt tham số: α = (T_end/T₀)^(1/K). Dạng α buộc bạn dò α sao cho T vừa chạm T_end đúng lúc hết K bước; dạng kia cho bạn đặt trực tiếp ba đại lượng có nghĩa vật lý. Cả hai đều dùng luỹ thừa và cùng hạ nhiệt theo cấp số nhân."
      },
      {
        id: "q6", loai: "mot", doKho: 2, ref: "§3.3",
        hoi: "Bạn in tỉ lệ chấp nhận ở 10 % số bước đầu và thấy 92 %. Chẩn đoán và cách chữa nào đúng?",
        chon: [
          "T₀ quá thấp, thuật toán đang thành leo đồi — tăng T₀",
          "T_end quá cao, chưa kịp lắng xuống — giảm T_end",
          "Hạ nhiệt quá nhanh — tăng số bước",
          "T₀ quá cao, nửa đầu bị lãng phí vào đi lang thang — giảm T₀"
        ],
        dung: 3,
        giaiThich: "Tỉ lệ đầu mong muốn là 40–60 %; trên 80 % nghĩa là gần như nhận mọi nước đi, tức T₀ quá cao và phần đầu thuộc ngân sách chỉ là đi ngẫu nhiên. Tỉ lệ đầu < 10 % mới là T₀ quá thấp; tỉ lệ cuối > 5 % mới chỉ ra T_end quá cao; điểm không cải thiện suốt nửa sau mới gợi ý hạ nhiệt quá nhanh."
      },
      {
        id: "q7", loai: "mot", doKho: 2, ref: "§4.2 (lỗi 1)",
        hoi: "SA của bạn kết thúc bằng `return q;` với q là nghiệm hiện tại, không có biến `best`. Vì sao đó là lỗi kinh điển?",
        chon: [
          "Vì ở bước cuối T vẫn > 0 nên SA vẫn có thể vừa nhận một nước xấu; SA đi lên đi xuống nên nghiệm cuối chưa chắc là nghiệm tốt nhất",
          "Vì q luôn là nghiệm tệ nhất từng gặp",
          "Vì leo đồi cũng bắt buộc phải lưu `best` như SA",
          "Vì q là con trỏ nên bị ghi đè sau khi hàm kết thúc"
        ],
        dung: 0,
        giaiThich: "Leo đồi chỉ đi lên nên nghiệm cuối chính là nghiệm tốt nhất và không cần nhớ gì. SA chấp nhận đi xuống, mà T cuối vẫn lớn hơn 0, nên nghiệm bạn đang cầm là nghiệm gần nhất, không phải nghiệm tốt nhất — phải giữ riêng một bản sao và cập nhật khi f cao hơn. Nghiệm hiện tại không “luôn tệ nhất”, và vấn đề cũng không liên quan đến con trỏ."
      },
      {
        id: "q8", loai: "nhieu", doKho: 2, ref: "§7",
        hoi: "Dấu hiệu nào dưới đây cho thấy SA của bạn đang **hỏng** (cần sửa)?",
        chon: [
          "Điểm cuối cùng tệ hơn điểm của nghiệm khởi tạo",
          "Điểm không đổi suốt cả quá trình chạy",
          "Điểm hiện tại vẫn dao động mạnh tới tận những bước cuối",
          "f(hiện tại) ở bước 6 000 thấp hơn ở bước 0",
          "Cột f(tốt nhất) chỉ tăng hoặc giữ nguyên"
        ],
        dung: [0, 1, 2],
        giaiThich: "Ba dấu hiệu hỏng của §7: điểm cuối tệ hơn khởi tạo (quên lưu best), điểm không đổi (T₀ quá thấp hoặc nước đi không sinh được nghiệm khác), dao động tới cuối (T_end quá cao). Hai ý còn lại là hành vi **bình thường**: f hiện tại tụt xuống là SA đang chấp nhận đi xuống để thoát ra, và f tốt nhất mới là cột chỉ được phép tăng."
      },
      {
        id: "q9", loai: "mot", doKho: 3, ref: "§5.1",
        hoi: "Trên P1, SA (60 000 bước, 16 ms) đạt 65 929 với sem = 337,4; GRASP + chèn (3 ms) đạt 66 074 với sem = 319,6. Kết luận nào đúng?",
        chon: [
          "SA thắng, vì nó cao hơn leo đồi 0,3 % và là thuật toán “cao cấp” hơn",
          "GRASP thắng, vì điểm cao hơn 145",
          "Chênh 145 điểm nằm trong nhiễu đo (2·√(337,4² + 319,6²) ≈ 930) nên chưa kết luận được ai hơn về điểm — nhưng GRASP nhanh gấp 5 lần",
          "Không so sánh được gì vì hai thuật toán chạy lâu mau khác nhau"
        ],
        dung: 2,
        giaiThich: "2·√(sem₁² + sem₂²) = 2·√(113 838 + 102 144) ≈ 930, lớn gấp 6 lần chênh lệch 145 ⇒ không khẳng định được về điểm. Về thời gian thì rõ ràng: 3 ms so với 16 ms. Bài học: đừng cho rằng thuật toán cao cấp hơn thì tốt hơn — phải đo; và thời gian cũng là một kết quả đo được."
      },
      {
        id: "q10", loai: "mot", doKho: 2, ref: "§6.4",
        hoi: "LAHC (Late Acceptance Hill Climbing) chấp nhận nước đi nếu nó tốt hơn nghiệm của L bước trước. Vì sao nó có hiệu ứng “nguội dần” mà không cần nhiệt độ?",
        chon: [
          "Vì nó dùng exp() ở bên trong nên tương đương nhiệt độ",
          "Vì lúc đầu điểm tăng nhanh nên điểm của L bước trước thấp hơn hẳn hiện tại ⇒ ngưỡng dễ; về sau điểm đứng yên ⇒ ngưỡng ≈ điểm hiện tại ⇒ gần như chỉ nhận cải thiện",
          "Vì L tăng dần theo thời gian",
          "Vì nó luôn từ chối mọi nước làm điểm giảm"
        ],
        dung: 1,
        giaiThich: "Ngưỡng của LAHC tự co lại theo chính quá trình tìm kiếm, nên chỉ còn đúng một tham số L (khoảng 50–5 000) và không cần hiệu chuẩn T₀, T_end. Nó không dùng exp(); L cố định; và nó vẫn nhận các nước làm điểm giảm miễn là không tệ hơn nghiệm cũ L bước trước — khác với leo đồi."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "Bài tập 13.2, §4.2",
        hoi: "Nếu xoá dòng `if (cur > bestV) { bestV = cur; best = q; }` khỏi `simulatedAnnealing` và đo lại, điểm sẽ thay đổi thế nào? Giải thích bằng nguyên lý của SA, và nói vì sao leo đồi không cần dòng này.",
        goiY: ["Ở bước cuối cùng T bằng bao nhiêu — có bằng 0 không?", "Leo đồi có bao giờ đi xuống không?"],
        mau: "Điểm **giảm khoảng 3–8 %** (đáp án của khoá) và **dao động mạnh** giữa các lần chạy: hàm trả về nghiệm cuối cùng, phụ thuộc may rủi của vài bước cuối.\n\nVì sao: ở bước cuối T vẫn lớn hơn 0, nên SA vẫn có thể vừa nhận một nước xấu. Nghiệm đang cầm lúc dừng chỉ là nghiệm **gần nhất**, chưa chắc là nghiệm **tốt nhất** từng gặp. SA đi lên **và đi xuống**, nên bắt buộc giữ riêng một bản sao của cái tốt nhất. Leo đồi **chỉ đi lên**, nên nghiệm cuối luôn là nghiệm tốt nhất và không cần nhớ gì.",
        tieuChi: ["Nêu hậu quả: điểm giảm (3–8 %) và dao động mạnh giữa các lần chạy", "Giải thích: T cuối vẫn > 0 nên nghiệm cuối có thể vừa nhận một nước xấu", "Nêu SA đi lên và đi xuống ⇒ phải giữ bản sao `best`", "Nêu leo đồi chỉ đi lên nên không cần"]
      },
      {
        id: "l2", doKho: 3, ref: "Bài tập 13.3, §3",
        hoi: "Bạn cài `hieuChuanT0()` theo §3.2 và thấy giá trị tự hiệu chuẩn là khoảng 3 100, khá gần 4 000 đang dùng; điểm hai cách chênh dưới 0,5 %. Bạn kết luận gì? Nếu kết quả tự hiệu chuẩn **tệ hơn** đáng kể thì bạn làm gì tiếp theo?",
        goiY: ["Hai giá trị gần nhau và điểm gần như bằng nhau thì nói lên điều gì?", "Công cụ chẩn đoán chính của bài là gì?"],
        mau: "- Kết quả chênh dưới 0,5 % cho thấy giá trị 4 000 đã được chọn hợp lý (hoặc đường cong điểm theo T₀ rất phẳng quanh vùng đó). Hiệu chuẩn không làm hỏng gì và có thêm lợi: giá trị tính được từ dữ liệu nên dùng lại được khi dữ liệu đổi, còn 4 000 thì phải đoán lại.\n- Nếu kết quả tệ hơn, **không đoán** — in **tỉ lệ chấp nhận** theo từng giai đoạn rồi tra bảng §3.3: đầu > 80 % thì T₀ quá cao (giảm); đầu < 10 % thì T₀ quá thấp (tăng); cuối > 5 % thì T_end quá cao (giảm); điểm không cải thiện suốt nửa sau thì hạ nhiệt quá nhanh (tăng số bước). Tỉ lệ chấp nhận rẻ để in và cho biết SA đang khám phá hay đang hỏng — điều mà nhìn điểm số không phân biệt được.",
        tieuChi: ["Kết luận: giá trị 4 000 hợp lý / đường cong phẳng; hiệu chuẩn dùng lại được khi dữ liệu đổi", "Nêu việc in tỉ lệ chấp nhận theo giai đoạn (đầu, giữa, cuối)", "Tra đúng bảng triệu chứng → chẩn đoán → cách chữa (ít nhất hai dòng)", "Nhận ra tỉ lệ chấp nhận phân biệt được “đang khám phá” với “đang hỏng”, còn điểm số thì không"]
      },
      {
        id: "l3", doKho: 3, ref: "Bài tập 13.4, §5.2",
        hoi: "Bảng §5.2 cho điểm SA theo số bước: 10 000 → ~64 900; 60 000 → 65 929; 300 000 → ~66 400; 1 000 000 → ~66 700, trong khi GRASP + chèn đạt 66 074 (3 ms). Hãy nêu quy luật giữa số bước và điểm, ước lượng số bước SA bắt đầu vượt GRASP + chèn, và nói ngân sách nào thì nên chọn SA, ngân sách nào thì GRASP.",
        goiY: ["Mỗi lần nhân số bước lên 10 thì điểm tăng bao nhiêu?", "Nội suy tuyến tính theo log₁₀(số bước) giữa hai mốc kẹp 66 074."],
        mau: "- **Quy luật:** lợi ích tăng theo log(số bước) nhưng **chậm dần** — mỗi bậc 10× mang thêm ít điểm hơn bậc trước: ≈ 1 320/bậc (10 000 → 60 000: +1 029 trên 0,78 bậc), ≈ 670/bậc (60 000 → 300 000: +471 trên 0,70 bậc), ≈ 570/bậc (300 000 → 10⁶: +300 trên 0,52 bậc). Độ dốc gần như giảm một nửa sau bậc đầu; chưa bão hoà trong khoảng đã đo (các điểm “~” của bảng là số làm tròn nên độ dốc chỉ là cỡ).\n- **Điểm vượt:** 66 074 − 65 929 = 145 cần thêm khoảng 145/670 ≈ 0,2 bậc log ⇒ 60 000 × 10^0,2 ≈ **10⁵ bước** (cỡ 27 ms: 16 ms cho 60 000 bước), tức gấp khoảng 9 lần thời gian GRASP + chèn (3 ms); và chênh lệch vẫn nằm trong nhiễu đo, nên nếu cần chắc chắn phải so lại bằng sem.\n- **Chọn:** ngân sách thời gian eo hẹp → GRASP + heuristic tốt (greedy chạy xong là đứng yên, GRASP cạn dần lợi ích sau vài chục lần khởi động). Ngân sách dư dả → SA, vì có thêm thời gian là nó luôn dùng được.",
        tieuChi: ["Nêu quy luật: điểm tăng chậm dần theo log số bước (≈ 1 320 → 670 → 570 điểm mỗi bậc 10×), chưa bão hoà trong khoảng đã đo", "Ước lượng điểm vượt ở cỡ 10⁵ bước (60 000 chưa đủ, 300 000 đã vượt) và dẫn cách nội suy", "Nhắc rằng chênh lệch nhỏ phải so với sem mới kết luận được", "Nêu quy tắc chọn: ngân sách eo hẹp → GRASP + chèn; dư dả → SA"]
      },
      {
        id: "l4", doKho: 3, ref: "Bài tập 13.5, §6.4",
        hoi: "Bạn cài LAHC với L ∈ {50, 500, 5 000} và so với SA ở cùng số bước. Dự đoán kết quả và nói điều đó cho bạn biết gì về “một tham số so với ba tham số”.",
        goiY: ["L quá nhỏ thì LAHC giống thuật toán nào? L quá lớn thì sao?", "SA cần hiệu chuẩn những gì?"],
        mau: "- **L = 500** thường ngang hoặc hơi tốt hơn SA ở cùng số bước, mà **không cần hiệu chuẩn nhiệt độ**.\n- **L = 50** quá ngắn: ngưỡng bám sát nghiệm hiện tại nên gần thành leo đồi, dễ kẹt.\n- **L = 5 000** quá dài: ngưỡng quá thấp so với hiện tại nên nhận gần như mọi nước ⇒ gần đi ngẫu nhiên.\n\nKết luận: LAHC chỉ có **một** tham số và vùng L tốt khá rộng, trong khi SA phải chọn đồng thời T₀, T_end (và lịch hạ nhiệt) mà chọn sai một cái là hỏng. Vì vậy LAHC rất đáng thử trong bài thi — ít phải dò tham số mà vẫn thường đạt mức của SA.",
        tieuChi: ["Nêu L = 500 ngang hoặc hơi tốt hơn SA mà không cần hiệu chuẩn", "Giải thích L = 50 gần leo đồi, L = 5 000 gần đi ngẫu nhiên", "Kết luận: ít tham số hơn thì ít phải dò hơn nhưng vẫn đạt mức tương đương"]
      }
    ],

    lab: [
      {
        id: "metropolis-lich-nhiet",
        ten: "Ba công thức của SA: Metropolis, lịch hạ nhiệt, hiệu chuẩn",
        doKho: 1,
        ref: "§2, §3.1",
        de: "SA chạy tốt hay hỏng đều bắt đầu từ vài công thức. Hãy cài chúng chính xác; mỗi bộ dữ liệu gồm **năm phần** liên tiếp (bài toán cực đại hoá, `Δ = f(y) − f(x)`):\n\n" +
          "1. **Metropolis.** `m` dòng `Δ T` → in xác suất chấp nhận **theo phần trăm** (nếu `Δ ≥ 0` thì 100).\n" +
          "2. **Giải ngược.** `b` dòng `|Δ| p` → in nhiệt độ `T` để nước xấu cỡ `|Δ|` được nhận với xác suất `p`.\n" +
          "3. **Lịch hạ nhiệt.** Dòng `T0 Tend K q` rồi `q` mốc `k` → in `T_k = T0·(Tend/T0)^(k/K)`.\n" +
          "4. **Hiệu chuẩn.** Dòng `nd p0 pend` rồi `nd` giá trị `|Δ|` của các nước xấu → in `T0` (từ `|Δ|` **trung bình** và `p0`) và `T_end` (từ `|Δ|` **nhỏ nhất** và `pend`).\n" +
          "5. **Dạng α.** Dòng `T0 Tend α` → in số bước `K` **nhỏ nhất** (nguyên) để `T0·α^K ≤ Tend`.\n\n" +
          "In lần lượt mọi kết quả (cách nhau khoảng trắng hay xuống dòng đều được); sai lệch cho phép 0,01 — nên in ít nhất hai chữ số thập phân.\n\n" +
          "**Câu hỏi suy ngẫm:** trong phần 1, câu đầu luôn có `T = |Δ|` — xác suất ra bao nhiêu, và vì sao điều đó cho phép đặt `T` theo cỡ điểm số? Ở phần 5, với `α = 0,999` cần cỡ bao nhiêu bước để hạ từ 4 000 xuống 1 — và vì sao dạng ở phần 3 dễ dùng hơn?",
        vanDe: "b13-metropolis",
        tham: {},
        soTest: 10,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đọc dữ liệu: năm phần (xem đề). Phần tính toán để bạn viết.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let pos = 0;
const nx = () => t[pos++];

const m = nx();
const dm = [], Tm = [];
for (let i = 0; i < m; i++) { dm.push(nx()); Tm.push(nx()); }

const b = nx();
const db = [], pb = [];
for (let i = 0; i < b; i++) { db.push(nx()); pb.push(nx()); }

const T0 = nx(), Tend = nx(), K = nx(), q = nx();
const ks = [];
for (let i = 0; i < q; i++) ks.push(nx());

const nd = nx(), p0 = nx(), pend = nx();
const ds = [];
for (let i = 0; i < nd; i++) ds.push(nx());

const T0a = nx(), Tenda = nx(), alpha = nx();

// TODO 1: P(%) = 100 nếu Δ >= 0, ngược lại 100 * exp(Δ / T).
const P = dm.map(() => 0);
// TODO 2: T = |Δ| / ln(1/p) cho từng cặp (db[i], pb[i]).
const Tb = db.map(() => 0);
// TODO 3: T_k = T0 * (Tend / T0) ** (k / K) cho từng mốc k.
const Tk = ks.map(() => 0);
// TODO 4: T0 hiệu chuẩn = (trung bình ds) / ln(1/p0) ; T_end hiệu chuẩn = (nhỏ nhất ds) / ln(1/pend).
let T0hc = 0, Tendhc = 0;
// TODO 5: K nhỏ nhất để T0a * alpha^K <= Tenda.
let Kbuoc = 0;

print(P.join(" "));
print(Tb.join(" "));
print(Tk.join(" "));
print(T0hc, Tendhc);
print(Kbuoc);
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let pos = 0;
const nx = () => t[pos++];

const m = nx();
const dm = [], Tm = [];
for (let i = 0; i < m; i++) { dm.push(nx()); Tm.push(nx()); }

const b = nx();
const db = [], pb = [];
for (let i = 0; i < b; i++) { db.push(nx()); pb.push(nx()); }

const T0 = nx(), Tend = nx(), K = nx(), q = nx();
const ks = [];
for (let i = 0; i < q; i++) ks.push(nx());

const nd = nx(), p0 = nx(), pend = nx();
const ds = [];
for (let i = 0; i < nd; i++) ds.push(nx());

const T0a = nx(), Tenda = nx(), alpha = nx();

// 1) Metropolis, theo phần trăm.
const P = dm.map((d, i) => (d >= 0 ? 100 : 100 * Math.exp(d / Tm[i])));
// 2) Giải ngược: exp(-|Δ|/T) = p  =>  T = |Δ| / ln(1/p).
const Tb = db.map((d, i) => d / Math.log(1 / pb[i]));
// 3) Lịch hạ nhiệt theo cấp số nhân.
const Tk = ks.map((k) => T0 * Math.pow(Tend / T0, k / K));
// 4) Hiệu chuẩn.
const tb = ds.reduce((a, c) => a + c, 0) / nd;
const T0hc = tb / Math.log(1 / p0), Tendhc = Math.min(...ds) / Math.log(1 / pend);
// 5) T0 * alpha^K <= Tend  =>  K >= ln(Tend / T0) / ln(alpha)   (cả hai log đều âm).
const Kbuoc = Math.ceil(Math.log(Tenda / T0a) / Math.log(alpha));

print(P.join(" "));
print(Tb.join(" "));
print(Tk.join(" "));
print(T0hc, Tendhc);
print(Kbuoc);
`
        },
        goiY: [
          "Phần 1: nhớ nhánh `Δ ≥ 0` trả 100 (không tính exp). Số mũ là `Δ / T` với `Δ` **âm**, đừng đổi dấu hai lần.",
          "Giải ngược: từ `exp(−|Δ|/T) = p` lấy ln hai vế được `T = |Δ| / ln(1/p)`. Mốc kiểm: `|Δ| = 1000`, `p = 0,5` cho `T ≈ 1443`.",
          "Phần 5: `T0·α^K ≤ Tend` ⇔ `K ≥ ln(Tend/T0) / ln α`. Cả hai logarit đều âm nên thương dương; lấy `ceil`."
        ]
      },
      {
        id: "sa-tsp",
        ten: "Simulated Annealing cho TSP với số vòng cố định",
        doKho: 3,
        ref: "§2–4, §7",
        de: "Cài **Simulated Annealing** cho chu trình ngắn nhất (`n = 60` điểm trên lưới 1 000 × 1 000, khoảng cách Euclid). Dòng đầu của dữ liệu là `n K T0 Tend`:\n\n" +
          "- `K` là **số vòng lặp** bạn phải dùng (mỗi vòng thử đúng một nước đi — ngân sách tính bằng vòng lặp chứ không bằng đồng hồ để kết quả không phụ thuộc máy);\n" +
          "- `T0`, `Tend` là nhiệt độ **gợi ý** do đồng nghiệp đưa; bạn được dùng hoặc tự hiệu chuẩn theo §3.1 (nên tự hiệu chuẩn!).\n\n" +
          "Gợi ý thiết kế: khởi tạo bằng láng giềng gần nhất; nước đi là **2-opt ngẫu nhiên** `(i, j)` với `delta` tính trong `O(1)`; nhận theo Metropolis với lịch `T0·(Tend/T0)^(k/K)`; **luôn nhớ nghiệm tốt nhất** và in nó (không in nghiệm cuối). Mọi ngẫu nhiên phải tất định: JS dùng `rng(seed)` có sẵn, C++ dùng `mt19937` với seed cố định.\n\n" +
          "**Mức đạt:** hợp lệ → bằng greedy gần nhất → bằng 2-opt (leo đồi từ gần nhất) → hơn 2-opt ít nhất 2 % (tổng độ dài 2-opt / tổng độ dài của bạn ≥ 1,02).\n\n" +
          "**Thí nghiệm:** dùng **T0 gợi ý** rồi chuyển sang tab *T0 quá thấp*: mức đạt rơi về đâu, và vì sao (in tỉ lệ chấp nhận bằng `log(...)` để xem)? Ở tab *T0 quá cao (×100)* điểm gần như không đổi dù nửa đầu bị lãng phí — hãy ước lượng phần ngân sách bị mất. Cuối cùng thay bằng hiệu chuẩn của bạn và chạy lại cả bốn tab.",
        vanDe: "b13-tsp-sa",
        tham: { n: 60 },
        bienThe: [
          { ten: "T0 hợp lý (gợi ý đúng)", tham: { n: 60, heSoT0: 1 } },
          { ten: "T0 quá thấp (≈ leo đồi)", tham: { n: 60, heSoT0: 0.003 } },
          { ten: "T0 quá cao (×100)", tham: { n: 60, heSoT0: 100 } },
          { ten: "Gom cụm, T0 hợp lý", tham: { n: 60, cum: true, heSoT0: 1 } }
        ],
        soTest: 10,
        gioiHanMs: 3000,
        muc: [
          { ten: "Bằng greedy gần nhất", so: "ganNhat", heSo: 1 },
          { ten: "Bằng 2-opt (leo đồi từ gần nhất)", so: "haiOpt", heSo: 1 },
          { ten: "Hơn 2-opt ít nhất 2 % (2-opt / bạn ≥ 1,02)", so: "haiOpt", heSo: 1.02 }
        ],
        khoiDau: {
          js: String.raw`// Đầu vào: "n K T0 Tend" (K = số vòng lặp, T0/Tend = nhiệt độ gợi ý); rồi n dòng "x y".
// Đầu ra : một dòng n chỉ số (hoán vị 1..n), chu trình tìm được.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1], T0goiY = t[2], TendgoiY = t[3];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 2 * i]); y.push(t[5 + 2 * i]); }
const D = [];
for (let a = 0; a < n; a++) {
  D.push([]);
  for (let b = 0; b < n; b++) D[a].push(Math.sqrt((x[a] - x[b]) ** 2 + (y[a] - y[b]) ** 2));
}

// Khởi tạo: láng giềng gần nhất bắt đầu từ điểm 0.
const p = [0], dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  let b = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
  dung[b] = true; p.push(b);
}

const r = rng(20260101);
// delta của nước 2-opt (i < j): đảo đoạn p[i+1..j]; cạnh (p[i],p[i+1]) và (p[j],p[j+1]) thành (p[i],p[j]) và (p[i+1],p[j+1]).
const delta = (i, j) => D[p[i]][p[j]] + D[p[i + 1]][p[(j + 1) % n]] - D[p[i]][p[i + 1]] - D[p[j]][p[(j + 1) % n]];

// TODO 1: hiệu chuẩn T0, Tend từ 1000 nước 2-opt ngẫu nhiên (hoặc tạm dùng T0goiY, TendgoiY để thử).
// TODO 2: lặp K vòng: bốc (i, j) ngẫu nhiên (i < j, j - i >= 2, không phải (0, n-1)); T = T0 * (Tend / T0) ** (k / K);
//         nhận nếu delta <= 0 hoặc r() < exp(-delta / T); nhận thì đảo đoạn p[i+1..j].
// TODO 3: nhớ nghiệm tốt nhất (bản sao của p) và in nó thay vì nghiệm cuối.

print(p.map((v) => v + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, K;
    double T0goiY, TendgoiY;
    scanf("%d %d %lf %lf", &n, &K, &T0goiY, &TendgoiY);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);
    vector<vector<double>> D(n, vector<double>(n));
    for (int a = 0; a < n; a++)
        for (int b = 0; b < n; b++) D[a][b] = sqrt((x[a] - x[b]) * (x[a] - x[b]) + (y[a] - y[b]) * (y[a] - y[b]));

    // Khởi tạo: láng giềng gần nhất bắt đầu từ điểm 0.
    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int b = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
        dung[b] = true; p.push_back(b);
    }

    mt19937 rng(20260101);
    auto r01 = [&]() { return (rng() >> 8) * (1.0 / 16777216.0); };   // số thực trong [0, 1)
    // delta của nước 2-opt (i < j): đảo đoạn p[i+1..j].
    auto delta = [&](int i, int j) {
        return D[p[i]][p[j]] + D[p[i + 1]][p[(j + 1) % n]] - D[p[i]][p[i + 1]] - D[p[j]][p[(j + 1) % n]];
    };

    // TODO 1: hiệu chuẩn T0, Tend từ 1000 nước 2-opt ngẫu nhiên (hoặc tạm dùng T0goiY, TendgoiY để thử).
    // TODO 2: lặp K vòng: bốc (i, j) ngẫu nhiên (i < j, j - i >= 2, không phải (0, n-1)); T = T0 * pow(Tend / T0, k / K);
    //         nhận nếu delta <= 0 hoặc r01() < exp(-delta / T); nhận thì reverse(p.begin() + i + 1, p.begin() + j + 1).
    // TODO 3: nhớ nghiệm tốt nhất (bản sao của p) và in nó thay vì nghiệm cuối.

    for (int i = 0; i < n; i++) printf("%d%c", p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1];           // t[2], t[3] là nhiệt độ gợi ý — lời giải này tự hiệu chuẩn nên bỏ qua
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 2 * i]); y.push(t[5 + 2 * i]); }
const D = [];
for (let a = 0; a < n; a++) {
  D.push([]);
  for (let b = 0; b < n; b++) D[a].push(Math.sqrt((x[a] - x[b]) ** 2 + (y[a] - y[b]) ** 2));
}

// Khởi tạo: láng giềng gần nhất.
const p = [0], dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  let b = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
  dung[b] = true; p.push(b);
}

const r = rng(20260101);
const delta = (i, j) => D[p[i]][p[j]] + D[p[i + 1]][p[(j + 1) % n]] - D[p[i]][p[i + 1]] - D[p[j]][p[(j + 1) % n]];
// Bốc một nước 2-opt hợp lệ: i < j, j - i >= 2, loại cặp (0, n-1).
function boc() {
  for (;;) {
    let i = r.int(n), j = r.int(n);
    if (i > j) { const tmp = i; i = j; j = tmp; }
    if (j - i >= 2 && !(i === 0 && j === n - 1)) return [i, j];
  }
}

// 1) Hiệu chuẩn (§3.1): 1000 nước ngẫu nhiên, chỉ xét nước LÀM XẤU.
let tong = 0, dem = 0, dmin = Infinity;
for (let k = 0; k < 1000; k++) {
  const [i, j] = boc();
  const dl = delta(i, j);
  if (dl > 0) { tong += dl; dem++; if (dl < dmin) dmin = dl; }
}
const T0 = (tong / dem) / Math.log(2);        // nhận 50 % lúc đầu
const Tend = dmin / Math.log(1000);           // nhận 0,1 % lúc cuối

// 2) Vòng SA, lịch hạ nhiệt cấp số nhân.
let cur = 0;
for (let i = 0; i < n; i++) cur += D[p[i]][p[(i + 1) % n]];
let best = cur, bestP = p.slice();
for (let k = 0; k < K; k++) {
  const T = T0 * Math.pow(Tend / T0, k / K);
  const [i, j] = boc();
  const dl = delta(i, j);
  if (dl <= 0 || r() < Math.exp(-dl / T)) {
    for (let l = i + 1, h = j; l < h; l++, h--) { const tmp = p[l]; p[l] = p[h]; p[h] = tmp; }
    cur += dl;
    if (cur < best - 1e-9) { best = cur; bestP = p.slice(); }     // BẮT BUỘC: nhớ nghiệm tốt nhất
  }
}
print(bestP.map((v) => v + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, K;
    double T0goiY, TendgoiY;                       // gợi ý — lời giải này tự hiệu chuẩn nên bỏ qua
    scanf("%d %d %lf %lf", &n, &K, &T0goiY, &TendgoiY);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);
    vector<vector<double>> D(n, vector<double>(n));
    for (int a = 0; a < n; a++)
        for (int b = 0; b < n; b++) D[a][b] = sqrt((x[a] - x[b]) * (x[a] - x[b]) + (y[a] - y[b]) * (y[a] - y[b]));

    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int b = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
        dung[b] = true; p.push_back(b);
    }

    mt19937 rng(20260101);
    auto r01 = [&]() { return (rng() >> 8) * (1.0 / 16777216.0); };
    auto delta = [&](int i, int j) {
        return D[p[i]][p[j]] + D[p[i + 1]][p[(j + 1) % n]] - D[p[i]][p[i + 1]] - D[p[j]][p[(j + 1) % n]];
    };
    auto boc = [&](int& i, int& j) {               // nước 2-opt hợp lệ: i < j, j - i >= 2, loại (0, n-1)
        for (;;) {
            i = rng() % n; j = rng() % n;
            if (i > j) swap(i, j);
            if (j - i >= 2 && !(i == 0 && j == n - 1)) return;
        }
    };

    // 1) Hiệu chuẩn (§3.1).
    double tong = 0, dmin = 1e18;
    int dem = 0;
    for (int k = 0; k < 1000; k++) {
        int i, j; boc(i, j);
        double dl = delta(i, j);
        if (dl > 0) { tong += dl; dem++; dmin = min(dmin, dl); }
    }
    double T0 = (tong / dem) / log(2.0);
    double Tend = dmin / log(1000.0);

    // 2) Vòng SA.
    double cur = 0;
    for (int i = 0; i < n; i++) cur += D[p[i]][p[(i + 1) % n]];
    double best = cur;
    vector<int> bestP = p;
    for (int k = 0; k < K; k++) {
        double T = T0 * pow(Tend / T0, (double)k / K);
        int i, j; boc(i, j);
        double dl = delta(i, j);
        if (dl <= 0 || r01() < exp(-dl / T)) {
            reverse(p.begin() + i + 1, p.begin() + j + 1);
            cur += dl;
            if (cur < best - 1e-9) { best = cur; bestP = p; }          // BẮT BUỘC: nhớ nghiệm tốt nhất
        }
    }
    for (int i = 0; i < n; i++) printf("%d%c", bestP[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
        },
        goiY: [
          "Nước đi hợp lệ: `i < j`, `j − i ≥ 2`, và loại cặp `(0, n−1)` (cạnh hai đầu dính vào nhau, đảo không đổi chu trình). Bốc lại nếu không hợp lệ.",
          "Hiệu chuẩn như §3.1: lấy 1 000 nước ngẫu nhiên trên nghiệm khởi tạo, chỉ giữ `delta > 0`; `T0 = |Δ| trung bình / ln 2`, `Tend = |Δ| nhỏ nhất / ln 1000`. Nếu bạn dùng T0 gợi ý ở tab “quá thấp”, hãy in tỉ lệ chấp nhận để thấy nó thành leo đồi.",
          "Mỗi khi nhận nước đi thì cập nhật `cur += delta` rồi so với `best`; chỉ sao chép nghiệm khi có kỷ lục mới (rất hiếm sau khi nguội). Dòng `best` quên là mất điểm ngay."
        ]
      }
    ]
  });
})();
