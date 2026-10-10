/* Thực hành — Bài 8: Ngẫu nhiên hoá và đa khởi động (GRASP). */

// Bài toán tự dựng (tiền tố b08-): so RCL kiểu A (theo giá trị) với RCL kiểu B (theo số lượng) khi có ngoại lai.
// stdin : "n k a" / n giá trị ròng v        stdout: ngưỡng A, |RCL_A|, trung bình RCL_A, |RCL_B|, trung bình RCL_B
(function () {
  function biaTrai(v, a) {                           /* có phần tử nào nằm đúng trên ngưỡng không (biên mơ hồ) */
    var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), thr = 100 * mx - a * (mx - mn);
    for (var j = 0; j < v.length; j++) if (100 * v[j] === thr) return j;
    return -1;
  }
  TH.vande.dangKy("b08-rcl", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), n = r.khoang(8, 12), v = [], i;
      for (i = 0; i < n; i++) v.push(r.khoang(200, 900));
      for (i = 0; i < (tham.ngoai || 0); i++) v[r.int(n)] = -r.khoang(20000, 60000);
      var a = [20, 25, 30, 40][r.int(4)], k = r.khoang(2, 4), j, guard = 0;
      while ((j = biaTrai(v, a)) >= 0 && guard++ < 50) v[j] += 1;
      return { n: n, k: k, a: a, v: v };
    },
    viet: function (inst) { return inst.n + " " + inst.k + " " + inst.a + "\n" + inst.v.join(" ") + "\n"; },
    giai: function (inst) {
      var v = inst.v, mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
      var thr = mx - inst.a * (mx - mn) / 100;
      var A = v.filter(function (x) { return 100 * x >= 100 * mx - inst.a * (mx - mn); });
      var B = v.slice().sort(function (p, q) { return q - p; }).slice(0, Math.min(inst.k, v.length));
      function tb(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
      return [thr, A.length, tb(A), B.length, tb(B)];
    },
    saiSo: 0.001,
    dinhDang: {
      vao: "Dòng 1: `n k a` — số ứng viên, kích thước RCL kiểu B, và `a` = α × 100 (α = a/100). Dòng 2: `n` giá trị ròng `v` (số nguyên, có thể âm).",
      ra: "Năm số, mỗi số một dòng: ngưỡng RCL kiểu A = v_max − α·(v_max − v_min); số phần tử |RCL_A| (các `v ≥ ngưỡng`); trung bình các `v` trong RCL_A; |RCL_B| = min(k, n); trung bình k giá trị lớn nhất (RCL_B). Số thực in tuỳ ý (sai số cho phép 0,001)."
    }
  }));
})();

// Tham chiếu bổ sung cho ship1: chèn rẻ nhất tất định (λ = 10) và GRASP-chèn (N = 40, k = 3).
(function () {
  function dK(inst, i) { return Math.abs(inst.x[i] - inst.kx) + Math.abs(inst.y[i] - inst.ky); }
  function dd(inst, a, b) { return Math.abs(inst.x[a] - inst.x[b]) + Math.abs(inst.y[a] - inst.y[b]); }
  function xayDung(inst, lam, k, rnd) {              /* chèn rẻ nhất; k > 1: bốc ngẫu nhiên trong top-k đơn (RCL kiểu B) */
    var seq = [], dung = [], tg = 0, tien = 0, j, v;
    for (j = 0; j < inst.n; j++) dung.push(false);
    for (;;) {
      var ds = [];
      for (j = 0; j < inst.n; j++) {
        if (dung[j]) continue;
        var dtMin = Infinity, kMin = -1;
        for (v = 0; v <= seq.length; v++) {
          var a = v === 0 ? -1 : seq[v - 1], coSau = v < seq.length, b = coSau ? seq[v] : -1;
          var dt = (a < 0 ? dK(inst, j) : dd(inst, a, j)) + inst.s[j];
          if (coSau) dt += dd(inst, j, b) - (a < 0 ? dK(inst, b) : dd(inst, a, b));
          if (dt < dtMin) { dtMin = dt; kMin = v; }
        }
        if (tg + dtMin > inst.T) continue;
        ds.push({ j: j, k: kMin, dt: dtMin, v: inst.p[j] - lam * dtMin });
      }
      if (!ds.length) break;
      ds.sort(function (x, y) { return y.v - x.v || x.j - y.j; });
      var ch = ds[k > 1 ? rnd.int(Math.min(k, ds.length)) : 0];
      seq.splice(ch.k, 0, ch.j); dung[ch.j] = true; tg += ch.dt; tien += inst.p[ch.j];
    }
    return { seq: seq, tien: tien };
  }
  function xuat(seq) { return seq.length + "\n" + seq.map(function (i) { return i + 1; }).join(" ") + "\n"; }
  TH.vande.keThua("ship1", "b08-ship1", {
    thamChieu: {
      chen: function (inst) { return xuat(xayDung(inst, 10, 1, null).seq); },
      grasp: function (inst) {
        var rnd = TH.tienIch.rng(12345), tot = xayDung(inst, 10, 1, null);
        for (var it = 1; it < 40; it++) { var r = xayDung(inst, 10, 3, rnd); if (r.tien > tot.tien) tot = r; }
        return xuat(tot.seq);
      }
    }
  });
})();

TH.dangKy({
  id: "bai-08-grasp",

  tomTat: [
    "GRASP = greedy ngẫu nhiên hoá + đa khởi động: mỗi bước chọn ngẫu nhiên trong vài ứng viên tốt nhất, chạy N lần, giữ nghiệm tốt nhất. Nó biến thời gian dư của greedy tất định (0,01 ms trên 100 ms được phép) thành cơ hội gặp may.",
    "Mỗi lần chạy riêng lẻ thường kém greedy gốc (μ tụt), nhưng cực đại của N lần có thể hơn (σ tăng): GRASP có lãi khi σ·E[max_N Z] > Δμ. Heuristic nền mạnh thì Δμ nhỏ nên ngẫu nhiên hoá có lãi; nền yếu thì lỗ.",
    "RCL kiểu A: {j : v_j ≥ v_max − α(v_max − v_min)} — α = 0 là greedy, α = 1 là hoàn toàn ngẫu nhiên — **hỏng** khi có ngoại lai vì ngưỡng phụ thuộc v_min. Với v = [850, 820, 790, 300, −1 200], α = 0,25 ra {850, 820, 790}; thêm −50 000 thì RCL nuốt cả 5 ứng viên còn lại.",
    "RCL kiểu B (top-k theo thứ hạng) bền hơn nên là mặc định; k = 1 cho đúng greedy tất định, k = 2–5 là điểm ngọt, k = 10 đã phá heuristic nền (chèn: k = 3 → 66 074, k = 10 → khoảng 64 500).",
    "E[max_N Z] **không** phải √(2 ln N) — đó chỉ là chặn trên (N = 10: 2,15 so với giá trị đúng 1,54, lệch 39 %). Giá trị đúng: N = 10 → 1,54; 40 → 2,16; 100 → 2,51; 1 000 → 3,24. Từ N = 100, gấp 10 lần số lần chạy chỉ thêm ~20–30 % lợi ích; N = 20–50 là điểm ngọt.",
    "Ngẫu nhiên hoá cái **mạnh**, đừng ngẫu nhiên hoá cái yếu. Số đo trong bài giảng (P1, 60 test): GRASP trên greedy 61 416 (−0,01 %, vô dụng); GRASP trên chèn 66 074 (+0,99 % so với chèn, +7,58 % so với greedy) — ngang SA/ALNS với khoảng 1/5 thời gian.",
    "Báo cáo “tốt nhất trong N lần” đã tự thổi lên σ·E[max_N Z] (N = 40, σ = 3 % điểm → +6,5 % miễn phí). Khi so sánh hai phương pháp phải cho cùng số lần khởi động, và so với 2·SE (Bài 4).",
    "Cạm bẫy: RCL theo giá trị với phân phối lệch; ngẫu nhiên hoá quá mạnh (RCL nên 2–5 phần tử); dùng cùng seed cho mọi lần khởi động; không lưu nghiệm tốt nhất; dùng GRASP khi nền còn yếu. Dạng đầy đủ thêm local search: đa dạng hoá (pha 1) + cường hoá (pha 2)."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§1",
      hoi: "Greedy chạy trong 0,01 ms còn bài thi cho 100 ms — bạn dùng 0,01 % ngân sách thời gian. Vì sao chỉ “chạy greedy nhiều lần” không giúp được gì, và GRASP sửa điều đó thế nào?",
      chon: [
        "Vì mỗi lần chạy lại greedy sẽ học từ lần trước nên kết quả tốt dần lên",
        "Vì greedy đã tối ưu nên thời gian còn lại không cần dùng",
        "Vì greedy tất định: chạy 10 000 lần vẫn ra đúng một kết quả; GRASP chọn ngẫu nhiên trong vài ứng viên tốt nhất rồi chạy nhiều lần và giữ kết quả tốt nhất — đổi thời gian dư lấy cơ hội gặp may",
        "Vì GRASP luôn cho mỗi lần chạy riêng lẻ tốt hơn greedy"
      ],
      dung: 2,
      giaiThich: "Greedy tất định luôn đi đúng một đường trong cây quyết định nên lặp lại không mang lại gì — nó không có trí nhớ và không tự cải thiện giữa các lần. GRASP chọn ngẫu nhiên trong nhóm ứng viên tốt nhất để mỗi lần chạy đi một đường khác, rồi giữ nghiệm tốt nhất — cực đại của một mẫu thay vì một điểm cố định. Greedy không tối ưu (nó chỉ cho một nghiệm), và ngược với phương án cuối: mỗi lần chạy riêng lẻ của GRASP thường kém greedy gốc, lợi ích đến từ cực đại của cả mẫu."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "Bài tập 8.2",
      hoi: "GRASP dùng RCL kiểu B với k = 1 và chạy 100 lần với các seed khác nhau. Kết quả thế nào?",
      chon: [
        "Đúng bằng greedy tất định ở mọi lần chạy — RCL chỉ có ứng viên tốt nhất",
        "Tốt hơn greedy vì được chạy 100 lần",
        "Hoàn toàn ngẫu nhiên vì có dùng bộ sinh số",
        "Tệ hơn greedy vì thiếu đa dạng"
      ],
      dung: 0,
      giaiThich: "Với k = 1, RCL luôn có đúng một phần tử — ứng viên tốt nhất — nên bốc ngẫu nhiên (rng.below(1) = 0) luôn trả về phần tử đó, bất kể seed. Quỹ đạo giống hệt greedy tất định ở mọi lần chạy. Hệ quả hữu ích: đặt k = 1 là phép kiểm hồi quy rẻ cho mọi cài đặt GRASP."
    },
    {
      id: "q3", loai: "nhieu", doKho: 2, ref: "§3.2–3.3.1",
      hoi: "Chọn mọi phát biểu đúng về hai kiểu RCL.",
      chon: [
        "Kiểu A với α = 0 là greedy tất định, với α = 1 là hoàn toàn ngẫu nhiên",
        "Kiểu A bền hơn kiểu B vì tự thích nghi với độ phân tán của giá trị",
        "Ngưỡng của kiểu A phụ thuộc v_min — giá trị của ứng viên tệ nhất — nên một ngoại lai có thể làm RCL phình ra",
        "Với kiểu B, k càng lớn càng tốt vì RCL càng đa dạng",
        "Kiểu B chỉ dùng thứ hạng nên miễn nhiễm với giá trị ngoại lai; đó là lựa chọn mặc định"
      ],
      dung: [0, 2, 4],
      giaiThich: "Kiểu A: α = 0 chỉ còn ứng viên tốt nhất, α = 1 nhận mọi ứng viên; nhưng ngưỡng v_max − α(v_max − v_min) bị v_min kéo, nên một giá trị rất tệ làm ngưỡng tụt và RCL nuốt gần hết (lỗi làm bản cài đặt đầu của khoá thua greedy 16 %). Kiểu B dùng thứ hạng nên bền hơn. “Tự thích nghi” là ưu điểm của A nhưng cũng chính là điểm yếu; còn k lớn phá vỡ heuristic nền (RCL nên 2–5 phần tử)."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§3.2, §6, Bài tập 8.1",
      hoi: "Tại một bước, các ứng viên có giá trị ròng v = [640, 600, 590, 120, −900]. Ngưỡng của RCL kiểu A với α = 0,4 bằng bao nhiêu?",
      dapAn: 24, saiSo: 0,
      giaiThich: "v_max = 640, v_min = −900, khoảng = 1 540; ngưỡng = 640 − 0,4 × 1 540 = 640 − 616 = 24. RCL = {640, 600, 590, 120} (cả bốn đều ≥ 24; −900 bị loại). Nếu có thêm một ứng viên −50 000 thì khoảng = 50 640, ngưỡng = 640 − 0,4 × 50 640 = −19 616 và RCL nuốt cả −900: ngoại lai làm ngưỡng tụt."
    },
    {
      id: "q5", loai: "so", doKho: 3, ref: "§5.1", donVi: "(% điểm)",
      hoi: "Một phương pháp có σ = 2 % điểm giữa các lần chạy. Bạn chạy 100 lần, báo cáo kết quả tốt nhất và dùng giá trị đúng E[max₁₀₀ Z] = 2,51. Việc “lấy tốt nhất trong 100 lần” đã tự thổi điểm lên khoảng bao nhiêu % so với chất lượng trung bình của phương pháp?",
      dapAn: 5.02, saiSo: 0.1,
      giaiThich: "Kỳ vọng của cực đại là μ + σ·E[max_N Z], nên phần thổi lên là σ·E[max₁₀₀ Z] = 2 % × 2,51 = 5,02 % — miễn phí, kể cả khi phương pháp chẳng có gì đặc biệt. Vì vậy khi so hai phương pháp phải cho chúng cùng số lần khởi động. (Nếu dùng chặn trên √(2 ln 100) ≈ 3,03 sẽ ra 6,06 %, thổi phồng sai lệch.)"
    },
    {
      id: "q6", loai: "mot", doKho: 3, ref: "§4.2–4.3",
      hoi: "Bảng đo trong bài giảng: GRASP trên greedy 61 420 → 61 416 (vô dụng); GRASP trên chèn 65 425 → 66 074 (+0,99 %). Cùng kỹ thuật, cùng số lần khởi động. Cách giải thích nào đúng theo bài giảng?",
      chon: [
        "Vì chèn vốn đã là heuristic ngẫu nhiên",
        "Với nền mạnh (chèn) ngẫu nhiên hoá nhẹ chỉ làm tâm phân phối tụt chút ít trong khi cực đại của mẫu kéo lên nhiều hơn nên lãi; với nền yếu (greedy) hai lực này triệt tiêu nhau nên hoà",
        "Vì GRASP chỉ hoạt động với metaheuristic, không với heuristic xây dựng",
        "Vì greedy chạy nhanh nên không kịp khởi động đủ nhiều lần"
      ],
      dung: 1,
      giaiThich: "GRASP lấy cực đại của một mẫu nghiệm, nên chất lượng phụ thuộc phân phối mà heuristic nền sinh ra. Nguyên tắc: ngẫu nhiên hoá cái mạnh, đừng ngẫu nhiên hoá cái yếu — σ·E[max] > Δμ chỉ khi chọn hạng 2–3 không tệ đi nhiều. Hai bên dùng cùng N, và chèn chắc chắn không phải ngẫu nhiên; GRASP cũng áp dụng được cho heuristic xây dựng (đó chính là chữ GR)."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§4.4",
      hoi: "GRASP trên chèn: 66 074 điểm (SE 319,6; 3,15 ms). Simulated Annealing: 65 929 (SE 337,4; 15,96 ms). Chênh 145, trong khi 2·√(319,6² + 337,4²) ≈ 930. Kết luận nào đúng nhất?",
      chon: [
        "GRASP thắng SA có ý nghĩa thống kê vì 66 074 > 65 929",
        "SA thắng vì nó dùng nhiều thời gian hơn",
        "Không thể so sánh vì hai thuật toán có độ phức tạp khác nhau",
        "Chênh điểm nằm trong nhiễu (145 < 930), nhưng GRASP + chèn đạt cùng chất lượng với khoảng 1/5 thời gian — đó mới là điểm rõ ràng"
      ],
      dung: 3,
      giaiThich: "Chênh lệch chỉ đáng tin khi vượt 2·SE của hiệu (Bài 4). Ở đây 145 ≪ 930 nên về điểm là hoà. Nhưng về thời gian thì 3,15 ms so với 15,96 ms là rõ ràng: một heuristic xây dựng tốt cộng ngẫu nhiên hoá nhẹ đã ngang một metaheuristic phức tạp với chi phí thấp hơn nhiều. Hai thuật toán khác độ phức tạp vẫn so sánh được, miễn là cùng bộ dữ liệu và thước đo."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§8 (cạm bẫy 3)",
      hoi: "Đoạn mã GRASP viết: vòng for (it = 0; it < N; ++it) { Rng rng(12345); q = graspMotLan(a, alpha, rng); nếu q tốt hơn best thì best = q; }. Lỗi nằm ở đâu?",
      chon: [
        "Không có lỗi vì best đã được cập nhật",
        "Thiếu điều kiện dừng của vòng lặp",
        "Thiếu bước local search sau mỗi lần chạy nên các kết quả giống nhau",
        "Rng được tạo lại với cùng seed ở mỗi vòng nên cả N lần chạy giống hệt nhau — phải tạo Rng một lần ngoài vòng lặp"
      ],
      dung: 3,
      giaiThich: "Mỗi lần gọi Rng rng(12345) đặt lại dãy số về điểm đầu, nên mọi lần khởi động bốc đúng cùng dãy ngẫu nhiên và cho cùng một nghiệm — N lần thành 1 lần. Cách sửa: tạo Rng một lần bên ngoài vòng lặp (hoặc dùng seed khác nhau). Biến best đã đúng (lỗi “trả về lần chạy cuối” là một cạm bẫy khác) và vòng lặp có điều kiện dừng; còn local search là pha 2 tuỳ chọn, thiếu nó không làm các lần chạy trùng nhau."
    },
    {
      id: "q9", loai: "so", doKho: 2, ref: "§5.1", donVi: "(%)",
      hoi: "Nhiều tài liệu viết E[max_N Z] ≈ √(2 ln N). Ở N = 10 công thức này cho 2,15 trong khi giá trị đúng là 1,54. Công thức lệch bao nhiêu phần trăm so với giá trị đúng? (Làm tròn một chữ số thập phân.)",
      dapAn: 39.6, saiSo: 1,
      giaiThich: "(2,15 − 1,54) / 1,54 = 0,61 / 1,54 ≈ 0,396 ≈ 39,6 %. √(2 ln N) là **chặn trên**, không phải giá trị: ở N nhỏ nó lệch khá nhiều; càng lớn N càng sát hơn (N = 10 000: 4,29 so với 3,85). Dùng nó để ước lượng lợi ích của đa khởi động sẽ thổi phồng."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§5.1",
      hoi: "Bạn còn ngân sách cho khoảng 1 000 lần xây dựng lời giải. Theo bài giảng, cách dùng hợp lý nhất là gì?",
      chon: [
        "Dùng khoảng 20–50 lần cho GRASP (điểm ngọt) rồi chuyển phần ngân sách còn lại sang local search hoặc metaheuristic — dùng thời gian hiệu quả hơn nhiều",
        "Dồn cả 1 000 lần vào GRASP thuần",
        "Chạy đúng 10 lần vì sau đó lợi ích bằng không",
        "Dùng N = 1 000 với k = 10 để tối đa hoá đa dạng"
      ],
      dung: 0,
      giaiThich: "Lợi ích giảm dần: E[max] đi 2,51 → 3,24 → 3,85 khi N đi 100 → 1 000 → 10 000, tức gấp 10 lần số lần chạy chỉ mua thêm khoảng 20–30 %. Vì vậy N = 20–50 là điểm ngọt; phần còn lại nên dành cho pha cường hoá (local search). Lợi ích không bằng không sau 10 lần, và k lớn phá vỡ heuristic nền (RCL nên có 2–5 phần tử)."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 8.2",
      hoi: "Chứng minh: với RCL kiểu B và k = 1, GRASP cho kết quả đúng bằng greedy tất định, bất kể chạy bao nhiêu lần. Rồi nêu hệ quả của điều này khi bạn kiểm tra cài đặt GRASP của mình.",
      goiY: ["RCL có bao nhiêu phần tử khi k = 1?", "Bốc ngẫu nhiên từ một tập có đúng một phần tử thì ra gì?"],
      mau: "Với k = 1, RCL = top-1 ứng viên theo giá trị, tức chính ứng viên tốt nhất (với quy tắc phá hoà cố định). Bốc ngẫu nhiên từ tập có đúng một phần tử luôn trả về phần tử đó (rng.below(1) = 0, bất kể seed), nên ở **mọi** bước GRASP chọn đúng ứng viên mà greedy tất định chọn. Hai quá trình đi qua cùng dãy trạng thái nên cho cùng một nghiệm; mỗi lần khởi động cho nghiệm đó, và cực đại của N nghiệm giống nhau chính là nghiệm đó. ∎\n\nHệ quả để kiểm tra mã: đặt k = 1 phải tái tạo **đúng** nghiệm (và điểm) của heuristic tất định nền; nếu khác thì lỗi nằm ở chỗ ngẫu nhiên hoá hoặc ở quy tắc phá hoà. Đây là phép kiểm hồi quy rẻ cho mọi GRASP, và là lý do nên giữ một lần khởi động tất định.",
      tieuChi: ["Chỉ ra RCL chỉ có một phần tử (ứng viên tốt nhất) khi k = 1", "Lập luận bốc từ một phần tử luôn trả về nó, mọi bước giống greedy nên mọi lần chạy cho cùng nghiệm", "Nêu hệ quả kiểm thử: k = 1 phải tái tạo đúng heuristic tất định nền"]
    },
    {
      id: "l2", doKho: 3, ref: "Bài tập 8.4, §2.1, §5.1",
      hoi: "Bạn vẽ histogram 200 lần chạy graspChenMotLan trên một test và thấy: trung bình thấp hơn chèn tất định 1–2 %, nhưng cực đại của 200 mẫu cao hơn 3–4 %. (a) Giải thích hiện tượng và vì sao đó chính là cơ chế của GRASP. (b) Khi nào GRASP có lãi? (c) Một bạn báo cáo “đạt 66 000 (tốt nhất trong 100 lần chạy)” và so với đối thủ chỉ chạy 1 lần. So sánh có công bằng không; sai lệch cỡ bao nhiêu nếu σ = 3 % điểm?",
      goiY: ["Nghĩ về hai việc trái chiều mà ngẫu nhiên hoá làm: μ và σ.", "E[max₁₀₀ Z] ≈ 2,51."],
      mau: "(a) Mỗi lần chạy dùng ngẫu nhiên hoá nên đôi khi chọn ứng viên hạng 2–3 ⇒ μ tụt (trung bình thấp hơn tất định 1–2 %); nhưng các lần chạy cho nghiệm khác nhau nên σ lớn lên, và lấy **cực đại của một mẫu** thay vì một điểm cố định thì cực đại cao hơn tất định 3–4 %. Đó là đánh đổi chất lượng trung bình lấy cơ hội gặp may.\n\n(b) GRASP có lãi khi σ·E[max_N Z] > Δμ: phần σ kéo lên nhiều hơn phần μ tụt xuống. Heuristic nền mạnh ⇒ Δμ nhỏ ⇒ có lãi; nền yếu ⇒ Δμ lớn ⇒ lỗ.\n\n(c) Không công bằng: “tốt nhất trong N lần” đã tự thổi lên σ·E[max_N Z] so với chất lượng trung bình của phương pháp, kể cả khi phương pháp chẳng có gì đặc biệt. Với N = 100, E[max Z] ≈ 2,51 nên σ = 3 % cho thổi lên khoảng 2,51 × 3 % ≈ 7,5 % miễn phí. Phải cho mọi phương pháp **cùng số lần khởi động** (hoặc cùng ngân sách) khi so sánh.",
      tieuChi: ["Giải thích μ giảm nhưng cực đại của mẫu tăng (σ lớn lên)", "Nêu điều kiện σ·E[max_N Z] > Δμ và vai trò heuristic nền mạnh/yếu", "Chỉ ra so sánh không công bằng và tính được cỡ 2,51 × 3 % ≈ 7,5 %", "Nêu cách sửa: cùng số lần khởi động / cùng ngân sách"]
    },
    {
      id: "l3", doKho: 2, ref: "§3.3.1, §6, Bài tập 8.1",
      hoi: "Cho v = [850, 820, 790, 300, −1 200] và α = 0,25. (a) RCL kiểu A là gì? Nếu thêm một ứng viên có v = −50 000 thì RCL kiểu A thành gì? (b) RCL kiểu B với k = 3 trong hai trường hợp? (c) Từ đó nêu quy tắc tổng quát về các công thức chuẩn hoá theo (max − min).",
      goiY: ["Ngưỡng = v_max − α·(v_max − v_min).", "Ứng viên −50 000 có nằm trong RCL không, và nó làm gì với ngưỡng?"],
      mau: "(a) v_max = 850, v_min = −1 200, khoảng = 2 050, ngưỡng = 850 − 0,25 × 2 050 = 337,5 ⇒ RCL = {850, 820, 790}. Thêm −50 000: khoảng = 50 850, ngưỡng = 850 − 0,25 × 50 850 = −11 862,5 ⇒ RCL = {850, 820, 790, 300, −1 200} — nuốt cả những ứng viên rất tệ (chỉ riêng −50 000 bị loại); GRASP gần như thành chọn hoàn toàn ngẫu nhiên.\n\n(b) RCL kiểu B (top-3) luôn là {850, 820, 790}, bất kể có ngoại lai.\n\n(c) Ngưỡng kiểu A phụ thuộc v_min — thứ ta không quan tâm và không kiểm soát — nên mong manh trước ngoại lai. Mọi công thức chuẩn hoá theo (max − min) đều mong manh; chuẩn hoá theo **thứ hạng** hoặc **phân vị** thì bền. Đây là lỗi làm bản cài đặt đầu của khoá thua greedy 16 %. Mặc định dùng kiểu B với k từ 2 đến 5.",
      tieuChi: ["Tính đúng ngưỡng 337,5 và RCL kiểu A = {850, 820, 790}", "Tính đúng ngưỡng −11 862,5 khi có ngoại lai và RCL phình ra thành 5 phần tử", "Nêu RCL kiểu B không đổi vì chỉ dùng thứ hạng", "Phát biểu quy tắc: chuẩn hoá theo max − min mong manh, theo thứ hạng/phân vị thì bền"]
    },
    {
      id: "l4", doKho: 3, ref: "§7, Bài tập 8.5",
      hoi: "Bạn cài GRASP đầy đủ hai pha (xây dựng có ngẫu nhiên + leo đồi) với 20 lần khởi động. (a) Hai pha giải quyết hai vấn đề khác nhau nào, và điểm yếu của mỗi pha nếu dùng một mình? (b) Bạn chia ngân sách thế nào giữa số lần khởi động và độ sâu local search? (c) Vì sao cặp này là khung khái niệm của Phần 4?",
      goiY: ["Pha nào trả lời “bắt đầu từ đâu?”, pha nào trả lời “từ đây đi tiếp thế nào?”", "Nhớ lại: từ N = 100, gấp 10 lần số lần chạy mua được bao nhiêu?"],
      mau: "(a) Pha ① (xây dựng có ngẫu nhiên) trả lời “bắt đầu từ đâu?” — rải điểm xuất phát khắp không gian (đa dạng hoá); dùng một mình thì nghiệm sinh ra chưa được tinh chỉnh, còn nhiều nước cải thiện dễ. Pha ② (local search) trả lời “từ đây đi tiếp thế nào?” — đẩy mỗi điểm xuống đáy lưu vực của nó (cường hoá); dùng một mình thì kẹt ở cực trị cục bộ của **một** lưu vực. Không có ① chỉ khám phá được một lưu vực; không có ② dừng lại ở lưng chừng dốc.\n\n(b) Với tổng ngân sách cố định, N khoảng 20–50 là điểm ngọt (gấp 10 lần N từ 100 trở đi chỉ mua thêm 20–30 %); phần còn lại nên dành cho pha ② để mỗi lần khởi động đào sâu hơn, vì nó dùng thời gian hiệu quả hơn nhiều. Luôn so các cấu hình ở **cùng ngân sách**.\n\n(c) Cặp đa dạng hoá / cường hoá là khung của toàn bộ Phần 4: mỗi metaheuristic là một cách cân bằng khác giữa hai lực đó — SA bằng nhiệt độ, tabu bằng danh sách cấm, LNS bằng tỉ lệ phá.",
      tieuChi: ["Gán đúng: pha ① đa dạng hoá (chọn xuất phát), pha ② cường hoá (đẩy xuống đáy lưu vực)", "Nêu điểm yếu khi dùng một mình: ① chưa tinh chỉnh; ② kẹt một lưu vực", "Nêu cách chia ngân sách: N cỡ 20–50, phần còn lại cho local search, so ở cùng ngân sách", "Nêu SA/Tabu/LNS là các cách cân bằng khác nhau giữa hai lực"]
    }
  ],

  lab: [
    {
      id: "rcl-kieu-a-b",
      ten: "RCL kiểu A và kiểu B khi có ngoại lai",
      doKho: 1,
      ref: "§3.2–3.3.1, §6, Bài tập 8.1",
      de: "Tại một bước của GRASP có `n` ứng viên với giá trị ròng `v` (có thể âm). Cho `k` (kích thước RCL kiểu B) và `a` = α × 100, tức α = a/100. Hãy tính và in năm số, mỗi số một dòng:\n\n" +
          "1. ngưỡng của RCL kiểu A = `v_max − α·(v_max − v_min)`;\n" +
          "2. số phần tử |RCL_A|, với RCL_A gồm các `v` có `v ≥ ngưỡng`;\n" +
          "3. trung bình các `v` trong RCL_A (chính là giá trị kỳ vọng của một lần bốc đều trong RCL);\n" +
          "4. |RCL_B| = min(k, n), với RCL_B là k giá trị lớn nhất;\n" +
          "5. trung bình các `v` trong RCL_B.\n\n" +
          "Chấm trên 10 bộ dữ liệu. Sau khi qua, đổi sang các biến thể *có ngoại lai* và so với biến thể đầu: |RCL_A| và trung bình RCL_A thay đổi ra sao? còn RCL_B? Vì sao bài giảng khuyên dùng kiểu B làm mặc định? (§3.3.1)",
      vanDe: "b08-rcl",
      tham: { ngoai: 0 },
      bienThe: [
        { ten: "Giá trị đều đặn (không ngoại lai)", tham: { ngoai: 0 } },
        { ten: "Một ngoại lai rất tệ", tham: { ngoai: 1 } },
        { ten: "Hai ngoại lai rất tệ", tham: { ngoai: 2 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n k a" (α = a/100); dòng 2: n giá trị ròng v (số nguyên, có thể âm).
// Đầu ra : 5 số, mỗi số một dòng: ngưỡng A, |RCL_A|, TB(RCL_A), |RCL_B|, TB(RCL_B).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], k = t[1], a = t[2];
const v = t.slice(3, 3 + n);

// TODO: ngưỡng A = vmax − (a/100)·(vmax − vmin); RCL_A = các v >= ngưỡng.
//       Để tránh sai số số thực khi so sánh có thể dùng 100·v >= 100·vmax − a·(vmax − vmin).
//       RCL_B = k giá trị lớn nhất. TB = trung bình cộng.
print(0);
print(0);
print(0);
print(0);
print(0);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, k, a;
    scanf("%d %d %d", &n, &k, &a);
    vector<long long> v(n);
    for (int i = 0; i < n; i++) scanf("%lld", &v[i]);

    // TODO: ngưỡng A = vmax − (a/100)·(vmax − vmin); RCL_A = các v >= ngưỡng.
    //       Để tránh sai số số thực khi so sánh có thể dùng 100·v >= 100·vmax − a·(vmax − vmin).
    //       RCL_B = k giá trị lớn nhất. TB = trung bình cộng.
    printf("0\n0\n0\n0\n0\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], k = t[1], a = t[2];
const v = t.slice(3, 3 + n);

const vmax = Math.max(...v), vmin = Math.min(...v);
const nguong = vmax - a * (vmax - vmin) / 100;
const rclA = v.filter((x) => 100 * x >= 100 * vmax - a * (vmax - vmin));   // so sánh số nguyên, không sai số
const rclB = v.slice().sort((p, q) => q - p).slice(0, Math.min(k, n));      // kiểu B chỉ dùng thứ hạng
const tb = (m) => m.reduce((s, x) => s + x, 0) / m.length;

print(nguong.toFixed(6));
print(rclA.length);
print(tb(rclA).toFixed(6));
print(rclB.length);
print(tb(rclB).toFixed(6));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, k, a;
    scanf("%d %d %d", &n, &k, &a);
    vector<long long> v(n);
    for (int i = 0; i < n; i++) scanf("%lld", &v[i]);

    long long vmax = *max_element(v.begin(), v.end()), vmin = *min_element(v.begin(), v.end());
    double nguong = vmax - a * (double)(vmax - vmin) / 100.0;

    int soA = 0;
    double tongA = 0;
    for (long long x : v)
        if (100 * x >= 100 * vmax - a * (vmax - vmin)) { soA++; tongA += x; }   // so sánh số nguyên, không sai số

    vector<long long> sx = v;
    sort(sx.rbegin(), sx.rend());                       // kiểu B chỉ dùng thứ hạng
    int soB = min(k, n);
    double tongB = 0;
    for (int i = 0; i < soB; i++) tongB += sx[i];

    printf("%.6f\n%d\n%.6f\n%d\n%.6f\n", nguong, soA, tongA / soA, soB, tongB / soB);
    return 0;
}
`
      },
      goiY: [
        "v_max và v_min lấy trên toàn bộ n giá trị — kể cả ngoại lai. Chính v_min kéo ngưỡng của kiểu A.",
        "So sánh v ≥ ngưỡng nên làm bằng số nguyên: 100·v ≥ 100·v_max − a·(v_max − v_min).",
        "RCL_B: sắp giảm dần rồi lấy min(k, n) phần tử đầu; trung bình của RCL_B không phụ thuộc ngoại lai."
      ]
    },
    {
      id: "grasp-chen-ship1",
      ten: "GRASP trên heuristic chèn cho ship hàng (P1)",
      doKho: 3,
      ref: "§3, §4.2, §5, §8",
      de: "P1: lưới 100×100, kho (50,50), `n = 120` đơn, ngày 480 phút, không cần quay về. Cài **GRASP trên heuristic chèn rẻ nhất** (Bài 7): mỗi lần khởi động xây một tuyến bằng chèn, nhưng ở mỗi bước thay vì chọn cặp tốt nhất, hãy lập **RCL kiểu B** gồm `k` đơn có giá trị ròng `p − λ·Δt` cao nhất (mỗi đơn dùng vị trí chèn có Δt nhỏ nhất và còn vừa giờ), rồi bốc ngẫu nhiên một đơn trong RCL và chèn.\n\n" +
          "Ngân sách tính bằng **số vòng lặp**, không bằng đồng hồ: đúng **N = 40 lần khởi động** với `λ = 10` cố định — lần 0 tất định (k = 1) để GRASP không bao giờ tệ hơn chèn thường, 39 lần sau dùng `k = 3` — và giữ tuyến nhiều tiền nhất. Tạo bộ sinh số **một lần** ngoài vòng lặp (`rng(12345)` trong JS, `mt19937` trong C++; §8 cạm bẫy 3) và nhớ biến `best` (cạm bẫy 4).\n\n" +
          "**Mức đạt:** hợp lệ → bằng chèn tất định (λ = 10) → hơn chèn tất định 3 % → đạt 95 % lời giải mạnh (chèn + phá-sửa) của khoá. Bảng so sánh bên dưới cho biết chênh lệch trung bình so với chèn tất định kèm SE và cờ “có ý nghĩa” (2·SE, Bài 4).\n\n" +
          "Khi đã qua, thử và trả lời: (1) k = 1 cho kết quả gì, vì sao (Bài tập 8.2)? (2) Thử k = 2, 5, 10: điểm ngọt nằm ở đâu (§5.2)? (3) Dùng `log()` in điểm trung bình của **một lần chạy** và điểm tốt nhất trong 40 lần: μ tụt, cực đại tăng (§2.1) — đúng hay không? (4) Đổi nền từ chèn sang greedy nối cuối (chỉ số `p/(c + 1)`), 40 lần ngẫu nhiên, **không** giữ lần tất định: với k = 3 kết quả chỉ quanh mức greedy tỉ số (bảng §4.2: −0,01 %), với k = 4 còn kém hơn — hãy tự đo, rồi thử k = 2. Kết luận “GRASP trên nền yếu vô dụng” phụ thuộc vào điều gì?",
      vanDe: "b08-ship1",
      tham: { n: 120 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 2000,
      muc: [
        { ten: "Bằng chèn tất định (λ = 10)", so: "chen", heSo: 1 },
        { ten: "Hơn chèn tất định 3 %", so: "chen", heSo: 1.03 },
        { ten: "Đạt 95 % lời giải mạnh (chèn + phá-sửa)", so: "tot", heSo: 0.95 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: "n T", rồi toạ độ kho "kx ky", rồi n dòng "x y p s".
// Đầu ra : dòng 1 là k (số đơn giao), dòng 2 là k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}
x.push(kx); y.push(ky);                     // coi kho là nút số n: mọi khoảng cách tra cùng một bảng D
const N1 = n + 1, D = new Int32Array(N1 * N1);
for (let a = 0; a < N1; a++) for (let b = 0; b < N1; b++) D[a * N1 + b] = Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

const rnd = rng(12345);     // tạo MỘT lần, ngoài mọi vòng lặp

// Xây MỘT lời giải bằng chèn rẻ nhất với chỉ số p − lam·Δt; mỗi bước bốc ngẫu nhiên trong RCL = top-k đơn.
// k = 1 ⇒ chèn tất định. Trả về { tuyen: [chỉ số 0-based theo thứ tự ghé], tien }.
function xayDung(lam, k) {
  const tuyen = [];
  const daDung = new Array(n).fill(false);
  let tg = 0, tien = 0;
  // TODO: lặp — với mỗi đơn j chưa dùng, tìm vị trí chèn có Δt nhỏ nhất mà tg + Δt <= T
  //       (Δt = D[a][j] + s[j] + (có b ? D[j][b] − D[a][b] : 0); a = n (kho) khi vị trí = 0).
  //       Lập danh sách {j, vị trí, Δt, v = p[j] − lam·Δt}, sắp giảm dần theo v,
  //       chọn ngẫu nhiên trong top-k bằng rnd.int(Math.min(k, danhSach.length)),
  //       chèn bằng tuyen.splice(vị trí, 0, j); dừng khi danh sách rỗng.
  return { tuyen, tien };
}

// TODO: GRASP — đúng 40 lần khởi động: lần 0 tất định (k = 1), 39 lần sau với k = 3. Giữ lời giải tốt nhất.
let best = xayDung(10, 1);

print(best.tuyen.length);
print(best.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;
vector<vector<int>> D;      // D[a][b]: khoảng cách Manhattan; kho là nút số n

mt19937 rnd(12345);         // tạo MỘT lần, ngoài mọi vòng lặp

// Xây MỘT lời giải bằng chèn rẻ nhất với chỉ số p − lam·Δt; mỗi bước bốc ngẫu nhiên trong RCL = top-k đơn.
// k = 1 ⇒ chèn tất định. Trả về tuyến (chỉ số 0-based theo thứ tự ghé), gán tien.
vector<int> xayDung(double lam, int k, long long &tien) {
    vector<int> tuyen;
    vector<bool> daDung(n, false);
    int tg = 0;
    tien = 0;
    // TODO: lặp — với mỗi đơn j chưa dùng, tìm vị trí chèn có Δt nhỏ nhất mà tg + Δt <= T
    //       (Δt = D[a][j] + s[j] + (có b ? D[j][b] − D[a][b] : 0); a = n (kho) khi vị trí = 0).
    //       Lập danh sách {v, j, vị trí, Δt}, sắp giảm dần theo v,
    //       chọn ngẫu nhiên trong top-k bằng rnd() % min(k, danhSach.size()),
    //       chèn bằng tuyen.insert(tuyen.begin() + vị trí, j); dừng khi danh sách rỗng.
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n + 1); y.resize(n + 1); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    x[n] = kx; y[n] = ky;
    D.assign(n + 1, vector<int>(n + 1));
    for (int a = 0; a <= n; a++) for (int b = 0; b <= n; b++) D[a][b] = abs(x[a] - x[b]) + abs(y[a] - y[b]);

    // TODO: GRASP — đúng 40 lần khởi động: lần 0 tất định (k = 1), 39 lần sau với k = 3. Giữ lời giải tốt nhất.
    long long tien = 0;
    vector<int> best = xayDung(10, 1, tien);

    printf("%d\n", (int)best.size());
    for (size_t i = 0; i < best.size(); i++) printf("%d%c", best[i] + 1, i + 1 < best.size() ? ' ' : '\n');
    if (best.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}
x.push(kx); y.push(ky);                       // coi kho là nút số n: mọi khoảng cách tra cùng một bảng D
const N1 = n + 1, D = new Int32Array(N1 * N1);
for (let a = 0; a < N1; a++) for (let b = 0; b < N1; b++) D[a * N1 + b] = Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

const rnd = rng(12345);                       // MỘT lần, ngoài vòng lặp (cạm bẫy 3)

function xayDung(lam, k) {
  const tuyen = [];
  const daDung = new Array(n).fill(false);
  let tg = 0, tien = 0;
  for (;;) {
    const ds = [];                            // mỗi đơn chưa dùng: vị trí chèn có Δt nhỏ nhất còn vừa giờ
    for (let j = 0; j < n; j++) {
      if (daDung[j]) continue;
      let dtMin = Infinity, kMin = -1;
      for (let v = 0; v <= tuyen.length; v++) {
        const a = v === 0 ? n : tuyen[v - 1];                         // n = kho
        let dt = D[a * N1 + j] + s[j];
        if (v < tuyen.length) { const b = tuyen[v]; dt += D[j * N1 + b] - D[a * N1 + b]; }   // có nút sau
        if (dt < dtMin) { dtMin = dt; kMin = v; }
      }
      if (tg + dtMin > T) continue;
      ds.push({ j, vt: kMin, dt: dtMin, v: p[j] - lam * dtMin });
    }
    if (!ds.length) break;
    ds.sort((a, b) => b.v - a.v || a.j - b.j);                        // RCL kiểu B: top-k theo thứ hạng
    const ch = ds[k > 1 ? rnd.int(Math.min(k, ds.length)) : 0];
    tuyen.splice(ch.vt, 0, ch.j);
    daDung[ch.j] = true; tg += ch.dt; tien += p[ch.j];
  }
  return { tuyen, tien };
}

let best = xayDung(10, 1);                    // lần 0: tất định — GRASP không bao giờ tệ hơn chèn thường
for (let it = 1; it < 40; it++) {             // ngân sách = số vòng lặp, không dùng đồng hồ
  const r = xayDung(10, 3);
  if (r.tien > best.tien) best = r;           // luôn giữ nghiệm tốt nhất (cạm bẫy 4)
}
print(best.tuyen.length);
print(best.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;
vector<vector<int>> D;                       // D[a][b]: khoảng cách Manhattan; kho là nút số n

mt19937 rnd(12345);                          // MỘT lần, ngoài vòng lặp (cạm bẫy 3)

struct UngVien { double v; int j, vt, dt; };

vector<int> xayDung(double lam, int k, long long &tien) {
    vector<int> tuyen;
    vector<bool> daDung(n, false);
    int tg = 0;
    tien = 0;
    for (;;) {
        vector<UngVien> ds;                  // mỗi đơn chưa dùng: vị trí chèn có Δt nhỏ nhất còn vừa giờ
        for (int j = 0; j < n; j++) {
            if (daDung[j]) continue;
            int dtMin = INT_MAX, kMin = -1;
            for (int v = 0; v <= (int)tuyen.size(); v++) {
                int a = v == 0 ? n : tuyen[v - 1];                      // n = kho
                int dt = D[a][j] + s[j];
                if (v < (int)tuyen.size()) { int b = tuyen[v]; dt += D[j][b] - D[a][b]; }   // có nút sau
                if (dt < dtMin) { dtMin = dt; kMin = v; }
            }
            if (tg + dtMin > T) continue;
            ds.push_back({p[j] - lam * dtMin, j, kMin, dtMin});
        }
        if (ds.empty()) break;
        sort(ds.begin(), ds.end(), [](const UngVien &a, const UngVien &b) {
            if (a.v != b.v) return a.v > b.v;                           // RCL kiểu B: top-k theo thứ hạng
            return a.j < b.j;
        });
        int m = k > 1 ? (int)min<size_t>(k, ds.size()) : 1;
        const UngVien &ch = ds[k > 1 ? rnd() % m : 0];
        tuyen.insert(tuyen.begin() + ch.vt, ch.j);
        daDung[ch.j] = true; tg += ch.dt; tien += p[ch.j];
    }
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n + 1); y.resize(n + 1); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    x[n] = kx; y[n] = ky;
    D.assign(n + 1, vector<int>(n + 1));
    for (int a = 0; a <= n; a++) for (int b = 0; b <= n; b++) D[a][b] = abs(x[a] - x[b]) + abs(y[a] - y[b]);

    long long tienBest;
    vector<int> best = xayDung(10, 1, tienBest);   // lần 0: tất định — GRASP không bao giờ tệ hơn chèn thường
    for (int it = 1; it < 40; it++) {              // ngân sách = số vòng lặp, không dùng đồng hồ
        long long tien;
        vector<int> r = xayDung(10, 3, tien);
        if (tien > tienBest) { tienBest = tien; best = r; }   // luôn giữ nghiệm tốt nhất (cạm bẫy 4)
    }

    printf("%d\n", (int)best.size());
    for (size_t i = 0; i < best.size(); i++) printf("%d%c", best[i] + 1, i + 1 < best.size() ? ' ' : '\n');
    if (best.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Với mỗi đơn j, vị trí chèn tốt nhất chính là vị trí có Δt nhỏ nhất (vì v = p − λ·Δt giảm theo Δt); đơn nào mà vị trí đó vẫn vượt giờ thì bỏ khỏi danh sách.",
        "Sắp danh sách giảm dần theo v rồi bốc chỉ số trong [0, min(k, độ dài)) — đó là RCL kiểu B. Nhớ phá hoà bằng chỉ số đơn nhỏ hơn để k = 1 tất định.",
        "Tạo bộ sinh số một lần ngoài vòng 40 lần; lần 0 gọi với k = 1; sau mỗi lần nhớ so tiền với best và cập nhật nếu tốt hơn (đừng trả về lần chạy cuối)."
      ]
    }
  ]
});
