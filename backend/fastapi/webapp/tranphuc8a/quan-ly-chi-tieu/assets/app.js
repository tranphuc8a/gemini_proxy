/* app.js — khởi động, trạng thái giao diện, định tuyến, uỷ quyền sự kiện.
   Chỉ chạy trong trình duyệt. Toàn bộ logic nghiệp vụ nằm ở các module thuần (ledger, parser, …);
   file này chỉ nối chúng với DOM và với động cơ đồng bộ (store.js). */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var U = QL.ui, esc = QL.text.esc, M = QL.money, D = QL.dates, L = QL.ledger, Mo = QL.model, V = QL.views, DL = QL.dialogs;
  var $ = U.$;

  var today0 = D.today();
  var S = {
    route: "tong-quan",
    txPeriod: { kind: "month", anchor: today0 }, repPeriod: { kind: "month", anchor: today0 },
    filters: {}, limit: 200, showFilters: false, planTab: "budget",
    backends: null, checkedBackends: false
  };
  var engine = null, rendering = false;

  /* ---------------------------------------------------------------- ngữ cảnh */
  function ctx() {
    var doc = engine.getDoc(), st = engine.getStatus();
    return {
      doc: doc, today: D.today(), me: doc.settings.meId || Mo.ME,
      cats: L.byId(doc.categories), accs: L.byId(doc.accounts), people: L.byId(doc.people),
      ui: S, status: st, mode: st.mode, conn: engine.getConn(), backends: S.backends, apiBase: engine.getApiBase(),
      canUndoReplace: engine.canUndoReplace(), pwa: QL.pwa ? QL.pwa.state() : "insecure",
      storedConn: { mysql: engine.hasStoredConn("mysql"), mongo: engine.hasStoredConn("mongo") }
    };
  }

  /** Áp một thay đổi lên sổ, kèm toast "Hoàn tác" (hàm ngược tạo bản ghi MỚI hơn nên thắng khi đồng bộ). */
  function apply(fn, message, undo) {
    engine.mutate(fn);
    if (message) U.toast(message, undo ? { action: function () { engine.mutate(undo); U.toast("Đã hoàn tác"); }, label: "Hoàn tác" } : undefined);
  }

  /* ----------------------------------------------------------------- vẽ */
  function applyTheme(theme) {
    var de = document.documentElement;
    if (theme === "light" || theme === "dark") de.setAttribute("data-theme", theme); else de.removeAttribute("data-theme");
  }
  var SYNC_TEXT = { local: "Trên máy này", saved: "Đã lưu", saving: "Đang lưu…", pending: "Chưa đồng bộ", offline: "Mất kết nối", auth: "Cần kết nối lại", missing: "Cần kết nối lại", error: "Lỗi đồng bộ" };
  function renderChrome(c) {
    var nav = V.NAV;
    var link = function (n) { return '<a href="#/' + n.id + '"' + (S.route === n.id ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + n.ic + "</span><span>" + esc(n.label) + "</span></a>"; };
    $("#side").innerHTML = '<div class="brand"><b>₫</b><span>Chi tiêu</span></div>' + nav.map(link).join("") +
      '<div class="foot"><button type="button" class="btn ghost" data-act="help" style="width:100%;justify-content:flex-start">❔ Trợ giúp <span class="muted small">?</span></button></div>';
    var more = ["chia-tien", "tai-khoan", "ke-hoach", "cai-dat"].indexOf(S.route) !== -1;
    $("#bottom").innerHTML = link(nav[0]) + link(nav[1]) + '<button type="button" class="fab" data-act="tx-new" aria-label="Thêm giao dịch">＋</button>' + link(nav[2]) +
      '<button type="button" class="nv" data-act="more"' + (more ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">☰</span><span>Thêm</span></button>';
    var st = c.status, chip = $("#sync");
    chip.className = "sync " + st.state;
    var text = SYNC_TEXT[st.state] || st.state;
    if ((st.state === "offline" || st.state === "pending") && st.pending) text += " · có thay đổi chờ";
    chip.querySelector("span").textContent = text;
    chip.title = st.message || (st.mode === "local" ? "Dữ liệu chỉ nằm trong trình duyệt này" : "Máy chủ " + st.mode);
  }

  var ROUTES = { "tong-quan": "overview", "giao-dich": "transactions", "bao-cao": "reports", "chia-tien": "sharing", "tai-khoan": "accounts", "ke-hoach": "plans", "cai-dat": "settings" };
  var TITLES = { "tong-quan": "Tổng quan", "giao-dich": "Giao dịch", "bao-cao": "Báo cáo", "chia-tien": "Chia tiền", "tai-khoan": "Tài khoản", "ke-hoach": "Kế hoạch", "cai-dat": "Cài đặt" };

  function focusKey(el) {
    if (!el || el === document.body || !$("#view").contains(el)) return null;
    if (el.id) return "#" + el.id;
    var d = el.dataset || {};
    if (el.name) return '[name="' + el.name + '"]';
    if (d.act) return '[data-act="' + d.act + '"]' + (d.id ? '[data-id="' + d.id + '"]' : "") + (d.for ? '[data-for="' + d.for + '"]' : "") + (d.b ? '[data-b="' + d.b + '"]' : "");
    if (d.seg) return '[data-seg="' + d.seg + '"][data-v="' + d.v + '"]';
    return null;
  }

  function render() {
    if (!engine || !engine.getDoc()) return;
    if (rendering) return; rendering = true;
    try {
      var c = ctx(), fn = V[ROUTES[S.route]], view = $("#view");
      applyTheme(c.doc.settings.theme);
      var key = focusKey(document.activeElement), y = window.scrollY;
      renderChrome(c);
      view.innerHTML = fn(c);
      document.title = TITLES[S.route] + " — Quản lý chi tiêu";
      if (key) { var again = view.querySelector(key); if (again) { try { again.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } } }
      window.scrollTo(0, y);
    } finally { rendering = false; }
  }
  function refreshResults() { // chỉ vẽ lại danh sách giao dịch (khi gõ tìm kiếm) để không mất focus ô tìm
    var box = $("#tx-results");
    if (box && S.route === "giao-dich") box.innerHTML = V.txResults(ctx()); else render();
  }

  /* --------------------------------------------------------------- định tuyến */
  function route() {
    var m = /^#\/([a-z-]+)/.exec(location.hash), id = m && ROUTES[m[1]] ? m[1] : "tong-quan";
    var changed = id !== S.route;
    S.route = id;
    if (id === "cai-dat" && !S.checkedBackends) { S.checkedBackends = true; checkBackends(true); }
    render();
    if (changed) { window.scrollTo(0, 0); $("#view").focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------------ hành động */
  function checkBackends(silent) {
    return engine.backends().then(function (r) {
      if (r.network) { S.backends = null; if (!silent) U.toast(r.noServer ? "Bạn đang mở file trực tiếp — hãy điền “Địa chỉ máy chủ” trước." : "Không kết nối được máy chủ. Nếu mở file trực tiếp, hãy điền “Địa chỉ máy chủ”.", { ms: 6000 }); }
      else if (r.status === 200 && r.body && r.body.data) {
        var map = {}; (r.body.data.backends || []).forEach(function (b) { map[b.id] = b; }); S.backends = map;
        if (!silent) U.toast("Đã kiểm tra kho trên máy chủ");
      } else if (!silent) U.toast("Máy chủ trả lỗi " + r.status, { ms: 5000 });
      render();
    });
  }
  function syncNow() { return engine.pull().then(function () { return engine.push(); }).then(function () { var st = engine.getStatus(); U.toast(st.state === "saved" ? "Đã đồng bộ" : (st.message || "Chưa đồng bộ được")); }); }

  function editTx(tx) {
    if (tx.type === "settle") return editSettle(tx);
    DL.tx({ tx: tx });
  }
  function editSettle(tx) {
    var c = ctx(), p = V.personName(c, tx.personId);
    var d = U.dialog("Thanh toán nợ",
      "<p>" + (tx.direction === "in" ? esc(p) + " đã chuyển cho bạn " : "Bạn đã chuyển cho " + esc(p) + " ") + "<strong class=\"num\">" + M.format(tx.amount) + "</strong> ngày " + esc(D.dayLabel(tx.date)) + " (" + esc(V.accName(c, tx.accountId)) + ").</p>" +
      '<p class="muted small">Muốn sửa số tiền, hãy xoá rồi ghi lại.</p>', '<button type="button" class="btn" data-close>Đóng</button><button type="button" class="btn danger" data-del>Xoá khoản này</button>', { center: true });
    d.el.querySelector("[data-del]").addEventListener("click", function () {
      d.close(); apply(function (dd) { return Mo.remove(dd, "transactions", tx.id); }, "Đã xoá", function (dd) { return Mo.upsert(dd, "transactions", tx); });
    });
  }

  var ACT = {
    "tx-new": function () { DL.tx({}); },
    "tx-transfer": function () { DL.tx({ type: "transfer" }); },
    "tx-edit": function (el) { var tx = Mo.find(engine.getDoc().transactions, el.dataset.id); if (tx) editTx(tx); },
    "tx-more": function () { S.limit += 200; refreshResults(); },
    "more": function () { DL.more(); },
    "help": function () { DL.help(); },
    "sync-open": function () { DL.sync(); },
    "print": function () { window.print(); },
    "report-copy": function () { U.copyText(V.reportText(ctx())).then(function (ok) { U.toast(ok ? "Đã sao chép tóm tắt" : "Không sao chép được"); }); },
    "period-prev": function (el) { var p = S[el.dataset.for]; S[el.dataset.for] = { kind: p.kind, anchor: D.shift(D.period(p.kind, p.anchor), -1).from }; S.limit = 200; render(); },
    "period-next": function (el) { var p = S[el.dataset.for]; S[el.dataset.for] = { kind: p.kind, anchor: D.shift(D.period(p.kind, p.anchor), 1).from }; S.limit = 200; render(); },
    "period-now": function (el) { S[el.dataset.for] = { kind: S[el.dataset.for].kind, anchor: D.today() }; S.limit = 200; render(); },
    "filter-toggle": function () { S.showFilters = !S.showFilters; render(); },
    "filter-clear": function () { S.filters = {}; render(); },
    "settle": function (el) { DL.settle(el.dataset.id); },
    "person-new": function () { DL.person(null); },
    "person-edit": function (el) { DL.person(el.dataset.id); },
    "person-detail": function (el) { DL.personDetail(el.dataset.id); },
    "bill": function () { DL.bill(); },
    "account-new": function () { DL.account(null); },
    "account-edit": function (el) { DL.account(el.dataset.id); },
    "deposit-new": function () { DL.deposit(); },
    "deposit-close": function (el) { DL.closeDeposit(el.dataset.id); },
    "budget-new": function () { DL.budget(null); },
    "budget-edit": function (el) { DL.budget(el.dataset.id); },
    "rec-new": function () { DL.recurring(null); },
    "rec-edit": function (el) { DL.recurring(el.dataset.id); },
    "cat-new": function () { DL.category(null); },
    "cat-edit": function (el) { DL.category(el.dataset.id); },
    "rec-confirm": function (el) {
      var doc = engine.getDoc(), rule = Mo.find(doc.recurring, el.dataset.rule), due = el.dataset.due; if (!rule) return;
      var txId = null;
      apply(function (dd) { var n = Mo.confirmRecurring(dd, rule.id, due); txId = n.transactions[n.transactions.length - 1].id; return n; },
        "Đã ghi “" + rule.name + "” " + M.format(rule.amount), function (dd) { return Mo.upsert(Mo.remove(dd, "transactions", txId), "recurring", rule); });
    },
    "rec-skip": function (el) {
      var rule = Mo.find(engine.getDoc().recurring, el.dataset.rule); if (!rule) return;
      apply(function (dd) { return Mo.markRecurringDone(dd, rule.id, el.dataset.due); }, "Đã bỏ qua kỳ " + D.dm(el.dataset.due), function (dd) { return Mo.upsert(dd, "recurring", rule); });
    },

    /* ---- dữ liệu ---- */
    "backup-json": function () {
      U.download("chi-tieu-" + D.today() + ".json", engine.exportJson(), "application/json;charset=utf-8");
      engine.markBackedUp(); U.toast("Đã tải file sao lưu");
    },
    "restore-json": function () { U.pickFile(".json,application/json").then(function (f) { if (f) DL.restore(f.text, f.name); }); },
    "export-csv": function () { U.download("chi-tieu-" + D.today() + ".csv", QL.csv.toCsv(engine.getDoc()), "text/csv;charset=utf-8"); U.toast("Đã tải file CSV"); },
    "import-csv": function () { U.pickFile(".csv,.txt,text/csv").then(function (f) { if (f) DL.importCsv(f.text); }); },
    "import-text": function () { DL.importText(); },
    "undo-replace": function () { if (engine.undoReplace()) U.toast("Đã hoàn tác lần thay thế"); },
    "sample": function () {
      var doc = engine.getDoc();
      var go = function () { apply(function (dd) { return Mo.addSample(dd, D.today()); }, "Đã thêm dữ liệu mẫu — xoá bằng nút “Xoá dữ liệu mẫu” ở Cài đặt"); };
      if (doc.transactions.length) U.confirmBox("Thêm dữ liệu mẫu?", "Dữ liệu mẫu được gắn thẻ #mau, thêm vào cạnh dữ liệu thật của bạn và xoá được chỉ bằng một nút.", "Thêm").then(function (ok) { if (ok) go(); }); else go();
    },
    "sample-remove": function () { apply(function (dd) { return Mo.removeSample(dd); }, "Đã xoá dữ liệu mẫu"); },
    "wipe": function () {
      U.confirmBox("Xoá toàn bộ dữ liệu?", "Toàn bộ giao dịch, tài khoản, ngân sách… sẽ bị xoá" + (engine.getMode() === "local" ? " khỏi trình duyệt này." : " và việc này sẽ đồng bộ lên máy chủ.") + " Bạn có thể hoàn tác một bước ở Cài đặt.", "Xoá hết", true).then(function (ok) {
        if (!ok) return;
        U.confirmBox("Chắc chắn chứ?", "Hãy sao lưu trước nếu bạn còn cần dữ liệu này.", "Xoá hết", true).then(function (ok2) {
          if (ok2) { engine.replaceDoc(Mo.emptyDoc(), "wipe"); U.toast("Đã xoá toàn bộ dữ liệu", { action: function () { engine.undoReplace(); }, label: "Hoàn tác" }); }
        });
      });
    },

    /* ---- lưu trữ ---- */
    "use-local": function () {
      if (engine.getMode() === "local") return;
      U.confirmBox("Chuyển về “Máy này”?", "Sổ hiện tại được chép về trình duyệt này và từ đó không còn đồng bộ lên máy chủ. Dữ liệu trên máy chủ giữ nguyên, bạn nối lại được bằng mã.", "Chuyển về máy").then(function (ok) { if (ok) { engine.useLocal("current"); render(); U.toast("Đã chuyển về chế độ Máy này"); } });
    },
    "connect-new": function (el) { DL.connectNew(el.dataset.b); },
    "connect-code": function (el) { DL.connectCode(el.dataset.b); },
    "connect-saved": function (el) {
      var b = el.dataset.b;
      engine.connectExisting(b, engine.getStoredCode(b), "merge").then(function (r) { render(); U.toast(r.ok ? "Đã kết nối lại" : r.message, { ms: r.ok ? 3500 : 6000 }); });
    },
    "copy-code": function () { var cn = engine.getConn(); if (cn) U.copyText(cn.code).then(function (ok) { U.toast(ok ? "Đã sao chép mã kết nối" : "Không sao chép được"); }); },
    "pwa-install": function () { QL.pwa.install().then(function (ok) { if (ok) U.toast("Đang cài ứng dụng…"); }); },
    "sync-now": function () { syncNow(); },
    "check-backends": function () { checkBackends(false); },
    "ws-delete": function () {
      U.confirmBox("Xoá không gian trên máy chủ?", "Dữ liệu trên máy chủ bị xoá vĩnh viễn (các thiết bị khác mất quyền truy cập). Dữ liệu trên máy này vẫn được giữ.", "Xoá trên máy chủ", true).then(function (ok) {
        if (ok) engine.deleteWorkspace().then(function (r) { render(); U.toast(r.ok ? "Đã xoá trên máy chủ" : r.message, { ms: 5000 }); });
      });
    }
  };

  /* ------------------------------------------------------------ uỷ quyền sự kiện */
  document.addEventListener("click", function (e) {
    if (e.target.closest("dialog.dlg")) return;
    var el = e.target.closest("[data-act],[data-seg]");
    if (!el) return;
    if (el.dataset.seg) {
      var name = el.dataset.seg, v = el.dataset.v;
      if (name === "txPeriod" || name === "repPeriod") { S[name] = { kind: v, anchor: S[name].anchor }; S.limit = 200; render(); }
      else if (name === "planTab") { S.planTab = v; render(); }
      else if (name === "theme") apply(function (dd) { return Mo.setSettings(dd, { theme: v }); });
      return;
    }
    var fn = ACT[el.dataset.act];
    if (fn) { if (el.tagName !== "A") e.preventDefault(); fn(el, e); }
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.on === "search") { S.filters.q = t.value; S.limit = 200; debouncedResults(); }
  });
  var debouncedResults = U.debounce(refreshResults, 120);

  document.addEventListener("change", function (e) {
    var t = e.target, on = t.dataset && t.dataset.on;
    if (!on) return;
    if (on === "filter") { if (t.type === "checkbox") S.filters[t.name] = t.checked; else S.filters[t.name] = t.value; S.limit = 200; render(); }
    else if (on === "smallk") apply(function (dd) { return Mo.setSettings(dd, { smallAsThousand: t.checked }); });
    else if (on === "defacc") apply(function (dd) { return Mo.setSettings(dd, { defaultAccountId: t.value }); });
    else if (on === "apibase") { engine.setApiBase(t.value); S.checkedBackends = false; U.toast(t.value.trim() ? "Đã lưu địa chỉ máy chủ" : "Dùng địa chỉ mặc định"); }
  });

  /* ---------------------------------------------------- nhập nhanh trên đầu trang */
  function setupQuickAdd() {
    var inp = $("#qa"), pop = $("#qa-pop");
    function parse() { return QL.parser.parseQuick(inp.value, { today: D.today(), doc: engine.getDoc() }); }
    function show() {
      var p = parse();
      if (!p) { pop.hidden = true; return; }
      var c = ctx(), chips = [];
      chips.push(p.amount ? '<span class="chip static num">' + M.format(p.amount) + "</span>" : '<span class="chip warn">Chưa thấy số tiền</span>');
      chips.push('<span class="chip static">' + esc(D.relativeLabel(p.date, c.today)) + "</span>");
      if (p.categoryId) { var cat = V.catOf(c, p.categoryId); chips.push('<span class="chip static">' + esc(cat.icon) + " " + esc(cat.name) + "</span>"); }
      if (p.type === "income") chips.push('<span class="chip static thu">Thu</span>');
      if (p.split) chips.push('<span class="chip static">Chia ' + p.split.n + (p.split.payerId !== c.me ? " · " + esc(V.personName(c, p.split.payerId)) + " trả" : "") + "</span>");
      p.warnings.forEach(function (w) { chips.push('<span class="chip warn">' + esc(w) + "</span>"); });
      pop.innerHTML = '<div class="preview">' + chips.join("") + '</div><p class="hint">⏎ để lưu · Esc để xoá' + (p.amount ? "" : " · thêm số tiền, ví dụ 57k") + "</p>";
      pop.hidden = false;
    }
    inp.addEventListener("input", show);
    inp.addEventListener("blur", function () { setTimeout(function () { pop.hidden = true; }, 150); });
    inp.addEventListener("focus", show);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { inp.value = ""; pop.hidden = true; return; }
      if (e.key !== "Enter") return;
      e.preventDefault();
      var doc = engine.getDoc(), p = parse();
      if (!p) return;
      var tx = QL.parser.toTx(p, doc);
      if (tx && p.categoryId && Mo.validateTx(Object.assign({ id: "x" }, tx), doc).length === 0 && !p.warnings.length) {
        tx.id = Mo.uid("t");
        apply(function (dd) { return Mo.upsert(dd, "transactions", tx); }, "Đã lưu " + M.format(tx.amount) + (tx.note ? " · " + tx.note : ""), function (dd) { return Mo.remove(dd, "transactions", tx.id); });
        inp.value = ""; pop.hidden = true;
      } else { // chưa đủ chắc chắn (thiếu số tiền/danh mục, có cảnh báo): mở hộp thoại để xem và sửa
        var text = inp.value; inp.value = ""; pop.hidden = true;
        DL.tx({ quick: text });
      }
    });
  }

  /* ------------------------------------------------------------------ phím tắt */
  var gAt = 0;
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable) || document.querySelector("dialog[open]")) return;
    var k = e.key.toLowerCase();
    if (gAt && Date.now() - gAt < 1200) {
      gAt = 0;
      var go = { t: "tong-quan", d: "giao-dich", b: "bao-cao", c: "chia-tien", a: "tai-khoan", k: "ke-hoach", s: "cai-dat" }[k];
      if (go) { e.preventDefault(); location.hash = "#/" + go; return; }
    }
    if (k === "n") { e.preventDefault(); DL.tx({}); }
    else if (k === "/") { e.preventDefault(); var qa = $("#qa"); if (qa && qa.offsetParent) qa.focus(); else DL.tx({}); }
    else if (k === "?") { e.preventDefault(); DL.help(); }
    else if (k === "g") gAt = Date.now();
  });

  /* --------------------------------------------------------------- khởi động */
  function boot() {
    var storage = null;
    try { storage = root.localStorage; storage.getItem("qlct.probe"); } catch (e) { storage = null; }
    var memory = {};
    if (!storage) { // trình duyệt chặn localStorage: vẫn chạy được trong phiên này, nhưng nói rõ
      storage = { getItem: function (k) { return k in memory ? memory[k] : null; }, setItem: function (k, v) { memory[k] = String(v); }, removeItem: function (k) { delete memory[k]; } };
    }
    var cfg = root.__WEBAPP_CONFIG__ || {};
    engine = QL.store.createEngine({
      storage: storage, fetch: function (u, i) { return root.fetch(u, i); }, now: function () { return new Date(); },
      setTimeout: function (f, ms) { return root.setTimeout(f, ms); }, clearTimeout: function (id) { root.clearTimeout(id); },
      apiBase: function () { return typeof cfg.apiBase === "string" ? cfg.apiBase : ""; },
      apiAvailable: function () { return root.location.protocol !== "file:" || !!(engine && engine.getApiBase()); },
      onStatus: function () { var c = ctx(); renderChrome(c); },
      onDoc: function (doc, why) {
        render();
        var m = /^merged:(\d+)/.exec(why || "");
        if (m && +m[1] > 0) U.toast("Đã gộp " + m[1] + " thay đổi từ thiết bị khác");
      }
    });
    QL.app = { engine: engine, ctx: ctx, apply: apply, refresh: render, editTx: editTx, syncNow: syncNow };
    setupQuickAdd();
    root.addEventListener("hashchange", route);
    if (QL.pwa) QL.pwa.onChange(function () { if (S.route === "cai-dat") render(); });   // trình duyệt báo "cài được" / "đã cài" sau khi trang đã vẽ
    root.addEventListener("online", function () { if (engine.getMode() !== "local") engine.push(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && engine.getMode() !== "local") engine.pull(); });
    root.setInterval(function () { if (!document.hidden && engine.getMode() !== "local") engine.pull(); }, 60000);
    root.addEventListener("beforeunload", function () { /* đã ghi cục bộ ngay mỗi lần sửa; không cần làm gì thêm */ });
    engine.init().then(function () { route(); if (!storageOk(root)) U.toast("Trình duyệt chặn lưu trữ — dữ liệu chỉ tồn tại trong phiên này", { ms: 8000 }); });
  }
  function storageOk(w) { try { w.localStorage.setItem("qlct.probe", "1"); w.localStorage.removeItem("qlct.probe"); return true; } catch (e) { return false; } }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
