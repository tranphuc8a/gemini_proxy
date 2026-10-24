/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* markdown.js — Markdown → HTML AN TOÀN, tự viết, không thư viện.

   An toàn bằng cấu trúc, không bằng "lọc sau": mọi chữ đều đi qua esc(); HTML thô trong nội dung KHÔNG được hiểu (hiện nguyên văn);
   địa chỉ liên kết chỉ nhận http(s)/mailto/tel/tương đối; ảnh chỉ nhận https hoặc data:image/(png|jpeg|gif|webp). Không bao giờ gán handler hay style từ nội dung.

   Hỗ trợ: # tiêu đề, **đậm**, *nghiêng*, ~~gạch~~, `code`, ``` khối code (có ngôn ngữ), danh sách (-, *, +, 1.) lồng nhau, danh sách việc (- [ ] / - [x]),
   > trích dẫn, bảng (GFM), --- đường kẻ, [chữ](url), ![ảnh](url), tự nhận http://…, [[liên kết wiki]], thẻ ôn "Q: … / A: …".
   Xuống dòng đơn được GIỮ (<br>) — thói quen ghi chú, không phải quy tắc CommonMark.

   TOÁN (không thư viện): `\(…\)`, `\[…\]`, `$$…$$`, `$…$` (luật pandoc — `$5 và $10` không phải công thức), `\begin{align}…\end{align}` trần ở đầu dòng và
   rào ```math. Công thức được GIỮ NGUYÊN CHỮ trong `data-tex` rồi hiện TeX nguyên văn (kiểu code) làm dự phòng — W6 mới vẽ KaTeX lên các nút
   `.math` (đọc `getAttribute("data-tex")`, KHÔNG đọc innerHTML). Nội dung công thức không bao giờ qua nhấn mạnh/liên kết/escape của markdown
   (`x_1 * x_2`, `\\`, `[[0,1]]` giữ nguyên). Vùng toán theo ĐÚNG luật `notes.js mathRanges` (cũng là luật của compose.js / wiki_links.py).
     <span class="math" data-tex="TeX">TeX</span>        inline                 <span class="math math-d" …>   công thức hiển thị nằm trong dòng
     <div class="math math-d" data-tex="TeX">TeX</div>   khối hiển thị (đứng riêng một dòng / nhiều dòng)
   ```mermaid → <pre class="code mmd" data-lang="mermaid"> (W6 dựng sơ đồ).

   opts: {resolve(title) → {id, status}|null,   // giải [[Tiêu đề]]; null = chưa có note (hiện mờ, bấm để tạo)
          highlight(code, lang) → html|null,    // tô màu code, phải tự thoát HTML
          noLinks: bool}                         // bỏ <a> (khi dựng ảnh/ PDF)  */
(function (root) {
  "use strict";
  var W = root.Algo || (root.Algo = {});
  if (!W.text && typeof require === "function") require("./text.js");
  if (!W.notes && typeof require === "function") require("./notes.js");
  var T = W.text, N = W.notes, esc = T.esc;

  var MAX_DEPTH = 6, MAX_INPUT = 600000;
  var FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+#.\-]*)[^\n]*$/;
  var HEAD_OPEN = /^ {0,3}(#{1,6})[ \t]+/, LINE_END = /[\n\r\u2028\u2029]/;
  var HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  var ITEM = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
  var TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  var Q_LINE = /^\s*Q:\s*(.+)$/i, A_LINE = /^\s*A:\s*(.*)$/i;
  var TEX_LIKE = /[\\^_{}=]/;                                                   // `\[Enter\]` giữa câu không phải toán; `\[ a^2 \]` thì có
  var ENVS = "equation|align|gather|multline|flalign|alignat|eqnarray|split|cases|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|array|CD|aligned|gathered";
  var ENV_OPEN = new RegExp("^ {0,3}\\\\begin\\{((?:" + ENVS + ")\\*?)\\}");  // \begin{ENV} trần ở đầu dòng
  var NO_SPANS = [];

  /** Địa chỉ liên kết an toàn hoặc "" (bị từ chối). */
  function safeUrl(u) {
    u = String(u || "").trim();
    var probe = u.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "").toLowerCase();
    if (!probe) return "";
    var m = /^([a-z][a-z0-9+.\-]*):/.exec(probe);
    if (m && ["http", "https", "mailto", "tel"].indexOf(m[1]) === -1) return "";
    if (probe.indexOf("//") === 0) return "";            // địa chỉ "cùng giao thức" dễ nhầm với tên miền lạ
    return u.slice(0, 2000);
  }
  function safeImg(u) {
    u = String(u || "").trim();
    var probe = u.replace(/[\u0000-\u0020]/g, "").toLowerCase();
    if (/^https:\/\//.test(probe) || /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/.test(probe)) return u.slice(0, 2000000);
    return "";
  }
  function attrUrl(u) { return esc(u); }

  // ----------------------------------------------------------------------------------------------- to\u00E1n
  /** C\u00F4ng th\u1EE9c \u2192 HTML. TeX gi\u1EEF nguy\u00EAn ch\u1EEF (ch\u1EC9 c\u1EAFt kho\u1EA3ng tr\u1EAFng hai \u0111\u1EA7u); esc() cho C\u1EA2 thu\u1ED9c t\u00EDnh data-tex l\u1EABn ch\u1EEF d\u1EF1 ph\u00F2ng (ch\u1EB7n tho\u00E1t kh\u1ECFi d\u1EA5u ngo\u1EB7c k\u00E9p).
      Xu\u1ED1ng d\u00F2ng \u2192 `&#10;`: \u0111o\u1EA1n v\u0103n/m\u1EE5c danh s\u00E1ch \u0111\u1ED5i "\n" th\u00E0nh <br> tr\u00EAn HTML \u0111\u00E3 d\u1EF1ng (k\u1EC3 c\u1EA3 b\u00EAn trong thu\u1ED9c t\u00EDnh!), c\u00F2n getAttribute gi\u1EA3i m\u00E3 `&#10;` v\u1EC1 "\n". */
  function mathHtml(tex, display, block) {
    var t = esc(String(tex).trim()).replace(/\n/g, "&#10;");
    return block ? '<div class="math math-d" data-tex="' + t + '">' + t + "</div>"
      : '<span class="math' + (display ? " math-d" : "") + '" data-tex="' + t + '">' + t + "</span>";
  }
  function notBlank(s) { return /\S/.test(s); }

  /** C\u00E1c v\u00F9ng to\u00E1n INLINE c\u1EE7a m\u1ED9t \u0111o\u1EA1n \u2192 [{a, b, html}] theo th\u1EE9 t\u1EF1, kh\u00F4ng ch\u1ED3ng l\u1EA5n. V\u00F9ng = notes.js mathRanges (code \u0111\u00E3 che); r\u1ED3i l\u1ECDc theo lu\u1EADt hi\u1EC3n th\u1ECB:
      c\u00F4ng th\u1EE9c r\u1ED7ng th\u00EC \u0111\u1EC3 nguy\u00EAn ch\u1EEF; `\[\u2026\]` GI\u1EEEA C\u00C2U ch\u1EC9 l\u00E0 to\u00E1n khi n\u1ED9i dung gi\u1ED1ng TeX (`B\u1EA5m \[Enter\]` kh\u00F4ng ph\u1EA3i); `\[\u2026\]` v\u00E0 `$$\u2026$$` \u0111\u1EE9ng m\u1ED9t m\u00ECnh
      trong \u0111o\u1EA1n th\u00EC hi\u1EC3n th\u1ECB (math-d), c\u00F2n `$$\u2026$$` gi\u1EEFa c\u00E2u v\u1EABn l\u00E0 inline. M\u1ECDi b\u01B0\u1EDBc tuy\u1EBFn t\u00EDnh (kh\u00F4ng c\u1EAFt \u0111u\u00F4i chu\u1ED7i, kh\u00F4ng trim c\u1EA3 chu\u1ED7i m\u1ED7i v\u00F9ng). */
  function inlineMath(src) {
    if (src.indexOf("$") === -1 && src.indexOf("\\") === -1) return NO_SPANS;
    var rs = N.mathRanges(N.maskCode(src)), out = [];
    if (!rs.length) return NO_SPANS;
    var lo = src.search(/\S/), hi = src.length;
    while (hi > 0 && /\s/.test(src.charAt(hi - 1))) hi--;
    for (var k = 0; k < rs.length; k++) {
      var a = rs[k][0], b = rs[k][1], kind, body;
      if (src.charAt(a) === "\\") { kind = src.charAt(a + 1); body = src.slice(a + 2, b - 2); }          // "(" ho\u1EB7c "["
      else if (src.charAt(a + 1) === "$") { kind = "$$"; body = src.slice(a + 2, b - 2); }
      else { kind = "$"; body = src.slice(a + 1, b - 1); }
      if (!notBlank(body)) continue;
      var alone = a === lo && b === hi;
      if (kind === "[" && !alone && !TEX_LIKE.test(body)) continue;
      out.push({ a: a, b: b, html: mathHtml(body, kind === "[" || (kind === "$$" && alone), false) });
    }
    return out;
  }

  /** D\u00F2ng c\u1EE7a t\u00E0i li\u1EC7u sau r\u00E0o code m\u1EDF \u1EDF d\u00F2ng i (r\u00E0o ch\u01B0a \u0111\u00F3ng th\u00EC t\u1EDBi h\u1EBFt). */
  function fenceEnd(lines, i, fence) {
    var close = new RegExp("^ {0,3}" + fence.charAt(0) + "{" + fence.length + ",}[ \\t]*$"), n = lines.length;
    i++;
    while (i < n && !close.test(lines[i])) i++;
    return i + 1;
  }
  /** V\u1ECB tr\u00ED c\u1EE7a l\u1EC7nh `token` (b\u1EAFt \u0111\u1EA7u b\u1EB1ng \) t\u1EEB `from`, b\u1ECF qua `\\begin` (d\u1EA5u \ \u0111\u1EE9ng tr\u01B0\u1EDBc ch\u1EB5n m\u1EDBi l\u00E0 l\u1EC7nh). */
  function findCmd(line, token, from) {
    var p = line.indexOf(token, from);
    while (p !== -1) {
      var q = p;
      while (q > 0 && line.charAt(q - 1) === "\\") q--;
      if ((p - q) % 2 === 0) return p;
      p = line.indexOf(token, p + 1);
    }
    return -1;
  }
  /** `\end{name}` kh\u1EDBp (\u0111\u1EBFm l\u1ED3ng) v\u1EDBi `\begin{name}` \u1EDF d\u00F2ng k, t\u00ECm t\u1EEB c\u1ED9t `from` c\u1EE7a d\u00F2ng k; kh\u00F4ng v\u01B0\u1EE3t kh\u1ECFi `parts` (m\u1ED9t \u0111o\u1EA1n, kh\u00F4ng c\u00F3 d\u00F2ng tr\u1ED1ng).
      \u2192 {line, col (sau \end{name})} | null. M\u1ED7i d\u00F2ng ch\u1EC9 t\u00ECm l\u1EA1i c\u00E1i \u0111\u00E3 d\u00F9ng (o, e nh\u1EDB v\u1ECB tr\u00ED k\u1EBF ti\u1EBFp) n\u00EAn tuy\u1EBFn t\u00EDnh. */
  function envEnd(parts, k, name, from) {
    var open = "\\begin{" + name + "}", close = "\\end{" + name + "}", depth = 1;
    for (var j = k; j < parts.length; j++) {
      var ln = parts[j], c = j === k ? from : 0, o = findCmd(ln, open, c), e = findCmd(ln, close, c);
      while (o !== -1 || e !== -1) {
        if (e !== -1 && (o === -1 || e < o)) {
          if (--depth === 0) return { line: j, col: e + close.length };
          c = e + close.length; e = findCmd(ln, close, c);
        } else { depth++; c = o + open.length; o = findCmd(ln, open, c); }
      }
    }
    return null;
  }
  /** Kh\u1ED1i to\u00E1n hi\u1EC3n th\u1ECB trong m\u1ED9t \u0110O\u1EA0N lines[s, e): {ch\u1EC9 s\u1ED1 d\u00F2ng b\u1EAFt \u0111\u1EA7u \u2192 {end, tex, rest}} c\u1ED9ng v\u00E0o `out`. Kh\u1ED1i b\u1EAFt \u0111\u1EA7u \u1EDF \u0111\u1EA7u d\u00F2ng (th\u1EE5t \u2264 3):
      `$$\u2026$$` / `\[\u2026\]` (nhi\u1EC1u d\u00F2ng \u0111\u01B0\u1EE3c, \u0111\u00F3ng \u1EDF cu\u1ED1i m\u1ED9t d\u00F2ng, kh\u00F4ng v\u01B0\u1EE3t d\u00F2ng tr\u1ED1ng), ho\u1EB7c `\begin{ENV}\u2026\end{ENV}` tr\u1EA7n. */
  function paragraphMath(lines, s, e, out) {
    var parts = lines.slice(s, e), text = parts.join("\n"), offs = new Array(parts.length), o = 0, k;
    for (k = 0; k < parts.length; k++) { offs[k] = o; o += parts[k].length + 1; }
    var rs = N.mathRanges(N.maskCode(text)), r = 0, failEnv = {};
    k = 0;
    while (k < parts.length) {
      var ln = parts[k], ind = 0, m, j;
      while (ind < 4 && ln.charAt(ind) === " ") ind++;
      if (ind > 3) { k++; continue; }
      var p = offs[k] + ind;
      while (r < rs.length && rs[r][1] <= p) r++;
      if (r < rs.length && rs[r][0] < p) { k++; continue; }                   // d\u00F2ng n\u1EB1m gi\u1EEFa m\u1ED9t v\u00F9ng to\u00E1n \u0111\u00E3 m\u1EDF t\u1EEB d\u00F2ng tr\u01B0\u1EDBc
      if (r < rs.length && rs[r][0] === p) {
        var a = rs[r][0], b = rs[r][1], two = text.substr(a, 2);
        if (two === "$$" || two === "\\[") {
          var eol = text.indexOf("\n", b), body = text.slice(a + 2, b - 2);
          if (eol === -1) eol = text.length;
          if (notBlank(body) && !notBlank(text.slice(b, eol))) {              // sau d\u1EA5u \u0111\u00F3ng kh\u00F4ng c\u00F2n ch\u1EEF \u21D2 c\u1EA3 \u0111o\u1EA1n l\u00E0 m\u1ED9t c\u00F4ng th\u1EE9c hi\u1EC3n th\u1ECB
            j = k;
            while (j + 1 < parts.length && offs[j + 1] <= b - 1) j++;
            (out = out || {})[s + k] = { end: s + j, tex: body, rest: "" };
            k = j + 1; continue;
          }
        }
        k++; continue;
      }
      if (ln.charAt(ind) === "\\" && (m = ENV_OPEN.exec(ln)) && !failEnv[m[1]]) {
        var en = envEnd(parts, k, m[1], m[0].length);
        if (!en) { failEnv[m[1]] = true; k++; continue; }                     // kh\u00F4ng c\u00F3 \end: c\u00F9ng t\u00EAn trong \u0111o\u1EA1n n\u00E0y c\u0169ng b\u1ECF (gi\u1EEF tuy\u1EBFn t\u00EDnh)
        (out = out || {})[s + k] = { end: s + en.line, tex: text.slice(offs[k] + ind, offs[en.line] + en.col), rest: parts[en.line].slice(en.col) };
        k = en.line + 1; continue;
      }
      k++;
    }
    return out;
  }
  /** M\u1ECDi kh\u1ED1i to\u00E1n hi\u1EC3n th\u1ECB trong `lines` \u2192 {ch\u1EC9 s\u1ED1 d\u00F2ng b\u1EAFt \u0111\u1EA7u \u2192 {end, tex, rest}} ho\u1EB7c null. B\u1ECF qua r\u00E0o code; chia theo d\u00F2ng tr\u1ED1ng. Tuy\u1EBFn t\u00EDnh. */
  function mathBlocks(lines) {
    var n = lines.length, out = null, i = 0;
    while (i < n) {
      var line = lines[i], fm;
      if (!notBlank(line)) { i++; continue; }
      if ((fm = FENCE.exec(line))) { i = fenceEnd(lines, i, fm[1]); continue; }
      var e = i + 1, hot = line.indexOf("$") !== -1 || line.indexOf("\\") !== -1;
      while (e < n && notBlank(lines[e]) && !FENCE.test(lines[e])) {
        if (!hot && (lines[e].indexOf("$") !== -1 || lines[e].indexOf("\\") !== -1)) hot = true;
        e++;
      }
      if (hot) out = paragraphMath(lines, i, e, out);
      i = e;
    }
    return out;
  }

  // ----------------------------------------------------------------------------------------------- inline
  var PH_OPEN = "\uE000", PH_CLOSE = "\uE001";

  function inline(src, ctx) {
    src = String(src).replace(/[\uE000\uE001]/g, "");
    var out = "", i = 0, n = src.length, ph = [], spans = inlineMath(src), si = 0, ns = spans.length;
    function hold(html) { ph.push(html); return PH_OPEN + (ph.length - 1) + PH_CLOSE; }
    function textUntilSpecial() {
      var j = i;
      while (j < n && "`\\[!h$".indexOf(src.charAt(j)) === -1) j++;
      return j === i ? i + 1 : j;
    }
    while (i < n) {
      if (ns) {                                                                              // c\u00F4ng th\u1EE9c TR\u01AF\u1EDAC m\u1ECDi lu\u1EADt kh\u00E1c: b\u00EAn trong kh\u00F4ng c\u00F3 nh\u1EA5n m\u1EA1nh, li\u00EAn k\u1EBFt, escape
        while (si < ns && spans[si].a < i) si++;
        if (si < ns && spans[si].a === i) { out += hold(spans[si].html); i = spans[si].b; si++; continue; }
      }
      var c = src.charAt(i), m, rest;
      if (c === "\\" && i + 1 < n && /[\\`*_{}\[\]()#+\-.!|~>$]/.test(src.charAt(i + 1))) { out += hold(esc(src.charAt(i + 1))); i += 2; continue; }
      if (c === "`") {
        m = /^(`+)/.exec(src.slice(i));
        var run = m[1], close = src.indexOf(run, i + run.length);
        while (close !== -1 && src.charAt(close + run.length) === "`") close = src.indexOf(run, close + run.length + 1);
        if (close !== -1) { out += hold("<code>" + esc(src.slice(i + run.length, close).replace(/^ (.*[^ ].*) $/, "$1")) + "</code>"); i = close + run.length; continue; }
        out += esc(run); i += run.length; continue;
      }
      rest = src.slice(i);
      if (c === "[" && rest.charAt(1) === "[" && (m = /^\[\[([^\[\]\n]{1,300})\]\]/.exec(rest))) {
        var l = N.parseLinks(m[0])[0];
        if (l) { out += hold(wikiLink(l, ctx)); i += m[0].length; continue; }
      }
      if (c === "!" && rest.charAt(1) === "[" && (m = /^!\[([^\]\n]*)\]\(\s*([^\s)]+)(?:\s+"[^"\n]*")?\s*\)/.exec(rest))) {
        var img = safeImg(m[2]);
        out += hold(img ? '<img src="' + attrUrl(img) + '" alt="' + esc(m[1]) + '" loading="lazy" decoding="async">' : "<span class=\"noimg\">[ảnh: " + esc(m[1] || "không hợp lệ") + "]</span>");
        i += m[0].length; continue;
      }
      if (c === "[" && (m = /^\[((?:[^\[\]\n]|\[[^\[\]\n]*\])*)\]\(\s*([^\s)]+)(?:\s+"[^"\n]*")?\s*\)/.exec(rest))) {
        var url = safeUrl(m[2]);
        if (url && !ctx.noLinks) {
          var ext = /^https?:/i.test(url);
          out += hold('<a href="' + attrUrl(url) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">") + inlineNoLinks(m[1], ctx) + hold("</a>");
        } else out += inlineNoLinks(m[1], ctx);
        i += m[0].length; continue;
      }
      if (c === "h" && (m = /^https?:\/\/[^\s<>"']+/i.exec(rest)) && (i === 0 || /[\s(\[]/.test(src.charAt(i - 1)))) {
        var raw = m[0], tail = /[.,;:!?)\]}'"]+$/.exec(raw);
        if (tail) raw = raw.slice(0, raw.length - tail[0].length);
        var u2 = safeUrl(raw);
        if (u2 && !ctx.noLinks) { out += hold('<a href="' + attrUrl(u2) + '" target="_blank" rel="noopener noreferrer">' + esc(raw) + "</a>"); i += raw.length; continue; }
      }
      var j = textUntilSpecial();
      out += esc(src.slice(i, j));
      i = j;
    }
    // nhấn mạnh trên văn bản đã thoát (các thẻ đã giữ chỗ nên không bị đụng)
    out = out.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>")
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>")
      .replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/g, "$1<em>$2</em>");
    return out.replace(new RegExp(PH_OPEN + "(\\d+)" + PH_CLOSE, "g"), function (_, k) { return ph[+k]; });
  }
  function inlineNoLinks(s, ctx) { return inline(s, { resolve: ctx.resolve, highlight: ctx.highlight, noLinks: true }); }

  function wikiLink(l, ctx) {
    var label = l.alias || l.title, rel = l.type === N.LINK ? "" : ' data-rel="' + esc(l.type) + '"', hit = ctx.resolve ? ctx.resolve(l.title) : null;
    if (ctx.noLinks) return '<span class="wl' + (hit ? "" : " ghost") + '">' + esc(label) + "</span>";
    if (hit) return '<a class="wl' + (hit.status === "trashed" ? " ghost" : "") + '" href="#/a/' + esc(hit.id) + '" data-id="' + esc(hit.id) + '"' + rel + ">" + esc(label) + "</a>";
    return '<a class="wl ghost" href="#/mine/new?name=' + encodeURIComponent(l.title) + '" data-title="' + esc(l.title) + '"' + rel + ' title="Chưa có mục này — bấm để tạo">' + esc(label) + "</a>";
  }

  // ----------------------------------------------------------------------------------------------- block
  function splitRow(line) {
    var s = line.trim().replace(/^\|/, "").replace(/\|$/, ""), cells = [], cur = "";
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === "\\" && s.charAt(i + 1) === "|") { cur += "|"; i++; } else if (s.charAt(i) === "|") { cells.push(cur.trim()); cur = ""; } else cur += s.charAt(i);
    }
    cells.push(cur.trim());
    return cells;
  }

  /** Phần chữ của tiêu đề `# Chữ ##`: bỏ cụm # đóng và khoảng trắng cuối (`r` = dòng sau dấu mở). BẰNG TAY — regex gốc
      /(.*?)(?:[ \t]+#+)?[ \t]*$/ bậc hai trên một dải khoảng trắng dài trong dòng tiêu đề (câu trả lời AI có thể có: 40.000 ký tự → ~9 giây). */
  function closeStrip(r) {
    var e = r.length, h;
    while (e > 0 && (r.charAt(e - 1) === " " || r.charAt(e - 1) === "\t")) e--;
    h = e;
    while (h > 0 && r.charAt(h - 1) === "#") h--;
    if (h < e && h > 0 && (r.charAt(h - 1) === " " || r.charAt(h - 1) === "\t")) {            // `#` cuối chỉ là cụm đóng khi đứng sau khoảng trắng
      while (h > 0 && (r.charAt(h - 1) === " " || r.charAt(h - 1) === "\t")) h--;
      e = h;
    }
    return r.slice(0, e);
  }
  /** Dòng tiêu đề ATX → {level, text} hoặc null — đúng kết quả của /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/ (kiem.js so từng ca). */
  function headingOf(line) {
    var m = HEAD_OPEN.exec(line);
    if (!m) return null;
    var r = line.slice(m[0].length);
    return LINE_END.test(r) ? null : { level: m[1].length, text: closeStrip(r) };
  }

  function startsBlock(line, next) {
    return FENCE.test(line) || headingOf(line) || HR.test(line) || /^ {0,3}>/.test(line) || ITEM.test(line) || Q_LINE.test(line) ||
      (line.indexOf("|") !== -1 && next != null && TABLE_SEP.test(next) && next.indexOf("-") !== -1 && (next.indexOf("|") !== -1 || line.indexOf("|") !== -1) && splitRow(line).length > 1);
  }

  function renderBlocks(lines, ctx, depth, state) {
    var html = "", i = 0, m, mb = mathBlocks(lines);
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if ((m = FENCE.exec(line))) {
        var fence = m[1], lang = (m[2] || "").toLowerCase(), body = [];
        i++;
        while (i < lines.length && !(new RegExp("^ {0,3}" + fence.charAt(0) + "{" + fence.length + ",}[ \\t]*$").test(lines[i]))) body.push(lines[i++]);
        i++;                                                                                  // dòng đóng (nếu chưa đóng thì i vượt qua cuối, vòng lặp kết thúc)
        var code = body.join("\n");
        if (lang === "math" && notBlank(code)) { html += mathHtml(code, true, true); continue; }   // ```math: TeX thuần, hiển thị
        var hl = ctx.highlight && lang ? ctx.highlight(code, lang) : null;
        html += '<pre class="code' + (lang === "mermaid" ? " mmd" : "") + '"' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + "><code>" + (hl != null ? hl : esc(code)) + "</code></pre>";
        continue;
      }
      if (mb && mb[i]) {                                                                      // khối toán hiển thị: $$…$$, \[…\], \begin{ENV}…\end{ENV} (tìm sẵn bằng mathBlocks)
        var mbk = mb[i];
        mb[i] = null;
        html += mathHtml(mbk.tex, true, true);
        if (mbk.rest && notBlank(mbk.rest)) { lines[mbk.end] = mbk.rest; i = mbk.end; } else i = mbk.end + 1;     // chữ còn lại sau \end{ENV} trên cùng dòng tiếp tục như đoạn văn
        continue;
      }
      if ((m = headingOf(line))) {
        var lv = m.level, txt = m.text, id = "h-" + (T.slug(txt) || "muc"), k = (state.ids[id] = (state.ids[id] || 0) + 1);
        html += "<h" + lv + ' id="' + esc(k > 1 ? id + "-" + k : id) + '">' + inline(txt, ctx) + "</h" + lv + ">";
        i++; continue;
      }
      if (HR.test(line)) { html += "<hr>"; i++; continue; }
      if (/^ {0,3}>/.test(line) && depth < MAX_DEPTH) {
        var q = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^ {0,3}> ?/, ""));
        html += "<blockquote>" + renderBlocks(q, ctx, depth + 1, state) + "</blockquote>";
        continue;
      }
      if (line.indexOf("|") !== -1 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1 && splitRow(line).length > 1) {
        var head = splitRow(line), aligns = splitRow(lines[i + 1]).map(function (c) { return /^:-+:$/.test(c) ? "center" : /^-+:$/.test(c) ? "right" : /^:-+$/.test(c) ? "left" : ""; }), rows = [];
        i += 2;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
        var cell = function (tag, c, ix) { return "<" + tag + (aligns[ix] ? ' style="text-align:' + aligns[ix] + '"' : "") + ">" + inline(c || "", ctx) + "</" + tag + ">"; };
        html += '<div class="tbl"><table><thead><tr>' + head.map(function (c, ix) { return cell("th", c, ix); }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + head.map(function (_, ix) { return cell("td", r[ix], ix); }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
        continue;
      }
      if (ITEM.test(line) && depth < MAX_DEPTH) {
        var items = [];
        while (i < lines.length) {
          var l2 = lines[i];
          if (ITEM.test(l2)) { items.push(l2); i++; }
          else if (/^\s*$/.test(l2) && i + 1 < lines.length && (ITEM.test(lines[i + 1]) || /^ {2,}\S/.test(lines[i + 1]))) { i++; }
          else if (/^ {2,}\S/.test(l2) && items.length) { items[items.length - 1] += "\n" + l2.trim(); i++; }
          else break;
        }
        html += renderList(items, ctx);
        continue;
      }
      if (Q_LINE.test(line)) {
        var qs = [line.replace(Q_LINE, "$1")], ans = null;
        i++;
        while (i < lines.length && !/^\s*$/.test(lines[i])) {
          if (A_LINE.test(lines[i]) && ans === null) ans = [lines[i].replace(A_LINE, "$1")];
          else if (Q_LINE.test(lines[i])) break;
          else (ans || qs).push(lines[i]);
          i++;
        }
        html += ans === null ? "<p>" + inline("Q: " + qs.join("\n"), ctx).replace(/\n/g, "<br>") + "</p>"
          : '<div class="fc"><div class="fc-q"><b>Hỏi</b>' + inline(qs.join("\n"), ctx).replace(/\n/g, "<br>") + '</div><div class="fc-a"><b>Đáp</b>' + inline(ans.join("\n"), ctx).replace(/\n/g, "<br>") + "</div></div>";
        continue;
      }
      var para = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !(mb && mb[i]) && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++]);
      html += "<p>" + inline(para.join("\n"), ctx).replace(/\n/g, "<br>") + "</p>";
    }
    return html;
  }

  function indentOf(s) { return s.replace(/\t/g, "    ").length - s.replace(/\t/g, "    ").replace(/^ +/, "").length; }

  function renderList(items, ctx) {
    var root = { children: [], indent: -1 }, stack = [root];
    items.forEach(function (raw) {
      var m = ITEM.exec(raw.split("\n")[0]), ind = indentOf(m[1]), ordered = /\d/.test(m[2].charAt(0)), rest = [m[3]].concat(raw.split("\n").slice(1)).join("\n");
      var task = /^\[([ xX])\][ \t]+/.exec(rest), node = { ordered: ordered, text: task ? rest.slice(task[0].length) : rest, task: task ? task[1] !== " " : null, children: [], indent: ind };
      while (stack.length > 1 && stack[stack.length - 1].indent >= ind) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    });
    function out(list) {
      var html = "", i = 0;
      while (i < list.length) {                       // một dãy cùng kiểu dấu = một danh sách; đổi kiểu (• ⇄ 1.) thì mở danh sách mới
        var j = i;
        while (j < list.length && list[j].ordered === list[i].ordered) j++;
        var run = list.slice(i, j), tag = run[0].ordered ? "ol" : "ul", hasTask = run.some(function (x) { return x.task !== null; });
        html += "<" + tag + (hasTask ? ' class="tasks"' : "") + ">" + run.map(function (x) {
          var box = x.task === null ? "" : '<input type="checkbox" disabled' + (x.task ? " checked" : "") + ' aria-label="' + (x.task ? "đã xong" : "chưa xong") + '"> ';
          return "<li" + (x.task !== null ? ' class="task' + (x.task ? " done" : "") + '"' : "") + ">" + box + inline(x.text, ctx).replace(/\n/g, "<br>") + out(x.children) + "</li>";
        }).join("") + "</" + tag + ">";
        i = j;
      }
      return html;
    }
    return out(root.children);
  }

  function render(md, opts) {
    opts = opts || {};
    var src = String(md == null ? "" : md).slice(0, MAX_INPUT).replace(/\r\n?/g, "\n");
    return renderBlocks(src.split("\n"), { resolve: opts.resolve, highlight: opts.highlight, noLinks: !!opts.noLinks }, 0, { ids: {} });
  }

  /** Mục lục: [{level, text, id, line}] (bỏ qua # trong khối code). */
  function headings(md) {
    var masked = N.maskCode(md).split("\n"), orig = String(md || "").split("\n"), out = [], ids = {};
    masked.forEach(function (ln, idx) {
      var m = headingOf(ln);
      if (!m) return;
      var o = HEAD_OPEN.exec(orig[idx]), text = N.plainSnippet(o ? closeStrip(orig[idx].slice(o[0].length)) : orig[idx], 120), id = "h-" + (T.slug(text) || "muc"), k = (ids[id] = (ids[id] || 0) + 1);
      out.push({ level: m.level, text: text, id: k > 1 ? id + "-" + k : id, line: idx });
    });
    return out;
  }

  W.markdown = { render: render, headings: headings, headingOf: headingOf, safeUrl: safeUrl, safeImg: safeImg, mathBlocks: mathBlocks, inline: function (s, o) { return inline(s, o || {}); } };
  if (typeof module !== "undefined" && module.exports) module.exports = W.markdown;
})(typeof globalThis !== "undefined" ? globalThis : this);
