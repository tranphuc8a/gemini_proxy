/* =====================================================================
   lab-rule1d.js — 256 tu dong te bao mot chieu cua Wolfram.

   Mot hang o. Moi o nhin chinh no va hai lang gieng, tra ra 0 hoac 1.
   Ba o -> tam to hop -> tam bit -> mot so tu 0 den 255. Do la TOAN BO
   khong gian luat. Vay ma trong 256 luat do co ca hon loan lan mot may
   Turing day du.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* Vai luat dang chu y, kem lop Wolfram. */
  var DANG_CHU_Y = {
    30:  "hỗn loạn — từng dùng làm bộ sinh số ngẫu nhiên (lớp III)",
    90:  "tam giác Sierpiński (lớp II)",
    110: "Turing đầy đủ — đã được chứng minh (lớp IV)",
    54:  "cấu trúc phức tạp, va chạm có quy luật (lớp IV)",
    150: "phép XOR ba ô, đối xứng (lớp III)",
    184: "dòng xe — mô hình kẹt xe đơn giản nhất (lớp II)",
    250: "tam giác đặc (lớp II)",
    22:  "fractal hỗn loạn (lớp III)",
    60:  "tam giác Sierpiński lệch (lớp II)"
  };

  demo({
    id: "rule-1d",
    nhom: "Tự động tế bào",
    mon: "L09",
    ten: "256 luật một chiều — hỗn loạn từ ba ô",
    moTa: "Mỗi ô chỉ nhìn <b>chính nó và hai hàng xóm</b>. Tám tổ hợp, mỗi tổ hợp cho ra " +
          "0 hoặc 1 — tám bit, tức <b>một số từ 0 đến 255</b>. Đó là toàn bộ không gian " +
          "luật. Kéo số luật và xem: có luật cho ra tam giác đều tăm tắp, có luật cho ra " +
          "thứ không ai phân biệt nổi với ngẫu nhiên.",

    dung: function (host) {
      var N = 400, H = 260;
      var o = null;                  /* Uint8Array N*H, moi hang la mot the he */
      var hang = null;               /* hang hien tai */
      var L = null, P = null, Rnd = null;
      var bit = new Uint8Array(8);

      var TS = V.thamSo([
        { ma: "luat", ten: "Số luật", kieu: "so", min: 0, max: 255, buoc: 1, gt: 30,
          moTa: "Đáng thử: <b>30</b> hỗn loạn · <b>90</b> Sierpiński · <b>110</b> Turing " +
                "đầy đủ · <b>184</b> dòng xe · <b>54</b> có cấu trúc va chạm." },
        { ma: "khoiDau", ten: "Hàng đầu tiên", kieu: "chon", gt: "mot-o", muc: [
          { v: "mot-o",      t: "Một ô đen duy nhất ở giữa" },
          { v: "ngau-nhien", t: "Ngẫu nhiên" }
        ] },
        { ma: "rong", ten: "Số ô mỗi hàng", kieu: "so", min: 101, max: 801, buoc: 50, gt: 401 },
        { ma: "matDo", ten: "Mật độ hàng đầu", kieu: "so", min: 0.05, max: 0.95, buoc: 0.05, gt: 0.5,
          hien: function (g) { return g.khoiDau === "ngau-nhien"; } },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 3,
          hien: function (g) { return g.khoiDau === "ngau-nhien"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Luật 30 — hỗn loạn",     gt: { luat: 30, khoiDau: "mot-o" } },
          { ten: "Luật 90 — Sierpiński",   gt: { luat: 90, khoiDau: "mot-o" } },
          { ten: "Luật 110 — Turing",      gt: { luat: 110, khoiDau: "ngau-nhien", matDo: 0.5 } },
          { ten: "Luật 54 — va chạm",      gt: { luat: 54, khoiDau: "ngau-nhien", matDo: 0.5 } },
          { ten: "Luật 184 — dòng xe",     gt: { luat: 184, khoiDau: "ngau-nhien", matDo: 0.35 } },
          { ten: "Luật 90 từ hàng ngẫu nhiên", gt: { luat: 90, khoiDau: "ngau-nhien", matDo: 0.5 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.78, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var soDoLuat = V.el("div", { class: "gt-box", style: "margin-top:10px" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function docBit() {
        var n = Math.round(G.luat) & 255;
        for (var i = 0; i < 8; i++) bit[i] = (n >> i) & 1;
      }

      function chuanBi() {
        N = Math.round(G.rong);
        H = Math.max(80, Math.round(N * 0.62));
        docBit();
        o = new Uint8Array(N * H);
        hang = new Uint8Array(N);

        if (G.khoiDau === "ngau-nhien") {
          Rnd = V.rng(Math.round(G.hat) || 1);
          for (var i = 0; i < N; i++) hang[i] = Rnd() < G.matDo ? 1 : 0;
        } else {
          hang[Math.floor(N / 2)] = 1;
        }
        o.set(hang, 0);

        L = V.luoiO(cv, { cot: N, hang: H, le: 10, leTren: 24 });
        L.bangMau([V.mau("bg2"), V.mau("ac")]);
      }

      /** Mot the he: o moi phu thuoc bo ba (trai, giua, phai) cua hang truoc.
          Bo ba doc thanh so 0..7, tra bit thu do cua so luat. */
      function motHang(k) {
        if (k >= H - 1) return false;
        var moi = new Uint8Array(N);
        for (var i = 0; i < N; i++) {
          var t = hang[(i - 1 + N) % N];
          var gi = hang[i];
          var p = hang[(i + 1) % N];
          moi[i] = bit[(t << 2) | (gi << 1) | p];
        }
        hang = moi;
        o.set(hang, (k + 1) * N);
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        L.tuMang(o);
        L.dan();
        L.vien();

        var n = Math.round(G.luat) & 255;
        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("luật " + n + " = " + ("0000000" + n.toString(2)).slice(-8) +
                   "₂   thời gian chảy xuống dưới", 10, 6);

        /* mat do o den cua hang moi nhat */
        var song = 0;
        for (var i = 0; i < N; i++) song += hang[i];
        S.dat({
          "Luật": n + "  (nhị phân " + ("0000000" + n.toString(2)).slice(-8) + ")",
          "Đặc điểm": DANG_CHU_Y[n] || "chưa có ghi chú riêng",
          "Thế hệ": Math.min(k + 1, H).toLocaleString("vi") + " / " + H.toLocaleString("vi"),
          "Ô đen hàng cuối": song + " / " + N + "  (" + (song / N * 100).toFixed(1) + "%)",
          "Luật đối xứng gương": String(guongLuat(n)),
          "Luật đảo màu": String(daoLuat(n))
        });

        veSoDoLuat(n);
      }

      /** Luat tuong duong khi lat trai-phai. */
      function guongLuat(n) {
        var m = 0;
        for (var i = 0; i < 8; i++) {
          var t = (i >> 2) & 1, gi = (i >> 1) & 1, p = i & 1;
          var j = (p << 2) | (gi << 1) | t;
          if ((n >> i) & 1) m |= (1 << j);
        }
        return m;
      }
      /** Luat tuong duong khi doi den <-> trang. */
      function daoLuat(n) {
        var m = 0;
        for (var i = 0; i < 8; i++) {
          if (!((n >> i) & 1)) m |= (1 << (7 - i));
        }
        return m;
      }

      /** Bang tam quy tac: ba o vao -> mot o ra. Day la TOAN BO dinh nghia. */
      function veSoDoLuat(n) {
        var oM = V.mau("ac"), tr = V.mau("bg2"), bd = V.mau("bd");
        var h = "";
        for (var i = 7; i >= 0; i--) {
          var t = (i >> 2) & 1, gi = (i >> 1) & 1, p = i & 1;
          var ra = (n >> i) & 1;
          var o3 = [t, gi, p].map(function (b) {
            return '<i style="display:inline-block;width:13px;height:13px;border:1px solid ' +
                   bd + ';background:' + (b ? oM : tr) + '"></i>';
          }).join("");
          h += '<span style="display:inline-block;margin:0 10px 8px 0;text-align:center">' +
               o3 + '<br><span style="color:' + V.mau("tx3") + '">↓</span><br>' +
               '<i style="display:inline-block;width:13px;height:13px;border:1px solid ' +
               bd + ';background:' + (ra ? oM : tr) + '"></i></span>';
        }
        soDoLuat.innerHTML = "<b>Toàn bộ luật " + n + "</b> — tám tổ hợp ba ô, mỗi tổ hợp " +
                             "cho ra một ô.<br><div style=\"margin-top:10px\">" + h + "</div>";
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(H - 1);
        P.datTocDo(120);
        P.datLai();
      }

      P = V.phat({
        ten: "rule-1d",
        bang: cv,
        tocDo: 120,
        buoc: function (k) { return motHang(k); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          return xong ? "đã vẽ kín lưới" : ("thế hệ " + (k + 1));
        }
      });

      var r = V.khung(host, {
        ten: "rule-1d",
        bang: cv,
        ve: [cv],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Cách đọc hình:</b> hàng trên cùng là thế hệ đầu, thời gian chảy xuống dưới. " +
          "Mỗi ô ở hàng dưới do <b>ba ô</b> ngay trên nó quyết định. Bảng tám quy tắc bên dưới " +
          "là <i>toàn bộ</i> định nghĩa của luật — không có gì khác." +
          "<ul>" +
          "<li><b>Luật 90</b> từ một ô duy nhất vẽ ra <b>tam giác Sierpiński</b> hoàn hảo. " +
          "Nó chỉ là phép XOR hai hàng xóm. Một fractal mọc ra từ một phép toán logic.</li>" +
          "<li><b>Luật 30</b> cũng bắt đầu từ một ô, nhưng cột giữa của nó " +
          "<b>vượt qua mọi phép kiểm định ngẫu nhiên</b> — Mathematica từng dùng chính nó " +
          "làm bộ sinh số ngẫu nhiên. Luật hoàn toàn tất định, kết quả không đoán nổi.</li>" +
          "<li><b>Luật 110</b> đã được chứng minh là <b>Turing đầy đủ</b>: nó tính được mọi thứ " +
          "máy tính của bạn tính được. Từ một quy tắc ba ô. Đổi sang hàng đầu ngẫu nhiên để " +
          "thấy các cấu trúc trôi và va vào nhau — đó là chỗ phép tính xảy ra.</li>" +
          "<li><b>Luật 184</b> là mô hình <b>dòng xe</b> đơn giản nhất: ô đen là xe, mỗi bước " +
          "xe tiến lên nếu phía trước trống. Đặt mật độ dưới 0,5 rồi trên 0,5 — dưới thì mọi xe " +
          "chạy thoát, trên thì kẹt cứng. <b>Chuyển pha</b>, đúng nghĩa.</li>" +
          "<li>Bảng số liệu cho <b>luật đối xứng gương</b> và <b>luật đảo màu</b> — hai luật cho " +
          "ra hình giống hệt sau khi lật/đảo. Nhờ vậy 256 luật thật ra chỉ có <b>88 lớp</b> khác nhau.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");
      r.phai.appendChild(soDoLuat);

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
