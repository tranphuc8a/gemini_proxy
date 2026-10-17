/* kiem/app-worker.js — mô phỏng NGỮ CẢNH WORKER: chỉ nạp đúng các tệp có `data-pz` trong index.html (theo thứ tự) vào một vm trống (không window/document/module),
   rồi gọi mọi hàm mà giao diện đẩy sang worker (generate, fromInput, replay, constraintView, trace…) cho từng loại puzzle.
   Bắt lỗi kiểu "engine gọi Puz.game.applyDiff nhưng game.js không được nạp vào worker" — node với đầy đủ lõi thì không thấy lỗi này, trình duyệt thì có. */
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
  var Puz = self.Puz, types = Puz.types.all();
  t.ok("mọi engine đăng ký được: " + types.map(function (d) { return d.id; }).join(", "), types.length >= 5 && types.every(function (d) { return Puz.types.conformance(d).length === 0; }));

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
    var hint = step("hint", function () { return def.hint(pz, def.newState(pz), 3); });
    t.ok(def.name + ": generate, replay, constraintView, trace, solve, toFile/fromFile, toText/fromText, hint đều chạy trong ngữ cảnh worker", errs.length === 0 && steps && steps.length && cv && tr && sv && back && txt && hint, errs);
    if (steps) {
      var st = JSON.parse(JSON.stringify(def.newState(pz)));
      steps.forEach(function (s) { s.diff.d.forEach(function (e) { if (e[0] === "c" && !st.c) { st.c = new Array(st.v.length).fill(0); } st[e[0]][e[1]] = e[3]; }); });
      t.ok(def.name + ": replay (chạy trong worker) kết thúc ở trạng thái đã giải", def.check(pz, st).solved);
    }
    t.ok(def.name + ": kết quả của worker chuyển qua postMessage được (JSON thuần)", (function () { try { return JSON.stringify([pz, steps, cv, tr]).length > 10; } catch (e) { return false; } })());
  });
};
