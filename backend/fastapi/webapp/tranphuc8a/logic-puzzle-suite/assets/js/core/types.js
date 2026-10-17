/* core/types.js — sổ đăng ký các LOẠI PUZZLE (Puzzle Type). Mỗi loại là một đối tượng tuân theo cùng giao diện (xem HUONG-DAN-ENGINE.md),
   nên thêm puzzle mới = viết một tệp trong assets/js/puzzles/ gọi Puz.types.register(...) và một tệp board trong assets/js/ui/boards/; không sửa lõi.
   `conformance(def)` trả danh sách lỗi giao diện (rỗng = đạt) — kiem.js chạy cho mọi loại đã đăng ký. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var list = [], byId = {};

  var FAMILIES = ["Grid Puzzle", "Constraint Puzzle", "Graph Puzzle", "Mathematical Puzzle", "Deduction Puzzle", "Search / State Puzzle"];
  var FUNCS = ["generate", "fromInput", "validate", "solve", "difficulty", "newState", "moveFor", "check", "mistakes", "hint", "replay", "constraintView", "trace", "toFile", "fromFile", "toText", "fromText", "isGiven", "describeCell"];
  var META = ["id", "name", "family", "category", "icon", "blurb", "rules", "sizes", "algorithm", "difficultyNote"];

  function conformance(def) {
    var errs = [], i;
    META.forEach(function (k) { if (def[k] == null) errs.push("thiếu thuộc tính " + k); });
    FUNCS.forEach(function (k) { if (typeof def[k] !== "function") errs.push("thiếu hàm " + k + "()"); });
    if (def.family && FAMILIES.indexOf(def.family) < 0) errs.push("family phải là một trong: " + FAMILIES.join(" | "));
    if (!Array.isArray(def.rules) || !def.rules.length) errs.push("rules phải là mảng chuỗi (luật chơi bằng tiếng Việt)");
    if (!Array.isArray(def.sizes) || !def.sizes.length) errs.push("sizes phải là mảng {id,label,params}");
    else {
      var d = 0; for (i = 0; i < def.sizes.length; i++) { var s = def.sizes[i]; if (!s.id || !s.label || s.params == null) errs.push("sizes[" + i + "] cần id, label, params"); if (s.default) d++; }
      if (d !== 1) errs.push("đúng một size phải có default: true");
    }
    var a = def.algorithm;
    if (a && (!a.title || !Array.isArray(a.steps) || !a.steps.length || !a.steps.every(function (x) { return x && x.title && x.text; }))) errs.push("algorithm cần title và steps:[{title,text}]");
    if (a && a.links && !a.links.every(function (l) { return l && l.id && l.label; })) errs.push("algorithm.links: mỗi mục cần id (id trong Algorithm Notebook) và label");
    return errs;
  }

  function register(def) {
    var errs = conformance(def);
    if (errs.length) throw new Error("Loại puzzle '" + (def && def.id) + "' không tuân giao diện: " + errs.join("; "));
    if (byId[def.id]) throw new Error("Trùng loại puzzle: " + def.id);
    byId[def.id] = def; list.push(def);
    return def;
  }
  function get(id) { return byId[id] || null; }
  function all() { return list.slice(); }
  function sizeOf(def, id) { for (var i = 0; i < def.sizes.length; i++) if (def.sizes[i].id === id) return def.sizes[i]; for (i = 0; i < def.sizes.length; i++) if (def.sizes[i].default) return def.sizes[i]; return def.sizes[0]; }

  P.types = { register: register, get: get, all: all, conformance: conformance, sizeOf: sizeOf, FAMILIES: FAMILIES, FUNCS: FUNCS, META: META };
  if (typeof module !== "undefined" && module.exports) module.exports = P.types;
})(typeof globalThis !== "undefined" ? globalThis : this);
