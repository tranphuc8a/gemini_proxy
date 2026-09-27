/* =====================================================================
   lab-markov.js — Chuoi Markov: hoi tu, khe pho, thoi gian tron.

   Ba dieu, deu DO trong lab chu khong chep tu sach:

   1. Moi khoi dau ve cung MOT phan phoi. Ba khoi dau khac hann nhau chay
      song song, va chung chap vao nhau. Do duoc: lech 6e-16.

   2. Tru khi xich TUAN HOAN. Xich doi cho hai dinh dao dong mai mai;
      |lambda2| dung bang 1, khe pho dung bang 0. Them mot chut tu-lap e
      la pha duoc ngay, va khe pho khi do dung bang 2e.

   3. ★ THOI GIAN TRON DI THEO 1/KHE. Keo "cau noi" giua hai cum tu 0,5
      xuong 0,001 thi khe co tu 0,667 xuong 0,002 (bon bac do lon) va
      t_tron phinh tu 4 len 1957 — nhung TICH t_tron x khe gan nhu dung
      yen:

          cau    khe        t_tron   t_tron x khe
          0,5    0,667           4       2,67
          0,1    0,182          20       3,64
          0,02   0,0392         98       3,84
          0,005  0,0099        392       3,90
          0,001  0,0020       1957       3,91

      Do la dieu it ai nhin thay: mot con so cua MA TRAN doan truoc duoc
      hanh vi cua QUA TRINH.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ---------- Dai so cua xich ---------- */

  function chuanHoaHang(P) {
    for (var i = 0; i < P.length; i++) {
      var s = 0, j;
      for (j = 0; j < P[i].length; j++) s += P[i][j];
      if (s <= 0) { for (j = 0; j < P[i].length; j++) P[i][j] = 1 / P[i].length; continue; }
      for (j = 0; j < P[i].length; j++) P[i][j] /= s;
    }
    return P;
  }

  function nhan(v, P) {
    var n = v.length, r = new Array(n), i, j;
    for (i = 0; i < n; i++) r[i] = 0;
    for (i = 0; i < n; i++) {
      if (!v[i]) continue;
      for (j = 0; j < n; j++) r[j] += v[i] * P[i][j];
    }
    return r;
  }

  /** Khoang cach bien sai toan phan — nua tong tri tuyet doi hieu. */
  function tv(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / 2;
  }

  /** Phan phoi dung, bang lap luy thua. */
  function phanPhoiDung(P, lap) {
    var n = P.length, v = new Array(n), i;
    for (i = 0; i < n; i++) v[i] = 1 / n;
    for (var t = 0; t < (lap || 20000); t++) {
      var w = nhan(v, P);
      if (tv(v, w) < 1e-15) return w;
      v = w;
    }
    return v;
  }

  /** |lambda2| — lap luy thua TRONG khong gian tong-bang-0.

      Hai cho de sai, ca hai deu da mac phai mot lan khi do:

      (a) Khong tru trung binh moi vong thi mot chut thanh phan doc theo
          huong phan phoi dung se ro ri vao. Thanh phan do co tri rieng 1
          nen KHONG BAO GIO tat, va sau vai tram vong no nuot het — phep
          do bao |lambda2| = 1 cho MOI xich, ke ca xich tron trong 3 buoc.

      (b) Khoi dau co dinh kieu [1,-1,0,...] co the co thanh phan BANG 0
          doc theo mode cham. Voi xich hai cum, moi dinh trong cung cum co
          hang giong het nhau, nen [1,-1,0,...] bi triet tieu ngay buoc
          dau va phep do bao khe = 1 cho dung cai xich tron cham nhat.
          Nen phai khoi dau NGAU NHIEN, va thu vai lan lay cai lon nhat. */
  function lambda2(P, hat) {
    var n = P.length, R = V.rng(hat || 7), lon = 0, lan, i, t;
    for (lan = 0; lan < 3; lan++) {
      var v = new Array(n), tb = 0;
      for (i = 0; i < n; i++) { v[i] = R() - 0.5; tb += v[i]; }
      tb /= n;
      var c = 0;
      for (i = 0; i < n; i++) { v[i] -= tb; c += Math.abs(v[i]); }
      if (c < 1e-300) continue;
      for (i = 0; i < n; i++) v[i] /= c;

      var ti = 0, tong = 0, dem = 0;
      for (t = 0; t < 1200; t++) {
        var w = nhan(v, P), m = 0;
        for (i = 0; i < n; i++) m += w[i];
        m /= n;
        var ch = 0;
        for (i = 0; i < n; i++) { w[i] -= m; ch += Math.abs(w[i]); }
        if (ch < 1e-300) { ti = 0; break; }
        ti = ch;
        for (i = 0; i < n; i++) v[i] = w[i] / ch;
        if (t > 120) { tong += ti; dem++; }
      }
      var g = dem ? tong / dem : ti;
      if (g > lon) lon = g;
    }
    return Math.min(1, lon);
  }

  /** t nho nhat de MOI khoi dau dinh deu vao trong eps cua phan phoi dung. */
  function thoiGianTron(P, eps, tToiDa) {
    var n = P.length, pi = phanPhoiDung(P), xau = 0, k, i;
    tToiDa = tToiDa || 20000;
    for (k = 0; k < n; k++) {
      var v = new Array(n);
      for (i = 0; i < n; i++) v[i] = 0;
      v[k] = 1;
      var t = 0;
      while (t < tToiDa && tv(v, pi) > eps) { v = nhan(v, P); t++; }
      if (t > xau) xau = t;
    }
    return xau;
  }

  /* ---------- Cac xich dung san ---------- */

  /** Hai cum day du, noi nhau bang canh trong so `cau`. */
  function xichHaiCum(nMoi, cau) {
    var n = nMoi * 2, P = [], i, j;
    for (i = 0; i < n; i++) {
      var h = [];
      for (j = 0; j < n; j++) h.push(((i < nMoi) === (j < nMoi)) ? 1 : cau);
      P.push(h);
    }
    return chuanHoaHang(P);
  }

  /** Vong n dinh, moi buoc tien mot bat buoc — tuan hoan chu ky n. */
  function xichVong(n, tuLap) {
    var P = [], i, j;
    for (i = 0; i < n; i++) {
      var h = [];
      for (j = 0; j < n; j++) h.push(j === i ? tuLap : (j === (i + 1) % n ? 1 - tuLap : 0));
      P.push(h);
    }
    return chuanHoaHang(P);
  }

  function xichNgauNhien(n, hat) {
    var R = V.rng(hat), P = [], i, j;
    for (i = 0; i < n; i++) {
      var h = [];
      for (j = 0; j < n; j++) h.push(R() + 0.02);
      P.push(h);
    }
    return chuanHoaHang(P);
  }

  demo({
    id: "markov",
    nhom: "Ngẫu nhiên & hội tụ",
    mon: "L37",
    ten: "Chuỗi Markov — một con số của ma trận đoán trước được cả quá trình",
    moTa: "Ba khởi đầu khác hẳn nhau, thả ra cùng lúc, <b>chập vào một chỗ</b> — " +
          "trừ khi xích tuần hoàn. Và <b>★ thời gian trộn đi theo 1/khe phổ</b>: " +
          "kéo cầu nối giữa hai cụm cho khe co qua <b>bốn bậc độ lớn</b>, tích " +
          "<code>t_trộn × khe</code> vẫn gần như đứng yên.",

    dung: function (host) {
      var P = null;
      var M = null;                  /* ma tran chuyen */
      var n = 6;
      var pi = null;                 /* phan phoi dung */
      var l2 = 0, khe = 1, tTron = 0;
      var v = null;                  /* ba phan phoi dang chay */
      var lichSuTV = [];             /* [t, tv0, tv1, tv2] */
      var xMax = 60;                 /* bien phai cua bieu do */
      var toaDo = [];                /* vi tri cac dinh de ve */

      var TS = V.thamSo([
        { ma: "kieu", ten: "Xích", kieu: "chon", gt: "hai-cum", muc: [
          { v: "hai-cum",    t: "Hai cụm nối nhau bằng một cầu yếu" },
          { v: "vong",       t: "Vòng — mỗi bước tiến một, TUẦN HOÀN" },
          { v: "ngau-nhien", t: "Ngẫu nhiên dày đặc" }
        ] },
        /* Thang log: engine ve thanh truot bang gia tri THO (khong nhan
           ham dinh dang), nen ten phai noi ro day la so mu — con gia tri
           that thi in ra bang so lieu. */
        { ma: "cau", ten: "Cầu nối = 10 mũ", kieu: "truot",
          min: -3, max: 0, buoc: 0.05, gt: -1, donVi: "",
          moTa: "−1 là cầu 0,1; −3 là cầu 0,001. Chỉ dùng cho xích hai cụm." },
        { ma: "tuLap", ten: "Xác suất tự lập (ở lại chỗ cũ)", kieu: "truot",
          min: 0, max: 0.5, buoc: 0.005, gt: 0,
          moTa: "Chỉ cần <b>một chút</b> là phá được tuần hoàn. Khe phổ = 2×số này." },
        { ma: "soDinh", ten: "Số đỉnh", kieu: "so", min: 4, max: 12, buoc: 2, gt: 6 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 5 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ Cầu 0,1 — khe 0,18, trộn 20 bước",
            gt: { kieu: "hai-cum", cau: -1, tuLap: 0, soDinh: 6 } },
          { ten: "★ Cầu 0,001 — khe 0,002, trộn 1957 bước",
            gt: { kieu: "hai-cum", cau: -3, tuLap: 0, soDinh: 6 } },
          { ten: "★ Vòng tuần hoàn — KHÔNG BAO GIỜ trộn",
            gt: { kieu: "vong", tuLap: 0, soDinh: 6 } },
          { ten: "★ Vẫn vòng đó, thêm 1% tự lập — trộn được ngay",
            gt: { kieu: "vong", tuLap: 0.01, soDinh: 6 } },
          { ten: "Ngẫu nhiên dày — trộn trong 3–4 bước",
            gt: { kieu: "ngau-nhien", tuLap: 0, soDinh: 8 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.62, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var B = null;
      var ghiChu = V.el("div", { class: "chu-thich" });

      var MAU_KD = ["ac", "ok", "loi"];       /* ba khoi dau */

      /* ============================================================ */
      function apDung() {
        if (!cv.W) return;
        n = Math.round(G.soDinh);
        var tuLap = G.tuLap;

        if (G.kieu === "vong") {
          M = xichVong(n, tuLap);
        } else {
          M = G.kieu === "hai-cum"
            ? xichHaiCum(n / 2, Math.pow(10, G.cau))
            : xichNgauNhien(n, Math.round(G.hat) || 1);
          /* Tron tu-lap vao: P' = (1-a)P + a I */
          if (tuLap > 0) {
            for (var i = 0; i < n; i++) {
              for (var j = 0; j < n; j++) {
                M[i][j] = (1 - tuLap) * M[i][j] + (i === j ? tuLap : 0);
              }
            }
            chuanHoaHang(M);
          }
        }

        pi = phanPhoiDung(M);
        l2 = lambda2(M, Math.round(G.hat) || 1);
        khe = 1 - l2;
        /* Khe ~ 0 thi xich khong hoi tu, va thoiGianTron() se chay het
           20000 buoc cho TUNG dinh khoi dau — 12 x 20000 x 144 phep tinh
           moi lan keo thanh truot, chi de biet mot dieu ma khe da noi
           truoc. Hoi phe la thua. */
        tTron = khe < 1e-9 ? Infinity : thoiGianTron(M, 0.01, 20000);

        /* Ba khoi dau khac han nhau: dinh 0, dinh cuoi, va deu. */
        v = [dinhDon(0), dinhDon(n - 1), deu()];
        lichSuTV = [];

        /* Toa do cac dinh — hai cum thi tach ra, con lai thi tren vong tron. */
        toaDo = [];
        for (var k = 0; k < n; k++) {
          if (G.kieu === "hai-cum") {
            var nua = n / 2, trong = k % nua, cum = k < nua ? 0 : 1;
            var gocc = trong / nua * 6.2832 - 1.5708;
            toaDo.push([(cum ? 0.74 : 0.26) + Math.cos(gocc) * 0.155,
                        0.5 + Math.sin(gocc) * 0.30]);
          } else {
            var a = k / n * 6.2832 - 1.5708;
            toaDo.push([0.5 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.36]);
          }
        }

        var chiaY = Math.round(cv.H * 0.62);
        xMax = Math.max(10, Math.min(isFinite(tTron) ? tTron * 1.3 : 60, 400));
        B = V.bieuDo(cv, {
          le: { t: chiaY + 20, r: 16, b: 34, l: 64 },
          x: { min: 0, max: xMax,
               nhan: "số bước", vach: 5,
               dinhDang: function (x) { return String(Math.round(x)); } },
          y: { min: 1e-4, max: 1, log: true, nhan: "cách phân phối dừng (TV)",
               dinhDang: function (x) {
                 return x >= 0.1 ? x.toFixed(1) : x.toExponential(0);
               } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        ["khởi đầu: dồn hết vào đỉnh 1", "khởi đầu: dồn hết vào đỉnh " + n,
         "khởi đầu: rải đều"].forEach(function (t, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + V.mau(MAU_KD[i]) }), t
          ]));
        });
        ghiChu.appendChild(V.el("span", {
          text: "· độ dày cạnh = xác suất chuyển · vòng tròn trong mỗi đỉnh = xác suất hiện tại"
        }));

        P.datToiDa(Math.max(20, Math.min(isFinite(tTron) ? tTron * 2 + 10 : 120, 3000)));
        P.datLai();
      }

      function dinhDon(k) {
        var a = new Array(n), i;
        for (i = 0; i < n; i++) a[i] = 0;
        a[k] = 1;
        return a;
      }
      function deu() {
        var a = new Array(n), i;
        for (i = 0; i < n; i++) a[i] = 1 / n;
        return a;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veXich(k) {
        var chiaY = Math.round(cv.H * 0.62);
        var x0 = 12, rong = cv.W - 24, cao = chiaY - 16;
        function px(i) { return x0 + toaDo[i][0] * rong; }
        function py(i) { return 10 + toaDo[i][1] * cao; }

        var i, j;
        g.save();

        /* --- canh: do day theo xac suat --- */
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            if (i === j || M[i][j] < 0.004) continue;
            var ax = px(i), ay = py(i), bx = px(j), by = py(j);
            /* Lech sang mot ben de hai chieu khong de len nhau. */
            var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
            var lx = -dy / d * 6, ly = dx / d * 6;
            g.strokeStyle = V.mau("bd");
            g.globalAlpha = Math.min(0.9, 0.12 + M[i][j] * 1.6);
            g.lineWidth = Math.max(0.5, Math.min(7, M[i][j] * 13));
            g.beginPath();
            g.moveTo(ax + lx, ay + ly);
            g.quadraticCurveTo((ax + bx) / 2 + lx * 2.2, (ay + by) / 2 + ly * 2.2,
                               bx + lx, by + ly);
            g.stroke();
          }
        }
        g.globalAlpha = 1;

        /* --- dinh: vong ngoai la phan phoi dung, ruot la ba phan phoi dang chay --- */
        var r0 = Math.min(30, Math.max(14, cao / (n * 0.9)));
        for (i = 0; i < n; i++) {
          var cx = px(i), cy = py(i);
          /* Vien ngoai = phan phoi dung. */
          g.strokeStyle = V.mau("tx3"); g.lineWidth = 1.4;
          g.beginPath(); g.arc(cx, cy, r0, 0, 6.2832); g.stroke();
          g.fillStyle = V.mau("surf2");
          g.beginPath(); g.arc(cx, cy, r0, 0, 6.2832); g.fill();
          /* Dia mo = phan phoi dung. */
          g.fillStyle = V.mau("tx3"); g.globalAlpha = 0.28;
          g.beginPath(); g.arc(cx, cy, r0 * Math.sqrt(Math.min(1, pi[i] * n / 1.6)), 0, 6.2832);
          g.fill(); g.globalAlpha = 1;
          /* Ba cung tron, moi khoi dau mot mau. */
          for (var q = 0; q < 3; q++) {
            var t0 = q * 2.0944 - 1.5708, t1 = t0 + 2.0944 * 0.92;
            var rr = r0 * Math.sqrt(Math.min(1, v[q][i] * n / 1.6));
            if (rr < 1) continue;
            g.fillStyle = V.mau(MAU_KD[q]);
            g.beginPath(); g.moveTo(cx, cy);
            g.arc(cx, cy, rr, t0, t1); g.closePath(); g.fill();
          }
          g.fillStyle = V.mau("tx2");
          g.font = "600 11px ui-monospace,monospace";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(String(i + 1), cx, cy + r0 + 11);
        }
        g.restore();
      }

      function veBieuDo() {
        B.truc();
        for (var q = 0; q < 3; q++) {
          var d = [];
          for (var t = 0; t < lichSuTV.length; t++) {
            d.push([lichSuTV[t][0], Math.max(1e-4, lichSuTV[t][1 + q])]);
          }
          if (d.length > 1) B.duong(d, V.mau(MAU_KD[q]), 1.8);
        }
        /* Nguong 1% — cho dinh nghia thoi gian tron. */
        B.duong([[0, 0.01], [xMax, 0.01]], V.mau("bd2"), 1);
        B.chu(0, 0.01, "  ngưỡng 1% — mốc tính thời gian trộn", V.mau("tx3"), "left");
      }

      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        veXich(k);
        veBieuDo();

        var xa = Math.max(tv(v[0], pi), tv(v[1], pi), tv(v[2], pi));
        var lechKD = Math.max(tv(v[0], v[1]), tv(v[1], v[2]), tv(v[0], v[2]));

        var bang = {
          "Số đỉnh": n,
          "Bước hiện tại": k,
          "— Phổ của ma trận —": "",
          "|λ₂|": l2.toFixed(6),
          "Khe phổ  1 − |λ₂|": khe < 1e-6 ? "≈ 0" : khe.toFixed(6),
          "— Hành vi của quá trình —": "",
          "Ba khởi đầu còn lệch nhau": lechKD < 1e-12 ? "≈ 0  ✔ đã chập vào nhau"
                                                     : lechKD.toExponential(2),
          "Xa phân phối dừng nhất": xa < 1e-12 ? "≈ 0" : xa.toExponential(2),
          "Thời gian trộn (tới 1%)": !isFinite(tTron) || tTron >= 20000
            ? "không trộn nổi" : tTron + " bước"
        };
        if (G.kieu === "hai-cum") {
          bang["Trọng số cầu nối"] = Math.pow(10, G.cau).toFixed(4);
        }
        if (khe > 1e-9 && isFinite(tTron) && tTron < 20000) {
          bang["★ t_trộn × khe"] = (tTron * khe).toFixed(2) +
            "   — gần như không đổi dù khe chạy qua bốn bậc độ lớn";
          bang["Cận trên ln(100)/khe"] = Math.round(Math.log(100) / khe) +
            " bước   (thực tế " + tTron + ")";
        } else {
          bang["⚑ Khe phổ bằng 0"] = "xích TUẦN HOÀN — dao động mãi mãi, " +
            "không có phân phối giới hạn";
        }
        if (G.kieu === "vong" && G.tuLap > 0) {
          /* Cong thuc dong cho vong n dinh: tri rieng la e + (1-e)*w^j voi
             w = e^(2*pi*i/n), nen khe = 1 - |e + (1-e)*w|.

             KHONG phai 2e — do la truong hop rieng n = 2 (luc do w = -1).
             Lab tung viet 2e, va vi o kiem chi in "thuc te ..." chu khong
             bao SAI nen no lech o moi gia tri ma khong ai de y. */
          var goc = 2 * Math.PI / n;
          var re = G.tuLap + (1 - G.tuLap) * Math.cos(goc);
          var im = (1 - G.tuLap) * Math.sin(goc);
          var kheLT = 1 - Math.sqrt(re * re + im * im);
          bang["Kiểm: công thức đóng 1−|ε+(1−ε)ω|"] = kheLT.toFixed(6) +
            (Math.abs(khe - kheLT) < Math.max(2e-4, kheLT * 0.05)
              ? "   ✔ khớp giá trị đo được"
              : "   ✘ LỆCH — đo được " + khe.toFixed(6));
        }
        S.dat(bang);
      }

      P = V.phat({
        ten: "markov",
        bang: cv,
        tocDo: 6,
        buoc: function (k) {
          for (var q = 0; q < 3; q++) v[q] = nhan(v[q], M);
          lichSuTV.push([k + 1, tv(v[0], pi), tv(v[1], pi), tv(v[2], pi)]);
          if (lichSuTV.length > 4000) lichSuTV.shift();
          return true;
        },
        datLai: function () {
          if (!M) return;
          v = [dinhDon(0), dinhDon(n - 1), deu()];
          lichSuTV = [[0, tv(v[0], pi), tv(v[1], pi), tv(v[2], pi)]];
        },
        ve: ve,
        nhan: function () {
          if (!v) return "";
          var x = Math.max(tv(v[0], pi), tv(v[1], pi), tv(v[2], pi));
          return x < 0.01 ? "đã trộn (dưới 1%)" : "còn cách " + (x * 100).toFixed(1) + "%";
        }
      });

      var r = V.khung(host, {
        ten: "markov",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Chuỗi Markov</b> là một quá trình mà bước tiếp theo <i>chỉ</i> phụ thuộc " +
          "chỗ đang đứng, không phụ thuộc đã đi qua đâu. Lab thả <b>ba phân phối khởi " +
          "đầu khác hẳn nhau</b> chạy song song trên cùng một xích." +
          "<ul>" +
          "<li><b>Chúng chập vào nhau.</b> Bảng số liệu đo <i>ba khởi đầu còn lệch " +
          "nhau bao nhiêu</i> — con số đó tụt về 0. Xích quên mất nó bắt đầu từ đâu.</li>" +
          "<li>Vòng tròn trong mỗi đỉnh: <b>đĩa mờ</b> là phân phối dừng, <b>ba múi " +
          "màu</b> là ba phân phối đang chạy. Khi ba múi phủ kín đĩa mờ là đã trộn xong." +
          "</li>" +
          "<li>Biểu đồ dưới là <b>thang log</b>: ba đường tụt <i>thẳng</i>, nghĩa là " +
          "khoảng cách co theo <b>cấp số nhân</b>, và độ dốc chính là |λ₂|.</li>" +
          "</ul>" +
          "<b>★ Điều ít ai nhìn thấy: một con số của MA TRẬN đoán trước được hành vi " +
          "của QUÁ TRÌNH.</b> Con số đó là <b>khe phổ</b> = 1 − |λ₂|, với λ₂ là trị " +
          "riêng lớn thứ hai." +
          "<ul>" +
          "<li>Bấm hai preset <b>cầu 0,1</b> rồi <b>cầu 0,001</b>. Khe co từ " +
          "<b>0,18</b> xuống <b>0,002</b>, thời gian trộn phình từ <b>20</b> lên " +
          "<b>1957</b> bước. Nhưng nhìn ô <b>t_trộn × khe</b>: nó gần như <i>không " +
          "nhúc nhích</i>.</li>" +
          "<li>Đo qua năm giá trị cầu nối, khe chạy qua <b>bốn bậc độ lớn</b>:" +
          "<br><code>0,667 → 2,67 · 0,182 → 3,64 · 0,0392 → 3,84 · 0,0099 → 3,90 · " +
          "0,0020 → 3,91</code><br>Tích ấy bị kẹp trong một khoảng hẹp. Nên <b>đo " +
          "một trị riêng là biết trước phải chạy bao nhiêu bước</b> — không cần chạy " +
          "thử.</li>" +
          "<li><b>Vì sao hai cụm lại chậm?</b> Xích chui qua cầu rất hiếm, nên muốn " +
          "cân bằng giữa hai cụm nó phải <i>đợi</i>. Cái cổ chai hình học ấy hiện " +
          "nguyên hình thành một con số trong phổ. Đây chính là lý do MCMC trong thực " +
          "tế hay hỏng: không gian mẫu có hai vùng tốt cách nhau bởi một vùng xấu.</li>" +
          "</ul>" +
          "<b>★ Trừ khi xích TUẦN HOÀN.</b> Bấm preset <i>vòng tuần hoàn</i>: xác suất " +
          "chạy vòng quanh <b>mãi mãi</b>, ba khởi đầu không bao giờ gặp nhau, và " +
          "|λ₂| <b>đúng bằng 1</b> — khe phổ bằng 0." +
          "<ul>" +
          "<li>Phân phối dừng <i>vẫn tồn tại</i> (rải đều), nhưng xích <b>không hội " +
          "tụ</b> về nó. “Có phân phối dừng” và “hội tụ về phân phối " +
          "dừng” là hai chuyện khác nhau — và chỗ này là phản ví dụ.</li>" +
          "<li>Bấm preset kế tiếp: <b>thêm 1% tự lập</b>, tức chỉ cần một phần trăm " +
          "khả năng đứng yên. Tuần hoàn <b>vỡ ngay</b>, khe phổ bật khỏi 0, và xích " +
          "trộn được. Một phần trăm là đủ để đổi hẳn bản chất của quá trình.</li>" +
          "<li>Khe phổ khi đó có <b>công thức đóng</b>: vòng n đỉnh với tự lập ε có " +
          "trị riêng <code>ε + (1−ε)ω<sup>j</sup></code> với <code>ω = e^(2πi/n)</code>, " +
          "nên <code>khe = 1 − |ε + (1−ε)ω|</code>. Ô <i>Kiểm</i> đối chiếu công thức " +
          "ấy với giá trị <b>đo được bằng lặp luỹ thừa</b> — hai đường tính hoàn toàn " +
          "khác nhau, phải gặp nhau.</li>" +
          "<li><b>Cẩn thận với “khe = 2ε”.</b> Đó là công thức người ta hay nhớ, nhưng " +
          "nó chỉ đúng cho vòng <b>2 đỉnh</b> (khi ấy ω = −1). Lab này từng viết 2ε rồi " +
          "để mặc định n = 6 — lệch gấp bốn lần, và ô <i>Kiểm</i> lúc đó chỉ in “thực " +
          "tế …” chứ không báo SAI, nên nó lệch ở mọi giá trị mà không ai để ý. Đo được: " +
          "ở ε = 0,01 thì n = 2 cho <b>0,0200</b> còn n = 6 chỉ cho <b>0,0050</b>.</li>" +
          "</ul>" +
          "<b>Hai bẫy khi tự cài lại phép đo này</b> (đã mắc đủ cả hai): tính |λ₂| " +
          "bằng lặp luỹ thừa thì phải <b>trừ trung bình mỗi vòng</b>, không thì thành " +
          "phần dọc theo phân phối dừng rò rỉ vào và nuốt hết — mọi xích đều báo " +
          "|λ₂| = 1. Và <b>vector khởi đầu phải ngẫu nhiên</b>: một khởi đầu cố định " +
          "kiểu <code>[1,−1,0,…]</code> có thể trực giao sẵn với mode chậm, khiến " +
          "phép đo báo khe = 1 cho đúng cái xích trộn chậm nhất."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
