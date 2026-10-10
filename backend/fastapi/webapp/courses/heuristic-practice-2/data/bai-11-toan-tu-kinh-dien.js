/* Thực hành — Bài 11: Bộ toán tử kinh điển (2-opt, Or-opt, swap, relocate, exchange).
   Bài toán tự dựng: b11-dem-lan-can (tuDapAn) — đếm CHÍNH XÁC số tuyến khác nhau mà mỗi toán tử sinh ra từ một tuyến mở. */
(function () {
  var TI = TH.tienIch, VD = TH.vande;

  function sinh(seed, tham) {
    tham = tham || {};
    var r = TI.rng(seed);
    var m = tham.m || r.khoang(tham.mLo || 6, tham.mHi || 25);
    var n = m + r.khoang(3, 12), idx = [], i;
    for (i = 0; i < n; i++) idx.push(i);
    idx = TI.tron(idx, r);
    return { m: m, n: n, q: idx.slice(0, m) };
  }
  function viet(inst) { return inst.m + " " + inst.n + "\n" + inst.q.join(" ") + "\n"; }

  /* Đếm bằng vét cạn: dựng từng lân cận, bỏ trùng bằng Set. */
  function dem(inst) {
    var q = inst.q, m = q.length, n = inst.n, goc = q.join(","), ngoai = [], u, i, j, k, L;
    for (u = 0; u < n; u++) if (q.indexOf(u) < 0) ngoai.push(u);
    function so(sinhRa) {
      var S = {}, c = 0;
      sinhRa(function (r) { var s = r.join(","); if (s !== goc && !S[s]) { S[s] = 1; c++; } });
      return c;
    }
    var haiOpt = so(function (them) {
      for (i = 0; i < m; i++) for (j = i + 1; j < m; j++) {
        var r = q.slice();
        for (var l = i, h = j; l < h; l++, h--) { var t = r[l]; r[l] = r[h]; r[h] = t; }
        them(r);
      }
    });
    var swap = so(function (them) {
      for (i = 0; i < m; i++) for (j = i + 1; j < m; j++) { var r = q.slice(), t = r[i]; r[i] = r[j]; r[j] = t; them(r); }
    });
    function nhacDat(them, Lmax) {
      for (L = 1; L <= Lmax; L++) for (i = 0; i + L <= m; i++) {
        var seg = q.slice(i, i + L), rest = q.slice(0, i).concat(q.slice(i + L));
        for (k = 0; k <= rest.length; k++) them(rest.slice(0, k).concat(seg, rest.slice(k)));
      }
    }
    var relocate = so(function (them) { nhacDat(them, 1); });
    var orOpt = so(function (them) { nhacDat(them, 3); });
    var chen = so(function (them) {
      ngoai.forEach(function (v) { for (k = 0; k <= m; k++) them(q.slice(0, k).concat([v], q.slice(k))); });
    });
    var bo = so(function (them) { for (k = 0; k < m; k++) them(q.slice(0, k).concat(q.slice(k + 1))); });
    var doi = so(function (them) {
      for (i = 0; i < m; i++) {
        var rest = q.slice(0, i).concat(q.slice(i + 1));
        ngoai.forEach(function (v) { for (var p = 0; p <= rest.length; p++) them(rest.slice(0, p).concat([v], rest.slice(p))); });
      }
    });
    return [haiOpt, swap, relocate, orOpt, chen, bo, doi];
  }

  VD.dangKy("b11-dem-lan-can", VD.tuDapAn({
    sinh: sinh,
    viet: viet,
    giai: dem,
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `m n`. Dòng 2: `m` chỉ số **khác nhau** thuộc `0..n−1` — tuyến mở hiện tại (thứ tự đi).",
      ra: "Một dòng **bảy số nguyên**: số tuyến khác nhau, khác tuyến hiện tại, thu được bằng đúng một nước của từng toán tử, theo thứ tự `haiOpt swap relocate orOpt chen bo doi`."
    }
  }));
})();

TH.dangKy({
  id: "bai-11-toan-tu-kinh-dien",

  tomTat: [
    "Không có “toán tử tốt nhất”: mỗi toán tử sửa **một loại lỗi** khác nhau và không cái nào sửa được lỗi của cái khác. Bạn chọn một **bộ** toán tử phủ nhiều loại lỗi — bộ ba tầm thường mà bổ sung nhau thắng một toán tử mạnh đơn độc.",
    "**2-opt** (đảo đoạn) gỡ các chặng bắt chéo, nhưng đảo đoạn đổi chiều đi nên chỉ dùng với khoảng cách đối xứng. **Or-opt** (nhấc 1–3 phần tử liên tiếp sang chỗ khác) sửa cụm lạc chỗ, không đảo chiều nên dùng được cả đồ thị bất đối xứng; **relocate** = Or-opt với L = 1. **Swap** đổi nội dung giữ vị trí: 4 cạnh đổi (hai phần tử kề nhau thì công thức khác — dễ sai).",
    "**Exchange** (bỏ một đơn trong tuyến, thêm một đơn ngoài tuyến), cũng như chèn và bỏ, là những toán tử làm đổi **tập** đơn được chọn. 2-opt, Or-opt, relocate, swap chỉ sắp lại một tập cố định — với bài chọn lọc như P1, thiếu toán tử đổi tập thì 2-opt chạy cả ngày cũng không nhặt lên đơn giá trị cao bị bỏ sót.",
    "Kích thước lân cận (bảng §2.6): 2-opt m²/2, Or-opt (L ≤ 3) ≈ 3m², relocate m², swap m²/2, exchange m²(n − m). Đây là cỡ xấp xỉ bậc cao nhất; đếm chính xác số tuyến *khác nhau* thì nhỏ hơn (ví dụ Or-opt L ≤ 3 giữ chiều: 3m² − 18m + 35 khi m ≥ 5, vì nhiều nước cho cùng một tuyến).",
    "**Danh sách ứng viên:** mỗi điểm chỉ xét K = 8–16 láng giềng gần nhất; dừng sớm bằng `if (D[a][c] >= D[a][b]) break;` nhờ danh sách đã sắp. Điều kiện cần của nước cải thiện là d(a,c) < d(a,b) hoặc d(b,d) < d(c,d). Đo (TSP n = 600, K = 10): nhanh hơn 28,9 lần, kém chất lượng 4,6 % — đáng đổi nếu dùng thời gian tiết kiệm để chạy nhiều lần hay chạy metaheuristic.",
    "Thứ tự toán tử: **VND tuần tự** (chạy toán tử 1 tới hết, rồi toán tử 2, …) nhanh hơn nhiều so với duyệt hợp mọi lân cận mà chất lượng tương đương. Hai quy tắc: rẻ trước đắt sau; giải phóng tài nguyên trước, tiêu thụ sau.",
    "⚠️ Kết quả phản trực giác: trên bài nhiều kỳ (đề gemini), thêm 2-opt + Or-opt giảm quãng đường 20–30 % nhưng điểm **giảm** 6–10 %, vì tuyến chặt làm thời gian dư cuối ngày mất trắng. Đóng gói ngày thắng rút ngắn đường đi cỡ 6,5 : 1 (ước tính; ~2 200 phút chết là số ước lượng). Tối ưu thành phần ≠ tối ưu tổng thể — luôn đo bằng hàm mục tiêu thật.",
    "Cạm bẫy: swap hai phần tử kề nhau (công thức bốn cạnh sai), 2-opt trên đồ thị bất đối xứng, quên cập nhật `pos[]` sau khi đảo đoạn, K quá nhỏ (K = 3 sụt chất lượng mạnh), thêm toán tử “vì sách nói nên có” mà không làm ablation."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "Mở đầu bài",
      hoi: "Vì sao bài này khuyên chọn một **bộ** toán tử thay vì đi tìm “toán tử tốt nhất”?",
      chon: [
        "Vì toán tử mạnh nhất luôn chậm nhất nên phải dùng nhiều toán tử rẻ để thay thế",
        "Vì chạy nhiều toán tử cùng lúc sẽ cho lời giải tối ưu toàn cục",
        "Vì các toán tử luôn cho cùng một kết quả nên dùng cái nào cũng được",
        "Vì mỗi toán tử sửa được một loại lỗi khác nhau và không cái nào sửa được lỗi của cái khác; một bộ bổ sung nhau phủ được nhiều loại lỗi hơn"
      ],
      dung: 3,
      giaiThich: "2-opt gỡ đường cắt nhau, relocate chuyển đơn lạc cụm, swap sửa hai đơn đứng đúng chỗ của nhau — nghiệm kẹt với toán tử này thường vẫn còn nước với toán tử kia. Nhiều toán tử không bảo đảm tối ưu toàn cục (chỉ cho cực trị cục bộ của hợp các lân cận), chúng không luôn cho cùng kết quả (ví dụ §6 chỉ trùng vì đoạn ngắn), và độ mạnh không đồng nghĩa với chậm nhất."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§2.1–2.3",
      hoi: "Tuyến của bạn có hai chặng **cắt nhau** trên bản đồ, và một đơn khác bị đặt nhầm vào cụm xa nó. Cặp toán tử nào sửa lần lượt hai lỗi này?",
      chon: [
        "Relocate sửa đường cắt nhau; 2-opt chuyển đơn lạc cụm",
        "2-opt sửa đường cắt nhau; relocate (hay Or-opt) chuyển đơn lạc cụm",
        "Exchange sửa đường cắt nhau; 2-opt chuyển đơn lạc cụm",
        "Swap sửa cả hai lỗi nên các toán tử khác là thừa"
      ],
      dung: 1,
      giaiThich: "Đảo đoạn là phép gỡ chặng cắt nhau (định lý §2.1: nước 2-opt tương ứng không làm tuyến dài thêm, và ngắn đi hẳn khi bất đẳng thức tam giác xảy ra chặt); nhấc một phần tử sang đúng cụm là việc của relocate/Or-opt. Hoán đổi vai thì sai: 2-opt không dời được một đơn ra xa cụm của nó, relocate không gỡ được hai chặng bắt chéo. Exchange chỉ cần khi phải đổi tập đơn, còn swap chỉ sửa được hai đơn đứng đúng chỗ của nhau."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§2.4, §6", donVi: "(Δ)",
      hoi: "Tuyến mở kho → A → B → C → D → E trên đường thẳng, toạ độ x: kho 0, A 10, B 30, C 20, D 50, E 40 (d = |Δx|; tuyến dài 80). Đổi chỗ A và D (swap). Δ độ dài bằng bao nhiêu? (số dương = dài thêm)",
      dapAn: 40, saiSo: 0,
      giaiThich: "A và D không kề nhau nên bốn cạnh bị bỏ: kho–A (10), A–B (20), C–D (30), D–E (10) = 70; bốn cạnh được thêm: kho–D (50), D–B (20), C–A (10), A–E (30) = 110. Δ = 110 − 70 = +40. Kiểm: tuyến mới kho→D→B→C→A→E dài 50 + 20 + 10 + 10 + 30 = 120 so với 80."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§2.1, §7 (cạm bẫy 2)",
      hoi: "Mạng đường **một chiều**: chi phí đi u → v khác chi phí đi v → u. Nên tránh toán tử nào, và dùng gì thay?",
      chon: [
        "Tránh 2-opt vì đảo đoạn đổi chiều đi của cả đoạn; dùng Or-opt hoặc relocate (không đảo chiều)",
        "Tránh Or-opt vì nó đảo chiều đoạn; dùng 2-opt",
        "Không toán tử nào bị ảnh hưởng vì delta chỉ dùng bốn cạnh",
        "Tránh swap vì swap luôn đổi bốn cạnh"
      ],
      dung: 0,
      giaiThich: "Đảo đoạn [i..j] đi đoạn đó theo chiều ngược lại, nên chi phí cả đoạn đổi nếu d(u,v) ≠ d(v,u): công thức delta bốn cạnh của 2-opt không còn đúng. Or-opt/relocate giữ nguyên chiều các phần tử nên dùng được cho đồ thị bất đối xứng; Or-opt không đảo chiều (đảo chiều chỉ là tuỳ chọn), và swap không đảo chiều gì cả."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§2.5, §8",
      hoi: "Những toán tử nào có thể làm đổi **tập** đơn nằm trong tuyến (không chỉ đổi thứ tự)?",
      chon: [
        "Exchange: bỏ một đơn trong tuyến, thêm một đơn ngoài tuyến",
        "Chèn một đơn chưa dùng vào tuyến",
        "Bỏ một đơn khỏi tuyến",
        "2-opt",
        "Or-opt",
        "Swap hai phần tử trong tuyến"
      ],
      dung: [0, 1, 2],
      giaiThich: "Chỉ những toán tử đưa đơn vào hoặc ra khỏi tuyến mới đổi được tập: exchange (một nước bỏ + thêm), chèn và bỏ (hai nửa của exchange). 2-opt, Or-opt, relocate và swap chỉ sắp lại các đơn đã có nên tập không đổi — bốn toán tử này không thể làm nghiệm tốt hơn quá một mức nếu heuristic xây dựng đã chọn sai tập (bài chọn lọc như P1)."
    },
    {
      id: "q6", loai: "so", doKho: 2, ref: "§3.1–3.2", donVi: "(lần)",
      hoi: "2-opt đầy đủ trên n = 1 000 điểm xét C(1000, 2) = 499 500 cặp mỗi lượt duyệt. Với danh sách ứng viên K = 10, mỗi điểm chỉ xét tối đa 10 láng giềng nên tối đa 10 000 cặp. Số cặp phải xét giảm khoảng bao nhiêu lần?",
      dapAn: 50, saiSo: 1,
      giaiThich: "499 500 / 10 000 ≈ 49,95 ≈ 50 lần (và thực tế còn ít hơn nhờ dừng sớm khi D[a][c] ≥ D[a][b]). Con số này chỉ đếm cặp: thời gian đo được ở TSP n = 600, K = 10 là nhanh hơn 28,9 lần, vì thời gian chạy còn gồm cả phần còn lại của thuật toán."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§4.1–4.2",
      hoi: "Trên bài nhiều kỳ (mỗi ngày 720 phút, thời gian dư cuối ngày mất trắng), thêm 2-opt + Or-opt làm quãng đường giảm 20–30 % nhưng điểm giảm 6–10 %. Cơ chế chính là gì?",
      chon: [
        "2-opt có lỗi cài đặt làm nghiệm không hợp lệ",
        "Quãng đường ngắn hơn luôn làm giảm điểm trong mọi bài toán",
        "Tuyến chặt hơn làm các nhà liên tiếp luôn gần nhau; cuối ngày không còn nhà nào vừa khít phần thời gian dư nên phần đó chết hoàn toàn — mất nhiều hơn phần quãng đường tiết kiệm được (tỉ giá ước tính cỡ 6,5 : 1)",
        "2-opt làm mất khả năng đổi tập đơn được chọn"
      ],
      dung: 2,
      giaiThich: "Ở tuyến “lỏng” còn nhà cách ~15 phút nên cuối ngày chọn được một nhà vừa khít để lấp đầy; ở tuyến “chặt” nhà kế tiếp chỉ cách ~5 phút và cần 130 phút nên 70 phút còn lại chết hoàn toàn. Cộng 31 ngày: ~2 200 phút chết × 1 420 điểm/phút ≈ 3,1 triệu điểm mất, so với ~0,48 triệu điểm do tiết kiệm đường (cỡ 6,5 : 1; hiệu ≈ −2,6 triệu so với −2,11 triệu đo ở preset 1 — vì ~2 200 phút chết là ước lượng, không phải số đo). Không phải lỗi cài đặt (đo trên nhiều preset), không phải mọi bài (§4.5), và việc đổi tập không liên quan tới 2-opt."
    },
    {
      id: "q8", loai: "nhieu", doKho: 2, ref: "§4.5",
      hoi: "Trong những tình huống nào 2-opt vẫn rất hữu ích?",
      chon: [
        "Bài toán một kỳ như P1",
        "Ràng buộc tài nguyên không bão hoà",
        "Quãng đường là thành phần chính của hàm mục tiêu (TSP thuần)",
        "Bài nhiều kỳ có thời gian dư cuối kỳ mất trắng, nơi tuyến chặt làm mất khả năng lấp đầy kỳ",
        "Đồ thị bất đối xứng (chi phí đi và về khác nhau)"
      ],
      dung: [0, 1, 2],
      giaiThich: "2-opt hợp khi quãng đường thật sự là thứ được chấm: bài một kỳ, ràng buộc không bão hoà, TSP thuần. Hai lựa chọn còn lại là chỗ nó tổn hại: nhiều kỳ với thời gian dư cuối kỳ mất trắng (§4), và đồ thị bất đối xứng nơi đảo đoạn đổi chiều nên công thức delta sai (§2.1)."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§3.2–3.3",
      hoi: "Trong 2-opt với danh sách ứng viên, vì sao dòng `if (D[a][c] >= D[a][b]) break;` dừng được **cả vòng** duyệt các ứng viên của a mà không bỏ sót nước cải thiện?",
      chon: [
        "Vì c xa a hơn b thì nước 2-opt chắc chắn làm tuyến dài ra",
        "Vì K đã đủ nhỏ nên mọi ứng viên sau đó đều hết",
        "Vì danh sách được xáo ngẫu nhiên nên bỏ qua ứng viên nào cũng như nhau",
        "Danh sách đã sắp tăng dần theo khoảng cách, nên gặp c không gần a hơn b thì mọi ứng viên sau cũng thế; mà điều kiện cần của nước cải thiện là d(a,c) < d(a,b) (hoặc d(b,d) < d(c,d), được quét khi xét từ phía kia)"
      ],
      dung: 3,
      giaiThich: "Nước 2-opt thay (a,b),(c,d) bằng (a,c),(b,d) chỉ cải thiện nếu d(a,c) < d(a,b) hoặc d(b,d) < d(c,d) — nếu cả hai cạnh mới đều không ngắn hơn cạnh cũ thì tổng không giảm. Vì vậy với danh sách sắp tăng, khi d(a,c) ≥ d(a,b) thì cả phần đuôi bị loại khỏi trường hợp thứ nhất. Phương án nói “chắc chắn làm dài ra” sai: trường hợp thứ hai vẫn có thể cải thiện (và được quét từ đỉnh d); K nhỏ chỉ làm bỏ sót nếu K bé hơn số láng giềng gần hơn b."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§5.1–5.2",
      hoi: "Có hai cách dùng nhiều toán tử: (a) tuần tự kiểu VND — chạy toán tử 1 tới hết cải thiện rồi sang toán tử 2…; (b) duyệt hợp mọi lân cận rồi chọn nước tốt nhất. Khuyến nghị nào đúng?",
      chon: [
        "Tuần tự (a): nhanh hơn nhiều mà chất lượng tương đương, vì khi toán tử rẻ còn cải thiện bạn không bao giờ phải động tới toán tử đắt; xếp rẻ trước, đắt sau và giải phóng tài nguyên trước, tiêu thụ sau",
        "Trộn lẫn (b): chất lượng cao hơn hẳn vì xét nhiều nước hơn mỗi bước",
        "Hai cách nhanh như nhau nên chọn theo sở thích",
        "Tuần tự (a) chỉ dùng được khi có đúng hai toán tử"
      ],
      dung: 0,
      giaiThich: "Ở (b) mỗi bước phải duyệt toàn bộ hợp các lân cận, kể cả những lân cận vừa biết đã cạn; ở (a) các cải thiện rẻ được vắt kiệt trước. Chất lượng của hai cách tương đương nên (a) là mặc định. VND không giới hạn số toán tử, và hai cách chênh nhau rõ rệt về tốc độ, không “như nhau”."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Bài tập 11.1",
      hoi: "Viết công thức Δ của swap q[i] ↔ q[j] trong hai trường hợp j > i + 1 và j = i + 1. Kiểm bằng ví dụ §6 (kho → A → B → C → D → E; x: 0, 10, 30, 20, 50, 40): đổi B và C, rồi đổi A và E.",
      goiY: ["Với j = i + 1, cạnh giữa hai phần tử có thay đổi không, hay chỉ đổi chiều?", "A là phần tử đầu (q[−1] = kho), E là phần tử cuối — nhớ trường hợp biên."],
      mau: "Với j > i + 1 có **bốn cạnh** bị bỏ và bốn cạnh được thêm:\n\nΔ = d(q[i−1],q[j]) + d(q[j],q[i+1]) + d(q[j−1],q[i]) + d(q[i],q[j+1]) − d(q[i−1],q[i]) − d(q[i],q[i+1]) − d(q[j−1],q[j]) − d(q[j],q[j+1])\n\nVới j = i + 1 công thức này **sai** (hai cạnh giữa trùng nhau); cạnh (q[i], q[i+1]) giữ nguyên, chỉ đổi chiều:\n\nΔ = d(q[i−1],q[i+1]) + d(q[i],q[i+2]) − d(q[i−1],q[i]) − d(q[i+1],q[i+2])\n\n- Đổi B, C (kề nhau, i = 1): Δ = d(A,C) + d(B,D) − d(A,B) − d(C,D) = 10 + 20 − 20 − 30 = **−20** (tuyến mới dài 60).\n- Đổi A, E (i = 0, j = 4 là phần tử cuối nên bỏ các số hạng chứa q[j+1]): Δ = d(kho,E) + d(E,B) + d(D,A) − d(kho,A) − d(A,B) − d(D,E) = 40 + 10 + 40 − 10 − 20 − 10 = **+50** (tuyến mới kho→E→B→C→D→A dài 130).",
      tieuChi: ["Viết đúng bốn cạnh bỏ và bốn cạnh thêm cho j > i + 1", "Nêu j = i + 1 phải dùng công thức riêng (cạnh giữa giữ nguyên), không dùng công thức bốn cạnh", "Kiểm đúng: đổi B,C cho Δ = −20; đổi A,E cho Δ = +50", "Nhắc xử lý biên: q[−1] là kho khi i = 0, không có q[j+1] khi j là phần tử cuối"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 11.3, §3",
      hoi: "Giải thích vì sao danh sách ứng viên với K nhỏ có thể bỏ sót nước cải thiện nhưng với K = n − 1 thì không bỏ sót nước nào. Rồi nêu cách chọn K và cách dùng thời gian tiết kiệm được.",
      goiY: ["Điều kiện cần để nước 2-opt (a→b, c→d thành a→c, b→d) cải thiện là gì?", "Ở TSP n = 600, K = 10 đổi lấy gì và mất gì?"],
      mau: "Điều kiện **cần** để 2-opt thay (a,b),(c,d) bằng (a,c),(b,d) cải thiện: d(a,c) < d(a,b) **hoặc** d(b,d) < d(c,d) — nếu cả hai cạnh mới đều không ngắn hơn cạnh cũ tương ứng thì tổng không giảm. Đây là điều kiện cần, không phải đủ. Trường hợp sau chính là trường hợp đầu khi đi dọc chu trình theo chiều ngược lại, nên chỉ cần quét trường hợp đầu **ở cả hai chiều**: với mỗi a, lấy b lần lượt là phần tử đứng sau rồi đứng trước a, và xét các ứng viên c gần a hơn b.\n\nK = n − 1: mọi c gần a hơn b đều có mặt trong danh sách nên không bỏ sót. K nhỏ: nếu b ở rất xa a thì có thể có c gần a hơn b nhưng không nằm trong K láng giềng gần nhất → bỏ sót.\n\nChọn K bằng thực nghiệm: quét K ∈ {4, 8, 12, 16, 24}, vẽ (thời gian, chất lượng), chọn điểm ngọt (thường K ≈ 10–12; K = 3 sụt chất lượng mạnh). Đo ở TSP n = 600, K = 10: nhanh hơn 28,9 lần, kém 4,6 %. Thời gian tiết kiệm nên dùng để chạy nhiều lần khởi động hoặc metaheuristic — gần như luôn đáng đổi.",
      tieuChi: ["Nêu điều kiện cần d(a,c) < d(a,b) hoặc d(b,d) < d(c,d), và nó là điều kiện cần, không phải đủ", "Giải thích K = n − 1 không bỏ sót, K nhỏ có thể bỏ sót", "Nêu chọn K bằng thực nghiệm (quét K, đo thời gian và chất lượng) và đánh đổi cỡ 28,9 lần / 4,6 %", "Nêu cách dùng thời gian tiết kiệm (nhiều lần khởi động, metaheuristic)"]
    },
    {
      id: "l3", doKho: 3, ref: "§4, Bài tập 11.5",
      hoi: "Mô tả bằng lời của bạn hiện tượng phản trực giác ở §4: nêu số liệu, cơ chế và nguyên tắc chung. Khi nào bạn vẫn dùng 2-opt?",
      goiY: ["Thời gian dư cuối kỳ đi về đâu khi tuyến “chặt”?", "Nguyên tắc nói về mối quan hệ giữa một thành phần và tổng thể."],
      mau: "Số liệu: trên đề thi thật nhiều kỳ, thêm 2-opt + Or-opt giảm quãng đường 20–30 % nhưng điểm **giảm** 6–10 % (ví dụ preset 1: quãng đường 1 517 → 1 185, −22 %; điểm 32 876 400 → 30 761 800, −6,4 %).\n\nCơ chế: bài nhiều kỳ, thời gian dư cuối ngày mất trắng. Tuyến “lỏng” còn có nhà vừa khít để lấp đầy ngày; tuyến “chặt” thì nhà kế tiếp quá gần và không còn nhà vừa khít nên phần dư chết hoàn toàn. Cộng 31 ngày: khoảng 2 200 phút chết × 1 420 điểm/phút ≈ 3,1 triệu điểm mất, so với khoảng 330 phút đường tiết kiệm ≈ 0,48 triệu — tỉ giá ước tính cỡ 6,5 : 1 nghiêng về đóng gói ngày (2 200 phút chết là ước lượng; hiệu ≈ −2,6 triệu so với −2,11 triệu đo ở preset 1).\n\nNguyên tắc: **tối ưu thành phần ≠ tối ưu tổng thể**. Cách phát hiện: luôn đo bằng hàm mục tiêu thật, không bằng thành phần. Cách chữa: bỏ toán tử, hoặc thiết kế hàm đánh giá chứa cả hai thành phần (ba cách vá đã thử đều thất bại: kiểm Lagrange từ chối mọi nước; cho đảo trong cửa sổ 10 nhà +0,00 %; chấp nhận mọi nước giảm đường tệ nhất).\n\nVẫn dùng 2-opt khi bài một kỳ (như P1), ràng buộc tài nguyên không bão hoà, hoặc quãng đường là thành phần chính (TSP thuần).",
      tieuChi: ["Nêu hiện tượng: quãng đường giảm 20–30 % nhưng điểm giảm 6–10 %", "Giải thích cơ chế: tuyến chặt ⇒ thời gian dư cuối kỳ không tái sử dụng được", "Phát biểu nguyên tắc: tối ưu thành phần ≠ tối ưu tổng thể ⇒ đo bằng hàm mục tiêu thật", "Nêu ít nhất một tình huống 2-opt vẫn hữu ích (một kỳ / không bão hoà / TSP thuần)"]
    },
    {
      id: "l4", doKho: 3, ref: "§6, mở rộng Bài tập 11.2",
      hoi: "Với ví dụ §6 (kho → A → B → C → D → E; x: 0, 10, 30, 20, 50, 40; độ dài 80), hãy liệt kê **mọi** nước Or-opt L = 2 (nhấc hai phần tử liên tiếp, giữ chiều, đặt vào chỗ khác) và tính Δ của từng nước. Có nước nào làm tuyến ngắn đi không? Nếu không, nước Or-opt nào (L bất kỳ) là tốt nhất, và nó nói gì về “mỗi toán tử sửa một loại lỗi”?",
      goiY: ["Có 4 khúc dài 2; mỗi khúc có 3 chỗ khác để đặt — tổng cộng 12 nước (vài nước cho cùng một tuyến).", "Lỗi của tuyến này nằm ở đâu: B và C đứng sai thứ tự?"],
      mau: "Có 4 khúc × 3 chỗ = 12 nước (cho 10 tuyến khác nhau):\n\n| Nhấc | Đặt vào | Tuyến mới | Dài | Δ |\n|---|---|---|---:|---:|\n| A,B | sau C | C A B D E | 80 | 0 |\n| A,B | sau D | C D A B E | 120 | +40 |\n| A,B | sau E | C D E A B | 110 | +30 |\n| B,C | đầu tuyến | B C A D E | 100 | +20 |\n| B,C | sau D | A D B C E | 100 | +20 |\n| B,C | sau E | A D E B C | 80 | 0 |\n| C,D | đầu tuyến | C D A B E | 120 | +40 |\n| C,D | sau A | A C D B E | 80 | 0 |\n| C,D | sau E | A B E C D | 90 | +10 |\n| D,E | đầu tuyến | D E A B C | 120 | +40 |\n| D,E | sau A | A D E B C | 80 | 0 |\n| D,E | sau B | A B D E C | 80 | 0 |\n\n**Không có nước L = 2 nào có Δ < 0** (nhỏ nhất là 0). Nước tốt nhất của cả bộ Or-opt là relocate (L = 1): dời C lên trước B, Δ = −20 (cho tuyến A C B D E dài 60) — cùng kết quả với swap B,C và 2-opt [B..C] ở bảng §6.\n\nNhận xét: lỗi của tuyến này là **một cặp (B, C) đứng sai thứ tự**; relocate/swap/2-opt sửa được, còn Or-opt L = 2 không có nước hợp — đúng ý “mỗi toán tử sửa một loại lỗi”. (Đây là lý do bài tập 11.2 của bài giảng hỏi L = 3 chứ không phải L = 2: ở L = 2 không có nước nào Δ âm — chẳng hạn chuyển [C,D] lên sau A cho A C D B E dài 10 + 10 + 30 + 20 + 10 = 80, tức Δ = 0 — còn chuyển [C,D,E] lên sau A cho kho→A→C→D→E→B dài 70, tức Δ = −10, là nước L = 3 giữ chiều duy nhất có Δ âm.)",
      tieuChi: ["Liệt kê đủ 12 nước L = 2 (4 khúc × 3 chỗ), nhận ra vài nước cho cùng một tuyến, và tính Δ đúng", "Kết luận không có nước L = 2 giữ chiều nào có Δ < 0", "Chỉ ra nước tốt nhất: relocate C lên trước B (hoặc swap/2-opt tương đương) với Δ = −20", "Rút ra: lỗi ở ví dụ là một cặp đứng sai thứ tự, hợp với relocate/swap/2-opt hơn Or-opt L = 2"]
    }
  ],

  lab: [
    {
      id: "tsp-hai-opt-cong-or-opt",
      ten: "VND: 2-opt rồi Or-opt — thêm toán tử, thêm lỗi được sửa",
      doKho: 3,
      ref: "§2.2–2.3, §5.1, §7",
      de: "Cài **VND hai toán tử** cho bài chu trình ngắn nhất (`tsp`, `n = 120`): chạy 2-opt tới khi hết cải thiện, rồi Or-opt, lặp lại cho tới khi **cả hai** đều hết (§5.1a: tuần tự, rẻ trước đắt sau). Chấm trên 10 bộ dữ liệu.\n\n" +
          "Khung có sẵn tuyến xuất phát (láng giềng gần nhất) và **hàm `haiOpt()` hoàn chỉnh**. Việc của bạn là viết `orOpt()`: nhấc một khúc liên tiếp dài L = 1, 2, 3 (L = 1 chính là relocate) và đặt vào giữa hai điểm kề nhau khác — thử **cả hai chiều** của khúc — rồi nhận nước có Δ nhỏ nhất, nếu Δ < −10⁻⁹; trả `true` nếu đã đổi tuyến. Delta của Or-opt là Δ_tháo + Δ_gắn (Bài 10 §3.2), tính O(1) bằng bảng khoảng cách.\n\n" +
          "**Mức đạt:** hợp lệ → bằng 2-opt thuần (khung tự đạt mức này) → tốt hơn 2-opt thuần ít nhất 2 %.\n\n" +
          "**Sau khi qua, hãy làm ablation** (§7, cạm bẫy 5) bằng cách bật/tắt từng thành phần và đo: (1) chỉ L = 1 (relocate) so với L ≤ 3; (2) có và không có đảo chiều khúc; (3) đổi thứ tự (Or-opt trước, 2-opt sau). Mỗi thay đổi đóng góp bao nhiêu %? Toán tử nào thật sự đáng giữ? Hãy in `soDanhGia` ra `log(...)` và thử thêm danh sách ứng viên K = 10 cho điểm gắn (§3) để xem nhanh hơn bao nhiêu, kém bao nhiêu.",
      vanDe: "tsp",
      tham: { n: 120 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      muc: [
        { ten: "Bằng 2-opt thuần của khoá (sai lệch ≤ 1 %)", so: "haiOpt", heSo: 0.99 },
        { ten: "Tốt hơn 2-opt thuần ít nhất 2 % — Or-opt đã sửa thêm lỗi 2-opt không sửa được", so: "haiOpt", heSo: 1.02 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là n; rồi n dòng "x y".  Đầu ra: n chỉ số (từ 1) — thứ tự đi của chu trình.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
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

// Tuyến xuất phát: láng giềng gần nhất. p là mảng thứ tự đi của chu trình KHÉP KÍN.
let p = [0];
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
const EPS = 1e-9;
let soDanhGia = 0;

// 2-opt tới khi hết nước cải thiện (đã viết sẵn). Trả true nếu có đổi.
function haiOpt() {
  let doiChung = false, doi = true;
  while (doi) {
    doi = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        soDanhGia++;
        const a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
        if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) {
          for (let l = i + 1, h = j; l < h; l++, h--) { const tg = p[l]; p[l] = p[h]; p[h] = tg; }
          doi = true; doiChung = true;
        }
      }
    }
  }
  return doiChung;
}

// Or-opt: nhận MỘT nước tốt nhất (nếu Δ < -EPS) rồi trả true; không có nước nào thì trả false.
function orOpt() {
  // TODO: với L = 1..3, với mỗi khúc p[i..i+L-1] (i + L <= n):
  //   tr = p[(i-1+n)%n], dau = p[i], cuoi = p[i+L-1], sau = p[(i+L)%n]
  //   thao = D[tr][sau] - D[tr][dau] - D[cuoi][sau]
  //   mỗi cạnh (a, b) còn lại của chu trình (không chạm khúc, không phải cạnh mới tr–sau):
  //     giữ chiều: thao + D[a][dau] + D[cuoi][b] - D[a][b]
  //     đảo chiều: thao + D[a][cuoi] + D[dau][b] - D[a][b]
  //   ghi nhớ nước có Δ nhỏ nhất; cuối cùng dựng lại p (bỏ khúc ra, chèn lại giữa a và b).
  return false;
}

// VND: rẻ trước, đắt sau; lặp tới khi cả hai toán tử đều hết cải thiện.
haiOpt();
while (orOpt()) haiOpt();

log("soDanhGia = " + soDanhGia);
print(p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;
vector<int> p;                 // chu trình KHÉP KÍN, thứ tự đi
const double EPS = 1e-9;
long long soDanhGia = 0;

// 2-opt tới khi hết nước cải thiện (đã viết sẵn). Trả true nếu có đổi.
bool haiOpt() {
    bool doiChung = false, doi = true;
    while (doi) {
        doi = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                soDanhGia++;
                int a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
                if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) {
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    doi = true; doiChung = true;
                }
            }
    }
    return doiChung;
}

// Or-opt: nhận MỘT nước tốt nhất (nếu Δ < -EPS) rồi trả true; không có nước nào thì trả false.
bool orOpt() {
    // TODO: với L = 1..3, với mỗi khúc p[i..i+L-1] (i + L <= n):
    //   tr = p[(i-1+n)%n], dau = p[i], cuoi = p[i+L-1], sau = p[(i+L)%n]
    //   thao = D[tr][sau] - D[tr][dau] - D[cuoi][sau]
    //   mỗi cạnh (a, b) còn lại của chu trình (không chạm khúc, không phải cạnh mới tr–sau):
    //     giữ chiều: thao + D[a][dau] + D[cuoi][b] - D[a][b]
    //     đảo chiều: thao + D[a][cuoi] + D[dau][b] - D[a][b]
    //   ghi nhớ nước có Δ nhỏ nhất; cuối cùng dựng lại p (bỏ khúc ra, chèn lại giữa a và b).
    return false;
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
    p.assign(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = p.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        p.push_back(tot);
    }

    // VND: rẻ trước, đắt sau; lặp tới khi cả hai toán tử đều hết cải thiện.
    haiOpt();
    while (orOpt()) haiOpt();

    fprintf(stderr, "soDanhGia = %lld\n", soDanhGia);
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

let p = [0];
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
const EPS = 1e-9;
let soDanhGia = 0;

function haiOpt() {
  let doiChung = false, doi = true;
  while (doi) {
    doi = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        soDanhGia++;
        const a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
        if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) {
          for (let l = i + 1, h = j; l < h; l++, h--) { const tg = p[l]; p[l] = p[h]; p[h] = tg; }
          doi = true; doiChung = true;
        }
      }
    }
  }
  return doiChung;
}

// Or-opt (L = 1..3, cả hai chiều): nhận một nước tốt nhất.
function orOpt() {
  let tot = -EPS, bi = -1, bL = 0, bk = -1, bDao = false;
  for (let L = 1; L <= 3; L++) {
    for (let i = 0; i + L <= n; i++) {
      const tr = p[(i - 1 + n) % n], dau = p[i], cuoi = p[i + L - 1], sau = p[(i + L) % n];
      const thao = D[tr][sau] - D[tr][dau] - D[cuoi][sau];
      for (let s = 0; s < n - L - 1; s++) {           // các cạnh (a, b) còn lại, không chạm khúc
        const ka = (i + L + s) % n;
        const a = p[ka], b = p[(ka + 1) % n], cu = D[a][b];
        soDanhGia += 2;
        let dl = thao + D[a][dau] + D[cuoi][b] - cu;   // giữ chiều
        if (dl < tot) { tot = dl; bi = i; bL = L; bk = ka; bDao = false; }
        dl = thao + D[a][cuoi] + D[dau][b] - cu;       // đảo chiều
        if (dl < tot) { tot = dl; bi = i; bL = L; bk = ka; bDao = true; }
      }
    }
  }
  if (bi < 0) return false;
  const a = p[bk];
  let seg = [];
  for (let u = 0; u < bL; u++) seg.push(p[(bi + u) % n]);
  if (bDao) seg.reverse();
  const rest = [];
  for (let u = bL; u < n; u++) rest.push(p[(bi + u) % n]);   // bắt đầu từ "sau", kết thúc ở "tr"
  const pos = rest.indexOf(a);
  p = rest.slice(0, pos + 1).concat(seg, rest.slice(pos + 1));
  return true;
}

haiOpt();
while (orOpt()) haiOpt();

log("soDanhGia = " + soDanhGia);
print(p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;
vector<int> p;
const double EPS = 1e-9;
long long soDanhGia = 0;

bool haiOpt() {
    bool doiChung = false, doi = true;
    while (doi) {
        doi = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                soDanhGia++;
                int a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
                if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) {
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    doi = true; doiChung = true;
                }
            }
    }
    return doiChung;
}

// Or-opt (L = 1..3, cả hai chiều): nhận một nước tốt nhất.
bool orOpt() {
    double tot = -EPS;
    int bi = -1, bL = 0, bk = -1;
    bool bDao = false;
    for (int L = 1; L <= 3; L++)
        for (int i = 0; i + L <= n; i++) {
            int tr = p[(i - 1 + n) % n], dau = p[i], cuoi = p[i + L - 1], sau = p[(i + L) % n];
            double thao = D[tr][sau] - D[tr][dau] - D[cuoi][sau];
            for (int s = 0; s < n - L - 1; s++) {      // các cạnh (a, b) còn lại, không chạm khúc
                int ka = (i + L + s) % n;
                int a = p[ka], b = p[(ka + 1) % n];
                double cu = D[a][b];
                soDanhGia += 2;
                double dl = thao + D[a][dau] + D[cuoi][b] - cu;   // giữ chiều
                if (dl < tot) { tot = dl; bi = i; bL = L; bk = ka; bDao = false; }
                dl = thao + D[a][cuoi] + D[dau][b] - cu;          // đảo chiều
                if (dl < tot) { tot = dl; bi = i; bL = L; bk = ka; bDao = true; }
            }
        }
    if (bi < 0) return false;
    int a = p[bk];
    vector<int> seg, rest;
    for (int u = 0; u < bL; u++) seg.push_back(p[(bi + u) % n]);
    if (bDao) reverse(seg.begin(), seg.end());
    for (int u = bL; u < n; u++) rest.push_back(p[(bi + u) % n]);  // bắt đầu từ "sau", kết thúc ở "tr"
    int pos = (int)(find(rest.begin(), rest.end(), a) - rest.begin());
    vector<int> moi(rest.begin(), rest.begin() + pos + 1);
    moi.insert(moi.end(), seg.begin(), seg.end());
    moi.insert(moi.end(), rest.begin() + pos + 1, rest.end());
    p = moi;
    return true;
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

    p.assign(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = p.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        p.push_back(tot);
    }

    haiOpt();
    while (orOpt()) haiOpt();

    fprintf(stderr, "soDanhGia = %lld\n", soDanhGia);
    for (int i = 0; i < n; i++) printf("%d%c", p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Với khúc p[i..i+L−1]: tr = p[(i−1+n)%n], sau = p[(i+L)%n]. Gỡ khúc ra làm hai cạnh (tr,dau), (cuoi,sau) biến mất và một cạnh mới (tr,sau) xuất hiện: thao = D[tr][sau] − D[tr][dau] − D[cuoi][sau].",
        "Các cạnh để gắn lại là (p[ka], p[ka+1]) với ka chạy từ i+L tới i+n−2 (theo vòng, %n) — tổng n−L−1 cạnh. Cạnh (tr,sau) bị loại vì gắn vào đó chỉ trả lại tuyến cũ. Gắn giữa a và b: thêm D[a][dau] + D[cuoi][b] − D[a][b] (giữ chiều) hoặc D[a][cuoi] + D[dau][b] − D[a][b] (đảo chiều).",
        "Dựng lại tuyến: lấy khúc ra, viết phần còn lại bắt đầu từ `sau` (vòng quanh tới `tr`), tìm vị trí của a rồi chèn khúc ngay sau a. Muốn kiểm: so độ dài tuyến mới với độ dài cũ + Δ (Bài 10 §4.2).",
        "Chỉ L = 1 (relocate) đã cho phần lớn lợi ích; L ≤ 3 và đảo chiều cho thêm. Nếu qua mức 2 % rồi, hãy tự đo từng thành phần đóng góp bao nhiêu %."
      ]
    },
    {
      id: "dem-lan-can-chinh-xac",
      ten: "Đếm chính xác kích thước lân cận của bảy toán tử",
      doKho: 2,
      ref: "§2.6, Bài 9 §3.2",
      de: "Trước khi viết một toán tử, hãy **đếm** nó sinh ra bao nhiêu lân cận — bảng §2.6 chỉ cho cỡ xấp xỉ (m²/2, 3m², m²…). Ở lab này bạn đếm **chính xác**.\n\n" +
          "Cho một tuyến mở gồm `m` đơn khác nhau lấy từ `n` đơn (đánh số `0..n−1`). Với mỗi toán tử dưới đây, in số tuyến **khác nhau** và **khác tuyến hiện tại** thu được bằng đúng **một** nước đi (hai nước cho cùng một tuyến chỉ đếm một lần). Chấm trên 10 bộ dữ liệu; mức đạt duy nhất là **đúng cả bảy số trên mọi test**:\n\n" +
          "1. `haiOpt` — đảo một khúc liên tiếp có ít nhất 2 phần tử.\n" +
          "2. `swap` — đổi chỗ hai phần tử ở hai vị trí khác nhau.\n" +
          "3. `relocate` — nhấc một phần tử ra khỏi vị trí cũ, chèn vào vị trí khác (các phần tử còn lại giữ thứ tự).\n" +
          "4. `orOpt` — nhấc một khúc liên tiếp dài L ∈ {1, 2, 3}, **giữ nguyên chiều**, chèn vào vị trí khác.\n" +
          "5. `chen` — thêm một đơn chưa có trong tuyến vào vị trí bất kỳ (kể cả đầu và cuối).\n" +
          "6. `bo` — bỏ một đơn khỏi tuyến.\n" +
          "7. `doi` (exchange) — bỏ một đơn trong tuyến rồi chèn một đơn ngoài tuyến vào vị trí bất kỳ của tuyến mới.\n\n" +
          "In **một dòng bảy số** theo đúng thứ tự trên. Bạn có thể dựng mọi lân cận rồi đếm bằng `Set`, hoặc tự rút ra công thức — nhưng hãy chắc rằng bạn hiểu **vì sao** số đếm khác tích “số khúc × số chỗ đặt”. Câu suy ngẫm: ở m = 14, công thức xấp xỉ 3m² (hay 3m(m + 1) = 630) của Or-opt lệch bao nhiêu so với số đếm được, và nguyên nhân là gì?",
      vanDe: "b11-dem-lan-can",
      tham: { mLo: 6, mHi: 25 },
      bienThe: [
        { ten: "Tuyến vừa (m từ 6 đến 25)", tham: { mLo: 6, mHi: 25 } },
        { ten: "Tuyến ngắn (m = 5)", tham: { m: 5 } },
        { ten: "Tuyến dài (m từ 30 đến 40)", tham: { mLo: 30, mHi: 40 } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là "m n"; dòng 2 là m chỉ số khác nhau (tuyến mở hiện tại).
// Đầu ra : MỘT dòng bảy số: haiOpt swap relocate orOpt chen bo doi
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], n = t[1];
const q = t.slice(2, 2 + m);
const goc = q.join(",");
const ngoai = [];                              // các đơn chưa có trong tuyến
for (let u = 0; u < n; u++) if (!q.includes(u)) ngoai.push(u);

// dem(sinhRa): sinhRa(them) gọi them(tuyen) cho mỗi lân cận sinh được; trả số tuyến KHÁC NHAU và KHÁC tuyến gốc.
function dem(sinhRa) {
  const S = new Set();
  sinhRa((r) => { const k = r.join(","); if (k !== goc) S.add(k); });
  return S.size;
}

const haiOpt = dem((them) => {
  // TODO: đảo mọi khúc q[i..j], i < j
});
const swap = dem((them) => {
  // TODO: đổi chỗ q[i], q[j], i < j
});
const relocate = dem((them) => {
  // TODO: nhấc q[i] ra, chèn vào mọi vị trí khác
});
const orOpt = dem((them) => {
  // TODO: nhấc khúc dài L = 1..3 bắt đầu ở i, chèn vào mọi vị trí khác, giữ chiều
});
const chen = dem((them) => {
  // TODO: mỗi đơn u trong ngoai, mỗi vị trí 0..m
});
const bo = dem((them) => {
  // TODO: bỏ từng đơn
});
const doi = dem((them) => {
  // TODO: bỏ q[i], rồi chèn mỗi đơn u trong ngoai vào mọi vị trí 0..m-1 của tuyến m-1 phần tử
});

print([haiOpt, swap, relocate, orOpt, chen, bo, doi].join(" "));
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], n = t[1];
const q = t.slice(2, 2 + m);
const goc = q.join(",");
const ngoai = [];
for (let u = 0; u < n; u++) if (!q.includes(u)) ngoai.push(u);

function dem(sinhRa) {
  const S = new Set();
  sinhRa((r) => { const k = r.join(","); if (k !== goc) S.add(k); });
  return S.size;
}
// Nhấc khúc dài L bắt đầu ở i, chèn vào mọi vị trí k của phần còn lại (giữ chiều).
function nhacDat(them, Lmax) {
  for (let L = 1; L <= Lmax; L++) {
    for (let i = 0; i + L <= m; i++) {
      const seg = q.slice(i, i + L), rest = q.slice(0, i).concat(q.slice(i + L));
      for (let k = 0; k <= rest.length; k++) them(rest.slice(0, k).concat(seg, rest.slice(k)));
    }
  }
}

const haiOpt = dem((them) => {
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    const r = q.slice();
    for (let l = i, h = j; l < h; l++, h--) { const tg = r[l]; r[l] = r[h]; r[h] = tg; }
    them(r);
  }
});
const swap = dem((them) => {
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    const r = q.slice(); const tg = r[i]; r[i] = r[j]; r[j] = tg;
    them(r);
  }
});
const relocate = dem((them) => nhacDat(them, 1));
const orOpt = dem((them) => nhacDat(them, 3));
const chen = dem((them) => {
  for (const u of ngoai) for (let k = 0; k <= m; k++) them(q.slice(0, k).concat([u], q.slice(k)));
});
const bo = dem((them) => {
  for (let k = 0; k < m; k++) them(q.slice(0, k).concat(q.slice(k + 1)));
});
const doi = dem((them) => {
  for (let i = 0; i < m; i++) {
    const rest = q.slice(0, i).concat(q.slice(i + 1));
    for (const u of ngoai) for (let k = 0; k <= rest.length; k++) them(rest.slice(0, k).concat([u], rest.slice(k)));
  }
});

print([haiOpt, swap, relocate, orOpt, chen, bo, doi].join(" "));
`
      },
      goiY: [
        "`dem` đã lo việc bỏ trùng và bỏ tuyến gốc bằng `Set`; bạn chỉ cần gọi `them(tuyenMoi)` cho mỗi lân cận sinh ra — kể cả khi hai cách khác nhau cho cùng một tuyến, `Set` tự lọc.",
        "Nhấc-đặt tổng quát: với khúc seg = q.slice(i, i+L), rest = phần còn lại (q.slice(0,i).concat(q.slice(i+L))); mỗi vị trí k = 0..rest.length cho một tuyến rest.slice(0,k).concat(seg, rest.slice(k)). relocate là L = 1; orOpt là L = 1..3 — và relocate nằm trọn trong orOpt.",
        "Kiểm công thức bằng số: haiOpt và swap đều m(m−1)/2; relocate (m−1)² (không phải m(m−1): nhấc a đặt sau b rồi nhấc b đặt trước a cho cùng một tuyến); chen (n−m)(m+1); bo m; doi m²(n−m). Còn orOpt: thử tự rút ra công thức theo m (nó là 3m² − 18m + 35 khi m ≥ 5)."
      ]
    }
  ]
});
