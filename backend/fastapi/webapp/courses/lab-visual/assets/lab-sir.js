/* =====================================================================
   lab-sir.js — Dich te tren tac tu (SIR).

   Khong dung phuong trinh vi phan. Tung ca the di lai, va lay benh khi
   dung gan nhau. Nho vay thay duoc thu ma duong cong SIR co dien giau:
   mien dich cong dong, lam phang duong cong, va vi sao "R0" khong phai
   la mot hang so cua virus.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var RONG = 160, CAO = 100;
  var S_ = 0, I_ = 1, R_ = 2, V_ = 3;    /* cam nhiem / nhiem / khoi / da tiem */

  demo({
    id: "dich-te",
    nhom: "Bầy đàn & tác tử",
    mon: "L14",
    ten: "Dịch tễ — miễn dịch cộng đồng nhìn thấy được",
    moTa: "Từng cá thể đi lại và lây cho nhau khi ở gần. Kéo <b>tỉ lệ tiêm</b> lên và " +
          "xem đỉnh dịch tụt xuống — rồi tới một ngưỡng, dịch <b>không bùng được nữa</b> " +
          "dù vẫn còn rất nhiều người chưa tiêm. Đó là miễn dịch cộng đồng.",

    dung: function (host) {
      var HT = null, P = null, B = null;
      var tgNhiem = null;             /* con bao nhieu buoc nua thi khoi */
      var Rnd = null;
      var demS = 0, demI = 0, demR = 0, demV = 0;
      /* Ba duong rieng: gop chung roi map() lai moi khung hinh se de ra
         ba mang moi cho bo don rac, moi mang vai nghin phan tu. */
      var lsS = [], lsI = [], lsR = [];
      var buocDem = 0, dinhI = 0, dinhTai = 0, tongNhiem = 0;
      var soLayCuaToi = null;         /* dem so nguoi ma moi ca the da lay cho */
      var huong = null;               /* goc di cua tung ca the */
      var soF0 = 0;

      var TS = V.thamSo([
        { ma: "soNguoi", ten: "Dân số", kieu: "so", min: 200, max: 4000, buoc: 100, gt: 1500 },
        { ma: "tyLeTiem", ten: "Tỉ lệ đã tiêm trước dịch", kieu: "so",
          min: 0, max: 0.95, buoc: 0.01, gt: 0,
          moTa: "Kéo dần lên. Đỉnh dịch tụt trước, rồi tới một ngưỡng thì dịch " +
                "<b>tắt ngóm</b> — dù phần lớn dân số vẫn chưa tiêm." },
        { ma: "xacSuatLay", ten: "Xác suất lây mỗi lần tiếp xúc", kieu: "so",
          min: 0.01, max: 1, buoc: 0.01, gt: 0.25 },
        { ma: "banKinhLay", ten: "Khoảng cách lây", kieu: "so", min: 0.5, max: 6, buoc: 0.25, gt: 2 },
        { ma: "soNgayBenh", ten: "Số bước còn lây được", kieu: "so", min: 10, max: 200, buoc: 5, gt: 60 },
        { ma: "tocDi", ten: "Mức đi lại", kieu: "so", min: 0, max: 2, buoc: 0.05, gt: 0.5,
          moTa: "Hạ xuống gần 0 = phong toả. Xem đỉnh dịch thấp đi nhưng dịch " +
                "<b>kéo dài hơn</b> — đúng nghĩa “làm phẳng đường cong”." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 21 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Không ai tiêm",        gt: { tyLeTiem: 0, tocDi: 0.5 } },
          { ten: "Tiêm 40%",             gt: { tyLeTiem: 0.4, tocDi: 0.5 } },
          { ten: "Tiêm 70% — tắt dịch",  gt: { tyLeTiem: 0.7, tocDi: 0.5 } },
          { ten: "Phong toả (ít đi lại)", gt: { tyLeTiem: 0, tocDi: 0.06 } },
          { ten: "Lây rất mạnh",         gt: { tyLeTiem: 0, xacSuatLay: 0.7, banKinhLay: 3 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.84, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        var n = Math.round(G.soNguoi);
        Rnd = V.rng(Math.round(G.hat) || 1);
        HT = V.hat({ soToiDa: n, rong: RONG, cao: CAO,
                     banKinh: Math.max(1, G.banKinhLay), vien: "vong" });
        tgNhiem = new Int32Array(n);
        soLayCuaToi = new Int32Array(n);
        huong = new Float32Array(n);

        for (var i = 0; i < n; i++) {
          var goc = Rnd() * Math.PI * 2, v = G.tocDi;
          var trangThai = Rnd() < G.tyLeTiem ? V_ : S_;
          HT.them(Rnd() * RONG, Rnd() * CAO,
                  Math.cos(goc) * v, Math.sin(goc) * v, trangThai);
          huong[i] = goc;
        }
        /* Gieo mot so ca dau tien trong nhom chua tiem. */
        soF0 = 0;
        for (var t = 0; t < 400 && soF0 < 3; t++) {
          var j = Math.floor(Rnd() * HT.n);
          if (HT.loai[j] === S_) {
            HT.loai[j] = I_;
            tgNhiem[j] = Math.round(G.soNgayBenh);
            soF0++;
          }
        }
        demLai();
        lsS = []; lsI = []; lsR = [];
        buocDem = 0; dinhI = demI; dinhTai = 0;
        tongNhiem = demI;

        var chiaY = Math.round(cv.H * 0.66);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 30, l: 60 },
          x: { min: 0, max: 100, nhan: "bước", vach: 4, dinhDang: V.soGon },
          y: { min: 0, max: 1, nhan: "tỉ lệ dân số",
               dinhDang: function (v2) { return (v2 * 100).toFixed(0) + "%"; } },
          luoi: 2
        });
      }

      function demLai() {
        demS = demI = demR = demV = 0;
        for (var i = 0; i < HT.n; i++) {
          var t = HT.loai[i];
          if (t === S_) demS++;
          else if (t === I_) demI++;
          else if (t === R_) demR++;
          else demV++;
        }
      }

      /* Bien tam cho ham goi lai — tranh tao closure moi cho tung ca the. */
      var _i = 0;
      function layChoLangGieng(j) {
        if (HT.loai[j] !== S_) return;
        if (Rnd() < G.xacSuatLay) {
          HT.loai[j] = I_;
          tgNhiem[j] = Math.round(G.soNgayBenh);
          soLayCuaToi[_i]++;
          tongNhiem++;
        }
      }

      function motBuoc() {
        var n = HT.n, i;

        /* Di lai: doi huong nhe moi buoc de thanh di bo ngau nhien.
           Giu thang goc trong `huong` thay vi doc nguoc ra bang atan2 moi
           buoc — atan2 cho tung ca the tung buoc la phan dat nhat o day. */
        var toc = G.tocDi;
        for (i = 0; i < n; i++) {
          var goc = huong[i] + (Rnd() - 0.5) * 0.7;
          huong[i] = goc;
          HT.vx[i] = Math.cos(goc) * toc;
          HT.vy[i] = Math.sin(goc) * toc;
        }
        HT.tien(1);
        HT.dungBam();

        /* Lay benh: chi nguoi DANG nhiem moi di lay. */
        for (i = 0; i < n; i++) {
          if (HT.loai[i] !== I_) continue;
          _i = i;
          HT.quanh(i, G.banKinhLay, layChoLangGieng);
        }

        /* Khoi benh. */
        for (i = 0; i < n; i++) {
          if (HT.loai[i] !== I_) continue;
          if (--tgNhiem[i] <= 0) HT.loai[i] = R_;
        }

        demLai();
        buocDem++;
        if (demI > dinhI) { dinhI = demI; dinhTai = buocDem; }
        if (buocDem % 2 === 0) {
          lsS.push([buocDem, demS / n]);
          lsI.push([buocDem, demI / n]);
          lsR.push([buocDem, (demR + demV) / n]);
        }
        return demI > 0;              /* het nguoi nhiem thi dich da xong */
      }

      /** R thuc te: trung binh so nguoi ma mot ca da khoi benh da lay cho. */
      function rThucTe() {
        var tong = 0, dem = 0;
        for (var i = 0; i < HT.n; i++) {
          if (HT.loai[i] === R_) { tong += soLayCuaToi[i]; dem++; }
        }
        return dem ? tong / dem : 0;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var chiaY = Math.round(cv.H * 0.66);
        var tl = Math.min(cv.W / RONG, (chiaY - 16) / CAO);
        var ox = (cv.W - RONG * tl) / 2, oy = 8;

        g.save();
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
        g.strokeRect(ox, oy, RONG * tl, CAO * tl);
        g.restore();

        var mau = [V.mau("ac"), V.mau("loi"), V.mau("tx3"), V.mau("ok")];
        var co = Math.max(1.6, tl * 0.55);
        /* Ve nguoi nhiem SAU cung de khong bi lap boi cham khac. */
        for (var lop = 0; lop < 4; lop++) {
          var t = [S_, V_, R_, I_][lop];
          g.fillStyle = mau[t];
          for (var i = 0; i < HT.n; i++) {
            if (HT.loai[i] !== t) continue;
            g.beginPath();
            g.arc(ox + HT.x[i] * tl, oy + HT.y[i] * tl, co / 2, 0, 6.2832);
            g.fill();
          }
        }

        var n = HT.n;
        var tran = Math.max(60, buocDem);
        B.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                y: { min: 0, max: 1, nhan: "tỉ lệ dân số",
                     dinhDang: function (v2) { return (v2 * 100).toFixed(0) + "%"; } } });
        B.truc();
        B.duong(lsS, V.mau("ac"), 1.8);
        B.duong(lsR, V.mau("tx3"), 1.8);
        B.duong(lsI, V.mau("loi"), 2.4);
        if (dinhTai) B.moc(dinhI / n, V.mau("ba"), "đỉnh dịch " + (dinhI / n * 100).toFixed(1) + "%");

        var chuaMienDich = demS / n;
        var rTt = rThucTe();
        S.dat({
          "Dân số": n.toLocaleString("vi"),
          "Đã tiêm trước dịch": demV.toLocaleString("vi") +
            "  (" + (demV / n * 100).toFixed(0) + "%)",
          "Đang nhiễm": demI.toLocaleString("vi") +
            "  (" + (demI / n * 100).toFixed(1) + "%)",
          "Chưa từng nhiễm, chưa tiêm": demS.toLocaleString("vi") +
            "  (" + (chuaMienDich * 100).toFixed(1) + "%)",
          "Tổng số đã nhiễm": tongNhiem.toLocaleString("vi") +
            "  (" + (tongNhiem / n * 100).toFixed(1) + "%)",
          "Đỉnh dịch": (dinhI / n * 100).toFixed(1) + "% tại bước " + dinhTai,
          "R thực tế (đo được)": rTt.toFixed(2) +
            (rTt < 1 ? "  → dịch lụi" : "  → dịch còn lan")
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(4000);
        P.datTocDo(30);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "chưa nhiễm (S)"], [V.mau("loi"), "đang nhiễm (I)"],
         [V.mau("tx3"), "đã khỏi (R)"], [V.mau("ok"), "đã tiêm"],
         [V.mau("ba"), "đỉnh dịch"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "dich-te",
        bang: cv,
        tocDo: 30,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          if (xong) return "dịch đã kết thúc sau " + buocDem + " bước";
          return "đang nhiễm " + demI.toLocaleString("vi");
        }
      });

      var r = V.khung(host, {
        ten: "dich-te",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật:</b> mỗi người đi bộ ngẫu nhiên. Người <b>đang nhiễm</b> đứng gần người " +
          "<b>chưa nhiễm</b> thì lây với một xác suất. Sau một số bước thì khỏi và miễn dịch. " +
          "Không có phương trình vi phân nào ở đây — đường cong SIR là thứ <i>mọc ra</i> " +
          "từ các cuộc gặp." +
          "<ul>" +
          "<li><b>Miễn dịch cộng đồng, nhìn thấy được:</b> kéo <b>tỉ lệ tiêm</b> lên từng nấc. " +
          "Ở 40% đỉnh dịch đã thấp hơn hẳn. Tới quanh <b>70%</b> dịch <b>không bùng nổi</b> — " +
          "mà vẫn còn 30% dân số chưa tiêm và hoàn toàn có thể mắc. Họ được bảo vệ " +
          "<b>không phải vì miễn dịch</b>, mà vì virus không tìm đủ đường đi. Ngưỡng lý thuyết " +
          "là <code>1 − 1/R₀</code>.</li>" +
          "<li><b>“Làm phẳng đường cong” không phải cách nói ẩn dụ:</b> hạ <b>mức đi lại</b> " +
          "xuống 0,06. Đỉnh dịch tụt mạnh, nhưng dịch <b>kéo dài hơn nhiều</b> và tổng số ca " +
          "không giảm tương ứng. Đúng thứ mà chính sách phong toả đánh đổi: bệnh viện không vỡ, " +
          "đổi lấy thời gian.</li>" +
          "<li><b>R không phải hằng số của virus.</b> Bảng số liệu đo <b>R thực tế</b> — trung " +
          "bình một người đã khỏi đã lây cho bao nhiêu người. Nó phụ thuộc xác suất lây, " +
          "khoảng cách, mức đi lại, <i>và</i> số người còn cảm nhiễm. Khi R tụt dưới <b>1</b>, " +
          "dịch lụi — kể cả khi chưa ai làm gì thêm.</li>" +
          "<li>Để ý dịch có thể <b>tắt sớm do may mắn</b> khi số ca đầu còn ít: chạy lại với " +
          "hạt giống khác vài lần. Mô hình phương trình vi phân không cho bạn thấy điều đó, " +
          "vì nó coi dân số là chất lỏng liên tục.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
