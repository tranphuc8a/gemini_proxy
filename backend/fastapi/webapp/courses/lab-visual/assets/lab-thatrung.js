/* =====================================================================
   lab-thatrung.js — Hai qua trung, mot toa nha 100 tang.

   Tim tang cao nhat ma tha trung xuong VAN KHONG VO. Trung vo thi mat
   luon. Hoi: so lan tha it nhat de CHAC CHAN tim ra, du xui the nao.

   Gan nhu ai cung doan can(100) = 10: chia 10 tang mot, roi do dan.
   Dap so dung la 14. Va buoc dau tien khong phai tang 10 ma la tang 14,
   roi tang 27, roi 39 — buoc NGAN DAN, sao cho tong cong luon la 14.

   Lab tinh so lan tha toi uu bang quy hoach dong that, roi doi chieu voi
   hai cong thuc da biet — nen cac con so o day kiem duoc, khong phai tin.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var VOCUNG = 1e9;

  /** D[k][m] = so lan tha it nhat de thu hep m DAP AN kha di xuong con 1,
      voi k qua trung. m = so tang + 1, vi dap an co the la "khong tang
      nao an toan". */
  function bangDP(nMax, kMax) {
    var D = [], k, m, a;
    for (k = 0; k <= kMax; k++) {
      var h = new Int32Array(nMax + 2);
      for (m = 0; m <= nMax + 1; m++) h[m] = VOCUNG;
      h[0] = 0; h[1] = 0;
      D.push(h);
    }
    for (k = 1; k <= kMax; k++) {
      for (m = 2; m <= nMax + 1; m++) {
        var tot = VOCUNG;
        for (a = 1; a < m; a++) {
          /* Tha o ranh gioi chia m dap an thanh a (neu VO) va m-a (neu khong vo). */
          var v = 1 + Math.max(D[k - 1][a], D[k][m - a]);
          if (v < tot) tot = v;
        }
        D[k][m] = tot;
      }
    }
    return D;
  }

  /** Vi tri tha toi uu: tra ve a = so dap an ve phia "vo". */
  function nuocToiUu(D, k, m) {
    if (m <= 1 || k <= 0) return 0;
    var tot = VOCUNG, chon = 1;
    for (var a = 1; a < m; a++) {
      var v = 1 + Math.max(D[k - 1][a], D[k][m - a]);
      if (v < tot) { tot = v; chon = a; }
    }
    return chon;
  }

  function toHop(n, r) {
    if (r < 0 || r > n) return 0;
    var v = 1;
    for (var i = 0; i < r; i++) v = v * (n - i) / (i + 1);
    return Math.round(v);
  }
  /** So tang toi da phu duoc voi k trung va d lan tha = tong C(d,i). */
  function phuDuoc(k, d) {
    var s = 0;
    for (var i = 1; i <= k; i++) s += toHop(d, i);
    return s;
  }

  demo({
    id: "tha-trung",
    nhom: "Câu đố quyết định",
    mon: "L30",
    ten: "Thả trứng — vì sao đáp số là 14 chứ không phải 10",
    moTa: "Hai quả trứng, toà nhà 100 tầng. Trực giác nói chia 10 tầng một vì " +
          "√100 = 10. <b>Đáp số đúng là 14</b> — và bước đầu tiên là tầng 14, rồi " +
          "tầng 27, rồi 39: bước <b>ngắn dần</b>, sao cho tổng luôn bằng 14.",

    dung: function (host) {
      var P = null, C = null, B = null, CT = null;
      var D = null, toiThieu = 0, canDuoi = 0, baoHoa = 0;
      var loiChoi = "";
      var chuoiToiUu = [];              /* cac tang tha theo chien luoc toi uu */

      var TS = V.thamSo([
        { ma: "soTang", ten: "Số tầng", kieu: "so", min: 2, max: 400, buoc: 1, gt: 100 },
        { ma: "soTrung", ten: "Số quả trứng", kieu: "so", min: 1, max: 10, buoc: 1, gt: 2,
          moTa: "Trứng vỡ là mất luôn. Hết trứng mà chưa biết đáp án thì <b>thua</b>." },
        { ma: "veCay", ten: "Vẽ cây quyết định", kieu: "bat", gt: true,
          moTa: "Tắt đi để khung vẽ dành hết cho toà nhà — với nhiều tầng thì cây " +
                "quá rậm, nhìn không ra gì." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ 100 tầng, 2 trứng", gt: { soTang: 100, soTrung: 2 } },
          { ten: "1 trứng — không còn cách nào khác", gt: { soTang: 100, soTrung: 1 } },
          { ten: "★ 5 trứng — chạm cận nhị phân", gt: { soTang: 100, soTrung: 5 } },
          { ten: "10 trứng — thêm trứng vô ích", gt: { soTang: 100, soTrung: 10 } },
          { ten: "200 tầng, 2 trứng", gt: { soTang: 200, soTrung: 2 } },
          { ten: "10 tầng — soi được bằng tay", gt: { soTang: 10, soTrung: 2, veCay: true } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.74, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* Trang thai nguoi choi: khoang dap an con lai [lo, hi] va so trung. */
      function lapChoiThu() {
        CT = V.choiThu({
          batDau: function () {
            return { lo: 0, hi: Math.round(G.soTang), trung: Math.round(G.soTrung) };
          },
          nuocDi: function (t, tang) {
            /* Tha o tang `tang`: phai nam trong (lo, hi]. */
            if (!(tang > t.lo && tang <= t.hi)) return null;
            if (t.trung <= 0) return null;
            var duoi = { lo: t.lo, hi: tang - 1, trung: t.trung - 1 };  /* VO */
            var tren = { lo: tang, hi: t.hi, trung: t.trung };          /* khong vo */
            /* Doi thu ac y: chon nhanh nao con TON NHIEU lan tha nhat. */
            var cD = conLai(duoi), cT = conLai(tren);
            return cD > cT ? duoi : (cT > cD ? tren
                 : ((duoi.hi - duoi.lo) >= (tren.hi - tren.lo) ? duoi : tren));
          },
          xong: function (t) { return t.hi - t.lo <= 0 || t.trung <= 0; },
          toiUu: function () { return toiThieu; }
        });
      }

      function conLai(t) {
        var m = t.hi - t.lo + 1;
        if (m <= 1) return 0;
        if (t.trung <= 0) return VOCUNG;
        return D[Math.min(t.trung, D.length - 1)][Math.min(m, D[0].length - 1)];
      }

      /* ============================================================ */
      function apDung() {
        if (!cv.W) return;
        var n = Math.round(G.soTang), k = Math.round(G.soTrung);
        D = bangDP(n, Math.max(k, 10));
        toiThieu = D[k][n + 1];
        canDuoi = V.canThongTin(n + 1, 2);

        /* Bao hoa: so trung nho nhat ma them nua khong bot duoc lan tha. */
        baoHoa = 1;
        for (var q = 1; q <= 10; q++) {
          if (D[q][n + 1] === D[10][n + 1]) { baoHoa = q; break; }
        }

        /* Chuoi tang tha theo chien luoc toi uu, khi LUON KHONG VO. */
        chuoiToiUu = [];
        var lo = 0, hi = n, tr = k;
        for (var b = 0; b < 40 && hi - lo > 0 && tr > 0; b++) {
          var a = nuocToiUu(D, tr, hi - lo + 1);
          var tang = lo + a;
          chuoiToiUu.push(tang);
          lo = tang;                    /* nhanh "khong vo" */
        }

        loiChoi = "";
        lapChoiThu();

        var chiaY = Math.round(cv.H * (G.veCay ? 0.52 : 0.82));
        /* leTren phai chua CA nhan truc ngang cua bieu do (ve o duoi
           truc, khoang 19 px) LAN dong chu thich cay. Truoc day hai
           dong chu nay de len nhau — ca hai deu ve tren canvas nen
           phep kiem hinh hoc DOM khong bat duoc, chi anh chup moi thay. */
        C = V.cayQuyetDinh(cv, { le: 14, leTren: chiaY + 38, leDuoi: 12 });
        /* Le PHAI phai chua cho toa nha — toa nha bat dau o 52 % be
           ngang. Khong chua thi cot toa nha ve DE LEN bieu do; tang DOM
           gia khong thay duoc vi no khong co hinh hoc. */
        B = V.bieuDo(cv, {
          le: { t: 20, r: Math.round(cv.W * 0.50), b: cv.H - chiaY + 14, l: 66 },
          x: { min: 1, max: 10, nhan: "số quả trứng", vach: 9,
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 0, max: Math.max(4, Math.min(n, D[1][n + 1]) * 1.05),
               nhan: "số lần thả cần thiết",
               dinhDang: function (v) { return String(Math.round(v)); } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + V.mau("ok") }),
          "tầng đã biết là an toàn"
        ]));
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + V.mau("loi") }),
          "tầng đã biết là vỡ"
        ]));
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + V.mau("bd") }),
          "còn chưa biết — bấm vào để thả"
        ]));

        P.datToiDa(Math.max(1, toiThieu));
        P.datLai();
      }

      /* ============================================================
         Ve
         ============================================================ */
      var vungTang = null;              /* [y0, y1] cua tung tang de bat chuot */

      function veToaNha(t) {
        var n = Math.round(G.soTang);
        var chiaY = Math.round(cv.H * (G.veCay ? 0.52 : 0.82));
        var x0 = Math.round(cv.W * 0.52) + 20;
        var rong = cv.W - x0 - 16;
        var y0 = 16, cao = chiaY - 34;
        /* Nhieu tang thi ve thanh nhieu cot. */
        var cot = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(cao / 7))));
        var moiCot = Math.ceil(n / cot);
        var rongCot = rong / cot;
        var caoTang = cao / moiCot;
        vungTang = [];

        g.save();
        for (var i = 1; i <= n; i++) {
          var c = Math.floor((i - 1) / moiCot);
          var j = (i - 1) % moiCot;
          var x = x0 + c * rongCot;
          /* Tang 1 o duoi cung. */
          var y = y0 + cao - (j + 1) * caoTang;
          g.fillStyle = i <= t.lo ? V.mau("ok") : (i > t.hi ? V.mau("loi") : V.mau("bd"));
          g.fillRect(x + 1, y + 0.5, rongCot - 6, Math.max(1, caoTang - 1.5));
          vungTang.push({ t: i, x: x, y: y, w: rongCot - 6, h: caoTang });
        }
        /* Danh dau cac tang trong chuoi toi uu. */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2;
        for (var q = 0; q < chuoiToiUu.length; q++) {
          var v = vungTang[chuoiToiUu[q] - 1];
          if (v) g.strokeRect(v.x + 1, v.y + 0.5, v.w, Math.max(1, v.h - 1.5));
        }
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "top";
        /* KHONG goi mau bang ten: `V.mau("ac")` la luc lam o giao dien
           toi va xanh duong o giao dien sang — khong phai cam. Anh chup
           bat duoc chu "vien cam" trong khi vien that la luc lam. */
        g.fillText("Toà nhà — ô có viền là tầng chiến lược tối ưu sẽ thả",
                   x0, y0 + cao + 6);
        g.restore();
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var t = CT.tt();
        var n = Math.round(G.soTang);

        /* --- bieu do: so lan tha theo so trung --- */
        B.truc();
        var d1 = [], d2 = [];
        for (var k = 1; k <= 10; k++) {
          d1.push([k, Math.min(D[k][n + 1], D[1][n + 1])]);
          d2.push([k, canDuoi]);
        }
        B.duong(d2, V.mau("tx3"), 1.2);
        B.duong(d1, V.mau("ac"), 2.2);
        for (k = 1; k <= 10; k++) {
          B.diem(k, Math.min(D[k][n + 1], D[1][n + 1]),
                 k === Math.round(G.soTrung) ? V.mau("loi") : V.mau("ac"),
                 k === Math.round(G.soTrung) ? 5.5 : 3);
        }
        B.chu(10, canDuoi, "cận nhị phân ⌈log₂ " + (n + 1) + "⌉ = " + canDuoi,
              V.mau("tx3"), "right");

        veToaNha(t);

        /* --- cay quyet dinh --- */
        /* Khung qua hep thi bo cay di. O 420 px, bieu do + toa nha + cay
           chong len nhau den muc khong doc noi — anh chup che do hep bat
           duoc. Tha bo mot phan con hon hien ca ba thu ma khong nhin ra. */
        if (G.veCay && cv.W >= 620) {
          C.goc({ nhan: String(t.hi - t.lo + 1) });
          mocCay(C.nuts[0], t, 3);
          C.boCuc();
          C.ve({ banKinh: 12 });
          g.save();
          g.font = "11px system-ui,sans-serif";
          g.fillStyle = V.mau("tx3");
          g.textAlign = "left"; g.textBaseline = "bottom";
          g.fillText("Cây quyết định tối ưu — số trong nút là số đáp án còn lại",
                     14, Math.round(cv.H * 0.52) + 34);
          g.restore();
        }

        /* --- bang so lieu --- */
        var bang = {
          "Toà nhà": n + " tầng",
          "Số trứng": Math.round(G.soTrung),
          "Số đáp án có thể": (n + 1) + "  (kể cả “không tầng nào an toàn”)",
          "Cận dưới nhị phân": canDuoi + " lần thả  (mỗi lần thả cho 2 kết cục)",
          "Tối ưu THỰC TẾ": toiThieu >= VOCUNG ? "không thể" : toiThieu + " lần thả"
        };
        if (Math.round(G.soTrung) === 2) {
          bang["Kiểm bằng công thức"] = "d(d+1)/2 = " + (toiThieu * (toiThieu + 1) / 2) +
            " ≥ " + n + " ✔   (d−1 thì chỉ được " + ((toiThieu - 1) * toiThieu / 2) + ")";
        } else {
          bang["Kiểm bằng công thức"] = "ΣC(" + toiThieu + ",i) = " +
            phuDuoc(Math.round(G.soTrung), toiThieu) + " ≥ " + n + " ✔";
        }
        bang["Cận có đạt được không"] = toiThieu === canDuoi
          ? "✔ ĐẠT — đủ trứng để nhị phân"
          : "✘ KHÔNG — thiếu " + (toiThieu - canDuoi) + " lần vì trứng hạn chế";
        bang["Từ bao nhiêu trứng thì bão hoà"] = baoHoa +
          " — thêm nữa không bớt được lần thả nào";
        if (chuoiToiUu.length) {
          bang["Thả lần lượt ở tầng"] = chuoiToiUu.slice(0, 10).join(" → ") +
            (chuoiToiUu.length > 10 ? " → …" : "");
        }
        var tb = CT.bang();
        Object.keys(tb).forEach(function (k2) { bang[k2] = tb[k2]; });
        bang["Còn lại"] = (t.hi - t.lo + 1) + " đáp án · " + t.trung + " trứng";
        if (loiChoi) bang["⚑"] = loiChoi;
        if (t.trung <= 0 && t.hi - t.lo > 0) bang["✘"] = "hết trứng mà chưa biết — thua";
        else if (CT.xong()) bang["✔"] = "xong — tầng an toàn cao nhất là " + t.lo;
        S.dat(bang);
      }

      function mocCay(nut, t, sau) {
        if (sau <= 0 || t.hi - t.lo <= 0 || t.trung <= 0) return;
        var a = nuocToiUu(D, t.trung, t.hi - t.lo + 1);
        var tang = t.lo + a;
        nut.nhan = String(t.hi - t.lo + 1);
        var duoi = { lo: t.lo, hi: tang - 1, trung: t.trung - 1 };
        var tren = { lo: tang, hi: t.hi, trung: t.trung };
        var nVo = C.them(nut, {
          nhan: String(Math.max(1, duoi.hi - duoi.lo + 1)),
          canh: "vỡ ở " + tang,
          mau: duoi.hi - duoi.lo <= 0 ? V.mau("ok") : null
        });
        var nKhong = C.them(nut, {
          nhan: String(Math.max(1, tren.hi - tren.lo + 1)),
          canh: "không vỡ",
          mau: tren.hi - tren.lo <= 0 ? V.mau("ok") : null
        });
        mocCay(nVo, duoi, sau - 1);
        mocCay(nKhong, tren, sau - 1);
      }

      /* ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        if (!vungTang || CT.xong()) return;
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        for (var i = 0; i < vungTang.length; i++) {
          var v = vungTang[i];
          if (mx >= v.x && mx <= v.x + v.w && my >= v.y && my <= v.y + v.h) {
            if (!CT.di(v.t)) {
              loiChoi = "chỉ thả được ở tầng còn chưa biết (vùng xám)";
            } else loiChoi = "";
            P.veLai();
            return;
          }
        }
      });

      var nutLui = V.el("button", {
        class: "nut phu", text: "↶ Hoàn tác",
        onclick: function () { CT.hoanTac(); loiChoi = ""; P.veLai(); }
      });
      var nutMoi = V.el("button", {
        class: "nut phu", text: "⟲ Chơi lại",
        onclick: function () { CT.batDauLai(); loiChoi = ""; P.veLai(); }
      });

      P = V.phat({
        ten: "tha-trung",
        bang: cv,
        tocDo: 1.5,
        tua: false,
        buoc: function () {
          var t = CT.tt();
          if (CT.xong()) return false;
          var a = nuocToiUu(D, t.trung, t.hi - t.lo + 1);
          CT.di(t.lo + a);
          return !CT.xong();
        },
        datLai: function () { CT.batDauLai(); loiChoi = ""; },
        ve: ve,
        nhan: function () {
          var t = CT.tt();
          return CT.xong() ? ("tầng an toàn cao nhất: " + t.lo)
               : ((t.hi - t.lo + 1) + " đáp án · " + t.trung + " trứng");
        }
      });

      var r = V.khung(host, {
        ten: "tha-trung",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [
          V.el("div", { class: "hang-nut" }, [nutLui, nutMoi]),
          P.dk(), TS.dk(), S.el
        ],
        giaiThich:
          "<b>Luật:</b> tìm tầng cao nhất mà thả trứng xuống <i>vẫn không vỡ</i>. Trứng " +
          "vỡ là mất luôn. Hết trứng mà chưa biết đáp án thì thua. Câu hỏi là số lần thả " +
          "ít nhất để <b>chắc chắn</b> tìm ra — dù xui thế nào." +
          "<ul>" +
          "<li><b>Trực giác hầu như ai cũng có:</b> √100 = 10, nên chia 10 tầng một — " +
          "thả ở 10, 20, 30… Quả đầu vỡ ở tầng 40 thì quả thứ hai dò 31→39. Xấu nhất: " +
          "10 lần cho quả đầu + 9 lần cho quả sau = <b>19</b>. Không tệ, nhưng " +
          "<b>không tối ưu</b>.</li>" +
          "<li><b>Đáp số đúng là 14</b>, và bước đầu là tầng <b>14</b>. Rồi 27 " +
          "(+13), rồi 39 (+12), 50, 60, 69… <b>bước ngắn dần đúng một đơn vị.</b> " +
          "Lý do: mỗi lần quả đầu sống sót, bạn đã tiêu mất một lần thả, nên quả " +
          "thứ hai còn ít lượt hơn — khoảng dò phải ngắn lại đúng bằng đó.</li>" +
          "<li>Nên tổng cộng <b>14 + 13 + 12 + … + 1 = 105 ≥ 100</b>. Đó là " +
          "<b>số tam giác</b>: với 2 trứng, d lần thả phủ được <code>d(d+1)/2</code> " +
          "tầng. Bảng số liệu tự kiểm lại đẳng thức đó mỗi lần bạn đổi tham số.</li>" +
          "</ul>" +
          "<b>Cận dưới lại nói dối tiếp.</b> Mỗi lần thả chỉ cho <b>2 kết cục</b> (vỡ / " +
          "không vỡ), nên cần ít nhất ⌈log₂ 101⌉ = <b>7</b> lần. Với 2 trứng bạn cần 14 " +
          "— gấp đôi. Cận đúng nhưng lỏng, và <b>chỗ lỏng chính là số trứng</b>: nhị phân " +
          "đòi bạn nhảy thẳng vào giữa toà nhà, mà nhảy vào giữa thì rủi ro mất trứng quá " +
          "sớm." +
          "<ul>" +
          "<li><b>★ Kéo thanh “số quả trứng”</b> và nhìn đường cam trên biểu đồ: " +
          "1 trứng → 100 lần (không còn cách nào ngoài dò từng tầng), 2 → 14, 3 → 9, " +
          "4 → 8, <b>5 → 7</b>. Tới đây nó <b>chạm đường xám</b> (cận nhị phân) và " +
          "<b>nằm ì ở đó</b>: trứng thứ 6, 7, 8 không giúp thêm được gì.</li>" +
          "<li>Đó là một <b>điểm bão hoà sắc nét</b>: tài nguyên thêm vào có ích, có " +
          "ích, có ích — rồi <i>đột ngột</i> vô ích hoàn toàn. Ô <i>Từ bao nhiêu trứng " +
          "thì bão hoà</i> in ra đúng điểm đó.</li>" +
          "<li><b>Bấm vào một tầng bất kỳ</b> (vùng xám) để thả thử. Máy chọn kết cục " +
          "<b>ác ý</b> — luôn đẩy bạn vào nhánh còn tốn nhiều lần thả hơn — nên bạn " +
          "không ăn may được, và số lần bạn dùng đúng là số lần chiến lược của bạn " +
          "<i>bảo đảm</i>.</li>" +
          "<li><b>Preset “10 tầng”</b> nhỏ đủ để soi cả cây quyết định bằng tay và tự " +
          "kiểm lại từng nhánh.</li>" +
          "</ul>" +
          "<b>Con số ở đây không phải tra công thức.</b> Lab chạy quy hoạch động thật " +
          "trên <code>D[k][m] = 1 + min<sub>a</sub> max(D[k−1][a], D[k][m−a])</code>, " +
          "rồi <i>đối chiếu</i> kết quả với hai công thức đã biết — số tam giác cho " +
          "k = 2, và tổng <code>ΣC(d,i)</code> cho k bất kỳ. Hai đường độc lập, cùng " +
          "một đáp số."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
