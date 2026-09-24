/* =====================================================================
   lab-honloan.js — Con lac kep va hut tu Lorenz.

   Hai he tat dinh hoan toan: khong co mot chut ngau nhien nao trong ma.
   Cho hai ban sao xuat phat lech nhau MOT PHAN TRIEU. Chung di chung mot
   luc, roi tach ra, roi khong con lien quan gi den nhau.

   Do la hon loan: tat dinh nhung khong doan truoc duoc.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  demo({
    id: "hon-loan",
    nhom: "Hệ động lực & hỗn loạn",
    mon: "L24",
    ten: "Hiệu ứng cánh bướm — đo được bằng số",
    moTa: "Hai bản sao của cùng một hệ, xuất phát lệch nhau <b>một phần triệu</b>. " +
          "Không có một chút ngẫu nhiên nào trong mã. Chúng đi chung một lúc, rồi tách ra, " +
          "rồi không còn liên quan gì đến nhau. Biểu đồ dưới đo <b>tốc độ tách</b> đó.",

    dung: function (host) {
      var che = "con-lac";
      /* Con lac kep: hai goc va hai van toc goc, cho hai ban sao. */
      var A = null, B = null;
      var BTL = null, BD = null, P = null;
      var lsLech = [], buocDem = 0;
      var lechDau = 1e-6;

      var TS = V.thamSo([
        { ma: "che", ten: "Hệ", kieu: "chon", gt: "con-lac", muc: [
          { v: "con-lac", t: "① Con lắc kép" },
          { v: "lorenz",  t: "② Hút tử Lorenz" }
        ] },
        { ma: "lech", ten: "Chênh lệch ban đầu", kieu: "so",
          min: -12, max: -2, buoc: 0.5, gt: -6,
          donVi: " (10^)",
          moTa: "Số mũ 10. <b>−6</b> nghĩa là hai bản sao lệch nhau một phần triệu. " +
                "Kéo xuống <b>−12</b> — chính xác hơn cả mọi phép đo vật lý — và xem " +
                "chúng vẫn tách ra, chỉ là muộn hơn một chút." },

        { ten: "① Con lắc kép", kieu: "nhom", hien: function (g) { return g.che === "con-lac"; } },
        { ma: "goc1", ten: "Góc thanh trên", kieu: "so", min: 0, max: 180, buoc: 1, gt: 120,
          donVi: "°", hien: function (g) { return g.che === "con-lac"; } },
        { ma: "goc2", ten: "Góc thanh dưới", kieu: "so", min: 0, max: 180, buoc: 1, gt: 100,
          donVi: "°", hien: function (g) { return g.che === "con-lac"; } },
        { ma: "khoiLuong2", ten: "Khối lượng quả dưới", kieu: "so",
          min: 0.2, max: 3, buoc: 0.1, gt: 1,
          hien: function (g) { return g.che === "con-lac"; } },

        { ten: "② Lorenz", kieu: "nhom", hien: function (g) { return g.che === "lorenz"; } },
        { ma: "rho", ten: "ρ — mức đối lưu", kieu: "so", min: 1, max: 60, buoc: 0.5, gt: 28,
          moTa: "Dưới <b>24,74</b> hệ lắng về một điểm cố định. Trên mức đó là hỗn loạn. " +
                "Kéo qua lại quanh mốc đó để thấy ranh giới.",
          hien: function (g) { return g.che === "lorenz"; } },
        { ma: "sigma", ten: "σ", kieu: "so", min: 1, max: 20, buoc: 0.5, gt: 10,
          hien: function (g) { return g.che === "lorenz"; } },
        { ma: "beta", ten: "β", kieu: "so", min: 0.5, max: 5, buoc: 0.1, gt: 2.667,
          hien: function (g) { return g.che === "lorenz"; } },

        { ma: "veVet", ten: "Để lại vệt", kieu: "bat", gt: true }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Con lắc kép",          gt: { che: "con-lac", goc1: 120, goc2: 100, lech: -6 } },
          { ten: "Lệch một phần nghìn tỉ", gt: { che: "con-lac", goc1: 120, goc2: 100, lech: -12 } },
          { ten: "Góc nhỏ — chưa hỗn loạn", gt: { che: "con-lac", goc1: 12, goc2: 8, lech: -6 } },
          { ten: "Lorenz kinh điển",     gt: { che: "lorenz", rho: 28 } },
          { ten: "Lorenz ρ = 20 — lắng", gt: { che: "lorenz", rho: 20 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.72, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Hai he
         ============================================================ */
      function trangThaiDau(themLech) {
        if (G.che === "con-lac") {
          return { a1: G.goc1 * Math.PI / 180 + themLech, a2: G.goc2 * Math.PI / 180,
                   v1: 0, v2: 0 };
        }
        return { x: 1 + themLech, y: 1, z: 1 };
      }

      /** Con lac kep — phuong trinh chuyen dong day du (Lagrange).
          m1 = 1, l1 = l2 = 1, g = 9,81. */
      function buocConLac(s, dt) {
        var m1 = 1, m2 = G.khoiLuong2, l1 = 1, l2 = 1, gg = 9.81;
        var a1 = s.a1, a2 = s.a2, v1 = s.v1, v2 = s.v2;
        var d = a1 - a2;
        var den = 2 * m1 + m2 - m2 * Math.cos(2 * d);

        var g1 = (-gg * (2 * m1 + m2) * Math.sin(a1)
                  - m2 * gg * Math.sin(a1 - 2 * a2)
                  - 2 * Math.sin(d) * m2 * (v2 * v2 * l2 + v1 * v1 * l1 * Math.cos(d)))
                 / (l1 * den);
        var g2 = (2 * Math.sin(d) * (v1 * v1 * l1 * (m1 + m2)
                  + gg * (m1 + m2) * Math.cos(a1)
                  + v2 * v2 * l2 * m2 * Math.cos(d)))
                 / (l2 * den);

        s.v1 += g1 * dt; s.v2 += g2 * dt;
        s.a1 += s.v1 * dt; s.a2 += s.v2 * dt;
      }

      function buocLorenz(s, dt) {
        /* Runge-Kutta bac 4: Euler o day se troi nang va lam sai ket luan. */
        function f(x, y, z) {
          return [G.sigma * (y - x), x * (G.rho - z) - y, x * y - G.beta * z];
        }
        var k1 = f(s.x, s.y, s.z);
        var k2 = f(s.x + dt / 2 * k1[0], s.y + dt / 2 * k1[1], s.z + dt / 2 * k1[2]);
        var k3 = f(s.x + dt / 2 * k2[0], s.y + dt / 2 * k2[1], s.z + dt / 2 * k2[2]);
        var k4 = f(s.x + dt * k3[0], s.y + dt * k3[1], s.z + dt * k3[2]);
        s.x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        s.y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        s.z += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      }

      function khoangCach() {
        if (G.che === "con-lac") {
          var d1 = A.a1 - B.a1, d2 = A.a2 - B.a2;
          var w1 = A.v1 - B.v1, w2 = A.v2 - B.v2;
          return Math.sqrt(d1 * d1 + d2 * d2 + w1 * w1 + w2 * w2);
        }
        var x = A.x - B.x, y = A.y - B.y, z = A.z - B.z;
        return Math.sqrt(x * x + y * y + z * z);
      }

      /* ============================================================
         Chuan bi
         ============================================================ */
      function chuanBi() {
        lechDau = Math.pow(10, G.lech);
        A = trangThaiDau(0);
        B = trangThaiDau(lechDau);
        lsLech = []; buocDem = 0;

        BTL = V.bangTichLuy(cv);
        var chiaY = Math.round(cv.H * 0.66);
        BD = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 32, l: 66 },
          x: { min: 0, max: 100, nhan: "bước", vach: 4, dinhDang: V.soGon },
          /* Truc log: phan ky theo ham mu se thanh DUONG THANG, va do doc
             cua duong thang do chinh la so mu Lyapunov. */
          y: { min: Math.max(1e-14, lechDau / 10), max: 100, log: true,
               nhan: "khoảng cách giữa hai bản sao",
               dinhDang: function (v) { return v.toExponential(0); } },
          luoi: 4
        });
      }

      function motBuoc() {
        var dt = G.che === "con-lac" ? 0.006 : 0.004;
        var lan = G.che === "con-lac" ? 3 : 4;
        for (var i = 0; i < lan; i++) {
          if (G.che === "con-lac") { buocConLac(A, dt); buocConLac(B, dt); }
          else { buocLorenz(A, dt); buocLorenz(B, dt); }
        }
        buocDem++;
        if (buocDem % 2 === 0) {
          lsLech.push([buocDem, Math.max(1e-15, khoangCach())]);
          if (lsLech.length > 4000) lsLech.shift();
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function toaDoConLac(s, cx, cy, tl) {
        var x1 = cx + Math.sin(s.a1) * tl, y1 = cy + Math.cos(s.a1) * tl;
        return { x1: x1, y1: y1,
                 x2: x1 + Math.sin(s.a2) * tl, y2: y1 + Math.cos(s.a2) * tl };
      }

      function veVet(gd, k) {
        var chiaY = Math.round(cv.H * 0.66);
        if (G.che === "con-lac") {
          var cx = cv.W / 2, cy = chiaY * 0.34;
          var tl = Math.min(cv.W, chiaY) * 0.19;
          var pA = toaDoConLac(A, cx, cy, tl), pB = toaDoConLac(B, cx, cy, tl);
          gd.globalAlpha = 0.5;
          gd.fillStyle = V.mau("ac");
          gd.fillRect(pA.x2 - 0.8, pA.y2 - 0.8, 1.6, 1.6);
          gd.fillStyle = V.mau("loi");
          gd.fillRect(pB.x2 - 0.8, pB.y2 - 0.8, 1.6, 1.6);
          gd.globalAlpha = 1;
        } else {
          var sx = cv.W / 2, sy = chiaY * 0.62, tl2 = Math.min(cv.W / 70, chiaY / 60);
          gd.globalAlpha = 0.55;
          gd.fillStyle = V.mau("ac");
          gd.fillRect(sx + A.x * tl2 - 0.7, sy - (A.z - 25) * tl2 - 0.7, 1.4, 1.4);
          gd.fillStyle = V.mau("loi");
          gd.fillRect(sx + B.x * tl2 - 0.7, sy - (B.z - 25) * tl2 - 0.7, 1.4, 1.4);
          gd.globalAlpha = 1;
        }
      }

      function ve(k) {
        if (G.veVet) BTL.toi(k, veVet);

        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        if (G.veVet) BTL.dan();

        var chiaY = Math.round(cv.H * 0.66);

        if (G.che === "con-lac") {
          var cx = cv.W / 2, cy = chiaY * 0.34;
          var tl = Math.min(cv.W, chiaY) * 0.19;
          [[B, V.mau("loi")], [A, V.mau("ac")]].forEach(function (cap) {
            var p = toaDoConLac(cap[0], cx, cy, tl);
            g.save();
            g.strokeStyle = cap[1]; g.lineWidth = 2.5; g.lineCap = "round";
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(p.x1, p.y1); g.lineTo(p.x2, p.y2);
            g.stroke();
            g.fillStyle = cap[1];
            g.beginPath(); g.arc(p.x1, p.y1, 5, 0, 6.2832); g.fill();
            g.beginPath(); g.arc(p.x2, p.y2, 5 + G.khoiLuong2 * 2, 0, 6.2832); g.fill();
            g.restore();
          });
          g.fillStyle = V.mau("tx3");
          g.beginPath(); g.arc(cx, cy, 4, 0, 6.2832); g.fill();
        }

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(G.che === "con-lac"
          ? "hai con lắc, lệch nhau 10^" + G.lech + " radian ở góc trên"
          : "chiếu mặt phẳng x–z · ρ = " + G.rho.toFixed(1), 10, 6);

        /* --- duong phan ky --- */
        var tran = Math.max(60, buocDem);
        BD.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                 y: { min: Math.max(1e-14, lechDau / 10), max: 100, log: true,
                      nhan: "khoảng cách giữa hai bản sao",
                      dinhDang: function (v) { return v.toExponential(0); } } });
        BD.truc();
        BD.moc(lechDau, V.mau("ok"), "chênh lệch ban đầu");
        BD.duong(lsLech, V.mau("ba"), 2);

        /* Buoc dau tien hai ban sao lech qua 0,5 — luc chung "khong con
           lien quan gi den nhau" nua. */
        var buocTach = 0;
        for (var i = 0; i < lsLech.length; i++) {
          if (lsLech[i][1] > 0.5) { buocTach = lsLech[i][0]; break; }
        }
        var d = khoangCach();
        S.dat({
          "Hệ": G.che === "con-lac" ? "con lắc kép" : "Lorenz ρ=" + G.rho.toFixed(1),
          "Chênh lệch ban đầu": lechDau.toExponential(0),
          "Chênh lệch hiện tại": d.toExponential(2),
          "Đã phóng đại": (d / lechDau).toExponential(1) + " lần",
          "Bước": buocDem.toLocaleString("vi"),
          "⚑ Hai bản sao tách hẳn ở bước": buocTach || "chưa tách",
          "Đường cong trên biểu đồ": "thẳng trên trục log ⇒ phân kỳ theo hàm mũ"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(20000);
        P.datTocDo(60);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "bản sao A"], [V.mau("loi"), "bản sao B (lệch 10^" + G.lech + ")"],
         [V.mau("ba"), "khoảng cách giữa hai bản"],
         [V.mau("ok"), "mức chênh lệch ban đầu"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "hon-loan",
        bang: cv,
        tocDo: 60,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          return "lệch " + khoangCach().toExponential(2);
        }
      });

      var r = V.khung(host, {
        ten: "hon-loan",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Không có một dòng ngẫu nhiên nào trong lab này.</b> Hai bản sao chạy cùng " +
          "một công thức, cùng một máy, cùng một số bước. Khác biệt duy nhất: bản B xuất " +
          "phát lệch đi một khoảng bé xíu so với A — đúng bằng thanh trượt <i>Chênh lệch ban đầu</i>." +
          "<ul>" +
          "<li><b>Đọc biểu đồ dưới.</b> Trục dọc là <b>thang log</b>. Khoảng cách giữa hai " +
          "bản sao vẽ ra một <b>đường thẳng đi lên</b> — thẳng trên thang log nghĩa là " +
          "<i>phân kỳ theo hàm mũ</i>. Độ dốc của đường thẳng đó chính là " +
          "<b>số mũ Lyapunov</b>, con số đo mức hỗn loạn của một hệ.</li>" +
          "<li><b>Kéo chênh lệch ban đầu xuống 10⁻¹²</b> — chính xác hơn mọi phép đo vật lý " +
          "từng làm được. Hai bản vẫn tách ra, chỉ là muộn hơn. Và đây là điểm mấu chốt: " +
          "vì phân kỳ là hàm mũ, <b>đo chính xác gấp một triệu lần chỉ mua thêm được một " +
          "quãng thời gian ngắn</b>. Đó là lý do dự báo thời tiết hết tin cậy sau khoảng " +
          "hai tuần, và sẽ mãi như vậy dù cảm biến có tốt đến đâu.</li>" +
          "<li><b>Đặt góc nhỏ</b> (preset “góc nhỏ”): con lắc kép ở biên độ nhỏ gần như " +
          "<i>không</i> hỗn loạn — hai bản sao bám nhau rất lâu. Hỗn loạn không phải tính " +
          "chất cố hữu của phương trình, mà của phương trình <b>ở một vùng tham số nhất định</b>.</li>" +
          "<li><b>Lorenz</b> (1963) ra đời từ một mô hình đối lưu khí quyển rút gọn còn ba " +
          "phương trình. Kéo <b>ρ</b> xuống dưới <b>24,74</b>: hệ lắng về một điểm và đứng " +
          "yên. Kéo lên trên: hỗn loạn, và quỹ đạo vẽ ra hình hai cánh bướm — nó không bao " +
          "giờ lặp lại, cũng không bao giờ thoát ra ngoài.</li>" +
          "<li><b>Chữ “cánh bướm” đến từ đâu:</b> Lorenz đặt tên bài giảng năm 1972 là " +
          "“Con bướm đập cánh ở Brazil có gây ra lốc xoáy ở Texas không?”. Hình vẽ ở đây " +
          "trùng hợp cũng giống một con bướm — nhưng hai chuyện đó không liên quan gì nhau.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
