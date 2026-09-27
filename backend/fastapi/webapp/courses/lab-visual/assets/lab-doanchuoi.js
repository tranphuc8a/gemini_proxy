/* =====================================================================
   lab-doanchuoi.js — Doan mot chuoi n ky tu, moi lan doan duoc bao:
   bao nhieu o DUNG VI TRI, bao nhieu o dung ky tu nhung SAI VI TRI.

   Day la Mastermind. Voi n = 4 va 6 ky tu thi co 1296 chuoi, va moi lan
   doan tra ve mot trong 14 phan hoi. Can duoi ly thuyet thong tin noi
   log_14(1296) = 2,74 -> 3 lan doan. That te la 5.

   Dieu bat ngo: de dat duoc 5, co luc ban phai doan mot chuoi ma BAN DA
   BIET CHAC KHONG PHAI DAP AN. Doan nhu vay khong bao gio thang ngay,
   nhung no chia nho tap ung vien tot hon. Lab do duoc dung cho do —
   cung mot chien luoc, chi khac o cho duoc phep doan gi:

       chi doan ung vien con lai  -> xau nhat 6
       duoc doan moi chuoi        -> xau nhat 5
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var KY_TU = "ABCDEF12".split("");

  /** Phan hoi goi gon thanh mot so: dung * (n+1) + saiViTri. */
  function phanHoi(g, s, n, c, dg, ds) {
    var b = 0, i;
    for (i = 0; i < c; i++) { dg[i] = 0; ds[i] = 0; }
    for (i = 0; i < n; i++) {
      if (g[i] === s[i]) b++;
      else { dg[g[i]]++; ds[s[i]]++; }
    }
    var w = 0;
    for (i = 0; i < c; i++) w += dg[i] < ds[i] ? dg[i] : ds[i];
    return b * (n + 1) + w;
  }

  function moiChuoi(n, c) {
    var tong = Math.pow(c, n), ds = [];
    for (var i = 0; i < tong; i++) {
      var a = new Int32Array(n), v = i;
      for (var j = 0; j < n; j++) { a[j] = v % c; v = (v / c) | 0; }
      ds.push(a);
    }
    return ds;
  }

  /** Lay mau deu — de gioi han chi phi tim kiem ma van trai khap khong gian. */
  function layMau(A, tran) {
    if (A.length <= tran) return A;
    var r = [], b = A.length / tran;
    for (var i = 0; i < tran; i++) r.push(A[Math.floor(i * b)]);
    return r;
  }

  var CHIEN_LUOC = [
    { ma: "dau-tien", ten: "Đoán đại — lấy ứng viên đầu tiên", moRong: false,
      ghi: "không tính toán gì, chỉ cần không mâu thuẫn" },
    { ma: "minimax", ten: "Minimax — thu nhỏ nhánh tệ nhất", moRong: false,
      ghi: "chọn nước làm nhóm lớn nhất bé đi" },
    { ma: "entropy", ten: "Entropy — lấy nhiều thông tin nhất", moRong: false,
      ghi: "chọn nước chia ứng viên đều nhất" },
    { ma: "entropy-mr", ten: "★ Entropy, được đoán cả chuỗi sai", moRong: true,
      ghi: "dám hỏi câu mà mình biết chắc không phải đáp án" }
  ];

  demo({
    id: "doan-chuoi",
    nhom: "Câu đố quyết định",
    mon: "L31",
    ten: "Đoán chuỗi — và câu hỏi mà bạn biết chắc là sai",
    moTa: "Mastermind: đoán chuỗi n ký tự, mỗi lần được báo bao nhiêu ô " +
          "<b>đúng vị trí</b> và bao nhiêu ô <b>sai vị trí</b>. Điều bất ngờ đo được " +
          "ở đây: muốn đạt tối ưu, đôi khi phải đoán một chuỗi mà bạn " +
          "<b>đã biết chắc không phải đáp án</b>.",

    dung: function (host) {
      var P = null, B = null, K = null;
      var n = 4, c = 6;
      var TAT = null, moDau = null;
      var dg = null, ds = null;
      var thongKe = null;               /* [{dem: [], xau, tong, van}] */
      var canDuoi = 0, soPhanHoi = 0;
      var Rnd = null;

      /* Van cua nguoi choi */
      var bimat = null, lsDoan = [], nhap = null, loiChoi = "";

      var TS = V.thamSo([
        { ma: "doDai", ten: "Độ dài chuỗi (n)", kieu: "so", min: 2, max: 5, buoc: 1, gt: 4 },
        { ma: "soKyTu", ten: "Số ký tự khác nhau", kieu: "so", min: 2, max: 8, buoc: 1, gt: 6 },
        { ma: "tranTim", ten: "Xét tối đa bao nhiêu nước mỗi lượt", kieu: "so",
          min: 50, max: 1300, buoc: 50, gt: 600,
          moTa: "Không gian nước đi quá lớn để duyệt hết, nên chỉ <b>lấy mẫu đều</b> " +
                "bấy nhiêu nước.<br><b>Hạ xuống 300 và luận điểm chính của lab biến " +
                "mất</b> — đo được: ở 600 thì bản “được đoán cả chuỗi sai” đạt xấu " +
                "nhất 5, ở 300 thì không. Chính nó cũng là một bài học." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 5 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ 4 ký tự, 6 loại — Mastermind gốc", gt: { doDai: 4, soKyTu: 6 } },
          { ten: "★ 5 ký tự, 6 loại", gt: { doDai: 5, soKyTu: 6, tranTim: 200 } },
          { ten: "3 ký tự — nhỏ, chạy nhanh", gt: { doDai: 3, soKyTu: 6 } },
          { ten: "4 ký tự, 8 loại — khó hơn", gt: { doDai: 4, soKyTu: 8, tranTim: 200 } },
          { ten: "2 ký tự — bé nhất", gt: { doDai: 2, soKyTu: 4 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.72, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Chien luoc
         ============================================================ */
      function chonNuoc(ungVien, kieu, moRong) {
        if (ungVien.length <= 2) return ungVien[0];
        if (kieu === "dau-tien") return ungVien[0];
        var pool = layMau(moRong ? TAT : ungVien, Math.round(G.tranTim));
        var tot = ungVien[0], diemTot = Infinity;
        for (var i = 0; i < pool.length; i++) {
          var gm = pool[i];
          var dem = new Map(), max = 0;
          for (var j = 0; j < ungVien.length; j++) {
            var k = phanHoi(gm, ungVien[j], n, c, dg, ds);
            var v = (dem.get(k) || 0) + 1;
            dem.set(k, v);
            if (v > max) max = v;
          }
          var d;
          if (kieu === "entropy") {
            d = 0;
            dem.forEach(function (v2) {
              var p = v2 / ungVien.length;
              d += p * Math.log(p) / Math.LN2;       /* = -entropy, cang be cang tot */
            });
          } else d = max;
          if (d < diemTot) { diemTot = d; tot = gm; }
        }
        return tot;
      }

      /** Choi tron mot van, tra ve so lan doan. */
      function choiMotVan(bm, kieu, moRong) {
        var ungVien = TAT, lan = 0, gm = moDau;
        for (var vong = 0; vong < 20; vong++) {
          lan++;
          var p = phanHoi(gm, bm, n, c, dg, ds);
          if (p === n * (n + 1)) return lan;
          var moi = [];
          for (var i = 0; i < ungVien.length; i++) {
            if (phanHoi(gm, ungVien[i], n, c, dg, ds) === p) moi.push(ungVien[i]);
          }
          ungVien = moi;
          if (!ungVien.length) return 99;             /* khong bao gio xay ra */
          gm = chonNuoc(ungVien, kieu, moRong);
        }
        return 99;
      }

      /* ============================================================
         Chuan bi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        n = Math.round(G.doDai); c = Math.round(G.soKyTu);
        TAT = moiChuoi(n, c);
        dg = new Int32Array(c); ds = new Int32Array(c);
        /* Mo dau co dinh: nua dau mot ky tu, nua sau mot ky tu khac. Knuth
           dung 1122 cho 4x6 — day la cung y tuong, tong quat hoa. */
        moDau = new Int32Array(n);
        for (var i = 0; i < n; i++) moDau[i] = Math.min(c - 1, (i / 2) | 0);

        soPhanHoi = (n + 1) * (n + 2) / 2 - 1;
        canDuoi = V.canThongTin(TAT.length, soPhanHoi);

        thongKe = CHIEN_LUOC.map(function () {
          return { dem: new Int32Array(21), xau: 0, tong: 0, van: 0 };
        });

        Rnd = V.rng(Math.round(G.hat) || 1);
        batDauVan();

        var chiaY = Math.round(cv.H * 0.52);
        B = V.bieuDo(cv, {
          le: { t: 22, r: 16, b: cv.H - chiaY + 16, l: 58 },
          x: { min: 0.5, max: 10.5, nhan: "số lần đoán để tìm ra", vach: 10,
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 0, max: 1, nhan: "tỉ lệ ván",
               dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        CHIEN_LUOC.forEach(function (t, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauCL(i) }),
            t.ten + " — " + t.ghi
          ]));
        });

        P.datToiDa(500);
        P.datTocDo(30);
        P.datLai();
      }

      function mauCL(i) {
        return [V.mau("tx3"), V.mau("ba"), V.mau("ok"), V.mau("ac")][i];
      }

      function batDauVan() {
        bimat = TAT[Math.floor(Rnd() * TAT.length)];
        lsDoan = [];
        nhap = new Int32Array(n);
        loiChoi = "";
      }

      /* ============================================================
         Ve
         ============================================================ */
      var vungNhap = null, vungMoi = null;

      function veVanNguoiChoi() {
        var chiaY = Math.round(cv.H * 0.52);
        var x0 = 16, y0 = chiaY + 26;
        var oW = 26, oH = 24, khoang = 5;
        vungNhap = [];

        g.save();
        g.font = "600 13px ui-monospace,monospace";
        g.textAlign = "center"; g.textBaseline = "middle";

        /* Lich su doan. */
        for (var r = 0; r < lsDoan.length; r++) {
          var y = y0 + r * (oH + 4);
          for (var i = 0; i < n; i++) {
            var x = x0 + i * (oW + khoang);
            g.fillStyle = V.mau("surf2");
            g.fillRect(x, y, oW, oH);
            g.fillStyle = V.mau("tx");
            g.fillText(KY_TU[lsDoan[r].g[i]], x + oW / 2, y + oH / 2);
          }
          var xp = x0 + n * (oW + khoang) + 8;
          var b = Math.floor(lsDoan[r].p / (n + 1)), w = lsDoan[r].p % (n + 1);
          g.textAlign = "left";
          g.fillStyle = V.mau("ok");
          g.fillText("● " + b, xp, y + oH / 2);
          g.fillStyle = V.mau("ba");
          g.fillText("○ " + w, xp + 36, y + oH / 2);
          g.textAlign = "center";
        }

        /* O nhap. */
        var yn = y0 + lsDoan.length * (oH + 4) + 6;
        for (i = 0; i < n; i++) {
          var xn = x0 + i * (oW + khoang);
          g.fillStyle = V.mau("bg2");
          g.fillRect(xn, yn, oW, oH);
          g.strokeStyle = V.mau("ac"); g.lineWidth = 1.5;
          g.strokeRect(xn + 0.5, yn + 0.5, oW - 1, oH - 1);
          g.fillStyle = V.mau("tx");
          g.fillText(KY_TU[nhap[i]], xn + oW / 2, yn + oH / 2);
          vungNhap.push({ i: i, x: xn, y: yn, w: oW, h: oH });
        }
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left";
        g.fillText("bấm vào ô để đổi ký tự · ● đúng vị trí · ○ sai vị trí",
                   x0, yn + oH + 12);
        g.restore();
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* --- bieu do phan bo so lan doan --- */
        var maxTiLe = 0.05;
        for (var t = 0; t < thongKe.length; t++) {
          if (!thongKe[t].van) continue;
          for (var k = 1; k <= 12; k++) {
            var p = thongKe[t].dem[k] / thongKe[t].van;
            if (p > maxTiLe) maxTiLe = p;
          }
        }
        B.dat({ y: { min: 0, max: Math.min(1, maxTiLe * 1.15), nhan: "tỉ lệ ván",
                     dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } } });
        B.truc();
        for (t = 0; t < thongKe.length; t++) {
          if (!thongKe[t].van) continue;
          for (k = 1; k <= 12; k++) {
            if (!thongKe[t].dem[k]) continue;
            B.cot(k - 0.3 + t * 0.2, thongKe[t].dem[k] / thongKe[t].van, 0.18, mauCL(t));
          }
        }
        B.moc(0, V.mau("bd"), "");
        /* Vach can duoi. */
        g.save();
        g.strokeStyle = V.mau("loi"); g.lineWidth = 1.5;
        g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(B.px(canDuoi), B.y0()); g.lineTo(B.px(canDuoi), B.y1());
        g.stroke(); g.setLineDash([]);
        g.font = "10px ui-monospace,monospace";
        g.fillStyle = V.mau("loi");
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("cận dưới " + canDuoi, B.px(canDuoi) + 4, B.y0() + 2);
        g.restore();

        veVanNguoiChoi();

        /* --- bang so lieu --- */
        var bang = {
          "Không gian chuỗi": TAT.length.toLocaleString("vi") + " chuỗi  (" +
            c + "^" + n + ")",
          "Số phản hồi khác nhau": soPhanHoi,
          "Cận dưới lý thuyết": canDuoi + " lần đoán  (⌈log_" + soPhanHoi + " " +
            TAT.length + "⌉)",
          "Số ván đã đấu": thongKe[0].van.toLocaleString("vi")
        };
        for (t = 0; t < CHIEN_LUOC.length; t++) {
          var tk = thongKe[t];
          bang[CHIEN_LUOC[t].ten] = tk.van
            ? ("xấu nhất " + tk.xau + "  ·  trung bình " + (tk.tong / tk.van).toFixed(2))
            : "chưa đấu ván nào";
        }
        if (thongKe[2].van > 30 && thongKe[3].van > 30) {
          bang["Chênh lệch then chốt"] = "chỉ đoán ứng viên: xấu nhất " + thongKe[2].xau +
            "   ·   được đoán cả chuỗi sai: xấu nhất " + thongKe[3].xau;
        }
        bang["— Ván của bạn —"] = "";
        bang["Đã đoán"] = lsDoan.length + " lần";
        if (lsDoan.length && lsDoan[lsDoan.length - 1].p === n * (n + 1)) {
          bang["✔"] = "đúng rồi — " + lsDoan.length + " lần đoán";
        }
        if (loiChoi) bang["⚑"] = loiChoi;
        S.dat(bang);
      }

      /* ============================================================
         Chuot
         ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        if (!vungNhap) return;
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        for (var i = 0; i < vungNhap.length; i++) {
          var v = vungNhap[i];
          if (mx >= v.x && mx <= v.x + v.w && my >= v.y && my <= v.y + v.h) {
            nhap[v.i] = (nhap[v.i] + 1) % c;
            P.veLai();
            return;
          }
        }
      });

      var nutDoan = V.el("button", {
        class: "nut chinh", text: "🎯 Đoán",
        onclick: function () {
          if (lsDoan.length && lsDoan[lsDoan.length - 1].p === n * (n + 1)) {
            loiChoi = "ván này xong rồi — bấm “Ván mới”";
            P.veLai(); return;
          }
          var gm = new Int32Array(nhap);
          var p = phanHoi(gm, bimat, n, c, dg, ds);
          lsDoan.push({ g: gm, p: p });
          loiChoi = "";
          P.veLai();
        }
      });
      var nutVanMoi = V.el("button", {
        class: "nut phu", text: "🎲 Ván mới",
        onclick: function () { batDauVan(); P.veLai(); }
      });
      var nutGoiY = V.el("button", {
        class: "nut phu", text: "💡 Gợi ý",
        onclick: function () {
          /* Tinh lai tap ung vien tu lich su cua nguoi choi. */
          var uv = TAT;
          for (var r2 = 0; r2 < lsDoan.length; r2++) {
            var moi = [];
            for (var i = 0; i < uv.length; i++) {
              if (phanHoi(lsDoan[r2].g, uv[i], n, c, dg, ds) === lsDoan[r2].p) moi.push(uv[i]);
            }
            uv = moi;
          }
          if (!uv.length) { loiChoi = "lịch sử mâu thuẫn — không chuỗi nào khớp"; P.veLai(); return; }
          var gm = lsDoan.length ? chonNuoc(uv, "entropy", true) : moDau;
          for (i = 0; i < n; i++) nhap[i] = gm[i];
          loiChoi = "còn " + uv.length.toLocaleString("vi") + " ứng viên — đây là nước entropy chọn";
          P.veLai();
        }
      });

      P = V.phat({
        ten: "doan-chuoi",
        bang: cv,
        tocDo: 30,
        tua: false,
        buoc: function () {
          /* Mot buoc = mot bi mat, danh cho CA BON chien luoc — so sanh
             theo cap tren cung mot bi mat, manh hon nhieu so voi moi ben
             tu boc bi mat rieng. */
          var bm = TAT[Math.floor(Rnd() * TAT.length)];
          for (var t = 0; t < CHIEN_LUOC.length; t++) {
            var l = choiMotVan(bm, CHIEN_LUOC[t].ma.replace("-mr", ""),
                               CHIEN_LUOC[t].moRong);
            var tk = thongKe[t];
            tk.dem[Math.min(20, l)]++;
            tk.tong += l; tk.van++;
            if (l > tk.xau) tk.xau = l;
          }
          return true;
        },
        datLai: function () {
          Rnd = V.rng(Math.round(G.hat) || 1);
          thongKe = CHIEN_LUOC.map(function () {
            return { dem: new Int32Array(21), xau: 0, tong: 0, van: 0 };
          });
          batDauVan();
        },
        ve: ve,
        nhan: function () {
          if (!thongKe[0].van) return "bấm Chạy để đấu giải";
          return thongKe[0].van + " ván · xấu nhất " +
                 CHIEN_LUOC.map(function (_, i) { return thongKe[i].xau; }).join("/");
        }
      });

      var r = V.khung(host, {
        ten: "doan-chuoi",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [
          V.el("div", { class: "hang-nut" }, [nutDoan, nutGoiY, nutVanMoi]),
          P.dk(), TS.dk(), S.el
        ],
        giaiThich:
          "<b>Luật:</b> máy giấu một chuỗi n ký tự. Mỗi lần bạn đoán, nó báo lại hai " +
          "con số: <b>● bao nhiêu ô đúng ký tự đúng vị trí</b>, và <b>○ bao nhiêu ô " +
          "đúng ký tự nhưng sai vị trí</b>. Không nói ô nào." +
          "<ul>" +
          "<li>Với n = 4 và 6 ký tự: <b>1 296 chuỗi</b>, và mỗi lần đoán trả về một " +
          "trong <b>14</b> phản hồi. Cận dưới lý thuyết thông tin: " +
          "⌈log₁₄ 1296⌉ = <b>3</b> lần đoán.</li>" +
          "<li><b>Thực tế là 5.</b> Bấm <i>Chạy</i> để bốn chiến lược cùng đấu vài " +
          "trăm ván và tự đo lấy. Đây là <b>lần thứ ba trong nhóm lab này</b> cận dưới " +
          "nói dối — và lần này lý do lại khác hẳn hai lần trước.</li>" +
          "</ul>" +
          "<b>\u2605 \u0110i\u1ec1u \u0111\u00e1ng nh\u1edb nh\u1ea5t c\u1ee7a lab n\u00e0y.</b> B\u1ea5m <i>Ch\u1ea1y</i> \u0111\u1ec3 b\u1ed1n chi\u1ebfn l\u01b0\u1ee3c " +
          "\u0111\u1ea5u v\u00e0i tr\u0103m v\u00e1n <b>tr\u00ean c\u00f9ng m\u1ed9t b\u00ed m\u1eadt m\u1ed7i v\u00e1n</b>, r\u1ed3i so hai d\u00f2ng cu\u1ed1i " +
          "trong b\u1ea3ng s\u1ed1 li\u1ec7u. C\u00f9ng thu\u1eadt to\u00e1n entropy, ch\u1ec9 kh\u00e1c <b>\u0111\u01b0\u1ee3c ph\u00e9p \u0111o\u00e1n g\u00ec</b>:" +
          "<ul>" +
          "<li><b>Ch\u1ec9 \u0111o\u00e1n \u1ee9ng vi\u00ean c\u00f2n l\u1ea1i</b> (chu\u1ed7i c\u00f2n c\u00f3 th\u1ec3 \u0111\u00fang) \u2192 x\u1ea5u nh\u1ea5t " +
          "<b>6</b>.</li>" +
          "<li><b>\u0110\u01b0\u1ee3c \u0111o\u00e1n m\u1ecdi chu\u1ed7i</b>, k\u1ec3 c\u1ea3 chu\u1ed7i b\u1ea1n \u0111\u00e3 bi\u1ebft ch\u1eafc kh\u00f4ng ph\u1ea3i " +
          "\u0111\u00e1p \u00e1n \u2192 x\u1ea5u nh\u1ea5t <b>5</b>.</li>" +
          "</ul>" +
          "M\u1ed9t n\u01b0\u1edbc \u0111o\u00e1n m\u00e0 b\u1ea1n <i>bi\u1ebft ch\u1eafc l\u00e0 sai</i> th\u00ec kh\u00f4ng bao gi\u1edd th\u1eafng ngay \u2014 " +
          "nghe nh\u01b0 v\u1ee9t \u0111i m\u1ed9t l\u01b0\u1ee3t. Nh\u01b0ng n\u00f3 <b>chia nh\u1ecf t\u1eadp \u1ee9ng vi\u00ean kh\u00e9o h\u01a1n</b>, v\u00e0 " +
          "b\u00f9 l\u1ea1i nhi\u1ec1u h\u01a1n ph\u1ea7n \u0111\u00e3 b\u1ecf." +
          "<ul>" +
          "<li><b>\u2605 Nh\u01b0ng ph\u1ea3i ch\u1ecbu NH\u00ccN v\u00e0o nh\u1eefng n\u01b0\u1edbc \u0111\u00f3.</b> H\u1ea1 tham s\u1ed1 " +
          "<i>X\u00e9t t\u1ed1i \u0111a bao nhi\u00eau n\u01b0\u1edbc</i> t\u1eeb 600 xu\u1ed1ng 300 v\u00e0 ch\u1ea1y l\u1ea1i: " +
          "<b>kh\u00e1c bi\u1ec7t bi\u1ebfn m\u1ea5t</b>, c\u1ea3 b\u1ed1n c\u00f9ng v\u1ec1 6. L\u1ea5y m\u1eabu th\u01b0a th\u00ec h\u1ea7u nh\u01b0 " +
          "kh\u00f4ng bao gi\u1edd v\u1ecb v\u00e0o \u0111\u00fang c\u00e2u h\u1ecfi \u201cv\u00f4 d\u1ee5ng m\u00e0 h\u1eefu \u00edch\u201d \u0111\u00f3. <b>L\u1ee3i \u00edch " +
          "c\u1ee7a vi\u1ec7c d\u00e1m h\u1ecfi c\u00e2u m\u00ecnh bi\u1ebft l\u00e0 sai ch\u1ec9 hi\u1ec7n ra khi b\u1ea1n th\u1ef1c s\u1ef1 c\u00e2n nh\u1eafc " +
          "ch\u00fang.</b></li>" +
          "<li><b>V\u00e0 n\u00f3 c\u00f3 gi\u00e1.</b> B\u1ea3n m\u1edf r\u1ed9ng c\u00f3 x\u1ea5u nh\u1ea5t <i>t\u1ed1t h\u01a1n</i> (5 so v\u1edbi 6) " +
          "nh\u01b0ng trung b\u00ecnh <i>t\u1ec7 h\u01a1n</i> m\u1ed9t ch\u00fat (\u2248 4,60 so v\u1edbi 4,48). \u0110\u00f3 \u0111\u00fang l\u00e0 " +
          "\u0111\u00e1nh \u0111\u1ed5i gi\u1eefa <b>tr\u01b0\u1eddng h\u1ee3p x\u1ea5u nh\u1ea5t</b> v\u00e0 <b>tr\u01b0\u1eddng h\u1ee3p trung b\u00ecnh</b> \u2014 " +
          "hai m\u1ee5c ti\u00eau kh\u00e1c nhau, v\u00e0 kh\u00f4ng c\u00f3 chi\u1ebfn l\u01b0\u1ee3c n\u00e0o th\u1eafng c\u1ea3 hai.</li>" +
          "<li><b>K\u1ebft qu\u1ea3 kinh \u0111i\u1ec3n c\u1ee7a Knuth (1976):</b> Mastermind 4\u00d76 gi\u1ea3i \u0111\u01b0\u1ee3c trong " +
          "\u0111\u00fang <b>5 n\u01b0\u1edbc</b>, v\u00e0 kh\u00f4ng th\u1ec3 \u00edt h\u01a1n. \u00d4ng ch\u1ee9ng minh b\u1eb1ng c\u00e1ch duy\u1ec7t " +
          "<i>to\u00e0n b\u1ed9</i> 1 296 n\u01b0\u1edbc \u1edf m\u1ed7i l\u01b0\u1ee3t. Lab n\u00e0y l\u1ea5y m\u1eabu, n\u00ean n\u00f3 " +
          "<b>ch\u1ea1m t\u1edbi</b> con s\u1ed1 \u0111\u00f3 ch\u1ee9 kh\u00f4ng ch\u1ee9ng minh \u0111\u01b0\u1ee3c n\u00f3.</li>" +
          "<li><b>B\u00e0i h\u1ecdc chung:</b> khi m\u1ee5c ti\u00eau l\u00e0 <i>l\u1ea5y th\u00f4ng tin</i> ch\u1ee9 kh\u00f4ng ph\u1ea3i " +
          "<i>th\u1eafng l\u01b0\u1ee3t n\u00e0y</i>, c\u00e2u h\u1ecfi t\u1ed1t nh\u1ea5t th\u01b0\u1eddng kh\u00f4ng ph\u1ea3i c\u00e2u c\u00f3 c\u01a1 h\u1ed9i " +
          "tr\u00fang cao nh\u1ea5t. \u0110i\u1ec1u n\u00e0y \u0111\u00fang v\u1edbi c\u1ea3 A/B test, c\u1ea3 ch\u1ea9n \u0111o\u00e1n, c\u1ea3 g\u1ee1 l\u1ed7i.</li>" +
          "<li><b>\u201c\u0110o\u00e1n \u0111\u1ea1i\u201d</b> (l\u1ea5y \u1ee9ng vi\u00ean \u0111\u1ea7u ti\u00ean kh\u00f4ng m\u00e2u thu\u1eabn) trung b\u00ecnh " +
          "ch\u1ec9 k\u00e9m kho\u1ea3ng n\u1eeda l\u01b0\u1ee3t. Nh\u01b0ng <b>\u0111u\u00f4i c\u1ee7a n\u00f3 d\u00e0i h\u01a1n h\u1eb3n</b>: x\u1ea5u nh\u1ea5t " +
          "<b>8</b> so v\u1edbi 5\u20136. Trung b\u00ecnh t\u1ed1t kh\u00f4ng b\u1ea3o \u0111\u1ea3m x\u1ea5u-nh\u1ea5t t\u1ed1t.</li>" +
          "<li><b>B\u1ea1n t\u1ef1 ch\u01a1i:</b> b\u1ea5m v\u00e0o \u00f4 \u0111\u1ec3 \u0111\u1ed5i k\u00fd t\u1ef1 r\u1ed3i b\u1ea5m <i>\ud83c\udfaf \u0110o\u00e1n</i>. N\u00fat " +
          "<i>\ud83d\udca1 G\u1ee3i \u00fd</i> cho bi\u1ebft c\u00f2n bao nhi\u00eau \u1ee9ng vi\u00ean v\u00e0 entropy s\u1ebd \u0111o\u00e1n g\u00ec.</li>" +
          "</ul>" +
          "<b>Một thoả hiệp phải nói rõ:</b> không gian nước đi quá lớn để duyệt hết " +
          "(1 296 nước × 1 296 ứng viên cho <i>mỗi</i> lượt), nên lab <b>lấy mẫu đều</b> " +
          "tối đa vài trăm nước mỗi lượt — xem tham số <i>Xét tối đa bao nhiêu nước mỗi " +
          "lượt</i>. Nước mở đầu cũng cố định sẵn thay vì tìm. Vì vậy con số ở đây là " +
          "<b>đo trên mẫu</b>, không phải chứng minh; kéo tham số đó lên và xem kết quả " +
          "có đổi không."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
