/* Thực hành — Bài 6: Giá mờ (shadow price) λ. */

// Bài toán tự dựng (tiền tố b06-): tính giá mờ λ* và cận Lagrange L(λ) của một cái túi.
// stdin : n B / n dòng "p c"        stdout: λ*, L(λ*/2), L(λ*), L(2λ*)
(function () {
  function thuTuTiSo(p, c) {                      /* chỉ số các món theo p/c giảm dần (nhân chéo, hoà thì chỉ số nhỏ trước) */
    var o = [];
    for (var i = 0; i < p.length; i++) o.push(i);
    return o.sort(function (a, b) { return p[b] * c[a] - p[a] * c[b] || a - b; });
  }
  function lamSao(inst) {                         /* p/c của món biên; 0 nếu mọi món đều vừa */
    var o = thuTuTiSo(inst.p, inst.c), con = inst.B;
    for (var k = 0; k < o.length; k++) {
      var j = o[k];
      if (inst.c[j] > con) return inst.p[j] / inst.c[j];
      con -= inst.c[j];
    }
    return 0;
  }
  function canL(inst, lam) {                      /* L(λ) = λ·B + Σ max(0, p − λ·c) */
    var s = lam * inst.B;
    for (var j = 0; j < inst.n; j++) s += Math.max(0, inst.p[j] - lam * inst.c[j]);
    return s;
  }
  TH.vande.dangKy("b06-lambda-tui", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), n = tham.n || 12, p = [], c = [], tongC = 0, i;
      for (i = 0; i < n; i++) { c.push(r.khoang(5, 40)); p.push(r.khoang(20, 200)); tongC += c[i]; }
      var B;
      if (tham.tyLe >= 1) B = tongC + r.khoang(1, 20);          /* dồi dào: mọi món đều vừa */
      else {
        B = Math.max(5, Math.floor(tongC * (tham.tyLe || 0.3)));
        var pre = {}, cum = 0;                                  /* tránh B trùng tổng tích luỹ (món biên mơ hồ) */
        thuTuTiSo(p, c).forEach(function (j) { cum += c[j]; pre[cum] = 1; });
        while (pre[B]) B++;
      }
      return { n: n, B: B, p: p, c: c };
    },
    viet: function (inst) {
      var s = inst.n + " " + inst.B + "\n";
      for (var i = 0; i < inst.n; i++) s += inst.p[i] + " " + inst.c[i] + "\n";
      return s;
    },
    giai: function (inst) {
      var l = lamSao(inst);
      return [l, canL(inst, l / 2), canL(inst, l), canL(inst, 2 * l)];
    },
    saiSo: 0.001,
    dinhDang: {
      vao: "Dòng 1: `n B` — số món và ngân sách. Tiếp theo `n` dòng, dòng `j` là `p c` — lợi ích và chi phí (số nguyên dương) của món `j`.",
      ra: "Bốn số, mỗi số một dòng: `λ*`, `L(λ*/2)`, `L(λ*)`, `L(2λ*)`. Số thực in tuỳ ý (sai số cho phép 0,001)."
    }
  }));
})();

TH.dangKy({
  id: "bai-06-gia-mo",

  tomTat: [
    "Giá mờ λ là **tỉ giá quy đổi** giữa tài nguyên và điểm: một đơn vị tài nguyên (phút, kg…) đáng λ điểm. Nhờ nó, tiền và thời gian cộng trừ được — điều mà phép chia p/c không làm nổi.",
    "Giá trị ròng của một ứng viên là v = p − λ·c. v > 0 → đáng nhận; v < 0 → không đáng; v = 0 → món biên. Số hạng λ·c là **chi phí cơ hội** (giá của thứ tốt nhất phải bỏ), không phải tiền trả ra.",
    "λ* chính là tỉ số p/c của **món biên** — món đầu tiên không còn vừa khi nhặt theo tỉ số giảm dần. Tỉ số cho **thứ tự**, giá mờ cho **ngưỡng cắt**: hai thứ bổ sung nhau, không thay nhau.",
    "L(λ) = λ·B + Σ max(0, p_j − λ·c_j) là **cận trên** của tối ưu với **mọi** λ ≥ 0, kể cả chọn bừa; λ* cho cận chặt nhất. Ví dụ B = 100: L(120) = 16 740, còn nghiệm 0/1 tốt nhất là 14 700.",
    "Ba cách ước lượng λ: công thức LP (nhanh, nhưng thường lệch cao — 142,2 so với 80 tốt nhất cho chèn), tìm kiếm nhị phân, và **quét thực nghiệm** (bền nhất, dùng để chốt).",
    "λ-greedy **không** thắng tỉ số-greedy (60 616 so với 61 420) vì greedy luôn lấp đầy ngày, không bao giờ dùng đến ngưỡng. λ toả sáng ở chèn và local search, nơi chi phí là Δt có thể gần 0: chèn với λ = 0 chỉ được 40 220, với λ = 80 được 63 920 (số đo riêng của Bài 6; số 65 425 ở Bài 7 dùng λ đã hiệu chuẩn lại ≈ 88 — cùng bộ 60 test, kết quả nhạy với λ, đừng so trực tiếp).",
    "Một phút bỏ phí không đáng 200 điểm thưởng OT mà đáng λ ≈ 1 420 điểm (chênh 7,1 lần): thêm số hạng phạt −λ·w (w = phút chết) vào hàm mục tiêu ép lời giải lấp đầy ngày — bài giảng ghi nhận +2,43 % điểm (ablation riêng số hạng phạt trên bản đầy đủ).",
    "Đừng dùng λ làm ngưỡng cứng khi ngân sách còn dư (vẫn nhận ứng viên có v lớn nhất trong số còn vừa); mỗi thuật toán và mỗi test có λ tốt riêng (khan hiếm → λ cao). Dùng dạng phạt để **tìm kiếm**, dạng ràng buộc để **nghiệm thu**."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§ Bài này nói về chuyện gì",
      hoi: "Sếp nhắn: “làm thêm 3 tiếng tối nay, trả thêm 300 nghìn”. Theo bài giảng, quyết định nhận hay không thực chất phụ thuộc vào đâu?",
      chon: [
        "Vào số tiền 300 nghìn: càng nhiều càng nên nhận",
        "Vào số giờ phải làm thêm: càng ít càng nên nhận",
        "Vào tỉ giá riêng của bạn giữa thời gian và tiền — ba tiếng của bạn đáng bao nhiêu",
        "Vào việc đồng nghiệp có làm thêm hay không"
      ],
      dung: 2,
      giaiThich: "Cùng một lời đề nghị cho ba câu trả lời khác nhau: tối rảnh thì nhận, tối sinh nhật con thì từ chối, có việc khác 150 nghìn/giờ thì cũng từ chối. Thứ quyết định không nằm trong lời đề nghị mà là giá trị ba tiếng của bạn — đó là giá mờ λ. Số tiền hay số giờ xét riêng lẻ đều không đủ để quyết định, và đồng nghiệp không liên quan."
    },
    {
      id: "q2", loai: "so", doKho: 2, ref: "§2, Bài tập 6.2", donVi: "(đồng)",
      hoi: "Một ngôi nhà trả 250 000 đồng, mất 180 phút vệ sinh và cách vị trí hiện tại 12 phút di chuyển. Với λ = 1 420 đồng/phút, giá trị ròng v = p − λ·c là bao nhiêu? (Gợi ý: chi phí c gồm cả di chuyển.)",
      dapAn: -22640, saiSo: 0,
      giaiThich: "c = 12 + 180 = 192 phút; λ·c = 1 420 × 192 = 272 640; v = 250 000 − 272 640 = −22 640 < 0, nên không đáng nếu còn lựa chọn khác. Với λ = 1 250 thì v = 250 000 − 240 000 = +10 000 > 0. Tỉ số 250 000/192 ≈ 1 302 nằm giữa hai ngưỡng ấy: ngôi nhà này là loại “biên”."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "§7.2", donVi: "(điểm)",
      hoi: "Cuối ngày bạn còn dư 70 phút mà không ngôi nhà nào vừa. Thưởng làm thêm (OT) là 200 điểm/phút, còn giá mờ của một phút trong bài là λ ≈ 1 420 điểm. Thiệt hại thật của 70 phút bỏ phí, tính theo giá mờ, là bao nhiêu điểm?",
      dapAn: 99400, saiSo: 0,
      giaiThich: "70 × 1 420 = 99 400 điểm. Cách nghĩ của người mới (chỉ tính tiền thưởng OT) cho 70 × 200 = 14 000 — thấp hơn 7,1 lần, vì phần lớn giá trị một phút nằm ở tiền công vệ sinh chứ không ở thưởng OT (200). λ ≈ 1 420 là giá trị thực nghiệm (loại máy biên theo lý thuyết ≈ 1 367, chưa tính thưởng OT); cách tách “1 220 + 200” chỉ là cách nhớ trực giác. Phút bỏ phí vẫn có giá, đúng bằng λ."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§3.2 (3), §4",
      hoi: "Dùng bảng 5 công việc của bài giảng (A: p = 6 000, c = 30; B: 4 500, 25; C: 4 200, 28; D: 2 400, 20; E: 1 000, 20) nhưng với ngân sách B = 110 phút. Giá mờ λ* bằng bao nhiêu?",
      dapAn: 50, saiSo: 0,
      giaiThich: "Tỉ số p/c: A 200, B 180, C 150, D 120, E 50. Nhặt A + B + C + D = 30 + 25 + 28 + 20 = 103 phút, còn 7; E cần 20 nên chỉ lấy được 7/20 phần ⇒ món biên là **E**, λ* = 1 000/20 = 50. Kiểm tra: v_D = 2 400 − 50·20 = +1 400 > 0 và v_E = 0. Đừng nhầm với λ* = 120 của B = 100, nơi D là món biên."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§3.2 (1)",
      hoi: "Bạn chọn λ = 70 “cho đẹp”, không tính toán gì, rồi tính L(λ) = λ·B + Σ max(0, p_j − λ·c_j) cho cái túi 0/1. Điều gì luôn đúng?",
      chon: [
        "L(70) chỉ là cận trên nếu 70 đúng bằng λ*",
        "L(70) ≥ giá trị tối ưu của bài gốc — với mọi λ ≥ 0, chọn bừa vẫn là cận trên",
        "L(70) luôn nhỏ hơn giá trị tối ưu vì ta đã nới lỏng ràng buộc",
        "L(70) bằng đúng giá trị tối ưu của bài gốc"
      ],
      dung: 1,
      giaiThich: "Với mọi nghiệm hợp lệ x ta có B − Σ c·x ≥ 0 nên λ·(B − Σ c·x) ≥ 0, suy ra Σ p·x + λ·(B − Σ c·x) ≥ f(x). L(λ) là cực đại của vế trái trên mọi x nên ≥ f(x), kể cả nghiệm tối ưu — đúng với mọi λ ≥ 0. Chọn λ khéo (λ*) chỉ làm cận chặt hơn chứ không làm nó “đúng hơn”. Nới lỏng làm bài dễ hơn nên giá trị không bao giờ nhỏ hơn; nó cũng thường lớn hơn tối ưu 0/1 (ví dụ 16 740 so với 14 700)."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§6.4",
      hoi: "Trường hợp nào nên dùng giá trị ròng p − λ·c thay vì tỉ số p/c? Chọn mọi ý đúng.",
      chon: [
        "Chi phí là một Δ (phần tăng thêm) có thể rất nhỏ, thậm chí gần 0",
        "Cần cộng các giá trị lại, như hàm mục tiêu của local search, beam search, LNS",
        "Cần định giá tài nguyên bị bỏ phí, như phút dư cuối ngày",
        "Chỉ cần xếp hạng các ứng viên cùng loại có chi phí ổn định, như greedy nối cuối ở Bài 5",
        "Cần một cận trên cho bài toán"
      ],
      dung: [0, 1, 2, 4],
      giaiThich: "Tỉ số chỉ cho thứ tự và rất ổn khi chi phí ổn định (greedy nối cuối: c = d + s luôn dương và khá lớn) — đó là đất của tỉ số, nên ý còn lại sai. Giá mờ hơn ở bốn chỗ: chi phí delta có thể rất nhỏ (ở P1 vẫn ≥ s_j nên chưa bùng nổ, nhưng bài không có thời gian phục vụ thì p/Δt → ∞); giá trị ròng **cộng được**; định giá được thời gian chết (tỉ số không có gì để nói về việc KHÔNG chọn gì); và cho cận trên L(λ) (Bài 18)."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§6.2 (d), §6.3",
      hoi: "Đo trên P1 (60 test): greedy dùng chỉ số p − λ·c với λ tốt nhất cho 60 616 điểm, còn greedy theo tỉ số p/c cho 61 420. Vì sao λ — công cụ “mạnh hơn” — không thắng?",
      chon: [
        "Vì cài đặt λ-greedy luôn có lỗi nên điểm bị trừ",
        "Vì λ chỉ dùng được cho bài cái túi, không dùng được cho P1",
        "Vì λ luôn phải bằng 0 trong P1",
        "Vì greedy luôn lấp đầy ngày nên không bao giờ hỏi “có đáng nhận không?” — phần ngưỡng của λ bị bỏ không, chỉ còn phần thứ tự mà tỉ số đã làm rất tốt"
      ],
      dung: 3,
      giaiThich: "p/c > λ ⇔ p − λ·c > 0: tỉ số cho thứ tự, λ cho ngưỡng. Greedy P1 nhận ứng viên tốt nhất tới khi hết giờ và không bao giờ tự nguyện dừng sớm, nên câu hỏi “đáng nhận không?” chưa từng được hỏi. Bài học: công cụ mạnh hơn chỉ tốt hơn khi bài toán cần đúng phần mạnh hơn đó. Các phương án khác sai: λ-greedy chạy bình thường (đường cong có đỉnh 60 616), λ dùng được cho P1, và λ = 0 chính là greedy tiền nhất (thảm hoạ −38 %)."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "§6.3–6.4",
      hoi: "Trong heuristic chèn trên P1, λ = 0 cho 40 220 điểm còn λ = 80 cho 63 920 (greedy tỉ số: 61 420). Vì sao chèn “cần” λ để chạy tốt?",
      chon: [
        "Chèn chấm điểm bằng p − λ·Δt: với λ = 0 thời gian thành miễn phí, thuật toán chỉ nhìn tiền; có λ thì Δt (phần tăng thêm, có thể rất nhỏ) được quy ra điểm cộng trừ được",
        "Vì chèn chạy lâu hơn greedy nên cần λ để rút ngắn thời gian chạy",
        "Vì λ làm tăng số vị trí chèn được xét ở mỗi bước",
        "Vì λ = 0 vi phạm bất đẳng thức tam giác"
      ],
      dung: 0,
      giaiThich: "Với λ = 0, chỉ số p − 0·Δt = p: thuật toán không còn để ý thời gian, nên sụp đổ (40 220, thấp hơn cả greedy tỉ số). Với λ đúng, Δt được quy ra điểm và hai đại lượng cộng trừ được: một đơn tiện đường (đi vòng gần 0) trở nên rẻ, một đơn đi vòng xa bị trừ nặng. λ không đổi số vị trí xét (luôn là độ dài tuyến + 1), không liên quan tốc độ, và không liên quan bất đẳng thức tam giác."
    },
    {
      id: "q9", loai: "mot", doKho: 2, ref: "§5.3, §9 (cạm bẫy 1–2)",
      hoi: "Công thức LP cho λ = 142,2, nhưng quét thực nghiệm cho thấy heuristic chèn đạt điểm cao nhất ở λ = 80 (lệch 78 %). Bạn nên làm gì khi cài đặt?",
      chon: [
        "Dùng LP để ước lượng ban đầu, rồi hiệu chuẩn bằng quét vài giá trị λ và chốt giá trị tốt nhất",
        "Dùng thẳng λ = 142,2 vì lý thuyết luôn đúng hơn thực nghiệm",
        "Cố định λ = 80 cho mọi thuật toán và mọi test",
        "Bỏ λ, quay về tỉ số"
      ],
      dung: 0,
      giaiThich: "LP bỏ qua chi phí di chuyển thực tế nên thường lệch cao. Quét khoảng 7 giá trị tốn chừng 0,8 ms nhưng luôn đúng, kể cả khi lý thuyết lệch (§5.3). Cố định một λ cho mọi thuật toán và mọi test là cạm bẫy 2 và 3: mỗi thuật toán (greedy ≈ 100, chèn ≈ 80) và mỗi test (độ khan hiếm tài nguyên) có λ tốt riêng. Bỏ λ thì mất lợi thế +4,1 % của chèn."
    },
    {
      id: "q10", loai: "mot", doKho: 3, ref: "§9 (cạm bẫy 4)",
      hoi: "Greedy dùng giá mờ đang ở bước mà mọi ứng viên còn vừa giờ đều có v = p − λ·c < 0, trong khi ngày còn 90 phút. Cách làm đúng là gì?",
      chon: [
        "Dừng ngay vì không còn ứng viên đáng nhận (v < 0)",
        "Giảm λ về 0 rồi chạy lại từ đầu",
        "Chọn ứng viên có c nhỏ nhất, bất kể v",
        "Chọn ứng viên có v lớn nhất trong số còn vừa ngân sách và tiếp tục"
      ],
      dung: 3,
      giaiThich: "Ngưỡng cứng v > 0 chỉ có nghĩa khi tài nguyên thật sự khan hiếm. Khi thời gian còn thừa, phần thừa vô giá trị mà lợi ích p luôn dương, nên nhận thêm vẫn có lời; v < 0 chỉ cho biết ứng viên này kém, không cho biết nên bỏ trống. (Chính lỗi này làm chenReNhat ban đầu trong lab chỉ nhận được 0,2 đơn.) Đặt λ về 0 phá thứ hạng; chọn c nhỏ nhất bất kể v bỏ phí lợi ích."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 6.1",
      hoi: "Với bảng 5 công việc ở §4 (A: 6 000 điểm/30 phút, B: 4 500/25, C: 4 200/28, D: 2 400/20, E: 1 000/20) nhưng ngân sách B = 60 phút, hãy tính λ*, cho biết việc nào được nhận nguyên, và tính cận trên L(λ*).",
      goiY: ["Sắp theo p/c rồi nhặt tới khi gặp việc không còn vừa nguyên vẹn.", "L(λ) = λ·B + Σ max(0, p − λ·c); chỉ các việc có v > 0 đóng góp vào tổng."],
      mau: "Tỉ số p/c: A 200, B 180, C 150, D 120, E 50. Nhặt A (30 phút) → còn 30; B (25) → còn 5; C cần 28 nhưng chỉ còn 5 nên chỉ lấy được 5/28 phần ⇒ món biên là **C**, λ* = 4 200/28 = **150**.\n\n- Giá trị ròng: v_A = 6 000 − 150·30 = +1 500; v_B = 4 500 − 150·25 = +750; v_C = 0; v_D = 2 400 − 3 000 = −600; v_E = 1 000 − 3 000 = −2 000. Nhận nguyên **A và B** (55 phút, 10 500 điểm).\n- Cận trên: L(150) = 150·60 + 1 500 + 750 = **11 250** (= 10 500 + 5/28 × 4 200). Nghiệm 0/1 tối ưu ở đây là A + B = 10 500, thấp hơn cận trên.\n- So với B = 100 (λ* = 120): ngân sách khan hơn thì giá mờ cao hơn.",
      tieuChi: ["Sắp đúng theo tỉ số, nhặt A và B rồi nhận ra C chỉ lấy được 5/28 phần", "Chỉ ra món biên là C và λ* = 4 200/28 = 150 (không phải 120)", "Tính được giá trị ròng (A +1 500, B +750, C 0, D −600, E −2 000) hoặc nêu A, B được nhận nguyên", "Tính L(150) = 11 250 hoặc nhận xét ngân sách nhỏ hơn thì λ* lớn hơn"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 6.3, 6.5, §9 (cạm bẫy 3)",
      hoi: "(a) Chạy lab với 120 đơn rồi với 240 đơn trong cùng 480 phút: λ tối ưu thay đổi thế nào? Giải thích bằng “độ khan hiếm tài nguyên”. (b) Với bài 5 ngày liên tiếp, bạn có nên dùng cùng một λ cho cả 5 ngày không? Dự đoán chiều thay đổi và nêu cách kiểm chứng.",
      goiY: ["Nhiều ứng viên hơn cho cùng một ngân sách thì ngân sách dễ hay khó dùng “vào việc tốt” hơn?", "Sau ngày 1, các đơn tốt nhất đã bị lấy: các đơn còn lại có tỉ số cao hay thấp?"],
      mau: "(a) Gấp đôi số đơn (cùng 480 phút) ⇒ tài nguyên **khan hiếm hơn**: nhiều lựa chọn tranh nhau cùng ngân sách, chỉ những đơn tốt nhất được nhận, nên món biên có tỉ số cao hơn ⇒ **λ tăng**. Tài liệu đo được cỡ 88 → 110–120. Chiều ngược lại cũng đúng: số đơn giảm một nửa thì λ giảm (§9, cạm bẫy 3). Hệ quả: tính λ **riêng cho từng test**.\n\n(b) Không nên giống nhau. Sau khi các đơn tốt đã bị lấy ở các ngày trước, các đơn còn lại có tỉ số thấp hơn ⇒ ngưỡng chấp nhận λ **giảm dần** theo ngày — ngược với trực giác “ngày sau gấp hơn”. Thí nghiệm: giữ mọi thứ khác, thay λ cố định bằng λ_d = λ₀·(1 − 0,05·d) (d = chỉ số ngày), chạy cùng seed và cùng số test rồi so điểm trung bình theo ngưỡng 2·SE (Bài 4). Tài liệu báo cải thiện cỡ 0,3–0,8 %, nghĩa là phải đủ nhiều test mới thấy được.",
      tieuChi: ["Nói đúng chiều: nhiều đơn hơn ⇒ khan hiếm hơn ⇒ λ tăng", "Giải thích bằng khái niệm khan hiếm / dồi dào của tài nguyên", "Với 5 ngày: dự đoán λ giảm dần (đơn tốt đã bị lấy), không phải tăng", "Nêu thí nghiệm có đối chứng (cùng seed, cùng số test) và so với 2·SE"]
    },
    {
      id: "l3", doKho: 3, ref: "§6.3, §6.4",
      hoi: "Giải thích bằng lời của bạn: (a) vì sao greedy dùng λ không thắng greedy dùng tỉ số trên P1; (b) vì sao heuristic chèn lại cần λ (λ = 0 làm chèn sụp đổ). Rồi nêu quy tắc chọn giữa p/c và p − λ·c.",
      goiY: ["Nhớ p/c > λ ⇔ p − λ·c > 0: mỗi chỉ số mang thông tin gì?", "Chi phí của greedy là d + s; chi phí của chèn là gì, và nó có thể nhỏ đến mức nào?"],
      mau: "(a) p/c > λ ⇔ p − λ·c > 0. Tỉ số cho **thứ tự ưu tiên**, giá mờ cho **ngưỡng chấp nhận**. Greedy P1 luôn lấp đầy ngày — nhận ứng viên tốt nhất tới khi hết giờ, không bao giờ tự nguyện dừng sớm — nên câu hỏi “có đáng nhận không?” (việc của ngưỡng) không bao giờ được hỏi; chỉ còn câu “trong những cái còn vừa, cái nào trước?”, mà tỉ số đã trả lời rất tốt. Số đo: λ-greedy tốt nhất 60 616 so với tỉ số 61 420.\n\n(b) Trong chèn, chi phí là Δt = d(a,j) + d(j,b) − d(a,b) + s_j — phần tăng thêm, có thể rất nhỏ khi j nằm sát đường a → b. Cần một tỉ giá λ để quy Δt ra điểm ổn định (p − λ·Δt) và cộng trừ được. Với λ = 0 thời gian miễn phí, chỉ số thành p, thuật toán chỉ nhìn tiền ⇒ 40 220; với λ = 80 được 63 920 (+4,1 % so với tỉ số).\n\nQuy tắc: dùng **tỉ số** khi so sánh ứng viên cùng loại, chi phí ổn định (greedy nối cuối); dùng **giá mờ** khi chi phí là delta, khi cần cộng giá trị (local search, beam, LNS), khi định giá tài nguyên bỏ phí, hoặc khi cần cận trên.",
      tieuChi: ["Nêu quan hệ p/c > λ ⇔ p − λ·c > 0: tỉ số = thứ tự, λ = ngưỡng", "Giải thích greedy luôn lấp đầy ngày nên không dùng đến ngưỡng ⇒ λ-greedy không hơn tỉ số", "Nêu chi phí Δt của chèn là phần tăng thêm, có thể rất nhỏ, cần quy ra điểm bằng λ; λ = 0 làm chèn sụp đổ", "Phát biểu được quy tắc khi nào dùng tỉ số, khi nào dùng giá mờ"]
    },
    {
      id: "l4", doKho: 3, ref: "§7, §8",
      hoi: "An nói: “70 phút dư cuối ngày chỉ làm mất tiền thưởng OT 200 điểm/phút”. Bình nói: “mất λ ≈ 1 420 điểm/phút”. Ai đúng và vì sao? Sau đó nêu cách bạn dùng dạng phạt (có −λ·w) và dạng ràng buộc (Σ c·x ≤ B) trong một bài làm thật: cái nào để tìm kiếm, cái nào để nghiệm thu?",
      goiY: ["70 phút ấy lẽ ra làm được việc gì, và việc đó đáng bao nhiêu?", "Nghiệm tối ưu của dạng phạt có chắc tuân thủ ngân sách không?"],
      mau: "Bình đúng. Thiệt hại của một phút bỏ phí là **chi phí cơ hội**: giá trị của thứ tốt nhất lẽ ra làm được trong phút đó. 70 phút ấy lẽ ra dùng để vệ sinh máy; giá mờ λ ≈ 1 420 điểm/phút (giá trị thực nghiệm; loại máy biên theo lý thuyết ≈ 1 367, chưa tính thưởng OT) — phần lớn là tiền công vệ sinh chứ không phải 200 điểm thưởng OT (cách tách “1 220 + 200” chỉ là cách nhớ trực giác). Thiệt hại = 70 × 1 420 = 99 400 điểm chứ không phải 70 × 200 = 14 000 (chênh 7,1 lần). Tỉ số không làm được việc này vì nó chỉ so các lựa chọn với nhau, không định giá việc “không chọn gì”.\n\nDạng phạt (max Σ (p − λ·c)·x, không ràng buộc) dễ hơn vì các biến độc lập, giá trị cộng được và nghiệm vượt ngân sách chỉ bị trừ điểm — local search được phép đi qua vùng vi phạm. Vì vậy dùng nó để **tìm kiếm**. Nhưng dạng phạt chỉ tương đương dạng ràng buộc ở đúng λ*, và với bài nguyên vẫn còn khe hở đối ngẫu, nên nghiệm tối ưu của nó **có thể vi phạm ngân sách**. Do đó luôn dùng dạng ràng buộc ở bộ chấm để **nghiệm thu**.",
      tieuChi: ["Chọn đúng Bình và gọi tên chi phí cơ hội (giá của thứ tốt nhất bị bỏ lỡ)", "Tính được 70 × 1 420 = 99 400 và so với 14 000 (khoảng 7,1 lần)", "Nêu dạng phạt dùng để tìm kiếm (biến độc lập, cộng được, vi phạm chỉ bị trừ điểm)", "Nêu dạng ràng buộc dùng để nghiệm thu vì nghiệm dạng phạt có thể vượt ngân sách"]
    }
  ],

  lab: [
    {
      id: "gia-mo-tui",
      ten: "Tính giá mờ λ* và cận Lagrange cho cái túi",
      doKho: 1,
      ref: "§3.2, §4, Bài tập 6.1",
      de: "Cho cái túi gồm `n` món; món `j` có lợi ích `p` và chi phí `c` (đều nguyên dương), ngân sách là `B`. Hãy làm đúng ba việc của §3–§4:\n\n" +
          "1. Sắp các món theo `p/c` giảm dần, nhặt cho tới khi gặp **món biên** — món đầu tiên không còn vừa nguyên vẹn. Giá mờ λ* **bằng p/c của món biên**. Nếu mọi món đều vừa (ngân sách không bão hoà) thì λ* = 0.\n" +
          "2. Cài hàm cận Lagrange `L(λ) = λ·B + Σ max(0, p_j − λ·c_j)`.\n" +
          "3. In bốn số, mỗi số một dòng: λ*, L(λ*/2), L(λ*), L(2λ*).\n\n" +
          "Chấm trên 10 bộ dữ liệu (đúng cả bốn số ở mọi bộ mới qua). Sau khi qua, hãy đổi sang các kiểu dữ liệu bên dưới và trả lời: (1) trong ba giá trị L, giá trị nào nhỏ nhất và vì sao? (2) khi ngân sách *dồi dào* thì λ* và L bằng bao nhiêu — giá mờ của một tài nguyên thừa là gì? (3) L(λ*) có bằng giá trị của cái túi **phân số** không (kiểm bằng bảng 5 việc ở §4: L(120) = 16 740)?",
      vanDe: "b06-lambda-tui",
      tham: { n: 12, tyLe: 0.3 },
      bienThe: [
        { ten: "Khan hiếm (B ≈ 30 % tổng chi phí)", tham: { n: 12, tyLe: 0.3 } },
        { ten: "Vừa phải (B ≈ 60 %)", tham: { n: 12, tyLe: 0.6 } },
        { ten: "Dồi dào (mọi món đều vừa)", tham: { n: 12, tyLe: 1 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n B"; rồi n dòng "p c" (lợi ích, chi phí).
// Đầu ra : 4 số, mỗi số một dòng: lamSao, L(lamSao/2), L(lamSao), L(2*lamSao).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const p = [], c = [];
for (let i = 0; i < n; i++) { p.push(t[2 + 2 * i]); c.push(t[3 + 2 * i]); }

// TODO 1: sắp các món theo p/c giảm dần (so sánh bằng phép nhân chéo), nhặt cho tới khi
//         gặp món KHÔNG còn vừa nguyên vẹn. lamSao = p/c của món đó (0 nếu mọi món đều vừa).
let lamSao = 0;

// TODO 2: L(lam) = lam·B + Σ max(0, p_j − lam·c_j)
function L(lam) {
  return 0;
}

print(lamSao);
print(L(lamSao / 2));
print(L(lamSao));
print(L(2 * lamSao));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    long long B;
    scanf("%d %lld", &n, &B);
    vector<long long> p(n), c(n);
    for (int i = 0; i < n; i++) scanf("%lld %lld", &p[i], &c[i]);

    // TODO 1: sắp các món theo p/c giảm dần (so sánh bằng phép nhân chéo), nhặt cho tới khi
    //         gặp món KHÔNG còn vừa nguyên vẹn. lamSao = p/c của món đó (0 nếu mọi món đều vừa).
    double lamSao = 0;

    // TODO 2: L(lam) = lam·B + Σ max(0, p_j − lam·c_j)
    auto L = [&](double lam) {
        return 0.0;
    };

    printf("%.6f\n%.6f\n%.6f\n%.6f\n", lamSao, L(lamSao / 2), L(lamSao), L(2 * lamSao));
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const p = [], c = [];
for (let i = 0; i < n; i++) { p.push(t[2 + 2 * i]); c.push(t[3 + 2 * i]); }

// Sắp theo p/c giảm dần; p_a/c_a > p_b/c_b ⇔ p_a·c_b > p_b·c_a (không chia, không sai số).
const thuTu = p.map((_, i) => i).sort((a, b) => p[b] * c[a] - p[a] * c[b] || a - b);
let con = B, lamSao = 0;
for (const i of thuTu) {
  if (c[i] > con) { lamSao = p[i] / c[i]; break; }   // món biên: chỉ lấy được một phần
  con -= c[i];
}

function L(lam) {
  let s = lam * B;
  for (let j = 0; j < n; j++) s += Math.max(0, p[j] - lam * c[j]);
  return s;
}

print(lamSao.toFixed(6));
print(L(lamSao / 2).toFixed(6));
print(L(lamSao).toFixed(6));
print(L(2 * lamSao).toFixed(6));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    long long B;
    scanf("%d %lld", &n, &B);
    vector<long long> p(n), c(n);
    for (int i = 0; i < n; i++) scanf("%lld %lld", &p[i], &c[i]);

    // Sắp theo p/c giảm dần; p_a/c_a > p_b/c_b ⇔ p_a·c_b > p_b·c_a (không chia, không sai số).
    vector<int> thuTu(n);
    iota(thuTu.begin(), thuTu.end(), 0);
    sort(thuTu.begin(), thuTu.end(), [&](int a, int b) {
        long long l = p[a] * c[b], r = p[b] * c[a];
        if (l != r) return l > r;
        return a < b;
    });

    long long con = B;
    double lamSao = 0;
    for (int i : thuTu) {
        if (c[i] > con) { lamSao = (double)p[i] / c[i]; break; }   // món biên: chỉ lấy được một phần
        con -= c[i];
    }

    auto L = [&](double lam) {
        double s = lam * B;
        for (int j = 0; j < n; j++) s += max(0.0, p[j] - lam * c[j]);
        return s;
    };

    printf("%.6f\n%.6f\n%.6f\n%.6f\n", lamSao, L(lamSao / 2), L(lamSao), L(2 * lamSao));
    return 0;
}
`
      },
      goiY: [
        "So sánh p_a/c_a với p_b/c_b bằng phép nhân chéo p_a·c_b so với p_b·c_a — không cần chia.",
        "Trong lúc nhặt, giữ phần ngân sách còn lại; món biên là món đầu tiên có c lớn hơn phần còn lại. Nếu duyệt hết mà không gặp món biên thì λ* = 0.",
        "L(λ) chỉ cộng những món có p_j − λ·c_j > 0. Với λ = λ*, giá trị này phải bằng 'nghiệm nhặt theo tỉ số + phần lẻ của món biên' (cái túi phân số)."
      ]
    },
    {
      id: "greedy-lambda",
      ten: "Greedy p − λ·c cho ship hàng (P1) và quét λ",
      doKho: 2,
      ref: "§5.3, §6.1–6.3, §9",
      de: "P1: lưới 100×100, kho ở (50,50), `n = 120` đơn. Đơn `i` ở `(x, y)`, trả `p` đồng, giao mất `s` phút; đi `u → v` mất `|Δx| + |Δy|` phút; ngày có 480 phút, bắt đầu từ kho, **không cần quay về**.\n\n" +
          "Cài **greedy dùng giá mờ**: ở mỗi bước, trong các đơn **còn vừa giờ**, chọn đơn có `v = p − λ·c` lớn nhất, với `c = d + s` và `d` tính từ vị trí **hiện tại**. Kể cả khi mọi `v` đều âm, vẫn phải chọn đơn tốt nhất — đừng dừng sớm (§9, cạm bẫy 4).\n\n" +
          "Rồi **quét λ**: chạy greedy với nhiều giá trị λ trên **từng test** và giữ tuyến được nhiều tiền nhất (cách 3, §5.3). Thang điểm của bộ dữ liệu này khác bài giảng (`p` từ 100 đến 1 000, `s` từ 5 đến 30 phút), nên λ tốt nằm quanh 10–30 — **không phải** 80–100: hãy quét `λ = 2, 4, …, 60`.\n\n" +
          "**Mức đạt:** hợp lệ → gần bằng greedy tỉ số (≥ 97 %) → bằng greedy tỉ số → hơn greedy tỉ số 2 %. Khi đã qua, tự thử ba điều rồi trả lời: (1) λ = 0 cho kết quả giống greedy nào? (2) Một λ **cố định** (ví dụ 16) có thắng được tỉ số không — trên dữ liệu rải đều? trên dữ liệu gom cụm? (3) Quét λ theo từng test thắng nhờ λ “đúng hơn”, hay nhờ chọn kết quả tốt nhất trong nhiều lần chạy (hiệu ứng “cực đại của một mẫu”, Bài 8 §5.1)?",
      vanDe: "ship1",
      tham: { n: 120 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      muc: [
        { ten: "Gần bằng greedy theo tỉ số (≥ 97 %)", so: "tiSo", heSo: 0.97 },
        { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 },
        { ten: "Hơn greedy theo tỉ số 2 %", so: "tiSo", heSo: 1.02 }
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

// Greedy với chỉ số p − lam·c; trả về { tuyen: [chỉ số 0-based], tien }.
function greedy(lam) {
  const tuyen = [];
  let tien = 0;
  // TODO: lặp — trong các đơn chưa dùng mà còn vừa giờ (tg + c <= T), chọn đơn có
  //       v = p − lam·c lớn nhất, với c = d + s và d tính từ vị trí HIỆN TẠI.
  //       Dừng khi không đơn nào còn vừa (kể cả khi mọi v đều âm: vẫn phải nhận đơn tốt nhất).
  return { tuyen, tien };
}

// TODO: quét lam = 2, 4, ..., 60; giữ kết quả có tien lớn nhất.
let tot = greedy(16);

print(tot.tuyen.length);
print(tot.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;

// Greedy với chỉ số p − lam·c; trả về tuyến (chỉ số 0-based) và gán tien.
vector<int> greedy(double lam, long long &tien) {
    vector<int> tuyen;
    tien = 0;
    // TODO: lặp — trong các đơn chưa dùng mà còn vừa giờ (tg + c <= T), chọn đơn có
    //       v = p − lam·c lớn nhất, với c = d + s và d tính từ vị trí HIỆN TẠI.
    //       Dừng khi không đơn nào còn vừa (kể cả khi mọi v đều âm: vẫn phải nhận đơn tốt nhất).
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    // TODO: quét lam = 2, 4, ..., 60; giữ tuyến có tien lớn nhất.
    long long tien = 0;
    vector<int> tot = greedy(16, tien);

    printf("%d\n", (int)tot.size());
    for (size_t i = 0; i < tot.size(); i++) printf("%d%c", tot[i] + 1, i + 1 < tot.size() ? ' ' : '\n');
    if (tot.empty()) printf("\n");
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

function greedy(lam) {
  const daDung = new Array(n).fill(false), tuyen = [];
  let hx = kx, hy = ky, tg = 0, tien = 0;
  for (;;) {
    let tot = -1, vTot = -Infinity, cTot = 0;
    for (let i = 0; i < n; i++) {
      if (daDung[i]) continue;
      const c = Math.abs(x[i] - hx) + Math.abs(y[i] - hy) + s[i];   // d tính từ vị trí HIỆN TẠI
      if (tg + c > T) continue;                                      // chỉ xét đơn còn vừa giờ
      const v = p[i] - lam * c;                                      // giá trị ròng
      if (v > vTot) { vTot = v; tot = i; cTot = c; }                 // không có ngưỡng v > 0 (cạm bẫy 4)
    }
    if (tot < 0) break;
    daDung[tot] = true; tuyen.push(tot);
    tg += cTot; tien += p[tot]; hx = x[tot]; hy = y[tot];
  }
  return { tuyen, tien };
}

let tot = null;
for (let lam = 2; lam <= 60; lam += 2) {          // cách 3: quét thực nghiệm trên từng test
  const r = greedy(lam);
  if (!tot || r.tien > tot.tien) tot = r;
}
print(tot.tuyen.length);
print(tot.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;

vector<int> greedy(double lam, long long &tien) {
    vector<int> tuyen;
    vector<bool> daDung(n, false);
    int hx = kx, hy = ky, tg = 0;
    tien = 0;
    for (;;) {
        int tot = -1, cTot = 0;
        double vTot = -1e18;
        for (int i = 0; i < n; i++) {
            if (daDung[i]) continue;
            int c = abs(x[i] - hx) + abs(y[i] - hy) + s[i];   // d tính từ vị trí HIỆN TẠI
            if (tg + c > T) continue;                          // chỉ xét đơn còn vừa giờ
            double v = p[i] - lam * c;                         // giá trị ròng, không có ngưỡng v > 0
            if (v > vTot) { vTot = v; tot = i; cTot = c; }
        }
        if (tot < 0) break;
        daDung[tot] = true; tuyen.push_back(tot);
        tg += cTot; tien += p[tot]; hx = x[tot]; hy = y[tot];
    }
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    vector<int> tot;
    long long tienTot = -1;
    for (int lam = 2; lam <= 60; lam += 2) {          // cách 3: quét thực nghiệm trên từng test
        long long tien;
        vector<int> r = greedy(lam, tien);
        if (tien > tienTot) { tienTot = tien; tot = r; }
    }

    printf("%d\n", (int)tot.size());
    for (size_t i = 0; i < tot.size(); i++) printf("%d%c", tot[i] + 1, i + 1 < tot.size() ? ' ' : '\n');
    if (tot.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Ở mỗi bước phải tính lại d từ vị trí **hiện tại** — không phải từ kho — và chỉ xét đơn mà tg + c ≤ T.",
        "Đừng đặt điều kiện v > 0: khi còn thời gian, đơn có v lớn nhất vẫn nên được nhận dù v âm (§9, cạm bẫy 4). λ = 0 cho v = p, tức là greedy theo tiền.",
        "Viết greedy(lam) trả về cả tuyến lẫn tổng tiền, rồi bọc nó trong vòng lặp lam = 2, 4, …, 60 và giữ kết quả có tiền lớn nhất. Một λ cố định thường không thắng nổi tỉ số — quét theo từng test mới thắng."
      ]
    }
  ]
});
