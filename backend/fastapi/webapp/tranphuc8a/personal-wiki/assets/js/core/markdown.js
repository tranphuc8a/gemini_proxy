/* markdown.js — Markdown → HTML AN TOÀN, tự viết, không thư viện.

   An toàn bằng cấu trúc, không bằng "lọc sau": mọi chữ đều đi qua esc(); HTML thô trong nội dung KHÔNG được hiểu (hiện nguyên văn);
   địa chỉ liên kết chỉ nhận http(s)/mailto/tel/tương đối; ảnh chỉ nhận https hoặc data:image/(png|jpeg|gif|webp). Không bao giờ gán handler hay style từ nội dung.

   Hỗ trợ: # tiêu đề, **đậm**, *nghiêng*, ~~gạch~~, `code`, ``` khối code (có ngôn ngữ), danh sách (-, *, +, 1.) lồng nhau, danh sách việc (- [ ] / - [x]),
   > trích dẫn, bảng (GFM), --- đường kẻ, [chữ](url), ![ảnh](url), tự nhận http://…, [[liên kết wiki]], thẻ ôn "Q: … / A: …".
   Xuống dòng đơn được GIỮ (<br>) — thói quen ghi chú, không phải quy tắc CommonMark.

   opts: {resolve(title) → {id, status}|null,   // giải [[Tiêu đề]]; null = chưa có note (hiện mờ, bấm để tạo)
          highlight(code, lang) → html|null,    // tô màu code, phải tự thoát HTML
          noLinks: bool}                         // bỏ <a> (khi dựng ảnh/ PDF)  */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  if (!W.text && typeof require === "function") require("./text.js");
  if (!W.notes && typeof require === "function") require("./notes.js");
  var T = W.text, N = W.notes, esc = T.esc;

  var MAX_DEPTH = 6, MAX_INPUT = 600000;
  var FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+#.\-]*)[^\n]*$/;
  var HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
  var HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  var ITEM = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
  var TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  var Q_LINE = /^\s*Q:\s*(.+)$/i, A_LINE = /^\s*A:\s*(.*)$/i;

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

  // ----------------------------------------------------------------------------------------------- inline
  var PH_OPEN = "\uE000", PH_CLOSE = "\uE001";

  function inline(src, ctx) {
    src = String(src).replace(/[\uE000\uE001]/g, "");
    var out = "", i = 0, n = src.length, ph = [];
    function hold(html) { ph.push(html); return PH_OPEN + (ph.length - 1) + PH_CLOSE; }
    function textUntilSpecial() {
      var j = i;
      while (j < n && "`\\[!h".indexOf(src.charAt(j)) === -1) j++;
      return j === i ? i + 1 : j;
    }
    while (i < n) {
      var c = src.charAt(i), m, rest;
      if (c === "\\" && i + 1 < n && /[\\`*_{}\[\]()#+\-.!|~>]/.test(src.charAt(i + 1))) { out += hold(esc(src.charAt(i + 1))); i += 2; continue; }
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
    if (hit) return '<a class="wl' + (hit.status === "trashed" ? " ghost" : "") + '" href="#/n/' + esc(hit.id) + '" data-id="' + esc(hit.id) + '"' + rel + ">" + esc(label) + "</a>";
    return '<a class="wl ghost" href="#/new?title=' + encodeURIComponent(l.title) + '" data-title="' + esc(l.title) + '"' + rel + ' title="Chưa có note này — bấm để tạo">' + esc(label) + "</a>";
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

  function startsBlock(line, next) {
    return FENCE.test(line) || HEADING.test(line) || HR.test(line) || /^ {0,3}>/.test(line) || ITEM.test(line) || Q_LINE.test(line) ||
      (line.indexOf("|") !== -1 && next != null && TABLE_SEP.test(next) && next.indexOf("-") !== -1 && (next.indexOf("|") !== -1 || line.indexOf("|") !== -1) && splitRow(line).length > 1);
  }

  function renderBlocks(lines, ctx, depth, state) {
    var html = "", i = 0, m;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if ((m = FENCE.exec(line))) {
        var fence = m[1], lang = (m[2] || "").toLowerCase(), body = [];
        i++;
        while (i < lines.length && !(new RegExp("^ {0,3}" + fence.charAt(0) + "{" + fence.length + ",}[ \\t]*$").test(lines[i]))) body.push(lines[i++]);
        i++;                                                                                  // dòng đóng (nếu chưa đóng thì i vượt qua cuối, vòng lặp kết thúc)
        var code = body.join("\n"), hl = ctx.highlight && lang ? ctx.highlight(code, lang) : null;
        html += '<pre class="code"' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + "><code>" + (hl != null ? hl : esc(code)) + "</code></pre>";
        continue;
      }
      if ((m = HEADING.exec(line))) {
        var lv = m[1].length, txt = m[2], id = "h-" + (T.slug(txt) || "muc"), k = (state.ids[id] = (state.ids[id] || 0) + 1);
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
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++]);
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
      var m = HEADING.exec(ln);
      if (!m) return;
      var text = N.plainSnippet(orig[idx].replace(/^ {0,3}#{1,6}[ \t]+/, "").replace(/[ \t]+#+[ \t]*$/, ""), 120), id = "h-" + (T.slug(text) || "muc"), k = (ids[id] = (ids[id] || 0) + 1);
      out.push({ level: m[1].length, text: text, id: k > 1 ? id + "-" + k : id, line: idx });
    });
    return out;
  }

  W.markdown = { render: render, headings: headings, safeUrl: safeUrl, safeImg: safeImg, inline: function (s, o) { return inline(s, o || {}); } };
  if (typeof module !== "undefined" && module.exports) module.exports = W.markdown;
})(typeof globalThis !== "undefined" ? globalThis : this);
