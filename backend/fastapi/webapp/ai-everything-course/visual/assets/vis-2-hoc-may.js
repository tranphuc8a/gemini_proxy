/* =====================================================================
   vis-2-hoc-may.js — demo cho M03, M04
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     1. BIAS – VARIANCE va QUA KHOP
     ================================================================== */
  demo({
    id: "bias-variance", nhom: "Học máy", mon: "M03",
    ten: "Quá khớp, bias–variance và chính quy hoá",
    moTa: "Kéo bậc đa thức lên 15 với 12 điểm dữ liệu. Rồi bật chính quy hoá và " +
          "xem đường cong bình tĩnh lại.",
    lienKet: '<a href="../web/index.html#/bai/m03-bai-04-bias-variance-va-tong-quat-hoa">M03 b.4</a>' +
             ' · <a href="../web/index.html#/bai/m03-bai-05-chinh-quy-hoa">M03 b.5</a>',
    dung: function (host) {
      var W = 540, H = 380;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(-0.15, 1.15, -1.9, 1.9);
      var tt = { bac: 3, n: 12, nhieu: 0.18, lam: 0, hat: 3, hienThat: true };
      var oSo = V.el("div", { class: "so-lieu" });

      function hamThat(x) { return Math.sin(2 * Math.PI * x); }

      function duLieu() {
        var R = V.rng(tt.hat), d = [];
        for (var i = 0; i < tt.n; i++) {
          var x = i / (tt.n - 1);
          d.push([x, hamThat(x) + R.chuan() * tt.nhieu]);
        }
        return d;
      }
      function duLieuTest() {
        var R = V.rng(tt.hat + 999), d = [];
        for (var i = 0; i < 60; i++) {
          var x = R();
          d.push([x, hamThat(x) + R.chuan() * tt.nhieu]);
        }
        return d;
      }

      /* Hoi quy da thuc co chinh quy hoa L2 (ridge), giai bang phuong trinh chuan.
         Giai he tuyen tinh nho bang khu Gauss — du chinh xac o bac <= 15 khi
         da chuan hoa x ve [0,1] va co lambda > 0. */
      function khop(d, bac, lam) {
        var m = bac + 1;
        var A = [], b = [];
        for (var i = 0; i < m; i++) { A.push(new Array(m).fill(0)); b.push(0); }
        d.forEach(function (p) {
          var phi = [];
          for (var k = 0; k < m; k++) phi.push(Math.pow(p[0], k));
          for (var r = 0; r < m; r++) {
            for (var c = 0; c < m; c++) A[r][c] += phi[r] * phi[c];
            b[r] += phi[r] * p[1];
          }
        });
        for (var j = 0; j < m; j++) A[j][j] += lam + 1e-10;
        /* khu Gauss co chon truc */
        for (var col = 0; col < m; col++) {
          var pv = col;
          for (var r2 = col + 1; r2 < m; r2++) if (Math.abs(A[r2][col]) > Math.abs(A[pv][col])) pv = r2;
          var tmp = A[col]; A[col] = A[pv]; A[pv] = tmp;
          var tb = b[col]; b[col] = b[pv]; b[pv] = tb;
          if (Math.abs(A[col][col]) < 1e-14) continue;
          for (var r3 = col + 1; r3 < m; r3++) {
            var f = A[r3][col] / A[col][col];
            for (var c3 = col; c3 < m; c3++) A[r3][c3] -= f * A[col][c3];
            b[r3] -= f * b[col];
          }
        }
        var w = new Array(m).fill(0);
        for (var r4 = m - 1; r4 >= 0; r4--) {
          var s = b[r4];
          for (var c4 = r4 + 1; c4 < m; c4++) s -= A[r4][c4] * w[c4];
          w[r4] = Math.abs(A[r4][r4]) < 1e-14 ? 0 : s / A[r4][r4];
        }
        return w;
      }
      function duDoan(w, x) {
        var s = 0;
        for (var k = 0; k < w.length; k++) s += w[k] * Math.pow(x, k);
        return s;
      }
      function mse(w, d) {
        return d.reduce(function (a, p) {
          var e = duDoan(w, p[0]) - p[1]; return a + e * e;
        }, 0) / d.length;
      }

      function ve() {
        var d = duLieu(), dt = duLieuTest();
        var w = khop(d, tt.bac, tt.lam);
        g.clearRect(0, 0, W, H);
        V.veLuoi(g, T, -0.15, 1.15, -1.9, 1.9, W, H, 0.5);

        if (tt.hienThat) {
          g.strokeStyle = V.mau("ok"); g.lineWidth = 2; g.setLineDash([5, 4]);
          g.beginPath();
          for (var x = 0; x <= 1.001; x += 0.005) {
            var px = T.x(x), py = T.y(hamThat(x));
            if (x === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.stroke(); g.setLineDash([]);
        }
        /* duong khop */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.6;
        g.beginPath();
        var dau = true;
        for (var x2 = -0.05; x2 <= 1.051; x2 += 0.004) {
          var y = duDoan(w, x2);
          if (!isFinite(y)) continue;
          y = Math.max(-3, Math.min(3, y));
          var px2 = T.x(x2), py2 = T.y(y);
          if (dau) { g.moveTo(px2, py2); dau = false; } else g.lineTo(px2, py2);
        }
        g.stroke();
        /* diem huan luyen */
        d.forEach(function (p) {
          g.fillStyle = V.mau("ac2"); g.strokeStyle = V.mau("surf"); g.lineWidth = 2;
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), 5, 0, 7); g.fill(); g.stroke();
        });

        var eTr = mse(w, d), eTe = mse(w, dt);
        var chuanW = Math.sqrt(w.reduce(function (a, v) { return a + v * v; }, 0));
        oSo.innerHTML =
          '<div class="d"><span>MSE huấn luyện</span><b>' + eTr.toFixed(4) + "</b></div>" +
          '<div class="d"><span>MSE kiểm tra</span><b style="color:' +
            (eTe > eTr * 4 ? "var(--loi)" : "var(--ac)") + '">' + eTe.toFixed(4) + "</b></div>" +
          '<div class="d"><span>Tỷ lệ test/train</span><b>' + (eTe / Math.max(eTr, 1e-9)).toFixed(1) + "×</b></div>" +
          '<div class="d"><span>‖w‖₂</span><b>' + chuanW.toFixed(1) + "</b></div>" +
          (eTe > eTr * 4 ? '<div style="color:var(--loi);font-weight:600;margin-top:6px">⚠ QUÁ KHỚP rõ rệt</div>' : "");
      }

      var dk = [
        V.el("h4", { text: "MÔ HÌNH" }),
        V.truot({ ten: "Bậc đa thức", min: 0, max: 15, buoc: 1, giaTri: tt.bac,
          doi: function (v) { tt.bac = v; ve(); } }),
        V.truot({ ten: "λ (chính quy hoá L2)", min: 0, max: 0.02, buoc: 0.0002, giaTri: tt.lam,
          doi: function (v) { tt.lam = v; ve(); } }),
        V.el("h4", { text: "DỮ LIỆU", style: "margin-top:16px" }),
        V.truot({ ten: "Số điểm huấn luyện", min: 4, max: 60, buoc: 1, giaTri: tt.n,
          doi: function (v) { tt.n = v; ve(); } }),
        V.truot({ ten: "Nhiễu", min: 0, max: 0.6, buoc: 0.01, giaTri: tt.nhieu,
          doi: function (v) { tt.nhieu = v; ve(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; ve(); } }),
        V.danhDau({ ten: "Hiện hàm thật (xanh nét đứt)", giaTri: tt.hienThat,
          doi: function (v) { tt.hienThat = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Bốn thí nghiệm theo thứ tự:</b><ul>" +
          "<li><b>Thiếu khớp (bias cao).</b> Bậc 0 hoặc 1: đường thẳng không thể bám hình sin. " +
          "MSE train và test đều cao, và <i>gần bằng nhau</i>.</li>" +
          "<li><b>Vừa phải.</b> Bậc 3–5: cả hai thấp. Đây là vùng bạn muốn ở.</li>" +
          "<li><b>Quá khớp (variance cao).</b> Bậc 12–15 với 12 điểm: đường đi qua gần như " +
          "mọi điểm (MSE train ≈ 0) nhưng lượn điên cuồng giữa các điểm. Tỷ lệ test/train nổ. " +
          "Chú ý <code>‖w‖₂</code> tăng lên hàng nghìn — <b>đó chính là thứ L2 phạt.</b></li>" +
          "<li><b>Chính quy hoá cứu.</b> Giữ bậc 15, kéo λ lên. Đường cong bình tĩnh lại, " +
          "‖w‖ giảm, MSE test giảm — <i>dù mô hình vẫn có 16 tham số</i>.</li></ul>" +
          "<b>Điều đáng suy nghĩ:</b> đổi <i>hạt giống</i> ở bậc 15. Đường khớp đổi hoàn toàn " +
          "dù dữ liệu chỉ khác ở nhiễu. <b>Đó là variance</b> — độ nhạy của mô hình với mẫu " +
          "dữ liệu cụ thể. Ở bậc 2, đổi hạt giống gần như không đổi gì: variance thấp, bias cao.<br><br>" +
          "<b>Cách chữa khác không cần λ:</b> tăng số điểm huấn luyện lên 60 ở bậc 15. " +
          "Quá khớp biến mất. <i>Nhiều dữ liệu là dạng chính quy hoá mạnh nhất.</i>"
      });
      ve();
    }
  });

  /* ==================================================================
     2. k-NN va RANH GIOI QUYET DINH
     ================================================================== */
  demo({
    id: "knn-ranh-gioi", nhom: "Học máy", mon: "M03",
    ten: "k-NN: ranh giới quyết định theo k",
    moTa: "k = 1 cho ranh giới răng cưa bám mọi điểm nhiễu; k lớn cho ranh giới mượt " +
          "nhưng bỏ qua cấu trúc nhỏ. Bấm để thêm điểm.",
    lienKet: '<a href="../web/index.html#/bai/m03-bai-08-knn-va-hoc-dua-tren-mau">M03 b.8</a>',
    dung: function (host) {
      var W = 440, H = 440;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(0, 10, 0, 10);
      var tt = { k: 1, lop: 0, doDo: "euclid" };
      var diem = [];

      function sinh() {
        diem = [];
        var R = V.rng(5);
        for (var i = 0; i < 26; i++) {
          diem.push([R.khoang(1, 4.6) + R.chuan() * 0.5, R.khoang(1, 8.5), 0]);
          diem.push([R.khoang(5.4, 9) + R.chuan() * 0.5, R.khoang(1.5, 9), 1]);
        }
        /* vai diem nhieu de thay k=1 bam theo chung */
        diem.push([7.4, 3.0, 0]); diem.push([2.6, 6.4, 1]);
      }
      sinh();

      function kc(a, b) {
        if (tt.doDo === "manhattan") return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
      function phanLop(x, y) {
        var ds = diem.map(function (p) { return [kc([x, y], p), p[2]]; })
                     .sort(function (a, b) { return a[0] - b[0]; });
        var k = Math.min(tt.k, ds.length), s = 0;
        for (var i = 0; i < k; i++) s += ds[i][1];
        return s / k;
      }

      function ve() {
        var B = 5;                       /* ve theo o vuong 5px cho nhanh */
        g.clearRect(0, 0, W, H);
        for (var px = 0; px < W; px += B) {
          for (var py = 0; py < H; py += B) {
            var p = phanLop(T.nx(px + B / 2), T.ny(py + B / 2));
            g.fillStyle = p > 0.5 ? "rgba(180,83,9,.20)" :
                          p < 0.5 ? "rgba(157,23,77,.20)" : "rgba(139,132,122,.18)";
            g.fillRect(px, py, B, B);
          }
        }
        diem.forEach(function (p) {
          g.fillStyle = p[2] ? "#b45309" : "#9d174d";
          g.strokeStyle = "#fff"; g.lineWidth = 1.6;
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), 5, 0, 7); g.fill(); g.stroke();
        });
      }

      cv.addEventListener("click", function (e) {
        var r = cv.getBoundingClientRect();
        diem.push([T.nx(e.clientX - r.left), T.ny(e.clientY - r.top), tt.lop]);
        ve();
      });

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "k (số láng giềng)", min: 1, max: 31, buoc: 2, giaTri: tt.k,
          doi: function (v) { tt.k = v; ve(); } }),
        V.chon({ ten: "Độ đo khoảng cách", giaTri: tt.doDo,
          muc: [{ v: "euclid", t: "Euclid (L2)" }, { v: "manhattan", t: "Manhattan (L1)" }],
          doi: function (v) { tt.doDo = v; ve(); } }),
        V.chon({ ten: "Lớp khi bấm thêm điểm", giaTri: String(tt.lop),
          muc: [{ v: "0", t: "Lớp A (hồng)" }, { v: "1", t: "Lớp B (cam)" }],
          doi: function (v) { tt.lop = +v; } }),
        V.nut("Sinh lại dữ liệu", function () { sinh(); ve(); }, "chinh"),
        V.nut("Xoá hết", function () { diem = []; ve(); }),
        V.el("p", { class: "d-lk", text: "Bấm vào hình để thêm điểm của lớp đã chọn." })
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>k điều khiển trực tiếp đánh đổi bias–variance:</b><ul>" +
          "<li><b>k = 1</b>: variance cao nhất. Ranh giới bám sát <i>mọi</i> điểm, kể cả hai " +
          "điểm nhiễu cố ý đặt sai phía. Lỗi huấn luyện đúng bằng 0 — và đó chính là dấu hiệu " +
          "đáng lo, không phải dấu hiệu tốt.</li>" +
          "<li><b>k lớn</b>: bias cao. Ranh giới mượt, bỏ qua điểm nhiễu — nhưng cũng bỏ qua " +
          "cấu trúc thật nếu có. Với k = số điểm, mọi nơi đều dự đoán lớp đa số.</li></ul>" +
          "<b>Thử điều này:</b> bấm thêm một điểm lớp A vào giữa vùng lớp B. Ở k = 1 nó tạo " +
          "một ốc đảo. Tăng k lên 7 — ốc đảo biến mất. Đó là chính quy hoá, dưới một hình " +
          "thức khác.<br><br>" +
          "<b>Về độ đo:</b> đổi sang Manhattan, ranh giới trở nên vuông vắn theo trục. " +
          "Độ đo khoảng cách là một <i>giả định về dữ liệu</i>, không phải chi tiết kỹ thuật — " +
          "và ở số chiều cao, mọi độ đo đều gặp lời nguyền số chiều (M04 b.6)."
      });
      ve();
    }
  });

  /* ==================================================================
     3. k-MEANS tung buoc
     ================================================================== */
  demo({
    id: "kmeans", nhom: "Học máy", mon: "M04",
    ten: "k-means từng bước",
    moTa: "Bấm <i>Một bước</i> để thấy hai pha luân phiên: gán điểm → dời tâm. " +
          "Thử dữ liệu hình vành khăn để thấy k-means hỏng.",
    lienKet: '<a href="../web/index.html#/bai/m04-bai-07-phan-cum-kmeans-va-phan-cap">M04 b.7</a>',
    dung: function (host) {
      var W = 460, H = 440;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(0, 10, 0, 10);
      var MAUS = ["#9d174d", "#b45309", "#0f766e", "#4338ca", "#a21caf", "#0369a1"];
      var tt = { k: 3, hinh: "cum", hat: 4 };
      var X = [], tam = [], gan = [], buoc = 0, xong = false;
      var oSo = V.el("div", { class: "so-lieu" });

      function sinhDL() {
        var R = V.rng(tt.hat); X = [];
        if (tt.hinh === "cum") {
          var tt3 = [[2.5, 2.5], [7.2, 3.0], [5.0, 7.6]];
          tt3.forEach(function (c) {
            for (var i = 0; i < 55; i++) X.push([c[0] + R.chuan() * 0.85, c[1] + R.chuan() * 0.85]);
          });
        } else if (tt.hinh === "vanh") {
          for (var i = 0; i < 90; i++) {
            var a = R() * 6.283; X.push([5 + Math.cos(a) * 3.6 + R.chuan() * 0.25,
                                         5 + Math.sin(a) * 3.6 + R.chuan() * 0.25]);
          }
          for (var j = 0; j < 70; j++) X.push([5 + R.chuan() * 0.8, 5 + R.chuan() * 0.8]);
        } else {                                    /* kich thuoc lech */
          for (var m = 0; m < 140; m++) X.push([2.5 + R.chuan() * 1.3, 5 + R.chuan() * 1.3]);
          for (var n = 0; n < 25; n++) X.push([7.6 + R.chuan() * 0.35, 5 + R.chuan() * 0.35]);
        }
      }
      function datLai() {
        var R = V.rng(tt.hat * 17 + 3);
        tam = []; gan = X.map(function () { return -1; }); buoc = 0; xong = false;
        for (var i = 0; i < tt.k; i++) tam.push([R.khoang(1, 9), R.khoang(1, 9)]);
      }
      function motBuoc() {
        if (xong) return;
        /* pha 1: gan */
        var doi = false;
        X.forEach(function (p, i) {
          var best = 0, bd = Infinity;
          tam.forEach(function (c, j) {
            var d = (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]);
            if (d < bd) { bd = d; best = j; }
          });
          if (gan[i] !== best) doi = true;
          gan[i] = best;
        });
        /* pha 2: doi tam */
        for (var j = 0; j < tt.k; j++) {
          var sx = 0, sy = 0, c = 0;
          X.forEach(function (p, i) { if (gan[i] === j) { sx += p[0]; sy += p[1]; c++; } });
          if (c) tam[j] = [sx / c, sy / c];
        }
        buoc++;
        if (!doi && buoc > 1) xong = true;
        ve();
      }
      function wcss() {
        var s = 0;
        X.forEach(function (p, i) {
          if (gan[i] < 0) return;
          var c = tam[gan[i]];
          s += (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]);
        });
        return s;
      }
      function ve() {
        g.clearRect(0, 0, W, H);
        V.veLuoi(g, T, 0, 10, 0, 10, W, H, 2);
        X.forEach(function (p, i) {
          g.fillStyle = gan[i] < 0 ? "rgba(139,132,122,.55)" : MAUS[gan[i] % MAUS.length];
          g.globalAlpha = 0.72;
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), 3.4, 0, 7); g.fill();
          g.globalAlpha = 1;
        });
        tam.forEach(function (c, j) {
          g.fillStyle = MAUS[j % MAUS.length]; g.strokeStyle = "#fff"; g.lineWidth = 2.5;
          g.beginPath(); g.arc(T.x(c[0]), T.y(c[1]), 9, 0, 7); g.fill(); g.stroke();
          g.fillStyle = "#fff"; g.font = "600 11px system-ui"; g.textAlign = "center";
          g.fillText(String(j + 1), T.x(c[0]), T.y(c[1]) + 4);
          g.textAlign = "left";
        });
        oSo.innerHTML =
          '<div class="d"><span>Bước</span><b>' + buoc + "</b></div>" +
          '<div class="d"><span>WCSS (tổng bình phương trong cụm)</span><b>' + wcss().toFixed(1) + "</b></div>" +
          '<div class="d"><span>Trạng thái</span><b>' + (xong ? "đã hội tụ" : "đang chạy") + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "k (số cụm)", min: 1, max: 6, buoc: 1, giaTri: tt.k,
          doi: function (v) { tt.k = v; datLai(); ve(); } }),
        V.chon({ ten: "Hình dạng dữ liệu", giaTri: tt.hinh,
          muc: [{ v: "cum", t: "Ba cụm tròn (k-means hợp)" },
                { v: "vanh", t: "Vành khăn (k-means HỎNG)" },
                { v: "lech", t: "Kích thước rất lệch" }],
          doi: function (v) { tt.hinh = v; sinhDL(); datLai(); ve(); } }),
        V.truot({ ten: "Hạt giống khởi tạo", min: 1, max: 30, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; sinhDL(); datLai(); ve(); } }),
        V.nut("Một bước", motBuoc, "chinh"),
        V.nut("Chạy hết", function () { for (var i = 0; i < 40 && !xong; i++) motBuoc(); }),
        V.nut("Khởi tạo lại", function () { datLai(); ve(); }),
        oSo
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>k-means là hai pha luân phiên</b> (một trường hợp của thuật toán EM):<ul>" +
          "<li><b>Gán</b>: mỗi điểm về tâm gần nhất — cố định tâm, tối ưu phân công.</li>" +
          "<li><b>Dời tâm</b>: tâm = trung bình cụm — cố định phân công, tối ưu tâm.</li></ul>" +
          "Mỗi pha đều <i>không làm tăng</i> WCSS, nên thuật toán luôn hội tụ — " +
          "<b>nhưng chỉ tới cực tiểu địa phương</b>.<br><br>" +
          "<b>Ba thí nghiệm:</b><ul>" +
          "<li><b>Phụ thuộc khởi tạo.</b> Với <i>Ba cụm tròn</i>, đổi hạt giống vài lần và so " +
          "WCSS cuối. Bạn sẽ thấy các giá trị khác nhau — đó là lý do k-means thực tế luôn " +
          "chạy nhiều lần và giữ kết quả tốt nhất (k-means++).</li>" +
          "<li><b>Giả định hình cầu.</b> Chọn <i>Vành khăn</i>. k-means <b>không thể</b> tìm ra " +
          "vòng tròn, vì nó chỉ tạo được biên giới thẳng (ô Voronoi). Cần DBSCAN hoặc phân cụm " +
          "phổ (M04 b.8).</li>" +
          "<li><b>Giả định kích thước tương đương.</b> Chọn <i>Kích thước rất lệch</i>: " +
          "k-means có xu hướng cắt cụm lớn làm đôi thay vì nhận ra cụm nhỏ, vì làm thế giảm " +
          "WCSS nhiều hơn.</li></ul>" +
          "<b>Bài học chung:</b> WCSS là thứ k-means tối ưu — nó <i>không</i> phải thứ bạn muốn. " +
          "Đây lại là khoảng cách giữa hàm mục tiêu và mục tiêu thật."
      });
      sinhDL(); datLai(); ve();
    }
  });

  /* ==================================================================
     4. NGUONG QUYET DINH, ROC va DU LIEU LECH
     ================================================================== */
  demo({
    id: "nguong-roc", nhom: "Học máy", mon: "M03",
    ten: "Ngưỡng quyết định, ROC và bẫy accuracy",
    moTa: "Đặt tỷ lệ lớp về 95:5 rồi xem accuracy vẫn đẹp trong khi mô hình vô dụng.",
    lienKet: '<a href="../web/index.html#/bai/m03-bai-12-danh-gia-mo-hinh-va-chi-so">M03 b.12</a>',
    dung: function (host) {
      var W = 540, H = 250, W2 = 250, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = { nguong: 0.5, tach: 1.6, tyLe: 0.5, n: 4000 };
      var oSo = V.el("div", { class: "so-lieu" });

      function diem() {
        var R = V.rng(9), a = [], b = [];
        var nPos = Math.round(tt.n * tt.tyLe);
        for (var i = 0; i < tt.n - nPos; i++) a.push(sig(R.chuan() * 1.0 - tt.tach / 2));
        for (var j = 0; j < nPos; j++) b.push(sig(R.chuan() * 1.0 + tt.tach / 2));
        return [a, b];
      }
      function sig(z) { return 1 / (1 + Math.exp(-z * 2.2)); }

      function chiSo(am, duong, ng) {
        var TP = 0, FN = 0, FP = 0, TN = 0;
        duong.forEach(function (s) { if (s >= ng) TP++; else FN++; });
        am.forEach(function (s) { if (s >= ng) FP++; else TN++; });
        return { TP: TP, FN: FN, FP: FP, TN: TN };
      }

      function ve() {
        var d = diem(), am = d[0], duong = d[1];
        /* --- histogram --- */
        g.clearRect(0, 0, W, H);
        var B = 40, ha = new Array(B).fill(0), hb = new Array(B).fill(0);
        am.forEach(function (s) { ha[Math.min(B - 1, Math.floor(s * B))]++; });
        duong.forEach(function (s) { hb[Math.min(B - 1, Math.floor(s * B))]++; });
        var mx = Math.max(Math.max.apply(null, ha), Math.max.apply(null, hb), 1);
        var pad = 34, bw = (W - pad * 2) / B, base = H - 30;
        for (var i = 0; i < B; i++) {
          var x = pad + i * bw;
          g.fillStyle = "rgba(157,23,77,.65)";
          g.fillRect(x, base - ha[i] / mx * (H - 60), bw - 1, ha[i] / mx * (H - 60));
          g.fillStyle = "rgba(180,83,9,.65)";
          g.fillRect(x, base - hb[i] / mx * (H - 60), bw - 1, hb[i] / mx * (H - 60));
        }
        var xn = pad + tt.nguong * (W - pad * 2);
        g.strokeStyle = V.mau("tx"); g.lineWidth = 2; g.setLineDash([5, 3]);
        g.beginPath(); g.moveTo(xn, 8); g.lineTo(xn, base); g.stroke(); g.setLineDash([]);
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("ngưỡng " + tt.nguong.toFixed(2), Math.min(xn + 6, W - 110), 20);
        g.fillText("0", pad - 4, base + 16); g.fillText("1", W - pad - 4, base + 16);
        g.fillText("điểm mô hình →", W / 2 - 40, base + 16);

        /* --- ROC --- */
        g2.clearRect(0, 0, W2, H2);
        var p2 = 30, w2 = W2 - p2 * 2, h2 = H2 - p2 * 2;
        g2.strokeStyle = V.mau("bd"); g2.lineWidth = 1;
        g2.strokeRect(p2, p2 - 10, w2, h2);
        g2.setLineDash([4, 4]); g2.beginPath();
        g2.moveTo(p2, p2 - 10 + h2); g2.lineTo(p2 + w2, p2 - 10); g2.stroke(); g2.setLineDash([]);
        var pts = [], auc = 0, prev = null;
        for (var t = 0; t <= 1.0001; t += 0.01) {
          var c = chiSo(am, duong, t);
          var tpr = c.TP / Math.max(c.TP + c.FN, 1), fpr = c.FP / Math.max(c.FP + c.TN, 1);
          pts.push([fpr, tpr]);
          if (prev) auc += (prev[0] - fpr) * (tpr + prev[1]) / 2;
          prev = [fpr, tpr];
        }
        g2.strokeStyle = V.mau("ac"); g2.lineWidth = 2.4; g2.beginPath();
        pts.forEach(function (q, i) {
          var X = p2 + q[0] * w2, Y = p2 - 10 + h2 - q[1] * h2;
          if (i === 0) g2.moveTo(X, Y); else g2.lineTo(X, Y);
        });
        g2.stroke();
        var cc = chiSo(am, duong, tt.nguong);
        var tprN = cc.TP / Math.max(cc.TP + cc.FN, 1), fprN = cc.FP / Math.max(cc.FP + cc.TN, 1);
        g2.fillStyle = V.mau("tx"); g2.beginPath();
        g2.arc(p2 + fprN * w2, p2 - 10 + h2 - tprN * h2, 5, 0, 7); g2.fill();
        g2.font = "11px system-ui"; g2.fillStyle = V.mau("tx3");
        g2.fillText("FPR →", p2 + w2 / 2 - 18, H2 - 6);
        g2.save(); g2.translate(11, H2 / 2 + 16); g2.rotate(-Math.PI / 2);
        g2.fillText("TPR →", 0, 0); g2.restore();

        /* --- so lieu --- */
        var acc = (cc.TP + cc.TN) / tt.n;
        var prec = cc.TP / Math.max(cc.TP + cc.FP, 1);
        var rec = cc.TP / Math.max(cc.TP + cc.FN, 1);
        var f1 = 2 * prec * rec / Math.max(prec + rec, 1e-9);
        var accTamThuong = Math.max(tt.tyLe, 1 - tt.tyLe);
        oSo.innerHTML =
          '<div class="d"><span>Accuracy</span><b>' + (acc * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Đoán bừa lớp đa số</span><b style="color:var(--ba)">' +
            (accTamThuong * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Precision</span><b>' + (prec * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Recall</span><b>' + (rec * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>F1</span><b>' + f1.toFixed(3) + "</b></div>" +
          '<div class="d"><span>AUC-ROC</span><b>' + auc.toFixed(3) + "</b></div>" +
          '<div class="d"><span>TP / FP / FN / TN</span><b>' +
            cc.TP + " / " + cc.FP + " / " + cc.FN + " / " + cc.TN + "</b></div>" +
          (acc <= accTamThuong + 0.005 ?
            '<div style="color:var(--loi);font-weight:600;margin-top:6px">⚠ Không hơn đoán bừa!</div>' : "");
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "Ngưỡng quyết định", min: 0.01, max: 0.99, buoc: 0.01, giaTri: tt.nguong,
          doi: function (v) { tt.nguong = v; ve(); } }),
        V.truot({ ten: "Độ tách của mô hình", min: 0, max: 5, buoc: 0.1, giaTri: tt.tach,
          doi: function (v) { tt.tach = v; ve(); } }),
        V.truot({ ten: "Tỷ lệ lớp dương", min: 0.01, max: 0.5, buoc: 0.01, giaTri: tt.tyLe,
          doi: function (v) { tt.tyLe = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, V.el("div", { class: "chu-thich" }, [
              V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#9d174d" }), "lớp âm"]),
              V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#b45309" }), "lớp dương"])
            ]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Thí nghiệm bắt buộc — bẫy accuracy:</b> đặt <i>tỷ lệ lớp dương</i> = 0,05 và " +
          "<i>độ tách</i> = 0,3. Accuracy hiện khoảng 95 % — nghe rất tốt. Nhưng dòng " +
          "<i>đoán bừa lớp đa số</i> cũng là 95 %. Mô hình <b>không mang lại giá trị nào</b>. " +
          "Nhìn recall: gần như bằng 0 — nó bỏ sót gần hết lớp dương.<br><br>" +
          "<b>Vì sao AUC-ROC cũng có thể đánh lừa ở dữ liệu lệch:</b> FPR có mẫu số rất lớn " +
          "(lớp âm đông), nên nhiều dương tính giả vẫn cho FPR nhỏ, và ROC trông vẫn đẹp. " +
          "Với dữ liệu lệch, <b>AUC-PR</b> (precision–recall) phản ánh đúng hơn.<br><br>" +
          "<b>Ngưỡng là quyết định nghiệp vụ, không phải kỹ thuật:</b> kéo ngưỡng và xem " +
          "precision–recall đổi chỗ cho nhau. Chọn điểm nào phụ thuộc <i>chi phí của FP so với FN</i> — " +
          "sàng lọc ung thư và lọc thư rác nằm ở hai đầu đối lập của đánh đổi này."
      });
      ve();
    }
  });
})();
