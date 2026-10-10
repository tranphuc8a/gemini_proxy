/* Thực hành — Bài 17: LNS & ALNS — phá và xây lại. */

/* Bài toán dựng riêng cho bài này (tiền tố b17-):
   - b17-tsp-lns: chu trình ngắn nhất, stdin có thêm mức phá `Q` (%) ngay dòng đầu (`n Q`).
   - b17-alns-trong-so: một lần cập nhật trọng số toán tử ALNS (§6.3) — chỉ có một đáp án đúng. */
(function () {
  "use strict";
  var tsp = TH.vande.lay("tsp");
  TH.vande.keThua("tsp", "b17-tsp-lns", {
    sinh: function (seed, tham) {
      var inst = tsp.sinh(seed, tham);
      inst.q = tham && tham.q != null ? tham.q : 30;
      return inst;
    },
    viet: function (inst) {
      return inst.n + " " + inst.q + "\n" + tsp.viet(inst).split("\n").slice(1).join("\n");
    },
    dinhDang: {
      vao: "Dòng 1: `n Q` — số điểm và **mức phá** `Q` (phần trăm số điểm bị phá mỗi vòng). Tiếp theo `n` dòng, dòng `i` là `x y` — toạ độ nguyên của điểm `i` (đánh số từ 1).",
      ra: tsp.dinhDang.ra
    }
  });

  var THUONG = [0, 1, 5, 10];        /* điểm thưởng theo kết quả: 0 từ chối · 1 chấp nhận · 2 tốt hơn hiện tại · 3 kỷ lục mới */
  TH.vande.dangKy("b17-alns-trong-so", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), S = (tham && tham.S) || 50, K = 3;
      var w = [r.khoang(8, 20) / 10, r.khoang(3, 14) / 10, 0.05];     /* toán tử thứ 3 đã “xui” từ trước: nằm sát sàn */
      var tay = [0.2 + 0.6 * r(), 0.2 + 0.6 * r(), 0.1];               /* “tay nghề” mỗi toán tử: xác suất ra kết quả tốt */
      var bo = r() < 0.45 ? 2 : -1;                                    /* nhiều test không dùng toán tử thứ 3 trong chu kỳ này */
      var xui = r() < 0.5;                                             /* nhiều test toán tử thứ 3 bị từ chối cả chu kỳ: rơi xuống dưới sàn 0,05 */
      var ds = [];
      for (var i = 0; i < S; i++) {
        var op = r.int(K);
        if (op === bo) op = r.int(2);
        var u = r(), s = tay[op], kq = u < 0.04 + 0.12 * s ? 3 : u < 0.15 + 0.35 * s ? 2 : u < 0.45 + 0.3 * s ? 1 : 0;
        if (op === 2 && xui) kq = 0;
        ds.push({ op: op + 1, kq: kq });
      }
      return { K: K, S: S, w: w, ds: ds };
    },
    viet: function (inst) {
      var s = inst.K + " " + inst.S + "\n" + inst.w.join(" ") + "\n";
      inst.ds.forEach(function (d) { s += d.op + " " + d.kq + "\n"; });
      return s;
    },
    giai: function (inst) {
      var w = inst.w.slice(), diem = [], dung = [], i;
      for (i = 0; i < inst.K; i++) { diem.push(0); dung.push(0); }
      inst.ds.forEach(function (d) { diem[d.op - 1] += THUONG[d.kq]; dung[d.op - 1]++; });
      for (i = 0; i < inst.K; i++) {
        if (dung[i] > 0) w[i] = 0.8 * w[i] + 0.2 * (diem[i] / dung[i]);
        if (w[i] < 0.05) w[i] = 0.05;
      }
      var tong = w.reduce(function (a, b) { return a + b; }, 0);
      return [w, w.map(function (x) { return x / tong; })];
    },
    saiSo: 1e-5,
    dinhDang: {
      vao: "Dòng 1: `K S` — số toán tử và số vòng của một chu kỳ. Dòng 2: `K` trọng số hiện tại `w₁ … w_K`. Rồi `S` dòng `op kq`: toán tử đã dùng ở vòng đó (1…K) và kết quả `kq` ∈ {0, 1, 2, 3} — 0 bị từ chối, 1 được chấp nhận dù không tốt hơn, 2 tốt hơn nghiệm hiện tại, 3 kỷ lục mới.",
      ra: "Một dòng `2K` số thực: `K` trọng số mới, rồi `K` xác suất chọn tương ứng `wᵢ / Σw` (sai số cho phép 10⁻⁵)."
    }
  }));
})();

TH.dangKy({
  id: "bai-17-lns-alns",

  tomTat: [
    "LNS = **phá q phần tử → xây lại bằng heuristic tốt → chấp nhận hay không → cập nhật best**. Mỗi vòng là một canh bạc rẻ: thua thì quay về nghiệm cũ, thắng thì giữ; đánh vài trăm lượt thì chỉ cần vài lượt trúng.",
    "Vì sao cần lân cận lớn: lời giải tốt hơn có thể **cách nghiệm hiện tại năm thay đổi** mà bốn bước đầu đều lỗ. Lịch F, G, A, B = 1 080 là cực trị cục bộ; bỏ cả A lẫn B rồi xây lại được F, G, C, D, E = 1 105 — leo đồi chỉ nhìn được một thay đổi.",
    "LNS **không duyệt** lân cận khổng lồ C(n, q)·q!; nó chỉ lấy **đúng một** phần tử — nghiệm do heuristic xây lại sinh ra. Toàn bộ cược nằm ở chỗ heuristic xây lại đủ giỏi; xây lại bừa thì LNS chỉ là khởi động lại ngẫu nhiên.",
    "Bốn toán tử phá: ngẫu nhiên (đa dạng), **tệ nhất** (p_j + λ·Δt nhỏ nhất — chỉ viết được nhờ giá mờ λ), **theo quan hệ** (bỏ các phần tử giống nhau; được dùng nhiều nhất trong họ ALNS theo Ropke & Pisinger — thứ hạng thật phụ thuộc bài toán), đoạn liên tiếp. Xây lại: chèn tham lam (nhanh) hoặc chèn tiếc nuối (kỳ vọng +2–5 % theo Bài 7 §3.3, chi phí cùng bậc, chưa có phép đo riêng; hợp với phá theo quan hệ).",
    "Mức phá q: dưới 10 % gần như local search; **15–35 %** là điểm ngọt; trên 50 % gần như xây lại từ đầu và mất thông tin. Thường lấy q ngẫu nhiên trong khoảng, ví dụ q ∼ U(0,1·m ; 0,4·m).",
    "ALNS = LNS + bánh xe roulette: chọn toán tử với xác suất wᵢ/Σw; thưởng +10 (kỷ lục mới), +5 (tốt hơn hiện tại), +1 (được chấp nhận), 0 (bị từ chối); mỗi 50 vòng cập nhật w ← 0,8·w + 0,2·(điểm trung bình), với **sàn dưới 0,05** để không toán tử nào bị tắt vĩnh viễn.",
    "Tiêu chí chấp nhận không nên quá chặt: chỉ nhận khi tốt hơn thì LNS kẹt nhanh — thêm xác suất 2–5 % nhận nghiệm xấu hoặc dùng tiêu chuẩn SA.",
    "ALNS không tự động tốt hơn: ở P1 (nghiệm ~14 phần tử) ALNS 65 892 thua GRASP+chèn 66 074; ở P2 (~65 phần tử) LNS hơn chèn toàn cục +3,00 % và có ý nghĩa thống kê (10 755,9 > 2·SE = 4 266,6). Quy tắc: đáng dùng khi q = 0,25·m ≥ 10, tức nghiệm ≥ ~40 phần tử."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "§1.3–1.4", donVi: "(nghìn)",
      hoi: "Bạn có 120 phút. Lịch hiện tại F, G, A, B thu 1 080 nghìn. Bỏ đồng thời A và B rồi xây lại bằng cách chọn khách lời nhất trên mỗi phút (F: 500/10 phút, G: 500/10, C, D, E: mỗi người 35 nghìn/33 phút, A và B: 40 nghìn/40 phút). Lịch mới thu tổng cộng bao nhiêu nghìn?",
      dapAn: 1105, saiSo: 0,
      giaiThich: "Sau khi bỏ A, B còn F, G (20 phút, trống 100). Chọn tiếp C, D, E (1,06 nghìn/phút, cao hơn A, B là 1,00): 20 + 33 + 33 + 33 = 119 ≤ 120 phút, còn 1 phút nên A và B không vừa. Tiền = 500 + 500 + 35 × 3 = 1 105 nghìn, hơn lịch cũ 25 nghìn — nhưng không thể tới đó bằng từng bước sửa một chỗ."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "§1.2–1.3",
      hoi: "Leo đồi với các phép sửa “một chỗ” không tìm được lịch F, G, C, D, E (1 105) từ lịch F, G, A, B (1 080). Lý do là gì?",
      chon: [
        "Lịch F, G, C, D, E vượt quá 120 phút nên không hợp lệ",
        "Khách C, D, E trả quá ít nên không bao giờ đáng nhận",
        "Leo đồi chỉ chạy được trên bài toán có không quá 4 khách",
        "Đường đi tới nó bắt buộc qua chỗ trũng: bỏ A, bỏ B rồi nhận C, D, E là năm thay đổi mà bốn bước đầu đều làm tiền thấp hơn 1 080"
      ],
      dung: 3,
      giaiThich: "Mọi phép sửa một chỗ (nhét thêm, đổi một lấy một, chỉ bỏ) đều làm tiền xấu đi, nên F, G, A, B là cực trị cục bộ; lời giải tốt hơn nằm cách đó năm thay đổi (bỏ A, bỏ B, nhận C, D, E; tiền đi 1 080 → 1 040 → 1 000 → 1 035 → 1 070 → 1 105, bốn bước đầu đều dưới 1 080) mà leo đồi chỉ nhìn được một. Lịch 1 105 dùng đúng 119 ≤ 120 phút nên hợp lệ; C, D, E hợp lý khi được nhận cùng lúc; và leo đồi không bị giới hạn số khách."
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "§2.1",
      hoi: "Lân cận của LNS có cỡ C(n, q)·q! — khổng lồ. LNS khai thác nó mà không duyệt nổi bằng cách nào?",
      chon: [
        "Duyệt ngẫu nhiên một nửa lân cận rồi lấy cái tốt nhất",
        "Dùng quy hoạch động để duyệt nhanh toàn bộ lân cận",
        "Không duyệt: chỉ lấy đúng một phần tử của lân cận — nghiệm do heuristic xây lại sinh ra — và đặt cược rằng heuristic đó đủ giỏi",
        "Thu nhỏ lân cận bằng cách chỉ cho phép phá q = 1 phần tử"
      ],
      dung: 2,
      giaiThich: "Đây là điểm khác về triết lý so với Bài 9–12 (duyệt lân cận nhỏ, lấy cái tốt nhất): LNS không duyệt lân cận lớn mà tin vào một mẫu duy nhất, nên chất lượng do heuristic xây lại bảo đảm. Duyệt một nửa hay quy hoạch động đều bất khả thi với cỡ 10³⁸; còn q = 1 thì quay về lân cận nhỏ, mất lý do tồn tại của LNS."
    },
    {
      id: "q4", loai: "so", doKho: 1, ref: "§4.5, §8.1", donVi: "(đơn)",
      hoi: "Một nghiệm của P2 có m = 65 đơn. Phá 25 % thì bỏ khoảng bao nhiêu đơn (làm tròn đến số nguyên)?",
      dapAn: 16, saiSo: 0.5,
      giaiThich: "0,25 × 65 = 16,25 ≈ 16 đơn — đúng con số ở bảng §8.1 (so với P1 chỉ ~14 đơn nên phá 25 % chỉ là 3–4 đơn). Quy tắc đi kèm: LNS đáng dùng khi q = 0,25·m ≥ 10, tức nghiệm có ít nhất ~40 phần tử."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§4.2–4.4",
      hoi: "Chọn mọi phát biểu ĐÚNG về các toán tử phá:",
      chon: [
        "Phá “tệ nhất” bỏ phần tử có p_j + λ·Δt nhỏ nhất nên chỉ viết được khi đã có giá mờ λ",
        "Phá theo quan hệ bỏ một phần tử rồi những phần tử giống nó, để chúng dễ hoán đổi và heuristic xây lại có nhiều tự do thật sự",
        "Phá theo quan hệ bỏ những phần tử KHÁC nhau nhất để tối đa hoá đa dạng",
        "Phá theo đoạn liên tiếp chỉ dùng được khi nghiệm không phải là một tuyến đường",
        "Phá ngẫu nhiên đơn giản và đa dạng hoá tốt nhưng không có định hướng"
      ],
      dung: [0, 1, 4],
      giaiThich: "Ba ý đầu đúng: worst removal cần λ để cộng “tiền” với “thời gian tiết kiệm”; related removal (Shaw) bỏ các phần tử giống nhau về không gian, thời gian, giá trị; random removal đa dạng nhưng vô hướng. Ý thứ tư đảo ngược logic của phá theo quan hệ; ý cuối sai vì phá theo đoạn tốt đúng cho bài định tuyến, nơi các phần tử liên tiếp thường gần nhau."
    },
    {
      id: "q6", loai: "mot", doKho: 3, ref: "§5.4",
      hoi: "Theo bảng ghép cặp phá–xây của bài, nên ghép phá theo quan hệ với toán tử xây lại nào, và vì sao?",
      chon: [
        "Chèn ngẫu nhiên, vì cần đa dạng tối đa",
        "Chèn tiếc nuối (regret), vì các phần tử giống nhau cạnh tranh nhau cùng vị trí nên regret phát huy",
        "Không cần xây lại: phá theo quan hệ đã tạo ra nghiệm hợp lệ",
        "Chèn tham lam, vì regret không bao giờ hơn"
      ],
      dung: 1,
      giaiThich: "Nguyên tắc: phá phải “mở khoá” đúng thứ mà xây lại tận dụng được. Các phần tử giống nhau tranh nhau chỗ tốt, nên đánh giá bằng tiếc nuối (bỏ lỡ vị trí tốt nhất thì thiệt bao nhiêu) cho kết quả tốt hơn. Chèn ngẫu nhiên là cạm bẫy số 1 (LNS thành khởi động lại ngẫu nhiên); không xây lại thì nghiệm vẫn còn thiếu phần tử; regret thường hơn 1–3 % nhưng đắt gấp đôi."
    },
    {
      id: "q7", loai: "so", doKho: 2, ref: "§6.3",
      hoi: "ALNS: một toán tử có w = 1,4. Trong chu kỳ 50 vòng nó được dùng 10 lần với tổng điểm thưởng 30. Theo công thức w ← 0,8·w + 0,2·(điểm trung bình), trọng số mới là bao nhiêu?",
      dapAn: 1.72, saiSo: 0.005,
      giaiThich: "Điểm trung bình = 30 / 10 = 3. w mới = 0,8 × 1,4 + 0,2 × 3 = 1,12 + 0,6 = 1,72. Chú ý chia cho số lần toán tử được dùng (10), không phải cho 50 vòng; và toán tử không được dùng lần nào thì giữ nguyên w."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§6.4(a), §9 (cạm bẫy 3)",
      hoi: "Trong cập nhật trọng số của ALNS có dòng `if (w[i] < 0.05) w[i] = 0.05;`. Dòng này để làm gì?",
      chon: [
        "Để tổng trọng số luôn bằng 1",
        "Để tránh chia cho 0 khi tính điểm trung bình",
        "Để một toán tử xui xẻo lúc đầu không bị tắt vĩnh viễn, dù về sau nó có thể hữu ích",
        "Để mỗi toán tử được chọn ít nhất một lần trong mỗi chu kỳ"
      ],
      dung: 2,
      giaiThich: "Không có sàn dưới, một toán tử bị từ chối liên tục sẽ có w → 0 và không bao giờ được chọn lại nên không còn cơ hội chứng minh mình hữu ích ở giai đoạn sau. Dòng này không chuẩn hoá tổng; chia cho 0 đã được chặn bằng điều kiện dung[i] > 0; và sàn 0,05 chỉ làm xác suất chọn khác 0, không bảo đảm được chọn trong mỗi chu kỳ."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§7.1, §8, §9 (cạm bẫy 5)",
      hoi: "Trên P1 (nghiệm ≈ 14 đơn) ALNS đạt 65 892, thua GRASP + chèn (66 074); trên P2 (nghiệm ≈ 65 đơn) LNS hơn chèn toàn cục +3,00 % và có ý nghĩa thống kê. Kết luận đúng là gì?",
      chon: [
        "ALNS/LNS phát huy khi nghiệm đủ lớn và đủ ràng buộc (q = 0,25·m ≥ 10, tức ≥ ~40 phần tử); với nghiệm < 20 phần tử, GRASP + chèn thường thắng và nhanh hơn nhiều",
        "ALNS luôn tốt hơn mọi heuristic nên phải dùng cho mọi bài",
        "Số liệu P1 sai vì ALNS được cài đặt kém",
        "Số liệu P2 không đáng tin vì chênh lệch chỉ 3 %"
      ],
      dung: 0,
      giaiThich: "Ở P1 “phá 25 %” chỉ là bỏ 3–4 đơn — không lớn hơn đáng kể so với toán tử exchange thông thường, nên lân cận lớn chẳng có chỗ phát huy. Ở P2 phá 25 % là 16 đơn và chênh lệch 10 755,9 lớn hơn 2·SE = 4 266,6 nên có ý nghĩa. Không có dấu hiệu cài đặt kém ở P1, và 3 % trên 2·SE đã đủ tin cậy theo Bài 4."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§1.5, §9 (cạm bẫy 1)",
      hoi: "Bước xây lại của LNS bạn viết chỉ chèn các đơn bị bỏ vào những vị trí ngẫu nhiên. Điều gì xảy ra với LNS?",
      chon: [
        "Nó chạy nhanh hơn và chất lượng không đổi",
        "LNS thành “xáo bài lại từ đầu” (khởi động lại ngẫu nhiên): mất sức mạnh vì phần bị phá không còn được xây lại bằng thuật toán giỏi nhất",
        "Nó trở thành ALNS vì có yếu tố ngẫu nhiên",
        "Nó tự động chọn q tốt hơn"
      ],
      dung: 1,
      giaiThich: "Sức mạnh của LNS nằm ở chỗ bỏ ngẫu nhiên nhưng xây lại thông minh; nếu bước xây lại cũng bừa bãi thì mỗi vòng chỉ là một lần xáo ngẫu nhiên (cạm bẫy 1: heuristic xây lại phải là cái tốt nhất bạn có). ALNS là chuyện học trọng số toán tử, không phải chuyện ngẫu nhiên; và việc chọn q không liên quan tới cách chèn."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Bài tập 17.1, §2.1",
      hoi: "Với n = 260 ứng viên, q = 16 và nghiệm m = 65 phần tử, hãy ước lượng cỡ lân cận LNS C(n, q)·q! và so với lân cận 2-opt C(65, 2). Rồi giải thích vì sao LNS vẫn dùng được dù lân cận khổng lồ như vậy.",
      goiY: ["C(260, 16) cỡ 10²⁵; 16! cỡ 2·10¹³.", "Hỏi lại: LNS có thật sự “duyệt” lân cận không?"],
      mau: "C(260, 16) ≈ 1,3 × 10²⁵ và 16! ≈ 2,1 × 10¹³ nên C(n, q)·q! ≈ 2,7 × 10³⁸ (số có 39 chữ số). Lân cận 2-opt: C(65, 2) = 2 080. Chênh nhau khoảng 10³⁵ lần — đúng “35 bậc độ lớn” ở đáp án 17.1 (2,7 × 10³⁸ / 2 080 ≈ 1,3 × 10³⁵).\n\nLNS dùng được vì nó **không duyệt** lân cận: mỗi vòng chỉ lấy đúng **một** phần tử — nghiệm mà heuristic xây lại sinh ra. Toàn bộ cược nằm ở chỗ heuristic ấy đủ giỏi để mẫu duy nhất đó là một phần tử *tốt*. Đây là khác biệt triết lý so với Bài 9–12: ở đó duyệt hết lân cận nhỏ và lấy cái tốt nhất; ở đây không duyệt lân cận khổng lồ và tin vào một mẫu.",
      tieuChi: [
        "Tính đúng bậc độ lớn: C(n, q)·q! ~ 10³⁸ so với 2 080 của 2-opt (chênh ~35 bậc)",
        "Nêu ý then chốt: LNS không duyệt, chỉ lấy một phần tử của lân cận",
        "Nêu chất lượng do heuristic xây lại bảo đảm (xây lại phải dùng heuristic tốt nhất)"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 17.2, §4.5",
      hoi: "Quét q/m ∈ {0,05 ; 0,15 ; 0,25 ; 0,40 ; 0,60}. Hãy dự đoán hình dạng đường cong điểm theo q/m và giải thích hai đầu mút. (Lab bên dưới cho bạn đo thật trên TSP với Q = 5, 15, 30, 60, 90.)",
      goiY: ["Phá quá ít thì LNS giống thuật toán nào? Phá quá nhiều thì giống thuật toán nào?"],
      mau: "Đường cong có dạng chữ U ngược, **đỉnh quanh q/m ≈ 0,25** (điểm ngọt 15–35 %).\n\n- **q/m nhỏ (≤ 5–10 %)**: phá chỉ vài phần tử, xây lại gần như trả về đúng nghiệm cũ — LNS gần như local search, ít tác dụng (đáp án 17.2: tại 0,05 gần như không cải thiện).\n- **q/m lớn (> 50 %)**: phá gần hết rồi xây lại từ đầu — mất thông tin tích luỹ, LNS gần như khởi động lại ngẫu nhiên (đáp án 17.2: tại 0,60 kém hơn khoảng 2 % — số đo của lab P2 gốc, mức giảm phụ thuộc dữ liệu: trên một phép đo khác, nghiệm ngắn, phá nhiều lại không thua).\n\nTrong lab TSP của trang này (tỉ lệ so với 2-opt, người soạn đo trên 10 bộ n = 100, 300 vòng): Q = 5 chỉ hơn 2-opt khoảng 1 %; Q = 30 đạt đỉnh khoảng 5–6 %; Q = 90 còn khoảng 4 %. Đầu nhỏ đúng dự đoán, nhưng đầu lớn đi xuống nhẹ hơn dự đoán: vì mỗi vòng phá theo quan hệ rồi chèn rẻ nhất vẫn là một lần xây lại khá tốt và ta giữ kỷ lục. Điều này nhắc rằng hình dạng đường cong phụ thuộc cả toán tử phá lẫn bài toán.",
      tieuChi: [
        "Dự đoán đường cong dạng U ngược, đỉnh khoảng 15–35 %",
        "Giải thích đầu nhỏ: gần như local search, xây lại về chỗ cũ",
        "Giải thích đầu lớn: gần như xây lại từ đầu, mất thông tin tích luỹ"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "Bài tập 17.5, §6",
      hoi: "ALNS 8 cặp (4 toán tử phá × 2 toán tử xây lại) thường hơn LNS một cặp cố định chỉ khoảng 0,3–1 %. Khi nào chi phí thích nghi này đáng bỏ ra, khi nào không? Giải thích bằng cơ chế cập nhật trọng số.",
      goiY: ["Trọng số được cập nhật mỗi bao nhiêu vòng? Mỗi cặp được dùng khoảng bao nhiêu lần trong một chu kỳ?"],
      mau: "ALNS cập nhật trọng số sau mỗi chu kỳ (50 vòng) bằng điểm trung bình của từng toán tử. Với 8 cặp thì mỗi chu kỳ mỗi cặp chỉ được dùng cỡ 6 lần, nên điểm trung bình rất nhiễu; nếu tổng số vòng nhỏ (< 200 vòng — chỉ vài lần cập nhật) thì ALNS chưa đủ dữ liệu để học và chi phí thích nghi bị lãng phí. Đáp án 17.5: ALNS đáng dùng khi có **≥ 500 vòng**, khi đó lãi khoảng +0,3–1 % so với LNS một cặp cố định.\n\nNgược lại, khi ngân sách vòng ít, nghiệm nhỏ (< 20 phần tử) hoặc đã biết một cặp phá–xây tốt (ví dụ phá theo quan hệ + chèn tiếc nuối) thì LNS một cặp đơn giản hơn và đủ tốt. Đừng quên sàn dưới 0,05 và hệ số học r ∈ [0,1 ; 0,3].",
      tieuChi: [
        "Nêu cơ chế: cập nhật theo chu kỳ, điểm trung bình trên số lần dùng ít nên nhiễu",
        "Nêu ngưỡng: ALNS đáng dùng khi ≥ 500 vòng; dưới ~200 vòng chưa đủ dữ liệu học",
        "Nêu trường hợp không đáng: nghiệm nhỏ/ít vòng/đã có cặp phá–xây tốt"
      ]
    },
    {
      id: "l4", doKho: 3, ref: "§7–§8, Bài 4",
      hoi: "Vì sao ALNS không thắng ở P1 nhưng LNS lại thắng ở P2? Nêu số liệu, quy tắc rút ra, và nói “có ý nghĩa thống kê” trong kết quả P2 nghĩa là gì.",
      goiY: ["So sánh “phá 25 %” là bao nhiêu đơn ở P1 và ở P2.", "10 755,9 so với 2·SE = 4 266,6."],
      mau: "**P1** là bài một kỳ với nghiệm ~14 đơn: phá 25 % chỉ là bỏ 3–4 đơn, không lớn hơn đáng kể so với toán tử exchange thông thường nên lân cận lớn không có chỗ phát huy. Số liệu: ALNS 400 vòng 65 892 — ngang SA, thua GRASP+chèn 66 074 và chậm hơn 3 lần.\n\n**P2** là bài 5 ngày với nghiệm ~65 đơn: phá 25 % là 16 đơn, đủ để tái cấu trúc cả thứ tự lẫn phân ngày. LNS hơn chèn toàn cục +3,00 % (368 695,6 so với 357 939,7).\n\n**Có ý nghĩa thống kê** (Bài 4): chênh lệch trung bình 10 755,9 lớn hơn 2·SE = 4 266,6, nghĩa là khó có thể do ngẫu nhiên của bộ dữ liệu.\n\n**Quy tắc**: LNS đáng dùng khi q = 0,25·m ≥ 10, tức nghiệm có ít nhất ~40 phần tử; với nghiệm < 20 phần tử, GRASP + chèn thường thắng và nhanh hơn nhiều.",
      tieuChi: [
        "So sánh quy mô nghiệm: P1 ~14 đơn (phá 3–4 đơn) với P2 ~65 đơn (phá 16 đơn)",
        "Nêu đúng số liệu chính: P1 65 892 < 66 074; P2 +3,00 %",
        "Giải thích ý nghĩa thống kê bằng so sánh với 2·SE và nêu quy tắc q ≥ 10 (nghiệm ≥ ~40 phần tử)"
      ]
    }
  ],

  lab: [
    {
      id: "lns-tsp",
      ten: "LNS cho TSP: phá theo quan hệ, chèn rẻ nhất",
      doKho: 3,
      ref: "§3–§5, Bài tập 17.2",
      de: "Cài **LNS** cho bài chu trình ngắn nhất: mỗi vòng **phá** một phần tour rồi **xây lại** bằng chèn. Dòng đầu của đầu vào là `n Q` — số điểm và **mức phá** `Q` (phần trăm số điểm bị bỏ mỗi vòng); sau đó là `n` dòng toạ độ.\n\n" +
          "**Khung** (§3): khởi tạo bằng *láng giềng gần nhất* xuất phát từ điểm 1 (chưa 2-opt) → lặp đúng **300 vòng**: **phá theo quan hệ** (§4.3) — chọn một điểm ngẫu nhiên `s`, bỏ `s` cùng các điểm gần `s` nhất cho đủ `q = round(n·Q/100)` điểm → **xây lại** bằng chèn rẻ nhất (§5.1): xáo ngẫu nhiên thứ tự các điểm bị bỏ, lần lượt chèn mỗi điểm vào cạnh của tour hiện có sao cho độ dài tăng ít nhất → chấp nhận (nhận nếu ngắn hơn, ngoài ra nhận với xác suất 2 %) → cập nhật `best`. In `best`. Mọi ngẫu nhiên theo `rng(seed)` (JS) hoặc `mt19937` (C++) với seed cố định.\n\n" +
          "Chấm trên 10 bộ `n = 100`, `Q = 30`. **Mức đạt** (độ dài so với 2-opt từ láng giềng gần nhất, mốc `haiOpt`): hợp lệ → không tệ hơn 2-opt → ngắn hơn khoảng 2 % → ngắn hơn khoảng 3,5 %. LNS của bài không có local search nào cả: nếu thắng 2-opt thì là nhờ phá–xây.\n\n" +
          "**Khám phá bằng biến thể** (§4.5): quét `Q = 5, 15, 30, 60, 90` rồi nhìn tỉ lệ ở từng mức: đường cong điểm theo `Q` có hình gì? Có đúng “điểm ngọt 15–35 %” không? Hai đầu mút giống thuật toán nào (§4.5)?\n\n" +
          "**Suy ngẫm**: thay phá theo quan hệ bằng *phá ngẫu nhiên* (chọn `q` điểm bất kỳ). Điểm đổi thế nào ở cùng `Q`? Vì sao “giống nhau” lại quan trọng (§4.3: các phần tử giống nhau mới hoán đổi được cho nhau)?",
      vanDe: "b17-tsp-lns",
      tham: { n: 100, q: 30 },
      bienThe: [
        { ten: "Q = 30 % (mặc định)", tham: { n: 100, q: 30 } },
        { ten: "Q = 5 % (phá quá ít)", tham: { n: 100, q: 5 } },
        { ten: "Q = 15 %", tham: { n: 100, q: 15 } },
        { ten: "Q = 60 %", tham: { n: 100, q: 60 } },
        { ten: "Q = 90 % (gần xây lại từ đầu)", tham: { n: 100, q: 90 } },
        { ten: "Gom cụm, Q = 30 %", tham: { n: 100, cum: true, q: 30 } }
      ],
      soTest: 10,
      gioiHanMs: 3000,
      muc: [
        { ten: "Không tệ hơn 2-opt từ láng giềng gần nhất", so: "haiOpt", heSo: 1 },
        { ten: "Ngắn hơn 2-opt khoảng 2 %", so: "haiOpt", heSo: 1.02 },
        { ten: "Ngắn hơn 2-opt khoảng 3,5 %", so: "haiOpt", heSo: 1.035 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n Q" (số điểm, mức phá %); rồi n dòng "x y".
// Đầu ra : một dòng gồm n chỉ số (từ 1) — hoán vị theo thứ tự đi, chu trình khép kín.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], Q = t[1];
const X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[2 + 2 * i]); Y.push(t[3 + 2 * i]); }
const r = rng(2024);                        // seed cố định: kết quả tái lập được
const SO_VONG = 300;
const q = Math.max(2, Math.round(n * Q / 100));   // số điểm bị phá mỗi vòng

const d = [];
for (let i = 0; i < n; i++) {
  d.push(new Float64Array(n));
  for (let j = 0; j < n; j++) d[i][j] = Math.hypot(X[i] - X[j], Y[i] - Y[j]);
}
const doDai = (p) => { let s = 0; for (let i = 0; i < p.length; i++) s += d[p[i]][p[(i + 1) % p.length]]; return s; };

// gan[i] = mọi điểm sắp theo khoảng cách tới i tăng dần (hoà thì chỉ số nhỏ trước); gan[i][0] là chính i.
const gan = [];
for (let i = 0; i < n; i++) {
  gan.push(Array.from({ length: n }, (_, k) => k).sort((a, b) => d[i][a] - d[i][b] || a - b));
}

// Khởi tạo: láng giềng gần nhất từ điểm 0.
let x = [0];
const dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  const cu = x[x.length - 1];
  let tot = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
  dung[tot] = true; x.push(tot);
}

// TODO: lặp SO_VONG vòng
//   1. PHÁ theo quan hệ: s = r.int(n); bo = gan[s].slice(0, q); giữ lại phần còn lại của tour (đúng thứ tự).
//   2. XÂY LẠI: xáo bo (Fisher–Yates bằng r.int); với từng điểm v trong bo, chèn vào vị trí p làm
//      d[a][v] + d[v][b] − d[a][b] nhỏ nhất, với a = t[p], b = t[(p + 1) % t.length].
//   3. CHẤP NHẬN nếu ngắn hơn, hoặc khi r() < 0.02; cập nhật best (bản sao) nếu ngắn hơn kỷ lục.
let best = x;

print(best.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, Q;
vector<vector<double>> d;
mt19937 gen(2024);                           // seed cố định: kết quả tái lập được
int rnd(int m) { return (int)(gen() % m); }  // số nguyên trong [0, m)
double unit() { return (gen() >> 8) / 16777216.0; }

double doDai(const vector<int>& p) {
    double s = 0;
    int m = p.size();
    for (int i = 0; i < m; i++) s += d[p[i]][p[(i + 1) % m]];
    return s;
}

int main() {
    scanf("%d %d", &n, &Q);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    const int SO_VONG = 300;
    int q = max(2, (int)floor(n * Q / 100.0 + 0.5));   // số điểm bị phá mỗi vòng
    d.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) d[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    // gan[i] = mọi điểm sắp theo khoảng cách tới i tăng dần (hoà thì chỉ số nhỏ trước); gan[i][0] là chính i.
    vector<vector<int>> gan(n, vector<int>(n));
    for (int i = 0; i < n; i++) {
        iota(gan[i].begin(), gan[i].end(), 0);
        sort(gan[i].begin(), gan[i].end(), [&](int a, int b) { return d[i][a] != d[i][b] ? d[i][a] < d[i][b] : a < b; });
    }

    // Khởi tạo: láng giềng gần nhất từ điểm 0.
    vector<int> x(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int cu = x.back(), tot = -1;
        for (int i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
        dung[tot] = true; x.push_back(tot);
    }

    // TODO: lặp SO_VONG vòng
    //   1. PHÁ theo quan hệ: s = rnd(n); bo = q điểm đầu của gan[s]; giữ lại phần còn lại của tour (đúng thứ tự).
    //   2. XÂY LẠI: xáo bo (Fisher–Yates bằng rnd); với từng điểm v trong bo, chèn vào vị trí p làm
    //      d[a][v] + d[v][b] - d[a][b] nhỏ nhất, với a = t[p], b = t[(p + 1) % t.size()].
    //   3. CHẤP NHẬN nếu ngắn hơn, hoặc khi unit() < 0.02; cập nhật best nếu ngắn hơn kỷ lục.
    vector<int> best = x;

    for (int i = 0; i < n; i++) printf("%d%c", best[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], Q = t[1];
const X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[2 + 2 * i]); Y.push(t[3 + 2 * i]); }
const r = rng(2024);
const SO_VONG = 300;
const q = Math.max(2, Math.round(n * Q / 100));

const d = [];
for (let i = 0; i < n; i++) {
  d.push(new Float64Array(n));
  for (let j = 0; j < n; j++) d[i][j] = Math.hypot(X[i] - X[j], Y[i] - Y[j]);
}
const doDai = (p) => { let s = 0; for (let i = 0; i < p.length; i++) s += d[p[i]][p[(i + 1) % p.length]]; return s; };

const gan = [];
for (let i = 0; i < n; i++) {
  gan.push(Array.from({ length: n }, (_, k) => k).sort((a, b) => d[i][a] - d[i][b] || a - b));
}

let x = [0];
const dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  const cu = x[x.length - 1];
  let tot = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
  dung[tot] = true; x.push(tot);
}

let best = x.slice();
let fCur = doDai(x), fBest = fCur;
for (let vong = 0; vong < SO_VONG; vong++) {
  // PHÁ theo quan hệ: một điểm ngẫu nhiên cùng các điểm gần nó nhất
  const s = r.int(n);
  const bo = gan[s].slice(0, q);
  const biBo = new Array(n).fill(false);
  for (const v of bo) biBo[v] = true;
  const tour = x.filter((v) => !biBo[v]);

  // XÂY LẠI: xáo rồi chèn rẻ nhất từng điểm
  for (let i = bo.length - 1; i > 0; i--) { const j = r.int(i + 1); const tam = bo[i]; bo[i] = bo[j]; bo[j] = tam; }
  for (const v of bo) {
    let viTri = 0, chiPhi = Infinity;
    for (let p = 0; p < tour.length; p++) {
      const a = tour[p], b = tour[(p + 1) % tour.length];
      const c = d[a][v] + d[v][b] - d[a][b];
      if (c < chiPhi) { chiPhi = c; viTri = p; }
    }
    tour.splice(viTri + 1, 0, v);
  }

  const fy = doDai(tour);
  if (fy < fCur - 1e-9 || r() < 0.02) { x = tour; fCur = fy; }       // chấp nhận
  if (fy < fBest - 1e-9) { fBest = fy; best = tour.slice(); }        // kỷ lục
}
print(best.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, Q;
vector<vector<double>> d;
mt19937 gen(2024);
int rnd(int m) { return (int)(gen() % m); }
double unit() { return (gen() >> 8) / 16777216.0; }

double doDai(const vector<int>& p) {
    double s = 0;
    int m = p.size();
    for (int i = 0; i < m; i++) s += d[p[i]][p[(i + 1) % m]];
    return s;
}

int main() {
    scanf("%d %d", &n, &Q);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    const int SO_VONG = 300;
    int q = max(2, (int)floor(n * Q / 100.0 + 0.5));
    d.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) d[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    vector<vector<int>> gan(n, vector<int>(n));
    for (int i = 0; i < n; i++) {
        iota(gan[i].begin(), gan[i].end(), 0);
        sort(gan[i].begin(), gan[i].end(), [&](int a, int b) { return d[i][a] != d[i][b] ? d[i][a] < d[i][b] : a < b; });
    }

    vector<int> x(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int cu = x.back(), tot = -1;
        for (int i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
        dung[tot] = true; x.push_back(tot);
    }

    vector<int> best = x;
    double fCur = doDai(x), fBest = fCur;
    for (int vong = 0; vong < SO_VONG; vong++) {
        // PHÁ theo quan hệ: một điểm ngẫu nhiên cùng các điểm gần nó nhất
        int s = rnd(n);
        vector<int> bo(gan[s].begin(), gan[s].begin() + q);
        vector<bool> biBo(n, false);
        for (int v : bo) biBo[v] = true;
        vector<int> tour;
        for (int v : x) if (!biBo[v]) tour.push_back(v);

        // XÂY LẠI: xáo rồi chèn rẻ nhất từng điểm
        for (int i = (int)bo.size() - 1; i > 0; i--) swap(bo[i], bo[rnd(i + 1)]);
        for (int v : bo) {
            int viTri = 0;
            double chiPhi = 1e18;
            for (int p = 0; p < (int)tour.size(); p++) {
                int a = tour[p], b = tour[(p + 1) % tour.size()];
                double c = d[a][v] + d[v][b] - d[a][b];
                if (c < chiPhi) { chiPhi = c; viTri = p; }
            }
            tour.insert(tour.begin() + viTri + 1, v);
        }

        double fy = doDai(tour);
        if (fy < fCur - 1e-9 || unit() < 0.02) { x = tour; fCur = fy; }   // chấp nhận
        if (fy < fBest - 1e-9) { fBest = fy; best = tour; }               // kỷ lục
    }
    for (int i = 0; i < n; i++) printf("%d%c", best[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Chuẩn bị một lần: `gan[i]` = danh sách mọi điểm sắp theo khoảng cách tới `i`. Mỗi vòng, phá = lấy `q` phần tử đầu của `gan[s]` (nó gồm cả chính `s`).",
        "Giữ lại phần còn lại của tour **đúng thứ tự** (lọc theo mảng đánh dấu), rồi chèn từng điểm bị bỏ vào cạnh `(tour[p], tour[(p+1) % len])` có chi phí `d[a][v] + d[v][b] − d[a][b]` nhỏ nhất.",
        "Xáo thứ tự các điểm bị bỏ trước khi chèn (Fisher–Yates, dùng `r.int`); nếu không xáo, vòng nào cũng chèn theo cùng một thứ tự và mất đa dạng.",
        "Nếu điểm không hơn 2-opt: kiểm tra bạn có cập nhật `best` bằng bản sao tour mới không, và `Q` có đang được đọc từ đầu vào (không phải hằng số) hay không."
      ]
    },
    {
      id: "alns-trong-so",
      ten: "ALNS: cập nhật trọng số toán tử",
      doKho: 2,
      ref: "§6.2–6.4",
      de: "Bài này mô phỏng đúng đoạn cập nhật trọng số trong `alns()` (§6.3), không dính tới hình học.\n\n" +
          "**Đầu vào**: dòng 1 `K S` — số toán tử phá (3) và số vòng của một chu kỳ (50). Dòng 2: `K` trọng số hiện tại. Rồi `S` dòng `op kq`: toán tử đã dùng ở vòng đó (đánh số từ 1) và kết quả `kq`: **0** bị từ chối, **1** được chấp nhận dù không tốt hơn, **2** tốt hơn nghiệm hiện tại, **3** kỷ lục mới.\n\n" +
          "**Điểm thưởng**: `kq = 3` được **10**, `kq = 2` được **5**, `kq = 1` được **1**, `kq = 0` được **0**. Cuối chu kỳ, với mỗi toán tử `i` **đã được dùng ít nhất một lần**: `wᵢ ← 0,8·wᵢ + 0,2·(tổng điểm của i / số lần dùng i)`. Toán tử không được dùng thì giữ nguyên `wᵢ`. Sau đó mọi `wᵢ < 0,05` được nâng lên đúng **0,05** (sàn dưới — kể cả toán tử không dùng). Xác suất chọn ở chu kỳ sau là `wᵢ / Σw` (bánh xe roulette).\n\n" +
          "**Đầu ra**: một dòng `2K` số thực — `K` trọng số mới rồi `K` xác suất chọn (sai số cho phép 10⁻⁵, in ít nhất 6 chữ số thập phân).\n\n" +
          "**Suy ngẫm**: toán tử thứ 3 luôn bắt đầu rất sát sàn 0,05. Điều gì xảy ra với nó khi bị từ chối cả chu kỳ? Khi không được dùng lần nào? Biến thể `S = 10` (ít dữ liệu) khác biến thể `S = 50` ở chỗ nào, và vì sao ALNS cần đủ nhiều vòng mới học được (Bài tập 17.5)?",
      vanDe: "b17-alns-trong-so",
      tham: { S: 50 },
      bienThe: [
        { ten: "Chu kỳ 50 vòng", tham: { S: 50 } },
        { ten: "Chu kỳ 10 vòng (ít dữ liệu)", tham: { S: 10 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "K S", rồi K trọng số, rồi S dòng "op kq".
// Đầu ra : một dòng 2K số: K trọng số mới, rồi K xác suất chọn w_i / tổng.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const K = t[0], S = t[1];
const w = [];
for (let i = 0; i < K; i++) w.push(t[2 + i]);

const THUONG = [0, 1, 5, 10];        // điểm thưởng theo kq = 0, 1, 2, 3
const diem = new Array(K).fill(0), dung = new Array(K).fill(0);
for (let j = 0; j < S; j++) {
  const op = t[2 + K + 2 * j] - 1, kq = t[3 + K + 2 * j];
  // TODO: cộng điểm thưởng THUONG[kq] vào diem[op] và tăng dung[op].
}
// TODO: với mỗi toán tử i đã được dùng: w[i] = 0.8 * w[i] + 0.2 * (diem[i] / dung[i]);
//       rồi nâng mọi w[i] < 0.05 lên 0.05 (kể cả toán tử không được dùng).

const tong = w.reduce((a, b) => a + b, 0);
print(w.map((x) => x.toFixed(6)).join(" ") + " " + w.map((x) => (x / tong).toFixed(6)).join(" "));
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const K = t[0], S = t[1];
const w = [];
for (let i = 0; i < K; i++) w.push(t[2 + i]);

const THUONG = [0, 1, 5, 10];
const diem = new Array(K).fill(0), dung = new Array(K).fill(0);
for (let j = 0; j < S; j++) {
  const op = t[2 + K + 2 * j] - 1, kq = t[3 + K + 2 * j];
  diem[op] += THUONG[kq];
  dung[op] += 1;
}
for (let i = 0; i < K; i++) {
  if (dung[i] > 0) w[i] = 0.8 * w[i] + 0.2 * (diem[i] / dung[i]);   // chỉ cập nhật toán tử đã được dùng
  if (w[i] < 0.05) w[i] = 0.05;                                      // sàn dưới: không bao giờ tắt hẳn
}
const tong = w.reduce((a, b) => a + b, 0);
print(w.map((x) => x.toFixed(6)).join(" ") + " " + w.map((x) => (x / tong).toFixed(6)).join(" "));
`
      },
      goiY: [
        "Cần hai mảng đếm cho mỗi toán tử: tổng điểm thưởng `diem[i]` và số lần dùng `dung[i]`. Điểm trung bình là `diem[i] / dung[i]` — chỉ tính khi `dung[i] > 0`.",
        "Sàn dưới áp dụng cho MỌI toán tử sau khi cập nhật, không chỉ những toán tử đã được dùng.",
        "Xác suất chọn tính trên trọng số MỚI (sau khi đã cập nhật và áp sàn): `w[i] / tổng`."
      ]
    }
  ]
});
