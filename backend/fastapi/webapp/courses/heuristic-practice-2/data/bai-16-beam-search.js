/* Thực hành — Bài 16: Beam Search — tìm kiếm trên cây có kiểm soát. */

/* Bài toán dựng riêng cho bài này (tiền tố b16-):
   - b16-ship1-beam: P1 (ship1) nhưng stdin có thêm dòng đầu `K RHO` — độ rộng beam và hệ số tiềm năng ρ.
   - b16-xep-hang: chấm đúng hàm xếp hạng rank = f + ρ·(T − t) và bước cắt tỉa top-W (chỉ có một đáp án đúng). */
(function () {
  "use strict";
  var sh = TH.vande.lay("ship1");
  TH.vande.keThua("ship1", "b16-ship1-beam", {
    sinh: function (seed, tham) {
      var inst = sh.sinh(seed, tham);
      inst.k = tham && tham.k != null ? tham.k : 30;
      inst.rho = tham && tham.rho != null ? tham.rho : 20;
      return inst;
    },
    viet: function (inst) { return inst.k + " " + inst.rho + "\n" + sh.viet(inst); },
    dinhDang: {
      vao: "Dòng 1: `K RHO` — **độ rộng beam** và hệ số tiềm năng ρ (đồng/phút). Rồi đúng định dạng P1: dòng `n T` (số đơn, số phút trong ngày = 480), dòng `50 50` (kho), và `n` dòng `x y p s` — toạ độ, tiền, số phút giao của đơn `i` (đánh số từ 1). Đi từ `u` sang `v` mất `|Δx| + |Δy|` phút.",
      ra: sh.dinhDang.ra
    }
  });

  TH.vande.dangKy("b16-xep-hang", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), m = (tham && tham.m) || 12, W = (tham && tham.W) || 4, T = 480;
      var rho = tham && tham.rho != null ? tham.rho : 100, st = [], i;
      for (i = 0; i < m; i++) st.push({ f: 500 * r.khoang(16, 60), t: 5 * r.khoang(30, 94) });
      /* một “trạng thái sinh đôi” cùng rank (khi ρ = 100) nhưng dùng nhiều thời gian hơn: ép chỗ hoà phải dùng quy tắc t nhỏ hơn */
      var a = r.int(m - 1), k = r.khoang(1, 3), t2 = st[a].t + 5 * k;
      if (t2 <= 475) st[m - 1] = { f: st[a].f + 500 * k, t: t2 };
      else st[m - 1] = { f: st[a].f - 500 * k, t: st[a].t - 5 * k };
      return { m: m, W: W, T: T, rho: rho, st: st };
    },
    viet: function (inst) {
      var s = inst.m + " " + inst.W + " " + inst.T + " " + inst.rho + "\n";
      inst.st.forEach(function (x) { s += x.f + " " + x.t + "\n"; });
      return s;
    },
    giai: function (inst) {
      var ds = inst.st.map(function (x, i) { return { i: i, f: x.f, t: x.t, rank: x.f + inst.rho * (inst.T - x.t) }; });
      var ord = ds.slice().sort(function (p, q) { return q.rank - p.rank || p.t - q.t || p.i - q.i; });
      var giu = ord.slice(0, inst.W).map(function (x) { return x.i + 1; });
      var fMax = -1, iMax = -1;
      ds.forEach(function (x) { if (x.f > fMax) { fMax = x.f; iMax = x.i; } });
      return [giu, fMax, giu.indexOf(iMax + 1) >= 0 ? 0 : 1];
    },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `m W T RHO` — số trạng thái dở dang (cùng một tầng), số trạng thái giữ lại, độ dài ngày, hệ số tiềm năng ρ. Rồi `m` dòng `f t`: tiền đã thu và số phút đã dùng của trạng thái `i` (đánh số từ 1).",
      ra: "Một dòng: `W` chỉ số trạng thái được giữ theo thứ tự rank giảm dần; rồi `fMax` — giá trị `f` lớn nhất trong **tất cả** `m` trạng thái; cuối cùng 1 nếu trạng thái đạt `fMax` (chỉ số nhỏ nhất nếu hoà) bị cắt tỉa, ngược lại 0."
    }
  }));
})();

TH.dangKy({
  id: "bai-16-beam-search",

  tomTat: [
    "Beam search = **BFS + cắt tỉa**: mỗi tầng mở rộng mọi trạng thái đang giữ, chấm điểm các trạng thái con, giữ lại **W** cái tốt nhất, vứt phần còn lại. **W = 1 là greedy**, W = ∞ là vét cạn; bộ nhớ luôn cố định cỡ W dù cây có 10²⁸ đường.",
    "Greedy sai không phải vì công thức chấm điểm mà vì **chỉ giữ một phương án**: ở ví dụ làm tay greedy thu 260 nghìn, beam W = 2 thu 300 nghìn (hơn 15 %) nhờ không vứt vĩnh viễn nhà B và C ở bước đầu.",
    "Phần khó nhất là chấm điểm **nghiệm dở dang**: rank(s) = f(s) + ρ·R(s) — đã thu **cộng** tiềm năng còn lại. Chỉ so bằng quá khứ thì trạng thái sắp hết giờ (thu nhiều) thắng trạng thái còn nhiều thời gian (thu ít hơn).",
    "Khi f là điểm **gộp**, ρ **chính là giá mờ λ** của Bài 6 (“một phút còn lại hứa hẹn bao nhiêu đồng?”). Với f gộp mà quên số hạng tiềm năng thì beam thoái hoá thành greedy dù W lớn: ρ = 0,3 chỉ được 58 103, thua cả greedy tỉ số 61 420; ρ = λ lên 64 273. Nếu f đã là giá trị **ròng** như ở đề thi thật thì λ đã nằm sẵn trong f, ρ ≠ λ (ρ = 90 còn λ ≈ 1 420) và bỏ hẳn ρ chỉ mất ≈ 0,15 %.",
    "Trong bài chọn lọc **mọi trạng thái ở mọi tầng** đều là một nghiệm hợp lệ: đánh giá ngay khi sinh ra, đừng chỉ nhìn tầng cuối (nghiệm tốt nhất có thể ở tầng 7 khi beam chạy tới tầng 12).",
    "Chọn W: W ≈ 10–30, B ≈ 5–10. Lợi ích giảm dần rất nhanh (W 1 → 8: +2,3 %; W 8 → 32: chỉ +0,36 %) và bão hoà ở W ≈ 30 vì các trạng thái trở nên giống nhau (mất đa dạng); chữa bằng beam ngẫu nhiên, phạt giống nhau, hoặc local search sau beam.",
    "Beam mạnh khi **thứ tự xây dựng trùng thứ tự trong nghiệm** và cần nhìn xa vài bước: trên đề thi thật bỏ beam mất 2,43 %; nhưng ở P1 beam W = 30 (64 273) thua chèn rẻ nhất (65 425), một lý do hợp lý là beam chỉ nối vào cuối còn chèn đặt được vào giữa (số đo gắn với dữ liệu và ρ của lab — hãy tự đo).",
    "Một beam rộng hiệu quả hơn đa khởi động: 1 preset với W = 32 cho cùng chất lượng 10 preset với W = 12 nhưng nhanh hơn 2,6 lần."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "§1.2–1.3", donVi: "(%)",
      hoi: "Ở ví dụ làm tay §1 (bốn nhà A, B, C, D), greedy thu 260 nghìn còn cách tốt nhất thu 300 nghìn. Greedy kém tối ưu bao nhiêu phần trăm (so với 300)?",
      dapAn: 13.3, saiSo: 0.4,
      giaiThich: "(300 − 260) / 300 = 13,3 % (bài ghi tròn 13 %). Greedy thua vì đúng một lý do: ở bước đầu nó chọn A (4,0 nghìn/phút, cao nhất) rồi xoá sổ mọi phương án khác, mà 15 phút ở A làm bạn không kịp giao nhà thứ ba trong cụm B–C–D. Công thức “nghìn mỗi phút” không sai — lỗi là chỉ giữ một phương án."
    },
    {
      id: "q2", loai: "nhieu", doKho: 1, ref: "§2, §3",
      hoi: "Chọn mọi phát biểu ĐÚNG về vị trí của beam search:",
      chon: [
        "Với W = 1, beam search chính là greedy",
        "Bộ nhớ cố định cỡ O(W) dù cây tìm kiếm có 10²⁸ đường",
        "Không cần hàm đánh giá “chấp nhận được” như A*, nhưng cũng không bảo đảm tối ưu",
        "Beam search bảo đảm lời giải tối ưu miễn là W ≥ 2",
        "Beam search là DFS có cắt tỉa"
      ],
      dung: [0, 1, 2],
      giaiThich: "Ba ý đầu đúng theo §2–§3: W = 1 giữ đúng một đường (greedy); mỗi lúc chỉ có W trạng thái trong tay; beam không đòi hỏi h chấp nhận được nhưng đánh đổi mất bảo đảm tối ưu. Beam KHÔNG bảo đảm tối ưu với bất kỳ W hữu hạn nào, và nó là BFS có cắt tỉa theo chất lượng (đi theo từng tầng), không phải DFS."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "Bài tập 16.1", donVi: "(trạng thái)",
      hoi: "Với W = 3, B = 4 (mỗi trạng thái sinh tối đa 4 nhánh) và độ sâu 10, dùng công thức cận trên độ sâu × W × B: beam search sinh ra tối đa bao nhiêu trạng thái con tất cả?",
      dapAn: 120, saiSo: 0,
      giaiThich: "Mỗi tầng chỉ mở rộng W = 3 trạng thái, mỗi trạng thái cho tối đa B = 4 con, qua 10 tầng: 10 × 3 × 4 = 120 (cận trên; chính xác là 4 + 9 × 12 = 112, vì tầng 1 chỉ mở rộng đúng một trạng thái gốc). Vét cạn phải duyệt 4¹⁰ = 1 048 576 lá — tỉ lệ cỡ 1 : 8 700 (1 : 9 400 nếu tính 112). Chi phí của beam tuyến tính theo độ sâu và theo W, không mũ."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§4.1–4.2", donVi: "(đồng)",
      hoi: "Trạng thái A: thu 20 000 đ, đã dùng 300 phút. Trạng thái B: thu 22 000 đ, đã dùng 420 phút. Ngày dài T = 480 phút, ρ = 100 đ/phút, rank(s) = f(s) + ρ·(T − t). Tính rank(A) − rank(B).",
      dapAn: 10000, saiSo: 0,
      giaiThich: "rank(A) = 20 000 + 100 × (480 − 300) = 38 000. rank(B) = 22 000 + 100 × (480 − 420) = 28 000. Hiệu = 10 000, A thắng dù đã thu ít hơn B 2 000: B sắp hết giờ còn A vẫn có thể thu thêm nhiều. Nếu xếp hạng chỉ theo f thì B thắng — chính là lỗi so sánh trạng thái chỉ bằng quá khứ."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§4.1",
      hoi: "Nếu xếp hạng các trạng thái dở dang chỉ theo điểm đã thu f(s) thì vấn đề gì xảy ra?",
      chon: [
        "Beam chạy chậm hơn vì phải so sánh nhiều hơn",
        "Beam không bao giờ sinh được nghiệm hợp lệ",
        "Trạng thái đã tiêu gần hết tài nguyên (thu nhiều) thắng trạng thái còn nhiều tiềm năng (thu ít hơn) — beam so sánh chỉ bằng quá khứ",
        "Không có vấn đề gì: điểm đã thu là chỉ số tốt nhất"
      ],
      dung: 2,
      giaiThich: "Ở tầng k mọi trạng thái đều có k phần tử nhưng khác nhau ở tài nguyên đã tiêu. Chỉ theo f(s), trạng thái B (thu 22 000, còn 60 phút) thắng A (thu 20 000, còn 180 phút) dù A hứa hẹn hơn. Tốc độ so sánh không đổi, nghiệm hợp lệ vẫn được sinh ra (vấn đề là chất lượng), và nói “không có vấn đề” trái với toàn bộ §4."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§4.3",
      hoi: "Hệ số ρ trong rank(s) = f(s) + ρ·R(s) liên hệ thế nào với các bài trước?",
      chon: [
        "ρ chính là bề rộng beam W",
        "ρ là xác suất cắt tỉa một trạng thái",
        "ρ hoàn toàn mới, buộc phải dò từ đầu bằng lưới tham số",
        "Khi f là điểm gộp, ρ chính là giá mờ λ của Bài 6 — cùng câu hỏi “một phút đáng bao nhiêu đồng”, nên dùng lại λ đã tính"
      ],
      dung: 3,
      giaiThich: "Giá mờ λ trả lời “một phút đáng bao nhiêu đồng?”, ρ trả lời “một phút CÒN LẠI hứa hẹn bao nhiêu đồng?” — cùng một câu hỏi khi f là điểm gộp (chưa trừ λ·c): f + λR xếp hạng giống hệt giá trị ròng, nên không phải dò từ đầu. W là số trạng thái giữ lại (một tham số khác hẳn), ρ không phải xác suất, và vì đã có λ nên cũng không cần quét lưới mù (dù vẫn nên quét quanh λ để xác nhận). Nếu f đã là tổng giá trị ròng như ở đề thi thật thì λ đã nằm sẵn trong f và ρ ≠ λ (ρ tối ưu = 90, còn λ ≈ 1 420)."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§4.4",
      hoi: "Một bản beam cài đặt với f là điểm gộp và ρ = 0,3 (quá nhỏ so với giá trị đơn cỡ 4 000) chỉ đạt 58 103, thua cả greedy tỉ số (61 420); sửa ρ = λ thì lên 64 273. Hiện tượng này tên là gì?",
      chon: [
        "W quá nhỏ nên beam cắt tỉa nhầm",
        "Thiếu số hạng tiềm năng: beam thoái hoá thành greedy — chộp phần tử giá trị cao ngay từ đầu rồi cạn tài nguyên, dù W lớn đến đâu",
        "Trạng thái quá nặng nên sao chép chậm và hết giờ",
        "Beam luôn thua greedy tỉ số khi ρ nhỏ do sai số làm tròn"
      ],
      dung: 1,
      giaiThich: "Với ρ ≈ 0, rank ≈ f(s): mọi trạng thái được giữ lại đều là loại “tham lam sớm”, nên tăng W cũng không cứu được — đó là lỗi nghiêm trọng nhất của beam (cạm bẫy 1; đúng với f gộp, còn với f ròng như đề thi thật bỏ hẳn ρ chỉ mất ≈ 0,15 %). Nguyên nhân không phải W nhỏ, bộ nhớ hay làm tròn: chỉ cần thay ρ = 0,3 bằng ρ = λ là điểm nhảy từ 58 103 lên 64 273."
    },
    {
      id: "q8", loai: "nhieu", doKho: 3, ref: "§7",
      hoi: "Chọn mọi phát biểu ĐÚNG về bề rộng beam W (theo số liệu quét trên đề thi thật):",
      chon: [
        "Tăng W luôn cho kết quả tốt hơn nên cứ chọn W lớn nhất chịu được",
        "Lợi ích giảm dần rất nhanh: W từ 1 lên 8 tăng ≈ 2,3 %, còn từ 8 lên 32 chỉ thêm ≈ 0,36 %",
        "Có điểm bão hoà: W = 80 không tốt hơn W = 32 vì các trạng thái trở nên giống nhau (mất đa dạng)",
        "Chi phí thời gian tăng gần tuyến tính theo W, còn bộ nhớ vẫn cố định cỡ O(W)",
        "Quy tắc bỏ túi là W ≈ 200–500 và B ≈ 50"
      ],
      dung: [1, 2, 3],
      giaiThich: "Bảng §7: W = 1 → 8 cho +2,3 %, 8 → 32 chỉ +0,36 %, và W = 80 (32 937 772) không vượt W = 32 (32 979 370) vì các trạng thái giống nhau. Cái giá của beam tỉ lệ với W (cột thời gian trong bảng §7 là số đo thô, không đơn điệu theo W — chỉ đọc xu hướng; số đáng tin cho W = 32, B = 10 là 14,5 ms ở §7.1c, và SCORE ở §7.1c tính trên 40 test nên không so trực tiếp với 300 test của bảng). Hai phát biểu còn lại sai: W lớn không phải lúc nào cũng tốt hơn (bão hoà), và quy tắc bỏ túi là W ≈ 10–30, B ≈ 5–10."
    },
    {
      id: "q9", loai: "mot", doKho: 2, ref: "§5.5, §9 (cạm bẫy 3)",
      hoi: "Trong bài chọn lọc như P1, vì sao phải đánh giá mọi trạng thái ở mọi tầng chứ không chỉ các trạng thái ở tầng cuối?",
      chon: [
        "Mọi trạng thái ở mọi tầng đều là một nghiệm hợp lệ, và nghiệm tốt nhất có thể nằm ở tầng 7 trong khi beam chạy tới tầng 12",
        "Vì tầng cuối luôn rỗng nên không có gì để đánh giá",
        "Vì bắt buộc phải kiểm tra trùng lặp giữa các tầng",
        "Vì bề rộng beam W giảm dần theo từng tầng"
      ],
      dung: 0,
      giaiThich: "Với bài chọn lọc, dừng ở bất kỳ tầng nào vẫn cho một tuyến hợp lệ, và tuyến tốt nhất không nhất thiết là tuyến dài nhất. Hãy gọi giaTriKetThuc(s) ngay khi sinh trạng thái và nhớ kỷ lục. Tầng cuối không rỗng, việc kiểm trùng không phải lý do, và W cố định chứ không giảm theo tầng."
    },
    {
      id: "q10", loai: "mot", doKho: 3, ref: "§6.1–6.2",
      hoi: "Ở P1 beam W = 30 đạt 64 273, thua chèn rẻ nhất (65 425); nhưng trên đề thi thật bỏ beam làm mất 2,43 % điểm. Lời giải thích của bài là gì?",
      chon: [
        "Số liệu của P1 bị đo sai nên phải bỏ đi",
        "Đề thi thật dùng ρ = 0 nên beam hoạt động tốt hơn",
        "Beam chỉ có lợi khi W vượt 100",
        "Ở P1 beam chỉ nối vào cuối tuyến còn chèn đặt được vào giữa; đề thi thật nhiều kỳ và đòi nhìn xa vài bước (lịch kết thúc sát 720 phút) — đúng thứ beam giỏi mà chèn không mô hình hoá được"
      ],
      dung: 3,
      giaiThich: "Beam mạnh khi thứ tự xây dựng trùng thứ tự trong nghiệm và cần nhìn xa; chèn linh hoạt hơn khi được phép đặt phần tử vào giữa. Hai kết quả không mâu thuẫn (đây là lý do hợp lý của bài, không phải phép đo tách riêng; dấu của hiệu beam − chèn còn phụ thuộc dữ liệu và ρ). Các phương án còn lại bịa ra lý do: không có dấu hiệu số liệu sai, ρ = 0 chính là lỗi ở §4.4, và bão hoà xảy ra quanh W ≈ 30 chứ không phải W > 100."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Bài tập 16.2, §4.4",
      hoi: "Đặt ρ = 0 trong beam search và đo lại. Điểm giảm bao nhiêu? Giải thích bằng §4.4. (Lab bên dưới có sẵn biến thể ρ = 0.)",
      goiY: ["Khi ρ = 0, rank(s) còn lại gì?", "Các trạng thái được giữ lại thuộc loại nào, và tăng W có cứu được không?"],
      mau: "Điểm giảm mạnh: đáp án 16.2 nêu cỡ **8–10 %**, số liệu thật của khoá là ρ quá nhỏ làm beam rơi từ 64 273 xuống 58 103 — thấp hơn cả greedy tỉ số (61 420) — đo ở ρ = 0,3 với f là điểm gộp (với f ròng như đề thi thật, bỏ hẳn ρ chỉ mất ≈ 0,15 %). Trong lab ship1 của trang này, biến thể “K = 30, ρ = 0” chỉ đạt khoảng hai phần ba điểm của greedy tỉ số (và chưa tới 60 % điểm của bản ρ = 20) — con số cụ thể bạn tự đo.\n\nGiải thích: rank(s) = f(s) + ρ·R(s). Với ρ = 0 chỉ còn f(s) — beam so sánh các trạng thái **chỉ bằng quá khứ**. Nó ưu tiên các trạng thái “tham lam sớm”: chộp những đơn giá trị cao ngay từ đầu rồi cạn thời gian. Mọi trạng thái được giữ lại đều thuộc loại đó nên tăng W cũng không cứu được; beam thoái hoá thành greedy theo giá trị. Chữa: với f gộp, dùng ρ ≈ λ (giá mờ của Bài 6) rồi quét quanh nó.",
      tieuChi: [
        "Nêu rank = f + ρ·R và ρ = 0 chỉ còn lại quá khứ (f)",
        "Nêu hệ quả: giữ các trạng thái tham lam sớm, cạn tài nguyên, thoái hoá thành greedy; tăng W không cứu được",
        "Nêu cách chữa: ρ chính là giá mờ λ của Bài 6 (khi f là điểm gộp)"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§1.5, §7.1(b), §8",
      hoi: "Ở ví dụ làm tay §1.4, cả hai phương án sống sót ở bước 2 đều bắt đầu bằng B. Hiện tượng đó tên là gì, vì sao nó làm beam bão hoà quanh W ≈ 30, và nêu hai cách chữa ở §8?",
      goiY: ["Nếu B hoá ra sai thì giữ hai phương án khác gì giữ một?", "§8.1 và §8.2."],
      mau: "Đó là **mất đa dạng** (diversity collapse): các trạng thái trong beam chung một tiền tố nên giữ W cái cũng như giữ 1 — nếu B sai thì cả hai đều sai.\n\nVì thế tăng W quá một ngưỡng không đem thêm thông tin: các trạng thái ngày càng giống nhau. Số liệu: W = 80 (32 937 772) không tốt hơn W = 32 (32 979 370).\n\nHai cách chữa: (1) **beam ngẫu nhiên** — lấy mẫu W trạng thái với xác suất tỉ lệ rank thay vì lấy đúng top W; (2) **beam đa dạng hoá** — phạt các trạng thái quá giống nhau, ví dụ rank[i] −= γ · (số trạng thái giống nó). Ngoài ra có thể đầu tư vào local search sau beam (§8.3) thay vì tăng W.",
      tieuChi: [
        "Gọi tên: mất đa dạng — các trạng thái chung tiền tố nên giữ W cũng như giữ 1",
        "Liên hệ với bão hoà: W = 80 không tốt hơn W = 32",
        "Nêu ít nhất hai cách chữa: beam ngẫu nhiên, phạt giống nhau (hoặc local search sau beam)"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "§6.1–6.2, §3",
      hoi: "Vì sao beam thua chèn rẻ nhất ở P1 nhưng lại là một trong những thành phần mạnh nhất (bỏ đi mất 2,43 %) ở đề thi thật? Từ đó nêu quy tắc “khi nào beam thắng, khi nào thua”.",
      goiY: ["So sánh thứ tự xây dựng của beam với của chèn.", "Đề thi thật có ràng buộc gì mà P1 không có?"],
      mau: "Một lý do hợp lý: beam xây nghiệm theo **thứ tự mở rộng = thứ tự trong nghiệm**: ở P1 mỗi tầng chỉ nối thêm một đơn vào **cuối** tuyến, còn heuristic chèn có thể đặt đơn vào **giữa** tuyến nên linh hoạt hơn — beam W = 30 được 64 273 < chèn rẻ nhất 65 425 (dù vẫn hơn greedy tỉ số 4,65 %).\n\nTrên đề thi thật có ràng buộc **nhiều kỳ**: phải chọn ngôi nhà cuối ngày sao cho lịch kết thúc sát 720 phút. Đó là quyết định nhìn xa vài bước — đúng thứ beam giỏi — còn chèn không mô hình hoá được ranh giới ngày. Bỏ beam (W → 1) mất 2,43 % (trong bảng ablation đầy đủ, khung ngày thứ 31 còn lớn hơn: −3,08 %).\n\n**Quy tắc**: beam thắng khi thứ tự xây dựng trùng thứ tự trong nghiệm và cần nhìn xa vài bước; beam thua khi có thể chèn vào giữa. Hai kết quả không mâu thuẫn mà bổ sung nhau (có thể chạy beam rồi local search để đánh bóng, §8.3).\n\nLưu ý trung thực: bảng “beam thua chèn” là số liệu của P1 trong khoá, phụ thuộc dữ liệu và ρ. Ở lab ship1 của trang này, beam K = 30 với ρ = 20 lại đạt cao hơn cả `tot` (LNS tham chiếu). Hãy tự đo trên dữ liệu của bạn trước khi kết luận (Bài 4).",
      tieuChi: [
        "Nêu beam ở P1 chỉ nối vào cuối còn chèn đặt được vào giữa",
        "Nêu đặc điểm đề thi thật: nhiều kỳ, cần nhìn xa vài bước",
        "Phát biểu quy tắc: beam thắng khi thứ tự xây = thứ tự trong nghiệm và cần nhìn xa"
      ]
    },
    {
      id: "l4", doKho: 3, ref: "Bài tập 16.5, §8.4",
      hoi: "Mô tả **beam lặp** (iterative widening): vòng lặp, ưu điểm, chi phí, và nói khi nào bạn dùng nó thay cho beam cố định W = 30.",
      goiY: ["Bắt đầu từ W = 4; làm gì với W khi còn thời gian?", "Bạn có phải biết trước W tối ưu không?"],
      mau: "**Vòng lặp**: W = 4; lặp — chạy beam với W; nếu còn thời gian thì W ← 2W; luôn giữ nghiệm tốt nhất qua các lần chạy.\n\n**Ưu điểm** (đáp án 16.5): đạt chất lượng tương đương beam cố định tối ưu mà **không cần biết trước W**, và tự thích nghi khi ngân sách thời gian thay đổi (máy chậm/nhanh, đề lớn/nhỏ) — dùng hết ngân sách mà không phải dò W.\n\n**Chi phí**: cỡ 50 % thời gian bị “lãng phí” vào các lần chạy W nhỏ (chi phí tỉ lệ với W mà W nhân đôi mỗi lần nên 4 + 8 + … xấp xỉ bằng đúng lần chạy cuối).\n\n**Khi nào dùng**: khi ngân sách thời gian chưa biết chắc hoặc thay đổi theo test; nếu đã quét và biết W ≈ 30 là điểm ngọt cho bài toán thì beam cố định rẻ hơn. Nhớ rằng bão hoà quanh W ≈ 30: sau đó nên đầu tư vào đa dạng hoá hoặc local search thay vì nhân đôi W mãi.",
      tieuChi: [
        "Mô tả đúng: bắt đầu W nhỏ, nhân đôi khi còn thời gian, giữ nghiệm tốt nhất",
        "Nêu ưu điểm: không cần biết trước W tối ưu, tự thích nghi với ngân sách",
        "Nêu chi phí (cỡ 50 % thời gian cho các lần W nhỏ) và khi nào chọn beam cố định"
      ]
    }
  ],

  lab: [
    {
      id: "beam-ship1",
      ten: "Beam search xây tuyến cho P1 (ship hàng)",
      doKho: 3,
      ref: "§4, §5, §7",
      de: "Cài **beam search** xây tuyến cho P1: mỗi **tầng** thêm đúng một đơn vào **cuối** tuyến. Dòng đầu của đầu vào là `K RHO` — **độ rộng beam** `K` và hệ số tiềm năng `ρ` (đồng/phút); sau đó là dữ liệu P1 như thường lệ (`n T`, kho `50 50`, `n` dòng `x y p s`).\n\n" +
          "**Trạng thái** = (tuyến đã đi, vị trí hiện tại, phút đã dùng `t`, tiền đã thu `f`). **Hàm xếp hạng** (§4.2): `rank = f + ρ·(T − t)`. Mỗi tầng: mở rộng **mọi** trạng thái đang giữ bằng mọi đơn chưa dùng mà vẫn kịp giờ, chấm `rank` cho các trạng thái con, giữ `K` cái cao nhất (hoà thì `t` nhỏ hơn, rồi chỉ số đơn nhỏ hơn, rồi trạng thái cha đứng trước), vứt phần còn lại; dừng khi không mở rộng được nữa.\n\n" +
          "**Mọi trạng thái ở mọi tầng đều là một nghiệm hợp lệ** (§5.5): hãy tính `f` của từng trạng thái con ngay khi sinh ra và in tuyến có `f` lớn nhất từng gặp (không chỉ tầng cuối).\n\n" +
          "Chấm trên 10 bộ `n = 120`, `K = 30`, `ρ = 20` (giá trị này đã được quét thử trên loại dữ liệu P1: nhỏ hơn thì beam yếu đi nhanh, lớn hơn nhiều cũng giảm nhẹ). **Mức đạt**: hợp lệ → bằng greedy tỉ số → hơn greedy tỉ số ≥ 8 % → ngang hoặc hơn `tot` (LNS tham chiếu của khoá).\n\n" +
          "**Khám phá bằng biến thể**: `K = 1` (§2: beam chính là greedy — nhưng greedy theo chỉ số nào? thử rút gọn `rank` khi `K = 1`), `K = 5`, `K = 100` (§7: lãi thêm bao nhiêu, tốn thêm bao nhiêu thời gian?), và `K = 30, ρ = 0` (§4.4: quên số hạng tiềm năng — beam có thoái hoá thành greedy theo tiền, có thua cả greedy tỉ số không?).",
      vanDe: "b16-ship1-beam",
      tham: { n: 120, k: 30, rho: 20 },
      bienThe: [
        { ten: "K = 30, ρ = 20 (mặc định)", tham: { n: 120, k: 30, rho: 20 } },
        { ten: "K = 1 (greedy)", tham: { n: 120, k: 1, rho: 20 } },
        { ten: "K = 5", tham: { n: 120, k: 5, rho: 20 } },
        { ten: "K = 100 (bão hoà?)", tham: { n: 120, k: 100, rho: 20 } },
        { ten: "K = 30, ρ = 0 (quên tiềm năng)", tham: { n: 120, k: 30, rho: 0 } },
        { ten: "Gom cụm, K = 30", tham: { n: 120, cum: true, k: 30, rho: 20 } }
      ],
      soTest: 10,
      gioiHanMs: 3000,
      muc: [
        { ten: "Bằng greedy tỉ số", so: "tiSo", heSo: 1 },
        { ten: "Hơn greedy tỉ số ≥ 8 %", so: "tiSo", heSo: 1.08 },
        { ten: "Ngang hoặc hơn LNS tham chiếu (tot)", so: "tot", heSo: 1 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "K RHO"; rồi "n T"; rồi toạ độ kho "kx ky"; rồi n dòng "x y p s".
// Đầu ra : dòng 1 là k (số đơn giao), dòng 2 là k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const K = t[0], rho = t[1], n = t[2], T = t[3], kx = t[4], ky = t[5];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[6 + 4 * i]); y.push(t[7 + 4 * i]); p.push(t[8 + 4 * i]); s.push(t[9 + 4 * i]);
}

// Trạng thái dở dang: tuyến đã đi, vị trí hiện tại (-1 = kho), phút đã dùng, tiền đã thu.
let chum = [{ tuyen: [], cur: -1, t: 0, f: 0 }];
let tuyenTot = [];           // tuyến có f lớn nhất từng gặp (ở MỌI tầng)

// TODO: lặp cho tới khi chum rỗng:
//   1. với mỗi trạng thái trong chum và mỗi đơn j chưa dùng mà vẫn kịp giờ (t + d + s <= T),
//      sinh trạng thái con có f' = f + p[j], t' = t + d + s[j], rank = f' + rho * (T - t');
//      nhớ ngay trạng thái con có f' lớn nhất từng gặp;
//   2. sắp các con theo (rank giảm, t tăng, chỉ số đơn tăng, cha tăng), giữ K cái đầu thành chum mới.

print(tuyenTot.length);
print(tuyenTot.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int K, n, T, kx, ky;
    double rho;
    scanf("%d %lf", &K, &rho);
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    // Trạng thái dở dang: tuyến đã đi, vị trí hiện tại (-1 = kho), phút đã dùng, tiền đã thu.
    struct TrangThai { vector<int> tuyen; int cur, t; long long f; };
    vector<TrangThai> chum(1, TrangThai{{}, -1, 0, 0});
    vector<int> tuyenTot;      // tuyến có f lớn nhất từng gặp (ở MỌI tầng)

    // TODO: lặp cho tới khi chum rỗng:
    //   1. với mỗi trạng thái trong chum và mỗi đơn j chưa dùng mà vẫn kịp giờ (t + d + s <= T),
    //      sinh trạng thái con có f' = f + p[j], t' = t + d + s[j], rank = f' + rho * (T - t');
    //      nhớ ngay trạng thái con có f' lớn nhất từng gặp;
    //   2. sắp các con theo (rank giảm, t tăng, chỉ số đơn tăng, cha tăng), giữ K cái đầu thành chum mới.

    printf("%d\n", (int)tuyenTot.size());
    for (size_t i = 0; i < tuyenTot.size(); i++) printf("%d%c", tuyenTot[i] + 1, i + 1 < tuyenTot.size() ? ' ' : '\n');
    if (tuyenTot.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const K = t[0], rho = t[1], n = t[2], T = t[3], kx = t[4], ky = t[5];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[6 + 4 * i]); y.push(t[7 + 4 * i]); p.push(t[8 + 4 * i]); s.push(t[9 + 4 * i]);
}

let chum = [{ tuyen: [], cur: -1, t: 0, f: 0 }];
let totF = 0, totTuyen = [], totJ = -1;       // trạng thái tốt nhất từng gặp: tuyến cha + đơn vừa thêm

while (chum.length > 0) {
  const con = [];
  for (let si = 0; si < chum.length; si++) {
    const st = chum[si];
    const daDung = new Set(st.tuyen);
    const cx = st.cur < 0 ? kx : x[st.cur], cy = st.cur < 0 ? ky : y[st.cur];
    for (let j = 0; j < n; j++) {
      if (daDung.has(j)) continue;
      const t2 = st.t + Math.abs(x[j] - cx) + Math.abs(y[j] - cy) + s[j];
      if (t2 > T) continue;                                   // hết giờ: không mở rộng được
      const f2 = st.f + p[j];
      con.push({ cha: si, j: j, t: t2, f: f2, rank: f2 + rho * (T - t2) });
      if (f2 > totF) { totF = f2; totTuyen = st.tuyen; totJ = j; }   // đánh giá NGAY, ở mọi tầng
    }
  }
  if (con.length === 0) break;
  con.sort((a, b) => b.rank - a.rank || a.t - b.t || a.j - b.j || a.cha - b.cha);
  const moi = [];
  for (let k = 0; k < Math.min(K, con.length); k++) {         // cắt tỉa: chỉ giữ K cái tốt nhất
    const c = con[k];
    moi.push({ tuyen: chum[c.cha].tuyen.concat([c.j]), cur: c.j, t: c.t, f: c.f });
  }
  chum = moi;
}
const tuyen = totJ < 0 ? [] : totTuyen.concat([totJ]);
print(tuyen.length);
print(tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

struct TrangThai { vector<int> tuyen; int cur, t; long long f; };
struct Con { int cha, j, t; long long f; double rank; };

int main() {
    int K, n, T, kx, ky;
    double rho;
    scanf("%d %lf", &K, &rho);
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    vector<TrangThai> chum(1, TrangThai{{}, -1, 0, 0});
    long long totF = 0;
    vector<int> totTuyen;
    int totJ = -1;

    while (!chum.empty()) {
        vector<Con> con;
        for (int si = 0; si < (int)chum.size(); si++) {
            const TrangThai& st = chum[si];
            vector<char> daDung(n, 0);
            for (int v : st.tuyen) daDung[v] = 1;
            int cx = st.cur < 0 ? kx : x[st.cur], cy = st.cur < 0 ? ky : y[st.cur];
            for (int j = 0; j < n; j++) {
                if (daDung[j]) continue;
                int t2 = st.t + abs(x[j] - cx) + abs(y[j] - cy) + s[j];
                if (t2 > T) continue;                                  // hết giờ: không mở rộng được
                long long f2 = st.f + p[j];
                con.push_back(Con{si, j, t2, f2, f2 + rho * (T - t2)});
                if (f2 > totF) { totF = f2; totTuyen = st.tuyen; totJ = j; }   // đánh giá NGAY, ở mọi tầng
            }
        }
        if (con.empty()) break;
        sort(con.begin(), con.end(), [](const Con& a, const Con& b) {
            if (a.rank != b.rank) return a.rank > b.rank;
            if (a.t != b.t) return a.t < b.t;
            if (a.j != b.j) return a.j < b.j;
            return a.cha < b.cha;
        });
        vector<TrangThai> moi;
        for (int k = 0; k < (int)con.size() && k < K; k++) {          // cắt tỉa: chỉ giữ K cái tốt nhất
            const Con& c = con[k];
            TrangThai st = chum[c.cha];
            st.tuyen.push_back(c.j); st.cur = c.j; st.t = c.t; st.f = c.f;
            moi.push_back(st);
        }
        chum = moi;
    }
    vector<int> tuyen = totTuyen;
    if (totJ >= 0) tuyen.push_back(totJ);
    printf("%d\n", (int)tuyen.size());
    for (size_t i = 0; i < tuyen.size(); i++) printf("%d%c", tuyen[i] + 1, i + 1 < tuyen.size() ? ' ' : '\n');
    if (tuyen.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Mỗi trạng thái chỉ cần: tuyến đã đi, vị trí hiện tại, `t`, `f`. Kiểm đơn đã dùng bằng cách duyệt tuyến (cỡ vài chục phần tử) hoặc một Set.",
        "Sinh TOÀN BỘ con của mọi trạng thái vào một mảng, sắp theo (rank giảm, t tăng, chỉ số đơn tăng, cha tăng) rồi cắt lấy `K` phần tử đầu; chỉ sau đó mới nhân bản tuyến cho `K` trạng thái được giữ.",
        "Đánh giá `f` ngay khi sinh con và nhớ cái lớn nhất (kèm tuyến cha + đơn vừa thêm). In tuyến đó, không phải tuyến đứng đầu của tầng cuối.",
        "Nếu điểm thấp hơn greedy tỉ số: kiểm tra số hạng tiềm năng dùng `T − t'` với `t'` của trạng thái CON, và `ρ` đúng là giá trị đọc từ đầu vào. Khi `K = 1`, `rank` của con = hằng số + `p[j] − ρ·(d + s[j])` — một greedy theo “giá trị ròng”."
      ]
    },
    {
      id: "xep-hang-beam",
      ten: "Xếp hạng trạng thái dở dang và cắt tỉa top-W",
      doKho: 1,
      ref: "§1.4, §4.2, §5.4–5.5",
      de: "Bài này tách riêng hai việc nhỏ của beam search: **chấm rank** cho trạng thái dở dang và **cắt tỉa** giữ top-`W`.\n\n" +
          "**Đầu vào**: dòng 1 `m W T RHO` — số trạng thái (cùng một tầng), số trạng thái giữ lại, độ dài ngày, hệ số tiềm năng ρ. Rồi `m` dòng `f t`: tiền đã thu và số phút đã dùng của trạng thái `i` (đánh số từ 1).\n\n" +
          "**Luật**: `rank = f + ρ·(T − t)`. Giữ `W` trạng thái có rank cao nhất; hoà rank thì lấy `t` nhỏ hơn (§1.4: “hoà nhau thì lấy cái đồng hồ nhỏ hơn”), vẫn hoà thì lấy chỉ số nhỏ hơn.\n\n" +
          "**Đầu ra** (một dòng): `W` chỉ số được giữ, theo thứ tự rank giảm dần; rồi `fMax` — giá trị `f` lớn nhất trong **tất cả** `m` trạng thái (kể cả bị cắt, vì mỗi trạng thái đều là một nghiệm hợp lệ, §5.5); cuối cùng 1 nếu trạng thái đạt `fMax` (chỉ số nhỏ nhất nếu hoà) bị cắt tỉa, ngược lại 0.\n\n" +
          "Chấm trên 10 bộ dữ liệu, `ρ = 100`. **Suy ngẫm**: đổi sang biến thể `ρ = 0` — top-`W` giờ giống gì, và số cuối cùng (bị cắt hay không) đổi thế nào? Vì sao điều đó chứng minh cần đánh giá nghiệm *trước* khi cắt tỉa?",
      vanDe: "b16-xep-hang",
      tham: { m: 12, W: 4, rho: 100 },
      bienThe: [
        { ten: "ρ = 100 đ/phút", tham: { m: 12, W: 4, rho: 100 } },
        { ten: "ρ = 0 (quên tiềm năng)", tham: { m: 12, W: 4, rho: 0 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "m W T RHO", rồi m dòng "f t".
// Đầu ra : một dòng — W chỉ số giữ lại (rank giảm dần), fMax, rồi 1 nếu trạng thái đạt fMax bị cắt, ngược lại 0.
const tok = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = tok[0], W = tok[1], T = tok[2], rho = tok[3];
const ds = [];
for (let i = 0; i < m; i++) ds.push({ i: i + 1, f: tok[4 + 2 * i], t: tok[5 + 2 * i] });

// TODO 1: tính rank = f + rho * (T - t) cho từng trạng thái.
// TODO 2: sắp theo (rank giảm, t tăng, chỉ số tăng); giữ W cái đầu.
// TODO 3: fMax = f lớn nhất trong TẤT CẢ m trạng thái; kiểm tra trạng thái đạt fMax (chỉ số nhỏ nhất nếu hoà) có nằm trong W cái giữ lại không.
const giu = [];
let fMax = 0, biCat = 0;

print(giu.join(" ") + " " + fMax + " " + biCat);
`
      },
      loiGiai: {
        js: String.raw`const tok = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = tok[0], W = tok[1], T = tok[2], rho = tok[3];
const ds = [];
for (let i = 0; i < m; i++) {
  const f = tok[4 + 2 * i], t = tok[5 + 2 * i];
  ds.push({ i: i + 1, f: f, t: t, rank: f + rho * (T - t) });
}
const thuTu = ds.slice().sort((a, b) => b.rank - a.rank || a.t - b.t || a.i - b.i);
const giu = thuTu.slice(0, W).map((s) => s.i);

let fMax = -1, iMax = -1;
for (const s of ds) if (s.f > fMax) { fMax = s.f; iMax = s.i; }   // đánh giá TẤT CẢ trước khi cắt tỉa
print(giu.join(" ") + " " + fMax + " " + (giu.indexOf(iMax) >= 0 ? 0 : 1));
`
      },
      goiY: [
        "Sắp xếp với bộ so sánh ghép: `b.rank - a.rank || a.t - b.t || a.i - b.i`.",
        "`fMax` tính trên mảng GỐC (trước khi cắt), không phải trên W cái được giữ.",
        "Khi `ρ = 0`, rank chính là `f`: trạng thái đạt `fMax` luôn nằm trong top-W, nên cờ cuối luôn 0. Với ρ > 0 cờ đó có thể bằng 1."
      ]
    }
  ]
});
