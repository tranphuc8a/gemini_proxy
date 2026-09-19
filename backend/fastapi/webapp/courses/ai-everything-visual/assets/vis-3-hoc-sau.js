/* =====================================================================
   vis-3-hoc-sau.js — demo cho M05, M07
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     1. HAM KICH HOAT va DAO HAM
     ================================================================== */
  demo({
    id: "ham-kich-hoat", nhom: "Học sâu", mon: "M05",
    ten: "Hàm kích hoạt và đạo hàm của nó",
    moTa: "Nhìn <b>đạo hàm</b> (nét đứt) chứ không chỉ hàm. Đạo hàm nhỏ ở đâu thì " +
          "gradient chết ở đó.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-03-ham-kich-hoat">M05 b.3</a>',
    dung: function (host) {
      var W = 520, H = 380;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(-6, 6, -1.6, 2.4);
      var HAM = {
        sigmoid: { ten: "Sigmoid", f: function (x) { return 1 / (1 + Math.exp(-x)); },
          d: function (x) { var s = 1 / (1 + Math.exp(-x)); return s * (1 - s); },
          max: 0.25, ghi: "Đạo hàm tối đa 0,25 → qua 10 lớp còn ≤ 0,25¹⁰ ≈ 10⁻⁶" },
        tanh: { ten: "Tanh", f: function (x) { return Math.tanh(x); },
          d: function (x) { var t = Math.tanh(x); return 1 - t * t; },
          max: 1, ghi: "Đạo hàm tối đa 1, có tâm ở 0 — tốt hơn sigmoid, vẫn bão hoà" },
        relu: { ten: "ReLU", f: function (x) { return Math.max(0, x); },
          d: function (x) { return x > 0 ? 1 : 0; },
          max: 1, ghi: "Đạo hàm 1 hoặc 0. Không bão hoà phía dương — nhưng CHẾT ở phía âm" },
        lrelu: { ten: "Leaky ReLU (0,1)", f: function (x) { return x > 0 ? x : 0.1 * x; },
          d: function (x) { return x > 0 ? 1 : 0.1; },
          max: 1, ghi: "Sửa vấn đề neuron chết bằng một độ dốc nhỏ ở phía âm" },
        gelu: { ten: "GELU", f: function (x) {
            return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x))); },
          d: function (x) { var h = 1e-4;
            var f = function (z) { return 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z))); };
            return (f(x + h) - f(x - h)) / (2 * h); },
          max: 1.1, ghi: "Mượt, khả vi mọi nơi. Mặc định trong transformer hiện đại" },
        swish: { ten: "SiLU / Swish", f: function (x) { return x / (1 + Math.exp(-x)); },
          d: function (x) { var s = 1 / (1 + Math.exp(-x)); return s + x * s * (1 - s); },
          max: 1.1, ghi: "Tự cổng: x · sigmoid(x). Gần GELU, rẻ hơn" }
      };
      var tt = { ham: "relu", soLop: 10, soSanh: true };
      var oSo = V.el("div", { class: "so-lieu" });

      function ve() {
        var A = HAM[tt.ham];
        g.clearRect(0, 0, W, H);
        V.veLuoi(g, T, -6, 6, -1.6, 2.4, W, H, 1);

        if (tt.soSanh) {
          Object.keys(HAM).forEach(function (k) {
            if (k === tt.ham) return;
            g.strokeStyle = "rgba(139,132,122,.28)"; g.lineWidth = 1.4;
            g.beginPath();
            for (var x = -6; x <= 6; x += 0.02) {
              var px = T.x(x), py = T.y(HAM[k].f(x));
              if (x === -6) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.stroke();
          });
        }
        /* ham */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 3;
        g.beginPath();
        for (var x2 = -6; x2 <= 6; x2 += 0.01) {
          var px2 = T.x(x2), py2 = T.y(A.f(x2));
          if (x2 === -6) g.moveTo(px2, py2); else g.lineTo(px2, py2);
        }
        g.stroke();
        /* dao ham */
        g.strokeStyle = V.mau("ba"); g.lineWidth = 2.4; g.setLineDash([6, 4]);
        g.beginPath();
        for (var x3 = -6; x3 <= 6; x3 += 0.01) {
          var px3 = T.x(x3), py3 = T.y(A.d(x3));
          if (x3 === -6) g.moveTo(px3, py3); else g.lineTo(px3, py3);
        }
        g.stroke(); g.setLineDash([]);

        g.fillStyle = V.mau("tx3"); g.font = "12px system-ui";
        g.fillText("−6", 4, T.y(0) + 14); g.fillText("6", W - 16, T.y(0) + 14);

        var tich = Math.pow(A.max, tt.soLop);
        oSo.innerHTML =
          '<div class="d"><span>Đạo hàm tối đa</span><b>' + A.max + "</b></div>" +
          '<div class="d"><span>Qua ' + tt.soLop + " lớp</span><b>" +
            (tich < 1e-4 ? tich.toExponential(1) : tich.toFixed(5)) + "</b></div>" +
          '<div class="d"><span>Hệ quả</span><b style="color:' +
            (tich < 1e-3 ? "var(--loi)" : "var(--ok)") + '">' +
            (tich < 1e-3 ? "gradient tiêu biến" : "gradient truyền được") + "</b></div>" +
          '<div style="margin-top:8px;color:var(--tx2)">' + A.ghi + "</div>";
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.chon({ ten: "Hàm kích hoạt", giaTri: tt.ham,
          muc: Object.keys(HAM).map(function (k) { return { v: k, t: HAM[k].ten }; }),
          doi: function (v) { tt.ham = v; ve(); } }),
        V.truot({ ten: "Số lớp xếp chồng", min: 1, max: 50, buoc: 1, giaTri: tt.soLop,
          doi: function (v) { tt.soLop = v; ve(); } }),
        V.danhDau({ ten: "Hiện các hàm khác (mờ)", giaTri: tt.soSanh,
          doi: function (v) { tt.soSanh = v; ve(); } }),
        oSo,
        V.el("div", { class: "chu-thich" }, [
          V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#9d174d" }), "hàm f(x)"]),
          V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#b45309" }), "đạo hàm f′(x)"])
        ])
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Điều quan trọng không phải hàm — mà là đạo hàm của nó.</b> Backprop nhân các " +
          "đạo hàm dọc theo chuỗi lớp. Nếu mỗi đạo hàm < 1, tích của chúng tiến về 0 theo cấp số nhân.<ul>" +
          "<li><b>Sigmoid:</b> đạo hàm tối đa <code>0,25</code> tại x = 0, và gần 0 khi |x| > 4. " +
          "Qua 10 lớp: <code>0,25¹⁰ ≈ 10⁻⁶</code>. Lớp đầu gần như không nhận được tín hiệu học. " +
          "<b>Đây chính là lý do mạng sâu không huấn luyện được trước 2010.</b></li>" +
          "<li><b>ReLU:</b> đạo hàm đúng bằng 1 ở phía dương → tích không tiêu biến. Đây là một " +
          "trong ba lý do chính khiến học sâu cất cánh (cùng với dữ liệu và GPU).</li>" +
          "<li><b>Nhưng ReLU có giá:</b> đạo hàm bằng <i>0</i> ở phía âm. Một neuron rơi vào " +
          "vùng âm với mọi đầu vào sẽ <b>chết vĩnh viễn</b> — không gradient thì không cập nhật " +
          "được, không cập nhật thì không thoát ra được. Leaky ReLU sửa điều này.</li>" +
          "<li><b>GELU/SiLU:</b> mượt và khả vi mọi nơi. Chênh lệch so với ReLU nhỏ nhưng ổn " +
          "định hơn ở quy mô lớn — nên transformer hiện đại dùng chúng.</li></ul>" +
          "<b>Thử:</b> chọn sigmoid, kéo số lớp lên 20. Con số ở ô <i>Qua N lớp</i> là lý do " +
          "kết nối tắt (residual) được phát minh — nó tạo đường đi cho gradient <i>không</i> " +
          "phải nhân qua các đạo hàm đó."
      });
      ve();
    }
  });

  /* ==================================================================
     2. MANG NEURON HOC RANH GIOI — huan luyen truc tiep tren trinh duyet
     ================================================================== */
  demo({
    id: "mang-neuron", nhom: "Học sâu", mon: "M05",
    ten: "Mạng neuron học ranh giới quyết định",
    moTa: "Huấn luyện thật trong trình duyệt. Đặt số lớp ẩn = 0 để thấy mạng tuyến " +
          "tính <b>không thể</b> giải xoắn ốc.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-02-perceptron-va-mlp">M05 b.2</a>' +
             ' · <a href="../web/index.html#/bai/m05-bai-04-lan-truyen-nguoc">M05 b.4</a>',
    dung: function (host) {
      var W = 400, H = 400;
      var cv = V.veBang(W, H), g = cv.g;
      var T = cv.hemToan(-1.2, 1.2, -1.2, 1.2);
      var tt = { dang: "xoanoc", an: [8, 8], lr: 0.06, kichHoat: "tanh", nhieu: 0.12 };
      var X = [], Y = [], M = null, buoc = 0, lich = [];
      var oSo = V.el("div", { class: "so-lieu" });

      function sinhDL() {
        var R = V.rng(13); X = []; Y = [];
        var n = 220;
        if (tt.dang === "xoanoc") {
          for (var i = 0; i < n / 2; i++) {
            for (var c = 0; c < 2; c++) {
              var r = i / (n / 2) * 1.0;
              var t = 1.75 * i / (n / 2) * 2 * Math.PI + c * Math.PI;
              X.push([r * Math.sin(t) + R.chuan() * tt.nhieu, r * Math.cos(t) + R.chuan() * tt.nhieu]);
              Y.push(c);
            }
          }
        } else if (tt.dang === "vong") {
          for (var j = 0; j < n; j++) {
            var inner = j < n / 2;
            var rr = inner ? R.khoang(0, 0.45) : R.khoang(0.65, 1.0);
            var aa = R() * 6.283;
            X.push([rr * Math.cos(aa) + R.chuan() * tt.nhieu, rr * Math.sin(aa) + R.chuan() * tt.nhieu]);
            Y.push(inner ? 0 : 1);
          }
        } else if (tt.dang === "xor") {
          for (var k = 0; k < n; k++) {
            var x = R.khoang(-1, 1), y = R.khoang(-1, 1);
            X.push([x + R.chuan() * tt.nhieu, y + R.chuan() * tt.nhieu]);
            Y.push((x > 0) === (y > 0) ? 0 : 1);
          }
        } else {                                        /* tuyen tinh */
          for (var m = 0; m < n; m++) {
            var xx = R.khoang(-1, 1), yy = R.khoang(-1, 1);
            X.push([xx + R.chuan() * tt.nhieu, yy + R.chuan() * tt.nhieu]);
            Y.push(xx + yy > 0 ? 1 : 0);
          }
        }
      }

      /* ---- MLP toi gian, viet tay (khong thu vien) ---- */
      function taoMang(dims) {
        var R = V.rng(7), L = [];
        for (var i = 0; i + 1 < dims.length; i++) {
          var nin = dims[i], nout = dims[i + 1];
          var s = Math.sqrt(2 / (nin + nout));          /* Xavier */
          var Wm = [], b = [];
          for (var o = 0; o < nout; o++) {
            var row = [];
            for (var k = 0; k < nin; k++) row.push(R.chuan() * s);
            Wm.push(row); b.push(0);
          }
          L.push({ W: Wm, b: b });
        }
        return L;
      }
      function act(z) { return tt.kichHoat === "relu" ? Math.max(0, z) : Math.tanh(z); }
      function dact(a) { return tt.kichHoat === "relu" ? (a > 0 ? 1 : 0) : (1 - a * a); }

      function xuoi(L, x) {
        var a = x, cache = [x];
        for (var i = 0; i < L.length; i++) {
          var z = [];
          for (var o = 0; o < L[i].W.length; o++) {
            var s = L[i].b[o];
            for (var k = 0; k < a.length; k++) s += L[i].W[o][k] * a[k];
            z.push(s);
          }
          a = (i === L.length - 1) ? z.map(function (v) { return 1 / (1 + Math.exp(-v)); })
                                   : z.map(act);
          cache.push(a);
        }
        return cache;
      }

      function huanLuyen(lan) {
        for (var it = 0; it < lan; it++) {
          var gW = M.map(function (l) {
            return l.W.map(function (r) { return r.map(function () { return 0; }); });
          });
          var gb = M.map(function (l) { return l.b.map(function () { return 0; }); });
          var loss = 0;
          for (var n = 0; n < X.length; n++) {
            var c = xuoi(M, X[n]);
            var yhat = c[c.length - 1][0];
            var y = Y[n];
            yhat = Math.min(Math.max(yhat, 1e-7), 1 - 1e-7);
            loss += -(y * Math.log(yhat) + (1 - y) * Math.log(1 - yhat));
            var delta = [yhat - y];                       /* d(CE)/dz cua lop cuoi */
            for (var i = M.length - 1; i >= 0; i--) {
              var ain = c[i];
              for (var o = 0; o < M[i].W.length; o++) {
                gb[i][o] += delta[o];
                for (var k = 0; k < ain.length; k++) gW[i][o][k] += delta[o] * ain[k];
              }
              if (i > 0) {
                var nd = new Array(ain.length).fill(0);
                for (var o2 = 0; o2 < M[i].W.length; o2++)
                  for (var k2 = 0; k2 < ain.length; k2++)
                    nd[k2] += delta[o2] * M[i].W[o2][k2];
                for (var k3 = 0; k3 < nd.length; k3++) nd[k3] *= dact(ain[k3]);
                delta = nd;
              }
            }
          }
          var N = X.length;
          for (var i2 = 0; i2 < M.length; i2++)
            for (var o3 = 0; o3 < M[i2].W.length; o3++) {
              M[i2].b[o3] -= tt.lr * gb[i2][o3] / N;
              for (var k4 = 0; k4 < M[i2].W[o3].length; k4++)
                M[i2].W[o3][k4] -= tt.lr * gW[i2][o3][k4] / N;
            }
          buoc++;
          lich.push(loss / N);
          if (lich.length > 400) lich.shift();
        }
      }

      function datLai() {
        var dims = [2].concat(tt.an).concat([1]);
        M = taoMang(dims); buoc = 0; lich = [];
      }

      function ve() {
        var B = 8;
        g.clearRect(0, 0, W, H);
        for (var px = 0; px < W; px += B) {
          for (var py = 0; py < H; py += B) {
            var c = xuoi(M, [T.nx(px + B / 2), T.ny(py + B / 2)]);
            var p = c[c.length - 1][0];
            g.fillStyle = p > 0.5
              ? "rgba(180,83,9," + ((p - 0.5) * 0.7).toFixed(3) + ")"
              : "rgba(157,23,77," + ((0.5 - p) * 0.7).toFixed(3) + ")";
            g.fillRect(px, py, B, B);
          }
        }
        X.forEach(function (p, i) {
          g.fillStyle = Y[i] ? "#b45309" : "#9d174d";
          g.strokeStyle = "#fff"; g.lineWidth = 1.2;
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), 3.6, 0, 7); g.fill(); g.stroke();
        });
        /* duong loss goc duoi */
        if (lich.length > 2) {
          var lw = 120, lh = 46, lx = W - lw - 10, ly = H - lh - 10;
          g.fillStyle = "rgba(255,255,255,.82)"; g.fillRect(lx, ly, lw, lh);
          g.strokeStyle = V.mau("bd"); g.strokeRect(lx, ly, lw, lh);
          var mx = Math.max.apply(null, lich);
          g.strokeStyle = V.mau("ac"); g.lineWidth = 1.6; g.beginPath();
          lich.forEach(function (v, i) {
            var X2 = lx + i / (lich.length - 1) * lw, Y2 = ly + lh - (v / mx) * (lh - 4) - 2;
            if (i === 0) g.moveTo(X2, Y2); else g.lineTo(X2, Y2);
          });
          g.stroke();
          g.fillStyle = V.mau("tx3"); g.font = "9px system-ui"; g.fillText("loss", lx + 4, ly + 10);
        }
        var dung = 0;
        X.forEach(function (p, i) {
          var c = xuoi(M, p);
          if ((c[c.length - 1][0] > 0.5 ? 1 : 0) === Y[i]) dung++;
        });
        oSo.innerHTML =
          '<div class="d"><span>Bước huấn luyện</span><b>' + buoc + "</b></div>" +
          '<div class="d"><span>Loss</span><b>' +
            (lich.length ? lich[lich.length - 1].toFixed(4) : "—") + "</b></div>" +
          '<div class="d"><span>Độ chính xác (train)</span><b>' +
            (dung / X.length * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Số tham số</span><b>' +
            M.reduce(function (a, l) {
              return a + l.b.length + l.W.length * l.W[0].length;
            }, 0) + "</b></div>";
      }

      var vl = V.vongLap(function () { huanLuyen(3); ve(); });

      var dk = [
        V.el("h4", { text: "DỮ LIỆU" }),
        V.chon({ ten: "Dạng bài toán", giaTri: tt.dang,
          muc: [{ v: "xoanoc", t: "Hai xoắn ốc (khó nhất)" },
                { v: "vong", t: "Vòng tròn lồng nhau" },
                { v: "xor", t: "XOR / bàn cờ" },
                { v: "tuyentinh", t: "Tách được tuyến tính" }],
          doi: function (v) { tt.dang = v; sinhDL(); datLai(); ve(); } }),
        V.truot({ ten: "Nhiễu", min: 0, max: 0.4, buoc: 0.01, giaTri: tt.nhieu,
          doi: function (v) { tt.nhieu = v; sinhDL(); datLai(); ve(); } }),
        V.el("h4", { text: "KIẾN TRÚC", style: "margin-top:16px" }),
        V.chon({ ten: "Lớp ẩn", giaTri: "8,8",
          muc: [{ v: "", t: "KHÔNG có lớp ẩn (tuyến tính)" },
                { v: "2", t: "1 lớp × 2 neuron" },
                { v: "8", t: "1 lớp × 8 neuron" },
                { v: "8,8", t: "2 lớp × 8" },
                { v: "16,16", t: "2 lớp × 16" },
                { v: "12,12,12", t: "3 lớp × 12" }],
          doi: function (v) {
            tt.an = v ? v.split(",").map(Number) : [];
            datLai(); ve();
          } }),
        V.chon({ ten: "Hàm kích hoạt", giaTri: tt.kichHoat,
          muc: [{ v: "tanh", t: "tanh" }, { v: "relu", t: "ReLU" }],
          doi: function (v) { tt.kichHoat = v; datLai(); ve(); } }),
        V.truot({ ten: "Learning rate", min: 0.005, max: 0.6, buoc: 0.005, giaTri: tt.lr,
          doi: function (v) { tt.lr = v; } }),
        V.nut("▶ Huấn luyện", function () {
          if (vl.dangChay()) { vl.dung(); this.textContent = "▶ Huấn luyện"; }
          else { vl.chay(); this.textContent = "⏸ Dừng"; }
        }, "chinh"),
        V.nut("100 bước", function () { huanLuyen(100); ve(); }),
        V.nut("Khởi tạo lại", function () { datLai(); ve(); }),
        oSo
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Đây là mạng neuron thật, backprop viết tay, huấn luyện trong trình duyệt bạn.</b><ul>" +
          "<li><b>Thí nghiệm 1 — vì sao cần phi tuyến.</b> Chọn <i>Hai xoắn ốc</i> với " +
          "<i>KHÔNG có lớp ẩn</i>. Huấn luyện bao lâu cũng chỉ được một đường thẳng, " +
          "độ chính xác kẹt quanh 50 %. Không có lớp ẩn thì mạng chỉ là hồi quy logistic.</li>" +
          "<li><b>Thí nghiệm 2 — dung lượng.</b> Vẫn xoắn ốc, thêm 1 lớp × 2 neuron: " +
          "khá hơn chút. 2 lớp × 16: giải được. Mỗi neuron thêm vào là một &quot;nếp gấp&quot; " +
          "thêm vào không gian.</li>" +
          "<li><b>Thí nghiệm 3 — ReLU vs tanh.</b> Đổi sang ReLU và nhìn kỹ ranh giới: " +
          "nó gồm các <b>đoạn thẳng nối nhau</b>, vì ReLU là hàm tuyến tính từng khúc. " +
          "tanh cho ranh giới cong mượt. Cùng một bài toán, hai hình học khác nhau.</li>" +
          "<li><b>Thí nghiệm 4 — learning rate.</b> Kéo lên 0,6 và huấn luyện: loss nhảy loạn " +
          "hoặc phân kỳ. Kéo xuống 0,005: hội tụ nhưng rất chậm. Không có giá trị &quot;đúng&quot; — " +
          "chỉ có giá trị phù hợp với bài toán.</li>" +
          "<li><b>Thí nghiệm 5 — quá khớp.</b> Đặt nhiễu 0,35 với mạng 3 lớp × 12. Mạng sẽ " +
          "uốn éo để bắt cả các điểm nhiễu. Đó là quá khớp, nhìn thấy bằng mắt.</li></ul>"
      });
      sinhDL(); datLai(); ve();
    }
  });

  /* ==================================================================
     3. TICH CHAP
     ================================================================== */
  demo({
    id: "tich-chap", nhom: "Học sâu", mon: "M07",
    ten: "Tích chập: bộ lọc làm gì với ảnh",
    moTa: "Sửa từng ô của nhân 3×3 và xem ảnh đổi. Các bộ lọc kinh điển thực chất " +
          "chỉ là 9 con số.",
    lienKet: '<a href="../web/index.html#/bai/m07-bai-04-tich-chap-va-hinh-hoc-tensor">M07 b.4</a>' +
             ' · <a href="../web/index.html#/bai/m05-bai-11-mang-tich-chap-cnn">M05 b.11</a>',
    dung: function (host) {
      var N = 140, S = 2;                 /* anh NxN, phong to S lan */
      var cvA = V.veBang(N * S, N * S), gA = cvA.g;
      var cvB = V.veBang(N * S, N * S), gB = cvB.g;
      var nhan = [[0, 0, 0], [0, 1, 0], [0, 0, 0]];
      var tt = { anh: "hinh" };
      var src = null;
      var oSo = V.el("div", { class: "so-lieu" });

      function sinhAnh() {
        var a = new Float32Array(N * N);
        var R = V.rng(3);
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var v = 0.12;
            if (tt.anh === "hinh") {
              if (x > 22 && x < 62 && y > 22 && y < 62) v = 0.85;                    /* vuong */
              if (Math.hypot(x - 96, y - 44) < 24) v = 0.62;                          /* tron */
              if (Math.abs((x - 30) + (y - 100)) < 5 && x > 25 && x < 110) v = 0.9;   /* cheo */
              if (y > 104 && y < 112 && x > 20 && x < 120) v = 0.75;                  /* ngang */
              if (x > 118 && x < 126 && y > 70 && y < 130) v = 0.75;                  /* doc */
              v += R.chuan() * 0.02;
            } else if (tt.anh === "soc") {
              v = 0.5 + 0.42 * Math.sin(x * 0.45) * Math.cos(y * 0.13);
            } else {
              v = 0.5 + R.chuan() * 0.22;
            }
            a[y * N + x] = Math.max(0, Math.min(1, v));
          }
        }
        return a;
      }

      function veAnh(g, a, phongTo) {
        var img = g.createImageData(N, N);
        for (var i = 0; i < N * N; i++) {
          var c = Math.round(Math.max(0, Math.min(1, a[i])) * 255);
          img.data[i * 4] = c; img.data[i * 4 + 1] = c; img.data[i * 4 + 2] = c;
          img.data[i * 4 + 3] = 255;
        }
        var tmp = document.createElement("canvas");
        tmp.width = N; tmp.height = N;
        tmp.getContext("2d").putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, N * phongTo, N * phongTo);
        g.drawImage(tmp, 0, 0, N * phongTo, N * phongTo);
      }

      function tichChap(a) {
        var out = new Float32Array(N * N);
        var tong = 0;
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) tong += nhan[i][j];
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var s = 0;
            for (var dy = -1; dy <= 1; dy++) {
              for (var dx = -1; dx <= 1; dx++) {
                var yy = Math.min(N - 1, Math.max(0, y + dy));
                var xx = Math.min(N - 1, Math.max(0, x + dx));
                s += a[yy * N + xx] * nhan[dy + 1][dx + 1];
              }
            }
            /* neu tong he so ~ 0 (bo loc bien) thi dich ve 0.5 de nhin duoc */
            out[y * N + x] = Math.abs(tong) < 0.01 ? s + 0.5 : s / (Math.abs(tong) < 1e-6 ? 1 : tong) * (tong > 0 ? tong : 1);
          }
        }
        return out;
      }

      var oNhan = V.el("div", { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 12px" });
      var oInp = [];
      function dungONhan() {
        oNhan.innerHTML = ""; oInp = [];
        for (var i = 0; i < 3; i++) {
          for (var j = 0; j < 3; j++) {
            (function (i, j) {
              var inp = V.el("input", {
                type: "number", step: "0.25", value: String(nhan[i][j]),
                style: "width:100%;padding:6px;border:1px solid var(--bd);border-radius:7px;" +
                       "background:var(--surf2);color:var(--tx);font:600 13px var(--fm);text-align:center"
              });
              inp.addEventListener("input", function () {
                nhan[i][j] = parseFloat(inp.value) || 0; ve();
              });
              oInp.push(inp); oNhan.appendChild(inp);
            })(i, j);
          }
        }
      }
      function datNhan(m) {
        nhan = m.map(function (r) { return r.slice(); });
        oInp.forEach(function (inp, k) { inp.value = String(nhan[(k / 3) | 0][k % 3]); });
        ve();
      }

      function ve() {
        veAnh(gA, src, S);
        veAnh(gB, tichChap(src), S);
        var tong = 0, tongAbs = 0;
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
          tong += nhan[i][j]; tongAbs += Math.abs(nhan[i][j]);
        }
        oSo.innerHTML =
          '<div class="d"><span>Tổng hệ số</span><b>' + tong.toFixed(2) + "</b></div>" +
          '<div class="d"><span>Loại bộ lọc</span><b>' +
            (Math.abs(tong) < 0.01 ? "phát hiện biên" :
             tongAbs > Math.abs(tong) + 0.01 ? "làm sắc / hỗn hợp" : "làm mượt") + "</b></div>";
      }

      var MAU_NHAN = {
        "Đồng nhất (không đổi)": [[0,0,0],[0,1,0],[0,0,0]],
        "Làm mờ hộp": [[1,1,1],[1,1,1],[1,1,1]],
        "Gauss xấp xỉ": [[1,2,1],[2,4,2],[1,2,1]],
        "Sobel dọc (biên đứng)": [[-1,0,1],[-2,0,2],[-1,0,1]],
        "Sobel ngang (biên ngang)": [[-1,-2,-1],[0,0,0],[1,2,1]],
        "Laplace (mọi biên)": [[0,-1,0],[-1,4,-1],[0,-1,0]],
        "Làm sắc": [[0,-1,0],[-1,5,-1],[0,-1,0]],
        "Dập nổi": [[-2,-1,0],[-1,1,1],[0,1,2]]
      };

      var dk = [
        V.el("h4", { text: "NHÂN TÍCH CHẬP 3×3" }),
        oNhan,
        V.chon({ ten: "Bộ lọc mẫu", giaTri: "Đồng nhất (không đổi)",
          muc: Object.keys(MAU_NHAN).map(function (k) { return { v: k, t: k }; }),
          doi: function (v) { datNhan(MAU_NHAN[v]); } }),
        V.chon({ ten: "Ảnh đầu vào", giaTri: tt.anh,
          muc: [{ v: "hinh", t: "Hình học (vuông, tròn, cạnh)" },
                { v: "soc", t: "Sọc tuần hoàn" },
                { v: "nhieu", t: "Nhiễu" }],
          doi: function (v) { tt.anh = v; src = sinhAnh(); ve(); } }),
        oSo
      ];

      dungONhan();
      src = sinhAnh();

      V.khung(host, {
        ve: [V.el("div", { style: "display:flex;gap:12px;flex-wrap:wrap" }, [
              V.el("div", {}, [V.el("div", { class: "d-nhom", text: "ẢNH GỐC" }), cvA]),
              V.el("div", {}, [V.el("div", { class: "d-nhom", text: "SAU TÍCH CHẬP" }), cvB])
            ])],
        dieuKhien: dk,
        giaiThich:
          "<b>Một bộ lọc tích chập chỉ là 9 con số.</b> Toàn bộ &quot;phép màu&quot; của CNN " +
          "nằm ở chỗ những con số này <b>được học từ dữ liệu</b> thay vì do người thiết kế.<ul>" +
          "<li><b>Tổng hệ số ≈ 1</b> → làm mượt: mỗi pixel thành trung bình có trọng số của " +
          "vùng lân cận. Nhiễu bị triệt (nhiễu độc lập, trung bình lại thì triệt tiêu).</li>" +
          "<li><b>Tổng hệ số = 0</b> → phát hiện biên: vùng đồng đều cho 0, chỉ nơi có " +
          "<i>thay đổi</i> mới cho giá trị khác 0. Đây chính là xấp xỉ đạo hàm rời rạc.</li>" +
          "<li><b>Sobel dọc vs ngang</b>: hai bộ lọc chỉ khác nhau ở chỗ xoay 90°, và chúng " +
          "&quot;nhìn&quot; hai loại cạnh hoàn toàn khác nhau. Thử cả hai trên ảnh hình học.</li></ul>" +
          "<b>Điều đáng suy nghĩ:</b> bộ lọc ở <b>lớp một</b> của AlexNet, sau khi huấn luyện " +
          "trên hàng triệu ảnh, trông rất giống các bộ lọc bạn vừa chỉnh tay — phát hiện cạnh " +
          "theo các hướng, và các mảng màu. Mạng <i>tự khám phá lại</i> thứ mà con người thiết kế " +
          "tay suốt 30 năm trước đó. Đó là bằng chứng mạnh rằng nó đang học đúng thứ cần học.<br><br>" +
          "<b>Ba tính chất làm nên CNN:</b> <i>cục bộ</i> (mỗi đầu ra chỉ nhìn 3×3), " +
          "<i>chia sẻ trọng số</i> (cùng 9 số cho mọi vị trí → bất biến tịnh tiến), và " +
          "<i>xếp chồng</i> (lớp sau nhìn rộng hơn lớp trước — trường tiếp nhận tăng dần)."
      });
      ve();
    }
  });
})();
