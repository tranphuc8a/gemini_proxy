/* =====================================================================
   dinh-dang.js — dinh dang va CHUOI long nhau. THUAN (khong DOM).

     JE.dinhDang.thutTu(kieu)        "2" | "4" | "tab" (hoac so / "\t") -> 2 | 4 | "\t"   (mac dinh 2)
     JE.dinhDang.dongChuoi(s)        -> JSON.stringify(s)             ("Đóng thành chuỗi")
     JE.dinhDang.goChuoi(s)          -> {ok: true, ketQua} | {ok: false, loi}
         go MOT lop: nhan  "…"  (chuoi JSON hop le)  hoac  noi dung chuoi thieu nhay ngoai  {\"a\":1}
         (chep tu log): khong nhay chua duoc tho thi coi nhu khong phai noi dung chuoi.
     JE.dinhDang.giaiChuoiLong(chuoi) -> gia tri (object / mang) neu chuoi la JSON object / mang, nguoc lai undefined
     JE.dinhDang.dongGoiLong(v, thut) -> chuoi JSON cua v (nen neu thut = 0)
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  function thutTu(kieu) {
    if (kieu === "tab" || kieu === "\t") return "\t";
    var n = Number(kieu);
    return n === 4 ? 4 : 2;
  }

  function dongChuoi(s) { return JSON.stringify(String(s)); }

  /** Noi dung chuoi co nhay kep THO (khong thoat) nao khong? Lap, tuyen tinh. */
  function coNhayTho(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 92) { i++; continue; }
      if (c === 34) return true;
    }
    return false;
  }

  function goChuoi(s) {
    var t = String(s).trim();
    if (t === "") return { ok: false, loi: "Không có gì để gỡ" };
    var v;
    try { v = JSON.parse(t); if (typeof v === "string") return { ok: true, ketQua: v }; }
    catch (e) { v = undefined; }
    if (v !== undefined) return { ok: false, loi: "Nội dung không phải một chuỗi — không có lớp nào để gỡ" };
    if (!coNhayTho(t)) {
      try { var r = JSON.parse('"' + t + '"'); if (typeof r === "string") return { ok: true, ketQua: r }; }
      catch (e2) { /* khong phai noi dung chuoi hop le */ }
    }
    return { ok: false, loi: "Không gỡ được — nội dung không phải chuỗi JSON hợp lệ" };
  }

  function giaiChuoiLong(chuoi) {
    if (typeof chuoi !== "string") return undefined;
    var t = chuoi.trim(), c = t.charAt(0), d = t.charAt(t.length - 1);
    if (!((c === "{" && d === "}") || (c === "[" && d === "]"))) return undefined;
    try { var v = JSON.parse(t); return v !== null && typeof v === "object" ? v : undefined; }
    catch (e) { return undefined; }
  }

  function dongGoiLong(v, thut) {
    var t = JSON.stringify(v, null, thut === undefined ? 0 : thut);
    return t === undefined ? "null" : t;
  }

  JE.dinhDang = { thutTu: thutTu, dongChuoi: dongChuoi, goChuoi: goChuoi, giaiChuoiLong: giaiChuoiLong, dongGoiLong: dongGoiLong };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.dinhDang;
});
