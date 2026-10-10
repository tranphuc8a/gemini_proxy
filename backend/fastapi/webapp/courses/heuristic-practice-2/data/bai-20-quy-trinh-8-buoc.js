/* Thực hành — Bài 20: Quy trình 8 bước tấn công một đề mới. */

/* ---------------------------------------------------------------------------------------------
   Bài toán b20-ablation (tuDapAn): bước ⑦ — giữ thành phần có đóng góp THẬT, xoá thành phần chỉ là nhiễu (hoặc có hại).
   stdin : "m K" rồi K dòng "full bo1 … bom"   (điểm bản đầy đủ và điểm khi BỎ từng thành phần, cùng một test)
   stdout: μ1 … μm (phần trăm điểm tụt trung bình) rồi f1 … fm (1 = giữ, 0 = xoá)
   Quy tắc: Δ_kj = 100·(full_k − bo_kj)/full_k; μ_j = trung bình; SE_j = σ_j/√K (σ mẫu, chia K−1); giữ nếu μ_j > 2·SE_j.
   --------------------------------------------------------------------------------------------- */
(function () {
  function thongKe(inst) {
    var kq = [];
    for (var j = 1; j <= inst.m; j++) {
      var dl = inst.hang.map(function (h) { return 100 * (h[0] - h[j]) / h[0]; });
      var mu = TH.tienIch.trungBinh(dl), se = TH.tienIch.saiSoChuan(dl);
      kq.push({ mu: mu, se: se, giu: mu > 2 * se });
    }
    return kq;
  }

  TH.vande.dangKy("b20-ablation", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var K = tham.K || 40, nhieu = tham.nhieu == null ? 0.3 : tham.nhieu;
      var that = [3.1, 2.4, 0.9, 0.25, 0.0, -0.35], m = that.length, inst = null;
      for (var lan = 0; lan < 400; lan++) {                    /* tránh mẫu nằm đúng trên ranh giới 2·SE (sai số làm tròn của người học không đổi cờ) */
        var r = TH.tienIch.rng(seed * 131 + lan), hang = [];
        var chuan = function () { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
        for (var k = 0; k < K; k++) {
          var full = Math.round(110000 * (0.9 + 0.2 * r())), dong = [full];
          for (var j = 0; j < m; j++) dong.push(Math.round(full * (1 - (that[j] + nhieu * chuan()) / 100)));
          hang.push(dong);
        }
        inst = { m: m, K: K, hang: hang };
        var ok = thongKe(inst).every(function (x) { var t = x.mu / (2 * x.se); return t < 0.97 || t > 1.03; });
        if (ok) break;
      }
      return inst;
    },
    viet: function (inst) {
      var s = inst.m + " " + inst.K + "\n";
      inst.hang.forEach(function (h) { s += h.join(" ") + "\n"; });
      return s;
    },
    giai: function (inst) {
      var th = thongKe(inst);
      return [th.map(function (x) { return x.mu; }), th.map(function (x) { return x.giu ? 1 : 0; })];
    },
    saiSo: 0.006,
    dinhDang: {
      vao: "Dòng 1: `m K` — số thành phần và số test. Rồi `K` dòng; dòng `k` là `full bo₁ bo₂ … bo_m`: điểm bản đầy đủ và điểm khi **bỏ** từng thành phần, trên **cùng** test `k` (số nguyên).",
      ra: "Một dòng `2m` số: `μ₁ … μ_m` (phần trăm điểm tụt trung bình, sai số ≤ 0,006) rồi `f₁ … f_m` với `f_j = 1` nếu giữ thành phần `j`, `0` nếu xoá."
    }
  }));
})();

TH.dangKy({
  id: "bai-20-quy-trinh-8-buoc",

  tomTat: [
    "Quy trình 8 bước theo đúng thứ tự: **① đọc mã grader**, ② mô hình hoá (S, C, f) và biểu diễn, **③ bộ chấm cục bộ trước khi có thuật toán**, ④ nghiệm cơ sở, ⑤ cận trên, ⑥ cải tiến có đo, ⑦ ablation, ⑧ chốt an toàn — với tỉ lệ thời gian 10 / 10 / 15 / 5 / 5 / 40 / 10 / 5 %.",
    "Văn bản đề có thể mơ hồ hoặc sai, **mã bộ chấm là chân lý**: ở đề Samsung 2607, `nextDay()` gọi được 30 lần nên có 31 khung ngày — riêng phát hiện này đáng +3,08 % điểm, lớn hơn mọi metaheuristic của khoá cộng lại.",
    "Bộ chấm dựng trước thuật toán: không có nó, mọi con số chỉ là một mẫu duy nhất và không phân biệt nổi “tốt hơn” với “may hơn”; chênh lệch giữa hai phiên bản chỉ đáng tin khi lớn hơn 2·SE. Đây là khoản đầu tư có tỉ suất sinh lời cao nhất của cả quy trình.",
    "Nghiệm cơ sở (greedy tỉ số) cho mốc: P3 được 31 755 020. Cận trên 33 943 173 cho biết dư địa (33 943 173 − 31 755 020) / 31 755 020 ≈ 6,9 %; theo bảng Bài 18, 5–15 % nghĩa là “thiếu tìm kiếm” nên đầu tư vào Phần 3–4.",
    "Bước ⑥ chiếm 40 % thời gian nhưng không phải bước quan trọng nhất: năm bước đầu chỉ chiếm 45 % mà quyết định ⑥ có ý nghĩa hay không. Quy tắc bất di bất dịch: **mỗi lần đo MỘT thay đổi**, ghi nhật ký, không cải thiện thì hoàn tác ngay.",
    "Quy trình cấm **bỏ qua** một bước chứ không cấm quay lại: còn cách cận trên > 20 % → ②; điểm dao động mạnh giữa các test → ③; thêm thuật toán mạnh mà không cải thiện → ④; thời gian vượt giới hạn → ⑥.",
    "Ablation: bỏ từng thành phần rồi đo lại. Ở đề 2607, bỏ khung ngày thứ 31 tụt 3,08 %, bỏ beam search tụt 2,43 %, còn thưởng ρ và mật độ σ chỉ 0,10 % và 0,01 % — xoá, rồi **chạy lại** ablation vì con số có thể đổi (−1,33 % thành −2,43 %).",
    "Chốt an toàn: 0 vi phạm trên ≥ 500 test và ≥ 3 họ seed, worst-case ≤ 50 % giới hạn, build sạch bốn cờ, sanitizer, trường hợp biên, và **hai cấu hình** (chính 27,4 / 37,8 ms; an toàn 8,6 / 13,2 ms, kém 0,22 %). Khai thác có thể là lỗi của ban tổ chức thì đặt sau cờ biên dịch."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 2, ref: "§3.1",
      hoi: "Câu chữ của đề dễ khiến người ta hiểu là “30 ngày”, nhưng trong mã grader `nextDay()` được phép gọi tối đa 30 lần và ngày đầu tiên đã có sẵn. Theo bài, điều nào đúng?",
      chon: [
        "Chênh lệch một ngày chỉ cỡ 1 % nên không đáng đọc mã để biết",
        "Đề là chân lý còn mã grader chỉ là bản cài đặt; cứ giữ mô hình 30 ngày",
        "Mã grader là chân lý: có 31 khung ngày (ngày đầu cộng 30 lần chuyển ngày); riêng phát hiện này đáng khoảng +3,08 % điểm",
        "Thử cả hai cách rồi chọn con số cao hơn, không cần mô hình hoá"
      ],
      dung: 2,
      giaiThich: "Văn bản đề có thể mơ hồ, lỗi thời hoặc sai; mã bộ chấm mới là chân lý. 30 lần chuyển ngày cho 31 khung ngày, và ablation ở bước ⑦ cho thấy bỏ khung thứ 31 làm điểm tụt 3,08 % (32 915 840 → 31 900 896), lớn hơn mọi metaheuristic của khoá cộng lại. Coi nhẹ “một ngày” là sai, còn thử mò hai cách không thay được việc hiểu mô hình."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§1.1–1.3, §5",
      hoi: "Bạn vừa viết xong một trang giấy (S, C, f), chọn biểu diễn và trả lời được “tài nguyên nào hết trước?”. Chưa có dòng code thuật toán nào. Việc tiếp theo theo quy trình là gì?",
      chon: [
        "Dựng bộ chấm cục bộ (bộ sinh dữ liệu tất định, bộ chấm trung thực, thống kê, nhật ký) **trước** khi viết thuật toán",
        "Viết ngay simulated annealing vì đó là thuật toán mạnh nhất, bộ chấm làm sau",
        "Viết greedy rồi chạy trên đúng một bộ dữ liệu để xem con số",
        "Tính cận trên bằng LP vì đó là bước rẻ nhất"
      ],
      dung: 0,
      giaiThich: "Bước ③ nằm trước mọi thuật toán. An bỏ qua nó nên có ba phiên bản mà không biết cái nào tốt hơn — mỗi con số chỉ là một mẫu duy nhất, không phân biệt nổi “tốt hơn” với “may hơn”. Bộ chấm tốn 15 % thời gian nhưng là khoản đầu tư sinh lời cao nhất. Chạy greedy trên một bộ dữ liệu cũng chỉ là một mẫu; cận trên là bước ⑤, sau nghiệm cơ sở."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "§1.2, §7", donVi: "(%)",
      hoi: "Nghiệm cơ sở (greedy theo tỉ số) đạt 31 755 020 và cận trên là 33 943 173. Dư địa còn lại, tính theo phần trăm của **nghiệm cơ sở**, là bao nhiêu? (làm tròn một chữ số thập phân)",
      dapAn: 6.89, saiSo: 0.05,
      giaiThich: "(33 943 173 − 31 755 020) / 31 755 020 = 2 188 153 / 31 755 020 ≈ 0,0689, tức 6,9 % (đã tính bằng code: 6,8907 %). Bài tính dư địa theo nghiệm cơ sở; nếu lấy mẫu số là cận trên bạn sẽ ra 6,4 % — sai quy ước."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§7, §8.3",
      hoi: "Với dư địa 6,9 % ở bước ⑤ (theo bảng Bài 18, khoảng 5–15 % nghĩa là “thiếu tìm kiếm”), hướng đầu tư đúng là gì?",
      chon: [
        "Quay lại bước ② vì mô hình chắc chắn sai",
        "Đầu tư vào các kỹ thuật tìm kiếm ở Phần 3–4 của khoá (local search, beam, metaheuristic), không viết lại mô hình",
        "Dừng lại vì 6,9 % quá nhỏ để đáng làm tiếp",
        "Đổi sang một greedy khác rồi tính lại cận trên"
      ],
      dung: 1,
      giaiThich: "Dư địa 5–15 % là dấu hiệu “thiếu tìm kiếm”: mô hình ổn, cái thiếu là sức tìm kiếm nên bước ⑥ nên đi vào Phần 3–4. Chỉ khi còn cách cận trên hơn 20 % mới nên nghi mô hình và quay lại bước ②. Con số 6,9 % cũng không phải lý do để dừng — nó chính là câu trả lời cho “còn đáng làm tiếp không”; và đổi greedy khác không phải việc của bước ⑤."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§2.1, §5, §8.2",
      hoi: "Những hành vi nào dưới đây **đi ngược** quy trình 8 bước?",
      chon: [
        "Gõ simulated annealing khi chưa có bộ chấm cục bộ, định “đo sau”",
        "Sau bước ⑤ thấy còn cách cận trên 25 %, quay lại sửa mô hình ở bước ②",
        "Thêm đồng thời hai cải tiến rồi đo tổng hiệu quả của cả hai",
        "Tính cận trên đơn giản bằng LP trước khi bắt đầu cải tiến",
        "Chỉ đọc đề, bỏ qua mã grader vì mã nguồn rối hơn văn bản"
      ],
      dung: [0, 2, 4],
      giaiThich: "Quy trình cấm **bỏ qua** bước: bộ chấm phải có trước thuật toán, mỗi lần đo chỉ một thay đổi, và mã grader là chân lý nên phải đọc. Quay lại một bước thì hoàn toàn bình thường — bảng §8.3 có hẳn dấu hiệu (> 20 % cách cận trên → ②). Tính cận trên trước khi cải tiến chính là đúng thứ tự của bước ⑤."
    },
    {
      id: "q6", loai: "so", doKho: 1, ref: "§2", donVi: "(phút)",
      hoi: "Bạn có buổi làm bài 3 giờ (180 phút) và chia thời gian đúng tỉ lệ của bài. Bước ③ (dựng bộ chấm cục bộ) được bao nhiêu phút?",
      dapAn: 27, saiSo: 0,
      giaiThich: "Bước ③ chiếm 15 %: 0,15 × 180 = 27 phút (đã tính bằng code). Cả tám bước: 18 + 18 + 27 + 9 + 9 + 72 + 18 + 9 = 180 phút; năm bước đầu cộng lại 81 phút (45 %), bước ⑥ riêng 72 phút (40 %)."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§0 (nhắc lại ⑤), §8.2",
      hoi: "Ở bước ⑥ một cải tiến cho điểm trung bình hơn bản trước 0,3 % trên 300 test; sai số chuẩn (SE) của chênh lệch là 0,2 %. Kết luận đúng là gì?",
      chon: [
        "Đó là cải tiến thật vì chênh lệch mang dấu dương",
        "Cải tiến chắc chắn vì 0,3 % lớn hơn SE = 0,2 %",
        "Phải giữ lại vì hoàn tác sẽ làm mất 0,3 % điểm",
        "Chưa kết luận được: 0,3 % < 2·SE = 0,4 %, có thể chỉ là nhiễu; cần thêm test hoặc coi như chưa cải thiện"
      ],
      dung: 3,
      giaiThich: "Quy tắc của bài: chênh lệch giữa hai phiên bản chỉ đáng tin khi lớn hơn 2·SE; nhỏ hơn thì đó là nhiễu, không phải cải tiến. Ở đây 2·SE = 0,4 % > 0,3 %. Dấu dương một mình hay “lớn hơn SE” đều chưa đủ. Còn “hoàn tác làm mất điểm” sai ở chỗ điểm đó chưa chứng minh được là có thật; quy tắc §8.2 là không cải thiện thì hoàn tác ngay."
    },
    {
      id: "q8", loai: "nhieu", doKho: 2, ref: "§9",
      hoi: "Sau khi chạy ablation (bước ⑦), ba việc nào dưới đây bài yêu cầu phải làm?",
      chon: [
        "Giữ nguyên mọi thành phần để khỏi rủi ro, chỉ ghi chú những cái đóng góp thấp",
        "Xoá mọi thành phần có đóng góp ≈ 0 %",
        "Chạy lại ablation trên phiên bản đã xoá, vì con số có thể đổi (ví dụ −1,33 % thành −2,43 %)",
        "Bỏ qua việc chạy lại vì ablation đã đo xong, con số không thể đổi khi xoá thành phần khác",
        "Ghi bảng ablation vào báo cáo làm bằng chứng cho mọi tuyên bố cải thiện"
      ],
      dung: [1, 2, 4],
      giaiThich: "Ba việc: xoá mọi thành phần đóng góp ≈ 0 % (đề thi thật: 2 thành phần bị xoá), chạy lại ablation trên phiên bản đã xoá (“phạt thời gian chết” từ −1,33 % thành −2,43 % sau khi xoá `tailFill`), và ghi bảng vào báo cáo. Giữ hết “cho chắc” để lại mã vô dụng; còn cho rằng con số không đổi sau khi xoá thì chính ví dụ −1,33 % → −2,43 % đã bác bỏ."
    },
    {
      id: "q9", loai: "mot", doKho: 2, ref: "§8.3",
      hoi: "Bạn đã thêm một metaheuristic mạnh (simulated annealing) mà điểm vẫn không cải thiện so với greedy. Theo bảng “dấu hiệu cần quay lại bước trước”, nên quay lại bước nào?",
      chon: [
        "Bước ②: mô hình hoá",
        "Bước ③: bộ chấm và dữ liệu",
        "Bước ④: nghiệm cơ sở — có thể nó có vấn đề",
        "Bước ⑥: giảm quy mô"
      ],
      dung: 2,
      giaiThich: "Bảng của bài: còn cách cận trên > 20 % → ②; điểm dao động mạnh giữa các test → ③; thêm thuật toán mạnh mà không cải thiện → ④ (nghiệm cơ sở có vấn đề, có thể nó đã gần trần hoặc đang sai); thời gian vượt giới hạn → ⑥ (giảm quy mô). Mỗi dấu hiệu chỉ đúng với một bước."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§10.1–10.2",
      hoi: "Lời giải của bạn build sạch, 0 vi phạm trên 500 test, nhưng thời gian worst-case đo được là 62 ms trên giới hạn 100 ms. Theo checklist chốt an toàn, bạn nên làm gì?",
      chon: [
        "Nộp luôn vì 62 ms vẫn nhỏ hơn 100 ms",
        "Chuyển sang cấu hình an toàn hoặc hạ quy mô (như bản 1 preset trong bài: 8,6 ms trung bình, 13,2 ms xấu nhất), vì tiêu chuẩn là worst-case ≤ 50 % giới hạn",
        "Chạy lại nhiều lần đến khi đo được dưới 50 ms thì nộp",
        "Bỏ bớt lớp kiểm tra vi phạm để chạy nhanh hơn"
      ],
      dung: 1,
      giaiThich: "Checklist đòi worst-case ≤ 50 % giới hạn, vì máy chấm có thể chậm hơn máy dev; 62 ms là 62 % nên chưa đạt. Cách xử lý của bài là luôn có hai cấu hình và chuyển bằng một dòng (bản an toàn chỉ kém 0,22 % điểm). Chọn lần đo đẹp nhất là tự lừa mình, còn bỏ kiểm tra vi phạm đánh đổi cả bài lấy vài ms."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 3, ref: "§2, §11, Bài tập 20.2",
      hoi: "Bạn nhận một đề mới (giả định) **“Lập lịch bảo trì”**: 150 máy, 5 ngày; mỗi ngày kỹ thuật viên làm tối đa 8 giờ; máy `i` mất `t_i` phút bảo trì và mang lại `v_i` điểm; đi giữa hai máy mất thời gian theo khoảng cách. Bảo trì quá giờ trong ngày thì điểm của cả test bằng 0. Đề kèm sẵn `main.cpp` của grader, điểm cộng dồn qua 500 test, và bạn có đúng **3 giờ**. Hãy lập kế hoạch buổi làm: với **từng bước ①–⑧** nêu việc cụ thể, sản phẩm đầu ra và số phút (theo tỉ lệ của bài).",
      goiY: ["Tỉ lệ thời gian: 10 / 10 / 15 / 5 / 5 / 40 / 10 / 5 %. 3 giờ là 180 phút.", "Với mỗi bước hãy nêu một việc làm ĐƯỢC CỤ THỂ cho đề này, không chỉ chép lại tên bước."],
      mau: "| Bước | Phút | Việc cụ thể cho đề này | Sản phẩm |\n|---|---:|---|---|\n| ① Đọc mã grader | 18 | Điều kiện nào ra 0 (quá 8 giờ trong ngày)? điểm cộng ở dòng nào? biến nào không reset giữa các ngày (vị trí, giờ)? số ngày có off-by-one không? hành động “miễn phí” (đi mà không phục vụ)? điểm có tích luỹ qua test không | danh sách quan sát cấu trúc |\n| ② Mô hình hoá | 18 | S = lịch (máy → ngày, thứ tự trong ngày); C = ≤ 8 giờ mỗi ngày, mỗi máy tối đa một lần; f = Σ v_i. Biểu diễn: danh sách thứ tự cho từng ngày. Tài nguyên bão hoà trước: **thời gian trong ngày** | một trang giấy (S, C, f) |\n| ③ Bộ chấm cục bộ | 27 | Bộ sinh dữ liệu tất định từ seed, bộ chấm chép logic grader, thống kê trung bình và SE, đếm vi phạm, nhật ký thí nghiệm — **chưa có thuật toán** | harness chạy được 500 test |\n| ④ Nghiệm cơ sở | 9 | Greedy theo tỉ số v / (t + đi lại) | một con số mốc |\n| ⑤ Cận trên | 9 | Bỏ thời gian đi lại, giải cái túi phân số theo tổng giờ của 5 ngày | dư địa (%) |\n| ⑥ Cải tiến có đo | 72 | Mỗi lần MỘT thay đổi, ghi nhật ký: khai thác điều phát hiện ở ① → giá mờ → chèn → beam / local search → đa khởi động | bảng nhật ký, bản tốt nhất |\n| ⑦ Ablation | 18 | Bỏ từng thành phần, đo lại, xoá thứ đóng góp ≈ 0 rồi chạy lại | bảng ablation |\n| ⑧ Chốt an toàn | 9 | 0 vi phạm trên ≥ 500 test, worst-case ≤ 50 % giới hạn, build sạch, sanitizer, trường hợp biên, cấu hình dự phòng | checklist đã tick |\n\nTổng: 18 + 18 + 27 + 9 + 9 + 72 + 18 + 9 = 180 phút. Năm bước đầu chỉ 81 phút (45 %) nhưng quyết định 72 phút của bước ⑥ có ý nghĩa hay chỉ là đoán mò. Nếu sau ⑤ còn cách cận trên hơn 20 %, quay lại ② thay vì viết thêm thuật toán.",
      tieuChi: [
        "Đúng thứ tự ①–⑧: bộ chấm (③) trước mọi thuật toán, nghiệm cơ sở (④) trước cận trên (⑤)",
        "Phân bổ thời gian bám tỉ lệ 10 / 10 / 15 / 5 / 5 / 40 / 10 / 5 % (tổng 180 phút), không dồn hết vào bước ⑥",
        "Bước ① nêu ít nhất 3 câu hỏi cụ thể từ checklist (điều kiện 0 điểm, biến không reset, off-by-one, hành động miễn phí…)",
        "Bước ② viết đủ (S, C, f), biểu diễn, và trả lời “tài nguyên nào bão hoà trước?”",
        "Bước ⑥ có “mỗi lần một thay đổi” và nhật ký; bước ⑦–⑧ có ablation rồi checklist chốt (0 vi phạm, worst-case ≤ 50 %)",
        "Nêu ít nhất một mốc để quay lại bước trước (ví dụ dư địa > 20 % → ②)"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§3.2–3.3, Bài tập 20.1",
      hoi: "Đây là hàm `move` trong mã grader của một đề tương tự:\n\n```cpp\nvoid move(int mY, int mX) {\n    int startMin = gCurMin;\n    gCurMin += ABS(...) + ABS(...);\n    if (gCurMin > 720) { SCORE = 0; return; }\n    gPosY = mY; gPosX = mX;\n    if (gMapInfo[gPosY][gPosX] == 0) return;\n    gCurMin += gMapInfo[gPosY][gPosX]*30 + 30;\n    if (gCurMin > 720) { SCORE = 0; return; }\n    SCORE += gPrice[...];\n    if (gCurMin > 480) SCORE += (gCurMin - MAX(480, startMin)) * 200;\n    gMapInfo[gPosY][gPosX] = 0;\n}\n```\nÁp dụng bước ①: liệt kê **ít nhất 4 quan sát cấu trúc** từ mã này và nói mỗi quan sát ảnh hưởng đến mô hình hoá hay thuật toán thế nào.",
      goiY: ["Đi qua checklist: điều kiện nào làm điểm bằng 0? điểm cộng ở những dòng nào? có hành động “miễn phí” không?", "Nhìn kỹ dòng `if (gMapInfo[...] == 0) return;` và dòng thưởng OT."],
      mau: "1. **Ràng buộc cứng 720 phút**: vượt 720 (khi chỉ đi hoặc sau khi phục vụ) thì `SCORE = 0` — không phải bị trừ điểm, và nếu điểm cộng dồn qua test thì cả bài hỏng. Mô hình: 720 là ràng buộc cứng, bộ chấm phải đếm vi phạm riêng; mốc 480 chỉ là điểm bắt đầu thưởng OT.\n2. **Đi vào ô trống vẫn tốn thời gian đi nhưng không sinh điểm, không tốn thời gian phục vụ** (hàm `return` sớm sau khi cộng thời gian di chuyển). Hệ quả: tuyệt đối tránh giữa kỳ; còn sau lần phục vụ cuối thì thời gian đó **miễn phí** — kỹ thuật “di chuyển chết cuối ngày”.\n3. **Thưởng OT** chỉ tính phần vượt 480 của chính lần ghé này, `(gCurMin − MAX(480, startMin)) × 200`; cộng lại nó chỉ phụ thuộc giờ kết thúc (thưởng OT “co rút”) nên mô hình đơn giản hơn bề ngoài.\n4. **Mỗi ô chỉ ăn điểm một lần**: `gMapInfo = 0` sau khi phục vụ, nên ghé lại ô đó thành đi vào ô trống. Thời gian phục vụ phụ thuộc giá trị ô (`× 30 + 30`).\n5. **Vị trí hiện tại được ghi lại** (`gPosY`, `gPosX`): chi phí lần di chuyển sau tính từ đây — trạng thái nối tiếp, không reset.",
      tieuChi: [
        "Nêu ràng buộc cứng 720 phút và `SCORE = 0` (không phải trừ điểm)",
        "Nêu “ô trống: tốn thời gian đi, không điểm, không thời gian phục vụ” và hệ quả (tránh giữa kỳ; miễn phí sau lần phục vụ cuối)",
        "Nêu thưởng OT chỉ tính phần vượt 480 và nó “co rút” theo giờ kết thúc",
        "Mỗi quan sát được gắn với ảnh hưởng tới mô hình hoá hoặc thuật toán, không chỉ chép lại dòng mã"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "§10.3",
      hoi: "Ở bước ①, bạn phát hiện `nextDay()` cho gọi 30 lần, tức 31 khung ngày — nhưng đề bài nói “30 ngày” và bạn nghi đây là lỗi (off-by-one) của ban tổ chức. Khai thác nó đáng khoảng +3 % điểm; nếu ban tổ chức sửa lại mà cách giải của bạn vẫn dùng ngày thứ 31 thì sẽ vi phạm và bị 0 điểm. Bạn xử lý thế nào để vừa hưởng lợi vừa an toàn?",
      goiY: ["Nghĩ đến một công tắc biên dịch và một phương án dự phòng.", "Bản bảo thủ phải đạt điều kiện gì thì cược này mới “có trần lỗ rõ ràng”?"],
      mau: "Ba việc theo §10.3: (1) đặt khai thác sau một **cờ biên dịch** (`#define USE_31_DAYS 1`) để chuyển về mô hình 30 ngày bằng đúng một dòng; (2) **xác nhận bản bảo thủ** (không dùng khung thứ 31) **vẫn tốt hơn baseline** — trong đề thi thật nó vẫn vượt greedy; như vậy rủi ro chỉ là mất phần thưởng của khung thứ 31 chứ không mất cả bài; (3) **ghi rõ trong báo cáo** rằng bạn đang khai thác điều này.\n\nThêm: giữ luôn hai cấu hình (chính và an toàn) chuyển bằng một dòng, và dựa vào ablation (bỏ khung thứ 31 làm điểm tụt từ 32 915 840 xuống 31 900 896, tức 3,08 %) để quyết định có cơ sở. Đây là ô cược rẻ và có trần lỗ rõ ràng.",
      tieuChi: [
        "Nêu cờ biên dịch (`#define`) để bật / tắt khai thác bằng một dòng",
        "Nêu việc xác nhận bản bảo thủ vẫn tốt hơn baseline",
        "Nêu ghi rõ trong báo cáo (minh bạch về điều đang khai thác)",
        "Nhận ra đây là cược có trần lỗ rõ ràng: mất phần thưởng, không mất toàn bộ điểm"
      ]
    },
    {
      id: "l4", doKho: 2, ref: "§9",
      hoi: "Bảng ablation (điểm trung bình; bản đầy đủ = 32 915 840):\n\n| Bỏ đi | Điểm |\n|---|---:|\n| khung ngày thứ 31 | 31 900 896 |\n| beam search | 32 114 975 |\n| thưởng ρ | 32 883 559 |\n| mật độ σ | 32 910 944 |\n\nTính Δ % của từng dòng, quyết định giữ hay xoá từng thành phần, và nói bạn phải làm gì **sau** khi xoá.",
      goiY: ["Δ = (điểm khi bỏ − điểm đầy đủ) / điểm đầy đủ.", "Cái nào đóng góp gần 0 %? Sau khi xoá chúng, các con số còn lại có chắc không đổi không?"],
      mau: "Δ = (điểm khi bỏ − 32 915 840) / 32 915 840:\n\n- khung ngày thứ 31: **−3,08 %** → giữ (thành phần quan trọng nhất);\n- beam search: **−2,43 %** → giữ;\n- thưởng ρ: **−0,10 %** → đóng góp ≈ 0, xoá;\n- mật độ σ: **−0,01 %** → ≈ 0, xoá.\n\nSau khi xoá phải: (1) **chạy lại ablation** trên phiên bản đã xoá vì các con số có thể đổi (đã xảy ra: “phạt thời gian chết” từ −1,33 % thành −2,43 % sau khi xoá `tailFill`); (2) **ghi bảng vào báo cáo** làm bằng chứng cho mọi tuyên bố cải thiện; (3) với thành phần sát ngưỡng, kiểm bằng 2·SE trên nhiều test để không xoá nhầm thứ có ích.",
      tieuChi: [
        "Tính đúng Δ: −3,08 %, −2,43 %, −0,10 %, −0,01 %",
        "Giữ khung ngày 31 và beam search; xoá thưởng ρ và mật độ σ (đóng góp ≈ 0)",
        "Nêu phải chạy lại ablation sau khi xoá và lý do (các con số có thể đổi)",
        "Nêu ghi bảng ablation vào báo cáo làm bằng chứng"
      ]
    }
  ],

  lab: [
    {
      id: "ablation-giu-hay-xoa",
      ten: "Ablation: giữ đóng góp thật, xoá nhiễu",
      doKho: 2,
      ref: "§9, §0 (SE)",
      de: "Bước ⑦ của quy trình là **ablation**: bỏ từng thành phần khỏi lời giải đầy đủ rồi đo lại. Nhưng một lần đo chỉ là một mẫu — phải phân biệt **đóng góp thật** với **nhiễu** (chênh lệch chỉ đáng tin khi lớn hơn **2·SE**, Bài 4).\n\n" +
          "**Đầu vào:** dòng 1 là `m K` — số thành phần và số test; rồi `K` dòng, dòng `k` là `full bo₁ bo₂ … bo_m`: điểm bản đầy đủ và điểm khi **bỏ** từng thành phần, đều trên **cùng** test `k`.\n\n" +
          "Với mỗi thành phần `j`: `Δ_kj = 100 · (full_k − bo_kj) / full_k` (phần trăm điểm tụt ở test `k`); `μ_j` là trung bình các `Δ_kj`; `SE_j = σ_j / √K` với `σ_j` là độ lệch chuẩn **mẫu** (chia `K − 1`). Thành phần **được giữ** nếu `μ_j > 2·SE_j`; ngược lại là nhiễu (hoặc có hại nếu `μ_j < 0`) và nên **xoá**.\n\n" +
          "**Đầu ra:** một dòng `2m` số: `μ₁ … μ_m` (phần trăm, sai số ≤ 0,006) rồi `f₁ … f_m` với `f_j = 1` nếu giữ, `0` nếu xoá. Chấm trên 10 bộ dữ liệu; chỉ có một mức — kết quả phải khớp.\n\n" +
          "Thử các biến thể dữ liệu (tab bên dưới): cùng bộ thành phần, nhưng nhiễu cao thì thành phần nào đổi từ giữ sang xoá? **Suy ngẫm:** (1) vì sao một lần đo duy nhất (`K = 1`) không đủ cho bước ⑦? (2) một thành phần có `μ < 0` (bỏ đi mà điểm lại **tăng**) nói lên điều gì? (3) sau khi xoá, vì sao phải chạy lại ablation?",
      vanDe: "b20-ablation",
      tham: { K: 40, nhieu: 0.3 },
      bienThe: [
        { ten: "Ít nhiễu (σ ≈ 0,3 %, K = 40)", tham: { K: 40, nhieu: 0.3 } },
        { ten: "Nhiễu cao (σ ≈ 1,2 %, K = 40)", tham: { K: 40, nhieu: 1.2 } },
        { ten: "Quá ít test (K = 4)", tham: { K: 4, nhieu: 0.5 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "m K", rồi K dòng "full bo1 ... bom" (điểm bản đầy đủ và điểm khi BỎ từng thành phần, cùng một test).
// Đầu ra : dòng "mu1 ... mum f1 ... fm"  (mu: % điểm tụt trung bình; f = 1 giữ, 0 xoá).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], K = t[1];
let vt = 2;

// delta[j] = danh sách K giá trị 100 * (full - bo_j) / full
const delta = Array.from({ length: m }, () => []);
for (let k = 0; k < K; k++) {
  const full = t[vt++];
  for (let j = 0; j < m; j++) delta[j].push(100 * (full - t[vt++]) / full);
}

const mu = [], giu = [];
for (let j = 0; j < m; j++) {
  // TODO: mu[j] = trung bình delta[j]; SE = độ lệch chuẩn mẫu (chia K - 1) / căn K;
  //       giu[j] = 1 nếu mu > 2 * SE, ngược lại 0
  mu.push(0); giu.push(0);
}
print(mu.map((x) => x.toFixed(4)).join(" "));
print(giu.join(" "));
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], K = t[1];
let vt = 2;

const delta = Array.from({ length: m }, () => []);
for (let k = 0; k < K; k++) {
  const full = t[vt++];
  for (let j = 0; j < m; j++) delta[j].push(100 * (full - t[vt++]) / full);
}

const mu = [], giu = [];
for (let j = 0; j < m; j++) {
  const tb = delta[j].reduce((a, b) => a + b, 0) / K;
  const bp = delta[j].reduce((a, d) => a + (d - tb) * (d - tb), 0) / (K - 1);   // phương sai MẪU
  const se = Math.sqrt(bp) / Math.sqrt(K);                                        // SE = sigma / căn K
  mu.push(tb);
  giu.push(tb > 2 * se ? 1 : 0);                                                  // giữ nếu đóng góp > 2·SE
}
print(mu.map((x) => x.toFixed(4)).join(" "));
print(giu.join(" "));
`
      },
      goiY: [
        "Với mỗi thành phần j, gom K giá trị Δ_kj = 100·(full_k − bo_kj)/full_k, rồi tính trung bình μ_j.",
        "Độ lệch chuẩn mẫu chia cho K − 1 (không phải K); SE = σ / √K. Giữ thành phần khi μ_j > 2·SE_j — nên thành phần có μ âm luôn bị xoá.",
        "In μ với 4 chữ số thập phân (`toFixed(4)`), rồi dòng cờ 0/1. Đừng làm tròn μ trước khi so với 2·SE."
      ]
    }
  ]
});
