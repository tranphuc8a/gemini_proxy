/* Thực hành — Bài 1: Từ “đúng” sang “tốt”: mô hình hoá bài toán tối ưu.
   Hai lab dạng `tuDapAn` (một đáp án đúng cho mỗi bộ dữ liệu):
     · evaluate-p1       — cài hàm evaluate của P1 đúng như mô hình (§7.2): ràng buộc cứng, cắt dãy tại đơn đầu tiên vượt giờ;
     · cuc-tri-lan-can   — “cực trị cục bộ là tính chất của cặp (bài toán, lân cận)” (§5.3), đếm trên cái túi P0. */
(function () {
  "use strict";
  var TI = TH.tienIch;

  /* ------------------------------------------------------------------ lab 1: evaluate của P1 */
  /* Mô phỏng evaluate (§7.2). boQua = true là biến thể `continue` (chỉ để dựng dữ liệu phân biệt hai cách). */
  function chayDay(inst, seq, boQua) {
    var hx = inst.kx, hy = inst.ky, tg = 0, tien = 0, giao = 0, cuoi = -1, da = {};
    for (var i = 0; i < seq.length; i++) {
      var id = seq[i];
      if (da[id]) continue;                                   /* đơn đã giao rồi: bỏ qua */
      var chiPhi = Math.abs(inst.x[id] - hx) + Math.abs(inst.y[id] - hy) + inst.s[id];
      if (tg + chiPhi > inst.T) { if (boQua) continue; break; }   /* ràng buộc CỨNG: hết giờ thì DỪNG */
      tg += chiPhi; tien += inst.p[id]; giao++; da[id] = 1; hx = inst.x[id]; hy = inst.y[id]; cuoi = id;
    }
    return [tien, giao, tg, cuoi];       /* phần tử thứ 4 (đơn giao cuối cùng) chỉ để dựng dữ liệu */
  }

  TH.vande.dangKy("b01-evaluate-p1", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TI.rng(seed), n = tham.n || 40, x = [], y = [], p = [], s = [], ds = [], i;
      for (i = 0; i < n; i++) { x.push(r.khoang(0, 99)); y.push(r.khoang(0, 99)); p.push(r.khoang(100, 1000)); s.push(r.khoang(5, 30)); ds.push(i); }
      var inst = { n: n, T: 480, kx: 50, ky: 50, x: x, y: y, p: p, s: s, seq: [] };
      /* Dãy cố ý DÀI hơn số đơn giao được. Test seed chẵn: kéo dài đơn giao cuối cùng cho tới khi nó kết thúc đúng
         phút T (để ai cài `>=` thay vì `>` bị bắt). Test seed lẻ: chọn dãy sao cho `break` và `continue` cho kết quả
         khác nhau (để ai cài nhầm `continue` bị bắt). Tất định theo seed. */
      var seq = null, canBien = seed % 2 === 0;
      for (var lan = 0; lan < 400; lan++) {
        var perm = TI.tron(ds, r), a = chayDay(inst, perm, false), bu = 0;
        seq = perm;
        if (canBien && a[3] >= 0 && a[2] < inst.T) {
          bu = inst.T - a[2]; inst.s[a[3]] += bu; a = chayDay(inst, perm, false);
        }
        if (canBien ? a[2] === inst.T : chayDay(inst, perm, true)[0] > a[0]) break;
        if (bu) inst.s[a[3]] -= bu;
      }
      if (tham.lap) {                                         /* chèn vài đơn lặp vào phần sẽ được giao: phải bị bỏ qua */
        var g = chayDay(inst, seq, false)[1];
        seq = seq.slice();
        for (var d = 0; d < 4; d++) { var pos = r.khoang(1, Math.max(1, g)); seq.splice(pos, 0, seq[r.int(pos)]); }
      }
      inst.seq = seq;
      return inst;
    },
    viet: function (inst) {
      var o = inst.n + " " + inst.T + "\n" + inst.kx + " " + inst.ky + "\n";
      for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + " " + inst.p[i] + " " + inst.s[i] + "\n";
      return o + inst.seq.length + "\n" + inst.seq.map(function (v) { return v + 1; }).join(" ") + "\n";
    },
    giai: function (inst) { return chayDay(inst, inst.seq, false).slice(0, 3); },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `n T` — số đơn và số phút trong ngày (480). Dòng 2: `kx ky` — toạ độ kho. Tiếp theo `n` dòng, dòng `i` là `x y p s` (toạ độ, tiền, số phút giao của đơn `i`, đánh số từ 1). Dòng kế: `k` — độ dài dãy. Dòng cuối: `k` chỉ số đơn (từ 1) theo thứ tự ghé; dãy này **dài hơn** số đơn thật sự giao được.",
      ra: "Một dòng gồm ba số nguyên: `tien so_don thoi_gian` — tổng tiền thu được, số đơn thật sự giao, và tổng số phút đã dùng (đi + giao) khi hàm dừng."
    }
  }));

  /* ------------------------------------------------------------------ lab 2: cực trị cục bộ theo lân cận */
  function demBit(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  /* Với x trên cái túi P0: [f(x), Σw(x), (best_d, opt_d) với d = 1, 2, 3].
     N_d = các nghiệm HỢP LỆ khác x, khác x ở nhiều nhất d ô. best_d = f lớn nhất trong N_d (−1 nếu rỗng);
     opt_d = 1 nếu f(x) ≥ best_d (x là cực trị cục bộ của N_d). */
  function phanTichLanCan(inst) {
    var n = inst.n, xm = 0, fx = 0, wx = 0, i;
    for (i = 0; i < n; i++) if (inst.x[i]) { xm |= 1 << i; fx += inst.p[i]; wx += inst.w[i]; }
    var best = [-1, -1, -1];
    for (var m = 1; m < (1 << n); m++) {
      var k = demBit(m);
      if (k > 3) continue;
      var y = xm ^ m, wy = 0, fy = 0;
      for (i = 0; i < n; i++) if ((y >> i) & 1) { wy += inst.w[i]; fy += inst.p[i]; }
      if (wy > inst.W) continue;
      for (var d = k; d <= 3; d++) if (fy > best[d - 1]) best[d - 1] = fy;
    }
    var kq = [fx, wx];
    for (var t = 0; t < 3; t++) { kq.push(best[t]); kq.push(best[t] <= fx ? 1 : 0); }
    return kq;
  }

  TH.vande.dangKy("b01-cuc-tri-lan-can", TH.vande.tuDapAn({
    sinh: function (seed) {
      /* Ba kiểu kết quả quay vòng theo seed: (opt₂, opt₃) = (0,0) · (1,0) · (1,1). Rejection sampling, tất định.
         Kiểu (1,1) còn buộc có một hàng xóm HOÀ điểm với x (best₂ = f(x), nhờ hai món giống hệt nhau) để ai viết
         `f(x) > best` thay vì `f(x) ≥ best` bị bắt. */
      var r = TI.rng(seed), muon = [[0, 0], [1, 0], [1, 1]][seed % 3], hoa = seed % 3 === 2, inst = null;
      for (var lan = 0; lan < 1500; lan++) {
        var n = r.khoang(9, 12), w = [], p = [], i;
        for (i = 0; i < n; i++) { w.push(r.khoang(3, 20)); p.push(r.khoang(5, 60)); }
        if (hoa) { var a = r.int(n), b = r.int(n - 1); if (b >= a) b++; w[b] = w[a]; p[b] = p[a]; }
        var tong = 0, wMax = 0;
        for (i = 0; i < n; i++) { tong += w[i]; if (w[i] > wMax) wMax = w[i]; }
        var W = Math.max(wMax, Math.floor(tong * (0.35 + 0.15 * r())));
        /* nghiệm xuất phát: nhét ngẫu nhiên cho tới khi hết chỗ ⇒ luôn là cực trị cục bộ của “thêm/bớt 1 món” */
        var thuTu = TI.tron(w.map(function (_, j) { return j; }), r), x = [], con = W;
        for (i = 0; i < n; i++) x.push(0);
        thuTu.forEach(function (j) { if (w[j] <= con) { con -= w[j]; x[j] = 1; } });
        inst = { n: n, W: W, w: w, p: p, x: x };
        var kq = phanTichLanCan(inst);
        if (kq[5] === muon[0] && kq[7] === muon[1] && (!hoa || kq[4] === kq[0])) break;
      }
      return inst;
    },
    viet: function (inst) {
      var o = inst.n + " " + inst.W + "\n";
      for (var i = 0; i < inst.n; i++) o += inst.w[i] + " " + inst.p[i] + "\n";
      return o + inst.x.join(" ") + "\n";
    },
    giai: phanTichLanCan,
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `n W` — số món và sức chứa (n ≤ 12). Tiếp theo `n` dòng `w p` — cân nặng và giá trị. Dòng cuối: `n` số 0/1, `x_i = 1` nghĩa là món `i` đang trong túi. Nghiệm `x` luôn hợp lệ và không rỗng.",
      ra: "Bốn dòng. Dòng 1: `f(x) tong_can` của x. Dòng 2, 3, 4 ứng với lân cận N₁, N₂, N₃: `best opt`, trong đó `best` là giá trị lớn nhất của một **nghiệm hợp lệ** khác `x` và khác `x` ở nhiều nhất 1 (2, 3) ô — in `-1` nếu không có — còn `opt` là `1` nếu `f(x) ≥ best` (x là cực trị cục bộ), ngược lại `0`."
    }
  }));

  /* ================================================================== bài thực hành */
  TH.dangKy({
    id: "bai-01-mo-hinh-hoa",

    tomTat: [
      "Bài toán của khoá hỏi “**tốt đến đâu?**” (thang đo liên tục), không phải “đúng hay sai?”: không ai biết đáp án tối ưu, không có `expected` để so, và điểm phụ thuộc thời gian cho chạy. Cái thang đo ấy do **bạn** định nghĩa — đó là mô hình hoá, và nó quyết định trần điểm của bạn.",
      "Mô hình hoá là trả lời ba câu hỏi **theo đúng thứ tự**: ① một lời giải trông thế nào → không gian nghiệm S; ② lời giải nào bị loại → ràng buộc C; ③ lời giải nào tốt hơn → hàm mục tiêu f. Phải làm ① trước vì C và f đều là hàm của lời giải.",
      "Bài toán tối ưu tổ hợp là bộ ba (S, C, f) với x⋆ = argmax f(x) trên các nghiệm hợp lệ — argmax trả về **lời giải**, không phải điểm. Quy ước luôn **cực đại hoá**; đổi dấu bằng f = −chi phí, **không** dùng 1/chi phí (làm méo thang đo, các Δ sau đó sai).",
      "P0 với 5 món (W = 10): tối ưu {B, D, E} = 100 điểm. Món đắt nhất A (60) không nằm trong nghiệm tối ưu — tham lam theo giá trị kém 40 %. Nghiệm tối ưu **bão hoà** ngân sách (10/10 kg), nên nghiệm còn dư chỗ thêm được món có giá trị dương là chắc chắn chưa tối ưu.",
      "Cực trị cục bộ là tính chất của **cặp (bài toán, lân cận)**: {B, C} (90 điểm) kẹt với lân cận “thêm/bớt 1 món” nhưng thoát được khi cho phép bỏ 1 món và thêm 2 món (→ {B, D, E} = 100). Kẹt thường là lỗi lân cận, không phải bài toán khó — đó là ý của VNS (Bài 15).",
      "Ràng buộc **cứng** (vi phạm thì bộ chấm trả 0) không bao giờ được vi phạm ở nghiệm nộp; ràng buộc **mềm** (vi phạm chỉ bị trừ điểm) đưa vào f dưới dạng khoản phạt với `max(0, ·)`. Nới cứng thành mềm cần phạt M đủ lớn để nghiệm cuối hợp lệ nhưng không quá lớn kẻo lại bị bó cứng; nghiệm nộp phải qua đúng hàm kiểm của bộ chấm.",
      "P1: một lời giải là **dãy có thứ tự** không lặp, |S| = Σ n!/(n−k)! > 120!/105! ≈ 10³¹ khi n = 120. Ràng buộc d(kho, π₁) + Σ d(πᵢ₋₁, πᵢ) + Σ s ≤ 480 (không quay về kho); f = Σ p — chi phí nằm trong ràng buộc, không bị trừ trực tiếp vào f.",
      "Hàm `evaluate` là bản dịch trực tiếp của mô hình và là nguồn sự thật duy nhất. Mô hình sai không bao giờ tự báo lỗi; dấu hiệu tai hại nhất là hàm mục tiêu tự viết không khớp bộ chấm — luôn đối chiếu điểm tự tính với điểm bộ chấm trả về."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§1.2",
        hoi: "Điểm khác biệt cốt lõi giữa một bài lập trình thi đấu quen thuộc và bài toán tối ưu của khoá này là gì?",
        chon: [
          "Bài của khoá luôn có dữ liệu lớn hơn nên phải viết thuật toán phức tạp hơn",
          "Bài quen thuộc hỏi “đúng hay sai?” (có đáp án, kiểm bằng test); bài của khoá hỏi “tốt đến đâu?” — một thang đo liên tục mà bạn phải tự định nghĩa",
          "Bài của khoá không có ràng buộc, chỉ có hàm mục tiêu",
          "Bài của khoá có đáp án đúng duy nhất, chỉ là máy mới tính nổi"
        ],
        dung: 1,
        giaiThich: "Ba tính chất quen thuộc — có một đáp án đúng duy nhất, kiểm được bằng test, thành công = đúng + đủ nhanh — đều biến mất: không ai biết tối ưu là bao nhiêu, không có `expected`, và điểm phụ thuộc thời gian bạn cho thuật toán chạy. Kích thước dữ liệu không phải khác biệt về bản chất; ràng buộc vẫn còn (cứng và mềm); và vì không có đáp án đúng duy nhất nên “thang đo tốt” phải do bạn dựng ra — chính là mô hình hoá."
      },
      {
        id: "q2", loai: "mot", doKho: 2, ref: "§2.1",
        hoi: "Một bạn đọc đề “tối đa hoá tiền”, viết ngay f = Σ pᵢxᵢ rồi mới loay hoay xem x là gì. Lỗi tư duy ở đâu?",
        chon: [
          "Hàm mục tiêu luôn phải viết sau cùng vì nó là phần khó nhất",
          "Không có lỗi: f có thể viết trước, còn S chỉ là chi tiết cài đặt",
          "Chưa trả lời câu ① (một lời giải trông thế nào) nên f được viết cho một S chưa rõ — ràng buộc và f đều là hàm của lời giải",
          "Tối đa hoá tiền thì phải dùng f = 1/tiền"
        ],
        dung: 2,
        giaiThich: "Ràng buộc là tính chất của lời giải, hàm mục tiêu là phép tính trên lời giải, nên chưa biết lời giải trông thế nào thì không có gì để đặt ràng buộc hay chấm điểm; f được viết cho một S về sau hoá ra không đúng. Thứ tự không phải vì “khó hay dễ” mà vì phụ thuộc: ② và ③ nhận đầu vào từ ①. Biểu diễn không phải chi tiết cài đặt (Cạm bẫy 4, Bài 3), và 1/tiền là cách đổi dấu sai."
      },
      {
        id: "q3", loai: "so", doKho: 1, ref: "§7.1", donVi: "(phút)",
        hoi: "Kho ở (0, 0). Ba đơn nằm ở (0, 0), (0, 50) và (0, 100). Xét thời gian di chuyển bằng khoảng cách Manhattan (bỏ qua thời gian giao). Nếu đi theo thứ tự (0, 50) → (0, 100) → (0, 0), tổng thời gian di chuyển là bao nhiêu phút?",
        dapAn: 200, saiSo: 0,
        giaiThich: "Kho → (0, 50): 50; (0, 50) → (0, 100): 50; (0, 100) → (0, 0): 100; tổng 200 phút. Cùng ba đơn đó đi gần → xa chỉ mất 100, còn xa → gần → giữa mất 250: chọn cùng một tập nhưng đổi thứ tự là chênh hàng trăm phút. Vì thế lời giải của P1 phải là dãy có thứ tự chứ không phải tập con, và “chọn” với “sắp thứ tự” không tách rời được."
      },
      {
        id: "q4", loai: "so", doKho: 2, ref: "§7.1",
        hoi: "P1 với n = 4 đơn: một lời giải là dãy không lặp gồm k đơn (k từ 0 đến 4), thứ tự có nghĩa. Dùng công thức |S| = Σₖ n!/(n−k)!, có bao nhiêu lời giải?",
        dapAn: 65, saiSo: 0,
        giaiThich: "k = 0: 1 dãy rỗng; k = 1: 4; k = 2: 4·3 = 12; k = 3: 4·3·2 = 24; k = 4: 24. Tổng 1 + 4 + 12 + 24 + 24 = 65. So với chỉ chọn tập con (2⁴ = 16), việc có thứ tự đã làm không gian lớn hơn hơn 4 lần ngay ở n = 4; với n = 120 chỉ riêng các dãy độ dài 15 đã cỡ 10³¹."
      },
      {
        id: "q5", loai: "mot", doKho: 2, ref: "§3.4 (b)",
        hoi: "Nghiệm hợp lệ của bạn cho cái túi chỉ dùng 6/10 kg, và còn một món nặng 3 kg (giá trị dương) chưa lấy. Bạn có thể kết luận gì mà KHÔNG cần biết giá trị tối ưu?",
        chon: [
          "Nghiệm đã tối ưu vì không vi phạm ràng buộc",
          "Chưa kết luận được gì, vì phải biết cực trị toàn cục mới so sánh được",
          "Chỉ kết luận được sau khi chạy thêm thời gian",
          "Nghiệm chắc chắn chưa tối ưu: thêm món 3 kg vẫn hợp lệ (9 ≤ 10) và làm tổng giá trị tăng"
        ],
        dung: 3,
        giaiThich: "Nghiệm tối ưu của bài có ngân sách gần như luôn bão hoà: nếu còn chỗ nhét được một món có giá trị dương thì nhét vào là tốt hơn, mâu thuẫn với việc đang tối ưu. Đây là một phép kiểm miễn phí — chỉ cần so tài nguyên còn dư, không cần biết tối ưu. Hợp lệ không có nghĩa là tối ưu, và không cần chạy thêm để biết điều này. (Ngoại lệ duy nhất là khi mọi món còn lại đều quá nặng.)"
      },
      {
        id: "q6", loai: "mot", doKho: 2, ref: "§6.1",
        hoi: "Bộ chấm của một đề thi trả SCORE = 0 nếu tổng thời gian vượt 720 phút, còn nếu kết thúc ngày sớm thì chỉ mất tiền thưởng. Phân loại hai điều kiện và cách xử lý nào đúng?",
        chon: [
          "Vượt 720 phút là ràng buộc cứng (không bao giờ để xuất hiện ở nghiệm nộp); kết thúc sớm là ràng buộc mềm (trừ vào hàm mục tiêu)",
          "Cả hai là ràng buộc cứng vì đề dùng chữ “phải”",
          "Vượt 720 phút là ràng buộc mềm vì có thể “sửa sau”",
          "Cả hai là ràng buộc mềm vì cuối cùng đều quy ra điểm"
        ],
        dung: 0,
        giaiThich: "Cách phân biệt nhanh: nếu vi phạm thì bộ chấm trả về 0 hay một số thấp hơn? Trả 0 là cứng, số thấp hơn là mềm. Đề bài hay dùng chữ “nên, cần, phải” lẫn lộn nên chỉ mã nguồn bộ chấm nói thật. Coi ràng buộc cứng là mềm rồi “sửa sau” sẽ nộp bài bị 0 điểm (dấu hiệu mô hình hoá sai ở §9)."
      },
      {
        id: "q7", loai: "nhieu", doKho: 3, ref: "§6.3",
        hoi: "Bạn tạm nới một ràng buộc cứng thành mềm bằng khoản phạt M lớn. Chọn những phát biểu ĐÚNG.",
        chon: [
          "Khoản phạt nên viết M·(Σwᵢxᵢ − W), không cần `max(0, ·)` cho gọn",
          "M quá nhỏ: thuật toán thấy vi phạm rồi chịu phạt vẫn có lợi, nên nghiệm cuối có thể không hợp lệ",
          "M quá lớn (ví dụ 10¹⁸): vùng không hợp lệ thành vực thẳng đứng, thuật toán không dám bước vào — lại bị bó cứng như ràng buộc cứng",
          "Chọn M càng lớn càng tốt, cho chắc ăn",
          "Với đề “vi phạm ⇒ 0 điểm”, được nới trong lúc tìm kiếm nhưng nghiệm nộp cuối bắt buộc hợp lệ, kiểm bằng đúng hàm kiểm của bộ chấm"
        ],
        dung: [1, 2, 4],
        giaiThich: "M phải đủ lớn để nghiệm cuối hợp lệ nhưng không lớn tới mức vô dụng; và với luật “vi phạm ⇒ 0” bước kiểm cuối là bắt buộc, dùng hàm của bộ chấm chứ không phải hàm tự viết. Bỏ `max(0, ·)` là lỗi dấu kinh điển: khi còn dư chỗ khoản phạt âm sẽ trở thành tiền thưởng cho việc dùng ít tài nguyên. “M càng lớn càng tốt” sai vì dẫn tới đúng tình trạng bó cứng mà kỹ thuật nới sinh ra để chữa."
      },
      {
        id: "q8", loai: "mot", doKho: 2, ref: "§4.2",
        hoi: "Đề yêu cầu cực tiểu hoá chi phí, còn khoá học quy ước luôn cực đại hoá. Vì sao nên đặt f = −chi phí thay vì f = 1/chi phí?",
        chon: [
          "Vì 1/chi phí làm nghiệm tối ưu chuyển sang một nghiệm khác",
          "Vì 1/chi phí làm méo thang đo (chênh 10→11 không bằng chênh 100→101), nên mọi phép tính Δ về sau sẽ sai",
          "Vì −chi phí chạy nhanh hơn 1/chi phí",
          "Vì quy ước cực đại hoá chỉ áp dụng được cho bài có tiền"
        ],
        dung: 1,
        giaiThich: "Với chi phí dương, 1/chi phí vẫn đơn điệu nên argmax không đổi — nhưng thang đo bị bóp méo: giảm chi phí từ 11 xuống 10 làm 1/chi phí tăng 0,0091, còn giảm từ 101 xuống 100 chỉ tăng 0,0001, dù cả hai đều là “giảm 1”. Các công thức có dấu về sau (nhận nước đi, xác suất chấp nhận) dựa trên Δ nên sẽ sai. −chi phí giữ nguyên chênh lệch và không đổi hướng sắp xếp một cách bất ngờ."
      },
      {
        id: "q9", loai: "mot", doKho: 3, ref: "§5.3",
        hoi: "Cái túi P0 (A 60/10, B 50/5, C 40/5, D 30/3, E 20/2, W = 10): {B, C} (90 điểm, vừa khít 10 kg) có phải là cực trị cục bộ không?",
        chon: [
          "Có, vì cực trị cục bộ là tính chất của bài toán, không phụ thuộc cách đi",
          "Không, vì {B, D, E} tốt hơn nên {B, C} không bao giờ là cực trị cục bộ",
          "Có với lân cận “thêm/bớt 1 món”, nhưng KHÔNG với lân cận cho phép bỏ 1 món rồi thêm 2 món (bỏ C, thêm D và E → {B, D, E} = 100)",
          "Không, vì nó đã dùng hết 10 kg"
        ],
        dung: 2,
        giaiThich: "Cực trị cục bộ là tính chất của cặp (bài toán, lân cận), không phải của bài toán. Với “thêm/bớt 1 món” mọi nước đi từ {B, C} đều vượt cân hoặc giảm điểm nên nó kẹt ở 90; nhưng nếu cho phép bỏ C rồi thêm D, E thì đạt {B, D, E} = 100. Việc có nghiệm tốt hơn ở xa không làm nó mất tư cách cực trị cục bộ (đó chính là sự khác nhau giữa cục bộ và toàn cục), còn dùng hết 10 kg chỉ là bão hoà ngân sách, không liên quan. Hệ quả: khi thuật toán kẹt, hãy nghĩ tới đổi lân cận (Bài 15) trước khi chạy lâu hơn."
      },
      {
        id: "q10", loai: "nhieu", doKho: 2, ref: "§7.1",
        hoi: "Chọn những phát biểu ĐÚNG về mô hình hoá bài toán P1 (ship hàng một ngày, 480 phút, không cần quay về kho).",
        chon: [
          "Ràng buộc phải cộng thêm d(đơn cuối, kho) vì xe phải về kho",
          "S là các dãy không lặp các đơn, vì chi phí di chuyển phụ thuộc thứ tự",
          "S là các tập con của các đơn, vì thứ tự ghé không ảnh hưởng chi phí",
          "Ràng buộc là d(kho, π₁) + Σ d(πᵢ₋₁, πᵢ) + Σ s ≤ 480, không có số hạng quay về kho",
          "Hàm mục tiêu là f(π) = Σ p; quãng đường không bị trừ trực tiếp mà chỉ ăn vào ngân sách 480 phút"
        ],
        dung: [1, 3, 4],
        giaiThich: "Đề nói “không cần quay về” nên thêm hay bỏ sót số hạng quay về kho đều làm lệch kết quả một cách có hệ thống. Chi phí đi lại phụ thuộc thứ tự nên S là dãy, không phải tập con (tập con chỉ đúng ở P0 và bài xem phim). Chi phí nằm trong ràng buộc chứ không trong f: “rút ngắn quãng đường” và “tăng điểm” không phải một việc, và Bài 11 §4 có trường hợp chúng đi ngược nhau."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 1, ref: "Bài tập 1.1",
        hoi: "Mô hình hoá bài sau thành (S, C, f): *Bạn có 8 giờ để ôn thi 5 môn. Môn i cần hᵢ giờ để đạt điểm gᵢ (học ít hơn hᵢ thì được 0). Tối đa hoá tổng điểm.* Cho biết |S|, bài thuộc lớp nào trong ba lớp bài toán và ngân sách bị bão hoà là gì.",
        goiY: ["Trả lời lần lượt ba câu hỏi ①②③ và nhớ thứ tự: S trước.", "So sánh với bài cái túi: món ↔ môn, cân nặng ↔ ?, giá trị ↔ ?"],
        mau: "① **S = {0,1}⁵**: xᵢ = 1 nghĩa là học đủ hᵢ giờ môn i. Thứ tự học không ảnh hưởng điểm nên chọn tập con, không cần dãy; |S| = 2⁵ = **32**.\n\n② **C:** Σ hᵢ·xᵢ ≤ 8.\n\n③ **f(x) = Σ gᵢ·xᵢ**, cực đại hoá.\n\nĐây chính là **cái túi 0/1** (hᵢ ↔ cân nặng, gᵢ ↔ giá trị, 8 giờ ↔ sức chứa) — lớp “tối ưu có giới hạn tài nguyên”; ngân sách bị bão hoà là **số giờ học (8 giờ)**. Nếu được học một phần môn và điểm tỉ lệ theo thời gian thì thành cái túi phân số, khi đó greedy theo tỉ số g/h là tối ưu (Bài 5).",
        tieuChi: ["S = {0,1}⁵ (hoặc “tập con của 5 môn”), |S| = 32", "C: tổng giờ các môn được chọn ≤ 8", "f = tổng điểm gᵢ của các môn được chọn", "Nhận ra đây là cái túi 0/1 và ngân sách bị bão hoà là giờ học"]
      },
      {
        id: "l2", doKho: 3, ref: "Bài tập 1.2, §5.3",
        hoi: "Với 5 món của §3 (A 60/10, B 50/5, C 40/5, D 30/3, E 20/2, W = 10), liệt kê mọi nghiệm hợp lệ có f ≥ 90. Cái nào là cực trị cục bộ với lân cận “thêm/bớt 1 món”? Còn lại gì nếu lân cận cho phép **đổi chỗ** (bỏ 1 món trong túi, thêm 1 món ngoài túi)? Và nếu cho phép **bỏ 1 món rồi thêm 2 món**?",
        goiY: ["Liệt kê hết nước đi từ từng nghiệm, nhớ kiểm cả điều kiện cân nặng.", "Với lân cận đổi chỗ, thử thay C bằng B."],
        mau: "**Nghiệm hợp lệ có f ≥ 90:** {B, C} = 90, {C, D, E} = 90, {B, D, E} = 100.\n\n**Lân cận “thêm/bớt 1 món”:** cả ba đều là cực trị cục bộ (thêm món nào cũng vượt 10 kg, bớt món nào cũng giảm điểm); chỉ {B, D, E} là cực trị toàn cục.\n\n**Lân cận “đổi chỗ 1 món lấy 1 món”:** {C, D, E} không còn là cực trị cục bộ vì bỏ C thêm B ra {B, D, E} = 100 > 90. {B, C} **vẫn** còn: mọi cách đổi đều ≤ 90 hoặc vượt cân ({C, D} = 70, {C, E} = 60, {B, D} = 80, {B, E} = 70, còn đổi với A thì quá 10 kg).\n\n**Lân cận “bỏ 1 món, thêm 2 món”:** {B, C} bỏ C thêm D, E thành {B, D, E} = 100 nên cũng **không còn** là cực trị cục bộ.\n\nKết luận: cùng một nghiệm, đổi lân cận là đảo ngược kết luận — cực trị cục bộ là tính chất của cặp (bài toán, lân cận). Ghi chú: §5.3 gọi lân cận này là “đổi tối đa **3** món” vì “bỏ 1, thêm 2” đổi **ba ô**; nếu chỉ cho đổi tối đa 2 ô thì {B, C} vẫn kẹt.",
        tieuChi: ["Liệt kê đúng {B, C} = 90, {C, D, E} = 90, {B, D, E} = 100", "Kết luận cả ba là cực trị cục bộ của “thêm/bớt 1 món”, chỉ {B, D, E} là toàn cục", "Chỉ ra {C, D, E} thoát được bằng đổi chỗ C → B, còn {B, C} thì không", "Chỉ ra {B, C} chỉ thoát khi cho phép bỏ 1 thêm 2, và rút ra: cực trị cục bộ phụ thuộc lân cận"]
      },
      {
        id: "l3", doKho: 2, ref: "Bài tập 1.3",
        hoi: "Đề nói: *“Mỗi tài xế nên nghỉ ít nhất 30 phút; nếu không, công ty bị phạt 200 000 đ.”* Đây là ràng buộc cứng hay mềm? Viết lại hàm mục tiêu để xử lý nó. Nếu đề đổi thành *“tài xế không nghỉ đủ 30 phút thì kết quả bị huỷ”* thì phải đổi gì?",
        goiY: ["Hỏi: nếu vi phạm, bộ chấm trả về 0 hay một số thấp hơn?", "Ràng buộc cứng thì đi vào S_hợp_lệ hay vào f?"],
        mau: "Là ràng buộc **mềm**: vi phạm vẫn dùng được, chỉ bị phạt tiền. Đưa vào hàm mục tiêu thành một khoản trừ:\n\nf(x) = doanh thu(x) − 200 000 · (số tài xế nghỉ chưa đủ 30 phút)\n\n(dấu trừ đúng; nếu phạt tỉ lệ theo mức thiếu thì dùng `max(0, 30 − nghỉᵢ)`, để giao dư giờ nghỉ không bị tính thành tiền thưởng).\n\nNếu đề đổi thành “bị huỷ” thì nó là ràng buộc **cứng**: nghiệm vi phạm bị loại khỏi S_hợp_lệ, khoản phạt biến mất khỏi f, và thuật toán không được sinh ra nghiệm vi phạm (hoặc nếu tạm nới trong lúc tìm kiếm thì nghiệm cuối cùng nộp lên phải được kiểm bằng đúng hàm kiểm hợp lệ của bộ chấm).",
        tieuChi: ["Kết luận là ràng buộc mềm vì chỉ bị phạt, không bị loại", "Viết f = doanh thu − 200 000 × (số tài xế nghỉ chưa đủ) với dấu trừ đúng", "Với đề “bị huỷ”: chuyển thành ràng buộc cứng, bỏ khoản phạt khỏi f", "Nêu nghiệm cuối phải qua hàm kiểm hợp lệ của bộ chấm"]
      },
      {
        id: "l4", doKho: 3, ref: "Bài tập 1.5, §7.2",
        hoi: "Hàm `evaluate` của P1 **dừng** (`break`) ở đơn đầu tiên vượt giờ; các đơn còn lại trong dãy bị bỏ. Nếu đổi `break` thành `continue` (bỏ qua đơn đó, thử đơn kế tiếp) thì mô hình toán thay đổi thế nào — đổi S, C hay f? Bài toán dễ hơn hay khó hơn? Nêu cách kiểm chứng.",
        goiY: ["Với `break`, điểm là tổng tiền của một tiền tố của dãy. Với `continue` thì sao?", "Hỏi: điểm tối ưu có đổi không? Mọi tuyến hợp lệ có còn nằm trong không gian tìm kiếm không?"],
        mau: "- Với `break`, f(seq) là tổng tiền của một **tiền tố** của dãy: phần sau chỗ vượt giờ không còn ảnh hưởng. Với `continue`, đơn vượt giờ bị bỏ nhưng các đơn sau vẫn được thử, nên f là tổng tiền của một **dãy con** và **mọi vị trí** của dãy đều có thể ảnh hưởng điểm.\n- Ràng buộc cứng 480 phút không đổi (tuyến thực sự được giao vẫn không vượt giờ). Cái đổi là **cách giải mã** dãy thành tuyến thực sự, tức nghĩa của S và f: dãy giờ giống một *danh sách ưu tiên* mà bộ chấm tự lọc.\n- Giá trị tối ưu **không đổi** (mọi tuyến hợp lệ vẫn là một dãy cho chính nó), nhưng nhiều dãy khác nhau cho cùng kết quả hơn.\n- Dễ hơn cho thuật toán vì **mọi dãy đều dùng được**, nhưng khó suy luận hơn: đổi chỗ một đơn ở đầu có thể làm cả chuỗi quyết định “bỏ qua” phía sau đổi theo, nên Δ không còn cục bộ.\n- Kiểm chứng: sửa `p1.h`, chạy `./bin/p1_compare` trên cùng bộ seed và so điểm trung bình, thấp nhất và độ lệch chuẩn (Bài 4); đừng kết luận từ một test.",
        tieuChi: ["Nêu đúng: `break` cắt tiền tố, `continue` bỏ đơn quá giờ rồi thử tiếp", "Xác định đây là đổi cách giải mã/chấm điểm (nghĩa của S và f), không phải đổi ràng buộc 480 phút", "Nêu một hệ quả: mọi dãy đều hợp lệ, hoặc nhiều dãy cho cùng kết quả, hoặc Δ không còn cục bộ", "Đề xuất kiểm chứng bằng thực nghiệm trên nhiều test, cùng seed"]
      }
    ],

    lab: [
      {
        id: "evaluate-p1",
        ten: "Cài hàm evaluate của P1 đúng theo mô hình",
        doKho: 1,
        ref: "§7.1, §7.2, Bài tập 1.5",
        de: "Mô hình của P1 (§7.1) nói: ràng buộc là `d(kho, π₁) + Σ d(πᵢ₋₁, πᵢ) + Σ s ≤ 480` (không quay về kho), hàm mục tiêu là `f(π) = Σ p`. Việc của bạn là **dịch nguyên văn** mô hình đó thành code — hàm `evaluate` ở §7.2.\n\n" +
            "Bạn nhận một dãy `seq` các đơn (đánh số từ 1) **dài hơn** số đơn thật sự giao được. Đi từ kho lúc phút 0, ghé từng đơn theo thứ tự: chi phí đến đơn `id` là `d + s`, với `d` là khoảng cách Manhattan **từ vị trí hiện tại**. Nếu `t + chiPhi > T` thì **dừng hẳn** (ràng buộc cứng — các đơn còn lại trong dãy bị bỏ), ngược lại cộng tiền và chuyển vị trí. Một đơn xuất hiện lần thứ hai thì bỏ qua như chưa thấy (xem biến thể dữ liệu bên dưới).\n\n" +
            "In ra một dòng `tien so_don thoi_gian`. Bộ chấm báo rõ **giá trị thứ mấy** lệch: nếu hai số đầu đúng mà số thứ ba sai, bạn cộng sai thời gian (có đang tính cả chặng quay về kho, hay quên `s`?). Chấm trên 10 bộ dữ liệu, mức đạt chỉ có một: đúng cả 10.\n\n" +
            "**Suy ngẫm (Bài tập 1.5):** thử đổi `break` thành `continue`. Bộ chấm sẽ báo sai ở hầu hết các test — vì sao? Điều đó cho thấy nghĩa của “nghiệm” và của `f` đổi thế nào khi bạn đổi một dòng ràng buộc?",
        vanDe: "b01-evaluate-p1",
        tham: { n: 40 },
        bienThe: [
          { ten: "Dãy sạch (mỗi đơn xuất hiện nhiều nhất một lần)", tham: { n: 40, lap: false } },
          { ten: "Dãy lẫn đơn lặp (phải bỏ qua đơn đã giao)", tham: { n: 40, lap: true } }
        ],
        soTest: 10,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào : "n T", "kx ky", n dòng "x y p s", rồi k, rồi k chỉ số đơn (từ 1) theo thứ tự ghé.
// Đầu ra  : một dòng "tien so_don thoi_gian".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], T = t[c++], kx = t[c++], ky = t[c++];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[c++]); y.push(t[c++]); p.push(t[c++]); s.push(t[c++]); }
const k = t[c++];
const seq = [];
for (let i = 0; i < k; i++) seq.push(t[c++] - 1);   // đổi về chỉ số từ 0

let tien = 0, giao = 0, tg = 0;
// TODO: đi từ kho (kx, ky). Với mỗi id trong seq: bỏ qua nếu đã giao; chiPhi = d(vị trí hiện tại, id) + s[id];
//       nếu tg + chiPhi > T thì DỪNG HẲN; ngược lại cộng tiền, tg, đếm đơn, và chuyển vị trí sang đơn id.

print(tien, giao, tg);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T, kx, ky;
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    int k;
    scanf("%d", &k);
    vector<int> seq(k);
    for (int i = 0; i < k; i++) { scanf("%d", &seq[i]); seq[i]--; }   // đổi về chỉ số từ 0

    long long tien = 0;
    int giao = 0, tg = 0;
    // TODO: đi từ kho (kx, ky). Với mỗi id trong seq: bỏ qua nếu đã giao; chiPhi = d(vị trí hiện tại, id) + s[id];
    //       nếu tg + chiPhi > T thì DỪNG HẲN; ngược lại cộng tiền, tg, đếm đơn, và chuyển vị trí sang đơn id.

    printf("%lld %d %d\n", tien, giao, tg);
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], T = t[c++], kx = t[c++], ky = t[c++];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[c++]); y.push(t[c++]); p.push(t[c++]); s.push(t[c++]); }
const k = t[c++];
const seq = [];
for (let i = 0; i < k; i++) seq.push(t[c++] - 1);

let tien = 0, giao = 0, tg = 0, hienX = kx, hienY = ky;
const daGiao = new Array(n).fill(false);
for (const id of seq) {
  if (daGiao[id]) continue;                                            // đơn lặp: bỏ qua
  const chiPhi = Math.abs(x[id] - hienX) + Math.abs(y[id] - hienY) + s[id];   // d từ vị trí HIỆN TẠI, cộng thời gian giao
  if (tg + chiPhi > T) break;                                          // ràng buộc cứng: hết giờ thì DỪNG, không phải continue
  tg += chiPhi; tien += p[id]; giao++;
  daGiao[id] = true; hienX = x[id]; hienY = y[id];
}
print(tien, giao, tg);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T, kx, ky;
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    int k;
    scanf("%d", &k);
    vector<int> seq(k);
    for (int i = 0; i < k; i++) { scanf("%d", &seq[i]); seq[i]--; }

    long long tien = 0;
    int giao = 0, tg = 0, hienX = kx, hienY = ky;
    vector<bool> daGiao(n, false);
    for (int id : seq) {
        if (daGiao[id]) continue;                                         // đơn lặp: bỏ qua
        int chiPhi = abs(x[id] - hienX) + abs(y[id] - hienY) + s[id];     // d từ vị trí HIỆN TẠI, cộng thời gian giao
        if (tg + chiPhi > T) break;                                       // ràng buộc cứng: hết giờ thì DỪNG
        tg += chiPhi; tien += p[id]; giao++;
        daGiao[id] = true; hienX = x[id]; hienY = y[id];
    }
    printf("%lld %d %d\n", tien, giao, tg);
    return 0;
}
`
        },
        goiY: [
          "Chi phí đến đơn `id` là `d + s[id]`, với `d = |x − hienX| + |y − hienY|` tính từ **vị trí hiện tại** — kho ở đơn đầu tiên, rồi là đơn vừa giao.",
          "Điều kiện cứng là `tg + chiPhi > T`. Khi gặp nó thì `break` (các đơn còn lại của dãy bị bỏ), đừng `continue`.",
          "Đơn đã giao rồi (xuất hiện lần hai trong dãy) phải bị bỏ qua hoàn toàn: không cộng tiền, không cộng thời gian, không đổi vị trí. Dùng một mảng `daGiao`."
        ]
      },
      {
        id: "cuc-tri-lan-can",
        ten: "Cực trị cục bộ phụ thuộc vào lân cận",
        doKho: 2,
        ref: "§5.2, §5.3",
        de: "Cực trị cục bộ **không** phải tính chất của bài toán mà của **cặp (bài toán, lân cận)** (§5.3). Lab này cho bạn tự đo điều đó trên cái túi P0.\n\n" +
            "Cho một túi `n ≤ 12` món và một nghiệm hợp lệ `x` (dãy 0/1). Với `d = 1, 2, 3`, gọi lân cận `N_d` là tập các nghiệm **hợp lệ** khác `x` và khác `x` ở **nhiều nhất `d` ô** (`N₁` = thêm/bớt 1 món; `N₂` thêm cả đổi chỗ 1–1 và thêm/bớt 2 món; `N₃` thêm cả “bỏ 1 món thêm 2 món”).\n\n" +
            "In ra bốn dòng: dòng 1 là `f(x)` và tổng cân của `x`; rồi với `d = 1, 2, 3` mỗi dòng gồm `best` (giá trị lớn nhất trong `N_d`, hoặc `-1` nếu rỗng) và `opt` — `1` nếu `x` là cực trị cục bộ của `N_d` (tức `f(x) ≥ best`), ngược lại `0`. Mức đạt chỉ có một: đúng cả 9 bộ dữ liệu.\n\n" +
            "Dữ liệu được dựng sao cho `x` luôn là cực trị cục bộ của `N₁`, nhưng không nhất thiết của `N₂`, `N₃`.\n\n" +
            "**Suy ngẫm:** hãy `log` ra `opt₁ opt₂ opt₃` của từng test. Có test nào mà `x` kẹt ở `N₁` nhưng thoát được ở `N₂`? Có test nào kẹt cả ở `N₂` mà `N₃` mới cứu? Điều đó nói gì về câu “thuật toán kẹt vì bài toán khó”? (§5.3, và là ý của VNS ở Bài 15)",
        vanDe: "b01-cuc-tri-lan-can",
        tham: {},
        soTest: 9,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào : "n W", n dòng "w p", rồi n số 0/1 (x_i = 1: món i đang trong túi).
// Đầu ra  : 4 dòng — "f(x) tong_can", rồi với d = 1, 2, 3: "best opt".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], W = t[c++];
const w = [], p = [], x = [];
for (let i = 0; i < n; i++) { w.push(t[c++]); p.push(t[c++]); }
for (let i = 0; i < n; i++) x.push(t[c++]);

let fx = 0, wx = 0;
// TODO: tính f(x) và tổng cân của x.

const best = [-1, -1, -1];
// TODO: duyệt mọi cách đổi từ 1 đến 3 ô của x (gợi ý: mặt nạ bit m, y = x XOR m, đếm số bit của m),
//       bỏ qua nghiệm vượt cân W, rồi cập nhật best[d−1] cho mọi d từ số bit của m đến 3.

print(fx, wx);
for (let d = 0; d < 3; d++) print(best[d], best[d] <= fx ? 1 : 0);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, W;
    scanf("%d %d", &n, &W);
    vector<int> w(n), p(n), x(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);
    for (int i = 0; i < n; i++) scanf("%d", &x[i]);

    int fx = 0, wx = 0;
    // TODO: tính f(x) và tổng cân của x.

    int best[3] = {-1, -1, -1};
    // TODO: duyệt mọi cách đổi từ 1 đến 3 ô của x (gợi ý: mặt nạ bit m, y = x XOR m, đếm số bit của m),
    //       bỏ qua nghiệm vượt cân W, rồi cập nhật best[d-1] cho mọi d từ số bit của m đến 3.

    printf("%d %d\n", fx, wx);
    for (int d = 0; d < 3; d++) printf("%d %d\n", best[d], best[d] <= fx ? 1 : 0);
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let c = 0;
const n = t[c++], W = t[c++];
const w = [], p = [], x = [];
for (let i = 0; i < n; i++) { w.push(t[c++]); p.push(t[c++]); }
for (let i = 0; i < n; i++) x.push(t[c++]);

let fx = 0, wx = 0, xm = 0;
for (let i = 0; i < n; i++) if (x[i]) { fx += p[i]; wx += w[i]; xm |= 1 << i; }

const best = [-1, -1, -1];
for (let m = 1; m < (1 << n); m++) {              // m = tập các ô bị đổi
  let k = 0;
  for (let b = m; b; b &= b - 1) k++;
  if (k > 3) continue;
  const y = xm ^ m;                               // nghiệm hàng xóm
  let wy = 0, fy = 0;
  for (let i = 0; i < n; i++) if ((y >> i) & 1) { wy += w[i]; fy += p[i]; }
  if (wy > W) continue;                           // chỉ xét nghiệm HỢP LỆ
  for (let d = k; d <= 3; d++) if (fy > best[d - 1]) best[d - 1] = fy;   // y thuộc N_d với mọi d ≥ k
}
print(fx, wx);
for (let d = 0; d < 3; d++) print(best[d], best[d] <= fx ? 1 : 0);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, W;
    scanf("%d %d", &n, &W);
    vector<int> w(n), p(n), x(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);
    for (int i = 0; i < n; i++) scanf("%d", &x[i]);

    int fx = 0, wx = 0, xm = 0;
    for (int i = 0; i < n; i++) if (x[i]) { fx += p[i]; wx += w[i]; xm |= 1 << i; }

    int best[3] = {-1, -1, -1};
    for (int m = 1; m < (1 << n); m++) {            // m = tập các ô bị đổi
        int k = __builtin_popcount(m);
        if (k > 3) continue;
        int y = xm ^ m, wy = 0, fy = 0;              // y = nghiệm hàng xóm
        for (int i = 0; i < n; i++) if ((y >> i) & 1) { wy += w[i]; fy += p[i]; }
        if (wy > W) continue;                        // chỉ xét nghiệm HỢP LỆ
        for (int d = k; d <= 3; d++) best[d - 1] = max(best[d - 1], fy);
    }
    printf("%d %d\n", fx, wx);
    for (int d = 0; d < 3; d++) printf("%d %d\n", best[d], best[d] <= fx ? 1 : 0);
    return 0;
}
`
        },
        goiY: [
          "Biểu diễn “các ô bị đổi” bằng một mặt nạ bit `m` (1 ≤ m < 2ⁿ), khi đó nghiệm hàng xóm là `y = xm XOR m` và số ô bị đổi là số bit 1 của `m`.",
          "Chỉ xét `m` có không quá 3 bit 1, và bỏ qua mọi `y` có tổng cân vượt `W`. Một hàng xóm đổi `k` ô thuộc `N_d` với mọi `d ≥ k` — nên cập nhật `best` cho cả `d = k, …, 3`.",
          "`opt_d = 1` đúng khi `f(x) ≥ best_d`: dùng `≥`, không phải `>` — định nghĩa cực trị cục bộ là `f(x) ≥ f(y)` với mọi `y` thuộc lân cận."
        ]
      }
    ]
  });
})();
