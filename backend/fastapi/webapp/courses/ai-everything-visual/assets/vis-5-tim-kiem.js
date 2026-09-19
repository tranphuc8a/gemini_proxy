/* =====================================================================
   vis-5-tim-kiem.js — demo cho M01, M08
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     1. THUAT TOAN TIM KIEM tren luoi
     ================================================================== */
  demo({
    id: "tim-kiem", nhom: "Tìm kiếm & quyết định", mon: "M01",
    ten: "BFS, Dijkstra, tham lam và A*",
    moTa: "Cùng một bản đồ, bốn thuật toán. Đếm số ô phải mở rộng — chênh lệch là " +
          "giá trị của heuristic.",
    lienKet: '<a href="../web/index.html#/bai/m01-bai-05-tim-kiem-mu">M01 b.5</a>' +
             ' · <a href="../web/index.html#/bai/m01-bai-06-tim-kiem-co-thong-tin-a-sao">M01 b.6</a>',
    dung: function (host) {
      var C = 38, R = 28, O = 14;
      var W = C * O, H = R * O;
      var cv = V.veBang(W, H), g = cv.g;
      var tt = { thuat: "astar", trongSo: 1, doDo: "manhattan", veTuong: 1 };
      var tuong = {}, dau = [2, 14], dich = [35, 14];
      var oSo = V.el("div", { class: "so-lieu" });

      function sinhTuong(kieu) {
        tuong = {};
        var Rg = V.rng(17);
        if (kieu === "me") {
          for (var i = 0; i < 30; i++) {
            var cx = Math.floor(Rg.khoang(5, C - 5)), cy = Math.floor(Rg.khoang(1, R - 1));
            var doc = Rg() > 0.5, len = Math.floor(Rg.khoang(3, 12));
            for (var k = 0; k < len; k++) {
              var x = doc ? cx : cx + k, y = doc ? cy + k : cy;
              if (x > 0 && x < C - 1 && y > 0 && y < R - 1) tuong[x + "," + y] = 1;
            }
          }
        } else if (kieu === "buc") {
          for (var y2 = 0; y2 < R; y2++) if (y2 < 8 || y2 > 12) tuong[Math.floor(C / 2) + "," + y2] = 1;
        } else if (kieu === "loi") {           /* bay cho tim kiem tham lam */
          for (var y3 = 0; y3 < R - 4; y3++) tuong[22 + "," + y3] = 1;
          for (var x3 = 22; x3 < 33; x3++) tuong[x3 + "," + (R - 5)] = 1;
          for (var y4 = 6; y4 < R - 4; y4++) tuong[33 + "," + y4] = 1;
        }
        delete tuong[dau[0] + "," + dau[1]];
        delete tuong[dich[0] + "," + dich[1]];
      }
      sinhTuong("me");

      function h(a, b) {
        if (tt.doDo === "euclid") return Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (tt.doDo === "khong") return 0;
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      }

      function chay() {
        var openList = [{ p: dau, g: 0, f: 0, cha: null }];
        var gBest = {}; gBest[dau.join(",")] = 0;
        var cha = {};
        var daMo = {}, thuTu = [];
        var found = null, soMo = 0;
        while (openList.length) {
          /* chon nut theo thuat toan */
          var bi = 0;
          for (var i = 1; i < openList.length; i++) {
            var A = openList[i], B = openList[bi], ka, kb;
            if (tt.thuat === "bfs") { ka = A.g; kb = B.g; }
            else if (tt.thuat === "dijkstra") { ka = A.g; kb = B.g; }
            else if (tt.thuat === "thamlam") { ka = h(A.p, dich); kb = h(B.p, dich); }
            else { ka = A.g + tt.trongSo * h(A.p, dich); kb = B.g + tt.trongSo * h(B.p, dich); }
            if (ka < kb) bi = i;
          }
          var cur = openList.splice(bi, 1)[0];
          var key = cur.p.join(",");
          if (daMo[key]) continue;
          daMo[key] = 1; thuTu.push(cur.p); soMo++;
          if (cur.p[0] === dich[0] && cur.p[1] === dich[1]) { found = cur; break; }
          var d4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var j = 0; j < 4; j++) {
            var nx = cur.p[0] + d4[j][0], ny = cur.p[1] + d4[j][1];
            if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
            var nk = nx + "," + ny;
            if (tuong[nk] || daMo[nk]) continue;
            var ng = cur.g + 1;
            if (gBest[nk] !== undefined && gBest[nk] <= ng) continue;
            gBest[nk] = ng; cha[nk] = key;
            openList.push({ p: [nx, ny], g: ng });
          }
          if (soMo > C * R * 2) break;
        }
        var duong = [];
        if (found) {
          var k2 = dich.join(",");
          while (k2) {
            duong.push(k2.split(",").map(Number));
            k2 = cha[k2];
          }
          duong.reverse();
        }
        return { thuTu: thuTu, duong: duong, soMo: soMo, daMo: daMo };
      }

      function ve() {
        var kq = chay();
        g.clearRect(0, 0, W, H);
        /* o da mo rong, to mau theo thu tu */
        kq.thuTu.forEach(function (p, i) {
          var t = i / Math.max(kq.thuTu.length - 1, 1);
          g.fillStyle = V.thangMau(0.12 + t * 0.45);
          g.fillRect(p[0] * O, p[1] * O, O - 1, O - 1);
        });
        /* tuong */
        g.fillStyle = V.mau("tx");
        Object.keys(tuong).forEach(function (k) {
          var p = k.split(",").map(Number);
          g.fillRect(p[0] * O, p[1] * O, O - 1, O - 1);
        });
        /* duong di */
        g.strokeStyle = "#22c55e"; g.lineWidth = 3.4; g.lineJoin = "round";
        g.beginPath();
        kq.duong.forEach(function (p, i) {
          var x = p[0] * O + O / 2, y = p[1] * O + O / 2;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.stroke();
        /* dau, dich */
        g.fillStyle = "#22c55e";
        g.beginPath(); g.arc(dau[0] * O + O / 2, dau[1] * O + O / 2, O * 0.42, 0, 7); g.fill();
        g.fillStyle = "#dc2626";
        g.beginPath(); g.arc(dich[0] * O + O / 2, dich[1] * O + O / 2, O * 0.42, 0, 7); g.fill();

        oSo.innerHTML =
          '<div class="d"><span>Ô đã mở rộng</span><b>' + kq.soMo + "</b></div>" +
          '<div class="d"><span>Tổng ô trống</span><b>' + (C * R - Object.keys(tuong).length) + "</b></div>" +
          '<div class="d"><span>Tỷ lệ đã duyệt</span><b>' +
            (kq.soMo / (C * R - Object.keys(tuong).length) * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Độ dài đường đi</span><b>' +
            (kq.duong.length ? kq.duong.length - 1 : "không tới được") + "</b></div>";
      }

      cv.addEventListener("mousedown", ganTuong);
      cv.addEventListener("mousemove", function (e) { if (e.buttons) ganTuong(e); });
      function ganTuong(e) {
        var r = cv.getBoundingClientRect();
        var x = Math.floor((e.clientX - r.left) / O), y = Math.floor((e.clientY - r.top) / O);
        if (x < 0 || y < 0 || x >= C || y >= R) return;
        var k = x + "," + y;
        if (k === dau.join(",") || k === dich.join(",")) return;
        if (tt.veTuong) tuong[k] = 1; else delete tuong[k];
        ve();
      }

      var dk = [
        V.el("h4", { text: "THUẬT TOÁN" }),
        V.chon({ ten: "Chọn thuật toán", giaTri: tt.thuat,
          muc: [{ v: "bfs", t: "BFS (mù, chi phí đều)" },
                { v: "dijkstra", t: "Dijkstra / UCS" },
                { v: "thamlam", t: "Tham lam theo h (không tối ưu)" },
                { v: "astar", t: "A* = g + h" }],
          doi: function (v) { tt.thuat = v; ve(); } }),
        V.chon({ ten: "Heuristic h", giaTri: tt.doDo,
          muc: [{ v: "manhattan", t: "Manhattan (chấp nhận được)" },
                { v: "euclid", t: "Euclid (yếu hơn ở lưới 4 hướng)" },
                { v: "khong", t: "h ≡ 0 (A* thành Dijkstra)" }],
          doi: function (v) { tt.doDo = v; ve(); } }),
        V.truot({ ten: "Trọng số w của h (A* có trọng số)", min: 0, max: 4, buoc: 0.1, giaTri: tt.trongSo,
          doi: function (v) { tt.trongSo = v; ve(); } }),
        V.el("h4", { text: "BẢN ĐỒ", style: "margin-top:16px" }),
        V.chon({ ten: "Mẫu bản đồ", giaTri: "me",
          muc: [{ v: "me", t: "Mê cung ngẫu nhiên" },
                { v: "buc", t: "Bức tường có khe" },
                { v: "loi", t: "Bẫy lõm (hại tham lam)" },
                { v: "trong", t: "Trống" }],
          doi: function (v) { sinhTuong(v); ve(); } }),
        V.chon({ ten: "Bấm chuột để", giaTri: "1",
          muc: [{ v: "1", t: "Vẽ tường" }, { v: "0", t: "Xoá tường" }],
          doi: function (v) { tt.veTuong = +v; } }),
        oSo,
        V.el("div", { class: "chu-thich" }, [
          V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#fdf2f6;border:1px solid #f3c6d8" }), "mở sớm"]),
          V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#c73c7a" }), "mở muộn"]),
          V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:#22c55e" }), "đường đi"])
        ])
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Số ô mở rộng là thước đo thật của hiệu quả tìm kiếm.</b> Bốn thuật toán dưới " +
          "đây <i>chỉ khác nhau ở cách chọn nút tiếp theo</i> — phần còn lại của vòng lặp " +
          "giống hệt nhau.<ul>" +
          "<li><b>BFS / Dijkstra</b> lan toả <i>đều mọi hướng</i>. Tối ưu, nhưng phí công " +
          "khám phá cả hướng ngược với đích.</li>" +
          "<li><b>Tham lam theo h</b> lao thẳng về đích — rất ít ô mở rộng, <b>nhưng không " +
          "tối ưu</b>. Chọn bản đồ <i>Bẫy lõm</i> để thấy nó chui vào ngõ cụt hình chữ U " +
          "và phải bò ra.</li>" +
          "<li><b>A* = g + h</b> cân bằng: chỉ mở rộng những ô mà <i>tổng chi phí ước lượng</i> " +
          "còn có triển vọng. Ít ô hơn Dijkstra nhiều, mà <b>vẫn tối ưu</b> (vì Manhattan " +
          "chấp nhận được trên lưới 4 hướng).</li></ul>" +
          "<b>Ba thí nghiệm nên làm:</b><ol>" +
          "<li>Chọn A*, đổi heuristic sang <code>h ≡ 0</code>. Số ô mở rộng nhảy vọt — vì " +
          "A* vừa <i>trở thành</i> Dijkstra. Đây là bằng chứng trực tiếp: <b>A* mạnh nhờ h, " +
          "không nhờ cấu trúc thuật toán.</b></li>" +
          "<li>Kéo <i>trọng số w</i> từ 1 lên 3. Số ô mở rộng giảm mạnh, nhưng đường đi bắt " +
          "đầu dài hơn tối ưu. Đây là <b>A* có trọng số</b>: đổi tính tối ưu lấy tốc độ, " +
          "với đảm bảo lời giải không đắt quá <code>w × C*</code>.</li>" +
          "<li>Vẽ thêm tường bằng chuột để tạo ngõ cụt, rồi so BFS với A* trên cùng bản đồ.</li></ol>"
      });
      ve();
    }
  });

  /* ==================================================================
     2. BANDIT — kham pha vs khai thac
     ================================================================== */
  demo({
    id: "bandit", nhom: "Tìm kiếm & quyết định", mon: "M08",
    ten: "Bandit: khám phá và khai thác",
    moTa: "Ba chiến lược trên cùng bài toán. Đặt ε = 0 để thấy điều gì xảy ra khi " +
          "không bao giờ khám phá.",
    lienKet: '<a href="../web/index.html#/bai/m08-bai-02-bandit-va-kham-pha-khai-thac">M08 b.2</a>',
    dung: function (host) {
      var W = 540, H = 300, W2 = 540, H2 = 190;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var K = 8;
      var tt = { eps: 0.1, buoc: 1500, hat: 6, c: 2 };
      var oSo = V.el("div", { class: "so-lieu" });

      function tayThat() {
        var R = V.rng(tt.hat), m = [];
        for (var i = 0; i < K; i++) m.push(R.chuan() * 0.8 + 0.5);
        return m;
      }

      function chay(chienLuoc) {
        var muc = tayThat();
        var R = V.rng(tt.hat * 31 + chienLuoc.length);
        var Qv = new Array(K).fill(0), N = new Array(K).fill(0);
        var a1 = new Array(K).fill(1), b1 = new Array(K).fill(1);  /* Thompson (Beta) */
        var tichLuy = 0, hoiTiec = [], tanSuat = new Array(K).fill(0);
        var best = Math.max.apply(null, muc);
        for (var t = 1; t <= tt.buoc; t++) {
          var a;
          if (chienLuoc === "eps") {
            a = (R() < tt.eps) ? Math.floor(R() * K) : argmax(Qv);
          } else if (chienLuoc === "ucb") {
            var u = Qv.map(function (q, i) {
              return N[i] === 0 ? 1e9 : q + tt.c * Math.sqrt(Math.log(t) / N[i]);
            });
            a = argmax(u);
          } else {                                   /* Thompson, xap xi Beta bang lay mau */
            var s = a1.map(function (av, i) { return betaMau(av, b1[i], R); });
            a = argmax(s);
          }
          var r = muc[a] + R.chuan() * 0.6;
          N[a]++; Qv[a] += (r - Qv[a]) / N[a];
          var rr = r > 0.5 ? 1 : 0;
          a1[a] += rr; b1[a] += 1 - rr;
          tichLuy += r; tanSuat[a]++;
          hoiTiec.push((hoiTiec.length ? hoiTiec[hoiTiec.length - 1] : 0) + (best - muc[a]));
        }
        return { muc: muc, Q: Qv, N: N, hoiTiec: hoiTiec, tichLuy: tichLuy, tanSuat: tanSuat };
      }
      function argmax(a) {
        var b = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b;
      }
      function betaMau(a, b, R) {          /* xap xi: trung binh + nhieu theo do lech chuan */
        var m = a / (a + b);
        var v = Math.sqrt(m * (1 - m) / (a + b + 1));
        return m + R.chuan() * v;
      }

      function ve() {
        var kqE = chay("eps"), kqU = chay("ucb"), kqT = chay("ts");
        var muc = kqE.muc, best = argmax(muc);

        /* --- bieu do tay --- */
        g.clearRect(0, 0, W, H);
        var pad = 44, bw = (W - pad * 2) / K, base = H - 52, hmax = H - 96;
        var mmax = Math.max.apply(null, muc.map(Math.abs)) * 1.15;
        g.strokeStyle = V.mau("bd2");
        g.beginPath(); g.moveTo(pad - 8, base); g.lineTo(W - pad + 8, base); g.stroke();
        for (var i = 0; i < K; i++) {
          var x = pad + i * bw;
          var hh = muc[i] / mmax * hmax;
          g.fillStyle = i === best ? "#0f766e" : V.mau("bd");
          g.fillRect(x + bw * 0.10, base - Math.max(hh, 0), bw * 0.36, Math.abs(hh));
          var he = kqE.Q[i] / mmax * hmax;
          g.fillStyle = V.mau("ac");
          g.fillRect(x + bw * 0.52, base - Math.max(he, 0), bw * 0.36, Math.abs(he));
          g.fillStyle = V.mau("tx3"); g.font = "11px system-ui"; g.textAlign = "center";
          g.fillText("tay " + (i + 1), x + bw / 2, base + 16);
          g.fillText(kqE.tanSuat[i] + " lần", x + bw / 2, base + 30);
          g.textAlign = "left";
        }
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Giá trị thật (xanh) vs ước lượng của ε-greedy (hồng)", pad, 20);

        /* --- hoi tiec tich luy --- */
        g2.clearRect(0, 0, W2, H2);
        var p2 = 44, w2 = W2 - p2 - 16, h2 = H2 - 46;
        var maxR = Math.max(
          kqE.hoiTiec[kqE.hoiTiec.length - 1],
          kqU.hoiTiec[kqU.hoiTiec.length - 1],
          kqT.hoiTiec[kqT.hoiTiec.length - 1], 1);
        [["ε-greedy", kqE.hoiTiec, "#9d174d"],
         ["UCB", kqU.hoiTiec, "#b45309"],
         ["Thompson", kqT.hoiTiec, "#0f766e"]].forEach(function (s, si) {
          g2.strokeStyle = s[2]; g2.lineWidth = 2.2; g2.beginPath();
          s[1].forEach(function (v, i) {
            var X = p2 + i / (s[1].length - 1) * w2, Y = 12 + h2 - v / maxR * h2;
            if (i === 0) g2.moveTo(X, Y); else g2.lineTo(X, Y);
          });
          g2.stroke();
          g2.fillStyle = s[2]; g2.font = "600 12px system-ui";
          g2.fillText(s[0] + ": " + s[1][s[1].length - 1].toFixed(0), p2 + 8, 24 + si * 16);
        });
        g2.strokeStyle = V.mau("bd"); g2.lineWidth = 1;
        g2.beginPath(); g2.moveTo(p2, 12 + h2); g2.lineTo(p2 + w2, 12 + h2); g2.stroke();
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("hối tiếc tích luỹ", 6, 20);
        g2.fillText("bước →", p2 + w2 / 2 - 20, H2 - 8);

        oSo.innerHTML =
          '<div class="d"><span>Tay tốt nhất</span><b>tay ' + (best + 1) +
            " (μ=" + muc[best].toFixed(2) + ")</b></div>" +
          '<div class="d"><span>Hối tiếc ε-greedy</span><b>' +
            kqE.hoiTiec[kqE.hoiTiec.length - 1].toFixed(0) + "</b></div>" +
          '<div class="d"><span>Hối tiếc UCB</span><b>' +
            kqU.hoiTiec[kqU.hoiTiec.length - 1].toFixed(0) + "</b></div>" +
          '<div class="d"><span>Hối tiếc Thompson</span><b>' +
            kqT.hoiTiec[kqT.hoiTiec.length - 1].toFixed(0) + "</b></div>" +
          '<div class="d"><span>ε-greedy chọn đúng tay</span><b>' +
            (kqE.tanSuat[best] / tt.buoc * 100).toFixed(1) + "% số lượt</b></div>";
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "ε (tỷ lệ khám phá)", min: 0, max: 0.5, buoc: 0.01, giaTri: tt.eps,
          doi: function (v) { tt.eps = v; ve(); } }),
        V.truot({ ten: "c (hệ số UCB)", min: 0, max: 4, buoc: 0.1, giaTri: tt.c,
          doi: function (v) { tt.c = v; ve(); } }),
        V.truot({ ten: "Số bước", min: 100, max: 4000, buoc: 100, giaTri: tt.buoc,
          doi: function (v) { tt.buoc = v; ve(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Hối tiếc</b> (regret) = tổng phần thưởng bạn <i>đã bỏ lỡ</i> so với việc luôn " +
          "chọn tay tốt nhất. Đường càng phẳng càng tốt.<ul>" +
          "<li><b>ε = 0 — không bao giờ khám phá.</b> Thuật toán khoá chặt vào tay đầu tiên " +
          "có vẻ tốt, và <b>không bao giờ phát hiện ra tay tốt hơn</b>. Đường hối tiếc thành " +
          "đường thẳng dốc — sai lầm lặp lại mãi mãi. Đây là bài học nền của toàn bộ RL.</li>" +
          "<li><b>ε lớn (0,3+)</b> — khám phá quá nhiều. Đã biết tay nào tốt nhưng vẫn phí " +
          "30 % số lượt cho lựa chọn ngẫu nhiên. Hối tiếc tăng tuyến tính, chỉ với độ dốc nhỏ hơn.</li>" +
          "<li><b>ε ≈ 0,05–0,1</b> thường là vùng ngọt — nhưng nó phụ thuộc bài toán, " +
          "và đó là hạn chế của ε-greedy: <i>ε là một siêu tham số phải dò</i>.</li></ul>" +
          "<b>UCB thông minh hơn ở chỗ nào:</b> nó chọn theo " +
          "<code>Q(a) + c·√(ln t / N(a))</code> — cộng thêm một khoản <b>thưởng cho sự " +
          "không chắc chắn</b>. Tay ít được thử có N nhỏ → khoản cộng lớn → được ưu tiên thử. " +
          "Khi đã thử nhiều, khoản đó co lại. Nghĩa là <b>UCB tự giảm khám phá theo thời gian</b>, " +
          "không cần ai chỉnh lịch.<br><br>" +
          "<b>Thompson sampling</b> lấy mẫu từ phân phối hậu nghiệm của từng tay rồi chọn " +
          "tay có mẫu cao nhất. Nó khám phá <i>tỷ lệ với xác suất tay đó là tốt nhất</i> — " +
          "một cách tiếp cận Bayes rất tự nhiên, và thường mạnh nhất trong ba.<br><br>" +
          "<b>Vì sao bài toán đồ chơi này quan trọng:</b> đánh đổi khám phá–khai thác xuất " +
          "hiện ở mọi nơi trong RL (M08), trong tối ưu siêu tham số, trong A/B testing, và " +
          "trong hệ gợi ý. Hiểu nó ở đây — nơi bài toán đủ đơn giản để nhìn thấu — rồi nhận " +
          "ra nó ở những nơi phức tạp hơn."
      });
      ve();
    }
  });
})();
