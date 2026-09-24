/* =====================================================================
   lab-nbody.js — Hap dan N vat va nam diem Lagrange.

   Mot luat duy nhat: F = G·m1·m2 / r^2, huong vao nhau. Ap cho moi cap.

   Voi hai vat thi Newton giai duoc bang cong thuc. Voi ba vat thi KHONG
   — Poincare chung minh dieu do nam 1890, va do la khoi dau cua ly thuyet
   hon loan. Nhung trong bai toan ba vat co nam diem dac biet, va hai
   trong so do ON DINH. Tieu hanh tinh Trojan cua Moc tinh dang nam o do.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  demo({
    id: "n-body",
    nhom: "Hệ động lực & hỗn loạn",
    mon: "L25",
    ten: "Hấp dẫn — và năm điểm mà lực triệt tiêu",
    moTa: "Một luật duy nhất: <code>F = G·m₁·m₂/r²</code>, áp cho mọi cặp. Với hai vật " +
          "Newton giải được bằng công thức; với <b>ba vật thì không</b> — Poincaré chứng " +
          "minh năm 1890, và đó là khởi đầu của lý thuyết hỗn loạn. Nhưng bài toán ba vật " +
          "có <b>năm điểm đặc biệt</b>, và hai trong số đó ổn định.",

    dung: function (host) {
      var n = 0;
      var x = null, y = null, vx = null, vy = null, m = null, loai = null;
      var ax = null, ay = null;
      var BTL = null, P = null, Rnd = null;
      var nangLuongDau = 0, buocDem = 0, soVaCham = 0;
      var tl = 1, ocx = 0, ocy = 0;

      var HDAN = 1.0;

      var TS = V.thamSo([
        { ma: "che", ten: "Cảnh", kieu: "chon", gt: "lagrange", muc: [
          { v: "lagrange",  t: "① Năm điểm Lagrange — thả hạt thử khắp nơi" },
          { v: "he-sao",    t: "② Hệ hành tinh" },
          { v: "cum",       t: "③ Đám sao ngẫu nhiên — sụp và bắn ra" }
        ] },
        { ma: "soVat", ten: "Số vật", kieu: "so", min: 20, max: 300, buoc: 10, gt: 150,
          moTa: "Lực hấp dẫn là bài toán <b>mọi cặp</b>: 300 vật là 45 000 cặp mỗi bước. " +
                "Đó là lý do người ta phải nghĩ ra thuật toán Barnes–Hut." },
        { ma: "tiLeKhoi", ten: "Tỉ lệ khối lượng vật thứ hai", kieu: "so",
          min: 0.005, max: 0.2, buoc: 0.005, gt: 0.04,
          moTa: "Điểm L4 và L5 chỉ <b>ổn định</b> khi tỉ lệ này dưới khoảng <b>0,04</b>. " +
                "Mặt Trời–Mộc Tinh là 0,00095, thoả thừa. Kéo lên 0,1 và xem các hạt " +
                "ở L4/L5 bắt đầu trôi đi.",
          hien: function (g) { return g.che === "lagrange"; } },
        { ma: "veVet", ten: "Để lại vệt quỹ đạo", kieu: "bat", gt: true },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 6 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Điểm Lagrange",       gt: { che: "lagrange", tiLeKhoi: 0.02 } },
          { ten: "L4/L5 mất ổn định",   gt: { che: "lagrange", tiLeKhoi: 0.15 } },
          { ten: "Hệ hành tinh",        gt: { che: "he-sao" } },
          { ten: "Đám sao 250",         gt: { che: "cum", soVat: 250 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.72, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Dung canh
         ============================================================ */
      function capPhat(soToiDa) {
        x = new Float64Array(soToiDa); y = new Float64Array(soToiDa);
        vx = new Float64Array(soToiDa); vy = new Float64Array(soToiDa);
        m = new Float64Array(soToiDa); loai = new Uint8Array(soToiDa);
        ax = new Float64Array(soToiDa); ay = new Float64Array(soToiDa);
        n = 0;
      }
      function them(px, py, pvx, pvy, pm, pl) {
        x[n] = px; y[n] = py; vx[n] = pvx; vy[n] = pvy; m[n] = pm; loai[n] = pl || 0;
        n++;
      }

      function chuanBi() {
        Rnd = V.rng(Math.round(G.hat) || 1);
        buocDem = 0; soVaCham = 0;

        if (G.che === "lagrange") {
          capPhat(400);
          /* Hai vat lon quay quanh khoi tam chung, quy dao tron. */
          var M1 = 1, M2 = G.tiLeKhoi, R = 1;
          var r1 = R * M2 / (M1 + M2), r2 = R * M1 / (M1 + M2);
          var w = Math.sqrt(HDAN * (M1 + M2) / (R * R * R));
          them(-r1, 0, 0, -w * r1, M1, 1);
          them(r2, 0, 0, w * r2, M2, 2);

          /* Hat thu: rai deu tren mot vanh, van toc dat theo quay dong bo.
             Chi nhung hat gan L4/L5 moi o lai. */
          var soHat = Math.round(G.soVat);
          for (var i = 0; i < soHat; i++) {
            var a = Rnd() * Math.PI * 2;
            var rr = 0.75 + Rnd() * 0.5;
            var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            them(px, py, -w * py, w * px, 1e-9, 0);
          }
        } else if (G.che === "he-sao") {
          capPhat(400);
          them(0, 0, 0, 0, 40, 1);
          var soHt = Math.round(G.soVat);
          for (i = 0; i < soHt; i++) {
            var r = 0.5 + Rnd() * 2.6;
            var t = Rnd() * Math.PI * 2;
            var v = Math.sqrt(HDAN * 40 / r);
            them(Math.cos(t) * r, Math.sin(t) * r,
                 -Math.sin(t) * v, Math.cos(t) * v, 0.002 + Rnd() * 0.01, 0);
          }
        } else {
          capPhat(400);
          var soSao = Math.round(G.soVat);
          for (i = 0; i < soSao; i++) {
            var aa = Rnd() * Math.PI * 2, rrr = Math.sqrt(Rnd()) * 1.6;
            them(Math.cos(aa) * rrr, Math.sin(aa) * rrr,
                 (Rnd() - 0.5) * 0.35, (Rnd() - 0.5) * 0.35,
                 0.02 + Rnd() * 0.06, 0);
          }
        }

        nangLuongDau = nangLuong();
        BTL = V.bangTichLuy(cv);
        capNhatTyLe();
      }

      function capNhatTyLe() {
        var toi = 0;
        for (var i = 0; i < n; i++) {
          var d = Math.sqrt(x[i] * x[i] + y[i] * y[i]);
          if (d > toi && d < 10) toi = d;
        }
        toi = Math.max(1.5, Math.min(4, toi * 1.15));
        tl = Math.min(cv.W, cv.H) * 0.44 / toi;
        ocx = cv.W / 2; ocy = cv.H / 2;
      }

      /* ============================================================
         Tich phan
         ============================================================ */
      function tinhGiaToc() {
        var i, j;
        for (i = 0; i < n; i++) { ax[i] = 0; ay[i] = 0; }
        for (i = 0; i < n; i++) {
          for (j = i + 1; j < n; j++) {
            var dx = x[j] - x[i], dy = y[j] - y[i];
            /* Lam mem: khong co no thi hai vat di qua sat nhau se sinh ra
               mot lue vo han va ban nhau di mat. */
            var d2 = dx * dx + dy * dy + 0.004;
            var d = Math.sqrt(d2);
            var f = HDAN / (d2 * d);
            ax[i] += f * dx * m[j]; ay[i] += f * dy * m[j];
            ax[j] -= f * dx * m[i]; ay[j] -= f * dy * m[i];
          }
        }
      }

      /** Leapfrog: giu nang luong on dinh rat lau, khac han Euler. */
      function motBuoc() {
        var dt = 0.004, lan = 3, i;
        for (var b = 0; b < lan; b++) {
          tinhGiaToc();
          for (i = 0; i < n; i++) { vx[i] += ax[i] * dt / 2; vy[i] += ay[i] * dt / 2; }
          for (i = 0; i < n; i++) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; }
          tinhGiaToc();
          for (i = 0; i < n; i++) { vx[i] += ax[i] * dt / 2; vy[i] += ay[i] * dt / 2; }
        }
        buocDem++;
        return true;
      }

      function nangLuong() {
        var E = 0, i, j;
        for (i = 0; i < n; i++) E += 0.5 * m[i] * (vx[i] * vx[i] + vy[i] * vy[i]);
        for (i = 0; i < n; i++) {
          for (j = i + 1; j < n; j++) {
            var dx = x[j] - x[i], dy = y[j] - y[i];
            E -= HDAN * m[i] * m[j] / Math.sqrt(dx * dx + dy * dy + 0.004);
          }
        }
        return E;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veVet(gd) {
        gd.globalAlpha = 0.4;
        for (var i = 0; i < n; i++) {
          if (loai[i]) continue;
          gd.fillStyle = V.thangMau(0.3 + (i % 7) / 14);
          gd.fillRect(ocx + x[i] * tl - 0.6, ocy + y[i] * tl - 0.6, 1.2, 1.2);
        }
        gd.globalAlpha = 1;
      }

      function ve(k) {
        if (G.veVet) BTL.toi(k, veVet);

        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        if (G.veVet) BTL.dan();

        /* Nam diem Lagrange, tinh tu vi tri hai vat lon. */
        if (G.che === "lagrange" && n >= 2) {
          var M1 = m[0], M2 = m[1];
          var muy = M2 / (M1 + M2);
          var gx = (m[0] * x[0] + m[1] * x[1]) / (M1 + M2);
          var gy = (m[0] * y[0] + m[1] * y[1]) / (M1 + M2);
          var dx = x[1] - x[0], dy = y[1] - y[0];
          var R = Math.sqrt(dx * dx + dy * dy);
          var ux = dx / R, uy = dy / R;
          var q = Math.pow(muy / 3, 1 / 3);

          var diem = [
            ["L1", R * (1 - q), 0, false],
            ["L2", R * (1 + q), 0, false],
            ["L3", -R * (1 + 5 * muy / 12), 0, false],
            ["L4", R * 0.5, R * Math.sqrt(3) / 2, true],
            ["L5", R * 0.5, -R * Math.sqrt(3) / 2, true]
          ];
          g.save();
          g.font = "600 11px ui-monospace,monospace";
          g.textAlign = "center"; g.textBaseline = "middle";
          for (var d = 0; d < diem.length; d++) {
            var lx = diem[d][1], ly = diem[d][2];
            /* Quay he toa do theo huong noi hai vat. */
            var px = gx + lx * ux - ly * uy;
            var py = gy + lx * uy + ly * ux;
            var sx = ocx + px * tl, sy = ocy + py * tl;
            var onDinh = diem[d][3] && muy < 0.0385;
            g.strokeStyle = onDinh ? V.mau("ok") : V.mau("ba");
            g.lineWidth = 1.4;
            g.setLineDash(onDinh ? [] : [3, 3]);
            g.beginPath(); g.arc(sx, sy, 11, 0, 6.2832); g.stroke();
            g.setLineDash([]);
            g.fillStyle = onDinh ? V.mau("ok") : V.mau("ba");
            g.fillText(diem[d][0], sx, sy);
          }
          g.restore();
        }

        /* Cac vat. */
        for (var i = 0; i < n; i++) {
          var r = loai[i] ? Math.max(4, Math.pow(m[i], 0.33) * 9) : 1.9;
          g.fillStyle = loai[i] === 1 ? V.mau("ba")
                      : loai[i] === 2 ? V.mau("loi") : V.mau("ac");
          g.beginPath();
          g.arc(ocx + x[i] * tl, ocy + y[i] * tl, r, 0, 6.2832);
          g.fill();
        }

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(n + " vật · " + (n * (n - 1) / 2).toLocaleString("vi") +
                   " cặp lực mỗi bước", 10, 6);

        var E = nangLuong();
        var troi = nangLuongDau !== 0 ? Math.abs((E - nangLuongDau) / nangLuongDau) : 0;
        var muy2 = n >= 2 ? m[1] / (m[0] + m[1]) : 0;
        var bang = {
          "Số vật": n,
          "Cặp lực mỗi bước": (n * (n - 1) / 2).toLocaleString("vi"),
          "Bước": buocDem.toLocaleString("vi"),
          "Năng lượng trôi": (troi * 100).toFixed(3) + "%",
          "Tích phân": "leapfrog — giữ năng lượng, khác hẳn Euler"
        };
        if (G.che === "lagrange") {
          bang["Tỉ lệ khối lượng μ"] = muy2.toFixed(5);
          bang["⚑ L4 và L5"] = muy2 < 0.0385
            ? "ỔN ĐỊNH (μ < 0,0385) — hạt ở lại"
            : "mất ổn định (μ ≥ 0,0385) — hạt trôi đi";
          bang["Mặt Trời – Mộc Tinh"] = "μ = 0,00095 → ổn định";
        }
        S.dat(bang);
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
        var cap = [[V.mau("ba"), "vật nặng thứ nhất"], [V.mau("loi"), "vật nặng thứ hai"],
                   [V.mau("ac"), "hạt thử / hành tinh"]];
        if (G.che === "lagrange") {
          cap.push([V.mau("ok"), "điểm Lagrange ổn định"]);
          cap.push([V.mau("ba"), "điểm Lagrange không ổn định"]);
        }
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "n-body",
        bang: cv,
        tocDo: 60,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k) { return "bước " + k.toLocaleString("vi"); }
      });

      var r = V.khung(host, {
        ten: "n-body",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Một luật:</b> mỗi cặp vật hút nhau theo <code>F = G·m₁·m₂/r²</code>. Không " +
          "có gì khác trong mã. Bài toán <b>mọi cặp</b>, nên 300 vật là 44 850 phép tính lực " +
          "mỗi bước — đó chính là lý do người ta phải nghĩ ra Barnes–Hut và các phép xấp xỉ." +
          "<ul>" +
          "<li><b>Hai vật:</b> Newton giải được bằng công thức, quỹ đạo là ellipse. " +
          "<b>Ba vật:</b> Poincaré chứng minh năm 1890 rằng <b>không có công thức nào</b>. " +
          "Công trình đó khai sinh lý thuyết hỗn loạn — ba mươi năm trước Lorenz.</li>" +
          "<li><b>Nhưng ba vật có năm điểm đặc biệt.</b> Ở đó lực hấp dẫn của hai vật lớn " +
          "cộng với lực ly tâm triệt tiêu vừa đúng, nên một vật nhỏ đặt ở đó sẽ quay đồng " +
          "bộ cùng hệ. Chạy cảnh ① và xem các hạt thử: <b>L1, L2, L3</b> (vòng đứt) là " +
          "<i>đỉnh đồi</i> — hạt trượt đi ngay. <b>L4 và L5</b> (vòng liền) là " +
          "<i>lòng chảo</i> — hạt bị giữ lại và lắc quanh đó mãi.</li>" +
          "<li><b>Nhưng L4/L5 chỉ ổn định khi một vật đủ nhẹ hơn vật kia:</b> " +
          "<code>μ = m₂/(m₁+m₂) &lt; 0,0385</code>. Kéo <b>tỉ lệ khối lượng</b> lên 0,15 và " +
          "xem đám hạt ở L4/L5 bắt đầu trôi. Mặt Trời–Mộc Tinh có μ = 0,00095, thoả thừa — " +
          "và đúng là ở L4/L5 của Mộc Tinh có hơn <b>một triệu tiểu hành tinh Trojan</b> " +
          "đang nằm, đã nằm ở đó hàng tỉ năm.</li>" +
          "<li><b>L2 là nơi kính James Webb đang đậu</b> — cách Trái Đất 1,5 triệu km. Vì L2 " +
          "<i>không</i> ổn định, kính phải đốt nhiên liệu chỉnh vị trí vài tuần một lần. " +
          "Khi hết nhiên liệu, nó sẽ trôi đi. Tuổi thọ của nó bị giới hạn bởi đúng cái " +
          "vòng đứt nét trên hình.</li>" +
          "<li><b>Về tích phân số:</b> lab dùng <b>leapfrog</b> chứ không phải Euler. Euler " +
          "làm năng lượng trôi đều đặn và hành tinh xoáy dần vào sao. Leapfrog giữ năng " +
          "lượng dao động quanh một mức — xem dòng “năng lượng trôi” trong bảng, nó ở lại " +
          "rất gần 0 dù chạy hàng vạn bước.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
