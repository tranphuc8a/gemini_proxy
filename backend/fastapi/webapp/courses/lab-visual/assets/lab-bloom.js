/* =====================================================================
   lab-bloom.js — Bloom filter, va cai gia cua mot ham bam "hop ly ma sai".

   Bloom filter tra loi "chac chan KHONG co" hoac "co the co". No khong
   bao gio bo sot, nhung thinh thoang noi co ma khong co. Ti le do co cong
   thuc:  p = (1 - e^(-kn/m))^k.

   ★ Cong thuc do gia dinh k ham bam DOC LAP. Lab chay hai bo loc song
   song tren CUNG du lieu, cung m/k/n, chi khac ham bam:

     - bam TOT : tron 32-bit kieu murmur + meo bam doi Kirsch-Mitzenmacher
     - bam XAU : FNV voi k gia tri khoi dau khac nhau (trong rat hop ly)

   CHO DE VIET SAI — va da viet sai HAI lan.

   Lan mot: do mot hat giong roi ket luan "bam xau dat hon 8%". Sai, vi o
   hat khac no lai RE hon.

   Lan hai: doi sang do min-max qua nhieu hat. Cung sai, vi min-max la
   thong ke CUC TRI — no chi co the phinh ra khi lay them mau, nen con so
   tren man hinh doi theo so hat ma nguoi doc khong biet:

       so hat     8     16     40     80
       bam TOT   22%    36%    47%    48%
       bam XAU  147%   206%   192%   194%

   Te nhat la o "so k ma bam XAU re hon": no lat tu 11/12 (8 hat) xuong
   8/12 (16 hat) roi 1/12 (24 hat). Mot con so nhu the trong rat cha
   chan ma that ra la nhieu.

   Do dung phai la HE SO BIEN THIEN (do lech chuan / trung binh), la uoc
   luong vung. 160 hat giong, 4000 phep thu, m=1024 k=5 n=200, cong thuc
   = 0,0942:

                  tb      sigma   he so bien thien   p10...p90
       bam TOT   0,0945  0,0089         9%          0,0835...0,1072
       bam XAU   0,1081  0,0418        39%          0,0580...0,1645

       lech cong thuc qua 10%:  bam tot 46/160 (29%)  ·  bam xau 129/160 (81%)
       so hat ma bam XAU lai RE hon bam tot:  68/160 (43%)

   Nen luan diem dung KHONG phai "bam xau dat hon", ma la "bam xau KHONG
   DOAN TRUOC DUOC". Cong thuc van mo ta dung cai trung binh, nhung no
   mat tu cach lam mot LOI HUA: ban khong dat duoc cam ket nao len no.

   Bieu do ve dai p10-p90 qua nhieu hat giong chu khong ve mot duong.
   Mot lan chay khong noi len dieu gi — va do chinh la bai hoc.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ---------- Ham bam ---------- */

  /** Bo tron 32-bit kieu murmur3 finalizer. */
  function tron32(x) {
    x = x >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0;
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  }

  function fnv(s, hat) {
    var h = (2166136261 ^ hat) >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** TOT — bam doi Kirsch-Mitzenmacher, moi vi tri con qua bo tron. */
  function viTriTot(s, k, m, ra) {
    var h1 = tron32(fnv(s, 0)), h2 = (tron32(fnv(s, 0x9e3779b9)) | 1) >>> 0;
    for (var i = 0; i < k; i++) {
      ra[i] = tron32((h1 + Math.imul(i, h2) + i * i) >>> 0) % m;
    }
    return ra;
  }

  /** XAU — FNV voi k gia tri khoi dau, lay truc tiep phan du.

      Trong rat hop ly, va nguoi ta viet the that. Hai cho hong: k gia tri
      khoi dau tren chuoi NGAN cho ra k ket qua tuong quan; va bit thap
      cua FNV-1a tron rat yeu, ma `% m` voi m luy thua 2 thi CHI dung bit
      thap. Nen ket qua phu thuoc nang vao chinh bo chuoi khoa. */
  function viTriXau(s, k, m, ra) {
    for (var i = 0; i < k; i++) ra[i] = fnv(s, i) % m;
    return ra;
  }

  var CACH = [
    { ma: "tot", ten: "băm tốt", f: viTriTot, mau: "ok" },
    { ma: "xau", ten: "băm xấu", f: viTriXau, mau: "loi" }
  ];

  function ctXapXi(m, k, n) { return Math.pow(1 - Math.exp(-k * n / m), k); }

  /** Thong ke VUNG, khong dung min-max.

      min-max la thong ke cuc tri: no chi phinh ra khi lay them mau, nen
      con so hien len se doi theo so hat giong ma nguoi doc khong biet.
      He so bien thien (sigma / trung binh) va khoang p10-p90 thi hoi tu. */
  function thongKe(ds) {
    var s = ds.slice().sort(function (a, b) { return a - b; });
    var N = ds.length, tb = 0, i;
    for (i = 0; i < N; i++) tb += ds[i];
    tb /= N;
    var vp = 0;
    for (i = 0; i < N; i++) vp += (ds[i] - tb) * (ds[i] - tb);
    var sd = Math.sqrt(vp / N);
    return {
      tb: tb, sd: sd, bt: tb > 0 ? sd / tb : 0,
      tv: s[(N / 2) | 0],
      p10: s[Math.floor(N * 0.1)],
      p90: s[Math.min(N - 1, Math.floor(N * 0.9))]
    };
  }

  demo({
    id: "bloom",
    nhom: "Ngẫu nhiên & hội tụ",
    mon: "L38",
    ten: "Bloom filter — công thức mô tả trung bình, không phải lời hứa",
    moTa: "Bloom filter <b>không bao giờ bỏ sót</b>, nhưng thỉnh thoảng nói “có” mà " +
          "không có. Tỉ lệ ấy có công thức — <b>★ và công thức giả định k hàm băm " +
          "độc lập</b>. Đổi sang một hàm băm trông rất hợp lý mà không độc lập, thì " +
          "trung bình chỉ lệch 15%, nhưng <b>độ dao động phình từ 9% lên 39%</b>: " +
          "cùng tham số ấy, có tập dữ liệu rẻ hơn, có tập đắt gấp đôi.",

    dung: function (host) {
      var P = null;
      var m = 1024, k = 5, nDich = 200;
      var bit = [null, null];        /* hai mang bit, mot lan chay */
      var daThem = [0, 0];
      var soDuongGia = [0, 0], soThu = [0, 0];
      var viTriMoi = [null, null];
      var duongK = null;             /* [{k, ct, tot:{...}, xau:{...}}] */
      var tam = new Int32Array(32);
      /* 20 hat: he so bien thien da gan gia tri hoi tu (do duoc 11,5%
         so voi 11,1% o 160 hat), va p10/p90 roi vao chi so 2 va 18 nen
         khong phai noi suy. Duoi 16 hat thi ca hai deu chua on. */
      var SO_HAT = 20;

      var TS = V.thamSo([
        { ma: "soBit", ten: "Số bit (m)", kieu: "so",
          min: 256, max: 8192, buoc: 256, gt: 1024 },
        { ma: "soBam", ten: "Số hàm băm (k)", kieu: "so", min: 1, max: 12, buoc: 1, gt: 5 },
        { ma: "soKhoa", ten: "Số khoá sẽ thêm (n)", kieu: "so",
          min: 20, max: 1200, buoc: 20, gt: 200 },
        { ma: "veDuong", ten: "Chạy dải tỉ lệ theo k", kieu: "bat", gt: true,
          moTa: "Chạy THẬT cả hai cách, mọi k từ 1 tới 12, <b>20 hạt giống</b> mỗi " +
                "điểm. Mất chưa tới một giây mỗi lần đổi tham số — nhưng một lần " +
                "chạy thì không nói lên điều gì." },
        { ma: "hat", ten: "Hạt giống (cho lần chạy trực tiếp)", kieu: "hat", gt: 3 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ m=1024 k=5 n=200 — băm xấu dao động gấp 4 lần",
            gt: { soBit: 1024, soBam: 5, soKhoa: 200, veDuong: true } },
          { ten: "★ Hạt 3 — lần này băm XẤU lại rẻ hơn",
            gt: { soBit: 1024, soBam: 5, soKhoa: 200, veDuong: true, hat: 3 } },
          { ten: "★ Hạt 7 — cùng tham số, băm xấu đắt gấp đôi",
            gt: { soBit: 1024, soBam: 5, soKhoa: 200, veDuong: true, hat: 7 } },
          { ten: "Nhồi chật: m=512 n=200 — gần 40% dương tính giả",
            gt: { soBit: 512, soBam: 4, soKhoa: 200, veDuong: true } },
          { ten: "Thoáng: m=8192 n=300 — dưới 1%",
            gt: { soBit: 8192, soBam: 6, soKhoa: 300, veDuong: true } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.70, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var B = null;
      var L = null;
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================ */
      function khoaCo(h, i) { return "co#" + h + "#" + i; }
      function khoaKhong(h, i) { return "khong#" + h + "#" + i; }

      function apDung() {
        if (!cv.W) return;
        m = Math.round(G.soBit);
        k = Math.round(G.soBam);
        nDich = Math.round(G.soKhoa);
        if (tam.length < k) tam = new Int32Array(k + 4);

        bit = [new Uint8Array(m), new Uint8Array(m)];
        daThem = [0, 0];
        soDuongGia = [0, 0];
        soThu = [0, 0];
        viTriMoi = [null, null];

        duongK = G.veDuong ? chayDuongK() : null;

        var chiaY = Math.round(cv.H * (duongK ? 0.48 : 0.92));
        var cot = Math.max(16, Math.round(Math.sqrt(m * 3.2)));
        while (m % cot !== 0 && cot < m) cot++;
        var hang = Math.ceil(m / cot);
        L = V.luoiO(cv, { cot: cot, hang: hang, le: 10, leTren: 34,
                          leDuoi: cv.H - chiaY });
        L.bangMau([V.mau("surf2"), V.mau("ok"), V.mau("loi"), V.mau("ac"), V.mau("ba")]);

        if (duongK) {
          B = V.bieuDo(cv, {
            le: { t: chiaY + 26, r: 16, b: 34, l: 66 },
            x: { min: 1, max: 12, nhan: "số hàm băm (k)", vach: 11,
                 dinhDang: function (x) { return String(Math.round(x)); } },
            y: { min: 0, max: Math.max(0.03, maxY() * 1.12),
                 nhan: "tỉ lệ dương tính giả",
                 dinhDang: function (x) { return (x * 100).toFixed(1) + "%"; } },
            luoi: 4
          });
        } else {
          B = null;
        }

        ghiChu.innerHTML = "";
        [[V.mau("ok"), "băm tốt"], [V.mau("loi"), "băm xấu"],
         [V.mau("ac"), "cả hai cùng bật"], [V.mau("ba"), "vị trí vừa chạm"],
         [V.mau("tx3"), "công thức"]].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + x[0] }), x[1]
          ]));
        });
        ghiChu.appendChild(V.el("span", {
          text: "· vùng tô nhạt trên biểu đồ = khoảng 10–90% qua " + SO_HAT +
                " hạt giống · đường đậm = trung vị"
        }));

        P.datToiDa(nDich);
        P.datLai();
      }

      function maxY() {
        if (!duongK) return 0.03;
        var t = 0;
        for (var i = 0; i < duongK.length; i++) {
          t = Math.max(t, duongK[i].tot.p90, duongK[i].xau.p90, duongK[i].ct);
        }
        return t;
      }

      /** Mot lan do: dung bo loc voi `hat`, roi thu `soThu` khoa vang mat. */
      function motLan(mm, kk, nn, hat, f, soThu) {
        var b = new Uint8Array(mm), vt = new Int32Array(kk), i, j;
        for (i = 0; i < nn; i++) {
          f(khoaCo(hat, i), kk, mm, vt);
          for (j = 0; j < kk; j++) b[vt[j]] = 1;
        }
        var gia = 0;
        for (i = 0; i < soThu; i++) {
          f(khoaKhong(hat, i), kk, mm, vt);
          var co = true;
          for (j = 0; j < kk; j++) if (!b[vt[j]]) { co = false; break; }
          if (co) gia++;
        }
        return gia / soThu;
      }

      /** Chay THAT ca hai cach o moi k, qua SO_HAT hat giong.

          Ve DAI min-max chu khong ve mot duong: o mot hat giong don le,
          bam xau co the ra tot hon bam tot (do duoc 15/40 hat), nen mot
          duong don se noi doi. Cai can nhin la BE RONG cua dai. */
      function chayDuongK() {
        var ds = [], kk, h;
        for (kk = 1; kk <= 12; kk++) {
          var d = { k: kk, ct: ctXapXi(m, kk, nDich) };
          for (var c = 0; c < 2; c++) {
            var mau = [];
            for (h = 1; h <= SO_HAT; h++) {
              mau.push(motLan(m, kk, nDich, h, CACH[c].f, 1500));
            }
            d[CACH[c].ma] = thongKe(mau);
          }
          ds.push(d);
        }
        return ds;
      }

      function themMot(i) {
        var c, j, hat = Math.round(G.hat) || 1;
        for (c = 0; c < 2; c++) {
          CACH[c].f(khoaCo(hat, i), k, m, tam);
          viTriMoi[c] = [];
          for (j = 0; j < k; j++) { bit[c][tam[j]] = 1; viTriMoi[c].push(tam[j]); }
          daThem[c]++;
        }
        for (c = 0; c < 2; c++) {
          var gia = 0, THU = 800;
          for (j = 0; j < THU; j++) {
            CACH[c].f(khoaKhong(hat, j), k, m, tam);
            var co = true;
            for (var q = 0; q < k; q++) if (!bit[c][tam[q]]) { co = false; break; }
            if (co) gia++;
          }
          soDuongGia[c] = gia;
          soThu[c] = THU;
        }
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veLuoi() {
        for (var i = 0; i < L.cot * L.hang; i++) {
          if (i >= m) { L.dat(i % L.cot, (i / L.cot) | 0, 0); continue; }
          var a = bit[0][i], b = bit[1][i];
          L.dat(i % L.cot, (i / L.cot) | 0, (a && b) ? 3 : a ? 1 : b ? 2 : 0);
        }
        for (var c = 0; c < 2; c++) {
          if (!viTriMoi[c]) continue;
          for (var q = 0; q < viTriMoi[c].length; q++) {
            var p = viTriMoi[c][q];
            L.dat(p % L.cot, (p / L.cot) | 0, 4);
          }
        }
        L.dan();
        L.vien();

        g.save();
        g.font = "600 12px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("Mảng " + m.toLocaleString("vi") + " bit · đã thêm " +
                   daThem[0].toLocaleString("vi") + " / " + nDich.toLocaleString("vi") +
                   " khoá · mỗi khoá chạm " + k + " chỗ · hạt giống " +
                   Math.round(G.hat), 12, 10);
        g.restore();
      }

      /** Vung to nhat giua p10 va p90 qua cac hat giong.

          KHONG dung min-max: day la thong ke cuc tri, dai se rong dan ra
          moi khi tang SO_HAT ma khong hoi tu ve dau ca. */
      function veDai(ma, mau) {
        g.save();
        g.fillStyle = mau;
        g.globalAlpha = 0.22;
        g.beginPath();
        var i;
        for (i = 0; i < duongK.length; i++) {
          var d = duongK[i];
          var x = B.px(d.k), y = B.py(d[ma].p90);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        for (i = duongK.length - 1; i >= 0; i--) {
          var e = duongK[i];
          g.lineTo(B.px(e.k), B.py(e[ma].p10));
        }
        g.closePath();
        g.fill();
        g.restore();
      }

      function veBieuDo() {
        if (!B || !duongK) return;
        B.truc();
        veDai("tot", V.mau("ok"));
        veDai("xau", V.mau("loi"));
        B.duong(duongK.map(function (d) { return [d.k, d.ct]; }), V.mau("tx3"), 1.6);
        B.duong(duongK.map(function (d) { return [d.k, d.tot.tv]; }), V.mau("ok"), 2.2);
        B.duong(duongK.map(function (d) { return [d.k, d.xau.tv]; }), V.mau("loi"), 2.2);

        var d0 = duongK[k - 1];
        if (d0) {
          B.diem(k, d0.tot.tv, V.mau("ok"), 4.5);
          B.diem(k, d0.xau.tv, V.mau("loi"), 4.5);
          B.chu(k, Math.max(d0.tot.p90, d0.xau.p90), " k = " + k, V.mau("tx2"), "left");
        }
        var kSao = (m / nDich) * Math.LN2;
        if (kSao >= 1 && kSao <= 12) {
          B.chu(kSao, 0, "k* = " + kSao.toFixed(2), V.mau("tx3"), "center");
        }
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        veLuoi();
        veBieuDo();

        var pTot = soThu[0] ? soDuongGia[0] / soThu[0] : 0;
        var pXau = soThu[1] ? soDuongGia[1] / soThu[1] : 0;
        var ct = ctXapXi(m, k, daThem[0]);
        var batTot = 0, batXau = 0, i;
        for (i = 0; i < m; i++) { if (bit[0][i]) batTot++; if (bit[1][i]) batXau++; }

        /* Moi nhan phai KHAC NHAU: bang so lieu la mot object, hai khoa
           trung ten thi cai sau nuot cai truoc, va mot dong bien mat ma
           khong kem theo loi nao. */
        var bang = {
          "Mảng bit (m)": m.toLocaleString("vi"),
          "Hàm băm (k)": k,
          "Đã thêm (n)": daThem[0].toLocaleString("vi") + " / " + nDich.toLocaleString("vi"),
          "Công thức (1−e^(−kn/m))^k": (ct * 100).toFixed(3) + "%",
          "Dương tính giả · băm TỐT": (pTot * 100).toFixed(3) + "%   " +
            (ct > 0 ? nhanLech(pTot / ct - 1) : ""),
          "Dương tính giả · băm XẤU": (pXau * 100).toFixed(3) + "%   " +
            (ct > 0 ? nhanLech(pXau / ct - 1) : ""),
          "Bit đã bật · tốt / xấu": (batTot / m * 100).toFixed(1) + "% / " +
            (batXau / m * 100).toFixed(1) + "%",
          "Không bao giờ bỏ sót": kiemKhongBoSot()
            ? "✔ tra lại " + Math.min(SO_TRA_LAI, daThem[0]) + " khoá gần nhất — đều ra “có”"
            : "✘ CÓ BỎ SÓT — sai ở đâu đó"
        };
        /* Khoa TINH TOAN khong dat duoc trong object literal kieu ES5 —
           phai gan bang ngoac vuong sau khi object da dung xong. */
        bang["— Lần chạy này, hạt " + (Math.round(G.hat) || 1) + " —"] = "";
        if (duongK) {
          var d = duongK[k - 1];
          bang["— Qua " + SO_HAT + " hạt giống, tại k = " + k + " —"] = "";
          bang["Băm TỐT: trung bình"] = (d.tot.tb * 100).toFixed(2) + "%   " +
            "(10–90%: " + (d.tot.p10 * 100).toFixed(2) + "% … " +
            (d.tot.p90 * 100).toFixed(2) + "%)";
          bang["Băm XẤU: trung bình"] = (d.xau.tb * 100).toFixed(2) + "%   " +
            "(10–90%: " + (d.xau.p10 * 100).toFixed(2) + "% … " +
            (d.xau.p90 * 100).toFixed(2) + "%)";
          /* He so bien thien, KHONG phai be rong min-max: min-max la thong
             ke cuc tri, no phinh ra theo so hat giong nen con so hien len
             se doi ma nguoi doc khong biet vi sao. */
          bang["★ Hệ số biến thiên (σ / trung bình)"] = "tốt " +
            (d.tot.bt * 100).toFixed(0) + "%   ·   xấu " + (d.xau.bt * 100).toFixed(0) + "%" +
            (d.xau.bt > d.tot.bt * 1.5
              ? "   — xấu dao động gấp " + (d.xau.bt / Math.max(d.tot.bt, 1e-9)).toFixed(1) + " lần"
              : "");
        }
        var kSao = (m / nDich) * Math.LN2;
        bang["k tối ưu theo công thức"] = kSao.toFixed(2) + "   (đang dùng k = " + k + ")";
        S.dat(bang);
      }

      function nhanLech(x) {
        var s = (x * 100).toFixed(1);
        if (Math.abs(x) < 0.05) return "✔ sát công thức (" + s + "%)";
        return (x > 0 ? "cao hơn công thức " : "thấp hơn công thức ") +
               Math.abs(x * 100).toFixed(1) + "%";
      }

      /** Bloom filter KHONG DUOC bo sot. Kiem lai chu khong tin.

          Chi tra 400 khoa gan nhat chu khong phai tat ca: voi n lon va k
          lon thi tra het la hang chuc nghin phep bam MOI KHUNG HINH, vuot
          ngan sach 12ms. Nhan tren man hinh noi ro con so nay — mot phep
          kiem noi qua len ve pham vi cua no cung la mot dang noi doi. */
      var SO_TRA_LAI = 400;
      function kiemKhongBoSot() {
        var hat = Math.round(G.hat) || 1;
        for (var c = 0; c < 2; c++) {
          var tu = Math.max(0, daThem[c] - SO_TRA_LAI);
          for (var i = tu; i < daThem[c]; i++) {
            CACH[c].f(khoaCo(hat, i), k, m, tam);
            for (var j = 0; j < k; j++) if (!bit[c][tam[j]]) return false;
          }
        }
        return true;
      }

      P = V.phat({
        ten: "bloom",
        bang: cv,
        tocDo: 12,
        buoc: function (i) {
          if (i >= nDich) return false;
          themMot(i);
          return i + 1 < nDich;
        },
        datLai: function () {
          if (!m) return;
          bit = [new Uint8Array(m), new Uint8Array(m)];
          daThem = [0, 0];
          soDuongGia = [0, 0]; soThu = [0, 0];
          viTriMoi = [null, null];
        },
        ve: ve,
        nhan: function () {
          if (!soThu[0]) return "chưa thêm khoá nào";
          return "dương tính giả: tốt " + (soDuongGia[0] / soThu[0] * 100).toFixed(1) +
                 "% · xấu " + (soDuongGia[1] / soThu[1] * 100).toFixed(1) + "%";
        }
      });

      var r = V.khung(host, {
        ten: "bloom",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Bloom filter</b> là một mảng <b>m bit</b>. Thêm một khoá: băm nó ra " +
          "<b>k</b> vị trí và bật cả k bit lên. Hỏi một khoá: băm ra k vị trí, nếu " +
          "<i>có một bit nào chưa bật</i> thì <b>chắc chắn chưa từng thêm</b>; nếu cả " +
          "k bit đều bật thì <i>có thể</i> đã thêm." +
          "<ul>" +
          "<li><b>Nó không bao giờ bỏ sót.</b> Ô <i>Không bao giờ bỏ sót</i> tra lại " +
          "400 khoá gần nhất sau mỗi bước — đây là kiểm, không phải lời hứa.</li>" +
          "<li>Cái giá là <b>dương tính giả</b>: bit của khoá bạn hỏi tình cờ bị các " +
          "khoá khác bật hộ. Tỉ lệ ấy có công thức <code>(1−e^(−kn/m))^k</code>.</li>" +
          "<li>Bấm <i>Chạy</i> và nhìn mảng bit đặc dần. Càng đặc thì càng dễ có " +
          "dương tính giả — đó là toàn bộ sự đánh đổi.</li>" +
          "</ul>" +
          "<b>★ Điều ít ai nhìn thấy: công thức ấy giả định k hàm băm ĐỘC LẬP.</b> " +
          "Lab chạy <b>hai bộ lọc song song</b> trên cùng dữ liệu, cùng m, cùng k, " +
          "cùng n — chỉ khác hàm băm." +
          "<ul>" +
          "<li><b>Băm tốt:</b> bộ trộn 32-bit kiểu murmur, cộng mẹo <i>băm đôi</i> " +
          "Kirsch–Mitzenmacher (<code>h₁ + i·h₂ + i²</code>).</li>" +
          "<li><b>Băm xấu:</b> FNV chạy k lần với k <i>giá trị khởi đầu</i> khác nhau, " +
          "rồi lấy thẳng phần dư. Trông hoàn toàn hợp lý, và người ta viết thế thật.</li>" +
          "</ul>" +
          "<b>★ Và đây là chỗ dễ kết luận vội — lab này đã kết luận sai một lần.</b> " +
          "Đo <i>một</i> hạt giống rồi bảo “băm xấu đắt hơn 8%” là sai, vì ở hạt khác " +
          "nó lại <i>rẻ hơn</i>. Bấm hai preset <b>Hạt 3</b> và <b>Hạt 7</b>: cùng " +
          "m, k, n, chỉ khác bộ khoá — và người thắng <b>đổi chỗ</b>." +
          "<ul>" +
          "<li>Nên biểu đồ vẽ <b>khoảng 10–90% qua 20 hạt giống</b> chứ không vẽ một " +
          "đường. Cái đáng nhìn không phải hai đường ở đâu, mà <b>vùng tô nhạt nào " +
          "rộng hơn</b>.</li>" +
          "<li><b>Đo trên 160 hạt giống</b> (m = 1024, k = 5, n = 200; công thức " +
          "0,0942):<br>" +
          "<code>băm tốt: trung bình 0,0945 · σ 0,0089 → dao động  9% · 10–90%: 0,0835–0,1072</code><br>" +
          "<code>băm xấu: trung bình 0,1081 · σ 0,0418 → dao động 39% · 10–90%: 0,0580–0,1645</code>" +
          "<br>Trung bình chỉ lệch 15%, nhưng <b>độ dao động gấp 4,3 lần</b>. Lệch công " +
          "thức quá 10%: băm tốt <b>29%</b> số lần, băm xấu <b>81%</b>. Và ở <b>43%</b> " +
          "số lần, băm xấu lại cho tỉ lệ <i>thấp hơn</i>.</li>" +
          "<li><b>Và đây là chỗ lab sai lần thứ hai:</b> bản đầu đo <i>min–max</i>. " +
          "Nhưng min–max là thống kê <b>cực trị</b> — nó chỉ có thể phình ra khi lấy " +
          "thêm mẫu, nên con số hiện trên màn hình đổi theo số hạt giống mà người đọc " +
          "không biết (đo được: 22% ở 8 hạt → 48% ở 80 hạt). Tệ nhất là ô <i>“số k mà " +
          "băm xấu rẻ hơn”</i>: nó lật từ <b>11/12</b> xuống <b>8/12</b> rồi <b>1/12</b> " +
          "chỉ vì tăng số hạt. Một con số trông rất chắc chắn mà thật ra là nhiễu. Nay " +
          "dùng <b>hệ số biến thiên</b> (σ / trung bình), là ước lượng có hội tụ.</li>" +
          "<li><b>Nên luận điểm không phải “băm xấu đắt hơn”, mà là “băm xấu không " +
          "đoán trước được”.</b> Công thức vẫn mô tả đúng cái trung bình, nhưng nó " +
          "<b>mất tư cách làm một lời hứa</b>: bạn không đặt được cam kết nào lên nó. " +
          "Với một bộ lọc chặn truy vấn đĩa hay lọc spam, “trung bình thì ổn” không " +
          "phải điều bạn cần biết — bạn cần biết <i>trường hợp xấu</i>.</li>" +
          "<li><b>Vì sao:</b> hai chỗ hỏng cộng lại. k giá trị khởi đầu FNV trên chuỗi " +
          "<i>ngắn</i> cho ra k kết quả tương quan; và bit thấp của FNV-1a trộn rất " +
          "yếu, mà <code>% m</code> với m là luỹ thừa 2 thì <i>chỉ</i> dùng bit thấp. " +
          "Kết quả phụ thuộc nặng vào chính bộ chuỗi khoá — nên đổi dữ liệu là đổi " +
          "kết quả.</li>" +
          "</ul>" +
          "<b>Đường cong theo k</b> có <b>đáy</b>: ít băm quá thì mỗi khoá để lại quá " +
          "ít dấu vết, nhiều băm quá thì mảng bit đặc cứng. Công thức nói đáy ở " +
          "<code>k* = (m/n)·ln2</code>." +
          "<ul>" +
          "<li><b>Bài học thực dụng:</b> khi chọn tham số Bloom filter cho hệ thống " +
          "thật, đừng chỉ cắm số vào công thức. Công thức mô tả một bộ lọc <i>lý " +
          "tưởng hoá</i>; cái bạn cài đặt phải <b>đo</b> mới biết — và phải đo " +
          "<b>nhiều lần</b>, vì một lần chạy không nói lên điều gì.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
