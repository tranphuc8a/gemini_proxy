/* =====================================================================
   Nhom — Kien truc mang (1/2)
   mang-lan-truyen-tien · huan-luyen-mlp · cnn-duong-ong

   Moi demo dung V.phat(...): Chay / Tam dung / Mot buoc / Tua / Toc do.
   ===================================================================== */
(function () {
  var V = window.VIS;

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
  function veCong(g, ds, X, Y, mau, dam, dut) {
    if (ds.length < 2) return;
    g.strokeStyle = mau; g.lineWidth = dam || 1.6;
    if (dut) g.setLineDash(dut);
    g.beginPath();
    ds.forEach(function (v, k) { var y = Y(v); if (!k) g.moveTo(X(k), y); else g.lineTo(X(k), y); });
    g.stroke(); g.setLineDash([]);
  }

  /* ================================================================
     A. Mang lan truyen tien — xem tin hieu chay qua tung neuron
     ================================================================ */
  demo({
    id: "mang-lan-truyen-tien", nhom: "Kiến trúc mạng", mon: "M05",
    ten: "Mạng lan truyền tiến — đi theo tín hiệu qua từng neuron",
    moTa: "Bấm <b>⏭ Một bước</b> để tính <b>đúng một neuron</b> và xem phép tính " +
          "<code>z = Σ wᵢaᵢ + b</code> hiện ra. Kéo hai đầu vào để thấy cả mạng đổi theo.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-02-perceptron-va-mlp">M05.02 — Perceptron & MLP</a> · ' +
             '<a href="../web/index.html#/bai/m05-bai-03-ham-kich-hoat">M05.03 — Hàm kích hoạt</a>',
    dung: function (host) {
      var W = 580, H = 360, W2 = 580, H2 = 150;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var CO = [2, 4, 3, 1];                         /* so neuron moi lop */
      var tt = { x1: 0.8, x2: -0.5, kh: "tanh", hat: 3, hienSo: true };
      var Wt, B, a, z, xong, tongNe;

      function kichHoat(v) {
        if (tt.kh === "relu") return Math.max(0, v);
        if (tt.kh === "sigmoid") return 1 / (1 + Math.exp(-v));
        return Math.tanh(v);
      }
      function tenKH() {
        return tt.kh === "relu" ? "ReLU" : (tt.kh === "sigmoid" ? "σ" : "tanh");
      }

      function datLai() {
        var r = V.rng(tt.hat * 41 + 7), l, i, j;
        Wt = []; B = [];
        for (l = 1; l < CO.length; l++) {
          var w = [], b = [];
          for (i = 0; i < CO[l]; i++) {
            var hang = [];
            /* khoi tao kieu Xavier: chia cho can bac hai so dau vao */
            for (j = 0; j < CO[l - 1]; j++) hang.push(r.chuan() * Math.sqrt(2 / CO[l - 1]));
            w.push(hang); b.push(r.chuan() * 0.3);
          }
          Wt.push(w); B.push(b);
        }
        a = [[tt.x1, tt.x2]];
        z = [];
        for (l = 1; l < CO.length; l++) {
          a.push(new Array(CO[l]).fill(null));
          z.push(new Array(CO[l]).fill(null));
        }
        xong = false;
        tongNe = CO.slice(1).reduce(function (s, v) { return s + v; }, 0);
      }

      /* MOT buoc = tinh xong MOT neuron */
      function viTri(k) {
        var l = 1, d = k;
        while (l < CO.length && d >= CO[l]) { d -= CO[l]; l++; }
        return { lop: l, i: d };
      }
      function buoc(k) {
        if (k >= tongNe) return false;
        var v = viTri(k), l = v.lop, i = v.i, s = B[l - 1][i], j;
        for (j = 0; j < CO[l - 1]; j++) s += Wt[l - 1][i][j] * a[l - 1][j];
        z[l - 1][i] = s;
        a[l][i] = kichHoat(s);
        if (k === tongNe - 1) xong = true;
        return true;
      }

      function toaDo(l, i) {
        var cot = 60 + l * ((W - 150) / (CO.length - 1));
        var n = CO[l], cao = H - 96;
        var y = 56 + (n === 1 ? cao / 2 : (i * cao) / (n - 1));
        return { x: cot, y: y };
      }

      function ve(k) {
        g.clearRect(0, 0, W, H);
        var cur = k < tongNe ? viTri(k) : null;
        var l, i, j;

        /* canh */
        for (l = 1; l < CO.length; l++) {
          for (i = 0; i < CO[l]; i++) {
            for (j = 0; j < CO[l - 1]; j++) {
              var p = toaDo(l - 1, j), q = toaDo(l, i);
              var dangTinh = cur && cur.lop === l && cur.i === i;
              var w = Wt[l - 1][i][j];
              g.strokeStyle = mauKy(w, 1.4);
              g.lineWidth = dangTinh ? Math.min(4, 0.8 + Math.abs(w) * 2.2)
                                     : Math.min(2.2, 0.3 + Math.abs(w) * 1.2);
              g.globalAlpha = dangTinh ? 1 : (a[l][i] === null ? 0.18 : 0.45);
              g.beginPath(); g.moveTo(p.x + 15, p.y); g.lineTo(q.x - 15, q.y); g.stroke();
            }
          }
        }
        g.globalAlpha = 1;

        /* neuron */
        for (l = 0; l < CO.length; l++) {
          for (i = 0; i < CO[l]; i++) {
            var p2 = toaDo(l, i), va = a[l][i];
            var dangTinh2 = cur && cur.lop === l && cur.i === i;
            g.beginPath(); g.arc(p2.x, p2.y, 15, 0, 6.2832);
            g.fillStyle = va === null ? V.mau("bd2") : mauKy(va, 1);
            g.fill();
            g.strokeStyle = dangTinh2 ? V.mau("ba") : V.mau("tx");
            g.lineWidth = dangTinh2 ? 3 : 1.2; g.stroke();
            if (tt.hienSo && va !== null) {
              g.fillStyle = Math.abs(va) > 0.55 ? "#fff" : V.mau("tx");
              g.font = "600 10px ui-monospace,monospace"; g.textAlign = "center";
              g.fillText(va.toFixed(2), p2.x, p2.y + 3.5);
            }
          }
          g.fillStyle = V.mau("tx3"); g.font = "600 11px system-ui"; g.textAlign = "center";
          var nhan = l === 0 ? "đầu vào" : (l === CO.length - 1 ? "đầu ra" : "ẩn " + l);
          g.fillText(nhan + " (" + CO[l] + ")", toaDo(l, 0).x, 28);
        }

        /* phep tinh cua neuron dang xet */
        g.textAlign = "left"; g.font = "11.5px ui-monospace,monospace";
        var yy = H - 30;
        if (cur) {
          var l2 = cur.lop, i2 = cur.i;
          var ct = "z = ";
          for (j = 0; j < CO[l2 - 1]; j++) {
            ct += (j ? " + " : "") + Wt[l2 - 1][i2][j].toFixed(2) + "·" +
                  (a[l2 - 1][j] === null ? "?" : a[l2 - 1][j].toFixed(2));
          }
          ct += " + " + B[l2 - 1][i2].toFixed(2);
          g.fillStyle = V.mau("ba");
          g.fillText("Đang tính neuron " + (l2 === CO.length - 1 ? "đầu ra" : "ẩn " + l2) +
                     " #" + (i2 + 1), 16, yy - 18);
          g.fillStyle = V.mau("tx2");
          g.fillText(ct.length > 86 ? ct.slice(0, 86) + "…" : ct, 16, yy);
          if (z[l2 - 1][i2] !== null) {
            g.fillStyle = V.mau("ac");
            g.fillText("→ a = " + tenKH() + "(" + z[l2 - 1][i2].toFixed(3) + ") = " +
                       a[l2][i2].toFixed(3), 16, yy + 17);
          }
        } else {
          g.fillStyle = V.mau("ok"); g.font = "600 12px system-ui";
          g.fillText("Đã tính xong cả mạng — đầu ra = " +
                     (a[CO.length - 1][0] === null ? "?" : a[CO.length - 1][0].toFixed(4)), 16, yy);
        }
      }

      /* Bieu do: moi neuron an lop 1 la mot DUONG THANG trong khong gian dau vao */
      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var S = H2 - 26, ox = 14, oy = 14;
        var i, j, px, py;
        /* ban do: neuron nao "sang" nhat tai moi diem dau vao */
        for (i = 0; i < S; i += 3) for (j = 0; j < S; j += 3) {
          var x1 = (i / S) * 4 - 2, x2 = 2 - (j / S) * 4;
          var mx = -1e9, mi = 0;
          for (var q = 0; q < CO[1]; q++) {
            var s = B[0][q] + Wt[0][q][0] * x1 + Wt[0][q][1] * x2;
            if (s > mx) { mx = s; mi = q; }
          }
          g2.fillStyle = "hsl(" + (mi * 360 / CO[1]) + ",55%," + (48 + Math.min(28, mx * 9)) + "%)";
          g2.fillRect(ox + i, oy + j, 3, 3);
        }
        /* diem dau vao hien tai */
        px = ox + ((tt.x1 + 2) / 4) * S;
        py = oy + ((2 - tt.x2) / 4) * S;
        g2.strokeStyle = "#111"; g2.lineWidth = 2;
        g2.beginPath(); g2.arc(px, py, 6, 0, 6.2832); g2.stroke();
        g2.fillStyle = "#fff"; g2.beginPath(); g2.arc(px, py, 3.5, 0, 6.2832); g2.fill();

        g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Mỗi neuron ẩn lớp 1 cắt mặt phẳng đầu vào bằng một ĐƯỜNG THẲNG.", S + 30, 26);
        g2.fillText("Màu = neuron nào đang trội nhất tại điểm đó.", S + 30, 45);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Vòng tròn trắng = cặp (x₁, x₂) bạn đang đặt.", S + 30, 68);
        g2.fillText("Đó là toàn bộ ý nghĩa của một lớp tuyến tính:", S + 30, 90);
        g2.fillText("chia không gian bằng các siêu phẳng, rồi hàm", S + 30, 106);
        g2.fillText("kích hoạt bẻ cong kết quả.", S + 30, 122);
      }

      var P = V.phat({
        toiDa: 8, tocDo: 2, tua: true,
        datLai: datLai,
        buoc: buoc,
        ve: function (k) { ve(k); ve2(); capSo(); },
        nhan: function (k) {
          if (k >= tongNe) return "xong — đầu ra " + a[CO.length - 1][0].toFixed(4);
          var v = viTri(k);
          return "sắp tính lớp " + v.lop + ", neuron #" + (v.i + 1);
        }
      });
      function capSo() {
        var tong = 0;
        for (var l = 1; l < CO.length; l++) tong += CO[l] * CO[l - 1] + CO[l];
        so.dat([
          ["kiến trúc", CO.join(" → ")],
          ["số tham số", String(tong)],
          ["hàm kích hoạt", tenKH()],
          ["đầu ra", a[CO.length - 1][0] === null ? "—" : a[CO.length - 1][0].toFixed(4)]
        ]);
      }
      function lam() {
        tongNe = CO.slice(1).reduce(function (s, v) { return s + v; }, 0);
        P.datToiDa(tongNe); P.datLai();
        P.buoc();                      /* tinh san neuron dau de khung hinh dau co gi de xem */
      }

      var dk = [
        P.dk(),
        V.truot({ ten: "x₁ — đầu vào 1", min: -2, max: 2, buoc: 0.05, giaTri: tt.x1,
                  doi: function (v) { tt.x1 = v; lam(); } }),
        V.truot({ ten: "x₂ — đầu vào 2", min: -2, max: 2, buoc: 0.05, giaTri: tt.x2,
                  doi: function (v) { tt.x2 = v; lam(); } }),
        V.chon({ ten: "Hàm kích hoạt", giaTri: tt.kh,
                 muc: [{ v: "tanh", t: "tanh" }, { v: "relu", t: "ReLU" }, { v: "sigmoid", t: "sigmoid" }],
                 doi: function (v) { tt.kh = v; lam(); } }),
        V.truot({ ten: "Hạt giống trọng số", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; lam(); } }),
        V.danhDau({ ten: "Hiện số trên neuron", giaTri: tt.hienSo,
                    doi: function (v) { tt.hienSo = v; P.veLai(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, chuThich([[rgbaTu(DUONG, .9), "giá trị dương"], [rgbaTu(AM, .9), "giá trị âm"],
                           [V.mau("ba"), "neuron đang được tính"]]), cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Một mạng lan truyền tiến chỉ làm đúng hai phép, lặp đi lặp lại:</b>" +
          "<ol><li><b>Tổng có trọng số</b> — <code>z = w₁a₁ + w₂a₂ + … + b</code>. " +
          "Đây là phép tuyến tính; ghép bao nhiêu lớp tuyến tính liên tiếp cũng vẫn chỉ " +
          "tương đương <i>một</i> lớp tuyến tính.</li>" +
          "<li><b>Hàm kích hoạt</b> — <code>a = tanh(z)</code>. Đây là chỗ <b>duy nhất</b> " +
          "phi tuyến xuất hiện, và nó là lý do mạng nhiều lớp mạnh hơn một lớp.</li></ol>" +
          "★ Hãy bấm <b>⏭ Một bước</b> tám lần và đọc dòng công thức dưới hình: bạn sẽ thấy " +
          "<b>không có gì bí ẩn cả</b> — chỉ là nhân, cộng, rồi bóp qua một hàm.<br>" +
          "<b>★ Hình dưới giải thích lớp ẩn thứ nhất làm gì.</b> Mỗi neuron ở lớp 1 nhận " +
          "<code>w₁x₁ + w₂x₂ + b</code>, và tập điểm có <code>z = 0</code> là một " +
          "<b>đường thẳng</b>. Nên lớp 1 chỉ đơn giản là <i>vẽ mấy đường thẳng lên mặt phẳng đầu vào</i>. " +
          "Các lớp sau ghép những nửa mặt phẳng ấy lại thành vùng phức tạp hơn.<br>" +
          "<b>Thử ba việc:</b><ul>" +
          "<li>Đổi sang <b>ReLU</b>: các neuron có <code>z &lt; 0</code> tắt hẳn về 0 " +
          "(ô xám nhạt). Một phần mạng <b>không dẫn tín hiệu</b> với đầu vào này — đó là " +
          "tính thưa của ReLU, và cũng là nguồn của bệnh <i>neuron chết</i>.</li>" +
          "<li>Đổi sang <b>sigmoid</b>: mọi giá trị bị ép vào (0, 1), không còn giá trị âm. " +
          "Với mạng sâu, đạo hàm sigmoid ≤ 0,25 nên gradient teo rất nhanh — demo huấn luyện " +
          "kế tiếp cho bạn nhìn thấy điều đó bằng số.</li>" +
          "<li>Kéo <b>x₁ về hai cực</b>: với tanh, các neuron bão hoà về ±1 và " +
          "<b>ngừng phản ứng</b> — đầu ra gần như không đổi dù đầu vào vẫn đổi.</li></ul>"
      });
      lam();
    }
  });

  /* ================================================================
     B. Huan luyen — forward, backward, cap nhat tham so
     ================================================================ */
  demo({
    id: "huan-luyen-mlp", nhom: "Kiến trúc mạng", mon: "M05",
    ten: "Huấn luyện — nhìn tham số được cập nhật từng bước",
    moTa: "Vòng lặp <b>tiến → mất mát → lùi → cập nhật</b> chạy thật. " +
          "Xem ranh giới quyết định biến dạng, và xem <b>gradient teo dần theo lớp</b>.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-04-lan-truyen-nguoc">M05.04 — Lan truyền ngược</a> · ' +
             '<a href="../web/index.html#/bai/m05-bai-09-thuat-toan-toi-uu-hien-dai">M05.09 — Thuật toán tối ưu</a>',
    dung: function (host) {
      var W = 340, H = 330, W2 = 580, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var tt = { lr: 0.08, toiUu: "adam", lo: 16, sau: 2, kh: "tanh",
                 batch: 16, khoiTao: 1.0, soBuoc: 1200, hat: 5, nhieu: 0.18 };
      var CO, Wt, B, mW, vW, mB, vB, DL, r, X, Y, lichSu, buocT, gradLop;

      /* ---- du lieu hai vong trang (two moons) ---- */
      function sinhDuLieu() {
        var n = 200, i;
        X = []; Y = [];
        for (i = 0; i < n; i++) {
          var t = r() * Math.PI, lop = i % 2;
          var x, y;
          if (lop === 0) { x = Math.cos(t); y = Math.sin(t) - 0.25; }
          else { x = 1 - Math.cos(t); y = -Math.sin(t) + 0.25; }
          X.push([x + r.chuan() * tt.nhieu, y + r.chuan() * tt.nhieu]);
          Y.push(lop);
        }
      }

      function kichHoat(v) {
        if (tt.kh === "relu") return v > 0 ? v : 0;
        if (tt.kh === "sigmoid") return 1 / (1 + Math.exp(-v));
        return Math.tanh(v);
      }
      function dKichHoat(a) {              /* dao ham tinh TU dau ra a */
        if (tt.kh === "relu") return a > 0 ? 1 : 0;
        if (tt.kh === "sigmoid") return a * (1 - a);
        return 1 - a * a;
      }

      function datLai() {
        r = V.rng(tt.hat * 29 + 11);
        sinhDuLieu();
        CO = [2];
        for (var s = 0; s < tt.sau; s++) CO.push(tt.lo);
        CO.push(1);
        Wt = []; B = []; mW = []; vW = []; mB = []; vB = [];
        for (var l = 1; l < CO.length; l++) {
          var w = [], b = [], m = [], v2 = [], mb = [], vb = [], i, j;
          for (i = 0; i < CO[l]; i++) {
            var h = [], hm = [], hv = [];
            for (j = 0; j < CO[l - 1]; j++) {
              h.push(r.chuan() * tt.khoiTao * Math.sqrt(2 / CO[l - 1]));
              hm.push(0); hv.push(0);
            }
            w.push(h); m.push(hm); v2.push(hv); b.push(0); mb.push(0); vb.push(0);
          }
          Wt.push(w); B.push(b); mW.push(m); vW.push(v2); mB.push(mb); vB.push(vb);
        }
        lichSu = []; buocT = 0; gradLop = new Array(CO.length - 1).fill(0);
      }

      function tien(x) {
        var a = [x], l, i, j;
        for (l = 1; l < CO.length; l++) {
          var ra = [];
          for (i = 0; i < CO[l]; i++) {
            var s = B[l - 1][i];
            for (j = 0; j < CO[l - 1]; j++) s += Wt[l - 1][i][j] * a[l - 1][j];
            ra.push(l === CO.length - 1 ? 1 / (1 + Math.exp(-s)) : kichHoat(s));
          }
          a.push(ra);
        }
        return a;
      }

      /* MOT buoc = MOT minibatch: tien -> mat mat -> lui -> cap nhat */
      function buoc() {
        if (buocT >= tt.soBuoc) return false;
        var L = CO.length - 1, l, i, j, k;
        var gW = [], gB = [];
        for (l = 0; l < L; l++) {
          var w = [], b = [];
          for (i = 0; i < CO[l + 1]; i++) {
            w.push(new Array(CO[l]).fill(0)); b.push(0);
          }
          gW.push(w); gB.push(b);
        }
        var mat = 0, dung = 0;
        var chuan = new Array(L).fill(0);

        for (k = 0; k < tt.batch; k++) {
          var idx = Math.floor(r() * X.length);
          var a = tien(X[idx]), y = Y[idx];
          var p = Math.min(1 - 1e-7, Math.max(1e-7, a[L][0]));
          mat += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
          if ((p > 0.5 ? 1 : 0) === y) dung++;
          /* delta lop cuoi: BCE + sigmoid => p - y */
          var d = [p - y];
          for (l = L; l >= 1; l--) {
            for (i = 0; i < CO[l]; i++) {
              gB[l - 1][i] += d[i];
              for (j = 0; j < CO[l - 1]; j++) gW[l - 1][i][j] += d[i] * a[l - 1][j];
              chuan[l - 1] += d[i] * d[i];
            }
            if (l > 1) {
              var dt = new Array(CO[l - 1]).fill(0);
              for (j = 0; j < CO[l - 1]; j++) {
                var s2 = 0;
                for (i = 0; i < CO[l]; i++) s2 += Wt[l - 1][i][j] * d[i];
                dt[j] = s2 * dKichHoat(a[l - 1][j]);
              }
              d = dt;
            }
          }
        }
        for (l = 0; l < L; l++) gradLop[l] = Math.sqrt(chuan[l] / tt.batch);

        /* cap nhat tham so */
        buocT++;
        var b1 = 0.9, b2 = 0.999, eps = 1e-8;
        for (l = 0; l < L; l++) {
          for (i = 0; i < CO[l + 1]; i++) {
            for (j = 0; j < CO[l]; j++) {
              var gg = gW[l][i][j] / tt.batch;
              if (tt.toiUu === "sgd") {
                Wt[l][i][j] -= tt.lr * gg;
              } else if (tt.toiUu === "momentum") {
                mW[l][i][j] = 0.9 * mW[l][i][j] + gg;
                Wt[l][i][j] -= tt.lr * mW[l][i][j];
              } else {
                mW[l][i][j] = b1 * mW[l][i][j] + (1 - b1) * gg;
                vW[l][i][j] = b2 * vW[l][i][j] + (1 - b2) * gg * gg;
                var mh = mW[l][i][j] / (1 - Math.pow(b1, buocT));
                var vh = vW[l][i][j] / (1 - Math.pow(b2, buocT));
                Wt[l][i][j] -= tt.lr * mh / (Math.sqrt(vh) + eps);
              }
            }
            var gb = gB[l][i] / tt.batch;
            if (tt.toiUu === "sgd") B[l][i] -= tt.lr * gb;
            else if (tt.toiUu === "momentum") {
              mB[l][i] = 0.9 * mB[l][i] + gb; B[l][i] -= tt.lr * mB[l][i];
            } else {
              mB[l][i] = b1 * mB[l][i] + (1 - b1) * gb;
              vB[l][i] = b2 * vB[l][i] + (1 - b2) * gb * gb;
              B[l][i] -= tt.lr * (mB[l][i] / (1 - Math.pow(b1, buocT))) /
                         (Math.sqrt(vB[l][i] / (1 - Math.pow(b2, buocT))) + eps);
            }
          }
        }
        if (buocT % 4 === 0 || buocT === 1) {
          lichSu.push({ mat: mat / tt.batch, dung: dung / tt.batch });
        }
        return true;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W - 16, H - 40), ox = 8, oy = 30, b = 5, i, j;
        var lo = -1.8, hi = 2.8, lo2 = -1.6, hi2 = 1.8;
        for (i = 0; i * b < S; i++) for (j = 0; j * b < S; j++) {
          var x = lo + (i * b / S) * (hi - lo);
          var y = hi2 - (j * b / S) * (hi2 - lo2);
          var p = tien([x, y])[CO.length - 1][0];
          g.fillStyle = p > 0.5 ? rgbaTu(DUONG, 0.12 + (p - 0.5) * 1.1)
                                : rgbaTu(AM, 0.12 + (0.5 - p) * 1.1);
          g.fillRect(ox + i * b, oy + j * b, b + 0.6, b + 0.6);
        }
        X.forEach(function (p, k) {
          var px = ox + (p[0] - lo) / (hi - lo) * S;
          var py = oy + (hi2 - p[1]) / (hi2 - lo2) * S;
          g.fillStyle = Y[k] ? DUONG : AM;
          g.strokeStyle = "#fff"; g.lineWidth = 1;
          g.beginPath(); g.arc(px, py, 3, 0, 6.2832); g.fill(); g.stroke();
        });
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui"; g.textAlign = "left";
        g.fillText("Ranh giới quyết định sau " + buocT + " bước", 8, 20);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var padL = 48, padT = 26, h = 120, w = 300;
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Mất mát (đậm) và độ chính xác (nhạt) theo bước", padL, 16);
        if (lichSu.length > 1) {
          var hi = 0;
          lichSu.forEach(function (p) { hi = Math.max(hi, p.mat); });
          hi = Math.max(hi, 0.8);
          var X2 = function (k) { return padL + k / (lichSu.length - 1) * w; };
          var Y2 = function (v) { return padT + h - Math.min(1, v / hi) * h; };
          var YA = function (v) { return padT + h - v * h; };
          veCong(g2, lichSu.map(function (p) { return p.dung; }), X2, YA, V.mau("tx3"), 1.3);
          veCong(g2, lichSu.map(function (p) { return p.mat; }), X2, Y2, V.mau("ac"), 2.2);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui"; g2.textAlign = "right";
          g2.fillText(hi.toFixed(2), padL - 5, padT + 8);
          g2.fillText("0", padL - 5, padT + h);
          g2.textAlign = "left";
          g2.fillText("100 %", padL + w + 4, padT + 8);
        }

        /* cot do lon gradient theo lop */
        var bx = padL + w + 74, by = padT + 6, bw = 110;
        g2.fillStyle = V.mau("tx"); g2.font = "600 11.5px system-ui"; g2.textAlign = "left";
        g2.fillText("‖gradient‖ theo lớp", bx, by - 10);
        var mx = Math.max.apply(null, gradLop.concat([1e-9]));
        gradLop.forEach(function (v, l) {
          var y = by + l * 20;
          g2.fillStyle = V.mau("bd2"); g2.fillRect(bx, y, bw, 13);
          g2.fillStyle = l === 0 ? V.mau("ba") : V.mau("ac");
          g2.fillRect(bx, y, Math.max(1, bw * v / mx), 13);
          g2.fillStyle = V.mau("tx2"); g2.font = "10px ui-monospace,monospace";
          g2.fillText("L" + (l + 1) + " " + v.toExponential(1), bx + bw + 6, y + 10);
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
        var tyLe = gradLop.length > 1 ? (gradLop[gradLop.length - 1] / Math.max(1e-12, gradLop[0])) : 1;
        g2.fillText("lớp cuối / lớp đầu = " + tyLe.toFixed(1) + "×",
                    bx, by + gradLop.length * 20 + 8);

        /* mo ta vong lap */
        g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
        var y0 = padT + h + 34;
        g2.fillText("① tiến: x → mạng → p", padL, y0);
        g2.fillText("② mất mát: −[y·log p + (1−y)·log(1−p)]", padL, y0 + 17);
        g2.fillText("③ lùi: δ cuối = p − y, rồi truyền ngược qua từng lớp", padL, y0 + 34);
        g2.fillStyle = V.mau("ac"); g2.font = "600 11.5px system-ui";
        g2.fillText("④ cập nhật: w ← w − η·(bước do " +
                    (tt.toiUu === "adam" ? "Adam" : tt.toiUu === "momentum" ? "momentum" : "SGD") +
                    " tính)", padL, y0 + 51);
      }

      var P = V.phat({
        toiDa: tt.soBuoc, tocDo: 12,
        datLai: datLai, buoc: buoc,
        ve: function () { ve(); ve2(); capSo(); },
        nhan: function () {
          var d = lichSu.length ? lichSu[lichSu.length - 1] : null;
          return d ? ("mất mát " + d.mat.toFixed(4) + " · đúng " + (d.dung * 100).toFixed(0) + " %") : "";
        }
      });
      function capSo() {
        var d = lichSu.length ? lichSu[lichSu.length - 1] : { mat: 0, dung: 0 };
        var tong = 0;
        for (var l = 1; l < CO.length; l++) tong += CO[l] * CO[l - 1] + CO[l];
        so.dat([
          ["kiến trúc", CO.join("→")],
          ["số tham số", String(tong)],
          ["mất mát", d.mat.toFixed(4)],
          ["độ chính xác", (d.dung * 100).toFixed(1) + " %"],
          ["‖grad‖ lớp đầu", gradLop[0] ? gradLop[0].toExponential(2) : "—"]
        ]);
      }
      function lam() { P.datToiDa(tt.soBuoc); P.datLai(); P.buoc(); }

      var dk = [
        P.dk(),
        V.chon({ ten: "Thuật toán tối ưu", giaTri: tt.toiUu,
                 muc: [{ v: "adam", t: "Adam" }, { v: "momentum", t: "SGD + momentum" },
                       { v: "sgd", t: "SGD thuần" }],
                 doi: function (v) { tt.toiUu = v; lam(); } }),
        V.truot({ ten: "Tốc độ học η", min: 0.001, max: 1.2, buoc: 0.001, giaTri: tt.lr,
                  doi: function (v) { tt.lr = v; lam(); } }),
        V.chon({ ten: "Hàm kích hoạt", giaTri: tt.kh,
                 muc: [{ v: "tanh", t: "tanh" }, { v: "relu", t: "ReLU" }, { v: "sigmoid", t: "sigmoid" }],
                 doi: function (v) { tt.kh = v; lam(); } }),
        V.truot({ ten: "Số lớp ẩn", min: 1, max: 6, buoc: 1, giaTri: tt.sau,
                  doi: function (v) { tt.sau = v; lam(); } }),
        V.truot({ ten: "Số neuron mỗi lớp", min: 2, max: 32, buoc: 1, giaTri: tt.lo,
                  doi: function (v) { tt.lo = v; lam(); } }),
        V.truot({ ten: "Cỡ lô (batch)", min: 1, max: 64, buoc: 1, giaTri: tt.batch,
                  doi: function (v) { tt.batch = v; lam(); } }),
        V.truot({ ten: "Hệ số khởi tạo trọng số", min: 0, max: 3, buoc: 0.05, giaTri: tt.khoiTao,
                  doi: function (v) { tt.khoiTao = v; lam(); } }),
        V.truot({ ten: "Nhiễu dữ liệu", min: 0, max: 0.5, buoc: 0.01, giaTri: tt.nhieu,
                  doi: function (v) { tt.nhieu = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Đây là toàn bộ việc huấn luyện một mạng neuron</b>, không thiếu bước nào: " +
          "lấy một lô dữ liệu → chạy tiến → tính mất mát → lan truyền ngược → cập nhật tham số. " +
          "Lặp lại vài nghìn lần.<br>" +
          "<b>★ Dãy cột \"‖gradient‖ theo lớp\" là thứ đáng nhìn nhất.</b> Nó đo độ lớn tín hiệu " +
          "lỗi khi nó đi ngược về từng lớp. Hãy thử:<ul>" +
          "<li><b>sigmoid + 5–6 lớp ẩn</b>: tỉ số <i>lớp cuối / lớp đầu</i> vọt lên hàng chục " +
          "hoặc hàng trăm lần — nghĩa là lớp đầu gần như <b>không nhận được tín hiệu học</b>. " +
          "Đó chính là <b>gradient tiêu biến</b>, lý do mạng sâu không huấn luyện được " +
          "trước 2010, và lý do ReLU + kết nối tắt ra đời.</li>" +
          "<li>Đổi sang <b>ReLU</b> với cùng độ sâu: tỉ số ấy tụt xuống còn vài lần.</li></ul>" +
          "<b>★ Bốn cách phá huấn luyện — mỗi cách hỏng một kiểu riêng:</b><ul>" +
          "<li><b>η quá lớn</b> (kéo lên 1,0 với SGD): mất mát <b>nảy lên</b> thay vì xuống; " +
          "mỗi bước nhảy qua đáy sang sườn bên kia.</li>" +
          "<li><b>η quá nhỏ</b> (0,001): mất mát xuống đúng hướng nhưng chậm tới mức vô dụng — " +
          "hết ngân sách vẫn chưa học xong.</li>" +
          "<li><b>Khởi tạo = 0</b>: mọi neuron trong một lớp nhận cùng gradient nên <b>mãi mãi " +
          "giống hệt nhau</b>. Mạng 16 neuron hành xử như mạng 1 neuron. Đây là lý do " +
          "khởi tạo phải <i>ngẫu nhiên</i>, không chỉ là \"nhỏ\".</li>" +
          "<li><b>Cỡ lô = 1</b>: đường mất mát nhiễu kinh khủng vì mỗi bước chỉ nhìn một điểm. " +
          "Tăng lên 64: đường mượt hẳn nhưng mỗi bước đắt gấp 64 lần.</li></ul>" +
          "📌 <b>Adam so với SGD:</b> đặt η = 0,005 rồi đổi qua lại. Adam tự chia bước cho " +
          "căn bậc hai của trung bình bình phương gradient, nên nó <b>ít nhạy với η</b> hơn hẳn — " +
          "đó là lý do nó là lựa chọn mặc định khi bạn chưa có thời gian dò tham số."
      });
      lam();
    }
  });

  /* ================================================================
     C. CNN — duong ong tich chap tung o mot
     ================================================================ */
  demo({
    id: "cnn-duong-ong", nhom: "Kiến trúc mạng", mon: "M07",
    ten: "CNN — đi hết đường ống, từng ô một",
    moTa: "Ảnh 16×16 → <b>tích chập</b> 3 bộ lọc → ReLU → <b>gộp cực đại</b> → phẳng → lớp dày. " +
          "Mỗi bước là <b>một ô đầu ra</b>, có phép nhân cộng hiện ra bên cạnh.",
    lienKet: '<a href="../web/index.html#/bai/m05-bai-11-mang-tich-chap-cnn">M05.11 — Mạng tích chập</a> · ' +
             '<a href="../web/index.html#/bai/m07-bai-04-tich-chap-va-hinh-hoc-tensor">M07.04 — Tích chập & hình học tensor</a>',
    dung: function (host) {
      var W = 580, H = 400, W2 = 580, H2 = 150;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var so = hopSo();

      var N = 16, K = 3, M = N - K + 1, Pz = M >> 1;   /* 16 -> 14 -> 7 */
      var LOC = {
        canh: [
          { t: "dọc |", k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]] },
          { t: "ngang —", k: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]] },
          { t: "chấm •", k: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]] }
        ],
        mo: [
          { t: "mờ", k: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]] },
          { t: "nét", k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
          { t: "chéo ╲", k: [[2, 1, 0], [1, 0, -1], [0, -1, -2]] }
        ]
      };
      var tt = { hinh: "chu-t", boLoc: "canh", hienSo: true };
      var anh, fm, pool, dense, buocT;

      function veHinh() {
        var a = [], i, j;
        for (i = 0; i < N; i++) { a.push([]); for (j = 0; j < N; j++) a[i].push(0); }
        function o(i, j, v) { if (i >= 0 && i < N && j >= 0 && j < N) a[i][j] = v; }
        if (tt.hinh === "chu-t") {
          for (j = 3; j < 13; j++) { o(3, j, 1); o(4, j, 1); }
          for (i = 4; i < 13; i++) { o(i, 7, 1); o(i, 8, 1); }
        } else if (tt.hinh === "cheo") {
          for (i = 2; i < 14; i++) { o(i, i, 1); o(i, i + 1, 1); }
        } else if (tt.hinh === "vuong") {
          for (i = 3; i < 13; i++) { o(i, 3, 1); o(i, 12, 1); o(3, i, 1); o(12, i, 1); }
        } else {
          for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
            var dx = i - 7.5, dy = j - 7.5, d = Math.sqrt(dx * dx + dy * dy);
            a[i][j] = (d > 3.5 && d < 5.5) ? 1 : 0;
          }
        }
        return a;
      }

      function datLai() {
        anh = veHinh();
        fm = []; pool = [];
        for (var f = 0; f < 3; f++) {
          var m = [], p = [], i, j;
          for (i = 0; i < M; i++) { m.push(new Array(M).fill(null)); }
          for (i = 0; i < Pz; i++) { p.push(new Array(Pz).fill(null)); }
          fm.push(m); pool.push(p);
        }
        dense = [null, null, null];
        buocT = 0;
      }

      var TONG_CONV = 3 * M * M, TONG_POOL = 3 * Pz * Pz, TONG = TONG_CONV + TONG_POOL + 3;

      function buoc(k) {
        if (k >= TONG) return false;
        buocT = k + 1;
        if (k < TONG_CONV) {
          var f = Math.floor(k / (M * M)), rr = Math.floor((k % (M * M)) / M), cc = k % M;
          var s = 0, ker = LOC[tt.boLoc][f].k, u, v;
          for (u = 0; u < K; u++) for (v = 0; v < K; v++) s += ker[u][v] * anh[rr + u][cc + v];
          fm[f][rr][cc] = s > 0 ? s : 0;                 /* ReLU ngay tai day */
          return true;
        }
        var k2 = k - TONG_CONV;
        if (k2 < TONG_POOL) {
          var f2 = Math.floor(k2 / (Pz * Pz)), r2 = Math.floor((k2 % (Pz * Pz)) / Pz), c2 = k2 % Pz;
          var mx = -1e9, a2, b2;
          for (a2 = 0; a2 < 2; a2++) for (b2 = 0; b2 < 2; b2++) {
            var vv = fm[f2][r2 * 2 + a2][c2 * 2 + b2];
            if (vv !== null && vv > mx) mx = vv;
          }
          pool[f2][r2][c2] = mx;
          return true;
        }
        /* lop day: tong co trong so cua toan bo ban do da gop */
        var d = k2 - TONG_POOL, tong = 0, rg = V.rng(101 + d * 17);
        for (var ff = 0; ff < 3; ff++) for (var i2 = 0; i2 < Pz; i2++) for (var j2 = 0; j2 < Pz; j2++) {
          tong += (pool[ff][i2][j2] || 0) * rg.chuan() * 0.12;
        }
        dense[d] = tong;
        return true;
      }

      function veLuoiO(gg, mt, ox, oy, o, mx, vien) {
        var i, j, n = mt.length;
        for (i = 0; i < n; i++) for (j = 0; j < mt[i].length; j++) {
          var v = mt[i][j];
          gg.fillStyle = v === null ? V.mau("bd2") : V.thangMau(Math.min(1, Math.abs(v) / mx));
          gg.fillRect(ox + j * o, oy + i * o, o - 0.6, o - 0.6);
        }
        if (vien) {
          gg.strokeStyle = V.mau("bd"); gg.lineWidth = 1;
          gg.strokeRect(ox - 0.5, oy - 0.5, mt[0].length * o + 1, n * o + 1);
        }
      }

      function ve(k) {
        g.clearRect(0, 0, W, H);
        var o1 = 10, ox1 = 14, oy1 = 34;
        g.fillStyle = V.mau("tx"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("① ảnh vào 16×16", ox1, oy1 - 8);
        veLuoiO(g, anh, ox1, oy1, o1, 1, true);

        /* cua so 3x3 dang truot */
        if (k < TONG_CONV) {
          var f = Math.floor(k / (M * M)), rr = Math.floor((k % (M * M)) / M), cc = k % M;
          g.strokeStyle = V.mau("ba"); g.lineWidth = 2.4;
          g.strokeRect(ox1 + cc * o1 - 1, oy1 + rr * o1 - 1, K * o1 + 1, K * o1 + 1);
        }

        /* nhan tich chap */
        var kx = ox1 + N * o1 + 22, ky = oy1 + 6;
        var fCur = k < TONG_CONV ? Math.floor(k / (M * M)) : 2;
        g.fillStyle = V.mau("tx2"); g.font = "11px system-ui";
        g.fillText("bộ lọc " + (fCur + 1) + ": " + LOC[tt.boLoc][fCur].t, kx, ky - 6);
        var ker = LOC[tt.boLoc][fCur].k, u, v;
        for (u = 0; u < K; u++) for (v = 0; v < K; v++) {
          g.fillStyle = mauKyLoc(ker[u][v]);
          g.fillRect(kx + v * 20, ky + u * 20, 19, 19);
          g.fillStyle = V.mau("tx"); g.font = "600 9.5px ui-monospace,monospace";
          g.textAlign = "center";
          g.fillText(fmtK(ker[u][v]), kx + v * 20 + 9.5, ky + u * 20 + 13);
          g.textAlign = "left";
        }

        /* ban do dac trung */
        var o2 = 9, ox2 = kx + 78, oy2 = oy1;
        g.fillStyle = V.mau("tx"); g.font = "600 11.5px system-ui";
        g.fillText("② tích chập + ReLU → 3 × 14×14", ox2, oy2 - 8);
        for (var f2 = 0; f2 < 3; f2++) {
          veLuoiO(g, fm[f2], ox2 + f2 * (M * o2 + 10), oy2, o2, 4, true);
        }

        /* gop cuc dai */
        var o3 = 13, oy3 = oy2 + M * o2 + 26;
        g.fillStyle = V.mau("tx"); g.font = "600 11.5px system-ui";
        g.fillText("③ gộp cực đại 2×2 → 3 × 7×7", ox2, oy3 - 8);
        for (var f3 = 0; f3 < 3; f3++) {
          veLuoiO(g, pool[f3], ox2 + f3 * (Pz * o3 + 10), oy3, o3, 4, true);
        }
        if (k >= TONG_CONV && k < TONG_CONV + TONG_POOL) {
          var k2 = k - TONG_CONV, ff = Math.floor(k2 / (Pz * Pz));
          var r2 = Math.floor((k2 % (Pz * Pz)) / Pz), c2 = k2 % Pz;
          g.strokeStyle = V.mau("ba"); g.lineWidth = 2.2;
          g.strokeRect(ox2 + ff * (M * o2 + 10) + c2 * 2 * o2 - 1, oy2 + r2 * 2 * o2 - 1,
                       2 * o2 + 1, 2 * o2 + 1);
          g.strokeRect(ox2 + ff * (Pz * o3 + 10) + c2 * o3 - 1, oy3 + r2 * o3 - 1, o3 + 1, o3 + 1);
        }

        /* lop day */
        var oy4 = oy3 + Pz * o3 + 30;
        g.fillStyle = V.mau("tx"); g.font = "600 11.5px system-ui";
        g.fillText("④ phẳng (147 số) → lớp dày → 3 đầu ra", ox1, oy4 - 8);
        for (var d = 0; d < 3; d++) {
          var x = ox1 + d * 92;
          g.fillStyle = dense[d] === null ? V.mau("bd2") : V.thangMau(Math.min(1, Math.abs(dense[d]) / 6));
          g.fillRect(x, oy4, 84, 22);
          g.fillStyle = V.mau("tx"); g.font = "600 11px ui-monospace,monospace";
          g.fillText("y" + (d + 1) + " = " + (dense[d] === null ? "?" : dense[d].toFixed(2)), x + 7, oy4 + 15);
        }

        /* phep tinh hien tai */
        g.font = "11px ui-monospace,monospace"; g.fillStyle = V.mau("ba");
        var yy = H - 14;
        if (k < TONG_CONV) {
          var f4 = Math.floor(k / (M * M)), r4 = Math.floor((k % (M * M)) / M), c4 = k % M;
          var ker2 = LOC[tt.boLoc][f4].k, ct = "", s = 0;
          for (u = 0; u < K; u++) for (v = 0; v < K; v++) {
            var av = anh[r4 + u][c4 + v];
            if (av !== 0) { ct += (ct ? " + " : "") + fmtK(ker2[u][v]) + "×" + av; }
            s += ker2[u][v] * av;
          }
          g.fillText("ô (" + r4 + "," + c4 + "): " + (ct || "0") + " = " + s.toFixed(2) +
                     "  → ReLU → " + Math.max(0, s).toFixed(2), 14, yy);
        } else if (k < TONG_CONV + TONG_POOL) {
          g.fillText("gộp cực đại: lấy giá trị LỚN NHẤT trong ô vuông 2×2 → " +
                     "kích thước giảm một nửa, đặc trưng mạnh được giữ lại", 14, yy);
        } else {
          g.fillStyle = V.mau("ok");
          g.fillText("Xong đường ống. 16×16 = 256 số → 147 số → 3 số.", 14, yy);
        }
      }
      function fmtK(v) {
        if (Math.abs(v - 1 / 9) < 1e-6) return "⅑";
        return (Math.round(v * 100) / 100).toString();
      }
      function mauKyLoc(v) {
        var t = Math.max(-1, Math.min(1, v / 3));
        return t >= 0 ? rgbaTu(DUONG, 0.1 + 0.7 * t) : rgbaTu(AM, 0.1 + 0.7 * -t);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui"; g2.textAlign = "left";
        g2.fillText("Vì sao tích chập rẻ hơn lớp dày rất nhiều", 14, 18);
        var hang = [
          ["Lớp dày nối 16×16 → 14×14", 256 * 196 + 196],
          ["Tích chập 3×3, 1 bộ lọc", 9 + 1],
          ["Tích chập 3×3, 3 bộ lọc", (9 + 1) * 3]
        ];
        var mx = hang[0][1];
        hang.forEach(function (h, i) {
          var y = 38 + i * 30;
          g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
          g2.fillText(h[0], 14, y + 11);
          g2.fillStyle = V.mau("bd2"); g2.fillRect(250, y, 220, 15);
          g2.fillStyle = i === 0 ? V.mau("loi") : V.mau("ac");
          g2.fillRect(250, y, Math.max(2, 220 * h[1] / mx), 15);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px ui-monospace,monospace";
          g2.fillText(h[1].toLocaleString("vi") + " tham số", 478, y + 11);
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Cùng một bộ 9 số được dùng lại ở cả 196 vị trí — đó là " +
                    "chia sẻ trọng số (weight sharing).", 14, 132);
      }

      var P = V.phat({
        toiDa: TONG, tocDo: 40,
        datLai: datLai, buoc: buoc,
        ve: function (k) { ve(k); ve2(); capSo(k); },
        nhan: function (k) {
          if (k < TONG_CONV) return "tích chập — bộ lọc " + (Math.floor(k / (M * M)) + 1) + "/3";
          if (k < TONG_CONV + TONG_POOL) return "gộp cực đại";
          return k >= TONG ? "xong" : "lớp dày";
        }
      });
      function capSo(k) {
        so.dat([
          ["ảnh vào", N + "×" + N + " = " + (N * N) + " số"],
          ["sau tích chập", "3 × " + M + "×" + M],
          ["sau gộp", "3 × " + Pz + "×" + Pz + " = " + (3 * Pz * Pz)],
          ["tham số tích chập", String(3 * (K * K + 1))],
          ["đã tính", k + " / " + TONG + " ô"]
        ]);
      }
      function lam() { P.datLai(); }

      var dk = [
        P.dk(),
        V.chon({ ten: "Ảnh vào", giaTri: tt.hinh,
                 muc: [{ v: "chu-t", t: "Chữ T" }, { v: "cheo", t: "Đường chéo" },
                       { v: "vuong", t: "Khung vuông" }, { v: "tron", t: "Vòng tròn" }],
                 doi: function (v) { tt.hinh = v; lam(); } }),
        V.chon({ ten: "Bộ ba bộ lọc", giaTri: tt.boLoc,
                 muc: [{ v: "canh", t: "Dò cạnh (dọc · ngang · chấm)" },
                       { v: "mo", t: "Mờ · nét · chéo" }],
                 doi: function (v) { tt.boLoc = v; lam(); } }),
        so
      ];

      V.khung(host, {
        ve: [cv, cv2],
        dieuKhien: dk,
        giaiThich:
          "<b>Một CNN chỉ là bốn phép lặp đi lặp lại</b>, và bạn vừa xem hết cả bốn:" +
          "<ol><li><b>Tích chập</b> — trượt một ô vuông 3×3 khắp ảnh; ở mỗi vị trí nhân từng cặp " +
          "rồi cộng lại. Ô vuông ấy (bộ lọc) <b>không đổi</b> khi trượt.</li>" +
          "<li><b>ReLU</b> — cắt bỏ phần âm. Nhờ nó, \"không thấy cạnh\" và \"thấy cạnh ngược chiều\" " +
          "không bị lẫn thành một.</li>" +
          "<li><b>Gộp cực đại</b> — lấy giá trị lớn nhất trong mỗi ô 2×2. Ảnh nhỏ đi một nửa mỗi chiều, " +
          "và vị trí chính xác của đặc trưng bị làm mờ đi — đó là <b>bất biến dịch chuyển nhỏ</b>.</li>" +
          "<li><b>Lớp dày</b> — trải tất cả thành một vectơ rồi nối đầy đủ để ra quyết định.</li></ol>" +
          "<b>★ Bấm ⏭ Một bước vài chục lần</b> và đọc dòng phép tính cuối hình: bạn sẽ thấy " +
          "bộ lọc \"dọc\" chỉ <b>sáng lên ở đúng những ô có cạnh dọc</b>, còn vùng phẳng cho 0. " +
          "Không ai lập trình nó tìm cạnh dọc — nó tìm cạnh dọc <i>vì các con số trong ô 3×3 là như vậy</i>. " +
          "Trong một CNN thật, chính những con số đó được <b>học</b> bằng đúng vòng lặp ở demo trước.<br>" +
          "<b>★ Hai điều đáng ngạc nhiên, xem ở biểu đồ dưới:</b><ul>" +
          "<li>Một lớp dày nối 16×16 sang 14×14 cần <b>hơn 50 nghìn</b> tham số. " +
          "Ba bộ lọc tích chập cần <b>30</b>. Ít hơn <b>1 700 lần</b>, vì cùng 9 con số " +
          "được dùng lại ở cả 196 vị trí — <b>chia sẻ trọng số</b>.</li>" +
          "<li>Chia sẻ trọng số không chỉ rẻ hơn; nó <b>cài sẵn một giả định đúng</b>: " +
          "một cạnh ở góc trên trái cũng là cạnh khi nó nằm ở góc dưới phải. " +
          "Lớp dày phải học lại điều đó riêng cho từng vị trí.</li></ul>" +
          "⚠️ Đổi ảnh vào sang <b>Đường chéo</b> rồi so bản đồ của bộ lọc \"dọc\" và \"ngang\": " +
          "cả hai đều sáng vừa phải, không cái nào sáng rực. Một cạnh chéo <b>không</b> được " +
          "bộ lọc nào bắt trọn — đó là lý do CNN thật dùng hàng chục bộ lọc mỗi lớp, chứ không phải ba."
      });
      lam();
    }
  });
})();
