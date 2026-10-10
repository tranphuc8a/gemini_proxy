/* Thực hành — Bài 18B: Đọc cấu trúc hàm mục tiêu (khi heuristic là câu trả lời sai).  Bài mở rộng. */

/* Bài toán tự dựng: tổng khoảng cách Manhattan giữa mọi cặp hạt trên lưới H×W (mỗi ô tối đa một hạt), n lớn.
   Hai vòng for lồng nhau là O(n²) ≈ 1,8·10⁹ phép — quá giờ; đổi thứ tự tổng + tách biến cho O(n + H + W).
   Mỗi bộ dữ liệu chỉ có một đáp án (số nguyên) nên dùng tuDapAn. Lời giải mong đợi tính bằng công thức lát cắt. */
TH.vande.dangKy("b18b-tong-cap-luoi", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var r = TH.tienIch.rng(seed), H = tham.H || 300, W = tham.W || 300, n = tham.n || 60000, tong = H * W, i, j, t;
    var o = new Int32Array(tong);
    for (i = 0; i < tong; i++) o[i] = i;
    for (i = 0; i < n; i++) { j = i + r.int(tong - i); t = o[i]; o[i] = o[j]; o[j] = t; }   /* n ô phân biệt, thứ tự ngẫu nhiên */
    var y = new Int32Array(n), x = new Int32Array(n);
    for (i = 0; i < n; i++) { y[i] = Math.floor(o[i] / W); x[i] = o[i] % W; }
    return { H: H, W: W, n: n, y: y, x: x };
  },
  viet: function (inst) {
    var a = [inst.n + " " + inst.H + " " + inst.W];
    for (var i = 0; i < inst.n; i++) a.push(inst.y[i] + " " + inst.x[i]);
    return a.join("\n") + "\n";
  },
  giai: function (inst) {
    function F(dem, N) {                               /* Σ_t S_t (N − S_t), S_t = số hạt ở các hàng/cột 0..t */
      var S = 0, kq = 0;
      for (var q = 0; q + 1 < dem.length; q++) { S += dem[q]; kq += S * (N - S); }
      return kq;
    }
    var hang = new Array(inst.H).fill(0), cot = new Array(inst.W).fill(0);
    for (var i = 0; i < inst.n; i++) { hang[inst.y[i]]++; cot[inst.x[i]]++; }
    return [F(hang, inst.n) + F(cot, inst.n)];
  },
  saiSo: 0,
  dinhDang: {
    vao: "Dòng 1: `n H W` — số hạt, số hàng, số cột của lưới. Tiếp theo `n` dòng, mỗi dòng `y x` — hàng `y` (0 … H−1) và cột `x` (0 … W−1) của một hạt. Mọi hạt nằm ở các ô phân biệt.",
    ra: "Một số nguyên: tổng, trên mọi cặp hạt `i < j`, của khoảng cách Manhattan `|yᵢ − yⱼ| + |xᵢ − xⱼ|`. Số này có thể vượt 2³², hãy dùng kiểu 64 bit (`long long`) trong C++."
  }
}));

TH.dangKy({
  id: "bai-18b-cau-truc-ham-muc-tieu",

  tomTat: [
    "Phản xạ “biểu diễn → lân cận → delta evaluation → SA” là **đúng quy trình nhưng có thể sai bài toán**. Trước khi chọn thuật toán, hãy dành 30 phút *viết lại hàm mục tiêu bằng hai cách khác nhau* (đại số hoá hàm mục tiêu): đôi khi cách viết thứ hai làm cả bài toán heuristic biến mất.",
    "Ba nước cờ theo thứ tự nên thử: **đổi thứ tự tổng** (hạ O(N²) xuống O(N)), **tách biến** (hàm có dấu + giữa các trục thì sửa từng trục riêng), **thống kê đủ** (hàm chỉ nhìn một bản tóm tắt nhỏ của nghiệm ⇒ không gian nghiệm sập).",
    "Nước cờ 1: Σ_{i<j} |p_i − p_j| = Σ_t S_t·(N − S_t), với S_t là số hạt bên trái khe t — mỗi nhát dao bị đúng S_t·(N − S_t) cặp bắc qua. Ví dụ {1, 2, 5, 8, 9, 12} cho 79 bằng cả hai cách; ở N = 16 000 cách theo lát cắt rẻ hơn khoảng 700 000 lần.",
    "Nước cờ 2: tổng Manhattan và Euclid **bình phương** tách được theo trục; Euclid L₂ (có căn) và Chebyshev (có max) thì không, và căn bậc hai phá vỡ mọi thứ. Kiểm bằng một phản ví dụ hai điểm trước khi tin: nếu d tách được thì d(3, 4) phải bằng d(3, 0) + d(0, 4).",
    "Nước cờ 3: E = F(r) + F(c) chỉ phụ thuộc **biên duyên** (số hạt mỗi hàng r, mỗi cột c), không phụ thuộc hạt nào ở ô nào. Hai nghiệm cùng (r, c) thay thế được cho nhau; 10⁹⁷⁴⁹ cấu hình sập xuống 358 biến (358 = H + W ở test lớn nhất đo được; lưới đủ 180 × 180 sẽ là 360). Tự kiểm: xáo nghiệm giữ nguyên thống kê nghi ngờ, điểm không đổi trên 100 lần thử.",
    "Bài rút gọn trên mật độ u có J(u) lõm, cực tiểu ở **đỉnh** của đa diện {0 ≤ u ≤ 1, Σu = N}, mà đỉnh là các vectơ 0/1 thật ⇒ nới lỏng là **chặt**. Frank–Wolfe hội tụ ≤ 5 vòng (thực nghiệm: 16 điểm xuất phát cho cùng một giá trị; với hàm lõm nó chỉ bảo đảm dừng ở một đỉnh, chưa chứng minh là toàn cục); hình đích tối ưu gần như **đĩa tròn** (κ = 0,6502, đĩa tròn 0,6504), không phải hình vuông (0,6668) hay kim cương (0,6598).",
    "Thi hành: pha dọc rồi pha ngang (nhờ tách trục), ghép cặp đơn điệu **chứng minh trước** là không va chạm (0 nước hỏng trên 2 000 test). Cận dưới cho *tài nguyên*: m ≥ Σ_t |S^R_t − S^r_t| + Σ_t |S^C_t − S^c_t|; chi phí thực / cận dưới ≈ 1,205 (tỉ lệ số nước đi); bài kết luận khoảng cách tới trần điểm chỉ còn 0,24 % — hai số đo hai thứ khác nhau và bước suy luận nối chúng không kiểm lại được từ mã — nên quyết định không làm thêm.",
    "Sáu câu hỏi trong 30 phút (time-box); không câu nào “có” thì **đóng sổ, quay lại metaheuristic** — đa số đề (P0–P3) không có cấu trúc này. Tìm ra thống kê đủ mới xong một nửa: ràng buộc vẫn nhìn vị trí (Gale–Ryser), và vẫn phải chạy 1 000 test, đếm nước đi hỏng, đo thời gian xấu nhất."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "§1",
      hoi: "Năm hạt nằm trên trục số tại các vị trí 0, 3, 4, 10 và 15. Tổng khoảng cách của mọi cặp hạt là bao nhiêu?",
      dapAn: 74, saiSo: 0,
      giaiThich: "Theo cặp (10 cặp): 3 + 4 + 10 + 15 + 1 + 7 + 12 + 6 + 11 + 5 = 74. Theo lát cắt: S_t = 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4 cho 15 khe (t = 0 … 14), nên các tích S_t·(5 − S_t) = 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 4 cộng lại cũng là 74. Hai cách luôn khớp nhau."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§1.1",
      hoi: "Vì sao cách đếm theo lát cắt (mỗi nhát dao bị S_t·(N − S_t) cặp bắc qua) luôn cho cùng kết quả với cách đếm theo cặp?",
      chon: [
        "Vì lát cắt chỉ đếm các cặp ở gần nhau, còn các cặp xa nhau đóng góp không đáng kể",
        "Vì khoảng cách giữa hai hạt chính là số nhát dao nằm giữa chúng, nên hai cách chỉ là đổi thứ tự cộng cùng một đống số: cặp trước dao sau, hay dao trước cặp sau",
        "Vì cả hai cách đều là xấp xỉ với sai số nhỏ khi N lớn",
        "Vì S_t·(N − S_t) chính là số hạt nằm ở khe thứ t"
      ],
      dung: 1,
      giaiThich: "|a − b| = #{t : min(a, b) ≤ t < max(a, b)}: mỗi cặp đóng góp đúng 1 cho mỗi nhát dao nằm giữa hai hạt. Cộng theo cặp trước hay theo dao trước là cùng một tổng, nên là đẳng thức chính xác, không xấp xỉ, và đủ mọi cặp kể cả cặp xa. S_t·(N − S_t) là số **cặp** bắc qua khe t (mỗi hạt trái ghép mỗi hạt phải), không phải số hạt."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "§5.1",
      hoi: "Lưới 5 hàng × 6 cột chứa 10 hạt, mỗi ô tối đa một hạt. Số hạt mỗi hàng là r = (2, 0, 3, 1, 4), số hạt mỗi cột là c = (2, 2, 2, 2, 1, 1). Biết rằng tổng khoảng cách Manhattan giữa mọi cặp hạt chỉ phụ thuộc vào (r, c), hãy tính tổng đó.",
      dapAn: 170, saiSo: 0,
      giaiThich: "E = F(r) + F(c) với F(v) = Σ_t S_t·(N − S_t). Hàng: S = 2, 2, 5, 6 ⇒ 2·8 + 2·8 + 5·5 + 6·4 = 81. Cột: S = 2, 4, 6, 8, 9 ⇒ 2·8 + 4·6 + 6·4 + 8·2 + 9·1 = 89. Vậy E = 81 + 89 = 170. (Bạn có thể dựng một cấu hình cụ thể có đúng các biên duyên ấy rồi cộng 45 cặp để kiểm: cũng ra 170.)"
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§4.2",
      hoi: "Chỉ ra cặp độ đo mà tổng khoảng cách trên mọi cặp điểm **tách được** thành phần chỉ nhìn hàng cộng phần chỉ nhìn cột.",
      chon: [
        "Manhattan L₁ và Euclid L₂",
        "Euclid L₂ và Chebyshev L∞",
        "Manhattan L₁ và Euclid bình phương L₂²",
        "Euclid bình phương L₂² và Chebyshev L∞"
      ],
      dung: 2,
      giaiThich: "L₁ = |Δy| + |Δx| và L₂² = Δy² + Δx² đều có dấu cộng giữa hai trục nên tổng theo cặp tách đôi. L₂ = √(Δy² + Δx²) có căn xen giữa hai trục, còn Chebyshev = max(|Δy|, |Δx|) có max — cả hai không tách được. Phép thử nhanh: nếu d tách thì d(3, 4) = d(3, 0) + d(0, 4); L₂ cho 5 ≠ 7, Chebyshev cho 4 ≠ 7."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§3.2, §3.3",
      hoi: "Chọn mọi hàm mục tiêu mà nước cờ “đổi thứ tự tổng” (đếm theo lát cắt thay vì theo cặp) áp dụng được.",
      chon: [
        "Σ_{i<j} √(Δy² + Δx²) trên mặt phẳng: cũng chia được thành các lát cắt theo từng trục như khoảng cách Manhattan",
        "Σ_{i<j} |p_i − p_j| với các điểm trên một đường thẳng, lát cắt là khe giữa hai vị trí",
        "Số cặp nghịch thế của một hoán vị, lát cắt là khe trong thứ tự",
        "Σ_{i<j} √|p_i − p_j| trên một đường thẳng, vì căn bậc hai của khoảng cách vẫn bằng số nhát dao bắc qua",
        "Số cặp (i, j) thuộc cùng một nhóm, lát cắt là ranh giới nhóm"
      ],
      dung: [1, 2, 4],
      giaiThich: "Đúng: tổng khoảng cách trên đường thẳng, số cặp nghịch thế và số cặp cùng nhóm đều là tổng trên mọi cặp của một đại lượng đếm được bằng lát cắt (§3.2). Sai: có căn bậc hai xen vào thì đại lượng không còn bằng số nhát dao nữa (√|a − b| không cộng được theo từng khe), và L₂ trên mặt phẳng không tách theo trục (§4.2) — dấu hiệu chung: căn, max, min xen giữa là phải nghi ngờ."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§5.1, §5.4",
      hoi: "Bạn lấy một cấu hình hạt, xáo trộn nó 100 lần theo cách giữ nguyên số hạt mỗi hàng và mỗi cột, chấm lại sau mỗi lần: điểm không đổi lần nào. Kết luận đúng là gì?",
      chon: [
        "Cặp biên duyên (r, c) là thống kê đủ cho hàm mục tiêu: biết (r, c) là biết điểm, và hai cấu hình cùng (r, c) thay thế được cho nhau",
        "Hàm mục tiêu không phụ thuộc vị trí của bất kỳ hạt nào, kể cả khi xét ràng buộc hợp lệ của lưới",
        "Mọi cặp (R, C) đều có một cấu hình 0/1 nhận nó làm biên duyên, nên bài toán trở nên hoàn toàn tự do",
        "Vị trí của hạt chỉ ảnh hưởng điểm khi lưới có nhiều hơn 100 hạt"
      ],
      dung: 0,
      giaiThich: "Thí nghiệm xáo trộn giữ thống kê nghi ngờ là phép thử rẻ nhất (10 dòng code): điểm bất biến ⇒ thống kê đủ (cho **điểm**). Nhưng nó không nói gì về **ràng buộc**: mỗi ô tối đa một hạt vẫn nhìn vị trí, và không phải cặp (R, C) nào cũng thực hiện được (Gale–Ryser, §9 cạm bẫy 3). Cũng không có ngưỡng 100 hạt nào."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "§6.1",
      hoi: "Frank–Wolfe cho phép “nửa hạt” (mỗi ô một mật độ trong [0, 1]) khi tìm cặp biên duyên tối ưu, nhưng đáp án cuối cùng vẫn là cấu hình nguyên. Vì sao không mất gì?",
      chon: [
        "Vì lưới đủ lớn nên làm tròn nghiệm liên tục luôn cho điểm tối ưu",
        "Vì J là hàm lồi nên cực tiểu ở đáy giữa và làm tròn chỉ gây sai số rất nhỏ",
        "Vì Frank–Wolfe luôn trả về nghiệm 0/1 dù hàm mục tiêu có dạng gì",
        "Vì J lõm trên mặt phẳng Σu = N nên cực tiểu nằm ở đỉnh của đa diện {0 ≤ u ≤ 1, Σu = N}, mà đỉnh ấy chính là các vectơ 0/1, tức các cấu hình thật"
      ],
      dung: 3,
      giaiThich: "J(u) = ½ ΣΣ u_p·u_q·‖p − q‖₁ là dạng toàn phương lõm trên Σu = N, và cực tiểu của hàm lõm nằm ở mép — đỉnh của đa diện. Các đỉnh của {0 ≤ u ≤ 1, Σu = N} là vectơ 0/1. Đó là “nới lỏng chặt”, không phải làm tròn xấp xỉ; nếu J lồi thì cực tiểu ở giữa và lập luận này hỏng. Frank–Wolfe tuyến tính hoá rồi nhảy tới đỉnh tốt nhất; mỗi bước chắc chắn giảm vì J lõm. Lưu ý: với hàm lõm Frank–Wolfe chỉ bảo đảm dừng ở một đỉnh (cực trị cục bộ); việc đó là cực tiểu toàn cục ở đây là bằng chứng thực nghiệm (16 điểm xuất phát cho cùng một giá trị), chưa phải chứng minh."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "§6.3",
      hoi: "Khối hạt tối ưu (cực tiểu tổng khoảng cách L₁ mọi cặp) có hình gì, và vì sao?",
      chon: [
        "Hình vuông, vì lưới gồm các ô vuông",
        "Kim cương, vì đó là hình cầu của chuẩn L₁",
        "Gần như hình tròn: ta cực tiểu kỳ vọng khoảng cách giữa hai điểm ngẫu nhiên, đại lượng này chỉ phụ thuộc hai biên duyên, và biên duyên của hình tròn tập trung hơn của kim cương hay hình vuông",
        "Dải ngang kín chiều rộng, vì mọi hạt cùng hàng nên khoảng cách theo y bằng 0"
      ],
      dung: 2,
      giaiThich: "Kết quả phản trực giác: κ (khoảng cách L₁ trung bình giữa hai điểm ngẫu nhiên, diện tích chuẩn hoá 1) là 0,6668 cho hình vuông (đo trên lưới; chính xác 2/3 = 0,6667), 0,6598 cho kim cương, 0,6504 cho đĩa tròn và 0,6502 cho nghiệm Frank–Wolfe. “Hình cầu của L₁” đúng khi gom hạt về một tâm cố định, nhưng bài này cực tiểu khoảng cách giữa các hạt với nhau. Dải ngang kín chiều rộng còn tệ nhất (116 520 so với 177 109 của hình vuông ở mật độ 0,33)."
    },
    {
      id: "q9", loai: "mot", doKho: 3, ref: "§9 (cạm bẫy 3, 6)",
      hoi: "Hàm mục tiêu chỉ nhìn biên duyên (r, c) — nhưng ràng buộc “mỗi ô tối đa một hạt” thì sao? Nhận định nào đúng?",
      chon: [
        "Ràng buộc cũng chỉ phụ thuộc (r, c), nên mọi cặp (R, C) tìm được đều thực hiện được",
        "Có thể bỏ qua ràng buộc vì hàm mục tiêu không dùng đến nó",
        "Ràng buộc vẫn nhìn vị trí: không phải cặp (R, C) nào cũng có cấu hình 0/1 nhận nó làm biên duyên (điều kiện Gale–Ryser), nên phải chứng minh thống kê hiện thực hoá được và vẫn chạy đủ test để bắt lỗi",
        "Chỉ cần chạy một test để biết ràng buộc có thoả hay không"
      ],
      dung: 2,
      giaiThich: "Tìm ra thống kê đủ mới xong một nửa; nửa còn lại là chứng minh nó hiện thực hoá được. Ví dụ lưới 2×2 với R = (2, 0) và C = (2, 0): hai hạt phải cùng ở ô (0, 0), vi phạm ràng buộc dù tổng hai dãy khớp nhau. Ở đề 2609, 3/300 test có cặp biên duyên sát ngưỡng và 1–3 hạt không xếp được; chính việc chạy đủ test (Cạm bẫy 6) mới làm lộ ra điều đó."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "§8, §9 (cạm bẫy 5)",
      hoi: "Bạn hỏi sáu câu của §8 cho đề mới trong 30 phút và không câu nào trả lời “có”. Việc nên làm tiếp theo là gì?",
      chon: [
        "Dành thêm một tuần tìm cấu trúc vì nhất định phải có",
        "Chuyển sang ngôn ngữ lập trình khác",
        "Đóng sổ và quay lại metaheuristic (Phần 2–4), vì đa số đề heuristic — cả P0 đến P3 của khoá — không có cấu trúc khai thác được",
        "Bỏ đề vì không có cấu trúc thì không giải được"
      ],
      dung: 2,
      giaiThich: "Ba mươi phút là chi phí bảo hiểm rẻ; ba ngày đi tìm cấu trúc không tồn tại là canh bạc (cạm bẫy 5, đối xứng với cạm bẫy của 17 bài trước). Không có cấu trúc đặc biệt không có nghĩa là không giải được — chỉ là bài này thuộc về metaheuristic. Đổi ngôn ngữ không thay đổi cấu trúc của hàm mục tiêu."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 18B.1 (§1)",
      hoi: "Sáu hạt nằm trên trục số tại các vị trí 0, 3, 4, 10, 12 và 15. Tính tổng khoảng cách mọi cặp bằng **cả hai cách** ở §1 (đếm theo cặp; đếm theo lát cắt) và kiểm tra hai kết quả khớp nhau.",
      goiY: ["Cách 2: với mỗi khe giữa hai vị trí liền nhau, đếm S_t rồi lấy S_t·(6 − S_t).", "Có 15 cặp và 15 khe (t = 0 … 14)."],
      mau: "**Theo cặp (15 cặp):** từ 0 tới 3, 4, 10, 12, 15 → 3 + 4 + 10 + 12 + 15 = 44; từ 3 tới 4, 10, 12, 15 → 1 + 7 + 9 + 12 = 29; từ 4 tới 10, 12, 15 → 6 + 8 + 11 = 25; từ 10 tới 12, 15 → 2 + 5 = 7; từ 12 tới 15 → 3. Tổng 44 + 29 + 25 + 7 + 3 = **108**.\n\n" +
           "**Theo lát cắt:** S_t (số hạt có vị trí ≤ t) cho t = 0 … 14 là 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5; nhân với (6 − S_t) được 5, 5, 5, 8, 9, 9, 9, 9, 9, 9, 8, 8, 5, 5, 5. Cộng: 15 + 8 + 54 + 16 + 15 = **108**. ✅\n\n" +
           "Khớp nhau vì |a − b| bằng số nhát dao nằm giữa a và b: cách 1 cộng cặp trước, dao sau; cách 2 cộng dao trước, cặp sau — cùng một đống số, đổi thứ tự cộng. Khác biệt ở giá tiền: cách 1 tốn C(N, 2) phép, cách 2 chỉ tốn một phép mỗi khe (≤ M phép); ở N = 16 000 trên lưới 180 là chênh khoảng 700 000 lần.",
      tieuChi: [
        "Tính đúng 108 theo cách đếm cặp",
        "Tính đúng S_t và các tích S_t·(6 − S_t), tổng cũng là 108",
        "Giải thích vì sao hai cách khớp: khoảng cách bằng số nhát dao nằm giữa, chỉ đổi thứ tự cộng",
        "Nêu được chênh lệch về chi phí (C(N, 2) so với số khe)"
      ]
    },
    {
      id: "l2", doKho: 3, ref: "Bài tập 18B.3 (§4.2)",
      hoi: "Với mỗi độ đo trong bảng §4.2 (Manhattan L₁, Euclid bình phương L₂², Euclid L₂, Chebyshev L∞, khoảng cách trên đồ thị), hãy nêu một **phản ví dụ hai điểm** chứng minh nó không tách được theo trục, hoặc chứng minh nó tách được.",
      goiY: ["Nếu d(Δy, Δx) = φ(Δy) + ψ(Δx) và d(0, 0) = 0, thì d(Δy, Δx) = d(Δy, 0) + d(0, Δx).", "Với khoảng cách trên đồ thị, hãy so hai cặp điểm có cùng (Δy, Δx) nhưng ở hai chỗ khác nhau."],
      mau: "**Phép thử chung.** Nếu d tách được, tức d(Δy, Δx) = φ(Δy) + ψ(Δx) với d(0, 0) = 0, thì d(Δy, Δx) = d(Δy, 0) + d(0, Δx). Chỉ cần một cặp (Δy, Δx) vi phạm đẳng thức đó là d không tách được.\n\n" +
           "- **L₁:** |Δy| + |Δx| — tách được theo định nghĩa (φ = |·|, ψ = |·|).\n" +
           "- **L₂²:** Δy² + Δx² — tách được (φ = ψ = bình phương).\n" +
           "- **L₂:** với (Δy, Δx) = (3, 4): d = √(9 + 16) = 5, nhưng d(3, 0) + d(0, 4) = 3 + 4 = 7 ≠ 5 ⇒ không tách được.\n" +
           "- **Chebyshev:** d(3, 4) = max(3, 4) = 4, nhưng d(3, 0) + d(0, 4) = 7 ≠ 4 ⇒ không tách được theo hai trục gốc. (Ngoài bài: nó lại thành Manhattan sau khi xoay hệ trục 45°, nên vẫn có cách tính nhanh khác — nhưng đó không phải tách theo trục.)\n" +
           "- **Khoảng cách trên đồ thị:** không còn là hàm của (Δy, Δx) nữa. Ví dụ lưới có một bức tường: cặp (0, 1) → (2, 1) bị tường chắn phải đi vòng, còn cặp (0, 0) → (2, 0) đi thẳng, hai cặp có cùng Δ = (2, 0) mà d khác nhau ⇒ không tách được.",
      tieuChi: [
        "Nêu được phép thử d(Δy, Δx) = d(Δy, 0) + d(0, Δx) hoặc một lập luận tương đương",
        "Chứng minh L₁ và L₂² tách được",
        "Đưa phản ví dụ cụ thể (3, 4) cho L₂ và cho Chebyshev",
        "Đưa được lý do không tách của khoảng cách trên đồ thị (không chỉ phụ thuộc Δ)"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "§9 (cạm bẫy 3)",
      hoi: "Cho ví dụ nhỏ nhất cho thấy “biên duyên (R, C) có tổng bằng nhau” **chưa** đủ để tồn tại một cấu hình thật. Điều này nói gì về việc dùng thống kê đủ, và bạn xử lý hệ quả thế nào?",
      goiY: ["Thử lưới 2 × 2 với 2 hạt và dồn cả hai biên duyên về một hàng/cột.", "Nhớ tên định lý cho điều kiện tồn tại."],
      mau: "**Ví dụ:** lưới 2 × 2, 2 hạt, R = (2, 0) và C = (2, 0). Tổng hai dãy đều là 2 nên trông hợp lệ, nhưng hàng 0 chứa 2 hạt và cột 0 chứa 2 hạt buộc cả hai hạt cùng ở ô (0, 0) — vi phạm ràng buộc “mỗi ô tối đa một hạt”.\n\n" +
           "**Ý nghĩa:** hàm mục tiêu chỉ nhìn (r, c), nhưng **ràng buộc hợp lệ vẫn nhìn vị trí**; không phải cặp (R, C) nào cũng có cấu hình 0/1 nhận nó làm biên duyên — điều kiện tồn tại là **định lý Gale–Ryser**. Tìm ra thống kê đủ mới xong một nửa, nửa còn lại là chứng minh thống kê ấy hiện thực hoá được.\n\n" +
           "**Xử lý:** kiểm điều kiện tồn tại (hoặc để một số hạt đứng yên khi cặp biên duyên sát ngưỡng — ở đề 2609 điều này xảy ra ở 3/300 test, 1–3 hạt không xếp được, sai số entropy 0,04 %, vẫn 0 nước đi hỏng), và **luôn chạy đủ 1 000 test**, đếm nước đi hỏng, đo thời gian xấu nhất — chính nhờ vậy lỗi Gale–Ryser mới lộ ra (cạm bẫy 6).",
      tieuChi: [
        "Đưa ví dụ cụ thể có tổng R và C bằng nhau nhưng không có cấu hình 0/1 (ví dụ 2 × 2 với R = C = (2, 0))",
        "Nêu đúng điểm mấu chốt: hàm mục tiêu chỉ nhìn (r, c) còn ràng buộc vẫn nhìn vị trí; nhắc tên định lý Gale–Ryser",
        "Nêu cách xử lý: kiểm điều kiện tồn tại / cho hạt đứng yên, và chạy đủ test để bắt lỗi"
      ]
    },
    {
      id: "l4", doKho: 4, ref: "Bài tập 18B.5, §8",
      hoi: "Áp sáu câu hỏi của §8 cho bài **P1 (ship hàng một ngày)** của khoá: lưới 100 × 100, kho ở (50, 50), mỗi đơn có `(x, y, p, s)`, ngày 480 phút, không cần quay về, đi từ u sang v mất |Δx| + |Δy| phút. Trả lời từng câu. Kết luận: P1 có cấu trúc khai thác được không? Nếu không, chỉ rõ **câu nào** thất bại và **vì sao**.",
      goiY: ["Hàm mục tiêu (tổng tiền) và ràng buộc (tổng thời gian) được tính ra sao trong bộ chấm?", "Thử “xáo trộn mà giữ nguyên một bản tóm tắt”: bản tóm tắt nào của tuyến giữ được cả tiền lẫn thời gian?"],
      mau: "Một cách trả lời hợp lý:\n\n" +
           "1. **Hai vòng `for` lồng nhau trên cùng một mảng?** Không. Bộ chấm duyệt tuyến một lần, cộng thời gian từ đơn này sang đơn kế rồi cộng thời gian giao; tiền là tổng một lượt. Không có tổng trên mọi cặp để đổi thứ tự.\n" +
           "2. **Có dấu + giữa các trục?** Có: thời gian đi là |Δx| + |Δy|, nên phần theo x và phần theo y tách rời. Nhưng cả hai phần dùng chung **một thứ tự ghé** (và cùng một tập đơn), nên không thể giải riêng từng trục.\n" +
           "3. **Xáo nghiệm mà giữ một bản tóm tắt, điểm có đổi không?** Với tuyến, đổi thứ tự ghé giữ nguyên tập đơn thì tiền không đổi nhưng tổng thời gian đổi (có thể vượt 480 phút làm tuyến không hợp lệ). Không có bản tóm tắt nhỏ hơn bản thân tuyến mà biết nó là biết cả điểm lẫn tính hợp lệ ⇒ **câu này thất bại**, và đó là nút chính.\n" +
           "4–5. Không có thống kê đủ nên không có bài rút gọn lồi/lõm và không có cách thi hành “chứng minh trước là không hỏng” để xây thay vì tìm.\n" +
           "6. **Tài nguyên có cận dưới?** Có một số hướng (cận trên điểm bằng nới lỏng LP với tham số τ ở Bài 18), nhưng đó giúp *đo* dư địa chứ không cho cách *xây* nghiệm.\n\n" +
           "**Kết luận:** P1 không có cấu trúc khai thác được theo cách của đề 2609 (phù hợp với lời dặn của bài: P0 đến P3 đều không). Đóng sổ trong 30 phút và quay lại metaheuristic — greedy, chèn, local search, LNS của các bài trước.",
      tieuChi: [
        "Trả lời đủ sáu câu hỏi, câu nào không áp dụng thì nói rõ vì sao",
        "Chỉ ra được câu thất bại then chốt (không có thống kê đủ vì thứ tự ghé ảnh hưởng thời gian) và lý do",
        "Nhận ra dấu + giữa các trục có nhưng hai trục bị buộc chung bởi thứ tự ghé",
        "Kết luận đúng: time-box 30 phút rồi quay lại metaheuristic"
      ]
    }
  ],

  lab: [
    {
      id: "tong-cap-luoi",
      ten: "Tổng khoảng cách mọi cặp hạt trên lưới: đổi thứ tự tổng và tách biến",
      doKho: 3,
      ref: "§1–4, §5.1",
      de: "Trên lưới `H × W` có `n` hạt, mỗi ô tối đa một hạt (hạt `i` ở hàng `yᵢ`, cột `xᵢ`). Hãy tính\n\n" +
          "`E = Σ_{i<j} ( |yᵢ − yⱼ| + |xᵢ − xⱼ| )` — tổng khoảng cách Manhattan trên **mọi cặp** hạt.\n\n" +
          "Dữ liệu mặc định là `n = 60 000` hạt trên lưới `300 × 300`: có tới **1,8 × 10⁹ cặp**. Một vòng lặp đôi trên các hạt cho đáp án đúng nhưng sẽ báo “Quá giờ” ở giới hạn 1 giây mỗi test — đó chính là lỗi “chấm điểm sai cách” của lời giải k-means ở đề 2609. Hãy **đọc hàm mục tiêu trước khi viết thuật toán**: dấu `+` giữa hai trục cho phép tách đôi tổng (§4), và mỗi nửa chỉ cần số hạt ở từng hàng, từng cột (§3, §5).\n\n" +
          "In đúng một số nguyên (có thể lớn hơn 2³², dùng 64 bit). Chấm trên 8 bộ dữ liệu; chỉ có kết quả đúng/sai, và đúng nhưng chậm vẫn bị loại.\n\n" +
          "**Gỡ lỗi:** đổi sang biến thể *Nhỏ* (40 hạt, lưới 20×20) rồi so công thức của bạn với vòng lặp đôi. **Sau khi qua, tự kiểm thống kê đủ** (§5.4): hoán đổi ngẫu nhiên cột giữa các hạt (giữ nguyên số hạt mỗi hàng và mỗi cột, chấp nhận hai hạt trùng ô khi chỉ để thử) rồi tính lại — điểm có đổi không? Còn nếu bạn đổi số hạt mỗi hàng thì sao?",
      vanDe: "b18b-tong-cap-luoi",
      tham: { n: 60000, H: 300, W: 300 },
      bienThe: [
        { ten: "Lớn: 60 000 hạt, lưới 300×300", tham: { n: 60000, H: 300, W: 300 } },
        { ten: "Nhỏ để gỡ lỗi: 40 hạt, lưới 20×20", tham: { n: 40, H: 20, W: 20 } }
      ],
      soTest: 8,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n H W"; rồi n dòng "y x" (hàng, cột của từng hạt, đếm từ 0).
// Đầu ra : một số nguyên E = tổng |dy| + |dx| trên mọi cặp hạt.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], H = t[1], W = t[2];
const y = [], x = [];
for (let i = 0; i < n; i++) { y.push(t[3 + 2 * i]); x.push(t[4 + 2 * i]); }

// TODO: tính E. Hai vòng for lồng nhau trên n hạt là O(n²) ≈ 1,8·10^9 phép — sẽ "Quá giờ".
//       Gợi ý: tách |dy| + |dx| thành hai tổng, rồi đếm theo "lát cắt" (khe giữa hai hàng/cột liền nhau).
print(0);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, H, W;
    scanf("%d %d %d", &n, &H, &W);
    vector<int> y(n), x(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &y[i], &x[i]);

    // TODO: tính E (dùng long long). Hai vòng for lồng nhau trên n hạt là O(n^2) ~ 1,8·10^9 phép — sẽ "Quá giờ".
    //       Gợi ý: tách |dy| + |dx| thành hai tổng, rồi đếm theo "lát cắt" (khe giữa hai hàng/cột liền nhau).
    long long E = 0;
    printf("%lld\n", E);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], H = t[1], W = t[2];
const hang = new Array(H).fill(0), cot = new Array(W).fill(0);
for (let i = 0; i < n; i++) { hang[t[3 + 2 * i]]++; cot[t[4 + 2 * i]]++; }

// Nước cờ 1 (đổi thứ tự tổng): Σ_{i<j} |a_i − a_j| = Σ_t S_t·(n − S_t), S_t = số hạt nằm ở các hàng/cột 0..t.
// Nước cờ 2 (tách biến): E = (phần chỉ nhìn hàng) + (phần chỉ nhìn cột).
function tongCap(dem) {
  let S = 0, kq = 0;
  for (let q = 0; q + 1 < dem.length; q++) { S += dem[q]; kq += S * (n - S); }
  return kq;
}
print(tongCap(hang) + tongCap(cot));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, H, W;
    scanf("%d %d %d", &n, &H, &W);
    vector<long long> hang(H, 0), cot(W, 0);
    for (int i = 0; i < n; i++) {
        int y, x;
        scanf("%d %d", &y, &x);
        hang[y]++; cot[x]++;
    }

    // Nước cờ 1 (đổi thứ tự tổng): Σ_{i<j} |a_i − a_j| = Σ_t S_t·(n − S_t), S_t = số hạt ở các hàng/cột 0..t.
    // Nước cờ 2 (tách biến): E = (phần chỉ nhìn hàng) + (phần chỉ nhìn cột).
    auto tongCap = [&](const vector<long long>& dem) {
        long long S = 0, kq = 0;
        for (size_t q = 0; q + 1 < dem.size(); q++) { S += dem[q]; kq += S * (n - S); }
        return kq;
    };
    printf("%lld\n", tongCap(hang) + tongCap(cot));
    return 0;
}
`
      },
      goiY: [
        "Tách E = (tổng |yᵢ − yⱼ| trên mọi cặp) + (tổng |xᵢ − xⱼ| trên mọi cặp). Hai tổng độc lập nhau, mỗi tổng chỉ là bài toán một chiều.",
        "Bài một chiều: đếm số hạt ở mỗi hàng, cộng dồn thành S_t (số hạt có hàng ≤ t); khe giữa hàng t và t+1 bị S_t·(n − S_t) cặp bắc qua, cộng mọi khe lại.",
        "Dùng số nguyên 64 bit (kết quả cỡ 10¹¹); trong JS số thường vẫn chính xác vì nhỏ hơn 2⁵³. Kiểm trên biến thể Nhỏ so với vòng lặp đôi trước khi nộp biến thể Lớn."
      ]
    }
  ]
});
