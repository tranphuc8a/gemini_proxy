/* app.js — vỏ ứng dụng Code Studio: trạng thái, bố cục, mở/lưu đoạn mã & dự án, thẻ tệp, chạy, định dạng, phím tắt.
   Thanh bên (tệp, thư viện, tìm) ở side.js; hộp thoại (cài đặt, tạo mới, bảng lệnh, trợ giúp, đồng bộ) ở dialogs.js.
   Lõi thuần ở assets/core: langs, tokenize, format(+ext), complete, project, zip, store, runner. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, $ = U.$, $$ = U.$$;
  var CFG = root.__WEBAPP_CONFIG__ || {};
  var API = String(CFG.apiBase || "").replace(/\/+$/, "");

  /* ------------------------------------------------------------------ biểu tượng (chuỗi tĩnh) */
  var ICONS = {
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
    files: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    lib: '<path d="M4 5h4v14H4zM10 5h4v14h-4z"/><path d="m16 6 3.5-1 3 13.5-3.5 1z"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    cmd: '<path d="M9 6H6a3 3 0 1 0 3 3zM9 9h6M15 6h3a3 3 0 1 1-3 3zM9 15H6a3 3 0 1 0 3 3zM9 15h6M15 18h3a3 3 0 1 0-3-3z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9M12 17.2v.1"/>',
    fmt: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', plus: '<path d="M12 5v14M5 12h14"/>', folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', sync: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 13a8 8 0 0 0 14.3 4.6L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/>', side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>', clear: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', max: '<path d="M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7"/>',
    collapse: '<path d="M4 6h16M8 12h12M8 18h12"/>', refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>'
  };
  function ic(name, extraCls) { return '<svg class="i ' + (extraCls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>"; }

  /* ------------------------------------------------------------------ cài đặt */
  var DEF = {
    theme: "auto", fontSize: 14, wrap: false, autoClose: true, completion: true, occurrences: true, indent: "auto", formatOnSave: false,
    format: { provider: {}, braces: "kr", pointer: "auto", keepOneLiners: true, clangStyle: "Google", columnLimit: 100 },
    run: { target: {}, pistonUrl: "", runTimeoutMs: 5000, std: { c: "c17", cpp: "c++17" }, opt: "O2", clearOnRun: true },
    storage: { mode: "local", backend: "json" },
    lastItemId: null, side: "explorer", sideOpen: true, panelOpen: true, panelTab: "output", sideW: 260, panelH: 230
  };
  function merge(a, b) {
    var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? merge(a[k], (b && b[k]) || {}) : (b && k in b ? b[k] : a[k]); });
    Object.keys(b || {}).forEach(function (k) { if (!(k in o)) o[k] = b[k]; });
    return o;
  }

  var S = { settings: null, item: null, tabs: [], active: null, views: {}, dirty: false, running: null, diags: [], lastResult: null, serverTargets: null, saveTimer: 0 };
  var A = { S: S, API: API, ic: ic, ICONS: ICONS };
  CS.app = A;
  var ed = null, els = {};

  function saveSettings() { U.lsSet("cs:settings", S.settings); }
  function applyTheme() { var t = S.settings.theme; if (t === "auto") D().documentElement.removeAttribute("data-theme"); else D().documentElement.setAttribute("data-theme", t); }
  function D() { return root.document; }

  /* ------------------------------------------------------------------ lớp chuyển tiếp: lưu trữ */
  var Store = {
    lib: null, sync: null,
    init: function () {
      /* IndexedDB (dự án lớn) → localStorage → bộ nhớ: kv.auto tự rơi xuống khi trình duyệt chặn */
      return CS.store.kv.auto({ idb: "code-studio", local: "cs:data:" }).then(function (kv) {
        Store.kv = kv;
        Store.lib = CS.store.library({ kv: kv });
        return Store.lib.ready;
      }).then(function () { return Store.initSync(); });
    },
    initSync: function () {
      if (Store.sync && Store.sync.dispose) Store.sync.dispose();
      Store.sync = null;
      if (S.settings.storage.mode !== "server" || !API || !CS.store.sync) return Promise.resolve();
      Store.sync = CS.store.sync({ library: Store.lib, kv: Store.kv, fetch: root.fetch.bind(root), apiBase: API, backend: S.settings.storage.backend });
      if (Store.sync.onStatus) Store.sync.onStatus(function () { A.renderStatus(); if (A.side) A.side.refreshLibraryFoot && A.side.refreshLibraryFoot(); });
      return Promise.resolve(Store.sync.ready || null);
    },
    list: function () { return Promise.resolve(Store.lib.list()); },
    get: function (id) { return Promise.resolve(Store.lib.get(id)); },
    put: function (item) { return Promise.resolve(Store.lib.put(item)).then(function (r) { Store.kick(); return r; }); },
    remove: function (id) { return Promise.resolve(Store.lib.remove(id)).then(function (r) { Store.kick(); return r; }); },
    kick: U.debounce(function () { if (Store.sync && Store.sync.syncNow && Store.connected()) Store.sync.syncNow().catch(function () { /* trạng thái đã ghi lại lỗi */ }); }, 1500),
    connected: function () { var s = Store.sync; return !!(s && (s.workspaceId || (s.state && s.state.workspaceId) || (s.isConnected && s.isConnected()))); },
    syncStatus: function () { var s = Store.sync; if (!s) return null; return { status: s.status || (s.state && s.state.status) || "idle", error: s.lastError || (s.state && s.state.lastError) || "" }; }
  };
  A.Store = Store;

  /* ------------------------------------------------------------------ bố cục */
  function build() {
    var app = $("#app");
    app.className = "cs-app";
    app.innerHTML =
      '<header class="cs-top">' +
        '<button type="button" class="ic cs-only-n" data-cmd="drawer" aria-label="Mở thanh bên">' + ic("menu") + "</button>" +
        '<a class="cs-brand" href="#" data-cmd="library" title="Thư viện"><span class="cs-logo">{}</span><span class="cs-hide-n">Code Studio</span></a>' +
        '<input class="cs-title" type="text" maxlength="200" aria-label="Tên đoạn mã / dự án" spellcheck="false">' +
        '<span class="cs-kind cs-hide-n"></span><span class="cs-sp"></span>' +
        '<label class="sr" for="cs-target">Nơi chạy</label><select id="cs-target" class="sel cs-target cs-hide-n" title="Nơi chạy mã (trình duyệt / máy chủ / dịch vụ ngoài)"></select>' +
        '<button type="button" class="btn run" data-cmd="run" title="Chạy (Ctrl+Enter, F5)">' + ic("play") + '<span class="cs-hide-n">Chạy</span></button>' +
        '<button type="button" class="btn stop" data-cmd="stop" hidden title="Dừng (Shift+F5)">' + ic("stop") + '<span class="cs-hide-n">Dừng</span></button>' +
        '<button type="button" class="ic" data-cmd="format" title="Định dạng mã (Shift+Alt+F)" aria-label="Định dạng mã">' + ic("fmt") + "</button>" +
        '<button type="button" class="ic" data-cmd="save" title="Lưu (Ctrl+S)" aria-label="Lưu">' + ic("save") + "</button>" +
        '<button type="button" class="ic" data-cmd="more" title="Thêm" aria-label="Thêm lệnh">' + ic("more") + "</button>" +
      "</header>" +
      '<div class="cs-work">' +
        '<nav class="cs-act" aria-label="Thanh hoạt động">' +
          '<button type="button" class="ic" data-side="explorer" title="Tệp của dự án (Ctrl+Shift+E)" aria-label="Tệp">' + ic("files") + "</button>" +
          '<button type="button" class="ic" data-side="library" title="Thư viện đoạn mã & dự án (Ctrl+O)" aria-label="Thư viện">' + ic("lib") + "</button>" +
          '<button type="button" class="ic" data-side="search" title="Tìm trong dự án (Ctrl+Shift+F)" aria-label="Tìm trong dự án">' + ic("search") + "</button>" +
          '<span class="grow"></span>' +
          '<button type="button" class="ic" data-cmd="palette" title="Bảng lệnh (Ctrl+Shift+P)" aria-label="Bảng lệnh">' + ic("cmd") + "</button>" +
          '<button type="button" class="ic" data-cmd="settings" title="Cài đặt (Ctrl+,)" aria-label="Cài đặt">' + ic("gear") + "</button>" +
          '<button type="button" class="ic" data-cmd="help" title="Phím tắt & trợ giúp (F1)" aria-label="Trợ giúp">' + ic("help") + "</button>" +
        "</nav>" +
        '<aside class="cs-side" aria-label="Thanh bên"><div class="cs-shead"><span class="t"></span><span class="acts"></span></div><div class="cs-sbody"></div><div class="cs-sfoot" hidden></div></aside>' +
        '<div class="cs-split" role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng thanh bên" tabindex="0"></div>' +
        '<div class="cs-drawer-bg" data-cmd="drawer"></div>' +
        '<main class="cs-center">' +
          '<div class="cs-tabs" role="tablist" aria-label="Tệp đang mở"></div>' +
          '<div class="cs-edwrap"><div class="cs-ed"></div><div class="cs-empty" hidden></div></div>' +
          '<div class="cs-hsplit" role="separator" aria-orientation="horizontal" aria-label="Kéo để đổi chiều cao bảng dưới" tabindex="0"></div>' +
          '<section class="cs-panel" aria-label="Bảng kết quả">' +
            '<div class="cs-ptabs" role="tablist">' +
              '<button type="button" class="cs-ptab" role="tab" data-ptab="output">Kết quả</button>' +
              '<button type="button" class="cs-ptab" role="tab" data-ptab="problems">Vấn đề<span class="n" hidden></span></button>' +
              '<button type="button" class="cs-ptab" role="tab" data-ptab="input">Dữ liệu vào</button>' +
              '<button type="button" class="cs-ptab" role="tab" data-ptab="config">Cấu hình chạy</button>' +
              '<span class="cs-sp"></span>' +
              '<button type="button" class="ic" data-cmd="clear-output" title="Xoá kết quả" aria-label="Xoá kết quả">' + ic("clear") + "</button>" +
              '<button type="button" class="ic" data-cmd="panel-max" title="Phóng to/thu nhỏ bảng" aria-label="Phóng to bảng">' + ic("max") + "</button>" +
              '<button type="button" class="ic" data-cmd="panel" title="Ẩn bảng (Ctrl+J)" aria-label="Ẩn bảng">' + ic("close") + "</button>" +
            "</div><div class=\"cs-pbody\"></div>" +
          "</section>" +
        "</main>" +
      "</div>" +
      '<footer class="cs-status" aria-label="Thanh trạng thái"></footer>';
    els = { app: app, top: $(".cs-top"), title: $(".cs-title"), kind: $(".cs-kind"), target: $(".cs-target"), run: $('[data-cmd="run"]'), stop: $('[data-cmd="stop"]'),
      work: $(".cs-work"), side: $(".cs-side"), center: $(".cs-center"), tabs: $(".cs-tabs"), edHost: $(".cs-ed"), empty: $(".cs-empty"), edwrap: $(".cs-edwrap"),
      panel: $(".cs-panel"), pbody: $(".cs-pbody"), status: $(".cs-status") };
    A.els = els;
    app.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cmd]");
      if (b && app.contains(b)) { e.preventDefault(); A.cmd(b.getAttribute("data-cmd"), b); return; }
      var s = e.target.closest("[data-side]");
      if (s) { A.showSide(s.getAttribute("data-side"), true); return; }
      var p = e.target.closest("[data-ptab]");
      if (p) { A.showPanel(p.getAttribute("data-ptab")); }
    });
    els.title.addEventListener("change", function () {
      if (!S.item) return;
      var v = els.title.value.trim().slice(0, 200) || "Không tên";
      els.title.value = v; S.item.name = v; markDirty(); saveNow();
      if (A.side) A.side.render();
    });
    els.target.addEventListener("change", function () { var l = runLang(); if (l) { S.settings.run.target[l] = els.target.value; saveSettings(); A.renderStatus(); A.renderPanel(); } });
    resizer($(".cs-split"), "x"); resizer($(".cs-hsplit"), "y");
    applyLayout();
  }
  function applyLayout() {
    var st = S.settings;
    D().documentElement.style.setProperty("--side-w", Math.max(180, Math.min(560, st.sideW)) + "px");
    D().documentElement.style.setProperty("--panel-h", Math.max(90, Math.min(root.innerHeight - 160, st.panelH)) + "px");
    els.work.classList.toggle("noside", !st.sideOpen);
    els.center.classList.toggle("nopanel", !st.panelOpen);
    $$(".cs-act [data-side]").forEach(function (b) { b.setAttribute("aria-pressed", String(st.sideOpen && b.getAttribute("data-side") === st.side)); });
    if (ed) setTimeout(function () { ed.refresh(); }, 0);
  }
  function resizer(bar, axis) {
    bar.addEventListener("pointerdown", function (e) {
      e.preventDefault(); bar.classList.add("drag"); bar.setPointerCapture(e.pointerId);
      var start = axis === "x" ? e.clientX : e.clientY, base = axis === "x" ? S.settings.sideW : S.settings.panelH;
      function mv(ev) { var d = (axis === "x" ? ev.clientX : ev.clientY) - start; if (axis === "x") S.settings.sideW = base + d; else S.settings.panelH = base - d; applyLayout(); }
      function up() { bar.classList.remove("drag"); bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up); saveSettings(); }
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    });
    bar.addEventListener("keydown", function (e) {
      var d = (e.key === "ArrowRight" || e.key === "ArrowUp") ? 16 : (e.key === "ArrowLeft" || e.key === "ArrowDown") ? -16 : 0;
      if (!d) return; e.preventDefault();
      if (axis === "x") S.settings.sideW += d; else S.settings.panelH += d;
      applyLayout(); saveSettings();
    });
  }

  /* ------------------------------------------------------------------ trình soạn */
  function indentFor(lang) {
    var ind = S.settings.indent, L = CS.langs.get(lang);
    if (ind === "auto") return L.tabs ? "\t" : new Array((L.tab || 4) + 1).join(" ");
    return ind === "tab" ? "\t" : new Array((ind | 0) + 1).join(" ");
  }
  function initEditor() {
    ed = CS.editor.create(els.edHost, {
      lang: "plaintext", value: "", fontSize: S.settings.fontSize, wrap: S.settings.wrap, autoClose: S.settings.autoClose, completion: S.settings.completion, occurrences: S.settings.occurrences,
      onChange: function (v) { var f = fileOf(S.active); if (f && f.content !== v) { f.content = v; markDirty(); if (S.diags.length) { /* giữ dấu lỗi tới lần chạy sau */ } } },
      onRun: function () { A.cmd("run"); }, onSave: function () { A.cmd("save"); }, onFormat: function () { A.cmd("format"); },
      onCursor: function (c) { S.cursor = c; renderCursor(); },
      onOptions: function (o) { if ("fontSize" in o) S.settings.fontSize = o.fontSize; if ("wrap" in o) S.settings.wrap = o.wrap; saveSettings(); A.renderStatus(); },
      extraWords: function () { return otherWords(); },
      files: function () { return S.item ? S.item.files.map(function (f) { return f.path.split("/").pop(); }) : []; }
    });
    A.ed = ed;
  }
  var wordsCache = { sig: "", words: [] };
  function otherWords() {
    if (!S.item || S.item.files.length < 2) return [];
    var sig = S.item.files.length + ":" + S.active + ":" + (S.lastSaveAt || 0);
    if (wordsCache.sig === sig) return wordsCache.words;
    var seen = {}, out = [];
    S.item.files.forEach(function (f) {
      if (f.path === S.active || f.content.length > 200000) return;
      var re = /[A-Za-z_][A-Za-z0-9_]{2,}/g, m;
      while ((m = re.exec(f.content)) && out.length < 3000) if (!seen[m[0]]) { seen[m[0]] = 1; out.push(m[0]); }
    });
    wordsCache = { sig: sig, words: out };
    return out;
  }

  /* ------------------------------------------------------------------ mục đang mở */
  function fileOf(path) { if (!S.item || !path) return null; for (var i = 0; i < S.item.files.length; i++) if (S.item.files[i].path === path) return S.item.files[i]; return null; }
  function langOf(path) { return CS.langs.byFilename(path || ""); }
  A.fileOf = fileOf; A.langOf = langOf;
  function mainFile() {
    if (!S.item) return null;
    var m = S.item.meta && S.item.meta.mainFile;
    if (m && fileOf(m)) return m;
    var d = CS.project && CS.project.detectMain ? CS.project.detectMain(S.item) : null;
    return d && fileOf(d) ? d : (S.item.files[0] && S.item.files[0].path);
  }
  A.mainFile = mainFile;
  /** ngôn ngữ để chạy: theo tệp chính (dự án) / tệp duy nhất (đoạn mã) */
  function runLang() { var m = mainFile(); return m ? langOf(m) : (S.item && S.item.language) || null; }
  A.runLang = runLang;

  function markDirty() {
    var was = S.dirty;
    S.dirty = true;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(saveNow, 900);
    if (!was) renderTabs();                 /* chấm "chưa lưu" chỉ đổi khi trạng thái đổi — đừng dựng lại thẻ mỗi phím gõ */
  }
  A.markDirty = markDirty;
  function saveNow() {
    clearTimeout(S.saveTimer);
    if (!S.item || !S.dirty) return Promise.resolve();
    S.dirty = false;
    S.item.meta = S.item.meta || {};
    S.item.meta.openTabs = S.tabs.slice(0, 30);
    S.item.meta.activeFile = S.active;
    var copy = JSON.parse(JSON.stringify(S.item));
    return Store.put(copy).then(function (saved) {
      if (saved && saved.updatedAt) S.item.updatedAt = saved.updatedAt;
      S.lastSaveAt = Date.now();
      renderTabs(); A.renderStatus();
      if (A.side) A.side.onSaved();
    }, function (e) { S.dirty = true; U.toast("Không lưu được: " + (e && e.message ? e.message : e), "bad"); });
  }
  A.saveNow = saveNow;

  function openItem(item, opts) {
    return saveNow().then(function () {
      if (!item) { S.item = null; S.tabs = []; S.active = null; renderAll(); return; }
      S.item = JSON.parse(JSON.stringify(item));
      S.item.meta = S.item.meta || {};
      S.views = {}; S.diags = []; S.lastResult = null;
      var paths = S.item.files.map(function (f) { return f.path; });
      S.tabs = (S.item.meta.openTabs || []).filter(function (p) { return paths.indexOf(p) >= 0; });
      var act = S.item.meta.activeFile && paths.indexOf(S.item.meta.activeFile) >= 0 ? S.item.meta.activeFile : (mainFile() || paths[0]);
      if (act && S.tabs.indexOf(act) < 0) S.tabs.unshift(act);
      S.settings.lastItemId = S.item.id; saveSettings();
      S.active = null;
      renderAll();
      if (act) showFile(act);
      if (!(opts && opts.keepSide) && root.innerWidth <= 760) closeDrawer();
    });
  }
  A.openItem = openItem;
  function showFile(path, line, col) {
    if (!fileOf(path)) return;
    if (S.active && fileOf(S.active)) { var sel = ed.getSelection(); S.views[S.active] = { s: sel.start, e: sel.end, top: ed.textarea.scrollTop }; }
    S.active = path;
    if (S.tabs.indexOf(path) < 0) S.tabs.push(path);
    var f = fileOf(path), lang = langOf(path);
    ed.setLang(lang);
    ed.setOptions({ indentUnit: indentFor(lang) });
    ed.setValue(f.content);
    var v = S.views[path];
    if (v) { ed.textarea.setSelectionRange(v.s, v.e); ed.textarea.scrollTop = v.top; ed.refresh(); }
    ed.setMarkers(S.diags.filter(function (d) { return sameFile(d.file, path); }));
    els.empty.hidden = true; els.edHost.hidden = false;
    hidePreview();
    if (line) ed.goTo(line, col || 1);
    renderTabs(); A.renderStatus();
    if (A.side) A.side.markActive();
    if (S.item) { S.item.meta.activeFile = path; }
  }
  A.showFile = showFile;
  function sameFile(a, b) { if (!a || !b) return !a && S.item && S.item.files.length === 1; a = String(a).replace(/\\/g, "/").replace(/^\.\//, ""); b = String(b); return a === b || a.split("/").pop() === b.split("/").pop() && (a.indexOf("/") < 0 || b.indexOf("/") < 0 || a.slice(-b.length) === b || b.slice(-a.length) === a); }
  A.sameFile = sameFile;
  function closeTab(path) {
    var i = S.tabs.indexOf(path); if (i < 0) return;
    S.tabs.splice(i, 1);
    delete S.views[path];
    if (S.active === path) { var nx = S.tabs[Math.min(i, S.tabs.length - 1)]; if (nx) showFile(nx); else { S.active = null; renderEmpty(); } }
    renderTabs(); markDirty();
  }
  A.closeTab = closeTab;

  /* ------------------------------------------------------------------ vẽ */
  function renderAll() {
    els.title.value = S.item ? S.item.name : "";
    els.title.disabled = !S.item;
    els.kind.textContent = S.item ? (S.item.kind === "project" ? "Dự án · " + S.item.files.length + " tệp" : "Đoạn mã") : "";
    renderTabs(); renderTargets(); A.renderStatus(); A.renderPanel();
    if (A.side) A.side.render();
    if (!S.item) renderEmpty();
  }
  A.renderAll = renderAll;
  function renderEmpty() {
    els.edHost.hidden = !!S.item && !!S.active;
    els.empty.hidden = !!(S.item && S.active);
    if (!els.empty.hidden) {
      els.empty.innerHTML = "";
      els.empty.appendChild(h("div", {}, [
        h("h2", { text: S.item ? "Chưa mở tệp nào" : "Chào mừng tới Code Studio" }),
        h("p", { text: S.item ? "Chọn một tệp ở thanh bên, hoặc tạo tệp mới." : "Soạn, định dạng, chạy mã C/C++, Java, Python, JavaScript… ngay trong trình duyệt hoặc trên máy chủ." }),
        h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn pri", text: "Đoạn mã mới", onclick: function () { A.cmd("new-snippet"); } }),
          h("button", { type: "button", class: "btn", text: "Dự án mới", onclick: function () { A.cmd("new-project"); } }),
          h("button", { type: "button", class: "btn", text: "Mở thư viện", onclick: function () { A.showSide("library", true); } }),
          h("button", { type: "button", class: "btn", text: "Nhập .zip / tệp", onclick: function () { A.cmd("import"); } })
        ])
      ]));
    }
  }
  function renderTabs() {
    var box = els.tabs; box.innerHTML = "";
    if (!S.item) return;
    var main = mainFile(), dirty = S.dirty;
    S.tabs.forEach(function (p) {
      var name = p.split("/").pop(), lang = langOf(p);
      var t = h("div", { class: "cs-tab", role: "tab", tabindex: "0", "aria-selected": String(p === S.active), title: p, "data-path": p }, [
        h("span", { class: "fi " + lang, text: (CS.langs.get(lang).exts[0] || "").slice(0, 3).toUpperCase() }),
        h("span", { text: name }),
        p === main && S.item.files.length > 1 ? h("span", { class: "main", title: "Tệp chính khi chạy", text: "▶" }) : null,
        dirty && p === S.active ? h("span", { class: "dot", title: "Chưa lưu" }) : null,
        h("button", { type: "button", class: "x", "aria-label": "Đóng " + name, title: "Đóng (Ctrl+W)", text: "✕", onclick: function (e) { e.stopPropagation(); closeTab(p); } })
      ]);
      t.addEventListener("click", function () { if (p !== S.active) showFile(p); });
      t.addEventListener("auxclick", function (e) { if (e.button === 1) closeTab(p); });
      t.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showFile(p); } });
      box.appendChild(t);
    });
    var on = box.querySelector('[aria-selected="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  A.renderTabs = renderTabs;

  /* ------------------------------------------------------------------ nơi chạy */
  var TARGET_LABEL = { browser: "Trình duyệt", "piston-custom": "Piston của bạn" };
  function targetsFor(lang) {
    var out = [], L = lang || "plaintext";
    if (CS.runner && CS.runner.targets) {
      try { (CS.runner.targets({ language: L, languages: [L], server: S.serverTargets || [], pistonUrl: S.settings.run.pistonUrl }) || []).forEach(function (t) { out.push(t); }); } catch (e) { /* bỏ qua */ }
    }
    if (!out.length) {
      if (/^(javascript|python|c|cpp)$/.test(L)) out.push({ id: "browser", label: "Trong trình duyệt", available: true });
      (S.serverTargets || []).forEach(function (p) { out.push({ id: "server:" + p.id, label: "Máy chủ · " + p.label, available: p.available && p.languages.indexOf(L) >= 0, reason: p.reason }); });
      out.push({ id: "piston-custom", label: "Piston của bạn (URL)", available: !!S.settings.run.pistonUrl });
    }
    if (L === "html") out = [{ id: "preview", label: "Xem trước (trình duyệt)", available: true }];
    return out;
  }
  A.targetsFor = targetsFor;
  function currentTarget(lang) {
    var list = targetsFor(lang), want = S.settings.run.target[lang];
    var hit = list.filter(function (t) { return t.id === want && t.available !== false; })[0];
    return hit || list.filter(function (t) { return t.available !== false; })[0] || list[0] || null;
  }
  A.currentTarget = currentTarget;
  function renderTargets() {
    var lang = runLang(), list = targetsFor(lang), cur = currentTarget(lang), sel = els.target;
    sel.innerHTML = "";
    list.forEach(function (t) { sel.appendChild(h("option", { value: t.id, text: (t.label || t.id) + (t.available === false ? " — không dùng được" : ""), disabled: t.available === false ? true : null })); });
    if (cur) sel.value = cur.id;
    sel.disabled = !S.item || !list.length;
  }
  A.renderTargets = renderTargets;
  function loadServerTargets() {
    if (!API) { S.serverTargets = []; return Promise.resolve(); }
    var p = CS.runner && CS.runner.loadServerProviders ? CS.runner.loadServerProviders(API, { fetch: root.fetch.bind(root) }) :
      root.fetch(API + "/run/providers").then(function (r) { return r.ok ? r.json() : { providers: [] }; }).then(function (j) { return j.providers || []; });
    return Promise.resolve(p).then(function (list) { S.serverTargets = Array.isArray(list) ? list : (list && list.providers) || []; renderTargets(); A.renderStatus(); }, function () { S.serverTargets = []; });
  }
  A.loadServerTargets = loadServerTargets;

  /* ------------------------------------------------------------------ chạy */
  function runNow() {
    if (!S.item || S.running) return;
    var lang = runLang(), tgt = currentTarget(lang);
    if (!lang || !tgt) { U.toast("Chưa chọn được nơi chạy cho ngôn ngữ này", "bad"); return; }
    if (tgt.id === "preview") { saveNow(); previewHtml(); return; }
    if (tgt.available === false) { U.toast(tgt.reason || "Nơi chạy này hiện không dùng được — chọn nơi khác ở hộp “Nơi chạy”.", "bad"); return; }
    saveNow();
    var meta = S.item.meta || {}, st = S.settings.run;
    var req;
    try {
      /* ngôn ngữ chạy theo tệp chính; chuẩn/tối ưu mặc định lấy từ cài đặt khi dự án chưa chọn riêng */
      var runItem = Object.assign({}, S.item, { language: lang, meta: Object.assign({}, meta, { std: meta.std || st.std[lang] || "", opt: meta.opt || st.opt }) });
      req = CS.project.toRunRequest(runItem, { mainFile: mainFile() });
    } catch (e) {
      /* ngôn ngữ không chạy được trên máy chủ (html, css, sql…) nhưng vẫn có thể chạy ở nơi chạy khác → dựng thân tối thiểu */
      req = { language: lang, files: S.item.files.map(function (f) { return { name: f.path, content: f.content }; }), mainFile: mainFile(), compileArgs: [] };
    }
    req.target = tgt.id; req.language = req.language || lang;
    req.std = meta.std || st.std[lang]; req.opt = meta.opt || st.opt;
    req.stdin = meta.stdin || ""; req.args = meta.args || [];
    req.runTimeoutMs = meta.runTimeoutMs || st.runTimeoutMs;
    A.panel.startRun(tgt);
    var handle;
    try {
      handle = CS.runner.run(req, {
        apiBase: API, fetch: root.fetch.bind(root), pistonUrl: st.pistonUrl,
        adminKey: sessionGet("cs:adminKey"), adminSession: sessionGet("cs:adminSession"),
        confirmDownload: function (info) { return A.dialogs.confirmDownload(info); },
        onProgress: function (ev) { A.panel.progress(ev); }
      });
    } catch (e) { A.panel.failRun(e); return; }
    var promise = handle && handle.then ? handle : handle && handle.promise;
    S.running = { cancel: function () { if (handle && handle.cancel) handle.cancel(); else if (CS.runner.cancel) CS.runner.cancel(); } };
    setRunning(true);
    promise.then(function (res) {
      S.lastResult = res;
      setDiagnostics(res.diagnostics || []);
      A.panel.showResult(res);
    }, function (e) { A.panel.failRun(e); }).then(function () { S.running = null; setRunning(false); });
  }
  function stopRun() { if (S.running) { S.running.cancel(); S.running = null; setRunning(false); A.panel.cancelled(); } }
  function setRunning(b) { els.run.hidden = b; els.stop.hidden = !b; A.renderStatus(); }
  function setDiagnostics(list) {
    S.diags = (list || []).map(function (d) { return { file: d.file || "", line: d.line | 0, col: d.col | 0, severity: d.severity || "error", message: d.message || "" }; });
    if (S.active) ed.setMarkers(S.diags.filter(function (d) { return sameFile(d.file, S.active) || (!d.file && S.active === mainFile()); }));
    A.renderPanel();
    if (A.side) A.side.render();
    var first = S.diags.filter(function (d) { return d.severity === "error" && d.line; })[0];
    if (first) {
      var path = S.item && S.item.files.filter(function (f) { return sameFile(first.file, f.path); }).map(function (f) { return f.path; })[0];
      if (path && path !== S.active) showFile(path, first.line, first.col);
      else if (path || !first.file) ed.goTo(first.line, first.col || 1);
    }
  }
  A.setDiagnostics = setDiagnostics;
  function sessionGet(k) { try { return root.sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }

  /* xem trước HTML: ghép css/js của dự án vào srcdoc, chạy trong iframe sandbox (không cùng origin với trang) */
  function previewHtml() {
    var main = mainFile(), f = fileOf(main);
    if (!f) return;
    var html = f.content.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, function (m, href) { var c = fileOf(resolveRel(main, href)); return c ? "<style>\n" + c.content + "\n</style>" : m; })
      .replace(/<script\b([^>]*)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi, function (m, a, src, b) { var c = fileOf(resolveRel(main, src)); return c ? "<script" + a + b + ">\n" + c.content.replace(/<\/script/gi, "<\\/script") + "\n</script>" : m; });
    var fr = els.edwrap.querySelector(".cs-preview");
    if (!fr) { fr = h("iframe", { class: "cs-preview", title: "Xem trước HTML", sandbox: "allow-scripts allow-modals allow-forms" }); els.edwrap.appendChild(fr); }
    fr.srcdoc = html;
    els.edHost.hidden = true; fr.hidden = false;
    A.panel.note("Đang xem trước " + main + ". Bấm vào một thẻ tệp để quay lại soạn.");
  }
  function hidePreview() { var fr = els.edwrap.querySelector(".cs-preview"); if (fr) fr.hidden = true; }
  function resolveRel(base, rel) {
    if (/^(https?:)?\/\//.test(rel)) return "";
    var parts = base.split("/"); parts.pop();
    rel.split("/").forEach(function (seg) { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); });
    return parts.join("/");
  }

  /* ------------------------------------------------------------------ định dạng */
  function formatOpts(lang) {
    var f = S.settings.format, ind = S.settings.indent;
    return { provider: f.provider[lang] || "builtin", indent: ind === "auto" ? undefined : (ind === "tab" ? "tab" : ind | 0), braces: f.braces, pointer: f.pointer,
      keepOneLiners: f.keepOneLiners, clangStyle: f.clangStyle, columnLimit: f.columnLimit };
  }
  A.formatOpts = formatOpts;
  function formatNow(quiet) {
    if (!S.active) return Promise.resolve();
    var lang = langOf(S.active), o = formatOpts(lang), before = ed.getValue();
    return CS.format.run(before, lang, o).then(function (r) {
      if (ed.getValue() !== before) return;                                   /* người dùng gõ tiếp trong lúc chờ — bỏ kết quả */
      if (r.ok && r.text !== before) { ed.replaceAllText(r.text); if (!quiet) U.toast("Đã định dạng" + (r.provider !== "builtin" ? " bằng " + (CS.format.providers[r.provider] || {}).label : ""), "ok"); }
      else if (r.ok && !quiet) U.toast("Mã đã gọn — không có gì để đổi");
      if (r.error) U.toast(r.error, r.ok ? "" : "bad");
    });
  }

  /* ------------------------------------------------------------------ lệnh */
  var NO_WAIT = { drawer: 1, sidebar: 1, panel: 1, "panel-max": 1, theme: 1, help: 1, "clear-output": 1, find: 1, replace: 1, goto: 1, wrap: 1, "zoom-in": 1, "zoom-out": 1, comment: 1, suggest: 1 };
  A.cmd = function (name, el) {
    if (!A.booted && A.ready && !NO_WAIT[name]) return A.ready.then(function () { return A.cmd(name, el); });
    switch (name) {
      case "run": return runNow();
      case "stop": return stopRun();
      case "save": return (S.settings.formatOnSave ? formatNow(true) : Promise.resolve()).then(function () { S.dirty = true; return saveNow(); }).then(function () { U.toast("Đã lưu" + (Store.connected() ? " · đang đồng bộ" : " trên máy này"), "ok", 1600); });
      case "format": return formatNow(false);
      case "drawer": return els.work.classList.toggle("drawer");
      case "library": return A.showSide("library", true);
      case "panel": S.settings.panelOpen = !S.settings.panelOpen; saveSettings(); return applyLayout();
      case "panel-max": S.settings.panelOpen = true; S.settings.panelH = S.settings.panelH > root.innerHeight * 0.6 ? 230 : Math.round(root.innerHeight * 0.7); saveSettings(); return applyLayout();
      case "sidebar": S.settings.sideOpen = !S.settings.sideOpen; saveSettings(); return applyLayout();
      case "clear-output": return A.panel.clear();
      case "find": return ed.openFind("find");
      case "replace": return ed.openFind("replace");
      case "goto": return ed.openFind("goto");
      case "wrap": ed.setOptions({ wrap: !ed.getOptions().wrap }); S.settings.wrap = ed.getOptions().wrap; saveSettings(); return A.renderStatus();
      case "zoom-in": S.settings.fontSize = Math.min(32, S.settings.fontSize + 1); ed.setOptions({ fontSize: S.settings.fontSize }); return saveSettings();
      case "zoom-out": S.settings.fontSize = Math.max(9, S.settings.fontSize - 1); ed.setOptions({ fontSize: S.settings.fontSize }); return saveSettings();
      case "theme": S.settings.theme = { auto: "dark", dark: "light", light: "auto" }[S.settings.theme] || "auto"; applyTheme(); saveSettings(); return U.toast("Giao diện: " + { auto: "theo hệ thống", dark: "tối", light: "sáng" }[S.settings.theme]);
      case "close-tab": return S.active && closeTab(S.active);
      case "next-tab": case "prev-tab": if (S.tabs.length > 1) { var i = S.tabs.indexOf(S.active), n = S.tabs.length; showFile(S.tabs[(i + (name === "next-tab" ? 1 : -1) + n) % n]); } return;
      case "comment": return ed.toggleComment();
      case "suggest": return ed.suggest();
      case "more": return A.dialogs.moreMenu(el);
      default:
        if (A.dialogs && A.dialogs.has(name)) return A.dialogs.run(name, el);
        if (A.side && A.side.has(name)) return A.side.run(name, el);
    }
  };
  A.showSide = function (name, toggle) {
    var st = S.settings;
    if (toggle && st.sideOpen && st.side === name && root.innerWidth > 760) st.sideOpen = false;
    else { st.side = name; st.sideOpen = true; }
    if (root.innerWidth <= 760) els.work.classList.add("drawer");
    saveSettings(); applyLayout();
    if (A.side) A.side.render();
  };
  function closeDrawer() { els.work.classList.remove("drawer"); }
  A.closeDrawer = closeDrawer;
  A.showPanel = function (tab) {
    S.settings.panelTab = tab; S.settings.panelOpen = true; saveSettings(); applyLayout(); A.renderPanel();
  };

  /* ------------------------------------------------------------------ thanh trạng thái */
  function renderCursor() {
    var c = S.cursor, el = els.status.querySelector("[data-st=pos]");
    if (el && c) el.textContent = "Dòng " + c.line + ", Cột " + c.col + (c.selected ? " (đã chọn " + c.selected + ")" : "");
  }
  A.renderStatus = function () {
    var st = els.status; if (!st) return;
    st.innerHTML = "";
    var lang = S.active ? langOf(S.active) : null, L = lang ? CS.langs.get(lang) : null, ind = lang ? indentFor(lang) : "";
    var tgt = S.item ? currentTarget(runLang()) : null, sy = Store.syncStatus();
    function b(attrs, text) { attrs.type = "button"; attrs.text = text; st.appendChild(h("button", attrs)); }
    b({ "data-cmd": "sidebar", title: "Ẩn/hiện thanh bên (Ctrl+B)" }, "☰");
    if (S.running) st.appendChild(h("span", { text: "⏳ Đang chạy…" }));
    if (sy) b({ "data-cmd": "sync", title: sy.error || "Đồng bộ ngay" }, (sy.status === "syncing" ? "⟳ Đang đồng bộ" : sy.status === "error" ? "⚠ Lỗi đồng bộ" : sy.status === "offline" ? "⚠ Mất mạng" : "☁ Đã đồng bộ"));
    else b({ "data-cmd": "storage", title: "Nơi lưu: chỉ trên máy này — bấm để bật đồng bộ máy chủ" }, "💾 Máy này");
    st.appendChild(h("span", { class: "grow" }));
    if (S.cursor) st.appendChild(h("span", { "data-st": "pos" }));
    if (L) {
      b({ "data-cmd": "indent", title: "Thụt dòng" }, ind === "\t" ? "Tab" : "Dấu cách: " + ind.length);
      st.appendChild(h("span", { text: "UTF-8" }));
      b({ "data-cmd": "formatter", title: "Bộ định dạng cho " + L.name }, "Định dạng: " + ((CS.format.providers[formatOpts(lang).provider] || {}).label || "Tự viết").replace(/ \(.*$/, ""));
      b({ "data-cmd": "language", title: "Ngôn ngữ của tệp (theo đuôi tệp)" }, L.name);
    }
    if (tgt) b({ "data-cmd": "target", title: "Nơi chạy" }, "▶ " + (tgt.label || tgt.id));
    renderCursor();
  };

  /* ------------------------------------------------------------------ phím tắt toàn cục */
  function bindKeys() {
    D().addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey, k = e.key, inEd = e.target === ed.textarea;
      if (k === "F5" && !mod) { e.preventDefault(); A.cmd(e.shiftKey ? "stop" : "run"); return; }
      if (mod && k === "Enter" && !inEd) { e.preventDefault(); A.cmd("run"); return; }
      if (mod && e.shiftKey && (k === "P" || k === "p")) { e.preventDefault(); A.cmd("palette"); return; }
      if (k === "F1") { e.preventDefault(); A.cmd("help"); return; }
      if (mod && !e.shiftKey && (k === "p" || k === "P")) { e.preventDefault(); A.cmd("quick-open"); return; }
      if (mod && !e.shiftKey && (k === "b" || k === "B")) { e.preventDefault(); A.cmd("sidebar"); return; }
      if (mod && !e.shiftKey && (k === "j" || k === "J")) { e.preventDefault(); A.cmd("panel"); return; }
      if (mod && k === ",") { e.preventDefault(); A.cmd("settings"); return; }
      if (mod && !e.shiftKey && (k === "o" || k === "O")) { e.preventDefault(); A.showSide("library"); return; }
      if (mod && e.shiftKey && (k === "E" || k === "e")) { e.preventDefault(); A.showSide("explorer"); return; }
      if (mod && e.shiftKey && (k === "F" || k === "f")) { e.preventDefault(); A.showSide("search"); setTimeout(function () { var i = $(".cs-side input[type=search]"); if (i) i.focus(); }, 0); return; }
      if (mod && e.altKey && (k === "n" || k === "N")) { e.preventDefault(); A.cmd("new-file"); return; }
      if (mod && !e.altKey && !e.shiftKey && (k === "n" || k === "N") && !inEd) { e.preventDefault(); A.cmd("new-snippet"); return; }
      if (mod && !e.shiftKey && (k === "w" || k === "W") && S.active) { e.preventDefault(); A.cmd("close-tab"); return; }
      if (mod && k === "Tab") { e.preventDefault(); A.cmd(e.shiftKey ? "prev-tab" : "next-tab"); return; }
      if (mod && !e.shiftKey && (k === "s" || k === "S") && !inEd) { e.preventDefault(); A.cmd("save"); return; }
      if (e.shiftKey && e.altKey && (k === "F" || k === "f" || e.code === "KeyF") && !inEd) { e.preventDefault(); A.cmd("format"); return; }
      if (k === "Escape" && els.work.classList.contains("drawer")) closeDrawer();
    });
    root.addEventListener("beforeunload", function (e) { if (S.dirty) { saveNow(); } });
    D().addEventListener("visibilitychange", function () { if (D().visibilityState === "hidden") saveNow(); });
    root.addEventListener("resize", U.debounce(function () { applyLayout(); }, 150));
  }

  /* ------------------------------------------------------------------ khởi động */
  function boot() {
    S.settings = merge(DEF, U.lsGet("cs:settings", {}));
    applyTheme();
    build();
    initEditor();
    if (A.panel) A.panel.init();
    if (A.side) A.side.init();
    if (A.dialogs) A.dialogs.init();
    CS.format.confirmDownload = function (p) { return A.dialogs.confirmDownload({ what: p.label, size: p.needsDownload, note: p.note }); };
    bindKeys();
    applyLayout();
    A.renderStatus();
    /* A.ready: khởi động xong (kho đã dựng, đoạn mã đầu tiên đã mở). Lệnh bấm sớm hơn thế sẽ chờ — kho/đồng bộ chưa có thì chưa làm được gì */
    A.ready = Store.init().then(function () {
      return Store.list();
    }).then(function (items) {
      var params = new URLSearchParams(root.location.search || "");
      var want = params.get("item") || S.settings.lastItemId;
      var it = items.filter(function (x) { return x.id === want; })[0];
      if (it) return openItem(it);
      if (!items.length) return A.dialogs.firstRun();
      renderAll();
      A.showSide("library");
    }).catch(function (e) {
      U.toast("Không mở được kho lưu trên máy: " + (e && e.message ? e.message : e), "bad");
      renderAll();
    }).then(function () { A.booted = true; loadServerTargets(); if (Store.connected()) Store.kick(); });
  }
  A.boot = boot;
  if (D().readyState === "loading") D().addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
})(window);
