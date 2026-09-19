/* =====================================================================
   Bo sung 1 — Hoc sau di sau
   backprop-tung-buoc (M05) · truong-thu-nhan (M07) · ro-ri-du-lieu (M04)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     backprop tung buoc tren mot do thi tinh toan nho
     ================================================================ */
  demo({
    id: "backprop-tung-buoc", nhom: "Học sâu", mon: "M05",
    ten: "Lan truyền ngược — từng bước trên đồ thị tính toán",
    moTa: "Quy tắc chuỗi không phải phép màu: nó là <b>nhân dồn đạo hàm dọc đường đi</b>. " +
          "Bấm từng bước và xem gradient chảy ngược.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-04-lan-truyen-nguoc">M05 b.4</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      /* do thi:  z = w*x + b  ->  a = sigma(z)  ->  L = (a - y)^2      */
      var tt = { x: 1.5, w: 0.8, b: -0.4, y: 1.0, buoc: 0, kich: "sigmoid" };

      function phi(z) {
        if (tt.kich === "sigmoid") return 1 / (1 + Math.exp(-z));
        if (tt.kich === "tanh") return Math.tanh(z);
        return Math.max(0, z);                      /* relu */
      }
      function dphi(z) {
        if (tt.kich === "sigmoid") { var s = phi(z); return s * (1 - s); }
        if (tt.kich === "tanh") { var t = Math.tanh(z); return 1 - t * t; }
        return z > 0 ? 1 : 0;
      }

      function tinh() {
        var z = tt.w * tt.x + tt.b;
        var a = phi(z);
        var L = (a - tt.y) * (a - tt.y);
        var dL_da = 2 * (a - tt.y);
        var da_dz = dphi(z);
        var dL_dz = dL_da * da_dz;
        var dL_dw = dL_dz * tt.x;
        var dL_db = dL_dz * 1;
        var dL_dx = dL_dz * tt.w;
        return { z: z, a: a, L: L, dL_da: dL_da, da_dz: da_dz, dL_dz: dL_dz,
                 dL_dw: dL_dw, dL_db: dL_db, dL_dx: dL_dx };
      }

      /* nut: [ten, x, y] */
      var NUT = [
        { t: "x", x: 60, y: 60 }, { t: "w", x: 60, y: 130 }, { t: "b", x: 60, y: 200 },
        { t: "z", x: 210, y: 110 }, { t: "a", x: 340, y: 110 },
        { t: "y", x: 340, y: 210 }, { t: "L", x: 470, y: 150 }
      ];
      var CANH = [[0, 3], [1, 3], [2, 3], [3, 4], [4, 6], [5, 6]];

      /* buoc 0..5: 0 = chua gi, 1..2 = xuoi, 3..5 = nguoc */
      var BUOC = [
        { t: "Chưa chạy", mo: [] },
        { t: "① Xuôi: z = w·x + b", mo: ["z"] },
        { t: "② Xuôi: a = φ(z),  L = (a−y)²", mo: ["z", "a", "L"] },
        { t: "③ Ngược: ∂L/∂a = 2(a−y)", mo: ["z", "a", "L"], ng: ["a"] },
        { t: "④ Ngược: ∂L/∂z = ∂L/∂a · φ′(z)", mo: ["z", "a", "L"], ng: ["a", "z"] },
        { t: "⑤ Ngược: ∂L/∂w = ∂L/∂z · x   ·   ∂L/∂b = ∂L/∂z",
          mo: ["z", "a", "L"], ng: ["a", "z", "w", "b", "x"] }
      ];

      function ve() {
        g.clearRect(0, 0, W, H);
        var k = tinh(), b = BUOC[tt.buoc];

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText(b.t, 14, 20);

        /* canh */
        CANH.forEach(function (e) {
          var A = NUT[e[0]], B = NUT[e[1]];
          var nguoc = b.ng && b.ng.indexOf(A.t) >= 0 && b.ng.indexOf(B.t) >= 0;
          g.strokeStyle = nguoc ? V.mau("loi") : V.mau("bd");
          g.lineWidth = nguoc ? 2.4 : 1.4;
          g.beginPath(); g.moveTo(A.x + 20, A.y); g.lineTo(B.x - 20, B.y); g.stroke();
          /* mui ten */
          var dx = (B.x - 20) - (A.x + 20), dy = B.y - A.y;
          var L2 = Math.sqrt(dx * dx + dy * dy);
          var ux = dx / L2, uy = dy / L2;
          var mx = nguoc ? A.x + 20 + ux * 12 : B.x - 20;
          var my = nguoc ? A.y + uy * 12 : B.y;
          var s = nguoc ? -1 : 1;
          g.fillStyle = nguoc ? V.mau("loi") : V.mau("bd");
          g.beginPath();
          g.moveTo(mx, my);
          g.lineTo(mx - s * (ux * 8 + uy * 4), my - s * (uy * 8 - ux * 4));
          g.lineTo(mx - s * (ux * 8 - uy * 4), my - s * (uy * 8 + ux * 4));
          g.closePath(); g.fill();
        });

        /* nut */
        var giaTri = { x: tt.x, w: tt.w, b: tt.b, y: tt.y, z: k.z, a: k.a, L: k.L };
        var grad = { x: k.dL_dx, w: k.dL_dw, b: k.dL_db, z: k.dL_dz, a: k.dL_da, L: 1 };
        NUT.forEach(function (n) {
          var sang = b.mo.indexOf(n.t) >= 0 || ["x", "w", "b", "y"].indexOf(n.t) >= 0;
          var coNg = b.ng && b.ng.indexOf(n.t) >= 0;
          g.fillStyle = coNg ? V.mau("loi") : (sang ? V.mau("ac") : V.mau("bd"));
          g.beginPath(); g.arc(n.x, n.y, 20, 0, 6.2832); g.fill();
          g.fillStyle = "#fff"; g.font = "700 14px system-ui"; g.textAlign = "center";
          g.fillText(n.t, n.x, n.y + 5);
          /* gia tri */
          g.fillStyle = V.mau("tx2"); g.font = "11px ui-monospace, monospace";
          g.fillText(sang ? giaTri[n.t].toFixed(3) : "—", n.x, n.y + 36);
          /* gradient */
          if (coNg && grad[n.t] !== undefined) {
            g.fillStyle = V.mau("loi"); g.font = "700 10.5px ui-monospace, monospace";
            g.fillText("∂L/∂" + n.t + "=" + grad[n.t].toFixed(3), n.x, n.y - 28);
          }
        });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var k = tinh();
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Quy tắc chuỗi — nhân dồn dọc đường đi:", 14, 20);

        var dong = [
          ["z = w·x + b", k.z.toFixed(4)],
          ["a = φ(z)", k.a.toFixed(4)],
          ["L = (a − y)²", k.L.toFixed(4)],
          ["", ""],
          ["∂L/∂a = 2(a − y)", k.dL_da.toFixed(4)],
          ["∂a/∂z = φ′(z)", k.da_dz.toFixed(4)],
          ["∂L/∂z = ∂L/∂a · ∂a/∂z", k.dL_dz.toFixed(4)],
          ["∂L/∂w = ∂L/∂z · x", k.dL_dw.toFixed(4)],
          ["∂L/∂b = ∂L/∂z · 1", k.dL_db.toFixed(4)]
        ];
        dong.forEach(function (d, i) {
          if (!d[0]) return;
          var y = 42 + i * 19;
          var ng = i >= 4;
          g2.fillStyle = ng ? V.mau("loi") : V.mau("tx2");
          g2.font = "11.5px ui-monospace, monospace";
          g2.fillText(d[0], 18, y);
          g2.fillStyle = V.mau("tx"); g2.font = "700 11.5px ui-monospace, monospace";
          g2.fillText(d[1], 290, y);
        });

        /* canh bao bao hoa */
        if (Math.abs(k.da_dz) < 0.05) {
          g2.fillStyle = V.mau("loi"); g2.font = "700 11.5px system-ui";
          g2.fillText("⚠ φ′(z) = " + k.da_dz.toFixed(4) + " — CỔNG ĐÃ BÃO HOÀ.", 18, H2 - 12);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Mọi gradient phía sau bị nhân với số này ⇒ gần như không học được.",
                      18, H2 - 28);
        }
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.nut("Bước tiếp →", function () {
          tt.buoc = (tt.buoc + 1) % BUOC.length; veHet();
        }, "chinh"),
        V.nut("Về đầu", function () { tt.buoc = 0; veHet(); }),
        V.chon({ ten: "Hàm kích hoạt φ", giaTri: tt.kich,
                 muc: [{ v: "sigmoid", t: "sigmoid" }, { v: "tanh", t: "tanh" },
                       { v: "relu", t: "ReLU" }],
                 doi: function (v) { tt.kich = v; veHet(); } }),
        V.truot({ ten: "x — đầu vào", min: -4, max: 4, buoc: 0.1, giaTri: tt.x,
                  doi: function (v) { tt.x = v; veHet(); } }),
        V.truot({ ten: "w — trọng số", min: -5, max: 5, buoc: 0.1, giaTri: tt.w,
                  doi: function (v) { tt.w = v; veHet(); } }),
        V.truot({ ten: "b — độ chệch", min: -5, max: 5, buoc: 0.1, giaTri: tt.b,
                  doi: function (v) { tt.b = v; veHet(); } }),
        V.truot({ ten: "y — nhãn đúng", min: 0, max: 1, buoc: 0.05, giaTri: tt.y,
                  doi: function (v) { tt.y = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Bấm \"Bước tiếp\" năm lần</b> để đi hết một vòng xuôi rồi một vòng ngược. " +
          "Mũi tên <b>đỏ</b> là chiều gradient chảy — ngược với chiều tính.<ul>" +
          "<li><b>Lượt xuôi</b> chỉ là thay số vào công thức. Cái đáng học nằm ở " +
          "<b>lượt ngược</b>: mỗi nút nhận gradient từ nút sau nó rồi <b>nhân với đạo hàm " +
          "cục bộ của chính nó</b> trước khi truyền tiếp. Không có gì hơn thế.</li>" +
          "<li>★ Chú ý <code>∂L/∂w = ∂L/∂z · x</code>: gradient của trọng số <b>tỉ lệ thuận " +
          "với đầu vào</b>. Đầu vào lớn ⇒ gradient lớn. <b>Đây chính là lý do phải chuẩn hoá " +
          "dữ liệu</b> — nếu một đặc trưng có thang đo gấp 1000 lần đặc trưng khác, " +
          "gradient của chúng cũng lệch 1000 lần và bộ tối ưu sẽ đi ngoằn ngoèo.</li></ul>" +
          "<b>★ Thí nghiệm bắt buộc — kéo w hoặc x ra xa (ví dụ w = 5, x = 4):</b><ul>" +
          "<li>Với <b>sigmoid</b>: <code>z = 20</code>, <code>a ≈ 1,000</code>, và " +
          "<code>φ′(z) ≈ 0,000</code>. Cảnh báo <b>\"CỔNG ĐÃ BÃO HOÀ\"</b> hiện ra. " +
          "Mọi gradient phía trước bị nhân với ~0 ⇒ <b>mạng ngừng học</b>, " +
          "dù mất mát vẫn còn lớn.</li>" +
          "<li>Đổi sang <b>ReLU</b> ở cùng cấu hình: <code>φ′ = 1</code>, gradient chảy nguyên vẹn. " +
          "★ <b>Đây là toàn bộ lý do ReLU thay thế sigmoid</b> trong các lớp ẩn — " +
          "không phải vì nó \"tốt hơn\" một cách trừu tượng, mà vì đạo hàm của nó " +
          "<b>không bị bóp về 0</b>.</li>" +
          "<li>⚠️ Nhưng kéo <code>z</code> về âm với ReLU: <code>φ′ = 0</code> — " +
          "<b>ReLU chết</b>. Nó đổi một chế độ hỏng lấy một chế độ hỏng khác, " +
          "và đó là lý do có LeakyReLU/GELU.</li></ul>" +
          "<b>⇒ Nối sang M05 b.2: mạng 10 lớp sigmoid nhân 10 lần đạo hàm ≤ 0,25 ⇒ " +
          "<code>0,25¹⁰ ≈ 10⁻⁶</code>. Gradient tiêu biến không phải ẩn dụ — nó là phép nhân này.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     Truong thu nhan
     ================================================================ */
  demo({
    id: "truong-thu-nhan", nhom: "Học sâu", mon: "M07",
    ten: "Trường thu nhận — một neuron ở lớp sâu nhìn thấy bao nhiêu?",
    moTa: "Vì sao CNN phải <b>sâu</b> chứ không chỉ <b>rộng</b>. Kéo số lớp, " +
          "stride và dilation để xem vùng nhìn lớn ra sao.",
    lienKet: '<a href="../web/index.html#/bai/m07-bai-04-tich-chap-va-hinh-hoc-tensor">M07 b.4</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { lop: 4, k: 3, stride: 1, dil: 1, anh: 65 };

      /* truong thu nhan cong don:  RF_{l} = RF_{l-1} + (k-1)*dil*prod(stride truoc) */
      function tinhRF() {
        var rf = 1, jump = 1, ds = [{ l: 0, rf: 1, j: 1 }], i;
        for (i = 1; i <= tt.lop; i++) {
          rf = rf + (tt.k - 1) * tt.dil * jump;
          jump = jump * tt.stride;
          ds.push({ l: i, rf: rf, j: jump });
        }
        return ds;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ds = tinhRF();
        var rfCuoi = ds[ds.length - 1].rf;
        var N = tt.anh;
        var S = Math.min(W - 180, H - 50);
        var ox = 14, oy = 30;
        var o = S / N;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Ảnh " + N + "×" + N + " — vùng một neuron ở lớp " + tt.lop + " nhìn thấy",
                   14, 20);

        /* anh nen */
        g.fillStyle = V.mau("surf2"); g.fillRect(ox, oy, S, S);
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1; g.strokeRect(ox, oy, S, S);

        /* cac vong truong thu nhan theo lop */
        ds.forEach(function (d, i) {
          if (!i) return;
          var w = Math.min(N, d.rf) * o;
          var x = ox + (S - w) / 2, y = oy + (S - w) / 2;
          var t = i / tt.lop;
          g.strokeStyle = V.thangMau(t); g.lineWidth = i === tt.lop ? 2.6 : 1.4;
          g.globalAlpha = i === tt.lop ? 1 : 0.55;
          g.strokeRect(x, y, w, w);
          g.globalAlpha = 1;
        });

        /* tam */
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(ox + S / 2, oy + S / 2, 3, 0, 6.2832); g.fill();

        /* chu giai ben phai */
        var xL = ox + S + 16;
        g.font = "11px system-ui";
        ds.forEach(function (d, i) {
          if (!i) return;
          var y = oy + 6 + (i - 1) * 17;
          if (y > oy + S) return;
          g.fillStyle = V.thangMau(i / tt.lop);
          g.fillRect(xL, y - 8, 10, 10);
          g.fillStyle = V.mau("tx2");
          g.fillText("lớp " + i + ": " + d.rf + "×" + d.rf, xL + 16, y);
        });

        var phu = rfCuoi >= N;
        g.fillStyle = phu ? "#0f766e" : V.mau("loi");
        g.font = "700 11.5px system-ui";
        g.fillText(phu ? "✓ đã phủ hết ảnh" : "✗ CHƯA phủ hết ảnh",
                   xL, oy + S - 6);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var ds = tinhRF();
        var rf = ds[ds.length - 1].rf;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("RF_l = RF_{l−1} + (k−1)·dilation·∏stride", 14, 20);

        var dong = [
          ["Số lớp", String(tt.lop)],
          ["Kernel k", tt.k + "×" + tt.k],
          ["Stride", String(tt.stride)],
          ["Dilation", String(tt.dil)],
          ["★ Trường thu nhận cuối", rf + "×" + rf + " điểm ảnh"],
          ["Tham số mỗi lớp (1 kênh)", (tt.k * tt.k) + ""],
          ["So với 1 lớp phủ cùng vùng", (rf * rf) + " tham số"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 42 + i * 20;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = i === 4 ? V.mau("ac") : V.mau("tx");
          g2.font = (i === 4 ? "700 " : "600 ") + "11.5px ui-monospace, monospace";
          g2.fillText(d[1], 250, y);
          g2.font = "11.5px system-ui";
        });

        var tiet = (rf * rf) / Math.max(1, tt.k * tt.k * tt.lop);
        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("⇒ Xếp " + tt.lop + " lớp " + tt.k + "×" + tt.k + " dùng " +
                    (tt.k * tt.k * tt.lop) + " tham số thay vì " + (rf * rf) +
                    " — rẻ hơn " + tiet.toFixed(1) + "×.", 14, H2 - 12);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "Số lớp tích chập", min: 1, max: 12, buoc: 1, giaTri: tt.lop,
                  doi: function (v) { tt.lop = v; veHet(); } }),
        V.truot({ ten: "Kernel k", min: 2, max: 9, buoc: 1, giaTri: tt.k,
                  doi: function (v) { tt.k = v; veHet(); } }),
        V.truot({ ten: "Stride", min: 1, max: 4, buoc: 1, giaTri: tt.stride,
                  doi: function (v) { tt.stride = v; veHet(); } }),
        V.truot({ ten: "Dilation (giãn nở)", min: 1, max: 8, buoc: 1, giaTri: tt.dil,
                  doi: function (v) { tt.dil = v; veHet(); } }),
        V.truot({ ten: "Cạnh ảnh", min: 25, max: 225, buoc: 8, giaTri: tt.anh,
                  doi: function (v) { tt.anh = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Một neuron tích chập chỉ nhìn thấy một ô nhỏ.</b> Nhưng neuron ở lớp 2 " +
          "nhìn qua các neuron lớp 1, nên nó gián tiếp nhìn thấy một vùng rộng hơn. " +
          "Vùng đó là <b>trường thu nhận</b>.<ul>" +
          "<li>Với <code>k = 3, stride = 1</code>, mỗi lớp chỉ cộng thêm <b>2</b> vào cạnh " +
          "trường thu nhận: 3 → 5 → 7 → 9… <b>Tăng TUYẾN TÍNH theo độ sâu</b>. " +
          "Muốn nhìn 100 điểm ảnh cần ~50 lớp.</li>" +
          "<li>★ <b>Kéo stride lên 2</b>: bây giờ nó tăng <b>theo cấp số nhân</b> " +
          "(3 → 7 → 15 → 31…) vì mỗi lớp sau nhảy xa gấp đôi. " +
          "<b>Đây là lý do mọi CNN kinh điển đều có stride hoặc pooling</b> — " +
          "không phải để giảm tính toán, mà để <b>trường thu nhận lớn kịp</b>.</li>" +
          "<li><b>Kéo dilation</b>: tăng trường thu nhận mà <b>không</b> mất độ phân giải " +
          "và <b>không</b> thêm tham số. Đây là mẹo của các mạng phân đoạn " +
          "(cần vừa nhìn rộng vừa giữ chi tiết từng điểm ảnh).</li></ul>" +
          "<b>★ Và đây là lập luận trung tâm của CNN — đọc dòng cuối bảng:</b> " +
          "xếp <b>nhiều lớp nhỏ</b> phủ được cùng một vùng như <b>một lớp lớn</b>, " +
          "nhưng tốn ít tham số hơn <b>hàng chục lần</b>, và còn chèn được phi tuyến " +
          "giữa các lớp.<ul>" +
          "<li>Ví dụ: 5 lớp 3×3 có trường thu nhận 11×11, dùng <code>5×9 = 45</code> tham số. " +
          "Một lớp 11×11 cần <code>121</code> tham số — <b>gấp 2,7 lần</b> mà " +
          "<b>không có phi tuyến nào ở giữa</b>.</li>" +
          "<li>★ Đây đúng là lập luận của VGG, và là lý do kernel lớn (11×11 của AlexNet) " +
          "biến mất khỏi các kiến trúc sau nó.</li></ul>" +
          "<b>⚠️ Chế độ hỏng cần nhớ: nếu trường thu nhận cuối cùng NHỎ HƠN đối tượng bạn " +
          "cần nhận ra, mạng KHÔNG THỂ học được nó — dù bạn huấn luyện bao lâu, " +
          "dữ liệu bao nhiêu. Thông báo \"✗ chưa phủ hết ảnh\" trên hình là phép kiểm tra đó.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     Ro ri du lieu
     ================================================================ */
  demo({
    id: "ro-ri-du-lieu", nhom: "Học máy", mon: "M04",
    ten: "Rò rỉ dữ liệu — vì sao mô hình 0,99 AUC lại chết khi lên production",
    moTa: "Bốn kiểu rò rỉ, mỗi kiểu một cơ chế. Xem <b>điểm offline tăng</b> " +
          "trong khi <b>điểm thật tụt</b> — cùng một lúc.",
    lienKet: '<a href="../web/index.html#/bai/m04-bai-13-ro-ri-du-lieu">M04 b.13</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { kieu: "thoigian", muc: 0.6 };

      var KIEU = {
        thoigian: {
          t: "Rò rỉ thời điểm (target leakage)",
          co: "Đặc trưng được tính từ dữ liệu SAU thời điểm dự đoán.",
          vd: "\"số lần khách gọi tổng đài\" tính trên cả tháng — nhưng bạn phải dự đoán " +
              "rời bỏ VÀO ĐẦU tháng. Khách sắp rời bỏ thì gọi nhiều, nên đặc trưng này " +
              "chính là nhãn được viết lại.",
          dau: "AUC offline cao bất thường (>0,95) ở bài toán vốn khó.",
          sua: "Mọi đặc trưng phải có DẤU THỜI GIAN. Chỉ dùng cái có TRƯỚC t."
        },
        chiatap: {
          t: "Rò rỉ khi chia tập",
          co: "Cùng một thực thể xuất hiện ở cả tập huấn luyện lẫn tập kiểm tra.",
          vd: "Chia ngẫu nhiên theo DÒNG trong khi mỗi khách có 20 dòng ⇒ mô hình " +
              "đã thấy chính khách đó lúc huấn luyện. Nó nhớ khách, không học quy luật.",
          dau: "Điểm kiểm tra gần bằng điểm huấn luyện, khoảng cách bất thường nhỏ.",
          sua: "Chia theo NHÓM (khách hàng / bệnh nhân), không theo dòng."
        },
        tienxuly: {
          t: "Rò rỉ qua tiền xử lý",
          co: "Chuẩn hoá / điền thiếu / chọn đặc trưng tính TRÊN TOÀN BỘ dữ liệu.",
          vd: "Gọi fit trên cả tập rồi mới chia train/test ⇒ trung bình và độ lệch chuẩn " +
              "của tập kiểm tra đã rò vào tập huấn luyện.",
          dau: "Khó thấy — chênh lệch thường nhỏ nhưng ĐỀU ĐẶN theo hướng có lợi.",
          sua: "Đặt mọi bước tiền xử lý TRONG pipeline, fit CHỈ trên tập huấn luyện."
        },
        thoigianCV: {
          t: "Rò rỉ trong kiểm định chéo chuỗi thời gian",
          co: "K-fold ngẫu nhiên trên dữ liệu có trật tự thời gian.",
          vd: "Fold 3 huấn luyện trên dữ liệu tháng 12 rồi kiểm tra trên tháng 6 — " +
              "mô hình đang dự đoán QUÁ KHỨ từ TƯƠNG LAI.",
          dau: "Kết quả backtest đẹp, nhưng đi vào thực tế thì sụp ngay tháng đầu.",
          sua: "Dùng chia theo thời gian tiến dần (walk-forward), không bao giờ K-fold ngẫu nhiên."
        }
      };

      function ve() {
        g.clearRect(0, 0, W, H);
        var K = KIEU[tt.kieu];
        var padL = 50, padR = 16, padT = 34, padB = 40;
        var w = W - padL - padR, h = H - padT - padB;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Điểm bạn ĐO được và điểm bạn THỰC SỰ có", padL, 20);

        /* truc */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = 0.5 + i * 0.125, yy = padT + h - (v - 0.5) / 0.5 * h;
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(2), padL - 6, yy + 3);
        }
        g.textAlign = "center";
        g.fillText("mức độ rò rỉ →", padL + w / 2, padT + h + 26);

        var Y = function (v) { return padT + h - (v - 0.5) / 0.5 * h; };
        var X = function (m) { return padL + m * w; };

        /* AUC offline TANG theo ro ri; AUC that GIAM */
        [{ f: function (m) { return 0.78 + 0.21 * m; }, mau: "#0f766e", t: "AUC offline (bạn thấy)" },
         { f: function (m) { return 0.78 - 0.26 * m; }, mau: "#b91c1c", t: "AUC thật khi lên production" }
        ].forEach(function (d) {
          g.strokeStyle = d.mau; g.lineWidth = 2.4;
          g.beginPath();
          for (var m = 0; m <= 1; m += 0.02) {
            var yy = Y(d.f(m));
            if (m === 0) g.moveTo(X(m), yy); else g.lineTo(X(m), yy);
          }
          g.stroke();
        });

        /* vach muc hien tai */
        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("ac"); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(X(tt.muc), padT); g.lineTo(X(tt.muc), padT + h); g.stroke();
        g.restore();
        var a1 = 0.78 + 0.21 * tt.muc, a2 = 0.78 - 0.26 * tt.muc;
        [[a1, "#0f766e"], [a2, "#b91c1c"]].forEach(function (p) {
          g.fillStyle = p[1];
          g.beginPath(); g.arc(X(tt.muc), Y(p[0]), 5, 0, 6.2832); g.fill();
        });

        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = "#0f766e"; g.fillText("── AUC offline: " + a1.toFixed(3), padL + 8, padT + 12);
        g.fillStyle = "#b91c1c"; g.fillText("── AUC thật: " + a2.toFixed(3), padL + 8, padT + 26);

        g.fillStyle = V.mau("loi"); g.font = "700 12px system-ui";
        g.fillText("Khoảng cách ảo tưởng: " + (a1 - a2).toFixed(3) + " AUC", padL, H - 12);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var K = KIEU[tt.kieu];
        g2.fillStyle = V.mau("ac"); g2.font = "700 13px system-ui"; g2.textAlign = "left";
        g2.fillText(K.t, 14, 20);

        var dong = [["Cơ chế", K.co], ["Ví dụ", K.vd],
                    ["Dấu hiệu", K.dau], ["Cách chặn", K.sua]];
        var y = 42;
        dong.forEach(function (d, i) {
          g2.fillStyle = i === 3 ? "#0f766e" : (i === 2 ? "#b45309" : V.mau("tx2"));
          g2.font = "700 11px system-ui";
          g2.fillText(d[0], 14, y);
          g2.fillStyle = V.mau("tx"); g2.font = "11.5px system-ui";
          /* xuong dong tho */
          var chu = d[1].split(" "), dong2 = "", ds = [];
          chu.forEach(function (c) {
            if ((dong2 + " " + c).length > 72) { ds.push(dong2); dong2 = c; }
            else dong2 = dong2 ? dong2 + " " + c : c;
          });
          if (dong2) ds.push(dong2);
          ds.forEach(function (t, k) { g2.fillText(t, 84, y + k * 15); });
          y += Math.max(1, ds.length) * 15 + 9;
        });
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Kiểu rò rỉ", giaTri: tt.kieu,
                 muc: Object.keys(KIEU).map(function (k) { return { v: k, t: KIEU[k].t }; }),
                 doi: function (v) { tt.kieu = v; veHet(); } }),
        V.truot({ ten: "Mức độ rò rỉ", min: 0, max: 1, buoc: 0.05, giaTri: tt.muc,
                  doi: function (v) { tt.muc = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Rò rỉ dữ liệu là lỗi tốn kém nhất trong học máy ứng dụng</b> — không phải vì " +
          "nó khó sửa, mà vì <b>nó không có triệu chứng nào trông giống lỗi</b>. " +
          "Mọi chỉ số đều đẹp lên.<ul>" +
          "<li>★ Đọc kỹ hai đường: <b>rò rỉ càng nặng thì điểm offline càng CAO, " +
          "còn điểm thật càng THẤP</b>. Chúng đi ngược chiều nhau. " +
          "Nghĩa là <b>chính cái làm bạn vui là cái đang giết mô hình</b>.</li>" +
          "<li>Không có cảnh báo, không có ngoại lệ, không có test nào đỏ. " +
          "Bạn chỉ phát hiện ra khi mô hình đã chạy thật vài tuần.</li></ul>" +
          "<b>★ Phép thử một câu, dùng được cho mọi đặc trưng:</b><br>" +
          "<i>\"Tại đúng thời điểm tôi phải đưa ra dự đoán, giá trị này đã TỒN TẠI chưa?\"</i><br>" +
          "Nếu câu trả lời là \"chưa, nó được tính sau\" hoặc \"tôi không chắc\" ⇒ " +
          "<b>bỏ đặc trưng đó</b>. Một đặc trưng đáng ngờ không đáng đánh đổi cả mô hình.<br><br>" +
          "<b>★ Bốn kiểu ở trên xếp theo độ khó phát hiện — đổi hộp chọn và đọc dòng \"Dấu hiệu\":</b><ul>" +
          "<li><b>Rò rỉ thời điểm</b> dễ thấy nhất: AUC cao bất thường ở bài toán vốn khó. " +
          "Quy tắc: <b>AUC > 0,95 ở bài toán kinh doanh thật là dấu hiệu nghi ngờ, " +
          "không phải dấu hiệu thành công.</b></li>" +
          "<li><b>Rò rỉ qua tiền xử lý</b> khó nhất: chênh lệch nhỏ nhưng " +
          "<b>đều đặn theo hướng có lợi</b> — nên nó sống sót qua mọi vòng review.</li></ul>" +
          "<b>⇒ Cách chặn có hệ thống, không dựa vào sự cẩn thận: ① mọi bước tiền xử lý nằm " +
          "TRONG pipeline (fit chỉ trên train) · ② chia theo NHÓM chứ không theo dòng · " +
          "③ mọi đặc trưng có dấu thời gian và bộ kiểm tự động chặn đặc trưng \"từ tương lai\" · " +
          "④ dữ liệu chuỗi thời gian thì chia tiến dần, không bao giờ K-fold ngẫu nhiên.</b>"
      });
      veHet();
    }
  });

})();
