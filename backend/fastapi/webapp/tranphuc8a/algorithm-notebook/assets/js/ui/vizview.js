/* ui/vizview.js — Trực quan hoá: danh sách (#/viz) và trình phát từng bước (#/viz/<id>): Chạy/Tạm dừng, Bước tới/lui, kéo thanh bước, tốc độ, sửa dữ liệu vào.
   Bước do core/viz.js sinh (thuần); file này chỉ vẽ: đồ thị (SVG), hàng ô (mảng, DSU, Fenwick, KMP, tìm nhị phân), bảng (DP), cây (Segment Tree). */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, V = A.viz, C = A.catalog;
  var SVGNS = "http://www.w3.org/2000/svg", uid = 0;

  function svg(tag, attrs, kids) {
    var el = root.document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) el.append(c); });
    return el;
  }

  // ---------------------------------------------------------------------------------------------- đồ thị
  function drawGraph(stage, g, step) {
    var W = 420, H = 300, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 38, pos = [], mark = "arr" + (++uid);
    for (var i = 0; i < g.n; i++) { var ang = -Math.PI / 2 + 2 * Math.PI * i / g.n; pos.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]); }
    var defs = svg("defs", {}, [svg("marker", { id: mark, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, [svg("path", { d: "M0 0 10 5 0 10z", class: "arrow" })])]);
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "vgraph", role: "img", "aria-label": "Đồ thị " + g.n + " đỉnh, " + g.edges.length + " cạnh" }, [defs]);
    var NR = 19;
    g.edges.forEach(function (e, k) {
      var a = pos[e.a], b = pos[e.b], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      var x1 = a[0] + ux * NR, y1 = a[1] + uy * NR, x2 = b[0] - ux * (NR + (g.directed ? 3 : 0)), y2 = b[1] - uy * (NR + (g.directed ? 3 : 0));
      var line = svg("line", { x1: x1, y1: y1, x2: x2, y2: y2, class: "ve ve-" + step.edges[k] });
      if (g.directed) line.setAttribute("marker-end", "url(#" + mark + ")");
      s.append(line);
      if (g.weighted) { var mx = (x1 + x2) / 2 - uy * 9, my = (y1 + y2) / 2 + ux * 9; var t = svg("text", { x: mx, y: my, class: "vw vw-" + step.edges[k], "text-anchor": "middle", "dominant-baseline": "middle" }); t.textContent = e.w; s.append(t); }
    });
    pos.forEach(function (p, i) {
      var n = step.nodes[i], grp = svg("g", { class: "vn vs-" + n.s });
      grp.append(svg("circle", { cx: p[0], cy: p[1], r: NR }));
      var name = svg("text", { x: p[0], y: p[1] - (n.v !== "" ? 3 : 0), "text-anchor": "middle", "dominant-baseline": "middle", class: "vn-name" }); name.textContent = V.NAME(i); grp.append(name);
      if (n.v !== "") { var v = svg("text", { x: p[0], y: p[1] + 9, "text-anchor": "middle", "dominant-baseline": "middle", class: "vn-val" }); v.textContent = n.v; grp.append(v); }
      s.append(grp);
    });
    stage.replaceChildren(s);
  }

  // ---------------------------------------------------------------------------------------------- hàng ô
  function drawRows(stage, step) {
    stage.replaceChildren.apply(stage, step.rows.map(function (row) {
      var cells = row.cells.map(function (c, i) { return h("div", { class: "vcell s-" + c.s }, h("span", { class: "vv", text: c.v === "" ? " " : String(c.v) }), h("i", { class: "vm", text: (row.marks && row.marks[i]) || "" })); });
      return h("div", { class: "vrow" }, h("span", { class: "vlabel", text: row.label }), h("div", { class: "vcells" }, cells));
    }));
    stage.classList.add("vrows");
  }

  // ---------------------------------------------------------------------------------------------- bảng DP
  function drawTable(stage, step) {
    var t = h("table", { class: "vtable" }, h("thead", null, h("tr", null, [h("th", { text: "" })].concat(step.cols.map(function (c) { return h("th", { text: "w=" + c }); })))),
      h("tbody", null, step.cells.map(function (row, r) { return h("tr", null, [h("th", { scope: "row", text: step.rowsLabels[r] })].concat(row.map(function (c) { return h("td", { class: "s-" + c.s, text: String(c.v) }); }))); })));
    stage.replaceChildren(h("div", { class: "tbl-wrap" }, t));
  }

  // ---------------------------------------------------------------------------------------------- cây (Segment Tree)
  function drawTree(stage, step) {
    var n = step.nodes.length, levels = Math.floor(Math.log2(n)) + 1, W = 460, Hh = 70 * levels + 20, leaves = Math.pow(2, levels - 1);
    var s = svg("svg", { viewBox: "0 0 " + W + " " + Hh, class: "vtree", role: "img", "aria-label": "Cây đoạn" }), pos = {};
    for (var idx = 1; idx <= n; idx++) { var d = Math.floor(Math.log2(idx)), span = leaves / Math.pow(2, d), off = idx - Math.pow(2, d); pos[idx] = [W * (off * span + span / 2) / leaves, 34 + d * 70]; }
    for (var j = 2; j <= n; j++) { var p = pos[j >> 1], q = pos[j]; s.append(svg("line", { x1: p[0], y1: p[1] + 16, x2: q[0], y2: q[1] - 16, class: "ve ve-idle" })); }
    step.nodes.forEach(function (nd, k) {
      var i = k + 1, p = pos[i], g = svg("g", { class: "vt vs-" + nd.s + (nd.pad ? " pad" : "") });
      g.append(svg("rect", { x: p[0] - 26, y: p[1] - 16, width: 52, height: 32, rx: 8 }));
      var v = svg("text", { x: p[0], y: p[1] - 2, "text-anchor": "middle", class: "vn-name" }); v.textContent = nd.v; g.append(v);
      var l = svg("text", { x: p[0], y: p[1] + 10, "text-anchor": "middle", class: "vn-val" }); l.textContent = nd.label; g.append(l);
      s.append(g);
    });
    stage.replaceChildren(s);
  }

  // ================================================================================================= danh sách
  function list(ctx, host) {
    var el = h("div", { class: "page viz-list" });
    el.append(U.views.pageHead("Trực quan hoá", "Xem thuật toán chạy từng bước trên dữ liệu bạn nhập. Dùng ← → để bước, Space để chạy."),
      h("div", { class: "cards3" }, V.list.map(function (v) {
        var e = C.get(v.id);
        return h("a", { class: "bigcard", href: "#/viz/" + v.id }, h("span", { class: "bc-ic", html: icon(v.kind === "graph" ? "graph" : v.kind === "table" ? "dp" : v.kind === "tree" ? "ds" : "tech") }), h("b", { text: v.title }), h("small", { text: e ? (lib().CAT[e.category] || {}).name || "" : "" }), h("p", { text: v.blurb }));
      })));
    host.replaceChildren(el);
    return { destroy: function () {} };
    function lib() { return A.lib; }
  }

  // ================================================================================================= trình phát
  function player(ctx, host, id, q) {
    var v = V.get(id);
    if (!v) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có trực quan hoá này" }), h("a", { class: "btn btn-primary", href: "#/viz", text: "Xem danh sách" }))); return { destroy: function () {} }; }
    var st = { destroyed: false, steps: [], i: 0, timer: 0, playing: false, speed: 1 }, e = C.get(id);
    var preset = h("select", { "aria-label": "Dữ liệu mẫu" }, v.presets.map(function (p, k) { return h("option", { value: k, text: p.name }); }));
    var input = h("textarea", { class: "viz-in mono", rows: Math.min(10, v.presets[0].text.split("\n").length + 1), spellcheck: "false", "aria-label": "Dữ liệu vào" }); input.value = v.presets[0].text;
    var err = h("p", { class: "form-err", role: "alert", hidden: true });
    var stage = h("div", { class: "vstage" }), msg = h("p", { class: "vmsg", role: "status", "aria-live": "polite" }), info = h("dl", { class: "vinfo" });
    var slider = h("input", { type: "range", min: 0, max: 0, value: 0, "aria-label": "Bước" }), counter = h("span", { class: "vcount mono" });
    var bPlay = h("button", { type: "button", class: "btn btn-primary", "aria-label": "Chạy", html: icon("play") + "<span>Chạy</span>" }), bPrev = h("button", { type: "button", class: "icon-btn", "aria-label": "Bước trước (←)", html: icon("prev") }), bNext = h("button", { type: "button", class: "icon-btn", "aria-label": "Bước tiếp (→)", html: icon("fwd") }), bReset = h("button", { type: "button", class: "icon-btn", "aria-label": "Về đầu", html: icon("reset") });
    var speed = h("select", { "aria-label": "Tốc độ" }, [["0.5", "0,5×"], ["1", "1×"], ["2", "2×"], ["4", "4×"]].map(function (o) { return h("option", { value: o[0], text: o[1] }); })); speed.value = "1";
    var params = null;

    function render() {
      var s = st.steps[st.i]; if (!s) return;
      stage.className = "vstage";
      if (v.kind === "graph") drawGraph(stage, params.graph, s); else if (v.kind === "rows") drawRows(stage, s); else if (v.kind === "table") drawTable(stage, s); else drawTree(stage, s);
      msg.textContent = s.msg;
      info.replaceChildren.apply(info, (s.info || []).reduce(function (a, r) { return a.concat([h("dt", { text: r[0] }), h("dd", { class: "mono", text: r[1] })]); }, []));
      slider.max = String(st.steps.length - 1); slider.value = String(st.i); counter.textContent = "Bước " + (st.i + 1) + "/" + st.steps.length;
      bPrev.disabled = st.i === 0; bNext.disabled = st.i >= st.steps.length - 1;
      bPlay.innerHTML = icon(st.playing ? "pause" : "play") + "<span>" + (st.playing ? "Tạm dừng" : st.i >= st.steps.length - 1 ? "Chạy lại" : "Chạy") + "</span>"; bPlay.setAttribute("aria-label", st.playing ? "Tạm dừng" : "Chạy");
    }
    function stop() { st.playing = false; clearTimeout(st.timer); }
    function tick() {
      if (!st.playing) return;
      if (st.i >= st.steps.length - 1) { stop(); render(); return; }
      st.i++; render(); st.timer = setTimeout(tick, 900 / st.speed);
    }
    function play() { if (st.playing) { stop(); render(); return; } if (st.i >= st.steps.length - 1) st.i = 0; st.playing = true; render(); st.timer = setTimeout(tick, 600 / st.speed); }
    function go(i) { stop(); st.i = Math.max(0, Math.min(st.steps.length - 1, i)); render(); }
    function apply() {
      var p = v.parse(input.value);
      if (p.error) { err.textContent = p.error; err.hidden = false; return false; }
      err.hidden = true; stop(); params = p.params; var r = v.run(params); st.steps = r.steps; st.i = 0; render(); return true;
    }
    preset.addEventListener("change", function () { input.value = v.presets[+preset.value].text; input.rows = Math.min(10, input.value.split("\n").length + 1); apply(); });
    input.addEventListener("input", U.debounce(function () { apply(); }, 300));
    bPlay.addEventListener("click", play); bPrev.addEventListener("click", function () { go(st.i - 1); }); bNext.addEventListener("click", function () { go(st.i + 1); }); bReset.addEventListener("click", function () { go(0); });
    slider.addEventListener("input", function () { go(+slider.value); }); speed.addEventListener("change", function () { st.speed = +speed.value; });
    var onKey = function (ev) {
      if (st.destroyed || U.isTyping(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector("dialog[open]")) return;
      if (ev.key === "ArrowRight") { ev.preventDefault(); go(st.i + 1); } else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(st.i - 1); } else if (ev.key === " " && !ev.target.closest("button, a, select")) { ev.preventDefault(); play(); }
    };
    document.addEventListener("keydown", onKey);
    var hint = v.id === "dsu" || v.id === "fenwick-tree" || v.id === "segment-tree" ? "Dòng 1: dữ liệu. Các dòng sau: thao tác (xem mẫu)." : v.kind === "graph" ? "Dòng 1: số đỉnh, số cạnh" + (v.id === "topological-sort" ? "" : ", đỉnh nguồn") + ". Mỗi dòng sau là một cạnh (đỉnh đánh số từ 1)." : "Sửa dữ liệu rồi xem lại từ đầu.";
    var el = h("div", { class: "page viz" }, h("a", { class: "back-link", href: "#/viz", text: "← Tất cả trực quan hoá" }),
      U.views.pageHead(v.title, v.blurb, e ? h("a", { class: "btn", href: "#/a/" + e.id, html: icon("lib") + "<span>Chi tiết thuật toán</span>" }) : null),
      h("div", { class: "viz-grid" },
        h("div", { class: "viz-main" }, stage, msg, info, h("div", { class: "vctl" }, bReset, bPrev, bPlay, bNext, speed, counter), slider),
        h("aside", { class: "viz-side" }, h("label", { text: "Dữ liệu mẫu" }), preset, h("label", { for: "viz-in", text: "Dữ liệu vào" }), input, h("p", { class: "hint", text: hint }), err)));
    input.id = "viz-in";
    host.replaceChildren(el);
    apply();
    return { destroy: function () { st.destroyed = true; stop(); document.removeEventListener("keydown", onKey); } };
  }

  U.vizview = { list: list, player: player };
})(typeof globalThis !== "undefined" ? globalThis : this);
