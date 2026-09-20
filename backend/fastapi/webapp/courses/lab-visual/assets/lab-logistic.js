/* =====================================================================
   lab-logistic.js — Anh xa logistic x <- r·x·(1-x), duong vao hon loan.

   Ba che do: so do phan nhanh · day so theo thoi gian · mang nhen.
   Cung MOT phuong trinh mot dong, ba cach nhin.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  function buocTiep(r, x) { return r * x * (1 - x); }

  /** Uoc luong chu ky cua quy dao sau khi da qua giai doan chuyen tiep.
      Tra ve 0 neu khong tim thay chu ky <= toiDa (coi nhu hon loan). */
  function chuKy(r, x0, boQua, toiDa) {
    var x = x0, i;
    for (i = 0; i < boQua; i++) x = buocTiep(r, x);
    var moc = x, mau = [];
    for (i = 0; i < toiDa * 4; i++) { x = buocTiep(r, x); mau.push(x); }
    for (var p = 1; p <= toiDa; p++) {
      var khop = true;
      for (var j = 0; j < 3; j++) {
        if (Math.abs(mau[p * j + p - 1] - mau[p - 1]) > 1e-9) { khop = false; break; }
      }
      /* Chu ky p dung khi quay lai dung moc sau p buoc, lap lai on dinh. */
      if (khop && Math.abs(mau[p - 1] - moc) < 1e-6 === false) { /* chi de ro y */ }
      if (khop) return p;
    }
    return 0;
  }

  function soLe(v, n) { return v.toFixed(n === undefined ? 3 : n); }

  demo({
    id: "logistic",
    nhom: "Hệ động lực & hỗn loạn",
    mon: "L02",
    ten: "Logistic map — đường vào hỗn loạn",
    moTa: "Một phương trình dài một dòng: <code>x ← r·x·(1−x)</code>. Kéo <b>r</b> từ 2,4 " +
          "lên 4 và xem nó lần lượt: đứng yên → dao động 2 nhịp → 4 → 8 → và rơi vào " +
          "hỗn loạn. Không có ngẫu nhiên ở đâu cả — mọi thứ đều do <b>r</b> quyết định.",

    dung: function (host) {
      var BTL = null, B = null;
      var cot = 800;                 /* so cot cua so do phan nhanh */
      var D = [];                    /* day so cho che do day-so */

      var TS = V.thamSo([
        { ma: "che", ten: "Chế độ xem", kieu: "chon", gt: "so-do", muc: [
          { v: "so-do",    t: "① Sơ đồ phân nhánh — toàn cảnh" },
          { v: "mang-nhen",t: "② Mạng nhện — một giá trị r, nhìn cơ chế" },
          { v: "day-so",   t: "③ Dãy số theo thời gian" }
        ] },

        { ten: "① Sơ đồ phân nhánh", kieu: "nhom", hien: function (g) { return g.che === "so-do"; } },
        { ma: "rMin", ten: "r bắt đầu", kieu: "so", min: 0, max: 3.9, buoc: 0.01, gt: 2.4,
          hien: function (g) { return g.che === "so-do"; } },
        { ma: "rMax", ten: "r kết thúc", kieu: "so", min: 2.5, max: 4, buoc: 0.01, gt: 4,
          moTa: "Thu hẹp vào 3,84–3,86 để thấy <b>cửa sổ chu kỳ 3</b> — một khoảng " +
                "trật tự nằm giữa hỗn loạn, và bên trong nó lại là một sơ đồ phân nhánh thu nhỏ.",
          hien: function (g) { return g.che === "so-do"; } },
        { ma: "boQua", ten: "Bỏ qua bao nhiêu bước đầu", kieu: "so", min: 0, max: 800, buoc: 10, gt: 300,
          moTa: "Giai đoạn chuyển tiếp. Kéo về 0 để thấy vệt mờ của đường đi trước khi ổn định.",
          hien: function (g) { return g.che === "so-do"; } },
        { ma: "soDiem", ten: "Số điểm vẽ mỗi cột", kieu: "so", min: 10, max: 400, buoc: 10, gt: 160,
          hien: function (g) { return g.che === "so-do"; } },

        { ten: "② ③ Một giá trị r", kieu: "nhom", hien: function (g) { return g.che !== "so-do"; } },
        { ma: "r", ten: "Hệ số sinh sản r", kieu: "so", min: 0, max: 4, buoc: 0.001, gt: 3.2,
          moTa: "Mốc đáng thử: <b>2,8</b> đứng yên · <b>3,2</b> hai nhịp · <b>3,5</b> bốn nhịp · " +
                "<b>3,83</b> ba nhịp · <b>3,9</b> hỗn loạn.",
          hien: function (g) { return g.che !== "so-do"; } },
        { ma: "x0", ten: "Giá trị khởi đầu x₀", kieu: "so", min: 0.001, max: 0.999, buoc: 0.001, gt: 0.2,
          moTa: "Ở r hỗn loạn, đổi x₀ một phần nghìn là cả dãy số khác hẳn — " +
                "đó chính là <i>hiệu ứng cánh bướm</i>.",
          hien: function (g) { return g.che !== "so-do"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Toàn cảnh",        gt: { che: "so-do", rMin: 2.4, rMax: 4 } },
          { ten: "Cửa sổ chu kỳ 3",  gt: { che: "so-do", rMin: 3.82, rMax: 3.86, soDiem: 300 } },
          { ten: "Đứng yên (r=2,8)", gt: { che: "mang-nhen", r: 2.8, x0: 0.2 } },
          { ten: "Hai nhịp (r=3,2)", gt: { che: "mang-nhen", r: 3.2, x0: 0.2 } },
          { ten: "Bốn nhịp (r=3,5)", gt: { che: "mang-nhen", r: 3.5, x0: 0.2 } },
          { ten: "Hỗn loạn (r=3,9)", gt: { che: "day-so", r: 3.9, x0: 0.2 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.62, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      BTL = V.bangTichLuy(cv);

      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });
      var P = null;

      /* ============================================================
         ① SO DO PHAN NHANH
         ============================================================ */
      function sdChuanBi() {
        cot = Math.max(200, Math.round(cv.W - 90));
        B = V.bieuDo(cv, {
          x: { min: G.rMin, max: G.rMax, nhan: "r →" },
          y: { min: 0, max: 1, nhan: "x (mật độ quần thể)", dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 4
        });
        BTL.xoa();
      }

      function sdMotCot(gd, i) {
        var r = G.rMin + (G.rMax - G.rMin) * (i - 1) / Math.max(1, cot - 1);
        var x = 0.5, j;
        for (j = 0; j < G.boQua; j++) x = buocTiep(r, x);
        var px = B.px(r);
        gd.fillStyle = V.mau("ac");
        gd.globalAlpha = 0.16;
        for (j = 0; j < G.soDiem; j++) {
          x = buocTiep(r, x);
          gd.fillRect(px, B.py(x), 1, 1);
        }
        gd.globalAlpha = 1;
      }

      function sdVe(k) {
        BTL.toi(k, sdMotCot);
        B.nen();
        B.truc();
        BTL.dan();
        S.dat({
          "Khoảng r": soLe(G.rMin, 2) + " → " + soLe(G.rMax, 2),
          "Cột đã vẽ": k.toLocaleString("vi") + " / " + cot.toLocaleString("vi"),
          "Bỏ qua / vẽ mỗi cột": G.boQua + " / " + G.soDiem,
          "Hằng số Feigenbaum": "δ ≈ 4,669 — tỉ lệ co của mỗi lần nhân đôi",
          "Bắt đầu hỗn loạn": "r ≈ 3,5699"
        });
      }

      /* ============================================================
         ② MANG NHEN
         ============================================================ */
      var mnX = 0;

      function mnChuanBi() {
        mnX = G.x0;
        B = V.bieuDo(cv, {
          x: { min: 0, max: 1, nhan: "xₙ →" },
          y: { min: 0, max: 1, nhan: "xₙ₊₁", dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 4
        });
        D = [G.x0];
      }

      function mnBuoc() {
        mnX = buocTiep(G.r, mnX);
        D.push(mnX);
      }

      function mnVe(k) {
        B.nen();
        B.truc();

        /* duong cheo y = x, va parabol y = r·x·(1-x) */
        B.duong([[0, 0], [1, 1]], V.mau("tx3"), 1.2);
        var par = [], i;
        for (i = 0; i <= 120; i++) {
          var x = i / 120;
          par.push([x, buocTiep(G.r, x)]);
        }
        B.duong(par, V.mau("ba"), 2);

        /* mang nhen: doc len parabol, ngang sang duong cheo, lap lai */
        var n = Math.min(k, D.length - 1);
        for (i = 0; i < n; i++) {
          var a = D[i], b = D[i + 1];
          var mo = 0.25 + 0.75 * (i / Math.max(1, n));
          g.save();
          g.globalAlpha = mo;
          B.doan(a, a === D[0] && i === 0 ? 0 : a, a, b, V.mau("ac"), 1.2);
          B.doan(a, b, b, b, V.mau("ac"), 1.2);
          g.restore();
        }
        if (n >= 0 && D[n] !== undefined) B.diem(D[n], D[n], V.mau("ac2"), 4);

        /* diem co dinh x* = 1 - 1/r va do on dinh |f'(x*)| = |2 - r| */
        var on = "—";
        if (G.r > 1) {
          var xs = 1 - 1 / G.r;
          var doc = Math.abs(2 - G.r);
          B.moc(xs, V.mau("loi"), "x* = " + soLe(xs) + "  |f′| = " + soLe(doc, 2) +
                (doc < 1 ? "  (hút)" : "  (đẩy)"));
          on = doc < 1 ? "ổn định — quỹ đạo bị hút vào" : "bất ổn — quỹ đạo bị đẩy ra";
        }

        var ck = chuKy(G.r, G.x0, 600, 16);
        S.dat({
          "r": soLe(G.r),
          "x₀": soLe(G.x0),
          "x hiện tại": soLe(D[Math.min(k, D.length - 1)] || 0),
          "Điểm cố định x* = 1 − 1/r": G.r > 1 ? soLe(1 - 1 / G.r) : "không có",
          "Trạng thái x*": on,
          "Chu kỳ quan sát được": ck ? (ck + " nhịp") : "không tuần hoàn (hỗn loạn)"
        });
      }

      /* ============================================================
         ③ DAY SO THEO THOI GIAN
         ============================================================ */
      var SO_BUOC = 220;

      function dsChuanBi() {
        D = [G.x0];
        var x = G.x0;
        for (var i = 0; i < SO_BUOC; i++) { x = buocTiep(G.r, x); D.push(x); }
        B = V.bieuDo(cv, {
          x: { min: 0, max: SO_BUOC, nhan: "bước n →" },
          y: { min: 0, max: 1, nhan: "xₙ", dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 4
        });
      }

      function dsVe(k) {
        B.nen();
        B.truc();

        /* Day thu hai lech x0 mot phan nghin — de canh nhau moi thay
           hai quy dao tach ra nhanh the nao khi r vao vung hon loan. */
        var lech = [], x2 = Math.min(0.999, G.x0 + 0.001), i;
        lech.push([0, x2]);
        for (i = 1; i <= SO_BUOC; i++) { x2 = buocTiep(G.r, x2); lech.push([i, x2]); }
        B.duong(lech.slice(0, k + 1), V.mau("ba"), 1.2);

        var chinh = [];
        for (i = 0; i <= Math.min(k, SO_BUOC); i++) chinh.push([i, D[i]]);
        B.duong(chinh, V.mau("ac"), 1.8);
        if (k <= SO_BUOC) B.diem(k, D[k], V.mau("ac2"));

        /* buoc dau tien hai day lech nhau qua 0,05 */
        var tach = 0;
        for (i = 0; i <= SO_BUOC; i++) {
          if (Math.abs(lech[i][1] - D[i]) > 0.05) { tach = i; break; }
        }
        var ck = chuKy(G.r, G.x0, 600, 16);
        S.dat({
          "r": soLe(G.r),
          "x₀ (xanh) / x₀+0,001 (vàng)": soLe(G.x0) + " / " + soLe(Math.min(0.999, G.x0 + 0.001)),
          "x hiện tại": soLe(D[Math.min(k, SO_BUOC)]),
          "Chu kỳ quan sát được": ck ? (ck + " nhịp") : "không tuần hoàn (hỗn loạn)",
          "Hai dãy tách nhau ở bước": tach ? tach : "không tách (cùng số phận)"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function chuThich(cap) {
        ghiChu.innerHTML = "";
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
      }

      function apDung() {
        if (!cv.W) return;
        if (G.che === "so-do") {
          if (G.rMax <= G.rMin) TS.dat("rMax", Math.min(4, G.rMin + 0.1), true);
          sdChuanBi();
          P.datToiDa(cot);
          P.datTocDoUI(220);
          chuThich([[V.mau("ac"), "giá trị x mà quỹ đạo lui tới sau khi ổn định"]]);
        } else if (G.che === "mang-nhen") {
          mnChuanBi();
          P.datToiDa(120);
          P.datTocDoUI(3);
          chuThich([[V.mau("ba"), "parabol y = r·x·(1−x)"], [V.mau("tx3"), "đường chéo y = x"],
                    [V.mau("ac"), "đường đi"], [V.mau("loi"), "điểm cố định x*"]]);
        } else {
          dsChuanBi();
          P.datToiDa(SO_BUOC);
          P.datTocDoUI(12);
          chuThich([[V.mau("ac"), "x₀"], [V.mau("ba"), "x₀ + 0,001"]]);
        }
        P.datLai();
      }

      P = V.phat({
        ten: "logistic",
        bang: cv,
        tocDo: 220,
        buoc: function () {
          if (G.che === "mang-nhen") mnBuoc();
          return true;
        },
        datLai: function () {
          if (G.che === "so-do") BTL.xoa();
          if (G.che === "mang-nhen") { mnX = G.x0; D = [G.x0]; }
        },
        ve: function (k) {
          if (G.che === "so-do") sdVe(k);
          else if (G.che === "mang-nhen") mnVe(k);
          else dsVe(k);
        },
        nhan: function (k, xong) {
          if (G.che === "so-do") return xong ? "đã quét hết khoảng r" : ("r = " + soLe(G.rMin + (G.rMax - G.rMin) * k / Math.max(1, cot), 3));
          return "x = " + soLe(D[Math.min(k, D.length - 1)] || 0);
        }
      });

      var r = V.khung(host, {
        ten: "logistic",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Mô hình:</b> một quần thể chiếm tỉ lệ <code>x</code> của sức chứa tối đa. " +
          "Năm sau: <code>x ← r·x·(1−x)</code> — sinh sản theo <code>r·x</code>, nhưng bị " +
          "chính mật độ <code>(1−x)</code> kìm lại. Chỉ có thế." +
          "<ul>" +
          "<li><b>r &lt; 1</b> quần thể tuyệt chủng. <b>1 &lt; r &lt; 3</b> ổn định ở một mức duy nhất.</li>" +
          "<li><b>r = 3</b> điểm cố định mất ổn định, quần thể bắt đầu <b>dao động 2 nhịp</b>. " +
          "Rồi 4, rồi 8, 16… và các khoảng cách ngắn lại theo hằng số Feigenbaum <b>δ ≈ 4,669</b> — " +
          "con số này xuất hiện ở <i>mọi</i> hệ nhân đôi chu kỳ, không riêng phương trình này.</li>" +
          "<li><b>r ≈ 3,5699</b> chu kỳ thành vô hạn: <b>hỗn loạn</b>. Không ngẫu nhiên, nhưng " +
          "không đoán trước được.</li>" +
          "<li><b>Điều bất ngờ:</b> giữa vùng hỗn loạn có những <b>cửa sổ trật tự</b>. Thu khoảng " +
          "r về 3,82–3,86 ở chế độ ①: chu kỳ 3 hiện ra, và bên trong nó lại là một sơ đồ " +
          "phân nhánh y hệt thu nhỏ. Hỗn loạn có cấu trúc fractal.</li>" +
          "</ul>" +
          "<b>Chế độ ② mạng nhện</b> cho thấy <i>vì sao</i>: quỹ đạo bật giữa parabol và đường chéo. " +
          "Điểm cố định hút hay đẩy là do độ dốc <code>|f′(x*)| = |2 − r|</code> nhỏ hay lớn hơn 1. " +
          "Vượt r = 3 là độ dốc vượt 1, và điểm cố định đẩy quỹ đạo ra."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
