/* =====================================================================
   lab-thuocdoc.js — 1000 chai, mot chai co doc, 10 nguoi thu.

   Moi nguoi thu cho DUNG MOT BIT: cuoi ngay anh ta song hoac chet. k
   nguoi thu trong r vong cho k*r bit, nen dieu kien la

        k * r  >=  log2(n)

   1000 chai can 10 bit. Nen 10 nguoi x 1 vong, hay 1 nguoi x 10 vong,
   hay 2x5, hay 5x2 — DEU DUOC. Do la mot su danh doi hoan toan: nguoi
   doi lay thoi gian.

   Cach lam: danh so chai tu 0. Nguoi thu i uong tu MOI chai co bit i
   bang 1. Cuoi ngay, doc day nguoi chet nhu mot so nhi phan — do chinh
   la so hieu chai doc. Khong phai suy luan gi them.

   Hai chai doc thi cau chuyen khac han, va lab do thang cho do.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /** Ma nhi phan: chai c -> tap nguoi thu uong no. */
  function maNhiPhan(n, k) {
    var ma = new Int32Array(n);
    for (var c = 0; c < n; c++) ma[c] = c & ((1 << k) - 1);
    return ma;
  }

  /** Ma ngau nhien — dung cho truong hop 2 chai doc, noi ma nhi phan
      khong con phan biet duoc. */
  function maNgauNhien(n, k, R) {
    var ma = new Int32Array(n);
    for (var c = 0; c < n; c++) {
      var m = 0;
      for (var b = 0; b < k; b++) if (R() < 0.5) m |= (1 << b);
      ma[c] = m;
    }
    return ma;
  }

  /** Ma co phan biet duoc moi CAP chai khong? (phep OR lam mat thong tin) */
  function phanBietCap(ma, n, tran) {
    var thay = {}, dem = 0;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var u = ma[i] | ma[j];
        if (thay[u]) return { duoc: false, dung: [i, j, thay[u]] };
        thay[u] = [i, j];
        if (++dem > tran) return { duoc: true, catBot: true };
      }
    }
    return { duoc: true };
  }

  function canThongTin(soTruongHop) { return V.canThongTin(soTruongHop, 2); }

  demo({
    id: "thuoc-doc",
    nhom: "Câu đố quyết định",
    mon: "L35",
    ten: "Tìm chai thuốc độc — mỗi người thử là một bit",
    moTa: "1000 chai, đúng một chai có độc, người thử chết sau một ngày. Bạn có " +
          "<b>một ngày</b>. Câu trả lời: <b>10 người</b>. Người thứ i uống từ mọi chai " +
          "có bit thứ i bằng 1, và cuối ngày <b>dãy người chết đọc ra chính số hiệu " +
          "chai độc</b> — không phải suy luận gì thêm.",

    dung: function (host) {
      var P = null, L = null;
      var n = 1000, k = 10, r = 1;
      var ma = null, chaiDoc = 0, chaiDoc2 = -1;
      var chet = 0;                     /* mat na nguoi chet */
      var buocDem = 0;
      var kqCap = null;                 /* ket qua kiem 2 chai doc */

      var TS = V.thamSo([
        { ma: "soChai", ten: "Số chai", kieu: "so", min: 2, max: 4096, buoc: 1, gt: 1000 },
        { ma: "soNguoi", ten: "Số người thử", kieu: "so", min: 1, max: 24, buoc: 1, gt: 10 },
        { ma: "soVong", ten: "Số vòng (mỗi vòng một ngày)", kieu: "so",
          min: 1, max: 12, buoc: 1, gt: 1,
          moTa: "Người và ngày <b>đổi cho nhau được</b>: điều kiện chỉ là " +
                "<code>người × vòng ≥ log₂(số chai)</code>." },
        { ma: "soDoc", ten: "Số chai có độc", kieu: "so", min: 1, max: 2, buoc: 1, gt: 1,
          moTa: "Đặt 2 và mọi thứ đổi hẳn — xem phần giải thích." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 7 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ 1000 chai · 10 người · 1 ngày", gt: { soChai: 1000, soNguoi: 10, soVong: 1, soDoc: 1 } },
          { ten: "★ 1000 chai · 1 người · 10 ngày", gt: { soChai: 1000, soNguoi: 1, soVong: 10, soDoc: 1 } },
          { ten: "1000 chai · 2 người · 5 ngày", gt: { soChai: 1000, soNguoi: 2, soVong: 5, soDoc: 1 } },
          { ten: "⚠ 1000 chai · 9 người — THIẾU", gt: { soChai: 1000, soNguoi: 9, soVong: 1, soDoc: 1 } },
          { ten: "★ 16 chai · 2 chai độc", gt: { soChai: 16, soNguoi: 7, soVong: 1, soDoc: 2 } },
          { ten: "16 chai · 2 độc · 18 người", gt: { soChai: 16, soNguoi: 18, soVong: 1, soDoc: 2 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.62, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================ */
      function soBit() { return Math.round(G.soNguoi) * Math.round(G.soVong); }

      function apDung() {
        if (!cv.W) return;
        n = Math.round(G.soChai);
        k = Math.round(G.soNguoi);
        r = Math.round(G.soVong);
        var R = V.rng(Math.round(G.hat) || 1);
        var bit = soBit();

        if (Math.round(G.soDoc) === 1) {
          ma = maNhiPhan(n, bit);
          kqCap = null;
        } else {
          /* Voi 2 chai doc, ma nhi phan KHONG con phan biet duoc — phai
             dung ma khac, va lab do thang xem co du khong. */
          ma = maNgauNhien(n, bit, R);
          kqCap = phanBietCap(ma, Math.min(n, 400), 200000);
        }

        chaiDoc = Math.floor(R() * n);
        chaiDoc2 = Math.round(G.soDoc) === 2
          ? (chaiDoc + 1 + Math.floor(R() * (n - 1))) % n : -1;
        chet = ma[chaiDoc] | (chaiDoc2 >= 0 ? ma[chaiDoc2] : 0);
        buocDem = 0;

        var cot = Math.min(n, Math.max(16, Math.round(Math.sqrt(n * 2.2))));
        var hang = Math.ceil(n / cot);
        L = V.luoiO(cv, { cot: cot, hang: hang, le: 10, leTren: 24,
                          leDuoi: Math.round(cv.H * 0.42) });
        L.bangMau([V.mau("bg2"), V.mau("ac"), V.mau("loi"), V.mau("ba")]);

        ghiChu.innerHTML = "";
        [[V.mau("bg2"), "chai người thử đang xét KHÔNG uống"],
         [V.mau("ac"), "chai người đó có uống"],
         [V.mau("loi"), "chai độc thật"]].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + x[0] }), x[1]
          ]));
        });

        P.datToiDa(Math.max(1, bit));
        P.datTocDo(1.4);
        P.datLai();
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(b) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var bit = soBit();
        var nguoiDang = Math.min(b, bit - 1);

        /* --- luoi chai --- */
        L.xoa(0);
        for (var c = 0; c < n; c++) {
          var uong = (ma[c] >> nguoiDang) & 1;
          L.datChiSo(c, uong ? 1 : 0);
        }
        L.datChiSo(chaiDoc, 2);
        if (chaiDoc2 >= 0) L.datChiSo(chaiDoc2, 2);
        L.dan();
        L.vien();

        g.save();
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("Người thử #" + (nguoiDang + 1) + " uống từ " +
                   soChaiUong(nguoiDang).toLocaleString("vi") + " chai — " +
                   "mọi chai có bit thứ " + (nguoiDang + 1) + " bằng 1", 10, 6);
        g.restore();

        /* --- day bit: ai chet --- */
        veDayBit(b, bit);

        /* --- bang so lieu --- */
        var can = canThongTin(Math.round(G.soDoc) === 1 ? n : n * (n - 1) / 2);
        var du = bit >= can;
        var bang = {
          "Số chai": n.toLocaleString("vi"),
          "Số chai có độc": Math.round(G.soDoc),
          "Người × vòng": k + " × " + r + " = " + bit + " bit"
        };
        if (Math.round(G.soDoc) === 1) {
          bang["Cần ít nhất"] = can + " bit   (⌈log₂ " + n + "⌉)";
          bang["Đủ chưa"] = du
            ? "✔ ĐỦ — phân biệt được " + Math.pow(2, Math.min(30, bit)).toLocaleString("vi") + " chai"
            : "✘ THIẾU " + (can - bit) + " bit — chỉ phân biệt nổi " +
              Math.pow(2, bit).toLocaleString("vi") + " chai";
          bang["Chai độc thật"] = "#" + chaiDoc + "  =  " + nhiPhan(chaiDoc, bit);
          bang["Dãy người chết"] = nhiPhan(chet, bit);
          bang["Đọc ra"] = du
            ? ("#" + (chet & ((1 << bit) - 1)) +
               ((chet & ((1 << bit) - 1)) === chaiDoc ? "   ✔ đúng chai" : "   ✘ sai"))
            : "không đọc ra được — nhiều chai cùng một dãy";
        } else {
          bang["Cận dưới lý thuyết"] = can + " bit   (⌈log₂ C(n,2)⌉ = ⌈log₂ " +
            (n * (n - 1) / 2).toLocaleString("vi") + "⌉)";
          bang["Hai chai độc"] = "#" + chaiDoc + " và #" + chaiDoc2;
          bang["Dãy người chết"] = nhiPhan(chet, bit);
          if (kqCap) {
            bang["Mã này phân biệt được mọi cặp?"] = kqCap.duoc
              ? ("✔ được" + (kqCap.catBot ? "  (kiểm 200 000 cặp đầu)" : ""))
              : ("✘ KHÔNG — cặp (#" + kqCap.dung[0] + ",#" + kqCap.dung[1] +
                 ") cho cùng dãy chết với cặp khác");
          }
          bang["⚑ Vì sao khó hơn hẳn"] = "phép OR làm mất thông tin: biết AI chết " +
            "không cho biết chết vì CHAI NÀO";
        }
        bang["Số chai người #" + (nguoiDang + 1) + " uống"] =
          soChaiUong(nguoiDang).toLocaleString("vi");
        S.dat(bang);
      }

      function soChaiUong(i) {
        var d = 0;
        for (var c = 0; c < n; c++) if ((ma[c] >> i) & 1) d++;
        return d;
      }

      function nhiPhan(v, bit) {
        var s = "";
        for (var i = bit - 1; i >= 0; i--) s += ((v >> i) & 1) ? "1" : "0";
        return s || "0";
      }

      function veDayBit(b, bit) {
        var y0 = cv.H - Math.round(cv.H * 0.42) + 18;
        var cao = Math.round(cv.H * 0.42) - 30;
        var x0 = 16, rong = cv.W - 32;
        var w = Math.min(46, rong / Math.max(1, bit));
        var hOm = Math.min(38, cao * 0.34);

        g.save();
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("Cuối ngày: ai chết? Đọc từ phải sang trái là số hiệu chai độc.",
                   x0, y0 - 16);
        g.restore();

        for (var i = 0; i < bit; i++) {
          var nguoi = bit - 1 - i;        /* ve bit cao ben trai */
          var x = x0 + i * w;
          var daBiet = nguoi <= b;
          var c = (chet >> nguoi) & 1;
          g.save();
          g.fillStyle = !daBiet ? V.mau("bg2") : (c ? V.mau("loi") : V.mau("ok"));
          g.fillRect(x + 2, y0 + 6, Math.max(2, w - 5), hOm);
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
          g.strokeRect(x + 2.5, y0 + 6.5, Math.max(2, w - 6), hOm - 1);
          if (w > 18) {
            g.font = "600 " + Math.min(16, Math.round(hOm * 0.5)) + "px ui-monospace,monospace";
            g.fillStyle = V.mau("surf");
            g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(!daBiet ? "?" : (c ? "✖" : "✓"), x + 2 + (w - 5) / 2, y0 + 6 + hOm / 2);
            g.font = "10px ui-monospace,monospace";
            g.fillStyle = V.mau("tx3");
            g.textBaseline = "top";
            g.fillText("#" + (nguoi + 1), x + 2 + (w - 5) / 2, y0 + hOm + 10);
            g.fillStyle = daBiet ? V.mau("tx") : V.mau("tx3");
            g.font = "600 12px ui-monospace,monospace";
            g.fillText(daBiet ? String(c) : "?", x + 2 + (w - 5) / 2, y0 + hOm + 24);
          }
          g.restore();
        }
      }

      P = V.phat({
        ten: "thuoc-doc",
        bang: cv,
        tocDo: 1.4,
        buoc: function () { buocDem++; return buocDem < soBit(); },
        datLai: function () { buocDem = 0; },
        ve: ve,
        nhan: function (b) {
          var bit = soBit();
          return "đã biết " + Math.min(b + 1, bit) + " / " + bit + " bit";
        }
      });

      var r2 = V.khung(host, {
        ten: "thuoc-doc",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>1000 chai, đúng một chai có độc, người thử chết sau một ngày, và bạn chỉ " +
          "có một ngày.</b> Cần ít nhất bao nhiêu người?" +
          "<ul>" +
          "<li><b>Mỗi người thử cho đúng MỘT bit</b> — cuối ngày anh ta sống hoặc chết. " +
          "k người cho k bit, phân biệt được 2<sup>k</sup> khả năng. Cần 2<sup>k</sup> ≥ " +
          "1000 → <b>k = 10</b>.</li>" +
          "<li><b>Cách làm, không cần mẹo gì:</b> đánh số chai từ 0. Người thứ i uống " +
          "từ <i>mọi chai có bit thứ i bằng 1</i>. Cuối ngày đọc dãy người chết như " +
          "một số nhị phân — <b>đó chính là số hiệu chai độc</b>. Bấm <i>Chạy</i> để " +
          "xem từng người uống những chai nào.</li>" +
          "<li>Bấm preset <b>⚠ 9 người</b>: 2<sup>9</sup> = 512 < 1000, nên có hai chai " +
          "khác nhau cho <i>cùng một dãy người chết</i>. Thiếu một bit là hỏng hẳn, " +
          "không phải “kém chính xác đi một chút”.</li>" +
          "</ul>" +
          "<b>★ Người và ngày đổi cho nhau được.</b> Điều kiện thật sự là " +
          "<code>người × vòng ≥ log₂(số chai)</code>. Bấm lần lượt ba preset: " +
          "<b>10 người × 1 ngày</b>, <b>2 người × 5 ngày</b>, <b>1 người × 10 ngày</b> — " +
          "cả ba đều đủ. Nếu người quý mà thời gian rẻ thì dùng ít người và nhiều ngày; " +
          "ngược lại thì ngược lại. <b>Không có phương án nào “đúng” — chỉ có tỉ giá.</b>" +
          "<ul>" +
          "<li>Đây đúng là cấu trúc của mọi bài toán chia-để-trị song song: " +
          "<i>số máy × số vòng</i> là một hằng số, và bạn chọn chỗ đứng trên đường đó.</li>" +
          "</ul>" +
          "<b>★ Rồi đặt “số chai có độc” = 2, và mọi thứ đổ vỡ.</b>" +
          "<ul>" +
          "<li>Mã nhị phân <b>không dùng được nữa</b>: hai chai độc thì dãy người chết " +
          "là <b>OR</b> của hai mã. Mà từ một phép OR bạn <i>không lần ngược ra được</i> " +
          "hai số đã tạo ra nó — <code>0011 = 0001|0010</code> nhưng cũng " +
          "<code>= 0011|0010</code>.</li>" +
          "<li>Cận dưới lý thuyết vẫn nhỏ: ⌈log₂ C(n,2)⌉, với n = 16 chỉ là <b>7 bit</b>. " +
          "Nhưng bấm preset <i>16 chai · 2 chai độc</i> với 7 người: ô <i>Mã này phân " +
          "biệt được mọi cặp?</i> báo <b>KHÔNG</b>. Phải lên tới khoảng <b>18 người</b> " +
          "thì mã ngẫu nhiên mới đủ — <b>gấp 2,5 lần cận</b>.</li>" +
          "<li>Đo trên nhiều cỡ: n=8 cận 5 cần 10; n=16 cận 7 cần 18; n=32 cận 9 cần 25. " +
          "Khoảng cách <b>giãn ra</b>. Cận dưới đếm <i>số câu trả lời</i>, nhưng nó " +
          "không biết rằng phép OR <b>làm mất thông tin</b> — và đó là lần thứ tư trong " +
          "nhóm lab này cận dưới nói dối, mỗi lần vì một lý do khác.</li>" +
          "</ul>"
      });
      r2.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
