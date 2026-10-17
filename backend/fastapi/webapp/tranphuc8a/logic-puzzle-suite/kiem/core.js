/* kiem/core.js — kiểm lõi dùng chung: PRNG/seed, tiện ích, CSP (so với kết quả đã biết), ván chơi (undo/redo bằng diff, đồng hồ, lưu/khôi phục). */
"use strict";
module.exports = function (t) {
  var Puz = t.Puz, R = Puz.rng, U = Puz.util, C = Puz.csp, G = Puz.game;

  t.group("PRNG theo seed");
  var a = R.create(18372941), b = R.create(18372941), xs = [], ys = [];
  for (var i = 0; i < 1000; i++) { xs.push(a.next()); ys.push(b.next()); }
  t.ok("cùng seed → cùng 1000 số", JSON.stringify(xs) === JSON.stringify(ys));
  t.ok("khác seed → khác dãy", R.create(1).next() !== R.create(2).next());
  t.ok("số nằm trong [0,1)", xs.every(function (x) { return x >= 0 && x < 1; }));
  (function () {            // bản cài đặt mulberry32 viết lại độc lập ngay trong test (không có giá trị tham chiếu công bố để dùng): bắt lỗi chép sai hằng số/phép dịch bit
    function ref(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; var x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
    var bad = [];
    [0, 1, 42, 18372941, 4294967295].forEach(function (sd) { var A = ref(sd), B = R.create(sd); for (var k = 0; k < 200; k++) if (A() !== B.next()) { bad.push(sd + "@" + k); break; } });
    t.ok("khớp bản mulberry32 viết lại độc lập (5 seed × 200 số)", bad.length === 0, bad);
  })();
  t.ok("seed chuỗi số = seed số", R.seedOf("18372941") === 18372941 && R.seedOf(" 42 ") === 42);
  t.ok("seed chuỗi chữ được băm ổn định", R.seedOf("hello") === R.seedOf("hello") && R.seedOf("hello") !== R.seedOf("hellp"));
  t.ok("seed lớn hơn 2^32 được cuộn về uint32, không NaN", R.seedOf(4294967297) === 1 && R.seedOf(1e20) >= 0 && R.seedOf(1e20) < 4294967296);
  var rr = R.create(7), cnt = [0, 0, 0, 0, 0, 0]; for (i = 0; i < 6000; i++) cnt[rr.int(6)]++;
  t.ok("int(6) phân bố gần đều (mỗi mặt 800–1200 / 6000)", cnt.every(function (c) { return c > 800 && c < 1200; }), cnt);
  var sh = R.create(5).shuffle([1, 2, 3, 4, 5, 6, 7, 8]); t.ok("shuffle là hoán vị", sh.slice().sort().join() === "1,2,3,4,5,6,7,8" && sh.join() !== "1,2,3,4,5,6,7,8");
  t.ok("fork tách dòng riêng và tất định", R.create(9).fork("x").next() === R.create(9).fork("x").next() && R.create(9).fork("x").next() !== R.create(9).fork("y").next());
  var f1 = R.create(9); f1.fork("a").next(); var seq1 = f1.next(); var seq2 = R.create(9).next(); t.ok("fork không làm lệch dòng chính", seq1 === seq2);
  var rs = R.randomSeed(); t.ok("randomSeed là số 8 chữ số", rs >= 10000000 && rs <= 99999999 && Math.floor(rs) === rs);

  t.group("Tiện ích");
  t.eq("fmtTime 07:32", U.fmtTime(452000), "07:32");
  t.eq("fmtTime ≥ 1 giờ", U.fmtTime(3600000 + 7 * 60000 + 32000), "1:07:32");
  t.eq("fmtTime âm/NaN-an toàn", U.fmtTime(-5), "00:00");
  t.eq("bậc theo điểm: 0→easy 3.5→medium 5.5→hard 7.5→expert 10→expert", [0, 3.4, 3.5, 5.5, 7.5, 10].map(function (s) { return U.tierOfScore(s).id; }), ["easy", "easy", "medium", "hard", "expert", "expert"]);
  t.eq("dayKey theo giờ địa phương", U.dayKey(new Date(2026, 9, 6, 23, 59)), "2026-10-06");
  t.eq("addDays qua ranh giới tháng/năm/năm nhuận", [U.addDays("2026-10-31", 1), U.addDays("2026-12-31", 1), U.addDays("2028-02-28", 1), U.addDays("2026-03-01", -1)], ["2026-11-01", "2027-01-01", "2028-02-29", "2026-02-28"]);
  t.eq("dayNumber liên tiếp cách nhau 1 (kể cả qua đổi giờ mùa hè)", [U.dayNumber("2026-03-29") - U.dayNumber("2026-03-28"), U.dayNumber("2026-10-25") - U.dayNumber("2026-10-24")], [1, 1]);
  t.eq("popcount / bitsOf / lowBit", [U.popcount(0b1011010), U.bitsOf(0b1011010), U.lowBit(0b1011000)], [4, [1, 3, 4, 6], 3]);
  t.ok("puzzleId ổn định và phân biệt", U.puzzleId({ type: "x", size: 3, data: { a: 1 }, initial: { v: [0, 1] } }) === U.puzzleId({ type: "x", size: 3, data: { a: 1 }, initial: { v: [0, 1] } }) && U.puzzleId({ type: "x", size: 3, data: { a: 1 }, initial: { v: [0, 1] } }) !== U.puzzleId({ type: "x", size: 3, data: { a: 1 }, initial: { v: [1, 1] } }));

  t.group("CSP — đối chiếu số nghiệm đã biết (nguồn: OEIS A000170)");
  function queens(n) {
    var vars = [], cons = [], r, s;
    for (r = 0; r < n; r++) vars.push({ name: "R" + r, size: n });
    for (r = 0; r < n; r++) for (s = r + 1; s < n; s++) (function (r, s) { cons.push({ vars: [r, s], test: function (v) { return v[0] !== v[1] && Math.abs(v[0] - v[1]) !== s - r; }, label: "hậu hàng " + r + " và " + s + " không ăn nhau" }); })(r, s);
    return C.problem({ vars: vars, cons: cons });
  }
  var KNOWN = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352 };
  Object.keys(KNOWN).forEach(function (n) { t.eq("N-Queens N=" + n + " có " + KNOWN[n] + " nghiệm", C.solve(queens(+n), { limit: 100000, keep: 0 }).count, KNOWN[n]); });
  t.time("N-Queens N=10 → 724 nghiệm", 8000, function () { t.eq("  số nghiệm N=10", C.solve(queens(10), { limit: 1e6, keep: 0 }).count, 724); });
  var one = C.solve(queens(8), { limit: 1 }); var q = one.solutions[0];
  t.ok("nghiệm trả về hợp lệ (8 hậu không ăn nhau)", q.length === 8 && q.every(function (c, r) { return q.every(function (d, s) { return r === s || (c !== d && Math.abs(c - d) !== Math.abs(r - s)); }); }), q);
  t.eq("N=2,3 vô nghiệm", [C.solve(queens(2), { limit: 5 }).count, C.solve(queens(3), { limit: 5 }).count], [0, 0]);
  t.eq("count(limit=2) cắt ở 2", C.count(queens(8), 2), 2);
  var tr = C.solve(queens(4), { limit: 5, trace: true });
  t.eq("cây N=4: bốn cách đặt hậu hàng 0, hai cách sai ngay (fail), hai cách ra nghiệm (lan truyền tự giải nốt)", tr.trace.map(function (n) { return n.status; }), ["fail", "solution", "solution", "fail"]);
  var tr6 = C.solve(queens(6), { limit: 10, trace: true });
  t.ok("cây N=6 (cần tìm kiếm thật): có nhánh sâu > 1, có nút dead, đúng 4 nút nghiệm", tr6.trace.some(function (n) { return n.depth > 1; }) && tr6.trace.some(function (n) { return n.status === "dead"; }) && tr6.trace.filter(function (n) { return n.status === "solution"; }).length === 4 && tr6.trace.every(function (n) { return /^(fail|dead|ok|solution)$/.test(n.status); }), tr6.trace.length);
  t.ok("cây tìm kiếm: cha luôn có id nhỏ hơn con", tr.trace.every(function (n) { return n.parent < n.id; }));
  (function () {            // tìm kiếm bị cắt giữa chừng (maxNodes): nhánh đang duyệt dở phải là "open", KHÔNG được báo "dead" khi thực ra còn sống (lỗi do agent N-Queens phát hiện)
    var full = C.solve(queens(8), { limit: 1e6, keep: 0, trace: true, traceMax: 100000 }), cut = C.solve(queens(8), { limit: 1e6, keep: 0, trace: true, maxNodes: 25 });
    var key = function (tr, n) { var out = []; for (var x = n; x; x = tr[x.parent]) out.push(x.v + "=" + x.val); return out.join("<"); };
    var fullStatus = {}; full.trace.forEach(function (n) { fullStatus[key(full.trace, n)] = n.status; });
    var wrong = cut.trace.filter(function (n) { return n.status === "dead" && fullStatus[key(cut.trace, n)] !== "dead" && fullStatus[key(cut.trace, n)] !== "fail"; });
    t.ok("cắt maxNodes=25: có đặt cờ truncated và có nút 'open' cho nhánh dở", cut.truncated && cut.trace.some(function (n) { return n.status === "open"; }), cut.trace.map(function (n) { return n.status; }).join());
    t.ok("cắt maxNodes=25: không nút nào bị báo 'dead' sai (so với lần chạy đầy đủ)", wrong.length === 0, wrong.slice(0, 3));
    var small = C.solve(queens(8), { limit: 1e6, keep: 0, trace: true, traceMax: 10 });
    t.ok("traceMax nhỏ: đặt traceTruncated, kết quả đếm không đổi (92)", small.traceTruncated === true && small.count === 92 && small.trace.length === 10, [small.traceTruncated, small.count]);
    t.ok("không cắt thì traceTruncated = false", C.solve(queens(4), { limit: 5, trace: true }).traceTruncated === false);
  })();
  var rg = C.solve(queens(8), { limit: 1, rng: R.create(3) }).solutions[0], rg2 = C.solve(queens(8), { limit: 1, rng: R.create(3) }).solutions[0];
  t.ok("thứ tự giá trị xáo theo rng vẫn tất định", JSON.stringify(rg) === JSON.stringify(rg2) && JSON.stringify(rg) !== JSON.stringify(one.solutions[0]));

  t.group("CSP — alldiff, ràng buộc tuỳ ý, lan truyền");
  var P1 = C.problem({ vars: [{ name: "A", size: 3 }, { name: "B", size: 3 }, { name: "C", size: 3 }], cons: [{ kind: "alldiff", vars: ["A", "B", "C"] }] });
  t.eq("3 biến khác nhau trong 3 giá trị: 6 hoán vị", C.solve(P1, { limit: 100, keep: 0 }).count, 6);
  var P2 = C.problem({ vars: [{ name: "A", size: 3 }, { name: "B", size: 3 }, { name: "C", size: 3 }], cons: [{ kind: "alldiff", vars: ["A", "B", "C"] }, { vars: ["A"], test: function (v) { return v[0] !== 0; }, label: "A ≠ 0" }, { vars: ["B"], test: function (v) { return v[0] === 1; }, label: "B = 1" }] });
  var dom = C.domains(P2); var ok2 = C.propagate(P2, dom);
  t.ok("lan truyền: B chốt 1, A còn {2}, C còn {0}", ok2 && dom[1] === 2 && dom[0] === 4 && dom[2] === 1, Array.from(dom));
  t.eq("… và đúng một nghiệm [2,1,0]", C.solve(P2, { limit: 5 }).solutions, [[2, 1, 0]]);
  var P3 = C.problem({ vars: [{ name: "A", size: 2 }, { name: "B", size: 2 }, { name: "C", size: 2 }], cons: [{ kind: "alldiff", vars: ["A", "B", "C"] }] });
  t.eq("3 biến khác nhau trong 2 giá trị: vô nghiệm (chuồng bồ câu)", C.solve(P3, { limit: 5 }).count, 0);
  var steps = []; C.propagate(P2, C.domains(P2), null, steps);
  t.ok("ghi lại các bước lan truyền (giải thích)", steps.length >= 2 && steps.every(function (s) { return s.removed > 0 && typeof s.v === "number"; }), steps);
  var P4 = C.problem({ vars: [{ name: "X", size: 5 }, { name: "Y", size: 5 }], cons: [{ vars: ["X", "Y"], test: function (v) { return v[0] + v[1] === 7; }, label: "X + Y = 7" }] });
  t.eq("ràng buộc tuỳ ý X+Y=7 trên 0..4: đúng hai nghiệm (3,4) và (4,3)", C.solve(P4, { limit: 99, keep: 99 }).solutions.map(function (s) { return s.join(","); }).sort(), ["3,4", "4,3"]);
  t.eq("mô tả ràng buộc dùng nhãn", C.describe(P4, P4.cons[0]), "X + Y = 7");
  t.eq("miền khởi đầu hạn chế", C.solve(C.problem({ vars: [{ name: "A", size: 4 }], domains: { A: 0b0100 } }), { limit: 3 }).solutions, [[2]]);

  t.group("Ván chơi (game.js) — dùng loại puzzle giả 3 ô");
  var fake = {
    id: "fake", name: "Giả", family: "Grid Puzzle", category: "x", icon: "?", blurb: "x", rules: ["x"], sizes: [{ id: "3", label: "3", params: 3, default: true }], algorithm: { title: "x", steps: [{ title: "a", text: "b" }] }, difficultyNote: "x",
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    moveFor: function (p, s, a) { if (a.k === "set") { if (p.initial.v[a.i]) return null; return { d: [["v", a.i, s.v[a.i], a.val]], label: "điền" }; } if (a.k === "cand") return { d: [["c", a.i, s.c ? s.c[a.i] : 0, (s.c ? s.c[a.i] : 0) ^ (1 << a.bit)]], label: "ứng viên" }; return null; },
    check: function (p, s) { return { solved: s.v.every(function (x, i) { return x === p.solution.v[i]; }), conflicts: [], filled: s.v.filter(Boolean).length, total: s.v.length }; },
    mistakes: function (p, s, d) { return d.d.filter(function (e) { return e[0] === "v" && e[3] && e[3] !== p.solution.v[e[1]]; }).length; },
    hint: function (p, s, level) { return { level: level, text: "gợi ý " + level, cells: [], action: level === 3 ? { k: "set", i: 1, val: 2 } : null }; }
  };
  // loại giả không đăng ký vào sổ (sẽ làm hỏng test conformance): game.create tra Puz.types.get → ghi đè tạm rồi trả lại cuối nhóm
  var reg = Puz.types; var realGet = reg.get; reg.get = function (id) { return id === "fake" ? fake : realGet(id); };
  var puzzle = { type: "fake", seed: 1, size: 3, tier: "easy", score: 2, data: {}, initial: { v: [1, 0, 0] }, solution: { v: [1, 2, 3] } };
  var clockT = 1000, g = G.create(puzzle, { now: function () { return clockT; } });
  t.eq("ván mới ở trạng thái ready, đồng hồ 0", [g.status, g.elapsed()], ["ready", 0]);
  var r0 = g.act({ k: "set", i: 1, val: 2 });
  t.ok("nước đi đầu tiên bắt đầu ván (playing) và áp diff", r0.ok && g.status === "playing" && g.state.v[1] === 2);
  clockT += 5000; t.eq("đồng hồ chạy theo giờ giả: 5000 ms", g.elapsed(), 5000);
  g.pause(); clockT += 60000; t.eq("tạm dừng: đồng hồ đứng", [g.status, g.elapsed()], ["paused", 5000]);
  t.ok("đang tạm dừng thì không đi được", g.act({ k: "set", i: 2, val: 3 }).reason === "paused");
  g.resume(); clockT += 1000; t.eq("tiếp tục: cộng dồn", g.elapsed(), 6000);
  t.ok("ô cho sẵn không sửa được (moveFor trả null → noop)", g.act({ k: "set", i: 0, val: 9 }).reason === "noop");
  var r1 = g.act({ k: "set", i: 2, val: 7 }); t.ok("điền sai: tính 1 lỗi", r1.ok && r1.mistakes === 1 && g.counters.mistakes === 1);
  t.ok("undo trả đúng trạng thái trước", g.undo() && g.state.v[2] === 0 && g.canRedo());
  t.ok("undo không giảm số lỗi đã mắc", g.counters.mistakes === 1);
  t.ok("redo áp lại", g.redo() && g.state.v[2] === 7);
  g.undo(); g.act({ k: "cand", i: 2, bit: 1 }); t.ok("diff trường c: tạo mảng ứng viên", g.state.c && g.state.c[2] === 2);
  t.ok("undo ứng viên về 0", g.undo() && g.state.c[2] === 0);
  var snap = g.serialize(); t.ok("serialize: ván đang chơi lưu thành paused, JSON an toàn", snap.status === "paused" && JSON.stringify(snap).length > 50 && JSON.parse(JSON.stringify(snap)).state.v.length === 3);
  var g2 = G.restore(JSON.parse(JSON.stringify(snap)), { now: function () { return clockT; } });
  t.ok("restore: trạng thái, lịch sử, thời gian, bộ đếm khớp", JSON.stringify(g2.state) === JSON.stringify(g.state) && g2.undoStack.length === g.undoStack.length && g2.elapsed() === snap.activeMs && g2.counters.mistakes === 1, [g2.elapsed(), snap.activeMs]);
  var h = g.hint(3); t.ok("gợi ý mức 3 có hành động, ghi bộ đếm", h.level === 3 && h.action && g.counters.hints[3] === 1 && g.hintCount() === 1);
  g.undo();
  var done = null; g.on(function (ev) { if (ev.type === "solved") done = true; });
  g.act({ k: "set", i: 1, val: 2 }); var rs2 = g.act({ k: "set", i: 2, val: 3 });
  t.ok("giải xong → solved, báo sự kiện, đồng hồ dừng", rs2.check.solved && g.status === "solved" && done === true && g.elapsed() === g.elapsed());
  var e1 = g.elapsed(); clockT += 99999; t.ok("sau khi xong đồng hồ không chạy nữa", g.elapsed() === e1);
  t.ok("xong rồi không đi tiếp được, không undo", g.act({ k: "set", i: 1, val: 1 }).reason === "finished" && !g.canUndo());
  var rec = g.record(); t.ok("hồ sơ ván: loại, seed, bậc, lỗi, gợi ý, kết quả", rec.type === "fake" && rec.seed === 1 && rec.tier === "easy" && rec.mistakes === 1 && rec.hints === 1 && rec.maxHint === 3 && rec.result === "solved", rec);
  var g3 = G.create(puzzle, { now: function () { return clockT; } }); g3.act({ k: "set", i: 1, val: 2 });
  t.ok("reveal: điền lời giải, trạng thái revealed, ghi revealed", g3.reveal() && g3.status === "revealed" && g3.counters.revealed && g3.state.v.join() === "1,2,3" && g3.record().result === "revealed");
  var g4 = G.create(puzzle, { now: function () { return clockT; } }); g4.act({ k: "set", i: 1, val: 5 }); g4.restart();
  t.ok("restart: về trạng thái đầu, xoá lịch sử/đếm/đồng hồ", g4.status === "ready" && g4.state.v.join() === "1,0,0" && !g4.canUndo() && g4.counters.mistakes === 0 && g4.elapsed() === 0);
  t.ok("applyDiff/reverseDiff đối ngẫu", (function () { var s = { v: [1, 2, 3], c: null }, d = [["v", 0, 1, 9], ["v", 1, 2, 8]]; G.applyDiff(s, d, false); var ok1 = s.v.join() === "9,8,3"; G.applyDiff(s, G.reverseDiff(d), false); return ok1 && s.v.join() === "1,2,3"; })());
  t.ok("diffTo chỉ liệt kê ô khác", JSON.stringify(G.diffTo({ v: [1, 2, 3], c: null }, { v: [1, 9, 3], c: null })) === JSON.stringify([["v", 1, 2, 9]]));
  reg.get = realGet;
};
