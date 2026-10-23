/* =====================================================================
   je-chung.js — khong gian JE va cac tien ich THUAN dung chung cho moi
   module cua JSON Editor. Nap TRUOC moi tep khac (xem index.html).

   Khuon module (moi tep thuan sau nay cung theo dung khuon nay):

     (function (khai) { khai(goc); JE_NGUON.push(khai); })(function (root) { … });

   - `khai(root)` dang ky ham len root.JE. Khong DOM, khong storage, khong
     dong ho — kiem duoc bang node.
   - JE_NGUON giu lai CHINH HAM khai cua tung tep: Worker (chay-nen.js, dot
     sau) ghep "(" + khai + ")(self);" thanh mot Blob ma khong can fetch tep
     — fetch bi chan khi mo trang bang file://.

   Moi ham o day chiu duoc du lieu LONG RAT SAU (JSON.parse doc duoc ca
   20 000 cap, de quy thi tran ngan xep): duyet bang ngan xep tu quan ly.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  var hasOwn = Object.prototype.hasOwnProperty;

  /** Khoa RIENG cua object (khong tinh nguyen mau): `toString`,
      `constructor`… khong phai du lieu JSON. */
  function coRieng(o, k) { return o !== null && o !== undefined && hasOwn.call(o, k); }

  function kieuCua(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  function laNhanh(v) { return v !== null && typeof v === "object"; }

  /** Cat chuoi con toi da `n` ky tu, ket thuc bang "…"; khong cat doi mot
      cap surrogate (emoji). */
  function catNgan(s, n) {
    s = String(s);
    if (s.length <= n) return s;
    var k = n - 1;
    var c = s.charCodeAt(k - 1);
    if (c >= 0xd800 && c <= 0xdbff) k--;
    return s.slice(0, k) + "…";
  }

  /** Duong dan (mang khoa/chi so) -> chuoi doc duoc: $.a[0]["b c"]. */
  function moTaDuong(d) {
    var s = "$";
    for (var i = 0; i < d.length; i++) {
      s += typeof d[i] === "number" ? "[" + d[i] + "]"
         : /^[A-Za-z_$][\w$-]*$/.test(d[i]) ? "." + d[i] : "[" + JSON.stringify(d[i]) + "]";
    }
    return s;
  }

  /* ------------------------------------------------- JSON Pointer (RFC 6901) */
  /** Duong dan -> JSON Pointer: [] -> "", ["a/b", 0] -> "/a~1b/0". */
  function duongSangConTro(d) {
    var s = "";
    for (var i = 0; i < d.length; i++) {
      s += "/" + String(d[i]).replace(/~/g, "~0").replace(/\//g, "~1");
    }
    return s;
  }

  /** JSON Pointer -> duong dan. Nhan ca dang manh URI ("#/a%20b/0").
      Moi doan la CHUOI; neu dua `goc` thi doan nao roi vao mang va la chi
      so hop le se thanh SO (de khop voi duong dan cua cay). Con tro sai
      dang thi nem loi. */
  function conTroSangDuong(conTro, goc) {
    var s = String(conTro);
    if (s.charAt(0) === "#") {
      try { s = decodeURIComponent(s.slice(1)); }
      catch (e) { throw new Error("Con trỏ JSON có mã phần trăm sai: " + catNgan(conTro, 40)); }
    }
    if (s === "") return [];
    if (s.charAt(0) !== "/") throw new Error("Con trỏ JSON phải bắt đầu bằng “/”: " + catNgan(conTro, 40));
    var doan = s.slice(1).split("/"), ra = [], v = goc, coGoc = arguments.length > 1;
    for (var i = 0; i < doan.length; i++) {
      if (/~(?![01])/.test(doan[i])) throw new Error("Con trỏ JSON có “~” không hợp lệ: " + catNgan(conTro, 40));
      var k = doan[i].replace(/~1/g, "/").replace(/~0/g, "~");
      if (coGoc && Array.isArray(v) && /^(0|[1-9]\d*)$/.test(k)) {
        ra.push(+k);
        v = v[+k];
      } else {
        ra.push(k);
        v = coGoc && laNhanh(v) && !Array.isArray(v) && coRieng(v, k) ? v[k] : undefined;
      }
    }
    return ra;
  }

  /* ------------------------------------------------- so sanh / khoa chuan */
  /** Hai gia tri JSON bang nhau SAU: khong ke thu tu khoa object, ke thu tu
      phan tu mang; so so bang === (0 va -0 bang nhau). Lap, khong de quy. */
  function bangNhauSau(a, b) {
    var ngan = [a, b];
    while (ngan.length) {
      var y = ngan.pop(), x = ngan.pop();
      if (x === y) continue;
      var kx = kieuCua(x);
      if (kx !== kieuCua(y)) return false;
      if (kx === "array") {
        if (x.length !== y.length) return false;
        for (var i = 0; i < x.length; i++) ngan.push(x[i], y[i]);
      } else if (kx === "object") {
        var ks = Object.keys(x);
        if (ks.length !== Object.keys(y).length) return false;
        for (var j = 0; j < ks.length; j++) {
          if (!hasOwn.call(y, ks[j])) return false;
          ngan.push(x[ks[j]], y[ks[j]]);
        }
      } else {
        return false;       /* nguyen thuy khac nhau (=== da that bai) */
      }
    }
    return true;
  }

  /* Manh chu cho phat ra nguyen van trong khoaChuan — phan biet voi gia
     tri JSON bang instanceof (JSON.parse khong bao gio tao ra Chu). */
  function Chu(s) { this.s = s; }

  /** Chuoi chuan cua mot gia tri JSON: nhu JSON.stringify nhung khoa object
      SAP theo bang chu cai. Hai gia tri bangNhauSau <=> cung khoaChuan.
      Dung lam khoa Map (uniqueItems, dem trung…). Lap, khong de quy. */
  function khoaChuan(v) {
    var ra = [], ngan = [v];
    while (ngan.length) {
      var x = ngan.pop();
      if (x instanceof Chu) { ra.push(x.s); continue; }
      if (Array.isArray(x)) {
        if (!x.length) { ra.push("[]"); continue; }
        ra.push("[");
        ngan.push(new Chu("]"));
        for (var i = x.length - 1; i >= 0; i--) {
          ngan.push(x[i]);
          if (i) ngan.push(new Chu(","));
        }
      } else if (laNhanh(x)) {
        var ks = Object.keys(x).sort();
        if (!ks.length) { ra.push("{}"); continue; }
        ra.push("{");
        ngan.push(new Chu("}"));
        for (var j = ks.length - 1; j >= 0; j--) {
          ngan.push(x[ks[j]]);
          ngan.push(new Chu((j ? "," : "") + JSON.stringify(ks[j]) + ":"));
        }
      } else {
        var t = JSON.stringify(x);
        ra.push(t === undefined ? "null" : t);
      }
    }
    return ra.join("");
  }

  JE.chung = {
    coRieng: coRieng,
    kieuCua: kieuCua,
    laNhanh: laNhanh,
    catNgan: catNgan,
    moTaDuong: moTaDuong,
    duongSangConTro: duongSangConTro,
    conTroSangDuong: conTroSangDuong,
    bangNhauSau: bangNhauSau,
    khoaChuan: khoaChuan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.chung;
});
