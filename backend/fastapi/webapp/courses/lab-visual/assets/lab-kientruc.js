/* ==========================================================================
   LAB: Mô phỏng kiến trúc — tải, độ trễ p50/p99, nút thắt, chi phí.

   Người dùng → cân bằng tải → N máy ứng dụng → (cache) → DB chính + bản sao
   đọc, ghi có thể đi qua hàng đợi. Mỗi tầng là một hàng đợi M/M/c (c "người
   phục vụ" song song: luồng của máy app, kết nối của DB). Mỗi giây của 120
   giây mô phỏng, lấy MẪU 2 500 yêu cầu đi qua đúng đường của chúng — chờ ở
   mỗi tầng theo xác suất Erlang C, rồi được phục vụ — để ra p50 / p99 thật,
   chứ không chỉ một con số trung bình. Kéo thả thành phần vào sơ đồ (hoặc
   bấm), bấm "−" trên một khối để bỏ.
   ========================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var LUONG_APP = 16;                 /* luồng xử lý song song mỗi máy app */
  var KET_NOI_DB = 32;                /* kết nối đồng thời mỗi nút DB */
  var CACHE_LUONG = 16, CACHE_MS = 0.15;      /* một nút cache ≈ 100 nghìn yêu cầu/giây */
  var LB_LUONG = 64, LB_MS = 0.3;
  var HANG_DOI_LUONG = 8, HANG_DOI_MS = 1;
  var MANG_MS = 0.4;                  /* mỗi chặng mạng trong trung tâm dữ liệu */
  var HET_GIO_MS = 3000;
  var GIAY = 120, MAU = 2500;
  var AN_TOAN = 0.8;                  /* ngưỡng tải "an toàn" để còn chỗ cho đột biến */
  var GIA = { lb: 20, app: 60, cache: 45, db: 180, banSao: 140, hangDoi: 25 };  /* USD / tháng */

  /* Erlang C — xác suất một yêu cầu phải CHỜ ở hàng đợi M/M/c. Tính qua đệ quy
     Erlang B: công thức giai thừa tràn số khi c vài trăm (40 máy × 16 luồng). */
  function erlangC(c, a) {
    var b = 1;
    for (var k = 1; k <= c; k++) b = a * b / (k + a * b);
    var rho = a / c;
    return b / (1 - rho * (1 - b));
  }

  function tang(ten, lam, c, ms) {
    var mu = 1000 / ms, rho = lam / (c * mu);
    return { ten: ten, lam: lam, c: c, ms: ms, rho: rho, qua: rho >= 1,
             cho: rho < 1 && lam > 0 ? erlangC(c, lam / mu) : 0, du: c * mu - lam };
  }

  /* Thời gian (ms) một yêu cầu ở một tầng: chờ (nếu phải chờ) + được phục vụ. */
  function mauTang(t, u) {
    if (t.qua) return Infinity;
    var cho = u() < t.cho ? -Math.log(1 - u()) / t.du * 1000 : 0;
    return cho - Math.log(1 - u()) * t.ms;
  }

  function moHinh(lam, G) {
    var r = G.doc / 100, h = G.cache ? G.trungCache / 100 : 0;
    var R = Math.round(G.banSao), N = Math.round(G.app);
    var lamDoc = lam * r, lamGhi = lam - lamDoc, docDb = lamDoc * (1 - h);
    return {
      lb: tang("Cân bằng tải", lam, LB_LUONG, LB_MS),
      app: tang("Máy ứng dụng", lam, N * LUONG_APP, G.msApp),
      cache: G.cache ? tang("Cache", lamDoc, CACHE_LUONG, CACHE_MS) : null,
      /* Có hàng đợi thì DB chính vẫn phải ghi đủ lamGhi — chỉ là người dùng không chờ nó. */
      chinh: tang("DB chính", lamGhi + (R ? 0 : docDb), KET_NOI_DB, G.msDb),
      banSao: R ? tang("Bản sao DB", docDb / R, KET_NOI_DB, G.msDb) : null,
      hangDoi: G.hangDoi ? tang("Hàng đợi ghi", lamGhi, HANG_DOI_LUONG, HANG_DOI_MS) : null
    };
  }

  function mauYeuCau(T, G, u) {
    var ms = 2 * MANG_MS + mauTang(T.lb, u) + mauTang(T.app, u);
    if (u() < G.doc / 100) {
      if (T.cache) {
        ms += MANG_MS + mauTang(T.cache, u);
        if (u() < G.trungCache / 100) return ms;
      }
      return ms + MANG_MS + mauTang(T.banSao || T.chinh, u);
    }
    return ms + MANG_MS + mauTang(T.hangDoi || T.chinh, u);
  }

  function cacTang(T) {
    return [T.lb, T.app, T.cache, T.hangDoi, T.chinh, T.banSao].filter(Boolean);
  }
  function nutThat(T) {
    return cacTang(T).reduce(function (a, b) { return b.rho > a.rho ? b : a; });
  }

  function taiLuc(t, G) {
    if (G.hinh === "tang") return G.rps * (0.5 + 1.5 * t / (GIAY - 1));
    if (G.hinh === "dot-bien") return t >= 40 && t < 60 ? G.rps * G.heSoDot : G.rps;
    return G.rps;
  }

  /* Lưu lượng tối đa trước khi tầng đầu tiên chạm ngưỡng an toàn. */
  function sucChua(G) {
    var r = G.doc / 100, h = G.cache ? G.trungCache / 100 : 0, R = Math.round(G.banSao);
    var muDb = KET_NOI_DB * 1000 / G.msDb;
    var phan = [["Máy ứng dụng", 1, Math.round(G.app) * LUONG_APP * 1000 / G.msApp],
                ["DB chính", (1 - r) + (R ? 0 : r * (1 - h)), muDb],
                ["Cân bằng tải", 1, LB_LUONG * 1000 / LB_MS]];
    if (R) phan.push(["Bản sao DB", r * (1 - h) / R, muDb]);
    if (G.cache) phan.push(["Cache", r, CACHE_LUONG * 1000 / CACHE_MS]);
    var tot = null;
    phan.forEach(function (p) {
      if (p[1] <= 0) return;
      var lam = AN_TOAN * p[2] / p[1];
      if (!tot || lam < tot.lam) tot = { lam: lam, ten: p[0] };
    });
    return tot;
  }

  function chiPhi(G) {
    return GIA.lb + Math.round(G.app) * GIA.app + (G.cache ? GIA.cache : 0) + GIA.db +
      Math.round(G.banSao) * GIA.banSao + (G.hangDoi ? GIA.hangDoi : 0);
  }

  function soGon(x) {
    if (x >= 10000) return (x / 1000).toFixed(0) + "k";
    if (x >= 1000) return (x / 1000).toFixed(1).replace(".", ",") + "k";
    return String(Math.round(x));
  }
  function msGon(x) {
    if (x >= HET_GIO_MS) return "> 3 s";
    return x >= 100 ? Math.round(x) + " ms" : x.toFixed(1).replace(".", ",") + " ms";
  }

  demo({
    id: "kien-truc",
    nhom: "Mạng lưới & phân tán",
    mon: "L39",
    ten: "Mô phỏng kiến trúc — p99 nổ trước khi máy chủ chạm 100%",
    moTa: "Lắp một hệ thống từ cân bằng tải, máy ứng dụng, cache, DB chính, bản sao và hàng đợi " +
          "— kéo thả vào sơ đồ — rồi cho lưu lượng <b>đột biến</b>. Mỗi tầng là một hàng đợi " +
          "M/M/c, mỗi giây lấy mẫu 2 500 yêu cầu ra <b>p50 / p99 thật</b>, chỉ ra <b>nút thắt</b>, " +
          "<b>sức chứa an toàn</b> và <b>chi phí theo tháng</b>.",

    dung: function (host) {
      var P = null, chuoi = [], k = 0, nutXoa = [];

      var TS = V.thamSo([
        { ma: "rps", ten: "Lưu lượng nền (yêu cầu/giây)", kieu: "so", min: 100, max: 30000, buoc: 100, gt: 2000 },
        { ma: "hinh", ten: "Tải theo thời gian", kieu: "chon", gt: "dot-bien", muc: [
          { v: "deu", t: "Đều suốt 120 giây" },
          { v: "tang", t: "Tăng dần 0,5× → 2×" },
          { v: "dot-bien", t: "Đột biến giây 40–60" }] },
        { ma: "heSoDot", ten: "Đột biến gấp (lần)", kieu: "so", min: 1.5, max: 6, buoc: 0.5, gt: 3,
          hien: function (g) { return g.hinh === "dot-bien"; } },
        { ma: "doc", ten: "Tỉ lệ yêu cầu ĐỌC (%)", kieu: "so", min: 50, max: 99, buoc: 1, gt: 90 },
        { ma: "app", ten: "Số máy ứng dụng", kieu: "so", min: 1, max: 40, buoc: 1, gt: 4 },
        { ma: "msApp", ten: "Thời gian xử lý ở máy app (ms)", kieu: "so", min: 2, max: 100, buoc: 1, gt: 20 },
        { ma: "cache", ten: "Có cache trước DB", kieu: "bat", gt: false },
        { ma: "trungCache", ten: "Tỉ lệ trúng cache (%)", kieu: "so", min: 0, max: 99, buoc: 1, gt: 85,
          hien: function (g) { return g.cache; } },
        { ma: "banSao", ten: "Bản sao đọc của DB", kieu: "so", min: 0, max: 8, buoc: 1, gt: 0 },
        { ma: "msDb", ten: "Thời gian một truy vấn DB (ms)", kieu: "so", min: 1, max: 50, buoc: 1, gt: 8 },
        { ma: "hangDoi", ten: "Ghi bất đồng bộ qua hàng đợi", kieu: "bat", gt: false },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 7 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Khởi đầu: 4 máy app, chưa cache — đột biến ×3 là sập",
            gt: { rps: 2000, hinh: "dot-bien", heSoDot: 3, doc: 90, app: 4, msApp: 20, cache: false, banSao: 0,
                  msDb: 8, hangDoi: false } },
          { ten: "★ Thêm cache 85% — DB nhẹ hẳn, nút thắt dời sang máy app",
            gt: { rps: 2000, hinh: "dot-bien", heSoDot: 3, doc: 90, app: 4, msApp: 20, cache: true, trungCache: 85,
                  banSao: 0, msDb: 8, hangDoi: false } },
          { ten: "★ Đủ máy cho đỉnh: 10 máy app + cache — qua đột biến êm",
            gt: { rps: 2000, hinh: "dot-bien", heSoDot: 3, doc: 90, app: 10, msApp: 20, cache: true, trungCache: 85,
                  banSao: 0, msDb: 8, hangDoi: false } },
          { ten: "★ Tăng dần: p99 nổ khi tải ~90%, trước lúc chạm 100%",
            gt: { rps: 2400, hinh: "tang", doc: 90, app: 4, msApp: 20, cache: true, trungCache: 85, banSao: 0,
                  msDb: 8, hangDoi: false } },
          { ten: "Ghi nhiều (50%) — bản sao chỉ chia tải ĐỌC, DB chính vẫn nóng",
            gt: { rps: 7000, hinh: "deu", doc: 50, app: 12, msApp: 20, cache: true, trungCache: 85, banSao: 4,
                  msDb: 8, hangDoi: false } },
          { ten: "Hàng đợi ghi: người dùng thấy nhanh, nhưng tồn đọng tăng mãi",
            gt: { rps: 9000, hinh: "deu", doc: 50, app: 14, msApp: 20, cache: true, trungCache: 85, banSao: 4,
                  msDb: 8, hangDoi: true } }
        ]
      });
      var G = TS.gt;

      var cv = V.veBangCo({ rong: 960, tiLe: 0.72, veLai: function () { if (P) P.veLai(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ---------- khay thành phần: kéo vào sơ đồ, hoặc bấm ---------- */
      var THANH_PHAN = [
        { ma: "app", ten: "🖥 Máy ứng dụng" }, { ma: "cache", ten: "⚡ Cache" },
        { ma: "banSao", ten: "📚 Bản sao DB" }, { ma: "hangDoi", ten: "📬 Hàng đợi ghi" }];
      function them(ma) {
        if (ma === "app") TS.dat("app", Math.min(40, Math.round(G.app) + 1));
        else if (ma === "cache") TS.dat("cache", true);
        else if (ma === "banSao") TS.dat("banSao", Math.min(8, Math.round(G.banSao) + 1));
        else if (ma === "hangDoi") TS.dat("hangDoi", true);
      }
      function bot(ma) {
        if (ma === "app") TS.dat("app", Math.max(1, Math.round(G.app) - 1));
        else if (ma === "cache") TS.dat("cache", false);
        else if (ma === "banSao") TS.dat("banSao", Math.max(0, Math.round(G.banSao) - 1));
        else if (ma === "hangDoi") TS.dat("hangDoi", false);
      }
      var khay = V.el("div", { class: "kt-khay", style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px" },
        [V.el("span", { text: "Kéo vào sơ đồ (hoặc bấm):", style: "font-size:12.5px;color:var(--tx3)" })].concat(
          THANH_PHAN.map(function (t) {
            return V.el("button", {
              type: "button", draggable: "true", "data-them": t.ma, text: "+ " + t.ten,
              style: "padding:5px 10px;border-radius:999px;border:1px dashed var(--acbd);background:var(--acbg);" +
                     "color:var(--ac2);font-size:12.5px;cursor:grab",
              onclick: function () { them(t.ma); },
              ondragstart: function (e) { if (e.dataTransfer) e.dataTransfer.setData("text/plain", t.ma); }
            });
          })));
      cv.addEventListener("dragover", function (e) { e.preventDefault(); });
      cv.addEventListener("drop", function (e) {
        e.preventDefault();
        var ma = e.dataTransfer && e.dataTransfer.getData("text/plain");
        if (ma) them(ma);
      });
      cv.addEventListener("mousedown", function (e) {
        var r = cv.getBoundingClientRect();
        var x = (e.clientX - r.left) * cv.W / r.width, y = (e.clientY - r.top) * cv.H / r.height;
        for (var i = 0; i < nutXoa.length; i++) {
          var n = nutXoa[i];
          if (Math.abs(x - n.x) <= 10 && Math.abs(y - n.y) <= 10) { bot(n.ma); return; }
        }
      });

      /* ---------- mô phỏng ---------- */
      function apDung() {
        if (!cv.W) return;
        var u = V.rng(Math.round(G.hat) || 1), tonDong = 0;
        chuoi = [];
        for (var t = 0; t < GIAY; t++) {
          var lam = taiLuc(t, G), T = moHinh(lam, G), xs = new Float64Array(MAU), het = 0;
          for (var i = 0; i < MAU; i++) {
            var v = mauYeuCau(T, G, u);
            if (!(v < HET_GIO_MS)) { v = HET_GIO_MS; het++; }
            xs[i] = v;
          }
          xs.sort();
          if (T.hangDoi && T.chinh.qua) tonDong += -T.chinh.du;       /* du < 0: thiếu sức ghi mỗi giây */
          else if (T.hangDoi) tonDong = Math.max(0, tonDong - T.chinh.du);
          chuoi.push({ t: t, lam: lam, T: T, p50: xs[Math.floor(MAU * 0.5)], p99: xs[Math.floor(MAU * 0.99)],
                       het: het / MAU, tonDong: tonDong });
        }
        ghiChu.innerHTML = "";
        [[V.mau("ok"), "khối: tải < 60%"], [V.mau("ba"), "60–85%"], [V.mau("loi"), "≥ 85% / quá tải"],
         [V.mau("ac"), "p50 · tải máy app"], [V.mau("loi"), "p99"], [V.mau("ba"), "tải DB chính"],
         [V.mau("ok"), "tải bản sao"], [V.mau("tx3"), "tải cache"]].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [V.el("i", { class: "o-mau", style: "background:" + x[0] }), x[1]]));
        });
        ghiChu.appendChild(V.el("span", { text: "· bấm “−” trên một khối để bỏ thành phần đó" }));
        P.datToiDa(GIAY);
        P.datLai();
        P.veLai();
      }

      function mauTai(rho) { return rho < 0.6 ? V.mau("ok") : rho < 0.85 ? V.mau("ba") : V.mau("loi"); }

      function khoi(x, y, w, h, tieuDe, t, ma) {
        var mau = mauTai(t ? t.rho : 0);
        g.save();
        g.fillStyle = V.mau("surf2");
        g.strokeStyle = mau;
        g.lineWidth = t && t.rho >= 0.85 ? 2.4 : 1.4;
        g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 9); g.fill(); g.stroke();
        if (t) {                                     /* vạch tải ở đáy khối */
          g.fillStyle = mau; g.globalAlpha = 0.85;
          g.fillRect(x - w / 2 + 6, y + h / 2 - 7, Math.min(1, t.rho) * (w - 12), 3);
          g.globalAlpha = 1;
        }
        g.fillStyle = V.mau("tx"); g.font = "600 12px system-ui,sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(tieuDe, x, y - (t ? 8 : 0));
        if (t) {
          g.font = "11px ui-monospace,monospace";
          g.fillStyle = t.qua ? V.mau("loi") : V.mau("tx2");
          g.fillText(t.qua ? "QUÁ TẢI " + Math.round(t.rho * 100) + "%" : "tải " + Math.round(t.rho * 100) + "%", x, y + 8);
        }
        if (ma) {                                    /* nút "−" bỏ thành phần */
          var bx = x + w / 2 - 2, by = y - h / 2 + 2;
          g.fillStyle = V.mau("surf"); g.strokeStyle = V.mau("bd");
          g.beginPath(); g.arc(bx, by, 8, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = V.mau("tx2"); g.font = "700 12px system-ui,sans-serif"; g.fillText("−", bx, by + 0.5);
          nutXoa.push({ x: bx, y: by, ma: ma });
        }
        g.restore();
      }

      /* Một luồng yêu cầu: gấp khúc qua các điểm, dày theo lưu lượng; nhãn ở giữa đoạn dài
         nhất, trên đường (hoặc dưới — để hai luồng song song không đè nhãn nhau). */
      function canh(diem, lam, chu, o) {
        if (lam <= 0) return;
        o = o || {};
        g.save();
        g.strokeStyle = V.mau("tx3");
        g.lineWidth = Math.max(1, Math.min(7, Math.log(1 + lam) / Math.LN10 * 1.6));
        if (o.net) g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(diem[0][0], diem[0][1]);
        var dai = -1, mx = 0, my = 0;
        for (var i = 1; i < diem.length; i++) {
          g.lineTo(diem[i][0], diem[i][1]);
          var d = Math.hypot(diem[i][0] - diem[i - 1][0], diem[i][1] - diem[i - 1][1]);
          if (d > dai) { dai = d; mx = (diem[i][0] + diem[i - 1][0]) / 2; my = (diem[i][1] + diem[i - 1][1]) / 2; }
        }
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = V.mau("tx2"); g.font = "10.5px ui-monospace,monospace";
        g.textAlign = "center"; g.textBaseline = o.duoi ? "top" : "bottom";
        g.fillText((chu ? chu + " " : "") + soGon(lam) + "/s", mx, my + (o.duoi ? 6 : -5));
        g.restore();
      }

      function veSoDo(c) {
        var T = c.T, W = cv.W, Hd = cv.H * 0.5, giua = Hd * 0.52;
        nutXoa = [];
        var xU = W * 0.06, xL = W * 0.2, xA = W * 0.38, xC = W * 0.58, xD = W * 0.78, xR = W * 0.93;
        var bw = Math.min(118, W * 0.12), bh = 46;
        var yC = giua - Hd * 0.26, yQ = giua + Hd * 0.26;
        var R = Math.round(G.banSao);
        var docDb = c.lam * G.doc / 100 * (T.cache ? 1 - G.trungCache / 100 : 1);
        var ghi = c.lam * (1 - G.doc / 100);

        var nhanDoc = T.cache ? "trượt cache" : "đọc", lan = giua - Math.max(34, Hd * 0.13);
        canh([[xU + 26, giua], [xL - bw / 2, giua]], c.lam);
        canh([[xL + bw / 2, giua], [xA - bw / 2, giua]], c.lam);
        if (T.cache) canh([[xA + bw / 2, giua - 14], [xC - bw / 2, yC]], c.lam * G.doc / 100, "đọc");
        /* đọc xuống bản sao: đi làn trên, vòng qua khối DB chính chứ không cắt ngang nó */
        if (R) canh([[xA + bw / 2, giua - 6], [xA + bw / 2 + 24, lan], [xR - 52, lan], [xR - 34, giua - 6]], docDb, nhanDoc);
        else canh([[xA + bw / 2, giua - 6], [xD - bw / 2, giua - 6]], docDb, nhanDoc);
        if (T.hangDoi) {
          canh([[xA + bw / 2, giua + 14], [xC - bw / 2, yQ]], ghi, "ghi", { duoi: true });
          canh([[xC + bw / 2, yQ], [xD - bw / 2, giua + 12]], ghi, "", { net: true, duoi: true });
        } else {
          canh([[xA + bw / 2, giua + 10], [xD - bw / 2, giua + 10]], ghi, "ghi", { duoi: true });
        }

        g.save();
        g.fillStyle = V.mau("tx2"); g.font = "24px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("👥", xU, giua - 6);
        g.font = "11px system-ui,sans-serif"; g.fillText("người dùng", xU, giua + 18);
        g.restore();
        khoi(xL, giua, bw, bh, "Cân bằng tải", T.lb);
        khoi(xA, giua, bw, bh + 18, Math.round(G.app) + " máy app", T.app, "app");
        if (T.cache) khoi(xC, yC, bw, bh, "Cache", T.cache, "cache");
        if (T.hangDoi) khoi(xC, yQ, bw, bh, "Hàng đợi ghi", T.hangDoi, "hangDoi");
        khoi(xD, giua, bw, bh + 6, "DB chính", T.chinh);
        for (var i = 0; i < R; i++) {
          var yy = giua + (i - (R - 1) / 2) * Math.min(42, (Hd - 20) / R);
          khoi(xR, yy, 68, Math.min(36, (Hd - 24) / R - 4), "bản sao", T.banSao, i === R - 1 ? "banSao" : null);
        }
        var nt = nutThat(T);
        g.save();
        g.font = "600 12.5px system-ui,sans-serif"; g.textAlign = "left"; g.textBaseline = "top";
        g.fillStyle = nt.rho >= 0.85 ? V.mau("loi") : V.mau("tx2");
        g.fillText("Giây " + c.t + " · " + soGon(c.lam) + " yêu cầu/giây · nút thắt: " + nt.ten + " (" +
                   Math.round(nt.rho * 100) + "%)", 10, 8);
        g.restore();
      }

      function veBieuDo(n) {
        var tren = cv.H * 0.53;
        var B1 = V.bieuDo(cv, {
          le: { t: tren + 22, r: cv.W / 2 + 14, b: 34, l: 58 },
          x: { min: 0, max: GIAY - 1, nhan: "giây", vach: 6, dinhDang: function (x) { return String(Math.round(x)); } },
          y: { min: 1, max: HET_GIO_MS, log: true, nhan: "độ trễ (ms, thang log)",
               dinhDang: function (x) {          /* 10^log10(3000) không ra số tròn: làm tròn trước khi in */
                 return x >= 1000 ? (x / 1000).toFixed(1).replace(/\.0$/, "").replace(".", ",") + " s" :
                   x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace(".", ",");
               } },
          luoi: 4
        });
        var B2 = V.bieuDo(cv, {
          le: { t: tren + 22, r: 16, b: 34, l: cv.W / 2 + 52 },
          x: { min: 0, max: GIAY - 1, nhan: "giây", vach: 6, dinhDang: function (x) { return String(Math.round(x)); } },
          y: { min: 0, max: 150, nhan: "tải từng tầng (%)", dinhDang: function (x) { return Math.round(x) + "%"; } },
          luoi: 3
        });
        B1.truc(); B2.truc();
        var da = chuoi.slice(0, n);
        B1.duong(da.map(function (c) { return [c.t, Math.max(1, c.p50)]; }), V.mau("ac"), 2);
        B1.duong(da.map(function (c) { return [c.t, Math.max(1, c.p99)]; }), V.mau("loi"), 2);
        g.save();
        g.strokeStyle = V.mau("tx3"); g.setLineDash([4, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(B2.px(0), B2.py(100)); g.lineTo(B2.px(GIAY - 1), B2.py(100)); g.stroke();
        g.restore();
        [["app", V.mau("ac")], ["chinh", V.mau("ba")], ["banSao", V.mau("ok")], ["cache", V.mau("tx3")]].forEach(function (x) {
          if (!da.length || !da[0].T[x[0]]) return;
          B2.duong(da.map(function (c) { return [c.t, Math.min(150, c.T[x[0]].rho * 100)]; }), x[1], 1.8);
        });
        g.save();
        g.font = "600 11.5px system-ui,sans-serif"; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = V.mau("tx2");
        g.fillText("Độ trễ p50 / p99 theo thời gian", B1.x0(), tren + 4);
        g.fillText("Tải từng tầng (đường đứt: 100%)", B2.x0(), tren + 4);
        g.restore();
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf"); g.fillRect(0, 0, cv.W, cv.H);
        if (!chuoi.length) return;
        var n = Math.max(1, k), c = chuoi[n - 1];
        veSoDo(c);
        veBieuDo(n);

        var sc = sucChua(G), dinh = chuoi.reduce(function (m, x) { return Math.max(m, x.lam); }, 0);
        var tb = chuoi.reduce(function (s, x) { return s + x.lam; }, 0) / chuoi.length;
        var canApp = Math.ceil(dinh / (AN_TOAN * LUONG_APP * 1000 / G.msApp));
        var h = G.cache ? G.trungCache / 100 : 0, muDb = KET_NOI_DB * 1000 / G.msDb;
        var canBanSao = Math.ceil(dinh * G.doc / 100 * (1 - h) / (AN_TOAN * muDb));
        var ghiDinh = dinh * (1 - G.doc / 100);
        var phi = chiPhi(G);
        var T = c.T, bang = {
          "Thời điểm": "giây " + c.t + " / " + GIAY,
          "Lưu lượng lúc này": soGon(c.lam) + " yêu cầu/giây",
          "Độ trễ p50 · p99": msGon(c.p50) + " · " + msGon(c.p99),
          "Quá hạn 3 giây": (c.het * 100).toFixed(1) + "%",
          "Nút thắt": nutThat(T).ten + " — tải " + Math.round(nutThat(T).rho * 100) + "%",
          "Tải: app · DB chính": Math.round(T.app.rho * 100) + "% · " + Math.round(T.chinh.rho * 100) + "%" +
            (T.banSao ? " · bản sao " + Math.round(T.banSao.rho * 100) + "%" : "") +
            (T.cache ? " · cache " + Math.round(T.cache.rho * 100) + "%" : "")
        };
        if (T.hangDoi) bang["Tồn đọng hàng đợi ghi"] = Math.round(c.tonDong).toLocaleString("vi") + " yêu cầu" +
          (T.chinh.qua ? " — tăng " + soGon(-T.chinh.du) + "/giây" : "");
        bang["Sức chứa an toàn (tải ≤ 80%)"] = soGon(sc.lam) + "/giây — giới hạn bởi " + sc.ten;
        bang["Để chịu đỉnh " + soGon(dinh) + "/giây"] = "≥ " + canApp + " máy app" +
          (canBanSao > 0 ? ", ≥ " + canBanSao + " bản sao đọc" : "") +
          (ghiDinh > AN_TOAN * muDb ? " — và GHI vượt sức một DB chính: cần phân mảnh (sharding)" : "");
        bang["Chi phí ước tính"] = "$" + phi.toLocaleString("vi") + "/tháng · $" +
          (phi / (tb * 2.592e6 / 1e6)).toFixed(3).replace(".", ",") + " mỗi triệu yêu cầu";
        S.dat(bang);
      }

      P = V.phat({
        ten: "kien-truc",
        bang: cv,
        tocDo: 12,
        buoc: function (i) { k = i + 1; return k < GIAY; },
        datLai: function () { k = 0; },
        ve: ve,
        nhan: function () {
          var c = chuoi[Math.max(0, k - 1)];
          return c ? "giây " + c.t + " · p99 " + msGon(c.p99) : "chưa chạy";
        }
      });

      var r = V.khung(host, {
        ten: "kien-truc",
        bang: cv,
        ve: [khay, cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Mỗi tầng là một hàng đợi.</b> Máy app có " + LUONG_APP + " luồng, mỗi yêu cầu chiếm một luồng " +
          "trong ~<i>thời gian xử lý</i>; DB có " + KET_NOI_DB + " kết nối. Đó là mô hình <b>M/M/c</b>: yêu cầu " +
          "đến ngẫu nhiên, c người phục vụ song song. Tải <code>ρ = λ / (c·μ)</code> là phần thời gian các " +
          "người phục vụ bận." +
          "<ul>" +
          "<li><b>Độ trễ không tăng đều theo tải.</b> Thời gian CHỜ tỉ lệ với <code>1/(1−ρ)</code>: ở 50% gần như " +
          "không chờ, ở 80% đã đáng kể, ở 95% thì <b>p99 nổ</b> — dù máy chưa hề “100% CPU”. Preset " +
          "<i>Tăng dần</i> cho thấy đúng điều đó.</li>" +
          "<li><b>p99 chứ không phải trung bình:</b> mỗi giây lab lấy mẫu 2 500 yêu cầu đi qua đúng đường của " +
          "chúng — đọc trúng cache dừng ở cache, trượt thì xuống DB; ghi đi thẳng DB chính hoặc vào hàng đợi " +
          "— và xếp hạng thời gian. Người dùng chậm nhất là người bỏ đi trước.</li>" +
          "<li><b>Nút thắt dời chỗ.</b> Thêm cache thì DB nhẹ, nút thắt nhảy sang máy app. Thêm bản sao chỉ " +
          "chia tải <i>đọc</i>: ghi vẫn dồn vào một DB chính — preset <i>Ghi nhiều</i>.</li>" +
          "<li><b>Hàng đợi không tạo ra sức ghi.</b> Người dùng thấy nhanh (chỉ chờ ghi vào hàng đợi), nhưng " +
          "nếu DB chính ghi không kịp thì <b>tồn đọng tăng mãi</b> — dữ liệu trễ dần, không ai thấy cho tới khi " +
          "hàng đợi đầy.</li>" +
          "<li><b>Sức chứa an toàn</b> tính ở tải 80%: phần còn lại là chỗ cho đột biến và cho p99. "  +
          "<b>Chi phí</b> theo giá tham khảo (máy app $" + GIA.app + ", DB $" + GIA.db + ", bản sao $" +
          GIA.banSao + ", cache $" + GIA.cache + " mỗi tháng).</li>" +
          "</ul>" +
          "Giả định của mô hình: thời gian phục vụ phân phối mũ, các tầng độc lập, mạng 0,4 ms mỗi chặng, " +
          "quá 3 giây là hết hạn. Hệ thống thật có thêm GC, khoá, kết nối lạnh… nên p99 thật thường <b>tệ hơn</b> " +
          "— mô hình là cận dưới tốt để lập kế hoạch, không phải lời hứa."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
