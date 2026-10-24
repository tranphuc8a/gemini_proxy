/* ui/aicompose.js — màn "Soạn bằng AI" (#/ai, phím a): dán ghi chép thô → AI (POST /ai/wiki qua data/ai.js) soạn 1–5 ghi chú Markdown nối tới
   chủ đề đã có → XEM TRƯỚC, sửa (tiêu đề, tag, nội dung, quan hệ, chủ đề mới) → tạo. Hoàn tác được (hàm ngược tạo bản ghi mới hơn).

   Bước 1  ô dán (≤ 12.000 ký tự, giữ nháp trong IndexedDB: repo meta "aiDraft"), gợi ý, "Một ghi chú" / "Tách theo chủ đề (tối đa 5)",
           chip "N chủ đề liên quan trên máy bạn" (repo.related, chọn lại 300 ms sau khi ngừng gõ; bỏ chọn được) + "Chỉ gửi tiêu đề",
           câu nói rõ cái gì được gửi đi. Không có máy chủ / ngoại tuyến / AI tắt / chỉ quản trị → nút Soạn tắt kèm lý do; cần mã → ô nhập mã.
           Không tự gửi khi có mạng lại (khỏi tốn hạn mức).
   Bước 2  mỗi ghi chú một thẻ: tiêu đề, trùng ghi chú có sẵn (mặc định tạo bản mới — AI không sửa ghi chú cũ; "Gộp" chỉ khi người dùng chọn),
           tag, Xem/Sửa, quan hệ (bật/tắt, đổi kiểu), chủ đề mới (giữ = liên kết mờ). Cảnh báo dropped / shrunk / truncated.
   Bước 3  compose.plan kiểm lại liên kết trên trạng thái kho LÚC ÁP DỤNG → repo.save tuần tự → toast "Đã tạo N ghi chú" + Hoàn tác (14 s) → mở ghi chú đầu.
   Mọi chuỗi từ AI/dữ liệu vào DOM đều qua h(…, {text}) hoặc T.esc; markdown qua trình dựng an toàn sẵn có (Wiki.markdown, noLinks). */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, N = W.notes, M = W.markdown, C = W.compose, U = W.ui, h = U.h, icon = U.icon, $ = U.$, $$ = U.$$;
  var KIND = { existing: "có sẵn", batch: "trong lô", new: "chủ đề mới" };
  var REL_NAMES = [["link", "Tham chiếu"], ["related_to", "Liên quan tới"], ["depends_on", "Phụ thuộc vào"], ["parent_of", "Là cha của"], ["child_of", "Là con của"]];
  var UNDO_MS = 14000;

  function fmt(n) { return Number(n || 0).toLocaleString("vi-VN"); }
  function isOnline() { return U.pwa && U.pwa.isOnline ? U.pwa.isOnline() : root.navigator.onLine !== false; }

  /** Lý do chưa soạn được (null = được). kind: file | no_config | offline | status | loading | code | denied. */
  function blockOf(st) {
    var a = W.api || { has: false }, env = { available: !!a.has, online: isOnline(), protocol: root.location.protocol };
    var b = W.sync && W.sync.blocker ? W.sync.blocker(env) : (!env.available ? "no_config" : env.online ? "" : "offline");
    if (b === "file") return { kind: "file", text: "Bạn đang mở tệp trực tiếp (file://) — Soạn bằng AI cần mở app qua máy chủ (…/webapp/tranphuc8a/personal-wiki/). Ghi chép vẫn được giữ trên máy." };
    if (b === "no_config") return { kind: "no_config", text: "Trang không nhận được địa chỉ máy chủ — tải lại trang để dùng AI." };
    if (b === "offline") return { kind: "offline", text: "Đang ngoại tuyến — cần mạng để soạn bằng AI. Bản nháp vẫn được giữ trên máy; app không tự gửi khi có mạng lại." };
    if (st.statusErr) return { kind: "status", text: st.statusErr };
    if (!st.status) return { kind: "loading", text: "Đang hỏi máy chủ về quyền dùng AI…" };
    var bl = W.ai.blocker(st.status);
    if (bl === "code") return { kind: "code", text: "Cần mã truy cập AI — nhập mã bên dưới (hỏi quản trị viên của máy chủ)." };
    return bl ? { kind: "denied", text: bl } : null;
  }

  /** Hoàn tác MỘT lần áp dụng (chạy cả khi màn đã đóng): ghi chú tạo mới → Thùng rác; phần gộp → gỡ đúng đoạn đã nối và tag đã thêm. */
  function undo(ctx, done) {
    var repo = ctx.repo, kept = [];
    return done.slice().reverse().reduce(function (p, x) {
      return p.then(function () {
        if (x.op === "create") { var hd = repo.head(x.id); return hd && hd.s !== "trashed" ? repo.save({ id: x.id, status: "trashed" }) : null; }
        return repo.get(x.id).then(function (cur) {
          var back = cur ? C.unappend(cur.content, x.add) : null;
          if (back == null) { kept.push(x.title); return null; }
          return repo.save({ id: x.id, content: back, tags: cur.tags.filter(function (t) { return x.addedTags.indexOf(t) === -1; }) });
        });
      });
    }, Promise.resolve()).then(function () {
      ctx.toast(kept.length ? "Đã hoàn tác. Ghi chú “" + kept.join("”, “") + "” đã được sửa sau khi gộp nên giữ nguyên." : "Đã hoàn tác — ghi chú vừa tạo đã vào Thùng rác.");
    }, function (e) { ctx.toast("Hoàn tác chưa xong: " + (e && e.message || e)); });
  }

  function open(ctx, host) {
    var repo = ctx.repo, AI = W.ai;
    var st = { destroyed: false, split: false, titlesOnly: false, exclude: new Set(), ranked: [], status: null, statusErr: "", busy: false, draft: null, candSeq: 0, statusSeq: 0 };
    var el = h("div", { class: "page aic" });
    host.replaceChildren(el);

    // --------------------------------------------------------------------------------------- bước 1
    var block = h("p", { class: "warn aic-block", role: "status", hidden: true });
    var ta = h("textarea", { id: "aicText", class: "aic-ta", rows: 10, maxlength: String(C.LIM.text), placeholder: "Dán ghi chép, bài giảng, đoạn chat, nhật ký… AI sắp xếp thành ghi chú Markdown và nối tới chủ đề bạn đã có.", spellcheck: "false" });
    var count = h("p", { class: "hint aic-count", "aria-live": "off" });
    var hint = h("input", { id: "aicHint", type: "text", maxlength: String(C.LIM.hint), autocomplete: "off", placeholder: "vd: ghi chú học Kubernetes, giữ thuật ngữ tiếng Anh" });
    var seg = h("div", { class: "seg aic-split", role: "group", "aria-label": "Số ghi chú" });
    [[false, "Một ghi chú"], [true, "Tách theo chủ đề (tối đa 5)"]].forEach(function (o) {
      seg.append(h("button", { type: "button", "aria-pressed": "false", dataset: { split: o[0] ? "1" : "0" }, on: { click: function () { st.split = o[0]; drawSeg(); saveSoon(); } } }, h("span", { text: o[1] })));
    });
    var candHead = h("h3", { class: "aic-ch" }), chips = h("div", { class: "aic-chips" });
    var titlesOnly = h("input", { type: "checkbox", id: "aicTitlesOnly", on: { change: function () { st.titlesOnly = titlesOnly.checked; drawPrivacy(); saveSoon(); } } });
    var privacy = h("p", { class: "hint aic-privacy" });
    var codeIn = h("input", { id: "aicCode", type: "password", autocomplete: "off", maxlength: "200", placeholder: "Mã truy cập AI" });
    var codeErr = h("p", { class: "form-err", role: "alert", hidden: true });
    var codeBox = h("form", { class: "aic-code", hidden: true, novalidate: true, on: { submit: function (e) { e.preventDefault(); unlock(); } } },
      h("label", { for: "aicCode", text: "Mã truy cập AI" }), h("div", { class: "aic-code-row" }, codeIn, h("button", { type: "submit", class: "btn", text: "Mở khoá" })), codeErr);
    var go = h("button", { type: "button", class: "btn btn-primary aic-go", id: "aicGo", html: icon("spark") + "<span>Soạn</span>", on: { click: compose } });
    var why = h("p", { class: "hint aic-why", role: "status" });
    var err = h("p", { class: "form-err aic-err", role: "alert", hidden: true });
    var inBox = h("section", { class: "set aic-in", "aria-label": "Ghi chép thô" },
      h("div", { class: "field" }, h("label", { for: "aicText", text: "Ghi chép thô" }), ta, count),
      h("div", { class: "field" }, h("label", { for: "aicHint", text: "Gợi ý cho AI (tuỳ chọn)" }), hint),
      seg,
      h("div", { class: "aic-cands" }, candHead, chips,
        h("label", { class: "aic-only" }, h("span", { class: "switch" }, titlesOnly, h("span")), h("span", { text: "Chỉ gửi tiêu đề (không gửi tag, đoạn trích, danh sách tag)" }))),
      privacy, codeBox,
      h("div", { class: "btn-row" }, go), why, err);

    // --------------------------------------------------------------------------------------- bước 2
    var out = h("section", { class: "aic-out", "aria-label": "Xem trước", hidden: true });
    el.append(
      h("header", { class: "ph" }, h("div", null, h("h1", { text: "Soạn bằng AI" }), h("p", { class: "ph-sub", text: "Dán ghi chép thô — AI sắp xếp thành ghi chú Markdown, nối tới chủ đề bạn đã có. Bạn xem trước, sửa rồi mới tạo." }))),
      block, inBox, out);

    // --------------------------------------------------------------------------------------- trạng thái chung
    function drawSeg() { $$("button", seg).forEach(function (b) { b.setAttribute("aria-pressed", String((b.dataset.split === "1") === st.split)); }); }
    function picked() { return st.ranked.filter(function (r) { return !st.exclude.has(r.h.id); }).length; }
    function drawPrivacy() {
      var n = picked();
      privacy.textContent = "Gửi tới máy chủ: văn bản này" + (n ? (st.titlesOnly ? " + tiêu đề của " + n + " chủ đề đã chọn." : " + tiêu đề, tag và đoạn trích ngắn của " + n + " chủ đề đã chọn, và danh sách tag của wiki.") : (st.titlesOnly ? "." : " và danh sách tag của wiki.")) + " Không lưu trên máy chủ.";
    }
    function drawCount() { count.textContent = fmt(ta.value.length) + " / " + fmt(C.LIM.text) + " ký tự"; }
    function evaluate() {
      if (st.destroyed) return;
      var b = blockOf(st), empty = !ta.value.trim();
      var shown = b && /^(file|no_config|offline|status|denied)$/.test(b.kind);
      block.hidden = !shown; block.textContent = shown ? b.text : ""; block.dataset.aiBlock = shown ? b.kind : "";
      codeBox.hidden = !(b && b.kind === "code");
      go.disabled = !!(st.busy || b || empty);
      why.textContent = st.busy ? "AI đang soạn… (có thể mất tới một phút)" : b ? b.text : empty ? "Dán ghi chép vào ô trên để bắt đầu." : "";
      why.dataset.kind = st.busy ? "busy" : b ? b.kind : empty ? "empty" : "";
    }
    function askStatus(force) {
      var a = W.api || {};
      if (!a.has || !isOnline()) { evaluate(); return; }
      var seq = ++st.statusSeq;
      AI.status(force).then(function (s) { if (st.destroyed || seq !== st.statusSeq) return; st.status = s; st.statusErr = ""; evaluate(); },
        function (e) { if (st.destroyed || seq !== st.statusSeq) return; st.status = null; st.statusErr = e.code === "no_server" ? "" : "Không hỏi được máy chủ về AI: " + (e.message || e); evaluate(); });
    }
    function unlock() {
      codeErr.hidden = true;
      AI.unlock(codeIn.value).then(function (s) { if (st.destroyed) return; st.status = s; st.statusErr = ""; codeIn.value = ""; evaluate(); ctx.toast("Đã mở khoá AI trên máy này"); },
        function (e) { codeErr.textContent = e.message || String(e); codeErr.hidden = false; codeIn.focus(); });
    }

    // nháp (IndexedDB, repo meta) — tải lại / sập trang vẫn còn
    function writeDraft() {
      return repo.setMeta("aiDraft", ta.value || hint.value ? { text: ta.value, hint: hint.value, split: st.split, titlesOnly: st.titlesOnly } : null).catch(function () { /* kho tạm (riêng tư) */ });
    }
    var saveSoon = U.debounce(function () { if (!st.destroyed) writeDraft(); }, 400);
    function saveNow() { saveSoon.flush(); return writeDraft(); }        // debounce.flush() = huỷ lượt đang chờ

    // ứng viên liên quan
    var candSoon = U.debounce(refreshCands, 300);
    function refreshCands() {
      var text = ta.value, seq = ++st.candSeq;
      if (!text.trim()) { st.ranked = []; drawCands(); return; }
      repo.related(text, { k: C.LIM.k }).then(function (r) { if (st.destroyed || seq !== st.candSeq) return; st.ranked = r; drawCands(); }, function () { if (seq === st.candSeq) { st.ranked = []; drawCands(); } });
    }
    function drawHead() {
      candHead.textContent = st.ranked.length ? "Sẽ gửi kèm " + picked() + " chủ đề liên quan trên máy bạn" : "Chủ đề liên quan trên máy bạn";
      drawPrivacy();
    }
    function drawCands() {
      chips.replaceChildren.apply(chips, st.ranked.length ? st.ranked.map(function (r) {
        // bật/tắt một chip chỉ đổi chip đó + dòng đếm (không dựng lại cả danh sách — giữ focus cho bàn phím)
        var cb = h("input", { type: "checkbox", checked: st.exclude.has(r.h.id) ? null : true, on: { change: function () { if (cb.checked) st.exclude.delete(r.h.id); else st.exclude.add(r.h.id); lab.classList.toggle("on", cb.checked); drawHead(); } } });
        var lab = h("label", { class: "chip aic-cand" + (cb.checked ? " on" : ""), title: r.h.sn || r.h.title, dataset: { id: r.h.id } }, cb, h("span", { text: r.h.title }));
        return lab;
      }) : [h("p", { class: "faint", text: ta.value.trim() ? "Chưa thấy ghi chú nào liên quan — AI chỉ dựa vào văn bản (liên kết tới chủ đề mới vẫn được đề xuất)." : "Dán ghi chép để xem các ghi chú liên quan sẽ gửi kèm." })]);
      drawHead();
    }

    // --------------------------------------------------------------------------------------- gọi AI
    function compose() {
      if (go.disabled) return;
      err.hidden = true;
      var sel = C.candidates(st.ranked, { exclude: st.exclude, titlesOnly: st.titlesOnly });
      var body = C.request({ text: ta.value, hint: hint.value, maxNotes: st.split ? C.LIM.maxNotes : 1, candidates: sel.list, tags: repo.tags(), titlesOnly: st.titlesOnly });
      st.busy = true; evaluate(); saveNow();
      AI.compose(body).then(function (res) {
        if (st.destroyed) return;
        var d = C.fromResult(res);
        if (!d.notes.length) throw Object.assign(new Error("AI không trả về ghi chú nào dùng được — thử lại."), { code: "empty" });
        d.refs = sel.refs; st.draft = d;
        drawPreview();
        out.scrollIntoView({ block: "start", behavior: "smooth" });
      }).catch(function (e) {
        if (st.destroyed) return;
        if (e.code === "ai_code_required") { st.status = Object.assign({}, st.status || { enabled: true }, { allowed: false, needs: "code" }); AI.status(true).catch(function () {}); }
        else if (e.code === "ai_admin_only") st.status = Object.assign({}, st.status || { enabled: true }, { allowed: false, needs: "admin" });
        err.textContent = (e.message || String(e)) + (e.retryAfter ? " (thử lại sau " + fmt(e.retryAfter) + " giây)" : "");
        err.hidden = false;
      }).then(function () { st.busy = false; evaluate(); });
    }

    // --------------------------------------------------------------------------------------- bước 2: xem trước
    function previewResolve(title) {
      var hd = repo.resolve(title);
      if (hd) return { id: hd.id, status: hd.s };
      var key = T.titleKey(title);
      return st.draft && st.draft.notes.some(function (n) { return n.on && (T.titleKey(n.title) === key || T.titleKey(n.aiTitle) === key); }) ? { id: "", status: "active" } : null;
    }
    function onCount() { return st.draft ? st.draft.notes.filter(function (n) { return n.on; }).length : 0; }
    function noteCard(n) {
      var card = h("article", { class: "aic-note", dataset: { key: n.key } });
      var on = h("input", { type: "checkbox", checked: n.on ? true : null, "aria-label": "Tạo ghi chú này", on: { change: function () { n.on = on.checked; card.classList.toggle("off", !n.on); drawApply(); } } });
      var title = h("input", { type: "text", class: "aic-title", value: n.title, maxlength: "120", "aria-label": "Tiêu đề ghi chú", on: { input: function () { n.title = title.value; } } });
      card.append(h("div", { class: "aic-nh" }, h("label", { class: "aic-on", title: "Tạo ghi chú này" }, on, h("span", { text: "Tạo" })), title));
      if (n.existing) {
        var dseg = h("div", { class: "seg aic-dup-seg", role: "group", "aria-label": "Trùng tiêu đề" });
        [["new", "Tạo bản mới (đổi tên)"], ["append", "Gộp vào ghi chú có sẵn"]].forEach(function (o) {
          dseg.append(h("button", { type: "button", "aria-pressed": String(n.mode === o[0]), dataset: { mode: o[0] }, on: { click: function () { n.mode = o[0]; $$("button", dseg).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === n.mode)); }); } } }, h("span", { text: o[1] })));
        });
        card.append(h("div", { class: "aic-dup" }, h("p", { class: "hint", text: "Trùng tiêu đề với ghi chú có sẵn “" + n.existing.title + "”. Mặc định tạo ghi chú mới (tự thêm “(2)”); “Gộp” nối thêm mục “Bổ sung” vào cuối ghi chú cũ." }), dseg));
      }
      if (n.summary) card.append(h("p", { class: "aic-sum", text: n.summary }));
      // tag
      var tagsBox = h("div", { class: "aic-tags" }), tagIn = h("input", { class: "tag-in", type: "text", placeholder: "+ tag", maxlength: "40", autocomplete: "off", autocapitalize: "none", "aria-label": "Thêm tag" });
      function drawTags() {
        tagsBox.replaceChildren.apply(tagsBox, n.tags.map(function (t) {
          return h("span", { class: "chip on tagchip" }, h("span", { class: "tagname", text: "#" + t }), h("button", { type: "button", class: "tagx", "aria-label": "Bỏ tag " + t, html: icon("x"), on: { click: function () { n.tags = n.tags.filter(function (x) { return x !== t; }); drawTags(); } } }));
        }).concat([tagIn]));
      }
      tagIn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); var add = N.normTags(tagIn.value); if (add.length) { n.tags = N.normTags(n.tags.concat(add)).slice(0, 8); tagIn.value = ""; drawTags(); tagIn.focus(); } } });
      drawTags();
      card.append(tagsBox);
      // Xem / Sửa
      var view = h("div", { class: "md aic-md" }), edit = h("textarea", { class: "aic-ed", rows: 14, "aria-label": "Nội dung Markdown", hidden: true, spellcheck: "false", on: { input: function () { n.markdown = edit.value; } } });
      edit.value = n.markdown;
      function drawView() { view.innerHTML = M.render(n.markdown, { highlight: W.highlight, noLinks: true, resolve: previewResolve }) || '<p class="faint">Trống.</p>'; if (U.rich) U.rich.hydrate([view]); }
      var tabs = h("div", { class: "seg aic-tabs", role: "group", "aria-label": "Xem hoặc sửa" });
      [["view", "Xem"], ["edit", "Sửa"]].forEach(function (o) {
        tabs.append(h("button", { type: "button", "aria-pressed": String(o[0] === "view"), dataset: { tab: o[0] }, on: { click: function () {
          var ed = o[0] === "edit";
          $$("button", tabs).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tab === o[0])); });
          edit.hidden = !ed; view.hidden = ed;
          if (ed) edit.focus(); else drawView();
        } } }, h("span", { text: o[1] })));
      });
      drawView();
      card.append(tabs, view, edit);
      // quan hệ
      if (n.relations.length) {
        var ul = h("ul", { class: "aic-rels" });
        n.relations.forEach(function (r) {
          var cb = h("input", { type: "checkbox", checked: r.on ? true : null, "aria-label": "Giữ quan hệ tới " + r.target.title, on: { change: function () { r.on = cb.checked; li.classList.toggle("off", !r.on); } } });
          var sel = h("select", { class: "aic-rt", "aria-label": "Kiểu quan hệ", on: { change: function () { r.type = sel.value; } } });
          REL_NAMES.forEach(function (o) { sel.append(h("option", { value: o[0], text: o[1], selected: o[0] === r.type ? true : null })); });
          var li = h("li", { class: "aic-rel" + (r.on ? "" : " off"), dataset: { kind: r.target.kind } }, cb, sel,
            h("span", { class: "aic-rtgt", text: r.target.title }), h("small", { class: "aic-kind", dataset: { kind: r.target.kind }, text: KIND[r.target.kind] || r.target.kind }),
            r.reason ? h("small", { class: "aic-why-r", text: r.reason }) : null);
          ul.append(li);
        });
        card.append(h("h4", { text: "Quan hệ (" + n.relations.length + ")" }), ul, h("p", { class: "hint", text: "Quan hệ được giữ thành mục “## Liên kết” ở cuối ghi chú mới; ghi chú cũ không bị sửa." }));
      }
      return card;
    }
    var applyBtn = h("button", { type: "button", class: "btn btn-primary aic-apply", id: "aicApply", on: { click: apply } });
    function drawApply() { var k = onCount(); applyBtn.textContent = k ? "Tạo " + k + " ghi chú" : "Chưa chọn ghi chú nào"; applyBtn.disabled = !k; }
    function drawPreview() {
      var d = st.draft, warns = [];
      d.notes.forEach(function (n) {                       // trùng một ghi chú KHÔNG nằm trong ứng viên đã gửi: máy chủ không biết, trang tự nhận ra
        var hd = n.existing ? null : repo.resolve(n.title);
        if (hd) n.existing = { ref: "", id: hd.id, title: hd.title };
      });
      if (d.dropped.length) warns.push("AI đã nhắc " + d.dropped.length + " liên kết không có trong wiki — đã đổi thành chữ thường: " + d.dropped.slice(0, 6).join(", ") + (d.dropped.length > 6 ? "…" : ""));
      if (d.shrunk) warns.push("Bản soạn ngắn hơn nhiều so với ghi chép gốc — hãy xem kỹ xem có mất ý không.");
      if (d.truncated) warns.push("Câu trả lời của AI bị cắt vì quá dài — phần cuối có thể thiếu. Thử chia ghi chép thành nhiều lần.");
      var topics = d.topics.length ? h("section", { class: "aic-topics" }, h("h3", { text: "Chủ đề mới AI đề xuất (" + d.topics.length + ")" }),
        h("p", { class: "hint", text: "Giữ = liên kết mờ tới chủ đề chưa có (bấm vào sau để tạo). Bỏ = liên kết và quan hệ tới chủ đề đó thành chữ thường." }),
        h("ul", { class: "aic-tlist" }, d.topics.map(function (t) {
          var cb = h("input", { type: "checkbox", checked: t.on ? true : null, on: { change: function () { t.on = cb.checked; } } });
          return h("li", null, h("label", null, cb, h("b", { text: t.title }), t.reason ? h("small", { text: " — " + t.reason }) : null));
        }))) : null;
      out.replaceChildren(
        h("div", { class: "hs-head" }, h("h2", { text: "Xem trước (" + d.notes.length + " ghi chú)" })),
        warns.length ? h("ul", { class: "warn aic-warn" }, warns.map(function (w) { return h("li", { text: w }); })) : null,
        h("div", { class: "aic-notes" }, d.notes.map(noteCard)),
        topics,
        h("div", { class: "btn-row aic-acts" }, applyBtn,
          h("button", { type: "button", class: "btn", text: "Soạn lại", on: { click: function () { st.draft = null; out.hidden = true; ta.focus(); } } }),
          h("button", { type: "button", class: "btn btn-ghost", text: "Huỷ", on: { click: function () { st.draft = null; out.hidden = true; } } })));
      drawApply();
      out.hidden = false;
    }

    // --------------------------------------------------------------------------------------- bước 3: áp dụng
    function apply() {
      if (!st.draft || applyBtn.disabled) return;
      var p = C.plan(st.draft, { resolve: function (t) { return repo.resolve(t); }, head: function (id) { return repo.head(id); }, today: T.dateKey(repo.now()) });
      if (!p.ops.length) return;
      applyBtn.disabled = true;
      var done = [], failure = null;
      p.ops.reduce(function (pr, op) {
        return pr.then(function () {
          if (op.op === "create") return repo.save({ title: op.title, content: op.content, tags: op.tags }).then(function (r) { done.push({ op: "create", id: r.note.id, title: r.note.title }); });
          return repo.get(op.id).then(function (cur) {
            if (!cur) return null;
            var tags = N.normTags(cur.tags.concat(op.tags)), added = tags.filter(function (t) { return cur.tags.indexOf(t) === -1; });
            return repo.save({ id: op.id, content: cur.content + op.add, tags: tags }).then(function (r) { done.push({ op: "append", id: op.id, title: r.note.title, add: op.add, addedTags: added }); });
          });
        });
      }, Promise.resolve()).catch(function (e) { failure = e; }).then(function () {
        var made = done.filter(function (x) { return x.op === "create"; }).length, merged = done.length - made;
        if (!done.length) { ctx.toast("Không tạo được ghi chú: " + (failure && failure.message || "lỗi không rõ")); if (!st.destroyed) drawApply(); return; }
        if (!failure) { st.draft = null; ta.value = ""; hint.value = ""; saveNow(); }
        var msg = (made ? "Đã tạo " + made + " ghi chú" : "") + (merged ? (made ? ", gộp vào " : "Đã gộp vào ") + merged + " ghi chú có sẵn" : "") +
          (p.renamed.length ? " (đổi tên: " + p.renamed.map(function (x) { return x.to; }).join(", ") + ")" : "") + (failure ? " — lỗi giữa chừng: " + failure.message : "");
        ctx.toast(msg, { ms: UNDO_MS, action: { label: "Hoàn tác", run: function () { undo(ctx, done); } } });
        ctx.open(done[0].id);
      });
    }

    // --------------------------------------------------------------------------------------- nối sự kiện
    ta.addEventListener("input", function () { drawCount(); evaluate(); candSoon(); saveSoon(); });
    hint.addEventListener("input", saveSoon);
    function onNet() { askStatus(false); evaluate(); }
    root.addEventListener("online", onNet); root.addEventListener("offline", onNet);
    drawSeg(); drawCount(); drawCands(); evaluate();
    repo.getMeta("aiDraft").catch(function () { return null; }).then(function (d) {
      if (st.destroyed) return;
      st.loaded = true;
      if (d && typeof d === "object" && !ta.value) {
        ta.value = String(d.text || "").slice(0, C.LIM.text); hint.value = String(d.hint || "").slice(0, C.LIM.hint);
        st.split = d.split === true; st.titlesOnly = d.titlesOnly === true; titlesOnly.checked = st.titlesOnly;
        drawSeg(); drawCount(); refreshCands();
      }
      evaluate();
    });
    askStatus(false);
    setTimeout(function () { if (!st.destroyed && !ta.value) ta.focus(); }, 30);

    return { destroy: function () {
      st.destroyed = true;
      root.removeEventListener("online", onNet); root.removeEventListener("offline", onNet);
      if (st.loaded) saveNow();                                           // chưa đọc xong nháp cũ thì đừng ghi đè nó bằng ô trống
    } };
  }

  U.aicompose = { open: open, undo: undo, blockOf: blockOf };
})(typeof globalThis !== "undefined" ? globalThis : this);
