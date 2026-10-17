/* ui/decideview.js — "Thuật toán nên dùng?": Wizard hỏi từng câu (đường đi nằm trong địa chỉ #/decide?p=0,2,1 nên nút Quay lại của trình duyệt hoạt động,
   gửi được cho người khác) và màn Cây quyết định xem toàn bộ dạng phác thảo (#/tree). Dữ liệu: assets/data/tree.js, logic: core/decide.js. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, C = A.catalog, lib = A.lib, TR = A.tree;

  function resultCard(e, note) {
    var cx = e.complexity || {}, c = h("a", { class: "res-card", href: "#/a/" + e.id });
    c.innerHTML = '<span class="rc-n">' + T.esc(e.name) + '</span><span class="rc-s">' + T.esc(e.summary || "") + '</span><span class="rc-m"><span class="mono">' + T.esc(cx.time || "") + "</span><span>" + T.esc((lib.CAT[e.category] || C.MINE).name) + "</span></span>";
    return c;
  }

  function wizard(ctx, host, q) {
    var st = { destroyed: false }, el = h("div", { class: "page wiz" });
    var p = String(q.p || "").split(",").filter(function (x) { return /^\d+$/.test(x); }).map(Number);
    host.replaceChildren(el);
    // đi theo đường p; cắt tại chỗ không hợp lệ
    var node = TR.root(), trail = [], result = null;
    for (var i = 0; i < p.length; i++) {
      var n = TR.node(node), o = n && n.opts[p[i]];
      if (!o) { p = p.slice(0, i); break; }
      trail.push({ q: n.q, t: o.t, upto: p.slice(0, i) });
      if (o.result) { result = { ids: o.result, note: o.note }; p = p.slice(0, i + 1); break; }
      node = o.next;
    }
    function href(path) { return "#/decide" + (path.length ? "?p=" + path.join(",") : ""); }
    var crumbs = h("ol", { class: "crumbs" }, trail.map(function (s) { return h("li", null, h("a", { href: href(s.upto), title: "Quay lại câu này" }, h("span", { class: "tq", text: s.q }), h("b", { class: "ta", text: s.t }))); }));
    var head = U.views.pageHead("Nên dùng thuật toán nào?", "Trả lời vài câu hỏi về bài toán — không cần biết tên thuật toán.", h("div", { class: "btn-row" }, h("a", { class: "btn", href: "#/tree", html: icon("decide") + "<span>Xem cả cây</span>" }), p.length ? h("a", { class: "btn btn-ghost", href: "#/decide", text: "Bắt đầu lại" }) : null));
    el.append(head);
    if (trail.length) el.append(crumbs);
    if (result) {
      var ents = result.ids.map(function (id) { return C.get(id); }).filter(Boolean);
      el.append(h("section", { class: "wiz-res" }, h("h2", { text: ents.length > 1 ? "Gợi ý: các thuật toán phù hợp" : "Gợi ý: thuật toán phù hợp" }), result.note ? h("p", { class: "res-note", text: result.note }) : null,
        h("div", { class: "res-grid" }, ents.map(function (e) { return resultCard(e); })),
        h("div", { class: "btn-row" }, ents.length > 1 ? h("a", { class: "btn btn-primary", href: "#/compare?ids=" + ents.map(function (e) { return e.id; }).join(","), html: icon("compare") + "<span>So sánh các gợi ý</span>" }) : null, h("a", { class: "btn", href: href(p.slice(0, -1)), html: icon("back") + "<span>Đổi câu trả lời cuối</span>" }), h("a", { class: "btn btn-ghost", href: "#/decide", text: "Bài toán khác" }))));
    } else {
      var n2 = TR.node(node);
      el.append(h("section", { class: "wiz-q" }, h("h2", { class: "wq", text: n2.q }),
        h("div", { class: "wopts" }, n2.opts.map(function (o, k) { return h("a", { class: "wopt", href: href(p.concat(k)) }, h("span", { text: o.t }), h("span", { html: icon("next") })); })),
        p.length ? h("a", { class: "btn btn-ghost", href: href(p.slice(0, -1)), html: icon("back") + "<span>Quay lại</span>" }) : null));
    }
    return { destroy: function () { st.destroyed = true; } };
  }

  function tree(ctx, host) {
    var el = h("div", { class: "page treev" }), box = h("div", { class: "tree" }), filter = h("input", { type: "search", class: "q2", placeholder: "Tìm thuật toán trong cây…", "aria-label": "Tìm trong cây", autocomplete: "off", maxlength: "80" });
    function node(o, depth) {
      if (!o) return null;
      var d = h("details", { class: "tn", open: depth < 1 }, h("summary", null, h("span", { text: o.q })));
      var ul = h("ul", null);
      o.opts.forEach(function (op) {
        var li = h("li", null, h("span", { class: "to", text: op.t }));
        if (op.result) {
          op.result.forEach(function (id) { var e = C.get(id); if (e) li.append(h("a", { class: "chip leaf", href: "#/a/" + id, "data-n": T.fold(e.name), text: e.name })); });
          if (op.note) li.append(h("small", { class: "faint tnote", text: op.note }));
        } else li.append(node(op.children, depth + 1));
        ul.append(li);
      });
      d.append(ul); return d;
    }
    box.append(node(TR.outline(), 0));
    function apply() {
      var f = T.fold(filter.value.trim()), leaves = box.querySelectorAll("a.leaf"), det = box.querySelectorAll("details");
      leaves.forEach(function (a) { a.classList.toggle("hit", !!f && a.getAttribute("data-n").indexOf(f) !== -1); });
      if (f) det.forEach(function (d) { d.open = !!d.querySelector("a.leaf.hit"); });
    }
    filter.addEventListener("input", U.debounce(apply, 80));
    var act = h("div", { class: "btn-row" }, h("a", { class: "btn btn-primary", href: "#/decide", html: icon("decide") + "<span>Hỏi từng câu (Wizard)</span>" }),
      h("button", { type: "button", class: "btn", text: "Mở hết", on: { click: function () { box.querySelectorAll("details").forEach(function (d) { d.open = true; }); } } }),
      h("button", { type: "button", class: "btn", text: "Thu gọn", on: { click: function () { box.querySelectorAll("details").forEach(function (d, i) { d.open = i === 0; }); } } }));
    el.append(U.views.pageHead("Cây quyết định", TR.size() + " câu hỏi → " + TR.leaves().length + " nhánh kết quả. Bấm vào tên thuật toán để mở chi tiết.", act), filter, box);
    host.replaceChildren(el);
    return { destroy: function () {} };
  }

  U.decideview = { wizard: wizard, tree: tree };
})(typeof globalThis !== "undefined" ? globalThis : this);
