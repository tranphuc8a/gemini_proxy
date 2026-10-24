/* ui/editor.js — màn một ghi chú: tiêu đề, tag, soạn Markdown, xem trước, liên kết/quan hệ/backlink, mục lục.

   An toàn dữ liệu: mọi thay đổi chưa bấm Lưu được ghi thành BẢN NHÁP vào IndexedDB sau 0,5 giây ngừng gõ (và ngay khi ẩn trang / rời màn) ⇒
   tắt app, hết pin, crash đều không mất chữ; mở lại note sẽ được hỏi khôi phục. Bấm Lưu (hoặc Ctrl+S) mới ghi vào ghi chú thật và xoá nháp. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, N = W.notes, F = W.flash, M = W.markdown, U = W.ui, h = U.h, icon = U.icon, $ = U.$;
  var REL_OPTS = [["related_to", "Liên quan tới"], ["depends_on", "Phụ thuộc vào"], ["parent_of", "Là cha của"], ["child_of", "Là con của"]];

  function snapshot(n) { return { title: n.title, content: n.content, tags: n.tags.slice(), fav: !!n.fav, kind: n.kind, rel: n.rel.map(function (r) { return { t: r.t, id: r.id }; }), meta: Object.assign({}, n.meta) }; }
  function same(a, b) { return a.title === b.title && a.content === b.content && a.fav === b.fav && a.kind === b.kind && a.tags.join("\u0001") === b.tags.join("\u0001") && JSON.stringify(a.rel) === JSON.stringify(b.rel) && JSON.stringify(a.meta) === JSON.stringify(b.meta); }
  /** Số từ = số đoạn liền [\p{L}\p{N}]+ (đúng định nghĩa cũ `s.match(/[\p{L}\p{N}]+/gu).length`) nhưng KHÔNG tạo mảng mọi từ:
      quét mã ký tự một lượt, bảng tra lười cho BMP (mỗi mã chỉ hỏi biểu thức chính quy một lần). Note 407k ký tự: ~43 ms → ~5 ms (node).
      kiem.js so với định nghĩa cũ trên chuỗi ngẫu nhiên đủ loại chữ (Việt, CJK, emoji, dấu rời NFD, nửa cặp thay thế). */
  var WORD_CP = /^[\p{L}\p{N}]$/u, wordTbl = null;
  function wordCount(s) {
    s = String(s == null ? "" : s);
    if (!wordTbl) wordTbl = new Uint8Array(65536);                         // 0 chưa biết · 1 chữ/số · 2 khác
    var n = 0, inWord = false, i, c, d, w, len = s.length;
    for (i = 0; i < len; i++) {
      c = s.charCodeAt(i);
      if (c < 128) w = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < len && (d = s.charCodeAt(i + 1)) >= 0xDC00 && d <= 0xDFFF) { w = WORD_CP.test(s.slice(i, i + 2)); i++; }
      else { w = wordTbl[c]; if (!w) { w = WORD_CP.test(s.charAt(i)) ? 1 : 2; wordTbl[c] = w; } w = w === 1; }
      if (w && !inWord) n++;
      inWord = w;
    }
    return n;
  }
  var words = wordCount;

  /** Chèn chữ giữ được Hoàn tác (Ctrl+Z) của trình duyệt. */
  function insertAt(ta, text) {
    ta.focus();
    var ok = false;
    try { ok = root.document.execCommand("insertText", false, text); } catch (e) { ok = false; }
    if (!ok) { var s = ta.selectionStart; ta.setRangeText(text, s, ta.selectionEnd, "end"); ta.dispatchEvent(new root.Event("input", { bubbles: true })); }
  }
  function wrapSel(ta, pre, post, ph) {
    var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph || "";
    insertAt(ta, pre + sel + post);
    ta.setSelectionRange(s + pre.length, s + pre.length + sel.length);
  }
  function prefixLines(ta, fn) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, a = v.lastIndexOf("\n", s - 1) + 1, b = v.indexOf("\n", e); if (b === -1) b = v.length;
    ta.setSelectionRange(a, b);
    var lines = v.slice(a, b).split("\n");
    insertAt(ta, lines.map(fn).join("\n"));
  }

  function open(ctx, host, id, query) {
    var repo = ctx.repo, st = { base: null, cur: null, saved: false, virtual: false, isNew: false, mode: U.prefs().mode, banner: "", destroyed: false, status: "active", rel: null, savedAt: 0 };
    var cleanup = [], el = null, ta = null, prev = null, titleIn = null, sug = { open: false, items: [], at: 0, from: 0, q: "" };
    host.replaceChildren(h("p", { class: "ed-loading", text: "Đang mở…" }));

    function isDirty() {
      if (!st.cur) return false;
      if (!st.saved && !st.virtual) return !!(st.cur.title.trim() || st.cur.content.trim() || st.cur.tags.length);
      return !same(st.cur, snapshot(st.base));
    }
    function saveDraftNow() {
      if (st.destroyed || !st.cur || st.status === "trashed") return Promise.resolve();
      if (!isDirty()) return repo.dropDraft(id);
      return repo.saveDraft({ id: id, note: st.cur, base: st.base ? st.base.updated_at : 0 });
    }
    var queueDraft = U.debounce(function () { saveDraftNow(); setDirtyState(); }, 500);
    // Mỗi phím chỉ làm việc rẻ (nhãn "Chưa lưu" + nút Lưu). Đếm từ + thẻ ôn quét cả note (44 ms/phím ở note 407k ký tự) nên chạy trễ 300 ms sau
    // phím cuối, và chạy ngay khi mở / nạp lại / lưu (setStatus).
    var countsSoon = U.debounce(function () { if (!st.destroyed) updateCounts(); }, 300);
    function changed() { queueDraft(); setDirtyState(); countsSoon(); schedulePreview(); }

    // ------------------------------------------------------------------------------------------- nạp
    function load() {
      var now = repo.now();
      return Promise.all([repo.get(id), repo.getDraft(id)]).then(function (r) {
        var note = r[0], draft = r[1];
        if (note) { st.saved = true; st.status = note.status; }
        else if (query.daily && T.isDateKey(query.daily)) return repo.daily(query.daily).then(function (d) { st.virtual = d.virtual; st.saved = !d.virtual; return [d.note, draft]; });
        else {
          st.isNew = true;
          var rel = []; if (query.rel && W.text.UUID_RE.test(query.rel) && query.rt) rel.push({ t: query.rt, id: query.rel });
          note = N.normalizeNote({ id: id, title: query.title || "", content: query.content || "", tags: query.tag ? [query.tag] : [], kind: query.kind || "note", rel: rel, created_at: now, updated_at: now }, now, { newId: true });
          note.id = id;
          // normalizeNote điền "Chưa đặt tên" cho tiêu đề trống (dành cho bản LƯU). Ô soạn của note mới phải TRỐNG: hiện chữ mờ "Tiêu đề", con trỏ vào
          // ô tiêu đề (nhịp focus 30 ms ở build), note chưa gõ gì không bị coi là "chưa lưu", và lúc lưu tiêu đề trống tự lấy từ dòng đầu nội dung.
          if (!String(query.title || "").trim()) note.title = "";
        }
        return [note, draft];
      }).then(function (r) {
        st.base = r[0]; st.cur = snapshot(r[0]);
        var d = r[1];
        if (d && d.note) {
          var dn = N.normalizeNote(Object.assign({ id: id, created_at: st.base.created_at, updated_at: st.base.updated_at }, d.note), now, { newId: true });
          if (!String(d.note.title || "").trim()) dn.title = "";            // nháp có tiêu đề trống: khôi phục đúng như đã gõ (không thành "Chưa đặt tên")
          if (!same(snapshot(dn), st.cur)) {
            if (st.isNew || st.virtual) { st.cur = snapshot(dn); } else st.banner = "draft:" + d.saved_at;
            st.draft = snapshot(dn);
          }
        }
      });
    }

    // ------------------------------------------------------------------------------------------- dựng
    function build() {
      var cur = st.cur, readonly = st.status === "trashed";
      titleIn = h("input", { class: "ed-title", type: "text", value: cur.title, placeholder: "Tiêu đề", maxlength: "200", "aria-label": "Tiêu đề ghi chú", autocomplete: "off", readonly: readonly ? true : null });
      var fav = h("button", { type: "button", class: "icon-btn fav", "aria-pressed": String(cur.fav), "aria-label": "Ghim ghi chú", title: "Ghim", html: icon("star") });
      var modes = h("div", { class: "seg modes", role: "group", "aria-label": "Chế độ xem" });
      [["edit", "Sửa"], ["split", "Chia đôi"], ["preview", "Xem"]].forEach(function (m) { modes.append(h("button", { type: "button", dataset: { mode: m[0] }, class: m[0] === "split" ? "only-wide" : "", "aria-pressed": "false" }, h("span", { text: m[1] }))); });
      var saveBtn = h("button", { type: "button", class: "btn btn-primary save", html: icon("check") + "<span>Lưu</span>" });
      var more = h("button", { type: "button", class: "icon-btn more", "aria-label": "Thêm thao tác", "aria-haspopup": "menu", html: icon("more") });
      var back = h("a", { class: "icon-btn back", href: "#/notes", "aria-label": "Về danh sách", html: icon("back") });
      var tagsBox = h("div", { class: "ed-tags" }), tagIn = h("input", { class: "tag-in", type: "text", placeholder: "+ tag", list: "tag-list", autocomplete: "off", autocapitalize: "none", maxlength: "40", "aria-label": "Thêm tag", readonly: readonly ? true : null });
      var tools = h("div", { class: "ed-tools", role: "toolbar", "aria-label": "Định dạng" });
      [["h", "Tiêu đề", "heading"], ["b", "Đậm (Ctrl+B)", "bold"], ["i", "Nghiêng (Ctrl+I)", "italic"], ["code", "Code", "code"], ["link", "Liên kết [[…]] (Ctrl+K)", "link"], ["ul", "Danh sách", "list"], ["ol", "Danh sách số", "olist"], ["task", "Việc cần làm", "task"], ["quote", "Trích dẫn", "quote"], ["fence", "Khối code", "fence"], ["card", "Thẻ hỏi–đáp (flashcard)", "card"], ["table", "Bảng", "table"]].forEach(function (t) {
        tools.append(h("button", { type: "button", class: "tb", dataset: { act: t[0] }, title: t[1], "aria-label": t[1], html: icon(t[2]) }));
      });
      ta = h("textarea", { class: "ed-ta", spellcheck: "false", "aria-label": "Nội dung Markdown", placeholder: "Viết Markdown… dùng [[Tên note]] để nối với note khác, Q: câu hỏi / A: đáp án để tạo thẻ ôn.", readonly: readonly ? true : null, wrap: U.prefs().wrap ? "soft" : "off" });
      ta.value = cur.content;
      var suggest = h("div", { class: "suggest", role: "listbox", hidden: true, "aria-label": "Gợi ý note" });
      prev = h("article", { class: "md ed-prev", "aria-label": "Xem trước" });
      var side = h("aside", { class: "ed-side", "aria-label": "Liên kết và mục lục" });
      // trạng thái lưu (đọc cho trình đọc màn hình khi đổi) + số đếm (không đọc — đổi theo từng lần ngừng gõ). Hai span dựng MỘT lần, chỉ đổi chữ khi khác.
      var stState = h("span", { class: "st ok", role: "status", "aria-live": "polite" }), stCounts = h("span", { class: "cnt" });
      var status = h("p", { class: "ed-status" }, stState, stCounts);
      var banner = h("div", { class: "ed-banner", hidden: true, role: "status" });
      var dl = h("datalist", { id: "tag-list" });
      el = h("div", { class: "ed" },
        h("div", { class: "ed-top" }, back, titleIn, fav, modes, saveBtn, more),
        banner, tagsBox,
        h("div", { class: "ed-cols" },
          h("div", { class: "ed-main" }, tools, h("div", { class: "ed-split" }, h("div", { class: "ed-edit" }, ta, suggest), prev), status),
          side),
        dl);
      host.replaceChildren(el);
      el._refs = { saveBtn: saveBtn, fav: fav, banner: banner, tagsBox: tagsBox, tagIn: tagIn, suggest: suggest, side: side, status: status, stState: stState, stCounts: stCounts, modes: modes, dl: dl, more: more, tools: tools };
      renderTags(); renderBanner(); applyMode(); schedulePreview(true); refreshPanel(); setStatus();
      dl.replaceChildren.apply(dl, repo.tags().slice(0, 200).map(function (t) { return h("option", { value: t.tag }); }));

      // sự kiện
      titleIn.addEventListener("input", function () { st.cur.title = titleIn.value; changed(); });
      titleIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ta.focus(); } });
      ta.addEventListener("input", function () { st.cur.content = ta.value; changed(); updateSuggest(); });
      ta.addEventListener("keydown", onKey); ta.addEventListener("click", updateSuggest); ta.addEventListener("blur", function () { setTimeout(closeSuggest, 150); });
      saveBtn.addEventListener("click", save);
      fav.addEventListener("click", toggleFav);
      more.addEventListener("click", showMenu);
      modes.addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (b) { st.mode = b.dataset.mode; U.setPref("mode", st.mode); applyMode(); schedulePreview(true); } });
      tools.addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (b) { e.preventDefault(); toolAct(b.dataset.act); } });
      tools.addEventListener("pointerdown", function (e) { if (e.target.closest(".tb")) e.preventDefault(); });   // bấm nút không làm mất vùng chọn trong textarea
      tagIn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagIn.value); tagIn.value = ""; } else if (e.key === "Backspace" && !tagIn.value && st.cur.tags.length) { st.cur.tags.pop(); renderTags(); changed(); } });
      tagIn.addEventListener("change", function () { if (tagIn.value.trim()) { addTag(tagIn.value); tagIn.value = ""; } });
      tagsBox.addEventListener("click", function (e) { var b = e.target.closest("[data-rm]"); if (b) { st.cur.tags = st.cur.tags.filter(function (t) { return t !== b.dataset.rm; }); renderTags(); changed(); } var c = e.target.closest("[data-tag]"); if (c) ctx.route({ tag: c.dataset.tag }, false, "notes"); });
      banner.addEventListener("click", onBanner);
      side.addEventListener("click", onSide);
      prev.addEventListener("click", function (e) {
        var a = e.target.closest("a.wl.ghost[data-title]");
        if (a) { e.preventDefault(); ctx.newNote({ title: a.dataset.title, from: id }); }
      });
      el.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
      var hide = function () { if (root.document.visibilityState === "hidden") { queueDraft.flush(); saveDraftNow(); } }, pagehide = function () { queueDraft.flush(); saveDraftNow(); };
      root.document.addEventListener("visibilitychange", hide); root.addEventListener("pagehide", pagehide);
      cleanup.push(function () { root.document.removeEventListener("visibilitychange", hide); root.removeEventListener("pagehide", pagehide); });
      var off = repo.on(function (ev) { if (!st.destroyed && ev.type === "save" && ev.id !== id && st.saved) refreshPanel(); if (!st.destroyed && ev.id === id && ev.remote) onRemote(); });
      cleanup.push(function () { if (typeof off === "function") off(); });
      if (st.isNew && !readonly) setTimeout(function () { (titleIn.value ? ta : titleIn).focus(); }, 30);
    }

    function applyMode() {
      var wide = host.clientWidth >= 720;                  // khớp @container main (min-width: 720px) trong app.css
      if (st.mode === "split" && !wide) st.mode = "edit";
      el.querySelector(".ed-main").dataset.mode = st.mode;
      $$(".modes button", el).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === st.mode)); });
      el.querySelector(".ed-tools").hidden = st.mode === "preview" || st.status === "trashed";
    }
    function $$(s, f) { return U.$$(s, f); }
    var onResize = U.debounce(function () { if (el && el.isConnected) { applyMode(); } }, 120);
    root.addEventListener("resize", onResize); cleanup.push(function () { root.removeEventListener("resize", onResize); });

    // ------------------------------------------------------------------------------------------- xem trước
    /* Xem trước theo KHỐI (perf-md W3): M.blocks cắt note thành các khối dựng độc lập (render từng khối nối lại == render cả note); mỗi khối là một
       <div class="mdb"> trong `prev`. Lần dựng sau chỉ thay đoạn khối KHÁC so với lần trước (tiền tố + hậu tố chung giữ nguyên là cùng phần tử DOM) —
       gõ một phím giữa note 400k ký tự chỉ dựng lại MỘT khối thay vì cả note (550–650 ms → vài chục ms).
       · Khoá khối = chữ của khối (khối có [[liên kết]] thêm số phiên bản kho: `repo.version()` đổi thì liên kết thật/mờ có thể đổi ⇒ dựng lại các khối đó).
       · Bộ nhớ đệm giữ HTML của khối TRƯỚC khi "hydrate" (W6: KaTeX/mermaid vẽ lên nút `.math`/`.mmd`); chỉ phần tử MỚI được hydrate, phần tử giữ lại mang
         sẵn kết quả (hydrate phải đánh dấu `data-hydrated` và chạy lại không đổi gì) — hook: `U.rich.hydrate(phầnTửKhốiMới[])`, chưa có thì bỏ qua.
       · id tiêu đề phụ thuộc cả note (`h-a`, `h-a-2`): khối mang `data-hid` (gốc), id thật do `fixHeadingIds` đặt theo thứ tự DOM sau khi vá. */
    var prevTimer = 0, pv = { keys: [], els: [], cache: new Map(), chars: 0, ver: -1, empty: false, tpl: null };
    function schedulePreview(now) {
      if (!prev || st.mode === "edit") return;
      clearTimeout(prevTimer);
      prevTimer = setTimeout(renderPreview, now ? 0 : 140);
    }
    function resolveTitle(title) { var hd = repo.resolve(title); return hd ? { id: hd.id, status: hd.s } : null; }
    function blockKey(text) { return text.indexOf("[[") === -1 ? text : text + "\u0001" + pv.ver; }
    /** HTML đã bọc (+ cờ có tiêu đề) của một khối; nhớ tối đa 400 khối / 2 triệu ký tự (quay lại chữ cũ khi xoá lùi / hoàn tác thì khỏi dựng lại). */
    function blockEntry(key, text) {
      var e = pv.cache.get(key);
      if (e) { pv.cache.delete(key); pv.cache.set(key, e); return e; }
      var html = M.render(text, { blockMode: true, highlight: W.highlight, resolve: resolveTitle });
      e = { html: '<div class="mdb">' + html + "</div>", hh: html.indexOf("data-hid=") !== -1 };
      pv.cache.set(key, e); pv.chars += e.html.length;
      while (pv.cache.size > 1 && (pv.cache.size > 400 || pv.chars > 2000000)) {
        var oldest = pv.cache.keys().next().value;
        pv.chars -= pv.cache.get(oldest).html.length; pv.cache.delete(oldest);
      }
      return e;
    }
    /** Đặt id thật cho tiêu đề theo thứ tự tài liệu (chỉ duyệt các khối CÓ tiêu đề). Chỉ ghi khi id đổi. */
    function fixHeadingIds() {
      var hs = [], bases = [], i, j, found;
      for (i = 0; i < pv.els.length; i++) {
        if (!pv.els[i]._hh) continue;
        found = pv.els[i].querySelectorAll("[data-hid]");
        for (j = 0; j < found.length; j++) { hs.push(found[j]); bases.push(found[j].getAttribute("data-hid")); }
      }
      var ids = M.dedupeIds(bases);
      for (i = 0; i < hs.length; i++) if (hs[i].id !== ids[i]) hs[i].id = ids[i];
    }
    function renderPreview() {
      if (st.destroyed || !prev) return;
      var ver = repo.version();
      if (ver !== pv.ver) { pv.ver = ver; pv.cache.clear(); pv.chars = 0; }
      var bl = M.blocks(st.cur.content), nk = bl.length, keys = new Array(nk), i;
      for (i = 0; i < nk; i++) keys[i] = blockKey(bl[i].text);
      if (!nk) {                                                                       // note trống
        if (!pv.empty) { prev.innerHTML = '<p class="faint">Chưa có nội dung để xem.</p>'; pv.empty = true; pv.keys = []; pv.els = []; }
        return;
      }
      if (pv.empty) { prev.replaceChildren(); pv.empty = false; }
      var top = prev.scrollTop, old = pv.keys, oldEls = pv.els, ol = old.length, lim = Math.min(ol, nk), p = 0, s = 0;
      while (p < lim && old[p] === keys[p]) p++;                                       // tiền tố chung
      while (s < lim - p && old[ol - 1 - s] === keys[nk - 1 - s]) s++;                 // hậu tố chung
      var delEnd = ol - s, insEnd = nk - s, k, headings = false;                       // thay old[p, delEnd) bằng mới[p, insEnd)
      if (p === delEnd && p === insEnd) return;                                        // không khối nào đổi (vd. chỉ thêm dòng trống giữa các khối)
      for (k = p; k < delEnd; k++) if (oldEls[k]._hh) headings = true;
      var html = "", ent = [];
      for (k = p; k < insEnd; k++) { var e = blockEntry(keys[k], bl[k].text); html += e.html; ent.push(e.hh); if (e.hh) headings = true; }
      var tpl = pv.tpl || (pv.tpl = root.document.createElement("template"));
      tpl.innerHTML = html;
      var frag = tpl.content, fresh = Array.prototype.slice.call(frag.children);
      if (fresh.length !== insEnd - p) {                                               // không xảy ra (mỗi khối đúng một <div>) — phòng hờ: về cách dựng cả note, lần sau thử lại theo khối
        prev.innerHTML = M.render(st.cur.content, { highlight: W.highlight, resolve: resolveTitle });
        pv.keys = []; pv.els = [];
        return;
      }
      for (k = 0; k < fresh.length; k++) fresh[k]._hh = ent[k];
      if (p === 0 && s === 0) prev.replaceChildren(frag);
      else {
        var ref = delEnd < ol ? oldEls[delEnd] : null;
        for (k = p; k < delEnd; k++) prev.removeChild(oldEls[k]);
        prev.insertBefore(frag, ref);
      }
      pv.keys = keys; pv.els = oldEls.slice(0, p).concat(fresh, oldEls.slice(delEnd));
      if (headings) fixHeadingIds();
      if (U.rich && typeof U.rich.hydrate === "function") U.rich.hydrate(fresh);
      if (prev.scrollTop !== top) prev.scrollTop = top;
    }

    // ------------------------------------------------------------------------------------------- tag, banner, trạng thái
    function renderTags() {
      var r = el._refs;
      r.tagsBox.replaceChildren.apply(r.tagsBox, st.cur.tags.map(function (t) {
        var c = h("span", { class: "chip on tagchip" }, h("button", { type: "button", class: "tagname", dataset: { tag: t }, title: "Xem mọi note có tag này", text: "#" + t }));
        if (st.status !== "trashed") c.append(h("button", { type: "button", class: "tagx", dataset: { rm: t }, "aria-label": "Bỏ tag " + t, html: icon("x") }));
        return c;
      }).concat(st.status === "trashed" ? [] : [r.tagIn]));
    }
    function addTag(raw) {
      var tags = N.normTags(String(raw).split(/[,\n]/));
      if (!tags.length) return;
      st.cur.tags = N.normTags(st.cur.tags.concat(tags)); renderTags(); changed();
      el._refs.tagIn.focus();
    }
    function renderBanner() {
      var b = el._refs.banner, html = "";
      if (st.status === "trashed") html = '<span>Ghi chú này đang ở <b>thùng rác</b> (tự xoá sau 30 ngày).</span><button type="button" class="btn" data-b="restore">Khôi phục</button><button type="button" class="btn btn-danger" data-b="purge">Xoá hẳn</button>';
      else if (st.status === "archived") html = '<span>Ghi chú đã <b>lưu trữ</b>.</span><button type="button" class="btn" data-b="restore">Bỏ lưu trữ</button>';
      else if (st.banner.indexOf("draft:") === 0) html = "<span>Có <b>bản nháp chưa lưu</b> từ " + T.esc(T.fmtDateTime(+st.banner.slice(6))) + ".</span>" + '<button type="button" class="btn btn-primary" data-b="usedraft">Khôi phục nháp</button><button type="button" class="btn" data-b="dropdraft">Bỏ nháp</button>';
      else if (st.banner === "remote") html = '<span>Ghi chú này vừa được <b>cập nhật từ thiết bị khác</b>.</span><button type="button" class="btn btn-primary" data-b="reload">Xem bản mới</button><button type="button" class="btn" data-b="keep">Giữ bản của tôi</button>';
      b.innerHTML = html; b.hidden = !html;
    }
    function onBanner(e) {
      var a = e.target.closest("[data-b]"); if (!a) return;
      var k = a.dataset.b;
      if (k === "restore") repo.setStatus(id, "active").then(function () { st.status = "active"; st.base = Object.assign({}, st.base, { status: "active" }); ctx.toast("Đã khôi phục"); renderBanner(); applyMode(); renderTags(); ta.readOnly = false; titleIn.readOnly = false; });
      else if (k === "purge") ctx.confirm("Xoá hẳn ghi chú?", "Không thể hoàn tác. Các liên kết tới nó sẽ thành liên kết mờ.", "Xoá hẳn", true).then(function (ok) { if (ok) repo.removeForever(id).then(function () { st.destroyed = true; ctx.toast("Đã xoá hẳn"); ctx.route({}, false, "notes"); }); });
      else if (k === "usedraft") { st.cur = snapshot(Object.assign({ id: id }, st.draft, { created_at: st.base.created_at, updated_at: st.base.updated_at, status: st.base.status })); st.banner = ""; fill(); }
      else if (k === "dropdraft") { repo.dropDraft(id); st.banner = ""; renderBanner(); }
      else if (k === "reload") { repo.get(id).then(function (n) { st.base = n; st.cur = snapshot(n); st.banner = ""; fill(); }); }
      else if (k === "keep") { st.banner = ""; renderBanner(); }
    }
    function fill() {
      titleIn.value = st.cur.title; ta.value = st.cur.content; renderTags(); renderBanner(); el._refs.fav.setAttribute("aria-pressed", String(st.cur.fav)); schedulePreview(true); setStatus(); refreshPanel();
    }
    function onRemote() {
      if (!isDirty()) repo.get(id).then(function (n) { if (n) { st.base = n; st.cur = snapshot(n); fill(); ctx.toast("Ghi chú vừa được cập nhật từ thiết bị khác"); } });
      else { st.banner = "remote"; renderBanner(); }
    }
    /** Việc rẻ, chạy MỖI PHÍM: chỉ isDirty() + nhãn trạng thái + nút Lưu; không đụng DOM khi không có gì đổi. */
    function setDirtyState() {
      if (!el) return;
      var r = el._refs, dirty = isDirty();
      var text = dirty ? "● Chưa lưu — bản nháp đã được giữ" : st.saved ? "✓ Đã lưu" + (st.savedAt ? " " + T.fmtDateTime(st.savedAt).slice(11) : "") : "Ghi chú trống";
      var cls = "st " + (dirty ? "dirty" : "ok"), off = !dirty || st.status === "trashed";
      if (r.stState.textContent !== text) r.stState.textContent = text;
      if (r.stState.className !== cls) r.stState.className = cls;
      if (r.saveBtn.disabled !== off) r.saveBtn.disabled = off;
    }
    /** Việc đắt (quét cả note): số từ + số thẻ ôn. Bỏ qua khi nội dung y như lần đếm trước. */
    var countedFor = null;
    function updateCounts() {
      if (!el) return;
      var c = st.cur.content;
      if (c === countedFor) return;
      countedFor = c;
      var cards = F.extractCards(id, c).length, w = words(c);
      el._refs.stCounts.textContent = w.toLocaleString("vi-VN") + " từ" + (cards ? " · " + cards + " thẻ ôn" : "");
    }
    function setStatus() { countsSoon.flush(); setDirtyState(); updateCounts(); }

    // ------------------------------------------------------------------------------------------- lưu / thao tác
    function save() {
      if (!isDirty() || st.status === "trashed") return Promise.resolve(false);
      var cur = st.cur, title = cur.title.trim();
      if (st.virtual && N.isBlank(cur.content, N.DAILY_TEMPLATE)) { ctx.toast("Hãy viết gì đó vào ghi chú ngày trước khi lưu."); return Promise.resolve(false); }
      if (!title && !cur.content.trim()) { ctx.toast("Ghi chú đang trống."); return Promise.resolve(false); }
      queueDraft.flush();
      var input = { id: id, title: title, content: cur.content, tags: cur.tags, kind: cur.kind, rel: cur.rel, meta: cur.meta, fav: cur.fav };
      if (st.virtual || st.isNew) { input.created_at = st.base.created_at; }
      return repo.save(input).then(function (res) {
        st.base = Object.assign({}, res.note); st.cur = snapshot(res.note); st.saved = true; st.virtual = false; st.savedAt = repo.now(); st.draft = null; st.banner = "";
        if (st.isNew) { st.isNew = false; root.history.replaceState(null, "", "#/n/" + id); }
        titleIn.value = st.cur.title;
        renderBanner(); setStatus(); refreshPanel();
        ctx.toast(res.renamedFrom ? "Đã lưu. Các [[liên kết]] tới tên cũ đã được cập nhật." : "Đã lưu");
        return true;
      }, function (e) { ctx.toast("Không lưu được: " + e.message, { ms: 8000 }); return false; });
    }
    function toggleFav() {
      st.cur.fav = !st.cur.fav; el._refs.fav.setAttribute("aria-pressed", String(st.cur.fav));
      if (st.saved) repo.toggleFav(id).then(function (r) { st.base = Object.assign({}, st.base, { fav: r.note.fav, updated_at: r.note.updated_at }); setStatus(); ctx.toast(st.cur.fav ? "Đã ghim" : "Đã bỏ ghim"); });
      else changed();
    }
    function setStatusTo(status, msg, undo) {
      var go = function () { return save().then(function () { return repo.setStatus(id, status); }); };
      return go().then(function () {
        st.status = status; st.base = Object.assign({}, st.base, { status: status });
        ctx.toast(msg, { action: undo ? { label: "Hoàn tác", run: function () { repo.setStatus(id, undo).then(function () { st.status = undo; renderBanner(); applyMode(); renderTags(); ta.readOnly = false; titleIn.readOnly = false; }); } } : null, ms: 6000 });
        if (status !== "active") ctx.route({}, false, "notes");
      });
    }
    function trash() {
      if (!st.saved) { ctx.confirm("Bỏ ghi chú này?", "Ghi chú chưa được lưu; bản nháp sẽ bị xoá.", "Bỏ", true).then(function (ok) { if (ok) { repo.dropDraft(id).then(function () { st.cur = snapshot(st.base); ctx.route({}, false, "notes"); }); } }); return; }
      ctx.confirm("Chuyển vào thùng rác?", "“" + (st.cur.title || "Chưa đặt tên") + "” sẽ nằm trong thùng rác 30 ngày, khôi phục được.", "Chuyển vào thùng rác", true).then(function (ok) { if (ok) setStatusTo("trashed", "Đã chuyển vào thùng rác", "active"); });
    }
    function showMenu() {
      var s = st.status, items = [
        { label: "Lưu", icon: "check", run: save, disabled: !isDirty() },
        { sep: true },
        s === "archived" ? { label: "Bỏ lưu trữ", icon: "archive", run: function () { repo.setStatus(id, "active").then(function () { st.status = "active"; renderBanner(); ctx.toast("Đã bỏ lưu trữ"); }); } } : { label: "Lưu trữ", icon: "archive", run: function () { setStatusTo("archived", "Đã lưu trữ", "active"); }, disabled: !st.saved },
        { label: "Chuyển vào thùng rác", icon: "trash", danger: true, run: trash },
        { sep: true },
        { label: "Đồ thị quanh note này", icon: "graph", run: function () { ctx.route({ c: id }, false, "graph"); }, disabled: !st.saved },
        { label: "Chèn thẻ hỏi–đáp", icon: "card", run: function () { toolAct("card"); } },
        { label: "Sao chép liên kết [[…]]", icon: "link", run: function () { U.copyText("[[" + (st.cur.title || "Chưa đặt tên") + "]]").then(function (ok) { ctx.toast(ok ? "Đã sao chép [[" + st.cur.title + "]]" : "Không sao chép được"); }); } },
        { sep: true },
        { label: "In / Lưu PDF", icon: "print", run: function () { W.ui.exporters.print(snapshotNote(), ctx); } },
        { label: "Tải ảnh PNG", icon: "image", run: function () { W.ui.exporters.png(snapshotNote(), ctx); } },
        { label: "Tải Markdown (.md)", icon: "download", run: function () { var n = snapshotNote(); U.download(W.backup.safeName(n.title) + ".md", new Blob([W.backup.toMarkdownFile(n, function (x) { var hd = repo.head(x); return hd && hd.title; })], { type: "text/markdown" })); } },
        { label: "Sao chép Markdown", icon: "copy", run: function () { U.copyText(st.cur.content).then(function (ok) { ctx.toast(ok ? "Đã sao chép nội dung" : "Không sao chép được"); }); } },
        { sep: true },
        { label: "Thông tin", icon: "info", run: info }
      ];
      U.menu(el._refs.more, items);
    }
    function snapshotNote() { return N.normalizeNote(Object.assign({ id: id, created_at: st.base.created_at, updated_at: st.base.updated_at, status: st.status }, st.cur, { title: st.cur.title.trim() || "Chưa đặt tên" }), repo.now(), { newId: true }); }
    function info() {
      var b = st.base, rows = [["Id", id], ["Tạo", T.fmtDateTime(b.created_at)], ["Sửa", T.fmtDateTime(b.updated_at)], ["Số từ", String(words(st.cur.content))], ["Ký tự", st.cur.content.length.toLocaleString("vi-VN")], ["Loại", st.cur.kind], ["Trạng thái", st.status]];
      var dl = h("dl", { class: "info-meta" }); rows.forEach(function (r) { dl.append(h("dt", { text: r[0] }), h("dd", { text: r[1] })); });
      U.dialog("Thông tin ghi chú", [dl]);
    }

    // ------------------------------------------------------------------------------------------- thanh công cụ
    function toolAct(a) {
      if (st.status === "trashed") return;
      if (st.mode === "preview") { st.mode = "edit"; applyMode(); }
      switch (a) {
        case "b": wrapSel(ta, "**", "**", "đậm"); break;
        case "i": wrapSel(ta, "*", "*", "nghiêng"); break;
        case "code": wrapSel(ta, "`", "`", "code"); break;
        case "link": wrapSel(ta, "[[", "]]", ""); if (ta.selectionStart === ta.selectionEnd) updateSuggest(); break;
        case "h": prefixLines(ta, function (l) { var m = /^(#{1,5})\s/.exec(l); return m ? "#" + l : /^#{6}\s/.test(l) ? l.replace(/^#{6}\s/, "") : "## " + l.replace(/^#+\s*/, ""); }); break;
        case "ul": prefixLines(ta, function (l) { return /^- /.test(l) ? l.slice(2) : "- " + l; }); break;
        case "ol": prefixLines(ta, function (l, i) { return /^\d+\.\s/.test(l) ? l.replace(/^\d+\.\s/, "") : (i + 1) + ". " + l; }); break;
        case "task": prefixLines(ta, function (l) { return /^- \[[ x]\] /.test(l) ? l.replace(/^- \[[ x]\] /, "") : "- [ ] " + l.replace(/^- /, ""); }); break;
        case "quote": prefixLines(ta, function (l) { return /^> /.test(l) ? l.slice(2) : "> " + l; }); break;
        case "fence": var fs = ta.selectionStart, had = ta.selectionEnd > fs; insertAt(ta, "```\n" + ta.value.slice(fs, ta.selectionEnd) + "\n```\n"); if (!had) ta.setSelectionRange(fs + 4, fs + 4); break;
        case "card": var cp = ta.selectionStart, pre = cp > 0 && ta.value.charAt(cp - 1) !== "\n" ? "\n\n" : ""; insertAt(ta, pre + "Q: \nA: \n"); ta.setSelectionRange(cp + pre.length + 3, cp + pre.length + 3); break;
        case "table": insertAt(ta, "\n| Cột 1 | Cột 2 |\n|-------|-------|\n|       |       |\n"); break;
      }
      ta.focus();
    }
    function onKey(e) {
      if (sug.open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sug.at = (sug.at + (e.key === "ArrowDown" ? 1 : sug.items.length - 1)) % sug.items.length; drawSuggest(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickSuggest(sug.at); return; }
        if (e.key === "Escape") { e.preventDefault(); closeSuggest(); return; }
      }
      var mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey) {
        var k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); toolAct("b"); } else if (k === "i") { e.preventDefault(); toolAct("i"); } else if (k === "k") { e.preventDefault(); toolAct("link"); }
      }
      if (e.key === "Enter" && !e.shiftKey && !mod) {                                     // Enter tiếp tục danh sách đang gõ
        var v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s), m = /^(\s*)([-*+]|\d+\.)\s(\[[ x]\]\s)?(.*)$/.exec(line);
        if (m && ta.selectionStart === ta.selectionEnd) {
          e.preventDefault();
          if (!m[4]) { ta.setSelectionRange(ls, s); insertAt(ta, ""); return; }          // dòng rỗng của danh sách: kết thúc danh sách
          var next = /\d/.test(m[2].charAt(0)) ? (parseInt(m[2], 10) + 1) + "." : m[2];
          insertAt(ta, "\n" + m[1] + next + " " + (m[3] ? "[ ] " : ""));
        }
      }
    }

    // ------------------------------------------------------------------------------------------- gợi ý [[
    function updateSuggest() {
      if (st.status === "trashed") return closeSuggest();
      var pos = ta.selectionStart, before = ta.value.slice(Math.max(0, pos - 120), pos), m = /\[\[([^\[\]\n]*)$/.exec(before);
      if (!m || ta.selectionStart !== ta.selectionEnd) return closeSuggest();
      var q = m[1], bar = q.indexOf("|"); if (bar !== -1) return closeSuggest();
      var tm = /^([a-z_]+)::(.*)$/i.exec(q), typed = tm && N.REL_TYPES.indexOf(tm[1].toLowerCase()) !== -1, key = typed ? tm[2] : q;
      var items = repo.suggest(key, 8).filter(function (x) { return x.id !== id; }).map(function (x) { return { title: x.title, sub: x.tags.slice(0, 2).join(" · ") }; });
      if (key.trim() && !repo.resolve(key)) items.push({ title: key.trim(), create: true });
      if (!items.length) return closeSuggest();
      sug = { open: true, items: items, at: 0, from: pos - m[1].length + (typed ? tm[1].length + 2 : 0), q: key };
      drawSuggest();
    }
    function drawSuggest() {
      var box = el._refs.suggest; box.hidden = false;
      box.replaceChildren.apply(box, sug.items.map(function (it, i) {
        var b = h("button", { type: "button", role: "option", class: "sg" + (i === sug.at ? " on" : ""), "aria-selected": String(i === sug.at) });
        b.innerHTML = it.create ? "<span>Tạo mới: <b>" + T.esc(it.title) + "</b></span>" : "<span>" + T.esc(it.title) + "</span><small>" + T.esc(it.sub || "") + "</small>";
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); pickSuggest(i); });
        return b;
      }));
    }
    function closeSuggest() { sug.open = false; if (el && el._refs) el._refs.suggest.hidden = true; }
    function pickSuggest(i) {
      var it = sug.items[i]; if (!it) return;
      var end = ta.selectionStart; ta.setSelectionRange(sug.from, end);
      var after = ta.value.slice(end, end + 2) === "]]" ? 2 : 0;
      insertAt(ta, it.title + (after ? "" : "]]"));
      if (after) ta.setSelectionRange(ta.selectionStart + 2, ta.selectionStart + 2);
      closeSuggest();
    }

    // ------------------------------------------------------------------------------------------- bảng liên kết
    function refreshPanel() {
      if (!el) return;
      var side = el._refs.side, heads = M.headings(st.cur.content);
      (st.saved ? repo.relations(id) : Promise.resolve({ items: [], ghosts: [] })).then(function (rel) {
        if (st.destroyed) return;
        st.rel = rel;
        var out = [], ins = [];
        rel.items.forEach(function (r) { (r.dir === "out" ? out : ins).push(r); });
        function list(items) { return items.map(function (r) { return '<li><a href="#/n/' + T.esc(r.head.id) + '"><span class="rl">' + T.esc(r.label) + "</span><span class=\"rt\">" + T.esc(r.head.title) + "</span></a></li>"; }).join(""); }
        var html = "";
        html += '<section class="sp"><h3>Được tham chiếu bởi <small>' + ins.length + "</small></h3>" + (ins.length ? "<ul>" + list(ins) + "</ul>" : '<p class="faint">Chưa có note nào trỏ tới note này. Ở note khác, gõ <code>[[' + T.esc(st.cur.title || "Tên note") + "]]</code>.</p>") + "</section>";
        html += '<section class="sp"><h3>Liên kết & quan hệ <small>' + (out.length + st.cur.rel.length) + "</small></h3>" + (out.length ? "<ul>" + list(out) + "</ul>" : "") +
          (rel.ghosts.length ? '<p class="faint gh">Chưa có note:</p><ul>' + rel.ghosts.map(function (g) { return '<li><button type="button" class="link-btn" data-create="' + T.esc(g.title) + '">+ ' + T.esc(g.title) + "</button></li>"; }).join("") + "</ul>" : "") +
          (!out.length && !rel.ghosts.length && !st.cur.rel.length ? '<p class="faint">Chưa có liên kết đi.</p>' : "") + "</section>";
        html += '<section class="sp"><h3>Quan hệ thêm tay</h3>' + (st.cur.rel.length ? '<ul class="rels">' + st.cur.rel.map(function (r, i) { var hd = repo.head(r.id); return "<li><span class=\"rl\">" + T.esc(N.REL_LABEL[r.t][0]) + "</span> <b>" + T.esc(hd ? hd.title : "(đã xoá)") + '</b><button type="button" class="icon-btn sm" data-delrel="' + i + '" aria-label="Bỏ quan hệ" title="Bỏ">' + icon("x") + "</button></li>"; }).join("") + "</ul>" : "") +
          '<form class="relform"><select aria-label="Kiểu quan hệ">' + REL_OPTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("") + '</select><input type="text" placeholder="Tên note đích…" autocomplete="off" aria-label="Note đích"><div class="rsug" hidden></div></form></section>';
        html += '<section class="sp"><h3>Mục lục <small>' + heads.length + "</small></h3>" + (heads.length ? '<ul class="outline">' + heads.map(function (x) { return '<li style="--lv:' + (x.level - 1) + '"><button type="button" class="link-btn" data-goto="' + x.line + '" data-id="' + T.esc(x.id) + '">' + T.esc(x.text) + "</button></li>"; }).join("") + "</ul>" : '<p class="faint">Thêm tiêu đề <code># …</code> để có mục lục.</p>') + "</section>";
        side.innerHTML = html;
        wireRelForm();
      });
    }
    function wireRelForm() {
      var form = $(".relform", el), inp = $("input", form), box = $(".rsug", form), sel = $("select", form);
      if (!form) return;
      function show() {
        var items = repo.suggest(inp.value, 6).filter(function (x) { return x.id !== id; });
        box.hidden = !items.length || !inp.value.trim();
        box.replaceChildren.apply(box, items.map(function (x) { var b = h("button", { type: "button", class: "sg", text: x.title }); b.addEventListener("pointerdown", function (e) { e.preventDefault(); add(x); }); return b; }));
      }
      function add(x) {
        if (st.cur.rel.some(function (r) { return r.t === sel.value && r.id === x.id; })) { ctx.toast("Quan hệ này đã có."); return; }
        st.cur.rel.push({ t: sel.value, id: x.id }); changed(); refreshPanel(); ctx.toast("Đã thêm quan hệ — nhớ bấm Lưu");
      }
      inp.addEventListener("input", show);
      form.addEventListener("submit", function (e) { e.preventDefault(); var x = repo.resolve(inp.value) || repo.suggest(inp.value, 1)[0]; if (x && x.id !== id) add(x); else ctx.toast("Không thấy note đó."); });
    }
    function onSide(e) {
      var c = e.target.closest("[data-create]"), d = e.target.closest("[data-delrel]"), g = e.target.closest("[data-goto]");
      if (c) ctx.newNote({ title: c.dataset.create, from: id });
      else if (d) { st.cur.rel.splice(+d.dataset.delrel, 1); changed(); refreshPanel(); }
      else if (g) {
        if (st.mode === "preview") { var t = prev.querySelector("#" + CSS.escape(g.dataset.id)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
        else { var lines = ta.value.split("\n"), pos = 0, i; for (i = 0; i < +g.dataset.goto; i++) pos += lines[i].length + 1; ta.focus(); ta.setSelectionRange(pos, pos + lines[i].length); var lh = parseFloat(root.getComputedStyle(ta).lineHeight) || 24; ta.scrollTop = Math.max(0, +g.dataset.goto * lh - ta.clientHeight / 3); }
      }
    }

    load().then(function () { if (!st.destroyed) build(); }, function (e) { host.replaceChildren(h("p", { class: "ed-loading", text: "Không mở được ghi chú: " + e.message })); });

    return {
      focus: function () { if (ta) ta.focus(); },
      isDirty: isDirty, save: save,
      destroy: function () {
        if (st.destroyed) return;
        queueDraft.flush(); countsSoon.flush();
        var was = isDirty();
        var p = saveDraftNow();
        st.destroyed = true;
        cleanup.forEach(function (f) { f(); });
        if (was) ctx.toast("Đã giữ bản nháp chưa lưu", { ms: 3000 });
        return p;
      }
    };
  }

  U.editor = { open: open, wordCount: wordCount };
})(typeof globalThis !== "undefined" ? globalThis : this);
