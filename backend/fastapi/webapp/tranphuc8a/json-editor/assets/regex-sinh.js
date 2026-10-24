/* =====================================================================
   regex-sinh.js — SINH chuoi khop mot `pattern` (RegExp cua JavaScript) +
   bo sinh so gia ngau nhien co seed dung chung cho bo sinh du lieu.
   Module thuan, khuon je-chung.js: khong DOM / storage / dong ho; co JE_NGUON
   cho Worker.

   JE.taoRng(seed) -> { soThuc(), soNguyen(a, b) [dong hai dau], chon(ds), tron(ds), xacSuat(p), hat }
        Cung seed (chuoi hoac so) -> cung day so. Khong dung Math.random / Date.

   JE.regexSinh:
     phanTich(nguon)    -> { ast, khongHoTro:[…], neoDau, neoCuoi, soNhom } | nem { thongBao, cot }
     sinhChuoi(ast, rng, { lapToiDa:8, thienLon:false, doDaiToiDa:20000 }) -> { chuoi, khongHoTro:[…] }
     sinhTheoMau(nguon, rng, { doDaiMin, doDaiMax, lapToiDa, thuToiDa:60 }) -> { chuoi, khop, canhBao:[…] }
        khop = chuoi vua sinh khop `new RegExp(nguon, "u")` (khong duoc thi thu khong co "u" nhu schema-kiem) va dung do dai.

   Ho tro: ky tu thuong, thoat \d \w \s \D \W \S \t \n \r \f \v \0 \. \\ \uXXXX \u{…} \xXX \cX, lop [a-z0-9_] / [^…],
   `.`, nhom bat / khong bat / dat ten, `|`, * + ? {n} {n,} {n,m} (ca luoi), neo ^ $, tham chieu nguoc \1 \k<ten>,
   \p{L} \p{N}… xap xi bang tap mau.
   KHONG ho tro (bo qua khi sinh, ghi `khongHoTro`, roi KIEM LAI bang RegExp that — khong khop thi khop:false):
   nhin truoc / nhin sau (?= (?! (?<= (?<!, \b \B (xap xi), co nhung (?i:…).
   Moi vong lap phan tich / sinh deu tuyen tinh theo do dai mau + do dai chuoi sinh (co tran).
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  /* ======================================================= PRNG co seed */
  /** cyrb53 -> hai so 32 bit tu chuoi seed. */
  function bam(chu) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, ch;
    for (i = 0; i < chu.length; i++) {
      ch = chu.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  /** mulberry32 tren trang thai tu bam(seed). */
  function taoRng(seed) {
    var hat = String(seed === undefined || seed === null ? "" : seed), a = bam(hat);
    function soThuc() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function soNguyen(x, y) {
      if (y < x) { var z = x; x = y; y = z; }
      return x + Math.floor(soThuc() * (y - x + 1));
    }
    return {
      hat: hat,
      soThuc: soThuc,
      soNguyen: soNguyen,
      chon: function (ds) { return ds.length ? ds[Math.floor(soThuc() * ds.length)] : undefined; },
      tron: function (ds) {                                     /* Fisher–Yates tren BAN SAO */
        var b = ds.slice(), i, j, t;
        for (i = b.length - 1; i > 0; i--) { j = Math.floor(soThuc() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
        return b;
      },
      xacSuat: function (p) { return soThuc() < p; }
    };
  }
  JE.taoRng = taoRng;

  /* ======================================================= tap ky tu (cac doan [lo, hi]) */
  var TOI_DA = 0x10FFFF;

  function chuanHoa(ds) {
    var a = ds.slice().sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; }), ra = [], i;
    for (i = 0; i < a.length; i++) {
      if (a[i][1] < a[i][0]) continue;
      if (ra.length && a[i][0] <= ra[ra.length - 1][1] + 1) { if (a[i][1] > ra[ra.length - 1][1]) ra[ra.length - 1][1] = a[i][1]; }
      else ra.push([a[i][0], a[i][1]]);
    }
    return ra;
  }
  function phanBu(ds) {                                         /* ds da chuan hoa */
    var ra = [], truoc = 0, i;
    for (i = 0; i < ds.length; i++) {
      if (ds[i][0] > truoc) ra.push([truoc, ds[i][0] - 1]);
      truoc = ds[i][1] + 1;
    }
    if (truoc <= TOI_DA) ra.push([truoc, TOI_DA]);
    return ra;
  }
  function giaoDoan(ds, lo, hi) {
    var ra = [], i;
    for (i = 0; i < ds.length; i++) {
      var a = Math.max(ds[i][0], lo), b = Math.min(ds[i][1], hi);
      if (a <= b) ra.push([a, b]);
    }
    return ra;
  }
  function kichThuoc(ds) { var n = 0, i; for (i = 0; i < ds.length; i++) n += ds[i][1] - ds[i][0] + 1; return n; }
  function layThu(ds, rng) {
    var tong = kichThuoc(ds), k, i;
    if (!tong) return -1;
    k = Math.floor(rng.soThuc() * tong);
    for (i = 0; i < ds.length; i++) {
      var n = ds[i][1] - ds[i][0] + 1;
      if (k < n) return ds[i][0] + k;
      k -= n;
    }
    return ds[ds.length - 1][1];
  }
  var BO_SURROGATE = [[0xD800, 0xDFFF]];
  function boSurrogate(ds) {
    var ra = [], i;
    for (i = 0; i < ds.length; i++) {
      if (ds[i][1] < 0xD800 || ds[i][0] > 0xDFFF) ra.push(ds[i]);
      else {
        if (ds[i][0] < 0xD800) ra.push([ds[i][0], 0xD7FF]);
        if (ds[i][1] > 0xDFFF) ra.push([0xE000, ds[i][1]]);
      }
    }
    return ra;
  }

  var CHU_VN = "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ";
  var DS_VN = (function () { var ra = [], i; for (i = 0; i < CHU_VN.length; i++) ra.push([CHU_VN.charCodeAt(i), CHU_VN.charCodeAt(i)]); return chuanHoa(ra); })();
  var DS_CHU_SO = [[48, 57], [65, 90], [97, 122]];
  var DS_IN_DUOC = [[0x20, 0x7E]];

  var LOP_D = [[48, 57]];
  var LOP_W = [[48, 57], [65, 90], [95, 95], [97, 122]];
  var LOP_S = chuanHoa([[9, 13], [32, 32], [0xA0, 0xA0], [0x1680, 0x1680], [0x2000, 0x200A], [0x2028, 0x2029], [0x202F, 0x202F], [0x205F, 0x205F], [0x3000, 0x3000], [0xFEFF, 0xFEFF]]);
  var LOP_CHAM = chuanHoa([[10, 10], [13, 13], [0x2028, 0x2029]]);                  /* `.` = phan bu cua nay */
  var TAP_CHU = chuanHoa([[65, 90], [97, 122], [0xC0, 0x24F], [0x1E00, 0x1EFF]]);   /* \p{L}: xap xi */
  var TAP_HOA = chuanHoa([[65, 90], [0xC0, 0xD6], [0xD8, 0xDE], [0x110, 0x110], [0x1EA0, 0x1EA0], [0x1EA2, 0x1EA2]]);
  var TAP_THUONG = chuanHoa([[97, 122], [0xDF, 0xF6], [0xF8, 0xFF], [0x111, 0x111]]);
  var TAP_DAU = chuanHoa([[33, 47], [58, 64], [91, 96], [123, 126]]);

  /** Chon mot ky tu (code point) tu lop `ds` (da chuan hoa); -1 neu rong. Uu tien chu + so de mau doc duoc. */
  function chonKyTu(ds, rng) {
    ds = boSurrogate(ds);
    if (!ds.length) return -1;
    var r = rng.soThuc(), x;
    x = giaoDoan(ds, 48, 122);
    var cs = [], i;
    for (i = 0; i < DS_CHU_SO.length; i++) cs = cs.concat(giaoDoan(ds, DS_CHU_SO[i][0], DS_CHU_SO[i][1]));
    if (cs.length && r < 0.85) return layThu(cs, rng);
    var asc = giaoDoan(ds, 0x20, 0x7E);
    if (asc.length && r < 0.95) return layThu(asc, rng);
    var vn = [];
    for (i = 0; i < DS_VN.length; i++) vn = vn.concat(giaoDoan(ds, DS_VN[i][0], DS_VN[i][1]));
    if (vn.length && r < 0.98) return layThu(vn, rng);
    x = layThu(ds, rng);
    return x;
  }

  /* ======================================================= phan tich cu phap */
  var TRAN_LONG = 200;                                          /* do long nhom toi da */
  var TRAN_LAP = 100000;

  function loiPh(tb, cot) { throw { thongBao: tb, cot: cot }; }

  /** Ten thuoc tinh Unicode \p{…} -> tap xap xi (null: khong biet). */
  function thuocTinhUnicode(ten) {
    var t = ten.replace(/^(General_Category|gc|Script|sc|Script_Extensions|scx)=/, "");
    if (/^(L|Letter|Alphabetic|Alpha|Latin|Latn)$/.test(t)) return TAP_CHU;
    if (/^(Lu|Uppercase_Letter|Uppercase)$/.test(t)) return TAP_HOA;
    if (/^(Ll|Lowercase_Letter|Lowercase)$/.test(t)) return TAP_THUONG;
    if (/^(N|Number|Nd|Decimal_Number|digit)$/.test(t)) return LOP_D;
    if (/^(P|Punctuation|punct|S|Symbol)$/.test(t)) return TAP_DAU;
    if (/^(Z|Separator|Zs|Space_Separator|White_Space|space)$/.test(t)) return [[32, 32]];
    if (/^(ASCII)$/.test(t)) return [[0, 127]];
    if (/^(Any)$/.test(t)) return [[0, TOI_DA]];
    return null;
  }

  function phanTich(nguon) {
    nguon = String(nguon);
    var vt = 0, n = nguon.length, soNhom = 0, khongHoTro = [], tenNhom = Object.create(null);

    function them(c) { if (khongHoTro.indexOf(c) < 0) khongHoTro.push(c); }
    function doc() {                                            /* mot code point tai vt */
      var cp = nguon.codePointAt(vt);
      vt += cp > 0xFFFF ? 2 : 1;
      return cp;
    }
    function hex(k) {
      var s = nguon.substr(vt, k);
      if (s.length === k && /^[0-9a-fA-F]+$/.test(s)) { vt += k; return parseInt(s, 16); }
      return -1;
    }

    /** Doc mot thoat sau dau `\` (vt tro vao ky tu sau `\`). Tra {cp} | {lop, phu?} | {neo} | {tc} | {ten}. `trongLop`: [..]. */
    function thoat(trongLop) {
      if (vt >= n) loiPh("Dấu \\ ở cuối mẫu", vt);
      var c = nguon.charAt(vt), cot0 = vt, x;
      vt++;
      switch (c) {
        case "d": return { lop: LOP_D };
        case "D": return { lop: phanBu(chuanHoa(LOP_D)) };
        case "w": return { lop: LOP_W };
        case "W": return { lop: phanBu(chuanHoa(LOP_W)) };
        case "s": return { lop: LOP_S };
        case "S": return { lop: phanBu(LOP_S) };
        case "t": return { cp: 9 };
        case "n": return { cp: 10 };
        case "r": return { cp: 13 };
        case "f": return { cp: 12 };
        case "v": return { cp: 11 };
        case "0": return { cp: 0 };
        case "b": if (trongLop) return { cp: 8 }; them("\\b (ranh giới từ) chỉ xấp xỉ"); return { neo: "bien" };
        case "B": if (trongLop) return { cp: 66 }; them("\\B chỉ xấp xỉ"); return { neo: "khongbien" };
        case "x": x = hex(2); return x >= 0 ? { cp: x } : { cp: 120 };
        case "u":
          if (nguon.charAt(vt) === "{") {
            var dong = nguon.indexOf("}", vt);
            if (dong > 0 && /^[0-9a-fA-F]{1,6}$/.test(nguon.slice(vt + 1, dong))) {
              x = parseInt(nguon.slice(vt + 1, dong), 16);
              if (x <= TOI_DA) { vt = dong + 1; return { cp: x }; }
            }
            return { cp: 117 };
          }
          x = hex(4);
          return x >= 0 ? { cp: x } : { cp: 117 };
        case "c":
          if (/[A-Za-z]/.test(nguon.charAt(vt))) { x = nguon.charCodeAt(vt) % 32; vt++; return { cp: x }; }
          return { cp: 92 };
        case "p": case "P":
          if (nguon.charAt(vt) === "{") {
            var d2 = nguon.indexOf("}", vt);
            if (d2 > 0) {
              var ten = nguon.slice(vt + 1, d2), tap = thuocTinhUnicode(ten);
              vt = d2 + 1;
              if (!tap) { them("\\" + c + "{" + ten + "} không biết — dùng tập chữ cái"); tap = TAP_CHU; }
              else if (!/^(L|Letter|Lu|Ll|N|Nd|P|S|Z|Zs|ASCII|Any|Alphabetic|Lowercase|Uppercase|Decimal_Number|Number|Punctuation|Symbol)$/.test(ten.replace(/^[A-Za-z_]+=/, ""))) them("\\p{" + ten + "} xấp xỉ");
              return { lop: c === "P" ? phanBu(chuanHoa(tap)) : tap };
            }
          }
          return { cp: c.charCodeAt(0) };
        case "k":
          if (!trongLop && nguon.charAt(vt) === "<") {
            var d3 = nguon.indexOf(">", vt);
            if (d3 > 0) { var tn = nguon.slice(vt + 1, d3); vt = d3 + 1; return { ten: tn }; }
          }
          return { cp: 107 };
        default:
          if (c >= "1" && c <= "9" && !trongLop) {
            var j = vt;
            while (j < n && nguon.charAt(j) >= "0" && nguon.charAt(j) <= "9" && j - cot0 < 4) j++;
            var so = parseInt(nguon.slice(cot0, j), 10);
            vt = j;
            return { tc: so };
          }
          vt = cot0;
          return { cp: doc() };                                 /* thoat dong nhat: \. \- \/ … (ca chu: nhu khong co dau \) */
      }
    }

    function lopNgoac() {                                       /* vt o sau '[' */
      var phu = false, ds = [], cot0 = vt - 1;
      if (nguon.charAt(vt) === "^") { phu = true; vt++; }
      var dau = true;
      while (true) {
        if (vt >= n) loiPh("Lớp ký tự [ không có ] đóng", cot0);
        var c = nguon.charAt(vt);
        if (c === "]" && !(dau && false)) { vt++; break; }
        dau = false;
        var a = lopPhanTu();
        if (a.lop) { ds = ds.concat(a.lop); continue; }
        if (nguon.charAt(vt) === "-" && vt + 1 < n && nguon.charAt(vt + 1) !== "]") {
          var luu = vt;
          vt++;
          var b = lopPhanTu();
          if (b.lop) { ds.push([a.cp, a.cp], [45, 45]); ds = ds.concat(b.lop); continue; }
          if (b.cp < a.cp) { vt = luu; loiPh("Khoảng ký tự ngược trong lớp [] (" + a.cp + " > " + b.cp + ")", luu); }
          ds.push([a.cp, b.cp]);
        } else ds.push([a.cp, a.cp]);
      }
      ds = chuanHoa(ds);
      return { k: "lop", ds: phu ? phanBu(ds) : ds };
    }
    function lopPhanTu() {
      if (vt >= n) loiPh("Lớp ký tự [ không có ] đóng", vt);
      var c = nguon.charAt(vt);
      if (c === "\\") { vt++; var t = thoat(true); if (t.lop) return t; return { cp: t.cp !== undefined ? t.cp : 0 }; }
      return { cp: doc() };
    }

    function soTu(den) {                                        /* doc so nguyen thap phan den ky tu `den` */
      var j = vt;
      while (j < n && nguon.charAt(j) >= "0" && nguon.charAt(j) <= "9") j++;
      return j;
    }

    /** Thu doc luong tu {n}, {n,}, {n,m} tai vt (nguon[vt] === "{"); tra null neu khong phai luong tu. */
    function luongTuNgoac() {
      var j = vt + 1, a, b;
      var k = j;
      while (k < n && nguon.charAt(k) >= "0" && nguon.charAt(k) <= "9") k++;
      if (k === j) return null;
      a = parseInt(nguon.slice(j, k), 10);
      if (nguon.charAt(k) === "}") { vt = k + 1; return [a, a]; }
      if (nguon.charAt(k) !== ",") return null;
      var l = k + 1, m = l;
      while (m < n && nguon.charAt(m) >= "0" && nguon.charAt(m) <= "9") m++;
      if (nguon.charAt(m) !== "}") return null;
      b = m === l ? Infinity : parseInt(nguon.slice(l, m), 10);
      if (b < a) loiPh("Lượng từ {" + a + "," + b + "} có min > max", vt);
      vt = m + 1;
      return [a, b];
    }

    function nhom(sau) {                                        /* vt o sau '(' */
      if (sau > TRAN_LONG) loiPh("Nhóm lồng quá sâu (> " + TRAN_LONG + ")", vt);
      var cot0 = vt - 1, loai = "bat", so = 0, ten = null;
      if (nguon.charAt(vt) === "?") {
        var s2 = nguon.slice(vt + 1, vt + 3);
        if (s2.charAt(0) === ":") { loai = "khong"; vt += 2; }
        else if (s2.charAt(0) === "=") { loai = "nhin"; vt += 2; them("nhìn trước (?=…)"); }
        else if (s2.charAt(0) === "!") { loai = "nhin"; vt += 2; them("nhìn trước phủ định (?!…)"); }
        else if (s2 === "<=") { loai = "nhin"; vt += 3; them("nhìn sau (?<=…)"); }
        else if (s2 === "<!") { loai = "nhin"; vt += 3; them("nhìn sau phủ định (?<!…)"); }
        else if (s2.charAt(0) === "<") {
          var d = nguon.indexOf(">", vt);
          if (d < 0) loiPh("Tên nhóm (?<… thiếu >", vt);
          ten = nguon.slice(vt + 2, d);
          if (!/^[A-Za-z_$][\w$]*$/.test(ten)) loiPh("Tên nhóm không hợp lệ: " + ten, vt);
          vt = d + 1; loai = "bat";
        } else if (/^[imsguy-]/.test(s2)) {                    /* (?i:…) — khong phai cu phap JS truyen thong */
          var d4 = nguon.indexOf(":", vt);
          if (d4 < 0) loiPh("Cú pháp (?… không hiểu", vt);
          them("cờ nội tuyến (?" + nguon.slice(vt + 1, d4) + ":…)"); vt = d4 + 1; loai = "khong";
        } else loiPh("Cú pháp (?… không hiểu", vt);
      }
      if (loai === "bat") { so = ++soNhom; if (ten) tenNhom[ten] = so; }
      var con = hoac(sau + 1);
      if (nguon.charAt(vt) !== ")") loiPh("Nhóm ( không có ) đóng", cot0);
      vt++;
      if (loai === "nhin") return { k: "nhin", nut: con };
      return { k: "nhom", nut: con, so: so, ten: ten };
    }

    function nguyenTu(sau) {
      var c = nguon.charAt(vt), cp, x, a;
      if (c === "^") { vt++; return { k: "neo", loai: "dau" }; }
      if (c === "$") { vt++; return { k: "neo", loai: "cuoi" }; }
      if (c === "(") { vt++; return nhom(sau); }
      if (c === "[") { vt++; return lopNgoac(); }
      if (c === ".") { vt++; return { k: "lop", ds: phanBu(LOP_CHAM) }; }
      if (c === "\\") {
        vt++;
        x = thoat(false);
        if (x.lop) return { k: "lop", ds: chuanHoa(x.lop) };
        if (x.neo) return { k: "neo", loai: x.neo };
        if (x.tc !== undefined) return { k: "tc", so: x.tc };
        if (x.ten !== undefined) return { k: "tc", ten: x.ten };
        return { k: "ky", cp: x.cp };
      }
      if (c === "*" || c === "+" || c === "?") loiPh("Lượng từ “" + c + "” không có gì để lặp", vt);
      if (c === "{") { a = vt; if (luongTuNgoac()) { vt = a; loiPh("Lượng từ { không có gì để lặp", vt); } }
      cp = doc();
      return { k: "ky", cp: cp };
    }

    function luongTu(nut) {
      var c = nguon.charAt(vt), mn, mx;
      if (c === "*") { mn = 0; mx = Infinity; vt++; }
      else if (c === "+") { mn = 1; mx = Infinity; vt++; }
      else if (c === "?") { mn = 0; mx = 1; vt++; }
      else if (c === "{") { var r = luongTuNgoac(); if (!r) return null; mn = r[0]; mx = r[1]; }
      else return null;
      if (mn > TRAN_LAP) loiPh("Lượng từ lặp quá nhiều lần (" + mn + ")", vt);
      var luoi = false;
      if (nguon.charAt(vt) === "?") { luoi = true; vt++; }
      return { k: "lap", nut: nut, min: mn, max: mx, luoi: luoi };
    }

    function noi(sau) {
      var ds = [];
      while (vt < n && nguon.charAt(vt) !== "|" && nguon.charAt(vt) !== ")") {
        var a = nguyenTu(sau);
        var l = luongTu(a);
        if (l) {
          if (a.k === "neo") loi2("Neo không lặp được");
          a = l;
          if (nguon.charAt(vt) === "*" || nguon.charAt(vt) === "+" || nguon.charAt(vt) === "?") loiPh("Lượng từ lồng nhau không hợp lệ", vt);
        }
        ds.push(a);
      }
      return ds.length === 1 ? ds[0] : { k: "noi", ds: ds };
    }
    function loi2(tb) { loiPh(tb, vt); }

    function hoac(sau) {
      var ds = [noi(sau)];
      while (nguon.charAt(vt) === "|") { vt++; ds.push(noi(sau)); }
      return ds.length === 1 ? ds[0] : { k: "hoac", ds: ds };
    }

    var ast = hoac(0);
    if (vt < n) loiPh("Dấu ) thừa", vt);
    var kq = { ast: ast, khongHoTro: khongHoTro, soNhom: soNhom, tenNhom: tenNhom };
    kq.neoDau = coNeo(ast, true);
    kq.neoCuoi = coNeo(ast, false);
    return kq;
  }

  /** Moi nhanh deu bat dau (dau=true) / ket thuc (dau=false) bang neo ^ / $ ? */
  function coNeo(nut, dau) {
    var ngan = [nut], ok = true;
    while (ngan.length) {
      var x = ngan.pop();
      if (x.k === "neo" && (dau ? x.loai === "dau" : x.loai === "cuoi")) continue;
      if (x.k === "noi") {
        if (!x.ds.length) return false;
        var bien = dau ? x.ds[0] : x.ds[x.ds.length - 1];
        /* bo qua phan tu rong dau/cuoi khong co: noi chi co phan tu co that */
        ngan.push(bien);
      } else if (x.k === "hoac") { for (var i = 0; i < x.ds.length; i++) ngan.push(x.ds[i]); }
      else if (x.k === "nhom") ngan.push(x.nut);
      else if (x.k === "lap" && x.min >= 1) ngan.push(x.nut);
      else { ok = false; break; }
    }
    return ok;
  }

  /* ======================================================= sinh */
  /** Sinh mot chuoi tu AST. Nhieu lan lap gioi han boi `lapToiDa` (so lan THEM so voi min) va tran do dai. */
  function sinhChuoi(ast, rng, tuyChon) {
    tuyChon = tuyChon || {};
    var L = tuyChon.lapToiDa >= 0 ? tuyChon.lapToiDa : 8;
    var lon = !!tuyChon.thienLon, tran = tuyChon.doDaiToiDa > 0 ? tuyChon.doDaiToiDa : 20000;
    var ra = [], dai = 0, bat = Object.create(null), batTen = Object.create(null), khongHoTro = [], tuLap = 0, nhieuBuoc = 0;
    function them(c) { if (khongHoTro.indexOf(c) < 0) khongHoTro.push(c); }

    function dung() { return dai > tran || nhieuBuoc > 400000; }

    function kyTu(cp) { ra.push(String.fromCodePoint(cp)); dai++; }

    /* Ngan xep tu quan ly de mau long sau (toi TRAN_LONG nhom) van nhe; do sau toi da vai tram nen de quy chap nhan duoc. */
    function sinh(x) {
      if (dung()) return;
      nhieuBuoc++;
      var i, cp;
      switch (x.k) {
        case "ky": kyTu(x.cp); break;
        case "lop":
          cp = chonKyTu(x.ds, rng);
          if (cp < 0) { them("lớp ký tự rỗng — không có chuỗi nào khớp"); tuLap = -1; } else kyTu(cp);
          break;
        case "noi": for (i = 0; i < x.ds.length; i++) sinh(x.ds[i]); break;
        case "hoac": sinh(x.ds[Math.floor(rng.soThuc() * x.ds.length)]); break;
        case "nhom": {
          var tu = ra.length;
          sinh(x.nut);
          if (x.so) bat[x.so] = ra.slice(tu).join("");
          if (x.ten) batTen[x.ten] = ra.slice(tu).join("");
          break;
        }
        case "lap": {
          var hi = Math.min(x.max, x.min + L), lo = x.min, n;
          if (hi < lo) hi = lo;
          if (x.min === 0 && x.max === 1 && !lon) n = rng.soThuc() < 0.5 ? 1 : 0;
          else {
            var r = rng.soThuc();
            if (lon) r = 0.5 + r / 2;
            n = lo + Math.floor(r * (hi - lo + 1));
            if (n > hi) n = hi;
          }
          for (i = 0; i < n && !dung(); i++) sinh(x.nut);
          break;
        }
        case "tc": {
          var s = x.ten !== undefined ? batTen[x.ten] : bat[x.so];
          if (s) { ra.push(s); dai += s.length; }
          break;
        }
        default: break;                                         /* neo, nhin: khong sinh gi (se kiem lai) */
      }
    }
    sinh(ast);
    return { chuoi: ra.join(""), khongHoTro: khongHoTro, rong: tuLap < 0, quaDai: dai > tran };
  }

  function bienDichRegex(nguon) {
    try { return { re: new RegExp(nguon, "u"), u: true }; }
    catch (e) {
      try { return { re: new RegExp(nguon), u: false }; }
      catch (e2) { return { re: null, loi: String(e2 && e2.message || e2) }; }
    }
  }

  /** RegExp.test co the NEM (V8 bien dich lười: "regular expression too large" chi bao luc chay) -> coi nhu khong khop. */
  function thuKhop(re, s) { try { return re.test(s); } catch (e) { return false; } }

  var CH_DEM = "abcdefghijklmnopqrstuvwxyz0123456789";
  function demChuoi(rng, k) { var s = "", i; for (i = 0; i < k; i++) s += CH_DEM.charAt(Math.floor(rng.soThuc() * CH_DEM.length)); return s; }

  function kqQuaDai(cb) { return cb.some(function (x) { return /vượt trần/.test(x); }); }

  function doDaiCP(s) { var n = 0, i; for (i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) i++; n++; } return n; }

  /**
   * Sinh chuoi khop `nguon` voi do dai (code point) trong [doDaiMin, doDaiMax]. Thu toi da `thuToiDa` lan, tu chinh do lap theo do dai
   * tinh duoc (qua ngan -> tang, qua dai -> giam). Khong khop RegExp that (vd co nhin truoc) -> tra chuoi cuoi + khop:false + canhBao.
   */
  function sinhTheoMau(nguon, rng, tuyChon) {
    tuyChon = tuyChon || {};
    var dmin = tuyChon.doDaiMin > 0 ? tuyChon.doDaiMin : 0, dmax = tuyChon.doDaiMax >= 0 ? tuyChon.doDaiMax : Infinity;
    var thu = tuyChon.thuToiDa > 0 ? tuyChon.thuToiDa : 60;
    var canhBao = [], ph;
    try { ph = phanTich(nguon); }
    catch (e) { return { chuoi: "", khop: false, canhBao: ["Pattern không phân tích được" + (e && e.cot !== undefined ? " (cột " + (e.cot + 1) + ")" : "") + ": " + (e && e.thongBao || e)] }; }
    var bd = bienDichRegex(nguon);
    if (!bd.re) return { chuoi: "", khop: false, canhBao: ["Pattern không biên dịch được: " + bd.loi] };
    var L = tuyChon.lapToiDa >= 0 ? tuyChon.lapToiDa : 8, lon = false, tot = null, t, kq;
    ph.khongHoTro.forEach(function (c) { canhBao.push("Pattern dùng " + c + " — không sinh được chắc chắn, đã kiểm lại bằng RegExp"); });
    for (t = 0; t < thu; t++) {
      kq = sinhChuoi(ph.ast, rng, { lapToiDa: L, thienLon: lon });
      kq.khongHoTro.forEach(function (c) { var m = "Pattern dùng " + c; if (canhBao.indexOf(m) < 0 && ph.khongHoTro.indexOf(c) < 0) canhBao.push(m); });
      var s = kq.chuoi, d = doDaiCP(s);
      if (d < dmin && !kq.rong) {
        if (!ph.neoCuoi) { s += demChuoi(rng, dmin - d); d = dmin; }
        else if (!ph.neoDau) { s = demChuoi(rng, dmin - d) + s; d = dmin; }
      }
      var okDai = d >= dmin && d <= dmax, khop = !kq.rong && !kq.quaDai && okDai && thuKhop(bd.re, s);   /* chuoi bi cat o tran: khong the khop (va khong kiem — tranh quet bac hai) */
      if (khop) return { chuoi: s, khop: true, canhBao: ph.khongHoTro.length || !bd.u ? canhBao.concat(bd.u ? [] : ["Pattern chỉ hợp lệ không có cờ Unicode (u)"]) : [] };
      if (!tot || (okDai && !tot.okDai)) tot = { chuoi: s, okDai: okDai };
      if (kq.quaDai) { canhBao.push("Chuỗi sinh ra vượt trần " + 20000 + " ký tự (lượng từ quá lớn) — không đảm bảo"); break; }
      if (d < dmin) { L = Math.min(L * 2 + 2, 5000); lon = true; }
      else if (d > dmax) { L = L >> 1; lon = false; }
    }
    if (!kqQuaDai(canhBao)) canhBao.push("Không sinh được chuỗi khớp pattern" + (dmin > 0 || dmax < Infinity ? " với độ dài " + dmin + "–" + (dmax === Infinity ? "∞" : dmax) : "") + " sau " + thu + " lần thử");
    return { chuoi: tot ? tot.chuoi : "", khop: false, canhBao: canhBao };
  }

  JE.regexSinh = {
    phanTich: phanTich, sinhChuoi: sinhChuoi, sinhTheoMau: sinhTheoMau, taoRng: taoRng, doDaiCP: doDaiCP, bienDichRegex: bienDichRegex
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.regexSinh;
});
