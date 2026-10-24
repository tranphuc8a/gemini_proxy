/* kiem/core-hop-dong.js — HỢP ĐỒNG MỞ RỘNG (HUONG-DAN-ENGINE.md mục 11): kind/objective/nhãn/options trong conformance, Puz.types.optionsOf…,
   Puz.grade, Puz.plan, game.js (hint nhận settings, game.grade, record.grade) và vòng chơi đầy đủ của hai loại giả trong kiem/mau/loai-gia.js
   (giatoiuu = optimize, giadoan = interactive). Hai loại giả KHÔNG đăng ký vào sổ: Puz.types.get bị ghi đè tạm trong tệp này rồi trả lại.
   Nguồn sự thật độc lập: QHĐ ba lô viết lại bằng vét cạn 2^n trong test; lý thuyết thông tin cho đoán số (3 câu hỏi có/không không phân biệt nổi 16 số). */
"use strict";
var path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types, G = Puz.game, GR = Puz.grade, PL = Puz.plan;
  var gia = require(path.join(__dirname, "mau", "loai-gia.js"))(Puz), K = gia.giatoiuu, D = gia.giadoan;
  var extra = {}, realGet = T.get;
  T.get = function (id) { return Object.prototype.hasOwnProperty.call(extra, id) ? extra[id] : realGet(id); };
  extra.giatoiuu = K; extra.giadoan = D;
  function J(x) { return JSON.stringify(x); }
  function variant(base, patch) { var o = Object.assign({}, base); Object.keys(patch).forEach(function (k) { if (patch[k] === undefined) delete o[k]; else o[k] = patch[k]; }); return o; }
  var clockT = 1000, now = function () { return clockT; };
  function solveByHints(g, limit) { var n = 0; while (!g.finished() && n < limit) { var h = g.hint(3); if (!h || h.none || !h.action) return -1; if (!g.applyHint(h).ok) return -2; n++; } return g.status === "solved" ? n : -3; }

  try {
    // ------------------------------------------------------------------------------------------- conformance
    t.group("Hợp đồng mở rộng — conformance (kind, objective, grade, options, nhãn)");
    t.eq("loại giả optimize (giatoiuu) đạt conformance", T.conformance(K), []);
    t.eq("loại giả interactive (giadoan) đạt conformance", T.conformance(D), []);
    t.eq("KINDS = static | interactive | optimize", T.KINDS, ["static", "interactive", "optimize"]);
    t.eq("kindOf: vắng → static", [T.kindOf({}), T.kindOf(K), T.kindOf(D), T.kindOf(null)], ["static", "optimize", "interactive", "static"]);
    var two = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
    var BAD = [
      ["kind lạ", { kind: "puzzle" }, /kind/],
      ["optimize thiếu objective", { objective: undefined }, /objective/],
      ["objective.sense lạ", { objective: { sense: "most", label: "x", unit: "" } }, /objective/],
      ["objective thiếu label", { objective: { sense: "max", unit: "km" } }, /objective/],
      ["objective.unit không phải chuỗi", { objective: { sense: "max", label: "x", unit: 3 } }, /objective/],
      ["optimize thiếu grade", { grade: undefined }, /grade/],
      ["grade không phải hàm", { grade: 3 }, /grade/],
      ["dùng 'goal' cũ thay cho kind", { goal: "optimize" }, /goal/],
      ["sizeLabel rỗng", { sizeLabel: "  " }, /sizeLabel/],
      ["moveLabel không phải chuỗi", { moveLabel: 5 }, /moveLabel/],
      ["mistakeLabel rỗng", { mistakeLabel: "" }, /mistakeLabel/],
      ["sizeText không phải hàm", { sizeText: "12 xu" }, /sizeText/],
      ["options không phải mảng", { options: {} }, /options/],
      ["options rỗng", { options: [] }, /options/],
      ["option thiếu default", { options: [{ id: "so", label: "Số", choices: two }] }, /default/],
      ["default không thuộc choices", { options: [{ id: "so", label: "Số", choices: two, default: "c" }] }, /default/],
      ["trùng id option", { options: [{ id: "so", label: "Số", choices: two, default: "a" }, { id: "so", label: "Số 2", choices: two, default: "a" }] }, /trùng/],
      ["id option có ':' (phá liên kết o=)", { options: [{ id: "a:b", label: "X", choices: two, default: "a" }] }, /id/],
      ["id option bắt đầu bằng '_' (chặn __proto__)", { options: [{ id: "__proto__", label: "X", choices: two, default: "a" }] }, /id/],
      ["id lựa chọn có ','", { options: [{ id: "so", label: "Số", choices: [{ id: "x,y", label: "X" }, { id: "b", label: "B" }], default: "b" }] }, /id/],
      ["trùng id lựa chọn", { options: [{ id: "so", label: "Số", choices: [{ id: "a", label: "A" }, { id: "a", label: "A2" }], default: "a" }] }, /trùng/],
      ["chỉ một lựa chọn", { options: [{ id: "so", label: "Số", choices: [{ id: "a", label: "A" }], default: "a" }] }, /choices/],
      ["nhãn lựa chọn rỗng", { options: [{ id: "so", label: "Số", choices: [{ id: "a", label: "" }, { id: "b", label: "B" }], default: "a" }] }, /label/],
      ["nhãn option rỗng", { options: [{ id: "so", label: "", choices: two, default: "a" }] }, /label/],
      ["note lựa chọn không phải chuỗi", { options: [{ id: "so", label: "Số", choices: [{ id: "a", label: "A", note: 1 }, { id: "b", label: "B" }], default: "a" }] }, /note/]
    ];
    BAD.forEach(function (b) { var e = T.conformance(variant(K, b[1])); t.ok("báo lỗi: " + b[0], e.length > 0 && e.some(function (x) { return b[2].test(x); }), e); });
    t.eq("interactive không bắt buộc objective/grade", T.conformance(variant(D, { objective: undefined, grade: undefined })), []);
    t.eq("static (vắng kind hoặc 'static') không cần gì thêm", [T.conformance(variant(D, { kind: undefined, objective: undefined, grade: undefined, options: undefined, moveLabel: undefined })).length, T.conformance(variant(D, { kind: "static" })).length], [0, 0]);
    t.ok("register từ chối loại vi phạm hợp đồng mới (ném lỗi có tên lỗi)", (function () { try { T.register(variant(K, { id: "khongdangky", objective: undefined })); return false; } catch (e) { return /objective/.test(e.message) && !T.get("khongdangky"); } })());

    // ------------------------------------------------------------------------------------------- options
    t.group("options — chuẩn hoá, dạng gọn, liên kết seed o=");
    t.eq("optionsOf: vắng → mặc định", T.optionsOf(K, null), { so: "5" });
    t.eq("optionsOf từ đối tượng", T.optionsOf(K, { so: "7" }), { so: "7" });
    t.eq("optionsOf: lựa chọn lạ → mặc định, khoá lạ bị bỏ", T.optionsOf(K, { so: "9", la: "x" }), { so: "5" });
    t.eq("optionsOf từ chuỗi liên kết", T.optionsOf(K, "so:7"), { so: "7" });
    t.eq("optionsOf với loại không có options → {}", T.optionsOf({ id: "x" }, { so: "7" }), {});
    t.eq("compactOptions chỉ giữ lựa chọn khác mặc định", [T.compactOptions(K, { so: "5" }), T.compactOptions(K, { so: "7" }), T.compactOptions({ id: "x" }, { a: "b" })], [{}, { so: "7" }, {}]);
    t.eq("encodeOptions: theo thứ tự khai báo, bỏ mặc định", [T.encodeOptions(K, { so: "7" }), T.encodeOptions(K, { so: "5" }), T.encodeOptions(K, null), T.encodeOptions({ id: "x" }, { a: "b" })], ["so:7", "", "", ""]);
    var two2 = variant(K, { options: [{ id: "mode", label: "M", choices: [{ id: "fixed", label: "F" }, { id: "adv", label: "A" }], default: "fixed" }, { id: "rule", label: "R", choices: [{ id: "cross", label: "C" }, { id: "x", label: "X" }], default: "cross" }] });
    t.eq("encode nhiều option: 'mode:adv,rule:x' (thứ tự khai báo, không theo thứ tự khoá)", T.encodeOptions(two2, { rule: "x", mode: "adv" }), "mode:adv,rule:x");
    t.eq("decode(encode) vòng tròn", T.optionsOf(two2, T.encodeOptions(two2, { rule: "x", mode: "adv" })), { mode: "adv", rule: "x" });
    t.eq("decodeOptions bỏ rác (rỗng, __proto__, a:b:c), lần xuất hiện đầu thắng, bỏ khoảng trắng; không ném", T.decodeOptions("so:7,,__proto__:x,che:doithu,so:5,:,a:b:c, x : y "), { so: "7", che: "doithu", x: "y" });
    t.ok("decodeOptions không đổi nguyên mẫu Object", T.decodeOptions("__proto__:polluted,constructor:x").polluted === undefined && ({}).polluted === undefined);
    t.eq("decodeOptions(null/số/đối tượng) → {}", [T.decodeOptions(null), T.decodeOptions(5), T.decodeOptions({})], [{}, {}, {}]);
    var kd = K.generate(20261017, { sizeId: "nho", tier: "easy" }), k7 = K.generate(20261017, { sizeId: "nho", tier: "easy", options: { so: "7" } });
    t.ok("sinh với lựa chọn mặc định: puzzle.options = {}, data không có trường lựa chọn", J(kd.options) === "{}" && kd.data.so === undefined && kd.data.w.length === 5);
    t.ok("sinh với lựa chọn khác mặc định: data ghi lựa chọn, puzzle.options gọn, id khác", k7.data.so === "7" && J(k7.options) === J({ so: "7" }) && k7.data.w.length === 7 && k7.id !== kd.id);
    t.eq("truyền lựa chọn = mặc định tường minh ⇒ cùng puzzle với không truyền", K.generate(20261017, { sizeId: "nho", tier: "easy", options: { so: "5" } }).id, kd.id);
    t.eq("cùng (seed, cỡ, bậc, options) → cùng puzzle từng bit", J(K.generate(20261017, { sizeId: "nho", tier: "easy", options: { so: "7" } })), J(k7));

    // ------------------------------------------------------------------------------------------- Puz.grade
    t.group("Puz.grade — fromRatio, ngưỡng sao, định dạng, normalize");
    var g1 = GR.fromRatio(1533, 1533, "max"), g2 = GR.fromRatio(1480, 1533, "max");
    t.eq("max: đạt tối ưu → quality 1, 3★, 'Tối ưu!'", [g1.quality, g1.stars, g1.text], [1, 3, "Tối ưu!"]);
    t.eq("max: 1480/1533 → 0,965 · 2★ · 'Đạt 96 % mức tối ưu'", [g2.quality, g2.stars, g2.text], [0.965, 2, "Đạt 96 % mức tối ưu"]);
    t.eq("min: 0,1+0,2 so với tối ưu 0,3 (lệch số thực) → quality 1, 3★", [GR.fromRatio(0.1 + 0.2, 0.3, "min").quality, GR.fromRatio(0.1 + 0.2, 0.3, "min").stars], [1, 3]);
    t.eq("min: 36 phút so với tối ưu 31,2 → 0,867 · 1★ (đưa-đón vs tiếp sức n=4 k=1 m=5)", [GR.fromRatio(36, 31.2, "min").quality, GR.fromRatio(36, 31.2, "min").stars], [0.867, 1]);
    t.eq("biên: best 0 & value 0 → 1; vượt tối ưu kẹp 1; value null → 0; min value ≤ best → 1", [GR.quality(0, 0, "max"), GR.quality(10, 9, "max"), GR.quality(null, 9, "max"), GR.quality(0, 5, "min"), GR.quality(5, 0, "max")], [1, 1, 0, 1, 1]);
    t.eq("value null → 0★, chữ 'Chưa có giá trị để chấm', valueText '—'", (function () { var g = GR.fromRatio(null, 9, "max"); return [g.stars, g.text, g.valueText]; })(), [0, "Chưa có giá trị để chấm", "—"]);
    t.eq("ngưỡng sao: 1 · 0,9995 (làm tròn = 1) · 0,9994 · 0,9 · 0,899 · 0,001 · 0", [1, 0.9995, 0.9994, 0.9, 0.899, 0.001, 0].map(GR.starsFor), [3, 3, 2, 2, 1, 1, 0]);
    t.eq("starsText kẹp 0..3", [0, 1, 2, 3, 7, -1, NaN].map(GR.starsText), ["☆☆☆", "★☆☆", "★★☆", "★★★", "★★★", "☆☆☆", "☆☆☆"]);
    t.eq("fmt kiểu Việt (nhóm nghìn bằng NBSP, phẩy thập phân, bỏ 0 thừa)", [GR.fmt(1533), GR.fmt(1533.3333), GR.fmt(0.5), GR.fmt(-1234567.5), GR.fmt(null), GR.fmt(2.4, 0), GR.fmt(-0.001)], ["1 533", "1 533,33", "0,5", "-1 234 567,5", "—", "2", "0"]);
    t.eq("display: 'giá trị / tối ưu đơn vị'", [GR.display(g2, "km"), GR.display(g2, ""), GR.display({ valueText: "7", best: null }, "câu")], ["1 480 / 1 533 km", "1 480 / 1 533", "7 câu"]);
    t.eq("normalize kẹp và điền chữ còn thiếu", GR.normalize({ quality: 1.7, stars: 9, value: NaN }), { value: null, best: null, quality: 1, stars: 3, valueText: "—", bestText: "—", text: "Chưa có giá trị để chấm" });
    t.eq("normalize: thiếu stars → suy từ quality", GR.normalize({ value: 9, best: 10, quality: 0.9 }).stars, 2);
    t.ok("normalize(rác) → null", GR.normalize(null) === null && GR.normalize("x") === null && GR.normalize(3) === null);
    t.eq("errors: kết quả fromRatio đủ trường", GR.errors(GR.fromRatio(3, 4, "max")), []);
    t.ok("errors bắt thiếu trường / sai kiểu / chữ rác", GR.errors({ quality: 2, stars: 1.5 }).length >= 5 && GR.errors({ value: 1, best: 2, quality: 0.5, stars: 1, valueText: "1", bestText: "undefined", text: "x" }).length === 1 && GR.errors(null).length === 1);

    // ------------------------------------------------------------------------------------------- Puz.plan
    t.group("Puz.plan — kế hoạch độ dài cố định: thêm, quay về, nộp kèm tham số, hoàn tác");
    var L = PL.layout(3, 2, 1), s = { v: PL.empty(L), c: null }, hist = [];
    t.eq("layout(cap 3, W 2, extra 1): head 3, size 9", [L.head, L.size, PL.empty(L).length], [3, 9, 9]);
    t.ok("layout sai → ném lỗi rõ ràng", (function () { try { PL.layout(0, 1); return false; } catch (e) { return /cap/.test(e.message); } })());
    function step(d) { hist.push(J(s)); G.applyDiff(s, d.d, false); return d; }
    step(PL.appendDiff(s, L, [5, 1]));
    t.eq("thêm một bản ghi", [PL.count(s), PL.read(s, L)], [1, [[5, 1]]]);
    step(PL.appendDiff(s, L, [[2, 0], [7, 3]]));
    t.eq("thêm nhiều bản ghi trong một diff", [PL.count(s), PL.read(s, L), PL.valid(s, L)], [3, [[5, 1], [2, 0], [7, 3]], true]);
    t.ok("vượt dung lượng → null (moveFor trả null, không ném)", PL.appendDiff(s, L, [1, 1]) === null);
    var s0 = { v: PL.empty(L), c: null };
    t.ok("sai hình dạng → null: thiếu số, số lẻ, rỗng, chuỗi", PL.appendDiff(s0, L, [1]) === null && PL.appendDiff(s0, L, [1.5, 2]) === null && PL.appendDiff(s0, L, []) === null && PL.appendDiff(s0, L, "x") === null && PL.appendDiff(s0, L, [[1, 2], [3]]) === null);
    var tr = step(PL.truncateDiff(s, L, 1));
    t.ok("quay về sau bước 1: len 1, ô sau về 0 (dạng chuẩn)", PL.count(s) === 1 && J(s.v) === J([0, 1, 0, 5, 1, 0, 0, 0, 0]) && PL.valid(s, L) && /bước 1/.test(tr.label));
    t.ok("truncate không đổi gì / ngoài khoảng → null", PL.truncateDiff(s, L, 1) === null && PL.truncateDiff(s, L, -1) === null && PL.truncateDiff(s, L, 2) === null && PL.truncateDiff(s, L, 0.5) === null);
    step(PL.submitDiff(s, L, [4]));
    t.ok("nộp kèm tham số: cờ v[0] = 1, tham số v[2] = 4", PL.isSubmitted(s) && J(PL.params(s, L)) === "[4]" && PL.valid(s, L));
    t.ok("đã nộp: không thêm, không nộp lại", PL.appendDiff(s, L, [1, 1]) === null && PL.submitDiff(s, L, []) === null);
    step(PL.truncateDiff(s, L, 1));
    t.ok("truncate(len) khi đã nộp = MỞ LẠI: xoá cờ và tham số, giữ bản ghi", !PL.isSubmitted(s) && J(PL.params(s, L)) === "[0]" && PL.count(s) === 1 && PL.valid(s, L));
    t.ok("tham số quá số ô / không nguyên → null", PL.submitDiff(s, L, [1, 2]) === null && PL.submitDiff(s, L, [1.5]) === null && PL.submitDiff(s, L, "x") === null);
    step(PL.truncateDiff(s, L, 0));
    t.ok("xoá cả kế hoạch → về trạng thái rỗng", J(s.v) === J(PL.empty(L)));
    var back = hist.slice().reverse(), okRev = true, cur = { v: s.v.slice(), c: null };
    // phát lại từ đầu rồi hoàn tác từng bước bằng reverseDiff
    (function () {
      var st = { v: PL.empty(L), c: null }, ds = [PL.appendDiff(st, L, [5, 1])]; G.applyDiff(st, ds[0].d, false);
      var d2 = PL.appendDiff(st, L, [[2, 0], [7, 3]]); ds.push(d2); G.applyDiff(st, d2.d, false);
      var d3 = PL.submitDiff(st, L, [9]); ds.push(d3); G.applyDiff(st, d3.d, false);
      var d4 = PL.truncateDiff(st, L, 1); ds.push(d4); G.applyDiff(st, d4.d, false);
      var snaps = [J(PL.empty(L))];
      var st2 = { v: PL.empty(L), c: null }; ds.forEach(function (d) { G.applyDiff(st2, d.d, false); snaps.push(J(st2.v)); });
      for (var i = ds.length - 1; i >= 0; i--) { G.applyDiff(st2, G.reverseDiff(ds[i].d), false); if (J(st2.v) !== snaps[i]) okRev = false; }
    })();
    t.ok("mọi diff (thêm, nộp, mở lại/quay về) hoàn lại đúng bằng reverseDiff", okRev && back.length === hist.length && cur.v.length === 9);
    var bv = PL.build(L, [[1, 2]], 1, [9]);
    t.ok("build(bản ghi, nộp, tham số) cho solution.v hợp lệ", J(bv) === J([1, 1, 9, 1, 2, 0, 0, 0, 0]) && PL.valid({ v: bv }, L) && PL.build(L, [[1, 2], [3, 4], [5, 6], [7, 8]]) === null);
    t.ok("valid bắt rác: sai độ dài, số lẻ, ô thừa ≠ 0, cờ 2, tham số khi chưa nộp, len vượt cap", !PL.valid({ v: [0] }, L) && !PL.valid({ v: [0, 0, 0, 0.5, 0, 0, 0, 0, 0] }, L) && !PL.valid({ v: [0, 0, 0, 1, 0, 0, 0, 0, 0] }, L) && !PL.valid({ v: [2, 0, 0, 0, 0, 0, 0, 0, 0] }, L) && !PL.valid({ v: [0, 0, 5, 0, 0, 0, 0, 0, 0] }, L) && !PL.valid({ v: [0, 4, 0, 1, 1, 1, 1, 1, 1] }, L) && !PL.valid(null, L));

    // ------------------------------------------------------------------------------------------- game.js
    t.group("game.js — hint nhận settings, game.grade, record.grade");
    var seen = null, origHint = K.hint;
    K.hint = function (p, st, l, set) { seen = set; return origHint(p, st, l, set); };
    var pz = K.generate(20261017, { sizeId: "nho", tier: "easy" }), g = G.create(pz, { now: now, settings: { autoRemove: false, showConflicts: true } });
    var h1 = g.hint(1);
    K.hint = origHint;
    t.ok("game.hint truyền settings của ván làm tham số thứ 4 của type.hint", seen && seen.showConflicts === true && seen.autoRemove === false && h1.technique === "Ba lô (có cài đặt)", seen);
    t.eq("game.grade() khi chưa chọn gì: 0 điểm, 0★", [g.grade().value, g.grade().stars], [0, 0]);
    t.ok("game.grade() trả bản đã chuẩn hoá (đủ trường)", GR.errors(g.grade()).length === 0, GR.errors(g.grade()));
    var OLD_KEYS = ["id", "type", "puzzleId", "seed", "tier", "score", "size", "sizeId", "source", "day", "startedAt", "endedAt", "time", "mistakes", "hints", "maxHint", "moves", "result"];
    extra.giatoiuu = variant(K, { grade: undefined, kind: undefined, objective: undefined });
    var gOld = G.create(pz, { now: now }); gOld.act({ k: "pick", i: 0 });
    t.eq("loại KHÔNG có grade: bản ghi lịch sử giữ đúng các trường cũ (không thêm grade)", Object.keys(gOld.record("solved")), OLD_KEYS);
    t.ok("loại không có grade: game.grade() = null", gOld.grade() === null);
    extra.giatoiuu = variant(K, { grade: function () { throw new Error("hỏng"); } });
    var gBad = G.create(pz, { now: now }); gBad.act({ k: "pick", i: 0 });
    t.ok("grade ném lỗi: game.grade() = null, record không có grade, không ném", gBad.grade() === null && !("grade" in gBad.record("solved")));
    extra.giatoiuu = variant(K, { grade: function () { return { quality: 5, stars: 7, value: 3, best: 4 }; } });
    var gJunk = G.create(pz, { now: now });
    t.eq("grade trả số ngoài khoảng: được kẹp (quality 1, stars 3) và điền chữ", (function () { var x = gJunk.grade(); return [x.quality, x.stars, x.valueText, x.bestText]; })(), [1, 3, "3", "4"]);
    extra.giatoiuu = K;

    // ------------------------------------------------------------------------------------------- vòng chơi optimize
    t.group("Loại giả optimize (giatoiuu) — tối ưu đối chiếu vét cạn, vòng gợi ý, nước làm mất tối ưu, nộp chưa tối ưu, Reveal, replay");
    function brute(d) { var n = d.w.length, best = 0; for (var m = 0; m < (1 << n); m++) { var w = 0, v = 0; for (var i = 0; i < n; i++) if (m >> i & 1) { w += d.w[i]; v += d.val[i]; } if (w <= d.cap && v > best) best = v; } return best; }
    var badBrute = [], loops = [], badLoops = [], withBad = 0, sub = [], revs = [], reps = [], gradeShape = [];
    [{ sizeId: "nho" }, { sizeId: "vua" }, { sizeId: "nho", options: { so: "7" } }, { sizeId: "vua", options: { so: "7" } }].forEach(function (o) {
      for (var seed = 1; seed <= 25; seed++) {
        var p = K.generate(seed, { sizeId: o.sizeId, tier: "easy", options: o.options });
        if (brute(p.data) !== p.data.best) badBrute.push(seed + "/" + J(o));
        // (a) từ trạng thái đầu
        var ga = G.create(p, { now: now }), na = solveByHints(ga, 50), total = K.check(p, p.solution).total;
        var gr = ga.grade();
        if (!(na > 0 && na <= total * 3 + 1 && gr.quality === 1 && gr.stars === 3 && ga.record("solved").grade && ga.record("solved").grade.stars === 3)) loops.push([seed, J(o), na, gr && gr.quality]);
        if (GR.errors(K.grade(p, ga.state, ga.counters)).length) gradeShape.push(seed);
        // (b) chèn một nước làm mất tối ưu
        var badItem = -1;
        for (var i = 0; i < p.data.w.length; i++) if (p.data.w[i] <= p.data.cap && gia._bestFrom(p.data, [i]) < p.data.best) { badItem = i; break; }
        if (badItem >= 0) {
          withBad++;
          var gb = G.create(p, { now: now }), rb = gb.act({ k: "pick", i: badItem }), first = gb.hint(1), nb = solveByHints(gb, 50);
          if (!(rb.mistakes === 1 && /mất tối ưu/.test(first.text) && nb > 0 && gb.grade().quality === 1 && gb.counters.mistakes === 1)) badLoops.push([seed, J(o), rb.mistakes, nb]);
          // (c) nộp lựa chọn chưa tối ưu: vẫn "solved" nhưng điểm < 3★, lịch sử ghi grade đúng
          var gs = G.create(p, { now: now }); gs.act({ k: "pick", i: badItem }); var rs = gs.act({ k: "submit" }), rec = gs.record();
          var exp = Math.round(p.data.val[badItem] / p.data.best * 1000) / 1000;
          if (!(rs.check.solved && gs.status === "solved" && rec.result === "solved" && rec.grade && rec.grade.quality === exp && rec.grade.stars < 3 && rec.grade.value === p.data.val[badItem])) sub.push([seed, J(o), rec.grade]);
        }
        // (d) Reveal + replay
        var gr2 = G.create(p, { now: now }); gr2.act({ k: "pick", i: K.hint(p, gr2.state, 3).action.i }); gr2.reveal();
        if (!(gr2.status === "revealed" && K.check(p, gr2.state).solved && !("grade" in gr2.record()))) revs.push(seed);
        var st = K.newState(p); K.replay(p).forEach(function (x) { G.applyDiff(st, x.diff.d, false); });
        if (!(K.check(p, st).solved && K.grade(p, st).quality === 1 && J(st.v) === J(p.solution.v))) reps.push(seed);
      }
    });
    t.ok("giá trị tối ưu (QHĐ của engine) = vét cạn 2^n độc lập trên 100 đề (4 cấu hình × 25 seed)", badBrute.length === 0, badBrute);
    t.ok("vòng 'gợi ý mức 3 → áp dụng' từ đầu: nộp với quality 1, 3★, ≤ total·3+1 bước, lịch sử có grade 3★ (100 đề)", loops.length === 0, loops.slice(0, 4));
    t.ok("grade của engine trả ĐỦ trường (Puz.grade.errors rỗng)", gradeShape.length === 0, gradeShape);
    t.ok("chèn nước làm mất tối ưu (" + withBad + " đề có món 'bẫy'): mistakes = 1, gợi ý nói trước, vòng gợi ý quay về (truncate) rồi vẫn đạt quality 1", withBad >= 20 && badLoops.length === 0, badLoops.slice(0, 4));
    t.ok("nộp lựa chọn chưa tối ưu: ván 'solved', record.grade.quality = giá trị/tối ưu (3 chữ số), < 3★", withBad >= 20 && sub.length === 0, sub.slice(0, 3));
    t.ok("Reveal: điền solution (có cờ đã nộp) ⇒ check solved; ván revealed không ghi grade", revs.length === 0, revs);
    t.ok("replay kết thúc ở solution.v, solved, quality 1", reps.length === 0, reps);
    (function () {            // mọi diff (chọn / quay về / nộp) hoàn lại bằng reverseDiff; trạng thái luôn chuẩn
      var bad = 0, r = Puz.rng.create(99);
      for (var seed = 1; seed <= 10; seed++) {
        var p = K.generate(seed, { sizeId: "vua", tier: "easy", options: { so: "7" } }), st = K.newState(p), L2 = PL.layout(7, 1, 0);
        for (var k = 0; k < 60; k++) {
          var roll = r.int(10), a = roll < 6 ? { k: "pick", i: r.int(7) } : roll < 9 ? { k: "truncate", n: r.int(PL.count(st) + 1) } : { k: "submit" };
          var d = K.moveFor(p, st, a); if (!d) continue;
          var before = J(st.v); G.applyDiff(st, d.d, false);
          if (!PL.valid(st, L2)) bad++;
          var tmp = { v: st.v.slice(), c: null }; G.applyDiff(tmp, G.reverseDiff(d.d), false); if (J(tmp.v) !== before) bad++;
          if (PL.isSubmitted(st)) { var re = K.moveFor(p, st, { k: "truncate", n: PL.count(st) }); G.applyDiff(st, re.d, false); }
        }
      }
      t.ok("600 thao tác ngẫu nhiên: mọi diff hoàn lại đúng, trạng thái luôn ở dạng chuẩn (Puz.plan.valid)", bad === 0, bad);
    })();
    t.ok("moveFor không hợp lệ → null (món đã chọn, quá sức chứa, chỉ số lạ, nộp khi rỗng, hành động lạ)", (function () {
      var p = K.generate(3, { sizeId: "nho", tier: "easy" }), st = K.newState(p), d = K.moveFor(p, st, { k: "pick", i: 0 }); G.applyDiff(st, d.d, false);
      var heavy = { cap: 1, w: [1, 1], val: [1, 1] }, ph = K.fromInput(heavy).puzzle, sh = K.newState(ph); G.applyDiff(sh, K.moveFor(ph, sh, { k: "pick", i: 0 }).d, false);
      return K.moveFor(p, st, { k: "pick", i: 0 }) === null && K.moveFor(ph, sh, { k: "pick", i: 1 }) === null && K.moveFor(p, st, { k: "pick", i: 99 }) === null && K.moveFor(p, K.newState(p), { k: "submit" }) === null && K.moveFor(p, st, { k: "bay" }) === null && K.moveFor(p, st, null) === null;
    })());
    t.ok("fromInput: statusText/statusKind cho màn Tạo puzzle; đầu vào xấu → ok:false, không ném", (function () {
      var r = K.fromInput({ cap: 10, w: [5, 4, 6], val: [5, 20, 15] });
      return r.ok && r.statusKind === "ok" && /35 điểm/.test(r.statusText) && r.puzzle.tier === "custom" && !K.fromInput(null).ok && !K.fromInput({ cap: "x" }).ok && !K.fromInput({ cap: 5, w: [1], val: [] }).ok;
    })());
    t.ok("toText/fromText, toFile/fromFile vòng tròn giữ data", (function () { var p = K.generate(5, { sizeId: "vua", tier: "easy" }), a = K.fromText(K.toText(p)), b = K.fromFile(K.toFile(p)); return a.ok && b.ok && J(a.puzzle.data) === J(p.data) && J(b.puzzle.initial) === J(p.initial); })());

    // ------------------------------------------------------------------------------------------- vòng chơi interactive
    t.group("Loại giả interactive (giadoan) — oracle tất định, đối thủ thích nghi, kết luận = nộp kèm tham số, sao tự đặt");
    var pf = D.generate(77, {}), pa = D.generate(77, { options: { che: "doithu" } });
    t.ok("chế độ mặc định: puzzle.options = {}, số bí mật cố định theo seed", J(pf.options) === "{}" && pf.data.secret >= 1 && pf.data.secret <= 16 && D.generate(77, {}).data.secret === pf.data.secret);
    t.ok("đối thủ: data ghi lựa chọn khác mặc định, không có số bí mật, id khác; tất định", pa.data.che === "doithu" && pa.data.secret === null && pa.id !== pf.id && J(D.generate(77, { options: { che: "doithu" } })) === J(pa) && J(pa.options) === J({ che: "doithu" }));
    var gi = G.create(pa, { now: now }); gi.act({ k: "ask", x: 9 }); var after1 = J(gi.state.v); gi.undo(); gi.redo();
    var restored = G.restore(JSON.parse(JSON.stringify(gi.serialize())), { now: now });
    t.ok("oracle ghi kết quả vào diff: làm lại và khôi phục cho đúng câu trả lời cũ", J(gi.state.v) === after1 && J(restored.state.v) === after1);
    (function () {            // nguồn độc lập: 3 câu có/không chỉ có 8 tổ hợp câu trả lời < 16 số ⇒ đối thủ giữ được ≥ 2 khả năng với MỌI dãy 3 câu hỏi
      var bad = 0, tried = 0;
      for (var a = 2; a <= 16; a++) for (var b = 2; b <= 16; b++) for (var c = 2; c <= 16; c++) {
        var st = D.newState(pa); [a, b, c].forEach(function (x) { G.applyDiff(st, D.moveFor(pa, st, { k: "ask", x: x }).d, false); });
        var iv = gia._interval(st); tried++; if (!(iv.hi - iv.lo >= 1)) bad++;
      }
      t.ok("đối thủ thích nghi: mọi dãy 3 câu hỏi (" + tried + " dãy) vẫn còn ≥ 2 khả năng — không đoán chắc trong 3 câu", bad === 0 && tried === 3375, bad);
    })();
    (function () {
      var bad = [];
      for (var sec = 1; sec <= 16; sec++) {
        var p = D.fromInput({ secret: sec }).puzzle, g0 = G.create(p, { now: now }), n0 = 0, h;
        while (!g0.finished() && n0 < 10) { h = D.hint(p, g0.state, 3); g0.act(h.action); n0++; }          // đi đúng nước tối ưu nhưng KHÔNG qua game.hint (không tính gợi ý)
        var gr0 = g0.grade();
        if (!(g0.status === "solved" && PL.count(g0.state) === 4 && gr0.stars === 3 && gr0.quality === 1 && g0.counters.mistakes === 0)) bad.push([sec, g0.status, PL.count(g0.state), gr0.stars]);
        var gh = G.create(p, { now: now }), nh = solveByHints(gh, 10);
        if (!(nh === 5 && gh.grade().stars === 2 && gh.grade().quality === 1)) bad.push(["hint", sec, nh, gh.grade().stars]);
      }
      t.ok("16 số bí mật: chia đôi giải đúng 4 câu ⇒ 3★; giải bằng gợi ý mức 3 ⇒ vẫn quality 1 nhưng 2★ (phạt gợi ý mức 3)", bad.length === 0, bad.slice(0, 4));
    })();
    var gl = G.create(pf, { now: now }), rl = gl.act({ k: "guess", x: pf.data.secret });
    t.ok("đoán may (đúng số nhưng chưa được chứng minh) → KHÔNG giải, tính 1 lỗi, gợi ý đòi mở lại", rl.ok && !rl.check.solved && gl.status === "playing" && rl.mistakes === 1 && gl.hint(3).action.k === "truncate");
    gl.applyHint(gl.lastHint);
    t.ok("áp dụng gợi ý mở lại: xoá cờ kết luận, ván chơi tiếp", !PL.isSubmitted(gl.state) && gl.status === "playing");
    var gu = G.create(pf, { now: now }); gu.act({ k: "ask", x: 9 }); gu.undo(); gu.redo();
    while (!gu.finished()) gu.act(D.hint(pf, gu.state, 3).action);
    t.eq("giải tối ưu nhưng có hoàn tác → 2★ (phạt hoàn tác, như cân xu chế độ cố định)", [gu.status, gu.grade().stars, gu.record().grade.stars], ["solved", 2, 2]);
    var gw = G.create(D.fromInput({ secret: 16 }).puzzle, { now: now }), wm = 0;
    [2, 3, 4, 5].forEach(function (x) { wm += gw.act({ k: "ask", x: x }).mistakes; });
    while (!gw.finished()) gw.act(D.hint(gw.puzzle, gw.state, 3).action);
    t.ok("hỏi tuần tự (không chia đôi): nhiều câu hơn tối ưu ⇒ 1★, quality < 1, có tính lỗi", gw.grade().stars === 1 && gw.grade().quality < 1 && wm >= 3 && /tối ưu 4/.test(gw.grade().text), [gw.grade(), wm]);
    t.ok("replay và solution.v của cả hai chế độ đều solved", [pf, pa].every(function (p) { var st = D.newState(p); D.replay(p).forEach(function (x) { G.applyDiff(st, x.diff.d, false); }); return D.check(p, st).solved && D.check(p, p.solution).solved && J(st.v) === J(p.solution.v); }));
  } finally { T.get = realGet; }
};
