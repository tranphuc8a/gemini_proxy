/* =====================================================================
   tim-kiem.js — tim / thay trong VAN BAN va trong CAY GIA TRI JSON. THUAN (khong DOM).

     JE.timKiem.taoRegex(q, {hoaThuong, caTu, regex}) -> RegExp | {loi: "…"}   (q rong -> {loi: ""})
     JE.timKiem.timTrongVanBan(s, q, tc, tran=20000)  -> [{bd, kt}] (+ .catBot)     bo khop rong
     JE.timKiem.thayTrongVanBan(s, khop, thay, tc)    -> {s, soThay}
         khop: chuoi q (thay tat ca) hoac mang [{bd, kt}] (thay mot / vai cho; can tc.q de mo rong $1 khi regex)
     JE.timKiem.timTrongGiaTri(goc, q, tc, tran)      -> [{duong, noi: "khoa"|"gia-tri", bd, kt}] (+ .catBot)
         tc.phamVi: "khoa" | "gia-tri" | "ca-hai" (mac dinh); tc.kieu: ["string","number","boolean","null"]
         thu tu = thu tu tai lieu (= thu tu hien tren cay): khoa cua mot muc truoc gia tri cua no
         so tren chuoi ngan: chuoi khong nhay, so dang String(v), true / false / null
     JE.timKiem.thayTrongGiaTri(goc, q, thay, tc)     -> {goc, soThay, boQua: [{duong, lyDo}]}
         chi thay chuoi gia tri va TEN KHOA; khop nam trong so / true / false / null: bo qua + bao;
         doi ten gay trung khoa: bo qua + bao (giu ten cu). Chia se cau truc voi `goc` cho phan khong doi.
         tc.chi = {duong, noi, thuTu}: chi thay MOT cho (thuTu = so thu tu cua khop trong chuoi do; -1 / bo qua = ca chuoi)

   Moi regex nguoi dung qua JE.chung.kiemRegexAnToan (chan dang quay lui theo cap so); co co hieu "u"; che do regex
   them co "m" (^ $ theo dong). Khong de quy, khong regex tren du lieu (chi regex DUOC TAO tu q).
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  var TRAN = 20000;

  function laNhanh(v) { return v !== null && typeof v === "object"; }

  /* ----------------------------------------------------------------- regex */
  function thoatRegex(q) {
    var ra = "";
    for (var i = 0; i < q.length; i++) {
      var c = q.charAt(i);
      ra += "^$\\.*+?()[]{}|/".indexOf(c) >= 0 ? "\\" + c : c;
    }
    return ra;
  }

  var BIEN_TU = "(?<![\\p{L}\\p{N}\\p{M}_])", CUOI_TU = "(?![\\p{L}\\p{N}\\p{M}_])";

  function taoRegex(q, tc) {
    tc = tc || {};
    q = q === undefined || q === null ? "" : String(q);
    if (q === "") return { loi: "" };
    var mau = q;
    if (tc.regex) {
      var lyDo = JE.chung.kiemRegexAnToan(q);
      if (lyDo) return { loi: lyDo };
    } else mau = thoatRegex(q);
    if (tc.caTu) mau = BIEN_TU + "(?:" + mau + ")" + CUOI_TU;
    try { return new RegExp(mau, "gu" + (tc.hoaThuong ? "" : "i") + (tc.regex ? "m" : "")); }
    catch (e) { return { loi: "Regex không hợp lệ: " + String(e.message).replace(/^Invalid regular expression: /, "") }; }
  }

  function laRegex(x) { return x && typeof x === "object" && typeof x.exec === "function"; }
  function lamRegex(q, tc) { return laRegex(q) ? q : taoRegex(q, tc); }

  /** Cac khop KHAC RONG cua `re` (co co g) trong `s`; toi da `tran`. */
  function khopTrong(s, re, tran, ra) {
    ra = ra || [];
    var m;
    re.lastIndex = 0;
    while (ra.length < tran && (m = re.exec(s)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex = m.index + (s.codePointAt(m.index) > 0xffff ? 2 : 1);
        if (re.lastIndex > s.length) break;
        continue;
      }
      ra.push({ bd: m.index, kt: m.index + m[0].length });
    }
    return ra;
  }

  function timTrongVanBan(s, q, tc, tran) {
    s = String(s);
    var han = tran > 0 ? tran : TRAN;
    tc = tc || {};
    var re = lamRegex(q, tc), ra;
    if (!laRegex(re)) { ra = []; ra.catBot = false; ra.loi = re.loi; return ra; }
    if (!tc.regex && !tc.caTu && tc.hoaThuong && !laRegex(q)) {                 /* nhanh: indexOf */
      ra = [];
      var kim = String(q), i = s.indexOf(kim);
      while (i >= 0 && ra.length < han) { ra.push({ bd: i, kt: i + kim.length }); i = s.indexOf(kim, i + kim.length); }
      ra.catBot = i >= 0 && ra.length >= han;
      return ra;
    }
    ra = khopTrong(s, re, han + 1);
    ra.catBot = ra.length > han;
    if (ra.catBot) ra.length = han;
    return ra;
  }

  /** Mo rong mau thay: $$ $& $` $' $1..$99 $<ten>; khong thanh $n hop le thi giu nguyen. */
  function moRongThay(mau, m, s) {
    if (mau.indexOf("$") < 0) return mau;
    var ra = "", nh = m.length - 1;
    for (var i = 0; i < mau.length; i++) {
      var c = mau.charAt(i);
      if (c !== "$" || i + 1 >= mau.length) { ra += c; continue; }
      var d = mau.charAt(i + 1);
      if (d === "$") { ra += "$"; i++; }
      else if (d === "&") { ra += m[0]; i++; }
      else if (d === "`") { ra += s.slice(0, m.index); i++; }
      else if (d === "'") { ra += s.slice(m.index + m[0].length); i++; }
      else if (d >= "0" && d <= "9") {
        var d2 = mau.charAt(i + 2), so2 = d2 >= "0" && d2 <= "9" ? +(d + d2) : -1;
        if (so2 >= 1 && so2 <= nh) { ra += m[so2] === undefined ? "" : m[so2]; i += 2; }
        else if (+d >= 1 && +d <= nh) { ra += m[+d] === undefined ? "" : m[+d]; i++; }
        else ra += c;
      } else if (d === "<" && m.groups) {
        var k = mau.indexOf(">", i + 2);
        if (k < 0) { ra += c; continue; }
        var ten = mau.slice(i + 2, k);
        ra += Object.prototype.hasOwnProperty.call(m.groups, ten) && m.groups[ten] !== undefined ? m.groups[ten] : "";
        i = k;
      } else ra += c;
    }
    return ra;
  }

  /** Thay cac khop `ds` ([{bd, kt}] tang dan, khong chong) trong `s`. Regex: mo rong $1.. bang cach khop lai tai bd. */
  function thayCacKhop(s, ds, thay, re) {
    if (!ds.length) return s;
    var tu = null, ra = [], vi = 0;
    if (re && laRegex(re)) { tu = new RegExp(re.source, re.flags.replace("g", "") + "y"); }
    for (var i = 0; i < ds.length; i++) {
      var k = ds[i], rep = thay;
      if (tu) {
        tu.lastIndex = k.bd;
        var m = tu.exec(s);
        if (m && m.index === k.bd && m[0].length === k.kt - k.bd) rep = moRongThay(thay, m, s);
      }
      ra.push(s.slice(vi, k.bd), rep);
      vi = k.kt;
    }
    ra.push(s.slice(vi));
    return ra.join("");
  }

  function thayTrongVanBan(s, khop, thay, tc) {
    s = String(s); thay = String(thay === undefined || thay === null ? "" : thay);
    tc = tc || {};
    var ds, re = null;
    if (typeof khop === "string" || laRegex(khop)) {
      re = lamRegex(khop, tc);
      if (!laRegex(re)) return { s: s, soThay: 0, loi: re.loi };
      ds = khopTrong(s, re, Infinity);
    } else {
      ds = (khop || []).slice().sort(function (a, b) { return a.bd - b.bd; });
      if (tc.regex && tc.q !== undefined) { var r2 = lamRegex(tc.q, tc); if (laRegex(r2)) re = r2; }
    }
    if (!tc.regex) re = null;                                  /* van ban thuan: thay dung nghia den */
    return { s: thayCacKhop(s, ds, thay, re), soThay: ds.length };
  }

  /* ----------------------------------------------------------------- cay gia tri */
  var KIEU_MAC_DINH = ["string", "number", "boolean", "null"];

  function kieuLa(v) { return v === null ? "null" : typeof v; }

  function chuoiNgan(v) {
    if (typeof v === "string") return v;
    if (v === null) return "null";
    return String(v);
  }

  function duongCua(nut) {
    var ds = [];
    for (var x = nut; x && x.p; x = x.p) ds.push(x.k);
    return ds.reverse();
  }

  /** Duyet theo thu tu tai lieu; goi ham(nut, noi, text) cho moi chuoi tim duoc (khoa roi gia tri).
      ham tra false -> dung. nut = {v, p, k}. LAP bang ngan xep. */
  function duyetChu(goc, tc, ham) {
    var phamVi = tc.phamVi || "ca-hai", kieu = tc.kieu || KIEU_MAC_DINH;
    var tuKhoa = phamVi !== "gia-tri", tuGiaTri = phamVi !== "khoa";
    var coKieu = {};
    for (var i = 0; i < kieu.length; i++) coKieu[kieu[i]] = true;
    var ngan = [{ v: goc, p: null, k: undefined }];
    while (ngan.length) {
      var n = ngan.pop(), v = n.v;
      if (tuKhoa && typeof n.k === "string" && n.p) {
        if (ham(n, "khoa", n.k) === false) return;
      }
      if (laNhanh(v)) {
        if (Array.isArray(v)) { for (var a = v.length - 1; a >= 0; a--) ngan.push({ v: v[a], p: n, k: a }); }
        else { var ks = Object.keys(v); for (var b = ks.length - 1; b >= 0; b--) ngan.push({ v: v[ks[b]], p: n, k: ks[b] }); }
      } else if (tuGiaTri && coKieu[kieuLa(v)]) {
        if (ham(n, "gia-tri", chuoiNgan(v)) === false) return;
      }
    }
  }

  function timTrongGiaTri(goc, q, tc, tran) {
    tc = tc || {};
    var han = tran > 0 ? tran : TRAN, ra = [];
    ra.catBot = false;
    var re = lamRegex(q, tc);
    if (!laRegex(re)) { ra.loi = re.loi; return ra; }
    var tmp = [];
    duyetChu(goc, tc, function (nut, noi, text) {
      tmp.length = 0;
      khopTrong(text, re, han - ra.length + 1, tmp);
      for (var i = 0; i < tmp.length; i++) {
        if (ra.length >= han) { ra.catBot = true; return false; }
        ra.push({ duong: duongCua(nut), noi: noi, bd: tmp[i].bd, kt: tmp[i].kt });
      }
      return true;
    });
    return ra;
  }

  function datKhoa(o, k, v) {
    if (k === "__proto__") Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true });
    else o[k] = v;
  }

  function khoaDuong(d) { return JSON.stringify(d); }

  /** Ham gan ket qua con vao dst (tao rieng cho moi dst de khong dinh bien vong lap). */
  function ganCon(dst, ten) {
    return function (d) { if (Array.isArray(dst)) dst[ten] = d; else datKhoa(dst, ten, d); };
  }

  function thayTrongGiaTri(goc, q, thay, tc) {
    tc = tc || {};
    thay = String(thay === undefined || thay === null ? "" : thay);
    var re = lamRegex(q, tc), boQua = [];
    if (!laRegex(re)) return { goc: goc, soThay: 0, boQua: boQua, loi: re.loi };
    var chi = tc.chi || null;
    var mo = !!tc.regex, soThay = 0;

    /* pha 1: tim va tinh chuoi moi; ghi vao cay tien to (trie) bam theo nut cha — chi nhung nhanh CO SUA moi co nut trie */
    var trie = { key: undefined, kids: null, edit: undefined, ren: null };
    var coSua = false;
    function trieCua(nut) {
      if (nut.tn) return nut.tn;
      var chuoi = [];
      while (nut.p && !nut.tn) { chuoi.push(nut); nut = nut.p; }
      var t = nut.tn || (nut.tn = trie);
      for (var i = chuoi.length - 1; i >= 0; i--) {
        var x = chuoi[i], c = t.kids ? t.kids.get(x.k) : undefined;
        if (!c) { c = { key: x.k, kids: null, edit: undefined, ren: null }; (t.kids || (t.kids = new Map())).set(x.k, c); }
        x.tn = c;
        t = c;
      }
      return t;
    }
    function xuLy(nut, noi, text) {
      var ds = khopTrong(text, re, Infinity);
      if (!ds.length) return true;
      if (chi && chi.thuTu !== undefined && chi.thuTu >= 0) { ds = ds.slice(chi.thuTu, chi.thuTu + 1); if (!ds.length) return true; }
      if (noi === "gia-tri" && typeof nut.v !== "string") {
        boQua.push({ duong: duongCua(nut), lyDo: "chỉ thay được trong chuỗi — giá trị này là " + (nut.v === null ? "null" : typeof nut.v === "number" ? "số" : "true/false") });
        return true;
      }
      var moi = thayCacKhop(text, ds, thay, mo ? re : null);
      if (noi === "gia-tri") {
        soThay += ds.length;
        if (moi === text) return true;
        trieCua(nut).edit = moi;
      } else {
        if (moi === text) { soThay += ds.length; return true; }
        var cha = trieCua(nut.p);
        if (!cha.ren) cha.ren = new Map();
        cha.ren.set(text, { moi: moi, n: ds.length, nut: nut });
      }
      coSua = true;
      return true;
    }

    if (chi) {
      /* mot cho: di thang theo duong dan, khong quet ca cay */
      var nut = { v: goc, p: null, k: undefined }, hop = true;
      for (var z = 0; z < chi.duong.length && hop; z++) {
        var kz = chi.duong[z], vz = nut.v;
        if (Array.isArray(vz) && typeof kz === "number" && kz >= 0 && kz < vz.length) nut = { v: vz[kz], p: nut, k: kz };
        else if (laNhanh(vz) && !Array.isArray(vz) && Object.prototype.hasOwnProperty.call(vz, kz)) nut = { v: vz[kz], p: nut, k: kz };
        else hop = false;
      }
      if (hop) {
        var phamViChi = tc.phamVi || "ca-hai";
        if (chi.noi === "khoa" && typeof nut.k === "string" && phamViChi !== "gia-tri") xuLy(nut, "khoa", nut.k);
        else if (chi.noi === "gia-tri" && !laNhanh(nut.v) && phamViChi !== "khoa" && (tc.kieu || KIEU_MAC_DINH).indexOf(kieuLa(nut.v)) >= 0) xuLy(nut, "gia-tri", chuoiNgan(nut.v));
      }
    } else {
      duyetChu(goc, tc, xuLy);
    }
    if (!coSua) return { goc: goc, soThay: soThay, boQua: boQua };

    /* pha 2: dung lai CHI cac nhanh co sua (cac nhanh khac dung chung tham chieu) */
    var ketQua = goc;
    var task = [{ src: goc, t: trie, gan: function (d) { ketQua = d; }, cuoi: null }];
    while (task.length) {
      var tk = task.pop(), src = tk.src, t = tk.t, dst, i;
      if (t.edit !== undefined && typeof src === "string") { tk.gan(t.edit); continue; }
      if (!laNhanh(src)) { tk.gan(src); continue; }
      var cuoi = null;
      if (Array.isArray(src)) {
        dst = src.slice();
      } else {
        dst = {};
        var ks = Object.keys(src);
        if (!t.ren) {
          for (i = 0; i < ks.length; i++) datKhoa(dst, ks[i], src[ks[i]]);
        } else {
          cuoi = new Map();
          /* loai cac doi ten gay trung (lap toi khi het trung) */
          var chap = new Map(t.ren);
          for (;;) {
            var dem = new Map(), trung = false;
            for (i = 0; i < ks.length; i++) { var fn = chap.has(ks[i]) ? chap.get(ks[i]).moi : ks[i]; dem.set(fn, (dem.get(fn) || 0) + 1); }
            chap.forEach(function (x, kc) {
              if (dem.get(x.moi) > 1) { chap["delete"](kc); trung = true; boQua.push({ duong: duongCua(x.nut), lyDo: "đổi tên khoá thành “" + x.moi + "” bị trùng với khoá khác trong cùng object" }); }
            });
            if (!trung) break;
          }
          for (i = 0; i < ks.length; i++) {
            var f2 = chap.has(ks[i]) ? chap.get(ks[i]).moi : ks[i];
            cuoi.set(ks[i], f2);
            if (chap.has(ks[i])) soThay += chap.get(ks[i]).n;
            datKhoa(dst, f2, src[ks[i]]);
          }
        }
      }
      tk.gan(dst);
      if (t.kids) t.kids.forEach(function (kid) {
        var kc = kid.key;
        task.push({ src: src[kc], t: kid, gan: ganCon(dst, cuoi ? cuoi.get(kc) : kc) });
      });
    }
    return { goc: ketQua, soThay: soThay, boQua: boQua };
  }

  JE.timKiem = {
    taoRegex: taoRegex,
    timTrongVanBan: timTrongVanBan,
    thayTrongVanBan: thayTrongVanBan,
    timTrongGiaTri: timTrongGiaTri,
    thayTrongGiaTri: thayTrongGiaTri,
    moRongThay: moRongThay,
    TRAN: TRAN
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.timKiem;
});
