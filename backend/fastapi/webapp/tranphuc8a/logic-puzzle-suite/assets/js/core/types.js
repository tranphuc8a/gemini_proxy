/* core/types.js — sổ đăng ký các LOẠI PUZZLE (Puzzle Type). Mỗi loại là một đối tượng tuân theo cùng giao diện (xem HUONG-DAN-ENGINE.md),
   nên thêm puzzle mới = viết một tệp trong assets/js/puzzles/ gọi Puz.types.register(...) và một tệp board trong assets/js/ui/boards/; không sửa lõi.
   `conformance(def)` trả danh sách lỗi giao diện (rỗng = đạt) — kiem.js chạy cho mọi loại đã đăng ký.
   Thuộc tính TUỲ CHỌN (HUONG-DAN-ENGINE.md mục 11, vắng = hành vi cũ): kind (static | interactive | optimize), objective {sense, label, unit}
   (bắt buộc khi optimize), grade(puzzle, state, counters), options [{id, label, choices:[{id, label, note?}], default}], sizeLabel, moveLabel, mistakeLabel.
   optionsOf/compactOptions/encodeOptions/decodeOptions: chuẩn hoá lựa chọn khi sinh đề và trong liên kết seed (o=mode:adv,rule:x). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var list = [], byId = {};

  var FAMILIES = ["Grid Puzzle", "Constraint Puzzle", "Graph Puzzle", "Mathematical Puzzle", "Deduction Puzzle", "Search / State Puzzle"];
  var FUNCS = ["generate", "fromInput", "validate", "solve", "difficulty", "newState", "moveFor", "check", "mistakes", "hint", "replay", "constraintView", "trace", "toFile", "fromFile", "toText", "fromText", "isGiven", "describeCell"];
  var META = ["id", "name", "family", "category", "icon", "blurb", "rules", "sizes", "algorithm", "difficultyNote"];
  var KINDS = ["static", "interactive", "optimize"], SENSES = ["max", "min"], LABELS = ["sizeLabel", "moveLabel", "mistakeLabel"];
  var OPT_ID = /^[a-z][a-z0-9-]{0,23}$/, CHOICE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;          // không ':' ',' (liên kết o=), không '_' đầu (chặn __proto__)

  function nonEmpty(x) { return typeof x === "string" && !!x.trim(); }
  function kindOf(def) { return def && KINDS.indexOf(def.kind) >= 0 ? def.kind : "static"; }
  function optionErrors(opts) {
    var errs = [], seen = {};
    if (!Array.isArray(opts) || !opts.length) return ["options phải là mảng khác rỗng [{id, label, choices:[{id, label, note?}], default}]"];
    opts.forEach(function (o, i) {
      var at = "options[" + i + "]";
      if (!o || typeof o !== "object") { errs.push(at + " phải là đối tượng"); return; }
      if (typeof o.id !== "string" || !OPT_ID.test(o.id)) errs.push(at + ".id phải khớp " + OPT_ID + " (chữ thường, số, '-')");
      else if (seen[o.id]) errs.push(at + ": trùng id option '" + o.id + "'"); else seen[o.id] = 1;
      if (!nonEmpty(o.label)) errs.push(at + ".label phải là chuỗi khác rỗng");
      if (!Array.isArray(o.choices) || o.choices.length < 2) { errs.push(at + ".choices cần ít nhất 2 lựa chọn {id, label}"); return; }
      var ids = {};
      o.choices.forEach(function (c, k) {
        var ct = at + ".choices[" + k + "]";
        if (!c || typeof c !== "object") { errs.push(ct + " phải là đối tượng"); return; }
        if (typeof c.id !== "string" || !CHOICE_ID.test(c.id)) errs.push(ct + ".id phải khớp " + CHOICE_ID);
        else if (ids[c.id]) errs.push(ct + ": trùng id lựa chọn '" + c.id + "'"); else ids[c.id] = 1;
        if (!nonEmpty(c.label)) errs.push(ct + ".label phải là chuỗi khác rỗng");
        if (c.note != null && typeof c.note !== "string") errs.push(ct + ".note phải là chuỗi");
      });
      if (typeof o.default !== "string" || !ids[o.default]) errs.push(at + ".default phải là id của một lựa chọn trong choices");
    });
    return errs;
  }
  function extErrors(def) {
    var errs = [], o = def.objective;
    if (def.goal != null) errs.push("không dùng 'goal' — dùng kind: \"optimize\" + objective (HUONG-DAN-ENGINE.md mục 11)");
    if (def.kind != null && KINDS.indexOf(def.kind) < 0) errs.push("kind phải là một trong: " + KINDS.join(" | "));
    if (def.kind === "optimize" && o == null) errs.push("kind \"optimize\" cần objective {sense, label, unit}");
    if (o != null && (typeof o !== "object" || SENSES.indexOf(o.sense) < 0 || !nonEmpty(o.label) || typeof o.unit !== "string")) errs.push("objective cần sense \"max\"|\"min\", label (chuỗi khác rỗng), unit (chuỗi, có thể rỗng)");
    if (def.grade != null && typeof def.grade !== "function") errs.push("grade phải là hàm grade(puzzle, state, counters)");
    else if (def.kind === "optimize" && typeof def.grade !== "function") errs.push("kind \"optimize\" cần hàm grade(puzzle, state, counters)");
    LABELS.forEach(function (k) { if (def[k] != null && !nonEmpty(def[k])) errs.push(k + " phải là chuỗi khác rỗng"); });
    if (def.options != null) errs = errs.concat(optionErrors(def.options));
    return errs;
  }

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
    return errs.concat(extErrors(def));
  }

  // ---- options: lựa chọn khi sinh đề ngoài (cỡ, bậc). Dạng ĐẦY ĐỦ {id: lựa chọn} có mọi option; dạng GỌN chỉ giữ lựa chọn khác mặc định.
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /** "mode:adv,rule:x" → {mode:"adv", rule:"x"}. Bỏ phần rác; khoá trùng thì lần đầu thắng. Không bao giờ ném. */
  function decodeOptions(str) {
    var out = {};
    if (typeof str !== "string") return out;
    str.split(",").forEach(function (part) {
      var m = /^([a-z][a-z0-9-]{0,23}):([A-Za-z0-9][A-Za-z0-9-]{0,23})$/.exec(part.replace(/\s+/g, ""));
      if (m && !own(out, m[1])) out[m[1]] = m[2];
    });
    return out;
  }
  /** Lựa chọn đầy đủ cho def: raw là đối tượng, chuỗi liên kết hoặc null; option thiếu / lựa chọn lạ → mặc định; khoá lạ bị bỏ. */
  function optionsOf(def, raw) {
    var src = typeof raw === "string" ? decodeOptions(raw) : raw && typeof raw === "object" ? raw : {}, out = {};
    (def && Array.isArray(def.options) ? def.options : []).forEach(function (o) {
      var v = own(src, o.id) && src[o.id] != null ? String(src[o.id]) : null;
      out[o.id] = v != null && o.choices.some(function (c) { return c.id === v; }) ? v : o.default;
    });
    return out;
  }
  /** Chỉ các lựa chọn KHÁC mặc định — dạng engine trả ở puzzle.options và vỏ đưa vào liên kết seed. {} nếu toàn mặc định. */
  function compactOptions(def, raw) {
    var full = optionsOf(def, raw), out = {};
    (def && Array.isArray(def.options) ? def.options : []).forEach(function (o) { if (full[o.id] !== o.default) out[o.id] = full[o.id]; });
    return out;
  }
  /** Dạng gọn → "mode:adv,rule:x" (thứ tự khai báo trong def.options); "" khi toàn mặc định. */
  function encodeOptions(def, raw) {
    var c = compactOptions(def, raw);
    return (def && Array.isArray(def.options) ? def.options : []).filter(function (o) { return own(c, o.id); }).map(function (o) { return o.id + ":" + c[o.id]; }).join(",");
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

  P.types = { register: register, get: get, all: all, conformance: conformance, sizeOf: sizeOf, kindOf: kindOf, optionsOf: optionsOf, compactOptions: compactOptions,
    encodeOptions: encodeOptions, decodeOptions: decodeOptions, FAMILIES: FAMILIES, FUNCS: FUNCS, META: META, KINDS: KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = P.types;
})(typeof globalThis !== "undefined" ? globalThis : this);
