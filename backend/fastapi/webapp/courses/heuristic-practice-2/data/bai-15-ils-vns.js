/* Thực hành — Bài 15: ILS & VNS — hai khung đơn giản mà mạnh. */

/* Bài toán dựng riêng cho bài này (tiền tố b15-):
   - b15-tsp-ils: chu trình ngắn nhất, stdin có thêm số vòng ILS cố định `V` ngay dòng đầu (`n V`).
   - b15-chap-nhan: mô phỏng tiêu chí chấp nhận của ILS (phân biệt fCur và fBest) — chỉ có một đáp án đúng. */
(function () {
  "use strict";
  var tsp = TH.vande.lay("tsp");
  TH.vande.keThua("tsp", "b15-tsp-ils", {
    sinh: function (seed, tham) {
      var inst = tsp.sinh(seed, tham);
      inst.vong = tham && tham.vong != null ? tham.vong : 300;
      return inst;
    },
    viet: function (inst) {
      return inst.n + " " + inst.vong + "\n" + tsp.viet(inst).split("\n").slice(1).join("\n");
    },
    dinhDang: {
      vao: "Dòng 1: `n V` — số điểm và **số vòng ILS** (cố định, để kết quả không phụ thuộc máy). Tiếp theo `n` dòng, dòng `i` là `x y` — toạ độ nguyên của điểm `i` (đánh số từ 1).",
      ra: tsp.dinhDang.ra
    }
  });

  TH.vande.dangKy("b15-chap-nhan", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      var r = TH.tienIch.rng(seed), V = (tham && tham.V) || 120, P = tham && tham.P != null ? tham.P : 30;
      var f0 = 1000 + r.khoang(0, 40), ds = [];
      for (var i = 0; i < V; i++) {
        /* độ dài sau nhiễu + local search: dao động quanh f0, xu hướng giảm dần như một ILS thật; khoảng hẹp nên hay gặp đẳng thức */
        ds.push({ f: f0 + 4 - Math.floor(i / 8) + r.khoang(0, 12), u: r.khoang(0, 999) });
      }
      return { V: V, P: P, f0: f0, ds: ds };
    },
    viet: function (inst) {
      var s = inst.V + " " + inst.P + "\n" + inst.f0 + "\n";
      inst.ds.forEach(function (d) { s += d.f + " " + d.u + "\n"; });
      return s;
    },
    giai: function (inst) {
      var fCur = inst.f0, fBest = inst.f0, tot = 0, xau = 0, vongBest = 0;
      inst.ds.forEach(function (d, i) {
        if (d.f < fCur) { fCur = d.f; tot++; }
        else if (d.u < inst.P) { fCur = d.f; xau++; }
        if (d.f < fBest) { fBest = d.f; vongBest = i + 1; }
      });
      return [tot, xau, fCur, fBest, vongBest];
    },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `V P` — số vòng và xác suất “nhận cả nghiệm không tốt hơn” tính bằng ‰ (phần nghìn). Dòng 2: `f0` — độ dài sau local search đầu tiên. Rồi `V` dòng `f u`: `f` là độ dài của x′ sau nhiễu loạn + local search ở vòng đó, `u` ∈ [0, 999] là số đã bốc cho vòng đó.",
      ra: "Một dòng gồm năm số: số lần nhận vì **tốt hơn**, số lần nhận vì **may rủi** (u < P), `fCur` cuối, `fBest` cuối, số thứ tự vòng (từ 1) cải thiện `fBest` lần cuối (0 nếu chưa lần nào)."
    }
  }));
})();

TH.dangKy({
  id: "bai-15-ils-vns",

  tomTat: [
    "ILS gói trong một vòng lặp: **nhiễu loạn → local search → chấp nhận → cập nhật best**. Khung chỉ cỡ 30 dòng và gần như không có tham số phải dò; khoá học khuyến nghị **thử ILS trước tiên**.",
    "ILS khác đa khởi động ở chỗ **giữ lại 70–90 %** lời giải cũ (phá 10–30 %), còn đa khởi động giữ 0 %. Vì thế ILS cải thiện liên tục theo số vòng, còn đa khởi động cạn dần.",
    "Nhiễu loạn nên **khó bị local search hoàn tác**: với TSP dùng double-bridge (cắt 4 đoạn, nối P1–P4–P3–P2, một nước 4-opt đổi 4 cạnh mà không nước 2-opt hay Or-opt đơn lẻ nào hoàn tác được — nhưng một chuỗi nhiều nước thì có thể), còn đảo một đoạn ngẫu nhiên (= 1 nước 2-opt) dễ bị hoàn tác hơn nhiều. Nhiễu quá yếu thì ILS thành leo đồi lặp vô ích; phá quá mạnh (≈ 80 %) thì thành đa khởi động.",
    "Tiêu chí chấp nhận khuyến nghị: **nhận nếu tốt hơn, ngoài ra nhận với xác suất 2–5 %** — Metropolis bỏ hết phần tinh vi. Luôn giữ hai biến: `fCur` (đang đứng, có thể tệ đi) và `fBest` (kỷ lục); lẫn hai biến là lỗi phổ biến nhất ở Phần 4.",
    "VND = đổi lân cận khi kẹt, **không có chút ngẫu nhiên**: thành công thì về k = 1, thất bại thì k + 1, lân cận xếp **rẻ trước, đắt sau**. Quên đặt lại k = 1 là lỗi im lặng: mỗi lân cận chỉ được duyệt đúng một lần.",
    "VNS = VND + shake: lấy ngẫu nhiên một nghiệm trong lân cận N_k rồi chạy VND; thành công thì k = 1, thất bại thì k + 1. Cường độ nhiễu có cấu trúc (thứ tự các lân cận) thay cho một con số mờ kiểu “phá 20 %”.",
    "Số liệu TSP n = 600: 2-opt đầy đủ 25 630; ILS 200 vòng ≈ 24 400 (−4,8 %); ILS 2 000 vòng ≈ 23 700 (−7,5 %) — tăng vòng vẫn còn lãi thêm 2,9 %.",
    "Chọn khung: có sẵn 1 toán tử tốt → ILS; 3–5 toán tử → VND rồi thêm shake thành VNS; muốn ít tham số nhất → VND; muốn mạnh nhất trong ba → VNS."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§2.1",
      hoi: "Một vòng lặp của ILS gồm bốn việc. Thứ tự đúng là gì?",
      chon: [
        "Local search → nhiễu loạn → chấp nhận → cập nhật best",
        "Nhiễu loạn → local search → chấp nhận → cập nhật best",
        "Chấp nhận → nhiễu loạn → local search → cập nhật best",
        "Nhiễu loạn → chấp nhận → cập nhật best → local search"
      ],
      dung: 1,
      giaiThich: "x′ = nhiễu loạn(x) phá nhẹ nghiệm; local search đưa x′ xuống một cực trị cục bộ MỚI; chỉ khi đó mới có f(x′) thật để quyết định chấp nhận và so với kỷ lục. Ba thứ tự còn lại hoặc quyết định chấp nhận trước khi nghiệm được sửa lại, hoặc để local search chạy sau khi đã ghi nhận kỷ lục."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§2.2",
      hoi: "Vì sao ILS cải thiện liên tục theo số vòng, trong khi đa khởi động ngày càng cạn?",
      chon: [
        "Mỗi vòng ILS xuất phát từ lời giải hiện tại và giữ lại khoảng 70–90 % của nó, còn mỗi lần đa khởi động bắt đầu lại từ con số 0",
        "ILS luôn dùng local search mạnh hơn đa khởi động",
        "ILS chấp nhận mọi nghiệm xấu nên không bao giờ kẹt",
        "Đa khởi động không giữ nghiệm tốt nhất từng gặp"
      ],
      dung: 0,
      giaiThich: "Phá 20 % nghĩa là 80 % công sức trước đó vẫn còn nguyên, nên mỗi vòng ILS xuất phát từ chỗ tốt hơn vòng trước; đa khởi động chỉ tăng theo E[max Z] — rất chậm sau vài chục lần. Local search của hai bên giống nhau; ILS không chấp nhận mọi nghiệm (nhận tất sẽ không hội tụ); đa khởi động vẫn giữ nghiệm tốt nhất."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "§5", donVi: "(%)",
      hoi: "Theo bảng §5 (TSP n = 600): ILS 200 vòng cho độ dài ≈ 24 400, ILS 2 000 vòng cho ≈ 23 700. So với ILS 200 vòng, tăng lên 2 000 vòng giảm thêm bao nhiêu phần trăm độ dài?",
      dapAn: 2.87, saiSo: 0.05,
      giaiThich: "(24 400 − 23 700) / 24 400 = 700 / 24 400 ≈ 0,0287 = 2,87 % (bài làm tròn 2,9 %). Đáng chú ý: đây là phần lãi THÊM so với ILS 200 vòng; so với 2-opt đầy đủ (25 630) thì cả hai đều giảm nhiều hơn (4,8 % và 7,5 %). Đó là dấu hiệu ILS cải thiện liên tục theo số vòng."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§2.4",
      hoi: "ILS của bạn dùng tiêu chí “chỉ nhận cái tốt hơn”. Sau 100 vòng đầu nó không cải thiện thêm. Điều chỉnh rẻ nhất, đúng theo bài, là gì?",
      chon: [
        "Đổi sang “nhận tất” — luôn lấy nghiệm mới làm điểm xuất phát",
        "Bỏ nhiễu loạn và cho local search chạy lâu hơn",
        "Thêm một xác suất cố định nhỏ (2–5 %) nhận cả nghiệm không tốt hơn",
        "Tăng số vòng lên gấp 10 và giữ nguyên mọi thứ khác"
      ],
      dung: 2,
      giaiThich: "“Chỉ nhận tốt hơn” bám sát vùng tốt nhưng dễ kẹt; tiêu chí khuyến nghị là tốt hơn thì nhận, ngoài ra nhận với xác suất 2–5 % (Metropolis bỏ hết phần tinh vi). “Nhận tất” đi lang thang và không hội tụ; local search đã ở cực trị cục bộ nên chạy lâu hơn vô ích; tăng vòng mà giữ tiêu chí thì vẫn bị kẹt đúng chỗ đó."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§2.6, §7 (cạm bẫy 4)",
      hoi: "Trong đoạn ILS cho TSP có cả `fCur` lẫn `fBest`. Vì sao không thể gộp thành một biến?",
      chon: [
        "Để tiết kiệm bộ nhớ khi nghiệm dài",
        "Vì local search cần biết fCur để chạy nhanh hơn",
        "Vì double-bridge chỉ hoạt động trên fBest",
        "Vì nghiệm đang đứng (fCur) có thể tệ đi khi nhận nước may rủi 2 %, còn trả về phải là kỷ lục (fBest)"
      ],
      dung: 3,
      giaiThich: "Khi nhận một nghiệm không tốt hơn, fCur tăng nhưng kỷ lục đã đạt vẫn phải được giữ. Nếu gộp, nghiệm trả về có thể tệ hơn nghiệm đã từng gặp — lỗi lặp lại ở mọi bài Phần 4 vì các khung này đi lên đi xuống. Ba lý do còn lại không có thật: đây không phải chuyện bộ nhớ, tốc độ local search hay double-bridge."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§2.7, §7",
      hoi: "Chọn mọi phát biểu ĐÚNG về nhiễu loạn trong ILS:",
      chon: [
        "Nhiễu loạn càng mạnh càng tốt: phá 80 % nghiệm vẫn giữ nguyên ưu thế của ILS",
        "Double-bridge cắt chu trình thành 4 đoạn rồi nối lại theo thứ tự P1–P4–P3–P2 (đổi 4 cạnh)",
        "Không một nước 2-opt hay Or-opt đơn lẻ nào hoàn tác được double-bridge trong một bước",
        "Nếu f sau local search luôn bằng f(x) trước đó thì nhiễu loạn đang quá mạnh",
        "Nhiễu bằng “đảo một đoạn ngẫu nhiên” dễ bị local search (vốn dùng 2-opt) đảo lại đúng chỗ cũ"
      ],
      dung: [1, 2, 4],
      giaiThich: "Ba ý đầu đúng theo §2.7. Phá 80 % biến ILS thành đa khởi động và mất hết thông tin tích luỹ (cạm bẫy 2 — quy tắc là phá 10–30 %). Ý cuối đảo ngược: f sau local search luôn bằng f(x) cũ nghĩa là local search hoàn tác hết nhiễu, tức nhiễu loạn quá YẾU (cạm bẫy 1)."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§3.2, §7 (cạm bẫy 3)",
      hoi: "VND của bạn có năm lân cận, nhưng sau mỗi lần cải thiện thành công code không đặt lại k = 1 mà cứ tiếp tục k + 1. Hậu quả là gì?",
      chon: [
        "VND chạy vòng lặp vô hạn",
        "VND trả về nghiệm không hợp lệ",
        "Mỗi lân cận chỉ được duyệt đúng một lần rồi VND dừng — mất phần lớn hiệu quả mà chương trình vẫn chạy trơn tru",
        "VND tự biến thành ILS"
      ],
      dung: 2,
      giaiThich: "Sau một thành công lời giải đã đổi nên các nước ở N₁ vốn trước đó vô vọng có thể lại cải thiện được; bỏ dòng k = 1 thì N₁ không bao giờ được thử lại. Đây là lỗi im lặng: không treo, không sai ràng buộc, chỉ kém. Không có yếu tố ngẫu nhiên nào được thêm vào nên không thể thành ILS."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§3.3",
      hoi: "Vì sao nên xếp các lân cận của VND theo chi phí tăng dần (2-opt trước, exchange sau)?",
      chon: [
        "Vì lân cận rẻ luôn cho nghiệm tốt hơn lân cận đắt",
        "Vì thứ tự không ảnh hưởng gì nên chọn tuỳ ý",
        "Vì exchange không thể chạy trước 2-opt",
        "Vì khi lân cận rẻ còn cải thiện được thì bạn không bao giờ phải trả giá duyệt lân cận đắt; chỉ khi mọi thứ rẻ cạn mới động tới công cụ nặng"
      ],
      dung: 3,
      giaiThich: "Lập luận hoàn toàn về chi phí: duyệt N₅ (exchange, đắt nhất và — trong danh sách N₁..N₅ ở §3.3 — là cái duy nhất đổi TẬP đơn được chọn) chỉ khi N₁..N₄ đã cạn. “Rẻ hơn thì tốt hơn” không đúng — chỉ là rẻ hơn; thứ tự có ảnh hưởng tới thời gian chạy; và không có ràng buộc kỹ thuật nào cấm exchange chạy trước."
    },
    {
      id: "q9", loai: "nhieu", doKho: 3, ref: "§4.2",
      hoi: "Chọn mọi phát biểu ĐÚNG khi so sánh ILS, VND và VNS:",
      chon: [
        "VND không có chút ngẫu nhiên nào và không có tham số phải dò",
        "ILS bắt buộc phải dùng nhiều lân cận khác nhau",
        "VND vẫn có thể kẹt ở “cực trị cục bộ chung” của mọi lân cận",
        "VNS tăng k khi thành công và đặt lại k = 1 khi thất bại",
        "VNS thoát được cực trị cục bộ nhờ shake: lấy ngẫu nhiên một nghiệm trong lân cận N_k"
      ],
      dung: [0, 2, 4],
      giaiThich: "Theo bảng §4.2: VND 0 tham số, tất định, nhưng chỉ đi xuống dốc nên vẫn kẹt khi không toán tử nào trong N₁..N_K cải thiện được; VNS thêm shake ngẫu nhiên để thoát. ILS không bắt buộc nhiều lân cận (một toán tử tốt là đủ). VNS làm ngược lại ý cuối: thành công thì về k = 1, thất bại thì k + 1."
    },
    {
      id: "q10", loai: "so", doKho: 2, ref: "§6", donVi: "(phút)",
      hoi: "Ví dụ làm tay trên P1: tuyến đã dùng 450 trong 480 phút. Or-opt ở k = 2 tiết kiệm 12 phút, sau đó ở k = 3 chèn được đơn E cần 38 phút. Sau khi chèn E, tuyến còn dư bao nhiêu phút?",
      dapAn: 4, saiSo: 0,
      giaiThich: "Sau Or-opt: 450 − 12 = 438 phút, tức dư 480 − 438 = 42 phút (30 dư sẵn + 12 vừa giải phóng). Chèn E tốn 38 phút nên còn dư 42 − 38 = 4 phút. Nếu bỏ bước k = 2 thì chỉ dư 30 phút < 38 và E không bao giờ vào được — Or-opt đứng trước phép chèn vì nó giải phóng tài nguyên."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 15.1, §2.7",
      hoi: "Giải thích vì sao double-bridge thường được chọn làm nhiễu loạn cho TSP thay cho “đảo một đoạn ngẫu nhiên”. Nêu một cách **kiểm chứng bằng thực nghiệm** cho kết luận đó, và cho biết kết luận đúng tới mức nào.",
      goiY: ["Local search của ILS dùng phép gì để sửa tuyến? Phép đảo một đoạn ngẫu nhiên có phải là một nước của nó không?", "Double-bridge thay đổi bao nhiêu cạnh của chu trình?"],
      mau: "**Đảo một đoạn ngẫu nhiên** chính là một nước 2-opt (tệ). Local search của ILS vốn dùng 2-opt nên **có thể** nhận ra đó là nước xấu và đảo lại — chỉ một nước 2-opt là đủ để hoàn tác. Mỗi lần như vậy bạn quay về đúng chỗ cũ, tốn công vô ích (cạm bẫy 1); còn xảy ra thường đến mức nào thì phụ thuộc cách cài local search.\n\n**Double-bridge** cắt chu trình thành 4 đoạn P1–P2–P3–P4 rồi nối lại P1–P4–P3–P2: một nước **4-opt** (đổi 4 cạnh) mà không một nước 2-opt hay Or-opt đơn lẻ nào hoàn tác được trong một bước. Local search phải tìm đường xuống từ cấu hình mới, thường qua nhiều nước. Điều đó làm giảm khả năng quay về chỗ cũ chứ **không đảm bảo** nó: một chuỗi nhiều nước cải thiện vẫn có thể đưa về đúng cực trị cũ.\n\n**Cách kiểm chứng** (§7): ở mỗi vòng in f ngay sau nhiễu loạn và f sau local search, rồi đếm tỉ lệ vòng mà f sau local search **bằng đúng** f(x) trước đó. Nhiễu quá yếu cho tỉ lệ này rất cao. Sau đó chạy cùng số vòng, cùng seed với hai kiểu nhiễu và so độ dài tốt nhất.\n\n**Kết luận đúng tới mức nào** (số đo thử ở §2.7: TSP n = 100, ILS 300 vòng, 10 bộ phân bố đều và 10 bộ gom cụm): tỉ lệ vòng bị hoàn tác với đảo đoạn so với double-bridge là khoảng 70 % so với 27 % (2-opt + Or-opt) và khoảng 40 % so với 4–5 % (2-opt gặp-là-đổi); với 2-opt chọn nước tốt nhất thì cả hai đều bị hoàn tác gần hết (≈ 100 % và ≈ 97 %) và ILS kém hơn rõ. Nhưng với hai cấu hình đầu, độ dài cuối cùng của hai loại nhiễu loạn chỉ chênh nhau dưới 0,3 % (trên dữ liệu gom cụm đảo đoạn còn nhỉnh hơn chút). Vậy double-bridge **thường** ít bị hoàn tác hơn nhiều, nhưng điều đó không nhất thiết kéo theo kết quả cuối tốt hơn — hãy tự đo trên bài toán của bạn (lab bên dưới cho bạn tự đo).",
      tieuChi: [
        "Nhận ra phép đảo một đoạn chính là một nước 2-opt nên local search có thể đảo lại được",
        "Nêu double-bridge là nước 4-opt (P1–P4–P3–P2, đổi 4 cạnh) mà không nước 2-opt/Or-opt đơn lẻ nào hoàn tác được trong một bước — nhưng không đảm bảo, vì một chuỗi nhiều nước vẫn có thể về chỗ cũ",
        "Đề xuất phép kiểm cụ thể: so f sau nhiễu với f sau local search (hoặc tỉ lệ vòng quay về đúng f(x))",
        "Nói rõ phải so ở cùng số vòng, cùng seed",
        "Nêu đúng mức kết luận: double-bridge thường ít bị hoàn tác hơn, nhưng độ dài cuối chênh rất ít nên phải tự đo"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§1, §2.2, §4.3, Bài tập 15.4",
      hoi: "Vì sao khoá học khuyến nghị “trong bài thi, hãy thử ILS trước tiên”? Nêu ít nhất **ba** lý do rút ra từ bài, và nói khi nào bạn chuyển sang VND/VNS.",
      goiY: ["Nghĩ tới số tham số, số dòng code, và thông tin được giữ lại sau mỗi vòng.", "Bảng “khi nào dùng cái nào” ở §4.3."],
      mau: "1. **Ít tham số**: ILS chỉ cỡ 30 dòng, 1–2 tham số. Mỗi tham số là một thứ phải dò, tốn thời gian chạy thí nghiệm và tạo cơ hội tinh chỉnh quá đà (Bài 4, cạm bẫy 4).\n2. **Giữ lại 70–90 % lời giải cũ** sau mỗi vòng (phá 10–30 %), nên cải thiện liên tục theo số vòng; đa khởi động giữ 0 % và cạn dần.\n3. **Phiên bản thô đủ tốt**: tiêu chí chấp nhận khuyến nghị (tốt hơn thì nhận, ngoài ra nhận 2–5 %) là Metropolis bỏ hết phần tinh vi — 20 % công sức, 80 % giá trị.\n4. Bằng chứng: ở ngân sách 15 ms trên P1, thường ILS ≈ SA > ALNS (đáp án 15.4), nên khuyến nghị được xác nhận.\n\n**Chuyển sang VND/VNS** khi bạn có sẵn 3–5 toán tử khác nhau: dùng VND (0 tham số, tất định), rồi thêm shake thành VNS nếu cần thoát cực trị cục bộ chung. Chỉ có một toán tử tốt thì ILS là hợp lý.",
      tieuChi: [
        "Nêu ít nhất ba lý do khác nhau (ít tham số, giữ lại 70–90 %, tiêu chí đơn giản đủ tốt, bằng chứng thực nghiệm…)",
        "Nêu được đối chiếu với đa khởi động (giữ 0 %, cạn dần)",
        "Nói khi nào dùng VND/VNS: có sẵn 3–5 toán tử khác nhau"
      ]
    },
    {
      id: "l3", doKho: 2, ref: "§3.2, §6",
      hoi: "Trên ví dụ §6 (tuyến [A, B, C, D], dùng 450/480 phút): (a) vì sao bước Or-opt ở k = 2 được nhận dù **không tăng điểm chút nào**? (b) vì sao sau bước đó phải quay về k = 1 chứ không đi tiếp k = 3?",
      goiY: ["Đếm số phút còn dư trước và sau bước Or-opt, rồi so với thời gian đơn E cần.", "Sau một thành công, lời giải còn giống lúc đứng ở k = 1 không?"],
      mau: "**(a)** Or-opt tiết kiệm 12 phút nên thời gian dư tăng từ 30 lên 42 phút. 12 phút này là **nguyên liệu**: đủ để chèn đơn E (38 phút) ở bước k = 3, thu thêm 2 400 điểm. Nếu không làm bước k = 2 trước thì dư chỉ 30 < 38 và E không bao giờ vào được. Đây là nguyên tắc “toán tử giải phóng tài nguyên đứng trước toán tử tiêu tài nguyên” (Bài 9 §5.2). Về điều kiện nhận: theo khung §3.2 nước này chỉ được nhận nếu “tốt hơn” tính cả thời gian (điểm trừ λ·phút như ở Bài 9 §5.1), hoặc nếu với toán tử rút ngắn “thành công” nghĩa là *thời gian giảm* như trong `leoDoi` (Bài 9 §5.2). Ghi chú: ví dụ §6 dùng bốn lân cận của `leoDoi` (N₁ = 2-opt, N₂ = Or-opt L = 1, N₃ = chèn một đơn chưa dùng, N₄ = exchange), nên số thứ tự khác danh sách tổng quát ở §3.3 và khác bộ bốn lân cận của bài tập 15.3.\n\n**(b)** Nước đi vừa rồi đã **làm thay đổi lời giải**, nên những nước 2-opt vốn vô vọng ở N₁ giờ có thể lại có tác dụng (Bài 9 §5.3, vòng lặp ngoài). Vì vậy thành công ở bất kỳ k nào cũng đặt lại k = 1. Quên dòng k = 1 thì VND duyệt mỗi lân cận đúng một lần rồi dừng — lỗi im lặng.",
      tieuChi: [
        "Tính đúng: dư 30 → 42 phút nhờ Or-opt; E cần 38 phút",
        "Nêu nguyên tắc: toán tử giải phóng tài nguyên đứng trước toán tử tiêu tài nguyên",
        "Giải thích thành công thì về k = 1 vì lời giải đã đổi nên N₁ có thể lại cải thiện được"
      ]
    },
    {
      id: "l4", doKho: 3, ref: "Bài tập 15.3, Bài 4",
      hoi: "Bạn cài VNS 4 lân cận cho P1 và đo được hơn `leoDoi` (VND thuần) khoảng 1 %. Hãy: (a) đề xuất thứ tự bốn lân cận kèm lý do; (b) nêu cách quyết định mức hơn 1 % đó có đáng tin không; (c) giải thích vì sao VNS có thể hơn VND thuần.",
      goiY: ["Bài tập 15.3 cho bốn lân cận: 2-opt, Or-opt, exchange 1 đơn, exchange 3 đơn.", "Bài 4: chênh lệch trung bình phải lớn hơn bao nhiêu lần sai số chuẩn?"],
      mau: "**(a)** Xếp theo chi phí tăng dần: N₁ = 2-opt (rẻ nhất), N₂ = Or-opt, N₃ = exchange 1 đơn, N₄ = exchange 3 đơn (đắt nhất; exchange là loại duy nhất đổi TẬP đơn được chọn). Rẻ trước để khi còn cải thiện được thì không phải trả giá duyệt lân cận đắt.\n\n**(b)** Chạy cả hai thuật toán trên nhiều bộ dữ liệu giống nhau, tính chênh lệch từng test, lấy trung bình và sai số chuẩn SE. Chỉ kết luận “có ý nghĩa” khi |chênh lệch trung bình| > 2·SE (Bài 4). Với ít test thì +1 % rất dễ là nhiễu.\n\n**(c)** VND tất định chỉ đi xuống dốc nên kẹt ở “cực trị cục bộ chung” của mọi lân cận. VNS thêm bước shake: lấy ngẫu nhiên một nghiệm trong N_k rồi chạy VND; thành công thì k = 1, thất bại thì k + 1. Nhờ đó nó thoát được chỗ VND hết đường. Đáp án mẫu 15.3 cho khoảng +0,5–1,5 %.",
      tieuChi: [
        "Thứ tự lân cận rẻ → đắt, có lý do (exchange đắt nhất, đổi tập được chọn)",
        "Nêu phép kiểm: nhiều test, chênh lệch trung bình so với 2·SE",
        "Giải thích VND kẹt ở cực trị cục bộ chung còn VNS có shake để thoát"
      ]
    }
  ],

  lab: [
    {
      id: "ils-tsp",
      ten: "ILS cho TSP: double-bridge + 2-opt",
      doKho: 2,
      ref: "§2.3, §2.6, §5, §7",
      de: "Cài **ILS** theo §2.6 cho bài chu trình ngắn nhất. Dòng đầu của đầu vào là `n V` — số điểm và **số vòng ILS cố định** (để kết quả không phụ thuộc tốc độ máy); sau đó là `n` dòng toạ độ.\n\n" +
          "**Khung**: khởi tạo bằng *láng giềng gần nhất* xuất phát từ điểm 1 → local search **2-opt gặp-là-đổi** (lặp tới khi không còn nước nào giảm độ dài) → lặp đúng `V` vòng: **double-bridge** với 3 điểm cắt ngẫu nhiên → 2-opt → chấp nhận (nhận nếu ngắn hơn, ngoài ra nhận với xác suất 2 %) → cập nhật `best`. In `best`. Mọi ngẫu nhiên phải theo `rng(seed)` với seed cố định (JS) hoặc `mt19937` seed cố định (C++).\n\n" +
          "Chấm trên 10 bộ dữ liệu `n = 100`, `V = 300`. **Mức đạt** (độ dài so với 2-opt từ láng giềng gần nhất, mốc `haiOpt`): hợp lệ → không tệ hơn 2-opt → ngắn hơn khoảng 3 % → ngắn hơn khoảng 4 %.\n\n" +
          "**Khám phá bằng các biến thể**: `V = 0` (ILS không làm gì — bằng 2-opt), rồi `V = 30`, `100`, `300`, `1000` (§5: mỗi lần nhân khoảng 3 lần số vòng thì độ dài còn giảm thêm bao nhiêu? có đúng là “cải thiện liên tục” không?), và dữ liệu gom cụm.\n\n" +
          "**Câu hỏi suy ngẫm**: dùng `log` in ra tỉ lệ vòng mà độ dài sau local search **bằng đúng** độ dài trước đó (cách kiểm ở §7, cạm bẫy 1). Rồi thay double-bridge bằng *đảo một đoạn ngẫu nhiên*: tỉ lệ đó đổi thế nào, và độ dài cuối cùng có đổi nhiều không?",
      vanDe: "b15-tsp-ils",
      tham: { n: 100, vong: 300 },
      bienThe: [
        { ten: "V = 300 (mặc định)", tham: { n: 100, vong: 300 } },
        { ten: "V = 0 (chỉ 2-opt)", tham: { n: 100, vong: 0 } },
        { ten: "V = 30", tham: { n: 100, vong: 30 } },
        { ten: "V = 100", tham: { n: 100, vong: 100 } },
        { ten: "V = 1000", tham: { n: 100, vong: 1000 } },
        { ten: "Gom cụm, V = 300", tham: { n: 100, cum: true, vong: 300 } }
      ],
      soTest: 10,
      gioiHanMs: 4000,
      muc: [
        { ten: "Không tệ hơn 2-opt từ láng giềng gần nhất", so: "haiOpt", heSo: 1 },
        { ten: "Ngắn hơn 2-opt khoảng 3 %", so: "haiOpt", heSo: 1.03 },
        { ten: "Ngắn hơn 2-opt khoảng 4 %", so: "haiOpt", heSo: 1.045 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n V" (số điểm, số vòng ILS); rồi n dòng "x y".
// Đầu ra : một dòng gồm n chỉ số (từ 1) — hoán vị theo thứ tự đi, chu trình khép kín.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], soVong = t[1];
const X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[2 + 2 * i]); Y.push(t[3 + 2 * i]); }
const r = rng(12345);                       // seed cố định: kết quả tái lập được

const d = [];                               // ma trận khoảng cách
for (let i = 0; i < n; i++) {
  d.push(new Float64Array(n));
  for (let j = 0; j < n; j++) d[i][j] = Math.hypot(X[i] - X[j], Y[i] - Y[j]);
}
const doDai = (p) => { let s = 0; for (let i = 0; i < n; i++) s += d[p[i]][p[(i + 1) % n]]; return s; };

// Local search: 2-opt gặp-là-đổi, lặp tới khi không còn nước nào giảm độ dài.
function haiOpt(p) {
  let caiThien = true;
  while (caiThien) {
    caiThien = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
        if (d[a][c] + d[b][e] < d[a][b] + d[c][e] - 1e-9) {
          for (let l = i + 1, h = j; l < h; l++, h--) { const tam = p[l]; p[l] = p[h]; p[h] = tam; }
          caiThien = true;
        }
      }
    }
  }
}

// Khởi tạo: láng giềng gần nhất từ điểm 0, rồi 2-opt.
let x = [0];
const dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  const cu = x[x.length - 1];
  let tot = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
  dung[tot] = true; x.push(tot);
}
haiOpt(x);

// TODO 1: viết doubleBridge(p) — chọn 3 điểm cắt 1 ≤ a < b < c ≤ n−1 bằng r.int(...),
//         trả về mảng mới  p[0..a) + p[c..n) + p[b..c) + p[a..b)   (P1 P4 P3 P2 — đổi 4 cạnh).
// TODO 2: lặp soVong vòng: y = doubleBridge(x); haiOpt(y); chấp nhận (ngắn hơn thì nhận,
//         ngoài ra nhận khi r() < 0.02); nhớ best thật cẩn thận — fCur và fBest là HAI biến khác nhau.
let best = x;

print(best.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, soVong;
vector<vector<double>> d;
mt19937 gen(12345);                          // seed cố định: kết quả tái lập được
int rnd(int m) { return (int)(gen() % m); }  // số nguyên trong [0, m)
double unit() { return (gen() >> 8) / 16777216.0; }

double doDai(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += d[p[i]][p[(i + 1) % n]];
    return s;
}

// Local search: 2-opt gặp-là-đổi, lặp tới khi không còn nước nào giảm độ dài.
void haiOpt(vector<int>& p) {
    bool caiThien = true;
    while (caiThien) {
        caiThien = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
                if (d[a][c] + d[b][e] < d[a][b] + d[c][e] - 1e-9) {
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    caiThien = true;
                }
            }
    }
}

int main() {
    scanf("%d %d", &n, &soVong);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    d.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) d[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    // Khởi tạo: láng giềng gần nhất từ điểm 0, rồi 2-opt.
    vector<int> x(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int cu = x.back(), tot = -1;
        for (int i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
        dung[tot] = true; x.push_back(tot);
    }
    haiOpt(x);

    // TODO 1: viết doubleBridge(p) — chọn 3 điểm cắt 1 <= a < b < c <= n-1 bằng rnd(...),
    //         trả về  p[0..a) + p[c..n) + p[b..c) + p[a..b)   (P1 P4 P3 P2 — đổi 4 cạnh).
    // TODO 2: lặp soVong vòng: y = doubleBridge(x); haiOpt(y); chấp nhận (ngắn hơn thì nhận,
    //         ngoài ra nhận khi unit() < 0.02); nhớ best thật cẩn thận — fCur và fBest là HAI biến khác nhau.
    vector<int> best = x;

    for (int i = 0; i < n; i++) printf("%d%c", best[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], soVong = t[1];
const X = [], Y = [];
for (let i = 0; i < n; i++) { X.push(t[2 + 2 * i]); Y.push(t[3 + 2 * i]); }
const r = rng(12345);

const d = [];
for (let i = 0; i < n; i++) {
  d.push(new Float64Array(n));
  for (let j = 0; j < n; j++) d[i][j] = Math.hypot(X[i] - X[j], Y[i] - Y[j]);
}
const doDai = (p) => { let s = 0; for (let i = 0; i < n; i++) s += d[p[i]][p[(i + 1) % n]]; return s; };

function haiOpt(p) {
  let caiThien = true;
  while (caiThien) {
    caiThien = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
        if (d[a][c] + d[b][e] < d[a][b] + d[c][e] - 1e-9) {
          for (let l = i + 1, h = j; l < h; l++, h--) { const tam = p[l]; p[l] = p[h]; p[h] = tam; }
          caiThien = true;
        }
      }
    }
  }
}

// Double-bridge: cắt thành P1 P2 P3 P4 rồi nối lại P1 P4 P3 P2 — một nước 4-opt (đổi 4 cạnh).
function doubleBridge(p) {
  let a, b, c;
  do {
    [a, b, c] = [1 + r.int(n - 1), 1 + r.int(n - 1), 1 + r.int(n - 1)].sort((u, v) => u - v);
  } while (a === b || b === c);
  return p.slice(0, a).concat(p.slice(c), p.slice(b, c), p.slice(a, b));
}

// Khởi tạo: láng giềng gần nhất + 2-opt.
let x = [0];
const dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  const cu = x[x.length - 1];
  let tot = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
  dung[tot] = true; x.push(tot);
}
haiOpt(x);

let best = x.slice();
let fCur = doDai(x), fBest = fCur;         // HAI biến: nơi đang đứng và kỷ lục
let hoanTac = 0;
for (let v = 0; v < soVong; v++) {
  const y = doubleBridge(x);               // nhiễu loạn
  haiOpt(y);                               // local search → một cực trị cục bộ mới
  const fy = doDai(y);
  if (Math.abs(fy - fCur) < 1e-9) hoanTac++;          // cách kiểm cạm bẫy 1
  if (fy < fCur - 1e-9) { x = y; fCur = fy; }         // tốt hơn: luôn nhận
  else if (r() < 0.02) { x = y; fCur = fy; }          // 2 %: đa dạng hoá
  if (fy < fBest - 1e-9) { fBest = fy; best = y.slice(); }   // BẮT BUỘC: cập nhật kỷ lục
}
if (soVong > 0) log("vòng bị hoàn tác: " + (100 * hoanTac / soVong).toFixed(1) + " %");
print(best.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n, soVong;
vector<vector<double>> d;
mt19937 gen(12345);
int rnd(int m) { return (int)(gen() % m); }
double unit() { return (gen() >> 8) / 16777216.0; }

double doDai(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += d[p[i]][p[(i + 1) % n]];
    return s;
}

void haiOpt(vector<int>& p) {
    bool caiThien = true;
    while (caiThien) {
        caiThien = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
                if (d[a][c] + d[b][e] < d[a][b] + d[c][e] - 1e-9) {
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    caiThien = true;
                }
            }
    }
}

// Double-bridge: cắt thành P1 P2 P3 P4 rồi nối lại P1 P4 P3 P2 — một nước 4-opt (đổi 4 cạnh).
vector<int> doubleBridge(const vector<int>& p) {
    int cat[3];
    for (;;) {
        for (int k = 0; k < 3; k++) cat[k] = 1 + rnd(n - 1);
        sort(cat, cat + 3);
        if (cat[0] < cat[1] && cat[1] < cat[2]) break;
    }
    vector<int> y;
    y.insert(y.end(), p.begin(), p.begin() + cat[0]);
    y.insert(y.end(), p.begin() + cat[2], p.end());
    y.insert(y.end(), p.begin() + cat[1], p.begin() + cat[2]);
    y.insert(y.end(), p.begin() + cat[0], p.begin() + cat[1]);
    return y;
}

int main() {
    scanf("%d %d", &n, &soVong);
    vector<double> X(n), Y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    d.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) d[i][j] = hypot(X[i] - X[j], Y[i] - Y[j]);

    vector<int> x(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int cu = x.back(), tot = -1;
        for (int i = 0; i < n; i++) if (!dung[i] && (tot < 0 || d[cu][i] < d[cu][tot])) tot = i;
        dung[tot] = true; x.push_back(tot);
    }
    haiOpt(x);

    vector<int> best = x;
    double fCur = doDai(x), fBest = fCur;     // HAI biến: nơi đang đứng và kỷ lục
    for (int v = 0; v < soVong; v++) {
        vector<int> y = doubleBridge(x);      // nhiễu loạn
        haiOpt(y);                            // local search
        double fy = doDai(y);
        if (fy < fCur - 1e-9) { x = y; fCur = fy; }
        else if (unit() < 0.02) { x = y; fCur = fy; }
        if (fy < fBest - 1e-9) { fBest = fy; best = y; }   // BẮT BUỘC: cập nhật kỷ lục
    }
    for (int i = 0; i < n; i++) printf("%d%c", best[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Chỉ cần ba thành phần ngoài khung: một hàm double-bridge, một vòng lặp `soVong` lần, và hai biến `fCur` / `fBest`. Local search 2-opt đã có sẵn trong khung.",
        "Double-bridge: chọn ba điểm cắt khác nhau 1 ≤ a < b < c ≤ n−1, rồi ghép lại `p[0..a)`, `p[c..n)`, `p[b..c)`, `p[a..b)` (P1 P4 P3 P2). Nếu hai điểm cắt trùng nhau thì bốc lại.",
        "Mỗi vòng: `y = doubleBridge(x)`, 2-opt cho `y`, tính `fy`; nhận `y` làm điểm xuất phát nếu `fy < fCur` hoặc với xác suất 2 %; riêng kỷ lục thì cập nhật bất kể có nhận hay không (`fy < fBest`).",
        "Nếu điểm không hơn 2-opt chút nào: kiểm tra xem bạn có cập nhật `best` bằng `y` (bản sao!) hay chỉ cập nhật `x`; và `rng`/`mt19937` có thật sự được gọi mỗi vòng không."
      ]
    },
    {
      id: "chap-nhan",
      ten: "Mô phỏng tiêu chí chấp nhận: fCur và fBest",
      doKho: 1,
      ref: "§2.4, §2.6, §7 (cạm bẫy 4)",
      de: "Bài này không có hình học: ta chỉ mô phỏng **bộ não** của ILS để thấy tiêu chí chấp nhận khuyến nghị (§2.4) hoạt động ra sao và vì sao phải có hai biến `fCur`, `fBest` (§2.6).\n\n" +
          "**Đầu vào**: dòng 1 `V P` — số vòng và xác suất “nhận cả nghiệm không tốt hơn” tính bằng ‰ (bài giảng khuyến nghị 2–5 %, ở đây đặt `P = 30` tức 3 %). Dòng 2: `f0` — độ dài sau local search đầu tiên. Rồi `V` dòng `f u`: `f` là độ dài của x′ sau nhiễu loạn + local search ở vòng đó, `u` ∈ [0, 999] là số đã bốc cho vòng đó.\n\n" +
          "**Luật** (bài toán cực tiểu): ban đầu `fCur = fBest = f0`. Mỗi vòng: nếu `f < fCur` thì nhận (nhận *tốt*); ngược lại, nếu `u < P` thì cũng nhận (nhận *may rủi* — kể cả khi `f == fCur`, vì đẳng thức không phải “tốt hơn”). Khi nhận thì `fCur = f`. Việc nhận hay không **không ảnh hưởng** tới kỷ lục: nếu `f < fBest` thì `fBest = f` và ghi nhớ số thứ tự vòng.\n\n" +
          "**Đầu ra**: một dòng năm số — số lần nhận tốt, số lần nhận may rủi, `fCur` cuối, `fBest` cuối, số thứ tự vòng (từ 1) cải thiện `fBest` lần cuối (0 nếu chưa lần nào).\n\n" +
          "**Suy ngẫm**: đổi biến thể sang `P = 0` (chỉ nhận tốt hơn) và `P = 1000` (nhận tất). `fCur` cuối và `fBest` cuối khác nhau thế nào trong từng trường hợp? Nếu chương trình ILS của bạn trả về `fCur` thay vì `fBest` thì sai ở đâu?",
      vanDe: "b15-chap-nhan",
      tham: { V: 120, P: 30 },
      bienThe: [
        { ten: "P = 30‰ (khuyến nghị)", tham: { V: 120, P: 30 } },
        { ten: "P = 0 (chỉ nhận tốt hơn)", tham: { V: 120, P: 0 } },
        { ten: "P = 1000 (nhận tất)", tham: { V: 120, P: 1000 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "V P", rồi "f0", rồi V dòng "f u".
// Đầu ra : một dòng — soNhanTot soNhanMayRui fCur fBest vongBest
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const V = t[0], P = t[1], f0 = t[2];

let fCur = f0, fBest = f0;
let nhanTot = 0, nhanMayRui = 0, vongBest = 0;
for (let i = 0; i < V; i++) {
  const f = t[3 + 2 * i], u = t[4 + 2 * i];
  // TODO: nếu f < fCur → nhận (nhận tốt);
  //       ngược lại nếu u < P → nhận (nhận may rủi);
  //       RIÊNG kỷ lục: nếu f < fBest thì cập nhật fBest và vongBest = i + 1.
}
print(nhanTot, nhanMayRui, fCur, fBest, vongBest);
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const V = t[0], P = t[1], f0 = t[2];

let fCur = f0, fBest = f0;
let nhanTot = 0, nhanMayRui = 0, vongBest = 0;
for (let i = 0; i < V; i++) {
  const f = t[3 + 2 * i], u = t[4 + 2 * i];
  if (f < fCur) { fCur = f; nhanTot++; }                 // tốt hơn: luôn nhận
  else if (u < P) { fCur = f; nhanMayRui++; }            // may rủi (kể cả f == fCur)
  if (f < fBest) { fBest = f; vongBest = i + 1; }        // kỷ lục: độc lập với việc có nhận hay không
}
print(nhanTot, nhanMayRui, fCur, fBest, vongBest);
`
      },
      goiY: [
        "Hai biến, hai nhiệm vụ: `fCur` chỉ đổi khi nhận; `fBest` đổi bất cứ khi nào `f` nhỏ hơn nó.",
        "Nhánh “nhận may rủi” chỉ chạy khi `f < fCur` sai — nên `f == fCur` rơi vào nhánh này.",
        "Khi `P = 0` thì `fCur` luôn đơn điệu giảm và bằng `fBest`; khi `P = 1000` thì `fCur` bám theo vòng cuối cùng."
      ]
    }
  ]
});
