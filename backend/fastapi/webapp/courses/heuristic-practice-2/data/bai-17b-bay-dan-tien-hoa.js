/* Thực hành — Bài 17B: Bầy đàn & tiến hoá (đàn kiến, di truyền, DE, PSO).  Bài mở rộng. */

/* Bài toán tự dựng: một vòng ACO tính bằng tay — xác suất chọn cạnh theo τ^α·η^β, rồi bay hơi + đọng mùi elitist.
   Chỉ có một đáp án đúng cho mỗi bộ dữ liệu nên dùng tuDapAn. */
TH.vande.dangKy("b17b-aco-mui", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var r = TH.tienIch.rng(seed), n = tham.n || 6, i, j;
    var d = [], tau = [];
    for (i = 0; i < n; i++) { d.push(new Array(n).fill(0)); tau.push(new Array(n).fill(0)); }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      d[i][j] = d[j][i] = r.khoang(2, 9);
      tau[i][j] = tau[j][i] = r.khoang(20, 200) / 100;
    }
    var rho = [0.1, 0.2, 0.25, 0.5][r.int(4)], Q = [10, 20, 50][r.int(3)];
    /* tuyến tốt nhất từng thấy = chu trình ngắn nhất (vét cạn, n ≤ 7), xuất phát ở thành phố 0 */
    var best = null, bestL = Infinity, cur = [0], dung = new Array(n).fill(false);
    dung[0] = true;
    (function dq(len) {
      if (cur.length === n) {
        var L = len + d[cur[n - 1]][0];
        if (L < bestL) { bestL = L; best = cur.slice(); }
        return;
      }
      for (var v = 1; v < n; v++) if (!dung[v]) {
        dung[v] = true; cur.push(v); dq(len + d[cur[cur.length - 2]][v]); cur.pop(); dung[v] = false;
      }
    })(0);
    return { n: n, alpha: tham.alpha == null ? 1 : tham.alpha, beta: tham.beta == null ? 2 : tham.beta, rho: rho, Q: Q, d: d, tau: tau, tuyen: best };
  },
  viet: function (inst) {
    var s = inst.n + "\n" + inst.alpha + " " + inst.beta + " " + inst.rho + " " + inst.Q + "\n";
    inst.d.forEach(function (h) { s += h.join(" ") + "\n"; });
    inst.tau.forEach(function (h) { s += h.join(" ") + "\n"; });
    return s + inst.tuyen.map(function (v) { return v + 1; }).join(" ") + "\n";
  },
  giai: function (inst) {
    var n = inst.n;
    function xs(tau) {
      var w = [], tong = 0, j;
      for (j = 1; j < n; j++) { var x = Math.pow(tau[0][j], inst.alpha) * Math.pow(1 / inst.d[0][j], inst.beta); w.push(x); tong += x; }
      return w.map(function (x) { return x / tong; });
    }
    var L = 0, i, j, a, b, moi = inst.tau.map(function (h) { return h.map(function (x) { return (1 - inst.rho) * x; }); });
    for (i = 0; i < n; i++) L += inst.d[inst.tuyen[i]][inst.tuyen[(i + 1) % n]];
    for (i = 0; i < n; i++) {
      a = inst.tuyen[i]; b = inst.tuyen[(i + 1) % n];
      moi[a][b] += inst.Q / L; moi[b][a] += inst.Q / L;
    }
    var canh = [];
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) canh.push(moi[i][j]);
    return [xs(inst.tau), canh, xs(moi)];
  },
  saiSo: 0.0006,
  dinhDang: {
    vao: "Dòng 1: `n` — số thành phố. Dòng 2: `α β ρ Q`. Tiếp `n` dòng: ma trận khoảng cách `d` (đối xứng, đường chéo 0). Tiếp `n` dòng: ma trận mùi `τ` hiện tại (đối xứng). Dòng cuối: `n` chỉ số (từ 1) của **tuyến tốt nhất từng thấy**, đọc như một chu trình khép kín.",
    ra: "Ba dòng, các số cách nhau bằng khoảng trắng (in ≥ 4 chữ số thập phân, bộ chấm cho phép lệch 0,0006). Dòng 1: `n−1` xác suất kiến đứng ở thành phố 1 chọn đi tới 2, 3, …, `n`. Dòng 2: mùi mới của mọi cạnh `(i, j)` với `i < j`, theo thứ tự (1,2), (1,3), …, (1,n), (2,3), …. Dòng 3: lại `n−1` xác suất như dòng 1 nhưng dùng mùi mới."
  }
}));

TH.dangKy({
  id: "bai-17b-bay-dan-tien-hoa",

  tomTat: [
    "Bốn thuật toán quần thể (ACO, GA, DE, PSO) chung một khuôn: khởi tạo quần thể → lặp {**chọn · sinh · thay thế**} → trả cá thể tốt nhất. Chúng chỉ khác nhau ở ô “sinh”, tức là cách cả đàn trao đổi thông tin: qua **mùi**, qua **lai ghép**, qua **hiệu hai cá thể**, hay qua **điểm tốt nhất của cả bầy**.",
    "ACO: kiến chọn cạnh với xác suất ∝ τ^α · η^β, trong đó η = 1/d chính là greedy còn τ là kinh nghiệm tích luỹ. Cuối vòng τ ← (1−ρ)τ + Q/L trên tuyến tốt nhất. Ở ví dụ 4 thành phố, xác suất chọn B từ A chỉ nhích 70,9 % → 72,2 % sau một vòng — rất nhỏ nhưng **cộng dồn**.",
    "**Bay hơi là cơ chế quên**: ρ ≈ 0 thì mùi chỉ tăng và đàn khoá vĩnh viễn, ρ ≈ 1 thì quên sạch mỗi vòng. Đặt α = 0 thì ACO thoái hoá thành **GRASP**; đặt β = 0 thì kiến đi mù rồi khoá vào tuyến may mắn đầu tiên. Toàn bộ giá trị tăng thêm của ACO so với GRASP nằm ở cái mùi.",
    "GA có ba động tác (chọn lọc giải đấu, lai ghép, đột biến p_m = 1/n). Phải **luôn vẽ đường đa dạng** = khoảng cách Hamming trung bình giữa hai cá thể chia cho n: ≈ 0,5 là quần thể ngẫu nhiên, 0,1–0,3 là lành mạnh, ≈ 0 nghĩa là GA đã chết mà vẫn đốt ngân sách — đường “điểm tốt nhất” khi đó chỉ phẳng ra, trông y hệt đã hội tụ.",
    "Lai ghép một điểm trên **hoán vị** sinh ra rác (thăm một thành phố hai lần, bỏ sót thành phố khác). Dùng OX / PMX / ERX, hoặc đổi sang ACO vì ACO xây nghiệm từ đầu nên luôn hợp lệ. Đây là Bài 3 quay lại: biểu diễn quyết định những nước đi nào tồn tại.",
    "DE: v = a + F·(b − c); hiệu b − c chính là độ toè hiện tại của quần thể nên bước đi **tự hiệu chuẩn** (F = 0 đứng im, F ≥ 1,2 quần thể nở ra, mặc định F = 0,7). PSO có **quán tính** nên nhớ hướng và lướt qua hố nông: w ≥ 1 làm bầy nổ tung, c₂ = 0 thoái hoá thành đa khởi động, luôn phải chặn v_max.",
    "So sánh các thuật toán này **theo ngân sách đánh giá** (số lần gọi f), không theo số vòng lặp hay đồng hồ: một vòng PSO 20 hạt gọi f 20 lần. Cần ≥ 30 hạt giống, báo cáo trung bình ± 2·SE; mốc bắt buộc vượt qua là tìm kiếm ngẫu nhiên và đa khởi động + local search.",
    "Đồ án của khoá không dùng chúng vì: ngân sách 100 ms chỉ đủ vài chục nghìn lần đánh giá (cần cỡ 10⁵–10⁶), nghiệm chỉ ~12 phần tử (lai ghép, “phá 25 %” gần như vô nghĩa), ràng buộc chặt (hàm sửa chữa làm hết việc). Chúng mạnh khi ngân sách **lớn**, nghiệm **dài**, ràng buộc **lỏng**."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "§1.3", donVi: "(%)",
      hoi: "Kiến đang đứng ở một thành phố, còn ba thành phố chưa đi, cách đó lần lượt 1, 2 và 4 phút. Lấy α = 1, β = 2 và mọi cạnh có mùi τ = 1 như nhau. Xác suất (tính bằng %) để kiến chọn thành phố gần nhất là bao nhiêu?",
      dapAn: 76.19, saiSo: 0.05,
      giaiThich: "η = 1/d = 1; 0,5; 0,25. Vì τ bằng nhau nên sức hút chỉ còn η² = 1; 0,25; 0,0625, tổng 1,3125. Xác suất chọn thành phố gần nhất = 1 / 1,3125 = 76,19 %. Nếu quên bình phương (dùng β = 1) bạn sẽ ra 1/(1 + 0,5 + 0,25) = 57,1 % — sai. Chú ý: khi mùi còn đều nhau, ACO chỉ đang làm greedy có pha ngẫu nhiên, hệt GRASP."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "§1.7 (điều 2)",
      hoi: "Một bạn bỏ hẳn bước bay hơi khỏi ACO (ρ = 0), chỉ cộng mùi. Hậu quả điển hình sau vài chục vòng là gì?",
      chon: [
        "Mùi chỉ có thể tăng, tuyến được ưu tiên sớm ngày càng áp đảo, đàn không bao giờ thử lại tuyến khác kể cả khi tuyến khác tốt hơn",
        "Đàn hội tụ nhanh hơn và chắc chắn hơn tới tối ưu toàn cục vì không quên điều gì đã học",
        "Mọi cạnh đều đậm như nhau nên kiến đi hoàn toàn ngẫu nhiên",
        "ACO thoái hoá thành GRASP vì mùi không còn tác dụng"
      ],
      dung: 0,
      giaiThich: "Bay hơi là cơ chế quên để có thể học lại: thiếu nó, mùi trên tuyến sớm may mắn chỉ dày thêm, xác suất chọn cạnh khác tiến về 0 và đàn bị khoá — khoá vĩnh viễn nếu ρ ≈ 0. Ý “hội tụ chắc chắn tới tối ưu” sai vì khoá vào tuyến sớm thường là cực trị cục bộ. “Đi ngẫu nhiên” là hậu quả của β = 0 khi mùi còn đều, không phải của ρ = 0. Thoái hoá thành GRASP là hậu quả của α = 0."
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "§3.3",
      hoi: "Trên bài của bạn, ACO (α = 1, β = 3) không hơn GRASP có ý nghĩa thống kê (chênh lệch nằm trong 2·SE trên 30 hạt giống). Kết luận nào là đúng nhất?",
      chon: [
        "Mùi chưa đem lại gì: có thể bài này không có cấu trúc để mùi ghi lại, hoặc ngân sách quá ít để mùi kịp tách ra — hãy kiểm tra tỉ số τ_max / τ_min khi hết ngân sách",
        "ACO là thuật toán dở và nên được loại khỏi mọi bài toán định tuyến",
        "GRASP luôn tốt hơn ACO nên chỉ cần chạy GRASP với RCL thật rộng",
        "Cần tăng β lên thật lớn để mùi có trọng số cao hơn η"
      ],
      dung: 0,
      giaiThich: "Với α = 0, ACO chính là GRASP, nên mọi giá trị tăng thêm của ACO đến từ mùi. Nếu đo không thấy hơn thì kết luận không phải “ACO dở” mà là mùi chưa ghi lại được điều gì hữu ích. Phép đo τ_max / τ_min còn gần 1 cho thấy mùi chưa kịp tách. Tăng β làm η chiếm ưu thế, tức làm mùi kém quan trọng hơn chứ không hơn."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§4.2",
      hoi: "Một GA cho bài cái túi (10 gen) có 6 cá thể: 5 cá thể giống hệt nhau và cá thể thứ sáu khác chúng đúng một bit. Độ đa dạng theo định nghĩa của bài, đa dạng = 2/(m(m−1)) · Σ_{i<j} Hamming(xᵢ, xⱼ)/n, bằng bao nhiêu?",
      dapAn: 0.0333, saiSo: 0.001,
      giaiThich: "m = 6 nên có 15 cặp. Chỉ 5 cặp có cá thể thứ sáu có Hamming = 1, còn 10 cặp kia bằng 0, nên Σ Hamming = 5. Đa dạng = 2/(6·5) · 5/10 = 0,0333. Con số này sát đáy: quần thể gần như đồng nhất, lai ghép hầu như không sinh ra gì mới, và nếu chỉ nhìn đường điểm tốt nhất bạn sẽ không nhận ra GA sắp chết."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§4.4",
      hoi: "GA cho TSP biểu diễn tuyến là hoán vị. Hai cha mẹ là A = (1 2 3 | 4 5 6) và B = (4 6 1 | 5 3 2). Lai ghép một điểm cắt sau gen thứ 3 cho con = (1 2 3 5 3 2). Nhận định nào đúng?",
      chon: [
        "Con có đúng 6 gen nên hợp lệ, chỉ cần xếp lại thứ tự các gen",
        "Con không phải hoán vị: thăm thành phố 3 và 2 hai lần, bỏ sót 4 và 6; cần toán tử dành cho hoán vị như OX, PMX, ERX",
        "Con hợp lệ nhưng chất lượng thấp, chọn lọc ở thế hệ sau sẽ loại nó",
        "Phép đột biến ở bước sau sẽ tự sửa các thành phố bị lặp"
      ],
      dung: 1,
      giaiThich: "Lai ghép một điểm chỉ có nghĩa khi các gen độc lập, như từng bit của cái túi. Với hoán vị, con thăm 3 và 2 hai lần và không thăm 4, 6 nên không hợp lệ. Nó còn nguy hiểm vì tuyến thiếu thành phố thường trông ngắn hơn, dễ thắng chọn lọc chứ không bị loại. Đột biến nhỏ không sửa được hoán vị hỏng; phải dùng OX/PMX/ERX hoặc xây nghiệm từ đầu như ACO."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§5",
      hoi: "Chọn mọi phát biểu đúng về tiến hoá vi phân (DE).",
      chon: [
        "Hiệu b − c chính là độ toè hiện tại của quần thể, nên bước đi dài khi quần thể tản rộng và ngắn khi quần thể đã co lại",
        "Với F = 0, vectơ thử trùng với một cá thể có sẵn nên quần thể đứng im và độ toè chỉ có thể giảm",
        "F ≥ 1,2 là vùng lành mạnh vì bước dài giúp khám phá mà độ toè vẫn giảm đều",
        "DE phù hợp nhất cho biến rời rạc có cấu trúc như hoán vị các thành phố",
        "Cỡ quần thể NP quá nhỏ làm hướng đi nghèo nàn — thực chất là mất đa dạng, giống bệnh của GA"
      ],
      dung: [0, 1, 4],
      giaiThich: "Đúng: hiệu hai cá thể tự co theo quần thể (tự hiệu chuẩn bước); F = 0 khiến quần thể đứng im; NP nhỏ chỉ còn vài vectơ hiệu khả dĩ nên mất đa dạng. Sai: F ≥ 1,2 làm bước dài hơn khoảng cách giữa các cá thể nên quần thể nở ra chứ không co (vùng lành mạnh là 0,5–0,9); DE dành cho biến liên tục, còn hoán vị thì cần toán tử riêng hoặc ACO."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§6.3",
      hoi: "Một bầy PSO có w = 1,2 và không chặn vận tốc: sau vài chục vòng nhiều hạt bay ra rất xa miền tìm kiếm. Cách chữa hợp lý nhất là gì?",
      chon: [
        "Tăng c₂ để áp lực đám đông kéo các hạt trở về",
        "Bỏ ký ức riêng (đặt c₁ = 0) để các hạt không đi lạc",
        "Gấp đôi số hạt của bầy",
        "Hạ w xuống dưới 1 (ví dụ w = 0,72 với c₁ = c₂ = 1,49) và chặn trần vận tốc cỡ 10–20 % bề rộng miền"
      ],
      dung: 3,
      giaiThich: "w ≥ 1 nhân vận tốc lên mỗi vòng nên năng lượng không thoát — bầy nổ tung; phải đưa w xuống dưới 1 và luôn chặn v_max để một hạt xui xẻo không kéo cả bầy qua số hạng c₂. Tăng c₂ chỉ thêm lực mà không dập được quán tính; c₁ = 0 gây hội tụ sớm vì mọi hạt chỉ nghe đám đông; thêm hạt không đổi bản chất của bệnh."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "§7.1, §9 (cạm bẫy 5, 6)",
      hoi: "Một bạn báo cáo: “PSO 20 hạt chạy 500 vòng đánh bại leo đồi 500 vòng, trên một hạt giống”. Vì sao kết luận này chưa đáng tin?",
      chon: [
        "Vì PSO phải được chạy ít vòng hơn leo đồi mới công bằng",
        "Vì PSO không bao giờ thắng được leo đồi",
        "PSO đã gọi hàm mục tiêu 10 000 lần còn leo đồi chỉ 500 lần, và một hạt giống không kết luận được gì — phải so cùng ngân sách đánh giá, ≥ 30 hạt giống, trung bình ± 2·SE",
        "Vì chỉ so sánh thời gian đồng hồ mới là so sánh công bằng"
      ],
      dung: 2,
      giaiThich: "Một vòng PSO 20 hạt gọi f 20 lần, nên 500 vòng là 10 000 lần, gấp 20 lần leo đồi — so theo vòng lặp là tặng không cho PSO một hệ số 20. Thước đo công bằng duy nhất là ngân sách đánh giá. Hơn nữa thuật toán ngẫu nhiên cần ≥ 30 hạt giống và so chênh lệch với 2·SE. So theo đồng hồ lại trộn cả chất lượng code vào kết quả."
    },
    {
      id: "q9", loai: "nhieu", doKho: 3, ref: "§8",
      hoi: "Thuật toán quần thể thường chỉ bộc lộ lợi thế khi nào? Chọn mọi điều kiện phù hợp.",
      chon: [
        "Giới hạn 100 ms mỗi test, chỉ đủ vài chục nghìn lần đánh giá hàm mục tiêu",
        "Ngân sách đánh giá lớn, cỡ 10⁵–10⁶ lần gọi hàm mục tiêu trở lên",
        "Nghiệm chỉ gồm khoảng 12 phần tử với ràng buộc thời gian rất chặt",
        "Nghiệm dài và có nhiều cấu trúc để các cá thể trao đổi cho nhau",
        "Ràng buộc lỏng, hoặc dễ sửa nghiệm sau khi lai ghép"
      ],
      dung: [1, 3, 4],
      giaiThich: "Ba điều kiện (a) ngân sách lớn, (b) nghiệm dài nhiều cấu trúc, (c) ràng buộc lỏng hoặc dễ sửa là điều kiện để quần thể có lợi. Thiếu một trong ba thì quay lại Phần 2–3. Đồ án của khoá vi phạm cả ba: vài chục nghìn lần đánh giá trong 100 ms, nghiệm ~12 phần tử (lai ghép sinh ra rất ít tổ hợp mới), và ràng buộc 720 phút làm hàm sửa chữa trở thành chính heuristic chèn."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 17B.1",
      hoi: "Bản đồ 4 thành phố ở §1.1: A–B = 2, A–C = 5, A–D = 4, B–C = 3, B–D = 6, C–D = 2; α = 1, β = 2, ρ = 0,5, Q = 1, mùi ban đầu mọi cạnh = 1. Sau vòng 1 (tuyến tốt nhất A→B→C→D→A dài 11) mùi đã là 0,591 trên bốn cạnh của tuyến và 0,5 trên A–C, B–D. Giả sử vòng 2 cả hai kiến đều đi lại đúng tuyến đó. Tính mùi sau vòng 2 và xác suất kiến đứng ở A chọn đi B; rồi nhận xét điều gì xảy ra với xác suất ấy khi chạy mãi.",
      goiY: ["Làm hai việc theo đúng thứ tự: bay hơi mọi cạnh trước, đọng mùi 1/11 lên tuyến tốt nhất sau.", "Xác suất = sức hút của một cạnh chia cho tổng sức hút của ba cạnh đi ra từ A, với sức hút = τ · η² và η = 1/d."],
      mau: "**Cập nhật mùi.** Bay hơi nhân mọi cạnh với 0,5: bốn cạnh của tuyến được 0,2955, hai cạnh còn lại (A–C, B–D) được 0,25. Đọng mùi cộng thêm 1/11 = 0,0909 vào bốn cạnh của tuyến: **0,386** cho A–B, B–C, C–D, D–A; **0,25** cho A–C và B–D.\n\n" +
           "**Xác suất từ A.** Sức hút = τ · η² với η² = 0,25 (B), 0,04 (C), 0,0625 (D): B = 0,386 × 0,25 = 0,0966; C = 0,25 × 0,04 = 0,0100; D = 0,386 × 0,0625 = 0,0241; tổng 0,1307. Vậy P(B) = **73,9 %** (đi qua 70,9 % → 72,2 % → 73,9 %), P(C) = 7,6 %, P(D) = 18,5 %.\n\n" +
           "**Nhận xét.** Mùi trên cạnh tốt đang *giảm* (0,591 → 0,386) nhưng cái quyết định là **tỉ số** mùi tốt/xấu, và nó tăng: 0,591/0,5 = 1,18 rồi 0,386/0,25 = 1,54, nên độ nghiêng tăng tốc (+1,3 rồi +1,7 điểm phần trăm). Với đọng mùi elitist, mùi trên cạnh tốt hội tụ về Q/(L·ρ) ≈ 0,182 còn cạnh ngoài tuyến tiến về 0. Khi đó P(B) tiến tới 0,25/(0,25 + 0,0625) = **80 %** chứ không tới 100 %, vì D–A cũng nằm trên tuyến tốt (kiến đi A→D→C→B→A là cùng tuyến theo chiều ngược). Xác suất đi *đúng tuyến tốt* (theo một trong hai chiều) mới tiến tới 100 %.",
      tieuChi: [
        "Làm đúng thứ tự bay hơi trước, đọng mùi sau và ra mùi 0,386 (bốn cạnh của tuyến) và 0,25 (A–C, B–D)",
        "Tính ra P(B) ≈ 73,9 % cùng P(C) ≈ 7,6 % và P(D) ≈ 18,5 %",
        "Nhận ra mùi trên cạnh tốt giảm nhưng tỉ số mùi tốt/xấu tăng (1,18 → 1,54) nên xác suất vẫn nghiêng dần",
        "(Nâng cao) Nhận ra P(B) tiến tới 80 % chứ không phải 100 % vì D–A cũng thuộc tuyến tốt"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§4.2, §9 (cạm bẫy 2)",
      hoi: "Đường “điểm tốt nhất” của GA phẳng ra từ thế hệ 200 trở đi. Có hai cách giải thích trông giống hệt nhau trên đồ thị: GA đã hội tụ tới nghiệm tốt, hoặc quần thể đã chết. Làm sao phân biệt? Nếu là trường hợp sau, bạn chữa thế nào?",
      goiY: ["Cần một đại lượng đo xem các cá thể còn khác nhau không.", "Nhớ hai tham số quyết định ở §4.3 và cỡ quần thể."],
      mau: "**Phân biệt** bằng cách đo và vẽ đường **đa dạng** = khoảng cách Hamming trung bình giữa hai cá thể chia cho số gen, đặt cạnh đường điểm tốt nhất. Đa dạng ≈ 0,5 là quần thể ngẫu nhiên, 0,1–0,3 là lành mạnh, ≈ 0 nghĩa là mọi cá thể giống hệt nhau: lai ghép không sinh ra gì mới và GA đã chết nhưng vẫn đốt ngân sách. Chỉ nhìn đường điểm thì không phân biệt được hai trường hợp.\n\n" +
           "**Chữa** nếu quần thể đã chết: tăng đột biến (mặc định p_m = 1/n mỗi gen; p_m quá thấp làm đa dạng sập về 0), giảm áp lực chọn lọc (giải đấu cỡ k = 2–3 thay vì lớn hơn), tăng cỡ quần thể để trôi gen chậm hơn, hoặc khởi động lại có giữ tinh hoa và tiêm cá thể ngẫu nhiên. Thay vì suy đoán, hãy quét p_m và kiểm tra đa dạng có tụt dưới 0,05 không.",
      tieuChi: [
        "Đề xuất đo đa dạng (Hamming trung bình chia n) và vẽ cạnh đường điểm tốt nhất",
        "Nêu ngưỡng đọc: ≈ 0 là quần thể chết, 0,1–0,3 là lành mạnh",
        "Giải thích vì sao chỉ nhìn đường điểm không phân biệt được hai trường hợp",
        "Nêu ít nhất hai cách chữa cụ thể (p_m, cỡ giải đấu k, cỡ quần thể, khởi động lại)"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "§8, Bài tập 17B.5",
      hoi: "Đồ án của khoá (ship hàng, 100 ms mỗi test, mỗi ngày tối đa 12 ngôi nhà, ràng buộc 720 phút) không dùng thuật toán quần thể nào. Hãy nêu ba lý do và, với mỗi lý do, một phép đo cụ thể để bảo vệ kết luận bằng con số.",
      goiY: ["Một lý do về ngân sách, một về độ dài nghiệm, một về ràng buộc.", "Đã có một con số của lời giải thật: 27,4 ms và “vài chục nghìn” lần đánh giá."],
      mau: "1. **Ngân sách quá nhỏ (§8.1).** Lời giải thật dùng 27,4 ms và chạy được cỡ vài chục nghìn lần đánh giá, trong khi thuật toán quần thể cần cỡ 10⁵–10⁶ lần; với m = 50 chỉ đủ vài trăm thế hệ, mà GA thường cần hàng nghìn thế hệ. *Phép đo:* đếm số lần gọi hàm đánh giá trong 100 ms rồi so với 10⁵.\n" +
           "2. **Nghiệm quá ngắn (§8.2).** Chỉ 12 ngôi nhà mỗi ngày: lai ghép hai nghiệm 12 phần tử sinh ra rất ít tổ hợp mới, và “phá 25 %” chỉ là bỏ 3 phần tử, không lớn hơn một nước local search thường (cùng hiện tượng LNS thắng trên P2 65 phần tử nhưng không thắng trên P1 14 phần tử). *Phép đo:* đếm số con lai ghép khác cả hai cha mẹ; so LNS trên bài 12 phần tử với local search thường.\n" +
           "3. **Ràng buộc chặt (§8.3).** Ghép nửa lịch ngày A với nửa lịch ngày B gần như luôn vi phạm (quá 720 phút hoặc trùng nhà), nên phải viết hàm sửa chữa — mà hàm đó cuối cùng chính là heuristic chèn của Bài 7, GA chỉ còn là lớp vỏ. *Phép đo:* tỉ lệ con lai ghép không hợp lệ trước khi sửa; so GA + sửa với heuristic chèn đơn thuần cùng ngân sách.\n\n" +
           "Quy tắc tổng quát: quần thể mạnh khi ngân sách **lớn**, nghiệm **dài**, ràng buộc **lỏng**; thiếu một trong ba thì quay lại Phần 2–3.",
      tieuChi: [
        "Nêu đủ ba lý do: ngân sách, độ dài nghiệm, ràng buộc chặt",
        "Dẫn được con số của §8 (100 ms, vài chục nghìn lần đánh giá so với 10⁵–10⁶; 12 phần tử; 720 phút)",
        "Mỗi lý do đi kèm một phép đo cụ thể, rẻ, có thể chạy được",
        "Phát biểu được quy tắc tổng quát ba điều kiện để thuật toán quần thể có lợi"
      ]
    }
  ],

  lab: [
    {
      id: "ga-ox-tsp",
      ten: "Giải thuật di truyền cho TSP: lai ghép OX và đột biến đảo đoạn",
      doKho: 3,
      ref: "§4.1–4.4, §9",
      de: "Cài **giải thuật di truyền** cho chu trình ngắn nhất (`tsp`, `n = 30` điểm). Khung bên dưới đã có sẵn: quần thể 60 hoán vị ngẫu nhiên, **chọn lọc giải đấu** cỡ `k = 3`, **giữ tinh hoa** (cá thể tốt nhất luôn sống sót) và vòng lặp đúng **600 thế hệ**. Ngân sách tính bằng số thế hệ, hạt giống `rng(12345)` cố định, nên cùng đầu vào luôn cho cùng kết quả trên mọi máy.\n\n" +
          "Bạn cần viết hai hàm:\n\n" +
          "1. `laiGhep(a, b)` — lai ghép **OX** (order crossover): chọn ngẫu nhiên đoạn `[i, j]`, giữ nguyên đoạn đó của cha `a`, rồi điền các vị trí còn lại bằng những gen chưa có, **theo thứ tự xuất hiện ở cha `b`** bắt đầu từ sau vị trí `j`. Con luôn là hoán vị hợp lệ. (Thử lai ghép một điểm như §4.1 xem: bộ chấm sẽ báo “điểm X xuất hiện hai lần”.)\n" +
          "2. `dotBien(c)` — với xác suất `p_m = 0,3` mỗi con, **đảo ngược một đoạn ngẫu nhiên** `c[i..j]` (một nước 2-opt).\n\n" +
          "**Mức đạt:** tuyến hợp lệ trên mọi test → độ dài tổng không dài hơn greedy gần nhất → đạt ≥ 97 % chất lượng của 2-opt xuất phát từ gần nhất. Hãy thử cả dữ liệu *gom cụm*.\n\n" +
          "**Sau khi qua, hãy tự đo** (§4.2, §9): (a) đặt `pm = 0` rồi dùng `log` in độ đa dạng mỗi 100 thế hệ — nó sập về đâu, điểm tụt ra sao? (b) đặt `pc = 0` (tắt lai ghép) — điểm có đổi không? Ở `n = 30`, lai ghép đang đóng góp gì, và bạn rút ra điều gì về cạm bẫy “dùng thuật toán quần thể vì nghe hiện đại”?",
      vanDe: "tsp",
      tham: { n: 30 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 30 } },
        { ten: "Gom cụm", tham: { n: 30, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [
        { ten: "Không dài hơn greedy gần nhất", so: "ganNhat", heSo: 1 },
        { ten: "Đạt ≥ 97 % chất lượng của 2-opt (từ gần nhất)", so: "haiOpt", heSo: 0.97 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là n, rồi n dòng "x y".
// Đầu ra : một dòng n chỉ số (từ 1) — hoán vị theo thứ tự đi (chu trình khép kín).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[1 + 2 * i]); Y.push(t[2 + 2 * i]); }
const D = [];
for (let i = 0; i < n; i++) {
  D.push([]);
  for (let j = 0; j < n; j++) D[i].push(Math.hypot(X[i] - X[j], Y[i] - Y[j]));
}
function duongDai(p) {
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}

const r = rng(12345);                              // hạt giống cố định → kết quả tất định
const m = 60, soTheHe = 600, k = 3, pc = 0.9, pm = 0.3;

function ngauNhien() {                             // một hoán vị ngẫu nhiên của 0..n-1
  const p = [];
  for (let i = 0; i < n; i++) p.push(i);
  for (let i = n - 1; i > 0; i--) { const j = r.int(i + 1); const x = p[i]; p[i] = p[j]; p[j] = x; }
  return p;
}

function laiGhep(a, b) {
  // TODO: lai ghép OX — giữ đoạn [i, j] của a, rồi điền các gen còn thiếu theo thứ tự ở b
  //       (bắt đầu từ sau vị trí j, quay vòng). Trả về một hoán vị MỚI của 0..n-1.
  return a.slice();
}
function dotBien(c) {
  // TODO: với xác suất pm, đảo ngược một đoạn ngẫu nhiên c[i..j] (sửa trực tiếp c).
}

let qt = [], dd = [];
for (let i = 0; i < m; i++) { qt.push(ngauNhien()); dd.push(duongDai(qt[i])); }
function giaiDau() {                               // chọn lọc giải đấu cỡ k: bốc k cá thể, lấy cá thể ngắn nhất
  let b = r.int(m);
  for (let q = 1; q < k; q++) { const c = r.int(m); if (dd[c] < dd[b]) b = c; }
  return qt[b];
}

for (let g = 0; g < soTheHe; g++) {
  let tot = 0;
  for (let i = 1; i < m; i++) if (dd[i] < dd[tot]) tot = i;
  const moi = [qt[tot]], dm = [dd[tot]];           // giữ tinh hoa
  while (moi.length < m) {
    const con = r() < pc ? laiGhep(giaiDau(), giaiDau()) : giaiDau().slice();
    dotBien(con);
    moi.push(con); dm.push(duongDai(con));
  }
  qt = moi; dd = dm;
}

let tot = 0;
for (let i = 1; i < m; i++) if (dd[i] < dd[tot]) tot = i;
print(qt[tot].map((v) => v + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;
mt19937 rng(12345);                                // hạt giống cố định → kết quả tất định
int rnd(int k) { return (int)(rng() % k); }        // số nguyên trong [0, k)
double rnd01() { return (rng() >> 8) / 16777216.0; }

double duongDai(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

vector<int> laiGhep(const vector<int>& a, const vector<int>& b) {
    // TODO: lai ghép OX — giữ đoạn [i, j] của a, rồi điền các gen còn thiếu theo thứ tự ở b
    //       (bắt đầu từ sau vị trí j, quay vòng). Trả về một hoán vị MỚI của 0..n-1.
    return a;
}
void dotBien(vector<int>& c) {
    // TODO: với xác suất pm, đảo ngược một đoạn ngẫu nhiên c[i..j].
}

int main() {
    scanf("%d", &n);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) D[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    const int m = 60, soTheHe = 600, k = 3;
    const double pc = 0.9;
    vector<vector<int>> qt(m, vector<int>(n));
    vector<double> dd(m);
    for (int s = 0; s < m; s++) {
        iota(qt[s].begin(), qt[s].end(), 0);
        for (int i = n - 1; i > 0; i--) swap(qt[s][i], qt[s][rnd(i + 1)]);
        dd[s] = duongDai(qt[s]);
    }
    auto giaiDau = [&]() -> const vector<int>& {   // chọn lọc giải đấu cỡ k
        int b = rnd(m);
        for (int q = 1; q < k; q++) { int c = rnd(m); if (dd[c] < dd[b]) b = c; }
        return qt[b];
    };

    for (int g = 0; g < soTheHe; g++) {
        int tot = (int)(min_element(dd.begin(), dd.end()) - dd.begin());
        vector<vector<int>> moi = {qt[tot]};       // giữ tinh hoa
        vector<double> dm = {dd[tot]};
        while ((int)moi.size() < m) {
            vector<int> con = rnd01() < pc ? laiGhep(giaiDau(), giaiDau()) : giaiDau();
            dotBien(con);
            dm.push_back(duongDai(con));
            moi.push_back(con);
        }
        qt = moi; dd = dm;
    }

    int tot = (int)(min_element(dd.begin(), dd.end()) - dd.begin());
    for (int i = 0; i < n; i++) printf("%d%c", qt[tot][i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[1 + 2 * i]); Y.push(t[2 + 2 * i]); }
const D = [];
for (let i = 0; i < n; i++) {
  D.push([]);
  for (let j = 0; j < n; j++) D[i].push(Math.hypot(X[i] - X[j], Y[i] - Y[j]));
}
function duongDai(p) {
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}

const r = rng(12345);                              // hạt giống cố định → kết quả tất định
const m = 60, soTheHe = 600, k = 3, pc = 0.9, pm = 0.3;

function ngauNhien() {
  const p = [];
  for (let i = 0; i < n; i++) p.push(i);
  for (let i = n - 1; i > 0; i--) { const j = r.int(i + 1); const x = p[i]; p[i] = p[j]; p[j] = x; }
  return p;
}

// Lai ghép OX: giữ đoạn [i, j] của a, điền các gen còn thiếu theo thứ tự xuất hiện ở b (từ sau j, quay vòng).
function laiGhep(a, b) {
  let i = r.int(n), j = r.int(n);
  if (i > j) { const x = i; i = j; j = x; }
  const con = new Array(n).fill(-1), dung = new Array(n).fill(false);
  for (let q = i; q <= j; q++) { con[q] = a[q]; dung[a[q]] = true; }
  let vt = (j + 1) % n;
  for (let q = 0; q < n; q++) {
    const g = b[(j + 1 + q) % n];
    if (!dung[g]) { con[vt] = g; vt = (vt + 1) % n; }
  }
  return con;
}
// Đột biến: với xác suất pm, đảo ngược một đoạn ngẫu nhiên (một nước 2-opt).
function dotBien(c) {
  if (r() >= pm) return;
  let i = r.int(n), j = r.int(n);
  if (i > j) { const x = i; i = j; j = x; }
  while (i < j) { const x = c[i]; c[i] = c[j]; c[j] = x; i++; j--; }
}

let qt = [], dd = [];
for (let i = 0; i < m; i++) { qt.push(ngauNhien()); dd.push(duongDai(qt[i])); }
function giaiDau() {
  let b = r.int(m);
  for (let q = 1; q < k; q++) { const c = r.int(m); if (dd[c] < dd[b]) b = c; }
  return qt[b];
}
// Độ đa dạng (§4.2): Hamming trung bình giữa hai cá thể, chia n. Với hoán vị đây chỉ là thước đo thô.
function daDang() {
  let tong = 0, cap = 0;
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
    let h = 0;
    for (let q = 0; q < n; q++) if (qt[a][q] !== qt[b][q]) h++;
    tong += h / n; cap++;
  }
  return tong / cap;
}

for (let g = 0; g < soTheHe; g++) {
  let tot = 0;
  for (let i = 1; i < m; i++) if (dd[i] < dd[tot]) tot = i;
  if (g % 100 === 0) log("thế hệ " + g + ": tốt nhất " + dd[tot].toFixed(1) + ", đa dạng " + daDang().toFixed(3));
  const moi = [qt[tot]], dm = [dd[tot]];           // giữ tinh hoa
  while (moi.length < m) {
    const con = r() < pc ? laiGhep(giaiDau(), giaiDau()) : giaiDau().slice();
    dotBien(con);
    moi.push(con); dm.push(duongDai(con));
  }
  qt = moi; dd = dm;
}

let tot = 0;
for (let i = 1; i < m; i++) if (dd[i] < dd[tot]) tot = i;
print(qt[tot].map((v) => v + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;
mt19937 rng(12345);                                // hạt giống cố định → kết quả tất định
int rnd(int k) { return (int)(rng() % k); }        // số nguyên trong [0, k)
double rnd01() { return (rng() >> 8) / 16777216.0; }

double duongDai(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

// Lai ghép OX: giữ đoạn [i, j] của a, điền các gen còn thiếu theo thứ tự xuất hiện ở b (từ sau j, quay vòng).
vector<int> laiGhep(const vector<int>& a, const vector<int>& b) {
    int i = rnd(n), j = rnd(n);
    if (i > j) swap(i, j);
    vector<int> con(n, -1);
    vector<char> dung(n, 0);
    for (int q = i; q <= j; q++) { con[q] = a[q]; dung[a[q]] = 1; }
    int vt = (j + 1) % n;
    for (int q = 0; q < n; q++) {
        int g = b[(j + 1 + q) % n];
        if (!dung[g]) { con[vt] = g; vt = (vt + 1) % n; }
    }
    return con;
}
// Đột biến: với xác suất pm, đảo ngược một đoạn ngẫu nhiên (một nước 2-opt).
void dotBien(vector<int>& c, double pm) {
    if (rnd01() >= pm) return;
    int i = rnd(n), j = rnd(n);
    if (i > j) swap(i, j);
    reverse(c.begin() + i, c.begin() + j + 1);
}

int main() {
    scanf("%d", &n);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) D[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    const int m = 60, soTheHe = 600, k = 3;
    const double pc = 0.9, pm = 0.3;
    vector<vector<int>> qt(m, vector<int>(n));
    vector<double> dd(m);
    for (int s = 0; s < m; s++) {
        iota(qt[s].begin(), qt[s].end(), 0);
        for (int i = n - 1; i > 0; i--) swap(qt[s][i], qt[s][rnd(i + 1)]);
        dd[s] = duongDai(qt[s]);
    }
    auto giaiDau = [&]() -> const vector<int>& {   // chọn lọc giải đấu cỡ k
        int b = rnd(m);
        for (int q = 1; q < k; q++) { int c = rnd(m); if (dd[c] < dd[b]) b = c; }
        return qt[b];
    };

    for (int g = 0; g < soTheHe; g++) {
        int tot = (int)(min_element(dd.begin(), dd.end()) - dd.begin());
        vector<vector<int>> moi = {qt[tot]};       // giữ tinh hoa
        vector<double> dm = {dd[tot]};
        while ((int)moi.size() < m) {
            vector<int> con = rnd01() < pc ? laiGhep(giaiDau(), giaiDau()) : giaiDau();
            dotBien(con, pm);
            dm.push_back(duongDai(con));
            moi.push_back(con);
        }
        qt = moi; dd = dm;
    }

    int tot = (int)(min_element(dd.begin(), dd.end()) - dd.begin());
    for (int i = 0; i < n; i++) printf("%d%c", qt[tot][i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "OX: chọn hai vị trí i ≤ j, chép a[i..j] sang con và đánh dấu các gen đã dùng. Rồi đi qua b theo thứ tự bắt đầu từ vị trí j+1 (quay vòng); gen nào chưa dùng thì đặt vào con ở vị trí trống kế tiếp, cũng bắt đầu từ j+1.",
        "Đột biến đảo đoạn: chọn i ≤ j ngẫu nhiên rồi đảo ngược c[i..j] bằng hai con trỏ chạy vào nhau — đó chính là một nước 2-opt.",
        "Nếu bộ chấm báo một điểm xuất hiện hai lần, con của bạn không phải hoán vị. Kiểm tra: sau lai ghép, các gen trong con có khác nhau từng đôi một không? Bạn có thể thử thêm đột biến hoán đổi hai gen (xác suất 1/n mỗi gen, §4.3) rồi so điểm với đảo đoạn."
      ]
    },
    {
      id: "aco-mui",
      ten: "Một vòng đàn kiến: xác suất chọn cạnh và cập nhật mùi",
      doKho: 2,
      ref: "§1, §3.1, §3.3",
      de: "Đây là §1 của bài giảng, nhưng để máy làm. Cho bản đồ `n = 6` thành phố (ma trận khoảng cách `d`), ma trận mùi `τ` hiện tại, các tham số `α, β, ρ, Q` và **tuyến tốt nhất từng thấy**. Bạn in ba dòng:\n\n" +
          "1. Xác suất để một kiến đang ở thành phố 1 (mọi thành phố khác chưa đi) chọn đi tới 2, 3, …, `n`, với `p(i→j) ∝ τ^α · η^β`, `η = 1/d`.\n" +
          "2. Mùi mới của mọi cạnh `(i, j)`, `i < j`, sau **bay hơi rồi đọng mùi elitist**: `τ ← (1−ρ)·τ`, rồi cộng thêm `Q/L` vào mỗi cạnh thuộc tuyến tốt nhất (`L` là độ dài chu trình khép kín của tuyến đó; cạnh không có hướng).\n" +
          "3. Lại xác suất như dòng 1 nhưng dùng mùi mới.\n\n" +
          "Bộ chấm kiểm từng số (lệch ≤ 0,0006). **Sau khi qua, đổi biến thể dữ liệu** và đọc hiểu: với `β = 0` dòng 1 trông thế nào (kiến “đi mù”)? Với `α = 0`, dòng 3 so với dòng 1 ra sao — và vì sao đó là lý do ACO với α = 0 *chính là* GRASP? (§3.3)",
      vanDe: "b17b-aco-mui",
      tham: { alpha: 1, beta: 2 },
      bienThe: [
        { ten: "α = 1, β = 2 (mặc định)", tham: { alpha: 1, beta: 2 } },
        { ten: "β = 0 — kiến đi mù", tham: { alpha: 1, beta: 0 } },
        { ten: "α = 0 — mùi bị vứt bỏ", tham: { alpha: 0, beta: 2 } }
      ],
      soTest: 8,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: n; "alpha beta rho Q"; n dòng ma trận d; n dòng ma trận tau; rồi n chỉ số (từ 1) của tuyến tốt nhất.
// Đầu ra : 3 dòng (xem đề). In mỗi số với ít nhất 4 chữ số thập phân.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], alpha = t[c++], beta = t[c++], rho = t[c++], Q = t[c++];
const d = [], tau = [];
for (let i = 0; i < n; i++) { d.push(t.slice(c, c + n)); c += n; }
for (let i = 0; i < n; i++) { tau.push(t.slice(c, c + n)); c += n; }
const tuyen = [];
for (let i = 0; i < n; i++) tuyen.push(t[c++] - 1);

// TODO 1: xác suất kiến ở thành phố 0 chọn j = 1..n-1:  w_j = tau[0][j]^alpha * (1/d[0][j])^beta, rồi chia cho tổng.
// TODO 2: độ dài L của chu trình "tuyen"; bay hơi mọi cạnh, rồi cộng Q/L vào các cạnh của tuyến (đối xứng).
// TODO 3: xác suất như TODO 1 nhưng với mùi mới.
print("0");
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    double alpha, beta, rho, Q;
    scanf("%d %lf %lf %lf %lf", &n, &alpha, &beta, &rho, &Q);
    vector<vector<double>> d(n, vector<double>(n)), tau(n, vector<double>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) scanf("%lf", &d[i][j]);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) scanf("%lf", &tau[i][j]);
    vector<int> tuyen(n);
    for (int i = 0; i < n; i++) { scanf("%d", &tuyen[i]); tuyen[i]--; }

    // TODO 1: xác suất kiến ở thành phố 0 chọn j = 1..n-1:  w_j = tau[0][j]^alpha * (1/d[0][j])^beta, rồi chia cho tổng.
    // TODO 2: độ dài L của chu trình "tuyen"; bay hơi mọi cạnh, rồi cộng Q/L vào các cạnh của tuyến (đối xứng).
    // TODO 3: xác suất như TODO 1 nhưng với mùi mới.
    printf("0\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], alpha = t[c++], beta = t[c++], rho = t[c++], Q = t[c++];
const d = [], tau = [];
for (let i = 0; i < n; i++) { d.push(t.slice(c, c + n)); c += n; }
for (let i = 0; i < n; i++) { tau.push(t.slice(c, c + n)); c += n; }
const tuyen = [];
for (let i = 0; i < n; i++) tuyen.push(t[c++] - 1);

// Xác suất kiến ở thành phố 0 chọn j = 1..n-1 (mọi thành phố khác còn chưa đi): tỉ lệ với tau^alpha * eta^beta.
function xacSuat(mui) {
  const w = [];
  for (let j = 1; j < n; j++) w.push(Math.pow(mui[0][j], alpha) * Math.pow(1 / d[0][j], beta));
  const tong = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / tong);
}
const dang = (a) => a.map((x) => x.toFixed(6)).join(" ");

print(dang(xacSuat(tau)));

// Bay hơi trước, đọng mùi sau — đúng thứ tự (§1.5). L là độ dài chu trình KHÉP KÍN.
let L = 0;
for (let i = 0; i < n; i++) L += d[tuyen[i]][tuyen[(i + 1) % n]];
const moi = tau.map((h) => h.map((x) => (1 - rho) * x));
for (let i = 0; i < n; i++) {
  const a = tuyen[i], b = tuyen[(i + 1) % n];
  moi[a][b] += Q / L; moi[b][a] += Q / L;
}
const canh = [];
for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) canh.push(moi[i][j]);
print(dang(canh));

print(dang(xacSuat(moi)));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
double alpha, bet, rho, Q;   // (không đặt tên toàn cục là beta: trùng std::beta của C++17)
vector<vector<double>> d;

// Xác suất kiến ở thành phố 0 chọn j = 1..n-1 (mọi thành phố khác còn chưa đi): tỉ lệ với tau^alpha * eta^beta.
vector<double> xacSuat(const vector<vector<double>>& mui) {
    vector<double> w(n - 1);
    double tong = 0;
    for (int j = 1; j < n; j++) {
        w[j - 1] = pow(mui[0][j], alpha) * pow(1.0 / d[0][j], bet);
        tong += w[j - 1];
    }
    for (double& x : w) x /= tong;
    return w;
}
void in(const vector<double>& a) {
    for (size_t i = 0; i < a.size(); i++) printf("%.6f%c", a[i], i + 1 < a.size() ? ' ' : '\n');
}

int main() {
    scanf("%d %lf %lf %lf %lf", &n, &alpha, &bet, &rho, &Q);
    d.assign(n, vector<double>(n));
    vector<vector<double>> tau(n, vector<double>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) scanf("%lf", &d[i][j]);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) scanf("%lf", &tau[i][j]);
    vector<int> tuyen(n);
    for (int i = 0; i < n; i++) { scanf("%d", &tuyen[i]); tuyen[i]--; }

    in(xacSuat(tau));

    // Bay hơi trước, đọng mùi sau — đúng thứ tự (§1.5). L là độ dài chu trình KHÉP KÍN.
    double L = 0;
    for (int i = 0; i < n; i++) L += d[tuyen[i]][tuyen[(i + 1) % n]];
    vector<vector<double>> moi = tau;
    for (auto& h : moi) for (double& x : h) x *= (1 - rho);
    for (int i = 0; i < n; i++) {
        int a = tuyen[i], b = tuyen[(i + 1) % n];
        moi[a][b] += Q / L; moi[b][a] += Q / L;
    }
    vector<double> canh;
    for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) canh.push_back(moi[i][j]);
    in(canh);

    in(xacSuat(moi));
    return 0;
}
`
      },
      goiY: [
        "Với một cạnh (0, j): sức hút = tau[0][j] ** alpha * (1 / d[0][j]) ** beta; xác suất = sức hút / tổng sức hút của các j = 1..n-1.",
        "Độ dài tuyến L cộng cả cạnh cuối nối về đầu: d[tuyen[n-1]][tuyen[0]]. Nhớ cập nhật đối xứng, tau[a][b] và tau[b][a].",
        "Bay hơi nhân MỌI cạnh với (1 − ρ) trước; chỉ sau đó mới cộng Q/L vào các cạnh của tuyến. Làm ngược thứ tự sẽ ra số khác (§1.5, “theo đúng thứ tự này”)."
      ]
    }
  ]
});
