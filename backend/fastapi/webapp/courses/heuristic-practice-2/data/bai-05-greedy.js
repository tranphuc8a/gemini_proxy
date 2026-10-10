/* Thực hành — Bài 5: Greedy và nghệ thuật chọn chỉ số.  (BÀI MẪU: các bài khác bắt chước cấu trúc và độ sâu của tệp này) */
TH.dangKy({
  id: "bai-05-greedy",

  tomTat: [
    "Mọi greedy có ngân sách đều là **một khung cố định + một chỗ cắm**: hàm chỉ số xếp hạng ứng viên. Nghệ thuật nằm ở việc chọn chỉ số, không ở việc viết thêm code.",
    "Bốn họ chỉ số: lợi ích `p`, chi phí `−c`, **tỉ số `p/c`**, tiếc nuối (regret). Hai họ đầu là hai cực (chỉ tử số / chỉ mẫu số); tỉ số hợp nhất cả hai.",
    "Định lý Dantzig: greedy theo tỉ số **tối ưu** cho cái túi **phân số** (chứng minh bằng đổi chỗ một lượng ε). Với 0/1 chứng minh gãy vì không cắt món được.",
    "Một phản ví dụ nhỏ: X(7,6), Y(5,5), Z(5,5), W=10 → greedy 7, tối ưu 10 (sai 30 %). Tỉ số đo **hiệu quả**, không đo **độ vừa vặn** với ngân sách.",
    "Chỉ số tốt là chỉ số **phân biệt được** ứng viên. Nếu σ/x̄ < 0,05 thì chỉ số đang thoái hoá (ví dụ subset-sum p = w làm mọi tỉ số bằng 1).",
    "Ở P1 chi phí c = d(vị trí hiện tại, j) + s phụ thuộc trạng thái ⇒ phải **tính lại chỉ số mỗi bước**. Quên điều này là bug im lặng: vẫn ra nghiệm hợp lệ nhưng kém.",
    "Một ví dụ nhỏ giải thích được **cơ chế**, không kết luận được **hiệu năng** — muốn kết luận phải đo trên nhiều test (Bài 4).",
    "Ba giới hạn của greedy dẫn đến phần còn lại của khoá: không quay đầu → local search; không nhìn trước → beam search; chỉ một nghiệm → GRASP."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§2",
      hoi: "Mọi greedy cho bài toán có ngân sách đều gồm một khung cố định và đúng một “chỗ cắm”. Chỗ cắm đó là gì?",
      chon: ["Hàm chỉ số dùng để xếp hạng các ứng viên", "Số vòng lặp tối đa của thuật toán", "Cấu trúc dữ liệu dùng để lưu nghiệm", "Thứ tự mà dữ liệu được đọc vào"],
      dung: 0,
      giaiThich: "Khung greedy (khởi tạo, lọc ứng viên còn vừa, chọn ứng viên có chỉ số cao nhất, trừ tài nguyên) là cố định. Chỉ dòng “chọn theo chỉ số” là thứ bạn thiết kế — đổi nó là ra thuật toán khác. Số vòng lặp và cấu trúc dữ liệu không đổi bản chất của greedy; thứ tự đọc dữ liệu chỉ ảnh hưởng khi phá hoà."
    },
    {
      id: "q2", loai: "mot", doKho: 1, ref: "§1",
      hoi: "Trên 200 test cái túi (n = 100), ba greedy kém tối ưu lần lượt 6,07 % (theo giá trị), 13,33 % (theo cân nặng) và 0,11 % (theo tỉ số). Ba phiên bản chỉ khác nhau một biểu thức. Bài học chính là gì?",
      chon: [
        "Phần lớn hiệu năng đến từ một số ít quyết định nhỏ ở đúng chỗ — ở đây là việc chọn chỉ số",
        "Greedy theo tỉ số có độ phức tạp tốt hơn hai bản còn lại",
        "Phải viết nhiều code hơn thì thuật toán mới tốt hơn",
        "Greedy theo cân nặng không bao giờ nên dùng"
      ],
      dung: 0,
      giaiThich: "Cả ba đều là O(n log n) và khác nhau đúng một dòng so sánh, nhưng chênh nhau 120 lần về chất lượng. Đây là mô-típ của cả khoá: tìm đúng chỗ đòn bẩy. Phương án “không bao giờ dùng greedy theo cân nặng” sai vì ở dữ liệu subset-sum thứ hạng có thể đảo ngược."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "§ Bài này nói về chuyện gì", donVi: "(nghìn)",
      hoi: "Bạn có 200 nghìn. Áo khoác (giá 200, đáng 300), áo phông (80, đáng 160), mũ (60, đáng 130), khăn (50, đáng 100). Chạy greedy theo tỉ số đáng/giá, tổng giá trị thu được là bao nhiêu?",
      dapAn: 390, saiSo: 0,
      giaiThich: "Tỉ số: mũ 2,17; áo phông 2,0; khăn 2,0; áo khoác 1,5. Lấy mũ (60) → áo phông (140) → khăn (190); còn 10 nghìn, không món nào vừa. Giá trị = 130 + 160 + 100 = 390. Greedy theo giá trị lấy áo khoác trước và hết sạch ngân sách, chỉ được 300."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§4.3",
      hoi: "Cái túi 0/1 với W = 10 và ba món X (p=7, w=6), Y (p=5, w=5), Z (p=5, w=5). Greedy theo tỉ số và nghiệm tối ưu lần lượt đạt bao nhiêu?",
      chon: ["7 và 10", "10 và 10", "7 và 7", "12 và 10"],
      dung: 0,
      giaiThich: "X có tỉ số cao nhất (1,167) nên được lấy trước, dùng 6 kg, còn 4 kg — không món nào còn vừa ⇒ 7 điểm. Tối ưu bỏ X và lấy Y + Z, vừa khít 10 kg ⇒ 10 điểm. Greedy sai 30 %. “12” là tổng X + Y nhưng nó nặng 11 kg, vượt W."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§4.2–4.3",
      hoi: "Chứng minh “greedy tỉ số tối ưu” bằng phép đổi chỗ chạy được với cái túi phân số nhưng hỏng với cái túi 0/1. Chỗ nào làm nó hỏng?",
      chon: [
        "Bước chuyển một lượng ε tuỳ ý nhỏ từ món tỉ số thấp sang món tỉ số cao — với 0/1 chỉ chuyển được cả món, làm tổng cân nặng đổi",
        "Với 0/1 các món không có tỉ số p/w",
        "Với 0/1 số món luôn bằng số ngăn của túi",
        "Với 0/1 greedy phải chạy lâu hơn"
      ],
      dung: 0,
      giaiThich: "Phép đổi chỗ cần dời một lượng ε bất kỳ giữa hai món để Δf = ε(p_i/w_i − p_k/w_k) ≥ 0 mà không đổi tổng cân nặng. Món 0/1 không cắt được nên bước này không thực hiện được; chứng minh gãy, và greedy tỉ số chỉ còn là heuristic. Các phương án còn lại không liên quan đến logic của chứng minh."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§6.1",
      hoi: "Những dấu hiệu nào cho thấy một chỉ số đang thoái hoá (không còn phân biệt được các ứng viên)?",
      chon: [
        "Độ lệch chuẩn tương đối σ/x̄ của chỉ số trên tập ứng viên nhỏ hơn 0,05",
        "Mọi ứng viên có cùng chỉ số, như tỉ số p/w trong bài subset-sum (p = w)",
        "Histogram của chỉ số dồn vào một cột rất hẹp",
        "Giá trị chỉ số của ứng viên rất lớn",
        "Chỉ số có thể nhận giá trị âm"
      ],
      dung: [0, 1, 2],
      giaiThich: "Chỉ số tốt phải phân biệt được ứng viên: σ/x̄ < 0,05, mọi chỉ số bằng nhau (khi đó “sắp xếp” thực chất là thứ tự tuỳ ý) hay histogram dồn một cột đều là dấu hiệu thoái hoá. Độ lớn tuyệt đối hay dấu của chỉ số không quan trọng — chỉ thứ hạng tương đối giữa các ứng viên mới có ý nghĩa."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§9 (cạm bẫy 2)",
      hoi: "Với P0 (cái túi) có thể sắp xếp một lần theo tỉ số rồi duyệt. Vì sao với P1 (ship hàng) phải tính lại chỉ số ở mỗi bước?",
      chon: [
        "Vì chi phí c = d(vị trí hiện tại, j) + s_j của mỗi đơn thay đổi theo vị trí hiện tại",
        "Vì P1 có nhiều ứng viên hơn P0",
        "Vì tiền p_j thay đổi sau mỗi lần giao hàng",
        "Vì thuật toán sắp xếp không ổn định"
      ],
      dung: 0,
      giaiThich: "Ở P0 chi phí của một món (cân nặng) cố định. Ở P1 khoảng cách đến đơn j phụ thuộc đang đứng ở đâu, nên một thứ hạng tính một lần chỉ đúng ở bước đầu. Đây là bug im lặng: chương trình vẫn ra nghiệm hợp lệ, chỉ kém hơn đáng lẽ."
    },
    {
      id: "q8", loai: "mot", doKho: 3, ref: "§5.3, §7.2",
      hoi: "Ở ví dụ 4 đơn, greedy “gần nhất” (9 200) thắng “tỉ số” (8 500). Đo trên 60 test × 120 đơn thì “tỉ số” (61 420) thắng “gần nhất” (53 499). Kết luận đúng là gì?",
      chon: [
        "Hai kết quả không mâu thuẫn: ví dụ nhỏ cho thấy cơ chế “gần nhất CÓ THỂ thắng”, còn bảng đo cho thấy trung bình thì không",
        "Ví dụ 4 đơn bị tính sai nên phải bỏ đi",
        "Bảng 60 test sai vì số test quá ít",
        "“Gần nhất” tốt hơn “tỉ số” khi n nhỏ hơn 10 nên có thể kết luận chung"
      ],
      dung: 0,
      giaiThich: "Một ví dụ giải thích cơ chế (đơn 1 và 4 sát nhau, đi vào cụm tiết kiệm 18 phút) nhưng không kết luận được hiệu năng; muốn kết luận phải đo trên nhiều test và so với 2·SE (Bài 4). Đừng bao giờ đảo vai hai loại bằng chứng này. Không có gì sai trong hai bảng số."
    },
    {
      id: "q9", loai: "mot", doKho: 1, ref: "§8",
      hoi: "Giới hạn “greedy chọn xong là chốt, không quay đầu” được khắc phục bằng kỹ thuật nào trong khoá?",
      chon: ["Local search (Phần 3)", "Beam search (Bài 16)", "GRASP (Bài 8)", "Quy hoạch động"],
      dung: 0,
      giaiThich: "Không quay đầu → local search sửa lại nghiệm đã có. Không nhìn trước → beam search giữ nhiều khả năng. Chỉ cho một nghiệm → GRASP ngẫu nhiên hoá và khởi động lại nhiều lần. Quy hoạch động không nằm trong ba hướng vá này."
    },
    {
      id: "q10", loai: "mot", doKho: 1, ref: "§9 (cạm bẫy 4)",
      hoi: "Vì sao điểm tích luỹ qua nhiều test của đề thi thật nên lưu bằng `long long` thay vì `int`?",
      chon: [
        "Tích luỹ qua 1 000 test lên cỡ 3×10¹⁰, vượt giới hạn của int 32 bit",
        "long long chạy nhanh hơn int",
        "int không lưu được số dương",
        "long long cho phép so sánh số thực chính xác hơn"
      ],
      dung: 0,
      giaiThich: "int 32 bit chứa tối đa khoảng 2,1×10⁹. Điểm một test có thể đã vài chục nghìn, cộng qua 1 000 test sẽ tràn. long long (64 bit) không tràn ở mức này; nó không nhanh hơn và không liên quan đến số thực."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "Bài tập 5.2",
      hoi: "Hãy dựng một bộ dữ liệu cái túi 0/1 chỉ với 3 món mà greedy theo tỉ số kém tối ưu **hơn 40 %**. Nêu rõ p, w, W và tính kết quả của cả hai.",
      goiY: ["Dùng cơ chế ở §4.3: món có tỉ số cao nhất nhưng kích thước không ăn khớp với sức chứa.", "Muốn sai nhiều hơn 40 %, hãy để món “tỉ số cao” chiếm hơn một nửa túi một chút (không phải tới 60 % như ở §4.3) và cần W đủ lớn."],
      mau: "Chọn W = 100, X (p=52, w=51), Y (p=50, w=50), Z (p=50, w=50).\n\n- Tỉ số: X = 1,0196; Y = Z = 1,0. Greedy lấy X trước (51 kg), còn 49 kg — Y và Z đều cần 50 nên không vừa. Tổng **52**.\n- Tối ưu: bỏ X, lấy Y + Z = 100 kg vừa khít, tổng **100**.\n- Greedy kém tối ưu (100 − 52) / 100 = **48 %** > 40 %.\n\nCơ chế: X chỉ hơn Y, Z đúng một chút về tỉ số nhưng nó chiếm hơn nửa túi, để lại mẩu ngân sách chết 49 kg. Ví dụ 7/6, 5/5, 5/5 ở §4.3 chỉ sai 30 %: X nặng 6/10 túi; vì tối ưu không thể vượt (p_X/w_X)·W nên greedy (≥ p_X) luôn đạt ít nhất w_X/W = 60 % tối ưu, tức sai tối đa 40 %. Muốn sai hơn 40 % thì X phải nhẹ hơn 60 % túi nhưng vẫn chặn được cả Y và Z — tức chiếm hơn một nửa túi một chút (51/100) — và điều đó cần W lớn.",
      tieuChi: ["Dữ liệu hợp lệ: có 3 món, Y và Z mỗi món vừa khít một nửa túi", "Món có tỉ số cao nhất nặng hơn một nửa W nên chặn cả hai món còn lại", "Tính đúng kết quả greedy và tối ưu, và tỉ lệ sai > 40 %"]
    },
    {
      id: "l2", doKho: 2, ref: "§4",
      hoi: "Giải thích bằng lời của bạn: vì sao greedy theo tỉ số **tối ưu** cho cái túi phân số nhưng **chỉ là heuristic** cho cái túi 0/1? Gợi ý: dùng ý “đổi chỗ”.",
      goiY: ["Nghĩ xem phép đổi chỗ cần chuyển bao nhiêu cân nặng giữa hai món.", "Δf có dấu thế nào khi chuyển từ món tỉ số thấp sang món tỉ số cao?"],
      mau: "Giả sử có nghiệm tối ưu khác nghiệm greedy. Chuyển một lượng ε cân nặng từ món k (tỉ số thấp) sang món i (tỉ số cao) thì tổng cân nặng không đổi và giá trị đổi một lượng Δf = ε·(p_i/w_i − p_k/w_k) ≥ 0, tức không tệ đi. Lặp lại thì biến được nghiệm tối ưu thành nghiệm greedy mà không giảm giá trị, nên greedy cũng tối ưu.\n\nBước này cần ε **nhỏ tuỳ ý** — chỉ có ở cái túi phân số (cắt món được). Với 0/1 chỉ chuyển được **cả món**, tổng cân nặng đổi và có thể vượt W, nên chứng minh gãy. Phản ví dụ: X(7,6), Y(5,5), Z(5,5), W=10. Cơ chế: tỉ số đo hiệu quả, không đo độ vừa vặn với ngân sách.",
      tieuChi: ["Nêu ý tưởng đổi chỗ một lượng ε giữa món tỉ số thấp và món tỉ số cao", "Chỉ ra Δf = ε(p_i/w_i − p_k/w_k) ≥ 0 và tổng cân nặng không đổi", "Chỉ ra 0/1 không chuyển được ε tuỳ ý nên chứng minh gãy", "Nêu được cơ chế “tỉ số không đo độ vừa vặn” hoặc dẫn phản ví dụ"]
    },
    {
      id: "l3", doKho: 2, ref: "Bài tập 5.3",
      hoi: "Xét chỉ số tham số hoá index(j) = p_j / (d_j + s_j)^α. α = 0 và α → ∞ cho ra chỉ số nào? α < 1 và α > 1 nghiêng về phía nào, vì sao?",
      goiY: ["Thử α = 0 rồi nhìn mẫu số.", "Khi α rất lớn, thứ nào trong p_j và (d_j + s_j)^α quyết định thứ hạng?"],
      mau: "- α = 0: mẫu số bằng 1 nên index = p_j — **greedy theo lợi ích** (tiền nhất).\n- α → ∞: (d_j + s_j)^α bùng nổ và áp đảo p_j, nên ứng viên có chi phí nhỏ nhất luôn thắng — **greedy theo chi phí** (d + s nhỏ nhất; trùng hẳn với “gần nhất” chỉ khi chi phí là quãng đường, không cộng s).\n- α = 1 là tỉ số thuần.\n- α < 1 giảm sức nặng của chi phí ⇒ nghiêng về lợi ích (tiền nhất); α > 1 tăng sức nặng chi phí ⇒ nghiêng về gần nhất.\n\nThực nghiệm trên P1 thường cho α ≈ 1,0–1,2 là tốt: chi phí nên được phạt hơi nặng hơn tỉ số thuần vì đi xa còn làm đơn sau đắt lên. Chỉ kết luận sau khi đo trên nhiều test.",
      tieuChi: ["Nêu α = 0 → p_j (tiền nhất) và α → ∞ → chi phí nhỏ nhất (xấp xỉ gần nhất)", "Giải thích α < 1 nghiêng về lợi ích, α > 1 nghiêng về chi phí", "Nhắc rằng cần đo trên nhiều test mới kết luận được α tốt nhất"]
    },
    {
      id: "l4", doKho: 3, ref: "§6.1, §9",
      hoi: "Greedy của bạn cho điểm gần như một thứ tự tuỳ ý. Hãy nêu ít nhất ba nguyên nhân có thể và cách kiểm tra rẻ cho từng nguyên nhân.",
      goiY: ["Nghĩ về chỉ số, về trạng thái, và về cách phá hoà.", "Mỗi nguyên nhân cần một phép kiểm chỉ tốn vài dòng code."],
      mau: "1. **Chỉ số thoái hoá** (mọi ứng viên gần bằng nhau, như subset-sum p = w). Kiểm tra: in σ/x̄ của chỉ số hoặc histogram; nếu σ/x̄ < 0,05 thì tìm chỉ số khác.\n2. **Không tính lại chỉ số khi trạng thái đổi** (P1: chi phí phụ thuộc vị trí hiện tại). Kiểm tra: so kết quả với bản tính lại ở mọi bước; nếu bản đúng khác nhiều thì bug nằm ở đây. Đây là bug im lặng vì nghiệm vẫn hợp lệ.\n3. **Phá hoà không nhất quán hoặc dùng `>=`** làm ứng viên bị đổi liên tục, kết quả phụ thuộc thứ tự duyệt. Kiểm tra: cố định quy tắc phá hoà (ứng viên có số thứ tự nhỏ hơn thắng) và chạy lại hai lần xem kết quả có tất định không.\n4. (Thêm) **Mẫu số bằng 0 / EPS** làm tỉ số bùng nổ. Kiểm tra: in ứng viên có chỉ số cực đại.",
      tieuChi: ["Nêu được ít nhất 3 nguyên nhân khác nhau", "Mỗi nguyên nhân đi kèm một cách kiểm tra cụ thể, rẻ", "Nhận ra bug “không tính lại chỉ số” là bug im lặng"]
    }
  ],

  lab: [
    {
      id: "tui-ti-so",
      ten: "Greedy theo tỉ số cho cái túi",
      doKho: 1,
      ref: "§3.3, §6",
      de: "Cài **greedy theo tỉ số** `p/w` cho bài cái túi 0/1: sắp các món theo tỉ số giảm dần, duyệt một lần và lấy món nào còn vừa.\n\n" +
          "Đây là P0 trong khoá: `n = 100` món, sức chứa bằng 40 % tổng khối lượng. Chấm trên 10 bộ dữ liệu.\n\n" +
          "**Mức đạt:** hợp lệ trên mọi test → bằng greedy theo giá trị → bằng greedy theo tỉ số. Sau đó hãy **đổi kiểu dữ liệu** (các “tab” Kiểu dữ liệu bên dưới) sang *tương quan mạnh* và *subset-sum* và quan sát: thứ hạng giữa các chỉ số có đảo ngược không? Vì sao? (§6.1)\n\n" +
          "Lưu ý chọn món nào “vẫn còn vừa” — không dừng ngay ở món đầu tiên không vừa.",
      vanDe: "tui",
      tham: { n: 100 },
      bienThe: [
        { ten: "Không tương quan", tham: { n: 100 } },
        { ten: "Tương quan mạnh (p = w + 0…20)", tham: { n: 100, kieu: "tuong-quan" } },
        { ten: "Subset-sum (p = w)", tham: { n: 100, kieu: "deu" } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [
        { ten: "Bằng greedy theo giá trị", so: "giaTri", heSo: 1 },
        { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 "n B"; rồi n dòng "w p".
// Đầu ra : dòng 1 là k (số món chọn), dòng 2 là k chỉ số (từ 1).
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const w = [], p = [];
for (let i = 0; i < n; i++) { w.push(t[2 + 2 * i]); p.push(t[3 + 2 * i]); }

const chon = [];
// TODO: sắp các món theo p/w giảm dần, duyệt một lần, lấy món nào còn vừa B.

print(chon.length);
print(chon.join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, B;
    scanf("%d %d", &n, &B);
    vector<int> w(n), p(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);

    vector<int> chon;
    // TODO: sắp các món theo p/w giảm dần, duyệt một lần, lấy món nào còn vừa B.

    printf("%d\n", (int)chon.size());
    for (size_t i = 0; i < chon.size(); i++) printf("%d%c", chon[i], i + 1 < chon.size() ? ' ' : '\n');
    if (chon.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], B = t[1];
const w = [], p = [];
for (let i = 0; i < n; i++) { w.push(t[2 + 2 * i]); p.push(t[3 + 2 * i]); }

// So sánh p_i/w_i > p_j/w_j bằng phép nhân chéo để khỏi sai số số thực; hoà thì món có số thứ tự nhỏ hơn thắng.
const thuTu = w.map((_, i) => i).sort((a, b) => p[b] * w[a] - p[a] * w[b] || a - b);
let con = B;
const chon = [];
for (const i of thuTu) {
  if (w[i] <= con) { con -= w[i]; chon.push(i + 1); }
}
print(chon.length);
print(chon.join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, B;
    scanf("%d %d", &n, &B);
    vector<int> w(n), p(n);
    for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);

    vector<int> thuTu(n);
    iota(thuTu.begin(), thuTu.end(), 0);
    sort(thuTu.begin(), thuTu.end(), [&](int a, int b) {
        long long l = (long long)p[a] * w[b], r = (long long)p[b] * w[a];   // p_a/w_a > p_b/w_b
        if (l != r) return l > r;
        return a < b;                                                        // phá hoà tất định
    });

    vector<int> chon;
    int con = B;
    for (int i : thuTu)
        if (w[i] <= con) { con -= w[i]; chon.push_back(i + 1); }

    printf("%d\n", (int)chon.size());
    for (size_t i = 0; i < chon.size(); i++) printf("%d%c", chon[i], i + 1 < chon.size() ? ' ' : '\n');
    if (chon.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "So sánh hai tỉ số p_a/w_a và p_b/w_b bằng phép nhân chéo p_a·w_b so với p_b·w_a — tránh số thực và chia cho 0.",
        "Sau khi sắp xếp, đừng `break` khi gặp món không vừa: các món nhỏ hơn phía sau vẫn có thể vừa.",
        "Khi hai món có cùng tỉ số, hãy phá hoà bằng số thứ tự nhỏ hơn để kết quả tất định (§9, cạm bẫy 3)."
      ]
    },
    {
      id: "ship1-ti-so",
      ten: "Greedy theo tỉ số cho ship hàng (P1) — tính lại chỉ số mỗi bước",
      doKho: 2,
      ref: "§5, §7, §9",
      de: "P1 trong khoá: lưới 100×100, kho ở (50,50), `n = 120` đơn. Đơn `i` ở `(x, y)`, trả `p` đồng, giao mất `s` phút; đi từ `u` sang `v` mất `|Δx| + |Δy|` phút. Ngày có 480 phút, bắt đầu từ kho, **không cần quay về**.\n\n" +
          "Cài greedy: ở mỗi bước, trong các đơn **còn vừa giờ**, chọn đơn có chỉ số `p / (d + s)` cao nhất, với `d` là thời gian đi **từ vị trí hiện tại** đến đơn đó. Dừng khi không đơn nào còn vừa.\n\n" +
          "Bộ chấm kiểm nghiêm: vượt giờ ở bất kỳ đơn nào là kết quả không hợp lệ.\n\n" +
          "**Mức đạt:** hợp lệ → bằng greedy theo tiền → bằng greedy gần nhất → bằng greedy theo tỉ số. Hãy thử cả dữ liệu *gom cụm*. Rồi tự hỏi: nếu chỉ sắp xếp **một lần** từ vị trí kho thay vì tính lại mỗi bước, điểm thay đổi thế nào? (§9, cạm bẫy 2)",
      vanDe: "ship1",
      tham: { n: 120 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 120 } },
        { ten: "Gom cụm", tham: { n: 120, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [
        { ten: "Bằng greedy theo tiền", so: "giaTri", heSo: 1 },
        { ten: "Bằng greedy gần nhất", so: "ganNhat", heSo: 1 },
        { ten: "Bằng greedy theo tỉ số", so: "tiSo", heSo: 1 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: "n T", rồi toạ độ kho "kx ky", rồi n dòng "x y p s".
// Đầu ra : dòng 1 là k (số đơn giao), dòng 2 là k chỉ số (từ 1) theo thứ tự ghé.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}

const tuyen = [];
let hienX = kx, hienY = ky, tg = 0;
const daDung = new Array(n).fill(false);
// TODO: lặp — trong các đơn chưa dùng mà còn vừa giờ (tg + d + s <= T),
//       chọn đơn có p / (d + s) cao nhất, với d tính từ (hienX, hienY).

print(tuyen.length);
print(tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T, kx, ky;
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    vector<int> tuyen;
    int hienX = kx, hienY = ky, tg = 0;
    vector<bool> daDung(n, false);
    // TODO: lặp — trong các đơn chưa dùng mà còn vừa giờ (tg + d + s <= T),
    //       chọn đơn có p / (d + s) cao nhất, với d tính từ (hienX, hienY).

    printf("%d\n", (int)tuyen.size());
    for (size_t i = 0; i < tuyen.size(); i++) printf("%d%c", tuyen[i] + 1, i + 1 < tuyen.size() ? ' ' : '\n');
    if (tuyen.empty()) printf("\n");
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], T = t[1], kx = t[2], ky = t[3];
const x = [], y = [], p = [], s = [];
for (let i = 0; i < n; i++) {
  x.push(t[4 + 4 * i]); y.push(t[5 + 4 * i]); p.push(t[6 + 4 * i]); s.push(t[7 + 4 * i]);
}

const tuyen = [];
let hienX = kx, hienY = ky, tg = 0;
const daDung = new Array(n).fill(false);
for (;;) {
  let tot = -1, diemTot = -Infinity, chiPhiTot = 0;
  for (let i = 0; i < n; i++) {
    if (daDung[i]) continue;
    const d = Math.abs(x[i] - hienX) + Math.abs(y[i] - hienY);   // tính từ vị trí HIỆN TẠI
    const chiPhi = d + s[i];
    if (tg + chiPhi > T) continue;
    const diem = p[i] / (chiPhi + 1);                             // +1: chống chia 0 (§9)
    if (diem > diemTot) { diemTot = diem; tot = i; chiPhiTot = chiPhi; }
  }
  if (tot < 0) break;
  daDung[tot] = true; tuyen.push(tot);
  tg += chiPhiTot; hienX = x[tot]; hienY = y[tot];
}
print(tuyen.length);
print(tuyen.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, T, kx, ky;
    scanf("%d %d %d %d", &n, &T, &kx, &ky);
    vector<int> x(n), y(n), p(n), s(n);
    for (int i = 0; i < n; i++) scanf("%d %d %d %d", &x[i], &y[i], &p[i], &s[i]);

    vector<int> tuyen;
    int hienX = kx, hienY = ky, tg = 0;
    vector<bool> daDung(n, false);
    for (;;) {
        int tot = -1, chiPhiTot = 0;
        double diemTot = -1e18;
        for (int i = 0; i < n; i++) {
            if (daDung[i]) continue;
            int d = abs(x[i] - hienX) + abs(y[i] - hienY);   // tính từ vị trí HIỆN TẠI
            int chiPhi = d + s[i];
            if (tg + chiPhi > T) continue;
            double diem = (double)p[i] / (chiPhi + 1);        // +1: chống chia 0 (§9)
            if (diem > diemTot) { diemTot = diem; tot = i; chiPhiTot = chiPhi; }
        }
        if (tot < 0) break;
        daDung[tot] = true; tuyen.push_back(tot);
        tg += chiPhiTot; hienX = x[tot]; hienY = y[tot];
    }

    printf("%d\n", (int)tuyen.size());
    for (size_t i = 0; i < tuyen.size(); i++) printf("%d%c", tuyen[i] + 1, i + 1 < tuyen.size() ? ' ' : '\n');
    if (tuyen.empty()) printf("\n");
    return 0;
}
`
      },
      goiY: [
        "Ở mỗi bước phải tính lại d từ vị trí **hiện tại** — không phải từ kho.",
        "Chỉ xét đơn mà tg + d + s ≤ T; khi không còn đơn nào thoả thì dừng.",
        "Hãy đo thử hai biến thể: tính lại chỉ số mỗi bước và chỉ sắp xếp một lần từ kho. Chênh lệch điểm cho bạn thấy bug im lặng đắt cỡ nào."
      ]
    }
  ]
});
