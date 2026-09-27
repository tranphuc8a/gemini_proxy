/* =====================================================================
   Nhom 2 — Dung nghiem
   greedy-chi-so (b.5) · gia-mo-lambda (b.6) · chen-va-tiet-kiem (b.7)
   · grasp-rcl (b.8)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ---- dung chung: sinh diem tren luoi, khoang cach Manhattan ---- */
  function sinhDiem(n, hat, o) {
    var r = V.rng(hat), ds = [], i;
    for (i = 0; i < n; i++) {
      if (o === "cum") {                       /* 3 cum */
        var c = i % 3, cx = [0.22, 0.75, 0.5][c], cy = [0.25, 0.3, 0.8][c];
        ds.push({ x: Math.max(0.03, Math.min(0.97, cx + r.chuan() * 0.09)),
                  y: Math.max(0.03, Math.min(0.97, cy + r.chuan() * 0.09)) });
      } else {
        ds.push({ x: r.khoang(0.04, 0.96), y: r.khoang(0.04, 0.96) });
      }
    }
    return ds;
  }
  function dManhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function daiTour(q, ds, kho) {
    if (!q.length) return 0;
    var s = dManhattan(kho, ds[q[0]]), i;
    for (i = 1; i < q.length; i++) s += dManhattan(ds[q[i - 1]], ds[q[i]]);
    return s + dManhattan(ds[q[q.length - 1]], kho);
  }

  /* ================================================================
     4. Greedy va bon ho chi so
     ================================================================ */
  demo({
    id: "greedy-chi-so", nhom: "Dựng nghiệm", mon: "B05",
    ten: "Greedy — bốn họ chỉ số, bốn kết quả khác nhau",
    moTa: "Greedy là <b>một cỗ máy có đúng một chỗ cắm</b>: chỉ số. " +
          "Đổi chỉ số, đổi hoàn toàn nghiệm. Xem chỉ số nào thắng trên dữ liệu nào.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-05-greedy">B05 — Greedy</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 14, W: 10, phanBo: "lech", hat: 5, hienVD: true };

      /* vi du kinh dien cua bai 5 §4.3 */
      var VD = [{ t: "B", p: 50, w: 5 }, { t: "D", p: 30, w: 3 }, { t: "E", p: 20, w: 2 },
                { t: "C", p: 40, w: 5 }, { t: "A", p: 60, w: 10 }];

      function sinhMon() {
        if (tt.hienVD) return VD.map(function (m) { return { t: m.t, p: m.p, w: m.w }; });
        var r = V.rng(tt.hat), ds = [], i;
        for (i = 0; i < tt.n; i++) {
          var w, p;
          if (tt.phanBo === "deu") { w = Math.round(r.khoang(1, 6)); p = Math.round(r.khoang(10, 60)); }
          else if (tt.phanBo === "lech") {      /* chi phi chenh lech lon */
            w = Math.round(Math.pow(10, r.khoang(0, 1.3)));
            p = Math.round(r.khoang(5, 30) + w * r.khoang(1, 8));
          } else {                              /* tuong quan: p ~ w */
            w = Math.round(r.khoang(1, 10)); p = Math.round(w * 6 + r.khoang(-4, 4));
          }
          ds.push({ t: "m" + (i + 1), p: Math.max(1, p), w: Math.max(1, w) });
        }
        return ds;
      }
      var mon = sinhMon();

      var CHI_SO = [
        { v: "loi", t: "① Lợi ích thuần  p", f: function (m) { return m.p; }, mau: "#0f766e" },
        { v: "chi", t: "② Chi phí thuần  −c", f: function (m) { return -m.w; }, mau: "#b45309" },
        { v: "ti",  t: "③ Tỉ số  p/c  (Dantzig)", f: function (m) { return m.p / m.w; }, mau: "#5b4bd6" },
        { v: "ngau", t: "④ Ngẫu nhiên (đường cơ sở)", f: null, mau: "#8b847a" }
      ];

      function chayGreedy(ck) {
        var ds = mon.map(function (m, i) { return { m: m, i: i }; });
        if (ck.v === "ngau") {
          var r = V.rng(tt.hat * 31 + 7);
          ds.forEach(function (d) { d.k = r(); });
        } else {
          ds.forEach(function (d) { d.k = ck.f(d.m); });
        }
        ds.sort(function (a, b) { return b.k - a.k; });
        var con = tt.hienVD ? 10 : tt.W, tong = 0, lay = [];
        ds.forEach(function (d) {
          if (d.m.w <= con) { con -= d.m.w; tong += d.m.p; lay.push(d.i); }
        });
        return { tong: tong, lay: lay, dung: (tt.hienVD ? 10 : tt.W) - con };
      }

      /* toi uu that bang quy hoach dong (de biet greedy cach bao xa) */
      function toiUu() {
        var Wc = tt.hienVD ? 10 : tt.W;
        var dp = new Array(Wc + 1).fill(0), i, w;
        for (i = 0; i < mon.length; i++) {
          for (w = Wc; w >= mon[i].w; w--) {
            dp[w] = Math.max(dp[w], dp[w - mon[i].w] + mon[i].p);
          }
        }
        return dp[Wc];
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var opt = toiUu();
        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Cái túi — sức chứa W = " + (tt.hienVD ? 10 : tt.W) +
                   ", " + mon.length + " món. Tối ưu thật (DP) = " + opt, 14, 18);

        var x0 = 14, y0 = 34, bw = W - 150, hh = 34;
        CHI_SO.forEach(function (ck, i) {
          var kq = chayGreedy(ck);
          var y = y0 + i * (hh + 22);
          var tyLe = opt > 0 ? kq.tong / opt : 0;
          g.fillStyle = V.mau("surf2"); g.fillRect(x0, y, bw, hh);
          g.fillStyle = ck.mau; g.fillRect(x0, y, Math.max(2, bw * tyLe), hh);
          g.fillStyle = "#fff"; g.font = "600 11.5px system-ui";
          g.fillText(ck.t, x0 + 9, y + hh / 2 + 4);
          g.fillStyle = V.mau("tx"); g.font = "700 13px ui-monospace, monospace";
          g.fillText(String(kq.tong), x0 + bw + 12, y + hh / 2 + 5);
          g.fillStyle = tyLe > 0.999 ? "#0f766e" : V.mau("tx3");
          g.font = "11px system-ui";
          g.fillText(tyLe > 0.999 ? "= tối ưu" : (tyLe * 100).toFixed(1) + "% tối ưu",
                     x0 + bw + 62, y + hh / 2 + 5);
          /* mon da lay */
          g.fillStyle = V.mau("tx3"); g.font = "10.5px ui-monospace, monospace";
          var ten = kq.lay.map(function (k) { return mon[k].t; }).join(" ");
          g.fillText("lấy: " + (ten || "(không gì)") + "   · dùng " + kq.dung,
                     x0 + 2, y + hh + 14);
        });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Danh sách món (sắp theo tỉ số p/c giảm dần):", 14, 18);

        var ds = mon.map(function (m) { return m; }).slice()
          .sort(function (a, b) { return b.p / b.w - a.p / a.w; });

        var cot = [14, 70, 130, 190, 265];
        g2.fillStyle = V.mau("tx3"); g2.font = "600 10.5px system-ui";
        ["món", "p (lợi ích)", "c (chi phí)", "p/c", ""].forEach(function (t, i) {
          g2.fillText(t, cot[i], 36);
        });
        ds.slice(0, 10).forEach(function (m, i) {
          var y = 54 + i * 17;
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px ui-monospace, monospace";
          g2.fillText(m.t, cot[0], y);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px ui-monospace, monospace";
          g2.fillText(String(m.p), cot[1], y);
          g2.fillText(String(m.w), cot[2], y);
          g2.fillStyle = "#5b4bd6"; g2.font = "600 11px ui-monospace, monospace";
          g2.fillText((m.p / m.w).toFixed(2), cot[3], y);
          /* thanh ti so */
          var maxTi = ds[0].p / ds[0].w;
          g2.fillStyle = "#5b4bd6"; g2.globalAlpha = 0.28;
          g2.fillRect(cot[4], y - 8, (m.p / m.w) / maxTi * 260, 10);
          g2.globalAlpha = 1;
        });
        if (ds.length > 10) {
          g2.fillStyle = V.mau("tx3"); g2.font = "italic 10.5px system-ui";
          g2.fillText("… và " + (ds.length - 10) + " món nữa", cot[0], 54 + 10 * 17);
        }
      }

      function veHet() { mon = sinhMon(); ve(); ve2(); }

      var dk = [
        V.danhDau({ ten: "Dùng ví dụ kinh điển của bài 5 (B,D,E,C,A · W=10)",
                    giaTri: tt.hienVD, doi: function (v) { tt.hienVD = v; veHet(); } }),
        V.chon({ ten: "Phân bố dữ liệu (khi tự sinh)", giaTri: tt.phanBo,
                 muc: [{ v: "deu", t: "Chi phí gần bằng nhau" },
                       { v: "lech", t: "Chi phí chênh lệch lớn" },
                       { v: "tuongquan", t: "p tương quan chặt với c" }],
                 doi: function (v) { tt.phanBo = v; veHet(); } }),
        V.truot({ ten: "Số món", min: 5, max: 30, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.truot({ ten: "Sức chứa W", min: 5, max: 40, buoc: 1, giaTri: tt.W,
                  doi: function (v) { tt.W = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Cùng một thuật toán greedy, chỉ đổi CHỈ SỐ — bốn kết quả khác nhau.</b> " +
          "Cột số bên phải là giá trị thu được; mốc so sánh là nghiệm tối ưu thật tính bằng " +
          "quy hoạch động.<ul>" +
          "<li><b>Bật ví dụ kinh điển</b> (mặc định): greedy tỉ số lấy B→D→E = 10 kg, được <b>100</b> " +
          "— và ở đây nó <b>tình cờ tối ưu</b>. Đừng rút ra kết luận sai từ một ví dụ may mắn.</li>" +
          "<li><b>Tắt ví dụ, chọn \"Chi phí chênh lệch lớn\":</b> chỉ số <b>① lợi ích thuần sụp đổ</b> " +
          "— nó vơ lấy món đắt nhất rồi hết chỗ. Đây đúng là chỗ hỏng mà bài 5 §3.1 cảnh báo.</li>" +
          "<li><b>Chọn \"p tương quan chặt với c\":</b> bây giờ mọi tỉ số gần bằng nhau, nên " +
          "<b>tỉ số mất hết lợi thế</b> và cả bốn chỉ số về gần nhau. " +
          "★ <b>Chỉ số chỉ mạnh khi nó phân biệt được các ứng viên.</b></li>" +
          "<li>Kéo hạt giống vài lần: bạn sẽ thấy <b>không chỉ số nào thắng mọi lần</b>. " +
          "Đó là lý do bài 5 bắt bạn thử <b>cả bốn</b> rồi mới chọn, thay vì mặc định tỉ số.</li></ul>" +
          "<b>★ Vì sao tỉ số là mặc định — và vì sao nó không đủ:</b> " +
          "<b>định lý Dantzig</b> nói greedy tỉ số là <b>tối ưu</b> cho cái túi <b>phân số</b> " +
          "(chứng minh bằng đổi chỗ: chuyển ε cân nặng từ món tỉ số thấp sang món tỉ số cao " +
          "luôn cho <code>Δf = ε(pᵢ/wᵢ − p_k/w_k) ≥ 0</code>). " +
          "⚠️ Nhưng bước \"chuyển một lượng ε\" <b>đòi hỏi cắt món ra được</b> — " +
          "với cái túi 0/1 thì không, nên chứng minh hỏng và greedy chỉ còn là heuristic.<br><br>" +
          "<b>⇒ Họ chỉ số thứ tư — tiếc nuối <code>p⁽¹⁾ − p⁽²⁾</code> — không hiện ở đây vì nó cần " +
          "bài toán có \"vị trí\" (xem demo Chèn & tiết kiệm). Trong định tuyến nó thường " +
          "thắng tỉ số 2–5 %.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     5. Gia mo (Lagrange) — quet lambda
     ================================================================ */
  demo({
    id: "gia-mo-lambda", nhom: "Dựng nghiệm", mon: "B06",
    ten: "Giá mờ λ — tỉ giá quy đổi giữa hai tài nguyên",
    moTa: "Khi lợi ích và chi phí <b>khác đơn vị</b>, λ là tỉ giá. " +
          "Quét λ và nhìn thấy đường cong — cùng chỗ nó gãy.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-06-gia-mo">B06 — Giá mờ</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 170;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { lam: 6, n: 40, ngan: 60, hat: 11 };

      function sinh() {
        var r = V.rng(tt.hat), ds = [], i;
        for (i = 0; i < tt.n; i++) {
          var w = r.khoang(1, 10);
          ds.push({ p: r.khoang(5, 55) + w * 2, w: w });
        }
        return ds;
      }
      var mon = sinh();

      /* greedy theo gia tri rong p - lambda*w, chi lay cai duong, ton trong ngan sach */
      function chay(lam) {
        var ds = mon.map(function (m, i) { return { m: m, i: i, v: m.p - lam * m.w }; });
        ds.sort(function (a, b) { return b.v - a.v; });
        var con = tt.ngan, p = 0, w = 0, lay = [];
        ds.forEach(function (d) {
          if (d.v > 0 && d.m.w <= con) { con -= d.m.w; p += d.m.p; w += d.m.w; lay.push(d.i); }
        });
        return { p: p, w: w, n: lay.length, lay: lay };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 50, padR = 52, padT = 18, padB = 34;
        var w = W - padL - padR, h = H - padT - padB;
        var lamMax = 14;

        /* quet lambda */
        var pts = [], i;
        for (i = 0; i <= 140; i++) {
          var L = i / 140 * lamMax;
          pts.push({ L: L, k: chay(L) });
        }
        var pMax = Math.max.apply(null, pts.map(function (q) { return q.k.p; })) || 1;

        var X = function (L) { return padL + L / lamMax * w; };
        var Yp = function (p) { return padT + h - p / pMax * h; };
        var Yw = function (x) { return padT + h - x / tt.ngan * h; };

        /* luoi */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui";
        for (i = 0; i <= 4; i++) {
          var yy = padT + h - i / 4 * h;
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.textAlign = "right";
          g.fillText((pMax * i / 4).toFixed(0), padL - 6, yy + 3);
          g.textAlign = "left";
          g.fillText((tt.ngan * i / 4).toFixed(0), padL + w + 6, yy + 3);
        }
        g.textAlign = "center";
        for (i = 0; i <= 7; i++) {
          g.fillText((i * 2).toFixed(0), X(i * 2), padT + h + 15);
        }
        g.fillText("λ — giá mờ của một đơn vị tài nguyên", padL + w / 2, padT + h + 29);

        /* duong loi ich */
        g.strokeStyle = "#5b4bd6"; g.lineWidth = 2.4;
        g.beginPath();
        pts.forEach(function (q, k) {
          var yy = Yp(q.k.p); if (!k) g.moveTo(X(q.L), yy); else g.lineTo(X(q.L), yy);
        });
        g.stroke();

        /* duong tai nguyen dung */
        g.strokeStyle = "#b45309"; g.lineWidth = 2; g.setLineDash([5, 3]);
        g.beginPath();
        pts.forEach(function (q, k) {
          var yy = Yw(q.k.w); if (!k) g.moveTo(X(q.L), yy); else g.lineTo(X(q.L), yy);
        });
        g.stroke(); g.setLineDash([]);

        /* vach ngan sach */
        g.strokeStyle = V.mau("loi"); g.lineWidth = 1.2; g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(padL, Yw(tt.ngan)); g.lineTo(padL + w, Yw(tt.ngan)); g.stroke();
        g.setLineDash([]);

        /* lambda hien tai */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(X(tt.lam), padT); g.lineTo(X(tt.lam), padT + h); g.stroke();
        var cur = chay(tt.lam);
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X(tt.lam), Yp(cur.p), 4.5, 0, 6.2832); g.fill();

        /* chu giai */
        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = "#5b4bd6"; g.fillText("── lợi ích thu được (trục trái)", padL + 8, padT + 12);
        g.fillStyle = "#b45309"; g.fillText("-- tài nguyên đã dùng (trục phải)", padL + 8, padT + 26);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var cur = chay(tt.lam);
        /* tim lambda "vua du" — lon nhat ma van dung het gan ngan sach */
        var tot = null, i;
        for (i = 0; i <= 280; i++) {
          var L = i / 280 * 14, k = chay(L);
          if (k.w <= tt.ngan && (!tot || k.p > tot.p)) tot = { L: L, p: k.p, w: k.w, n: k.n };
        }

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Tại λ = " + tt.lam.toFixed(2) + " :", 14, 20);

        var dong = [
          ["Số món nhận", cur.n + " / " + tt.n],
          ["Tài nguyên dùng", cur.w.toFixed(1) + " / " + tt.ngan +
             (cur.w > tt.ngan ? "  ⚠ VƯỢT NGÂN SÁCH" : "")],
          ["Lợi ích thu được", cur.p.toFixed(1)],
          ["λ tốt nhất (quét)", tot ? tot.L.toFixed(2) + "  →  lợi ích " + tot.p.toFixed(1) : "—"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i2) {
          var y = 42 + i2 * 19;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = d[1].indexOf("VƯỢT") >= 0 ? V.mau("loi") : V.mau("tx");
          g2.font = "600 11.5px ui-monospace, monospace";
          g2.fillText(d[1], 190, y);
          g2.font = "11.5px system-ui";
        });

        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ λ quá nhỏ: vơ hết, vượt ngân sách. λ quá lớn: bỏ cả món đáng lấy.",
                    14, H2 - 26);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Đúng λ là chỗ đường cam vừa chạm vạch ngân sách mà đường tím còn cao nhất.",
                    14, H2 - 10);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "λ — giá mờ", min: 0, max: 14, buoc: 0.1, giaTri: tt.lam,
                  doi: function (v) { tt.lam = v; veHet(); } }),
        V.truot({ ten: "Ngân sách tài nguyên", min: 15, max: 140, buoc: 5, giaTri: tt.ngan,
                  doi: function (v) { tt.ngan = v; veHet(); } }),
        V.truot({ ten: "Số ứng viên", min: 10, max: 80, buoc: 5, giaTri: tt.n,
                  doi: function (v) { tt.n = v; mon = sinh(); veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; mon = sinh(); veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Vấn đề λ giải quyết:</b> bạn có <b>lợi ích</b> tính bằng điểm và <b>chi phí</b> " +
          "tính bằng phút. Không cộng trừ được với nhau. λ là <b>tỉ giá quy đổi</b>: " +
          "giá trị ròng của ứng viên j là <code>v_j = p_j − λ·c_j</code>, và giờ mọi thứ " +
          "cùng một đơn vị.<ul>" +
          "<li><b>Kéo λ về 0:</b> mọi món đều có giá trị ròng dương → thuật toán vơ tất → " +
          "<b>vượt ngân sách</b> (đường cam vọt qua vạch đỏ).</li>" +
          "<li><b>Kéo λ lên cao:</b> hầu hết món thành âm → bị loại → tài nguyên thừa mứa " +
          "nhưng lợi ích thấp. <b>Bạn đang trả giá quá đắt cho một tài nguyên rẻ.</b></li>" +
          "<li>★ <b>Điểm ngọt</b> là λ nhỏ nhất mà vẫn vừa khít ngân sách. " +
          "Dòng \"λ tốt nhất (quét)\" ở bảng dưới là kết quả quét toàn dải — " +
          "và <b>đây chính là cách ước lượng λ rẻ nhất trong phòng thi</b>: " +
          "quét 20–30 giá trị, lấy cái tốt nhất, xong.</li></ul>" +
          "<b>★ Ý nghĩa kinh tế của λ — phần đắt giá nhất của bài 6:</b> λ ở điểm tối ưu " +
          "chính là <b>giá trị biên của một đơn vị tài nguyên</b>. Nếu λ* = 6, thì thêm một " +
          "đơn vị tài nguyên đáng giá khoảng 6 điểm. " +
          "⇒ Nó trả lời trực tiếp câu <b>\"có nên mua thêm xe / thuê thêm người không?\"</b> " +
          "— so λ* với giá thật ngoài thị trường.<br><br>" +
          "⚠️ <b>Cạm bẫy:</b> λ <b>không phải hằng số của bài toán</b> — nó phụ thuộc ngân sách. " +
          "Kéo thanh \"Ngân sách\" và xem λ tốt nhất đổi theo. Ai hard-code λ một lần rồi " +
          "dùng cho mọi kích thước dữ liệu sẽ sai ở đúng chỗ khó phát hiện nhất."
      });
      veHet();
    }
  });

  /* ================================================================
     6. Chen, tiec nuoi va Clarke-Wright
     ================================================================ */
  demo({
    id: "chen-va-tiet-kiem", nhom: "Dựng nghiệm", mon: "B07",
    ten: "Chèn · tiếc nuối · tiết kiệm Clarke–Wright",
    moTa: "Ba họ heuristic dựng tuyến, chạy thật trên cùng bộ điểm. " +
          "Dữ liệu <b>đều</b> hay <b>gom cụm</b> đổi hẳn thứ hạng.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-07-chen-gom-cum">B07 — Chèn & gom cụm</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 150;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 18, pp: "chen", phanBo: "deu", hat: 4 };
      var KHO = { x: 0.5, y: 0.5 };
      var ds = sinhDiem(tt.n, tt.hat, tt.phanBo);

      /* --- lang gieng gan nhat --- */
      function nearest() {
        var chua = ds.map(function (_, i) { return i; }), q = [], cur = KHO;
        while (chua.length) {
          var b = 0, bd = Infinity;
          chua.forEach(function (i, k) {
            var d = dManhattan(cur, ds[i]); if (d < bd) { bd = d; b = k; }
          });
          var j = chua.splice(b, 1)[0]; q.push(j); cur = ds[j];
        }
        return q;
      }

      /* --- chen re nhat --- */
      function chen(dungTiecNuoi) {
        var chua = ds.map(function (_, i) { return i; });
        /* bat dau bang diem xa kho nhat */
        var xa = chua.reduce(function (a, b) {
          return dManhattan(KHO, ds[b]) > dManhattan(KHO, ds[a]) ? b : a;
        });
        var q = [xa]; chua.splice(chua.indexOf(xa), 1);

        function chiPhiChen(j, viTri) {
          var a = viTri === 0 ? KHO : ds[q[viTri - 1]];
          var b = viTri === q.length ? KHO : ds[q[viTri]];
          return dManhattan(a, ds[j]) + dManhattan(ds[j], b) - dManhattan(a, b);
        }
        while (chua.length) {
          var tot = null;
          chua.forEach(function (j) {
            var c1 = Infinity, c2 = Infinity, v1 = 0, k;
            for (k = 0; k <= q.length; k++) {
              var c = chiPhiChen(j, k);
              if (c < c1) { c2 = c1; c1 = c; v1 = k; } else if (c < c2) { c2 = c; }
            }
            /* tiec nuoi = chenh lech giua cho tot nhat va tot nhi */
            var khoa = dungTiecNuoi ? -(c2 - c1) : c1;
            if (!tot || khoa < tot.khoa) tot = { j: j, v: v1, khoa: khoa };
          });
          q.splice(tot.v, 0, tot.j);
          chua.splice(chua.indexOf(tot.j), 1);
        }
        return q;
      }

      /* --- Clarke-Wright savings (mot xe => ghep dan thanh mot tuyen) --- */
      function clarkeWright() {
        var tuyen = ds.map(function (_, i) { return [i]; });
        var sv = [], i, j;
        for (i = 0; i < ds.length; i++) {
          for (j = i + 1; j < ds.length; j++) {
            sv.push({ i: i, j: j,
                      s: dManhattan(KHO, ds[i]) + dManhattan(KHO, ds[j]) - dManhattan(ds[i], ds[j]) });
          }
        }
        sv.sort(function (a, b) { return b.s - a.s; });
        function timTuyen(x) {
          for (var k = 0; k < tuyen.length; k++) if (tuyen[k].indexOf(x) >= 0) return k;
          return -1;
        }
        sv.forEach(function (e) {
          var a = timTuyen(e.i), b = timTuyen(e.j);
          if (a < 0 || b < 0 || a === b) return;
          var ta = tuyen[a], tb = tuyen[b];
          /* chi ghep khi ca hai la DAU MUT cua tuyen cua minh */
          var ai = ta[ta.length - 1] === e.i ? "cuoi" : (ta[0] === e.i ? "dau" : null);
          var bi = tb[0] === e.j ? "dau" : (tb[tb.length - 1] === e.j ? "cuoi" : null);
          if (!ai || !bi) return;
          var moi;
          if (ai === "cuoi" && bi === "dau") moi = ta.concat(tb);
          else if (ai === "cuoi" && bi === "cuoi") moi = ta.concat(tb.slice().reverse());
          else if (ai === "dau" && bi === "cuoi") moi = tb.concat(ta);
          else moi = ta.slice().reverse().concat(tb);
          tuyen[a] = moi; tuyen.splice(b, 1);
        });
        return tuyen.reduce(function (x, y) { return x.concat(y); }, []);
      }

      var PP = {
        gan: { t: "Láng giềng gần nhất", f: nearest, mau: "#b45309" },
        chen: { t: "Chèn rẻ nhất", f: function () { return chen(false); }, mau: "#5b4bd6" },
        tiec: { t: "Chèn theo tiếc nuối", f: function () { return chen(true); }, mau: "#0f766e" },
        cw: { t: "Tiết kiệm Clarke–Wright", f: clarkeWright, mau: "#9d174d" }
      };

      function ve() {
        g.clearRect(0, 0, W, H);
        /* chua cho tieu de o tren: tru them 26px roi day khung xuong */
        var S = Math.min(W - 20, H - 46), ox = (W - S) / 2, oy = 30;
        var X = function (x) { return ox + x * S; }, Y = function (y) { return oy + y * S; };

        g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
        g.strokeRect(ox, oy, S, S);

        var q = PP[tt.pp].f();
        /* tuyen */
        g.strokeStyle = PP[tt.pp].mau; g.lineWidth = 1.8; g.globalAlpha = 0.85;
        g.beginPath();
        g.moveTo(X(KHO.x), Y(KHO.y));
        q.forEach(function (i) { g.lineTo(X(ds[i].x), Y(ds[i].y)); });
        g.lineTo(X(KHO.x), Y(KHO.y));
        g.stroke(); g.globalAlpha = 1;

        /* diem */
        ds.forEach(function (p, i) {
          g.fillStyle = PP[tt.pp].mau;
          g.beginPath(); g.arc(X(p.x), Y(p.y), 4.5, 0, 6.2832); g.fill();
        });
        /* kho */
        g.fillStyle = V.mau("tx");
        g.beginPath(); g.arc(X(KHO.x), Y(KHO.y), 7, 0, 6.2832); g.fill();
        g.fillStyle = "#fff"; g.font = "700 9px system-ui"; g.textAlign = "center";
        g.fillText("K", X(KHO.x), Y(KHO.y) + 3);

        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText(PP[tt.pp].t + " — dài " + daiTour(q, ds, KHO).toFixed(3), ox + 4, oy - 4);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("So sánh trên CÙNG bộ điểm (" + tt.n + " điểm, " +
                    (tt.phanBo === "cum" ? "gom cụm" : "rải đều") + "):", 14, 20);

        var kq = Object.keys(PP).map(function (k) {
          return { k: k, t: PP[k].t, d: daiTour(PP[k].f(), ds, KHO), mau: PP[k].mau };
        });
        var best = Math.min.apply(null, kq.map(function (q) { return q.d; }));
        var worst = Math.max.apply(null, kq.map(function (q) { return q.d; }));

        kq.forEach(function (q, i) {
          var y = 36 + i * 26;
          var tyLe = worst > 0 ? q.d / worst : 0;
          g2.fillStyle = V.mau("surf2"); g2.fillRect(150, y, 300, 18);
          g2.fillStyle = q.mau; g2.fillRect(150, y, Math.max(2, 300 * tyLe), 18);
          g2.fillStyle = q.k === tt.pp ? V.mau("ac") : V.mau("tx2");
          g2.font = (q.k === tt.pp ? "700 " : "") + "11.5px system-ui";
          g2.fillText(q.t, 14, y + 13);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11.5px ui-monospace, monospace";
          g2.fillText(q.d.toFixed(3), 458, y + 13);
          if (Math.abs(q.d - best) < 1e-9) {
            g2.fillStyle = "#0f766e"; g2.font = "700 10.5px system-ui";
            g2.fillText("tốt nhất", 512, y + 13);
          }
        });
      }

      function lam() { ds = sinhDiem(tt.n, tt.hat, tt.phanBo); ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Phương pháp hiển thị", giaTri: tt.pp,
                 muc: Object.keys(PP).map(function (k) { return { v: k, t: PP[k].t }; }),
                 doi: function (v) { tt.pp = v; ve(); ve2(); } }),
        V.chon({ ten: "Phân bố điểm", giaTri: tt.phanBo,
                 muc: [{ v: "deu", t: "Rải đều" }, { v: "cum", t: "Gom cụm (3 cụm)" }],
                 doi: function (v) { tt.phanBo = v; lam(); } }),
        V.truot({ ten: "Số điểm", min: 6, max: 40, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Bốn heuristic dựng tuyến, chạy thật, khoảng cách Manhattan.</b> " +
          "Đổi \"Phương pháp hiển thị\" để xem hình dạng tuyến; bảng dưới luôn so cả bốn.<ul>" +
          "<li><b>Láng giềng gần nhất</b> là greedy chi phí thuần. Nhìn kỹ: nó đi rất ngoan " +
          "lúc đầu rồi <b>phải quay ngược xa tít về cuối</b> để nhặt các điểm bị bỏ rơi. " +
          "Đó là chỗ hỏng cố hữu của nó — <b>greedy không biết hối hận</b>.</li>" +
          "<li><b>Chèn rẻ nhất</b> xây tuyến từ ngoài vào, mỗi bước đặt điểm vào <b>khe rẻ nhất</b>. " +
          "Tuyến thường tròn trịa hơn hẳn và không có cú quay đầu cuối cùng.</li>" +
          "<li>★ <b>Chèn theo tiếc nuối</b> — khác biệt duy nhất: thay vì chọn điểm có chỗ chèn " +
          "rẻ nhất, nó chọn điểm có <b>chênh lệch lớn nhất giữa chỗ tốt nhất và tốt nhì</b> " +
          "(<code>c⁽²⁾ − c⁽¹⁾</code>). Nghĩa là <b>ưu tiên món khó chiều</b> — món mà nếu không " +
          "xếp ngay bây giờ thì sau này sẽ rất đắt. Thường thắng chèn thường 2–5 %.</li>" +
          "<li><b>Clarke–Wright</b> đi hướng ngược hẳn: bắt đầu bằng <b>n tuyến con riêng lẻ</b> " +
          "(kho → i → kho), rồi ghép hai tuyến theo thứ tự <b>tiết kiệm</b> " +
          "<code>s(i,j) = d(K,i) + d(K,j) − d(i,j)</code> giảm dần.</li></ul>" +
          "<b>★ Thí nghiệm bắt buộc — đổi \"Phân bố điểm\" sang \"Gom cụm\":</b> thứ hạng " +
          "<b>đổi</b>. Trên dữ liệu gom cụm, tiết kiệm Clarke–Wright phát huy vì nó ghép được " +
          "các điểm trong cùng cụm trước; trên dữ liệu rải đều thì chèn/tiếc nuối thường nhỉnh hơn. " +
          "⇒ <b>Không có heuristic dựng nghiệm nào thắng mọi loại dữ liệu</b> — và đó là lý do " +
          "bài 7 bắt bạn thử trên <b>hai</b> loại dữ liệu chứ không phải một."
      });
      lam();
    }
  });

  /* ================================================================
     7. GRASP va RCL — tai hien loi "kieu A thua greedy 16%"
     ================================================================ */
  demo({
    id: "grasp-rcl", nhom: "Dựng nghiệm", mon: "B08",
    ten: "GRASP — ngẫu nhiên hoá có kiểm soát (và cách nó hỏng)",
    moTa: "Vì sao \"chọn hơi tệ\" lại tốt hơn. Hai kiểu RCL — và " +
          "<b>tái hiện được lỗi khiến GRASP thua cả greedy</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-08-grasp">B08 — GRASP</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { kieu: "B", alpha: 0.25, k: 3, lan: 60, lech: true, hat: 9 };

      /* Bai toan: cai tui — chon mon sao cho tong gia tri rong lon nhat,
         rang buoc suc chua SUC. Co rang buoc nen greedy KHONG toi uu,
         va do la cho GRASP co the thang.
         Khi "lech": vai ung vien co gia tri rong AM rat lon. */
      /* SUC va dai can nang chon sao cho bai toan CO BAY DONG GOI —
         greedy ti so khong con toi uu, nen GRASP moi co cho thang. */
      var SUC = 30;
      function sinhUV(hat) {
        var r = V.rng(hat), ds = [], i;
        for (i = 0; i < 22; i++) {
          var w = Math.round(r.khoang(5, 14));
          var v = r.khoang(10, 60);
          if (tt.lech && i % 7 === 3) v = -r.khoang(200, 600);
          ds.push({ v: v, w: w });
        }
        return ds;
      }

      /* chi so greedy = ti so gia tri rong tren can nang */
      function chiSo(m) { return m.v / m.w; }

      /* mot lan dung nghiem: moi buoc chon tu RCL trong cac mon CON VUA TUI */
      function motLan(hat) {
        var r = V.rng(hat), con = sinhUV(tt.hat), con_lai = SUC, tong = 0;
        while (true) {
          var uv = con.map(function (m, k) { return { m: m, k: k, i: chiSo(m) }; })
                      .filter(function (q) { return q.m.w <= con_lai; });
          if (!uv.length) break;
          var imax = Math.max.apply(null, uv.map(function (q) { return q.i; }));
          var imin = Math.min.apply(null, uv.map(function (q) { return q.i; }));
          var rcl;
          if (tt.kieu === "A") {
            var nguong = imax - tt.alpha * (imax - imin);
            rcl = uv.filter(function (q) { return q.i >= nguong; });
          } else {
            rcl = uv.slice().sort(function (a, b) { return b.i - a.i; }).slice(0, tt.k);
          }
          var pick = rcl[Math.floor(r() * rcl.length)];
          tong += pick.m.v; con_lai -= pick.m.w;
          con.splice(pick.k, 1);
        }
        return tong;
      }

      /* greedy thuan = luon lay chi so cao nhat (tuong duong RCL kich thuoc 1) */
      function greedyThuan() {
        var con = sinhUV(tt.hat), con_lai = SUC, tong = 0;
        while (true) {
          var uv = con.map(function (m, k) { return { m: m, k: k, i: chiSo(m) }; })
                      .filter(function (q) { return q.m.w <= con_lai; });
          if (!uv.length) break;
          uv.sort(function (a, b) { return b.i - a.i; });
          tong += uv[0].m.v; con_lai -= uv[0].m.w;
          con.splice(uv[0].k, 1);
        }
        return tong;
      }

      var kq = null;
      function chay() {
        var ds = [], i;
        for (i = 0; i < tt.lan; i++) ds.push(motLan(tt.hat * 1000 + i));
        var best = Math.max.apply(null, ds);
        var tb = ds.reduce(function (a, b) { return a + b; }, 0) / ds.length;
        kq = { ds: ds, best: best, tb: tb, greedy: greedyThuan() };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        if (!kq) return;
        var padL = 44, padR = 16, padT = 30, padB = 30;
        var w = W - padL - padR, h = H - padT - padB;

        var lo = Math.min(kq.greedy, Math.min.apply(null, kq.ds));
        var hi = Math.max(kq.greedy, kq.best);
        var pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
        var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };

        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText(tt.lan + " lần chạy GRASP — mỗi chấm là một nghiệm dựng được", padL, 18);

        /* truc */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = lo + (hi - lo) * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(0), padL - 6, yy + 3);
        }

        /* cac lan chay */
        kq.ds.forEach(function (v, i) {
          var x = padL + (i + 0.5) / kq.ds.length * w;
          g.fillStyle = V.mau("ac"); g.globalAlpha = 0.5;
          g.beginPath(); g.arc(x, Y(v), 3, 0, 6.2832); g.fill();
          g.globalAlpha = 1;
        });

        /* duong greedy thuan */
        g.strokeStyle = "#b45309"; g.lineWidth = 2; g.setLineDash([6, 4]);
        g.beginPath(); g.moveTo(padL, Y(kq.greedy)); g.lineTo(padL + w, Y(kq.greedy)); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#b45309"; g.font = "700 10.5px system-ui"; g.textAlign = "left";
        g.fillText("greedy thuần = " + kq.greedy.toFixed(0), padL + 4, Y(kq.greedy) - 5);

        /* duong tot nhat GRASP */
        g.strokeStyle = "#0f766e"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(padL, Y(kq.best)); g.lineTo(padL + w, Y(kq.best)); g.stroke();
        g.fillStyle = "#0f766e";
        g.fillText("GRASP tốt nhất = " + kq.best.toFixed(0), padL + 4, Y(kq.best) - 5);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        if (!kq) return;
        var chenh = (kq.best - kq.greedy) / Math.abs(kq.greedy) * 100;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("RCL kiểu " + tt.kieu + (tt.kieu === "A"
          ? " (theo giá trị, α = " + tt.alpha.toFixed(2) + ")"
          : " (theo số lượng, k = " + tt.k + ")"), 14, 20);

        var dong = [
          ["Greedy thuần (1 lần chạy)", kq.greedy.toFixed(1)],
          ["GRASP trung bình", kq.tb.toFixed(1)],
          ["GRASP tốt nhất trong " + tt.lan + " lần", kq.best.toFixed(1)],
          ["GRASP so với greedy", (chenh >= 0 ? "+" : "") + chenh.toFixed(1) + " %"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 44 + i * 20;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          var xau = i === 3;
          g2.fillStyle = xau ? (chenh < 0 ? V.mau("loi") : "#0f766e") : V.mau("tx");
          g2.font = (xau ? "700 " : "600 ") + "12px ui-monospace, monospace";
          g2.fillText(d[1], 270, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 138;
        if (chenh < -1) {
          g2.fillStyle = V.mau("loi"); g2.font = "700 12px system-ui";
          g2.fillText("⚠ GRASP ĐANG THUA GREEDY " + Math.abs(chenh).toFixed(0) + " %", 14, y0);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Đây đúng là lỗi ghi trong nhật ký thực nghiệm của bài 8.", 14, y0 + 17);
          g2.fillText("RCL kiểu A nuốt cả ứng viên rất tệ vì (vmax − vmin) bị phình ra.", 14, y0 + 32);
        } else {
          g2.fillStyle = "#0f766e"; g2.font = "700 12px system-ui";
          g2.fillText("✓ GRASP đang có lợi so với greedy", 14, y0);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Ngẫu nhiên hoá cho phép thoát khỏi một lựa chọn đầu tiên tồi.", 14, y0 + 17);
        }
      }

      function veHet() { chay(); ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Kiểu RCL", giaTri: tt.kieu,
                 muc: [{ v: "B", t: "Kiểu B — top-k (mặc định, bền hơn)" },
                       { v: "A", t: "Kiểu A — theo giá trị (α)" }],
                 doi: function (v) { tt.kieu = v; veHet(); } }),
        V.truot({ ten: "α (kiểu A)", min: 0, max: 1, buoc: 0.05, giaTri: tt.alpha,
                  doi: function (v) { tt.alpha = v; veHet(); } }),
        V.truot({ ten: "k (kiểu B)", min: 1, max: 12, buoc: 1, giaTri: tt.k,
                  doi: function (v) { tt.k = v; veHet(); } }),
        V.danhDau({ ten: "Dữ liệu có vài giá trị âm rất lớn (lệch)", giaTri: tt.lech,
                    doi: function (v) { tt.lech = v; veHet(); } }),
        V.truot({ ten: "Số lần chạy GRASP", min: 10, max: 200, buoc: 10, giaTri: tt.lan,
                  doi: function (v) { tt.lan = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Ý tưởng GRASP:</b> greedy chạy một lần cho <b>một</b> nghiệm. Nếu ta cho nó " +
          "<b>hơi ngẫu nhiên</b> — mỗi bước chọn ngẫu nhiên trong một <b>danh sách ứng viên " +
          "hạn chế (RCL)</b> thay vì luôn lấy cái tốt nhất — thì chạy 100 lần được 100 nghiệm " +
          "khác nhau, và ta lấy cái tốt nhất.<ul>" +
          "<li><b>Kiểu A — theo giá trị:</b> <code>RCL = {j : v_j ≥ vmax − α(vmax − vmin)}</code>. " +
          "α = 0 → greedy tất định; α = 1 → hoàn toàn ngẫu nhiên.</li>" +
          "<li><b>Kiểu B — theo số lượng:</b> <code>RCL = top-k</code>. k = 1 → greedy tất định.</li></ul>" +
          "<b>★ Thí nghiệm quan trọng nhất của demo này — tái hiện một lỗi có thật:</b><ol>" +
          "<li>Bật <b>\"Dữ liệu có vài giá trị âm rất lớn\"</b> (mặc định đã bật).</li>" +
          "<li>Đổi sang <b>RCL kiểu A với α = 0,25</b>.</li>" +
          "<li>Đọc dòng cuối: <b>GRASP thua greedy</b> — cùng hiện tượng mà nhật ký thực nghiệm " +
          "của bài 8 ghi lại (ở đó là −16 %).</li></ol>" +
          "<b>Vì sao?</b> Khi có vài giá trị âm rất lớn, khoảng <code>(vmax − vmin)</code> " +
          "<b>phình ra khổng lồ</b>. Ngưỡng <code>vmax − 0,25·(vmax − vmin)</code> tụt xuống rất " +
          "thấp, nên RCL <b>nuốt cả những ứng viên tồi tệ</b> — và GRASP đều đặn chọn phải chúng.<ul>" +
          "<li><b>Cách sửa:</b> đổi sang <b>kiểu B với k ≤ 4</b> → GRASP về mức greedy, rồi <b>vượt lên</b>. " +
          "Kiểu B không quan tâm giá trị phân bố thế nào, chỉ đếm hạng.</li>" +
          "<li><b>Cách sửa khác:</b> tắt ô \"dữ liệu lệch\" → kiểu A hoạt động bình thường trở lại. " +
          "Nhưng bạn <b>không kiểm soát được dữ liệu của đề thi</b>, nên đừng chọn phương pháp " +
          "chỉ đúng khi dữ liệu đẹp.</li></ul>" +
          "<b>⇒ Bài học tổng quát, dùng được ngoài GRASP: mọi công thức chuẩn hoá theo " +
          "(max − min) đều mong manh trước giá trị ngoại lai. Chuẩn hoá theo THỨ HẠNG thì bền.</b>"
      });
      veHet();
    }
  });

})();
