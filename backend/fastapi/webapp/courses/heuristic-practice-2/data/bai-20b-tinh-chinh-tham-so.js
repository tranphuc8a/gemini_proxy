/* Thực hành — Bài 20B: Tinh chỉnh tham số mà không tự lừa mình. */
(function () {
  "use strict";

  /* ---------- bài toán tự dựng: "tự tạo ảo giác rồi đo nó" (§9) ---------- */
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function tb(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function doLech(a) {                         /* độ lệch chuẩn mẫu, chia n − 1 */
    var m = tb(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  /* [chỉ số ứng viên tốt nhất, cải thiện huấn luyện %, ảo giác %, tin được 0/1, N cần, cải thiện kiểm định %] */
  function tinh(inst) {
    var K = inst.K, N = inst.N, best = 1, bm = tb(inst.train[1]);
    for (var j = 2; j <= K; j++) { var mj = tb(inst.train[j]); if (mj > bm) { bm = mj; best = j; } }
    var m0 = tb(inst.train[0]), cv = doLech(inst.train[0]) / m0;
    var caiThienHL = (bm / m0 - 1) * 100;
    var aoGiac = cv / Math.sqrt(N) * Math.sqrt(2 * Math.log(K)) * 100;
    var tin = caiThienHL > aoGiac ? 1 : 0;
    var nCan = Math.ceil(8 * Math.pow(cv / (caiThienHL / 100), 2) * Math.log(K));
    var caiThienKD = (tb(inst.val[best]) / tb(inst.val[0]) - 1) * 100;
    return [best, caiThienHL, aoGiac, tin, nCan, caiThienKD];
  }

  TH.vande.dangKy("b20b-ao-giac", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var K = tham.K || 100, N = tham.N || 30, M = tham.M || 300, cv = tham.cv || 0.1;
      var hieuUng = tham.hieuUng || 0, rho = tham.rho == null ? 0.5 : tham.rho;
      var r = TH.tienIch.rng(seed), inst = null;
      /* Giữ các bộ dữ liệu "điển hình" của kịch bản: chỉ nhiễu thì cải thiện huấn luyện không vượt ảo giác; có cấu hình tốt thật thì vượt. */
      for (var lan = 0; lan < 300; lan++) {
        var that = hieuUng ? 1 + r.int(K) : 0, khoi = [];
        [N, M].forEach(function (cot) {
          var kho = [], hang = [], t, i;
          for (t = 0; t < cot; t++) kho.push(gauss(r));            /* độ khó chung của test t: mọi cấu hình cùng gặp */
          for (i = 0; i <= K; i++) {
            var mu = 1000 * (1 + (i === that ? hieuUng : 0)), a = [];
            for (t = 0; t < cot; t++) a.push(Math.round(mu * (1 + cv * (Math.sqrt(rho) * kho[t] + Math.sqrt(1 - rho) * gauss(r)))));
            hang.push(a);
          }
          khoi.push(hang);
        });
        inst = { K: K, N: N, M: M, train: khoi[0], val: khoi[1] };
        var kq = tinh(inst);
        if (kq[1] > 0 && (hieuUng ? kq[3] === 1 : kq[3] === 0)) break;
      }
      return inst;
    },
    viet: function (inst) {
      var o = inst.K + " " + inst.N + " " + inst.M + "\n", i;
      for (i = 0; i <= inst.K; i++) o += inst.train[i].join(" ") + "\n";
      for (i = 0; i <= inst.K; i++) o += inst.val[i].join(" ") + "\n";
      return o;
    },
    giai: tinh,
    saiSo: 0.0051,
    dinhDang: {
      vao: "Dòng 1: `K N M`. Rồi `K + 1` dòng điểm **huấn luyện**, mỗi dòng `N` số nguyên; dòng 0 là cấu hình **mặc định**, dòng 1…K là các ứng viên. Rồi `K + 1` dòng điểm **kiểm định**, mỗi dòng `M` số nguyên, cùng thứ tự cấu hình.",
      ra: "Sáu số cách nhau khoảng trắng: `best` (chỉ số ứng viên 1…K), cải thiện huấn luyện (%), ảo giác (%), `tinDuoc` (0 hoặc 1), `nCan` (số nguyên), cải thiện kiểm định (%). Số phần trăm in ít nhất 2 chữ số thập phân."
    }
  }));

  TH.dangKy({
    id: "bai-20b-tinh-chinh-tham-so",

    tomTat: [
      "Thử **K** cấu hình trên **N** test rồi giữ cái tốt nhất luôn tạo ra một mức cải thiện **giả**, kể cả khi mọi cấu hình y hệt nhau: ảo giác ≈ (σ/√N)·√(2 ln K). Con số tinh chỉnh ra là một **kỷ lục**, không phải một phép đo.",
      "Với σ = 10, N = 30, K = 100: SE = 10/√30 = 1,83 và ảo giác ≤ 1,83 × 3,04 = 5,5 điểm trên nền 100. Công thức là **cận trên** (các cấu hình gặp cùng test khó nên bảng đo thật chỉ ra ~3 %), và cận trên là thứ ta cần khi ra quyết định.",
      "Quy tắc Bài 4 phải nhân thêm ln K: **N ≳ 8(σ/Δ)² ln K**. Với σ/x̄ = 10 % và Δ = 2 %: K = 20 cần 600 test, K = 100 cần 920, K = 500 cần 1 240. Tinh chỉnh đắt hơn mọi người tưởng.",
      "Thuốc chữa là **tách dữ liệu**: seed huấn luyện (nhìn thoải mái), seed kiểm định (giữ kín, chạy **đúng một lần** cho cấu hình cuối). Nhìn kiểm định lần hai là nó thành huấn luyện. Báo cáo ghi cả hai con số: “+3,0 % huấn luyện, +2,7 % kiểm định”.",
      "Chiến lược theo số chiều: 1–2 tham số **quét lưới**, 3–5 **giảm dần theo toạ độ**, ≥ 6 **ngẫu nhiên** (lưới chỉ thử vài giá trị khác nhau cho mỗi tham số quan trọng). Tham số tỉ lệ (T₀, λ, tỉ lệ phá) quét theo **thang log**: 5, 10, 20, 40, 80.",
      "**Ablation trước, tinh chỉnh sau**: |Δ ablation| của một thành phần là cận trên cho lợi ích tinh chỉnh tham số bên trong nó. Số hạng mật độ σ chỉ −0,01 % thì xoá luôn, đừng đốt K vào nó.",
      "Ablation một thành phần **dùng chung** trong portfolio phải làm ở cấu hình **một chiến lược**: “phân lớp kích thước” mất 0,03 % với 6 chiến lược nhưng 1,65 % với 1 chiến lược — sai 55 lần vì năm chiến lược còn lại tự bù.",
      "Ba bẫy phòng thi: tham số dạng “I vòng lặp” chỉnh trên máy nhanh (chừa biên an toàn ≥ 2×); chỉnh ở quy mô sai (kiểm ở cả nhỏ / điển hình / lớn); nộp thử để **chọn** (đúng ra chỉ để **xác nhận**). Và K cộng dồn qua cả tuần, không chỉ vòng lặp cuối."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "Bài này nói về chuyện gì",
        hoi: "Bạn quét 200 tổ hợp tham số, mỗi tổ hợp chạy 30 test và giữ cấu hình tốt nhất: màn hình báo +2,9 % so với mặc định. Khi nộp, điểm thật lại là −0,4 %. Không có bug nào. Điều gì giải thích đúng nhất?",
        chon: [
          "Bộ chấm trên máy bạn khác bộ chấm của ban tổ chức nên điểm luôn lệch",
          "Cấu hình mặc định vô tình bị đo thấp hơn thực tế",
          "Con số +2,9 % là chất lượng thật cộng với phần may mắn lớn nhất trong 200 lần rút thăm — một kỷ lục chứ không phải một phép đo",
          "Tham số lẻ như T₀ = 41 không chạy ổn định trên máy khác"
        ],
        dung: 2,
        giaiThich: "Khi chọn cái tốt nhất trong K cấu hình đo trên N test, con số thấy được là chất lượng thật cộng phần may mắn lớn nhất của K lần rút thăm; không cần bug nào để nó xuất hiện. “Máy chấm khác” và “mặc định bị đo thấp” đều là giả thuyết có bug mà đề đã loại trừ. Tham số lẻ (T₀ = 41) là dấu vết của quá khớp (cạm bẫy 5) chứ không phải nguyên nhân làm chương trình chạy sai."
      },
      {
        id: "q2", loai: "so", doKho: 2, ref: "§1.1", donVi: "(%)",
        hoi: "Điểm mỗi test dao động với σ/x̄ = 8 %. Bạn thử K = 50 cấu hình (thực chất y hệt nhau) trên N = 40 test rồi giữ cái cao nhất. Theo công thức của bài, ảo giác (cận trên) là bao nhiêu phần trăm? Làm tròn một chữ số thập phân.",
        dapAn: 3.5, saiSo: 0.05,
        giaiThich: "SE = 8 %/√40 = 1,265 %. √(2 ln 50) = √7,824 = 2,797. Ảo giác ≈ 1,265 × 2,797 = 3,54 % ≈ 3,5 %. Nghĩa là mọi “cải thiện” dưới khoảng 3,5 % trên bộ đo này chưa phân biệt được với may mắn."
      },
      {
        id: "q3", loai: "nhieu", doKho: 2, ref: "§3.1",
        hoi: "Bạn quét tham số trên seed huấn luyện rồi chạy đúng một lần trên seed kiểm định. Các cặp kết quả (huấn luyện / kiểm định) dưới đây, cặp nào cho thấy KHÔNG nên nhận cấu hình mới?",
        chon: [
          "+3,0 % / −0,5 %",
          "+3,0 % / +2,7 %",
          "+0,3 % / +0,3 %",
          "+2,4 % / +2,1 %",
          "+3,0 % / +0,4 %"
        ],
        dung: [0, 2, 4],
        giaiThich: "+3,0 / −0,5 là quá khớp hoàn toàn (bỏ, giữ mặc định). +3,0 / +0,4: phần lớn là ảo giác, quay về cấu hình đơn giản hơn. +0,3 / +0,3: thật nhưng quá nhỏ, không đáng rủi ro. Hai cặp còn lại (+3,0 / +2,7 và +2,4 / +2,1) giữ được gần nguyên cải thiện sang tập chưa nhìn nên nhận."
      },
      {
        id: "q4", loai: "so", doKho: 2, ref: "§1.2",
        hoi: "Biến thiên giữa các test là σ/x̄ = 8 %. Bạn muốn phát hiện đáng tin một cải thiện Δ = 1,5 % sau khi đã thử K = 30 cấu hình. Theo N ≳ 8(σ/Δ)² ln K, cần khoảng bao nhiêu test case?",
        dapAn: 774, tuongDoi: 0.01,
        giaiThich: "N ≈ 8 × (8/1,5)² × ln 30 = 8 × 28,44 × 3,401 = 773,96 ≈ 774 test. Nếu chỉ so một lần (K = 1) quy tắc Bài 4 cho 8 × 28,44 = 228 test; hệ số ln K = 3,4 là cái giá của việc “thử nhiều rồi chọn”."
      },
      {
        id: "q5", loai: "mot", doKho: 1, ref: "§4.1",
        hoi: "Một hàm có 6 tham số, trong đó chỉ 2 tham số thật sự quan trọng. Ngân sách 64 lần chạy. Vì sao lấy mẫu ngẫu nhiên 64 cấu hình thường tốt hơn quét lưới 2⁶?",
        chon: [
          "Ngẫu nhiên không bị ảo giác vì nó không chọn cấu hình tốt nhất",
          "Lưới chỉ thử 2 giá trị khác nhau cho mỗi tham số quan trọng, còn ngẫu nhiên thử 64 giá trị khác nhau cho mỗi tham số đó",
          "Ngẫu nhiên luôn tìm được cực đại toàn cục",
          "Quét lưới không chạy được khi số chiều lớn hơn 3"
        ],
        dung: 1,
        giaiThich: "Cùng 64 lần chạy, lưới 2⁶ chỉ có 2 × 2 = 4 điểm khác nhau trên hai chiều quan trọng (mỗi điểm lặp 16 lần), còn 64 mẫu ngẫu nhiên cho 64 điểm khác nhau — thông tin nhiều hơn một bậc (Bergstra & Bengio, 2012). Ngẫu nhiên vẫn chịu ảo giác như mọi cách chọn-cái-tốt-nhất và không bảo đảm cực đại toàn cục; lưới chạy được, chỉ là phí."
      },
      {
        id: "q6", loai: "mot", doKho: 1, ref: "§4.2",
        hoi: "Nhiệt độ ban đầu T₀ của SA có thể từ vài đơn vị đến vài trăm. Cách quét nào đúng với tinh thần của bài?",
        chon: [
          "T₀ = 5, 10, 20, 40, 80, 160 — nhân 2 mỗi bước",
          "T₀ = 10, 20, 30, 40, 50 — cộng 10 mỗi bước",
          "T₀ = 100, 200, 300, 400, 500 — cộng 100 mỗi bước",
          "Chọn ngẫu nhiên 5 giá trị trong khoảng [10, 50]"
        ],
        dung: 0,
        giaiThich: "Tham số có tính tỉ lệ (nhiệt độ, λ, tỉ lệ phá) phải quét theo nhân, tức thang log, để bao được nhiều bậc độ lớn. Quét cộng 10 hay cộng 100, hoặc bốc trong [10, 50], có thể nằm trọn trong vùng “quá nóng” (hay “quá lạnh”) mà bạn không bao giờ nhìn thấy."
      },
      {
        id: "q7", loai: "mot", doKho: 2, ref: "§5",
        hoi: "Bảng ablation cho thấy bỏ hẳn số hạng mật độ σ chỉ làm điểm tụt 0,01 %. Bạn nên làm gì với các tham số bên trong số hạng ấy?",
        chon: [
          "Quét thật kỹ 50 giá trị vì tham số nhỏ thường nhạy",
          "Tăng σ lên gấp 10 để nhìn thấy tác dụng rồi mới quyết định",
          "Giữ nguyên và nhờ seed kiểm định xử lý sau",
          "Không tinh chỉnh; xoá luôn thành phần đó"
        ],
        dung: 3,
        giaiThich: "|Δ ablation| là cận trên cho lợi ích của việc chỉnh tham số bên trong thành phần: tắt hẳn chỉ mất 0,01 % thì chỉnh số cũng chỉ được chừng ấy — nằm sâu trong nhiễu đo. Quét 50 giá trị chỉ làm K phình to, tức phóng to ảo giác, mà không đổi lại gì. Seed kiểm định chỉ giúp nhận ra ảo giác, không làm tham số vô nghĩa có nghĩa."
      },
      {
        id: "q8", loai: "mot", doKho: 3, ref: "§6.2",
        hoi: "Ablation “phân lớp kích thước” mất 0,03 % khi dùng portfolio 6 chiến lược nhưng mất 1,65 % khi chỉ dùng 1 chiến lược. Kết luận đúng là gì?",
        chon: [
          "Thành phần vô dụng ở thực tế vì cấu hình nộp bài là portfolio — nên xoá",
          "Con số 1,65 % sai vì cấu hình một chiến lược quá yếu để đo",
          "Cả hai đúng như nhau, nên lấy trung bình khoảng 0,84 %",
          "Thành phần quan trọng nhưng bị năm chiến lược còn lại che; phải ablation ở cấu hình một chiến lược"
        ],
        dung: 3,
        giaiThich: "Khi tắt ý tưởng ở một chiến lược, năm chiến lược còn lại vẫn mang nó nên portfolio tự bù — chênh tới 55 lần (1,65/0,03). Quy tắc: ablation thành phần dùng chung ở cấu hình một chiến lược, rồi ablation chính portfolio ở một bảng riêng. Xoá theo cột 6 chiến lược là xoá nhầm thành phần quan trọng nhất; lấy trung bình thì vô nghĩa vì hai phép đo trả lời hai câu hỏi khác nhau."
      },
      {
        id: "q9", loai: "mot", doKho: 2, ref: "§7.1",
        hoi: "Solver của bạn “chạy I vòng lặp rồi dừng” (đề cấm thêm header nên không đọc được đồng hồ). Bạn chỉnh I sát giới hạn 100 ms trên máy nhà, còn máy chấm chậm hơn 1,5 lần. Điều gì có thể xảy ra và nên làm gì?",
        chon: [
          "Không sao: số vòng cố định nên thời gian không phụ thuộc máy",
          "Tăng I thêm 50 % để bù cho máy chậm",
          "Có thể quá giờ khi nộp; đặt ngân sách theo hằng số biên dịch với biên an toàn ≥ 2×, hoặc chỉnh trên bộ chấm đã ghìm tốc độ (nhân giới hạn thời gian với 0,5)",
          "Chỉ cần đổi sang đo bằng đồng hồ thay cho số vòng lặp"
        ],
        dung: 2,
        giaiThich: "Số vòng cố định làm khối lượng việc tất định, nhưng thời gian thật vẫn phụ thuộc tốc độ máy: máy chấm chậm 1,5× thì cấu hình sát 100 ms trở thành ~150 ms và vượt giờ. Tăng I làm tệ hơn; đồng hồ không dùng được trong đề này. Hai cách sống sót của bài: biên an toàn ≥ 2× hoặc ghìm tốc độ khi đo."
      },
      {
        id: "q10", loai: "nhieu", doKho: 2, ref: "§7.3, §10 (cạm bẫy 6)",
        hoi: "Hệ thống cho phép nộp thử 10 lần. Những cách dùng nào là ĐÚNG theo bài?",
        chon: [
          "Nộp bản đã đóng băng tham số để xác nhận không vi phạm ràng buộc nào",
          "Nộp để xác nhận không quá giờ trên máy chấm thật",
          "Nộp 5 cấu hình khác nhau rồi giữ cấu hình có điểm phản hồi cao nhất",
          "Chỉnh T₀ theo điểm phản hồi sau mỗi lần nộp",
          "Coi 10 lượt nộp là tập kiểm định thứ hai: nhìn bao nhiêu lần cũng được"
        ],
        dung: [0, 1],
        giaiThich: "Lượt nộp thử dùng để xác nhận (có vi phạm không, có TLE không), không để chọn. Chỉnh hay chọn theo phản hồi thì 10 lượt đó thành tập huấn luyện và K hiệu dụng của bạn tăng, mà lần này không còn tập kiểm định nào nữa. “Nhìn bao nhiêu lần cũng được” vi phạm quy tắc sắt: mỗi lần nhìn kiểm định, nó thành huấn luyện."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 1, ref: "Bài tập 1",
        hoi: "Với σ/x̄ = 12 %, N = 50 test và K = 64 cấu hình: ảo giác bằng bao nhiêu phần trăm? Nếu bạn đo được cải thiện 2,0 % thì nên kết luận gì và làm gì tiếp?",
        goiY: ["Tính SE = σ/√N trước, rồi nhân với √(2 ln K).", "Bước ⑤ của quy trình một trang nói gì khi cải thiện nhỏ hơn ảo giác?"],
        mau: "- SE = 12 %/√50 = 1,70 %. √(2 ln 64) = √8,32 = 2,88. Ảo giác ≈ 1,70 × 2,88 = **4,9 %** (cận trên).\n- Cải thiện đo được **2,0 % < 4,9 %**: con số này nằm gọn trong “kỷ lục may mắn” của 64 lần thử, nên **chưa kết luận được gì**. Theo bước ⑤: dừng lại, giữ cấu hình mặc định.\n- Muốn tin nó: (a) chạy đúng một lần cấu hình đó trên dải seed kiểm định chưa nhìn; hoặc (b) tăng N để ảo giác ≤ Δ/2 = 1,0 %: N ≳ 8(σ/Δ)² ln K = 8 × 6² × 4,16 ≈ **1 198** test.",
        tieuChi: ["Tính đúng SE ≈ 1,7 % và ảo giác ≈ 4,9 %", "Kết luận: 2,0 % nhỏ hơn ảo giác nên chưa đủ bằng chứng, giữ cấu hình mặc định", "Nêu một việc tiếp theo cụ thể: seed kiểm định chạy một lần, hoặc tăng N lên cỡ 1 200"]
      },
      {
        id: "l2", doKho: 2, ref: "Bài tập 3, §4.1",
        hoi: "Với cùng ngân sách 64 lần chạy, hãy so quét lưới (2⁶) và lấy mẫu ngẫu nhiên (64 cấu hình) trên một hàm 6 chiều mà chỉ 2 chiều quan trọng. Chiến lược nào tìm được cực đại tốt hơn, và vì sao?",
        goiY: ["Đếm xem mỗi tham số quan trọng được thử bao nhiêu giá trị **khác nhau** trong từng chiến lược.", "Bốn chiều không quan trọng làm gì với ngân sách của lưới?"],
        mau: "Ngẫu nhiên thường tốt hơn.\n\n- **Lưới 2⁶** thử đúng 2 giá trị cho mỗi tham số. Trên hai chiều quan trọng nó chỉ có 2 × 2 = **4 điểm khác nhau**; 4 chiều còn lại không quan trọng nên 64 lần chạy thực chất là 4 điểm lặp lại 16 lần.\n- **Ngẫu nhiên 64 mẫu** cho mỗi tham số quan trọng **64 giá trị khác nhau**, phủ mặt phẳng hai chiều bằng 64 điểm riêng biệt nên khả năng rơi gần cực đại cao hơn nhiều.\n\nĐây là kết quả cổ điển của Bergstra & Bengio (2012). Hai lưu ý: ngẫu nhiên không thoát khỏi ảo giác (vẫn cần seed kiểm định), và ở 1–2 chiều thì quét lưới lại là lựa chọn rẻ và cho thấy cả hình dạng đường cong.",
        tieuChi: ["Chỉ ra lưới chỉ thử 2 giá trị (4 điểm khác nhau) cho hai tham số quan trọng, phần còn lại lặp", "Chỉ ra ngẫu nhiên thử 64 giá trị khác nhau cho mỗi tham số quan trọng", "Kết luận ngẫu nhiên thắng ở nhiều chiều khi chỉ một số ít tham số quan trọng"]
      },
      {
        id: "l3", doKho: 3, ref: "Bài tập 5, §3.2, §8",
        hoi: "Thiết kế quy trình tinh chỉnh cho đồ án P3 trong ngân sách **2 giờ máy** (một lần chạy solver kể cả chấm mất khoảng 30 ms). Ghi rõ: dải seed, số vòng sàng lọc, K và N mỗi vòng, và ảo giác ước tính ở vòng cuối.",
        goiY: ["Đổi 2 giờ máy ra số lần chạy trước: 7 200 s / 0,03 s.", "Dải seed huấn luyện phải đủ lớn cho vòng có N lớn nhất.", "Ablation chạy trước để biết chỉ tinh chỉnh 2–3 tham số nào."],
        mau: "**Ngân sách:** 7 200 s / 0,03 s ≈ 240 000 lần chạy; kế hoạch dưới đây dùng ≈ 86 000 lần (≈ 43 phút), phần còn lại để dự phòng và ablation.\n\n- **Trước hết:** chốt thuật toán (cạm bẫy 2), chạy ablation để xếp hạng, chỉ tinh chỉnh 2–3 tham số đầu bảng (ví dụ bề rộng beam, hệ số phạt thời gian chết); tham số tỉ lệ quét theo thang log, ≥ 6 chiều thì lấy mẫu ngẫu nhiên.\n- **Dải seed:** huấn luyện 1…1 200 (đủ cho vòng 3 cần 1 000 test), kiểm định 9 001…9 300 — **không nhìn** tới bước cuối.\n- **Vòng 1:** K = 1 500 × N = 30 = 45 000 lần, giữ 150. **Vòng 2:** 150 × 200 = 30 000, giữ 10. **Vòng 3:** 10 × 1 000 = 10 000, chọn 1. **Vòng 4:** 1 × 300 kiểm định = 300 lần, **đúng một lần**; kiểm thêm ở ba quy mô (3 × 300 = 900 lần).\n- **Ảo giác vòng cuối** (σ/x̄ = 10 %): K = 10, N = 1 000 ⇒ 0,1/√1 000 × √(2 ln 10) ≈ **0,68 %**. Tính thận trọng với K cộng dồn ≈ 1 500 thì ≈ 1,2 %.\n- **Quy tắc dừng:** nếu cải thiện huấn luyện nhỏ hơn ảo giác, hoặc kiểm định thấp hơn mặc định, giữ cấu hình mặc định; sau cùng đóng băng và ghi nhật ký.",
        tieuChi: ["Có dải seed huấn luyện và kiểm định tách riêng, ghi rõ khoảng; dải huấn luyện đủ lớn cho vòng có N lớn nhất", "Sàng lọc ≥ 3 vòng với K giảm và N tăng, tổng số lần chạy nằm trong ngân sách (đã đổi giờ máy ra số lần)", "Ước lượng ảo giác bằng (σ/√N)·√(2 ln K), và nhắc rằng K cộng dồn", "Kiểm định chạy đúng một lần, kiểm ở ba quy mô, có quy tắc dừng nếu cải thiện nhỏ hơn ảo giác"]
      }
    ],

    lab: [
      {
        id: "ao-giac-seed",
        ten: "Tự tạo ảo giác rồi đo nó",
        doKho: 2,
        ref: "§1, §3.1, §8, §9",
        de: "Bạn mô phỏng thí nghiệm ở §9 của bài. Trang đưa cho bạn điểm của một cấu hình **mặc định** và `K` cấu hình **ứng viên** trên `N` seed huấn luyện, kèm điểm của chúng trên `M` seed kiểm định. Ở ba biến thể đầu mọi cấu hình đều **y hệt nhau về chất lượng** (chỉ khác hạt giống), nên mọi “cải thiện” bạn thấy đều là ảo giác.\n\n" +
            "Với mỗi bộ dữ liệu, hãy:\n\n" +
            "1. Chọn ứng viên có **điểm trung bình huấn luyện** cao nhất (hoà thì chỉ số nhỏ hơn) — gọi là `best`.\n" +
            "2. Tính **cải thiện huấn luyện** (%) của `best` so với cấu hình mặc định: (trung bình `best` / trung bình mặc định − 1) × 100.\n" +
            "3. Tính **ảo giác ước tính** (%) = (σ/x̄)/√N · √(2 ln K) × 100, với σ là độ lệch chuẩn **mẫu** (chia n − 1) và x̄ là trung bình của cấu hình mặc định trên N seed huấn luyện.\n" +
            "4. Quy tắc bước ⑤: in `tinDuoc` = 1 nếu cải thiện huấn luyện **lớn hơn** ảo giác, ngược lại 0.\n" +
            "5. `nCan` = N ≳ 8(σ/Δ)² ln K, làm tròn **lên**, với σ/x̄ như trên và Δ là cải thiện huấn luyện dưới dạng phân số (3 % ⇒ 0,03).\n" +
            "6. Cải thiện **kiểm định** (%) của `best` so với mặc định, tính trên `M` seed kiểm định — con số không bị thổi phồng.\n\n" +
            "In sáu số theo đúng thứ tự trên. *(Ở đời thật bạn chỉ được chạy cấu hình cuối trên kiểm định đúng một lần; ở đây dữ liệu kiểm định của mọi cấu hình có sẵn để mô phỏng — hãy chỉ đọc cột của `best`.)*\n\n" +
            "**Mức đạt:** hợp lệ trên mọi test (đúng cả sáu số). Sau đó đổi biến thể và suy ngẫm: (a) ảo giác thay đổi thế nào khi K từ 20 lên 100, khi N từ 30 lên 200 — tỉ lệ hai ảo giác ở N = 30 và N = 200 có gần √(200/30) ≈ 2,58 không? (b) vì sao cải thiện kiểm định cứ quanh 0 ở ba biến thể đầu? (c) ở biến thể cuối (có một cấu hình tốt thật) kiểm định giữ lại được bao nhiêu phần của cải thiện huấn luyện — đối chiếu với bảng §3.1.",
        vanDe: "b20b-ao-giac",
        bienThe: [
          { ten: "Chỉ nhiễu: K = 100, N = 30", tham: { K: 100, N: 30, M: 300 } },
          { ten: "Chỉ nhiễu: K = 20, N = 30", tham: { K: 20, N: 30, M: 300 } },
          { ten: "Chỉ nhiễu: K = 100, N = 200", tham: { K: 100, N: 200, M: 300 } },
          { ten: "Có một cấu hình tốt thật (+4 %): K = 100, N = 200", tham: { K: 100, N: 200, M: 300, hieuUng: 0.04 } }
        ],
        soTest: 8,
        gioiHanMs: 2000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào : dòng 1 "K N M"; rồi K+1 dòng điểm HUẤN LUYỆN (dòng 0 = cấu hình mặc định, mỗi dòng N số);
//            rồi K+1 dòng điểm KIỂM ĐỊNH (mỗi dòng M số).
// Đầu ra  : best  caiThienHL%  aoGiac%  tinDuoc  nCan  caiThienKD%   (sáu số, cách nhau khoảng trắng)
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let p = 0;
const K = t[p++], N = t[p++], M = t[p++];
const huanLuyen = [], kiemDinh = [];
for (let i = 0; i <= K; i++) { huanLuyen.push(t.slice(p, p + N)); p += N; }
for (let i = 0; i <= K; i++) { kiemDinh.push(t.slice(p, p + M)); p += M; }

const tb = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const doLech = (a) => {
  // TODO: độ lệch chuẩn MẪU (chia n − 1) của mảng a
};

// TODO 1: best = ứng viên j (1..K) có tb(huanLuyen[j]) cao nhất (hoà → chỉ số nhỏ hơn)
// TODO 2: caiThienHL (%), aoGiac (%) = (σ/x̄)/√N · √(2 ln K) · 100, với σ, x̄ của huanLuyen[0]
// TODO 3: tinDuoc (0/1), nCan = ceil(8 · (σ/x̄ / Δ)² · ln K), caiThienKD (%) của best trên kiemDinh

print("TODO");
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int K, N, M;
    scanf("%d %d %d", &K, &N, &M);
    vector<vector<double>> huanLuyen(K + 1, vector<double>(N)), kiemDinh(K + 1, vector<double>(M));
    for (int i = 0; i <= K; i++) for (int j = 0; j < N; j++) scanf("%lf", &huanLuyen[i][j]);
    for (int i = 0; i <= K; i++) for (int j = 0; j < M; j++) scanf("%lf", &kiemDinh[i][j]);

    // TODO 1: best = ứng viên j (1..K) có trung bình huấn luyện cao nhất (hoà → chỉ số nhỏ hơn)
    // TODO 2: caiThienHL (%), aoGiac (%) = (sigma/xbar)/sqrt(N) * sqrt(2 ln K) * 100, sigma là độ lệch chuẩn MẪU (chia n - 1)
    // TODO 3: tinDuoc (0/1), nCan = ceil(8 * (sigma/xbar / Delta)^2 * ln K), caiThienKD (%)

    printf("TODO\n");
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let p = 0;
const K = t[p++], N = t[p++], M = t[p++];
const huanLuyen = [], kiemDinh = [];
for (let i = 0; i <= K; i++) { huanLuyen.push(t.slice(p, p + N)); p += N; }
for (let i = 0; i <= K; i++) { kiemDinh.push(t.slice(p, p + M)); p += M; }

const tb = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const doLech = (a) => {
  const m = tb(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));   // chia n − 1
};

// 1. Ứng viên có điểm trung bình huấn luyện cao nhất (hoà → chỉ số nhỏ hơn nhờ dấu >)
let best = 1;
for (let j = 2; j <= K; j++) if (tb(huanLuyen[j]) > tb(huanLuyen[best])) best = j;

// 2. Cải thiện huấn luyện và ảo giác (đều tính bằng %)
const m0 = tb(huanLuyen[0]);
const caiThienHL = (tb(huanLuyen[best]) / m0 - 1) * 100;
const cv = doLech(huanLuyen[0]) / m0;                                  // σ / x̄
const aoGiac = cv / Math.sqrt(N) * Math.sqrt(2 * Math.log(K)) * 100;

// 3. Quy tắc bước ⑤, số test cần, và con số kiểm định không bị thổi phồng
const tinDuoc = caiThienHL > aoGiac ? 1 : 0;
const nCan = Math.ceil(8 * Math.pow(cv / (caiThienHL / 100), 2) * Math.log(K));
const caiThienKD = (tb(kiemDinh[best]) / tb(kiemDinh[0]) - 1) * 100;

print([best, caiThienHL.toFixed(4), aoGiac.toFixed(4), tinDuoc, nCan, caiThienKD.toFixed(4)].join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

static double tb(const vector<double>& a) {
    double s = 0;
    for (double x : a) s += x;
    return s / a.size();
}
static double doLech(const vector<double>& a) {          // độ lệch chuẩn mẫu, chia n - 1
    double m = tb(a), s = 0;
    for (double x : a) s += (x - m) * (x - m);
    return sqrt(s / (a.size() - 1));
}

int main() {
    int K, N, M;
    scanf("%d %d %d", &K, &N, &M);
    vector<vector<double>> huanLuyen(K + 1, vector<double>(N)), kiemDinh(K + 1, vector<double>(M));
    for (int i = 0; i <= K; i++) for (int j = 0; j < N; j++) scanf("%lf", &huanLuyen[i][j]);
    for (int i = 0; i <= K; i++) for (int j = 0; j < M; j++) scanf("%lf", &kiemDinh[i][j]);

    int best = 1;                                         // hoà → chỉ số nhỏ hơn nhờ dấu >
    for (int j = 2; j <= K; j++) if (tb(huanLuyen[j]) > tb(huanLuyen[best])) best = j;

    double m0 = tb(huanLuyen[0]);
    double caiThienHL = (tb(huanLuyen[best]) / m0 - 1) * 100;
    double cv = doLech(huanLuyen[0]) / m0;
    double aoGiac = cv / sqrt((double)N) * sqrt(2 * log((double)K)) * 100;
    int tinDuoc = caiThienHL > aoGiac ? 1 : 0;
    double d = caiThienHL / 100;
    long long nCan = (long long)ceil(8 * (cv / d) * (cv / d) * log((double)K));
    double caiThienKD = (tb(kiemDinh[best]) / tb(kiemDinh[0]) - 1) * 100;

    printf("%d %.4f %.4f %d %lld %.4f\n", best, caiThienHL, aoGiac, tinDuoc, nCan, caiThienKD);
    return 0;
}
`
        },
        goiY: [
          "Độ lệch chuẩn mẫu chia cho n − 1 (không phải n). Tính σ và x̄ chỉ trên dòng 0 của khối huấn luyện.",
          "Cải thiện huấn luyện = trung bình của `best` chia trung bình của dòng 0 rồi trừ 1; ảo giác dùng cùng đơn vị (nhân 100).",
          "`nCan` = ceil(8 · (σ/x̄ / Δ)² · ln K) với Δ là cải thiện huấn luyện dạng phân số; cải thiện kiểm định lấy cột `best` của khối kiểm định, chia cho trung bình dòng 0 của khối đó."
        ]
      }
    ]
  });
})();
