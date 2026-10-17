/* ui/detail.js — chi tiết một thuật toán: tra nhanh, mô tả, điều kiện, độ phức tạp, khi nào dùng / không dùng, lỗi thường gặp, code (sao chép · tải · lưu vào Template),
   ví dụ vào/ra, bài tập liên quan, liên quan, trực quan hoá, cách tìm ra từ cây quyết định, ghi chú cá nhân (markdown, nháp tự lưu, sống sót khi sập máy). */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, $ = U.$, C = A.catalog, lib = A.lib, M = A.markdown;
  var STATUS = A.user.STATUS, LEVEL = A.compare.LEVEL;

  function resolve(title) { var e = C.byName(title); return e ? { id: e.id, status: "active" } : null; }
  function md(src) { return M.render(src || "", { resolve: resolve, highlight: A.highlight }); }
  function list(items) { return h("ul", { class: "dl" }, items.map(function (x) { return h("li", { html: M.inline ? M.inline(x, { resolve: resolve, highlight: A.highlight }) : T.esc(x) }); })); }
  function section(title, body, cls) { return h("section", { class: "ds " + (cls || "") }, h("h2", { text: title }), body); }

  function codeBlock(c) { return '<div class="md"><pre class="code" data-lang="' + T.esc(c.lang) + '"><code>' + (A.highlight ? A.highlight(c.src, c.lang) : T.esc(c.src)) + "</code></pre></div>"; }

  /** ctx: {user, go(hash), toast, confirm, newItem(init)} */
  function open(ctx, host, id) {
    var user = ctx.user, e = C.get(id), cleanup = [], st = { destroyed: false };
    if (!e) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có thuật toán này" }), h("p", { text: "Có thể mục của tôi đã bị xoá hoặc đường dẫn sai." }), h("a", { class: "btn btn-primary", href: "#/lib", text: "Về thư viện" }))); return { destroy: function () {} }; }
    var cat = e.category === "mine" ? C.MINE : lib.CAT[e.category], cx = e.complexity || {}, mine = e.source === "user";

    // ---------------------------------------------------------------------------------------------- đầu trang
    var bm = h("button", { type: "button", class: "icon-btn bm", "aria-pressed": String(user.isBookmarked(id)), "aria-label": "Đánh dấu quan trọng", title: "Đánh dấu quan trọng", html: icon("bookmark") });
    var stSel = h("select", { class: "st-sel", "aria-label": "Trạng thái học" }, STATUS.map(function (s, i) { return h("option", { value: i, text: s }); }));
    stSel.value = String(user.status(id));
    var more = h("button", { type: "button", class: "icon-btn more", "aria-label": "Thêm thao tác", "aria-haspopup": "menu", html: icon("more") });
    var head = h("header", { class: "dh" },
      h("div", { class: "dh-top" }, h("a", { class: "catlink", href: "#/lib?cat=" + e.category, html: icon(cat ? cat.icon : "mine") + "<span>" + T.esc(cat ? cat.name : e.category) + (e.sub ? " · " + T.esc(e.sub) : "") + "</span>" }), h("span", { class: "lvl", title: "Độ khó cài đặt: " + LEVEL[e.level], text: "Lv " + e.level + " · " + LEVEL[e.level] }), mine ? h("span", { class: "ntag own", text: "của tôi" }) : null),
      h("div", { class: "dh-row" }, h("h1", { text: e.name }), h("div", { class: "dh-act" }, stSel, bm, more)),
      e.summary ? h("p", { class: "dh-sum", text: e.summary }) : null,
      e.aliases && e.aliases.length ? h("p", { class: "faint dh-alias", text: "Còn gọi: " + e.aliases.join(" · ") }) : null,
      h("div", { class: "tagline" }, e.tags.map(function (t) { return h("a", { class: "ntag", href: "#/lib?q=" + U.enc("tag:" + t), text: t }); })));

    // ---------------------------------------------------------------------------------------------- tra nhanh (cheat)
    var quick = h("section", { class: "quick-card", "aria-label": "Tra nhanh" },
      h("div", { class: "qc-cx" }, h("div", null, h("small", { text: "Thời gian" }), h("b", { class: "mono", text: cx.time || "—" })), cx.space ? h("div", null, h("small", { text: "Bộ nhớ" }), h("b", { class: "mono", text: cx.space })) : null),
      (e.ops || []).length ? h("dl", { class: "qc-ops" }, e.ops.map(function (o) { return [h("dt", { text: o[0] }), h("dd", { class: "mono", text: o[1] })]; }).reduce(function (a, b) { return a.concat(b); }, [])) : null,
      (e.use_case || [])[0] ? h("p", { html: "<b>Dùng khi:</b> " + T.esc(e.use_case[0]) }) : null,
      (e.not_for || [])[0] ? h("p", { class: "qc-not", html: "<b>Không dùng khi:</b> " + T.esc(e.not_for[0]) }) : null);

    // ---------------------------------------------------------------------------------------------- các mục
    var body = h("div", { class: "dbody" });
    if (e.description) body.append(section("Mô tả", h("div", { class: "md", html: md(e.description) })));
    if ((e.conditions || []).length) body.append(section("Điều kiện áp dụng", list(e.conditions)));
    var cxBody = h("div", null, h("p", null, h("span", { class: "mono big-cx", text: cx.time || "—" }), cx.space ? h("span", { class: "faint", text: "  ·  bộ nhớ " + cx.space }) : null), cx.note ? h("p", { class: "faint", text: cx.note }) : null);
    if ((e.ops || []).length) cxBody.append(h("div", { class: "tbl-wrap" }, h("table", { class: "optable" }, h("thead", null, h("tr", null, h("th", { text: "Thao tác" }), h("th", { text: "Độ phức tạp" }))), h("tbody", null, e.ops.map(function (o) { return h("tr", null, h("td", { text: o[0] }), h("td", { class: "mono", text: o[1] })); })))));
    body.append(section("Độ phức tạp", cxBody));
    if ((e.use_case || []).length) body.append(section("Khi nào dùng", list(e.use_case)));
    if ((e.not_for || []).length) body.append(section("Khi nào KHÔNG dùng", list(e.not_for), "not"));
    if ((e.pitfalls || []).length) body.append(section("Lỗi thường gặp", list(e.pitfalls), "warn-s"));

    if (e.code) {
      var copy = h("button", { type: "button", class: "btn", html: icon("copy") + "<span>Sao chép</span>", on: { click: function () { U.copyText(e.code.src).then(function (ok) { ctx.toast(ok ? "Đã sao chép " + e.code.title : "Không sao chép được — chọn và chép tay"); }); } } });
      var dl = h("button", { type: "button", class: "btn", html: icon("download") + "<span>Tải " + T.esc(e.code.title) + "</span>", on: { click: function () { U.download(e.code.title, new Blob([e.code.src], { type: "text/plain" })); } } });
      var save = h("button", { type: "button", class: "btn btn-primary", html: icon("template") + "<span>Lưu vào Template của tôi</span>", on: { click: saveTemplate } });
      body.append(section("Code — " + (lib.LANGS[e.code.lang] || e.code.lang), h("div", null, h("div", { class: "btn-row code-act" }, copy, dl, save), h("div", { html: codeBlock(e.code) }))));
    } else if (e.nocode) body.append(section("Code", h("p", { class: "faint", text: "Mục này không có mẫu code ngắn: xem mô tả ở trên." })));
    if (e.example) body.append(section("Ví dụ", h("div", { class: "ex" }, h("div", null, h("small", { text: "Input" }), h("pre", { class: "io", text: e.example.input })), h("div", null, h("small", { text: "Output" }), h("pre", { class: "io", text: e.example.output })), e.example.explain ? h("p", { class: "faint ex-note", text: e.example.explain }) : null)));
    if ((e.problems || []).length) body.append(section("Bài tập liên quan", h("ul", { class: "probs" }, e.problems.map(function (p) {
      var url = lib.problemUrl(p);
      var ok = lib.problemVerified(p), label = p.name + (p.id ? " (" + p.id + ")" : "");
      return h("li", null, h("span", { class: "site", text: lib.SITES[p.site] || p.site }), url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: label }) : h("span", { text: label }),
        ok ? null : h("span", { class: "unv", title: "Tên bài lấy từ trí nhớ của tác giả, chưa đối chiếu với trang gốc — hãy tìm theo tên", text: "chưa kiểm" }));
    }))));
    if (mine && (e.origin || e.link)) body.append(section("Nguồn", h("p", null, e.origin || "", e.link ? h("span", null, " — ", h("a", { href: e.link, target: "_blank", rel: "noopener noreferrer", text: e.link })) : null)));

    var rel = (e.related || []).map(function (r) { return C.get(r); }).filter(Boolean);
    var relRow = h("div", { class: "btn-row" });
    rel.forEach(function (r) { relRow.append(h("a", { class: "chip rel", href: "#/a/" + r.id, text: r.name })); });
    var actions = h("div", { class: "btn-row" }, h("a", { class: "btn", href: "#/compare?ids=" + [e.id].concat(rel.slice(0, 2).map(function (r) { return r.id; })).join(","), html: icon("compare") + "<span>So sánh" + (rel.length ? " với liên quan" : "") + "</span>" }),
      e.viz && A.viz.has(e.viz) ? h("a", { class: "btn", href: "#/viz/" + e.viz, html: icon("play") + "<span>Xem chạy từng bước</span>" }) : null,
      h("a", { class: "btn", href: "#/practice/cards?ids=" + e.id, html: icon("cards") + "<span>Ôn thẻ (" + cardsOf(e).length + ")</span>" }));
    body.append(section("Liên quan", h("div", null, rel.length ? relRow : h("p", { class: "faint", text: "Chưa có mục liên quan." }), actions)));

    var paths = A.tree.pathsTo ? A.tree.pathsTo(e.id) : [];
    if (paths.length) body.append(section("Cách tìm ra thuật toán này", h("div", null, paths.slice(0, 3).map(function (p) { return h("p", { class: "tpath" }, p.path.map(function (s, i) { return [h("span", { class: "tq", text: s.q }), h("span", { class: "ta", text: s.t }), i < p.path.length - 1 ? h("span", { class: "tarr", html: icon("next") }) : null]; }).reduce(function (a, b) { return a.concat(b); }, [])); }), h("a", { class: "btn btn-ghost", href: "#/decide", text: "Mở Wizard \"Nên dùng gì?\"" })), ""));

    // ---------------------------------------------------------------------------------------------- ghi chú cá nhân
    var ta = h("textarea", { class: "note-ta", rows: 6, placeholder: "Ghi chú riêng của bạn (Markdown). Dùng [[Tên thuật toán]] để nối với mục khác.", "aria-label": "Ghi chú của tôi", maxlength: String(A.user.LIM.note) });
    var saved = user.note(id), noteBar = h("div", { class: "note-bar" }), prevBox = h("div", { class: "md note-prev", hidden: true }), noteMsg = h("span", { class: "faint", role: "status" });
    ta.value = saved ? saved.text : "";
    var cur = ta.value, dirty = false;
    var tog = h("button", { type: "button", class: "btn", html: icon("info") + "<span>Xem trước</span>", "aria-pressed": "false" });
    var saveBtn = h("button", { type: "button", class: "btn btn-primary", html: icon("check") + "<span>Lưu ghi chú</span>", disabled: true });
    noteBar.append(saveBtn, tog, noteMsg);
    var draftTimer = U.debounce(function () { if (dirty) user.saveDraft("note:" + id, ta.value); }, 500);
    function setMsg() { noteMsg.textContent = dirty ? "● Chưa lưu — bản nháp đã được giữ" : saved ? "✓ Đã lưu " + T.fmtDateTime(saved.updated).slice(11) : ""; saveBtn.disabled = !dirty; }
    ta.addEventListener("input", function () { dirty = ta.value !== (saved ? saved.text : ""); setMsg(); draftTimer(); if (!prevBox.hidden) prevBox.innerHTML = md(ta.value); });
    tog.addEventListener("click", function () { prevBox.hidden = !prevBox.hidden; tog.setAttribute("aria-pressed", String(!prevBox.hidden)); ta.hidden = !prevBox.hidden; if (!prevBox.hidden) prevBox.innerHTML = md(ta.value) || '<p class="faint">Chưa có gì để xem.</p>'; });
    function saveNote() { draftTimer.flush(); return user.saveNote(id, ta.value).then(function (r) { saved = r; dirty = false; setMsg(); ctx.toast(r ? "Đã lưu ghi chú" : "Đã xoá ghi chú trống"); }, function (er) { ctx.toast("Không lưu được: " + er.message); }); }
    saveBtn.addEventListener("click", saveNote);
    ta.addEventListener("keydown", function (ev) { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveNote(); } });
    var flush = function () { if (dirty) { draftTimer.flush(); user.saveDraft("note:" + id, ta.value); } };
    root.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", function onvis() { if (st.destroyed) { document.removeEventListener("visibilitychange", onvis); return; } if (document.visibilityState === "hidden") flush(); });
    cleanup.push(function () { root.removeEventListener("pagehide", flush); flush(); });
    var noteSec = section("Ghi chú của tôi", h("div", { class: "note" }, ta, prevBox, noteBar), "mynote");
    body.append(noteSec);
    user.getDraft("note:" + id).then(function (d) {
      if (st.destroyed || !d || d.value === (saved ? saved.text : "")) return;
      var b = h("div", { class: "ed-banner" }, h("span", { html: "Có <b>bản nháp chưa lưu</b> từ " + T.esc(T.fmtDateTime(d.at)) + "." }), h("button", { type: "button", class: "btn btn-primary", text: "Khôi phục nháp", on: { click: function () { ta.value = d.value; dirty = true; setMsg(); b.remove(); } } }), h("button", { type: "button", class: "btn", text: "Bỏ nháp", on: { click: function () { user.dropDraft("note:" + id); b.remove(); } } }));
      noteSec.insertBefore(b, noteSec.children[1]);
    });
    setMsg();

    // ---------------------------------------------------------------------------------------------- hành động
    function cardsOf(x) { return (A.practice && A.practice.cardsOf) ? A.practice.cardsOf(x) : (x.cards || []); }
    bm.addEventListener("click", function () { var on = !user.isBookmarked(id); user.setMark(id, { bm: on ? 1 : 0 }).then(function () { bm.setAttribute("aria-pressed", String(on)); ctx.toast(on ? "Đã đánh dấu quan trọng" : "Đã bỏ đánh dấu"); }); });
    stSel.addEventListener("change", function () { user.setMark(id, { st: +stSel.value }).then(function () { ctx.toast("Trạng thái: " + STATUS[+stSel.value]); }); });
    function saveTemplate() {
      U.formBox("Lưu vào Template của tôi", [{ name: "title", label: "Tên tệp", value: e.code.title, required: true, max: 80, hint: "Bản này sửa được riêng trong Template Manager, không ảnh hưởng thư viện." }], "Lưu").then(function (v) {
        if (!v) return;
        user.saveTemplate({ title: v.title, lang: e.code.lang, src: e.code.src, tags: e.tags, algo: e.id }).then(function () { ctx.toast("Đã lưu " + v.title, { action: { label: "Mở", run: function () { ctx.go("#/templates"); } } }); }, function (er) { ctx.toast(er.message); });
      });
    }
    more.addEventListener("click", function () {
      var items = [
        { label: "Sao chép tên", icon: "copy", run: function () { U.copyText(e.name).then(function (ok) { ctx.toast(ok ? "Đã sao chép" : "Không sao chép được"); }); } },
        { label: "Tải Markdown (.md)", icon: "download", run: function () { U.download(A.backup.safeName(e.name) + ".md", new Blob([A.backup.entryToMarkdown(e, user.note(id))], { type: "text/markdown" })); } },
        { label: "In / Lưu PDF", icon: "print", run: function () { U.exporters.printEntry(e, user.note(id), ctx); } },
        { label: "So sánh…", icon: "compare", run: function () { ctx.go("#/compare?ids=" + id); } }
      ];
      if (mine) items.push({ sep: true }, { label: "Sửa mục này", icon: "edit", run: function () { ctx.go("#/mine/edit/" + id); } }, { label: "Xoá mục này", icon: "trash", danger: true, run: function () { ctx.confirm("Xoá mục của tôi?", "“" + e.name + "” cùng ghi chú và dấu của nó sẽ bị xoá khỏi máy này.", "Xoá", true).then(function (ok) { if (ok) user.removeItem(id).then(function () { ctx.toast("Đã xoá"); ctx.go("#/lib"); }); }); } });
      U.menu(more, items);
    });

    host.replaceChildren(h("div", { class: "detail" }, head, quick, body));
    return { destroy: function () { st.destroyed = true; cleanup.forEach(function (f) { f(); }); } };
  }

  U.detail = { open: open, md: md };
})(typeof globalThis !== "undefined" ? globalThis : this);
