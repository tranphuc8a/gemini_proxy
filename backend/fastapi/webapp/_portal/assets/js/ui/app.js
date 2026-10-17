/* ui/app.js — điều phối cổng: nạp dữ liệu, giữ trạng thái xem, vẽ trang chủ / danh sách kết quả, nối sự kiện.
   Logic thuần (lọc, sắp xếp, nhóm, URL, dữ liệu cá nhân) nằm ở assets/js/core/*; ở đây chỉ có DOM.

   Một trang, ba cách xem:
     Trang chủ  — các phần: Yêu thích, Mở gần đây, Mới cập nhật, Ứng dụng của tôi, Khoá học, Thư viện (nhóm gập)
     Tất cả / Yêu thích / Đã ẩn — danh sách phẳng hoặc nhóm, có thanh bộ lọc (máy tính) hoặc tờ trượt (điện thoại)
   Có tìm kiếm hoặc bộ lọc nào đang bật thì trang chủ nhường chỗ cho danh sách kết quả; xoá hết thì quay lại. */
(function (root) {
  "use strict";
  var P = root.Portal, T = P.text, S = P.search, M = P.model, PR = P.prefs, U = P.url, D = P.dom, F = P.facets, C = P.cards;
  var h = D.h, icon = D.icon, $ = D.$, $$ = D.$$, doc = root.document;
  var PAGE = 120;

  var st = {
    apps: [], byPath: {}, config: M.normalizeConfig(), facets: null, loaded: false, error: null, stale: 0,
    view: U.emptyView(), limit: PAGE, autoAll: false, entries: [], sections: {}, libApps: {},
    rail: h("aside", { class: "rail", id: "rail", "aria-label": "Bộ lọc" })
  };
  var els = {};
  var TABS = [{ id: "home", label: "Trang chủ", icon: "home" }, { id: "all", label: "Tất cả", icon: "grid" }, { id: "favorites", label: "Yêu thích", icon: "star" }, { id: "hidden", label: "Đã ẩn", icon: "eye-off" }];
  var SORTS = [["relevance", "Phù hợp"], ["popular", "Hay mở nhất"], ["recent", "Mở gần đây"], ["updated", "Mới cập nhật"], ["name", "Tên A → Z"], ["name-desc", "Tên Z → A"], ["collection", "Theo thư mục"], ["category", "Theo thể loại"]];
  var GROUPS = [["none", "Không nhóm"], ["collection", "Nhóm theo thư mục"], ["category", "Nhóm theo thể loại"]];

  function prefs() { return P.store.get(); }
  function setPrefs(p) { P.store.set(p); }
  function webapp() { return new root.URL("../", root.location.href).href.replace(/\/$/, ""); }
  function portalUrl() { return root.location.origin + root.location.pathname; }

  // ================================================================== giao diện sáng/tối, kiểu hiển thị
  function resolvedTheme() {
    var t = prefs().settings.theme;
    return t === "system" ? (root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
  }
  function applyAppearance() {
    var s = prefs().settings, r = resolvedTheme(), de = doc.documentElement;
    // Chỉ đặt thuộc tính mà CSS cần. KHÔNG đặt data-view lên <html>: nút lưới/danh sách cũng dùng data-view và
    // closest("[data-view]") sẽ trúng <html> ở mọi cú bấm (đã từng làm chết cả "Hiện thêm" lẫn bộ lọc).
    de.dataset.theme = r; de.dataset.density = s.density;
    els.theme.innerHTML = icon(s.theme === "system" ? "monitor" : r === "dark" ? "moon" : "sun");
    els.theme.setAttribute("aria-label", "Giao diện: " + (s.theme === "system" ? "theo hệ thống" : s.theme === "dark" ? "tối" : "sáng") + ". Bấm để đổi");
    D.$$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", r === "dark" ? "#0a0f16" : "#f4f6fb"); });
  }
  function cycleTheme() {
    var order = ["system", "light", "dark"], cur = prefs().settings.theme;
    setSetting("theme", order[(order.indexOf(cur) + 1) % 3]);
    D.toast("Giao diện: " + { system: "theo hệ thống", light: "sáng", dark: "tối" }[prefs().settings.theme]);
  }
  function setSetting(k, v) {
    setPrefs(PR.setSetting(prefs(), k, v));
    applyAppearance();
    if (k === "sort") st.view.sort = null;
    if (k === "group") st.view.group = null;
    render(); writeUrl();
  }
  function toggleView() { setSetting("view", prefs().settings.view === "grid" ? "list" : "grid"); }

  // ================================================================== URL ⇄ trạng thái xem
  function readUrl() { st.view = U.fromQuery(root.location.search, PR.ENUMS); st.autoAll = false; st.limit = PAGE; }
  function writeUrl(push) {
    var s = prefs().settings, qs = U.toQuery(st.view, { sort: s.sort, group: s.group });
    var next = root.location.pathname + qs;
    if (next !== root.location.pathname + root.location.search) root.history[push ? "pushState" : "replaceState"](null, "", next);
  }
  function applyViewToInputs() {
    els.q.value = st.view.q;
    els.clear.hidden = !els.q.value;
  }
  function autoTab() {
    var v = st.view, f = U.isFiltering(v);
    if (f && v.tab === "home") { v.tab = "all"; st.autoAll = true; }
    else if (!f && st.autoAll && v.tab === "all") { v.tab = "home"; st.autoAll = false; }
  }
  /** Đổi tab: xoá tìm kiếm và bộ lọc — mỗi tab là một góc nhìn riêng, bộ lọc cũ không được theo sang. */
  function goTab(tab) {
    st.view = U.emptyView(); st.view.tab = tab; st.autoAll = false; st.limit = PAGE;
    applyViewToInputs(); render(); writeUrl(true);
    root.scrollTo(0, 0);
  }
  /** Áp một phần trạng thái (từ "Xem tất cả", lọc theo tag, bảng lệnh…). */
  function go(patch) {
    Object.assign(st.view, patch);
    autoTab(); st.limit = PAGE;
    applyViewToInputs(); render(); writeUrl(true);
    root.scrollTo(0, 0);
  }
  function setQuery(value, focus) {
    st.view.q = value; autoTab(); st.limit = PAGE;
    if (focus) { els.q.value = value; els.clear.hidden = !value; els.q.focus(); }
    render(); writeUrl();
  }
  function clearFilters() {
    var tab = st.autoAll ? "home" : st.view.tab;
    st.view = U.emptyView(); st.view.tab = tab; st.autoAll = false; st.limit = PAGE;
    applyViewToInputs(); render(); writeUrl();
  }
  function patchView(patch) {
    Object.assign(st.view, patch); autoTab(); st.limit = PAGE;
    render(); writeUrl(); P.dialogs.refreshFacets();
  }
  function facetsCtx() { return { facets: st.facets, view: st.view, onChange: patchView }; }

  // ================================================================== dữ liệu
  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Máy chủ trả về " + r.status);
      var stale = r.headers.get("X-Portal-Cache") === "hit" ? Date.parse(r.headers.get("X-Portal-Date") || "") || Date.now() : 0;
      return r.json().then(function (json) { return { json: json, stale: stale }; });
    });
  }
  function load(refresh) {
    st.error = null;
    if (!refresh) { st.loaded = false; render(); }
    return Promise.all([
      fetchJson(webapp() + "/_api/list"),
      fetch("./portal.config.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      st.config = M.normalizeConfig(res[1]);
      st.apps = M.normalizeApps(res[0].json, st.config);
      M.markFresh(st.apps, Date.now(), st.config.newDays);
      st.byPath = {}; st.apps.forEach(function (a) { st.byPath[a.path] = a; });
      st.facets = M.facets(st.apps);
      st.stale = res[0].stale;
      st.loaded = true;
      $("#brandTitle").textContent = st.config.title;
      render();
      if (refresh) D.toast("Đã làm mới danh sách (" + st.apps.length + " ứng dụng)");
      focusFromUrl();
    }, function (err) {
      st.error = err; st.loaded = true;
      render();
      if (refresh) D.toast("Không làm mới được: " + err.message, { ms: 6000 });
    });
  }
  function focusFromUrl() {
    var p = new root.URLSearchParams(root.location.search);
    if (p.get("focus") === "search") { els.q.focus(); root.history.replaceState(null, "", root.location.pathname + U.toQuery(st.view, { sort: prefs().settings.sort, group: prefs().settings.group })); }
  }

  // ================================================================== thao tác trên app
  function recordOpen(path) { setPrefs(PR.recordOpen(prefs(), path, Date.now())); P.store.flush(); }
  function openApp(app, o) {
    recordOpen(app.path);
    var url = D.appUrl(app);
    if ((o && o.newTab) || prefs().settings.newTab) root.open(url, "_blank", "noopener"); else root.location.href = url;
  }
  function toggleFav(path, silent) {
    var app = st.byPath[path];
    if (!app) return;
    var r = PR.toggleFavorite(prefs(), path);
    setPrefs(r.prefs);
    if (r.on) P.store.askPersist();
    render();
    if (!silent) D.toast((r.on ? "Đã ghim “" : "Đã bỏ ghim “") + app.title + "”", { action: { label: "Hoàn tác", run: function () { toggleFav(path, true); } } });
  }
  function toggleHide(path, silent) {
    var app = st.byPath[path];
    if (!app) return;
    var r = PR.toggleHidden(prefs(), path);
    setPrefs(r.prefs);
    render();
    if (!silent) D.toast((r.on ? "Đã ẩn “" : "Đã bỏ ẩn “") + app.title + "”" + (r.on ? " — xem lại ở tab Đã ẩn" : ""), { action: { label: "Hoàn tác", run: function () { toggleHide(path, true); } } });
  }
  function cardAction(card, act) {
    var app = st.byPath[card.dataset.path];
    if (!app) return;
    if (act === "fav") toggleFav(app.path); else if (act === "hide") toggleHide(app.path); else if (act === "info") P.dialogs.info(app);
  }
  function openFavorite(i) {
    var hidden = {}; prefs().hidden.forEach(function (p) { hidden[p] = 1; });
    var favs = prefs().favorites.filter(function (p) { return st.byPath[p] && !hidden[p]; });
    if (favs[i]) openApp(st.byPath[favs[i]], {});
    else if (favs.length === 0) D.toast("Chưa có app ghim. Bấm ☆ trên một thẻ để ghim.");
  }
  function randomApp() {
    var app = M.pickRandom(st.apps, prefs());
    if (app) P.dialogs.info(app); else D.toast("Chưa có ứng dụng nào để chọn.");
  }
  function exportData() {
    var d = new Date();
    return { name: "portal-du-lieu-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + ".json", text: JSON.stringify(PR.exportData(prefs(), Date.now()), null, 2) };
  }
  function importData(text) {
    var r = PR.importData(prefs(), text, "merge");
    setPrefs(r.prefs); P.store.flush(); applyAppearance(); render();
    return r.summary;
  }

  // ================================================================== khung (tab, thanh dưới, banner…)
  function counts() {
    var hid = {}, c = { all: 0, favorites: 0, hidden: 0 };
    prefs().hidden.forEach(function (p) { hid[p] = 1; });
    st.apps.forEach(function (a) { if (hid[a.path]) c.hidden++; else c.all++; });
    c.favorites = prefs().favorites.filter(function (p) { return st.byPath[p] && !hid[p]; }).length;
    return c;
  }
  function tabHref(id) { return root.location.pathname + (id === "home" ? "" : "?tab=" + id); }

  function updateChrome() {
    var c = counts(), cur = st.view.tab;
    els.tabs.replaceChildren.apply(els.tabs, TABS.filter(function (t) { return t.id !== "hidden" || c.hidden > 0; }).map(function (t) {
      var n = c[t.id];
      return h("a", { class: "tab", href: tabHref(t.id), dataset: { tab: t.id }, "aria-current": cur === t.id ? "page" : null },
        t.label, n != null && st.loaded ? h("span", { class: "n", text: String(n) }) : null);
    }));
    var bn = function (tag, id, label, ic, extra) {
      var el = h(tag, Object.assign({ class: "bn", "aria-current": extra && extra.cur ? "page" : null, dataset: { nav: id } }, tag === "a" ? { href: tabHref(id) } : { type: "button" }));
      el.innerHTML = icon(ic) + "<span>" + T.esc(label) + "</span>";
      return el;
    };
    els.bottom.replaceChildren(bn("a", "home", "Trang chủ", "home", { cur: cur === "home" }), bn("a", "all", "Tất cả", "grid", { cur: cur === "all" }),
      bn("button", "search", "Tìm", "search"), bn("a", "favorites", "Yêu thích", "star", { cur: cur === "favorites" }), bn("button", "more", "Thêm", "menu"));
    var visibleCols = st.facets ? st.facets.collections.length : 0;
    $("#brandStats").textContent = st.loaded && !st.error ? c.all + " ứng dụng · " + visibleCols + " thư mục" : "Đang tải…";
    doc.title = (st.view.q ? "“" + st.view.q + "” — " : "") + st.config.title;
    updatePwaUi();
  }

  function updatePwaUi() {
    els.install.hidden = P.pwa.installState() !== "ready";
    var b = els.banner, parts = null;
    if (P.pwa.updateReady()) parts = { ic: "refresh", text: "Có bản mới của cổng.", btn: "Tải lại", run: function () { P.pwa.applyUpdate(); } };
    else if (!P.pwa.isOnline()) parts = { ic: "wifi-off", text: "Bạn đang ngoại tuyến" + (st.stale ? " — danh sách app lưu lúc " + new Date(st.stale).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "") + ". Chỉ app có huy hiệu Offline mở được.", btn: st.view.pwa ? null : "Chỉ app offline", run: function () { go({ tab: "all", pwa: true }); } };
    else if (st.stale) parts = { ic: "wifi-off", text: "Không kết nối được máy chủ — đang hiển thị danh sách đã lưu lúc " + new Date(st.stale).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + ".", btn: "Thử lại", run: function () { load(true); } };
    b.hidden = !parts;
    b.classList.toggle("warn", !!parts && parts.ic === "wifi-off");
    if (!parts) { b.replaceChildren(); return; }
    var btn = parts.btn ? h("button", { type: "button", class: "btn", text: parts.btn, on: { click: parts.run } }) : null;
    b.innerHTML = icon(parts.ic) + "<p>" + T.esc(parts.text) + "</p>";
    if (btn) b.append(btn);
  }

  // ================================================================== dựng nội dung
  function makeCard(app, terms) {
    var p = prefs();
    return C.create(app, { terms: terms, fav: p.favorites.indexOf(app.path) !== -1, hidden: p.hidden.indexOf(app.path) !== -1, newTab: p.settings.newTab });
  }
  function gridOf(apps, terms) {
    return h("div", { class: "apps apps-" + prefs().settings.view }, apps.map(function (a) { return makeCard(a, terms); }));
  }
  function emptyBlock(emoji, title, text, buttons) {
    return h("div", { class: "empty" }, h("div", { class: "emoji", "aria-hidden": "true", text: emoji }), h("h2", { text: title }), text ? h("p", { text: text }) : null, buttons && buttons.length ? h("div", { class: "row" }, buttons) : null);
  }
  function btn(label, run, primary) { return h("button", { type: "button", class: "btn" + (primary ? " btn-primary" : ""), text: label, on: { click: run } }); }

  function skeletonView() {
    return h("section", { class: "sec" }, h("div", { class: "apps apps-" + prefs().settings.view }, C.skeleton(8)));
  }
  function errorView() {
    return emptyBlock("⚠️", "Không tải được danh sách", st.error.message, [btn("Thử lại", function () { load(); }, true)]);
  }

  function secHead(sec, allBtn) {
    return h("div", { class: "sec-head" },
      h("h2", { class: "sec-title", id: "sec-" + sec.id }, h("span", { class: "emoji", "aria-hidden": "true", text: sec.icon || "" }), h("span", { class: "t", text: sec.title })),
      h("span", { class: "sec-count", text: String(sec.total) }), h("span", { class: "sp" }), allBtn);
  }
  function shelf(sec) {
    st.sections[sec.id] = sec;
    var all = sec.total > sec.apps.length || sec.id === "favorites" ? h("button", { type: "button", class: "btn btn-ghost", dataset: { all: sec.id }, text: "Xem tất cả (" + sec.total + ")" }) : null;
    return h("section", { class: "sec", "aria-labelledby": "sec-" + sec.id }, secHead(sec, all), gridOf(sec.apps));
  }
  function library(sec) {
    var wrap = h("section", { class: "sec", "aria-labelledby": "sec-" + sec.id }, secHead(sec, null));
    sec.groups.forEach(function (g) {
      var open = !!prefs().open[g.id], bodyId = "lib-" + g.id.replace(/[^a-z0-9]/gi, "_");
      st.libApps[g.id] = g.apps;
      var body = h("div", { class: "lib-body", id: bodyId, hidden: !open });
      if (open) body.append(gridOf(g.apps));
      var toggle = h("button", { type: "button", class: "lib-toggle", "aria-expanded": String(open), "aria-controls": bodyId, dataset: { lib: g.id } },
        h("span", { class: "t", text: g.title }), h("span", { class: "n", text: String(g.apps.length) }));
      toggle.insertAdjacentHTML("beforeend", icon("chevron"));
      wrap.append(h("div", { class: "lib-group" }, toggle, body));
    });
    return wrap;
  }
  function homeView() {
    st.sections = {}; st.libApps = {};
    var secs = M.homeSections(st.apps, prefs(), st.config, Date.now());
    if (!secs.length) return emptyBlock("📭", "Chưa có ứng dụng nào", "Thư mục webapp/ chưa có app nào có index.html.");
    var frag = doc.createDocumentFragment();
    if (!prefs().favorites.length) frag.append(h("p", { class: "faint", style: "margin-top:12px;font-size:13.5px", text: "Mẹo: bấm ☆ trên thẻ để ghim app hay dùng lên đầu trang · nhấn / để tìm · nhấn ? để xem phím tắt." }));
    secs.forEach(function (s) { frag.append(s.kind === "shelf" ? shelf(s) : library(s)); });
    return frag;
  }

  function collLabel(name) {
    var c = st.facets.collections.filter(function (x) { return x.name === name; })[0];
    return c ? c.label : name || "Khác";
  }
  function select(ctl, label, list, cur) {
    return h("select", { "aria-label": label, dataset: { ctl: ctl } }, list.map(function (o) { return h("option", { value: o[0], selected: o[0] === cur ? true : null, text: o[1] }); }));
  }

  function resultsView() {
    var v = st.view, p = prefs(), s = p.settings, parsed = S.parseQuery(v.q);
    var scope = v.tab === "favorites" ? "favorites" : v.tab === "hidden" ? "hidden" : "visible";
    var sort = v.sort || s.sort, filtering = U.isFiltering(v);
    var entries = M.sortEntries(M.filterApps(st.apps, { parsed: parsed, collections: v.collections, categories: v.categories, tags: v.tags, tagAll: v.tagAll, pwa: v.pwa, scope: scope }, p), sort, p);
    st.entries = entries;
    var by = v.tab === "all" || filtering ? (v.group || s.group) : "none";
    var groups = M.groupEntries(entries, by), hasRail = v.tab === "all" || filtering;
    var n = U.filterCount(v);

    var count = h("p", { class: "result-count" });
    count.innerHTML = "<strong>" + entries.length + "</strong> ứng dụng" + (v.q.trim() ? " khớp “" + T.esc(v.q.trim()) + "”" : "") + (scope === "hidden" ? " đã ẩn" : "");
    var controls = h("div", { class: "tb-controls" });
    if (hasRail) {
      var fb = h("button", { type: "button", class: "btn only-small", dataset: { act: "open-filters" }, "aria-label": "Lọc" + (n ? ", " + n + " đang bật" : "") });
      fb.innerHTML = icon("filter") + "Lọc" + (n ? ' <span class="count-badge">' + n + "</span>" : "");
      controls.append(fb);
    }
    controls.append(select("sort", "Sắp xếp", SORTS, sort));
    if (by !== "none" || v.tab === "all") { var gs = select("group", "Nhóm theo", GROUPS, v.group || s.group); gs.classList.add("hide-sm"); controls.append(gs); }   // điện thoại: đổi ở menu Cài đặt
    var segv = h("div", { class: "seg", role: "group", "aria-label": "Kiểu hiển thị" });
    segv.innerHTML = '<button type="button" data-view="grid" aria-pressed="' + (s.view === "grid") + '" aria-label="Dạng lưới" title="Dạng lưới">' + icon("grid") + '</button><button type="button" data-view="list" aria-pressed="' + (s.view === "list") + '" aria-label="Dạng danh sách" title="Dạng danh sách">' + icon("rows") + "</button>";
    controls.append(segv);

    var chips = [];
    v.collections.forEach(function (c) { chips.push(["collections", c, collLabel(c)]); });
    v.categories.forEach(function (c) { chips.push(["categories", c, c]); });
    v.tags.forEach(function (t) { chips.push(["tags", t, "#" + t]); });
    if (v.pwa) chips.push(["pwa", "1", "Offline"]);
    var chipRow = chips.length ? h("div", { class: "chips-row" }, chips.map(function (c) {
      var b = h("button", { type: "button", class: "chip on", dataset: { rm: c[0], val: c[1] }, "aria-label": "Bỏ lọc " + c[2] }, h("span", { text: c[2] }));
      b.insertAdjacentHTML("beforeend", icon("x"));
      return b;
    }).concat(h("button", { type: "button", class: "btn btn-ghost", dataset: { act: "clear-filters" }, text: "Xoá lọc" }))) : null;

    var quick = null;
    if (hasRail && st.facets.collections.length > 1) {
      quick = h("div", { class: "qchips only-small", role: "group", "aria-label": "Lọc nhanh theo thư mục" }, st.facets.collections.slice(0, 8).map(function (c) {
        return h("button", { type: "button", class: "chip", dataset: { q: "collections", val: c.name }, "aria-pressed": String(v.collections.indexOf(c.name) !== -1) }, h("span", { text: c.label }));
      }).concat(st.facets.pwa ? [h("button", { type: "button", class: "chip", dataset: { q: "pwa" }, "aria-pressed": String(v.pwa) }, h("span", { text: "Offline" }))] : []));
    }

    var body = h("div", { class: "res-body" });
    var terms = parsed.terms, shown = 0;
    if (!entries.length) {
      var btns = [];
      if (filtering) btns.push(btn("Xoá bộ lọc", clearFilters, true));
      if (v.q.trim()) btns.push(btn("Tìm trong khoá học và bài học", function () { P.palette.open(v.q.trim()); }));
      body.append(v.tab === "favorites" && !filtering ? emptyBlock("⭐", "Chưa ghim ứng dụng nào", "Bấm ☆ trên một thẻ (hoặc nhấn f khi đang chọn thẻ) để ghim app hay dùng.", [btn("Xem tất cả app", function () { goTab("all"); }, true)])
        : v.tab === "hidden" && !filtering ? emptyBlock("🙈", "Chưa ẩn app nào", "App bạn ẩn sẽ nằm ở đây để bỏ ẩn khi cần.", [btn("Về Trang chủ", function () { goTab("home"); })])
        : emptyBlock("🔍", "Không tìm thấy ứng dụng nào", filtering ? "Thử bớt từ khoá hoặc bỏ một vài bộ lọc." : "", btns));
    } else {
      groups.forEach(function (g) {
        if (shown >= st.limit) return;
        var slice = g.entries.slice(0, st.limit - shown);
        shown += slice.length;
        var block = h("section", { class: "sec", "aria-label": g.label || null });
        if (g.label) block.append(h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, h("span", { class: "t", text: g.label })), h("span", { class: "sec-count", text: String(g.entries.length) })));
        block.append(gridOf(slice.map(function (e) { return e.app; }), terms));
        body.append(block);
      });
      if (shown < entries.length) body.append(h("div", { class: "more-wrap" }, h("button", { type: "button", class: "btn", dataset: { act: "more" }, text: "Hiện thêm (còn " + (entries.length - shown) + ")" })));
    }

    // `.results` có min-width: 0 để chữ dài không đẩy lưới ra khỏi cột
    var main = h("div", { class: "results" }, h("div", { class: "toolbar" }, count, controls), quick, chipRow, body);
    var layout = h("div", { class: "all-layout" + (hasRail ? " has-rail" : "") });
    if (hasRail) {
      F.render(st.rail, facetsCtx());
      layout.append(st.rail);
    }
    layout.append(main);
    $("#live").textContent = entries.length + " ứng dụng" + (v.q.trim() ? " khớp " + v.q.trim() : "");
    return layout;
  }

  // ================================================================== vẽ lại
  function captureFocus() {
    var a = doc.activeElement;
    if (!a || !els.content.contains(a) || st.rail.contains(a)) return null;
    var card = a.closest(".card");
    if (!card) return null;
    return { path: card.dataset.path, cls: a.classList.contains("js-fav") ? ".js-fav" : a.classList.contains("js-more") ? ".js-more" : ".card-link" };
  }
  function restoreFocus(k) {
    if (!k) return;
    var card = $$(".card", els.content).filter(function (c) { return c.dataset.path === k.path; })[0], el = card && $(k.cls, card);
    if (el) el.focus({ preventScroll: true });
  }

  function render() {
    // Ghi lại focus/cuộn của thanh lọc TRƯỚC khi dựng: lúc resultsView() chuyển st.rail sang cây mới thì focus đã mất.
    var keep = captureFocus(), railSnap = F.snapshot(st.rail), v = st.view, node;
    updateChrome();
    if (st.error) node = errorView();
    else if (!st.loaded) node = skeletonView();
    else if (v.tab === "home" && !U.isFiltering(v)) node = homeView();
    else node = resultsView();
    els.content.replaceChildren(node);
    F.restore(st.rail, railSnap);
    restoreFocus(keep);
    P.dialogs.refreshFacets();
  }

  // ================================================================== sự kiện
  function bindContent() {
    els.content.addEventListener("click", function (e) {
      var t = e.target, card = t.closest(".card"), path = card && card.dataset.path, b;
      if ((b = t.closest(".js-fav")) && card) return toggleFav(path);
      if ((b = t.closest(".js-more")) && card) return P.dialogs.info(st.byPath[path]);
      if (t.closest(".card-link") && card) { recordOpen(path); return; }
      if ((b = t.closest("[data-all]"))) {
        var sec = st.sections[b.dataset.all];
        if (!sec) return;
        if (sec.id === "favorites") return goTab("favorites");
        if (sec.sort) return go({ tab: "all", sort: sec.sort });
        return go({ tab: "all", collections: sec.collections || [] });
      }
      if ((b = t.closest("[data-lib]"))) {
        var id = b.dataset.lib, open = b.getAttribute("aria-expanded") !== "true", body = doc.getElementById(b.getAttribute("aria-controls"));
        b.setAttribute("aria-expanded", String(open));
        body.hidden = !open;
        setPrefs(PR.setOpen(prefs(), id, open));
        if (open && !body.firstChild) body.append(gridOf(st.libApps[id] || []));
        return;
      }
      if ((b = t.closest("[data-rm]"))) {
        var k = b.dataset.rm, patch = {};
        patch[k] = k === "pwa" ? false : st.view[k].filter(function (x) { return x !== b.dataset.val; });
        return patchView(patch);
      }
      if ((b = t.closest("[data-q]"))) {
        if (b.dataset.q === "pwa") return patchView({ pwa: !st.view.pwa });
        var cur = st.view.collections, val = b.dataset.val;
        return patchView({ collections: cur.indexOf(val) !== -1 ? cur.filter(function (x) { return x !== val; }) : cur.concat(val) });
      }
      if ((b = t.closest("[data-view]"))) return setSetting("view", b.dataset.view);
      if ((b = t.closest("[data-act]"))) {
        if (b.dataset.act === "open-filters") P.dialogs.facets();
        else if (b.dataset.act === "clear-filters") clearFilters();
        else if (b.dataset.act === "more") { st.limit += PAGE; render(); }
      }
    });
    els.content.addEventListener("change", function (e) {
      var c = e.target.dataset && e.target.dataset.ctl;
      if (c === "sort") setSetting("sort", e.target.value);
      else if (c === "group") setSetting("group", e.target.value);
    });
    // Cảm ứng: nhấn giữ một thẻ = xem chi tiết (menu chuột phải của trình duyệt trên máy tính được giữ nguyên).
    els.content.addEventListener("contextmenu", function (e) {
      var card = e.target.closest(".card");
      if (card && root.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); cardAction(card, "info"); }
    });
  }

  function bind() {
    els.q.addEventListener("input", D.debounce(function () { setQuery(els.q.value); }, 90));
    els.q.addEventListener("input", function () { els.clear.hidden = !els.q.value; });
    els.clear.addEventListener("click", function () { setQuery("", true); });
    $("#searchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!U.isFiltering(st.view)) return;
      var first = st.entries[0];
      if (first) openApp(first.app, {});
      else D.toast("Không có app nào khớp.");
    });
    els.q.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.shiftKey && st.entries[0] && U.isFiltering(st.view)) { e.preventDefault(); openApp(st.entries[0].app, { newTab: true }); }
    });
    els.tabs.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-tab]");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); goTab(a.dataset.tab);
    });
    els.bottom.addEventListener("click", function (e) {
      var b = e.target.closest("[data-nav]");
      if (!b) return;
      var id = b.dataset.nav;
      if (id === "search") { e.preventDefault(); P.palette.open(); }
      else if (id === "more") P.dialogs.menu();
      else if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); goTab(id); }
    });
    els.theme.addEventListener("click", cycleTheme);
    els.menu.addEventListener("click", function () { P.dialogs.menu(); });
    els.install.addEventListener("click", function () { P.pwa.promptInstall(); });
    root.addEventListener("popstate", function () { readUrl(); applyViewToInputs(); render(); });
    root.addEventListener("online", function () { updatePwaUi(); load(true); });
    root.addEventListener("offline", updatePwaUi);
    if (root.matchMedia) root.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyAppearance);
    P.store.onExternal(function () { applyAppearance(); render(); });
    P.pwa.onChange(updatePwaUi);
    if (root.ResizeObserver) new root.ResizeObserver(function () { doc.documentElement.style.setProperty("--topbar-h", $("#topbar").offsetHeight + "px"); }).observe($("#topbar"));
    bindContent();
  }

  // ================================================================== API cho hộp thoại / bảng lệnh / phím tắt
  var api = {
    prefs: prefs, apps: function () { return st.apps; }, view: function () { return st.view; }, resultCount: function () { return st.entries.length; },
    toggleFav: toggleFav, toggleHide: toggleHide, openApp: openApp, recordOpen: recordOpen, filterTag: function (tag) { go({ tab: st.view.tab === "home" ? "all" : st.view.tab, tags: T.uniq(st.view.tags.concat(tag)) }); },
    setSetting: setSetting, exportData: exportData, importData: importData, clearHistory: function () { setPrefs(PR.clearUsage(prefs())); render(); },
    refresh: function () { return load(true); }, randomApp: randomApp, cycleTheme: cycleTheme, toggleView: toggleView, portalUrl: portalUrl,
    installState: function () { return P.pwa.installState(); }, promptInstall: function () { return P.pwa.promptInstall(); }, offlineStatus: function () { return P.pwa.offlineStatus(); },
    persistent: function () { return P.store.isPersistent(); },
    facetsCtx: facetsCtx, clearFilters: clearFilters, go: go, goTab: goTab, setQuery: setQuery, openFavorite: openFavorite, cardAction: cardAction,
    focusSearch: function () { els.q.focus(); els.q.select(); }
  };

  function boot() {
    els = { q: $("#q"), clear: $("#clearQ"), tabs: $("#tabs"), bottom: $("#bottomNav"), content: $("#content"), banner: $("#banner"), theme: $("#btnTheme"), menu: $("#btnMenu"), install: $("#btnInstall") };
    doc.body.append(h("div", { id: "live", class: "sr-only", role: "status", "aria-live": "polite" }));
    P.store.load();
    applyAppearance();
    readUrl();
    applyViewToInputs();
    bind();
    P.dialogs.init(api); P.palette.init(api); P.keys.init(api); P.pwa.init();
    render();
    load();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
