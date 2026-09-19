/* =====================================================================
   Nhom — Kien truc mang (2/2)
   rnn-theo-thoi-gian · lstm-cong · tu-chu-y
   ===================================================================== */
(function () {
  var V = window.VIS;

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
  function chuThich(muc) {
    return V.el("div", { class: "chu-thich" }, muc.map(function (m) {
      return V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:" + m[0] }), m[1]]);
    }));
  }
  /* Doi mau chu de (hex) sang rgba de dung do trong suot. */
  function rgbaTu(mau, a) {
    var c = (mau || "").trim();
    if (c.charAt(0) === "#") {
      if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return "rgba(" + parseInt(c.substr(1, 2), 16) + "," + parseInt(c.substr(3, 2), 16) +
             "," + parseInt(c.substr(5, 2), 16) + "," + a + ")";
    }
    return c;
  }
  /* ---------- mau cho gia tri CO DAU (am <-> duong) -------------------
     Cap mau CO DINH, khong lay theo chu de khoa: hai dau phai phan biet
     duoc voi nhau, va mau nhan cua khoa (hong/tim) qua gan mau loi. */
  var AM = "#0f766e", DUONG = "#4f46e5";
  function mauKy(v, bien) {
    var t = Math.max(-1, Math.min(1, v / (bien || 1)));
    return t >= 0 ? rgbaTu(DUONG, 0.12 + 0.88 * t) : rgbaTu(AM, 0.12 + 0.88 * -t);
  }
  /* nhan ma tran (mang cac hang) */
  function nhan(A, B) {
    var n = A.length, m = B[0].length, p = B.length, C = [], i, j, k;
    for (i = 0; i < n; i++) {
      C.push(new Array(m).fill(0));
      for (k = 0; k < p; k++) {
        var a = A[i][k];
        if (a === 0) continue;
        for (j = 0; j < m; j++) C[i][j] += a * B[k][j];
      }
    }
    return C;
  }
  function chuanF(A) {
    var s = 0;
    A.forEach(function (h) { h.forEach(function (v) { s += v * v; }); });
    return Math.sqrt(s);
  }

  /* ================================================================
     D. RNN trai theo thoi gian
     ================================================================ */
  demo({
    id: "rnn-theo-thoi-gian", nhom: "Kiến trúc mạng", mon: "M05",
    ten: "RNN trải theo thời gian — và vì sao gradient tiêu biến",
    moTa: "Cùng một ma trận <b>W</b> được dùng lại ở mọi bước thời gian. " +
          "Xem trạng thái ẩn tiến triển, và xem gradient <b>chết theo hàm mũ</b> khi lùi về quá khứ.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-12-mang-hoi-quy-rnn-lstm-gru">M05.12 — RNN, LSTM, GRU</a>',
    dung: function (host) {
      var W = 580, H = 250, W2 = 580, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var D = 8;
      var CAU = "con mèo ngồi trên tấm thảm màu đỏ và ngủ".split(" ");
      var tt = { T: 12, scale: 0.9, kh: "tanh", hat: 6 };
      var Wm, Um, bm, h, lichSuH, Jtich, chuanJ, buocT;

      function datLai() {
        var r = V.rng(tt.hat * 19 + 3), i, j;
        /* W = scale * (ma tran ngau nhien da chuan hoa ban kinh pho ~ 1) */
        Wm = [];
        for (i = 0; i < D; i++) {
          Wm.push([]);
          for (j = 0; j < D; j++) Wm[i].push(r.chuan() / Math.sqrt(D));
        }
        /* uoc luong ban kinh pho bang lap luy thua roi chuan hoa ve dung 1 */
        var v = new Array(D).fill(1 / Math.sqrt(D)), it, k;
        for (it = 0; it < 60; it++) {
          var nv = new Array(D).fill(0);
          for (i = 0; i < D; i++) for (k = 0; k < D; k++) nv[i] += Wm[i][k] * v[k];
          var nn = Math.sqrt(nv.reduce(function (s, x) { return s + x * x; }, 0)) || 1;
          v = nv.map(function (x) { return x / nn; });
        }
        var Av = new Array(D).fill(0);
        for (i = 0; i < D; i++) for (k = 0; k < D; k++) Av[i] += Wm[i][k] * v[k];
        var ro = Math.sqrt(Av.reduce(function (s, x) { return s + x * x; }, 0)) || 1;
        for (i = 0; i < D; i++) for (j = 0; j < D; j++) Wm[i][j] *= tt.scale / ro;

        Um = []; bm = [];
        for (i = 0; i < D; i++) {
          Um.push([]);
          for (j = 0; j < 4; j++) Um[i].push(r.chuan() * 0.7);
          bm.push(r.chuan() * 0.1);
        }
        h = new Array(D).fill(0);
        lichSuH = [h.slice()];
        /* ma tran tich Jacobi, khoi tao la ma tran don vi */
        Jtich = [];
        for (i = 0; i < D; i++) { Jtich.push(new Array(D).fill(0)); Jtich[i][i] = 1; }
        chuanJ = [1];
        buocT = 0;
      }

      function mahoaTu(t) {                 /* vecto dau vao 4 chieu cho tu thu t */
        var s = CAU[t % CAU.length], v = [0, 0, 0, 0], i;
        for (i = 0; i < s.length; i++) v[i % 4] += (s.charCodeAt(i) % 17) / 17 - 0.5;
        return v;
      }
      function f(v) { return tt.kh === "relu" ? Math.max(0, v) : Math.tanh(v); }
      function df(a) { return tt.kh === "relu" ? (a > 0 ? 1 : 0) : 1 - a * a; }

      function buoc(k) {
        if (k >= tt.T) return false;
        var x = mahoaTu(k), nh = [], i, j;
        for (i = 0; i < D; i++) {
          var s = bm[i];
          for (j = 0; j < D; j++) s += Wm[i][j] * h[j];
          for (j = 0; j < 4; j++) s += Um[i][j] * x[j];
          nh.push(f(s));
        }
        /* Jacobi cua buoc nay: diag(f'(h_t)) * W */
        var J = [];
        for (i = 0; i < D; i++) {
          J.push([]);
          for (j = 0; j < D; j++) J[i].push(df(nh[i]) * Wm[i][j]);
        }
        Jtich = nhan(J, Jtich);
        chuanJ.push(chuanF(Jtich) / Math.sqrt(D));
        h = nh; lichSuH.push(h.slice());
        buocT = k + 1;
        return true;
      }

      function ve(k) {
        g.clearRect(0, 0, W, H);
        var ox = 66, oy = 56, o = Math.min(28, (W - ox - 20) / tt.T), hc = 15;
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Trạng thái ẩn h (8 chiều) qua từng bước thời gian", 14, 20);
        g.font = "10.5px system-ui"; g.fillStyle = V.mau("tx3");
        g.fillText("h", 14, oy + D * hc / 2);

        var t, i;
        for (t = 0; t < tt.T; t++) {
          /* tu */
          g.save();
          g.translate(ox + t * o + o / 2, oy - 8);
          g.rotate(-Math.PI / 3.2);
          g.fillStyle = t < buocT ? V.mau("tx") : V.mau("tx3");
          g.font = (t === buocT - 1 ? "700 " : "") + "10.5px system-ui";
          g.textAlign = "left";
          g.fillText(CAU[t % CAU.length], 0, 0);
          g.restore();
          /* cot trang thai */
          for (i = 0; i < D; i++) {
            var v = t < lichSuH.length - 1 ? lichSuH[t + 1][i] : null;
            g.fillStyle = v === null ? V.mau("bd2") : mauKy(v, 1);
            g.fillRect(ox + t * o, oy + i * hc, o - 2, hc - 2);
          }
          if (t === buocT - 1) {
            g.strokeStyle = V.mau("ba"); g.lineWidth = 2;
            g.strokeRect(ox + t * o - 1.5, oy - 1.5, o - 1, D * hc);
          }
          /* mui ten W */
          if (t > 0) {
            g.strokeStyle = V.mau("tx3"); g.lineWidth = 1;
            g.beginPath();
            g.moveTo(ox + (t - 1) * o + o - 2, oy + D * hc + 8);
            g.lineTo(ox + t * o, oy + D * hc + 8);
            g.stroke();
          }
        }
        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui"; g.textAlign = "left";
        g.fillText("mỗi mũi tên là CÙNG một ma trận W — đó là điều làm nên chữ \"hồi quy\"",
                   ox, oy + D * hc + 26);
        g.fillStyle = V.mau("tx2"); g.font = "11.5px ui-monospace,monospace";
        g.fillText("h_t = " + (tt.kh === "relu" ? "ReLU" : "tanh") + "( W·h_{t−1} + U·x_t + b )",
                   ox, oy + D * hc + 48);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 58, padR = 20, padT = 30, padB = 46;
        var w = W2 - padL - padR, h2 = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("‖∂h_t / ∂h₀‖ — tín hiệu học còn lại bao nhiêu khi lùi về bước 0 (thang log)",
                    14, 18);
        var L = function (v) { return Math.log10(Math.max(1e-12, v)); };
        var lo = -8, hi = 3;
        var X = function (k) { return padL + (tt.T > 1 ? k / (tt.T) * w : 0); };
        var Y = function (v) { return padT + h2 - (L(v) - lo) / (hi - lo) * h2; };
        /* luoi */
        for (var e = lo; e <= hi; e += 2) {
          var y = padT + h2 - (e - lo) / (hi - lo) * h2;
          g2.strokeStyle = V.mau("bd2"); g2.lineWidth = 1;
          g2.beginPath(); g2.moveTo(padL, y); g2.lineTo(padL + w, y); g2.stroke();
          g2.fillStyle = V.mau("tx3"); g2.font = "9.5px ui-monospace,monospace"; g2.textAlign = "right";
          g2.fillText("10^" + e, padL - 5, y + 3);
        }
        /* duong moc 1 */
        g2.strokeStyle = V.mau("tx3"); g2.lineWidth = 1.4; g2.setLineDash([4, 3]);
        g2.beginPath(); g2.moveTo(padL, Y(1)); g2.lineTo(padL + w, Y(1)); g2.stroke();
        g2.setLineDash([]);

        g2.strokeStyle = V.mau("ac"); g2.lineWidth = 2.4;
        g2.beginPath();
        chuanJ.forEach(function (v, k) { var y2 = Y(v); if (!k) g2.moveTo(X(k), y2); else g2.lineTo(X(k), y2); });
        g2.stroke();
        chuanJ.forEach(function (v, k) {
          g2.fillStyle = V.mau("ac");
          g2.beginPath(); g2.arc(X(k), Y(v), 2.6, 0, 6.2832); g2.fill();
        });

        g2.textAlign = "left"; g2.font = "11px system-ui"; g2.fillStyle = V.mau("tx3");
        g2.fillText("bước 0", padL, H2 - 26);
        g2.textAlign = "right";
        g2.fillText("bước " + tt.T, padL + w, H2 - 26);
        g2.textAlign = "left";
        var cuoi = chuanJ[chuanJ.length - 1];
        g2.font = "600 11.5px system-ui";
        g2.fillStyle = cuoi < 1e-3 ? V.mau("loi") : (cuoi > 10 ? V.mau("ba") : V.mau("ok"));
        var ghi = cuoi < 1e-3 ? "GRADIENT TIÊU BIẾN — bước đầu chuỗi không học được gì"
                : (cuoi > 10 ? "GRADIENT BÙNG NỔ — cần cắt chuẩn gradient"
                             : "vùng lành mạnh");
        g2.fillText(ghi + "   (‖J‖ = " + cuoi.toExponential(2) + ")", padL, H2 - 8);
      }

      var P = V.phat({
        toiDa: tt.T, tocDo: 2,
        datLai: datLai, buoc: buoc,
        ve: function (k) { ve(k); ve2(); capSo(); },
        nhan: function (k) {
          return k < tt.T ? ("sắp đọc từ \"" + CAU[k % CAU.length] + "\"") : "hết chuỗi";
        }
      });
      function capSo() {
        so.dat([
          ["bán kính phổ ‖W‖", tt.scale.toFixed(2)],
          ["chiều trạng thái ẩn", String(D)],
          ["‖∂h_t/∂h₀‖ hiện tại", chuanJ[chuanJ.length - 1].toExponential(2)],
          ["số tham số W", String(D * D)]
        ]);
      }
      function lam() { P.datToiDa(tt.T); P.datLai(); P.buoc(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Bán kính phổ của W", min: 0.2, max: 1.8, buoc: 0.02, giaTri: tt.scale,
                  doi: function (v) { tt.scale = v; lam(); } }),
        V.truot({ ten: "Độ dài chuỗi", min: 4, max: 24, buoc: 1, giaTri: tt.T,
                  doi: function (v) { tt.T = v; lam(); } }),
        V.chon({ ten: "Hàm kích hoạt", giaTri: tt.kh,
                 muc: [{ v: "tanh", t: "tanh" }, { v: "relu", t: "ReLU" }],
                 doi: function (v) { tt.kh = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[rgbaTu(DUONG, .9), "giá trị dương"], [rgbaTu(AM, .9), "giá trị âm"],
                           [V.mau("ba"), "bước thời gian hiện tại"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>RNN khác mạng lan truyền tiến ở đúng một chỗ:</b> nó có một <b>trạng thái ẩn</b> " +
          "<code>h</code> được mang từ bước thời gian này sang bước sau, và <b>cùng một ma trận W</b> " +
          "được dùng lại ở mọi bước. Nhờ đó nó xử lý được chuỗi dài bất kỳ với số tham số cố định.<br>" +
          "Nhưng chính chỗ ấy sinh ra vấn đề lớn nhất của nó.<br>" +
          "<b>★ Khi lan truyền ngược qua thời gian</b>, gradient phải đi qua <b>T</b> lần nhân với " +
          "cùng một ma trận:" +
          "<div style='margin:8px 0'><code>∂h_T/∂h₀ = J_T · J_{T−1} · … · J_1,&nbsp;&nbsp; " +
          "J_t = diag(f′(h_t)) · W</code></div>" +
          "Nhân một ma trận với chính nó T lần thì kết quả bị chi phối bởi <b>bán kính phổ</b> " +
          "của nó — số đo \"ma trận này phóng to hay thu nhỏ vectơ bao nhiêu lần\". " +
          "Đó là một hàm <b>mũ theo T</b>, và hàm mũ thì chỉ có hai kết cục.<br>" +
          "<b>★ Kéo thanh \"bán kính phổ\" và đọc biểu đồ dưới:</b><ul>" +
          "<li><b>0,6</b> — đường lao xuống dưới 10⁻⁶ sau chừng 12 bước. Từ ở đầu câu " +
          "<b>không ảnh hưởng gì</b> tới việc học ở cuối câu. Đây là <b>gradient tiêu biến</b>, " +
          "và nó là lý do RNN thuần không nhớ được quá khoảng 10 bước.</li>" +
          "<li><b>1,5</b> — đường vọt lên trên 10². Gradient <b>bùng nổ</b>: một bước cập nhật " +
          "làm hỏng toàn bộ trọng số. Cách chữa tiêu chuẩn là <b>cắt chuẩn gradient</b> " +
          "(gradient clipping) — rẻ và hiệu quả.</li>" +
          "<li><b>≈ 1,0</b> — vùng lành mạnh, nhưng rất hẹp và <b>không tự giữ được</b> khi W " +
          "thay đổi trong lúc huấn luyện.</li></ul>" +
          "⚠️ Với <b>tanh</b>, <code>f′ = 1 − h²  ≤ 1</code> nên gradient <i>luôn</i> bị nhân thêm " +
          "một hệ số ≤ 1 mỗi bước: tanh <b>đẩy cán cân về phía tiêu biến</b>. Đổi sang ReLU " +
          "(<code>f′ = 1</code> khi dương) thì đường bớt dốc xuống hẳn — nhưng lại dễ bùng nổ hơn.<br>" +
          "📌 <b>Đây chính là bài toán mà LSTM sinh ra để giải</b> — xem demo kế tiếp."
      });
      lam();
    }
  });

  /* ================================================================
     E. LSTM — bon cong va duong cao toc o nho
     ================================================================ */
  demo({
    id: "lstm-cong", nhom: "Kiến trúc mạng", mon: "M05",
    ten: "LSTM — bốn cái cổng và đường cao tốc trí nhớ",
    moTa: "Xem giá trị <b>cổng quên · cổng vào · ứng viên · cổng ra</b> ở từng bước, " +
          "và so trực tiếp trí nhớ của LSTM với trí nhớ của RNN thuần.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-12-mang-hoi-quy-rnn-lstm-gru">M05.12 — RNN, LSTM, GRU</a>',
    dung: function (host) {
      var W = 580, H = 300, W2 = 580, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var D = 6;
      var tt = { T: 16, bf: 1.0, hat: 8, tinHieu: 1.0, scaleRNN: 0.9 };
      var Wf, Wi, Wg, Wo, c, h, hR, lichSu, luuRNN, buocT, cong;

      function datLai() {
        var r = V.rng(tt.hat * 23 + 5), i, j;
        function mt(n, m, s) {
          var A = [];
          for (i = 0; i < n; i++) { A.push([]); for (j = 0; j < m; j++) A[i].push(r.chuan() * s); }
          return A;
        }
        /* dau vao: [tin hieu can nho, nhieu] -> 2 chieu; trang thai D chieu */
        Wf = mt(D, D + 2, 0.5); Wi = mt(D, D + 2, 0.5);
        Wg = mt(D, D + 2, 0.8); Wo = mt(D, D + 2, 0.5);
        c = new Array(D).fill(0); h = new Array(D).fill(0);
        hR = new Array(D).fill(0);
        lichSu = []; luuRNN = []; buocT = 0;
        cong = null;
      }

      function dauVao(t) {
        /* bước 0 mang TÍN HIỆU cần nhớ; các bước sau chỉ là nhiễu */
        var r = V.rng(tt.hat * 7 + t * 31 + 1);
        return t === 0 ? [tt.tinHieu, 0] : [0, r.chuan() * 0.4];
      }
      function sig(v) { return 1 / (1 + Math.exp(-v)); }

      function buoc(k) {
        if (k >= tt.T) return false;
        var x = dauVao(k), z = h.concat(x), i, j;
        var F = [], I = [], G = [], O = [], nc = [], nh = [];
        for (i = 0; i < D; i++) {
          var sf = tt.bf, si = 0, sg = 0, so2 = 0;
          for (j = 0; j < D + 2; j++) {
            sf += Wf[i][j] * z[j]; si += Wi[i][j] * z[j];
            sg += Wg[i][j] * z[j]; so2 += Wo[i][j] * z[j];
          }
          F.push(sig(sf)); I.push(sig(si)); G.push(Math.tanh(sg)); O.push(sig(so2));
          nc.push(F[i] * c[i] + I[i] * G[i]);
          nh.push(O[i] * Math.tanh(nc[i]));
        }
        c = nc; h = nh;
        cong = { F: F, I: I, G: G, O: O };

        /* RNN thuan de so sanh: dung cung Wg lam W */
        var nr = [];
        for (i = 0; i < D; i++) {
          var s = 0;
          for (j = 0; j < D; j++) s += Wg[i][j] * hR[j] * tt.scaleRNN / 0.8;
          for (j = 0; j < 2; j++) s += Wg[i][D + j] * x[j];
          nr.push(Math.tanh(s));
        }
        hR = nr;

        var nrmC = Math.sqrt(c.reduce(function (s2, v) { return s2 + v * v; }, 0));
        var nrmR = Math.sqrt(hR.reduce(function (s2, v) { return s2 + v * v; }, 0));
        lichSu.push({ c: c.slice(), h: h.slice(), nc: nrmC, F: F.slice() });
        luuRNN.push(nrmR);
        buocT = k + 1;
        return true;
      }

      function ve(k) {
        g.clearRect(0, 0, W, H);
        var ox = 50, oy = 44, o = Math.min(26, (W - ox - 150) / tt.T), hc = 13;
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Ô nhớ c (trên) và trạng thái ẩn h (dưới) qua từng bước", 14, 18);

        var t, i;
        for (t = 0; t < tt.T; t++) {
          for (i = 0; i < D; i++) {
            var vc = t < lichSu.length ? lichSu[t].c[i] : null;
            g.fillStyle = vc === null ? V.mau("bd2") : mauKy(vc, 2);
            g.fillRect(ox + t * o, oy + i * hc, o - 2, hc - 2);
            var vh = t < lichSu.length ? lichSu[t].h[i] : null;
            g.fillStyle = vh === null ? V.mau("bd2") : mauKy(vh, 1);
            g.fillRect(ox + t * o, oy + (D + 1.4) * hc + i * hc, o - 2, hc - 2);
          }
          if (t === 0) {
            g.fillStyle = V.mau("ba"); g.font = "600 9.5px system-ui"; g.textAlign = "center";
            g.fillText("tín hiệu", ox + o / 2, oy - 8);
          }
        }
        g.textAlign = "right"; g.fillStyle = V.mau("tx3"); g.font = "11px ui-monospace,monospace";
        g.fillText("c", ox - 6, oy + D * hc / 2 + 4);
        g.fillText("h", ox - 6, oy + (D + 1.4) * hc + D * hc / 2 + 4);
        g.textAlign = "left";

        /* bon cong tai buoc hien tai */
        var gy = oy + (2 * D + 2.4) * hc + 22;
        g.fillStyle = V.mau("tx"); g.font = "600 11.5px system-ui";
        g.fillText("Bốn cổng tại bước " + Math.max(1, buocT) + " (mỗi cột là một chiều)", 14, gy - 8);
        if (cong) {
          [["f — cổng QUÊN", cong.F, V.mau("loi")], ["i — cổng VÀO", cong.I, V.mau("ok")],
           ["g — ứng viên", cong.G, DUONG], ["o — cổng RA", cong.O, V.mau("ba")]].forEach(
            function (m, r2) {
              var y = gy + r2 * 22;
              g.fillStyle = V.mau("tx2"); g.font = "10.5px system-ui"; g.textAlign = "left";
              g.fillText(m[0], 14, y + 11);
              for (i = 0; i < D; i++) {
                var v = m[1][i], t2 = (r2 === 2) ? (v + 1) / 2 : v;
                g.fillStyle = V.mau("bd2");
                g.fillRect(118 + i * 30, y, 26, 14);
                g.fillStyle = m[2];
                g.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.min(1, t2));
                g.fillRect(118 + i * 30, y, 26, 14);
                g.globalAlpha = 1;
                g.fillStyle = V.mau("tx"); g.font = "9px ui-monospace,monospace"; g.textAlign = "center";
                g.fillText(v.toFixed(2), 118 + i * 30 + 13, y + 10.5);
                g.textAlign = "left";
              }
            });
          var tbF = cong.F.reduce(function (s, v) { return s + v; }, 0) / D;
          g.fillStyle = V.mau("tx"); g.font = "600 11.5px ui-monospace,monospace";
          g.fillText("c_t = f ⊙ c_{t−1} + i ⊙ g", 320, gy + 11);
          g.font = "11px system-ui"; g.fillStyle = V.mau("tx2");
          g.fillText("f trung bình = " + tbF.toFixed(3), 320, gy + 30);
          g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui";
          g.fillText("f ≈ 1 → giữ nguyên ký ức", 320, gy + 48);
          g.fillText("f ≈ 0 → xoá sạch ký ức", 320, gy + 64);
        }
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 58, padR = 20, padT = 28, padB = 42;
        var w = W2 - padL - padR, h2 = H2 - padT - padB;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Tín hiệu bơm vào ở bước 1 còn lại bao nhiêu? (thang log)", 14, 17);
        var L = function (v) { return Math.log10(Math.max(1e-10, v)); };
        var lo = -6, hi = 1;
        var X = function (k) { return padL + (tt.T > 1 ? k / (tt.T - 1) * w : 0); };
        var Y = function (v) { return padT + h2 - (L(v) - lo) / (hi - lo) * h2; };
        for (var e = lo; e <= hi; e += 1) {
          var y = padT + h2 - (e - lo) / (hi - lo) * h2;
          g2.strokeStyle = V.mau("bd2"); g2.lineWidth = 1;
          g2.beginPath(); g2.moveTo(padL, y); g2.lineTo(padL + w, y); g2.stroke();
          g2.fillStyle = V.mau("tx3"); g2.font = "9.5px ui-monospace,monospace"; g2.textAlign = "right";
          g2.fillText("10^" + e, padL - 5, y + 3);
        }
        function duong(ds, mau, dam) {
          if (ds.length < 2) return;
          g2.strokeStyle = mau; g2.lineWidth = dam;
          g2.beginPath();
          ds.forEach(function (v, k) { var y2 = Y(v); if (!k) g2.moveTo(X(k), y2); else g2.lineTo(X(k), y2); });
          g2.stroke();
        }
        duong(luuRNN, V.mau("loi"), 1.8);
        duong(lichSu.map(function (p) { return p.nc; }), V.mau("ok"), 2.6);

        g2.textAlign = "left"; g2.font = "11px system-ui";
        g2.fillStyle = V.mau("ok"); g2.fillText("■ LSTM — ‖ô nhớ c‖", padL, H2 - 24);
        g2.fillStyle = V.mau("loi"); g2.fillText("■ RNN thuần — ‖h‖", padL + 150, H2 - 24);
        g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
        g2.fillText("cả hai nhận đúng cùng một tín hiệu ở bước 1, rồi chỉ toàn nhiễu",
                    padL, H2 - 8);
      }

      var P = V.phat({
        toiDa: tt.T, tocDo: 1.5,
        datLai: datLai, buoc: buoc,
        ve: function (k) { ve(k); ve2(); capSo(); },
        nhan: function (k) {
          if (!cong) return "chưa chạy";
          var tbF = cong.F.reduce(function (s, v) { return s + v; }, 0) / D;
          return "f trung bình " + tbF.toFixed(3) + " · ‖c‖ " +
                 (lichSu.length ? lichSu[lichSu.length - 1].nc.toFixed(3) : "—");
        }
      });
      function capSo() {
        var cu = lichSu.length ? lichSu[lichSu.length - 1].nc : 0;
        var rnn = luuRNN.length ? luuRNN[luuRNN.length - 1] : 0;
        so.dat([
          ["‖c‖ của LSTM", cu.toExponential(2)],
          ["‖h‖ của RNN", rnn.toExponential(2)],
          ["LSTM giữ được gấp", rnn > 1e-12 ? (cu / rnn).toFixed(1) + "×" : "—"],
          ["thiên vị cổng quên b_f", tt.bf.toFixed(2)]
        ]);
      }
      function lam() { P.datToiDa(tt.T); P.datLai(); P.buoc(); }

      var dk = [
        P.dk(),
        V.truot({ ten: "Thiên vị cổng quên b_f", min: -3, max: 4, buoc: 0.1, giaTri: tt.bf,
                  doi: function (v) { tt.bf = v; lam(); } }),
        V.truot({ ten: "Độ dài chuỗi", min: 4, max: 32, buoc: 1, giaTri: tt.T,
                  doi: function (v) { tt.T = v; lam(); } }),
        V.truot({ ten: "Độ mạnh tín hiệu bơm vào", min: 0.2, max: 3, buoc: 0.1, giaTri: tt.tinHieu,
                  doi: function (v) { tt.tinHieu = v; lam(); } }),
        V.truot({ ten: "Bán kính phổ W của RNN so sánh", min: 0.3, max: 1.2, buoc: 0.02,
                  giaTri: tt.scaleRNN, doi: function (v) { tt.scaleRNN = v; lam(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>LSTM thêm một thứ mà RNN không có: một ô nhớ <code>c</code> đi thẳng qua thời gian, " +
          "không bị nhân với ma trận W.</b>" +
          "<div style='margin:8px 0'><code>c_t = f ⊙ c_{t−1} + i ⊙ g</code></div>" +
          "Chú ý dấu <b>cộng</b> và chú ý rằng <code>c_{t−1}</code> chỉ bị nhân với <b>f</b>, " +
          "một số trong khoảng (0, 1) — <i>không</i> phải một ma trận. Vì thế đạo hàm " +
          "<code>∂c_t/∂c_{t−1} = f</code>. Nếu <b>f ≈ 1</b> thì gradient đi ngược qua 100 bước " +
          "vẫn gần như nguyên vẹn. Người ta gọi đó là <b>băng chuyền không đổi</b> " +
          "(constant error carousel).<br>" +
          "<b>Bốn cổng, mỗi cổng một việc:</b><ul>" +
          "<li><b>f — cổng quên:</b> giữ lại bao nhiêu phần ký ức cũ. Đây là cổng quan trọng nhất.</li>" +
          "<li><b>i — cổng vào:</b> cho bao nhiêu phần thông tin mới đi vào.</li>" +
          "<li><b>g — ứng viên:</b> thông tin mới <i>là gì</i> (đây là phần duy nhất dùng tanh, " +
          "nên nó nhận cả giá trị âm).</li>" +
          "<li><b>o — cổng ra:</b> lộ ra bao nhiêu phần ô nhớ cho phần còn lại của mạng thấy. " +
          "★ Nhờ nó, LSTM có thể <b>nhớ mà chưa dùng ngay</b>.</li></ul>" +
          "<b>★ Thí nghiệm ở biểu đồ dưới:</b> ta bơm một tín hiệu vào ở <b>bước 1</b>, rồi " +
          "toàn nhiễu. Đường đỏ là RNN thuần, đường xanh là ô nhớ LSTM.<ul>" +
          "<li><b>b_f = 3</b> (cổng quên mở gần hết): đường xanh gần như <b>nằm ngang</b> — " +
          "ký ức được giữ suốt chuỗi. Đây chính là lý do cài đặt LSTM thực tế thường " +
          "<b>khởi tạo b_f = 1</b>: cho mạng mặc định là <i>nhớ</i>, rồi học cách quên, " +
          "chứ không ngược lại.</li>" +
          "<li><b>b_f = −3</b> (cổng quên đóng): đường xanh lao xuống còn nhanh hơn cả RNN. " +
          "LSTM <b>không tự động</b> nhớ lâu — nó chỉ <i>có khả năng</i> nhớ lâu.</li>" +
          "<li>So với demo RNN trước: ở đó bạn không có cách nào chỉnh tốc độ quên mà không " +
          "phá luôn khả năng tính toán, vì cùng một ma trận W làm cả hai việc. " +
          "<b>LSTM tách hai việc đó ra</b> — đó là toàn bộ ý tưởng.</li></ul>" +
          "⚖️ Trọng số ở đây là <b>ngẫu nhiên, chưa huấn luyện</b>: mục đích là nhìn thấy cơ chế, " +
          "không phải đo hiệu năng. Một LSTM đã huấn luyện sẽ tự đặt f gần 1 ở đúng những chiều " +
          "cần nhớ lâu, và gần 0 ở những chiều cần quên nhanh."
      });
      lam();
    }
  });

  /* ================================================================
     F. Tu chu y (self-attention)
     ================================================================ */
  demo({
    id: "tu-chu-y", nhom: "Kiến trúc mạng", mon: "M06",
    ten: "Tự chú ý từng bước — Q, K, V và mặt nạ nhân quả",
    moTa: "Tính <b>từng hàng một</b>: điểm số → softmax → tổng có trọng số. Có " +
          "<b>che nhân quả</b> và <b>mã hoá vị trí</b> để bật tắt. " +
          "<i>(Muốn đào sâu riêng phép chia √d theo số chiều, xem demo " +
          "<b>Attention: ma trận QKᵀ</b> ở nhóm AI hiện đại.)</i>",
    lienKet: '<a href="../web/index.html#/bai/m06-bai-08-tu-attention-den-self-attention">M06.08 — Tự chú ý</a> · ' +
             '<a href="../web/index.html#/bai/m06-bai-09-kien-truc-transformer">M06.09 — Kiến trúc Transformer</a>',
    dung: function (host) {
      var W = 580, H = 330, W2 = 580, H2 = 200;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var CAU = {
        a: "con mèo ngồi trên thảm vì nó mệt".split(" "),
        b: "hôm qua tôi mua một quyển sách hay".split(" "),
        c: "nếu trời mưa thì tôi sẽ ở nhà".split(" ")
      };
      var Dm = 8, Dk = 8;
      var tt = { cau: "a", dauNhieu: 2, chan: false, chiaCan: true, nhietDo: 1, hat: 4, viTri: true };
      var toks, E, Wq, Wk, Wv, Q, Kk, Vv, A, OUT, dong, entropy;

      function datLai() {
        toks = CAU[tt.cau];
        var n = toks.length, r = V.rng(tt.hat * 37 + tt.dauNhieu * 101 + 3), i, j;
        function mt(a, b, s) {
          var M = [];
          for (i = 0; i < a; i++) { M.push([]); for (j = 0; j < b; j++) M[i].push(r.chuan() * s); }
          return M;
        }
        /* nhung tu: hat giong tu chinh chuoi ky tu -> tu giong nhau thi vecto giong nhau */
        E = [];
        for (i = 0; i < n; i++) {
          var rr = V.rng(bam(toks[i]) + 1), v = [];
          for (j = 0; j < Dm; j++) v.push(rr.chuan());
          if (tt.viTri) {
            for (j = 0; j < Dm; j++) {
              var w = Math.pow(10000, -2 * Math.floor(j / 2) / Dm);
              v[j] += (j % 2 === 0 ? Math.sin(i * w) : Math.cos(i * w)) * 0.9;
            }
          }
          E.push(v);
        }
        Wq = mt(Dm, Dk, 0.6); Wk = mt(Dm, Dk, 0.6); Wv = mt(Dm, Dk, 0.6);
        Q = nhan(E, Wq); Kk = nhan(E, Wk); Vv = nhan(E, Wv);
        A = []; OUT = []; entropy = [];
        for (i = 0; i < n; i++) { A.push(new Array(n).fill(null)); OUT.push(null); entropy.push(null); }
        dong = -1;
      }
      function bam(s) {
        var h = 7, i;
        for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
        return h;
      }

      /* MOT buoc = tinh xong MOT hang cua ma tran chu y */
      function buoc(k) {
        var n = toks.length;
        if (k >= n) return false;
        dong = k;
        var s = [], j, d;
        var chia = tt.chiaCan ? Math.sqrt(Dk) : 1;
        for (j = 0; j < n; j++) {
          var t = 0;
          for (d = 0; d < Dk; d++) t += Q[k][d] * Kk[j][d];
          t = t / chia / tt.nhietDo;
          if (tt.chan && j > k) t = -Infinity;
          s.push(t);
        }
        var mx = Math.max.apply(null, s.filter(function (v) { return isFinite(v); }));
        var tong = 0, ex = s.map(function (v) {
          var e = isFinite(v) ? Math.exp(v - mx) : 0; tong += e; return e;
        });
        var hang = ex.map(function (e) { return e / tong; });
        A[k] = hang;
        var H0 = 0;
        hang.forEach(function (p) { if (p > 1e-12) H0 -= p * Math.log(p); });
        entropy[k] = H0 / Math.log(n);          /* chuan hoa ve [0,1] */
        var o = new Array(Dk).fill(0);
        for (j = 0; j < n; j++) for (d = 0; d < Dk; d++) o[d] += hang[j] * Vv[j][d];
        OUT[k] = o;
        return true;
      }

      function ve(k) {
        g.clearRect(0, 0, W, H);
        var n = toks.length, o = Math.min(34, (H - 120) / n);
        var ox = 132, oy = 78;
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Ma trận chú ý — hàng i = \"từ i nhìn vào đâu\"", 14, 20);

        var i, j;
        /* nhan cot (key) */
        for (j = 0; j < n; j++) {
          g.save();
          g.translate(ox + j * o + o / 2, oy - 8);
          g.rotate(-Math.PI / 3.4);
          g.fillStyle = V.mau("tx2"); g.font = "11px system-ui"; g.textAlign = "left";
          g.fillText(toks[j], 0, 0);
          g.restore();
        }
        for (i = 0; i < n; i++) {
          g.fillStyle = (i === dong) ? V.mau("ba") : V.mau("tx2");
          g.font = (i === dong ? "700 " : "") + "11px system-ui"; g.textAlign = "right";
          g.fillText(toks[i], ox - 8, oy + i * o + o / 2 + 4);
          for (j = 0; j < n; j++) {
            var v = A[i][j];
            g.fillStyle = v === null ? V.mau("bd2") : V.thangMau(Math.min(1, v * 2.2));
            g.fillRect(ox + j * o, oy + i * o, o - 1.5, o - 1.5);
            if (v !== null && o > 24) {
              g.fillStyle = v > 0.45 ? "#fff" : V.mau("tx2");
              g.font = "9px ui-monospace,monospace"; g.textAlign = "center";
              g.fillText(v.toFixed(2), ox + j * o + o / 2 - 0.7, oy + i * o + o / 2 + 3);
            }
          }
          if (i === dong) {
            g.strokeStyle = V.mau("ba"); g.lineWidth = 2;
            g.strokeRect(ox - 1.5, oy + i * o - 1.5, n * o, o + 1);
          }
        }

        /* bang ben phai */
        var bx = ox + n * o + 22;
        g.textAlign = "left";
        if (dong >= 0) {
          g.fillStyle = V.mau("ba"); g.font = "600 12px system-ui";
          g.fillText("Hàng \"" + toks[dong] + "\"", bx, oy + 8);
          g.fillStyle = V.mau("tx2"); g.font = "10.5px system-ui";
          g.fillText("① điểm = q·kᵀ" + (tt.chiaCan ? " / √8" : " (KHÔNG chia)"), bx, oy + 30);
          g.fillText("② softmax → tổng bằng 1", bx, oy + 47);
          g.fillText("③ ra = Σ (trọng số × v)", bx, oy + 64);
          var e = entropy[dong];
          g.fillStyle = e < 0.25 ? V.mau("loi") : V.mau("ok");
          g.font = "600 11px ui-monospace,monospace";
          g.fillText("entropy " + (e * 100).toFixed(0) + " %", bx, oy + 88);
          g.fillStyle = V.mau("tx3"); g.font = "10px system-ui";
          g.fillText(e < 0.25 ? "gần như chỉ nhìn 1 từ" : "trải đều trên nhiều từ", bx, oy + 104);
          /* vecto ra */
          g.fillStyle = V.mau("tx2"); g.font = "10.5px system-ui";
          g.fillText("vectơ ra (8 chiều):", bx, oy + 128);
          for (var d = 0; d < Dk; d++) {
            g.fillStyle = mauKy(OUT[dong][d], 1.6);
            g.fillRect(bx + d * 15, oy + 136, 13, 20);
          }
        }
        g.fillStyle = V.mau("tx3"); g.font = "10.5px system-ui"; g.textAlign = "left";
        g.fillText(tt.chan ? "Che nhân quả BẬT — nửa trên phải bằng 0"
                           : "Che nhân quả tắt — mỗi từ nhìn được cả câu", 14, H - 14);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var n = toks.length;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Entropy của mỗi hàng — chú ý đang TRẢI RỘNG hay ĐỔ DỒN?", 14, 18);
        var ox = 132, w = W2 - ox - 90, i;
        for (i = 0; i < n; i++) {
          var y = 36 + i * 19;
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui"; g2.textAlign = "right";
          g2.fillText(toks[i], ox - 8, y + 11);
          g2.fillStyle = V.mau("bd2"); g2.fillRect(ox, y, w, 13);
          if (entropy[i] !== null) {
            g2.fillStyle = entropy[i] < 0.25 ? V.mau("loi") : V.mau("ac");
            g2.fillRect(ox, y, Math.max(2, w * entropy[i]), 13);
            g2.fillStyle = V.mau("tx2"); g2.font = "10px ui-monospace,monospace"; g2.textAlign = "left";
            g2.fillText((entropy[i] * 100).toFixed(0) + " %", ox + w + 8, y + 11);
          }
        }
        g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui"; g2.textAlign = "left";
        g2.fillText("100 % = nhìn đều mọi từ · 0 % = chỉ nhìn đúng một từ",
                    14, Math.min(H2 - 8, 36 + n * 19 + 16));
      }

      var P = V.phat({
        toiDa: 10, tocDo: 1.5,
        datLai: datLai, buoc: buoc,
        ve: function (k) { ve(k); ve2(); capSo(); },
        nhan: function (k) {
          return k < toks.length ? ("sắp tính hàng \"" + toks[k] + "\"") : "xong cả ma trận";
        }
      });
      function capSo() {
        var e = entropy.filter(function (v) { return v !== null; });
        var tb = e.length ? e.reduce(function (s, v) { return s + v; }, 0) / e.length : 0;
        so.dat([
          ["số từ", String(toks.length)],
          ["kích thước ma trận", toks.length + "×" + toks.length],
          ["entropy trung bình", (tb * 100).toFixed(0) + " %"],
          ["chia √d", tt.chiaCan ? "có" : "KHÔNG"],
          ["che nhân quả", tt.chan ? "bật" : "tắt"]
        ]);
      }
      function lam() {
        datLai();
        P.datToiDa(toks.length);
        P.datLai();
        P.buoc();                      /* tinh san hang dau tien */
      }

      var dk = [
        P.dk(),
        V.chon({ ten: "Câu", giaTri: tt.cau,
                 muc: [{ v: "a", t: "con mèo ngồi trên thảm vì nó mệt" },
                       { v: "b", t: "hôm qua tôi mua một quyển sách hay" },
                       { v: "c", t: "nếu trời mưa thì tôi sẽ ở nhà" }],
                 doi: function (v) { tt.cau = v; lam(); } }),
        V.danhDau({ ten: "Chia cho √d (phép co giãn của Transformer)", giaTri: tt.chiaCan,
                    doi: function (v) { tt.chiaCan = v; lam(); } }),
        V.danhDau({ ten: "Che nhân quả (như GPT khi sinh văn bản)", giaTri: tt.chan,
                    doi: function (v) { tt.chan = v; lam(); } }),
        V.danhDau({ ten: "Cộng mã hoá vị trí", giaTri: tt.viTri,
                    doi: function (v) { tt.viTri = v; lam(); } }),
        V.truot({ ten: "Nhiệt độ của softmax", min: 0.2, max: 4, buoc: 0.1, giaTri: tt.nhietDo,
                  doi: function (v) { tt.nhietDo = v; lam(); } }),
        V.truot({ ten: "Đầu chú ý thứ (đổi Wq, Wk, Wv)", min: 1, max: 8, buoc: 1, giaTri: tt.dauNhieu,
                  doi: function (v) { tt.dauNhieu = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Tự chú ý trả lời đúng một câu hỏi:</b> khi xử lý từ thứ <i>i</i>, nên trộn bao nhiêu " +
          "phần thông tin từ mỗi từ khác trong câu?<br>" +
          "Mỗi từ sinh ra ba vectơ: <b>q</b> (truy vấn — <i>tôi đang tìm gì</i>), " +
          "<b>k</b> (khoá — <i>tôi có gì</i>), <b>v</b> (giá trị — <i>tôi đưa ra cái gì</i>). " +
          "Điểm chú ý là tích vô hướng <code>q·k</code>: hai vectơ càng cùng hướng thì điểm càng cao." +
          "<div style='margin:8px 0'><code>Attention(Q,K,V) = softmax(QKᵀ / √d)·V</code></div>" +
          "<b>★ Bấm ⏭ Một bước từng hàng một</b> và đọc: mỗi hàng là một từ tự phân bổ sự chú ý " +
          "của nó, và <b>tổng mỗi hàng luôn bằng 1</b> — đó là việc softmax làm.<br>" +
          "<b>★ Ba nút đáng thử, mỗi nút dạy một điều:</b><ul>" +
          "<li><b>Tắt \"chia cho √d\"</b> — biểu đồ entropy sập xuống gần 0: mỗi từ chỉ còn nhìn " +
          "<b>đúng một từ</b>, vì tích vô hướng của hai vectơ ngẫu nhiên <i>d</i> chiều có " +
          "độ lệch chuẩn cỡ <b>√d</b>, đủ để softmax bão hoà thành one-hot — và gradient qua " +
          "softmax bão hoà ≈ 0. <i>(Demo <b>Attention: ma trận QKᵀ</b> ở nhóm AI hiện đại " +
          "cho bạn kéo thẳng số chiều d để nhìn hiệu ứng ấy lớn dần.)</i></li>" +
          "<li><b>Bật \"che nhân quả\"</b> — nửa trên bên phải của ma trận về 0: mỗi từ chỉ được " +
          "nhìn về <b>quá khứ</b>. Đây là khác biệt duy nhất về kiến trúc giữa BERT (nhìn hai chiều) " +
          "và GPT (chỉ nhìn lùi), và nó là lý do GPT sinh văn bản được còn BERT thì không.</li>" +
          "<li><b>Tắt \"mã hoá vị trí\"</b> — thử rồi so hai hàng của hai từ giống nhau. " +
          "Không có nó, tự chú ý <b>hoàn toàn không biết thứ tự</b>: đảo lộn cả câu cũng cho " +
          "cùng kết quả, chỉ hoán vị theo. Đó là lý do Transformer phải cộng thêm tín hiệu vị trí " +
          "vào vectơ nhúng ngay từ đầu.</li></ul>" +
          "📌 <b>Đổi \"đầu chú ý\"</b> để thấy cùng một câu cho ra những ma trận rất khác nhau — " +
          "mỗi đầu học một kiểu quan hệ riêng (từ gần, chủ–vị, đại từ và từ nó thay thế…). " +
          "Đó là ý nghĩa của <i>multi-head</i>: chạy song song nhiều bản rồi nối kết quả lại.<br>" +
          "⚖️ Trọng số ở đây <b>ngẫu nhiên, chưa huấn luyện</b> — nên đừng đọc ma trận này như " +
          "một phân tích ngữ pháp. Cái đáng xem là <b>cơ chế</b> và cách nó hỏng khi thiếu một mảnh."
      });
      lam();
    }
  });
})();
