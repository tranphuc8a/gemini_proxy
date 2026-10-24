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


  /* ------------------------------------------------- regex an toan (khong thay doi quay lui) */
  /** Kiem mot mau regex NGUOI DUNG go co AN TOAN khong (mot lan quet tuyen tinh, khong regex long regex).
      Tra ve null neu an toan, hoac chuoi ly do (tieng Viet). Chan nhung dang gay quay lui theo cap so:
      - lap (* + {n,}) len mot nhom co lap ben trong ("(a+)+", "(a*)*b"),
      - lap len mot nhom luan phien ma cac nhanh co the trung dau ("(a|aa)*", "(.|a)+"); nhom luan phien chi
        duoc lap neu moi nhanh la chuoi ky tu thuong va ky tu dau doi mot khac nhau ("(foo|bar)+"),
      - tham chieu nguoc (\1, \k<ten>) va nhin truoc / nhin sau ("(?=" "(?!" "(?<=" "(?<!"),
      - so lan lap qua lon ({n} > 1000), mau dai qua 2000 ky tu.
      Dang da thuc (a*a*a*b) KHONG bi chan: no chi cham khi du lieu rat dai — nguoi goi nen cat do dai. */
  function kiemRegexAnToan(mau) {
    mau = String(mau);
    if (mau.length > 2000) return "Mẫu regex dài quá 2000 ký tự";
    var ngan = [], cur = { luong: false, nhanh: [], hienTai: { dau: undefined, thuan: true, dem: 0 } };
    var i = 0, n = mau.length, c, truocLaNhom = null;     /* truocLaNhom: nhom vua dong, chua biet co luong theo sau khong */
    function sauNhom() {                                    /* xet luong theo sau mot nhom vua dong */
      return truocLaNhom;
    }
    function ghiKyTu(ch, thuan) {                          /* mot "don vi" moi trong nhanh hien tai */
      var h = cur.hienTai;
      if (h.dem === 0) h.dau = thuan ? String(ch).toLowerCase() : null;
      if (!thuan) h.thuan = false;
      h.dem++;
    }
    while (i < n) {
      c = mau.charAt(i);
      var luongSauNhom = null;
      if (c === "\\") {
        var d = mau.charAt(i + 1);
        if (/[1-9]/.test(d)) return "Mẫu regex dùng tham chiếu ngược (\\" + d + ") — không hỗ trợ";
        if (d === "k") return "Mẫu regex dùng tham chiếu ngược có tên — không hỗ trợ";
        ghiKyTu(d, /[^A-Za-z0-9]/.test(d) && d !== "");
        i += 2;
        truocLaNhom = null;
      } else if (c === "[") {
        i++;
        if (mau.charAt(i) === "^") i++;
        if (mau.charAt(i) === "]") i++;
        while (i < n && mau.charAt(i) !== "]") i += mau.charAt(i) === "\\" ? 2 : 1;
        i++;
        ghiKyTu("[", false);
        truocLaNhom = null;
      } else if (c === "(") {
        var sau = mau.substr(i + 1, 3);
        if (sau.charAt(0) === "?") {
          if (sau.charAt(1) === "=" || sau.charAt(1) === "!" || (sau.charAt(1) === "<" && (sau.charAt(2) === "=" || sau.charAt(2) === "!"))) {
            return "Mẫu regex dùng nhìn trước / nhìn sau — không hỗ trợ";
          }
          if (sau.charAt(1) === ":") i += 3;
          else if (sau.charAt(1) === "<") { var k = mau.indexOf(">", i); if (k < 0) return "Mẫu regex thiếu dấu > của tên nhóm"; i = k + 1; }
          else return "Mẫu regex có dạng nhóm “(?” không hỗ trợ";
        } else i++;
        ngan.push(cur);
        cur = { luong: false, nhanh: [], hienTai: { dau: undefined, thuan: true, dem: 0 } };
        truocLaNhom = null;
      } else if (c === ")") {
        if (!ngan.length) return "Mẫu regex thừa dấu )";
        cur.nhanh.push(cur.hienTai);
        var nhom = cur;
        cur = ngan.pop();
        i++;
        ghiKyTu("(", false);
        cur.luong = cur.luong;
        truocLaNhom = nhom;
      } else if (c === "|") {
        cur.nhanh.push(cur.hienTai);
        cur.hienTai = { dau: undefined, thuan: true, dem: 0 };
        i++;
        truocLaNhom = null;
      } else if (c === "*" || c === "+" || c === "?" || c === "{") {
        var vo = false, toiDa = 1;
        if (c === "{") {
          var m = i + 1, a = "", b = null, coPhay = false;
          while (m < n && mau.charAt(m) >= "0" && mau.charAt(m) <= "9") a += mau.charAt(m++);
          if (mau.charAt(m) === ",") { coPhay = true; m++; b = ""; while (m < n && mau.charAt(m) >= "0" && mau.charAt(m) <= "9") b += mau.charAt(m++); }
          if (mau.charAt(m) !== "}" || a === "") { ghiKyTu("{", true); i++; truocLaNhom = null; continue; }
          toiDa = coPhay ? (b === "" ? Infinity : +b) : +a;
          if ((coPhay ? Math.max(+a, b === "" ? 0 : +b) : +a) > 1000) return "Mẫu regex lặp quá nhiều lần ({" + a + (coPhay ? "," + b : "") + "} > 1000)";
          i = m + 1;
        } else {
          toiDa = c === "?" ? 1 : Infinity;
          i++;
        }
        if (mau.charAt(i) === "?") i++;                    /* lap luoi */
        if (toiDa > 1) {
          if (truocLaNhom) {
            if (truocLaNhom.luong) return "Mẫu regex lặp lồng nhau (kiểu “(a+)+”) có thể treo trình duyệt";
            var nh = truocLaNhom.nhanh;
            if (nh.length > 1) {
              var thay = {}, ok = true;
              for (var q = 0; q < nh.length; q++) {
                if (!nh[q].thuan || nh[q].dau === null || nh[q].dau === undefined || thay[nh[q].dau]) { ok = false; break; }
                thay[nh[q].dau] = 1;
              }
              if (!ok) return "Mẫu regex lặp một nhóm “|” có nhánh trùng đầu (kiểu “(a|aa)*”) có thể treo trình duyệt";
            }
          }
          cur.luong = true;
        }
        if (truocLaNhom && truocLaNhom.luong) cur.luong = true;
        truocLaNhom = null;
      } else {
        ghiKyTu(c, c !== "." && c !== "^" && c !== "$");
        i++;
        truocLaNhom = null;
      }
    }
    if (ngan.length) return "Mẫu regex thiếu dấu )";
    return null;
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
    khoaChuan: khoaChuan,
    kiemRegexAnToan: kiemRegexAnToan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.chung;
});
