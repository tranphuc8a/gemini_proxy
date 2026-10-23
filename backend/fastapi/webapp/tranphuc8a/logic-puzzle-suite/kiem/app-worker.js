/* kiem/app-worker.js — mô phỏng NGỮ CẢNH WORKER: chỉ nạp đúng các tệp có `data-pz` trong index.html (theo thứ tự) vào một vm trống (không window/document/module),
   rồi gọi mọi hàm mà giao diện đẩy sang worker (generate, fromInput, replay, constraintView, trace…) cho từng loại puzzle.
   Bắt lỗi kiểu "engine gọi Puz.game.applyDiff nhưng game.js không được nạp vào worker" — node với đầy đủ lõi thì không thấy lỗi này, trình duyệt thì có.
   Từ đợt P1 (HUONG-DAN-ENGINE.md mục 11): loại có `options` được sinh với TỪNG lựa chọn khác mặc định (puzzle.options gọn, id khác, replay giải xong);
   loại có `grade` được chấm trên trạng thái cuối của replay. Hai loại giả kiem/mau/loai-gia.js (optimize + interactive, có options) được nạp
   THÊM vào chính vm này (sau các tệp data-pz, đăng ký vào sổ của vm — không đụng sổ thật) để vòng options/grade luôn có loại chạy qua. */
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm");

module.exports = function (t) {
  var root = path.join(__dirname, "..");
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  var scripts = []; html.replace(/<script src="\.\/(assets\/[^"]+)" data-pz>/g, function (_, p) { scripts.push(p); return _; });
  t.group("Ngữ cảnh worker: chỉ các tệp data-pz (" + scripts.length + " tệp)");
  t.ok("index.html liệt kê ít nhất lõi + 1 engine", scripts.length >= 6 && scripts.some(function (p) { return /puzzles\//.test(p); }), scripts);
  var sandbox = { console: console }, ctx = vm.createContext(sandbox), self = vm.runInContext("globalThis", ctx);
  var loadErr = [];
  scripts.forEach(function (p) { try { vm.runInContext(fs.readFileSync(path.join(root, p), "utf8"), ctx, { filename: p }); } catch (e) { loadErr.push(p + ": " + e.message); } });
  t.ok("mọi tệp data-pz nạp được trong vm trống (không DOM, không module)", loadErr.length === 0, loadErr);
  t.ok("không có window/document/localStorage trong ngữ cảnh", typeof vm.runInContext("typeof window + typeof document + typeof localStorage", ctx) === "string" && vm.runInContext("typeof window + typeof document + typeof localStorage", ctx) === "undefinedundefinedundefined");
  var Puz = self.Puz, real = Puz.types.all();
  t.ok("mọi engine đăng ký được: " + real.map(function (d) { return d.id; }).join(", "), real.length >= 5 && real.every(function (d) { return Puz.types.conformance(d).length === 0; }));
  t.ok("Puz.plan và Puz.grade có trong ngữ cảnh worker (engine tương tác/tối ưu dùng được)", !!(Puz.plan && Puz.plan.appendDiff && Puz.grade && Puz.grade.fromRatio));
  var gia = null;
  try { vm.runInContext(fs.readFileSync(path.join(__dirname, "mau", "loai-gia.js"), "utf8"), ctx, { filename: "kiem/mau/loai-gia.js" }); var made = self.PuzLoaiGia(Puz); Puz.types.register(made.giatoiuu); Puz.types.register(made.giadoan); gia = made; } catch (e) { gia = null; t.ok("nạp hai loại giả vào vm worker", false, e && e.message); }
  if (gia) t.ok("hai loại giả (optimize + interactive, có options) đăng ký được trong vm worker — chỉ dùng các tệp data-pz", Puz.types.get("giatoiuu") && Puz.types.get("giadoan"));
  var types = Puz.types.all(), J = function (x) { return JSON.stringify(x); };

  function applyAll(def, pz, steps) {
    var st = JSON.parse(JSON.stringify(def.newState(pz)));
    steps.forEach(function (s) { s.diff.d.forEach(function (e) { if (e[0] === "c" && !st.c) { st.c = new Array(st.v.length).fill(0); } st[e[0]][e[1]] = e[3]; }); });
    return st;
  }
  types.forEach(function (def) {
    var sz = def.sizes.filter(function (s) { return s.default; })[0], tier = (sz.tiers || ["easy"])[0], errs = [], pz = null;
    function step(name, fn) { try { return fn(); } catch (e) { errs.push(name + ": " + (e && e.message)); return null; } }
    pz = step("generate", function () { return def.generate(4321, { sizeId: sz.id, tier: tier }); });
    if (!pz) { t.ok(def.name + ": generate trong ngữ cảnh worker", false, errs); return; }
    var steps = step("replay", function () { return def.replay(pz); });
    var cv = step("constraintView", function () { return def.constraintView(pz); });
    var tr = step("trace", function () { return def.trace(pz, { maxNodes: 600 }); });
    var sv = step("solve", function () { return def.solve(pz, { limit: 2 }); });
    var back = step("fromFile(toFile)", function () { var f = def.fromFile(def.toFile(pz)); if (!f.ok) throw new Error(f.errors.join("; ")); return f.puzzle; });
    var txt = step("fromText(toText)", function () { var f = def.fromText(def.toText(pz)); if (!f.ok) throw new Error(f.errors.join("; ")); return f.puzzle; });
    var hint = step("hint", function () { return def.hint(pz, def.newState(pz), 3, { autoRemove: true, showConflicts: true }); });
    t.ok(def.name + ": generate, replay, constraintView, trace, solve, toFile/fromFile, toText/fromText, hint đều chạy trong ngữ cảnh worker", errs.length === 0 && steps && steps.length && cv && tr && sv && back && txt && hint, errs);
    if (steps) {
      var st = applyAll(def, pz, steps);
      t.ok(def.name + ": replay (chạy trong worker) kết thúc ở trạng thái đã giải", def.check(pz, st).solved);
      if (typeof def.grade === "function") {
        var gr = step("grade", function () { return def.grade(pz, st, { moves: steps.length, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false }); });
        t.ok(def.name + ": grade trên trạng thái cuối của replay đủ trường" + (def.kind === "optimize" ? " và quality = 1 (lời giải là tối ưu)" : ""), gr && Puz.grade.errors(gr).length === 0 && (def.kind !== "optimize" || gr.quality === 1), gr && Puz.grade.errors(gr));
      }
    }
    t.ok(def.name + ": kết quả của worker chuyển qua postMessage được (JSON thuần)", (function () { try { return JSON.stringify([pz, steps, cv, tr]).length > 10; } catch (e) { return false; } })());
    if (!def.options) return;
    // ---- vòng options: mỗi lựa chọn KHÁC mặc định của từng option
    t.ok(def.name + ": sinh với lựa chọn mặc định ⇒ puzzle.options gọn = {}", pz.options === undefined || J(pz.options) === "{}", pz.options);
    var bad = [], n = 0;
    def.options.forEach(function (o) {
      o.choices.forEach(function (c) {
        if (c.id === o.default) return;
        n++;
        var want = {}; want[o.id] = c.id;
        var e2 = [], p2 = null;
        try { p2 = def.generate(4321, { sizeId: sz.id, tier: tier, options: want }); } catch (e) { e2.push("generate: " + e.message); }
        if (p2) {
          if (J(p2.options) !== J(want)) e2.push("puzzle.options " + J(p2.options) + " ≠ " + J(want));
          if (Puz.util.puzzleId(p2) === Puz.util.puzzleId(pz)) e2.push("id trùng với đề mặc định (lựa chọn chưa được ghi vào data)");
          if (J(def.generate(4321, { sizeId: sz.id, tier: tier, options: want })) !== J(p2)) e2.push("không tất định");
          try { var s2 = def.replay(p2); if (!def.check(p2, applyAll(def, p2, s2)).solved) e2.push("replay không giải xong"); } catch (e) { e2.push("replay: " + e.message); }
          try { JSON.stringify(p2); } catch (e) { e2.push("không phải JSON thuần"); }
        }
        if (e2.length) bad.push(o.id + ":" + c.id + " → " + e2.join("; "));
      });
    });
    t.ok(def.name + ": " + n + " lựa chọn khác mặc định — sinh trong worker, puzzle.options gọn đúng, id khác đề mặc định, tất định, replay giải xong", n > 0 && bad.length === 0, bad);
  });
};
