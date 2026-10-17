/* ui/app.js — khởi động, định tuyến theo địa chỉ (#/…), khung giao diện (thanh bên / thanh dưới), phím tắt toàn cục, đồng bộ giữa các thẻ trình duyệt.

   Địa chỉ:  #/ (trang chủ) · #/notes?status=&tag=&sort=&fav= · #/search?q= · #/n/<id> · #/new?title= · #/daily[/<ngày>] · #/graph?c=&d= · #/review · #/books · #/book/<id> · #/tags · #/settings
   Điện thoại: mỗi lúc một màn (danh sách HOẶC ghi chú). Máy tính ≥ 900px: danh sách cạnh ghi chú. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, N = W.notes, U = W.ui, h = U.h, icon = U.icon, $ = U.$, doc = root.document;
  var NAV = [
    { id: "home", label: "Trang chủ", icon: "home", hash: "#/" }, { id: "notes", label: "Ghi chú", icon: "notes", hash: "#/notes" }, { id: "graph", label: "Đồ thị", icon: "graph", hash: "#/graph" },
    { id: "review", label: "Ôn tập", icon: "card", hash: "#/review" }, { id: "books", label: "Sách", icon: "book", hash: "#/books" }, { id: "tags", label: "Tag", icon: "tag", hash: "#/tags" }, { id: "settings", label: "Cài đặt", icon: "settings", hash: "#/settings" }
  ];
  var TITLES = { home: "Trang chủ", notes: "Ghi chú", search: "Tìm kiếm", graph: "Đồ thị", review: "Ôn tập", books: "Sách", book: "Sách", tags: "Tag", settings: "Cài đặt", n: "Ghi chú", daily: "Hôm nay" };
  var repo, ctx, listPane, current = null, listState = {}, dueCount = 0, chan = null, mainEl, bannerEl;

  // ------------------------------------------------------------------------------------------------- định tuyến
  function parse() {
    var raw = root.location.hash.replace(/^#\/?/, ""), qi = raw.indexOf("?"), path = qi < 0 ? raw : raw.slice(0, qi), qs = qi < 0 ? "" : raw.slice(qi + 1), q = {};
    new root.URLSearchParams(qs).forEach(function (v, k) { q[k] = v; });
    var seg = path.split("/").filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { name: seg[0] || "home", arg: seg[1] || "", q: q };
  }
  function qstr(q) { var p = new root.URLSearchParams(); Object.keys(q || {}).forEach(function (k) { if (q[k] !== "" && q[k] != null && q[k] !== false) p.set(k, q[k]); }); var s = p.toString(); return s ? "?" + s : ""; }
  function go(hash, replace) {
    if (replace) { root.history.replaceState(null, "", hash); handle(); } else if (root.location.hash === hash) handle(); else root.location.hash = hash;
  }
  function listStateOf(q) { return { q: q.q || "", status: /^(archived|trashed)$/.test(q.status) ? q.status : "active", tag: q.tag || "", sort: /^(created|title)$/.test(q.sort) ? q.sort : "updated", fav: q.fav === "1" }; }

  function route(query, replace, name) {
    var cur = parse(), nm = name || (cur.name === "search" ? "search" : cur.name);
    if (!name && !/^(notes|search)$/.test(cur.name)) nm = "notes";
    go("#/" + nm + qstr(query), replace);
  }
  /** Bộ lọc/ô tìm của danh sách: ở màn danh sách thì ghi vào địa chỉ; đang xem một ghi chú (máy tính) thì chỉ đổi danh sách, không rời ghi chú. */
  function listRoute(query, replace) {
    var cur = parse();
    if (/^(notes|search)$/.test(cur.name)) go("#/" + (query.q ? "search" : "notes") + qstr(query), true === replace ? true : replace);
    else { listState = listStateOf(query); listPane.setState(listState); }
  }

  function viewKey(r) { return r.name === "n" ? "n/" + r.arg : /^(notes|search)$/.test(r.name) ? "list" : r.name + "/" + r.arg; }
  function emptyMain() {
    return h("div", { class: "main-empty" }, h("p", { class: "big", text: "Chọn một ghi chú ở danh sách" }), h("p", { text: "hoặc bắt đầu viết ngay." }),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", html: icon("plus") + "<span>Ghi chú mới</span>", on: { click: function () { newNote({}); } } }), h("a", { class: "btn", href: "#/daily", html: icon("calendar") + "<span>Ghi chú hôm nay</span>" })));
  }

  function handle() {
    var r = parse(), key = viewKey(r);
    if (r.name === "new") { var id = T.uid(); return go("#/n/" + id + qstr(Object.assign({ new: "1" }, r.q)), true); }
    if (r.name === "daily") { var dk = T.isDateKey(r.arg) ? r.arg : T.dateKey(repo.now()); return go("#/n/" + N.dailyId(dk) + "?daily=" + dk, true); }
    var layout = /^(notes|search)$/.test(r.name) ? "list" : r.name === "n" ? "both" : "main";
    doc.body.dataset.route = r.name === "search" ? "notes" : r.name; doc.body.dataset.pane = layout;
    if (layout === "list") { listState = listStateOf(Object.assign({}, r.q, r.name === "search" ? {} : { q: "" })); listPane.setState(listState); }
    else if (layout === "both") { listPane.setState(listState); listPane.setCurrent(r.arg); }
    if (layout !== "both") listPane.setCurrent("");
    updateChrome(r);
    if (current && current.key === key) { if (layout === "list") mainEl.dataset.empty = "1"; return; }
    var prev = current; current = null;
    Promise.resolve(prev && prev.view && prev.view.destroy && prev.view.destroy()).then(function () {
      mainEl.replaceChildren(); delete mainEl.dataset.empty;
      var view = null;
      try {
        if (layout === "list") { mainEl.append(emptyMain()); mainEl.dataset.empty = "1"; }
        else if (r.name === "home") view = U.views.home(ctx, mainEl);
        else if (r.name === "n") { view = U.editor.open(ctx, mainEl, r.arg, r.q); setTimeout(function () { listPane.scrollTo(r.arg); }, 60); }
        else if (r.name === "graph") view = U.graphview.open(ctx, mainEl, r.q);
        else if (r.name === "review") view = U.views.review(ctx, mainEl);
        else if (r.name === "books") view = U.views.books(ctx, mainEl);
        else if (r.name === "book") view = U.views.book(ctx, mainEl, r.arg);
        else if (r.name === "tags") view = U.views.tags(ctx, mainEl);
        else if (r.name === "settings") view = U.settings.open(ctx, mainEl);
        else { mainEl.append(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có trang này" }), h("a", { class: "btn btn-primary", href: "#/", text: "Về trang chủ" }))); }
      } catch (e) { mainEl.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Có lỗi khi mở màn này" }), h("p", { class: "faint", text: String(e && e.message || e) }))); if (root.console) root.console.error(e); }
      current = { key: key, view: view };
      if (r.name !== "n") { mainEl.scrollTop = 0; root.scrollTo(0, 0); }
    });
  }

  function newNote(o) {
    o = o || {};
    go("#/n/" + T.uid() + qstr({ new: "1", title: o.title || "", tag: o.tag || "", kind: o.kind || "" }));
  }

  // ------------------------------------------------------------------------------------------------- khung
  function activeNav(r) { return r.name === "search" || r.name === "n" ? "notes" : r.name === "book" ? "books" : r.name === "daily" ? "home" : r.name; }
  function updateChrome(r) {
    var act = activeNav(r || parse());
    U.$$("[data-nav]").forEach(function (a) { if (a.dataset.nav === act) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#topTitle").textContent = TITLES[(r || parse()).name] || "Personal Wiki";
    doc.title = (TITLES[(r || parse()).name] || "Personal Wiki") + " · Personal Wiki";
    $("#topBack").hidden = !((r || parse()).name === "n" || (r || parse()).name === "book");
  }
  function buildNav() {
    var side = $("#sideNav"), bottom = $("#bottomNav");
    side.replaceChildren.apply(side, NAV.map(function (n) {
      var a = h("a", { class: "nav", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.label) + "</span>" + (n.id === "review" ? '<b class="nbadge" id="badgeS" hidden></b>' : "") + (n.id === "notes" ? '<small class="ncount" id="countS"></small>' : "");
      return a;
    }));
    var main = ["home", "notes", "graph", "review"].map(function (id) { return NAV.filter(function (n) { return n.id === id; })[0]; });
    bottom.replaceChildren.apply(bottom, main.map(function (n) {
      var a = h("a", { class: "bn", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.label) + "</span>" + (n.id === "review" ? '<b class="nbadge" id="badgeB" hidden></b>' : "");
      return a;
    }).concat([(function () { var b = h("button", { type: "button", class: "bn", id: "moreBtn", "aria-haspopup": "menu", "aria-label": "Thêm" }); b.innerHTML = icon("menu") + "<span>Thêm</span>"; b.addEventListener("click", function () { U.menu(b, [{ label: "Sách", icon: "book", run: function () { go("#/books"); } }, { label: "Tag", icon: "tag", run: function () { go("#/tags"); } }, { label: "Tìm kiếm", icon: "search", run: function () { go("#/search"); setTimeout(function () { listPane.focusSearch(); }, 80); } }, { sep: true }, { label: "Cài đặt", icon: "settings", run: function () { go("#/settings"); } }]); }); return b; })()]));
  }
  function refreshShell() {
    var s = repo.stats(), c = $("#countS"); if (c) c.textContent = s.active ? s.active.toLocaleString("vi-VN") : "";
    var pins = repo.list({ fav: true }).slice(0, 6), box = $("#sidePins");
    box.replaceChildren.apply(box, pins.length ? [h("h3", { text: "Đã ghim" })].concat(pins.map(function (p) { var a = h("a", { class: "pin", href: "#/n/" + p.id, title: p.title }); a.innerHTML = icon("star", "ic-fill") + "<span>" + T.esc(p.title) + "</span>"; return a; })) : []);
    repo.cardStats(repo.now()).then(function (cs) {
      dueCount = cs.due;
      ["badgeS", "badgeB"].forEach(function (id) { var b = $("#" + id); if (b) { b.hidden = !cs.due; b.textContent = cs.due > 99 ? "99+" : cs.due; b.setAttribute("aria-label", cs.due + " thẻ đến hạn"); } });
    });
    if (repo.store.volatile) showBanner("volatile");
  }
  var refreshSoon = U.debounce(refreshShell, 120);

  var bannerKind = "";
  function showBanner(kind, extra) {
    bannerKind = kind;
    var b = bannerEl, html = "";
    if (kind === "update") html = '<span>Có bản mới của ứng dụng.</span><button type="button" class="btn" data-bn="update">Tải lại</button>';
    else if (kind === "volatile") html = "<span><b>Không lưu được lâu dài:</b> trình duyệt đang chặn IndexedDB (chế độ riêng tư?). Dữ liệu sẽ mất khi đóng thẻ — hãy mở ở cửa sổ thường.</span>";
    else if (kind === "offline") html = "<span>Bạn đang ngoại tuyến — mọi thứ vẫn hoạt động, dữ liệu lưu trên máy.</span>";
    else if (kind === "sync") html = "<span>" + T.esc(extra || "") + "</span>";
    b.innerHTML = html; b.hidden = !html;
  }
  function chooseBanner() {
    if (U.pwa.updateReady()) showBanner("update"); else if (repo.store.volatile) showBanner("volatile"); else if (!U.pwa.isOnline()) showBanner("offline"); else { bannerKind = ""; bannerEl.hidden = true; }
  }

  // ------------------------------------------------------------------------------------------------- phím tắt
  var gAt = 0;
  function keys(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return; }
    if (U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || doc.querySelector("dialog[open]")) return;
    if (gAt && Date.now() - gAt < 1200) {
      gAt = 0;
      var to = { h: "#/", n: "#/notes", g: "#/graph", r: "#/review", b: "#/books", t: "#/tags", s: "#/settings", d: "#/daily" }[e.key];
      if (to) { e.preventDefault(); go(to); return; }
    }
    if (e.key === "g") gAt = Date.now();
    else if (e.key === "/") { e.preventDefault(); focusSearch(); }
    else if (e.key === "n") { e.preventDefault(); newNote({}); }
    else if (e.key === "?") { e.preventDefault(); help(); }
  }
  function focusSearch() {
    var r = parse();
    if (!/^(notes|search|n)$/.test(r.name)) go("#/notes");
    setTimeout(function () { listPane.focusSearch(); }, 40);
  }
  function help() {
    var rows = [["/ hoặc Ctrl K", "Tìm ghi chú"], ["n", "Ghi chú mới"], ["g rồi h / n / g / r / b / t / s / d", "Trang chủ / Ghi chú / Đồ thị / Ôn tập / Sách / Tag / Cài đặt / Hôm nay"], ["Ctrl S", "Lưu ghi chú đang soạn"], ["Ctrl B / I / K", "Đậm / nghiêng / chèn [[liên kết]]"], ["[[", "Gợi ý tên ghi chú để nối"], ["Space, 1–4", "Ôn tập: hiện đáp án, chấm Lại/Khó/Được/Dễ"], ["?", "Bảng này"]];
    var dl = h("dl", { class: "kbd-list" }); rows.forEach(function (r) { dl.append(h("dt", { text: r[0] }), h("dd", { text: r[1] })); });
    U.dialog("Phím tắt", [dl, h("p", { class: "faint", text: "Phím chữ chỉ có tác dụng khi bạn không đang gõ trong ô nhập." })]);
  }

  // ------------------------------------------------------------------------------------------------- khởi động
  function emptyTrash() {
    var ids = repo.list({ status: "trashed" }).map(function (x) { return x.id; });
    if (!ids.length) { U.toast("Thùng rác đang trống."); return Promise.resolve(); }
    return U.confirmBox("Dọn thùng rác?", "Xoá hẳn " + ids.length + " ghi chú. Không thể hoàn tác.", "Xoá hẳn", true).then(function (ok) {
      if (!ok) return;
      return ids.reduce(function (p, id) { return p.then(function () { return repo.removeForever(id); }); }, Promise.resolve()).then(function () { U.toast("Đã dọn thùng rác (" + ids.length + ")"); });
    });
  }

  function boot() {
    U.loadPrefs(); U.applyPrefs();
    if (root.matchMedia) root.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", U.applyPrefs);
    mainEl = $("#main"); bannerEl = $("#banner");
    U.pwa.init();
    W.store.openBest("personal-wiki").then(function (store) {
      repo = W.repo.create(store);
      return repo.open();
    }).then(function () {
      ctx = { repo: repo, toast: U.toast, confirm: U.confirmBox, route: route, listRoute: listRoute, newNote: newNote, samples: function () { return U.views.samples(ctx); }, emptyTrash: emptyTrash, open: function (id) { go("#/n/" + id); } };
      listPane = U.list.create(Object.assign({}, ctx, { route: listRoute }));
      $("#listPane").append(listPane.el);
      buildNav();
      $("#newBtn").addEventListener("click", function () { newNote({}); });
      $("#fab").addEventListener("click", function () { newNote({}); });
      $("#topNew").addEventListener("click", function () { newNote({}); });
      $("#topSearch").addEventListener("click", focusSearch);
      $("#topBack").addEventListener("click", function () { go(parse().name === "book" ? "#/books" : "#/notes"); });
      bannerEl.addEventListener("click", function (e) { if (e.target.closest('[data-bn="update"]')) U.pwa.applyUpdate(); });
      doc.addEventListener("keydown", keys);
      root.addEventListener("hashchange", handle);
      U.pwa.onChange(chooseBanner); root.addEventListener("online", chooseBanner); root.addEventListener("offline", chooseBanner);
      repo.on(function (ev) { refreshSoon(); if (chan && !ev.remote && (ev.type === "save" || ev.type === "remove" || ev.type === "bulk" || ev.type === "wipe")) chan.postMessage({ t: ev.type }); });
      if (root.BroadcastChannel) {
        chan = new root.BroadcastChannel("personal-wiki");
        chan.onmessage = U.debounce(function () { repo.reload(); }, 250);
      }
      repo.purgeTrash().then(function (n) { if (n) U.toast("Đã dọn " + n + " ghi chú trong thùng rác quá 30 ngày"); });
      refreshShell(); chooseBanner();
      if (!root.location.hash) root.history.replaceState(null, "", "#/");
      handle();
      afterStart();
      doc.body.classList.add("ready");
      if (root.Wiki.sync && root.Wiki.sync.start) root.Wiki.sync.start(ctx);
    }).catch(function (e) {
      doc.body.classList.add("ready");
      $("#main").replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không khởi động được" }), h("p", { class: "faint", text: String(e && e.message || e) })));
      if (root.console) root.console.error(e);
    });
  }

  function afterStart() {
    repo.listDrafts().then(function (ds) {
      var pending = ds.filter(function (d) { return d.note && repo.head(d.id) !== undefined; });
      if (!pending.length) return;
      var first = pending.sort(function (a, b) { return b.saved_at - a.saved_at; })[0], cur = parse();
      if (cur.name === "n" && cur.arg === first.id) return;
      U.toast("Có " + pending.length + " bản nháp chưa lưu", { ms: 12000, action: { label: "Mở", run: function () { go("#/n/" + first.id + (repo.head(first.id) ? "" : "?new=1")); } } });
    });
    var p = U.prefs(), days = (repo.now() - p.lastBackup) / 86400000;
    if (repo.size() >= 5 && (p.lastBackup ? days > p.backupEvery : repo.size() >= 20)) setTimeout(function () { U.toast(p.lastBackup ? "Đã " + Math.floor(days) + " ngày chưa sao lưu" : "Bạn chưa sao lưu lần nào", { ms: 14000, action: { label: "Sao lưu", run: function () { go("#/settings"); } } }); }, 4000);
  }

  U.app = { boot: boot, go: go };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
