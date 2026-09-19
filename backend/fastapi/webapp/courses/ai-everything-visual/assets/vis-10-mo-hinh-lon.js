/* =====================================================================
   Bo sung 2 — Hoc tang cuong & mo hinh lon
   q-learning-luoi (M08) · rlhf-va-kl (M09)
   dinh-luat-ty-le (M09) · giai-ma-sinh (M06)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     Q-learning tren luoi — Bellman chay that
     ================================================================ */
  demo({
    id: "q-learning-luoi", nhom: "Tìm kiếm & quyết định", mon: "M08",
    ten: "Q-learning trên lưới — Bellman chạy thật",
    moTa: "Tác tử <b>không biết gì về bản đồ</b>, chỉ nhận thưởng. Xem giá trị " +
          "lan ngược từ đích, và <b>ε = 0 làm nó kẹt</b> thế nào.",
    lienKet: '<a href="../web/index.html#/bai/m08-bai-06-q-learning-va-sarsa">M08 b.6</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 220;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var R = 6, C = 8;
      var tt = { eps: 0.2, alpha: 0.3, gamma: 0.92, tocDo: 40, hienQ: true };

      /* ban do: 0 trong, 1 tuong, 2 dich (+1), 3 ho (-1) */
      var BAN_DO = [
        [0,0,0,0,0,0,0,2],
        [0,1,1,0,1,1,0,0],
        [0,0,1,0,0,0,0,3],
        [0,0,1,1,1,0,1,0],
        [0,0,0,0,1,0,0,0],
        [3,1,1,0,0,0,1,0]
      ];
      var HD = [[-1,0],[1,0],[0,-1],[0,1]];           /* len, xuong, trai, phai */
      var Q, s, tap, tongThuong, lichSu, vl, buoc;
      var rr;

      function datLai() {
        Q = [];
        for (var i = 0; i < R; i++) {
          Q.push([]);
          for (var j = 0; j < C; j++) Q[i].push([0, 0, 0, 0]);
        }
        s = { r: R - 1, c: 0 };
        if (BAN_DO[s.r][s.c] !== 0) s = { r: 4, c: 0 };
        tap = 0; tongThuong = 0; lichSu = []; buoc = 0;
        rr = V.rng(17);
      }

      function hopLe(r, c) {
        return r >= 0 && r < R && c >= 0 && c < C && BAN_DO[r][c] !== 1;
      }
      function ketThuc(r, c) { return BAN_DO[r][c] === 2 || BAN_DO[r][c] === 3; }
      function thuong(r, c) {
        if (BAN_DO[r][c] === 2) return 1;
        if (BAN_DO[r][c] === 3) return -1;
        return -0.01;                                  /* phi moi buoc */
      }

      function motBuoc() {
        var a;
        if (rr() < tt.eps) a = Math.floor(rr() * 4);
        else {
          var q = Q[s.r][s.c], best = 0;
          for (var k = 1; k < 4; k++) if (q[k] > q[best]) best = k;
          a = best;
        }
        var nr = s.r + HD[a][0], nc = s.c + HD[a][1];
        if (!hopLe(nr, nc)) { nr = s.r; nc = s.c; }
        var r2 = thuong(nr, nc);
        var maxNext = 0;
        if (!ketThuc(nr, nc)) {
          maxNext = Math.max.apply(null, Q[nr][nc]);
        }
        /* cap nhat Q-learning:  Q(s,a) += alpha*(r + gamma*max Q(s',.) - Q(s,a)) */
        Q[s.r][s.c][a] += tt.alpha * (r2 + tt.gamma * maxNext - Q[s.r][s.c][a]);
        tongThuong += r2; buoc++;

        if (ketThuc(nr, nc) || buoc > 300) {
          lichSu.push(tongThuong);
          if (lichSu.length > 240) lichSu.shift();
          tap++; tongThuong = 0; buoc = 0;
          s = { r: R - 1, c: 0 };
          if (BAN_DO[s.r][s.c] !== 0) s = { r: 4, c: 0 };
        } else { s = { r: nr, c: nc }; }
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var o = Math.min((W - 30) / C, (H - 50) / R);
        var ox = 14, oy = 30;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Tập " + tap + "  ·  ô càng đậm = giá trị V(s) = max_a Q(s,a) càng cao",
                   14, 20);

        var vMax = 0.0001;
        for (var i = 0; i < R; i++) for (var j = 0; j < C; j++) {
          if (BAN_DO[i][j] === 1) continue;
          vMax = Math.max(vMax, Math.max.apply(null, Q[i][j]));
        }

        for (i = 0; i < R; i++) {
          for (j = 0; j < C; j++) {
            var x = ox + j * o, y = oy + i * o;
            var t = BAN_DO[i][j];
            if (t === 1) { g.fillStyle = V.mau("bd"); g.fillRect(x, y, o - 2, o - 2); continue; }
            var vv = Math.max(0, Math.max.apply(null, Q[i][j])) / vMax;
            g.fillStyle = tt.hienQ ? V.thangMau(vv * 0.95) : V.mau("surf2");
            g.fillRect(x, y, o - 2, o - 2);
            g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
            g.strokeRect(x, y, o - 2, o - 2);

            if (t === 2 || t === 3) {
              g.fillStyle = t === 2 ? "#0f766e" : "#b91c1c";
              g.beginPath(); g.arc(x + o / 2, y + o / 2, o * 0.26, 0, 6.2832); g.fill();
              g.fillStyle = "#fff"; g.font = "700 12px system-ui"; g.textAlign = "center";
              g.fillText(t === 2 ? "+1" : "−1", x + o / 2, y + o / 2 + 4);
              continue;
            }
            /* mui ten chinh sach */
            if (tt.hienQ && vMax > 0.01) {
              var q = Q[i][j], b = 0;
              for (var k = 1; k < 4; k++) if (q[k] > q[b]) b = k;
              if (Math.abs(q[b]) > 1e-6) {
                var cx = x + o / 2, cy = y + o / 2, L = o * 0.26;
                var dx = HD[b][1] * L, dy = HD[b][0] * L;
                g.strokeStyle = vv > 0.5 ? "#fff" : V.mau("tx2"); g.lineWidth = 2;
                g.beginPath(); g.moveTo(cx - dx * 0.6, cy - dy * 0.6);
                g.lineTo(cx + dx, cy + dy); g.stroke();
                g.fillStyle = vv > 0.5 ? "#fff" : V.mau("tx2");
                g.beginPath();
                g.moveTo(cx + dx, cy + dy);
                g.lineTo(cx + dx - dx * 0.5 - dy * 0.35, cy + dy - dy * 0.5 + dx * 0.35);
                g.lineTo(cx + dx - dx * 0.5 + dy * 0.35, cy + dy - dy * 0.5 - dx * 0.35);
                g.closePath(); g.fill();
              }
            }
          }
        }
        /* tac tu */
        g.fillStyle = V.mau("ac");
        g.beginPath();
        g.arc(ox + s.c * o + o / 2, oy + s.r * o + o / 2, o * 0.2, 0, 6.2832);
        g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 46, padR = 16, padT = 26, padB = 56;
        var w = W2 - padL - padR, h = H2 - padT - padB;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Tổng thưởng mỗi tập (240 tập gần nhất)", padL, 16);

        if (lichSu.length > 1) {
          var lo = Math.min.apply(null, lichSu), hi = Math.max.apply(null, lichSu);
          if (hi - lo < 1e-9) hi = lo + 1;
          var X = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
          g2.strokeStyle = V.mau("ac"); g2.lineWidth = 1.5;
          g2.beginPath();
          lichSu.forEach(function (v, k) { var yy = Y(v); if (!k) g2.moveTo(X(k), yy); else g2.lineTo(X(k), yy); });
          g2.stroke();
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(2), padL - 5, padT + 8);
          g2.fillText(lo.toFixed(2), padL - 5, padT + h);
          /* trung binh 30 tap cuoi */
          var n = Math.min(30, lichSu.length);
          var tb = lichSu.slice(-n).reduce(function (a, b) { return a + b; }, 0) / n;
          g2.textAlign = "left"; g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
          g2.fillText("Trung bình 30 tập cuối: ", padL, H2 - 32);
          g2.fillStyle = tb > 0.5 ? "#0f766e" : V.mau("loi");
          g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(tb.toFixed(3), padL + 150, H2 - 32);
        }
        g2.textAlign = "left";
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Q(s,a) ← Q(s,a) + α·[ r + γ·max Q(s′,·) − Q(s,a) ]", padL, H2 - 12);
      }

      function veHet() { ve(); ve2(); }

      vl = V.vongLap(function () {
        for (var i = 0; i < tt.tocDo; i++) motBuoc();
        veHet();
      });
      function batDau() { datLai(); veHet(); vl.chay(); }

      var dk = [
        V.truot({ ten: "ε — tỷ lệ khám phá", min: 0, max: 0.6, buoc: 0.01, giaTri: tt.eps,
                  doi: function (v) { tt.eps = v; } }),
        V.truot({ ten: "α — tốc độ học", min: 0.02, max: 0.9, buoc: 0.02, giaTri: tt.alpha,
                  doi: function (v) { tt.alpha = v; } }),
        V.truot({ ten: "γ — hệ số chiết khấu", min: 0.5, max: 0.999, buoc: 0.005,
                  giaTri: tt.gamma, doi: function (v) { tt.gamma = v; } }),
        V.truot({ ten: "Tốc độ (bước/khung hình)", min: 1, max: 200, buoc: 1, giaTri: tt.tocDo,
                  doi: function (v) { tt.tocDo = v; } }),
        V.danhDau({ ten: "Hiện giá trị và chính sách", giaTri: tt.hienQ,
                    doi: function (v) { tt.hienQ = v; veHet(); } }),
        V.nut("Học lại từ đầu", function () { vl.dung(); batDau(); }, "chinh"),
        V.nut("Tạm dừng", function () { vl.dung(); })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Tác tử KHÔNG biết bản đồ, không biết đích ở đâu.</b> Nó chỉ nhận thưởng " +
          "<code>+1</code> ở ô xanh, <code>−1</code> ở ô đỏ, và <code>−0,01</code> mỗi bước " +
          "(phí thời gian). Mọi thứ nó biết đều học từ kinh nghiệm.<ul>" +
          "<li>Xem <b>màu lan ngược từ đích</b>. Đây chính là phương trình Bellman đang chạy: " +
          "giá trị của một ô = thưởng tức thì + γ × giá trị ô tốt nhất kế tiếp. " +
          "Thông tin <b>chảy ngược</b> từ nơi có thưởng về nơi xuất phát, mỗi tập một chút.</li>" +
          "<li>Mũi tên là <b>chính sách tham lam</b> hiện tại — hướng có Q cao nhất.</li></ul>" +
          "<b>★ Thí nghiệm 1 — kéo ε về 0 và bấm \"Học lại từ đầu\":</b> tác tử " +
          "<b>không bao giờ khám phá</b>. Nó bám lấy hành động đầu tiên trông có vẻ ổn và " +
          "lặp lại mãi. Màu gần như không lan, đường thưởng nằm bẹp. " +
          "★ <b>Đây là bài toán khai thác–khám phá của M08 b.2 xuất hiện lại</b>: " +
          "không khám phá thì không có dữ liệu để học.<br><br>" +
          "<b>★ Thí nghiệm 2 — kéo γ xuống 0,5:</b> tác tử thành <b>thiển cận</b>. " +
          "Giá trị chiết khấu quá mạnh nên đích ở xa <b>gần như vô hình</b> " +
          "(<code>0,5²⁰ ≈ 10⁻⁶</code>), và nó chỉ tối ưu vài bước trước mắt. " +
          "Kéo γ lên 0,99 thì tầm nhìn xa ra rõ rệt.<br><br>" +
          "<b>★ Thí nghiệm 3 — kéo α lên 0,9:</b> mỗi cập nhật ghi đè gần hết giá trị cũ ⇒ " +
          "Q <b>nhảy loạn</b> theo từng mẫu nhiễu và không hội tụ. Kéo α về 0,02: " +
          "hội tụ mượt nhưng <b>rất chậm</b>. Không có giá trị đúng phổ quát — " +
          "α lớn lúc đầu, nhỏ dần về sau là mẹo thực dụng.<br><br>" +
          "<b>⚠️ Chú ý ô −1 ở góc dưới trái, ngay cạnh điểm xuất phát.</b> Với ε lớn, " +
          "tác tử rơi vào đó thường xuyên lúc đầu — và đó là cái giá <b>có thật</b> của khám phá. " +
          "Trong mô phỏng thì rẻ; với robot thật hay hệ thống thật thì <b>không</b>, " +
          "và đó là lý do RL ngoài đời khó hơn RL trong sách rất nhiều."
      });
      batDau();
    }
  });

  /* ================================================================
     RLHF: thuong cua mo hinh phan thuong vs ngan sach KL
     ================================================================ */
  demo({
    id: "rlhf-va-kl", nhom: "AI hiện đại", mon: "M09",
    ten: "RLHF — vì sao phải phạt KL",
    moTa: "Tối ưu mô hình phần thưởng mà không ràng buộc thì mô hình " +
          "<b>trôi khỏi ngôn ngữ</b>. Kéo hệ số β để tìm chỗ đánh đổi.",
    lienKet: '<a href="../web/index.html#/bai/m09-bai-16-tinh-chinh-chi-dan-rlhf-dpo">M09 b.16</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { beta: 0.12, buoc: 1400 };

      /* Mo hinh don gian hoa (co chu dich, khong phai do dac):
         KL(t) tang theo ap luc toi uu; diem RM tang roi bao hoa;
         chat luong THAT = diem RM that (tang theo can) tru phan "hack" tang theo KL. */
      function motDiem(t) {
        var ap = t / 1000;
        var kl = ap * ap * 9 / (1 + tt.beta * 34);        /* beta cang lon, KL cang bi kim */
        var rm = 2.6 * Math.sqrt(ap) * (1 - Math.exp(-2.2 * ap));
        var that = rm - 0.085 * kl;                        /* phan RM sai bi khai thac */
        return { kl: kl, rm: rm, that: that };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 46, padR = 46, padT = 30, padB = 40;
        var w = W - padL - padR, h = H - padT - padB;
        var N = 200, i;

        var pts = [];
        for (i = 0; i <= N; i++) pts.push(motDiem(i / N * tt.buoc));
        var rmMax = Math.max.apply(null, pts.map(function (p) { return p.rm; }));
        var klMax = Math.max.apply(null, pts.map(function (p) { return p.kl; })) || 1;
        var lo = Math.min.apply(null, pts.map(function (p) { return p.that; }));
        var hi = Math.max(rmMax, 0.1);

        var X = function (k) { return padL + k / N * w; };
        var Y = function (v) { return padT + h - (v - lo) / (hi - lo) * h; };
        var YK = function (v) { return padT + h - v / klMax * h; };

        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Điểm theo mô hình phần thưởng vs chất lượng THẬT", padL, 18);

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        for (i = 0; i <= 4; i++) {
          var yy = padT + h - i / 4 * h;
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
        }

        /* KL (truc phai) */
        g.strokeStyle = "#b45309"; g.lineWidth = 1.6; g.setLineDash([4, 3]);
        g.beginPath();
        pts.forEach(function (p, k) { var yy = YK(p.kl); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
        g.stroke(); g.setLineDash([]);

        /* RM */
        g.strokeStyle = "#0f766e"; g.lineWidth = 2.4;
        g.beginPath();
        pts.forEach(function (p, k) { var yy = Y(p.rm); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
        g.stroke();

        /* that */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.4;
        g.beginPath();
        pts.forEach(function (p, k) { var yy = Y(p.that); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
        g.stroke();

        /* dinh chat luong that */
        var bi = 0;
        pts.forEach(function (p, k) { if (p.that > pts[bi].that) bi = k; });
        g.strokeStyle = V.mau("ac"); g.lineWidth = 1.4; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(X(bi), padT); g.lineTo(X(bi), padT + h); g.stroke();
        g.setLineDash([]);
        g.fillStyle = V.mau("ac"); g.font = "700 10.5px system-ui"; g.textAlign = "center";
        g.fillText("★ đỉnh chất lượng thật", X(bi), padT - 4);

        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = "#0f766e"; g.fillText("── điểm mô hình phần thưởng", padL + 8, padT + 14);
        g.fillStyle = V.mau("ac"); g.fillText("── chất lượng THẬT (người đánh giá)", padL + 8, padT + 28);
        g.fillStyle = "#b45309"; g.fillText("-- KL so với mô hình gốc", padL + 8, padT + 42);

        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "center";
        g.fillText("bước tối ưu RL →", padL + w / 2, padT + h + 26);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var N = 200, pts = [], i;
        for (i = 0; i <= N; i++) pts.push(motDiem(i / N * tt.buoc));
        var bi = 0;
        pts.forEach(function (p, k) { if (p.that > pts[bi].that) bi = k; });
        var cuoi = pts[N], dinh = pts[bi];

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("β = " + tt.beta.toFixed(2) + "  ·  " + tt.buoc + " bước tối ưu", 14, 20);

        var dong = [
          ["Điểm RM ở đỉnh chất lượng thật", dinh.rm.toFixed(3)],
          ["Chất lượng THẬT ở đỉnh", dinh.that.toFixed(3)],
          ["KL ở đỉnh", dinh.kl.toFixed(2)],
          ["", ""],
          ["Điểm RM ở cuối", cuoi.rm.toFixed(3)],
          ["★ Chất lượng THẬT ở cuối", cuoi.that.toFixed(3)],
          ["KL ở cuối", cuoi.kl.toFixed(2)]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i2) {
          if (!d[0]) return;
          var y = 42 + i2 * 19;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          var xau = i2 === 5 && cuoi.that < dinh.that - 1e-6;
          g2.fillStyle = xau ? V.mau("loi") : V.mau("tx");
          g2.font = (i2 === 5 ? "700 " : "600 ") + "11.5px ui-monospace, monospace";
          g2.fillText(d[1], 290, y);
          g2.font = "11.5px system-ui";
        });

        var mat = dinh.that - cuoi.that;
        g2.fillStyle = mat > 0.02 ? V.mau("loi") : "#0f766e";
        g2.font = "700 12px system-ui";
        g2.fillText(mat > 0.02
          ? "⚠ Tối ưu quá đà: mất " + mat.toFixed(3) + " chất lượng thật so với đỉnh."
          : "✓ Chưa tối ưu quá đà ở ngân sách bước này.", 14, H2 - 12);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "β — hệ số phạt KL", min: 0, max: 0.6, buoc: 0.01, giaTri: tt.beta,
                  doi: function (v) { tt.beta = v; veHet(); } }),
        V.truot({ ten: "Số bước tối ưu RL", min: 200, max: 3000, buoc: 100, giaTri: tt.buoc,
                  doi: function (v) { tt.buoc = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "⚖️ <b>Đây là mô hình MINH HOẠ, không phải số đo.</b> Hình dạng các đường " +
          "(RM tăng đơn điệu · chất lượng thật đạt đỉnh rồi giảm · KL tăng theo áp lực tối ưu) " +
          "khớp với những gì được báo cáo trong tài liệu RLHF, nhưng con số cụ thể là dựng lên " +
          "để bạn kéo được.<ul>" +
          "<li><b>Mô hình phần thưởng (RM)</b> là một mạng học từ so sánh của người. " +
          "Nó là <b>phép thay thế</b> cho \"thứ con người thực sự muốn\" — và nó " +
          "<b>sai ở những chỗ không ai kiểm</b>.</li>" +
          "<li>Tối ưu mạnh sẽ <b>tìm ra đúng những chỗ sai đó</b>. Đường xanh (điểm RM) " +
          "cứ tăng; đường tím (chất lượng thật) đạt đỉnh rồi <b>đi xuống</b>. " +
          "★ Đây chính là <b>định luật Goodhart</b> ở dạng cụ thể nhất.</li></ul>" +
          "<b>★ Kéo β về 0 — bỏ hoàn toàn phạt KL:</b><ul>" +
          "<li>KL <b>bùng nổ</b>: mô hình trôi rất xa khỏi mô hình gốc. Trong thực tế điều này " +
          "trông như <b>sinh ra văn bản lặp lại, kỳ quặc, hoặc khai thác một mẫu câu " +
          "mà RM chấm cao</b> — chứ không còn là ngôn ngữ tự nhiên.</li>" +
          "<li>Khoảng cách giữa \"chất lượng thật ở đỉnh\" và \"ở cuối\" phình ra — " +
          "<b>bạn đã tối ưu vượt qua điểm có lợi từ lâu</b>.</li></ul>" +
          "<b>★ Kéo β lên 0,5:</b> KL bị kìm chặt, mô hình gần như <b>không đổi</b> so với bản gốc. " +
          "An toàn, nhưng <b>RLHF gần như vô tác dụng</b> — bạn trả tiền tính toán mà không " +
          "nhận được căn chỉnh nào.<br><br>" +
          "<b>⇒ Ba cách chống tối ưu quá đà, xếp theo mức tin cậy:</b><br>" +
          "① <b>Phạt KL</b> (demo này) — rẻ, nhưng chỉ là ràng buộc <b>khoảng cách</b>, " +
          "không phải ràng buộc <b>đúng đắn</b> ·<br>" +
          "② <b>Dừng sớm theo đánh giá của NGƯỜI</b>, không theo điểm RM — " +
          "★ vì điểm RM <b>không bao giờ</b> báo cho bạn biết đã quá đà ·<br>" +
          "③ <b>Huấn luyện lại RM</b> trên dữ liệu mới sinh bởi chính chính sách hiện tại " +
          "(vá đúng chỗ nó đang bị khai thác).<br><br>" +
          "<b>⚠️ Điều quan trọng nhất: đường xanh là thứ bạn ĐO ĐƯỢC trong lúc huấn luyện. " +
          "Đường tím thì KHÔNG. Nếu chỉ nhìn điểm RM, bạn sẽ đi qua đỉnh mà không hay biết.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     Dinh luat ty le — C = 6ND va Chinchilla
     ================================================================ */
  demo({
    id: "dinh-luat-ty-le", nhom: "AI hiện đại", mon: "M09",
    ten: "Quy luật tỷ lệ — C = 6ND và bài học Chinchilla",
    moTa: "Cùng một ngân sách tính toán, chia cho <b>tham số</b> hay <b>dữ liệu</b>? " +
          "Chọn sai là mất hàng trăm triệu đô.",
    lienKet: '<a href="../web/index.html#/bai/m09-bai-11-quy-luat-ty-le">M09 b.11</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      /* mac dinh = ngan sach GPT-3 */
      var tt = { logC: Math.log10(3.15e23), logN: Math.log10(1.75e11) };

      function D(C, N) { return C / (6 * N); }
      function Nsao(C) { return Math.sqrt(C / 120); }

      /* mat mat minh hoa: toi thieu khi D/N = 20, phat khi lech (thang log) */
      function mat(C, N) {
        var d = D(C, N), ty = d / N;
        var lech = Math.log(ty / 20);
        return 2.0 + 0.055 * lech * lech - 0.29 * Math.log10(C / 1e21);
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var C = Math.pow(10, tt.logC);
        var padL = 52, padR = 16, padT = 30, padB = 40;
        var w = W - padL - padR, h = H - padT - padB;

        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Với C = 10^" + tt.logC.toFixed(2) +
                   " FLOP cố định — chia thế nào giữa N và D?", padL, 18);

        /* quet N tren thang log */
        var lo = 9, hi = 12.4, N2 = 240, pts = [], i;
        for (i = 0; i <= N2; i++) {
          var lN = lo + (hi - lo) * i / N2;
          var N = Math.pow(10, lN);
          pts.push({ lN: lN, L: mat(C, N) });
        }
        var Lmin = Math.min.apply(null, pts.map(function (p) { return p.L; }));
        var Lmax = Math.max.apply(null, pts.map(function (p) { return p.L; }));

        var X = function (lN) { return padL + (lN - lo) / (hi - lo) * w; };
        var Y = function (L) { return padT + (L - Lmin) / (Lmax - Lmin) * h; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "center";
        for (i = 9; i <= 12; i++) {
          g.beginPath(); g.moveTo(X(i), padT); g.lineTo(X(i), padT + h); g.stroke();
          g.fillText("10^" + i, X(i), padT + h + 15);
        }
        g.fillText("N — số tham số", padL + w / 2, padT + h + 29);

        /* duong mat mat */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.4;
        g.beginPath();
        pts.forEach(function (p, k) { var yy = Y(p.L); if (!k) g.moveTo(X(p.lN), yy); else g.lineTo(X(p.lN), yy); });
        g.stroke();

        /* diem toi uu Chinchilla */
        var Ns = Nsao(C), lNs = Math.log10(Ns);
        g.strokeStyle = "#0f766e"; g.lineWidth = 1.8; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(X(lNs), padT); g.lineTo(X(lNs), padT + h); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#0f766e"; g.font = "700 10.5px system-ui"; g.textAlign = "center";
        g.fillText("tối ưu Chinchilla", X(lNs), padT - 4);

        /* diem hien tai */
        var N = Math.pow(10, tt.logN);
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X(tt.logN), Y(mat(C, N)), 6, 0, 6.2832); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();

        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "left";
        g.fillText("mất mát (thấp hơn = tốt hơn)", padL + 6, padT + 12);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var C = Math.pow(10, tt.logC), N = Math.pow(10, tt.logN);
        var d = D(C, N), ty = d / N;
        var Ns = Nsao(C), Ds = 20 * Ns;

        function ds(x) {
          if (x >= 1e12) return (x / 1e12).toFixed(2) + " nghìn tỷ";
          if (x >= 1e9) return (x / 1e9).toFixed(0) + " tỷ";
          if (x >= 1e6) return (x / 1e6).toFixed(0) + " triệu";
          return x.toExponential(2);
        }

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("C = 6·N·D   ⇒   D = C / (6N)", 14, 20);

        var dong = [
          ["Ngân sách C", "10^" + tt.logC.toFixed(2) + " FLOP"],
          ["N bạn chọn", ds(N) + " tham số"],
          ["D suy ra", ds(d) + " token"],
          ["★ Token mỗi tham số", ty.toFixed(1)],
          ["", ""],
          ["N* tối ưu = √(C/120)", ds(Ns) + " tham số"],
          ["D* = 20·N*", ds(Ds) + " token"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (q, i) {
          if (!q[0]) return;
          var y = 42 + i * 20;
          g2.fillStyle = V.mau("tx2"); g2.fillText(q[0], 18, y);
          var nb = i === 3;
          g2.fillStyle = nb ? (Math.abs(ty - 20) / 20 > 0.5 ? V.mau("loi") : "#0f766e")
                            : (i >= 5 ? "#0f766e" : V.mau("tx"));
          g2.font = (nb ? "700 12px " : "600 11.5px ") + "ui-monospace, monospace";
          g2.fillText(q[1], 230, y);
          g2.font = "11.5px system-ui";
        });

        var lan = N / Ns;
        var y0 = 190;
        g2.fillStyle = Math.abs(ty - 20) / 20 > 0.5 ? V.mau("loi") : "#0f766e";
        g2.font = "700 12px system-ui";
        if (lan > 1.15) {
          g2.fillText("⚠ Mô hình LỚN quá " + lan.toFixed(1) + "× so với tối ưu — thiếu dữ liệu.",
                      14, y0);
        } else if (lan < 0.87) {
          g2.fillText("⚠ Mô hình NHỎ quá " + (1 / lan).toFixed(1) + "× so với tối ưu — thừa dữ liệu.",
                      14, y0);
        } else {
          g2.fillText("✓ Gần cấu hình tối ưu Chinchilla (~20 token/tham số).", 14, y0);
        }
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("GPT-3 thực tế: 175 tỷ × 300 tỷ token = 1,7 token/tham số.", 14, y0 + 20);
        g2.fillText("Tối ưu ở cùng C: 51 tỷ × 1,02 nghìn tỷ = 20. Nhỏ hơn 3,4 lần.", 14, y0 + 36);
      }

      function veHet() { ve(); ve2(); }

      var dkN = V.truot({ ten: "N — số tham số (10^x)", min: 9, max: 12.4, buoc: 0.02,
                          giaTri: tt.logN, doi: function (v) { tt.logN = v; veHet(); } });
      var dk = [
        V.truot({ ten: "C — ngân sách tính toán (10^x FLOP)", min: 20, max: 26, buoc: 0.05,
                  giaTri: tt.logC, doi: function (v) { tt.logC = v; veHet(); } }),
        dkN,
        V.nut("Đặt về GPT-3 thực tế", function () {
          tt.logC = Math.log10(3.15e23); tt.logN = Math.log10(1.75e11);
          dkN.datGiaTri(tt.logN); veHet();
        }, "chinh"),
        V.nut("Đặt về tối ưu Chinchilla", function () {
          tt.logN = Math.log10(Math.sqrt(Math.pow(10, tt.logC) / 120));
          dkN.datGiaTri(tt.logN); veHet();
        })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Quy tắc <code>C ≈ 6ND</code></b> (bài 11 §2): mỗi token đi qua mô hình tốn " +
          "~2N FLOP cho lượt xuôi và ~4N cho lượt ngược ⇒ <b>6N FLOP mỗi token</b>, " +
          "nhân với D token. Nó đủ chính xác cho mọi tính toán ngân sách trong thực tế.<ul>" +
          "<li>Kiểm nhanh với GPT-3: <code>6 × 1,75×10¹¹ × 3×10¹¹ = 3,15×10²³ FLOP</code> — " +
          "<b>khớp với con số được công bố</b>.</li>" +
          "<li>★ Vì C cố định, <b>N và D đánh đổi trực tiếp</b>: mô hình lớn gấp đôi thì " +
          "chỉ được huấn luyện trên nửa số token.</li></ul>" +
          "<b>★ Bài học Chinchilla — bấm hai nút và so:</b><ul>" +
          "<li>Với ràng buộc <code>D = 20N</code> và <code>C = 6ND</code>: " +
          "<code>C = 120N²</code> ⇒ <b>N* = √(C/120)</b>.</li>" +
          "<li>Áp cho ngân sách GPT-3: <code>N* = √(3,15×10²³/120) = 5,12×10¹⁰</code> " +
          "= <b>51 tỷ tham số</b>, với <code>D* = 1,02 nghìn tỷ token</code>.</li>" +
          "<li>★ <b>GPT-3 lẽ ra nên NHỎ HƠN 3,4 lần và huấn luyện trên 3,4 lần nhiều dữ liệu hơn</b>, " +
          "với cùng số tiền.</li>" +
          "<li><b>Bằng chứng trực tiếp:</b> Chinchilla (70 tỷ, 1,4 nghìn tỷ token) " +
          "<b>vượt</b> Gopher (280 tỷ, 300 tỷ token) ở <b>cùng ngân sách</b> (~5,5×10²³ FLOP). " +
          "Một mô hình <b>nhỏ hơn 4 lần thắng</b>, chỉ nhờ phân bổ lại.</li></ul>" +
          "<b>★ Vì sao câu chuyện này đáng nhớ hơn mọi con số khác trong M09:</b> " +
          "Kaplan (2020) và Chinchilla (2022) dùng <b>cùng một khung lý thuyết</b> nhưng ra " +
          "kết luận khác nhau, vì Kaplan <b>cố định lịch giảm tốc độ học</b> khi quét — " +
          "một chi tiết thí nghiệm trông vô hại.<br>" +
          "⇒ <b>Ở ba trường hợp khác, một sai lầm như thế làm người ta quy công sai cho một ý tưởng. " +
          "Ở đây, nó làm cả ngành chi hàng trăm triệu đô huấn luyện sai cách trong hai năm.</b><br><br>" +
          "⚖️ <b>Lưu ý:</b> đường cong mất mát trong hình là <b>minh hoạ</b> có đỉnh đặt đúng ở " +
          "D/N = 20; hình dạng đúng về chất, con số tuyệt đối thì không phải phép đo. " +
          "Còn <code>C = 6ND</code>, <code>N* = √(C/120)</code> và các số GPT-3/Chinchilla " +
          "là <b>thật</b>."
      });
      veHet();
    }
  });

  /* ================================================================
     Giai ma: temperature / top-k / top-p
     ================================================================ */
  demo({
    id: "giai-ma-sinh", nhom: "AI hiện đại", mon: "M06",
    ten: "Giải mã — nhiệt độ, top-k và top-p",
    moTa: "Cùng một mô hình, cùng một phân phối — <b>ba núm vặn</b> đổi hẳn " +
          "văn bản sinh ra. Xem token nào bị cắt.",
    lienKet: '<a href="../web/index.html#/bai/m06-bai-13-sinh-van-ban-va-giai-ma">M06 b.13</a>',
    dung: function (host) {
      var W = 560, H = 320, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { T: 1.0, k: 0, p: 1.0, hat: 3 };

      var TOKEN = ["nhà", "trường", "công ty", "quán", "biển", "núi", "chợ", "bệnh viện",
                   "sân bay", "thư viện", "rạp", "ga", "cầu", "vườn", "bảo tàng", "sông"];
      function logit() {
        var r = V.rng(tt.hat), ds = [], i;
        for (i = 0; i < TOKEN.length; i++) ds.push(r.khoang(-1, 1) + 4 * Math.exp(-i * 0.42));
        return ds;
      }

      function phanPhoi() {
        var z = logit(), i;
        var zz = z.map(function (v) { return v / Math.max(0.05, tt.T); });
        var m = Math.max.apply(null, zz);
        var e = zz.map(function (v) { return Math.exp(v - m); });
        var s = e.reduce(function (a, b) { return a + b; }, 0);
        var p = e.map(function (v) { return v / s; });
        var ds = p.map(function (v, i2) { return { t: TOKEN[i2], p: v, i: i2 }; });
        ds.sort(function (a, b) { return b.p - a.p; });

        /* top-k */
        var giu = ds.map(function (d) { return true; });
        if (tt.k > 0) ds.forEach(function (d, j) { if (j >= tt.k) giu[j] = false; });
        /* top-p (nucleus) */
        if (tt.p < 0.999) {
          var cum = 0, xong = false;
          ds.forEach(function (d, j) {
            if (xong) { giu[j] = false; return; }
            cum += d.p;
            if (cum >= tt.p) xong = true;
          });
        }
        /* chuan hoa lai tren phan giu */
        var tong = 0;
        ds.forEach(function (d, j) { if (giu[j]) tong += d.p; });
        return { ds: ds, giu: giu, tong: tong };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var pp = phanPhoi();
        var padL = 86, padT = 34, padB = 22;
        var n = pp.ds.length;
        var hh = (H - padT - padB) / n;
        var bw = W - padL - 62;
        var pMax = pp.ds[0].p;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Phân phối sau softmax  (T = " + tt.T.toFixed(2) +
                   (tt.k > 0 ? ", top-k = " + tt.k : "") +
                   (tt.p < 0.999 ? ", top-p = " + tt.p.toFixed(2) : "") + ")", 14, 20);

        pp.ds.forEach(function (d, j) {
          var y = padT + j * hh;
          var w = bw * (d.p / pMax);
          g.fillStyle = pp.giu[j] ? V.mau("ac") : V.mau("bd");
          g.globalAlpha = pp.giu[j] ? 1 : 0.5;
          g.fillRect(padL, y + 1, Math.max(1.5, w), hh - 3);
          g.globalAlpha = 1;
          g.fillStyle = pp.giu[j] ? V.mau("tx") : V.mau("tx3");
          g.font = (pp.giu[j] ? "600 " : "") + "11px system-ui"; g.textAlign = "right";
          g.fillText(d.t, padL - 8, y + hh / 2 + 4);
          g.textAlign = "left";
          g.font = "10.5px ui-monospace, monospace";
          g.fillStyle = pp.giu[j] ? V.mau("tx2") : V.mau("tx3");
          g.fillText((d.p * 100).toFixed(1) + "%", padL + bw + 8, y + hh / 2 + 4);
          if (!pp.giu[j]) {
            g.strokeStyle = V.mau("loi"); g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(padL - 2, y + hh / 2); g.lineTo(padL + w + 2, y + hh / 2); g.stroke();
          }
        });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var pp = phanPhoi();
        var nGiu = pp.giu.filter(Boolean).length;
        /* entropy cua phan phoi da cat va chuan hoa */
        var H0 = 0;
        pp.ds.forEach(function (d, j) {
          if (!pp.giu[j]) return;
          var q = d.p / pp.tong;
          if (q > 0) H0 -= q * Math.log2(q);
        });

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Hệ quả của bộ ba núm vặn:", 14, 20);

        var dong = [
          ["Số token còn được chọn", nGiu + " / " + TOKEN.length],
          ["Khối lượng xác suất giữ lại", (pp.tong * 100).toFixed(1) + " %"],
          ["Entropy sau khi cắt", H0.toFixed(2) + " bit"],
          ["Xác suất token đứng đầu", (pp.ds[0].p / pp.tong * 100).toFixed(1) + " %"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 44 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = V.mau("tx"); g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(d[1], 280, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 142;
        var ghi, mau;
        if (nGiu === 1) { ghi = "Giải mã THAM LAM — tất định, lặp lại, dễ vào vòng lặp."; mau = V.mau("loi"); }
        else if (tt.T < 0.35) { ghi = "Rất bảo thủ — an toàn nhưng nhạt và lặp."; mau = "#b45309"; }
        else if (tt.T > 1.6) { ghi = "Rất ngẫu nhiên — sáng tạo nhưng dễ vô nghĩa, sai sự thật."; mau = V.mau("loi"); }
        else { ghi = "Vùng thường dùng cho văn bản tự nhiên."; mau = "#0f766e"; }
        g2.fillStyle = mau; g2.font = "700 12px system-ui";
        g2.fillText(ghi, 14, y0);

        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Gạch đỏ = token bị LOẠI khỏi tập lấy mẫu.", 14, y0 + 22);
        g2.fillText("top-k cắt theo SỐ LƯỢNG cố định; top-p cắt theo KHỐI LƯỢNG xác suất.",
                    14, y0 + 38);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "T — nhiệt độ", min: 0.05, max: 2.5, buoc: 0.05, giaTri: tt.T,
                  doi: function (v) { tt.T = v; veHet(); } }),
        V.truot({ ten: "top-k  (0 = tắt)", min: 0, max: 16, buoc: 1, giaTri: tt.k,
                  doi: function (v) { tt.k = v; veHet(); } }),
        V.truot({ ten: "top-p  (1 = tắt)", min: 0.1, max: 1, buoc: 0.05, giaTri: tt.p,
                  doi: function (v) { tt.p = v; veHet(); } }),
        V.truot({ ten: "Hạt giống (đổi phân phối)", min: 1, max: 30, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Mô hình không sinh ra văn bản — nó sinh ra một PHÂN PHỐI trên token.</b> " +
          "Văn bản là kết quả của việc bạn <b>lấy mẫu thế nào</b> từ phân phối đó, " +
          "và ba núm vặn dưới đây là toàn bộ câu chuyện.<ul>" +
          "<li><b>Nhiệt độ T</b> chia logit trước softmax: <code>softmax(z/T)</code>. " +
          "T < 1 làm phân phối <b>nhọn hơn</b>; T > 1 làm nó <b>phẳng hơn</b>. " +
          "★ T <b>không</b> loại token nào — nó chỉ đổi tỷ lệ.</li>" +
          "<li><b>top-k</b> giữ lại k token cao nhất, bỏ hết phần còn lại. " +
          "Cắt theo <b>số lượng cố định</b>.</li>" +
          "<li><b>top-p (nucleus)</b> giữ token cho tới khi tổng xác suất đạt p. " +
          "Cắt theo <b>khối lượng xác suất</b> — nên số token giữ lại " +
          "<b>tự thích nghi</b> theo từng bước.</li></ul>" +
          "<b>★ Vì sao top-p thường tốt hơn top-k — thí nghiệm hai bước:</b><ol>" +
          "<li>Đặt <b>top-k = 3</b>, rồi kéo hạt giống qua vài giá trị. Có lúc phân phối " +
          "rất nhọn (một token chiếm 90 %) — k=3 vẫn <b>ép</b> giữ 3 lựa chọn, " +
          "kể cả hai cái vô nghĩa. Có lúc phân phối rất phẳng — k=3 <b>cắt mất</b> " +
          "nhiều lựa chọn hợp lý.</li>" +
          "<li>Đổi sang <b>top-p = 0,9</b>: khi mô hình <b>chắc chắn</b>, nó giữ 1–2 token; " +
          "khi mô hình <b>lưỡng lự</b>, nó giữ nhiều. ★ <b>Ngưỡng thích nghi theo độ tự tin " +
          "của chính mô hình</b> — đó là toàn bộ ưu điểm.</li></ol>" +
          "<b>★ Hai chế độ hỏng ở hai đầu:</b><ul>" +
          "<li><b>T → 0</b> (hoặc k = 1): <b>giải mã tham lam</b>. Tất định và \"an toàn\", " +
          "nhưng nổi tiếng <b>lặp vòng</b> — vì token có xác suất cao nhất ở mỗi bước " +
          "không tạo thành chuỗi có xác suất cao nhất.</li>" +
          "<li><b>T lớn</b>: đuôi phân phối phình lên, mô hình bắt đầu chọn những token " +
          "vốn gần như bằng 0. Văn bản trông \"sáng tạo\" nhưng <b>ảo giác tăng vọt</b>.</li>" +
          "<li>⚠️ Sai lầm thường gặp: <b>vặn cả ba núm cùng lúc</b>. Hãy cố định " +
          "top-p ≈ 0,9–0,95, rồi chỉ chỉnh T. Với tác vụ cần chính xác " +
          "(trích xuất, phân loại, sinh mã) thì dùng T rất thấp và <b>đừng</b> dùng top-p.</li></ul>"
      });
      veHet();
    }
  });

})();
