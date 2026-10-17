/* kiem/data.js — kho dữ liệu người dùng (bộ nhớ thay IndexedDB): puzzle đã lưu, yêu thích, bộ sưu tập, ván dở, lịch sử, thiết lập, sao lưu/khôi phục. */
"use strict";
module.exports = function (t) {
  var Puz = t.Puz, realGet = Puz.types.get;
  var fakeType = { id: "fk" };
  Puz.types.get = function (id) { return id === "fk" ? fakeType : realGet(id); };
  function puz(n, o) { return Object.assign({ v: 1, type: "fk", id: "fk-" + n, seed: n, sizeId: "a", size: 3, tier: "easy", score: 2, data: {}, initial: { v: [n, 0, 0] }, solution: { v: [n, 1, 2] }, meta: {} }, o || {}); }
  function ser(id, n, upd) { return { v: 1, id: id, puzzle: puz(n), state: { v: [n, 0, 0], c: null }, undo: [], redo: [], counters: { moves: 2, mistakes: 1, undos: 0, hints: { 1: 1, 2: 0, 3: 0 }, revealed: false }, activeMs: 5000, status: "paused", startedAt: 1000, endedAt: 0, source: "random", ctx: {}, updated: upd || 1 }; }
  function rec(id, o) { return Object.assign({ id: id, type: "fk", puzzleId: "fk-1", seed: 1, tier: "easy", score: 2, size: 3, source: "random", day: null, startedAt: 1, endedAt: 2, time: 1000, mistakes: 0, hints: 0, maxHint: 0, moves: 3, result: "solved" }, o || {}); }
  var clockT = 1000, now = function () { return clockT += 10; };
  var store = Puz.store.memory(), U = Puz.user.create(store, { now: now }), events = [];
  U.on(function (e) { events.push(e.type + (e.removed ? "-" : "")); });

  function run(fn) { return fn(); }
  var chain = Promise.resolve();
  function step(name, fn) { chain = chain.then(function () { return Promise.resolve(fn()).then(function () { }, function (e) { t.ok(name + " (ném lỗi)", false, e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : String(e)); }); }); }
  function rejects(p) { return p.then(function () { return null; }, function (e) { return e; }); }

  t.group("Kho người dùng");
  step("mở kho trống", function () { return U.open().then(function () { t.ok("mở kho trống: không puzzle/ván/lịch sử, thiết lập mặc định", !U.puzzles().length && !U.games().length && !U.history().length && U.settings().autoRemove === true && U.settings().dailyGoal === 1); }); });
  step("thiết lập", function () {
    return U.setSetting("dailyGoal", 3).then(function () {
      t.eq("lưu thiết lập mục tiêu ngày", U.settings().dailyGoal, 3);
      return Promise.all([rejects(U.setSetting("dailyGoal", 0)), rejects(U.setSetting("dailyGoal", 1.5)), rejects(U.setSetting("autoRemove", "yes")), rejects(U.setSetting("khongco", true))]);
    }).then(function (es) {
      t.ok("giá trị thiết lập sai bị từ chối (0, 1.5, chuỗi, khoá lạ)", es.every(function (e) { return e && e.code === "bad_setting"; }));
      var U2 = Puz.user.create(store, { now: now }); return U2.open().then(function () { t.eq("thiết lập sống qua lần mở lại", U2.settings().dailyGoal, 3); });
    });
  });
  step("thiết lập cập nhật ngay trong RAM, hoàn lại khi ghi lỗi", function () {
    var pr = U.setSetting("autoRemove", false), immediate = U.settings().autoRemove === false;
    var evSeen = events.indexOf("settings") >= 0;
    var bad = Puz.user.create({ tx: function () { return Promise.reject(new Error("đĩa đầy")); }, volatile: false }, { now: now }), pr2 = bad.setSetting("dailyGoal", 5), immediate2 = bad.settings().dailyGoal === 5;
    return pr.then(function () { return rejects(pr2); }).then(function (e) {
      t.ok("đổi thiết lập có hiệu lực NGAY (bàn đọc được giá trị mới dù chưa ghi xong) và có phát sự kiện", immediate && evSeen);
      t.ok("ghi đĩa lỗi: RAM có giá trị mới ngay, rồi HOÀN LẠI giá trị cũ và báo lỗi", immediate2 && e && /đĩa đầy/.test(e.message) && bad.settings().dailyGoal === 1, bad.settings());
      return U.setSetting("autoRemove", true);
    });
  });
  step("puzzle + yêu thích", function () {
    return U.savePuzzle(puz(1), { name: "  Bài   đầu  tiên ", source: "custom" }).then(function (r) {
      t.eq("tên được gọn khoảng trắng", r.name, "Bài đầu tiên");
      return U.toggleFav(puz(2));
    }).then(function (r) {
      t.ok("★ puzzle chưa lưu ⇒ tự lưu kèm fav, nguồn generated", r.fav === true && r.source === "generated" && U.isFav("fk-2"));
      return U.toggleFav(puz(2));
    }).then(function (r) {
      t.ok("bỏ ★ puzzle sinh tự động không thuộc bộ sưu tập ⇒ xoá luôn", r === null && !U.getPuzzle("fk-2"));
      return U.toggleFav(puz(1));
    }).then(function (r) {
      t.ok("★ puzzle tự nhập rồi bỏ ★ ⇒ giữ lại (không mất bài của người dùng)", r.fav === true && U.getPuzzle("fk-1").source === "custom");
      return U.toggleFav(puz(1));
    }).then(function () { t.ok("bỏ ★ puzzle custom vẫn còn", U.getPuzzle("fk-1") && !U.isFav("fk-1")); return rejects(U.savePuzzle({ type: "fk" })); })
      .then(function (e) { t.ok("puzzle thiếu trạng thái đầu bị từ chối", e && e.code === "bad_puzzle"); return U.savePuzzle(Object.assign(puz(7), { id: undefined })); })
      .then(function (r) { t.ok("puzzle chưa có id được cấp id theo nội dung", /^fk-/.test(r.id) && U.getPuzzle(r.id)); });
  });
  step("bộ sưu tập", function () {
    var col;
    return U.createCollection("  Bài   khó ").then(function (c) {
      col = c; t.eq("tạo bộ sưu tập, tên gọn", c.name, "Bài khó");
      return Promise.all([rejects(U.createCollection("bài KHÓ")), rejects(U.createCollection("   ")), rejects(U.renameCollection("khong-co", "x"))]);
    }).then(function (es) {
      t.ok("trùng tên (không phân biệt hoa thường), tên rỗng, đổi tên bộ không có ⇒ từ chối", es[0].code === "dup" && es[1].code === "name" && es[2].code === "missing");
      return U.addToCollection(col.id, puz(10));
    }).then(function () {
      t.ok("thêm puzzle chưa lưu vào bộ ⇒ tự lưu (generated)", U.getPuzzle("fk-10").source === "generated" && U.getCollection(col.id).ids.join() === "fk-10");
      return U.addToCollection(col.id, puz(10));
    }).then(function (c) {
      t.eq("thêm trùng không nhân đôi", c.ids.length, 1);
      return U.toggleFav(puz(10));
    }).then(function () { return U.toggleFav(puz(10)); }).then(function (r) {
      t.ok("★ rồi bỏ ★ puzzle nằm trong bộ sưu tập ⇒ KHÔNG bị xoá", r && !r.fav && U.getPuzzle("fk-10"));
      return U.removeFromCollection(col.id, "fk-10");
    }).then(function () {
      t.ok("gỡ khỏi bộ: puzzle generated không ★ không nằm bộ nào ⇒ xoá luôn", !U.getPuzzle("fk-10") && U.getCollection(col.id).ids.length === 0);
      return U.addToCollection(col.id, puz(1));
    }).then(function () { return U.renameCollection(col.id, "Khó nhất"); }).then(function (c) {
      t.eq("đổi tên", c.name, "Khó nhất");
      return U.removePuzzle("fk-1");
    }).then(function () {
      t.ok("xoá puzzle ⇒ tự gỡ khỏi mọi bộ sưu tập", U.getCollection(col.id).ids.length === 0);
      return U.addToCollection(col.id, puz(11));
    }).then(function () { return U.deleteCollection(col.id); }).then(function () {
      t.ok("xoá bộ ⇒ puzzle generated chỉ thuộc bộ đó bị xoá; bộ biến mất", !U.getCollection(col.id) && !U.getPuzzle("fk-11"));
      return U.createCollection("Giữ lại").then(function (c2) { return U.savePuzzle(puz(12), { fav: true, source: "generated" }).then(function () { return U.addToCollection(c2.id, puz(12)); }).then(function () { return U.deleteCollection(c2.id); }); });
    }).then(function () { t.ok("xoá bộ: puzzle đã ★ được giữ", !!U.getPuzzle("fk-12")); });
  });
  step("ván dở + lịch sử (nguyên tử)", function () {
    return U.saveGame(ser("g1", 1)).then(function () {
      t.ok("lưu ván dở", U.games().length === 1 && U.getGame("g1").type === "fk");
      var U2 = Puz.user.create(store, { now: now });
      return U2.open().then(function () { t.ok("ván dở sống qua lần mở lại (sập máy)", U2.getGame("g1") && U2.getGame("g1").ser.counters.mistakes === 1); });
    }).then(function () { return U.finishGame(rec("g1")); }).then(function () {
      t.ok("kết thúc ván: có trong lịch sử VÀ ván dở biến mất (một giao dịch)", U.history().length === 1 && !U.getGame("g1"));
      var U3 = Puz.user.create(store, { now: now });
      return U3.open().then(function () { t.ok("… và bền sau khi mở lại", U3.history().length === 1 && !U3.getGame("g1")); });
    }).then(function () { return Promise.all([rejects(U.finishGame({ id: "x", result: "meh" })), rejects(U.finishGame(null)), rejects(U.saveGame({ id: "x" }))]); }).then(function (es) {
      t.ok("hồ sơ/ván sai bị từ chối", es.every(function (e) { return e && /bad_/.test(e.code); }));
    });
  });
  step("giới hạn số ván dở: ván cũ nhất thành 'bỏ dở' trong lịch sử", function () {
    var s2 = Puz.store.memory(), V = Puz.user.create(s2, { now: now }), ps = Promise.resolve();
    return V.open().then(function () {
      for (var i = 0; i < 60; i++) (function (i) { ps = ps.then(function () { return V.saveGame(ser("w" + i, i, 100 + i)); }); })(i);
      return ps;
    }).then(function () {
      t.eq("đủ 60 ván dở", V.games().length, 60);
      return V.saveGame(ser("w60", 60, 200));
    }).then(function () {
      t.ok("ván thứ 61: vẫn 60 ván dở, ván cũ nhất (w0) chuyển vào lịch sử là abandoned, giữ thời gian đã chơi", V.games().length === 60 && !V.getGame("w0") && V.history().some(function (h) { return h.id === "w0" && h.result === "abandoned" && h.time === 5000 && h.mistakes === 1 && h.hints === 1; }));
      return V.saveGame(ser("w5", 5, 300));
    }).then(function () { t.eq("ghi đè ván đã có không đẩy ván khác", V.games().length, 60); });
  });
  step("sao lưu / khôi phục (merge, replace, phần tử hỏng)", function () {
    var A = Puz.user.create(Puz.store.memory(), { now: now }), B = Puz.user.create(Puz.store.memory(), { now: now }), col;
    return A.open().then(function () { return B.open(); }).then(function () { return A.savePuzzle(puz(21), { name: "A21", fav: true }); })
      .then(function () { return A.createCollection("Bộ A"); }).then(function (c) { col = c; return A.addToCollection(c.id, puz(21)); })
      .then(function () { return A.saveGame(ser("ga", 21, 50)); }).then(function () { return A.finishGame(rec("ha", { endedAt: 5 })); }).then(function () { return A.setSetting("autoRemove", false); })
      .then(function () { return B.savePuzzle(puz(22), { name: "B22" }); }).then(function () { return B.finishGame(rec("hb", { endedAt: 6 })); })
      .then(function () { return Puz.backup.build(A, { now: now }); }).then(function (b) {
        t.ok("sao lưu: tên backup_YYYYMMDD.zip, đếm đúng", /^backup_\d{8}\.zip$/.test(b.name) && b.counts.puzzles === 1 && b.counts.collections === 1 && b.counts.games === 1 && b.counts.history === 1, b.counts);
        return b.blob.arrayBuffer();
      }).then(function (buf) {
        return Puz.backup.restoreBytes(B, new Uint8Array(buf), "merge");
      }).then(function (r) {
        t.ok("khôi phục kiểu gộp: giữ dữ liệu cũ của B, thêm của A", r.puzzles === 1 && B.getPuzzle("fk-21") && B.getPuzzle("fk-22") && B.history().length === 2 && B.collections().length === 1 && B.games().length === 1, r);
        t.ok("gộp không đè thiết lập của B", B.settings().autoRemove === true);
        t.eq("bộ sưu tập giữ đúng tham chiếu puzzle", B.collections()[0].ids, ["fk-21"]);
        return Puz.backup.build(A, { now: now }).then(function (b2) { return b2.blob.arrayBuffer(); }).then(function (buf) { return Puz.backup.restoreBytes(B, new Uint8Array(buf), "replace"); });
      }).then(function () {
        t.ok("khôi phục kiểu thay thế: B giống hệt A (mất puzzle 22), thiết lập theo A", !B.getPuzzle("fk-22") && B.history().length === 1 && B.history()[0].id === "ha" && B.settings().autoRemove === false);
        var bad = A.dump(); bad.puzzles.push({ id: "x" }, null, { id: "y", puzzle: { type: "khong-co", initial: { v: [] } } }); bad.history.push({ id: "z", type: "fk", result: "wow", time: 1, endedAt: 1 }); bad.collections.push({ id: "q" }); bad.games.push({ id: "r" });
        return B.restore(bad, "merge");
      }).then(function (r) {
        t.ok("phần tử hỏng bị bỏ và đếm (3 puzzle, 1 lịch sử, 1 bộ, 1 ván)", r.skipped.puzzles === 3 && r.skipped.history === 1 && r.skipped.collections === 1 && r.skipped.games === 1, r.skipped);
        return Promise.all([rejects(B.restore(null)), rejects(B.restore("x")), B.restore({}, "merge")]);
      }).then(function (rs) {
        t.ok("dữ liệu không phải đối tượng → từ chối; đối tượng rỗng → nạp 0 phần tử", rs[0].code === "bad_backup" && rs[1].code === "bad_backup" && rs[2].puzzles === 0);
        return Puz.backup.build(A, { now: now });
      }).then(function (b) {
        return b.blob.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf), flipped = bytes.slice(); flipped[Math.floor(flipped.length / 2)] ^= 0xff;
          return Promise.all([rejects(Puz.backup.parseBackup(new Uint8Array([1, 2, 3]))), rejects(Puz.backup.parseBackup(flipped))]);
        });
      }).then(function (es) {
        t.ok("tệp không phải zip / zip bị hỏng một byte → từ chối (CRC)", es[0] && es[1], es.map(function (e) { return e && e.message; }));
        return Puz.zip.create([{ name: "manifest.json", data: JSON.stringify({ app: "app-khac", v: 1, counts: {} }) }, { name: "data.json", data: "{}" }], { deflate: false });
      }).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) { return rejects(Puz.backup.parseBackup(new Uint8Array(buf))); }).then(function (e) {
        t.ok("sao lưu của app khác bị từ chối rõ ràng", e && e.code === "wrong_app");
        return Puz.zip.create([{ name: "manifest.json", data: JSON.stringify({ app: "logic-puzzle-suite", v: 1, counts: { puzzles: 5 } }) }, { name: "data.json", data: JSON.stringify({ puzzles: [] }) }], { deflate: false });
      }).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) { return rejects(Puz.backup.parseBackup(new Uint8Array(buf))); }).then(function (e) { t.ok("số lượng không khớp manifest bị từ chối", e && e.code === "count_mismatch"); });
  });
  step("bản nháp, meta, sự kiện, xoá sạch", function () {
    return U.saveDraft("edit:fk", { n: 1 }).then(function () { return U.getDraft("edit:fk"); }).then(function (d) {
      t.ok("bản nháp lưu và đọc lại", d && d.value.n === 1 && d.at > 0);
      return U.listDrafts();
    }).then(function (l) { t.eq("liệt kê bản nháp", l.length, 1); return U.dropDraft("edit:fk"); }).then(function () { return U.getDraft("edit:fk"); }).then(function (d) {
      t.ok("xoá bản nháp", !d); return U.setMeta("lastBackup", 123).then(function () { return U.getMeta("lastBackup"); });
    }).then(function (v) {
      t.eq("meta", v, 123);
      t.ok("có phát sự kiện puzzle/collection/game/history/settings", ["puzzle", "collection", "game", "history", "settings"].every(function (k) { return events.indexOf(k) >= 0; }), events.slice(0, 20));
      return U.wipe();
    }).then(function () {
      t.ok("xoá sạch: không còn gì, thiết lập về mặc định", !U.puzzles().length && !U.collections().length && !U.games().length && !U.history().length && U.settings().dailyGoal === 1);
      var U4 = Puz.user.create(store, { now: now }); return U4.open().then(function () { t.ok("… và bền sau khi mở lại", !U4.puzzles().length && !U4.history().length && U4.settings().dailyGoal === 1); });
    });
  });
  step("giao dịch lỗi không để lại gì (nguyên tử)", function () {
    var s3 = Puz.store.memory(), V = Puz.user.create(s3, { now: now });
    return V.open().then(function () { return V.savePuzzle(puz(31)); }).then(function () {
      return rejects(s3.tx(["puzzles", "history"], "rw", function (tx) { return tx.put("history", rec("zz")).then(function () { return tx.put("puzzles", Object.assign({ id: "fk-32" }, {})).then(function () { throw new Error("giữa chừng"); }); }); }));
    }).then(function (e) { return s3.tx(["puzzles", "history"], "r", function (tx) { return Promise.all([tx.all("history"), tx.all("puzzles")]); }).then(function (r) { t.ok("lỗi giữa giao dịch ⇒ không ghi gì (lịch sử trống, puzzle 31 còn nguyên, 32 không có)", e && r[0].length === 0 && r[1].length === 1 && r[1][0].id === "fk-31"); }); });
  });

  return chain.then(function () { Puz.types.get = realGet; }, function (e) { Puz.types.get = realGet; throw e; });
};
