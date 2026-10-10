/* Thực hành — Bài 23: Tự đánh giá & con đường đi tiếp.  Bài kết thúc: trắc nghiệm tổng hợp cả khoá, tự luận phản tư, không có lab. */
TH.dangKy({
  id: "bai-23-tu-danh-gia",

  tomTat: [
    "Bài cuối phân biệt hai loại “biết lái xe”: thuộc lý thuyết và thật sự làm được. Từ bên trong chúng giống hệt nhau, nên bài đưa ra bốn câu hỏi 30 giây chọn đúng bốn chỗ kinh nghiệm lộ ra: giá mờ λ (Bài 6), delta evaluation (Bài 10), hàm xếp hạng của beam (Bài 16) và ablation trên bản hoàn chỉnh (Bài 22).",
    "Câu 1 — nhận hay bỏ việc 100 nghìn / 40 phút? Chưa trả lời được nếu chưa biết một phút của bạn đáng bao nhiêu: giá trị ròng = 100 − λ × 40, nên λ = 2 thì +20 (nhận), λ = 3 thì −20 (bỏ). Trả lời ngay “nhận, vì 100 nghìn là tiền tươi” là bỏ qua chi phí cơ hội — sai lầm phổ biến nhất của cả khoá.",
    "Câu 2 — một nước 2-opt trên tuyến 200 điểm chỉ cần bốn phép tra bảng và ba phép cộng trừ: Δ = d(u₁,u₂) + d(v₁,v₂) − d(u₁,v₁) − d(u₂,v₂), không phải 200. Đó là delta evaluation, nhanh hơn 1 157 lần trong đồ án; thiếu nó thì mọi metaheuristic đều không kịp chạy.",
    "Câu 3 — beam search xếp hạng kế hoạch dở dang bằng rank(s) = f(s) + ρ·(tài nguyên còn lại), ρ cùng loại với λ. Kế hoạch A (thu 20 000, còn 180 phút) có rank 38 000, thắng B (thu 22 000, còn 60 phút) có rank 28 000. Xếp hạng chỉ bằng điểm đã thu thì beam thoái hoá thành greedy, dù bề rộng W lớn đến đâu.",
    "Câu 4 — một thành phần đo ra −0,08 % thì chưa vội xoá: hãy hỏi “nó còn thiếu gì để phát huy?”. λ cần beam search mới có chỗ hành động và trong hệ đầy đủ đo được +2,43 %. Phán quyết cuối thuộc về ablation trên bản hoàn chỉnh, và các dòng ablation không cộng được với nhau (bảy dòng ra 8,72 % trong khi tổng cải thiện thật chỉ 7,17 %).",
    "Bảng tự chấm 23 năng lực × 0–3 điểm = 69: dưới 25 cần học lại Phần 1–2; 25–40 dùng được cho bài đơn giản; 41–55 đủ năng lực đi thi; 56–69 có thể hướng dẫn người khác. Bốn mục in đậm (7, 11, 17, 22) phân biệt người mới với người có kinh nghiệm. Bảng chỉ chính xác đúng bằng mức trung thực bạn dùng khi điền.",
    "Thói quen mang đi: đọc kỹ → mô hình hoá → ĐO → thử một thứ → ĐO → giữ hoặc bỏ; không tin trực giác cho tới khi có số liệu. Đi tiếp bằng khoá metaheuristic, AtCoder Heuristic Contest, OR-Tools / HiGHS và matheuristic; còn ~3 % tới cận trên của đồ án dành cho beam nhìn xa 2 ngày, Held–Karp theo ngày, λ thích nghi."
  ],

  trac: [
    {
      id: "q1", loai: "so", doKho: 1, ref: "Bài 6 · §1.1", donVi: "(nghìn/phút)",
      hoi: "Một khách gọi: việc này trả 100 nghìn và mất 40 phút. Giá trị ròng của việc là 100 − λ × 40 (λ tính bằng nghìn/phút). Giá mờ λ lớn nhất là bao nhiêu để việc này còn đáng nhận (giá trị ròng ≥ 0)?",
      dapAn: 2.5, saiSo: 0,
      giaiThich: "100 − 40λ ≥ 0 ⇒ λ ≤ 2,5. Ở λ = 2 giá trị ròng là +20 (nhận), ở λ = 3 là −20 (bỏ): cùng một đơn hàng, hai quyết định ngược nhau. λ không có sẵn trong đề; bạn phải ước lượng nó (Bài 6 nêu ba cách: nới lỏng LP, tìm kiếm nhị phân, quét thực nghiệm)."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "Bài 10, Bài 11",
      hoi: "Một tuyến đi qua 200 điểm. Bạn thử một nước 2-opt (đảo ngược một đoạn). Cách nào đúng và rẻ nhất để biết tuyến mới dài hơn hay ngắn hơn?",
      chon: [
        "Cộng lại độ dài cả 200 cạnh của tuyến mới rồi trừ đi độ dài tuyến cũ",
        "Cộng chênh lệch độ dài của mọi cạnh nằm trong đoạn bị đảo, vì chiều đi của chúng đã đổi",
        "Chỉ tính chênh lệch của hai cạnh bị cắt và hai cạnh mới nối: Δ = d(u₁,u₂) + d(v₁,v₂) − d(u₁,v₁) − d(u₂,v₂)",
        "Không thể biết trước; phải thực hiện nước đi rồi đo lại toàn bộ tuyến"
      ],
      dung: 2,
      giaiThich: "Đảo một đoạn chỉ thay hai cạnh; mọi cạnh khác giữ nguyên, kể cả các cạnh nằm trong đoạn bị đảo (đổi chiều nhưng độ dài không đổi). Vì vậy Δ chỉ cần bốn phép tra bảng khoảng cách và ba phép cộng trừ. Cộng lại cả 200 cạnh cho kết quả đúng nhưng chậm hàng trăm lần; cộng chênh lệch các cạnh trong đoạn đảo là sai vì chúng chênh bằng 0; “phải đo lại” bỏ qua ý tưởng delta evaluation (nhanh hơn 1 157 lần trong đồ án)."
    },
    {
      id: "q3", loai: "so", doKho: 2, ref: "Bài 16 · §4", donVi: "(đồng)",
      hoi: "Ngày làm việc có 480 phút. Beam search đang xét hai kế hoạch dở dang: P đã thu 31 000 và dùng 400 phút; Q đã thu 27 500 và dùng 330 phút. Với ρ = 90 đồng/phút và rank(s) = f(s) + ρ × (số phút còn lại), hãy tính rank(Q) − rank(P).",
      dapAn: 2800, saiSo: 0,
      giaiThich: "rank(P) = 31 000 + 90 × 80 = 38 200; rank(Q) = 27 500 + 90 × 150 = 41 000; hiệu = 2 800 > 0, nên beam giữ Q dù P đang dẫn trước 3 500 điểm đã thu. Nếu chỉ xếp hạng bằng f thì beam giữ P và thoái hoá thành greedy, dù bề rộng W lớn đến đâu (Bài 16, cạm bẫy 1: quên số hạng tiềm năng)."
    },
    {
      id: "q4", loai: "nhieu", doKho: 2, ref: "Bài 22 · §8.3, Bài 4 · §5",
      hoi: "Bảng ablation của đồ án (bỏ từng thành phần khỏi bản hoàn chỉnh) có bảy dòng cộng lại ra 8,72 %, trong khi cả đồ án chỉ cải thiện 7,17 % so với greedy. Những phát biểu nào dưới đây đúng?",
      chon: [
        "Mỗi dòng trả lời câu hỏi “bỏ riêng thành phần này khỏi bản hoàn chỉnh thì điểm tụt bao nhiêu” — dùng để quyết định có đáng giữ nó không",
        "8,72 % > 7,17 % chứng tỏ có ít nhất một phép đo bị sai nên phải chạy lại toàn bộ thực nghiệm",
        "Khi hai thành phần cùng phục vụ một mục tiêu (như beam search và phạt thời gian chết cùng lo việc lấp đầy ngày), công của chúng chồng lên nhau nên cộng riêng sẽ đếm trùng",
        "Các dòng ablation không cộng được với nhau; báo cáo cộng chúng lại để tuyên bố tổng cải thiện là sai",
        "Muốn có tổng cải thiện đáng tin, cách đúng là cộng các dòng ablation lại với nhau"
      ],
      dung: [0, 2, 3],
      giaiThich: "Ablation hỏi mỗi thành phần đúng một câu: “nếu bỏ mình mày, bản hoàn chỉnh tụt bao nhiêu?”. Khi bỏ beam, các thành phần còn lại vẫn gánh đỡ một phần việc; khi bỏ số hạng phạt thì beam gánh đỡ — nên phần chồng nhau bị đếm hai lần. Không ai tính sai: đó là bản chất của “che khuất”. Các dòng trả lời tốt câu “có đáng giữ không” nhưng không cộng được; vì thế hai phát biểu còn lại (có phép đo sai; cộng các dòng để lấy tổng) đều là hiểu lầm."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "Bài 11 · §4, Bài 22 · §9.3",
      hoi: "Đồng nghiệp đề nghị gắn thêm 2-opt + Or-opt vào solver của đồ án vì nó rút ngắn quãng đi từ 1 517 xuống 1 185 phút (−22 %). Bạn nên làm gì trước khi giữ nó?",
      chon: [
        "Đo bằng chính hàm mục tiêu (điểm): quãng đường chỉ là chỉ tiêu phụ, và ở đồ án nó ngắn đi 22 % nhưng điểm lại giảm 6,4 %",
        "Giữ luôn: tuyến ngắn thì còn nhiều phút hơn để dọn thêm nhà, nên điểm chắc chắn tăng",
        "Bỏ ngay vì 2-opt chỉ dùng được cho bài TSP thuần tuý, không dùng được ở bài có ngân sách thời gian",
        "Giữ nhưng chấp nhận vô điều kiện mọi nước đi làm giảm quãng đường"
      ],
      dung: 0,
      giaiThich: "Quãng đường không phải thứ bạn được chấm. Trên tuyến đã tối ưu kiểu TSP, nhà kế tiếp luôn ở rất gần; cuối ngày, khi nhà kế tiếp cần nhiều hơn thời gian còn lại, phần dư thành thời gian chết hoàn toàn. Đồ án đo được: đường −22 %, điểm −6,4 %. Vì thế phải đo bằng hàm mục tiêu thật. “Tuyến ngắn thì điểm tăng” là trực giác bị bác bỏ; 2-opt vẫn dùng được nói chung, chỉ là ở đây nó phản tác dụng; chấp nhận vô điều kiện mọi nước giảm quãng đường là biện pháp tệ nhất trong ba biện pháp khắc phục đã thử."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "Bài 4 · §3.2",
      hoi: "Trên 100 test case, solver A đạt trung bình 61 420 (SEM = 800) và solver B đạt 62 380 (SEM = 900). B hơn A 960 điểm. Kết luận nào đúng theo Bài 4?",
      chon: [
        "B tốt hơn A có ý nghĩa, vì 960 lớn hơn từng SEM riêng lẻ (800 và 900)",
        "Hai solver chắc chắn như nhau vì chênh lệch nằm trong ngưỡng nhiễu",
        "B tốt hơn A, vì với 100 test thì chỉ cần trung bình của B lớn hơn là đủ",
        "Chưa kết luận được: 960 nhỏ hơn 2 × √(800² + 900²) ≈ 2 408, tức với dữ liệu này chưa phân biệt được — chứ không có nghĩa hai solver như nhau"
      ],
      dung: 3,
      giaiThich: "|Δ| = 960 phải so với 2 × √(SEM_A² + SEM_B²) = 2 × √(640 000 + 810 000) ≈ 2 408. Vì 960 < 2 408 nên chênh lệch nằm trong nhiễu. Nhưng “chưa phân biệt được” khác “như nhau”: bạn có thể chạy thêm test để SEM giảm theo 1/√N rồi thử lại. So với từng SEM riêng hay chỉ nhìn trung bình đều là sai cách, còn khẳng định chắc chắn như nhau là kết luận quá mức."
    },
    {
      id: "q7", loai: "mot", doKho: 3, ref: "Bài 18 · §6, §9",
      hoi: "Một nghiệm đạt 32 915 840 điểm. Ba cận trên của cùng bài toán, ứng với mức di chuyển giả định τ = 0; 7 và 9,5 phút/nhà, là 35 571 464; 33 943 173 và 33 388 769. Một thành viên nói: “Còn cách trần 7,5 %, cần đầu tư thêm một tuần.” Nhận định nào hợp lý nhất theo Bài 18?",
      chon: [
        "Đồng ý: cận lớn nhất là cận an toàn nhất nên dư địa thật là 7,5 %",
        "Cận τ = 0 chắc chắn đúng nhưng lỏng (nghiệm đạt 92,5 %); hai cận kia chặt hơn nhưng dựa vào ước lượng quãng đường nên “còn ~3 %” chỉ là mốc tham chiếu. Phải nêu rõ đang dùng cận nào và kiểm độ chặt của nó rồi mới quyết định dừng hay đầu tư",
        "Lấy cận nhỏ nhất (τ = 9,5) vì cận càng nhỏ càng chính xác; đạt 98,6 % nghĩa là gần như đã tối ưu",
        "Ba cận cho ba kết luận khác nhau nên cận trên vô dụng trong việc ra quyết định"
      ],
      dung: 1,
      giaiThich: "Bài 18 §9: cận trên phải đến từ một nới lỏng chứng minh được (cạm bẫy 1), cận quá lỏng thì vô dụng (cạm bẫy 2) và khoảng cách nhỏ so với một cận lỏng chưa chắc nghĩa là gần tối ưu (cạm bẫy 4). Chỉ τ = 0 (bỏ hẳn chi phí di chuyển) là nới lỏng chắc chắn đúng, nhưng lỏng: 32 915 840 / 35 571 464 = 92,5 %. Các cận τ = 7 và 9,5 chặt hơn (97,0 % và 98,6 %), song quãng đường trong đó lấy từ ước lượng TSP hoặc từ chính lời giải nên chỉ là mốc tham chiếu. Vì vậy “còn 7,5 %”, “đã 98,6 % nên gần tối ưu” và “cận trên vô dụng” đều là kết luận quá mức."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "Bài 23 · §4, Bài 20 · §8.3",
      hoi: "Bạn cài ALNS rất công phu cho một đề mới, chạy 30 giây mà điểm vẫn thua cả greedy tỉ số. Theo bảng “sáu sai lầm phổ biến” (§4) và Bài 20, bước hợp lý nhất tiếp theo là gì?",
      chon: [
        "Tăng thời gian chạy ALNS lên 5 phút để nó có cơ hội hội tụ",
        "Thêm Simulated Annealing vào cạnh ALNS để thoát cực trị cục bộ",
        "Quay về nền móng: kiểm tra nghiệm cơ sở, heuristic xây dựng (Bài 5–8) và bộ chấm, vì metaheuristic không cứu được nghiệm xuất phát yếu hay phép đo sai",
        "Tinh chỉnh tham số của ALNS bằng cách quét lưới trên chính 10 test đang dùng"
      ],
      dung: 2,
      giaiThich: "“Nhảy thẳng tới metaheuristic” là sai lầm phổ biến; dấu hiệu là ALNS chạy 30 giây mà thua greedy, và cách chữa là Bài 5–8 trước. Bài 20 §8.3: thêm thuật toán mạnh mà không cải thiện ⇒ quay lại bước ④ (nghiệm cơ sở có vấn đề); điểm dao động mạnh giữa các test ⇒ quay lại bước ③ (bộ chấm, dữ liệu). Chạy lâu hơn hay chồng thêm một metaheuristic chỉ đắp lên nền yếu; quét tham số trên chính 10 test đang dùng còn dẫn tới quá khớp (Bài 20B)."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 23.1",
      hoi: "Hãy tự chấm bảng 23 năng lực (0–3 điểm, trung thực). Với ba mục bạn chấm thấp nhất, ghi: (a) bài giảng cần đọc lại, (b) một “phép thử 30 giây” để sau khi học lại bạn tự kiểm xem đã làm được chưa.",
      goiY: [
        "Mỗi mục trong bảng ứng với một bài: ví dụ mục 7 → Bài 6, mục 11 → Bài 10–11, mục 17 → Bài 16, mục 22 → Bài 4 và Bài 22.",
        "Phép thử tốt có đáp án kiểm được, như bốn câu hỏi ở §1: tính một delta bằng tay, tính rank của hai kế hoạch dở dang."
      ],
      mau: "Ví dụ của một người tự chấm trung thực:\n\n- **Mục 17 — thiết kế hàm xếp hạng cho beam (1 điểm).** Đọc lại Bài 16 §4. Phép thử: cho hai kế hoạch dở dang A (thu 20 000, còn 180 phút) và B (thu 22 000, còn 60 phút), ρ = 100; tự tính rank và giải thích vì sao giữ A, không nhìn tài liệu.\n- **Mục 11 — viết delta O(1) cho 4 toán tử (0 điểm).** Đọc lại Bài 10 và Bài 11. Phép thử: viết trên giấy Δ của 2-opt, Or-opt, swap, relocate, rồi cài hàm kiểm chứng so delta với tính lại toàn bộ trên 1 000 nước đi ngẫu nhiên.\n- **Mục 22 — ablation và xoá thành phần vô dụng (1 điểm).** Đọc lại Bài 4 §5 và Bài 22 §8. Phép thử: cho một bảng ablation bảy dòng, chỉ ra dòng nào nên xoá, dòng nào phải đo lại ở cấu hình một nhánh, và giải thích vì sao tổng các dòng không bằng tổng cải thiện.\n\nĐiểm quan trọng: mỗi mục thấp đều ghép với **một bài cụ thể** và **một phép thử kiểm được**, chứ không phải lời hứa “sẽ ôn lại”. Chấm rộng tay cho mình thì người duy nhất bị lừa là bạn.",
      tieuChi: [
        "Có điểm số trung thực cho các mục (ít nhất nêu rõ ba mục thấp nhất kèm điểm)",
        "Mỗi mục thấp được gắn với đúng một bài giảng cần đọc lại",
        "Mỗi mục có một phép thử ngắn mà kết quả kiểm chứng được (đúng/sai rõ ràng), không chỉ “ôn lại”"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 23.2, §8",
      hoi: "Viết một bài tổng kết cô đọng: ba điều bất ngờ nhất bạn học được trong khoá (mỗi điều kèm một con số hoặc một bằng chứng đo được) và một điều bạn vẫn chưa hiểu rõ.",
      goiY: [
        "Ba kết quả phản trực giác lớn nhất của khoá đều đến từ việc đo thay vì đoán — đọc lại §8.",
        "Điều chưa hiểu nên đủ cụ thể để một người khác có thể trả lời được hoặc để chính bạn tự thiết kế một thí nghiệm kiểm chứng."
      ],
      mau: "Một bản tổng kết mẫu:\n\n1. **Tối ưu thành phần ≠ tối ưu tổng thể.** 2-opt rút ngắn quãng đường 22 % nhưng làm điểm giảm 6,4 %: quãng đường chỉ là chỉ tiêu phụ, hàm mục tiêu thật là điểm.\n2. **Đo riêng từng thứ có thể nói dối.** λ cùng số hạng phạt thời gian chết đo riêng được −0,08 %, nhưng trong hệ có beam search thì bỏ nó mất 2,43 %. Nếu xoá ngay ở lần đo đầu tiên, ta mất 2,43 %.\n3. **Đọc mã grader là khoản đầu tư rẻ nhất.** Chỉ đếm đúng số lần gọi được `nextDay()` (31 khung ngày thay vì 30) đã cho +3,27 % ở bước thêm vào; không thuật toán nào rẻ hơn.\n\n**Điều chưa hiểu rõ:** vì sao bảy dòng ablation cộng ra 8,72 % mà tổng cải thiện chỉ 7,17 %? Tôi hiểu ý “các thành phần chồng nhau” nhưng chưa tự dựng được một ví dụ số nhỏ để thấy hiện tượng đó. Bước tiếp theo: tự thiết kế hai thành phần cùng lấp một khoảng trống, đo ablation từng cái rồi cả hai.\n\nHai điểm làm bản tổng kết tốt: bất ngờ nào cũng có số đo đi kèm, và “điều chưa hiểu” đủ cụ thể để hỏi hoặc kiểm chứng.",
      tieuChi: [
        "Nêu ba điều bất ngờ, mỗi điều có con số hoặc bằng chứng đo được từ khoá",
        "Mỗi điều bất ngờ có một câu giải thích vì sao nó trái trực giác",
        "Nêu một điều chưa hiểu đủ cụ thể, kèm bước tiếp theo để làm rõ"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "Bài tập 23.4",
      hoi: "(Bài tập quan trọng nhất của khoá.) Chọn một bài toán tối ưu trong công việc hoặc dự án của bạn — nếu chưa có, dùng “xếp ca cho 20 nhân viên trong 28 ngày”. Áp dụng bốn bước đầu của quy trình 8 bước: viết (S, C, f), mô tả bộ chấm cục bộ, chọn nghiệm cơ sở, và nêu cách tính một cận.",
      goiY: [
        "Khi không có mã chấm để đọc (bước ①), hãy đọc kỹ mọi quy định thực tế: điều nào làm phương án bị loại (ràng buộc cứng), điều nào chỉ bị trừ điểm.",
        "Cận thường đến từ nới lỏng: bỏ bớt một ràng buộc khó rồi giải bài dễ hơn (Bài 18)."
      ],
      mau: "Ví dụ: xếp ca cho 20 nhân viên trong 28 ngày, mỗi ngày 3 ca (sáng, chiều, đêm).\n\n1. **Mô hình hoá (S, C, f).** S: mọi phép gán nhân viên → ca cho từng ngày (biểu diễn: bảng 20 × 28, mỗi ô là nghỉ / sáng / chiều / đêm). C (cứng): mỗi ca đủ số người tối thiểu; không làm ca đêm rồi ca sáng hôm sau; tối đa 6 ngày làm liên tiếp. f: tổng điểm phạt (vi phạm nguyện vọng, chênh lệch số ca giữa các người) — cực tiểu hoá; vi phạm ràng buộc cứng thì loại phương án.\n2. **Bộ chấm cục bộ (dựng trước thuật toán).** Chương trình tự sinh 100 bộ dữ liệu theo seed, nhận một bảng phân ca, báo từng vi phạm cứng và phân rã điểm phạt theo loại.\n3. **Nghiệm cơ sở.** Greedy đơn giản: duyệt từng ngày, từng ca, gán người đang có ít ca nhất còn hợp lệ. Có con số này để mọi cải tiến phải vượt.\n4. **Một cận.** Nới lỏng bằng cách bỏ “không đêm rồi sáng” và “tối đa 6 ngày liên tiếp”: còn lại bài cân bằng tải, phạt tối thiểu tính được bằng cách chia đều số ca cần phủ cho 20 người. So phạt của nghiệm cơ sở với cận này cho biết còn dư địa bao nhiêu (bảng quyết định Bài 18 §6).\n\nSau đó mới sang bước ⑥: mỗi lần **một** thay đổi, đo bằng bộ chấm, ghi nhật ký; hoàn tác ngay nếu không cải thiện.",
      tieuChi: [
        "Viết được (S, C, f) với ràng buộc cứng tách khỏi phần chỉ bị trừ điểm",
        "Mô tả bộ chấm cục bộ: tự sinh dữ liệu, báo vi phạm, phân rã điểm — và nó được dựng trước khi viết thuật toán",
        "Có nghiệm cơ sở là một greedy đơn giản, đo được bằng một con số",
        "Nêu được cách tính một cận (nới lỏng một ràng buộc) và dùng nó để nói còn bao nhiêu dư địa"
      ]
    }
  ],

  khongLab: "Bài tự đánh giá cuối khoá: năng lực cần kiểm là phán đoán (nên hỏi gì, đo gì, khi nào dừng), không phải một chương trình có đáp án chấm được. Phần cài đặt đã được rèn ở các lab Bài 5–22; bài này kiểm bằng bốn câu hỏi nhanh, bảng tự chấm 23 mục và ba câu phản tư."
});
