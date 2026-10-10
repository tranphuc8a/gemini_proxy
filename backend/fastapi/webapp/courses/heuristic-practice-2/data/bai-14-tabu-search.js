/* Thực hành — Bài 14: Tabu Search. */
(function () {
  "use strict";
  var TI = TH.tienIch, VD = TH.vande;

  /* ===================================================================================
     Bài toán 1: mô phỏng bảng cấm (cấm theo thuộc tính = cặp hoán vị) có tiêu chí phá lệ.
     Quy ước của bài: sau khi đi nước ở bước t, hạn = t + TT; thuộc tính bị cấm ở bước s khi hạn > s.
     ===================================================================================*/
  function khoaCap(i, j) { return i < j ? i + "-" + j : j + "-" + i; }
  function moPhongBangCam(inst) {
    var han = {}, best = inst.best0, tt = [], t, dem = 0, k;
    for (t = 1; t <= inst.S; t++) {
      var m = inst.de[t - 1], key = khoaCap(m[0], m[1]), biCam = (han[key] || 0) > t;
      var st = !biCam ? 1 : (m[2] < best ? 2 : 0);          /* 0: bị chặn · 1: đi bình thường · 2: đi nhờ phá lệ */
      if (st > 0) { han[key] = t + inst.TT; if (m[2] < best) best = m[2]; }
      tt.push(st);
    }
    for (k in han) if (han[k] > inst.S + 1) dem++;
    return { tt: tt, best: best, dem: dem };
  }
  VD.dangKy("b14-bang-cam", VD.tuDapAn({
    sinh: function (seed, tham) {
      var r = TI.rng(seed), n = 6, S = (tham && tham.S) || 24, TT = (tham && tham.TT) || 4, best0 = 52;
      var han = {}, best = best0, de = [], rec = [], t, i, j, f, thu;
      for (t = 1; t <= S; t++) {
        if (rec.length && r() < 0.5) { thu = rec[rec.length - 1 - r.int(Math.min(rec.length, 4))]; i = thu[0]; j = thu[1]; }
        else { i = r.khoang(1, n); do { j = r.khoang(1, n); } while (j === i); }
        var biCam = (han[khoaCap(i, j)] || 0) > t, x = r();
        if (biCam) f = x < 0.3 ? best : x < 0.55 ? best - r.khoang(1, 4) : best + r.khoang(1, 8);
        else f = best + r.khoang(-3, 10);
        if (!biCam || f < best) { han[khoaCap(i, j)] = t + TT; rec.push([i, j]); }
        if (f < best) best = f;
        de.push(r() < 0.5 ? [i, j, f] : [j, i, f]);          /* có khi đưa (j, i): cùng một thuộc tính */
      }
      return { n: n, S: S, TT: TT, best0: best0, de: de };
    },
    viet: function (inst) {
      var s = inst.n + " " + inst.TT + " " + inst.S + " " + inst.best0 + "\n";
      inst.de.forEach(function (m) { s += m[0] + " " + m[1] + " " + m[2] + "\n"; });
      return s;
    },
    giai: function (inst) { var r = moPhongBangCam(inst); return [r.tt, r.best, r.dem]; },
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `n TT S f₀` — số phần tử, thời hạn cấm, số bước, điểm kỷ lục ban đầu. Tiếp theo `S` dòng `i j f`: ở bước `t` (đánh số từ 1) thuật toán đề xuất đổi chỗ `i ↔ j` và điểm sau nước đó sẽ là `f` (bài toán **cực tiểu**).",
      ra: "`S` số trạng thái (0 = bị chặn, 1 = đi bình thường, 2 = đi nhờ phá lệ), rồi kỷ lục cuối cùng, rồi số cặp còn bị cấm ở bước `S + 1`."
    }
  }));

  /* ===================================================================================
     Bài toán 2: Tabu 2-opt cho TSP với số vòng cố định. Dòng đầu: "n K TT" — K và TT do đề đưa.
     ===================================================================================*/
  var tsp = VD.lay("tsp");
  VD.keThua("tsp", "b14-tsp-tabu", {
    sinh: function (seed, tham) {
      tham = tham || {};
      var inst = tsp.sinh(seed, tham);
      inst.K = tham.K || 1000;
      inst.TT = tham.TT || 20;
      return inst;
    },
    viet: function (inst) {
      var o = inst.n + " " + inst.K + " " + inst.TT + "\n";
      for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + "\n";
      return o;
    },
    dinhDang: {
      vao: "Dòng 1: `n K TT` — số điểm, **số vòng lặp** của Tabu và **thời hạn cấm**. Tiếp theo `n` dòng `x y` — toạ độ nguyên của điểm `i` (đánh số từ 1).",
      ra: "Một dòng gồm `n` chỉ số: hoán vị của `1..n` theo thứ tự đi (chu trình khép kín). Độ dài là tổng khoảng cách Euclid, càng **ngắn** càng tốt."
    }
  });

  TH.dangKy({
    id: "bai-14-tabu-search",

    tomTat: [
      "Tabu = **luôn đi nước tốt nhất, nhưng cấm quay lại những nước vừa đi trong TT bước**. “Luôn đi nước tốt nhất” mà không có trí nhớ thì lắc qua lắc lại giữa hai nghiệm (x₁ → x₂ → x₁ …): đó không phải lỗi cài đặt, luật thiếu bộ nhớ.",
      "**Cấm theo thuộc tính, không cấm theo nghiệm.** Không gian nghiệm quá lớn nên gần như không bao giờ quay lại đúng một nghiệm — bảng cấm theo nghiệm luôn rỗng. Quy tắc: cấm cái làm **hoàn tác** nước vừa đi (2-opt: không thêm lại cạnh vừa bỏ; swap: không đổi lại cặp; vừa THÊM đơn j thì cấm BỎ j).",
      "Bảng cấm O(1): đặt `tabuUntil[i][j] = buoc + TT`, bị cấm khi `tabuUntil > buoc`; không phải xoá gì, lệnh cấm tự hết hạn. Hệ quả của dấu `>`: lệnh cấm có hiệu lực TT − 1 bước kế tiếp (TT = 3, đặt ở bước 1: cấm ở bước 2 và 3, được phép lại từ bước 4).",
      "Đừng đặt `buoc = 0` mà quên reset `tabuUntil` giữa hai lần chạy: các dấu thời gian cũ lớn hơn `buoc` mới nên nhiều nước bị cấm oan. Hoặc xoá mảng, hoặc **đừng bao giờ reset `buoc`**.",
      "Thời hạn cấm: quá nhỏ (1–3) thì vẫn lặp; quá lớn thì có lúc không còn nước nào hợp lệ. Quy tắc bỏ túi TT ≈ √n hoặc 7–15; tabu phản ứng tự tăng TT khi phát hiện lặp và giảm khi lâu không lặp.",
      "**Tiêu chí phá lệ:** nước bị cấm vẫn được đi nếu cho kỷ lục mới — lệnh cấm chỉ là xấp xỉ thô, còn kỷ lục mới là bằng chứng ta chưa từng ở đó. Dùng `>` (tốt hơn **hẳn**); dùng `>=` mở đường cho vòng lặp vô hạn giữa các nghiệm cùng điểm.",
      "Tabu không có yếu tố ngẫu nhiên (tái lập được, dễ gỡ lỗi) và mỗi bước duyệt cả lân cận để chọn nước tốt nhất — O(n·m) mỗi bước. SA làm ~10⁵ bước rẻ, Tabu ~10³ bước đắt: lân cận lớn → SA; lân cận vừa mà mỗi lần đánh giá đắt → Tabu; trong bài thi 100 ms thường GRASP + chèn vẫn thắng cả hai.",
      "Cạm bẫy hay gặp: cấm theo nghiệm; quên phá lệ; **cấm nhầm chiều** (vừa thêm j mà cấm thêm j — lỗi im lặng, tự kiểm bằng cách in số nước bị chặn mỗi bước); TT cố định cho mọi n; không `break` khi mọi nước đều bị cấm."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§1.1",
        hoi: "Giả sử ta bỏ luật “chỉ nhận nước cải thiện” và đổi thành “luôn đi nước tốt nhất, kể cả khi điểm giảm”. Vì sao thuật toán vẫn có thể lắc qua lắc lại giữa x₁ và x₂ mãi mãi?",
        chon: [
          "Vì đó là lỗi cài đặt, cần sửa vòng lặp",
          "Vì không gian nghiệm quá nhỏ nên hai nghiệm luôn kề nhau",
          "Vì luật không có trí nhớ: đứng ở x₂, nước tốt nhất chính là quay về x₁ (x₁ là cực trị cục bộ nên tốt hơn mọi hàng xóm, kể cả x₂)",
          "Vì thuật toán cần ngẫu nhiên để thoát vòng lặp"
        ],
        dung: 2,
        giaiThich: "Thuật toán đang làm đúng điều ta bảo nó làm; vấn đề là luật không biết rằng nó vừa ở đó. x₁ là cực trị cục bộ nên từ x₂ nước tốt nhất luôn là về x₁, và ngược lại — lặp vô hạn. Chữa bằng trí nhớ (bảng cấm), không phải sửa lỗi hay thêm ngẫu nhiên (đó là cách của SA)."
      },
      {
        id: "q2", loai: "mot", doKho: 2, ref: "§3.1",
        hoi: "Cấm theo **nghiệm** (lưu cả nghiệm đã thăm vào một tập) có ba vấn đề. Vấn đề nào là **chí mạng**, khiến cách này gần như vô dụng?",
        chon: [
          "Bộ nhớ bùng nổ vì mỗi nghiệm là một mảng m phần tử",
          "Mỗi lần tra cứu tốn O(m) vì phải so sánh cả mảng",
          "Nó cấm nhầm cả những nghiệm chưa từng thăm",
          "Không gian nghiệm quá lớn nên xác suất quay lại đúng một nghiệm đã thăm gần như bằng 0 — bảng cấm luôn rỗng"
        ],
        dung: 3,
        giaiThich: "Hai vấn đề đầu (bộ nhớ, tốc độ) chỉ làm chậm; vấn đề thứ ba làm cách này không còn tác dụng: với 10³⁰ nghiệm trở lên, ta hầu như không bao giờ trùng đúng một nghiệm cũ nên không có gì để cấm. “Cấm nhầm nghiệm chưa thăm” thì ngược lại là nhược điểm của cấm theo thuộc tính — chính vì thế mới cần tiêu chí phá lệ."
      },
      {
        id: "q3", loai: "nhieu", doKho: 2, ref: "§3.1",
        hoi: "Quy tắc chung của bảng cấm là “cấm cái làm HOÀN TÁC nước vừa đi”. Chọn mọi phát biểu đúng:",
        chon: [
          "2-opt vừa bỏ cạnh (a, b) → cấm thêm lại cạnh (a, b)",
          "Swap vừa đổi chỗ i ↔ j → cấm đổi lại cặp i ↔ j",
          "P1 vừa THÊM đơn j vào tuyến → cấm BỎ đơn j",
          "P1 vừa THÊM đơn j vào tuyến → cấm THÊM đơn j",
          "Gán nhãn vừa đổi nhãn của i từ a sang b → cấm gán i sang b một lần nữa"
        ],
        dung: [0, 1, 2],
        giaiThich: "Hoàn tác của “thêm j” là “bỏ j”; “thêm j” thì đã xảy ra rồi, cấm nó vô nghĩa (cấm nhầm chiều — lỗi im lặng). Với gán nhãn, hoàn tác của “i: a → b” là “i: b → a”, tức cấm gán i **về a**; cấm gán i sang b chẳng chặn được gì."
      },
      {
        id: "q4", loai: "so", doKho: 2, ref: "§3.2, §4",
        hoi: "Bảng cấm cài theo mẫu `datCam: tabuUntil = buoc + TT` và `biCam: tabuUntil > buoc`. Với TT = 4, nước swap(2, 7) được thực hiện ở bước 5. Đến bước số mấy thì swap(2, 7) được phép đi lại lần đầu tiên?",
        dapAn: 9, saiSo: 0,
        giaiThich: "tabuUntil = 5 + 4 = 9. Nước bị cấm khi 9 > buoc, tức ở các bước 6, 7, 8; đến bước 9 thì 9 > 9 sai ⇒ được phép lại. (Vì dấu `>`, lệnh cấm chỉ chặn TT − 1 = 3 bước kế tiếp; với TT = 3 ở ví dụ làm tay §4, nước (1,2) đi ở bước 1 bị cấm ở bước 2–3 và được phép lại ở bước 4.)"
      },
      {
        id: "q5", loai: "mot", doKho: 2, ref: "§3.2",
        hoi: "Bạn chạy `tabuSearch` hai lần liên tiếp trong cùng một tiến trình; giữa hai lần bạn đặt `buoc = 0` nhưng không đụng tới mảng `tabuUntil`. Điều gì xảy ra ở lần chạy thứ hai?",
        chon: [
          "Một loạt nước đi bị cấm oan ngay từ đầu, vì các dấu thời gian cũ (ví dụ 900) lớn hơn buoc mới",
          "Không gì cả: mảng tabuUntil tự xoá khi buoc về 0",
          "Chương trình báo lỗi tràn mảng",
          "Mọi nước đi bị cho phép vì các dấu thời gian cũ đã hết hạn"
        ],
        dung: 0,
        giaiThich: "Dấu thời gian cũ vẫn nằm trong mảng; so với buoc mới (nhỏ) thì `tabuUntil > buoc` đúng ⇒ nước đi bị cấm dù lệnh cấm đó thuộc lần chạy trước. Cách sửa: xoá cả mảng giữa hai lần, hoặc đừng bao giờ reset buoc (cứ để nó tăng liên tục)."
      },
      {
        id: "q6", loai: "mot", doKho: 2, ref: "§3.4",
        hoi: "Vì sao một nước đi **bị cấm** vẫn nên được phép nếu nó cho nghiệm tốt hơn mọi nghiệm từng gặp (tiêu chí phá lệ)?",
        chon: [
          "Vì nước đó luôn rẻ hơn để tính",
          "Vì kỷ lục mới chứng tỏ ta chưa từng ở đó, nên không thể là lặp — lệnh cấm chỉ là xấp xỉ thô và lần này cấm nhầm",
          "Vì thuật toán nhanh hơn khi bỏ qua bảng cấm",
          "Vì bảng cấm chỉ có tác dụng ở nửa đầu của thuật toán"
        ],
        dung: 1,
        giaiThich: "Mục đích của bảng cấm là chống lặp, không phải chặn tiến bộ. Vì cấm theo thuộc tính chỉ là xấp xỉ (có thể chặn cả nghiệm chưa thăm), nên khi có bằng chứng chắc chắn quy tắc đang sai — một kỷ lục mới, theo định nghĩa chưa từng gặp — ta cho phép nó. Tốc độ hay giai đoạn của thuật toán không liên quan."
      },
      {
        id: "q7", loai: "mot", doKho: 3, ref: "§3.4, §4 (bước 3)",
        hoi: "Bài toán cực tiểu. Kỷ lục hiện tại là 50. Một nước đi đang bị cấm sẽ cho điểm đúng bằng 50. Nên xử lý thế nào, và vì sao?",
        chon: [
          "Cho phép, vì bằng kỷ lục cũng là tốt như kỷ lục (dùng >=)",
          "Vẫn cấm: tiêu chí phá lệ đòi tốt hơn **hẳn**; dùng >= mở đường cho vòng lặp vô hạn giữa các nghiệm cùng điểm",
          "Cho phép, vì mọi nước bị cấm đều nên được xét lại khi điểm bằng nhau",
          "Vẫn cấm, vì bài toán cực tiểu không có tiêu chí phá lệ"
        ],
        dung: 1,
        giaiThich: "Nghiệm có điểm bằng kỷ lục có thể chính là nghiệm ta vừa rời đi — nhận nó là quay đầu, đúng cái vòng lặp mà bảng cấm sinh ra để chặn. Vì vậy dùng so sánh chặt (< với cực tiểu, > với cực đại). Tiêu chí phá lệ áp dụng cho cả hai chiều tối ưu, chỉ đổi dấu so sánh."
      },
      {
        id: "q8", loai: "mot", doKho: 2, ref: "§3.3",
        hoi: "Hậu quả của việc đặt thời hạn cấm TT quá nhỏ (1–3) và quá lớn lần lượt là gì?",
        chon: [
          "Quá nhỏ: có lúc không còn nước hợp lệ; quá lớn: vẫn lặp vì cấm hết hạn quá nhanh",
          "Quá nhỏ: chạy chậm; quá lớn: chạy nhanh nhưng kém chính xác",
          "Cả hai đều chỉ làm chậm thuật toán, không đổi kết quả",
          "Quá nhỏ: vẫn lặp vì cấm hết hạn trước khi đẩy bạn đi đủ xa; quá lớn: cấm quá nhiều, có lúc không còn nước nào hợp lệ"
        ],
        dung: 3,
        giaiThich: "TT quá nhỏ: lệnh cấm biến mất trước khi kịp đẩy thuật toán ra khỏi vùng vừa đi nên vẫn lặp. TT quá lớn: các lệnh cấm chồng lên nhau, đến lúc mọi nước (không phá lệ được) đều bị cấm và thuật toán kẹt hẳn — vì thế phải `break` khi không còn nước nào. Quy tắc bỏ túi: TT ≈ √n hoặc 7–15. Phương án “quá nhỏ: có lúc không còn nước hợp lệ” đã đảo ngược hai hậu quả."
      },
      {
        id: "q9", loai: "nhieu", doKho: 2, ref: "§2, §5.1, §7",
        hoi: "So sánh Tabu Search với Simulated Annealing. Chọn mọi phát biểu đúng:",
        chon: [
          "Tabu không có yếu tố ngẫu nhiên nào, nên kết quả tái lập được và dễ gỡ lỗi",
          "Mỗi bước Tabu duyệt cả lân cận để chọn nước tốt nhất còn được phép, còn SA chỉ bốc một nước ngẫu nhiên",
          "Tabu cần ít bộ nhớ hơn SA vì không phải giữ bảng nào",
          "Trong cùng một ngân sách thời gian, SA đi nhiều bước hơn Tabu hàng chục đến hàng trăm lần vì mỗi bước của nó O(1)",
          "Tabu chỉ đi lên nên không cần giữ riêng nghiệm tốt nhất"
        ],
        dung: [0, 1, 3],
        giaiThich: "Tabu tất định, mỗi bước O(n·m) và chọn tốt nhất trong lân cận; SA bốc ngẫu nhiên và chỉ O(1) mỗi bước nên đi nhiều bước hơn rất nhiều (cỡ 10⁵ so với 10³ bước trong cùng 16 ms, theo bảng §5.1). Tabu thì **cần** bảng cấm (một mảng dấu thời gian), và nó cũng đi lên đi xuống — bị ép đi xuống khi mọi nước tốt đều bị cấm — nên **bắt buộc** giữ `best` như SA."
      },
      {
        id: "q10", loai: "mot", doKho: 3, ref: "§8 (cạm bẫy 3)",
        hoi: "Bạn cài Tabu cho P1: sau khi THÊM đơn j bạn ghi `camThem[j] = buoc + TT`. Thuật toán chạy bình thường, nhưng số nước bị chặn ở mỗi bước gần như luôn bằng 0 và kết quả vẫn lặp. Chẩn đoán nào đúng?",
        chon: [
          "Cấm nhầm chiều: vừa thêm j thì phải cấm BỎ j (`camBo[j]`), không phải cấm thêm j — lỗi im lặng, thuật toán vẫn chạy nhưng bảng cấm chẳng chặn được gì",
          "TT quá nhỏ, cần tăng lên √n",
          "Thiếu tiêu chí phá lệ nên mọi nước bị cho phép",
          "Mảng camThem chưa khởi tạo về 0"
        ],
        dung: 0,
        giaiThich: "Đơn j đã được thêm rồi nên cấm “thêm j” không chặn nước nào; cái cần chặn để khỏi hoàn tác là “bỏ j”. Đây là lỗi im lặng; cách tự kiểm rẻ là in số nước bị chặn mỗi bước — gần như luôn 0 là dấu hiệu cấm nhầm chiều. TT hay phá lệ không làm số nước bị chặn bằng 0 kiểu này, và khởi tạo sai chỉ gây cấm oan (số nước bị chặn nhiều chứ không phải 0)."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "Bài tập 14.1",
        hoi: "Với toán tử 2-opt trên TSP, nước đi bỏ hai cạnh (a, b), (c, d) và thêm (a, c), (b, d). Thuộc tính nào nên cấm để chống hoàn tác? Cần bao nhiêu ô nhớ cho bảng cấm khi n = 1 000, và có cách nào tiết kiệm hơn?",
        goiY: ["Hoàn tác của “bỏ cạnh” là gì?", "Cạnh (a, b) và (b, a) có phải cùng một thuộc tính không?"],
        mau: "- **Thuộc tính:** cấm **thêm lại các cạnh vừa bỏ**: (a, b) và (c, d). Đó chính là cái làm hoàn tác nước vừa đi.\n- **Bộ nhớ:** ma trận n × n thời hạn — với n = 1 000 là 10⁶ ô; dùng `int` thì 4 MB. Vì cạnh vô hướng nên chỉ cần n(n − 1)/2 = 499 500 ô nếu khai thác đối xứng.\n- **Tiết kiệm hơn** cho n rất lớn: dùng bảng băm chỉ lưu các cạnh đang bị cấm (số này không vượt quá 2·TT), thay vì cả ma trận.\n- Kiểm tra và đặt vẫn O(1): `biCam = tabuUntil[a][c] > buoc`; `datCam: tabuUntil[a][b] = buoc + TT`.",
        tieuChi: ["Nêu đúng thuộc tính: cấm thêm lại các cạnh vừa bỏ (a,b) và (c,d)", "Tính được số ô nhớ: n² = 10⁶ ô (4 MB với int) hoặc n(n−1)/2 ≈ 499 500 nếu khai thác đối xứng", "Nêu được một cách tiết kiệm hơn (đối xứng hoặc bảng băm cho n lớn)"]
      },
      {
        id: "l2", doKho: 2, ref: "Bài tập 14.2",
        hoi: "Bạn chạy `tabuSearch` hai lần liên tiếp trong cùng một tiến trình và giữa hai lần đặt `buoc = 0` nhưng **không** đụng tới mảng `tabuUntil`. Chỉ ra chuyện gì xảy ra ở lần chạy thứ hai và đề xuất **hai** cách sửa khác nhau.",
        goiY: ["So sánh một dấu thời gian cũ như 500 với buoc = 3.", "Một cách sửa động tới mảng, cách kia động tới biến đếm."],
        mau: "**Chuyện gì xảy ra:** các giá trị cũ (ví dụ `tabuUntil[i][j] = 500` từ lần chạy trước) vẫn **lớn hơn** `buoc` mới, nên `tabuUntil > buoc` đúng ⇒ các nước đó bị cấm oan suốt khoảng 500 bước đầu của lần chạy thứ hai, dù lần này chưa ai ghi cấm chúng. Thuật toán không báo lỗi, chỉ đi những nước kém hơn.\n\n**Hai cách sửa:**\n1. **Xoá mảng** (`memset`/`fill`) giữa hai lần chạy.\n2. **Đừng bao giờ reset `buoc`** — để nó tăng liên tục qua các lần chạy, các dấu thời gian cũ tự lỗi thời (luôn ≤ buoc hiện tại).",
        tieuChi: ["Chỉ ra dấu thời gian cũ vẫn lớn hơn buoc mới nên gây cấm oan", "Cách sửa 1: xoá/khởi tạo lại mảng tabuUntil", "Cách sửa 2: không reset buoc (để tăng liên tục)"]
      },
      {
        id: "l3", doKho: 3, ref: "§4",
        hoi: "Bài toán cực tiểu, TT = 3, quy ước hạn = bước + TT và bị cấm khi hạn > bước. Bắt đầu f = 50 (kỷ lục 50). Các nước ứng viên ở mỗi bước (kèm điểm sau nước đó): **Bước 1:** swap(1,2) → 47, swap(2,3) → 52, swap(3,4) → 55. **Bước 2:** swap(1,2) → 50, swap(2,3) → 53, swap(3,4) → 56. **Bước 3:** swap(2,3) → 47, swap(1,2) → 49, swap(1,3) → 54. **Bước 4:** swap(1,2) → 44, swap(2,3) → 50, swap(1,3) → 53. **Bước 5:** swap(1,3) → 43, swap(2,3) → 46. Hãy điền, cho từng bước: nước nào bị cấm, nước được chọn, điểm sau bước và kỷ lục.",
        goiY: ["Sau mỗi nước đi, ghi hạn = bước + 3 cho cặp vừa đổi.", "Ở mỗi bước xét: bị cấm? Nếu bị cấm thì có tốt hơn **hẳn** kỷ lục không?"],
        mau: "| Bước | Đang bị cấm | Chọn | f | Kỷ lục | Ghi cấm |\n|:-:|---|---|:-:|:-:|---|\n| 1 | — | swap(1,2) (47, tốt nhất) | 47 | 47 | (1,2) hạn 4 |\n| 2 | (1,2) — nó là nước tốt nhất (50), nhưng 50 ≥ 47 nên không phá lệ | swap(2,3) (53, tốt nhất còn được phép) | 53 | 47 | (2,3) hạn 5 |\n| 3 | (1,2), (2,3) — swap(2,3) → 47 bằng kỷ lục nhưng không hơn hẳn, vẫn cấm | swap(1,3) (54) | 54 | 47 | (1,3) hạn 6 |\n| 4 | (2,3), (1,3); **(1,2) đã hết hạn** (4 > 4 sai) | swap(1,2) (44) | 44 | 44 | (1,2) hạn 7 |\n| 5 | (1,2), (1,3) — swap(1,3) bị cấm (6 > 5) nhưng 43 < 44 ⇒ **phá lệ** | swap(1,3) (43) | 43 | 43 | (1,3) hạn 8 |\n\nBa điều đáng đọc: bước 2 và 3 nước tốt nhất tuyệt đối đều bị cấm nên thuật toán **bị ép đi xuống** (47 → 53 → 54); bước 3 điểm bằng kỷ lục vẫn bị chặn vì phá lệ dùng so sánh chặt; bước 4 lệnh cấm hết hạn đúng lúc, bước 5 lệnh cấm bị phá lệ vì có kỷ lục mới.",
        tieuChi: ["Bước 2: chặn swap(1,2) dù nó là nước tốt nhất, chọn swap(2,3) = 53 (bị ép đi xuống)", "Bước 3: swap(2,3) → 47 bằng kỷ lục nhưng không hơn hẳn nên vẫn bị cấm", "Bước 4: nhận ra (1,2) đã hết hạn (hạn 4) và được phép đi", "Bước 5: swap(1,3) bị cấm nhưng 43 < 44 nên phá lệ", "Cập nhật đúng kỷ lục (47, 47, 47, 44, 43)"]
      },
      {
        id: "l4", doKho: 3, ref: "Bài tập 14.3–14.4, §5.1, §7",
        hoi: "Bạn phải so Tabu với SA và GRASP + chèn trên P1, rồi chọn thời hạn cấm cho Tabu trên TSP. Nêu (a) vì sao phép so sánh công bằng duy nhất là cùng ngân sách thời gian, (b) bạn kỳ vọng Tabu xếp ở đâu trong ngân sách ~15 ms, (c) cách quét thời hạn cấm và kết quả kỳ vọng, (d) khi nào bạn chọn Tabu thay vì SA.",
        goiY: ["Mỗi bước của Tabu và của SA tốn bao nhiêu?", "Quy tắc bỏ túi cho TT, và hai kiểu hỏng khi TT lệch quá xa."],
        mau: "- **(a)** Một bước Tabu tốn O(n·m) (duyệt cả lân cận), một bước SA chỉ O(1) ⇒ so cùng số bước là bất công; phải so cùng thời gian (theo bảng §5.1: SA cỡ 10⁵ bước so với Tabu cỡ 10³ bước trong ~16 ms).\n- **(b)** Với 1 000 bước ở ~15 ms trên P1, Tabu thường đạt khoảng 65 500–66 000: **ngang SA, không vượt trội**, khớp với nhận định rằng trong ngân sách rất ngắn Tabu không phải lựa chọn tốt nhất (GRASP + chèn thường vẫn ngang hoặc hơn).\n- **(c)** Quét TT ∈ {5, 10, 20, 40} trên TSP (2-opt + danh sách ứng viên K = 10): kỳ vọng TT 10–20 tốt nhất; TT = 5 vẫn lặp (cấm hết hạn quá nhanh), TT = 40 quá chặt (nhiều lúc mọi nước đều bị cấm). So với quy tắc √n: với n = 600 thì √n ≈ 24, gần 20 nhất trong tập quét — khớp với vùng 10–20 mà đáp án của khoá cho là tốt nhất; √n là điểm xuất phát hợp lý nhưng giá trị tốt nhất vẫn phải đo.\n- **(d)** Chọn Tabu khi lân cận vừa (10²–10³) mà mỗi lần đánh giá đắt, hoặc khi cần kết quả tất định, dễ tái lập; chọn SA khi delta O(1) và lân cận rất lớn (> 10⁴), hoặc cần đơn giản ít tham số.",
        tieuChi: ["Nêu chi phí mỗi bước khác nhau (O(n·m) so với O(1)) nên phải so cùng ngân sách thời gian", "Kỳ vọng Tabu ngang SA (khoảng 65 500–66 000) trong ngân sách ngắn, không vượt trội", "Quét thời hạn cấm và dự đoán 10–20 tốt nhất, 5 vẫn lặp, 40 quá chặt", "Nêu điều kiện chọn Tabu: lân cận vừa + đánh giá đắt, hoặc cần tất định"]
      }
    ],

    lab: [
      {
        id: "mo-phong-bang-cam",
        ten: "Mô phỏng bảng cấm: nước nào bị cấm ở bước k?",
        doKho: 2,
        ref: "§3.2, §3.4, §4",
        de: "Cài đúng **bảng cấm theo thuộc tính** của Tabu Search và xem nó chặn những nước nào. Mỗi bộ dữ liệu có `S` bước; ở bước `t` (từ 1) thuật toán đề xuất đổi chỗ `i ↔ j` và cho biết điểm sau nước đó sẽ là `f` (bài toán **cực tiểu**, kỷ lục ban đầu `f₀`).\n\n" +
          "**Quy tắc**\n" +
          "- Thuộc tính cần cấm là **cặp** `{i, j}` — không phân biệt thứ tự (`2 7` và `7 2` là một).\n" +
          "- Sau khi nước đi ở bước `t` được thực hiện: `han[{i,j}] = t + TT`. Thuộc tính bị cấm ở bước `s` khi `han > s` (đúng mẫu `tabuUntil > buoc` của §3.2).\n" +
          "- Bước `t`: nếu **không** bị cấm thì đi (trạng thái 1). Nếu bị cấm nhưng `f` **nhỏ hơn hẳn** kỷ lục thì vẫn đi — phá lệ (trạng thái 2). Ngược lại nước bị chặn, bỏ qua đề xuất (trạng thái 0).\n" +
          "- Nước được thực hiện thì ghi (hoặc làm mới) hạn cấm và cập nhật kỷ lục nếu `f` nhỏ hơn.\n\n" +
          "Ví dụ `TT = 3`: nước `(1,2)` đi ở bước 1 → `han = 4` → bị cấm ở bước 2 và 3, được phép lại từ bước 4 (khớp ví dụ làm tay §4).\n\n" +
          "**In:** `S` trạng thái (0/1/2), rồi kỷ lục cuối, rồi **số cặp còn bị cấm ở bước `S + 1`**. **Mức đạt:** in đúng cả bộ giá trị trên cả 10 bộ dữ liệu.\n\n" +
          "**Câu hỏi suy ngẫm:** chạy tab *TT = 1* — vì sao không nước nào bị chặn, dù bạn đặt thời hạn cấm là 1? Tab *TT = 8* chặn nhiều đến mức nào, và có bước nào mà **mọi** đề xuất đều bị chặn không?",
        vanDe: "b14-bang-cam",
        tham: { TT: 4 },
        bienThe: [
          { ten: "TT = 4", tham: { TT: 4 } },
          { ten: "TT = 1 (không chặn gì?)", tham: { TT: 1 } },
          { ten: "TT = 8 (cấm lâu)", tham: { TT: 8 } }
        ],
        soTest: 10,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: "n TT S f0"; rồi S dòng "i j f" (đề xuất ở bước 1..S).
// Đầu ra : S trạng thái (0 = bị chặn, 1 = đi bình thường, 2 = đi nhờ phá lệ), kỷ lục cuối, số cặp còn bị cấm ở bước S+1.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], TT = t[1], S = t[2];
let best = t[3];
const han = {};                                   // han["i-j"] với i < j: bước hết hạn cấm
const trangThai = [];
for (let b = 1; b <= S; b++) {
  const i = t[4 + 3 * (b - 1)], j = t[5 + 3 * (b - 1)], f = t[6 + 3 * (b - 1)];
  // TODO: khoá = cặp {i, j} không phân biệt thứ tự; bị cấm khi han[khoá] > b.
  // TODO: không cấm → đi (1); bị cấm mà f < best → phá lệ (2); còn lại bị chặn (0).
  // TODO: nếu đi: han[khoá] = b + TT ; best = min(best, f).
  trangThai.push(0);
}
let conCam = 0;
// TODO: đếm số cặp có han > S + 1.
print(trangThai.join(" "));
print(best);
print(conCam);
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], TT = t[1], S = t[2];
let best = t[3];
const han = {};                                   // han["i-j"] với i < j: bước hết hạn cấm
const trangThai = [];
for (let b = 1; b <= S; b++) {
  const i = t[4 + 3 * (b - 1)], j = t[5 + 3 * (b - 1)], f = t[6 + 3 * (b - 1)];
  const khoa = Math.min(i, j) + "-" + Math.max(i, j);          // cặp không có thứ tự
  const biCam = (han[khoa] || 0) > b;
  let st;
  if (!biCam) st = 1;
  else if (f < best) st = 2;                                    // phá lệ: tốt hơn HẲN kỷ lục
  else st = 0;
  if (st > 0) { han[khoa] = b + TT; if (f < best) best = f; }   // đi nước thì ghi/làm mới hạn cấm
  trangThai.push(st);
}
let conCam = 0;
for (const k in han) if (han[k] > S + 1) conCam++;
print(trangThai.join(" "));
print(best);
print(conCam);
`
        },
        goiY: [
          "Dùng khoá đã chuẩn hoá `min(i,j) + \"-\" + max(i,j)` để `(2,7)` và `(7,2)` trùng nhau. Chưa từng ghi thì hạn là 0 (không bị cấm).",
          "Thứ tự trong mỗi bước: kiểm tra cấm với hạn **cũ** → quyết định trạng thái → nếu đi thì ghi hạn mới `b + TT` và cập nhật kỷ lục. Đừng cập nhật kỷ lục trước khi so cho phá lệ.",
          "Cuối cùng đếm các cặp có `han > S + 1` (bị cấm ở bước kế tiếp). Tab TT = 1 là phép thử off-by-one: `b + 1 > b + 1` sai nên không bao giờ chặn."
        ]
      },
      {
        id: "tabu-tsp",
        ten: "Tabu Search 2-opt cho TSP với số vòng cố định",
        doKho: 3,
        ref: "§2, §3, §5",
        de: "Cài **Tabu Search** với toán tử **2-opt** cho chu trình ngắn nhất (`n = 50` điểm, khoảng cách Euclid). Dòng đầu của dữ liệu là `n K TT`: `K` là **số vòng lặp** và `TT` là **thời hạn cấm**. Tabu hoàn toàn tất định — không cần ngẫu nhiên.\n\n" +
          "**Khung thuật toán (mỗi vòng)**\n" +
          "1. Duyệt **toàn bộ** nước 2-opt `(i, j)` (`i + 2 ≤ j`, loại cặp `(0, n−1)`): bỏ cạnh `(p[i],p[i+1])`, `(p[j],p[j+1])`, thêm `(p[i],p[j])`, `(p[i+1],p[j+1])`.\n" +
          "2. Một nước **bị cấm** nếu một trong hai cạnh được thêm còn hạn cấm (`cam[a][b] > buoc`); nhưng vẫn được xét nếu độ dài mới **ngắn hơn hẳn** kỷ lục (phá lệ, `<` chặt).\n" +
          "3. Chọn nước có `delta` nhỏ nhất trong các nước được phép — **kể cả khi delta dương** — rồi áp dụng. Nếu mọi nước đều bị cấm thì `break`.\n" +
          "4. Cấm **làm ngược lại**: không được thêm lại hai cạnh vừa bỏ trong `TT` vòng (`cam[a][b] = cam[b][a] = buoc + TT`). Nhớ nghiệm tốt nhất và in nó.\n\n" +
          "**Mức đạt:** hợp lệ → bằng greedy gần nhất → bằng 2-opt (leo đồi từ gần nhất) → hơn 2-opt ít nhất 2,5 % (tổng độ dài 2-opt / tổng độ dài của bạn ≥ 1,025).\n\n" +
          "**Thí nghiệm:** chạy các tab *TT = 1* (lệnh cấm hầu như không chặn gì, nên chỉ còn là “luôn đi nước tốt nhất”) và *TT = 400* (cấm quá nhiều): mức đạt rơi về đâu và vì sao? Với TT hợp lý, hãy in số nước bị chặn mỗi vòng (`log(...)`): nếu gần như luôn bằng 0, bạn đang cấm nhầm chiều.",
        vanDe: "b14-tsp-tabu",
        tham: { n: 50 },
        bienThe: [
          { ten: "TT = 20 (hợp lý)", tham: { n: 50, TT: 20 } },
          { ten: "TT = 1 (không có trí nhớ)", tham: { n: 50, TT: 1 } },
          { ten: "TT = 400 (cấm quá nhiều)", tham: { n: 50, TT: 400 } },
          { ten: "Gom cụm, TT = 20", tham: { n: 50, cum: true, TT: 20 } }
        ],
        soTest: 10,
        gioiHanMs: 3000,
        muc: [
          { ten: "Bằng greedy gần nhất", so: "ganNhat", heSo: 1 },
          { ten: "Bằng 2-opt (leo đồi từ gần nhất)", so: "haiOpt", heSo: 1 },
          { ten: "Hơn 2-opt ít nhất 2,5 % (2-opt / bạn ≥ 1,025)", so: "haiOpt", heSo: 1.025 }
        ],
        khoiDau: {
          js: String.raw`// Đầu vào: "n K TT" (K = số vòng lặp, TT = thời hạn cấm); rồi n dòng "x y".
// Đầu ra : một dòng n chỉ số (hoán vị 1..n), chu trình tìm được.
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1], TT = t[2];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[3 + 2 * i]); y.push(t[4 + 2 * i]); }
const D = [];
for (let a = 0; a < n; a++) {
  D.push([]);
  for (let b = 0; b < n; b++) D[a].push(Math.sqrt((x[a] - x[b]) ** 2 + (y[a] - y[b]) ** 2));
}

// Khởi tạo: láng giềng gần nhất bắt đầu từ điểm 0.
const p = [0], dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  let b = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
  dung[b] = true; p.push(b);
}

// Bảng cấm: cam[a][b] = bước hết hạn của việc THÊM cạnh (a, b); bị cấm khi cam[a][b] > buoc.
const cam = [];
for (let a = 0; a < n; a++) cam.push(new Array(n).fill(0));
let cur = 0;
for (let i = 0; i < n; i++) cur += D[p[i]][p[(i + 1) % n]];
let best = cur, bestP = p.slice();

for (let buoc = 0; buoc < K; buoc++) {
  // TODO 1: duyệt mọi (i, j); delta = D[a][c] + D[b][e] - D[a][b] - D[c][e] với a=p[i], b=p[i+1], c=p[j], e=p[(j+1)%n].
  // TODO 2: nước bị cấm nếu cam[a][c] > buoc hoặc cam[b][e] > buoc — trừ khi cur + delta < best (phá lệ, so sánh chặt).
  // TODO 3: chọn delta nhỏ nhất trong các nước được phép (kể cả delta dương); không có nước nào thì break.
  // TODO 4: áp dụng (đảo p[i+1..j]), cur += delta; ghi cấm cạnh VỪA BỎ: cam[a][b] = cam[b][a] = cam[c][e] = cam[e][c] = buoc + TT.
  // TODO 5: cập nhật best / bestP (bản sao của p) khi có kỷ lục mới.
  break;
}
print(bestP.map((v) => v + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, K, TT;
    scanf("%d %d %d", &n, &K, &TT);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);
    vector<vector<double>> D(n, vector<double>(n));
    for (int a = 0; a < n; a++)
        for (int b = 0; b < n; b++) D[a][b] = sqrt((x[a] - x[b]) * (x[a] - x[b]) + (y[a] - y[b]) * (y[a] - y[b]));

    // Khởi tạo: láng giềng gần nhất bắt đầu từ điểm 0.
    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int b = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (b < 0 || D[p[k - 1]][i] < D[p[k - 1]][b])) b = i;
        dung[b] = true; p.push_back(b);
    }

    // Bảng cấm: cam[a][b] = bước hết hạn của việc THÊM cạnh (a, b); bị cấm khi cam[a][b] > buoc.
    vector<vector<int>> cam(n, vector<int>(n, 0));
    double cur = 0;
    for (int i = 0; i < n; i++) cur += D[p[i]][p[(i + 1) % n]];
    double best = cur;
    vector<int> bestP = p;

    for (int buoc = 0; buoc < K; buoc++) {
        // TODO 1: duyệt mọi (i, j); delta = D[a][c] + D[b][e] - D[a][b] - D[c][e] với a=p[i], b=p[i+1], c=p[j], e=p[(j+1)%n].
        // TODO 2: nước bị cấm nếu cam[a][c] > buoc hoặc cam[b][e] > buoc — trừ khi cur + delta < best (phá lệ, so sánh chặt).
        // TODO 3: chọn delta nhỏ nhất trong các nước được phép (kể cả delta dương); không có nước nào thì break.
        // TODO 4: áp dụng (reverse p[i+1..j]), cur += delta; ghi cấm cạnh VỪA BỎ: cam[a][b] = cam[b][a] = cam[c][e] = cam[e][c] = buoc + TT.
        // TODO 5: cập nhật best / bestP khi có kỷ lục mới.
        break;
    }
    for (int i = 0; i < n; i++) printf("%d%c", bestP[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], K = t[1], TT = t[2];
const x = [], y = [];
for (let i = 0; i < n; i++) { x.push(t[3 + 2 * i]); y.push(t[4 + 2 * i]); }
const D = new Float64Array(n * n);
for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) D[a * n + b] = Math.sqrt((x[a] - x[b]) ** 2 + (y[a] - y[b]) ** 2);

// Khởi tạo: láng giềng gần nhất.
const p = [0], dung = new Array(n).fill(false);
dung[0] = true;
for (let k = 1; k < n; k++) {
  let b = -1;
  for (let i = 0; i < n; i++) if (!dung[i] && (b < 0 || D[p[k - 1] * n + i] < D[p[k - 1] * n + b])) b = i;
  dung[b] = true; p.push(b);
}

const cam = new Int32Array(n * n);                 // cam[a*n+b]: bước hết hạn cấm THÊM cạnh (a, b)
let cur = 0;
for (let i = 0; i < n; i++) cur += D[p[i] * n + p[(i + 1) % n]];
let best = cur, bestP = p.slice();

for (let buoc = 0; buoc < K; buoc++) {
  let bi = -1, bj = -1, bd = Infinity;
  for (let i = 0; i <= n - 3; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
      const delta = D[a * n + c] + D[b * n + e] - D[a * n + b] - D[c * n + e];
      const biCam = cam[a * n + c] > buoc || cam[b * n + e] > buoc;
      if (biCam && !(cur + delta < best - 1e-9)) continue;     // phá lệ: chỉ khi kỷ lục mới HẲN (<, không phải <=)
      if (delta < bd) { bd = delta; bi = i; bj = j; }            // chọn tốt nhất, kể cả delta dương
    }
  }
  if (bi < 0) break;                                             // mọi nước đều bị cấm
  const a = p[bi], b = p[bi + 1], c = p[bj], e = p[(bj + 1) % n];
  for (let l = bi + 1, h = bj; l < h; l++, h--) { const tmp = p[l]; p[l] = p[h]; p[h] = tmp; }
  cur += bd;
  // Cấm LÀM NGƯỢC LẠI: không được thêm lại hai cạnh vừa bỏ.
  cam[a * n + b] = cam[b * n + a] = buoc + TT;
  cam[c * n + e] = cam[e * n + c] = buoc + TT;
  if (cur < best - 1e-9) { best = cur; bestP = p.slice(); }
}
print(bestP.map((v) => v + 1).join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, K, TT;
    scanf("%d %d %d", &n, &K, &TT);
    vector<double> x(n), y(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &x[i], &y[i]);
    vector<double> D(n * n);
    for (int a = 0; a < n; a++)
        for (int b = 0; b < n; b++) D[a * n + b] = sqrt((x[a] - x[b]) * (x[a] - x[b]) + (y[a] - y[b]) * (y[a] - y[b]));

    vector<int> p(1, 0);
    vector<bool> dung(n, false);
    dung[0] = true;
    for (int k = 1; k < n; k++) {
        int b = -1;
        for (int i = 0; i < n; i++)
            if (!dung[i] && (b < 0 || D[p[k - 1] * n + i] < D[p[k - 1] * n + b])) b = i;
        dung[b] = true; p.push_back(b);
    }

    vector<int> cam(n * n, 0);                     // cam[a*n+b]: bước hết hạn cấm THÊM cạnh (a, b)
    double cur = 0;
    for (int i = 0; i < n; i++) cur += D[p[i] * n + p[(i + 1) % n]];
    double best = cur;
    vector<int> bestP = p;

    for (int buoc = 0; buoc < K; buoc++) {
        int bi = -1, bj = -1;
        double bd = 1e18;
        for (int i = 0; i <= n - 3; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int a = p[i], b = p[i + 1], c = p[j], e = p[(j + 1) % n];
                double delta = D[a * n + c] + D[b * n + e] - D[a * n + b] - D[c * n + e];
                bool biCam = cam[a * n + c] > buoc || cam[b * n + e] > buoc;
                if (biCam && !(cur + delta < best - 1e-9)) continue;     // phá lệ: kỷ lục mới HẲN
                if (delta < bd) { bd = delta; bi = i; bj = j; }
            }
        if (bi < 0) break;                                               // mọi nước đều bị cấm
        int a = p[bi], b = p[bi + 1], c = p[bj], e = p[(bj + 1) % n];
        reverse(p.begin() + bi + 1, p.begin() + bj + 1);
        cur += bd;
        cam[a * n + b] = cam[b * n + a] = buoc + TT;                     // cấm làm ngược lại
        cam[c * n + e] = cam[e * n + c] = buoc + TT;
        if (cur < best - 1e-9) { best = cur; bestP = p; }
    }
    for (int i = 0; i < n; i++) printf("%d%c", bestP[i] + 1, i + 1 < n ? ' ' : '\n');
    return 0;
}
`
        },
        goiY: [
          "Mỗi vòng quét **toàn bộ** cặp (i, j) rồi mới chọn; đừng áp dụng nước đầu tiên tìm được. Chọn theo `delta` nhỏ nhất kể cả khi nó dương — đó là cách Tabu đi xuống để thoát bẫy.",
          "Kiểm tra cấm trên hai **cạnh được thêm** `(a, c)` và `(b, e)`; sau khi đi, ghi cấm cho hai cạnh **vừa bỏ** `(a, b)` và `(c, e)` (hoàn tác của nước vừa đi). Cấm nhầm chiều thì bảng cấm chẳng chặn gì.",
          "Phá lệ so sánh chặt: cho phép nước bị cấm chỉ khi `cur + delta < best` (dùng thêm 1e-9 để tránh sai số). Nhớ `best` và `break` khi không còn nước được phép."
        ]
      }
    ]
  });
})();
