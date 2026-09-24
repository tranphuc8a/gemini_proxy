/* =====================================================================
   lab-optimizer.js — Bon thuat toan xuong doc dua tren cung mot mat loi.

   Cung diem xuat phat, cung buoc hoc, cung so buoc. Khac nhau duy nhat
   la cach chung nho lai qua khu. Va do la du de mot cai ve dich con mot
   cai ket o yen ngua mai mai.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* --- Cac mat loi. Moi cai tra ve gia tri va gradient. --- */
  var MAT = {
    "khe-hep": {
      ten: "Khe hẹp — dốc đứng một chiều, thoai thoải chiều kia",
      x0: -1.6, y0: 1.2, pham: 2.2,
      f: function (x, y) { return 0.5 * (x * x + 25 * y * y); },
      g: function (x, y) { return [x, 25 * y]; }
    },
    "rosenbrock": {
      ten: "Rosenbrock — thung lũng chuối, kinh điển của tối ưu hoá",
      x0: -1.2, y0: 1.0, pham: 2.2,
      f: function (x, y) { var a = 1 - x, b = y - x * x; return a * a + 20 * b * b; },
      g: function (x, y) {
        var b = y - x * x;
        return [-2 * (1 - x) - 80 * x * b, 40 * b];
      }
    },
    "yen-ngua": {
      ten: "Yên ngựa — điểm gần như phẳng, bẫy của xuống dốc",
      x0: -0.0015, y0: 1.6, pham: 2.2,
      f: function (x, y) { return x * x - y * y * 0.6; },
      g: function (x, y) { return [2 * x, -1.2 * y]; }
    },
    "nhieu-cuc": {
      ten: "Nhiều cực trị — mặt lỗi gợn sóng",
      x0: -1.7, y0: 1.5, pham: 2.2,
      f: function (x, y) {
        return 0.2 * (x * x + y * y) + Math.sin(3 * x) * Math.cos(3 * y);
      },
      g: function (x, y) {
        return [0.4 * x + 3 * Math.cos(3 * x) * Math.cos(3 * y),
                0.4 * y - 3 * Math.sin(3 * x) * Math.sin(3 * y)];
      }
    },
    "cao-nguyen": {
      ten: "Cao nguyên — gradient gần như bằng 0 trên một vùng rộng",
      x0: -1.8, y0: 1.5, pham: 2.2,
      f: function (x, y) {
        var r = Math.sqrt(x * x + y * y);
        return Math.tanh(r * 1.2) * 2;
      },
      g: function (x, y) {
        var r = Math.sqrt(x * x + y * y) + 1e-9;
        var t = Math.tanh(r * 1.2);
        var d = 2 * 1.2 * (1 - t * t);
        return [d * x / r, d * y / r];
      }
    }
  };

  /* --- Bon thuat toan. Moi cai giu trang thai rieng. --- */
  var THUAT = [
    { ma: "sgd", ten: "SGD thuần", giaiThich: "chỉ đi ngược gradient" },
    { ma: "momentum", ten: "Momentum", giaiThich: "cộng dồn quán tính" },
    { ma: "rmsprop", ten: "RMSProp", giaiThich: "chia cho độ lớn gradient gần đây" },
    { ma: "adam", ten: "Adam", giaiThich: "quán tính + chia độ lớn + hiệu chỉnh lệch" }
  ];

  demo({
    id: "dua-optimizer",
    nhom: "Tối ưu hoá & heuristic",
    mon: "L26",
    ten: "Đua optimizer — cùng mặt lỗi, cùng ngân sách, bốn kết cục",
    moTa: "Bốn thuật toán xuống dốc, <b>cùng điểm xuất phát, cùng bước học, cùng số " +
          "bước</b>. Khác nhau duy nhất là cách chúng nhớ lại quá khứ. Và chừng đó đủ " +
          "để một cái về đích còn một cái kẹt ở yên ngựa mãi mãi.",

    dung: function (host) {
      var K = null, B = null, P = null, BTL = null;
      var tt = null;                    /* trang thai tung thuat toan */
      var lsLoi = null;                 /* lich su loi cua tung thuat toan */
      var viTri = null;                 /* duong di, luu rieng de ve lai sau khi tua */
      var mat = MAT["khe-hep"];
      var mauTh = [];

      var TS = V.thamSo([
        { ma: "mat", ten: "Mặt lỗi", kieu: "chon", gt: "khe-hep",
          muc: Object.keys(MAT).map(function (k) { return { v: k, t: MAT[k].ten }; }) },
        { ma: "buocHoc", ten: "Bước học (learning rate)", kieu: "so",
          min: 0.001, max: 0.3, buoc: 0.001, gt: 0.02,
          moTa: "Kéo lên cho tới khi có cái <b>phát nổ</b>. Mức chịu được của bốn thuật " +
                "toán rất khác nhau — đó là một nửa lý do người ta chọn Adam." },
        { ma: "beta1", ten: "Hệ số quán tính (β₁)", kieu: "so",
          min: 0, max: 0.99, buoc: 0.01, gt: 0.9 },
        { ma: "beta2", ten: "Hệ số trung bình bình phương (β₂)", kieu: "so",
          min: 0.5, max: 0.999, buoc: 0.001, gt: 0.999 },
        { ma: "veDuong", ten: "Vẽ đường đi", kieu: "bat", gt: true }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Khe hẹp",            gt: { mat: "khe-hep", buocHoc: 0.02 } },
          { ten: "Yên ngựa",           gt: { mat: "yen-ngua", buocHoc: 0.02 } },
          { ten: "Rosenbrock",         gt: { mat: "rosenbrock", buocHoc: 0.002 } },
          { ten: "Cao nguyên",         gt: { mat: "cao-nguyen", buocHoc: 0.02 } },
          { ten: "Bước học quá lớn",   gt: { mat: "khe-hep", buocHoc: 0.09 } },
          { ten: "Tắt quán tính",      gt: { mat: "khe-hep", beta1: 0 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.86, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        mat = MAT[G.mat] || MAT["khe-hep"];
        tt = THUAT.map(function () {
          return { x: mat.x0, y: mat.y0, mx: 0, my: 0, vx: 0, vy: 0, t: 0, no: false };
        });
        lsLoi = THUAT.map(function () { return []; });
        mauTh = [V.mau("ac"), V.mau("ba"), V.mau("ok"), V.mau("loi")];

        var chiaY = Math.round(cv.H * 0.62);
        K = V.khungNhieu(cv, { so: 4, cot: 2, le: 10, leTren: 24,
                               leDuoi: cv.H - chiaY, khoang: 8 });
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 32, l: 66 },
          x: { min: 0, max: 100, nhan: "bước", vach: 4, dinhDang: V.soGon },
          y: { min: 1e-6, max: 100, log: true, nhan: "giá trị hàm lỗi",
               dinhDang: function (v) { return v.toExponential(0); } },
          luoi: 4
        });
        BTL = V.bangTichLuy(cv);
      }

      /** Mot buoc cua MOT thuat toan. Cong thuc giong het nhau tru phan
          "nho lai qua khu" — do moi la khac biet that su giua chung. */
      function buocThuat(i, s) {
        if (s.no) return;
        var gr = mat.g(s.x, s.y);
        var gx = gr[0], gy = gr[1];
        var lr = G.buocHoc, b1 = G.beta1, b2 = G.beta2, eps = 1e-8;
        s.t++;

        var dx = 0, dy = 0;
        if (THUAT[i].ma === "sgd") {
          dx = lr * gx; dy = lr * gy;
        } else if (THUAT[i].ma === "momentum") {
          s.vx = b1 * s.vx + gx; s.vy = b1 * s.vy + gy;
          dx = lr * s.vx; dy = lr * s.vy;
        } else if (THUAT[i].ma === "rmsprop") {
          s.mx = b2 * s.mx + (1 - b2) * gx * gx;
          s.my = b2 * s.my + (1 - b2) * gy * gy;
          dx = lr * gx / (Math.sqrt(s.mx) + eps);
          dy = lr * gy / (Math.sqrt(s.my) + eps);
        } else {
          s.vx = b1 * s.vx + (1 - b1) * gx;
          s.vy = b1 * s.vy + (1 - b1) * gy;
          s.mx = b2 * s.mx + (1 - b2) * gx * gx;
          s.my = b2 * s.my + (1 - b2) * gy * gy;
          /* Hieu chinh lech: hai trung binh khoi tao bang 0 nen nhung buoc
             dau bi keo ve 0; chia cho (1 - beta^t) de bu lai. */
          var vhx = s.vx / (1 - Math.pow(b1, s.t));
          var vhy = s.vy / (1 - Math.pow(b1, s.t));
          var mhx = s.mx / (1 - Math.pow(b2, s.t));
          var mhy = s.my / (1 - Math.pow(b2, s.t));
          dx = lr * vhx / (Math.sqrt(mhx) + eps);
          dy = lr * vhy / (Math.sqrt(mhy) + eps);
        }

        s.x -= dx; s.y -= dy;
        if (!isFinite(s.x) || !isFinite(s.y) ||
            Math.abs(s.x) > 1e4 || Math.abs(s.y) > 1e4) {
          s.no = true;
        }
      }

      function motBuoc(k) {
        for (var i = 0; i < THUAT.length; i++) {
          buocThuat(i, tt[i]);
          var L = tt[i].no ? NaN : mat.f(tt[i].x, tt[i].y);
          lsLoi[i].push([k + 1, tt[i].no ? 1e3 : Math.max(1e-7, L)]);
          if (lsLoi[i].length > 5000) lsLoi[i].shift();
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veNenMat(gd) {
        /* Duong dong muc cua mat loi, ve mot lan vao bang tich luy. */
        for (var i = 0; i < K.length; i++) {
          var t = K[i].trong();
          var buoc = 3;
          for (var py = 0; py < t.cao; py += buoc) {
            for (var px = 0; px < t.rong; px += buoc) {
              var wx = (px / t.rong * 2 - 1) * mat.pham;
              var wy = (1 - py / t.cao * 2) * mat.pham;
              var f = mat.f(wx, wy);
              /* Nen log de ca vung phang lan vung doc deu nhin duoc. */
              var u = Math.log(1 + Math.max(0, f)) / Math.log(1 + 60);
              gd.fillStyle = V.thangMau(Math.min(1, u) * 0.75);
              gd.fillRect(t.x + px, t.y + py, buoc, buoc);
            }
          }
        }
      }

      function toaDo(k, wx, wy) {
        var t = k.trong();
        return [t.x + (wx / mat.pham + 1) / 2 * t.rong,
                t.y + (1 - (wy / mat.pham + 1) / 2) * t.cao];
      }

      function ve(k) {
        /* Nen ve MOT lan roi giu — ve lai moi khung se ngon het ngan sach. */
        BTL.toi(1, veNenMat);

        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        BTL.dan();

        for (var i = 0; i < THUAT.length; i++) {
          var kh = K[i], s = tt[i];
          kh.vien();

          if (G.veDuong && lsLoi[i].length > 1) {
            g.save();
            g.strokeStyle = mauTh[i];
            g.lineWidth = 1.8; g.lineJoin = "round";
            g.beginPath();
            var daBatDau = false;
            /* Ve lai duong di tu lich su vi tri — luu rieng de tua duoc. */
            for (var q = 0; q < viTri[i].length && q <= k; q++) {
              var p = toaDo(kh, viTri[i][q][0], viTri[i][q][1]);
              if (!daBatDau) { g.moveTo(p[0], p[1]); daBatDau = true; }
              else g.lineTo(p[0], p[1]);
            }
            g.stroke();
            g.restore();
          }

          /* Diem hien tai. */
          if (!s.no) {
            var pc = toaDo(kh, s.x, s.y);
            g.fillStyle = mauTh[i];
            g.beginPath(); g.arc(pc[0], pc[1], 4.5, 0, 6.2832); g.fill();
            g.strokeStyle = V.mau("surf"); g.lineWidth = 1.5; g.stroke();
          }

          kh.nhan(THUAT[i].ten, mauTh[i]);
          var L = s.no ? Infinity : mat.f(s.x, s.y);
          kh.soPhu(s.no ? "PHÁT NỔ" : L.toExponential(1),
                   s.no ? V.mau("loi") : V.mau("tx3"));
        }

        /* --- duong loi chung --- */
        var tran = Math.max(40, k);
        B.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                y: { min: 1e-6, max: 100, log: true, nhan: "giá trị hàm lỗi",
                     dinhDang: function (v) { return v.toExponential(0); } } });
        B.truc();
        for (i = 0; i < THUAT.length; i++) B.duong(lsLoi[i], mauTh[i], 1.8);

        var bang = { "Mặt lỗi": mat.ten.split(" — ")[0], "Bước học": G.buocHoc.toFixed(3),
                     "Bước đã đi": k.toLocaleString("vi") };
        for (i = 0; i < THUAT.length; i++) {
          var s2 = tt[i];
          bang[THUAT[i].ten] = s2.no ? "phát nổ"
            : (mat.f(s2.x, s2.y)).toExponential(2) +
              "   tại (" + s2.x.toFixed(2) + ", " + s2.y.toFixed(2) + ")";
        }
        S.dat(bang);
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        viTri = THUAT.map(function () { return []; });
        P.datToiDa(3000);
        P.datTocDo(30);
        ghiChu.innerHTML = "";
        THUAT.forEach(function (t, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauTh[i] }),
            t.ten + " — " + t.giaiThich
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "dua-optimizer",
        bang: cv,
        tocDo: 30,
        buoc: function (k) {
          motBuoc(k);
          for (var i = 0; i < THUAT.length; i++) {
            viTri[i].push([tt[i].x, tt[i].y]);
            if (viTri[i].length > 5000) viTri[i].shift();
          }
          return true;
        },
        datLai: function () {
          chuanBi();
          viTri = THUAT.map(function () { return []; });
        },
        ve: ve,
        nhan: function (k) {
          var tot = -1, nho = Infinity;
          for (var i = 0; i < THUAT.length; i++) {
            if (tt[i].no) continue;
            var L = mat.f(tt[i].x, tt[i].y);
            if (L < nho) { nho = L; tot = i; }
          }
          return tot >= 0 ? ("đang dẫn: " + THUAT[tot].ten) : "cả bốn đều nổ";
        }
      });

      var r = V.khung(host, {
        ten: "dua-optimizer",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Bốn thuật toán, cùng một công thức khung:</b> <code>θ ← θ − lr · (bước đi)</code>. " +
          "Khác biệt duy nhất nằm ở chỗ tính “bước đi”:" +
          "<ul>" +
          "<li><b>SGD</b> — bước đi = chính gradient. Không nhớ gì cả.</li>" +
          "<li><b>Momentum</b> — cộng dồn gradient cũ, như hòn bi lăn có quán tính.</li>" +
          "<li><b>RMSProp</b> — chia gradient cho căn của trung bình bình phương gần đây. " +
          "Chiều nào gradient hay lớn thì bước ngắn lại, chiều nào bé thì bước dài ra.</li>" +
          "<li><b>Adam</b> — cả hai ý trên, cộng thêm hiệu chỉnh lệch cho những bước đầu.</li>" +
          "</ul>" +
          "<b>Từng mặt lỗi cho một bài học khác nhau:</b>" +
          "<ul>" +
          "<li><b>Khe hẹp</b> — dốc gấp 25 lần theo một chiều. SGD và Momentum " +
          "<b>lượn zigzag</b> dữ dội theo chiều dốc trong khi bò rất chậm theo chiều thoải. " +
          "RMSProp và Adam chia theo độ lớn gradient nên đi gần như thẳng. Đây là lý do " +
          "chính khiến Adam phổ biến: nó <i>tự chỉnh bước học riêng cho từng chiều</i>.</li>" +
          "<li><b>Yên ngựa</b> — điểm xuất phát gần như đúng trên đỉnh yên, gradient bé xíu. " +
          "SGD gần như <b>đứng im</b>. Momentum và Adam tích luỹ đủ để trượt xuống. Trong " +
          "không gian nhiều chiều, yên ngựa <i>nhiều hơn cực tiểu địa phương rất nhiều</i> — " +
          "đó mới là kẻ thù thật của huấn luyện mạng nơ-ron.</li>" +
          "<li><b>Cao nguyên</b> — gradient gần 0 trên một vùng rộng. RMSProp và Adam chia " +
          "cho một số nhỏ nên <b>vẫn đi được</b>; SGD gần như bất động.</li>" +
          "<li><b>Bước học quá lớn</b> — bấm preset đó. Xem cái nào nổ trước. Ngưỡng chịu " +
          "đựng của bốn thuật toán khác nhau rất xa, và đó là nửa còn lại của lý do người ta " +
          "chọn Adam: nó tha thứ cho việc chỉnh sai bước học.</li>" +
          "<li><b>Tắt quán tính</b> (β₁ = 0): Momentum thoái hoá thành SGD, Adam thành " +
          "RMSProp. Hai cặp đường trùng nhau — cách kiểm tra rằng bạn hiểu đúng công thức.</li>" +
          "</ul>" +
          "<b>Không có thuật toán nào thắng mọi nơi.</b> Trên Rosenbrock với bước học nhỏ, " +
          "Momentum thường về đích trước Adam. Đây là điều mà một bảng xếp hạng đơn lẻ " +
          "không bao giờ nói cho bạn."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
