/* =====================================================================
   lab-giamchieu.js — Bon cach nen du lieu nhieu chieu xuong hai chieu.

   PCA · MDS (SMACOF) · t-SNE · chieu ngau nhien.

   Dieu quan trong nhat ma lab nay muon chi ra: KHONG MOT HINH NAO TRONG
   BON LA "du lieu that". Moi hinh la mot phep chieu co mat mat, va moi
   phep bo mot thu khac nhau. t-SNE giu lang gieng gan nhung PHA VO
   khoang cach toan cuc — va tren du lieu hoan toan khong co cum, no van
   ve ra cac cum tron treo. Hai con so duoi bieu do do dung dieu do.

   Ghi chu trung thuc: ban dau ke hoach viet "t-SNE vs UMAP vs PCA".
   UMAP khong duoc cai o day — no doi mot bo phan mem hoc dai so cung
   toi uu hoa rieng, va viet tay mot thu roi DAN NHAN "UMAP" trong khi no
   khong phai UMAP la noi doi nguoi hoc. Thay vao do dung MDS co dien va
   chieu ngau nhien, hai thu deu viet dung duoc trong vai chuc dong va
   deu day duoc mot luan diem rieng.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     Cac bo du lieu. Moi bo tra ve { X (N x D), nhan (so), lienTuc }.
     `lienTuc` = to mau theo thang lien tuc thay vi theo cum roi rac.
     ================================================================== */
  var BO = {
    "ba-cum": {
      ten: "Ba cụm tách hẳn nhau",
      ghi: "trường hợp dễ — cụm là thật, cả bốn cách đều phải thấy",
      tao: function (N, D, R) {
        var X = [], nh = [];
        var tam = [];
        for (var c = 0; c < 3; c++) {
          var t = new Float64Array(D);
          for (var d = 0; d < D; d++) t[d] = R.chuan() * 6;
          tam.push(t);
        }
        for (var i = 0; i < N; i++) {
          var c2 = i % 3, v = new Float64Array(D);
          for (var d2 = 0; d2 < D; d2++) v[d2] = tam[c2][d2] + R.chuan();
          X.push(v); nh.push(c2);
        }
        return { X: X, nhan: nh, lienTuc: false };
      }
    },
    "cau-deu": {
      ten: "★ Quả cầu đều — KHÔNG có cụm nào cả",
      ghi: "sự thật: một khối liền, không đường nứt nào",
      tao: function (N, D, R) {
        var X = [], nh = [];
        for (var i = 0; i < N; i++) {
          var v = new Float64Array(D), s = 0, d;
          for (d = 0; d < D; d++) { v[d] = R.chuan(); s += v[d] * v[d]; }
          s = Math.sqrt(s);
          var r = Math.pow(R(), 1 / D);       /* đều theo thể tích */
          for (d = 0; d < D; d++) v[d] = v[d] / s * r;
          X.push(v); nh.push(r);              /* tô theo bán kính */
        }
        return { X: X, nhan: nh, lienTuc: true };
      }
    },
    "hai-vo": {
      ten: "Hai vỏ cầu lồng nhau",
      ghi: "PCA chịu thua — hai vỏ chồng lên nhau khi chiếu phẳng",
      tao: function (N, D, R) {
        var X = [], nh = [];
        for (var i = 0; i < N; i++) {
          var lop = i % 2, v = new Float64Array(D), s = 0, d;
          for (d = 0; d < D; d++) { v[d] = R.chuan(); s += v[d] * v[d]; }
          s = Math.sqrt(s);
          var r = (lop ? 3.2 : 1) + R.chuan() * 0.06;
          for (d = 0; d < D; d++) v[d] = v[d] / s * r;
          X.push(v); nh.push(lop);
        }
        return { X: X, nhan: nh, lienTuc: false };
      }
    },
    "chu-s": {
      ten: "Dải chữ S cuộn trong không gian nhiều chiều",
      ghi: "một tấm 2 chiều bị uốn cong — bài toán “đa tạp”",
      tao: function (N, D, R) {
        var X = [], nh = [];
        /* Tao trong 3 chieu roi QUAY ngau nhien len D chieu + them nhieu. */
        var Q = [];
        for (var k = 0; k < 3; k++) {
          var h = new Float64Array(D);
          for (var d = 0; d < D; d++) h[d] = R.chuan();
          Q.push(h);
        }
        for (var i = 0; i < N; i++) {
          var t = R() * 3 * Math.PI - 1.5 * Math.PI;
          var a = Math.sin(t), b = 2 * (t > 0 ? 1 : -1) * (Math.cos(t) - 1);
          var c = R() * 4 - 2;
          var v = new Float64Array(D);
          for (var d2 = 0; d2 < D; d2++) {
            v[d2] = a * Q[0][d2] + b * Q[1][d2] + c * Q[2][d2] + R.chuan() * 0.03;
          }
          X.push(v);
          nh.push((t + 1.5 * Math.PI) / (3 * Math.PI));
        }
        return { X: X, nhan: nh, lienTuc: true };
      }
    },
    "luoi": {
      ten: "Lưới vuông đều, bị quay lên nhiều chiều",
      ghi: "sự thật là một tấm lưới — xem cách nào vẽ lại đúng ô vuông",
      tao: function (N, D, R) {
        var canh = Math.max(3, Math.round(Math.sqrt(N)));
        var X = [], nh = [];
        var Q = [];
        for (var k = 0; k < 2; k++) {
          var h = new Float64Array(D);
          for (var d = 0; d < D; d++) h[d] = R.chuan();
          Q.push(h);
        }
        for (var i = 0; i < canh * canh && X.length < N; i++) {
          var cx = (i % canh) / (canh - 1) * 2 - 1;
          var cy = ((i / canh) | 0) / (canh - 1) * 2 - 1;
          var v = new Float64Array(D);
          for (var d2 = 0; d2 < D; d2++) {
            v[d2] = cx * Q[0][d2] + cy * Q[1][d2] + R.chuan() * 0.01;
          }
          X.push(v);
          nh.push((cx + 1) / 2 * 0.5 + (cy + 1) / 2 * 0.5);
        }
        return { X: X, nhan: nh, lienTuc: true, canh: canh };
      }
    }
  };

  var PP = [
    { ma: "pca",  ten: "PCA",              ghi: "hai hướng biến thiên mạnh nhất — tuyến tính, tất định" },
    { ma: "mds",  ten: "MDS (SMACOF)",     ghi: "ép mọi khoảng cách 2 chiều khớp khoảng cách gốc" },
    { ma: "tsne", ten: "t-SNE",            ghi: "chỉ giữ láng giềng gần; khoảng cách xa bị vứt bỏ" },
    { ma: "rp",   ten: "Chiếu ngẫu nhiên", ghi: "một ma trận ngẫu nhiên, không học gì cả" }
  ];

  demo({
    id: "giam-chieu",
    nhom: "Học máy & dữ liệu",
    mon: "L28",
    ten: "Giảm chiều — và cái cụm không có thật",
    moTa: "Bốn cách nén cùng một bộ dữ liệu nhiều chiều xuống mặt phẳng. Chọn bộ " +
          "<b>“Quả cầu đều”</b>: dữ liệu là một khối liền, <b>không có cụm nào</b> — " +
          "vậy mà t-SNE vẫn vẽ ra các cụm tròn trịa. Hai con số dưới biểu đồ đo đúng " +
          "chỗ mỗi phép chiếu nói thật và chỗ nó bịa.",

    dung: function (host) {
      var K = null, B = null, P = null;
      var N = 0, D = 0;
      var X = null, nhanGoc = null, lienTuc = false;
      var dGoc = null;                  /* khoang cach goc, dang tam giac day du */
      var lgGoc = null;                 /* k lang gieng gan nhat trong khong gian goc */
      var capMau = null;                /* cap diem lay mau de do tuong quan toan cuc */
      var Y = null;                     /* nhung 2 chieu cua tung phuong phap */
      var trangThai = null;
      var chiSo = null;                 /* [{giu, tuongQuan}] cho tung phuong phap */
      var mauPP = [];
      var buocDem = 0;
      var canhLuoi = 0;              /* canh cua bo "luoi", de noi diem cho dung */
      /* Bo dem dung lai — ma tran N x N cap phat moi buoc se sinh hang megabyte
         rac moi giay, va tua (dien lai hang tram buoc) se khong chiu noi. */
      var demNN = null, demXY = null, demK = null, demKd = null;

      var TS = V.thamSo([
        { ma: "bo", ten: "Bộ dữ liệu", kieu: "chon", gt: "ba-cum",
          muc: Object.keys(BO).map(function (k) { return { v: k, t: BO[k].ten }; }) },
        { ma: "soDiem", ten: "Số điểm", kieu: "so", min: 60, max: 600, buoc: 30, gt: 300,
          moTa: "t-SNE và MDS đều tốn <b>N² phép</b> mỗi bước, nên tăng số điểm " +
                "làm chậm rất nhanh." },
        { ma: "soChieu", ten: "Số chiều gốc", kieu: "so", min: 3, max: 100, buoc: 1, gt: 30 },
        { ma: "perp", ten: "Perplexity (t-SNE)", kieu: "so", min: 3, max: 80, buoc: 1, gt: 30,
          moTa: "Đại khái là “t-SNE coi mỗi điểm có bao nhiêu láng giềng”. " +
                "<b>Đổi số này thì hình đổi hẳn</b> — đó cũng là lý do không nên " +
                "đọc hình t-SNE như đọc bản đồ." },
        { ma: "k", ten: "k — số láng giềng dùng để chấm điểm", kieu: "so",
          min: 3, max: 40, buoc: 1, gt: 10 },
        { ma: "noiLuoi", ten: "Nối các điểm lưới liền kề", kieu: "bat", gt: false,
          hien: function (G) { return G.bo === "luoi"; },
          moTa: "Chỉ có ở bộ “Lưới”. Bật lên để thấy phép chiếu nào <b>xé rách</b> lưới." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 7 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ Quả cầu đều — cụm ma", gt: { bo: "cau-deu", soDiem: 300, perp: 30 } },
          { ten: "Ba cụm — trường hợp dễ", gt: { bo: "ba-cum" } },
          { ten: "Hai vỏ cầu",             gt: { bo: "hai-vo" } },
          { ten: "Dải chữ S",              gt: { bo: "chu-s" } },
          { ten: "Lưới bị xé",             gt: { bo: "luoi", soDiem: 400, noiLuoi: true } },
          { ten: "Perplexity quá nhỏ",     gt: { bo: "cau-deu", perp: 5 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.92, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ==============================================================
         Chuan bi du lieu va cac cau truc phu
         ============================================================== */
      function chuanBi() {
        var R = V.rng(Math.round(G.hat) || 1);
        N = Math.round(G.soDiem);
        D = Math.round(G.soChieu);
        var bo = BO[G.bo] || BO["ba-cum"];
        var dl = bo.tao(N, D, R);
        X = dl.X; nhanGoc = dl.nhan; lienTuc = dl.lienTuc;
        canhLuoi = dl.canh || 0;
        N = X.length;                   /* bo "luoi" co the tra ve it hon */
        buocDem = 0;
        mauPP = [V.mau("ac"), V.mau("ba"), V.mau("loi"), V.mau("tx3")];

        /* --- khoang cach goc, luu day du de khoi tinh lai --- */
        demNN = new Float64Array(N * N);
        demXY = new Float64Array(N * 2);
        dGoc = new Float64Array(N * N);
        for (var i = 0; i < N; i++) {
          for (var j = i + 1; j < N; j++) {
            var s = 0;
            for (var d = 0; d < D; d++) { var t = X[i][d] - X[j][d]; s += t * t; }
            s = Math.sqrt(s);
            dGoc[i * N + j] = s; dGoc[j * N + i] = s;
          }
        }

        /* --- k lang gieng gan nhat trong khong gian goc --- */
        var k = Math.min(Math.round(G.k), N - 1);
        demK = new Int32Array(k); demKd = new Float64Array(k);
        lgGoc = [];
        for (i = 0; i < N; i++) {
          kGanNhat(dGoc, i, k, demK, demKd);
          lgGoc.push(new Int32Array(demK));
        }

        /* --- mau cap de do tuong quan khoang cach toan cuc ---
           Lay mau co dinh theo hat giong, de con so on dinh giua cac khung. */
        var Rm = V.rng(12345 + N);
        var soCap = Math.min(3000, (N * (N - 1)) / 2);
        capMau = new Int32Array(soCap * 2);
        for (i = 0; i < soCap; i++) {
          var a = Math.floor(Rm() * N), b = Math.floor(Rm() * N);
          if (a === b) b = (b + 1) % N;
          capMau[i * 2] = a; capMau[i * 2 + 1] = b;
        }

        /* --- khoi tao tung phuong phap --- */
        Y = []; trangThai = []; chiSo = [];
        var Rk = V.rng(999 + Math.round(G.hat));
        for (var p = 0; p < PP.length; p++) {
          var y = new Float64Array(N * 2);
          for (i = 0; i < N * 2; i++) y[i] = Rk.chuan() * 1e-2;
          Y.push(y);
          trangThai.push({});
          chiSo.push({ giu: 0, tuongQuan: 0 });
        }
        khoiTaoPCA();
        khoiTaoTSNE();
        chieuNgauNhien();
        doChiSo();
      }

      /** k chi so gan nhat cua diem i theo ma tran khoang cach `M`, ghi vao `ra`.
          Chon truc tiep k phan tu nho nhat thay vi sap xep ca hang: voi k = 10
          va N = 600 thi re hon han, va quan trong hon la KHONG cap phat gi. */
      function kGanNhat(M, i, k, ra, kc) {
        var so = 0, q;
        for (var j = 0; j < N; j++) {
          if (j === i) continue;
          var v = M[i * N + j];
          if (so < k) {
            q = so++;
          } else {
            if (v >= kc[k - 1]) continue;
            q = k - 1;
          }
          while (q > 0 && kc[q - 1] > v) { kc[q] = kc[q - 1]; ra[q] = ra[q - 1]; q--; }
          kc[q] = v; ra[q] = j;
        }
        return so;
      }

      /* ==============================================================
         1. PCA — lap luy thua tren ma tran hiep phuong sai, co khu bo
            phan da tim duoc. Lam theo tung buoc de xem no HOI TU.
         ============================================================== */
      function khoiTaoPCA() {
        var tb = new Float64Array(D);
        var i, d;
        for (i = 0; i < N; i++) for (d = 0; d < D; d++) tb[d] += X[i][d];
        for (d = 0; d < D; d++) tb[d] /= N;
        var Xc = [];
        for (i = 0; i < N; i++) {
          var v = new Float64Array(D);
          for (d = 0; d < D; d++) v[d] = X[i][d] - tb[d];
          Xc.push(v);
        }
        var R = V.rng(31 + Math.round(G.hat));
        var truc = [];
        for (var a = 0; a < 2; a++) {
          var u = new Float64Array(D);
          for (d = 0; d < D; d++) u[d] = R.chuan();
          truc.push(chuanHoa(u));
        }
        trangThai[0] = { Xc: Xc, truc: truc, gt: [0, 0] };
      }

      function buocPCA() {
        var s = trangThai[0], i, d, a;
        for (a = 0; a < 2; a++) {
          /* w = Cov · u, tinh qua X^T (X u) de khoi dung ma tran D x D. */
          var u = s.truc[a];
          var t = new Float64Array(N);
          for (i = 0; i < N; i++) {
            var acc = 0, xi = s.Xc[i];
            for (d = 0; d < D; d++) acc += xi[d] * u[d];
            t[i] = acc;
          }
          var w = new Float64Array(D);
          for (i = 0; i < N; i++) {
            var xi2 = s.Xc[i], ti = t[i];
            for (d = 0; d < D; d++) w[d] += xi2[d] * ti;
          }
          for (d = 0; d < D; d++) w[d] /= N;
          /* Khu bo cac truc truoc — de truc thu hai khong tut ve truc thu nhat. */
          for (var b = 0; b < a; b++) {
            var pv = s.truc[b], ch = 0;
            for (d = 0; d < D; d++) ch += w[d] * pv[d];
            for (d = 0; d < D; d++) w[d] -= ch * pv[d];
          }
          var dai = 0;
          for (d = 0; d < D; d++) dai += w[d] * w[d];
          s.gt[a] = Math.sqrt(dai);     /* xap xi tri rieng */
          s.truc[a] = chuanHoa(w);
        }
        var y = Y[0];
        for (i = 0; i < N; i++) {
          var p0 = 0, p1 = 0, xi3 = s.Xc[i];
          for (d = 0; d < D; d++) { p0 += xi3[d] * s.truc[0][d]; p1 += xi3[d] * s.truc[1][d]; }
          y[i * 2] = p0; y[i * 2 + 1] = p1;
        }
      }

      function chuanHoa(v) {
        var s = 0, d;
        for (d = 0; d < v.length; d++) s += v[d] * v[d];
        s = Math.sqrt(s) || 1;
        for (d = 0; d < v.length; d++) v[d] /= s;
        return v;
      }

      /* ==============================================================
         2. MDS bang SMACOF. Diem hay cua SMACOF: ung suat KHONG BAO GIO
            tang sau mot vong lap. Lab hien so do len man hinh, va tang
            kiem tra so se doi chieu dung loi hua do.
         ============================================================== */
      function ungSuat(y) {
        var s = 0;
        for (var i = 0; i < N; i++) {
          for (var j = i + 1; j < N; j++) {
            var dx = y[i * 2] - y[j * 2], dy = y[i * 2 + 1] - y[j * 2 + 1];
            var t = Math.sqrt(dx * dx + dy * dy) - dGoc[i * N + j];
            s += t * t;
          }
        }
        return s;
      }

      function buocMDS() {
        var y = Y[1], moi = demXY;
        for (var i = 0; i < N; i++) {
          var sx = 0, sy = 0;
          for (var j = 0; j < N; j++) {
            if (j === i) continue;
            var dx = y[i * 2] - y[j * 2], dy = y[i * 2 + 1] - y[j * 2 + 1];
            var d = Math.sqrt(dx * dx + dy * dy);
            var he = d > 1e-9 ? dGoc[i * N + j] / d : 0;
            sx += y[j * 2] + he * dx;
            sy += y[j * 2 + 1] + he * dy;
          }
          moi[i * 2] = sx / N; moi[i * 2 + 1] = sy / N;
        }
        Y[1] = moi; demXY = y;          /* hoan doi, khong cap phat */
        trangThai[1].us = ungSuat(moi);
      }

      /* ==============================================================
         3. t-SNE. Van Der Maaten & Hinton 2008.
            P tu phan bo Gauss voi sigma do nhi phan cho khop perplexity;
            Q tu phan bo t Student mot bac tu do trong mat phang.
         ============================================================== */
      function khoiTaoTSNE() {
        var perp = Math.min(G.perp, (N - 1) / 3);
        var Pm = new Float64Array(N * N);
        var i, j;
        for (i = 0; i < N; i++) {
          /* Do nhi phan beta = 1/(2 sigma^2) sao cho entropy = log(perp). */
          var lo = -Infinity, hi = Infinity, beta = 1;
          var muc = Math.log(perp);
          var hang = new Float64Array(N);
          for (var lan = 0; lan < 60; lan++) {
            var tong = 0, H = 0;
            for (j = 0; j < N; j++) {
              if (j === i) { hang[j] = 0; continue; }
              var dd = dGoc[i * N + j];
              hang[j] = Math.exp(-dd * dd * beta);
              tong += hang[j];
            }
            if (tong < 1e-12) tong = 1e-12;
            for (j = 0; j < N; j++) {
              if (j === i) continue;
              var pj = hang[j] / tong;
              if (pj > 1e-12) H -= pj * Math.log(pj);
            }
            if (Math.abs(H - muc) < 1e-5) break;
            if (H > muc) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; }
            else          { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
          }
          for (j = 0; j < N; j++) Pm[i * N + j] = j === i ? 0 : hang[j] / tong;
        }
        /* Doi xung hoa va chuan hoa ve tong 1. */
        for (i = 0; i < N; i++) {
          for (j = i + 1; j < N; j++) {
            var v = (Pm[i * N + j] + Pm[j * N + i]) / (2 * N);
            Pm[i * N + j] = v; Pm[j * N + i] = v;
          }
        }
        trangThai[2] = {
          P: Pm, da: new Float64Array(N * 2), loi: new Float64Array(N * 2).fill(1),
          lai: 4, kl: 0                 /* `lai` = phong dai buoc dau */
        };
        var y = Y[2], R = V.rng(77 + Math.round(G.hat));
        for (i = 0; i < N * 2; i++) y[i] = R.chuan() * 1e-2;
      }

      function buocTSNE() {
        var s = trangThai[2], y = Y[2], i, j;
        /* Dung chung `demNN` voi giuLangGieng() duoc, vi ca hai deu ghi kin
           bo dem truoc khi doc. Khong ben nao giu du lieu qua mot loi goi. */
        var num = demNN, Z = 0;
        for (i = 0; i < N; i++) {
          for (j = i + 1; j < N; j++) {
            var dx = y[i * 2] - y[j * 2], dy = y[i * 2 + 1] - y[j * 2 + 1];
            var q = 1 / (1 + dx * dx + dy * dy);
            num[i * N + j] = q; num[j * N + i] = q;
            Z += 2 * q;
          }
        }
        if (Z < 1e-12) Z = 1e-12;

        var gr = new Float64Array(N * 2), kl = 0;
        for (i = 0; i < N; i++) {
          var gx = 0, gy = 0;
          for (j = 0; j < N; j++) {
            if (j === i) continue;
            var nij = num[i * N + j];
            var qij = nij / Z;
            var pij = s.P[i * N + j] * s.lai;
            var he = (pij - qij) * nij;
            gx += he * (y[i * 2] - y[j * 2]);
            gy += he * (y[i * 2 + 1] - y[j * 2 + 1]);
            if (pij > 1e-12) kl += pij * Math.log(pij / Math.max(qij, 1e-12));
          }
          gr[i * 2] = 4 * gx; gr[i * 2 + 1] = 4 * gy;
        }
        s.kl = kl;

        var mm = buocDem < 60 ? 0.5 : 0.8;
        var lr = 120;
        for (i = 0; i < N * 2; i++) {
          /* Loi hoc rieng tung toa do (Jacobs 1988) — khong co no t-SNE bo. */
          s.loi[i] = Math.sign(gr[i]) === Math.sign(s.da[i])
                     ? Math.max(0.05, s.loi[i] * 0.8) : s.loi[i] + 0.2;
          s.da[i] = mm * s.da[i] - lr * s.loi[i] * gr[i];
          y[i] += s.da[i];
        }
        /* Keo ve tam — neu khong ca dam troi di mat. */
        var tx = 0, ty = 0;
        for (i = 0; i < N; i++) { tx += y[i * 2]; ty += y[i * 2 + 1]; }
        tx /= N; ty /= N;
        for (i = 0; i < N; i++) { y[i * 2] -= tx; y[i * 2 + 1] -= ty; }

        if (buocDem === 100) s.lai = 1;   /* tat phong dai */
      }

      /* ==============================================================
         4. Chieu ngau nhien. Mot ma tran Gauss, xong. Bo de
            Johnson-Lindenstrauss noi rang khoang cach van gan nhu duoc
            giu — va con so "tuong quan toan cuc" ben duoi xac nhan dieu
            do, du hinh trong chang ra gi.
         ============================================================== */
      function chieuNgauNhien() {
        var R = V.rng(555 + Math.round(G.hat));
        var A = [new Float64Array(D), new Float64Array(D)];
        for (var a = 0; a < 2; a++) for (var d = 0; d < D; d++) A[a][d] = R.chuan();
        var y = Y[3];
        for (var i = 0; i < N; i++) {
          var p0 = 0, p1 = 0, xi = X[i];
          for (var d2 = 0; d2 < D; d2++) { p0 += xi[d2] * A[0][d2]; p1 += xi[d2] * A[1][d2]; }
          y[i * 2] = p0 / Math.sqrt(D); y[i * 2 + 1] = p1 / Math.sqrt(D);
        }
        trangThai[3] = { xong: true };
      }

      /* ==============================================================
         Hai con so cham diem — day moi la phan doc duoc
         ============================================================== */
      /** Ti le lang gieng gan giu duoc. Do CAU TRUC DIA PHUONG. */
      function giuLangGieng(y) {
        var k = Math.min(Math.round(G.k), N - 1);
        var d2 = demNN, i, j, q;
        for (i = 0; i < N; i++) {
          for (j = i + 1; j < N; j++) {
            var dx = y[i * 2] - y[j * 2], dy = y[i * 2 + 1] - y[j * 2 + 1];
            var v = Math.sqrt(dx * dx + dy * dy);
            d2[i * N + j] = v; d2[j * N + i] = v;
          }
        }
        var tong = 0;
        for (i = 0; i < N; i++) {
          var so = kGanNhat(d2, i, k, demK, demKd), cu = lgGoc[i];
          var trung = 0;
          for (q = 0; q < so; q++) {
            for (var w = 0; w < cu.length; w++) {
              if (cu[w] === demK[q]) { trung++; break; }
            }
          }
          tong += trung / k;
        }
        return tong / N;
      }

      /** Tuong quan Pearson giua khoang cach goc va khoang cach 2 chieu
          tren mot mau cap co dinh. Do CAU TRUC TOAN CUC. */
      function tuongQuanToanCuc(y) {
        var n = capMau.length / 2;
        var sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
        for (var q = 0; q < n; q++) {
          var i = capMau[q * 2], j = capMau[q * 2 + 1];
          var a = dGoc[i * N + j];
          var dx = y[i * 2] - y[j * 2], dy = y[i * 2 + 1] - y[j * 2 + 1];
          var b = Math.sqrt(dx * dx + dy * dy);
          sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
        }
        var tu = n * sab - sa * sb;
        var mau2 = Math.sqrt(Math.max(1e-12, n * saa - sa * sa))
                 * Math.sqrt(Math.max(1e-12, n * sbb - sb * sb));
        return tu / mau2;
      }

      function doChiSo() {
        for (var p = 0; p < PP.length; p++) {
          chiSo[p] = { giu: giuLangGieng(Y[p]), tuongQuan: tuongQuanToanCuc(Y[p]) };
        }
      }

      /* ==============================================================
         Ve
         ============================================================== */
      function mauDiem(i) {
        if (lienTuc) return V.thangMau(Math.min(1, Math.max(0, nhanGoc[i])));
        return [V.mau("ac"), V.mau("ba"), V.mau("ok"), V.mau("loi")][nhanGoc[i] % 4];
      }

      function veKhung(p) {
        var kh = K[p], t = kh.trong(), y = Y[p];
        var i;
        var xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
        for (i = 0; i < N; i++) {
          if (y[i * 2] < xa) xa = y[i * 2];
          if (y[i * 2] > xb) xb = y[i * 2];
          if (y[i * 2 + 1] < ya) ya = y[i * 2 + 1];
          if (y[i * 2 + 1] > yb) yb = y[i * 2 + 1];
        }
        var rx = Math.max(1e-9, xb - xa), ry = Math.max(1e-9, yb - ya);
        /* Giu ti le 1:1 — neu keo gian moi truc rieng thi hinh dang bi boa. */
        var tl = Math.min((t.rong - 18) / rx, (t.cao - 18) / ry);
        var cx = t.x + t.rong / 2, cy = t.y + t.cao / 2;
        function px(i2) { return cx + (y[i2 * 2] - (xa + xb) / 2) * tl; }
        function py(i2) { return cy - (y[i2 * 2 + 1] - (ya + yb) / 2) * tl; }

        kh.vien();

        /* Noi luoi: chi co o bo "luoi", va la cach nhin ro nhat ai xe rach. */
        if (G.noiLuoi && G.bo === "luoi" && canhLuoi > 1) {
          var canh = canhLuoi;
          g.save();
          g.strokeStyle = V.mau("bd2"); g.lineWidth = 0.6; g.globalAlpha = 0.8;
          g.beginPath();
          for (i = 0; i < N; i++) {
            var c = i % canh, r2 = (i / canh) | 0;
            if (c + 1 < canh && i + 1 < N) {
              g.moveTo(px(i), py(i)); g.lineTo(px(i + 1), py(i + 1));
            }
            if (i + canh < N) {
              g.moveTo(px(i), py(i)); g.lineTo(px(i + canh), py(i + canh));
            }
          }
          g.stroke();
          g.restore();
        }

        g.save();
        for (i = 0; i < N; i++) {
          g.fillStyle = mauDiem(i);
          g.beginPath();
          g.arc(px(i), py(i), 2.4, 0, 6.2832);
          g.fill();
        }
        g.restore();

        kh.nhan(PP[p].ten, mauPP[p]);
        kh.soPhu("giữ " + (chiSo[p].giu * 100).toFixed(0) + "%  ·  toàn cục " +
                 chiSo[p].tuongQuan.toFixed(2));
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        for (var p = 0; p < PP.length; p++) veKhung(p);

        /* Bieu do cot: hai chi so, bon phuong phap. */
        B.truc();
        B.moc(1, V.mau("tx3"), "1,00 — giữ trọn vẹn");
        for (p = 0; p < PP.length; p++) {
          B.cot(p + 0.78, Math.max(0, chiSo[p].giu), 0.36, mauPP[p]);
          B.cot(p + 1.22, Math.max(0, chiSo[p].tuongQuan), 0.36, V.mau("bd"));
        }
        g.save();
        g.font = "11px ui-monospace,monospace";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "center"; g.textBaseline = "top";
        for (p = 0; p < PP.length; p++) {
          g.fillText(PP[p].ten, B.px(p + 1), B.y1() + 5);
        }
        g.restore();

        var bang = {
          "Dữ liệu": (BO[G.bo] || BO["ba-cum"]).ten.replace("★ ", ""),
          "Sự thật": (BO[G.bo] || BO["ba-cum"]).ghi,
          "Kích cỡ": N + " điểm × " + D + " chiều",
          "Vòng lặp": buocDem
        };
        for (p = 0; p < PP.length; p++) {
          bang[PP[p].ten] = "giữ láng giềng " + (chiSo[p].giu * 100).toFixed(1) +
                            "%  ·  tương quan toàn cục " + chiSo[p].tuongQuan.toFixed(3);
        }
        if (trangThai[1].us !== undefined) {
          bang["Ứng suất MDS"] = trangThai[1].us.toExponential(3) + "  (SMACOF: không bao giờ tăng)";
        }
        if (trangThai[2]) {
          bang["KL của t-SNE"] = trangThai[2].kl.toFixed(4) +
                                 (trangThai[2].lai > 1 ? "  (đang phóng đại ×4)" : "");
        }
        if (G.bo === "cau-deu") {
          bang["⚑ Nhắc"] = "dữ liệu KHÔNG có cụm — mọi cụm bạn thấy là do thuật toán vẽ ra";
        }
        S.dat(bang);
      }

      /* ==============================================================
         Dieu phoi
         ============================================================== */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        var chiaY = Math.round(cv.H * 0.68);
        K = V.khungNhieu(cv, { so: 4, cot: 2, le: 10, leTren: 22,
                               leDuoi: cv.H - chiaY, khoang: 8 });
        B = V.bieuDo(cv, {
          le: { t: chiaY + 26, r: 18, b: 34, l: 58 },
          x: { min: 0.5, max: PP.length + 0.5, hienSo: false },
          y: { min: 0, max: 1.05, nhan: "điểm (0 → 1)",
               dinhDang: function (v) { return v.toFixed(1); } },
          luoi: 4
        });
        P.datToiDa(600);
        P.datTocDo(12);
        ghiChu.innerHTML = "";
        PP.forEach(function (t, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauPP[i] }),
            t.ten + " — " + t.ghi
          ]));
        });
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + V.mau("bd") }),
          "cột xám = tương quan khoảng cách toàn cục"
        ]));
        P.datLai();
      }

      P = V.phat({
        ten: "giam-chieu",
        bang: cv,
        tocDo: 12,
        buoc: function () {
          buocDem++;
          buocPCA();
          buocMDS();
          buocTSNE();
          /* Chieu ngau nhien khong lap — no xong ngay tu dau. Do la ca y nghia. */
          /* Cham diem la O(N^2) — lam moi buoc thi tua se khong kip. */
          if (buocDem % 10 === 0) doChiSo();
          return buocDem < 600;
        },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          return "vòng " + buocDem +
                 (trangThai && trangThai[2] && trangThai[2].lai > 1 ? " · đang phóng đại" : "");
        }
      });

      var r = V.khung(host, {
        ten: "giam-chieu",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Không hình nào trong bốn hình là “dữ liệu thật”.</b> Dữ liệu sống ở " +
          "hàng chục chiều; mặt phẳng chỉ có hai. Mỗi phép chiếu phải vứt bỏ thứ gì " +
          "đó, và điều đáng học là <i>mỗi phép vứt thứ gì</i>." +
          "<ul>" +
          "<li><b>Cột màu</b> dưới biểu đồ = tỉ lệ <i>k</i> láng giềng gần nhất còn giữ " +
          "được (cấu trúc <b>địa phương</b>). <b>Cột xám</b> = tương quan giữa khoảng " +
          "cách gốc và khoảng cách trên hình (cấu trúc <b>toàn cục</b>).</li>" +
          "<li><b>t-SNE</b> thường cao ở cột màu và <b>thấp ở cột xám</b>. Nó được thiết " +
          "kế đúng như vậy. Hệ quả trực tiếp: trên hình t-SNE, <b>khoảng cách giữa hai " +
          "cụm không có ý nghĩa gì</b>, và kích thước cụm cũng vậy.</li>" +
          "<li><b>Chiếu ngẫu nhiên</b> không học gì cả, vậy mà cột xám của nó thường " +
          "không tệ — đó là bổ đề Johnson–Lindenstrauss: chiếu ngẫu nhiên giữ khoảng " +
          "cách tốt đến bất ngờ.</li>" +
          "</ul>" +
          "<b>Thí nghiệm chính — bấm preset “★ Quả cầu đều”.</b> Dữ liệu là một quả cầu " +
          "đặc, phân bố đều: <b>không có cụm nào, không có đường nứt nào</b>. Nhìn ô " +
          "t-SNE sau vài trăm vòng: nó vẫn tách ra thành những cụm tròn trịa, trông y " +
          "như đã phát hiện ra các nhóm. <b>Những cụm đó không tồn tại.</b> Chúng là sản " +
          "phẩm của thuật toán, không phải của dữ liệu. Đổi <i>perplexity</i> và xem " +
          "chúng đổi hình dạng — thứ gì có thật thì không đổi theo tham số vẽ." +
          "<ul>" +
          "<li><b>PCA</b> chỉ quay và chiếu — tuyến tính, tất định, không bịa được cụm. " +
          "Bù lại nó bó tay với “hai vỏ cầu” và “dải chữ S”, nơi cấu trúc là phi tuyến.</li>" +
          "<li><b>MDS (SMACOF)</b> ép mọi khoảng cách khớp lại. Ứng suất của nó " +
          "<b>không bao giờ tăng</b> sau một vòng lặp — đó là điều SMACOF chứng minh " +
          "được, và bảng số bên cạnh hiện đúng con số ấy để bạn theo dõi.</li>" +
          "<li>Bộ <b>“Lưới”</b> + bật <i>nối các điểm lưới liền kề</i> là phép thử " +
          "khắc nghiệt nhất: sự thật là một tấm lưới vuông đều. Xem cách nào vẽ lại " +
          "được, và cách nào <b>xé rách</b> nó.</li>" +
          "</ul>" +
          "<b>Ghi chú thẳng thắn:</b> bản kế hoạch ban đầu ghi “t-SNE vs UMAP vs PCA”. " +
          "UMAP không có ở đây. Cài UMAP đúng nghĩa cần cả một bộ máy riêng, và viết " +
          "tay một thứ gần giống rồi dán nhãn “UMAP” thì <b>sai với người học</b>. " +
          "MDS và chiếu ngẫu nhiên thay vào chỗ đó: cả hai đều cài được đúng, và mỗi " +
          "cái đẩy được một luận điểm riêng."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
