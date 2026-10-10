/* =====================================================================
   Nhom 7 — Cau truc & thuc chien
   cau-truc-bien-duyen (b.18B) · trieu-chung-go-loi (b.19B)
   qua-khop-seed (b.20B)       · phan-bo-cong-suc (b.4B)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ---------- tien ich dung chung cua nhom ------------------------- */

  /* F(v) = sum_t S_t (N - S_t)  — entropy theo mot truc */
  function bienDuyenF(dem, N) {
    var e = 0, s = 0;
    for (var i = 0; i + 1 < dem.length; i++) { s += dem[i]; e += s * (N - s); }
    return e;
  }

  /* Entropy = F(hang) + F(cot). Luoi la mang bool[H][W]. */
  function entropy(luoi, H, W) {
    var r = new Array(H).fill(0), c = new Array(W).fill(0), N = 0, y, x;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++)
      if (luoi[y][x]) { r[y]++; c[x]++; N++; }
    return { E: bienDuyenF(r, N) + bienDuyenF(c, N), r: r, c: c, N: N };
  }

  /* Tong khoang cach moi cap — cach O(N^2) nguyen ban, de doi chieu */
  function entropyCham(luoi, H, W) {
    var py = [], px = [], y, x, i, j, e = 0;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++)
      if (luoi[y][x]) { py.push(y); px.push(x); }
    for (i = 0; i < py.length; i++)
      for (j = i + 1; j < py.length; j++)
        e += Math.abs(py[i] - py[j]) + Math.abs(px[i] - px[j]);
    return e;
  }

  function luoiRong(H, W) {
    var a = [], y;
    for (y = 0; y < H; y++) a.push(new Array(W).fill(0));
    return a;
  }

  /* ================================================================
     17. Bien duyen — vi sao xao tron ma diem khong doi
     ================================================================ */
  demo({
    id: "cau-truc-bien-duyen", nhom: "Cấu trúc & thực chiến", mon: "B18B",
    ten: "Biên duyên: xáo trộn mà điểm không đổi",
    moTa: "Entropy Manhattan <b>chỉ phụ thuộc số hạt mỗi hàng và mỗi cột</b>. " +
          "Bấm xáo trộn: hình thay đổi hoàn toàn, điểm <b>không nhúc nhích</b>. " +
          "Rồi so bốn hình đích — ★ <b>đĩa tròn thắng cả hình vuông lẫn kim cương</b>.",
    lienKet: '<a href="../heuristic-course-2/#/khoa-hoc/bai-18b-cau-truc-ham-muc-tieu">B18B — Cấu trúc hàm mục tiêu</a> · <a href="../heuristic-practice-2/#/bai/bai-18b-cau-truc-ham-muc-tieu">🧪 Thực hành bài này</a>',
    dung: function (host) {
      var H = 26, W = 26, O = 11;               /* O = canh o ve */
      var WV = W * O + 46, HV = H * O + 84;
      var cv = V.veBang(WV, HV), g = cv.g;
      var cv2 = V.veBang(430, HV), g2 = cv2.g;

      var tt = { matDo: 0.34, hat: 7, hinh: "dulieu", soXao: 0 };
      var luoi = luoiRong(H, W), E0 = 0, cur = null;

      function sinh() {
        var r = V.rng(tt.hat);
        luoi = luoiRong(H, W);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++)
          luoi[y][x] = r() < tt.matDo ? 1 : 0;
        tt.soXao = 0;
        cur = entropy(luoi, H, W);
        E0 = cur.E;
      }

      /* Xao tron GIU NGUYEN bien duyen: hoan vi kieu 2x2
         (1,0 / 0,1) <-> (0,1 / 1,0) — phep bien doi bao toan ca hai bien duyen. */
      function xaoGiuBienDuyen(soLan) {
        var r = V.rng(1000 + tt.soXao), d = 0, t;
        for (t = 0; t < soLan * 400; t++) {
          var y1 = Math.floor(r() * H), y2 = Math.floor(r() * H);
          var x1 = Math.floor(r() * W), x2 = Math.floor(r() * W);
          if (y1 === y2 || x1 === x2) continue;
          if (luoi[y1][x1] && luoi[y2][x2] && !luoi[y1][x2] && !luoi[y2][x1]) {
            luoi[y1][x1] = 0; luoi[y2][x2] = 0;
            luoi[y1][x2] = 1; luoi[y2][x1] = 1; d++;
          } else if (!luoi[y1][x1] && !luoi[y2][x2] && luoi[y1][x2] && luoi[y2][x1]) {
            luoi[y1][x1] = 1; luoi[y2][x2] = 1;
            luoi[y1][x2] = 0; luoi[y2][x1] = 0; d++;
          }
        }
        tt.soXao += d;
        cur = entropy(luoi, H, W);
      }

      /* Bon hinh dich, cung dien tich N, dat giua luoi */
      function dungHinh(kieu) {
        var N = cur.N, cy = (H - 1) / 2, cx = (W - 1) / 2, o = [], y, x;
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          var dy = Math.abs(y - cy), dx = Math.abs(x - cx), d;
          if (kieu === "vuong") d = Math.max(dy, dx);
          else if (kieu === "kimcuong") d = dy + dx;
          else d = Math.sqrt(dy * dy + dx * dx);          /* dia tron */
          o.push([d, y, x]);
        }
        o.sort(function (a, b) { return a[0] - b[0]; });
        luoi = luoiRong(H, W);
        for (var i = 0; i < N; i++) luoi[o[i][1]][o[i][2]] = 1;
        tt.soXao = 0;
        cur = entropy(luoi, H, W);
      }

      function doiHinh(k) {
        tt.hinh = k;
        if (k === "dulieu") sinh(); else dungHinh(k);
        ve(); ve2();
      }

      /* ---------- ve luoi + bien duyen ---------- */
      function ve() {
        g.clearRect(0, 0, WV, HV);
        var padL = 40, padT = 48, y, x;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Vũ trụ " + H + "×" + W + " · " + cur.N + " hạt", 4, 15);

        /* bien duyen cot (tren) — vung 28..44 */
        var maxC = Math.max.apply(null, cur.c) || 1;
        for (x = 0; x < W; x++) {
          var h = (cur.c[x] / maxC) * 16;
          g.fillStyle = V.mau("ac2");
          g.fillRect(padL + x * O + 1, padT - 4 - h, O - 2, h);
        }
        /* bien duyen hang (trai) */
        var maxR = Math.max.apply(null, cur.r) || 1;
        for (y = 0; y < H; y++) {
          var w = (cur.r[y] / maxR) * 28;
          g.fillStyle = V.mau("ac2");
          g.fillRect(padL - 6 - w, padT + y * O + 1, w, O - 2);
        }

        /* o luoi */
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          g.fillStyle = luoi[y][x] ? V.mau("ac") : V.mau("bd2");
          g.fillRect(padL + x * O + 1, padT + y * O + 1, O - 2, O - 2);
        }

        /* chu thich duoi luoi */
        var yC = padT + H * O + 20;
        g.fillStyle = V.mau("ac2"); g.fillRect(4, yC - 8, 10, 10);
        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
        g.fillText("biên duyên: cột (trên), hàng (trái)", 20, yC);
        g.fillStyle = V.mau("ac"); g.fillRect(4, yC + 10, 10, 10);
        g.fillStyle = V.mau("tx3");
        g.fillText("ô có hạt — chỉ hai biểu đồ kia quyết định điểm", 20, yC + 18);
      }

      /* ---------- ve bang so sanh ---------- */
      var BANG = [
        { k: "vuong",    t: "Hình vuông" },
        { k: "kimcuong", t: "Kim cương (L₁)" },
        { k: "dia",      t: "Đĩa tròn" }
      ];
      function ve2() {
        var W2 = 430; g2.clearRect(0, 0, W2, HV);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Entropy hiện tại", 8, 16);

        var doi = Math.abs(cur.E - E0) < 1e-9;
        g2.font = "700 26px ui-monospace, monospace";
        g2.fillStyle = doi ? V.mau("ok") : V.mau("ac");
        g2.fillText(cur.E.toLocaleString("vi"), 8, 46);

        g2.font = "12px system-ui"; g2.fillStyle = V.mau("tx2");
        g2.fillText("ban đầu: " + E0.toLocaleString("vi"), 8, 66);

        if (tt.soXao > 0) {
          g2.font = "700 13px system-ui";
          g2.fillStyle = doi ? V.mau("ok") : V.mau("loi");
          g2.fillText(doi
            ? "✓ đã xáo " + tt.soXao + " lần — ĐIỂM KHÔNG ĐỔI"
            : "✗ điểm đã đổi (?!)", 8, 88);
        }

        /* doi chieu O(N^2) vs O(N) */
        var t0 = performance.now(); entropyCham(luoi, H, W);
        var tCham = performance.now() - t0;
        t0 = performance.now(); entropy(luoi, H, W);
        var tNhanh = performance.now() - t0;
        g2.font = "11.5px ui-monospace, monospace"; g2.fillStyle = V.mau("tx2");
        g2.fillText("đếm theo cặp   O(N²): " + tCham.toFixed(3) + " ms", 8, 116);
        g2.fillText("đếm lát cắt  O(H+W): " + tNhanh.toFixed(3) + " ms", 8, 134);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px ui-monospace, monospace";
        g2.fillText("nhanh hơn " + Math.max(1, Math.round(tCham / Math.max(tNhanh, 1e-4))) + "×",
                    8, 152);

        /* bang hinh dich */
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui";
        g2.fillText("Cùng " + cur.N + " hạt, bốn hình đích:", 8, 184);

        var luuLuoi = luoi, luuCur = cur, ds = [], i;
        for (i = 0; i < BANG.length; i++) {
          dungHinh(BANG[i].k);
          ds.push({ t: BANG[i].t, E: cur.E, k: BANG[i].k });
        }
        luoi = luuLuoi; cur = luuCur;

        var tot = Math.min.apply(null, ds.map(function (d) { return d.E; }));
        ds.forEach(function (d, i2) {
          var y = 208 + i2 * 24, la = d.E === tot;
          g2.font = (la ? "700 " : "") + "12px system-ui";
          g2.fillStyle = la ? V.mau("ok") : V.mau("tx2");
          g2.fillText((la ? "★ " : "   ") + d.t, 8, y);
          g2.font = (la ? "700 " : "") + "12px ui-monospace, monospace";
          g2.textAlign = "right"; g2.fillText(d.E.toLocaleString("vi"), 250, y);
          g2.fillStyle = la ? V.mau("ok") : V.mau("tx3");
          g2.fillText(la ? "tốt nhất" : "+" + ((d.E / tot - 1) * 100).toFixed(2) + " %", 420, y);
          g2.textAlign = "left";
        });

        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Khoảng cách là L₁, nhưng kim cương (hình cầu L₁)", 8, 300);
        g2.fillText("vẫn THUA đĩa tròn — vì ta cực tiểu kỳ vọng khoảng", 8, 316);
        g2.fillText("cách giữa hai điểm, chỉ phụ thuộc hai biên duyên.", 8, 332);
      }

      sinh();
      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: [
          V.nut("🔀 Xáo trộn (giữ biên duyên)", function () {
            xaoGiuBienDuyen(1); ve(); ve2();
          }, "chinh"),
          V.chon({
            ten: "Cấu hình", giaTri: tt.hinh, doi: doiHinh,
            muc: [{ v: "dulieu", t: "Ngẫu nhiên (dữ liệu thô)" },
                  { v: "vuong", t: "Hình vuông" },
                  { v: "kimcuong", t: "Kim cương (L₁)" },
                  { v: "dia", t: "Đĩa tròn" }]
          }),
          V.truot({
            ten: "Mật độ hạt", min: 0.15, max: 0.6, buoc: 0.01, giaTri: tt.matDo,
            doi: function (v) { tt.matDo = v; tt.hinh = "dulieu"; sinh(); ve(); ve2(); }
          }),
          V.truot({
            ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
            doi: function (v) { tt.hat = v; tt.hinh = "dulieu"; sinh(); ve(); ve2(); }
          })
        ],
        giaiThich:
          "<b>Thử điều này:</b> bấm <b>Xáo trộn</b> năm, mười lần. Hình ảnh biến đổi " +
          "hoàn toàn — nhưng hai biểu đồ biên duyên (trên và trái) <b>đứng im</b>, và entropy " +
          "<b>không đổi một đơn vị nào</b>. Phép xáo dùng ở đây đảo một hình chữ nhật 2×2 " +
          "kiểu <code>(1,0/0,1) ↔ (0,1/1,0)</code>, phép biến đổi bảo toàn cả hai biên duyên.<br><br>" +
          "★ <b>Hệ quả:</b> không gian nghiệm sập từ “chọn N ô trong H×W” xuống “chọn hai dãy số”. " +
          "Đó là toàn bộ nội dung Bài 18B. Cột bên phải còn cho thấy cách viết lại công thức " +
          "nhanh hơn hàng trăm lần — chính thứ khiến lời giải k-means của đề 2609 vượt giờ."
      });
      ve(); ve2();
    }
  });

  /* ================================================================
     18. Bay qua khop seed
     ================================================================ */
  demo({
    id: "qua-khop-seed", nhom: "Cấu trúc & thực chiến", mon: "B20B",
    ten: "Bẫy quá khớp seed khi tinh chỉnh",
    moTa: "Mọi cấu hình ở đây <b>tốt như nhau</b> — không cái nào hơn cái nào. " +
          "Vậy mà chọn cái điểm cao nhất vẫn cho “cải thiện” dương. " +
          "★ Kéo <b>K</b> lên và xem ảo giác lớn dần.",
    lienKet: '<a href="../heuristic-course-2/#/khoa-hoc/bai-20b-tinh-chinh-tham-so">B20B — Tinh chỉnh tham số</a> · <a href="../heuristic-practice-2/#/bai/bai-20b-tinh-chinh-tham-so">🧪 Thực hành bài này</a>',
    dung: function (host) {
      var W = 620, H = 330;
      var cv = V.veBang(W, H), g = cv.g;
      var tt = { K: 20, N: 30, sigma: 10, hat: 56, thatSu: 0 };

      /* Chay K cau hinh, moi cau hinh N seed huan luyen + N seed kiem dinh.
         Chi cau hinh 0 co cai thien THAT SU = tt.thatSu %. */
      function chay() {
        var r = V.rng(tt.hat), i, j, ds = [];
        for (i = 0; i < tt.K; i++) {
          var that = (i === 0) ? tt.thatSu : 0;
          var sHL = 0, sKD = 0;
          for (j = 0; j < tt.N; j++) {
            sHL += 100 + that + r.chuan() * tt.sigma;
            sKD += 100 + that + r.chuan() * tt.sigma;
          }
          ds.push({ i: i, hl: sHL / tt.N, kd: sKD / tt.N, that: that });
        }
        return ds;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ds = chay();
        var thang = ds.slice().sort(function (a, b) { return b.hl - a.hl; })[0];
        var padL = 46, padT = 34, w = W - padL - 150, h = 176;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Điểm trung bình của " + tt.K + " cấu hình (mỗi cấu hình " +
                   tt.N + " seed)", padL, 16);

        var het = ds.map(function (d) { return d.hl; }).concat(ds.map(function (d) { return d.kd; }));
        var lo = Math.min.apply(null, het) - 1, hi = Math.max.apply(null, het) + 1;
        var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var q = 0; q <= 4; q++) {
          var v = lo + (hi - lo) * q / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(1), padL - 6, yy + 3);
        }
        /* duong 100 = su that */
        g.strokeStyle = V.mau("tx3"); g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(padL, Y(100)); g.lineTo(padL + w, Y(100)); g.stroke();
        g.setLineDash([]);

        var bw = Math.max(2, w / tt.K - 2);
        ds.forEach(function (d, i) {
          var x = padL + i * (w / tt.K);
          var la = d === thang;
          g.fillStyle = la ? V.mau("ac") : V.mau("bd");
          g.fillRect(x, Y(d.hl), bw, padT + h - Y(d.hl));
          if (la) {
            g.fillStyle = V.mau("loi");
            g.beginPath(); g.arc(x + bw / 2, Y(d.kd), 3.5, 0, 6.2832); g.fill();
          }
        });

        /* ket qua */
        var aoGiac = thang.hl - 100 - thang.that;
        var thucTe = thang.kd - 100;
        var bx = padL + w + 16;
        g.textAlign = "left";
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui";
        g.fillText("Cấu hình thắng cuộc", bx, padT + 6);

        g.font = "11.5px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("trên seed huấn luyện", bx, padT + 28);
        g.font = "700 18px ui-monospace, monospace"; g.fillStyle = V.mau("ac");
        g.fillText("+" + (thang.hl - 100).toFixed(2) + " %", bx, padT + 50);

        g.font = "11.5px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("trên seed KIỂM ĐỊNH", bx, padT + 78);
        g.font = "700 18px ui-monospace, monospace";
        g.fillStyle = thucTe < 0.5 ? V.mau("loi") : V.mau("ok");
        g.fillText((thucTe >= 0 ? "+" : "") + thucTe.toFixed(2) + " %", bx, padT + 100);

        g.font = "11.5px system-ui"; g.fillStyle = V.mau("tx3");
        g.fillText("cải thiện thật:", bx, padT + 126);
        g.font = "700 12.5px ui-monospace, monospace"; g.fillStyle = V.mau("tx2");
        g.fillText("+" + thang.that.toFixed(2) + " %", bx + 92, padT + 126);

        /* cong thuc */
        var duDoan = tt.sigma / Math.sqrt(tt.N) * Math.sqrt(2 * Math.log(Math.max(2, tt.K)));
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Công thức ảo giác:  (σ/√N)·√(2 ln K)", padL, padT + h + 34);
        g.font = "12.5px ui-monospace, monospace"; g.fillStyle = V.mau("tx2");
        g.fillText("ước lượng = " + duDoan.toFixed(2) + " %      lần này = " +
                   aoGiac.toFixed(2) + " %", padL, padT + h + 56);

        var can = Math.round(8 * Math.pow(tt.sigma / Math.max(0.5, tt.thatSu || 2), 2) *
                             Math.log(Math.max(2, tt.K)));
        g.fillStyle = V.mau("loi"); g.font = "700 12px system-ui";
        g.fillText("Để kết luận đáng tin, cần N ≳ 8(σ/Δ)²·ln K = " + can +
                   " test  (đang dùng " + tt.N + ")", padL, padT + h + 80);

        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
        g.fillText("■ cột = điểm huấn luyện   ● chấm đỏ = điểm kiểm định của cấu hình thắng" +
                   "   ┈ đường đứt = sự thật (100)", padL, padT + h + 102);
      }

      V.khung(host, {
        ve: [cv],
        dieuKhien: [
          V.truot({ ten: "Số cấu hình thử K", min: 2, max: 300, buoc: 1, giaTri: tt.K,
                    doi: function (v) { tt.K = v; ve(); } }),
          V.truot({ ten: "Số test mỗi cấu hình N", min: 5, max: 400, buoc: 5, giaTri: tt.N,
                    doi: function (v) { tt.N = v; ve(); } }),
          V.truot({ ten: "Độ lệch chuẩn σ", min: 2, max: 25, buoc: 0.5, giaTri: tt.sigma,
                    donVi: " %", doi: function (v) { tt.sigma = v; ve(); } }),
          V.truot({ ten: "Cải thiện THẬT (cấu hình 0)", min: 0, max: 8, buoc: 0.25,
                    giaTri: tt.thatSu, donVi: " %",
                    doi: function (v) { tt.thatSu = v; ve(); } }),
          V.truot({ ten: "Hạt giống", min: 1, max: 80, buoc: 1, giaTri: tt.hat,
                    doi: function (v) { tt.hat = v; ve(); } })
        ],
        giaiThich:
          "<b>Thử điều này:</b> đặt “cải thiện THẬT” về <b>0</b> — bây giờ mọi cấu hình y hệt nhau. " +
          "Kéo <b>K</b> từ 2 lên 300 và nhìn con số huấn luyện phồng lên, trong khi con số " +
          "kiểm định vẫn dao động quanh 0. Toàn bộ phần chênh là <b>ảo giác</b>, và nó khớp " +
          "công thức <code>(σ/√N)·√(2 ln K)</code>.<br><br>" +
          "★ Rồi đặt cải thiện thật = <b>1 %</b> và giữ N = 30: ảo giác vẫn lớn hơn tín hiệu, " +
          "nên bạn <b>không thể</b> phân biệt cấu hình tốt thật với cấu hình may mắn. " +
          "Tăng N tới ngưỡng mà dòng đỏ báo — đó là lúc kết luận mới có căn cứ."
      });
      ve();
    }
  });

  /* ================================================================
     19. Trieu chung -> nguyen nhan
     ================================================================ */
  demo({
    id: "trieu-chung-go-loi", nhom: "Cấu trúc & thực chiến", mon: "B19B",
    ten: "Bốn triệu chứng, bốn nguyên nhân",
    moTa: "Cấy một bug vào solver và xem nó <b>biểu hiện ra triệu chứng nào</b>. " +
          "★ Bug nguy hiểm nhất không crash, không vi phạm — nó chỉ làm điểm thấp đi.",
    lienKet: '<a href="../heuristic-course-2/#/khoa-hoc/bai-19b-go-loi-heuristic">B19B — Gỡ lỗi heuristic</a> · <a href="../heuristic-practice-2/#/bai/bai-19b-go-loi-heuristic">🧪 Thực hành bài này</a>',
    dung: function (host) {
      var W = 640, H = 386;
      var cv = V.veBang(W, H), g = cv.g;

      var BUG = {
        khong:   { t: "Không có bug", mt: "Solver đúng." },
        ub:      { t: "UB: hàm thiếu return",
                   mt: "Ở -O2 trình biên dịch xoá vòng lặp di chuyển." },
        banSao:  { t: "Bản sao trạng thái lệch",
                   mt: "Cập nhật lưới nội bộ kể cả khi nước đi bị từ chối." },
        demSai:  { t: "Đếm tài nguyên sai",
                   mt: "Chỉ đếm nước đi THÀNH CÔNG; grader đếm cả nước hỏng." },
        sotLai:  { t: "Trạng thái sót giữa test",
                   mt: "Hạt giống RNG không reset." },
        onSau:   { t: "Độ phức tạp ẩn",
                   mt: "O(N²) — chỉ nổ khi test lớn." }
      };
      var tt = { bug: "khong", n: 18 };

      /* Mo phong 18 test case, tra ve cac chi so quan sat duoc. */
      function chay() {
        var b = tt.bug, r = V.rng(11), ds = [], i;
        for (i = 0; i < tt.n; i++) {
          var coLon = i % 5 === 4;                  /* mot so test lon */
          var diem = 100 + r.chuan() * 3;
          var viPham = 0, ms = 22 + r() * 8, tatDinh = true;

          if (b === "ub")      { diem = 4 + r() * 0.5; }
          if (b === "banSao")  { diem = 100 - 26 - r() * 8; }
          if (b === "demSai")  { diem = 100 - 12 - r() * 6; viPham = 1 + Math.floor(r() * 4); }
          if (b === "sotLai")  { diem = 100 + r.chuan() * 3; tatDinh = false; }
          if (b === "onSau" && coLon) { ms = 1300 + r() * 2400; }
          ds.push({ diem: diem, viPham: viPham, ms: ms, lon: coLon, tatDinh: tatDinh });
        }
        return ds;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ds = chay(), i;
        var tbDiem = ds.reduce(function (s, d) { return s + d.diem; }, 0) / ds.length;
        var tongVP = ds.reduce(function (s, d) { return s + d.viPham; }, 0);
        var msMax  = Math.max.apply(null, ds.map(function (d) { return d.ms; }));
        var tatDinh = ds.every(function (d) { return d.tatDinh; });

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Kết quả " + tt.n + " test case", 14, 15);
        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
        g.fillText("điểm từng test", 150, 15);

        /* dai diem */
        var padL = 14, padT = 34, w = W - 28, h = 92;
        g.strokeStyle = V.mau("bd2");
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();
        var bw = w / tt.n - 3;
        ds.forEach(function (d, i2) {
          var x = padL + i2 * (w / tt.n);
          var hh = Math.max(1, d.diem / 110 * h);
          g.fillStyle = d.viPham ? V.mau("loi") : (d.diem < 60 ? V.mau("loi") : V.mau("ac"));
          g.fillRect(x, padT + h - hh, bw, hh);
          if (d.ms > 1000) {
            g.fillStyle = V.mau("loi"); g.font = "700 9px system-ui";
            g.fillText("TLE", x - 1, padT + h + 11);
          }
        });
        /* bang 4 trieu chung */
        var y0 = 180;
        var hang = [
          { t: "A · Điểm thấp, không vi phạm, đúng giờ",
            on: tbDiem < 92 && tongVP === 0 && msMax < 1000 && tatDinh },
          { t: "B · Có vi phạm ràng buộc", on: tongVP > 0 },
          { t: "C · Vượt giờ ở một số test",  on: msMax > 1000 },
          { t: "D · Chạy lại ra điểm khác",   on: !tatDinh }
        ];
        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui";
        g.fillText("Triệu chứng quan sát được", 14, y0 - 22);

        hang.forEach(function (r2, i2) {
          var y = y0 + i2 * 26;
          g.fillStyle = r2.on ? V.mau("loi") : V.mau("bd2");
          g.beginPath(); g.arc(22, y - 4, 6, 0, 6.2832); g.fill();
          g.fillStyle = r2.on ? V.mau("tx") : V.mau("tx3");
          g.font = (r2.on ? "700 " : "") + "12px system-ui";
          g.fillText(r2.t, 38, y);
        });

        /* ket luan */
        var bug = BUG[tt.bug];
        var y1 = y0 + 4 * 26 + 18;
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Bug đang cấy: ", 14, y1);
        g.fillStyle = tt.bug === "khong" ? V.mau("ok") : V.mau("loi");
        g.font = "700 12.5px system-ui";
        g.fillText(bug.t, 106, y1);
        g.fillStyle = V.mau("tx3"); g.font = "11.5px system-ui";
        g.fillText(bug.mt, 14, y1 + 18);

        g.fillStyle = V.mau("tx2"); g.font = "11.5px ui-monospace, monospace";
        g.fillText("điểm TB " + tbDiem.toFixed(1) + "   vi phạm " + tongVP +
                   "   ms xấu nhất " + msMax.toFixed(0) +
                   "   tất định " + (tatDinh ? "có" : "KHÔNG"), 14, y1 + 40);

        if (hang[0].on) {
          g.fillStyle = V.mau("loi"); g.font = "700 12px system-ui";
          g.fillText("⚠ Triệu chứng A — trông y hệt “thuật toán chưa đủ tốt”. " +
                     "Chạy quy trình 6 bước trước khi đổ lỗi cho thuật toán.", 14, y1 + 62);
        }
      }

      V.khung(host, {
        ve: [cv],
        dieuKhien: [
          V.chon({
            ten: "Cấy bug", giaTri: tt.bug,
            doi: function (v) { tt.bug = v; ve(); },
            muc: Object.keys(BUG).map(function (k) { return { v: k, t: BUG[k].t }; })
          }),
          V.truot({ ten: "Số test chạy", min: 6, max: 40, buoc: 1, giaTri: tt.n,
                    doi: function (v) { tt.n = v; ve(); } })
        ],
        giaiThich:
          "<b>Thử điều này:</b> chọn lần lượt từng bug và xem đèn triệu chứng nào sáng. " +
          "Bug <b>đếm tài nguyên sai</b> bật đèn B (dễ thấy); bug <b>độ phức tạp ẩn</b> bật đèn C " +
          "nhưng <b>chỉ khi có test lớn</b> — giảm số test xuống 6 thì nó biến mất.<br><br>" +
          "★ Hai bug <b>UB</b> và <b>bản sao lệch</b> chỉ bật đèn A: không crash, không vi phạm, " +
          "đúng giờ — chỉ điểm thấp. Đó là lý do Bài 19B bắt đầu bằng câu " +
          "<i>“điểm thấp là một triệu chứng, không phải một chẩn đoán”</i>."
      });
      ve();
    }
  });

  /* ================================================================
     20. Tien nam o dau — phan bo cong suc
     ================================================================ */
  demo({
    id: "phan-bo-cong-suc", nhom: "Cấu trúc & thực chiến", mon: "B4B",
    ten: "Tiền nằm ở đâu: phân bổ 4 giờ",
    moTa: "Số liệu ablation <b>thật</b> từ đề thi 2607. Kéo thanh phân bổ giờ và xem " +
          "điểm kỳ vọng thay đổi. ★ Đọc mã grader sinh lợi <b>gấp 56 lần</b> tinh chỉnh.",
    lienKet: '<a href="../heuristic-course-2/#/khoa-hoc/bai-04b-phan-bo-cong-suc">B4B — Phân bổ công sức</a> · <a href="../heuristic-practice-2/#/bai/bai-04b-phan-bo-cong-suc">🧪 Thực hành bài này</a>',
    dung: function (host) {
      var W = 620, H = 396;
      var cv = V.veBang(W, H), g = cv.g;

      /* nang suat %/gio va tran (toi da thu duoc) — do tu de 2607 */
      var VIEC = [
        { k: "doc",   t: "Đọc mã grader",        ns: 6.20, tran: 3.10, mau: "#0f766e" },
        { k: "mohinh",t: "Mô hình hoá / giá mờ", ns: 1.15, tran: 2.90, mau: "#5b4bd6" },
        { k: "tim",   t: "Tìm kiếm mạnh hơn",    ns: 0.81, tran: 2.45, mau: "#b45309" },
        { k: "chinh", t: "Tinh chỉnh tham số",   ns: 0.11, tran: 0.35, mau: "#9f1239" }
      ];
      var gio = { doc: 0.5, mohinh: 1.5, tim: 1.0, chinh: 1.0 };

      function tong() {
        var s = 0, t = 0;
        VIEC.forEach(function (v) {
          s += Math.min(v.tran, gio[v.k] * v.ns);
          t += gio[v.k];
        });
        return { diem: s, gio: t };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var r = tong();
        var padL = 150, padT = 40, w = W - padL - 120;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Phần trăm điểm thu được theo từng loại việc", 14, 18);

        var maxV = 3.2;
        VIEC.forEach(function (v, i) {
          var y = padT + i * 44;
          var duoc = Math.min(v.tran, gio[v.k] * v.ns);

          g.fillStyle = V.mau("tx2"); g.font = "12px system-ui"; g.textAlign = "right";
          g.fillText(v.t, padL - 10, y + 4);
          g.fillStyle = V.mau("tx3"); g.font = "10.5px ui-monospace, monospace";
          g.fillText(gio[v.k].toFixed(1) + " h · " + v.ns.toFixed(2) + " %/h", padL - 10, y + 19);

          g.textAlign = "left";
          /* tran */
          g.fillStyle = V.mau("bd2");
          g.fillRect(padL, y - 9, v.tran / maxV * w, 17);
          /* thu duoc */
          g.fillStyle = v.mau;
          g.fillRect(padL, y - 9, duoc / maxV * w, 17);

          g.fillStyle = V.mau("tx"); g.font = "700 12px ui-monospace, monospace";
          g.fillText("+" + duoc.toFixed(2) + " %", padL + w + 12, y + 4);
          if (duoc >= v.tran - 1e-9) {
            g.fillStyle = V.mau("tx3"); g.font = "10px system-ui";
            g.fillText("đã chạm trần", padL + w + 12, y + 18);
          }
        });

        /* tong */
        var y2 = padT + 4 * 44 + 14;
        g.fillStyle = V.mau("tx"); g.font = "600 13px system-ui";
        g.fillText("Tổng " + r.gio.toFixed(1) + " giờ  →", 14, y2);
        g.font = "700 24px ui-monospace, monospace"; g.fillStyle = V.mau("ac");
        g.fillText("+" + r.diem.toFixed(2) + " %", 150, y2 + 2);

        var hieu = r.diem / Math.max(0.1, r.gio);
        g.font = "12px system-ui"; g.fillStyle = V.mau("tx2");
        g.fillText("năng suất trung bình " + hieu.toFixed(2) + " %/giờ", 270, y2 + 2);

        /* --- duong loi ich giam dan: phan bo TOI UU (viec nang suat cao truoc) --- */
        var GIO_MAX = 9, DIEM_MAX = 7;
        var bx = 50, by = y2 + 26, bw = W - bx - 16, bh = 80;

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + bh);
        g.lineTo(bx + bw, by + bh); g.stroke();
        g.fillStyle = V.mau("tx3"); g.font = "9.5px system-ui"; g.textAlign = "right";
        g.fillText(DIEM_MAX + " %", bx - 5, by + 4);
        g.fillText("0", bx - 5, by + bh + 3);
        g.textAlign = "left";
        g.fillText(GIO_MAX + " giờ", bx + bw - 24, by + bh + 12);

        var X = function (h) { return bx + h / GIO_MAX * bw; };
        var Y = function (d) { return by + bh - Math.min(1, d / DIEM_MAX) * bh; };

        var xep = VIEC.slice().sort(function (a, b) { return b.ns - a.ns; });
        var hh = 0, dd = 0;
        g.beginPath(); g.moveTo(X(0), Y(0));
        xep.forEach(function (v) {
          hh += v.tran / v.ns; dd += v.tran;
          g.lineTo(X(Math.min(hh, GIO_MAX)), Y(dd));
        });
        if (hh < GIO_MAX) g.lineTo(X(GIO_MAX), Y(dd));
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2; g.stroke();

        /* diem cua nguoi dung */
        g.fillStyle = V.mau("loi");
        g.beginPath(); g.arc(X(Math.min(r.gio, GIO_MAX)), Y(r.diem), 4.5, 0, 6.2832); g.fill();

        var yL = by + bh + 28;
        g.fillStyle = V.mau("ac"); g.fillRect(bx, yL - 5, 14, 3);
        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
        g.fillText("đường phân bổ TỐI ƯU (việc năng suất cao trước)", bx + 20, yL);
        g.fillStyle = V.mau("loi");
        g.beginPath(); g.arc(bx + 300, yL - 4, 4, 0, 6.2832); g.fill();
        g.fillStyle = V.mau("tx3");
        g.fillText("phân bổ của bạn", bx + 310, yL);

        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
        g.fillText("Thanh mờ = trần của loại việc đó (không thu thêm dù bỏ bao nhiêu giờ).",
                   14, H - 10);
      }

      var dks = VIEC.map(function (v) {
        return V.truot({
          ten: v.t, min: 0, max: 3, buoc: 0.1, giaTri: gio[v.k], donVi: " h",
          doi: function (x) { gio[v.k] = x; ve(); }
        });
      });
      dks.push(V.nut("↺ Về phân bổ khuyến nghị", function () {
        gio.doc = 0.5; gio.mohinh = 1.5; gio.tim = 1.0; gio.chinh = 1.0;
        dks.forEach(function (d, i) { if (d.datGiaTri) d.datGiaTri(gio[VIEC[i].k]); });
        ve();
      }, "chinh"));

      V.khung(host, {
        ve: [cv], dieuKhien: dks,
        giaiThich:
          "<b>Thử điều này:</b> dồn cả <b>3 giờ</b> vào “Tinh chỉnh tham số” và để các ô khác " +
          "bằng 0 — tổng thu về chưa tới <b>0,35 %</b>. Rồi chuyển 0,5 giờ sang “Đọc mã grader”: " +
          "riêng nửa giờ đó đã cho <b>3,10 %</b>, gấp gần chín lần.<br><br>" +
          "★ Mỗi loại việc có <b>trần riêng</b> (thanh mờ): đổ thêm giờ vào một việc đã chạm trần " +
          "không sinh thêm điểm nào. Đó là hình dạng thật của đường cong lợi ích giảm dần, " +
          "và là lý do ngân sách mẫu ở Bài 4B dành <b>35 %</b> thời gian cho việc hiểu bài toán."
      });
      ve();
    }
  });

})();
