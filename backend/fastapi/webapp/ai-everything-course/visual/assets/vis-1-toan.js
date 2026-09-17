/* =====================================================================
   vis-1-toan.js — demo cho M02 (toan nen tang)
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     1. GRADIENT DESCENT tren mat mat mat 2 chieu
     ================================================================== */
  demo({
    id: "gradient-descent", nhom: "Toán nền tảng", mon: "M02",
    ten: "Gradient descent trên mặt mất mát",
    moTa: "Kéo learning rate lên tới khi thuật toán phân kỳ. Đổi sang thung lũng hẹp " +
          "để thấy vì sao momentum tồn tại.",
    lienKet: '<a href="../web/index.html#/bai/m02-bai-11-toi-uu-lien-tuc-va-gradient-descent">M02 b.11</a>' +
             ' · <a href="../web/index.html#/bai/m05-bai-09-thuat-toan-toi-uu-hien-dai">M05 b.9</a>',
    dung: function (host) {
      var W = 520, H = 420, XM = 3.2, YM = 2.4;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(-XM, XM, -YM, YM);

      var MAT = {
        bat: {
          ten: "Bát tròn — điều kiện tốt",
          f: function (x, y) { return 0.5 * (x * x + y * y); },
          gr: function (x, y) { return [x, y]; }
        },
        hep: {
          ten: "Thung lũng hẹp — điều kiện xấu",
          f: function (x, y) { return 0.5 * (x * x + 25 * y * y); },
          gr: function (x, y) { return [x, 25 * y]; }
        },
        rosen: {
          ten: "Rosenbrock (chuối)",
          f: function (x, y) { return (1 - x) * (1 - x) + 12 * (y - x * x) * (y - x * x); },
          gr: function (x, y) {
            return [-2 * (1 - x) - 48 * x * (y - x * x), 24 * (y - x * x)];
          }
        },
        haicuc: {
          ten: "Hai cực tiểu — phi lồi",
          f: function (x, y) {
            return 0.35 * (x * x * x * x - 5 * x * x + y * y * 4) + 0.5 * x + 3;
          },
          gr: function (x, y) { return [0.35 * (4 * x * x * x - 10 * x) + 0.5, 0.35 * 8 * y]; }
        }
      };

      var tt = {
        mat: "bat", lr: 0.12, mom: 0.0, thuat: "gd",
        x0: -2.4, y0: 1.7, nhieu: 0
      };
      var nen = document.createElement("canvas");
      nen.width = W; nen.height = H;

      function veNen() {
        var ng = nen.getContext("2d");
        var img = ng.createImageData(W, H);
        var f = MAT[tt.mat].f, vmax = 0;
        var buf = new Float32Array(W * H);
        for (var py = 0; py < H; py++) {
          for (var px = 0; px < W; px++) {
            var v = f(T.nx(px), T.ny(py));
            buf[py * W + px] = v; if (v > vmax) vmax = v;
          }
        }
        for (var i = 0; i < W * H; i++) {
          var t = Math.log(1 + buf[i]) / Math.log(1 + vmax);
          var c = V.thangMau(t);
          var m = c.match(/\d+/g);
          img.data[i * 4] = +m[0]; img.data[i * 4 + 1] = +m[1];
          img.data[i * 4 + 2] = +m[2]; img.data[i * 4 + 3] = 255;
        }
        ng.putImageData(img, 0, 0);
        /* duong dong muc: ve cac duong muc log cach deu */
        ng.strokeStyle = "rgba(255,255,255,.28)"; ng.lineWidth = 1;
        for (var k = 1; k <= 12; k++) {
          var muc = Math.exp(k / 12 * Math.log(1 + vmax)) - 1;
          ng.beginPath();
          for (var px2 = 0; px2 < W; px2 += 2) {
            for (var py2 = 0; py2 < H - 2; py2 += 2) {
              var a = buf[py2 * W + px2], b = buf[(py2 + 2) * W + px2];
              if ((a - muc) * (b - muc) < 0) { ng.moveTo(px2, py2); ng.lineTo(px2 + 2, py2); }
            }
          }
          ng.stroke();
        }
      }

      function chay() {
        var M = MAT[tt.mat];
        var x = tt.x0, y = tt.y0, vx = 0, vy = 0;
        var mx = 0, my = 0, sx = 0, sy = 0;         /* trang thai Adam */
        var duong = [[x, y]];
        var R = V.rng(7);
        for (var t = 1; t <= 260; t++) {
          var gr = M.gr(x, y);
          var gx = gr[0] + tt.nhieu * R.chuan();
          var gy = gr[1] + tt.nhieu * R.chuan();
          if (tt.thuat === "gd") {
            x -= tt.lr * gx; y -= tt.lr * gy;
          } else if (tt.thuat === "mom") {
            vx = tt.mom * vx - tt.lr * gx; vy = tt.mom * vy - tt.lr * gy;
            x += vx; y += vy;
          } else {                                   /* Adam */
            var b1 = 0.9, b2 = 0.999, eps = 1e-8;
            mx = b1 * mx + (1 - b1) * gx; my = b1 * my + (1 - b1) * gy;
            sx = b2 * sx + (1 - b2) * gx * gx; sy = b2 * sy + (1 - b2) * gy * gy;
            var mhx = mx / (1 - Math.pow(b1, t)), mhy = my / (1 - Math.pow(b1, t));
            var shx = sx / (1 - Math.pow(b2, t)), shy = sy / (1 - Math.pow(b2, t));
            x -= tt.lr * mhx / (Math.sqrt(shx) + eps);
            y -= tt.lr * mhy / (Math.sqrt(shy) + eps);
          }
          if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 50 || Math.abs(y) > 50) {
            duong.push([x, y]); break;
          }
          duong.push([x, y]);
        }
        return duong;
      }

      var oSoLieu = V.el("div", { class: "so-lieu" });

      function ve() {
        g.clearRect(0, 0, W, H);
        g.drawImage(nen, 0, 0);
        var duong = chay();
        var M = MAT[tt.mat];

        /* duong di */
        g.lineWidth = 2; g.strokeStyle = "#ffffff";
        g.beginPath();
        var phanKy = false;
        for (var i = 0; i < duong.length; i++) {
          var p = duong[i];
          if (!isFinite(p[0]) || Math.abs(p[0]) > XM * 3) { phanKy = true; break; }
          var px = T.x(p[0]), py = T.y(p[1]);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
        /* cac diem */
        for (var j = 0; j < duong.length; j += 4) {
          var q = duong[j];
          if (!isFinite(q[0]) || Math.abs(q[0]) > XM * 1.2 || Math.abs(q[1]) > YM * 1.2) continue;
          g.fillStyle = "rgba(255,255,255,.85)";
          g.beginPath(); g.arc(T.x(q[0]), T.y(q[1]), 2.2, 0, 7); g.fill();
        }
        /* diem bat dau */
        g.fillStyle = "#22c55e"; g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.beginPath(); g.arc(T.x(tt.x0), T.y(tt.y0), 6, 0, 7); g.fill(); g.stroke();

        var cuoi = duong[duong.length - 1];
        var fCuoi = (isFinite(cuoi[0]) && Math.abs(cuoi[0]) < 50) ? M.f(cuoi[0], cuoi[1]) : Infinity;
        oSoLieu.innerHTML =
          '<div class="d"><span>Số bước</span><b>' + (duong.length - 1) + "</b></div>" +
          '<div class="d"><span>f cuối</span><b>' +
            (isFinite(fCuoi) ? fCuoi.toFixed(4) : "∞ (phân kỳ)") + "</b></div>" +
          '<div class="d"><span>Vị trí cuối</span><b>' +
            (isFinite(cuoi[0]) ? "(" + cuoi[0].toFixed(2) + ", " + cuoi[1].toFixed(2) + ")" : "—") +
          "</b></div>" +
          (phanKy ? '<div style="color:var(--loi);font-weight:600;margin-top:6px">⚠ PHÂN KỲ — learning rate quá lớn</div>' : "");
      }

      cv.addEventListener("click", function (e) {
        var r = cv.getBoundingClientRect();
        tt.x0 = T.nx(e.clientX - r.left);
        tt.y0 = T.ny(e.clientY - r.top);
        ve();
      });

      var dkMom = V.truot({ ten: "Momentum β", min: 0, max: 0.98, buoc: 0.01, giaTri: tt.mom,
        doi: function (v) { tt.mom = v; ve(); } });

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.chon({
          ten: "Mặt mất mát", giaTri: tt.mat,
          muc: Object.keys(MAT).map(function (k) { return { v: k, t: MAT[k].ten }; }),
          doi: function (v) { tt.mat = v; veNen(); ve(); }
        }),
        V.chon({
          ten: "Thuật toán", giaTri: tt.thuat,
          muc: [{ v: "gd", t: "Gradient descent" }, { v: "mom", t: "Momentum" }, { v: "adam", t: "Adam" }],
          doi: function (v) { tt.thuat = v; ve(); }
        }),
        V.truot({ ten: "Learning rate", min: 0.001, max: 0.6, buoc: 0.001, giaTri: tt.lr,
          doi: function (v) { tt.lr = v; ve(); } }),
        dkMom,
        V.truot({ ten: "Nhiễu gradient (SGD)", min: 0, max: 1.5, buoc: 0.05, giaTri: tt.nhieu,
          doi: function (v) { tt.nhieu = v; ve(); } }),
        V.el("p", { class: "d-lk", text: "Bấm vào hình để đổi điểm xuất phát." }),
        oSoLieu
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Ba thí nghiệm nên làm:</b><ul>" +
          "<li><b>Phân kỳ.</b> Chọn <i>Bát tròn</i>, tăng learning rate dần. Có một ngưỡng " +
          "rõ rệt: dưới ngưỡng thì hội tụ, trên ngưỡng thì bay ra vô cực. Với hàm bậc hai " +
          "<code>f = &frac12;&middot;&lambda;&middot;x&sup2;</code>, ngưỡng đúng là <code>2/&lambda;</code> — kiểm lại bằng số.</li>" +
          "<li><b>Vì sao cần momentum.</b> Chọn <i>Thung lũng hẹp</i> với GD thuần: đường đi " +
          "zigzag qua lại vì gradient theo trục dốc lớn hơn trục thoải 25 lần. Bật momentum " +
          "0,9: dao động triệt tiêu nhau, thành phần dọc thung lũng được tích luỹ.</li>" +
          "<li><b>Cực tiểu địa phương.</b> Chọn <i>Hai cực tiểu</i> và bấm ở các vị trí khác " +
          "nhau. Điểm xuất phát quyết định kết quả — nhưng chú ý: trong mạng neuron thật, " +
          "cực tiểu địa phương <i>không</i> phải vấn đề chính; điểm yên ngựa mới là.</li>" +
          "</ul><b>Adam</b> chuẩn hoá theo từng toạ độ nên nó gần như miễn nhiễm với thung " +
          "lũng hẹp — đó là lý do nó là mặc định trong học sâu."
      });

      veNen(); ve();
    }
  });

  /* ==================================================================
     2. SOFTMAX va NHIET DO
     ================================================================== */
  demo({
    id: "softmax-nhiet-do", nhom: "Toán nền tảng", mon: "M02",
    ten: "Softmax và nhiệt độ",
    moTa: "Cùng một bộ logit, nhiệt độ quyết định phân phối sắc hay phẳng. " +
          "Đây là cùng công thức với mô phỏng luyện kim và với ε-greedy.",
    lienKet: '<a href="../web/index.html#/bai/m03-bai-07-phan-loai-nhieu-lop-va-softmax">M03 b.7</a>' +
             ' · <a href="../web/index.html#/bai/m06-bai-13-sinh-van-ban-va-giai-ma">M06 b.13</a>',
    dung: function (host) {
      var W = 520, H = 320;
      var cv = V.veBang(W, H), g = cv.g;
      var logits = [3.2, 2.6, 1.8, 1.1, 0.4, -0.3, -1.0];
      var TEN = ["mèo", "chó", "hổ", "sói", "cáo", "gấu", "nai"];
      var tt = { T: 1.0, topk: 0 };

      function softmax(z, T) {
        var m = Math.max.apply(null, z);
        var e = z.map(function (v) { return Math.exp((v - m) / Math.max(T, 1e-3)); });
        var s = e.reduce(function (a, b) { return a + b; }, 0);
        return e.map(function (v) { return v / s; });
      }

      var oSo = V.el("div", { class: "so-lieu" });

      function ve() {
        var p = softmax(logits, tt.T);
        if (tt.topk > 0 && tt.topk < p.length) {
          var idx = p.map(function (v, i) { return [v, i]; })
                     .sort(function (a, b) { return b[0] - a[0]; });
          var giu = {};
          for (var k = 0; k < tt.topk; k++) giu[idx[k][1]] = 1;
          var tong = 0;
          p = p.map(function (v, i) { return giu[i] ? v : 0; });
          p.forEach(function (v) { tong += v; });
          p = p.map(function (v) { return v / tong; });
        }
        g.clearRect(0, 0, W, H);
        var pad = 40, bw = (W - pad * 2) / p.length;
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        for (var q = 0; q <= 4; q++) {
          var yy = H - 44 - q / 4 * (H - 80);
          g.beginPath(); g.moveTo(pad - 6, yy); g.lineTo(W - pad + 6, yy); g.stroke();
          g.fillStyle = V.mau("tx3"); g.font = "11px " + "system-ui";
          g.fillText((q / 4).toFixed(2), 4, yy + 4);
        }
        p.forEach(function (v, i) {
          var x = pad + i * bw, h = v * (H - 80);
          g.fillStyle = V.mau("ac");
          g.globalAlpha = v < 0.001 ? 0.25 : 1;
          g.fillRect(x + bw * 0.14, H - 44 - h, bw * 0.72, h);
          g.globalAlpha = 1;
          g.fillStyle = V.mau("tx2"); g.font = "12px system-ui"; g.textAlign = "center";
          g.fillText(TEN[i], x + bw / 2, H - 26);
          g.fillStyle = V.mau("tx3"); g.font = "10.5px " + "monospace";
          g.fillText(logits[i].toFixed(1), x + bw / 2, H - 12);
          if (v > 0.02) {
            g.fillStyle = V.mau("tx"); g.font = "600 11px monospace";
            g.fillText((v * 100).toFixed(1) + "%", x + bw / 2, H - 50 - h);
          }
          g.textAlign = "left";
        });
        var H_ent = -p.reduce(function (a, v) { return a + (v > 0 ? v * Math.log2(v) : 0); }, 0);
        oSo.innerHTML =
          '<div class="d"><span>Entropy</span><b>' + H_ent.toFixed(3) + " bit</b></div>" +
          '<div class="d"><span>Entropy tối đa</span><b>' + Math.log2(p.length).toFixed(3) + " bit</b></div>" +
          '<div class="d"><span>Xác suất cao nhất</span><b>' +
            (Math.max.apply(null, p) * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Perplexity</span><b>' + Math.pow(2, H_ent).toFixed(2) + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "Nhiệt độ T", min: 0.05, max: 5, buoc: 0.05, giaTri: tt.T,
          doi: function (v) { tt.T = v; ve(); } }),
        V.truot({ ten: "Top-k (0 = tắt)", min: 0, max: 7, buoc: 1, giaTri: tt.topk,
          doi: function (v) { tt.topk = v; ve(); } }),
        V.el("h4", { text: "LOGIT ĐẦU VÀO", style: "margin-top:16px" })
      ].concat(logits.map(function (v, i) {
        return V.truot({ ten: TEN[i], min: -3, max: 5, buoc: 0.1, giaTri: v,
          doi: function (nv) { logits[i] = nv; ve(); } });
      })).concat([oSo]);

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Công thức:</b> <code>softmax(z)ᵢ = exp(zᵢ/T) / Σⱼ exp(zⱼ/T)</code><ul>" +
          "<li><b>T → 0</b>: phân phối tiến tới argmax (chọn cứng). Trong sinh văn bản: " +
          "lặp lại, nhàm chán, nhưng ổn định.</li>" +
          "<li><b>T = 1</b>: phân phối gốc mà mô hình đã học.</li>" +
          "<li><b>T → ∞</b>: tiến tới phân phối đều — mô hình mất hết thông tin đã học.</li>" +
          "<li><b>Top-k</b> cắt đuôi dài trước khi chuẩn hoá lại. Nó khác nhiệt độ: nhiệt độ " +
          "làm <i>mềm</i> toàn bộ, top-k <i>xoá hẳn</i> các lựa chọn kém.</li></ul>" +
          "<b>Điều đáng chú ý:</b> đúng công thức <code>e^(·/T)</code> này xuất hiện ở ba nơi " +
          "khác nhau — phân loại (M03), mô phỏng luyện kim (M01 b.8), và lấy mẫu token (M06 b.13). " +
          "Cả ba đều đang biến một hàm điểm số thành phân phối xác suất với độ sắc điều chỉnh được."
      });
      ve();
    }
  });

  /* ==================================================================
     3. ENTROPY, CROSS-ENTROPY va KL
     ================================================================== */
  demo({
    id: "entropy-kl", nhom: "Toán nền tảng", mon: "M02",
    ten: "Entropy, cross-entropy và KL",
    moTa: "Kéo phân phối Q về gần P và xem KL tiến về 0. Đổi chiều để thấy KL " +
          "<b>không đối xứng</b>.",
    lienKet: '<a href="../web/index.html#/bai/m02-bai-15-ly-thuyet-thong-tin">M02 b.15</a>',
    dung: function (host) {
      var W = 520, H = 300;
      var cv = V.veBang(W, H), g = cv.g;
      var n = 5;
      var P = [0.45, 0.25, 0.15, 0.10, 0.05];
      var Q = [0.20, 0.20, 0.20, 0.20, 0.20];

      function chuanHoa(a) {
        var s = a.reduce(function (x, y) { return x + y; }, 0);
        return a.map(function (v) { return Math.max(v, 1e-9) / s; });
      }
      /* Dat ten ent() chu khong phai H() — trong pham vi nay H da la chieu cao canvas. */
      function ent(p) { return -p.reduce(function (a, v) { return a + v * Math.log2(v); }, 0); }
      function CE(p, q) { return -p.reduce(function (a, v, i) { return a + v * Math.log2(q[i]); }, 0); }
      function KL(p, q) { return CE(p, q) - ent(p); }

      var oSo = V.el("div", { class: "so-lieu" });

      function ve() {
        var p = chuanHoa(P), q = chuanHoa(Q);
        g.clearRect(0, 0, W, H);
        var pad = 44, bw = (W - pad * 2) / n, base = H - 46, hmax = H - 86;
        for (var k = 0; k <= 4; k++) {
          var yy = base - k / 4 * hmax;
          g.strokeStyle = V.mau("bd2"); g.beginPath();
          g.moveTo(pad - 6, yy); g.lineTo(W - pad + 6, yy); g.stroke();
          g.fillStyle = V.mau("tx3"); g.font = "11px system-ui";
          g.fillText((k / 4 * 0.6).toFixed(2), 6, yy + 4);
        }
        for (var i = 0; i < n; i++) {
          var x = pad + i * bw;
          g.fillStyle = V.mau("ac");
          g.fillRect(x + bw * 0.10, base - p[i] / 0.6 * hmax, bw * 0.36, p[i] / 0.6 * hmax);
          g.fillStyle = V.mau("ba");
          g.fillRect(x + bw * 0.52, base - q[i] / 0.6 * hmax, bw * 0.36, q[i] / 0.6 * hmax);
          g.fillStyle = V.mau("tx2"); g.font = "12px system-ui"; g.textAlign = "center";
          g.fillText("x" + (i + 1), x + bw / 2, base + 18);
          g.textAlign = "left";
        }
        oSo.innerHTML =
          '<div class="d"><span>H(P)</span><b>' + ent(p).toFixed(4) + " bit</b></div>" +
          '<div class="d"><span>H(P,Q) cross-entropy</span><b>' + CE(p, q).toFixed(4) + " bit</b></div>" +
          '<div class="d"><span>KL(P‖Q)</span><b>' + KL(p, q).toFixed(4) + "</b></div>" +
          '<div class="d"><span>KL(Q‖P)</span><b>' + KL(q, p).toFixed(4) + "</b></div>" +
          '<div style="margin-top:8px;color:var(--tx3)">KL(P‖Q) ' +
            (Math.abs(KL(p, q) - KL(q, p)) < 1e-9 ? "=" : "≠") + " KL(Q‖P)</div>";
      }

      var dkP = P.map(function (v, i) {
        return V.truot({ ten: "P(x" + (i + 1) + ")", min: 0.01, max: 1, buoc: 0.01, giaTri: v,
          doi: function (nv) { P[i] = nv; ve(); } });
      });
      var dkQ = Q.map(function (v, i) {
        return V.truot({ ten: "Q(x" + (i + 1) + ")", min: 0.01, max: 1, buoc: 0.01, giaTri: v,
          doi: function (nv) { Q[i] = nv; ve(); } });
      });

      var dk = [V.el("h4", { text: "PHÂN PHỐI THẬT P (hồng)" })]
        .concat(dkP)
        .concat([V.el("h4", { text: "MÔ HÌNH Q (vàng)", style: "margin-top:16px" })])
        .concat(dkQ)
        .concat([
          V.nut("Q ← P (khớp hoàn hảo)", function () {
            var p = chuanHoa(P);
            for (var i = 0; i < n; i++) { Q[i] = p[i]; dkQ[i].datGiaTri(p[i]); }
            ve();
          }, "chinh"),
          V.nut("Q ← đều", function () {
            for (var i = 0; i < n; i++) { Q[i] = 1 / n; dkQ[i].datGiaTri(1 / n); }
            ve();
          }),
          oSo
        ]);

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Ba đại lượng, một quan hệ:</b> <code>H(P,Q) = H(P) + KL(P‖Q)</code><ul>" +
          "<li><b>H(P)</b> — số bit tối thiểu để mã hoá dữ liệu từ P. <b>Không phụ thuộc mô hình.</b></li>" +
          "<li><b>H(P,Q)</b> — số bit thực tế phải dùng nếu ta mã hoá bằng mô hình Q. " +
          "Đây chính là <b>cross-entropy loss</b>.</li>" +
          "<li><b>KL(P‖Q)</b> — phần bit <i>lãng phí</i> do dùng Q thay vì P. Luôn ≥ 0, " +
          "bằng 0 khi và chỉ khi Q = P.</li></ul>" +
          "<b>Vì sao tối thiểu hoá cross-entropy = tối thiểu hoá KL:</b> H(P) là hằng số " +
          "(dữ liệu cố định), nên giảm H(P,Q) chính là giảm KL. Đó là lý do cross-entropy " +
          "là hàm mất mát tự nhiên cho phân loại, chứ không phải một lựa chọn tuỳ tiện.<br><br>" +
          "<b>Thử điều này:</b> đặt một Q(xᵢ) rất nhỏ trong khi P(xᵢ) lớn. KL(P‖Q) nổ lên. " +
          "Rồi làm ngược lại — KL(Q‖P) gần như không đổi. <b>KL không đối xứng</b>, và chiều " +
          "bạn chọn quyết định mô hình sẽ <i>phủ rộng</i> hay <i>bám sát một mode</i>."
      });
      ve();
    }
  });

  /* ==================================================================
     4. PCA tren du lieu 2 chieu
     ================================================================== */
  demo({
    id: "pca", nhom: "Toán nền tảng", mon: "M02",
    ten: "PCA: trục chính và phép chiếu",
    moTa: "Đổi hình dạng đám mây dữ liệu và xem trục chính xoay theo. Bật " +
          "<i>chưa chuẩn hoá</i> để thấy PCA bị một đặc trưng chi phối.",
    lienKet: '<a href="../web/index.html#/bai/m02-bai-07-tri-rieng-svd-va-pca">M02 b.7</a>',
    dung: function (host) {
      var W = 440, H = 440;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(-5, 5, -5, 5);
      var tt = { sx: 2.4, sy: 0.8, goc: 25, thangDo: 1, chuanHoa: true, chieu: false, n: 220 };
      var oSo = V.el("div", { class: "so-lieu" });

      function sinh() {
        var R = V.rng(11), th = tt.goc * Math.PI / 180;
        var d = [];
        for (var i = 0; i < tt.n; i++) {
          var a = R.chuan() * tt.sx, b = R.chuan() * tt.sy;
          var x = a * Math.cos(th) - b * Math.sin(th);
          var y = a * Math.sin(th) + b * Math.cos(th);
          d.push([x * tt.thangDo, y]);
        }
        return d;
      }

      function ve() {
        var d = sinh();
        var mx = 0, my = 0;
        d.forEach(function (p) { mx += p[0]; my += p[1]; });
        mx /= d.length; my /= d.length;
        var X = d.map(function (p) { return [p[0] - mx, p[1] - my]; });
        if (tt.chuanHoa) {
          var vx = 0, vy = 0;
          X.forEach(function (p) { vx += p[0] * p[0]; vy += p[1] * p[1]; });
          vx = Math.sqrt(vx / X.length) || 1; vy = Math.sqrt(vy / X.length) || 1;
          X = X.map(function (p) { return [p[0] / vx, p[1] / vy]; });
        }
        /* ma tran hiep phuong sai 2x2 -> tri rieng giai tich */
        var c11 = 0, c12 = 0, c22 = 0;
        X.forEach(function (p) { c11 += p[0] * p[0]; c12 += p[0] * p[1]; c22 += p[1] * p[1]; });
        c11 /= X.length; c12 /= X.length; c22 /= X.length;
        var tr = c11 + c22, det = c11 * c22 - c12 * c12;
        var l1 = tr / 2 + Math.sqrt(Math.max(tr * tr / 4 - det, 0));
        var l2 = tr / 2 - Math.sqrt(Math.max(tr * tr / 4 - det, 0));
        var v1 = Math.abs(c12) > 1e-9 ? [l1 - c22, c12] : [1, 0];
        var nv1 = Math.hypot(v1[0], v1[1]); v1 = [v1[0] / nv1, v1[1] / nv1];
        var v2 = [-v1[1], v1[0]];

        g.clearRect(0, 0, W, H);
        V.veLuoi(g, T, -5, 5, -5, 5, W, H, 1);
        /* diem */
        X.forEach(function (p) {
          g.fillStyle = "rgba(157,23,77,.5)";
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), 2.6, 0, 7); g.fill();
        });
        /* hinh chieu len PC1 */
        if (tt.chieu) {
          g.strokeStyle = "rgba(180,83,9,.35)"; g.lineWidth = 1;
          X.forEach(function (p) {
            var t = p[0] * v1[0] + p[1] * v1[1];
            var q = [t * v1[0], t * v1[1]];
            g.beginPath(); g.moveTo(T.x(p[0]), T.y(p[1])); g.lineTo(T.x(q[0]), T.y(q[1])); g.stroke();
          });
          X.forEach(function (p) {
            var t = p[0] * v1[0] + p[1] * v1[1];
            g.fillStyle = V.mau("ba");
            g.beginPath(); g.arc(T.x(t * v1[0]), T.y(t * v1[1]), 2.4, 0, 7); g.fill();
          });
        }
        /* truc chinh */
        function truc(v, l, mau_, nhan) {
          var s = 2.3 * Math.sqrt(Math.max(l, 0));
          g.strokeStyle = mau_; g.lineWidth = 3;
          g.beginPath();
          g.moveTo(T.x(-v[0] * s), T.y(-v[1] * s));
          g.lineTo(T.x(v[0] * s), T.y(v[1] * s));
          g.stroke();
          g.fillStyle = mau_; g.font = "600 13px system-ui";
          g.fillText(nhan, T.x(v[0] * s) + 6, T.y(v[1] * s) - 4);
        }
        truc(v1, l1, "#0f766e", "PC1");
        truc(v2, l2, "#b45309", "PC2");

        var tong = l1 + l2;
        oSo.innerHTML =
          '<div class="d"><span>λ₁ (PC1)</span><b>' + l1.toFixed(3) + "</b></div>" +
          '<div class="d"><span>λ₂ (PC2)</span><b>' + l2.toFixed(3) + "</b></div>" +
          '<div class="d"><span>PC1 giữ</span><b>' + (l1 / tong * 100).toFixed(1) + "% phương sai</b></div>" +
          '<div class="d"><span>Hướng PC1</span><b>' +
            (Math.atan2(v1[1], v1[0]) * 180 / Math.PI).toFixed(1) + "°</b></div>";
      }

      var dk = [
        V.el("h4", { text: "HÌNH DẠNG DỮ LIỆU" }),
        V.truot({ ten: "Độ trải trục dài", min: 0.2, max: 3.5, buoc: 0.1, giaTri: tt.sx,
          doi: function (v) { tt.sx = v; ve(); } }),
        V.truot({ ten: "Độ trải trục ngắn", min: 0.05, max: 3.5, buoc: 0.05, giaTri: tt.sy,
          doi: function (v) { tt.sy = v; ve(); } }),
        V.truot({ ten: "Góc xoay", min: 0, max: 180, buoc: 1, donVi: "°", giaTri: tt.goc,
          doi: function (v) { tt.goc = v; ve(); } }),
        V.el("h4", { text: "BẪY THANG ĐO", style: "margin-top:16px" }),
        V.truot({ ten: "Nhân đặc trưng x với", min: 0.2, max: 8, buoc: 0.1, donVi: "×", giaTri: tt.thangDo,
          doi: function (v) { tt.thangDo = v; ve(); } }),
        V.danhDau({ ten: "Chuẩn hoá trước khi PCA", giaTri: tt.chuanHoa,
          doi: function (v) { tt.chuanHoa = v; ve(); } }),
        V.danhDau({ ten: "Hiện phép chiếu lên PC1", giaTri: tt.chieu,
          doi: function (v) { tt.chieu = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>PCA nhìn từ hai phía — cùng một kết quả:</b><ul>" +
          "<li><b>Phương sai tối đa:</b> PC1 là hướng mà dữ liệu trải rộng nhất.</li>" +
          "<li><b>Sai số tái tạo tối thiểu:</b> PC1 là đường thẳng mà tổng bình phương " +
          "khoảng cách vuông góc từ các điểm tới nó là nhỏ nhất. Bật <i>phép chiếu</i> " +
          "để thấy các đoạn màu cam — PCA tối thiểu hoá tổng bình phương độ dài chúng.</li></ul>" +
          "<b>Bẫy thang đo — hãy thử:</b> tắt <i>chuẩn hoá</i>, rồi kéo <i>Nhân đặc trưng x</i> " +
          "lên 8×. PC1 xoay về gần trùng trục x, bất kể cấu trúc thật của dữ liệu. " +
          "Lý do: PCA tối đa hoá phương sai, và phương sai phụ thuộc <b>đơn vị đo</b>. " +
          "Một đặc trưng tính bằng đồng sẽ luôn áp đảo một đặc trưng tính bằng năm.<br><br>" +
          "<b>Kết luận thực hành:</b> gần như luôn phải chuẩn hoá trước PCA — trừ khi mọi " +
          "đặc trưng đã cùng đơn vị và bạn <i>cố ý</i> muốn giữ chênh lệch thang đo."
      });
      ve();
    }
  });
})();
