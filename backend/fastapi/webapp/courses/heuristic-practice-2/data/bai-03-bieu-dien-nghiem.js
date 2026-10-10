/* Thực hành — Bài 3: Biểu diễn nghiệm — quyết định quan trọng nhất. */

/* Bài toán tự dựng: giải mã một CHUỖI PHẲNG cho bài ship hàng nhiều ngày (mẫu code ở §8.2).
   Mã = hoán vị của 1..n; bộ giải mã nhồi tuần tự vào ngày, sang ngày mới khi không vừa, dừng hẳn khi hết ngày. */
TH.vande.dangKy("b03-giai-ma-chuoi-phang", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var r = TH.tienIch.rng(seed), n = tham.n || 40, D = tham.D || 5, T = tham.T || 480;
    var x = [], y = [], p = [], s = [], ma = [];
    for (var i = 0; i < n; i++) {
      x.push(r.khoang(0, 99)); y.push(r.khoang(0, 99)); p.push(r.khoang(100, 1000)); s.push(r.khoang(5, 30)); ma.push(i);
    }
    return { n: n, D: D, T: T, kx: 50, ky: 50, x: x, y: y, p: p, s: s, ma: TH.tienIch.tron(ma, r) };
  },
  viet: function (inst) {
    var o = inst.n + " " + inst.D + " " + inst.T + "\n" + inst.kx + " " + inst.ky + "\n";
    for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + " " + inst.p[i] + " " + inst.s[i] + "\n";
    return o + inst.ma.map(function (i) { return i + 1; }).join(" ") + "\n";
  },
  giai: function (inst) {
    var ngay = 1, tg = 0, hx = inst.kx, hy = inst.ky, tien = 0, k = 0, ngayCua = [];
    for (var j = 0; j < inst.n; j++) ngayCua.push(0);
    for (var j2 = 0; j2 < inst.n; j2++) {
      var i = inst.ma[j2];
      var c = Math.abs(inst.x[i] - hx) + Math.abs(inst.y[i] - hy) + inst.s[i];
      if (tg + c > inst.T) {
        if (ngay === inst.D) break;
        ngay++; tg = 0;                                   /* vị trí hiện tại KHÔNG đặt lại */
      }
      tg += c; tien += inst.p[i]; k++; hx = inst.x[i]; hy = inst.y[i]; ngayCua[j2] = ngay;
    }
    return [[k, tien, k ? ngay : 0], ngayCua];
  },
  saiSo: 0,
  dinhDang: {
    vao: "Dòng 1: `n D T` — số đơn, số ngày, số phút mỗi ngày. Dòng 2: `kx ky` — toạ độ kho. Tiếp theo `n` dòng `x y p s` (toạ độ, tiền, phút giao). Dòng cuối: `n` số — **mã** π, một hoán vị của `1..n`.",
    ra: "Dòng 1: `k tien soNgay` — số đơn giao, tổng tiền, số ngày đã dùng (ngày của đơn giao cuối cùng; `0` nếu không giao đơn nào). Dòng 2: `n` số — số thứ `j` là ngày giao đơn `π_j`, hoặc `0` nếu đơn đó bị bỏ."
  }
}));

TH.dangKy({
  id: "bai-03-bieu-dien-nghiem",

  tomTat: [
    "**Một nước đi là thao tác trên biểu diễn, không phải trên khái niệm.** Biểu diễn định nghĩa tập nước đi, tập nước đi định nghĩa lân cận, lân cận định nghĩa cực trị cục bộ: chọn biểu diễn là chọn hình dạng bề mặt tối ưu bạn sẽ leo.",
    "Ba họ cơ bản: **tập con** {0,1}ⁿ (lật bit; cái túi), **hoán vị/dãy** (đảo đoạn, dời đoạn, đổi chỗ; TSP, P1), **gán nhãn** (đổi nhãn; phân nhóm). Tập con và gán nhãn đóng miễn phí; hoán vị thì chỉ các phép hoán chuyển vị trí mới giữ được “đôi một khác nhau”.",
    "**Trực tiếp** lưu chính nghiệm (nhanh, phải tự giữ hợp lệ); **gián tiếp** lưu mã + bộ giải mã (luôn hợp lệ, tái dùng toán tử, nhưng không gian mã nhỏ hơn và **mất tính địa phương**: đổi hai đơn đầu chuỗi làm dịch ranh giới ngày phía sau).",
    "Năm tiêu chí: ① đầy đủ ② hợp lệ ③ địa phương ④ chi phí đánh giá ⑤ phong phú toán tử. Cả năm đều đo được trong một buổi chiều; ① nghiêm trọng nhất vì vi phạm nó khiến bạn **không bao giờ tới đích** mà không có cảnh báo.",
    "Bảng tiêu chí chỉ để loại phương án tệ và biết mình đang đánh đổi gì — **không thay được thực nghiệm**: chuỗi phẳng thua hai tiêu chí, thắng hai tiêu chí, nên phải đo.",
    "Bộ giải mã chuỗi phẳng cho P2: nhồi tuần tự, sang ngày mới khi không vừa, hết ngày thì dừng và **cắt đuôi im lặng**; vị trí **không** reset khi sang ngày. Một hàm vừa chấm điểm vừa sinh hành động để điểm mô phỏng và điểm thật không trôi xa nhau.",
    "Nguyên tắc “không ràng buộc sớm hơn mức cần thiết”: trên P2, quyết định ngày sớm (A = 338 673) thua chèn toàn cục (B = 357 940, +5,7 %) và chèn + LNS (C = 368 696, +8,9 %).",
    "Bốn cạm bẫy: thiếu đầy đủ (điểm chạm trần), dư thừa (TSP: n → 2n mã cho một chu trình), đánh giá không tăng dần được, đổi biểu diễn giữa chừng. Hai mảng phải khớp nhau (seq và pos) là cơ hội để bug — đóng gói mọi thay đổi vào hàm."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§1.1",
      hoi: "Bài giảng nói “chọn biểu diễn là chọn luôn hình dạng của bề mặt tối ưu mà bạn sẽ leo”. Chuỗi suy luận nào đứng sau câu đó?",
      chon: [
        "Biểu diễn xác định ngôn ngữ lập trình → ngôn ngữ xác định tốc độ → tốc độ xác định cực trị cục bộ",
        "Biểu diễn xác định hàm mục tiêu → hàm mục tiêu xác định ràng buộc → ràng buộc xác định lân cận",
        "Biểu diễn xác định tập nước đi viết ra được → tập nước đi xác định lân cận → lân cận xác định thế nào là cực trị cục bộ",
        "Biểu diễn xác định số test case cần chạy → số test xác định sai số chuẩn → sai số chuẩn xác định cực trị"
      ],
      dung: 2,
      giaiThich: "Một nước đi là thao tác trên biểu diễn (ví dụ std::reverse trên một khúc mảng), nên biểu diễn định nghĩa tập nước đi; tập nước đi định nghĩa lân cận; lân cận định nghĩa cực trị cục bộ — cùng một lời giải có thể là cực trị cục bộ với bộ nước đi này mà không phải với bộ khác. Hàm mục tiêu và ràng buộc là của bài toán chứ không do biểu diễn quyết định; ngôn ngữ lập trình hay số test không liên quan tới hình dạng bề mặt."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§3.3",
      hoi: "Chia 12 học sinh thành 3 nhóm, mỗi nhóm 4 người, để tối đa hoá tổng độ hợp nhau; thứ tự trong nhóm không quan trọng. Họ biểu diễn tự nhiên nhất là gì?",
      chon: [
        "Tập con: một vector bit 12 phần tử",
        "Hoán vị của 12 học sinh",
        "Gán nhãn: nhom[i] ∈ {0, 1, 2} cho từng học sinh",
        "Chuỗi phẳng với bộ giải mã nhồi tuần tự"
      ],
      dung: 2,
      giaiThich: "Mỗi học sinh được gán vào một nhóm và thứ tự trong nhóm không có ý nghĩa — đúng việc của họ gán nhãn (§3.3). Vector bit chỉ nói có/không nên không đủ để chia ba nhóm; hoán vị mã hoá cả thứ tự trong nhóm, vô ích ở bài này (tức dư thừa); chuỗi phẳng + bộ giải mã hợp với bài có ranh giới kỳ suy ra từ một ngân sách, mà ở đây không có ngân sách nào."
    },
    {
      id: "q3", loai: "nhieu", doKho: 2, ref: "§3.1–3.3",
      hoi: "Phép biến đổi nào dưới đây LUÔN cho ra một cấu trúc hợp lệ của chính họ biểu diễn đó (không phá tính đóng), khi chưa tính ràng buộc riêng của bài?",
      chon: [
        "Tập con {0,1}ⁿ: lật một bit",
        "Gán nhãn: đổi nhãn của một phần tử sang một nhãn khác trong 1..m",
        "Hoán vị: đặt π_k bằng một giá trị ngẫu nhiên trong 1..n",
        "Hoán vị: đổi chỗ hai phần tử ở vị trí k₁ và k₂",
        "Hoán vị: tăng π_k thêm 1"
      ],
      dung: [0, 1, 3],
      giaiThich: "Tập con và gán nhãn đóng miễn phí: bit nào lật cũng ra một vector bit, nhãn nào gán cũng ra một phép gán. Hoán vị đòi hỏi các phần tử đôi một khác nhau, nên chỉ các phép **hoán chuyển vị trí** (đổi chỗ, đảo đoạn, dời đoạn) giữ được tính chất đó. Phép gán giá trị (đặt thành số ngẫu nhiên, cộng thêm 1) dễ sinh phần tử lặp."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§4.2–4.3",
      hoi: "Ưu điểm lớn nhất của biểu diễn gián tiếp (mã + bộ giải mã) so với biểu diễn trực tiếp là gì?",
      chon: [
        "Đánh giá một nghiệm nhanh hơn vì không phải chạy bộ giải mã",
        "Không bao giờ sinh nghiệm không hợp lệ: ràng buộc được áp ngay trong bộ giải mã nên bạn được xáo trộn mã tuỳ thích",
        "Không gian mã luôn lớn hơn không gian nghiệm nên tìm kiếm tự do hơn",
        "Giữ được tính địa phương tốt hơn vì mã và nghiệm khớp một–một"
      ],
      dung: 1,
      giaiThich: "§4.3: bộ giải mã là nơi ràng buộc được áp, nên dù mã kỳ quặc đến đâu nghiệm ra vẫn hợp lệ — lợi thế sống còn khi “vi phạm ⇒ 0 điểm”. Ba phương án còn lại ngược với bảng §4.2: gián tiếp đánh giá **chậm hơn** (tốn chi phí giải mã), không gian mã thường **nhỏ hơn** S, và tính địa phương có thể **kém hơn**."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§4.4, §7.2",
      hoi: "Chuỗi phẳng [A, B, C, D, E] được đổi thành [A, B, D, C, E]: ngày 1 từ 3 đơn thành 4 đơn, còn đơn E vốn ở cuối ngày 2 nay thành đơn đầu của ngày 2 — dù ta không hề đụng tới E. Hiện tượng đó nói lên điều gì?",
      chon: [
        "Bộ giải mã có lỗi, vì E phải giữ nguyên vị trí cũ",
        "Mất tính địa phương: một nước đi nhỏ trong mã làm đổi ngữ cảnh của phần tử ở xa",
        "Mất tính đầy đủ: không mã hoá được nghiệm có E ở cuối ngày 2",
        "Biểu diễn dư thừa: hai mã khác nhau cho cùng một nghiệm"
      ],
      dung: 1,
      giaiThich: "Đây là cái giá của biểu diễn gián tiếp (§4.4, §7.2): ranh giới ngày được suy ra nên mọi ranh giới phía sau dịch theo; một nước đi ở vị trí 3 đổi ngữ cảnh của phần tử ở vị trí 5. Không có lỗi nào — đó là hành vi đúng của bộ giải mã. Tính đầy đủ hỏi nghiệm tối ưu có mã hoá được không; dư thừa nói về nhiều mã cho một nghiệm, còn ở đây hai mã cho hai nghiệm khác nhau."
    },
    {
      id: "q6", loai: "mot", doKho: 3, ref: "§6.3",
      hoi: "Trên P2, ba chiến lược dựng nghiệm cho điểm trung bình A = 338 673 (lấp đầy từng ngày), B = 357 940 (chèn toàn cục) và C = 368 696 (chèn + LNS). Nguyên tắc nào của bài giảng giải thích thứ hạng A < B < C?",
      chon: [
        "Không ràng buộc sớm hơn mức cần thiết: A chốt “đơn nào thuộc ngày nào” sớm nhất, C trì hoãn quyết định đó lâu nhất",
        "Chiến lược chạy càng lâu thì điểm càng cao",
        "Biểu diễn gián tiếp luôn thắng biểu diễn trực tiếp",
        "Tính địa phương càng tốt thì điểm càng cao"
      ],
      dung: 0,
      giaiThich: "§6.3: ba chiến lược khác nhau ở thời điểm quyết định “đơn này thuộc ngày nào” — A sớm nhất (lấp đầy ngày 1 rồi mới nghĩ tới ngày 2), B muộn hơn (xét mọi cặp ngày–vị trí rồi mới chọn), C muộn nhất (còn phá ra và xây lại). Mỗi lần chốt sớm là cắt một phần không gian nghiệm khi chưa đủ thông tin; thông tin tích luỹ dần nên quyết định càng muộn càng sáng suốt. Thời gian chạy (C chậm hơn A hàng nghìn lần) chỉ đi kèm chứ không phải lý do; và bảng so ba chiến lược dựng nghiệm này không phải phép đo biểu diễn trực tiếp với gián tiếp."
    },
    {
      id: "q7", loai: "so", doKho: 2, ref: "§9 (cạm bẫy 2), Bài tập 3.1", donVi: "(chu trình)",
      hoi: "TSP đối xứng 8 đỉnh. Nếu lưu chu trình bằng dãy hoán vị có điểm bắt đầu tự do và chiều đi tuỳ ý thì có 8! = 40 320 mã, và mỗi chu trình xuất hiện 2n lần. Có bao nhiêu chu trình khác nhau?",
      dapAn: 2520, saiSo: 0,
      giaiThich: "Mỗi chu trình có n điểm bắt đầu × 2 chiều = 2n = 16 mã, nên có 40 320 / 16 = 2 520 chu trình, tức (n − 1)!/2. Cách chữa: cố định đỉnh 0 ở vị trí đầu rồi ép đỉnh đứng ngay sau 0 nhỏ hơn đỉnh đứng cuối để chọn chiều — còn đúng 7!/2 = 2 520 mã, mỗi mã một chu trình."
    },
    {
      id: "q8", loai: "so", doKho: 2, ref: "§7, §8.2", donVi: "(đơn)",
      hoi: "Mỗi ngày 100 phút, tối đa **2 ngày**. Chuỗi phẳng 7 đơn có chi phí (đi + phục vụ, tính từ đơn đứng ngay trước nó) lần lượt 30, 25, 40, 35, 20, 45, 10. Bộ giải mã nhồi tuần tự, sang ngày mới khi không vừa, dừng hẳn khi hết ngày. Giao được bao nhiêu đơn?",
      dapAn: 6, saiSo: 0,
      giaiThich: "Ngày 1: 30 → 55 → 95; đơn thứ 4 cần 35 (95 + 35 = 130 > 100) nên sang ngày 2. Ngày 2: 35 → 55 → 100 (đơn thứ 6 vừa khít, 100 không vượt 100). Đơn thứ 7 cần thêm 10 nhưng đã hết ngày nên bị bỏ im lặng. Tổng 3 + 3 = 6 đơn. Phần đuôi bị cắt không phải lỗi mà là tính chất 2 của bộ giải mã (§8.2): toán tử được phép đẩy đơn ra khỏi lịch mà không cần biết."
    },
    {
      id: "q9", loai: "mot", doKho: 2, ref: "§5, §9 (cạm bẫy 1)",
      hoi: "Điểm của bạn chạm trần và đứng yên: đổi thuật toán, tăng thời gian, thêm toán tử đều cho đúng một con số. Bạn nên nghi ngờ điều gì đầu tiên?",
      chon: [
        "Bộ sinh số ngẫu nhiên có chu kỳ quá ngắn",
        "Tính địa phương của biểu diễn quá kém",
        "Hàm đánh giá chưa tính được delta tăng dần",
        "Biểu diễn thiếu tính đầy đủ: nghiệm tối ưu không nằm trong tập mã hoá được"
      ],
      dung: 3,
      giaiThich: "§5 và §9: vi phạm tiêu chí ② hay ③ chỉ làm bạn chậm; vi phạm tiêu chí ① làm bạn không bao giờ tới đích và không có dấu hiệu nào báo — điểm chạm trần là dấu hiệu kinh điển. Địa phương kém hay đánh giá không tăng dần làm chậm chứ không chặn cứng ở một con số; chu kỳ ngắn của bộ sinh số ảnh hưởng độ đa dạng chứ không tạo một trần chung cho mọi thuật toán."
    },
    {
      id: "q10", loai: "nhieu", doKho: 3, ref: "§5",
      hoi: "Chọn mọi phát biểu ĐÚNG về năm tiêu chí đánh giá một biểu diễn.",
      chon: [
        "Vi phạm tính đầy đủ nghiêm trọng hơn vi phạm tính hợp lệ hay tính địa phương, vì nó khiến bạn không bao giờ tới đích mà không có cảnh báo",
        "Có thể ước lượng tính hợp lệ bằng cách sinh 1 000 mã ngẫu nhiên rồi đếm tỷ lệ mã cho nghiệm hợp lệ",
        "Có thể ước lượng tính địa phương bằng cách áp một nước đi ngẫu nhiên và quan sát histogram của |Δf|",
        "Khi hai biểu diễn mỗi bên thắng hai tiêu chí, bảng đã đủ để chọn mà không cần thực nghiệm",
        "Tiêu chí chi phí đánh giá chỉ cần xét khi n vượt 10⁶"
      ],
      dung: [0, 1, 2],
      giaiThich: "Ba ý đầu là đúng và đều là phép đo làm được trong 10 phút (§5). Ý “bảng đã đủ” sai: ở ví dụ P2, chuỗi phẳng thua hai tiêu chí và thắng hai tiêu chí nên bảng không tự quyết định — bảng chỉ để loại phương án tệ rõ ràng và biết mình đánh đổi gì, không thay được thực nghiệm. Ý cuối sai: chi phí đánh giá (có tính tăng dần được không) quyết định bạn có đạt tốc độ nước đi/giây cần thiết hay không, và không có ngưỡng n = 10⁶ nào."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 3.1",
      hoi: "Với TSP n đỉnh, biểu diễn “dãy đỉnh có điểm bắt đầu tự do” có bao nhiêu mã cho mỗi chu trình? Hãy đề xuất cách khử dư thừa và nói dư thừa ấy gây hại gì cho việc tìm kiếm.",
      goiY: ["Chu trình có thể bắt đầu từ bất kỳ đỉnh nào và đi theo hai chiều.", "Bạn muốn mỗi chu trình còn đúng một mã — hãy ép hai điều kiện lên dãy."],
      mau: "Mỗi chu trình có **n** điểm bắt đầu × **2** chiều = **2n** mã (khi n ≥ 3). Cách khử: cố định đỉnh 0 ở vị trí đầu, rồi ép đỉnh đứng ngay sau 0 nhỏ hơn đỉnh đứng cuối dãy để chọn một trong hai chiều. Khi đó còn (n − 1)!/2 mã, mỗi mã đúng một chu trình.\n\nTác hại: (1) không gian tìm kiếm phình lên 2n lần một cách vô ích; (2) tệ hơn, thuật toán có thể tốn nhiều nước đi để “đi” từ mã này sang mã khác **của cùng một nghiệm** — chạy mà không tiến. Trong năm tiêu chí của §5, hệ quả này gần nhất với tiêu chí ③ (hình dạng bề mặt có những cao nguyên giả) và làm phí công ở tiêu chí ④; bài giảng không có tiêu chí riêng cho dư thừa.",
      tieuChi: ["Nêu đúng 2n mã cho mỗi chu trình (n điểm bắt đầu × 2 chiều)", "Đề xuất cố định đỉnh 0 ở đầu và chọn một chiều, đếm được (n − 1)!/2 mã", "Nêu được tác hại: phình không gian tìm kiếm, hoặc nước đi chạy mà không tiến vì đổi mã mà nghiệm không đổi"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 3.2",
      hoi: "Chia 12 học sinh thành 3 nhóm, mỗi nhóm 4 người, tối đa hoá tổng độ hợp nhau. Bạn chọn họ biểu diễn nào? Viết ra |S|. Biểu diễn của bạn có dư thừa không — nhóm 1 và nhóm 2 hoán vị cho nhau vẫn là cùng một cách chia? Nếu có, mỗi cách chia có bao nhiêu mã và bạn khử thế nào?",
      goiY: ["Thứ tự trong nhóm có quan trọng không?", "Đếm số phép gán nhãn hợp lệ trước, rồi hỏi mỗi cách chia bị đếm mấy lần."],
      mau: "Họ **gán nhãn**: nhom[i] ∈ {0, 1, 2} cho học sinh i, vì thứ tự trong nhóm không quan trọng. Số phép gán dùng mỗi nhãn đúng 4 lần là 12!/(4!)³ = 34 650. Ba nhóm không phân biệt nên mỗi cách chia bị đếm 3! = 6 lần (hoán vị nhãn nhóm), vậy |S| = 34 650 / 6 = **5 775**.\n\n**Có dư thừa**, đúng hệ số 6. Cách khử: đánh số nhóm theo thứ tự xuất hiện — học sinh 1 luôn ở nhóm 0, học sinh nhỏ nhất chưa xếp mở nhóm có nhãn nhỏ nhất chưa dùng.\n\nLưu ý về tính đóng: với ràng buộc “mỗi nhóm đúng 4 người”, phép “đổi nhãn một học sinh” phá kích thước nhóm; phép tự nhiên giữ được ràng buộc là **hoán đổi nhãn của hai học sinh thuộc hai nhóm khác nhau**.",
      tieuChi: ["Chọn họ gán nhãn và nêu lý do (thứ tự trong nhóm không quan trọng)", "Tính đúng |S| = 12!/((4!)³·3!) = 5 775, hoặc nói rõ 34 650 mã chia cho 6", "Nhận ra dư thừa với hệ số 3! = 6 do hoán vị nhãn nhóm và đề xuất cách khử", "(Mở rộng) Chỉ ra phép hoán đổi nhãn hai học sinh mới giữ được kích thước nhóm"]
    },
    {
      id: "l3", doKho: 3, ref: "Bài tập 3.3",
      hoi: "Với biểu diễn “chuỗi phẳng” cho P2, hãy chỉ ra một nghiệm hợp lệ mà **không** mã hoá được (tiêu chí ① bị vi phạm). Điều đó có quan trọng trong thực tế không — vì sao?",
      goiY: ["Nghĩ về một ngày cố tình để trống.", "Bộ giải mã luôn làm gì khi một ngày còn chỗ?"],
      mau: "Bộ giải mã nhồi tuần tự: nó chỉ sang ngày mới khi đơn kế tiếp **không vừa** ngày hiện tại. Vì vậy nó không bao giờ tạo ra một ngày rỗng, và cũng không cho phép ép một đơn vào một ngày cụ thể (điểm ✗ của cách D ở §2). Nghiệm “ngày 3 không làm gì để dồn sức cho ngày 4” hợp lệ nhưng không có mã nào giải ra nó.\n\nTrong P2/P3 điều này **không gây mất mát thực tế**: lợi ích của mỗi đơn luôn dương nên nghiệm tối ưu không có ngày rỗng, và nghiệm đó mã hoá được. Nhưng nếu đề có ràng buộc kiểu “đơn này chỉ giao được vào ngày 3” hoặc có lý do để bỏ trống một ngày, chuỗi phẳng sẽ thiếu đầy đủ và phải lai với họ gán nhãn (§3.4).",
      tieuChi: ["Đưa được ví dụ: một ngày cố tình để trống, hoặc ép một đơn vào ngày cụ thể", "Giải thích đúng vì sao bộ giải mã nhồi tuần tự không sinh ra nghiệm đó", "Kết luận không mất mát thực tế ở P2/P3 vì lợi ích dương ⇒ nghiệm tối ưu không có ngày rỗng, và nêu khi nào mới thành vấn đề"]
    },
    {
      id: "l4", doKho: 3, ref: "Bài tập 3.5",
      hoi: "Đề xuất một biểu diễn **gián tiếp** cho P1: mã là hoán vị của toàn bộ n đơn, bộ giải mã duyệt hoán vị và nhận đơn nào còn vừa giờ. So sánh với biểu diễn trực tiếp (dãy các đơn được giao) về (a) tính đầy đủ, (b) chi phí đánh giá, (c) tính địa phương. Bạn sẽ đo (c) như thế nào?",
      goiY: ["Với (a): hãy dựng mã cho một nghiệm tối ưu cho trước.", "Với (c): đổi chỗ hai đơn ở cuối hoán vị thì nghiệm giải ra thay đổi ra sao?"],
      mau: "**(a) Đầy đủ** cho nghiệm tối ưu: đặt các đơn của nghiệm tối ưu lên đầu mã, đúng thứ tự giao. Bộ giải mã nhận hết chúng; vì nghiệm tối ưu là cực đại (p > 0 nên không còn đơn nào nhét thêm được) nên không đơn nào ở phần còn lại được nhận. (Chú ý: một nghiệm hợp lệ nhưng chưa cực đại — còn chỗ thêm đơn — không mã hoá được chính xác, vì bộ giải mã tham lam sẽ nhận thêm.)\n\n**(b) Chi phí đánh giá:** trực tiếp O(m) với m đơn được giao, gián tiếp O(n) vì phải duyệt cả mã — đắt hơn cỡ n/m lần (đáp án bài tập ước tính ~8 lần).\n\n**(c) Địa phương kém hơn:** đổi chỗ hai đơn ở phần đuôi của mã (sau đơn nhận cuối cùng) không đổi gì cả, nên phần lớn lân cận là nước đi **trung tính** và local search lang thang trên cao nguyên. Cách đo: áp 1 000 nước đi ngẫu nhiên lên từng biểu diễn, ghi |Δf| rồi vẽ histogram — biểu diễn gián tiếp sẽ có một cột rất cao ở |Δf| = 0, cùng vài bước nhảy lớn khi một đơn sớm đổi chỗ và các đơn sau dịch theo.\n\nBù lại, gián tiếp **không bao giờ cho nghiệm không hợp lệ**, nên được phép xáo mã tuỳ thích.",
      tieuChi: ["(a) Nêu nghiệm tối ưu mã hoá được bằng cách đặt các đơn được giao lên đầu mã", "(b) Nêu O(n) so với O(m): gián tiếp đắt hơn", "(c) Nêu nhiều nước đi trung tính (đổi chỗ phần đuôi không đổi f) làm tính địa phương kém", "Mô tả cách đo: 1 000 nước đi ngẫu nhiên và histogram |Δf| cho cả hai biểu diễn"]
    }
  ],

  lab: [
    {
      id: "giai-ma-chuoi-phang",
      ten: "Bộ giải mã chuỗi phẳng cho bài ship hàng nhiều ngày",
      doKho: 2,
      ref: "§8.2, §7",
      de: "Cài **bộ giải mã chuỗi phẳng** (mẫu code ở §8.2) cho bài ship hàng nhiều ngày. Đầu vào là một bài toán `n` đơn, `D` ngày, mỗi ngày `T` phút, và một **mã**: hoán vị π của `1..n`. Bộ giải mã nhồi tuần tự các đơn theo thứ tự của mã.\n\n" +
          "**Luật giải mã:**\n" +
          "1. Bắt đầu ngày 1, đã dùng `t = 0` phút, đang đứng ở kho.\n" +
          "2. Với mỗi đơn `h` trong mã, chi phí `c = |Δx| + |Δy|` (từ vị trí hiện tại) `+ s`.\n" +
          "3. Nếu `t + c > T`: nếu đã ở ngày `D` thì **dừng hẳn** (phần đuôi của mã bị bỏ); chưa thì sang ngày mới, `t = 0` — nhưng **vị trí hiện tại giữ nguyên**: ngày mới bắt đầu ở nơi ngày cũ kết thúc.\n" +
          "4. Giao đơn: `t += c`, cộng tiền, vị trí = đơn `h`, ghi lại ngày giao.\n\n" +
          "**Nhiệm vụ:** in dòng 1 `k tien soNgay` (số đơn giao, tổng tiền, ngày của đơn giao cuối cùng) và dòng 2 là `n` số: số thứ `j` là ngày giao đơn `π_j`, hoặc `0` nếu đơn đó bị bỏ. Chấm trên 10 bộ dữ liệu; mỗi test hoặc đúng hoặc sai, và thông báo cho biết giá trị thứ mấy lệch.\n\n" +
          "Sau khi qua, thử các tab *Ngày chật* và *Chỉ 2 ngày* rồi tự hỏi: (a) nếu bạn lỡ đặt lại vị trí về kho mỗi khi sang ngày thì những giá trị nào sẽ sai? (b) đổi chỗ hai đơn đầu mã thì dãy ngày ở phía sau thay đổi ra sao — đó chính là **mất tính địa phương** của §4.4.",
      vanDe: "b03-giai-ma-chuoi-phang",
      bienThe: [
        { ten: "Ngày rộng (T = 480)", tham: { n: 40, D: 5, T: 480 } },
        { ten: "Ngày chật (T = 240)", tham: { n: 40, D: 5, T: 240 } },
        { ten: "Chỉ 2 ngày, nhiều đơn (cắt đuôi)", tham: { n: 60, D: 2, T: 480 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "n D T", "kx ky", n dòng "x y p s", rồi một dòng n số: mã π (hoán vị của 1..n).
// Đầu ra : dòng 1 "k tien soNgay"; dòng 2: n số — ngày giao đơn π_j (0 nếu bị bỏ).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], D = t[1], T = t[2], kx = t[3], ky = t[4];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[5 + 4 * i]); y.push(t[6 + 4 * i]); p.push(t[7 + 4 * i]); s.push(t[8 + 4 * i]); }
const ma = [];
for (let j = 0; j < n; j++) ma.push(t[5 + 4 * n + j] - 1);      // đổi về chỉ số từ 0

let k = 0, tien = 0, ngay = 1;
const ngayCua = new Array(n).fill(0);
// TODO: duyệt ma từ trái sang phải theo luật giải mã; sang ngày mới khi không vừa, dừng hẳn khi hết ngày.
//       Nhớ: sang ngày mới thì t = 0 nhưng vị trí hiện tại KHÔNG đổi.

print(k + " " + tien + " " + (k ? ngay : 0));
print(ngayCua.join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, D, T, kx, ky;
    scanf("%d %d %d %d %d", &n, &D, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n), ma(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    for (int j = 0; j < n; j++) { scanf("%d", &ma[j]); ma[j]--; }     // đổi về chỉ số từ 0

    int k = 0, ngay = 1;
    long long tien = 0;
    vector<int> ngayCua(n, 0);
    // TODO: duyệt ma từ trái sang phải theo luật giải mã; sang ngày mới khi không vừa, dừng hẳn khi hết ngày.
    //       Nhớ: sang ngày mới thì t = 0 nhưng vị trí hiện tại KHÔNG đổi.

    printf("%d %lld %d\n", k, tien, k ? ngay : 0);
    for (int j = 0; j < n; j++) printf("%d%c", ngayCua[j], j + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], D = t[1], T = t[2], kx = t[3], ky = t[4];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[5 + 4 * i]); y.push(t[6 + 4 * i]); p.push(t[7 + 4 * i]); s.push(t[8 + 4 * i]); }
const ma = [];
for (let j = 0; j < n; j++) ma.push(t[5 + 4 * n + j] - 1);

let k = 0, tien = 0, ngay = 1, tg = 0, hx = kx, hy = ky;
const ngayCua = new Array(n).fill(0);
for (let j = 0; j < n; j++) {
  const i = ma[j];
  const c = Math.abs(x[i] - hx) + Math.abs(y[i] - hy) + s[i];
  if (tg + c > T) {
    if (ngay === D) break;          // hết ngày: dừng hẳn, phần đuôi bị bỏ im lặng
    ngay++; tg = 0;                 // sang ngày mới — hx, hy KHÔNG được đặt lại
  }
  tg += c; tien += p[i]; k++;
  hx = x[i]; hy = y[i];
  ngayCua[j] = ngay;
}
print(k + " " + tien + " " + (k ? ngay : 0));
print(ngayCua.join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, D, T, kx, ky;
    scanf("%d %d %d %d %d", &n, &D, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n), ma(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);
    for (int j = 0; j < n; j++) { scanf("%d", &ma[j]); ma[j]--; }

    int k = 0, ngay = 1, tg = 0, hx = kx, hy = ky;
    long long tien = 0;
    vector<int> ngayCua(n, 0);
    for (int j = 0; j < n; j++) {
        int i = ma[j];
        int c = abs(x[i] - hx) + abs(y[i] - hy) + s[i];
        if (tg + c > T) {
            if (ngay == D) break;           // hết ngày: dừng hẳn, phần đuôi bị bỏ im lặng
            ngay++; tg = 0;                 // sang ngày mới — hx, hy KHÔNG được đặt lại
        }
        tg += c; tien += p[i]; k++;
        hx = x[i]; hy = y[i];
        ngayCua[j] = ngay;
    }
    printf("%d %lld %d\n", k, tien, k ? ngay : 0);
    for (int j = 0; j < n; j++) printf("%d%c", ngayCua[j], j + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Ba biến trạng thái chạy dọc theo mã: ngày hiện tại, số phút đã dùng trong ngày, và vị trí hiện tại.",
        "Khi `t + c > T` mà chưa phải ngày cuối: tăng ngày, đặt `t = 0`, **không** đụng tới vị trí và **không** tính lại `c` — vị trí không đổi nên chi phí cũng không đổi.",
        "Khi `t + c > T` mà đã ở ngày `D`: `break` ngay — mọi đơn còn lại của mã nhận ngày 0 (bị cắt đuôi), không thử “nhét” đơn nhỏ hơn phía sau."
      ]
    },
    {
      id: "ship1-gian-tiep",
      ten: "Biểu diễn gián tiếp cho P1: mã hoán vị toàn bộ + bộ giải mã",
      doKho: 3,
      ref: "§4, §5, Bài tập 3.5",
      de: "P1 trong khoá: lưới 100×100, kho ở (50,50), `n = 120` đơn, 480 phút, **không** cần quay về. Thay vì lưu thẳng dãy các đơn được giao (biểu diễn trực tiếp), hãy dùng biểu diễn **gián tiếp** của Bài tập 3.5:\n\n" +
          "- **Mã** là một hoán vị của **toàn bộ** `n` đơn (chỉ số từ 0).\n" +
          "- **Bộ giải mã:** đi từ kho, duyệt mã từ trái sang phải, **nhận** đơn nào còn vừa giờ (`tg + d + s ≤ T`) và bỏ qua đơn không vừa (không dừng), cập nhật vị trí. Tuyến thật là các đơn được nhận theo thứ tự nhận.\n" +
          "- **Leo đồi trong không gian mã:** dời một phần tử từ vị trí `i` sang vị trí `j` của mã; giữ nước đi nếu tổng tiền sau giải mã **tăng thật sự**, ngược lại hoàn tác.\n\n" +
          "In ra tuyến đã giải mã, đúng định dạng P1: `k` rồi `k` chỉ số (từ 1) theo thứ tự ghé. Vì bộ giải mã chỉ nhận đơn còn vừa giờ, **mọi mã — kể cả mã ngẫu nhiên — đều cho tuyến hợp lệ**.\n\n" +
          "**Mức đạt:** hợp lệ → bằng greedy theo tiền → bằng greedy gần nhất → bằng greedy theo tỉ số → hơn greedy theo tỉ số 1,5 %. Mã khởi đầu của bạn quyết định rất nhiều: thử xếp mã **một lần** theo `p/(d+s)` từ kho và đo xem mình rơi vào mức nào, rồi thử khởi đầu từ tuyến greedy.\n\n" +
          "**Suy ngẫm (tính địa phương, §4.4):** dùng `log(...)` đếm bao nhiêu phần trăm nước đi dời-chỗ là *trung tính* (không đổi tổng tiền). Vì sao việc đổi chỗ hai phần tử ở phần đuôi của mã (sau đơn nhận cuối cùng) luôn trung tính — và biết điều đó giúp chạy nhanh hơn thế nào?",
      vanDe: "ship1",
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 2000,
      muc: [
        { ten: "Bằng greedy theo tiền", so: "giaTri", heSo: 1 },
        { ten: "Bằng greedy gần nhất", so: "ganNhat", heSo: 1 },
        { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 },
        { ten: "Hơn greedy theo tỉ số 1,5 %", so: "tiSo", heSo: 1.015 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: "n T", "kx ky", n dòng "x y p s".
// Đầu ra : dòng 1 là k (số đơn giao), dòng 2 là k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]); }

// Bộ giải mã: duyệt mã từ trái sang phải, nhận đơn nào còn vừa giờ, bỏ qua đơn không vừa.
// Trả về tổng tiền; nếu ghi != null thì ghi.push(đơn nhận) theo thứ tự nhận.
function giaiMa(ma, ghi) {
  // TODO
  return 0;
}

// Mã khởi đầu: một hoán vị của TOÀN BỘ n đơn.
const ma = [];
for (let i = 0; i < n; i++) ma.push(i);
// TODO: dựng mã khởi đầu tốt hơn thứ tự 0..n-1 (gợi ý: lấy tuyến greedy làm phần đầu của mã).

let f = giaiMa(ma, null);
// TODO: leo đồi trong không gian mã — dời phần tử ở vị trí i sang vị trí j, giữ nếu f tăng thật sự.

const tuyen = [];
giaiMa(ma, tuyen);
print(tuyen.length);
print(tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;

// Bộ giải mã: duyệt mã từ trái sang phải, nhận đơn nào còn vừa giờ, bỏ qua đơn không vừa.
// Trả về tổng tiền; nếu ghi != nullptr thì ghi->push_back(đơn nhận) theo thứ tự nhận.
int giaiMa(const vector<int>& ma, vector<int>* ghi) {
    // TODO
    return 0;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    // Mã khởi đầu: một hoán vị của TOÀN BỘ n đơn.
    vector<int> ma(n);
    iota(ma.begin(), ma.end(), 0);
    // TODO: dựng mã khởi đầu tốt hơn thứ tự 0..n-1 (gợi ý: lấy tuyến greedy làm phần đầu của mã).

    int f = giaiMa(ma, nullptr);
    (void)f;
    // TODO: leo đồi trong không gian mã — dời phần tử ở vị trí i sang vị trí j, giữ nếu f tăng thật sự.

    vector<int> tuyen;
    giaiMa(ma, &tuyen);
    printf("%d\n", (int)tuyen.size());
    for (size_t i = 0; i < tuyen.size(); i++) printf("%d%c", tuyen[i] + 1, i + 1 < tuyen.size() ? ' ' : '\n');
    if (tuyen.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]); }

// Bộ giải mã: duyệt mã, nhận đơn nào còn vừa giờ. cuoi = vị trí (trong mã) của đơn nhận cuối cùng.
let cuoi = -1;
function giaiMa(ma, ghi) {
  let hx = kx, hy = ky, tg = 0, tien = 0;
  cuoi = -1;
  for (let k = 0; k < n; k++) {
    const i = ma[k];
    const c = Math.abs(x[i] - hx) + Math.abs(y[i] - hy) + s[i];
    if (tg + c > T) continue;
    tg += c; tien += p[i]; hx = x[i]; hy = y[i]; cuoi = k;
    if (ghi) ghi.push(i);
  }
  return tien;
}

// Mã khởi đầu: tuyến greedy theo p / (d + s) (tính lại mỗi bước), rồi các đơn còn lại.
const dung = new Array(n).fill(false);
const ma = [];
{
  let hx = kx, hy = ky, tg = 0;
  for (;;) {
    let tot = -1, diemTot = -1, chiPhiTot = 0;
    for (let i = 0; i < n; i++) {
      if (dung[i]) continue;
      const c = Math.abs(x[i] - hx) + Math.abs(y[i] - hy) + s[i];
      if (tg + c > T) continue;
      const diem = p[i] / (c + 1);
      if (diem > diemTot) { diemTot = diem; tot = i; chiPhiTot = c; }
    }
    if (tot < 0) break;
    dung[tot] = true; ma.push(tot); tg += chiPhiTot; hx = x[tot]; hy = y[tot];
  }
}
for (let i = 0; i < n; i++) if (!dung[i]) ma.push(i);

// Leo đồi trong KHÔNG GIAN MÃ: dời phần tử từ vị trí i sang vị trí j, giữ nếu tổng tiền tăng thật sự.
let f = giaiMa(ma, null), trungTinh = 0, tong = 0;
for (let luot = 0; luot < 3; luot++) {
  let cai = false;
  for (let i = 0; i < n; i++) {
    giaiMa(ma, null);
    const c0 = cuoi;                                   // vị trí đơn nhận cuối của mã hiện tại
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (i > c0 && j > c0) { trungTinh++; tong++; continue; }   // cả hai sau đơn nhận cuối: chắc chắn trung tính
      const v = ma.splice(i, 1)[0]; ma.splice(j, 0, v);
      const g = giaiMa(ma, null); tong++;
      if (g > f) { f = g; cai = true; break; }
      ma.splice(j, 1); ma.splice(i, 0, v);
    }
  }
  if (!cai) break;
}
log("nước đi bỏ qua vì chắc chắn trung tính:", trungTinh, "/", tong);

const tuyen = [];
giaiMa(ma, tuyen);
print(tuyen.length);
print(tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky, cuoi;
vector<int> x, y, p, s;

// Bộ giải mã: duyệt mã, nhận đơn nào còn vừa giờ. cuoi = vị trí (trong mã) của đơn nhận cuối cùng.
int giaiMa(const vector<int>& ma, vector<int>* ghi) {
    int hx = kx, hy = ky, tg = 0, tien = 0;
    cuoi = -1;
    for (int k = 0; k < n; k++) {
        int i = ma[k];
        int c = abs(x[i] - hx) + abs(y[i] - hy) + s[i];
        if (tg + c > T) continue;
        tg += c; tien += p[i]; hx = x[i]; hy = y[i]; cuoi = k;
        if (ghi) ghi->push_back(i);
    }
    return tien;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    // Mã khởi đầu: tuyến greedy theo p / (d + s) (tính lại mỗi bước), rồi các đơn còn lại.
    vector<bool> dung(n, false);
    vector<int> ma;
    {
        int hx = kx, hy = ky, tg = 0;
        for (;;) {
            int tot = -1, chiPhiTot = 0;
            double diemTot = -1;
            for (int i = 0; i < n; i++) {
                if (dung[i]) continue;
                int c = abs(x[i] - hx) + abs(y[i] - hy) + s[i];
                if (tg + c > T) continue;
                double diem = (double)p[i] / (c + 1);
                if (diem > diemTot) { diemTot = diem; tot = i; chiPhiTot = c; }
            }
            if (tot < 0) break;
            dung[tot] = true; ma.push_back(tot); tg += chiPhiTot; hx = x[tot]; hy = y[tot];
        }
    }
    for (int i = 0; i < n; i++) if (!dung[i]) ma.push_back(i);

    // Leo đồi trong KHÔNG GIAN MÃ: dời phần tử từ vị trí i sang vị trí j, giữ nếu tổng tiền tăng thật sự.
    int f = giaiMa(ma, nullptr);
    for (int luot = 0; luot < 3; luot++) {
        bool cai = false;
        for (int i = 0; i < n; i++) {
            giaiMa(ma, nullptr);
            int c0 = cuoi;                                   // vị trí đơn nhận cuối của mã hiện tại
            for (int j = 0; j < n; j++) {
                if (i == j) continue;
                if (i > c0 && j > c0) continue;              // cả hai sau đơn nhận cuối: chắc chắn trung tính
                int v = ma[i];
                ma.erase(ma.begin() + i); ma.insert(ma.begin() + j, v);
                int g = giaiMa(ma, nullptr);
                if (g > f) { f = g; cai = true; break; }
                ma.erase(ma.begin() + j); ma.insert(ma.begin() + i, v);
            }
        }
        if (!cai) break;
    }

    vector<int> tuyen;
    giaiMa(ma, &tuyen);
    printf("%d\n", (int)tuyen.size());
    for (size_t i = 0; i < tuyen.size(); i++) printf("%d%c", tuyen[i] + 1, i + 1 < tuyen.size() ? ' ' : '\n');
    if (tuyen.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Bộ giải mã chỉ có một vòng lặp: duyệt mã, tính chi phí `d + s` từ vị trí hiện tại, nhận nếu `tg + chi phí ≤ T`, ngược lại bỏ qua rồi xét phần tử kế tiếp.",
        "Mã xếp một lần theo p/(d+s) từ kho rơi vào cỡ 80 % của greedy tỉ số vì chỉ số không được tính lại theo vị trí (Bài 5). Hãy làm mã khởi đầu là **chính tuyến greedy** (các đơn của tuyến đứng đầu mã), rồi mới đến phần còn lại.",
        "Dời phần tử từ `i` sang `j` bằng `splice` (JS) hoặc `erase` + `insert` (C++), giải mã lại, hoàn tác nếu không tăng. Chỉ nhận khi **tăng thật sự** (`>`), nếu không bạn sẽ bị nước đi trung tính kéo lang thang.",
        "Mọi nước đi mà cả `i` và `j` đều đứng sau vị trí của đơn nhận cuối cùng trong mã đều trung tính — bỏ qua chúng để chạy nhanh hơn nhiều."
      ]
    }
  ]
});
