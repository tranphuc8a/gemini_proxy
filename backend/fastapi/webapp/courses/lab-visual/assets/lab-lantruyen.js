/* =====================================================================
   lab-lantruyen.js — Lan truyen tren mang luoi.

   Cung mot mam benh (hay mot tin don), tha vao ba loai mang khac nhau.
   Ket qua khac nhau mot troi mot vuc. Va cau hoi thuc te nhat: neu chi
   du vac-xin cho 10% dan so, tiem cho AI?
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var S_ = 0, I_ = 1, R_ = 2, CHAN_ = 3;   /* cam nhiem / nhiem / khoi / da chan */

  demo({
    id: "lan-truyen",
    nhom: "Mạng lưới & phân tán",
    mon: "L20",
    ten: "Lan truyền trên mạng — tiêm cho ai nếu chỉ đủ cho 10%?",
    moTa: "Cùng một mầm bệnh, thả vào ba loại mạng khác nhau: lưới hàng xóm, thế giới " +
          "nhỏ, và mạng có siêu nút. Kết quả khác hẳn nhau. Rồi câu hỏi thật: " +
          "chỉ đủ vắc-xin cho <b>10%</b> dân số — tiêm ngẫu nhiên, hay tiêm cho " +
          "những người quen biết rộng nhất?",

    dung: function (host) {
      var DT = null, ke = null, B = null, P = null;
      var tt = null;                 /* trang thai tung nut */
      var conLay = null;             /* con may buoc nua thi khoi */
      var Rnd = null;
      var demS = 0, demI = 0, demR = 0, demChan = 0;
      var lsI = [], lsR = [], buocDem = 0, dinhI = 0, tongNhiem = 0;
      var bacLonNhat = 1;

      var TS = V.thamSo([
        { ma: "mang", ten: "Loại mạng", kieu: "chon", gt: "the-gioi-nho", muc: [
          { v: "luoi",         t: "① Lưới hàng xóm (p = 0)" },
          { v: "the-gioi-nho", t: "② Thế giới nhỏ (p = 3%)" },
          { v: "ti-le",        t: "③ Có siêu nút (vô hướng tỉ lệ)" }
        ] },
        { ma: "soNut", ten: "Số người", kieu: "so", min: 60, max: 400, buoc: 20, gt: 200 },
        { ma: "xacSuatLay", ten: "Xác suất lây qua mỗi quan hệ", kieu: "so",
          min: 0.01, max: 0.6, buoc: 0.01, gt: 0.08 },
        { ma: "soBuocLay", ten: "Số bước còn lây được", kieu: "so", min: 1, max: 20, buoc: 1, gt: 5 },

        { ten: "Chiến lược tiêm chủng", kieu: "nhom" },
        { ma: "tyLeTiem", ten: "Tiêm được cho bao nhiêu phần trăm", kieu: "so",
          min: 0, max: 0.5, buoc: 0.01, gt: 0.1 },
        { ma: "chienLuoc", ten: "Chọn người tiêm thế nào", kieu: "chon", gt: "ngau-nhien", muc: [
          { v: "ngau-nhien", t: "Ngẫu nhiên — ai cũng như ai" },
          { v: "hub",        t: "Người quen biết rộng nhất trước" },
          { v: "ban-be",     t: "Nghịch lý bạn bè: hỏi một người ngẫu nhiên, tiêm cho BẠN họ" }
        ],
          moTa: "Chiến lược thứ ba không cần biết gì về cấu trúc mạng — mà vẫn gần bằng " +
                "cách tốt nhất. Xem phần giải thích." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 5 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Lưới — lan chậm",        gt: { mang: "luoi", tyLeTiem: 0 } },
          { ten: "Thế giới nhỏ",           gt: { mang: "the-gioi-nho", tyLeTiem: 0 } },
          { ten: "Có siêu nút — bùng nổ",  gt: { mang: "ti-le", tyLeTiem: 0 } },
          { ten: "Tiêm 10% ngẫu nhiên",    gt: { mang: "ti-le", tyLeTiem: 0.1, chienLuoc: "ngau-nhien" } },
          { ten: "Tiêm 10% cho hub",       gt: { mang: "ti-le", tyLeTiem: 0.1, chienLuoc: "hub" } },
          { ten: "Tiêm 10% kiểu bạn bè",   gt: { mang: "ti-le", tyLeTiem: 0.1, chienLuoc: "ban-be" } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.9, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Dung mang
         ============================================================ */
      function dungMang(n, hat) {
        var D = V.doThi(cv, { soToiDa: n, le: 14, leTren: 26,
                              leDuoi: Math.round(cv.H * 0.34) });
        var R = V.rng(hat), i, j;

        if (G.mang === "ti-le") {
          var m = 2, m0 = 3;
          for (i = 0; i < m0; i++) D.themNut();
          for (i = 0; i < m0; i++) for (j = i + 1; j < m0; j++) D.themCanh(i, j);
          var ve = [];
          for (var c = 0; c < D.canh.length; c++) { ve.push(D.canh[c][0]); ve.push(D.canh[c][1]); }
          for (i = m0; i < n; i++) {
            var moi = D.themNut(), daNoi = {};
            for (var t = 0; t < m; t++) {
              for (var thu = 0; thu < 60; thu++) {
                var dich = ve[Math.floor(R() * ve.length)];
                if (dich === moi || daNoi[dich]) continue;
                if (D.themCanh(moi, dich)) { daNoi[dich] = 1; ve.push(moi); ve.push(dich); break; }
              }
            }
          }
        } else {
          var k = 4, p = (G.mang === "the-gioi-nho") ? 0.03 : 0;
          for (i = 0; i < n; i++) D.themNut();
          for (i = 0; i < n; i++) for (j = 1; j <= k / 2; j++) D.themCanh(i, (i + j) % n);
          for (var e = D.canh.length - 1; e >= 0; e--) {
            if (R() >= p) continue;
            var a = D.canh[e][0];
            for (thu = 0; thu < 40; thu++) {
              var b = Math.floor(R() * n);
              if (b === a || D.coCanh(a, b) >= 0) continue;
              D.xoaCanh(e); D.themCanh(a, b); break;
            }
          }
        }
        return D;
      }

      /* ============================================================
         Tiem chung
         ============================================================ */
      function chonNguoiTiem(n, soTiem, R) {
        var ds = [], i;
        if (G.chienLuoc === "hub") {
          var thuTu = [];
          for (i = 0; i < n; i++) thuTu.push(i);
          thuTu.sort(function (a, b) { return DT.bac[b] - DT.bac[a]; });
          ds = thuTu.slice(0, soTiem);
        } else if (G.chienLuoc === "ban-be") {
          /* Nghich ly ban be: boc mot nguoi ngau nhien roi tiem cho MOT NGUOI
             BAN cua ho. Ban cua mot nguoi ngau nhien co xu huong quen rong
             hon chinh nguoi do — vi nguoi quen rong xuat hien trong nhieu
             danh sach ban be hon. Khong can biet gi ve cau truc mang. */
          var da = {};
          for (var thu = 0; thu < soTiem * 60 && ds.length < soTiem; thu++) {
            var ai = Math.floor(R() * n);
            if (!ke[ai].length) continue;
            var ban = ke[ai][Math.floor(R() * ke[ai].length)];
            if (da[ban]) continue;
            da[ban] = 1; ds.push(ban);
          }
        } else {
          var con = [];
          for (i = 0; i < n; i++) con.push(i);
          for (i = con.length - 1; i > 0; i--) {
            var j = Math.floor(R() * (i + 1));
            var tmp = con[i]; con[i] = con[j]; con[j] = tmp;
          }
          ds = con.slice(0, soTiem);
        }
        return ds;
      }

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        var n = Math.round(G.soNut);
        var hat = Math.round(G.hat) || 1;
        DT = dungMang(n, hat);
        DT.boCucLoXo(240, hat);
        ke = DT.danhSachKe();
        Rnd = V.rng(hat + 7);

        bacLonNhat = 1;
        for (var i = 0; i < DT.n; i++) if (DT.bac[i] > bacLonNhat) bacLonNhat = DT.bac[i];

        tt = new Uint8Array(DT.n);
        conLay = new Int32Array(DT.n);

        var soTiem = Math.round(DT.n * G.tyLeTiem);
        var dsTiem = chonNguoiTiem(DT.n, soTiem, V.rng(hat + 99));
        for (i = 0; i < dsTiem.length; i++) tt[dsTiem[i]] = CHAN_;

        /* Gieo ca dau tien trong nhom chua chan. */
        for (var thu = 0; thu < 500; thu++) {
          var s = Math.floor(Rnd() * DT.n);
          if (tt[s] === S_) { tt[s] = I_; conLay[s] = Math.round(G.soBuocLay); break; }
        }

        demLai();
        lsI = []; lsR = []; buocDem = 0; dinhI = demI; tongNhiem = demI;

        B = V.bieuDo(cv, {
          le: { t: Math.round(cv.H * 0.68) + 28, r: 18, b: 32, l: 62 },
          x: { min: 0, max: 40, nhan: "bước", vach: 4, dinhDang: V.soGon },
          y: { min: 0, max: 1, nhan: "tỉ lệ dân số",
               dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } },
          luoi: 2
        });
      }

      function demLai() {
        demS = demI = demR = demChan = 0;
        for (var i = 0; i < DT.n; i++) {
          var t = tt[i];
          if (t === S_) demS++;
          else if (t === I_) demI++;
          else if (t === R_) demR++;
          else demChan++;
        }
      }

      function motBuoc() {
        var n = DT.n, i, e;
        /* Lay theo canh: moi nguoi dang nhiem thu lay cho tung hang xom. */
        var moiNhiem = [];
        for (i = 0; i < n; i++) {
          if (tt[i] !== I_) continue;
          for (e = 0; e < ke[i].length; e++) {
            var j = ke[i][e];
            if (tt[j] !== S_) continue;
            if (Rnd() < G.xacSuatLay) moiNhiem.push(j);
          }
        }
        for (i = 0; i < moiNhiem.length; i++) {
          if (tt[moiNhiem[i]] !== S_) continue;
          tt[moiNhiem[i]] = I_;
          conLay[moiNhiem[i]] = Math.round(G.soBuocLay);
          tongNhiem++;
        }
        for (i = 0; i < n; i++) {
          if (tt[i] !== I_) continue;
          if (--conLay[i] <= 0) tt[i] = R_;
        }

        demLai();
        buocDem++;
        if (demI > dinhI) dinhI = demI;
        lsI.push([buocDem, demI / n]);
        lsR.push([buocDem, (demR + demChan) / n]);
        return demI > 0;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        DT.veCanh(V.mau("bd2"), 1, 0.55);

        var mau = [V.mau("ac"), V.mau("loi"), V.mau("tx3"), V.mau("ok")];
        var banKinh = Math.max(2.5, Math.min(10, 130 / Math.sqrt(DT.n)));
        DT.veNut(function (i) { return mau[tt[i]]; },
                 function (i) {
                   return banKinh * (1 + DT.bac[i] / bacLonNhat * 1.5);
                 });

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(DT.n + " người · " + DT.canh.length + " quan hệ · bậc lớn nhất " +
                   bacLonNhat, 12, 7);

        var n = DT.n;
        var tran = Math.max(30, buocDem);
        B.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                y: { min: 0, max: 1, nhan: "tỉ lệ dân số",
                     dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } } });
        B.truc();
        B.moc(dinhI / n, V.mau("ba"), "đỉnh " + (dinhI / n * 100).toFixed(1) + "%");
        B.duong(lsR, V.mau("tx3"), 1.8);
        B.duong(lsI, V.mau("loi"), 2.4);

        var soTiem = demChan;
        S.dat({
          "Loại mạng": { luoi: "lưới hàng xóm", "the-gioi-nho": "thế giới nhỏ",
                         "ti-le": "có siêu nút" }[G.mang],
          "Đã tiêm": soTiem + "  (" + (soTiem / n * 100).toFixed(0) + "%) · " +
            { "ngau-nhien": "ngẫu nhiên", hub: "cho hub", "ban-be": "kiểu bạn bè" }[G.chienLuoc],
          "Đang nhiễm": demI + "  (" + (demI / n * 100).toFixed(1) + "%)",
          "Đỉnh dịch": (dinhI / n * 100).toFixed(1) + "%",
          "⚑ Tổng số đã nhiễm": tongNhiem + "  (" + (tongNhiem / n * 100).toFixed(1) + "%)",
          "Chưa hề nhiễm, chưa tiêm": demS + "  (" + (demS / n * 100).toFixed(1) + "%)",
          "Bậc trung bình người được tiêm": bacTBTiem().toFixed(2) +
            "  (toàn mạng: " + (2 * DT.canh.length / n).toFixed(2) + ")"
        });
      }

      function bacTBTiem() {
        var tong = 0, dem = 0;
        for (var i = 0; i < DT.n; i++) if (tt[i] === CHAN_) { tong += DT.bac[i]; dem++; }
        return dem ? tong / dem : 0;
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(600);
        P.datTocDo(6);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "chưa nhiễm"], [V.mau("loi"), "đang nhiễm"],
         [V.mau("tx3"), "đã khỏi"], [V.mau("ok"), "đã tiêm"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        ghiChu.appendChild(V.el("span", { html: "Nút <b>to</b> = quen biết rộng." }));
        P.datLai();
      }

      P = V.phat({
        ten: "lan-truyen",
        bang: cv,
        tocDo: 6,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          if (xong) return "kết thúc: " + (tongNhiem / DT.n * 100).toFixed(1) + "% đã nhiễm";
          return "đang nhiễm " + demI;
        }
      });

      var r = V.khung(host, {
        ten: "lan-truyen",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Cùng một mầm bệnh, ba loại mạng.</b> Đặt tỉ lệ tiêm về 0 rồi chạy lần lượt " +
          "cả ba và so con số ⚑:" +
          "<ul>" +
          "<li><b>Lưới hàng xóm</b> — lây lan như vết dầu loang, chậm và đều. Ai cũng chỉ " +
          "quen người bên cạnh nên mầm bệnh phải bò từng bước.</li>" +
          "<li><b>Thế giới nhỏ</b> — chỉ <b>3%</b> quan hệ là quan hệ xa, mà đỉnh dịch đến " +
          "sớm hơn hẳn: mầm bệnh nhảy cóc sang vùng khác thay vì bò. Vài chuyến bay quốc tế " +
          "làm đúng việc đó.</li>" +
          "<li><b>Có siêu nút</b> — bùng nổ. Chỉ cần mầm bệnh chạm tới một hub là nó phát tán " +
          "ra hàng chục người cùng lúc.</li>" +
          "</ul>" +
          "<b>Câu hỏi thật: chỉ đủ vắc-xin cho 10% — tiêm cho ai?</b> Chọn mạng " +
          "<i>có siêu nút</i>, đặt tiêm 10%, rồi đổi chiến lược và so con số ⚑:" +
          "<ul>" +
          "<li><b>Ngẫu nhiên</b> — gần như không ăn thua. Bốc ngẫu nhiên thì hầu hết trúng " +
          "người quen biết hẹp, còn hub vẫn hở.</li>" +
          "<li><b>Cho hub</b> — hiệu quả áp đảo. Nhưng nó đòi bạn <b>biết trước toàn bộ cấu " +
          "trúc mạng</b>: ai quen ai. Trong một trận dịch thật, không ai có dữ liệu đó.</li>" +
          "<li><b>Kiểu bạn bè</b> — bốc một người ngẫu nhiên, rồi tiêm cho <b>một người bạn</b> " +
          "của họ. Không cần biết gì về mạng cả, chỉ cần hỏi được một câu. Vậy mà hiệu quả " +
          "gần bằng cách tốt nhất. Xem dòng cuối bảng số liệu: bậc trung bình của nhóm được " +
          "tiêm cao hơn hẳn bậc trung bình toàn mạng.</li>" +
          "</ul>" +
          "<b>Vì sao mẹo đó chạy được — nghịch lý bạn bè:</b> bạn của bạn thường có nhiều bạn " +
          "hơn bạn. Không phải vì bạn kém cỏi, mà vì một người quen rộng <b>xuất hiện trong " +
          "danh sách bạn bè của nhiều người hơn</b>, nên dễ bị bốc trúng hơn. Phép lấy mẫu " +
          "“qua một cạnh” tự động thiên vị về phía hub — miễn phí. Cohen, Havlin và ben-Avraham " +
          "công bố năm 2003; ý tưởng này còn được dùng để <b>phát hiện dịch sớm</b>: theo dõi " +
          "nhóm “bạn của người ngẫu nhiên” thì thấy đỉnh dịch trước cả tuần."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
