#!/usr/bin/env node
/* kiem.js — kiểm logic thuần của Logic Puzzle Suite (không trình duyệt).

     node kiem.js            chạy tất cả (lõi + mọi loại puzzle đã có tệp trong assets/js/puzzles/)
     node kiem.js sudoku     chạy lõi + riêng test của loại `sudoku` (kiem/sudoku.js)
     node kiem.js core       chỉ lõi

   Mỗi tệp trong kiem/ xuất một hàm (t) => { … }. `t` có: group(tên), ok(tên, điều kiện, chi tiết), eq(tên, thực tế, mong đợi) (so JSON),
   within(tên, giá trị, min, max), time(tên, maxMs, fn) (chạy fn, báo ms, sai nếu quá maxMs), info(chữ), Puz.
   Mã thoát ≠ 0 nếu có phép sai. Giới hạn thời gian được nới bằng biến môi trường PUZ_PERF_SLACK (mặc định 1; máy chậm đặt 3). */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = __dirname;
var only = process.argv[2] || "";
var SLACK = Number(process.env.PUZ_PERF_SLACK || 1) || 1;

function load(rel) { var p = path.join(ROOT, rel); require(p); }
["assets/js/core/text.js", "assets/js/core/rng.js", "assets/js/core/util.js", "assets/js/core/csp.js", "assets/js/core/types.js", "assets/js/core/game.js"].forEach(load);
["assets/js/data/schema.js", "assets/js/data/store.js", "assets/js/data/zip.js", "assets/js/data/user.js", "assets/js/data/backup.js"].forEach(function (rel) { if (fs.existsSync(path.join(ROOT, rel))) load(rel); });
var Puz = globalThis.Puz;

// các tệp lõi tuỳ chọn (có thì nạp): daily, progress, stats, share…
["stats", "daily", "progress", "files", "gen"].forEach(function (n) { var p = path.join(ROOT, "assets/js/core", n + ".js"); if (fs.existsSync(p)) { try { require(p); } catch (e) { console.log("  [LỖI NẠP] core/" + n + ".js: " + e.message); process.exitCode = 1; } } });

var puzDir = path.join(ROOT, "assets/js/puzzles"), loaded = [], loadErr = [];
(fs.existsSync(puzDir) ? fs.readdirSync(puzDir).filter(function (f) { return /\.js$/.test(f); }).sort() : []).forEach(function (f) {
  try { require(path.join(puzDir, f)); loaded.push(f.replace(/\.js$/, "")); } catch (e) { loadErr.push(f + ": " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
});

var pass = 0, fail = 0, curGroup = "";
function report(okk, name, detail) {
  if (okk) { pass++; console.log("  [ok]  " + name); } else { fail++; process.exitCode = 1; console.log("  [SAI] " + name + (detail !== undefined && detail !== "" ? "  →  " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 600) : "")); }
}
var t = {
  Puz: Puz, slack: SLACK,
  group: function (name) { curGroup = name; console.log("\n" + name); },
  ok: function (name, cond, detail) { report(!!cond, name, detail); },
  eq: function (name, actual, expected) { var a = JSON.stringify(actual), b = JSON.stringify(expected); report(a === b, name, a === b ? "" : "thực tế " + a + " ≠ mong đợi " + b); },
  within: function (name, v, lo, hi) { report(v >= lo && v <= hi, name, v >= lo && v <= hi ? "" : v + " ngoài [" + lo + ", " + hi + "]"); },
  time: function (name, maxMs, fn) { var t0 = Date.now(), r = fn(), ms = Date.now() - t0; report(ms <= maxMs * SLACK, name + " (" + ms + " ms)", ms > maxMs * SLACK ? ms + " ms > " + maxMs * SLACK + " ms" : ""); return r; },
  info: function (s) { console.log("        " + s); }
};

report(loadErr.length === 0, "mọi tệp trong assets/js/puzzles nạp được (" + (loaded.join(", ") || "chưa có") + ")", loadErr.join(" || "));
if (loaded.length) {
  var bad = [];
  Puz.types.all().forEach(function (d) { var e = Puz.types.conformance(d); if (e.length) bad.push(d.id + ": " + e.join("; ")); });
  report(bad.length === 0, "mọi loại puzzle đã đăng ký tuân giao diện (" + Puz.types.all().map(function (d) { return d.id; }).join(", ") + ")", bad.join(" || "));
}

var kdir = path.join(ROOT, "kiem");
var files = fs.existsSync(kdir) ? fs.readdirSync(kdir).filter(function (f) { return /\.js$/.test(f); }).sort() : [];
var queue = Promise.resolve();       // test có thể trả Promise (kho IndexedDB giả…): chạy lần lượt, chờ xong mới sang tệp kế
files.forEach(function (f) {
  var id = f.replace(/\.js$/, "");
  var isCore = id === "core" || id.indexOf("core-") === 0;
  if (only && only !== "all" && !(isCore || id === only || id.indexOf(only + "-") === 0)) return;
  if (only === "core" && !isCore) return;
  if (!isCore && loaded.indexOf(id.split("-")[0]) < 0 && ["app", "data", "personal"].indexOf(id.split("-")[0]) < 0) { report(false, "có test kiem/" + f + " nhưng chưa có engine assets/js/puzzles/" + id.split("-")[0] + ".js"); return; }
  queue = queue.then(function () { console.log("\n══ kiem/" + f); return require(path.join(kdir, f))(t); })
    .catch(function (e) { report(false, "kiem/" + f + " ném lỗi", e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : String(e)); });
});

queue.then(function () { console.log("\n" + "=".repeat(58) + "\n" + (fail ? "SAI — " + fail + " phép sai, " + pass + " đạt." : "Đạt — " + pass + " phép kiểm.")); });
