/* ==========================================================================
   FILE SINH RA - DUNG SUA O DAY.
   Nguon that: tranphuc8a/code-studio/assets/ui/editor.js
   Sua o do roi chay: python tranphuc8a/code-studio/sync.py
   ========================================================================== */
/* editor.js — trình soạn mã của Code Studio (cũng được chép sang trang Thực hành heuristic bằng sync.py).
   <textarea> trong suốt đè lên lớp tô màu (CS.tokenize) — gõ, chọn, hoàn tác, IME, trình đọc màn hình đều là của trình duyệt.
   Có: số dòng, tô cú pháp 19 ngôn ngữ, tự đóng ngoặc/nháy, tự thụt khi xuống dòng (tách `{|}`), lùi thụt khi gõ `}`,
   gợi ý khi gõ (CS.complete: từ khoá, thành viên sau `.`/`->`/`::`, #include, snippet), tìm/thay (chữ hoa, cả từ, regex), tới dòng,
   tô cặp ngoặc, tô các chỗ trùng từ dưới con trỏ, dòng hiện tại, đánh dấu lỗi theo dòng, ngắt dòng mềm (Alt+Z), phóng to chữ,
   chú thích dòng (Ctrl+/), di chuyển/nhân đôi/xoá dòng (Alt+↑↓, Shift+Alt+↑↓, Ctrl+Shift+K), Home thông minh, hàng phím ký hiệu trên điện thoại.
   Mọi thay đổi do trình soạn tự làm đi qua execCommand("insertText") nên Ctrl+Z hoàn tác được.

   CS.editor.create(host, {value, lang, readOnly, label, indentUnit, fontSize, wrap, autoClose, completion,
                           onChange(v), onRun(), onSave(), onFormat(), onCursor({line,col,selected}), extraWords(), files()}) → api (xem cuối tệp) */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});
  var D = root.document;
  var PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
  var CLOSE = { ")": "(", "]": "[", "}": "{" };
  var MOBILE_KEYS = [["⇥", "\t"], ["{", "{"], ["}", "}"], ["(", "("], [")", ")"], ["[", "["], ["]", "]"], [";", ";"], ["<", "<"], [">", ">"], ["=", "="], ["&", "&"], ["|", "|"],
    ["!", "!"], ['"', '"'], ["'", "'"], ["#", "#"], ["/", "/"], ["*", "*"], ["+", "+"], ["-", "-"], [":", ":"], [",", ","], [".", "."], ["↶", "undo"], ["↷", "redo"]];
  var KIND = { keyword: ["K", "từ khoá"], type: ["T", "kiểu"], function: ["ƒ", "hàm"], variable: ["x", "tên"], member: ["m", "thành viên"], snippet: ["⋯", "mẫu"], file: ["#", "tệp"] };
  var LINE_COMMENT = { c: "//", cpp: "//", java: "//", javascript: "//", typescript: "//", csharp: "//", go: "//", rust: "//", kotlin: "//", php: "//",
    python: "#", ruby: "#", bash: "#", sql: "--" };
  var BLOCK_COMMENT = { css: ["/*", "*/"], html: ["<!--", "-->"], markdown: ["<!--", "-->"] };
  var uid = 0;

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function isWord(c) { return /[A-Za-z0-9_$À-￿]/.test(c || ""); }
  function repeat(s, n) { var o = ""; for (var i = 0; i < n; i++) o += s; return o; }

  /* HTML tô màu → mảng dòng, đóng/mở lại thẻ <i> khi một từ tố (chú thích khối, chuỗi nhiều dòng) vắt qua nhiều dòng */
  function splitLines(html) {
    var out = [], cur = "", open = "", parts = html.split(/(<i class="[^"]*">|<\/i>|\n)/), k;
    for (k = 0; k < parts.length; k++) {
      var p = parts[k];
      if (!p) continue;
      if (p === "\n") { out.push(cur + (open ? "</i>" : "")); cur = open; }
      else if (p.charAt(0) === "<" && p.charAt(1) === "i") { open = p; cur += p; }
      else if (p === "</i>") { open = ""; cur += p; }
      else cur += p;
    }
    out.push(cur);
    return out;
  }

  function create(host, o) {
    o = o || {};
    var id = "cse" + (++uid);
    var lang = o.lang || "plaintext";
    var opt = {
      indentUnit: o.indentUnit || (CS.langs.get(lang).tabs ? "\t" : repeat(" ", CS.langs.get(lang).tab || 4)),
      fontSize: o.fontSize || 14, wrap: !!o.wrap, autoClose: o.autoClose !== false, completion: o.completion !== false,
      readOnly: !!o.readOnly, occurrences: o.occurrences !== false, keys: o.keys !== false, minLines: o.minLines || 0
    };
    host.classList.add("cse");
    host.innerHTML =
      '<div class="cse-find" hidden role="search">' +
        '<div class="cse-frow"><input class="cse-q" type="search" placeholder="Tìm" aria-label="Tìm trong mã" spellcheck="false">' +
        '<button type="button" class="cse-tg" data-f="cs" aria-pressed="false" title="Phân biệt hoa/thường (Alt+C)">Aa</button>' +
        '<button type="button" class="cse-tg" data-f="word" aria-pressed="false" title="Cả từ (Alt+W)">ab|</button>' +
        '<button type="button" class="cse-tg" data-f="re" aria-pressed="false" title="Biểu thức chính quy (Alt+R)">.*</button>' +
        '<span class="cse-cnt" aria-live="polite"></span>' +
        '<button type="button" class="cse-fb" data-f="prev" title="Kết quả trước (Shift+Enter)" aria-label="Kết quả trước">↑</button>' +
        '<button type="button" class="cse-fb" data-f="next" title="Kết quả sau (Enter)" aria-label="Kết quả sau">↓</button>' +
        '<button type="button" class="cse-fb" data-f="close" title="Đóng (Esc)" aria-label="Đóng thanh tìm">✕</button></div>' +
        '<div class="cse-frow cse-rrow" hidden><input class="cse-r" type="text" placeholder="Thay bằng" aria-label="Thay bằng" spellcheck="false">' +
        '<button type="button" class="cse-fb wide" data-f="rep" title="Thay chỗ đang chọn (Enter)">Thay</button>' +
        '<button type="button" class="cse-fb wide" data-f="all" title="Thay tất cả (Ctrl+Alt+Enter)">Thay tất cả</button></div>' +
        '<div class="cse-frow cse-grow" hidden><input class="cse-g" type="number" min="1" placeholder="Tới dòng…" aria-label="Tới dòng số">' +
        '<button type="button" class="cse-fb wide" data-f="go">Tới</button><button type="button" class="cse-fb" data-f="close" aria-label="Đóng">✕</button></div>' +
      "</div>" +
      '<div class="cse-main"><div class="cse-gut" aria-hidden="true"><div class="cse-gin"></div></div>' +
      '<div class="cse-body"><div class="cse-layer" aria-hidden="true"><div class="cse-bg"></div><div class="cse-mk"></div><div class="cse-hl"></div><div class="cse-br"></div></div>' +
      '<textarea class="cse-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-autocomplete="list" aria-multiline="true"></textarea></div></div>' +
      '<div class="cse-keys" role="toolbar" aria-label="Phím ký hiệu"></div>' +
      '<div class="cse-pop" role="listbox" id="' + id + '-pop" hidden></div>';
    var $ = function (s) { return host.querySelector(s); };
    var ta = $(".cse-ta"), layer = $(".cse-layer"), hl = $(".cse-hl"), bg = $(".cse-bg"), mk = $(".cse-mk"), br = $(".cse-br"), gin = $(".cse-gin"),
        main = $(".cse-main"), body = $(".cse-body"), pop = $(".cse-pop"), keys = $(".cse-keys"), findBar = $(".cse-find");
    ta.setAttribute("aria-label", o.label || "Trình soạn mã");
    ta.setAttribute("aria-controls", id + "-pop");
    ta.value = o.value || "";
    ta.readOnly = opt.readOnly;

    var toks = [], lineDivs = [], lineCount = 0, markers = {}, cw = 8, lh = 20, padT = 8, padL = 12, gutterSig = "", rafR = 0, rafC = 0, rafM = 0;
    var popState = { open: false, res: null, sel: 0 }, find = { mode: null, cs: false, word: false, re: false, matches: [], idx: -1, err: "" };
    var lastVal = null;

    /* ------------------------------------------------------------ đo + vẽ */
    function applyFont() {
      host.style.setProperty("--cse-fs", opt.fontSize + "px");
      ta.wrap = opt.wrap ? "soft" : "off";
      host.classList.toggle("cse-wrap", opt.wrap);
      host.classList.toggle("cse-ro", opt.readOnly);
      measure();
    }
    function measure() {
      var cs = root.getComputedStyle(ta);
      lh = parseFloat(cs.lineHeight) || opt.fontSize * 1.5;
      padT = parseFloat(cs.paddingTop) || 0; padL = parseFloat(cs.paddingLeft) || 0;
      var s = D.createElement("span"); s.textContent = repeat("M", 64); s.style.visibility = "hidden"; s.style.position = "absolute"; s.style.whiteSpace = "pre";
      hl.appendChild(s); cw = (s.getBoundingClientRect().width / 64) || opt.fontSize * 0.6; hl.removeChild(s);
      host.style.setProperty("--cse-lh", lh + "px");
      if (opt.wrap) layer.style.width = ta.clientWidth + "px"; else layer.style.width = "";
    }
    function render() {
      rafR = 0;
      var v = ta.value;
      if (v !== lastVal) {
        lastVal = v;
        toks = v.length <= 2000000 ? CS.tokenize.run(v, lang) : [{ k: "id", v: v, i: 0 }];
        var lines = splitLines(CS.tokenize.htmlFromTokens(toks, lang));
        lineCount = lines.length;
        var h = "";
        for (var i = 0; i < lines.length; i++) h += '<div class="cse-l">' + (lines[i] || " ") + "</div>";
        hl.innerHTML = h;
        lineDivs = hl.children;
      }
      drawGutter();
      drawBg();
      scheduleMarks();
      if (opt.minLines) main.style.minHeight = (opt.minLines * lh + padT * 2) + "px";
    }
    function scheduleRender() { if (!rafR) rafR = (root.requestAnimationFrame || setTimeout)(render); }
    function lineTop(line) { return opt.wrap && lineDivs[line] ? lineDivs[line].offsetTop : line * lh; }
    function lineHeight(line) { return opt.wrap && lineDivs[line] ? lineDivs[line].offsetHeight : lh; }
    function drawGutter() {
      var sig = lineCount + "|" + JSON.stringify(markers) + "|" + (opt.wrap ? ta.clientWidth : 0) + "|" + opt.fontSize;
      if (sig === gutterSig && !opt.wrap) return;
      gutterSig = sig;
      var h = "";
      for (var i = 0; i < lineCount; i++) {
        var m = markers[i + 1], cls = m ? ' class="cse-gm ' + m.severity + '" title="' + esc(m.message) + '"' : "";
        h += "<div" + cls + (opt.wrap ? ' style="height:' + lineHeight(i) + 'px"' : "") + ">" + (i + 1) + "</div>";
      }
      gin.innerHTML = h;
    }
    /* nền: dòng hiện tại + dòng có lỗi */
    function drawBg() {
      var c = caret(), h = "";
      Object.keys(markers).forEach(function (k) { var ln = +k - 1; if (ln < lineCount) h += '<div class="cse-bl ' + markers[k].severity + '" style="top:' + (padT + lineTop(ln)) + "px;height:" + lineHeight(ln) + 'px"></div>'; });
      if (D.activeElement === ta && ta.selectionStart === ta.selectionEnd) h += '<div class="cse-cl" style="top:' + (padT + lineTop(c.line)) + "px;height:" + lineHeight(c.line) + 'px"></div>';
      bg.innerHTML = h;
      drawBrackets();
    }
    function scrollSync() {
      var st = ta.scrollTop, sl = ta.scrollLeft;
      layer.style.transform = "translate(" + (-sl) + "px," + (-st) + "px)";
      gin.style.transform = "translateY(" + (-st) + "px)";
      scheduleMarks();
      if (popState.open) closePop();
    }

    /* ------------------------------------------------------------ toạ độ */
    function lineStartOf(pos) { return ta.value.lastIndexOf("\n", pos - 1) + 1; }
    function lineEndOf(pos) { var e = ta.value.indexOf("\n", pos); return e < 0 ? ta.value.length : e; }
    function vcol(lineText, idx) { var c = 0, tw = tabWidth(); for (var i = 0; i < idx; i++) c = lineText.charAt(i) === "\t" ? (Math.floor(c / tw) + 1) * tw : c + 1; return c; }
    function tabWidth() { return opt.indentUnit === "\t" ? 4 : opt.indentUnit.length || 4; }
    function posLC(pos) {
      var v = ta.value, line = 0, i = -1;
      while ((i = v.indexOf("\n", i + 1)) >= 0 && i < pos) line++;
      var ls = lineStartOf(pos);
      return { line: line, col: pos - ls, vcol: vcol(v.slice(ls, pos), pos - ls), ls: ls };
    }
    function caret() { return posLC(ta.selectionStart); }
    function offsetOfLine(line) { var v = ta.value, p = 0; for (var k = 0; k < line; k++) { var i = v.indexOf("\n", p); if (i < 0) return v.length; p = i + 1; } return p; }
    /* toạ độ (trong hệ của .cse-layer, chưa trừ cuộn) của một vị trí */
    function xyOf(pos) {
      var lc = posLC(pos), top = lineTop(lc.line), x = lc.vcol;
      if (opt.wrap) { var per = Math.max(1, Math.floor((ta.clientWidth - padL * 2) / cw)); top += Math.floor(x / per) * lh; x = x % per; }
      return { x: padL + x * cw, y: padT + top, line: lc.line };
    }
    function reveal(pos) {
      var p = xyOf(pos), st = ta.scrollTop, ch = ta.clientHeight;
      if (p.y < st + lh) ta.scrollTop = Math.max(0, p.y - lh * 2);
      else if (p.y + lh * 2 > st + ch) ta.scrollTop = p.y + lh * 3 - ch;
      if (!opt.wrap) { var sl = ta.scrollLeft, cwid = ta.clientWidth; if (p.x < sl + padL) ta.scrollLeft = Math.max(0, p.x - padL * 4); else if (p.x > sl + cwid - cw * 4) ta.scrollLeft = p.x - cwid + cw * 8; }
    }

    /* ------------------------------------------------------------ sửa (giữ hoàn tác) */
    function replaceRange(from, to, text, selS, selE) {
      ta.focus();
      ta.setSelectionRange(from, to);
      var ok = false;
      try { ok = D.execCommand && D.execCommand("insertText", false, text); } catch (e) { ok = false; }
      if (!ok) { ta.setRangeText(text, from, to, "end"); onInput({ inputType: "insertReplacementText" }); }
      if (selS != null) ta.setSelectionRange(selS, selE == null ? selS : selE);
    }
    function emitChange() { scheduleRender(); if (o.onChange) o.onChange(ta.value); }
    function onInput(e) {
      emitChange();
      if (!opt.completion || opt.readOnly) return;
      var t = e && e.inputType, d = e && e.data;
      if (t === "insertText" && d && d.length === 1) {
        if (isWord(d) || d === "." || d === ">" || d === ":" || d === "<" || d === "#" || d === '"') suggest(false, d);
        else closePop();
      } else if (t === "deleteContentBackward" && popState.open) suggest(false, "");
      else if (t !== "insertReplacementText") closePop();
    }

    /* ------------------------------------------------------------ gợi ý */
    function suggest(explicit, ch) {
      if (!CS.complete) return;
      var pos = ta.selectionStart;
      if (pos !== ta.selectionEnd) { closePop(); return; }
      if (!explicit && (ch === ">" || ch === ":") ) {                       /* chỉ bật với -> và :: */
        var two = ta.value.slice(pos - 2, pos);
        if (two !== "->" && two !== "::") { closePop(); return; }
      }
      var res = CS.complete.suggest({ text: ta.value, pos: pos, lang: lang, explicit: explicit, extraWords: o.extraWords ? o.extraWords() : [], files: o.files ? o.files() : [], limit: 60 });
      if (!res.items.length || res.context === "none") { closePop(); return; }
      if (!explicit && res.context === "word" && res.prefix.length < 1) { closePop(); return; }
      popState = { open: true, res: res, sel: 0 };
      drawPop();
    }
    function drawPop() {
      var r = popState.res, pre = r.prefix, h = "";
      r.items.forEach(function (it, k) {
        var kd = KIND[it.kind] || ["•", it.kind], lb = esc(it.label);
        if (pre && it.label.indexOf(pre) === 0) lb = "<b>" + esc(pre) + "</b>" + esc(it.label.slice(pre.length));
        h += '<div class="cse-it' + (k === popState.sel ? " on" : "") + '" role="option" id="' + id + "-o" + k + '" aria-selected="' + (k === popState.sel) + '" data-k="' + k + '">' +
          '<span class="cse-ik ' + esc(it.kind) + '" title="' + esc(kd[1]) + '">' + esc(kd[0]) + '</span><span class="cse-il">' + lb + "</span>" +
          (it.detail ? '<span class="cse-id">' + esc(it.detail) + "</span>" : "") + "</div>";
      });
      pop.innerHTML = h;
      pop.hidden = false;
      ta.setAttribute("aria-expanded", "true");
      ta.setAttribute("aria-activedescendant", id + "-o" + popState.sel);
      var p = xyOf(r.from), bx = body.getBoundingClientRect(), hx = host.getBoundingClientRect();
      var left = bx.left - hx.left + p.x - ta.scrollLeft - 28, top = bx.top - hx.top + p.y - ta.scrollTop + lineHeight(p.line);
      var pw = Math.min(380, host.clientWidth - 8), ph = Math.min(pop.scrollHeight, 260);
      left = Math.max(4, Math.min(left, host.clientWidth - pw - 4));
      if (top + ph > host.clientHeight - 4 && top - lineHeight(p.line) - ph > 0) top = top - lineHeight(p.line) - ph;
      pop.style.left = left + "px"; pop.style.top = top + "px"; pop.style.width = pw + "px";
      var on = pop.querySelector(".on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    }
    function closePop() { if (!popState.open) return; popState = { open: false, res: null, sel: 0 }; pop.hidden = true; ta.setAttribute("aria-expanded", "false"); ta.removeAttribute("aria-activedescendant"); }
    function movePop(d) { var n = popState.res.items.length; popState.sel = (popState.sel + d + n) % n; drawPop(); }
    function acceptPop(k) {
      var r = popState.res, it = r && r.items[k == null ? popState.sel : k];
      closePop();
      if (!it) return;
      var a = CS.complete.apply(ta.value, r, it, opt.indentUnit);
      replaceRange(a.from, a.to, a.insert, a.cursor);
      emitChange();
    }
    pop.addEventListener("mousedown", function (e) { e.preventDefault(); var it = e.target.closest(".cse-it"); if (it) acceptPop(+it.getAttribute("data-k")); });

    /* ------------------------------------------------------------ gõ thông minh */
    function inCodeContext() { var c = CS.complete ? CS.complete.contextAt(ta.value, ta.selectionStart, CS.langs.get(lang)) : { kind: "word" }; return c.kind !== "none"; }
    function typeChar(ch) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, next = v.charAt(e), prev = v.charAt(s - 1);
      if (CLOSE[ch] || ch === '"' || ch === "'" || ch === "`") {
        if (s === e && next === ch && (CLOSE[ch] || (prev !== "\\"))) { ta.setSelectionRange(s + 1, s + 1); return true; }   /* bước qua dấu đóng tự chèn */
      }
      if (CLOSE[ch] && s === e) {                                               /* `}` ở đầu dòng trống: lùi thụt một mức */
        var ls = lineStartOf(s), before = v.slice(ls, s);
        if (before && /^[ \t]+$/.test(before)) {
          var unit = opt.indentUnit, nb = before.slice(0, Math.max(0, before.length - (before.slice(-unit.length) === unit ? unit.length : (before.charAt(before.length - 1) === "\t" ? 1 : Math.min(before.length, unit.length)))));
          replaceRange(ls, s, nb + ch, ls + nb.length + 1);
          return true;
        }
      }
      var close = PAIRS[ch];
      if (!close) return false;
      if (s !== e) {                                                           /* bọc vùng chọn */
        var sel = v.slice(s, e);
        if (ch === "'" && /\w/.test(sel) && sel.indexOf("\n") < 0 && false) return false;
        replaceRange(s, e, ch + sel + close, s + 1, e + 1);
        return true;
      }
      var quote = ch === '"' || ch === "'" || ch === "`";
      if (quote) {
        if (ch === "'" && /^(rust|plaintext|markdown|html)$/.test(lang)) return false;
        if (ch === "`" && !/^(javascript|typescript|go|markdown|bash|sql|kotlin)$/.test(lang)) return false;
        if (isWord(prev) || prev === ch || prev === "\\") return false;
        if (!inCodeContext()) return false;
      }
      if (next && !/[\s)\]};,:]/.test(next)) return false;
      replaceRange(s, e, ch + close, s + 1);
      return true;
    }
    function newline() {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, ls = lineStartOf(s), lineBefore = v.slice(ls, s);
      var indent = (/^[ \t]*/.exec(lineBefore) || [""])[0], trimmed = lineBefore.replace(/\s+$/, ""), last = trimmed.slice(-1), next = v.charAt(e), unit = opt.indentUnit;
      var L = CS.langs.get(lang), extra = "";
      if (last === "{" || last === "(" || last === "[") extra = unit;
      else if (L.id === "python" && last === ":") extra = unit;
      else if ((L.id === "ruby" || L.id === "bash") && /(\bdo(\s*\|[^|]*\|)?|\bthen|\belse|\bdef\s.+|\bclass\s.+|\bbegin)$/.test(trimmed)) extra = unit;
      else if (L.family === "c" && /^\s*(case\b.*|default\s*):$/.test(trimmed)) extra = unit;
      else if (L.id === "html" && /<([A-Za-z][\w-]*)(\s[^>]*)?>$/.test(trimmed) && !/<\/|\/>$/.test(trimmed.slice(trimmed.lastIndexOf("<"))) && !/^(br|img|input|meta|link|hr)$/i.test((/<([A-Za-z][\w-]*)[^<]*>$/.exec(trimmed) || [])[1] || "")) extra = unit;
      if (L.id === "python" && /^\s*(return\b.*|pass|break|continue|raise\b.*)$/.test(trimmed) && indent.length >= unit.length) indent = indent.slice(0, indent.length - unit.length);
      if (s === e && ((last === "{" && next === "}") || (last === "(" && next === ")") || (last === "[" && next === "]") || (L.id === "html" && /^<\//.test(v.slice(e, e + 2)) && extra))) {
        var ins = "\n" + indent + extra + "\n" + indent;
        replaceRange(s, e, ins, s + 1 + indent.length + extra.length);
        return;
      }
      replaceRange(s, e, "\n" + indent + extra);
    }
    function smartBackspace() {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      if (s !== e || s === 0) return false;
      var prev = v.charAt(s - 1), next = v.charAt(s);
      if (PAIRS[prev] && PAIRS[prev] === next && opt.autoClose) { replaceRange(s - 1, s + 1, ""); return true; }
      var ls = lineStartOf(s), before = v.slice(ls, s), unit = opt.indentUnit;
      if (before && /^ +$/.test(before) && unit !== "\t") {
        var k = before.length % unit.length || unit.length;
        replaceRange(s - k, s, "");
        return true;
      }
      return false;
    }
    function smartHome(shift) {
      var s = ta.selectionStart, e = ta.selectionEnd, dir = ta.selectionDirection, head = dir === "backward" ? s : e, anchor = dir === "backward" ? e : s;
      var ls = lineStartOf(head), first = ls + ((/^[ \t]*/.exec(ta.value.slice(ls, lineEndOf(head))) || [""])[0]).length;
      var to = head === first ? ls : first;
      if (shift) { if (to < anchor) ta.setSelectionRange(to, anchor, "backward"); else ta.setSelectionRange(anchor, to, "forward"); }
      else ta.setSelectionRange(to, to);
      onCaret();
      return true;
    }
    function selLines() {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      var a = lineStartOf(s), endPos = e > s && v.charAt(e - 1) === "\n" ? e - 1 : e, b = lineEndOf(endPos);
      return { a: a, b: b, text: v.slice(a, b), s: s, e: e };
    }
    function indentLines(out) {
      var r = selLines(), unit = opt.indentUnit, lines = r.text.split("\n"), first = 0, total = 0;
      var res = lines.map(function (l, i) {
        if (!out) { if (!l.trim() && lines.length > 1) return l; if (i === 0) first = unit.length; total += unit.length; return unit + l; }
        var cut = l.indexOf(unit) === 0 ? unit.length : (l.charAt(0) === "\t" ? 1 : (/^ +/.exec(l) || [""])[0].length > 0 ? Math.min((/^ +/.exec(l) || [""])[0].length, unit.length) : 0);
        if (i === 0) first = -cut; total -= cut; return l.slice(cut);
      }).join("\n");
      replaceRange(r.a, r.b, res, Math.max(r.a, r.s + first), Math.max(r.a, r.e + total));
    }
    function toggleComment() {
      var r = selLines(), lc = LINE_COMMENT[lang], bc = BLOCK_COMMENT[lang], lines = r.text.split("\n"), res;
      if (lc) {
        var all = lines.every(function (l) { return !l.trim() || l.trim().indexOf(lc) === 0; });
        var minInd = Math.min.apply(null, lines.filter(function (l) { return l.trim(); }).map(function (l) { return (/^[ \t]*/.exec(l) || [""])[0].length; }).concat([1e9]));
        res = lines.map(function (l) {
          if (!l.trim()) return l;
          if (all) return l.replace(new RegExp("^(\\s*)" + lc.replace(/[\/#-]/g, "\\$&") + " ?"), "$1");
          return l.slice(0, minInd) + lc + " " + l.slice(minInd);
        }).join("\n");
      } else if (bc) {
        var t = r.text, ws = (/^\s*/.exec(t) || [""])[0], inner = t.trim();
        res = inner.indexOf(bc[0]) === 0 && inner.slice(-bc[1].length) === bc[1] ? ws + inner.slice(bc[0].length, inner.length - bc[1].length).replace(/^ /, "").replace(/ $/, "") : ws + bc[0] + " " + inner + " " + bc[1];
      } else return;
      replaceRange(r.a, r.b, res, r.a, r.a + res.length);
    }
    function moveLines(dir) {
      var v = ta.value, r = selLines();
      if (dir < 0) {
        if (r.a === 0) return;
        var pa = lineStartOf(r.a - 1), prevLine = v.slice(pa, r.a - 1);
        replaceRange(pa, r.b, r.text + "\n" + prevLine, r.s - prevLine.length - 1, r.e - prevLine.length - 1);
      } else {
        if (r.b >= v.length) return;
        var nb = lineEndOf(r.b + 1), nextLine = v.slice(r.b + 1, nb);
        replaceRange(r.a, nb, nextLine + "\n" + r.text, r.s + nextLine.length + 1, r.e + nextLine.length + 1);
      }
    }
    function dupLines(dir) {
      var r = selLines();
      if (dir < 0) replaceRange(r.a, r.b, r.text + "\n" + r.text, r.s, r.e);
      else replaceRange(r.a, r.b, r.text + "\n" + r.text, r.s + r.text.length + 1, r.e + r.text.length + 1);
    }
    function deleteLines() {
      var v = ta.value, r = selLines(), a = r.a, b = r.b < v.length ? r.b + 1 : r.b;
      if (b === r.b && a > 0) a--;
      replaceRange(a, b, "", Math.min(a, v.length));
    }

    /* ------------------------------------------------------------ khớp ngoặc */
    function tokenAt(pos) {
      var lo = 0, hi = toks.length - 1;
      while (lo <= hi) { var mid = (lo + hi) >> 1, t = toks[mid]; if (t.i + t.v.length <= pos) lo = mid + 1; else if (t.i > pos) hi = mid - 1; else return mid; }
      return -1;
    }
    function drawBrackets() {
      br.innerHTML = "";
      if (D.activeElement !== ta || ta.selectionStart !== ta.selectionEnd || lastVal !== ta.value) return;
      var pos = ta.selectionStart, k = -1, cand = [pos - 1, pos];
      for (var c = 0; c < 2 && k < 0; c++) { var q = tokenAt(cand[c]); if (q >= 0 && toks[q].k === "pn" && /^[()[\]{}]$/.test(toks[q].v)) k = q; }
      if (k < 0) return;
      var t = toks[k], open = PAIRS[t.v] ? t.v : CLOSE[t.v], close = PAIRS[open], dir = PAIRS[t.v] ? 1 : -1, depth = 0, m = -1;
      for (var j = k; j >= 0 && j < toks.length && Math.abs(j - k) < 20000; j += dir) {
        var u = toks[j];
        if (u.k !== "pn") continue;
        if (u.v === t.v) depth++; else if (u.v === (dir > 0 ? close : open)) { depth--; if (depth === 0) { m = j; break; } }
      }
      var h = "";
      [t].concat(m >= 0 ? [toks[m]] : []).forEach(function (u) { var p = xyOf(u.i); h += '<div class="cse-bm' + (m < 0 ? " bad" : "") + '" style="left:' + p.x + "px;top:" + p.y + "px;width:" + cw + "px;height:" + lineHeight(p.line) + 'px"></div>'; });
      br.innerHTML = h;
    }

    /* ------------------------------------------------------------ tìm / thay */
    var fq = $(".cse-q"), fr = $(".cse-r"), fg = $(".cse-g"), fcnt = $(".cse-cnt");
    function findRegex() {
      var q = fq.value;
      if (!q) return null;
      try {
        var src = find.re ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (find.word) src = "\\b" + src + "\\b";
        find.err = "";
        return new RegExp(src, "g" + (find.cs ? "" : "i") + "u");
      } catch (e) { find.err = "Biểu thức sai"; return null; }
    }
    function computeMatches() {
      find.matches = [];
      var re = findRegex(), v = ta.value, m;
      if (re) while ((m = re.exec(v)) && find.matches.length < 20000) { if (!m[0].length) { re.lastIndex++; continue; } find.matches.push({ s: m.index, e: m.index + m[0].length }); }
      updateCount();
      scheduleMarks();
    }
    function updateCount() { fcnt.textContent = find.err ? find.err : (fq.value ? (find.matches.length ? (find.idx + 1 > 0 ? (find.idx + 1) + "/" : "") + find.matches.length : "Không có") : ""); fcnt.classList.toggle("bad", !!find.err || (!!fq.value && !find.matches.length)); }
    function findStep(dir, from) {
      if (!find.matches.length) { updateCount(); return; }
      var pos = from != null ? from : (dir > 0 ? ta.selectionEnd : ta.selectionStart), k = -1, i;
      if (dir > 0) { for (i = 0; i < find.matches.length; i++) if (find.matches[i].s >= pos) { k = i; break; } if (k < 0) k = 0; }
      else { for (i = find.matches.length - 1; i >= 0; i--) if (find.matches[i].e <= pos) { k = i; break; } if (k < 0) k = find.matches.length - 1; }
      find.idx = k;
      var mm = find.matches[k];
      ta.setSelectionRange(mm.s, mm.e);
      reveal(mm.s);
      updateCount(); scheduleMarks(); onCaret();
    }
    function openFind(mode) {
      find.mode = mode;
      findBar.hidden = false;
      $(".cse-rrow").hidden = mode !== "replace";
      $(".cse-grow").hidden = mode !== "goto";
      $(".cse-frow").hidden = mode === "goto";
      if (mode === "goto") { fg.value = String(caret().line + 1); fg.focus(); fg.select(); return; }
      var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && sel.indexOf("\n") < 0) fq.value = sel;
      fq.focus(); fq.select();
      computeMatches();
      if (o.onLayout) o.onLayout();
    }
    function closeFind() { find.mode = null; findBar.hidden = true; find.matches = []; scheduleMarks(); ta.focus(); if (o.onLayout) o.onLayout(); }
    function replaceOne() {
      var mm = find.matches[find.idx];
      if (!mm || ta.selectionStart !== mm.s || ta.selectionEnd !== mm.e) { findStep(1); return; }
      var re = findRegex(); if (!re) return;
      var txt = ta.value.slice(mm.s, mm.e), rep = find.re ? txt.replace(new RegExp(re.source, re.flags.replace("g", "")), fr.value) : fr.value;
      replaceRange(mm.s, mm.e, rep, mm.s + rep.length);
      emitChange(); computeMatches(); findStep(1, mm.s + rep.length);
    }
    function replaceAll() {
      var re = findRegex(); if (!re) return;
      var v = ta.value, n = 0, out = v.replace(re, function () { n++; return find.re ? arguments[0].replace(new RegExp(re.source, re.flags.replace("g", "")), fr.value) : fr.value; });
      if (!n) return;
      var cpos = ta.selectionStart;
      replaceRange(0, v.length, out, Math.min(cpos, out.length));
      emitChange(); computeMatches();
      fcnt.textContent = "Đã thay " + n;
    }
    fq.addEventListener("input", function () { find.idx = -1; computeMatches(); if (find.matches.length) findStep(1, ta.selectionStart); });
    fq.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { e.preventDefault(); closeFind(); }
      else if (e.altKey && /^[cwr]$/i.test(e.key)) { e.preventDefault(); toggleFlag({ c: "cs", w: "word", r: "re" }[e.key.toLowerCase()]); }
    });
    fr.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.ctrlKey && e.altKey) { e.preventDefault(); replaceAll(); }
      else if (e.key === "Enter") { e.preventDefault(); replaceOne(); }
      else if (e.key === "Escape") { e.preventDefault(); closeFind(); }
    });
    fg.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); gotoFromBar(); } else if (e.key === "Escape") { e.preventDefault(); closeFind(); } });
    function gotoFromBar() { var n = parseInt(fg.value, 10); if (n > 0) { closeFind(); goTo(n, 1); } }
    function toggleFlag(f) { find[f] = !find[f]; var b = findBar.querySelector('[data-f="' + f + '"]'); if (b) b.setAttribute("aria-pressed", String(find[f])); computeMatches(); }
    findBar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var f = b.getAttribute("data-f");
      if (f === "cs" || f === "word" || f === "re") toggleFlag(f);
      else if (f === "next") findStep(1); else if (f === "prev") findStep(-1);
      else if (f === "close") closeFind(); else if (f === "rep") replaceOne(); else if (f === "all") replaceAll(); else if (f === "go") gotoFromBar();
    });

    /* dấu tô: kết quả tìm (hoặc các chỗ trùng từ dưới con trỏ) — chỉ vẽ phần đang thấy */
    function scheduleMarks() { if (!rafM) rafM = (root.requestAnimationFrame || setTimeout)(drawMarks); }
    function visibleRange() {
      var st = ta.scrollTop, ch = ta.clientHeight || 400, first, last;
      if (!opt.wrap) { first = Math.max(0, Math.floor((st - padT) / lh) - 1); last = Math.min(lineCount - 1, Math.ceil((st + ch) / lh) + 1); }
      else { first = 0; last = lineCount - 1; for (var i = 0; i < lineDivs.length; i++) { var t = lineDivs[i].offsetTop; if (t + lineDivs[i].offsetHeight < st - lh) first = i; if (t > st + ch + lh) { last = i; break; } } }
      return { a: offsetOfLine(first), b: offsetOfLine(last + 1) };
    }
    function drawMarks() {
      rafM = 0;
      var list = [], cls = "f";
      var vr = visibleRange();
      if (find.mode && find.mode !== "goto" && find.matches.length) {
        list = find.matches.filter(function (m) { return m.e >= vr.a && m.s <= vr.b; });
      } else if (opt.occurrences && D.activeElement === ta) {
        var w = wordAtCaret();
        if (w && w.length >= 2) {
          cls = "o";
          var re = new RegExp("\\b" + w.replace(/[$]/g, "\\$") + "\\b", "g"), seg = ta.value.slice(vr.a, vr.b), m2, n = 0;
          while ((m2 = re.exec(seg)) && n < 400) { n++; list.push({ s: vr.a + m2.index, e: vr.a + m2.index + w.length }); }
          if (list.length < 2) list = [];
        }
      }
      var h = "", cur = find.matches[find.idx];
      list.slice(0, 2000).forEach(function (m) {
        var p = xyOf(m.s), le = lineEndOf(m.s), endPos = Math.min(m.e, le), pe = xyOf(endPos), wdt = Math.max(cw * 0.6, pe.x - p.x + (pe.y > p.y ? cw : 0));
        h += '<div class="cse-m ' + cls + (cur && cur.s === m.s && cls === "f" ? " cur" : "") + '" style="left:' + p.x + "px;top:" + p.y + "px;width:" + (pe.y > p.y ? cw * 2 : wdt) + "px;height:" + lh + 'px"></div>';
      });
      mk.innerHTML = h;
    }
    function wordAtCaret() {
      if (ta.selectionStart !== ta.selectionEnd) { var s = ta.value.slice(ta.selectionStart, ta.selectionEnd); return /^[A-Za-z_$][\w$]*$/.test(s) ? s : ""; }
      var v = ta.value, p = ta.selectionStart, a = p, b = p;
      while (a > 0 && /[\w$]/.test(v.charAt(a - 1))) a--;
      while (b < v.length && /[\w$]/.test(v.charAt(b))) b++;
      var w = v.slice(a, b);
      return /^[A-Za-z_$]/.test(w) ? w : "";
    }

    /* ------------------------------------------------------------ con trỏ */
    function onCaret() {
      if (rafC) return;
      rafC = (root.requestAnimationFrame || setTimeout)(function () {
        rafC = 0;
        drawBg(); scheduleMarks();
        if (o.onCursor) { var c = caret(); o.onCursor({ line: c.line + 1, col: c.col + 1, selected: Math.abs(ta.selectionEnd - ta.selectionStart) }); }
      });
    }
    function goTo(line, col) {
      var p = offsetOfLine(Math.max(0, (line | 0) - 1)), le = lineEndOf(p);
      p = Math.min(le, p + Math.max(0, (col || 1) - 1));
      ta.focus(); ta.setSelectionRange(p, p); reveal(p); onCaret();
    }
    function zoom(d) { opt.fontSize = d === 0 ? (o.fontSize || 14) : Math.max(9, Math.min(32, opt.fontSize + d)); applyFont(); gutterSig = ""; lastVal = null; render(); if (o.onOptions) o.onOptions({ fontSize: opt.fontSize }); }

    /* ------------------------------------------------------------ phím */
    ta.addEventListener("keydown", function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (popState.open) {
        if (k === "ArrowDown") { e.preventDefault(); movePop(1); return; }
        if (k === "ArrowUp") { e.preventDefault(); movePop(-1); return; }
        if (k === "PageDown") { e.preventDefault(); movePop(8); return; }
        if (k === "PageUp") { e.preventDefault(); movePop(-8); return; }
        if ((k === "Enter" && !mod) || k === "Tab") { e.preventDefault(); acceptPop(); return; }
        if (k === "Escape") { e.preventDefault(); closePop(); return; }
        if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") closePop();
      }
      if (mod && (k === " " || e.code === "Space")) { e.preventDefault(); suggest(true, ""); return; }
      if (mod && k === "Enter") { e.preventDefault(); if (o.onRun) o.onRun(); return; }
      if (mod && !e.shiftKey && (k === "s" || k === "S")) { e.preventDefault(); if (o.onSave) o.onSave(); return; }
      if ((e.shiftKey && e.altKey && (k === "F" || k === "f" || e.code === "KeyF")) || (mod && e.shiftKey && (k === "I" || k === "i"))) { e.preventDefault(); if (o.onFormat) o.onFormat(); return; }
      if (mod && !e.shiftKey && (k === "f" || k === "F")) { e.preventDefault(); openFind("find"); return; }
      if (mod && (k === "h" || k === "H")) { e.preventDefault(); openFind("replace"); return; }
      if (mod && (k === "g" || k === "G")) { e.preventDefault(); openFind("goto"); return; }
      if (k === "F3") { e.preventDefault(); if (!find.mode) openFind("find"); else findStep(e.shiftKey ? -1 : 1); return; }
      if (k === "Escape" && find.mode) { e.preventDefault(); closeFind(); return; }
      if (mod && (k === "=" || k === "+")) { e.preventDefault(); zoom(1); return; }
      if (mod && k === "-") { e.preventDefault(); zoom(-1); return; }
      if (mod && k === "0") { e.preventDefault(); zoom(0); return; }
      if (e.altKey && !mod && (k === "z" || k === "Z" || e.code === "KeyZ")) { e.preventDefault(); setOptions({ wrap: !opt.wrap }); if (o.onOptions) o.onOptions({ wrap: opt.wrap }); return; }
      if (opt.readOnly) return;
      if (mod && k === "/") { e.preventDefault(); toggleComment(); return; }
      if (e.altKey && !mod && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); if (e.shiftKey) dupLines(k === "ArrowUp" ? -1 : 1); else moveLines(k === "ArrowUp" ? -1 : 1); return; }
      if (mod && e.shiftKey && (k === "K" || k === "k")) { e.preventDefault(); deleteLines(); return; }
      if (mod && (k === "]" || k === "[")) { e.preventDefault(); indentLines(k === "["); return; }
      if (k === "Tab" && !mod && !e.altKey) {
        e.preventDefault();
        var multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf("\n") >= 0;
        if (e.shiftKey || multi) indentLines(e.shiftKey);
        else replaceRange(ta.selectionStart, ta.selectionEnd, opt.indentUnit);
        return;
      }
      if (k === "Enter" && !mod && !e.altKey) { e.preventDefault(); newline(); return; }
      if (k === "Backspace" && !mod && !e.altKey) { if (smartBackspace()) e.preventDefault(); return; }
      if (k === "Home" && !e.altKey && !mod) { e.preventDefault(); smartHome(e.shiftKey); return; }
      if (opt.autoClose && k.length === 1 && !mod && !e.altKey) { if (typeChar(k)) { e.preventDefault(); emitChange(); if (opt.completion && (k === '"' || k === "<")) suggest(false, k); } }
    });
    ta.addEventListener("input", onInput);
    ta.addEventListener("scroll", scrollSync);
    ta.addEventListener("blur", function () { setTimeout(function () { if (D.activeElement !== ta) { closePop(); drawBg(); mk.innerHTML = find.mode ? mk.innerHTML : ""; } }, 120); });
    ta.addEventListener("focus", onCaret);
    ["keyup", "mouseup", "select"].forEach(function (ev) { ta.addEventListener(ev, onCaret); });
    ta.addEventListener("mousedown", function () { closePop(); });
    var selListener = function () { if (D.activeElement === ta) onCaret(); };
    D.addEventListener("selectionchange", selListener);
    var ro = root.ResizeObserver ? new root.ResizeObserver(function () { measure(); gutterSig = ""; if (opt.wrap) { lastVal = null; } scheduleRender(); }) : null;
    if (ro) ro.observe(body);

    /* hàng phím ký hiệu (điện thoại) */
    if (opt.keys && !opt.readOnly) {
      MOBILE_KEYS.forEach(function (p) {
        var b = D.createElement("button");
        b.type = "button"; b.textContent = p[0];
        b.setAttribute("aria-label", p[1] === "\t" ? "Thụt dòng" : p[1] === "undo" ? "Hoàn tác" : p[1] === "redo" ? "Làm lại" : "Chèn " + p[0]);
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); });
        b.addEventListener("click", function () {
          ta.focus();
          if (p[1] === "undo" || p[1] === "redo") { try { D.execCommand(p[1]); } catch (e) { /* bỏ qua */ } return; }
          if (p[1] === "\t") { replaceRange(ta.selectionStart, ta.selectionEnd, opt.indentUnit); return; }
          if (!(opt.autoClose && typeChar(p[1]))) replaceRange(ta.selectionStart, ta.selectionEnd, p[1]);
          emitChange();
        });
        keys.appendChild(b);
      });
    } else keys.remove();

    /* ------------------------------------------------------------ API */
    function setValue(v, keepPos) {
      var s = ta.selectionStart;
      ta.value = v == null ? "" : String(v);
      if (keepPos) ta.setSelectionRange(Math.min(s, ta.value.length), Math.min(s, ta.value.length));
      else { ta.setSelectionRange(0, 0); ta.scrollTop = 0; ta.scrollLeft = 0; }
      markers = {}; gutterSig = ""; lastVal = null; closePop();
      render(); scrollSync();
    }
    /* thay cả văn bản bằng một bước hoàn tác (vd sau khi định dạng), cố giữ con trỏ cùng dòng */
    function replaceAllText(v) {
      if (v === ta.value) return false;
      var c = caret(), st = ta.scrollTop;
      replaceRange(0, ta.value.length, v);
      var p = offsetOfLine(Math.min(c.line, v.split("\n").length - 1));
      ta.setSelectionRange(p, p);
      ta.scrollTop = st;
      emitChange(); scrollSync();
      return true;
    }
    function setOptions(n) {
      Object.keys(n || {}).forEach(function (k) { if (k in opt) opt[k] = n[k]; });
      ta.readOnly = opt.readOnly;
      applyFont(); gutterSig = ""; lastVal = null; render(); scrollSync();
    }
    function setLang(l) { lang = l || "plaintext"; lastVal = null; scheduleRender(); }
    function setMarkers(list) {
      markers = {};
      var rank = { error: 3, warning: 2, note: 1 };
      (list || []).forEach(function (m) {
        var ln = m.line | 0; if (ln < 1) return;
        var sev = m.severity || "error", cur = markers[ln];
        if (!cur || (rank[sev] || 0) > (rank[cur.severity] || 0)) markers[ln] = { severity: sev, message: String(m.message || "").slice(0, 300) };
        else if (cur.message.length < 600) cur.message += "\n" + String(m.message || "").slice(0, 200);
      });
      gutterSig = ""; drawGutter(); drawBg();
    }
    function destroy() { D.removeEventListener("selectionchange", selListener); if (ro) ro.disconnect(); host.innerHTML = ""; host.classList.remove("cse"); }

    applyFont();
    render();
    scrollSync();
    return {
      el: host, textarea: ta,
      getValue: function () { return ta.value; }, setValue: setValue, replaceAllText: replaceAllText,
      getLang: function () { return lang; }, setLang: setLang,
      focus: function () { ta.focus(); }, insert: function (t) { replaceRange(ta.selectionStart, ta.selectionEnd, t); emitChange(); },
      replaceRange: function (a, b, t, s, e) { replaceRange(a, b, t, s, e); emitChange(); },
      getSelection: function () { return { start: ta.selectionStart, end: ta.selectionEnd, text: ta.value.slice(ta.selectionStart, ta.selectionEnd) }; },
      setSelection: function (s, e) { ta.focus(); ta.setSelectionRange(s, e == null ? s : e); reveal(s); onCaret(); },
      cursor: function () { var c = caret(); return { line: c.line + 1, col: c.col + 1, offset: ta.selectionStart }; },
      setMarkers: setMarkers, goTo: goTo, reveal: reveal,
      setOptions: setOptions, getOptions: function () { return Object.assign({}, opt); },
      openFind: openFind, closeFind: closeFind, toggleComment: toggleComment, suggest: function () { suggest(true, ""); },
      refresh: function () { measure(); gutterSig = ""; lastVal = null; render(); scrollSync(); },
      destroy: destroy
    };
  }

  CS.editor = { create: create, splitLines: splitLines };
})(window);
