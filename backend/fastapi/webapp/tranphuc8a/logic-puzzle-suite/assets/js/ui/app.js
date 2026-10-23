/* ui/app.js — khởi động, định tuyến theo địa chỉ (#/…), khung (thanh bên / thanh dưới), ván đang mở, sinh puzzle, nhắc sao lưu.

   Địa chỉ:  #/ (Chơi: Daily + ván dở + các loại) · #/new[/<loại>]?size=&tier=&seed=[&o=id:lựa-chọn,…]&go=1 (Puzzle mới; go=1 bắt đầu ngay) · #/play/<id ván> (bàn chơi)
             #/daily (puzzle hôm nay) · #/learn[/<loại>] (luật, thuật toán, Constraint View, Show Solver) · #/create[/<loại>] (tự tạo, Logic Builder)
             #/library[/<id bộ sưu tập>] (yêu thích, bộ sưu tập, nhập tệp) · #/stats · #/settings
   Mỗi màn là một hàm U.<mô-đun>.open(ctx, host, arg, query) trả về { destroy() }. */
(function (root) {
  "use strict";
  var P = root.Puz, T = P.text, U = P.ui, h = U.h, icon = U.icon, $ = U.$, doc = root.document;
  var NAV = [
    { id: "home", label: "Chơi", icon: "home", hash: "#/" }, { id: "new", label: "Puzzle mới", icon: "new", hash: "#/new" }, { id: "library", label: "Bộ sưu tập", icon: "library", hash: "#/library" },
    { id: "learn", label: "Học", icon: "learn", hash: "#/learn" }, { id: "create", label: "Tạo puzzle", icon: "create", hash: "#/create" }, { id: "stats", label: "Thống kê", icon: "stats", hash: "#/stats" },
    { id: "settings", label: "Cài đặt", icon: "settings", hash: "#/settings" }
  ];
  var BOTTOM = ["home", "new", "stats", "library"];
  var TITLES = { home: "Chơi", new: "Puzzle mới", play: "Đang chơi", daily: "Puzzle hôm nay", learn: "Học", create: "Tạo puzzle", library: "Bộ sưu tập", stats: "Thống kê", settings: "Cài đặt" };
  var user, ctx, current = null, mainEl, bannerEl, chan = null, games = {};      // games: ván đang mở trong bộ nhớ, theo id
  var navSeq = 0, navChain = Promise.resolve();

  // ------------------------------------------------------------------------------------------------- định tuyến
  function parse() {
    var raw = root.location.hash.replace(/^#\/?/, ""), qi = raw.indexOf("?"), path = qi < 0 ? raw : raw.slice(0, qi), qs = qi < 0 ? "" : raw.slice(qi + 1), q = {};
    new root.URLSearchParams(qs).forEach(function (v, k) { q[k] = v; });
    var seg = path.split("/").filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { name: seg[0] || "home", arg: seg[1] || "", arg2: seg[2] || "", q: q };
  }
  function go(hash, replace) { if (replace) { root.history.replaceState(null, "", hash); handle(); } else if (root.location.hash === hash) handle(); else root.location.hash = hash; }

  var VIEWS = {
    home: function (r) { return U.home.open(ctx, mainEl); }, new: function (r) { return U.newgame.open(ctx, mainEl, r.arg, r.q); }, play: function (r) { return U.play.open(ctx, mainEl, r.arg, r.q); },
    learn: function (r) { return U.learn.open(ctx, mainEl, r.arg, r.q); }, create: function (r) { return U.create.open(ctx, mainEl, r.arg, r.q); }, library: function (r) { return U.library.open(ctx, mainEl, r.arg, r.q); },
    stats: function (r) { return U.statsview.open(ctx, mainEl, r.arg, r.q); }, settings: function (r) { return U.settings.open(ctx, mainEl); }
  };
  function viewKey(r) { return r.name + "/" + r.arg + "/" + r.arg2 + "?" + (r.name === "new" || r.name === "create" || r.name === "learn" || r.name === "library" ? JSON.stringify(r.q) : ""); }

  function handle() {
    var r = parse();
    if (r.name === "daily") { ctx.openDaily(); return; }
    if (!VIEWS[r.name]) r = { name: "home", arg: "", arg2: "", q: {} };
    var key = viewKey(r);
    doc.body.dataset.route = r.name;
    updateChrome(r);
    if (current && current.key === key) return;
    var prev = current, my = ++navSeq; current = null;
    // Hàng đợi điều hướng: huỷ màn cũ xong mới dựng màn mới, và nếu trong lúc chờ đã có lần điều hướng mới hơn thì bỏ lần dựng này
    // (không để một màn dựng chậm đè lên màn mới — lỗi gặp khi bấm Về trang chủ rồi mở ván ngay).
    navChain = navChain.then(function () { return prev && prev.view && prev.view.destroy && prev.view.destroy(); }).catch(function () { }).then(function () {
      if (my !== navSeq) return;
      mainEl.replaceChildren();
      var view = null;
      try { view = VIEWS[r.name](r); }
      catch (e) { mainEl.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Có lỗi khi mở màn này" }), h("p", { class: "faint", text: String(e && e.message || e) }), h("a", { class: "btn btn-primary", href: "#/", text: "Về trang chủ" }))); if (root.console) root.console.error(e); }
      current = { key: key, view: view };
      mainEl.scrollTop = 0; root.scrollTo(0, 0);
    });
  }

  // ------------------------------------------------------------------------------------------------- khung
  function backTarget(r) {
    if (r.name === "play") return "#/";
    if (r.name === "new" && r.arg) return "#/new";
    if ((r.name === "learn" || r.name === "create") && r.arg) return "#/" + r.name;
    if (r.name === "library" && r.arg) return "#/library";
    return "";
  }
  function updateChrome(r) {
    var act = r.name === "daily" ? "home" : r.name === "play" ? "home" : r.name;
    U.$$("[data-nav]").forEach(function (a) { if (a.dataset.nav === act) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var title = TITLES[r.name] || "Logic Puzzle Suite", d = r.arg && P.types.get(r.arg);
    if (d && (r.name === "learn" || r.name === "create" || r.name === "new")) title = d.name + " · " + (r.name === "learn" ? "Học" : r.name === "create" ? "Tạo" : "Mới");
    $("#topTitle").textContent = title; doc.title = title + " · Logic Puzzle Suite";
    var back = backTarget(r), b = $("#topBack"); b.hidden = !back; if (back) b.setAttribute("href", back);
  }
  function buildNav() {
    var side = $("#sideNav"), bottom = $("#bottomNav");
    side.replaceChildren.apply(side, NAV.map(function (n) { var a = h("a", { class: "nav", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.label) + "</span>"; return a; }));
    var main = BOTTOM.map(function (id) { return NAV.filter(function (n) { return n.id === id; })[0]; });
    bottom.replaceChildren.apply(bottom, main.map(function (n) { var a = h("a", { class: "bn", href: n.hash, dataset: { nav: n.id } }); a.innerHTML = icon(n.icon) + "<span>" + T.esc(n.label) + "</span>"; return a; }).concat([(function () {
      var b = h("button", { type: "button", class: "bn", id: "moreBtn", "aria-haspopup": "menu", "aria-label": "Thêm" }); b.innerHTML = icon("menu") + "<span>Thêm</span>";
      b.addEventListener("click", function () { U.menu(b, ["learn", "create", "settings"].map(function (id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return { label: n.label, icon: n.icon, run: function () { go(n.hash); } }; })); });
      return b;
    })()]));
  }

  function showBanner(kind) {
    var html = "";
    if (kind === "update") html = '<span>Có bản mới của ứng dụng.</span><button type="button" class="btn" data-bn="update">Tải lại</button>';
    else if (kind === "volatile") html = "<span><b>Không lưu được lâu dài:</b> trình duyệt đang chặn IndexedDB (chế độ riêng tư?). Lịch sử và ván dở sẽ mất khi đóng thẻ — hãy mở ở cửa sổ thường.</span>";
    else if (kind === "offline") html = "<span>Bạn đang ngoại tuyến — mọi thứ vẫn hoạt động, dữ liệu lưu trên máy.</span>";
    bannerEl.innerHTML = html; bannerEl.hidden = !html;
  }
  function chooseBanner() { if (U.pwa.updateReady()) showBanner("update"); else if (user.store.volatile) showBanner("volatile"); else if (!U.pwa.isOnline()) showBanner("offline"); else bannerEl.hidden = true; }

  // ------------------------------------------------------------------------------------------------- ván chơi và sinh puzzle
  /** Mở một ván từ puzzle có sẵn. opt: { source: random|daily|custom|library|import, ctx:{day?, collectionId?} } */
  function startGame(puzzle, opt) {
    opt = opt || {};
    var pid = puzzle.id || P.util.puzzleId(puzzle);
    var open = findGame(function (s) { return (s.puzzle.id || P.util.puzzleId(s.puzzle)) === pid && s.status !== "solved" && s.status !== "revealed"; });
    if (open) {                                                // đang chơi dở đúng puzzle này (vd mở lại liên kết seed): tiếp tục, đừng chất đống ván trùng
      U.toast("Bạn đang chơi dở puzzle này — tiếp tục từ chỗ cũ.");
      go("#/play/" + encodeURIComponent(open.id));
      return Promise.resolve(getGame(open.id));
    }
    var g = P.game.create(puzzle, { source: opt.source || "random", ctx: opt.ctx || {}, settings: user.settings() });
    games[g.id] = g;
    return user.saveGame(g.serialize()).then(function () { go("#/play/" + encodeURIComponent(g.id)); return g; });
  }
  /** Sinh puzzle theo (loại, seed, cỡ, bậc) trong worker, hiện lớp phủ "đang sinh…" có nút Huỷ. → Promise<puzzle|null> (null nếu huỷ/lỗi, đã báo người dùng). */
  function generate(type, seed, o) {
    var d = P.types.get(type), cancelled = false;
    if (!d) { U.toast("Không có loại puzzle “" + type + "”."); return Promise.resolve(null); }
    var ov = U.pz.busy("Đang sinh " + d.name + (o && o.tier ? " (" + U.pz.tierName(o.tier) + ")" : "") + "…", function () { cancelled = true; P.gen.cancel(); });
    return P.gen.generate(type, seed, o).then(function (pz) { ov.close(); return cancelled ? null : pz; }, function (e) { ov.close(); if (!cancelled) U.toast("Không sinh được puzzle: " + (e && e.message || e), { ms: 7000 }); return null; });
  }
  /** spec: { type, seed, sizeId, tier, options?, source, ctx }. `options` (mục 11) chỉ được truyền cho loại có def.options, ở dạng GỌN (chỉ lựa chọn khác mặc định) —
      loại cũ nhận đúng {sizeId, tier} như trước; Daily không truyền options (dùng mặc định). */
  function begin(spec) {
    var d = P.types.get(spec.type), o = { sizeId: spec.sizeId, tier: spec.tier };
    if (d && d.options) o.options = P.types.compactOptions(d, spec.options);
    return generate(spec.type, spec.seed, o).then(function (pz) { return pz ? startGame(pz, { source: spec.source || "random", ctx: spec.ctx || {} }) : null; });
  }
  /** Ván đang chơi dở của một puzzle/ngày (nếu có). */
  function findGame(pred) { var list = user.games(); for (var i = 0; i < list.length; i++) if (pred(list[i].ser)) return list[i]; return null; }
  function openDaily() {
    var today = P.util.dayKey(), spec = P.daily.forDay(today);
    if (!spec) { U.toast("Chưa có loại puzzle nào để làm Daily."); go("#/", true); return; }
    var done = user.history().filter(function (r) { return r.source === "daily" && r.day === today && r.result === "solved"; })[0];
    var open = findGame(function (s) { return s.source === "daily" && s.ctx && s.ctx.day === today && s.status !== "solved" && s.status !== "revealed"; });
    if (open) { go("#/play/" + encodeURIComponent(open.id), true); return; }
    if (done) { U.toast("Bạn đã giải Daily hôm nay (" + P.util.fmtTime(done.time) + ").", { action: { label: "Chơi lại", run: function () { begin({ type: spec.type, seed: spec.seed, sizeId: spec.sizeId, tier: spec.tier, source: "daily", ctx: { day: today } }); } } }); go("#/", true); return; }
    go("#/", true);
    begin({ type: spec.type, seed: spec.seed, sizeId: spec.sizeId, tier: spec.tier, source: "daily", ctx: { day: today } });
  }
  /** Lấy ván theo id: đang mở trong bộ nhớ, hoặc khôi phục từ kho (ván dở sau khi tải lại/sập máy). */
  function getGame(id) {
    if (games[id]) return games[id];
    var rec = user.getGame(id); if (!rec) return null;
    try { var g = P.game.restore(rec.ser, { settings: user.settings() }); games[id] = g; return g; } catch (e) { return null; }
  }
  function forget(id) { delete games[id]; }

  // ------------------------------------------------------------------------------------------------- phím tắt
  var gAt = 0;
  function keys(e) {
    if (U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || doc.querySelector("dialog[open]")) return;
    if (gAt && Date.now() - gAt < 1200) {
      gAt = 0; var to = { h: "#/", n: "#/new", l: "#/library", s: "#/stats", c: "#/create", t: "#/learn", d: "#/daily", o: "#/settings" }[e.key];
      if (to) { e.preventDefault(); go(to); return; }
    }
    if (e.key === "g") gAt = Date.now(); else if (e.key === "?") { e.preventDefault(); help(); }
  }
  function help() {
    var rows = [["g rồi h / n / l / s / c / t / d / o", "Chơi / Mới / Bộ sưu tập / Thống kê / Tạo / Học / Daily / Cài đặt"], ["Ctrl Z · Ctrl Y", "Hoàn tác · Làm lại (khi đang chơi)"], ["H", "Gợi ý (khi đang chơi)"], ["P", "Tạm dừng / tiếp tục (khi đang chơi)"], ["Mũi tên · Tab", "Di chuyển giữa các ô của bàn"], ["?", "Bảng phím tắt này"]];
    var dl = h("dl", { class: "kbd-list" }); rows.forEach(function (r) { dl.append(h("dt", { text: r[0] }), h("dd", { text: r[1] })); });
    U.dialog("Phím tắt", [dl, h("p", { class: "faint", text: "Phím chữ chỉ có tác dụng khi bạn không đang gõ trong ô nhập. Mỗi bàn chơi có thêm phím riêng (ví dụ Sudoku: 1–9 điền, Shift + số ghi chú, 0/Delete xoá)." })]);
  }

  // ------------------------------------------------------------------------------------------------- khởi động
  function boot() {
    U.loadPrefs(); U.applyPrefs();
    if (root.matchMedia) root.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", U.applyPrefs);
    mainEl = $("#main"); bannerEl = $("#banner");
    U.pwa.init();
    P.store.openBest("logic-puzzle-suite").then(function (store) { user = P.user.create(store); return user.open(); }).then(function () {
      ctx = { user: user, go: go, toast: U.toast, confirm: U.confirmBox, startGame: startGame, generate: generate, begin: begin, openDaily: openDaily, getGame: getGame, forget: forget, findGame: findGame,
        today: function () { return P.util.dayKey(); }, settings: function () { return user.settings(); }, announce: function (s) { var el = $("#srLive"); if (el) { el.textContent = ""; setTimeout(function () { el.textContent = s; }, 20); } },
        refreshChrome: function () { }, notify: function (msg) { if (chan) chan.postMessage(msg); } };
      buildNav();
      bannerEl.addEventListener("click", function (e) { if (e.target.closest('[data-bn="update"]')) U.pwa.applyUpdate(); });
      doc.addEventListener("keydown", keys); root.addEventListener("hashchange", handle);
      U.pwa.onChange(chooseBanner); root.addEventListener("online", chooseBanner); root.addEventListener("offline", chooseBanner);
      user.on(function (ev) { if (chan && /^(puzzle|collection|history|restore|wipe)$/.test(ev.type)) chan.postMessage({ t: ev.type }); });
      if (root.BroadcastChannel) {
        chan = new root.BroadcastChannel("logic-puzzle-suite");
        chan.onmessage = U.debounce(function () { var r = parse(); if (r.name === "play") return; user.open().then(function () { current = null; handle(); }); }, 250);
      }
      chooseBanner();
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
    var p = U.prefs(), days = (user.now() - p.lastBackup) / 86400000, n = user.history().length + user.puzzles().length;
    if (n >= 10 && (p.lastBackup ? days > p.backupEvery : n >= 30)) setTimeout(function () { U.toast(p.lastBackup ? "Đã " + Math.floor(days) + " ngày chưa sao lưu" : "Bạn chưa sao lưu lần nào", { ms: 14000, action: { label: "Sao lưu", run: function () { go("#/settings"); } } }); }, 2500);
  }

  U.app = { boot: boot, go: go, parse: parse, ctx: function () { return ctx; } };          // ctx() chỉ để check.py kiểm trạng thái (ván đang mở, kho dữ liệu)
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
