/* ai.js (giao diện) — "✨ Giải thích lỗi bằng AI": thẻ ở đầu tab Vấn đề + nút ở dòng trạng thái của tab Kết quả khi lần chạy lỗi.
   Logic thuần (dựng yêu cầu, gọi máy chủ, kiểm kết quả, áp đề xuất) ở core/ai.js. Ở đây chỉ là vỏ.
   Quy tắc an toàn: mọi chuỗi AI trả về đi vào DOM qua textContent; đề xuất sửa chỉ được áp khi người dùng bấm, và chỉ khi
   tệp chưa đổi kể từ lúc hỏi (Ctrl+Z hoàn tác được). Mã của TỆP có lỗi và thông báo lỗi bị gửi tới dịch vụ AI (Gemini) qua máy chủ — thẻ nói rõ điều đó. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app, AI = CS.ai;
  var st = { itemId: null, avail: null, availAt: 0, probing: false, client: null, phase: "idle", ctx: null, result: null, error: null, applied: false, keep: false };

  function S() { return A.S; }
  function client() {
    if (!A.HAS_API || !AI) return null;
    if (!st.client) st.client = AI.client({ apiBase: A.API });
    return st.client;
  }

  /* ------------------------------------------------------------------ lấy ngữ cảnh lỗi từ lần chạy gần nhất */
  function failure() {
    var r = S().lastResult;
    if (!r || r.ok) return null;
    var c = r.compile, x = r.run || {};
    if (c && c.ran && !c.ok) return { kind: "compile", stderr: c.stderr || c.stdout || "" };
    return { kind: "runtime", stderr: x.stderr || "" };
  }
  function pick() {
    var it = S().item; if (!it) return null;
    var all = S().diags || [], errs = all.filter(function (d) { return d.severity === "error"; });
    var first = errs.filter(function (d) { return d.line; })[0] || errs[0] || all[0] || null, path = null;
    if (first) path = it.files.filter(function (f) { return A.sameFile(first.file, f.path); }).map(function (f) { return f.path; })[0] || (!first.file ? (S().active || A.mainFile()) : null);
    path = path || A.mainFile() || S().active;
    var f = path ? A.fileOf(path) : null;
    if (!f) return null;
    var ds = all.filter(function (d) { return d.file ? A.sameFile(d.file, f.path) : true; });
    var fl = failure();
    return { path: f.path, content: f.content, diags: ds, kind: fl ? fl.kind : "compile", stderr: fl ? fl.stderr : "" };
  }
  /** Có gì để hỏi không: chạy qua máy chủ (có địa chỉ API) và có chẩn đoán hoặc stderr của lần chạy lỗi. */
  function eligible() {
    if (!client() || !S().item) return false;
    if ((S().diags || []).length) return true;
    var f = failure();
    return !!(f && f.stderr.trim());
  }

  function syncItem() {
    var id = S().item ? S().item.id : null;
    if (id !== st.itemId) { st.itemId = id; reset(true); }
  }
  /** Bỏ giải thích cũ (lần chạy mới, đổi đoạn mã…). Không làm gì khi chính ta đang áp đề xuất. */
  function reset(force) {
    if (st.keep && !force) return;
    st.phase = "idle"; st.ctx = null; st.result = null; st.error = null; st.applied = false;
  }

  /* ------------------------------------------------------------------ có nên mời dùng AI không (hỏi máy chủ một lần, lười) */
  function offer() {
    var c = client(); if (!c) return false;
    if (!st.probing && Date.now() - st.availAt > 30000) {          /* quyền có thể đổi ở trang khác (mở khoá, bật AI): hỏi lại sau 30 giây */
      st.probing = true;
      c.status().then(function (s) { st.avail = c.usable(s); }, function () { st.avail = null; }).then(function () {
        st.probing = false; st.availAt = Date.now();
        if (st.avail === false && A.panel && /^(output|problems)$/.test(S().settings.panelTab) && !S().running) A.panel.render();      /* gỡ nút/thẻ nếu AI tắt hoặc chỉ quản trị */
      });
    }
    return st.avail !== false;
  }

  /* ------------------------------------------------------------------ hỏi */
  function messageOf(e) {
    var c = e && e.code ? String(e.code) : "";
    if ((c === "ai_rate_limited" || c === "ai_budget_exhausted") && e.retryAfter) return (e.message || "Hết lượt dùng AI") + " — thử lại sau " + (e.retryAfter >= 90 ? Math.round(e.retryAfter / 60) + " phút" : e.retryAfter + " giây") + ".";
    return (e && e.message) || "Không hỏi được AI.";
  }
  function explain(opts) {
    syncItem();
    var c = client();
    if (!c) { U.toast("Cần mở Code Studio qua máy chủ để dùng AI.", "bad"); return; }
    if (st.phase === "loading") return;
    var p = pick();
    if (!p) { U.toast("Chưa có tệp nào để hỏi AI.", "bad"); return; }
    var built;
    try { built = AI.buildExplainRequest({ language: CS.langs.byFilename(p.path), filename: p.path, kind: p.kind, code: p.content, diagnostics: p.diags, stderr: p.stderr }); }
    catch (e) { st.phase = "error"; st.error = e.message; st.ctx = { path: p.path }; if (opts && opts.open) A.showPanel("problems"); else A.renderPanel(); return; }
    var my = st.ctx = { path: p.path, content: p.content, built: built, nDiags: built.req.diagnostics.length };
    st.phase = "loading"; st.result = null; st.error = null; st.applied = false;
    if (opts && opts.open) A.showPanel("problems"); else A.renderPanel();
    /* lần chạy mới / đổi đoạn mã trong lúc chờ → st.ctx đã đổi: bỏ kết quả cũ, đừng vẽ nó lên mã khác */
    c.status().then(function (s) {
      st.avail = c.usable(s);
      if (st.ctx !== my) return null;
      if (!st.avail) { st.phase = "off"; st.error = !s || !s.enabled ? "AI đang tắt trên máy chủ này." : "Tính năng AI chỉ dành cho quản trị viên trên máy chủ này."; return null; }
      if (!s.allowed) { st.phase = "unlock"; return null; }
      return c.explain(built).then(function (res) { if (st.ctx === my) { st.result = res; st.phase = "done"; } });
    }).catch(function (e) {
      if (st.ctx !== my) return;
      if (e && e.code === "ai_code_required") { st.phase = "unlock"; return; }
      st.phase = "error"; st.error = messageOf(e);
    }).then(function () { A.renderPanel(); });
  }
  function unlock(code, errBox) {
    var c = client(); if (!c) return;
    errBox.textContent = "";
    c.unlock(code).then(function () { st.phase = "idle"; explain(); }, function (e) { errBox.textContent = messageOf(e); });
  }

  /* ------------------------------------------------------------------ áp đề xuất */
  function apply() {
    var r = st.result, ctx = st.ctx;
    if (!r || !r.patch || !ctx) return;
    var f = A.fileOf(ctx.path);
    if (!f) { U.toast("Tệp không còn nữa.", "bad"); return; }
    if (f.content !== ctx.content) { U.toast("Mã đã đổi từ lúc hỏi AI — bấm “Hỏi lại” để có đề xuất khớp với mã hiện tại.", "bad", 5000); return; }
    var next;
    try { next = AI.applyPatch(f.content, r.patch); } catch (e) { U.toast(e.message, "bad"); return; }
    st.keep = true;
    try {
      A.showFile(ctx.path);
      A.ed.replaceAllText(next);
      A.setDiagnostics([]);                                    /* dấu lỗi cũ lệch dòng sau khi sửa */
    } finally { st.keep = false; }
    st.applied = true;
    A.renderPanel();
    U.toast("Đã áp dụng đề xuất — Ctrl+Z để hoàn tác, ▶ Chạy để thử lại.", "ok", 4000);
  }
  function dismissPatch() { if (st.result) st.result.patch = null; A.renderPanel(); }

  /* ------------------------------------------------------------------ vẽ */
  function render(box) {
    syncItem();
    if (st.phase === "idle" && (!eligible() || !offer())) return;
    var hd = h("div", { class: "cs-ai-h" }, [h("strong", { text: "✨ AI giải thích lỗi" })]);
    var card = h("section", { class: "cs-ai", "aria-label": "Giải thích lỗi bằng AI" }, [hd]);
    var name = st.ctx && st.ctx.path ? st.ctx.path : (pick() || {}).path;
    if (name) hd.appendChild(h("small", { text: "tệp " + name.split("/").pop() }));
    hd.appendChild(h("span", { class: "grow" }));
    var body = h("div", { class: "cs-ai-b" });
    card.appendChild(body);
    var ask = function (label) { return h("button", { type: "button", class: "btn sm" + (label === "✨ Giải thích lỗi" ? " pri" : ""), text: label, onclick: function () { explain(); } }); };

    if (st.phase === "idle") {
      hd.appendChild(ask("✨ Giải thích lỗi"));
      body.appendChild(h("p", { class: "cs-note", text: "AI đọc thông báo lỗi và tệp có lỗi, giải thích nguyên nhân và gợi ý cách sửa (không tự sửa mã của bạn). Mã của tệp đó và thông báo lỗi sẽ được gửi tới dịch vụ AI (Gemini) qua máy chủ." }));
    } else if (st.phase === "loading") {
      body.appendChild(h("p", { class: "cs-ai-busy", role: "status", text: "Đang hỏi AI… (thường vài giây)" }));
    } else if (st.phase === "unlock") {
      body.appendChild(h("p", { text: "AI trên máy chủ này cần mã truy cập." }));
      var inp = h("input", { type: "password", class: "inp", autocomplete: "off", maxlength: "200", placeholder: "Mã truy cập AI", "aria-label": "Mã truy cập AI" });
      var err = h("p", { class: "cs-tc-bad", role: "alert" });
      var form = h("form", { class: "cs-ai-unlock" }, [inp, h("button", { type: "submit", class: "btn sm pri", text: "Mở khoá" })]);
      form.addEventListener("submit", function (e) { e.preventDefault(); unlock(inp.value, err); });
      body.appendChild(form); body.appendChild(err);
    } else if (st.phase === "off") {
      body.appendChild(h("p", { class: "cs-note", text: st.error }));
    } else if (st.phase === "error") {
      hd.appendChild(ask("Thử lại"));
      body.appendChild(h("p", { class: "cs-tc-bad", role: "alert", text: st.error }));
    } else if (st.phase === "done" && st.result) {
      hd.appendChild(ask("Hỏi lại"));
      resultView(body, st.result);
    }
    box.insertBefore(card, box.firstChild);
  }

  function resultView(body, r) {
    var ctx = st.ctx;
    if (r.summary) body.appendChild(h("p", { class: "cs-ai-sum", text: r.summary }));
    if (ctx.built.truncated) body.appendChild(h("p", { class: "cs-note", text: "Tệp dài nên AI chỉ xem " + ctx.built.sentLines + " dòng đầu (trong " + ctx.built.totalLines + " dòng)." }));
    if (r.items.length) {
      var ul = h("ul", { class: "cs-ai-items" });
      r.items.forEach(function (it) {
        var li = h("li");
        var line = it.line ? h("button", { type: "button", class: "chip", text: "dòng " + it.line, title: "Nhảy tới dòng " + it.line, onclick: function () { A.showFile(ctx.path, it.line, 1); } }) : null;
        li.appendChild(h("div", { class: "t" }, [line, it.title ? h("strong", { text: it.title }) : null]));
        if (it.why) li.appendChild(h("p", { text: it.why }));
        if (it.fix) li.appendChild(h("p", { class: "fix", text: "→ " + it.fix }));
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    if (r.patch) body.appendChild(patchView(r.patch, ctx));
    body.appendChild(h("p", { class: "cs-note", text: "AI có thể sai — hãy đọc kỹ trước khi áp dụng." + (r.cached ? " (kết quả lấy từ bộ nhớ đệm)" : "") }));
  }
  function patchView(patch, ctx) {
    var pv = AI.previewPatch(ctx.content, patch), box = h("div", { class: "cs-ai-patch" });
    if (!pv) return box;
    var title = pv.after.length ? (pv.line === pv.endLine ? "Đề xuất sửa dòng " + pv.line : "Đề xuất sửa dòng " + pv.line + "–" + pv.endLine) : "Đề xuất xoá dòng " + (pv.line === pv.endLine ? pv.line : pv.line + "–" + pv.endLine);
    box.appendChild(h("div", { class: "t", text: title }));
    var pre = h("pre", { class: "cs-ai-diff", tabindex: "0", "aria-label": "So sánh trước và sau khi sửa" });
    pv.before.forEach(function (l, i) { pre.appendChild(h("span", { class: "del", text: "- " + (pv.line + i) + "  " + l })); });
    pv.after.forEach(function (l) { pre.appendChild(h("span", { class: "add", text: "+ " + l })); });
    box.appendChild(pre);
    if (st.applied) {
      box.appendChild(h("p", { class: "cs-tc-ok", text: "✓ Đã áp dụng. Bấm ▶ Chạy để thử lại (Ctrl+Z để hoàn tác)." }));
    } else {
      box.appendChild(h("div", { class: "cs-tc-acts" }, [
        h("button", { type: "button", class: "btn sm pri", text: "Áp dụng đề xuất", onclick: apply }),
        h("button", { type: "button", class: "btn sm", text: "Bỏ qua", onclick: dismissPatch })
      ]));
    }
    return box;
  }

  A.ai = { render: render, reset: reset, explain: explain, offer: offer, eligible: eligible, state: st };
})(window);
