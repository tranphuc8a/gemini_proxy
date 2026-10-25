/* =====================================================================
   sua-json.js — SUA JSON HONG. THUAN (khong DOM), tuyen tinh, khong de quy, khong thu vien.

     JE.suaJson.sua(s, {gopNhieuGiaTri}) ->
       { vanBan, sua: [{bd, kt, thay, dong, cot, moTa, canhBao}], conLoi: null | {dong, cot, viTri, thongBao,
         trongBanGoc, nhieuGiaTri?}, soCanhBao }
     JE.suaJson.ap(s, sua) -> van ban (ap danh sach sua len `s`; dung lai cho "ap tung phan")

   Nguyen tac:
   - Moi "sua" la mot doan [bd, kt) cua VAN BAN GOC (chen = bd == kt) -> bo cuc nguoi dung giu nguyen; ap tu cuoi len dau.
   - SUA NHO NHAT, khong doan bua: cho nao mo ho (gia tri khong nhay "abc", khoa thieu gia tri, nhieu gia tri o goc,
     chuoi khong dong…) thi DUNG va bao qua `conLoi`, khong tu y them / bot du lieu.
   - JSON hop le => sua rong va vanBan === s (kiem bang JSON.parse truoc). Sua hai lan = sua mot lan khi da het loi.
   Nhan: BOM, rao Markdown ```json … ```, JSONP ten(…); , `var x = …;` / `export default …`, chu thich kieu // , kieu slash-sao va kieu #,
   nhay don / nhay cong “ ” ‘ ’, khoa khong nhay, True / False / None / undefined / NaN / Infinity, so +1 .5 5. 0x1F 007,
   xuong dong / tab tho trong chuoi, \\' \\x41 \\v \\0 \\u{1F600}, dau phay thua / thieu, dau hai cham thieu, ngoac dong
   thua / thieu, khoang trang dac biet (NBSP…). Tuy chon gopNhieuGiaTri: nhieu gia tri o goc (NDJSON) -> mang.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  var T_EOF = 0, T_LB = 1, T_RB = 2, T_LS = 3, T_RS = 4, T_COLON = 5, T_COMMA = 6, T_STR = 7, T_WORD = 8,
      T_LP = 9, T_RP = 10, T_SEMI = 11, T_EQ = 12, T_BAD = 13;

  function laTrangCoBan(c) { return c === 32 || c === 9 || c === 10 || c === 13; }
  function laTrangLa(c) { return c === 0xa0 || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff; }
  function laSo(c) { return c >= 48 && c <= 57; }
  function laHex(c) { return laSo(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); }
  function laChuTu(c) { return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c === 36; }
  function laKyTuTu(c) {
    if (laChuTu(c) || laSo(c) || c === 46 || c === 43 || c === 45) return true;
    if (c < 128) return false;
    return !(laTrangLa(c) || c === 0x2028 || c === 0x2029 || c === 0x201c || c === 0x201d || c === 0x2018 || c === 0x2019);
  }
  function hex2(n) { return ("0000" + n.toString(16)).slice(-4); }

  /** Vi tri (dong, cot) tu 1 cua chi so `i` trong `s`. */
  function dongCot(s, i) {
    var dong = 1, dau = 0;
    for (var k = s.indexOf("\n"); k >= 0 && k < i; k = s.indexOf("\n", k + 1)) { dong++; dau = k + 1; }
    return { dong: dong, cot: i - dau + 1 };
  }

  /* ------------------------------------------------------------ chuoi */
  /** Quet chuoi bat dau o `i` (ky tu mo). Tra {kt, daDong, moi (van ban JSON hop le), doi: [ly do], loi: null|{pos, tb}}. */
  function quetChuoi(s, i, den) {
    var mo = s.charCodeAt(i), dongSet, kieu;
    if (mo === 34) { dongSet = [34]; kieu = "kep"; }
    else if (mo === 39) { dongSet = [39]; kieu = "don"; }
    else if (mo === 0x201c || mo === 0x201d) { dongSet = [34, 0x201c, 0x201d]; kieu = "cong-kep"; }
    else { dongSet = [39, 0x2018, 0x2019]; kieu = "cong-don"; }
    var j = i + 1, ch = i + 1, ra = [], doi = [], daDong = false, loi = null;
    function co(ly) { if (doi.indexOf(ly) < 0) doi.push(ly); }
    function bo(den2, thay) { if (j > ch) ra.push(s.slice(ch, j)); ra.push(thay); ch = den2; }
    while (j < den) {
      var c = s.charCodeAt(j);
      if ((c >= 35 && c <= 91 && c !== 39) || (c > 92 && c < 0x2018)) { j++; continue; }   /* ky tu thuong: khong phai nhay / thoat / dieu khien */
      if (dongSet.indexOf(c) >= 0) { daDong = true; break; }
      if (c === 92) {
        if (j + 1 >= den) { j = den; break; }
        var e = s.charCodeAt(j + 1);
        if (e === 34 || e === 92 || e === 47 || e === 98 || e === 102 || e === 110 || e === 114 || e === 116) { j += 2; continue; }
        if (e === 117) {
          if (laHex(s.charCodeAt(j + 2)) && laHex(s.charCodeAt(j + 3)) && laHex(s.charCodeAt(j + 4)) && laHex(s.charCodeAt(j + 5))) { j += 6; continue; }
          if (s.charCodeAt(j + 2) === 123) {                           /* \u{1F600} */
            var dg = s.indexOf("}", j + 3), hx = dg > 0 && dg - j - 3 <= 6 ? s.slice(j + 3, dg) : "";
            var ok = hx.length > 0;
            for (var q = 0; q < hx.length && ok; q++) if (!laHex(hx.charCodeAt(q))) ok = false;
            var cp = ok ? parseInt(hx, 16) : -1;
            if (cp >= 0 && cp <= 0x10ffff) {
              var chuoi = String.fromCodePoint(cp), tg = "";
              for (var u = 0; u < chuoi.length; u++) tg += "\\u" + hex2(chuoi.charCodeAt(u));
              bo(dg + 1, tg); co("đổi \\u{…} thành \\uXXXX"); j = dg + 1; continue;
            }
          }
          loi = { pos: j, tb: "Dấu thoát \\u cần đúng 4 chữ số hex" };
          j += 2; continue;
        }
        if (e === 39) { bo(j + 2, "'"); co("bỏ dấu \\ thừa trước nháy đơn"); j += 2; continue; }
        if (e === 120) {
          if (laHex(s.charCodeAt(j + 2)) && laHex(s.charCodeAt(j + 3))) { bo(j + 4, "\\u00" + s.slice(j + 2, j + 4)); co("đổi \\xHH thành \\u00HH"); j += 4; continue; }
          loi = { pos: j, tb: "Dấu thoát \\x cần đúng 2 chữ số hex" };
          j += 2; continue;
        }
        if (e === 118) { bo(j + 2, "\\u000b"); co("đổi \\v thành \\u000b"); j += 2; continue; }
        if (e === 48 && !laSo(s.charCodeAt(j + 2))) { bo(j + 2, "\\u0000"); co("đổi \\0 thành \\u0000"); j += 2; continue; }
        if (e === 10 || e === 13) {                                    /* \ + xuong dong: noi dong */
          var den3 = e === 13 && s.charCodeAt(j + 2) === 10 ? j + 3 : j + 2;
          bo(den3, ""); co("bỏ dấu \\ nối dòng"); j = den3; continue;
        }
        bo(j + 2, s.charAt(j + 1)); co("bỏ dấu \\ thừa"); j += 2;      /* thoat khong hop le: lay ky tu */
        continue;
      }
      if (c < 32) {
        var tn = c === 10 ? "\\n" : c === 9 ? "\\t" : c === 13 ? "\\r" : c === 8 ? "\\b" : c === 12 ? "\\f" : "\\u" + hex2(c);
        bo(j + 1, tn); co("thoát ký tự xuống dòng / điều khiển thô trong chuỗi"); j++; continue;
      }
      if (c === 34) { bo(j + 1, '\\"'); j++; continue; }               /* nhay kep tho trong chuoi nhay don */
      j++;
    }
    if (!daDong) return { kt: den, daDong: false, moi: null, doi: doi, loi: loi };
    if (j > ch) ra.push(s.slice(ch, j));
    var inner = ra.join("");
    if (kieu !== "kep") co(kieu === "don" ? "đổi nháy đơn thành nháy kép" : "đổi nháy cong thành nháy thẳng");
    else if (s.charCodeAt(j) !== 34) co("đổi nháy cong thành nháy thẳng");
    return { kt: j + 1, daDong: true, moi: '"' + inner + '"', doi: doi, loi: loi };
  }

  /* ------------------------------------------------------------ tu (so / hang / dinh danh) */
  function chuanSo(w) {
    var i = 0, dau = "";
    if (w.charAt(0) === "+" || w.charAt(0) === "-") { dau = w.charAt(0) === "-" ? "-" : ""; i = 1; }
    var n = w.length, c0 = w.charAt(i), c1 = w.charAt(i + 1).toLowerCase();
    if (c0 === "0" && (c1 === "x" || c1 === "o" || c1 === "b") && n > i + 2) {
      var radix = c1 === "x" ? 16 : c1 === "o" ? 8 : 2, k;
      for (k = i + 2; k < n; k++) {
        var d = w.charCodeAt(k), v = laSo(d) ? d - 48 : (d | 32) >= 97 && (d | 32) <= 102 ? (d | 32) - 87 : 99;
        if (v >= radix) return null;
      }
      try { return dau + BigInt(w.slice(i)).toString(); } catch (e) { return null; }
    }
    var a = i;
    while (i < n && laSo(w.charCodeAt(i))) i++;
    var ngDigits = w.slice(a, i), frac = "", mu = "", coCham = false;
    if (w.charAt(i) === ".") {
      coCham = true; i++;
      var f0 = i;
      while (i < n && laSo(w.charCodeAt(i))) i++;
      frac = w.slice(f0, i);
    }
    if (!ngDigits.length && !frac.length) return null;
    if (w.charAt(i) === "e" || w.charAt(i) === "E") {
      var m0 = i;
      i++;
      if (w.charAt(i) === "+" || w.charAt(i) === "-") i++;
      var m1 = i;
      while (i < n && laSo(w.charCodeAt(i))) i++;
      if (i === m1) return null;
      mu = w.slice(m0, i);
    }
    if (i !== n) return null;
    var z = 0;
    while (z < ngDigits.length - 1 && ngDigits.charCodeAt(z) === 48) z++;
    var nguyen = ngDigits.slice(z) || "0";
    void coCham;
    return dau + nguyen + (frac ? "." + frac : "") + mu;
  }

  function loaiTu(w) {
    var n0 = w.length, q0 = 0;
    while (q0 < n0 && laSo(w.charCodeAt(q0))) q0++;
    if (q0 === n0 && (n0 === 1 || w.charCodeAt(0) !== 48)) return { k: "so", thay: null, moTa: "" };   /* so nguyen thuong: khong phai tinh toan */
    if (w === "true" || w === "false" || w === "null") return { k: "hang", thay: null, moTa: "" };
    var l = w.toLowerCase();
    if (l === "true" || l === "false" || l === "null") return { k: "hang", thay: l === w ? null : l, moTa: l === w ? "" : "Đổi “" + w + "” thành " + l };
    if (l === "none") return { k: "hang", thay: "null", moTa: "Đổi " + w + " (Python) thành null" };
    if (l === "undefined") return { k: "hang", thay: "null", moTa: "Đổi undefined thành null (JSON không có undefined)", canh: true };
    var bo = l.charAt(0) === "+" || l.charAt(0) === "-" ? l.slice(1) : l;
    if (bo === "nan" || bo === "infinity" || bo === "inf") return { k: "hang", thay: "null", moTa: "Đổi " + w + " thành null (JSON không có NaN / Infinity — mất giá trị)", canh: true };
    var so = chuanSo(w);
    if (so !== null) return { k: "so", thay: so === w ? null : so, moTa: so === w ? "" : "Chuẩn hoá số " + w + " thành " + so };
    var c = w.charCodeAt(0), ok = laChuTu(c) || c >= 128;
    for (var i = 1; i < w.length && ok; i++) { var d = w.charCodeAt(i); if (!(laChuTu(d) || laSo(d) || d >= 128)) ok = false; }
    if (ok) return { k: "dinh-danh" };
    return { k: "hong" };
  }

  /* ------------------------------------------------------------ tach tu */
  function tachTu(s, tu, den, E) {
    /* ba mang kieu (loai, bd, kt) tang dan khi can: 1 MB hong ~ 250 000 tu, khong tao ham nghin doi tuong cho GC */
    var cap = Math.max(16, Math.min(4096, den - tu + 2)), so = 0;
    var tt = new Uint8Array(cap), tb = new Int32Array(cap), tk = new Int32Array(cap), msg = {};
    var i = tu, c;
    function dat(loai, a, b) {
      if (so === cap) {
        cap *= 2;
        var t2 = new Uint8Array(cap); t2.set(tt); tt = t2;
        var b2 = new Int32Array(cap); b2.set(tb); tb = b2;
        var k2 = new Int32Array(cap); k2.set(tk); tk = k2;
      }
      tt[so] = loai; tb[so] = a; tk[so] = b; so++;
    }
    while (i < den) {
      c = s.charCodeAt(i);
      if (laTrangCoBan(c)) { i++; continue; }
      if (c === 123) { dat(T_LB, i, i + 1); i++; continue; }
      if (c === 125) { dat(T_RB, i, i + 1); i++; continue; }
      if (c === 91) { dat(T_LS, i, i + 1); i++; continue; }
      if (c === 93) { dat(T_RS, i, i + 1); i++; continue; }
      if (c === 58) { dat(T_COLON, i, i + 1); i++; continue; }
      if (c === 44) { dat(T_COMMA, i, i + 1); i++; continue; }
      if (c === 40) { dat(T_LP, i, i + 1); i++; continue; }
      if (c === 41) { dat(T_RP, i, i + 1); i++; continue; }
      if (c === 59) { dat(T_SEMI, i, i + 1); i++; continue; }
      if (c === 61) { dat(T_EQ, i, i + 1); i++; continue; }
      if (c === 34 || c === 39 || c === 0x201c || c === 0x201d || c === 0x2018 || c === 0x2019) {
        var r = quetChuoi(s, i, den);
        if (!r.daDong) {
          msg[so] = { pos: i, tb: "Chuỗi bắt đầu ở đây không có dấu nháy đóng" };
          dat(T_BAD, i, den);
          i = den; break;
        }
        if (r.loi) { msg[so] = r.loi; dat(T_BAD, i, r.kt); i = r.kt; continue; }
        var raw = s.slice(i, r.kt);
        if (r.moi !== raw) E.push({ bd: i, kt: r.kt, thay: r.moi, moTa: "Sửa chuỗi: " + (r.doi.length ? r.doi.join("; ") : "chuẩn hoá") });
        dat(T_STR, i, r.kt);
        i = r.kt;
        continue;
      }
      if (c === 47) {
        var c2 = s.charCodeAt(i + 1);
        if (c2 === 47) {
          var nl = s.indexOf("\n", i); if (nl < 0 || nl > den) nl = den;
          var kt2 = nl;
          if (kt2 > i && s.charCodeAt(kt2 - 1) === 13) kt2--;
          E.push({ bd: i, kt: kt2, thay: "", moTa: "Bỏ chú thích //" });
          i = nl; continue;
        }
        if (c2 === 42) {
          var ed = s.indexOf("*/", i + 2);
          if (ed < 0 || ed + 2 > den) { msg[so] = { pos: i, tb: "Chú thích /* không có */ đóng" }; dat(T_BAD, i, den); i = den; break; }
          E.push({ bd: i, kt: ed + 2, thay: "", moTa: "Bỏ chú thích /* … */" });
          i = ed + 2; continue;
        }
        msg[so] = { pos: i, tb: "Ký tự “/” không hợp lệ ở đây" };
        dat(T_BAD, i, i + 1); i++; continue;
      }
      if (c === 35) {
        var nl2 = s.indexOf("\n", i); if (nl2 < 0 || nl2 > den) nl2 = den;
        var kt3 = nl2;
        if (kt3 > i && s.charCodeAt(kt3 - 1) === 13) kt3--;
        E.push({ bd: i, kt: kt3, thay: "", moTa: "Bỏ chú thích #" });
        i = nl2; continue;
      }
      if (laTrangLa(c)) {
        E.push({ bd: i, kt: i + 1, thay: c === 0xfeff ? "" : " ", moTa: c === 0xfeff ? "Bỏ ký tự BOM lạc" : "Đổi khoảng trắng đặc biệt (U+" + hex2(c).toUpperCase() + ") thành dấu cách" });
        i++; continue;
      }
      if (laKyTuTu(c)) {
        var j = i + 1;
        while (j < den && laKyTuTu(s.charCodeAt(j))) j++;
        dat(T_WORD, i, j);
        i = j; continue;
      }
      msg[so] = { pos: i, tb: "Ký tự “" + s.charAt(i) + "” không hợp lệ trong JSON" };
      dat(T_BAD, i, i + 1);
      i++;
    }
    dat(T_EOF, den, den);
    return { tt: tt, tb: tb, tk: tk, msg: msg, so: so };
  }

  /* ------------------------------------------------------------ ap dung */
  /** Sap theo (bd, kt, thu tu phat sinh). TimSort cua V8 gap 2 day da sap (sua luc tach tu, sua luc phan tich) trong O(n). */
  function sapXep(E) {
    var ra = new Array(E.length), i;
    for (i = 0; i < E.length; i++) { E[i].s = i; ra[i] = E[i]; }
    ra.sort(function (a, b) { return a.bd - b.bd || a.kt - b.kt || a.s - b.s; });
    return ra;
  }

  /** Ap danh sach sua (da sap theo bd; khong chong) len s. */
  function ap(s, sua) {
    var ds = sapXep(sua), ra = [], vi = 0;
    for (var i = 0; i < ds.length; i++) {
      var e = ds[i];
      if (e.bd < vi) continue;                          /* chong nhau (khong nen xay ra): bo sua sau */
      ra.push(s.slice(vi, e.bd), e.thay);
      vi = e.kt;
    }
    ra.push(s.slice(vi));
    return ra.join("");
  }

  function viTriTuLoi(e, s) {
    var m = /position (\d+)/.exec(String(e && e.message));
    if (m) return Math.min(+m[1], s.length);
    var m2 = /line (\d+) column (\d+)/.exec(String(e && e.message));
    if (m2) {
      var dong = +m2[1], cot = +m2[2], i = 0;
      for (var d = 1; d < dong; d++) { var k = s.indexOf("\n", i); if (k < 0) break; i = k + 1; }
      return Math.min(i + cot - 1, s.length);
    }
    return 0;
  }

  /* ------------------------------------------------------------ chinh */
  function sua(s, tc) {
    s = String(s === undefined || s === null ? "" : s);
    tc = tc || {};
    try { JSON.parse(s); return { vanBan: s, sua: [], conLoi: null, soCanhBao: 0 }; } catch (e0) { /* hong: sua tiep */ }

    var E = [], loiNgu = null;
    var tu = 0, den = s.length;

    /* tien xu ly: BOM, rao Markdown */
    if (s.charCodeAt(0) === 0xfeff) { E.push({ bd: 0, kt: 1, thay: "", moTa: "Bỏ ký tự BOM đầu tệp" }); tu = 1; }
    var a0 = tu;
    while (a0 < den && (laTrangCoBan(s.charCodeAt(a0)) || laTrangLa(s.charCodeAt(a0)))) a0++;
    if (s.substr(a0, 3) === "```") {
      var nl = s.indexOf("\n", a0);
      if (nl < 0) nl = den;
      E.push({ bd: a0, kt: Math.min(nl + 1, den), thay: "", moTa: "Bỏ dòng rào Markdown mở (```)" });
      tu = Math.min(nl + 1, den);
    }
    var z0 = den;
    while (z0 > tu && (laTrangCoBan(s.charCodeAt(z0 - 1)) || laTrangLa(s.charCodeAt(z0 - 1)))) z0--;
    if (z0 - 3 >= tu && s.substr(z0 - 3, 3) === "```") {
      E.push({ bd: z0 - 3, kt: z0, thay: "", moTa: "Bỏ dòng rào Markdown đóng (```)" });
      den = z0 - 3;
    }

    var L = tachTu(s, tu, den, E), tt = L.tt, tb = L.tb, tk = L.tk, msg = L.msg;
    var i = 0, ngan = [], lastEnd = tu, soGoc = 0, gocBd = -1, gocKetThuc = [], gocCoPhay = [], boc = null;

    function loi(pos, tbao, them) {
      loiNgu = { pos: pos, tb: tbao };
      if (them) for (var k in them) loiNgu[k] = them[k];
    }
    function e(bd, kt, thay, moTa, canh) { E.push({ bd: bd, kt: kt, thay: thay, dong: 0, cot: 0, moTa: moTa, canhBao: !!canh, s: 0 }); }
    function xoaToken(j, moTa) { e(tb[j], tk[j], "", moTa); }
    function ten(j) { return tt[j] === T_EOF ? "hết văn bản" : "“" + s.slice(tb[j], Math.min(tk[j], tb[j] + 20)) + "”"; }

    /* bao boc: var x = … ; / export default … / ten( … ) ; */
    (function () {
      if (tt[0] !== T_WORD) return;
      var w = s.slice(tb[0], tk[0]);
      if ((w === "var" || w === "let" || w === "const") && tt[1] === T_WORD && tt[2] === T_EQ) {
        e(tb[0], tk[2], "", "Bỏ “" + w + " " + s.slice(tb[1], tk[1]) + " =”"); boc = "bien"; i = 3; lastEnd = tk[2]; return;
      }
      if (w === "module.exports" && tt[1] === T_EQ) { e(tb[0], tk[1], "", "Bỏ “module.exports =”"); boc = "bien"; i = 2; lastEnd = tk[1]; return; }
      if (w === "export" && tt[1] === T_WORD && s.slice(tb[1], tk[1]) === "default") { e(tb[0], tk[1], "", "Bỏ “export default”"); boc = "bien"; i = 2; lastEnd = tk[1]; return; }
      if (tt[1] === T_LP && loaiTu(w).k === "dinh-danh") { e(tb[0], tk[1], "", "Bỏ lời gọi JSONP " + w + "("); boc = "jsonp"; i = 2; lastEnd = tk[1]; }
    })();

    /* chi so dong lazy (tim nhi phan) — dung cho thong bao "mo o dong N" cua hang chuc nghin khung */
    var dauDongs = null;
    function dongCuaViTri(p) {
      if (!dauDongs) { dauDongs = [0]; for (var q = s.indexOf("\n"); q >= 0; q = s.indexOf("\n", q + 1)) dauDongs.push(q + 1); }
      var lo = 0, hi = dauDongs.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (dauDongs[mid] <= p) lo = mid; else hi = mid - 1; }
      return lo + 1;
    }

    /* may trang thai: "GT" (can gia tri), "SAU" (vua xong mot gia tri), "KHOA" (can khoa hoac dong), "HAIC" (can :) */
    var tai = "GT";
    function dongDuoc(f) { return f.st === "RONG" || f.st === "SAU"; }
    function chenDong(viTriDong, tuTang) {                 /* dong cac khung tu tren xuong (tuTang) toi khung `tuTang` */
      /* chi khung TREN CUNG can o trang thai dong duoc; cac khung ben duoi dang cho khung con dong lai */
      for (var k = ngan.length - 1; k >= tuTang; k--) {
        var f = ngan[k];
        if (k === ngan.length - 1 && !dongDuoc(f)) return false;
        e(lastEnd, lastEnd, f.t === "o" ? "}" : "]", "Thêm " + (f.t === "o" ? "}" : "]") + " còn thiếu (mở ở dòng " + dongCuaViTri(f.bd) + ")");
      }
      return true;
    }
    function giaTriXong(kt) {
      lastEnd = kt;
      if (ngan.length) ngan[ngan.length - 1].st = "SAU"; else { soGoc++; gocKetThuc.push(kt); }
      tai = "SAU";
    }

    var an = 0;
    while (!loiNgu) {
      if (++an > 40000000) break;
      var t = tt[i];
      if (t === T_BAD) { var m = msg[i]; loi(m ? m.pos : tb[i], m ? m.tb : "Ký tự không hợp lệ"); break; }
      var f = ngan.length ? ngan[ngan.length - 1] : null;

      if (tai === "GT") {
        if (t === T_LB || t === T_LS) {
          if (!ngan.length && soGoc === 0) gocBd = tb[i];
          ngan.push({ t: t === T_LB ? "o" : "a", st: "RONG", bd: tb[i] });
          lastEnd = tk[i]; i++;
          tai = t === T_LB ? "KHOA" : "GT";
          continue;
        }
        if (t === T_STR) { if (!ngan.length && soGoc === 0) gocBd = tb[i]; giaTriXong(tk[i]); i++; continue; }
        if (t === T_WORD) {
          var lw = loaiTu(s.slice(tb[i], tk[i]));
          if (lw.k === "so" || lw.k === "hang") {
            if (lw.thay !== null) e(tb[i], tk[i], lw.thay, lw.moTa, lw.canh);
            if (!ngan.length && soGoc === 0) gocBd = tb[i];
            giaTriXong(tk[i]); i++; continue;
          }
          if (lw.k === "dinh-danh") { loi(tb[i], "Giá trị " + ten(i) + " không có nháy — không rõ có phải chuỗi không (thêm nháy kép nếu đúng)"); break; }
          loi(tb[i], "Không hiểu " + ten(i) + " là giá trị JSON nào"); break;
        }
        if (t === T_RS || t === T_RB) {
          /* ] hoac } khi dang can gia tri: chi hop le trong mang rong "[ ]" (da xu ly o KHOA / SAU) hoac dau phay thua */
          if (f && f.t === "a" && f.st === "RONG" && t === T_RS) { ngan.pop(); xongKhoi(i); continue; }
          if (f && f.t === "o") { loi(tb[i], "Thiếu giá trị sau dấu hai chấm (gặp " + ten(i) + ")"); break; }
          if (!f || f.t === "a") { dongKhongKhop(i); continue; }
        }
        if (t === T_COMMA) {
          /* [,1] hoac [1,,2]: dau phay thua truoc gia tri */
          if (f && f.t === "a") { xoaToken(i, "Bỏ dấu phẩy thừa"); i++; continue; }
          loi(tb[i], "Thiếu giá trị trước dấu phẩy"); break;
        }
        if (t === T_EOF) {
          if (f && f.t === "a" && f.st === "RONG") { chenDongHet(); break; }
          if (!ngan.length && soGoc === 0) { loi(tb[i], "Không có giá trị JSON nào"); break; }
          if (ngan.length) { loi(den, "Văn bản kết thúc khi còn thiếu giá trị"); break; }
        }
        loi(tb[i], "Không mong gặp " + ten(i) + " ở đây (cần một giá trị)"); break;
      }

      if (tai === "KHOA") {                               /* trong object: can khoa hoac } */
        if (t === T_STR) { i++; lastEnd = tk[i - 1]; tai = "HAIC"; f.st = "HAIC"; continue; }
        if (t === T_WORD) {
          var wk = s.slice(tb[i], tk[i]);
          e(tb[i], tk[i], '"' + wk + '"', "Thêm nháy cho khoá " + wk);
          lastEnd = tk[i]; i++; tai = "HAIC"; f.st = "HAIC"; continue;
        }
        if (t === T_RB) { ngan.pop(); xongKhoi(i); continue; }
        if (t === T_COMMA) { xoaToken(i, "Bỏ dấu phẩy thừa"); i++; continue; }
        if (t === T_RS) { dongKhongKhop(i); continue; }
        if (t === T_EOF) { chenDongHet(); break; }
        loi(tb[i], "Không mong gặp " + ten(i) + " ở đây (cần khoá hoặc })"); break;
      }

      if (tai === "HAIC") {                               /* sau khoa: can ":" */
        if (t === T_COLON) { lastEnd = tk[i]; i++; tai = "GT"; f.st = "GTRI"; continue; }
        if (t === T_STR || t === T_WORD || t === T_LB || t === T_LS) {
          e(lastEnd, lastEnd, ":", "Thêm dấu hai chấm còn thiếu sau khoá");
          tai = "GT"; f.st = "GTRI"; continue;
        }
        if (t === T_EOF) { loi(den, "Văn bản kết thúc sau một khoá — thiếu dấu hai chấm và giá trị"); break; }
        loi(tb[i], "Khoá chưa có giá trị (gặp " + ten(i) + " thay vì dấu hai chấm)"); break;
      }

      /* tai === "SAU": vua xong mot gia tri */
      if (t === T_COMMA) {
        var j = i + 1;
        while (tt[j] === T_COMMA) { xoaToken(j, "Bỏ dấu phẩy thừa"); j++; }
        var tiep = tt[j];
        if (f && (tiep === T_RB || tiep === T_RS || tiep === T_EOF)) {
          xoaToken(i, "Bỏ dấu phẩy thừa ở cuối");
          i = j;
          continue;                                       /* van tai = SAU: dong / EOF xu ly tiep */
        }
        if (!f) {                                         /* dau phay sau gia tri goc */
          if (tc.gopNhieuGiaTri && (tiep === T_STR || tiep === T_WORD || tiep === T_LB || tiep === T_LS)) { gocCoPhay[soGoc - 1] = true; lastEnd = tk[i]; i = j; tai = "GT"; continue; }
          if (tiep === T_EOF || tiep === T_SEMI || tiep === T_RP) { xoaToken(i, "Bỏ dấu phẩy thừa ở cuối"); i = j; continue; }
          loi(tb[i], "Có nhiều giá trị ở gốc — JSON chỉ cho phép một", { nhieuGiaTri: true }); break;
        }
        lastEnd = tk[i]; i = j;
        tai = f.t === "o" ? "KHOA" : "GT";
        f.st = f.t === "o" ? "KHOA" : "GTRI";
        continue;
      }
      if (t === T_RB || t === T_RS) {
        if (f && ((t === T_RB) === (f.t === "o"))) { ngan.pop(); xongKhoi(i); continue; }
        dongKhongKhop(i); continue;
      }
      if (t === T_EOF) { chenDongHet(); break; }
      if (t === T_STR || t === T_WORD || t === T_LB || t === T_LS) {
        if (f) {                                          /* thieu dau phay giua hai muc */
          e(lastEnd, lastEnd, ",", "Thêm dấu phẩy còn thiếu");
          tai = f.t === "o" ? "KHOA" : "GT";
          f.st = f.t === "o" ? "KHOA" : "GTRI";
          continue;
        }
        if (tc.gopNhieuGiaTri) { tai = "GT"; continue; }
        loi(tb[i], "Có nhiều giá trị ở gốc (giá trị thứ " + (soGoc + 1) + ") — JSON chỉ cho phép một", { nhieuGiaTri: true }); break;
      }
      if (!f && (t === T_RP || t === T_SEMI)) {           /* duoi cua bao boc */
        if (t === T_RP && boc === "jsonp") { xoaToken(i, "Bỏ dấu ) đóng lời gọi JSONP"); i++; boc = "jsonp-xong"; continue; }
        if (t === T_SEMI && (boc === "bien" || boc === "jsonp-xong" || boc === "jsonp")) { xoaToken(i, "Bỏ dấu ; thừa"); i++; continue; }
        if (t === T_SEMI) { xoaToken(i, "Bỏ dấu ; thừa"); i++; continue; }
        loi(tb[i], "Dấu ) thừa ở cuối văn bản"); break;
      }
      loi(tb[i], "Không mong gặp " + ten(i) + " ở đây"); break;
    }

    /* ---- cac ham phu dung chung (hoisting) ---- */
    function xongKhoi(j) {                                /* vua pop mot khung va doc dau dong tai j */
      lastEnd = tk[j]; i = j + 1;
      if (ngan.length) { ngan[ngan.length - 1].st = "SAU"; } else { soGoc++; gocKetThuc.push(tk[j]); }
      tai = "SAU";
    }
    function dongKhongKhop(j) {                           /* dong khong khop khung tren cung */
      var loaiDong = tt[j] === T_RB ? "o" : "a", k, tim = -1;
      for (k = ngan.length - 1; k >= 0; k--) if (ngan[k].t === loaiDong) { tim = k; break; }
      if (tim < 0) {
        e(tb[j], tk[j], "", "Bỏ dấu " + (tt[j] === T_RB ? "}" : "]") + " thừa" + (ngan.length ? " (đang mở " + (ngan[ngan.length - 1].t === "o" ? "{" : "[") + " — có thể gõ nhầm loại ngoặc, hãy kiểm tra)" : ""), ngan.length > 0);
        i = j + 1;
        return;
      }
      if (!chenDong(lastEnd, tim + 1)) { loi(tb[j], "Dấu " + s.charAt(tb[j]) + " đóng sớm khi một khoá chưa có giá trị"); return; }
      ngan.length = tim + 1;
      ngan.pop();
      xongKhoi(j);
    }
    function chenDongHet() {
      var habanDau = ngan.length;
      if (!chenDong(lastEnd, 0)) { loi(den, "Văn bản kết thúc khi một khoá còn thiếu giá trị"); return; }
      ngan.length = 0;
      if (habanDau > 0) { soGoc++; gocKetThuc.push(lastEnd); }
      tai = "XONG";
    }
    return ketThuc();

    function ketThuc() {
      if (!loiNgu && soGoc > 1 && tc.gopNhieuGiaTri) {
        /* nhieu gia tri o goc -> mang: chen "[" dau, "," giua (neu chua co dau phay), "]" cuoi */
        e(gocBd, gocBd, "[", "Gộp " + soGoc + " giá trị gốc thành một mảng (mở)");
        for (var q = 0; q < gocKetThuc.length - 1; q++) {
          if (!gocCoPhay[q]) e(gocKetThuc[q], gocKetThuc[q], ",", "Thêm dấu phẩy giữa các giá trị gốc");
        }
        e(gocKetThuc[gocKetThuc.length - 1], gocKetThuc[gocKetThuc.length - 1], "]", "Gộp các giá trị gốc thành một mảng (đóng)");
      }
      var ds = sapXep(E);
      var vanBan = ap(s, ds), conLoi = null, cb = 0, dong = 1, dauDong = 0, nl2 = s.indexOf("\n");
      var duaRa = ds;                                   /* dung lai chinh doi tuong sua (tranh 220 000 doi tuong moi cho GC) */
      for (var di = 0; di < ds.length; di++) {
        var x = ds[di];
        while (nl2 >= 0 && nl2 < x.bd) { dong++; dauDong = nl2 + 1; nl2 = s.indexOf("\n", dauDong); }
        if (x.canhBao) cb++;
        x.dong = dong; x.cot = x.bd - dauDong + 1;
      }
      if (loiNgu) {
        var dg2 = dongCot(s, Math.min(loiNgu.pos, s.length));
        conLoi = { dong: dg2.dong, cot: dg2.cot, viTri: loiNgu.pos, thongBao: loiNgu.tb, trongBanGoc: true };
        if (loiNgu.nhieuGiaTri) conLoi.nhieuGiaTri = true;
      } else {
        try { JSON.parse(vanBan); }
        catch (e2) {
          var p = viTriTuLoi(e2, vanBan), dg3 = dongCot(vanBan, p);
          conLoi = { dong: dg3.dong, cot: dg3.cot, viTri: p, thongBao: "Còn lỗi sau khi sửa: " + String(e2.message).slice(0, 120), trongBanGoc: false };
        }
      }
      return { vanBan: vanBan, sua: duaRa, conLoi: conLoi, soCanhBao: cb };
    }
  }

  JE.suaJson = { sua: sua, ap: ap, dongCot: dongCot };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.suaJson;
});
