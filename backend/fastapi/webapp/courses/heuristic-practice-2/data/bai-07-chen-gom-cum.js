/* Thực hành — Bài 7: Chèn, tiết kiệm, gom cụm. */

// Bài toán tự dựng (tiền tố b07-): chi phí chèn Δt của một đơn vào mọi vị trí của một tuyến, vị trí tốt nhất và tiếc nuối.
// stdin : m / "50 50" / m dòng "x y" (các nút của tuyến theo thứ tự) / "x y s" (đơn cần chèn)
// stdout: Δt(0..m), k*, tiếc nuối theo Δt
(function () {
  function dtList(inst) {
    var m = inst.rx.length, out = [], k;
    function d(x1, y1, x2, y2) { return Math.abs(x1 - x2) + Math.abs(y1 - y2); }
    for (k = 0; k <= m; k++) {
      var ax = k === 0 ? inst.kx : inst.rx[k - 1], ay = k === 0 ? inst.ky : inst.ry[k - 1];
      var them = d(ax, ay, inst.jx, inst.jy) + inst.sj;
      if (k < m) them += d(inst.jx, inst.jy, inst.rx[k], inst.ry[k]) - d(ax, ay, inst.rx[k], inst.ry[k]);
      out.push(them);
    }
    return out;
  }
  TH.vande.dangKy("b07-delta-t", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), m = r.khoang(tham.mLo || 2, tham.mHi || 5), rx = [], ry = [], i;
      for (i = 0; i < m; i++) { rx.push(r.khoang(0, 99)); ry.push(r.khoang(0, 99)); }
      var inst = { kx: 50, ky: 50, rx: rx, ry: ry, jx: r.khoang(0, 99), jy: r.khoang(0, 99), sj: r.khoang(5, 30) };
      if (tham.tren) {                           /* đặt j trong hình chữ nhật của hai nút liên tiếp: đi vòng = 0 (Manhattan) */
        var t = r.int(m), ax = t === 0 ? 50 : rx[t - 1], ay = t === 0 ? 50 : ry[t - 1];
        inst.jx = r.khoang(Math.min(ax, rx[t]), Math.max(ax, rx[t]));
        inst.jy = r.khoang(Math.min(ay, ry[t]), Math.max(ay, ry[t]));
      }
      return inst;
    },
    viet: function (inst) {
      var s = inst.rx.length + "\n" + inst.kx + " " + inst.ky + "\n";
      for (var i = 0; i < inst.rx.length; i++) s += inst.rx[i] + " " + inst.ry[i] + "\n";
      return s + inst.jx + " " + inst.jy + " " + inst.sj + "\n";
    },
    giai: function (inst) {
      var dt = dtList(inst), ks = 0, i, sx = dt.slice().sort(function (a, b) { return a - b; });
      for (i = 1; i < dt.length; i++) if (dt[i] < dt[ks]) ks = i;
      return [dt, ks, sx[1] - sx[0]];
    },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `m` — số nút của tuyến (m ≥ 1). Dòng 2: `50 50` — toạ độ kho. Tiếp theo `m` dòng `x y` — các nút `r₁ … r_m` theo thứ tự đi. Dòng cuối: `x y s` — đơn cần chèn (toạ độ và số phút giao). Khoảng cách Manhattan.",
      ra: "Các số nguyên, cách nhau khoảng trắng hoặc xuống dòng: trước hết `m + 1` giá trị `Δt(0) … Δt(m)` (k = 0: chèn trước r₁, tức a là kho; k = m: chèn sau r_m, không có nút sau); rồi `k*` — vị trí có Δt nhỏ nhất (hoà thì lấy k nhỏ hơn); cuối cùng là tiếc nuối theo Δt = (Δt nhỏ thứ nhì) − (Δt nhỏ nhất)."
    }
  }));
})();

TH.dangKy({
  id: "bai-07-chen-gom-cum",

  tomTat: [
    "Greedy chỉ biết **nối vào cuối** tuyến; chèn mở rộng tập quyết định thành “chọn đơn nào **và đặt ở đâu**”. Chỉ riêng việc đó đã cho +6,5 % trên P1 (65 425 so với 61 420; đo với λ đã hiệu chuẩn lại ≈ 88 — số 63 920 ở Bài 6 dùng λ = 80, cùng bộ 60 test, đừng so trực tiếp).",
    "Công thức hạt nhân: Δt(j,k) = d(a,j) + d(j,b) − d(a,b) + s_j. Phần d(a,j) + d(j,b) − d(a,b) là chi phí đi vòng, luôn ≥ 0 (bất đẳng thức tam giác) và bằng 0 khi j nằm đúng trên đường a → b.",
    "Greedy là trường hợp đặc biệt của chèn: chèn vào cuối (không có b) cho Δt = d(a,j) + s_j. Chèn vào đầu thì a là kho: Δt = d₀(j) + d(j,b) − d₀(b) + s_j. Hai trường hợp biên này gây nhiều lỗi nhất.",
    "Chèn rẻ nhất xếp hạng theo giá trị ròng p − λ·Δt (không theo Δt nhỏ nhất). Chèn với λ = 0 chỉ được 40 220, với λ = 80 được 63 920. Mỗi bước tốn O(n·m), cả hàm O(n·m²); đừng tính lại thời gian của cả tuyến trong vòng lặp trong cùng.",
    "Chèn theo tiếc nuối: regret(j) = v⁽¹⁾ − v⁽²⁾ — ưu tiên đơn sẽ thiệt nhiều nhất nếu mất vị trí tốt nhất của nó. Hy sinh điểm hôm nay để tránh mất nhiều hơn ở bước sau; kỳ vọng thắng chèn rẻ nhất 2–5 % trên dữ liệu gom cụm (bài giảng chưa kèm bảng đo — BT 7.3 yêu cầu tự đo), nhưng sai giả định khi tuyến còn thưa, và ở bài chọn lọc như P1 regret thuần v⁽¹⁾ − v⁽²⁾ có thể thua cả chèn rẻ nhất (thử v⁽¹⁾ + β·regret).",
    "Tiết kiệm Clarke–Wright S(i,j) = d₀(i) + d₀(j) − d(i,j) hợp với bài có depot, phải quay về, có tải trọng, phục vụ tất cả khách; **không** áp dụng trực tiếp cho P1/P3 (đường mở, chọn lọc). Ý tưởng “đo tác động lên cấu trúc sẵn có” thì chính là Δt.",
    "Gom cụm (lưới, quét góc, k-means; cluster-first hay route-first) đóng băng quyết định sớm. Chỉ dùng khi có **chi phí thật** giữa các cụm; trong đề thi thật, phân tích cấu trúc đề cho thấy gom cụm cứng nhiều khả năng làm giảm điểm vì chặn mất quyền chọn ngôi nhà cuối ngày (đây là lập luận, chưa có phép đo riêng).",
    "Đo trên nhiều loại dữ liệu: lợi thế của chèn giảm từ +6,5 % (rải đều) xuống +5,0 % (gom cụm). Chỉ đo một loại dữ liệu sẽ ước lượng sai giá trị của mọi cải tiến."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§ Bài này nói về chuyện gì, §1",
      hoi: "Vì sao heuristic chèn với tới được những lời giải mà greedy ở Bài 5 không bao giờ tìm ra, dù cả hai đều xếp hạng ứng viên theo giá trị?",
      chon: [
        "Vì chèn chạy nhiều vòng lặp hơn greedy",
        "Vì chèn dùng khoảng cách Euclid thay cho Manhattan",
        "Vì chèn chấm điểm các ứng viên chính xác hơn greedy",
        "Vì chèn mở rộng tập nước đi: ngoài việc chọn đơn nào còn chọn đặt ở đâu trong tuyến, còn greedy chỉ biết nối vào cuối"
      ],
      dung: 3,
      giaiThich: "Với greedy, “chèn D vào giữa A và B” không phải một nước đi tồn tại — nó chỉ xét một vị trí (cuối tuyến). Chèn xét n × (m + 1) cặp (đơn, vị trí). Bài học của bài: cải tiến lớn thường đến từ mở rộng tập quyết định, không phải chấm điểm khéo hơn trên tập cũ. Số vòng lặp, loại khoảng cách và độ tinh vi của chỉ số không phải nguyên nhân."
    },
    {
      id: "q2", loai: "so", doKho: 1, ref: "§2.2", donVi: "(phút)",
      hoi: "Chèn đơn j vào giữa hai nút liên tiếp a và b của tuyến. Biết d(a,j) = 8, d(j,b) = 6, d(a,b) = 11 và s_j = 25 phút. Thời gian của tuyến dài thêm Δt là bao nhiêu phút?",
      dapAn: 28, saiSo: 0,
      giaiThich: "Δt = d(a,j) + d(j,b) − d(a,b) + s_j = 8 + 6 − 11 + 25 = 28. Phần đi vòng chỉ có 3 phút (8 + 6 − 11), còn lại là thời gian giao. Phần đi vòng luôn ≥ 0 nhờ bất đẳng thức tam giác d(a,b) ≤ d(a,j) + d(j,b); nó bằng 0 khi j nằm đúng trên đường từ a tới b."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§4.4",
      hoi: "Kho ở gốc. Khách i cách kho 15, khách j cách kho 20 và d(i,j) = 6. Tiết kiệm Clarke–Wright S(i,j) khi ghép hai chuyến riêng thành một chuyến kho → i → j → kho là bao nhiêu?",
      dapAn: 29, saiSo: 0,
      giaiThich: "S(i,j) = d₀(i) + d₀(j) − d(i,j) = 15 + 20 − 6 = 29. Kiểm lại: hai chuyến riêng tốn 2·15 + 2·20 = 70; chuyến chung tốn 15 + 6 + 20 = 41; 70 − 41 = 29. Tiết kiệm lớn khi hai khách ở xa kho nhưng gần nhau."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§3.2.1", donVi: "(điểm)",
      hoi: "Còn hai ứng viên R và S, điểm chèn v tại các vị trí của chúng lần lượt là R: 750, 700, 400 và S: 640, 210, 190. Regret lớn nhất trong hai ứng viên là bao nhiêu điểm?",
      dapAn: 430, saiSo: 0,
      giaiThich: "regret(R) = 750 − 700 = 50; regret(S) = 640 − 210 = 430. Chèn rẻ nhất chọn R (750 > 640), còn regret chọn S vì vị trí tốt nhì của S tệ hơn rất nhiều: nếu vị trí 640 bị phá mà ta chưa lấy S, ta mất 430 điểm, trong khi R vẫn còn 700 ở vị trí nhì."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§4.3",
      hoi: "Heuristic tiết kiệm Clarke–Wright hợp với những bài nào? Chọn mọi ý đúng.",
      chon: [
        "Bài đường đi mở như P1 (không quay về kho)",
        "Bài có depot và mỗi chuyến phải quay về depot",
        "Bài có ràng buộc tải trọng (mỗi xe chở ≤ Q)",
        "Bài chọn lọc khách như orienteering",
        "Bài phải phục vụ tất cả khách hàng"
      ],
      dung: [1, 2, 4],
      giaiThich: "Clarke–Wright xuất phát từ “mỗi khách một chuyến riêng” rồi ghép để tiết kiệm, nên cần depot và quay về, phục vụ tất cả khách và hợp với ràng buộc tải trọng. P1/P3 là đường mở và chọn lọc đơn nên không áp dụng trực tiếp — dù ý tưởng đo tác động lên cấu trúc có sẵn chính là chi phí đi vòng Δt của chèn."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§2.2, §8 (cạm bẫy 1)",
      hoi: "Chọn mọi phát biểu ĐÚNG về chi phí chèn Δt.",
      chon: [
        "Chèn vào cuối tuyến (không có nút sau): Δt = d(a,j) + s_j — đúng bằng chi phí của greedy nối cuối",
        "Δt có thể âm khi j nằm đúng trên đường từ a tới b",
        "Chèn vào đầu tuyến thì nút “trước” là kho chứ không phải một phần tử của tuyến",
        "Chèn vào cuối tuyến vẫn phải cộng d(j, kho) vì ngày phải quay về",
        "Phần đi vòng d(a,j) + d(j,b) − d(a,b) luôn ≥ 0 nhờ bất đẳng thức tam giác"
      ],
      dung: [0, 2, 4],
      giaiThich: "Greedy là trường hợp đặc biệt của chèn khi chỉ xét một vị trí. Hai trường hợp biên (đầu: a là kho; cuối: không có b nên không cộng d(j,b) − d(a,b)) gây nhiều lỗi nhất. Khi j nằm đúng trên đường a → b thì phần đi vòng bằng 0 chứ không âm — Δt khi đó bằng s_j > 0. Còn P1 không cần quay về kho nên không có d(j, kho) ở cuối tuyến."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§3.2.1, §3.3",
      hoi: "Khi nào chèn theo tiếc nuối (regret) có thể KHÔNG hơn chèn rẻ nhất?",
      chon: [
        "Khi tuyến còn thưa, nhiều chỗ trống: giả định “vị trí tốt nhất sẽ bị đơn khác chiếm” không đúng, regret chỉ tốn thêm công",
        "Khi dữ liệu gom cụm và có nhiều đơn lẻ loi",
        "Khi ngân sách thời gian rất chặt",
        "Khi số vị trí chèn lớn hơn số đơn chưa dùng"
      ],
      dung: 0,
      giaiThich: "Regret dựa trên niềm tin rằng vị trí tốt nhất của một đơn sẽ mất nếu không lấy ngay. Khi tuyến còn thưa, niềm tin đó sai nên regret không mang lại gì. Dữ liệu gom cụm có đơn lẻ loi và ngân sách chặt chính là hai tình huống bài giảng nêu regret kỳ vọng thắng (cỡ 2–5 %, chưa có bảng đo trong bài); còn so sánh số vị trí với số đơn không liên quan. Thêm một lưu ý: ở bài chọn lọc như P1, regret thuần v⁽¹⁾ − v⁽²⁾ không xét giá trị v⁽¹⁾ nên cũng có thể thua chèn rẻ nhất."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§5.3, §5.4",
      hoi: "Trong đề thi thật các ngày nối tiếp nhau (vị trí không reset giữa các ngày). Một bạn đề xuất “chia bản đồ thành vùng, mỗi ngày phục vụ một vùng”. Theo bài giảng, vì sao ý này nhiều khả năng làm điểm giảm?",
      chon: [
        "Vì k-means luôn chậm hơn chia lưới",
        "Vì số vùng luôn phải bằng 5",
        "Vì ranh giới vùng không có chi phí thật để biện minh (không phải quay về), lại chặn mất tự do chọn ngôi nhà cuối ngày — đòn bẩy số 1",
        "Vì chia vùng làm Δt âm"
      ],
      dung: 2,
      giaiThich: "Gom cụm đóng băng một quyết định trước khi có đủ thông tin. Khi các ngày nối tiếp, không có chi phí “quay về vùng” nào để đền bù, còn ràng buộc vùng cứng lại làm mất quyền chọn ngôi nhà cuối ngày để lấp đầy tới sát 720 phút. Quy tắc: chỉ gom cụm khi có chi phí thật giữa các cụm. Tốc độ của k-means, số vùng hay dấu của Δt không phải lý do."
    },
    {
      id: "q9", loai: "mot", doKho: 2, ref: "§6.3",
      hoi: "Chèn rẻ nhất hơn greedy tỉ số +6,5 % trên dữ liệu rải đều nhưng chỉ +5,0 % trên dữ liệu gom cụm. Kết luận nào đúng nhất?",
      chon: [
        "Chèn tệ đi trên dữ liệu gom cụm nên có thể bỏ chèn",
        "Dữ liệu gom cụm có các điểm sát nhau sẵn nên chèn có ít chỗ tiết kiệm hơn; chỉ đo trên một loại dữ liệu sẽ ước lượng sai giá trị của cải tiến",
        "Dữ liệu gom cụm cho điểm thấp hơn nên chèn bị kéo xuống",
        "Chênh 1,5 % luôn là nhiễu nên hai con số hoàn toàn như nhau"
      ],
      dung: 1,
      giaiThich: "Mọi thuật toán đều được điểm cao hơn trên dữ liệu gom cụm (70 710 so với 61 420 cho greedy tỉ số) vì ít tốn thời gian đi lại. Lợi thế của chèn thu hẹp vì “chèn vào giữa” tiết kiệm được ít hơn khi các điểm đã sát nhau. Bài học: phải đo trên nhiều loại dữ liệu. Chênh 1,5 % có ý nghĩa hay không là việc của ngưỡng 2·SE (Bài 4), không thể phán “luôn là nhiễu”; và +5,0 % vẫn là lợi thế thật."
    },
    {
      id: "q10", loai: "so", doKho: 1, ref: "§1.1",
      hoi: "Có 120 đơn chưa dùng và tuyến hiện có 10 đơn. Ở một bước, heuristic chèn rẻ nhất xét bao nhiêu cặp (đơn, vị trí)?",
      dapAn: 1320, saiSo: 0,
      giaiThich: "Tuyến 10 đơn có 11 vị trí chèn (trước đơn đầu, giữa các đơn, sau đơn cuối), nên số cặp là n × (m + 1) = 120 × 11 = 1 320 — so với 120 lựa chọn của greedy, nhiều hơn 11 lần. Chính tập lựa chọn rộng hơn đó, không phải chỉ số tinh vi hơn, là nguồn gốc của +6,5 %."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Bài tập 7.1",
      hoi: "Ví dụ làm tay ở §7 (kho (50,50), ngân sách 100 phút): đơn 1 có d₀ = 3, s = 20, p = 2 000; đơn 2: d₀ = 20, s = 10, p = 2 500; đơn 3: d₀ = 10, s = 30, p = 6 000; đơn 4: d₀ = 3, s = 15, p = 1 200. Khoảng cách d(1,4) = 2, d(1,3) = d(3,4) = 7, các khoảng cách từ đơn 2 tới đơn khác xấp xỉ 20. Hãy chạy tay chèn rẻ nhất với λ = 120 thay vì 60. Kết quả có khác không? Giải thích.",
      goiY: ["Ở mỗi bước vẫn chọn cặp (đơn, vị trí) có v = p − λ·Δt lớn nhất trong số còn vừa ngân sách, kể cả khi v âm.", "So lại bước 3: với λ = 60 thì v của đơn 4 là 180, v của đơn 2 là 700. Còn với λ = 120?"],
      mau: "Với λ = 120 (vẫn chọn v lớn nhất trong các cặp còn vừa, kể cả v âm):\n\n- Bước 1 (tuyến rỗng): v₁ = 2 000 − 120·23 = −760; v₂ = 2 500 − 120·30 = −1 100; v₃ = 6 000 − 120·40 = **+1 200**; v₄ = 1 200 − 120·18 = −960 ⇒ chèn **3**.\n- Bước 2 (tuyến [3], t = 40): đơn 1 trước 3 có Δt = 20, v = −400 — cao nhất (đơn 4 trước 3: Δt = 15, v = −600; đơn 2 sau 3: Δt = 30, v = −1 100) ⇒ tuyến [1, 3], t = 60.\n- Bước 3 (còn 40 phút): đơn 4 có Δt = 17 (chèn giữa 1 và 3, hoặc trước 1) nên v = 1 200 − 120·17 = **−840**; đơn 2 sau 3 có Δt = 30 nên v = 2 500 − 3 600 = **−1 100**. Thứ hạng **đảo ngược** so với λ = 60 (khi đó đơn 2 đạt 700, đơn 4 chỉ 180) ⇒ chèn **4**, t = 77.\n- Còn 23 phút, đơn 2 cần 30 ⇒ dừng. Tổng = 2 000 + 1 200 + 6 000 = **9 200**, kém 10 500 của λ = 60 (và chỉ bằng greedy gần nhất).\n\nVậy kết quả **khác và xấu đi**: λ cao làm thuật toán “keo kiệt” về thời gian nên bỏ đơn lớn nhưng xa (đơn 2) để lấy đơn nhỏ mà gần (đơn 4). Giá trị λ phải được hiệu chuẩn (Bài 6), không phải cứ lớn là tốt.",
      tieuChi: ["Tính đúng bước 1: chọn đơn 3 với v = +1 200", "Chỉ ra thứ hạng đảo ở bước 3: đơn 4 (−840) vượt đơn 2 (−1 100), khác hẳn λ = 60", "Kết luận tổng 9 200 thấp hơn 10 500, tức kết quả khác và kém hơn", "Giải thích bằng chiều λ cao: coi thời gian quá đắt nên bỏ đơn xa"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 7.2, §2.2, §8",
      hoi: "(a) Viết công thức Δt khi chèn đơn j vào **đầu** tuyến (trước phần tử đầu tiên b), với kho cố định, và khi chèn vào **cuối** tuyến. (b) Vì sao Δt luôn ≥ 0? (c) Nêu cách viết mã để hai trường hợp biên không sinh lỗi.",
      goiY: ["Ở đầu tuyến, “nút trước” là gì? Ở cuối tuyến, còn nút sau không?", "Nhớ bất đẳng thức tam giác: đi thẳng không bao giờ xa hơn đi vòng."],
      mau: "(a) **Đầu tuyến**: nút “trước” là kho, nên Δt = d₀(j) + d(j,b) − d₀(b) + s_j, với d₀ là khoảng cách từ kho. **Cuối tuyến**: không có nút sau, nên không có d(j,b) và d(a,b): Δt = d(a,j) + s_j — đúng bằng chi phí của greedy nối cuối (greedy là trường hợp đặc biệt của chèn, chỉ xét một vị trí).\n\n(b) Phần đi vòng d(a,j) + d(j,b) − d(a,b) ≥ 0 theo bất đẳng thức tam giác d(a,b) ≤ d(a,j) + d(j,b), còn s_j > 0. Phần đi vòng bằng 0 khi j nằm đúng trên đường a → b — khi đó Δt = s_j.\n\n(c) Dùng **một** hàm khoảng cách duy nhất nhận −1 nghĩa là kho, dùng thống nhất mọi nơi; với vị trí k lấy nút trước = tuyến[k−1] nếu k > 0, ngược lại là kho; nút sau = tuyến[k] nếu k < m, ngược lại là “không có”, và chỉ cộng d(j,b) − d(a,b) khi có nút sau. Lỗi hay gặp nhất là coi nút trước của k = 0 là tuyến[−1] (ngoài mảng), hoặc cộng d(j,b) khi đang chèn cuối tuyến.",
      tieuChi: ["Viết đúng Δt chèn vào đầu: d₀(j) + d(j,b) − d₀(b) + s_j", "Viết đúng Δt chèn vào cuối: d(a,j) + s_j và nhận ra đó là greedy", "Giải thích Δt ≥ 0 bằng bất đẳng thức tam giác", "Nêu cách xử lý biên: kho là −1 qua một hàm khoảng cách chung, không cộng d(j,b) khi không có nút sau"]
    },
    {
      id: "l3", doKho: 3, ref: "§3.2.1, §3.3, Bài tập 7.3",
      hoi: "Hai ứng viên P và Q có điểm chèn v tại các vị trí như sau: P: 900, 880, 850; Q: 820, 300, 250. (a) Chèn rẻ nhất chọn ứng viên nào, regret chọn ứng viên nào? (b) Vì sao việc “hy sinh 80 điểm ngay bây giờ” có thể hợp lý? (c) Nêu một tình huống regret không còn lợi thế.",
      goiY: ["Regret = điểm chèn tốt nhất trừ điểm chèn tốt nhì.", "Chèn P làm đổi các cạnh của tuyến — điều gì xảy ra với vị trí tốt nhất của Q?"],
      mau: "(a) Chèn rẻ nhất chọn **P** (900 > 820). Regret: P = 900 − 880 = 20, Q = 820 − 300 = 520 ⇒ regret chọn **Q**.\n\n(b) Q chỉ có **một** vị trí tốt (820), các vị trí khác tệ (300). Nếu lấy P trước, chèn P đổi các cạnh nên vị trí tốt nhất của Q rất có thể bị phá, Q tụt xuống 300 — mất 520. Nếu lấy Q trước thì P vẫn còn 880 — chỉ mất 20. Hy sinh 900 − 820 = 80 điểm hôm nay để tránh mất cỡ 500 điểm ở bước sau: tối ưu cái còn giữ được sau bước này, không tối ưu riêng bước này.\n\n(c) Khi tuyến còn thưa và có nhiều chỗ trống, vị trí tốt nhất của đơn không bị chiếm, giả định của regret sai và nó chỉ tốn thêm công (cần hai vị trí tốt nhất, khoảng 1,5 lần chi phí). Một lưu ý khi áp dụng cho bài **chọn lọc** như P1: regret thuần (chỉ v⁽¹⁾ − v⁽²⁾) có thể chọn phải đơn có regret lớn nhưng giá trị thấp; nên cộng thêm v⁽¹⁾ vào chỉ số (ví dụ v⁽¹⁾ + 0,5·regret) hoặc chỉ xét ứng viên có v⁽¹⁾ > 0.",
      tieuChi: ["Chọn đúng: chèn rẻ nhất → P, regret → Q (regret 20 và 520)", "Giải thích: lấy P trước có thể phá vị trí tốt của Q (mất ~520), lấy Q trước chỉ mất 20 ở P", "Nêu được tình huống regret không thắng (tuyến thưa, vị trí tốt không bị chiếm)"]
    },
    {
      id: "l4", doKho: 3, ref: "§5.3, §5.4, Bài tập 7.4",
      hoi: "Một đồng đội đề xuất: “chia bản đồ của bài 5 ngày (P2) thành 5 vùng bằng k-means, mỗi ngày phục vụ một vùng”. Hãy phản biện bằng ba câu tự kiểm của §5.4 và nêu kết quả bạn kỳ vọng so với chiến lược “chèn toàn cục”.",
      goiY: ["Các ngày nối tiếp nhau (vị trí không reset) thì chuyển giữa các vùng có tốn gì thêm không?", "Mỗi ranh giới cụm thu hẹp không gian nghiệm — nghiệm tối ưu nằm ở đâu?"],
      mau: "Ba câu tự kiểm:\n\n1. **Có chi phí thật khi chuyển giữa các cụm không?** Trong đề thi thật các ngày nối tiếp nhau, nên không có chi phí “quay về vùng” — ranh giới cụm chỉ là ràng buộc ta tự áp lên mình.\n2. **Số cụm có do bài toán quy định không?** K = 5 ở đây do ta chọn: thêm một tham số phải tinh chỉnh, và mỗi tham số là một cơ hội tinh chỉnh quá đà (Bài 4 §9).\n3. **Nghiệm tối ưu có nhất thiết tôn trọng ranh giới cụm không?** Gần như không: mỗi ranh giới là một lát cắt xuyên không gian nghiệm và nghiệm tối ưu có thể nằm bên kia — cụ thể nó làm mất tự do chọn ngôi nhà cuối ngày, đòn bẩy số 1 (lấp đầy tới sát 720 phút).\n\nGom cụm cứng đóng băng một quyết định trước khi có đủ thông tin, vi phạm “không ràng buộc sớm hơn mức cần thiết” (Bài 3). Kỳ vọng theo tài liệu: kết quả nằm **giữa** lấp đầy tuần tự và chèn toàn cục — tốt hơn tuần tự nhưng kém chèn toàn cục. Dù vậy, luôn đo trước khi tin.",
      tieuChi: ["Nêu câu 1 và nhận ra không có chi phí chuyển cụm thật khi các ngày nối tiếp", "Nêu câu 2: K do ta chọn nên là thêm một tham số cần tinh chỉnh", "Nêu câu 3: ranh giới cụm thu hẹp không gian nghiệm, chặn mất ngôi nhà cuối ngày", "Dự đoán kết quả nằm giữa và kém chèn toàn cục, kèm ý phải đo để kiểm"]
    }
  ],

  lab: [
    {
      id: "delta-t-tiec-nuoi",
      ten: "Chi phí chèn Δt, vị trí tốt nhất và tiếc nuối",
      doKho: 1,
      ref: "§2.2, §3.2, §8 (cạm bẫy 1)",
      de: "Một tuyến đang đi từ kho (50,50) qua `m` nút `r₁ … r_m` theo thứ tự (không quay về). Có một đơn mới `j` ở `(x, y)`, giao mất `s` phút. Chèn `j` được vào `m + 1` vị trí `k = 0 … m` (k = 0: ngay trước `r₁`, nút trước là **kho**; k = m: sau `r_m`, **không có nút sau**).\n\n" +
          "Hãy in: (1) `m + 1` giá trị Δt(j, k) theo công thức §2.2 — chú ý hai vị trí biên; (2) `k*`, vị trí có Δt nhỏ nhất (hoà thì lấy k nhỏ hơn); (3) tiếc nuối theo Δt = Δt nhỏ thứ nhì trừ Δt nhỏ nhất (tiếc nuối theo điểm p − λ·Δt chỉ là λ lần số này).\n\n" +
          "Chấm trên 10 bộ dữ liệu, so từng giá trị. Sau khi qua, đổi sang biến thể *Ứng viên nằm ngay trên đường* và nhìn lại: Δt nhỏ nhất so với s ra sao, và vì sao Δt không bao giờ âm? Vị trí tốt nhất khác các vị trí còn lại bao nhiêu — nghĩa là tiếc nuối lúc này lớn hay nhỏ?",
      vanDe: "b07-delta-t",
      tham: { mLo: 2, mHi: 5 },
      bienThe: [
        { ten: "Tuyến ngắn (2–5 nút)", tham: { mLo: 2, mHi: 5 } },
        { ten: "Tuyến dài (6–10 nút)", tham: { mLo: 6, mHi: 10 } },
        { ten: "Ứng viên nằm ngay trên đường", tham: { mLo: 3, mHi: 7, tren: true } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "m"; dòng 2 "50 50" (kho); m dòng "x y" (các nút của tuyến); dòng cuối "x y s" (đơn cần chèn).
// Đầu ra : m+1 giá trị Δt(0..m), rồi k* (vị trí Δt nhỏ nhất, hoà thì k nhỏ), rồi tiếc nuối = Δt nhỏ nhì − Δt nhỏ nhất.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], kx = t[1], ky = t[2];
const rx = [], ry = [];
for (let i = 0; i < m; i++) { rx.push(t[3 + 2 * i]); ry.push(t[4 + 2 * i]); }
const jx = t[3 + 2 * m], jy = t[4 + 2 * m], sj = t[5 + 2 * m];

const d = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

const dt = [];
for (let k = 0; k <= m; k++) {
  // TODO: nút trước a = (k === 0 ? kho : r[k-1]); nút sau b = r[k] nếu k < m, không có nếu k === m.
  //       Δt = d(a,j) + s_j + (có b ? d(j,b) − d(a,b) : 0)
  dt.push(0);
}

let kTot = 0;
// TODO: kTot = chỉ số có dt nhỏ nhất (hoà thì chỉ số nhỏ hơn)
const tiecNuoi = 0;   // TODO: dt nhỏ nhì − dt nhỏ nhất

print(dt.join(" "));
print(kTot);
print(tiecNuoi);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int m, kx, ky;
    scanf("%d %d %d", &m, &kx, &ky);
    vector<int> rx(m), ry(m);
    for (int i = 0; i < m; i++) scanf("%d %d", &rx[i], &ry[i]);
    int jx, jy, sj;
    scanf("%d %d %d", &jx, &jy, &sj);

    auto d = [](int x1, int y1, int x2, int y2) { return abs(x1 - x2) + abs(y1 - y2); };

    vector<int> dt;
    for (int k = 0; k <= m; k++) {
        // TODO: nút trước a = (k == 0 ? kho : r[k-1]); nút sau b = r[k] nếu k < m, không có nếu k == m.
        //       Δt = d(a,j) + s_j + (có b ? d(j,b) − d(a,b) : 0)
        dt.push_back(0);
    }

    int kTot = 0;
    // TODO: kTot = chỉ số có dt nhỏ nhất (hoà thì chỉ số nhỏ hơn)
    int tiecNuoi = 0;   // TODO: dt nhỏ nhì − dt nhỏ nhất

    for (int k = 0; k <= m; k++) printf("%d%c", dt[k], k < m ? ' ' : '\n');
    printf("%d\n%d\n", kTot, tiecNuoi);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const m = t[0], kx = t[1], ky = t[2];
const rx = [], ry = [];
for (let i = 0; i < m; i++) { rx.push(t[3 + 2 * i]); ry.push(t[4 + 2 * i]); }
const jx = t[3 + 2 * m], jy = t[4 + 2 * m], sj = t[5 + 2 * m];

const d = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

const dt = [];
for (let k = 0; k <= m; k++) {
  const ax = k === 0 ? kx : rx[k - 1], ay = k === 0 ? ky : ry[k - 1];   // k = 0: nút trước là kho
  let them = d(ax, ay, jx, jy) + sj;
  if (k < m) them += d(jx, jy, rx[k], ry[k]) - d(ax, ay, rx[k], ry[k]); // k = m: không có nút sau
  dt.push(them);
}

let kTot = 0;
for (let k = 1; k <= m; k++) if (dt[k] < dt[kTot]) kTot = k;
const sx = dt.slice().sort((a, b) => a - b);

print(dt.join(" "));
print(kTot);
print(sx[1] - sx[0]);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int m, kx, ky;
    scanf("%d %d %d", &m, &kx, &ky);
    vector<int> rx(m), ry(m);
    for (int i = 0; i < m; i++) scanf("%d %d", &rx[i], &ry[i]);
    int jx, jy, sj;
    scanf("%d %d %d", &jx, &jy, &sj);

    auto d = [](int x1, int y1, int x2, int y2) { return abs(x1 - x2) + abs(y1 - y2); };

    vector<int> dt;
    for (int k = 0; k <= m; k++) {
        int ax = k == 0 ? kx : rx[k - 1], ay = k == 0 ? ky : ry[k - 1];   // k = 0: nút trước là kho
        int them = d(ax, ay, jx, jy) + sj;
        if (k < m) them += d(jx, jy, rx[k], ry[k]) - d(ax, ay, rx[k], ry[k]);   // k = m: không có nút sau
        dt.push_back(them);
    }

    int kTot = 0;
    for (int k = 1; k <= m; k++) if (dt[k] < dt[kTot]) kTot = k;
    vector<int> sx = dt;
    sort(sx.begin(), sx.end());

    for (int k = 0; k <= m; k++) printf("%d%c", dt[k], k < m ? ' ' : '\n');
    printf("%d\n%d\n", kTot, sx[1] - sx[0]);
    return 0;
}
`
      },
      goiY: [
        "Với k = 0 nút trước là kho (50,50); với k = m không có nút sau — khi đó Δt chỉ là d(a,j) + s.",
        "Viết sẵn hàm d(x1,y1,x2,y2) và dùng nó ở mọi nơi; khi có nút sau cộng thêm d(j,b) − d(a,b).",
        "Tiếc nuối: sắp bản sao của mảng Δt tăng dần, lấy phần tử thứ hai trừ phần tử đầu (m ≥ 1 nên luôn có ít nhất 2 vị trí)."
      ]
    },
    {
      id: "chen-re-nhat-ship1",
      ten: "Chèn rẻ nhất cho ship hàng (P1) — vượt greedy cuối tuyến",
      doKho: 2,
      ref: "§1, §2, §6, Bài 6 §5.3",
      de: "P1: lưới 100×100, kho (50,50), `n = 120` đơn, ngày 480 phút, **không cần quay về**, vượt giờ là không hợp lệ. Thay vì nối vào cuối như greedy, hãy cài **chèn rẻ nhất** (§2.1): lặp — xét **mọi** đơn chưa dùng và **mọi** vị trí `k = 0 … m` của tuyến hiện tại, tính `Δt = d(a,j) + d(j,b) − d(a,b) + s_j` (hai biên: a là kho; không có b), bỏ cặp nào làm tổng thời gian vượt `T`, rồi chèn cặp có điểm `v = p − λ·Δt` cao nhất, kể cả khi v âm. Dừng khi không cặp nào vừa giờ.\n\n" +
          "Chọn λ bằng **quét thực nghiệm** (Bài 6 §5.3): chạy chèn với nhiều λ trên từng test và giữ tuyến nhiều tiền nhất. Thang điểm ở đây khác bài giảng (`p` từ 100 đến 1 000), nên λ tốt nằm quanh 6–40 (tuỳ test), không phải 80. Mẹo hiệu năng: tính thời gian hiện tại của tuyến **một lần** ngoài vòng lặp trong (§8, cạm bẫy 2).\n\n" +
          "**Mức đạt:** hợp lệ → bằng greedy tỉ số → hơn tỉ số 4 % → đạt 93 % lời giải mạnh (chèn + phá-sửa) của khoá. Khi đã qua hãy thử: (1) λ = 0 thì sao? (§6, Bài 6 §6.3) (2) đổi sang dữ liệu *gom cụm* — lợi thế so với tỉ số thu hẹp hay nới rộng? (§6.3b) (3) thử đổi chỉ số chèn từ p − λ·Δt sang p/(Δt + 1) và so sánh.",
      vanDe: "ship1",
      tham: { n: 120 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      muc: [
        { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 },
        { ten: "Hơn greedy theo tỉ số 4 %", so: "tiSo", heSo: 1.04 },
        { ten: "Đạt 93 % lời giải mạnh (chèn + phá-sửa)", so: "tot", heSo: 0.93 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: "n T", rồi toạ độ kho "kx ky", rồi n dòng "x y p s".
// Đầu ra : dòng 1 là k (số đơn giao), dòng 2 là k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}
const dKho = (i) => Math.abs(x[i] - kx) + Math.abs(y[i] - ky);
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

// Chèn rẻ nhất với chỉ số p − lam·Δt; trả về { tuyen: [chỉ số 0-based theo thứ tự ghé], tien }.
function chenReNhat(lam) {
  const tuyen = [];
  const daDung = new Array(n).fill(false);
  let tg = 0, tien = 0;                 // tg: thời gian hiện tại của cả tuyến — tính MỘT lần, cập nhật khi chèn
  // TODO: lặp — với MỌI đơn j chưa dùng và MỌI vị trí k = 0..tuyen.length:
  //   a = (k === 0 ? kho : tuyen[k-1]);  b = tuyen[k] nếu k < tuyen.length, không có nếu k === tuyen.length
  //   Δt = d(a,j) + s[j] + (có b ? d(j,b) − d(a,b) : 0)
  //   bỏ qua nếu tg + Δt > T;  điểm v = p[j] − lam·Δt
  //   chèn cặp (j, k) có v lớn nhất bằng tuyen.splice(k, 0, j); dừng khi không còn cặp nào vừa giờ.
  return { tuyen, tien };
}

// TODO: quét lam (ví dụ 4, 6, ..., 40) và giữ kết quả có tien lớn nhất.
const tot = chenReNhat(10);

print(tot.tuyen.length);
print(tot.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;

int dKho(int i) { return abs(x[i] - kx) + abs(y[i] - ky); }
int d(int a, int b) { return abs(x[a] - x[b]) + abs(y[a] - y[b]); }

// Chèn rẻ nhất với chỉ số p − lam·Δt; trả về tuyến (chỉ số 0-based theo thứ tự ghé), gán tien.
vector<int> chenReNhat(double lam, long long &tien) {
    vector<int> tuyen;
    vector<bool> daDung(n, false);
    int tg = 0;                         // thời gian hiện tại của cả tuyến — tính MỘT lần, cập nhật khi chèn
    tien = 0;
    // TODO: lặp — với MỌI đơn j chưa dùng và MỌI vị trí k = 0..tuyen.size():
    //   a = (k == 0 ? kho : tuyen[k-1]);  b = tuyen[k] nếu k < tuyen.size(), không có nếu k == tuyen.size()
    //   Δt = d(a,j) + s[j] + (có b ? d(j,b) − d(a,b) : 0)
    //   bỏ qua nếu tg + Δt > T;  điểm v = p[j] − lam·Δt
    //   chèn cặp (j, k) có v lớn nhất bằng tuyen.insert(tuyen.begin() + k, j); dừng khi không còn cặp nào vừa giờ.
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    // TODO: quét lam (ví dụ 4, 6, ..., 40) và giữ tuyến có tien lớn nhất.
    long long tien = 0;
    vector<int> tot = chenReNhat(10, tien);

    printf("%d\n", (int)tot.size());
    for (size_t i = 0; i < tot.size(); i++) printf("%d%c", tot[i] + 1, i + 1 < tot.size() ? ' ' : '\n');
    if (tot.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}
const dKho = (i) => Math.abs(x[i] - kx) + Math.abs(y[i] - ky);
const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);

function chenReNhat(lam) {
  const tuyen = [];
  const daDung = new Array(n).fill(false);
  let tg = 0, tien = 0;
  for (;;) {
    let tot = -1, viTri = -1, vTot = -Infinity, dtTot = 0;
    for (let j = 0; j < n; j++) {
      if (daDung[j]) continue;
      for (let k = 0; k <= tuyen.length; k++) {
        const a = k === 0 ? -1 : tuyen[k - 1];                    // -1 = kho
        const coSau = k < tuyen.length, b = coSau ? tuyen[k] : -1;
        let dt = (a < 0 ? dKho(j) : d(a, j)) + s[j];              // d(a,j) + s_j
        if (coSau) dt += d(j, b) - (a < 0 ? dKho(b) : d(a, b));   // + d(j,b) − d(a,b)
        if (tg + dt > T) continue;                                // không vừa giờ
        const v = p[j] - lam * dt;                                // giá trị ròng, không có ngưỡng v > 0
        if (v > vTot) { vTot = v; tot = j; viTri = k; dtTot = dt; }
      }
    }
    if (tot < 0) break;
    tuyen.splice(viTri, 0, tot);
    daDung[tot] = true; tg += dtTot; tien += p[tot];
  }
  return { tuyen, tien };
}

let tot = null;
for (let lam = 4; lam <= 40; lam += 2) {                          // quét thực nghiệm trên từng test
  const r = chenReNhat(lam);
  if (!tot || r.tien > tot.tien) tot = r;
}
print(tot.tuyen.length);
print(tot.tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, T, kx, ky;
vector<int> x, y, p, s;

int dKho(int i) { return abs(x[i] - kx) + abs(y[i] - ky); }
int d(int a, int b) { return abs(x[a] - x[b]) + abs(y[a] - y[b]); }

vector<int> chenReNhat(double lam, long long &tien) {
    vector<int> tuyen;
    vector<bool> daDung(n, false);
    int tg = 0;
    tien = 0;
    for (;;) {
        int tot = -1, viTri = -1, dtTot = 0;
        double vTot = -1e18;
        for (int j = 0; j < n; j++) {
            if (daDung[j]) continue;
            for (int k = 0; k <= (int)tuyen.size(); k++) {
                int a = k == 0 ? -1 : tuyen[k - 1];                    // -1 = kho
                bool coSau = k < (int)tuyen.size();
                int b = coSau ? tuyen[k] : -1;
                int dt = (a < 0 ? dKho(j) : d(a, j)) + s[j];           // d(a,j) + s_j
                if (coSau) dt += d(j, b) - (a < 0 ? dKho(b) : d(a, b)); // + d(j,b) − d(a,b)
                if (tg + dt > T) continue;                             // không vừa giờ
                double v = p[j] - lam * dt;                            // giá trị ròng, không có ngưỡng v > 0
                if (v > vTot) { vTot = v; tot = j; viTri = k; dtTot = dt; }
            }
        }
        if (tot < 0) break;
        tuyen.insert(tuyen.begin() + viTri, tot);
        daDung[tot] = true; tg += dtTot; tien += p[tot];
    }
    return tuyen;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    x.resize(n); y.resize(n); p.resize(n); s.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    vector<int> tot;
    long long tienTot = -1;
    for (int lam = 4; lam <= 40; lam += 2) {                           // quét thực nghiệm trên từng test
        long long tien;
        vector<int> r = chenReNhat(lam, tien);
        if (tien > tienTot) { tienTot = tien; tot = r; }
    }

    printf("%d\n", (int)tot.size());
    for (size_t i = 0; i < tot.size(); i++) printf("%d%c", tot[i] + 1, i + 1 < tot.size() ? ' ' : '\n');
    if (tot.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Viết dt theo ba bước: d(a,j) + s_j, rồi nếu có nút sau cộng thêm d(j,b) − d(a,b). Với k = 0, a là kho; với k = tuyen.length, không có b.",
        "Giữ biến tg (thời gian cả tuyến) và cộng dt của cặp được chèn — đừng tính lại thời gian của cả tuyến trong vòng lặp trong cùng. Điều kiện còn vừa giờ là tg + dt ≤ T.",
        "Đừng đặt điều kiện v > 0. Bọc chenReNhat(lam) trong vòng lặp lam = 4, 6, …, 40 và giữ tuyến có tổng tiền lớn nhất; lam cố định (ví dụ 10) thường thắng tỉ số trên dữ liệu rải đều nhưng yếu hơn trên dữ liệu gom cụm."
      ]
    }
  ]
});
