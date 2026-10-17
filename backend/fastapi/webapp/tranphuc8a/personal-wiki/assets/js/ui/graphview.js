/* ui/graphview.js — Đồ thị tri thức: canvas 2D, bố cục chạy trong Web Worker (rơi về luồng chính nếu không tạo được worker).
   Zoom (cuộn chuột / chụm hai ngón), kéo để di chuyển, bấm nút để mở note, lọc theo tag và loại quan hệ, tìm nút, danh sách nút (cho bàn phím / trình đọc màn hình). */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, G = W.graph, U = W.ui, h = U.h, icon = U.icon, $ = U.$;
  var TYPES = [["link", "Tham chiếu"], ["related_to", "Liên quan"], ["depends_on", "Phụ thuộc"], ["parent_of", "Cha–con"]];
  var TYPE_OF = { link: "link", related_to: "related_to", depends_on: "depends_on", parent_of: "parent_of", child_of: "parent_of" };

  function hue(tags) { var t = tags && tags[0]; return t ? parseInt(T.hash53(t).slice(0, 6), 16) % 360 : 215; }

  function open(ctx, host, q) {
    var repo = ctx.repo, st = { all: !!(q.all === "1" || !q.c), center: q.c || "", depth: Math.min(3, Math.max(1, +q.d || 1)), data: null, hiddenTags: {}, hiddenTypes: {}, find: "", destroyed: false, listOpen: false };
    var lay = null, view = { x: 0, y: 0, k: 1 }, vis = null, hover = -1, dirty = true, worker = null, fallbackTimer = 0, rafId = 0, fitPending = true, pointers = new Map(), pinch = null, drag = null, moved = 0;
    var cleanup = [];
    /** Vừa khung, chừa lề rộng theo bề ngang để nhãn (nằm dưới nút, rộng hơn nút) của nút ngoài rìa không bị cắt. */
    function fitView() { var w = area.clientWidth || 600, hh = area.clientHeight || 400; return G.fit(lay, w, hh, Math.max(48, Math.min(110, w * 0.16))); }
    var canvas = h("canvas", { class: "gv-canvas", tabindex: "0", role: "img", "aria-label": "Đồ thị tri thức" }), cx = canvas.getContext("2d");
    var tip = h("div", { class: "gv-tip", hidden: true, role: "tooltip" }), note = h("p", { class: "gv-note", hidden: true, role: "status" });
    var side = h("aside", { class: "gv-list", hidden: true, "aria-label": "Danh sách nút" });
    var tb = h("div", { class: "gv-bar" }), area = h("div", { class: "gv-area" }, canvas, tip, note, h("p", { class: "gv-hint", text: "Kéo để di chuyển · cuộn hoặc chụm để zoom · bấm nút để mở ghi chú" }));
    var el = h("div", { class: "gv" }, tb, h("div", { class: "gv-body" }, area, side));
    /** Chỉ để check.py: vị trí nút trên màn hình (canvas không có DOM để bấm thử) và độ zoom hiện tại. */
    el._probe = function () { return { k: view.k, x: view.x, y: view.y, nodes: vis && lay ? vis.nodes.map(function (n, i) { var p = G.toScreen(view, lay.x[i], lay.y[i]); return { id: n.id, title: n.title, x: p[0], y: p[1] }; }) : [] }; };
    host.replaceChildren(el);

    // ------------------------------------------------------------------------------------------- dữ liệu → bố cục
    function load() {
      var opts = st.all ? { limit: 1500 } : { center: st.center, depth: st.depth, limit: 600 };
      if (!st.all && !repo.head(st.center)) { st.all = true; opts = { limit: 1500 }; }
      return repo.graph(opts).then(function (d) { if (st.destroyed) return; st.data = d; layout(true); drawBar(); });
    }
    function filtered() {
      var d = st.data, keep = {}, nodes = d.nodes.filter(function (n) {
        if (n.n === d.center) return true;
        for (var i = 0; i < n.tags.length; i++) if (st.hiddenTags[n.tags[i]]) return false;
        return true;
      });
      nodes.forEach(function (n) { keep[n.n] = 1; });
      var edges = d.edges.filter(function (e) { return keep[e.a] && keep[e.b] && !st.hiddenTypes[TYPE_OF[e.type]]; });
      if (st.all) { var used = {}; edges.forEach(function (e) { used[e.a] = used[e.b] = 1; }); nodes = nodes.filter(function (n) { return used[n.n] || n.n === d.center; }); }
      return { nodes: nodes, edges: edges };
    }
    function layout(refit) {
      stopLayout();
      vis = filtered(); fitPending = refit !== false;
      var deg = {}; vis.edges.forEach(function (e) { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
      vis.nodes.forEach(function (n) { n.deg = deg[n.n] || 0; n.hue = hue(n.tags); });
      var ci = -1; vis.nodes.forEach(function (n, i) { if (n.n === st.data.center) ci = i; });
      lay = G.init(vis.nodes, vis.edges, { centerIndex: ci });
      note.hidden = !(st.data.truncated && st.all); note.textContent = st.data.truncated ? "Đang hiện " + vis.nodes.length.toLocaleString("vi-VN") + " nút có nhiều liên kết nhất. Dùng bộ lọc tag hoặc xem quanh một note để thu hẹp." : "";
      canvas.setAttribute("aria-label", "Đồ thị tri thức: " + vis.nodes.length + " nút, " + vis.edges.length + " liên kết");
      drawSide();
      if (!vis.nodes.length) { dirty = true; return paint(); }
      var payload = { type: "init", nodes: vis.nodes.map(function (n) { return { n: n.n, id: n.id }; }), edges: vis.edges, center: ci };
      try {
        worker = new root.Worker(new root.URL("../core/graph-worker.js", root.document.currentScript ? root.document.currentScript.src : (function () { var s = U.$$("script[src*='graphview.js']")[0]; return s ? s.src : root.location.href; })()).href);
        worker.onmessage = function (e) {
          var m = e.data; if (m.type !== "pos" || !lay) return;
          lay.x = m.x; lay.y = m.y; dirty = true;
          if (fitPending && (m.iter >= 60 || m.done)) { view = fitView(); fitPending = false; }
          if (m.done) fitPending = false;
        };
        worker.onerror = function () { stopWorker(); runFallback(); };
        worker.postMessage(payload);
      } catch (e) { runFallback(); }
      view = fitView(); dirty = true; paint();
    }
    function runFallback() {
      var target = lay;
      (function step() {
        if (st.destroyed || lay !== target) return;
        var move = G.run(lay, 3); dirty = true;
        if (fitPending && lay.iter >= 60) { view = fitView(); fitPending = false; }
        if (move >= 0.6 && lay.iter < 450) fallbackTimer = setTimeout(step, 0); else fitPending = false;
      })();
    }
    function stopWorker() { if (worker) { try { worker.postMessage({ type: "stop" }); worker.terminate(); } catch (e) { /* đã đóng */ } worker = null; } }
    function stopLayout() { stopWorker(); clearTimeout(fallbackTimer); }

    // ------------------------------------------------------------------------------------------- vẽ
    function colors() {
      var cs = root.getComputedStyle(root.document.documentElement), dark = root.document.documentElement.dataset.theme === "dark";
      return { text: cs.getPropertyValue("--text").trim() || "#000", dim: cs.getPropertyValue("--text-3").trim() || "#667", edge: cs.getPropertyValue("--border-strong").trim() || "#99a", bg: cs.getPropertyValue("--bg").trim() || "#fff", accent: cs.getPropertyValue("--accent").trim() || "#26f", dark: dark };
    }
    function resize() {
      var w = area.clientWidth, hgt = area.clientHeight, dpr = Math.min(3, root.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr); canvas.style.width = w + "px"; canvas.style.height = hgt + "px"; dirty = true; }
      return dpr;
    }
    function matchSet() {
      if (!st.find.trim()) return null;
      var f = T.fold(st.find), set = {};
      vis.nodes.forEach(function (n, i) { if (T.fold(n.title).indexOf(f) !== -1) set[i] = 1; });
      return set;
    }
    function neighbors(i) { var s = {}; if (i < 0) return s; s[i] = 1; for (var e = 0; e < lay.m; e++) { if (lay.ea[e] === i) s[lay.eb[e]] = 1; else if (lay.eb[e] === i) s[lay.ea[e]] = 1; } return s; }

    function paint(target, scale) {
      var c = target || cx, dpr = scale || resize(), w = target ? target._w : area.clientWidth, hgt = target ? target._h : area.clientHeight, col = colors();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, hgt);
      if (target) { c.fillStyle = col.bg; c.fillRect(0, 0, w, hgt); }
      if (!vis || !lay || !lay.n) { c.fillStyle = col.dim; c.font = "15px system-ui, sans-serif"; c.textAlign = "center"; c.fillText("Chưa có liên kết nào để vẽ. Nối ghi chú bằng [[Tên note]].", w / 2, hgt / 2); c.textAlign = "start"; return; }
      var match = matchSet(), nb = neighbors(hover), focus = hover >= 0, i, e;
      c.lineCap = "round";
      for (e = 0; e < lay.m; e++) {
        var a = lay.ea[e], b = lay.eb[e], pa = G.toScreen(view, lay.x[a], lay.y[a]), pb = G.toScreen(view, lay.x[b], lay.y[b]), type = TYPE_OF[vis.edges[e].type] || "link";   // lay.ea/eb cùng thứ tự vis.edges (init chỉ bỏ cạnh tự trỏ, đã loại từ repo.graph)
        var on = focus ? (a === hover || b === hover) : true, dimmed = (match && !(match[a] || match[b])) || (focus && !on);
        c.globalAlpha = dimmed ? 0.12 : on && focus ? 0.95 : 0.55; c.strokeStyle = on && focus ? col.accent : col.edge; c.lineWidth = on && focus ? 2 : 1.2;
        c.setLineDash(type === "depends_on" ? [6, 4] : type === "related_to" ? [2, 4] : []);
        c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
        if (type === "depends_on" && !dimmed) arrow(c, pa, pb, G.radius(lay.deg[b]) * 1, c.strokeStyle);
      }
      c.setLineDash([]);
      for (i = 0; i < lay.n; i++) {
        var p = G.toScreen(view, lay.x[i], lay.y[i]); if (p[0] < -30 || p[1] < -30 || p[0] > w + 30 || p[1] > hgt + 30) continue;
        var nd = vis.nodes[i], r = G.radius(lay.deg[i]) * Math.min(1.6, Math.max(0.7, Math.sqrt(view.k))), isC = nd.n === st.data.center;
        var dimmedN = (match && !match[i]) || (focus && !nb[i]);
        c.globalAlpha = dimmedN ? 0.18 : 1;
        c.fillStyle = "hsl(" + nd.hue + "," + (col.dark ? "62%,62%" : "68%,46%") + ")";
        c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
        if (isC || i === hover || (match && match[i])) { c.lineWidth = 3; c.strokeStyle = isC ? col.accent : col.text; c.beginPath(); c.arc(p[0], p[1], r + 3, 0, Math.PI * 2); c.stroke(); }
        var labeled = view.k >= 0.75 || i === hover || nb[i] && focus || isC || (match && match[i]) || lay.deg[i] >= 6 && view.k >= 0.45;
        if (labeled && !dimmedN) {
          var text = nd.title.length > 30 ? nd.title.slice(0, 29) + "…" : nd.title;
          c.font = (isC ? "600 " : "") + "12px system-ui, sans-serif"; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = col.bg; c.strokeText(text, p[0], p[1] + r + 14); c.fillStyle = col.text; c.fillText(text, p[0], p[1] + r + 14);
        }
      }
      c.globalAlpha = 1; c.textAlign = "start";
    }
    function arrow(c, pa, pb, rad, color) {
      var dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, x = pb[0] - ux * (rad + 4), y = pb[1] - uy * (rad + 4);
      c.fillStyle = color; c.beginPath(); c.moveTo(x, y); c.lineTo(x - ux * 8 - uy * 4, y - uy * 8 + ux * 4); c.lineTo(x - ux * 8 + uy * 4, y - uy * 8 - ux * 4); c.closePath(); c.fill();
    }
    function frame() { rafId = root.requestAnimationFrame(frame); if (dirty && vis) { dirty = false; paint(); } }
    rafId = root.requestAnimationFrame(frame);
    var ro = root.ResizeObserver ? new root.ResizeObserver(function () { if (fitPending && lay) view = fitView(); dirty = true; }) : null; if (ro) ro.observe(area);
    var onTheme = function () { dirty = true; }; U.onPref(onTheme);

    // ------------------------------------------------------------------------------------------- chạm / chuột
    function pos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId); var p = pos(e); pointers.set(e.pointerId, p); moved = 0;
      var hint = area.querySelector(".gv-hint"); if (hint) hint.remove();            // đã biết cách dùng thì bỏ dòng gợi ý (nó che nút ở màn nhỏ)
      if (pointers.size === 2) { var a = Array.from(pointers.values()); pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), k: view.k }; drag = null; } else drag = { x: p[0], y: p[1], vx: view.x, vy: view.y };
    });
    canvas.addEventListener("pointermove", function (e) {
      var p = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        var a = Array.from(pointers.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), mid = [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2];
        view = G.zoomAt(view, mid[0], mid[1], (pinch.k * d / pinch.d) / view.k); moved = 99; dirty = true; fitPending = false; return;
      }
      if (drag && pointers.has(e.pointerId)) {
        var dx = p[0] - drag.x, dy = p[1] - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
        if (moved > 4) { view = { x: drag.vx + dx, y: drag.vy + dy, k: view.k }; dirty = true; fitPending = false; canvas.style.cursor = "grabbing"; }
        return;
      }
      if (e.pointerType === "mouse" && lay) { var i = G.hit(lay, view, p[0], p[1], 6); if (i !== hover) { hover = i; dirty = true; canvas.style.cursor = i >= 0 ? "pointer" : "grab"; showTip(i, p); } else if (i >= 0) showTip(i, p); }
    });
    function end(e) {
      var p = pos(e), tap = pointers.has(e.pointerId) && moved <= 4 && !pinch;
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; canvas.style.cursor = hover >= 0 ? "pointer" : "grab";
      if (tap && lay && e.type === "pointerup") { var i = G.hit(lay, view, p[0], p[1], e.pointerType === "touch" ? 14 : 6); if (i >= 0) ctx.route({}, false, "n/" + vis.nodes[i].id); }
    }
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hover = -1; tip.hidden = true; dirty = true; } });
    canvas.addEventListener("wheel", function (e) { e.preventDefault(); var p = pos(e); view = G.zoomAt(view, p[0], p[1], Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))); dirty = true; fitPending = false; }, { passive: false });
    canvas.addEventListener("keydown", function (e) {
      var s = 60, m = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
      if (m) { e.preventDefault(); view = { x: view.x + m[0], y: view.y + m[1], k: view.k }; dirty = true; }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.25); } else if (e.key === "-") { e.preventDefault(); zoomBy(0.8); } else if (e.key === "0") { e.preventDefault(); fit(); }
    });
    function zoomBy(f) { view = G.zoomAt(view, area.clientWidth / 2, area.clientHeight / 2, f); dirty = true; fitPending = false; }
    function fit() { if (lay) { view = fitView(); dirty = true; } }
    function showTip(i, p) {
      if (i < 0) { tip.hidden = true; return; }
      var n = vis.nodes[i]; tip.hidden = false; tip.textContent = n.title + (n.deg ? "  ·  " + n.deg + " liên kết" : ""); tip.style.left = Math.min(area.clientWidth - 220, p[0] + 14) + "px"; tip.style.top = Math.max(4, p[1] - 30) + "px";
    }

    // ------------------------------------------------------------------------------------------- thanh công cụ + danh sách
    function drawBar() {
      var d = st.data, tagCount = {}; d.nodes.forEach(function (n) { n.tags.forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
      var tags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a] || (a < b ? -1 : 1); }).slice(0, 12);
      var mode = h("div", { class: "seg", role: "group", "aria-label": "Phạm vi" }, h("button", { type: "button", "aria-pressed": String(!st.all), disabled: !st.center ? true : null, dataset: { m: "local" } }, h("span", { text: "Quanh note" })), h("button", { type: "button", "aria-pressed": String(st.all), dataset: { m: "all" } }, h("span", { text: "Toàn bộ" })));
      var depth = !st.all ? h("select", { "aria-label": "Độ sâu", class: "sort", dataset: { d: "1" } }, [1, 2, 3].map(function (n) { return h("option", { value: n, selected: st.depth === n ? true : null, text: "Sâu " + n }); })) : null;
      var find = h("input", { type: "search", class: "q2 gv-find", placeholder: "Tìm nút…", "aria-label": "Tìm nút trong đồ thị", value: st.find, autocomplete: "off" });
      var btns = h("div", { class: "gv-btns" },
        h("button", { type: "button", class: "icon-btn", dataset: { a: "zin" }, "aria-label": "Phóng to", html: icon("plus") }), h("button", { type: "button", class: "icon-btn", dataset: { a: "zout" }, "aria-label": "Thu nhỏ", html: icon("minus") }),
        h("button", { type: "button", class: "icon-btn", dataset: { a: "fit" }, "aria-label": "Vừa khung", title: "Vừa khung (0)", html: icon("fit") }), h("button", { type: "button", class: "icon-btn", dataset: { a: "list" }, "aria-label": "Danh sách nút", "aria-pressed": String(st.listOpen), html: icon("list") }),
        h("button", { type: "button", class: "icon-btn", dataset: { a: "png" }, "aria-label": "Tải ảnh PNG", html: icon("image") }));
      var chips = h("div", { class: "gv-chips" },
        tags.map(function (t) { return h("button", { type: "button", class: "chip" + (st.hiddenTags[t] ? "" : " on"), "aria-pressed": String(!st.hiddenTags[t]), dataset: { tag: t }, title: st.hiddenTags[t] ? "Đang ẩn — bấm để hiện" : "Bấm để ẩn các nút có tag này" }, h("span", { text: "#" + t })); }),
        TYPES.map(function (t) { return h("button", { type: "button", class: "chip type" + (st.hiddenTypes[t[0]] ? "" : " on"), "aria-pressed": String(!st.hiddenTypes[t[0]]), dataset: { type: t[0] } }, h("span", { text: t[1] })); }));
      tb.replaceChildren(h("div", { class: "gv-row" }, mode, depth, find, btns), chips);
      mode.addEventListener("click", function (e) { var b = e.target.closest("[data-m]"); if (!b || b.disabled) return; st.all = b.dataset.m === "all"; ctx.route(st.all ? { all: "1" } : { c: st.center, d: st.depth }, true, "graph"); load(); });
      if (depth) depth.addEventListener("change", function () { st.depth = +depth.value; ctx.route({ c: st.center, d: st.depth }, true, "graph"); load(); });
      find.addEventListener("input", U.debounce(function () { st.find = find.value; dirty = true; drawSide(); }, 120));
      btns.addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return;
        if (b.dataset.a === "zin") zoomBy(1.3); else if (b.dataset.a === "zout") zoomBy(0.77); else if (b.dataset.a === "fit") fit();
        else if (b.dataset.a === "list") { st.listOpen = !st.listOpen; side.hidden = !st.listOpen; b.setAttribute("aria-pressed", String(st.listOpen)); drawSide(); setTimeout(function () { dirty = true; }, 50); }
        else if (b.dataset.a === "png") exportPng();
      });
      chips.addEventListener("click", function (e) {
        var t = e.target.closest("[data-tag]"), y = e.target.closest("[data-type]");
        if (t) { if (st.hiddenTags[t.dataset.tag]) delete st.hiddenTags[t.dataset.tag]; else st.hiddenTags[t.dataset.tag] = 1; }
        else if (y) { if (st.hiddenTypes[y.dataset.type]) delete st.hiddenTypes[y.dataset.type]; else st.hiddenTypes[y.dataset.type] = 1; }
        else return;
        drawBar(); layout(false);
      });
    }
    function drawSide() {
      if (!st.listOpen || !vis) return;
      var f = T.fold(st.find), items = vis.nodes.map(function (n, i) { return { n: n, i: i }; }).filter(function (x) { return !f || T.fold(x.n.title).indexOf(f) !== -1; }).sort(function (a, b) { return b.n.deg - a.n.deg; }).slice(0, 200);
      side.replaceChildren(h("h3", { text: "Nút (" + vis.nodes.length + ")" }), h("ul", null, items.map(function (x) {
        var a = h("a", { href: "#/n/" + x.n.id, class: "gl" }); a.innerHTML = '<i style="background:hsl(' + x.n.hue + ',65%,52%)"></i><span>' + T.esc(x.n.title) + "</span><small>" + x.n.deg + "</small>";
        a.addEventListener("mouseenter", function () { hover = x.i; dirty = true; }); a.addEventListener("mouseleave", function () { hover = -1; dirty = true; });
        return h("li", null, a);
      })));
    }
    function exportPng() {
      var w = area.clientWidth, hgt = area.clientHeight, scale = 2, off = root.document.createElement("canvas"); off.width = w * scale; off.height = hgt * scale; off._w = w; off._h = hgt;
      paint(off.getContext("2d"), scale);
      off.toBlob(function (b) { if (b) U.download("do-thi_" + T.dateKey(Date.now()).replace(/-/g, "") + ".png", b); else ctx.toast("Không xuất được ảnh."); }, "image/png");
    }

    load().catch(function (e) { host.replaceChildren(h("p", { class: "ed-loading", text: "Không dựng được đồ thị: " + e.message })); });
    return { destroy: function () { st.destroyed = true; stopLayout(); root.cancelAnimationFrame(rafId); if (ro) ro.disconnect(); cleanup.forEach(function (f) { f(); }); } };
  }

  U.graphview = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
