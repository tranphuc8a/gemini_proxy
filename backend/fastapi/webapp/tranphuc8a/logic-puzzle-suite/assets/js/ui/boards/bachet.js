/* ui/boards/bachet.js — bàn QUẢ CÂN BACHET. Hai dạng bàn theo cỡ của đề (puzzle.data.mode):
     hai / mot  — hàng Ô QUẢ CÂN (M ô: ô nhập số nguyên gam + nút − / +), DẢI PHỦ 1…N (từng khối lượng: cân được / còn hở — hai kiểu hoa văn + chữ, không chỉ màu), dòng tóm tắt
                  (đã dùng k quả · phủ liền 1…R · hở đầu tiên · còn hở bao nhiêu), ô "Cân thử" (nhập một khối lượng → cách đặt ít quả nhất với bộ ĐANG CÓ), nút Nộp / Xoá hết / Mở lại.
     dat        — mỗi vật một THẺ: hàng nút quả cân (chạm để xoay: ngoài → đĩa đối diện ▶ → cùng đĩa ◀ → ngoài), hai đĩa cân bằng chữ (đĩa TRÁI có vật, đĩa PHẢI), kết quả ◀ ＝ ▶ kèm số gam lệch.
   Hành động gửi cho engine (assets/js/puzzles/bachet.js): {k:"set", i, val} · {k:"place", item, i, val} · {k:"clear"} · {k:"reopen"} · {k:"submit"}.
   Bàn KHÔNG tự cài luật chấm: phủ liền / hở / tối ưu lấy từ type.lib.coverInfo / datRows; số quả tối thiểu KHÔNG hiện sẵn (chỉ ở gợi ý mức ≥ 1 và hộp thoại kết thúc).
   Trạng thái GIAO DIỆN (không vào state): chữ đang gõ trong ô, khối lượng cân thử. Gợi ý: highlight(cells, "hint") tô ô / nút; game.lastHint.action (set) hiện giá trị gợi ý làm placeholder của ô.
   Trợ năng: mỗi ô nhập có aria-label (quả cân thứ i), nút − / + ≥ 44 px, dải phủ role="img" kèm tóm tắt bằng chữ (aria-live), mỗi nút quả cân của bàn đặt có aria-label từ type.describeCell. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var uid = 0;
  var FOCUSABLE = "button, select, input, textarea, a[href]";

  function toInt(x) { if (typeof x === "string" && /^\s*\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function nf(n) { return P.grade.fmt(n, 0); }
  function keepFocus(rootEl, fn) {
    var a = doc.activeElement, idx = a && rootEl.contains(a) ? Array.prototype.indexOf.call(rootEl.querySelectorAll(FOCUSABLE), a) : -1;
    fn();
    if (idx < 0) return;
    var els = rootEl.querySelectorAll(FOCUSABLE), at = Math.min(idx, els.length - 1);
    for (var dist = 0; dist < els.length; dist++) {
      var cand = [els[at + dist], els[at - dist]];
      for (var q = 0; q < 2; q++) if (cand[q] && !cand[q].disabled) { cand[q].focus({ preventScroll: true }); return; }
    }
  }
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
  function listText(a) { return a.length ? a.join(", ") : "—"; }

  // ================================================================================================================ bàn chơi
  function mount(host, env) {
    var puzzle = env.puzzle, d = puzzle.data;
    return d.mode === "dat" ? mountDat(host, env) : mountSet(host, env);
  }

  // ------------------------------------------------------------------------------------------ chọn bộ (hai / mot)
  function mountSet(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, ro = !!env.readOnly, d = puzzle.data, N = d.N, M = d.slots, two = d.mode === "hai";
    var marks = {}, ghost = null, offGame = null, tryVal = "", base = "pz-bc-" + (++uid), dirty = {};

    var stats = h("div", { class: "pz-bc-stats", role: "group", "aria-label": "Đề bài" },
      h("span", { class: "pz-bc-stat pz-bc-goal", title: "Mọi khối lượng nguyên từ 1 đến N gam phải cân được" }, "Cân được mọi khối lượng ", h("b", { text: "1…" + nf(N) }), " g"),
      h("span", { class: "pz-bc-stat", title: two ? "Quả cân đặt ở đĩa đối diện vật hoặc cùng đĩa với vật" : "Quả cân chỉ đặt ở đĩa đối diện vật" }, two ? "Quả cân đặt được cả hai đĩa" : "Quả cân chỉ đặt một đĩa"),
      h("span", { class: "pz-bc-stat", title: "Số ô quả cân tối đa" }, "Tối đa ", h("b", { text: String(M) }), " quả"));

    // ---- ô quả cân
    var slotEls = [], slotsBox = h("div", { class: "pz-bc-slots", role: "group", "aria-label": "Các quả cân" }), i;
    function mkSlot(k) {
      var inp = h("input", { type: "number", inputmode: "numeric", class: "pz-bc-num", min: "0", max: String(N), step: "1", "aria-label": "Quả cân thứ " + (k + 1) + " (gam, để trống = không dùng)", placeholder: "—" });
      var dec = h("button", { type: "button", class: "btn pz-bc-step pz-bc-dec", "aria-label": "Giảm quả cân thứ " + (k + 1), text: "−" });
      var inc = h("button", { type: "button", class: "btn pz-bc-step pz-bc-inc", "aria-label": "Tăng quả cân thứ " + (k + 1), text: "+" });
      var wrap = h("div", { class: "pz-bc-slot" }, h("span", { class: "pz-bc-slab", text: "Quả " + (k + 1) }), h("div", { class: "pz-bc-sline" }, dec, inp, inc));
      slotEls.push({ wrap: wrap, inp: inp, dec: dec, inc: inc });
      return wrap;
    }
    for (i = 0; i < M; i++) slotsBox.append(mkSlot(i));

    // ---- dải phủ + tóm tắt
    var strip = h("div", { class: "pz-bc-strip", role: "img" });
    var summary = h("p", { class: "pz-bc-summary", "aria-live": "polite" });
    var gaps = h("p", { class: "pz-bc-gaps faint" });
    var coverBox = h("section", { class: "pz-bc-cover", "aria-label": "Khối lượng cân được" }, h("h3", { class: "pz-bc-h" }, "Khối lượng cân được (1…" + nf(N) + " g)"), strip,
      h("p", { class: "pz-bc-legend faint" }, h("span", { class: "pz-bc-key ok", "aria-hidden": "true", text: "✓" }), " cân được   ", h("span", { class: "pz-bc-key gap", "aria-hidden": "true", text: "✗" }), " còn hở"), summary, gaps);

    // ---- cân thử
    var tryIn = h("input", { type: "number", inputmode: "numeric", class: "pz-bc-num pz-bc-tryin", min: "1", max: String(N), step: "1", "aria-label": "Khối lượng muốn cân thử (gam)", placeholder: "g" });
    var tryOut = h("p", { class: "pz-bc-tryout", id: base + "-try", "aria-live": "polite" });
    tryIn.setAttribute("aria-describedby", tryOut.id);
    var tryBox = h("section", { class: "pz-bc-try", "aria-label": "Cân thử" }, h("h3", { class: "pz-bc-h" }, "Cân thử một khối lượng"), h("div", { class: "pz-bc-sline" }, tryIn, h("span", { class: "faint", text: "g — với bộ quả cân đang có" })), tryOut);

    // ---- nút
    var submitBtn = h("button", { type: "button", class: "btn btn-primary pz-bc-act pz-bc-submit", html: icon("check") + "<span>Nộp bộ quả cân</span>" });
    var clearBtn = h("button", { type: "button", class: "btn pz-bc-act pz-bc-clear", html: icon("trash") + "<span>Xoá hết</span>" });
    var reopenBtn = h("button", { type: "button", class: "btn pz-bc-act pz-bc-reopen", html: icon("undo") + "<span>Mở lại để sửa</span>", hidden: true });
    var note = h("p", { class: "pz-bc-note", "aria-live": "polite" });
    var actions = ro ? null : h("div", { class: "pz-bc-actions" }, submitBtn, clearBtn, reopenBtn);
    host.replaceChildren(h("div", { class: "pz-bc pz-bc-set" }, stats, h("section", { class: "pz-bc-slotbox" }, h("h3", { class: "pz-bc-h" }, "Bộ quả cân (gam)"), slotsBox, note), coverBox, ro ? null : tryBox, actions));

    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function submitted() { return game.state.v[M] === 1; }
    function wl() { return lib.wlist(d, game.state); }

    function drawSlots() {
      var act = canAct(), v = game.state.v, hintI = ghost && ghost.k === "set" ? ghost.i : -1;
      slotEls.forEach(function (z, k) {
        var val = v[k], focused = doc.activeElement === z.inp && dirty[k];
        if (!focused) z.inp.value = val > 0 ? String(val) : "";
        z.inp.disabled = !act; z.dec.disabled = !act || val <= 0; z.inc.disabled = !act || val >= N;
        z.inp.placeholder = hintI === k && ghost.val ? "→ " + ghost.val : "—";
        z.wrap.classList.toggle("hint", marks[k] === "hint"); z.wrap.classList.toggle("replay", marks[k] === "replay"); z.wrap.classList.toggle("filled", val > 0);
      });
    }
    function drawCover() {
      var W = wl(), info = lib.coverInfo(W, N, two), st = lib.reachOf(W, two), kids = [], dense = N > 80, gapList = [], x;
      for (x = 1; x <= N; x++) {
        var ok = x <= st.S && st.reach[st.S + x];
        if (!ok && gapList.length < 400) gapList.push(x);
        kids.push(h("span", { class: "pz-bc-cell " + (ok ? "ok" : "gap") + (dense ? " dense" : ""), title: x + " g: " + (ok ? "cân được" : "chưa cân được"), text: dense ? "" : String(x) }, dense ? null : h("i", { class: "pz-bc-mark", "aria-hidden": "true", text: ok ? "✓" : "✗" })));
      }
      strip.replaceChildren.apply(strip, kids);
      var nGap = 0; for (x = 1; x <= N; x++) if (!(x <= st.S && st.reach[st.S + x])) nGap++;
      var txt = "Đã dùng " + W.length + " quả · " + (info.R > 0 ? "phủ liền 1…" + nf(info.R) : "chưa phủ được khối lượng nào") + " · " + (nGap ? "còn hở " + nf(nGap) + " / " + nf(N) + " khối lượng, đầu tiên là " + nf(info.gap) + " g" : "đã cân được MỌI khối lượng 1…" + nf(N) + " g");
      setText(summary, txt); strip.setAttribute("aria-label", txt);
      setText(gaps, nGap ? "Còn hở: " + gapList.slice(0, 24).map(nf).join(", ") + (nGap > 24 ? ", … (" + nf(nGap - 24) + " khối lượng nữa)" : "") : "");
      gaps.hidden = !nGap;
    }
    function drawTry() {
      if (ro) return;
      var t = toInt(tryIn.value), W = wl();
      if (tryIn.value === "") { setText(tryOut, "Nhập khối lượng để xem cách đặt quả cân."); return; }
      if (t == null || t < 1 || t > N) { setText(tryOut, "Nhập số nguyên từ 1 đến " + nf(N) + "."); return; }
      var a = lib.arrange(W, t, two);
      if (!a) { setText(tryOut, nf(t) + " g: chưa cân được với bộ " + (W.length ? "{" + W.map(nf).join(", ") + "}" : "(trống)") + "."); return; }
      var plus = [], minus = [];
      a.coef.forEach(function (c, k) { if (c > 0) plus.push(nf(W[k])); else if (c < 0) minus.push(nf(W[k])); });
      setText(tryOut, nf(t) + " g: đĩa TRÁI vật" + (minus.length ? " + " + minus.join(" + ") : "") + " ＝ đĩa PHẢI " + (plus.length ? plus.join(" + ") : "0") + " (" + a.used + " quả).");
    }
    function drawButtons() {
      if (ro) return;
      var act = canAct(), W = wl(), sub = submitted(), done = lib.coverInfo(W, N, two).covered;
      submitBtn.disabled = !act || !W.length || sub; clearBtn.disabled = !act || (!W.length && !sub); reopenBtn.hidden = !sub || game.finished();
      setText(note, sub && !done ? "Đã nộp nhưng bộ chưa phủ hết 1…" + nf(N) + " g — sửa một ô hoặc bấm 'Mở lại'." : "");
      note.classList.toggle("bad", sub && !done);
    }
    function drawAll() { drawSlots(); drawCover(); drawTry(); drawButtons(); }

    function run(action, say) { if (!canAct()) return false; var r = game.act(action); if (r.ok && say) env.announce(say()); return r.ok; }
    function commit(k) {
      var z = slotEls[k], txt = z.inp.value.trim(), val = txt === "" ? 0 : toInt(txt);
      dirty[k] = false;
      if (val == null || val < 0 || val > N) { setText(note, "Quả cân phải là số nguyên từ 1 đến " + nf(N) + " g (để trống = không dùng)."); note.classList.add("bad"); z.inp.value = game.state.v[k] > 0 ? String(game.state.v[k]) : ""; return; }
      if (val === game.state.v[k]) { drawSlots(); return; }
      if (!run({ k: "set", i: k, val: val }, function () { return val ? "Quả cân " + (k + 1) + " = " + val + " gam. " + summary.textContent : "Bỏ quả cân " + (k + 1) + ". " + summary.textContent; })) drawSlots();
    }
    if (!ro) {
      slotEls.forEach(function (z, k) {
        z.inp.addEventListener("input", function () { dirty[k] = true; });
        z.inp.addEventListener("change", function () { commit(k); });
        z.inp.addEventListener("blur", function () { if (dirty[k]) commit(k); });
        z.inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(k); } });
        z.dec.addEventListener("click", function () { var val = game.state.v[k]; if (val > 0) run({ k: "set", i: k, val: val - 1 }, function () { return "Quả cân " + (k + 1) + " = " + (val - 1) + " gam. " + summary.textContent; }); });
        z.inc.addEventListener("click", function () { var val = game.state.v[k]; if (val < N) run({ k: "set", i: k, val: val + 1 }, function () { return "Quả cân " + (k + 1) + " = " + (val + 1) + " gam. " + summary.textContent; }); });
      });
      tryIn.addEventListener("input", drawTry);
      submitBtn.addEventListener("click", function () { var ok = lib.coverInfo(wl(), N, two).covered; if (run({ k: "submit" })) env.announce(ok ? "Đã nộp bộ quả cân." : "Đã nộp nhưng bộ chưa phủ hết."); });
      clearBtn.addEventListener("click", function () { run({ k: "clear" }, function () { return "Đã xoá hết quả cân."; }); });
      reopenBtn.addEventListener("click", function () { run({ k: "reopen" }, function () { return "Đã mở lại để sửa."; }); });
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") { var had = host.contains(doc.activeElement); ghost = null; marks = {}; dirty = {}; drawAll(); if (had) keepFocusSet(); }
      else if (ev.type === "status") { drawSlots(); drawButtons(); }
      else if (ev.type === "hint") { var a = ev.hint && ev.hint.action; ghost = a && a.k === "set" ? a : null; drawSlots(); }
    });
    var lastSlot = 0;
    host.addEventListener("focusin", function (e) { var k = slotEls.map(function (z) { return z.wrap; }).findIndex(function (w) { return w.contains(e.target); }); if (k >= 0) lastSlot = k; });
    /** Nút − / + vừa bấm mà TỰ vô hiệu (về 0 hoặc tới N) thì focus rơi về BODY: chuyển sang ô nhập cùng ô quả cân. */
    function keepFocusSet() {
      var b = doc.activeElement;
      if (b && b !== doc.body && !b.disabled && !(b.closest && b.closest("[hidden]"))) return;
      var z = slotEls[lastSlot];
      if (z && !z.inp.disabled) z.inp.focus({ preventScroll: true });
    }
    drawAll();

    return {
      destroy: function () { if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { ghost = null; marks = {}; dirty = {}; drawAll(); },
      highlight: function (list, kind) {
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { marks[j] = kind; });
        if (!kind || !list || !list.length) ghost = null;
        else if (kind === "hint" && game.lastHint && game.lastHint.action && game.lastHint.action.k === "set") ghost = game.lastHint.action;
        drawSlots();
      },
      focus: function () { var z = slotEls[0]; (z && !z.inp.disabled ? z.inp : host).focus({ preventScroll: true }); }
    };
  }

  // ------------------------------------------------------------------------------------------ đặt quả cân (dat)
  var POS_TEXT = ["để ngoài", "đĩa phải ▶", "cùng vật ◀"];
  function mountDat(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, ro = !!env.readOnly, d = puzzle.data, W = d.W, q = W.length, Q = d.X.length;
    var marks = {}, ghost = null, offGame = null;

    var stats = h("div", { class: "pz-bc-stats", role: "group", "aria-label": "Đề bài" },
      h("span", { class: "pz-bc-stat pz-bc-goal", title: "Với mỗi vật, đặt quả cân cho thăng bằng, dùng ít quả nhất" }, "Cân ", h("b", { text: String(Q) }), " vật bằng ít quả nhất"),
      h("span", { class: "pz-bc-stat", title: "Mỗi quả dùng tối đa một lần cho mỗi vật" }, "Bộ quả cân: ", h("b", { text: "{" + W.map(nf).join(", ") + "} g" })),
      h("span", { class: "pz-bc-stat pz-bc-used", title: "Tổng số quả đã đặt (mọi vật)" }, "Đã đặt ", h("b", { text: "0" }), " quả"));
    var usedB = stats.querySelector(".pz-bc-used b");
    var items = [], box = h("div", { class: "pz-bc-items" });
    d.X.forEach(function (x, j) {
      var btns = W.map(function (w, k) { var b = h("button", { type: "button", class: "btn pz-bc-wt", dataset: { item: String(j), k: String(k) } }, h("b", { class: "pz-bc-wtn", text: nf(w) + " g" }), h("span", { class: "pz-bc-wtp", text: POS_TEXT[0] })); return b; });
      var left = h("div", { class: "pz-bc-pan left" }), right = h("div", { class: "pz-bc-pan right" }), mid = h("div", { class: "pz-bc-mid", "aria-hidden": "true" });
      var res = h("p", { class: "pz-bc-res", "aria-live": "polite" });
      var card = h("section", { class: "pz-bc-item", "aria-label": "Vật " + (j + 1) + ": " + nf(x) + " gam" }, h("h3", { class: "pz-bc-h" }, "Vật " + (j + 1) + ": ", h("b", { text: nf(x) + " g" })),
        h("div", { class: "pz-bc-wts", role: "group", "aria-label": "Quả cân cho vật " + (j + 1) }, btns), h("div", { class: "pz-bc-scale" }, left, mid, right), res);
      items.push({ card: card, btns: btns, left: left, right: right, mid: mid, res: res });
      box.append(card);
    });
    var submitBtn = h("button", { type: "button", class: "btn btn-primary pz-bc-act pz-bc-submit", html: icon("check") + "<span>Nộp</span>" });
    var clearBtn = h("button", { type: "button", class: "btn pz-bc-act pz-bc-clear", html: icon("trash") + "<span>Xoá hết</span>" });
    var reopenBtn = h("button", { type: "button", class: "btn pz-bc-act pz-bc-reopen", html: icon("undo") + "<span>Mở lại để sửa</span>", hidden: true });
    var note = h("p", { class: "pz-bc-note", "aria-live": "polite" });
    host.replaceChildren(h("div", { class: "pz-bc pz-bc-dat" }, stats, h("p", { class: "pz-bc-how faint", text: "Vật nằm ở đĩa TRÁI. Chạm một quả cân để đổi: để ngoài → đĩa phải ▶ (đối diện vật) → cùng vật ◀ (đĩa trái) → để ngoài." }), box, ro ? null : h("div", { class: "pz-bc-actions" }, submitBtn, clearBtn, reopenBtn), note));

    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function submitted() { return game.state.v[q * Q] === 1; }
    function draw() {
      var s = game.state, act = canAct(), nUsed = lib.usedOf(d, s), allOk = true;
      d.X.forEach(function (x, j) {
        var it = items[j], row = lib.rowOf(d, s, j), sum = lib.rowSum(W, row), L = [nf(x) + " (vật)"], Rr = [], used = 0, bal = sum === x;
        if (!bal) allOk = false;
        W.forEach(function (w, k) {
          var v = row[k], b = it.btns[k], cell = j * q + k;
          if (v === 1) { Rr.push(nf(w)); used++; } else if (v === 2) { L.push(nf(w)); used++; }
          b.disabled = !act; b.setAttribute("aria-label", type.describeCell(puzzle, s, cell) + (act ? " — chạm để đổi" : ""));
          b.dataset.pos = String(v); setText(b.lastChild, POS_TEXT[v]);
          b.classList.toggle("hint", marks[cell] === "hint"); b.classList.toggle("replay", marks[cell] === "replay");
          b.classList.toggle("ghost", !!ghost && ghost.item === j && ghost.i === k);
        });
        it.left.replaceChildren(h("span", { class: "pz-bc-pt", text: "Đĩa trái" }), h("span", { class: "pz-bc-pv", text: L.join(" + ") }));
        it.right.replaceChildren(h("span", { class: "pz-bc-pt", text: "Đĩa phải" }), h("span", { class: "pz-bc-pv", text: Rr.length ? Rr.join(" + ") : "0" }));
        var rightW = 0, leftW = x; W.forEach(function (w, k) { if (row[k] === 1) rightW += w; else if (row[k] === 2) leftW += w; });
        it.mid.textContent = bal ? "＝" : leftW > rightW ? "◀" : "▶";
        it.card.classList.toggle("bal", bal);
        setText(it.res, (bal ? "＝ Thăng bằng (" + nf(leftW) + " ＝ " + nf(rightW) + ")" : (leftW > rightW ? "◀ Đĩa trái nặng hơn " : "▶ Đĩa phải nặng hơn ") + nf(Math.abs(leftW - rightW)) + " g") + " · dùng " + used + " quả");
        it.res.classList.toggle("good", bal); it.res.classList.toggle("bad", !bal && submitted());
      });
      setText(usedB, String(nUsed));
      if (!ro) {
        var sub = submitted();
        submitBtn.disabled = !act || sub || nUsed === 0; clearBtn.disabled = !act || (nUsed === 0 && !sub); reopenBtn.hidden = !sub || game.finished();
        setText(note, sub && !allOk ? "Đã nộp nhưng còn vật chưa thăng bằng — sửa một quả hoặc bấm 'Mở lại'." : "");
        note.classList.toggle("bad", sub && !allOk);
      }
    }
    function run(action, say) { if (!canAct()) return false; var r = game.act(action); if (r.ok && say) env.announce(say()); return r.ok; }
    if (!ro) {
      items.forEach(function (it, j) {
        it.btns.forEach(function (b, k) {
          b.addEventListener("click", function () {
            var cur = game.state.v[j * q + k], nx = (cur + 1) % 3;
            run({ k: "place", item: j, i: k, val: nx }, function () { return "Vật " + (j + 1) + ", quả " + nf(W[k]) + " gam: " + POS_TEXT[nx] + ". " + it.res.textContent; });
          });
        });
      });
      submitBtn.addEventListener("click", function () { run({ k: "submit" }, function () { return "Đã nộp."; }); });
      clearBtn.addEventListener("click", function () { run({ k: "clear" }, function () { return "Đã xoá hết."; }); });
      reopenBtn.addEventListener("click", function () { run({ k: "reopen" }, function () { return "Đã mở lại để sửa."; }); });
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") {
        ghost = null; marks = {}; draw();
        var b = doc.activeElement;
        if (host.contains(b) && b !== doc.body && b.disabled && items[0]) { var t = items[0].btns[0]; if (t && !t.disabled) t.focus({ preventScroll: true }); }
      } else if (ev.type === "status") draw();
      else if (ev.type === "hint") { var a = ev.hint && ev.hint.action; ghost = a && a.k === "place" ? a : null; draw(); }
    });
    draw();
    return {
      destroy: function () { if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { ghost = null; marks = {}; draw(); },
      highlight: function (list, kind) {
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { marks[j] = kind; });
        if (!kind || !list || !list.length) ghost = null;
        else if (kind === "hint" && game.lastHint && game.lastHint.action && game.lastHint.action.k === "place") ghost = game.lastHint.action;
        draw();
      },
      focus: function () { var b = items[0] && items[0].btns[0]; (b && !b.disabled ? b : host).focus({ preventScroll: true }); }
    };
  }

  // ================================================================================================================ trình soạn
  /** Đầu vào (type.fromInput): { mode: "hai"|"mot", N } hoặc { mode: "dat", W: "1,3,9,27", X: "25,14" } (chuỗi, ngăn cách bằng dấu phẩy). */
  function editor(host, env) {
    var type = env.type, st = { mode: "hai", N: 40, W: "1, 3, 9, 27", X: "25, 14" };
    var inp = env.input, pz = env.puzzle, src = inp && typeof inp === "object" && inp.mode ? inp : pz && pz.data ? pz.data : null;
    if (src) {
      if (src.mode === "hai" || src.mode === "mot" || src.mode === "dat") st.mode = src.mode;
      var n0 = toInt(src.N); if (n0 != null) st.N = n0;
      if (src.W != null) st.W = Array.isArray(src.W) ? src.W.join(", ") : String(src.W);
      if (src.X != null) st.X = Array.isArray(src.X) ? src.X.join(", ") : String(src.X);
    }
    var body = h("div", { class: "pz-bc pz-bc-ed" }), info = h("p", { class: "pz-bc-edinfo", "aria-live": "polite" });
    var samples = [{ label: "Bachet 1, 3, 9, 27 (N = 40)", mode: "hai", N: 40 }, { label: "Luỹ thừa 2 (N = 15)", mode: "mot", N: 15 }, { label: "Đặt: 25 g và 14 g", mode: "dat", W: "1, 3, 9, 27", X: "25, 14" }];
    function input() { return st.mode === "dat" ? { mode: "dat", W: st.W, X: st.X } : { mode: st.mode, N: st.N }; }
    function emit() { env.onChange(input()); }
    function setInfo() {
      var r;
      try { r = type.fromInput(input()); } catch (e) { r = { ok: false, errors: ["Lỗi tính: " + e.message] }; }
      info.textContent = r.ok ? r.statusText + (r.warnings.length ? " — " + r.warnings[0] : "") : (r.errors[0] || "Đề chưa hợp lệ.");
      info.className = "pz-bc-edinfo " + (r.ok ? "good" : "bad");
    }
    function field(label, ctrl, hint) { return h("div", { class: "pz-bc-field" }, h("span", { class: "pz-bc-flab", text: label }), ctrl, hint ? h("p", { class: "pz-bc-fhint faint", text: hint }) : null); }
    function render() {
      var kids = [field("Cỡ", U.pz.chips([{ id: "hai", label: "Chọn bộ — hai đĩa" }, { id: "mot", label: "Chọn bộ — một đĩa" }, { id: "dat", label: "Đặt quả cân" }], st.mode, function (id) { st.mode = id; keepFocus(body, render); emit(); }, "Cỡ"))];
      if (st.mode === "dat") {
        var w = h("input", { type: "text", inputmode: "numeric", class: "pz-bc-text", "aria-label": "Bộ quả cân (gam, ngăn cách bằng dấu phẩy)", value: st.W }), x = h("input", { type: "text", inputmode: "numeric", class: "pz-bc-text", "aria-label": "Các vật (gam, ngăn cách bằng dấu phẩy)", value: st.X });
        w.addEventListener("input", function () { st.W = w.value; emit(); setInfo(); }); x.addEventListener("input", function () { st.X = x.value; emit(); setInfo(); });
        kids.push(field("Bộ quả cân W (g)", w, "Tối đa " + type.lib.MAX_W + " quả, mỗi quả 1–" + type.lib.MAX_WV + " g."), field("Các vật X (g)", x, "Tối đa " + type.lib.MAX_Q + " vật; mỗi vật phải cân được bằng bộ W."));
      } else {
        var mx = type.lib.MAXN[st.mode], n = h("input", { type: "number", inputmode: "numeric", class: "pz-bc-num", "aria-label": "Khối lượng lớn nhất N (gam)", min: "1", max: String(mx), step: "1", value: String(st.N) });
        n.addEventListener("input", function () { var v = toInt(n.value); if (v != null) { st.N = v; emit(); } setInfo(); });
        kids.push(field("Khối lượng lớn nhất N (g)", n, "Phải cân được mọi khối lượng nguyên 1…N; N tối đa " + mx + "."));
      }
      kids.push(h("div", { class: "pz-bc-samples", role: "group", "aria-label": "Mẫu có sẵn" }, samples.map(function (sm) { return h("button", { type: "button", class: "btn", text: sm.label, on: { click: function () { st.mode = sm.mode; if (sm.N) st.N = sm.N; if (sm.W) { st.W = sm.W; st.X = sm.X; } keepFocus(body, render); emit(); } } }); })));
      kids.push(info, h("p", { class: "pz-bc-tip faint", text: "Mẹo: với N = (3^m − 1)/2 (4, 13, 40, 121…) bộ tối ưu duy nhất là 1, 3, 9, …; N khác thì quả cuối là phần dư. Đặt quả cân luôn được chấm theo số quả tối thiểu vét cạn." }));
      body.replaceChildren.apply(body, kids);
      setInfo();
    }
    host.replaceChildren(body); render(); emit();
    return { getInput: function () { return input(); }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.bachet = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
