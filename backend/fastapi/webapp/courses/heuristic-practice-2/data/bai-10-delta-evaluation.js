/* Thực hành — Bài 10: Đánh giá tăng dần (delta evaluation).
   Bài toán tự dựng: b10-delta-bon-toan-tu (tuDapAn) — tính Δ thời gian của 2-opt, Or-opt, chèn, bỏ trên tuyến mở có kho.
   Chân lý của bộ chấm là chính phép "tính lại từ đầu" (§4.2): dựng tuyến mới rồi trừ hai tổng thời gian. */
(function () {
  var TI = TH.tienIch, VD = TH.vande;

  function kHopLe(m, i, L) {                 /* các vị trí k cho phép của nước Or-opt (i, L) */
    var a = [];
    for (var k = 0; k <= m; k++) if (k <= i - 1 || k >= i + L + 1) a.push(k);
    return a;
  }

  function sinh(seed, tham) {
    tham = tham || {};
    var r = TI.rng(seed), m = tham.m || 12, n = tham.n || 24, nq = tham.nq || 60, loai = tham.loai || "tat-ca";
    var x = [], y = [], s = [], i;
    for (i = 0; i < n; i++) { x.push(r.khoang(0, 99)); y.push(r.khoang(0, 99)); s.push(r.khoang(5, 30)); }
    var idx = [];
    for (i = 0; i < n; i++) idx.push(i);
    idx = TI.tron(idx, r);
    var q = idx.slice(0, m), chua = idx.slice(m);
    var kieu = loai === "2opt" ? ["2opt"] : loai === "or" ? ["or"] : loai === "chen-bo" ? ["chen", "bo"] : ["2opt", "or", "chen", "bo"];
    var dsq = [];
    function coKieu(t) { return kieu.indexOf(t) >= 0; }
    function thuOr(i0, L, k) { if (i0 >= 0 && i0 + L <= m && L >= 1 && kHopLe(m, i0, L).indexOf(k) >= 0) dsq.push({ t: "or", i: i0, L: L, k: k }); }
    /* Các truy vấn ở biên — luôn có mặt (nguồn bug số một, §10). */
    if (coKieu("2opt")) {
      [[0, m - 1], [0, 1], [m - 2, m - 1], [1, m - 1], [0, m - 2], [1, 2]].forEach(function (p) {
        if (p[0] >= 0 && p[0] < p[1] && p[1] <= m - 1) dsq.push({ t: "2opt", i: p[0], j: p[1] });
      });
    }
    if (coKieu("or")) {
      thuOr(0, 1, m); thuOr(0, 3, m); thuOr(0, 2, m); thuOr(0, 1, 2);
      thuOr(m - 1, 1, 0); thuOr(m - 2, 2, 0); thuOr(m - 3, 3, 0); thuOr(m - 2, 2, m - 4 > 0 ? m - 4 : 0);
      thuOr(1, 2, 0); thuOr(2, 1, 0);
    }
    if (coKieu("chen")) { dsq.push({ t: "chen", u: chua[0], k: 0 }); dsq.push({ t: "chen", u: chua[1], k: m }); dsq.push({ t: "chen", u: chua[2], k: 1 }); }
    if (coKieu("bo")) { dsq.push({ t: "bo", k: 0 }); dsq.push({ t: "bo", k: m - 1 }); dsq.push({ t: "bo", k: 1 }); }
    /* Phần còn lại: ngẫu nhiên. */
    var guard = 0;
    while (dsq.length < nq && guard++ < 5000) {
      var t = kieu[r.int(kieu.length)];
      if (t === "2opt") { var a = r.int(m - 1), b = r.khoang(a + 1, m - 1); dsq.push({ t: "2opt", i: a, j: b }); }
      else if (t === "or") {
        var L = r.khoang(1, Math.min(3, m - 1)), i0 = r.khoang(0, m - L), ks = kHopLe(m, i0, L);
        if (ks.length) dsq.push({ t: "or", i: i0, L: L, k: ks[r.int(ks.length)] });
      }
      else if (t === "chen") dsq.push({ t: "chen", u: chua[r.int(chua.length)], k: r.khoang(0, m) });
      else dsq.push({ t: "bo", k: r.int(m) });
    }
    return { m: m, n: n, kx: 50, ky: 50, x: x, y: y, s: s, q: q, qs: TI.tron(dsq, r) };
  }

  function viet(inst) {
    var o = inst.m + " " + inst.n + " " + inst.qs.length + "\n" + inst.kx + " " + inst.ky + "\n", i;
    for (i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + " " + inst.s[i] + "\n";
    o += inst.q.join(" ") + "\n";
    inst.qs.forEach(function (c) {
      o += c.t === "2opt" ? "2opt " + c.i + " " + c.j : c.t === "or" ? "or " + c.i + " " + c.L + " " + c.k : c.t === "chen" ? "chen " + c.u + " " + c.k : "bo " + c.k;
      o += "\n";
    });
    return o;
  }

  function thoiGian(inst, r) {               /* tính lại từ đầu */
    var tong = 0, px = inst.kx, py = inst.ky;
    r.forEach(function (v) { tong += Math.abs(inst.x[v] - px) + Math.abs(inst.y[v] - py) + inst.s[v]; px = inst.x[v]; py = inst.y[v]; });
    return tong;
  }
  function apDung(inst, c) {
    var q = inst.q.slice(), l, h, tg;
    if (c.t === "2opt") { for (l = c.i, h = c.j; l < h; l++, h--) { tg = q[l]; q[l] = q[h]; q[h] = tg; } return q; }
    if (c.t === "or") {
      var seg = q.slice(c.i, c.i + c.L), rest = q.slice(0, c.i).concat(q.slice(c.i + c.L));
      var pos = c.k <= c.i - 1 ? c.k : c.k - c.L;
      return rest.slice(0, pos).concat(seg, rest.slice(pos));
    }
    if (c.t === "chen") return q.slice(0, c.k).concat([c.u], q.slice(c.k));
    return q.slice(0, c.k).concat(q.slice(c.k + 1));
  }

  VD.dangKy("b10-delta-bon-toan-tu", VD.tuDapAn({
    sinh: sinh,
    viet: viet,
    giai: function (inst) {
      var goc = thoiGian(inst, inst.q);
      return inst.qs.map(function (c) { return thoiGian(inst, apDung(inst, c)) - goc; });
    },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `m n nq`. Dòng 2: toạ độ kho `kx ky`. Tiếp theo `n` dòng `x y s` — toạ độ và thời gian giao của đơn `0..n−1`. Một dòng `m` chỉ số: tuyến `q[0..m−1]` (đơn đánh số từ 0, đi từ kho, không quay về). Sau đó `nq` dòng truy vấn: `2opt i j` · `or i L k` · `chen u k` · `bo k`.",
      ra: "`nq` số nguyên, mỗi số một dòng: Δ = (thời gian tuyến mới) − (thời gian tuyến cũ) của từng truy vấn, theo đúng thứ tự. Các truy vấn độc lập: không áp dụng nước đi vào tuyến."
    }
  }));
})();

TH.dangKy({
  id: "bai-10-delta-evaluation",

  tomTat: [
    "Nguyên tắc: **không bao giờ tính lại f(x) từ đầu** sau mỗi nước đi — chỉ tính phần thay đổi. Như giỏ siêu thị 1 240 000 − 35 000 + 48 000: hai phép tính, dù giỏ có 50 hay 5 000 món; công sức không phụ thuộc kích thước.",
    "Điều kiện để có delta: hàm mục tiêu **phân rã được** thành tổng các số hạng địa phương (f = Σ chi phí cạnh), nên nước đi chỉ bỏ vài cạnh và thêm vài cạnh. Có thành phần toàn cục (độ lệch chuẩn của tải) thì làm theo thứ tự: duy trì đại lượng phụ (Σx, Σx²) → xấp xỉ → đổi hàm mục tiêu.",
    "Bốn công thức: **2-opt** Δ = d(q[i−1],q[j]) + d(q[i],q[j+1]) − d(q[i−1],q[i]) − d(q[j],q[j+1]); **Or-opt** = Δ_tháo + Δ_gắn; **chèn** Δ = d(q[k−1],j) + d(j,q[k]) − d(q[k−1],q[k]) + s[j]; **bỏ** Δ = d(q[k−1],q[k+1]) − d(q[k−1],q[k]) − d(q[k],q[k+1]) − s[q[k]] (luôn ≤ 0). Trường hợp biên (đầu/cuối tuyến, hai phần tử kề nhau) là nguồn bug số một.",
    "Số liệu (TSP n = 200, cùng 99 500 nước): tính lại 539,7 ms ≈ 184 355 nước/s; có delta 0,5 ms ≈ 213 381 485 nước/s — **nhanh hơn 1 157 lần**, kết quả giống hệt (14 656). Heuristic chạy tới hết ngân sách nên nhanh gấp 1 000 lần = nhiều nước gấp 1 000 lần = điểm cao hơn.",
    "Ngưỡng cần đạt: leo đồi 10⁶, Tabu 10⁷, SA 10⁸ nước/giây. Dưới 10⁶ nước/giây là gần như chắc chắn bạn còn tính lại từ đầu ở đâu đó (hàm đánh giá trong vòng nóng, sao chép nghiệm `tam = q`, cập nhật `pos[]` cả mảng). Đo nước/giây theo n: giảm khi n tăng ⇒ còn O(n) trong vòng nóng.",
    "Hai kỹ thuật khác nhau, **nhân với nhau**: delta làm mỗi nước rẻ hơn (cùng 99 500 nước, nhanh 1 157 lần); danh sách ứng viên làm ít nước hơn (845 thay vì 99 500, chất lượng kém khoảng 1 %). Đừng so tốc độ khi tổng thời gian chỉ 0,03 ms — hãy so tổng thời gian.",
    "Kiểm chứng là **bắt buộc**: với mỗi hàm `delta*` viết ngay hàm đối chiếu với tính lại từ đầu (f_trước + Δ = f_sau) và chạy 10 000 nước ngẫu nhiên, gồm cả nước biên. Viết bản ngây thơ đúng trước, rồi mới viết delta. Delta sai nhỏ không crash, chỉ làm điểm kém đi bí ẩn.",
    "Trôi delta: sai số `double` cộng dồn, delta sai ở biên, áp dụng nước không khớp delta. Chữa: dùng **số nguyên** (đó là lý do khoá chọn Manhattan; nhân mọi thứ lên thành số nguyên), và đồng bộ lại f từ đầu mỗi 65 536 bước — chi phí O(n) chia cho 65 536 bước là không đáng kể."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§1.1",
      hoi: "Một bạn nói: “Tăng tốc bằng delta chỉ là tiện nghi — thuật toán vẫn cho cùng kết quả, chỉ nhanh hơn.” Với heuristic, nhận định này sai ở đâu?",
      chon: [
        "Delta làm thay đổi hàm mục tiêu nên kết quả khác đi",
        "Heuristic chạy tới khi hết ngân sách thời gian, nên tốc độ mua thêm số nước đi trong cùng ngân sách — và nhiều nước đi hơn mua chất lượng nghiệm tốt hơn",
        "Delta giúp thuật toán thoát khỏi cực trị cục bộ",
        "Delta giảm bộ nhớ cần dùng nên chạy được bài lớn hơn"
      ],
      dung: 1,
      giaiThich: "Nhận định chỉ đúng với thuật toán “chạy tới khi xong”. Heuristic không bao giờ xong, nó chạy tới hết ngân sách; tăng tốc 1 000 lần nghĩa là thử được nhiều hơn 1 000 lần số nước trong cùng 100 ms, và điều đó đổi thành điểm cao hơn. Delta cho cùng một giá trị Δ nên không đổi hàm mục tiêu, không giúp thoát cực trị cục bộ (đó là việc của Phần 4) và không liên quan đến bộ nhớ."
    },
    {
      id: "q2", loai: "so", doKho: 2, ref: "§3.1", donVi: "(Δ)",
      hoi: "Tuyến mở `[5, 2, 8, 1, 9]`, kho = 0, khoảng cách d(a, b) = |a − b|, tuyến không quay về kho. Dùng công thức 2-opt (nhớ trường hợp biên) tính Δ của việc đảo đoạn ở các vị trí 2..4 (các phần tử `8, 1, 9`; vị trí đếm từ 0).",
      dapAn: 1, saiSo: 0,
      giaiThich: "Đoạn chạm cuối tuyến nên không có q[j+1]: Δ = d(q₁, q₄) − d(q₁, q₂) = d(2, 9) − d(2, 8) = 7 − 6 = +1. Kiểm bằng tính lại: tuyến mới [5, 2, 9, 1, 8] dài 5 + 3 + 7 + 8 + 7 = 30, tuyến cũ 29. Nếu áp nguyên công thức bốn số hạng bạn sẽ phải đọc q₅ — ngoài mảng."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§3.2", donVi: "(Δ)",
      hoi: "Vẫn tuyến `[5, 2, 8, 1, 9]` (kho = 0, d = |a − b|). Chuyển đoạn `8, 1` (bắt đầu ở vị trí i = 2, dài L = 2) tới đứng ngay trước phần tử ở vị trí k = 1 (tức trước `2`), giữ nguyên chiều. Δ bằng bao nhiêu?",
      dapAn: -6, saiSo: 0,
      giaiThich: "Δ_tháo = d(q₁, q₄) − d(q₁, q₂) − d(q₃, q₄) = d(2, 9) − d(2, 8) − d(1, 9) = 7 − 6 − 8 = −7. Δ_gắn (giữa q₀ = 5 và q₁ = 2) = d(5, 8) + d(1, 2) − d(5, 2) = 3 + 1 − 3 = +1. Tổng Δ = −6. Kiểm: tuyến mới [5, 8, 1, 2, 9] dài 5 + 3 + 7 + 1 + 7 = 23 so với 29."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§3.1, §3.3",
      hoi: "Vì sao công thức Δ của nước **chèn** có thêm số hạng + s[j] (thời gian giao của đơn j), còn công thức của 2-opt thì không?",
      chon: [
        "Vì khoảng cách trong 2-opt tự triệt tiêu thời gian giao nhờ bất đẳng thức tam giác",
        "Vì công thức 2-opt trong tài liệu đã quên số hạng s",
        "Chèn thêm một đơn mới vào tuyến nên thời gian giao của nó được cộng thêm; 2-opt chỉ sắp lại các đơn đã có nên tổng s không đổi, chỉ các cạnh di chuyển đổi",
        "Vì chèn dùng khoảng cách Manhattan còn 2-opt dùng khoảng cách Euclid"
      ],
      dung: 2,
      giaiThich: "Delta chỉ gồm những số hạng thật sự đổi. 2-opt không thêm hay bớt đơn nên Σs giữ nguyên và chỉ các cạnh đổi; chèn đưa một đơn mới vào nên +s[j] (và bỏ thì −s). Bất đẳng thức tam giác không làm s triệt tiêu, công thức 2-opt không “quên” gì, và loại khoảng cách không liên quan tới số hạng s."
    },
    {
      id: "q5", loai: "nhieu", doKho: 3, ref: "§2, §8",
      hoi: "Với một nước đi đổi chỗ hai phần tử, hàm mục tiêu nào dưới đây vẫn cho phép viết delta O(1) (trực tiếp hoặc sau khi duy trì đại lượng phụ trợ)?",
      chon: [
        "Tổng quãng đường của tuyến (tổng chi phí các cạnh)",
        "Tổng lợi ích của các đơn nằm trong tuyến",
        "Độ lệch chuẩn của tải giữa các xe, nếu bạn duy trì sẵn Σx và Σx² của các tải",
        "Thời gian hoàn thành muộn nhất (makespan), khi nước đi nằm giữa lịch trình",
        "Thưởng làm thêm giờ (OT) phụ thuộc ranh giới ngày, khi nước đi nằm giữa lịch trình"
      ],
      dung: [0, 1, 2],
      giaiThich: "Tổng cạnh và tổng lợi ích phân rã thành các số hạng địa phương; độ lệch chuẩn tuy toàn cục nhưng cập nhật được trong O(1) nếu giữ Σx và Σx² (lối thoát số 1 ở §2). Makespan và thưởng OT thì một nước đi ở giữa làm dịch mọi thời điểm/ranh giới ngày phía sau, nên phải tính lại từ điểm thay đổi (O(m) — §8), không có delta O(1)."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§5.3",
      hoi: "Vì sao khoá học chọn khoảng cách Manhattan (số nguyên) ở các bài toán chính thay vì Euclid?",
      chon: [
        "Hàm mục tiêu toàn số nguyên nên cộng/trừ delta chính xác tuyệt đối: điểm lưu trong bộ nhớ không thể trôi dần khỏi điểm thật",
        "Vì khoảng cách Manhattan luôn ngắn hơn Euclid nên tuyến luôn ngắn hơn",
        "Vì Manhattan không cần căn bậc hai nên mỗi nước đi nhanh hơn 1 000 lần",
        "Vì delta chỉ áp dụng được với khoảng cách Manhattan"
      ],
      dung: 0,
      giaiThich: "Với số nguyên, phép cộng/trừ chính xác tuyệt đối — cộng dồn một tỉ delta vẫn không sai một đơn vị; với double, mỗi phép cộng làm tròn và sai số cộng dồn. Manhattan thật ra luôn *không ngắn hơn* Euclid; bỏ căn bậc hai chỉ giúp một phần nhỏ, không phải 1 000 lần (con số đó là của delta); và delta dùng được với mọi khoảng cách nếu hàm mục tiêu phân rã được."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§9 (cạm bẫy 2)",
      hoi: "Đoạn mã sau có lỗi gì?\n\n```cpp\nint dt = deltaHaiOpt(a, q, i, j);\nstd::reverse(q.begin() + i, q.begin() + j);\n```",
      chon: [
        "Phải dùng `std::rotate` thay cho `std::reverse` để đảo một đoạn",
        "`deltaHaiOpt` không thể gọi với i và j vì chúng là chỉ số",
        "`reverse` luôn chậm hơn tính lại cả hàm mục tiêu",
        "Delta tính cho đoạn [i..j] gồm cả phần tử j, nhưng `reverse` với `q.begin() + j` không đảo phần tử ở j (phải là `q.begin() + j + 1`) — delta đúng nhưng áp dụng sai nước đi; kiểm chứng sẽ bắt được"
      ],
      dung: 3,
      giaiThich: "`std::reverse(first, last)` đảo nửa mở [first, last), nên muốn đảo cả q[j] phải truyền `q.begin() + j + 1`. Khi quy ước chỉ số của delta và của apply lệch nhau, f lưu trong bộ nhớ trôi dần mà không có crash — hãy viết hai hàm cạnh nhau, cùng quy ước, và chạy kiemTraDelta. `reverse` là đúng công cụ (O(j − i), rất rẻ) và `deltaHaiOpt` gọi với chỉ số là bình thường."
    },
    {
      id: "q8", loai: "so", doKho: 1, ref: "§6.3", donVi: "(giây)",
      hoi: "Simulated Annealing của bạn đo được 4×10⁶ nước/giây. Nó cần 10⁷ nước để cho kết quả tốt. Mất bao nhiêu giây?",
      dapAn: 2.5, saiSo: 0.01,
      giaiThich: "10⁷ / (4×10⁶) = 2,5 giây. Ngưỡng cho SA là 10⁸ nước/giây (khi đó chỉ cần 0,1 giây) — thấp hơn 25 lần, gần như chắc chắn còn tính lại từ đầu ở đâu đó (ví dụ tạo `vector` tạm mỗi bước)."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§6.4",
      hoi: "Bạn đo tốc độ local search ở n = 200, 400, 800 và thấy số nước/giây giảm dần gần tỉ lệ nghịch với n. Điều đó gợi ý gì?",
      chon: [
        "Delta của bạn đã O(1) nhưng máy chậm đi khi n lớn",
        "Trong vòng lặp nóng còn một thứ O(n) — gọi hàm đánh giá toàn bộ, sao chép nghiệm, hoặc cập nhật `pos[]` trên cả mảng",
        "Đó là hiện tượng bình thường: càng nhiều điểm thì mỗi nước càng cần nhiều công",
        "Cần tăng số vòng lặp để bù lại"
      ],
      dung: 1,
      giaiThich: "Nếu delta thật sự O(1) thì số nước/giây gần như không đổi theo n. Nó giảm theo n nghĩa là mỗi nước còn tốn O(n): ba nghi phạm theo thứ tự là lời gọi hàm đánh giá trong vòng trong cùng, phép sao chép nghiệm vô hình (`tam = q`) và cập nhật pos[] trên cả mảng thay vì đoạn bị chạm. Đây là cách chẩn đoán nhanh nhất; tăng vòng lặp không chữa được nguyên nhân."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§4.2",
      hoi: "Cách nào đáng tin nhất để biết hàm delta của bạn đúng?",
      chon: [
        "Đối chiếu với tính lại từ đầu: tính f trước, tính Δ bằng delta, áp dụng nước đi, tính lại f sau và kiểm f_trước + Δ = f_sau — lặp trên hàng nghìn nước ngẫu nhiên, kể cả nước biên",
        "Chạy thuật toán và xem điểm có tăng dần không",
        "Đọc lại công thức và so với tài liệu",
        "Kiểm tra chương trình không crash trên vài test lớn"
      ],
      dung: 0,
      giaiThich: "Delta sai thường không crash và điểm vẫn có thể tăng (vì phần lớn nước vẫn đúng), nên chạy thử, đọc lại công thức hay chỉ xem crash không bắt được lỗi — nó chỉ làm điểm kém đi một cách bí ẩn. Đối chiếu với tính lại từ đầu là phép kiểm duy nhất so được từng nước đi, và phải phủ cả nước ở biên vì đó là nơi bug thường nằm."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 10.1",
      hoi: "Dãy `[5, 2, 8, 1, 9]` với d(a, b) = |a − b|, kho = 0, tuyến mở. Tính bằng tay delta của 2-opt đảo đoạn [1..3] rồi kiểm bằng tính lại từ đầu. Sau đó giải thích vì sao ví dụ này (Δ = 0) là ví dụ **yếu** để kiểm một công thức delta, và nêu nước đi bạn sẽ chọn thêm.",
      goiY: ["Tính tổng ban đầu: 0 → 5 → 2 → 8 → 1 → 9.", "Một công thức sai vẫn có thể cho đúng 0 — vậy nên ưu tiên nước đi có đặc điểm gì?"],
      mau: "Ban đầu: 5 + 3 + 6 + 7 + 8 = 29. Đảo [1..3] cho `[5, 1, 8, 2, 9]`: Δ = d(5,1) + d(2,9) − d(5,2) − d(1,9) = 4 + 7 − 3 − 8 = **0**; tính lại 5 + 4 + 7 + 6 + 7 = 29 ✓.\n\nVí dụ yếu vì (i) Δ = 0: một công thức sai (thiếu hay thừa một cặp số hạng triệt tiêu) vẫn có thể ra 0 và qua; (ii) đoạn nằm giữa tuyến nên không chạm biên — chỗ bug nhiều nhất.\n\nNên thêm: nước có Δ ≠ 0; nước chạm **đầu** tuyến (i = 0, q[−1] là kho) như đảo [0..1] cho Δ = d(0,2) + d(5,8) − d(0,5) − d(2,8) = 2 + 3 − 5 − 6 = −6 (tuyến mới dài 23); nước chạm **cuối** tuyến (j = m − 1, bỏ hai số hạng chứa q[j+1]) như đảo [2..4] cho Δ = d(2,9) − d(2,8) = +1. Và quan trọng hơn: chạy hàng nghìn nước ngẫu nhiên bằng kiemTraDelta chứ không dừng ở vài ví dụ tay.",
      tieuChi: ["Tính đúng Δ = 0 và kiểm bằng tính lại (29 = 29)", "Chỉ ra Δ = 0 là yếu: công thức sai vẫn có thể cho 0, và nước nằm giữa tuyến không chạm biên", "Đề xuất kiểm nước chạm đầu tuyến (i = 0, dùng kho) và chạm cuối tuyến (j = m − 1)", "Nêu cần chạy hàng nghìn nước ngẫu nhiên, không chỉ vài ví dụ tay"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 10.2",
      hoi: "Viết công thức delta cho nước **đổi chỗ hai phần tử** q[i] ↔ q[j] với j > i + 1. Có bao nhiêu cạnh thay đổi? Khi j = i + 1 công thức đổi ra sao? Kiểm bằng ví dụ số trên `[5, 2, 8, 1, 9]` (kho = 0, d = |a − b|) khi đổi vị trí 0 và 3.",
      goiY: ["Liệt kê các cạnh quanh q[i] và q[j] trước và sau khi đổi.", "Với j = i + 1, cạnh giữa q[i] và q[j] còn bị “bỏ” và “thêm” nữa không?"],
      mau: "Với j > i + 1, **bốn cạnh** bị bỏ và bốn cạnh được thêm:\n\nΔ = d(q[i−1],q[j]) + d(q[j],q[i+1]) + d(q[j−1],q[i]) + d(q[i],q[j+1]) − d(q[i−1],q[i]) − d(q[i],q[i+1]) − d(q[j−1],q[j]) − d(q[j],q[j+1])\n\nKhi j = i + 1 (kề nhau) hai cạnh giữa trùng nhau và công thức bốn cạnh **sai**: cạnh (q[i], q[i+1]) giữ nguyên (chỉ đổi chiều), còn lại hai cạnh bỏ và hai cạnh thêm:\n\nΔ = d(q[i−1],q[i+1]) + d(q[i],q[i+2]) − d(q[i−1],q[i]) − d(q[i+1],q[i+2])\n\nVí dụ đổi vị trí 0 và 3 (5 ↔ 1): (d(0,1) + d(1,2) + d(8,5) + d(5,9)) − (d(0,5) + d(5,2) + d(8,1) + d(1,9)) = (1 + 1 + 3 + 4) − (5 + 3 + 7 + 8) = 9 − 23 = **−14**. Kiểm: tuyến mới `[1, 2, 8, 5, 9]` dài 1 + 1 + 6 + 3 + 4 = 15 so với 29 ✓. Nhớ xử lý biên: q[−1] là kho khi i = 0, và không có q[j+1] khi j = m − 1 (bỏ hai số hạng chứa nó).",
      tieuChi: ["Viết đúng bốn cạnh bỏ và bốn cạnh thêm cho j > i + 1", "Nêu khi j = i + 1 công thức bốn cạnh sai; chỉ còn hai cạnh bỏ và hai cạnh thêm (cạnh giữa giữ nguyên)", "Kiểm bằng ví dụ số khớp tính lại (Δ = −14)", "Nhắc xử lý biên: q[−1] là kho khi i = 0, không có q[j+1] khi j = m − 1"]
    },
    {
      id: "l3", doKho: 2, ref: "Bài tập 10.4",
      hoi: "Trong `deltaHaiOpt`, trường hợp j = m − 1 được xử lý riêng. (a) Vì sao? (b) Nếu bỏ nhánh đó, điều gì xảy ra và hàm kiemTraDelta ở §4.2 sẽ thấy gì? (c) Với chu trình kín (TSP) có còn nhánh biên này không?",
      goiY: ["Nghĩ xem q[j + 1] là gì khi j = m − 1 ở một tuyến mở.", "Chu trình kín khác tuyến mở ở chỗ nào về phần tử đứng sau q[m − 1]?"],
      mau: "(a) Tuyến mở không quay về kho: khi j = m − 1 **không có** q[j+1], nên hai số hạng chứa nó biến mất: Δ = d(q[i−1],q[j]) − d(q[i−1],q[i]).\n\n(b) Bỏ nhánh thì chương trình đọc q[m] ngoài mảng: crash hoặc giá trị rác. Nếu thay bằng một “quy ước” sai (ví dụ coi q[m] là kho) thì không crash mà Δ lệch; kiemTraDelta sẽ thấy `trước + dt ≠ sau` ngay ở nước đầu tiên chạm biên và abort. Vì thế phải kiểm cả nước biên, không chỉ nước giữa tuyến.\n\n(c) Chu trình kín quay vòng: q[j+1] = q₀ khi j là phần tử cuối, nên không có nhánh biên; chỉ cần loại cặp (0, n − 1) vì hai cạnh đó kề nhau (chung điểm q₀).",
      tieuChi: ["Giải thích: tuyến mở không có q[j+1] khi j = m − 1, nên bỏ hai số hạng chứa nó", "Nêu hậu quả khi bỏ nhánh (ngoài mảng/giá trị rác hoặc Δ lệch) và kiemTraDelta bắt được ở nước chạm biên", "Phân biệt chu trình kín: q[j+1] quay vòng về q₀ nên không có nhánh biên (chỉ loại cặp (0, n − 1))"]
    },
    {
      id: "l4", doKho: 3, ref: "§5",
      hoi: "Điểm f lưu trong bộ nhớ của bạn (cộng dồn delta) lệch dần khỏi điểm thật sau hàng triệu bước. Nêu ba nguyên nhân thường gặp và cách chữa cho từng cái; rồi giải thích vì sao đồng bộ lại f mỗi 65 536 bước là rẻ.",
      goiY: ["Một nguyên nhân thuộc về kiểu số, một thuộc về công thức, một thuộc về việc áp dụng nước đi.", "O(n) chia cho 65 536 bước thì mỗi bước tốn bao nhiêu?"],
      mau: "1. **Sai số dấu phẩy động:** cộng dồn `double`, mỗi phép cộng làm tròn nên sai số tích luỹ (cỡ √(số phép)·ε). Chữa: dùng **số nguyên** (`long long`) khi hàm mục tiêu cho phép — cộng/trừ chính xác tuyệt đối; hoặc nhân mọi thứ lên thành số nguyên (12,5 phút → 125 đơn vị 1/10 phút).\n2. **Delta sai ở trường hợp biên** (quên i = 0, j = m − 1, hai phần tử kề nhau). Chữa: kiemTraDelta với 10 000 nước ngẫu nhiên có cả nước biên.\n3. **Áp dụng nước đi không khớp delta** (tính delta cho (i, j) nhưng đảo (i, j + 1)). Chữa: viết hàm delta và hàm apply cạnh nhau, cùng quy ước chỉ số.\n\nĐồng bộ lại: tính f từ đầu tốn O(n), làm mỗi 65 536 bước thì mỗi bước chỉ tốn O(n / 65 536) — không đáng kể. Nó còn dùng để **báo động** (nếu f lưu ≠ f thật thì có bug) chứ không chỉ sửa; với delta đúng và số nguyên thì chúng không bao giờ lệch.",
      tieuChi: ["Nêu đủ ba nguyên nhân: dấu phẩy động, delta sai ở biên, áp dụng nước không khớp delta", "Mỗi nguyên nhân có cách chữa tương ứng (số nguyên; kiemTraDelta; viết delta và apply cạnh nhau)", "Giải thích đồng bộ định kỳ rẻ (O(n) chia 65 536 bước) và dùng để phát hiện lệch, không chỉ sửa"]
    }
  ],

  lab: [
    {
      id: "delta-bon-toan-tu",
      ten: "Bốn công thức delta — kể cả trường hợp biên",
      doKho: 3,
      ref: "§3, §4.2, §10",
      de: "Cho một tuyến **mở** gồm `m` đơn (xuất phát từ kho, **không** quay về) trong tổng số `n` đơn. Thời gian của tuyến = Σ (thời gian đi từ điểm trước tới đơn + thời gian giao `s` của đơn); khoảng cách Manhattan, toàn số nguyên. Bạn nhận `nq` truy vấn, mỗi truy vấn mô tả một nước đi; hãy in **Δ = thời gian tuyến mới − thời gian tuyến cũ** (các truy vấn độc lập, không áp dụng nước đi vào tuyến). Chấm trên 8 bộ dữ liệu; mức đạt duy nhất là **đúng mọi Δ trên mọi test**:\n\n" +
          "- `2opt i j` — đảo đoạn `q[i..j]` (0 ≤ i < j ≤ m−1).\n" +
          "- `or i L k` — nhấc đoạn `q[i..i+L−1]` (1 ≤ L ≤ 3), **giữ nguyên chiều**, đặt vào ngay trước phần tử `q[k]` **của tuyến gốc** (k ≤ i−1 hoặc k ≥ i+L+1; `k = m` nghĩa là đặt ở cuối tuyến).\n" +
          "- `chen u k` — chèn đơn `u` (chưa có trong tuyến) vào ngay trước `q[k]` (0 ≤ k ≤ m; `k = m` là cuối tuyến).\n" +
          "- `bo k` — bỏ đơn `q[k]`.\n\n" +
          "Mỗi truy vấn phải tốn **O(1)** — dùng bốn công thức ở §3, **không dựng lại tuyến**. Dữ liệu cố tình có đủ trường hợp biên: đoạn chạm đầu tuyến (kho đóng vai q[−1]), chạm cuối tuyến (không có q[j+1]), chèn/gắn ở đầu hoặc cuối. Thông báo lỗi chỉ cho biết giá trị thứ mấy lệch — hãy làm đúng như §4.2: tự viết hàm tính lại từ đầu (khung đã có `thoiGian`), dựng tuyến mới cho từng truy vấn và đối chiếu để biết công thức nào sai. Các tab biến thể cho phép gỡ lỗi từng toán tử một.",
      vanDe: "b10-delta-bon-toan-tu",
      tham: { loai: "tat-ca", m: 12, n: 24, nq: 60 },
      bienThe: [
        { ten: "Cả bốn toán tử", tham: { loai: "tat-ca", m: 12, n: 24, nq: 60 } },
        { ten: "Chỉ 2-opt", tham: { loai: "2opt", m: 10, n: 20, nq: 40 } },
        { ten: "Chỉ Or-opt", tham: { loai: "or", m: 10, n: 20, nq: 40 } },
        { ten: "Chỉ chèn và bỏ", tham: { loai: "chen-bo", m: 10, n: 20, nq: 40 } },
        { ten: "Tuyến rất ngắn (m = 4) — biên khắc nghiệt", tham: { loai: "tat-ca", m: 4, n: 10, nq: 40 } }
      ],
      soTest: 8,
      gioiHanMs: 1000,
      khoiDau: {
        js: String.raw`// Đầu vào: "m n nq"; "kx ky"; n dòng "x y s"; một dòng m chỉ số (tuyến q, đơn đánh số từ 0); nq dòng truy vấn.
// Đầu ra : nq số nguyên — Δ thời gian của từng truy vấn, mỗi số một dòng.
const t = readInput().split(/\s+/).filter(Boolean);
let ptr = 0;
const m = +t[ptr++], n = +t[ptr++], nq = +t[ptr++];
const kx = +t[ptr++], ky = +t[ptr++];
const x = [], y = [], s = [];
for (let i = 0; i < n; i++) { x.push(+t[ptr++]); y.push(+t[ptr++]); s.push(+t[ptr++]); }
const q = [];
for (let i = 0; i < m; i++) q.push(+t[ptr++]);

// d(u, v): khoảng cách Manhattan; chỉ số -1 nghĩa là kho.
function d(u, v) {
  const ux = u < 0 ? kx : x[u], uy = u < 0 ? ky : y[u];
  const vx = v < 0 ? kx : x[v], vy = v < 0 ? ky : y[v];
  return Math.abs(ux - vx) + Math.abs(uy - vy);
}
// Tính lại thời gian của một tuyến từ đầu — dùng để KIỂM CHỨNG delta của bạn (§4.2).
function thoiGian(r) {
  let tong = 0, cur = -1;
  for (const v of r) { tong += d(cur, v) + s[v]; cur = v; }
  return tong;
}

// Bốn hàm delta: viết công thức §3, mỗi hàm O(1).
// Gợi ý: đặt truoc(k) = k > 0 ? q[k-1] : -1 (đơn đứng trước vị trí k, hoặc kho).
function deltaHaiOpt(i, j) {
  // TODO
  return 0;
}
function deltaOrOpt(i, L, k) {
  // TODO: Δ_tháo + Δ_gắn
  return 0;
}
function deltaChen(u, k) {
  // TODO
  return 0;
}
function deltaBo(k) {
  // TODO
  return 0;
}

for (let c = 0; c < nq; c++) {
  const loai = t[ptr++];
  if (loai === "2opt") { const i = +t[ptr++], j = +t[ptr++]; print(deltaHaiOpt(i, j)); }
  else if (loai === "or") { const i = +t[ptr++], L = +t[ptr++], k = +t[ptr++]; print(deltaOrOpt(i, L, k)); }
  else if (loai === "chen") { const u = +t[ptr++], k = +t[ptr++]; print(deltaChen(u, k)); }
  else { const k = +t[ptr++]; print(deltaBo(k)); }
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean);
let ptr = 0;
const m = +t[ptr++], n = +t[ptr++], nq = +t[ptr++];
const kx = +t[ptr++], ky = +t[ptr++];
const x = [], y = [], s = [];
for (let i = 0; i < n; i++) { x.push(+t[ptr++]); y.push(+t[ptr++]); s.push(+t[ptr++]); }
const q = [];
for (let i = 0; i < m; i++) q.push(+t[ptr++]);

function d(u, v) {
  const ux = u < 0 ? kx : x[u], uy = u < 0 ? ky : y[u];
  const vx = v < 0 ? kx : x[v], vy = v < 0 ? ky : y[v];
  return Math.abs(ux - vx) + Math.abs(uy - vy);
}
const truoc = (k) => (k > 0 ? q[k - 1] : -1);   // đơn đứng trước vị trí k (kho nếu k = 0)

// 2-opt: đảo q[i..j].
function deltaHaiOpt(i, j) {
  const a = truoc(i), A = q[i], B = q[j];
  if (j + 1 < m) {
    const sau = q[j + 1];
    return d(a, B) + d(A, sau) - d(a, A) - d(B, sau);
  }
  return d(a, B) - d(a, A);                        // biên: không có q[j+1]
}
// Or-opt: nhấc q[i..i+L-1], đặt trước q[k] của tuyến gốc.
function deltaOrOpt(i, L, k) {
  const a = truoc(i), dau = q[i], cuoi = q[i + L - 1];
  let thao;
  if (i + L < m) {
    const sau = q[i + L];
    thao = d(a, sau) - d(a, dau) - d(cuoi, sau);
  } else {
    thao = -d(a, dau);                              // đoạn nằm cuối tuyến
  }
  const pk = truoc(k);
  let gan = d(pk, dau);
  if (k < m) gan += d(cuoi, q[k]) - d(pk, q[k]);   // k = m: gắn vào cuối, không có q[k]
  return thao + gan;
}
// Chèn đơn u vào trước vị trí k.
function deltaChen(u, k) {
  const pk = truoc(k);
  let dl = d(pk, u) + s[u];
  if (k < m) dl += d(u, q[k]) - d(pk, q[k]);
  return dl;
}
// Bỏ đơn ở vị trí k.
function deltaBo(k) {
  const pk = truoc(k), v = q[k];
  if (k + 1 < m) {
    const sau = q[k + 1];
    return d(pk, sau) - d(pk, v) - d(v, sau) - s[v];
  }
  return -d(pk, v) - s[v];
}

for (let c = 0; c < nq; c++) {
  const loai = t[ptr++];
  if (loai === "2opt") { const i = +t[ptr++], j = +t[ptr++]; print(deltaHaiOpt(i, j)); }
  else if (loai === "or") { const i = +t[ptr++], L = +t[ptr++], k = +t[ptr++]; print(deltaOrOpt(i, L, k)); }
  else if (loai === "chen") { const u = +t[ptr++], k = +t[ptr++]; print(deltaChen(u, k)); }
  else { const k = +t[ptr++]; print(deltaBo(k)); }
}
`
      },
      goiY: [
        "Đặt `truoc(k) = k > 0 ? q[k-1] : -1` để kho (−1) tự nhiên đóng vai q[−1] — `d(-1, v)` đã tính khoảng cách từ kho. Với 2-opt: nếu j + 1 < m dùng công thức bốn số hạng, ngược lại chỉ còn d(truoc(i), q[j]) − d(truoc(i), q[i]).",
        "Or-opt chia làm hai: **tháo** (nối truoc(i) với q[i+L], nếu có; nếu đoạn nằm cuối tuyến thì chỉ bỏ cạnh vào đoạn) và **gắn** vào giữa truoc(k) và q[k] (nếu k = m thì chỉ thêm cạnh vào đoạn, không có cạnh ra). Thời gian giao s không đổi vì tập đơn không đổi.",
        "Chèn có thêm + s[u]; bỏ có thêm − s[q[k]]. Cả hai đều có nhánh biên: chèn/bỏ ở cuối tuyến (k = m hoặc k = m − 1) không có phần tử đứng sau.",
        "Để gỡ lỗi: viết hàm áp dụng nước đi (dựng mảng mới) và so `thoiGian(moi) − thoiGian(q)` với delta của bạn cho từng truy vấn — in ra `log` những truy vấn lệch."
      ]
    },
    {
      id: "tsp-2opt-delta-toc-do",
      ten: "2-opt có delta O(1): đo tốc độ nước đi mỗi giây",
      doKho: 2,
      ref: "§1, §4.2, §6",
      de: "Bài chu trình ngắn nhất (`tsp`) với **`n = 600`** điểm, khoảng cách Euclid. Cài **leo đồi 2-opt dùng delta O(1)**: với cặp `(i, j)`, Δ = d(a,c) + d(b,d) − d(a,b) − d(c,d), nhận khi Δ < −10⁻⁹ rồi đảo `p[i+1..j]`; lặp tới khi một lượt đầy đủ không đổi gì. Xuất phát từ láng giềng gần nhất (đã có sẵn). Chấm trên 6 bộ dữ liệu, mỗi test tối đa 2 giây.\n\n" +
          "Một lượt quét đầy đủ có n(n−3)/2 = 179 100 cặp và cần vài lượt ⇒ cỡ **10⁶ lần đánh giá**. Nếu mỗi lần bạn **tính lại độ dài cả chu trình** (600 phép cộng và 600 căn bậc hai) thì cỡ **10⁹ phép** — vượt xa giới hạn **2 giây mỗi test** và bài chấm báo “Quá giờ”. Đó chính là bài học của Bài 10: delta không phải tiện nghi, nó là điều kiện để chương trình chạy nổi. (Hãy thử cố tình tính lại để thấy.)\n\n" +
          "**Mức đạt:** hợp lệ trong thời gian → ngắn hơn greedy ít nhất 9 % → bằng leo đồi 2-opt chuẩn của khoá (sai lệch tối đa 1,5 %).\n\n" +
          "Khung có sẵn `daiDayDu(p)` và cờ `KIEM_TRA`. **Bật cờ trước khi chạy thật** để đối chiếu delta với tính lại cho vài nghìn nước đầu (§4.2) và báo lệch qua `log`; tắt khi nộp. Cuối chương trình hãy in số nước/giây ra `log` — bạn đạt ngưỡng 10⁶ nước/giây của leo đồi chưa? Nhớ: tăng tốc đổi thành số nước, số nước đổi thành điểm.",
      vanDe: "tsp",
      tham: { n: 600 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 600 } },
        { ten: "Gom cụm", tham: { n: 600, cum: true } }
      ],
      soTest: 6,
      gioiHanMs: 2000,
      muc: [
        { ten: "Ngắn hơn láng giềng gần nhất ít nhất 9 %", so: "ganNhat", heSo: 1.1 },
        { ten: "Bằng leo đồi 2-opt chuẩn của khoá (sai lệch ≤ 1,5 %)", so: "haiOpt", heSo: 0.985 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là n; rồi n dòng "x y".  Đầu ra: n chỉ số (từ 1) — thứ tự đi của chu trình.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

const D = [];                               // bảng khoảng cách, dựng một lần
for (let i = 0; i < n; i++) {
  D.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const dx = x[i] - x[j], dy = y[i] - y[j];
    D[i][j] = Math.sqrt(dx * dx + dy * dy);
  }
}
function daiDayDu(p) {                      // tính lại từ đầu: O(n) — CHỈ để kiểm chứng, không dùng trong vòng nóng
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}
function daoDoan(p, i, j) {                 // đảo p[i..j], gồm cả hai đầu
  for (; i < j; i++, j--) { const tg = p[i]; p[i] = p[j]; p[j] = tg; }
}

// Tuyến xuất phát: láng giềng gần nhất.
const p = [0];
{
  const dung = new Array(n).fill(false);
  dung[0] = true;
  for (let k = 1; k < n; k++) {
    const c = p[k - 1];
    let tot = -1;
    for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
    dung[tot] = true; p.push(tot);
  }
}

const KIEM_TRA = false;                     // true: đối chiếu delta với tính lại (chậm!) cho 2000 nước đầu
let soDanhGia = 0;
const t0 = now();

// TODO: leo đồi 2-opt với delta O(1) trên bảng D.
//   lặp: doi = false; với i = 0..n-2, j = i+2..n-1 (bỏ cặp i = 0, j = n-1):
//     a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n]
//     delta = D[a][c] + D[b][d] - D[a][b] - D[c][d]; soDanhGia++
//     nếu delta < -1e-9: [nếu KIEM_TRA: f1 = daiDayDu(p)]; daoDoan(p, i+1, j); doi = true;
//                        [nếu KIEM_TRA: f2 = daiDayDu(p); kiểm |f1 + delta - f2| < 1e-6, lệch thì log(...)]
//   cho tới khi một lượt không đổi gì.

const ms = now() - t0;
log("soDanhGia = " + soDanhGia + ", thời gian = " + ms.toFixed(1) + " ms, tốc độ = " + Math.round(soDanhGia / Math.max(ms, 1e-3) * 1000) + " nước/giây");
print(p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;

double daiDayDu(const vector<int>& p) {        // tính lại từ đầu: O(n) — CHỈ để kiểm chứng
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

int main() {
    scanf("%d", &n);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);

    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) {
            double dx = x[i] - x[j], dy = y[i] - y[j];
            D[i][j] = sqrt(dx * dx + dy * dy);
        }

    // Tuyến xuất phát: láng giềng gần nhất.
    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = p.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        p.push_back(tot);
    }

    const bool KIEM_TRA = false;               // true: đối chiếu delta với tính lại (chậm!) cho 2000 nước đầu
    long long soDanhGia = 0;
    auto t0 = chrono::steady_clock::now();

    // TODO: leo đồi 2-opt với delta O(1) trên bảng D.
    //   lặp: doi = false; với i = 0..n-2, j = i+2..n-1 (bỏ cặp i = 0, j = n-1):
    //     a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n]
    //     delta = D[a][c] + D[b][d] - D[a][b] - D[c][d]; soDanhGia++
    //     nếu delta < -1e-9: [nếu KIEM_TRA: f1 = daiDayDu(p)]; reverse(p.begin()+i+1, p.begin()+j+1); doi = true;
    //                        [nếu KIEM_TRA: f2 = daiDayDu(p); kiểm |f1 + delta - f2| < 1e-6, lệch thì in ra stderr]
    //   cho tới khi một lượt không đổi gì.
    (void)KIEM_TRA;

    double ms = chrono::duration<double, milli>(chrono::steady_clock::now() - t0).count();
    fprintf(stderr, "soDanhGia = %lld, thoi gian = %.1f ms, toc do = %.0f nuoc/giay (dai day du = %.1f)\n",
            soDanhGia, ms, soDanhGia / max(ms, 1e-3) * 1000, daiDayDu(p));
    for (int i = 0; i < n; i++) printf("%d%c", p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

const D = [];
for (let i = 0; i < n; i++) {
  D.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const dx = x[i] - x[j], dy = y[i] - y[j];
    D[i][j] = Math.sqrt(dx * dx + dy * dy);
  }
}
function daiDayDu(p) {
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}
function daoDoan(p, i, j) {
  for (; i < j; i++, j--) { const tg = p[i]; p[i] = p[j]; p[j] = tg; }
}

const p = [0];
{
  const dung = new Array(n).fill(false);
  dung[0] = true;
  for (let k = 1; k < n; k++) {
    const c = p[k - 1];
    let tot = -1;
    for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
    dung[tot] = true; p.push(tot);
  }
}

const KIEM_TRA = false;
let soDanhGia = 0, soKiem = 0;
const t0 = now();

let doi = true;
while (doi) {
  doi = false;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
      const delta = D[a][c] + D[b][d] - D[a][b] - D[c][d];      // O(1): bốn tra bảng
      soDanhGia++;
      if (delta < -1e-9) {
        const f1 = KIEM_TRA && soKiem < 2000 ? daiDayDu(p) : 0;
        daoDoan(p, i + 1, j);
        doi = true;
        if (KIEM_TRA && soKiem < 2000) {
          soKiem++;
          if (Math.abs(f1 + delta - daiDayDu(p)) > 1e-6) log("LỆCH DELTA tại i=" + i + " j=" + j);
        }
      }
    }
  }
}

const ms = now() - t0;
log("soDanhGia = " + soDanhGia + ", thời gian = " + ms.toFixed(1) + " ms, tốc độ = " + Math.round(soDanhGia / Math.max(ms, 1e-3) * 1000) + " nước/giây");
print(p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;

double daiDayDu(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

int main() {
    scanf("%d", &n);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);

    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) {
            double dx = x[i] - x[j], dy = y[i] - y[j];
            D[i][j] = sqrt(dx * dx + dy * dy);
        }

    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = p.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        p.push_back(tot);
    }

    const bool KIEM_TRA = false;
    long long soDanhGia = 0, soKiem = 0;
    auto t0 = chrono::steady_clock::now();

    bool doi = true;
    while (doi) {
        doi = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
                double delta = D[a][c] + D[b][d] - D[a][b] - D[c][d];      // O(1): bốn tra bảng
                soDanhGia++;
                if (delta < -1e-9) {
                    double f1 = (KIEM_TRA && soKiem < 2000) ? daiDayDu(p) : 0;
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    doi = true;
                    if (KIEM_TRA && soKiem < 2000) {
                        soKiem++;
                        if (fabs(f1 + delta - daiDayDu(p)) > 1e-6) fprintf(stderr, "LECH DELTA tai i=%d j=%d\n", i, j);
                    }
                }
            }
    }

    double ms = chrono::duration<double, milli>(chrono::steady_clock::now() - t0).count();
    fprintf(stderr, "soDanhGia = %lld, thoi gian = %.1f ms, toc do = %.0f nuoc/giay\n",
            soDanhGia, ms, soDanhGia / max(ms, 1e-3) * 1000);
    for (int i = 0; i < n; i++) printf("%d%c", p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Delta của 2-opt trên chu trình kín (không có trường hợp biên): a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n]; Δ = D[a][c] + D[b][d] − D[a][b] − D[c][d]. Bốn tra bảng, không vòng lặp nào theo n — đó là O(1).",
        "Đừng gọi `daiDayDu` trong vòng nóng. Chỉ gọi nó khi `KIEM_TRA` bật, và chỉ cho vài nghìn nước đầu: so `f_trước + Δ` với `f_sau` — nếu lệch thì công thức hoặc phép đảo của bạn sai quy ước chỉ số (§9, cạm bẫy 2).",
        "Muốn chắc bạn không còn thứ O(n) nào: đo nước/giây rồi đổi n (khoảng 300 so với 600). Nếu tốc độ gần như không đổi thì delta của bạn là O(1) thật; nếu giảm một nửa thì còn một thứ O(n) đang chạy trong vòng nóng (§6.4)."
      ]
    }
  ]
});
