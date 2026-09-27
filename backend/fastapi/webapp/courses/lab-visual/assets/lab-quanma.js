/* =====================================================================
   lab-quanma.js — Hai quan ma, hai o dich: ai toi truoc?

   Khoang cach cua quan ma KHONG PHAI khoang cach hinh hoc. Do bang BFS
   tren ban 8x8, tu o a1:

     a1 -> b2   ke cheo, cach 1 o      = 4 nuoc
     a1 -> e3   cach 4 o, xa gap bon   = 2 nuoc
     a1 -> h8   goc doi goc, cach 7 o  = 6 nuoc

   Di xa gap bon lan ma ton NUA so nuoc. Ly do: quan ma khong co nuoc di
   ngan. Moi nuoc cua no deu nhay 1-2, nen muon nhich mot o cheo thi phai
   di vong — con nhung o cach vai o lai roi dung vao tam nhay cua no.

   Lab chay BFS THAT tu ca hai quan ma cung luc — mau cua tung o la so nuoc
   toi o do, va hai lan song lan ra cho ta thay "hinh dang" cua khoang cach
   nay, no khong tron ma lom chom.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var NUOC = [[1, 2], [2, 1], [-1, 2], [-2, 1],
              [1, -2], [2, -1], [-1, -2], [-2, -1]];

  /** BFS tu mot o. Tra ve mang khoang cach, -1 la khong toi duoc. */
  function lanSong(N, sx, sy) {
    var d = new Int16Array(N * N);
    for (var i = 0; i < N * N; i++) d[i] = -1;
    d[sy * N + sx] = 0;
    var hang = [sy * N + sx];
    for (var h = 0; h < hang.length; h++) {
      var o = hang[h], x = o % N, y = (o / N) | 0;
      for (var k = 0; k < 8; k++) {
        var nx = x + NUOC[k][0], ny = y + NUOC[k][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var j = ny * N + nx;
        if (d[j] >= 0) continue;
        d[j] = d[o] + 1;
        hang.push(j);
      }
    }
    return d;
  }

  /** Mot duong di ngan nhat tu (sx,sy) toi (tx,ty), doc nguoc tu bang d. */
  function duongDi(N, d, sx, sy, tx, ty) {
    if (d[ty * N + tx] < 0) return [];
    var duong = [[tx, ty]], x = tx, y = ty;
    while (!(x === sx && y === sy)) {
      var cuoi = d[y * N + x], tiep = null;
      for (var k = 0; k < 8; k++) {
        var nx = x + NUOC[k][0], ny = y + NUOC[k][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (d[ny * N + nx] === cuoi - 1) { tiep = [nx, ny]; break; }
      }
      if (!tiep) break;
      duong.push(tiep);
      x = tiep[0]; y = tiep[1];
    }
    return duong.reverse();
  }

  function tenO(N, x, y) {
    return String.fromCharCode(97 + x) + (N - y);
  }

  demo({
    id: "quan-ma",
    nhom: "Câu đố quyết định",
    mon: "L33",
    ten: "Quân mã — hai ô kề nhau mà tốn 4 nước",
    moTa: "Khoảng cách của quân mã <b>không phải</b> khoảng cách hình học. Từ ô a1 " +
          "trên bàn 8×8: tới <b>b2</b> — ô <i>kề chéo</i>, sát sạt — mất <b>4 nước</b>. " +
          "Tới <b>e3</b> — xa gấp bốn lần — chỉ mất <b>2 nước</b>. " +
          "Đi xa gấp bốn mà tốn nửa số nước.",

    dung: function (host) {
      var P = null, L = null, B = null;
      var N = 8;
      var dA = null, dB = null;         /* bang khoang cach cua hai quan ma */
      /* Mac dinh la CHINH cai nghich ly, do bang BFS tren ban 8x8:
           a1 -> b2  ke cheo, Chebyshev 1, = 4 nuoc
           a1 -> e3  Chebyshev 4 (xa gap bon), = 2 nuoc
         Di xa gap bon lan ma ton nua so nuoc. */
      var maA = [0, 7], maB = [0, 7];   /* ca hai cung xuat phat o a1 */
      var dichA = [1, 6];               /* b2 — ke cheo */
      var dichB = [4, 5];               /* e3 — xa gap bon */
      var buocDem = 0;
      var dangDat = "maA";              /* chuot dang dat cai gi */

      var TS = V.thamSo([
        { ma: "canh", ten: "Cạnh bàn cờ", kieu: "so", min: 3, max: 16, buoc: 1, gt: 8 },
        { ma: "hien", ten: "Tô màu theo", kieu: "chon", gt: "ca-hai", muc: [
          { v: "ca-hai", t: "Ai tới trước — hai làn sóng" },
          { v: "ma-a",   t: "Khoảng cách từ mã trắng" },
          { v: "ma-b",   t: "Khoảng cách từ mã đen" },
          { v: "hieu",   t: "Chênh lệch giữa hai mã" }
        ] },
        { ma: "veDuong", ten: "Vẽ đường đi ngắn nhất", kieu: "bat", gt: true },
        { ma: "veSo", ten: "Ghi số nước lên từng ô", kieu: "bat", gt: true,
          moTa: "Tắt đi khi bàn cờ lớn — chữ sẽ quá bé để đọc." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ Kề chéo (4) vs xa gấp bốn (2)", gt: { canh: 8 },
            sau: function () { maA = [0, 7]; dichA = [1, 6]; maB = [0, 7]; dichB = [4, 5]; apDung(); } },
          { ten: "★ Góc đối góc a1 → h8 (6 nước)", gt: { canh: 8 },
            sau: function () { maA = [0, 7]; dichA = [7, 0]; maB = [0, 7]; dichB = [1, 6]; apDung(); } },
          { ten: "Đua thật: hai mã hai góc", gt: { canh: 8 },
            sau: function () { maA = [0, 7]; dichA = [7, 0]; maB = [7, 0]; dichB = [0, 7]; apDung(); } },
          { ten: "★ Bàn 3×3 — ô giữa KHÔNG TỚI ĐƯỢC", gt: { canh: 3 } },
          { ten: "★ Bàn 4×4 — nhỏ bằng 1/4 mà xa gần bằng 8×8", gt: { canh: 4 } },
          { ten: "Bàn 5×5 — to hơn 4×4 mà lại dễ đi hơn", gt: { canh: 5 } },
          { ten: "Bàn 12×12", gt: { canh: 12, veSo: false } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.66, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================ */
      function kep(p) {
        return [Math.max(0, Math.min(N - 1, p[0])), Math.max(0, Math.min(N - 1, p[1]))];
      }

      function apDung() {
        if (!cv.W) return;
        N = Math.round(G.canh);
        maA = kep(maA); maB = kep(maB);
        dichA = kep(dichA); dichB = kep(dichB);

        dA = lanSong(N, maA[0], maA[1]);
        dB = lanSong(N, maB[0], maB[1]);
        buocDem = 0;

        var chiaY = Math.round(cv.H * 0.70);
        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 22,
                          leDuoi: cv.H - chiaY });
        L.bangMau(bangMau());
        B = V.bieuDo(cv, {
          le: { t: chiaY + 26, r: 18, b: 34, l: 62 },
          x: { min: -0.5, max: Math.max(1, doXa()) + 0.5, nhan: "số nước của quân mã",
               vach: Math.max(1, doXa()),
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 0, max: Math.max(1, donhat()), nhan: "số ô",
               dinhDang: function (v) { return String(Math.round(v)); } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        [["ok", "mã trắng tới trước"], ["ac", "mã đen tới trước"],
         ["ba", "hai mã hoà"], ["loi", "KHÔNG mã nào tới được"]].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + V.mau(x[0]) }), x[1]
          ]));
        });
        ghiChu.appendChild(V.el("span", {
          text: "· bấm vào ô để đặt: " + tenDat()
        }));

        P.datToiDa(Math.max(1, doXa()));
        P.datLai();
      }

      function doXa() {
        var m = 0;
        for (var i = 0; i < N * N; i++) if (dA[i] > m) m = dA[i];
        return m;
      }
      function donhat() {
        var dem = {}, m = 0;
        for (var i = 0; i < N * N; i++) {
          if (dA[i] < 0) continue;
          dem[dA[i]] = (dem[dA[i]] || 0) + 1;
          if (dem[dA[i]] > m) m = dem[dA[i]];
        }
        return m;
      }

      /* Bang mau: 0 = nen sang, 1 = nen toi, 2.. = cac muc. */
      function bangMau() {
        var ds = [V.mau("surf2"), V.mau("bg2")];
        /* Muc mau theo khoang cach — dung thang mau cua trang. */
        for (var k = 0; k <= 24; k++) ds.push(V.thangMau(Math.min(1, k / 12)));
        ds.push(V.mau("ok"));    /* 27: A truoc */
        ds.push(V.mau("ac"));    /* 28: B truoc */
        ds.push(V.mau("ba"));    /* 29: hoa */
        ds.push(V.mau("loi"));   /* 30: khong toi duoc */
        return ds;
      }

      function tenDat() {
        return { maA: "mã trắng", maB: "mã đen",
                 dichA: "đích của mã trắng", dichB: "đích của mã đen" }[dangDat];
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* --- to mau ban co --- */
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var i = y * N + x, m;
            var a = dA[i], b = dB[i];
            var hien = (a >= 0 && a <= k) || (b >= 0 && b <= k);
            if (G.hien === "ca-hai") {
              if (a < 0 && b < 0) m = 30;
              else if (!hien) m = (x + y) % 2 ? 1 : 0;
              else if (a < 0) m = 28;
              else if (b < 0) m = 27;
              else m = a < b ? 27 : (b < a ? 28 : 29);
            } else if (G.hien === "hieu") {
              if (a < 0 || b < 0) m = 30;
              else m = a < b ? 27 : (b < a ? 28 : 29);
            } else {
              var d = G.hien === "ma-a" ? a : b;
              if (d < 0) m = 30;
              else if (d > k) m = (x + y) % 2 ? 1 : 0;
              else m = 2 + Math.min(24, d);
            }
            L.dat(x, y, m);
          }
        }
        L.dan();
        L.vien();

        var o = L.oTai ? null : null;
        var t = L.trong ? null : null;
        /* Kich thuoc mot o, suy tu vien luoi. */
        var hop = viTriO(0, 0), hop2 = viTriO(1, 1);
        var canh = hop2.x - hop.x;

        /* --- so nuoc tren tung o --- */
        if (G.veSo && canh > 16) {
          g.save();
          g.font = "600 " + Math.max(9, Math.round(canh * 0.34)) + "px ui-monospace,monospace";
          g.textAlign = "center"; g.textBaseline = "middle";
          for (y = 0; y < N; y++) {
            for (x = 0; x < N; x++) {
              var p = viTriO(x, y), dd = G.hien === "ma-b" ? dB[y * N + x] : dA[y * N + x];
              if (dd < 0) continue;
              if (G.hien === "ca-hai" || G.hien === "hieu") {
                dd = Math.min(dA[y * N + x] < 0 ? 99 : dA[y * N + x],
                              dB[y * N + x] < 0 ? 99 : dB[y * N + x]);
                if (dd === 99) continue;
              }
              /* So phai theo kip mau: neu khong, chay tu buoc 0 da thay het
                 so roi, va lan song khong con y nghia gi. */
              if (dd > k) continue;
              g.fillStyle = V.mau("tx");
              g.fillText(String(dd), p.x + canh / 2, p.y + canh / 2);
            }
          }
          g.restore();
        }

        /* --- duong di ngan nhat --- */
        if (G.veDuong) {
          veDuong(duongDi(N, dA, maA[0], maA[1], dichA[0], dichA[1]), V.mau("ok"), canh);
          veDuong(duongDi(N, dB, maB[0], maB[1], dichB[0], dichB[1]), V.mau("ac"), canh);
        }

        /* --- quan ma va dich --- */
        /* Hai ma co the cung mot o (mac dinh la vay) — lech sang hai ben
           de van nhin ra ca hai. */
        var chung = maA[0] === maB[0] && maA[1] === maB[1];
        veQuan(maA, "♘", V.mau("ok"), canh, chung ? -0.18 : 0);
        veQuan(maB, "♞", V.mau("ac"), canh, chung ? 0.18 : 0);
        veDich(dichA, V.mau("ok"), canh);
        veDich(dichB, V.mau("ac"), canh);

        /* --- bieu do: bao nhieu o o moi khoang cach --- */
        var dem = [];
        for (var i2 = 0; i2 < N * N; i2++) {
          var d2 = dA[i2];
          if (d2 < 0) continue;
          dem[d2] = (dem[d2] || 0) + 1;
        }
        B.truc();
        for (var q = 0; q < dem.length; q++) {
          if (!dem[q]) continue;
          B.cot(q, dem[q], 0.7, q <= k ? V.mau("ok") : V.mau("bd"));
        }
        g.save();
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "bottom";
        g.fillText("Bao nhiêu ô cách mã trắng đúng k nước — cột sáng là đã tới",
                   14, Math.round(cv.H * 0.70) + 18);
        g.restore();

        /* --- bang so lieu --- */
        var kcA = dA[dichA[1] * N + dichA[0]];
        var kcB = dB[dichB[1] * N + dichB[0]];
        var hhA = Math.max(Math.abs(dichA[0] - maA[0]), Math.abs(dichA[1] - maA[1]));
        var hhB = Math.max(Math.abs(dichB[0] - maB[0]), Math.abs(dichB[1] - maB[1]));
        var khongToi = 0;
        for (i2 = 0; i2 < N * N; i2++) if (dA[i2] < 0) khongToi++;

        var bang = {
          "Bàn cờ": N + " × " + N + " = " + (N * N) + " ô",
          "Mã trắng": tenO(N, maA[0], maA[1]) + " → " + tenO(N, dichA[0], dichA[1]) +
            "   " + (kcA < 0 ? "KHÔNG TỚI ĐƯỢC" : kcA + " nước"),
          "Mã đen": tenO(N, maB[0], maB[1]) + " → " + tenO(N, dichB[0], dichB[1]) +
            "   " + (kcB < 0 ? "KHÔNG TỚI ĐƯỢC" : kcB + " nước"),
          "Ai tới trước": kcA < 0 && kcB < 0 ? "không mã nào tới được"
            : kcA < 0 ? "mã đen" : kcB < 0 ? "mã trắng"
            : kcA < kcB ? "mã trắng (sớm hơn " + (kcB - kcA) + " nước)"
            : kcB < kcA ? "mã đen (sớm hơn " + (kcA - kcB) + " nước)" : "hoà",
          "— So với hình học —": "",
          "Mã trắng đi xa": hhA + " ô (Chebyshev)  →  " + (kcA < 0 ? "∞" : kcA) + " nước",
          "Mã đen đi xa": hhB + " ô (Chebyshev)  →  " + (kcB < 0 ? "∞" : kcB) + " nước",
          "Ô xa nhất trên bàn": doXa() + " nước"
        };
        if (khongToi) {
          bang["⚑ Ô không tới được"] = khongToi + " ô — bàn quá nhỏ, mã không xoay xở nổi";
        }
        bang["Đang đặt"] = tenDat() + " — bấm vào ô để đổi";
        S.dat(bang);
      }

      function viTriO(x, y) {
        /* luoiO khong lo vi tri ra ngoai, nen tinh lai tu chinh tham so. */
        var chiaY = Math.round(cv.H * 0.70);
        var le = 10, leTren = 22;
        var W = cv.W - le * 2, H = chiaY - leTren;
        var canh = Math.min(W / N, H / N);
        var rong = canh * N, cao = canh * N;
        return { x: le + (W - rong) / 2 + x * canh,
                 y: leTren + (H - cao) / 2 + y * canh, canh: canh };
      }

      function veDuong(duong, mau, canh) {
        if (duong.length < 2) return;
        g.save();
        g.strokeStyle = mau; g.lineWidth = Math.max(2, canh * 0.07);
        g.globalAlpha = 0.9;
        g.beginPath();
        for (var i = 0; i < duong.length; i++) {
          var p = viTriO(duong[i][0], duong[i][1]);
          var cx = p.x + canh / 2, cy = p.y + canh / 2;
          if (i === 0) g.moveTo(cx, cy); else g.lineTo(cx, cy);
        }
        g.stroke();
        /* Cham tron o tung diem dung. */
        g.fillStyle = mau;
        for (i = 1; i < duong.length - 1; i++) {
          var p2 = viTriO(duong[i][0], duong[i][1]);
          g.beginPath();
          g.arc(p2.x + canh / 2, p2.y + canh / 2, canh * 0.1, 0, 6.2832);
          g.fill();
        }
        g.restore();
      }

      function veQuan(o, ky, mau, canh, lech) {
        var p = viTriO(o[0], o[1]);
        var cx = p.x + canh * (0.5 + (lech || 0));
        g.save();
        g.font = Math.round(canh * 0.72) + "px serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.strokeStyle = V.mau("surf"); g.lineWidth = 3;
        g.strokeText(ky, cx, p.y + canh / 2);
        g.fillStyle = mau;
        g.fillText(ky, cx, p.y + canh / 2);
        g.restore();
      }

      function veDich(o, mau, canh) {
        var p = viTriO(o[0], o[1]);
        g.save();
        g.strokeStyle = mau; g.lineWidth = Math.max(2, canh * 0.08);
        g.strokeRect(p.x + canh * 0.14, p.y + canh * 0.14, canh * 0.72, canh * 0.72);
        g.restore();
      }

      /* ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        var p0 = viTriO(0, 0), canh = viTriO(1, 1).x - p0.x;
        var x = Math.floor((mx - p0.x) / canh), y = Math.floor((my - p0.y) / canh);
        if (x < 0 || y < 0 || x >= N || y >= N) return;
        if (dangDat === "maA") maA = [x, y];
        else if (dangDat === "maB") maB = [x, y];
        else if (dangDat === "dichA") dichA = [x, y];
        else dichB = [x, y];
        /* Tu chuyen sang muc tiep theo — bam bon cai lien tuc la xong. */
        dangDat = { maA: "dichA", dichA: "maB", maB: "dichB", dichB: "maA" }[dangDat];
        apDung();
      });

      P = V.phat({
        ten: "quan-ma",
        bang: cv,
        tocDo: 1.2,
        buoc: function () { buocDem++; return buocDem < doXa(); },
        datLai: function () { buocDem = 0; },
        ve: function (k) { ve(k); },
        nhan: function (k) {
          return "làn sóng đã lan " + k + " nước";
        }
      });

      var r = V.khung(host, {
        ten: "quan-ma",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Quân mã đi hình chữ L</b> — hai ô theo một hướng rồi một ô theo hướng " +
          "vuông góc. Lab chạy <b>BFS thật</b> từ mỗi quân mã: màu của một ô là số " +
          "nước ít nhất để tới ô đó, và bấm <i>Chạy</i> để xem hai làn sóng lan ra." +
          "<ul>" +
          "<li><b>★ Mặc định đã là nghịch lý:</b> mã trắng đi <b>a1 → b2</b>, hai ô " +
          "<i>kề chéo nhau</i> — <b>4 nước</b>. Mã đen đi <b>a1 → e3</b>, xa gấp bốn " +
          "lần — <b>2 nước</b>. Cùng xuất phát một ô, <b>đi xa gấp bốn mà tốn nửa số " +
          "nước</b>.</li>" +
          "<li>Bấm preset <i>★ Góc đối góc</i>: a1 → h8 là xa nhất có thể về hình học, " +
          "và đúng là xa nhất về nước mã luôn — <b>6 nước</b>. Nên không phải hình học " +
          "<i>vô can</i>, chỉ là nó không quyết định.</li>" +
          "</ul>" +
          "<b>Vì sao?</b> Quân mã không có nước đi ngắn. Mỗi nước của nó đều nhảy 1–2, " +
          "nên muốn nhích <i>một ô chéo</i> nó phải đi vòng: b2 chỉ tới được từ những ô " +
          "cách b2 một nước mã, mà từ a1 tới những ô đó đã mất 3 nước rồi. Còn e3 thì " +
          "<i>rơi đúng vào tầm nhảy</i>. <b>Khoảng cách trên đồ thị không liên quan gì " +
          "tới khoảng cách trên mặt phẳng</b> — nó chỉ phụ thuộc vào <i>bạn được phép " +
          "đi những nước nào</i>." +
          "<ul>" +
          "<li><b>Bấm vào ô để đặt</b> — mỗi lần bấm đặt một thứ rồi tự chuyển sang " +
          "thứ tiếp: mã trắng → đích trắng → mã đen → đích đen. Bấm bốn cái là xong " +
          "một thế cờ.</li>" +
          "<li><b>Đổi “tô màu theo”</b> sang <i>khoảng cách từ mã trắng</i> để thấy " +
          "hình dạng thật của làn sóng: nó <b>không tròn</b>, mà lồi lõm — vì tập nước " +
          "đi của quân mã không đối xứng tròn.</li>" +
          "<li><b>★ Preset “bàn 3×3”:</b> <b>ô giữa không bao giờ tới được</b> — từ " +
          "đâu cũng không, vì cả tám nước mã xuất phát từ ô giữa đều rơi ra ngoài bàn. " +
          "Nó là một đỉnh <i>cô lập</i>: đồ thị nước đi vỡ thành hai mảnh rời, và một " +
          "mảnh chỉ có đúng một ô.</li>" +
          "<li><b>★ Rồi so ba bàn nhỏ với nhau</b> — ô xa nhất tính từ a1: " +
          "<b>4×4 (16 ô) → 5 nước</b>, <b>5×5 (25 ô) → 4 nước</b>, " +
          "<b>8×8 (64 ô) → 6 nước</b>. Bàn <i>to gấp bốn</i> mà chỉ tốn thêm " +
          "<i>một</i> nước; còn bàn 5×5 <b>to hơn 4×4 mà lại dễ đi hơn</b> — thêm " +
          "chỗ xoay xở đáng giá hơn là bớt quãng đường. Cũng vẫn một chuyện: " +
          "khoảng cách trên đồ thị không đi theo diện tích.</li>" +
          "<li>Biểu đồ dưới đếm <b>bao nhiêu ô ở đúng k nước</b>. Nó phình ra rồi tóp " +
          "lại — và chỗ phình cho biết quân mã “phủ” bàn cờ nhanh cỡ nào.</li>" +
          "</ul>" +
          "<b>Đây là BFS, không phải công thức.</b> Có công thức đóng cho khoảng cách " +
          "mã trên bàn vô hạn, nhưng trên bàn <i>có biên</i> thì nó sai — chính cái " +
          "biên làm quân mã phải đi vòng. Lab này lan sóng thật nên nó đúng ở mọi kích " +
          "thước bàn, kể cả những bàn nhỏ mà công thức bó tay."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
