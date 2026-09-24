/* =====================================================================
   lab-mandelbrot.js — Tap Mandelbrot va tap Julia.

   Mot cong thuc: z <- z^2 + c. Lap di lap lai. Neu z bay ra vo cuc thi
   diem do nam ngoai tap; neu no o lai thi nam trong. Het.

   Ve ca khung mot luc ton khoang 2,5 GIAY — dong bang trang. Nen lab nay
   ve TUNG HANG, moi buoc cua bo phat la mot hang: trang luon muot, va
   thanh tien do cho biet con bao lau.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var W = 420, H = 300;

  demo({
    id: "mandelbrot",
    nhom: "Toán & số học",
    mon: "L22",
    ten: "Mandelbrot — vô hạn chi tiết từ z² + c",
    moTa: "Một công thức: <code>z ← z² + c</code>. Lặp đi lặp lại. Nếu z bay ra vô cực " +
          "thì điểm đó ngoài tập, ở lại thì trong tập. Toàn bộ sự phức tạp bạn sắp thấy " +
          "nằm gọn trong dòng đó. <b>Bấm vào hình để phóng to</b>, bấm chuột phải để lùi ra.",

    dung: function (host) {
      var che = "mandelbrot";
      var tamX = -0.6, tamY = 0, rong = 3.2;
      var oMau = null, L = null, P = null;
      var soTrong = 0, lapTB = 0, lapNhieuNhat = 0;

      var TS = V.thamSo([
        { ma: "che", ten: "Tập", kieu: "chon", gt: "mandelbrot", muc: [
          { v: "mandelbrot", t: "① Mandelbrot — bản đồ của mọi tập Julia" },
          { v: "julia",      t: "② Julia — cho một giá trị c cố định" }
        ] },
        { ma: "soLap", ten: "Số vòng lặp tối đa", kieu: "so", min: 40, max: 2000, buoc: 20, gt: 300,
          moTa: "Phóng càng sâu càng cần nhiều vòng lặp, không thì biên bị bết thành " +
                "một mảng đặc. Phóng sâu mà thấy mất chi tiết thì kéo số này lên." },
        { ma: "cX", ten: "c — phần thực", kieu: "so", min: -2, max: 1, buoc: 0.001, gt: -0.123,
          hien: function (g) { return g.che === "julia"; } },
        { ma: "cY", ten: "c — phần ảo", kieu: "so", min: -1.5, max: 1.5, buoc: 0.001, gt: 0.745,
          moTa: "Chỉ những <b>c nằm trong</b> tập Mandelbrot mới cho ra tập Julia " +
                "<i>liền một khối</i>. Ra ngoài một chút là nó vỡ thành bụi.",
          hien: function (g) { return g.che === "julia"; } },
        { ma: "toMau", ten: "Cách tô màu", kieu: "chon", gt: "muot", muc: [
          { v: "muot",  t: "Mượt (đếm thoát liên tục)" },
          { v: "vach",  t: "Vạch màu (thấy rõ đường đồng mức)" }
        ] }
      ], {
        doi: function (ma) {
          if (ma === "che") datLaiKhung();
          apDung();
        },
        preset: [
          { ten: "Toàn cảnh",          gt: { che: "mandelbrot", soLap: 300 } },
          { ten: "Thỏ Douady (liền khối)", gt: { che: "julia", cX: -0.123, cY: 0.745 } },
          { ten: "Chu kỳ 2 (liền khối)",   gt: { che: "julia", cX: -1, cY: 0 } },
          { ten: "Chu kỳ 4 (liền khối)",   gt: { che: "julia", cX: -1.31, cY: 0 } },
          { ten: "Vỡ thành bụi",           gt: { che: "julia", cX: 0.3, cY: 0.6 } },
          { ten: "⚠ Trông liền mà là bụi", gt: { che: "julia", cX: -0.8, cY: 0.156, soLap: 600 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: H / W, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      function datLaiKhung() {
        if (G.che === "julia") { tamX = 0; tamY = 0; rong = 3.2; }
        else { tamX = -0.6; tamY = 0; rong = 3.2; }
      }

      /* ============================================================
         Tinh
         ============================================================ */
      function chuanBi() {
        oMau = new Uint8Array(W * H);
        soTrong = 0; lapTB = 0; lapNhieuNhat = 0;
        L = V.luoiO(cv, { cot: W, hang: H, le: 6, leTren: 22 });
        var bang = [V.mau("tx")];            /* 0 = trong tap, to den */
        for (var k = 1; k < 200; k++) bang.push(V.thangMau(((k - 1) / 198)));
        L.bangMau(bang);
      }

      /** Mot buoc = MOT HANG. Ca khung mot luc la 2,5 giay — chia theo hang
          thi moi hang chi vai phan nghin giay, trang khong bao gio dung hinh. */
      function motHang(hg) {
        if (hg >= H) return false;
        var cao = rong * H / W;
        var x0 = tamX - rong / 2, y0 = tamY - cao / 2;
        var lapToiDa = Math.round(G.soLap);
        var im = y0 + hg * cao / H;

        for (var c = 0; c < W; c++) {
          var re = x0 + c * rong / W;
          var zx, zy, cx, cy;
          if (G.che === "julia") { zx = re; zy = im; cx = G.cX; cy = G.cY; }
          else { zx = 0; zy = 0; cx = re; cy = im; }

          var i = 0, x2 = zx * zx, y2 = zy * zy;
          while (i < lapToiDa && x2 + y2 <= 4) {
            zy = 2 * zx * zy + cy;
            zx = x2 - y2 + cx;
            x2 = zx * zx; y2 = zy * zy;
            i++;
          }

          var chiSo;
          if (i >= lapToiDa) {
            chiSo = 0;                      /* trong tap */
            soTrong++;
          } else {
            var t;
            if (G.toMau === "muot") {
              /* Dem thoat lien tuc: bo cac vach bac thang do i la so nguyen. */
              var muot = i + 1 - Math.log(Math.log(Math.sqrt(x2 + y2)) / Math.LN2) / Math.LN2;
              t = muot / lapToiDa;
            } else {
              t = (i % 32) / 32;
            }
            if (!(t >= 0)) t = 0;
            if (t > 1) t = 1;
            chiSo = 1 + Math.min(198, Math.floor(Math.pow(t, 0.45) * 198));
          }
          oMau[hg * W + c] = chiSo;
          lapTB += i;
          if (i > lapNhieuNhat) lapNhieuNhat = i;
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        L.tuMang(oMau);
        L.dan();
        L.vien();

        /* Vach tien do: cho biet da ve toi hang nao. */
        if (k < H) {
          var canh = L.canhO();
          g.save();
          g.strokeStyle = V.mau("ba"); g.lineWidth = 1.5;
          var y = 22 + k * canh;
          g.beginPath(); g.moveTo(6, y); g.lineTo(cv.W - 6, y); g.stroke();
          g.restore();
        }

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText((G.che === "julia" ? "Julia c = " + G.cX.toFixed(3) + " + " +
                    G.cY.toFixed(3) + "i" : "Mandelbrot") +
                   "   ·   bấm để phóng to, chuột phải để lùi ra", 8, 5);

        var daVe = Math.min(k, H) * W;
        S.dat({
          "Tâm": tamX.toFixed(6) + (tamY >= 0 ? " + " : " − ") + Math.abs(tamY).toFixed(6) + "i",
          "Bề rộng khung": rong.toExponential(3),
          "Độ phóng": (3.2 / rong).toExponential(2) + " lần",
          "Số vòng lặp tối đa": Math.round(G.soLap),
          "Đã vẽ": Math.min(k, H) + " / " + H + " hàng",
          "Điểm trong tập": daVe ? (soTrong / daVe * 100).toFixed(1) + "%" : "—",
          "Vòng lặp trung bình": daVe ? (lapTB / daVe).toFixed(1) : "—"
        });
      }

      /* ============================================================
         Chuot: phong to / lui ra
         ============================================================ */
      function toaDoChuot(e) {
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        var o = L.oTai(mx, my);
        if (!o) return null;
        var cao = rong * H / W;
        return { x: tamX - rong / 2 + o.c * rong / W,
                 y: tamY - cao / 2 + o.r * cao / H };
      }

      cv.addEventListener("mousedown", function (e) {
        var t = toaDoChuot(e);
        if (!t) return;
        e.preventDefault();
        tamX = t.x; tamY = t.y;
        rong *= (e.button === 2 ? 2.5 : 0.4);
        if (rong > 4) rong = 4;
        apDung();
        P.chay();
      });
      cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(H);
        P.datTocDo(400);
        ghiChu.innerHTML = "";
        [[V.mau("tx"), "trong tập (không bao giờ thoát)"],
         [V.thangMau(0.15), "thoát chậm"],
         [V.thangMau(0.9), "thoát nhanh"],
         [V.mau("ba"), "hàng đang vẽ"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "mandelbrot",
        bang: cv,
        tocDo: 400,
        tuTin: true,
        buoc: function (k) { return motHang(k); },
        datLai: function () {
          if (oMau) oMau.fill(0);
          soTrong = 0; lapTB = 0; lapNhieuNhat = 0;
        },
        ve: ve,
        nhan: function (k, xong) {
          return xong ? "đã vẽ xong khung" : ("hàng " + Math.min(k, H) + " / " + H);
        }
      });

      var r = V.khung(host, {
        ten: "mandelbrot",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật:</b> với mỗi điểm <code>c</code> trên mặt phẳng, bắt đầu từ " +
          "<code>z = 0</code> rồi lặp <code>z ← z² + c</code>. Nếu <code>|z|</code> vượt 2 " +
          "thì nó chắc chắn bay ra vô cực — điểm đó <b>ngoài</b> tập, và ta tô màu theo " +
          "<i>số vòng lặp nó cầm cự được</i>. Nếu sau hàng trăm vòng nó vẫn quanh quẩn " +
          "thì coi như <b>trong</b> tập, tô đen." +
          "<ul>" +
          "<li><b>Phóng to bằng chuột</b> và cứ phóng tiếp. Biên không bao giờ mịn ra — " +
          "phóng bao nhiêu cũng gặp cấu trúc mới, và thỉnh thoảng gặp một bản sao thu nhỏ " +
          "của <i>chính toàn bộ hình</i>. Chiều fractal của biên này bằng đúng <b>2</b>, " +
          "tức là nó “dày” như một mặt phẳng dù chỉ là một đường.</li>" +
          "<li><b>Phóng sâu thì phải tăng số vòng lặp.</b> Nếu thấy chi tiết bết thành mảng " +
          "đặc thì không phải hết chi tiết — chỉ là chưa lặp đủ để phân biệt “ở lại” với " +
          "“thoát rất chậm”. Bảng số liệu có vòng lặp trung bình để bạn biết khi nào cần.</li>" +
          "<li><b>Mandelbrot là tấm bản đồ của mọi tập Julia.</b> Đổi sang chế độ ②: cùng " +
          "công thức, nhưng giờ <code>c</code> <b>cố định</b> còn điểm xuất phát <code>z</code> " +
          "mới là toạ độ. Mỗi <code>c</code> cho một hình khác nhau. Và đây là định lý đẹp " +
          "nhất ở đây: tập Julia <b>liền một khối</b> khi và chỉ khi <code>c</code> nằm " +
          "<i>trong</i> tập Mandelbrot. Thử preset “liền khối” rồi “vỡ thành bụi” — hai giá " +
          "trị c chỉ khác nhau chút xíu, một cái trong, một cái ngoài.</li>" +
          "<li><b>⚠ Và đây là cái bẫy.</b> Bấm preset <i>Trông liền mà là bụi</i>: " +
          "<code>c = −0,8 + 0,156i</code>. Hình trông có cấu trúc, có nhánh, rất giống một " +
          "tập liền khối. Nhưng c đó nằm <b>ngoài</b> tập Mandelbrot — nó thoát sau 252 vòng " +
          "lặp, chỉ là thoát rất chậm. Tập Julia của nó thật ra là <b>bụi</b> hoàn toàn rời " +
          "rạc, và phần “đặc” bạn thấy chỉ chiếm <b>0,9%</b> khung hình. " +
          "<i>Nhìn thì không phân biệt được — phải tính.</i></li>" +
          "</ul>" +
          "<b>Về kỹ thuật:</b> vẽ cả khung một lúc ngốn khoảng <b>2,5 giây</b> và làm trang " +
          "đứng hình. Lab này vẽ <b>từng hàng</b> — mỗi bước của bộ phát là một hàng. Nhờ vậy " +
          "trang luôn mượt, tạm dừng được giữa chừng, và thanh tiến độ cho biết còn bao lâu. " +
          "Đó cũng là lý do lab này <i>không</i> cần Web Worker."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
