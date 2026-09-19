/* =====================================================================
   vis-8-an-toan.js — An toan va cong bang (M14, M08)
     1. cong-bang-bat-kha-thi  Dang thuc Chouldechova          (M14 b.7)
     2. goodhart               Ap luc toi uu va toi uu qua muc  (M14 b.5)
   ===================================================================== */

(function () {
  "use strict";
  var V = window.VIS;

  /* =================================================================
     1. BAT KHA THI CONG BANG
     ================================================================= */
  demo({
    id: "cong-bang-bat-kha-thi", nhom: "Hệ thống & đánh giá", mon: "M14",
    ten: "Bất khả thi công bằng: bạn chỉ chọn được một",
    moTa: "Hai nhóm, hai tỷ lệ nền khác nhau. Cân bằng <b>tỷ lệ lỗi</b> thì <b>độ tin cậy " +
          "của dự đoán</b> lệch — và ngược lại. Đây là một <b>đồng nhất thức đếm</b>.",
    lienKet: '<a href="../web/index.html#/bai/m14-bai-07-cong-bang-va-thien-lech">M14 b.7</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 220;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = { pA: 0.30, pB: 0.10, N: 1000, che: "odds", fpr: 0.20, fnr: 0.30, ppv: 0.60 };
      var oSo = V.el("div", { class: "so-lieu" });

      /* Tinh bang 2x2 cho mot nhom theo che do dang chon. */
      function nhom(p) {
        var fnr = tt.fnr, fpr;
        if (tt.che === "odds") {
          fpr = tt.fpr;
        } else if (tt.che === "ppv") {
          /* Chouldechova dao nguoc: FPR = [p/(1-p)]·[(1-PPV)/PPV]·(1-FNR) */
          fpr = (p / (1 - p)) * ((1 - tt.ppv) / tt.ppv) * (1 - fnr);
        } else {                     /* "tyle": cung ty le chap thuan (du bao duong) */
          var muc = tt.pA * (1 - fnr) + (1 - tt.pA) * tt.fpr;   /* lay nhom A lam chuan */
          fpr = (muc - p * (1 - fnr)) / (1 - p);
        }
        fpr = Math.max(0, Math.min(1, fpr));
        var duong = tt.N * p, am = tt.N * (1 - p);
        var TP = duong * (1 - fnr), FN = duong * fnr;
        var FP = am * fpr, TN = am * (1 - fpr);
        var ppv = (TP + FP) > 0 ? TP / (TP + FP) : 0;
        var npv = (TN + FN) > 0 ? TN / (TN + FN) : 0;
        var tyLeDuong = (TP + FP) / tt.N;
        return { p: p, fpr: fpr, fnr: fnr, TP: TP, FN: FN, FP: FP, TN: TN,
                 ppv: ppv, npv: npv, tyLeDuong: tyLeDuong };
      }

      function ve() {
        var A = nhom(tt.pA), B = nhom(tt.pB);

        /* ---------- hai bang 2x2 dang cot xep ---------- */
        g.clearRect(0, 0, W, H);
        var padT = 40, colW = 190, gap = 60, x0 = 56, hMax = 176;
        var maxN = tt.N;

        function veCot(x, G, ten) {
          g.fillStyle = V.mau("tx"); g.font = "600 13px system-ui"; g.textAlign = "center";
          g.fillText(ten + "  (tỷ lệ nền " + (G.p * 100).toFixed(0) + "%)", x + colW / 2, padT - 18);
          g.textAlign = "left";
          var y = padT, phan = [
            { v: G.TP, mau: "#0f766e", t: "TP" },
            { v: G.FP, mau: "#9d174d", t: "FP" },
            { v: G.FN, mau: "#b45309", t: "FN" },
            { v: G.TN, mau: V.mau("bd"), t: "TN" }
          ];
          phan.forEach(function (q) {
            var hh = q.v / maxN * hMax;
            g.fillStyle = q.mau;
            g.fillRect(x, y, colW, hh);
            if (hh > 15) {
              g.fillStyle = "#fff"; g.font = "600 11px system-ui";
              g.fillText(q.t + " " + Math.round(q.v), x + 8, y + hh / 2 + 4);
            }
            y += hh;
          });
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
          g.strokeRect(x, padT, colW, hMax);
          /* so lieu chinh duoi cot */
          g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
          g.fillText("FPR " + G.fpr.toFixed(3) + "   FNR " + G.fnr.toFixed(3), x, padT + hMax + 18);
          g.font = "700 14px system-ui";
          g.fillStyle = "#9d174d";
          g.fillText("PPV " + G.ppv.toFixed(3), x, padT + hMax + 40);
          g.font = "12px system-ui"; g.fillStyle = V.mau("tx2");
          g.fillText("người bị dương giả: " + Math.round(G.FP), x, padT + hMax + 58);
        }

        veCot(x0, A, "NHÓM A");
        veCot(x0 + colW + gap, B, "NHÓM B");

        g.fillStyle = V.mau("tx3"); g.font = "11px system-ui";
        g.fillText("mỗi cột = " + tt.N + " người", x0, padT + hMax + 78);

        /* ---------- bang so sanh + kiem dang thuc ---------- */
        g2.clearRect(0, 0, W2, H2);
        var rows = [
          { t: "FPR — tỷ lệ dương giả", a: A.fpr, b: B.fpr },
          { t: "FNR — tỷ lệ âm giả", a: A.fnr, b: B.fnr },
          { t: "PPV — dự đoán dương đáng tin", a: A.ppv, b: B.ppv },
          { t: "Tỷ lệ được dự đoán dương", a: A.tyLeDuong, b: B.tyLeDuong }
        ];
        var cx1 = 300, cx2 = 400, cx3 = 496;
        g2.fillStyle = V.mau("tx2"); g2.font = "600 12px system-ui";
        g2.fillText("Số đo", 14, 20);
        g2.textAlign = "center";
        g2.fillText("Nhóm A", cx1, 20); g2.fillText("Nhóm B", cx2, 20);
        g2.fillText("lệch", cx3, 20);
        g2.textAlign = "left";
        g2.strokeStyle = V.mau("bd"); g2.lineWidth = 1;
        g2.beginPath(); g2.moveTo(10, 28); g2.lineTo(W2 - 10, 28); g2.stroke();

        rows.forEach(function (r, i) {
          var y = 48 + i * 26;
          var lech = Math.abs(r.a - r.b);
          var canBang = lech < 0.005;
          g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui";
          g2.fillText(r.t, 14, y);
          g2.textAlign = "center";
          g2.font = "600 12px system-ui";
          g2.fillStyle = canBang ? "#0f766e" : "#9d174d";
          g2.fillText(r.a.toFixed(3), cx1, y);
          g2.fillText(r.b.toFixed(3), cx2, y);
          g2.fillText(canBang ? "✓ bằng" : "✗ " + lech.toFixed(3), cx3, y);
          g2.textAlign = "left";
        });

        /* kiem dang thuc Chouldechova tren nhom B */
        var veTrai = B.fpr;
        var vePhai = (B.p / (1 - B.p)) * ((1 - B.ppv) / B.ppv) * (1 - B.fnr);
        var yK = 48 + rows.length * 26 + 16;
        g2.fillStyle = V.mau("surf2"); g2.strokeStyle = V.mau("bd");
        g2.fillRect(10, yK, W2 - 20, 52); g2.strokeRect(10, yK, W2 - 20, 52);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px " + (V.mau("fm") || "monospace");
        g2.fillText("Kiểm đẳng thức Chouldechova trên nhóm B:", 20, yK + 18);
        g2.font = "600 12px system-ui";
        g2.fillStyle = Math.abs(veTrai - vePhai) < 1e-6 ? "#0f766e" : "#9d174d";
        g2.fillText("FPR = [p/(1−p)]·[(1−PPV)/PPV]·(1−FNR)   ⇒   " +
                    veTrai.toFixed(5) + "  =  " + vePhai.toFixed(5) +
                    (Math.abs(veTrai - vePhai) < 1e-6 ? "   ✓ khớp" : ""), 20, yK + 38);

        oSo.innerHTML =
          '<div class="d"><span>Tiêu chí đang áp</span><b>' +
            (tt.che === "odds" ? "Odds cân bằng" :
             tt.che === "ppv" ? "Cân bằng dự đoán" : "Cân bằng tỷ lệ chấp thuận") + "</b></div>" +
          '<div class="d"><span>PPV nhóm A</span><b>' + A.ppv.toFixed(3) + "</b></div>" +
          '<div class="d"><span>PPV nhóm B</span><b>' + B.ppv.toFixed(3) + "</b></div>" +
          '<div class="d"><span>Dương giả nhóm A</span><b>' + Math.round(A.FP) + " người</b></div>" +
          '<div class="d"><span>Dương giả nhóm B</span><b>' + Math.round(B.FP) + " người</b></div>" +
          '<div class="d"><span>★ Chênh lệch PPV</span><b>' +
            Math.abs(A.ppv - B.ppv).toFixed(3) + "</b></div>";
      }

      var dkFpr = V.truot({ ten: "FPR (khi cân bằng odds)", min: 0.02, max: 0.5, buoc: 0.01,
        giaTri: tt.fpr, doi: function (v) { tt.fpr = v; ve(); } });
      var dkPpv = V.truot({ ten: "PPV (khi cân bằng dự đoán)", min: 0.15, max: 0.9, buoc: 0.01,
        giaTri: tt.ppv, doi: function (v) { tt.ppv = v; ve(); } });

      var dk = [
        V.el("h4", { text: "TIÊU CHÍ CÔNG BẰNG ÁP DỤNG" }),
        V.chon({ ten: "Cân bằng cái gì", giaTri: tt.che,
          muc: [{ v: "odds", t: "Odds cân bằng — cùng FPR và FNR" },
                { v: "ppv", t: "Cân bằng dự đoán — cùng PPV" },
                { v: "tyle", t: "Cân bằng tỷ lệ chấp thuận" }],
          doi: function (v) { tt.che = v; ve(); } }),
        V.el("h4", { text: "HAI NHÓM" }),
        V.truot({ ten: "Tỷ lệ nền nhóm A", min: 0.02, max: 0.6, buoc: 0.01, giaTri: tt.pA,
          doi: function (v) { tt.pA = v; ve(); } }),
        V.truot({ ten: "Tỷ lệ nền nhóm B", min: 0.02, max: 0.6, buoc: 0.01, giaTri: tt.pB,
          doi: function (v) { tt.pB = v; ve(); } }),
        V.el("h4", { text: "HIỆU NĂNG MÔ HÌNH" }),
        V.truot({ ten: "FNR (luôn cân bằng)", min: 0.02, max: 0.6, buoc: 0.01, giaTri: tt.fnr,
          doi: function (v) { tt.fnr = v; ve(); } }),
        dkFpr, dkPpv,
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Hai nhóm, một mô hình, và ba định nghĩa công bằng hợp lý.</b> " +
          "Ở cấu hình mặc định (tỷ lệ nền 30% và 10%), mô hình có " +
          "<b>FPR = 0,20 và FNR = 0,30 ở CẢ HAI nhóm</b> — nó thoả " +
          "<i>odds cân bằng</i> một cách hoàn hảo.<ul>" +
          "<li><b>Nhưng PPV là 0,60 và 0,28.</b> Cùng một dự đoán \"dương\" đáng tin " +
          "hơn <b>hai lần</b> ở nhóm A so với nhóm B.</li>" +
          "<li><b>★ Và nhóm B — nhóm có ÍT ca thật hơn ba lần — lại gánh NHIỀU dương giả hơn " +
          "(180 so với 140 người).</b></li></ul>" +
          "<b>Đổi sang \"cân bằng dự đoán\"</b> ở ô chọn: giờ PPV bằng nhau — " +
          "và <b>FPR lệch nhau</b>. Bạn không sửa được vấn đề; bạn chỉ <b>di chuyển nó</b>.<br><br>" +
          "<b>★ Vì sao không có cách nào thoát:</b> ba đại lượng bị buộc vào nhau bởi một " +
          "<b>đồng nhất thức đếm</b> (kiểm ở hộp dưới, nó luôn khớp tới 5 chữ số):<br>" +
          "<code>FPR = [p/(1−p)] · [(1−PPV)/PPV] · (1−FNR)</code><br>" +
          "Khi <b>p khác nhau giữa hai nhóm</b>, bạn <b>không thể</b> đồng thời cố định " +
          "vế trái (FPR) và PPV ở cả hai nhóm. Đây <b>không phải một hạn chế kỹ thuật</b> — " +
          "không mô hình nào, không lượng dữ liệu nào, không thuật toán nào thoát được nó. " +
          "Nó là số học.<ul>" +
          "<li><b>Kéo hai tỷ lệ nền về BẰNG NHAU</b> và xem mọi lệch biến mất. " +
          "⇒ Xung đột <b>hoàn toàn đến từ chênh lệch tỷ lệ nền</b>, không từ mô hình.</li></ul>" +
          "<b>⇒ Hệ quả thực tế, và nó là điểm quan trọng nhất của demo này:</b> " +
          "việc <b>chọn định nghĩa nào</b> là một <b>quyết định GIÁ TRỊ</b> — nó quyết định " +
          "<i>ai gánh loại lỗi nào</i> — chứ không phải một quyết định kỹ thuật. " +
          "Việc của kỹ sư là <b>đo cả ba, trình bày bằng số, và bắt một người có thẩm quyền ký</b>.<br><br>" +
          "<b>⚠️ Và một cái bẫy:</b> \"bỏ biến nhạy cảm ra khỏi mô hình\" <b>không</b> làm " +
          "bảng này biến mất — các biến đại diện vẫn mang thông tin nhóm — nhưng nó <b>lấy đi " +
          "thứ bạn cần để ĐO</b>. Kết quả là vấn đề trở nên <b>không nhìn thấy được</b> " +
          "thay vì được giải quyết."
      });
      ve();
    }
  });

  /* =================================================================
     2. GOODHART: AP LUC TOI UU VA TOI UU QUA MUC
     ================================================================= */
  demo({
    id: "goodhart", nhom: "Hệ thống & đánh giá", mon: "M14",
    ten: "Goodhart: áp lực tối ưu làm phép thay thế tách khỏi mục tiêu",
    moTa: "Phép thay thế <b>không đổi</b>. Chỉ <b>áp lực tối ưu</b> đổi — " +
          "và đó là đủ để mọi thứ hỏng.",
    lienKet: '<a href="../web/index.html#/bai/m14-bai-05-reward-hacking-va-goodhart">M14 b.5</a> · ' +
             '<a href="../web/index.html#/bai/m08-bai-14-rlhf-va-hoc-tu-so-thich">M08 b.14</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = { rho: 0.9, n: 100, hat: 5, ap: 0.5 };
      var oSo = V.el("div", { class: "so-lieu" });

      function sinh() {
        var R = V.rng(tt.hat);
        var d = [], k = Math.sqrt(1 - tt.rho * tt.rho);
        for (var i = 0; i < tt.n; i++) {
          var that = R.chuan();
          var proxy = tt.rho * that + k * R.chuan();
          d.push({ t: that, p: proxy });
        }
        return d;
      }

      function ve() {
        var d = sinh();
        var iP = 0, iT = 0;
        for (var i = 1; i < d.length; i++) {
          if (d[i].p > d[iP].p) iP = i;
          if (d[i].t > d[iT].t) iT = i;
        }
        var khoang = d[iT].t - d[iP].t;

        /* ---------- panel 1: tan xa proxy vs muc tieu that ---------- */
        g.clearRect(0, 0, W, H);
        var padL = 54, padR = 20, padT = 26, padB = 44;
        var w = W - padL - padR, h = H - padT - padB;
        var lim = 3.4;
        function X(v) { return padL + (v + lim) / (2 * lim) * w; }
        function Y(v) { return padT + h - (v + lim) / (2 * lim) * h; }

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        for (i = -3; i <= 3; i++) {
          g.beginPath(); g.moveTo(X(i), padT); g.lineTo(X(i), padT + h); g.stroke();
          g.beginPath(); g.moveTo(padL, Y(i)); g.lineTo(padL + w, Y(i)); g.stroke();
        }
        d.forEach(function (q, j) {
          var noiBat = (j === iP || j === iT);
          g.fillStyle = j === iP ? "#9d174d" : (j === iT ? "#0f766e" : V.mau("bd"));
          g.globalAlpha = noiBat ? 1 : 0.42;
          g.beginPath(); g.arc(X(q.p), Y(q.t), noiBat ? 7 : 3.2, 0, 7); g.fill();
          g.globalAlpha = 1;
        });
        /* duong noi khoang cach */
        g.strokeStyle = "#b45309"; g.lineWidth = 2; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(padL, Y(d[iP].t)); g.lineTo(padL + w, Y(d[iP].t)); g.stroke();
        g.beginPath(); g.moveTo(padL, Y(d[iT].t)); g.lineTo(padL + w, Y(d[iT].t)); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#b45309"; g.font = "600 12px system-ui";
        g.fillText("khoảng cách = " + khoang.toFixed(2) + " SD",
                   padL + w - 150, (Y(d[iP].t) + Y(d[iT].t)) / 2 + 4);

        g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();
        g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + h); g.stroke();
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("mục tiêu THẬT ↑", 4, 16);
        g.fillText("phép thay thế (proxy) →", padL + w / 2 - 60, H - 8);
        g.fillStyle = "#9d174d"; g.font = "600 12px system-ui";
        g.fillText("● bạn chọn (proxy cao nhất)", padL + 8, padT + 14);
        g.fillStyle = "#0f766e";
        g.fillText("● tốt nhất thật sự", padL + 8, padT + 30);

        /* ---------- panel 2: duong cong toi uu qua muc ---------- */
        g2.clearRect(0, 0, W2, H2);
        var p2L = 52, p2R = 20, p2T = 28, p2B = 46;
        var w2 = W2 - p2L - p2R, h2 = H2 - p2T - p2B;
        var A = 1, B = 0.5;
        function fProxy(t) { return A * Math.sqrt(t); }
        function fThat(t) { return A * tt.rho * Math.sqrt(t) - B * t; }
        var tSao = Math.pow(A * tt.rho / (2 * B), 2);
        var yMax = Math.max(fProxy(1), fThat(Math.min(1, tSao))) * 1.15;
        function PX(t) { return p2L + t * w2; }
        function PY(v) { return p2T + h2 - v / yMax * h2; }

        g2.strokeStyle = V.mau("bd2"); g2.lineWidth = 1;
        for (i = 0; i <= 5; i++) {
          g2.beginPath(); g2.moveTo(p2L + i / 5 * w2, p2T);
          g2.lineTo(p2L + i / 5 * w2, p2T + h2); g2.stroke();
        }
        /* duong proxy */
        g2.strokeStyle = "#9d174d"; g2.lineWidth = 2.6; g2.beginPath();
        for (var s = 0; s <= 1.0001; s += 0.005) {
          var Yp = PY(fProxy(s));
          if (s === 0) g2.moveTo(PX(s), Yp); else g2.lineTo(PX(s), Yp);
        }
        g2.stroke();
        /* duong that */
        g2.strokeStyle = "#0f766e"; g2.lineWidth = 2.6; g2.beginPath();
        for (s = 0; s <= 1.0001; s += 0.005) {
          var Yt = PY(fThat(s));
          if (s === 0) g2.moveTo(PX(s), Yt); else g2.lineTo(PX(s), Yt);
        }
        g2.stroke();
        /* dinh */
        if (tSao <= 1) {
          g2.strokeStyle = "#0f766e"; g2.lineWidth = 1.5; g2.setLineDash([4, 3]);
          g2.beginPath(); g2.moveTo(PX(tSao), p2T); g2.lineTo(PX(tSao), p2T + h2); g2.stroke();
          g2.setLineDash([]);
          g2.fillStyle = "#0f766e"; g2.font = "600 11px system-ui";
          g2.fillText("★ đỉnh chất lượng THẬT", PX(tSao) + 6, p2T + 14);
        }
        /* vi tri hien tai */
        g2.fillStyle = V.mau("ac");
        g2.beginPath(); g2.arc(PX(tt.ap), PY(fProxy(tt.ap)), 6, 0, 7); g2.fill();
        g2.beginPath(); g2.arc(PX(tt.ap), PY(fThat(tt.ap)), 6, 0, 7); g2.fill();
        g2.strokeStyle = V.mau("ac"); g2.lineWidth = 1.4; g2.setLineDash([3, 3]);
        g2.beginPath(); g2.moveTo(PX(tt.ap), p2T); g2.lineTo(PX(tt.ap), p2T + h2); g2.stroke();
        g2.setLineDash([]);

        g2.strokeStyle = V.mau("bd"); g2.lineWidth = 1.5;
        g2.beginPath(); g2.moveTo(p2L, p2T + h2); g2.lineTo(p2L + w2, p2T + h2); g2.stroke();
        g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui";
        g2.fillText("điểm số ↑", 4, 16);
        g2.fillText("áp lực tối ưu (số bước RL / khoảng cách KL) →", p2L + w2 / 2 - 110, H2 - 10);
        g2.fillStyle = "#9d174d"; g2.font = "600 12px system-ui";
        g2.fillText("phần thưởng theo MÔ HÌNH PHẦN THƯỞNG — tăng đơn điệu", p2L + 8, p2T + 14);
        g2.fillStyle = "#0f766e";
        g2.fillText("chất lượng theo NGƯỜI ĐÁNH GIÁ — đạt đỉnh rồi giảm", p2L + 8, p2T + 30);

        oSo.innerHTML =
          '<div class="d"><span>Tương quan ρ</span><b>' + tt.rho.toFixed(2) + "</b></div>" +
          '<div class="d"><span>Số ứng viên n</span><b>' + tt.n + "</b></div>" +
          '<div class="d"><span>Proxy của mục được chọn</span><b>' + d[iP].p.toFixed(2) + " SD</b></div>" +
          '<div class="d"><span>Giá trị THẬT của nó</span><b>' + d[iP].t.toFixed(2) + " SD</b></div>" +
          '<div class="d"><span>Giá trị thật TỐT NHẤT</span><b>' + d[iT].t.toFixed(2) + " SD</b></div>" +
          '<div class="d"><span>★ Khoảng cách</span><b>' + khoang.toFixed(2) + " SD</b></div>" +
          '<div class="d"><span>Đỉnh chất lượng thật tại</span><b>' +
            (tSao <= 1 ? (tSao * 100).toFixed(0) + "% áp lực" : "ngoài dải") + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "PHÉP THAY THẾ" }),
        V.truot({ ten: "ρ — tương quan proxy ↔ mục tiêu thật", min: 0.3, max: 0.99, buoc: 0.01,
          giaTri: tt.rho, doi: function (v) { tt.rho = v; ve(); } }),
        V.el("h4", { text: "ÁP LỰC TỐI ƯU" }),
        V.truot({ ten: "n — số ứng viên bạn chọn từ", min: 2, max: 2000, buoc: 1, giaTri: tt.n,
          doi: function (v) { tt.n = v; ve(); } }),
        V.truot({ ten: "Áp lực tối ưu (biểu đồ dưới)", min: 0.02, max: 1, buoc: 0.01,
          giaTri: tt.ap, doi: function (v) { tt.ap = v; ve(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Bạn không đo được thứ bạn muốn, nên bạn đo một PHÉP THAY THẾ.</b> " +
          "Phép thay thế tương quan <code>ρ</code> với mục tiêu thật — thường khá cao, " +
          "và đó là lý do nó trông hợp lý.<br><br>" +
          "<b>Biểu đồ trên — chọn cực đại theo proxy.</b> Mỗi chấm là một ứng viên " +
          "(một cấu hình, một checkpoint, một câu trả lời). Bạn chỉ thấy trục ngang (proxy) " +
          "và chọn chấm xa nhất bên phải (<b>hồng</b>). Chấm tốt nhất <i>thật sự</i> là chấm " +
          "cao nhất (<b>xanh</b>).<ul>" +
          "<li><b>★ Kéo n từ 10 lên 2000 và giữ nguyên ρ.</b> Khoảng cách <b>lớn dần</b> — " +
          "với ρ = 0,9 nó đi từ khoảng <b>0,15 SD</b> lên gần <b>0,4 SD</b>.</li>" +
          "<li><b>Phép thay thế KHÔNG ĐỔI. Tương quan KHÔNG ĐỔI. Dữ liệu KHÔNG ĐỔI.</b> " +
          "Chỉ <b>áp lực tối ưu</b> đổi — và việc chọn từ nhiều ứng viên hơn " +
          "<b>khuếch đại đúng phần của proxy KHÔNG tương quan với mục tiêu</b>.</li>" +
          "<li><b>⇒ Mở rộng quy mô tính toán là một LÝ DO ĐỂ RÀ SOÁT LẠI HÀM MỤC TIÊU</b>, " +
          "không chỉ là một quyết định về hạ tầng. Một hàm phần thưởng \"đủ tốt\" ở 1.000 " +
          "lần thử có thể hỏng rõ rệt ở 100.000 — và <b>không có gì trong hệ thống báo cho " +
          "bạn biết</b>.</li></ul>" +
          "<b>Biểu đồ dưới — tối ưu quá mức trong RLHF.</b> ⚖️ Đây là một <b>mô hình minh hoạ</b> " +
          "cho hình dạng đã được đo trong tài liệu, không phải một phép đo:<ul>" +
          "<li>Đường <b>hồng</b> (phần thưởng theo mô hình phần thưởng) <b>tăng đơn điệu</b> — " +
          "nó không bao giờ giảm, và nó là thứ bạn nhìn thấy trong log huấn luyện.</li>" +
          "<li>Đường <b>xanh</b> (chất lượng theo người đánh giá) <b>đạt đỉnh rồi GIẢM</b>.</li>" +
          "<li><b>★ Và đây là điểm chết người: đường hồng ĐI THẲNG QUA đỉnh của đường xanh " +
          "mà không có bất kỳ đặc điểm nào</b> — không gãy khúc, không phẳng ra, không dao động. " +
          "<b>Nếu bạn chỉ nhìn thứ bạn đang tối ưu, bạn KHÔNG THỂ biết khi nào nên dừng.</b></li>" +
          "<li>Kéo ρ xuống 0,6: <b>đỉnh dịch sang trái</b> — phép thay thế càng tệ, bạn càng " +
          "phải dừng sớm.</li></ul>" +
          "<b>Ba biện pháp — và chỉ một cái cho bạn biết hai cái kia có hiệu quả không:</b><ul>" +
          "<li>① <b>Nhiều số đo cộng ràng buộc</b> — khó \"chạy theo một chiều\" hơn;</li>" +
          "<li>② <b>Quantilization</b> — lấy ngẫu nhiên từ top 5% thay vì lấy cực đại; " +
          "nó <b>giảm áp lực tối ưu một cách có chủ ý</b>, đúng biến số gây ra vấn đề;</li>" +
          "<li>③ <b>★ MỘT PHÉP ĐO KHÔNG AI TỐI ƯU</b> — giữ riêng, không đưa vào hàm mục tiêu, " +
          "không dùng để chọn mô hình. Vì ① và ② đều là <i>can thiệp vào quá trình tối ưu</i>, " +
          "câu hỏi \"chúng có hiệu quả không\" <b>không thể trả lời bằng bất kỳ số đo nào đang " +
          "tham gia tối ưu</b>. Bạn cần một điểm quan sát <b>ở ngoài hệ</b>.</li></ul>"
      });
      ve();
    }
  });
})();
