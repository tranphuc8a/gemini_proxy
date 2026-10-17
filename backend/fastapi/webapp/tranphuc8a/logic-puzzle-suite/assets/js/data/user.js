/* data/user.js — dữ liệu của người dùng (IndexedDB, local-first): puzzle đã lưu + yêu thích, bộ sưu tập, ván đang chơi dở, lịch sử, bản nháp, thiết lập.
   Mọi thứ nạp hết vào RAM lúc mở (vài chục nghìn bản ghi vẫn nhỏ) nên đọc là đồng bộ; ghi đi qua giao dịch IndexedDB nguyên tử rồi mới cập nhật RAM,
   nên tắt máy giữa chừng không để lại trạng thái nửa vời. Kết thúc một ván = MỘT giao dịch ghi lịch sử + xoá ván dở. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var T = P.text;
  var LIM = { puzzles: 20000, collections: 200, perCollection: 2000, games: 60, history: 200000, name: 80, draft: 200000 };
  var SETTING_DEFAULTS = { autoRemove: true, showConflicts: true, autoPause: true, highlightSame: true, confirmReveal: true, dailyGoal: 1 };
  var SETTING_CHECK = {
    autoRemove: function (v) { return typeof v === "boolean"; }, showConflicts: function (v) { return typeof v === "boolean"; }, autoPause: function (v) { return typeof v === "boolean"; },
    highlightSame: function (v) { return typeof v === "boolean"; }, confirmReveal: function (v) { return typeof v === "boolean"; },
    dailyGoal: function (v) { return typeof v === "number" && v >= 1 && v <= 20 && Math.floor(v) === v; }
  };

  function create(store, opt) {
    opt = opt || {};
    var clock = opt.now || function () { return Date.now(); };
    var puzzles = new Map(), collections = new Map(), games = new Map(), history = new Map(), settings = Object.assign({}, SETTING_DEFAULTS), listeners = [];
    function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev); } catch (e) { /* người nghe lỗi không làm hỏng kho */ } }); }
    function fail(msg, code) { var e = new Error(msg); e.code = code || "user"; return e; }
    function nameOf(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, LIM.name); }

    function open() {
      return store.tx(["puzzles", "collections", "games", "history", "meta"], "r", function (t) {
        return Promise.all([t.all("puzzles"), t.all("collections"), t.all("games"), t.all("history"), t.get("meta", "settings")]);
      }).then(function (r) {
        puzzles = new Map(r[0].map(function (x) { return [x.id, x]; })); collections = new Map(r[1].map(function (x) { return [x.id, x]; }));
        games = new Map(r[2].map(function (x) { return [x.id, x]; })); history = new Map(r[3].map(function (x) { return [x.id, x]; }));
        settings = Object.assign({}, SETTING_DEFAULTS); if (r[4] && r[4].value) Object.keys(SETTING_CHECK).forEach(function (k) { if (SETTING_CHECK[k](r[4].value[k])) settings[k] = r[4].value[k]; });
        return api;
      });
    }

    // ---- thiết lập
    function setSetting(k, v) {
      if (!SETTING_CHECK[k] || !SETTING_CHECK[k](v)) return Promise.reject(fail("Thiết lập không hợp lệ: " + k, "bad_setting"));
      // Cập nhật RAM NGAY (người chơi bật/tắt rồi đổi màn liền: bàn phải đọc giá trị mới), ghi IndexedDB sau; ghi lỗi thì hoàn lại giá trị cũ.
      var prev = settings, next = Object.assign({}, settings); next[k] = v; settings = next; emit({ type: "settings", key: k });
      return store.tx(["meta"], "rw", function (t) { return t.put("meta", { k: "settings", value: next }); }).then(function () { return next; }, function (e) { if (settings === next) { settings = prev; emit({ type: "settings", key: k }); } throw e; });
    }

    // ---- puzzle đã lưu
    function savePuzzle(puzzle, o) {
      o = o || {};
      if (!puzzle || !puzzle.type || !puzzle.initial) return Promise.reject(fail("Puzzle không hợp lệ.", "bad_puzzle"));
      var id = puzzle.id || P.util.puzzleId(puzzle), old = puzzles.get(id), now = clock();
      if (!old && puzzles.size >= LIM.puzzles) return Promise.reject(fail("Đã lưu tối đa " + LIM.puzzles + " puzzle — hãy xoá bớt.", "full"));
      var rec = { id: id, puzzle: Object.assign({}, puzzle, { id: id }), name: o.name != null ? nameOf(o.name) : old ? old.name : nameOf(puzzle.meta && puzzle.meta.name),
        fav: o.fav != null ? !!o.fav : old ? old.fav : false, source: o.source || (old && old.source) || "custom", created: old ? old.created : now, updated: now };
      return store.tx(["puzzles"], "rw", function (t) { return t.put("puzzles", rec); }).then(function () { puzzles.set(id, rec); emit({ type: "puzzle", id: id }); return rec; });
    }
    function inAnyCollection(id) { var yes = false; collections.forEach(function (c) { if (c.ids.indexOf(id) >= 0) yes = true; }); return yes; }
    function removePuzzle(id) {
      var cols = []; collections.forEach(function (c) { if (c.ids.indexOf(id) >= 0) cols.push(Object.assign({}, c, { ids: c.ids.filter(function (x) { return x !== id; }), updated: clock() })); });
      return store.tx(["puzzles", "collections"], "rw", function (t) { return Promise.all([t.del("puzzles", id)].concat(cols.map(function (c) { return t.put("collections", c); }))); })
        .then(function () { puzzles.delete(id); cols.forEach(function (c) { collections.set(c.id, c); }); emit({ type: "puzzle", id: id, removed: true }); return true; });
    }
    /** Đánh dấu ★: chưa lưu thì lưu kèm fav. Bỏ ★ một puzzle sinh tự động và không thuộc bộ sưu tập nào ⇒ xoá luôn (không để rác). */
    function toggleFav(puzzle) {
      var id = puzzle.id || P.util.puzzleId(puzzle), cur = puzzles.get(id);
      if (!cur) return savePuzzle(puzzle, { fav: true, source: "generated" });
      if (cur.fav && cur.source === "generated" && !inAnyCollection(id)) return removePuzzle(id).then(function () { return null; });
      return savePuzzle(cur.puzzle, { fav: !cur.fav });
    }
    function isFav(id) { var p = puzzles.get(id); return !!(p && p.fav); }

    // ---- bộ sưu tập
    function createCollection(name) {
      name = nameOf(name);
      if (!name) return Promise.reject(fail("Hãy đặt tên bộ sưu tập.", "name"));
      if (collections.size >= LIM.collections) return Promise.reject(fail("Đã đủ " + LIM.collections + " bộ sưu tập.", "full"));
      var dup = false; collections.forEach(function (c) { if (c.name.toLowerCase() === name.toLowerCase()) dup = true; });
      if (dup) return Promise.reject(fail("Đã có bộ sưu tập tên “" + name + "”.", "dup"));
      var now = clock(), rec = { id: "c-" + T.uid(), name: name, ids: [], created: now, updated: now };
      return store.tx(["collections"], "rw", function (t) { return t.put("collections", rec); }).then(function () { collections.set(rec.id, rec); emit({ type: "collection", id: rec.id }); return rec; });
    }
    function renameCollection(id, name) {
      var c = collections.get(id); name = nameOf(name);
      if (!c) return Promise.reject(fail("Không có bộ sưu tập này.", "missing")); if (!name) return Promise.reject(fail("Hãy đặt tên bộ sưu tập.", "name"));
      var rec = Object.assign({}, c, { name: name, updated: clock() });
      return store.tx(["collections"], "rw", function (t) { return t.put("collections", rec); }).then(function () { collections.set(id, rec); emit({ type: "collection", id: id }); return rec; });
    }
    function deleteCollection(id) {
      var c = collections.get(id); if (!c) return Promise.resolve(false);
      var gone = c.ids.filter(function (pid) { var p = puzzles.get(pid); if (!p || p.fav || p.source !== "generated") return false; var other = false; collections.forEach(function (o) { if (o.id !== id && o.ids.indexOf(pid) >= 0) other = true; }); return !other; });
      return store.tx(["collections", "puzzles"], "rw", function (t) { return Promise.all([t.del("collections", id)].concat(gone.map(function (pid) { return t.del("puzzles", pid); }))); })
        .then(function () { collections.delete(id); gone.forEach(function (pid) { puzzles.delete(pid); }); emit({ type: "collection", id: id, removed: true }); return true; });
    }
    function addToCollection(id, puzzle) {
      var c = collections.get(id); if (!c) return Promise.reject(fail("Không có bộ sưu tập này.", "missing"));
      var pid = puzzle.id || P.util.puzzleId(puzzle);
      if (c.ids.indexOf(pid) >= 0) return Promise.resolve(c);
      if (c.ids.length >= LIM.perCollection) return Promise.reject(fail("Bộ sưu tập đã đủ " + LIM.perCollection + " puzzle.", "full"));
      var saved = puzzles.get(pid), now = clock();
      var prec = saved || { id: pid, puzzle: Object.assign({}, puzzle, { id: pid }), name: nameOf(puzzle.meta && puzzle.meta.name), fav: false, source: "generated", created: now, updated: now };
      var rec = Object.assign({}, c, { ids: c.ids.concat([pid]), updated: now });
      return store.tx(["collections", "puzzles"], "rw", function (t) { return Promise.all([t.put("collections", rec), saved ? Promise.resolve() : t.put("puzzles", prec)]); })
        .then(function () { collections.set(id, rec); if (!saved) puzzles.set(pid, prec); emit({ type: "collection", id: id }); return rec; });
    }
    function removeFromCollection(id, pid) {
      var c = collections.get(id); if (!c || c.ids.indexOf(pid) < 0) return Promise.resolve(false);
      var rec = Object.assign({}, c, { ids: c.ids.filter(function (x) { return x !== pid; }), updated: clock() });
      var p = puzzles.get(pid), drop = p && !p.fav && p.source === "generated" && !(function () { var o = false; collections.forEach(function (x) { if (x.id !== id && x.ids.indexOf(pid) >= 0) o = true; }); return o; })();
      return store.tx(["collections", "puzzles"], "rw", function (t) { return Promise.all([t.put("collections", rec), drop ? t.del("puzzles", pid) : Promise.resolve()]); })
        .then(function () { collections.set(id, rec); if (drop) puzzles.delete(pid); emit({ type: "collection", id: id }); return true; });
    }

    // ---- ván đang chơi dở + lịch sử
    /** Lưu ván dở (gọi thường xuyên: gõ xong 500 ms, mỗi 5 giây, pagehide). Quá giới hạn thì ván CŨ NHẤT bị ghi vào lịch sử là bỏ dở. */
    function saveGame(ser) {
      if (!ser || !ser.id || !ser.puzzle) return Promise.reject(fail("Ván không hợp lệ.", "bad_game"));
      var rec = { id: ser.id, type: ser.puzzle.type, updated: ser.updated || clock(), ser: ser }, dropped = null;
      if (!games.has(ser.id) && games.size >= LIM.games) {
        var oldest = null; games.forEach(function (g) { if (!oldest || g.updated < oldest.updated) oldest = g; });
        if (oldest) dropped = abandonedRecord(oldest);
      }
      return store.tx(["games", "history"], "rw", function (t) {
        var ops = [t.put("games", rec)];
        if (dropped) { ops.push(t.del("games", dropped.id)); ops.push(t.put("history", dropped)); }
        return Promise.all(ops);
      }).then(function () { games.set(rec.id, rec); if (dropped) { games.delete(dropped.id); history.set(dropped.id, dropped); emit({ type: "history", id: dropped.id }); } emit({ type: "game", id: rec.id }); return rec; });
    }
    function abandonedRecord(g) {
      var s = g.ser, p = s.puzzle, h = (s.counters && s.counters.hints) || {};
      return { id: g.id, type: p.type, puzzleId: p.id || P.util.puzzleId(p), seed: p.seed == null ? null : p.seed, tier: p.tier || "custom", score: p.score || 0, size: p.size, sizeId: p.sizeId || null, source: s.source || "random", day: s.ctx && s.ctx.day || null,
        startedAt: s.startedAt || g.updated, endedAt: g.updated, time: s.activeMs || 0, mistakes: s.counters ? s.counters.mistakes : 0, hints: (h[1] || 0) + (h[2] || 0) + (h[3] || 0), maxHint: h[3] ? 3 : h[2] ? 2 : h[1] ? 1 : 0, moves: s.counters ? s.counters.moves : 0, result: "abandoned" };
    }
    function dropGame(id) { return store.tx(["games"], "rw", function (t) { return t.del("games", id); }).then(function () { games.delete(id); emit({ type: "game", id: id, removed: true }); return true; }); }
    /** Ghi hồ sơ ván đã kết thúc VÀ xoá ván dở trong cùng một giao dịch. */
    function finishGame(rec) {
      if (!rec || !rec.id || !/^(solved|revealed|abandoned)$/.test(rec.result)) return Promise.reject(fail("Hồ sơ ván không hợp lệ.", "bad_record"));
      return store.tx(["history", "games"], "rw", function (t) { return Promise.all([t.put("history", rec), t.del("games", rec.id)]); })
        .then(function () { history.set(rec.id, rec); games.delete(rec.id); emit({ type: "history", id: rec.id }); emit({ type: "game", id: rec.id, removed: true }); return rec; });
    }
    function removeRecord(id) { return store.tx(["history"], "rw", function (t) { return t.del("history", id); }).then(function () { history.delete(id); emit({ type: "history", id: id, removed: true }); return true; }); }

    // ---- bản nháp trình soạn
    function saveDraft(key, value) { return store.tx(["drafts"], "rw", function (t) { return t.put("drafts", { id: key, value: value, at: clock() }); }); }
    function getDraft(key) { return store.tx(["drafts"], "r", function (t) { return t.get("drafts", key); }); }
    function dropDraft(key) { return store.tx(["drafts"], "rw", function (t) { return t.del("drafts", key); }); }
    function listDrafts() { return store.tx(["drafts"], "r", function (t) { return t.all("drafts"); }); }

    // ---- meta
    function getMeta(k) { return store.tx(["meta"], "r", function (t) { return t.get("meta", k); }).then(function (r) { return r ? r.value : null; }); }
    function setMeta(k, v) { return store.tx(["meta"], "rw", function (t) { return t.put("meta", { k: k, value: v }); }); }

    // ---- sao lưu / khôi phục
    function dump() {
      return { puzzles: Array.from(puzzles.values()), collections: Array.from(collections.values()), games: Array.from(games.values()), history: Array.from(history.values()), settings: Object.assign({}, settings) };
    }
    function okPuzzleRec(x) { return x && typeof x.id === "string" && x.puzzle && typeof x.puzzle.type === "string" && x.puzzle.initial && Array.isArray(x.puzzle.initial.v) && P.types.get(x.puzzle.type); }
    function okCol(x) { return x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.ids); }
    function okGame(x) { return x && typeof x.id === "string" && x.ser && x.ser.puzzle && x.ser.state && Array.isArray(x.ser.state.v) && P.types.get(x.ser.puzzle.type); }
    function okHist(x) { return x && typeof x.id === "string" && typeof x.type === "string" && /^(solved|revealed|abandoned)$/.test(x.result) && typeof x.time === "number" && x.time >= 0 && typeof x.endedAt === "number"; }
    /** mode "merge": bản ghi trùng id lấy bản có `updated` mới hơn (lịch sử: giữ cả hai nguồn, trùng id thì bản đã có thắng). "replace": xoá hết rồi nạp. Phần tử hỏng bị bỏ và đếm. */
    function restore(data, mode) {
      if (!data || typeof data !== "object") return Promise.reject(fail("Dữ liệu sao lưu không hợp lệ.", "bad_backup"));
      var skipped = { puzzles: 0, collections: 0, games: 0, history: 0 };
      function pick(arr, ok, key) { var out = []; (Array.isArray(arr) ? arr : []).forEach(function (x) { if (ok(x)) out.push(x); else skipped[key]++; }); return out; }
      var inP = pick(data.puzzles, okPuzzleRec, "puzzles"), inC = pick(data.collections, okCol, "collections"), inG = pick(data.games, okGame, "games"), inH = pick(data.history, okHist, "history");
      if (inP.length > LIM.puzzles || inH.length > LIM.history || inC.length > LIM.collections) return Promise.reject(fail("Sao lưu quá lớn.", "too_big"));
      var replace = mode === "replace", base = {
        puzzles: replace ? new Map() : new Map(puzzles), collections: replace ? new Map() : new Map(collections), games: replace ? new Map() : new Map(games), history: replace ? new Map() : new Map(history)
      };
      function mergeBy(map, arr, newer) { arr.forEach(function (x) { var o = map.get(x.id); if (!o || (newer && (x.updated || 0) > (o.updated || 0))) map.set(x.id, x); }); }
      mergeBy(base.puzzles, inP, true); mergeBy(base.collections, inC, true); mergeBy(base.games, inG, true); mergeBy(base.history, inH, false);
      base.collections.forEach(function (c, id) {        // tạo bản mới, không sửa đối tượng đang dùng trong RAM trước khi giao dịch thành công
        base.collections.set(id, Object.assign({}, c, { ids: c.ids.filter(function (pid, i) { return typeof pid === "string" && base.puzzles.has(pid) && c.ids.indexOf(pid) === i; }) }));
      });
      var next = Object.assign({}, replace ? SETTING_DEFAULTS : settings);
      if (replace && data.settings) Object.keys(SETTING_CHECK).forEach(function (k) { if (SETTING_CHECK[k](data.settings[k])) next[k] = data.settings[k]; });
      return store.tx(["puzzles", "collections", "games", "history", "meta"], "bulk", function (t) {
        var ops = [];
        if (replace) ["puzzles", "collections", "games", "history"].forEach(function (n) { ops.push(t.clear(n)); });
        ["puzzles", "collections", "games", "history"].forEach(function (n) { base[n].forEach(function (v) { ops.push(t.put(n, v)); }); });
        if (replace) ops.push(t.put("meta", { k: "settings", value: next }));
        return Promise.all(ops);
      }).then(function () {
        puzzles = base.puzzles; collections = base.collections; games = base.games; history = base.history; settings = next;
        emit({ type: "restore" });
        return { puzzles: inP.length, collections: inC.length, games: inG.length, history: inH.length, skipped: skipped };
      });
    }
    function wipe() {
      return store.tx(["puzzles", "collections", "games", "history", "drafts", "meta"], "rw", function (t) { return Promise.all(["puzzles", "collections", "games", "history", "drafts", "meta"].map(function (n) { return t.clear(n); })); })
        .then(function () { puzzles.clear(); collections.clear(); games.clear(); history.clear(); settings = Object.assign({}, SETTING_DEFAULTS); emit({ type: "wipe" }); return true; });
    }

    var api = {
      store: store, now: clock, open: open, on: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
      settings: function () { return Object.assign({}, settings); }, setSetting: setSetting,
      puzzles: function () { return Array.from(puzzles.values()).sort(function (a, b) { return b.updated - a.updated; }); }, getPuzzle: function (id) { return puzzles.get(id) || null; },
      savePuzzle: savePuzzle, removePuzzle: removePuzzle, toggleFav: toggleFav, isFav: isFav,
      collections: function () { return Array.from(collections.values()).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; }); }, getCollection: function (id) { return collections.get(id) || null; },
      createCollection: createCollection, renameCollection: renameCollection, deleteCollection: deleteCollection, addToCollection: addToCollection, removeFromCollection: removeFromCollection,
      games: function () { return Array.from(games.values()).sort(function (a, b) { return b.updated - a.updated; }); }, getGame: function (id) { return games.get(id) || null; }, saveGame: saveGame, dropGame: dropGame, finishGame: finishGame,
      history: function () { return Array.from(history.values()); }, removeRecord: removeRecord,
      saveDraft: saveDraft, getDraft: getDraft, dropDraft: dropDraft, listDrafts: listDrafts, getMeta: getMeta, setMeta: setMeta,
      dump: dump, restore: restore, wipe: wipe, LIM: LIM, SETTING_DEFAULTS: SETTING_DEFAULTS
    };
    return api;
  }

  P.user = { create: create, LIM: LIM, SETTING_DEFAULTS: SETTING_DEFAULTS };
  if (typeof module !== "undefined" && module.exports) module.exports = P.user;
})(typeof globalThis !== "undefined" ? globalThis : this);
