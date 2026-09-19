/* =====================================================================
   Nhom 1 — Nen tang bai toan
   bung-no-to-hop (b.2) · bieu-dien-nghiem (b.3) · dia-hinh-toi-uu (b.12)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     1. Bung no to hop — va vi sao |S| khong lung tuc nghia la kho
     ================================================================ */
  demo({
    id: "bung-no-to-hop", nhom: "Nền tảng bài toán", mon: "B02",
    ten: "Bùng nổ tổ hợp — và cái bẫy của nó",
    moTa: "Bốn họ không gian nghiệm trên thang log. Rồi câu hỏi thật: " +
          "<b>không gian khổng lồ có tự động nghĩa là bài toán khó không?</b>",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-02-vi-sao-kho">B02 — Vì sao khó</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 20, m: 5, k: 15, ho: "tatca", tocDo: 9 };   /* tocDo = log10 phép/giây */

      /* log10 cua kich thuoc khong gian — dung log de khong tran so */
      function log10Kichthuoc(ho, n) {
        var i, s = 0;
        if (ho === "tapcon") return n * Math.log10(2);
        if (ho === "hoanvi") { for (i = 2; i <= n; i++) s += Math.log10(i); return s; }
        if (ho === "gannhan") return n * Math.log10(Math.max(2, tt.m));
        if (ho === "chonsap") {                     /* n!/(n-k)! voi k = min(k, n) */
          var k = Math.min(tt.k, n);
          for (i = 0; i < k; i++) s += Math.log10(n - i);
          return s;
        }
        return 0;
      }

      var HO = [
        { v: "tapcon",  t: "Chọn tập con  2ⁿ",            mau: "#0f766e" },
        { v: "hoanvi",  t: "Hoán vị  n!",                 mau: "#9d174d" },
        { v: "chonsap",  t: "Chọn và sắp  n!/(n−k)!",     mau: "#b45309" },
        { v: "gannhan", t: "Gán nhãn  mⁿ",                mau: "#5b4bd6" }
      ];

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 52, padR = 14, padT = 16, padB = 34;
        var w = W - padL - padR, h = H - padT - padB;
        var nMax = 40, yMax = 60;                    /* truc y: log10, toi 10^60 */

        var X = function (n) { return padL + n / nMax * w; };
        var Y = function (L) { return padT + h - Math.min(L, yMax) / yMax * h; };

        /* luoi + nhan truc */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var L = 0; L <= yMax; L += 10) {
          g.beginPath(); g.moveTo(padL, Y(L)); g.lineTo(padL + w, Y(L)); g.stroke();
          g.fillText(L === 0 ? "1" : "10^" + L, padL - 6, Y(L) + 3);
        }
        g.textAlign = "center";
        for (var n = 0; n <= nMax; n += 10) {
          g.fillText(String(n), X(n), padT + h + 15);
        }
        g.fillText("n — kích thước bài toán", padL + w / 2, padT + h + 29);

        /* duong gioi han: so phep tinh trong 1 GIAY va trong 1 NAM */
        [[tt.tocDo, "1 giây"], [tt.tocDo + Math.log10(3.15e7), "1 năm"]].forEach(function (q) {
          if (q[0] > yMax) return;
          g.save(); g.setLineDash([5, 4]); g.strokeStyle = V.mau("loi"); g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(padL, Y(q[0])); g.lineTo(padL + w, Y(q[0])); g.stroke();
          g.restore();
          g.fillStyle = V.mau("loi"); g.font = "600 10px system-ui"; g.textAlign = "left";
          g.fillText("vét cạn xong trong " + q[1], padL + 5, Y(q[0]) - 4);
        });

        /* cac duong ho */
        HO.forEach(function (ho) {
          if (tt.ho !== "tatca" && tt.ho !== ho.v) return;
          g.strokeStyle = ho.mau; g.lineWidth = 2.2;
          g.beginPath();
          for (var n = 1; n <= nMax; n += 0.5) {
            var L = log10Kichthuoc(ho.v, n);
            var yy = Y(L);
            if (n === 1) g.moveTo(X(n), yy); else g.lineTo(X(n), yy);
            if (L > yMax) break;
          }
          g.stroke();
        });

        /* vach n hien tai */
        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("ac"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(tt.n), padT); g.lineTo(X(tt.n), padT + h); g.stroke();
        g.restore();

        /* chu giai + gia tri tai n */
        var yy = padT + 8;
        g.textAlign = "left"; g.font = "600 11px system-ui";
        HO.forEach(function (ho) {
          if (tt.ho !== "tatca" && tt.ho !== ho.v) return;
          var L = log10Kichthuoc(ho.v, tt.n);
          g.fillStyle = ho.mau;
          g.fillText("● " + ho.t + " = " + docSo(L), padL + 8, yy);
          yy += 15;
        });
      }

      function docSo(L) {
        if (L < 6) return Math.round(Math.pow(10, L)).toLocaleString("vi");
        return "10^" + L.toFixed(1);
      }

      /* ---- bang 2: cai bay — cai tui n=100 ---- */
      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var n = 100, Wcap = 25000;
        var logVet = n * Math.log10(2);                  /* 2^100 */
        var logDP = Math.log10(n * Wcap);                /* O(nW) */
        var giayVet = Math.pow(10, logVet - tt.tocDo);
        var giayDP = Math.pow(10, logDP - tt.tocDo);

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Cái túi với n = 100, W = 25 000 — cùng một bài toán, hai cách giải:", 14, 22);

        var hang = [
          { t: "Vét cạn 2¹⁰⁰ nghiệm", L: logVet, s: giayVet, mau: "#b91c1c" },
          { t: "Quy hoạch động O(n·W)", L: logDP, s: giayDP, mau: "#0f766e" }
        ];
        var x0 = 14, y0 = 44, bw = W2 - 28, hh = 30;
        hang.forEach(function (r, i) {
          var y = y0 + i * (hh + 30);
          var tyLe = Math.min(1, r.L / 32);
          g2.fillStyle = V.mau("surf2");
          g2.fillRect(x0, y, bw, hh);
          g2.fillStyle = r.mau;
          g2.fillRect(x0, y, Math.max(3, bw * tyLe), hh);
          g2.fillStyle = "#fff"; g2.font = "600 11.5px system-ui";
          g2.fillText(r.t, x0 + 9, y + hh / 2 + 4);
          g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
          g2.fillText("≈ 10^" + r.L.toFixed(1) + " phép  →  " + docThoiGian(r.s),
                      x0 + 2, y + hh + 16);
        });

        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("⇒ |S| = 10³⁰ mà giải trong mili-giây. Kích thước KHÔNG phải độ khó.",
                    14, H2 - 10);
      }

      function docThoiGian(s) {
        if (s < 1e-3) return (s * 1e6).toFixed(1) + " µs";
        if (s < 1) return (s * 1e3).toFixed(1) + " ms";
        if (s < 60) return s.toFixed(1) + " giây";
        if (s < 3.15e7) return (s / 86400).toFixed(1) + " ngày";
        var nam = s / 3.15e7;
        if (nam < 1e6) return Math.round(nam).toLocaleString("vi") + " năm";
        return "10^" + Math.log10(nam).toFixed(1) + " năm";
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "n — kích thước", min: 1, max: 40, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.truot({ ten: "m — số nhóm (cho mⁿ)", min: 2, max: 10, buoc: 1, giaTri: tt.m,
                  doi: function (v) { tt.m = v; veHet(); } }),
        V.truot({ ten: "k — độ dài dãy (cho n!/(n−k)!)", min: 1, max: 25, buoc: 1,
                  giaTri: tt.k, doi: function (v) { tt.k = v; veHet(); } }),
        V.truot({ ten: "Tốc độ máy (10^x phép/giây)", min: 6, max: 12, buoc: 1,
                  giaTri: tt.tocDo, doi: function (v) { tt.tocDo = v; veHet(); } }),
        V.chon({ ten: "Hiện họ nào", giaTri: tt.ho,
                 muc: [{ v: "tatca", t: "Tất cả bốn họ" }].concat(
                        HO.map(function (h) { return { v: h.v, t: h.t }; })),
                 doi: function (v) { tt.ho = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Biểu đồ trên — bốn họ không gian nghiệm.</b> Trục dọc là <b>log₁₀</b>, " +
          "nên một đường thẳng ở đây là <b>tăng theo hàm mũ</b> ở đời thực.<ul>" +
          "<li><b>Kéo n tới 20 và đọc hoán vị:</b> <code>20! ≈ 2,4×10¹⁸</code>. " +
          "Thêm đúng 5 phần tử nữa từ n=15 (<code>1,3×10¹²</code>) là <b>nhân thêm một triệu lần</b>.</li>" +
          "<li><b>Hai đường đứt đỏ</b> là chỗ máy vét cạn xong trong 1 giây và trong 1 năm. " +
          "Với máy 10⁹ phép/giây, hoán vị vượt mốc \"1 năm\" ở khoảng <b>n = 20</b>. " +
          "Kéo tốc độ máy lên 10¹² — mốc đó chỉ dịch sang phải <b>một hai đơn vị</b>. " +
          "★ Đây là điều quan trọng nhất của bài: <b>phần cứng không cứu được bùng nổ tổ hợp.</b></li>" +
          "<li>Gán nhãn <code>mⁿ</code> với m=5, n=40 đã là <code>10²⁸</code>. Bài P2 thật " +
          "(260 đơn, 5 ngày) là <code>5²⁶⁰ ≈ 10¹⁸¹</code> — nhiều hơn số nguyên tử trong vũ trụ quan sát được.</li></ul>" +
          "<b>Biểu đồ dưới — và đây là cái bẫy.</b><ul>" +
          "<li>Cái túi có <code>2¹⁰⁰ ≈ 1,27×10³⁰</code> nghiệm. Vét cạn: <b>3×10¹³ năm</b>. " +
          "Nhưng quy hoạch động giải nó trong <code>O(n·W) = 2,5×10⁶</code> phép — " +
          "<b>2,5 mili-giây</b>.</li>" +
          "<li>★ <b>Vì sao?</b> Vì <code>S</code> có <b>cấu trúc</b>: hai nghiệm dùng cùng tổng " +
          "cân nặng thì tương đương nhau về tương lai. DP gộp <code>2¹⁰⁰</code> nghiệm " +
          "thành <code>100 × 25 000</code> trạng thái.</li>" +
          "<li>⚠️ <b>Nhưng DP cái túi vẫn KHÔNG phải đa thức:</b> <code>O(nW)</code> phụ thuộc " +
          "<i>giá trị</i> của W, không phải <i>số bit</i> viết ra W. Viết W cần <code>log₂W</code> bit, " +
          "nên <code>O(nW) = O(n·2^(log₂W))</code> — hàm mũ theo <b>kích thước đầu vào</b>.</li></ul>" +
          "<b>⇒ Bài học dùng được: trước khi viết heuristic, hãy hỏi <i>bài này có cấu trúc " +
          "mà thuật toán chính xác khai thác được không?</i> Nếu có, đừng viết heuristic.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     2. Bieu dien nghiem — cung mot nghiem, ba cach luu
     ================================================================ */
  demo({
    id: "bieu-dien-nghiem", nhom: "Nền tảng bài toán", mon: "B03",
    ten: "Biểu diễn nghiệm — ba cách lưu cùng một thứ",
    moTa: "Cùng một lịch giao hàng, ba cách mã hoá. Một nước đi trong mã hoá này " +
          "là <b>chuyện nhỏ</b>, trong mã hoá kia là <b>nghiệm không hợp lệ</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-03-bieu-dien-nghiem">B03 — Biểu diễn nghiệm</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 190;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      /* 9 don hang, 3 xe. Nghiem goc: phan cong + thu tu */
      var N = 9, XE = 3;
      var tt = { kieu: "truc", hat: 7, nuoc: "doi2" };

      function sinh() {
        var r = V.rng(tt.hat);
        /* gan moi don cho mot xe, roi xao thu tu trong xe */
        var xe = [];
        for (var i = 0; i < XE; i++) xe.push([]);
        for (var j = 0; j < N; j++) xe[Math.floor(r() * XE)].push(j);
        return xe;
      }
      var xe = sinh();

      /* --- ba cach ma hoa --- */
      function maHoaTrucTiep(xe) {           /* danh sach long nhau */
        return xe.map(function (q) { return "[" + q.join(" ") + "]"; }).join(" ");
      }
      function maHoaPhang(xe) {              /* chuoi phang + dau phan cach -1 */
        var out = [];
        xe.forEach(function (q, i) { if (i) out.push("|"); q.forEach(function (x) { out.push(x); }); });
        return out.join(" ");
      }
      function maHoaGan(xe) {                /* mang gan nhan: don -> xe */
        var a = new Array(N);
        xe.forEach(function (q, i) { q.forEach(function (x) { a[x] = i; }); });
        return a.join(" ");
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padT = 26;
        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Cùng MỘT nghiệm — 9 đơn hàng chia cho 3 xe:", 14, 18);

        /* ve 3 xe nhu 3 hang */
        var mauXe = ["#5b4bd6", "#0f766e", "#b45309"];
        xe.forEach(function (q, i) {
          var y = padT + i * 52;
          g.fillStyle = V.mau("tx2"); g.font = "600 11px system-ui";
          g.fillText("Xe " + (i + 1), 14, y + 20);
          /* kho */
          g.fillStyle = V.mau("tx3");
          g.beginPath(); g.arc(62, y + 15, 7, 0, 6.2832); g.fill();
          g.fillStyle = "#fff"; g.font = "700 9px system-ui"; g.textAlign = "center";
          g.fillText("K", 62, y + 18);
          var x = 92;
          q.forEach(function (don, k) {
            g.strokeStyle = mauXe[i]; g.lineWidth = 2;
            g.beginPath(); g.moveTo(x - 30 + 11, y + 15); g.lineTo(x - 11, y + 15); g.stroke();
            g.fillStyle = mauXe[i];
            g.beginPath(); g.arc(x, y + 15, 11, 0, 6.2832); g.fill();
            g.fillStyle = "#fff"; g.font = "700 10.5px system-ui"; g.textAlign = "center";
            g.fillText(String(don), x, y + 19);
            x += 42;
          });
          if (!q.length) {
            g.fillStyle = V.mau("tx3"); g.font = "italic 11px system-ui"; g.textAlign = "left";
            g.fillText("(rỗng)", 92, y + 19);
          }
        });

        /* ba ma hoa */
        var yB = padT + 3 * 52 + 6;
        var dong = [
          { t: "① Trực tiếp (danh sách lồng)", v: maHoaTrucTiep(xe), n: "n + số xe ô nhớ" },
          { t: "② Chuỗi phẳng (có dấu |)",     v: maHoaPhang(xe),    n: "n + số xe − 1 ô" },
          { t: "③ Gán nhãn (đơn → xe)",        v: maHoaGan(xe),      n: "n ô — nhưng MẤT thứ tự" }
        ];
        g.textAlign = "left";
        dong.forEach(function (d, i) {
          var y = yB + i * 34;
          g.fillStyle = V.mau("tx2"); g.font = "600 11px system-ui";
          g.fillText(d.t, 14, y + 12);
          g.fillStyle = V.mau("ac"); g.font = "600 12px ui-monospace, monospace";
          g.fillText(d.v, 210, y + 12);
          g.fillStyle = V.mau("tx3"); g.font = "10px system-ui";
          g.fillText(d.n, 210, y + 25);
        });
      }

      /* --- bang 2: mot nuoc di, ba hau qua --- */
      var NUOC = {
        doi2: {
          t: "Đổi chỗ hai đơn trong CÙNG một xe",
          hq: [["✓ hợp lệ", "đổi hai phần tử trong một danh sách", "#0f766e"],
               ["✓ hợp lệ", "đổi hai phần tử, không chạm dấu |", "#0f766e"],
               ["✗ VÔ NGHĨA", "mảng gán nhãn không lưu thứ tự — nước đi này biến mất", "#b91c1c"]]
        },
        chuyen: {
          t: "Chuyển một đơn sang xe khác",
          hq: [["✓ hợp lệ", "xoá ở list này, chèn vào list kia", "#0f766e"],
               ["⚠ cẩn thận", "phải dịch chuyển qua dấu | — dễ sai chỉ số", "#b45309"],
               ["✓ rất gọn", "đổi đúng MỘT ô: a[j] = xe_mới", "#0f766e"]]
        },
        daoDoan: {
          t: "Đảo ngược một đoạn (2-opt) trong một xe",
          hq: [["✓ hợp lệ", "reverse trên một đoạn của list", "#0f766e"],
               ["⚠ nguy hiểm", "nếu đoạn vắt qua dấu | thì nghiệm HỎNG", "#b45309"],
               ["✗ VÔ NGHĨA", "không có thứ tự để mà đảo", "#b91c1c"]]
        }
      };

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var nc = NUOC[tt.nuoc];
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Nước đi: " + nc.t, 14, 20);

        var ten = ["① Trực tiếp", "② Chuỗi phẳng", "③ Gán nhãn"];
        nc.hq.forEach(function (h, i) {
          var y = 42 + i * 44;
          g2.fillStyle = V.mau("surf2");
          g2.fillRect(14, y, W2 - 28, 36);
          g2.fillStyle = V.mau("tx2"); g2.font = "600 11.5px system-ui";
          g2.fillText(ten[i], 24, y + 22);
          g2.fillStyle = h[2]; g2.font = "700 11.5px system-ui";
          g2.fillText(h[0], 124, y + 22);
          g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
          g2.fillText(h[1], 214, y + 22);
        });
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Nước đi", giaTri: tt.nuoc,
                 muc: [{ v: "doi2", t: "Đổi chỗ hai đơn cùng xe" },
                       { v: "chuyen", t: "Chuyển đơn sang xe khác" },
                       { v: "daoDoan", t: "Đảo đoạn (2-opt)" }],
                 doi: function (v) { tt.nuoc = v; veHet(); } }),
        V.truot({ ten: "Hạt giống (đổi nghiệm)", min: 1, max: 30, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; xe = sinh(); veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Ba mã hoá trên lưu ĐÚNG CÙNG một nghiệm</b> — nhưng chúng không tương đương, " +
          "vì <b>biểu diễn quyết định tập nước đi bạn viết được</b>.<ul>" +
          "<li><b>Đổi \"Nước đi\" sang \"Đảo đoạn (2-opt)\"</b> và đọc cột kết quả. " +
          "Với <b>gán nhãn</b>, nước đi mạnh nhất của định tuyến <b>không tồn tại</b> — " +
          "mảng đó không lưu thứ tự, nên không có gì để đảo.</li>" +
          "<li>Ngược lại, <b>chuyển một đơn sang xe khác</b> trên gán nhãn chỉ là " +
          "<code>a[j] = xe_mới</code> — một phép gán, <code>O(1)</code>, không bao giờ sinh " +
          "nghiệm không hợp lệ. Trên chuỗi phẳng thì phải dịch chuyển qua dấu phân cách, " +
          "và đó là <b>nguồn lỗi chỉ số kinh điển</b>.</li>" +
          "<li>⚠️ <b>Cái bẫy của chuỗi phẳng:</b> nó gọn và nhanh, nhưng một đoạn đảo " +
          "<b>vắt qua dấu |</b> sẽ trộn hai xe vào nhau và tạo nghiệm vô nghĩa. " +
          "Mọi toán tử đều phải kiểm biên — nếu quên, bug sẽ im lặng.</li></ul>" +
          "<b>★ Năm tiêu chí chọn biểu diễn</b> (bài 3 §5): ① mọi nghiệm hợp lệ đều biểu diễn được · " +
          "② mọi biểu diễn đều là nghiệm hợp lệ (<i>ít mã hoá nào đạt được</i>) · " +
          "③ nước đi nhỏ → thay đổi nhỏ (<b>tính địa phương</b>) · ④ đánh giá delta rẻ · " +
          "⑤ bộ nhớ chấp nhận được.<br><br>" +
          "<b>⇒ Sai lầm phổ biến nhất của người mới: chọn biểu diễn trước, rồi mới nghĩ nước đi. " +
          "Làm ngược lại — hỏi <i>tôi cần những nước đi nào?</i> rồi chọn biểu diễn rẻ nhất cho chúng.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     3. Dia hinh toi uu — ba loai be mat, luu vuc hut, da khoi dong
     ================================================================ */
  demo({
    id: "dia-hinh-toi-uu", nhom: "Nền tảng bài toán", mon: "B12",
    ten: "Địa hình tối ưu và cực trị cục bộ",
    moTa: "Ba loại bề mặt: trơn · gồ ghề · sân golf. Thả 40 điểm xuất phát, " +
          "xem <b>bao nhiêu phần trăm leo tới đỉnh thật</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-12-cuc-tri-cuc-bo">B12 — Cực trị cục bộ</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 150;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { dia: "gogo", soDiem: 40, buocNhay: 1, hat: 3 };

      /* --- ba ham dia hinh, deu tren [0,1], tra ve gia tri CANG CAO CANG TOT --- */
      function f(x) {
        if (tt.dia === "tron") {
          return Math.exp(-Math.pow((x - 0.62) * 3.0, 2));
        }
        if (tt.dia === "gogo") {
          return Math.exp(-Math.pow((x - 0.62) * 2.2, 2)) * 0.85
               + 0.13 * Math.sin(x * 41) + 0.07 * Math.sin(x * 17 + 1.2);
        }
        /* san golf: phang tuyet doi tru mot ho hep */
        var d = Math.abs(x - 0.68);
        return d < 0.022 ? 1 - d * 6 : 0.12;
      }

      /* leo doi roi rac: buoc +-h, nhan buoc cai thien */
      function leo(x0, h) {
        var x = x0, duong = [x], i;
        for (i = 0; i < 400; i++) {
          var a = Math.max(0, Math.min(1, x - h)), b = Math.max(0, Math.min(1, x + h));
          var fx = f(x), fa = f(a), fb = f(b);
          if (fa <= fx && fb <= fx) break;           /* cuc tri cuc bo */
          x = (fa > fb) ? a : b;
          duong.push(x);
        }
        return { x: x, v: f(x), duong: duong, buoc: duong.length - 1 };
      }

      var ketQua = null;

      function chay() {
        var r = V.rng(tt.hat);
        var h = tt.buocNhay * 0.004;
        var ds = [], i;
        for (i = 0; i < tt.soDiem; i++) ds.push(leo(r(), h));
        var best = ds.reduce(function (a, b) { return b.v > a.v ? b : a; });
        /* dinh THAT: quet min */
        var fMax = 0, xMax = 0;
        for (i = 0; i <= 2000; i++) { var x = i / 2000, v = f(x); if (v > fMax) { fMax = v; xMax = x; } }
        var dat = ds.filter(function (d) { return d.v > fMax - 0.02; }).length;
        ketQua = { ds: ds, best: best, fMax: fMax, xMax: xMax, dat: dat,
                   buocTB: ds.reduce(function (s, d) { return s + d.buoc; }, 0) / ds.length };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 34, padR = 14, padT = 16, padB = 28;
        var w = W - padL - padR, h = H - padT - padB;
        var X = function (x) { return padL + x * w; };
        var Y = function (v) { return padT + h - v * h; };

        /* duong dia hinh */
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();

        g.strokeStyle = V.mau("ac"); g.lineWidth = 2;
        g.beginPath();
        for (var i = 0; i <= 600; i++) {
          var x = i / 600, y = Y(f(x));
          if (i === 0) g.moveTo(X(x), y); else g.lineTo(X(x), y);
        }
        g.stroke();

        /* to nhe duoi duong */
        g.lineTo(padL + w, padT + h); g.lineTo(padL, padT + h); g.closePath();
        g.fillStyle = V.mau("acbg"); g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;

        if (!ketQua) return;

        /* diem ket thuc cua moi lan leo */
        ketQua.ds.forEach(function (d) {
          var trung = d.v > ketQua.fMax - 0.02;
          g.fillStyle = trung ? "#0f766e" : "#b91c1c";
          g.globalAlpha = 0.75;
          g.beginPath(); g.arc(X(d.x), Y(d.v), 3.6, 0, 6.2832); g.fill();
          g.globalAlpha = 1;
        });

        /* dinh that */
        g.strokeStyle = "#0f766e"; g.lineWidth = 1.6; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(X(ketQua.xMax), padT); g.lineTo(X(ketQua.xMax), padT + h); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#0f766e"; g.font = "700 10.5px system-ui"; g.textAlign = "center";
        g.fillText("đỉnh thật", X(ketQua.xMax), padT - 3);

        [["tới được đỉnh", "#0f766e", 12], ["kẹt ở cực trị cục bộ", "#b91c1c", 26]]
          .forEach(function (q) {
            g.fillStyle = q[1];
            g.beginPath(); g.arc(padL + 6, padT + q[2] - 3.5, 3.4, 0, 6.2832); g.fill();
            g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "left";
            g.fillText(q[0], padL + 14, padT + q[2]);
          });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        if (!ketQua) return;
        var tyLe = ketQua.dat / tt.soDiem;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Kết quả " + tt.soDiem + " lần leo đồi từ điểm ngẫu nhiên:", 14, 20);

        /* thanh ty le thanh cong */
        var x0 = 14, y0 = 34, bw = W2 - 28, hh = 26;
        g2.fillStyle = V.mau("surf2"); g2.fillRect(x0, y0, bw, hh);
        g2.fillStyle = tyLe > 0.5 ? "#0f766e" : (tyLe > 0.1 ? "#b45309" : "#b91c1c");
        g2.fillRect(x0, y0, bw * tyLe, hh);
        g2.fillStyle = V.mau("tx"); g2.font = "700 12px system-ui";
        g2.fillText(ketQua.dat + "/" + tt.soDiem + " lần tới đỉnh thật  (" +
                    (tyLe * 100).toFixed(0) + "%)", x0 + 8, y0 + 18);

        var dong = [
          ["Số bước leo trung bình", ketQua.buocTB.toFixed(1)],
          ["Giá trị tốt nhất tìm được", ketQua.best.v.toFixed(4)],
          ["Giá trị tối ưu thật", ketQua.fMax.toFixed(4)],
          ["Khoảng cách còn lại", ((1 - ketQua.best.v / ketQua.fMax) * 100).toFixed(2) + " %"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = y0 + hh + 20 + i * 17;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11.5px ui-monospace, monospace";
          g2.fillText(d[1], 240, y);
          g2.font = "11.5px system-ui";
        });
      }

      function veHet() { chay(); ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Loại địa hình", giaTri: tt.dia,
                 muc: [{ v: "tron", t: "(a) Trơn — một đỉnh duy nhất" },
                       { v: "gogo", t: "(b) Gồ ghề — nhiều cực trị cục bộ" },
                       { v: "golf", t: "(c) Sân golf — phẳng, một hố" }],
                 doi: function (v) { tt.dia = v; veHet(); } }),
        V.truot({ ten: "Số lần đa khởi động", min: 5, max: 120, buoc: 5, giaTri: tt.soDiem,
                  doi: function (v) { tt.soDiem = v; veHet(); } }),
        V.truot({ ten: "Bước lân cận (×0,004)", min: 1, max: 20, buoc: 1, giaTri: tt.buocNhay,
                  doi: function (v) { tt.buocNhay = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Leo đồi thật, chạy trong trình duyệt.</b> Mỗi chấm là nơi <b>một</b> lần leo dừng lại. " +
          "Xanh = tới đỉnh thật; đỏ = kẹt ở cực trị cục bộ.<ul>" +
          "<li><b>(a) Trơn:</b> 100 % tới đỉnh, trung bình vài chục bước. " +
          "<b>Ở địa hình này metaheuristic là lãng phí</b> — leo đồi đã tối ưu.</li>" +
          "<li><b>(b) Gồ ghề:</b> tỷ lệ tụt xuống còn vài chục phần trăm. " +
          "Đây là <b>hầu hết bài toán định tuyến thật</b>, và là lý do tồn tại của cả Phần 4.</li>" +
          "<li>★ <b>(c) Sân golf — kéo sang đây và nhìn kỹ:</b> tỷ lệ về gần <b>0 %</b>. " +
          "Bề mặt phẳng hoàn toàn nên <b>không có dốc để leo</b>; mọi điểm đều là cực trị cục bộ. " +
          "<b>Local search VÔ DỤNG ở đây</b> — và không tinh chỉnh tham số nào cứu được. " +
          "Phải đổi cách tiếp cận hoàn toàn (bài toán mật mã, subset-sum số lớn thuộc loại này).</li></ul>" +
          "<b>★ Thí nghiệm quan trọng nhất — kéo \"Bước lân cận\":</b><ul>" +
          "<li>Bước <b>quá nhỏ</b> trên địa hình gồ ghề: kẹt ngay ở gợn sóng đầu tiên, " +
          "số bước ít, kết quả tệ.</li>" +
          "<li>Bước <b>lớn hơn</b>: nhảy qua các gợn nhỏ, tỷ lệ thành công <b>tăng rõ</b>. " +
          "Đây chính là trực giác đằng sau VNS (bài 15): <b>đổi kích thước lân cận là một cách thoát bẫy</b>.</li>" +
          "<li>Nhưng bước <b>quá lớn</b> thì bỏ sót cả đỉnh thật — có một điểm ngọt, và nó " +
          "<b>phụ thuộc địa hình</b>, không phải hằng số.</li></ul>" +
          "<b>⇒ Ba chỉ dấu \"tôi đang kẹt\" (bài 12 §3): ① nhiều lần chạy cho cùng một giá trị · " +
          "② số nước cải thiện về 0 rất sớm · ③ đa khởi động cho phương sai lớn. " +
          "Cả ba đều đọc được ngay trên bảng dưới.</b>"
      });
      veHet();
    }
  });

})();
