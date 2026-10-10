/* Thực hành — Bài kiểm tra đầu vào (placement): 15 câu trắc nghiệm bao phủ các điều kiện tiên quyết, 3 tự luận.
   Mỗi lời giải thích kết thúc bằng “Nếu sai: ôn …” để người học biết bổ túc chỗ nào (xem phần B-1, B-2, B-3 của bài giảng). */
TH.dangKy({
  id: "kiem-tra-dau-vao",

  tomTat: [
    "Bài kiểm tra đầu vào không để loại bạn mà để biết **nên bổ túc chỗ nào trước** khi vào Bài 1. Mười câu gốc chia bốn mảng: độ phức tạp, cấu trúc dữ liệu, thuật toán cơ bản, tư duy tối ưu; trang này tách thành 15 câu để chỉ rõ chỗ yếu.",
    "Ngưỡng của bài gốc: **≥ 7/10** → vào thẳng Bài 1; **4–6** → đọc phần bổ túc (1–2 giờ) rồi vào Bài 1; **< 4** → ôn lại DSA cơ bản 1–2 tuần. Quy ra tỉ lệ: ≥ 70 % là đủ nền.",
    "Mốc bỏ túi: máy hiện đại chạy cỡ **10⁸–10⁹ phép đơn giản mỗi giây** (C++ `-O2`). An toàn: 100 ms ≈ 10⁷, 1 giây ≈ 10⁸, 10 giây ≈ 10⁹ phép. Ước lượng ba bước: đếm số lần lặp vòng trong cùng N → chi phí mỗi lần lặp c → tổng N × c, rồi so với ngân sách.",
    "Bùng nổ tổ hợp: xét mọi tập con của 20 món là 2²⁰ ≈ 10⁶ (cỡ ms, vét cạn được), nhưng 2⁶⁰ ≈ 1,15×10¹⁸ cần cỡ **36 năm**. TSP có (n−1)!/2 chu trình; Held–Karp O(n²·2ⁿ) chỉ chạy nổi tới n ≈ 20–25.",
    "Cấu trúc dữ liệu cần thuộc: **heap** cho “lấy max / thêm / xoá max” trong O(log n); **swap-remove** (`a[i] = a[n−1]; --n`) xoá O(1) khi không cần giữ thứ tự; khoảng cách **Manhattan** |y₁−y₂| + |x₁−x₂| là số nguyên nên không có sai số dấu phẩy động.",
    "Cái túi 0/1: dp[i][w] = max(dp[i−1][w], dp[i−1][w−wᵢ] + pᵢ), O(nW) là **giả đa thức**. Tham lam “giá trị cao nhất trước” có thể sai nặng (60 so với 100 ở ví dụ 5 món); đổi sang chỉ số p/w là đủ để đúng — chỉ số quyết định tất cả.",
    "Một test không nói lên gì: so hai thuật toán phải chạy **≥ 30 test (tốt nhất 200+)**, cùng bộ seed, xem trung bình, thấp nhất, độ lệch chuẩn, và kiểm không test nào vi phạm ràng buộc."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "Phần A · A1",
      hoi: "Đoạn mã sau có độ phức tạp bao nhiêu theo n?\n\n```cpp\nfor (int i = 0; i < n; ++i)\n    for (int j = i + 1; j < n; ++j)\n        if (dist[i][j] < best) best = dist[i][j];\n```",
      chon: ["O(n)", "O(n log n)", "O(n²)", "O(n³)"],
      dung: 2,
      giaiThich: "Vòng trong chạy n−1, n−2, …, 1, 0 lần nên tổng số lần lặp là C(n,2) = n(n−1)/2 — bậc hai, tức O(n²). Không phải O(n) hay O(n log n) vì có hai vòng lồng nhau mà không vòng nào giảm một nửa mỗi lượt; không phải O(n³) vì chỉ có hai vòng. Nếu sai: ôn cách đếm số lần lặp của vòng trong cùng (phần B-1 và B-3, hàng “Độ phức tạp”) — khoá học luôn hỏi “một lượt duyệt lân cận tốn bao nhiêu” (Bài 9, 10)."
    },
    {
      id: "q2", loai: "so", doKho: 1, ref: "Phần A · B-1", donVi: "(phép)",
      hoi: "Một heuristic duyệt mọi cặp trong 400 phần tử, mỗi cặp tính khoảng cách Manhattan (khoảng 5 phép). Tổng số phép toán của MỘT lượt duyệt là bao nhiêu?",
      dapAn: 399000, tuongDoi: 0.01,
      giaiThich: "Làm theo ba bước: (1) số lần lặp vòng trong cùng N = 400·399/2 = 79 800 cặp; (2) chi phí mỗi lần lặp c ≈ 5 phép; (3) tổng N × c = 399 000 ≈ 4×10⁵ phép, cỡ 0,4 ms ở 10⁹ phép/giây. Đáp số 798 000 là lỗi đếm cả (i, j) lẫn (j, i); 2 000 là quên số cặp. Nếu sai: ôn phần B-1 “Ước lượng ngân sách tính toán”."
    },
    {
      id: "q3", loai: "mot", doKho: 1, ref: "Phần A · A2",
      hoi: "Máy tính hiện đại chạy được khoảng bao nhiêu phép toán đơn giản (cộng, so sánh số nguyên) trong 1 giây, với code C++ biên dịch `-O2`?",
      chon: ["Khoảng 10⁴", "Khoảng 10⁶", "Khoảng 10¹²", "Khoảng 10⁸–10⁹"],
      dung: 3,
      giaiThich: "Cỡ 10⁸–10⁹ (cao hơn nếu vector hoá tốt, thấp hơn nhiều nếu truy cập bộ nhớ không tuần tự). Bảng quy tắc dùng suốt khoá: 100 ms ≈ 10⁷, 1 giây ≈ 10⁸, 10 giây ≈ 10⁹ phép “an toàn”. 10⁴ và 10⁶ là ước lượng quá thấp, khiến bạn bỏ phí những thuật toán hoàn toàn chạy kịp; 10¹² quá cao, khiến bạn tin vào thuật toán không bao giờ chạy kịp. Nếu sai: đọc phần bổ túc B-1."
    },
    {
      id: "q4", loai: "so", doKho: 1, ref: "Phần A · A3", donVi: "(lần lặp)",
      hoi: "Bạn có n = 20 đồ vật và cần xét mọi tập con của chúng. Cần bao nhiêu lần lặp?",
      dapAn: 1048576, tuongDoi: 0.05,
      giaiThich: "Mỗi món có đúng hai lựa chọn độc lập (lấy hoặc không) nên có 2×2×…×2 = 2²⁰ = 1 048 576 ≈ 10⁶ tập con — cỡ vài ms, vét cạn được. Đáp số 20² = 400 là nhầm với số cặp, 20! ≈ 2,4×10¹⁸ là nhầm với số hoán vị. Nếu sai: ôn cách đếm tập con và hoán vị (A3; Bài 2 sẽ đi sâu hơn)."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "Phần A · A3",
      hoi: "Với n = 60 đồ vật, vét cạn mọi tập con ở 10⁹ phép/giây mất cỡ nào?",
      chon: [
        "Khoảng 36 năm (2⁶⁰ ≈ 1,15×10¹⁸ phép) — không vét cạn được",
        "Khoảng 17 phút (≈ 10¹² phép)",
        "Khoảng 1 giây (≈ 10⁹ phép)",
        "Khoảng 36 năm trên một luồng, nên chạy 8 luồng là xong sau vài phút"
      ],
      dung: 0,
      giaiThich: "2⁶⁰ = (2¹⁰)⁶ ≈ 10¹⁸ (chính xác 1,15×10¹⁸), chia 10⁹ phép/giây ra 1,15×10⁹ giây ≈ 36 năm. 17 phút là của 2⁴⁰ và 1 giây là của 2³⁰ — nhầm số mũ. Tám luồng chỉ chia được cho 8 (còn khoảng 4,6 năm), không cứu được bùng nổ tổ hợp: phần cứng không thắng cuộc đua này (Bài 2). Nếu sai: ôn mốc 2¹⁰ ≈ 10³ và cách đổi số phép ra thời gian (B-1)."
    },
    {
      id: "q6", loai: "mot", doKho: 1, ref: "Phần B · B1",
      hoi: "Bạn cần một cấu trúc dữ liệu để (i) lấy phần tử lớn nhất, (ii) thêm phần tử, (iii) xoá phần tử lớn nhất — mỗi thao tác phải nhanh. Nên chọn gì?",
      chon: ["Mảng không sắp xếp", "Heap (hàng đợi ưu tiên)", "Mảng đã sắp xếp", "Bảng băm"],
      dung: 1,
      giaiThich: "Heap làm cả ba thao tác trong O(log n) (lấy max là O(1)). Mảng không sắp xếp thêm O(1) nhưng tìm max O(n); mảng đã sắp xếp lấy/xoá max rẻ nhưng chèn phải dịch O(n); bảng băm không có thứ tự nên không biết ai là lớn nhất. Trong khoá, heap chọn ứng viên tốt nhất ở heuristic chèn (Bài 7) và giữ top-K trạng thái cho Beam Search (Bài 16). Nếu sai: ôn hàng đợi ưu tiên (B-3, tự cài binary heap)."
    },
    {
      id: "q7", loai: "mot", doKho: 1, ref: "Phần B · B2",
      hoi: "Mảng a = {5, 7, 9, 4} với n = 4. Bạn xoá phần tử ở vị trí 1 mà không cần giữ thứ tự bằng đoạn `a[1] = a[n - 1]; --n;`. Mảng còn lại (n phần tử đầu) là gì?",
      chon: ["{5, 7, 9}", "{5, 9, 4}", "{5, 4, 9}", "{7, 9, 4}"],
      dung: 2,
      giaiThich: "a[1] = a[3] = 4 rồi giảm n còn 3 nên mảng là {5, 4, 9} — số 7 đã bị ghi đè, chỉ tốn O(1). Đây là kỹ thuật swap-remove, dùng trong mọi heuristic có “danh sách phần tử chưa dùng” (Bài 19). {5, 9, 4} là kết quả của cách dịch mảng giữ thứ tự (O(n)); {5, 7, 9} là quên bước chép phần tử cuối nên vô tình xoá 4 thay vì 7; {7, 9, 4} là xoá phần tử đầu. Nếu sai: ôn thao tác trên mảng (B-3, hàng “Mảng, struct, con trỏ”)."
    },
    {
      id: "q8", loai: "so", doKho: 1, ref: "Phần B · B3", donVi: "(bước)",
      hoi: "Khoảng cách Manhattan giữa hai ô (y₁, x₁) = (12, 30) và (y₂, x₂) = (40, 9) là bao nhiêu?",
      dapAn: 49, saiSo: 0,
      giaiThich: "d = |y₁ − y₂| + |x₁ − x₂| = |12 − 40| + |30 − 9| = 28 + 21 = 49 — một số nguyên. Nếu bạn ra 35 thì đó là khoảng cách Euclid √(28² + 21²), áp sai công thức: Manhattan là quãng đường khi chỉ được đi ngang và dọc. Nếu sai: ôn lại công thức hai loại khoảng cách (B3)."
    },
    {
      id: "q9", loai: "nhieu", doKho: 1, ref: "Phần B · B3",
      hoi: "Chọn những phát biểu ĐÚNG về khoảng cách Manhattan trên lưới ô vuông.",
      chon: [
        "Nó là căn bậc hai của tổng bình phương hai độ chênh toạ độ",
        "Là số nguyên khi toạ độ nguyên, nên tối ưu không gặp sai số dấu phẩy động",
        "Mô tả đúng quãng đường khi chỉ được đi theo trục ngang và dọc, như taxi trong thành phố ô bàn cờ",
        "Luôn nhỏ hơn khoảng cách Euclid giữa cùng hai điểm",
        "Cho phép đi chéo qua ô với chi phí bằng 1"
      ],
      dung: [1, 2],
      giaiThich: "Đúng: là số nguyên (rất tiện cho tối ưu) và là quãng đường khi chỉ đi theo trục. Căn bậc hai của tổng bình phương chính là Euclid. Manhattan luôn LỚN hơn hoặc bằng Euclid (ví dụ 49 so với 35 ở câu trước) chứ không nhỏ hơn. Đi chéo với giá 1 ô là khoảng cách khác (Chebyshev). Nếu sai: ôn B3 và nhớ P1 trong khoá dùng Manhattan."
    },
    {
      id: "q10", loai: "mot", doKho: 2, ref: "Phần C · C1",
      hoi: "Cái túi 0/1: món i có giá trị pᵢ và cân nặng wᵢ, sức chứa W. Công thức truy hồi quy hoạch động đúng cho dp[i][w] (giá trị lớn nhất khi xét i món đầu, sức chứa w) là gì?",
      chon: [
        "dp[i][w] = max(dp[i−1][w], dp[i−1][w−wᵢ] + pᵢ)",
        "dp[i][w] = max(dp[i−1][w], dp[i][w−wᵢ] + pᵢ)",
        "dp[i][w] = min(dp[i−1][w], dp[i−1][w−wᵢ] + pᵢ)",
        "dp[i][w] = dp[i−1][w−wᵢ] + pᵢ"
      ],
      dung: 0,
      giaiThich: "Với món i có hai lựa chọn: bỏ (giữ dp[i−1][w]) hoặc lấy (dp[i−1][w−wᵢ] + pᵢ), rồi lấy max; độ phức tạp O(nW). Công thức dùng dp[i][w−wᵢ] cho phép lấy món i nhiều lần (cái túi không giới hạn số lượng); dùng min là tối thiểu hoá; bỏ phép max thì luôn ép lấy món i và không định nghĩa được khi w < wᵢ. Nếu sai: ôn quy hoạch động cơ bản qua bài cái túi (B-3)."
    },
    {
      id: "q11", loai: "mot", doKho: 2, ref: "Phần C · C2",
      hoi: "TSP: đi qua n = 10 thành phố, mỗi nơi đúng một lần rồi về chỗ cũ. Có bao nhiêu chu trình khác nhau (bỏ qua điểm bắt đầu và chiều đi)?",
      chon: ["10! = 3 628 800", "9!/2 = 181 440", "9! = 362 880", "10!/2 = 1 814 400"],
      dung: 1,
      giaiThich: "Cố định điểm bắt đầu thì còn (n−1)! cách sắp; chu trình đi xuôi và đi ngược cho cùng độ dài nên chia 2: (n−1)!/2 = 9!/2 = 181 440. 10! đếm cả việc chọn điểm bắt đầu lẫn chiều; 9! quên bỏ chiều đi; 10!/2 quên bỏ điểm bắt đầu. Với n = 20 con số này đã là 19!/2 ≈ 6×10¹⁶, không vét cạn được. Nếu sai: ôn cách đếm hoán vị và hoán vị vòng tròn (C2; Bài 2 §3.2)."
    },
    {
      id: "q12", loai: "mot", doKho: 2, ref: "Phần D · D1",
      hoi: "Cái túi sức chứa 10 kg với 5 món (giá trị, cân nặng): A (60, 10 kg), B (50, 5 kg), C (40, 5 kg), D (30, 3 kg), E (20, 2 kg). Tham lam “lấy món có GIÁ TRỊ cao nhất trước” cho kết quả bao nhiêu, và nghiệm tối ưu là bao nhiêu?",
      chon: ["60 và 90", "90 và 100", "100 và 100", "60 và 100"],
      dung: 3,
      giaiThich: "Tham lam theo giá trị lấy A (60) và hết chỗ ngay: 60 điểm. Tối ưu là B + D + E = 5 + 3 + 2 = 10 kg, 50 + 30 + 20 = 100 điểm (đã kiểm bằng cách liệt kê 32 tập con); tham lam theo tỉ số p/w (B, D, E đều 10/kg, C 8, A 6) cũng ra đúng 100. Tham lam theo giá trị kém tối ưu 40 %. “60 và 90” là bẫy quen thuộc: B + C = 90 vừa khít 10 kg nhưng chưa phải tối ưu. Nếu sai: đọc phần bổ túc B-2 (Tham lam và tỉ số) — chỉ số tham lam quyết định tất cả."
    },
    {
      id: "q13", loai: "nhieu", doKho: 2, ref: "Phần D · D2",
      hoi: "Thuật toán X được 100 điểm, Y được 105 điểm trên MỘT test. Trước khi kết luận “Y tốt hơn X”, những việc nào cần làm?",
      chon: [
        "Chạy cả hai trên nhiều test (tối thiểu 30, tốt nhất 200+)",
        "Chạy lại đúng test đó thêm một lần rồi tin kết quả lần hai",
        "Dùng cùng một bộ seed cho cả hai thuật toán",
        "Xem cả trung bình, giá trị thấp nhất và độ lệch chuẩn, không chỉ một con số",
        "Chọn thêm vài test mà Y thắng để báo cáo cho thuyết phục",
        "Kiểm tra không có test nào bị vi phạm ràng buộc"
      ],
      dung: [0, 2, 3, 5],
      giaiThich: "Một test không nói lên gì: cần nhiều test, cùng seed để so sánh công bằng, xem trung bình + thấp nhất + độ lệch chuẩn, và đảm bảo không test nào vi phạm ràng buộc (điểm của test vi phạm không có nghĩa). Chạy lại một test thì không thêm thông tin về mọi test; chọn test cho Y thắng là chọn dữ liệu theo kết luận có sẵn. Nếu sai: bạn thiếu kỹ năng đo lường — đây là toàn bộ nội dung Bài 4."
    },
    {
      id: "q14", loai: "mot", doKho: 1, ref: "Phần B · B-3",
      hoi: "Tìm một phần tử trong mảng ĐÃ SẮP XẾP gồm 1 000 000 phần tử bằng tìm kiếm nhị phân cần tối đa cỡ bao nhiêu lần so sánh?",
      chon: ["Khoảng 1 000", "Khoảng 500 000", "Khoảng 20", "Khoảng 1 000 000"],
      dung: 2,
      giaiThich: "Mỗi lần so sánh loại bỏ một nửa nên cần ⌈log₂ 1 000 000⌉ = ⌈19,93⌉ = 20 lần. 1 000 000 là tìm tuần tự trường hợp xấu nhất, 500 000 là trung bình của tìm tuần tự, 1 000 là √n — không phải thuật toán nào ở đây. Nếu sai: ôn sắp xếp và tìm kiếm nhị phân (B-3, “tự cài binary search”)."
    },
    {
      id: "q15", loai: "so", doKho: 2, ref: "Phần A · C++",
      hoi: "Trong C++, `long long` (64 bit có dấu) chứa tối đa khoảng 9,22×10¹⁸. Nếu tính n! bằng phép nhân số nguyên, n nhỏ nhất để n! bị tràn là bao nhiêu?",
      dapAn: 21, saiSo: 0,
      giaiThich: "20! = 2 432 902 008 176 640 000 ≈ 2,43×10¹⁸ vẫn vừa; 21! = 21 × 20! ≈ 5,11×10¹⁹ vượt 9,22×10¹⁸ nên tràn. (Với `int` 32 bit thì tràn sớm hơn nhiều, từ 13!.) Khi cần so sánh các con số khổng lồ như n! hãy cộng dồn log₁₀ i = log₁₀ n! thay vì nhân số nguyên — kỹ thuật dùng lại ở Bài 2. Nếu sai: ôn giới hạn kiểu số nguyên trong C++ (`int`, `long long`) và tràn số."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Phần bổ túc B-1",
      hoi: "Một heuristic lặp 150 bước, mỗi bước duyệt mọi cặp trong 400 phần tử (mỗi cặp khoảng 5 phép). Ước lượng tổng số phép và thời gian ở 10⁹ phép/giây, rồi cho biết bạn có yên tâm với ngân sách 100 ms không. Trình bày theo ba bước ước lượng.",
      goiY: ["Bước 1 là đếm số lần lặp của vòng trong cùng — nhớ rằng cặp (i, j) và (j, i) là một.", "Sau khi có tổng, đổi ra giây rồi so với ngân sách; so luôn với bảng “an toàn” (100 ms ≈ 10⁷ phép)."],
      mau: "1. **Đếm vòng trong cùng:** 400·399/2 = 79 800 cặp mỗi bước.\n2. **Chi phí mỗi lần lặp:** c ≈ 5 phép.\n3. **Tổng:** 79 800 × 5 × 150 ≈ 6×10⁷ phép, tức cỡ **60 ms** ở 10⁹ phép/giây.\n\nKết luận: nằm trong 100 ms nhưng **sát giới hạn**; đối chiếu bảng “an toàn” (100 ms ≈ 10⁷ phép) thì đã vượt khoảng 6 lần. Không nên tin ước lượng này mà phải cắt tỉa (chỉ xét các cặp bị ảnh hưởng, hoặc tính delta thay vì duyệt lại mọi cặp) và **đo thật** bằng `chrono`, vì cache và bộ nhớ không tuần tự có thể làm chậm hơn ước lượng.",
      tieuChi: ["Đếm đúng 79 800 cặp mỗi bước (chia 2, không phải 400²)", "Nhân với chi phí mỗi cặp (≈ 5) và số bước (150) ra cỡ 6×10⁷ phép", "Đổi ra thời gian bằng mốc 10⁹ phép/giây (≈ 60 ms) và so với ngân sách 100 ms", "Kết luận có hành động: sát giới hạn nên cắt tỉa và đo thật"]
    },
    {
      id: "l2", doKho: 2, ref: "Phần D · D2",
      hoi: "Thuật toán X được 100 điểm, Y được 105 điểm trên một test. Hãy mô tả thí nghiệm bạn sẽ làm để biết Y có thực sự tốt hơn X không (nêu ít nhất bốn yếu tố cần có).",
      goiY: ["Nghĩ về số test, về việc hai thuật toán có chạy trên cùng dữ liệu không, và về những con số nên báo cáo.", "Còn một điều kiện về tính hợp lệ của từng test."],
      mau: "Một test không đủ căn cứ. Thí nghiệm cần:\n\n- **Nhiều test:** tối thiểu 30, tốt nhất 200 trở lên.\n- **Cùng bộ seed** cho cả hai thuật toán, để chênh lệch đến từ thuật toán chứ không từ dữ liệu.\n- **Báo cáo trung bình, giá trị thấp nhất và độ lệch chuẩn** — trung bình giấu đi trường hợp xấu, độ lệch chuẩn cho biết độ ổn định.\n- **Kiểm không test nào vi phạm ràng buộc**: điểm của một nghiệm không hợp lệ không có nghĩa.\n\nBài 4 sẽ bổ sung so theo cặp và sai số chuẩn SE; 105 so với 100 trên một test có thể chỉ là nhiễu.",
      tieuChi: ["Nêu cần nhiều test (≥ 30, tốt nhất 200+)", "Nêu dùng cùng bộ seed cho hai thuật toán", "Nêu báo cáo cả trung bình, thấp nhất và độ lệch chuẩn", "Nêu kiểm mọi test đều hợp lệ (không vi phạm ràng buộc)"]
    },
    {
      id: "l3", doKho: 2, ref: "Phần C · C1",
      hoi: "Viết công thức truy hồi quy hoạch động cho cái túi 0/1 và độ phức tạp của nó. Vì sao O(nW) được gọi là “giả đa thức”? Và vì sao nếu bài toán thêm yếu tố phải đi từ món này sang món khác thì DP kiểu này sụp đổ?",
      goiY: ["Hỏi lại câu: “trạng thái nào là đủ để quyết định tương lai?”", "Khi phải đi lại giữa các món, chi phí đến món tiếp theo còn phụ thuộc vào điều gì?"],
      mau: "- Công thức: dp[i][w] = max(dp[i−1][w], dp[i−1][w−wᵢ] + pᵢ), độ phức tạp **O(nW)**.\n- **Giả đa thức:** thời gian phụ thuộc vào *giá trị* của W chứ không phải số bit để viết W; viết thêm một chữ số vào W làm DP chậm đi 10 lần. Ví dụ n = 400, W = 22 320 thì nW ≈ 9×10⁶ chạy được, nhưng W cỡ 10⁹ thì không.\n- Với cái túi, “đã dùng bao nhiêu cân” đã đủ để quyết định tương lai. Khi thêm di chuyển, tôi còn phải biết **đang đứng ở đâu** và **đã thăm những ai**; thành phần “tập đã thăm” cho 2ⁿ trạng thái nên DP sụp đổ — đó là lý do cần heuristic (Bài 2).",
      tieuChi: ["Viết đúng công thức truy hồi có hai nhánh (bỏ / lấy món i)", "Nêu O(nW) và giải thích giả đa thức: phụ thuộc giá trị W chứ không phải số bit", "Nêu khi thêm di chuyển, trạng thái phải có vị trí hiện tại và tập đã thăm (2ⁿ)"]
    }
  ],

  khongLab: "Bài kiểm tra đầu vào chỉ đo kiến thức nền bằng câu hỏi; các lab lập trình chấm tự động bắt đầu từ Bài 1 và cần chính những kỹ năng mà bài này đang kiểm tra (độ phức tạp, mảng, C++)."
});
