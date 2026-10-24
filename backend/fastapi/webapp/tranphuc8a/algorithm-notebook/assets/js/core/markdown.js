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
  var NO_SPANS = [], NO_CTX = {};

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

  // ----------------------------------------------------------------------------------------------- toán
  /** Công thức → HTML. TeX giữ nguyên chữ (chỉ cắt khoảng trắng hai đầu); esc() cho CẢ thuộc tính data-tex lẫn chữ dự phòng (chặn thoát khỏi dấu ngoặc kép).
      Xuống dòng → `&#10;`: đoạn văn/mục danh sách đổi "\n" thành <br> trên HTML đã dựng (kể cả bên trong thuộc tính!), còn getAttribute giải mã `&#10;` về "\n". */
  function mathHtml(tex, display, block) {
    var t = esc(String(tex).trim()).replace(/\n/g, "&#10;");
    return block ? '<div class="math math-d" data-tex="' + t + '">' + t + "</div>"
      : '<span class="math' + (display ? " math-d" : "") + '" data-tex="' + t + '">' + t + "</span>";
  }
  function notBlank(s) { return /\S/.test(s); }

  /** Các vùng toán INLINE của một đoạn → [{a, b, html}] theo thứ tự, không chồng lấn. Vùng = notes.js mathRanges (code đã che); rồi lọc theo luật hiển thị:
      công thức rỗng thì để nguyên chữ; `\[…\]` GIỮA CÂU chỉ là toán khi nội dung giống TeX (`Bấm \[Enter\]` không phải); `\[…\]` và `$$…$$` đứng một mình
      trong đoạn thì hiển thị (math-d), còn `$$…$$` giữa câu vẫn là inline. Mọi bước tuyến tính (không cắt đuôi chuỗi, không trim cả chuỗi mỗi vùng). */
  function inlineMath(src) {
    if (src.indexOf("$") === -1 && src.indexOf("\\") === -1) return NO_SPANS;
    var rs = N.mathRanges(N.maskCode(src)), out = [];
    if (!rs.length) return NO_SPANS;
    var lo = src.search(/\S/), hi = src.length;
    while (hi > 0 && /\s/.test(src.charAt(hi - 1))) hi--;
    for (var k = 0; k < rs.length; k++) {
      var a = rs[k][0], b = rs[k][1], kind, body;
      if (src.charAt(a) === "\\") { kind = src.charAt(a + 1); body = src.slice(a + 2, b - 2); }          // "(" hoặc "["
      else if (src.charAt(a + 1) === "$") { kind = "$$"; body = src.slice(a + 2, b - 2); }
      else { kind = "$"; body = src.slice(a + 1, b - 1); }
      if (!notBlank(body)) continue;
      var alone = a === lo && b === hi;
      if (kind === "[" && !alone && !TEX_LIKE.test(body)) continue;
      out.push({ a: a, b: b, html: mathHtml(body, kind === "[" || (kind === "$$" && alone), false) });
    }
    return out;
  }

  /** Dòng của tài liệu sau rào code mở ở dòng i (rào chưa đóng thì tới hết). */
  function fenceEnd(lines, i, fence) {
    var close = new RegExp("^ {0,3}" + fence.charAt(0) + "{" + fence.length + ",}[ \\t]*$"), n = lines.length;
    i++;
    while (i < n && !close.test(lines[i])) i++;
    return i + 1;
  }
  /** Vị trí của lệnh `token` (bắt đầu bằng \) từ `from`, bỏ qua `\\begin` (dấu \ đứng trước chẵn mới là lệnh). */
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
  /** `\end{name}` khớp (đếm lồng) với `\begin{name}` ở dòng k, tìm từ cột `from` của dòng k; không vượt khỏi `parts` (một đoạn, không có dòng trống).
      → {line, col (sau \end{name})} | null. Mỗi dòng chỉ tìm lại cái đã dùng (o, e nhớ vị trí kế tiếp) nên tuyến tính. */
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
  /** Khối toán hiển thị trong một ĐOẠN lines[s, e): {chỉ số dòng bắt đầu → {end, tex, rest}} cộng vào `out`. Khối bắt đầu ở đầu dòng (thụt ≤ 3):
      `$$…$$` / `\[…\]` (nhiều dòng được, đóng ở cuối một dòng, không vượt dòng trống), hoặc `\begin{ENV}…\end{ENV}` trần. */
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
      if (r < rs.length && rs[r][0] < p) { k++; continue; }                   // dòng nằm giữa một vùng toán đã mở từ dòng trước
      if (r < rs.length && rs[r][0] === p) {
        var a = rs[r][0], b = rs[r][1], two = text.substr(a, 2);
        if (two === "$$" || two === "\\[") {
          var eol = text.indexOf("\n", b), body = text.slice(a + 2, b - 2);
          if (eol === -1) eol = text.length;
          if (notBlank(body) && !notBlank(text.slice(b, eol))) {              // sau dấu đóng không còn chữ ⇒ cả đoạn là một công thức hiển thị
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
        if (!en) { failEnv[m[1]] = true; k++; continue; }                     // không có \end: cùng tên trong đoạn này cũng bỏ (giữ tuyến tính)
        (out = out || {})[s + k] = { end: s + en.line, tex: text.slice(offs[k] + ind, offs[en.line] + en.col), rest: parts[en.line].slice(en.col) };
        k = en.line + 1; continue;
      }
      k++;
    }
    return out;
  }
  /** Dòng CÓ THỂ mở một khối toán hiển thị: sau ≤ 3 dấu cách bắt đầu bằng `$$`, `\[` hoặc `\begin{`. paragraphMath chỉ tạo khối ở đúng những dòng như vậy,
      nên đoạn không có dòng nào thế khỏi phải quét (trước đây: mọi đoạn có `$` hay `\` đều bị quét — ghi chú nhiều `$x$` trong dòng tốn ~9 ms/lần). */
  function mathOpener(ln) {
    var ind = 0;
    while (ind < 4 && ln.charCodeAt(ind) === 32) ind++;
    if (ind > 3) return false;
    var c = ln.charCodeAt(ind);
    return (c === 36 && ln.charCodeAt(ind + 1) === 36) || (c === 92 && (ln.charCodeAt(ind + 1) === 91 || ln.substr(ind, 7) === "\\begin{"));
  }
  /** Mọi khối toán hiển thị trong `lines` → {chỉ số dòng bắt đầu → {end, tex, rest}} hoặc null. Bỏ qua rào code; chia theo dòng trống. Tuyến tính.
      `spans` (tuỳ chọn, mảng): nhận từng cặp [dòng mở rào, dòng sau rào] mà hàm này coi là rào code — M.blocks cần biết (mô hình rào của hàm này thô hơn
      của renderBlocks: mọi dòng giống rào đều mở rào, kể cả dòng thụt trong mục danh sách), vì không được cắt khối ngay giữa một rào như vậy. */
  function mathBlocks(lines, spans) {
    var n = lines.length, out = null, i = 0;
    while (i < n) {
      var line = lines[i], fm;
      if (!notBlank(line)) { i++; continue; }
      if ((fm = FENCE.exec(line))) { var fe = fenceEnd(lines, i, fm[1]); if (spans) spans.push(i, fe); i = fe; continue; }
      var e = i + 1, hot = mathOpener(line);
      while (e < n && notBlank(lines[e]) && !FENCE.test(lines[e])) {
        if (!hot && mathOpener(lines[e])) hot = true;
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
      if (ns) {                                                                              // công thức TRƯỚC mọi luật khác: bên trong không có nhấn mạnh, liên kết, escape
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
        var l = N.parseLinks(m[0])[0], lend = i + m[0].length;
        for (var sk = si; l && sk < ns && spans[sk].a < lend; sk++) if (spans[sk].b > lend) l = null;      // công thức bắt đầu trong liên kết nhưng KẾT THÚC sau nó (`[[Giá $5]] và 6$`): toán thắng, như parseLinks (đồ thị) — trang và đồ thị phải thấy cùng một tập liên kết
        if (l) { out += hold(wikiLink(l, ctx)); i = lend; continue; }
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
    var c = line.charCodeAt(0);                                                           // đường nhanh: dòng mở bằng chữ cái ASCII (trừ Q/q của thẻ ôn) và không có `|` thì không luật nào dưới đây khớp
    if (((c >= 65 && c <= 90 && c !== 81) || (c >= 97 && c <= 122 && c !== 113)) && line.indexOf("|") === -1) return false;
    return FENCE.test(line) || headingOf(line) || HR.test(line) || /^ {0,3}>/.test(line) || ITEM.test(line) || Q_LINE.test(line) ||
      (line.indexOf("|") !== -1 && next != null && TABLE_SEP.test(next) && next.indexOf("-") !== -1 && (next.indexOf("|") !== -1 || line.indexOf("|") !== -1) && splitRow(line).length > 1);
  }

  /** Dựng HTML của các dòng `lines`. `state`:
        ids        bộ đếm id tiêu đề toàn tài liệu (`h-slug`, `h-slug-2`, …);
        block      (render theo khối) tiêu đề mang `data-hid="h-slug"` THAY cho `id` — id phụ thuộc cả tài liệu nên do M.dedupeIds đặt sau;
        scan       (M.blocks) CHỈ quét cấu trúc cấp cao nhất: chạy đúng các vòng nhận khối bên dưới nhưng bỏ mọi việc dựng HTML / inline, và ghi vào
                   `starts` số dòng của MỖI khối đứng sau dòng trống (+ khối đầu); `spans` nhận các rào code theo mô hình của mathBlocks;
                   `unclosed` đặt true nếu có rào code mở mà không đóng (nuốt tới hết tài liệu).
      Chia khối dùng CHÍNH vòng lặp này nên luật nhận khối chỉ có một bản — đừng tách ra một bản thứ hai. */
  function renderBlocks(lines, ctx, depth, state) {
    var html = "", i = 0, m, mb = mathBlocks(lines, state.spans), own = false;                // own: `lines` đã là bản chép riêng (chữ sau \end{ENV} ghi đè dòng — không được sửa mảng của người gọi)
    var scan = !!state.scan, sawBlank = false;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; sawBlank = true; continue; }
      if (scan) { if (sawBlank || !state.starts.length) state.starts.push(i); sawBlank = false; }
      if ((m = FENCE.exec(line))) {
        var fence = m[1], lang = (m[2] || "").toLowerCase(), body = [], closeRe = new RegExp("^ {0,3}" + fence.charAt(0) + "{" + fence.length + ",}[ \\t]*$");
        i++;
        while (i < lines.length && !closeRe.test(lines[i])) { if (!scan) body.push(lines[i]); i++; }
        if (scan && i >= lines.length) state.unclosed = true;
        i++;                                                                                  // dòng đóng (nếu chưa đóng thì i vượt qua cuối, vòng lặp kết thúc)
        if (scan) continue;
        var code = body.join("\n");
        if (lang === "math" && notBlank(code)) { html += mathHtml(code, true, true); continue; }   // ```math: TeX thuần, hiển thị
        var hl = ctx.highlight && lang ? ctx.highlight(code, lang) : null;
        html += '<pre class="code' + (lang === "mermaid" ? " mmd" : "") + '"' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + "><code>" + (hl != null ? hl : esc(code)) + "</code></pre>";
        continue;
      }
      if (mb && mb[i]) {                                                                      // khối toán hiển thị: $$…$$, \[…\], \begin{ENV}…\end{ENV} (tìm sẵn bằng mathBlocks)
        var mbk = mb[i];
        mb[i] = null;
        if (!scan) html += mathHtml(mbk.tex, true, true);
        if (mbk.rest && notBlank(mbk.rest)) { if (!own) { lines = lines.slice(); own = true; } lines[mbk.end] = mbk.rest; i = mbk.end; } else i = mbk.end + 1;     // chữ còn lại sau \end{ENV} trên cùng dòng tiếp tục như đoạn văn
        continue;
      }
      if ((m = headingOf(line))) {
        if (!scan) {
          var lv = m.level, txt = m.text, id = "h-" + (T.slug(txt) || "muc");
          if (state.block) html += "<h" + lv + ' data-hid="' + esc(id) + '">' + inline(txt, ctx) + "</h" + lv + ">";
          else { var k = (state.ids[id] = (state.ids[id] || 0) + 1); html += "<h" + lv + ' id="' + esc(k > 1 ? id + "-" + k : id) + '">' + inline(txt, ctx) + "</h" + lv + ">"; }
        }
        i++; continue;
      }
      if (HR.test(line)) { if (!scan) html += "<hr>"; i++; continue; }
      if (/^ {0,3}>/.test(line) && depth < MAX_DEPTH) {
        var q = scan ? null : [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) { if (q) q.push(lines[i].replace(/^ {0,3}> ?/, "")); i++; }
        if (!scan) html += "<blockquote>" + renderBlocks(q, ctx, depth + 1, state) + "</blockquote>";
        continue;
      }
      if (line.indexOf("|") !== -1 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1 && splitRow(line).length > 1) {
        if (scan) {
          i += 2;
          while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) i++;
          continue;
        }
        var head = splitRow(line), aligns = splitRow(lines[i + 1]).map(function (c) { return /^:-+:$/.test(c) ? "center" : /^-+:$/.test(c) ? "right" : /^:-+$/.test(c) ? "left" : ""; }), rows = [];
        i += 2;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
        var cell = function (tag, c, ix) { return "<" + tag + (aligns[ix] ? ' style="text-align:' + aligns[ix] + '"' : "") + ">" + inline(c || "", ctx) + "</" + tag + ">"; };
        html += '<div class="tbl"><table><thead><tr>' + head.map(function (c, ix) { return cell("th", c, ix); }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + head.map(function (_, ix) { return cell("td", r[ix], ix); }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
        continue;
      }
      if (ITEM.test(line) && depth < MAX_DEPTH) {
        var items = scan ? null : [];
        while (i < lines.length) {
          var l2 = lines[i];
          if (ITEM.test(l2)) { if (items) items.push(l2); i++; }
          else if (/^\s*$/.test(l2) && i + 1 < lines.length && (ITEM.test(lines[i + 1]) || /^ {2,}\S/.test(lines[i + 1]))) { i++; }
          else if (/^ {2,}\S/.test(l2)) { if (items) items[items.length - 1] += "\n" + l2.trim(); i++; }      // luôn có ≥ 1 mục: dòng đầu vòng lặp là ITEM
          else break;
        }
        if (!scan) html += renderList(items, ctx);
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
        if (scan) continue;
        html += ans === null ? "<p>" + inline("Q: " + qs.join("\n"), ctx).replace(/\n/g, "<br>") + "</p>"
          : '<div class="fc"><div class="fc-q"><b>Hỏi</b>' + inline(qs.join("\n"), ctx).replace(/\n/g, "<br>") + '</div><div class="fc-a"><b>Đáp</b>' + inline(ans.join("\n"), ctx).replace(/\n/g, "<br>") + "</div></div>";
        continue;
      }
      var para = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !(mb && mb[i]) && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++]);
      if (!scan) html += "<p>" + inline(para.join("\n"), ctx).replace(/\n/g, "<br>") + "</p>";
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

  function normalize(md) {
    var s = String(md == null ? "" : md);
    if (s.length > MAX_INPUT) s = s.slice(0, MAX_INPUT);
    return s.indexOf("\r") === -1 ? s : s.replace(/\r\n?/g, "\n");
  }

  /** opts.blockMode: dựng MỘT khối của M.blocks — tiêu đề mang `data-hid="h-slug"` thay cho `id` (id phụ thuộc cả tài liệu: M.dedupeIds đặt sau). */
  function render(md, opts) {
    opts = opts || {};
    return renderBlocks(normalize(md).split("\n"), { resolve: opts.resolve, highlight: opts.highlight, noLinks: !!opts.noLinks }, 0, { ids: {}, block: !!opts.blockMode });
  }

  /** Chia tài liệu thành các KHỐI dựng độc lập → [{start, text}] (start = số dòng BẮT ĐẦU, đếm từ 0 như `headings().line`).
      BẤT BIẾN (kiem.js so từng ca + hàng nghìn tài liệu ngẫu nhiên): với mọi md, nối `render(b.text, {blockMode: true})` của mọi khối rồi đặt id bằng
      dedupeIds == `render(md)` từng chữ. Chỉ cắt TRƯỚC một khối mà dòng ngay trước nó là dòng trống, và chỉ ở chỗ renderBlocks cũng bắt đầu một khối
      mới (nên không bao giờ cắt giữa rào code, giữa danh sách còn tiếp tục qua dòng trống, giữa khối toán — vùng toán dừng ở dòng trống). Ngoài ra
      không cắt trong rào code theo mô hình của mathBlocks (thô hơn): khối sau đó cần mathBlocks bắt đầu "ngoài rào" thì dựng riêng mới ra đúng.
      Khối bỏ dòng trống đầu/cuối (cuối: trừ khối chót khi có rào mở chưa đóng — dòng trống là NỘI DUNG của rào). Tuyến tính, không dựng HTML. */
  function blocks(md) {
    var lines = normalize(md).split("\n"), n = lines.length, st = { ids: {}, scan: true, starts: [], spans: [], unclosed: false };
    renderBlocks(lines, NO_CTX, 0, st);
    var starts = st.starts, spans = st.spans, cuts = [], j = 0, k, s, out = [];
    for (k = 0; k < starts.length; k++) {
      s = starts[k];
      if (k > 0) {
        while (j < spans.length && spans[j + 1] <= s) j += 2;
        if (j < spans.length && spans[j] < s) continue;                                       // s nằm TRONG một rào theo mathBlocks
      }
      cuts.push(s);
    }
    for (k = 0; k < cuts.length; k++) {
      var a = cuts[k], b = k + 1 < cuts.length ? cuts[k + 1] : n;
      if (k + 1 < cuts.length || !st.unclosed) while (b > a + 1 && !notBlank(lines[b - 1])) b--;
      out.push({ start: a, text: lines.slice(a, b).join("\n") });
    }
    return out;
  }

  /** Id tiêu đề đầy đủ từ dãy id GỐC (`h-slug`) theo thứ tự tài liệu: lần thứ k của cùng một gốc thành `gốc-k` (k ≥ 2) — đúng luật `state.ids` của
      renderBlocks (kể cả va chạm `h-a-2` của tiêu đề "A 2" với lần thứ hai của "A": giữ nguyên như bản dựng cả tài liệu). */
  function dedupeIds(bases) {
    var seen = {}, out = new Array(bases.length);
    for (var i = 0; i < bases.length; i++) { var id = bases[i], k = (seen[id] = (seen[id] || 0) + 1); out[i] = k > 1 ? id + "-" + k : id; }
    return out;
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

  W.markdown = { render: render, blocks: blocks, dedupeIds: dedupeIds, headings: headings, headingOf: headingOf, safeUrl: safeUrl, safeImg: safeImg, mathBlocks: mathBlocks, inline: function (s, o) { return inline(s, o || {}); } };
  if (typeof module !== "undefined" && module.exports) module.exports = W.markdown;
})(typeof globalThis !== "undefined" ? globalThis : this);
