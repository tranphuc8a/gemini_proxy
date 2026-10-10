/* Thực hành — Bài 9: Lân cận & leo đồi.
   Bài toán tự dựng: b09-dem-danh-gia (tuDapAn) — đếm số lần đánh giá của ba cách quét lân cận 2-opt. */
(function () {
  var TI = TH.tienIch, VD = TH.vande;

  /* Dữ liệu: n điểm nguyên trên lưới 100×100, khoảng cách Manhattan (số nguyên ⇒ mọi so sánh chính xác tuyệt đối). */
  function sinh(seed, tham) {
    var r = TI.rng(seed), n = (tham && tham.n) || 40, x = [], y = [];
    for (var i = 0; i < n; i++) { x.push(r.khoang(0, 99)); y.push(r.khoang(0, 99)); }
    return { n: n, x: x, y: y };
  }
  function viet(inst) {
    var s = inst.n + "\n";
    for (var i = 0; i < inst.n; i++) s += inst.x[i] + " " + inst.y[i] + "\n";
    return s;
  }
  /* Chạy một cách leo đồi 2-opt từ tuyến 0..n−1; trả [số nước nhận, số lần đánh giá, độ dài cuối]. */
  function chay(inst, cach) {
    var n = inst.n, q = [], i, j, doi, dem = 0, nuoc = 0;
    for (i = 0; i < n; i++) q.push(i);
    function d(a, b) { return Math.abs(inst.x[a] - inst.x[b]) + Math.abs(inst.y[a] - inst.y[b]); }
    function delta(i, j) {
      var a = q[i], b = q[i + 1], c = q[j], e = q[(j + 1) % n];
      return d(a, c) + d(b, e) - d(a, b) - d(c, e);
    }
    function dao(i, j) { for (var l = i + 1, h = j; l < h; l++, h--) { var t = q[l]; q[l] = q[h]; q[h] = t; } }
    if (cach === "A") {                       /* đầu tiên, quay lại từ đầu */
      do {
        doi = false;
        for (i = 0; i < n - 1 && !doi; i++) {
          for (j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            dem++;
            if (delta(i, j) < 0) { dao(i, j); nuoc++; doi = true; break; }
          }
        }
      } while (doi);
    } else if (cach === "B") {                /* đầu tiên, quét tiếp */
      do {
        doi = false;
        for (i = 0; i < n - 1; i++) {
          for (j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            dem++;
            if (delta(i, j) < 0) { dao(i, j); nuoc++; doi = true; }
          }
        }
      } while (doi);
    } else {                                  /* tốt nhất */
      for (;;) {
        var tot = 0, ti = -1, tj = -1;
        for (i = 0; i < n - 1; i++) {
          for (j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            dem++;
            var v = delta(i, j);
            if (v < tot) { tot = v; ti = i; tj = j; }
          }
        }
        if (ti < 0) break;
        dao(ti, tj); nuoc++;
      }
    }
    var L = 0;
    for (i = 0; i < n; i++) L += d(q[i], q[(i + 1) % n]);
    return [nuoc, dem, L];
  }

  VD.dangKy("b09-dem-danh-gia", VD.tuDapAn({
    sinh: sinh,
    viet: viet,
    giai: function (inst) { return [chay(inst, "A"), chay(inst, "B"), chay(inst, "C")]; },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `n`. Tiếp theo `n` dòng, dòng `i` là `x y` — toạ độ nguyên (0..99) của điểm `i` (đánh số từ 0). Khoảng cách là **Manhattan** `|Δx| + |Δy|`. Tuyến xuất phát là chính thứ tự `0, 1, …, n−1` (khép kín).",
      ra: "Một dòng gồm **chín số nguyên**: `nuocA lanA daiA  nuocB lanB daiB  nuocC lanC daiC` — với mỗi cách (A, B, C): số nước đã nhận, số lần tính Δ (đánh giá), độ dài tuyến cuối cùng."
    }
  }));
})();

TH.dangKy({
  id: "bai-09-lan-can-leo-doi",

  tomTat: [
    "Leo đồi: lấy một lời giải có sẵn, thử mọi phép sửa nhỏ (nước đi), nhận cái nào tốt hơn, lặp cho tới khi **không còn phép sửa nào tốt hơn**. Ba cái tên: lân cận N(x) = tập lời giải cách x đúng một nước đi; nước đi cải thiện; cực trị cục bộ.",
    "Điểm dễ hiểu sai nhất: cực trị cục bộ **không** phải tính chất của bài toán mà của **cặp (bài toán, lân cận)**. Tuyến dài 50 ở ví dụ 5 điểm là cực trị cục bộ với “đảo một khúc” nhưng không còn là cực trị cục bộ nếu thêm “bỏ một điểm” (còn 40). Kẹt thường do tập nước đi quá hẹp — thoát bằng cách **thêm kiểu nước đi**, không phải chạy lâu hơn.",
    "Đếm lân cận trước khi viết code (P1, n = 120, m = 14): đảo đoạn 91; chuyển đoạn (L ≤ 3, đếm đúng 14·13 + 13·12 + 12·11) = 470; chèn (n − m)(m + 1) = 1 590; bỏ 14; đổi m·(n − m)·m = 20 776 — gấp ≈ 228 lần đảo đoạn. Lân cận lớn mạnh hơn nhưng đắt đúng bằng tỉ lệ đó.",
    "Bốn tính chất của một lân cận tốt: **liên thông**, kích thước vừa phải, tính địa phương (hàng xóm có điểm gần điểm hiện tại), và delta tính nhanh O(1). Ví dụ phá liên thông: P1 chỉ có đảo đoạn + chuyển đoạn thì tập đơn được chọn không bao giờ đổi.",
    "Hai cách leo: **first-improvement** (nhận nước cải thiện đầu tiên gặp — mặc định, thường nhanh hơn 2–5 lần với thứ tự duyệt được xáo trộn; nếu mỗi lần lại duyệt từ cùng một đầu danh sách cố định thì lợi thế mỏng hơn nhiều) và **best-improvement** (duyệt hết rồi nhận nước tốt nhất); chất lượng chỗ dừng tương đương. Mẹo “bit đừng nhìn lại” nhanh thêm 3–10 lần nhưng phải mở lại các phần tử bị ảnh hưởng.",
    "Số liệu: TSP n = 200, khởi tạo 16 828 → leo đồi 14 656 (−12,9 % trong 0,5 ms). P1: từ greedy tỉ số yếu 61 420 → ≈ 64 200 (+4,5 %), nhưng từ chèn rẻ nhất mạnh 65 425 → 65 718 (+0,45 %). Lời giải ban đầu càng yếu, leo đồi càng lãi.",
    "Bề mặt gồ ghề: 20 lần leo từ điểm ngẫu nhiên cho kết quả từ 18 980 đến 24 240 (tệ nhất / tốt nhất trong 20 lần = 1,277 — chưa phải khoảng cách tới tối ưu thật, vốn chỉ có thể lớn hơn), trong khi một lần leo từ khởi tạo tốt cho 14 656. Bài lớn hơn (n = 600) phân tán chỉ 1,158 — các lần chạy giống nhau hơn nên chạy nhiều lần ít lợi hơn. (Đây là số đo từ mã gốc, không còn trong repo; dựng lại độc lập cho độ phân tán nhỏ hơn — tệ nhất / tốt nhất ≈ 1,06–1,11 ở n = 200 — và khởi tạo tốt thắng trung bình các lần ngẫu nhiên; kết luận định tính giữ nguyên, độ lớn phụ thuộc cách cài đặt.)",
    "Cạm bẫy: nhận nước có delta = 0 (`delta <= 0`) gây lặp vô hạn — dùng `delta < −1e−9`; quên kiểm ràng buộc sau nước đi (P1: chèn vượt 480 phút); không có `maxVong`; tin rằng leo đồi tìm được tối ưu. Thứ tự toán tử: giải phóng tài nguyên trước, tiêu thụ sau."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "§2.1, §3.1",
      hoi: "Trong bài này, “lân cận” N(x) của một lời giải x được định nghĩa thế nào?",
      chon: [
        "Tập mọi lời giải nằm gần x trên bản đồ, theo nghĩa hình học",
        "Tập mọi lời giải thu được từ x bằng đúng một nước đi mà bạn đã cài đặt",
        "Tập mọi lời giải có điểm số tốt hơn x",
        "Tập mọi lời giải mà từ x đi tới được sau hữu hạn nước đi"
      ],
      dung: 1,
      giaiThich: "N(x) là tập kết quả của việc áp toán tử lên x với mọi bộ tham số. “Gần” chỉ nghĩa là cách nhau một nước đi bạn đã cài — hai tuyến trông rất khác nhau vẫn có thể là hàng xóm, nên không phải nghĩa hình học. Lân cận cũng chứa cả những nước làm tệ đi (không chỉ nước tốt hơn), còn “đi tới sau hữu hạn nước” là tính liên thông, không phải định nghĩa."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "§2.3",
      hoi: "Tuyến 0→1→2→3→4→0 (dài 50) là cực trị cục bộ khi lân cận là “đảo một khúc”, nhưng không còn là cực trị cục bộ nếu lân cận cho phép thêm “bỏ một điểm ra khỏi tuyến” (bài toán chọn lọc như P1). Điều này cho thấy gì?",
      chon: [
        "Cực trị cục bộ là tính chất riêng của lời giải, không phụ thuộc cách định nghĩa lân cận",
        "“Đảo một khúc” là lân cận sai, luôn phải thay bằng lân cận lớn hơn",
        "Cực trị cục bộ là tính chất của cặp (bài toán, lân cận), không phải của riêng bài toán",
        "Tuyến dài 50 thật ra không phải cực trị cục bộ, chỉ là kiểm tra chưa đủ kỹ"
      ],
      dung: 2,
      giaiThich: "Cùng một tuyến, đổi tập nước đi thì đổi kết luận: với “đảo khúc” mọi hàng xóm đều không ngắn hơn (đã kiểm ở §1.5), nhưng với “bỏ điểm 4” tuyến còn 40. Vì thế khi thuật toán kẹt, thường là tập nước đi quá hẹp chứ không phải bài toán khó. Lân cận lớn hơn không “luôn” là đáp án — nó đắt hơn (§3.3) — và tuyến 50 đúng là cực trị cục bộ của lân cận “đảo khúc”."
    },
    {
      id: "q3", loai: "so", doKho: 1, ref: "§3.2", donVi: "(cặp)",
      hoi: "P1 có n = 120 đơn, tuyến hiện dài m = 14 đơn. Có bao nhiêu nước **chèn** khác nhau, tính theo cặp (đơn chưa dùng, vị trí chèn)? Nhớ rằng tuyến m đơn có m + 1 vị trí chèn.",
      dapAn: 1590, saiSo: 0,
      giaiThich: "Có n − m = 106 đơn chưa dùng và m + 1 = 15 vị trí (trước đơn đầu, giữa các đơn, và sau đơn cuối): 106 × 15 = 1 590. Quên vị trí cuối sẽ ra 106 × 14 = 1 484."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§4.3",
      hoi: "Bạn cần chọn cách leo đồi mặc định cho một bài TSP lớn. Lựa chọn nào hợp lý nhất, và vì sao?",
      chon: [
        "Best-improvement, vì mỗi vòng nhận nước tốt nhất nên tổng thời gian luôn thấp hơn",
        "Best-improvement, vì nó bảo đảm dừng ở cực trị toàn cục",
        "Hai cách chênh nhau rất xa về chất lượng chỗ dừng nên phải thử cả hai trên từng bài rồi mới chọn",
        "First-improvement: mỗi bước rẻ vì dừng ngay khi gặp nước cải thiện (ở các vòng đầu nó xuất hiện rất sớm), thường nhanh hơn 2–5 lần (khi thứ tự duyệt được xáo trộn) với chất lượng tương đương"
      ],
      dung: 3,
      giaiThich: "First-improvement nhận nước cải thiện ngay nên không phải duyệt hết hàng chục nghìn nước chỉ để tìm cái nhỉnh hơn một chút; chất lượng chỗ dừng tương đương, và cần xáo thứ tự duyệt để không luôn sửa cùng một vùng (nếu mỗi lần lại duyệt từ cùng một đầu danh sách cố định thì lợi thế tốc độ mỏng hơn nhiều). Best-improvement cần ít bước hơn nhưng mỗi bước đắt, tổng thời gian thường cao hơn; và không cách nào bảo đảm tối ưu toàn cục — cả hai đều dừng ở cực trị cục bộ."
    },
    {
      id: "q5", loai: "nhieu", doKho: 2, ref: "§3.4",
      hoi: "Những tính chất nào là của một cấu trúc lân cận tốt?",
      chon: [
        "Liên thông: từ mọi lời giải đều đi tới được lời giải tối ưu qua hữu hạn nước đi",
        "Kích thước vừa phải: đủ lớn để có cơ hội cải thiện, đủ nhỏ để duyệt nhanh",
        "Tính địa phương: lời giải hàng xóm có điểm số gần điểm số hiện tại",
        "Delta tính nhanh: chênh lệch điểm của một nước đi tính được trong O(1)",
        "Mọi hàng xóm đều có điểm cao hơn lời giải hiện tại",
        "Lân cận phải chứa sẵn lời giải tối ưu toàn cục"
      ],
      dung: [0, 1, 2, 3],
      giaiThich: "Bốn tính chất của §3.4 là liên thông, kích thước vừa phải, tính địa phương và delta nhanh (bắt buộc — Bài 10). “Mọi hàng xóm đều tốt hơn” sai: hàng xóm gồm cả nước làm tệ đi, và nếu mọi hàng xóm đều tốt hơn thì đó là cực tiểu chứ không phải điều ta cần. “Chứa sẵn tối ưu” cũng sai: liên thông chỉ đòi hỏi *đi tới được* qua nhiều nước, không đòi hỏi tối ưu là hàng xóm trực tiếp."
    },
    {
      id: "q6", loai: "mot", doKho: 2, ref: "§3.4, §8 (cạm bẫy 1)",
      hoi: "Bạn cài leo đồi cho P1 chỉ với đảo đoạn và chuyển đoạn. Điểm chạm trần rồi đứng yên, dù bạn tăng thời gian hay đổi tham số. Nguyên nhân có khả năng nhất là gì?",
      chon: [
        "Lân cận không liên thông: hai toán tử chỉ đổi thứ tự, nên tập đơn được chọn không bao giờ thay đổi — cần thêm chèn, bỏ hoặc đổi",
        "Phải tăng `maxVong` vì thuật toán dừng sớm",
        "Phải chuyển từ first-improvement sang best-improvement",
        "Hàm mục tiêu của P1 không tính được delta nên local search không có tác dụng"
      ],
      dung: 0,
      giaiThich: "Đảo đoạn và chuyển đoạn đều giữ nguyên *tập* đơn; nếu cách xây ban đầu chọn sai tập, bạn kẹt vĩnh viễn — dấu hiệu là điểm chạm trần rồi đứng yên bất kể thời gian. Tăng maxVong hay đổi chiến lược duyệt không mở thêm nước đi nào; còn delta của P1 hoàn toàn tính được (Bài 10)."
    },
    {
      id: "q7", loai: "so", doKho: 2, ref: "§1.2–1.4", donVi: "(đơn vị)",
      hoi: "TSP 5 điểm ở §1 (toạ độ (y, x): 0 = (0,0), 1 = (0,10), 2 = (10,10), 3 = (10,0), 4 = (5,5); khoảng cách Manhattan) có tuyến 0→1→3→2→4→0 dài 60. Đảo khúc gồm hai phần tử cuối `2, 4` (vị trí 3 và 4, đếm từ 0) thì tuyến mới dài bao nhiêu?",
      dapAn: 70, saiSo: 0,
      giaiThich: "Chỉ hai cạnh bị thay: bỏ 3→2 (10) và 4→0 (10), thêm 3→4 (10) và 2→0 (20). Δ = (10 + 20) − (10 + 10) = +10 ⇒ 60 + 10 = 70. Kiểm bằng cộng lại: 0→1→3→4→2→0 = 10 + 20 + 10 + 10 + 20 = 70. Nước này làm tuyến dài thêm nên leo đồi không nhận. Chú ý khúc chạm cuối tuyến kín: q[j+1] quay vòng về q[0]."
    },
    {
      id: "q8", loai: "mot", doKho: 2, ref: "§7.3",
      hoi: "Trên TSP n = 200, 20 lần leo đồi từ điểm ngẫu nhiên cho kết quả từ 18 980 đến 24 240, còn một lần leo từ nghiệm láng giềng gần nhất cho 14 656. Nếu ngân sách của bạn là 20 đơn vị thời gian, bài học nào dùng được?",
      chon: [
        "Chia đều 20 đơn vị cho 20 lần leo từ điểm ngẫu nhiên rồi lấy kết quả tốt nhất",
        "Leo từ điểm ngẫu nhiên tốt hơn từ nghiệm greedy vì tránh bị kẹt sớm",
        "Dành 1 đơn vị xây lời giải ban đầu tốt và 19 đơn vị còn lại để cải thiện nó — với điều kiện cách xây đó thật sự tốt",
        "Không nên dùng leo đồi vì kết quả phân tán quá lớn"
      ],
      dung: 2,
      giaiThich: "Trong số đo gốc, kết quả tốt nhất trong 20 lần ngẫu nhiên (18 980) vẫn tệ hơn một lần leo từ khởi tạo tốt (14 656); dựng lại độc lập thì khởi tạo tốt thắng trung bình các lần ngẫu nhiên, còn khi n lớn thường thắng cả lần tốt nhất, nhưng khoảng cách nhỏ hơn: điểm xuất phát quan trọng hơn số lần thử. Điều kiện đi kèm là cách khởi tạo phải thật sự tốt; nếu bài của bạn chưa có cách xây lời giải tử tế thì thứ tự ưu tiên đảo lại (§7.3). Phân tán lớn không có nghĩa là bỏ leo đồi — nó nghĩa là cần đầu tư vào điểm xuất phát."
    },
    {
      id: "q9", loai: "nhieu", doKho: 2, ref: "§8 (cạm bẫy 2–4)",
      hoi: "Những cách làm nào dưới đây là cạm bẫy (bug) khi cài leo đồi cho bài cực tiểu hoá?",
      chon: [
        "`if (delta <= 0) apDung();` — nhận cả nước không làm đổi điểm",
        "Vòng leo đồi không có giới hạn `maxVong`",
        "Áp dụng nước chèn của P1 mà không kiểm tra tổng thời gian còn ≤ 480 phút",
        "Xáo trộn thứ tự duyệt lân cận giữa các vòng khi dùng first-improvement",
        "Với số thực, chỉ nhận nước khi `delta < -1e-9`"
      ],
      dung: [0, 1, 2],
      giaiThich: "Nhận delta = 0 có thể đi đi lại lại giữa hai lời giải cùng điểm mãi mãi; thiếu maxVong khiến một lỗi delta tinh vi lặp vô hạn mà bạn không biết; còn nước chèn có thể làm vượt ngân sách nên phải kiểm trước khi áp dụng. Hai cách làm cuối là khuyến nghị chứ không phải bug: xáo thứ tự để không luôn sửa cùng một vùng, và ngưỡng 1e−9 để sai số số thực không bị coi là cải thiện."
    },
    {
      id: "q10", loai: "mot", doKho: 3, ref: "§4.4",
      hoi: "Khi dùng mẹo “bit đừng nhìn lại”, bạn quên bước mở lại các phần tử bị ảnh hưởng bởi nước vừa nhận. Hậu quả là gì?",
      chon: [
        "Thuật toán lặp vô hạn vì phần tử bị đánh dấu mãi",
        "Nghiệm trở nên không hợp lệ vì cấu trúc bị hỏng",
        "Không có hậu quả gì ngoài việc chạy chậm hơn một chút",
        "Thuật toán dừng sớm hơn đáng lẽ: có phần tử từng “vô vọng” nay đã có nước cải thiện nhưng không được xét, nên nghiệm cuối chưa phải cực trị cục bộ"
      ],
      dung: 3,
      giaiThich: "Mẹo chỉ đúng khi quanh phần tử không có gì thay đổi. Một nước vừa nhận đổi các cạnh quanh chỗ đó, nên phần tử cũ có thể lại có cơ hội; nếu không mở lại, nó bị bỏ qua và thuật toán kết thúc sớm — nghiệm vẫn hợp lệ nhưng kém hơn (bug im lặng, đúng kiểu cảnh báo ở bài). Nó không gây lặp vô hạn (chỉ đánh dấu thêm “đừng nhìn”) và cũng không phải chỉ là chuyện tốc độ."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 1, ref: "Bài tập 9.1",
      hoi: "P1 có n = 200 đơn, tuyến hiện tại dài m = 20 đơn. Tính kích thước lân cận của: (a) đảo đoạn, (b) chuyển đoạn với L ≤ 3, (c) chèn, (d) bỏ, (e) đổi — theo cách đếm ở §3.2. Lân cận nào đắt nhất, và nó buộc bạn thiết kế thế nào?",
      goiY: ["Chèn: (n − m) đơn chưa dùng × (m + 1) vị trí.", "Đổi: bỏ một trong m đơn, chọn một trong (n − m) đơn chưa dùng, chèn vào một trong m vị trí."],
      mau: "- (a) Đảo đoạn: C(20, 2) = 20·19/2 = **190**.\n- (b) Chuyển đoạn L ≤ 3: mỗi L có (m − L + 1) đoạn × (m − L) vị trí đích khác chỗ cũ, nên 20·19 + 19·18 + 18·17 = 380 + 342 + 306 = **1 028** (công thức xấp xỉ 3m² cho 1 200).\n- (c) Chèn: (n − m)·(m + 1) = 180 × 21 = **3 780**.\n- (d) Bỏ: m = **20**.\n- (e) Đổi: m·(n − m)·m = 20 × 180 × 20 = **72 000**.\n\nTổng cộng ≈ 77 000 lời giải phải xét mỗi lượt. “Đổi” áp đảo: gấp 72 000 / 190 ≈ **379 lần** đảo đoạn.\n\nHệ quả thiết kế: nếu mỗi lần chấm tốn O(m) = 20 phép thì một lượt ≈ 1,5 triệu phép; nếu tính lại toàn bộ O(n) = 200 phép thì ≈ 15 triệu và chậm gấp 10 lần nữa. Lân cận lớn thì mạnh hơn (ít bị kẹt) nhưng đắt đúng bằng tỉ lệ đó ⇒ cần delta O(1) (Bài 10) và nên dùng lân cận nhỏ cho tới khi hết nước rồi mới mở sang lân cận lớn (Bài 15).",
      tieuChi: ["Đếm đúng đảo đoạn 190, chèn 3 780 và đổi 72 000 (chuyển đoạn đếm đúng 1 028, công thức xấp xỉ 3m² cho 1 200)", "Nhận ra “đổi” là lân cận lớn nhất, gấp khoảng 379 lần đảo đoạn", "Rút ra hệ quả: lân cận lớn mạnh hơn nhưng đắt tương ứng ⇒ cần delta O(1) và/hoặc dùng lân cận nhỏ trước"]
    },
    {
      id: "l2", doKho: 2, ref: "Bài tập 9.2",
      hoi: "Với TSP 5 điểm ở §1 (Manhattan), từ tuyến ban đầu 0→1→3→2→4→0 (dài 60), hãy liệt kê mọi nước 2-opt — mỗi nước là một cặp cạnh **không kề nhau** được thay — tính Δ của từng nước bằng công thức §1.4 và cho biết có bao nhiêu nước làm tuyến ngắn đi.",
      goiY: ["Tuyến kín 5 cạnh: có bao nhiêu cặp cạnh không kề nhau?", "Đảo khúc [i..j] và đảo phần bù của nó cho cùng một chu trình — đừng đếm hai lần."],
      mau: "Tuyến kín 5 cạnh e₀ = (0,1) = 10, e₁ = (1,3) = 20, e₂ = (3,2) = 10, e₃ = (2,4) = 10, e₄ = (4,0) = 10. Số cặp cạnh không kề nhau là 5·(5 − 3)/2 = **5** nước 2-opt khác nhau (đảo 10 cặp vị trí rồi loại các phép đảo không đổi chu trình và các phép trùng nhau cũng cho đúng 5 chu trình).\n\n| Cặp cạnh thay | Cạnh mới | Δ |\n|---|---|---:|\n| e₀, e₂ | (0,3), (1,2) | 10 + 10 − 10 − 10 = **0** |\n| e₀, e₃ | (0,2), (1,4) | 20 + 10 − 10 − 10 = **+10** |\n| e₁, e₃ | (1,2), (3,4) | 10 + 10 − 20 − 10 = **−10** |\n| e₁, e₄ | (1,4), (3,0) | 10 + 10 − 20 − 10 = **−10** |\n| e₂, e₄ | (3,4), (2,0) | 10 + 20 − 10 − 10 = **+10** |\n\nCó **hai** nước cải thiện, cùng Δ = −10: thay e₁, e₃ cho 0→1→2→3→4→0 (dài 50) và thay e₁, e₄ cho 0→1→4→2→3→0 (cũng dài 50). Nếu bạn đếm ra “chỉ một nước” thì hãy kiểm lại: đảo [2..3] và đảo [2..4] là hai chu trình khác nhau. Từ tuyến 50, mọi nước 2-opt còn lại đều có Δ ≥ 0 nên đó là cực trị cục bộ — và (§1.6) cũng là tối ưu.",
      tieuChi: ["Nhận ra chu trình 5 cạnh có 5 nước 2-opt khác nhau (5 cặp cạnh không kề nhau), không đếm trùng đảo đoạn và đảo phần bù", "Tính đúng Δ của năm nước: 0, +10, −10, −10, +10", "Kết luận có **hai** nước cải thiện (cùng Δ = −10), không phải một", "Nêu rằng tuyến dài 50 là cực trị cục bộ (mọi Δ ≥ 0)"]
    },
    {
      id: "l3", doKho: 2, ref: "§2.3, §3.4",
      hoi: "Một bạn nói: “Local search của tôi kẹt, chắc bài này khó quá — để tôi chạy thêm 10 phút nữa.” Dùng ý “cực trị cục bộ là tính chất của cặp (bài toán, lân cận)” để chỉ ra điều bạn đó nên làm khác đi, và dẫn một ví dụ cụ thể của P1.",
      goiY: ["Kẹt nghĩa là mọi hàng xóm trong lân cận hiện tại đều không tốt hơn — lân cận ấy do ai chọn?", "Nghĩ tới việc P1 được phép chọn lọc đơn, còn TSP thì không."],
      mau: "Kẹt nghĩa là mọi hàng xóm trong **lân cận hiện tại** đều không tốt hơn. Đó là tính chất của cặp (bài toán, tập nước đi), không phải của riêng bài toán: đổi tập nước đi là đổi cả địa hình. Chạy thêm 10 phút trong cùng một lân cận chỉ lặp lại cùng một kết luận.\n\nViệc nên làm: kiểm tra tập nước đi có quá hẹp hoặc không liên thông không, rồi **thêm kiểu nước đi** (Bài 11 dạy năm kiểu, Bài 15 dạy chuyển lân cận khi kẹt).\n\nVí dụ P1: nếu chỉ có đảo đoạn và chuyển đoạn thì tập đơn được chọn không bao giờ đổi — nếu cách xây ban đầu chọn sai tập thì kẹt vĩnh viễn; thêm chèn/bỏ/đổi cho phép thay tập và nghiệm “kẹt” lập tức có nước cải thiện. Ví dụ nhỏ ở §2.3: tuyến dài 50 kẹt với “đảo khúc” nhưng với “bỏ điểm 4” còn 40 (phép bỏ chỉ hợp lệ khi bài cho phép chọn lọc, như P1).",
      tieuChi: ["Nêu: cực trị cục bộ phụ thuộc cặp (bài toán, lân cận), không chỉ bài toán", "Giải thích chạy lâu hơn trong cùng lân cận không thoát được", "Đề xuất **thêm kiểu nước đi** thay vì chạy lâu hơn", "Dẫn ví dụ cụ thể: P1 thiếu chèn/bỏ ⇒ tập đơn bất biến (hoặc tuyến 50 + “bỏ điểm 4”)"]
    },
    {
      id: "l4", doKho: 3, ref: "Bài tập 9.5, §5.2",
      hoi: "Trong `leoDoi` của P1, thứ tự toán tử là: đảo đoạn → chuyển đoạn → lấp đầy thời gian dư (chèn) → đổi đơn. Nếu đặt `themDonTotNhat` (chèn) lên đầu, bạn dự đoán điểm thay đổi thế nào? Hãy nêu dự đoán và lập luận **trước khi** đo, rồi phát biểu nguyên tắc chung.",
      goiY: ["Toán tử nào làm tuyến ngắn lại (giải phóng thời gian), toán tử nào dùng thời gian dư để nhận thêm đơn?", "Chuyện gì xảy ra với phần thời gian vừa được giải phóng nếu chèn đã chạy xong trước đó?"],
      mau: "Dự đoán: điểm **không tăng**, giảm nhẹ cỡ 1–2 % (tài liệu đo được cỡ đó).\n\nLập luận: đảo đoạn và chuyển đoạn làm tuyến ngắn lại — chúng **giải phóng thời gian**. Chèn **tiêu thụ** thời gian dư bằng cách nhận thêm đơn. Nếu chèn chạy trước, nó lấp hết thời gian hiện có rồi dừng; thời gian mà đảo đoạn/chuyển đoạn giải phóng sau đó không còn ai dùng trong cùng vòng (phải đợi vòng lặp sau, hoặc không bao giờ nếu vòng ngoài đã dừng). Thứ tự đúng — giải phóng rồi mới tiêu thụ — cho phép nhận thêm đơn ngay trong vòng này.\n\nNguyên tắc: đặt toán tử **giải phóng tài nguyên** trước toán tử **tiêu tài nguyên**; một chuỗi toán tử là **đường ống**, không phải tập hợp — với từng cặp hãy hỏi “cái nào mở ra cơ hội cho cái nào”. Muốn kết luận chênh lệch 1–2 % thì phải đo trên nhiều test và so với 2·SE (Bài 4).",
      tieuChi: ["Dự đoán điểm không tăng (giảm nhẹ, cỡ 1–2 %)", "Phân biệt toán tử giải phóng thời gian (đảo đoạn, chuyển đoạn) với toán tử tiêu thụ thời gian (chèn)", "Phát biểu nguyên tắc: giải phóng tài nguyên trước, tiêu thụ sau (đường ống)", "Nhắc đo trên nhiều test vì chênh lệch nhỏ"]
    }
  ],

  lab: [
    {
      id: "tsp-leo-doi-2opt",
      ten: "Leo đồi 2-opt trên TSP — và đếm số lần đánh giá",
      doKho: 2,
      ref: "§4, §6.1, §7",
      de: "Cài **leo đồi 2-opt** cho bài chu trình ngắn nhất (`tsp`): `n = 100` điểm trên lưới 1000×1000, khoảng cách Euclid, chu trình khép kín. Chấm trên 10 bộ dữ liệu.\n\n" +
          "Khung đã dựng sẵn bảng khoảng cách và tuyến xuất phát bằng **láng giềng gần nhất** (Bài 5). Việc của bạn: lặp — thử mọi nước đảo đoạn `(i, j)`; nước nào có Δ = d(a,c) + d(b,d) − d(a,b) − d(c,d) < −10⁻⁹ thì nhận (đảo `p[i+1..j]`) — cho tới khi không còn nước cải thiện. Chọn **first-improvement** (nhận ngay) hoặc **best-improvement** (duyệt hết, nhận nước tốt nhất).\n\n" +
          "**Mức đạt:** hợp lệ → ngắn hơn greedy ít nhất 9 % → bằng leo đồi 2-opt chuẩn của khoá (sai lệch tối đa 1 %).\n\n" +
          "**Sau khi qua, hãy tự đo** (dùng biến `soDanhGia`, `soNuoc` và `log(...)`): (1) chạy **cả hai** cách rồi so — chất lượng gần như nhau nhưng số lần đánh giá chênh nhau bao nhiêu lần? (2) đổi điểm xuất phát sang thứ tự `0, 1, …, n−1` (gần như ngẫu nhiên): số nước nhận và chất lượng thay đổi ra sao, và nó nói gì về câu “điểm xuất phát quan trọng hơn số lần thử” (§7.3)? Một seed chưa đủ kết luận — thử cả biến thể *Gom cụm*. (3) Khi dừng, tuyến của bạn có chắc là tối ưu không? Vì sao?",
      vanDe: "tsp",
      tham: { n: 100 },
      bienThe: [
        { ten: "Rải đều", tham: { n: 100 } },
        { ten: "Gom cụm", tham: { n: 100, cum: true } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      muc: [
        { ten: "Ngắn hơn láng giềng gần nhất ít nhất 9 %", so: "ganNhat", heSo: 1.1 },
        { ten: "Bằng leo đồi 2-opt chuẩn của khoá (sai lệch ≤ 1 %)", so: "haiOpt", heSo: 0.99 }
      ],
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là n; rồi n dòng "x y".  Đầu ra: n chỉ số (từ 1) — thứ tự đi của chu trình.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

// Bảng khoảng cách dựng một lần (Euclid).
const D = [];
for (let i = 0; i < n; i++) {
  D.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const dx = x[i] - x[j], dy = y[i] - y[j];
    D[i][j] = Math.sqrt(dx * dx + dy * dy);
  }
}
function dai(p) {                       // độ dài chu trình khép kín
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}
function daoDoan(p, i, j) {             // đảo p[i..j], gồm cả hai đầu
  for (; i < j; i++, j--) { const tg = p[i]; p[i] = p[j]; p[j] = tg; }
}

// Tuyến xuất phát: láng giềng gần nhất, bắt đầu từ điểm 0.
const p = [0];
{
  const dung = new Array(n).fill(false);
  dung[0] = true;
  for (let k = 1; k < n; k++) {
    const c = p[k - 1];
    let tot = -1;
    for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
    dung[tot] = true; p.push(tot);
  }
}

let soDanhGia = 0, soNuoc = 0;
const EPS = 1e-9, MAX_VONG = 1000;      // luôn có giới hạn vòng (§8, cạm bẫy 4)

// TODO: leo đồi 2-opt trên p.
//   Với i = 0..n-2, j = i+2..n-1 (bỏ cặp i = 0, j = n-1):
//     a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n]
//     delta = D[a][c] + D[b][d] - D[a][b] - D[c][d]      // soDanhGia++ mỗi lần tính
//     delta < -EPS thì nhận: daoDoan(p, i+1, j); soNuoc++
//   Lặp cho tới khi một lượt đầy đủ không nhận nước nào.

log("số lần đánh giá = " + soDanhGia + ", số nước nhận = " + soNuoc + ", độ dài = " + dai(p).toFixed(1));
print(p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;

double dai(const vector<int>& p) {            // độ dài chu trình khép kín
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

int main() {
    scanf("%d", &n);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);

    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) {
            double dx = x[i] - x[j], dy = y[i] - y[j];
            D[i][j] = sqrt(dx * dx + dy * dy);
        }

    // Tuyến xuất phát: láng giềng gần nhất, bắt đầu từ điểm 0.
    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = p.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        p.push_back(tot);
    }

    long long soDanhGia = 0, soNuoc = 0;
    const double EPS = 1e-9;
    const int MAX_VONG = 1000;                 // luôn có giới hạn vòng (§8, cạm bẫy 4)

    // TODO: leo đồi 2-opt trên p.
    //   Với i = 0..n-2, j = i+2..n-1 (bỏ cặp i = 0, j = n-1):
    //     a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n]
    //     delta = D[a][c] + D[b][d] - D[a][b] - D[c][d]      // soDanhGia++ mỗi lần tính
    //     delta < -EPS thì nhận: reverse(p.begin() + i + 1, p.begin() + j + 1); soNuoc++
    //   Lặp cho tới khi một lượt đầy đủ không nhận nước nào.
    (void)EPS; (void)MAX_VONG;

    fprintf(stderr, "so lan danh gia = %lld, so nuoc nhan = %lld, do dai = %.1f\n", soDanhGia, soNuoc, dai(p));
    for (int i = 0; i < n; i++) printf("%d%c", p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

const D = [];
for (let i = 0; i < n; i++) {
  D.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const dx = x[i] - x[j], dy = y[i] - y[j];
    D[i][j] = Math.sqrt(dx * dx + dy * dy);
  }
}
function dai(p) {
  let s = 0;
  for (let i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
  return s;
}
function daoDoan(p, i, j) {
  for (; i < j; i++, j--) { const tg = p[i]; p[i] = p[j]; p[j] = tg; }
}

const start = [0];
{
  const dung = new Array(n).fill(false);
  dung[0] = true;
  for (let k = 1; k < n; k++) {
    const c = start[k - 1];
    let tot = -1;
    for (let i = 0; i < n; i++) if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
    dung[tot] = true; start.push(tot);
  }
}

const EPS = 1e-9, MAX_VONG = 1000;

// Cách 1 — first-improvement: nhận ngay, quét tiếp; lặp tới khi một lượt không đổi gì.
function leoDau(p0) {
  const p = p0.slice();
  let dem = 0, nuoc = 0;
  for (let vong = 0; vong < MAX_VONG; vong++) {
    let doi = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        dem++;
        const a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
        if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) { daoDoan(p, i + 1, j); nuoc++; doi = true; }
      }
    }
    if (!doi) break;
  }
  return { p, dem, nuoc };
}

// Cách 2 — best-improvement: mỗi vòng duyệt hết, ghi nhớ nước tốt nhất rồi mới đảo.
function leoTot(p0) {
  const p = p0.slice();
  let dem = 0, nuoc = 0;
  for (let vong = 0; vong < MAX_VONG; vong++) {
    let tot = -EPS, ti = -1, tj = -1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        dem++;
        const a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
        const delta = D[a][c] + D[b][d] - D[a][b] - D[c][d];
        if (delta < tot) { tot = delta; ti = i; tj = j; }
      }
    }
    if (ti < 0) break;
    daoDoan(p, ti + 1, tj); nuoc++;
  }
  return { p, dem, nuoc };
}

const A = leoDau(start), B = leoTot(start);
log("first-improvement: " + A.dem + " lần đánh giá, " + A.nuoc + " nước nhận, dài " + dai(A.p).toFixed(1));
log("best-improvement : " + B.dem + " lần đánh giá, " + B.nuoc + " nước nhận, dài " + dai(B.p).toFixed(1));
const kq = dai(B.p) < dai(A.p) ? B : A;
print(kq.p.map((i) => i + 1).join(" "));
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> D;

double dai(const vector<int>& p) {
    double s = 0;
    for (int i = 0; i < n; i++) s += D[p[i]][p[(i + 1) % n]];
    return s;
}

const double EPS = 1e-9;
const int MAX_VONG = 1000;

struct KetQua { vector<int> p; long long dem = 0, nuoc = 0; };

// Cách 1 — first-improvement: nhận ngay, quét tiếp; lặp tới khi một lượt không đổi gì.
KetQua leoDau(vector<int> p) {
    KetQua kq;
    for (int vong = 0; vong < MAX_VONG; vong++) {
        bool doi = false;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                kq.dem++;
                int a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
                if (D[a][c] + D[b][d] - D[a][b] - D[c][d] < -EPS) {
                    reverse(p.begin() + i + 1, p.begin() + j + 1);
                    kq.nuoc++; doi = true;
                }
            }
        if (!doi) break;
    }
    kq.p = p;
    return kq;
}

// Cách 2 — best-improvement: mỗi vòng duyệt hết, ghi nhớ nước tốt nhất rồi mới đảo.
KetQua leoTot(vector<int> p) {
    KetQua kq;
    for (int vong = 0; vong < MAX_VONG; vong++) {
        double tot = -EPS;
        int ti = -1, tj = -1;
        for (int i = 0; i < n - 1; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                kq.dem++;
                int a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
                double delta = D[a][c] + D[b][d] - D[a][b] - D[c][d];
                if (delta < tot) { tot = delta; ti = i; tj = j; }
            }
        if (ti < 0) break;
        reverse(p.begin() + ti + 1, p.begin() + tj + 1);
        kq.nuoc++;
    }
    kq.p = p;
    return kq;
}

int main() {
    scanf("%d", &n);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);

    D.assign(n, vector<double>(n));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) {
            double dx = x[i] - x[j], dy = y[i] - y[j];
            D[i][j] = sqrt(dx * dx + dy * dy);
        }

    vector<int> start(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int c = start.back(), tot = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (tot < 0 || D[c][i] < D[c][tot])) tot = i;
        dung[tot] = true;
        start.push_back(tot);
    }

    KetQua A = leoDau(start), B = leoTot(start);
    fprintf(stderr, "first-improvement: %lld lan danh gia, %lld nuoc nhan, dai %.1f\n", A.dem, A.nuoc, dai(A.p));
    fprintf(stderr, "best-improvement : %lld lan danh gia, %lld nuoc nhan, dai %.1f\n", B.dem, B.nuoc, dai(B.p));
    const KetQua& kq = dai(B.p) < dai(A.p) ? B : A;
    for (int i = 0; i < n; i++) printf("%d%c", kq.p[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
      },
      goiY: [
        "Duyệt i từ 0 đến n−2 và j từ i+2 đến n−1, bỏ cặp (0, n−1): đó là hai cạnh kề nhau (chung điểm p[0]) nên không phải nước 2-opt hợp lệ. Với cặp (i, j): a = p[i], b = p[i+1], c = p[j], d = p[(j+1) % n].",
        "Nước nhận thì đảo đoạn p[i+1..j] (gồm cả hai đầu). Dùng ngưỡng delta < −1e−9, không phải delta ≤ 0 (§8, cạm bẫy 3) — số thực cần ngưỡng để sai số làm tròn không bị coi là cải thiện.",
        "First-improvement: sau khi nhận một nước cứ quét tiếp (hoặc quay lại từ đầu) cho tới khi một lượt đầy đủ không nhận nước nào. Best-improvement: mỗi vòng ghi nhớ cặp (i, j) có delta nhỏ nhất, hết vòng mới đảo một lần.",
        "Đừng quên giới hạn vòng (MAX_VONG): nếu delta của bạn sai ở đâu đó, vòng lặp có thể không bao giờ dừng (§8, cạm bẫy 4)."
      ]
    },
    {
      id: "dem-danh-gia-ba-cach",
      ten: "Ba cách quét lân cận: đếm số lần đánh giá",
      doKho: 3,
      ref: "§3.2, §4.1–4.3",
      de: "§4.3 nói first-improvement “thường nhanh hơn 2–5 lần” so với best-improvement (với thứ tự duyệt xáo trộn; nếu mỗi lần lại duyệt từ cùng một đầu danh sách cố định thì lợi thế mỏng hơn nhiều). Hãy tự **đo** — bằng cách đếm chính xác số lần tính Δ.\n\n" +
          "Cho `n` điểm nguyên trên lưới 100×100, khoảng cách **Manhattan**, tuyến khép kín xuất phát là `0, 1, …, n−1`. Chấm trên 10 bộ dữ liệu; mức đạt duy nhất là **đúng cả chín số trên mọi test**. Lân cận 2-opt gồm mọi cặp `(i, j)` với `0 ≤ i < j ≤ n−1`, `j ≥ i+2`, **bỏ cặp (0, n−1)**, duyệt theo thứ tự `i` tăng, trong cùng `i` thì `j` tăng. Với cặp `(i, j)`: `a = q[i]`, `b = q[i+1]`, `c = q[j]`, `d = q[(j+1) mod n]`, **Δ = d(a,c) + d(b,d) − d(a,b) − d(c,d)**; nước cải thiện khi **Δ < 0** (nghiêm ngặt); áp dụng nước = đảo `q[i+1..j]`. Mỗi lần tính Δ của một cặp là **một lần đánh giá**.\n\n" +
          "Cài ba cách, **mỗi cách bắt đầu lại từ tuyến `0..n−1`**:\n\n" +
          "- **A — đầu tiên, quay lại từ đầu:** gặp cặp đầu tiên có Δ < 0 thì áp dụng ngay rồi **quay lại duyệt từ cặp (0, 2)**. Dừng khi một lượt duyệt hết lân cận mà không có nước cải thiện.\n" +
          "- **B — đầu tiên, quét tiếp:** gặp Δ < 0 thì áp dụng ngay rồi **duyệt tiếp từ cặp kế tiếp** `(i, j+1)` (tuyến đã đổi). Hết một lượt mà đã áp dụng ít nhất một nước thì bắt đầu lượt mới từ (0, 2); dừng khi một lượt không áp dụng nước nào.\n" +
          "- **C — tốt nhất:** mỗi vòng duyệt **toàn bộ** lân cận, nhớ cặp có Δ nhỏ nhất (gặp trước thắng khi bằng nhau). Nếu Δ nhỏ nhất < 0 thì áp dụng và sang vòng sau; ngược lại dừng.\n\n" +
          "In **một dòng chín số**: `nuocA lanA daiA nuocB lanB daiB nuocC lanC daiC` (số nước nhận, số lần đánh giá — gồm cả lượt cuối không tìm thấy gì, độ dài cuối).\n\n" +
          "**Suy ngẫm sau khi qua:** so ba số “lần đánh giá”. Cách nào ít nhất? Cách A (quay lại từ đầu) có thật sự rẻ hơn C không, và vì sao nó khác cách B (quét tiếp)? Ba độ dài cuối khác nhau bao nhiêu %? Điều đó nói gì về câu “chất lượng chỗ dừng tương đương”, và về cách bạn nên viết pseudo-code first-improvement?",
      vanDe: "b09-dem-danh-gia",
      tham: { n: 40 },
      bienThe: [
        { ten: "n = 40", tham: { n: 40 } },
        { ten: "n = 20 (nhỏ — dễ gỡ lỗi)", tham: { n: 20 } },
        { ten: "n = 60", tham: { n: 60 } }
      ],
      soTest: 10,
      gioiHanMs: 1500,
      khoiDau: {
        js: String.raw`// Đầu vào: dòng 1 là n; rồi n dòng "x y" (nguyên, 0..99). Khoảng cách Manhattan.
// Đầu ra : MỘT dòng chín số: nuocA lanA daiA  nuocB lanB daiB  nuocC lanC daiC
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);
const taoTuyen = () => Array.from({ length: n }, (_, i) => i);          // 0, 1, ..., n-1
function delta(q, i, j) {
  const a = q[i], b = q[i + 1], c = q[j], e = q[(j + 1) % n];
  return d(a, c) + d(b, e) - d(a, b) - d(c, e);
}
function daoDoan(q, i, j) {                 // áp dụng nước (i, j): đảo q[i+1..j]
  for (let l = i + 1, h = j; l < h; l++, h--) { const tg = q[l]; q[l] = q[h]; q[h] = tg; }
}
function dai(q) {
  let s = 0;
  for (let i = 0; i < n; i++) s += d(q[i], q[(i + 1) % n]);
  return s;
}

// Mỗi hàm trả [số nước nhận, số lần đánh giá, độ dài cuối].
function cachA() {
  const q = taoTuyen();
  let nuoc = 0, dem = 0;
  // TODO: đầu tiên, quay lại từ đầu sau mỗi nước nhận
  return [nuoc, dem, dai(q)];
}
function cachB() {
  const q = taoTuyen();
  let nuoc = 0, dem = 0;
  // TODO: đầu tiên, quét tiếp từ cặp kế tiếp sau mỗi nước nhận
  return [nuoc, dem, dai(q)];
}
function cachC() {
  const q = taoTuyen();
  let nuoc = 0, dem = 0;
  // TODO: tốt nhất — duyệt hết, nhận nước có delta nhỏ nhất
  return [nuoc, dem, dai(q)];
}

print([...cachA(), ...cachB(), ...cachC()].join(" "));
`
      },
      loiGiai: {
        js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[1 + 2 * i]); y.push(t[2 + 2 * i]); }

const d = (a, b) => Math.abs(x[a] - x[b]) + Math.abs(y[a] - y[b]);
const taoTuyen = () => Array.from({ length: n }, (_, i) => i);
function delta(q, i, j) {
  const a = q[i], b = q[i + 1], c = q[j], e = q[(j + 1) % n];
  return d(a, c) + d(b, e) - d(a, b) - d(c, e);
}
function daoDoan(q, i, j) {
  for (let l = i + 1, h = j; l < h; l++, h--) { const tg = q[l]; q[l] = q[h]; q[h] = tg; }
}
function dai(q) {
  let s = 0;
  for (let i = 0; i < n; i++) s += d(q[i], q[(i + 1) % n]);
  return s;
}

function cachA() {                          // đầu tiên, quay lại từ đầu
  const q = taoTuyen();
  let nuoc = 0, dem = 0, doi = true;
  while (doi) {
    doi = false;
    for (let i = 0; i < n - 1 && !doi; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        dem++;
        if (delta(q, i, j) < 0) { daoDoan(q, i, j); nuoc++; doi = true; break; }
      }
    }
  }
  return [nuoc, dem, dai(q)];
}
function cachB() {                          // đầu tiên, quét tiếp
  const q = taoTuyen();
  let nuoc = 0, dem = 0, doi = true;
  while (doi) {
    doi = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        dem++;
        if (delta(q, i, j) < 0) { daoDoan(q, i, j); nuoc++; doi = true; }
      }
    }
  }
  return [nuoc, dem, dai(q)];
}
function cachC() {                          // tốt nhất
  const q = taoTuyen();
  let nuoc = 0, dem = 0;
  for (;;) {
    let tot = 0, ti = -1, tj = -1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        dem++;
        const v = delta(q, i, j);
        if (v < tot) { tot = v; ti = i; tj = j; }
      }
    }
    if (ti < 0) break;
    daoDoan(q, ti, tj); nuoc++;
  }
  return [nuoc, dem, dai(q)];
}

print([...cachA(), ...cachB(), ...cachC()].join(" "));
`
      },
      goiY: [
        "Ba cách dùng chung `delta` và `daoDoan` (áp dụng nước (i, j) = đảo q[i+1..j]); chỉ khác nhau ở chỗ **sau khi nhận một nước thì làm gì**: A thoát hẳn hai vòng for và bắt đầu lại, B ở lại và xét tiếp (i, j+1), C không nhận ngay mà chỉ ghi nhớ.",
        "Đếm `dem++` ngay trước mỗi lần gọi `delta` — kể cả ở lượt cuối cùng không tìm thấy nước nào. Cặp (0, n−1) bị bỏ **không** tính là một lần đánh giá.",
        "Cách C: khởi đầu `tot = 0`; chỉ ghi nhớ khi `delta < tot` (nghiêm ngặt) để gặp trước thắng khi bằng nhau; hết vòng nếu `ti < 0` thì dừng."
      ]
    }
  ]
});
