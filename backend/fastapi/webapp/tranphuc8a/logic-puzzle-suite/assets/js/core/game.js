/* core/game.js — MỘT VÁN CHƠI: trạng thái hiện tại + lịch sử hoàn tác/làm lại + đồng hồ + đếm lỗi/gợi ý. Thuần (không DOM), dùng chung cho mọi loại puzzle.

   Trạng thái:  state = { v: [...ô...], c: [...bitmask ứng viên...] | null }   (đúng hình dạng của puzzle.initial / puzzle.solution)
   Mọi thao tác là một DIFF:  { d: [[trường, chỉ số, giá trị cũ, giá trị mới], …], label }   — trường là "v" hoặc "c".
   Hoàn tác = áp lại diff theo chiều ngược (HÀM NGƯỢC, không chụp ảnh trạng thái): nhẹ, và tắt máy giữa chừng vẫn khôi phục chính xác.
   Loại puzzle chỉ cần biết dựng diff từ một "hành động" của người chơi (type.moveFor) — undo/redo, đồng hồ, lưu ván, đếm lỗi là việc ở đây.

   Trạng thái ván: ready (chưa bấm giờ) → playing ⇄ paused → solved | revealed. Chưa xong mà bỏ đi = abandoned (do tầng dữ liệu ghi). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var MAX_UNDO = 3000;

  function copyState(s) { return { v: s.v.slice(), c: s.c ? s.c.slice() : null }; }
  function applyDiff(state, d, reverse) {
    for (var k = 0; k < d.length; k++) {
      var e = d[k], f = e[0], i = e[1];
      if (f === "c" && !state.c) { state.c = new Array(state.v.length); for (var z = 0; z < state.c.length; z++) state.c[z] = 0; }
      state[f][i] = reverse ? e[2] : e[3];
    }
  }
  /** Diff đổi state hiện tại thành `target` (chỉ phần khác nhau). */
  function diffTo(state, target) {
    var d = [], i;
    for (i = 0; i < state.v.length; i++) if (state.v[i] !== target.v[i]) d.push(["v", i, state.v[i], target.v[i]]);
    if (state.c) for (i = 0; i < state.c.length; i++) { var to = target.c ? target.c[i] : 0; if (state.c[i] !== to) d.push(["c", i, state.c[i], to]); }
    return d;
  }
  function reverseDiff(d) { return d.slice().reverse().map(function (e) { return [e[0], e[1], e[3], e[2]]; }); }

  function create(puzzle, opt) {
    opt = opt || {};
    var type = P.types.get(puzzle.type);
    if (!type) throw new Error("Không có loại puzzle: " + puzzle.type);
    var clock = opt.now || function () { return Date.now(); };
    var listeners = [], settings = Object.assign({ autoRemove: true }, opt.settings || {});
    var g = {
      puzzle: puzzle, type: type,
      state: type.newState(puzzle), undoStack: [], redoStack: [],
      status: "ready", activeMs: 0, since: 0, startedAt: 0, endedAt: 0,
      counters: { moves: 0, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false },
      source: opt.source || "random", ctx: opt.ctx || {}, id: opt.id || (puzzle.type + "-" + clock().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36)),
      lastHint: null
    };

    function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev, g); } catch (e) { if (root.console) root.console.error(e); } }); }
    g.on = function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; };
    g.setSettings = function (s) { Object.assign(settings, s || {}); };
    g.settings = function () { return settings; };

    // ---- đồng hồ
    g.elapsed = function () { return g.activeMs + (g.status === "playing" ? clock() - g.since : 0); };
    g.start = function () {
      if (g.status === "ready") { g.status = "playing"; g.startedAt = clock(); g.since = g.startedAt; emit({ type: "status" }); }
      else if (g.status === "paused") g.resume();
    };
    g.pause = function () { if (g.status !== "playing") return; g.activeMs += clock() - g.since; g.status = "paused"; emit({ type: "status" }); };
    g.resume = function () { if (g.status !== "paused") return; g.status = "playing"; g.since = clock(); emit({ type: "status" }); };
    g.finished = function () { return g.status === "solved" || g.status === "revealed"; };
    function finish(status) {
      if (g.status === "playing") g.activeMs += clock() - g.since;
      g.status = status; g.endedAt = clock();
      emit({ type: "status" }); if (status === "solved") emit({ type: "solved" });
    }

    // ---- thao tác
    g.check = function () { return type.check(puzzle, g.state); };
    /** action: { k: "set"|"cand"|"press"|"cycle"|"fill"|…, … } — hình dạng do loại puzzle quy định. */
    g.act = function (action) {
      if (g.finished()) return { ok: false, reason: "finished" };
      if (g.status === "paused") return { ok: false, reason: "paused" };
      if (g.status === "ready") g.start();
      var diff = type.moveFor(puzzle, g.state, action, settings);
      if (!diff || !diff.d || !diff.d.length) return { ok: false, reason: "noop" };
      var mist = type.mistakes(puzzle, g.state, diff) || 0;
      applyDiff(g.state, diff.d, false);
      g.undoStack.push(diff); if (g.undoStack.length > MAX_UNDO) g.undoStack.shift();
      g.redoStack.length = 0;
      g.counters.moves++; g.counters.mistakes += mist;
      var chk = type.check(puzzle, g.state);
      emit({ type: "change", diff: diff, mistakes: mist });
      if (chk.solved) finish("solved");
      return { ok: true, diff: diff, mistakes: mist, check: chk };
    };
    g.canUndo = function () { return g.undoStack.length > 0 && !g.finished(); };
    g.canRedo = function () { return g.redoStack.length > 0 && !g.finished(); };
    g.undo = function () {
      if (!g.canUndo()) return false;
      var m = g.undoStack.pop(); applyDiff(g.state, m.d, true); g.redoStack.push(m); g.counters.undos++;
      emit({ type: "change", diff: { d: reverseDiff(m.d) }, undo: true }); return true;
    };
    g.redo = function () {
      if (!g.canRedo()) return false;
      var m = g.redoStack.pop(); applyDiff(g.state, m.d, false); g.undoStack.push(m);
      var chk = type.check(puzzle, g.state);
      emit({ type: "change", diff: m, redo: true });
      if (chk.solved) finish("solved");
      return true;
    };
    g.restart = function () {
      g.state = type.newState(puzzle); g.undoStack = []; g.redoStack = []; g.lastHint = null;
      g.status = "ready"; g.activeMs = 0; g.since = 0; g.startedAt = 0; g.endedAt = 0;
      g.counters = { moves: 0, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false };
      emit({ type: "change", restart: true }); emit({ type: "status" });
    };

    // ---- gợi ý
    /** level 1..3. Trả hint của loại puzzle ({level, text, why[], cells[], action?}); ghi vào bộ đếm. Level 4 = Reveal (g.reveal()). */
    g.hint = function (level) {
      if (g.finished()) return null;
      if (g.status === "ready") g.start();
      level = Math.max(1, Math.min(3, level | 0));
      var h = type.hint(puzzle, g.state, level);
      if (h && !h.none) g.counters.hints[level]++;
      g.lastHint = h || null;
      emit({ type: "hint", hint: h });
      return h;
    };
    g.hintCount = function () { return g.counters.hints[1] + g.counters.hints[2] + g.counters.hints[3]; };
    g.applyHint = function (h) { return h && h.action ? g.act(h.action) : { ok: false, reason: "noaction" }; };
    /** Reveal: điền thẳng lời giải. Ván tính là 'revealed', không tính là tự giải. */
    g.reveal = function () {
      if (g.finished() || !puzzle.solution) return false;
      if (g.status === "ready") g.start();
      var target = { v: puzzle.solution.v.slice(), c: null }, d = diffTo(g.state, target);
      if (d.length) { var diff = { d: d, label: "Hiện lời giải" }; applyDiff(g.state, d, false); g.undoStack.push(diff); g.redoStack.length = 0; }
      g.counters.revealed = true;
      emit({ type: "change", reveal: true });
      finish("revealed");
      return true;
    };

    // ---- lưu / hồ sơ
    g.serialize = function () {
      return { v: 1, id: g.id, puzzle: puzzle, state: copyState(g.state), undo: g.undoStack, redo: g.redoStack, counters: g.counters, activeMs: g.elapsed(), status: g.status === "playing" ? "paused" : g.status,
        startedAt: g.startedAt, endedAt: g.endedAt, source: g.source, ctx: g.ctx, updated: clock() };
    };
    /** Bản ghi cho Lịch sử / Thống kê. result: solved | revealed | abandoned. */
    g.record = function (result) {
      var s = puzzle.size, h = g.counters.hints, tier = P.util.tierOfScore(puzzle.score || 0);
      return { id: g.id, type: puzzle.type, puzzleId: puzzle.id || P.util.puzzleId(puzzle), seed: puzzle.seed == null ? null : puzzle.seed, tier: puzzle.tier || tier.id, score: puzzle.score || 0, size: s, sizeId: puzzle.sizeId || null,
        source: g.source, day: g.ctx && g.ctx.day || null, startedAt: g.startedAt || clock(), endedAt: g.endedAt || clock(), time: g.elapsed(), mistakes: g.counters.mistakes,
        hints: h[1] + h[2] + h[3], maxHint: h[3] ? 3 : h[2] ? 2 : h[1] ? 1 : 0, moves: g.counters.moves, result: result || (g.status === "solved" ? "solved" : g.status === "revealed" ? "revealed" : "abandoned") };
    };
    return g;
  }

  /** Dựng lại ván từ g.serialize(). Đồng hồ giữ nguyên thời gian đã chơi; ván đang chơi lúc lưu quay về 'paused' (người chơi bấm Tiếp tục). */
  function restore(saved, opt) {
    var g = create(saved.puzzle, Object.assign({}, opt || {}, { id: saved.id, source: saved.source, ctx: saved.ctx }));
    g.state = { v: saved.state.v.slice(), c: saved.state.c ? saved.state.c.slice() : null };
    g.undoStack = saved.undo || []; g.redoStack = saved.redo || [];
    g.counters = saved.counters || g.counters; g.counters.hints = Object.assign({ 1: 0, 2: 0, 3: 0 }, g.counters.hints);
    g.activeMs = saved.activeMs || 0; g.startedAt = saved.startedAt || 0; g.endedAt = saved.endedAt || 0;
    g.status = saved.status === "ready" || saved.status === "paused" || saved.status === "solved" || saved.status === "revealed" ? saved.status : "paused";
    return g;
  }

  P.game = { create: create, restore: restore, applyDiff: applyDiff, diffTo: diffTo, reverseDiff: reverseDiff, copyState: copyState };
  if (typeof module !== "undefined" && module.exports) module.exports = P.game;
})(typeof globalThis !== "undefined" ? globalThis : this);
