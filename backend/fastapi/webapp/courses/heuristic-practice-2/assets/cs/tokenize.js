/* ==========================================================================
   FILE SINH RA - DUNG SUA O DAY.
   Nguon that: tranphuc8a/code-studio/assets/core/tokenize.js
   Sua o do roi chay: python tranphuc8a/code-studio/sync.py
   ========================================================================== */
/* tokenize.js — bộ tách từ tố cho mọi ngôn ngữ của Code Studio (dùng chung cho tô màu, định dạng, gợi ý, khớp ngoặc).
   Thuần, không DOM. CS.tokenize.run(text, langId) → [{k, v, i}], k ∈
     ws nl id kw ty nu st cm pp an rx op pn  (+ html: tg at ; css/json/md dùng lại các loại trên)
   Mọi ký tự của `text` nằm trong đúng một từ tố (nối các `v` lại ra đúng `text`) — bất biến này được kiểm trong kiem.js.
   CS.tokenize.html(text, langId) → HTML đã thoát, từ tố đáng màu bọc trong <i class="t-xx">. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var OPS_BASE = "<<= >>= ... ->* <=> :: -> ++ -- << >> <= >= == != && || += -= *= /= %= &= |= ^= .*".split(" ");
  var OPS_EXTRA = {
    java: [">>>=", ">>>", "->", "::"], csharp: ["=>", "??", "??=", "?."], kotlin: ["=>", "?.", "?:", "!!", "..", "..<"],
    javascript: [">>>=", ">>>", "===", "!==", "**", "**=", "=>", "?.", "??", "??=", "&&=", "||="], typescript: [">>>=", ">>>", "===", "!==", "**", "**=", "=>", "?.", "??", "??=", "&&=", "||="],
    python: ["**", "//", "**=", "//=", ":=", "->", "@="], go: [":=", "<-", "&^", "&^="], rust: ["=>", "..", "..=", "::"], php: ["===", "!==", "=>", "**", "?->", ".=", "??", "??="],
    ruby: ["===", "=~", "!~", "..", "&.", "=>"], sql: ["<>", "||"], bash: [";;", "<<<", "&>"]
  };
  var OPS_DROP = {
    javascript: ["->", "->*", "<=>", ".*", "::"], typescript: ["->", "->*", "<=>", ".*", "::"], python: ["->*", "<=>", ".*", "::", "++", "--"], go: ["->", "->*", "<=>", ".*", "::"],
    rust: ["->*", "<=>", ".*", "++", "--"], java: ["->*", "<=>", ".*"], csharp: ["->*", "<=>", ".*", "::"], kotlin: ["->*", "<=>", ".*"], php: ["->*", ".*", "<=>"], ruby: ["->*", ".*", "++", "--", "::"], sql: ["->*", "<=>", ".*", "::", "++", "--"], bash: ["->*", "<=>", ".*", "::", "++"]
  };
  var opCache = Object.create(null);
  function opsFor(id) {
    if (opCache[id]) return opCache[id];
    var drop = {}, out = [];
    (OPS_DROP[id] || []).forEach(function (o) { drop[o] = 1; });
    OPS_BASE.concat(OPS_EXTRA[id] || []).forEach(function (o) { if (!drop[o] && out.indexOf(o) === -1) out.push(o); });
    out.sort(function (a, b) { return b.length - a.length; });
    return (opCache[id] = out);
  }

  var RE_WS = /[ \t\r\f\v]+/y;
  var RE_ID = /[A-Za-z_$À-￿][\w$À-￿]*/y;
  var RE_NUM = /(?:0[xX][0-9a-fA-F_']+|0[bB][01_']+|(?:\d[\d_']*\.?[\d_']*|\.\d[\d_']*)(?:[eE][+-]?\d+)?)[uUlLfFdDmMzZ]*/y;
  var RE_RX = /\/(?![*\/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\\\n\[])+\/[a-z]*/y;
  var RE_ANNO = /@[A-Za-z_][\w.]*/y;
  var RE_RS_CHAR = /'(?:\\.[^']*|[^'\\\n])'/y;
  var RE_STRPFX = /^(?:[rRbBfFuUL]{1,2}|u8R?)$/;
  var RE_ID_CSS = /-{0,2}[A-Za-z_À-￿][\wÀ-￿-]*/y;

  function match(re, s, pos) { re.lastIndex = pos; var m = re.exec(s); return m ? m[0] : null; }

  /** Từ tố có kết thúc một toán hạng không (để phân biệt `/` chia với mở regex, `-` trừ với dấu âm …). */
  function operandEnd(t) {
    if (!t) return false;
    if (t.k === "id" || t.k === "nu" || t.k === "st" || t.k === "ty" || t.k === "rx") return true;
    if (t.k === "kw") return t.v === "this" || t.v === "true" || t.v === "false" || t.v === "null" || t.v === "nullptr" || t.v === "self" || t.v === "None" || t.v === "True" || t.v === "False";
    if (t.k === "pn") return t.v === ")" || t.v === "]" || t.v === "}";
    if (t.k === "op") return t.v === "++" || t.v === "--";
    return false;
  }

  function scanString(s, i, q, esc, multi) {
    var n = s.length, j = i + 1;
    while (j < n) {
      var c = s.charAt(j);
      if (esc && c === "\\") { j += 2; continue; }
      if (c === q) return j + 1;
      if (c === "\n" && !multi) return j;
      j++;
    }
    return n;
  }

  /* ---------- họ C / Python / shell / sql (có thể tuỳ biến bằng cờ trong langs.js) ---------- */
  function runGeneric(text, L) {
    var out = [], n = text.length, i = 0, last = null, lineStart = true, id = L.id, css = L.family === "css";
    var ops = opsFor(id), hash = !!L.hash, dash = !!L.dash, lineSlash = L.family === "c", blockSlash = L.family === "c" || css;
    var tri = L.tri || id === "java" || id === "kotlin" || id === "csharp" || id === "python";
    function push(k, v) { var t = { k: k, v: v, i: i }; out.push(t); i += v.length; if (k !== "ws" && k !== "cm") last = t; if (k === "nl") lineStart = true; else if (k !== "ws") lineStart = false; }
    while (i < n) {
      var c = text.charAt(i), ws, m, j;
      if (c === "\n") { push("nl", "\n"); continue; }
      if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") { push("ws", match(RE_WS, text, i)); continue; }
      if (L.pp && c === "#" && lineStart) {                        /* tiền xử lý: tới hết dòng, có dấu \ nối dòng */
        j = i; while (j < n && text.charAt(j) !== "\n") { if (text.charAt(j) === "\\" && text.charAt(j + 1) === "\n") j++; else if (text.charAt(j) === "\\" && text.charAt(j + 1) === "\r" && text.charAt(j + 2) === "\n") j += 2; j++; }
        push("pp", text.slice(i, j)); continue;
      }
      if (lineSlash && c === "/" && text.charAt(i + 1) === "/") { j = text.indexOf("\n", i); push("cm", text.slice(i, j < 0 ? n : j)); continue; }
      if ((blockSlash || dash) && c === "/" && text.charAt(i + 1) === "*") { j = text.indexOf("*/", i + 2); push("cm", text.slice(i, j < 0 ? n : j + 2)); continue; }
      if (dash && c === "-" && text.charAt(i + 1) === "-") { j = text.indexOf("\n", i); push("cm", text.slice(i, j < 0 ? n : j)); continue; }
      if (hash && c === "#" && !(id === "php" && text.charAt(i + 1) === "[")) { j = text.indexOf("\n", i); push("cm", text.slice(i, j < 0 ? n : j)); continue; }
      if (id === "ruby" && c === "=" && lineStart && text.substr(i, 6) === "=begin") { j = text.indexOf("\n=end", i); push("cm", text.slice(i, j < 0 ? n : j + 5)); continue; }
      if (id === "php" && c === "/" && text.charAt(i + 1) === "/") { j = text.indexOf("\n", i); push("cm", text.slice(i, j < 0 ? n : j)); continue; }
      if (id === "csharp" && c === "@" && text.charAt(i + 1) === '"') {          /* chuỗi nguyên văn @"…" ("" là dấu nháy) */
        j = i + 2; while (j < n) { if (text.charAt(j) === '"') { if (text.charAt(j + 1) === '"') { j += 2; continue; } j++; break; } j++; }
        push("st", text.slice(i, j)); continue;
      }
      if (css && (c === "#" || c === "." || c === "@") && /[A-Za-z0-9_-]/.test(text.charAt(i + 1)) && !(c === "." && /[0-9]/.test(text.charAt(i + 1)))) {
        var cm = /[#.@][\w-]+/y; cm.lastIndex = i; var cw = cm.exec(text)[0];
        push(c === "@" ? "an" : (c === "#" && /^#[0-9a-fA-F]{3,8}$/.test(cw) ? "nu" : "ty"), cw); continue;
      }
      /* chuỗi */
      if (c === '"' || c === "'" || c === "`") {
        if (c === "`" && !(L.tpl || id === "go" || id === "bash" || id === "sql" || id === "kotlin")) { push("op", c); continue; }
        if (c === "'" && id === "rust") { m = match(RE_RS_CHAR, text, i); if (m) { push("st", m); continue; } push("an", "'"); continue; }
        if (c === "'" && id === "sql") { j = scanString(text, i, "'", false, true); push("st", text.slice(i, j)); continue; }
        if (tri && text.substr(i, 3) === c + c + c) { j = text.indexOf(c + c + c, i + 3); push("st", text.slice(i, j < 0 ? n : j + 3)); continue; }
        var multi = c === "`" || id === "bash" || id === "ruby" || id === "php" || id === "sql";
        var escQ = !(c === "`" && id === "go") && !(id === "bash" && c === "'");
        j = scanString(text, i, c, escQ, multi);
        push("st", text.slice(i, j)); continue;
      }
      /* số */
      if ((c >= "0" && c <= "9") || (c === "." && text.charAt(i + 1) >= "0" && text.charAt(i + 1) <= "9" && !operandEnd(last))) {
        m = match(RE_NUM, text, i);
        if (m) { if (css) { var un = /%|[A-Za-z]+/y; un.lastIndex = i + m.length; var um = un.exec(text); if (um) m += um[0]; } push("nu", m); continue; }
      }
      /* định danh / từ khoá */
      if ((css ? /[A-Za-z_À-￿]/ : /[A-Za-z_$À-￿]/).test(c) || (css && c === "-" && /[A-Za-z_-]/.test(text.charAt(i + 1)))) {
        var w = match(css ? RE_ID_CSS : RE_ID, text, i);
        if (w === null) { push("op", c); continue; }              /* vd '--)' trong CSS: gạch ngang không mở tên */
        var nx = text.charAt(i + w.length);
        if ((nx === '"' || nx === "'") && RE_STRPFX.test(w) && (id === "python" || id === "cpp" || id === "c")) {   /* tiền tố chuỗi: r"" b"" f"" L"" u8"" */
          if (id === "cpp" && /R$/.test(w) && nx === '"') {            /* raw string R"d( … )d" */
            var open = text.indexOf("(", i + w.length), delim = open > 0 ? text.slice(i + w.length + 1, open) : null;
            if (delim !== null && delim.length <= 16 && !/[\s\\()]/.test(delim)) { j = text.indexOf(")" + delim + '"', open); push("st", text.slice(i, j < 0 ? n : j + delim.length + 2)); continue; }
          }
          if (tri && text.substr(i + w.length, 3) === nx + nx + nx) { j = text.indexOf(nx + nx + nx, i + w.length + 3); push("st", text.slice(i, j < 0 ? n : j + 3)); continue; }
          j = scanString(text, i + w.length, nx, !/[rR]/.test(w) && !/@/.test(w), false);
          push("st", text.slice(i, j)); continue;
        }
        var ww = L.ci ? w.toLowerCase() : w;
        var kind = L.kwSet[ww] ? "kw" : L.tySet[ww] ? "ty" : "id";
        if (id === "ruby" && (nx === "?" || nx === "!") && text.charAt(i + w.length + 1) !== "=") w += nx;
        if (id === "php" && w.charAt(0) === "$") kind = "id";
        push(kind, w); continue;
      }
      if (c === "@" && (L.anno || (id === "python" && lineStart))) { m = match(RE_ANNO, text, i); if (m) { push("an", m); continue; } }
      if (c === "$" && id === "bash") { m = /\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|[0-9@#?$!*-])/y; m.lastIndex = i; var mm = m.exec(text); if (mm) { push("id", mm[0]); continue; } }
      /* regex literal của JS/TS */
      if (L.regex && c === "/" && !operandEnd(last)) { m = match(RE_RX, text, i); if (m) { push("rx", m); continue; } }
      /* ký hiệu */
      if ("(){}[],;".indexOf(c) >= 0) { push("pn", c); continue; }
      var hit = null;
      for (var q = 0; q < ops.length; q++) { var o = ops[q]; if (text.substr(i, o.length) === o) { hit = o; break; } }
      push("op", hit || c);
    }
    return out;
  }

  /* ---------- HTML ---------- */
  function runHtml(text) {
    var out = [], n = text.length, i = 0;
    function push(k, v) { out.push({ k: k, v: v, i: i }); i += v.length; }
    while (i < n) {
      var c = text.charAt(i), j;
      if (c === "<" && text.substr(i, 4) === "<!--") { j = text.indexOf("-->", i + 4); push("cm", text.slice(i, j < 0 ? n : j + 3)); continue; }
      if (c === "<" && /[A-Za-z\/!?]/.test(text.charAt(i + 1))) {
        var m = /<\/?[A-Za-z][\w:-]*|<![A-Za-z]+|<\?[A-Za-z]*/y; m.lastIndex = i; var mm = m.exec(text);
        if (!mm) { push("id", c); continue; }
        push("tg", mm[0]);
        var isRaw = /^<(script|style)$/i.test(mm[0]) ? mm[0].slice(1).toLowerCase() : null;
        while (i < n) {                                               /* trong thẻ: thuộc tính tới dấu > */
          var d = text.charAt(i);
          if (d === ">") { push("tg", ">"); break; }
          if (d === "/" && text.charAt(i + 1) === ">") { push("tg", "/>"); break; }
          if (d === "\n") { push("nl", "\n"); continue; }
          if (/\s/.test(d)) { var w = /[^\S\n]+/y; w.lastIndex = i; push("ws", w.exec(text)[0]); continue; }
          if (d === '"' || d === "'") { j = scanString(text, i, d, false, true); push("st", text.slice(i, j)); continue; }
          var a = /[^\s=>"'\/]+/y; a.lastIndex = i; var am = a.exec(text);
          if (am) { push("at", am[0]); continue; }
          push("op", d);
        }
        if (isRaw && i <= n) {                                        /* nội dung <script>/<style>: tô như JS/CSS */
          var endRe = new RegExp("</" + isRaw, "i"), rest = text.slice(i), e = rest.search(endRe), body = e < 0 ? rest : rest.slice(0, e);
          if (body) { var inner = run(body, isRaw === "script" ? "javascript" : "css"); inner.forEach(function (t) { out.push({ k: t.k, v: t.v, i: i + t.i }); }); i += body.length; }
        }
        continue;
      }
      j = i; while (j < n && text.charAt(j) !== "<") j++;
      if (j === i) j = i + 1;
      var seg = text.slice(i, j), parts = seg.split("\n");
      parts.forEach(function (p, idx) { if (idx) push("nl", "\n"); if (p) push(/^\s+$/.test(p) ? "ws" : "id", p); });
    }
    return out;
  }

  /* ---------- CSS ---------- */
  /* runGeneric đã gom .lớp #id @quy-tắc, màu #hex và số kèm đơn vị; ở đây chỉ phân biệt thuộc tính / bộ chọn theo độ sâu ngoặc. */
  function runCss(text, L) {
    var toks = runGeneric(text, L), depth = 0, paren = 0;
    for (var a = 0; a < toks.length; a++) {
      var t = toks[a];
      if (t.k === "pn" && t.v === "{") depth++;
      else if (t.k === "pn" && t.v === "}") depth = Math.max(0, depth - 1);
      else if (t.k === "pn" && t.v === "(") paren++;
      else if (t.k === "pn" && t.v === ")") paren = Math.max(0, paren - 1);
      else if ((t.k === "id" || t.k === "kw" || t.k === "ty") && !paren) {
        var b = a + 1; while (b < toks.length && toks[b].k === "ws") b++;
        if (depth > 0 && toks[b] && toks[b].v === ":") t.k = "kw";   /* thuộc tính */
        else if (depth === 0) t.k = "ty";                              /* bộ chọn */
      }
    }
    return toks;
  }

  /* ---------- JSON ---------- */
  function runJson(text, L) {
    var toks = runGeneric(text, { id: "json", family: "json", kwSet: L.kwSet, tySet: L.tySet, tri: false }), out = [];
    for (var a = 0; a < toks.length; a++) {
      var t = toks[a];
      if (t.k === "st") { var b = a + 1; while (b < toks.length && toks[b].k === "ws") b++; if (toks[b] && toks[b].v === ":") t = { k: "at", v: t.v, i: t.i }; }
      out.push(t);
    }
    return out;
  }

  /* ---------- Markdown (tô theo dòng) ---------- */
  function runMd(text) {
    var out = [], lines = text.split("\n"), i = 0, fence = false;
    lines.forEach(function (ln, idx) {
      if (idx) { out.push({ k: "nl", v: "\n", i: i }); i += 1; }
      if (ln) {
        var k = "id";
        if (/^\s*(```|~~~)/.test(ln)) { fence = !fence; k = "st"; }
        else if (fence) k = "st";
        else if (/^#{1,6}\s/.test(ln)) k = "kw";
        else if (/^\s*([-*+]|\d+\.)\s/.test(ln)) k = "id";
        else if (/^\s*>/.test(ln)) k = "cm";
        out.push({ k: k, v: ln, i: i }); i += ln.length;
      }
    });
    return out;
  }

  function run(text, langId) {
    text = String(text == null ? "" : text);
    var L = CS.langs.get(langId);
    switch (L.family) {
      case "html": return runHtml(text);
      case "css": return runCss(text, L);
      case "json": return runJson(text, L);
      case "md": return runMd(text);
      case "plain": { var out = [], i = 0; text.split("\n").forEach(function (ln, idx) { if (idx) { out.push({ k: "nl", v: "\n", i: i }); i++; } if (ln) { out.push({ k: "id", v: ln, i: i }); i += ln.length; } }); return out; }
      default: return runGeneric(text, L);
    }
  }

  var CLS = { kw: "t-kw", ty: "t-ty", st: "t-st", nu: "t-nu", cm: "t-cm", pp: "t-pp", an: "t-an", rx: "t-st", tg: "t-tg", at: "t-at", fn: "t-fn", bi: "t-bi" };
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /** HTML đã thoát; thêm 'fn' (định danh đứng trước "(") và 'bi' (hàm/ký hiệu có sẵn của ngôn ngữ) cho dễ đọc. */
  function html(text, langId) { return htmlFromTokens(run(text, langId), langId); }
  /** Như html() nhưng dùng lại từ tố đã tách (trình soạn tách một lần, dùng cho cả tô màu lẫn khớp ngoặc). */
  function htmlFromTokens(toks, langId) {
    var L = CS.langs.get(langId), parts = [];
    var callable = L.family === "c" || L.family === "py" || L.family === "sh" || L.family === "sql";
    for (var a = 0; a < toks.length; a++) {
      var t = toks[a], k = t.k;
      if (k === "id" && callable) {
        var nx = toks[a + 1];
        if (nx && nx.v === "(") k = "fn";
        else if (L.biSet[t.v] && !(L.kwSet[t.v] || L.tySet[t.v])) k = "bi";
      }
      var cls = CLS[k];
      parts.push(cls ? '<i class="' + cls + '">' + esc(t.v) + "</i>" : esc(t.v));
    }
    return parts.join("");
  }

  CS.tokenize = { run: run, html: html, htmlFromTokens: htmlFromTokens, operandEnd: operandEnd, esc: esc, opsFor: opsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.tokenize;
})(typeof globalThis !== "undefined" ? globalThis : this);
