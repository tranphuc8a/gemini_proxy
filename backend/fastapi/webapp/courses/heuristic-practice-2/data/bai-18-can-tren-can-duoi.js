/* Thực hành — Bài 18: Cận trên & cận dưới — biết mình còn cách tối ưu bao xa. */

/* Bài toán tự dựng: cho một bộ dữ liệu cái túi và MỘT NGHIỆM đã có; in cận trên (nới lỏng LP), cận dưới (điểm của nghiệm),
   độ hở và mã chẩn đoán theo bảng quyết định §6. Mỗi bộ dữ liệu chỉ có một đáp án đúng nên dùng tuDapAn. */
TH.vande.dangKy("b18-can-tren-do-ho", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var V = TH.vande, inst = V.tui.sinh(seed, { n: tham.n || 100 });
    var txt = tham.nghiem === "gia-tri" ? V.tui.thamChieu.giaTri(inst) : V.tui.thamChieu.tiSo(inst);
    inst.chon = txt.split(/\s+/).filter(Boolean).map(Number).slice(1);      /* các chỉ số (từ 1) của nghiệm cho trước */
    return inst;
  },
  viet: function (inst) {
    return TH.vande.tui.viet(inst) + inst.chon.length + "\n" + inst.chon.join(" ") + "\n";
  },
  giai: function (inst) {
    var ub = TH.vande.tui.canTrenPhanSo(inst), lb = 0;
    inst.chon.forEach(function (i) { lb += inst.p[i - 1]; });
    var ho = (ub - lb) / lb * 100;
    return [ub, lb, ho, ho > 30 ? 1 : ho > 15 ? 2 : ho > 5 ? 3 : ho > 2 ? 4 : 5];
  },
  saiSo: 0.011,
  dinhDang: {
    vao: "Như bài cái túi: dòng 1 `n B`, rồi `n` dòng `w p` (khối lượng, giá trị của món `i`, đánh số từ 1). Tiếp theo là **nghiệm cho trước**: một dòng `k` rồi một dòng `k` chỉ số (từ 1) các món đã chọn (hợp lệ, `k ≥ 1`).",
    ra: "Một dòng gồm bốn số: `UB LB độ-hở mã`. `UB` = cận trên của nới lỏng LP (in 2 chữ số thập phân); `LB` = tổng giá trị của nghiệm cho trước; `độ-hở` = (UB − LB) / LB × 100 (đơn vị %, 2 chữ số thập phân); `mã` theo bảng quyết định: 1 nếu độ hở > 30 %, 2 nếu > 15 %, 3 nếu > 5 %, 4 nếu > 2 %, ngược lại 5."
  }
}));

TH.dangKy({
  id: "bai-18-can-tren-can-duoi",

  tomTat: [
    "Không biết cái trần thì bạn **tối ưu mù**: cùng doanh thu 32 triệu, nếu thị trường chỉ có 34 triệu thì nên chuyển việc, nếu có 90 triệu thì cố thêm là đáng. Thứ quyết định không phải điểm của bạn mà là cận trên.",
    "**Cận trên = đáp số của một bài nới lỏng** chứa bài gốc: mọi lời giải hợp lệ của ván thật vẫn hợp lệ ở ván dễ, nên điểm tốt nhất của ván dễ không thể kém hơn OPT. Luôn có LB ≤ OPT ≤ UB, và độ hở (UB − LB)/LB là thứ duy nhất bạn đo được mà không cần biết OPT.",
    "Ví dụ 5 đơn, 100 phút: A+B+C = 14 700 (đúng là tối ưu). Cho nhận nửa đơn thì lấy thêm 17/20 = 0,85 đơn D, được UB = 16 740. Nghiệm đạt ít nhất 87,8 % tối ưu, độ hở 13,9 % — nhưng độ hở **thật** là 0 %: cận trên chỉ là lời hứa an toàn, không phải dự báo.",
    "Ba cách nới lỏng: bỏ hẳn một ràng buộc (lỏng), nới LP cho biến liên tục (chặt vừa), nới lỏng Lagrange (chặt). Với cái túi, min_λ [λB + Σ max(0, p_j − λc_j)] **bằng đúng** nghiệm LP của Dantzig; độ hở LP **không vượt quá giá trị một món**, nên với n = 100 chỉ còn 0,11 %.",
    "Bài có không gian dùng tham số τ (số phút di chuyển phân bổ mỗi đơn): τ = 0 cho cận tuyệt đối 35 571 464, τ = 7 cho 33 943 173, τ = 9,5 cho 33 388 769; lời giải 32 915 840 đạt 97,0 % của cận τ = 7 và 98,6 % của cận τ = 9,5. Cận τ > 0 chỉ đúng nếu τ là cận dưới thật của di chuyển.",
    "Hằng số BHH ước lượng độ dài tour tối ưu của n điểm **rải đều ngẫu nhiên**: L* ≈ β√(A·n), β ≈ 0,7124 (Euclid), β ≈ 0,92 (Manhattan). Đó là một ước lượng, không phải cận chứng minh được: với điểm đã chọn lọc gần nhau nó có thể cao hơn thực tế nhiều (344 phút so với 119,8 phút đo được).",
    "Bảng quyết định theo khoảng cách tới cận trên: > 30 % mô hình sai → về Bài 1; 15–30 % heuristic xây dựng yếu → Phần 2; 5–15 % thiếu tìm kiếm → Phần 3–4; 2–5 % tinh chỉnh → quét tham số; < 2 % gần chạm trần → cân nhắc dừng.",
    "Độ hở **co lại khi bài to ra** (13,9 % với n = 5, 0,11 % với n = 100), nên đừng suy độ tin cậy từ bài nhỏ sang bài lớn. Một heuristic mạnh hơn không phải cận trên; cận phải tính riêng cho từng test; kiểm độ chặt của cận bằng cách so UB với OPT trên bài đủ nhỏ để giải tối ưu."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§1.4",
      hoi: "Vì sao điểm 16 740 của “ván dễ” (cho nhận nửa đơn) chắc chắn là một cận trên của ván thật?",
      chon: [
        "Vì mọi lời giải hợp lệ của ván thật cũng hợp lệ ở ván dễ, nên ván dễ có nhiều lựa chọn hơn hoặc bằng và kết quả tốt nhất của nó không thể kém hơn",
        "Vì cách nhận nửa đơn luôn cho đúng điểm của lời giải tối ưu",
        "Vì ván dễ được giải bằng thuật toán mạnh hơn ván thật",
        "Vì ta đã duyệt hết 32 khả năng của ván thật rồi lấy giá trị lớn nhất"
      ],
      dung: 0,
      giaiThich: "Tập lời giải của ván dễ chứa tập lời giải của ván thật (nhận trọn đơn A chính là “nhận 100 % đơn A”), nên max trên tập lớn hơn không thể nhỏ hơn OPT. Cận này thường lớn hơn OPT (16 740 so với 14 700), không phải bằng OPT. Điều quan trọng là ta không cần giải ván thật hay duyệt hết khả năng — đó là lý do cận trên dùng được cả khi 2²⁰⁰ khả năng không duyệt nổi."
    },
    {
      id: "q2", loai: "so", doKho: 1, ref: "§1.3, §3.1",
      hoi: "Năm đơn ở §1.1: A (trả 6 000, 30 phút), B (4 500, 25 phút), C (4 200, 28 phút), D (2 400, 20 phút), E (1 000, 20 phút). Lần này chỉ còn 70 phút. Cận trên LP (cho phép nhận một phần đơn) bằng bao nhiêu?",
      dapAn: 12750, saiSo: 0,
      giaiThich: "Tỉ số điểm/phút: A 200, B 180, C 150, D 120, E 50. Lấy A (30 phút) và B (25 phút) trọn vẹn, còn 70 − 55 = 15 phút. Đơn kế là C cần 28 phút nên chỉ lấy 15/28 của nó: 15/28 × 4 200 = 2 250. UB = 6 000 + 4 500 + 2 250 = 12 750. (Nghiệm nguyên tốt nhất chỉ là A + B = 10 500, nên cận lỏng 21 % — vì bài chỉ có 5 món, xem §8.)"
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "§2",
      hoi: "Bạn có nghiệm 14 700 và đã tính được cận trên 16 740 cho cùng một bài. Điều nào chắc chắn đúng?",
      chon: [
        "Tối ưu bằng đúng 16 740, nên dư địa còn lại là 2 040",
        "Tối ưu bằng 14 700 vì nghiệm của bạn không còn cải thiện được",
        "Tối ưu có thể lớn hơn 16 740 nếu còn một tổ hợp đơn bạn chưa nghĩ tới",
        "Tối ưu nằm trong [14 700; 16 740], nên nghiệm của bạn đạt ít nhất 87,8 % tối ưu"
      ],
      dung: 3,
      giaiThich: "Luôn có LB ≤ OPT ≤ UB nên OPT ∈ [14 700; 16 740] và 14 700 / 16 740 = 87,8 % là mức tối thiểu bạn đạt. “Dư địa nhiều nhất” tính theo UB là 12,2 %, còn độ hở theo định nghĩa (UB − LB)/LB = 13,9 % — cùng một khoảng cách, hai mẫu số khác nhau. UB chỉ là trần chứ không phải OPT; OPT không thể vượt UB; và việc nghiệm chưa cải thiện được bằng cách bạn đã thử không chứng minh gì về OPT (ở đây OPT tình cờ bằng 14 700 nhưng bạn chỉ biết nhờ duyệt hết 32 khả năng)."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§9 (cạm bẫy 1)",
      hoi: "Một bạn chạy một metaheuristic mạnh trong 10 phút, được 33,5 triệu, rồi gọi con số đó là “cận trên” để tính độ hở. Sai ở đâu?",
      chon: [
        "Không sai: miễn là heuristic đủ mạnh thì điểm của nó luôn là cận trên",
        "Con số đó chỉ là một nghiệm khác, nên là một cận dưới; cận trên phải đến từ một nới lỏng chứng minh được",
        "Sai vì phải chạy heuristic ít nhất 1 giờ mới đáng tin",
        "Sai vì cận trên phải là số nguyên"
      ],
      dung: 1,
      giaiThich: "Mọi nghiệm hợp lệ, kể cả của heuristic mạnh nhất, chỉ chứng minh OPT ≥ điểm đó, tức là một cận dưới. Cận trên cần một lập luận chứng minh được rằng không có lời giải nào vượt quá, thường từ một bài nới lỏng. Thời gian chạy hay kiểu số không biến một nghiệm thành cận trên."
    },
    {
      id: "q5", loai: "so", doKho: 2, ref: "§2, §3.3, §6", donVi: "(%)",
      hoi: "Đề thi thật: lời giải đạt 32 915 840 điểm, cận trên τ = 9,5 là 33 388 769. Độ hở theo định nghĩa (UB − LB)/LB bằng bao nhiêu phần trăm? (làm tròn đến 0,01)",
      dapAn: 1.44, saiSo: 0.01,
      giaiThich: "(33 388 769 − 32 915 840) / 32 915 840 = 472 929 / 32 915 840 = 1,44 %. Theo bảng quyết định (< 2 %: gần chạm trần) đây là vùng “cân nhắc dừng” — với điều kiện cận τ = 9,5 đáng tin. Lưu ý đây khác “98,6 %” (tỉ số LB/UB): hai cách nói cùng một khoảng cách nhưng không phải cùng một con số."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§6",
      hoi: "Nghiệm của bạn cách cận trên (đã kiểm là chặt) 9 %. Theo bảng quyết định, bước hợp lý nhất tiếp theo là gì?",
      chon: [
        "Quay lại Bài 1 để kiểm tra mô hình hoá",
        "Dừng lại vì đã gần chạm trần",
        "Quét tham số và thêm một vài toán tử cho thuật toán hiện tại",
        "Thêm local search hoặc metaheuristic (Phần 3–4), vì khoảng 5–15 % nghĩa là còn thiếu tìm kiếm"
      ],
      dung: 3,
      giaiThich: "Khoảng 5–15 % → thiếu tìm kiếm → thêm local search/metaheuristic. Mô hình có thể sai chỉ khi khoảng cách > 30 %; quét tham số hợp với 2–5 %; chỉ khi < 2 % mới cân nhắc dừng. Bảng này là công cụ quản lý dự án: nó trả lời định lượng cho “còn nên đầu tư nữa không”."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§8",
      hoi: "Cùng một kỹ thuật nới lỏng LP, độ hở là 13,9 % với n = 5 nhưng chỉ 0,11 % với n = 100. Giải thích nào đúng?",
      chon: [
        "Vì với n lớn thuật toán tìm được nghiệm tối ưu thật sự tốt hơn",
        "Vì toàn bộ phần hở của cận LP đến từ đúng một món bị cắt dở và không vượt quá giá trị một món; n càng lớn thì một món càng bé so với tổng",
        "Vì với n nhỏ phép nới lỏng LP không còn là một cận hợp lệ",
        "Vì cái túi nhỏ thì sức chứa B nhỏ nên cận luôn lỏng bất kể số món"
      ],
      dung: 1,
      giaiThich: "Nghiệm LP lấy trọn các món có tỉ số cao nhất và chỉ cắt dở một món; phần “ảo” đó đáng nhiều nhất bằng giá trị của một món (đây là định lý, không phải quan sát). Với n = 5 một món chiếm cỡ 14 % tổng điểm, với n = 100 chỉ cỡ vài phần trăm hoặc ít hơn. Cận LP hợp lệ ở mọi n; bài toán không nói gì về chất lượng thuật toán; và hệ quả là đừng suy độ tin cậy giữa bài nhỏ và bài lớn."
    },
    {
      id: "q8", loai: "nhieu", doKho: 2, ref: "§2.1, §5",
      hoi: "Chọn mọi phát biểu đúng về các cách nới lỏng để có cận trên cho bài toán cực đại.",
      chon: [
        "Bỏ hẳn một ràng buộc cho cận luôn đúng nhưng thường lỏng",
        "Nới lỏng làm tập lời giải hợp lệ nhỏ đi nên bài dễ giải hơn",
        "Với bài cái túi, min_λ [λB + Σ max(0, p_j − λc_j)] cho đúng giá trị của nghiệm LP",
        "Nới lỏng Lagrange cho một cận dưới của OPT với mọi λ ≥ 0",
        "Nới lỏng LP cho biến chỉ nhận 0 hoặc 1 được nhận giá trị lẻ trong [0, 1], ví dụ lấy nửa món"
      ],
      dung: [0, 2, 4],
      giaiThich: "Đúng: bỏ ràng buộc thì lời giải hợp lệ chỉ nhiều thêm nên cận đúng nhưng lỏng; cận Lagrange chặt nhất của cái túi bằng nghiệm LP; nới lỏng LP là cho biến liên tục (nửa món). Sai: nới lỏng làm tập lời giải **lớn lên** (đó là lý do kết quả không thể kém OPT); và L(λ) ≥ OPT với mọi λ ≥ 0 nên Lagrange cho cận **trên**, không phải cận dưới."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§4, Bài tập 18.4",
      hoi: "Tuyến của một thuật toán trên P1 đi qua 14 đơn chọn trong 120 đơn của lưới 100 × 100, đo được 119,8 phút. Công thức BHH Manhattan cho 0,92 × √(10 000 × 14) ≈ 344 phút. Cách hiểu đúng nhất là gì?",
      chon: [
        "Thuật toán đã có lỗi vì tuyến ngắn hơn cận dưới BHH",
        "Phải nhân thêm hệ số (1 − 1/14) vì tuyến là đường mở, khi đó BHH cho đúng 119,8",
        "Hằng số 0,92 chỉ đúng cho Euclid nên con số 344 vô nghĩa",
        "BHH chỉ ước lượng cho điểm rải đều ngẫu nhiên; ở đây 14 đơn được chọn lọc ưu tiên những đơn gần nhau nên tuyến ngắn hơn nhiều — BHH không phải một cận chứng minh được"
      ],
      dung: 3,
      giaiThich: "BHH là kết quả tiệm cận cho điểm phân bố đều. Thuật toán chọn 14 trong 120 đơn và có xu hướng chọn đơn gần nhau, nên tuyến ngắn hơn hẳn: tuyến đã rất chặt, dư địa nằm ở chọn lọc chứ không phải định tuyến. Hệ số (1 − 1/14) chỉ đổi 344 thành khoảng 320, vẫn xa 119,8. 0,92 chính là hệ số của Manhattan (0,7124 mới là của Euclid). Vì BHH chỉ là ước lượng nên “tuyến ngắn hơn BHH” không có nghĩa là lỗi."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§8.2, §9 (cạm bẫy 2)",
      hoi: "Trên bài lớn, độ hở giữa nghiệm của bạn và cận trên là 25 %. Trước khi kết luận thuật toán còn yếu, nên làm gì?",
      chon: [
        "Chạy cận trên trên các bài đủ nhỏ để giải tối ưu bằng quy hoạch động hoặc vét cạn, rồi so UB với OPT thật để biết bao nhiêu phần của 25 % chỉ là do cận lỏng",
        "Đổi sang một cận lỏng hơn cho nhanh",
        "Giả định độ hở trên bài lớn giống hệt độ hở đo trên bài nhỏ",
        "Bỏ cận trên đi và chỉ so sánh với greedy"
      ],
      dung: 0,
      giaiThich: "Độ hở gộp hai thứ: phần bạn thật sự còn thiếu và phần chỉ do cận lỏng. Muốn tách chúng, đo độ chặt của cận trên bài nhỏ giải được: nếu trên bài nhỏ cận đã lỏng 30 % thì “còn cách 25 %” trên bài lớn chẳng nói gì về thuật toán. Cận lỏng hơn chỉ làm mọi thứ mờ hơn; độ hở thay đổi theo n nên không được suy qua lại giữa bài nhỏ và lớn; còn bỏ cận là quay lại tối ưu mù."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 18.1",
      hoi: "Với bảng 5 đơn ở §1.1 (A: 6 000 / 30 phút; B: 4 500 / 25; C: 4 200 / 28; D: 2 400 / 20; E: 1 000 / 20) nhưng chỉ còn 60 phút, hãy tính cận trên LP và nghiệm nguyên tốt nhất. Độ hở bao nhiêu? Phần hở này có “thật” không?",
      goiY: ["Sắp theo nghìn mỗi phút giảm dần: A, B, C, D, E. Lấy đầy rồi cắt món cuối.", "Để biết nghiệm nguyên tốt nhất, duyệt 32 tập con (hoặc lý luận từ cận trên)."],
      mau: "**Cận trên LP.** Lấy A (30 phút) và B (25 phút) trọn vẹn, còn 5 phút. Đơn tiếp theo là C cần 28 phút nên chỉ lấy 5/28 ≈ 0,179 của C, được 0,179 × 4 200 = 750. UB = 6 000 + 4 500 + 750 = **11 250**.\n\n" +
           "**Nghiệm nguyên tốt nhất.** Duyệt hết các tập vừa 60 phút: A + B = 55 phút cho 10 500; A + C = 58 phút chỉ 10 200; A + D = 50 phút 8 400; … Tốt nhất là **A + B = 10 500**.\n\n" +
           "**Độ hở** = (11 250 − 10 500) / 10 500 = **7,1 %** (vùng 5–15 %: “thiếu tìm kiếm” theo bảng). Nhưng phần hở này hoàn toàn là **ảo**: nghiệm A + B chính là tối ưu, độ hở thật là 0 %. Toàn bộ 750 điểm hở là phần C bị cắt dở — đúng cơ chế ở §8: độ hở LP không vượt quá giá trị một món, và bài chỉ có 5 món nên một món chiếm tỉ lệ lớn.",
      tieuChi: [
        "Tính đúng UB = 11 250 bằng cách lấy A, B trọn và 5/28 của C",
        "Tìm đúng nghiệm nguyên tốt nhất A + B = 10 500",
        "Tính độ hở 7,1 % theo (UB − LB)/LB",
        "Nhận ra phần hở là do một món bị cắt dở (độ hở thật là 0 %)"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 18.2, §8",
      hoi: "Giả sử bạn đo độ hở (LP − OPT)/OPT của bài cái túi với n = 10, 30, 100, 300 và thấy nó giảm dần: cỡ vài %, cỡ 1 %, cỡ 0,1 %, rồi nhỏ hơn nữa. Hãy giải thích vì sao, và nêu hệ quả với việc đọc độ hở trên bài của bạn.",
      goiY: ["Nghiệm LP khác nghiệm nguyên ở bao nhiêu món?", "Nghĩ về tỉ lệ giữa giá trị của một món và tổng giá trị."],
      mau: "Nghiệm LP lấy trọn các món có tỉ số cao nhất và chỉ cắt dở **một** món, nên phần hở của cận LP **không bao giờ vượt quá giá trị của một món** (đó là định lý, không phải quan sát). Khi n tăng, tổng giá trị tăng cỡ n còn giá trị một món gần như giữ nguyên, nên tỉ lệ hở giảm cỡ 1/n: 13,9 % với 5 món (một món chiếm cỡ 14 % tổng), 0,11 % với n = 100. Phần dở dang của món bị cắt còn nhỏ hơn cả giá trị một món nên số đo thực tế còn nhỏ hơn giới hạn lý thuyết.\n\n" +
           "**Hệ quả:** không được lấy độ hở đo trên bài nhỏ để suy độ tin cậy trên bài lớn, và ngược lại. Muốn biết cận của mình có chặt không, chạy nó trên các bài đủ nhỏ để giải tối ưu bằng quy hoạch động hoặc vét cạn rồi so UB với OPT thật.",
      tieuChi: [
        "Nêu ý “chỉ một món bị cắt dở” và giới hạn: độ hở không vượt quá giá trị một món",
        "Giải thích vì sao tỉ lệ giảm khi n tăng (tổng giá trị tăng, một món gần như không đổi)",
        "Nêu hệ quả: không suy độ tin cậy giữa bài nhỏ và bài lớn, kiểm độ chặt trên bài nhỏ giải được"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "Bài tập 18.4, §4",
      hoi: "Trên P1 tuyến của “chèn rẻ nhất” đi qua khoảng 14 đơn trên lưới 100 × 100, đo được 119,8 phút. Hãy dùng hằng số BHH để ước lượng quãng đường, nêu vì sao con số ước lượng lệch xa thực tế, và kết luận nên tối ưu tuyến hay tối ưu chọn lọc.",
      goiY: ["Tính 0,92 × √(A·n) với A = 10 000 và n = 14.", "BHH giả định điều gì về phân bố của các điểm?"],
      mau: "BHH Manhattan: L* ≈ 0,92 × √(10 000 × 14) = 0,92 × 374 ≈ **344 phút** cho một chu trình kín. Tuyến của ta là đường mở nên cùng lắm giảm còn cỡ 320 phút; thực tế đo được chỉ **119,8 phút**.\n\n" +
           "**Vì sao lệch?** BHH là ước lượng tiệm cận cho các điểm **rải đều ngẫu nhiên**. Ở đây thuật toán *chọn lọc* 14 trong 120 đơn và có xu hướng chọn những đơn **gần nhau**, nên tuyến ngắn hơn rất nhiều. Vì vậy BHH ở đây không phải cận dưới chứng minh được — nó chỉ là một ước lượng cho điểm ngẫu nhiên.\n\n" +
           "**Kết luận:** tuyến đã rất chặt; dư địa nằm ở **chọn lọc** (đơn nào được chọn), không phải ở định tuyến.",
      tieuChi: [
        "Tính đúng ước lượng BHH ≈ 344 phút",
        "Giải thích sự lệch bằng giả định “điểm rải đều” bị phá vỡ vì các đơn được chọn lọc, gần nhau",
        "Nhận ra BHH là ước lượng, không phải cận chứng minh được",
        "Kết luận: tối ưu chọn lọc chứ không phải tối ưu tuyến"
      ]
    },
    {
      id: "l4", doKho: 3, ref: "§3.3, §6, §9",
      hoi: "Đồng đội nói: “Lời giải 32 915 840 đã đạt 98,6 % cận τ = 9,5. Dừng thôi!”. Hãy tính độ hở theo ba cận ở §3.3 (35 571 464 cho τ = 0; 33 943 173 cho τ = 7; 33 388 769 cho τ = 9,5), đối chiếu bảng quyết định, và cho biết bạn có đồng ý dừng không. Nêu những điều cần kiểm trước khi dừng.",
      goiY: ["Độ hở = (UB − LB)/LB cho từng cận.", "Cận nào đúng với mọi lời giải, và cận nào chỉ đúng nếu τ thoả một điều kiện?"],
      mau: "Độ hở (UB − LB)/LB: τ = 0 → (35 571 464 − 32 915 840)/32 915 840 = **8,07 %** (vùng 5–15 %: thiếu tìm kiếm); τ = 7 → **3,12 %** (2–5 %: tinh chỉnh); τ = 9,5 → **1,44 %** (< 2 %: cân nhắc dừng).\n\n" +
           "Chỉ cận τ = 0 là **cận tuyệt đối** (bỏ hẳn di chuyển, luôn đúng nhưng lỏng). Cận τ > 0 chỉ đúng nếu τ là cận dưới thật của số phút di chuyển trung bình mỗi đơn; τ = 9,5 lại là mức di chuyển *thực tế của chính lời giải*, nên “98,6 %” là một chỉ số tham chiếu chứ chưa phải bảo đảm. τ = 7 (cỡ di chuyển tối ưu kiểu TSP-Manhattan) hợp lý hơn.\n\n" +
           "**Kết luận hợp lý:** chưa nên dừng chỉ vì con số 98,6 %. Cần (1) xác nhận cận nào hợp lệ, (2) đo độ chặt của cận bằng cách so với tối ưu trên bài nhỏ, (3) tính cận riêng cho từng test chứ không chỉ trung bình. Nếu cận τ = 7 đứng vững thì dư địa ~3 % (cộng ~1,5 % từ đường đi) đủ để “không đáng bỏ thêm một tuần” như §4.3 kết luận — nhưng đó phải là kết luận có kiểm, không phải cảm giác.",
      tieuChi: [
        "Tính đúng ba độ hở: 8,07 %, 3,12 %, 1,44 %",
        "Đối chiếu từng độ hở với bảng quyết định (thiếu tìm kiếm / tinh chỉnh / cân nhắc dừng)",
        "Phân biệt cận tuyệt đối (τ = 0) với cận tham chiếu cần điều kiện về τ",
        "Nêu ít nhất một phép kiểm trước khi dừng (độ chặt của cận trên bài nhỏ, cận riêng từng test)"
      ]
    }
  ],

  lab: [
    {
      id: "can-tren-do-ho",
      ten: "Cận trên LP, độ hở và quyết định có nên dừng",
      doKho: 2,
      ref: "§1.3, §2, §3.1, §6, §8",
      de: "Bạn có một bộ dữ liệu cái túi và một **nghiệm đã có** (do một greedy nào đó tìm ra). Hãy trả lời câu hỏi của Bài 18: *nghiệm này còn cách tối ưu bao xa?*\n\n" +
          "Với mỗi test, in một dòng `UB LB độ-hở mã`:\n\n" +
          "1. `UB` — **cận trên LP**: sắp món theo `p/w` giảm dần, lấy trọn tới khi gặp món không vừa, rồi lấy **một phần** món đó cho vừa khít sức chứa.\n" +
          "2. `LB` — tổng giá trị của nghiệm cho trước (một cận dưới).\n" +
          "3. `độ-hở` = (UB − LB) / LB × 100 (%).\n" +
          "4. `mã` theo bảng quyết định §6: 1 nếu độ hở > 30 %, 2 nếu > 15 %, 3 nếu > 5 %, 4 nếu > 2 %, ngược lại 5.\n\n" +
          "In `UB` và `độ-hở` với 2 chữ số thập phân (bộ chấm cho lệch ≤ 0,011). Chấm trên 10 bộ dữ liệu.\n\n" +
          "**Sau khi qua, đổi biến thể dữ liệu** (tab bên dưới) và trả lời: (a) cùng một thuật toán greedy theo tỉ số, vì sao độ hở ở `n = 8` lớn hơn hẳn ở `n = 100`? (§8) (b) Với `n = 100`, greedy theo giá trị ra mã nào, greedy theo tỉ số ra mã nào, và quyết định “có nên đầu tư thêm” khác nhau ra sao?",
      vanDe: "b18-can-tren-do-ho",
      tham: { n: 100, nghiem: "ti-so" },
      bienThe: [
        { ten: "n = 100, nghiệm greedy theo tỉ số", tham: { n: 100, nghiem: "ti-so" } },
        { ten: "n = 100, nghiệm greedy theo giá trị", tham: { n: 100, nghiem: "gia-tri" } },
        { ten: "n = 8, nghiệm greedy theo tỉ số (bài nhỏ)", tham: { n: 8, nghiem: "ti-so" } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "n B"; n dòng "w p"; rồi "k"; rồi k chỉ số (từ 1) của nghiệm cho trước.
// Đầu ra : một dòng "UB LB độ-hở mã" (xem đề).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const w = [], p = [];
for (let i = 0; i < n; i++) { w.push(t[2 + 2 * i]); p.push(t[3 + 2 * i]); }
const k = t[2 + 2 * n];
const chon = [];
for (let j = 0; j < k; j++) chon.push(t[3 + 2 * n + j] - 1);   // chỉ số từ 0

// TODO 1: LB = tổng p của các món trong "chon".
// TODO 2: UB = cận trên LP — sắp theo p/w giảm dần, lấy trọn, món cuối lấy một PHẦN cho vừa khít B.
// TODO 3: độ-hở (%) và mã (1..5) theo bảng quyết định.
print("0 0 0 1");
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, B;
    scanf("%d %d", &n, &B);
    vector<int> w(n), p(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);
    int k;
    scanf("%d", &k);
    vector<int> chon(k);
    for (int j = 0; j < k; j++) { scanf("%d", &chon[j]); chon[j]--; }   // chỉ số từ 0

    // TODO 1: LB = tổng p của các món trong chon.
    // TODO 2: UB = cận trên LP — sắp theo p/w giảm dần, lấy trọn, món cuối lấy một PHẦN cho vừa khít B.
    // TODO 3: độ hở (%) và mã (1..5) theo bảng quyết định.
    printf("0 0 0 1\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const w = [], p = [];
for (let i = 0; i < n; i++) { w.push(t[2 + 2 * i]); p.push(t[3 + 2 * i]); }
const k = t[2 + 2 * n];

// Cận dưới: điểm của nghiệm cho trước.
let lb = 0;
for (let j = 0; j < k; j++) lb += p[t[3 + 2 * n + j] - 1];

// Cận trên LP (Dantzig): theo tỉ số giảm dần, lấy trọn, món cuối lấy một phần. So sánh bằng nhân chéo.
const thuTu = w.map((_, i) => i).sort((a, b) => p[b] * w[a] - p[a] * w[b] || a - b);
let con = B, ub = 0;
for (const i of thuTu) {
  if (w[i] <= con) { con -= w[i]; ub += p[i]; }
  else { ub += p[i] * con / w[i]; break; }
}

const hoTyLe = (ub - lb) / lb * 100;
const ma = hoTyLe > 30 ? 1 : hoTyLe > 15 ? 2 : hoTyLe > 5 ? 3 : hoTyLe > 2 ? 4 : 5;
print(ub.toFixed(2) + " " + lb + " " + hoTyLe.toFixed(2) + " " + ma);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, B;
    scanf("%d %d", &n, &B);
    vector<int> w(n), p(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);
    int k;
    scanf("%d", &k);

    // Cận dưới: điểm của nghiệm cho trước.
    long long lb = 0;
    for (int j = 0; j < k; j++) { int id; scanf("%d", &id); lb += p[id - 1]; }

    // Cận trên LP (Dantzig): theo tỉ số giảm dần, lấy trọn, món cuối lấy một phần. So sánh bằng nhân chéo.
    vector<int> thuTu(n);
    iota(thuTu.begin(), thuTu.end(), 0);
    sort(thuTu.begin(), thuTu.end(), [&](int a, int b) {
        long long l = (long long)p[a] * w[b], r = (long long)p[b] * w[a];
        if (l != r) return l > r;
        return a < b;
    });
    int con = B;
    double ub = 0;
    for (int i : thuTu) {
        if (w[i] <= con) { con -= w[i]; ub += p[i]; }
        else { ub += (double)p[i] * con / w[i]; break; }
    }

    double ho = (ub - lb) / lb * 100;
    int ma = ho > 30 ? 1 : ho > 15 ? 2 : ho > 5 ? 3 : ho > 2 ? 4 : 5;
    printf("%.2f %lld %.2f %d\n", ub, lb, ho, ma);
    return 0;
}
`
      },
      goiY: [
        "Cận trên LP chính là greedy theo tỉ số của Bài 5 với một điểm khác: món đầu tiên không vừa thì lấy phần p·(chỗ còn lại)/w rồi dừng hẳn.",
        "Sắp theo tỉ số bằng phép nhân chéo p[b]·w[a] − p[a]·w[b] để tránh chia cho 0 và sai số số thực; UB là số thực nên giữ bằng double (hoặc số JS).",
        "Độ hở tính theo LB (mẫu số là điểm của nghiệm cho trước), không phải theo UB. Mã được xác định bằng các ngưỡng 30, 15, 5, 2 trên độ hở chưa làm tròn."
      ]
    }
  ]
});
