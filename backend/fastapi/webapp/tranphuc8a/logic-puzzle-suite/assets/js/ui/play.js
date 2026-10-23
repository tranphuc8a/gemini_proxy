/* ui/play.js — BÀN CHƠI: tiêu đề + độ khó + seed, đồng hồ (tạm dừng che bàn), lỗi/gợi ý/nước đi, hoàn tác/làm lại, gợi ý 3 mức + Reveal, replay lời giải, tự lưu ván dở.
   Bàn cụ thể do Puz.boards[loại].mount(host, env) vẽ (xem HUONG-DAN-ENGINE.md mục 9); ở đây chỉ là vỏ chung cho mọi loại.

   Lưu ván: sau mỗi thay đổi 0,4 s, mỗi 5 s khi đang chơi, khi ẩn/đóng trang (pagehide) và khi rời màn — sập máy mất tối đa vài giây. Giải xong/xem đáp án ⇒ ghi lịch sử + xoá ván dở (một giao dịch).
   Tạm dừng che bàn và khoá thao tác (không "nhìn trộm" khi đồng hồ đứng). Ván mở lại từ kho tự chạy tiếp (người chơi vừa chủ động mở nó); tạm dừng chủ động và tự tạm dừng khi rời tab thì che bàn. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz, doc = root.document;

  /** replaceChildren nhưng bỏ phần tử null/false (replaceChildren(null) sẽ in chữ "null" ra màn hình). */
  function fill(el) { el.replaceChildren.apply(el, Array.prototype.slice.call(arguments, 1).filter(function (k) { return k != null && k !== false; })); }

  function open(ctx, host, rawId) {
    var id = rawId; try { id = decodeURIComponent(rawId); } catch (e) { /* giữ nguyên */ }
    var user = ctx.user, game = ctx.getGame(id);
    if (!game) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không tìm thấy ván này" }), h("p", { class: "faint", text: "Ván có thể đã kết thúc hoặc bị xoá." }), h("a", { class: "btn btn-primary", href: "#/", text: "Về trang chủ" }))); return { destroy: function () { } }; }

    var puzzle = game.puzzle, def = game.type, dead = false, finalized = game.finished() && !user.getGame(game.id), view = null, replayState = null, hintLevel = 0;
    var ui = {};                                          // phần tử giao diện
    var boardDef = P.boards && P.boards[def.id];
    var best = bestTime();

    function bestTime() {
      var t = 0; user.history().forEach(function (r) { if (r.type === puzzle.type && r.tier === puzzle.tier && r.result === "solved" && r.id !== game.id && (!t || r.time < t)) t = r.time; });
      return t;
    }

    // ------------------------------------------------------------------------------------------ lưu ván
    function save() { if (dead && !game.finished()) { /* vẫn lưu khi rời màn */ } if (finalized) return Promise.resolve(); return user.saveGame(game.serialize()).catch(function () { /* lỗi lưu không được làm hỏng ván */ }); }
    var saveSoon = U.debounce(save, 400);
    var tick = setInterval(function () { if (game.status === "playing") { updateTimer(); } }, 500);
    var autosave = setInterval(function () { if (game.status === "playing") save(); }, 5000);
    function onHide() { if (doc.visibilityState === "hidden" && ctx.settings().autoPause && game.status === "playing") game.pause(); save(); }
    function onPageHide() { save(); }
    doc.addEventListener("visibilitychange", onHide); root.addEventListener("pagehide", onPageHide);

    function finalize() {
      if (finalized) return; finalized = true;
      var res = game.status === "solved" ? "solved" : "revealed", rec = game.record(res);
      user.finishGame(rec).then(function () {
        if (res === "solved") showSolved(rec); else { ctx.toast("Đã hiện đáp án — ván này không tính là tự giải.", { ms: 6000 }); renderState(); }
      }, function (e) { ctx.toast("Không ghi được lịch sử: " + (e && e.message || e)); });
    }

    // ------------------------------------------------------------------------------------------ giao diện
    function hudChip(ic, text, label) { var s = h("span", { class: "hud-chip", title: label }); s.innerHTML = icon(ic); s.append(h("b", { text: text })); return s; }
    function updateTimer() { if (ui.timer) ui.timer.textContent = P.util.fmtTime(game.elapsed()); }
    function renderState() {
      if (dead) return;
      var c = game.counters, paused = game.status === "paused", fin = game.finished();
      updateTimer();
      ui.mist.lastChild.textContent = String(c.mistakes); ui.hints.lastChild.textContent = String(game.hintCount()); ui.moves.lastChild.textContent = String(c.moves);
      var gr = (ui.score || (fin && def.grade)) ? game.grade() : null;                        // mục 11: loại optimize hiện giá trị hiện có (KHÔNG lộ giá trị tối ưu khi đang chơi)
      if (ui.score) { ui.score.lastChild.textContent = gr ? gr.valueText : "—"; ui.score.title = def.objective.label + (def.objective.unit ? " (" + def.objective.unit + ")" : ""); }
      ui.undo.disabled = !game.canUndo() || !!replayState; ui.redo.disabled = !game.canRedo() || !!replayState; ui.hint.disabled = fin || paused || !!replayState || !def.hint;
      ui.pause.hidden = fin || !!replayState; ui.pause.innerHTML = icon(paused ? "play" : "pause") + "<span>" + (paused ? "Tiếp tục" : "Tạm dừng") + "</span>";
      ui.boardBox.classList.toggle("is-paused", paused && !replayState); ui.cover.hidden = !(paused && !replayState);
      if (paused && !replayState) { ui.board.setAttribute("inert", ""); ui.board.setAttribute("aria-hidden", "true"); } else { ui.board.removeAttribute("inert"); ui.board.removeAttribute("aria-hidden"); }
      ui.status.hidden = !fin || !!replayState;
      if (fin) ui.statusText.textContent = game.status === "solved" ? "Đã giải — " + P.util.fmtTime(game.elapsed()) + ", " + c.mistakes + " lỗi, " + game.hintCount() + " gợi ý." + (gr ? " Điểm tối ưu " + P.grade.starsText(gr.stars) + " (" + P.grade.display(gr, unit()) + ")." : "") : "Đã xem đáp án — không tính là tự giải.";
      ui.fav.setAttribute("aria-pressed", String(user.isFav(puzzle.id || P.util.puzzleId(puzzle))));
      if (fin) { ui.hintPanel.hidden = true; }
    }
    function clearHint() { hintLevel = 0; if (ui.hintPanel) { ui.hintPanel.hidden = true; ui.hintBody.replaceChildren(); } if (view && view.highlight) view.highlight([], null); }

    function askHint() {
      if (game.finished() || game.status === "paused") return;
      var next = Math.min(3, hintLevel + 1), hint = game.hint(next);
      if (!hint) return;
      if (hint.none) { ui.hintBody.replaceChildren(h("p", { text: hint.text || "Không còn gì để gợi ý." })); ui.hintPanel.hidden = false; return; }
      hintLevel = next;
      if (view && view.highlight) view.highlight(hint.cells || [], "hint");
      var why = hint.why && hint.why.length ? h("ul", { class: "why" }, hint.why.map(function (w) { return h("li", { text: w }); })) : null;
      fill(ui.hintBody,
        h("p", { class: "hint-level", text: "Gợi ý mức " + next + "/3" + (hint.technique ? " · " + hint.technique : "") }),
        h("p", { class: "hint-text", text: hint.text }), why,
        h("div", { class: "btn-row" },
          next < 3 ? h("button", { type: "button", class: "btn", on: { click: askHint }, text: "Chi tiết hơn (mức " + (next + 1) + ")" }) : null,
          hint.action ? h("button", { type: "button", class: "btn btn-primary", on: { click: function () { var a = hint.action; clearHint(); game.applyHint({ action: a }); } }, text: "Áp dụng nước này" }) : null,
          h("button", { type: "button", class: "btn btn-ghost", on: { click: clearHint }, text: "Ẩn gợi ý" }),
          h("button", { type: "button", class: "btn btn-danger", on: { click: reveal }, html: icon("eye") + "<span>Hiện đáp án</span>" })));
      ui.hintPanel.hidden = false; ctx.announce("Gợi ý: " + hint.text);
    }
    function reveal() {
      var go = function () { clearHint(); game.reveal(); };
      if (ctx.settings().confirmReveal) ctx.confirm("Hiện đáp án?", "Đáp án sẽ được điền thẳng vào bàn và ván này không tính là tự giải.", "Hiện đáp án", true).then(function (ok) { if (ok) go(); }); else go();
    }

    function unit() { return def.objective && def.objective.unit || ""; }
    /** Ô "Điểm tối ưu" (mục 11): sao + "giá trị / tối ưu đơn vị"; chỉ có khi bản ghi có grade (loại khai báo def.grade). */
    function gradeStat(g) {
      var el = Z.stat("Điểm tối ưu", P.grade.starsText(g.stars), P.grade.display(g, unit()));
      el.classList.add("stat-grade"); el.title = g.text; el.firstChild.setAttribute("aria-label", g.stars + "/3 sao");
      return el;
    }
    function showSolved(rec) {
      var isBest = best === 0 || rec.time < best, avg = (function () { var t = [], r = user.history().filter(function (x) { return x.type === puzzle.type && x.result === "solved"; }); r.forEach(function (x) { t.push(x.time); }); return t.length > 1 ? Math.round(t.reduce(function (a, b) { return a + b; }, 0) / t.length) : 0; })();
      var grid = h("div", { class: "stat-grid" }, Z.stat("Thời gian", P.util.fmtTime(rec.time), isBest && best ? "Kỷ lục mới! (trước đó " + P.util.fmtTime(best) + ")" : best ? "Tốt nhất " + P.util.fmtTime(best) : "Ván đầu ở bậc này"), Z.stat("Lỗi", String(rec.mistakes)), Z.stat("Gợi ý", String(rec.hints)), Z.stat("Độ khó", Z.scoreText(rec.score), Z.tierName(rec.tier)),
        rec.grade ? gradeStat(rec.grade) : null);
      var gline = rec.grade ? h("p", { class: "grade-line", text: rec.grade.text }) : null;
      var more = h("p", { class: "faint", text: avg ? "Trung bình các ván " + def.name + " đã giải: " + P.util.fmtTime(avg) + "." : "" });
      var dlg, btn = function (label, cls, fn, ic) { return h("button", { type: "button", class: "btn " + cls, on: { click: function () { dlg.close(); fn(); } }, html: (ic ? icon(ic) : "") + "<span>" + label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>" }); };
      var rr = P.progress.recommend(user.history(), puzzle.type), size = P.types.sizeOf(def, puzzle.sizeId);
      dlg = U.dialog("Đã giải! 🎉", [h("p", { class: "solved-line", text: Z.puzzleTitle(puzzle) }), grid, gline, more, rr.action !== "stay" ? h("p", { class: "hint", text: rr.reason }) : null].filter(Boolean), [
        btn("Xem lời giải từng bước", "", enterReplay, "play"), btn("Đổi độ khó", "", function () { ctx.go("#/new/" + puzzle.type); }, "grid"),
        btn("Chơi tiếp", "btn-primary", function () { ctx.begin({ type: puzzle.type, seed: P.rng.randomSeed(), sizeId: size.id, tier: P.daily.tierFor(size, rr.recommended), options: puzzle.options, source: "random" }); }, "new")], { onClose: function () { renderState(); } });
      renderState();
    }

    // ------------------------------------------------------------------------------------------ bàn
    function mountBoard(g, readOnly) {
      ui.board.replaceChildren();
      if (!boardDef) { ui.board.append(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Chưa có giao diện cho " + def.name }))); return null; }
      var env = { game: g, puzzle: puzzle, type: def, U: U, readOnly: !!readOnly, settings: ctx.settings, announce: ctx.announce, clearHint: clearHint };      // clearHint: bàn đổi kiểu gợi ý (Lights Out) thì đóng gợi ý đang mở
      try { return boardDef.mount(ui.board, env); } catch (e) { ui.board.append(h("p", { class: "form-err", text: "Lỗi khi vẽ bàn: " + (e && e.message || e) })); if (root.console) root.console.error(e); return null; }
    }
    function unmountBoard() { if (view && view.destroy) { try { view.destroy(); } catch (e) { /* bỏ qua */ } } view = null; ui.board.replaceChildren(); }

    // ------------------------------------------------------------------------------------------ replay lời giải (spec #14)
    function enterReplay() {
      if (!puzzle.solution) { ctx.toast("Puzzle này không có lời giải để replay."); return; }
      var ov = U.pz.busy("Đang dựng các bước giải…");
      P.gen.call(puzzle.type, "replay", [puzzle], { timeout: 20000 }).then(function (steps) {
        ov.close(); if (dead) return;
        if (!steps || !steps.length) { ctx.toast("Không dựng được replay cho puzzle này."); return; }
        clearHint(); unmountBoard();
        var sb = P.game.create(puzzle, { settings: ctx.settings() });
        replayState = { steps: steps, idx: 0, sb: sb, timer: 0, speed: 1200 };
        view = mountBoard(sb, true);
        ui.play.classList.add("replaying"); ui.replay.hidden = false; ui.toolbar.hidden = true;
        drawReplay(); renderState();
      }, function (e) { ov.close(); ctx.toast("Không dựng được replay: " + (e && e.message || e)); });
    }
    function stepTo(n) {
      var r = replayState; n = Math.max(0, Math.min(r.steps.length, n));
      while (r.idx < n) { P.game.applyDiff(r.sb.state, r.steps[r.idx].diff.d, false); r.idx++; }
      while (r.idx > n) { r.idx--; P.game.applyDiff(r.sb.state, r.steps[r.idx].diff.d, true); }
      if (view && view.refresh) view.refresh();
      drawReplay();
    }
    function drawReplay() {
      var r = replayState, n = r.steps.length, cur = r.idx > 0 ? r.steps[r.idx - 1] : null;
      ui.rpCount.textContent = "Bước " + r.idx + "/" + n;
      ui.rpRange.max = String(n); ui.rpRange.value = String(r.idx);
      fill(ui.rpText,
        h("p", { class: "hint-text", text: cur ? cur.text : "Trạng thái ban đầu. Bấm ▶ để xem từng bước." }),
        cur && cur.why ? h("p", { class: "faint", text: Array.isArray(cur.why) ? cur.why.join(" ") : cur.why }) : null,
        cur && cur.technique ? h("p", { class: "faint", text: "Kỹ thuật: " + cur.technique }) : null);
      if (view && view.highlight) view.highlight(cur && cur.cells || [], "replay");
      ui.rpFirst.disabled = ui.rpPrev.disabled = r.idx === 0; ui.rpNext.disabled = ui.rpLast.disabled = r.idx === n;
      ui.rpPlay.innerHTML = icon(r.timer ? "pause" : "play") + "<span>" + (r.timer ? "Dừng" : "Tự chạy") + "</span>";
      ctx.announce(cur ? cur.text : "Trạng thái ban đầu");
    }
    function rpAuto() {
      var r = replayState; if (!r) return;
      if (r.timer) { clearInterval(r.timer); r.timer = 0; drawReplay(); return; }
      if (r.idx >= r.steps.length) stepTo(0);
      r.timer = setInterval(function () { if (r.idx >= r.steps.length) { clearInterval(r.timer); r.timer = 0; drawReplay(); return; } stepTo(r.idx + 1); }, r.speed); drawReplay();
    }
    function exitReplay() {
      if (!replayState) return; clearInterval(replayState.timer); replayState = null;
      unmountBoard(); ui.play.classList.remove("replaying"); ui.replay.hidden = true; ui.toolbar.hidden = false;
      view = mountBoard(game, false); renderState();
    }

    // ------------------------------------------------------------------------------------------ menu ⋯
    function menu(anchor) {
      var fin = game.finished(), items = [
        { label: "Chơi lại từ đầu", icon: "restart", disabled: !!replayState, run: function () { ctx.confirm("Chơi lại từ đầu?", "Mọi nước đi, đồng hồ, lỗi và gợi ý của ván này sẽ được đặt lại.", "Chơi lại", true).then(function (ok) { if (ok) { clearHint(); finalized = false; game.restart(); game.start(); save(); } }); } },
        { label: "Xem lời giải từng bước", icon: "play", disabled: !puzzle.solution, run: enterReplay },
        { label: "Hiện đáp án", icon: "eye", disabled: fin || !!replayState, run: reveal }, { sep: true },
        { label: "Constraint View (biến, miền, ràng buộc)", icon: "grid", run: function () { U.learn.puzzleDialog(ctx, puzzle, "constraint"); } },
        { label: "Show Solver (bộ giải làm gì)", icon: "tree", run: function () { U.learn.puzzleDialog(ctx, puzzle, "trace"); } },
        { label: "Giải thích thuật toán", icon: "learn", run: function () { ctx.go("#/learn/" + puzzle.type); } }, { sep: true },
        { label: "Thêm vào bộ sưu tập…", icon: "folder", run: function () { U.library.addToCollectionDialog(ctx, puzzle); } },
        { label: "Xuất / chia sẻ puzzle…", icon: "share", run: function () { U.library.exportDialog(ctx, puzzle); } }
      ];
      if (puzzle.seed != null) items.splice(items.length - 2, 0, { label: "Sao chép liên kết seed", icon: "link", run: function () { U.copyText(Z.seedUrl(puzzle)).then(function (ok) { ctx.toast(ok ? "Đã sao chép liên kết — mở ra là cùng puzzle này." : "Không sao chép được."); }); } });
      if (!fin) items.push({ sep: true }, { label: "Bỏ ván này", icon: "trash", danger: true, run: function () { ctx.confirm("Bỏ ván này?", "Ván được ghi vào lịch sử là “bỏ dở”.", "Bỏ ván", true).then(function (ok) { if (!ok) return; finalized = true; user.finishGame(game.record("abandoned")).then(function () { ctx.forget(game.id); ctx.go("#/"); }); }); } });
      U.menu(anchor, items);
    }

    // ------------------------------------------------------------------------------------------ dựng khung
    ui.timer = h("b", { class: "timer", "aria-label": "Thời gian chơi", text: "00:00" });
    ui.mist = hudChip("x", "0", def.mistakeLabel || "Số lần điền sai"); ui.hints = hudChip("hint", "0", "Số gợi ý đã dùng"); ui.moves = hudChip("pencil", "0", def.moveLabel || "Số nước đi");     // nhãn tuỳ chọn của loại (mục 11)
    ui.score = P.types.kindOf(def) === "optimize" && typeof def.grade === "function" && def.objective ? hudChip("star", "—", def.objective.label) : null;
    if (ui.score) ui.score.classList.add("hud-score");
    ui.pause = h("button", { type: "button", class: "btn", on: { click: function () { if (game.status === "paused") game.resume(); else game.pause(); } } });
    ui.fav = h("button", { type: "button", class: "icon-btn fav-btn", "aria-label": "Yêu thích", title: "Yêu thích (★)", html: icon("star"), on: { click: function () { user.toggleFav(puzzle).then(function (r) { ctx.toast(r && r.fav ? "Đã thêm vào yêu thích." : "Đã bỏ khỏi yêu thích."); renderState(); }, function (e) { ctx.toast(e.message); }); } } });
    ui.more = h("button", { type: "button", class: "icon-btn", "aria-label": "Thêm tuỳ chọn", "aria-haspopup": "menu", html: icon("more"), on: { click: function () { menu(ui.more); } } });
    ui.undo = h("button", { type: "button", class: "btn", on: { click: function () { clearHint(); game.undo(); } }, html: icon("undo") + "<span>Hoàn tác</span>" });
    ui.redo = h("button", { type: "button", class: "btn", on: { click: function () { clearHint(); game.redo(); } }, html: icon("redo") + "<span>Làm lại</span>" });
    ui.hint = h("button", { type: "button", class: "btn btn-primary", on: { click: askHint }, html: icon("hint") + "<span>Gợi ý</span>" });
    ui.toolbar = h("div", { class: "toolbar" }, ui.undo, ui.redo, ui.hint);
    ui.board = h("div", { class: "board-host", id: "boardHost" });
    ui.cover = h("div", { class: "pause-cover", hidden: true }, h("div", {}, h("p", { class: "big", text: "Đã tạm dừng" }), h("p", { class: "faint", text: "Bàn được che để đồng hồ công bằng." }), h("button", { type: "button", class: "btn btn-primary btn-lg", on: { click: function () { game.resume(); } }, html: icon("play") + "<span>Tiếp tục</span>" })));
    ui.boardBox = h("div", { class: "board-box" }, ui.board, ui.cover);
    ui.hintBody = h("div", {}); ui.hintPanel = h("section", { class: "hint-panel", hidden: true, "aria-live": "polite", "aria-label": "Gợi ý" }, ui.hintBody);
    ui.statusText = h("span", {}); ui.status = h("div", { class: "play-status", hidden: true }, ui.statusText, h("button", { type: "button", class: "btn", on: { click: enterReplay }, html: icon("play") + "<span>Replay</span>" }), h("a", { class: "btn btn-primary", href: "#/new/" + puzzle.type, html: icon("new") + "<span>Puzzle mới</span>" }));
    ui.rpCount = h("b", { class: "rp-count" }); ui.rpText = h("div", { class: "rp-text" });
    ui.rpRange = h("input", { type: "range", min: "0", max: "1", value: "0", "aria-label": "Bước replay", on: { input: function () { stepTo(+ui.rpRange.value); } } });
    ui.rpFirst = h("button", { type: "button", class: "icon-btn", "aria-label": "Về đầu", html: icon("first"), on: { click: function () { stepTo(0); } } });
    ui.rpPrev = h("button", { type: "button", class: "btn", html: icon("prev") + "<span>Trước</span>", on: { click: function () { stepTo(replayState.idx - 1); } } });
    ui.rpNext = h("button", { type: "button", class: "btn btn-primary", html: icon("next") + "<span>Sau</span>", on: { click: function () { stepTo(replayState.idx + 1); } } });
    ui.rpLast = h("button", { type: "button", class: "icon-btn", "aria-label": "Tới cuối", html: icon("last"), on: { click: function () { stepTo(replayState.steps.length); } } });
    ui.rpPlay = h("button", { type: "button", class: "btn", on: { click: rpAuto } });
    ui.replay = h("section", { class: "replay-panel", hidden: true, "aria-label": "Replay lời giải" }, h("div", { class: "rp-head" }, h("h2", { text: "Replay lời giải" }), ui.rpCount, h("button", { type: "button", class: "btn btn-ghost", on: { click: exitReplay }, text: "Thoát replay" })), ui.rpText, ui.rpRange, h("div", { class: "btn-row" }, ui.rpFirst, ui.rpPrev, ui.rpNext, ui.rpLast, ui.rpPlay));
    ui.side = h("div", { class: "play-side" }, h("div", { class: "hud" }, h("span", { class: "hud-chip hud-time", html: icon("clock") }, ui.timer), ui.mist, ui.hints, ui.moves, ui.score, ui.pause), ui.toolbar, ui.hintPanel, ui.status, ui.replay);
    ui.play = h("div", { class: "play" },
      h("div", { class: "play-head" }, h("div", { class: "play-title" }, h("h1", {}, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: " " + Z.puzzleTitle(puzzle) })),
        h("p", { class: "play-sub" }, Z.tierBadge(puzzle.tier, puzzle.score), h("span", { text: " " + (puzzle.seed != null ? "Seed " + puzzle.seed : puzzle.tier === "custom" ? "Puzzle tự tạo" : "") }))), h("div", { class: "ph-act" }, ui.fav, ui.more)),
      h("div", { class: "play-body" }, ui.boardBox, ui.side));
    host.replaceChildren(ui.play);

    view = mountBoard(game, game.finished());
    game.on(function (ev) {
      if (dead) return;
      if (ev.type === "change") { if (!ev.undo && !ev.redo && !ev.restart) { hintLevel = 0; ui.hintPanel.hidden = true; if (view && view.highlight) view.highlight([], null); } saveSoon(); }
      if (ev.type === "status") { if (game.finished()) finalize(); else save(); }
      renderState();
    });
    if (game.status === "ready" || game.status === "paused") game.start();     // người chơi chủ động mở ván (Tiếp tục chơi, liên kết seed) ⇒ chạy luôn; che bàn chỉ khi tạm dừng chủ động hoặc tự tạm dừng khi rời tab
    renderState();
    if (game.finished() && !finalized) finalize();

    function keys(e) {
      if (U.isTyping(e.target) || doc.querySelector("dialog[open]") || replayState) return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey) { if (k === "z" && !e.shiftKey) { e.preventDefault(); clearHint(); game.undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); clearHint(); game.redo(); } return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "h") { e.preventDefault(); askHint(); } else if (k === "p") { e.preventDefault(); if (game.status === "paused") game.resume(); else if (game.status === "playing") game.pause(); }
    }
    doc.addEventListener("keydown", keys);

    return {
      destroy: function () {
        dead = true; clearInterval(tick); clearInterval(autosave); doc.removeEventListener("visibilitychange", onHide); root.removeEventListener("pagehide", onPageHide); doc.removeEventListener("keydown", keys);
        if (replayState) clearInterval(replayState.timer);
        if (game.status === "playing") game.pause();
        var p = finalized ? Promise.resolve() : user.saveGame(game.serialize()).catch(function () { });
        if (view && view.destroy) { try { view.destroy(); } catch (e) { /* bỏ qua */ } }
        if (game.finished()) ctx.forget(game.id);
        return p;
      }
    };
  }

  U.play = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
