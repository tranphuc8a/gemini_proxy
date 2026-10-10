/* Thực hành — Bài 04B (mở rộng): Phân bổ công sức — tiền nằm ở đâu trong một đề heuristic. */

/* ---------------------------------------------------------------------------------------------
   Bài toán tự dựng — "năng suất" của từng loại việc từ bảng ablation (§1) + EV của từng việc dự định (§2)
   + kế hoạch theo EV trong quỹ giờ H.
   stdin : a b H / a dòng "loai phanTram gio" / b dòng "P D gio"
     loai 1..4 = đọc grader | mô hình hoá, định giá | tìm kiếm | tinh chỉnh; phanTram: đơn vị 0,01 % điểm mất khi tắt; gio: phút
     P: xác suất thành công (%); D: lợi nếu trúng, đơn vị 0,1 %; gio: phút
   stdout: 4 năng suất, gap, tot, b giá trị EV, tong
   --------------------------------------------------------------------------------------------- */
(function () {
  var TI = TH.tienIch;
  /* Số liệu của bài giảng (đề 2607, §1 và §2). */
  var BANG_BAI = {
    rows: [[1, 308, 30], [3, 243, 180], [2, 243, 90], [2, 45, 60], [4, 22, 60], [4, 10, 60], [4, 1, 60]],
    viec: [[50, 30, 30], [15, 300, 30], [60, 25, 90], [70, 20, 120], [50, 25, 180], [40, 5, 120]]
  };
  function khongHoa(viec) {                      /* không có hai việc cùng EV (tránh phá hoà phụ thuộc số thực) */
    for (var i = 0; i < viec.length; i++) for (var j = i + 1; j < viec.length; j++) {
      if (viec[i][0] * viec[i][1] * viec[j][2] === viec[j][0] * viec[j][1] * viec[i][2]) return false;
    }
    return true;
  }
  function giai(inst) {
    var pct = [0, 0, 0, 0], gio = [0, 0, 0, 0], i;
    inst.rows.forEach(function (r) { pct[r[0] - 1] += r[1] / 100; gio[r[0] - 1] += r[2] / 60; });
    var ns = [], duong = [];
    for (i = 0; i < 4; i++) { ns.push(gio[i] > 0 ? pct[i] / gio[i] : 0); if (ns[i] > 0) duong.push(ns[i]); }
    var gap = duong.length >= 2 ? Math.max.apply(null, duong) / Math.min.apply(null, duong) : 0, tot = 0;
    for (i = 1; i < 4; i++) if (ns[i] > ns[tot]) tot = i;
    var loi = inst.viec.map(function (v) { return (v[0] / 100) * (v[1] / 10); });
    var ev = inst.viec.map(function (v, j) { return loi[j] / (v[2] / 60); });
    var thuTu = ev.map(function (_, j) { return j; }).sort(function (x, y) { return ev[y] - ev[x] || x - y; });
    var con = inst.H, tong = 0;
    thuTu.forEach(function (j) { if (inst.viec[j][2] <= con) { con -= inst.viec[j][2]; tong += loi[j]; } });
    return [ns, gap, tot + 1, ev, tong];
  }
  TH.vande.dangKy("b04b-nang-suat-viec", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TI.rng(seed), H = tham.H || 240, rows = [], viec = [];
      if (tham.kieu === "bai") {                  /* số liệu trong bài, chỉ xáo thứ tự dòng */
        rows = TI.tron(BANG_BAI.rows, r); viec = TI.tron(BANG_BAI.viec, r);
        return { H: H, rows: rows, viec: viec };
      }
      var cfg = [[150, 400, 20, 60], [40, 300, 60, 180], [100, 300, 120, 240], [1, 40, 45, 90]];
      for (var lan = 0; lan < 100; lan++) {
        rows = []; viec = [];
        for (var k = 0; k < 4; k++) {
          var cnt = r.khoang(1, 3);
          for (var c = 0; c < cnt; c++) rows.push([k + 1, r.khoang(cfg[k][0], cfg[k][1]), 5 * r.khoang(cfg[k][2] / 5, cfg[k][3] / 5)]);
        }
        var nv = r.khoang(6, 8);
        for (var j = 0; j < nv; j++) viec.push([5 * r.khoang(2, 18), r.khoang(3, 300), 15 * r.khoang(2, 16)]);
        if (khongHoa(viec)) break;
      }
      return { H: H, rows: TI.tron(rows, r), viec: viec };
    },
    viet: function (inst) {
      var o = inst.rows.length + " " + inst.viec.length + " " + inst.H + "\n";
      inst.rows.forEach(function (r) { o += r.join(" ") + "\n"; });
      inst.viec.forEach(function (v) { o += v.join(" ") + "\n"; });
      return o;
    },
    giai: giai,
    saiSo: 0.01,
    dinhDang: {
      vao: "Dòng 1: `a b H` — số dòng ablation, số việc dự định, quỹ giờ (phút). Tiếp theo `a` dòng `loai phanTram gio` (loại 1..4; phần trăm điểm mất khi tắt, đơn vị 0,01 %; số phút bỏ ra). Tiếp theo `b` dòng `P D gio` (xác suất thành công %, lợi nếu trúng đơn vị 0,1 %, số phút).",
      ra: "Một dòng: 4 năng suất (%/giờ) của loại 1..4, rồi `gap`, rồi `tot`, rồi `b` giá trị EV (theo thứ tự đầu vào), rồi `tong` — xem đề."
    }
  }));
})();

TH.dangKy({
  id: "bai-04b-phan-bo-cong-suc",

  tomTat: [
    "**Phát hiện trung tâm:** ba đề thi thật (2605: +10,27 %; 2607: +7,17 %; 2609: +6,67 %, trong đó 0 % từ tìm kiếm) cùng cho một kết luận — công sức đổ vào **hiểu bài toán** (đọc grader, mô hình hoá, định giá tài nguyên, đọc hàm mục tiêu) sinh lợi cao hơn công sức đổ vào **tìm kiếm mạnh hơn**, thường gấp nhiều lần.",
    "Năng suất = % điểm thu được / giờ bỏ ra. Ablation đề 2607: đọc mã grader **6,2 %/giờ**, mô hình hoá/định giá 1,15, tìm kiếm (beam) 0,81, tinh chỉnh tham số **0,11** — chênh nhau **56 lần** giữa đầu và cuối bảng.",
    "**EV = P(thành công) × Δ / giờ** — ước lượng được *trước khi làm*. Việc “hỏi 6 câu về cấu trúc hàm mục tiêu” có EV 9,0 dù P chỉ 0,15: cược rẻ (tối đa mất 30 phút), trần lỗ rõ, phần thưởng có thể là cả bài toán.",
    "Dựng bộ chấm và tính cận trên không có EV vì chúng là **điều kiện cần** (không có bộ chấm thì không đo được gì; không có cận trên thì không biết lúc nào dừng) — làm trước khi bắt tay vào cải tiến.",
    "Đường cong lợi ích giảm dần có ba đoạn: ① đọc đề, mô hình hoá (3–10 %/giờ) → ② local search, định giá, beam (1–3) → ③ tinh chỉnh (0,1–0,5). Sang đoạn ③ khi hai thay đổi liên tiếp nhỏ hơn nhiễu đo, hoặc đã trên 95 % cận trên, hoặc bắt đầu tinh chỉnh tham số — lúc đó nên kiểm độ bền, giữ phương án dự phòng và **nộp**.",
    "Ba câu hỏi trước mọi việc hơn một giờ: nếu thành công thì đáng bao nhiêu **phần trăm** điểm? xác suất bao nhiêu (đã thành công ở đề tương tự chưa)? **bao lâu** thì biết nó thất bại (điểm dừng)? Không trả lời được bằng số thì không làm.",
    "Kết quả âm tính là dữ liệu đắt giá: 2-opt/Or-opt làm quãng đường giảm 20–30 % nhưng **điểm giảm 6–10 %**. Một cải thiện ở đại lượng thay thế có thể đi ngược mục tiêu thật — luôn đo bằng điểm số, và ghi kết quả âm tính vào nhật ký.",
    "Đóng băng bản tốt nhất đã kiểm chứng ở T−45 phút và nộp **bản đã kiểm chứng**, không phải bản mới nhất. Ngân sách mẫu 4 giờ: cỡ 35 % cho hiểu bài toán, 37 % cải tiến có đo, 28 % kiểm chứng và chốt an toàn."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "Bài này nói về chuyện gì",
      hoi: "Ba đề thi thật (2605: +10,27 %; 2607: +7,17 %; 2609: +6,67 % với 0 % đến từ tìm kiếm) cùng dẫn tới một kết luận. Kết luận đó là gì?",
      chon: [
        "Metaheuristic mạnh hơn (SA, Tabu…) luôn là nơi sinh lợi nhiều nhất",
        "Tinh chỉnh tham số nên làm đầu tiên vì rẻ nhất",
        "Công sức đổ vào hiểu bài toán (đọc grader, mô hình hoá, định giá, đọc hàm mục tiêu) sinh lợi cao hơn công sức đổ vào tìm kiếm mạnh hơn",
        "Tìm kiếm không có tác dụng gì trong các đề thi thật"
      ],
      dung: 2,
      giaiThich: "Ở cả ba đề, phần lớn cải thiện đến từ hiểu bài toán chứ không từ việc chọn metaheuristic hay hơn (đề 2609: 0 % từ tìm kiếm). Nhưng đừng nói quá: tìm kiếm **có** đóng góp thật (beam bề rộng → 1 làm mất 2,43 %), chỉ là đắt và không đứng đầu bảng; còn tinh chỉnh tham số đứng cuối bảng (0,11 %/giờ), nên không phải việc đầu tiên."
    },
    {
      id: "q2", loai: "so", doKho: 2, ref: "§1", donVi: "(%/giờ)",
      hoi: "Đề 2607: tắt “khung ngày thứ 31” làm mất 3,08 % điểm, và việc tìm ra nó (đọc mã grader) tốn khoảng 0,5 giờ. Năng suất của loại việc “đọc mã grader” là bao nhiêu %/giờ?",
      dapAn: 6.16, saiSo: 0.01,
      giaiThich: "Năng suất = % thu được / giờ bỏ ra = 3,08 / 0,5 = 6,16 %/giờ (bài làm tròn 6,2). Đây là dòng đứng đầu bảng năng suất."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§1", donVi: "(lần)",
      hoi: "Cùng đề 2607: năng suất đọc mã grader là 6,16 %/giờ; ba thành phần tinh chỉnh (multi-start λ −0,22 %, thưởng ρ −0,10 %, số hạng mật độ σ −0,01 %) tốn 3 giờ. Năng suất đọc mã grader gấp bao nhiêu lần năng suất tinh chỉnh tham số?",
      dapAn: 56, saiSo: 1,
      giaiThich: "Tinh chỉnh: (0,22 + 0,10 + 0,01) % / 3 giờ = 0,33 / 3 = 0,11 %/giờ. Tỉ số 6,16 / 0,11 = 56. Nửa giờ đọc mã grader thu 3,08 %, nhiều hơn gấp chín lần ba giờ tinh chỉnh (0,33 %)."
    },
    {
      id: "q4", loai: "so", doKho: 2, ref: "§2", donVi: "(%/giờ)",
      hoi: "Bạn cân nhắc “đổi sang metaheuristic mạnh hơn”: xác suất thành công P = 0,5, nếu trúng thì tăng Δ = 2,5 % điểm, tốn 3 giờ. Giá trị kỳ vọng EV = P × Δ / giờ là bao nhiêu %/giờ? (làm tròn 2 chữ số thập phân)",
      dapAn: 0.42, saiSo: 0.01,
      giaiThich: "EV = 0,5 × 2,5 % / 3 giờ = 1,25 / 3 ≈ 0,4167 ≈ 0,42 %/giờ. So với bảng §2: thấp hơn định giá bằng giá mờ (1,0) và local search (0,7), cao hơn tinh chỉnh tham số (0,10)."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§2.1",
      hoi: "Vì sao việc “hỏi 6 câu về cấu trúc hàm mục tiêu” đứng đầu bảng EV (9,0 %/giờ) dù xác suất thành công chỉ 0,15?",
      chon: [
        "Vì mọi đề thi đều có cấu trúc hàm mục tiêu khai thác được",
        "Vì Δ nếu trúng rất lớn (cỡ 30 %, có khi là cả bài toán), trong khi chi phí chỉ nửa giờ và trần lỗ rõ ràng",
        "Vì xác suất 0,15 là xác suất cao nhất trong cả bảng",
        "Vì EV chỉ phụ thuộc vào Δ, không phụ thuộc xác suất hay giờ"
      ],
      dung: 1,
      giaiThich: "EV = 0,15 × 30 % / 0,5 giờ = 9,0. Đa số đề không có cấu trúc khai thác được nên P thấp, nhưng khi có thì phần thưởng là cả bài toán (đề 2609: +6,67 % và gỡ luôn 17 % test vượt giờ). Đó là loại “cược rẻ, trần lỗ rõ ràng”: tối đa mất 30 phút, được nhiều nhất là mọi thứ — luôn đáng đặt. EV phụ thuộc cả ba đại lượng P, Δ và giờ."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§3.1",
      hoi: "Bạn đang ở trên 95 % cận trên, và hai thay đổi liên tiếp đều cho chênh lệch nhỏ hơn nhiễu đo. Việc hợp lý nhất bây giờ là gì?",
      chon: [
        "Kiểm tra độ bền, giữ phương án dự phòng và nộp",
        "Tinh chỉnh thêm nhiều tham số vì giờ nào cũng còn cho thêm điểm",
        "Đổi sang một metaheuristic mạnh hơn để tìm cú nhảy lớn",
        "Viết lại greedy từ đầu"
      ],
      dung: 0,
      giaiThich: "Cả hai dấu hiệu (trên 95 % cận trên; hai thay đổi liên tiếp nhỏ hơn nhiễu đo) cho thấy bạn đã sang đoạn ③ của đường cong, nơi mỗi giờ chỉ thu 0,1–0,5 %. Ở đó lựa chọn đúng thường không phải tối ưu tiếp mà là kiểm độ bền, viết phương án dự phòng và nộp. Mọi phương án còn lại là tiếp tục đổ giờ vào đoạn lợi ích thấp nhất."
    },
    {
      id: "q7", loai: "nhieu", doKho: 3, ref: "§4",
      hoi: "Trước khi bắt đầu một việc mất hơn một giờ, bài giảng yêu cầu bạn trả lời thành tiếng những câu nào?",
      chon: [
        "Việc này nghe có “oách” hơn các việc khác không?",
        "Nếu thành công, nó đáng bao nhiêu phần trăm điểm?",
        "Xác suất thành công bao nhiêu, và đã từng thành công ở đề tương tự chưa?",
        "Đồng đội của tôi có đang làm việc này không?",
        "Tôi sẽ biết nó thất bại sau bao lâu?"
      ],
      dung: [1, 2, 4],
      giaiThich: "Ba câu của §4: ① đáng bao nhiêu phần trăm điểm (không trả lời được bằng số ⇒ không làm), ② xác suất thành công và tiền lệ (“chắc là được” không phải một con số), ③ bao lâu thì biết thất bại — câu bị bỏ qua nhiều nhất và tốn kém nhất vì việc không có điểm dừng ăn hết ngân sách còn lại. Độ “oách” chính là cạm bẫy 1 (chọn việc theo vẻ ngoài thay vì theo EV); việc đồng đội làm gì không phải tiêu chí EV."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "§5, §8 (cạm bẫy 3)",
      hoi: "Ở đề 2607, thêm 2-opt/Or-opt làm quãng đường giảm 20–30 % nhưng điểm số giảm 6–10 %. Bài học đúng là gì?",
      chon: [
        "2-opt cài sai nên phải bỏ kết quả này đi",
        "Quãng đường ngắn hơn thì điểm gần như chắc chắn cao hơn",
        "Local search cổ điển của VRP luôn hợp với mọi đề giao hàng",
        "Cải thiện ở một chỉ số trung gian (quãng đường) có thể làm hàm mục tiêu thật tệ đi — luôn đo bằng điểm số, và phải ghi kết quả âm tính lại"
      ],
      dung: 3,
      giaiThich: "§5: trên tuyến đã tối ưu kiểu TSP, đơn kế tiếp luôn ở rất gần nên thời gian tiết kiệm ở cuối ngày không tái sử dụng được và chết hoàn toàn — quãng đường là đại lượng thay thế đi ngược mục tiêu thật. Không phải bug: kết quả này lặp lại và có cơ chế rõ. Kết quả âm tính phải được ghi vào nhật ký (Bài 4 §8) để lần thi sau khỏi trả tiền thêm lần nữa."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Câu 1",
      hoi: "Với bảng EV ở §2, hãy xếp hạng các việc theo EV. Nếu bạn chỉ có 2 giờ, bạn làm những việc nào, theo thứ tự nào? Giải thích cách bạn xử lý hai việc không có EV (dựng bộ chấm, tính cận trên).",
      goiY: ["Tính EV = P × Δ / giờ cho từng dòng có đủ ba số.", "Hai việc không có EV được gọi là gì trong bài? Chúng có thể bỏ không?"],
      mau: "EV từ cao xuống thấp: hỏi 6 câu về hàm mục tiêu **9,0** > đọc kỹ mã grader **3,0** > định giá tài nguyên bằng giá mờ **1,0** > thêm local search **0,7** > đổi sang metaheuristic mạnh hơn **0,42** > tinh chỉnh tham số **0,10**. Hai việc còn lại — dựng bộ chấm (1,0 giờ) và tính cận trên (0,5 giờ) — không có EV vì chúng là **điều kiện cần**, không trực tiếp sinh điểm: không có bộ chấm thì mọi việc khác không đo được, không có cận trên thì không biết lúc nào dừng.\n\nVới 2 giờ: bộ chấm (1,0 giờ) là không thể bỏ nếu muốn cải tiến có đo; phần còn lại dành cho hai việc EV cao nhất, vừa vặn 0,5 + 0,5 giờ: **hỏi 6 câu về hàm mục tiêu** và **đọc mã grader** — tổng 2 giờ (đúng thứ tự §7: đọc grader → 6 câu hỏi → bộ chấm). Cận trên (0,5 giờ) phải hoãn: với 2 giờ chưa tới lúc cần biết “đã gần trần chưa”; nếu muốn giữ nó thì phải bỏ một trong hai việc đầu, và nên bỏ việc có EV thấp hơn (đọc grader). Từ “định giá” trở xuống không còn chỗ.",
      tieuChi: ["Xếp đúng thứ tự EV: 9,0 > 3,0 > 1,0 > 0,7 > 0,42 > 0,10", "Nhận ra bộ chấm và cận trên là điều kiện cần (không có EV) và đưa bộ chấm vào kế hoạch", "Kế hoạch tổng ≤ 2 giờ, ưu tiên việc EV cao, bỏ việc EV thấp, và nêu rõ lý do hoãn hay giữ cận trên"]
    },
    {
      id: "l2", doKho: 2, ref: "Câu 3, §4.1",
      hoi: "Đặt điểm dừng cho ba việc bạn dự định làm ở đồ án P3 (ví dụ: tìm cấu trúc hàm mục tiêu, thêm một toán tử local search, đổi metaheuristic). Ghi cụ thể bao nhiêu phút và ngưỡng nào thì bỏ.",
      goiY: ["Mỗi điểm dừng cần đủ hai thứ: một mốc thời gian và một tiêu chí đo được.", "Tiêu chí đo được ở đây thường dựa vào nhiễu đo của Bài 4."],
      mau: "| Việc | Điểm dừng |\n|---|---|\n| Tìm cấu trúc hàm mục tiêu | 30 phút; hết 6 câu hỏi (Bài 18B) mà không câu nào trả lời “có” ⇒ dừng |\n| Thêm một toán tử local search | 1 giờ; chưa vượt nhiễu đo trên 100 test ⇒ bỏ |\n| Đổi metaheuristic | 2 giờ; chưa bằng bản cũ ⇒ quay về bản cũ |\n\nMỗi điểm dừng có hai phần: **mốc thời gian** (đặt đồng hồ thật) và **tiêu chí đo được** (vượt nhiễu đo 2·SE trên N test, hoặc chưa bằng bản cũ). Đồng hồ mà không có tiêu chí thì bạn dừng theo cảm giác; tiêu chí mà không có đồng hồ thì việc ăn hết ngân sách còn lại — đó là câu ③ của §4 và cạm bẫy 2.",
      tieuChi: ["Ba việc, mỗi việc có một mốc thời gian cụ thể (số phút)", "Mỗi việc có tiêu chí bỏ đo được (vượt nhiễu đo, chưa bằng bản cũ…)", "Giải thích vì sao thiếu điểm dừng thì một việc ăn hết ngân sách còn lại"]
    },
    {
      id: "l3", doKho: 3, ref: "Câu 4, §5",
      hoi: "Ở đề 2607, thêm 2-opt/Or-opt làm quãng đường giảm 20–30 % nhưng điểm số giảm 6–10 %. Hãy giải thích bằng lời của bạn vì sao, nêu bài học phương pháp luận, và đoán một họ đề khác mà 2-opt cũng sẽ thất bại.",
      goiY: ["Chuyện gì xảy ra với thời gian tiết kiệm được ở cuối mỗi ngày?", "Chi phí nằm ở hàm mục tiêu hay ở ràng buộc?"],
      mau: "Trên một tuyến đã tối ưu kiểu TSP, đơn kế tiếp luôn ở rất gần, nên thời gian tiết kiệm được ở cuối ngày **không tái sử dụng được**: nó rơi vào thời gian chết (Bài 4 §8.3 ghi cỡ 2 200 phút chết hoàn toàn) chứ không đổi thành thêm một việc nào. Quãng đường chỉ là **đại lượng thay thế**: chi phí nằm trong **ràng buộc** (ngày có độ dài cố định) chứ không nằm trong hàm mục tiêu, nên “rút ngắn đường” và “tăng điểm” là hai việc khác nhau.\n\nBài học: (1) đo bằng điểm số, không bằng chỉ số trung gian; (2) ghi kết quả âm tính vào nhật ký — biết trước “2-opt không ăn ở họ đề này” đáng ba giờ ở lần thi sau.\n\nHọ đề dự đoán cũng thất bại: bất kỳ bài định tuyến nhiều kỳ có **ngân sách cố định mỗi kỳ** mà mục tiêu là số việc hoặc giá trị hoàn thành chứ không phải độ dài (ví dụ giao hàng nhiều ngày, xếp lịch bảo trì theo ca) — rút ngắn đường không biến thời gian thừa cuối kỳ thành thêm việc.",
      tieuChi: ["Giải thích cơ chế: thời gian tiết kiệm ở cuối ngày không tái sử dụng được, thành thời gian chết", "Nêu bài học: đại lượng thay thế (quãng đường) có thể đi ngược mục tiêu thật; luôn đo bằng điểm số", "Nêu việc ghi kết quả âm tính vào nhật ký", "Dự đoán một họ đề hợp lý: ngân sách cố định mỗi kỳ và mục tiêu không phải độ dài"]
    }
  ],

  lab: [
    {
      id: "nang-suat-va-ev",
      ten: "Năng suất từng loại việc và kế hoạch theo EV",
      doKho: 2,
      ref: "§1, §2",
      de: "Trong bài, **năng suất** của một loại việc là `tổng % điểm thu được / tổng giờ bỏ ra` (bảng §1), còn **giá trị kỳ vọng** của một việc dự định làm là `EV = P × Δ / giờ` (§2). Hãy cài cả hai.\n\n" +
          "**Đầu vào:** dòng 1 `a b H` (số dòng ablation, số việc dự định, quỹ giờ tính bằng phút); `a` dòng `loai phanTram gio` — loại 1 = đọc mã grader, 2 = mô hình hoá/định giá, 3 = tìm kiếm, 4 = tinh chỉnh; `phanTram` là điểm mất khi tắt, đơn vị **0,01 %** (308 nghĩa là 3,08 %); `gio` là số phút bỏ ra. Rồi `b` dòng `P D gio` — xác suất thành công `P` (%), lợi nếu trúng `D` đơn vị **0,1 %** (30 nghĩa là 3,0 %), số phút.\n\n" +
          "**Nhiệm vụ** — in **một dòng** gồm, theo thứ tự:\n" +
          "1. Năng suất (%/giờ) của loại 1, 2, 3, 4 = `(Σ phanTram/100) / (Σ gio/60)`; in `0` nếu loại đó không có dòng nào.\n" +
          "2. `gap` = năng suất lớn nhất / nhỏ nhất (chỉ xét loại có năng suất > 0) — “chênh nhau bao nhiêu lần”; rồi `tot` = số thứ tự (1..4) của loại có năng suất cao nhất.\n" +
          "3. EV (%/giờ) của từng việc dự định, `(P/100) × (D/10) / (gio/60)`, theo thứ tự đầu vào.\n" +
          "4. `tong` = tổng % kỳ vọng `Σ (P/100) × (D/10)` của kế hoạch theo EV: xét các việc theo EV giảm dần; việc nào **còn vừa quỹ giờ `H`** thì làm (trừ `H`), việc không vừa thì **bỏ qua và xét việc kế tiếp** (không dừng).\n\n" +
          "Số thực in với ít nhất 3 chữ số thập phân; sai số cho phép 0,01. Chấm trên 10 bộ dữ liệu.\n\n" +
          "Thử tab *Số liệu trong bài (đề 2607)* và đối chiếu với bảng §1 (6,2 · 1,15 · 0,81 · 0,11, gấp 56 lần) và bảng §2. **Suy ngẫm:** xếp theo EV có chắc tối đa hoá tổng % kỳ vọng trong quỹ giờ `H` không? EV là một *tỉ số* — giống `p/w` ở Bài 5, nó đo hiệu quả chứ không đo độ vừa vặn với quỹ giờ. Hãy dựng một bộ số nhỏ mà làm theo EV bị thua một lựa chọn khác.",
      vanDe: "b04b-nang-suat-viec",
      bienThe: [
        { ten: "Số liệu ngẫu nhiên (đề khác)", tham: { H: 240 } },
        { ten: "Số liệu trong bài (đề 2607)", tham: { H: 240, kieu: "bai" } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "a b H"; a dòng "loai phanTram gio"; b dòng "P D gio".
// Đầu ra : MỘT dòng: ns1 ns2 ns3 ns4 gap tot ev_1..ev_b tong   (số thực in 3 chữ số thập phân)
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const a = t[0], b = t[1], H = t[2];
let o = 3;
const rows = [], viec = [];
for (let i = 0; i < a; i++, o += 3) rows.push([t[o], t[o + 1], t[o + 2]]);       // loai, phanTram (0,01 %), gio (phút)
for (let j = 0; j < b; j++, o += 3) viec.push([t[o], t[o + 1], t[o + 2]]);       // P (%), D (0,1 %), gio (phút)

// TODO 1: năng suất 4 loại = (tổng phanTram / 100) / (tổng gio / 60); 0 nếu loại không có dòng nào.
// TODO 2: gap = lớn nhất / nhỏ nhất trong các năng suất > 0; tot = loại (1..4) có năng suất cao nhất.
// TODO 3: ev[j] = (P / 100) * (D / 10) / (gio / 60).
// TODO 4: duyệt các việc theo ev giảm dần (hoà: chỉ số nhỏ trước); việc nào gio <= quỹ còn lại thì làm; tong = tổng (P / 100) * (D / 10).
const kq = [];
print(kq.map((x) => x.toFixed(3)).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b, H;
    scanf("%d %d %d", &a, &b, &H);
    vector<array<int, 3>> rows(a), viec(b);        // rows: loai, phanTram (0,01 %), gio ; viec: P (%), D (0,1 %), gio
    for (auto& r : rows) scanf("%d %d %d", &r[0], &r[1], &r[2]);
    for (auto& v : viec) scanf("%d %d %d", &v[0], &v[1], &v[2]);

    // TODO 1: năng suất 4 loại = (tổng phanTram / 100) / (tổng gio / 60); 0 nếu loại không có dòng nào.
    // TODO 2: gap = lớn nhất / nhỏ nhất trong các năng suất > 0; tot = loại (1..4) có năng suất cao nhất.
    // TODO 3: ev[j] = (P / 100) * (D / 10) / (gio / 60).
    // TODO 4: duyệt các việc theo ev giảm dần (hoà: chỉ số nhỏ trước); việc nào gio <= quỹ còn lại thì làm.
    vector<double> kq;   // ns1 ns2 ns3 ns4 gap tot ev_1..ev_b tong
    for (size_t i = 0; i < kq.size(); i++) printf("%.3f%c", kq[i], i + 1 < kq.size() ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const a = t[0], b = t[1], H = t[2];
let o = 3;
const pct = [0, 0, 0, 0], gio = [0, 0, 0, 0];
for (let i = 0; i < a; i++, o += 3) {
  const k = t[o] - 1;
  pct[k] += t[o + 1] / 100;                          // % điểm
  gio[k] += t[o + 2] / 60;                           // giờ
}
const ns = pct.map((v, k) => (gio[k] > 0 ? v / gio[k] : 0));       // năng suất %/giờ
const duong = ns.filter((v) => v > 0);
const gap = duong.length >= 2 ? Math.max(...duong) / Math.min(...duong) : 0;
let tot = 0;
for (let k = 1; k < 4; k++) if (ns[k] > ns[tot]) tot = k;

const P = [], D = [], G = [];
for (let j = 0; j < b; j++, o += 3) { P.push(t[o]); D.push(t[o + 1]); G.push(t[o + 2]); }
const loi = P.map((_, j) => (P[j] / 100) * (D[j] / 10));            // % kỳ vọng nếu làm việc j
const ev = P.map((_, j) => loi[j] / (G[j] / 60));                   // %/giờ
const thuTu = P.map((_, j) => j).sort((x, y) => ev[y] - ev[x] || x - y);
let con = H, tong = 0;
for (const j of thuTu) if (G[j] <= con) { con -= G[j]; tong += loi[j]; }   // không vừa thì bỏ qua, xét việc kế

const kq = [...ns, gap, tot + 1, ...ev, tong];
print(kq.map((x) => x.toFixed(3)).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b, H;
    scanf("%d %d %d", &a, &b, &H);
    double pct[4] = {0, 0, 0, 0}, gio[4] = {0, 0, 0, 0};
    for (int i = 0; i < a; i++) {
        int loai, ph, g;
        scanf("%d %d %d", &loai, &ph, &g);
        pct[loai - 1] += ph / 100.0;                  // % điểm
        gio[loai - 1] += g / 60.0;                    // giờ
    }
    double ns[4];
    for (int k = 0; k < 4; k++) ns[k] = gio[k] > 0 ? pct[k] / gio[k] : 0;
    double lon = 0, nho = 1e18;
    int tot = 0, dem = 0;
    for (int k = 0; k < 4; k++) {
        if (ns[k] > ns[tot]) tot = k;
        if (ns[k] > 0) { lon = max(lon, ns[k]); nho = min(nho, ns[k]); dem++; }
    }
    double gap = dem >= 2 ? lon / nho : 0;

    vector<int> G(b);
    vector<double> loi(b), ev(b);
    for (int j = 0; j < b; j++) {
        int P, D;
        scanf("%d %d %d", &P, &D, &G[j]);
        loi[j] = (P / 100.0) * (D / 10.0);            // % kỳ vọng nếu làm việc j
        ev[j] = loi[j] / (G[j] / 60.0);               // %/giờ
    }
    vector<int> thuTu(b);
    iota(thuTu.begin(), thuTu.end(), 0);
    sort(thuTu.begin(), thuTu.end(), [&](int x, int y) { return ev[x] != ev[y] ? ev[x] > ev[y] : x < y; });
    int con = H;
    double tong = 0;
    for (int j : thuTu) if (G[j] <= con) { con -= G[j]; tong += loi[j]; }   // không vừa thì bỏ qua, xét việc kế

    for (int k = 0; k < 4; k++) printf("%.3f ", ns[k]);
    printf("%.3f %d", gap, tot + 1);
    for (int j = 0; j < b; j++) printf(" %.3f", ev[j]);
    printf(" %.3f\n", tong);
    return 0;
}
`
      },
      goiY: [
        "Cộng dồn theo loại: mỗi dòng ablation đóng góp `phanTram/100` (đơn vị %) vào tử số và `gio/60` (đơn vị giờ) vào mẫu số của loại của nó — chia **sau khi** cộng xong, đừng trung bình các tỉ số.",
        "Chú ý hai đơn vị: `phanTram` tính theo 0,01 %, `D` tính theo 0,1 %, còn giờ đầu vào là phút. Với bảng trong bài, loại 1 phải ra 6,160 và `gap` phải ra 56,000.",
        "Kế hoạch theo EV giống hệt greedy theo tỉ số của Bài 5: sắp một lần, duyệt, làm việc nào còn vừa quỹ giờ, và **không `break`** khi gặp một việc không vừa."
      ]
    }
  ]
});
