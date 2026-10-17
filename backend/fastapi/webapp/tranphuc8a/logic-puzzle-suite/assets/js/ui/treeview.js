/* ui/treeview.js — vẽ kết quả type.trace(puzzle) cho màn "Show Solver" (spec #27):
     { kind: "tree",   nodes: [{id, parent, label, status}], truncated, note }          → cây tìm kiếm SVG (cuộn được), màu theo trạng thái
     { kind: "matrix", title, steps: [{text, matrix, pivot?}], note }                  → trình chiếu từng bước (bảng ma trận, ô trụ tô sáng)
   status: fail (hết giá trị ngay) · dead (đã thử hết, không ra nghiệm) · ok (nằm trên đường tới nghiệm) · solution (nghiệm) · open.
   Mọi chữ vào DOM qua textContent / thuộc tính SVG — không innerHTML. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document, NS = "http://www.w3.org/2000/svg";
  var LEGEND = [["solution", "Nghiệm"], ["ok", "Trên đường tới nghiệm"], ["dead", "Thử hết, không ra nghiệm"], ["fail", "Bị loại ngay"], ["open", "Chưa xét"]];

  function svg(tag, attrs, text) {
    var el = doc.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }

  /** Bố cục cây gọn: lá chiếm cột liên tiếp, nút trong căn giữa con. Nhiều gốc → thêm gốc ảo "Bắt đầu". */
  function layout(nodes) {
    var byId = {}, kids = {}, roots = [];
    nodes.forEach(function (n) { byId[n.id] = n; kids[n.id] = []; });
    nodes.forEach(function (n) { if (n.parent != null && n.parent >= 0 && byId[n.parent]) kids[n.parent].push(n.id); else roots.push(n.id); });
    var pos = {}, col = 0, maxDepth = 0;
    function place(id, depth) {
      maxDepth = Math.max(maxDepth, depth);
      var ks = kids[id], x;
      if (!ks.length) x = col++; else { var xs = ks.map(function (k) { return place(k, depth + 1); }); x = (xs[0] + xs[xs.length - 1]) / 2; }
      pos[id] = { x: x, depth: depth }; return x;
    }
    var rxs = roots.map(function (r) { return place(r, 1); });
    var rootX = rxs.length ? (rxs[0] + rxs[rxs.length - 1]) / 2 : 0;
    return { pos: pos, kids: kids, byId: byId, roots: roots, cols: Math.max(1, col), depth: maxDepth, rootX: rootX };
  }

  function tree(trace) {
    var nodes = trace.nodes || [], wrap = h("div", { class: "tv" });
    if (!nodes.length) { wrap.append(h("p", { class: "empty-note", text: "Bộ giải không cần tìm kiếm cho puzzle này — lan truyền ràng buộc đã đủ." })); if (trace.note) wrap.append(h("p", { class: "faint", text: trace.note })); return wrap; }
    var L = layout(nodes), DX = nodes.length > 80 ? 18 : 54, DY = 52, R = nodes.length > 80 ? 5 : 9, PAD = 28, labels = nodes.length <= 60;
    var W = PAD * 2 + (L.cols - 1) * DX + (labels ? 40 : 0), H = PAD * 2 + L.depth * DY;
    var s = svg("svg", { class: "tv-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Cây tìm kiếm của bộ giải, " + nodes.length + " nút" });
    var X = function (x) { return PAD + x * DX; }, Y = function (d) { return PAD + (d - 1) * DY + 6; };
    var rx = X(L.rootX), ry = PAD - 14;
    s.append(svg("circle", { cx: rx, cy: ry, r: R - 2, class: "tn tn-root" }), svg("text", { x: rx + R + 2, y: ry + 4, class: "tl" }, "Bắt đầu"));
    nodes.forEach(function (n) {
      var p = L.pos[n.id], par = n.parent != null && n.parent >= 0 && L.pos[n.parent] ? L.pos[n.parent] : null;
      var x1 = par ? X(par.x) : rx, y1 = par ? Y(par.depth) : ry;
      s.append(svg("line", { x1: x1, y1: y1, x2: X(p.x), y2: Y(p.depth), class: "te te-" + (n.status === "ok" || n.status === "solution" ? "good" : "plain") }));
    });
    nodes.forEach(function (n) {
      var p = L.pos[n.id], g = svg("g", { class: "tn-g" });
      g.append(svg("circle", { cx: X(p.x), cy: Y(p.depth), r: R, class: "tn tn-" + (n.status || "open") }), svg("title", {}, (n.label || "") + " — " + (LEGEND.filter(function (l) { return l[0] === n.status; })[0] || [0, n.status])[1]));
      if (labels) g.append(svg("text", { x: X(p.x) + R + 3, y: Y(p.depth) + 4, class: "tl" }, String(n.label || "")));
      s.append(g);
    });
    var box = h("div", { class: "tv-scroll", tabindex: "0", role: "region", "aria-label": "Cây tìm kiếm (cuộn để xem)" }); box.append(s);
    var legend = h("ul", { class: "tv-legend" }, LEGEND.map(function (l) { var li = h("li", {}); li.append(h("span", { class: "dot tn-" + l[0] }), h("span", { text: l[1] })); return li; }));
    wrap.append(h("p", { class: "faint", text: nodes.length + " nút" + (trace.truncated ? " (đã cắt bớt cho gọn — còn nhiều nhánh nữa)" : "") + ". Mỗi nút là một lần thử gán giá trị; nút đỏ bị loại ngay nhờ lan truyền ràng buộc." }), box, legend);
    if (trace.note) wrap.append(h("p", { class: "tv-note", text: trace.note }));
    return wrap;
  }

  function matrix(trace) {
    var steps = trace.steps || [], idx = 0, wrap = h("div", { class: "tv mx" });
    if (!steps.length) { wrap.append(h("p", { class: "empty-note", text: "Không có bước nào để chiếu." })); return wrap; }
    var count = h("b", { class: "rp-count" }), text = h("p", { class: "hint-text" }), tableBox = h("div", { class: "mx-scroll", tabindex: "0", role: "region", "aria-label": "Ma trận ở bước hiện tại" });
    var prev = h("button", { type: "button", class: "btn", html: icon("prev") + "<span>Trước</span>" }), next = h("button", { type: "button", class: "btn btn-primary", html: icon("next") + "<span>Sau</span>" });
    var range = h("input", { type: "range", min: "0", max: String(steps.length - 1), value: "0", "aria-label": "Bước" });
    function draw() {
      var st = steps[idx], m = st.matrix || [], t = h("table", { class: "mx-table" }), tb = h("tbody", {});
      m.forEach(function (row, r) {
        var tr = h("tr", {});
        row.forEach(function (v, c) { tr.append(h("td", { class: (st.pivot && st.pivot[0] === r && st.pivot[1] === c ? "pivot " : "") + (st.pivot && st.pivot[0] === r ? "mx-row" : ""), text: String(v) })); });
        tb.append(tr);
      });
      t.append(tb); tableBox.replaceChildren(t);
      count.textContent = "Bước " + (idx + 1) + "/" + steps.length; text.textContent = st.text || ""; range.value = String(idx);
      prev.disabled = idx === 0; next.disabled = idx === steps.length - 1;
    }
    prev.addEventListener("click", function () { idx = Math.max(0, idx - 1); draw(); }); next.addEventListener("click", function () { idx = Math.min(steps.length - 1, idx + 1); draw(); });
    range.addEventListener("input", function () { idx = +range.value; draw(); });
    wrap.append(h("div", { class: "rp-head" }, h("h3", { text: trace.title || "Các bước của bộ giải" }), count), text, tableBox, range, h("div", { class: "btn-row" }, prev, next));
    if (trace.note) wrap.append(h("p", { class: "tv-note", text: trace.note }));
    draw(); return wrap;
  }

  function render(trace) {
    if (!trace) return h("p", { class: "empty-note", text: "Loại puzzle này chưa có trực quan hoá bộ giải." });
    return trace.kind === "matrix" ? matrix(trace) : tree(trace);
  }

  U.treeview = { render: render, tree: tree, matrix: matrix, layout: layout };
})(typeof globalThis !== "undefined" ? globalThis : this);
