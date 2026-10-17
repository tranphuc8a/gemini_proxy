/* ui/library.js — Template Manager (lưu / sửa / sao chép / tải / xuất .zip template.cpp của tôi) và trình soạn "mục của tôi" (Personal Library).
   Cả hai giữ BẢN NHÁP chữ đang soạn (0,5 s sau khi ngừng gõ + khi ẩn trang) nên sập máy, đóng thẻ không mất chữ. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, $ = U.$, C = A.catalog, lib = A.lib, F = A.find;
  var LANG_EXT = { cpp: "cpp", py: "py", js: "js", java: "java" };
  var EXT_LANG = { cpp: "cpp", cc: "cpp", cxx: "cpp", h: "cpp", hpp: "cpp", py: "py", js: "js", mjs: "js", java: "java" };

  function pageHead(title, sub, act) { return U.views.pageHead(title, sub, act); }
  function ago(ms) { return T.relTime(ms, Date.now()); }

  // ================================================================================================= Template Manager
  function templates(ctx, host, arg) {
    var user = ctx.user, st = { destroyed: false, q: "" }, off = null;
    if (arg) return editTemplate(ctx, host, arg);
    var el = h("div", { class: "page tpl" }), grid = h("div", { class: "tpl-grid" }), search = h("input", { type: "search", class: "q2", placeholder: "Lọc template theo tên / tag…", "aria-label": "Lọc template", autocomplete: "off", maxlength: "100" });
    host.replaceChildren(el);
    function draw() {
      if (st.destroyed) return;
      var f = T.fold(st.q), all = user.templates().filter(function (t) { return !f || T.fold(t.title + " " + t.tags.join(" ")).indexOf(f) !== -1; }).sort(function (a, b) { return b.updated - a.updated; });
      el.querySelector(".ph-sub").textContent = user.templates().length + " template" + (f ? " · " + all.length + " khớp" : "") + " — lưu trên máy này, dùng được khi offline";
      grid.replaceChildren.apply(grid, all.map(function (t) {
        var lines = t.src ? t.src.split("\n").length : 0, a = h("article", { class: "tcard" });
        a.append(h("h3", null, h("a", { href: "#/templates/" + t.id, class: "mono", text: t.title }), h("small", { text: (lib.LANGS[t.lang] || t.lang) + " · " + lines + " dòng · " + ago(t.updated) })));
        if (t.tags.length) a.append(h("p", { class: "tagline" }, t.tags.slice(0, 6).map(function (g) { return h("span", { class: "ntag", text: g }); })));
        if (t.algo && C.get(t.algo)) a.append(h("p", { class: "faint" }, "Từ: ", h("a", { href: "#/a/" + t.algo, text: C.get(t.algo).name })));
        a.append(h("pre", { class: "tcode", text: t.src.split("\n").slice(0, 6).join("\n") }));
        a.append(h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn", html: icon("copy") + "<span>Sao chép</span>", on: { click: function () { U.copyText(t.src).then(function (ok) { ctx.toast(ok ? "Đã sao chép " + t.title : "Không sao chép được"); }); } } }),
          h("button", { type: "button", class: "btn", html: icon("download") + "<span>Tải</span>", on: { click: function () { U.download(fileName(t), new Blob([t.src], { type: "text/plain" })); } } }),
          h("a", { class: "btn", href: "#/templates/" + t.id, html: icon("edit") + "<span>Sửa</span>" }),
          h("button", { type: "button", class: "btn btn-danger", "aria-label": "Xoá " + t.title, html: icon("trash"), on: { click: function () { ctx.confirm("Xoá template?", "“" + t.title + "” sẽ bị xoá khỏi máy này.", "Xoá", true).then(function (ok) { if (ok) user.removeTemplate(t.id).then(function () { ctx.toast("Đã xoá " + t.title); }); }); } } })));
        return a;
      }));
      if (!all.length) grid.append(h("div", { class: "empty-list" }, h("p", { class: "big", text: user.templates().length ? "Không có template nào khớp" : "Chưa có template nào" }), h("p", { text: user.templates().length ? "Bỏ bộ lọc để thấy hết." : "Lưu DSU, Segment Tree, Dinic… từ thư viện (nút “Lưu vào Template của tôi” trong trang thuật toán) hoặc tự tạo." })));
    }
    var actions = h("div", { class: "btn-row" },
      h("button", { type: "button", class: "btn btn-primary", html: icon("plus") + "<span>Template mới</span>", on: { click: function () { ctx.go("#/templates/new"); } } }),
      h("button", { type: "button", class: "btn", html: icon("lib") + "<span>Từ thuật toán…</span>", on: { click: fromAlgo } }),
      h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Nhập tệp…</span>", on: { click: importFiles } }),
      h("button", { type: "button", class: "btn", html: icon("download") + "<span>Xuất .zip</span>", on: { click: function () { if (!user.templates().length) { ctx.toast("Chưa có template để xuất."); return; } A.backup.exportTemplates(user).then(function (r) { U.download(r.name, r.blob); ctx.toast("Đã xuất " + r.count + " tệp"); }); } } }));
    function fromAlgo() {
      var inp = h("input", { type: "search", class: "q2", placeholder: "Gõ tên thuật toán có code…", "aria-label": "Tìm thuật toán", autocomplete: "off", maxlength: "80" }), res = h("div", { class: "pick-list" });
      var dlg = U.dialog("Tạo template từ thuật toán", [inp, res], null, {});
      function show() {
        var r = F.search(U.list.records(), inp.value.trim(), { limit: 12, filter: function (e) { return !!e.code; } }).results;
        res.replaceChildren.apply(res, r.map(function (x) { var b = h("button", { type: "button", class: "sg", html: "<span>" + T.esc(x.e.name) + "</span><small>" + T.esc(x.e.code.title) + "</small>" }); b.addEventListener("click", function () { user.saveTemplate({ title: x.e.code.title, lang: x.e.code.lang, src: x.e.code.src, tags: x.e.tags, algo: x.e.id }).then(function (t) { dlg.close(); ctx.go("#/templates/" + t.id); }, function (er) { ctx.toast(er.message); }); }); return b; }));
        if (!r.length) res.append(h("p", { class: "faint", text: "Không có thuật toán nào có code khớp." }));
      }
      inp.addEventListener("input", U.debounce(show, 80)); show(); inp.focus();
    }
    function importFiles() {
      U.pickFiles(".cpp,.cc,.h,.hpp,.py,.js,.java,.txt", true).then(function (files) {
        if (!files.length) return;
        var ok = 0, skip = 0;
        files.reduce(function (p, f) {
          return p.then(function () {
            if (f.size > 200000) { skip++; return null; }
            return f.text().then(function (txt) { var ext = (/\.([a-z0-9]+)$/i.exec(f.name) || [])[1] || ""; return user.saveTemplate({ title: f.name, lang: EXT_LANG[ext.toLowerCase()] || "cpp", src: txt }).then(function () { ok++; }); });
          });
        }, Promise.resolve()).then(function () { ctx.toast("Đã nhập " + ok + " tệp" + (skip ? " (bỏ " + skip + " tệp > 200 KB)" : "")); });
      });
    }
    search.addEventListener("input", U.debounce(function () { st.q = search.value; draw(); }, 80));
    el.append(pageHead("Template Manager", "…", actions), search, grid);
    draw();
    off = user.on(function (ev) { if (!st.destroyed && /^(template|restore|wipe)$/.test(ev.type)) draw(); });
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }
  function fileName(t) { var n = A.backup.safeName(t.title); return /\.[a-z0-9]+$/i.test(n) ? n : n + "." + (LANG_EXT[t.lang] || "txt"); }

  /** Dán Tab = 4 dấu cách trong ô code (không nhảy focus mất việc). */
  function tabKey(ta) {
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); var s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new root.Event("input", { bubbles: true })); }
    });
  }

  function editTemplate(ctx, host, arg) {
    var user = ctx.user, isNew = arg === "new", t = isNew ? null : user.template(arg), st = { destroyed: false }, id = t ? t.id : "new";
    if (!isNew && !t) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có template này" }), h("a", { class: "btn btn-primary", href: "#/templates", text: "Về Template Manager" }))); return { destroy: function () {} }; }
    var title = h("input", { type: "text", class: "tpl-title mono", value: t ? t.title : "template.cpp", maxlength: "80", "aria-label": "Tên tệp" });
    var lang = h("select", { "aria-label": "Ngôn ngữ" }, Object.keys(lib.LANGS).map(function (k) { return h("option", { value: k, text: lib.LANGS[k] }); })); lang.value = t ? t.lang : "cpp";
    var tags = h("input", { type: "text", value: t ? t.tags.join(", ") : "", placeholder: "tag, cách nhau dấu phẩy", maxlength: "200", "aria-label": "Tag" });
    var ta = h("textarea", { class: "code-ta", spellcheck: "false", wrap: "off", "aria-label": "Mã nguồn", maxlength: String(A.user.LIM.tpl) }); ta.value = t ? t.src : "#include <bits/stdc++.h>\nusing namespace std;\n\n";
    var base = { title: title.value, lang: lang.value, src: ta.value, tags: tags.value }, msg = h("span", { class: "faint", role: "status" });
    var save = h("button", { type: "button", class: "btn btn-primary", html: icon("check") + "<span>Lưu</span>", disabled: true });
    function cur() { return { title: title.value.trim(), lang: lang.value, src: ta.value, tags: tags.value }; }
    function isDirty() { var c = cur(); return c.title !== base.title.trim() || c.lang !== base.lang || c.src !== base.src || c.tags !== base.tags; }
    function setMsg() { var d = isDirty(); save.disabled = !d; msg.textContent = d ? "● Chưa lưu — bản nháp đã được giữ" : (t || !isNew) ? "✓ Đã lưu" : ""; }
    var draft = U.debounce(function () { if (isDirty()) user.saveDraft("tpl:" + id, cur()); }, 500);
    [title, lang, tags, ta].forEach(function (x) { x.addEventListener("input", function () { setMsg(); draft(); }); x.addEventListener("change", function () { setMsg(); draft(); }); });
    tabKey(ta);
    function doSave() {
      draft.flush(); var c = cur();
      return user.saveTemplate(Object.assign({ id: t ? t.id : undefined, algo: t ? t.algo : "" }, c)).then(function (r) {
        t = r; isNew = false; id = r.id; base = { title: r.title, lang: r.lang, src: r.src, tags: r.tags.join(", ") }; user.dropDraft("tpl:new"); user.dropDraft("tpl:" + r.id);
        root.history.replaceState(null, "", "#/templates/" + r.id); setMsg(); ctx.toast("Đã lưu " + r.title);
      }, function (er) { ctx.toast(er.message, { ms: 7000 }); });
    }
    save.addEventListener("click", doSave);
    host.addEventListener("keydown", function onk(e) { if (st.destroyed) { host.removeEventListener("keydown", onk); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); } });
    var flush = function () { draft.flush(); if (isDirty()) user.saveDraft("tpl:" + id, cur()); };
    root.addEventListener("pagehide", flush);
    var el = h("div", { class: "page tpl-edit" }, h("a", { class: "back-link", href: "#/templates", text: "← Template Manager" }), pageHead(isNew ? "Template mới" : "Sửa template", ""),
      h("div", { class: "tpl-meta" }, title, lang, tags), ta,
      h("div", { class: "btn-row" }, save,
        h("button", { type: "button", class: "btn", html: icon("copy") + "<span>Sao chép</span>", on: { click: function () { U.copyText(ta.value).then(function (ok) { ctx.toast(ok ? "Đã sao chép" : "Không sao chép được"); }); } } }),
        h("button", { type: "button", class: "btn", html: icon("download") + "<span>Tải tệp</span>", on: { click: function () { U.download(fileName(cur()), new Blob([ta.value], { type: "text/plain" })); } } }), msg));
    host.replaceChildren(el); setMsg();
    user.getDraft("tpl:" + id).then(function (d) {
      if (st.destroyed || !d || !d.value) return;
      var v = d.value; if (v.title === base.title && v.src === base.src && v.lang === base.lang && v.tags === base.tags) return;
      var b = h("div", { class: "ed-banner" }, h("span", { html: "Có <b>bản nháp chưa lưu</b> từ " + T.esc(T.fmtDateTime(d.at)) + "." }), h("button", { type: "button", class: "btn btn-primary", text: "Khôi phục nháp", on: { click: function () { title.value = v.title; lang.value = v.lang; tags.value = v.tags; ta.value = v.src; setMsg(); b.remove(); } } }), h("button", { type: "button", class: "btn", text: "Bỏ nháp", on: { click: function () { user.dropDraft("tpl:" + id); b.remove(); } } }));
      el.insertBefore(b, el.children[2]);
    });
    if (isNew) setTimeout(function () { title.focus(); title.select(); }, 30);
    return { destroy: function () { st.destroyed = true; root.removeEventListener("pagehide", flush); flush(); } };
  }

  // ================================================================================================= Thư viện của tôi: trình soạn mục
  function lines(x) { return (x || []).join("\n"); }
  function itemForm(ctx, host, arg, q) {
    var user = ctx.user, isNew = arg === "new" || !arg, e = isNew ? null : user.item(arg), st = { destroyed: false }, key = "item:" + (e ? e.id : "new");
    if (!isNew && !e) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có mục này" }), h("a", { class: "btn btn-primary", href: "#/lib?src=user", text: "Về thư viện của tôi" }))); return { destroy: function () {} }; }
    var init = e || { name: q.name || "", category: "mine", level: 3, tags: [], complexity: {}, code: null, example: null, conditions: [], use_case: [], pitfalls: [], not_for: [] };
    function field(label, ctrl, hint, id) { return h("div", { class: "field" }, h("label", { for: id, text: label }), ctrl, hint ? h("p", { class: "hint", text: hint }) : null); }
    var f = {};
    f.name = h("input", { type: "text", id: "f-name", value: init.name, maxlength: "80", autocomplete: "off", required: true });
    f.category = h("select", { id: "f-cat" }, [h("option", { value: "mine", text: "Thư viện của tôi (nhóm riêng)" })].concat(lib.CATEGORIES.map(function (c) { return h("option", { value: c.id, text: c.name }); }))); f.category.value = init.category;
    f.sub = h("input", { type: "text", id: "f-sub", value: init.sub || "", maxlength: "60", placeholder: "vd: Cây truy vấn" });
    f.level = h("select", { id: "f-level" }, A.compare.LEVEL.slice(1).map(function (n, i) { return h("option", { value: i + 1, text: (i + 1) + " — " + n }); })); f.level.value = String(init.level || 3);
    f.tags = h("input", { type: "text", id: "f-tags", value: (init.tags || []).join(", "), maxlength: "300", placeholder: "range-query, tree, cp-algorithms" });
    f.summary = h("input", { type: "text", id: "f-sum", value: init.summary || "", maxlength: "220", placeholder: "Một câu: nó giải bài toán gì" });
    f.description = h("textarea", { id: "f-desc", rows: 6, maxlength: "20000", placeholder: "Markdown. Dùng [[Dijkstra]] để nối với mục khác." }); f.description.value = init.description || "";
    f.time = h("input", { type: "text", id: "f-time", value: (init.complexity || {}).time || "", maxlength: "80", placeholder: "O(N log N)" });
    f.space = h("input", { type: "text", id: "f-space", value: (init.complexity || {}).space || "", maxlength: "80", placeholder: "O(N)" });
    ["conditions", "use_case", "pitfalls", "not_for"].forEach(function (k) { f[k] = h("textarea", { id: "f-" + k, rows: 3, maxlength: "6000", placeholder: "Mỗi dòng một ý" }); f[k].value = lines(init[k]); });
    f.lang = h("select", { id: "f-lang" }, Object.keys(lib.LANGS).map(function (k) { return h("option", { value: k, text: lib.LANGS[k] }); })); f.lang.value = (init.code && init.code.lang) || "cpp";
    f.ctitle = h("input", { type: "text", id: "f-ctitle", value: (init.code && init.code.title) || "", maxlength: "80", placeholder: "template.cpp" });
    f.src = h("textarea", { id: "f-src", class: "code-ta", rows: 8, spellcheck: "false", wrap: "off", maxlength: "100000" }); f.src.value = (init.code && init.code.src) || ""; tabKey(f.src);
    f.exin = h("textarea", { id: "f-exin", rows: 3, maxlength: "4000" }); f.exin.value = (init.example && init.example.input) || "";
    f.exout = h("textarea", { id: "f-exout", rows: 3, maxlength: "4000" }); f.exout.value = (init.example && init.example.output) || "";
    f.origin = h("input", { type: "text", id: "f-origin", value: init.origin || "", maxlength: "200", placeholder: "Nguồn: cp-algorithms, giáo trình…" });
    f.link = h("input", { type: "text", id: "f-link", value: init.link || "", maxlength: "500", placeholder: "https://…", inputmode: "url" });
    function read() {
      return { id: e ? e.id : undefined, name: f.name.value, category: f.category.value, sub: f.sub.value, level: +f.level.value, tags: f.tags.value, summary: f.summary.value, description: f.description.value,
        complexity: { time: f.time.value, space: f.space.value }, conditions: f.conditions.value, use_case: f.use_case.value, pitfalls: f.pitfalls.value, not_for: f.not_for.value,
        code: f.src.value.trim() ? { lang: f.lang.value, title: f.ctitle.value || "template", src: f.src.value } : null, example: { input: f.exin.value, output: f.exout.value }, origin: f.origin.value, link: f.link.value };
    }
    var save = h("button", { type: "submit", class: "btn btn-primary", html: icon("check") + "<span>Lưu</span>" }), msg = h("span", { class: "faint", role: "status" });
    var form = h("form", { class: "iform", novalidate: true },
      h("div", { class: "grid2" }, field("Tên", f.name, "", "f-name"), field("Nhóm", f.category, "", "f-cat")),
      h("div", { class: "grid3" }, field("Nhóm con", f.sub, "", "f-sub"), field("Độ khó", f.level, "", "f-level"), field("Tag", f.tags, "", "f-tags")),
      field("Tóm tắt", f.summary, "", "f-sum"), field("Mô tả (Markdown)", f.description, "", "f-desc"),
      h("div", { class: "grid2" }, field("Thời gian", f.time, "", "f-time"), field("Bộ nhớ", f.space, "", "f-space")),
      field("Điều kiện áp dụng", f.conditions, "", "f-conditions"), field("Khi nào dùng", f.use_case, "", "f-use_case"), field("Khi nào KHÔNG dùng", f.not_for, "", "f-not_for"), field("Lỗi thường gặp", f.pitfalls, "", "f-pitfalls"),
      h("div", { class: "grid2" }, field("Ngôn ngữ code", f.lang, "", "f-lang"), field("Tên tệp code", f.ctitle, "", "f-ctitle")), field("Code (template dán là chạy)", f.src, "", "f-src"),
      h("div", { class: "grid2" }, field("Ví dụ — input", f.exin, "", "f-exin"), field("Ví dụ — output", f.exout, "", "f-exout")),
      h("div", { class: "grid2" }, field("Nguồn", f.origin, "", "f-origin"), field("Liên kết (https)", f.link, "", "f-link")),
      h("div", { class: "btn-row" }, save, h("a", { class: "btn", href: e ? "#/a/" + e.id : "#/lib?src=user", text: "Huỷ" }), msg));
    var draft = U.debounce(function () { user.saveDraft(key, read()); msg.textContent = "● Chưa lưu — bản nháp đã được giữ"; }, 500);
    form.addEventListener("input", draft); form.addEventListener("change", draft);
    var flush = function () { draft.flush(); user.saveDraft(key, read()); };
    root.addEventListener("pagehide", flush);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault(); draft.flush();
      user.saveItem(read()).then(function (r) { user.dropDraft("item:new"); root.removeEventListener("pagehide", flush); st.destroyed = true; ctx.toast("Đã lưu “" + r.name + "”"); ctx.go("#/a/" + r.id); }, function (er) { ctx.toast(er.message, { ms: 7000 }); f.name.focus(); });
    });
    var el = h("div", { class: "page" }, h("a", { class: "back-link", href: e ? "#/a/" + e.id : "#/lib?src=user", text: "← Quay lại" }), pageHead(e ? "Sửa mục của tôi" : "Thêm vào thư viện của tôi", "Kiến thức ngoài danh mục dựng sẵn — thuật toán, mẹo, ghi chép hệ thống. Tìm được cùng mọi thuật toán khác."), form);
    host.replaceChildren(el);
    user.getDraft(key).then(function (d) {
      if (st.destroyed || !d || !d.value) return;
      var v = d.value; if (JSON.stringify(v) === JSON.stringify(read())) return;
      var b = h("div", { class: "ed-banner" }, h("span", { html: "Có <b>bản nháp chưa lưu</b> từ " + T.esc(T.fmtDateTime(d.at)) + "." }), h("button", { type: "button", class: "btn btn-primary", text: "Khôi phục nháp", on: { click: function () {
        f.name.value = v.name || ""; f.category.value = v.category || "mine"; f.sub.value = v.sub || ""; f.level.value = String(v.level || 3); f.tags.value = Array.isArray(v.tags) ? v.tags.join(", ") : v.tags || ""; f.summary.value = v.summary || ""; f.description.value = v.description || "";
        f.time.value = (v.complexity || {}).time || ""; f.space.value = (v.complexity || {}).space || ""; ["conditions", "use_case", "pitfalls", "not_for"].forEach(function (k) { f[k].value = Array.isArray(v[k]) ? v[k].join("\n") : v[k] || ""; });
        f.lang.value = (v.code && v.code.lang) || "cpp"; f.ctitle.value = (v.code && v.code.title) || ""; f.src.value = (v.code && v.code.src) || ""; f.exin.value = (v.example && v.example.input) || ""; f.exout.value = (v.example && v.example.output) || ""; f.origin.value = v.origin || ""; f.link.value = v.link || ""; b.remove(); } } }), h("button", { type: "button", class: "btn", text: "Bỏ nháp", on: { click: function () { user.dropDraft(key); b.remove(); } } }));
      el.insertBefore(b, el.children[2]);
    });
    if (isNew) setTimeout(function () { f.name.focus(); }, 30);
    return { destroy: function () { st.destroyed = true; root.removeEventListener("pagehide", flush); } };
  }

  U.library = { templates: templates, itemForm: itemForm };
})(typeof globalThis !== "undefined" ? globalThis : this);
