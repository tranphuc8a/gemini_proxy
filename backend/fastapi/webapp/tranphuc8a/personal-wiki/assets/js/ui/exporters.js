/* ui/exporters.js — xuất một ghi chú ra PDF (hộp thoại in của trình duyệt) hoặc ảnh PNG.

   PDF  Dựng bản in riêng (#printArea) rồi gọi window.print(): chữ chọn được, đúng tiếng Việt, ngắt trang tự nhiên; người dùng chọn "Lưu thành PDF".
   PNG  Tự bố cục và vẽ lên canvas (tiêu đề, đoạn, danh sách, trích dẫn, khối code, bảng, thẻ hỏi–đáp) rồi toBlob. KHÔNG dùng SVG <foreignObject>:
        cách đó làm canvas "nhiễm bẩn" trên WebKit (Safari/iPhone) và toBlob ném lỗi bảo mật. Vẽ tay chạy giống nhau trên mọi trình duyệt. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, M = W.markdown, U = W.ui, h = U.h;

  function render(note, repo, noLinks) {
    return M.render(note.content, { noLinks: !!noLinks, highlight: noLinks ? null : W.highlight, resolve: function (t) { var hd = repo.resolve(t); return hd ? { id: hd.id, status: hd.s } : null; } });
  }

  // ------------------------------------------------------------------------------------------------- in / PDF
  function print(note, ctx) {
    var area = h("div", { id: "printArea", class: "md print-doc" });
    area.innerHTML = "<h1>" + T.esc(note.title) + "</h1>" + (note.tags.length ? '<p class="print-tags">' + note.tags.map(function (t) { return "#" + T.esc(t); }).join("  ") + "</p>" : "") + render(note, ctx.repo, true) +
      '<p class="print-foot">Personal Wiki · ' + T.esc(T.fmtDate(note.updated_at)) + "</p>";
    var body = root.document.body, cleaned = false;
    function done() { if (cleaned) return; cleaned = true; area.remove(); body.classList.remove("printing"); root.removeEventListener("afterprint", done); }
    root.addEventListener("afterprint", done);
    body.append(area); body.classList.add("printing");
    setTimeout(function () { try { root.print(); } catch (e) { done(); ctx.toast("Trình duyệt này không mở được hộp thoại in."); } }, 60);
    setTimeout(done, 180000);                                             // iOS không phát afterprint
    ctx.toast("Chọn “Lưu thành PDF” trong hộp thoại in", { ms: 5000 });
  }

  // ------------------------------------------------------------------------------------------------- ảnh PNG
  var WIDTH = 780, PAD = 44, MAX_H = 14000, SCALE = 2;
  var SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif', MONO = 'ui-monospace, Consolas, "SF Mono", monospace';
  var COL = { text: "#14202f", dim: "#5a6a80", line: "#d5dde9", code: "#eef2f8", accent: "#2159d6", quote: "#8fa3c0", card: "#f1f5fd", bg: "#ffffff" };
  var HEAD = { H1: 30, H2: 24, H3: 20, H4: 18, H5: 16, H6: 16 };

  /** Phần tử → các đoạn chữ liền kề {text, bold, italic, code, strike, link} theo thứ tự. */
  function runsOf(node, fmt, out) {
    out = out || [];
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3) { out.push(Object.assign({ text: c.nodeValue.replace(/\s+/g, " ") }, fmt)); return; }
      if (c.nodeType !== 1) return;
      var t = c.tagName, f = Object.assign({}, fmt);
      if (t === "BR") { out.push({ br: true }); return; }
      if (t === "STRONG" || t === "B") f.bold = true; else if (t === "EM" || t === "I") f.italic = true; else if (t === "CODE") f.code = true; else if (t === "DEL") f.strike = true;
      else if (t === "A" || (t === "SPAN" && c.classList.contains("wl"))) f.link = true;
      else if (t === "IMG") { out.push(Object.assign({ text: "[ảnh: " + (c.getAttribute("alt") || "") + "]" }, fmt, { italic: true })); return; }
      else if (t === "INPUT") { out.push(Object.assign({ text: c.checked ? "☑ " : "☐ " }, fmt)); return; }
      else if (t === "UL" || t === "OL") return;
      runsOf(c, f, out);
    });
    return out;
  }

  function Painter(c, draw) {
    var y = PAD;
    function font(size, f) { c.font = (f.italic ? "italic " : "") + (f.bold ? "700 " : "400 ") + size + "px " + (f.code ? MONO : SANS); }
    /** Bọc chữ theo bề rộng; trả {lines:[{segs:[{text,x,f}], w}], h}. */
    function wrap(runs, size, width, lh) {
      var lines = [], cur = { segs: [], w: 0 };
      function push() { lines.push(cur); cur = { segs: [], w: 0 }; }
      runs.forEach(function (r) {
        if (r.br) { push(); return; }
        font(size, r);
        r.text.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          var wd = c.measureText(w).width;
          if (cur.w + wd > width && cur.w > 0 && !/^\s+$/.test(w)) push();
          if (cur.w === 0 && /^\s+$/.test(w)) return;
          if (wd > width) { var chunk = ""; Array.from(w).forEach(function (ch) { if (c.measureText(chunk + ch).width > width && chunk) { cur.segs.push({ text: chunk, x: cur.w, f: r }); cur.w += c.measureText(chunk).width; push(); chunk = ""; } chunk += ch; }); w = chunk; wd = c.measureText(w).width; }
          cur.segs.push({ text: w, x: cur.w, f: r }); cur.w += wd;
        });
      });
      if (cur.segs.length || !lines.length) push();
      return { lines: lines, h: lines.length * lh };
    }
    function text(runs, size, x0, width, color, lh) {
      lh = lh || Math.round(size * 1.55);
      var wr = wrap(runs, size, width, lh);
      if (draw) wr.lines.forEach(function (ln, i) {
        ln.segs.forEach(function (s) {
          font(size, s.f); var sx = x0 + s.x, sy = y + i * lh + size;
          if (s.f.code) { c.fillStyle = COL.code; c.fillRect(sx - 1, sy - size + 1, c.measureText(s.text).width + 2, lh - 4); }
          c.fillStyle = s.f.link ? COL.accent : color; c.fillText(s.text, sx, sy);
          if (s.f.strike) c.fillRect(sx, sy - size * 0.3, c.measureText(s.text).width, 1.3);
          if (s.f.link) c.fillRect(sx, sy + 2, c.measureText(s.text).width, 1);
        });
      });
      y += wr.h; return wr.h;
    }
    function block(el, x0, width) {
      var t = el.tagName;
      if (HEAD[t]) { y += 14; text(runsOf(el, { bold: true }), HEAD[t], x0, width, COL.text, Math.round(HEAD[t] * 1.35)); if (t === "H1" || t === "H2") { if (draw) { c.fillStyle = COL.line; c.fillRect(x0, y + 2, width, 1); } y += 8; } y += 6; }
      else if (t === "P") { text(runsOf(el, {}), 16, x0, width, COL.text); y += 12; }
      else if (t === "UL" || t === "OL") { list(el, x0, width, 0); y += 8; }
      else if (t === "BLOCKQUOTE") { var y0 = y; y += 4; Array.prototype.forEach.call(el.children, function (k) { block(k, x0 + 20, width - 20); }); if (draw) { c.fillStyle = COL.quote; c.fillRect(x0, y0, 4, Math.max(8, y - y0 - 6)); } y += 4; }
      else if (t === "PRE") {
        var code = el.textContent.replace(/\n$/, ""), lines = [];
        c.font = "14px " + MONO;
        code.split("\n").forEach(function (ln) { var cur = ""; Array.from(ln).forEach(function (ch) { if (c.measureText(cur + ch).width > width - 24 && cur) { lines.push(cur); cur = ""; } cur += ch; }); lines.push(cur); });
        var hh = lines.length * 21 + 20;
        if (draw) { c.fillStyle = COL.code; c.fillRect(x0, y, width, hh); c.fillStyle = COL.text; c.font = "14px " + MONO; lines.forEach(function (ln, i) { c.fillText(ln, x0 + 12, y + 10 + i * 21 + 14); }); }
        y += hh + 14;
      }
      else if (t === "HR") { if (draw) { c.fillStyle = COL.line; c.fillRect(x0, y + 8, width, 2); } y += 22; }
      else if (t === "DIV" && el.classList.contains("tbl")) table(el.querySelector("table"), x0, width);
      else if (t === "DIV" && el.classList.contains("fc")) {
        var q = el.querySelector(".fc-q"), a = el.querySelector(".fc-a"), qr = runsOf(q, {}).filter(function (r) { return r.text !== "Hỏi"; }), ar = runsOf(a, {}).filter(function (r) { return r.text !== "Đáp"; }), top = y;
        y += 12; if (draw) { c.fillStyle = COL.card; c.fillRect(x0, top, width, 0); }
        var save = y; var qh = text(qr, 16, x0 + 16, width - 32, COL.text); y += 6; var ah = text(ar, 16, x0 + 16, width - 32, COL.dim); y += 12;
        if (draw) { /* nền vẽ sau cùng bằng destination-over để không che chữ */ c.save(); c.globalCompositeOperation = "destination-over"; c.fillStyle = COL.card; c.fillRect(x0, top, width, y - top); c.restore(); }
        y += 10;
      }
      else if (t === "DIV") Array.prototype.forEach.call(el.children, function (k) { block(k, x0, width); });
      else if (el.children.length) Array.prototype.forEach.call(el.children, function (k) { block(k, x0, width); });
      else if (el.textContent.trim()) { text(runsOf(el, {}), 16, x0, width, COL.text); y += 8; }
    }
    function list(el, x0, width, depth) {
      var n = 0;
      Array.prototype.forEach.call(el.children, function (li) {
        if (li.tagName !== "LI") return;
        n++;
        var marker = el.tagName === "OL" ? n + "." : "•", mw = 26 + depth * 0;
        if (draw) { c.font = "16px " + SANS; c.fillStyle = COL.dim; c.fillText(marker, x0, y + 16); }
        text(runsOf(li, {}), 16, x0 + mw, width - mw, COL.text); y += 4;
        Array.prototype.forEach.call(li.children, function (k) { if (k.tagName === "UL" || k.tagName === "OL") list(k, x0 + mw, width - mw, depth + 1); });
      });
    }
    function table(tb, x0, width) {
      if (!tb) return;
      var rows = Array.prototype.map.call(tb.querySelectorAll("tr"), function (tr) { return Array.prototype.map.call(tr.children, function (td) { return { runs: runsOf(td, td.tagName === "TH" ? { bold: true } : {}), head: td.tagName === "TH" }; }); }), cols = Math.max.apply(null, rows.map(function (r) { return r.length; })) || 1, cw = width / cols;
      rows.forEach(function (r) {
        var y0 = y, maxH = 0;
        r.forEach(function (cell, i) { var sy = y; var hgt = text(cell.runs, 15, x0 + i * cw + 8, cw - 16, COL.text, 22); maxH = Math.max(maxH, hgt); y = sy; });
        y = y0 + maxH + 14;
        if (draw) { c.fillStyle = COL.line; c.fillRect(x0, y, width, 1); if (r[0] && r[0].head) { c.save(); c.globalCompositeOperation = "destination-over"; c.fillStyle = COL.code; c.fillRect(x0, y0, width, y - y0); c.restore(); } }
      });
      y += 14;
    }
    return { block: block, at: function () { return y; }, set: function (v) { y = v; }, text: text };
  }

  function png(note, ctx) {
    var html = "<h1>" + T.esc(note.title) + "</h1>" + render(note, ctx.repo, true), doc = new root.DOMParser().parseFromString("<div>" + html + "</div>", "text/html"), rootEl = doc.body.firstChild;
    var meas = root.document.createElement("canvas").getContext("2d"), pm = Painter(meas, false);
    Array.prototype.forEach.call(rootEl.children, function (k) { pm.block(k, PAD, WIDTH - PAD * 2); });
    var total = Math.min(MAX_H, Math.ceil(pm.at() + PAD + 30)), cut = pm.at() + PAD + 30 > MAX_H, cv = root.document.createElement("canvas");
    cv.width = WIDTH * SCALE; cv.height = total * SCALE;
    var c = cv.getContext("2d"); c.scale(SCALE, SCALE); c.fillStyle = COL.bg; c.fillRect(0, 0, WIDTH, total); c.textBaseline = "alphabetic";
    var pd = Painter(c, true);
    Array.prototype.forEach.call(rootEl.children, function (k) { pd.block(k, PAD, WIDTH - PAD * 2); });
    c.font = "13px " + SANS; c.fillStyle = COL.dim; c.fillText("Personal Wiki · " + T.fmtDate(note.updated_at) + (cut ? " · (đã cắt bớt phần dài)" : ""), PAD, total - 22);
    return new Promise(function (resolve) {
      cv.toBlob(function (b) {
        if (!b) { ctx.toast("Không xuất được ảnh (ghi chú quá dài?)."); return resolve(null); }
        U.download(W.backup.safeName(note.title) + ".png", b); ctx.toast("Đã tải ảnh PNG"); resolve(b);
      }, "image/png");
    });
  }

  U.exporters = { print: print, png: png };
})(typeof globalThis !== "undefined" ? globalThis : this);
