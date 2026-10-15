/* dialogs.js — hộp thoại & bảng lệnh của Code Studio: tạo mới (đoạn mã / dự án theo mẫu), cài đặt, nơi lưu & đồng bộ,
   bảng lệnh (Ctrl+Shift+P), mở nhanh tệp (Ctrl+P), trợ giúp phím tắt (F1), nhập/xuất (.zip, tệp, sao lưu .json), các bộ chọn ở thanh trạng thái.
   Gắn vào CS.app.dialogs. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app;
  function S() { return A.S; }
  function save() { U.lsSet("cs:settings", S().settings); }
  function newId() { return CS.project && CS.project.newId ? CS.project.newId() : "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ================================================================ tạo mới */
  function makeSnippet(lang, name) {
    var L = CS.langs.get(lang);
    if (CS.project && CS.project.createSnippet) return CS.project.createSnippet({ name: name, language: lang, content: L.hello });
    return { id: newId(), kind: "snippet", name: name, language: lang, files: [{ path: L.file, content: L.hello }], meta: {}, updatedAt: 0, deleted: false };
  }
  function newSnippet() {
    var langSel = h("select", { class: "sel", "aria-label": "Ngôn ngữ", style: { maxWidth: "100%" } }, CS.langs.list().map(function (l) { return h("option", { value: l.id, text: l.name }); }));
    langSel.value = (S().item && S().item.language) || "cpp";
    var name = h("input", { class: "inp", type: "text", placeholder: "vd Sắp xếp nổi bọt", "aria-label": "Tên đoạn mã" });
    return U.dialog({ title: "Đoạn mã mới", body: h("div", { class: "cs-grid2" }, [h("label", { class: "fld" }, [h("span", { text: "Ngôn ngữ" }), langSel]), h("label", { class: "fld" }, [h("span", { text: "Tên" }), name])]),
      actions: [{ label: "Huỷ", value: null }, { label: "Tạo", value: "ok", primary: true }] }).then(function (v) {
      if (v !== "ok") return;
      var lang = langSel.value, it = makeSnippet(lang, name.value.trim() || (CS.langs.get(lang).name + " — " + U.fmtTime(Date.now())));
      return A.Store.put(it).then(function (saved) { A.openItem(saved || it); if (A.side) A.side.reloadLibrary(); });
    });
  }
  function templates() {
    if (CS.project && CS.project.templates) return CS.project.templates;
    return CS.langs.list().filter(function (l) { return l.hello; }).map(function (l) { return { id: l.id, label: l.name, language: l.id, description: "Một tệp " + l.file, files: [{ path: l.file, content: l.hello }] }; });
  }
  function newProject() {
    var tpls = templates(), chosen = tpls[0];
    var grid = h("div", { class: "cs-tpl", role: "radiogroup", "aria-label": "Mẫu dự án" });
    tpls.forEach(function (t) {
      var b = h("button", { type: "button", role: "radio", "aria-pressed": String(t === chosen), "aria-checked": String(t === chosen) }, [h("b", { text: t.label || t.name || t.id }), h("span", { text: t.description || t.desc || ((t.files || []).length + " tệp") })]);
      b.addEventListener("click", function () { chosen = t; U.$$("button", grid).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); x.setAttribute("aria-checked", String(x === b)); }); if (!name.value) name.placeholder = t.label || t.id; });
      grid.appendChild(b);
    });
    var name = h("input", { class: "inp", type: "text", placeholder: (chosen && (chosen.label || chosen.id)) || "Dự án", "aria-label": "Tên dự án" });
    return U.dialog({ title: "Dự án mới", wide: true, body: h("div", {}, [h("label", { class: "fld" }, [h("span", { text: "Tên dự án" }), name]), h("p", { class: "cs-note", text: "Chọn mẫu — có sẵn tệp chạy được ngay, bạn sửa tiếp:" }), grid]),
      actions: [{ label: "Huỷ", value: null }, { label: "Tạo dự án", value: "ok", primary: true }] }).then(function (v) {
      if (v !== "ok" || !chosen) return;
      var nm = name.value.trim() || chosen.label || "Dự án", it;
      if (CS.project && CS.project.createProject) it = CS.project.createProject({ name: nm, language: chosen.language, template: chosen.id });
      else it = { id: newId(), kind: "project", name: nm, language: chosen.language, files: JSON.parse(JSON.stringify(chosen.files)), meta: {}, updatedAt: 0, deleted: false };
      return A.Store.put(it).then(function (saved) { A.openItem(saved || it); A.showSide("explorer"); });
    });
  }
  function firstRun() {
    var it = makeSnippet("cpp", "Chào Code Studio (C++)");
    return A.Store.put(it).then(function (saved) {
      A.openItem(saved || it);
      U.toast("Mẹo: Ctrl+Enter để chạy, Shift+Alt+F để định dạng, Ctrl+Space để gợi ý, F1 xem mọi phím tắt.", "", 8000);
    });
  }

  /* ================================================================ nhập / xuất */
  function importAny() {
    return U.pickFiles(".zip,.json,.c,.cpp,.cc,.h,.hpp,.java,.py,.js,.ts,.cs,.go,.rs,.kt,.php,.rb,.sh,.sql,.html,.css,.md,.txt", true).then(function (fs) {
      if (!fs.length) return;
      var z = fs.filter(function (f) { return /\.zip$/i.test(f.name); })[0], j = fs.filter(function (f) { return /\.json$/i.test(f.name); })[0];
      if (z) return importZip(z);
      if (j && fs.length === 1) return U.readText(j).then(function (t) {
        if (/^\s*\{/.test(t) && /"items"|"version"/.test(t.slice(0, 2000)) && CS.app.Store.lib.importJson) {
          return Promise.resolve(A.Store.lib.importJson(t, { mode: "merge" })).then(function (r) { U.toast("Đã khôi phục từ bản sao lưu" + (r && r.imported != null ? ": " + r.imported + " mục" : ""), "ok"); if (A.side) A.side.reloadLibrary(); A.Store.kick(); });
        }
        return importLoose(fs);
      }).catch(function (e) { U.toast("Không đọc được bản sao lưu: " + e.message, "bad"); });
      return importLoose(fs);
    });
  }
  function importLoose(fs) {
    return Promise.all(fs.map(function (f) { return U.readText(f).then(function (t) { return { path: f.name, content: t }; }); })).then(function (files) {
      var lang = CS.langs.byFilename(files[0].path), it;
      if (files.length === 1) { it = makeSnippet(lang, files[0].path); it.files = [{ path: files[0].path, content: files[0].content }]; }
      else it = { id: newId(), kind: "project", name: "Dự án nhập " + U.fmtTime(Date.now()), language: lang, files: files, meta: {}, updatedAt: 0, deleted: false };
      return A.Store.put(it).then(function (saved) { A.openItem(saved || it); U.toast("Đã nhập " + files.length + " tệp", "ok"); });
    });
  }
  function importZip(file) {
    if (!CS.zip) { U.toast("Chưa có mô-đun đọc .zip", "bad"); return Promise.resolve(); }
    return U.readBytes(file).then(function (bytes) { return CS.zip.read(bytes); }).then(function (res) {
      var entries = Array.isArray(res) ? res : (res.entries || res.files || []);
      var it = CS.zip.zipToProject ? CS.zip.zipToProject(entries, { name: file.name.replace(/\.zip$/i, "") }) : null;
      if (!it) throw new Error("tệp zip không có tệp mã nào dùng được");
      return A.Store.put(it).then(function (saved) {
        A.openItem(saved || it); A.showSide("explorer");
        var skipped = (it.meta && it.meta.skippedTotal) || (res && res.skipped && res.skipped.length) || 0;
        U.toast("Đã nhập dự án " + it.files.length + " tệp" + (skipped ? " (bỏ qua " + skipped + " mục)" : ""), "ok");
      });
    }).catch(function (e) { U.toast("Không nhập được .zip: " + (e && e.message ? e.message : e), "bad"); });
  }
  function exportZip(item) {
    item = item || S().item;
    if (!item) return;
    var src = S().item && S().item.id === item.id ? S().item : item;
    if (!CS.zip) { U.toast("Chưa có mô-đun tạo .zip", "bad"); return; }
    var bytes = CS.zip.projectToZip ? CS.zip.projectToZip(src) : CS.zip.create(src.files.map(function (f) { return { path: f.path, content: f.content }; }));
    U.download((src.name || "du-an").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) + ".zip", new Blob([bytes], { type: "application/zip" }));
  }
  function exportAll() {
    Promise.resolve(A.Store.lib.exportJson ? A.Store.lib.exportJson() : A.Store.list().then(function (x) { return JSON.stringify({ version: 1, items: x }, null, 1); })).then(function (json) {
      U.download("code-studio-sao-luu-" + new Date().toISOString().slice(0, 10) + ".json", json, "application/json");
    });
  }

  /* ================================================================ tải bộ chạy / bộ định dạng (hỏi trước) */
  var okOnce = {};
  function confirmDownload(info) {
    info = info || {};
    var key = info.what || info.label || info.id || "?";
    if (okOnce[key] || U.lsGet("cs:dl-ok:" + key, false)) return Promise.resolve(true);
    var remember = h("input", { type: "checkbox", checked: true });
    return U.dialog({ title: "Tải " + key + "?", body: h("div", {}, [
      h("p", { text: "Lần đầu dùng cần tải " + key + (info.size ? " (" + info.size + ")" : "") + " từ cdn.jsdelivr.net. Sau đó trình duyệt giữ lại, lần sau dùng ngay (cả khi không mạng nếu là bộ chạy)." }),
      info.note ? h("p", { class: "cs-note", text: info.note }) : null,
      h("p", { class: "cs-note", text: "Mã nguồn của bạn không bị gửi đi — chỉ tải tệp của công cụ về." }),
      h("label", { class: "cs-chk" }, [remember, h("span", { text: "Không hỏi lại" })])
    ]), actions: [{ label: "Để sau", value: false }, { label: "Tải", value: true, primary: true }] }).then(function (v) {
      if (v === true) { okOnce[key] = true; if (remember.checked) U.lsSet("cs:dl-ok:" + key, true); }
      return v === true;
    });
  }

  /* ================================================================ cài đặt */
  function openSettings(tab) {
    var st = S().settings, f = st.format;
    function sel(label, value, opts, onchange, help) {
      var s = h("select", { class: "sel", "aria-label": label, style: { maxWidth: "100%" } }, opts.map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      s.value = String(value);
      s.addEventListener("change", function () { onchange(s.value); save(); A.renderStatus(); });
      return h("label", { class: "fld" }, [h("span", { text: label }), s, help ? h("span", { class: "cs-note", text: help }) : null]);
    }
    function chk(label, value, onchange) {
      var c = h("input", { type: "checkbox" }); c.checked = !!value;
      c.addEventListener("change", function () { onchange(c.checked); save(); });
      return h("label", { class: "cs-chk" }, [c, h("span", { text: label })]);
    }
    var ed = A.ed;
    var editorSec = h("section", { class: "cs-sect" }, [h("h3", { text: "Trình soạn" }), h("div", { class: "cs-grid2" }, [
      sel("Giao diện", st.theme, [["auto", "Theo hệ thống"], ["light", "Sáng"], ["dark", "Tối"]], function (v) { st.theme = v; if (v === "auto") root.document.documentElement.removeAttribute("data-theme"); else root.document.documentElement.setAttribute("data-theme", v); }),
      sel("Cỡ chữ", st.fontSize, [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map(function (n) { return [String(n), n + " px"]; }), function (v) { st.fontSize = +v; ed.setOptions({ fontSize: st.fontSize }); }),
      sel("Thụt dòng", st.indent, [["auto", "Theo ngôn ngữ (C++ 4, JS 2, Go tab…)"], ["2", "2 dấu cách"], ["4", "4 dấu cách"], ["8", "8 dấu cách"], ["tab", "Tab"]], function (v) { st.indent = v === "tab" || v === "auto" ? v : +v; if (S().active) A.showFile(S().active); }),
      h("div", { style: { display: "grid", gap: "6px", alignContent: "start" } }, [
        chk("Ngắt dòng mềm (Alt+Z)", st.wrap, function (v) { st.wrap = v; ed.setOptions({ wrap: v }); }),
        chk("Tự đóng ngoặc và nháy", st.autoClose, function (v) { st.autoClose = v; ed.setOptions({ autoClose: v }); }),
        chk("Gợi ý khi gõ (Ctrl+Space để gọi)", st.completion, function (v) { st.completion = v; ed.setOptions({ completion: v }); }),
        chk("Tô các chỗ trùng từ dưới con trỏ", st.occurrences, function (v) { st.occurrences = v; ed.setOptions({ occurrences: v }); })
      ])
    ])]);
    /* định dạng: chọn bộ định dạng theo từng ngôn ngữ */
    var provRows = h("div", { class: "cs-grid2" });
    CS.langs.list().forEach(function (l) {
      var list = CS.format.listFor(l.id);
      if (list.length < 2 && l.family === "plain") return;
      provRows.appendChild(sel(l.name, f.provider[l.id] || "builtin", list.map(function (p) { return [p.id, p.label + (p.needsDownload ? " — tải " + p.needsDownload : "")]; }), function (v) { f.provider[l.id] = v; }));
    });
    var fmtSec = h("section", { class: "cs-sect" }, [h("h3", { text: "Định dạng mã (Shift+Alt+F)" }),
      h("p", { class: "cs-note", text: "“Tự viết” chạy tức thì, không cần mạng, giữ nguyên từ tố (chỉ đổi khoảng trắng/ngắt dòng). clang-format / Prettier / Ruff là công cụ chuẩn, tải về một lần khi dùng lần đầu." }),
      h("div", { class: "cs-grid2" }, [
        sel("Kiểu ngoặc nhọn", f.braces, [["kr", "K&R — { cùng dòng"], ["allman", "Allman — { xuống dòng"]], function (v) { f.braces = v; }),
        sel("Con trỏ/tham chiếu (C/C++)", f.pointer, [["auto", "Tự suy theo tệp"], ["right", "int *p"], ["left", "int* p"], ["keep", "Giữ như cũ"]], function (v) { f.pointer = v; }),
        sel("Kiểu clang-format", f.clangStyle, ["Google", "LLVM", "Chromium", "Mozilla", "WebKit", "Microsoft", "GNU"].map(function (x) { return [x, x]; }), function (v) { f.clangStyle = v; }),
        sel("Độ rộng dòng (clang-format/Prettier/Ruff)", f.columnLimit, [[80, "80"], [100, "100"], [120, "120"]], function (v) { f.columnLimit = +v; }),
        chk("Giữ các dòng gọn một dòng (hàm/vòng lặp ngắn đã viết gọn)", f.keepOneLiners, function (v) { f.keepOneLiners = v; }),
        chk("Định dạng khi lưu (Ctrl+S)", st.formatOnSave, function (v) { st.formatOnSave = v; })
      ]),
      h("details", {}, [h("summary", { text: "Bộ định dạng theo từng ngôn ngữ" }), provRows])]);
    /* chạy mã */
    var piston = h("input", { class: "inp", type: "url", placeholder: "vd http://localhost:2000/api/v2", value: st.run.pistonUrl || "", "aria-label": "URL Piston của bạn" });
    piston.addEventListener("change", function () { st.run.pistonUrl = piston.value.trim().replace(/\/+$/, ""); save(); A.renderTargets(); });
    var adminKey = h("input", { class: "inp", type: "password", autocomplete: "off", placeholder: "chỉ cần cho “Máy chủ cục bộ”", "aria-label": "Khoá quản trị" });
    try { adminKey.value = root.sessionStorage.getItem("cs:adminKey") || ""; } catch (e) { /* bỏ qua */ }
    adminKey.addEventListener("change", function () { try { if (adminKey.value) root.sessionStorage.setItem("cs:adminKey", adminKey.value); else root.sessionStorage.removeItem("cs:adminKey"); } catch (e) { U.toast("Trình duyệt chặn lưu tạm — khoá chỉ dùng được trong phiên này", "bad"); } });
    var runRows = h("div", { class: "cs-grid2" });
    ["cpp", "c", "java", "python", "javascript", "typescript", "csharp", "go", "rust", "kotlin", "php", "ruby", "bash"].forEach(function (l) {
      var list = A.targetsFor(l);
      if (!list.length) return;
      var cur = A.currentTarget(l);
      runRows.appendChild(sel(CS.langs.get(l).name, cur ? cur.id : "", list.map(function (t) { return [t.id, (t.label || t.id) + (t.available === false ? " (không dùng được)" : "")]; }), function (v) { st.run.target[l] = v; A.renderTargets(); }));
    });
    var runSec = h("section", { class: "cs-sect" }, [h("h3", { text: "Chạy mã" }),
      h("p", { class: "cs-note", text: "Chọn nơi chạy cho từng ngôn ngữ: trong trình duyệt (tải bộ chạy về một lần, mã không rời máy), máy chủ (chuyển tới dịch vụ đã cấu hình: Piston, Judge0, Wandbox, hoặc trình biên dịch trên máy chạy backend), hay Piston bạn tự dựng." }),
      runRows,
      h("div", { class: "cs-grid2" }, [h("label", { class: "fld" }, [h("span", { text: "Piston của bạn (gọi thẳng từ trình duyệt, cần CORS)" }), piston]),
        h("label", { class: "fld" }, [h("span", { text: "Khoá quản trị (lưu tạm trong phiên, không gửi đi đâu khác)" }), adminKey])]),
      h("button", { type: "button", class: "btn sm", text: "Tải lại danh sách nơi chạy của máy chủ", onclick: function () { A.loadServerTargets().then(function () { U.toast("Đã tải lại", "ok"); }); } })
    ]);
    var stoSec = h("section", { class: "cs-sect" }, [h("h3", { text: "Nơi lưu & đồng bộ" }), h("p", { class: "cs-note", text: "Đang lưu: " + (A.Store.connected() ? "máy này + máy chủ (" + st.storage.backend + ")" : "chỉ trên máy này") + "." }),
      h("button", { type: "button", class: "btn sm", text: "Thiết lập nơi lưu & đồng bộ…", onclick: function () { storage(); } })]);
    return U.dialog({ title: "Cài đặt", wide: true, body: h("div", { style: { display: "grid", gap: "12px" } }, [editorSec, fmtSec, runSec, stoSec]), actions: [{ label: "Xong", value: null, primary: true }] }).then(function () {
      A.renderStatus(); A.renderTargets(); if (A.panel) A.renderPanel();
    });
  }

  /* ================================================================ nơi lưu & đồng bộ */
  function storage() {
    var st = S().settings, Store = A.Store;
    if (!A.API) {
      return U.dialog({ title: "Nơi lưu", body: h("div", {}, [h("p", { text: "Trang đang mở trực tiếp (file:// hoặc máy chủ tĩnh), không có máy chủ API — dữ liệu chỉ lưu trên máy này (IndexedDB/localStorage)." }), h("p", { class: "cs-note", text: "Muốn đồng bộ giữa các thiết bị, hãy mở Code Studio qua backend: /webapp/tranphuc8a/code-studio/." })]) });
    }
    var mode = h("select", { class: "sel", "aria-label": "Chế độ lưu", style: { maxWidth: "100%" } }, [h("option", { value: "local", text: "Chỉ trên máy này (localStorage / IndexedDB)" }), h("option", { value: "server", text: "Máy này + đồng bộ máy chủ" })]);
    mode.value = st.storage.mode;
    var back = h("select", { class: "sel", "aria-label": "Kho máy chủ", style: { maxWidth: "100%" } }, [h("option", { value: "json", text: "JSON (tệp trên máy chủ)" }), h("option", { value: "mysql", text: "MySQL" }), h("option", { value: "mongo", text: "MongoDB" })]);
    back.value = st.storage.backend;
    var info = h("div", { class: "cs-note", "aria-live": "polite", text: "Đang hỏi máy chủ…" });
    var wsIn = h("input", { class: "inp", type: "text", placeholder: "Mã không gian (cs_…)", "aria-label": "Mã không gian làm việc", spellcheck: "false" });
    var keyIn = h("input", { class: "inp", type: "password", placeholder: "Khoá bí mật", "aria-label": "Khoá bí mật", autocomplete: "off" });
    var cur = Store.sync && (Store.sync.workspaceId || (Store.sync.state && Store.sync.state.workspaceId));
    var status = h("p", { class: "cs-note", text: cur ? "Đang kết nối không gian " + cur + " (" + st.storage.backend + ")." : "Chưa kết nối không gian nào." });
    var body = h("div", { style: { display: "grid", gap: "10px" } }, [
      h("label", { class: "fld" }, [h("span", { text: "Chế độ" }), mode]),
      h("label", { class: "fld" }, [h("span", { text: "Kho trên máy chủ" }), back]), info, status,
      h("div", { class: "cs-sect" }, [h("h3", { text: "Kết nối không gian đã có (thiết bị khác)" }), h("div", { class: "cs-grid2" }, [wsIn, keyIn])]),
      h("p", { class: "cs-note", text: "Không có tài khoản: mỗi không gian là cặp mã + khoá bí mật (máy chủ chỉ giữ bản băm). Giữ khoá cẩn thận — mất khoá thì không đọc lại được; ai có khoá thì đọc/sửa được." })
    ]);
    function loadBackends() {
      var p = Store.sync && Store.sync.backends ? Store.sync.backends() : root.fetch(A.API + "/codestore/backends").then(function (r) { return r.json(); });
      Promise.resolve(p).then(function (j) {
        var list = (j && (j.backends || j)) || [];
        info.textContent = list.map(function (b) { return b.id + ": " + (b.available ? "dùng được" + (b.persistent === false ? " (tạm — mất khi máy chủ khởi động lại)" : "") : "không dùng được" + (b.reason ? " — " + b.reason : "")); }).join(" · ") || "Máy chủ không có kho nào.";
        U.$$("option", back).forEach(function (o) { var b = list.filter(function (x) { return x.id === o.value; })[0]; o.disabled = !!b && !b.available; });
      }, function () { info.textContent = "Không hỏi được máy chủ (mất mạng?)."; });
    }
    loadBackends();
    return U.dialog({ title: "Nơi lưu & đồng bộ", wide: true, body: body, actions: [
      { label: "Đóng", value: null },
      { label: "Ngắt kết nối", value: "disc", danger: true },
      { label: "Kết nối mã + khoá", value: "conn" },
      { label: "Tạo không gian mới", value: "new", primary: true }
    ] }).then(function (v) {
      var changed = st.storage.mode !== mode.value || st.storage.backend !== back.value;
      st.storage.mode = v === "new" || v === "conn" ? "server" : mode.value; st.storage.backend = back.value; save();
      var p = changed || v ? Store.initSync() : Promise.resolve();
      return p.then(function () {
        var sy = Store.sync;
        if (v === "disc") { if (sy && sy.disconnect) return Promise.resolve(sy.disconnect()).then(function () { st.storage.mode = "local"; save(); U.toast("Đã ngắt — dữ liệu vẫn còn trên máy này"); }); st.storage.mode = "local"; save(); return; }
        if (!sy) { if (v === "new" || v === "conn") U.toast("Chưa bật được đồng bộ (thiếu mô-đun hoặc máy chủ)", "bad"); return; }
        if (v === "new") return Promise.resolve(sy.createWorkspace()).then(function (r) { showKey(r || {}); return sy.syncNow(); });
        if (v === "conn") { if (!wsIn.value.trim() || !keyIn.value) { U.toast("Nhập đủ mã không gian và khoá", "bad"); return; } return Promise.resolve(sy.connect(wsIn.value.trim(), keyIn.value)).then(function () { return sy.syncNow(); }).then(function () { U.toast("Đã kết nối và đồng bộ", "ok"); }); }
      }).catch(function (e) { U.toast("Đồng bộ lỗi: " + (e && e.message ? e.message : e), "bad"); }).then(function () { A.renderStatus(); if (A.side) A.side.reloadLibrary(); });
    });
  }
  function showKey(r) {
    var text = "Mã không gian: " + (r.workspaceId || "?") + "\nKhoá bí mật: " + (r.key || "?");
    return U.dialog({ title: "Đã tạo không gian đồng bộ", body: h("div", {}, [
      h("p", { text: "Lưu lại cặp mã + khoá dưới đây để kết nối từ thiết bị khác. Khoá chỉ hiện MỘT lần." }),
      h("pre", { class: "cs-out", style: { background: "var(--bg2)", borderRadius: "8px" }, text: text })
    ]), actions: [{ label: "Chép", value: "copy" }, { label: "Đã lưu", value: null, primary: true }] }).then(function (v) { if (v === "copy") U.copy(text).then(function (ok) { U.toast(ok ? "Đã chép" : "Không chép được — hãy chép tay", ok ? "ok" : "bad"); }); });
  }
  function syncNow() {
    var sy = A.Store.sync;
    if (!sy || !A.Store.connected()) return storage();
    return Promise.resolve(sy.syncNow()).then(function (r) { U.toast("Đã đồng bộ" + (r && (r.pushed || r.pulled) ? " (gửi " + (r.pushed || 0) + ", nhận " + (r.pulled || 0) + ")" : ""), "ok"); if (A.side) A.side.reloadLibrary(); reopenIfChanged(); }, function (e) { U.toast("Đồng bộ lỗi: " + (e && e.message ? e.message : e), "bad"); }).then(function () { A.renderStatus(); });
  }
  function reopenIfChanged() {
    var it = S().item; if (!it || S().dirty) return;
    A.Store.get(it.id).then(function (x) { if (!x || x.deleted) { A.openItem(null); return; } if (x.updatedAt > it.updatedAt) A.openItem(x); });
  }

  /* ================================================================ bộ chọn ở thanh trạng thái */
  function pickIndent() {
    var cur = S().settings.indent;
    U.menu(U.$('[data-cmd="indent"]'), [["auto", "Theo ngôn ngữ"], [2, "2 dấu cách"], [4, "4 dấu cách"], ["tab", "Tab"]].map(function (o) {
      return { label: (String(cur) === String(o[0]) ? "✓ " : "   ") + o[1], onclick: function () { S().settings.indent = o[0]; save(); if (S().active) A.showFile(S().active); } };
    }));
  }
  function pickFormatter() {
    if (!S().active) return;
    var lang = A.langOf(S().active), f = S().settings.format, cur = f.provider[lang] || "builtin";
    U.menu(U.$('[data-cmd="formatter"]'), CS.format.listFor(lang).map(function (p) {
      return { label: (p.id === cur ? "✓ " : "   ") + p.label + (p.needsDownload ? " (tải " + p.needsDownload + ")" : ""), onclick: function () { f.provider[lang] = p.id; save(); A.renderStatus(); } };
    }).concat(["-", { label: "Định dạng ngay", kbd: "Shift+Alt+F", onclick: function () { A.cmd("format"); } }]));
  }
  function pickTarget() {
    var lang = A.runLang(); if (!lang) return;
    var cur = A.currentTarget(lang);
    U.menu(U.$('[data-cmd="target"]'), A.targetsFor(lang).map(function (t) {
      return { label: (cur && t.id === cur.id ? "✓ " : "   ") + (t.label || t.id), disabled: t.available === false, onclick: function () { S().settings.run.target[lang] = t.id; save(); A.renderTargets(); A.renderStatus(); A.renderPanel(); } };
    }));
  }
  function pickLanguage() {
    if (!S().active || !S().item) return;
    var path = S().active, base = path.replace(/\.[^./]+$/, "");
    U.menu(U.$('[data-cmd="language"]'), CS.langs.list().map(function (l) {
      return { label: l.name + " (." + l.exts[0] + ")", onclick: function () {
        var np = base + "." + l.exts[0];
        if (np === path) return;
        if (A.fileOf(np)) { U.toast("Đã có tệp " + np, "bad"); return; }
        if (S().item.kind === "snippet") { var f = A.fileOf(path); f.path = np; S().item.language = l.id; S().tabs = S().tabs.map(function (p) { return p === path ? np : p; }); S().active = np; A.markDirty(); A.renderAll(); A.showFile(np); }
        else U.toast("Đổi đuôi tệp bằng “Đổi tên” ở thanh Tệp (F2)");
      } };
    }));
  }

  /* ================================================================ bảng lệnh + mở nhanh */
  function commandList() {
    var C = function (id, label, kbd) { return { id: id, label: label, kbd: kbd || "" }; };
    return [C("run", "Chạy", "Ctrl+Enter"), C("stop", "Dừng chương trình", "Shift+F5"), C("format", "Định dạng tệp", "Shift+Alt+F"), C("save", "Lưu", "Ctrl+S"),
      C("new-snippet", "Đoạn mã mới", "Ctrl+N"), C("new-project", "Dự án mới"), C("new-file", "Tệp mới trong dự án", "Ctrl+Alt+N"), C("new-folder", "Thư mục mới trong dự án"),
      C("quick-open", "Mở nhanh tệp…", "Ctrl+P"), C("library", "Mở thư viện", "Ctrl+O"), C("find", "Tìm trong tệp", "Ctrl+F"), C("replace", "Tìm và thay", "Ctrl+H"), C("goto", "Tới dòng…", "Ctrl+G"),
      C("comment", "Bật/tắt chú thích dòng", "Ctrl+/"), C("suggest", "Gợi ý", "Ctrl+Space"), C("wrap", "Bật/tắt ngắt dòng mềm", "Alt+Z"), C("zoom-in", "Phóng to chữ", "Ctrl+="), C("zoom-out", "Thu nhỏ chữ", "Ctrl+-"),
      C("sidebar", "Ẩn/hiện thanh bên", "Ctrl+B"), C("panel", "Ẩn/hiện bảng dưới", "Ctrl+J"), C("theme", "Đổi giao diện sáng/tối"), C("settings", "Cài đặt", "Ctrl+,"),
      C("storage", "Nơi lưu & đồng bộ…"), C("sync", "Đồng bộ ngay"), C("import", "Nhập .zip / tệp / sao lưu…"), C("export-zip", "Xuất dự án thành .zip"), C("export-all", "Sao lưu toàn bộ thư viện (.json)"),
      C("close-tab", "Đóng thẻ", "Ctrl+W"), C("help", "Phím tắt & trợ giúp", "F1")];
  }
  function palette(mode) {
    var old = U.$(".cs-pal"); if (old) old.remove();
    var files = mode === "files", it = S().item;
    var items = files ? (it ? it.files.map(function (f) { return { id: f.path, label: f.path.split("/").pop(), kbd: f.path }; }) : []) : commandList();
    var box = h("div", { class: "cs-pal", role: "dialog", "aria-label": files ? "Mở nhanh tệp" : "Bảng lệnh" });
    var inp = h("input", { type: "text", placeholder: files ? "Gõ tên tệp…" : "Gõ tên lệnh…", "aria-label": files ? "Tên tệp" : "Tên lệnh", role: "combobox", "aria-expanded": "true", "aria-controls": "cs-pal-l", spellcheck: "false" });
    var ul = h("ul", { id: "cs-pal-l", role: "listbox" }), sel = 0, shown = [];
    box.appendChild(inp); box.appendChild(ul); root.document.body.appendChild(box);
    function score(lb, q) { return CS.complete ? CS.complete.matchScore(lb, q) || CS.complete.matchScore(lb.replace(/\s+/g, ""), q.replace(/\s+/g, "")) || (lb.toLowerCase().indexOf(q.toLowerCase()) >= 0 ? 200 : 0) : (lb.toLowerCase().indexOf(q.toLowerCase()) >= 0 ? 1 : 0); }
    function draw() {
      var q = inp.value.trim();
      shown = items.map(function (x) { return { x: x, s: q ? Math.max(score(x.label, q), files ? score(x.kbd, q) * 0.9 : 0) : 1 }; }).filter(function (y) { return y.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 60).map(function (y) { return y.x; });
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.innerHTML = "";
      shown.forEach(function (x, k) {
        var li = h("li", { role: "option", id: "cs-pal-o" + k, "aria-selected": String(k === sel) }, [h("span", { text: x.label }), x.kbd ? (files ? h("span", { class: "d", text: x.kbd }) : h("kbd", { text: x.kbd })) : null]);
        li.addEventListener("mousedown", function (e) { e.preventDefault(); sel = k; go(); });
        ul.appendChild(li);
      });
      if (!shown.length) ul.appendChild(h("li", { class: "d", text: "Không có kết quả" }));
      inp.setAttribute("aria-activedescendant", shown.length ? "cs-pal-o" + sel : "");
      var on = ul.querySelector('[aria-selected="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    }
    function close() { box.remove(); root.document.removeEventListener("mousedown", outside, true); if (A.ed) A.ed.focus(); }
    function outside(e) { if (!box.contains(e.target)) close(); }
    function go() { var x = shown[sel]; close(); if (!x) return; if (files) A.showFile(x.id); else A.cmd(x.id); }
    inp.addEventListener("input", function () { sel = 0; draw(); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); go(); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    setTimeout(function () { root.document.addEventListener("mousedown", outside, true); }, 0);
    draw(); inp.focus();
  }

  /* ================================================================ trợ giúp */
  function help() {
    var rows = [["Chạy / Dừng", "Ctrl+Enter hoặc F5 / Shift+F5"], ["Lưu (tự lưu sau 1 giây)", "Ctrl+S"], ["Định dạng", "Shift+Alt+F"], ["Gợi ý", "Ctrl+Space (tự bật khi gõ, . -> ::)"],
      ["Chọn gợi ý", "↑ ↓ rồi Enter hoặc Tab, Esc để đóng"], ["Tìm / Thay / Tới dòng", "Ctrl+F / Ctrl+H / Ctrl+G, F3 kết quả sau"], ["Chú thích dòng", "Ctrl+/"],
      ["Thụt / lùi thụt", "Tab / Shift+Tab (cả đoạn chọn), Ctrl+] / Ctrl+["], ["Di chuyển dòng / nhân đôi / xoá", "Alt+↑↓ / Shift+Alt+↑↓ / Ctrl+Shift+K"],
      ["Phóng to/thu nhỏ chữ", "Ctrl+= / Ctrl+- / Ctrl+0"], ["Ngắt dòng mềm", "Alt+Z"], ["Bảng lệnh / Mở nhanh tệp", "Ctrl+Shift+P / Ctrl+P"], ["Thư viện / Tệp / Tìm trong dự án", "Ctrl+O / Ctrl+Shift+E / Ctrl+Shift+F"],
      ["Thanh bên / Bảng dưới", "Ctrl+B / Ctrl+J"], ["Đóng thẻ / Chuyển thẻ", "Ctrl+W / Ctrl+Tab"], ["Tệp mới / Đoạn mã mới", "Ctrl+Alt+N / Ctrl+N"], ["Cài đặt", "Ctrl+,"]];
    var tbl = h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" } }, rows.map(function (r) { return h("tr", {}, [h("td", { text: r[0], style: { padding: "4px 8px 4px 0" } }), h("td", { style: { padding: "4px 0", textAlign: "right" } }, [h("kbd", { text: r[1] })])]); }));
    return U.dialog({ title: "Phím tắt & mẹo", wide: true, body: h("div", {}, [tbl,
      h("p", { class: "cs-note", text: "Đoạn mã = một tệp; dự án = nhiều tệp, thư mục, tệp chính để chạy (C/C++ biên dịch mọi .c/.cpp, Java chạy lớp có main). Mọi thứ tự lưu trên máy này; bật “Nơi lưu & đồng bộ” để dùng chung giữa các thiết bị (kho JSON, MySQL hoặc MongoDB trên máy chủ)." }),
      h("p", { class: "cs-note", text: "Chạy C/C++/Python trong trình duyệt cần tải bộ chạy một lần (hỏi trước). Chạy trên máy chủ gửi mã tới dịch vụ đã cấu hình — đừng gửi bí mật." })]) });
  }

  function moreMenu(el) {
    U.menu(el, [
      { label: "Đoạn mã mới", kbd: "Ctrl+N", onclick: function () { A.cmd("new-snippet"); } }, { label: "Dự án mới…", onclick: function () { A.cmd("new-project"); } },
      { label: "Mở thư viện", kbd: "Ctrl+O", onclick: function () { A.showSide("library"); } }, "-",
      { label: "Nhập .zip / tệp / sao lưu…", onclick: function () { A.cmd("import"); } }, { label: "Xuất dự án (.zip)", disabled: !S().item, onclick: function () { exportZip(); } },
      { label: "Tải tệp đang mở", disabled: !S().active, onclick: function () { var f = A.fileOf(S().active); U.download(S().active.split("/").pop(), f.content); } },
      { label: "Chép toàn bộ mã của tệp", disabled: !S().active, onclick: function () { U.copy(A.ed.getValue()).then(function (ok) { U.toast(ok ? "Đã chép" : "Không chép được", ok ? "ok" : "bad"); }); } }, "-",
      { label: "Tìm / Thay", kbd: "Ctrl+H", onclick: function () { A.cmd("replace"); } }, { label: "Bảng lệnh", kbd: "Ctrl+Shift+P", onclick: function () { palette(); } },
      { label: "Nơi lưu & đồng bộ…", onclick: function () { storage(); } }, { label: "Cài đặt", kbd: "Ctrl+,", onclick: function () { openSettings(); } }, { label: "Phím tắt & trợ giúp", kbd: "F1", onclick: function () { help(); } }
    ]);
  }

  var CMDS = {
    "new-snippet": newSnippet, "new-project": newProject, settings: openSettings, storage: storage, sync: syncNow, help: help, palette: function () { palette(); }, "quick-open": function () { palette("files"); },
    "import": importAny, "export-zip": function () { exportZip(); }, "export-all": exportAll, indent: pickIndent, formatter: pickFormatter, target: pickTarget, language: pickLanguage
  };
  A.dialogs = {
    init: function () {}, has: function (n) { return !!CMDS[n]; }, run: function (n, el) { return CMDS[n](el); },
    firstRun: firstRun, confirmDownload: confirmDownload, importZip: importZip, exportZip: exportZip, moreMenu: moreMenu, palette: palette
  };
})(window);
