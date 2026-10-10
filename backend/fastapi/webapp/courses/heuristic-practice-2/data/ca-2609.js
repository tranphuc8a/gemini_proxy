/* Thực hành — Ca nghiên cứu 2609: Entropy của vũ trụ.
   Đọc hiểu và vận dụng; kèm một lab nhỏ dựng lại "Quan sát 2" của ca này: entropy = F(hàng) + F(cột) trong O(H + W + N). */

/* Bài toán tự dựng: entropy theo công thức biên duyên. Tiền tố ca2609-. */
TH.vande.dangKy("ca2609-entropy", TH.vande.tuDapAn({
  sinh: function (seed, tham) {
    tham = tham || {};
    var r = TH.tienIch.rng(seed), H = tham.H || 320, W = tham.W || 320, p = tham.p || 0.5, ys = [], xs = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (r() < p) { ys.push(y); xs.push(x); }
    return { H: H, W: W, n: ys.length, ys: ys, xs: xs };
  },
  viet: function (inst) {
    var o = [inst.H + " " + inst.W + " " + inst.n];
    for (var i = 0; i < inst.n; i++) o.push(inst.ys[i] + " " + inst.xs[i]);
    return o.join("\n") + "\n";
  },
  giai: function (inst) {
    var rr = new Array(inst.H).fill(0), cc = new Array(inst.W).fill(0), i, N = inst.n;
    for (i = 0; i < N; i++) { rr[inst.ys[i]]++; cc[inst.xs[i]]++; }
    function F(v) { var S = 0, s = 0; for (var t = 0; t < v.length - 1; t++) { S += v[t]; s += S * (N - S); } return s; }
    var fr = F(rr), fc = F(cc);
    return [fr, fc, fr + fc];
  },
  saiSo: 0,
  dinhDang: {
    vao: "Dòng 1: `H W N` — kích thước lưới và số hạt. Tiếp theo `N` dòng `y x` — toạ độ một hạt (`0 ≤ y < H`, `0 ≤ x < W`, mọi ô khác nhau).",
    ra: "Một dòng ba số nguyên `F(r) F(c) E`: entropy theo trục hàng, theo trục cột và tổng `E = F(r) + F(c)` (có thể vượt 2³¹ — dùng số nguyên 64 bit)."
  }
}));

TH.dangKy({
  id: "ca-2609",

  tomTat: [
    "Bài 2609 (Entropy của vũ trụ): lưới H × W (80–180 mỗi chiều), N hạt (mật độ p = 0,3–0,5), mỗi nước đi dịch một hạt sang ô kề còn trống, hạn mức L = 40·H·W nước. SCORE = ⌊10⁶ρ²⌋ + ⌊(L − m)/100⌋ với ρ = (E₀ − E₁)/E₀ và entropy E = tổng khoảng cách Manhattan của mọi cặp hạt.",
    "Quan sát then chốt: entropy tách theo hai trục, E = F(r) + F(c) với F(v) = Σ S_t·(N − S_t) (S_t là tổng tiền tố của biên duyên hàng hoặc cột). Tính trong O(H + W + N) thay vì O(N²) — nhanh cỡ 10⁴ lần — và E chỉ phụ thuộc hai biên duyên, không phụ thuộc hạt nằm ở đâu (bất biến tịnh tiến).",
    "Bài toán rút gọn thành hai bài con độc lập: (A) chọn cặp biên duyên khả thi (R, C) cực tiểu F(R) + F(C) — quyết định gần như 100 % điểm; (B) vận tải đưa cấu hình về (R, C), không va chạm, trong ngân sách — chỉ cần làm đúng vì ngân sách dư gấp đôi. Lời giải k-means trộn hai việc làm một nên không giải tốt việc nào.",
    "Lời giải hiện tại (k-means v3: 151 123 điểm, ρ = 0,3797) vừa chậm vừa sai mô hình: entropy O(N²) gọi 10 lần làm 17 % test vượt 1 000 ms (xấu nhất 3 331 ms); quét k = 1..5 vô ích vì k = 1 luôn thắng; hạt bị chặn bị bỏ rơi. v1/v2 chỉ bằng điểm của process() rỗng vì int move() thiếu return (hành vi không xác định).",
    "Bài A giải bằng Frank–Wolfe: nới lỏng 0/1 thành mật độ liên tục là chặt vì J lõm (cực tiểu đạt ở đỉnh), gradient tách thành ψ_Y(y) + ψ_X(x) tính bằng tổng tiền tố. Hình tối ưu là đĩa tròn (κ = 0,6502), không phải hình vuông (0,6668) hay kim cương (0,6598): đổi hình đích đáng +7 % đến +12 % điểm.",
    "Bài B giải bằng vận tải hai pha: pha dọc sửa biên duyên hàng, pha ngang sửa biên duyên cột; ghép cặp đơn điệu (lùi trước, tới sau) bảo đảm mọi ô đích đều rỗng, gán đích bằng tham lam Gale–Ryser. Kết quả 0 nước đi hỏng trên 2 000 test, chi phí thực khoảng 1,205× cận dưới vận tải.",
    "Kết quả: 161 205 điểm (+6,67 % so với v3), 9,6 ms trung bình, 0 test vượt hạn. Ngân sách chỉ dùng 31 % (tối đa 46 %) — ràng buộc thật là hình học và mật độ: ρ* ≈ 1 − 0,9755·√p. Trên 1 000 test đạt 160 933 so với cận 161 318 (99,76 %); dư địa còn lại ~0,25 %.",
    "Bài học khoá: mô hình hoá đúng (Bài 1) quan trọng hơn thuật toán; cực trị cục bộ là tính chất của cặp (bài toán, lân cận) (Bài 12) nên “gom cụm + kéo hạt” chạm trần ρ ≈ 0,38; cận chặt (Bài 18) cho biết khi nào dừng; luôn dịch với -Wall -Wextra ở cả -O0 và -O2 vì hành vi không xác định có thể im lặng."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "01 · Quan sát 1",
      hoi: "Trong bộ chấm của 2609, một lời gọi moveParticle(y, x, dir) bị từ chối (ô nguồn rỗng, ô đích bị chặn hoặc ra ngoài biên) có tốn ngân sách L không?",
      chon: [
        "Không: nước đi hỏng bị bỏ qua nên chỉ nước hợp lệ mới làm tăng bộ đếm",
        "Chỉ nước đi ra ngoài biên mới tốn; nước bị chặn thì không",
        "Có: bộ đếm tăng trước mọi kiểm tra hợp lệ, nên “cứ thử, bị chặn thì thôi” trả đúng giá ngân sách như một nước đi chuẩn — phải chứng minh mỗi nước hợp lệ trước khi gọi",
        "Có, và còn bị trừ thêm một khoản phạt cố định vào SCORE"
      ],
      dung: 2,
      giaiThich: "Mã bộ chấm làm sMoveCount++ ngay sau khi kiểm tra hạn mức và trước mọi kiểm tra biên, ô nguồn, ô đích. Hệ quả: thuật toán “thử rồi tính” tốn ngân sách y hệt thuật toán đi chuẩn, nên lời giải tốt phải chứng minh tính hợp lệ của từng nước trước khi gọi (lời giải đề xuất: 0 nước hỏng trên 2 000 test). Không có khoản phạt riêng: nước hỏng chỉ ảnh hưởng qua số m trong thưởng ⌊(L − m)/100⌋."
    },
    {
      id: "q2", loai: "so", doKho: 2, ref: "01 · Quan sát 2", donVi: "(đơn vị entropy)",
      hoi: "Sáu hạt ở các ô (y, x): (0,0), (0,2), (1,1), (3,1), (2,3), (3,3). Entropy E là tổng khoảng cách Manhattan của mọi cặp hạt (15 cặp). Dùng công thức biên duyên E = F(r) + F(c), với F(v) = Σ S_t·(N − S_t) trên các tổng tiền tố S_t (bỏ tổng cuối cùng), E bằng bao nhiêu?",
      dapAn: 47, saiSo: 0,
      giaiThich: "Biên duyên hàng r = (2, 1, 1, 2) (hàng y = 0, 1, 2, 3) ⇒ S = 2, 3, 4 ⇒ F(r) = 2·4 + 3·3 + 4·2 = 25. Biên duyên cột c = (1, 2, 1, 2) ⇒ S = 1, 3, 4 ⇒ F(c) = 1·5 + 3·3 + 4·2 = 22. Vậy E = 25 + 22 = 47 — khớp với việc cộng tay cả 15 cặp. Lý do công thức đúng: |yᵢ − yⱼ| bằng số “lát cắt” nằm giữa hai hạt; mỗi lát cắt t chứa đúng S_t·(N − S_t) cặp bắc qua nó. Chi phí O(H + W + N) thay vì O(N²)."
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "02 · B2",
      hoi: "Phiên bản k-means v3 vượt 1 000 ms ở 17 % test case (xấu nhất 3 331 ms; seed xấu nhất 7 183 ms với N = 15 905). Nguyên nhân chính và cách chữa đúng là gì?",
      chon: [
        "Merge sort các hạt theo khoảng cách chậm; thay bằng std::sort",
        "k-means chưa hội tụ nên lặp quá nhiều vòng; thêm điều kiện dừng",
        "Phát lại nước đi qua mảng đệm 15,5 MB; thu nhỏ mảng đó",
        "calculateEntropy() là O(N²) và bị gọi 10 lần (k = 1..5, mỗi k gọi hai lần); thay bằng công thức biên duyên O(H + W + N) và bỏ vòng k = 2..5 vô ích"
      ],
      dung: 3,
      giaiThich: "N²/2 = 1,26 × 10⁸ phép mỗi lần gọi, nhân 10 lần ≈ 1,26 × 10⁹ phép: trên seed 1015 mất 7 183 ms, gấp 7,2 lần giới hạn. Công thức biên duyên (Quan sát 2) xoá nút thắt này. Merge sort và mảng đệm 15,5 MB là điểm trừ khi review nhưng chỉ ở mức “nhẹ”; còn “k-means” ở đây thực ra chỉ duyệt một lượt, không có vòng hội tụ nào để dừng."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "02 · B3 · Bài 1",
      hoi: "Vòng quét k = 1..5 của k-means v3 chiếm ~4/5 thời gian chạy nhưng k = 1 thắng ở mọi test. Vì sao chia hạt thành k > 1 cụm luôn tệ hơn một khối duy nhất?",
      chon: [
        "Entropy là tổng khoảng cách của MỌI cặp hạt, kể cả cặp thuộc hai cụm khác nhau; chia thành các cụm rời nhau giữ nguyên toàn bộ khoảng cách liên cụm nên luôn kém hơn một khối đặc",
        "Vì k > 1 cần nhiều nước đi hơn hạn mức L cho phép",
        "Vì khoảng cách Manhattan không cộng được theo từng cụm",
        "Vì thuật toán k-means chỉ hội tụ đúng khi k = 1"
      ],
      dung: 0,
      giaiThich: "Mục tiêu là giảm khoảng cách giữa MỌI cặp hạt, nên một khối đặc duy nhất (diện tích N) là cấu hình tốt nhất; k cụm rời nhau không làm giảm các khoảng cách liên cụm. Trong ba dòng in ra, điểm của k = 1 gấp 1,9–3,7 lần k = 2 và 4,8–9,3 lần k = 5 (tài liệu tóm tắt là “gấp đôi” và “gấp 9”, đúng nhất cho dòng đầu). Ngân sách không phải lý do (lời giải tối ưu chỉ dùng ~31 %), và khoảng cách Manhattan vẫn cộng được; đây là lỗi mô hình (Bài 1), không phải lỗi hội tụ."
    },
    {
      id: "q5", loai: "mot", doKho: 3, ref: "03 §2.4",
      hoi: "Khoảng cách là L₁ (Manhattan) nên trực giác nói hình đích tối ưu là kim cương (hình cầu L₁). Đo thực tế hằng số hình dạng κ (càng nhỏ càng tốt): vuông 0,6668; kim cương 0,6598; đĩa tròn 0,6504; tối ưu Frank–Wolfe 0,6502. Vì sao kim cương thua đĩa tròn?",
      chon: [
        "Vì lưới là hình vuông nên hình vuông thích hợp nhất, đĩa tròn chỉ may mắn",
        "Vì đại lượng cần cực tiểu là kỳ vọng L₁ giữa hai điểm ngẫu nhiên trong hình, và nó chỉ phụ thuộc hai biên duyên; đĩa tròn cho biên duyên tập trung hơn (mật độ nửa-elip) so với biên duyên hình tam giác của kim cương",
        "Vì kim cương cần nhiều nước đi hơn để xếp ra, vượt ngân sách L",
        "Vì kim cương không phải hình lồi nên không thể xếp được"
      ],
      dung: 1,
      giaiThich: "Chuẩn của khoảng cách (L₁) không quyết định hình tối ưu; thứ quyết định là kỳ vọng L₁ giữa hai điểm ngẫu nhiên, vốn chỉ phụ thuộc biên duyên. Gần tâm ψ″ = 2f (f là mật độ biên duyên) nên tập mức dưới là một hình tròn; ra xa mới phình về phía kim cương. Đổi hình đích từ vuông sang hình tối ưu đáng +7,0 % điểm ở mật độ thấp và +12,2 % ở mật độ cao — đòn bẩy lớn nhất của bài, hơn mọi cải tiến định tuyến. Ngân sách dư gấp đôi nên không phải lý do, và kim cương là hình lồi hoàn toàn xếp được."
    },
    {
      id: "q6", loai: "nhieu", doKho: 3, ref: "03 §2.1–2.5 · Bài 12",
      hoi: "Về cách giải bài toán chọn hình dạng bằng Frank–Wolfe, những phát biểu nào đúng?",
      chon: [
        "Nới lỏng chỉ báo 0/1 thành mật độ u ∈ [0, 1] là chặt: J lõm trên lát cắt Σu = N nên cực tiểu đạt tại đỉnh, và các đỉnh của {0 ≤ u ≤ 1, Σu = N} chính là các vectơ 0/1",
        "Frank–Wolfe cho cực tiểu toàn cục được chứng minh với mọi điểm xuất phát",
        "Gradient tách thành ψ_Y(y) + ψ_X(x), nên cả hai thành phần tính được trong O(H) và O(W) bằng tổng tiền tố",
        "Vì J lõm nên Frank–Wolfe chỉ bảo đảm cực tiểu địa phương; tác giả kiểm bằng đa khởi tạo và thấy chênh tối đa chỉ khoảng 0,001 %, hội tụ sau ≤ 5 vòng",
        "Bước Frank–Wolfe đầy đủ cần tìm kiếm đường thẳng để bảo đảm giá trị mục tiêu giảm đơn điệu"
      ],
      dung: [0, 2, 3],
      giaiThich: "Ba phát biểu đúng: nới lỏng chặt (cực tiểu hàm lõm ở đỉnh); gradient tách biến nên rẻ; và vì lõm nên chỉ có bảo đảm địa phương — tác giả bù bằng kiểm chứng thực nghiệm. Phát biểu “toàn cục được chứng minh” sai: hàm lõm có thể có nhiều cực tiểu địa phương. Phát biểu về tìm kiếm đường thẳng cũng sai: với hàm lõm, bước đầy đủ (nhảy thẳng tới đỉnh cực tiểu hoá hàm tuyến tính hoá) đã giảm đơn điệu, không cần tìm kiếm đường thẳng."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "03 §3.1–3.2",
      hoi: "Làm sao vận tải hai pha (dọc rồi ngang) đưa cấu hình về đúng cặp biên duyên tối ưu (R, C) mà không nước đi nào bị chặn?",
      chon: [
        "Pha dọc chỉ đi theo y (giữ biên duyên cột, sửa biên duyên hàng thành R); pha ngang chỉ đi theo x (giữ biên duyên hàng, sửa biên duyên cột thành C). Trên mỗi đường thẳng, ghép hạt với ô đích theo thứ tự đơn điệu rồi di chuyển hai lượt — các hạt đi lùi trước, các hạt đi tới sau — thì mọi ô đích đều rỗng",
        "Mỗi hạt tìm đường ngắn nhất bằng A* tới một ô đích, tránh các hạt khác",
        "Các hạt di chuyển ngẫu nhiên cho tới khi biên duyên khớp với (R, C)",
        "Chạy k-means với k = 1 rồi kéo mọi hạt về tâm"
      ],
      dung: 0,
      giaiThich: "Bổ đề ghép cặp đơn điệu: khi gán hạt thứ i ↦ ô đích thứ i theo thứ tự, và thực hiện hai lượt (lùi trước, tới sau), các hạt khác luôn nằm ngoài hành lang đang đi — nên không bao giờ có nước hỏng, đồng thời tổng chi phí là tối ưu của vận tải 1 chiều. Sau hai pha biên duyên đúng bằng (R, C), nên E₁ = F(R) + F(C) chính xác. Gán đích bằng tham lam Gale–Ryser (chọn cột có rem lớn nhất) bảo đảm khả thi. A*, ngẫu nhiên hay kéo về tâm đều không có bảo đảm tính hợp lệ hay tối ưu."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "01 · Quan sát 5–6",
      hoi: "Lời giải tối ưu chỉ dùng trung bình 31 % ngân sách nước đi (tối đa 46 %) trên 1 000 test. Kết luận nào đúng?",
      chon: [
        "Cần tối ưu thêm quãng đi để tiết kiệm nước, vì mỗi nước tiết kiệm được cộng điểm đáng kể hơn entropy",
        "Ràng buộc thật của bài là hình học (khối hạt không thể nhỏ hơn N ô) và mật độ, không phải ngân sách; entropy áp đảo tiền thưởng nước đi nên chỉ cần vận tải làm đúng, không cần tối ưu thêm (dư địa khoảng 0,24 % điểm)",
        "Có thể giảm L xuống 31 % mà điểm không đổi",
        "Ngân sách thừa chứng tỏ bộ chấm đếm sai số nước đã dùng"
      ],
      dung: 1,
      giaiThich: "SCORE = ⌊10⁶ρ²⌋ + ⌊(L − m)/100⌋: đạo hàm theo ρ là 2·10⁶ρ ≈ 8·10⁵ tại ρ = 0,4, tức 0,01 ρ đáng 8 000 điểm; còn toàn bộ tiền thưởng nước đi tối đa L/100 ≤ 12 960 và đo được trung bình 4 532 trên tổng ~160 900. Dư địa còn lại của phần thưởng chỉ 386 điểm/TC ≈ 0,24 %. L là hằng số của đề — thí sinh không giảm được — và ngân sách dư gấp đôi (L/N ∈ [80; 133] nước mỗi hạt) là đặc điểm thật của đề chứ không phải lỗi đếm."
    },
    {
      id: "q9", loai: "so", doKho: 2, ref: "01 · Quan sát 7", donVi: "(ρ)",
      hoi: "Với lưới vuông và mật độ hạt p = 0,4, trần ρ* ≈ 1 − 0,9755·√p. ρ* bằng bao nhiêu (làm tròn đến ba chữ số thập phân)?",
      dapAn: 0.383, saiSo: 0.002,
      giaiThich: "√0,4 ≈ 0,6325 ⇒ 0,9755 × 0,6325 ≈ 0,6170 ⇒ ρ* ≈ 0,383, tức điểm entropy trần khoảng 10⁶ × 0,383² ≈ 147 000. Hằng số 0,9755 = 3κ/2 với κ = 0,6502 (đã đo); tổng quát ρ* ≈ 1 − 3κ·√N/(H + W). Điểm của một test gần như được định đoạt ngay khi sinh dữ liệu: p = 0,3 cho ρ* = 0,466 và p = 0,5 cho 0,310; lưới vuông là trường hợp khó nhất vì √(HW) ≤ (H + W)/2."
    },
    {
      id: "q10", loai: "mot", doKho: 1, ref: "02 · B1",
      hoi: "Phiên bản k-means v1 và v2 đạt SCORE đúng bằng điểm của một hàm process() rỗng (ρ = 0, không di chuyển hạt nào). Nguyên nhân là gì?",
      chon: [
        "k-means chọn k = 0 nên không có cụm nào để kéo hạt về",
        "Bộ chấm bỏ qua mọi nước đi của phiên bản cũ",
        "Hàm Context::move khai báo trả về int nhưng thiếu lệnh return — hành vi không xác định: ở -O0 chương trình chết (illegal instruction), ở -O2 trình biên dịch coi nhánh đó là không thể tới và xoá luôn vòng lặp di chuyển; lỗi im lặng nếu không bật -Wreturn-type",
        "Cả hai phiên bản đều vượt 1 000 ms nên bị tính là không di chuyển hạt nào"
      ],
      dung: 2,
      giaiThich: "Rơi khỏi cuối một hàm non-void là hành vi không xác định. Hậu quả đo được: ở -O0 chết ngay test đầu, ở -O2 vòng lặp di chuyển bị loại bỏ nên chạy “bình thường” nhưng không di chuyển hạt nào — điểm chỉ còn tiền thưởng (L − 0)/100. v3 đã sửa bằng đổi sang void. Bài học: luôn dịch thử với -Wall -Wextra ở cả -O0 và -O2. Hai phương án còn lại bịa ra cơ chế không có trong mã; v1 và v2 chạy rất nhanh (363 ms và 1,3 ms trung bình), không phải vì quá giờ."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "01 §3 · Bài 20 bước ①",
      hoi: "Đề 2609 chỉ có 5 dòng văn bản và kết thúc bằng “hãy phân tích mã để tối đa hoá SCORE”. Áp dụng bước ① của quy trình 8 bước: nêu ít nhất bốn quan sát bạn sẽ rút ra từ main.cpp và, với mỗi quan sát, nêu hệ quả thiết kế.",
      goiY: [
        "Đọc ba chỗ: dòng làm tăng bộ đếm nước đi, công thức entropy và công thức SCORE.",
        "Hãy nghĩ tới phép biến đổi làm hình học 2 chiều “biến mất”."
      ],
      mau: "1. **Nước đi hỏng vẫn tốn ngân sách** (bộ đếm tăng trước mọi kiểm tra) ⇒ phải chứng minh mỗi nước hợp lệ trước khi gọi, không được “cứ thử”.\n2. **Entropy tách theo hai trục**, E = F(r) + F(c), tính trong O(H + W + N) ⇒ không cần vòng đôi O(N²); chính vòng đôi này làm 17 % test của lời giải cũ vượt giờ.\n3. **E chỉ phụ thuộc hai biên duyên và bất biến tịnh tiến** ⇒ bài toán rút gọn thành chọn cặp biên duyên tốt nhất rồi đưa cấu hình về đó; hình học 2 chiều biến mất; vị trí khối đích chỉ ảnh hưởng chi phí di chuyển.\n4. **SCORE theo ρ bình phương**: 0,01 ρ ≈ 8 000 điểm trong khi toàn bộ thưởng nước đi ≤ 12 960 ⇒ tối ưu entropy trước, tiết kiệm nước sau.\n5. **Ngân sách L = 40·H·W dư gấp đôi** (L/N ∈ [80; 133] nước mỗi hạt) ⇒ ràng buộc thật là hình học; vận tải chỉ cần làm đúng.\n6. **Trần bị chặn bởi mật độ**: ρ* ≈ 1 − 0,9755·√p ⇒ điểm gần như được định đoạt lúc sinh dữ liệu; thuật toán chỉ quyết định ta cách trần bao xa.",
      tieuChi: [
        "Nêu ít nhất bốn quan sát đúng, rút từ cách bộ chấm hoạt động (không chỉ từ lời đề)",
        "Mỗi quan sát gắn với một hệ quả thiết kế cụ thể",
        "Nhận ra quan sát “entropy chỉ phụ thuộc hai biên duyên” là chìa khoá khiến bài toán tách thành hai bài con"
      ]
    },
    {
      id: "l2", doKho: 3, ref: "03 §3.4–3.5, §6 · Bài 18 §6",
      hoi: "Tài liệu không làm hai cải tiến: (a) sửa ~20 % dư thừa của pha vận tải thứ hai bằng một khoá phụ hình học (chi phí thực trung bình 1,205× cận dưới vận tải, tối đa 1,332×); (b) chiếu cặp biên duyên về miền Gale–Ryser cho 3/300 test sát ngưỡng. Đồng thời lời giải lại giữ một “van an toàn” hạ tham vọng khi chi phí vượt ngân sách, dù van đó chưa từng kích hoạt. Hãy phân tích đánh đổi: làm hay không làm từng thứ, và vì sao?",
      goiY: [
        "Tính lợi ích tối đa của mỗi cải tiến theo điểm và %: dư địa tiền thưởng chỉ 386 điểm/TC.",
        "Bảng quyết định của Bài 18 §6 nói gì khi khoảng cách tới trần dưới 2 %?"
      ],
      mau: "**(a) Khoá phụ hình học: không làm.** Toàn bộ phần lấy lại được chỉ là 386 điểm/TC ≈ 0,24 % (tiền thưởng đạt 4 532 so với 4 918 nếu chạm cận dưới vận tải), đổi lại là rủi ro phá điều kiện Gale–Ryser của phép chọn cột theo rem — vốn là nền của tính khả thi và không va chạm.\n\n**(b) Chiếu về miền Gale–Ryser: không làm.** Chỉ 3/300 test (1 %), sai lệch entropy 0,04 % trên các test đó, ảnh hưởng điểm trung bình < 0,001 %; hiện đã có phòng thủ (hạt không xếp được thì đứng yên, vẫn 0 nước hỏng).\n\n**(c) Van an toàn: giữ.** Không kích hoạt thì không tốn điểm (mức dùng ngân sách tối đa 45,9 %), nhưng là bảo hiểm cho phân bố khác thường; hợp tinh thần “an toàn quan trọng hơn vài phần trăm điểm”.\n\nTổng dư địa còn lại ~0,25 %; theo Bài 18 §6 (dưới 2 %: gần chạm trần) là vùng nên cân nhắc dừng và dùng thời gian cho việc khác. Nguyên tắc chung: cải tiến có thể phá tính đúng thì cần lợi ích lớn mới đáng; bảo hiểm chi phí bằng 0 thì giữ.",
      tieuChi: [
        "Định lượng lợi ích tối đa của từng cải tiến (≈ 0,24 % và < 0,001 %) và đặt cạnh rủi ro",
        "Phân biệt cải tiến có thể phá tính đúng (không làm) với bảo hiểm chi phí bằng 0 (giữ)",
        "Liên hệ bảng quyết định Bài 18 §6: dư địa dưới 2 % thì cân nhắc dừng"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "03 §2.5, §5 · Bài 4, Bài 18 §9",
      hoi: "Tài liệu viết: (i) “Frank–Wolfe từ dữ liệu ban đầu cho tối ưu toàn cục trong mọi thực nghiệm”; (ii) “lời giải đề xuất đạt 99,76 % cận trên”, trong khi bảng kết quả ghi điểm 161 205 (200 test) và cận trên chặt là 161 318. Hãy kiểm hai phát biểu bằng chính số liệu trong tài liệu: chúng đúng đến đâu, chỗ nào nói quá hoặc so lẫn hai tập dữ liệu, và cách trình bày trung thực là gì?",
      goiY: [
        "Bảng đa khởi tạo ở §2.5: so dòng “từ dữ liệu ban đầu” với giá trị nhỏ nhất của mỗi cột.",
        "Điểm 161 205 đo trên 200 test, còn 160 933 và cận 161 318 đo trên 1 000 test."
      ],
      mau: "**(i)** Hàm J lõm nên Frank–Wolfe chỉ bảo đảm cực tiểu **địa phương**. Bảng đa khởi tạo cho thấy ở seed 1 khởi tạo từ dữ liệu ban đầu ra 439 643 508, trong khi 12 khởi tạo ngẫu nhiên ra 439 638 394 (nhỏ hơn 5 114 đơn vị, ≈ 0,0012 %); ở seed 5 cũng vậy (2 467 787 547 so với 2 467 786 550 từ đĩa tròn). Vậy “toàn cục trong mọi thực nghiệm” hơi quá; chính xác là “nằm trong ~0,001 % so với tốt nhất tìm được từ nhiều khởi tạo”, đủ nhỏ để bỏ qua.\n\n**(ii)** 99,76 % = 160 933 / 161 318 là số của **1 000 test** (điểm trung bình 160 933). Điểm 161 205 ở bảng so với k-means v3 là trung bình của **200 test**; chia cho cận 161 318 của 1 000 test sẽ ra 99,93 % — tức hai con số 99,76 % và 161 205 không cùng một tập test. Cách trình bày đúng: dùng cùng một tập test cho cả điểm và cận (cận phải tính riêng cho từng test, Bài 18 cạm bẫy 3), hoặc ghi rõ tập nào; kèm sai số chuẩn khi so sánh (Bài 4).\n\nCả hai chỗ không đổi kết luận (dư địa ~0,25 %, Frank–Wolfe rất gần tối ưu), nhưng là bài tập về kỷ luật: nói đúng mức chứng cứ mình có.",
      tieuChi: [
        "Chỉ ra bằng số liệu §2.5 rằng khởi tạo từ dữ liệu không luôn cho giá trị nhỏ nhất (seed 1: 439 643 508 so với 439 638 394), nên “toàn cục trong mọi thực nghiệm” hơi quá",
        "Phát hiện 99,76 % lấy từ 1 000 test còn 161 205 lấy từ 200 test (so lẫn hai tập)",
        "Nêu cách trình bày trung thực: cùng tập test, nêu rõ nguồn, kèm sai số"
      ]
    }
  ],

  lab: [
    {
      id: "entropy-bien-duyen",
      ten: "Entropy trong O(H + W + N) — công thức biên duyên",
      doKho: 2,
      ref: "01 · Quan sát 2–3 · 02 · B2",
      de: "Điều then chốt của ca 2609 (Quan sát 2): entropy `E = Σ_{p<q} ‖p − q‖₁` **tách theo hai trục** và chỉ phụ thuộc hai biên duyên: `E = F(r) + F(c)` với `F(v) = Σ_{t=0}^{M−2} S_t · (N − S_t)`, trong đó `S_t` là tổng tiền tố của dãy đếm `v` (số hạt theo từng hàng, hoặc theo từng cột). Chính vòng lặp đôi O(N²) là lý do lời giải cũ vượt giờ ở 17 % test.\n\n" +
          "Đầu vào: dòng 1 `H W N`; tiếp theo `N` dòng `y x` — toạ độ một hạt (`0 ≤ y < H`, `0 ≤ x < W`, mọi ô khác nhau). Ở lab, lưới lớn hơn đề thật (320 × 320, N ≈ 5·10⁴; đề thật N ≤ 16 200) để vòng đôi O(N²) quá giờ — đó chính là ý của bài: bạn phải dùng công thức. Chấm trên 10 bộ dữ liệu.\n\n" +
          "Đầu ra: **một dòng ba số nguyên** `F(r) F(c) E`; chúng có thể vượt 2³¹ nên hãy dùng số nguyên 64 bit (`long long`). Gợi ý kiểm tay: với 6 hạt (0,0), (0,2), (1,1), (3,1), (2,3), (3,3) ta có F(r) = 25, F(c) = 22, E = 47.\n\n" +
          "Sau khi qua, đổi biến thể (mật độ thấp, lưới dẹt) và để ý: thời gian chạy của bạn gần như không đổi theo N. Vì sao E không cần biết hạt nào nằm ở đâu mà chỉ cần hai biên duyên? (Quan sát 3 — đó là chìa khoá biến bài toán thành “chọn cặp biên duyên tốt nhất”.)",
      vanDe: "ca2609-entropy",
      tham: { H: 320, W: 320, p: 0.5 },
      bienThe: [
        { ten: "Lưới vuông 320 × 320, mật độ 0,5", tham: { H: 320, W: 320, p: 0.5 } },
        { ten: "Mật độ thấp 0,3", tham: { H: 320, W: 320, p: 0.3 } },
        { ten: "Lưới dẹt 120 × 850, mật độ 0,5", tham: { H: 120, W: 850, p: 0.5 } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [],
      khoiDau: {
        js: String.raw`// Đầu vào: "H W N"; rồi N dòng "y x". Đầu ra: một dòng "F(r) F(c) E".
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const H = t[0], W = t[1], N = t[2];
const r = new Array(H).fill(0), c = new Array(W).fill(0);
for (let i = 0; i < N; i++) { r[t[3 + 2 * i]]++; c[t[4 + 2 * i]]++; }

let fr = 0, fc = 0;
// TODO: F(v) = Σ_{t=0}^{M-2} S_t * (N - S_t), với S_t là tổng tiền tố của v. Tính F(r) và F(c).

print(fr + " " + fc + " " + (fr + fc));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int H, W, N;
    scanf("%d %d %d", &H, &W, &N);
    vector<long long> r(H, 0), c(W, 0);
    for (int i = 0; i < N; i++) { int y, x; scanf("%d %d", &y, &x); r[y]++; c[x]++; }

    long long fr = 0, fc = 0;
    // TODO: F(v) = Σ_{t=0}^{M-2} S_t * (N - S_t), với S_t là tổng tiền tố của v. Tính F(r) và F(c).

    printf("%lld %lld %lld\n", fr, fc, fr + fc);
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const H = t[0], W = t[1], N = t[2];
const r = new Array(H).fill(0), c = new Array(W).fill(0);
for (let i = 0; i < N; i++) { r[t[3 + 2 * i]]++; c[t[4 + 2 * i]]++; }

// F(v) = Σ_{t=0}^{M-2} S_t * (N - S_t): mỗi "lát cắt" t nằm giữa S_t hạt bên trái và N - S_t hạt bên phải.
function F(v) {
  let S = 0, s = 0;
  for (let k = 0; k + 1 < v.length; k++) { S += v[k]; s += S * (N - S); }
  return s;
}
const fr = F(r), fc = F(c);
print(fr + " " + fc + " " + (fr + fc));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

// F(v) = Σ_{t=0}^{M-2} S_t * (N - S_t): mỗi "lát cắt" t nằm giữa S_t hạt bên trái và N - S_t hạt bên phải.
static long long F(const vector<long long>& v, long long N) {
    long long S = 0, s = 0;
    for (size_t k = 0; k + 1 < v.size(); k++) { S += v[k]; s += S * (N - S); }
    return s;
}

int main() {
    int H, W, N;
    scanf("%d %d %d", &H, &W, &N);
    vector<long long> r(H, 0), c(W, 0);
    for (int i = 0; i < N; i++) { int y, x; scanf("%d %d", &y, &x); r[y]++; c[x]++; }
    long long fr = F(r, N), fc = F(c, N);
    printf("%lld %lld %lld\n", fr, fc, fr + fc);
    return 0;
}
`
      },
      goiY: [
        "Đếm số hạt theo từng hàng (mảng r) và theo từng cột (mảng c) trong một lượt đọc dữ liệu — O(N).",
        "|yᵢ − yⱼ| bằng số “lát cắt” t nằm giữa hai hạt, nên mỗi lát cắt t đóng góp S_t·(N − S_t) cặp, với S_t = r₀ + … + r_t. Cộng t từ 0 tới H − 2 (lát cuối không có hạt bên phải).",
        "Dùng số nguyên 64 bit: với N ≈ 5·10⁴ thì F có thể lên cỡ 10¹¹. Thử tay với 6 hạt ở đề bài để kiểm F(r) = 25, F(c) = 22."
      ]
    }
  ]
});
