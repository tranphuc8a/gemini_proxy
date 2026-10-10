/* Thực hành — Bài 22: Xây solver qua 7 phiên bản (đồ án chính của khoá). */
(function () {
  "use strict";

  /* ================= "Nhật ký thực nghiệm": đọc bảng điểm các phiên bản và bảng ablation (§1.2, §1.4, §8) ================= */
  var THAT = {                                    /* bảng thật của Bài 22: §1.1 và §8.1 */
    v: [30714270, 31718184, 31691446, 32690097, 32844376, 32915840, 32915840],
    abl: [31900896, 32114975, 32116796, 32768866, 32844376, 32883559, 32910944]
  };

  function nhatKy(inst) {
    var v = inst.v, V = v.length, full = v[V - 1], i;
    var dBuoc = [], dTichLuy = [], tongSoHoc = 0, dauAm = 0;
    for (i = 1; i < V; i++) {
      var b = (v[i] / v[i - 1] - 1) * 100;
      dBuoc.push(b); tongSoHoc += b; dTichLuy.push((v[i] / v[0] - 1) * 100);
      if (!dauAm && b < 0) dauAm = i + 1;                                         /* phiên bản đầu tiên có Δ bước < 0 (đánh số từ 1) */
    }
    var mat = [], tongMat = 0, nXoa = 0;
    for (i = 0; i < inst.abl.length; i++) {
      var m = (full - inst.abl[i]) / full * 100;
      mat.push(m); tongMat += full - inst.abl[i]; if (m < 0.05) nXoa++;
    }
    var tiSo = tongMat / (full - v[0]);
    return [dBuoc, dTichLuy, tongSoHoc, dauAm, mat, tiSo, tiSo > 1 ? 1 : 0, nXoa];
  }

  TH.vande.dangKy("b22-nhat-ky", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      if (tham.that) return { v: THAT.v.slice(), abl: THAT.abl.slice() };
      var r = TH.tienIch.rng(seed), v = [Math.round(3e7 * (0.95 + 0.1 * r()))], i;
      var tang = [
        0.02 + 0.02 * r(),                                                          /* v2: thêm một thứ rẻ mà lợi lớn */
        r() < 0.75 ? -(0.0001 + 0.003 * r()) : 0.0005 + 0.002 * r(),               /* v3: hay đo ra âm khi thiếu bạn đồng hành */
        0.02 + 0.02 * r(),                                                          /* v4: thành phần "mở khoá" */
        r() < 0.15 ? -(0.0005 + 0.002 * r()) : 0.002 + 0.006 * r(),                /* v5 */
        0.001 + 0.003 * r(),                                                        /* v6 */
        0                                                                           /* v7: chốt an toàn, điểm không đổi */
      ];
      for (i = 0; i < tang.length; i++) v.push(Math.round(v[v.length - 1] * (1 + tang[i])));
      var full = v[v.length - 1], co = [3.08, 2.43, 2.43, 0.45, 0.22, 0.10, 0.01], s = 0.6 + 0.8 * r(), abl = [];
      for (i = 0; i < co.length; i++) {
        var d = co[i] * s * (0.7 + 0.6 * r());
        if (i === 6 && r() < 0.25) d = 0.05 + 0.1 * r();                            /* thỉnh thoảng cả thành phần cuối cũng đáng giữ */
        abl.push(Math.round(full * (1 - d / 100)));
      }
      return { v: v, abl: abl };
    },
    viet: function (inst) { return inst.v.length + "\n" + inst.v.join(" ") + "\n" + inst.abl.length + "\n" + inst.abl.join(" ") + "\n"; },
    giai: nhatKy,
    saiSo: 0.0051,
    dinhDang: {
      vao: "Dòng 1: `V`. Dòng 2: `V` số nguyên — điểm các phiên bản v1…vV (vV là bản đầy đủ). Dòng 3: `A`. Dòng 4: `A` số nguyên — điểm của bản đầy đủ khi **bỏ** từng thành phần (đo trên bản hoàn chỉnh).",
      ra: "Theo thứ tự (cách nhau khoảng trắng, phần trăm in ít nhất 2 chữ số thập phân): `V−1` số Δ bước (%); `V−1` số Δ tích luỹ (%); tổng số học các Δ bước (%); số thứ tự phiên bản đầu tiên có Δ bước âm (0 nếu không có); `A` số “mất bao nhiêu %” khi bỏ từng thành phần; `tiSo`; cờ 0/1; số thành phần nên xoá."
    }
  }));

  TH.dangKy({
    id: "bai-22-bay-phien-ban",

    tomTat: [
      "Phát triển gia tăng có đo: mỗi phiên bản **đúng một thay đổi và đúng một lần đo**. Bảng bảy phiên bản của đồ án: 30 714 270 → 31 718 184 (+3,27 %, dùng ngày thứ 31) → 31 691 446 (−0,08 %) → 32 690 097 (+3,15 %, beam) → 32 844 376 → 32 915 840: tổng +7,17 %, cận trên 33 943 173.",
      "**Δ bước** (so với phiên bản liền trước) và **Δ tích luỹ** (so với v1) không cộng được với nhau: 3,27 − 0,08 + 3,15 + 0,47 + 0,22 = 7,03 ≠ 7,17 vì phần trăm chồng lên nhau (1,0327 × 0,9992 × 1,0315 × … ≈ 1,0717). Khi báo cáo, ghi cả điểm tuyệt đối.",
      "Một thành phần có thể đo ra ≈ 0 hay âm vì **thiếu bạn đồng hành** (tính bổ trợ): λ + phạt thời gian chết đo −0,08 % ở v3 vì greedy không có khả năng hành động theo mục tiêu ấy; khi có beam search (v4) thì bỏ phạt mất 2,43 %. Đừng vội xoá; phán quyết cuối thuộc ablation trên **bản hoàn chỉnh**.",
      "Thất bại thật phải ghi chép: λ làm **ngưỡng cứng** (không có số hạng −λw) làm điểm tụt 48 % (74,8 nhà thay vì ~158) vì F = Σ(p − λc) giảm khi thêm nhà có p < λc nên beam dừng ngày sau 2–3 nhà. Có thời gian dư thì luôn nhận ứng viên tốt nhất.",
      "Beam theo ngày hạ thời gian chết từ 834 xuống 235 phút (+3,15 %); di chuyển rỗng cuối ngày làm quãng đường tăng (1 516 → 1 538) mà điểm vẫn tăng 0,47 %. **Chỉ tiêu phụ** có thể phản tác dụng: 2-opt rút quãng đường 22 % nhưng điểm giảm 6,4 %. Luôn đo bằng hàm mục tiêu thật.",
      "Bề rộng beam hiệu quả hơn đa khởi động: 1 preset W = 48 đạt 32 906 374 trong 22,4 ms, gần bằng 3 preset W = 24 (32 915 840, 27,4 ms).",
      "Ablation bản cuối: ngày 31 −3,08 %, beam −2,43 %, phạt −2,43 %, di chuyển chết −0,45 %, đa khởi động −0,22 %, ρ −0,10 %, σ −0,01 %. Cộng lại 8,72 % > 7,17 %: các dòng **không cộng được** vì beam và phạt bổ trợ nhau (cùng gánh việc lấp đầy ngày). Xoá thành phần < 0,05 % rồi chạy lại ablation vì chúng che khuất nhau (tailFill che mất một nửa giá trị của phạt: −1,33 % → −2,43 %).",
      "Chốt an toàn: violations = 0 trên 1 000 test × 5 họ seed; 27,4 ms TB / 37,8 ms test chậm nhất so với giới hạn 100 ms (hệ số ~2,6×); không #include; cờ USE_31_DAYS để tắt khai thác lệch một; cấu hình dự phòng chuyển bằng một dòng."
    ],

    trac: [
      {
        id: "q1", loai: "so", doKho: 1, ref: "§1.2", donVi: "(%)",
        hoi: "Bảng bảy phiên bản có v4 = 32 690 097 và v5 = 32 844 376 (điểm TB trên 300 test). Δ bước của v5 — hơn phiên bản ngay trước bao nhiêu phần trăm? Làm tròn hai chữ số thập phân.",
        dapAn: 0.47, saiSo: 0.01,
        giaiThich: "Δ bước = (32 844 376 − 32 690 097) / 32 690 097 = 154 279 / 32 690 097 = 0,00472 ≈ +0,47 %. Đó là điểm của “di chuyển chết cuối ngày”. Nếu bạn chia cho v1 (30 714 270) thì được 0,50 % — đó không còn là Δ bước."
      },
      {
        id: "q2", loai: "so", doKho: 1, ref: "§1.2", donVi: "(%)",
        hoi: "Cũng bảng đó có v1 = 30 714 270 và v5 = 32 844 376. Δ tích luỹ của v5 — hơn v1 bao nhiêu phần trăm? Làm tròn hai chữ số thập phân.",
        dapAn: 6.94, saiSo: 0.02,
        giaiThich: "Δ tích luỹ = (32 844 376 − 30 714 270) / 30 714 270 = 2 130 106 / 30 714 270 = 0,06935 ≈ +6,94 %. Cơ sở luôn là v1, khác với Δ bước (cơ sở là phiên bản liền trước)."
      },
      {
        id: "q3", loai: "mot", doKho: 2, ref: "§1.2",
        hoi: "Cộng các Δ bước (+3,27 − 0,08 + 3,15 + 0,47 + 0,22) được 7,03 %, nhưng Δ tích luỹ của v6 là +7,17 %. Vì sao hai con số lệch nhau?",
        chon: [
          "Do lỗi làm tròn trong bảng",
          "Mỗi Δ bước là phần trăm của một cơ sở khác nhau nên các hệ số nhân lên chứ không cộng: 1,0327 × 0,9992 × 1,0315 × 1,0047 × 1,0022 ≈ 1,0717",
          "Bảng có số liệu sai ở v3 nên phải đo lại",
          "Δ tích luỹ tính nhầm trên cơ sở v7"
        ],
        dung: 1,
        giaiThich: "Phần trăm chồng nhau: tăng 3 % rồi tăng 3 % là 6,09 %, không phải 6 %. Tích các hệ số cho 1,0717 đúng bằng +7,17 %. Không có lỗi làm tròn hay số sai (v3 −0,08 % là thật), và v7 cùng điểm với v6 nên đổi cơ sở sang v7 cũng không làm lệch. Vì vậy khi báo cáo hãy ghi cả điểm tuyệt đối."
      },
      {
        id: "q4", loai: "mot", doKho: 2, ref: "§1.3, §2, §4.3",
        hoi: "Bạn thêm giá mờ λ và số hạng phạt thời gian chết vào greedy; điểm đo ra −0,08 % (trong nhiễu). Bài 20 §8.2 nói “không cải thiện thì hoàn tác ngay”. Bạn nên làm gì?",
        chon: [
          "Hoàn tác ngay theo Bài 20 §8.2",
          "Xoá vĩnh viễn và không bao giờ thử lại",
          "Tăng λ gấp đôi cho tới khi điểm dương",
          "Giữ lại, tự hỏi nó còn thiếu gì để phát huy và ghi nhật ký là đang chờ; phán quyết cuối thuộc ablation trên bản hoàn chỉnh"
        ],
        dung: 3,
        giaiThich: "Hoàn tác ngay chỉ đúng khi thành phần ĐÃ đủ khả năng phát huy mà vẫn không cải thiện. Ở đây λ và phạt chỉ là ngôn ngữ để diễn đạt mục tiêu, còn greedy không có khả năng hành động theo nó (không thể hy sinh bước này để lấp đầy ngày ở bước sau). Khi thêm beam (v4), bỏ số hạng phạt mất 2,43 %. Tăng λ tuỳ tiện chỉ là chỉnh số khi thiếu cơ chế."
      },
      {
        id: "q5", loai: "mot", doKho: 3, ref: "§4.4",
        hoi: "Một phiên bản dùng λ nhưng KHÔNG có số hạng phạt thời gian chết làm điểm tụt 48 % (chỉ dọn 74,8 nhà thay vì ~158). Cơ chế nào đúng?",
        chon: [
          "Hàm mục tiêu của ngày là Σ(p − λc) giảm khi thêm nhà có p < λc, nên beam chọn trạng thái dừng ngày sau 2–3 nhà và bỏ phí hàng trăm phút",
          "Beam hết bộ nhớ nên cắt ngày giữa chừng",
          "Mã tính nhầm thưởng OT làm điểm thấp",
          "λ quá nhỏ khiến mọi nhà trông giống nhau nên beam chọn bừa"
        ],
        dung: 0,
        giaiThich: "Không có −λ·w, thêm một nhà có giá trị ròng âm làm F giảm; beam giữ trạng thái có F lớn nhất nên dừng sớm. Đó là cạm bẫy “áp λ như ngưỡng cứng khi ngân sách vẫn còn” (Bài 6, cạm bẫy 4); số hạng phạt −λw sinh ra để sửa. Ba phương án còn lại không có bằng chứng nào trong bài: λ ở đây là 1 420 (không nhỏ), không có chuyện hết bộ nhớ hay tính nhầm OT."
      },
      {
        id: "q6", loai: "nhieu", doKho: 2, ref: "§8.1, §8.3, §8.2",
        hoi: "Những phát biểu nào về ablation trong bài là ĐÚNG?",
        chon: [
          "Ablation phải chạy trên bản hoàn chỉnh, không phải trên bản dở dang",
          "Các dòng của bảng ablation không cộng được với nhau",
          "Sau mỗi lần xoá một thành phần phải chạy lại ablation vì các thành phần che khuất lẫn nhau",
          "Tổng các dòng ablation phải bằng đúng tổng cải thiện của cả đồ án",
          "Đo lúc vừa thêm thành phần (ví dụ ở v3) là đủ để quyết định xoá"
        ],
        dung: [0, 1, 2],
        giaiThich: "Ablation trả lời “bỏ mình mày ra khỏi bản hoàn chỉnh thì tụt bao nhiêu”: phải làm trên bản cuối, các dòng không cộng được (8,72 % > 7,17 %), và phải chạy lại sau mỗi lần xoá (xoá tailFill đổi ablation của phạt thời gian chết từ −1,33 % thành −2,43 %). Tổng không bằng tổng cải thiện, và phép đo lúc vừa thêm có thể nói dối (v3 đo −0,08 % nhưng sau đó đáng 2,43 %)."
      },
      {
        id: "q7", loai: "mot", doKho: 3, ref: "§1.4, §8.3",
        hoi: "Cộng bảy dòng ablation được 8,72 % (so với bản đầy đủ), nhưng cả đồ án chỉ cải thiện 7,17 % so với v1. Tính bằng điểm tuyệt đối, các thành phần mất tổng 2 870 468 trong khi cải thiện thật là 2 201 570. Giải thích đúng?",
        chon: [
          "Bảng tính sai: đồ án thật sự cải thiện 8,72 %",
          "Chỉ vì hai phần trăm dùng cơ sở khác nhau; đổi sang cùng cơ sở thì khớp",
          "Beam search và số hạng phạt thời gian chết bổ trợ nhau: bỏ riêng cái nào cũng mất trọn phần lợi ích chung (2,43 % mỗi cái), nên phần chung bị đếm lặp khi cộng các dòng",
          "Do lỗi làm tròn tích luỹ qua bảy dòng"
        ],
        dung: 2,
        giaiThich: "Hai thành phần cùng phục vụ một mục tiêu — lấp đầy ngày cho sát 720 phút — và chỉ phát huy khi đi cùng nhau, nên mỗi dòng ablation của chúng đều tính trọn phần chung; cộng lại là đếm hai lần. Cơ sở khác nhau (so với bản đầy đủ hay với v1) chỉ lệch chút ít: tính bằng điểm tuyệt đối tổng vẫn vượt 30 % (2 870 468 / 2 201 570 ≈ 1,30), nên đó không phải lời giải thích. Bảng không sai và 7 số hạng đủ nhỏ để làm tròn không tạo ra chênh 1,5 điểm phần trăm."
      },
      {
        id: "q8", loai: "nhieu", doKho: 3, ref: "§6.3, §8.4, §9.3",
        hoi: "Những quan sát nào trong bài cho thấy “chỉ tiêu phụ” (quãng đường di chuyển) KHÔNG phải mục tiêu cần tối ưu?",
        chon: [
          "Thêm 2-opt rút quãng đường 22 % nhưng điểm giảm 6,4 % (preset 1)",
          "Dùng khung ngày thứ 31 thêm 720 phút ngân sách và điểm tăng 3,27 %",
          "Di chuyển chết cuối ngày làm quãng đường tăng từ 1 516 lên 1 538 phút nhưng điểm tăng 0,47 %",
          "Xoá tailFill không làm điểm thay đổi (+0,00 %)",
          "Beam W = 24 hạ thời gian chết từ 834 xuống 235 phút"
        ],
        dung: [0, 2],
        giaiThich: "Hai chiều ngược nhau đều chứng minh quãng đường chỉ là chỉ tiêu phụ: giảm nó 22 % làm điểm tụt 6,4 %, tăng nó làm điểm tăng 0,47 %. Ngày thứ 31, tailFill và beam không liên quan đến quãng đường: chúng nói về ngân sách, thành phần thừa và thời gian chết. Bài học: luôn đo bằng hàm mục tiêu thật."
      },
      {
        id: "q9", loai: "mot", doKho: 2, ref: "§7.1",
        hoi: "Bảng đánh đổi: 1 preset W = 48 đạt 32 906 374 trong 22,4 ms; 3 preset W = 24 đạt 32 915 840 trong 27,4 ms. Kết luận hợp lý nhất là gì?",
        chon: [
          "Đa khởi động luôn tốt hơn vì điểm cao hơn",
          "Hai cấu hình như nhau nên chọn ngẫu nhiên",
          "Bề rộng beam hiệu quả hơn đa khởi động: gần bằng điểm mà ít thời gian hơn",
          "Không so sánh được vì thời gian khác nhau"
        ],
        dung: 2,
        giaiThich: "Chênh điểm chỉ 9 466 (0,03 %) trong khi 1 preset W = 48 nhanh hơn ~18 %, nên bề rộng beam là cách rẻ hơn để mua điểm (khớp kết luận Bài 16 §7.1(c)). “Đa khởi động luôn tốt hơn” bỏ qua giá phải trả; “so sánh được” vì ta đã có cả điểm lẫn thời gian."
      },
      {
        id: "q10", loai: "so", doKho: 2, ref: "§8.5", donVi: "(lần)",
        hoi: "Cấu hình cuối chạy 27,4 ms TB và 37,8 ms ở test chậm nhất; giới hạn là 100 ms. Hệ số an toàn thời gian (giới hạn chia cho test chậm nhất) là mấy lần? Làm tròn một chữ số thập phân.",
        dapAn: 2.6, saiSo: 0.05,
        giaiThich: "100 / 37,8 = 2,65 ≈ 2,6 (bài ghi 2,6×). Chia cho 27,4 ms trung bình sẽ cho 3,65 — lạc quan giả tạo, vì phải bảo vệ test chậm nhất chứ không phải test trung bình."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "§4, §10",
        hoi: "Viết dòng nhật ký thực nghiệm cho bước v2 → v3 (giá mờ λ + phạt thời gian chết) theo khuôn: ý tưởng · thay đổi · kết quả (có số) · giải thích · quyết định.",
        goiY: ["v2 = 31 718 184, v3 = 31 691 446; thời gian chết 863 → 834 phút.", "Hỏi: thành phần này còn thiếu gì để phát huy?"],
        mau: "- **Ý tưởng:** biểu diễn “một phút đáng bao nhiêu” bằng giá mờ λ ≈ 1 420 và phạt thời gian chết.\n- **Thay đổi:** chỉ số tỉ số → giá trị ròng p + OT − λc, thêm số hạng −λ·w vào mục tiêu của ngày (đúng một thay đổi).\n- **Kết quả:** 31 718 184 → 31 691 446, **−0,08 %** (trong nhiễu); thời gian chết 863 → 834 phút.\n- **Giải thích:** greedy chọn một nhà tại một thời điểm, không thể “hi sinh bước này để lấp đầy ngày ở bước sau”, nên không hành động được theo mục tiêu mới — đây là **tính bổ trợ**, không phải thất bại.\n- **Quyết định:** giữ lại, ghi “đang chờ beam search”. Phán quyết cuối thuộc ablation trên bản hoàn chỉnh (sau này: bỏ phạt mất 2,43 %).",
        tieuChi: ["Có số đo trước và sau đúng (31 718 184 → 31 691 446, −0,08 %)", "Giải thích bằng tính bổ trợ: greedy chưa có khả năng hành động theo mục tiêu mới", "Quyết định giữ lại kèm ghi chú “đang chờ” thay vì hoàn tác", "Nhắc phán quyết cuối là ablation trên bản hoàn chỉnh"]
      },
      {
        id: "l2", doKho: 3, ref: "§1.4, §8.3",
        hoi: "Giải thích vì sao tổng các dòng ablation (8,72 %) lớn hơn tổng cải thiện của cả đồ án (7,17 %), và nêu cách báo cáo đúng.",
        goiY: ["Nghĩ tới hai thành phần cùng −2,43 %.", "Hai con số phần trăm có cùng cơ sở không? Đổi sang điểm tuyệt đối thì sao?"],
        mau: "Mỗi dòng ablation hỏi: “bỏ **mình mày** ra khỏi bản hoàn chỉnh thì tụt bao nhiêu?”. Beam search và số hạng phạt thời gian chết cùng phục vụ một việc — lấp đầy ngày cho sát 720 phút — và chỉ phát huy khi đi cùng nhau, nên bỏ riêng cái nào cũng làm mất trọn phần lợi ích chung (2,43 % mỗi cái): phần chung được đếm hai lần khi cộng các dòng.\n\nHai phần trăm cũng khác cơ sở (8,72 % tính trên bản đầy đủ, 7,17 % tính trên v1). Đổi sang điểm tuyệt đối cho kết luận y nguyên: các thành phần mất tổng 2 870 468 > 2 201 570 cải thiện thật (tỉ số ≈ 1,30).\n\n**Cách báo cáo:** mỗi dòng ablation trả lời tốt câu “có đáng giữ nó không”; nhưng **các dòng không cộng được**, và báo cáo nào cộng chúng để tuyên bố tổng cải thiện là sai. Ghi cả điểm tuyệt đối, và dùng Δ tích luỹ (so với v1) cho tổng cải thiện.",
        tieuChi: ["Chỉ ra cơ chế: thành phần bổ trợ (beam + phạt) cùng gánh một mục tiêu nên phần chung bị đếm lặp", "Nhận ra hoặc xử lý khác biệt cơ sở phần trăm, kiểm lại bằng điểm tuyệt đối (2 870 468 so với 2 201 570)", "Nêu quy tắc: dòng ablation không cộng được; báo cáo ghi điểm tuyệt đối và dùng Δ tích luỹ cho tổng"]
      },
      {
        id: "l3", doKho: 3, ref: "§4.4",
        hoi: "Giải thích vì sao dùng λ mà không có số hạng phạt thời gian chết làm điểm tụt 48 %, số hạng −λw sửa điều đó thế nào, và bài học tổng quát là gì.",
        goiY: ["Viết hàm mục tiêu của ngày khi không có −λw, rồi xem dấu của p_i − λc_i.", "Beam giữ trạng thái có giá trị lớn nhất — trạng thái dừng sớm có giá trị thế nào?"],
        mau: "Không có −λ·w, mục tiêu của ngày là F = Σ(p_i − λ·c_i). Thêm một nhà có p_i < λ·c_i làm F **giảm**; chẳng hạn với λ = 1 420 và ~9,5 phút di chuyển mỗi nhà, nhà loại 3 có p = 180 000 nhưng λ·c = 1 420 × 129,5 = 183 890 ⇒ giá trị ròng âm. Beam giữ trạng thái có F lớn nhất, nên **dừng ngày sau 2–3 nhà** và bỏ phí hàng trăm phút (74,8 nhà thay vì ~158 ⇒ −48 %).\n\nSố hạng −λ·w với w là số phút chết không tận dụng được đổi chiều lực: bỏ phí một phút bị phạt λ, nên lấp thêm nhà luôn có lợi hơn dừng sớm. **Bài học:** khi tài nguyên còn dư và lợi ích luôn dương, hãy luôn nhận ứng viên tốt nhất, đừng để λ chặn lại như một ngưỡng cứng (cạm bẫy 4 của Bài 6).",
        tieuChi: ["Viết được F = Σ(p − λc) và chỉ ra nó giảm khi thêm nhà có p < λc", "Giải thích beam chọn trạng thái có F lớn nhất nên dừng ngày sớm", "Nêu vai trò của −λw: biến phút bỏ phí thành thiệt hại để lấp đầy ngày có lợi", "Nêu bài học: không dùng λ làm ngưỡng cứng khi ngân sách còn dư"]
      },
      {
        id: "l4", doKho: 2, ref: "§8.2, §8.5, §10",
        hoi: "Ablation cho thấy tailFill và cửa sổ sửa chữa biên ngày đóng góp +0,00 % nhưng chiếm ~30 % thời gian. Sau khi xoá chúng, ablation của “phạt thời gian chết” đổi từ −1,33 % thành −2,43 %. Giải thích hiện tượng, nêu quy trình dọn thành phần thừa và ít nhất ba mục của checklist chốt an toàn.",
        goiY: ["tailFill làm việc gì với thời gian dư cuối lịch?", "Thành phần che khuất nhau thì con số ablation nói gì?"],
        mau: "**Che khuất.** tailFill nhồi thêm nhà vào thời gian dư cuối lịch, tức đang gánh một phần việc “lấp đầy ngày” vốn là việc của số hạng phạt; có nó, bỏ phạt chỉ tụt −1,33 %. Xoá tailFill thì phạt gánh trọn việc nên con số thật là −2,43 %.\n\n**Quy trình:** xoá mọi thành phần đóng góp < 0,05 % (ở đây tailFill và cửa sổ sửa chữa, mã ngắn đi 60 dòng), rồi **chạy lại ablation** — vì xoá một thứ làm đổi con số của thứ khác — lặp tới khi ổn định.\n\n**Checklist chốt an toàn (chọn ba):** violations = 0 trên 1 000 test × 5 họ seed; thời gian 27,4 ms TB / 37,8 ms tệ nhất so với 100 ms (hệ số ~2,6×); build sạch cảnh báo; không có #include; mảng tĩnh; mảng hành động dư; lớp bảo vệ cuối (đếm số lần nextDay, thà dừng sớm hơn mất điểm); cấu hình dự phòng một dòng (8,6 ms); cờ USE_31_DAYS để tắt khai thác lệch một nếu cần.",
        tieuChi: ["Giải thích che khuất: tailFill gánh một phần việc của phạt nên ablation của phạt bị đánh giá thấp", "Nêu quy trình: xoá thành phần < 0,05 % rồi chạy lại ablation", "Nêu ít nhất ba mục đúng của checklist chốt an toàn"]
      }
    ],

    lab: [
      {
        id: "nhat-ky-thuc-nghiem",
        ten: "Nhật ký thực nghiệm: đọc đúng bảng điểm",
        doKho: 2,
        ref: "§1.2–1.4, §8.1–8.3",
        de: "Hai chỗ bất thường trong bảng bảy phiên bản của Bài 22 (v3 làm điểm giảm, và tổng các dòng ablation lớn hơn tổng cải thiện) chỉ lộ ra khi bạn **tự tính** các con số. Hãy viết chương trình “nhật ký” làm việc đó.\n\n" +
            "Đầu vào: `V`, rồi `V` số — điểm của v1…vV (vV là bản đầy đủ); rồi `A`, rồi `A` số — điểm của bản đầy đủ khi **bỏ** từng thành phần (đã đo trên bản hoàn chỉnh, như §8.1).\n\n" +
            "In theo thứ tự:\n\n" +
            "1. **Δ bước** (%) của v2…vV (V − 1 số): (v_i / v_{i−1} − 1) × 100.\n" +
            "2. **Δ tích luỹ** (%) của v2…vV: (v_i / v1 − 1) × 100.\n" +
            "3. **Tổng số học các Δ bước** (%), rồi **số thứ tự** (đánh số từ 1) của phiên bản **đầu tiên** có Δ bước âm — 0 nếu không có.\n" +
            "4. `A` số: mỗi thành phần **mất** bao nhiêu % khi bỏ nó: (vV − điểm khi bỏ) / vV × 100.\n" +
            "5. `tiSo` = Σ (vV − điểm khi bỏ) / (vV − v1) — tính bằng **điểm tuyệt đối** để khỏi lẫn cơ sở phần trăm; rồi cờ `1` nếu `tiSo` > 1 (các dòng ablation “không cộng được”), ngược lại `0`.\n" +
            "6. Số thành phần nên **xoá**: những thành phần mất **< 0,05 %** (quy tắc ở §10).\n\n" +
            "**Mức đạt:** đúng trên mọi test. Hãy thử biến thể *Bảng thật của Bài 22* (khung ngày 31, beam, phạt thời gian chết, di chuyển chết, đa khởi động, ρ, σ) và đối chiếu: tổng Δ bước (7,02 %) so với Δ tích luỹ cuối (7,17 %); tổng ablation (8,72 %) so với 7,17 %. Suy ngẫm: vì sao `tiSo` > 1 mà không có ai tính sai? Điều gì sẽ khiến `tiSo` < 1?",
        vanDe: "b22-nhat-ky",
        bienThe: [
          { ten: "Bảng giả lập (ngẫu nhiên)", tham: {} },
          { ten: "Bảng thật của Bài 22 (§1.1, §8.1)", tham: { that: true } }
        ],
        soTest: 8,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: V; V số (điểm v1..vV); A; A số (điểm khi BỎ từng thành phần khỏi bản đầy đủ vV).
// Đầu ra : (V−1) Δ bước %, (V−1) Δ tích luỹ %, tổng số học Δ bước %, phiên bản đầu tiên có Δ bước âm (0 nếu không),
//          A số "mất %", tiSo, cờ (1 nếu tiSo > 1), số thành phần nên xoá (mất < 0,05 %).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let p = 0;
const V = t[p++];
const v = t.slice(p, p + V); p += V;
const A = t[p++];
const bo = t.slice(p, p + A);
const day = v[V - 1];                       // bản đầy đủ

// TODO 1: dBuoc[i], dTichLuy[i] (%) cho i = 1..V−1; tongSoHoc = Σ dBuoc; dauAm = phiên bản đầu tiên (từ 1) có dBuoc < 0, hoặc 0
// TODO 2: mat[j] (%) = (day − bo[j]) / day · 100 với mỗi thành phần j
// TODO 3: tiSo = Σ (day − bo[j]) / (day − v[0]); co = tiSo > 1 ? 1 : 0; nXoa = số j có mat[j] < 0.05

print("TODO");
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int V, A;
    scanf("%d", &V);
    vector<double> v(V);
    for (int i = 0; i < V; i++) scanf("%lf", &v[i]);
    scanf("%d", &A);
    vector<double> bo(A);
    for (int i = 0; i < A; i++) scanf("%lf", &bo[i]);
    double day = v[V - 1];                    // bản đầy đủ

    // TODO 1: dBuoc[i], dTichLuy[i] (%) cho i = 1..V-1; tongSoHoc = tổng dBuoc; dauAm = phiên bản đầu tiên (từ 1) có dBuoc < 0, hoặc 0
    // TODO 2: mat[j] (%) = (day - bo[j]) / day * 100 với mỗi thành phần j
    // TODO 3: tiSo = tổng (day - bo[j]) / (day - v[0]); co = tiSo > 1 ? 1 : 0; nXoa = số j có mat[j] < 0.05
    (void)day;

    printf("TODO\n");
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let p = 0;
const V = t[p++];
const v = t.slice(p, p + V); p += V;
const A = t[p++];
const bo = t.slice(p, p + A);
const day = v[V - 1];

const dBuoc = [], dTichLuy = [];
let tongSoHoc = 0, dauAm = 0;
for (let i = 1; i < V; i++) {
  const b = (v[i] / v[i - 1] - 1) * 100;            // so với phiên bản NGAY TRƯỚC
  dBuoc.push(b); tongSoHoc += b;
  dTichLuy.push((v[i] / v[0] - 1) * 100);           // so với v1
  if (dauAm === 0 && b < 0) dauAm = i + 1;          // đánh số phiên bản từ 1
}

const mat = bo.map((d) => (day - d) / day * 100);
let tongMat = 0;
for (const d of bo) tongMat += day - d;
const tiSo = tongMat / (day - v[0]);                // điểm tuyệt đối mất / cải thiện thật
const co = tiSo > 1 ? 1 : 0;
const nXoa = mat.filter((m) => m < 0.05).length;

const f = (x) => x.toFixed(4);
print(dBuoc.map(f).join(" "));
print(dTichLuy.map(f).join(" "));
print(f(tongSoHoc) + " " + dauAm);
print(mat.map(f).join(" "));
print(f(tiSo) + " " + co + " " + nXoa);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int V, A;
    scanf("%d", &V);
    vector<double> v(V);
    for (int i = 0; i < V; i++) scanf("%lf", &v[i]);
    scanf("%d", &A);
    vector<double> bo(A);
    for (int i = 0; i < A; i++) scanf("%lf", &bo[i]);
    double day = v[V - 1];

    vector<double> dBuoc, dTichLuy;
    double tongSoHoc = 0;
    int dauAm = 0;
    for (int i = 1; i < V; i++) {
        double b = (v[i] / v[i - 1] - 1) * 100;          // so với phiên bản NGAY TRƯỚC
        dBuoc.push_back(b); tongSoHoc += b;
        dTichLuy.push_back((v[i] / v[0] - 1) * 100);     // so với v1
        if (dauAm == 0 && b < 0) dauAm = i + 1;          // đánh số phiên bản từ 1
    }
    vector<double> mat;
    double tongMat = 0;
    int nXoa = 0;
    for (int j = 0; j < A; j++) {
        double m = (day - bo[j]) / day * 100;
        mat.push_back(m); tongMat += day - bo[j];
        if (m < 0.05) nXoa++;
    }
    double tiSo = tongMat / (day - v[0]);                // điểm tuyệt đối mất / cải thiện thật
    int co = tiSo > 1 ? 1 : 0;

    for (size_t i = 0; i < dBuoc.size(); i++) printf("%.4f ", dBuoc[i]);
    for (size_t i = 0; i < dTichLuy.size(); i++) printf("%.4f ", dTichLuy[i]);
    printf("%.4f %d\n", tongSoHoc, dauAm);
    for (size_t i = 0; i < mat.size(); i++) printf("%.4f ", mat[i]);
    printf("%.4f %d %d\n", tiSo, co, nXoa);
    return 0;
}
`
        },
        goiY: [
          "Δ bước dùng cơ sở là phiên bản ngay trước (v[i−1]); Δ tích luỹ dùng cơ sở v[0]; “mất %” dùng cơ sở là bản đầy đủ.",
          "Phiên bản đầu tiên có Δ bước âm: nhớ đánh số từ 1 (v1, v2, …), nên phiên bản thứ i (đếm từ 0) mang số i + 1.",
          "`tiSo` cộng các hiệu **tuyệt đối** (day − bo[j]) rồi chia cho (day − v[0]); đừng cộng các phần trăm."
        ]
      },
      {
        id: "xay-dan-ship1",
        ten: "Xây solver qua bốn phiên bản trên P1 — mỗi bước một thay đổi, một lần đo",
        doKho: 3,
        ref: "§1.1, §3–§8, §10",
        de: "Đề thi thật của đồ án (P3) không có sẵn trên trang này, nên lab dựng lại **quy trình** của Bài 22 trên **P1 — ship hàng một ngày** (lưới 100×100, kho (50,50), `n = 120` đơn, ngày 480 phút, không quay về kho, vượt giờ là không hợp lệ). Bốn phiên bản, mỗi phiên bản đúng **một** thay đổi:\n\n" +
            "- **v1** — greedy theo tỉ số `p / (d + s)`, tính lại mỗi bước (bạn đã làm ở Bài 5; khung cài sẵn).\n" +
            "- **v2** — thêm **chèn rẻ nhất**: sau v1, lặp: với mọi đơn chưa dùng và **mọi vị trí** trong tuyến (không chỉ cuối), chọn cặp có `p / (thời gian tăng thêm + 1)` cao nhất mà tuyến vẫn ≤ T, rồi chèn.\n" +
            "- **v3** — thêm **2-opt rồi chèn lại** (leo đồi): đảo một đoạn tuyến nếu làm tuyến **ngắn đi**; sau mỗi vòng, chèn lại để biến thời gian dư ra thành đơn mới; lặp tới khi tiền không tăng thêm.\n" +
            "- **v4** — thêm **LNS**: phá 1–3 đơn ngẫu nhiên khỏi tuyến, chèn lại bằng v2 (chỉ số nhiễu ±20 %), nhận nếu tiền không giảm; cố định **số vòng lặp** (khoảng 300) để kết quả tất định.\n\n" +
            "Hằng `VERSION` ở đầu khung chọn phiên bản được chạy; `log()` in điểm từng bước ra stderr (không bị chấm) — đó là dòng nhật ký của bạn.\n\n" +
            "**Mức đạt (mỗi mức là một ngưỡng):** hợp lệ → bằng v1 (greedy tỉ số) → v2 ≥ 1,008 × v1 → v3 ≥ 1,03 × v1 → v4 đạt ≥ 98 % lời giải LNS tham chiếu. Hợp lệ là *violations = 0*: vượt giờ ở một đơn là không có điểm.\n\n" +
            "Suy ngẫm (đúng tinh thần Bài 22): (a) chạy v3 **chỉ với 2-opt, không chèn lại** — điểm đổi bao nhiêu và vì sao? So với “λ + phạt thời gian chết đo −0,08 % ở v3 của bài”. (b) Xong v4, tắt từng thành phần (LNS, 2-opt, chèn) rồi cộng các lần tụt: có bằng tổng cải thiện không? (c) Đổi sang biến thể *gom cụm*: thứ hạng các phiên bản có đổi không?",
        vanDe: "ship1",
        bienThe: [
          { ten: "Rải đều (n = 120)", tham: { n: 120 } },
          { ten: "Gom cụm (n = 120)", tham: { n: 120, cum: true } },
          { ten: "Ít đơn (n = 60)", tham: { n: 60 } }
        ],
        soTest: 10,
        gioiHanMs: 2000,
        muc: [
          { ten: "v1 — bằng greedy tỉ số (điểm xuất phát)", so: "tiSo", heSo: 1 },
          { ten: "v2 — thêm chèn rẻ nhất: ≥ 1,008 × v1", so: "tiSo", heSo: 1.008 },
          { ten: "v3 — thêm 2-opt rồi chèn lại: ≥ 1,03 × v1", so: "tiSo", heSo: 1.03 },
          { ten: "v4 — thêm LNS: ≥ 98 % lời giải LNS tham chiếu", so: "tot", heSo: 0.98 }
        ],
        khoiDau: {
          js: String.raw`// Đầu vào: "n T", rồi "kx ky" (kho), rồi n dòng "x y p s".   Đầu ra: k, rồi k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]); }

const VERSION = 1;   // 1 greedy · 2 + chèn rẻ nhất · 3 + 2-opt rồi chèn lại · 4 + LNS   (xong bước nào thì tăng một nấc, rồi đo)

const kc = (a, b) => (a < 0 ? Math.abs(x[b] - kx) + Math.abs(y[b] - ky) : Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]));   // a = −1: kho
function thoiGian(seq) { let tg = 0, cur = -1; for (const i of seq) { tg += kc(cur, i) + s[i]; cur = i; } return tg; }
function tien(seq) { let r = 0; for (const i of seq) r += p[i]; return r; }

// v1 — greedy theo tỉ số p / (d + s), tính lại mỗi bước (đã cài sẵn)
function greedyTiSo() {
  const dung = new Array(n).fill(false), seq = [];
  let tg = 0, cur = -1;
  for (;;) {
    let tot = -1, diemTot = -Infinity, phi = 0;
    for (let i = 0; i < n; i++) {
      if (dung[i]) continue;
      const c = kc(cur, i) + s[i];
      if (tg + c > T) continue;
      const diem = p[i] / (c + 1);
      if (diem > diemTot) { diemTot = diem; tot = i; phi = c; }
    }
    if (tot < 0) break;
    dung[tot] = true; seq.push(tot); tg += phi; cur = tot;
  }
  return seq;
}

// v2 — chèn rẻ nhất: mọi đơn chưa dùng × mọi vị trí; nhiễu = null (tất định) hoặc hàm rng() để nhân chỉ số với 0,8…1,2
function chenReNhat(seq0, nhieu) {
  const seq = seq0.slice();
  // TODO: lặp — chọn (đơn i, vị trí pos) có p[i] / (tang + 1) cao nhất mà thoiGian(seq) + tang <= T,
  //       trong đó tang = kc(a, i) + s[i] + kc(i, b) − kc(a, b)   (a = đơn trước vị trí pos, b = đơn sau; không có b thì bỏ hai số hạng cuối)
  return seq;
}

// v3 — 2-opt: đảo seq[i..j] nếu tuyến ngắn đi (tuyến MỞ: đoạn tới cuối tuyến không có cạnh phía sau)
function haiOpt(seq) {
  // TODO
}
function leoDoi(seq0) {
  // TODO: seq = chenReNhat(seq0); lặp: 2-opt trên bản sao; nếu tuyến ngắn đi thì chèn lại; nhận nếu tiền tăng, ngược lại dừng
  return seq0;
}

// v4 — LNS: phá 1–3 đơn rồi chèn lại, nhận nếu tiền không giảm; số vòng lặp cố định
function lns(seq0, vong) {
  const rnd = rng(2026);
  // TODO
  return seq0;
}

let seq = greedyTiSo();
log("v1 greedy:", tien(seq), "tiền,", thoiGian(seq), "phút");
if (VERSION >= 2) { seq = chenReNhat(seq, null); log("v2 chèn:", tien(seq), "tiền,", thoiGian(seq), "phút"); }
if (VERSION >= 3) { seq = leoDoi(seq); log("v3 2-opt + chèn:", tien(seq), "tiền,", thoiGian(seq), "phút"); }
if (VERSION >= 4) { seq = lns(seq, 300); log("v4 LNS:", tien(seq), "tiền,", thoiGian(seq), "phút"); }

print(seq.length);
print(seq.map((i) => i + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

static int n, T, kx, ky;
static vector<int> X, Y, P, S;
static mt19937 gen(2026);

static int kc(int a, int b) { return a < 0 ? abs(X[b] - kx) + abs(Y[b] - ky) : abs(X[a] - X[b]) + abs(Y[a] - Y[b]); }   // a = -1: kho
static int thoiGian(const vector<int>& seq) { int tg = 0, cur = -1; for (int i : seq) { tg += kc(cur, i) + S[i]; cur = i; } return tg; }
static long long tien(const vector<int>& seq) { long long r = 0; for (int i : seq) r += P[i]; return r; }

const int VERSION = 1;   // 1 greedy · 2 + chèn rẻ nhất · 3 + 2-opt rồi chèn lại · 4 + LNS   (xong bước nào thì tăng một nấc, rồi đo)

// v1 — greedy theo tỉ số p / (d + s), tính lại mỗi bước (đã cài sẵn)
static vector<int> greedyTiSo() {
    vector<bool> dung(n, false);
    vector<int> seq;
    int tg = 0, cur = -1;
    for (;;) {
        int tot = -1, phi = 0;
        double diemTot = -1e18;
        for (int i = 0; i < n; i++) {
            if (dung[i]) continue;
            int c = kc(cur, i) + S[i];
            if (tg + c > T) continue;
            double diem = (double)P[i] / (c + 1);
            if (diem > diemTot) { diemTot = diem; tot = i; phi = c; }
        }
        if (tot < 0) break;
        dung[tot] = true; seq.push_back(tot); tg += phi; cur = tot;
    }
    return seq;
}

// v2 — chèn rẻ nhất: mọi đơn chưa dùng × mọi vị trí; nhieu = false (tất định) hoặc true (nhân chỉ số với 0,8…1,2)
static vector<int> chenReNhat(vector<int> seq, bool nhieu) {
    // TODO: lặp — chọn (đơn i, vị trí pos) có P[i] / (tang + 1) cao nhất mà thoiGian(seq) + tang <= T,
    //       tang = kc(a, i) + S[i] + kc(i, b) - kc(a, b)   (a = đơn trước vị trí pos, b = đơn sau; không có b thì bỏ hai số hạng cuối)
    (void)nhieu;
    return seq;
}

// v3 — 2-opt: đảo seq[i..j] nếu tuyến ngắn đi (tuyến MỞ: đoạn tới cuối tuyến không có cạnh phía sau)
static void haiOpt(vector<int>& seq) {
    // TODO
    (void)seq;
}
static vector<int> leoDoi(vector<int> seq0) {
    // TODO: seq = chenReNhat(seq0); lặp: 2-opt trên bản sao; nếu tuyến ngắn đi thì chèn lại; nhận nếu tiền tăng, ngược lại dừng
    return seq0;
}

// v4 — LNS: phá 1–3 đơn rồi chèn lại, nhận nếu tiền không giảm; số vòng lặp cố định
static vector<int> lns(vector<int> seq0, int vong) {
    // TODO (dùng gen: mt19937 đã khởi tạo cố định)
    (void)vong;
    return seq0;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    X.resize(n); Y.resize(n); P.resize(n); S.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &X[i], &Y[i], &P[i], &S[i]);

    vector<int> seq = greedyTiSo();
    fprintf(stderr, "v1 greedy: %lld tien, %d phut\n", tien(seq), thoiGian(seq));
    if (VERSION >= 2) { seq = chenReNhat(seq, false); fprintf(stderr, "v2 chen: %lld\n", tien(seq)); }
    if (VERSION >= 3) { seq = leoDoi(seq); fprintf(stderr, "v3 2-opt + chen: %lld\n", tien(seq)); }
    if (VERSION >= 4) { seq = lns(seq, 300); fprintf(stderr, "v4 LNS: %lld\n", tien(seq)); }

    printf("%d\n", (int)seq.size());
    for (size_t i = 0; i < seq.size(); i++) printf("%d%c", seq[i] + 1, i + 1 < seq.size() ? ' ' : '\n');
    if (seq.empty()) printf("\n");
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) { x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]); }

const VERSION = 4;   // 1 greedy · 2 + chèn rẻ nhất · 3 + 2-opt rồi chèn lại · 4 + LNS

const kc = (a, b) => (a < 0 ? Math.abs(x[b] - kx) + Math.abs(y[b] - ky) : Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]));   // a = −1: kho
function thoiGian(seq) { let tg = 0, cur = -1; for (const i of seq) { tg += kc(cur, i) + s[i]; cur = i; } return tg; }
function tien(seq) { let r = 0; for (const i of seq) r += p[i]; return r; }

// v1 — greedy theo tỉ số, tính lại chỉ số mỗi bước
function greedyTiSo() {
  const dung = new Array(n).fill(false), seq = [];
  let tg = 0, cur = -1;
  for (;;) {
    let tot = -1, diemTot = -Infinity, phi = 0;
    for (let i = 0; i < n; i++) {
      if (dung[i]) continue;
      const c = kc(cur, i) + s[i];
      if (tg + c > T) continue;
      const diem = p[i] / (c + 1);
      if (diem > diemTot) { diemTot = diem; tot = i; phi = c; }
    }
    if (tot < 0) break;
    dung[tot] = true; seq.push(tot); tg += phi; cur = tot;
  }
  return seq;
}

// v2 — chèn rẻ nhất: mọi đơn chưa dùng × mọi vị trí, theo p / (thời gian tăng thêm + 1)
function chenReNhat(seq0, nhieu) {
  const seq = seq0.slice();
  let tg = thoiGian(seq);
  const dung = new Array(n).fill(false);
  for (const i of seq) dung[i] = true;
  for (;;) {
    let tot = -1, viTri = -1, diemTot = -Infinity, them = 0;
    for (let i = 0; i < n; i++) {
      if (dung[i]) continue;
      for (let pos = 0; pos <= seq.length; pos++) {
        const a = pos === 0 ? -1 : seq[pos - 1];
        let tang = kc(a, i) + s[i];
        if (pos < seq.length) tang += kc(i, seq[pos]) - kc(a, seq[pos]);   // đơn kế tiếp giờ đi từ i thay vì từ a
        if (tg + tang > T) continue;
        const diem = p[i] / (tang + 1) * (nhieu ? 0.8 + 0.4 * nhieu() : 1);
        if (diem > diemTot) { diemTot = diem; tot = i; viTri = pos; them = tang; }
      }
    }
    if (tot < 0) break;
    seq.splice(viTri, 0, tot); dung[tot] = true; tg += them;
  }
  return seq;
}

// v3 — 2-opt trên tuyến mở: đảo seq[i..j] nếu tuyến ngắn đi
function haiOpt(seq) {
  let doi = true;
  while (doi) {
    doi = false;
    for (let i = 0; i < seq.length - 1; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const a = i === 0 ? -1 : seq[i - 1], b = seq[i], c = seq[j], d = j + 1 < seq.length ? seq[j + 1] : -2;
        const cu = kc(a, b) + (d === -2 ? 0 : kc(c, d));
        const moi = kc(a, c) + (d === -2 ? 0 : kc(b, d));
        if (moi < cu) {
          for (let l = i, h = j; l < h; l++, h--) { const tam = seq[l]; seq[l] = seq[h]; seq[h] = tam; }
          doi = true;
        }
      }
    }
  }
}
function leoDoi(seq0) {
  let seq = chenReNhat(seq0, null);
  for (;;) {
    const tg0 = thoiGian(seq), thu = seq.slice();
    haiOpt(thu);
    if (thoiGian(thu) >= tg0) break;          // 2-opt không rút ngắn được nữa
    const moi = chenReNhat(thu, null);        // biến thời gian dư ra thành đơn mới
    if (tien(moi) > tien(seq)) seq = moi; else break;
  }
  return seq;
}

// v4 — LNS: phá 1–3 đơn, chèn lại có nhiễu, nhận nếu tiền không giảm; số vòng cố định ⇒ kết quả tất định
function lns(seq0, vong) {
  const rnd = rng(2026);
  let cur = seq0, ct = tien(cur), best = cur, bt = ct;
  for (let it = 0; it < vong; it++) {
    const cand = cur.slice(), bo = 1 + rnd.int(3);
    for (let k = 0; k < bo && cand.length; k++) cand.splice(rnd.int(cand.length), 1);
    const moi = chenReNhat(cand, rnd), mt = tien(moi);
    if (mt >= ct) { cur = moi; ct = mt; if (mt > bt) { best = moi; bt = mt; } }
  }
  return best;
}

let seq = greedyTiSo();
log("v1 greedy:", tien(seq), "tiền,", thoiGian(seq), "phút");
if (VERSION >= 2) { seq = chenReNhat(seq, null); log("v2 chèn:", tien(seq), "tiền,", thoiGian(seq), "phút"); }
if (VERSION >= 3) { seq = leoDoi(seq); log("v3 2-opt + chèn:", tien(seq), "tiền,", thoiGian(seq), "phút"); }
if (VERSION >= 4) { seq = lns(seq, 300); log("v4 LNS:", tien(seq), "tiền,", thoiGian(seq), "phút"); }

print(seq.length);
print(seq.map((i) => i + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

static int n, T, kx, ky;
static vector<int> X, Y, P, S;
static mt19937 gen(2026);

static int kc(int a, int b) { return a < 0 ? abs(X[b] - kx) + abs(Y[b] - ky) : abs(X[a] - X[b]) + abs(Y[a] - Y[b]); }   // a = -1: kho
static int thoiGian(const vector<int>& seq) { int tg = 0, cur = -1; for (int i : seq) { tg += kc(cur, i) + S[i]; cur = i; } return tg; }
static long long tien(const vector<int>& seq) { long long r = 0; for (int i : seq) r += P[i]; return r; }
static double u01() { return (gen() >> 8) / 16777216.0; }

const int VERSION = 4;   // 1 greedy · 2 + chèn rẻ nhất · 3 + 2-opt rồi chèn lại · 4 + LNS

static vector<int> greedyTiSo() {
    vector<bool> dung(n, false);
    vector<int> seq;
    int tg = 0, cur = -1;
    for (;;) {
        int tot = -1, phi = 0;
        double diemTot = -1e18;
        for (int i = 0; i < n; i++) {
            if (dung[i]) continue;
            int c = kc(cur, i) + S[i];
            if (tg + c > T) continue;
            double diem = (double)P[i] / (c + 1);
            if (diem > diemTot) { diemTot = diem; tot = i; phi = c; }
        }
        if (tot < 0) break;
        dung[tot] = true; seq.push_back(tot); tg += phi; cur = tot;
    }
    return seq;
}

// v2 — chèn rẻ nhất: mọi đơn chưa dùng × mọi vị trí, theo P / (thời gian tăng thêm + 1)
static vector<int> chenReNhat(vector<int> seq, bool nhieu) {
    int tg = thoiGian(seq);
    vector<bool> dung(n, false);
    for (int i : seq) dung[i] = true;
    for (;;) {
        int tot = -1, viTri = -1, them = 0;
        double diemTot = -1e18;
        for (int i = 0; i < n; i++) {
            if (dung[i]) continue;
            for (int pos = 0; pos <= (int)seq.size(); pos++) {
                int a = pos == 0 ? -1 : seq[pos - 1];
                int tang = kc(a, i) + S[i];
                if (pos < (int)seq.size()) tang += kc(i, seq[pos]) - kc(a, seq[pos]);   // đơn kế tiếp giờ đi từ i thay vì từ a
                if (tg + tang > T) continue;
                double diem = (double)P[i] / (tang + 1) * (nhieu ? 0.8 + 0.4 * u01() : 1.0);
                if (diem > diemTot) { diemTot = diem; tot = i; viTri = pos; them = tang; }
            }
        }
        if (tot < 0) break;
        seq.insert(seq.begin() + viTri, tot); dung[tot] = true; tg += them;
    }
    return seq;
}

// v3 — 2-opt trên tuyến mở: đảo seq[i..j] nếu tuyến ngắn đi
static void haiOpt(vector<int>& seq) {
    bool doi = true;
    int m = seq.size();
    while (doi) {
        doi = false;
        for (int i = 0; i + 1 < m; i++)
            for (int j = i + 1; j < m; j++) {
                int a = i == 0 ? -1 : seq[i - 1], b = seq[i], c = seq[j], d = j + 1 < m ? seq[j + 1] : -2;
                int cu = kc(a, b) + (d == -2 ? 0 : kc(c, d));
                int moi = kc(a, c) + (d == -2 ? 0 : kc(b, d));
                if (moi < cu) { reverse(seq.begin() + i, seq.begin() + j + 1); doi = true; }
            }
    }
}
static vector<int> leoDoi(vector<int> seq0) {
    vector<int> seq = chenReNhat(seq0, false);
    for (;;) {
        int tg0 = thoiGian(seq);
        vector<int> thu = seq;
        haiOpt(thu);
        if (thoiGian(thu) >= tg0) break;           // 2-opt không rút ngắn được nữa
        vector<int> moi = chenReNhat(thu, false);  // biến thời gian dư ra thành đơn mới
        if (tien(moi) > tien(seq)) seq = moi; else break;
    }
    return seq;
}

// v4 — LNS: phá 1–3 đơn, chèn lại có nhiễu, nhận nếu tiền không giảm; số vòng cố định
static vector<int> lns(vector<int> seq0, int vong) {
    vector<int> cur = seq0, best = seq0;
    long long ct = tien(cur), bt = ct;
    for (int it = 0; it < vong; it++) {
        vector<int> cand = cur;
        int bo = 1 + gen() % 3;
        for (int k = 0; k < bo && !cand.empty(); k++) cand.erase(cand.begin() + gen() % cand.size());
        vector<int> moi = chenReNhat(cand, true);
        long long mt = tien(moi);
        if (mt >= ct) { cur = moi; ct = mt; if (mt > bt) { best = moi; bt = mt; } }
    }
    return best;
}

int main() {
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    X.resize(n); Y.resize(n); P.resize(n); S.resize(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &X[i], &Y[i], &P[i], &S[i]);

    vector<int> seq = greedyTiSo();
    fprintf(stderr, "v1 greedy: %lld tien, %d phut\n", tien(seq), thoiGian(seq));
    if (VERSION >= 2) { seq = chenReNhat(seq, false); fprintf(stderr, "v2 chen: %lld\n", tien(seq)); }
    if (VERSION >= 3) { seq = leoDoi(seq); fprintf(stderr, "v3 2-opt + chen: %lld\n", tien(seq)); }
    if (VERSION >= 4) { seq = lns(seq, 300); fprintf(stderr, "v4 LNS: %lld\n", tien(seq)); }

    printf("%d\n", (int)seq.size());
    for (size_t i = 0; i < seq.size(); i++) printf("%d%c", seq[i] + 1, i + 1 < seq.size() ? ' ' : '\n');
    if (seq.empty()) printf("\n");
    return 0;
}
`
        },
        goiY: [
          "Một thay đổi một lần: cài `chenReNhat` rồi đặt VERSION = 2 và đọc dòng log trước khi làm tiếp. Thời gian tăng thêm khi chèn đơn i vào giữa a và b là kc(a, i) + s[i] + kc(i, b) − kc(a, b).",
          "2-opt chỉ **rút ngắn** tuyến — nên riêng nó không đổi tiền. Giá trị của nó chỉ hiện ra khi bạn **chèn lại** để dùng phần thời gian vừa dư.",
          "LNS: bản sao của tuyến hiện tại, bỏ 1–3 đơn ngẫu nhiên, chèn lại bằng chenReNhat có nhiễu (nhân chỉ số với 0,8 + 0,4·rnd()), nhận nếu tiền ≥ tiền hiện tại, nhớ bản tốt nhất. Dùng đúng 300 vòng và `rng` cố định để kết quả tất định."
        ]
      }
    ]
  });
})();
