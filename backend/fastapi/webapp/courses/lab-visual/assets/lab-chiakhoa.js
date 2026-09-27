/* =====================================================================
   lab-chiakhoa.js — n chia khoa, n o khoa, ghep dung cap.

   Luat nghiem ngat: ban CHI so duoc mot chia voi mot o, va chi biet
   "chia nho hon / vua / to hon". KHONG so duoc chia voi chia, cung khong
   so duoc o voi o.

   Nghe thi tuong khong sap xep duoc — sap xep can so hai vat CUNG LOAI.
   Nhung van dat duoc n log n, bang mot meo: lay mot O lam truc de chia
   doi dam CHIA, roi lay chinh chia vua khop do lam truc de chia doi dam
   O. Hai ben MUON TRUC CUA NHAU.

   Va mot ket qua do duoc ma tiem can khong noi: thuat toan ngau nhien
   chi thang tu n ~ 50 tro len. Duoi do vet can con it phep hon.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var CACH = [
    { ma: "vet-can", ten: "Vét cạn", ghi: "mỗi chìa thử lần lượt từng ổ còn lại" },
    { ma: "ngau-nhien", ten: "Ngẫu nhiên chia đôi", ghi: "mượn trục của nhau" }
  ];

  /** So sanh: -1 chia nho hon o, 0 vua, 1 to hon. Co DEM. */
  function so(s, k, o) { s.dem++; return k < o ? -1 : (k > o ? 1 : 0); }

  /** Vet can: voi tung chia, thu tung o chua dung. */
  function vetCan(n, R) {
    var s = { dem: 0, ghep: new Array(n), buoc: [] };
    var o = tron(day(n), R);
    var daDung = new Array(n).fill(false);
    for (var k = 0; k < n; k++) {
      for (var i = 0; i < n; i++) {
        if (daDung[i]) continue;
        var r = so(s, k, o[i]);
        s.buoc.push([k, i, r]);
        if (r === 0) { daDung[i] = true; s.ghep[k] = i; break; }
      }
    }
    s.thuTuO = o;
    return s;
  }

  /** Ngau nhien: lay mot O lam truc chia dam CHIA, roi lay chia vua khop
      lam truc chia dam O. Day la cho hay cua thuat toan nay. */
  function ngauNhien(n, R) {
    var s = { dem: 0, ghep: new Array(n), buoc: [] };
    var o = tron(day(n), R);
    var viTri = {};
    for (var i = 0; i < n; i++) viTri[o[i]] = i;

    (function di(ks, os) {
      if (!ks.length) return;
      if (ks.length === 1) { s.ghep[ks[0]] = viTri[os[0]]; return; }
      var truc = os[Math.floor(R() * os.length)];
      var kt = [], kp = [], khop = null;
      for (var a = 0; a < ks.length; a++) {
        var r = so(s, ks[a], truc);
        s.buoc.push([ks[a], viTri[truc], r]);
        if (r < 0) kt.push(ks[a]); else if (r > 0) kp.push(ks[a]); else khop = ks[a];
      }
      s.ghep[khop] = viTri[truc];
      var ot = [], op = [];
      for (var b = 0; b < os.length; b++) {
        if (os[b] === truc) continue;
        var r2 = so(s, khop, os[b]);
        s.buoc.push([khop, viTri[os[b]], r2]);
        if (r2 > 0) ot.push(os[b]); else op.push(os[b]);
      }
      di(kt, ot); di(kp, op);
    })(day(n), o.slice());

    s.thuTuO = o;
    return s;
  }

  function day(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function tron(a, R) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(R() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Can duoi: moi phep so cho 3 ket cuc, va co n! cach ghep. */
  function canDuoi(n) {
    var lg = 0;
    for (var i = 2; i <= n; i++) lg += Math.log(i);
    return Math.ceil(lg / Math.log(3));
  }

  demo({
    id: "chia-khoa",
    nhom: "Câu đố quyết định",
    mon: "L34",
    ten: "Thử chìa khoá — sắp xếp mà không so được hai chìa với nhau",
    moTa: "n chìa, n ổ, mỗi chìa vừa đúng một ổ. Bạn <b>chỉ so được chìa với ổ</b> — " +
          "không so được chìa với chìa. Nghe như không sắp xếp nổi, vậy mà vẫn đạt " +
          "<b>n log n</b>: mượn một <b>ổ</b> làm trục để chia đám chìa, rồi mượn " +
          "chính <b>chìa</b> vừa khớp làm trục để chia đám ổ.",

    dung: function (host) {
      var P = null, B = null;
      var n = 24;
      var kq = null;                    /* [{cach, s}] */
      var duong = [];                   /* [{n, vetCan, ngauNhien}] cho bieu do */

      var TS = V.thamSo([
        { ma: "soChia", ten: "Số chìa khoá", kieu: "so", min: 4, max: 120, buoc: 2, gt: 24 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 5,
          moTa: "Thuật toán ngẫu nhiên — đổi hạt vài lần trước khi kết luận." },
        { ma: "veDuong", ten: "Vẽ đường số phép theo n", kieu: "bat", gt: true,
          moTa: "Chạy cả hai cách ở mọi cỡ từ 4 tới n, lấy trung bình vài hạt giống." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ n = 8 — vét cạn còn THẮNG", gt: { soChia: 8 } },
          { ten: "★ n = 40 — hai bên hoà nhau", gt: { soChia: 40 } },
          { ten: "★ n = 56 — ngẫu nhiên đã thắng chắc", gt: { soChia: 56 } },
          { ten: "n = 120 — ngẫu nhiên bỏ xa", gt: { soChia: 120 } },
          { ten: "n = 4 — nhỏ nhất, soi từng phép", gt: { soChia: 4 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.70, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================ */
      function apDung() {
        if (!cv.W) return;
        n = Math.round(G.soChia);
        var hat = Math.round(G.hat) || 1;
        kq = [
          { cach: CACH[0], s: vetCan(n, V.rng(hat)) },
          { cach: CACH[1], s: ngauNhien(n, V.rng(hat)) }
        ];

        /* Duong so phep theo n — chay that, khong ve theo cong thuc. */
        duong = [];
        if (G.veDuong) {
          var buoc = Math.max(2, Math.round(n / 24) * 2);
          for (var m = 4; m <= n; m += buoc) {
            var a = 0, b = 0, L = 5;
            for (var t = 0; t < L; t++) {
              a += vetCan(m, V.rng(hat + t * 31)).dem;
              b += ngauNhien(m, V.rng(hat + t * 31)).dem;
            }
            duong.push({ n: m, vc: a / L, nn: b / L });
          }
        }

        var chiaY = Math.round(cv.H * 0.46);
        var maxY = 1;
        duong.forEach(function (d) { maxY = Math.max(maxY, d.vc, d.nn); });
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 34, l: 70 },
          x: { min: 0, max: Math.max(8, n), nhan: "số chìa khoá (n)", vach: 5,
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 1, max: Math.max(10, maxY * 1.1), log: true,
               nhan: "số phép so", dinhDang: V.soGon },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        [[V.mau("ba"), "vét cạn — " + CACH[0].ghi],
         [V.mau("ac"), "ngẫu nhiên — " + CACH[1].ghi],
         [V.mau("tx3"), "cận dưới ⌈log₃(n!)⌉ — không cách nào phá nổi"]
        ].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + x[0] }), x[1]
          ]));
        });

        P.datToiDa(Math.max(kq[0].s.buoc.length, kq[1].s.buoc.length));
        P.datTocDo(60);
        P.datLai();
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veMotCach(i, k) {
        var s = kq[i].s;
        var chiaY = Math.round(cv.H * 0.46);
        var cao = chiaY / 2 - 10;
        var y0 = 10 + i * (cao + 10);
        var x0 = 70, rong = cv.W - x0 - 16;
        var w = rong / n;
        var hRow = Math.min(22, cao * 0.3);
        /* Nhan cach nam TREN ca hai hang; hai hang cua cung mot cach thi
           ke nhau, va phan thua don xuong duoi lam khe ngan cach voi cach
           tiep theo. Truoc day hang "o" cach hang "chia" toi 83px, tuc no
           nam sat nhan cua cach KE TIEP — doc luot qua la nhom nham. */
        var yChia = y0 + 24;
        var yO = Math.min(yChia + hRow + 46, y0 + cao - hRow - 4);

        /* Bao nhieu phep da chay toi buoc k. */
        var da = Math.min(k, s.buoc.length);
        var daGhep = new Array(n).fill(-1);
        for (var q = 0; q < da; q++) {
          if (s.buoc[q][2] === 0) daGhep[s.buoc[q][0]] = s.buoc[q][1];
        }

        g.save();
        g.font = "600 " + Math.max(8, Math.min(12, w * 0.5)) + "px ui-monospace,monospace";
        g.textAlign = "center"; g.textBaseline = "middle";

        /* Hang chia khoa (tren) va hang o (duoi). */
        for (var j = 0; j < n; j++) {
          var x = x0 + j * w;
          /* chia j — mau theo kich co that, de nguoi xem thay "thu tu dung" */
          g.fillStyle = daGhep[j] >= 0 ? V.mau("ok") : V.mau("bd");
          g.fillRect(x + 1, yChia, Math.max(1, w - 2), hRow);
          /* o thu j */
          g.fillStyle = V.thangMau(s.thuTuO[j] / Math.max(1, n - 1));
          g.fillRect(x + 1, yO, Math.max(1, w - 2), hRow);
        }

        /* Duong noi cac cap da ghep. */
        g.strokeStyle = V.mau("ok"); g.lineWidth = 1.2; g.globalAlpha = 0.75;
        g.beginPath();
        for (j = 0; j < n; j++) {
          if (daGhep[j] < 0) continue;
          g.moveTo(x0 + (j + 0.5) * w, yChia + hRow);
          g.lineTo(x0 + (daGhep[j] + 0.5) * w, yO);
        }
        g.stroke();
        g.globalAlpha = 1;

        /* Phep so dang thuc hien. */
        if (da > 0 && da <= s.buoc.length) {
          var b = s.buoc[da - 1];
          g.strokeStyle = V.mau("loi"); g.lineWidth = 2.2;
          g.beginPath();
          g.moveTo(x0 + (b[0] + 0.5) * w, yChia + hRow);
          g.lineTo(x0 + (b[1] + 0.5) * w, yO);
          g.stroke();
        }

        /* Nhan cach — mot dong duy nhat, nam tren ca hai hang. */
        g.fillStyle = i === 0 ? V.mau("ba") : V.mau("ac");
        g.font = "600 12px system-ui,sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(kq[i].cach.ten, 10, y0 + 2);
        /* Do be ngang KHI CON dung font vua ve — doi font roi moi do thi
           ra so cua font khac, va hai nhan chong len nhau. */
        var wTen = g.measureText(kq[i].cach.ten).width;
        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.fillText("· " + da + " / " + s.dem + " phép", 10 + wTen + 14, y0 + 3);

        /* Nhan tung hang — de khong phai doan hang nao la chia, hang nao la o. */
        g.font = "11px system-ui,sans-serif";
        g.textAlign = "right"; g.textBaseline = "middle";
        g.fillStyle = V.mau("tx3");
        g.fillText("chìa", x0 - 6, yChia + hRow / 2);
        g.fillText("ổ", x0 - 6, yO + hRow / 2);
        g.restore();
      }

      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        veMotCach(0, k);
        veMotCach(1, k);

        /* --- bieu do so phep theo n --- */
        B.truc();
        if (duong.length) {
          B.duong(duong.map(function (d) { return [d.n, Math.max(1, d.vc)]; }), V.mau("ba"), 2);
          B.duong(duong.map(function (d) { return [d.n, Math.max(1, d.nn)]; }), V.mau("ac"), 2);
          B.duong(duong.map(function (d) { return [d.n, Math.max(1, canDuoi(d.n))]; }),
                  V.mau("tx3"), 1.3);
          /* Danh dau cho hai duong cat nhau.

             KHONG lay cho giao DAU TIEN: hai duong chay sat nhau va con
             nhieu, nen cho giao dau tien nhay lung tung theo hat giong.
             Lay n nho nhat ma tu do tro len ngau nhien thang o MOI co da
             do — cho do on dinh, va cung la dieu nguoi doc muon biet. */
          var moc = -1;
          for (var i = duong.length - 1; i >= 0; i--) {
            if (duong[i].nn < duong[i].vc) moc = i; else break;
          }
          if (moc > 0) {
            var u = duong[moc];
            B.diem(u.n, u.nn, V.mau("loi"), 5);
            B.chu(u.n, u.nn, "từ n ≈ " + u.n + " trở lên, ngẫu nhiên thắng chắc",
                  V.mau("loi"));
          }
        }

        /* --- bang so lieu --- */
        var vc = kq[0].s.dem, nn = kq[1].s.dem, cd = canDuoi(n);
        var bang = {
          "Số chìa / ổ": n + " cặp",
          "Số cách ghép có thể": n <= 20 ? giaiThuaGon(n) : "n!  (rất lớn)",
          "Cận dưới ⌈log₃(n!)⌉": cd + " phép so",
          "Vét cạn": vc.toLocaleString("vi") + " phép   (" + (vc / cd).toFixed(1) + "× cận)",
          "Ngẫu nhiên": nn.toLocaleString("vi") + " phép   (" + (nn / cd).toFixed(1) + "× cận)",
          "Bên nào ít phép hơn": vc < nn
            ? "VÉT CẠN, ít hơn " + (nn - vc) + " phép"
            : nn < vc ? "ngẫu nhiên, ít hơn " + (vc - nn) + " phép" : "bằng nhau"
        };
        if (vc < nn) {
          bang["⚑ Chú ý"] = "n còn nhỏ nên hằng số ăn đứt tiệm cận — kéo n lên xem";
        }
        bang["Ghép đúng hết chưa"] = kiemGhep(kq[0].s) && kiemGhep(kq[1].s)
          ? "✔ cả hai cách đều ghép đúng toàn bộ" : "✘ có cặp sai";
        S.dat(bang);
      }

      function giaiThuaGon(n2) {
        var v = 1;
        for (var i = 2; i <= n2; i++) v *= i;
        return v.toLocaleString("vi");
      }

      /** Bat bien: ket qua ghep phai la mot song anh DUNG. */
      function kiemGhep(s) {
        var thay = {};
        for (var k = 0; k < s.ghep.length; k++) {
          var i = s.ghep[k];
          if (i === undefined || thay[i]) return false;
          thay[i] = 1;
          if (s.thuTuO[i] !== k) return false;
        }
        return true;
      }

      P = V.phat({
        ten: "chia-khoa",
        bang: cv,
        tocDo: 60,
        buoc: function () { return true; },
        datLai: function () {},
        ve: ve,
        nhan: function (k) {
          var a = Math.min(k, kq[0].s.buoc.length), b = Math.min(k, kq[1].s.buoc.length);
          return "vét cạn " + a + " · ngẫu nhiên " + b + " phép so";
        }
      });

      var r = V.khung(host, {
        ten: "chia-khoa",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật rất chặt:</b> bạn có n chìa và n ổ, mỗi chìa vừa đúng một ổ. Bạn " +
          "chỉ được <b>tra một chìa vào một ổ</b> và chỉ biết được <i>chìa nhỏ hơn, " +
          "vừa, hay to hơn</i>. <b>Không</b> so được chìa với chìa, <b>không</b> so " +
          "được ổ với ổ — chúng không cắm vào nhau được." +
          "<ul>" +
          "<li><b>Vì sao điều đó đáng nói:</b> mọi thuật toán sắp xếp bạn biết đều so " +
          "hai vật <i>cùng loại</i>. Ở đây phép so đó bị cấm. Nghe như không sắp xếp " +
          "nổi.</li>" +
          "<li><b>Mẹo:</b> lấy một <b>ổ</b> bất kỳ làm trục, tra mọi chìa vào nó → đám " +
          "chìa tách làm hai, và ta tìm được chìa khớp. Rồi lấy <b>chính chìa đó</b> " +
          "làm trục, tra nó vào mọi ổ → đám ổ cũng tách làm hai. <b>Hai bên mượn trục " +
          "của nhau.</b> Đệ quy xuống, ra đúng dáng quicksort: <b>Θ(n log n)</b>.</li>" +
          "</ul>" +
          "<b>★ Nhưng đo thật thì tiệm cận không phải câu chuyện đầy đủ.</b> Bấm preset " +
          "<i>n = 8</i>: <b>vét cạn ít phép hơn</b> — 24 so với 40. Θ(n²) thắng " +
          "Θ(n log n)." +
          "<ul>" +
          "<li>Lý do: cách ngẫu nhiên tốn <b>hai lượt quét</b> mỗi tầng (một cho chìa, " +
          "một cho ổ), nên hằng số của nó lớn. Còn vét cạn thì mỗi lần tìm thấy là " +
          "<i>bỏ luôn ổ đó</i> ra khỏi danh sách, nên nó chỉ tốn khoảng n²/4 chứ không " +
          "phải n².</li>" +
          "<li><b>Chỗ lật không phải một điểm, mà là một dải.</b> Đo qua 8 hạt giống: " +
          "ở <b>n = 24</b> vét cạn thắng <i>cả 8/8</i> lần; ở <b>n = 40</b> hai bên " +
          "<i>hoà</i> — ngẫu nhiên thắng 4/8; từ <b>n = 56</b> trở lên nó thắng " +
          "<i>8/8</i>. Bấm hai preset <i>n = 40</i> và <i>n = 56</i> rồi <b>đổi hạt " +
          "giống vài lần</b> mà xem: ở n = 40 người thắng <b>đổi theo hạt</b>, ở n = 56 " +
          "thì không. Cái dải nhoè ấy <i>chính là</i> bản chất của thuật toán ngẫu " +
          "nhiên — nó không có một con số, nó có một phân phối.</li>" +
          "<li>Qua khỏi dải đó thì ngẫu nhiên bỏ xa dần: ở <b>n = 120</b> nó nhanh hơn " +
          "<b>2,2 lần</b>, và khoảng cách còn giãn mãi.</li>" +
          "<li><b>Bài học:</b> “Θ(n log n) tốt hơn Θ(n²)” là phát biểu về <i>giới hạn " +
          "khi n → ∞</i>. Nó không nói gì về n = 8. Chọn thuật toán theo tiệm cận mà " +
          "không nhìn quy mô thật là một cái bẫy rất phổ biến.</li>" +
          "</ul>" +
          "<b>Cận dưới.</b> Có <b>n!</b> cách ghép, và mỗi phép so cho <b>3</b> kết cục, " +
          "nên không thuật toán nào dùng ít hơn <code>⌈log₃(n!)⌉</code> phép — đường xám " +
          "trên biểu đồ. Cả hai cách đều nằm trên nó; ngẫu nhiên bám sát hơn khi n lớn. " +
          "Ô <i>Ghép đúng hết chưa</i> kiểm lại rằng kết quả thật sự là một song ánh " +
          "đúng, không phải chỉ “chạy xong”."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
