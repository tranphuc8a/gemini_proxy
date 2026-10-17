/* kiem/lightsout.js — kiểm engine Lights Out (assets/js/puzzles/lightsout.js).
   Nguồn sự thật ĐỘC LẬP (không đối chiếu engine với chính nó, và không dùng khử Gauss để kiểm khử Gauss):
     · VÉT CẠN 2^(w*h) tập bấm cho mọi cỡ ≤ 4×5 (bảng "bàn nào do bao nhiêu tập bấm tạo ra, tập nhẹ nhất bao nhiêu") — mọi bàn với cỡ ≤ 12 ô, 300 bàn ngẫu nhiên cỡ lớn hơn;
     · "ĐUỔI ĐÈN" (light chasing): thử 2^w mẫu bấm hàng đầu, các hàng sau bấm theo đèn hàng trên — một thuật toán khác hẳn khử Gauss, đúng cho mọi bàn w ≤ 10:
       đếm nghiệm, số bấm tối thiểu, tập bấm nhỏ nhất theo thứ tự từ điển; dùng để kiểm số chiều hạt nhân mọi bàn chữ nhật 2…10 × 2…10;
     · số liệu công bố: số chiều hạt nhân của bàn vuông 3×3 → 0, 4×4 → 4, 5×5 → 2, 6×6 → 0 (Anderson & Feil, "Turning Lights Out with Linear Algebra", Math. Magazine 71, 1998;
       cũng là bảng kiểm trong ../light-grid-shared/README.md); bàn 5×5 sáng hết cần tối thiểu 15 lần bấm (kết quả kinh điển, README nói trên; ở đây còn được đuổi đèn kiểm lại). */
"use strict";
var fs = require("fs"), path = require("path");
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("lightsout"), U = Puz.util, G = Puz.game, R = Puz.rng;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"];

  // ------------------------------------------------------------ nguồn độc lập
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function toggleCross(w, h, st, r, c) {
    var d = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var k = 0; k < 5; k++) { var rr = r + d[k][0], cc = c + d[k][1]; if (rr >= 0 && rr < h && cc >= 0 && cc < w) st[rr * w + cc] ^= 1; }
  }
  function applyPress(w, h, board, i) { var st = board.slice(); toggleCross(w, h, st, Math.floor(i / w), i % w); return st; }
  function applyAll(w, h, board, presses) { var st = board.slice(); presses.forEach(function (i) { toggleCross(w, h, st, Math.floor(i / w), i % w); }); return st; }
  function lexCmp(a, b) { for (var i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }
  /** Đuổi đèn: {count, minWeight, best (tập bấm nhẹ nhất, nhỏ nhất từ điển)} — count = số nghiệm đúng. */
  function chase(w, h, board) {
    var count = 0, best = null;
    for (var p = 0; p < (1 << w); p++) {
      var st = board.slice(), pressed = [];
      for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
        var doPress = r === 0 ? (p >> c) & 1 : st[(r - 1) * w + c];
        if (doPress) { pressed.push(r * w + c); toggleCross(w, h, st, r, c); }
      }
      if (st.every(function (x) { return x === 0; })) {
        count++;
        if (!best || pressed.length < best.length || (pressed.length === best.length && lexCmp(pressed, best) < 0)) best = pressed;
      }
    }
    return { count: count, minWeight: best ? best.length : -1, best: best };
  }
  function popcount32(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); x = (x + (x >>> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >>> 24; }
  /** Vét cạn 2^(w*h) tập bấm: count[mask bàn] = số tập bấm tạo ra đúng bàn đó; minw = số bấm nhỏ nhất (255 nếu không). */
  function bruteTable(w, h) {
    var N = w * h, size = 1 << N, count = new Uint16Array(size), minw = new Uint8Array(size), col = [], i, g;
    for (i = 0; i < size; i++) minw[i] = 255;
    for (i = 0; i < N; i++) { var st = zeros(N); toggleCross(w, h, st, Math.floor(i / w), i % w); var m = 0; for (var j = 0; j < N; j++) if (st[j]) m |= 1 << j; col.push(m); }
    var img = 0; count[0] = 1; minw[0] = 0;
    for (g = 1; g < size; g++) { img ^= col[31 - Math.clz32(g & -g)]; var wt = popcount32(g ^ (g >> 1)); count[img]++; if (wt < minw[img]) minw[img] = wt; }
    return { count: count, minw: minw };
  }
  function maskOf(board) { var m = 0; for (var i = 0; i < board.length; i++) if (board[i]) m |= 1 << i; return m; }
  function boardOfMask(N, m) { var b = []; for (var i = 0; i < N; i++) b.push((m >> i) & 1); return b; }
  function bad(s) { return s === undefined || s === null || s === "" || /undefined|null|NaN/.test(String(s)); }
  function inp(w, h, v) { return T.fromInput({ w: w, h: h, v: v }); }
  function randBoard(rr, N) { var b = []; for (var i = 0; i < N; i++) b.push(rr.int(2)); return b; }
  function solvableBoard(rr, w, h, m) { var st = zeros(w * h); for (var k = 0; k < m; k++) { var i = rr.int(w * h); toggleCross(w, h, st, Math.floor(i / w), i % w); } return st; }

  // ------------------------------------------------------------ 1. siêu dữ liệu
  t.group("Lights Out — siêu dữ liệu và nội dung");
  t.eq("id/loại/nhóm", [T.id, T.family, T.category], ["lightsout", "Mathematical Puzzle", "Đại số tuyến tính"]);
  t.ok("sizes: 3…7 vuông, đúng một mặc định là 5×5, params {w,h}", T.sizes.map(function (s) { return s.id; }).join() === "3,4,5,6,7" && T.sizes.filter(function (s) { return s.default; }).length === 1 && T.sizes.filter(function (s) { return s.default; })[0].id === "5" && T.sizes.every(function (s) { return s.params.w === +s.id && s.params.h === +s.id; }));
  t.ok("sizes[].tiers chỉ chứa bậc hợp lệ, không trống", T.sizes.every(function (s) { return s.tiers && s.tiers.length && s.tiers.every(function (x) { return TIERS.indexOf(x) >= 0; }); }), T.sizes.map(function (s) { return s.id + ":" + s.tiers; }));
  t.ok("3×3 không có bậc Chuyên gia (theo chủ dự án)", T.sizes[0].tiers.indexOf("expert") < 0);
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); });
    var text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 1 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("algorithm 3–5 bước, mỗi bước có tiêu đề và nội dung", T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5 && T.algorithm.steps.every(function (s) { return !bad(s.title) && !bad(s.text); }));
  t.ok("rules, blurb, difficultyNote không rỗng, không undefined/null/NaN", T.rules.every(function (s) { return !bad(s); }) && !bad(T.blurb) && !bad(T.difficultyNote));

  // ------------------------------------------------------------ 2. số liệu công bố
  t.group("Lights Out — số chiều hạt nhân công bố (Anderson & Feil 1998) và đuổi đèn độc lập");
  function nullityOf(w, h) {                                           // qua một bàn chắc chắn giải được (do bấm ngẫu nhiên) → info.nullity của engine
    var rr = R.create(w * 100 + h), v = solvableBoard(rr, w, h, w * h), out = inp(w, h, v);
    if (out.status === "none") return -1;
    return out.info.nullity;
  }
  t.eq("nhân 3×3, 4×4, 5×5, 6×6 = 0, 4, 2, 0", [3, 4, 5, 6].map(function (n) { return nullityOf(n, n); }), [0, 4, 2, 0]);
  t.eq("số nghiệm của một bàn giải được: 3×3 = 1, 4×4 = 16, 5×5 = 4, 6×6 = 1", [3, 4, 5, 6].map(function (n) { var o = inp(n, n, solvableBoard(R.create(n), n, n, n * n)); return o.count; }), [1, 16, 4, 1]);
  t.eq("hạng: 3×3 = 9, 4×4 = 12, 5×5 = 23, 6×6 = 36 (README light-grid-shared)", [3, 4, 5, 6].map(function (n) { return inp(n, n, solvableBoard(R.create(n), n, n, n * n)).info.rank; }), [9, 12, 23, 36]);
  (function () {
    var mism = [], seen = {}, nulls = [];
    for (var w = 2; w <= 10; w++) for (var h = 2; h <= 10; h++) {
      var ch = chase(w, h, zeros(w * h)), nl = Math.round(Math.log(ch.count) / Math.LN2), got = nullityOf(w, h);
      if (ch.count !== Math.pow(2, nl) || got !== nl) mism.push({ w: w, h: h, chase: nl, engine: got });
      if (w === h) nulls.push(w + "→" + nl);
    }
    t.ok("nhân của MỌI bàn chữ nhật w, h ∈ 2…10 (81 cỡ) khớp đuổi đèn độc lập", mism.length === 0, mism.slice(0, 3));
    t.info("nhân bàn vuông theo đuổi đèn: " + nulls.join(", "));
    t.eq("đuổi đèn cũng cho 0/4/2/0 ở 3…6 (nguồn công bố, không qua engine)", [3, 4, 5, 6].map(function (n) { return Math.round(Math.log(chase(n, n, zeros(n * n)).count) / Math.LN2); }), [0, 4, 2, 0]);
  })();
  (function () {
    var all = []; for (var i = 0; i < 25; i++) all.push(1);
    var o = inp(5, 5, all), ch = chase(5, 5, all);
    t.ok("5×5 sáng hết: 4 nghiệm, ít nhất 15 lần bấm (kinh điển) — engine và đuổi đèn đều đồng ý", o.ok && o.status === "multiple" && o.count === 4 && o.info.minPresses === 15 && ch.count === 4 && ch.minWeight === 15, [o.count, o.info.minPresses, ch.count, ch.minWeight]);
    t.ok("tập bấm trả về thật sự tắt hết đèn và trùng tập nhỏ nhất theo đuổi đèn", JSON.stringify(o.info.presses) === JSON.stringify(ch.best) && applyAll(5, 5, all, o.info.presses).every(function (x) { return x === 0; }));
    var all3 = zeros(9).map(function () { return 1; }), o3 = inp(3, 3, all3);
    t.ok("3×3 sáng hết: duy nhất, 5 lần bấm (khớp đuổi đèn)", o3.status === "unique" && o3.info.minPresses === chase(3, 3, all3).minWeight && o3.info.minPresses === 5, o3.info);
  })();

  // ------------------------------------------------------------ 3. vét cạn 2^(w*h)
  t.group("Lights Out — vét cạn 2^(w*h) tập bấm (cỡ ≤ 4×5): số nghiệm, số bấm tối thiểu, trạng thái");
  (function () {
    var SIZES = [[2, 2], [2, 3], [3, 2], [2, 4], [4, 2], [3, 3], [2, 5], [5, 2], [2, 6], [3, 4], [4, 3], [6, 2], [2, 7], [3, 5], [4, 4], [5, 3], [3, 6], [4, 5], [5, 4], [2, 10]];
    var rr = R.create(1017), totalBoards = 0, bads = [], statBad = [], preBad = [], solvableCounts = [];
    SIZES.forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h;
      if (N > 20) return;
      var tab = bruteTable(w, h), masks = [], solvable = 0, i;
      if (N <= 12) for (i = 0; i < (1 << N); i++) masks.push(i); else for (i = 0; i < 300; i++) masks.push(rr.int(1 << N));
      for (i = 0; i < 40; i++) masks.push(maskOf(solvableBoard(rr, w, h, rr.range(1, N))));      // chắc chắn giải được
      for (i = 0; i < (1 << N); i++) if (tab.count[i]) solvable++;
      solvableCounts.push(w + "×" + h + ": " + solvable + "/" + (1 << N));
      masks.forEach(function (m) {
        var b = boardOfMask(N, m), cnt = tab.count[m], K = tab.minw[m], out = inp(w, h, b), sv = T.solve(out.puzzle), val = T.validate(out.puzzle);
        var st = cnt === 0 ? "none" : cnt === 1 ? "unique" : "multiple";
        totalBoards++;
        if (sv.status !== st || sv.count !== cnt || out.status !== st || out.count !== cnt || val.status !== st || val.count !== cnt) bads.push({ w: w, h: h, mask: m, cnt: cnt, sv: [sv.status, sv.count], out: [out.status, out.count] });
        var okExpected = cnt > 0 && m !== 0;
        if (out.ok !== okExpected || val.ok !== okExpected) statBad.push({ w: w, h: h, mask: m, ok: [out.ok, val.ok], expect: okExpected });
        if (cnt > 0) {
          if (sv.minPresses !== K || out.info.minPresses !== K || sv.presses.length !== K || out.puzzle.data.presses.length !== K) bads.push({ w: w, h: h, mask: m, K: K, got: sv.minPresses });
          if (!applyAll(w, h, b, sv.presses).every(function (x) { return x === 0; })) preBad.push({ w: w, h: h, mask: m, why: "tập bấm không tắt hết" });
          if (JSON.stringify(sv.presses) !== JSON.stringify(out.puzzle.data.presses) || sv.presses.some(function (p, k) { return k && p <= sv.presses[k - 1]; })) preBad.push({ w: w, h: h, mask: m, why: "presses không tăng dần/không khớp data" });
          if (out.puzzle.solution === null || !out.puzzle.solution.v.every(function (x) { return x === 0; })) preBad.push({ w: w, h: h, mask: m, why: "solution phải toàn 0" });
          if (out.ok && out.warnings.length) preBad.push({ w: w, h: h, mask: m, why: "không được cảnh báo nhiều nghiệm", warnings: out.warnings });
        } else if (out.puzzle.solution !== null || sv.solution !== null) preBad.push({ w: w, h: h, mask: m, why: "vô nghiệm mà có solution" });
      });
    });
    t.ok("solve / validate / fromInput khớp bảng vét cạn: trạng thái + SỐ NGHIỆM + số bấm tối thiểu (" + totalBoards + " bàn, " + SIZES.length + " cỡ)", bads.length === 0, bads.slice(0, 3));
    t.ok("ok chỉ khi giải được và không phải bàn tắt hết sẵn (nhiều nghiệm vẫn ok, không cảnh báo)", statBad.length === 0, statBad.slice(0, 3));
    t.ok("tập bấm trả về thật sự tắt hết đèn, tăng dần, khớp data.presses; solution = toàn 0; vô nghiệm → solution null; không có warnings nhiều nghiệm", preBad.length === 0, preBad.slice(0, 3));
    t.info("số bàn giải được (vét cạn): " + solvableCounts.join("; "));
    var t44 = bruteTable(4, 4), s44 = 0; for (var i = 0; i < t44.count.length; i++) if (t44.count[i]) s44++;
    t.ok("4×4: đúng 4096/65536 = 1/16 số bàn giải được, mỗi bàn đúng 16 nghiệm (vét cạn)", s44 === 4096 && t44.count.every(function (c) { return c === 0 || c === 16; }));
    var t33 = bruteTable(3, 3); t.ok("3×3: mọi 512 bàn giải được, mỗi bàn duy nhất (vét cạn)", t33.count.every(function (c) { return c === 1; }));
    var t55 = bruteTable(5, 5 > 4 ? 4 : 5);                                                           // 5×4 = 20 ô
    t.ok("5×4: nhân bao nhiêu thì số nghiệm đúng bấy nhiêu (mọi bàn giải được có cùng số nghiệm)", (function () { var set = {}; for (var i = 0; i < t55.count.length; i++) if (t55.count[i]) set[t55.count[i]] = 1; return Object.keys(set).length === 1; })());
  })();
  t.group("Lights Out — đuổi đèn độc lập: nghiệm, số bấm, tập nhỏ nhất theo từ điển (bàn lớn tới 10×10)");
  (function () {
    var rr = R.create(555), bads = [], n = 0, sizes = [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [5, 7], [7, 5], [8, 6], [9, 9], [10, 10], [10, 4], [4, 10], [2, 9], [9, 2], [3, 8], [6, 9]];
    sizes.forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h;
      for (var k = 0; k < 12; k++) {
        var b = k % 3 === 0 ? randBoard(rr, N) : solvableBoard(rr, w, h, rr.range(1, N)), ch = chase(w, h, b), out = inp(w, h, b), sv = T.solve(out.puzzle);
        n++;
        var st = ch.count === 0 ? "none" : ch.count === 1 ? "unique" : "multiple";
        if (sv.status !== st || sv.count !== ch.count) { bads.push({ w: w, h: h, b: b.join(""), chase: [ch.count], got: [sv.status, sv.count] }); continue; }
        if (ch.count && (sv.minPresses !== ch.minWeight || JSON.stringify(sv.presses) !== JSON.stringify(ch.best))) bads.push({ w: w, h: h, b: b.join(""), chase: ch.best, got: sv.presses });
      }
    });
    t.ok("khớp đuổi đèn về trạng thái, số nghiệm, số bấm tối thiểu VÀ chính tập bấm (tie-break từ điển) — " + n + " bàn, " + sizes.length + " cỡ", bads.length === 0, bads.slice(0, 2));
  })();

  // ------------------------------------------------------------ 4. sinh
  t.group("Lights Out — sinh đề: tất định, giải được, đúng bậc, đơn điệu, ngân sách");
  var SEEDS = []; for (var sd = 0; sd < 20; sd++) SEEDS.push(1000003 * (sd + 1) + 29);
  var gen = {}, timing = [];
  T.sizes.forEach(function (sz) {
    gen[sz.id] = {};
    sz.tiers.forEach(function (tier) {
      var arr = [], ms = [];
      SEEDS.forEach(function (seed) { var t0 = Date.now(); var p = T.generate(seed, { sizeId: sz.id, tier: tier }); ms.push(Date.now() - t0); arr.push(p); });
      gen[sz.id][tier] = arr;
      ms.sort(function (a, b) { return a - b; });
      var hit = arr.filter(function (p) { return p.tier === tier; }).length;
      timing.push(sz.id + "×" + sz.id + " " + tier + ": trung vị " + ms[10] + " ms, xấu nhất " + ms[19] + " ms, đạt bậc " + hit + "/20");
      t.ok("generate " + sz.id + "×" + sz.id + " / " + tier + ": trung vị ≤ 1500 ms và xấu nhất ≤ 4000 ms (đo: " + ms[10] + " / " + ms[19] + " ms)", ms[10] <= 1500 * t.slack && ms[19] <= 4000 * t.slack, ms);
      t.ok("  " + sz.id + "×" + sz.id + " / " + tier + ": đạt đúng bậc ≥ 90 % (" + hit + "/20)", hit >= 18, arr.map(function (p) { return p.score; }));
    });
  });
  t.info(timing.join("\n        "));
  (function () {
    var a = T.generate(424242, { sizeId: "6", tier: "hard" }), b = T.generate(424242, { sizeId: "6", tier: "hard" }), c = T.generate(424243, { sizeId: "6", tier: "hard" });
    t.ok("tất định: cùng (seed, cỡ, bậc) → cùng puzzle từng bit; khác seed → khác", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
    var same = true; T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { if (JSON.stringify(T.generate(7, { sizeId: sz.id, tier: tier })) !== JSON.stringify(T.generate(7, { sizeId: sz.id, tier: tier }))) same = false; }); });
    t.ok("tất định trên mọi (cỡ, bậc)", same);
    var distinct = {}; gen["5"].medium.forEach(function (p) { distinct[p.id] = 1; });
    t.ok("20 seed cho ≥ 18 đề khác nhau (5×5 Vừa)", Object.keys(distinct).length >= 18, Object.keys(distinct).length);
  })();
  (function () {
    var bads = [], truth = [], shape = [], mean = [];
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        gen[sz.id][tier].forEach(function (p) {
          var w = sz.params.w, h = sz.params.h, N = w * h, b = p.initial.v, ch = chase(w, h, b);
          if (ch.count < 1) bads.push({ size: sz.id, why: "đề không giải được (đuổi đèn)", seed: p.seed });
          else if (ch.minWeight !== p.data.presses.length || JSON.stringify(ch.best) !== JSON.stringify(p.data.presses)) bads.push({ size: sz.id, tier: tier, seed: p.seed, why: "data.presses ≠ tập bấm tối thiểu độc lập", chase: ch.minWeight, got: p.data.presses.length });
          if (!applyAll(w, h, b, p.data.presses).every(function (x) { return x === 0; })) bads.push({ size: sz.id, why: "presses không tắt hết" });
          if (p.data.presses.length < 2) bads.push({ size: sz.id, why: "đề quá tầm thường (K < 2)" });
          if (p.tier !== U.tierOfScore(p.score).id) truth.push({ size: sz.id, tier: tier, got: p.tier, score: p.score });
          if (T.difficulty(p) !== p.score) truth.push({ size: sz.id, why: "difficulty ≠ score", d: T.difficulty(p), s: p.score });
          if (T.validate(p).ok !== true) bads.push({ size: sz.id, why: "validate không ok" });
          if (p.type !== "lightsout" || p.sizeId !== sz.id || p.size.w !== w || p.size.h !== h || p.data.w !== w || p.data.h !== h || p.initial.v.length !== N || !p.solution || p.solution.v.length !== N || p.id !== U.puzzleId(p) || p.seed !== R.seedOf(p.seed) || p.v !== 1) shape.push({ size: sz.id, tier: tier });
        });
      });
    });
    t.ok("mọi đề sinh ra giải được; data.presses = tập bấm tối thiểu độc lập (đuổi đèn); tắt hết đèn; K ≥ 2", bads.length === 0, bads.slice(0, 3));
    t.ok("puzzle.tier trung thực với score; difficulty(puzzle) === score", truth.length === 0, truth.slice(0, 3));
    t.ok("hình dạng puzzle: type, sizeId, size {w,h}, data {w,h,presses}, id, seed, solution toàn 0", shape.length === 0, shape.slice(0, 3));
    T.sizes.forEach(function (sz) {
      var ms = sz.tiers.map(function (tier) { var a = gen[sz.id][tier]; return a.reduce(function (s, p) { return s + p.score; }, 0) / a.length; });
      var mono = true; for (var i = 1; i < ms.length; i++) if (!(ms[i] > ms[i - 1])) mono = false;
      t.ok("đơn điệu theo bậc (20 seed) ở " + sz.id + "×" + sz.id + ": " + sz.tiers.map(function (x, i) { return x + " " + ms[i].toFixed(2); }).join(" < "), mono, ms);
    });
    var km = true;
    T.sizes.forEach(function (sz) { var prev = -1; sz.tiers.forEach(function (tier) { var a = gen[sz.id][tier], av = a.reduce(function (s, p) { return s + p.data.presses.length; }, 0) / a.length; if (!(av > prev)) km = false; prev = av; }); });
    t.ok("số lần bấm tối thiểu trung bình tăng dần theo bậc (khó = nhiều bấm)", km);
  })();
  (function () {
    var p = T.generate(1, { sizeId: "3", tier: "expert" });
    t.ok("xin bậc không có ở cỡ đó (3×3 Chuyên gia): trả bậc gần nhất, ghi đúng bậc thật", T.sizes[0].tiers.indexOf(p.tier) >= 0 && p.tier === U.tierOfScore(p.score).id, [p.tier, p.score]);
    var q = T.generate(1, { sizeId: "zzz", tier: "nope" });
    t.ok("cỡ/bậc lạ không ném lỗi: dùng cỡ mặc định 5×5 + bậc Vừa", q.size.w === 5 && q.size.h === 5 && !!q.solution);
  })();

  // ------------------------------------------------------------ 5. nước đi / kiểm
  t.group("Lights Out — moveFor / check / mistakes");
  (function () {
    var p = gen["5"].medium[0], w = 5, h = 5, N = 25, st = T.newState(p);
    t.ok("newState: bản sao initial, c = null; isGiven luôn false", st.v.join() === p.initial.v.join() && st.c === null && st.v !== p.initial.v && st.v.every(function (x, i) { return T.isGiven(p, i) === false; }));
    var bads = [];
    for (var i = 0; i < N; i++) {
      var d = T.moveFor(p, st, { k: "press", i: i }), exp = applyPress(w, h, st.v, i), cur = { v: st.v.slice(), c: null };
      G.applyDiff(cur, d.d, false);
      var r = Math.floor(i / w), c = i % w, expN = 1 + (r > 0) + (r < h - 1) + (c > 0) + (c < w - 1);
      if (JSON.stringify(cur.v) !== JSON.stringify(exp) || d.d.length !== expN || d.d.some(function (e) { return e[0] !== "v" || e[2] === e[3] || st.v[e[1]] !== e[2]; })) bads.push({ i: i });
      G.applyDiff(cur, G.reverseDiff(d.d), false);
      if (cur.v.join() !== st.v.join()) bads.push({ i: i, why: "reverseDiff" });
      var twice = { v: st.v.slice(), c: null }; G.applyDiff(twice, d.d, false); G.applyDiff(twice, T.moveFor(p, twice, { k: "press", i: i }).d, false);
      if (twice.v.join() !== st.v.join()) bads.push({ i: i, why: "bấm hai lần không hoàn tác" });
    }
    t.ok("press: diff đảo đúng ô chữ thập (góc 3 ô, rìa 4, giữa 5 — kiểm cả 25 ô độc lập), tự nghịch đảo, reverseDiff trả đúng state cũ", bads.length === 0, bads.slice(0, 3));
    t.eq("góc/rìa/giữa trên 5×5: 3 / 4 / 5 ô bị đảo", [T.moveFor(p, st, { k: "press", i: 0 }).d.length, T.moveFor(p, st, { k: "press", i: 2 }).d.length, T.moveFor(p, st, { k: "press", i: 12 }).d.length], [3, 4, 5]);
    t.ok("chữ nhật 3×6: ô góc phải-dưới đảo đúng 3 ô, ô giữa 5 ô", (function () { var o = inp(6, 3, solvableBoard(R.create(3), 6, 3, 5)).puzzle, s = T.newState(o); return T.moveFor(o, s, { k: "press", i: 17 }).d.length === 3 && T.moveFor(o, s, { k: "press", i: 7 }).d.length === 5; })());
    t.ok("hành động lạ → null, không ném lỗi", [{ k: "press", i: 25 }, { k: "press", i: -1 }, { k: "press", i: 1.5 }, { k: "press", i: "x" }, { k: "press" }, { k: "set", i: 1, val: 1 }, {}, null, undefined].every(function (a) { return T.moveFor(p, st, a) === null; }));
    var rr = R.create(88), s2 = T.newState(p), badChk = [];
    for (var k = 0; k < 300; k++) {
      var d2 = T.moveFor(p, s2, { k: "press", i: rr.int(N) }); G.applyDiff(s2, d2.d, false);
      var on = s2.v.filter(Boolean).length, chk = T.check(p, s2);
      if (chk.solved !== (on === 0) || chk.conflicts.length !== 0 || chk.total !== N || chk.filled !== N - on) badChk.push({ k: k, chk: chk });
      if (T.mistakes(p, s2, d2) !== 0) badChk.push({ k: k, why: "mistakes ≠ 0" });
    }
    t.ok("check: solved ⇔ tất cả tắt; conflicts = []; filled = số đèn tắt; total = w*h; mistakes luôn 0 (300 nước ngẫu nhiên)", badChk.length === 0, badChk.slice(0, 2));
    t.ok("check(solution) solved; check(initial) chưa xong", T.check(p, { v: p.solution.v.slice(), c: null }).solved && !T.check(p, T.newState(p)).solved);
    t.ok("check với state hỏng không ném", T.check(p, null).solved === false && T.check(p, { v: [1] }).solved === false && T.check(null, null).solved === false);
  })();
  (function () {
    var p = gen["4"].medium[0], g = G.create(p, { now: function () { return 0; } }), done = false;
    g.on(function (ev) { if (ev.type === "solved") done = true; });
    p.data.presses.forEach(function (i) { g.act({ k: "press", i: i }); });
    t.ok("ván: bấm đúng tập ít nhất → solved, số nước = K, không lỗi", g.status === "solved" && done && g.counters.moves === p.data.presses.length && g.counters.mistakes === 0 && g.record().result === "solved", g.counters);
    var g2 = G.create(p, { now: function () { return 0; } }); g2.act({ k: "press", i: 0 }); g2.undo();
    t.ok("undo trả đúng bàn đầu", g2.state.v.join() === p.initial.v.join());
    var g3 = G.create(p, { now: function () { return 0; } });
    t.ok("reveal điền bàn tắt hết và ghi revealed", g3.reveal() && g3.state.v.every(function (x) { return x === 0; }) && g3.record().result === "revealed");
  })();

  // ------------------------------------------------------------ 6. hint
  t.group("Lights Out — hint: chạy thật tới xong (đúng K lần), mọi nước bấm tự xử lý");
  (function () {
    var rr = R.create(2718), issues = [], total = 0, exact = 0, withExtra = 0, maxRatio = 0;
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        gen[sz.id][tier].slice(0, 4).forEach(function (p) {
          var w = p.size.w, h = p.size.h, K0 = chase(w, h, p.initial.v).minWeight;
          [false, true].forEach(function (inject) {
            var g = G.create(p, { now: function () { return 0; } }), steps = 0, expectK = K0, guard = 0;
            while (!g.finished() && guard++ < w * h * 3) {
              if (inject && steps === 2) { var ex = rr.int(w * h); g.act({ k: "press", i: ex }); expectK = chase(w, h, g.state.v).minWeight; withExtra++; steps = 3; continue; }
              var st = JSON.stringify(g.state), h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
              if (JSON.stringify(g.state) !== st) issues.push({ why: "hint làm đổi state" });
              if (!h3 || h3.none || !h3.action || h3.action.k !== "press") { issues.push({ why: "hint none khi chưa xong", size: sz.id }); break; }
              if (JSON.stringify(T.hint(p, g.state, 3)) !== JSON.stringify(h3)) issues.push({ why: "không tất định" });
              var cell = h3.action.i, r = Math.floor(cell / w), c = cell % w, Kn = chase(w, h, g.state.v).minWeight;
              if (Kn !== expectK) issues.push({ why: "K trước hint ≠ kỳ vọng", Kn: Kn, expectK: expectK });
              if (h1.text.indexOf("ít nhất " + Kn + " lần bấm nữa") < 0 || h1.text.indexOf("hàng " + (r + 1) + ".") < 0) issues.push({ why: "text mức 1", text: h1.text, Kn: Kn, r: r });
              if (h2.text.indexOf("cột " + (c + 1) + ".") < 0 || h2.text.indexOf("Hàng " + (r + 1) + " còn cần bấm") < 0 || h2.cells.indexOf(cell) < 0) issues.push({ why: "text/cells mức 2", text: h2.text });
              if (h1.cells.indexOf(cell) < 0) issues.push({ why: "mức 1 không bao hàng chứa ô" });
              if (!h3.why.length || !/Ax = b trên GF\(2\)/.test(h3.why.join(" ")) || [h1, h2, h3].some(function (x) { return bad(x.text) || x.why.some(bad); })) issues.push({ why: "why mức 3 thiếu/hỏng", why3: h3.why });
              var rs = g.act(h3.action); steps++; expectK--;
              if (!rs.ok) { issues.push({ why: "action bị từ chối" }); break; }
              var Ka = g.finished() ? 0 : chase(w, h, g.state.v).minWeight;
              if (Ka !== Kn - 1) issues.push({ why: "bấm theo hint không giảm đúng 1", Kn: Kn, Ka: Ka });
              if (rs.mistakes) issues.push({ why: "mistakes ≠ 0" });
            }
            total++;
            if (g.status === "solved") exact++; else issues.push({ why: "không giải xong", size: sz.id, tier: tier });
            if (!inject && steps !== K0) issues.push({ why: "số bước ≠ K", steps: steps, K0: K0, size: sz.id });
            maxRatio = Math.max(maxRatio, steps / (w * h));
          });
        });
      });
    });
    t.ok("lặp hint mức 3 giải xong mọi đề mẫu (" + exact + "/" + total + " ván, " + withExtra + " ván chèn thêm một nước bấm bất kỳ giữa chừng)", exact === total, exact);
    t.ok("không chèn: số bước ĐÚNG BẰNG số lần bấm tối thiểu K (độc lập); mỗi hint giảm K đúng 1; text mức 1/2 đúng; tất định; hint không đổi state", issues.length === 0, issues.slice(0, 3));
    t.ok("số bước ≤ 3 × tổng số ô (tối đa đo được " + maxRatio.toFixed(2) + " × N)", maxRatio <= 3, maxRatio);
    var p = gen["5"].easy[0], h0 = T.hint(p, { v: zeros(25), c: null }, 3);
    t.ok("bàn đã tắt hết → hint none:true có text tiếng Việt", h0.none === true && !bad(h0.text) && h0.level === 3, h0);
    var unsolv = T.fromInput({ w: 4, h: 4, v: (function () { var v = zeros(16); v[0] = 1; return v; })() }).puzzle;
    t.ok("bàn không giải được (4×4 một đèn): hint none, không ném", T.hint(unsolv, T.newState(unsolv), 1).none === true && T.hint(unsolv, T.newState(unsolv), 3).none === true);
    t.ok("đề hỏng: hint none, không ném; level ngoài 1..3 được kẹp", T.hint({}, { v: [] }, 1).none === true && T.hint(null, null, 3).none === true && T.hint(p, T.newState(p), 9).level === 3 && T.hint(p, T.newState(p), 0).level === 1);
  })();

  // ------------------------------------------------------------ 7. replay
  t.group("Lights Out — replay");
  (function () {
    var bads = [], cnt = 0, puzzles = [];
    T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { puzzles.push(gen[sz.id][tier][2]); }); });
    puzzles.push(inp(4, 6, solvableBoard(R.create(1), 4, 6, 7)).puzzle, inp(7, 3, solvableBoard(R.create(2), 7, 3, 6)).puzzle, inp(2, 2, [1, 0, 0, 0]).puzzle);
    puzzles.forEach(function (p) {
      var rep = T.replay(p), st = T.newState(p), w = p.size.w, h = p.size.h; cnt++;
      if (rep.length !== p.data.presses.length || !rep.length) { bads.push({ id: p.id, why: "số bước ≠ K", got: rep.length }); return; }
      rep.forEach(function (s, i) {
        if (bad(s.text) || !s.diff || !s.diff.d.length || !Array.isArray(s.cells) || !s.cells.length || bad(s.technique) || (s.why || []).some(bad)) bads.push({ id: p.id, step: i, why: "thiếu text/diff/cells/technique" });
        var exp = applyPress(w, h, st.v, p.data.presses[i]);
        G.applyDiff(st, s.diff.d, false);
        if (st.v.join() !== exp.join()) bads.push({ id: p.id, step: i, why: "diff sai" });
      });
      if (!T.check(p, st).solved) bads.push({ id: p.id, why: "replay không kết thúc ở bàn tắt hết" });
    });
    t.ok("replay: áp tuần tự từng lần bấm trong tập ít nhất → tắt hết; mỗi bước có text/diff/cells/technique (" + cnt + " đề)", bads.length === 0, bads.slice(0, 3));
    var s = T.solve(gen["6"].hard[0]);
    t.ok("solve(...).steps/techniques khớp số lần bấm; presses = data.presses", s.steps.length === gen["6"].hard[0].data.presses.length && s.techniques["Khử Gauss GF(2)"] === s.steps.length && JSON.stringify(s.presses) === JSON.stringify(gen["6"].hard[0].data.presses) && s.steps.every(function (x) { return !bad(x.text) && !bad(x.technique); }));
    t.ok("replay bàn không giải được = []", T.replay(T.fromInput({ w: 4, h: 4, v: (function () { var v = zeros(16); v[5] = 1; return v; })() }).puzzle).length === 0);
    t.ok("solve(puzzle, {board}) giải từ trạng thái hiện tại", (function () { var p = gen["5"].medium[1], st = applyAll(5, 5, p.initial.v, [p.data.presses[0], 3]), r = T.solve(p, { board: st }), ch = chase(5, 5, st); return r.minPresses === ch.minWeight && JSON.stringify(r.presses) === JSON.stringify(ch.best); })());
  })();

  // ------------------------------------------------------------ 8. nhập/xuất, đầu vào xấu
  t.group("Lights Out — toFile/fromFile, toText/fromText, đầu vào xấu");
  (function () {
    var bads = [], list = [];
    T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { list.push(gen[sz.id][tier][0]); }); });
    list.push(inp(4, 7, solvableBoard(R.create(5), 4, 7, 9)).puzzle, inp(10, 10, solvableBoard(R.create(6), 10, 10, 30)).puzzle, inp(2, 3, solvableBoard(R.create(8), 2, 3, 3)).puzzle);
    list.forEach(function (p) {
      var f = T.toFile(p), f2 = JSON.parse(JSON.stringify(f)), back = T.fromFile(f2), tx = T.toText(p), bt = T.fromText(tx), w = p.size.w, h = p.size.h;
      if (!back.ok || JSON.stringify(back.puzzle.initial) !== JSON.stringify(p.initial) || JSON.stringify(back.puzzle.data) !== JSON.stringify(p.data) || JSON.stringify(back.puzzle.size) !== JSON.stringify(p.size)) bads.push({ id: p.id, why: "file" });
      if (!bt.ok || JSON.stringify(bt.puzzle.initial) !== JSON.stringify(p.initial) || JSON.stringify(bt.puzzle.data) !== JSON.stringify(p.data) || JSON.stringify(bt.puzzle.size) !== JSON.stringify(p.size)) bads.push({ id: p.id, why: "text" });
      if (f.type !== "lightsout" || f.initialState.length !== w * h || !/^[01]+$/.test(f.initialState) || f.solution !== zeros(w * h).join("") || f.difficulty !== p.score || f.size.w !== w || f.size.h !== h || JSON.stringify(f.metadata.presses) !== JSON.stringify(p.data.presses)) bads.push({ id: p.id, why: "định dạng toFile", f: f });
      var lines = tx.split("\n"); if (lines.length !== h || !lines.every(function (l) { return /^[#.]( [#.])*$/.test(l) && l.split(" ").length === w; })) bads.push({ id: p.id, why: "định dạng toText", tx: tx });
    });
    t.ok("vòng tròn file/text giữ nguyên initial, data, size — gồm bàn chữ nhật (" + list.length + " đề)", bads.length === 0, bads.slice(0, 3));
    t.ok("toFile giữ seed", T.fromFile(T.toFile(gen["5"].easy[0])).puzzle.seed === gen["5"].easy[0].seed);
    var a = T.fromText("# . #\n. # .\n# . #"), b = T.fromText("1 0 X\n- O 0\n* . 1"), c = T.fromText("#.#.#.#.#"), d = T.fromText("|# . #|\n|. # .|\n|# . #|");
    t.ok("fromText: nhận # 1 X O * là bật, . 0 - là tắt; bỏ khoảng trắng, | và dòng trống; một dòng n² ký tự", a.ok && b.ok && c.ok && d.ok && JSON.stringify(a.puzzle.initial) === JSON.stringify(b.puzzle.initial) && JSON.stringify(a.puzzle.initial) === JSON.stringify(d.puzzle.initial) && JSON.stringify(c.puzzle.initial) === JSON.stringify(a.puzzle.initial), [a.errors, b.errors, c.errors]);
    t.eq("  đọc đúng lưới 3×3 ví dụ (5 đèn bật)", a.puzzle.initial.v, [1, 0, 1, 0, 1, 0, 1, 0, 1]);
    t.ok("fromText bàn chữ nhật 2 dòng × 4 cột", (function () { var o = T.fromText("# . . #\n. # # ."); return o.ok === (chase(4, 2, [1, 0, 0, 1, 0, 1, 1, 0]).count > 0) && o.puzzle.size.w === 4 && o.puzzle.size.h === 2; })());
    var BAD_INPUTS = [null, undefined, 42, "", [], {}, { w: 1, h: 3 }, { w: 11, h: 3 }, { w: 3, h: "x" }, { w: 3.5, h: 3 }, { w: 3 }, { n: 1 }, { w: 3, h: 3, v: [1, 0] }, { w: 3, h: 3, v: [0, 0, 0, 0, 0, 0, 0, 0, 7] }, { w: 3, h: 3, v: "01x000000" }, { w: 3, h: 3, v: 5 }, { w: 3, h: 3, v: { a: 1 } }, { w: [3], h: 3 }, { w: 3, h: 3, v: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, { w: 4, h: 4, v: "1000000000000000" }];
    var thrown = [], notOk = 0;
    BAD_INPUTS.forEach(function (x, i) { try { var o = T.fromInput(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) notOk++; else thrown.push({ i: i, why: "ok=true với đầu vào xấu", x: x }); } catch (e) { thrown.push({ i: i, err: e.message }); } });
    t.ok("fromInput: đầu vào xấu/vô nghiệm/tắt hết → ok:false + lỗi tiếng Việt, không ném (" + notOk + "/" + BAD_INPUTS.length + ")", thrown.length === 0 && notOk === BAD_INPUTS.length, thrown.slice(0, 3));
    var BAD_TEXT = [null, undefined, 5, "", "\n\n", "XXZ", "# . #\n. #", "# # #\n# # #\n# #", "# . # . #", "ab\ncd", { a: 1 }, ". . .\n. . .\n. . ."];
    var th2 = [], ok2 = 0;
    BAD_TEXT.forEach(function (x, i) { try { var o = T.fromText(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) ok2++; else th2.push({ i: i, ok: o.ok, x: x }); } catch (e) { th2.push({ i: i, err: e.message }); } });
    t.ok("fromText: đầu vào xấu → ok:false + lỗi, không ném (" + ok2 + "/" + BAD_TEXT.length + ")", th2.length === 0 && ok2 === BAD_TEXT.length, th2.slice(0, 3));
    var BAD_FILES = [null, undefined, 3, "x", [], {}, { type: "sudoku" }, { type: "lightsout" }, { type: "lightsout", initialState: "" }, { type: "lightsout", initialState: "01x0" }, { type: "lightsout", initialState: "0100", size: { w: 3, h: 3 } }, { type: "lightsout", initialState: "1".repeat(9), size: { w: 3 } }, { type: "lightsout", initialState: "0".repeat(9), size: { w: 3, h: 3 } }, { type: "lightsout", initialState: 7 }, { type: "lightsout", initialState: "1000000000000000", size: { w: 4, h: 4 } }];
    var th3 = [], ok3 = 0;
    BAD_FILES.forEach(function (x, i) { try { var o = T.fromFile(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) ok3++; else th3.push({ i: i, ok: o.ok }); } catch (e) { th3.push({ i: i, err: e.message }); } });
    t.ok("fromFile: tệp xấu → ok:false + lỗi, không ném (" + ok3 + "/" + BAD_FILES.length + ")", th3.length === 0 && ok3 === BAD_FILES.length, th3.slice(0, 3));
    t.ok("fromFile KHÔNG tin difficulty/solution/presses trong tệp", (function () { var f = T.toFile(gen["5"].easy[0]); f.difficulty = 9.9; f.solution = "1".repeat(25); f.metadata.presses = [0, 1, 2]; var o = T.fromFile(f); return o.ok && o.puzzle.score !== 9.9 && o.puzzle.solution.v.every(function (x) { return x === 0; }) && JSON.stringify(o.puzzle.data.presses) === JSON.stringify(gen["5"].easy[0].data.presses) && o.puzzle.tier === "custom"; })());
    var thr = [], ths = [{}, { data: { w: 3, h: 3 } }, { data: { w: 3, h: 3 }, initial: { v: [1] } }, { data: { w: 99, h: 3 }, initial: { v: [] } }, null, 5, "x"];
    ths.forEach(function (x) { ["solve", "validate", "difficulty", "check", "constraintView", "trace", "replay", "toText", "toFile"].forEach(function (fn) { try { var args = fn === "check" ? [x, { v: [] }] : [x]; T[fn].apply(T, args); } catch (e) { thr.push(fn + ": " + e.message); } }); });
    t.ok("solve/validate/difficulty/check/constraintView/trace/replay/toText/toFile với puzzle hỏng không ném lỗi", thr.length === 0, thr.slice(0, 3));
    t.ok("validate puzzle hỏng → ok:false, status none, lỗi tiếng Việt", (function () { var v = T.validate({ data: { w: 3, h: 3 }, initial: { v: [1] } }); return !v.ok && v.status === "none" && v.errors.length && !bad(v.errors[0]); })());
  })();

  t.group("Lights Out — fromInput: trường hợp cụ thể");
  (function () {
    var one = zeros(9); one[4] = 1;
    var e1 = inp(3, 3, one);
    t.ok("3×3 một đèn giữa: ok, duy nhất, không cảnh báo, tier custom, seed null", e1.ok && e1.status === "unique" && e1.count === 1 && e1.warnings.length === 0 && e1.puzzle.tier === "custom" && e1.puzzle.seed === null && e1.puzzle.score > 0, e1);
    var b5 = solvableBoard(R.create(11), 5, 5, 9), e2 = inp(5, 5, b5);
    t.ok("5×5 giải được: multiple, count 4, ok = true, KHÔNG cảnh báo; có info {rank, nullity, solutions, minPresses}", e2.ok && e2.status === "multiple" && e2.count === 4 && e2.warnings.length === 0 && e2.info.rank === 23 && e2.info.nullity === 2 && e2.info.solutions === 4 && e2.info.minPresses > 0, e2.info);
    var e3 = inp(4, 4, one.concat(zeros(7)));
    t.ok("4×4 một đèn: không giải được (status none, ok=false, lỗi nói rõ 1/16)", !e3.ok && e3.status === "none" && e3.count === 0 && /không có lời giải/.test(e3.errors[0]) && /1\/16/.test(e3.errors[0]), e3.errors);
    t.ok("bàn tắt hết: ok=false, lỗi 'bật ít nhất một đèn'", (function () { var o = inp(3, 3, zeros(9)); return !o.ok && /bật ít nhất một đèn/.test(o.errors[0]) && o.status === "unique"; })());
    t.ok("nhập bằng chuỗi 0/1 và bằng n (bàn vuông)", (function () { var o1 = T.fromInput({ n: 3, v: "000010000" }), o2 = T.fromInput({ w: 3, h: 3, v: one }); return o1.ok && JSON.stringify(o1.puzzle.initial) === JSON.stringify(o2.puzzle.initial); })());
    t.ok("meta chỉ nhận name/source/note là chuỗi", T.fromInput({ w: 3, h: 3, v: one, meta: { name: "Thử", evil: "x", note: 5 } }).puzzle.meta.name === "Thử" && !("evil" in T.fromInput({ w: 3, h: 3, v: one, meta: { name: "Thử", evil: "x" } }).puzzle.meta));
    var big = inp(10, 10, solvableBoard(R.create(12), 10, 10, 40));
    t.ok("10×10 giải được: ok, duy nhất", big.ok && big.status === "unique");
    t.ok("9×9 (nhân 8 chiều): giải được thì 256 nghiệm; ít bấm nhất khớp đuổi đèn", (function () { var b = solvableBoard(R.create(13), 9, 9, 30), o = inp(9, 9, b), ch = chase(9, 9, b); return o.ok && o.count === 256 && ch.count === 256 && o.info.minPresses === ch.minWeight && JSON.stringify(o.info.presses) === JSON.stringify(ch.best); })());
  })();

  // ------------------------------------------------------------ 9. constraintView, trace, describeCell
  t.group("Lights Out — constraintView, trace, describeCell");
  (function () {
    [[3, 3], [5, 5], [6, 6], [7, 7], [10, 10], [4, 5]].forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h, p = inp(w, h, solvableBoard(R.create(w * h), w, h, Math.max(2, N >> 1))).puzzle, cv = T.constraintView(p), ch = chase(w, h, zeros(N)), nl = Math.round(Math.log(ch.count) / Math.LN2);
      t.ok("constraintView " + w + "×" + h + ": " + N + " biến, " + N + " phương trình, counts + hạng/nhân khớp, chuỗi sạch, biến " + (N >= 40 ? "gộp nhóm" : "liệt kê"), cv.counts.variables === N && cv.counts.constraints === N && cv.counts.rank === N - nl && cv.counts.nullity === nl && !bad(cv.summary) && cv.variables.length === (N >= 40 ? h : N) && (N >= 40 ? cv.variables.every(function (v) { return v.count === w; }) : cv.variables.every(function (v) { return !v.count && v.domain === "{0, 1}"; })) && cv.constraints.every(function (c) { return !bad(c); }) && cv.constraints.length <= 14 + (N <= 40 ? N : 0) && cv.variables.length < 40 + 1, cv.counts);
    });
    var p3 = inp(3, 3, [1, 0, 0, 0, 0, 0, 0, 0, 0]).puzzle, cv3 = T.constraintView(p3), eqs = cv3.constraints.filter(function (c) { return / = [01] \(mod 2\)$/.test(c); });
    t.eq("3×3: phương trình góc x(1,1) + x(2,1) + x(1,2) = 1; ô giữa có 5 số hạng", [eqs[0], eqs[4].split(" + ").length], ["x(1,1) + x(2,1) + x(1,2) = 1 (mod 2)", 5]);
    t.ok("summary nêu hạng, nhân và số nghiệm", /Hạng 9, nhân 0 chiều/.test(cv3.summary) && /1 nghiệm/.test(cv3.summary), cv3.summary);
    t.ok("summary 4×4 không giải được nói rõ", /KHÔNG giải được/.test(T.constraintView(inp(4, 4, [1].concat(zeros(15))).puzzle).summary));
  })();
  (function () {
    [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [10, 10], [3, 5]].forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h, b = solvableBoard(R.create(N + 7), w, h, Math.max(2, N >> 1)), p = inp(w, h, b).puzzle, tr = T.trace(p), steps = tr.steps, an = inp(w, h, b);
      var shapeOk = tr.kind === "matrix" && steps.length >= 2 && steps.length <= 60 && steps.every(function (s) { return !bad(s.text) && s.matrix.length === N && s.matrix.every(function (row) { return row.length === N + 1 && row.every(function (x) { return x === 0 || x === 1; }); }); }) && !bad(tr.title) && !bad(tr.note);
      t.ok("trace " + w + "×" + h + ": kind matrix, " + steps.length + " bước ≤ 60, ma trận " + N + "×" + (N + 1) + " toàn 0/1, mọi bước có text" + (tr.truncated ? " (cắt gọn + note)" : ""), shapeOk && (!tr.truncated || /Chỉ ghi/.test(tr.note)), [steps.length, tr.truncated]);
      // ma trận đầu = [A | b] dựng độc lập
      var A0 = steps[0].matrix, badA = 0;
      for (var i = 0; i < N; i++) { var st = zeros(N); toggleCross(w, h, st, Math.floor(i / w), i % w); for (var j = 0; j < N; j++) if (A0[i][j] !== st[j]) badA++; if (A0[i][N] !== b[i]) badA++; }
      t.ok("  bước 0 đúng bằng [A | b] dựng độc lập từ luật chữ thập", badA === 0, badA);
      var piv = steps.filter(function (s) { return s.pivot; });
      t.ok("  mỗi bước pivot: pivot [hàng, cột] nằm trong ma trận, ô pivot = 1, cột pivot chỉ có một số 1", piv.every(function (s) { var r = s.pivot[0], c = s.pivot[1]; return r >= 0 && r < N && c >= 0 && c < N && s.matrix[r][c] === 1 && s.matrix.reduce(function (sum, row) { return sum + row[c]; }, 0) === 1; }));
      t.ok("  các cột pivot tăng dần, hàng pivot tăng dần", piv.every(function (s, k) { return k === 0 || (s.pivot[1] > piv[k - 1].pivot[1] && s.pivot[0] === piv[k - 1].pivot[0] + 1); }));
      if (!tr.truncated) {
        var last = steps[steps.length - 1].matrix, rank = 0, zeroRowsOk = true;
        for (i = 0; i < N; i++) { var lead = -1; for (j = 0; j < N; j++) if (last[i][j]) { lead = j; break; } if (lead >= 0) rank++; else if (last[i][N]) zeroRowsOk = false; }
        t.ok("  bước cuối đã rút gọn: hạng " + rank + " khớp engine (" + an.info.rank + "), hàng 0 = 0 nhất quán (bàn giải được)", rank === an.info.rank && zeroRowsOk && tr.rank === an.info.rank && tr.nullity === an.info.nullity && tr.solvable === true, [rank, an.info.rank]);
      }
    });
    var trBad = T.trace(inp(4, 4, [1].concat(zeros(15))).puzzle);
    t.ok("trace bàn 4×4 không giải được: báo vô nghiệm ở bước cuối (hàng 0 = 1)", trBad.solvable === false && /VÔ NGHIỆM/.test(trBad.steps[trBad.steps.length - 1].text) && trBad.steps[trBad.steps.length - 1].matrix.some(function (row) { return row.slice(0, 16).every(function (x) { return x === 0; }) && row[16] === 1; }), trBad.steps.length);
    t.ok("trace 10×10 có giới hạn bước (≤ 60) và cắt gọn", (function () { var tr = T.trace(inp(10, 10, solvableBoard(R.create(3), 10, 10, 30)).puzzle); return tr.steps.length <= 60 && tr.truncated === true; })());
    t.time("trace + constraintView 10×10 ≤ 300 ms", 300, function () { var p = inp(10, 10, solvableBoard(R.create(4), 10, 10, 30)).puzzle; T.trace(p); T.constraintView(p); });
    var p = gen["5"].easy[0], st = T.newState(p), texts = [T.describeCell(p, st, 0), T.describeCell(p, st, 24), T.describeCell(p, { v: zeros(25), c: null }, 3)];
    t.ok("describeCell: tiếng Việt, nêu hàng/cột và trạng thái đèn", texts.every(function (x) { return /^Hàng \d+, cột \d+, đèn (bật|tắt)$/.test(x); }) && /đèn tắt$/.test(texts[2]) && /Hàng 5, cột 5/.test(texts[1]), texts);
    t.ok("describeCell ô ngoài bàn không ném", !bad(T.describeCell(p, st, 999)) && !bad(T.describeCell(null, null, 1)));
  })();

  // ------------------------------------------------------------ 10. hiệu năng đề tự nhập
  t.group("Lights Out — hiệu năng đề tự nhập (≤ 1 s)");
  (function () {
    var rr = R.create(9), worst = 0, label = "", n = 0;
    for (var w = 2; w <= 10; w++) for (var h = 2; h <= 10; h++) {
      var b = solvableBoard(rr, w, h, rr.range(1, w * h)), t0 = Date.now(), o = T.fromInput({ w: w, h: h, v: b });
      if (o.puzzle) { T.validate(o.puzzle); T.solve(o.puzzle); T.difficulty(o.puzzle); T.hint(o.puzzle, T.newState(o.puzzle), 3); }
      var ms = Date.now() - t0; n++; if (ms > worst) { worst = ms; label = w + "×" + h; }
    }
    t.ok("fromInput + validate + solve + difficulty + hint trên " + n + " cỡ 2…10 × 2…10 (chậm nhất " + worst + " ms: " + label + ")", worst <= 1000 * t.slack, worst);
    var rep = Date.now(); T.replay(inp(9, 9, solvableBoard(R.create(1), 9, 9, 40)).puzzle); var ms9 = Date.now() - rep;
    t.ok("9×9 (nhân 8 chiều, 256 tổ hợp) replay ≤ 1 s (" + ms9 + " ms)", ms9 <= 1000 * t.slack);
  })();
};
