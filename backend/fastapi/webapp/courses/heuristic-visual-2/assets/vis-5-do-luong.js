/* =====================================================================
   Nhom 5 — Do luong & can
   do-luong-ablation (b.4) · can-tren-can-duoi (b.18)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     15. Do luong — bao nhieu test case la du?
     ================================================================ */
  demo({
    id: "do-luong-ablation", nhom: "Đo lường & cận", mon: "B04",
    ten: "Bao nhiêu test case là đủ?",
    moTa: "Vì sao <b>một test case là vô nghĩa</b>. Kéo σ và Δ để thấy " +
          "số test cần tăng theo <b>bình phương</b>, và chỗ kết luận trở nên vô căn cứ.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-04-do-luong">B04 — Đo lường</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { sigma: 10, delta: 5, N: 20, hat: 5 };

      /* mo phong: chay N test cho hai thuat toan, B tot hon A dung delta % */
      function moPhong() {
        var r = V.rng(tt.hat), A = [], B = [], i;
        for (i = 0; i < tt.N; i++) {
          /* diem co ban 100, do lech chuan sigma % */
          var chung = r.chuan() * tt.sigma * 0.55;     /* phan chung cho ca hai (cung test case) */
          A.push(100 + chung + r.chuan() * tt.sigma * 0.83);
          B.push(100 + tt.delta + chung + r.chuan() * tt.sigma * 0.83);
        }
        return { A: A, B: B };
      }
      function tb(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
      function sd(a) {
        var m = tb(a);
        return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) /
                         Math.max(1, a.length - 1));
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var mp = moPhong();
        var mA = tb(mp.A), mB = tb(mp.B);
        var semA = sd(mp.A) / Math.sqrt(tt.N), semB = sd(mp.B) / Math.sqrt(tt.N);
        var se = Math.sqrt(semA * semA + semB * semB);
        var d = mB - mA;
        var coYNghia = Math.abs(d) > 2 * se;

        var padL = 54, padR = 16, padT = 40, padB = 40;
        var w = W - padL - padR, h = H - padT - padB;
        var lo = Math.min.apply(null, mp.A.concat(mp.B)) - 2;
        var hi = Math.max.apply(null, mp.A.concat(mp.B)) + 2;
        var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Điểm của từng test case  (N = " + tt.N + ")", padL, 18);

        /* luoi */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = lo + (hi - lo) * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(0), padL - 6, yy + 3);
        }

        /* cham cho tung thuat toan */
        [{ ds: mp.A, mau: "#b45309", ten: "A" }, { ds: mp.B, mau: "#5b4bd6", ten: "B" }]
          .forEach(function (q, k) {
            q.ds.forEach(function (v, i) {
              var x = padL + (i + 0.5) / tt.N * w + (k ? 3 : -3);
              g.fillStyle = q.mau; g.globalAlpha = 0.6;
              g.beginPath(); g.arc(x, Y(v), 3, 0, 6.2832); g.fill();
              g.globalAlpha = 1;
            });
            /* duong trung binh */
            var m = tb(q.ds);
            g.strokeStyle = q.mau; g.lineWidth = 2;
            g.beginPath(); g.moveTo(padL, Y(m)); g.lineTo(padL + w, Y(m)); g.stroke();
            g.fillStyle = q.mau; g.font = "700 10.5px system-ui"; g.textAlign = "left";
            g.fillText(q.ten + " = " + m.toFixed(2), padL + w + 2 - 60, Y(m) - 5);
          });

        /* ket luan */
        g.textAlign = "left";
        g.fillStyle = coYNghia ? "#0f766e" : V.mau("loi");
        g.font = "700 12.5px system-ui";
        g.fillText(coYNghia ? "✓ CÓ Ý NGHĨA" : "✗ TRONG NHIỄU ĐO — không kết luận được",
                   padL, H - 14);
        g.fillStyle = V.mau("tx2"); g.font = "11px ui-monospace, monospace";
        g.fillText("|Δ| = " + Math.abs(d).toFixed(2) + "   vs   2·SE = " + (2 * se).toFixed(2),
                   padL + 250, H - 14);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Bảng tra nhanh:  N ≳ 8·(σ/Δ)²", 14, 18);

        /* bang chuan cua bai 4 §3.3 */
        var chenh = [10, 5, 2, 1];
        var cot = [[5, "σ/x̄ = 5 %"], [10, "σ/x̄ = 10 %"]];
        g2.fillStyle = V.mau("tx3"); g2.font = "600 10.5px system-ui";
        g2.fillText("muốn phát hiện", 14, 38);
        cot.forEach(function (c, i) { g2.fillText(c[1], 190 + i * 130, 38); });

        chenh.forEach(function (D, i) {
          var y = 58 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
          g2.fillText("chênh " + D + " %", 14, y);
          cot.forEach(function (c, k) {
            var N = Math.round(8 * Math.pow(c[0] / D, 2));
            g2.fillStyle = N > 400 ? V.mau("loi") : V.mau("tx");
            g2.font = (N > 400 ? "700 " : "600 ") + "11.5px ui-monospace, monospace";
            g2.fillText(String(N) + " test", 190 + k * 130, y);
          });
        });

        /* N can cho cau hinh hien tai */
        var Ncan = Math.ceil(8 * Math.pow(tt.sigma / Math.max(0.1, tt.delta), 2));
        var y0 = 156;
        g2.fillStyle = V.mau("surf2"); g2.fillRect(14, y0, W2 - 28, 30);
        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("Cấu hình hiện tại: σ = " + tt.sigma + ", Δ = " + tt.delta +
                    "  ⇒  cần N ≳ " + Ncan + " test", 22, y0 + 20);
        g2.fillStyle = tt.N >= Ncan ? "#0f766e" : V.mau("loi");
        g2.font = "700 11.5px system-ui";
        g2.fillText(tt.N >= Ncan ? "Bạn đang chạy " + tt.N + " — đủ."
                                 : "Bạn đang chạy " + tt.N + " — THIẾU, kết luận sẽ không vững.",
                    22, y0 + 46);

        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Giai đoạn đầu (cải thiện 10–30 %): 30 test là đủ.", 22, y0 + 68);
        g2.fillText("Giai đoạn cuối (giành giật 1 %): cần HÀNG TRĂM. Vì thế bộ chấm phải chạy nhanh.",
                    22, y0 + 84);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "σ — độ lệch chuẩn giữa các test", min: 1, max: 30, buoc: 1,
                  giaTri: tt.sigma, doi: function (v) { tt.sigma = v; veHet(); } }),
        V.truot({ ten: "Δ — chênh lệch THẬT giữa A và B", min: 0, max: 20, buoc: 0.5,
                  giaTri: tt.delta, doi: function (v) { tt.delta = v; veHet(); } }),
        V.truot({ ten: "N — số test case chạy", min: 1, max: 200, buoc: 1, giaTri: tt.N,
                  doi: function (v) { tt.N = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Đây là mô phỏng thật:</b> B thực sự tốt hơn A đúng Δ điểm. Câu hỏi là " +
          "<b>bạn có ĐO ra được điều đó không</b>.<ul>" +
          "<li><b>Kéo N về 1</b>: một test case duy nhất. Kết luận lật qua lật lại khi đổi " +
          "hạt giống — đôi khi A còn \"thắng\" dù sự thật là B tốt hơn. " +
          "★ <b>Đây là lý do một test case là vô nghĩa</b>, kể cả khi bạn thấy chênh lệch lớn.</li>" +
          "<li>Quy tắc kết luận: chênh lệch có ý nghĩa khi " +
          "<code>|Δ| &gt; 2·√(SEM_A² + SEM_B²)</code> — xấp xỉ khoảng tin cậy 95 %.</li>" +
          "<li><b>Kéo Δ về 0</b> (hai thuật toán thật ra <b>giống hệt nhau</b>) rồi đổi hạt giống " +
          "liên tục. Thỉnh thoảng bạn vẫn thấy \"CÓ Ý NGHĨA\" — đó là <b>dương tính giả</b>, " +
          "và với ngưỡng 95 % nó xảy ra khoảng <b>1 trong 20 lần</b>. " +
          "Ai thử 20 ý tưởng vô dụng sẽ \"tìm ra\" một cái hiệu quả.</li></ul>" +
          "<b>★ Con số phải thuộc lòng:</b> <code>N ≳ 8(σ/Δ)²</code> — " +
          "<b>bình phương</b>, không phải tuyến tính. Muốn phát hiện chênh lệch <b>nhỏ đi một nửa</b> " +
          "thì cần <b>gấp bốn lần</b> số test.<ul>" +
          "<li>Đọc bảng: với σ/x̄ = 10 %, phát hiện chênh <b>1 %</b> cần <b>800 test</b>. " +
          "Phần lớn cải thiện được báo cáo trong tài liệu nằm ở mức đó.</li>" +
          "<li>★ <b>Hệ quả hành động:</b> ở giai đoạn đầu (cải thiện 10–30 %), 30 test là đủ. " +
          "Ở giai đoạn cuối, bạn cần hàng trăm — nên <b>bộ chấm phải chạy nhanh</b>, " +
          "và đó là khoản đầu tư đáng giá nhất trong cả kỳ thi.</li>" +
          "<li>★ <b>Mẹo rẻ nhất để giảm σ:</b> <b>so theo cặp</b> — chạy A và B trên " +
          "<b>cùng</b> test case và cùng hạt giống, rồi so <b>hiệu từng cặp</b>. " +
          "Phương sai chung bị triệt tiêu (<code>Var(A−B) = Var(A)+Var(B)−2Cov(A,B)</code>), " +
          "thường giảm σ hiệu dụng một nửa ⇒ <b>giảm N bốn lần, miễn phí</b>.</li></ul>" +
          "<b>⇒ Ablation study là công cụ mạnh nhất (bài 4 §5): tắt TỪNG thành phần một " +
          "và đo lại. Thành phần nào tắt đi mà điểm không đổi thì nó KHÔNG đóng góp gì — " +
          "dù bạn đã tốn ba ngày viết nó.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     16. Can tren / can duoi — BHH va quyet dinh dung
     ================================================================ */
  demo({
    id: "can-tren-can-duoi", nhom: "Đo lường & cận", mon: "B18",
    ten: "Cận trên, cận dưới — và quyết định KHI NÀO DỪNG",
    moTa: "Hằng số BHH cho cận dưới quãng đường. " +
          "Biết khoảng cách tới cận, bạn biết <b>còn đáng tối ưu nữa không</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-18-can-tren-can-duoi">B18 — Cận trên & cận dưới</a>',
    dung: function (host) {
      var W = 560, H = 280, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      /* mac dinh = dung so lieu de thi that cua bai 18 §4.2 */
      var tt = { n: 158, canh: 100, beta: 0.92, hienTai: 1510, lam: 1420, tongDiem: 32.9 };

      function canDuoi() { return tt.beta * Math.sqrt(tt.canh * tt.canh * tt.n); }

      function ve() {
        g.clearRect(0, 0, W, H);
        var L = canDuoi();
        var duDia = tt.hienTai - L;
        var vuot = (tt.hienTai / L - 1) * 100;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("L* ≈ β·√(A·n) = " + tt.beta + " · √(" +
                   (tt.canh * tt.canh).toLocaleString("vi") + " × " + tt.n + ")", 14, 20);

        /* thanh so sanh */
        var x0 = 14, bw = W - 28, y0 = 44;
        var maxV = Math.max(tt.hienTai, L) * 1.08;

        [{ t: "Cận dưới lý thuyết (BHH)", v: L, mau: "#0f766e" },
         { t: "Lời giải hiện tại của bạn", v: tt.hienTai, mau: "#5b4bd6" }
        ].forEach(function (r, i) {
          var y = y0 + i * 54;
          g.fillStyle = V.mau("surf2"); g.fillRect(x0, y, bw, 28);
          g.fillStyle = r.mau; g.fillRect(x0, y, Math.max(3, bw * (r.v / maxV)), 28);
          g.fillStyle = "#fff"; g.font = "600 11.5px system-ui";
          g.fillText(r.t, x0 + 9, y + 19);
          g.fillStyle = V.mau("tx"); g.font = "700 12px ui-monospace, monospace";
          g.fillText(r.v.toFixed(0) + " phút", x0 + 4, y + 44);
        });

        /* du dia */
        var yd = y0 + 2 * 54 + 8;
        g.fillStyle = V.mau("loi"); g.font = "700 12.5px system-ui";
        g.fillText("Dư địa còn lại: " + duDia.toFixed(0) + " phút  (cao hơn cận " +
                   vuot.toFixed(0) + " %)", 14, yd + 12);

        /* quy ra diem */
        var diem = duDia * tt.lam;
        var pct = diem / (tt.tongDiem * 1e6) * 100;
        g.fillStyle = V.mau("tx2"); g.font = "11.5px system-ui";
        g.fillText("Quy ra điểm với λ = " + tt.lam.toLocaleString("vi") + " : " +
                   duDia.toFixed(0) + " × " + tt.lam.toLocaleString("vi") + " ≈ " +
                   Math.round(diem).toLocaleString("vi") + " điểm", 14, yd + 34);
        g.fillStyle = V.mau("ac"); g.font = "700 13px system-ui";
        g.fillText("= " + pct.toFixed(1) + " % tổng điểm hiện tại (" + tt.tongDiem + " triệu)",
                   14, yd + 56);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var L = canDuoi();
        var vuot = (tt.hienTai / L - 1) * 100;
        /* ★ Truc quyet dinh KHONG phai "% vuot can quang duong" ma la
           "du dia quy ra % TONG DIEM" — hai con so nay rat khac nhau:
           de thi that vuot can 31% nhung quy ra diem chi 1,5%. */
        var duDiaDiem = (tt.hienTai - L) * tt.lam / (tt.tongDiem * 1e6) * 100;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Bảng quyết định — theo dư địa QUY RA ĐIỂM:", 14, 18);

        var BANG = [
          { lo: 0, hi: 1, t: "< 1 %", y: "Gần tối ưu. DỪNG.", m: "#0f766e" },
          { lo: 1, hi: 3, t: "1–3 %", y: "Dư địa mỏng. Thường KHÔNG đáng một tuần công.", m: "#b45309" },
          { lo: 3, hi: 10, t: "3–10 %", y: "Dư địa thật. Đáng đầu tư thêm.", m: "#5b4bd6" },
          { lo: 10, hi: 1e9, t: "> 10 %", y: "Rất nhiều — hoặc thuật toán/mô hình SAI.", m: "#b91c1c" }
        ];
        BANG.forEach(function (b, i) {
          var y = 34 + i * 30;
          var dang = duDiaDiem >= b.lo && duDiaDiem < b.hi;
          if (dang) {
            g2.fillStyle = V.mau("acbg"); g2.fillRect(10, y - 2, W2 - 20, 26);
          }
          g2.fillStyle = b.m; g2.font = "700 11.5px ui-monospace, monospace";
          g2.fillText(b.t, 18, y + 15);
          g2.fillStyle = dang ? V.mau("tx") : V.mau("tx2");
          g2.font = (dang ? "600 " : "") + "11.5px system-ui";
          g2.fillText(b.y, 90, y + 15);
          if (dang) {
            g2.fillStyle = V.mau("ac"); g2.font = "700 11px system-ui";
            g2.fillText("← bạn ở đây", 430, y + 15);
          }
        });

        var y0 = 168;
        g2.fillStyle = V.mau("tx2"); g2.font = "600 11px system-ui";
        g2.fillText("★ Vượt cận quãng đường " + vuot.toFixed(0) + " % — nhưng quy ra điểm chỉ " +
                    duDiaDiem.toFixed(1) + " %. ĐỪNG lẫn hai con số này.", 14, y0 - 16);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("β ≈ 0,7124 cho khoảng cách Euclid (L₂) · β ≈ 0,92 cho Manhattan (L₁).", 14, y0);
        g2.fillText("Định lý Beardwood–Halton–Hammersley (1959), cho n điểm ngẫu nhiên đều.", 14, y0 + 16);
        g2.fillStyle = V.mau("loi"); g2.font = "600 11px system-ui";
        g2.fillText("⚠ Đây là cận cho điểm PHÂN BỐ ĐỀU. Dữ liệu gom cụm thì cận này quá lỏng.",
                    14, y0 + 36);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Giá trị của cận trên không phải điểm số — mà là biết KHI NÀO NGỪNG.",
                    14, y0 + 58);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "n — số điểm", min: 20, max: 500, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.truot({ ten: "Cạnh lưới (diện tích = cạnh²)", min: 20, max: 200, buoc: 5,
                  giaTri: tt.canh, doi: function (v) { tt.canh = v; veHet(); } }),
        V.chon({ ten: "Khoảng cách", giaTri: String(tt.beta),
                 muc: [{ v: "0.92", t: "Manhattan L₁ — β ≈ 0,92" },
                       { v: "0.7124", t: "Euclid L₂ — β ≈ 0,7124" }],
                 doi: function (v) { tt.beta = parseFloat(v); veHet(); } }),
        V.truot({ ten: "Độ dài lời giải hiện tại (phút)", min: 200, max: 3000, buoc: 10,
                  giaTri: tt.hienTai, doi: function (v) { tt.hienTai = v; veHet(); } }),
        V.truot({ ten: "λ — giá mờ (điểm mỗi phút)", min: 100, max: 3000, buoc: 10,
                  giaTri: tt.lam, doi: function (v) { tt.lam = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Câu hỏi mà bài 18 trả lời:</b> bạn đạt 32,9 triệu điểm. " +
          "<b>Còn đáng bỏ thêm một tuần để tối ưu nữa không?</b> " +
          "Không có cận, đây chỉ là cảm tính. Có cận, nó là phép tính.<ul>" +
          "<li><b>Định lý Beardwood–Halton–Hammersley (1959):</b> với n điểm ngẫu nhiên " +
          "phân bố đều trên miền diện tích A, độ dài tour TSP tối ưu hội tụ về " +
          "<code>L* ≈ β√(A·n)</code>.</li>" +
          "<li>Giá trị mặc định là <b>đề thi thật</b>: 158 ngôi nhà trên lưới 100×100, " +
          "Manhattan ⇒ <code>L* ≈ 0,92·√(10 000 × 158) ≈ 1 157 phút</code>. " +
          "Lời giải đi <b>1 510 phút</b> — cao hơn cận <b>31 %</b>.</li>" +
          "<li>★ <b>Bước biến cận thành quyết định:</b> dư địa <code>1 510 − 1 157 = 353 phút</code>. " +
          "Quy ra điểm bằng <b>giá mờ</b> λ = 1 420: <code>353 × 1 420 ≈ 501 000 điểm</code> " +
          "≈ <b>1,5 %</b> tổng điểm.</li>" +
          "<li>⇒ Cộng thêm ~1,5 % từ khâu chọn lọc, <b>toàn bộ dư địa còn lại của bài toán ≈ 3 %</b>. " +
          "<b>Biết con số đó, bạn biết ngay: không đáng bỏ thêm một tuần.</b></li>" +
          "<li>★ <b>Đừng lẫn hai con số:</b> lời giải vượt cận <b>quãng đường</b> tới 31 %, " +
          "nghe như còn rất nhiều dư địa. Nhưng quy ra <b>điểm</b> thì chỉ còn <b>1,5 %</b>. " +
          "Bảng quyết định dưới khoá theo <b>% tổng điểm</b> — vì đó mới là thứ bạn được chấm.</li></ul>" +
          "<b>★ Ba cách dựng cận, xếp theo độ dễ:</b> ① <b>nới lỏng LP</b> cho bài có ngân sách " +
          "(bỏ ràng buộc nguyên, giải bằng greedy tỉ số — xem demo Giá mờ) · " +
          "② <b>hằng số BHH</b> cho quãng đường (demo này) · " +
          "③ <b>nới lỏng Lagrange</b> khi có ràng buộc ghép.<br><br>" +
          "<b>⚠️ Hai cạm bẫy phải biết:</b><ul>" +
          "<li>BHH giả định điểm <b>phân bố đều</b>. Dữ liệu <b>gom cụm</b> có tour tối ưu " +
          "ngắn hơn nhiều ⇒ cận trở nên <b>quá lỏng</b> và bạn sẽ tưởng còn nhiều dư địa " +
          "trong khi thật ra đã gần tối ưu.</li>" +
          "<li>Cận dưới cho <b>quãng đường</b> không phải cận cho <b>điểm</b>. Phải quy đổi " +
          "qua λ, và λ thì phụ thuộc ngân sách — nên đừng dùng lại λ cũ cho bộ dữ liệu mới.</li></ul>" +
          "<b>⇒ Giá trị thật của cận trên không phải là điểm số nó mang lại — " +
          "mà là nó cho bạn quyền NGỪNG mà không áy náy, và chuyển công sức sang chỗ còn dư địa.</b>"
      });
      veHet();
    }
  });

})();
