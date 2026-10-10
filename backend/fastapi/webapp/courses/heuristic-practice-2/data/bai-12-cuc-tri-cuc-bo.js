/* Thực hành — Bài 12: Cực trị cục bộ — chẩn đoán và thoát ra. */
(function () {
  "use strict";
  var TI = TH.tienIch, VD = TH.vande;

  /* ===================================================================================
     Bài toán 1: đo lưu vực hấp dẫn của leo đồi 2-opt (thí nghiệm §6.3 thu nhỏ để có tối ưu chính xác)
     ===================================================================================*/
  function dM(inst, a, b) { return Math.abs(inst.x[a] - inst.x[b]) + Math.abs(inst.y[a] - inst.y[b]); }
  function doDaiChuTrinh(inst, p) { var s = 0; for (var i = 0; i < p.length; i++) s += dM(inst, p[i], p[(i + 1) % p.length]); return s; }
  /* 2-opt "nước tốt nhất": quét mọi (i, j), chọn delta âm nhất (hoà → cặp quét trước), áp dụng, lặp tới khi không còn nước giảm. */
  function leoDoiTotNhat(inst, p0) {
    var n = inst.n, p = p0.slice();
    for (;;) {
      var tot = 0, bi = -1, bj = -1;
      for (var i = 0; i <= n - 3; i++) {
        for (var j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          var a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
          var dl = dM(inst, a, c) + dM(inst, b, e) - dM(inst, a, b) - dM(inst, c, e);
          if (dl < tot) { tot = dl; bi = i; bj = j; }
        }
      }
      if (bi < 0) return p;
      for (var l = bi + 1, h = bj; l < h; l++, h--) { var t = p[l]; p[l] = p[h]; p[h] = t; }
    }
  }
  function heldKarp(inst) {
    var n = inst.n, N = 1 << (n - 1), INF = 1e9, f = [], m, l, q;
    for (m = 0; m < N; m++) { var row = []; for (l = 0; l < n - 1; l++) row.push(INF); f.push(row); }
    for (l = 0; l < n - 1; l++) f[1 << l][l] = dM(inst, 0, l + 1);
    for (m = 1; m < N; m++) {
      for (l = 0; l < n - 1; l++) {
        if (!(m & (1 << l)) || f[m][l] >= INF) continue;
        for (q = 0; q < n - 1; q++) {
          if (m & (1 << q)) continue;
          var v = f[m][l] + dM(inst, l + 1, q + 1);
          if (v < f[m | (1 << q)][q]) f[m | (1 << q)][q] = v;
        }
      }
    }
    var kq = INF;
    for (l = 0; l < n - 1; l++) kq = Math.min(kq, f[N - 1][l] + dM(inst, l + 1, 0));
    return kq;
  }

  VD.dangKy("b12-do-luu-vuc", VD.tuDapAn({
    sinh: function (seed, tham) {
      var r = TI.rng(seed), n = (tham && tham.n) || 12, K = (tham && tham.K) || 40, x = [], y = [], goc = [], xp = [], i, k;
      for (i = 0; i < n; i++) { x.push(r.khoang(0, 50)); y.push(r.khoang(0, 50)); goc.push(i); }
      for (k = 0; k < K; k++) xp.push(TI.tron(goc, r));
      return { n: n, K: K, x: x, y: y, xp: xp };
    },
    viet: function (inst) {
      var s = inst.n + " " + inst.K + "\n", i;
      for (i = 0; i < inst.n; i++) s += inst.x[i] + " " + inst.y[i] + "\n";
      inst.xp.forEach(function (p) { s += p.map(function (v) { return v + 1; }).join(" ") + "\n"; });
      return s;
    },
    giai: function (inst) {
      var toiUu = heldKarp(inst), L = inst.xp.map(function (p) { return doDaiChuTrinh(inst, leoDoiTotNhat(inst, p)); });
      var tot = Math.min.apply(null, L), te = Math.max.apply(null, L), set = {}, cham = 0;
      L.forEach(function (v) { set[v] = 1; if (v === toiUu) cham++; });
      return [toiUu, tot, te, Object.keys(set).length, cham, te / tot];
    },
    saiSo: 0.001,
    dinhDang: {
      vao: "Dòng 1: `n K` — số điểm và số điểm xuất phát. Tiếp theo `n` dòng `x y` (toạ độ nguyên, điểm `i` là dòng thứ `i`). Tiếp theo `K` dòng, mỗi dòng là một hoán vị của `1..n` — một chu trình xuất phát.",
      ra: "Sáu giá trị (mỗi giá trị một dòng): độ dài tối ưu `L*`; độ dài cực trị cục bộ **tốt nhất**; **tệ nhất**; số độ dài **phân biệt**; số lần chạm đúng `L*`; độ phân tán = tệ nhất / tốt nhất (3 chữ số thập phân)."
    }
  }));

  /* ===================================================================================
     Bài toán 2: bộ chẩn đoán "đang kẹt" — ba chỉ dấu của §3
     ===================================================================================*/
  VD.dangKy("b12-chan-doan", VD.tuDapAn({
    sinh: function (seed, tham) {
      var r = TI.rng(seed), S = (tham && tham.soKichBan) || 8, kb = [], i, j;
      var combo = TI.tron([0, 1, 2, 3, 4, 5, 6, 7], r);          /* tám tổ hợp (ba cờ) đều xuất hiện */
      for (i = 0; i < S; i++) {
        var c = combo[i % 8], ket = c & 1, rong = (c >> 1) & 1, xa = (c >> 2) & 1;
        var U = r.khoang(8000, 20000);
        var dai = xa ? (r() < 0.5 ? 1 : 2) : (r() < 0.5 ? 3 : 4);
        if (ket && !xa && !rong) dai = 4;                          /* kẹt ở nơi đã sát cận: “đỉnh thật” */
        if (!ket && xa && !rong) dai = 1;                          /* chưa kẹt mà còn cách cận rất xa */
        var gap = dai === 1 ? 0.22 + r() * 0.2 : dai === 2 ? 0.07 + r() * 0.11 : dai === 3 ? 0.025 + r() * 0.02 : 0.002 + r() * 0.014;
        var tot = Math.round(U * (1 - gap));
        var s = rong ? 0.07 + r() * 0.09 : 0.004 + r() * 0.031;
        var thap = Math.round(tot * (1 - s)), N = r.khoang(4, 8), res = [tot, thap];
        for (j = 2; j < N; j++) res.push(Math.round(tot * (1 - s * r())));
        res = TI.tron(res, r);
        var pl = ket ? [10, 10, 11, 12, 15][r.int(5)] : [0, 1, 3, 6, 9][r.int(5)];
        var L = Math.max(pl + 6, 11) + r.int(10), curve = [], v = tot, buoc = Math.max(2, Math.round(tot * 0.01));
        for (j = L - 1 - pl; j >= 0; j--) { curve[j] = v; v -= r.khoang(1, buoc); }
        for (j = L - pl; j < L; j++) curve[j] = tot;
        kb.push({ curve: curve, res: res, U: U });
      }
      return { S: S, kb: kb };
    },
    viet: function (inst) {
      var s = inst.S + "\n";
      inst.kb.forEach(function (k) { s += k.curve.length + " " + k.curve.join(" ") + "\n" + k.res.length + " " + k.res.join(" ") + "\n" + k.U + "\n"; });
      return s;
    },
    giai: function (inst) {
      return inst.kb.map(function (k) {
        var L = k.curve.length, mx = Math.max.apply(null, k.res), mn = Math.min.apply(null, k.res);
        var c1 = L >= 11 && k.curve[L - 1] === k.curve[L - 11] ? 1 : 0;
        var c2 = (mx - mn) / mx > 0.05 ? 1 : 0, g = (k.U - mx) / k.U;
        var dai = g > 0.2 ? 1 : g > 0.05 ? 2 : g > 0.02 ? 3 : 4;
        return [c1, c2, g > 0.05 ? 1 : 0, dai];
      });
    },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `S` — số kịch bản. Mỗi kịch bản gồm ba dòng: `L f₁ … f_L` (đường cong, `f_i` = điểm tốt nhất sau `i × 1 000` nước đi); `N r₁ … r_N` (điểm cực trị cục bộ của `N` lần leo đồi); `U` (cận trên). Bài toán **cực đại hoá**.",
      ra: "`S` dòng, mỗi dòng bốn số nguyên: `c₁ c₂ c₃ d` — ba cờ chỉ dấu (0/1) và dải khoảng cách tới cận trên (1…4)."
    }
  }));

  TH.dangKy({
    id: "bai-12-cuc-tri-cuc-bo",

    tomTat: [
      "Leo đồi luôn dừng ở **cực trị cục bộ**, và từ bên trong bạn không phân biệt được gò đất với đỉnh núi: cả hai đều cho cảm giác “mọi hướng đều đi xuống”.",
      "Cực trị cục bộ là tính chất của **cặp (bài toán, bộ toán tử)**, không phải của riêng bài toán. Vì vậy “thêm một toán tử” là cách thoát bẫy rẻ nhất — thử trước mọi metaheuristic ở Phần 4.",
      "Ba chỉ dấu “đang kẹt” đo được mà không cần biết đỉnh núi: đường cong hội tụ đi ngang ≥ 10 000 nước; nhiều điểm xuất phát cho kết quả chênh > 5 %; còn cách cận trên > 5 %.",
      "Bốn chiến lược thoát bẫy: chấp nhận nghiệm xấu (SA) · cấm quay lại (Tabu) · đổi lân cận (VND/VNS) · phá và xây lại (LNS/ALNS). ILS là khung bao trùm đơn giản nhất; thứ tự thử: ILS → SA hoặc LNS → ALNS/Tabu/lai ghép.",
      "Đo trên TSP n = 200: 20 lần 2-opt từ điểm ngẫu nhiên cho 18 980 … 24 240 (phân tán 1,277), còn nghiệm khởi tạo tốt + 2-opt cho 14 656 — **tốt hơn cả 20 lần ngẫu nhiên**. Điểm xuất phát quan trọng hơn số lần thử.",
      "Phân tán giảm khi n tăng (n = 600: 1,158) nhờ tự trung bình hoá: với bài rất lớn, đa khởi động kém hiệu quả — nên đầu tư một lần chạy sâu hơn là nhiều lần chạy nông.",
      "Đếm số cực trị cục bộ phân biệt qua nhiều lần leo đồi: ~1 000 giá trị → bề mặt rất gồ ghề; ~10 giá trị → vài lưu vực lớn, đa khởi động là đủ. Dùng độ dài làm dấu vân tay thì con số đếm được chỉ là **chặn dưới**.",
      "Double-bridge là nước 4-opt mà 2-opt và Or-opt không hoàn tác được. Cường độ nhiễu loạn: bắt đầu nhẹ, tăng dần khi 100 lần liên tiếp không cải thiện; quá mạnh thì thành khởi động lại."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§ Bài này nói về chuyện gì",
        hoi: "Cùng một lời giải có thể là ngõ cụt với bộ toán tử này nhưng lại là điểm xuất phát tốt với bộ toán tử khác. Điều đó cho thấy cực trị cục bộ là tính chất của đối tượng nào?",
        chon: [
          "Chỉ của bài toán, không phụ thuộc cách ta sửa nghiệm",
          "Của cặp (bài toán, bộ toán tử / lân cận)",
          "Chỉ của hàm mục tiêu",
          "Chỉ của heuristic dùng để khởi tạo nghiệm"
        ],
        dung: 1,
        giaiThich: "Cực trị cục bộ được định nghĩa qua lân cận — tập nghiệm với tới được bằng một nước đi — nên đổi toán tử là đổi lân cận, và một cực trị có thể biến mất. Vì vậy “thêm một toán tử” là cách thoát bẫy rẻ nhất, đáng thử trước mọi metaheuristic. Ba phương án còn lại coi cực trị cục bộ là thuộc tính tuyệt đối của bài toán, của hàm mục tiêu hay của khởi tạo — đều bỏ qua vai trò của lân cận."
      },
      {
        id: "q2", loai: "so", doKho: 1, ref: "§1", donVi: "(%)",
        hoi: "Trên TSP n = 200, 20 lần chạy 2-opt từ điểm xuất phát ngẫu nhiên cho nghiệm tốt nhất dài 18 980 và tệ nhất dài 24 240. Cực trị cục bộ tệ nhất dài hơn tốt nhất bao nhiêu phần trăm? (làm tròn một chữ số thập phân)",
        dapAn: 27.7, saiSo: 0.1,
        giaiThich: "(24240 − 18980) / 18980 = 0,2771 ≈ 27,7 %, tức độ phân tán (tệ nhất / tốt nhất) là 1,277. Chênh lệch lớn như vậy cho thấy bề mặt tối ưu rất gồ ghề: có nhiều cực trị cục bộ và chất lượng của chúng khác nhau nhiều."
      },
      {
        id: "q3", loai: "mot", doKho: 2, ref: "§1, §6.2(b)",
        hoi: "Với n = 200, 2-opt từ nghiệm khởi tạo láng giềng gần nhất cho 14 656, còn nghiệm tốt nhất trong 20 lần 2-opt từ điểm ngẫu nhiên chỉ là 18 980. Bạn có ngân sách 20 đơn vị thời gian; cách phân bổ nào hợp lý hơn?",
        chon: [
          "Dùng 1 đơn vị xây một nghiệm khởi tạo tốt, 19 đơn vị còn lại để cải thiện nó",
          "Chia đều thành 20 lần chạy từ điểm ngẫu nhiên để có nhiều cơ hội trúng cực trị tốt",
          "Dồn cả 20 đơn vị vào một lần chạy từ một điểm xuất phát ngẫu nhiên",
          "Bỏ qua heuristic xây dựng, vì 2-opt luôn tự tìm được nghiệm tốt dù khởi tạo thế nào"
        ],
        dung: 0,
        giaiThich: "Điểm xuất phát quan trọng hơn số lần thử: một khởi tạo tốt đã thắng cả 20 lần ngẫu nhiên (14 656 so với 18 980, tức tệ hơn 29,5 %). Cần nhớ điều kiện: kết luận này đúng vì láng giềng gần nhất ở đây thật sự tốt — nếu chưa có heuristic xây dựng tử tế thì phải quay về Phần 2 trước. Ba phương án kia đều bỏ qua bằng chứng đo được."
      },
      {
        id: "q4", loai: "nhieu", doKho: 2, ref: "§3",
        hoi: "Những chỉ dấu nào dưới đây đo được mà **không cần biết** đỉnh núi thật ở đâu, và cho thấy bạn có thể đang kẹt ở cực trị cục bộ?",
        chon: [
          "Đường cong hội tụ đi ngang: 10 000 nước đi liên tiếp không cải thiện f tốt nhất",
          "Chạy từ nhiều điểm xuất phát khác nhau, kết quả chênh nhau hơn 5 %",
          "Khoảng cách tới cận trên (nếu có) còn lớn hơn 5 %",
          "Chương trình chạy nhanh hơn dự kiến",
          "Số vòng lặp đã chạy vượt 10⁶"
        ],
        dung: [0, 1, 2],
        giaiThich: "Đó là ba chỉ dấu của §3: đường cong đi ngang, kết quả phân tán giữa các điểm xuất phát, và còn cách cận trên xa. Tốc độ chạy hay số vòng lặp tuyệt đối không nói gì về chuyện đã kẹt hay chưa — thậm chí “chạy chậm, chưa đủ số nước” mới là nguyên nhân hay gặp (cạm bẫy 1)."
      },
      {
        id: "q5", loai: "mot", doKho: 2, ref: "§3.3",
        hoi: "Bài toán cực đại hoá có cận trên 5 000, nghiệm tốt nhất hiện có là 4 300. Theo bảng “khoảng cách tới cận trên” ở §3.3, kết luận nào đúng?",
        chon: [
          "Cách cận trên > 20 %: mô hình hoặc heuristic xây dựng có vấn đề",
          "Cách cận trên 2–5 %: chỉ cần tinh chỉnh tham số, thêm toán tử",
          "Cách cận trên khoảng 14 % (dải 5–20 %): cần metaheuristic",
          "Cách cận trên < 2 %: gần hết dư địa, cân nhắc dừng"
        ],
        dung: 2,
        giaiThich: "Khoảng cách là (5000 − 4300) / 5000 = 14 % (tính theo nghiệm: 700/4300 ≈ 16 %, vẫn cùng dải), nằm trong 5–20 % nên cần metaheuristic. Dải > 20 % chỉ vấn đề của mô hình hay heuristic xây dựng; 2–5 % là tinh chỉnh; < 2 % là gần hết dư địa — không dải nào khớp với 14 %."
      },
      {
        id: "q6", loai: "mot", doKho: 2, ref: "§4.3",
        hoi: "Chiến lược thoát bẫy nào có tính chất quý là **không bao giờ làm nghiệm hiện tại tệ đi**, nên không cần giữ riêng một biến `best` để phòng thân?",
        chon: [
          "Chấp nhận nghiệm xấu hơn với xác suất giảm dần (Simulated Annealing)",
          "Cấm quay lại các nước vừa đi (Tabu Search)",
          "Phá bỏ 30 % nghiệm rồi xây lại, nhận nghiệm mới bất kể tốt hay xấu",
          "Đổi sang lân cận khác khi kẹt (VND/VNS)"
        ],
        dung: 3,
        giaiThich: "Đổi lân cận chỉ đi tiếp khi tìm được nước cải thiện thật, nên nghiệm hiện tại luôn là nghiệm tốt nhất. SA và Tabu đều chấp nhận đi xuống (Tabu thậm chí bị ép đi xuống), và phá–xây lại với việc nhận mọi nghiệm mới cũng có thể làm tệ đi — cả ba đều phải giữ `best` riêng. Cái giá của đổi lân cận: nó chỉ thoát được cực trị của lân cận hẹp, hết đường khi nghiệm là cực trị với hợp mọi lân cận bạn có."
      },
      {
        id: "q7", loai: "nhieu", doKho: 2, ref: "§4, §10",
        hoi: "Chọn mọi cặp (chiến lược thoát bẫy — metaheuristic tương ứng) đúng:",
        chon: [
          "Chấp nhận nghiệm xấu hơn với xác suất giảm dần → Simulated Annealing",
          "Ghi nhớ và cấm quay lại các nước vừa đi → Tabu Search",
          "Đổi sang một kiểu lân cận khác khi kẹt → VND / VNS",
          "Phá một phần lớn nghiệm rồi xây lại → Tabu Search",
          "Cấm quay lại các nước vừa đi → Beam search"
        ],
        dung: [0, 1, 2],
        giaiThich: "Bốn chiến lược của §4: ① chấp nhận xấu → SA (Bài 13), ② cấm quay lại → Tabu (Bài 14), ③ đổi lân cận → VND/VNS (Bài 15), ④ phá và xây lại → LNS/ALNS (Bài 17). “Phá và xây lại” không phải Tabu, và Beam search (Bài 16) là cách xây nghiệm từng bước giữ nhiều khả năng — không liên quan đến chuyện cấm quay lại."
      },
      {
        id: "q8", loai: "mot", doKho: 2, ref: "§7.1",
        hoi: "Vì sao double-bridge được chọn làm nhiễu loạn kinh điển cho TSP, thay vì một nước 2-opt ngẫu nhiên?",
        chon: [
          "Vì nó là nước 4-opt mà 2-opt và Or-opt không hoàn tác được, nên chắc chắn thoát khỏi lưu vực hiện tại",
          "Vì nó luôn cho nghiệm tốt hơn nghiệm hiện tại",
          "Vì nó rẻ hơn mọi nước đi khác",
          "Vì nó giữ nguyên độ dài chu trình nên không cần đánh giá lại"
        ],
        dung: 0,
        giaiThich: "Nếu nhiễu loạn chỉ là một nước 2-opt, bước leo đồi kế tiếp hoàn tác ngay và rơi về đúng cực trị cũ (nhiễu quá nhẹ). Double-bridge là nước 4-opt mà 2-opt hay Or-opt không thể đảo ngược, nên đảm bảo ra khỏi lưu vực. Nó không hề cho nghiệm tốt hơn (còn thường làm tệ đi) và cũng làm đổi độ dài."
      },
      {
        id: "q9", loai: "mot", doKho: 3, ref: "§6.3",
        hoi: "Bạn chạy leo đồi từ 1 000 điểm xuất phát và đếm các độ dài cực trị cục bộ **phân biệt**, được khoảng 1 000 giá trị khác nhau. Kết luận nào hợp lý nhất?",
        chon: [
          "Chỉ có vài lưu vực lớn, nên đa khởi động là đủ",
          "Bài toán có đúng 1 000 cực trị cục bộ",
          "Độ dài là dấu vân tay hoàn hảo của cực trị, nên con số này chính xác tuyệt đối",
          "Bề mặt rất gồ ghề, mỗi lưu vực rất nhỏ; và 1 000 chỉ là chặn dưới vì hai cực trị khác nhau có thể tình cờ cùng độ dài"
        ],
        dung: 3,
        giaiThich: "Gần 1 000 giá trị khác nhau trong 1 000 lần chạy nghĩa là mỗi lần rơi vào một cực trị khác — mỗi lưu vực rất nhỏ, đa khởi động kém hiệu quả. Phép đếm dùng độ dài làm dấu vân tay nên đếm thiếu (hai cực trị khác nhau có thể trùng độ dài, nhất là khoảng cách nguyên và n nhỏ); muốn chính xác hơn thì băm cả dãy đỉnh. “Vài lưu vực lớn” ứng với ~10 giá trị, không phải ~1 000."
      },
      {
        id: "q10", loai: "mot", doKho: 2, ref: "§6.2(a)",
        hoi: "Đo độ phân tán (tệ nhất / tốt nhất) của leo đồi từ điểm ngẫu nhiên: n = 200 cho 1,277, n = 600 cho 1,158. Hiện tượng này gợi ý gì cho bài toán rất lớn?",
        chon: [
          "Nên tăng số lần khởi động tỉ lệ với n để bù lại",
          "Phân tán giảm nghĩa là leo đồi đã gần đạt tối ưu toàn cục",
          "Phân tán giảm nhờ tự trung bình hoá, nên đa khởi động kém hiệu quả hơn — nên đầu tư vào một lần chạy sâu (SA/ALNS)",
          "Mọi cực trị cục bộ trở nên giống hệt nhau về nội dung"
        ],
        dung: 2,
        giaiThich: "Với n lớn, mỗi nghiệm là tổng của rất nhiều thành phần gần độc lập, nên theo luật số lớn độ biến thiên tương đối giảm: các lần khởi động cho kết quả na ná nhau, thêm lần chạy chẳng mang lại nhiều. Phân tán nhỏ không có nghĩa là gần tối ưu (mọi lần có thể cùng kém), và cũng không có nghĩa các cực trị giống nhau về nội dung."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "Bài tập 12.2, §6.3",
        hoi: "Bạn cài thí nghiệm “đếm cực trị cục bộ phân biệt” (§6.3): chạy leo đồi 2-opt từ 1 000 điểm xuất phát ngẫu nhiên và đếm số độ dài khác nhau, cho TSP n = 50 rồi n = 200. Hãy dự đoán hai con số, nói chúng cho biết gì về chiến lược (nhiều lần nông hay một lần sâu), và nêu một hạn chế của phép đếm.",
        goiY: ["Nghĩ xem khi n tăng thì lưu vực hấp dẫn của mỗi cực trị lớn hơn hay nhỏ đi.", "Độ dài có phải dấu vân tay hoàn hảo của một cực trị không?"],
        mau: "- **n = 50:** cỡ vài trăm giá trị khác nhau trong 1 000 lần (đáp án của khoá: khoảng 200–400). Nhiều lần chạy rơi vào cùng một lưu vực, tức có những lưu vực lớn ⇒ đa khởi động còn giá trị.\n- **n = 200:** gần 1 000 giá trị khác nhau — gần như mỗi lần một cực trị mới. Bề mặt cực kỳ gồ ghề, mỗi lưu vực rất nhỏ, thêm lần khởi động ngẫu nhiên hầu như chỉ ra cực trị mới ⇒ nên đầu tư một lần chạy sâu (SA/ALNS) thay vì nhiều lần chạy nông.\n- **Hạn chế:** độ dài chỉ là “dấu vân tay” thô — hai cực trị khác nhau có thể tình cờ cùng độ dài (hay gặp khi khoảng cách nguyên và n nhỏ), nên số đếm được là **chặn dưới**. Muốn chính xác hơn thì băm cả dãy đỉnh.\n\nPhép đo này đáng làm **một lần cho mỗi bài toán mới** vì nó trả lời thẳng câu hỏi chiến lược, mà chỉ tốn vài chục dòng code.",
        tieuChi: ["Dự đoán số giá trị tăng theo n: vài trăm với n = 50, gần 1 000 với n = 200", "Rút ra: ít giá trị → vài lưu vực lớn, đa khởi động hiệu quả; nhiều giá trị → gồ ghề, nên chạy sâu", "Nêu hạn chế: đếm theo độ dài chỉ là chặn dưới (hai cực trị có thể trùng độ dài)", "Đề xuất cách chính xác hơn: băm cả dãy đỉnh"]
      },
      {
        id: "l2", doKho: 2, ref: "Bài tập 12.3, §7",
        hoi: "Viết giả mã một thuật toán ILS đơn giản cho TSP dùng `doubleBridge` (như Bài tập 12.3). Giải thích vì sao nhiễu loạn dùng double-bridge thay vì một nước 2-opt ngẫu nhiên, và quy tắc điều chỉnh cường độ nhiễu.",
        goiY: ["Hỏi: leo đồi 2-opt ngay sau một nước 2-opt ngẫu nhiên sẽ làm gì?", "Nhiễu quá nhẹ và quá mạnh, mỗi kiểu hỏng thế nào?"],
        mau: "```\nx = khởi tạo tốt + 2-opt\nbest = x\nlặp 1000 lần:\n    y = doubleBridge(x)\n    y = 2-opt(y)\n    nếu f(y) tốt hơn f(x): x = y\n```\n\n- **Vì sao double-bridge:** nó là nước **4-opt** mà 2-opt và Or-opt không hoàn tác được — leo đồi sau cú đá không thể quay lại đúng cực trị cũ, nên chắc chắn rời lưu vực. Nếu nhiễu chỉ là một nước 2-opt, bước 2-opt kế tiếp đảo ngược ngay và ta đứng yên.\n- **Cường độ:** quá nhẹ (1 nước swap) thì rơi về chỗ cũ; vừa (double-bridge, phá 10–30 %) thì thoát lưu vực mà vẫn giữ cấu trúc tốt; quá mạnh thì mất hết thông tin, thành khởi động lại. Bắt đầu nhẹ; nếu 100 lần liên tiếp không cải thiện thì **tăng dần cường độ** (ý tưởng “shaking” của VNS).\n- **Kết quả kỳ vọng** (đáp án của khoá, n = 200): từ 14 656 (2-opt một lần) xuống khoảng 13 800–14 000, tức giảm khoảng 5 %.\n- Với ràng buộc cứng, nhiễu loạn phải giữ nghiệm hợp lệ (hoặc có bước sửa chữa).",
        tieuChi: ["Giả mã có đủ: nhiễu loạn → leo đồi → nhận nếu tốt hơn", "Giải thích double-bridge là 4-opt mà 2-opt/Or-opt không hoàn tác được", "Nêu cường độ: nhẹ thì rơi về cũ, mạnh thì thành khởi động lại", "Nêu quy tắc: bắt đầu nhẹ, tăng dần khi 100 lần liên tiếp không cải thiện"]
      },
      {
        id: "l3", doKho: 3, ref: "Bài tập 12.4",
        hoi: "Với P1, bạn chạy leo đồi từ 50 nghiệm GRASP khác nhau và đo khoảng cách Hamming trung bình (số đơn hàng khác nhau) giữa hai cực trị bất kỳ; kết quả là 4–7 đơn trên khoảng 14 đơn được chọn. Con số này cho biết gì về cấu trúc bài toán, và về cường độ phá của LNS (phá khoảng 25 %)?",
        goiY: ["4–7 đơn trên 14 đơn là bao nhiêu phần trăm?", "So khoảng cách giữa các lưu vực với số đơn mà LNS phá mỗi lần."],
        mau: "4–7 đơn khác nhau trên 14 đơn là khoảng **30–50 %**: các cực trị cục bộ **rất khác nhau về nội dung**, tức bề mặt có nhiều lưu vực tách biệt chứ không phải một vùng trũng duy nhất. Hệ quả:\n\n- Đa khởi động có giá trị — mỗi lần xuất phát khác nhau thật sự dẫn tới một lời giải khác về chất.\n- LNS phá 25 % ≈ 3–4 đơn nên cường độ **hơi thấp** so với khoảng cách giữa các lưu vực: một cú phá–xây thường chỉ đủ để đi quanh trong cùng một lưu vực, chứ khó nhảy sang lưu vực khác.",
        tieuChi: ["Quy đổi ra tỉ lệ khoảng 30–50 % và nhận xét: các cực trị rất khác nhau về nội dung", "Kết luận đa khởi động có giá trị với bài toán này", "So sánh: LNS phá ≈ 3–4 đơn, thấp hơn khoảng cách giữa các lưu vực"]
      },
      {
        id: "l4", doKho: 2, ref: "§ Bài này nói về chuyện gì, §8",
        hoi: "Leo đồi của bạn dừng cải thiện và bạn đang muốn thêm một metaheuristic. Hãy nêu các việc nên kiểm tra **trước** khi thêm — sắp theo thứ tự từ rẻ đến đắt — và vì sao mỗi việc đáng làm trước.",
        goiY: ["Có chắc là đang kẹt, hay chỉ đang chạy chậm?", "Heuristic khởi tạo đã đủ tốt chưa?"],
        mau: "1. **Xác nhận là kẹt thật, không phải chậm** (cạm bẫy 1): đường cong hội tụ có đi ngang ≥ 10 000 nước không? Đã chạy đủ số nước chưa, tốc độ có đạt cỡ 10⁶ nước/giây nhờ delta (Bài 10) không? Có thể bạn chỉ thiếu thời gian chạy.\n2. **Kiểm tra heuristic khởi tạo** (cạm bẫy 2): nghiệm khởi tạo tốt thắng cả 20 lần ngẫu nhiên (14 656 so với 18 980). Nếu heuristic xây dựng còn yếu thì đầu tư Phần 2 trước, metaheuristic chỉ bù chậm.\n3. **Thêm một toán tử** (mở rộng lân cận): cực trị cục bộ là tính chất của cặp (bài toán, bộ toán tử), nên thêm Or-opt/swap… thường làm cực trị biến mất — rất rẻ, không cần tham số.\n4. **Đo ba chỉ dấu** (đường cong, phân tán giữa các điểm xuất phát, khoảng cách tới cận trên) để biết mức độ cần mạnh tay.\n5. Chỉ **sau đó** mới chọn metaheuristic, theo thứ tự ILS → SA hoặc LNS → ALNS/Tabu/lai ghép.",
        tieuChi: ["Nêu việc kiểm tra “kẹt hay chậm” (đủ số nước, tốc độ ~10⁶ nước/giây)", "Nêu việc kiểm tra heuristic khởi tạo, dẫn bằng chứng khởi tạo tốt thắng nhiều lần ngẫu nhiên", "Nêu việc thêm toán tử vì cực trị là tính chất của cặp (bài toán, toán tử)", "Sắp xếp được thứ tự từ rẻ đến đắt và đặt metaheuristic sau cùng"]
      }
    ],

    lab: [
      {
        id: "do-luu-vuc",
        ten: "Đo lưu vực hấp dẫn của leo đồi 2-opt",
        doKho: 2,
        ref: "§3.2, §6.3",
        de: "Đây là thí nghiệm §6.3 thu nhỏ, để có **tối ưu chính xác** mà so. TSP `n` điểm trên lưới, khoảng cách **Manhattan** `|Δx| + |Δy|` (số nguyên). Đầu vào cho sẵn `K = 40` chu trình xuất phát (mỗi dòng là một hoán vị của `1..n`).\n\n" +
          "**Việc cần làm**\n" +
          "1. Tính độ dài chu trình **tối ưu** `L*` (quy hoạch động Held–Karp, hoặc vét cạn có cắt tỉa).\n" +
          "2. Từ mỗi chu trình xuất phát, chạy **leo đồi 2-opt “nước tốt nhất”** đến cực trị cục bộ. Với chu trình `p[0..n−1]`, nước `(i, j)` hợp lệ khi `0 ≤ i`, `i + 2 ≤ j ≤ n − 1`, trừ cặp `(0, n−1)`; nó đảo đoạn `p[i+1..j]` và có `delta = d(p[i],p[j]) + d(p[i+1],p[j+1]) − d(p[i],p[i+1]) − d(p[j],p[j+1])` (chỉ số `j+1` lấy modulo `n`). Mỗi vòng: quét mọi `(i, j)` theo `i` tăng rồi `j` tăng, chọn nước có `delta` **âm nhất** (hoà thì cặp quét trước — dùng `<` chặt), áp dụng; dừng khi không còn `delta < 0`.\n" +
          "3. In sáu giá trị: `L*`, độ dài cực trị **tốt nhất**, **tệ nhất**, số độ dài **phân biệt** (dấu vân tay theo §6.3), số lần chạm đúng `L*`, và độ phân tán = tệ nhất / tốt nhất (3 chữ số thập phân).\n\n" +
          "**Mức đạt:** chỉ có đúng/sai — in đúng cả sáu giá trị trên cả 10 bộ dữ liệu.\n\n" +
          "**Câu hỏi suy ngẫm:** đổi sang *n = 7* và *n = 16* ở tab biến thể: số độ dài phân biệt và tỉ lệ chạm tối ưu thay đổi thế nào? Nếu một lần khởi động chạm tối ưu với xác suất p và các lần độc lập, cần ít nhất bao nhiêu lần để chắc 99 % có ít nhất một lần chạm? Vì sao số độ dài phân biệt chỉ là *chặn dưới* số cực trị cục bộ thật?",
        vanDe: "b12-do-luu-vuc",
        tham: { n: 12 },
        bienThe: [
          { ten: "n = 12", tham: { n: 12 } },
          { ten: "n = 7 (dễ)", tham: { n: 7 } },
          { ten: "n = 16 (gồ ghề hơn)", tham: { n: 16 } }
        ],
        soTest: 10,
        gioiHanMs: 2500,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: "n K"; n dòng "x y"; K dòng, mỗi dòng một hoán vị 1..n (chu trình xuất phát).
// Đầu ra: 6 giá trị (mỗi giá trị một dòng): L*, tốt nhất, tệ nhất, số độ dài phân biệt, số lần chạm L*, tệ/tốt (3 chữ số).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[2 + 2 * i]); y.push(t[3 + 2 * i]); }
const xp = [];
for (let k = 0; k < K; k++) {
  const p = [];
  for (let i = 0; i < n; i++) p.push(t[2 + 2 * n + k * n + i] - 1);
  xp.push(p);
}
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

// TODO 1: L* = độ dài chu trình tối ưu (Held–Karp: cố định điểm 0, f[mask][last]).
// TODO 2: hàm leoDoi(p): 2-opt "nước tốt nhất" (delta âm nhất, hoà thì cặp quét trước) cho tới khi không còn delta < 0.
// TODO 3: chạy leoDoi cho K chu trình xuất phát, gom độ dài các cực trị.
let toiUu = 0, tot = 0, te = 0, khacNhau = 0, cham = 0;

print(toiUu);
print(tot);
print(te);
print(khacNhau);
print(cham);
print((te / (tot || 1)).toFixed(3));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, K;
vector<int> X, Y;
int d(int a, int b) { return abs(X[a] - X[b]) + abs(Y[a] - Y[b]); }

int main() {
    scanf("%d %d", &n, &K);
    X.resize(n); Y.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &X[i], &Y[i]);
    vector<vector<int>> xp(K, vector<int>(n));
    for (int k = 0; k < K; k++)
        for (int i = 0; i < n; i++) { scanf("%d", &xp[k][i]); xp[k][i]--; }

    // TODO 1: L* = độ dài chu trình tối ưu (Held–Karp: cố định điểm 0, f[mask][last]).
    // TODO 2: hàm leoDoi(p): 2-opt "nước tốt nhất" (delta âm nhất, hoà thì cặp quét trước) cho tới khi không còn delta < 0.
    // TODO 3: chạy leoDoi cho K chu trình xuất phát, gom độ dài các cực trị.
    int toiUu = 0, tot = 0, te = 0, khacNhau = 0, cham = 0;

    printf("%d\n%d\n%d\n%d\n%d\n%.3f\n", toiUu, tot, te, khacNhau, cham, (double)te / (tot ? tot : 1));
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[2 + 2 * i]); y.push(t[3 + 2 * i]); }
const xp = [];
for (let k = 0; k < K; k++) {
  const p = [];
  for (let i = 0; i < n; i++) p.push(t[2 + 2 * n + k * n + i] - 1);
  xp.push(p);
}
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

// 1) Held–Karp: cố định điểm 0, f[mask][last] = đường ngắn nhất đi qua tập mask (không gồm điểm 0) rồi dừng ở last.
const N = 1 << (n - 1), INF = 1e9;
const f = [];
for (let m = 0; m < N; m++) f.push(new Array(n - 1).fill(INF));
for (let l = 0; l < n - 1; l++) f[1 << l][l] = d(0, l + 1);
for (let m = 1; m < N; m++) {
  for (let l = 0; l < n - 1; l++) {
    if (!(m & (1 << l)) || f[m][l] >= INF) continue;
    for (let q = 0; q < n - 1; q++) {
      if (m & (1 << q)) continue;
      const v = f[m][l] + d(l + 1, q + 1);
      if (v < f[m | (1 << q)][q]) f[m | (1 << q)][q] = v;
    }
  }
}
let toiUu = INF;
for (let l = 0; l < n - 1; l++) toiUu = Math.min(toiUu, f[N - 1][l] + d(l + 1, 0));

// 2) Leo đồi 2-opt "nước tốt nhất".
function leoDoi(p) {
  for (;;) {
    let tot = 0, bi = -1, bj = -1;
    for (let i = 0; i <= n - 3; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const delta = d(p[i], p[j]) + d(p[i + 1], p[(j + 1) % n]) - d(p[i], p[i + 1]) - d(p[j], p[(j + 1) % n]);
        if (delta < tot) { tot = delta; bi = i; bj = j; }       // "<" chặt: hoà thì cặp quét trước thắng
      }
    }
    if (bi < 0) return p;
    for (let l = bi + 1, h = bj; l < h; l++, h--) { const tmp = p[l]; p[l] = p[h]; p[h] = tmp; }
  }
}
function doDai(p) { let s = 0; for (let i = 0; i < n; i++) s += d(p[i], p[(i + 1) % n]); return s; }

// 3) Đo K lần.
const L = xp.map((p) => doDai(leoDoi(p)));
const tot = Math.min(...L), te = Math.max(...L);
const khacNhau = new Set(L).size;
const cham = L.filter((v) => v === toiUu).length;

print(toiUu);
print(tot);
print(te);
print(khacNhau);
print(cham);
print((te / tot).toFixed(3));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, K;
vector<int> X, Y;
int d(int a, int b) { return abs(X[a] - X[b]) + abs(Y[a] - Y[b]); }

int doDai(const vector<int>& p) {
    int s = 0;
    for (int i = 0; i < n; i++) s += d(p[i], p[(i + 1) % n]);
    return s;
}

// 2-opt "nước tốt nhất": delta âm nhất; hoà thì cặp quét trước thắng.
void leoDoi(vector<int>& p) {
    for (;;) {
        int tot = 0, bi = -1, bj = -1;
        for (int i = 0; i <= n - 3; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int delta = d(p[i], p[j]) + d(p[i + 1], p[(j + 1) % n]) - d(p[i], p[i + 1]) - d(p[j], p[(j + 1) % n]);
                if (delta < tot) { tot = delta; bi = i; bj = j; }
            }
        if (bi < 0) return;
        reverse(p.begin() + bi + 1, p.begin() + bj + 1);
    }
}

int main() {
    scanf("%d %d", &n, &K);
    X.resize(n); Y.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &X[i], &Y[i]);
    vector<vector<int>> xp(K, vector<int>(n));
    for (int k = 0; k < K; k++)
        for (int i = 0; i < n; i++) { scanf("%d", &xp[k][i]); xp[k][i]--; }

    // 1) Held–Karp: cố định điểm 0.
    const int INF = 1000000000;
    int N = 1 << (n - 1);
    vector<vector<int>> f(N, vector<int>(n - 1, INF));
    for (int l = 0; l < n - 1; l++) f[1 << l][l] = d(0, l + 1);
    for (int m = 1; m < N; m++)
        for (int l = 0; l < n - 1; l++) {
            if (!(m & (1 << l)) || f[m][l] >= INF) continue;
            for (int q = 0; q < n - 1; q++) {
                if (m & (1 << q)) continue;
                int v = f[m][l] + d(l + 1, q + 1);
                if (v < f[m | (1 << q)][q]) f[m | (1 << q)][q] = v;
            }
        }
    int toiUu = INF;
    for (int l = 0; l < n - 1; l++) toiUu = min(toiUu, f[N - 1][l] + d(l + 1, 0));

    // 3) Đo K lần.
    set<int> khac;
    int tot = INT_MAX, te = 0, cham = 0;
    for (int k = 0; k < K; k++) {
        leoDoi(xp[k]);
        int L = doDai(xp[k]);
        khac.insert(L);
        tot = min(tot, L); te = max(te, L);
        if (L == toiUu) cham++;
    }
    printf("%d\n%d\n%d\n%d\n%d\n%.3f\n", toiUu, tot, te, (int)khac.size(), cham, (double)te / tot);
    return 0;
}
`
        },
        goiY: [
          "Held–Karp: đặt `f[1 << l][l] = d(0, l + 1)`, rồi với mỗi `mask` và `last` thử thêm điểm `q` chưa có trong `mask`. Đáp án là `min f[đầy đủ][l] + d(l + 1, 0)`.",
          "Trong leo đồi, tìm nước tốt nhất trong **cả vòng quét** rồi mới áp dụng — đừng áp dụng nước đầu tiên có `delta < 0` (đó là một thuật toán khác, cho cực trị khác).",
          "Hoà `delta` thì giữ nước quét trước: dùng `delta < tot` (chặt) chứ không phải `<=`. Số độ dài phân biệt: bỏ độ dài vào một tập (`Set` / `set`) rồi lấy kích thước."
        ]
      },
      {
        id: "chan-doan-ket",
        ten: "Cài bộ chẩn đoán “đang kẹt” — ba chỉ dấu",
        doKho: 1,
        ref: "§3",
        de: "Bạn nhận một loạt **kịch bản** (bài toán cực đại hoá). Mỗi kịch bản có: đường cong `f₁ … f_L` (điểm tốt nhất sau mỗi 1 000 nước đi, không giảm); điểm `r₁ … r_N` của `N` lần leo đồi từ các điểm xuất phát khác nhau; và một cận trên `U`.\n\n" +
          "Với mỗi kịch bản, in một dòng bốn số `c₁ c₂ c₃ d`:\n" +
          "- `c₁` = 1 nếu **đường cong đi ngang**: `L ≥ 11` và `f_L = f_{L−10}` (10 000 nước liên tiếp không cải thiện), ngược lại 0;\n" +
          "- `c₂` = 1 nếu **kết quả phân tán**: `(max r − min r) / max r > 0,05`;\n" +
          "- `c₃` = 1 nếu **còn cách cận trên xa**: `g = (U − max r) / U > 0,05`;\n" +
          "- `d` = dải của `g` theo bảng §3.3: 1 nếu `g > 0,20`; 2 nếu `0,05 < g ≤ 0,20`; 3 nếu `0,02 < g ≤ 0,05`; 4 nếu `g ≤ 0,02`.\n\n" +
          "**Mức đạt:** in đúng cả bốn số của mọi kịch bản trên cả 10 bộ dữ liệu.\n\n" +
          "**Câu hỏi suy ngẫm:** trong mỗi bộ có đủ tám tổ hợp của ba cờ. Hãy tìm kịch bản có `c₁ = 1` nhưng `d = 4`, và kịch bản có `c₁ = 0` nhưng `d = 1`. Mỗi trường hợp nói gì? Vì sao một chỉ dấu đứng riêng không đủ để kết luận “tôi đang kẹt trên gò đất”?",
        vanDe: "b12-chan-doan",
        tham: { soKichBan: 8 },
        soTest: 10,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: S; rồi S kịch bản, mỗi kịch bản 3 dòng:
//   "L f1 ... fL"   (đường cong)    "N r1 ... rN"   (điểm các lần leo đồi)    "U"   (cận trên)
// Đầu ra: S dòng, mỗi dòng "c1 c2 c3 d".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let pos = 0;
const S = t[pos++];
for (let s = 0; s < S; s++) {
  const L = t[pos++];
  const f = t.slice(pos, pos + L); pos += L;
  const N = t[pos++];
  const r = t.slice(pos, pos + N); pos += N;
  const U = t[pos++];

  let c1 = 0, c2 = 0, c3 = 0, dai = 0;
  // TODO c1: đường cong đi ngang (L >= 11 và f[L-1] == f[L-11]).
  // TODO c2: (max r - min r) / max r > 0.05 ?
  // TODO c3, dai: g = (U - max r) / U ; c3 = g > 0.05 ; dai theo bảng §3.3.
  print(c1, c2, c3, dai);
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let pos = 0;
const S = t[pos++];
for (let s = 0; s < S; s++) {
  const L = t[pos++];
  const f = t.slice(pos, pos + L); pos += L;
  const N = t[pos++];
  const r = t.slice(pos, pos + N); pos += N;
  const U = t[pos++];

  const mx = Math.max(...r), mn = Math.min(...r);
  const c1 = (L >= 11 && f[L - 1] === f[L - 11]) ? 1 : 0;      // 10 khoảng liên tiếp không cải thiện
  const c2 = (mx - mn) / mx > 0.05 ? 1 : 0;                      // phân tán giữa các điểm xuất phát
  const g = (U - mx) / U;                                        // khoảng cách tới cận trên
  const c3 = g > 0.05 ? 1 : 0;
  const dai = g > 0.20 ? 1 : g > 0.05 ? 2 : g > 0.02 ? 3 : 4;
  print(c1, c2, c3, dai);
}
`
        },
        goiY: [
          "Đường cong lấy mẫu mỗi 1 000 nước nên 10 000 nước là **10 khoảng**: so `f[L−1]` với `f[L−11]` (đếm từ 0), và nhớ điều kiện `L ≥ 11`.",
          "Cả hai tỉ lệ đều chia cho giá trị lớn: phân tán chia cho `max r`; khoảng cách tới cận chia cho `U`. Đừng chia cho `min r`.",
          "Dải: kiểm theo thứ tự từ lớn đến nhỏ (`g > 0,20` rồi `g > 0,05` …) để mỗi `g` rơi vào đúng một dải."
        ]
      }
    ]
  });
})();
