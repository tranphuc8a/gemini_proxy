"use strict";
/* kiem/core-daily-p8.js — P8: 6 loại mới (coinbalance, bachet, coinscale, camel, motorbike, lightsoutx) vào Daily bằng phiên bản SCHEDULE từ 2026-10-30.
   Kiểm: lịch cũ không đổi (so với bản 5 loại viết lại độc lập), xoay vòng 11 loại đều, mọi tổ hợp (loại × thứ trong tuần) sinh được
   puzzle ĐÚNG bậc và có lời giải solved, id Algorithm Notebook có thật, thống kê theo loại/bậc nhận loại mới. */
module.exports = function (t) {
  var Puz = t.Puz, D = Puz.daily, U = Puz.util, fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, "..");
  var OLD5 = ["sudoku", "nqueens", "lightsout", "nonogram", "logicgrid"], NEW6 = ["coinbalance", "bachet", "coinscale", "camel", "motorbike", "lightsoutx"], ALL = OLD5.concat(NEW6);
  var real = Puz.types.all().map(function (d) { return d.id; });
  var V1 = [{ tu: "1970-01-01", ids: OLD5 }];

  t.group("Daily P8 — phiên bản lịch thứ hai (11 loại) từ 2026-10-30");
  t.ok("SCHEDULE có phiên bản thứ hai: tu 2026-10-30, ids = 5 cũ giữ nguyên thứ tự + 6 mới ở cuối", D.SCHEDULE.length >= 2 && D.SCHEDULE[1].tu === "2026-10-30" && JSON.stringify(D.SCHEDULE[1].ids) === JSON.stringify(ALL), D.SCHEDULE);
  t.ok("11 loại đều đã đăng ký", ALL.every(function (id) { return real.indexOf(id) >= 0; }), real);
  t.ok("ORDER (thứ tự hiển thị) = 11 loại", JSON.stringify(D.ORDER) === JSON.stringify(ALL), D.ORDER);
  t.ok("ngày bắt đầu 2026-10-30 ở TƯƠNG LAI so với ngày triển khai 2026-10-25 (hôm nay giữ nguyên)", D.SCHEDULE[1].tu > "2026-10-25");

  (function () {
    var diff = [], n = 0, day;
    for (day = "2020-01-01"; day < "2026-10-30"; day = U.addDays(day, 1)) { n++; if (JSON.stringify(D.forDay(day, real)) !== JSON.stringify(D.forDay(day, real, { schedule: V1 }))) diff.push(day); }
    t.ok("mọi ngày từ 2020-01-01 tới 2026-10-29 (" + n + " ngày, gồm hôm nay và ngày triển khai) trùng HỆT lịch 5 loại cũ (loại, cỡ, bậc, seed)", n > 2000 && diff.length === 0, diff.slice(0, 4));
    var bad = [];
    for (day = "2020-01-01"; day < "2026-10-30"; day = U.addDays(day, 1)) { var f = D.forDay(day, real); if (NEW6.indexOf(f.type) >= 0) bad.push(day); }
    t.ok("không ngày nào trước 2026-10-30 ra loại mới", bad.length === 0, bad.slice(0, 3));
    t.eq("ngày 25/10/2026 (ngày làm P8) vẫn là loại của lịch cũ", D.forDay("2026-10-25", real).type, D.forDay("2026-10-25", real, { schedule: V1 }).type);
  })();

  (function () {
    var seen = {}, k, f;
    for (k = 0; k < 11; k++) { f = D.forDay(U.addDays("2026-10-30", k), real); seen[f.type] = k; }
    t.eq("11 ngày từ 2026-10-30 đi hết 11 loại, đúng thứ tự danh sách (ngày đầu = sudoku)", ALL.map(function (id) { return seen[id]; }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    var ok = true; for (k = 0; k < 220; k++) { var a = D.forDay(U.addDays("2026-11-02", k), real), b = D.forDay(U.addDays("2026-11-02", k + 11), real); if (a.type !== b.type) ok = false; }
    t.ok("xoay vòng đều: ngày n và n+11 cùng loại (220 ngày)", ok);
    // loại mới chưa đăng ký (trình duyệt cũ / Safari không BigInt) → nhảy sang loại kế, không null
    var noBig = real.filter(function (id) { return id !== "motorbike"; }), skipped = D.forDay(U.addDays("2026-10-30", 9), noBig);
    t.ok("loại chưa đăng ký (motorbike vắng khi không có BigInt) → ngày đó nhảy sang loại kế (lightsoutx), không null", skipped && skipped.type === "lightsoutx", skipped);
  })();

  t.group("Daily P8 — mọi tổ hợp (loại mới × thứ trong tuần) sinh được puzzle đúng bậc, có lời giải solved");
  (function () {
    var combos = {}, bad = [], n = 0, tierMiss = [], day, maxMs = 0;
    for (var i = 0; i < 77 * 2 && Object.keys(combos).length < 77; i++) {
      day = U.addDays("2026-10-30", i);
      var spec = D.forDay(day, real); if (NEW6.indexOf(spec.type) < 0) continue;
      var key = spec.type + "|" + D.weekday(day); if (combos[key]) continue; combos[key] = 1;
      var T = Puz.types.get(spec.type), t0 = Date.now(), p = null, why = "";
      try { p = T.generate(spec.seed, { sizeId: spec.sizeId, tier: spec.tier }); } catch (e) { why = String(e && e.message || e); }
      maxMs = Math.max(maxMs, Date.now() - t0); n++;
      if (!p) { bad.push(key + " không sinh được " + why); continue; }
      var q = T.generate(spec.seed, { sizeId: spec.sizeId, tier: spec.tier });
      if (JSON.stringify(p) !== JSON.stringify(q)) bad.push(key + " không tất định");
      var chk = null; try { chk = T.check(p, p.solution); } catch (e) { why = String(e && e.message || e); }
      if (!chk || !chk.solved) bad.push(key + " lời giải không solved " + why);
      if (U.tierOfScore(p.score).id !== spec.tier) tierMiss.push(key + " muốn " + spec.tier + " được " + p.score);
    }
    t.ok("42 tổ hợp (6 loại × 7 thứ) đều sinh được, tất định, lời giải solved (" + n + " tổ hợp, tối đa " + maxMs + " ms/đề)", n === 42 && bad.length === 0, bad.slice(0, 4));
    t.ok("mọi đề Daily mới đạt ĐÚNG bậc mong muốn của thứ trong tuần", tierMiss.length === 0, tierMiss.slice(0, 5));
  })();

  t.group("Daily P8 — loại mới vào thống kê theo loại/bậc và liên kết Algorithm Notebook có thật");
  (function () {
    var S = Puz.stats, recs = NEW6.map(function (id, i) { return { id: "r" + i, type: id, tier: "medium", score: 5, source: "daily", day: "2026-11-0" + (i + 1), endedAt: 1, time: 1000 * (i + 1), mistakes: 0, hints: 0, result: "solved" }; });
    var sum = null; try { sum = S.summary ? S.summary(recs) : null; } catch (e) { sum = null; }
    var byType = null; try { byType = S.byType ? S.byType(recs) : null; } catch (e) { byType = null; }
    var js = JSON.stringify([sum, byType]);
    t.ok("thống kê (nếu có summary/byType) liệt kê đủ 6 loại mới", (!S.summary && !S.byType) || NEW6.every(function (id) { return js.indexOf(id) >= 0; }), js.slice(0, 200));
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), text = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }).map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    var missing = [];
    ALL.forEach(function (id) { var T = Puz.types.get(id); if (!T || !T.algorithm) { missing.push(id + ": thiếu algorithm"); return; } (T.algorithm.links || []).forEach(function (l) { if (text.indexOf('id: "' + l.id + '"') < 0) missing.push(id + " → " + l.id); }); });
    t.ok("mọi loại (11) có khối algorithm; mọi liên kết Notebook trỏ id có thật", missing.length === 0, missing);
    var meta = JSON.parse(fs.readFileSync(path.join(ROOT, "metadata.json"), "utf8")), txt = JSON.stringify(meta);
    t.ok("metadata.json nhắc 6 loại mới (Cân tìm xu giả, Quả cân Bachet, Cân điện tử, Lạc đà, Xe máy, Lights Out biến thể)", /xu giả/i.test(txt) && /Bachet/.test(txt) && /cân điện tử/i.test(txt) && /lạc đà/i.test(txt) && /xe máy/i.test(txt) && /biến thể/i.test(txt), meta.description);
  })();
};
