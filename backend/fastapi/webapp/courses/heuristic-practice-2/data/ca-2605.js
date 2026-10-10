/* Thực hành — Ca nghiên cứu 2605: Xếp bộ nhớ tensor (Dynamic Storage Allocation).
   Đọc hiểu và vận dụng; kèm một lab nhỏ dựng lại "cận dưới 20 dòng" của ca này bằng bài toán tự dựng (tiền tố ca2605-). */

/* Bài toán tự dựng: cận dưới tải trọng LB = max_t Σ size, thời điểm đầu tiên đạt LB, và baseline xếp nối tiếp. */
TH.vande.dangKy("ca2605-can-duoi", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var r = TH.tienIch.rng(seed), n = tham.n || 4000, T = r.khoang(2500, 5000), AL = [16, 32, 64, 128];
    var maxS = tham.kieu === "nho" ? r.khoang(1, 200) : tham.kieu === "lon" ? r.khoang(2000, 8192) : r.khoang(1, 8192);
    var t = [];
    for (var i = 0; i < n; i++) {
      var b = r.int(T - 1), d = 1 + r.int(500);
      t.push({ b: b, e: Math.min(T, b + d), s: 1 + r.int(maxS), a: AL[r.int(4)] });
    }
    return { n: n, T: T, t: t };
  },
  viet: function (inst) {
    var o = [inst.n + " " + inst.T];
    for (var i = 0; i < inst.n; i++) { var x = inst.t[i]; o.push(x.b + " " + x.e + " " + x.s + " " + x.a); }
    return o.join("\n") + "\n";
  },
  giai: function (inst) {
    /* Mảng sai phân theo thời gian (khác cách quét sự kiện của lời giải mẫu, để hai đường tính độc lập). */
    var d = new Array(inst.T + 2).fill(0), cur = 0, i;
    for (i = 0; i < inst.n; i++) {
      var x = inst.t[i];
      d[x.b] += x.s; d[x.e] -= x.s;
      cur = Math.ceil(cur / x.a) * x.a + x.s;
    }
    var tai = 0, lb = 0, tStar = 0;
    for (i = 0; i <= inst.T; i++) { tai += d[i]; if (tai > lb) { lb = tai; tStar = i; } }
    return [lb, tStar, cur];
  },
  saiSo: 0,
  dinhDang: {
    vao: "Dòng 1: `n T` — số tensor và `time_range`. Tiếp theo `n` dòng `b e s a`: tensor sống trong khoảng **nửa mở** `[b, e)`, kích thước `s` byte, căn chỉnh `a` ∈ {16, 32, 64, 128}.",
    ra: "Một dòng gồm ba số nguyên: `LB` (tải trọng lớn nhất theo thời gian), `tStar` (thời điểm nhỏ nhất đạt `LB`), `baseline` (xếp nối tiếp theo thứ tự gốc: `cur = align_up(cur, a); cur += s`)."
  }
}));

TH.dangKy({
  id: "ca-2605",

  tomTat: [
    "Bài 2605 (Tensor Buffer Planner) là Dynamic Storage Allocation: gán offset oᵢ cho N = 3 000–5 000 tensor có vòng đời [bᵢ, eᵢ) cố định, thoả căn chỉnh oᵢ ≡ 0 (mod aᵢ) và không chồng lấn địa chỉ khi trùng thời gian, sao cho peak = maxᵢ(oᵢ + sᵢ) nhỏ nhất. Điểm = 10⁶ × baseline / peak, baseline là hằng số của test.",
    "Nghiệm là một vector offset (họ gán nhãn, không phải hoán vị) nên 2-opt / Or-opt không dùng được. Cận dưới LB = max_t Σ size các tensor đang sống (quét sự kiện, ~20 dòng code) cho trần điểm 16 729 771: lời giải tham khảo (14 114 401, peak/LB = 1,1863) còn thua khoảng 18,5 %.",
    "Lời giải tham khảo là First-Fit theo thứ tự đầu vào vì hàm sortTensors() để rỗng. Chỉ điền chỉ số size giảm dần đã được +6,93 % — hai phần ba tổng cải thiện +10,27 %: đòn bẩy nằm ở chỉ số sắp xếp, không phải ở metaheuristic.",
    "Khoá sắp xếp tốt nhất: (−⌊2·log₂ align_up(size, align)⌋, start) — lớp kích thước tỉ lệ √2 giảm dần, trong lớp thì thời gian bắt đầu tăng dần (thuật toán cạnh trái, tối ưu khi cùng kích thước). Độ mịn có đỉnh rõ ở √2 (peak/LB 1,0734 trong bảng quét độ mịn riêng, không so trực tiếp với thang phiên bản); mịn hơn hay thô hơn đều kém.",
    "Portfolio 6 chiến lược (có nhiễu loạn ranh giới lớp) thêm +0,64 %: ngẫu nhiên hoá đúng chỗ không phá bất biến “lớn trước”. Kết quả cuối 15 563 974 điểm (+10,27 %, peak/LB 1,0752, 93,0 % trần, 0 vi phạm / 300 test, ~150 ms trên giới hạn 1 000 ms).",
    "Bốn thí nghiệm thất bại: “bump” không sắp xếp (peak/LB 1,10 → 1,67, chậm 4,5×); nén trọng lực (0 tensor di chuyển — là một định lý: First-Fit là cực trị cục bộ của lân cận “hạ một tensor”); LNS (xấu đi ở mọi vòng, thường cỡ 9 %, vì phá bất biến toàn cục); Best-Fit (kém First-Fit tới 3,2 % ở chỉ số size giảm dần, trung bình ba chỉ số thử ≈ 1,4 %).",
    "Ablation trên portfolio báo thiếu tới 55 lần: bỏ phân lớp kích thước chỉ −0,03 % ở 6 chiến lược nhưng −1,65 % ở 1 chiến lược. Quy tắc: thành phần dùng chung trong portfolio phải ablation ở cấu hình MỘT nhánh.",
    "Đối chiếu khoá học: giá trị nhất là Bài 5, 18, 12, 4 (kèm bổ sung điều kiện cho ablation) và 21; Bài 9, 11 (toán tử), 17 bị phản bác ở bài này; Bài 6, 10, 13, 14, 16 không áp dụng được. Biết bài học nào KHÔNG áp dụng cho bài toán trước mắt là kỹ năng khó nhất."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "01 §2",
      hoi: "Đề 2605 yêu cầu gán địa chỉ (offset) cho từng tensor. Mô tả nào đúng về bài toán?",
      chon: [
        "Nghiệm là một hoán vị thứ tự xử lý; ràng buộc cứng là tổng bộ nhớ không vượt một trần cho trước; mục tiêu là cực đại số tensor xếp được",
        "Nghiệm là vector offset oᵢ; ràng buộc cứng là oᵢ chia hết cho aᵢ và hai tensor sống trùng thời gian không được chồng địa chỉ; mục tiêu là cực tiểu địa chỉ cao nhất maxᵢ(oᵢ + sᵢ)",
        "Nghiệm là một đường đi qua mọi tensor; ràng buộc cứng là tổng thời gian không vượt 1 000 ms; mục tiêu là cực tiểu quãng đường",
        "Nghiệm là vector offset oᵢ; vòng đời của tensor cũng là biến quyết định, mục tiêu là cực tiểu tổng độ dài vòng đời"
      ],
      dung: 1,
      giaiThich: "Vòng đời [bᵢ, eᵢ) là dữ liệu cố định (chiều ngang của hình chữ nhật), không phải biến; ta chỉ chọn oᵢ (vị trí dọc). Hai ràng buộc cứng là căn chỉnh và không chồng lấn, vi phạm là mất điểm. Vì baseline là hằng số nên cực đại điểm ⟺ cực tiểu peak. Không có trần bộ nhớ cho trước (mục tiêu chính là cực tiểu hoá nó), không có thứ tự xử lý như một biến của đề, và 1 000 ms chỉ là giới hạn thời gian chạy chứ không phải mục tiêu."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "01 §2.2 · Bài 3, Bài 11",
      hoi: "Vì sao các toán tử kinh điển của Bài 11 (2-opt, Or-opt, swap, relocate) không dùng trực tiếp được ở bài 2605?",
      chon: [
        "Vì nghiệm là một vector offset (họ gán nhãn), không phải một dãy có thứ tự — không có “cạnh” để đảo hay đoạn để nhấc",
        "Vì bài này NP-khó mạnh nên mọi toán tử cục bộ đều vô dụng",
        "Vì ràng buộc chồng lấn cứng làm mọi nước đi đều không hợp lệ",
        "Vì giới hạn 1 000 ms quá ngắn để chạy bất kỳ vòng cải thiện nào"
      ],
      dung: 0,
      giaiThich: "Ở 2607 nghiệm là một dãy (họ hoán vị) nên 2-opt / Or-opt có nghĩa; ở 2605 nghiệm là phép gán giá trị oᵢ (họ gán nhãn, Bài 3). NP-khó không kéo theo toán tử vô dụng (TSP cũng NP-khó mà 2-opt vẫn rất hiệu quả, Bài 11); nhiều nước đi vẫn hợp lệ nếu còn khe trống; và 1 000 ms thậm chí rộng gấp 10 lần ngân sách của 2607 — đủ cho 6–10 lần dựng nghiệm."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "01 §4.3", donVi: "(đơn vị bộ nhớ)",
      hoi: "Năm tensor, mỗi tensor là (b, e, size) với khoảng sống nửa mở [b, e): T1 (0, 6, 40), T2 (2, 5, 70), T3 (4, 9, 50), T4 (5, 8, 90), T5 (8, 10, 30). Cận dưới LB = max_t Σ size của các tensor đang sống tại t là bao nhiêu?",
      dapAn: 180, saiSo: 0,
      giaiThich: "Tính tải tại từng thời điểm: t = 2–3 → 110; t = 4 → T1 + T2 + T3 = 160; t = 5 → T2 đã kết thúc (e = 5 nửa mở), còn T1 + T3 + T4 = 40 + 50 + 90 = 180; t = 6–7 → T3 + T4 = 140; t = 8 → T3 + T5 = 80. LB = 180. Nếu coi khoảng là đóng thì tại t = 5 cộng cả T2 và ra 250 — sai. Khi quét sự kiện, ở cùng một thời điểm phải xử lý sự kiện kết thúc (−size) trước sự kiện bắt đầu (+size)."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "01 §4.3 · Bài 18 §6",
      hoi: "Lời giải tham khảo có peak/LB = 1,1863 (14 114 401 điểm so với trần 16 729 771). Cách đọc đúng con số này theo Bài 18 là gì?",
      chon: [
        "Tham khảo đã ở 84,4 % trần; còn 18,5 % độ hở mà chắc chắn đạt được nếu có thuật toán đủ mạnh",
        "Cận dưới LB chính là nghiệm tối ưu, nên 18,5 % là khoảng cách chắc chắn tới tối ưu",
        "Khoảng cách 15–30 % là dấu hiệu heuristic xây dựng yếu — nên quay lại Phần 2 (chỉ số, chèn, GRASP) trước khi nghĩ tới metaheuristic; đồng thời LB bỏ qua căn chỉnh nên không phải toàn bộ khoảng này đạt được",
        "Khoảng cách trên 10 % nghĩa là mô hình hoá sai và phải làm lại từ Bài 1"
      ],
      dung: 2,
      giaiThich: "Bài 18 §6: khoảng cách 15–30 % ứng với “heuristic xây dựng yếu → quay lại Phần 2”; chỉ khi trên 30 % mới nghi mô hình hoá sai hoặc cận quá lỏng. Ở 2605 đúng như vậy: lời giải tốt đến từ đổi chỉ số sắp xếp (Bài 5), không phải metaheuristic. Nhưng LB không phải nghiệm tối ưu: nó bỏ qua lãng phí căn chỉnh và tính liên tục của dải địa chỉ, nên “chắc chắn đạt được” là quá mức (ở test max_size = 64, peak/LB của lời giải đề xuất là 1,40 mà nghiệm tối ưu thật có lẽ cũng chỉ quanh 1,3)."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "06 · Bài 6",
      hoi: "Một bạn muốn dùng giá mờ λ (quy 1 byte bộ nhớ ra điểm) để chấm ứng viên khi đặt tensor, như đã làm rất hiệu quả ở bài 2607. Vì sao ở 2605 hướng này không có chỗ dùng?",
      chon: [
        "Vì bộ nhớ không thể quy đổi ra điểm",
        "Vì λ chỉ ước lượng được khi N nhỏ hơn 1 000",
        "Vì baseline là hằng số nên hàm mục tiêu không phụ thuộc vào nghiệm",
        "Vì mọi tensor phải được đặt (không được bỏ ai) và không có trần bộ nhớ cho trước: mục tiêu chính là cực tiểu hoá chính tài nguyên đó, nên không có ràng buộc ngân sách nào để nới lỏng"
      ],
      dung: 3,
      giaiThich: "Nới lỏng Lagrange cần một ràng buộc bất đẳng thức có thể vi phạm và việc vi phạm phải quy đổi được thành chi phí. Dấu hiệu nhận biết nhanh: bài yêu cầu “xếp HẾT mọi thứ vào chỗ nhỏ nhất” thì không dùng giá mờ; bài yêu cầu “chọn NHIỀU NHẤT trong hạn mức” thì dùng (2607). Baseline là hằng số nhưng peak vẫn phụ thuộc nghiệm, và N không liên quan đến việc có hay không ràng buộc ngân sách."
    },
    {
      id: "q6", loai: "so", doKho: 3, ref: "03 §2.4, §4",
      hoi: "Khoá phân lớp của lời giải đề xuất là ⌊2·log₂(eff)⌋ với eff = align_up(size, align) (làm tròn lên bội của align). Tensor có size = 2 880, align = 128 thì khoá lớp bằng bao nhiêu? (Tính bằng số nguyên: b = ⌊log₂ eff⌋, lớp = 2b + 1 nếu eff² ≥ 2·4ᵇ, ngược lại 2b.)",
      dapAn: 23, saiSo: 0,
      giaiThich: "eff = 2 944 (= 128 × 23). b = 11 vì 2¹¹ = 2 048 ≤ 2 944 < 4 096. eff² = 8 667 136 ≥ 2·4¹¹ = 8 388 608 nên lớp = 2·11 + 1 = 23. Nếu quên eff và dùng size = 2 880: 2 880² = 8 294 400 < 8 388 608 nên ra lớp 22 — tensor rơi sang lớp bên cạnh. Đó là lý do kích thước hiệu dụng được đưa vào chỉ số, nhất là ở chế độ kích thước nhỏ nơi align át size."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "03 §3 · Bài 11 §4",
      hoi: "Ở 2605, First-Fit thắng Best-Fit ở cả ba chỉ số sắp xếp thử (hơn 3,2 % ở chỉ số size giảm dần, trung bình ba chỉ số ≈ 1,4 %), trong khi XLA dùng best-fit và ở bài đóng thùng cổ điển Best-Fit thường thắng. Lý giải nào đúng nhất?",
      chon: [
        "First-Fit chạy nhanh hơn nên còn thời gian để chạy portfolio",
        "Best-Fit vi phạm ràng buộc căn chỉnh nên bị phạt điểm",
        "Mục tiêu ở đây là địa chỉ cao nhất: First-Fit luôn đẩy tensor xuống địa chỉ thấp nhất có thể (đúng đại lượng của mục tiêu), còn Best-Fit tối ưu phần thừa trong khe — có thể chọn khe ở địa chỉ cao chỉ vì khít hơn",
        "First-Fit luôn tốt hơn Best-Fit trong mọi bài toán đóng gói"
      ],
      dung: 2,
      giaiThich: "Đây là ví dụ sách giáo khoa của “tối ưu hoá thành phần ≠ tối ưu hoá tổng thể” (Bài 11 §4): mục tiêu là peak, First-Fit tối ưu đúng địa chỉ, Best-Fit tối ưu một đại lượng không liên quan. Mục tiêu khác thì kết luận đảo ngược (đóng thùng cổ điển: mục tiêu là số thùng). XLA dùng best-fit cho phân bố tensor của mạng thật, còn init() của đề sinh dữ liệu ngẫu nhiên — không mâu thuẫn, chỉ là nhắc “đo trên chính phân bố dữ liệu của bạn”. Hai phương án đầu không có cơ sở (Best-Fit không phá căn chỉnh; tốc độ không phải lý do)."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "03 §7.3 · Bài 17 §8",
      hoi: "LNS (bỏ ~900 tensor giao thời gian với tensor tạo peak rồi xây lại theo size giảm dần) làm peak xấu đi ở mọi vòng trên mọi test (thường cỡ 9 %), trong khi ở bài P2 của khoá (Bài 17 §8) LNS cho +3,0 % so với chèn toàn cục. Nguyên nhân là gì?",
      chon: [
        "Cài đặt LNS ở 2605 có lỗi; sửa lỗi thì LNS sẽ cải thiện",
        "Ở 2605 chưa chạy đủ số vòng lặp nên chưa có nước đi nào được chấp nhận",
        "Toán tử xây lại dùng First-Fit trong khi LNS chỉ hợp với Best-Fit",
        "Chất lượng nghiệm ở 2605 đến từ một bất biến toàn cục (tensor lớn đặt trước tensor nhỏ): phá một tập con thì các tensor nhỏ được giữ lại thành chướng ngại cố định, buộc tensor lớn luồn lách — đúng ngược FFD. Ở bài P2 của khoá nghiệm là tuyến đường có cấu trúc cục bộ nên phá và xây lại không làm vỡ gì"
      ],
      dung: 3,
      giaiThich: "Mọi vòng đều xấu đi, không có vòng nào được chấp nhận — đây là hệ thống chứ không phải ngẫu nhiên hay thiếu vòng lặp. “Toán tử phá của LNS phá vỡ chính bất biến tạo nên chất lượng.” Điều kiện áp dụng cần nhớ: LNS chỉ hiệu quả khi chất lượng nghiệm có cấu trúc cục bộ. Cách kiểm trong 10 phút: phá rồi xây lại một lần, in mục tiêu trước và sau; nếu xấu đi có hệ thống thì dừng. Chuyện Best-Fit tệ hơn First-Fit là kết quả riêng (q7), không liên quan tới lý do LNS thất bại."
    },
    {
      id: "q9", loai: "nhieu", doKho: 3, ref: "03 §7.2 · Bài 9, Bài 12",
      hoi: "Phép “nén trọng lực” (kéo từng tensor xuống vị trí hợp lệ thấp nhất) không di chuyển được tensor nào, trên mọi test case. Những phát biểu nào đúng?",
      chon: [
        "Đó là một định lý: khi đặt tensor i, First-Fit chọn địa chỉ thấp nhất khả dụng đối với tập chướng ngại Bᵢ; sau khi đặt hết, tập chướng ngại chỉ lớn thêm (Bᵢ′ ⊇ Bᵢ) nên địa chỉ thấp nhất khả dụng chỉ có thể lớn hơn hoặc bằng",
        "Đây là lỗi cài đặt của bộ nén; cho phép chấp nhận nước đi xấu hơn (như Simulated Annealing) chắc chắn sẽ cải thiện nghiệm",
        "Nghiệm First-Fit theo một thứ tự cố định luôn là cực trị cục bộ của lân cận “hạ một tensor” — cực trị cục bộ là tính chất của cặp (bài toán, lân cận)",
        "Lân cận có tác dụng ở bài này nằm trong không gian tham số của thuật toán xây dựng (khoá sắp xếp), nên portfolio / GRASP hợp hơn local search trên offset",
        "Kết quả chỉ đúng với test có max_size nhỏ; với max_size lớn thì nén trọng lực vẫn di chuyển được nhiều tensor"
      ],
      dung: [0, 2, 3],
      giaiThich: "Ba phát biểu đúng gói trọn bài học: định lý Bᵢ′ ⊇ Bᵢ; cực trị cục bộ là tính chất của cặp (bài toán, lân cận) nên muốn thoát phải đổi lân cận; và lân cận hiệu quả ở đây là “đổi khoá sắp xếp”. Phát biểu về SA không có cơ sở: tài liệu không thử SA vì lân cận “di chuyển một tensor” không có nước cải thiện, nước xấu đi thì đẩy tensor lên cao mà mọi tensor khác đã cố định, và đánh giá một nước tốn O(K) với K ≈ 250 chứ không có delta rẻ. Phát biểu cuối sai: kết quả là 0 tensor di chuyển (0 / N) ở mọi test và là định lý, không phụ thuộc max_size."
    },
    {
      id: "q10", loai: "mot", doKho: 3, ref: "03 §8.1 · Bài 4 §5",
      hoi: "Bạn ablation một thành phần được dùng chung bởi nhiều chiến lược trong portfolio: bỏ nó khỏi cấu hình đầy đủ 6 chiến lược thì điểm gần như không đổi (−0,03 %). Nên kết luận và làm gì?",
      chon: [
        "Nghi ngờ hiệu ứng bù trừ (các chiến lược còn lại vẫn mang ý tưởng đó) và đo lại ở cấu hình MỘT chiến lược — ở đây số đo đó là −1,65 %, gấp 55 lần",
        "Thành phần vô dụng — xoá ngay, vì đóng góp xấp xỉ 0 %",
        "Tăng số test case lên 10 lần rồi đo lại ở cấu hình 6 chiến lược; chỉ khi vẫn xấp xỉ 0 mới xoá",
        "Tăng số chiến lược trong portfolio lên 10 để thành phần này có thêm cơ hội phát huy"
      ],
      dung: 0,
      giaiThich: "Portfolio hoạt động như bộ giảm chấn: khi tắt thành phần ở một chiến lược thì năm chiến lược còn lại vẫn mang ý tưởng đó và “lấy tốt nhất trong 6” tự bù. Nếu xoá theo số đo 6 chiến lược, ta xoá mất thành phần quan trọng nhất. Tăng số test chỉ giảm nhiễu, không loại được thiên lệch do bù trừ; tăng số chiến lược còn che mờ thêm. Quy tắc: ablation thành phần dùng chung trong portfolio / khởi động lại nhiều lần / ensemble phải đo ở cấu hình một nhánh."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "00 §3 · Bài 20",
      hoi: "Giả sử bạn nhận đề 2605 mà chưa biết lời giải. Hãy trình bày năm bước đầu của quy trình 8 bước (① đọc mã grader, ② mô hình hoá, ③ dựng bộ chấm, ④ nghiệm cơ sở, ⑤ cận) và nói ở mỗi bước bạn thu được điều gì cụ thể.",
      goiY: [
        "Bước ① cho ra sáu quan sát từ mã grader; hãy nhớ ít nhất ba (max_size rút một lần, offset là bội của 16, baseline là hằng số, một vi phạm mất tất cả…).",
        "Bước ⑤ sinh lời nhất của cả ca này và chỉ tốn khoảng 20 dòng code."
      ],
      mau: "1. **① Đọc mã grader.** Rút ra sáu quan sát: max_size rút một lần cho cả test ⇒ hai chế độ dữ liệu (kích thước lớn / nhỏ); mọi offset là bội của 16; baseline là hằng số ⇒ cực đại điểm ⟺ cực tiểu peak; một vi phạm làm mất toàn bộ điểm; mảng “canh gác” chiếm ~8 MB; thời gian 1 000 ms rất rộng ⇒ chạy được 6–10 chiến lược.\n2. **② Mô hình hoá.** (S, C, f): S = vector offset; C = căn chỉnh + không chồng lấn (cứng); f = peak. Nhận ra đây là Dynamic Storage Allocation ⇒ mở ra tài liệu (LOAD, thuật toán cạnh trái, MiniMalloc), biết trước ILP không khả thi, và biết nghiệm thuộc họ gán nhãn nên 2-opt không áp dụng.\n3. **③ Bộ chấm cục bộ — dựng TRƯỚC khi viết thuật toán.** Sao chép nguyên văn pseudo_rand, init, compute_baseline, verify; thêm cận dưới, cờ vi phạm có lý do, bộ kiểm chồng lấn bằng sweep (đối chiếu với bản O(N²) nguyên văn), đo thời gian từng test.\n4. **④ Nghiệm cơ sở.** Chép lời giải tham khảo: 14 114 401 điểm/test, peak/LB = 1,1863.\n5. **⑤ Cận.** LB = max_t Σ size bằng quét sự kiện ⇒ trần 16 729 771 ⇒ tham khảo còn thua khoảng 18,5 %: con số biện minh cho việc đầu tư tiếp. (Về sau chẩn đoán còn cho thấy lãng phí căn chỉnh chỉ ≈ 1 % peak — trung bình trên 10 test đầu, riêng chế độ kích thước nhỏ là ngoại lệ — nên không đáng tối ưu thêm alignment.)",
      tieuChi: [
        "Nêu đúng năm bước theo thứ tự ① → ⑤",
        "Ở bước ① nêu ít nhất ba quan sát rút từ mã grader (không chỉ từ lời đề)",
        "Ở bước ② viết được (S, C, f) và gọi đúng tên họ bài toán (Dynamic Storage Allocation / họ gán nhãn)",
        "Ở bước ③ nhấn mạnh dựng bộ chấm trước khi viết thuật toán và đối chiếu bộ kiểm tra tự viết với bản gốc",
        "Ở bước ⑤ nêu cận dưới = max_t Σ size và dùng nó để nói độ hở còn bao nhiêu"
      ]
    },
    {
      id: "l2", doKho: 3, ref: "03 §6.5 · Bài 20 §10",
      hoi: "Bảng chọn số chiến lược của portfolio: 1 → 15 465 394 điểm (25 ms trung bình, 60 ms xấu nhất); 6 → 15 563 974 (153 ms, 389 ms); 8 → 15 578 117 (214 ms, 611 ms); 10 → 15 581 433 (252 ms, 621 ms). Giới hạn là 1 000 ms mỗi test và một vi phạm làm mất toàn bộ điểm. Bạn chọn bao nhiêu chiến lược, vì sao, và chuẩn bị gì phòng khi máy chấm chậm hơn?",
      goiY: [
        "Tính lợi ích biên: đi từ 6 lên 10 chiến lược thêm bao nhiêu phần trăm điểm? Hệ số an toàn theo trường hợp xấu nhất là bao nhiêu?",
        "Bài 20 §10.2: cấu hình dự phòng nên chỉnh được bằng một dòng."
      ],
      mau: "Lợi ích biên giảm rất nhanh: 1 → 6 chiến lược thêm +0,64 %, 6 → 8 chỉ +0,09 %, 8 → 10 chỉ +0,02 %. Trong khi đó hệ số an toàn thời gian (1 000 ms ÷ trường hợp xấu nhất) tụt từ 2,6× (389 ms) xuống 1,6× (611 và 621 ms). Từ 6 lên 10 chiến lược chỉ được thêm ≈ 0,11 % điểm mà chỉ còn dư 1,6× — nếu máy chấm chậm hơn 1,6× là chạm giới hạn.\n\nTheo tinh thần “an toàn quan trọng hơn vài phần trăm điểm”, chọn **6 chiến lược** (15 563 974 điểm, an toàn 2,6× theo xấu nhất). Dự phòng: đặt sẵn macro NSTRAT, đổi một dòng sang 2 chiến lược — 15 501 631 điểm (−0,40 %) trong 58 ms trung bình (xấu nhất 229 ms, an toàn 4,4×) — để bật khi nghi ngờ máy chấm chậm. Nên đo thời gian bằng nhiều lần chạy rồi lấy giá trị nhỏ nhất, vì máy phát triển có tải nền dao động.",
      tieuChi: [
        "Tính được lợi ích biên giảm dần (từ 6 lên 10 chiến lược chỉ thêm khoảng 0,11 %)",
        "Nêu hệ số an toàn theo trường hợp xấu nhất (2,6× so với 1,6×), không chỉ theo trung bình",
        "Chọn một con số có lập luận (6 chiến lược) gắn với nguyên tắc an toàn hơn vài phần trăm điểm",
        "Nêu cấu hình dự phòng bật bằng một dòng (NSTRAT = 2: −0,40 %, 58 ms)"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "03 §7, §12 · Bài 9, Bài 12, Bài 17",
      hoi: "Một người đọc nói: “Nén trọng lực không di chuyển được tensor nào, LNS thì xấu đi 9 %, vậy mọi kỹ thuật cải thiện nghiệm đều vô dụng ở 2605.” Phát biểu này đúng đến đâu? Hãy chỉ ra phần đúng, phần nói quá, và còn hướng nào (theo tài liệu) có thể thu hẹp 7,5 % khoảng cách còn lại.",
      goiY: [
        "Định lý chỉ nói về một lân cận cụ thể trên một loại nghiệm cụ thể (First-Fit, thứ tự cố định).",
        "Bài 12: cực trị cục bộ là tính chất của cặp (bài toán, lân cận). Hãy thử đổi lân cận."
      ],
      mau: "**Phần đúng.** Với nghiệm First-Fit theo thứ tự cố định, lân cận “hạ một tensor” có đúng 0 nước cải thiện (định lý Bᵢ′ ⊇ Bᵢ); lân cận lớn hơn kiểu LNS “phá một lát thời gian rồi xây lại” còn tệ hơn (thường cỡ −9 %) vì phá vỡ bất biến toàn cục “lớn trước nhỏ”. Còn 2-opt/Or-opt thì không có nghĩa vì nghiệm là vector offset.\n\n**Phần nói quá.** “Mọi kỹ thuật cải thiện” là suy rộng. Tài liệu mới thử hai lân cận trong không gian offset (hạ một tensor; phá một lát thời gian). Và chính tài liệu chỉ ra một lân cận hiệu quả: **đổi thứ tự xử lý**, nằm trong không gian tham số của thuật toán xây dựng chứ không trong không gian offset — portfolio / GRASP khai thác đúng lân cận này (+0,64 %), và việc quét chỉ số sắp xếp cho phần lớn +10,27 %.\n\n**Hướng còn lại (§12).** (1) Tìm kiếm nhị phân trên peak + đặt có trần với cơ chế hoãn tensor không vừa — thay đổi thứ tự thích nghi mà không phá bất biến “lớn trước”, ước tính +1–2 %; (2) đặt hai phía (two-sided packing, ý tưởng gần với các bộ giải bin-packing hai phía); (3) chuyên biệt hoá cho chế độ kích thước nhỏ, kèm một cận dưới có tính đến căn chỉnh. Phù hợp với bài học: muốn thoát cực trị cục bộ thì **đổi lân cận hoặc đổi chỗ tìm kiếm**, đừng tinh chỉnh lân cận cũ.",
      tieuChi: [
        "Phân biệt đúng: định lý chỉ áp dụng cho lân cận “hạ một tensor” trên nghiệm First-Fit; LNS thất bại vì phá bất biến toàn cục",
        "Chỉ ra lân cận hiệu quả nằm trong không gian tham số của thuật toán xây dựng (đổi khoá sắp xếp → portfolio / GRASP), nên “mọi kỹ thuật” là nói quá",
        "Nêu ít nhất một hướng còn mở có cơ sở trong tài liệu (đặt có trần + hoãn, đặt hai phía, chuyên biệt hoá chế độ kích thước nhỏ)"
      ]
    }
  ],

  lab: [
    {
      id: "can-duoi-load",
      ten: "Cận dưới tải trọng LOAD — “20 dòng” của ca 2605",
      doKho: 2,
      ref: "01 §3.3, §4.3 · Bài 18",
      de: "Ở ca 2605, cận dưới `LB = max_t Σ size` (các tensor đang sống tại `t`) chỉ tốn khoảng 20 dòng code nhưng quyết định cả hướng đi: nó cho thấy lời giải tham khảo còn thua ≈ 18,5 %. Hãy tự dựng nó.\n\n" +
          "Đầu vào: dòng 1 `n T`; tiếp theo `n` dòng `b e s a` — tensor sống trong khoảng **nửa mở** `[b, e)`, kích thước `s`, căn chỉnh `a` ∈ {16, 32, 64, 128}. Ở lab `n = 4 000` (đề thật 3 000–5 000). Chấm trên 10 bộ dữ liệu.\n\n" +
          "Đầu ra: **một dòng ba số nguyên** — `LB`; `tStar` là thời điểm nhỏ nhất mà tải trọng đạt `LB`; và `baseline` là vị trí kết thúc khi xếp nối tiếp theo thứ tự gốc (với mỗi tensor: `cur = align_up(cur, a); cur += s`). Điểm trần của test là 10⁶ × baseline / LB.\n\n" +
          "Gợi ý ý tưởng: quét sự kiện — mỗi tensor sinh `(b, +s)` và `(e, −s)`; vì `[b, e)` nửa mở nên ở cùng một thời điểm sự kiện kết thúc phải được xử lý **trước** sự kiện bắt đầu. Sau khi qua, đổi sang biến thể *kích thước nhỏ* (max_size ≤ 200): `baseline / LB` vọt lên vì căn chỉnh chi phối, còn `LB` bỏ qua căn chỉnh — hãy giải thích vì sao cận này ở chế độ đó lỏng (01 §3.1, §4.3).",
      vanDe: "ca2605-can-duoi",
      tham: { n: 4000 },
      bienThe: [
        { ten: "Như đề (max_size ngẫu nhiên 1–8 192)", tham: { n: 4000 } },
        { ten: "Kích thước nhỏ (max_size ≤ 200)", tham: { n: 4000, kieu: "nho" } },
        { ten: "Kích thước lớn (max_size ≥ 2 000)", tham: { n: 4000, kieu: "lon" } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n T"; rồi n dòng "b e s a" (khoảng sống nửa mở [b, e)).
// Đầu ra : một dòng "LB tStar baseline".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
let lb = 0, tStar = 0, baseline = 0;
for (let i = 0; i < n; i++) {
  const b = t[2 + 4 * i], e = t[3 + 4 * i], s = t[4 + 4 * i], a = t[5 + 4 * i];
  // TODO: ghi sự kiện (b, +s) và (e, -s); cập nhật baseline: cur = align_up(cur, a) + s
}
// TODO: sắp sự kiện (kết thúc trước bắt đầu ở cùng thời điểm), cộng dồn tải, tìm LB và tStar

print(lb + " " + tStar + " " + baseline);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T;
    scanf("%d %d", &n, &T);
    long long lb = 0, baseline = 0;
    int tStar = 0;
    for (int i = 0; i < n; i++) {
        int b, e, s, a;
        scanf("%d %d %d %d", &b, &e, &s, &a);
        // TODO: ghi sự kiện (b, +s) và (e, -s); cập nhật baseline: cur = align_up(cur, a) + s
    }
    // TODO: sắp sự kiện (kết thúc trước bắt đầu ở cùng thời điểm), cộng dồn tải, tìm lb và tStar

    printf("%lld %d %lld\n", lb, tStar, baseline);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const ev = [];
let cur = 0;
for (let i = 0; i < n; i++) {
  const b = t[2 + 4 * i], e = t[3 + 4 * i], s = t[4 + 4 * i], a = t[5 + 4 * i];
  ev.push([b, s]);
  ev.push([e, -s]);
  cur = Math.ceil(cur / a) * a + s;                 // baseline: xếp nối tiếp theo thứ tự gốc
}
// Cùng thời điểm: delta âm (kết thúc) đứng trước delta dương (bắt đầu) vì khoảng nửa mở [b, e).
ev.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
let tai = 0, lb = 0, tStar = 0;
for (const [tm, d] of ev) {
  tai += d;
  if (tai > lb) { lb = tai; tStar = tm; }
}
print(lb + " " + tStar + " " + cur);
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T;
    scanf("%d %d", &n, &T);
    vector<pair<int, int>> ev;
    ev.reserve(2 * n);
    long long cur = 0;
    for (int i = 0; i < n; i++) {
        int b, e, s, a;
        scanf("%d %d %d %d", &b, &e, &s, &a);
        ev.push_back({b, s});
        ev.push_back({e, -s});
        cur = (cur + a - 1) / a * a + s;             // baseline: align_up rồi cộng kích thước
    }
    sort(ev.begin(), ev.end());                       // cùng thời điểm: delta âm (kết thúc) đứng trước delta dương
    long long tai = 0, lb = 0;
    int tStar = 0;
    for (auto &x : ev) {
        tai += x.second;
        if (tai > lb) { lb = tai; tStar = x.first; }
    }
    printf("%lld %d %lld\n", lb, tStar, cur);
    return 0;
}
`
      },
      goiY: [
        "Mỗi tensor sinh hai sự kiện (b, +s) và (e, −s). Sắp theo (thời điểm, delta) để ở cùng một thời điểm sự kiện kết thúc (delta âm) đứng trước sự kiện bắt đầu.",
        "Duyệt sự kiện theo thứ tự, cộng dồn tải trọng; LB là giá trị lớn nhất từng gặp, tStar là thời điểm đầu tiên đạt giá trị đó.",
        "baseline tính riêng theo thứ tự gốc: cur = align_up(cur, a) + s, với align_up(x, a) = ⌈x / a⌉ · a. Dùng long long trong C++."
      ]
    }
  ]
});
