/* =====================================================================
   Nhom 6 — Bay dan & tien hoa
   dan-kien (ACO) · di-truyen (GA) · tien-hoa-vi-phan (DE) ·
   bay-dan-pso (PSO) · dua-thuat-toan (so sanh 4 thuat tren cung ham)

   Moi demo dung V.phat(...) — xem thuat toan chay nhu xem video:
   Chay / Tam dung / Mot buoc / Dat lai / Tua / Toc do.
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ---------------- tien ich chung ---------------------------------- */
  function sinhDiem(n, hat) {
    var r = V.rng(hat), ds = [], i;
    for (i = 0; i < n; i++) ds.push({ x: r.khoang(0.06, 0.94), y: r.khoang(0.08, 0.92) });
    return ds;
  }
  function dE(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function maTranD(ds) {
    var n = ds.length, m = [], i, j;
    for (i = 0; i < n; i++) { m.push([]); for (j = 0; j < n; j++) m[i].push(dE(ds[i], ds[j])); }
    return m;
  }
  function daiTour(q, D) {
    var s = 0, n = q.length, i;
    for (i = 0; i < n; i++) s += D[q[i]][q[(i + 1) % n]];
    return s;
  }
  /* Ve mot duong cong don gian trong khung [padL..W-padR] x [padT..H-padB] */
  function veCong(g, ds, X, Y, mau, dam, dut) {
    if (ds.length < 2) return;
    g.strokeStyle = mau; g.lineWidth = dam || 1.6;
    if (dut) g.setLineDash(dut);
    g.beginPath();
    ds.forEach(function (v, k) { var yy = Y(v); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
    g.stroke(); g.setLineDash([]);
  }
  function chuThich(muc) {
    return V.el("div", { class: "chu-thich" }, muc.map(function (m) {
      return V.el("span", {}, [
        V.el("i", { class: "o-mau", style: "background:" + m[0] }), m[1]
      ]);
    }));
  }
  function hopSo() {
    var d = V.el("div", { class: "so-lieu" });
    d.dat = function (hang) {
      d.innerHTML = "";
      hang.forEach(function (h) {
        d.appendChild(V.el("div", { class: "d" }, [
          V.el("span", { text: h[0] }), V.el("b", { text: h[1] })
        ]));
      });
    };
    return d;
  }

  /* ================================================================
     17. Toi uu dan kien (ACO) tren TSP
     ================================================================ */
  demo({
    id: "dan-kien", nhom: "Bầy đàn & tiến hoá", mon: "B17B",
    ten: "Đàn kiến (ACO) — bầy đàn viết lên bản đồ",
    moTa: "Xem <b>từng con kiến</b> chọn từng cạnh, rồi mùi (pheromone) đọng lại " +
          "và uốn cong lựa chọn của những con sau. Kéo α, β, ρ tới cực trị để thấy nó hỏng.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17b-bay-dan-tien-hoa">B17B — Bầy đàn & tiến hoá</a>',
    dung: function (host) {
      var W = 560, H = 340, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { n: 22, kien: 12, alpha: 1, beta: 3, rho: 0.35, Q: 1, vong: 40, hat: 7, hienMui: true };
      var ds, D, tau, tau0, best, bestL, lichSu, r;
      var it, iKien, tour, daTham, curL, tourXong, tbVong, tourVong, muiMax;

      function datLai() {
        ds = sinhDiem(tt.n, tt.hat);
        D = maTranD(ds);
        r = V.rng(tt.hat * 31 + 5);
        /* tau0 theo do dai tour tham lam — chuan cua Dorigo */
        var gr = tourThamLam(0);
        tau0 = 1 / Math.max(1e-9, tt.n * daiTour(gr, D));
        tau = [];
        for (var i = 0; i < tt.n; i++) { tau.push([]); for (var j = 0; j < tt.n; j++) tau[i].push(tau0); }
        best = gr.slice(); bestL = daiTour(gr, D);
        lichSu = []; it = 0; iKien = 0; tbVong = []; tourVong = [];
        batDauKien();
      }

      function tourThamLam(s) {
        var q = [s], da = new Array(tt.n).fill(false); da[s] = true;
        for (var k = 1; k < tt.n; k++) {
          var cur = q[q.length - 1], bi = -1, bd = 1e9;
          for (var j = 0; j < tt.n; j++) if (!da[j] && D[cur][j] < bd) { bd = D[cur][j]; bi = j; }
          q.push(bi); da[bi] = true;
        }
        return q;
      }

      function batDauKien() {
        var s = Math.floor(r() * tt.n);
        tour = [s]; daTham = new Array(tt.n).fill(false); daTham[s] = true;
        curL = 0; tourXong = false;
      }

      /* MOT buoc = mot con kien di MOT canh */
      function buoc() {
        if (it >= tt.vong) return false;
        if (tour.length >= tt.n) {                    /* dong tour lai */
          curL += D[tour[tour.length - 1]][tour[0]];
          tourXong = true;
          if (curL < bestL - 1e-12) { bestL = curL; best = tour.slice(); }
          tbVong.push(curL);
          tourVong.push({ q: tour.slice(), L: curL });
          iKien++;
          if (iKien >= tt.kien) { capNhatMui(); iKien = 0; it++; }
          if (it < tt.vong) batDauKien();
          return true;
        }
        var cur = tour[tour.length - 1], tong = 0, w = [], j;
        for (j = 0; j < tt.n; j++) {
          if (daTham[j]) { w.push(0); continue; }
          var eta = 1 / Math.max(1e-9, D[cur][j]);
          var v = Math.pow(tau[cur][j], tt.alpha) * Math.pow(eta, tt.beta);
          w.push(v); tong += v;
        }
        var x = r() * tong, acc = 0, chon = -1;
        for (j = 0; j < tt.n; j++) { acc += w[j]; if (w[j] > 0 && x <= acc) { chon = j; break; } }
        if (chon < 0) for (j = 0; j < tt.n; j++) if (!daTham[j]) { chon = j; break; }
        curL += D[cur][chon];
        tour.push(chon); daTham[chon] = true;
        tourXong = false;
        return true;
      }

      function capNhatMui() {
        var i, j;
        for (i = 0; i < tt.n; i++) for (j = 0; j < tt.n; j++) tau[i][j] *= (1 - tt.rho);
        /* MOI con kien deu dong mui, luong ti le nghich do dai tour cua no.
           Nho vay lop mui la mot "truong xac suat" that su — neu chi cho tour tot
           nhat dong mui (elitist thuan) thi ban do mui TRUNG KHIT tour tot nhat,
           nhin khong hoc duoc gi. */
        tourVong.forEach(function (m) {
          var d = tt.Q / Math.max(1e-9, m.L);
          for (var k = 0; k < tt.n; k++) {
            var a = m.q[k], b = m.q[(k + 1) % tt.n];
            tau[a][b] += d; tau[b][a] += d;
          }
        });
        /* them phan thuong cho tour tot nhat tu truoc toi nay (elitist) */
        var dong = tt.Q / Math.max(1e-9, bestL);
        for (i = 0; i < tt.n; i++) {
          var a2 = best[i], b2 = best[(i + 1) % tt.n];
          tau[a2][b2] += dong; tau[b2][a2] += dong;
        }
        var tb = 0; tbVong.forEach(function (v) { tb += v; });
        lichSu.push({ best: bestL, tb: tbVong.length ? tb / tbVong.length : bestL });
        tbVong = []; tourVong = [];
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W - 180, H - 30), ox = 14, oy = 16;
        muiMax = 1e-12;
        var muiMin = 1e30, i, j;
        for (i = 0; i < tt.n; i++) for (j = i + 1; j < tt.n; j++) {
          if (tau[i][j] > muiMax) muiMax = tau[i][j];
          if (tau[i][j] < muiMin) muiMin = tau[i][j];
        }
        /* Chuan hoa theo KHOANG CHENH, khong theo max: luc dau moi canh bang nhau
           nen khong canh nao duoc ve — ban do sach. Canh chi hien khi mui da tach ra. */
        var dai = muiMax - muiMin;

        /* 1. Mui dong tren cac canh */
        if (tt.hienMui && dai > 1e-12) {
          for (i = 0; i < tt.n; i++) for (j = i + 1; j < tt.n; j++) {
            var t = (tau[i][j] - muiMin) / dai;
            if (t < 0.12) continue;
            g.strokeStyle = V.thangMau(Math.min(1, t));
            g.lineWidth = 0.4 + t * 4.2;
            g.globalAlpha = 0.18 + t * 0.62;
            g.beginPath();
            g.moveTo(ox + ds[i].x * S, oy + ds[i].y * S);
            g.lineTo(ox + ds[j].x * S, oy + ds[j].y * S);
            g.stroke();
          }
          g.globalAlpha = 1;
        }

        /* 2. Tour tot nhat */
        g.strokeStyle = V.mau("ok"); g.lineWidth = 2.2; g.globalAlpha = 0.85;
        g.beginPath();
        best.forEach(function (c, k) {
          var p = ds[c]; if (!k) g.moveTo(ox + p.x * S, oy + p.y * S); else g.lineTo(ox + p.x * S, oy + p.y * S);
        });
        g.closePath(); g.stroke(); g.globalAlpha = 1;

        /* 3. Con kien dang di */
        g.strokeStyle = V.mau("ba"); g.lineWidth = 2.6;
        g.beginPath();
        tour.forEach(function (c, k) {
          var p = ds[c]; if (!k) g.moveTo(ox + p.x * S, oy + p.y * S); else g.lineTo(ox + p.x * S, oy + p.y * S);
        });
        if (tourXong && tour.length) {
          var p0 = ds[tour[0]]; g.lineTo(ox + p0.x * S, oy + p0.y * S);
        }
        g.stroke();

        /* 4. Cac thanh pho */
        for (i = 0; i < tt.n; i++) {
          g.fillStyle = daTham[i] ? V.mau("ba") : V.mau("tx3");
          g.beginPath(); g.arc(ox + ds[i].x * S, oy + ds[i].y * S, daTham[i] ? 4 : 3, 0, 6.2832); g.fill();
        }
        if (tour.length) {
          var pc = ds[tour[tour.length - 1]];
          g.strokeStyle = V.mau("ba"); g.lineWidth = 2;
          g.beginPath(); g.arc(ox + pc.x * S, oy + pc.y * S, 8, 0, 6.2832); g.stroke();
        }

        /* 5. Bang ben phai */
        var bx = ox + S + 18;
        g.textAlign = "left"; g.font = "600 12px system-ui"; g.fillStyle = V.mau("tx");
        g.fillText("Vòng " + (it + 1) + "/" + tt.vong, bx, 24);
        g.font = "11.5px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("kiến " + (iKien + 1) + "/" + tt.kien, bx, 42);
        g.fillText("đã đi " + tour.length + "/" + tt.n + " thành phố", bx, 58);
        g.fillStyle = V.mau("ok"); g.font = "700 12px ui-monospace,monospace";
        g.fillText("tốt nhất " + bestL.toFixed(3), bx, 80);

        /* thang mui */
        g.font = "10.5px system-ui"; g.fillStyle = V.mau("tx3");
        g.fillText("nồng độ mùi", bx, 106);
        for (var k = 0; k < 40; k++) {
          g.fillStyle = V.thangMau(k / 39);
          g.fillRect(bx + k * 3, 112, 3, 9);
        }
        g.fillStyle = V.mau("tx3"); g.fillText("thấp", bx, 134); g.textAlign = "right";
        g.fillText("cao", bx + 120, 134); g.textAlign = "left";
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 54, padR = 16, padT = 26, padB = 34;
        var w = W2 - padL - padR, h = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Độ dài tour theo vòng — xanh: tốt nhất · xám: trung bình đàn", padL, 16);
        if (lichSu.length > 1) {
          var lo = 1e9, hi = -1e9;
          lichSu.forEach(function (p) { lo = Math.min(lo, p.best); hi = Math.max(hi, p.tb); });
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          veCong(g2, lichSu.map(function (p) { return p.tb; }), X, Y, V.mau("tx3"), 1.2);
          veCong(g2, lichSu.map(function (p) { return p.best; }), X, Y, V.mau("ok"), 2.2);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(2), padL - 5, padT + 8);
          g2.fillText(lo.toFixed(2), padL - 5, padT + h);
          g2.textAlign = "left";
          g2.fillText("vòng 1", padL, H2 - 14);
          g2.textAlign = "right"; g2.fillText("vòng " + lichSu.length, padL + w, H2 - 14);
        } else {
          g2.fillStyle = V.mau("tx3"); g2.font = "11.5px system-ui";
          g2.fillText("(chưa xong vòng nào — mỗi vòng cần " + (tt.kien * tt.n) + " bước)", padL, padT + 20);
        }
      }

      var P = V.phat({
        toiDa: tt.vong * tt.kien * (tt.n + 1),
        tocDo: 60,
        datLai: datLai,
        buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () { return "tốt nhất " + bestL.toFixed(3); }
      });

      function capSo() {
        var tyLe = lichSu.length > 1
          ? ((lichSu[0].best - bestL) / Math.max(1e-9, lichSu[0].best) * 100) : 0;
        so.dat([
          ["tour tốt nhất", bestL.toFixed(4)],
          ["cải thiện so với vòng 1", tyLe.toFixed(2) + " %"],
          ["số vòng đã xong", String(lichSu.length)],
          ["mùi cao nhất / τ₀", (muiMax / tau0).toFixed(1) + "×"]
        ]);
      }

      function lam() {
        P.datToiDa(tt.vong * tt.kien * (tt.n + 1));
        P.datLai();
      }

      var dk = [
        P.dk(),
        V.truot({ ten: "α — trọng số MÙI", min: 0, max: 5, buoc: 0.1, giaTri: tt.alpha,
                  doi: function (v) { tt.alpha = v; lam(); } }),
        V.truot({ ten: "β — trọng số KHOẢNG CÁCH", min: 0, max: 8, buoc: 0.1, giaTri: tt.beta,
                  doi: function (v) { tt.beta = v; lam(); } }),
        V.truot({ ten: "ρ — tốc độ bay hơi", min: 0.01, max: 0.95, buoc: 0.01, giaTri: tt.rho,
                  doi: function (v) { tt.rho = v; lam(); } }),
        V.truot({ ten: "Số kiến mỗi vòng", min: 3, max: 30, buoc: 1, giaTri: tt.kien,
                  doi: function (v) { tt.kien = v; lam(); } }),
        V.truot({ ten: "Số thành phố", min: 8, max: 40, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        V.danhDau({ ten: "Hiện lớp mùi", giaTri: tt.hienMui,
                    doi: function (v) { tt.hienMui = v; P.veLai(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[V.mau("ba"), "con kiến đang đi"], [V.mau("ok"), "tour tốt nhất"],
                           ["#c73c7a", "mùi đọng trên cạnh"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Đàn kiến giải bài toán bằng cách để lại dấu vết cho nhau.</b> Mỗi con kiến " +
          "xây một tour; đứng ở thành phố <code>i</code>, nó chọn thành phố kế tiếp " +
          "<code>j</code> với xác suất tỉ lệ <code>τ(i,j)^α · (1/d(i,j))^β</code>.<ul>" +
          "<li><b>τ</b> là <i>mùi</i> — ký ức tập thể: cạnh nào từng nằm trong tour tốt thì đậm mùi.</li>" +
          "<li><b>1/d</b> là <i>tri thức cục bộ</i> — cạnh ngắn thì hấp dẫn. Đây chính là " +
          "chỉ số tham lam của Bài 5.</li></ul>" +
          "Cuối mỗi vòng, mùi <b>bay hơi</b> (<code>τ ← (1−ρ)·τ</code>) rồi tour tốt nhất " +
          "<b>đọng thêm</b> mùi. Bay hơi là thứ giữ cho đàn không bị khoá vào lựa chọn sớm.<br>" +
          "<b>★ Ba cách phá nó — hãy thử lần lượt:</b><ul>" +
          "<li><b>β = 0</b> (bỏ khoảng cách): kiến chỉ đi theo mùi. Vòng đầu mùi đều nhau nên " +
          "chúng đi hoàn toàn ngẫu nhiên, rồi <b>tự khoá</b> vào tour ngẫu nhiên đầu tiên may mắn. " +
          "Đường xanh gần như phẳng ngay từ đầu — <i>đó là hội tụ sớm</i>.</li>" +
          "<li><b>α = 0</b> (bỏ mùi): không còn ký ức, mỗi vòng là một lần tham lam ngẫu nhiên " +
          "độc lập. Đường xám không hề đi xuống — <b>đàn không học được gì</b>, " +
          "ACO thoái hoá thành đa khởi động (Bài 8).</li>" +
          "<li><b>ρ ≈ 0,02</b> (gần như không bay hơi): mùi tích luỹ mãi, tỉ lệ " +
          "<code>mùi cao nhất / τ₀</code> ở bảng số vọt lên hàng nghìn lần. Khi một cạnh " +
          "đậm gấp nghìn lần cạnh khác thì xác suất chọn cạnh khác ≈ 0 ⇒ <b>đàn mù</b>.</li></ul>" +
          "📌 Ba nút này lặp lại đúng thế cân bằng của cả Phần 4: " +
          "<b>khai thác</b> (α, ρ nhỏ) đấu với <b>đa dạng hoá</b> (β, ρ lớn)."
      });
      lam();
    }
  });

  /* ================================================================
     18. Thuat toan di truyen (GA) tren bai toan cai tui
     ================================================================ */
  demo({
    id: "di-truyen", nhom: "Bầy đàn & tiến hoá", mon: "B17B",
    ten: "Giải thuật di truyền — nhìn thấy quần thể mất đa dạng",
    moTa: "Quần thể là một <b>bảng bit</b>. Xem từng phép chọn lọc — lai ghép — đột biến " +
          "diễn ra, và xem đường <b>đa dạng</b> tụt về 0 khi tắt đột biến.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17b-bay-dan-tien-hoa">B17B — Bầy đàn & tiến hoá</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { nGen: 26, nQt: 22, pDot: 0.03, pLai: 0.9, giai: 3, tinhHoa: true,
                 soCon: 2000, hat: 11 };
      var p, w, suc, qt, fit, r, lichSu, chaA, chaB, viTriCat, biDot, oCon, lanCuoi;

      function datLai() {
        r = V.rng(tt.hat * 17 + 3);
        p = []; w = [];
        var tongW = 0, i;
        for (i = 0; i < tt.nGen; i++) {
          var wi = Math.round(r.khoang(6, 30));
          w.push(wi); tongW += wi;
          /* gia tri co tuong quan voi can nang -> bai toan KHO hon */
          p.push(Math.round(wi * r.khoang(1.4, 2.8)));
        }
        suc = Math.round(tongW * 0.42);
        qt = []; fit = [];
        for (i = 0; i < tt.nQt; i++) {
          var c = [];
          for (var j = 0; j < tt.nGen; j++) c.push(r() < 0.25 ? 1 : 0);
          suaChoVua(c);
          qt.push(c); fit.push(danhGia(c));
        }
        lichSu = []; chaA = chaB = -1; viTriCat = -1; biDot = []; oCon = -1; lanCuoi = 0;
        ghiLichSu();
      }

      function danhGia(c) {
        var s = 0, tw = 0;
        for (var i = 0; i < tt.nGen; i++) if (c[i]) { s += p[i]; tw += w[i]; }
        return tw <= suc ? s : 0;                 /* qua tai => vo dung */
      }
      function suaChoVua(c) {                      /* bo dan mon te nhat cho toi khi vua */
        var tw = 0, i;
        for (i = 0; i < tt.nGen; i++) if (c[i]) tw += w[i];
        while (tw > suc) {
          var xau = -1, xauV = 1e9;
          for (i = 0; i < tt.nGen; i++) if (c[i] && p[i] / w[i] < xauV) { xauV = p[i] / w[i]; xau = i; }
          if (xau < 0) break;
          c[xau] = 0; tw -= w[xau];
        }
      }
      function daDang() {                          /* khoang cach Hamming trung binh */
        var t = 0, d = 0, i, j, k;
        for (i = 0; i < tt.nQt; i++) for (j = i + 1; j < tt.nQt; j++) {
          var h = 0;
          for (k = 0; k < tt.nGen; k++) if (qt[i][k] !== qt[j][k]) h++;
          t += h; d++;
        }
        return d ? t / d / tt.nGen : 0;
      }
      function ghiLichSu() {
        var b = 0, s = 0;
        for (var i = 0; i < tt.nQt; i++) { b = Math.max(b, fit[i]); s += fit[i]; }
        lichSu.push({ best: b, tb: s / tt.nQt, dd: daDang() });
      }
      function chonGiai() {
        var bi = Math.floor(r() * tt.nQt);
        for (var k = 1; k < tt.giai; k++) {
          var c = Math.floor(r() * tt.nQt);
          if (fit[c] > fit[bi]) bi = c;
        }
        return bi;
      }

      /* MOT buoc = sinh MOT ca the con va thay the ca the te nhat */
      function buoc() {
        if (lanCuoi >= tt.soCon) return false;
        chaA = chonGiai(); chaB = chonGiai();
        var con = qt[chaA].slice(), i;
        if (r() < tt.pLai) {
          viTriCat = 1 + Math.floor(r() * (tt.nGen - 1));
          for (i = viTriCat; i < tt.nGen; i++) con[i] = qt[chaB][i];
        } else { viTriCat = -1; }
        biDot = [];
        for (i = 0; i < tt.nGen; i++) if (r() < tt.pDot) { con[i] = 1 - con[i]; biDot.push(i); }
        suaChoVua(con);
        var fc = danhGia(con);

        /* thay the ca the te nhat (co giu tinh hoa) */
        var xau = 0;
        for (i = 1; i < tt.nQt; i++) if (fit[i] < fit[xau]) xau = i;
        var tot = 0;
        for (i = 1; i < tt.nQt; i++) if (fit[i] > fit[tot]) tot = i;
        if (!(tt.tinhHoa && xau === tot)) { qt[xau] = con; fit[xau] = fc; oCon = xau; }
        else oCon = -1;

        lanCuoi++;
        if (lanCuoi % tt.nQt === 0) ghiLichSu();
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ox = 14, oy = 34, cw = Math.min(14, (W - 210) / tt.nGen), chh = Math.min(11, (H - 70) / tt.nQt);
        g.font = "600 11px system-ui"; g.textAlign = "left"; g.fillStyle = V.mau("tx");
        g.fillText("Quần thể — mỗi hàng là một cá thể, mỗi ô là một món đồ", ox, 18);

        /* thu tu hien thi: theo fitness giam dan */
        var idx = qt.map(function (_, i) { return i; });
        idx.sort(function (a, b) { return fit[b] - fit[a]; });

        idx.forEach(function (ci, hang) {
          var y = oy + hang * chh;
          for (var j = 0; j < tt.nGen; j++) {
            var on = qt[ci][j];
            g.fillStyle = on ? V.thangMau(0.35 + 0.5 * (p[j] / w[j] - 1.4) / 1.4) : V.mau("bd2");
            g.fillRect(ox + j * cw, y, cw - 1.5, chh - 1.5);
          }
          /* danh dau cha me / con */
          var nhan = "";
          if (ci === chaA) nhan = "cha A";
          else if (ci === chaB) nhan = "cha B";
          if (ci === oCon) nhan = "▶ con mới";
          if (nhan) {
            g.strokeStyle = nhan.charAt(0) === "▶" ? V.mau("ok") : V.mau("ba");
            g.lineWidth = 1.6;
            g.strokeRect(ox - 2, y - 1.5, tt.nGen * cw + 2, chh);
            g.fillStyle = g.strokeStyle; g.font = "600 10px system-ui";
            g.fillText(nhan, ox + tt.nGen * cw + 8, y + chh - 2);
          }
          g.fillStyle = V.mau("tx3"); g.font = "9.5px ui-monospace,monospace";
          g.textAlign = "right";
          g.fillText(String(fit[ci]), ox + tt.nGen * cw + 76, y + chh - 2);
          g.textAlign = "left";
        });

        /* vach cat lai ghep */
        if (viTriCat > 0) {
          g.strokeStyle = V.mau("loi"); g.lineWidth = 1.8;
          g.setLineDash([3, 3]);
          g.beginPath();
          g.moveTo(ox + viTriCat * cw - 0.8, oy - 6);
          g.lineTo(ox + viTriCat * cw - 0.8, oy + tt.nQt * chh + 4);
          g.stroke(); g.setLineDash([]);
          g.fillStyle = V.mau("loi"); g.font = "600 10px system-ui"; g.textAlign = "center";
          g.fillText("cắt", ox + viTriCat * cw, oy - 10);
          g.textAlign = "left";
        }
        /* o bi dot bien */
        if (oCon >= 0) {
          var hangCon = idx.indexOf(oCon);
          biDot.forEach(function (j) {
            g.strokeStyle = V.mau("loi"); g.lineWidth = 1.8;
            g.strokeRect(ox + j * cw - 1, oy + hangCon * chh - 1, cw + 0.5, chh + 0.5);
          });
        }

        var bx = ox + tt.nGen * cw + 96;
        g.font = "11.5px system-ui"; g.fillStyle = V.mau("tx2"); g.textAlign = "left";
        g.fillText("sức chứa " + suc, bx, oy + 8);
        g.fillText("con thứ " + lanCuoi, bx, oy + 26);
        g.fillStyle = V.mau("loi"); g.font = "10.5px system-ui";
        g.fillText(biDot.length + " gen đột biến", bx, oy + 44);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 46, padR = 46, padT = 26, padB = 32;
        var w2 = W2 - padL - padR, h = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Xanh: tốt nhất · xám: trung bình · đỏ đứt: ĐA DẠNG của quần thể", padL, 16);
        if (lichSu.length > 1) {
          var lo = 1e9, hi = 0;
          lichSu.forEach(function (p2) { lo = Math.min(lo, p2.tb); hi = Math.max(hi, p2.best); });
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w2; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          var YD = function (v) { return padT + h - Math.min(1, v / 0.5) * h; };
          veCong(g2, lichSu.map(function (q) { return q.tb; }), X, Y, V.mau("tx3"), 1.2);
          veCong(g2, lichSu.map(function (q) { return q.best; }), X, Y, V.mau("ok"), 2.2);
          veCong(g2, lichSu.map(function (q) { return q.dd; }), X, YD, V.mau("loi"), 1.6, [4, 3]);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(0), padL - 5, padT + 8);
          g2.fillText(lo.toFixed(0), padL - 5, padT + h);
          g2.textAlign = "left"; g2.fillStyle = V.mau("loi");
          g2.fillText("0,5", padL + w2 + 5, padT + 8);
          g2.fillText("0", padL + w2 + 5, padT + h);
        }
      }

      var P = V.phat({
        toiDa: tt.soCon, tocDo: 12,
        datLai: datLai, buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () {
          var d = lichSu.length ? lichSu[lichSu.length - 1] : null;
          return d ? ("tốt nhất " + d.best + " · đa dạng " + (d.dd * 100).toFixed(1) + " %") : "";
        }
      });

      function capSo() {
        var d = lichSu.length ? lichSu[lichSu.length - 1] : { best: 0, tb: 0, dd: 0 };
        so.dat([
          ["giá trị tốt nhất", String(d.best)],
          ["trung bình quần thể", d.tb.toFixed(1)],
          ["đa dạng (Hamming TB)", (d.dd * 100).toFixed(1) + " %"],
          ["đã sinh", lanCuoi + " cá thể con"]
        ]);
      }
      function lam() { P.datToiDa(tt.soCon); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Xác suất đột biến mỗi gen", min: 0, max: 0.3, buoc: 0.005, giaTri: tt.pDot,
                  doi: function (v) { tt.pDot = v; lam(); } }),
        V.truot({ ten: "Xác suất lai ghép", min: 0, max: 1, buoc: 0.05, giaTri: tt.pLai,
                  doi: function (v) { tt.pLai = v; lam(); } }),
        V.truot({ ten: "Cỡ giải đấu (áp lực chọn lọc)", min: 1, max: 8, buoc: 1, giaTri: tt.giai,
                  doi: function (v) { tt.giai = v; lam(); } }),
        V.truot({ ten: "Cỡ quần thể", min: 6, max: 30, buoc: 1, giaTri: tt.nQt,
                  doi: function (v) { tt.nQt = v; lam(); } }),
        V.truot({ ten: "Số món đồ (số gen)", min: 10, max: 34, buoc: 1, giaTri: tt.nGen,
                  doi: function (v) { tt.nGen = v; lam(); } }),
        V.danhDau({ ten: "Giữ tinh hoa (không xoá cá thể tốt nhất)", giaTri: tt.tinhHoa,
                    doi: function (v) { tt.tinhHoa = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[V.mau("ba"), "hai cha mẹ được chọn"], [V.mau("ok"), "cá thể con vừa sinh"],
                           [V.mau("loi"), "điểm cắt & gen đột biến"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Giải thuật di truyền mượn ba động tác của tiến hoá sinh học:</b><ul>" +
          "<li><b>Chọn lọc</b> — bốc ngẫu nhiên <i>k</i> cá thể rồi lấy cá thể khoẻ nhất " +
          "(giải đấu). <i>k</i> lớn = áp lực chọn lọc mạnh.</li>" +
          "<li><b>Lai ghép</b> — cắt hai chuỗi bit tại một điểm rồi ghép chéo (vạch đỏ).</li>" +
          "<li><b>Đột biến</b> — lật ngẫu nhiên vài bit (ô viền đỏ).</li></ul>" +
          "Ở đây bài toán là <b>cái túi</b> (Bài 1): mỗi bit = lấy hay không lấy một món. " +
          "Cá thể quá tải bị sửa lại bằng cách bỏ dần món có tỉ số tệ nhất — đó chính là " +
          "chỉ số tham lam của Bài 5 nằm bên trong GA.<br>" +
          "<b>★ Đường đỏ đứt là thứ đáng nhìn nhất.</b> Nó đo <b>đa dạng</b> — khoảng cách " +
          "Hamming trung bình giữa hai cá thể bất kỳ. Hãy thử:<ul>" +
          "<li><b>Đột biến = 0</b>: đa dạng tụt xuống <b>0 %</b> sau vài trăm con. Khi mọi cá thể " +
          "giống hệt nhau thì lai ghép <b>không sinh ra gì mới</b> — GA chết đứng, " +
          "đường xanh phẳng lì. Đây là <i>hội tụ sớm</i>, bệnh kinh điển của GA.</li>" +
          "<li><b>Đột biến = 0,3</b>: đa dạng cao ngất nhưng đường xanh cũng gần như không lên — " +
          "đột biến phá nhanh hơn chọn lọc xây. GA thành <b>tìm kiếm ngẫu nhiên</b>.</li>" +
          "<li><b>Cỡ giải đấu = 1</b>: chọn lọc hoàn toàn ngẫu nhiên ⇒ không có áp lực tiến hoá. " +
          "<b>Cỡ giải đấu = 8</b>: luôn chọn con khoẻ nhất ⇒ đa dạng sập rất nhanh.</li></ul>" +
          "📌 Đây đúng là thế cân bằng <b>khai thác ↔ đa dạng hoá</b> của Bài 12, chỉ đổi tên gọi."
      });
      lam();
    }
  });

  /* ---------------- mat ham chung cho DE / PSO / dua --------------- */
  /* Rastrigin thu nho — nhieu cuc tri cuc bo, cuc tieu toan cuc tai (0,0) */
  var MIEN = 5.12;
  function fRas(x, y) {
    return 20 + x * x + y * y - 10 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y));
  }
  /* Nen ve MOT lan vao canvas ngoai man hinh roi dan lai — ve lai moi khung hinh
     thi vua cham vua bi rang cua. Bo nho dem theo (kich thuoc, giao dien). */
  var NEN = {};
  function nenAnh(S) {
    var khoa = S + "|" + (document.documentElement.getAttribute("data-theme") || "auto") +
               "|" + V.thangMau(0.5);
    if (NEN[khoa]) return NEN[khoa];
    var b = 2, n = Math.ceil(S / b), i, j;
    var oc = document.createElement("canvas");
    oc.width = n; oc.height = n;
    var og = oc.getContext("2d");
    var lo = 1e9, hi = -1e9, vals = [];
    for (i = 0; i < n; i++) {
      vals.push([]);
      for (j = 0; j < n; j++) {
        var x = (i / (n - 1)) * 2 * MIEN - MIEN, y = (j / (n - 1)) * 2 * MIEN - MIEN;
        var v = Math.pow(fRas(x, y), 0.45);
        vals[i].push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      og.fillStyle = V.thangMau((vals[i][j] - lo) / Math.max(1e-9, hi - lo));
      og.fillRect(i, j, 1, 1);
    }
    NEN[khoa] = oc;
    return oc;
  }
  function veNen(g, W, H, ox, oy, S) {
    var oc = nenAnh(S);
    g.imageSmoothingEnabled = true;
    g.drawImage(oc, 0, 0, oc.width, oc.height, ox, oy, S, S);
  }
  function toaDo(ox, oy, S) {
    return {
      X: function (x) { return ox + (x + MIEN) / (2 * MIEN) * S; },
      Y: function (y) { return oy + (y + MIEN) / (2 * MIEN) * S; }
    };
  }
  function kep(v) { return Math.max(-MIEN, Math.min(MIEN, v)); }

  /* ================================================================
     19. Tien hoa vi phan (DE)
     ================================================================ */
  demo({
    id: "tien-hoa-vi-phan", nhom: "Bầy đàn & tiến hoá", mon: "B17B",
    ten: "Tiến hoá vi phân — dùng chính quần thể làm thước đo bước đi",
    moTa: "DE không cần bạn chọn độ dài bước: nó lấy <b>hiệu của hai cá thể</b> làm bước. " +
          "Xem từng vectơ thử được tạo ra trên mặt Rastrigin đầy bẫy.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17b-bay-dan-tien-hoa">B17B — Bầy đàn & tiến hoá</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 190;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { NP: 20, F: 0.7, CR: 0.9, soThu: 3000, hat: 9 };
      var pop, val, r, best, bestV, lichSu, iMuc, aI, bI, cI, muc, thu, nhanBuoc, dem;

      function datLai() {
        r = V.rng(tt.hat * 7 + 1);
        pop = []; val = [];
        for (var i = 0; i < tt.NP; i++) {
          var p = [r.khoang(-MIEN, MIEN), r.khoang(-MIEN, MIEN)];
          pop.push(p); val.push(fRas(p[0], p[1]));
        }
        best = pop[0].slice(); bestV = val[0];
        val.forEach(function (v, i) { if (v < bestV) { bestV = v; best = pop[i].slice(); } });
        lichSu = []; iMuc = 0; aI = bI = cI = -1; muc = null; thu = null; nhanBuoc = ""; dem = 0;
        ghi();
      }
      function ghi() {
        var tb = 0, sx = 0, sy = 0, i;
        for (i = 0; i < tt.NP; i++) { tb += val[i]; sx += pop[i][0]; sy += pop[i][1]; }
        tb /= tt.NP; sx /= tt.NP; sy /= tt.NP;
        var sd = 0;
        for (i = 0; i < tt.NP; i++) sd += Math.pow(pop[i][0] - sx, 2) + Math.pow(pop[i][1] - sy, 2);
        lichSu.push({ best: bestV, tb: tb, toe: Math.sqrt(sd / tt.NP) });
      }
      function khac(tru) {
        var k;
        do { k = Math.floor(r() * tt.NP); } while (tru.indexOf(k) >= 0);
        return k;
      }

      /* MOT buoc = tao vecto thu cho MOT ca the roi chon giu hay bo */
      function buoc() {
        if (dem >= tt.soThu) return false;
        iMuc = dem % tt.NP;
        aI = khac([iMuc]); bI = khac([iMuc, aI]); cI = khac([iMuc, aI, bI]);
        /* DE/rand/1 : v = a + F*(b - c) */
        var v0 = kep(pop[aI][0] + tt.F * (pop[bI][0] - pop[cI][0]));
        var v1 = kep(pop[aI][1] + tt.F * (pop[bI][1] - pop[cI][1]));
        /* lai ghep nhi thuc: moi chieu lay tu v voi xac suat CR, it nhat 1 chieu */
        var u = pop[iMuc].slice(), batBuoc = Math.floor(r() * 2);
        if (r() < tt.CR || batBuoc === 0) u[0] = v0;
        if (r() < tt.CR || batBuoc === 1) u[1] = v1;
        muc = [v0, v1]; thu = u.slice();
        var fu = fRas(u[0], u[1]);
        if (fu <= val[iMuc]) {
          pop[iMuc] = u; val[iMuc] = fu;
          nhanBuoc = "nhận";
          if (fu < bestV) { bestV = fu; best = u.slice(); }
        } else nhanBuoc = "bỏ";
        dem++;
        if (dem % tt.NP === 0) ghi();
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W - 190, H - 24), ox = 12, oy = 12;
        veNen(g, W, H, ox, oy, S);
        var T = toaDo(ox, oy, S), i;

        /* ba ca the goc va vecto hieu */
        if (aI >= 0) {
          g.strokeStyle = V.mau("ba"); g.lineWidth = 1.5; g.setLineDash([3, 3]);
          g.beginPath();
          g.moveTo(T.X(pop[cI][0]), T.Y(pop[cI][1]));
          g.lineTo(T.X(pop[bI][0]), T.Y(pop[bI][1]));
          g.stroke(); g.setLineDash([]);
          g.strokeStyle = V.mau("ba"); g.lineWidth = 2;
          g.beginPath();
          g.moveTo(T.X(pop[aI][0]), T.Y(pop[aI][1]));
          g.lineTo(T.X(muc[0]), T.Y(muc[1]));
          g.stroke();
          [["a", aI], ["b", bI], ["c", cI]].forEach(function (m) {
            g.fillStyle = V.mau("ba"); g.font = "700 10px system-ui"; g.textAlign = "center";
            g.fillText(m[0], T.X(pop[m[1]][0]), T.Y(pop[m[1]][1]) - 8);
          });
        }
        /* quan the */
        for (i = 0; i < tt.NP; i++) {
          g.fillStyle = (i === iMuc) ? V.mau("loi") : "#ffffff";
          g.strokeStyle = V.mau("tx"); g.lineWidth = 1;
          g.beginPath(); g.arc(T.X(pop[i][0]), T.Y(pop[i][1]), i === iMuc ? 5 : 3.4, 0, 6.2832);
          g.fill(); g.stroke();
        }
        /* diem thu */
        if (thu) {
          g.strokeStyle = nhanBuoc === "nhận" ? V.mau("ok") : V.mau("tx3");
          g.lineWidth = 2;
          g.beginPath(); g.arc(T.X(thu[0]), T.Y(thu[1]), 6, 0, 6.2832); g.stroke();
        }
        /* diem tot nhat */
        g.fillStyle = V.mau("ok");
        g.beginPath(); g.arc(T.X(best[0]), T.Y(best[1]), 5.5, 0, 6.2832); g.fill();

        var bx = ox + S + 16;
        g.textAlign = "left"; g.font = "600 12px system-ui"; g.fillStyle = V.mau("tx");
        g.fillText("Cá thể #" + iMuc, bx, 24);
        g.font = "11px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("v = a + F·(b − c)", bx, 44);
        g.fillText("F = " + tt.F.toFixed(2), bx, 60);
        g.fillText("|b − c| = " + (aI >= 0
          ? Math.hypot(pop[bI][0] - pop[cI][0], pop[bI][1] - pop[cI][1]).toFixed(2) : "—"), bx, 76);
        g.fillStyle = nhanBuoc === "nhận" ? V.mau("ok") : V.mau("tx3");
        g.font = "700 12px system-ui";
        g.fillText(nhanBuoc ? ("→ " + nhanBuoc) : "", bx, 98);
        g.fillStyle = V.mau("ok"); g.font = "700 12px ui-monospace,monospace";
        g.fillText("f* = " + bestV.toFixed(4), bx, 124);
        g.font = "10.5px system-ui"; g.fillStyle = V.mau("tx3");
        g.fillText("(cực tiểu thật = 0", bx, 142);
        g.fillText(" tại gốc toạ độ)", bx, 156);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 54, padR = 46, padT = 24, padB = 28;
        var w = W2 - padL - padR, h = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Xanh: f tốt nhất (thang log) · đỏ đứt: ĐỘ TOÈ của quần thể", padL, 15);
        if (lichSu.length > 1) {
          var L = function (v) { return Math.log10(Math.max(1e-6, v)); };
          var lo = 1e9, hi = -1e9;
          lichSu.forEach(function (p) { lo = Math.min(lo, L(p.best)); hi = Math.max(hi, L(p.tb)); });
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (L(v) - lo) / (hi - lo) * h; };
          var YT = function (v) { return padT + h - Math.min(1, v / 5) * h; };
          veCong(g2, lichSu.map(function (p) { return p.tb; }), X, Y, V.mau("tx3"), 1.2);
          veCong(g2, lichSu.map(function (p) { return p.best; }), X, Y, V.mau("ok"), 2.2);
          veCong(g2, lichSu.map(function (p) { return p.toe; }), X, YT, V.mau("loi"), 1.6, [4, 3]);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText("10^" + hi.toFixed(1), padL - 5, padT + 8);
          g2.fillText("10^" + lo.toFixed(1), padL - 5, padT + h);
          g2.textAlign = "left"; g2.fillStyle = V.mau("loi");
          g2.fillText("toè 5", padL + w + 5, padT + 8);
          g2.fillText("0", padL + w + 5, padT + h);
        }
      }

      var P = V.phat({
        toiDa: tt.soThu, tocDo: 10,
        datLai: datLai, buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () { return "f* = " + bestV.toFixed(5); }
      });
      function capSo() {
        var d = lichSu.length ? lichSu[lichSu.length - 1] : { toe: 0, tb: 0 };
        so.dat([
          ["f tốt nhất", bestV.toFixed(5)],
          ["f trung bình", d.tb.toFixed(3)],
          ["độ toè quần thể", d.toe.toFixed(3)],
          ["số lần thử", String(dem)]
        ]);
      }
      function lam() { P.datToiDa(tt.soThu); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "F — hệ số vi phân", min: 0, max: 1.5, buoc: 0.02, giaTri: tt.F,
                  doi: function (v) { tt.F = v; lam(); } }),
        V.truot({ ten: "CR — tỉ lệ lai ghép", min: 0, max: 1, buoc: 0.05, giaTri: tt.CR,
                  doi: function (v) { tt.CR = v; lam(); } }),
        V.truot({ ten: "NP — cỡ quần thể", min: 4, max: 60, buoc: 1, giaTri: tt.NP,
                  doi: function (v) { tt.NP = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[V.mau("loi"), "cá thể đang bị thay thế"], [V.mau("ba"), "ba cá thể a, b, c"],
                           [V.mau("ok"), "điểm tốt nhất"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Mặt nền là hàm Rastrigin</b> — một cái bát lớn bị rỗ hàng chục hố nhỏ. " +
          "Leo đồi (Bài 9) rơi vào hố gần nhất và kẹt vĩnh viễn ở đó. Nhiệm vụ: tìm đáy bát thật, " +
          "tại gốc toạ độ, <code>f = 0</code>.<br>" +
          "<b>Ý tưởng của DE gói trong một dòng:</b> " +
          "<code>v = a + F·(b − c)</code> với a, b, c là <b>ba cá thể lấy ngẫu nhiên</b>.<br>" +
          "★ Điểm đắt giá nằm ở chỗ <b>bạn không phải chọn độ dài bước</b>. Hiệu " +
          "<code>b − c</code> <i>chính là</i> độ toè hiện tại của quần thể: lúc đầu quần thể " +
          "tản rộng ⇒ bước dài ⇒ khám phá; càng về sau quần thể co lại ⇒ bước tự ngắn đi ⇒ " +
          "tinh chỉnh. <b>Thuật toán tự hiệu chuẩn.</b> So với simulated annealing (Bài 13), " +
          "nơi bạn phải tự dò T₀ và T_end, đây là một lợi thế rất lớn.<br>" +
          "<b>★ Hãy thử ba mốc:</b><ul>" +
          "<li><b>F = 0</b>: vectơ thử luôn trùng một cá thể đã có ⇒ quần thể không đi đâu cả. " +
          "Đường đỏ (độ toè) chỉ có thể <b>giảm</b>, không bao giờ tăng.</li>" +
          "<li><b>F ≈ 0,5–0,9</b>: vùng lành mạnh. Đường đỏ giảm dần đều — đó là " +
          "<i>quần thể đang tự thu hẹp vùng tìm kiếm</i>.</li>" +
          "<li><b>F ≥ 1,2</b>: bước dài hơn khoảng cách giữa các cá thể ⇒ quần thể nở ra thay vì " +
          "co lại, đường đỏ đi ngang ở mức cao, f* gần như không xuống.</li></ul>" +
          "⚠️ <b>NP quá nhỏ</b> (dưới 8) cũng hỏng, nhưng vì lý do khác: chỉ còn vài vectơ hiệu " +
          "khả dĩ nên hướng đi bị nghèo nàn — đây là <b>mất đa dạng</b>, đúng bệnh của GA ở demo trước."
      });
      lam();
    }
  });

  /* ================================================================
     20. Toi uu bay hat (PSO)
     ================================================================ */
  demo({
    id: "bay-dan-pso", nhom: "Bầy đàn & tiến hoá", mon: "B17B",
    ten: "Bầy hạt (PSO) — quán tính, ký ức riêng và áp lực đám đông",
    moTa: "Mỗi hạt bị kéo bởi <b>ba lực</b>. Kéo w lên trên 1 để xem bầy nổ tung, " +
          "kéo c₁ về 0 để xem cả bầy đâm đầu vào một cái hố.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17b-bay-dan-tien-hoa">B17B — Bầy đàn & tiến hoá</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 190;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { N: 22, w: 0.72, c1: 1.5, c2: 1.5, vMax: 2.5, soBuoc: 2600, hat: 4, veo: true };
      var hat, r, gbest, gbestV, lichSu, dem, iHat;

      function datLai() {
        r = V.rng(tt.hat * 13 + 7);
        hat = [];
        for (var i = 0; i < tt.N; i++) {
          var x = r.khoang(-MIEN, MIEN), y = r.khoang(-MIEN, MIEN);
          var f = fRas(x, y);
          hat.push({ x: x, y: y, vx: r.khoang(-1, 1), vy: r.khoang(-1, 1),
                     px: x, py: y, pv: f, f: f, vet: [[x, y]] });
        }
        gbest = [hat[0].x, hat[0].y]; gbestV = hat[0].f;
        hat.forEach(function (h) { if (h.f < gbestV) { gbestV = h.f; gbest = [h.x, h.y]; } });
        lichSu = []; dem = 0; iHat = 0; ghi();
      }
      function ghi() {
        var tb = 0, v = 0, i;
        for (i = 0; i < tt.N; i++) { tb += hat[i].f; v += Math.hypot(hat[i].vx, hat[i].vy); }
        lichSu.push({ best: gbestV, tb: tb / tt.N, v: v / tt.N });
      }

      /* MOT buoc = cap nhat MOT hat */
      function buoc() {
        if (dem >= tt.soBuoc) return false;
        iHat = dem % tt.N;
        var h = hat[iHat];
        var r1 = r(), r2 = r(), r3 = r(), r4 = r();
        h.vx = tt.w * h.vx + tt.c1 * r1 * (h.px - h.x) + tt.c2 * r2 * (gbest[0] - h.x);
        h.vy = tt.w * h.vy + tt.c1 * r3 * (h.py - h.y) + tt.c2 * r4 * (gbest[1] - h.y);
        var sp = Math.hypot(h.vx, h.vy);
        if (sp > tt.vMax) { h.vx *= tt.vMax / sp; h.vy *= tt.vMax / sp; }
        h.x = kep(h.x + h.vx); h.y = kep(h.y + h.vy);
        h.f = fRas(h.x, h.y);
        if (h.f < h.pv) { h.pv = h.f; h.px = h.x; h.py = h.y; }
        if (h.f < gbestV) { gbestV = h.f; gbest = [h.x, h.y]; }
        h.vet.push([h.x, h.y]); if (h.vet.length > 26) h.vet.shift();
        dem++;
        if (dem % tt.N === 0) ghi();
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W - 180, H - 24), ox = 12, oy = 12;
        veNen(g, W, H, ox, oy, S);
        var T = toaDo(ox, oy, S), i;

        hat.forEach(function (h, k) {
          if (tt.veo && h.vet.length > 1) {
            g.strokeStyle = V.mau("tx3"); g.lineWidth = 1; g.globalAlpha = 0.45;
            g.beginPath();
            h.vet.forEach(function (p, j) { if (!j) g.moveTo(T.X(p[0]), T.Y(p[1])); else g.lineTo(T.X(p[0]), T.Y(p[1])); });
            g.stroke(); g.globalAlpha = 1;
          }
          /* ky uc rieng */
          g.fillStyle = V.mau("ba"); g.globalAlpha = 0.55;
          g.beginPath(); g.arc(T.X(h.px), T.Y(h.py), 2, 0, 6.2832); g.fill();
          g.globalAlpha = 1;
          /* vecto van toc */
          g.strokeStyle = (k === iHat) ? V.mau("loi") : V.mau("tx");
          g.lineWidth = (k === iHat) ? 2 : 1;
          g.beginPath();
          g.moveTo(T.X(h.x), T.Y(h.y));
          g.lineTo(T.X(kep(h.x + h.vx * 0.6)), T.Y(kep(h.y + h.vy * 0.6)));
          g.stroke();
          g.fillStyle = (k === iHat) ? V.mau("loi") : "#ffffff";
          g.strokeStyle = V.mau("tx"); g.lineWidth = 1;
          g.beginPath(); g.arc(T.X(h.x), T.Y(h.y), (k === iHat) ? 5 : 3.4, 0, 6.2832);
          g.fill(); g.stroke();
        });

        /* gbest */
        g.fillStyle = V.mau("ok");
        g.beginPath();
        var gx = T.X(gbest[0]), gy = T.Y(gbest[1]);
        for (i = 0; i < 10; i++) {
          var ang = -Math.PI / 2 + i * Math.PI / 5, rad = (i % 2 === 0) ? 8 : 3.6;
          var px = gx + Math.cos(ang) * rad, py = gy + Math.sin(ang) * rad;
          if (!i) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.fill();

        var bx = ox + S + 14;
        g.textAlign = "left"; g.font = "600 12px system-ui"; g.fillStyle = V.mau("tx");
        g.fillText("Hạt #" + iHat, bx, 24);
        g.font = "11px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("v ← w·v", bx, 44);
        g.fillText("  + c₁·r·(riêng − x)", bx, 60);
        g.fillText("  + c₂·r·(chung − x)", bx, 76);
        var tbV = lichSu.length ? lichSu[lichSu.length - 1].v : 0;
        g.fillStyle = tbV > tt.vMax * 0.9 ? V.mau("loi") : V.mau("tx2");
        g.fillText("tốc độ TB " + tbV.toFixed(2), bx, 98);
        g.fillStyle = V.mau("ok"); g.font = "700 12px ui-monospace,monospace";
        g.fillText("f* = " + gbestV.toFixed(4), bx, 122);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 54, padR = 46, padT = 24, padB = 28;
        var w = W2 - padL - padR, h = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Xanh: f tốt nhất (log) · đỏ đứt: tốc độ trung bình của bầy", padL, 15);
        if (lichSu.length > 1) {
          var L = function (v) { return Math.log10(Math.max(1e-6, v)); };
          var lo = 1e9, hi = -1e9;
          lichSu.forEach(function (p) { lo = Math.min(lo, L(p.best)); hi = Math.max(hi, L(p.tb)); });
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (L(v) - lo) / (hi - lo) * h; };
          var YV = function (v) { return padT + h - Math.min(1, v / tt.vMax) * h; };
          veCong(g2, lichSu.map(function (p) { return p.tb; }), X, Y, V.mau("tx3"), 1.2);
          veCong(g2, lichSu.map(function (p) { return p.best; }), X, Y, V.mau("ok"), 2.2);
          veCong(g2, lichSu.map(function (p) { return p.v; }), X, YV, V.mau("loi"), 1.6, [4, 3]);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText("10^" + hi.toFixed(1), padL - 5, padT + 8);
          g2.fillText("10^" + lo.toFixed(1), padL - 5, padT + h);
          g2.textAlign = "left"; g2.fillStyle = V.mau("loi");
          g2.fillText("v_max", padL + w + 5, padT + 8);
          g2.fillText("0", padL + w + 5, padT + h);
        }
      }

      var P = V.phat({
        toiDa: tt.soBuoc, tocDo: 10,
        datLai: datLai, buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () { return "f* = " + gbestV.toFixed(5); }
      });
      function capSo() {
        var d = lichSu.length ? lichSu[lichSu.length - 1] : { v: 0, tb: 0 };
        so.dat([
          ["f tốt nhất", gbestV.toFixed(5)],
          ["f trung bình bầy", d.tb.toFixed(3)],
          ["tốc độ trung bình", d.v.toFixed(3)],
          ["số lần cập nhật", String(dem)]
        ]);
      }
      function lam() { P.datToiDa(tt.soBuoc); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "w — quán tính", min: 0, max: 1.4, buoc: 0.02, giaTri: tt.w,
                  doi: function (v) { tt.w = v; lam(); } }),
        V.truot({ ten: "c₁ — kéo về ký ức RIÊNG", min: 0, max: 4, buoc: 0.1, giaTri: tt.c1,
                  doi: function (v) { tt.c1 = v; lam(); } }),
        V.truot({ ten: "c₂ — kéo về điểm tốt CHUNG", min: 0, max: 4, buoc: 0.1, giaTri: tt.c2,
                  doi: function (v) { tt.c2 = v; lam(); } }),
        V.truot({ ten: "Số hạt", min: 4, max: 60, buoc: 1, giaTri: tt.N,
                  doi: function (v) { tt.N = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        V.danhDau({ ten: "Hiện vệt bay", giaTri: tt.veo,
                    doi: function (v) { tt.veo = v; P.veLai(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[V.mau("loi"), "hạt đang cập nhật"], [V.mau("ba"), "ký ức riêng của mỗi hạt"],
                           [V.mau("ok"), "điểm tốt nhất của cả bầy"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>PSO mô phỏng đàn chim đi tìm thức ăn.</b> Mỗi hạt giữ một <b>vận tốc</b>, và " +
          "vận tốc ấy là tổng của ba lực:<ul>" +
          "<li><b>w · v</b> — <i>quán tính</i>: tiếp tục hướng cũ.</li>" +
          "<li><b>c₁ · (riêng − x)</b> — kéo về <i>chỗ tốt nhất bản thân từng thấy</i>.</li>" +
          "<li><b>c₂ · (chung − x)</b> — kéo về <i>chỗ tốt nhất cả bầy từng thấy</i>.</li></ul>" +
          "Khác biệt cốt lõi so với mọi thứ trước đó trong khoá: <b>PSO nhớ hướng</b>. " +
          "Simulated annealing hay leo đồi luôn quên bước trước; ở đây quán tính khiến hạt " +
          "<b>lướt qua</b> một cực trị cục bộ nông thay vì rơi vào.<br>" +
          "<b>★ Ba cách phá — nhìn đường đỏ (tốc độ trung bình):</b><ul>" +
          "<li><b>w ≥ 1,0</b>: mỗi vòng vận tốc được nhân lên, năng lượng không thoát đi đâu ⇒ " +
          "<b>bầy nổ tung</b>, tốc độ dính trần v_max, các hạt nảy khắp biên. Đây là lý do " +
          "mọi cài đặt thực tế dùng <b>w ≈ 0,7</b> hoặc cho w giảm dần.</li>" +
          "<li><b>c₁ = 0</b> (bỏ ký ức riêng): mọi hạt chỉ còn nghe theo đám đông ⇒ cả bầy " +
          "<b>đâm vào một hố</b> rất nhanh, tốc độ tụt về 0 và f* đứng im. Hội tụ sớm.</li>" +
          "<li><b>c₂ = 0</b> (bỏ ký ức chung): mỗi hạt tìm riêng, không ai bảo ai ⇒ đây là " +
          "<b>đa khởi động</b> của Bài 8, không phải bầy đàn. f* xuống chậm hơn hẳn.</li></ul>" +
          "📌 Đặt PSO cạnh DE ở demo trước: DE lấy bước đi từ <i>khoảng cách giữa các cá thể</i>, " +
          "PSO lấy bước đi từ <i>vận tốc tích luỹ</i>. Cả hai đều là cách tự hiệu chuẩn độ dài bước."
      });
      lam();
    }
  });

  /* ================================================================
     21. Dua bon thuat toan tren cung mot ham
     ================================================================ */
  demo({
    id: "dua-thuat-toan", nhom: "Bầy đàn & tiến hoá", mon: "B17B",
    ten: "Đua bốn thuật toán — cùng hàm, cùng ngân sách đánh giá",
    moTa: "PSO · DE · leo đồi có khởi động lại · tìm kiếm ngẫu nhiên, " +
          "<b>cùng số lần gọi hàm mục tiêu</b>. Đây là cách so sánh công bằng duy nhất.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-17b-bay-dan-tien-hoa">B17B — Bầy đàn & tiến hoá</a>',
    dung: function (host) {
      var W = 560, H = 340, W2 = 560, H2 = 220;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { ngan: 2400, hat: 3, N: 20 };
      var MAU = [V.mau("ac"), "#0f766e", "#b45309", "#94a3b8"];
      var TEN = ["PSO", "DE", "Leo đồi + khởi động lại", "Ngẫu nhiên"];
      var A, lichSu, dem;

      function datLai() {
        var r = V.rng(tt.hat * 23 + 5);
        A = [];
        /* --- 0. PSO --- */
        var pso = { loai: 0, hat: [], gb: null, gbv: 1e9, i: 0 };
        for (var i = 0; i < tt.N; i++) {
          var x = r.khoang(-MIEN, MIEN), y = r.khoang(-MIEN, MIEN), f = fRas(x, y);
          pso.hat.push({ x: x, y: y, vx: r.khoang(-1, 1), vy: r.khoang(-1, 1), px: x, py: y, pv: f });
          if (f < pso.gbv) { pso.gbv = f; pso.gb = [x, y]; }
        }
        /* --- 1. DE --- */
        var de = { loai: 1, pop: [], val: [], i: 0, best: null, bestv: 1e9 };
        for (i = 0; i < tt.N; i++) {
          var p = [r.khoang(-MIEN, MIEN), r.khoang(-MIEN, MIEN)], f2 = fRas(p[0], p[1]);
          de.pop.push(p); de.val.push(f2);
          if (f2 < de.bestv) { de.bestv = f2; de.best = p.slice(); }
        }
        /* --- 2. Leo doi co khoi dong lai --- */
        var ld = { loai: 2, x: r.khoang(-MIEN, MIEN), y: r.khoang(-MIEN, MIEN), b: 0.6,
                   cur: 0, best: null, bestv: 1e9, hong: 0 };
        ld.cur = fRas(ld.x, ld.y); ld.best = [ld.x, ld.y]; ld.bestv = ld.cur;
        /* --- 3. Ngau nhien --- */
        var nx0 = r.khoang(-MIEN, MIEN), ny0 = r.khoang(-MIEN, MIEN);
        var nn = { loai: 3, best: [nx0, ny0], bestv: fRas(nx0, ny0), x: nx0, y: ny0 };

        A = [pso, de, ld, nn];
        A.forEach(function (a) { a.r = V.rng(tt.hat * 97 + a.loai * 7 + 1); a.duong = []; });
        lichSu = []; dem = 0;
        A.forEach(function (a) { a.duong.push(tot(a)); });
      }
      function tot(a) { return a.loai === 0 ? a.gbv : a.bestv; }
      function diem(a) { return a.loai === 0 ? a.gb : a.best; }

      /* MOT buoc = MOI thuat toan tieu dung DUNG MOT lan goi ham muc tieu */
      function buoc() {
        if (dem >= tt.ngan) return false;
        var a, r, i;

        /* PSO */
        a = A[0]; r = a.r; i = a.i % tt.N; a.i++;
        var h = a.hat[i];
        h.vx = 0.72 * h.vx + 1.5 * r() * (h.px - h.x) + 1.5 * r() * (a.gb[0] - h.x);
        h.vy = 0.72 * h.vy + 1.5 * r() * (h.py - h.y) + 1.5 * r() * (a.gb[1] - h.y);
        var sp = Math.hypot(h.vx, h.vy);
        if (sp > 2.5) { h.vx *= 2.5 / sp; h.vy *= 2.5 / sp; }
        h.x = kep(h.x + h.vx); h.y = kep(h.y + h.vy);
        var f = fRas(h.x, h.y);
        if (f < h.pv) { h.pv = f; h.px = h.x; h.py = h.y; }
        if (f < a.gbv) { a.gbv = f; a.gb = [h.x, h.y]; }

        /* DE */
        a = A[1]; r = a.r; i = a.i % tt.N; a.i++;
        var k1, k2, k3;
        do { k1 = Math.floor(r() * tt.N); } while (k1 === i);
        do { k2 = Math.floor(r() * tt.N); } while (k2 === i || k2 === k1);
        do { k3 = Math.floor(r() * tt.N); } while (k3 === i || k3 === k1 || k3 === k2);
        var u = a.pop[i].slice(), bb = Math.floor(r() * 2);
        var v0 = kep(a.pop[k1][0] + 0.7 * (a.pop[k2][0] - a.pop[k3][0]));
        var v1 = kep(a.pop[k1][1] + 0.7 * (a.pop[k2][1] - a.pop[k3][1]));
        if (r() < 0.9 || bb === 0) u[0] = v0;
        if (r() < 0.9 || bb === 1) u[1] = v1;
        var fu = fRas(u[0], u[1]);
        if (fu <= a.val[i]) {
          a.pop[i] = u; a.val[i] = fu;
          if (fu < a.bestv) { a.bestv = fu; a.best = u.slice(); }
        }

        /* Leo doi co khoi dong lai */
        a = A[2]; r = a.r;
        var nx = kep(a.x + r.chuan() * a.b), ny = kep(a.y + r.chuan() * a.b);
        var fn = fRas(nx, ny);
        if (fn < a.cur) { a.x = nx; a.y = ny; a.cur = fn; a.hong = 0; }
        else { a.hong++; }
        if (a.cur < a.bestv) { a.bestv = a.cur; a.best = [a.x, a.y]; }
        if (a.hong > 40) {                      /* kẹt => khoi dong lai */
          a.x = r.khoang(-MIEN, MIEN); a.y = r.khoang(-MIEN, MIEN);
          a.cur = fRas(a.x, a.y); a.hong = 0;
        }

        /* Ngau nhien */
        a = A[3]; r = a.r;
        a.x = r.khoang(-MIEN, MIEN); a.y = r.khoang(-MIEN, MIEN);
        var fr = fRas(a.x, a.y);
        if (fr < a.bestv) { a.bestv = fr; a.best = [a.x, a.y]; }

        dem++;
        if (dem % 10 === 0) A.forEach(function (x) { x.duong.push(tot(x)); });
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = 158, gx = 14, gy = 30, khe = 14;
        A.forEach(function (a, k) {
          var ox = gx + (k % 2) * (S + khe + 108);
          var oy = gy + Math.floor(k / 2) * (S + 36);
          veNen(g, W, H, ox, oy, S);
          var T = toaDo(ox, oy, S);
          g.font = "600 11.5px system-ui"; g.textAlign = "left"; g.fillStyle = MAU[k];
          g.fillText(TEN[k], ox, oy - 8);

          /* cac diem hien tai */
          if (a.loai === 0) a.hat.forEach(function (h) { cham(T.X(h.x), T.Y(h.y), 2.6, "#fff"); });
          else if (a.loai === 1) a.pop.forEach(function (p) { cham(T.X(p[0]), T.Y(p[1]), 2.6, "#fff"); });
          else cham(T.X(a.x), T.Y(a.y), 3.4, "#fff");

          var d = diem(a);
          if (d) cham(T.X(d[0]), T.Y(d[1]), 5, MAU[k]);
          g.font = "700 11px ui-monospace,monospace"; g.fillStyle = MAU[k];
          g.fillText("f* " + tot(a).toFixed(4), ox + S + 8, oy + 16);
          g.font = "10px system-ui"; g.fillStyle = V.mau("tx3");
          g.fillText(a.loai === 2 ? ("kẹt " + a.hong + " lần") : "", ox + S + 8, oy + 32);
        });
        function cham(x, y, rr, m) {
          g.fillStyle = m; g.strokeStyle = V.mau("tx"); g.lineWidth = 1;
          g.beginPath(); g.arc(x, y, rr, 0, 6.2832); g.fill(); g.stroke();
        }
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 58, padR = 128, padT = 24, padB = 30;
        var w = W2 - padL - padR, h = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("f tốt nhất theo số lần gọi hàm (thang log)", padL, 15);
        var n = A[0].duong.length;
        if (n > 1) {
          var L = function (v) { return Math.log10(Math.max(1e-6, v)); };
          var lo = 1e9, hi = -1e9;
          A.forEach(function (a) { a.duong.forEach(function (v) { lo = Math.min(lo, L(v)); hi = Math.max(hi, L(v)); }); });
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (n - 1) * w; };
          var Y = function (v) { return padT + h - (L(v) - lo) / (hi - lo) * h; };
          A.forEach(function (a, k) { veCong(g2, a.duong, X, Y, MAU[k], k === 3 ? 1.2 : 2); });
          g2.font = "10px system-ui"; g2.textAlign = "right"; g2.fillStyle = V.mau("tx3");
          g2.fillText("10^" + hi.toFixed(1), padL - 5, padT + 8);
          g2.fillText("10^" + lo.toFixed(1), padL - 5, padT + h);
          /* chu thich ben phai, xep theo thu hang */
          var xh = A.map(function (a, k) { return { k: k, v: tot(a) }; });
          xh.sort(function (p, q) { return p.v - q.v; });
          g2.textAlign = "left"; g2.font = "11px system-ui";
          xh.forEach(function (m, hang) {
            g2.fillStyle = MAU[m.k];
            g2.fillRect(padL + w + 12, padT + hang * 20 + 2, 10, 3);
            g2.fillText((hang + 1) + ". " + TEN[m.k].split(" ")[0] + " " + m.v.toFixed(3),
                        padL + w + 26, padT + hang * 20 + 7);
          });
        }
      }

      var P = V.phat({
        toiDa: tt.ngan, tocDo: 20,
        datLai: datLai, buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () {
          if (!A) return "";
          var m = A.map(function (a, k) { return TEN[k].split(" ")[0] + " " + tot(a).toFixed(3); });
          return m.join(" · ");
        }
      });
      function capSo() {
        so.dat(A.map(function (a, k) { return [TEN[k], tot(a).toFixed(5)]; }));
      }
      function lam() { P.datToiDa(tt.ngan); P.datLai(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Ngân sách (số lần gọi hàm mỗi thuật toán)", min: 200, max: 6000, buoc: 200,
                  giaTri: tt.ngan, doi: function (v) { tt.ngan = v; lam(); } }),
        V.truot({ ten: "Cỡ quần thể (PSO & DE)", min: 4, max: 50, buoc: 1, giaTri: tt.N,
                  doi: function (v) { tt.N = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Cả bốn thuật toán tiêu đúng một lần gọi <code>f</code> mỗi bước.</b> " +
          "Đó là điều kiện bắt buộc của một phép so sánh có nghĩa (Bài 4): so theo " +
          "<i>thời gian đồng hồ</i> thì bạn đang so cả chất lượng cài đặt, còn so theo " +
          "<i>số vòng lặp</i> thì thuật toán nào gọi <code>f</code> nhiều lần mỗi vòng sẽ được lợi oan.<br>" +
          "<b>★ Ba điều đáng đọc trên biểu đồ:</b><ul>" +
          "<li><b>Tìm kiếm ngẫu nhiên không hề vô dụng.</b> Nó xuống rất nhanh ở vài trăm lần gọi " +
          "đầu, rồi đứng. Mọi thuật toán của bạn <b>phải vượt được đường xám này</b> — " +
          "nếu không, bạn đang trả tiền cho sự phức tạp mà không mua được gì. " +
          "Đây chính là vai trò của <i>nghiệm cơ sở</i> ở Bài 20 bước ④.</li>" +
          "<li><b>Leo đồi có khởi động lại</b> (Bài 12) xuống nhanh nhất lúc đầu, vì nó " +
          "khai thác cục bộ rất hiệu quả. Nhưng nó <b>mất trí nhớ</b> sau mỗi lần khởi động lại: " +
          "đếm số lần kẹt ở panel của nó.</li>" +
          "<li><b>PSO và DE</b> chậm hơn ở giai đoạn đầu — chúng phải nuôi cả một quần thể " +
          "trước khi quần thể ấy trở nên hữu ích. Lợi thế chỉ hiện ra khi <b>ngân sách đủ lớn</b>. " +
          "Kéo ngân sách xuống 400 rồi lên 6000 và xem thứ hạng đảo lộn.</li></ul>" +
          "⚠️ <b>Đừng rút ra kết luận tổng quát từ một hạt giống.</b> Đổi hạt giống vài lần: " +
          "thứ hạng thay đổi. Muốn kết luận thật thì phải chạy hàng chục hạt giống và so " +
          "trung bình ± 2·SE — đúng như Bài 4 §3."
      });
      lam();
    }
  });
})();
