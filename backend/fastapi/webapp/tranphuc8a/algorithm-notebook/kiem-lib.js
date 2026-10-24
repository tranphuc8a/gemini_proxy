/* kiem-lib.js — kiểm dữ liệu thư viện thuật toán dựng sẵn (assets/data/lib-*.js) bằng node.
     node kiem-lib.js                      kiểm TOÀN BỘ thư viện: mọi tệp lib-*.js, đủ mọi id trong master-ids.json, related/đáp án trỏ đúng
     node kiem-lib.js --partial lib-ds.js  kiểm riêng vài tệp (related/đáp án chỉ cần có trong master-ids.json) — dùng khi đang soạn
     node kiem-lib.js --dump <id> <tệp>    ghi mẫu code của một mục ra tệp (cho kiem-code.py)
     node kiem-lib.js --ids                in danh sách id đã có
   Lỗi → exit 1. */
"use strict";
var fs = require("fs"), path = require("path");
var HERE = __dirname, JS = path.join(HERE, "assets", "js"), DATA = path.join(HERE, "assets", "data");
require(path.join(JS, "core", "text.js"));
var lib = require(path.join(JS, "core", "lib.js"));

function csesTasks() {
  var file = path.join(HERE, "..", "..", "..", "..", "..", "tasks", "2610", "261017", "algorithm-notebook", "cses-tasks.txt"), map = {};
  fs.readFileSync(file, "utf8").split("\n").forEach(function (line) {
    if (/^\s*(#|\[|$)/.test(line)) return;
    line.split(" | ").forEach(function (cell) { var m = /^\s*(\d+) (.+?)\s*$/.exec(cell); if (m) map[m[1]] = m[2]; });
  });
  return map;
}

var args = process.argv.slice(2), partial = args[0] === "--partial", dump = args[0] === "--dump";
var master = JSON.parse(fs.readFileSync(path.join(HERE, "master-ids.json"), "utf8")), known = {}, owner = {};
master.forEach(function (g) { g.items.forEach(function (it) { known[it[0]] = 1; owner[it[0]] = g; }); });

var files = partial ? args.slice(1).map(function (f) { return path.isAbsolute(f) ? f : fs.existsSync(f) ? path.resolve(f) : path.join(DATA, f); })
  : fs.readdirSync(DATA).filter(function (f) { return /^lib-.*\.js$/.test(f); }).map(function (f) { return path.join(DATA, f); });
var loadErrors = [];
files.forEach(function (f) {
  try { require(f); } catch (e) {
    // một tệp của người khác đang hỏng không được chặn việc kiểm/dump tệp của bạn; kiểm toàn bộ thì báo thành lỗi
    loadErrors.push(path.basename(f) + ": không nạp được — " + String(e && e.message || e).split("\n")[0]);
  }
});
if (partial) { var own = files.map(function (f) { return path.basename(f); }); loadErrors = loadErrors.filter(function (m) { return own.indexOf(m.split(":")[0]) !== -1; }); }
else if (dump || args[0] === "--ids") loadErrors = [];

if (dump) {
  var e = lib.get(args[1]);
  if (!e || !e.code) { console.error("không có mã cho " + args[1]); process.exit(2); }
  fs.writeFileSync(args[2], e.code.src, "utf8"); process.exit(0);
}
if (args[0] === "--ids") { console.log(lib.all().map(function (e) { return e.id; }).join("\n")); process.exit(0); }

var errors = loadErrors.concat(lib.validateAll({ cses: csesTasks(), known: partial ? known : null }));
lib.all().forEach(function (e) {
  var g = owner[e.id];
  if (!g) errors.push(e.id + ": id không có trong master-ids.json (không được tự thêm id; nếu cần mục mới hãy báo lại)");
  else if (g.category !== e.category) errors.push(e.id + ": category phải là " + g.category + " (theo master-ids.json)");
});
if (!partial) master.forEach(function (g) { g.items.forEach(function (it) { if (!lib.get(it[0])) errors.push(it[0] + ": thiếu mục (master-ids.json, tệp " + g.file + ")"); }); });

/* Dấu `$` trong chữ thư viện: markdown.js (từ W4) hiểu `$…$`, `$$…$$`, `\(…\)`, `\[…\]` là CÔNG THỨC (luật pandoc). Hai dấu `$` trong cùng một đoạn
   — vd `P + '$' + T … '$' không` (lib-string.js, thẻ Z-function) — ghép thành công thức giả, mất chữ. Thư viện hiện không có công thức nào cố ý, nên
   MỌI chuỗi chữ của mục / kịch bản đều phải dựng ra không có `.math`: bọc `$` trong `code` hoặc viết `\$`. (Cần công thức thật sau này: đổi luật này
   thành danh sách ngoại lệ có chủ ý, đừng bỏ phép kiểm.) Bỏ `code.src` (mã nguồn) và `example` (khối vào/ra) — chúng không đi qua markdown. */
require(path.join(JS, "core", "markdown.js"));
var MD = globalThis.Algo.markdown, mathErrors = [];
function textLeaves(v, where, out) {
  if (typeof v === "string") out.push([where, v]);
  else if (Array.isArray(v)) v.forEach(function (x, i) { textLeaves(x, where + "[" + i + "]", out); });
  else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { if (k !== "src" && k !== "example") textLeaves(v[k], where ? where + "." + k : k, out); });
  return out;
}
function noAccidentalMath(id, obj) {
  textLeaves(obj, "", []).forEach(function (leaf) {
    if (leaf[1].indexOf("$") === -1 && leaf[1].indexOf("\\") === -1) return;
    var html = MD.render(leaf[1], {}), m = /class="math[^"]*" data-tex="([^"]*)"/.exec(html);
    if (m) mathErrors.push(id + ": " + leaf[0] + ": chữ có `$`/`\\(` bị hiểu thành công thức ngoài ý muốn (\"" + m[1].slice(0, 40) + "\") — bọc trong `code` hoặc viết \\$");
  });
}
lib.all().forEach(function (e) { noAccidentalMath(e.id, Object.assign({}, e, { code: null })); });
lib.allScenarios().forEach(function (s) { noAccidentalMath(s.id, s); });
errors = errors.concat(mathErrors);

var per = {};
lib.all().forEach(function (e) { per[e.category] = (per[e.category] || 0) + 1; });
console.log("Mục: " + lib.size() + " · kịch bản: " + lib.allScenarios().length + " · " + Object.keys(per).map(function (k) { return k + "=" + per[k]; }).join(" "));
if (errors.length) { console.log("\n" + errors.length + " LỖI:"); errors.slice(0, 80).forEach(function (m) { console.log("  - " + m); }); if (errors.length > 80) console.log("  … và " + (errors.length - 80) + " lỗi nữa"); process.exit(1); }
console.log("Dữ liệu hợp lệ.");
