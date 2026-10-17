/* ui/list.js — chỉ mục tìm kiếm (dựng sẵn + của tôi), cuộn ẢO và cột danh sách + khung tìm.
   Chỉ mục: mỗi mục một bản ghi (core/find.js); mục của tôi / ghi chú đổi thì cập nhật đúng bản ghi đó (không dựng lại cả 10.000).
   Địa chỉ: #/lib?q=&cat=&bm=1&st=&src=&sort= (thư viện) · #/mine (chỉ mục của tôi). */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, $ = U.$, F = A.find, C = A.catalog, lib = A.lib;
  var ROW = 76, OVER = 6, LIMIT = 50000;   // cuộn ảo nên DOM không đổi; 50.000 × 76 px ≈ 3,8 triệu px, dưới trần chiều cao phần tử của Firefox (≈ 17,9 triệu)

  // ------------------------------------------------------------------------------------------------ chỉ mục
  var recs = new Map(), arr = null, user = null;
  function noteText(id) { var n = user && user.note(id); return n ? n.text : ""; }
  function rebuild() { recs = new Map(); C.all().forEach(function (e) { recs.set(e.id, F.record(e, noteText(e.id))); }); arr = null; scheduleWarm(); }
  var warming = 0;
  /** Lúc rảnh, gấp sẵn toàn văn của mọi bản ghi (từng lát ≤ 8 ms) để tìm sâu luôn nhanh. */
  function scheduleWarm() {
    var my = ++warming, idle = root.requestIdleCallback ? function (f) { root.requestIdleCallback(f, { timeout: 300 }); } : function (f) { setTimeout(f, 16); };
    (function step() { if (my !== warming) return; if (!F.warm(records(), 8)) idle(step); })();
  }
  function update(id) {
    var e = C.get(id);
    if (!e) recs.delete(id); else recs.set(id, F.record(e, noteText(id)));
    arr = null;
  }
  function records() { return arr || (arr = Array.from(recs.values())); }
  function attach(u) {
    user = u; rebuild();
    u.on(function (ev) {
      if (ev.type === "restore" || ev.type === "wipe") rebuild();
      else if (ev.type === "item" || ev.type === "note") update(ev.id);
    });
  }
  var catIndex = {}; lib.CATEGORIES.concat([C.MINE]).forEach(function (c, i) { catIndex[c.id] = i; });
  function byGroup(a, b) { return (catIndex[a.e.category] - catIndex[b.e.category]) || (a.e.sub || "").localeCompare(b.e.sub || "", "vi") || a.e.name.localeCompare(b.e.name, "vi"); }
  var SORTS = [["group", "Theo nhóm"], ["name", "Tên A→Z"], ["level", "Dễ → khó"]];
  var STATUS = A.user.STATUS;

  /** state: {q, cat, bm, st ("" hoặc 0..3), src ("" | "user" | "builtin"), sort}. → {results: [{e, score}], total, ms} */
  function run(state) {
    var filter = function (e) {
      if (state.cat && e.category !== state.cat) return false;
      if (state.src === "user" && e.source !== "user") return false;
      if (state.src === "builtin" && e.source === "user") return false;
      if (state.bm && !user.isBookmarked(e.id)) return false;
      if (state.st !== "" && state.st != null && user.status(e.id) !== +state.st) return false;
      return true;
    };
    var r = F.search(records(), state.q || "", { filter: filter, limit: 1e9 });
    if (state.sort === "name") r.results.sort(function (a, b) { return a.e.name.localeCompare(b.e.name, "vi"); });
    else if (state.sort === "level") r.results.sort(function (a, b) { return a.e.level - b.e.level || a.e.name.localeCompare(b.e.name, "vi"); });
    else if (!state.q) r.results.sort(byGroup);                       // "theo nhóm" khi không tìm; có từ khoá thì giữ thứ tự điểm
    r.results = r.results.slice(0, LIMIT);
    return r;
  }

  // ------------------------------------------------------------------------------------------------ cuộn ảo
  function vlist(host, opts) {
    var space = h("div", { class: "vl-space", role: "list" }), rows = new Map(), raf = 0, empty = null;
    host.replaceChildren(space);
    function render() {
      raf = 0;
      var n = opts.count();
      if (empty) { empty.remove(); empty = null; }
      if (!n) { space.style.height = "0px"; rows.forEach(function (el) { el.remove(); }); rows.clear(); empty = opts.empty ? opts.empty() : null; if (empty) host.append(empty); return; }
      space.style.height = n * ROW + "px";
      var top = host.scrollTop, first = Math.max(0, Math.floor(top / ROW) - OVER), last = Math.min(n - 1, Math.ceil((top + host.clientHeight) / ROW) + OVER);
      rows.forEach(function (el, i) { if (i < first || i > last) { el.remove(); rows.delete(i); } });
      for (var i = first; i <= last; i++) {
        if (rows.has(i)) continue;
        var el = opts.row(i);
        el.style.top = i * ROW + "px"; el.setAttribute("role", "listitem"); el.setAttribute("aria-posinset", i + 1); el.setAttribute("aria-setsize", n);
        space.append(el); rows.set(i, el);
      }
    }
    function schedule() { if (!raf) raf = root.requestAnimationFrame(render); }
    host.addEventListener("scroll", schedule, { passive: true });
    var ro = root.ResizeObserver ? new root.ResizeObserver(schedule) : null; if (ro) ro.observe(host);
    host.addEventListener("keydown", function (e) {
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !e.target.closest(".nrow")) return;
      var cur = +e.target.closest(".nrow").getAttribute("aria-posinset") - 1, to = cur + (e.key === "ArrowDown" ? 1 : -1), n = opts.count();
      if (to < 0 || to >= n) return;
      e.preventDefault();
      host.scrollTop = Math.min(Math.max(host.scrollTop, to * ROW + ROW - host.clientHeight + 8), to * ROW);
      render();
      var el = rows.get(to); if (el) el.focus();
    });
    return {
      refresh: function () { rows.forEach(function (el) { el.remove(); }); rows.clear(); render(); },
      scrollToTop: function () { host.scrollTop = 0; },
      scrollToIndex: function (i) { host.scrollTop = Math.max(0, i * ROW - host.clientHeight / 3); render(); },
      destroy: function () { host.removeEventListener("scroll", schedule); if (ro) ro.disconnect(); }
    };
  }

  /** Dòng một thuật toán (cao cố định ROW). */
  function row(e, o) {
    var a = h("a", { class: "nrow" + (o.current === e.id ? " cur" : ""), href: "#/a/" + e.id, dataset: { id: e.id } });
    var st = user.status(e.id), cat = e.category === "mine" ? C.MINE : lib.CAT[e.category], cx = (e.complexity && e.complexity.time) || "";
    a.innerHTML = '<span class="nr-top"><span class="nr-title">' + T.esc(e.name) + "</span>" + (user.isBookmarked(e.id) ? '<span class="nr-fav" title="Đã đánh dấu">' + icon("bookmark", "ic-fill") + "</span>" : "") + (st ? '<span class="st-dot st' + st + '" title="' + T.esc(STATUS[st]) + '"></span>' : "") + "</span>" +
      '<span class="nr-sn">' + T.esc(e.summary || (e.description || "").slice(0, 120)) + "</span>" +
      '<span class="nr-meta"><span class="nr-cat">' + T.esc(cat ? cat.name : e.category) + "</span>" + (cx ? '<span class="nr-cx">' + T.esc(cx) + "</span>" : "") + (e.source === "user" ? '<span class="ntag own">của tôi</span>' : "") + e.tags.slice(0, 2).map(function (t) { return '<span class="ntag">' + T.esc(t) + "</span>"; }).join("") + "</span>";
    return a;
  }

  /** Cột danh sách. ctx: {user, route(query, replace), open(id), newItem()} → {el, setState, refresh, focusSearch, setCurrent, scrollTo}. */
  function create(ctx) {
    var state = { q: "", cat: "", bm: false, st: "", src: "", sort: "group" }, current = "", res = { results: [], total: 0, ms: 0 };
    var input = h("input", { type: "search", id: "q", class: "q", placeholder: "Tìm: dijk · tag:graph · O(logN) · range query", autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "search", "aria-label": "Tìm thuật toán", maxlength: "200" });
    var clear = h("button", { type: "button", class: "icon-btn clear", hidden: true, "aria-label": "Xoá ô tìm kiếm", html: icon("x") });
    var catSel = h("select", { "aria-label": "Nhóm", class: "sort", dataset: { f: "cat" } });
    var stSel = h("select", { "aria-label": "Trạng thái học", class: "sort", dataset: { f: "st" } }, [["", "Mọi trạng thái"]].concat(STATUS.map(function (s, i) { return [String(i), s]; })).map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    var sortSel = h("select", { "aria-label": "Sắp xếp", class: "sort", dataset: { f: "sort" } }, SORTS.map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    var bmBtn = h("button", { type: "button", class: "icon-btn fav-f", "aria-pressed": "false", "aria-label": "Chỉ hiện mục đã đánh dấu", title: "Chỉ mục đã đánh dấu", html: icon("bookmark") });
    var head = h("div", { class: "lp-head" }, h("form", { class: "lp-search", role: "search" }, h("span", { class: "lp-ic", html: icon("search") }), input, clear), h("div", { class: "lp-filters" }, h("div", { class: "lp-row2" }, catSel, bmBtn), h("div", { class: "lp-row2" }, stSel, sortSel)));
    var count = h("p", { class: "lp-count", role: "status", "aria-live": "polite" }), body = h("div", { class: "lp-body" });
    var el = h("section", { class: "lp", "aria-label": "Danh sách thuật toán" }, head, count, body);
    var vl = vlist(body, {
      count: function () { return res.results.length; },
      row: function (i) { return row(res.results[i].e, { current: current }); },
      empty: function () {
        var box = h("div", { class: "empty-list" });
        if (state.q) {
          box.innerHTML = '<p class="big">Không tìm thấy “' + T.esc(state.q) + "”</p><p>Thử gõ ít chữ hơn, bỏ dấu, hoặc dùng <code>tag:graph</code>, <code>O(logN)</code>. Chưa có trong thư viện? Thêm vào “của tôi”.</p>";
          var b = h("button", { type: "button", class: "btn", text: "Thêm “" + state.q.slice(0, 40) + "” vào thư viện của tôi" }); b.addEventListener("click", function () { ctx.newItem({ name: state.q }); }); box.append(b);
        } else if (state.bm) box.innerHTML = '<p class="big">Chưa đánh dấu mục nào</p><p>Mở một thuật toán và bấm biểu tượng đánh dấu.</p>';
        else if (state.src === "user") { box.innerHTML = '<p class="big">Thư viện của tôi còn trống</p><p>Thêm thuật toán, mẹo hoặc kiến thức ngoài danh mục (vd Li Chao Tree từ cp-algorithms).</p>'; var n = h("button", { type: "button", class: "btn btn-primary", text: "Thêm mục đầu tiên" }); n.addEventListener("click", function () { ctx.newItem({}); }); box.append(n); }
        else box.innerHTML = '<p class="big">Không có mục nào khớp bộ lọc</p>';
        return box;
      }
    });

    function fillCats() {
      var cur = state.cat, opts = [["", "Mọi nhóm"]].concat(C.categories().map(function (c) { return [c.id, c.name]; }));
      catSel.replaceChildren.apply(catSel, opts.map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      catSel.value = cur;
    }
    function refresh() {
      fillCats();
      res = run(state);
      catSel.value = state.cat; stSel.value = state.st == null ? "" : String(state.st); sortSel.value = state.sort; bmBtn.setAttribute("aria-pressed", String(!!state.bm));
      count.dataset.q = state.q || "";                                         // check.py chờ đúng kết quả của câu vừa gõ
      count.textContent = res.total.toLocaleString("vi-VN") + " mục" + (state.q ? " · " + res.ms + " ms" : "") + (res.total > res.results.length ? " (hiện " + res.results.length.toLocaleString("vi-VN") + " đầu)" : "");
      clear.hidden = !input.value; vl.refresh(); vl.scrollToTop();
    }

    var typing = U.debounce(function () { state.q = input.value; ctx.route(Object.assign({}, qs(), { q: state.q }), true); refresh(); }, 90);
    function qs() { return { cat: state.cat, bm: state.bm ? "1" : "", st: state.st, src: state.src, sort: state.sort === "group" ? "" : state.sort }; }
    input.addEventListener("input", function () { clear.hidden = !input.value; typing(); });
    clear.addEventListener("click", function () { input.value = ""; state.q = ""; ctx.route(qs(), true); refresh(); input.focus(); });
    $("form", head).addEventListener("submit", function (e) { e.preventDefault(); if (res.results[0]) ctx.open(res.results[0].e.id); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { var first = $(".nrow", body); if (first) { e.preventDefault(); first.focus(); } }
      else if (e.key === "Escape" && input.value) { e.preventDefault(); clear.click(); }
    });
    head.addEventListener("change", function (e) {
      var f = e.target.dataset && e.target.dataset.f; if (!f) return;
      var s = Object.assign({}, state, { q: input.value }); s[f] = e.target.value; ctx.route({ q: s.q, cat: s.cat, bm: s.bm ? "1" : "", st: s.st, src: s.src, sort: s.sort === "group" ? "" : s.sort });
    });
    bmBtn.addEventListener("click", function () { ctx.route({ q: input.value, cat: state.cat, bm: state.bm ? "" : "1", st: state.st, src: state.src, sort: state.sort === "group" ? "" : state.sort }); });
    user.on(function (ev) { if (el.isConnected && /^(item|mark|restore|wipe|note)$/.test(ev.type)) { var top = body.scrollTop; refresh(); body.scrollTop = top; vl.refresh(); } });

    return {
      el: el,
      setState: function (s) { state = Object.assign({ q: "", cat: "", bm: false, st: "", src: "", sort: "group" }, s); if (input.value !== state.q) input.value = state.q; refresh(); },
      refresh: refresh, setCurrent: function (id) { if (id !== current) { current = id; vl.refresh(); } }, focusSearch: function () { input.focus(); input.select(); },
      scrollTo: function (id) { var i = res.results.findIndex(function (x) { return x.e.id === id; }); if (i >= 0) vl.scrollToIndex(i); },
      results: function () { return res.results; }
    };
  }

  U.list = { create: create, vlist: vlist, row: row, attach: attach, rebuild: rebuild, update: update, run: run, records: records, ROW: ROW };
})(typeof globalThis !== "undefined" ? globalThis : this);
