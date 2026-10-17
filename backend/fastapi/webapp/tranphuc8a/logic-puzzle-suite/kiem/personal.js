/* kiem/personal.js — các mô-đun cá nhân thuần: Daily Puzzle, thống kê + streak, đề xuất độ khó, nhập/xuất tệp. Kịch bản đều được tính tay (ghi trong từng phép). */
"use strict";
module.exports = function (t) {
  var Puz = t.Puz, D = Puz.daily, S = Puz.stats, PR = Puz.progress, F = Puz.files, U = Puz.util;

  t.group("Daily Puzzle — tất định theo ngày");
  t.eq("thứ trong tuần của ngày đã biết: 1970-01-01 Năm, 2000-01-01 Bảy, 2024-02-29 Năm, 2026-10-17 Bảy, 2026-10-18 CN", ["1970-01-01", "2000-01-01", "2024-02-29", "2026-10-17", "2026-10-18"].map(D.weekday), [4, 6, 4, 6, 0]);
  var ids = ["sudoku", "nqueens", "lightsout", "nonogram", "logicgrid"];
  var fakeDef = function (id) { return { id: id, sizes: [{ id: "a", label: "a", params: 1 }, { id: "b", label: "b", params: 2, default: true, tiers: ["easy", "medium"] }] }; };
  var realGet = Puz.types.get, realAll = Puz.types.all;
  Puz.types.get = function (id) { return ids.indexOf(id) >= 0 ? fakeDef(id) : realGet(id); };
  Puz.types.all = function () { return ids.map(fakeDef); };
  try {
    var d1 = D.forDay("2026-10-17", ids), d2 = D.forDay("2026-10-17", ids.slice().reverse());
    t.eq("cùng ngày → cùng kết quả (kể cả khi danh sách đăng ký đảo thứ tự)", d1, d2);
    t.ok("khác ngày → seed khác", D.forDay("2026-10-18", ids).seed !== d1.seed);
    t.ok("seed là số 8 chữ số", d1.seed >= 10000000 && d1.seed <= 99999999);
    var seen = {}; for (var k = 0; k < 10; k++) seen[D.forDay(U.addDays("2026-10-01", k), ids).type] = 1;
    t.eq("10 ngày liên tiếp đi hết cả 5 loại", Object.keys(seen).sort(), ids.slice().sort());
    t.eq("xoay vòng đều: ngày n và n+5 cùng loại", D.forDay("2026-10-01", ids).type, D.forDay("2026-10-06", ids).type);
    t.eq("bậc theo thứ, bị chặn bởi bậc cỡ sinh được (cỡ mặc định chỉ có easy/medium): thứ Bảy muốn expert → medium", D.forDay("2026-10-17", ids).tier, "medium");
    t.eq("Thứ Hai muốn easy → easy", D.forDay("2026-10-12", ids).tier, "easy");
    t.eq("thiếu loại đăng ký → nhảy sang loại kế tiếp, không null", D.forDay("2026-10-01", ["lightsout"]).type, "lightsout");
    t.ok("ngày sai định dạng → null, không ném lỗi", D.forDay("hôm nay", ids) === null && D.forDay("", ids) === null);
    t.ok("loại V2 (không có trong ORDER) đứng sau, không đảo lịch cũ", D.forDay("2026-10-17", ids.concat(["minesweeper"])).type === d1.type);
  } finally { Puz.types.get = realGet; Puz.types.all = realAll; }

  t.group("Thống kê và streak");
  function rec(day, o) { return Object.assign({ id: "g" + Math.random(), type: "sudoku", tier: "easy", score: 3, source: "random", day: day, endedAt: U.dayNumber(day) * 86400000 + 43200000, time: 300000, mistakes: 0, hints: 0, result: "solved" }, o || {}); }
  var recs = [rec("2026-10-10"), rec("2026-10-11"), rec("2026-10-12", { result: "revealed" }), rec("2026-10-13"), rec("2026-10-13", { type: "nqueens", time: 100000 }), rec("2026-10-14"), rec("2026-10-15"), rec("2026-10-17")];
  t.eq("streak hôm nay 10-17 (mục tiêu 1): 10-16 trống ⇒ hôm nay chỉ còn 1; kỷ lục 10-13..10-15 = 3", (function () { var s = S.streak(recs, "2026-10-17", 1); return [s.current, s.best, s.todayDone, s.todayCount]; })(), [1, 3, true, 1]);
  t.eq("hôm nay 10-18 chưa chơi: streak còn sống nếu hôm qua đạt (=1: chỉ 10-17)", (function () { var s = S.streak(recs, "2026-10-18", 1); return [s.current, s.todayDone]; })(), [1, false]);
  t.eq("hôm nay 10-19 chưa chơi và hôm qua cũng không: streak = 0", S.streak(recs, "2026-10-19", 1).current, 0);
  t.eq("10-12 chỉ có Reveal ⇒ không tính (đoạn 10-10..11 dài 2, đoạn 10-13..15 dài 3)", S.streak(recs, "2026-10-15", 1).best, 3);
  t.eq("hôm nay 10-15: streak hiện tại 3 (13,14,15)", S.streak(recs, "2026-10-15", 1).current, 3);
  t.eq("mục tiêu 2 ván/ngày: chỉ 10-13 có 2 ván ⇒ best 1", [S.streak(recs, "2026-10-13", 2).best, S.streak(recs, "2026-10-13", 2).current], [1, 1]);
  t.eq("danh sách rỗng", (function () { var s = S.streak([], "2026-10-17", 1); return [s.current, s.best, s.todayDone]; })(), [0, 0, false]);
  t.eq("streak qua ranh giới tháng/năm: 2026-12-30,31, 2027-01-01 ⇒ 3", S.streak([rec("2026-12-30"), rec("2026-12-31"), rec("2027-01-01")], "2027-01-01", 1).current, 3);
  var sm = S.summarize(recs);
  t.eq("tổng: 8 ván, 7 giải, 1 reveal", [sm.total.played, sm.total.solved, sm.total.revealed], [8, 7, 1]);
  t.eq("Sudoku: 6 ván giải, trung bình 300000 ms, tốt nhất 300000 ms", [sm.byType.sudoku.solved, sm.byType.sudoku.avgMs, sm.byType.sudoku.bestMs], [6, 300000, 300000]);
  t.eq("N-Queens: 1 giải, 100000 ms", [sm.byType.nqueens.solved, sm.byType.nqueens.avgMs], [1, 100000]);
  t.ok("theo bậc có mặt", sm.byType.sudoku.byTier.easy.solved === 6);
  var multi = S.summarize([rec("2026-10-10", { time: 100000 }), rec("2026-10-10", { time: 300000 }), rec("2026-10-10", { time: 200000, mistakes: 3, hints: 2 })]);
  t.eq("trung bình thời gian 200000, tốt nhất 100000, lỗi TB 1, gợi ý TB 0.7", [multi.total.avgMs, multi.total.bestMs, multi.total.avgMistakes, multi.total.avgHints], [200000, 100000, 1, 0.7]);
  t.eq("trung vị", S.median([5, 1, 3]) + "," + S.median([1, 2, 3, 4]), "3,2.5");
  t.eq("perDay đếm ván giải", S.perDay(recs)["2026-10-13"], 2);
  t.eq("ngày lấy từ endedAt nếu bản ghi không có day (giờ địa phương)", S.dayOf({ endedAt: new Date(2026, 9, 6, 23, 30).getTime() }), "2026-10-06");

  t.group("Đề xuất độ khó");
  function games(type, tier, n, o) { var out = []; for (var i = 0; i < n; i++) out.push(Object.assign({ type: type, tier: tier, result: "solved", time: 60000, mistakes: 0, hints: 0, endedAt: 1000 + i }, o || {})); return out; }
  t.eq("chưa chơi → easy, đứng yên", (function () { var r = PR.recommend([], "sudoku"); return [r.current, r.recommended, r.action]; })(), ["easy", "easy", "stay"]);
  t.eq("mới 2 ván → chưa đề xuất", PR.recommend(games("sudoku", "hard", 2), "sudoku").action, "stay");
  t.eq("Hard giải nhanh 3 lần (1 phút ≪ 70 % của 16 phút), sạch ⇒ lên expert", (function () { var r = PR.recommend(games("sudoku", "hard", 3), "sudoku"); return [r.action, r.recommended]; })(), ["up", "expert"]);
  t.eq("đã ở expert thì không lên nữa", PR.recommend(games("sudoku", "expert", 3), "sudoku").action, "stay");
  t.eq("giải nhanh nhưng có dùng gợi ý ⇒ giữ", PR.recommend(games("sudoku", "hard", 3, { hints: 1 }), "sudoku").action, "stay");
  t.eq("giải nhanh nhưng 3 lỗi mỗi ván ⇒ giữ", PR.recommend(games("sudoku", "hard", 3, { mistakes: 3 }), "sudoku").action, "stay");
  t.eq("giải chậm (15 phút, gần mốc 16) ⇒ giữ", PR.recommend(games("sudoku", "hard", 3, { time: 15 * 60000 }), "sudoku").action, "stay");
  t.eq("2/3 ván Hard bị Reveal ⇒ xuống medium", (function () { var g = games("sudoku", "hard", 3); g[0].result = "revealed"; g[1].result = "abandoned"; var r = PR.recommend(g, "sudoku"); return [r.action, r.recommended]; })(), ["down", "medium"]);
  t.eq("chỉ 1/3 bị bỏ ⇒ giữ", (function () { var g = games("sudoku", "hard", 3); g[0].result = "abandoned"; return PR.recommend(g, "sudoku").action; })(), "stay");
  t.eq("đã ở easy thì không xuống nữa", (function () { var g = games("sudoku", "easy", 3); g.forEach(function (x) { x.result = "revealed"; }); return PR.recommend(g, "sudoku").action; })(), "stay");
  t.eq("chậm ≥ 2× mốc và ≥ 3 gợi ý cả 3 ván ⇒ xuống", PR.recommend(games("sudoku", "medium", 3, { time: 25 * 60000, hints: 4 }), "sudoku").action, "down");
  t.eq("chỉ xét loại được hỏi (N-Queens khác Sudoku)", PR.recommend(games("sudoku", "hard", 3).concat(games("nqueens", "easy", 1)), "nqueens").current, "easy");
  t.ok("lý do bằng tiếng Việt, không rỗng, không undefined", ["", "x"].every(function () { return true; }) && PR.recommend(games("sudoku", "hard", 3), "sudoku").reason.length > 20 && !/undefined|NaN/.test(PR.recommend(games("sudoku", "hard", 3), "sudoku").reason));
  t.eq("mốc tham chiếu: sudoku hard 16 phút", PR.refMs("sudoku", "hard"), 16 * 60000);

  t.group("Nhập/xuất tệp (với loại giả)");
  var calls = [];
  var fake = {
    id: "fk", name: "Giả",
    toFile: function (p) { return { type: "fk", seed: p.seed, difficulty: p.score, size: p.size, initialState: p.initial.v.join(""), solution: p.solution.v.join(""), metadata: p.meta || {} }; },
    fromFile: function (o) { calls.push("file"); if (typeof o.initialState !== "string" || !/^[0-9]+$/.test(o.initialState)) return { ok: false, errors: ["initialState hỏng"] }; return { ok: true, puzzle: { type: "fk", seed: o.seed, tier: "custom", score: 1, size: o.size, data: {}, initial: { v: o.initialState.split("").map(Number) }, solution: { v: String(o.solution).split("").map(Number) }, meta: {} }, errors: [], warnings: o.warn ? ["cảnh báo thử"] : [] }; },
    toText: function (p) { return "FK " + p.initial.v.join(""); },
    fromText: function (s) { var m = /^FK\s+([0-9]+)$/.exec(s.trim()); if (!m) return { ok: false, errors: ["không phải văn bản FK"] }; return { ok: true, puzzle: { type: "fk", seed: null, tier: "custom", score: 1, size: 3, data: {}, initial: { v: m[1].split("").map(Number) }, solution: { v: m[1].split("").map(Number) }, meta: {} }, errors: [], warnings: [] }; }
  };
  var other = { id: "ot", name: "Khác", toFile: fake.toFile, fromFile: fake.fromFile, toText: fake.toText, fromText: function () { return { ok: false, errors: ["không phải OT"] }; } };
  Puz.types.get = function (id) { return id === "fk" ? fake : id === "ot" ? other : realGet(id); };
  Puz.types.all = function () { return [fake, other]; };
  try {
    var pz = { type: "fk", seed: 42, tier: "hard", score: 7.4, size: 3, initial: { v: [1, 0, 2] }, solution: { v: [1, 3, 2] }, meta: { name: "thử" } };
    var json = F.exportJson([pz, pz], Date.UTC(2026, 9, 17));
    var j = JSON.parse(json);
    t.ok("JSON xuất: format, version, ngày ISO, puzzles theo dạng spec", j.format === "logic-puzzle-suite" && j.version === 1 && j.exported === "2026-10-17T00:00:00.000Z" && j.puzzles.length === 2 && j.puzzles[0].initialState === "102" && j.puzzles[0].difficulty === 7.4 && j.puzzles[0].seed === 42, j);
    var back = F.importText(json);
    t.ok("nhập lại JSON: đủ 2 puzzle, đúng initial", back.ok && back.puzzles.length === 2 && back.puzzles[0].initial.v.join("") === "102", back);
    t.ok("nhập một puzzle đơn (đối tượng có type)", F.importText(JSON.stringify(j.puzzles[0])).puzzles.length === 1);
    t.ok("nhập mảng trần các puzzle", F.importText(JSON.stringify(j.puzzles)).puzzles.length === 2);
    t.ok("BOM đầu tệp được bỏ qua", F.importText("﻿" + json).ok);
    t.ok("tệp lẫn mục hỏng: nhập các mục tốt, cảnh báo", (function () { var bad = JSON.parse(json); bad.puzzles.push({ type: "fk", initialState: "xyz" }); var r = F.importText(JSON.stringify(bad)); return r.ok && r.puzzles.length === 2 && r.errors.length === 1 && r.warnings.some(function (w) { return /Bỏ qua 1/.test(w); }); })());
    ["", "   ", "{", "[1,2", "{\"a\":1}", "[]", "{\"puzzles\":[]}", "{\"type\":\"không-có\"}", "null", "[null]", "12345"].forEach(function (bad) {
      var r; try { r = F.importText(bad); } catch (e) { r = { threw: e.message }; }
      t.ok("đầu vào xấu '" + String(bad).slice(0, 14) + "' → ok=false, có lỗi tiếng Việt, không ném", !r.threw && r.ok === false && r.errors.length >= 1 && typeof r.errors[0] === "string", r);
    });
    t.ok("tệp quá nhiều puzzle bị từ chối", F.importText(JSON.stringify({ puzzles: new Array(2001).fill(j.puzzles[0]) })).ok === false);
    t.ok("cảnh báo từ engine được chuyển tiếp", F.importText(JSON.stringify({ format: "logic-puzzle-suite", puzzles: [Object.assign({}, j.puzzles[0], { warn: true })] })).warnings.some(function (w) { return /cảnh báo thử/.test(w); }));
    t.ok("định dạng lạ chỉ cảnh báo, vẫn đọc", F.importText(JSON.stringify({ format: "khac", puzzles: [j.puzzles[0]] })).warnings.length >= 1);
    var txt = F.exportText(pz);
    t.ok("TXT xuất có dòng đầu #puzzle và thân toText", /^#puzzle type=fk seed=42 tier=hard score=7.4\nFK 102\n$/.test(txt), txt);
    t.ok("nhập TXT theo dòng đầu (loại chỉ định)", (function () { var r = F.importText(txt); return r.ok && r.puzzles[0].initial.v.join("") === "102"; })());
    t.ok("nhập TXT trần: thử các loại, chọn loại khớp", (function () { var r = F.importText("FK 555"); return r.ok && r.puzzles[0].type === "fk"; })());
    t.ok("TXT không loại nào nhận → lỗi rõ", (function () { var r = F.importText("lung tung"); return !r.ok && r.errors[0].length > 5; })());
    t.ok("TXT chỉ định loại không có → lỗi", !F.importText("#puzzle type=zzz\nFK 1").ok);
    var hc = F.historyCsv([{ day: "2026-10-10", type: "sudoku", seed: 1, tier: "easy", score: 3, size: 9, source: "daily", result: "solved", time: 452000, mistakes: 1, hints: 2, moves: 50, endedAt: 2 }, { day: "2026-10-09", type: "nqueens", seed: 2, tier: "hard", score: 6, size: { n: 8 }, source: "random", result: "revealed", time: 1000, mistakes: 0, hints: 0, moves: 3, endedAt: 1 }]);
    var lines = hc.replace("﻿", "").trim().split("\r\n");
    t.ok("CSV lịch sử: BOM, tiêu đề tiếng Việt, sắp theo thời gian, thời gian tính giây", hc.charCodeAt(0) === 0xFEFF && lines.length === 3 && /^ngày,loại/.test(lines[0]) && /^2026-10-09,nqueens/.test(lines[1]) && /,solved,452,1,2,50$/.test(lines[2]), lines);
    t.ok("CSV: ô có dấu phẩy/ngoặc kép được bọc đúng", F.csv([["a,b", "c\"d", "e"]]).replace("﻿", "") === '"a,b","c""d",e\r\n');
    t.ok("CSV: chặn công thức (=, +, -, @) bằng dấu nháy đầu ô", F.csv([["=SUM(A1)", "+1", "-1", "@x", "ok"]]).replace("﻿", "") === "'=SUM(A1),'+1,'-1,'@x,ok\r\n");
    t.ok("CSV puzzle: cột trạng thái đầu và lời giải", /fk,thử,42,hard,7.4,102,132/.test(F.puzzlesCsv([pz])), F.puzzlesCsv([pz]));
    t.eq("safeName bỏ dấu tiếng Việt", F.safeName("Câu đố Sudoku #1 / khó"), "Cau-do-Sudoku-1-kho");
    t.eq("safeName rỗng", F.safeName(""), "puzzle");
  } finally { Puz.types.get = realGet; Puz.types.all = realAll; }

  t.group("Puz.gen — đường chạy tại chỗ (node không có Worker)");
  var G = Puz.gen, gfake = { generate: function (seed, o) { return { seed: seed, o: o }; }, boom: function () { throw new Error("nổ rồi"); } };
  Puz.types.get = function (id) { return id === "gk" ? gfake : realGet(id); };
  var restore = function () { Puz.types.get = realGet; };
  return Promise.all([
    G.generate("gk", 7, { tier: "easy" }).then(function (r) { t.eq("generate gọi đúng engine với đúng đối số", r, { seed: 7, o: { tier: "easy" } }); }),
    G.call("gk", "boom", []).then(function () { t.ok("lỗi trong engine phải thành Promise bị từ chối", false); }, function (e) { t.ok("lỗi trong engine → Promise bị từ chối với thông điệp gốc", /nổ rồi/.test(e.message)); }),
    G.call("khong-co", "generate", [1]).then(function () { t.ok("loại không có phải bị từ chối", false); }, function (e) { t.ok("loại không có → từ chối, có tên loại trong thông điệp", /khong-co/.test(e.message)); }),
    G.call("gk", "khongHam", []).then(function () { t.ok("hàm không có phải bị từ chối", false); }, function (e) { t.ok("hàm không có → từ chối", /khongHam/.test(e.message)); }),
    new Promise(function (ok) { var order = []; G.generate("gk", 1, {}, { inline: true }).then(function () { order.push("xong"); ok(order); }); order.push("đồng bộ"); })
      .then(function (o) { t.eq("không chạy đồng bộ (nhường một nhịp để màn hình kịp vẽ 'đang sinh…')", o, ["đồng bộ", "xong"]); })
  ]).then(restore, function (e) { restore(); throw e; });
};
