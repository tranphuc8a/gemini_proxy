/* Thực hành — Bài 2: Vì sao không giải chính xác được: bùng nổ tổ hợp & NP-hard.
   Hai lab dạng `tuDapAn`:
     · dem-khong-gian    — đếm |S| bằng logarit (§3, §7.3): n! tràn cả int64 lẫn double từ n = 171;
     · meet-in-the-middle — subset-sum n = 38, mức T cỡ 10¹⁴ (§4.2, bài tập 2.3): vét cạn 2³⁸ và DP O(n·T) đều bất khả thi. */
(function () {
  "use strict";
  var TI = TH.tienIch;

  /* ------------------------------------------------------------------ lab 1: đếm |S| bằng logarit */
  var LF = [0];                                              /* LF[n] = log10(n!) */
  for (var ii = 1; ii <= 500; ii++) LF.push(LF[ii - 1] + Math.log10(ii));
  var LG2 = Math.log10(2);

  function logTong(a) {                                      /* log10(Σ 10^aᵢ), tránh tràn bằng cách trừ số lớn nhất */
    var m = -Infinity, s = 0, i;
    for (i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
    for (i = 0; i < a.length; i++) s += Math.pow(10, a[i] - m);
    return m + Math.log10(s);
  }
  /* mã 1: tập con 2^a · 2: hoán vị a! · 3: chu trình TSP (a−1)!/2 · 4: chọn và sắp mọi độ dài Σₖ₌₀..ₐ a!/(a−k)!
     · 5: chọn và sắp tối đa b phần tử Σₖ₌₀..b a!/(a−k)! · 6: gán a đối tượng vào b nhóm, b^a.  Trả log10|S|. */
  function logKhongGian(ma, a, b) {
    if (ma === 1) return a * LG2;
    if (ma === 2) return LF[a];
    if (ma === 3) return LF[a - 1] - LG2;
    if (ma === 6) return a * Math.log10(b);
    var kMax = ma === 4 ? a : b, t = [];
    for (var k = 0; k <= kMax; k++) t.push(LF[a] - LF[a - k]);
    return logTong(t);
  }

  TH.vande.dangKy("b02-dem-khong-gian", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TI.rng(seed), lon = tham.kich !== "nho", ds = [], ma, i;
      var kc = lon ? [[20, 400], [172, 400], [10, 400], [10, 300], [30, 150], [20, 300]] : [[3, 20], [3, 18], [4, 18], [3, 15], [6, 18], [3, 12]];
      var maDanh = [];
      for (i = 1; i <= 6; i++) { maDanh.push(i); maDanh.push(i); }
      maDanh = TI.tron(maDanh, r);
      for (i = 0; i < maDanh.length; i++) {
        ma = maDanh[i];
        var a = r.khoang(kc[ma - 1][0], kc[ma - 1][1]), b = 0;
        if (ma === 5) b = r.khoang(2, lon ? 15 : 6);
        if (ma === 6) b = r.khoang(2, lon ? 9 : 5);
        ds.push([ma, a, b]);
      }
      return { q: ds.length, ds: ds };
    },
    viet: function (inst) {
      return inst.q + "\n" + inst.ds.map(function (d) { return d.join(" "); }).join("\n") + "\n";
    },
    giai: function (inst) {
      return inst.ds.map(function (d) { return logKhongGian(d[0], d[1], d[2]); });
    },
    saiSo: 0.001,
    dinhDang: {
      vao: "Dòng 1: `q` — số truy vấn. Tiếp theo `q` dòng, mỗi dòng `ma a b`. `ma` = 1: tập con của `a` món (2ᵃ); 2: hoán vị `a` món (a!); 3: chu trình TSP qua `a` thành phố ((a−1)!/2); 4: chọn rồi sắp thứ tự **mọi** độ dài k = 0…a trong `a` món (Σ a!/(a−k)!); 5: chọn rồi sắp thứ tự **tối đa `b`** món trong `a` món (Σₖ₌₀..b a!/(a−k)!); 6: gán `a` đối tượng vào `b` nhóm (bᵃ). Với `ma` ≠ 5, 6 thì `b` = 0.",
      ra: "`q` dòng, mỗi dòng một số thực: **log₁₀|S|** của truy vấn tương ứng. In ít nhất 3 chữ số thập phân; sai số cho phép ±0,001."
    }
  }));

  /* ------------------------------------------------------------------ lab 2: meet in the middle */
  /* Danh sách mọi tổng con ≤ cap của a[lo..hi), đã sắp tăng — sinh bằng cách trộn (merge), không cần sort:
     thêm một phần tử v thì trộn danh sách cũ với danh sách cũ + v (hai danh sách đều đã sắp). */
  function tongCon(a, lo, hi, cap) {
    var cho = Math.pow(2, hi - lo), cur = new Float64Array(cho), nxt = new Float64Array(cho), m = 1;
    for (var i = lo; i < hi; i++) {
      var v = a[i], e = m, x = 0, y = 0, k = 0;
      while (e > 0 && cur[e - 1] + v > cap) e--;               /* chỉ cur[0..e) cộng thêm v mà vẫn <= cap */
      while (x < m && y < e) {
        var bv = cur[y] + v;
        if (cur[x] <= bv) nxt[k++] = cur[x++]; else { nxt[k++] = bv; y++; }
      }
      while (x < m) nxt[k++] = cur[x++];
      while (y < e) nxt[k++] = cur[y++] + v;
      var tmp = cur; cur = nxt; nxt = tmp; m = k;
    }
    return cur.subarray(0, m);
  }
  function tongLonNhat(a, T) {
    var h = a.length >> 1, L = tongCon(a, 0, h, T), R = tongCon(a, h, a.length, T), best = 0, j = R.length - 1;
    for (var i = 0; i < L.length; i++) {
      while (j >= 0 && L[i] + R[j] > T) j--;
      if (j < 0) break;
      if (L[i] + R[j] > best) best = L[i] + R[j];
    }
    return best;
  }

  TH.vande.dangKy("b02-meet-in-middle", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TI.rng(seed), n = tham.n || 38, a = [], tong = 0, i;
      for (i = 0; i < n; i++) { var v = r.khoang(1000000000000, 10000000000000); a.push(v); tong += v; }
      return { n: n, T: Math.floor(tong * 0.45) + r.khoang(0, 1000), a: a };
    },
    viet: function (inst) { return inst.n + " " + inst.T + "\n" + inst.a.join(" ") + "\n"; },
    giai: function (inst) { return [tongLonNhat(inst.a, inst.T)]; },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `n T` — số phần tử và mức trần (cỡ 10¹⁴). Dòng 2: `n` số nguyên dương `a₁ … aₙ`, mỗi số trong [10¹², 10¹³].",
      ra: "Một số nguyên: tổng lớn nhất của một tập con các `aᵢ` mà tổng **không vượt quá `T`** (tập rỗng có tổng 0)."
    }
  }));

  /* ================================================================== bài thực hành */
  TH.dangKy({
    id: "bai-02-vi-sao-kho",

    tomTat: [
      "**Bùng nổ tổ hợp:** khoá 3 vòng số có 10³ mã (33 phút ở 2 giây/mã), khoá 10 vòng có 10¹⁰ mã (634 năm) — khoá chỉ to hơn ba lần mà thời gian tăng 10⁷ lần. Phần cứng không thắng được cuộc đua này: máy nhanh gấp đôi chỉ thêm đúng 1 phần tử cho 2ⁿ.",
      "Việc đầu tiên khi đọc một đề tối ưu là **đếm |S|**. Mốc: 10⁹ phép/giây, 10⁹ giây ≈ 32 năm; số mũ của giây = log₁₀|S| − 9. Nếu log₁₀|S| > 12 (vượt 17 phút) thì quên vét cạn.",
      "Bốn họ đếm: tập con **2ⁿ**; hoán vị **n!** (chu trình TSP (n−1)!/2: chia n vì xoay vòng, chia 2 vì đảo chiều); chọn rồi sắp thứ tự **Σ n!/(n−k)!**; gán nhãn **mⁿ** (n đối tượng vào m nhóm). P1 với n = 120 có |S| > 120!/105! ≈ 10³¹; P2 (gán 260 đơn cho 5 ngày) có |S| > 5²⁶⁰ ≈ 10¹⁸¹.",
      "|S| khổng lồ **không tự động nghĩa là khó**: DP giải cái túi trong O(nW) vì trạng thái (đã xét tới món nào, đã dùng bao nhiêu cân) đã đủ quyết định tương lai — hai tập con cùng cân nặng là tương đương nhau, gộp 2¹⁰⁰ nghiệm thành 2,5 triệu trạng thái.",
      "O(nW) là **giả đa thức**: phụ thuộc giá trị của W chứ không phải số bit viết W (n = 100, W = 10⁹ → 10¹¹ phép, không chạy nổi). Thêm di chuyển thì trạng thái phải có tập đã thăm và vị trí hiện tại: 2ⁿ·n·B — DP sụp đổ.",
      "**Held–Karp** O(n²·2ⁿ) là thuật toán chính xác tốt nhất cho TSP: n = 15 chỉ 7 ms, n = 25 khoảng 21 giây, n = 40 khoảng 21 ngày. Ranh giới thực tế của thuật toán chính xác cho định tuyến là n ≈ 20–30; n ≈ 12–15 vẫn giải chính xác được bên trong một heuristic (matheuristic).",
      "**NP-hard:** một nhóm bài khó như nhau — nếu một bài có thuật toán đa thức thì cả nhóm có (phép quy dẫn); hơn 50 năm chưa ai làm được. Cái túi, TSP, orienteering, VRP đều NP-hard; Dijkstra, luồng cực đại, ghép cặp hai phía thì không — “rời rạc” không tự động nghĩa là khó.",
      "Ba con đường: chính xác (n ≤ 20–30 hoặc có cấu trúc đặc biệt), xấp xỉ có bảo chứng, heuristic. Bảo chứng nói về **trường hợp xấu nhất** nên 2-opt (≈ 5 % trên dữ liệu thật) thường thắng Christofides (≤ 1,5×); xấp xỉ đáng giá khi phải ký cam kết hoặc dữ liệu do đối thủ chọn."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§1",
        hoi: "Trong DSA, khi một thuật toán quá chậm bạn tìm một thuật toán tốt hơn. Với bài tối ưu tổ hợp NP-hard, điều bạn thường phải làm khác đi là gì?",
        chon: [
          "Mua máy nhanh hơn, vì chắc chắn tồn tại một thuật toán đa thức",
          "Đổi mục tiêu: thôi tìm lời giải tốt nhất, chuyển sang tìm lời giải đủ tốt",
          "Viết lại bằng ngôn ngữ nhanh hơn rồi vét cạn",
          "Chứng minh bài toán không có lời giải"
        ],
        dung: 1,
        giaiThich: "Giả định ngầm của DSA là luôn có một thuật toán đa thức chỉ chờ được tìm; với bài tối ưu tổ hợp giả định đó sai, và có lý do rất mạnh để tin rằng không có. Nên khi chậm, bạn thường phải đổi mục tiêu sang “đủ tốt”. Phần cứng và ngôn ngữ nhanh hơn chỉ mua thêm vài phần tử vì bùng nổ tổ hợp (cạm bẫy 1), còn bài toán vẫn có lời giải — chỉ là không tính nổi."
      },
      {
        id: "q2", loai: "mot", doKho: 2, ref: "§3.2",
        hoi: "Vì sao số chu trình TSP khác nhau là (n−1)!/2 chứ không phải n!?",
        chon: [
          "Chia cho n vì mỗi thành phố chỉ được thăm một lần; chia cho 2 vì chỉ cần thăm một nửa số thành phố",
          "Vì thành phố đầu tiên được chọn trước nên có n−1 cách và (n−1)! đã là kết quả cuối cùng",
          "Chia cho n vì chu trình không có điểm bắt đầu (xoay vòng cho cùng một chu trình); chia cho 2 vì đi xuôi và đi ngược cho cùng độ dài",
          "Vì TSP luôn có đúng hai chu trình tối ưu"
        ],
        dung: 2,
        giaiThich: "n! đếm các thứ tự thăm, trong đó mỗi chu trình xuất hiện n lần (chọn điểm bắt đầu khác nhau) và 2 lần nữa (đi xuôi hoặc ngược) nên phải chia cho cả n và 2: n!/(2n) = (n−1)!/2. Phương án cố định thành phố đầu rồi dừng ở (n−1)! chưa bỏ chiều đi; hai phương án còn lại giải thích sai lý do chia (cả hai đều không liên quan đến điểm bắt đầu hay chiều đi)."
      },
      {
        id: "q3", loai: "so", doKho: 2, ref: "§3.3",
        hoi: "P1 với n = 120 đơn: để chặn dưới |S| chỉ cần MỘT số hạng của tổng, là số dãy độ dài đúng 15, tức 120 × 119 × … × 106. Tính log₁₀ của tích đó (làm tròn một chữ số thập phân là đủ).",
        dapAn: 30.79, saiSo: 0.05,
        giaiThich: "Tích của 15 thừa số, mỗi thừa số quanh 113: 15 × log₁₀ 113 ≈ 15 × 2,05 ≈ 30,8; tính chính xác bằng cách cộng log₁₀ của từng thừa số ra 30,79, tức khoảng 10³¹. Áp quy tắc nhẩm: 31 − 9 = 22 nên vét cạn cỡ 10²² giây, hàng chục nghìn lần tuổi vũ trụ (≈ 4×10¹⁷ giây) — và đó mới chỉ là các dãy độ dài đúng 15. Nhớ rằng logarit của một tích là TỔNG các logarit, không phải một logarit nhân với số thừa số."
      },
      {
        id: "q4", loai: "mot", doKho: 2, ref: "§4.1.1",
        hoi: "|S| = 2¹⁰⁰ ≈ 1,27×10³⁰ nhưng quy hoạch động giải cái túi n = 100, W = 25 000 chỉ trong khoảng 2,5 ms. Điều gì cho phép điều đó?",
        chon: [
          "Hai tập con đã xét có cùng tổng cân nặng thì tương đương nhau với tương lai, nên chỉ cần nhớ cặp (đã xét tới món nào, đã dùng bao nhiêu cân) — gộp 2¹⁰⁰ nghiệm thành 2,5 triệu trạng thái",
          "Cái túi không phải bài NP-hard",
          "Máy tính hiện đại duyệt được 10³⁰ phép mỗi giây",
          "Quy hoạch động chỉ duyệt các tập con nhỏ hơn W"
        ],
        dung: 0,
        giaiThich: "Điều giúp ích là cấu trúc của S: cái cần cho tương lai chỉ là “còn bao nhiêu chỗ”, không phải “đã lấy chính xác những món nào”. Câu hỏi mở cánh cửa DP là: trạng thái nào là đủ để quyết định tương lai? Cái túi vẫn là NP-hard (O(nW) là giả đa thức), máy tính chỉ cỡ 10⁹ phép/giây, và DP không duyệt tập con nào cả mà duyệt các ô của bảng 100 × 25 000 = 2,5×10⁶."
      },
      {
        id: "q5", loai: "nhieu", doKho: 3, ref: "§4.2–4.3",
        hoi: "Chọn những phát biểu ĐÚNG về quy hoạch động cái túi O(nW) và vì sao nó không dùng được khi bài toán có thêm việc di chuyển.",
        chon: [
          "O(nW) là đa thức theo kích thước đầu vào vì n và W đều là số",
          "O(nW) phụ thuộc vào giá trị của W chứ không phải số bit viết ra W — vì thế gọi là giả đa thức",
          "Khi thêm di chuyển, số trạng thái chỉ nhân thêm hệ số n nên DP vẫn chạy được",
          "Với n = 100 và W = 10⁹ thì nW = 10¹¹ phép, DP không còn chạy nổi",
          "Khi thêm di chuyển phải nhớ thêm vị trí hiện tại và tập đã thăm; thành phần “tập đã thăm” (2ⁿ) làm DP sụp đổ"
        ],
        dung: [1, 3, 4],
        giaiThich: "W viết bằng log₂ W bit nên O(nW) = O(n·2^(log₂ W)) là hàm mũ theo kích thước đầu vào — giả đa thức; viết thêm một chữ số vào W là DP chậm 10 lần. Với W = 10⁹ thì nW = 10¹¹, mất khoảng 100 giây. Khi thêm di chuyển, “đã dùng 200 phút” không đủ quyết định bước tiếp theo: cần cả vị trí hiện tại và tập đã thăm, trạng thái thành 2ⁿ·n·B — lịch sử không gộp được nên hai phát biểu còn lại sai."
      },
      {
        id: "q6", loai: "nhieu", doKho: 2, ref: "§5",
        hoi: "Chọn những phát biểu ĐÚNG về NP-hard theo bài giảng.",
        chon: [
          "NP-hard nghĩa là đã được chứng minh rằng không tồn tại thuật toán đa thức",
          "Nếu ai đó tìm được thuật toán đa thức cho MỘT bài NP-hard thì mọi bài NP-hard khác cũng giải được trong thời gian đa thức (nhờ phép quy dẫn)",
          "Mọi bài tối ưu tổ hợp đều NP-hard",
          "Cái túi 0/1 là NP-hard nhưng vẫn có DP giả đa thức",
          "Dijkstra, luồng cực đại và ghép cặp hai phía là bài tối ưu rời rạc nhưng có thuật toán đa thức — “rời rạc” không tự động nghĩa là khó"
        ],
        dung: [1, 3, 4],
        giaiThich: "Cả nhóm NP-hard đứng hoặc sụp cùng nhau vì chúng được nối bằng phép quy dẫn; cái túi vừa NP-hard vừa có DP giả đa thức; và ba bài cuối của bảng (Dijkstra, luồng cực đại, ghép cặp) chứng tỏ rời rạc không đồng nghĩa với khó. Hai phát biểu còn lại sai: hơn 50 năm chưa ai tìm ra thuật toán đa thức nhưng cũng chưa ai chứng minh là không tồn tại (đó là cơ sở thực dụng chứ không phải chứng minh), và nhiều bài tối ưu tổ hợp có thuật toán đa thức."
      },
      {
        id: "q7", loai: "so", doKho: 2, ref: "§4.3", donVi: "(giây)",
        hoi: "Held–Karp có độ phức tạp O(n²·2ⁿ). Với n = 25 ở 10⁹ phép/giây, mất khoảng bao nhiêu giây?",
        dapAn: 21, saiSo: 0.5,
        giaiThich: "n²·2ⁿ = 625 × 33 554 432 ≈ 2,1×10¹⁰ phép, chia 10⁹ ra khoảng 21 giây. Cùng công thức: n = 15 chỉ khoảng 7 ms (ý nghĩa cho matheuristic ở Bài 16), n = 30 khoảng 16 phút, n = 40 khoảng 21 ngày — nên ranh giới thực tế của thuật toán chính xác cho định tuyến là n ≈ 20–30. Nếu bạn ra khoảng 0,03 giây thì mới tính 2²⁵ mà quên nhân n² = 625."
      },
      {
        id: "q8", loai: "mot", doKho: 3, ref: "§6.2",
        hoi: "Christofides đảm bảo lời giải TSP không tệ hơn 1,5 lần tối ưu, nhưng trên dữ liệu thực 2-opt đơn giản thường chỉ kém tối ưu khoảng 5 %. Vì sao điều này không mâu thuẫn?",
        chon: [
          "Định lý của Christofides chỉ đúng với n nhỏ",
          "2-opt cũng có bảo chứng không tệ hơn 5 %",
          "Con số 5 % do máy nhanh nên đo sai",
          "Bảo chứng nói về trường hợp xấu nhất trên mọi dữ liệu; dữ liệu thật có cấu trúc và heuristic tối ưu cho trường hợp trung bình — thứ bạn được chấm"
        ],
        dung: 3,
        giaiThich: "Bảo chứng là về trường hợp xấu nhất: để đúng với cả dữ liệu dựng riêng để phá nó, nó phải thận trọng ở mọi nơi; dữ liệu thật hiếm khi độc địa như vậy. 2-opt không có bảo chứng 5 % — đó là số đo thực nghiệm. Đừng đảo ngược thành “xấp xỉ vô dụng”: bảo chứng đáng giá hơn mọi phần trăm khi bạn phải ký cam kết (hợp đồng, kiểm định) hoặc khi dữ liệu do đối thủ chọn."
      },
      {
        id: "q9", loai: "so", doKho: 2, ref: "§9 (cạm bẫy 1)", donVi: "(phần tử)",
        hoi: "Một máy mới nhanh gấp 1 024 lần máy cũ. Với thuật toán vét cạn 2ⁿ, bạn giải được thêm tối đa bao nhiêu phần tử trong cùng thời gian?",
        dapAn: 10, saiSo: 0,
        giaiThich: "2^(n+Δ) = 1 024 · 2ⁿ ⇒ Δ = log₂ 1 024 = 10. Định luật Moore (gấp đôi tốc độ sau khoảng 2 năm) mua cho bạn đúng n → n + 1; với n! ở n = 20 thì mỗi phần tử thêm làm không gian gấp 21 lần nên gấp đôi tốc độ thậm chí không đủ để thêm một phần tử. Phần cứng không bao giờ thắng được bùng nổ tổ hợp — chỉ thuật toán tốt hơn mới thắng được."
      },
      {
        id: "q10", loai: "mot", doKho: 1, ref: "§3.4, §2.1",
        hoi: "Gán 30 công việc cho 4 máy (mỗi việc đúng một máy, chưa tính thứ tự trong máy). Có bao nhiêu cách, và vét cạn ở 10⁹ phép/giây mất cỡ nào?",
        chon: [
          "4³⁰ ≈ 1,15×10¹⁸ cách; cỡ 36 năm — không vét cạn được",
          "30⁴ = 810 000 cách; chưa tới 1 ms — vét cạn thoải mái",
          "30! ≈ 2,65×10³² cách; cỡ 10²³ giây",
          "C(30, 4) = 27 405 cách; cỡ vài chục micro giây"
        ],
        dung: 0,
        giaiThich: "Mỗi trong 30 việc có 4 lựa chọn độc lập nên |S| = 4³⁰ = 2⁶⁰ ≈ 1,15×10¹⁸, vét cạn cỡ 1,15×10⁹ giây ≈ 36 năm. 30⁴ đảo vai trò (mỗi MÁY chọn một việc); 30! là số cách sắp thứ tự tất cả việc; C(30, 4) là chọn ra 4 việc — không phải gán nhãn."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "Bài tập 2.2",
        hoi: "Bạn có 100 ms (≈ 10⁸ phép ở 10⁹ phép/giây). Ước lượng n lớn nhất mà Held–Karp O(n²·2ⁿ) còn chạy nổi. Nếu ngân sách tăng lên 10 giây (gấp 100 lần), n tăng thêm được bao nhiêu và vì sao?",
        goiY: ["Thử lần lượt từng n cho tới khi n²·2ⁿ vượt ngân sách.", "Gấp 100 lần công tương ứng 2 mũ bao nhiêu?"],
        mau: "Cần n²·2ⁿ ≤ 10⁸:\n\n- n = 18: 324 × 262 144 ≈ 8,5×10⁷ ✓ (≈ 85 ms)\n- n = 19: 361 × 524 288 ≈ 1,9×10⁸ ✗\n\nVậy **n = 18**. Ngân sách 10 giây (10¹⁰ phép): n = 24 cho 576 × 16 777 216 ≈ 9,7×10⁹ ✓, n = 25 cho 2,1×10¹⁰ ✗, nên **n = 24, tăng thêm 6**. Giải thích: gấp 100 lần công tương ứng 2^6,64 nên chỉ thêm được khoảng 6 phần tử (thừa số n² còn tăng nhẹ nên không bù được 0,64) — phần cứng gấp 100 lần chỉ mua 6 phần tử.\n\n(Nếu dùng quy tắc “an toàn” 100 ms ≈ 10⁷ phép thì n = 15, với 10 giây ≈ 10⁹ thì n = 21: vẫn thêm 6.)",
        tieuChi: ["Lập bất đẳng thức n²·2ⁿ ≤ ngân sách phép toán (100 ms ≈ 10⁸ phép ở 10⁹ phép/giây)", "Thử giá trị và kết luận n = 18 (nêu n = 19 vượt ngân sách)", "Nêu ngân sách 10 giây cho n = 24, tức thêm 6 ≈ log₂ 100", "Rút ra: phần cứng gấp 100 lần chỉ thêm vài phần tử — bùng nổ tổ hợp"]
      },
      {
        id: "l2", doKho: 3, ref: "Bài tập 2.3",
        hoi: "Bài cái túi với n = 50, W = 10¹². DP O(nW) có chạy được không? Vét cạn 2⁵⁰ có chạy được không? Đề xuất một hướng thứ ba (gợi ý: *meet in the middle*), mô tả các bước và ước lượng chi phí.",
        goiY: ["Tính cụ thể nW và 2⁵⁰ rồi so với 10⁹ phép/giây.", "Chia 50 món thành hai nửa; mỗi nửa chỉ có 2²⁵ tập con."],
        mau: "- **DP:** nW = 50 × 10¹² = 5×10¹³ phép — không (hàng chục nghìn giây, và bảng DP cũng không nằm vừa bộ nhớ).\n- **Vét cạn:** 2⁵⁰ ≈ 10¹⁵ phép ở 10⁹/giây là khoảng 12 ngày — không.\n- **Meet in the middle:** chia 50 món thành hai nửa 25 món. Liệt kê mọi tập con của mỗi nửa (2²⁵ ≈ 3,4×10⁷ tập), tính (cân nặng, giá trị). Sắp xếp các tập của nửa B theo cân nặng và lưu giá trị lớn nhất tính đến đó (max tiền tố). Với mỗi tập của nửa A có cân nặng a, tìm bằng **tìm kiếm nhị phân** tập của nửa B nặng nhất mà a + b ≤ W, lấy giá trị lớn nhất.\n- **Chi phí:** O(2^(n/2) · n) ≈ 3,4×10⁷ × 25 ≈ 10⁹ phép — cỡ vài giây. Lưu ý bộ nhớ: mỗi nửa cỡ 3,4×10⁷ cặp, vài trăm MB; sinh danh sách đã sắp bằng cách trộn (merge) thay vì sort được O(2^(n/2)) và tiết kiệm thời gian.",
        tieuChi: ["Nêu DP cỡ 5×10¹³ phép nên không chạy nổi", "Nêu vét cạn 2⁵⁰ ≈ 10¹⁵ phép (cỡ nhiều ngày) nên không chạy nổi", "Mô tả đúng meet in the middle: chia đôi, liệt kê mỗi nửa 2²⁵ tập, sắp xếp một nửa rồi ghép bằng tìm kiếm nhị phân hoặc hai con trỏ", "Ước lượng chi phí cỡ O(2^(n/2)) (nhân thêm n nếu dùng sort/nhị phân) thay vì O(2ⁿ)"]
      },
      {
        id: "l3", doKho: 2, ref: "Bài tập 2.4",
        hoi: "Trong đề thi thật, mỗi ngày phục vụ tối đa 12 ngôi nhà (720/60 = 12). Nếu đã biết **tập** 12 ngôi nhà của một ngày, tìm **thứ tự tối ưu** bằng Held–Karp tốn bao nhiêu phép? Có kịp 100 ms không? Nếu phải làm cho cả 31 ngày, và mỗi ngày gọi 3 lần, thì sao?",
        goiY: ["Thay n = 12 vào n²·2ⁿ.", "Nhân số lần gọi rồi so với 100 ms (≈ 10⁸ phép)."],
        mau: "Một ngày: n²·2ⁿ = 144 × 4 096 = **589 824 phép ≈ 0,6 ms** ở 10⁹ phép/giây — kịp 100 ms với dư rất lớn.\n\nCho 31 ngày: 31 × 0,6 ≈ 18 ms; nếu mỗi ngày gọi 3 lần thì 93 lần ≈ **55 ms** — vừa 100 ms nhưng sát, nên chỉ nên dùng cho những ngày quan trọng hoặc không gọi trong mọi vòng lặp.\n\nĐây là ý tưởng nền của **matheuristic** (Bài 16): heuristic quyết định *chia việc thế nào*, thuật toán chính xác lo *làm tối ưu từng phần* — khả thi vì bài lớn tách được thành các bài con cỡ 12–15.",
        tieuChi: ["Tính đúng n²·2ⁿ = 144 × 4 096 = 589 824 phép (≈ 0,6 ms)", "Kết luận một ngày kịp 100 ms với dư rất lớn", "Nhân số ngày và số lần gọi (≈ 18 ms hoặc ≈ 55 ms) và nhận xét độ sát ngân sách", "Nêu ý tưởng matheuristic: heuristic chia việc, thuật toán chính xác tối ưu từng phần"]
      },
      {
        id: "l4", doKho: 2, ref: "§6.1",
        hoi: "Chọn con đường (chính xác / xấp xỉ có bảo chứng / heuristic) và lập luận cho ba tình huống: (a) xếp tuyến cho n = 16 điểm, chạy mỗi đêm một lần và có 5 phút; (b) n = 300 đơn, mỗi lần chạy 100 ms, chỉ cần điểm cao như đề thi marathon; (c) hệ thống kiểm định phải ký cam kết bằng văn bản “không tệ hơn 1,5 lần tối ưu”.",
        goiY: ["Đối chiếu với bảng quyết định ở §6.1: n, thời gian, có cần bảo chứng không.", "Trước khi viết heuristic hãy hỏi: bài có cấu trúc đặc biệt không?"],
        mau: "- **(a) Chính xác.** n = 16 ≤ 20 và có tới 5 phút: Held–Karp (16²·2¹⁶ ≈ 1,7×10⁷ phép, cỡ 17 ms) hoặc MIP solver nếu có ràng buộc phức tạp thêm. Không có lý do dùng heuristic.\n- **(b) Heuristic.** n lớn, ngân sách mili-giây, chỉ cần điểm cao — đúng đất của heuristic (và 2ⁿ, n! đều bất khả thi).\n- **(c) Xấp xỉ có bảo chứng.** Cam kết bằng văn bản cần một **định lý** đúng với mọi dữ liệu (ví dụ Christofides cho TSP với bất đẳng thức tam giác: không tệ hơn 1,5 lần). Đây là trường hợp bảo chứng đáng giá hơn mọi phần trăm.\n\nThói quen tốt đi kèm: dành 10 phút hỏi “bài có cấu trúc đặc biệt không?” (luồng, ghép cặp, cây) — nếu có thì thuật toán chính xác luôn thắng heuristic.",
        tieuChi: ["(a) chọn chính xác, nêu n ≤ 20 và thời gian dư dả", "(b) chọn heuristic, nêu n lớn, ngân sách mili-giây, chỉ cần điểm cao", "(c) chọn xấp xỉ có bảo chứng, nêu lý do là phải ký cam kết (trường hợp xấu nhất)", "Nhắc kiểm tra cấu trúc đặc biệt (luồng, ghép cặp, cây) trước khi viết heuristic"]
      }
    ],

    lab: [
      {
        id: "dem-khong-gian",
        ten: "Đếm không gian nghiệm bằng logarit",
        doKho: 1,
        ref: "§2.2, §3, §7.3, Bài tập 2.1",
        de: "Quy tắc 5 giây của Bài 2: việc đầu tiên khi đọc đề tối ưu là **đếm |S|**, rồi lấy `log₁₀|S| − 9` ra số mũ của giây. Vấn đề: `|S|` thường khổng lồ — `120!` đã cỡ 10¹⁹⁸, `n!` tràn `long long` từ n = 21 và tràn cả `double` từ n = 171. Cách làm của bài (§7.3): **cộng dồn logarit** thay vì nhân số nguyên.\n\n" +
            "Bạn nhận `q` truy vấn `ma a b` thuộc sáu họ (xem định dạng): tập con 2ᵃ, hoán vị a!, chu trình TSP (a−1)!/2, chọn rồi sắp thứ tự mọi độ dài, chọn rồi sắp thứ tự tối đa `b` phần tử, gán nhãn bᵃ. Với mỗi truy vấn in ra **log₁₀|S|** (ít nhất 3 chữ số thập phân, sai số cho phép ±0,001). Chấm trên 10 bộ dữ liệu, mức đạt chỉ có một: đúng cả 10.\n\n" +
            "Gợi ý chính: `log₁₀ n! = Σ log₁₀ i`. Với tổng `Σ n!/(n−k)!` hãy tính logarit của từng số hạng rồi cộng bằng *log-sum-exp*: `m + log₁₀(Σ 10^(tₖ − m))` với `m` là số hạng lớn nhất (để không tràn).\n\n" +
            "Hãy thử cả hai biến thể dữ liệu. Với *n nhỏ* tính thẳng bằng số nguyên vẫn qua; với *n lớn* thì không — bộ chấm sẽ cho bạn thấy `Infinity`. **Suy ngẫm:** thử truy vấn `4 120 0` (P1 với n = 120, §2.1 ghi cỡ 10²⁰⁰) — con số chính xác là bao nhiêu, và vì sao `Σ n!/(n−k)!` chỉ lớn hơn `n!` khoảng 2,7 lần (hai số hạng cuối bằng nhau)?",
        vanDe: "b02-dem-khong-gian",
        tham: { kich: "lon" },
        bienThe: [
          { ten: "n lớn (đến 400): n! tràn cả int64 lẫn double", tham: { kich: "lon" } },
          { ten: "n nhỏ (≤ 20): tính thẳng bằng số nguyên vẫn được", tham: { kich: "nho" } }
        ],
        soTest: 10,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào : dòng 1 là q; rồi q dòng "ma a b".
//   ma = 1: tập con 2^a · 2: hoán vị a! · 3: chu trình TSP (a-1)!/2
//   ma = 4: chọn+sắp thứ tự mọi độ dài, tổng k=0..a của a!/(a-k)!
//   ma = 5: chọn+sắp thứ tự tối đa b phần tử, tổng k=0..b của a!/(a-k)!
//   ma = 6: gán a đối tượng vào b nhóm, b^a
// Đầu ra  : q dòng, mỗi dòng là log10 |S| (sai số cho phép 0,001).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const q = t[0];

// lf[n] = log10(n!) — cộng dồn logarit, đừng nhân số nguyên
const lf = [0];
for (let i = 1; i <= 500; i++) lf.push(lf[i - 1] + Math.log10(i));

for (let i = 0; i < q; i++) {
  const ma = t[1 + 3 * i], a = t[2 + 3 * i], b = t[3 + 3 * i];
  let kq = 0;
  // TODO: tính log10|S| theo ma. Với ma = 4, 5 hãy dùng log-sum-exp:
  //       m + log10( tổng 10^(t_k - m) ), m là số hạng t_k lớn nhất, t_k = lf[a] - lf[a-k].
  print(kq.toFixed(4));
}
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int q;
    scanf("%d", &q);
    // lf[n] = log10(n!) — cộng dồn logarit, đừng nhân số nguyên
    vector<double> lf(501, 0.0);
    for (int i = 1; i <= 500; i++) lf[i] = lf[i - 1] + log10((double)i);

    while (q--) {
        int ma, a, b;
        scanf("%d %d %d", &ma, &a, &b);
        double kq = 0;
        // TODO: tính log10|S| theo ma (1: 2^a, 2: a!, 3: (a-1)!/2, 4 và 5: tổng Sigma a!/(a-k)!, 6: b^a).
        //       Với ma = 4, 5 hãy dùng log-sum-exp: m + log10( tổng 10^(t_k - m) ), t_k = lf[a] - lf[a-k].
        printf("%.4f\n", kq);
    }
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const q = t[0];
const lf = [0];                                   // lf[n] = log10(n!)
for (let i = 1; i <= 500; i++) lf.push(lf[i - 1] + Math.log10(i));
const lg2 = Math.log10(2);

for (let i = 0; i < q; i++) {
  const ma = t[1 + 3 * i], a = t[2 + 3 * i], b = t[3 + 3 * i];
  let kq;
  if (ma === 1) kq = a * lg2;                     // 2^a
  else if (ma === 2) kq = lf[a];                  // a!
  else if (ma === 3) kq = lf[a - 1] - lg2;        // (a-1)!/2
  else if (ma === 6) kq = a * Math.log10(b);      // b^a
  else {                                          // 4 và 5: Σ_k a!/(a-k)! bằng log-sum-exp
    const kMax = ma === 4 ? a : b;
    const ts = [];
    for (let k = 0; k <= kMax; k++) ts.push(lf[a] - lf[a - k]);
    const m = Math.max(...ts);                    // số hạng lớn nhất: trừ ra để không tràn
    let s = 0;
    for (const v of ts) s += Math.pow(10, v - m);
    kq = m + Math.log10(s);
  }
  print(kq.toFixed(4));
}
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int q;
    scanf("%d", &q);
    vector<double> lf(501, 0.0);                  // lf[n] = log10(n!)
    for (int i = 1; i <= 500; i++) lf[i] = lf[i - 1] + log10((double)i);
    const double lg2 = log10(2.0);

    while (q--) {
        int ma, a, b;
        scanf("%d %d %d", &ma, &a, &b);
        double kq;
        if (ma == 1) kq = a * lg2;                // 2^a
        else if (ma == 2) kq = lf[a];             // a!
        else if (ma == 3) kq = lf[a - 1] - lg2;   // (a-1)!/2
        else if (ma == 6) kq = a * log10((double)b);   // b^a
        else {                                    // 4 và 5: tổng a!/(a-k)! bằng log-sum-exp
            int kMax = (ma == 4) ? a : b;
            vector<double> ts;
            for (int k = 0; k <= kMax; k++) ts.push_back(lf[a] - lf[a - k]);
            double m = *max_element(ts.begin(), ts.end());   // số hạng lớn nhất: trừ ra để không tràn
            double s = 0;
            for (double v : ts) s += pow(10.0, v - m);
            kq = m + log10(s);
        }
        printf("%.4f\n", kq);
    }
    return 0;
}
`
        },
        goiY: [
          "Đừng tính a! rồi lấy log: a! tràn từ a = 171 (double) hoặc 21 (long long). Hãy cộng dồn `lf[n] = lf[n−1] + log10(n)` một lần cho mọi n, rồi `log10(a!) = lf[a]`.",
          "Các họ đơn giản: 2ᵃ → `a·log10(2)`; bᵃ → `a·log10(b)`; chu trình TSP (a−1)!/2 → `lf[a−1] − log10(2)`.",
          "Với tổng Σₖ a!/(a−k)!: số hạng thứ k có logarit `tₖ = lf[a] − lf[a−k]`. Gọi `m = max tₖ`, kết quả là `m + log10(Σ 10^(tₖ − m))` — mỗi số hạng sau khi trừ `m` nằm trong (0, 1] nên không tràn."
        ]
      },
      {
        id: "meet-in-the-middle",
        ten: "Meet in the middle cho subset-sum (n = 38)",
        doKho: 3,
        ref: "§4.2, §6, Bài tập 2.3",
        de: "Cho `n` số nguyên dương `a₁ … aₙ` (mỗi số cỡ 10¹²) và mức trần `T` cỡ 10¹⁴. Tìm **tổng lớn nhất của một tập con có tổng không vượt quá `T`** — cái túi với `p = w` (subset-sum).\n\n" +
            "Với `n = 38`, hai cách quen thuộc đều hỏng: **vét cạn** 2³⁸ ≈ 2,7×10¹¹ tập con là cỡ 4,6 phút ở 10⁹ phép/giây (và còn nhân với chi phí mỗi tập); **DP** O(n·T) cần bảng cỡ 10¹⁴ ô (§4.2, “giả đa thức”). Hướng thứ ba của bài tập 2.3 là *meet in the middle*: chia dãy làm đôi, liệt kê mọi tổng con của từng nửa (2¹⁹ ≈ 5×10⁵ mỗi nửa), rồi **ghép** hai nửa bằng sắp xếp + hai con trỏ (hoặc tìm nhị phân). Chi phí O(2^(n/2)) thay vì O(2ⁿ).\n\n" +
            "In ra một số nguyên: tổng lớn nhất ≤ `T`. Chấm trên 5 bộ dữ liệu, mỗi test giới hạn 3 giây; mức đạt chỉ có một: đúng cả 5.\n\n" +
            "Đổi sang các biến thể để thấy ranh giới: *n = 24* (vét cạn 2²⁴ ≈ 1,7×10⁷ còn kịp), *n = 32* (2³² ≈ 4×10⁹ — vét cạn đã quá giờ), *n = 38*. **Suy ngẫm:** nếu thêm 2 phần tử nữa, thời gian của meet in the middle nhân lên bao nhiêu lần, so với vét cạn? Và vì sao đề cố ý chọn số lớn cỡ 10¹² chứ không phải số nhỏ?",
        vanDe: "b02-meet-in-middle",
        tham: { n: 38 },
        bienThe: [
          { ten: "n = 38 (bắt buộc chia đôi)", tham: { n: 38 } },
          { ten: "n = 32 (vét cạn 2³² đã quá giờ)", tham: { n: 32 } },
          { ten: "n = 24 (vét cạn 2²⁴ còn kịp)", tham: { n: 24 } }
        ],
        soTest: 5,
        gioiHanMs: 3000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào : "n T", rồi n số nguyên dương a_1 … a_n (mỗi số cỡ 1e12; tổng cỡ 1e14 vẫn chính xác trong double).
// Đầu ra  : tổng lớn nhất của một tập con có tổng <= T.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1];
const a = t.slice(2, 2 + n);

let best = 0;
// TODO: chia a làm hai nửa. Liệt kê mọi tổng con (<= T) của từng nửa, rồi ghép hai nửa
//       (sắp xếp một nửa + hai con trỏ / tìm nhị phân) để tìm tổng lớn nhất <= T.

print(best);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    long long T;
    scanf("%d %lld", &n, &T);
    vector<long long> a(n);
    for (int i = 0; i < n; i++) scanf("%lld", &a[i]);

    long long best = 0;
    // TODO: chia a làm hai nửa. Liệt kê mọi tổng con (<= T) của từng nửa, rồi ghép hai nửa
    //       (sắp xếp một nửa + hai con trỏ / tìm nhị phân) để tìm tổng lớn nhất <= T.

    printf("%lld\n", best);
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1];
const a = t.slice(2, 2 + n);

// Mọi tổng con <= cap của a[lo..hi), đã sắp tăng — sinh bằng cách TRỘN, không cần sort:
// thêm phần tử v thì trộn "danh sách cũ" với "danh sách cũ + v" (cả hai đều đã sắp).
function tongCon(lo, hi, cap) {
  const cho = 1 << (hi - lo);
  let cur = new Float64Array(cho), nxt = new Float64Array(cho), m = 1;
  for (let i = lo; i < hi; i++) {
    const v = a[i];
    let e = m, x = 0, y = 0, k = 0;
    while (e > 0 && cur[e - 1] + v > cap) e--;     // chỉ cur[0..e) cộng thêm v mà vẫn <= T
    while (x < m && y < e) {                       // trộn hai dãy đã sắp: "không lấy v" và "lấy v"
      const bv = cur[y] + v;
      if (cur[x] <= bv) nxt[k++] = cur[x++]; else { nxt[k++] = bv; y++; }
    }
    while (x < m) nxt[k++] = cur[x++];
    while (y < e) nxt[k++] = cur[y++] + v;
    const tmp = cur; cur = nxt; nxt = tmp; m = k;
  }
  return cur.subarray(0, m);
}

const h = n >> 1;
const L = tongCon(0, h, T), R = tongCon(h, n, T);
let best = 0, j = R.length - 1;
for (let i = 0; i < L.length; i++) {              // L tăng dần ⇒ con trỏ j chỉ lùi
  while (j >= 0 && L[i] + R[j] > T) j--;
  if (j < 0) break;
  if (L[i] + R[j] > best) best = L[i] + R[j];
}
print(best);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

// Mọi tổng con <= cap của a[lo..hi), đã sắp tăng — sinh bằng cách TRỘN, không cần sort.
static vector<long long> tongCon(const vector<long long>& a, int lo, int hi, long long cap) {
    vector<long long> cur(1, 0), nxt;
    for (int i = lo; i < hi; i++) {
        nxt.clear();
        nxt.reserve(cur.size() * 2);
        size_t x = 0, y = 0, m = cur.size();
        while (x < m || y < m) {
            long long bv = y < m ? cur[y] + a[i] : LLONG_MAX;
            if (bv > cap) y = m;                 // phần còn lại của nhánh "lấy a[i]" đều vượt T
            if (x < m && (y >= m || cur[x] <= bv)) nxt.push_back(cur[x++]);
            else if (y < m) { nxt.push_back(bv); y++; }
        }
        cur.swap(nxt);
    }
    return cur;
}

int main() {
    int n;
    long long T;
    scanf("%d %lld", &n, &T);
    vector<long long> a(n);
    for (int i = 0; i < n; i++) scanf("%lld", &a[i]);

    int h = n / 2;
    vector<long long> L = tongCon(a, 0, h, T), R = tongCon(a, h, n, T);
    long long best = 0;
    int j = (int)R.size() - 1;
    for (size_t i = 0; i < L.size(); i++) {      // L tăng dần ⇒ con trỏ j chỉ lùi
        while (j >= 0 && L[i] + R[j] > T) j--;
        if (j < 0) break;
        best = max(best, L[i] + R[j]);
    }
    printf("%lld\n", best);
    return 0;
}
`
        },
        goiY: [
          "Chia dãy thành nửa trái `a[0..n/2)` và nửa phải `a[n/2..n)`. Mỗi nửa chỉ có khoảng 2¹⁹ ≈ 5×10⁵ tổng con khi n = 38 — liệt kê được trong một nốt nhạc.",
          "Với mỗi tổng `s` của nửa trái, bạn cần tổng lớn nhất `u` của nửa phải sao cho `s + u ≤ T`. Sắp xếp danh sách nửa phải rồi dùng tìm nhị phân, hoặc sắp cả hai và để con trỏ nửa phải chỉ lùi khi `s` tăng dần.",
          "Tránh `sort` trên hàng triệu phần tử: sinh danh sách tổng con đã sắp bằng cách trộn — thêm từng phần tử `v`, trộn danh sách cũ với danh sách cũ cộng `v` (cả hai đều đã sắp), bỏ các tổng > T. Tổng cỡ 4×10¹⁴ vẫn chính xác trong `double` (< 2⁵³) và `long long`."
        ]
      }
    ]
  });
})();
