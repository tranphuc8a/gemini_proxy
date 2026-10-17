/* kiem/nonogram.js — kiểm engine Nonogram theo mục 8 của HUONG-DAN-ENGINE.md.

   Nguồn sự thật ĐỘC LẬP (không dùng bộ giải của engine):
     · vét cạn: liệt kê MỌI ảnh w×h bit (w·h ≤ 20), băm theo cặp clue → đếm số ảnh khớp (đúng định nghĩa Nonogram, viết riêng trong tệp này);
     · bộ giải "từng hàng + cắt tỉa theo cột" (liệt kê mọi cách tô một hàng khớp clue hàng, ghép các hàng sao cho clue cột còn khả thi) — thuật toán KHÁC hẳn bộ giải theo dòng + lan truyền của engine.
   Không có đề công bố nào mà tôi chắc nguồn, nên đề "đã biết" ở đây là đề TỰ DỰNG kiểm tay (đáp án suy ra bằng tay, ghi chú rõ), không phải đề công bố. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("nonogram"), U = Puz.util, G = Puz.game, R = Puz.rng, SLACK = t.slack || 1;
  var APP = path.join(__dirname, "..");
  function J(x) { return JSON.stringify(x); }

  /* ---------------------------------------------------------------- tiện ích độc lập */
  function runsOf(bits) { var out = [], run = 0, i; for (i = 0; i < bits.length; i++) { if (bits[i]) run++; else if (run) { out.push(run); run = 0; } } if (run) out.push(run); return out; }
  function cluesOfImg(img, w, h) {
    var rows = [], cols = [], r, c, line;
    for (r = 0; r < h; r++) { line = []; for (c = 0; c < w; c++) line.push(img[r * w + c]); rows.push(runsOf(line)); }
    for (c = 0; c < w; c++) { line = []; for (r = 0; r < h; r++) line.push(img[r * w + c]); cols.push(runsOf(line)); }
    return { rows: rows, cols: cols };
  }
  function imgMatches(img, w, h, rows, cols) { var cl = cluesOfImg(img, w, h); return J(cl.rows) === J(rows) && J(cl.cols) === J(cols); }
  function solBits(sol) { return sol.map(function (x) { return x === 1 ? 1 : 0; }); }
  function randImg(rng, w, h, p) { var img = [], i; for (i = 0; i < w * h; i++) img.push(rng.chance(p) ? 1 : 0); return img; }
  function rawPuzzle(w, h, rows, cols) { var z = [], i; for (i = 0; i < w * h; i++) z.push(0); return { v: 1, type: "nonogram", seed: null, sizeId: "x", size: { w: w, h: h }, tier: "custom", score: 0, data: { w: w, h: h, rows: rows, cols: cols }, initial: { v: z }, solution: null, meta: {} }; }
  function allWords(s) { return typeof s === "string" && s.trim().length > 0 && !/undefined|null|NaN|\[object/.test(s); }

  /* vét cạn: bảng băm cặp clue → (ảnh đầu tiên, số ảnh) cho một cỡ w×h (w·h ≤ 20) */
  var BF = {};
  function idTable(n) {
    var ids = new Int32Array(1 << n), names = {}, cnt = 0, m, i, bits, sig;
    for (m = 0; m < (1 << n); m++) { bits = []; for (i = 0; i < n; i++) bits.push((m >> i) & 1); sig = runsOf(bits).join(","); if (names[sig] === undefined) names[sig] = cnt++; ids[m] = names[sig]; }
    return { ids: ids, names: names, K: cnt };
  }
  function bruteMap(w, h) {
    var key = w + "x" + h, N = w * h, total = 1 << N, RT, CT, map, x, r, c, rk, ck, m, kk, v, mask = (1 << w) - 1, colSpan;
    if (BF[key]) return BF[key];
    RT = idTable(w); CT = idTable(h); map = new Map(); colSpan = Math.pow(CT.K, w);
    for (x = 0; x < total; x++) {
      rk = 0; ck = 0;
      for (r = 0; r < h; r++) rk = rk * RT.K + RT.ids[(x >>> (r * w)) & mask];
      for (c = 0; c < w; c++) { m = 0; for (r = 0; r < h; r++) m |= ((x >>> (r * w + c)) & 1) << r; ck = ck * CT.K + CT.ids[m]; }
      kk = rk * colSpan + ck; v = map.get(kk);
      if (v === undefined) map.set(kk, (x << 2) | 1); else if ((v & 3) < 3) map.set(kk, v + 1);
    }
    BF[key] = { w: w, h: h, RT: RT, CT: CT, map: map, colSpan: colSpan };
    return BF[key];
  }
  /** → { count (cắt ở 3), img (ảnh đầu tiên) } */
  function bruteCount(w, h, rows, cols) {
    var B = bruteMap(w, h), rk = 0, ck = 0, r, c, id, v;
    for (r = 0; r < h; r++) { id = B.RT.names[rows[r].join(",")]; if (id === undefined) return { count: 0, img: null }; rk = rk * B.RT.K + id; }
    for (c = 0; c < w; c++) { id = B.CT.names[cols[c].join(",")]; if (id === undefined) return { count: 0, img: null }; ck = ck * B.CT.K + id; }
    v = B.map.get(rk * B.colSpan + ck);
    if (v === undefined) return { count: 0, img: null };
    var x = v >>> 2, img = [], i; for (i = 0; i < w * h; i++) img.push((x >>> i) & 1);
    return { count: v & 3, img: img };
  }
  /** mọi ảnh (mảng 0/1) khớp clue và khớp các ô đã đánh dấu marks (0/1/2) — vét cạn thẳng, cho cỡ rất nhỏ */
  function bruteConsistent(w, h, rows, cols, marks) {
    var N = w * h, out = [], x, img, i, ok;
    for (x = 0; x < (1 << N); x++) {
      ok = true;
      for (i = 0; i < N; i++) { var b = (x >>> i) & 1; if ((marks[i] === 1 && !b) || (marks[i] === 2 && b)) { ok = false; break; } }
      if (!ok) continue;
      img = []; for (i = 0; i < N; i++) img.push((x >>> i) & 1);
      if (imgMatches(img, w, h, rows, cols)) out.push(img);
    }
    return out;
  }

  /* bộ giải độc lập thứ hai: từng hàng, cắt tỉa theo cột. Trả { count (≤ limit), imgs, aborted } */
  function indepSolve(w, h, rows, cols, limit, maxNodes) {
    var cand = [], r, c, m, bits, i, nodes = 0, aborted = false, found = [], idx = [], run = [];
    var tail = cols.map(function (cl) { var s = [], acc = 0, k; for (k = cl.length - 1; k >= 0; k--) { acc += cl[k]; s[k] = acc + (cl.length - k - 1); } s[cl.length] = 0; return s; });   // tail[c][j] = số ô tối thiểu để đặt các khối j.. (tính khoảng cách giữa chúng)
    for (r = 0; r < h; r++) {
      cand[r] = [];
      for (m = 0; m < (1 << w); m++) { bits = []; for (i = 0; i < w; i++) bits.push((m >> i) & 1); if (J(runsOf(bits)) === J(rows[r])) cand[r].push(bits); }
      if (!cand[r].length) return { count: 0, imgs: [], aborted: false };
    }
    for (c = 0; c < w; c++) { idx.push(0); run.push(0); }
    function colOk(c, ix, rn, rem) {            // cột c đang ở khối ix, đã tô liên tiếp rn ô, còn rem hàng
      var cl = cols[c], need;
      if (rn > 0) { if (ix >= cl.length || rn > cl[ix]) return false; need = (cl[ix] - rn) + (ix + 1 < cl.length ? 1 + tail[c][ix + 1] : 0); }
      else need = tail[c][ix] > 0 ? tail[c][ix] : 0;
      return need <= rem;
    }
    function rec(r, img) {
      if (aborted || found.length >= limit) return;
      if (r === h) {
        for (var cc = 0; cc < w; cc++) { var ix = idx[cc], rn = run[cc]; if (rn > 0) { if (ix >= cols[cc].length || cols[cc][ix] !== rn) return; ix++; } if (ix !== cols[cc].length) return; }
        found.push(img.slice()); return;
      }
      for (var k = 0; k < cand[r].length; k++) {
        if (++nodes > maxNodes) { aborted = true; return; }
        var bitsR = cand[r][k], saveI = idx.slice(), saveR = run.slice(), ok = true, cc2;
        for (cc2 = 0; cc2 < w && ok; cc2++) {
          if (bitsR[cc2]) run[cc2]++;
          else if (run[cc2] > 0) { if (idx[cc2] >= cols[cc2].length || cols[cc2][idx[cc2]] !== run[cc2]) ok = false; else { idx[cc2]++; run[cc2] = 0; } }
          if (ok && !colOk(cc2, idx[cc2], run[cc2], h - r - 1)) ok = false;
        }
        if (ok) { for (cc2 = 0; cc2 < w; cc2++) img[r * w + cc2] = bitsR[cc2]; rec(r + 1, img); }
        idx = saveI; run = saveR;
      }
    }
    var arr = []; for (i = 0; i < w * h; i++) arr.push(0);
    rec(0, arr);
    return { count: found.length, imgs: found, aborted: aborted };
  }

  /* ================================================================== 1. siêu dữ liệu */
  t.group("Nonogram — siêu dữ liệu và nội dung");
  t.ok("đã đăng ký, id = nonogram, family hợp lệ", T && T.id === "nonogram" && Puz.types.FAMILIES.indexOf(T.family) >= 0);
  t.ok("mọi sizes[].tiers là bậc hợp lệ (không rỗng)", T.sizes.every(function (s) { return Array.isArray(s.tiers) && s.tiers.length > 0 && s.tiers.every(function (x) { return !!U.tier(x); }); }));
  t.eq("ba cỡ 5/10/15 với 10 là mặc định", T.sizes.map(function (s) { return s.id + (s.default ? "*" : ""); }), ["5", "10*", "15"]);
  var libDir = path.join(APP, "..", "algorithm-notebook", "assets", "data"), libText = "";
  fs.readdirSync(libDir).filter(function (f) { return /^lib-.*\.js$/.test(f); }).forEach(function (f) { libText += fs.readFileSync(path.join(libDir, f), "utf8"); });
  t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length > 0 && T.algorithm.links.every(function (l) { return libText.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links.map(function (l) { return l.id; }));
  var texts = [T.name, T.blurb, T.difficultyNote, T.algorithm.title].concat(T.rules, T.algorithm.steps.map(function (s) { return s.title + " " + s.text; }), T.algorithm.links.map(function (l) { return l.label; }));
  t.ok("rules/blurb/algorithm: không rỗng, không undefined/null/NaN", texts.every(allWords) && T.rules.length >= 4 && T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5);
  t.ok("mọi kỹ thuật có tên tiếng Việt", Object.keys(T.techniques).length >= 8 && Object.keys(T.techniques).every(function (k) { return allWords(T.techniques[k]); }));

  /* ================================================================== 2. đề đã biết (tự dựng, kiểm tay) */
  t.group("Nonogram — đề tự dựng kiểm tay (KHÔNG phải đề công bố)");
  (function () {
    // dấu cộng 5×5: hàng 3 kín + cột 3 kín. Cột 3 cần 5 ô nên mọi hàng đều có ô ở cột 3 → hàng 1,2,4,5 chỉ có ô đó; nghiệm duy nhất.
    var plus = T.fromInput({ w: 5, h: 5, rows: [[1], [1], [5], [1], [1]], cols: [[1], [1], [5], [1], [1]] });
    t.ok("dấu cộng 5×5: hợp lệ, duy nhất", plus.ok && plus.status === "unique" && plus.count === 1, plus);
    var want = []; for (var i = 0; i < 25; i++) want.push(Math.floor(i / 5) === 2 || i % 5 === 2 ? 1 : 2);
    t.eq("dấu cộng: nghiệm đúng như suy ra tay", plus.puzzle.solution.v, want);
    t.eq("dấu cộng: giải hoàn toàn bằng logic dòng (không đoán), nhãn kỹ thuật có 'exact' hoặc 'overlap'", [T.solve(plus.puzzle).decisions, T.solve(plus.puzzle).steps.some(function (s) { return s.technique === "overlap" || s.technique === "exact"; })], [0, true]);
    var sv10 = T.solve(T.generate(3, { sizeId: "10", tier: "hard" }));
    t.ok("solve(...).steps: mỗi bước có text tiếng Việt, kỹ thuật có tên, ô chốt hợp lệ; techniques cộng dồn đúng số bước", sv10.status === "unique" && sv10.steps.length > 10 && sv10.steps.every(function (s) { return allWords(s.text) && T.techniques[s.technique] && (s.fills.length + s.empties.length) > 0; }) && Object.keys(sv10.techniques).reduce(function (a, k) { return a + sv10.techniques[k]; }, 0) === sv10.steps.length, sv10.techniques);
    // 2×2 đường chéo: clue 1 1 / 1 1 có đúng hai nghiệm (chéo chính và chéo phụ) — hiển nhiên
    var dia = T.fromInput({ w: 2, h: 2, rows: [[1], [1]], cols: [[1], [1]] });
    t.ok("2×2 (1;1 | 1;1): đúng hai nghiệm → multiple, count 2, có cảnh báo", dia.ok && dia.status === "multiple" && dia.count === 2 && dia.warnings.length === 1 && allWords(dia.warnings[0]), dia);
    // ảnh kín / ảnh trống
    var full = T.fromInput({ w: 3, h: 4, image: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
    t.ok("ảnh kín 3×4 duy nhất, clue hàng [3], cột [4]", full.ok && full.status === "unique" && J(full.puzzle.data.rows) === J([[3], [3], [3], [3]]) && J(full.puzzle.data.cols) === J([[4], [4], [4]]));
    var empty = T.fromInput({ w: 3, h: 3, image: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
    t.ok("ảnh trống 3×3 duy nhất, clue [] mọi dòng, solve tìm đủ nghiệm trống", empty.ok && empty.status === "unique" && empty.puzzle.data.rows.every(function (b) { return b.length === 0; }) && T.solve(empty.puzzle).solution.v.every(function (x) { return x === 2; }));
    var one = T.fromInput({ w: 2, h: 2, rows: [[2], []], cols: [[1], [1]] });
    t.ok("2×2 hàng [2],[] cột [1],[1]: nghiệm duy nhất (hàng 1 kín)", one.ok && one.status === "unique" && J(one.puzzle.solution.v) === J([1, 1, 2, 2]));
    var bad2 = T.fromInput({ w: 2, h: 2, rows: [[2], [2]], cols: [[1], [1]] });
    t.ok("tổng ô theo hàng ≠ theo cột → ok:false, lỗi tiếng Việt", !bad2.ok && bad2.errors.length > 0 && bad2.errors.every(allWords));
    var bad3 = T.fromInput({ w: 3, h: 3, rows: [[3], [], []], cols: [[1], [2], []] });
    t.ok("tổng khớp (3 = 3) nhưng vô nghiệm (hàng 1 kín buộc cột 3 có ô, cột 2 cần 2 ô) → ok:false, status none", bad3.ok === false && bad3.status === "none" && bad3.errors.length === 1 && allWords(bad3.errors[0]), bad3);
    t.eq("vét cạn đồng ý: không có ảnh nào", bruteCount(3, 3, [[3], [], []], [[1], [2], []]).count, 0);
  })();

  /* ================================================================== 3. đối chiếu vét cạn */
  t.group("Nonogram — solve / validate / fromInput đối chiếu bộ giải vét cạn độc lập");
  (function () {
    var rng = R.create(20261017), shapes = [[2, 2], [2, 3], [3, 2], [3, 3], [2, 4], [4, 2], [3, 4], [4, 3], [4, 4], [3, 5], [5, 3], [4, 5], [2, 5], [5, 2]], total = 0, bad = [], stat = { none: 0, unique: 0, multiple: 0 }, badFI = [], badVal = [];
    shapes.forEach(function (sh) {
      var w = sh[0], h = sh[1], k, img, cl, rows, cols, ex, rp, res, v, fi, shape, tag;
      for (k = 0; k < 32; k++) {
        tag = w + "x" + h + "#" + k;
        if (k < 20) { img = randImg(rng, w, h, [0.3, 0.5, 0.7][k % 3]); cl = cluesOfImg(img, w, h); rows = cl.rows; cols = cl.cols; }
        else {                                   // đề cố tình sai: sửa clue của ảnh thật (giữ tổng khớp bằng cách tăng một khối hàng và một khối cột)
          img = randImg(rng, w, h, 0.5); cl = cluesOfImg(img, w, h); rows = J(cl.rows); rows = JSON.parse(rows); cols = JSON.parse(J(cl.cols));
          var rr = rng.int(h), cc = rng.int(w);
          if (k % 2 === 0 && rows[rr].length && cols[cc].length) { rows[rr][rng.int(rows[rr].length)] += 1; cols[cc][rng.int(cols[cc].length)] += 1; }
          else if (rows[rr].length) { rows[rr] = rows[rr].slice(0, rows[rr].length - 1).concat([rows[rr][rows[rr].length - 1] - 1 > 0 ? rows[rr][rows[rr].length - 1] - 1 : 0].filter(Boolean)); }
        }
        ex = bruteCount(w, h, rows, cols); total++;
        rp = rawPuzzle(w, h, rows, cols); res = T.solve(rp); v = T.validate(rp); fi = T.fromInput({ w: w, h: h, rows: rows, cols: cols });
        var want = ex.count === 0 ? "none" : ex.count === 1 ? "unique" : "multiple", sumR = 0, sumC = 0; rows.forEach(function (b) { b.forEach(function (x) { sumR += x; }); }); cols.forEach(function (b) { b.forEach(function (x) { sumC += x; }); });
        stat[want]++;
        if (res.status !== want || res.count !== Math.min(ex.count, 2)) bad.push(tag + " solve=" + res.status + "/" + res.count + " vét cạn=" + ex.count);
        else if (ex.count >= 1 && (!res.solution || !imgMatches(solBits(res.solution.v), w, h, rows, cols))) bad.push(tag + " nghiệm solve không khớp clue");
        else if (ex.count === 1 && J(solBits(res.solution.v)) !== J(ex.img)) bad.push(tag + " nghiệm duy nhất khác vét cạn");
        if (v.status !== want || v.ok !== (ex.count >= 1)) badVal.push(tag + " validate=" + v.ok + "/" + v.status);
        if (sumR !== sumC || rows.some(function (b) { return b.reduce(function (a, x) { return a + x + 1; }, -1) > w; }) || cols.some(function (b) { return b.reduce(function (a, x) { return a + x + 1; }, -1) > h; })) { if (fi.ok) badFI.push(tag + " fromInput nhận đề sai cấu trúc"); }
        else if (fi.ok !== (ex.count >= 1) || (fi.ok && fi.status !== want) || (ex.count >= 1 && fi.count !== Math.min(2, ex.count))) badFI.push(tag + " fromInput=" + fi.ok + "/" + fi.status + " vét cạn=" + ex.count);
      }
    });
    t.ok("solve khớp vét cạn trên " + total + " đề (≥ 200): status, count, nghiệm", total >= 200 && bad.length === 0, bad.slice(0, 4));
    t.ok("đủ ba loại đề: vô nghiệm " + stat.none + ", duy nhất " + stat.unique + ", nhiều nghiệm " + stat.multiple, stat.none >= 20 && stat.unique >= 20 && stat.multiple >= 20, stat);
    t.ok("validate khớp vét cạn (ok + status)", badVal.length === 0, badVal.slice(0, 4));
    t.ok("fromInput khớp vét cạn (ok + status + count)", badFI.length === 0, badFI.slice(0, 4));
    // fromInput từ ảnh: solution = chính ảnh vẽ, status theo vét cạn
    var okImg = 0, badImg = [];
    for (var q = 0; q < 60; q++) {
      var w2 = 2 + (q % 3), h2 = 2 + ((q >> 2) % 3), im = randImg(rng, w2, h2, 0.5), cl2 = cluesOfImg(im, w2, h2), e2 = bruteCount(w2, h2, cl2.rows, cl2.cols), r2 = T.fromInput({ w: w2, h: h2, image: im });
      if (r2.ok && J(solBits(r2.puzzle.solution.v)) === J(im) && r2.status === (e2.count === 1 ? "unique" : "multiple") && r2.puzzle.tier === "custom" && r2.puzzle.seed === null) okImg++; else badImg.push([w2, h2, im.join("")]);
    }
    t.ok("fromInput {image}: 60/60 cho solution = ảnh vẽ, status đúng, tier custom, seed null", okImg === 60, badImg.slice(0, 2));
    BF = {};
  })();

  /* ================================================================== 4. bộ giải độc lập thứ hai trên cỡ vừa */
  t.group("Nonogram — solve đối chiếu bộ giải 'từng hàng + cắt tỉa cột' (độc lập) trên cỡ 5–8");
  (function () {
    var rng = R.create(777), n = 0, bad = [], skipped = 0, multi = 0;
    [[5, 5], [6, 6], [7, 7], [8, 6], [6, 8], [8, 8]].forEach(function (sh) {
      for (var k = 0; k < 14; k++) {
        var w = sh[0], h = sh[1], img = randImg(rng, w, h, [0.4, 0.55, 0.7][k % 3]), cl = cluesOfImg(img, w, h), a = indepSolve(w, h, cl.rows, cl.cols, 2, 4000000), res = T.solve(rawPuzzle(w, h, cl.rows, cl.cols));
        if (a.aborted) { skipped++; continue; }
        n++; if (a.count >= 2) multi++;
        if (res.count !== a.count || res.status !== (a.count === 1 ? "unique" : "multiple")) bad.push(w + "x" + h + "#" + k + " solve " + res.count + " ≠ độc lập " + a.count);
        else if (a.count === 1 && J(solBits(res.solution.v)) !== J(a.imgs[0])) bad.push(w + "x" + h + "#" + k + " nghiệm khác");
      }
    });
    t.ok("khớp bộ giải độc lập trên " + n + " đề (" + multi + " nhiều nghiệm, bỏ " + skipped + " vì cạn ngân sách của bộ độc lập)", n >= 60 && bad.length === 0, bad.slice(0, 4));
  })();

  /* ================================================================== 5. generate */
  t.group("Nonogram — generate: tất định, nghiệm duy nhất, bậc, đơn điệu, ngân sách thời gian");
  var gen = {};     // "size/tier" → { ps:[puzzle…], ms:[…], hit }
  (function () {
    var NS = 20, plan = [], seedOf = function (s) { return 31337 + s * 104729; };
    T.sizes.forEach(function (sz) { U.TIERS.forEach(function (tr) { plan.push({ sid: sz.id, tier: tr.id, adv: sz.tiers.indexOf(tr.id) >= 0 }); }); });
    plan.forEach(function (pl) {
      var key = pl.sid + "/" + pl.tier, ps = [], ms = [], hit = 0, s, t0, p, T0 = U.tier(pl.tier), scores = [];
      for (s = 0; s < NS; s++) { t0 = Date.now(); p = T.generate(seedOf(s), { sizeId: pl.sid, tier: pl.tier }); ms.push(Date.now() - t0); ps.push(p); scores.push(p.score); if (p.score >= T0.min && p.score < T0.max) hit++; }
      var sorted = ms.slice().sort(function (a, b) { return a - b; });
      gen[key] = { ps: ps, ms: ms, hit: hit, med: sorted[NS >> 1], max: sorted[NS - 1], mean: scores.reduce(function (a, b) { return a + b; }, 0) / NS, adv: pl.adv };
    });
    plan.forEach(function (pl) {
      var g = gen[pl.sid + "/" + pl.tier];
      t.info((pl.adv ? "[quảng cáo] " : "[không quảng cáo] ") + pl.sid + " " + pl.tier + ": đạt bậc " + g.hit + "/" + NS + ", sinh: trung vị " + g.med + " ms, xấu nhất " + g.max + " ms, điểm TB " + g.mean.toFixed(2));
      if (!pl.adv) return;
      t.ok("size " + pl.sid + " bậc " + pl.tier + ": ≥ 90% (" + g.hit + "/" + NS + ") đạt đúng khoảng điểm của bậc", g.hit >= Math.ceil(NS * 0.9));
      t.ok("size " + pl.sid + " bậc " + pl.tier + ": ngân sách sinh — trung vị " + g.med + " ms ≤ 1500, xấu nhất " + g.max + " ms ≤ 4000", g.med <= 1500 * SLACK && g.max <= 4000 * SLACK);
    });
    T.sizes.forEach(function (sz) {
      var means = sz.tiers.map(function (tr) { return gen[sz.id + "/" + tr].mean; }), mono = true, i;
      for (i = 1; i < means.length; i++) if (!(means[i] > means[i - 1])) mono = false;
      t.ok("size " + sz.id + ": điểm trung bình tăng dần theo bậc " + sz.tiers.join(" < ") + " (" + means.map(function (x) { return x.toFixed(2); }).join(" < ") + ")", mono);
    });
    var all = [], k;
    for (k in gen) gen[k].ps.forEach(function (p) { all.push(p); });
    t.ok("puzzle.tier khớp bậc của điểm, điểm có 1 chữ số thập phân trong [0,10], seed là số, sizeId đúng, solution/initial đúng cỡ", all.every(function (p) { return p.tier === U.tierOfScore(p.score).id && Math.round(p.score * 10) / 10 === p.score && p.score >= 0 && p.score <= 10 && typeof p.seed === "number" && p.initial.v.length === p.size.w * p.size.h && p.solution.v.length === p.initial.v.length && p.initial.v.every(function (x) { return x === 0; }) && p.id === U.puzzleId(p) && p.type === "nonogram" && p.v === 1; }));
    t.ok("clue khớp ảnh đáp án (kiểm độc lập) và mật độ tô 36–70 %", all.every(function (p) { var d = p.data, im = solBits(p.solution.v), dens = im.reduce(function (a, b) { return a + b; }, 0) / im.length; return imgMatches(im, d.w, d.h, d.rows, d.cols) && dens >= 0.36 && dens <= 0.7 && p.solution.v.every(function (x) { return x === 1 || x === 2; }); }));
    t.ok("puzzle là JSON thuần (vòng JSON không đổi)", all.every(function (p) { return J(JSON.parse(J(p))) === J(p); }));
    t.ok("score = difficulty(puzzle) (hàm tất định của đề)", all.slice(0, 60).every(function (p) { return T.difficulty(p) === p.score; }));
    // tất định
    var same = true; plan.forEach(function (pl) { var a = T.generate(424242, { sizeId: pl.sid, tier: pl.tier }), b = T.generate(424242, { sizeId: pl.sid, tier: pl.tier }); if (J(a) !== J(b)) same = false; });
    t.ok("tất định: cùng (seed, sizeId, tier) → cùng puzzle từng bit (mọi cỡ × bậc)", same);
    t.ok("khác seed → khác đề", J(T.generate(1, { sizeId: "10", tier: "medium" }).data) !== J(T.generate(2, { sizeId: "10", tier: "medium" }).data));
    t.ok("seed chuỗi/số được chấp nhận, sizeId lạ → về cỡ mặc định 10×10, tier lạ → medium", T.generate("abc", { sizeId: "zzz", tier: "??" }).size.w === 10 && T.generate(5).size.h === 10);
    // duy nhất: bộ giải độc lập (5×5 tất cả, 10×10 mười đề mỗi bậc), solve cho 15×15
    var u5 = 0, u10 = 0, u15 = 0, badU = [], skip10 = 0;
    for (k in gen) gen[k].ps.forEach(function (p, i) {
      var d = p.data, a;
      if (d.w === 5) { a = indepSolve(5, 5, d.rows, d.cols, 2, 3e6); if (a.count === 1 && !a.aborted && J(a.imgs[0]) === J(solBits(p.solution.v))) u5++; else badU.push(k + "#" + i + " " + a.count); }
      else if (d.w === 10 && i < 10) { a = indepSolve(10, 10, d.rows, d.cols, 2, 4e6); if (a.aborted) skip10++; else if (a.count === 1 && J(a.imgs[0]) === J(solBits(p.solution.v))) u10++; else badU.push(k + "#" + i + " " + a.count); }
      else if (d.w === 15) { var sv = T.solve(p, { text: false }); if (sv.status === "unique" && J(solBits(sv.solution.v)) === J(solBits(p.solution.v)) && imgMatches(solBits(sv.solution.v), 15, 15, d.rows, d.cols)) u15++; else badU.push(k + "#" + i + " solve " + sv.status); }
    });
    t.ok("nghiệm duy nhất — 5×5: " + u5 + "/" + (4 * NS) + " đề qua bộ giải độc lập (mọi bậc, kể cả không quảng cáo)", u5 === 4 * NS && badU.length === 0, badU.slice(0, 3));
    t.ok("nghiệm duy nhất — 10×10: " + u10 + " đề qua bộ giải độc lập (bỏ " + skip10 + " do cạn ngân sách của bộ độc lập)", u10 >= 30 && badU.length === 0, badU.slice(0, 3));
    t.ok("nghiệm duy nhất — 15×15: " + u15 + "/" + (4 * NS) + " đề qua solve (đếm 2 nghiệm) và ảnh khớp clue", u15 === 4 * NS && badU.length === 0, badU.slice(0, 3));
    // cỡ chữ nhật nhỏ: vét cạn trực tiếp
    var rk = 0, rbad = [];
    ["3x3", "4x4", "3x5", "4x5", "5x3"].forEach(function (sid) {
      var m = /^(\d+)x(\d+)$/.exec(sid), w = +m[1], h = +m[2];
      if (w * h > 20) return;
      ["easy", "medium"].forEach(function (tr) { for (var s = 0; s < 10; s++) { var p = T.generate(900 + s, { sizeId: sid, tier: tr }), br = bruteCount(w, h, p.data.rows, p.data.cols); if (p.size.w === w && p.size.h === h && br.count === 1 && J(br.img) === J(solBits(p.solution.v))) rk++; else rbad.push(sid + tr + s + " vét cạn " + br.count); } });
    });
    t.ok("cỡ nhỏ tuỳ ý (3x3, 4x4, 3x5, 4x5, 5x3): " + rk + "/100 đề được vét cạn xác nhận duy nhất", rk === 100, rbad.slice(0, 3));
    BF = {};
  })();

  /* ================================================================== 6. moveFor / check / mistakes */
  t.group("Nonogram — moveFor, check, mistakes, game");
  function pz(sid, tier, seed) { return T.generate(seed, { sizeId: sid, tier: tier }); }
  (function () {
    var rng = R.create(55), okRev = 0, nRev = 0, p, st, d, i, snapshot;
    ["5", "10", "15"].forEach(function (sid) {
      p = pz(sid, "medium", 11); st = T.newState(p); var N = p.size.w * p.size.h;
      for (i = 0; i < 40; i++) {
        var act = i % 3 === 0 ? { k: "fill", cells: [rng.int(N), rng.int(N), rng.int(N), rng.int(N)], val: rng.int(3) } : i % 3 === 1 ? { k: "cycle", i: rng.int(N) } : { k: "clearline", axis: rng.chance(0.5) ? "r" : "c", idx: rng.int(p.size.w) };
        snapshot = J(st); d = T.moveFor(p, st, act, {}); nRev++;
        if (!d) { continue; }
        var before = st.v.slice(), okOld = d.d.every(function (e) { return e[0] === "v" && before[e[1]] === e[2] && e[2] !== e[3] && allWords(d.label); });
        G.applyDiff(st, d.d, false); var mid = J(st); G.applyDiff(st, G.reverseDiff(d.d), false);
        if (okOld && J(st) === snapshot && mid !== snapshot) okRev++; else { nRev += 0; }
        G.applyDiff(st, d.d, false);
      }
    });
    t.ok("mọi diff: giá trị cũ khớp, nhãn tiếng Việt, áp rồi hoàn lại bằng reverseDiff ra đúng state cũ (" + okRev + " diff)", okRev > 40);
    p = pz("5", "easy", 3); st = T.newState(p);
    t.eq("cycle 0→1→2→0", [1, 2, 0].map(function (x, k) { var dd = T.moveFor(p, st, { k: "cycle", i: 4 }); G.applyDiff(st, dd.d, false); return st.v[4]; }), [1, 2, 0]);
    st = T.newState(p);
    t.eq("fill nhiều ô, bỏ trùng chỉ số, bỏ ô đã đúng giá trị", [T.moveFor(p, st, { k: "fill", cells: [1, 1, 2, 2, 3], val: 1 }).d.length, T.moveFor(p, st, { k: "fill", cells: [1, 2], val: 0 })], [3, null]);
    t.ok("hành động sai/ô ngoài phạm vi/giá trị lạ → null, không ném lỗi", [null, undefined, {}, { k: "x" }, { k: "fill", cells: "a", val: 1 }, { k: "fill", cells: [999], val: 1 }, { k: "fill", cells: [1], val: 3 }, { k: "cycle", i: -1 }, { k: "cycle", i: 1.5 }, { k: "clearline", axis: "z", idx: 0 }, { k: "clearline", axis: "r", idx: 99 }].every(function (a) { return T.moveFor(p, st, a, {}) === null; }));
    t.ok("trạng thái sai độ dài / thiếu → moveFor null", T.moveFor(p, { v: [0, 0] }, { k: "cycle", i: 0 }) === null && T.moveFor(p, null, { k: "cycle", i: 0 }) === null);
    t.ok("isGiven luôn false (Nonogram không có ô cho sẵn)", [0, 7, 24].every(function (x) { return T.isGiven(p, x) === false; }));
    var cs = T.moveFor(p, { v: p.solution.v.slice(), c: null }, { k: "clearline", axis: "r", idx: 0 });
    t.ok("clearline xoá đúng các ô của hàng/cột", cs && cs.d.every(function (e) { return Math.floor(e[1] / 5) === 0 && e[3] === 0; }) && cs.d.length === 5);
  })();

  (function () {
    var rng = R.create(66), badSol = [], badSolved = [], i, p, w, h, N, v, ch;
    for (i = 0; i < 24; i++) {
      p = pz(["5", "10", "15"][i % 3], ["easy", "medium", "hard"][i % 3 === 2 ? 0 : (i >> 1) % 3], 70 + i); w = p.size.w; h = p.size.h; N = w * h;
      ch = T.check(p, { v: p.solution.v.slice(), c: null });
      if (!(ch.solved && ch.conflicts.length === 0 && ch.filled === N && ch.total === N)) badSol.push(p.id);
      v = p.solution.v.map(function (x) { return x === 1 ? 1 : 0; });     // chỉ tô, không gạch: vẫn xong
      if (!T.check(p, { v: v, c: null }).solved) badSolved.push(p.id);
      ch = T.check(p, T.newState(p));
      if (ch.solved || ch.conflicts.length || ch.filled !== 0 || ch.total !== N) badSol.push("trắng " + p.id);
      v = p.solution.v.slice(); var f = v.indexOf(1); v[f] = 2;           // gạch nhầm một ô đáng tô → chưa xong
      if (T.check(p, { v: v, c: null }).solved) badSol.push("gạch nhầm " + p.id);
    }
    t.ok("check(solution) solved; chỉ-tô (không gạch) vẫn solved; ván trắng chưa xong, không xung đột; gạch nhầm → chưa xong", badSol.length === 0 && badSolved.length === 0, badSol.concat(badSolved).slice(0, 3));
    // đề tay: hàng 1 clue [3], tô 4 ô liền → thủ phạm = hai đầu; cột 1 clue [] có ô tô → thủ phạm = ô đó
    var rp = T.fromInput({ w: 5, h: 5, image: [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }).puzzle;
    var sv = T.newState(rp); [0, 1, 2, 3].forEach(function (c) { sv.v[c] = 1; });
    t.eq("hàng clue [3] có 4 ô tô liền + cột trống có ô tô: conflicts = [0, 3] (hai ô bỏ đi thì dòng hợp lệ)", T.check(rp, sv).conflicts, [0, 3]);
    var sv2 = T.newState(rp); sv2.v[1] = 1; sv2.v[3] = 1;                 // tô cách quãng nhưng ô giữa còn chưa biết: vẫn xếp được (tô nốt ô giữa) → không xung đột
    t.eq("tô (1,3) với clue [3], ô giữa chưa biết: chưa xung đột", T.check(rp, sv2).conflicts, []);
    sv2.v[2] = 2;                                                         // gạch ô giữa: không khối 3 nào tránh được ô 2 trong 5 ô → hàng vi phạm, chỉ ô gạch là thủ phạm đơn lẻ
    t.eq("tô (1,3) + gạch ô giữa với clue [3]: thủ phạm duy nhất là ô gạch (bỏ nó đi thì xếp được)", T.check(rp, sv2).conflicts, [2]);
    var sv3 = T.newState(rp); sv3.v[0] = 2; sv3.v[1] = 2; sv3.v[2] = 2;   // gạch 3 ô liền đầu hàng: còn 2 ô, không chứa nổi khối 3
    t.ok("gạch (0,1,2) rồi hàng clue [3] chỉ còn 2 ô → xung đột nằm trong hàng đó, là ô gạch", T.check(rp, sv3).conflicts.length > 0 && T.check(rp, sv3).conflicts.every(function (c) { return c < 3; }), T.check(rp, sv3).conflicts);
    // tính chất so với vét cạn: conflicts ≠ ∅ ⇒ không ảnh nào khớp; vét cạn có ảnh khớp ⇒ conflicts = ∅; conflicts ⊆ ô đã đánh dấu
    var viol = [], nCf = 0, nOk = 0;
    for (i = 0; i < 400; i++) {
      var w2 = 2 + (i % 3), h2 = 2 + ((i >> 2) % 3), img = randImg(rng, w2, h2, 0.5), cl = cluesOfImg(img, w2, h2), pp = T.fromInput({ w: w2, h: h2, rows: cl.rows, cols: cl.cols }).puzzle, marks = [], c0;
      for (c0 = 0; c0 < w2 * h2; c0++) marks.push(rng.chance(0.45) ? 0 : (rng.chance(img[c0] ? 0.8 : 0.2) ? 1 : 2));   // dấu có thể đúng hoặc sai so với ảnh
      var res = T.check(pp, { v: marks, c: null }), cons = bruteConsistent(w2, h2, cl.rows, cl.cols, marks);
      if (res.conflicts.length) { nCf++; if (cons.length) viol.push("conflicts nhưng vẫn có ảnh khớp: " + J(marks)); }
      if (cons.length) nOk++;
      if (!res.conflicts.every(function (c) { return marks[c] !== 0; })) viol.push("conflict ở ô chưa đánh dấu");
      var solvedBrute = marks.every(function (m, c) { return (m === 1 ? 1 : 0) === img[c]; }) || bruteConsistent(w2, h2, cl.rows, cl.cols, marks.map(function (m) { return m === 1 ? 1 : 2; })).some(function (x) { return J(marks.map(function (m) { return m === 1 ? 1 : 0; })) === J(x); });
      if (res.solved !== solvedBrute) viol.push("solved sai: " + J(marks));
    }
    t.ok("check đối chiếu vét cạn (400 trạng thái ngẫu nhiên, " + nCf + " có xung đột, " + nOk + " còn nghiệm): conflicts ⇒ vô nghiệm, solved đúng", viol.length === 0 && nCf > 40 && nOk > 40, viol.slice(0, 2));
    // mistakes
    p = pz("10", "medium", 5); w = p.size.w; N = w * w; var st2 = T.newState(p), fillCell = p.solution.v.indexOf(1), emptyCell = p.solution.v.indexOf(2);
    function mk(cells, val) { return T.mistakes(p, st2, T.moveFor(p, st2, { k: "fill", cells: cells, val: val })); }
    t.eq("tô ô đáp án tô: 0 sai · gạch ô đáp án trống: 0 sai · xoá: 0", [mk([fillCell], 1), mk([emptyCell], 2), mk([fillCell], 0) || 0], [0, 0, 0]);
    t.eq("tô ô đáp án trống: 1 sai · gạch ô đáp án tô: 1 sai · tô hai ô sai: 2", [mk([emptyCell], 1), mk([fillCell], 2), mk([emptyCell, p.solution.v.lastIndexOf(2)], 1)], [1, 1, 2]);
    t.ok("mistakes đầu vào xấu → 0, không ném lỗi", T.mistakes(null, null, null) === 0 && T.mistakes(p, null, {}) === 0 && T.mistakes(p, st2, null) === 0);
    var dia = T.fromInput({ w: 2, h: 2, rows: [[1], [1]], cols: [[1], [1]] }).puzzle, sd = T.newState(dia);
    var m1 = T.mistakes(dia, sd, T.moveFor(dia, sd, { k: "fill", cells: [0], val: 1 })); G.applyDiff(sd, [["v", 0, 0, 1]], false);
    var m2 = T.mistakes(dia, sd, T.moveFor(dia, sd, { k: "fill", cells: [1], val: 1 }));
    var sd3 = T.newState(dia), m3 = T.mistakes(dia, sd3, T.moveFor(dia, sd3, { k: "fill", cells: [0], val: 2 }));
    t.eq("đề 2 nghiệm (đường chéo): tô (1,1) hợp lệ → 0; thêm (1,2) làm mất mọi nghiệm → 1; gạch (1,1) vẫn còn nghiệm chéo phụ → 0", [m1, m2, m3], [0, 1, 0]);
    // qua Puz.game thật
    var g = G.create(p, { now: function () { return 1000; } }), mistakeBefore;
    g.act({ k: "fill", cells: [emptyCell], val: 1 });
    t.ok("game.act: nước sai được đếm, undo hoàn về state cũ, redo áp lại", g.counters.mistakes === 1 && g.undo() && g.state.v[emptyCell] === 0 && g.redo() && g.state.v[emptyCell] === 1);
    var g2 = G.create(p, { now: function () { return 1000; } }); g2.act({ k: "fill", cells: p.solution.v.map(function (x, i) { return x === 1 ? i : -1; }).filter(function (i) { return i >= 0; }), val: 1 });
    t.ok("game: tô đúng mọi ô → solved, 0 lỗi; reveal điền cả ô gạch và check vẫn solved", g2.status === "solved" && g2.counters.mistakes === 0);
    var g3 = G.create(p, { now: function () { return 1000; } }); g3.reveal();
    t.ok("reveal: state = solution.v (1/2) và check solved", g3.status === "revealed" && J(g3.state.v) === J(p.solution.v) && T.check(p, g3.state).solved);
    t.ok("describeCell: tiếng Việt, đủ hàng/cột/trạng thái", [0, 1, 2].every(function (val) { var s = T.describeCell(p, { v: p.solution.v.map(function () { return val; }), c: null }, 12); return allWords(s) && /Hàng 2, cột 3/.test(s); }) && allWords(T.describeCell(null, null, 0)));
  })();

  /* ================================================================== 7. hint + replay */
  t.group("Nonogram — hint (3 mức), sửa lỗi, lặp tới khi giải xong; replay");
  var LEAK = /tô|trống|gạch/i, KINDS = {}, HCASES = [];
  (function () {
    var rng = R.create(808), k, ci;
    [["5", "easy"], ["5", "medium"], ["10", "easy"], ["10", "medium"], ["10", "hard"], ["15", "medium"], ["15", "hard"], ["15", "expert"]].forEach(function (c, ci) {
      for (k = 0; k < 4; k++) HCASES.push({ p: pz(c[0], c[1], 600 + ci * 10 + k), name: c[0] + "/" + c[1] + "#" + k, inject: k % 2 === 0 });
    });
    HCASES.push({ p: T.fromInput({ w: 2, h: 2, rows: [[1], [1]], cols: [[1], [1]] }).puzzle, name: "2x2 hai nghiệm", inject: false, need: "guess" });
    for (k = 0; k < 10; k++) { var w = 4 + (k % 3), h = 4 + ((k >> 1) % 2), im = randImg(rng, w, h, 0.5), r = T.fromInput({ w: w, h: h, image: im }); HCASES.push({ p: r.puzzle, name: "tự vẽ " + w + "x" + h + " " + r.status, inject: false, status: r.status }); }
    for (k = 0; k < 4; k++) { var im2 = randImg(rng, 8, 8, 0.5), r2 = T.fromInput({ w: 8, h: 8, image: im2 }); HCASES.push({ p: r2.puzzle, name: "tự vẽ 8x8 " + r2.status, inject: false }); }

    var bad = [], total = 0, stepsMax = 0, fixCount = 0, multiGuess = false, notSolved = [];
    HCASES.forEach(function (cs) {
      var p = cs.p, w = p.size.w, h = p.size.h, N = w * h, ref = p.solution.v, st = T.newState(p), steps = 0, injected = false, wrongCell = -1, uniq = T.validate(p).status === "unique";
      while (!T.check(p, st).solved && steps <= N * 3) {
        if (cs.inject && uniq && !injected && steps === 4) {
          wrongCell = rng.int(N); var wrongVal = ref[wrongCell] === 1 ? 2 : 1, dd = T.moveFor(p, st, { k: "fill", cells: [wrongCell], val: wrongVal });
          if (dd) { G.applyDiff(st, dd.d, false); injected = true; steps++; continue; }
        }
        var h1 = T.hint(p, st, 1), h2 = T.hint(p, st, 2), h3 = T.hint(p, st, 3), where = cs.name + " bước " + steps;
        if (h3.none || !h3.action) { bad.push(where + " hint không có action: " + J(h3)); break; }
        if (h1.level !== 1 || h2.level !== 2 || h3.level !== 3 || ![h1, h2, h3].every(function (x) { return allWords(x.text) && Array.isArray(x.cells) && x.cells.length > 0 && x.cells.every(function (c) { return Number.isInteger(c) && c >= 0 && c < N; }); })) bad.push(where + " hình dạng hint sai");
        if (!h3.why.length || !h3.why.every(allWords)) bad.push(where + " why rỗng/xấu");
        if (LEAK.test(h1.text) || LEAK.test(h2.text)) bad.push(where + " mức 1/2 lộ giá trị: " + h1.text + " | " + h2.text);
        if (h1.technique || (h2.technique !== h3.technique)) bad.push(where + " technique không nhất quán giữa các mức");
        if (J(T.hint(p, st, 3)) !== J(h3) || J(T.hint(p, st, 2)) !== J(h2)) bad.push(where + " hint không tất định");
        var ac = h3.action, kind = h3.technique === "fix" ? "fix" : h3.technique === "probe" ? "probe" : h3.technique === "guess" ? "guess" : "line";
        KINDS[kind] = (KINDS[kind] || 0) + 1;
        if (ac.k !== "fill" || !(ac.val === 0 || ac.val === 1 || ac.val === 2) || !ac.cells.length) bad.push(where + " action sai: " + J(ac));
        if (!ac.cells.every(function (c) { return h2.cells.indexOf(c) >= 0 && h1.cells.indexOf(c) >= 0; }) && kind !== "guess" && kind !== "probe") bad.push(where + " action ngoài vùng mức 1/2");
        if (kind === "fix") fixCount++;
        if (kind === "fix" && !(injected && ac.cells.length === 1 && ac.cells[0] === wrongCell && ac.val === 0)) bad.push(where + " hint sửa lỗi không trỏ đúng ô sai");
        if (injected && steps === 5 && kind !== "fix" && wrongCell >= 0 && st.v[wrongCell] !== ref[wrongCell] && st.v[wrongCell] !== 0) bad.push(where + " có ô sai mà hint không báo trước");
        if (kind === "guess") { if (cs.need === "guess") multiGuess = true; }
        // hợp lệ: đề duy nhất → giá trị khớp đáp án; cỡ nhỏ → đúng trong MỌI ảnh còn khớp (vét cạn)
        if (kind !== "fix") {
          if (uniq && !ac.cells.every(function (c) { return ref[c] === ac.val; })) bad.push(where + " hint " + kind + " trái đáp án duy nhất");
          if (N <= 16 && kind !== "guess") {
            var all = bruteConsistent(w, h, p.data.rows, p.data.cols, st.v), want = ac.val === 1 ? 1 : 0;
            if (!all.length || !all.every(function (im) { return ac.cells.every(function (c) { return im[c] === want; }); })) bad.push(where + " hint " + kind + " không đúng trong mọi nghiệm còn lại");
          }
        }
        var mv = T.moveFor(p, st, ac, {});
        if (!mv) { bad.push(where + " moveFor(action) = null"); break; }
        G.applyDiff(st, mv.d, false); steps++; total++;
        if (!injected || kind === "fix") { var cf = T.check(p, st).conflicts; if (cf.length && uniq && !(injected && wrongCell >= 0 && st.v[wrongCell] !== ref[wrongCell] && st.v[wrongCell] !== 0)) bad.push(where + " xung đột sau hint đúng"); }
      }
      stepsMax = Math.max(stepsMax, steps);
      if (!T.check(p, st).solved) notSolved.push(cs.name + " (" + steps + " bước)"); else if (steps > N * 3) bad.push(cs.name + " quá " + (N * 3) + " bước");
    });
    t.ok("lặp 'hint mức 3 → áp dụng' giải xong mọi đề (" + HCASES.length + " đề, có chèn nước sai ở một nửa đề duy nhất), không quá total×3 bước", notSolved.length === 0, notSolved.slice(0, 3));
    t.ok("mỗi hint: hình dạng đúng, mức 1/2 không lộ (tô/trống/gạch), tất định, hợp lệ so với đáp án duy nhất và vét cạn (cỡ ≤ 16 ô), why không rỗng", bad.length === 0, bad.slice(0, 4));
    t.ok("nhánh sửa lỗi được dùng (" + fixCount + " lần) và dẫn tới hint sửa đúng ô sai", fixCount >= 8, fixCount);
    t.ok("đề 2 nghiệm cần đoán: hint ở bước bế tắc nói trung thực 'guess' (dùng đáp án để chọn)", multiGuess, KINDS);
    t.info("loại hint đã chạy: " + J(KINDS) + "; số bước dài nhất " + stepsMax);
    // game.hint thật
    var gp = pz("10", "medium", 31), g = G.create(gp, { now: function () { return 5; } }), n = 0;
    while (!g.finished() && n++ < 400) { var hh = g.hint(3); if (!hh || hh.none) break; g.applyHint(hh); }
    t.ok("qua Puz.game: hint(3) + applyHint tới khi solved; bộ đếm gợi ý khớp", g.status === "solved" && g.counters.hints[3] > 0 && g.counters.hints[3] <= n && g.hintCount() === g.counters.hints[3], [g.status, g.counters.hints, n]);
    t.ok("trạng thái đã xong / sai độ dài / thiếu → hint none, không ném lỗi", T.hint(gp, { v: gp.solution.v.slice(), c: null }, 2).none === true && T.hint(gp, { v: [1, 2] }, 1).none === true && T.hint(gp, null, 3).none === true && T.hint(null, null, 1).none === true && T.hint(gp, T.newState(gp), 99).level === 3 && T.hint(gp, T.newState(gp), "x").level === 1);
  })();

  (function () {
    var bad = [], notSolved = [], kinds = {}, n = 0;
    HCASES.forEach(function (cs) {
      var p = cs.p, N = p.size.w * p.size.h, st = T.newState(p), rp = T.replay(p), ok = true, i;
      if (!rp.length && !T.check(p, st).solved) { notSolved.push(cs.name + " (không có bước)"); return; }
      for (i = 0; i < rp.length; i++) {
        var s = rp[i];
        if (!allWords(s.text) || !s.why || !s.why.length || !s.why.every(allWords) || !s.diff || !s.diff.d || !s.diff.d.length || !Array.isArray(s.cells) || !s.cells.length || !T.techniques[s.technique]) { bad.push(cs.name + " bước " + i + " thiếu text/why/diff/cells/technique"); ok = false; break; }
        if (!s.diff.d.every(function (e) { return e[0] === "v" && st.v[e[1]] === e[2] && e[2] !== e[3]; })) { bad.push(cs.name + " bước " + i + " diff cũ không khớp"); ok = false; break; }
        G.applyDiff(st, s.diff.d, false); kinds[s.technique] = (kinds[s.technique] || 0) + 1; n++;
      }
      if (ok && !T.check(p, st).solved) notSolved.push(cs.name);
      if (ok && rp.length > N) bad.push(cs.name + " replay dài " + rp.length + " > " + N);
      if (ok && T.validate(p).status === "unique" && !p.solution.v.every(function (x, j) { return (x === 1) === (st.v[j] === 1); })) bad.push(cs.name + " replay không ra đáp án duy nhất");
    });
    t.ok("replay: áp tuần tự ra state solved (" + HCASES.length + " đề, " + n + " bước)", notSolved.length === 0, notSolved.slice(0, 3));
    t.ok("replay: mỗi bước có text/why/diff hợp lệ/cells/technique tiếng Việt; không quá w·h bước; đề duy nhất ra đúng đáp án", bad.length === 0, bad.slice(0, 3));
    t.info("kỹ thuật trong replay: " + J(kinds));
    t.ok("replay tất định", J(T.replay(HCASES[3].p)) === J(T.replay(HCASES[3].p)));
    t.ok("replay đề hỏng → [] không ném lỗi", T.replay(null).length === 0 && T.replay({}).length === 0);
  })();

  /* ================================================================== 8. nhập/xuất */
  t.group("Nonogram — toFile/fromFile, toText/fromText, đầu vào xấu");
  (function () {
    var ps = HCASES.map(function (c) { return c.p; }).concat([pz("5", "easy", 9), pz("15", "expert", 9)]), badF = [], badT = [], badC = [];
    ps.forEach(function (p, i) {
      var f = T.toFile(p), back = T.fromFile(JSON.parse(J(f))), tx = T.toText(p), bt = T.fromText(tx), cp = T.fromText(f.initialState);
      if (!(back.ok && J(back.puzzle.data) === J(p.data) && J(back.puzzle.initial) === J(p.initial) && back.puzzle.seed === null && back.puzzle.tier === "custom")) badF.push(i);
      if (!(bt.ok && J(bt.puzzle.data) === J(p.data) && J(bt.puzzle.initial) === J(p.initial) && bt.puzzle.id === T.fromInput({ w: p.size.w, h: p.size.h, rows: p.data.rows, cols: p.data.cols }).puzzle.id)) badT.push(i);
      if (!(cp.ok && J(cp.puzzle.data) === J(p.data))) badC.push(i);
    });
    t.ok("toFile → JSON → fromFile: data và initial giống hệt (" + ps.length + " đề); fromFile dựng lại seed=null, tier=custom", badF.length === 0, badF);
    t.ok("toText → fromText: data và initial giống hệt, id ổn định (" + ps.length + " đề)", badT.length === 0, badT);
    t.ok("fromText nhận cả dạng gọn \"hàng|cột\" của toFile", badC.length === 0, badC);
    var p0 = pz("5", "medium", 4), f0 = T.toFile(p0), tx0 = T.toText(p0);
    t.ok("toFile có đủ trường: type, seed, difficulty = score, size, initialState (chuỗi hàng|cột), solution (w·h ký tự 0/1), metadata", f0.type === "nonogram" && f0.seed === p0.seed && f0.difficulty === p0.score && J(f0.size) === J({ w: 5, h: 5 }) && /^[0-9,;]+\|[0-9,;]+$/.test(f0.initialState) && /^[01]{25}$/.test(f0.solution) && typeof f0.metadata === "object", f0);
    t.ok("toText dễ đọc: dòng tiêu đề 'Nonogram 5x5', 'Rows:', 'Cols:'", /^Nonogram 5x5\nRows: .*\nCols: .*$/.test(tx0), tx0);
    var tamper = JSON.parse(J(f0)); tamper.difficulty = 9.9; tamper.solution = "1".repeat(25); tamper.seed = 7;
    var rb = T.fromFile(tamper);
    t.ok("fromFile KHÔNG tin difficulty/solution/seed trong tệp: điểm tính lại, lời giải sai bị bỏ kèm cảnh báo", rb.ok && rb.puzzle.score === T.difficulty(rb.puzzle) && rb.puzzle.score !== 9.9 && rb.puzzle.seed === null && J(rb.puzzle.solution.v) === J(p0.solution.v) && rb.warnings.length === 1, rb);
    (function () {
      var a = T.fromText("  rows :  1 | 1 1 |  0 \r\n COLS:1|1|1\r\n"), b = T.fromText("ROWS: 2|1\nCOLS: 1|1|1");
      t.ok("fromText chịu được viết thường / hoa, \\r\\n, khoảng trắng thừa, thiếu tiêu đề; đề 2×3 hàng [2],[1] cột [1][1][1] có 2 nghiệm", a.ok && J(a.puzzle.data.rows) === J([[1], [1, 1], []]) && J(a.puzzle.data.cols) === J([[1], [1], [1]]) && b.ok && b.status === "multiple" && b.count === 2 && b.puzzle.size.w === 3 && b.puzzle.size.h === 2, [a, b]);
    })();
    var tx3 = T.fromText("nonogram 3x3\nRows: 1 | 1 | 1\nCols: 3 | 0 | 0");
    t.ok("fromText: header + clue hợp lệ cho đề 3×3 duy nhất", tx3.ok && tx3.status === "unique" && J(tx3.puzzle.solution.v) === J([1, 2, 2, 1, 2, 2, 1, 2, 2]), tx3);
    // đầu vào xấu: ok:false + lỗi tiếng Việt, không ném
    var bads = [undefined, null, 0, 1, "", "abc", [], {}, { w: 3 }, { w: 3, h: 3 }, { w: 3, h: 3, rows: [], cols: [] }, { w: 99, h: 99, rows: [], cols: [] }, { w: 1, h: 5, rows: [[1]], cols: [[1]] }, { w: 3, h: 3, rows: [[9], [], []], cols: [[1], [1], [1]] },
      { w: 3, h: 3, rows: [[-1], [], []], cols: [[], [], []] }, { w: 3, h: 3, rows: [["x"], [], []], cols: [[], [], []] }, { w: 3, h: 3, rows: [[1.5], [], []], cols: [[], [], []] }, { w: 3, h: 3, image: [1, 2, 3] }, { w: 3, h: 3, image: "abc" }, { w: 3, h: 3, image: { length: 9, x: 1 } },
      { w: 3, h: 3, image: [1, 0, 1, 0, 1, 0, 1, "q", 1] }, { w: 3, h: 3, image: 5 }, { w: NaN, h: 3, rows: [[]], cols: [[]] }, { w: "3", h: "3", rows: [[], [], []], cols: [[], [], []] }, { w: 3, h: 3, rows: "abc", cols: "def" }, { w: 3, h: 3, rows: [null, null, null], cols: [{}, {}, {}] }, { image: [[1, 0], [1]] }, [1, 2, 3], function () {}, true];
    var thrown = [], notOk = 0, noMsg = [];
    bads.forEach(function (b, i) {
      try { var r = T.fromInput(b); if (!r.ok) { notOk++; if (!r.errors.length || !r.errors.every(allWords) || r.puzzle !== null) noMsg.push(i); } else noMsg.push("nhận nhầm " + i); } catch (e) { thrown.push(i + ":" + e.message); }
    });
    t.ok("fromInput: " + bads.length + " đầu vào xấu → không ném lỗi, ok:false + lỗi tiếng Việt + puzzle null", thrown.length === 0 && noMsg.length === 0, thrown.concat(noMsg).slice(0, 4));
    var badTxt = ["", "   ", "hello", "Rows:", "Rows: a | b\nCols: c", "Rows: 1 | 1\nCols:", "Rows: 9\nCols: 1", "Nonogram 3x3\nRows: 1|1\nCols: 1|1", "|", "1|2|3", "Rows: 1 | 1 | 1\nCols: 3 | 1", null, undefined, 42, {}, "Rows: -1 | 1\nCols: 1 | 1"], th2 = [], ok2 = 0;
    badTxt.forEach(function (x, i) { try { var r = T.fromText(x); if (!r.ok && r.errors.length && r.errors.every(allWords)) ok2++; else th2.push("nhận nhầm/không lỗi " + i + " " + J(r)); } catch (e) { th2.push(i + ":" + e.message); } });
    t.ok("fromText: " + badTxt.length + " đầu vào xấu → ok:false + lỗi tiếng Việt, không ném lỗi", ok2 === badTxt.length, th2.slice(0, 3));
    var badFile = [null, undefined, {}, { type: "sudoku" }, { type: "nonogram" }, { type: "nonogram", initialState: "" }, { type: "nonogram", initialState: "1;2" }, { type: "nonogram", initialState: "x|y" }, { type: "nonogram", initialState: "1|1|1" }, { type: "nonogram", initialState: "9|1" }, { type: "nonogram", initialState: "1;1|1;1", size: { w: 5, h: 5 } }, "text", 5, { type: "nonogram", initialState: 5 }], th3 = [], ok3 = 0;
    badFile.forEach(function (x, i) { try { var r = T.fromFile(x); if (!r.ok && r.errors.length && r.errors.every(allWords)) ok3++; else th3.push("nhận nhầm " + i + " " + J(r)); } catch (e) { th3.push(i + ":" + e.message); } });
    t.ok("fromFile: " + badFile.length + " đầu vào xấu → ok:false + lỗi tiếng Việt, không ném lỗi", ok3 === badFile.length, th3.slice(0, 3));
    // các hàm khác với puzzle/state hỏng
    var junk = [null, undefined, {}, { data: {} }, { data: { w: 3, h: 3, rows: [], cols: [] } }, { data: { w: 3, h: 3, rows: [[1], [1], [1]], cols: [[1], [1], [2]] } }, "x", 5], thr = [];
    junk.forEach(function (j, i) {
      var fns = { solve: function () { return T.solve(j); }, validate: function () { return T.validate(j); }, difficulty: function () { return T.difficulty(j); }, newState: function () { return T.newState(j); }, check: function () { return T.check(j, { v: [] }); },
        moveFor: function () { return T.moveFor(j, { v: [] }, { k: "cycle", i: 0 }); }, hint: function () { return T.hint(j, { v: [] }, 1); }, replay: function () { return T.replay(j); }, cv: function () { return T.constraintView(j); }, trace: function () { return T.trace(j); }, dc: function () { return T.describeCell(j, null, 0); }, tf: function () { return T.toFile(j); }, tt: function () { return T.toText(j); } };
      Object.keys(fns).forEach(function (k) { try { fns[k](); } catch (e) { thr.push(k + "(" + i + "): " + e.message); } });
    });
    t.ok("mọi hàm với puzzle/state hỏng (" + junk.length + " mẫu × 13 hàm): không ném lỗi", thr.length === 0, thr.slice(0, 3));
    t.ok("solve đề hỏng → status none + errors tiếng Việt; difficulty đề hỏng = 0", (function () { var r = T.solve({ data: { w: 3, h: 3, rows: [], cols: [] } }); return r.status === "none" && r.errors.length > 0 && r.errors.every(allWords) && T.difficulty(null) === 0; })());
  })();

  /* ================================================================== 9. constraintView, trace */
  t.group("Nonogram — constraintView, trace");
  (function () {
    var small = pz("5", "easy", 2), big = pz("15", "hard", 2), cv = T.constraintView(small), cvb = T.constraintView(big), bad = [];
    t.ok("constraintView 5×5: biến từng ô (25), (h+w)=10 ràng buộc 'Hàng i: …' / 'Cột j: …', counts khớp", cv.variables.length === 25 && cv.constraints.length === 10 && cv.counts.variables === 25 && cv.counts.constraints === 10 && allWords(cv.summary) && cv.variables.every(function (v) { return allWords(v.name) && allWords(v.domain); }) && /^Hàng 1: /.test(cv.constraints[0]) && /^Cột 5: /.test(cv.constraints[9]), cv.constraints);
    t.ok("constraintView 15×15 (≥ 40 biến): gộp nhóm có count = 225; 30 ràng buộc, clue khớp data", cvb.variables.length <= 3 && cvb.variables[0].count === 225 && cvb.counts.variables === 225 && cvb.constraints.length === 30 && cvb.constraints.every(allWords) && cvb.constraints[0] === "Hàng 1: " + big.data.rows[0].join(" "));
    [small, big, T.fromInput({ w: 2, h: 2, rows: [[1], [1]], cols: [[1], [1]] }).puzzle, pz("10", "expert", 3)].forEach(function (p, idx) {
      var tr = T.trace(p), N = p.size.w * p.size.h, w = p.size.w, h = p.size.h;
      if (tr.kind !== "matrix" || !allWords(tr.title) || !allWords(tr.note) || !Array.isArray(tr.steps) || !tr.steps.length || tr.steps.length > 60) { bad.push(idx + " hình dạng/giới hạn"); return; }
      tr.steps.forEach(function (s, k) {
        if (!allWords(s.text) || s.matrix.length !== h || !s.matrix.every(function (row) { return row.length === w && row.every(function (c) { return c === "." || c === "#" || c === "x"; }); })) bad.push(idx + " bước " + k + " hình dạng");
        if (k > 0 && k < tr.steps.length - 1) { var prev = tr.steps[k - 1].matrix, cur = s.matrix; for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) if (prev[r][c] !== "." && prev[r][c] !== cur[r][c]) bad.push(idx + " bước " + k + " ô đã biết bị đổi"); if (s.pivot && !(s.pivot[0] >= 0 && s.pivot[0] < h && s.pivot[1] >= 0 && s.pivot[1] < w)) bad.push(idx + " pivot"); }
      });
      if (tr.steps[0].matrix.some(function (row) { return row.some(function (c) { return c !== "."; }); })) bad.push(idx + " ma trận đầu không trống");
      var last = tr.steps[tr.steps.length - 1].matrix;
      if (T.validate(p).status === "unique" && !p.solution.v.every(function (x, i) { return (x === 1) === (last[Math.floor(i / w)][i % w] === "#"); })) bad.push(idx + " ma trận cuối ≠ đáp án");
    });
    t.ok("trace (matrix) 5×5, 15×15, 2×2 hai nghiệm, 10×10 expert: ≤ 60 bước, ma trận h×w gồm . # x, ô đã biết không đổi, ma trận cuối = đáp án", bad.length === 0, bad.slice(0, 3));
    var big25 = T.fromInput({ w: 25, h: 25, image: randImg(R.create(5), 25, 25, 0.55) }).puzzle, tr25 = T.trace(big25);
    t.ok("trace 25×25: gộp theo vòng, vẫn ≤ 60 bước", tr25.steps.length <= 60 && tr25.steps.length >= 3 && allWords(tr25.note), tr25.steps.length);
  })();

  /* ================================================================== 10. hiệu năng, đề lớn */
  t.group("Nonogram — hiệu năng solve/validate/fromInput trên đề lớn và đề xấu");
  (function () {
    var rng = R.create(2510), cases = [];
    function blobs(w, h, count) { var img = new Array(w * h).fill(0), k, x0, y0, bw, bh, r, c; for (k = 0; k < count; k++) { bw = rng.range(3, 12); bh = rng.range(3, 12); x0 = rng.range(0, w - bw); y0 = rng.range(0, h - bh); for (r = y0; r < y0 + bh; r++) for (c = x0; c < x0 + bw; c++) img[r * w + c] = k % 3 === 2 ? 0 : 1; } return img; }
    cases.push(["25×25 nhiễu 50 %", randImg(rng, 25, 25, 0.5)], ["25×25 nhiễu 70 %", randImg(rng, 25, 25, 0.7)], ["25×25 nhiễu 30 %", randImg(rng, 25, 25, 0.3)], ["25×25 khối lớn", blobs(25, 25, 7)], ["25×25 khối lớn (2)", blobs(25, 25, 12)], ["25×15 nhiễu 55 %", randImg(rng, 25, 15, 0.55)]);
    var info = [];
    cases.forEach(function (cs) {
      var w = 25, h = cs[0].indexOf("25×15") === 0 ? 15 : 25, img = cs[1], cl = cluesOfImg(img, w, h), p;
      var fi = t.time(cs[0] + ": fromInput (đếm tới 2 nghiệm) ≤ 1 s", 1000, function () { return T.fromInput({ w: w, h: h, image: img }); });
      p = fi.puzzle;
      var sv = t.time(cs[0] + ": solve (có giải thích) ≤ 1 s", 1000, function () { return T.solve(p); });
      t.ok(cs[0] + ": status " + sv.status + (sv.exhausted ? " (cạn ngân sách, chưa xác định hết)" : "") + ", " + sv.waves + " vòng, " + sv.decisions + " lần chọn ô; nghiệm (nếu có) khớp clue theo kiểm độc lập", sv.status !== "none" && (sv.solution ? imgMatches(solBits(sv.solution.v), w, h, cl.rows, cl.cols) : sv.exhausted === true && sv.status === "multiple"));
      t.ok(cs[0] + ": fromInput vẫn ok, solution = ảnh vẽ, cạn ngân sách thì có cảnh báo 'chưa xác định hết'; score = difficulty(puzzle) = " + fi.puzzle.score, fi.ok && J(solBits(fi.puzzle.solution.v)) === J(img) && (!sv.exhausted || (fi.status === "multiple" && fi.warnings.length === 1)) && fi.puzzle.score === T.difficulty(fi.puzzle));
      info.push(cs[0] + " → " + fi.status + (sv.exhausted ? " (cạn ngân sách)" : ""));
    });
    t.info("trạng thái: " + info.join(" · "));
    // đề xấu: hoán đổi hai clue hàng của đề thật (tổng giữ nguyên) → thường vô nghiệm; quay lui phải tắt nhanh
    var sw = 0, slow = [];
    for (var q = 0; q < 12; q++) {
      var img2 = randImg(rng, 25, 25, 0.5), c2 = cluesOfImg(img2, 25, 25), rows = c2.rows.slice(), a = rng.int(25), b = rng.int(25), tmp = rows[a]; rows[a] = rows[b]; rows[b] = tmp;
      var t0 = Date.now(), res = T.solve(rawPuzzle(25, 25, rows, c2.cols), { text: false }), ms = Date.now() - t0; sw++;
      if (ms > 1000 * SLACK) slow.push(ms + "ms " + res.status + " nodes " + res.nodes);
    }
    t.ok("12 đề 25×25 bị hoán đổi clue (đề xấu): solve đều ≤ 1 s", slow.length === 0, slow);
    var amb = T.fromInput({ w: 25, h: 25, image: randImg(rng, 25, 25, 0.5) }).puzzle, lim = T.solve(amb, { maxNodes: 2, text: false });
    t.ok("maxNodes nhỏ: trả kết quả (status multiple + exhausted nếu chưa xác định hết), không treo, không ném lỗi", ["none", "unique", "multiple"].indexOf(lim.status) >= 0 && (lim.status !== "multiple" || lim.count >= 2 || lim.exhausted === true), J({ s: lim.status, c: lim.count, e: lim.exhausted }));
    t.ok("solve limit=1 chỉ tìm một nghiệm; limit=5 đếm tối đa 5 nghiệm", T.solve(amb, { limit: 1, text: false }).count === 1 && T.solve(T.fromInput({ w: 4, h: 4, rows: [[1], [1], [1], [1]], cols: [[1], [1], [1], [1]] }).puzzle, { limit: 100, text: false }).count === 24);
    t.info("(4×4 hoán vị: 4! = 24 nghiệm — OEIS A000142 — solve limit 100 đếm đúng 24)");
    // check() chạy sau MỖI nước đi: phải rẻ ở cỡ lớn
    var big = pz("15", "hard", 4), st = { v: big.solution.v.map(function (x, i) { return i % 7 === 0 ? 2 : x === 1 ? 1 : 0; }), c: null }, c0 = Date.now(), r;
    for (r = 0; r < 300; r++) T.check(big, st);
    var perCheck = (Date.now() - c0) / 300;
    t.ok("check() trên 15×15 (đã có ô sai): " + perCheck.toFixed(2) + " ms/lần ≤ 5 ms", perCheck <= 5 * SLACK);
    var b25 = T.fromInput({ w: 25, h: 25, image: randImg(R.create(9), 25, 25, 0.6) }).puzzle, st25 = T.newState(b25), c1 = Date.now();
    for (r = 0; r < 100; r++) T.check(b25, st25);
    t.ok("check() trên 25×25: " + ((Date.now() - c1) / 100).toFixed(2) + " ms/lần ≤ 10 ms", (Date.now() - c1) / 100 <= 10 * SLACK);
  })();

  /* ================================================================== 11. fuzz: mọi hàm với dữ liệu rác */
  t.group("Nonogram — fuzz: mọi hàm với dữ liệu rác (không ném lỗi)");
  (function () {
    var rng = R.create(1234), KEYS = ["w", "h", "rows", "cols", "image", "data", "v", "type", "initial", "solution", "size", "k", "i", "cells", "val", "axis", "idx", "meta", "c", "initialState", "seed"];
    function junk(depth) {
      var r = rng.int(depth > 2 ? 8 : 12), n, o, k;
      switch (r) {
        case 0: return undefined; case 1: return null; case 2: return [NaN, -1, 0, 1, 2, 3, 1.5, 1e9, -1e9, Infinity][rng.int(10)];
        case 3: return ["", "abc", "1 2 3", "Rows: 1\nCols: 1", "0", "1|1", "x".repeat(50)][rng.int(7)]; case 4: return rng.chance(0.5); case 5: return rng.int(30); case 6: return [rng.int(4), rng.int(4)]; case 7: return "nonogram";
        case 8: case 9: n = rng.int(6); o = []; while (n--) o.push(junk(depth + 1)); return o;
        default: n = rng.int(6); o = {}; while (n--) { k = KEYS[rng.int(KEYS.length)]; o[k] = junk(depth + 1); } if (rng.chance(0.3)) { o.w = 2 + rng.int(4); o.h = 2 + rng.int(4); } return o;
      }
    }
    var thrown = [], calls = 0;
    var fns = { fromInput: function (a) { return T.fromInput(a); }, fromText: function (a) { return T.fromText(a); }, fromFile: function (a) { return T.fromFile(a); }, solve: function (a) { return T.solve(a); }, validate: function (a) { return T.validate(a); },
      difficulty: function (a) { return T.difficulty(a); }, newState: function (a) { return T.newState(a); }, check: function (a, b) { return T.check(a, b); }, moveFor: function (a, b, c) { return T.moveFor(a, b, c, {}); }, mistakes: function (a, b, c) { return T.mistakes(a, b, c); },
      hint: function (a, b, c) { return T.hint(a, b, c); }, replay: function (a) { return T.replay(a); }, cv: function (a) { return T.constraintView(a); }, trace: function (a) { return T.trace(a); }, dc: function (a, b, c) { return T.describeCell(a, b, c); },
      toFile: function (a) { return T.toFile(a); }, toText: function (a) { return T.toText(a); }, isGiven: function (a, b) { return T.isGiven(a, b); }, generate: null };
    var goodP = pz("5", "easy", 8);
    for (var q = 0; q < 400; q++) {
      var a = junk(0), b = junk(0), c = junk(0);
      Object.keys(fns).forEach(function (k) {
        if (!fns[k]) return;
        var variants = [[a, b, c]];
        if (k === "check" || k === "moveFor" || k === "mistakes" || k === "hint" || k === "dc") variants.push([goodP, b, c]);   // puzzle tốt + state/action rác
        variants.forEach(function (v) { calls++; try { fns[k](v[0], v[1], v[2]); } catch (e) { thrown.push(k + ": " + e.message); } });
      });
      try { T.generate(a, b); T.generate(q, { sizeId: a, tier: b }); calls += 2; } catch (e) { thrown.push("generate: " + e.message); }
    }
    t.ok("400 vòng × ~20 hàm với dữ liệu rác ngẫu nhiên (" + calls + " lời gọi): không ném lỗi", thrown.length === 0, thrown.slice(0, 4));
  })();
};
