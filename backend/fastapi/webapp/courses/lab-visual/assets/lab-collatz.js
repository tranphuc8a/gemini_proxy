/* =====================================================================
   lab-collatz.js — Gia thuyet Collatz (3n+1), bon che do xem.

   Day cung la LAB THAM CHIEU cua engine v2: no dung het moi thu engine
   co — tham so khai bao bang lieu do, tham so an/hien theo che do, kich
   ban dung san, permalink, bo phat co tua, xuat PNG, ghi video, canvas
   co gian, toan man hinh, phim tat. Lab moi nen chep khung cua file nay.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var N_TOI_DA = 1000000;

  /* ------------------------------------------------------------------
     Phan toan hoc — tach rieng khoi phan ve.
     ------------------------------------------------------------------ */

  /** Day Collatz day du tu n ve 1. Voi n < 10^6 dinh cao nhat khoang
      5.6e13 — van nam gon trong so nguyen chinh xac cua JS (2^53). */
  function day(n) {
    var d = [n], x = n;
    while (x !== 1 && d.length < 2000) {
      x = (x % 2 === 0) ? x / 2 : 3 * x + 1;
      d.push(x);
    }
    return d;
  }

  /* Bo nho dem thoi gian dung. Luu tg+1 de gia tri 0 co nghia "chua biet". */
  var DEM = null, DEM_CO = 0;
  function dungBoNho(co) {
    co = Math.min(co, 4000000);
    if (!DEM || DEM_CO < co) { DEM = new Int32Array(co + 1); DEM_CO = co; }
  }

  /** So buoc tu n ve 1. Leo len den cho da biet roi to nguoc lai. */
  function thoiGianDung(n) {
    var ngan = [], x = n, buoc = 0;
    while (true) {
      if (x === 1) { buoc = 0; break; }
      if (x <= DEM_CO && DEM[x]) { buoc = DEM[x] - 1; break; }
      ngan.push(x);
      x = (x % 2 === 0) ? x / 2 : 3 * x + 1;
      if (ngan.length > 3000) { buoc = 0; break; }   /* chan an toan */
    }
    for (var i = ngan.length - 1; i >= 0; i--) {
      buoc++;
      if (ngan[i] <= DEM_CO) DEM[ngan[i]] = buoc + 1;
    }
    return buoc;
  }

  /* ------------------------------------------------------------------
     Tien ich ve
     ------------------------------------------------------------------ */
  function nen(cv) {
    var g = cv.g;
    g.clearRect(0, 0, cv.W, cv.H);
    g.fillStyle = V.mau("surf");
    g.fillRect(0, 0, cv.W, cv.H);
  }

  function so(v) {
    if (v >= 1e12) return (v / 1e12).toFixed(1) + "×10¹²";
    if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỉ";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + " triệu";
    return Math.round(v).toLocaleString("vi");
  }

  function toaDo(e, cv) {
    var r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * cv.W / r.width,
      y: (e.clientY - r.top) * cv.H / r.height
    };
  }

  /* ==================================================================
     LAB
     ================================================================== */
  demo({
    id: "collatz",
    nhom: "Giả thuyết Collatz",
    mon: "L01",
    ten: "Collatz 3n+1 — bốn cách nhìn cùng một quy tắc",
    moTa: "Chẵn thì chia đôi, lẻ thì nhân ba cộng một. Quy tắc gọn hơn một dòng, " +
          "và chưa ai chứng minh được nó luôn về 1. Bốn chế độ dưới đây vẽ <b>cùng " +
          "một quy tắc</b> theo bốn cách — mỗi cách lộ ra một tính chất mà ba cách kia giấu đi.",

    dung: function (host) {
      /* --- trang thai dung chung giua cac che do --- */
      var D = [], dinh = 1;                 /* quy dao */
      var nut = [], sauToiDa = 1;           /* cay nguoc */
      var BTL = null;                       /* hoa van + ban do: bo dem tich luy */
      var oTg = null, oCot = 0, oHang = 0, oCanh = 0, oLe = 0;  /* ban do */
      var chuot = null;

      var TS = V.thamSo([
        { ma: "che", ten: "Chế độ xem", kieu: "chon", gt: "quy-dao", muc: [
          { v: "quy-dao",  t: "① Quỹ đạo — một số, một hành trình" },
          { v: "cay-nguoc",t: "② Cây ngược — mọi đường dẫn về 1" },
          { v: "hoa-van",  t: "③ Hoa văn — xếp chồng hàng nghìn quỹ đạo" },
          { v: "ban-do",   t: "④ Bản đồ — số nào lâu về 1 nhất" }
        ] },

        { ten: "① Quỹ đạo", kieu: "nhom", hien: function (g) { return g.che === "quy-dao"; } },
        { ma: "n", ten: "Số bắt đầu", kieu: "nhap", min: 1, max: N_TOI_DA, buoc: 1, gt: 27,
          moTa: "Thử 27 (111 bước), rồi 97, rồi 871. Số nhỏ không có nghĩa là hành trình ngắn.",
          hien: function (g) { return g.che === "quy-dao"; } },
        { ma: "log", ten: "Trục dọc theo log", kieu: "bat", gt: true,
          moTa: "Tắt đi để thấy vì sao cần log: đỉnh cao nuốt hết phần còn lại.",
          hien: function (g) { return g.che === "quy-dao"; } },

        { ten: "② Cây ngược", kieu: "nhom", hien: function (g) { return g.che === "cay-nguoc"; } },
        { ma: "sauCay", ten: "Số tầng", kieu: "so", min: 3, max: 20, buoc: 1, gt: 12,
          moTa: "Đi ngược: từ x luôn tới được 2x, và tới được (x−1)/3 khi số đó lẻ.",
          hien: function (g) { return g.che === "cay-nguoc"; } },

        { ten: "③ Hoa văn", kieu: "nhom", hien: function (g) { return g.che === "hoa-van"; } },
        { ma: "soDuong", ten: "Số quỹ đạo xếp chồng", kieu: "so", min: 20, max: 4000, buoc: 10, gt: 1200,
          hien: function (g) { return g.che === "hoa-van"; } },
        { ma: "gocChan", ten: "Góc rẽ khi gặp số chẵn", kieu: "so", min: 0, max: 30, buoc: 0.5, gt: 8, donVi: "°",
          hien: function (g) { return g.che === "hoa-van"; } },
        { ma: "gocLe", ten: "Góc rẽ khi gặp số lẻ", kieu: "so", min: 0, max: 40, buoc: 0.5, gt: 20, donVi: "°",
          moTa: "Hai góc này không có ý nghĩa toán học — chúng chỉ biến dãy số thành hình. " +
                "Nhưng hình thì <i>có</i> ý nghĩa: nhánh dày là nơi nhiều số đi chung đường.",
          hien: function (g) { return g.che === "hoa-van"; } },
        { ma: "daiDoan", ten: "Độ dài mỗi đoạn", kieu: "so", min: 2, max: 14, buoc: 0.5, gt: 6, donVi: "px",
          hien: function (g) { return g.che === "hoa-van"; } },

        { ten: "④ Bản đồ thời gian dừng", kieu: "nhom", hien: function (g) { return g.che === "ban-do"; } },
        { ma: "soN", ten: "Xét bao nhiêu số", kieu: "so", min: 2000, max: 120000, buoc: 1000, gt: 40000,
          hien: function (g) { return g.che === "ban-do"; } },
        { ma: "tranMau", ten: "Ngưỡng màu đậm nhất", kieu: "so", min: 60, max: 400, buoc: 10, gt: 200, donVi: " bước",
          moTa: "Rê chuột lên bản đồ để đọc từng ô.",
          hien: function (g) { return g.che === "ban-do"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Số 27 khét tiếng", gt: { che: "quy-dao", n: 27, log: true } },
          { ten: "Kỷ lục 837799",    gt: { che: "quy-dao", n: 837799, log: true } },
          { ten: "San hô Collatz",   gt: { che: "hoa-van", soDuong: 2000, gocChan: 8, gocLe: 20, daiDoan: 6 } },
          { ten: "Hoa văn xoắn",     gt: { che: "hoa-van", soDuong: 1500, gocChan: 3, gocLe: 30, daiDoan: 8 } },
          { ten: "Cây ngược 15 tầng",gt: { che: "cay-nguoc", sauCay: 15 } },
          { ten: "Bản đồ 100k",      gt: { che: "ban-do", soN: 100000, tranMau: 250 } }
        ]
      });

      var G = TS.gt;

      /* --- canvas co gian; doi kich thuoc thi dung lai tu dau --- */
      var cv = V.veBangCo({
        rong: 820, tiLe: 0.64,
        veLai: function () { if (P) apDung(); }
      });
      var g = cv.g;

      BTL = V.bangTichLuy(cv);

      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });
      var P = null;

      /* ==============================================================
         ① QUY DAO
         ============================================================== */
      var B = null;

      function qdChuanBi() {
        D = day(Math.max(1, Math.round(G.n)));
        dinh = D.reduce(function (a, b) { return b > a ? b : a; }, 1);
        B = V.bieuDo(cv, {
          x: { min: 0, max: Math.max(1, D.length - 1), nhan: "bước →" },
          /* Truc log doi min > 0. Moi gia tri Collatz deu >= 1 nen lay 1. */
          y: { min: G.log ? 1 : 0, max: dinh * 1.06, log: G.log, dinhDang: so },
          luoi: 5
        });
      }

      function qdVe(k) {
        B.nen();
        B.truc();

        /* duong di, to mau theo huong: len = 3n+1, xuong = chia doi */
        var len = V.mau("ba"), xuong = V.mau("ac");
        for (var i = 1; i <= k && i < D.length; i++) {
          B.doan(i - 1, D[i - 1], i, D[i], D[i] > D[i - 1] ? len : xuong);
        }

        var iDinh = D.indexOf(dinh);
        if (iDinh >= 0 && iDinh <= k) B.moc(dinh, V.mau("loi"), "đỉnh " + so(dinh));

        if (k < D.length) {
          B.diem(k, D[k], V.mau("ac2"));
          B.chu(k, D[k], so(D[k]), V.mau("ac2"), k > (D.length - 1) * 0.7 ? "right" : "left");
        }

        var soLen = 0;
        for (var j = 1; j < D.length; j++) if (D[j] > D[j - 1]) soLen++;
        S.dat({
          "Số bắt đầu": so(D[0]),
          "Tổng số bước": so(D.length - 1),
          "Đỉnh cao nhất": so(dinh),
          "Đỉnh / số ban đầu": (dinh / D[0]).toFixed(1) + "×",
          "Bước đi lên (3n+1)": so(soLen),
          "Bước đi xuống (÷2)": so(D.length - 1 - soLen),
          "Giá trị hiện tại": so(D[Math.min(k, D.length - 1)])
        });
      }

      /* ==============================================================
         ② CAY NGUOC — moi duong dan ve 1
         ============================================================== */
      function cnChuanBi() {
        var TRAN = 4000;
        nut = [{ v: 1, cha: -1, sau: 0, con: [] }];
        var dau = 0;
        sauToiDa = 0;
        while (dau < nut.length && nut.length < TRAN) {
          var iCha = dau, t = nut[dau++];
          if (t.sau >= G.sauCay) continue;
          var truoc = [];
          if (t.v * 2 <= Number.MAX_SAFE_INTEGER) truoc.push(t.v * 2);
          /* nhanh 3n+1 nguoc: y = (v-1)/3, chi hop le khi y le va y > 1 */
          if ((t.v - 1) % 3 === 0) {
            var y = (t.v - 1) / 3;
            if (y > 1 && y % 2 === 1) truoc.push(y);
          }
          for (var i = 0; i < truoc.length && nut.length < TRAN; i++) {
            nut.push({ v: truoc[i], cha: iCha, sau: t.sau + 1, con: [] });
            t.con.push(nut.length - 1);
            if (t.sau + 1 > sauToiDa) sauToiDa = t.sau + 1;
          }
        }
        /* bo cuc: la xep deu theo chieu doc, nut trong nam giua cac con */
        var oLa = 0;
        (function xepChoNut(i) {
          var t = nut[i];
          if (!t.con.length) { t.y = oLa++; return; }
          var tong = 0;
          t.con.forEach(function (c) { xepChoNut(c); tong += nut[c].y; });
          t.y = tong / t.con.length;
        })(0);
        var soLa = Math.max(1, oLa - 1);
        nut.forEach(function (t) { t.ty = t.y / soLa; });
      }

      function cnVe(k) {
        nen(cv);
        var W = cv.W, H = cv.H;
        var x0 = 46, x1 = W - 58, y0 = 16, y1 = H - 16;
        var px = function (t) { return x0 + (x1 - x0) * (sauToiDa ? t.sau / sauToiDa : 0); };
        var py = function (t) { return y0 + (y1 - y0) * t.ty; };

        g.lineWidth = 1.2; g.lineCap = "round";
        for (var i = 1; i <= k && i < nut.length; i++) {
          var t = nut[i], c = nut[t.cha];
          if (!c) continue;
          /* nhanh nhan doi ve mot mau, nhanh (x-1)/3 ve mau khac */
          var nhanDoi = t.v === c.v * 2;
          g.strokeStyle = nhanDoi ? V.mau("ac") : V.mau("ba");
          g.globalAlpha = nhanDoi ? 0.55 : 0.95;
          var xa = px(c), ya = py(c), xb = px(t), yb = py(t);
          g.beginPath();
          g.moveTo(xa, ya);
          g.bezierCurveTo((xa + xb) / 2, ya, (xa + xb) / 2, yb, xb, yb);
          g.stroke();
        }
        g.globalAlpha = 1;

        /* nhan cho vai nut dau de nguoi xem bam duoc vao quy tac */
        g.font = "600 11px ui-monospace,monospace";
        g.textAlign = "right"; g.textBaseline = "middle";
        for (var j = 0; j <= k && j < nut.length && j < 40; j++) {
          var u = nut[j];
          g.fillStyle = j === 0 ? V.mau("loi") : V.mau("tx2");
          g.fillText(String(u.v), px(u) - 5, py(u));
        }

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("gốc = 1", 6, 6);
        g.textAlign = "right";
        g.fillText("tầng " + sauToiDa + " →", W - 6, 6);

        var hienSo = Math.min(k + 1, nut.length);
        var lonNhat = 0;
        for (var q = 0; q < hienSo; q++) if (nut[q].v > lonNhat) lonNhat = nut[q].v;
        S.dat({
          "Số tầng": sauToiDa,
          "Nút đã hiện": so(hienSo) + " / " + so(nut.length),
          "Số lớn nhất trên cây": so(lonNhat),
          "Nhánh ×2 (xanh)": "luôn tồn tại",
          "Nhánh (x−1)/3 (vàng)": "hiếm — đây là chỗ cây phân nhánh"
        });
      }

      /* ==============================================================
         ③ HOA VAN — xep chong hang nghin quy dao
         ============================================================== */
      function hvChuanBi() {
        BTL.xoa();
      }

      /* gd da o he toa do logic — bang tich luy lo phan chia ti le man hinh. */
      function hvMotDuong(gd, n) {
        var d = day(n);
        var x = cv.W / 2, y = cv.H * 0.97, huong = -Math.PI / 2;
        var gc = G.gocChan * Math.PI / 180, gl = G.gocLe * Math.PI / 180;
        gd.lineWidth = 1;
        gd.globalAlpha = 0.22;
        gd.beginPath();
        gd.moveTo(x, y);
        /* di NGUOC: bat dau tu 1 roi lan ve n — nho vay moi duong deu
           chung mot goc, va cho nao dong thi cho do nhieu so di qua */
        for (var i = d.length - 1; i >= 0; i--) {
          huong += (d[i] % 2 === 0) ? gc : -gl;
          x += Math.cos(huong) * G.daiDoan;
          y += Math.sin(huong) * G.daiDoan;
          gd.lineTo(x, y);
        }
        gd.strokeStyle = V.thangMau(Math.min(1, d.length / 160));
        gd.stroke();
        gd.globalAlpha = 1;
      }

      function hvVe(k) {
        BTL.toi(k, hvMotDuong);
        nen(cv);
        BTL.dan();
        S.dat({
          "Quỹ đạo đã vẽ": so(k) + " / " + so(G.soDuong),
          "Góc chẵn / lẻ": G.gocChan + "° / " + G.gocLe + "°",
          "Màu": "nhạt = quỹ đạo ngắn, đậm = quỹ đạo dài"
        });
      }

      /* ==============================================================
         ④ BAN DO THOI GIAN DUNG
         ============================================================== */
      function bdChuanBi() {
        var N = Math.round(G.soN);
        dungBoNho(Math.min(N * 4, 4000000));
        oTg = new Int32Array(N + 1);
        oCot = Math.max(1, Math.round(Math.sqrt(N * cv.W / cv.H)));
        oHang = Math.ceil(N / oCot);
        oCanh = Math.min(cv.W / oCot, (cv.H - 26) / oHang);
        oLe = (cv.W - oCanh * oCot) / 2;
        BTL.xoa();
      }

      function bdMotO(gd, n) {
        var tg = thoiGianDung(n);
        oTg[n] = tg;
        var i = n - 1, c = i % oCot, r = Math.floor(i / oCot);
        gd.fillStyle = V.thangMau(Math.min(1, tg / G.tranMau));
        gd.fillRect(oLe + c * oCanh, 22 + r * oCanh, Math.ceil(oCanh), Math.ceil(oCanh));
      }

      function bdVe(k) {
        BTL.toi(k, bdMotO);
        nen(cv);
        BTL.dan();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("n = 1 ở góc trên trái, tăng dần sang phải rồi xuống dòng", 4, 4);

        var noiDung = {
          "Đã tính": so(k) + " / " + so(G.soN),
          "Ngưỡng màu": G.tranMau + " bước"
        };
        if (chuot) {
          var c = Math.floor((chuot.x - oLe) / oCanh);
          var r = Math.floor((chuot.y - 22) / oCanh);
          if (c >= 0 && c < oCot && r >= 0) {
            var n = r * oCot + c + 1;
            if (n >= 1 && n <= G.soN && n <= k) {
              noiDung["Ô đang trỏ"] = "n = " + so(n);
              noiDung["→ số bước về 1"] = so(oTg[n]);
              /* vien o dang tro */
              g.strokeStyle = V.mau("tx"); g.lineWidth = 1.5;
              g.strokeRect(oLe + c * oCanh - 1, 22 + r * oCanh - 1, oCanh + 2, oCanh + 2);
            }
          }
        }
        S.dat(noiDung);
      }

      /* ==============================================================
         Dieu phoi
         ============================================================== */
      function chuThich(cap) {
        ghiChu.innerHTML = "";
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }),
            c[1]
          ]));
        });
      }

      function apDung() {
        if (!cv.W) return;
        chuot = null;
        if (G.che === "quy-dao") {
          qdChuanBi();
          P.datToiDa(Math.max(1, D.length - 1));
          chuThich([[V.mau("ba"), "bước lên: 3n+1"], [V.mau("ac"), "bước xuống: ÷2"],
                    [V.mau("loi"), "đỉnh cao nhất"]]);
        } else if (G.che === "cay-nguoc") {
          cnChuanBi();
          P.datToiDa(Math.max(1, nut.length - 1));
          chuThich([[V.mau("ac"), "nhánh ×2 (luôn có)"],
                    [V.mau("ba"), "nhánh (x−1)/3 (hiếm)"]]);
        } else if (G.che === "hoa-van") {
          hvChuanBi();
          P.datToiDa(Math.round(G.soDuong));
          chuThich([[V.thangMau(0.15), "quỹ đạo ngắn"], [V.thangMau(0.6), "trung bình"],
                    [V.thangMau(1), "quỹ đạo dài"]]);
        } else {
          bdChuanBi();
          P.datToiDa(Math.round(G.soN));
          chuThich([[V.thangMau(0), "về 1 nhanh"], [V.thangMau(0.5), "trung bình"],
                    [V.thangMau(1), "≥ ngưỡng"]]);
        }
        P.datLai();
      }

      P = V.phat({
        ten: "collatz",
        bang: cv,
        tocDo: 12,
        datLai: function () {
          if (G.che === "hoa-van" || G.che === "ban-do") BTL.xoa();
        },
        buoc: function () { return true; },   /* moi che do tu ve theo chi so k */
        ve: function (k) {
          if (G.che === "quy-dao") qdVe(k);
          else if (G.che === "cay-nguoc") cnVe(k);
          else if (G.che === "hoa-van") hvVe(k);
          else bdVe(k);
        },
        nhan: function (k, xong) {
          if (G.che === "quy-dao") {
            return xong ? ("về tới 1 sau " + so(D.length - 1) + " bước")
                        : ("đang ở " + so(D[Math.min(k, D.length - 1)]));
          }
          if (G.che === "cay-nguoc") return "đã mở " + so(Math.min(k + 1, nut.length)) + " nút";
          if (G.che === "hoa-van") return "đã xếp chồng " + so(k) + " quỹ đạo";
          return "đã tính " + so(k) + " số";
        }
      });

      cv.addEventListener("mousemove", function (e) {
        if (G.che !== "ban-do") return;
        chuot = toaDo(e, cv);
        if (!P.dangChay()) P.veLai();
      });
      cv.addEventListener("mouseleave", function () {
        if (G.che !== "ban-do") return;
        chuot = null;
        if (!P.dangChay()) P.veLai();
      });

      var r = V.khung(host, {
        ten: "collatz",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Quy tắc:</b> <code>n chẵn → n/2</code>, <code>n lẻ → 3n+1</code>. " +
          "Giả thuyết Collatz nói rằng mọi số nguyên dương đều về 1. Đã kiểm bằng máy tới " +
          "khoảng 2<sup>68</sup> mà vẫn <b>chưa ai chứng minh được</b>." +
          "<ul>" +
          "<li><b>① Quỹ đạo</b> — vì sao phải dùng trục log: tắt nó đi, cả hành trình bị " +
          "một cái đỉnh duy nhất nuốt chửng. Thử n = 27: số bé tí, 111 bước, vọt lên 9232.</li>" +
          "<li><b>② Cây ngược</b> — nhìn từ đích thay vì từ điểm xuất phát. Nhánh ×2 luôn có " +
          "nên cây dài; nhánh (x−1)/3 hiếm nên cây <i>phân nhánh thưa</i>. Chứng minh Collatz " +
          "tương đương chứng minh cây này chạm tới mọi số nguyên dương.</li>" +
          "<li><b>③ Hoa văn</b> — mỗi quỹ đạo là một sợi, xếp chồng thì phần thân chung dày lên. " +
          "Độ dày chính là số lượng quỹ đạo đi qua đó. Kéo hai góc rẽ để đổi dáng.</li>" +
          "<li><b>④ Bản đồ</b> — ô càng đậm càng lâu về 1. Nếu thời gian dừng là ngẫu nhiên, " +
          "bản đồ phải là nhiễu trắng. Nó <b>không</b> — có vệt, có sọc. Đó là cấu trúc chưa ai giải thích trọn vẹn.</li>" +
          "</ul>" +
          "<b>Mẹo dùng:</b> nhấn <b>Space</b> để chạy, <b>F</b> để xem toàn màn hình, " +
          "<b>Chép liên kết</b> để gửi cho người khác đúng cấu hình bạn đang xem."
      });
      r.trai.classList.add("co");

      /* Canvas mới chèn vào DOM chưa có chiều rộng thật — doi mot nhip roi dung. */
      requestAnimationFrame(function () {
        cv.doKichThuoc();
        apDung();
      });
    }
  });
})();
