/* ui/exporters.js — In / Lưu PDF: dựng bản in riêng vào #printArea (chữ chọn được, đúng tiếng Việt, ngắt trang tự nhiên) rồi gọi window.print();
   người dùng chọn "Lưu thành PDF". CSS in chỉ cho #printArea hiện (xem cuối app.css). iOS không phát afterprint nên có hẹn giờ dọn. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, M = A.markdown, U = A.ui, C = A.catalog, lib = A.lib;

  function render(md) { return M.render(md, { noLinks: true, highlight: null, resolve: function (t) { var e = C.byName(t); return e ? { id: e.id, status: "active" } : null; } }); }

  function printHtml(html, ctx, title) {
    var area = root.document.getElementById("printArea"), body = root.document.body, cleaned = false;
    area.className = "md print-doc"; area.innerHTML = html;
    function done() { if (cleaned) return; cleaned = true; area.replaceChildren(); area.className = ""; body.classList.remove("printing"); root.removeEventListener("afterprint", done); root.document.title = prevTitle; }
    var prevTitle = root.document.title; if (title) root.document.title = title;
    root.addEventListener("afterprint", done);
    body.classList.add("printing");
    setTimeout(function () { try { root.print(); } catch (e) { done(); ctx.toast("Trình duyệt này không mở được hộp thoại in."); } }, 60);
    setTimeout(done, 180000);
    ctx.toast("Chọn “Lưu thành PDF” trong hộp thoại in", { ms: 5000 });
  }

  function printEntry(e, note, ctx) {
    printHtml(render(A.backup.entryToMarkdown(e, note).replace(/^---[\s\S]*?---\n/, "")) + '<p class="print-foot">Algorithm Notebook · ' + T.esc(T.fmtDate(Date.now())) + "</p>", ctx, e.name);
  }
  function printCheat(entries, title, ctx) {
    var by = {}; entries.forEach(function (e) { (by[e.category] = by[e.category] || []).push(e); });
    var html = "<h1>" + T.esc(title) + "</h1>";
    lib.CATEGORIES.concat([C.MINE]).forEach(function (c) {
      if (!by[c.id]) return;
      html += "<h2>" + T.esc(c.name) + '</h2><div class="pc-grid">' + by[c.id].map(function (e) {
        var cx = e.complexity || {};
        return '<div class="pc"><b>' + T.esc(e.name) + '</b><div class="pc-cx">' + T.esc(cx.time || "—") + (cx.space ? " · " + T.esc(cx.space) : "") + "</div>" + (e.ops || []).slice(0, 5).map(function (o) { return "<div>" + T.esc(o[0]) + ": <code>" + T.esc(o[1]) + "</code></div>"; }).join("") + ((e.use_case || [])[0] ? '<div class="pc-use">' + T.esc(e.use_case[0]) + "</div>" : "") + "</div>";
      }).join("") + "</div>";
    });
    printHtml(html + '<p class="print-foot">Algorithm Notebook · ' + T.esc(T.fmtDate(Date.now())) + "</p>", ctx, title);
  }
  function printCompare(tb, ctx) {
    var html = "<h1>So sánh: " + T.esc(tb.cols.map(function (c) { return c.name; }).join(" ↔ ")) + '</h1><table class="tbl-print"><thead><tr><th>Tiêu chí</th>' + tb.cols.map(function (c) { return "<th>" + T.esc(c.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      tb.rows.map(function (r) { return "<tr><th>" + T.esc(r.label) + "</th>" + r.cells.map(function (c) { return "<td>" + T.esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
    printHtml(html + '<p class="print-foot">Algorithm Notebook · ' + T.esc(T.fmtDate(Date.now())) + "</p>", ctx, "So sánh thuật toán");
  }

  U.exporters = { printEntry: printEntry, printCheat: printCheat, printCompare: printCompare };
})(typeof globalThis !== "undefined" ? globalThis : this);
