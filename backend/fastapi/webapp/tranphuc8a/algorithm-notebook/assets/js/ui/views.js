/* ui/views.js — các màn không phải danh sách/chi tiết: Trang chủ, Cheat Sheet, So sánh, Lộ trình + Tiến độ. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, $ = U.$, C = A.catalog, lib = A.lib;
  var STATUS = A.user.STATUS;

  function pageHead(title, sub, actions) { return h("header", { class: "ph" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "ph-sub", text: sub }) : null), actions ? h("div", { class: "ph-act" }, actions) : null); }
  function catOf(e) { return e.category === "mine" ? C.MINE : lib.CAT[e.category]; }
  function mini(e, extra) { var a = h("a", { class: "mini", href: "#/a/" + e.id }); a.innerHTML = '<span class="mt">' + T.esc(e.name) + "</span><small>" + T.esc(extra || (e.complexity && e.complexity.time) || "") + "</small>"; return a; }
  function section(title, nodes, hint, more) { return h("section", { class: "hs" }, h("div", { class: "hs-head" }, h("h2", { text: title }), more || null), nodes && nodes.length ? h("div", { class: "mini-grid" }, nodes) : h("p", { class: "faint", text: hint || "Chưa có." })); }

  /** Tỉ lệ tiến độ theo nhóm: {cat: {total, done, mastered, learning, none}}; done = đã học + thành thạo. */
  function progress(user, entries) {
    var out = {};
    entries.forEach(function (e) {
      var p = out[e.category] || (out[e.category] = { total: 0, st: [0, 0, 0, 0] });
      p.total++; p.st[user.status(e.id)]++;
    });
    Object.keys(out).forEach(function (k) { var p = out[k]; p.done = p.st[2] + p.st[3]; p.pct = p.total ? Math.round(100 * p.done / p.total) : 0; });
    return out;
  }

  // ================================================================================================= Trang chủ
  function home(ctx, host) {
    var user = ctx.user, st = { destroyed: false }, el = h("div", { class: "page home" });
    host.replaceChildren(el);
    function draw() {
      if (st.destroyed) return;
      var all = C.all(), builtin = all.filter(function (e) { return e.source !== "user"; }), prog = progress(user, builtin);
      var learning = all.filter(function (e) { return user.status(e.id) === 1; }).slice(0, 8), marked = all.filter(function (e) { return user.isBookmarked(e.id); }).slice(0, 8);
      var done = builtin.filter(function (e) { return user.status(e.id) >= 2; }).length, due = A.practice ? A.practice.dueCount(user) : 0;
      var form = h("form", { class: "hero-search", role: "search" }, h("span", { class: "lp-ic", html: icon("search") }), h("input", { type: "search", class: "q2", placeholder: "Tìm thuật toán: dijk · tag:graph · O(logN) · range query", "aria-label": "Tìm thuật toán", autocomplete: "off", maxlength: "200" }), h("button", { type: "submit", class: "btn btn-primary", text: "Tìm" }));
      form.addEventListener("submit", function (ev) { ev.preventDefault(); ctx.go("#/lib?q=" + U.enc($("input", form).value.trim())); });
      var rand = (function () { var pool = builtin.filter(function (e) { return user.status(e.id) < 2; }); if (!pool.length) pool = builtin; var e0 = pool[Math.floor(Math.random() * pool.length)]; return e0 ? h("a", { class: "redis", href: "#/a/" + e0.id, html: "<b>" + T.esc(e0.name) + "</b><span>" + T.esc(e0.summary || "") + "</span><small>" + T.esc((catOf(e0) || {}).name || "") + "</small>" }) : null; })();
      var bars = Object.keys(prog).map(function (k) { var p = prog[k], c = lib.CAT[k]; return h("a", { class: "pbar", href: "#/lib?cat=" + k }, h("span", { class: "pb-l", html: icon(c.icon) + "<span>" + T.esc(c.name) + "</span>" }), h("span", { class: "pb-t", role: "progressbar", "aria-valuenow": String(p.pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": c.name }, h("i", { style: "width:" + p.pct + "%" })), h("b", { text: p.pct + "%" })); });
      el.replaceChildren.apply(el, [
        pageHead("Sổ tay thuật toán", builtin.length + " thuật toán dựng sẵn" + (all.length > builtin.length ? " · " + (all.length - builtin.length) + " của bạn" : "") + " · đã học " + done + "/" + builtin.length),
        form,
        h("div", { class: "cards3" },
          h("a", { class: "bigcard", href: "#/decide" }, h("span", { class: "bc-ic", html: icon("decide") }), h("b", { text: "Nên dùng thuật toán nào?" }), h("small", { text: "Wizard & cây quyết định" }), h("p", { text: "Trả lời vài câu hỏi về bài toán, không cần biết tên thuật toán." })),
          h("a", { class: "bigcard", href: "#/compare" }, h("span", { class: "bc-ic", html: icon("compare") }), h("b", { text: "So sánh" }), h("small", { text: "Fenwick vs Segment Tree…" }), h("p", { text: "Bảng đặt 2–4 thuật toán cạnh nhau, tô điểm khác biệt." })),
          h("a", { class: "bigcard" + (due ? " due" : ""), href: "#/practice" }, h("span", { class: "bc-ic", html: icon("practice") }), h("b", { text: "Luyện tập" }), h("small", { text: due ? due + " thẻ đến hạn" : "Flashcard · Quiz · Trực quan" }), h("p", { text: due ? "Ôn ngay để nhớ lâu." : "Ôn thẻ, làm quiz chọn thuật toán, xem thuật toán chạy từng bước." }))),
        h("div", { class: "cards3" },
          h("a", { class: "bigcard", href: "#/cheat" }, h("span", { class: "bc-ic", html: icon("cheat") }), h("b", { text: "Cheat Sheet" }), h("small", { text: "Tra trong 5 giây" }), h("p", { text: "Độ phức tạp + khi nào dùng, dạng ngắn gọn." })),
          h("a", { class: "bigcard", href: "#/templates" }, h("span", { class: "bc-ic", html: icon("template") }), h("b", { text: "Template" }), h("small", { text: user.templates().length + " tệp của bạn" }), h("p", { text: "Lưu, sửa, sao chép, xuất template.cpp của riêng bạn." })),
          h("a", { class: "bigcard", href: "#/learn" }, h("span", { class: "bc-ic", html: icon("learn") }), h("b", { text: "Lộ trình & tiến độ" }), h("small", { text: "ICPC · CTDL&GT · phỏng vấn" }), h("p", { text: "Chọn mục tiêu, đi theo thứ tự, theo dõi % theo nhóm." }))),
        section("Đang học", learning.map(function (e) { return mini(e); }), "Chưa có mục nào ở trạng thái \"Đang học\". Mở một thuật toán và đổi trạng thái."),
        section("Đã đánh dấu quan trọng", marked.map(function (e) { return mini(e); }), "Bấm biểu tượng đánh dấu trong trang thuật toán (Dinic, LCA, Tree DP…)."),
        h("section", { class: "hs" }, h("div", { class: "hs-head" }, h("h2", { text: "Tiến độ theo nhóm" }), h("a", { class: "btn btn-ghost", href: "#/learn", text: "Chi tiết" })), h("div", { class: "pbars" }, bars)),
        rand ? h("section", { class: "hs" }, h("h2", { text: "Gợi ý hôm nay" }), rand) : null
      ].filter(Boolean));
    }
    draw();
    var off = user.on(function (ev) { if (!st.destroyed && /^(mark|item|card|restore|wipe)$/.test(ev.type)) draw(); });
    return { destroy: function () { st.destroyed = true; off(); } };
  }

  // ================================================================================================= Cheat Sheet
  function cheat(ctx, host, q) {
    var user = ctx.user, st = { cat: q.cat || "", bm: q.bm === "1", q: "" }, el = h("div", { class: "page cheat" }), grid = h("div", { class: "cheat-grid" });
    var search = h("input", { type: "search", class: "q2", placeholder: "Lọc nhanh theo tên / tag…", "aria-label": "Lọc cheat sheet", autocomplete: "off", maxlength: "100" });
    var chips = h("div", { class: "chips", role: "group", "aria-label": "Nhóm" });
    function entries() {
      var f = T.fold(st.q);
      return C.all().filter(function (e) { return (e.source !== "user" || user.isBookmarked(e.id)) && (!st.cat || e.category === st.cat) && (!st.bm || user.isBookmarked(e.id)) && (!f || T.fold(e.name + " " + e.tags.join(" ") + " " + (e.aliases || []).join(" ")).indexOf(f) !== -1); }).slice(0, 400);
    }
    function drawChips() {
      chips.replaceChildren.apply(chips, [h("button", { type: "button", class: "chip" + (!st.cat ? " on" : ""), "aria-pressed": String(!st.cat), dataset: { cat: "" }, text: "Tất cả" })].concat(C.categories().filter(function (c) { return c.id !== "mine"; }).map(function (c) { return h("button", { type: "button", class: "chip" + (st.cat === c.id ? " on" : ""), "aria-pressed": String(st.cat === c.id), dataset: { cat: c.id }, text: c.name }); })).concat([h("button", { type: "button", class: "chip" + (st.bm ? " on" : ""), "aria-pressed": String(st.bm), dataset: { bm: "1" }, html: icon("bookmark") + "<span>Đã đánh dấu</span>" })]));
    }
    function draw() {
      var list = entries();
      grid.replaceChildren.apply(grid, list.map(function (e) {
        var cx = e.complexity || {}, c = h("article", { class: "cc" }, h("h3", null, h("a", { href: "#/a/" + e.id, text: e.name }), h("small", { text: (catOf(e) || {}).name || "" })),
          h("p", { class: "cc-cx mono" }, h("b", { text: cx.time || "—" }), cx.space ? h("span", { class: "faint", text: "  ·  " + cx.space }) : null));
        if ((e.ops || []).length) c.append(h("dl", { class: "qc-ops" }, e.ops.slice(0, 6).map(function (o) { return [h("dt", { text: o[0] }), h("dd", { class: "mono", text: o[1] })]; }).reduce(function (a, b) { return a.concat(b); }, [])));
        if ((e.use_case || [])[0]) c.append(h("p", { class: "cc-use", text: e.use_case[0] }));
        if ((e.not_for || [])[0]) c.append(h("p", { class: "cc-not", text: "✕ " + e.not_for[0] }));
        return c;
      }));
      if (!list.length) grid.append(h("div", { class: "empty-list" }, h("p", { class: "big", text: "Không có mục nào" }), h("p", { text: "Đổi nhóm hoặc bỏ lọc." })));
      el.querySelector(".ph-sub").textContent = list.length + " mục — bấm tên để mở chi tiết";
      ctx.route({ cat: st.cat, bm: st.bm ? "1" : "" }, true, "cheat");
    }
    chips.addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (!b) return; if (b.dataset.bm) st.bm = !st.bm; else st.cat = b.dataset.cat; drawChips(); draw(); });
    search.addEventListener("input", U.debounce(function () { st.q = search.value; draw(); }, 80));
    var printBtn = h("button", { type: "button", class: "btn", html: icon("print") + "<span>In / PDF</span>", on: { click: function () { U.exporters.printCheat(entries(), "Cheat Sheet" + (st.cat ? " — " + C.catName(st.cat) : "") + (st.bm ? " (đã đánh dấu)" : ""), ctx); } } });
    var mdBtn = h("button", { type: "button", class: "btn", html: icon("download") + "<span>Markdown</span>", on: { click: function () { U.download("cheatsheet.md", new Blob([A.backup.cheatToMarkdown(entries(), "Cheat Sheet")], { type: "text/markdown" })); } } });
    el.append(pageHead("Cheat Sheet", "…", h("div", { class: "btn-row" }, printBtn, mdBtn)), chips, search, grid);
    host.replaceChildren(el);
    drawChips(); draw();
    return { destroy: function () {} };
  }

  // ================================================================================================= So sánh
  function compare(ctx, host, q) {
    var ids = (q.ids || "").split(",").filter(function (id) { return C.get(id); }).slice(0, A.compare.MAX), el = h("div", { class: "page cmp" }), pick = h("div", { class: "cmp-pick" }), out = h("div", { class: "cmp-out" });
    function go(list) { ctx.route({ ids: list.join(",") }, true, "compare"); ids = list; draw(); }
    var inp = h("input", { type: "search", class: "q2", placeholder: "Thêm thuật toán để so sánh… (gõ tên)", "aria-label": "Thêm thuật toán", autocomplete: "off", maxlength: "80" });
    var sug = h("div", { class: "cmp-sug", hidden: true });
    function showSug() {
      var v = inp.value.trim(); if (!v) { sug.hidden = true; return; }
      var r = A.find.search(U.list.records(), v, { limit: 6, filter: function (e) { return ids.indexOf(e.id) === -1; } }).results;
      sug.hidden = !r.length;
      sug.replaceChildren.apply(sug, r.map(function (x) { var b = h("button", { type: "button", class: "sg", html: "<span>" + T.esc(x.e.name) + "</span><small>" + T.esc((catOf(x.e) || {}).name || "") + "</small>" }); b.addEventListener("pointerdown", function (ev) { ev.preventDefault(); if (ids.length >= A.compare.MAX) { ctx.toast("Tối đa " + A.compare.MAX + " thuật toán."); return; } inp.value = ""; sug.hidden = true; go(ids.concat(x.e.id)); }); return b; }));
    }
    inp.addEventListener("input", showSug); inp.addEventListener("blur", function () { setTimeout(function () { sug.hidden = true; }, 150); });
    function draw() {
      var chipRow = h("div", { class: "chips" }, ids.map(function (id) { var e = C.get(id); return h("span", { class: "chip on tagchip" }, h("a", { class: "tagname", href: "#/a/" + id, text: e.name }), h("button", { type: "button", class: "tagx", "aria-label": "Bỏ " + e.name, html: icon("x"), on: { click: function () { go(ids.filter(function (x) { return x !== id; })); } } })); }));
      pick.replaceChildren(chipRow, h("div", { class: "cmp-add" }, inp, sug));
      if (ids.length < 2) {
        out.replaceChildren(h("p", { class: "faint", text: ids.length ? "Chọn thêm ít nhất một thuật toán." : "Chọn 2–4 thuật toán, hoặc bấm một bộ gợi ý:" }), h("div", { class: "sets" }, A.compareSets.map(function (s) { return h("button", { type: "button", class: "chip", text: s.name, on: { click: function () { go(s.ids.slice(0, A.compare.MAX)); } } }); })));
        return;
      }
      var tb = A.compare.build(ids.map(function (id) { return C.get(id); }));
      var table = h("table", { class: "cmp-t" }, h("thead", null, h("tr", null, [h("th", { text: "Tiêu chí" })].concat(tb.cols.map(function (c) { return h("th", null, h("a", { href: "#/a/" + c.id, text: c.name })); })))),
        h("tbody", null, tb.rows.map(function (r) { return h("tr", { class: "k-" + r.kind + (r.diff ? " diff" : "") }, [h("th", { scope: "row", text: r.label })].concat(r.cells.map(function (c) { return h("td", { class: r.kind === "cx" || r.kind === "op" ? "mono" : "", text: c }); }))); })));
      var act = h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", html: icon("copy") + "<span>Sao chép Markdown</span>", on: { click: function () { U.copyText(A.compare.toMarkdown(tb)).then(function (ok) { ctx.toast(ok ? "Đã sao chép bảng" : "Không sao chép được"); }); } } }), h("button", { type: "button", class: "btn", html: icon("print") + "<span>In / PDF</span>", on: { click: function () { U.exporters.printCompare(tb, ctx); } } }), h("button", { type: "button", class: "btn btn-ghost", text: "Chọn bộ khác", on: { click: function () { go([]); } } }));
      out.replaceChildren(h("p", { class: "faint", text: "Hàng được tô nền là hàng có điểm khác nhau giữa các thuật toán." }), h("div", { class: "tbl-wrap cmp-wrap" }, table), act);
    }
    el.append(pageHead("So sánh thuật toán", "Đặt 2–4 thuật toán cạnh nhau: độ phức tạp, thao tác, ưu nhược, khi nào dùng."), pick, out);
    host.replaceChildren(el); draw();
    return { destroy: function () {} };
  }

  // ================================================================================================= Lộ trình + tiến độ
  function learn(ctx, host, arg) {
    var user = ctx.user, st = { destroyed: false }, el = h("div", { class: "page learn" });
    host.replaceChildren(el);
    function drawHub() {
      var builtin = C.all().filter(function (e) { return e.source !== "user"; }), prog = progress(user, builtin), tot = [0, 0, 0, 0];
      builtin.forEach(function (e) { tot[user.status(e.id)]++; });
      var overall = builtin.length ? Math.round(100 * (tot[2] + tot[3]) / builtin.length) : 0;
      var dash = h("section", { class: "hs" }, h("h2", { text: "Tiến độ" }),
        h("div", { class: "dash" },
          h("div", { class: "dash-all" }, h("b", { class: "big-pct", text: overall + "%" }), h("small", { text: "đã học hoặc thành thạo (" + (tot[2] + tot[3]) + "/" + builtin.length + ")" }), h("div", { class: "stack-bar", role: "img", "aria-label": STATUS.map(function (s, i) { return s + ": " + tot[i]; }).join(", ") }, tot.map(function (n, i) { return h("i", { class: "sb" + i, style: "flex:" + n, title: STATUS[i] + ": " + n }); })), h("p", { class: "legend" }, STATUS.map(function (s, i) { return h("span", null, h("i", { class: "sb" + i }), s + " " + tot[i]); }))),
          h("div", { class: "pbars" }, Object.keys(prog).map(function (k) { var p = prog[k], c = lib.CAT[k]; return h("a", { class: "pbar", href: "#/lib?cat=" + k }, h("span", { class: "pb-l", html: icon(c.icon) + "<span>" + T.esc(c.name) + "</span>" }), h("span", { class: "pb-t", role: "progressbar", "aria-valuenow": String(p.pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": c.name }, h("i", { style: "width:" + p.pct + "%" })), h("b", { text: p.pct + "%" })); }))));
      var cards = h("div", { class: "rm-grid" }, A.roadmaps.map(function (r) {
        var ids = []; r.stages.forEach(function (s) { ids = ids.concat(s.ids); });
        var done = ids.filter(function (id) { return user.status(id) >= 2; }).length, pct = Math.round(100 * done / ids.length);
        return h("a", { class: "rm-card", href: "#/learn/" + r.id }, h("b", { text: r.name }), h("small", { text: r.goal }), h("p", { text: r.blurb }), h("span", { class: "pb-t", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Tiến độ " + r.name }, h("i", { style: "width:" + pct + "%" })), h("small", { class: "faint", text: done + "/" + ids.length + " mục · " + r.stages.length + " chặng" }));
      }));
      el.replaceChildren(pageHead("Lộ trình & tiến độ", "Chọn mục tiêu, học theo thứ tự đề xuất, đổi trạng thái từng thuật toán để theo dõi."), h("section", { class: "hs" }, h("h2", { text: "Chọn mục tiêu" }), cards), dash);
    }
    function drawRoad(r) {
      var ids = []; r.stages.forEach(function (s) { ids = ids.concat(s.ids); });
      var next = ids.filter(function (id) { return user.status(id) < 2; })[0], done = ids.filter(function (id) { return user.status(id) >= 2; }).length;
      var nextE = next && C.get(next);
      var stages = r.stages.map(function (s) {
        var d = s.ids.filter(function (id) { return user.status(id) >= 2; }).length;
        return h("section", { class: "stage" }, h("h2", null, s.title, h("small", { text: d + "/" + s.ids.length })), h("p", { class: "faint", text: s.why }),
          h("ol", { class: "steps" }, s.ids.map(function (id, i) {
            var e = C.get(id), sv = user.status(id);
            var sel = h("select", { class: "st-sel sm", "aria-label": "Trạng thái " + e.name }, STATUS.map(function (n, k) { return h("option", { value: k, text: n }); })); sel.value = String(sv);
            sel.addEventListener("change", function () { user.setMark(id, { st: +sel.value }); });
            return h("li", { class: "step st" + sv + (id === next ? " next" : "") }, h("span", { class: "dot" }), h("a", { href: "#/a/" + id, text: e.name }), h("small", { class: "mono", text: (e.complexity && e.complexity.time) || "" }), sel);
          })));
      });
      el.replaceChildren(h("a", { class: "back-link", href: "#/learn", text: "← Tất cả lộ trình" }), pageHead(r.name, r.blurb), h("div", { class: "rm-sum" }, h("b", { text: Math.round(100 * done / ids.length) + "%" }), h("span", { text: done + "/" + ids.length + " mục đã học" }), nextE ? h("a", { class: "btn btn-primary", href: "#/a/" + next, html: icon("next") + "<span>Học tiếp: " + T.esc(nextE.name) + "</span>" }) : h("b", { class: "ok", text: "Hoàn thành lộ trình! 🎉" })), h("div", { class: "stages" }, stages));
    }
    function draw() {
      if (st.destroyed) return;
      var r = arg && A.roadmaps.filter(function (x) { return x.id === arg; })[0];
      if (arg && !r) { el.replaceChildren(pageHead("Không có lộ trình này"), h("a", { class: "btn btn-primary", href: "#/learn", text: "Xem các lộ trình" })); return; }
      if (r) drawRoad(r); else drawHub();
    }
    draw();
    var off = user.on(function (ev) { if (!st.destroyed && /^(mark|item|restore|wipe)$/.test(ev.type)) draw(); });
    return { destroy: function () { st.destroyed = true; off(); } };
  }

  U.views = { home: home, cheat: cheat, compare: compare, learn: learn, pageHead: pageHead, progress: progress, mini: mini };
})(typeof globalThis !== "undefined" ? globalThis : this);
