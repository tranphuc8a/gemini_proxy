/* =====================================================================
   vis-7-danh-gia.js — Do luong va danh gia (M03, M14, M15)
     1. hieu-chinh-nguong   Hieu chinh, ECE va nguong Chow      (M14 b.4)
     2. do-phan-giai        n, sigma, Delta va cuc dai nhieu lan (M15 b.4)
   ===================================================================== */

(function () {
  "use strict";
  var V = window.VIS;

  /* Ham phan phoi chuan tich luy (Abramowitz & Stegun 7.1.26). */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function logit(p) { return Math.log(p / (1 - p)); }
  function sig(z) { return 1 / (1 + Math.exp(-z)); }

  /* =================================================================
     1. HIEU CHINH, ECE VA NGUONG CHOW
     ================================================================= */
  demo({
    id: "hieu-chinh-nguong", nhom: "Hệ thống & đánh giá", mon: "M14",
    ten: "Hiệu chỉnh, ECE và ngưỡng tự động hoá",
    moTa: "Mô hình nói \"95% chắc chắn\" — nó đúng bao nhiêu phần trăm thật? " +
          "Và <b>có ngưỡng nào đủ an toàn để tự động hoá không?</b>",
    lienKet: '<a href="../web/index.html#/bai/m14-bai-04-ao-giac-va-do-tin-cay">M14 b.4</a> · ' +
             '<a href="../web/index.html#/bai/m03-bai-13-hieu-chinh-xac-suat-va-bat-dinh">M03 b.13</a>',
    dung: function (host) {
      var W = 540, H = 340, W2 = 540, H2 = 190;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = {
        tuTin: 0.40,      /* he so tu tin qua muc */
        nguong: 0.90,     /* nguong tu dong duyet */
        T: 1.0,           /* nhiet do hieu chinh */
        cSai: 20, cTuChoi: 2, giaTri: 1
      };
      var oSo = V.el("div", { class: "so-lieu" });
      var NHOM = [
        { lo: 0.5, hi: 0.6, n: 80 },
        { lo: 0.6, hi: 0.7, n: 120 },
        { lo: 0.7, hi: 0.8, n: 200 },
        { lo: 0.8, hi: 0.9, n: 300 },
        { lo: 0.9, hi: 1.0, n: 300 }
      ];

      /* Sinh cac nhom: do tin cay goc va do chinh xac THAT (khong doi theo T). */
      function duLieu() {
        var ds = NHOM.map(function (b) {
          var c0 = (b.lo + b.hi) / 2;
          /* do chinh xac that: keo ve 0,5 theo he so tu tin qua muc */
          var a = 0.5 + (c0 - 0.5) * (1 - tt.tuTin);
          /* ap hieu chinh nhiet do len DO TIN CAY (khong doi thu hang, khong doi a) */
          var c = tt.T === 1 ? c0 : sig(logit(Math.min(0.999, Math.max(0.001, c0))) / tt.T);
          return { c0: c0, c: c, a: a, n: b.n };
        });
        var N = ds.reduce(function (s, d) { return s + d.n; }, 0);
        var ece = ds.reduce(function (s, d) { return s + d.n / N * Math.abs(d.c - d.a); }, 0);
        var acc = ds.reduce(function (s, d) { return s + d.n * d.a; }, 0) / N;
        return { ds: ds, N: N, ece: ece, acc: acc };
      }

      function Ttot() {                 /* quet T de tim ECE nho nhat */
        var best = 1, bestE = 1e9, luu = tt.T;
        for (var T = 0.6; T <= 4.0; T += 0.02) {
          tt.T = T;
          var e = duLieu().ece;
          if (e < bestE) { bestE = e; best = T; }
        }
        tt.T = luu;
        return best;
      }

      function ve() {
        var D = duLieu(), ds = D.ds;
        var pSao = (tt.cSai - tt.cTuChoi) / (tt.giaTri + tt.cSai);

        /* ---------- bieu do do tin cay ---------- */
        g.clearRect(0, 0, W, H);
        var padL = 54, padB = 52, padT = 24, padR = 18;
        var w = W - padL - padR, h = H - padT - padB;

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        for (var i = 0; i <= 5; i++) {
          var yy = padT + h - i / 5 * h, xx = padL + i / 5 * w;
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.beginPath(); g.moveTo(xx, padT); g.lineTo(xx, padT + h); g.stroke();
        }
        /* duong cheo = hieu chinh hoan hao */
        g.strokeStyle = V.mau("tx3"); g.lineWidth = 1.5; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT); g.stroke();
        g.setLineDash([]);

        /* nguong Chow */
        var yChow = padT + h - pSao * h;
        g.strokeStyle = "#0f766e"; g.lineWidth = 2; g.setLineDash([6, 3]);
        g.beginPath(); g.moveTo(padL, yChow); g.lineTo(padL + w, yChow); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#0f766e"; g.font = "600 11px system-ui";
        g.fillText("ngưỡng Chow p* = " + pSao.toFixed(3), padL + 6, yChow - 6);

        /* nguong tu dong duyet */
        var xNg = padL + (tt.nguong - 0.5) / 0.5 * w;
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(xNg, padT); g.lineTo(xNg, padT + h); g.stroke();
        g.setLineDash([]);
        g.fillStyle = V.mau("ac"); g.font = "600 11px system-ui";
        g.fillText("ngưỡng tự động", xNg + 5, padT + 12);

        /* cac nhom */
        ds.forEach(function (d) {
          var X = padL + (d.c - 0.5) / 0.5 * w;
          var Y = padT + h - d.a * h;
          var r = 5 + Math.sqrt(d.n) * 0.45;
          var duoiChow = d.a < pSao;
          /* duong noi toi duong cheo = khoang cach hieu chinh */
          g.strokeStyle = duoiChow ? "#9d174d" : "#0f766e";
          g.globalAlpha = 0.5; g.lineWidth = 2;
          g.beginPath(); g.moveTo(X, Y); g.lineTo(X, padT + h - d.c * h); g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = duoiChow ? "#9d174d" : "#0f766e";
          g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
          g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "center";
          g.fillText(d.n, X, Y - r - 5);
          g.textAlign = "left";
        });

        /* truc */
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();
        g.fillStyle = V.mau("tx3"); g.font = "11px system-ui"; g.textAlign = "right";
        for (i = 0; i <= 5; i++) g.fillText((i * 20) + "%", padL - 8, padT + h - i / 5 * h + 4);
        g.textAlign = "center";
        for (i = 0; i <= 5; i++) g.fillText((50 + i * 10) + "%", padL + i / 5 * w, padT + h + 18);
        g.textAlign = "left";
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("độ chính xác THẬT ↑", 4, 14);
        g.fillText("độ tin cậy mô hình NÓI →", padL + w / 2 - 66, H - 8);

        /* ---------- hau qua cua nguong ---------- */
        g2.clearRect(0, 0, W2, H2);
        var tren = ds.filter(function (d) { return d.c >= tt.nguong; });
        var nTren = tren.reduce(function (s, d) { return s + d.n; }, 0);
        var accTren = nTren ? tren.reduce(function (s, d) { return s + d.n * d.a; }, 0) / nTren : 0;
        var loiTren = 1 - accTren;
        var pctTuDong = nTren / D.N;

        var bx = 24, bw = W2 - 48, by = 46, bh = 34;
        g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui";
        g2.fillText("Luồng được TỰ ĐỘNG DUYỆT (độ tin cậy ≥ " +
                    (tt.nguong * 100).toFixed(0) + "%)", bx, 24);
        g2.fillStyle = V.mau("bd2"); g2.fillRect(bx, by, bw, bh);
        if (nTren) {
          g2.fillStyle = "#0f766e"; g2.fillRect(bx, by, bw * accTren, bh);
          g2.fillStyle = "#9d174d"; g2.fillRect(bx + bw * accTren, by, bw * loiTren, bh);
          g2.fillStyle = "#fff"; g2.font = "600 12px system-ui";
          if (accTren > 0.25) g2.fillText("đúng " + (accTren * 100).toFixed(1) + "%", bx + 10, by + 22);
          if (loiTren > 0.12) {
            g2.textAlign = "right";
            g2.fillText("SAI " + (loiTren * 100).toFixed(1) + "%", bx + bw - 10, by + 22);
            g2.textAlign = "left";
          }
        } else {
          g2.fillStyle = V.mau("tx3"); g2.font = "12px system-ui";
          g2.fillText("không ca nào vượt ngưỡng", bx + 10, by + 22);
        }

        /* danh gia Chow */
        var datChow = nTren > 0 && accTren >= pSao;
        var coNhomDat = ds.some(function (d) { return d.a >= pSao; });
        g2.font = "600 13px system-ui";
        g2.fillStyle = datChow ? "#0f766e" : "#9d174d";
        g2.fillText(datChow
          ? "✓ Luồng tự động ĐẠT tiêu chí Chow (" + (accTren * 100).toFixed(1) + "% ≥ " +
            (pSao * 100).toFixed(1) + "%)"
          : "✗ Luồng tự động KHÔNG đạt tiêu chí Chow (" + (accTren * 100).toFixed(1) + "% < " +
            (pSao * 100).toFixed(1) + "%)", bx, by + bh + 26);
        if (!coNhomDat) {
          g2.fillStyle = "#9d174d"; g2.font = "600 13px system-ui";
          g2.fillText("★ KHÔNG NHÓM NÀO đạt p* — không có ngưỡng nào tự động hoá được.",
                      bx, by + bh + 48);
        } else {
          g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
          g2.fillText("Chi phí kỳ vọng nếu tự động toàn bộ luồng này: " +
            (nTren * (loiTren * tt.cSai - accTren * tt.giaTri)).toFixed(0) +
            "  (âm = có lời)", bx, by + bh + 48);
        }

        oSo.innerHTML =
          '<div class="d"><span>ECE</span><b>' + D.ece.toFixed(3) + "</b></div>" +
          '<div class="d"><span>Độ chính xác tổng</span><b>' + (D.acc * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Nhóm tin cậy cao nhất nói</span><b>' +
            (ds[4].c * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>…thực tế đúng</span><b>' + (ds[4].a * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Ngưỡng Chow p*</span><b>' + pSao.toFixed(3) + "</b></div>" +
          '<div class="d"><span>% ca được tự động</span><b>' + (pctTuDong * 100).toFixed(0) + "%</b></div>" +
          '<div class="d"><span>★ Tỷ lệ lỗi luồng tự động</span><b>' +
            (nTren ? (loiTren * 100).toFixed(1) + "%" : "—") + "</b></div>";
      }

      var dkT = V.truot({ ten: "Nhiệt độ hiệu chỉnh T", min: 0.6, max: 4, buoc: 0.02,
        giaTri: tt.T, doi: function (v) { tt.T = v; ve(); } });

      var dk = [
        V.el("h4", { text: "MÔ HÌNH" }),
        V.truot({ ten: "Mức tự tin quá mức", min: 0, max: 0.7, buoc: 0.01, giaTri: tt.tuTin,
          doi: function (v) { tt.tuTin = v; ve(); } }),
        V.el("h4", { text: "QUY TẮC TỰ ĐỘNG HOÁ" }),
        V.truot({ ten: "Ngưỡng tự động duyệt", min: 0.5, max: 0.999, buoc: 0.005,
          giaTri: tt.nguong, doi: function (v) { tt.nguong = v; ve(); } }),
        V.el("h4", { text: "CHI PHÍ (cho ngưỡng Chow)" }),
        V.truot({ ten: "Chi phí một quyết định SAI", min: 1, max: 60, buoc: 1, giaTri: tt.cSai,
          doi: function (v) { tt.cSai = v; ve(); } }),
        V.truot({ ten: "Chi phí TỪ CHỐI (chuyển người)", min: 0, max: 20, buoc: 0.5,
          giaTri: tt.cTuChoi, doi: function (v) { tt.cTuChoi = v; ve(); } }),
        V.truot({ ten: "Giá trị một quyết định ĐÚNG", min: 0.1, max: 10, buoc: 0.1,
          giaTri: tt.giaTri, doi: function (v) { tt.giaTri = v; ve(); } }),
        V.el("h4", { text: "HIỆU CHỈNH NHIỆT ĐỘ" }),
        dkT,
        V.nut("Tìm T tốt nhất", function () {
          tt.T = Ttot(); dkT.datGiaTri(tt.T); ve();
        }, "chinh"),
        V.nut("Đặt lại T = 1", function () { tt.T = 1; dkT.datGiaTri(1); ve(); }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Mỗi chấm là một nhóm dự đoán</b> (kích thước = số mẫu). " +
          "Trục ngang: độ tin cậy mô hình <i>nói ra</i>. Trục dọc: tỷ lệ nó <i>thực sự đúng</i>. " +
          "Đường chéo nét đứt là <b>hiệu chỉnh hoàn hảo</b>; đoạn nối dọc là <b>khoảng cách " +
          "hiệu chỉnh</b>, và trung bình có trọng số của chúng chính là <b>ECE</b>.<ul>" +
          "<li><b>Mọi chấm nằm DƯỚI đường chéo ⇒ mô hình tự tin quá mức.</b> Và để ý: " +
          "khoảng cách <b>lớn dần theo mức tin cậy</b> — ★ <b>mô hình sai nhiều nhất ở đúng " +
          "nơi bạn tin nó nhất</b>. Đây là hình dạng nguy hiểm nhất, vì nó là hình dạng mà " +
          "mọi quy tắc theo ngưỡng vấp phải.</li></ul>" +
          "<b>★ Điểm mấu chốt — hãy nhìn thanh dưới:</b> ở cấu hình mặc định, quy tắc " +
          "\"tự động duyệt nếu tin cậy ≥ 90%\" trên thực tế đang tự động duyệt một luồng có " +
          "<b>tỷ lệ lỗi hơn 20%</b> — trong khi nó <i>nghe như</i> đang duyệt một luồng lỗi 10%.<br><br>" +
          "<b>Ngưỡng Chow</b> <code>p* = (C_sai − C_từ_chối)/(V + C_sai)</code> là ngưỡng mà " +
          "lý thuyết quyết định nói bạn <i>nên</i> tự quyết: chỉ khi <b>xác suất đúng THẬT</b> " +
          "vượt p*.<ul>" +
          "<li><b>Với chi phí mặc định (20 / 2 / 1), p* = 0,857.</b> Nhưng nhóm tự tin nhất " +
          "chỉ đúng ~77% ⇒ <b>★ KHÔNG CÓ NGƯỠNG NÀO thoả tiêu chí</b>. Câu trả lời đúng " +
          "không phải \"chọn ngưỡng khác\" mà là <b>\"chưa tự động hoá được phần này\"</b>.</li>" +
          "<li>Kéo \"chi phí một quyết định sai\" xuống 4 và xem p* tụt — với hậu quả nhẹ, " +
          "tự động hoá trở nên hợp lý. <b>Ngưỡng không phải một lựa chọn kỹ thuật; nó là " +
          "một phát biểu về chi phí.</b></li></ul>" +
          "<b>Bấm \"Tìm T tốt nhất\"</b> để chạy hiệu chỉnh nhiệt độ. Bạn sẽ thấy:<ul>" +
          "<li><b>ECE giảm mạnh</b> — các chấm về gần đường chéo;</li>" +
          "<li><b>★ ĐỘ CHÍNH XÁC TỔNG KHÔNG ĐỔI</b> — vì T chỉ co giãn logit, không đổi thứ hạng, " +
          "nên argmax giữ nguyên. Hiệu chỉnh là một cải thiện <b>miễn phí về độ chính xác</b>;</li>" +
          "<li>nhưng <b>số ca vượt ngưỡng giảm</b> — hệ trở nên <i>thành thật hơn</i> về việc " +
          "nó không chắc, và đó chính là điều bạn cần để quy tắc ngưỡng có nghĩa.</li></ul>" +
          "<b>⇒ Hiệu chỉnh không phải một cải tiến chất lượng. Nó là ĐIỀU KIỆN TIÊN QUYẾT " +
          "để câu hỏi \"có nên tự động hoá không\" trở nên trả lời được.</b>"
      });
      ve();
    }
  });

  /* =================================================================
     2. DO PHAN GIAI: n, sigma, Delta VA CUC DAI NHIEU LAN THU
     ================================================================= */
  demo({
    id: "do-phan-giai", nhom: "Hệ thống & đánh giá", mon: "M15",
    ten: "Độ phân giải: bạn phát hiện được cải thiện nhỏ đến đâu",
    moTa: "Hai câu hỏi quyết định bạn tin được con số nào: <b>cần bao nhiêu hạt giống</b>, " +
          "và <b>cực đại của k lần thử trông lớn thế nào khi thật ra không có gì</b>.",
    lienKet: '<a href="../web/index.html#/bai/m15-bai-04-thiet-ke-thi-nghiem">M15 b.4</a> · ' +
             '<a href="../web/index.html#/bai/m13-bai-02-quan-ly-thi-nghiem-va-phien-ban">M13 b.2</a>',
    dung: function (host) {
      var W = 560, H = 250, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = { sig: 0.8, delta: 1.0, n: 5, ghepCap: false, k: 100, hat: 11 };
      var oSo = V.el("div", { class: "so-lieu" });

      function sigHieuDung() { return tt.ghepCap ? tt.sig * 0.45 : tt.sig; }

      function ve() {
        var s = sigHieuDung();
        var se = s * Math.sqrt(2 / tt.n);          /* SE cua HIEU giua hai nhanh */
        var z = tt.delta / se;
        var power = Phi(z - 1.96) + Phi(-z - 1.96);
        var nCan = Math.ceil(16 * s * s / (tt.delta * tt.delta));
        var dMin = 4 * s / Math.sqrt(tt.n);

        /* ---------- panel 1: phan bo hieu quan sat duoc ---------- */
        g.clearRect(0, 0, W, H);
        var padL = 40, padR = 20, padT = 30, padB = 44;
        var w = W - padL - padR, h = H - padT - padB;
        var xMax = Math.max(3 * se, Math.abs(tt.delta) * 1.9, 0.6);
        var xMin = -xMax;
        function X(v) { return padL + (v - xMin) / (xMax - xMin) * w; }

        /* vung khong ket luan duoc: |hieu| < 1,96 SE */
        g.fillStyle = V.mau("bd2");
        g.fillRect(X(-1.96 * se), padT, X(1.96 * se) - X(-1.96 * se), h);
        g.fillStyle = V.mau("tx3"); g.font = "11px system-ui"; g.textAlign = "center";
        g.fillText("vùng KHÔNG kết luận được", X(0), padT + 14);
        g.textAlign = "left";

        /* duong cong mat do quanh delta */
        g.strokeStyle = "#9d174d"; g.lineWidth = 2.4; g.beginPath();
        var pk = 1 / (se * Math.sqrt(2 * Math.PI));
        for (var px = 0; px <= w; px += 2) {
          var v = xMin + px / w * (xMax - xMin);
          var d = Math.exp(-0.5 * Math.pow((v - tt.delta) / se, 2)) / (se * Math.sqrt(2 * Math.PI));
          var Y = padT + h - d / pk * (h - 24);
          if (px === 0) g.moveTo(padL + px, Y); else g.lineTo(padL + px, Y);
        }
        g.stroke();

        /* to phan nam ngoai vung khong ket luan (= power) */
        g.fillStyle = "#0f766e"; g.globalAlpha = 0.3; g.beginPath();
        var batDau = false;
        for (px = 0; px <= w; px += 2) {
          v = xMin + px / w * (xMax - xMin);
          if (v < 1.96 * se) continue;
          d = Math.exp(-0.5 * Math.pow((v - tt.delta) / se, 2)) / (se * Math.sqrt(2 * Math.PI));
          Y = padT + h - d / pk * (h - 24);
          if (!batDau) { g.moveTo(padL + px, padT + h); batDau = true; }
          g.lineTo(padL + px, Y);
        }
        if (batDau) { g.lineTo(padL + w, padT + h); g.closePath(); g.fill(); }
        g.globalAlpha = 1;

        /* vach delta that va vach 0 */
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(0), padT); g.lineTo(X(0), padT + h); g.stroke();
        g.strokeStyle = "#9d174d"; g.lineWidth = 2; g.setLineDash([5, 3]);
        g.beginPath(); g.moveTo(X(tt.delta), padT); g.lineTo(X(tt.delta), padT + h); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#9d174d"; g.font = "600 11px system-ui";
        g.fillText("Δ thật = " + tt.delta.toFixed(2), X(tt.delta) + 5, padT + 12);
        g.fillStyle = V.mau("tx3");
        g.fillText("0", X(0) - 3, padT + h + 16);

        g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Phân bố của HIỆU bạn sẽ quan sát được (n = " + tt.n + " hạt giống/nhánh)",
                   padL, 16);
        g.fillStyle = "#0f766e"; g.font = "600 12px system-ui";
        g.fillText("vùng xanh = xác suất bạn PHÁT HIỆN được: " + (power * 100).toFixed(0) + "%",
                   padL, H - 10);

        /* ---------- panel 2: cuc dai cua k lan thu ---------- */
        g2.clearRect(0, 0, W2, H2);
        var R = V.rng(tt.hat);
        var M = 900, maxes = [], tong = 0;
        for (var r = 0; r < M; r++) {
          var mx = -1e9;
          for (var i = 0; i < tt.k; i++) { var u = R.chuan(); if (u > mx) mx = u; }
          maxes.push(mx); tong += mx;
        }
        var eMax = tong / M;
        var eMaxDiem = eMax * s;      /* doi ra don vi "diem" cua so do */

        var pL = 44, pR = 20, pT = 30, pB = 46;
        var w2 = W2 - pL - pR, h2 = H2 - pT - pB;
        var lo = -1, hi = Math.max(4.6, eMax + 1.2);
        function X2(v) { return pL + (v - lo) / (hi - lo) * w2; }

        /* histogram cuc dai */
        var B = 46, bin = new Array(B).fill(0);
        maxes.forEach(function (v) {
          var b = Math.floor((v - lo) / (hi - lo) * B);
          if (b >= 0 && b < B) bin[b]++;
        });
        var bmax = Math.max.apply(null, bin) || 1;
        for (i = 0; i < B; i++) {
          var hh = bin[i] / bmax * (h2 - 20);
          g2.fillStyle = "#b45309"; g2.globalAlpha = 0.75;
          g2.fillRect(pL + i / B * w2, pT + h2 - hh, w2 / B - 1, hh);
          g2.globalAlpha = 1;
        }
        /* vach 0 = su that (khong co cai thien nao) */
        g2.strokeStyle = "#0f766e"; g2.lineWidth = 2.5;
        g2.beginPath(); g2.moveTo(X2(0), pT); g2.lineTo(X2(0), pT + h2); g2.stroke();
        g2.fillStyle = "#0f766e"; g2.font = "600 11px system-ui";
        g2.fillText("SỰ THẬT: mọi cấu hình đều NHƯ NHAU (hiệu = 0)", X2(0) + 6, pT + 12);
        /* vach E[max] */
        g2.strokeStyle = "#9d174d"; g2.lineWidth = 2.5; g2.setLineDash([5, 3]);
        g2.beginPath(); g2.moveTo(X2(eMax), pT); g2.lineTo(X2(eMax), pT + h2); g2.stroke();
        g2.setLineDash([]);
        g2.fillStyle = "#9d174d"; g2.font = "600 11px system-ui";
        g2.fillText("E[max] = +" + eMax.toFixed(2) + " SD", X2(eMax) + 6, pT + 28);

        g2.strokeStyle = V.mau("bd"); g2.lineWidth = 1.5;
        g2.beginPath(); g2.moveTo(pL, pT + h2); g2.lineTo(pL + w2, pT + h2); g2.stroke();
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui"; g2.textAlign = "center";
        for (var t = Math.ceil(lo); t <= hi; t++) g2.fillText(t + " SD", X2(t), pT + h2 + 16);
        g2.textAlign = "left";
        g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui";
        g2.fillText("Bạn thử " + tt.k + " cấu hình — tất cả THỰC SỰ như nhau — rồi báo cáo cái tốt nhất:",
                    pL - 30, 16);
        g2.fillStyle = "#9d174d"; g2.font = "600 12px system-ui";
        g2.fillText("★ \"cải thiện\" bạn sẽ báo cáo: +" + eMaxDiem.toFixed(2) +
                    " điểm — thuần do may mắn", pL - 30, H2 - 10);

        oSo.innerHTML =
          '<div class="d"><span>σ hiệu dụng</span><b>' + s.toFixed(3) +
            (tt.ghepCap ? " (ghép cặp)" : "") + "</b></div>" +
          '<div class="d"><span>SE của hiệu</span><b>' + se.toFixed(3) + "</b></div>" +
          '<div class="d"><span>★ Δ nhỏ nhất phát hiện được</span><b>' + dMin.toFixed(2) + "</b></div>" +
          '<div class="d"><span>Xác suất phát hiện (power)</span><b>' +
            (power * 100).toFixed(0) + "%</b></div>" +
          '<div class="d"><span>n cần cho Δ = ' + tt.delta.toFixed(2) + "</span><b>" +
            nCan + " hạt giống</b></div>" +
          '<div class="d"><span>E[max] của ' + tt.k + " lần thử</span><b>+" +
            eMax.toFixed(2) + " SD</b></div>" +
          '<div class="d"><span>★ = bao nhiêu điểm ảo</span><b>+' + eMaxDiem.toFixed(2) + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "THÍ NGHIỆM CỦA BẠN" }),
        V.truot({ ten: "σ — độ lệch chuẩn giữa hạt giống", min: 0.1, max: 2.5, buoc: 0.05,
          giaTri: tt.sig, doi: function (v) { tt.sig = v; ve(); } }),
        V.truot({ ten: "Δ — hiệu ứng THẬT (điểm)", min: 0.1, max: 3, buoc: 0.05,
          giaTri: tt.delta, doi: function (v) { tt.delta = v; ve(); } }),
        V.truot({ ten: "n — số hạt giống mỗi nhánh", min: 1, max: 60, buoc: 1, giaTri: tt.n,
          doi: function (v) { tt.n = v; ve(); } }),
        V.danhDau({ ten: "★ So THEO CẶP (cùng hạt giống) — miễn phí", giaTri: tt.ghepCap,
          doi: function (v) { tt.ghepCap = v; ve(); } }),
        V.el("h4", { text: "CỰC ĐẠI TRÊN NHIỀU LẦN THỬ" }),
        V.truot({ ten: "k — số cấu hình đã quét", min: 2, max: 500, buoc: 1, giaTri: tt.k,
          doi: function (v) { tt.k = v; ve(); } }),
        V.truot({ ten: "Hạt giống mô phỏng", min: 1, max: 30, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Hai câu hỏi độc lập, và cả hai đều phải trả lời TRƯỚC khi chạy.</b><br><br>" +
          "<b>① Biểu đồ trên — bạn có đủ hạt giống không?</b><br>" +
          "Giả sử tồn tại một hiệu ứng thật <code>Δ</code>. Vì mỗi lần chạy có nhiễu, " +
          "hiệu bạn <i>quan sát được</i> là một biến ngẫu nhiên quanh Δ. Vùng xám là dải " +
          "<code>±1,96 SE</code> — nếu kết quả rơi vào đó, bạn <b>không kết luận được gì</b>.<ul>" +
          "<li><b>Với σ = 0,8 và n = 5, Δ nhỏ nhất phát hiện được là ~1,43 điểm.</b> " +
          "Kéo n xuống 3: con số thành <b>1,85</b>. " +
          "⇒ ★ Phần lớn cải thiện được báo cáo trong tài liệu nằm ở <b>0,3–1,0 điểm</b>, " +
          "thường với ít hoặc không có thông tin về phương sai. Đây không phải một cáo buộc " +
          "về sự trung thực — nó là một phát biểu về <b>độ phân giải</b>.</li>" +
          "<li><b>★ Bật \"so theo cặp\".</b> Cùng n, cùng dữ liệu, không thêm một lần chạy nào — " +
          "nhưng σ hiệu dụng giảm mạnh vì phương sai chung bị triệt tiêu " +
          "(<code>Var(A−B) = Var(A)+Var(B)−2Cov(A,B)</code>). " +
          "<b>Đây là cách tăng độ nhạy RẺ NHẤT có sẵn, và nó hoàn toàn miễn phí.</b></li>" +
          "<li>Và vì <code>n ≈ 16σ²/Δ²</code> tỷ lệ với <b>σ bình phương</b>, " +
          "<b>giảm σ một nửa giảm n bốn lần</b> — luôn thử giảm σ trước khi xin thêm GPU.</li></ul>" +
          "<b>② Biểu đồ dưới — con số tốt nhất của bạn có thật không?</b><br>" +
          "Ở đây <b>không có cải thiện nào cả</b>: mọi cấu hình đều giống hệt nhau (vạch xanh ở 0). " +
          "Ta chỉ quét <code>k</code> cấu hình và báo cáo cái tốt nhất.<ul>" +
          "<li><b>Với k = 100, cực đại kỳ vọng là khoảng +2,5 SD</b> — tức là hơn " +
          "<b>+2 điểm</b> với σ = 0,8. <b>Thuần do may mắn.</b></li>" +
          "<li>★ Đây là lý do <b>\"chúng tôi thử 200 cấu hình\" và \"chúng tôi thử 5 cấu hình\" " +
          "là hai kết quả khác nhau</b>, ngay cả khi hai bên báo cùng một con số. " +
          "Và nó là lý do <b>số cấu hình đã thử của MỖI bên</b> phải được ghi lại tự động.</li>" +
          "<li><b>Biện pháp đối phó rẻ nhất: LẦN CHẠY XÁC NHẬN.</b> Sau khi chọn cấu hình tốt " +
          "nhất, chạy lại nó với <b>hạt giống mới</b> trên tập giữ kín, và <b>báo cáo con số đó</b>. " +
          "Con số dùng để <i>chọn</i> và con số dùng để <i>báo cáo</i> phải đến từ hai lần chạy " +
          "khác nhau.</li></ul>" +
          "<b>⇒ Hai biểu đồ này là hai nửa của cùng một câu hỏi: <i>con số này có phải một " +
          "phép đo không, hay nó là nhiễu được chọn lọc?</i></b>"
      });
      ve();
    }
  });
})();
