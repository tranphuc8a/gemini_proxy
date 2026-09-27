/* =====================================================================
   loi.js — phan LOI cua ung dung chi tieu: khong dung DOM, khong dung
   localStorage. Tat ca deu la ham thuan, nen kiem duoc bang node.

   Tach rieng ra vi day la cho de sai nhat va kho thay nhat: tien bac,
   ngay thang, va cong don. Mot loi lam tron o day khong lam trang do —
   no chi lam con so sai, va nguoi dung tin con so do.
   ===================================================================== */
(function (goc) {
  "use strict";

  var NHOM = [
    { ma: "an-uong",  ten: "Ăn uống",        mau: "#f2777a", bieu: "🍜" },
    { ma: "di-lai",   ten: "Đi lại",          mau: "#f99157", bieu: "🚌" },
    { ma: "nha-o",    ten: "Nhà ở",           mau: "#ffcc66", bieu: "🏠" },
    { ma: "hoa-don",  ten: "Hoá đơn",         mau: "#99cc99", bieu: "🧾" },
    { ma: "suc-khoe", ten: "Sức khoẻ",        mau: "#66cccc", bieu: "💊" },
    { ma: "hoc-hanh", ten: "Học hành",        mau: "#6699cc", bieu: "📚" },
    { ma: "giai-tri", ten: "Giải trí",        mau: "#cc99cc", bieu: "🎬" },
    { ma: "mua-sam",  ten: "Mua sắm",         mau: "#d27b53", bieu: "🛍" },
    { ma: "khac",     ten: "Khác",            mau: "#9aa5b1", bieu: "•" },
    { ma: "luong",    ten: "Lương",           mau: "#4fc08d", bieu: "💰", thu: true },
    { ma: "thu-khac", ten: "Thu nhập khác",   mau: "#3fb950", bieu: "📈", thu: true }
  ];

  var banNhom = {};
  NHOM.forEach(function (n) { banNhom[n.ma] = n; });

  /* ==================================================================
     Tien

     Don vi luu la DONG, va luon la SO NGUYEN. Khong bao gio luu tien
     bang so thuc: 0.1 + 0.2 !== 0.3, va sau vai tram giao dich thi tong
     se lech di vai dong ma khong ai biet tai dau.
     ================================================================== */

  /** Doc mot chuoi nguoi dung go thanh so dong (nguyen).
      Chap nhan: "50000", "50.000", "50,000", "50k", "1tr", "1.5 tr", "2 triệu" */
  function docTien(s) {
    if (typeof s === "number") return Math.round(s);
    s = String(s == null ? "" : s).trim().toLowerCase();
    if (!s) return 0;

    var am = /^-/.test(s);
    s = s.replace(/^[-+]/, "");

    /* Hau to nhan. Phai xet "tr"/"trieu" TRUOC "k", va "m" sau cung. */
    var nhan = 1;
    var hau = [
      [/(tri[eệ]u|tr)\s*$/, 1000000],
      [/(ngh[iì]n|ng[aà]n|k)\s*$/, 1000],
      [/(t[iỉ]|ty|t[yỷ])\s*$/, 1000000000]
    ];
    for (var i = 0; i < hau.length; i++) {
      if (hau[i][0].test(s)) { nhan = hau[i][1]; s = s.replace(hau[i][0], "").trim(); break; }
    }

    /* Con lai la con so, co the co dau phan cach nghin va/hoac thap phan.
       Quy uoc: dau CUOI CUNG neu chi con <= 2 chu so phia sau thi la dau
       thap phan; nguoc lai moi dau deu la phan cach nghin. */
    var so = s.replace(/[^0-9.,]/g, "");
    if (!so) return 0;
    var vt = Math.max(so.lastIndexOf("."), so.lastIndexOf(","));
    var gt;
    if (vt >= 0 && so.length - vt - 1 > 0 && so.length - vt - 1 <= 2 &&
        /[.,]/.test(so.slice(0, vt)) === false && nhan > 1) {
      /* "1.5 tr" — mot dau, <=2 chu so sau, va co hau to nhan: thap phan. */
      gt = parseFloat(so.slice(0, vt) + "." + so.slice(vt + 1));
    } else {
      gt = parseFloat(so.replace(/[.,]/g, ""));
    }
    if (!isFinite(gt)) return 0;
    return Math.round(gt * nhan) * (am ? -1 : 1);
  }

  /** In ra cho nguoi doc: 1234567 -> "1.234.567 ₫" */
  function dinhDangTien(v, keDonVi) {
    var am = v < 0;
    var s = String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (am ? "−" : "") + s + (keDonVi === false ? "" : " ₫");
  }

  /** Rut gon cho bieu do: 1234567 -> "1,2tr" */
  function tienGon(v) {
    var a = Math.abs(v), d = v < 0 ? "−" : "";
    if (a >= 1e9) return d + (a / 1e9).toFixed(1).replace(".", ",") + "tỉ";
    if (a >= 1e6) return d + (a / 1e6).toFixed(1).replace(".", ",") + "tr";
    if (a >= 1e3) return d + Math.round(a / 1e3) + "k";
    return d + String(a);
  }

  /* ==================================================================
     Ngay

     Luu dang "YYYY-MM-DD" — chuoi, khong phai Date. Doi tuong Date keo
     theo mui gio, va mui gio la nguon loi lech mot ngay kinh dien: tao
     Date tu "2026-01-31" roi in ra co the thanh 30/01 o mui gio am.
     ================================================================== */
  function homNay() {
    var d = new Date();
    return d.getFullYear() + "-" + hai(d.getMonth() + 1) + "-" + hai(d.getDate());
  }
  function hai(n) { return (n < 10 ? "0" : "") + n; }

  /** "2026-01-31" -> "2026-01" */
  function thangCua(ngay) { return String(ngay || "").slice(0, 7); }

  /** "2026-01" -> "Tháng 1, 2026" */
  function tenThang(t) {
    var p = String(t || "").split("-");
    if (p.length < 2) return t || "";
    return "Tháng " + parseInt(p[1], 10) + ", " + p[0];
  }

  /** Thang lien truoc — tu tinh, khong qua Date. */
  function thangTruoc(t) {
    var p = String(t).split("-");
    var nam = parseInt(p[0], 10), thang = parseInt(p[1], 10);
    thang--;
    if (thang < 1) { thang = 12; nam--; }
    return nam + "-" + hai(thang);
  }

  function soNgayTrongThang(t) {
    var p = String(t).split("-");
    var nam = parseInt(p[0], 10), thang = parseInt(p[1], 10);
    /* Ngay 0 cua thang sau = ngay cuoi cua thang nay. */
    return new Date(nam, thang, 0).getDate();
  }

  /* ==================================================================
     Gom nhom
     ================================================================== */
  function laThu(gd) {
    var n = banNhom[gd.nhom];
    return !!(n && n.thu);
  }

  /** Tong thu, tong chi va so du cua mot danh sach giao dich. */
  function tongKet(ds) {
    var thu = 0, chi = 0;
    for (var i = 0; i < ds.length; i++) {
      if (laThu(ds[i])) thu += ds[i].tien; else chi += ds[i].tien;
    }
    return { thu: thu, chi: chi, con: thu - chi };
  }

  function locThang(ds, thang) {
    if (!thang) return ds.slice();
    return ds.filter(function (g) { return thangCua(g.ngay) === thang; });
  }

  /** Cong theo nhom, tra ve mang da sap giam dan theo so tien. */
  function theoNhom(ds) {
    var m = {};
    ds.forEach(function (g) { m[g.nhom] = (m[g.nhom] || 0) + g.tien; });
    return Object.keys(m).map(function (k) {
      return { nhom: k, tien: m[k], ten: (banNhom[k] || {}).ten || k,
               mau: (banNhom[k] || {}).mau || "#888" };
    }).sort(function (a, b) { return b.tien - a.tien; });
  }

  /** Cong theo tung ngay trong thang, tra ve mang DAY DU tu ngay 1 den
      ngay cuoi — ke ca ngay khong co giao dich nao (tien = 0). Thieu
      nhung ngay do thi bieu do se ve sai khoang cach. */
  function theoNgay(ds, thang) {
    var n = soNgayTrongThang(thang);
    var m = new Array(n + 1).join("0").split("").map(Number);
    ds.forEach(function (g) {
      if (thangCua(g.ngay) !== thang) return;
      if (laThu(g)) return;
      var ngay = parseInt(String(g.ngay).slice(8, 10), 10);
      if (ngay >= 1 && ngay <= n) m[ngay - 1] += g.tien;
    });
    return m;
  }

  /** Danh sach cac thang CO giao dich, moi nhat truoc. */
  function cacThang(ds) {
    var t = {};
    ds.forEach(function (g) { t[thangCua(g.ngay)] = 1; });
    return Object.keys(t).sort().reverse();
  }

  /* ==================================================================
     Ngan sach
     ================================================================== */
  /** Doi chieu chi tieu thuc te voi han muc dat cho tung nhom. */
  function soNganSach(ds, han) {
    var chi = {};
    ds.forEach(function (g) {
      if (!laThu(g)) chi[g.nhom] = (chi[g.nhom] || 0) + g.tien;
    });
    return Object.keys(han || {}).filter(function (k) { return han[k] > 0; })
      .map(function (k) {
        var daChi = chi[k] || 0;
        return {
          nhom: k, ten: (banNhom[k] || {}).ten || k, mau: (banNhom[k] || {}).mau || "#888",
          han: han[k], daChi: daChi, conLai: han[k] - daChi,
          tiLe: han[k] > 0 ? daChi / han[k] : 0,
          vuot: daChi > han[k]
        };
      }).sort(function (a, b) { return b.tiLe - a.tiLe; });
  }

  /* ==================================================================
     CSV

     Phai chiu duoc dau phay va dau nhay trong ghi chu — do la cho moi
     bo doc CSV viet voi vang deu hong.
     ================================================================== */
  var COT = ["ngay", "nhom", "tien", "ghiChu"];

  function oCSV(s) {
    s = String(s == null ? "" : s);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function sangCSV(ds) {
    var dong = [COT.join(",")];
    ds.forEach(function (g) {
      dong.push(COT.map(function (c) { return oCSV(g[c]); }).join(","));
    });
    return dong.join("\n");
  }

  /** Tach mot dong CSV, ton trong dau nhay kep va "" nhu dau nhay thoat. */
  function tachDong(s) {
    var ra = [], o = "", trongNhay = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (trongNhay) {
        if (c === '"') {
          if (s[i + 1] === '"') { o += '"'; i++; } else trongNhay = false;
        } else o += c;
      } else if (c === '"') trongNhay = true;
      else if (c === ",") { ra.push(o); o = ""; }
      else o += c;
    }
    ra.push(o);
    return ra;
  }

  function tuCSV(chu) {
    var dong = String(chu || "").split(/\r\n|\n|\r/).filter(function (d) { return d.trim(); });
    if (!dong.length) return [];
    var dau = tachDong(dong[0]).map(function (x) { return x.trim(); });
    /* Co dong tieu de hay khong? Neu dong dau khong chua "ngay" thi coi
       nhu khong co, va doc luon tu dong dau. */
    var coTieuDe = dau.indexOf("ngay") >= 0;
    var cot = coTieuDe ? dau : COT;
    var ra = [];
    for (var i = coTieuDe ? 1 : 0; i < dong.length; i++) {
      var o = tachDong(dong[i]);
      var g = {};
      cot.forEach(function (c, k) { g[c] = o[k] === undefined ? "" : o[k]; });
      if (!g.ngay) continue;
      ra.push({
        ngay: String(g.ngay).trim(),
        nhom: banNhom[String(g.nhom).trim()] ? String(g.nhom).trim() : "khac",
        tien: docTien(g.tien),
        ghiChu: String(g.ghiChu || "")
      });
    }
    return ra;
  }

  /* ================================================================== */
  goc.CT = {
    NHOM: NHOM, banNhom: banNhom,
    docTien: docTien, dinhDangTien: dinhDangTien, tienGon: tienGon,
    homNay: homNay, thangCua: thangCua, tenThang: tenThang,
    thangTruoc: thangTruoc, soNgayTrongThang: soNgayTrongThang,
    laThu: laThu, tongKet: tongKet, locThang: locThang,
    theoNhom: theoNhom, theoNgay: theoNgay, cacThang: cacThang,
    soNganSach: soNganSach,
    sangCSV: sangCSV, tuCSV: tuCSV, tachDong: tachDong
  };
})(typeof window !== "undefined" ? window : globalThis);
