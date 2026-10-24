/* ui/app.js — khởi động, định tuyến theo địa chỉ (#/…), khung (thanh bên / thanh dưới), phím tắt, nhắc bản nháp và sao lưu.

   Địa chỉ:  #/ (trang chủ) · #/lib?q=&cat=&bm=1&st=&src=&sort= (thư viện) · #/a/<id> (chi tiết) · #/mine · #/mine/new · #/mine/edit/<id> · #/templates[/<id>|new]
             #/decide?p=0,1 (wizard) · #/tree · #/compare?ids=a,b · #/cheat?cat= · #/practice · #/practice/cards · #/practice/quiz · #/viz[/<id>] · #/learn[/<roadmap>] · #/settings
   Điện thoại: mỗi lúc một màn (danh sách HOẶC chi tiết). Máy tính ≥ 900px: danh sách cạnh chi tiết. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, $ = U.$, doc = root.document, C = A.catalog;
  var NAV = [
    { id: "home", label: "Trang chủ", icon: "home", hash: "#/" }, { id: "lib", label: "Thư viện", icon: "lib", hash: "#/lib" }, { id: "decide", label: "Chọn thuật toán", icon: "decide", hash: "#/decide" },
    { id: "compare", label: "So sánh", icon: "compare", hash: "#/compare" }, { id: "cheat", label: "Cheat Sheet", icon: "cheat", hash: "#/cheat" }, { id: "templates", label: "Template", icon: "template", hash: "#/templates" },
    { id: "practice", label: "Luyện tập", icon: "practice", hash: "#/practice" }, { id: "learn", label: "Lộ trình & tiến độ", icon: "learn", hash: "#/learn" }, { id: "mine", label: "Của tôi", icon: "mine", hash: "#/mine" },
    { id: "settings", label: "Cài đặt", icon: "settings", hash: "#/settings" }
  ];
  var TITLES = { home: "Trang chủ", lib: "Thư viện", search: "Thư viện", a: "Thuật toán", decide: "Chọn thuật toán", tree: "Cây quyết định", compare: "So sánh", cheat: "Cheat Sheet", templates: "Template", practice: "Luyện tập", viz: "Trực quan hoá", learn: "Lộ trình & tiến độ", mine: "Của tôi", settings: "Cài đặt" };
  var user, ctx, listPane, current = null, listState = {}, chan = null, mainEl, bannerEl;

  // ------------------------------------------------------------------------------------------------- định tuyến
  function parse() {
    var raw = root.location.hash.replace(/^#\/?/, ""), qi = raw.indexOf("?"), path = qi < 0 ? raw : raw.slice(0, qi), qs = qi < 0 ? "" : raw.slice(qi + 1), q = {};
    new root.URLSearchParams(qs).forEach(function (v, k) { q[k] = v; });
    var seg = path.split("/").filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { name: seg[0] || "home", arg: seg[1] || "", arg2: seg[2] || "", q: q };
  }
  function qstr(q) { var p = new root.URLSearchParams(); Object.keys(q || {}).forEach(function (k) { if (q[k] !== "" && q[k] != null && q[k] !== false) p.set(k, q[k]); }); var s = p.toString(); return s ? "?" + s : ""; }
  function go(hash, replace) { if (replace) { root.history.replaceState(null, "", hash); handle(); } else if (root.location.hash === hash) handle(); else root.location.hash = hash; }
  function route(query, replace, name) { go("#/" + (name || parse().name) + qstr(query), replace); }
  function listStateOf(q, name) { return { q: q.q || "", cat: q.cat || "", bm: q.bm === "1", st: /^[0-3]$/.test(q.st || "") ? q.st : "", src: name === "mine" ? "user" : /^(user|builtin)$/.test(q.src || "") ? q.src : "", sort: /^(name|level)$/.test(q.sort || "") ? q.sort : "group" }; }
  /** Bộ lọc/ô tìm của danh sách: ở màn danh sách thì ghi vào địa chỉ; đang xem chi tiết (máy tính) thì chỉ đổi danh sách, không rời trang. */
  function listRoute(query, replace) {
    var cur = parse();
    if (/^(lib|mine)$/.test(cur.name)) go("#/" + cur.name + qstr(query), replace);
    else { listState = listStateOf(query, "lib"); listPane.setState(listState); }
  }
  function viewKey(r) { return /^(lib|mine)$/.test(r.name) && !r.arg ? "list:" + r.name : r.name + "/" + r.arg + "/" + r.arg2 + (r.name === "decide" || r.name === "compare" || r.name === "cheat" ? "?" + qstr(r.q) : ""); }
  function emptyMain() {
    return h("div", { class: "main-empty" }, h("p", { class: "big", text: "Chọn một thuật toán ở danh sách" }), h("p", { text: "hoặc để ứng dụng gợi ý." }),
      h("div", { class: "btn-row" }, h("a", { class: "btn btn-primary", href: "#/decide", html: icon("decide") + "<span>Nên dùng thuật toán nào?</span>" }), h("a", { class: "btn", href: "#/cheat", html: icon("cheat") + "<span>Cheat Sheet</span>" })));
  }

  function handle() {
    var r = parse(), key = viewKey(r);
    var isList = /^(lib|mine)$/.test(r.name) && !(r.name === "mine" && r.arg), layout = isList ? "list" : r.name === "a" ? "both" : "main";
    doc.body.dataset.route = r.name === "search" ? "lib" : r.name; doc.body.dataset.pane = layout;
    if (isList) { listState = listStateOf(r.q, r.name); listPane.setState(listState); }
    else if (layout === "both") { listPane.setState(listState.q || listState.cat || listState.bm || listState.st || listState.src ? listState : listStateOf({}, "lib")); listPane.setCurrent(r.arg); }
    if (layout !== "both") listPane.setCurrent("");
    updateChrome(r);
    if (current && current.key === key) { if (isList) mainEl.dataset.empty = "1"; return; }
    var prev = current; current = null;
    Promise.resolve(prev && prev.view && prev.view.destroy && prev.view.destroy()).then(function () {
      mainEl.replaceChildren(); delete mainEl.dataset.empty;
      var view = null;
      try {
        if (isList) { mainEl.append(emptyMain()); mainEl.dataset.empty = "1"; }
        else if (r.name === "home") view = U.views.home(ctx, mainEl);
        else if (r.name === "a") { view = U.detail.open(ctx, mainEl, r.arg); setTimeout(function () { listPane.scrollTo(r.arg); }, 60); }
        else if (r.name === "mine") view = U.library.itemForm(ctx, mainEl, r.arg === "edit" ? r.arg2 : "new", r.q);
        else if (r.name === "templates") view = U.library.templates(ctx, mainEl, r.arg);
        else if (r.name === "cheat") view = U.views.cheat(ctx, mainEl, r.q);
        else if (r.name === "compare") view = U.views.compare(ctx, mainEl, r.q);
        else if (r.name === "decide") view = U.decideview.wizard(ctx, mainEl, r.q);
        else if (r.name === "tree") view = U.decideview.tree(ctx, mainEl);
        else if (r.name === "practice") view = r.arg === "cards" ? U.practice.cards(ctx, mainEl, r.q) : r.arg === "quiz" ? U.practice.quiz(ctx, mainEl, r.q) : U.practice.hub(ctx, mainEl);
        else if (r.name === "viz") view = r.arg ? U.vizview.player(ctx, mainEl, r.arg, r.q) : U.vizview.list(ctx, mainEl);
        else if (r.name === "learn") view = U.views.learn(ctx, mainEl, r.arg);
        else if (r.name === "settings") view = U.settings.open(ctx, mainEl);
        else mainEl.append(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có trang này" }), h("a", { class: "btn btn-primary", href: "#/", text: "Về trang chủ" })));
      } catch (e) { mainEl.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Có lỗi khi mở màn này" }), h("p", { class: "faint", text: String(e && e.message || e) }))); if (root.console) root.console.error(e); }
      current = { key: key, view: view };
      if (r.name !== "a") { mainEl.scrollTop = 0; root.scrollTo(0, 0); }
    });
  }
  function newItem(init) { go("#/mine/new" + qstr({ name: (init && init.name) || "" })); }

  // ------------------------------------------------------------------------------------------------- khung
  function activeNav(r) { return r.name === "a" || r.name === "search" ? "lib" : r.name === "tree" ? "decide" : r.name === "viz" ? "practice" : r.name; }
  function updateChrome(r) {
    r = r || parse(); var act = activeNav(r);
    U.$$("[data-nav]").forEach(function (a) { if (a.dataset.nav === act) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var ent = r.name === "a" ? C.get(r.arg) : null, title = ent ? ent.name : TITLES[r.name] || "Algorithm Notebook";
    $("#topTitle").textContent = title; doc.title = title + " · Algorithm Notebook";
    $("#topBack").hidden = !(r.name === "a" || r.arg); $("#topBack").setAttribute("href", r.name === "a" ? "#/lib" : r.name === "practice" ? "#/practice" : r.name === "viz" ? "#/viz" : r.name === "learn" ? "#/learn" : r.name === "templates" ? "#/templates" : r.name === "mine" ? "#/lib?src=user" : "#/");
  }
  function buildNav() {
    var side = $("#sideNav"), bottom = $("#bottomNav");
    side.replaceChildren.apply(side, NAV.map(function (n) {
      var a = h("a", { class: "nav", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.label) + "</span>" + (n.id === "practice" ? '<b class="nbadge" id="badgeS" hidden></b>' : "") + (n.id === "lib" ? '<small class="ncount" id="countS"></small>' : ""); return a;
    }));
    var main = ["home", "lib", "decide", "practice"].map(function (id) { return NAV.filter(function (n) { return n.id === id; })[0]; });
    bottom.replaceChildren.apply(bottom, main.map(function (n) {
      var a = h("a", { class: "bn", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.id === "decide" ? "Chọn" : n.label) + "</span>" + (n.id === "practice" ? '<b class="nbadge" id="badgeB" hidden></b>' : ""); return a;
    }).concat([(function () {
      var b = h("button", { type: "button", class: "bn", id: "moreBtn", "aria-haspopup": "menu", "aria-label": "Thêm" }); b.innerHTML = icon("menu") + "<span>Thêm</span>";
      b.addEventListener("click", function () { U.menu(b, ["compare", "cheat", "templates", "learn", "mine", "settings"].map(function (id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return { label: n.label, icon: n.icon, run: function () { go(n.hash); } }; })); });
      return b;
    })()]));
  }
  function refreshShell() {
    var c = $("#countS"); if (c) c.textContent = C.all().length.toLocaleString("vi-VN");
    var due = A.practice.dueCount(user);
    ["badgeS", "badgeB"].forEach(function (id) { var b = $("#" + id); if (b) { b.hidden = !due; b.textContent = due > 99 ? "99+" : due; b.setAttribute("aria-label", due + " thẻ đến hạn"); } });
    var pins = C.all().filter(function (e) { return user.isBookmarked(e.id); }).slice(0, 6), box = $("#sidePins");
    box.replaceChildren.apply(box, pins.length ? [h("h3", { text: "Đã đánh dấu" })].concat(pins.map(function (p) { var a = h("a", { class: "pin", href: "#/a/" + p.id, title: p.name }); a.innerHTML = icon("bookmark", "ic-fill") + "<span>" + T.esc(p.name) + "</span>"; return a; })) : []);
    if (user.store.volatile) showBanner("volatile");
  }
  var refreshSoon = U.debounce(refreshShell, 120);

  function showBanner(kind) {
    var html = "";
    if (kind === "update") html = '<span>Có bản mới của ứng dụng.</span><button type="button" class="btn" data-bn="update">Tải lại</button>';
    else if (kind === "volatile") html = "<span><b>Không lưu được lâu dài:</b> trình duyệt đang chặn IndexedDB (chế độ riêng tư?). Ghi chú, template, tiến độ sẽ mất khi đóng thẻ — hãy mở ở cửa sổ thường.</span>";
    else if (kind === "offline") html = "<span>Bạn đang ngoại tuyến — mọi thứ vẫn hoạt động, dữ liệu lưu trên máy.</span>";
    bannerEl.innerHTML = html; bannerEl.hidden = !html;
  }
  function chooseBanner() { if (U.pwa.updateReady()) showBanner("update"); else if (user.store.volatile) showBanner("volatile"); else if (!U.pwa.isOnline()) showBanner("offline"); else bannerEl.hidden = true; }

  // ------------------------------------------------------------------------------------------------- phím tắt
  var gAt = 0;
  function keys(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return; }
    if (U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || doc.querySelector("dialog[open]")) return;
    if (gAt && Date.now() - gAt < 1200) {
      gAt = 0;
      var to = { h: "#/", l: "#/lib", d: "#/decide", c: "#/cheat", p: "#/practice", t: "#/templates", s: "#/settings", m: "#/mine", r: "#/learn", v: "#/viz" }[e.key];
      if (to) { e.preventDefault(); go(to); return; }
    }
    if (e.key === "g") gAt = Date.now(); else if (e.key === "/") { e.preventDefault(); focusSearch(); } else if (e.key === "n") { e.preventDefault(); newItem({}); } else if (e.key === "?") { e.preventDefault(); help(); }
  }
  function focusSearch() { var r = parse(); if (!/^(lib|mine|a)$/.test(r.name) || (r.name === "mine" && r.arg)) go("#/lib"); setTimeout(function () { listPane.focusSearch(); }, 40); }
  function help() {
    var rows = [["/ hoặc Ctrl K", "Tìm thuật toán"], ["n", "Thêm mục vào thư viện của tôi"], ["g rồi h / l / d / c / p / t / m / r / v / s", "Trang chủ / Thư viện / Chọn thuật toán / Cheat Sheet / Luyện tập / Template / Của tôi / Lộ trình / Trực quan / Cài đặt"], ["Ctrl S", "Lưu ghi chú / template đang soạn"], ["Space, 1–4", "Flashcard: hiện đáp án, chấm Lại/Khó/Được/Dễ"], ["1–4, Enter", "Quiz: chọn đáp án, câu tiếp"], ["← → , Space", "Trực quan hoá: bước lui / tới, chạy"], ["?", "Bảng này"]];
    var dl = h("dl", { class: "kbd-list" }); rows.forEach(function (r) { dl.append(h("dt", { text: r[0] }), h("dd", { text: r[1] })); });
    U.dialog("Phím tắt", [dl, h("p", { class: "faint", text: "Phím chữ chỉ có tác dụng khi bạn không đang gõ trong ô nhập." })]);
  }

  // ------------------------------------------------------------------------------------------------- khởi động
  function boot() {
    U.loadPrefs(); U.applyPrefs();
    if (root.matchMedia) root.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", U.applyPrefs);
    mainEl = $("#main"); bannerEl = $("#banner");
    if (U.rich) U.rich.observe(mainEl);                                  // công thức/sơ đồ (W6) ở mọi màn: chi tiết, ôn tập, ghi chú xem trước
    U.pwa.init();
    A.store.openBest("algorithm-notebook").then(function (store) { user = A.user.create(store); return user.open(); }).then(function () {
      U.list.attach(user);
      ctx = { user: user, go: go, route: route, listRoute: listRoute, toast: U.toast, confirm: U.confirmBox, newItem: newItem, open: function (id) { go("#/a/" + id); } };
      listPane = U.list.create(Object.assign({}, ctx, { route: listRoute }));
      $("#listPane").append(listPane.el);
      buildNav();
      $("#newBtn").addEventListener("click", focusSearch); $("#fab").addEventListener("click", function () { newItem({}); }); $("#topNew").addEventListener("click", function () { newItem({}); }); $("#topSearch").addEventListener("click", focusSearch);
      bannerEl.addEventListener("click", function (e) { if (e.target.closest('[data-bn="update"]')) U.pwa.applyUpdate(); });
      doc.addEventListener("keydown", keys); root.addEventListener("hashchange", handle);
      U.pwa.onChange(chooseBanner); root.addEventListener("online", chooseBanner); root.addEventListener("offline", chooseBanner);
      user.on(function (ev) { refreshSoon(); if (chan && /^(item|note|template|mark|card|quiz|restore|wipe)$/.test(ev.type)) chan.postMessage({ t: ev.type }); });
      if (root.BroadcastChannel) {
        chan = new root.BroadcastChannel("algorithm-notebook");
        chan.onmessage = U.debounce(function () { user.open().then(function () { U.list.rebuild(); refreshShell(); if (listPane) listPane.refresh(); }); }, 250);
      }
      refreshShell(); chooseBanner();
      if (!root.location.hash) root.history.replaceState(null, "", "#/");
      handle(); afterStart();
      doc.body.classList.add("ready");
    }).catch(function (e) {
      doc.body.classList.add("ready");
      mainEl.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không khởi động được" }), h("p", { class: "faint", text: String(e && e.message || e) })));
      if (root.console) root.console.error(e);
    });
  }

  function afterStart() {
    user.listDrafts().then(function (ds) {
      var pending = ds.filter(function (d) {
        if (!d || d.value == null) return false;
        var k = d.id.split(":"), kind = k[0], id = k.slice(1).join(":");
        if (kind === "note") { var n = user.note(id); return d.value !== (n ? n.text : "") && !!String(d.value).trim() && !!C.get(id); }
        if (kind === "tpl") { var t = id === "new" ? null : user.template(id); return !t ? !!(d.value.src && d.value.src.trim()) : d.value.src !== t.src || d.value.title !== t.title; }
        if (kind === "item") return !!(d.value && d.value.name);
        return false;
      }).sort(function (a, b) { return b.at - a.at; });
      if (!pending.length) return;
      var first = pending[0], k = first.id.split(":"), id = k.slice(1).join(":");
      var hash = k[0] === "note" ? "#/a/" + id : k[0] === "tpl" ? "#/templates/" + id : id === "new" ? "#/mine/new" : "#/mine/edit/" + id, cur = parse();
      if (root.location.hash === hash) return;
      U.toast("Có " + pending.length + " bản nháp chưa lưu", { ms: 12000, action: { label: "Mở", run: function () { go(hash); } } });
    });
    var p = U.prefs(), days = (user.now() - p.lastBackup) / 86400000, mine = user.items().length + user.notes().length + user.templates().length;
    if (mine >= 5 && (p.lastBackup ? days > p.backupEvery : mine >= 20)) setTimeout(function () { U.toast(p.lastBackup ? "Đã " + Math.floor(days) + " ngày chưa sao lưu" : "Bạn chưa sao lưu lần nào", { ms: 14000, action: { label: "Sao lưu", run: function () { go("#/settings"); } } }); }, 4000);
  }

  U.app = { boot: boot, go: go };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
