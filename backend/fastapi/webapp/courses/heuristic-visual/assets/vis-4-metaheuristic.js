/* =====================================================================
   Nhom 4 — Metaheuristic
   simulated-annealing (b.13) · tabu-search (b.14) · beam-search (b.16)
   · lns-alns (b.17)
   ===================================================================== */
(function () {
  var V = window.VIS;

  function sinhDiem(n, hat) {
    var r = V.rng(hat), ds = [], i;
    for (i = 0; i < n; i++) ds.push({ x: r.khoang(0.05, 0.95), y: r.khoang(0.05, 0.95) });
    return ds;
  }
  function dE(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function daiChuTrinh(q, ds) {
    var s = 0, n = q.length, i;
    for (i = 0; i < n; i++) s += dE(ds[q[i]], ds[q[(i + 1) % n]]);
    return s;
  }
  function delta2opt(q, ds, i, j) {
    var n = q.length;
    var a = q[(i - 1 + n) % n], b = q[i], c = q[j], d = q[(j + 1) % n];
    return dE(ds[a], ds[c]) + dE(ds[b], ds[d]) - dE(ds[a], ds[b]) - dE(ds[c], ds[d]);
  }
  function ap2opt(q, i, j) {
    var seg = q.slice(i, j + 1).reverse();
    Array.prototype.splice.apply(q, [i, j - i + 1].concat(seg));
  }
  function veTour(g, ds, q, ox, oy, S, mau, dam) {
    g.strokeStyle = mau; g.lineWidth = dam || 1.7; g.globalAlpha = 0.9;
    g.beginPath();
    q.forEach(function (i, k) {
      var p = ds[i], X = ox + p.x * S, Y = oy + p.y * S;
      if (!k) g.moveTo(X, Y); else g.lineTo(X, Y);
    });
    g.closePath(); g.stroke(); g.globalAlpha = 1;
    q.forEach(function (i) {
      var p = ds[i];
      g.fillStyle = mau;
      g.beginPath(); g.arc(ox + p.x * S, oy + p.y * S, 3, 0, 6.2832); g.fill();
    });
  }

  /* ================================================================
     11. Simulated annealing
     ================================================================ */
  demo({
    id: "simulated-annealing", nhom: "Metaheuristic", mon: "B13",
    ten: "Simulated annealing — nhiệt độ làm gì?",
    moTa: "Tiêu chuẩn Metropolis chạy thật trên TSP. " +
          "Kéo T₀ tới cực trị để thấy <b>hai chế độ hỏng đối xứng</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-13-simulated-annealing">B13 — Simulated annealing</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 30, T0: 0.6, T1: 0.001, soBuoc: 20000, hat: 5 };
      var ds, q, best, bestD, curD, b, lichSu, nhan, tuChoi, xong;

      function datLai() {
        ds = sinhDiem(tt.n, tt.hat);
        q = ds.map(function (_, i) { return i; });
        var r = V.rng(tt.hat * 3 + 2), i, j, t;
        for (i = q.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = q[i]; q[i] = q[j]; q[j] = t; }
        curD = daiChuTrinh(q, ds);
        best = q.slice(); bestD = curD;
        b = 0; lichSu = []; nhan = 0; tuChoi = 0; xong = false;
      }
      var rr = V.rng(999);

      function nhietDo(k) {
        var tiLe = k / tt.soBuoc;
        return tt.T0 * Math.pow(tt.T1 / tt.T0, tiLe);     /* ha nhiet theo cap so nhan */
      }

      function motBuoc() {
        if (b >= tt.soBuoc) { xong = true; return false; }
        var T = nhietDo(b), n = q.length;
        var i = 1 + Math.floor(rr() * (n - 2));
        var j = i + 1 + Math.floor(rr() * (n - i - 1));
        if (j >= n) j = n - 1;
        var d = delta2opt(q, ds, i, j);
        /* bai toan CUC TIEU: nhan neu d <= 0, hoac voi xac suat exp(-d/T) */
        if (d <= 0 || rr() < Math.exp(-d / Math.max(1e-12, T))) {
          ap2opt(q, i, j); curD += d; nhan++;
          if (curD < bestD - 1e-12) { bestD = curD; best = q.slice(); }
        } else { tuChoi++; }
        if (b % Math.max(1, Math.floor(tt.soBuoc / 260)) === 0) {
          lichSu.push({ T: T, cur: curD, best: bestD });
        }
        b++;
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W / 2 - 24, H - 40);
        var oy = 28;
        veTour(g, ds, q, 14, oy, S, V.mau("tx3"), 1.3);
        g.fillStyle = V.mau("tx2"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("Hiện tại — " + curD.toFixed(3), 14, oy - 8);
        veTour(g, ds, best, W / 2 + 10, oy, S, V.mau("ac"), 1.9);
        g.fillStyle = V.mau("ac"); g.font = "600 11.5px system-ui";
        g.fillText("Tốt nhất — " + bestD.toFixed(3), W / 2 + 10, oy - 8);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 46, padR = 46, padT = 30, padB = 46;
        var w = W2 - padL - padR, h = H2 - padT - padB;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Độ dài tuyến (tím) và nhiệt độ T (cam, thang log) theo bước", padL, 18);

        if (lichSu.length > 1) {
          var lo = Math.min.apply(null, lichSu.map(function (p) { return p.best; }));
          var hi = Math.max.apply(null, lichSu.map(function (p) { return p.cur; }));
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          var lT = Math.log10(Math.max(1e-9, tt.T0)), lT1 = Math.log10(Math.max(1e-9, tt.T1));
          var YT = function (T) {
            var t = (Math.log10(Math.max(1e-9, T)) - lT1) / Math.max(1e-9, lT - lT1);
            return padT + h - t * h;
          };

          /* nhiet do */
          g2.strokeStyle = "#b45309"; g2.lineWidth = 1.6; g2.setLineDash([4, 3]);
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = YT(p.T); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke(); g2.setLineDash([]);

          /* hien tai */
          g2.strokeStyle = V.mau("tx3"); g2.lineWidth = 1.1;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.cur); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
          /* tot nhat */
          g2.strokeStyle = V.mau("ac"); g2.lineWidth = 2;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.best); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();

          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(2), padL - 5, padT + 8);
          g2.fillText(lo.toFixed(2), padL - 5, padT + h);
        }

        /* so lieu */
        var tyLe = (nhan + tuChoi) > 0 ? nhan / (nhan + tuChoi) : 0;
        g2.textAlign = "left"; g2.font = "11.5px system-ui";
        var y = H2 - 28;
        g2.fillStyle = V.mau("tx2");
        g2.fillText("Bước " + b.toLocaleString("vi") + "/" + tt.soBuoc.toLocaleString("vi") +
                    "   ·   T hiện tại " + nhietDo(Math.min(b, tt.soBuoc)).toExponential(1) +
                    "   ·   tỷ lệ chấp nhận ", padL, y);
        g2.fillStyle = tyLe > 0.9 ? V.mau("loi") : (tyLe < 0.01 ? V.mau("loi") : "#0f766e");
        g2.font = "700 12px ui-monospace, monospace";
        g2.fillText((tyLe * 100).toFixed(1) + " %", padL + 370, y);

        g2.font = "11px system-ui"; g2.fillStyle = V.mau("tx3");
        var ghi = tyLe > 0.9 ? "T quá CAO — đang đi ngẫu nhiên, không hội tụ"
                : (tyLe < 0.01 ? "T quá THẤP — đã thành leo đồi thuần, kẹt cục bộ"
                               : "vùng lành mạnh (chấp nhận 1–90 %)");
        g2.fillText(ghi, padL, y + 16);
      }

      function veHet() { ve(); ve2(); }

      var P = V.phat({
        toiDa: tt.soBuoc, tocDo: 500,
        datLai: datLai, buoc: motBuoc, ve: veHet,
        nhan: function () {
          var t = (nhan + tuChoi) > 0 ? nhan / (nhan + tuChoi) : 0;
          return "T = " + nhietDo(Math.min(b, tt.soBuoc)).toExponential(1) +
                 " · nhận " + (t * 100).toFixed(1) + " % · tốt nhất " + bestD.toFixed(3);
        }
      });
      function batDau() { P.datToiDa(tt.soBuoc); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "T₀ — nhiệt độ đầu", min: 0.002, max: 3, buoc: 0.002, giaTri: tt.T0,
                  doi: function (v) { tt.T0 = v; batDau(); } }),
        V.truot({ ten: "T_end — nhiệt độ cuối", min: 0.0005, max: 0.5, buoc: 0.0005, giaTri: tt.T1,
                  doi: function (v) { tt.T1 = v; batDau(); } }),
        V.truot({ ten: "Số bước", min: 2000, max: 60000, buoc: 2000, giaTri: tt.soBuoc,
                  doi: function (v) { tt.soBuoc = v; batDau(); } }),
        V.truot({ ten: "Số điểm", min: 10, max: 60, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; batDau(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; batDau(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Tiêu chuẩn Metropolis</b> (bài 13 §3.1): nước đi làm tốt lên thì " +
          "<b>luôn nhận</b>; nước đi làm xấu đi thì nhận với xác suất " +
          "<code>exp(−Δ/T)</code>.<ul>" +
          "<li>Đường <b>xám</b> là nghiệm hiện tại — nó <b>đi lên đi xuống</b>, đó chính là " +
          "SA đang chấp nhận nước xấu để thoát bẫy. Đường <b>tím</b> là nghiệm tốt nhất " +
          "từng thấy, chỉ có thể đi xuống.</li>" +
          "<li>Đường <b>cam đứt</b> là nhiệt độ, hạ theo cấp số nhân " +
          "<code>T_k = T₀·(T_end/T₀)^(k/K)</code> — cách hạ nhiệt <b>dễ điều khiển nhất</b> " +
          "vì bạn chỉ cần chọn T₀, T_end và số bước, không phải dò α.</li></ul>" +
          "<b>★ Hai chế độ hỏng đối xứng — kéo T₀ tới hai cực và đọc tỷ lệ chấp nhận:</b><ul>" +
          "<li><b>T₀ quá cao</b> (kéo lên 3): tỷ lệ chấp nhận gần <b>100 %</b>. " +
          "SA nhận gần như mọi nước, kể cả nước rất xấu ⇒ nó <b>đi ngẫu nhiên</b>, " +
          "đường xám nhảy loạn, đường tím gần như không xuống. " +
          "<b>Bạn đang trả tiền cho một bộ sinh số ngẫu nhiên đắt tiền.</b></li>" +
          "<li><b>T₀ quá thấp</b> (kéo về 0,002): tỷ lệ chấp nhận gần <b>0 %</b>. " +
          "SA thoái hoá thành <b>leo đồi thuần</b> — xuống nhanh lúc đầu rồi kẹt cứng. " +
          "Đường xám dính chặt vào đường tím.</li></ul>" +
          "<b>★ Bảng chuẩn để hiệu chuẩn</b> (bài 13 §3.2, với Δ = −1000):<br>" +
          "<code>T=10000 → 0,905</code> · <code>T=1000 → 0,368</code> · <code>T=500 → 0,135</code> · " +
          "<code>T=200 → 0,0067</code> · <code>T=100 → 4,5×10⁻⁵</code> · <code>T=10 → 10⁻⁴⁴</code><br>" +
          "★ <b>Quy tắc đọc:</b> khi <code>T ≈ |Δ|</code> thì xác suất chấp nhận ≈ <b>37 % (1/e)</b>. " +
          "Đây là mốc neo để hiệu chuẩn.<br><br>" +
          "<b>⇒ Quy trình hiệu chuẩn — đừng đoán</b> (bài 13 §4.1): chạy 1 000 nước " +
          "<b>ngẫu nhiên</b>, ghi <code>|Δ|</code> của các nước <b>làm xấu</b>, rồi đặt " +
          "<code>T₀ = |Δ|trung bình / ln(1/0,5)</code> và " +
          "<code>T_end = |Δ|nhỏ nhất / ln(1/0,001)</code>. " +
          "Cả hai <b>tính được từ dữ liệu</b>, không cần dò tay."
      });
      batDau();
    }
  });

  /* ================================================================
     12. Tabu search
     ================================================================ */
  demo({
    id: "tabu-search", nhom: "Metaheuristic", mon: "B14",
    ten: "Tabu search — cấm quay lại chỗ vừa đi",
    moTa: "Luôn đi nước tốt nhất, kể cả nước xấu — nhưng <b>cấm đảo ngược</b> " +
          "trong t vòng. Kéo tenure để thấy cả hai chế độ hỏng.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-14-tabu-search">B14 — Tabu search</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 24, tenure: 8, nguyenVong: true, soVong: 600, hat: 4 };
      var ds, q, best, bestD, curD, tabu, vong, lichSu, demCam, demNV;

      function datLai() {
        ds = sinhDiem(tt.n, tt.hat);
        q = ds.map(function (_, i) { return i; });
        var r = V.rng(tt.hat * 5 + 3), i, j, t;
        for (i = q.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = q[i]; q[i] = q[j]; q[j] = t; }
        curD = daiChuTrinh(q, ds);
        best = q.slice(); bestD = curD;
        tabu = {}; vong = 0; lichSu = []; demCam = 0; demNV = 0;
      }

      function khoa(a, b) { return Math.min(a, b) + "-" + Math.max(a, b); }

      function motVong() {
        if (vong >= tt.soVong) return false;
        var n = q.length, i, j, tot = null;
        for (i = 1; i < n - 1; i++) {
          for (j = i + 1; j < n; j++) {
            var d = delta2opt(q, ds, i, j);
            var k = khoa(q[i], q[j]);
            var bicam = (tabu[k] || 0) > vong;
            /* tieu chi nguyen vong: cho pha cam neu nuoc do cho nghiem TOT NHAT tu truoc toi nay */
            var nv = bicam && tt.nguyenVong && (curD + d < bestD - 1e-12);
            if (bicam && !nv) { demCam++; continue; }
            if (nv) demNV++;
            if (!tot || d < tot.d) tot = { i: i, j: j, d: d, k: k };
          }
        }
        if (!tot) { vong++; return true; }
        ap2opt(q, tot.i, tot.j);
        curD += tot.d;
        tabu[tot.k] = vong + tt.tenure;
        if (curD < bestD - 1e-12) { bestD = curD; best = q.slice(); }
        lichSu.push({ cur: curD, best: bestD });
        vong++;
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W / 2 - 24, H - 40), oy = 28;
        veTour(g, ds, q, 14, oy, S, V.mau("tx3"), 1.3);
        g.fillStyle = V.mau("tx2"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("Hiện tại — " + curD.toFixed(3), 14, oy - 8);
        veTour(g, ds, best, W / 2 + 10, oy, S, V.mau("ac"), 1.9);
        g.fillStyle = V.mau("ac"); g.font = "600 11.5px system-ui";
        g.fillText("Tốt nhất — " + bestD.toFixed(3), W / 2 + 10, oy - 8);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 46, padR = 16, padT = 26, padB = 70;
        var w = W2 - padL - padR, h = H2 - padT - padB;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Độ dài hiện tại (xám) và tốt nhất (tím) theo vòng lặp", padL, 16);

        if (lichSu.length > 1) {
          var lo = Math.min.apply(null, lichSu.map(function (p) { return p.best; }));
          var hi = Math.max.apply(null, lichSu.map(function (p) { return p.cur; }));
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          g2.strokeStyle = V.mau("tx3"); g2.lineWidth = 1.1;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.cur); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
          g2.strokeStyle = V.mau("ac"); g2.lineWidth = 2;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.best); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(2), padL - 5, padT + 8);
          g2.fillText(lo.toFixed(2), padL - 5, padT + h);
        }

        g2.textAlign = "left"; g2.font = "11.5px system-ui";
        var y = H2 - 52;
        var camTB = vong > 0 ? demCam / vong : 0;
        g2.fillStyle = V.mau("tx2");
        g2.fillText("Vòng " + vong + "/" + tt.soVong +
                    "  ·  tenure = " + tt.tenure +
                    "  ·  nước bị cấm mỗi vòng ≈ " + camTB.toFixed(0), padL, y);
        g2.fillText("Số lần tiêu chí nguyện vọng phá cấm: " + demNV, padL, y + 17);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        var n = tt.n, tong = (n - 2) * (n - 1) / 2;
        g2.fillText("Lân cận có ~" + Math.round(tong) + " nước; tenure quá lớn sẽ cấm gần hết.",
                    padL, y + 34);
      }

      function veHet() { ve(); ve2(); }

      var P = V.phat({
        toiDa: tt.soVong, tocDo: 8,
        datLai: datLai, buoc: motVong, ve: veHet,
        nhan: function () {
          return "hiện tại " + curD.toFixed(3) + " · tốt nhất " + bestD.toFixed(3) +
                 " · phá cấm " + demNV + " lần";
        }
      });
      function batDau() { P.datToiDa(tt.soVong); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Tenure — số vòng cấm", min: 1, max: 80, buoc: 1, giaTri: tt.tenure,
                  doi: function (v) { tt.tenure = v; batDau(); } }),
        V.danhDau({ ten: "Bật tiêu chí nguyện vọng (aspiration)", giaTri: tt.nguyenVong,
                    doi: function (v) { tt.nguyenVong = v; batDau(); } }),
        V.truot({ ten: "Số vòng lặp", min: 100, max: 2000, buoc: 100, giaTri: tt.soVong,
                  doi: function (v) { tt.soVong = v; batDau(); } }),
        V.truot({ ten: "Số điểm", min: 10, max: 40, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; batDau(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; batDau(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Tabu khác SA ở chỗ nó KHÔNG dùng ngẫu nhiên.</b> Mỗi vòng nó quét toàn bộ lân cận " +
          "và <b>luôn đi nước tốt nhất còn được phép</b> — kể cả khi nước đó làm tuyến dài ra. " +
          "Thứ ngăn nó quay lại ngay chỗ vừa rời là <b>danh sách cấm</b>: cặp điểm vừa bị đổi " +
          "sẽ bị cấm trong <code>tenure</code> vòng.<ul>" +
          "<li>Nhìn đường <b>xám</b>: nó leo lên leo xuống <b>đều đặn, không ngẫu nhiên</b> — " +
          "đó là dấu hiệu đặc trưng của tabu so với SA.</li></ul>" +
          "<b>★ Hai chế độ hỏng — kéo tenure tới hai cực:</b><ul>" +
          "<li><b>Tenure quá nhỏ</b> (kéo về 1–2): thuật toán <b>quay lại ngay</b> chỗ vừa rời. " +
          "Đường xám dao động trong một biên độ hẹp và đường tím đứng yên — " +
          "nó đang <b>đi vòng tròn</b>, đúng thứ mà tabu sinh ra để chống.</li>" +
          "<li><b>Tenure quá lớn</b> (kéo lên 60–80): đọc dòng \"nước bị cấm mỗi vòng\". " +
          "Gần như toàn bộ lân cận bị cấm ⇒ thuật toán <b>buộc phải đi những nước rất xấu</b>, " +
          "và nghiệm tốt nhất gần như không cải thiện. <b>Cấm quá nhiều cũng tệ như không cấm.</b></li>" +
          "<li>★ Quy tắc khởi điểm thực dụng: <code>tenure ≈ √(kích thước lân cận)</code>, " +
          "rồi tinh chỉnh. Với n = 24 thì lân cận ~253 nước ⇒ tenure ≈ 15.</li></ul>" +
          "<b>★ Tiêu chí nguyện vọng (aspiration) — tắt ô đó và so:</b> nó cho phép " +
          "<b>phá lệnh cấm</b> nếu nước đi đó dẫn tới nghiệm <b>tốt nhất từ trước tới nay</b>. " +
          "Lý do: lệnh cấm là một <b>xấp xỉ thô</b> (ta cấm theo thuộc tính của nước đi, " +
          "không phải theo nghiệm cụ thể), nên đôi khi nó cấm nhầm thứ đáng lẽ phải nhận. " +
          "Dòng \"số lần phá cấm\" cho thấy chuyện đó xảy ra bao nhiêu lần thật.<br><br>" +
          "<b>⇒ Tabu hay SA?</b> Tabu thường <b>hội tụ nhanh hơn</b> và <b>tái lập được</b> " +
          "(không ngẫu nhiên), nhưng mỗi vòng <b>đắt hơn nhiều</b> vì phải quét cả lân cận. " +
          "SA rẻ mỗi bước nên chạy được nhiều bước hơn. Lân cận nhỏ → tabu; lân cận khổng lồ → SA."
      });
      batDau();
    }
  });

  /* ================================================================
     13. Beam search
     ================================================================ */
  demo({
    id: "beam-search", nhom: "Metaheuristic", mon: "B16",
    ten: "Beam search — giữ lại k nghiệm dở dang tốt nhất",
    moTa: "Giữa greedy (k=1) và vét cạn (k=∞). Phần khó nhất là " +
          "<b>đánh giá một nghiệm còn dở dang</b> — xem nó hỏng khi đánh giá thiển cận.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-16-beam-search">B16 — Beam search</a>',
    dung: function (host) {
      var W = 560, H = 320, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 12, beam: 4, nhinXa: true, hat: 8 };
      var ds = sinhDiem(tt.n, tt.hat);

      /* beam search dung tuyen tu dau: moi buoc them mot diem */
      function chay(beam, nhinXa) {
        ds = sinhDiem(tt.n, tt.hat);
        var trang = [{ q: [0], con: ds.map(function (_, i) { return i; }).slice(1), d: 0 }];
        var lop = [trang.length];
        while (trang[0].con.length) {
          var moi = [];
          trang.forEach(function (s) {
            s.con.forEach(function (j) {
              var d = s.d + dE(ds[s.q[s.q.length - 1]], ds[j]);
              var conLai = s.con.filter(function (x) { return x !== j; });
              /* danh gia nghiem DO DANG: chi phi da co + (tuy chon) can duoi cho phan con lai */
              var uoc = d;
              if (nhinXa && conLai.length) {
                /* can duoi tho: moi diem con lai phai noi voi lang gieng gan nhat cua no */
                var them = 0;
                conLai.forEach(function (x) {
                  var m = Infinity;
                  conLai.concat([j]).forEach(function (y) {
                    if (x !== y) m = Math.min(m, dE(ds[x], ds[y]));
                  });
                  them += m;
                });
                uoc = d + them * 0.5;
              }
              moi.push({ q: s.q.concat([j]), con: conLai, d: d, uoc: uoc });
            });
          });
          moi.sort(function (a, b) { return a.uoc - b.uoc; });
          trang = moi.slice(0, beam);
          lop.push(Math.min(moi.length, beam));
        }
        var best = trang.map(function (s) {
          return { q: s.q, d: daiChuTrinh(s.q, ds) };
        }).reduce(function (a, b) { return b.d < a.d ? b : a; });
        return { best: best, lop: lop, soNut: lop.reduce(function (a, b) { return a + b; }, 0) };
      }

      var kq;

      function ve() {
        g.clearRect(0, 0, W, H);
        kq = chay(tt.beam, tt.nhinXa);
        var S = Math.min(W - 40, H - 120), ox = (W - S) / 2, oy = 30;
        veTour(g, ds, kq.best.q, ox, oy, S, V.mau("ac"), 1.9);
        g.fillStyle = V.mau("ac"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Beam k = " + tt.beam + " — dài " + kq.best.d.toFixed(3), ox, oy - 8);

        /* so do chum: moi lop bao nhieu nghiem duoc giu */
        var y0 = oy + S + 20, hh = 44;
        g.fillStyle = V.mau("tx2"); g.font = "11px system-ui";
        g.fillText("Số nghiệm dở dang được giữ ở mỗi lớp:", 14, y0);
        var wcol = (W - 28) / kq.lop.length;
        kq.lop.forEach(function (c, i) {
          var x = 14 + i * wcol;
          var hb = c / Math.max(1, tt.beam) * hh;
          g.fillStyle = V.mau("ac"); g.globalAlpha = 0.75;
          g.fillRect(x + 1, y0 + 8 + (hh - hb), Math.max(1, wcol - 2), hb);
          g.globalAlpha = 1;
        });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Bề rộng chùm so với chất lượng và chi phí:", 14, 20);

        var moc = [1, 2, 4, 8, 16, 32];
        var kqs = moc.map(function (k) { return { k: k, r: chay(k, tt.nhinXa) }; });
        var dMin = Math.min.apply(null, kqs.map(function (q) { return q.r.best.d; }));
        var dMax = Math.max.apply(null, kqs.map(function (q) { return q.r.best.d; }));

        kqs.forEach(function (q, i) {
          var y = 38 + i * 26;
          var t = (dMax - dMin) > 1e-9 ? (q.r.best.d - dMin) / (dMax - dMin) : 0;
          g2.fillStyle = q.k === tt.beam ? V.mau("ac") : V.mau("tx2");
          g2.font = (q.k === tt.beam ? "700 " : "") + "11.5px system-ui";
          g2.fillText("k = " + q.k + (q.k === 1 ? "  (= greedy)" : ""), 14, y + 13);
          g2.fillStyle = V.mau("surf2"); g2.fillRect(120, y, 240, 18);
          g2.fillStyle = q.k === tt.beam ? V.mau("ac") : V.mau("bd");
          g2.fillRect(120, y, Math.max(2, 240 * (1 - t * 0.85)), 18);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px ui-monospace, monospace";
          g2.fillText(q.r.best.d.toFixed(3), 370, y + 13);
          g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
          g2.fillText(q.r.soNut + " nút mở", 440, y + 13);
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
        g2.fillText("Chi phí tăng TUYẾN TÍNH theo k; chất lượng thì bão hoà rất nhanh.",
                    14, H2 - 8);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "Bề rộng chùm k", min: 1, max: 32, buoc: 1, giaTri: tt.beam,
                  doi: function (v) { tt.beam = v; veHet(); } }),
        V.danhDau({ ten: "Đánh giá có nhìn xa (cộng cận dưới phần còn lại)",
                    giaTri: tt.nhinXa, doi: function (v) { tt.nhinXa = v; veHet(); } }),
        V.truot({ ten: "Số điểm", min: 7, max: 14, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Beam search nằm đúng giữa greedy và vét cạn.</b> Greedy giữ <b>1</b> nghiệm dở dang " +
          "ở mỗi bước; vét cạn giữ <b>tất cả</b>; beam giữ <b>k</b> cái tốt nhất.<ul>" +
          "<li><b>Kéo k về 1</b>: kết quả trùng đúng greedy (láng giềng gần nhất). " +
          "Đó là phép kiểm tra tỉnh táo — nếu k=1 mà khác greedy thì cài đặt sai.</li>" +
          "<li>Bảng dưới cho thấy điều quan trọng nhất: <b>chi phí tăng tuyến tính theo k, " +
          "nhưng chất lượng bão hoà rất nhanh</b>. Từ k=8 lên k=32 thường gần như " +
          "không được gì thêm mà tốn gấp 4 lần.</li></ul>" +
          "<b>★ Phần khó nhất của beam search — và là chỗ hầu hết người mới làm sai:</b> " +
          "để xếp hạng các nghiệm <b>dở dang</b>, bạn phải <b>đánh giá một thứ chưa hoàn thành</b>.<ul>" +
          "<li><b>Tắt ô \"đánh giá có nhìn xa\"</b>: khi đó ta xếp hạng chỉ bằng " +
          "<b>chi phí đã tiêu</b>. Đây là <b>đánh giá thiển cận</b>, và nó thiên vị " +
          "một cách có hệ thống: nghiệm nào <b>đi ít bước nhất</b> trông rẻ nhất, " +
          "kể cả khi nó vừa bỏ lại một đống điểm ở góc xa.</li>" +
          "<li><b>Bật lại</b>: ta cộng thêm một <b>cận dưới thô</b> cho phần chưa làm " +
          "(mỗi điểm còn lại ít nhất phải nối tới láng giềng gần nhất của nó). " +
          "So hai kết quả — thường chênh rõ ở k nhỏ.</li>" +
          "<li>★ <b>Nguyên tắc tổng quát:</b> hàm đánh giá nghiệm dở dang phải là " +
          "<code>chi phí đã tiêu + ước lượng phần còn lại</code>. Bỏ vế thứ hai là " +
          "biến beam search thành greedy đắt tiền. (Đây đúng là ý tưởng của A* — " +
          "<code>f = g + h</code>.)</li></ul>" +
          "<b>⚠️ Beam search không có tính đơn điệu:</b> tăng k <b>không đảm bảo</b> kết quả " +
          "tốt hơn. Bảng dưới đôi khi cho k=8 tệ hơn k=4 — vì cắt chùm là một quyết định " +
          "tham lam ở mỗi lớp, và một nhánh bị cắt sớm có thể là nhánh tốt nhất."
      });
      veHet();
    }
  });

  /* ================================================================
     14. LNS / ALNS
     ================================================================ */
  demo({
    id: "lns-alns", nhom: "Metaheuristic", mon: "B17",
    ten: "LNS & ALNS — sửa nhà, không sửa gạch",
    moTa: "Phá bỏ 15–40 % nghiệm rồi xây lại tối ưu. " +
          "Và <b>ALNS tự học</b> toán tử phá nào đang hiệu quả.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17-lns-alns">B17 — LNS & ALNS</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 34, pha: 0.25, thichNghi: true, soVong: 400, hat: 7 };
      var ds, q, best, bestD, curD, vong, lichSu, troc, ws, dem;

      /* ba toan tu pha */
      var PHA = [
        { t: "Ngẫu nhiên", f: function (q, k, r) {
            var idx = q.map(function (_, i) { return i; });
            var out = [], i;
            for (i = 0; i < k && idx.length; i++) out.push(idx.splice(Math.floor(r() * idx.length), 1)[0]);
            return out;
          } },
        { t: "Cụm lân cận (Shaw)", f: function (q, k, r) {
            var seed = Math.floor(r() * q.length);
            var goc = ds[q[seed]];
            return q.map(function (v, i) { return { i: i, d: dE(ds[v], goc) }; })
                    .sort(function (a, b) { return a.d - b.d; })
                    .slice(0, k).map(function (o) { return o.i; });
          } },
        { t: "Đoạn liên tiếp", f: function (q, k, r) {
            var s = Math.floor(r() * (q.length - k)), out = [], i;
            for (i = 0; i < k; i++) out.push(s + i);
            return out;
          } }
      ];

      function datLai() {
        ds = sinhDiem(tt.n, tt.hat);
        q = ds.map(function (_, i) { return i; });
        var r = V.rng(tt.hat * 11 + 4), i, j, t;
        for (i = q.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = q[i]; q[i] = q[j]; q[j] = t; }
        curD = daiChuTrinh(q, ds);
        best = q.slice(); bestD = curD;
        vong = 0; lichSu = []; troc = [];
        ws = PHA.map(function () { return 1; });
        dem = PHA.map(function () { return { dung: 0, thang: 0 }; });
      }
      var rr = V.rng(4242);

      function chonToanTu() {
        if (!tt.thichNghi) return Math.floor(rr() * PHA.length);
        var tong = ws.reduce(function (a, b) { return a + b; }, 0);
        var x = rr() * tong, s = 0, i;
        for (i = 0; i < ws.length; i++) { s += ws[i]; if (x <= s) return i; }
        return ws.length - 1;
      }

      function motVong() {
        if (vong >= tt.soVong) return false;
        var k = Math.max(2, Math.round(q.length * tt.pha));
        var oi = chonToanTu();
        var viTri = PHA[oi].f(q, k, rr).slice().sort(function (a, b) { return b - a; });
        var moi = q.slice(), go = [];
        viTri.forEach(function (i) { go.push(moi.splice(i, 1)[0]); });
        troc = go.slice();

        /* xay lai: chen re nhat tung diem mot */
        go.forEach(function (v) {
          var bestC = Infinity, bestP = 0, i;
          for (i = 0; i <= moi.length; i++) {
            var a = moi[(i - 1 + moi.length) % moi.length], b = moi[i % moi.length];
            var c = dE(ds[a], ds[v]) + dE(ds[v], ds[b]) - dE(ds[a], ds[b]);
            if (c < bestC) { bestC = c; bestP = i; }
          }
          moi.splice(bestP, 0, v);
        });

        var d = daiChuTrinh(moi, ds);
        dem[oi].dung++;
        if (d < curD - 1e-12) {
          q = moi; curD = d;
          dem[oi].thang++;
          ws[oi] = ws[oi] * 0.9 + 0.1 * 8;          /* thuong lon neu cai thien */
          if (d < bestD - 1e-12) { bestD = d; best = q.slice(); }
        } else {
          ws[oi] = ws[oi] * 0.9 + 0.1 * 0.4;        /* phat nhe */
        }
        lichSu.push({ cur: curD, best: bestD });
        vong++;
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W / 2 - 24, H - 40), oy = 28;
        /* trai: nghiem hien tai + diem vua bi PHA */
        veTour(g, ds, q, 14, oy, S, V.mau("tx3"), 1.3);
        troc.forEach(function (idx) {
          var v = q[Math.min(idx, q.length - 1)];
          if (v === undefined) return;
          var p = ds[v];
          g.strokeStyle = V.mau("loi"); g.lineWidth = 2;
          g.beginPath(); g.arc(14 + p.x * S, oy + p.y * S, 6, 0, 6.2832); g.stroke();
        });
        g.fillStyle = V.mau("tx2"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("Hiện tại — " + curD.toFixed(3) +
                   "   (đỏ = vừa bị phá)", 14, oy - 8);

        veTour(g, ds, best, W / 2 + 10, oy, S, V.mau("ac"), 1.9);
        g.fillStyle = V.mau("ac"); g.font = "600 11.5px system-ui";
        g.fillText("Tốt nhất — " + bestD.toFixed(3), W / 2 + 10, oy - 8);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 46, padR = 16, padT = 24, padB = 108;
        var w = W2 - padL - padR, h = H2 - padT - padB;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Độ dài theo vòng  ·  vòng " + vong + "/" + tt.soVong, padL, 15);

        if (lichSu.length > 1) {
          var lo = Math.min.apply(null, lichSu.map(function (p) { return p.best; }));
          var hi = Math.max.apply(null, lichSu.map(function (p) { return p.cur; }));
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          g2.strokeStyle = V.mau("tx3"); g2.lineWidth = 1;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.cur); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
          g2.strokeStyle = V.mau("ac"); g2.lineWidth = 2;
          g2.beginPath();
          lichSu.forEach(function (p, k) { var yy = Y(p.best); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
        }

        /* trong so toan tu */
        var y0 = H2 - 96;
        g2.fillStyle = V.mau("tx"); g2.font = "600 11.5px system-ui";
        g2.fillText(tt.thichNghi ? "Trọng số ALNS (tự học được):"
                                 : "LNS thường — chọn toán tử đều nhau:", padL, y0);
        var tong = ws.reduce(function (a, b) { return a + b; }, 0) || 1;
        PHA.forEach(function (p, i) {
          var y = y0 + 12 + i * 24;
          var tl = tt.thichNghi ? ws[i] / tong : 1 / PHA.length;
          g2.fillStyle = V.mau("surf2"); g2.fillRect(padL + 130, y, 200, 15);
          g2.fillStyle = ["#5b4bd6", "#0f766e", "#b45309"][i];
          g2.fillRect(padL + 130, y, Math.max(2, 200 * tl), 15);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText(p.t, padL, y + 12);
          g2.fillStyle = V.mau("tx"); g2.font = "600 10.5px ui-monospace, monospace";
          g2.fillText((tl * 100).toFixed(0) + "%", padL + 338, y + 12);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui";
          g2.fillText(dem[i].thang + "/" + dem[i].dung + " lần cải thiện", padL + 378, y + 12);
        });
      }

      function veHet() { ve(); ve2(); }

      var P = V.phat({
        toiDa: tt.soVong, tocDo: 5,
        datLai: datLai, buoc: motVong, ve: veHet,
        nhan: function () {
          return "hiện tại " + curD.toFixed(3) + " · tốt nhất " + bestD.toFixed(3) +
                 " · phá " + Math.max(1, Math.round(tt.pha * tt.n)) + " điểm/vòng";
        }
      });
      function batDau() { P.datToiDa(tt.soVong); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Tỷ lệ phá mỗi vòng", min: 0.05, max: 0.7, buoc: 0.05, giaTri: tt.pha,
                  doi: function (v) { tt.pha = v; P.veLai(); } }),
        V.danhDau({ ten: "Bật ALNS (tự học trọng số toán tử)", giaTri: tt.thichNghi,
                    doi: function (v) { tt.thichNghi = v; batDau(); } }),
        V.truot({ ten: "Số vòng", min: 100, max: 1500, buoc: 100, giaTri: tt.soVong,
                  doi: function (v) { tt.soVong = v; batDau(); } }),
        V.truot({ ten: "Số điểm", min: 15, max: 60, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; batDau(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; batDau(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Ý tưởng một câu:</b> local search sửa <b>một viên gạch</b> mỗi lần " +
          "(đổi hai điểm). LNS <b>đập cả một mảng tường rồi xây lại cho tối ưu</b>. " +
          "Vòng đỏ trên hình trái là các điểm vừa bị gỡ ra.<ul>" +
          "<li><b>Phá</b>: gỡ 15–40 % số điểm khỏi tuyến. <b>Xây lại</b>: chèn từng điểm " +
          "vào khe rẻ nhất. Nếu nghiệm mới tốt hơn thì nhận.</li>" +
          "<li>★ Vì sao mạnh hơn 2-opt: một nước 2-opt chỉ đổi <b>2 cạnh</b>. Một vòng LNS " +
          "với 25 % phá có thể <b>đổi hàng chục cạnh cùng lúc</b> — nó nhảy tới một " +
          "vùng hoàn toàn khác của không gian nghiệm mà vẫn giữ được phần tốt.</li></ul>" +
          "<b>★ Kéo \"Tỷ lệ phá\" tới hai cực:</b><ul>" +
          "<li><b>Phá quá ít</b> (5 %): mỗi vòng gần như không đổi gì, LNS thoái hoá thành " +
          "local search chậm.</li>" +
          "<li><b>Phá quá nhiều</b> (70 %): xây lại gần như từ đầu ⇒ <b>mất hết thông tin</b> " +
          "của nghiệm cũ, và nó thành <b>đa khởi động</b> đắt tiền. Đường tím gần như đứng yên.</li>" +
          "<li>Vùng ngọt thường là <b>15–40 %</b> — và nó phụ thuộc bài toán, nên phải đo.</li></ul>" +
          "<b>★ Chữ \"A\" trong ALNS — tắt/bật ô đó và quan sát bảng trọng số:</b><ul>" +
          "<li>Có <b>ba toán tử phá</b>: ngẫu nhiên · cụm lân cận (Shaw) · đoạn liên tiếp. " +
          "Mỗi cái mạnh ở một loại cấu trúc khác nhau.</li>" +
          "<li><b>LNS thường</b> chọn đều nhau — kể cả toán tử đang vô dụng.</li>" +
          "<li><b>ALNS</b> cập nhật trọng số theo kết quả: toán tử nào vừa cho cải thiện thì " +
          "được <b>tăng xác suất chọn</b>. Nhìn cột phần trăm dịch chuyển dần — " +
          "<b>thuật toán đang tự học xem cái gì hiệu quả trên ĐÚNG dữ liệu này</b>.</li>" +
          "<li>⚠️ Cạm bẫy của ALNS: nếu tốc độ học quá cao, nó <b>khoá chặt vào một toán tử</b> " +
          "quá sớm và mất đa dạng. Đây đúng là bài toán khai thác–khám phá của bandit " +
          "(ε-greedy, UCB) xuất hiện lại ở một lớp trừu tượng khác.</li></ul>"
      });
      batDau();
    }
  });

})();
