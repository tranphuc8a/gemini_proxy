/* Thực hành — Ca nghiên cứu 2607: Định tuyến chọn lọc (thợ vệ sinh điều hoà).
   Đọc hiểu và vận dụng; kèm một lab nhỏ cài "giá mờ λ* riêng cho từng test bằng nới lỏng LP" (hướng chưa khai thác số 3 của ca này). */

/* Bài toán tự dựng: nới lỏng LP cái túi của 2607 — loại biên, λ* = p/(s+τ) và giá trị LP. Tiền tố ca2607-. */
(function () {
  var PRICE = [0, 80000, 140000, 180000, 240000, 250000, 300000];
  function chiPhi(m, tau) { return 30 * m + 30 + tau; }
  /* trả {m, lam, val, tie}: tie = ngân sách vừa khít (không có món cắt dở) → tránh khi sinh dữ liệu */
  function lp(ty, tau, B) {
    var cnt = [0, 0, 0, 0, 0, 0, 0], i, q;
    for (i = 0; i < ty.length; i++) cnt[ty[i]]++;
    var loai = [1, 2, 3, 4, 5, 6].sort(function (a, b) { return PRICE[b] / chiPhi(b, tau) - PRICE[a] / chiPhi(a, tau); });
    var con = B, val = 0;
    for (q = 0; q < loai.length; q++) {
      var m = loai[q], c = chiPhi(m, tau);
      if (cnt[m] * c <= con + 1e-9) {
        con -= cnt[m] * c; val += cnt[m] * PRICE[m];
        if (cnt[m] > 0 && Math.abs(con) < 1e-9) return { m: 0, lam: 0, val: val, tie: true };
        continue;
      }
      var k = Math.floor(con / c), fr = con - k * c;
      if (Math.abs(fr) < 1e-9) return { m: 0, lam: 0, val: val, tie: true };
      return { m: m, lam: PRICE[m] / c, val: val + k * PRICE[m] + fr / c * PRICE[m], tie: false };
    }
    return { m: 0, lam: 0, val: val, tie: false };      /* mọi nhà đều vừa */
  }

  TH.vande.dangKy("ca2607-gia-mo-lp", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TH.tienIch.rng(seed), tau = tham.tau == null ? 9.5 : tham.tau, B = 22320;
      var N = r.khoang(200, 399), seen = {}, ty = [];
      for (var i = 0; i < N; i++) {
        var y = r.int(100), x = r.int(100), k = y * 100 + x;
        if (!seen[k]) { seen[k] = 1; ty.push(r.khoang(1, 6)); }          /* nhà trùng ô bị ghi đè, như init() của đề */
      }
      while (lp(ty, tau, B).tie) ty.pop();                                 /* tránh trường hợp ngân sách vừa khít */
      return { n: ty.length, tau: tau, B: B, ty: ty };
    },
    viet: function (inst) { return inst.n + "\n" + inst.tau + " " + inst.B + "\n" + inst.ty.join("\n") + "\n"; },
    giai: function (inst) { var o = lp(inst.ty, inst.tau, inst.B); return [o.m, o.lam, o.val]; },
    saiSo: 0.01,
    dinhDang: {
      vao: "Dòng 1: `n` — số nhà (đã loại ô trùng). Dòng 2: `τ B` — số phút di chuyển phân bổ cho mỗi nhà và ngân sách (22 320). Tiếp theo `n` dòng, mỗi dòng là loại máy `m` ∈ {1…6} của một nhà.",
      ra: "Một dòng `m* λ* LP`: `m*` là loại biên (loại của món bị cắt dở), `λ* = p/(s+τ)` của loại biên (điểm/phút), `LP` là tổng giá trị của nghiệm nới lỏng. In `λ*` và `LP` với ít nhất 2 chữ số thập phân; sai số cho phép 0,01."
    }
  }));
})();

TH.dangKy({
  id: "ca-2607",

  tomTat: [
    "Bài 2607 (thợ vệ sinh điều hoà): 200–399 nhà trên lưới 100 × 100, mỗi ngày 720 phút, thưởng OT 200 điểm/phút sau phút 480; chọn tập nhà và sắp thứ tự thành MỘT đường đi mở rồi cắt thành các ngày. Là Team Orienteering / OPHS nhưng không có depot — ngày sau bắt đầu đúng nơi ngày trước kết thúc.",
    "Ba món quà chỉ có trong mã: nextDay() gọi được 30 lần ⇒ 31 khung ngày (22 320 phút, +3,08 %); vị trí không reset khi sang ngày; mọi phút sau lần dọn cuối ngày không sinh điểm nên dùng để đi trước là miễn phí (+0,45 %). Thưởng OT co rút: tổng cả ngày = 200 × max(0, T_end − 480).",
    "Một phút chết không đáng 200 điểm mà đáng giá mờ λ ≈ 1 420 (gấp ~7 lần), vì lẽ ra có thể dùng để vệ sinh. λ* lý thuyết ≈ 1 367 (nới lỏng LP), thực nghiệm 1 420, đường cong rất phẳng. Hàm mục tiêu một ngày: F = Σ(p + OT − λc) − λ·w, w là thời gian chết thật.",
    "Lõi thuật toán là beam search theo ngày (bề rộng 24, 10 nhánh, sâu ≤ 13) xếp hạng bằng rank = f + ρ·(720 − t) với ρ = 90 ≈ thặng dư trung bình ~81 điểm/phút. Trạng thái gọn (vị trí, thời gian đã dùng, danh sách nhà trong ngày) nên beam hợp bài này.",
    "Kết quả: 30 714 270 (greedy tỉ số) → 32 915 840 điểm (+7,17 %), 27,4 ms trên giới hạn 100 ms, 0 vi phạm / 1 000 test. Ablation: khung ngày thứ 31 −3,08 %, beam −2,43 %, phạt thời gian chết −2,43 %, di chuyển chết −0,45 %, multi-start λ −0,22 %.",
    "2-opt/Or-opt rút ngắn quãng đường 20–30 % nhưng làm điểm giảm 6–10 %: đóng gói ngày thắng rút ngắn đường đi, tỉ lệ khoảng 6 : 1. Cùng kỹ thuật LNS lại cho +3,0 % ở đây nhưng −9 % ở 2605 — vì nghiệm là tuyến đường (cấu trúc cục bộ) chứ không phải một thứ tự toàn cục.",
    "An toàn: SCORE tích luỹ xuyên test nên một vi phạm xoá hết; evaluate() là nguồn sự thật duy nhất; cờ USE_31_DAYS (bản bảo thủ vẫn hơn baseline +3,86 % / +2,33 %); cấu hình dự phòng 1 preset chỉ 8,6 ms, mất 0,22 %. Bài học: mô hình hoá đúng + tìm kiếm vừa phải thắng metaheuristic mạnh hơn.",
    "Còn ~3 % tới cận trên τ = 7 (khoảng 360 phút di chuyển dư), nhưng chỉ cận τ = 0 là nới lỏng chắc chắn đúng; cận τ = 7 và 9,5 dựa trên ước lượng quãng đường nên là mốc tham chiếu. Hướng mở: beam nhìn xa 2 ngày, phân vùng theo luồng công việc, λ thích nghi theo từng test."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "01 §4.5", donVi: "(phút)",
      hoi: "Trong main.cpp của đề 2607, nextDay() chặn khi gCurrentDay ≥ 30 (khởi tạo bằng 0), còn move() không hề kiểm tra gCurrentDay. Mỗi ngày làm việc tối đa 720 phút. Ngân sách phút thực tế của một test case là bao nhiêu?",
      dapAn: 22320, saiSo: 0,
      giaiThich: "Gọi nextDay() lần thứ 30 thì gCurrentDay = 30 và thợ vẫn làm việc được (ngày 30); chỉ lần gọi thứ 31 mới làm SCORE = 0. Vậy có 31 khung ngày: 31 × 720 = 22 320 phút, không phải 30 × 720 = 21 600 như văn bản đề gợi ý. Khung thứ 31 đáng +3,08 % điểm (1 014 944 điểm) — đó là lý do phải đọc mã grader chứ không chỉ đọc đề. Vì có thể bị coi là off-by-one nên tài liệu đặt cờ USE_31_DAYS để tắt."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "01 §4.2",
      hoi: "Thưởng OT của một ngày (200 điểm cho mỗi phút sau phút 480, chỉ tính khi đáp xuống ô có nhà) phụ thuộc vào đại lượng nào?",
      chon: [
        "Số nhà được dọn sau phút 480, nhân với 200",
        "Tổng thời gian dọn trong khung sau phút 480, nên chia công việc thành nhiều nhà nhỏ thì thưởng cao hơn",
        "Chỉ phụ thuộc thời điểm kết thúc lần dọn cuối cùng trong ngày: 200 × max(0, T_end − 480), bất kể ngày được chia thành bao nhiêu lần dọn",
        "Tổng thời gian di chuyển trong ngày, vì thưởng tính cả lúc đi đường"
      ],
      dung: 2,
      giaiThich: "Mỗi bước thưởng 200·(end − max(480, start)); vì start của bước sau đúng bằng end của bước trước nên các khoảng [start, end] lát kín trục thời gian và cộng dồn “co rút” thành 200·max(0, T_end − 480). Do đó thưởng không phụ thuộc cách chia nhỏ công việc, mà chỉ phụ thuộc ngày kết thúc lúc mấy giờ (trần 240 × 200 = 48 000 điểm/ngày). Đi vào ô trống không được thưởng nên thời gian đi đường chỉ có giá trị khi nó dẫn tới một lần dọn."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "03 §2.3 · Bài 6", donVi: "(điểm/phút)",
      hoi: "Bài 6, cách 1 (nới lỏng LP): với τ = 9,5 phút di chuyển phân bổ cho mỗi nhà và khoảng 49 nhà mỗi loại, ngân sách 22 320 phút được lấp theo thứ tự p/(s+τ) giảm dần: loại 4, 2, 3 chiếm 19 038 phút, rồi tới loại 6 (p = 300 000, s = 210) là loại biên. Giá mờ lý thuyết λ* = p/(s+τ) của loại biên bằng bao nhiêu (làm tròn đến đơn vị)?",
      dapAn: 1367, saiSo: 1,
      giaiThich: "λ* = 300 000 / (210 + 9,5) = 300 000 / 219,5 ≈ 1 366,7 ≈ 1 367. Thực nghiệm quét cho tối ưu ở 1 420, cao hơn ~4 %: heuristic tham lam có xu hướng “tiêu hoang” thời gian nên cần giá mờ cao hơn một chút để tự kiềm chế; đường cong rất phẳng trong [1 380; 1 460] (chênh < 0,15 %) nên lệch này vô hại. Dù chọn 1 367 hay 1 420, một phút bỏ phí đều đáng khoảng 7 lần 200 điểm tiền OT."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "01 §5, 03 §2.2 · Bài 6",
      hoi: "Trực giác nói “một phút dư cuối ngày chỉ mất 200 điểm tiền OT”. Tài liệu nói nó đáng khoảng 1 420 điểm. Giải thích nào đúng?",
      chon: [
        "Bộ chấm phạt 1 420 điểm cho mỗi phút chết",
        "Thưởng OT thực ra là 1 420 điểm/phút chứ không phải 200",
        "Mỗi phút di chuyển rỗng bị trừ 1 420 điểm để khuyến khích dọn nhà",
        "Đó là chi phí cơ hội: phút ấy lẽ ra có thể dùng để vệ sinh nhà, nên đáng giá trị biên λ của một phút ngân sách; 200 chỉ là tiền OT bị mất, thấp hơn khoảng 7 lần"
      ],
      dung: 3,
      giaiThich: "Giá mờ λ là giá trị biên của một đơn vị ngân sách: phút bỏ phí không chỉ mất 200 điểm thưởng mà còn mất cơ hội dọn thêm nhà (khoảng 1 420 điểm/phút trên tổng thể). Bộ chấm không hề phạt phút chết hay phút đi đường — nó chỉ cộng điểm khi dọn xong và thưởng OT 200/phút; nên ba phương án còn lại đều bịa ra một quy tắc không có trong mã. Chính nhận ra điều này dẫn tới hàm mục tiêu F = Σ(p + OT − λc) − λ·w."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "03 §3.4 · Bài 16 §4",
      hoi: "Ở beam search theo ngày, các trạng thái cùng một mức có cùng số nhà đã nhận nhưng khác thời gian đã dùng t. Vì sao xếp hạng bằng rank = f + ρ·(720 − t) tốt hơn chỉ xếp theo f?",
      chon: [
        "Vì f chỉ phản ánh quãng đường, còn ρ·(720 − t) mới phản ánh điểm đã thu",
        "Vì chỉ xếp theo f thì beam thiên vị các trạng thái đã tiêu nhiều thời gian; số hạng ρ·(720 − t) cộng thêm giá trị ước lượng của thời gian còn lại (ρ ≈ 90 điểm/phút, sát thặng dư trung bình ~81 điểm/phút của một nhà)",
        "Vì ρ chính là giá mờ λ = 1 420 nên số hạng này cộng lại toàn bộ giá trị gộp của thời gian còn lại",
        "Vì ρ làm beam đa dạng hơn bằng cách ngẫu nhiên hoá thứ hạng"
      ],
      dung: 1,
      giaiThich: "Đo thực nghiệm: ρ = 0 cho 32 799 505, ρ = 90 cho 32 849 395 (+0,15 %), ρ = 220 chỉ 32 679 790 — đường cong có đỉnh gần lý thuyết. Lưu ý quan trọng: ở lời giải này f đã là giá trị ròng Σ(p + OT − λc), tức đã trừ chi phí cơ hội λ của thời gian đã dùng, nên phần “tiềm năng” còn lại chỉ là thặng dư ~81 điểm/phút chứ không phải λ = 1 420 (ρ = λ chỉ đúng khi f tính gộp, như ở ví dụ của Bài 16). Số hạng này không ngẫu nhiên hoá gì và cũng không liên quan tới quãng đường."
    },
    {
      id: "q6", loai: "mot", doKho: 3, ref: "02 §5 · Bài 11 §4",
      hoi: "2-opt/Or-opt làm quãng đường giảm 20–30 % nhưng điểm giảm 6–10 %. Vì sao?",
      chon: [
        "Trên tuyến đã tối ưu kiểu TSP, nhà kế tiếp luôn rất gần (~5 phút); khi cuối ngày nhà kế tiếp cần 130 phút thì khoảng 70 phút dư thành thời gian chết hoàn toàn, vì di chuyển trước chỉ tiêu thụ được ~5 phút. Cộng 31 ngày mất cỡ 3,1 triệu điểm, trong khi tiết kiệm đường chỉ đem lại ~0,48 triệu",
        "Cài đặt 2-opt có lỗi làm tuyến vượt 720 phút nên bị trừ điểm",
        "Quãng đường ngắn hơn làm thưởng OT biến mất vì OT được tính theo quãng đường",
        "Quãng đường không liên quan gì tới thời gian trong ngày nên mọi thay đổi đường đi chỉ gây nhiễu ngẫu nhiên"
      ],
      dung: 0,
      giaiThich: "Đây là xung đột cấu trúc chứ không phải lỗi cài đặt: tuyến TSP chặt làm các nhà liên tiếp sát nhau, nên khi ngày kết thúc thì phần thời gian dư không còn chỗ dùng. Ba biện pháp khắc phục (kiểm chứng bằng hàm Lagrange SUR, đóng gói có sửa chữa, chấp nhận vô điều kiện mọi nước giảm đường) đều không cứu được. Kết luận “đóng gói ngày thắng rút ngắn đường đi khoảng 6 : 1” và mô-típ của khoá: tối ưu chỉ tiêu phụ (quãng đường) có thể phản tác dụng, luôn đo bằng hàm mục tiêu thật."
    },
    {
      id: "q7", loai: "so", doKho: 2, ref: "02 §1.4 · 03 §2.1", donVi: "(điểm)",
      hoi: "Với λ = 1 420 điểm/phút, nhà loại 1 (p = 80 000, s = 60) nằm cách vị trí hiện tại 2 phút. Bỏ qua thưởng OT, giá trị ròng v = p − λ·(d + s) của nhà này bằng bao nhiêu?",
      dapAn: -8040, saiSo: 0,
      giaiThich: "v = 80 000 − 1 420 × (2 + 60) = 80 000 − 88 040 = −8 040 < 0. Nghĩa là dù nhà ở rất gần (tỉ số p/(d+s) = 1 290, trông không tệ so với 1 500 của một nhà loại 4 cách 10 phút), nó vẫn làm tụt giá trị ròng — greedy theo tỉ số hay “gặm” những nhà nhỏ như vậy quanh mình rồi để lại thời gian chết cuối ngày. Đối chiếu: nhà loại 4 cách 10 phút có v = 240 000 − 1 420 × 160 = +12 800 > 0."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "03 §3.1–3.2 · 2605 Bài 16",
      hoi: "Beam search theo ngày là lõi lời giải 2607 nhưng được tài liệu xếp là “không áp dụng” cho 2605. Điều kiện nào của Bài 16 giải thích sự khác biệt?",
      chon: [
        "Beam chỉ chạy được khi bài toán có ràng buộc ngân sách; 2605 thì không có",
        "Beam cần ngân sách thời gian rất ngắn; 2605 có 1 000 ms nên không cần dùng",
        "Trạng thái phải tóm tắt được: ở 2607 trạng thái gọn (vị trí, thời gian đã dùng, vài chục nhà đã nhận trong ngày — một ngày chỉ chứa tối đa khoảng 12 nhà) nên sao chép và so sánh rẻ; ở 2605 trạng thái là toàn bộ hình dạng các vùng nhớ đã chiếm, không nén được và sao chép tốn O(k)",
        "Beam chỉ dùng được cho bài cực đại hoá, không dùng được cho bài cực tiểu hoá như 2605"
      ],
      dung: 2,
      giaiThich: "Điều kiện áp dụng của Bài 16: trạng thái phải tóm tắt được. Ở 2607 một ngày chỉ có vài chục nhà tối đa nên mảng take[] nằm gọn trong 26 byte và chiều sâu nông (≤ 13), nơi beam phát huy tốt nhất. Ở 2605 beam bề rộng B tốn O(B·N) bộ nhớ và O(B·N·K) thời gian. Cực đại hay cực tiểu không phải điều kiện (đổi dấu hàm mục tiêu là xong), và việc có ràng buộc ngân sách hay không liên quan tới giá mờ (Bài 6) chứ không phải beam."
    },
    {
      id: "q9", loai: "nhieu", doKho: 3, ref: "03 §4.1",
      hoi: "Về kỹ thuật “di chuyển chết cuối ngày” (đi trước về mục tiêu của ngày mai bằng thời gian thừa), những phát biểu nào đúng?",
      chon: [
        "Chỉ được thực hiện sau lần vệ sinh cuối cùng trong ngày; di chuyển rỗng giữa ngày sau phút 480 sẽ tạo “lỗ” trong chuỗi lát kín thời gian và mất đúng 200 điểm mỗi phút",
        "Nên thực hiện cả giữa ngày để rút ngắn đường của ngày mai",
        "Ô đích bắt buộc phải trống: đáp xuống ô có nhà là bắt buộc vệ sinh và có thể vượt 720 phút ⇒ SCORE = 0; vì vậy chỉ đi tối đa d − 1 bước và dùng bảng occAll bỏ qua mọi ô từng có nhà",
        "Nó làm tăng thời gian chết thật sự của lịch trình vì thợ đi mà không dọn",
        "Là cải tiến trội tuyệt đối vì các phút sau lần dọn cuối vốn không sinh điểm (đo được +0,45 %), nên chi phí cơ hội bằng không"
      ],
      dung: [0, 2, 4],
      giaiThich: "Ba phát biểu đúng chính là ba điều kiện của kỹ thuật: (a) chỉ sau lần dọn cuối ngày, vì di chuyển rỗng giữa ngày sau phút 480 mất 200 điểm/phút; (b) ô đích phải trống và chỉ đi tới d − 1 để không tình cờ đáp lên một nhà — đoạn mã nguy hiểm nhất của lời giải; (c) miễn phí tuyệt đối nên +0,45 %. Phát biểu về “tăng thời gian chết” là ảo giác của cách đo: cột “phút chết” gộp cả di chuyển rỗng (~181 phút), thời gian chết thật chỉ còn ≈ 88 phút trên 31 ngày; thậm chí bỏ kỹ thuật này thì cột đó giảm xuống 220 nhưng điểm vẫn tụt 0,45 %."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "03 §4.2 · Bài 20 §10.3",
      hoi: "Lời giải đề xuất dùng 31 khung ngày nhưng đặt cờ USE_31_DAYS để tắt được. Lý do chính của việc đặt cờ và giữ bản bảo thủ là gì?",
      chon: [
        "Vì dùng ngày thứ 31 luôn làm SCORE = 0 nên cờ để tắt nó đi",
        "Văn bản đề nói 30 ngày; nếu ban tổ chức coi đây là lỗi off-by-one và sửa main lúc chấm chính thức thì bản bảo thủ vẫn hơn hai baseline (+3,86 % và +2,33 %) — giá trị cốt lõi của lời giải không phụ thuộc vào khai thác này",
        "Vì khai thác này bị đề cấm rõ ràng và có thể bị trừ điểm",
        "Vì tắt cờ làm lời giải chạy nhanh hơn 3 lần"
      ],
      dung: 1,
      giaiThich: "Lập luận ủng hộ khai thác: đề nói main được dùng nguyên trạng khi chấm, và lời giải chỉ gọi API công khai đúng số lần cho phép (không đụng biến của main). Lập luận phản đối: văn bản đề nói 30 ngày. Cờ biến rủi ro thành một dòng chỉnh; bản bảo thủ đạt 31 900 896 điểm. Dùng ngày 31 không gây SCORE = 0 (chỉ lần gọi nextDay() thứ 31 mới gây), và tắt cờ chỉ đổi 26,8 ms so với 27,4 ms — không liên quan tới tốc độ."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "03 §2.3 · Bài 6",
      hoi: "Áp dụng cách 1 của Bài 6 (nới lỏng LP) cho 2607. Dữ liệu: loại máy m = 1…6 có p = 80 000, 140 000, 180 000, 240 000, 250 000, 300 000 và s = 30m + 30 phút; τ = 9,5 phút/nhà; khoảng 49 nhà mỗi loại; ngân sách 22 320 phút. Hãy xếp các loại theo p/(s+τ), tìm loại biên, tính λ* rồi so với λ = 1 420 tìm được bằng quét thực nghiệm. Vì sao thực nghiệm lại cao hơn?",
      goiY: [
        "Chi phí của một nhà là s + τ; dung lượng của một loại là 49 × (s + τ).",
        "Cộng dồn dung lượng theo thứ tự tỉ số giảm dần cho tới khi vượt 22 320 phút."
      ],
      mau: "Tỉ số p/(s+τ): loại 4 → 240 000 / 159,5 = 1 504,7; loại 2 → 140 000 / 99,5 = 1 407,0; loại 3 → 180 000 / 129,5 = 1 389,9; loại 6 → 300 000 / 219,5 = 1 366,7; loại 5 → 250 000 / 189,5 = 1 319,3; loại 1 → 80 000 / 69,5 = 1 151,1. Thứ tự: 4 > 2 > 3 > 6 > 5 > 1.\n\nDung lượng mỗi loại = 49 × (s+τ): loại 4 → 7 816; thêm loại 2 → +4 876 = 12 692; thêm loại 3 → +6 346 = 19 038 phút. Còn 22 320 − 19 038 = 3 282 phút, nhỏ hơn dung lượng loại 6 (10 756) nên loại 6 là **loại biên** (chỉ nhận một phần). Vậy λ* = p/(s+τ) của loại 6 ≈ **1 367**.\n\nThực nghiệm cho 1 420, cao hơn khoảng 4 %: heuristic tham lam có xu hướng “tiêu hoang” thời gian, nên cần giá mờ cao hơn một chút để tự kiềm chế; hơn nữa đường cong điểm theo λ rất phẳng quanh đó (chênh < 0,15 % trong [1 380; 1 460]) nên lệch này gần như vô hại. Lý thuyết dùng để định hướng, thực nghiệm dùng để chốt.",
      tieuChi: [
        "Tính đúng các tỉ số p/(s+τ) và xếp thứ tự 4 > 2 > 3 > 6 > 5 > 1",
        "Cộng dồn dung lượng (49 × (s+τ)) và xác định loại 6 là loại biên",
        "Tính λ* ≈ 1 367 và nêu độ lệch ≈ 4 % so với 1 420",
        "Giải thích vì sao thực nghiệm cao hơn và vì sao điều đó ít quan trọng (đường cong phẳng)"
      ]
    },
    {
      id: "l2", doKho: 3, ref: "03 §5 · Bài 8, Bài 16",
      hoi: "Bảng (40 test case): 1 giá trị λ với beam W10/B6 → 32 769 280 (3,4 ms); 1 λ, W32/B10 → 32 907 685 (14,5 ms); 3 λ, W20/B8 → 32 918 615 (31,3 ms); 5 λ, W16/B7 → 32 902 360 (34,4 ms); 10 λ, W12/B6 → 32 907 900 (37,7 ms). Với ngân sách tính toán cố định (không có đồng hồ để đo thời gian), nên ưu tiên mở rộng bề rộng beam hay tăng số lần khởi động theo λ? Giải thích bằng số liệu và bằng hình dạng của đường cong λ.",
      goiY: [
        "So sánh các cấu hình có thời gian gần nhau: (1 λ, W32/B10, 14,5 ms) với (10 λ, W12/B6, 37,7 ms).",
        "Đường cong điểm theo λ rất phẳng quanh 1 420 — hệ quả của nó với tính đa dạng giữa các lần khởi động là gì?"
      ],
      mau: "Từ W10/B6 lên W32/B10 với cùng 1 λ: +0,42 % (32 769 280 → 32 907 685), chỉ tốn thêm khoảng 11 ms. Ngược lại, tăng số lần khởi động: 10 λ với W12/B6 (37,7 ms) chỉ ngang 1 λ với W32/B10 (14,5 ms) — 32 907 900 so với 32 907 685, hơn 0,0007 % — dù tốn gấp ~2,6 lần thời gian; 3 λ với W20/B8 chỉ hơn W32/B10 khoảng 0,03 % với gấp ~2,2 lần thời gian. Vậy **cùng một ngân sách, tăng bề rộng beam hiệu quả hơn tăng số lần khởi động**.\n\nLý do: đường cong điểm theo λ rất phẳng trong [1 380; 1 460] nên các λ khác nhau cho ra lịch trình **tương tự nhau** — multi-start ít đa dạng hoá thật sự. Còn bề rộng beam mua được tầm nhìn xa (hy sinh nhà tốt ở bước này để kết thúc ngày sát 720 phút), đúng thứ mà ablation chỉ ra là đáng giá (bỏ beam: −2,43 %; bỏ multi-start: −0,22 %). Bản cuối vẫn giữ 3 λ vì nó rẻ; nếu lo TLE thì hạ xuống 1 preset W24/B10, chỉ mất 0,22 % điểm và chạy 8,6 ms.",
      tieuChi: [
        "So sánh đúng các cặp cấu hình theo thời gian (W32/B10 một λ so với nhiều λ) và nêu lợi ích biên của từng hướng",
        "Giải thích bằng đường cong λ phẳng: các preset cho lịch trình gần giống nhau nên ít đa dạng hoá",
        "Liên hệ với ablation (beam −2,43 % so với multi-start −0,22 %) hoặc cấu hình dự phòng 1 preset"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "01 §6 · Bài 18 §8–9",
      hoi: "Tài liệu viết: “lời giải đạt 97 % cận trên (τ = 7) và 98,6 % cận τ = 9,5, nên chỉ còn khoảng 3 % dư địa.” Hãy phản biện: các cận này có phải cận trên chứng minh được không? Con số 97 % đáng tin đến đâu, và một người làm tử tế sẽ báo cáo ra sao?",
      goiY: [
        "Bài 18 §9, cạm bẫy 1: cận trên phải đến từ một nới lỏng chứng minh được; một ước lượng thì không.",
        "τ = 9,5 là quãng đường thực tế của chính lời giải; τ = 7 xuất phát từ hằng số BHH (kỳ vọng) cho TSP-Manhattan."
      ],
      mau: "**Chỉ cận τ = 0 là cận trên chứng minh được** (bỏ hẳn chi phí di chuyển, giải cái túi phân số, cộng trần thưởng OT 31 × 48 000): 35 571 464, tức nghiệm đạt 92,5 %. Cận τ = 9,5 lấy τ từ quãng đường thực của chính lời giải — đó là lập luận vòng quanh, không phải nới lỏng, và có thể bị vượt bởi một lịch trình đi ít hơn. Cận τ = 7 dựa vào hằng số BHH (0,92·√(An)), là **kỳ vọng** quãng đường TSP của một tập nhà ngẫu nhiên; trong khi bài này được chọn tập nhà — có thể chọn một tập dày đặc đi ít hơn — nên nó cũng chỉ là ước lượng, không phải trần.\n\nVì vậy “còn ~3 %” là mốc **tham chiếu**, không phải bằng chứng rằng ta cách tối ưu 3 %; dư địa thật nằm đâu đó giữa vài phần trăm và 7,5 %. Báo cáo tử tế: nêu rõ đang dùng cận nào và nó có chứng minh được không; trình bày cả ba mốc; kiểm độ chặt của cận bằng bài nhỏ giải tối ưu được (Bài 18 §8.2); và nếu cần ra quyết định dừng thì dựng một cận chặt hơn mà vẫn chứng minh được cho phần di chuyển.",
      tieuChi: [
        "Chỉ ra cận τ = 0 là cận chứng minh được (nhưng lỏng, 92,5 %), còn τ = 7 và 9,5 là ước lượng",
        "Nêu được lý do τ = 9,5 là lập luận vòng quanh (lấy quãng đường từ chính lời giải)",
        "Kết luận “~3 %” chỉ là mốc tham chiếu và nêu cách báo cáo, kiểm độ chặt trung thực"
      ]
    }
  ],

  lab: [
    {
      id: "gia-mo-lp",
      ten: "Giá mờ λ* riêng cho từng test — nới lỏng LP cái túi",
      doKho: 2,
      ref: "03 §2.3, §10 · 01 §6 · Bài 6, Bài 18",
      de: "Một trong ba hướng chưa khai thác của 2607 (03 §10) là tính **giá mờ λ riêng cho từng test** bằng nới lỏng LP cái túi — O(n), gần như miễn phí. Hãy cài nó.\n\n" +
          "Mỗi nhà có loại máy `m` ∈ {1…6}: giá `p` = 80 000, 140 000, 180 000, 240 000, 250 000, 300 000 (đồng) theo `m`; thời gian vệ sinh `s = 30m + 30` phút. Mỗi nhà tiêu `c = s + τ` phút (`τ` là số phút di chuyển phân bổ cho mỗi nhà). LP: chọn phân số `xᵢ ∈ [0, 1]` để cực đại Σ pᵢxᵢ với Σ cᵢxᵢ ≤ B, B = 22 320 phút.\n\n" +
          "Đầu vào: dòng 1 `n`; dòng 2 `τ B`; rồi `n` dòng, mỗi dòng là loại `m` của một nhà (dữ liệu tránh trường hợp ngân sách vừa khít). Đầu ra: **một dòng `m* λ* LP`** — `m*` là loại biên (loại của món bị cắt dở khi xếp theo p/c giảm dần), `λ* = p/c` của loại biên (điểm/phút), `LP` là tổng giá trị của nghiệm LP (có phần phân số). In `λ*` và `LP` với ít nhất 2 chữ số thập phân; sai số cho phép 0,01.\n\n" +
          "Cộng thêm trần thưởng OT 31 × 48 000 = 1 488 000 vào `LP` là ra cận trên mà tài liệu dùng (trung bình 300 test: 35,57 / 33,94 / 33,39 triệu cho τ = 0 / 7 / 9,5). Sau khi qua, đổi các biến thể τ và quan sát: `λ*` và loại biên thay đổi thế nào? Chỉ τ = 0 là nới lỏng chắc chắn đúng — hãy nhớ điều đó khi đọc cận ở các biến thể còn lại.",
      vanDe: "ca2607-gia-mo-lp",
      tham: { tau: 9.5 },
      bienThe: [
        { ten: "τ = 9,5 (quãng đường thực của lời giải)", tham: { tau: 9.5 } },
        { ten: "τ = 7 (ước lượng TSP-Manhattan)", tham: { tau: 7 } },
        { ten: "τ = 0 (bỏ qua di chuyển — nới lỏng chắc chắn đúng)", tham: { tau: 0 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "n"; rồi "τ B"; rồi n dòng, mỗi dòng là loại máy m (1..6) của một nhà.
// Đầu ra : một dòng "m* λ* LP".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], tau = t[1], B = t[2];
const P = [0, 80000, 140000, 180000, 240000, 250000, 300000];
const cnt = [0, 0, 0, 0, 0, 0, 0];
for (let i = 0; i < n; i++) cnt[t[3 + i]]++;

let bien = 0, lam = 0, val = 0;
// TODO: chi phí một nhà loại m là c = 30m + 30 + tau. Xếp 6 loại theo p/c giảm dần,
//       lấy trọn từng loại tới khi loại kế tiếp không vừa; loại đó là loại biên.

print(bien + " " + lam.toFixed(4) + " " + val.toFixed(2));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    double tau, B;
    scanf("%d", &n);
    scanf("%lf %lf", &tau, &B);
    const double P[7] = {0, 80000, 140000, 180000, 240000, 250000, 300000};
    int cnt[7] = {0};
    for (int i = 0; i < n; i++) { int m; scanf("%d", &m); cnt[m]++; }

    int bien = 0;
    double lam = 0, val = 0;
    // TODO: chi phí một nhà loại m là c = 30m + 30 + tau. Xếp 6 loại theo p/c giảm dần,
    //       lấy trọn từng loại tới khi loại kế tiếp không vừa; loại đó là loại biên.

    printf("%d %.4f %.2f\n", bien, lam, val);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], tau = t[1], B = t[2];
const P = [0, 80000, 140000, 180000, 240000, 250000, 300000];
const cnt = [0, 0, 0, 0, 0, 0, 0];
for (let i = 0; i < n; i++) cnt[t[3 + i]]++;

const chiPhi = (m) => 30 * m + 30 + tau;
const loai = [1, 2, 3, 4, 5, 6].sort((a, b) => P[b] / chiPhi(b) - P[a] / chiPhi(a));   // tỉ số p/c giảm dần
let con = B, val = 0, bien = 0, lam = 0;
for (const m of loai) {
  const c = chiPhi(m);
  if (cnt[m] * c <= con) { con -= cnt[m] * c; val += cnt[m] * P[m]; continue; }        // lấy trọn cả loại
  const nguyen = Math.floor(con / c);                                                    // loại biên: nhà nguyên + phần cắt dở
  val += nguyen * P[m] + (con - nguyen * c) / c * P[m];
  bien = m; lam = P[m] / c;
  break;
}
print(bien + " " + lam.toFixed(4) + " " + val.toFixed(2));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    double tau, B;
    scanf("%d", &n);
    scanf("%lf %lf", &tau, &B);
    const double P[7] = {0, 80000, 140000, 180000, 240000, 250000, 300000};
    int cnt[7] = {0};
    for (int i = 0; i < n; i++) { int m; scanf("%d", &m); cnt[m]++; }

    auto chiPhi = [&](int m) { return 30.0 * m + 30.0 + tau; };
    int loai[6] = {1, 2, 3, 4, 5, 6};
    sort(loai, loai + 6, [&](int a, int b) { return P[a] / chiPhi(a) > P[b] / chiPhi(b); });   // p/c giảm dần

    double con = B, val = 0, lam = 0;
    int bien = 0;
    for (int q = 0; q < 6; q++) {
        int m = loai[q];
        double c = chiPhi(m);
        if (cnt[m] * c <= con) { con -= cnt[m] * c; val += cnt[m] * P[m]; continue; }    // lấy trọn cả loại
        double nguyen = floor(con / c);                                                    // loại biên: nhà nguyên + phần cắt dở
        val += nguyen * P[m] + (con - nguyen * c) / c * P[m];
        bien = m; lam = P[m] / c;
        break;
    }
    printf("%d %.4f %.2f\n", bien, lam, val);
    return 0;
}
`
      },
      goiY: [
        "Chi phí một nhà loại m là c = 30m + 30 + τ. Chỉ cần đếm số nhà mỗi loại và xếp 6 loại theo p/c giảm dần — không cần sắp từng nhà.",
        "Lấy trọn từng loại cho tới khi loại kế tiếp không vừa; ở loại đó lấy ⌊còn lại / c⌋ nhà nguyên, rồi phần phân số (còn lại − nguyên·c) / c của nhà kế tiếp.",
        "λ* = p/c của loại biên. Với τ = 9,5 và ~49 nhà mỗi loại, loại biên điển hình là loại 6 (λ* ≈ 1 367) — nhưng có test rơi vào loại 3 hay 5, vì số nhà mỗi loại dao động."
      ]
    }
  ]
});
