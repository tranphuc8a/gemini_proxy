/* Tô màu cú pháp C/C++/JavaScript (đủ dùng cho khoá học, không phải trình phân tích đầy đủ) → HTML đã thoát.
   TH.tomau.html(code, ngon) — ngon: "cpp" | "c" | "js" | khác (chỉ thoát HTML). Dùng chung cho khối mã trong bài và trình soạn thảo. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var esc = (TH.tienIch || (typeof require !== "undefined" ? require("../core/tien-ich.js") : null)).esc;

  var KW_C = "alignas alignof asm auto break case catch class const constexpr continue decltype default delete do else enum explicit extern for friend goto if inline namespace new noexcept operator private protected public register return sizeof static static_assert struct switch template this throw try typedef typename union using virtual volatile while override final nullptr true false";
  var TY_C = "void bool char short int long float double signed unsigned size_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t string vector map set unordered_map unordered_set pair queue deque stack priority_queue array tuple optional bitset mt19937 mt19937_64 FILE";
  var KW_JS = "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await true false null undefined";
  var TY_JS = "Array Object Math Number String Map Set JSON Date Infinity NaN BigInt Symbol Promise Float64Array Int32Array Uint8Array Uint32Array Int8Array";

  function tap(s) { var o = {}; s.split(" ").forEach(function (w) { o[w] = 1; }); return o; }
  var NGON = {
    cpp: { kw: tap(KW_C), ty: tap(TY_C), pre: true },
    c: { kw: tap(KW_C), ty: tap(TY_C), pre: true },
    js: { kw: tap(KW_JS), ty: tap(TY_JS), pre: false }
  };
  NGON["c++"] = NGON.cpp; NGON.javascript = NGON.js; NGON.h = NGON.cpp;

  /* Thứ tự nhánh quan trọng: chú thích và chuỗi trước, rồi tiền xử lý, số, định danh. */
  function tao(coPre, coTemplate) {
    return new RegExp(
      "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$))" +                         /* 1 chú thích */
      "|(\"(?:\\\\.|[^\"\\\\\\n])*\"?|'(?:\\\\.|[^'\\\\\\n])*'?" + (coTemplate ? "|`(?:\\\\[\\s\\S]|[^`\\\\])*`?" : "") + ")" + /* 2 chuỗi */
      (coPre ? "|(^[ \\t]*#[ \\t]*\\w+(?:[ \\t]*<[^>\\n]*>)?)" : "|()") +         /* 3 tiền xử lý */
      "|(\\b(?:0[xX][0-9a-fA-F']+|\\d[\\d']*(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)[uUlLfF]*\\b)" + /* 4 số */
      "|([A-Za-z_$][\\w$]*)",                                                  /* 5 định danh */
      "gm");
  }
  var RE = { cpp: tao(true, false), js: tao(false, true) };

  function html(code, ngon) {
    code = String(code == null ? "" : code);
    var cfg = NGON[String(ngon || "").toLowerCase()];
    if (!cfg) return esc(code);
    var re = RE[cfg.pre ? "cpp" : "js"], out = "", last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      var t = m[0], cls = null;
      if (m[1]) cls = "t-com";
      else if (m[2]) cls = "t-str";
      else if (m[3]) cls = "t-pre";
      else if (m[4]) cls = "t-num";
      else if (m[5]) {
        if (cfg.kw[t]) cls = "t-kw";
        else if (cfg.ty[t]) cls = "t-ty";
        else if (code.charAt(re.lastIndex) === "(" ) cls = "t-fn";
      }
      out += cls ? '<span class="' + cls + '">' + esc(t) + "</span>" : esc(t);
      last = re.lastIndex;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + esc(code.slice(last));
  }

  TH.tomau = { html: html };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.tomau;
})(typeof globalThis !== "undefined" ? globalThis : this);
