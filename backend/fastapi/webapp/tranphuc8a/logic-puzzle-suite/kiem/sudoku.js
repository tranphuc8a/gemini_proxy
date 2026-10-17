/* kiem/sudoku.js — kiểm engine Sudoku (assets/js/puzzles/sudoku.js). Chạy: node kiem.js sudoku

   NGUỒN SỰ THẬT ĐỘC LẬP (không tự đối chiếu với chính engine):
     · brute()  — bộ vét cạn NGÂY THƠ viết riêng ở đây (quay lui theo thứ tự ô, kiểm luật bằng vòng lặp, không bitmask, không MRV);
     · dlx()    — Knuth Algorithm X / Dancing Links viết riêng ở đây (phủ chính xác 324 ràng buộc), nhanh nên dùng được cho đề khó;
     · đề công bố: ví dụ Wikipedia (Sudoku), đề "chống vét cạn" của Wikipedia (Sudoku solving algorithms), đề Arto Inkala 2012 — đáp án chỉ được dùng sau khi
       DLX độc lập xác nhận nghiệm duy nhất VÀ trùng đáp án công bố.
     · kiểm độ đúng của từng bước kỹ thuật (replay) bằng lời giải duy nhất: một phép LOẠI ứng viên không bao giờ được loại chính chữ số của lời giải. */
"use strict";
var fs = require("fs"), path = require("path");
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("sudoku"), G = Puz.game, R = Puz.rng, U = Puz.util;
  var APP = path.join(__dirname, "..");
  var SLACK = t.slack || 1;
  function js(x) { return JSON.stringify(x); }
  function str(g) { return g.join(""); }
  function arr(s) { return s.split("").map(function (ch) { return ch === "." ? 0 : +ch; }); }
  function cn(i) { return "R" + (Math.floor(i / 9) + 1) + "C" + (i % 9 + 1); }

  // ======================================================================== nguồn sự thật độc lập
  function validCell(g, i, d) {
    var r = Math.floor(i / 9), c = i % 9, k, a, b, j;
    for (k = 0; k < 9; k++) { if (r * 9 + k !== i && g[r * 9 + k] === d) return false; if (k * 9 + c !== i && g[k * 9 + c] === d) return false; }
    for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) { j = (r - r % 3 + a) * 9 + c - c % 3 + b; if (j !== i && g[j] === d) return false; }
    return true;
  }
  /** Vét cạn ngây thơ: đếm nghiệm tới `cap`; nếu quá `maxNodes` thì aborted. */
  function brute(grid, cap, maxNodes) {
    var g = grid.slice(), count = 0, nodes = 0, aborted = false, i;
    for (i = 0; i < 81; i++) if (g[i] && !validCell(g, i, g[i])) return { count: 0, aborted: false };
    function go(pos) {
      while (pos < 81 && g[pos]) pos++;
      if (pos === 81) { count++; return; }
      for (var d = 1; d <= 9; d++) {
        if (!validCell(g, pos, d)) continue;
        g[pos] = d;
        if (++nodes > maxNodes) { aborted = true; return; }
        go(pos + 1);
        if (aborted || count >= cap) return;
        g[pos] = 0;
      }
    }
    go(0);
    return { count: count, aborted: aborted };
  }
  /** Knuth Algorithm X (Dancing Links): đếm nghiệm tới `cap`, trả cả nghiệm đầu tiên. */
  function dlx(grid, cap) {
    var N = 324, root = N, L = [], Rr = [], Uu = [], Dd = [], Cc = [], S = [], RID = [], n = N + 1, c, count = 0, first = null, stack = [];
    for (c = 0; c < N; c++) { L[c] = c === 0 ? root : c - 1; Rr[c] = c === N - 1 ? root : c + 1; Uu[c] = c; Dd[c] = c; Cc[c] = c; S[c] = 0; }
    L[root] = N - 1; Rr[root] = 0;
    function addRow(cols, id) {
      var f = -1, prev = -1;
      cols.forEach(function (cc) {
        var x = n++; Cc[x] = cc; RID[x] = id; Uu[x] = Uu[cc]; Dd[x] = cc; Dd[Uu[cc]] = x; Uu[cc] = x; S[cc]++;
        if (f < 0) { f = x; L[x] = x; Rr[x] = x; } else { L[x] = prev; Rr[x] = f; Rr[prev] = x; L[f] = x; }
        prev = x;
      });
    }
    var i, d;
    for (i = 0; i < 81; i++) {
      var r = Math.floor(i / 9), cc = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(cc / 3);
      for (d = 1; d <= 9; d++) if (!grid[i] || grid[i] === d) addRow([i, 81 + r * 9 + d - 1, 162 + cc * 9 + d - 1, 243 + b * 9 + d - 1], i * 9 + d - 1);
    }
    function cover(col) { Rr[L[col]] = Rr[col]; L[Rr[col]] = L[col]; for (var a = Dd[col]; a !== col; a = Dd[a]) for (var j = Rr[a]; j !== a; j = Rr[j]) { Dd[Uu[j]] = Dd[j]; Uu[Dd[j]] = Uu[j]; S[Cc[j]]--; } }
    function uncover(col) { for (var a = Uu[col]; a !== col; a = Uu[a]) for (var j = L[a]; j !== a; j = L[j]) { S[Cc[j]]++; Dd[Uu[j]] = j; Uu[Dd[j]] = j; } Rr[L[col]] = col; L[Rr[col]] = col; }
    function search() {
      if (count >= cap) return;
      if (Rr[root] === root) { count++; if (!first) { first = new Array(81); stack.forEach(function (id) { first[Math.floor(id / 9)] = id % 9 + 1; }); } return; }
      var best = Rr[root], col, a, j;
      for (col = Rr[root]; col !== root; col = Rr[col]) if (S[col] < S[best]) best = col;
      if (S[best] === 0) return;
      cover(best);
      for (a = Dd[best]; a !== best; a = Dd[a]) {
        stack.push(RID[a]);
        for (j = Rr[a]; j !== a; j = Rr[j]) cover(Cc[j]);
        search();
        for (j = L[a]; j !== a; j = L[j]) uncover(Cc[j]);
        stack.pop();
        if (count >= cap) break;
      }
      uncover(best);
    }
    search();
    return { count: count, solution: first };
  }
  /** Lưới đầy HỢP LỆ dựng bằng công thức mẫu rồi hoán vị (chữ số, hàng trong band, band, cột trong stack, stack) — không dùng engine. */
  function fullGrid(seed) {
    var rng = R.create(seed), digs = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]), rows = [], cols = [], b, k;
    var bands = rng.shuffle([0, 1, 2]), stacks = rng.shuffle([0, 1, 2]);
    for (b = 0; b < 3; b++) { var rr = rng.shuffle([0, 1, 2]); for (k = 0; k < 3; k++) rows.push(bands[b] * 3 + rr[k]); }
    for (b = 0; b < 3; b++) { var cc = rng.shuffle([0, 1, 2]); for (k = 0; k < 3; k++) cols.push(stacks[b] * 3 + cc[k]); }
    var g = [], r, c;
    for (r = 0; r < 9; r++) for (c = 0; c < 9; c++) g.push(digs[(rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9]);
    return g;
  }
  function blank(grid, k, rng) { var g = grid.slice(), idx = rng.shuffle(g.map(function (_, i) { return i; })); for (var q = 0; q < k; q++) g[idx[q]] = 0; return g; }
  function isValidFull(g) {
    if (!g || g.length !== 81) return false;
    for (var i = 0; i < 81; i++) if (g[i] < 1 || g[i] > 9 || !validCell(g, i, g[i])) return false;
    return true;
  }
  function pz(grid) { return { v: 1, type: "sudoku", initial: { v: grid.slice() }, solution: null }; }
  var STRIP = /R\dC\d|hàng \d|cột \d|block \d/g;

  // ======================================================================== 1. siêu dữ liệu
  t.group("Sudoku — siêu dữ liệu");
  var TIER_IDS = U.TIERS.map(function (x) { return x.id; });
  t.ok("đăng ký đúng id, một cỡ mặc định 9×9", T && T.id === "sudoku" && T.sizes.length === 1 && T.sizes[0].default && T.sizes[0].params === 9 && T.sizes[0].id === "9");
  t.ok("sizes[].tiers là bậc hợp lệ (đủ bốn bậc)", T.sizes.every(function (s) { return !s.tiers || s.tiers.every(function (x) { return TIER_IDS.indexOf(x) >= 0; }); }) && T.sizes[0].tiers.length === 4);
  var libDir = path.join(APP, "..", "algorithm-notebook", "assets", "data"), libText = "";
  fs.readdirSync(libDir).filter(function (f) { return /^lib-.*\.js$/.test(f); }).forEach(function (f) { libText += fs.readFileSync(path.join(libDir, f), "utf8"); });
  T.algorithm.links.forEach(function (l) { t.ok("algorithm.links id '" + l.id + "' có thật trong algorithm-notebook/lib-*.js", libText.indexOf('id: "' + l.id + '"') >= 0); });
  t.ok("algorithm có 3–5 bước, mỗi bước title + text", T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5 && T.algorithm.steps.every(function (s) { return s.title && s.text; }));
  t.eq("ba luật cốt lõi + ghi chú (rules)", T.rules.length, 4);
  (function () {
    var bad = [];
    function scan(name, s) { if (typeof s !== "string" || !s.trim() || /undefined|null|NaN|\[object/.test(s)) bad.push(name + ": " + js(s)); }
    scan("name", T.name); scan("blurb", T.blurb); scan("difficultyNote", T.difficultyNote); scan("algorithm.title", T.algorithm.title);
    T.rules.forEach(function (s, i) { scan("rules[" + i + "]", s); });
    T.algorithm.steps.forEach(function (s, i) { scan("steps[" + i + "].title", s.title); scan("steps[" + i + "].text", s.text); });
    Object.keys(T.techniqueNames).forEach(function (k) { scan("technique " + k, T.techniqueNames[k]); });
    t.ok("nội dung tiếng Việt cố định: không rỗng, không undefined/null/NaN", bad.length === 0, bad);
  })();
  (function () {
    var src = fs.readFileSync(path.join(APP, "assets", "js", "puzzles", "sudoku.js"), "utf8");
    var code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    t.ok("engine thuần: không DOM, không Math.random/Date/performance (tất định, chạy được trong Worker)", !/\b(document|window|localStorage|Math\.random|Date\.now|new Date|performance\.now)\b/.test(code));
    t.ok("phong cách ES5: không mũi tên, class, let/const, template literal", !/=>|`|\bclass\s+\w|\blet\s|\bconst\s/.test(code));
  })();

  // ======================================================================== 2. nguồn sự thật độc lập: đề công bố
  t.group("Sudoku — đề công bố (nguồn ghi rõ) đối chiếu bộ giải độc lập");
  var PUBLISHED = [
    { name: "Wikipedia 'Sudoku' — ví dụ kinh điển", grid: "530070000600195000098000060800060003400803001700020006060000280000419005000080079", sol: "534678912672195348198342567859761423426853791713924856961537284287419635345286179" },
    { name: "Wikipedia 'Sudoku solving algorithms' — đề thiết kế chống vét cạn", grid: "000000000000003085001020000000507000004000100090000000500000073002010000000040009", sol: "987654321246173985351928746128537694634892157795461832519286473472319568863745219" },
    { name: "Arto Inkala 2012 ('đề khó nhất thế giới', báo chí)", grid: "800000000003600000070090200050007000000045700000100030001000068008500010090000400", sol: "812753649943682175675491283154237896369845721287169534521974368438526917796318452" }
  ];
  PUBLISHED.forEach(function (pub) {
    var g = arr(pub.grid), d = dlx(g, 2), pr = null, r;
    t.ok(pub.name + ": DLX độc lập xác nhận duy nhất nghiệm và trùng đáp án công bố", d.count === 1 && str(d.solution) === pub.sol && isValidFull(arr(pub.sol)), d.count + " " + (d.solution && str(d.solution)));
    r = t.time(pub.name + ": validate ≤ 1 s", 1000, function () { return T.validate(pz(g)); });
    t.ok("  validate: ok, duy nhất, đúng đáp án", r.ok && r.status === "unique" && r.count === 1 && str(r.solution.v) === pub.sol, js(r).slice(0, 200));
    var fi = T.fromInput(pub.grid);
    pr = fi.puzzle;
    t.ok("  fromInput: ok, status unique, tier custom, điểm 0–10, solution đúng", fi.ok && fi.status === "unique" && pr.tier === "custom" && pr.score >= 0 && pr.score <= 10 && str(pr.solution.v) === pub.sol && fi.warnings.length === 0, js(fi).slice(0, 200));
    var sv = T.solve(pr), steps = sv.steps;
    t.ok("  solve: unique, có steps tiếng Việt, techniques đếm khớp số bước, điền xong đủ ô trống", sv.status === "unique" && steps.length > 0 && steps.every(function (s) { return s.text && s.technique; }) &&
      Object.keys(sv.techniques).reduce(function (a, k) { return a + sv.techniques[k]; }, 0) === steps.length, js(sv.techniques));
    t.info("điểm khó " + pr.score + ", kỹ thuật: " + js(sv.techniques));
  });
  (function () {
    var g = arr(PUBLISHED[0].grid), b = brute(g, 2, 5e6);
    t.ok("Wikipedia kinh điển: vét cạn ngây thơ cũng đếm đúng một nghiệm (" + (b.aborted ? "bỏ dở" : "xong") + ")", !b.aborted && b.count === 1, js(b));
    var easyOnes = T.solve(T.fromInput(PUBLISHED[0].grid).puzzle).techniques;
    t.ok("đề kinh điển giải được chỉ bằng single (không cần kỹ thuật khó hơn)", Object.keys(easyOnes).every(function (k) { return k === "naked-single" || k === "hidden-single"; }), js(easyOnes));
    var hard = T.solve(T.fromInput(PUBLISHED[2].grid).puzzle);
    t.ok("đề Inkala cần kỹ thuật cao hơn single/ít nhất một lần đoán và điểm ≥ 7,5 (chuyên gia)", hard.guesses > 0 && T.fromInput(PUBLISHED[2].grid).puzzle.score >= 7.5, hard.guesses + " lần đoán");
  })();

  // ======================================================================== 3. đếm nghiệm: engine so với vét cạn ngây thơ và DLX
  t.group("Sudoku — số nghiệm: engine ↔ vét cạn ngây thơ ↔ DLX (≥ 200 đề nhỏ/khuyết)");
  (function () {
    var rng = R.create(20261017), cases = [], k, base, g, n, fam;
    for (k = 0; k < 90; k++) { base = fullGrid(1000 + k); cases.push({ fam: "gần đầy (bỏ " + (n = 1 + (k % 18)) + " ô)", grid: blank(base, n, rng) }); }
    for (k = 0; k < 70; k++) {                      // sửa một ô cho sẵn → mâu thuẫn trực tiếp hoặc vô nghiệm ngầm
      base = fullGrid(2000 + k); g = blank(base, 4 + (k % 12), rng);
      var givens = g.map(function (x, i) { return x ? i : -1; }).filter(function (i) { return i >= 0; }), at = rng.pick(givens), nv;
      do { nv = rng.range(1, 9); } while (nv === g[at]);
      g[at] = nv; cases.push({ fam: "đổi một ô cho sẵn", grid: g });
    }
    for (k = 0; k < 40; k++) { base = fullGrid(3000 + k); cases.push({ fam: "bỏ nhiều ô (nhiều nghiệm)", grid: blank(base, 30 + (k % 20), rng) }); }
    for (k = 0; k < 20; k++) {                      // bỏ sạch hai chữ số của một lưới đầy: gần như luôn nhiều nghiệm
      base = fullGrid(4000 + k); var d1 = 1 + (k % 9), d2 = 1 + ((k + 3) % 9); g = base.map(function (x) { return x === d1 || x === d2 ? 0 : x; });
      cases.push({ fam: "bỏ sạch hai chữ số", grid: g });
    }
    var agreeB = 0, skipB = 0, agreeD = 0, bad = [], hist = { none: 0, unique: 0, multiple: 0 }, badIO = [];
    cases.forEach(function (cs, idx) {
      var d = dlx(cs.grid, 2), v = T.validate(pz(cs.grid)), b = brute(cs.grid, 2, 3e6), fi = T.fromInput(cs.grid), want = d.count === 0 ? "none" : d.count === 1 ? "unique" : "multiple";
      hist[want]++;
      if (v.count === d.count && v.status === want) agreeD++; else bad.push("#" + idx + " " + cs.fam + ": validate " + v.status + "/" + v.count + " ≠ DLX " + want + "/" + d.count);
      if (b.aborted) skipB++; else if (b.count === d.count) agreeB++; else bad.push("#" + idx + ": vét cạn " + b.count + " ≠ DLX " + d.count);
      if (fi.status !== want || fi.ok !== (want !== "none") || (want === "multiple" && !fi.warnings.length) || (want === "unique" && fi.warnings.length && fi.puzzle.initial.v.every(Boolean) === false) ||
        (want !== "none" && (!fi.puzzle || fi.puzzle.tier !== "custom" || (want === "unique" && !isValidFull(fi.puzzle.solution.v))))) badIO.push("#" + idx + ": fromInput " + fi.status + "/" + fi.ok);
      if (want === "none" && (!fi.errors.length || fi.puzzle)) badIO.push("#" + idx + ": none nhưng không có lỗi tiếng Việt");
    });
    t.ok(cases.length + " đề: validate (số nghiệm tới 2 + status) khớp DLX", agreeD === cases.length, bad.slice(0, 5));
    t.ok("vét cạn ngây thơ khớp DLX ở mọi đề nó chạy xong (" + agreeB + " đề; " + skipB + " bỏ dở vì quá nút)", bad.every(function (x) { return x.indexOf("vét cạn") < 0; }) && agreeB >= 180, bad.slice(0, 5));
    t.ok("fromInput: status/ok/warnings đúng với DLX (vô nghiệm → ok:false + lỗi; nhiều nghiệm → cảnh báo, ok:true; duy nhất → ok:true)", badIO.length === 0, badIO.slice(0, 5));
    t.info("phân bố đề thử: " + js(hist));
    t.ok("đủ ba loại kết quả trong bộ đề thử (vô nghiệm, duy nhất, nhiều nghiệm)", hist.none >= 10 && hist.unique >= 20 && hist.multiple >= 20, js(hist));
  })();
  (function () {
    var base = fullGrid(77), g = base.slice(), i, found = null;
    var classic = arr(PUBLISHED[0].grid);
    for (i = 0; i < 81 && !found; i++) if (!classic[i]) for (var d = 1; d <= 9 && !found; d++) {
      if (!validCell(classic, i, d)) continue;
      var g2 = classic.slice(); g2[i] = d;
      if (dlx(g2, 1).count === 0) found = g2;
    }
    var fi = T.fromInput(found);
    t.ok("vô nghiệm KHÔNG do trùng số trực tiếp (thêm một số hợp lệ nhưng sai): ok:false, status none, lỗi tiếng Việt", found && !fi.ok && fi.status === "none" && fi.errors.length === 1 && /vô nghiệm/.test(fi.errors[0]), js(fi.errors));
    var dup = base.slice(); dup[0] = dup[1];
    var fd = T.fromInput(dup);
    t.ok("hai số trùng trong hàng: ok:false, lỗi nêu đúng ô", !fd.ok && fd.errors.length >= 1 && /R1C1/.test(fd.errors.join(" ")) && /R1C2/.test(fd.errors.join(" ")), js(fd.errors));
    var empty = T.fromInput(new Array(81).join("0") + "0");
    t.ok("lưới rỗng: ok:true, nhiều nghiệm + cảnh báo, không treo", empty.ok && empty.status === "multiple" && empty.warnings.length >= 2, js(empty.warnings));
    t.time("fromInput lưới rỗng ≤ 1 s", 1000, function () { return T.fromInput(new Array(82).join("0")); });
    var full = T.fromInput(str(base));
    t.ok("lưới đầy hợp lệ: ok:true, duy nhất, cảnh báo không còn ô trống", full.ok && full.status === "unique" && full.warnings.length === 1 && T.check(full.puzzle, T.newState(full.puzzle)).solved, js(full.warnings));
  })();

  // ======================================================================== 4. generate
  t.group("Sudoku — generate: tất định, nghiệm duy nhất, đúng bậc, đơn điệu, thời gian");
  var GEN = {}, SEEDS = []; for (var si = 0; si < 20; si++) SEEDS.push(101 + si * 37);
  TIER_IDS.forEach(function (tier) {
    var ps = [], ms = [], hit = 0;
    SEEDS.forEach(function (sd) { var t0 = Date.now(), p = T.generate(sd, { sizeId: "9", tier: tier }); ms.push(Date.now() - t0); ps.push(p); if (p.tier === tier) hit++; });
    GEN[tier] = { ps: ps, ms: ms, hit: hit };
    var sorted = ms.slice().sort(function (a, b) { return a - b; }), med = sorted[10], mx = sorted[19];
    var avg = ps.reduce(function (a, p) { return a + p.score; }, 0) / ps.length;
    GEN[tier].avg = avg;
    t.ok("bậc " + tier + ": " + hit + "/20 seed đạt đúng khoảng điểm (≥ 90 %)", hit >= 18, ps.map(function (p) { return p.score + "/" + p.tier; }).join(" "));
    t.ok("bậc " + tier + ": generate trung vị " + med + " ms ≤ 1500 và xấu nhất " + mx + " ms ≤ 4000 (20 seed)", med <= 1500 * SLACK && mx <= 4000 * SLACK, ms.join(","));
    t.info("bậc " + tier + ": điểm trung bình " + avg.toFixed(2) + " (min " + Math.min.apply(null, ps.map(function (p) { return p.score; })) + ", max " + Math.max.apply(null, ps.map(function (p) { return p.score; })) + "), số ô cho sẵn trung bình " +
      (ps.reduce(function (a, p) { return a + p.initial.v.filter(Boolean).length; }, 0) / ps.length).toFixed(1) + ", ms trung vị/xấu nhất " + med + "/" + mx);
  });
  t.ok("điểm trung bình đơn điệu theo bậc: dễ < vừa < khó < chuyên gia", GEN.easy.avg < GEN.medium.avg && GEN.medium.avg < GEN.hard.avg && GEN.hard.avg < GEN.expert.avg,
    TIER_IDS.map(function (x) { return x + " " + GEN[x].avg.toFixed(2); }).join(" < "));
  (function () {
    var bad = [], same = 0, tot = 0;
    TIER_IDS.forEach(function (tier) {
      GEN[tier].ps.forEach(function (p, i) {
        tot++;
        var d = dlx(p.initial.v, 2);
        if (d.count !== 1) bad.push(tier + "#" + i + ": DLX đếm " + d.count + " nghiệm");
        else if (str(d.solution) !== str(p.solution.v)) bad.push(tier + "#" + i + ": solution khác nghiệm DLX");
        if (p.data.unique !== true || p.type !== "sudoku" || p.size !== 9 || p.sizeId !== "9" || p.seed !== SEEDS[i] || p.id !== U.puzzleId(p) || p.initial.v.length !== 81 || !T.validate(p).ok) bad.push(tier + "#" + i + ": hồ sơ puzzle sai");
        if (p.score !== T.difficulty(p) || p.tier !== U.tierOfScore(p.score).id) bad.push(tier + "#" + i + ": score/tier không khớp difficulty()");
        if (p.initial.v.some(function (x, k) { return x && x !== p.solution.v[k]; })) bad.push(tier + "#" + i + ": ô cho sẵn lệch lời giải");
      });
    });
    t.ok("mọi đề sinh ra (" + tot + " đề, đủ bốn bậc): DLX độc lập đếm đúng 1 nghiệm, trùng solution, hồ sơ đầy đủ, score = difficulty()", bad.length === 0, bad.slice(0, 5));
    var detBad = [];
    TIER_IDS.forEach(function (tier) { [5, 99, 123456789].forEach(function (sd) { var a = T.generate(sd, { sizeId: "9", tier: tier }), b = T.generate(sd, { sizeId: "9", tier: tier }); if (js(a) !== js(b)) detBad.push(tier + "/" + sd); }); });
    t.ok("tất định: cùng (seed, sizeId, tier) → cùng puzzle từng bit (12 cặp)", detBad.length === 0, detBad);
    t.ok("khác seed → khác đề", js(T.generate(1, { tier: "medium" }).initial) !== js(T.generate(2, { tier: "medium" }).initial));
    var weird = [T.generate("abc", { tier: "easy" }), T.generate(null), T.generate(undefined, { tier: "nope", sizeId: "zzz" }), T.generate(-5, {}), T.generate(1e20, { tier: "hard" })];
    t.ok("seed/tier/size lạ không ném lỗi và vẫn ra đề duy nhất", weird.every(function (p) { return p && T.validate(p).status === "unique"; }));
    var sc = []; TIER_IDS.forEach(function (x) { GEN[x].ps.forEach(function (p) { sc.push(p.score); }); });
    t.ok("điểm luôn trong 0–10, một chữ số thập phân", sc.every(function (x) { return x >= 0 && x <= 10 && Math.abs(x * 10 - Math.round(x * 10)) < 1e-9; }));
  })();
  (function () {                    // độ khó của chính engine đúng thứ tự trên các đề công bố
    var sc = PUBLISHED.map(function (pub) { return T.difficulty(T.fromInput(pub.grid).puzzle); });
    t.ok("điểm đề công bố: kinh điển (dễ) < đề chống vét cạn/Inkala (khó nhất)", sc[0] < 3.5 && sc[2] >= 7.5, sc.join(", "));
    t.ok("difficulty của đề hỏng không ném lỗi (trả 0)", T.difficulty(null) === 0 && T.difficulty({}) === 0 && T.difficulty({ initial: { v: [1, 2] } }) === 0);
  })();

  // ======================================================================== 5. moveFor / check / mistakes
  t.group("Sudoku — moveFor, check, mistakes");
  var P0 = T.generate(31337, { tier: "medium" }), SOL = P0.solution.v;
  (function () {
    var rng = R.create(4), st = T.newState(P0), bad = [], i, k, acts, diff, before, after, applied = 0, nulls = 0;
    t.ok("newState: v = initial, c = 81 số 0", js(st.v) === js(P0.initial.v) && st.c.length === 81 && st.c.every(function (x) { return x === 0; }) && st.v !== P0.initial.v);
    for (k = 0; k < 800; k++) {
      i = rng.int(81);
      acts = [{ k: "set", i: i, val: rng.int(10) }, { k: "cand", i: i, bit: rng.range(1, 9) }, { k: "clearcand", i: i }, { k: "autocand" }];
      var act = acts[rng.int(acts.length)], settings = { autoRemove: rng.chance(0.5) };
      before = G.copyState(st);
      diff = T.moveFor(P0, st, act, settings);
      if (!diff) { nulls++; if (js(st) !== js(before)) bad.push("moveFor làm đổi state ở bước " + k); continue; }
      if (!diff.d.length || !diff.d.every(function (e) { return (e[0] === "v" || e[0] === "c") && e[2] !== e[3]; })) bad.push("diff rỗng/không đổi ở " + js(act));
      if (diff.d.some(function (e) { return e[0] === "v" && P0.initial.v[e[1]]; })) bad.push("sửa ô cho sẵn " + js(act));
      var snap = G.copyState(st);
      G.applyDiff(st, diff.d, false);
      after = G.copyState(st);
      G.applyDiff(st, G.reverseDiff(diff.d), false);
      if (js(st) !== js(snap)) bad.push("hoàn lại diff không ra state cũ ở " + js(act));
      G.applyDiff(st, diff.d, false); applied++;
      if (js(st) !== js(after)) bad.push("áp lại diff khác lần đầu");
    }
    t.ok("800 thao tác ngẫu nhiên (" + applied + " áp được, " + nulls + " bị từ chối): mọi diff áp rồi hoàn lại đúng state cũ, không sửa ô cho sẵn", bad.length === 0, bad.slice(0, 4));
  })();
  (function () {
    var st = T.newState(P0), gi = P0.initial.v.map(function (x, i) { return x ? i : -1; }).filter(function (i) { return i >= 0; });
    t.ok("ô cho sẵn: mọi loại action đều bị từ chối", gi.every(function (i) { return !T.moveFor(P0, st, { k: "set", i: i, val: 5 }, {}) && !T.moveFor(P0, st, { k: "set", i: i, val: 0 }, {}) && !T.moveFor(P0, st, { k: "cand", i: i, bit: 3 }, {}) && !T.moveFor(P0, st, { k: "clearcand", i: i }, {}); }) && gi.every(function (i) { return T.isGiven(P0, i); }));
    var empties = P0.initial.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; });
    t.ok("isGiven false ở ô trống và ngoài phạm vi", empties.every(function (i) { return !T.isGiven(P0, i); }) && !T.isGiven(P0, -1) && !T.isGiven(P0, 81) && !T.isGiven(P0, 1.5));
    var junk = [null, undefined, 5, "set", [], {}, { k: "set" }, { k: "set", i: 81, val: 1 }, { k: "set", i: -1, val: 1 }, { k: "set", i: 0.5, val: 1 }, { k: "set", i: empties[0], val: 10 }, { k: "set", i: empties[0], val: -1 },
      { k: "set", i: empties[0], val: "3" }, { k: "cand", i: empties[0], bit: 0 }, { k: "cand", i: empties[0], bit: 10 }, { k: "wat" }, { k: "set", i: empties[0], val: 0 }, { k: "clearcand", i: empties[0] }];
    var threw = false, res = [];
    try { junk.forEach(function (a) { res.push(T.moveFor(P0, st, a, {})); }); T.moveFor(null, st, { k: "autocand" }); T.moveFor(P0, null, { k: "autocand" }); T.moveFor(P0, { v: [1] }, { k: "autocand" }); } catch (e) { threw = e; }
    t.ok("action/state hỏng không ném lỗi và trả null", !threw && res.every(function (x) { return x === null; }), String(threw));
    var e0 = empties[0], s1 = T.newState(P0), d1 = T.moveFor(P0, s1, { k: "set", i: e0, val: SOL[e0] }, {});
    t.ok("set điền số: diff gồm đúng ô đó (settings không có autoRemove)", d1 && d1.d.length === 1 && js(d1.d[0]) === js(["v", e0, 0, SOL[e0]]), js(d1));
    G.applyDiff(s1, d1.d, false);
    t.ok("điền lại cùng số → null (không đổi)", T.moveFor(P0, s1, { k: "set", i: e0, val: SOL[e0] }, {}) === null);
    var d2 = T.moveFor(P0, s1, { k: "set", i: e0, val: 0 }, {});
    t.ok("set 0 xoá ô", d2 && js(d2.d) === js([["v", e0, SOL[e0], 0]]));
    t.ok("cand trên ô đã điền bị từ chối", T.moveFor(P0, s1, { k: "cand", i: e0, bit: 4 }, {}) === null);
    // autoRemove: ứng viên của hàng/cột/block được gạt CÙNG một diff, ô tự xoá ứng viên của chính nó
    var s2 = T.newState(P0); G.applyDiff(s2, T.moveFor(P0, s2, { k: "autocand" }, {}).d, false);
    var e1 = empties[5], dig = SOL[e1], da = T.moveFor(P0, s2, { k: "set", i: e1, val: dig }, { autoRemove: true });
    var expectPeers = s2.c.map(function (m, i) { return i !== e1 && !P0.initial.v[i] && (Math.floor(i / 9) === Math.floor(e1 / 9) || i % 9 === e1 % 9 || (Math.floor(i / 27) === Math.floor(e1 / 27) && Math.floor((i % 9) / 3) === Math.floor((e1 % 9) / 3))) && (m & (1 << dig)) ? i : -1; }).filter(function (i) { return i >= 0; });
    var gotPeers = da.d.filter(function (e) { return e[0] === "c" && e[1] !== e1; }).map(function (e) { return e[1]; }).sort(function (a, b) { return a - b; });
    t.ok("set + autoRemove: gạt đúng chữ số khỏi ứng viên mọi ô cùng hàng/cột/block, trong MỘT diff (" + gotPeers.length + " ô)", js(gotPeers) === js(expectPeers) && gotPeers.length > 0 && da.d.some(function (e) { return e[0] === "c" && e[1] === e1 && e[3] === 0; }) &&
      da.d.every(function (e) { return e[0] === "v" || (e[0] === "c" && e[3] === (e[1] === e1 ? 0 : e[2] & ~(1 << dig))); }));
    var s3 = G.copyState(s2); G.applyDiff(s3, da.d, false); G.applyDiff(s3, G.reverseDiff(da.d), false);
    t.ok("một lần undo hoàn lại cả số và các ứng viên đã gạt", js(s3) === js(s2));
    // cand: bật/tắt
    var ec = empties[2], dc = T.moveFor(P0, T.newState(P0), { k: "cand", i: ec, bit: 7 }, {}); var s4 = T.newState(P0); G.applyDiff(s4, dc.d, false);
    var dc2 = T.moveFor(P0, s4, { k: "cand", i: ec, bit: 7 }, {});
    t.ok("cand bật rồi tắt cùng bit; bit = 1 << chữ số", s4.c[ec] === 128 && dc2.d[0][3] === 0);
    t.ok("clearcand xoá hết; ô không có ứng viên → null", T.moveFor(P0, s4, { k: "clearcand", i: ec }, {}).d[0][3] === 0 && T.moveFor(P0, T.newState(P0), { k: "clearcand", i: ec }, {}) === null);
    // autocand đối chiếu tính tay độc lập
    var sa = T.newState(P0), dd = T.moveFor(P0, sa, { k: "autocand" }, {}); G.applyDiff(sa, dd.d, false);
    var bad = 0;
    for (var i = 0; i < 81; i++) {
      var want = 0;
      if (!P0.initial.v[i]) for (var d = 1; d <= 9; d++) if (validCell(P0.initial.v, i, d)) want |= 1 << d;
      if (sa.c[i] !== want) bad++;
    }
    t.ok("autocand: ứng viên mọi ô trống = các chữ số chưa có trong hàng/cột/block (đối chiếu vòng lặp độc lập), ô cho sẵn = 0, một diff", bad === 0 && dd.d.every(function (e) { return e[0] === "c"; }));
    t.ok("autocand lần hai không đổi gì → null", T.moveFor(P0, sa, { k: "autocand" }, {}) === null);
  })();
  (function () {
    var s = { v: SOL.slice(), c: null }, c0 = T.check(P0, s);
    t.ok("check(lời giải) = solved, không xung đột, filled 81/81", c0.solved && c0.conflicts.length === 0 && c0.filled === 81 && c0.total === 81);
    var st = T.newState(P0), c1 = T.check(P0, st);
    t.ok("check(ván mới): chưa xong, không xung đột, filled = số ô cho sẵn", !c1.solved && c1.conflicts.length === 0 && c1.filled === P0.initial.v.filter(Boolean).length);
    var rng = R.create(8), bad = [];
    for (var k = 0; k < 120; k++) {
      var v = SOL.slice(), n = rng.range(1, 6);
      for (var q = 0; q < n; q++) v[rng.int(81)] = rng.chance(0.15) ? 0 : rng.range(1, 9);
      var want = [];
      for (var i = 0; i < 81; i++) for (var j = 0; j < 81; j++) if (i !== j && v[i] && v[i] === v[j] && (Math.floor(i / 9) === Math.floor(j / 9) || i % 9 === j % 9 || (Math.floor(i / 27) === Math.floor(j / 27) && Math.floor((i % 9) / 3) === Math.floor((j % 9) / 3)))) { if (want.indexOf(i) < 0) want.push(i); }
      want.sort(function (a, b) { return a - b; });
      var cc = T.check(P0, { v: v, c: null });
      if (js(cc.conflicts) !== js(want) || cc.solved !== (want.length === 0 && v.every(Boolean))) bad.push(k);
    }
    t.ok("conflicts đúng tập ô trùng chữ số trong hàng/cột/block (120 lưới bị sửa, đối chiếu vòng lặp)", bad.length === 0, bad.slice(0, 5));
    t.ok("check với state hỏng không ném lỗi", !T.check(P0, null).solved && !T.check(P0, { v: [1, 2, 3] }).solved && T.check(P0, {}).total === 81);
    // mistakes: đề duy nhất → so với solution
    var e = P0.initial.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; })[3];
    var wrong = SOL[e] % 9 + 1;
    t.eq("mistakes: điền đúng = 0, điền sai = 1, xoá = 0", [T.mistakes(P0, st, { d: [["v", e, 0, SOL[e]]] }), T.mistakes(P0, st, { d: [["v", e, 0, wrong]] }), T.mistakes(P0, st, { d: [["v", e, SOL[e], 0]] })], [0, 1, 0]);
    t.eq("mistakes: chỉ đếm trường v; diff c không tính; diff nhiều ô", [T.mistakes(P0, st, { d: [["c", e, 0, 4]] }), T.mistakes(P0, st, { d: [["v", e, 0, wrong], ["c", e, 5, 0]] })], [0, 1]);
    t.ok("mistakes với diff hỏng trả 0", T.mistakes(P0, st, null) === 0 && T.mistakes(P0, st, {}) === 0);
    // đề nhiều nghiệm: tính theo luật
    var multi = T.fromInput(str(blank(fullGrid(5), 45, R.create(5)))).puzzle, ms = T.newState(multi), me = multi.initial.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; })[0];
    var other = multi.initial.v.findIndex(function (x, i) { return x && i !== me && (Math.floor(i / 9) === Math.floor(me / 9)); });
    var dupDigit = other >= 0 ? multi.initial.v[other] : multi.initial.v.find(Boolean);
    t.ok("đề nhiều nghiệm (data.unique=false): chữ số trùng ô cùng hàng/cột/block bị tính sai, số hợp lệ thì không", multi.data.unique === false &&
      (other < 0 || T.mistakes(multi, ms, { d: [["v", me, 0, dupDigit]] }) === 1) && T.mistakes(multi, ms, { d: [["v", me, 0, multi.solution.v[me]]] }) === 0);
  })();
  (function () {
    // chơi thật bằng Puz.game: giải xong → solved, đếm lỗi
    var g = G.create(P0, { now: function () { return 1000; }, settings: { autoRemove: true } }), empties = P0.initial.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; });
    var wr = g.act({ k: "set", i: empties[0], val: SOL[empties[0]] % 9 + 1 });
    t.ok("Puz.game + engine: nước sai tính 1 lỗi, undo giữ số lỗi", wr.ok && wr.mistakes === 1 && g.counters.mistakes === 1 && g.undo() && g.counters.mistakes === 1);
    empties.forEach(function (i) { g.act({ k: "set", i: i, val: SOL[i] }); });
    t.ok("điền đủ lời giải → ván solved", g.status === "solved" && g.check().solved && g.counters.mistakes === 1);
  })();

  // ======================================================================== 6. hint
  t.group("Sudoku — hint: mức 1/2/3, sửa lỗi, chạy thật tới khi giải xong");
  var HINT_SET = [];
  TIER_IDS.forEach(function (tier) { for (var q = 0; q < 3; q++) HINT_SET.push({ name: tier + "#" + q, p: GEN[tier].ps[q * 5] }); });
  PUBLISHED.forEach(function (pub, i) { HINT_SET.push({ name: "công bố #" + i, p: T.fromInput(pub.grid).puzzle }); });
  (function () {
    var techs = {}, bad = [], totalSteps = 0, detBad = [], t0 = Date.now(), errCount = 0, ignoreBad = 0, none = 0;
    HINT_SET.forEach(function (hs, idx) {
      var p = hs.p, sol = p.solution.v, rng = R.create(900 + idx), st = T.newState(p), steps = 0, injectAt = rng.range(3, 12), injected = false, total = 81;
      while (!T.check(p, st).solved && steps < total * 3) {
        if (steps === injectAt && !injected) {            // chèn một nước sai (xen kẽ: trùng số trong hàng / sai nhưng chưa trùng)
          var empties = st.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; });
          var cell = rng.pick(empties), wrong, tries = 0;
          do { wrong = rng.range(1, 9); tries++; } while ((wrong === sol[cell] || (idx % 2 === 0 && !(function () { for (var k = 0; k < 9; k++) if (st.v[Math.floor(cell / 9) * 9 + k] === wrong) return true; return false; })())) && tries < 60);
          if (wrong === sol[cell]) wrong = sol[cell] % 9 + 1;
          var dw = T.moveFor(p, st, { k: "set", i: cell, val: wrong }, {}); G.applyDiff(st, dw.d, false); injected = true; steps++; continue;
        }
        var h3 = T.hint(p, st, 3), h1 = T.hint(p, st, 1), h2 = T.hint(p, st, 2);
        if (h3.none) { none++; bad.push(hs.name + ": hint none khi chưa xong: " + h3.text); break; }
        if (!(h3.action && h3.action.k === "set" && h3.text && h3.why.length && h3.cells.length && h3.technique)) { bad.push(hs.name + ": hint mức 3 thiếu trường " + js(h3).slice(0, 160)); break; }
        techs[h3.technique] = (techs[h3.technique] || 0) + 1;
        var isErr = h3.technique === "error";
        if (isErr) {
          errCount++;
          if (h3.action.val !== 0 || (st.v[h3.action.i] === sol[h3.action.i]) || P0.initial.v === null) bad.push(hs.name + ": hint sửa lỗi nhưng ô không sai: " + js(h3.action));
          if (!/sai/.test(h1.text) || !/sai/.test(h2.text) || h2.cells[0] !== h3.action.i || h1.technique !== "error" || h2.technique !== "error") bad.push(hs.name + ": mức 1/2 của hint lỗi không nói về ô sai");
        } else {
          if (h3.action.val !== sol[h3.action.i] || st.v[h3.action.i] !== 0) bad.push(hs.name + ": hint mức 3 không phải nước đúng " + js(h3.action));
          if (h2.cells.length < 1 || h2.action || h1.action) bad.push(hs.name + ": mức 1/2 không được có action");
          var stripped = h1.text.replace(STRIP, "");
          if (/\d|\{/.test(stripped)) bad.push(hs.name + ": mức 1 lộ chữ số: " + h1.text);
          if (h1.cells.length < 9 || h1.level !== 1 || h2.level !== 2 || h3.level !== 3) bad.push(hs.name + ": level/cells của mức 1 sai");
          if (!new RegExp(cn(h3.action.i)).test(h3.text)) bad.push(hs.name + ": text mức 3 không nêu ô");
        }
        [h1, h2, h3].forEach(function (h) { var all = [h.text].concat(h.why); all.forEach(function (s) { if (typeof s !== "string" || !s.trim() || /undefined|null|NaN|\[object/.test(s)) bad.push(hs.name + ": chuỗi hint xấu " + js(s)); }); });
        if (steps % 9 === 0) { var again = T.hint(p, st, 3); if (js(again) !== js(h3)) detBad.push(hs.name + "@" + steps); }
        if (steps % 11 === 0) {                           // ghi chú pencil (có thể sai) không được ảnh hưởng gợi ý
          var junk = G.copyState(st); junk.c = junk.c.map(function (_, i) { return (i * 37 + steps) % 512 & ~1; });
          if (js(T.hint(p, junk, 3)) !== js(h3)) ignoreBad++;
        }
        var df = T.moveFor(p, st, h3.action, { autoRemove: steps % 2 === 0 });
        if (!df) { bad.push(hs.name + ": action của hint bị moveFor từ chối " + js(h3.action)); break; }
        G.applyDiff(st, df.d, false); steps++;
      }
      totalSteps += steps;
      if (!T.check(p, st).solved) bad.push(hs.name + ": lặp hint mức 3 KHÔNG giải xong sau " + steps + " bước");
      if (steps > total * 3) bad.push(hs.name + ": vượt total*3 bước");
      if (T.check(p, st).solved) { var hd = T.hint(p, st, 2); if (!(hd.none === true && hd.text && hd.level === 2)) bad.push(hs.name + ": đã xong mà hint không trả none"); }
    });
    t.ok(HINT_SET.length + " đề (4 bậc × 3 + 3 đề công bố): lặp 'hint mức 3 → áp dụng' (có chèn một nước sai) đều giải xong trong ≤ total×3 bước (" + totalSteps + " bước, " + (Date.now() - t0) + " ms)", bad.length === 0, bad.slice(0, 5));
    t.ok("nhánh sửa lỗi được dùng (" + errCount + " lần): hint nói ô sai trước, action xoá đúng ô sai", errCount >= HINT_SET.length - 1, errCount);
    t.ok("cùng trạng thái + cùng mức → cùng hint (tất định)", detBad.length === 0, detBad);
    t.ok("ghi chú pencil của người chơi (kể cả sai) không làm đổi hint", ignoreBad === 0, ignoreBad);
    t.info("kỹ thuật xuất hiện ở hint (kỹ thuật đầu chuỗi): " + js(techs));
    t.ok("hint dùng ít nhất naked single và hidden single", techs["naked-single"] > 0 && techs["hidden-single"] > 0);
  })();
  (function () {
    // đề cần kỹ thuật cao: hint mức 3 phải kể rõ phép loại ứng viên rồi dẫn tới một nước điền
    var found = null, chainTech = {};
    for (var s = 0; s < 40 && !found; s++) {
      var p = T.generate(7000 + s, { tier: s % 2 ? "hard" : "expert" }), st = T.newState(p), sol = p.solution.v, n = 0;
      while (!T.check(p, st).solved && n < 90) {
        var h = T.hint(p, st, 3);
        if (!["naked-single", "hidden-single", "error"].some(function (x) { return x === h.technique; })) {
          chainTech[h.technique] = (chainTech[h.technique] || 0) + 1;
          if (!found && h.technique !== "guess") found = { h: h, h1: T.hint(p, st, 1), h2: T.hint(p, st, 2), p: p, st: G.copyState(st) };
        }
        G.applyDiff(st, T.moveFor(p, st, h.action, {}).d, false); n++;
      }
    }
    t.info("kỹ thuật cao gặp ở mức 3: " + js(chainTech));
    t.ok("tìm được hint cần kỹ thuật cao hơn single (không phải đoán) trong 40 đề khó", !!found);
    if (found) {
      var f = found, sol = f.p.solution.v;
      t.ok("hint kỹ thuật cao: why có 'Bước 1', nêu phép loại ('loại') và kết bằng nước điền đúng", f.h.why.some(function (x) { return /Bước 1/.test(x); }) && f.h.why.some(function (x) { return /loại/.test(x); }) && f.h.action.val === sol[f.h.action.i], f.h.why.join(" | "));
      t.ok("mức 1 nói nên nhìn vùng nào (cells là cả đơn vị) và không lộ chữ số; mức 2 chỉ ô/mẫu cụ thể", f.h1.cells.length >= 9 && !/\d|\{/.test(f.h1.text.replace(STRIP, "")) && f.h2.cells.length >= 1 && f.h2.technique === f.h.technique && f.h1.technique === f.h.technique, js([f.h1.text, f.h2.text]));
      t.info("ví dụ — mức 1: " + f.h1.text + " | mức 2: " + f.h2.text + " | mức 3: " + f.h.text + " | why đầu: " + f.h.why[0]);
    }
    var guessP = T.fromInput(PUBLISHED[2].grid).puzzle, hg = T.hint(guessP, T.newState(guessP), 3), seenGuess = false, stg = T.newState(guessP), ng = 0;
    while (!T.check(guessP, stg).solved && ng < 90) { var hh = T.hint(guessP, stg, 3); if (hh.technique === "guess") { seenGuess = true; t.ok("hint đoán: nước điền đúng lời giải, why nêu loại các ứng viên khác", hh.action.val === guessP.solution.v[hh.action.i] && hh.why.some(function (x) { return /mâu thuẫn/.test(x); }), hh.why.join(" | ")); break; } G.applyDiff(stg, T.moveFor(guessP, stg, hh.action, {}).d, false); ng++; }
    t.ok("đề Inkala dẫn tới bước 'đoán' trong chuỗi hint", seenGuess);
  })();
  (function () {
    var p = HINT_SET[0].p, junkStates = [null, undefined, {}, { v: [1, 2, 3] }, { v: new Array(81).join("x").split("x") }];
    var threw = false, outs = [];
    try { junkStates.forEach(function (s) { outs.push(T.hint(p, s, 3)); }); outs.push(T.hint(null, T.newState(p), 3)); outs.push(T.hint(p, T.newState(p), 99)); outs.push(T.hint(p, T.newState(p), -3)); outs.push(T.hint(p, T.newState(p), "x")); } catch (e) { threw = e; }
    t.ok("hint với state/đề/level hỏng không ném lỗi, trả hint có text", !threw && outs.every(function (h) { return h && typeof h.text === "string" && h.text && typeof h.level === "number"; }), String(threw));
    var unsolv = T.validate(pz(arr(PUBLISHED[0].grid))); // đề không có lời giải trong hồ sơ
    var noSol = { v: 1, type: "sudoku", data: { unique: true }, initial: { v: arr(PUBLISHED[0].grid) }, solution: null };
    var hn = T.hint(noSol, T.newState(noSol), 3);
    t.ok("đề không kèm solution vẫn gợi ý được (suy luận từ trạng thái hiện tại)", hn.action && hn.action.k === "set" && hn.action.val === arr(PUBLISHED[0].sol)[hn.action.i]);
  })();

  (function () {
    // nhiều ô sai cùng lúc: hint sửa lần lượt từng ô rồi giải xong; và chơi qua Puz.game (hint + applyHint)
    var p = GEN.medium.ps[3], sol = p.solution.v, st = T.newState(p), rng = R.create(55), wrongCells = [], steps = 0, fixed = 0;
    var empties = st.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; });
    while (wrongCells.length < 3) { var c = rng.pick(empties); if (wrongCells.indexOf(c) < 0) wrongCells.push(c); }
    wrongCells.forEach(function (c) { G.applyDiff(st, T.moveFor(p, st, { k: "set", i: c, val: sol[c] % 9 + 1 }, {}).d, false); });
    while (!T.check(p, st).solved && steps < 243) {
      var h = T.hint(p, st, 3);
      if (h.technique === "error") { fixed++; if (sol[h.action.i] === st.v[h.action.i]) { fixed = -999; break; } }
      var df = T.moveFor(p, st, h.action, {}); if (!df) break;
      G.applyDiff(st, df.d, false); steps++;
    }
    t.ok("ba ô sai cùng lúc: hint sửa lần lượt từng ô (" + fixed + " lần sửa) rồi giải xong (" + steps + " bước)", T.check(p, st).solved && fixed === 3);
    var g = G.create(p, { now: function () { return 5; }, settings: { autoRemove: true } }), n = 0;
    while (!g.finished() && n < 200) { var hh = g.hint(3); if (!hh || hh.none) break; if (!g.applyHint(hh).ok) break; n++; }
    t.ok("Puz.game: g.hint(3) + g.applyHint lặp tới khi solved; bộ đếm gợi ý khớp; không lỗi", g.status === "solved" && g.counters.hints[3] === n && g.counters.mistakes === 0 && g.hintCount() === n, g.status + " " + n);
    var g2 = G.create(p, { now: function () { return 5; } });
    t.ok("g.hint(1)/g.hint(2) không đổi bàn và ghi vào bộ đếm", (function () { var before = js(g2.state); var a = g2.hint(1), b = g2.hint(2); return js(g2.state) === before && a.level === 1 && b.level === 2 && g2.counters.hints[1] === 1 && g2.counters.hints[2] === 1 && !a.action && !b.action; })());
  })();

  // ======================================================================== 7. replay
  t.group("Sudoku — replay: áp tuần tự ra lời giải, từng bước đúng");
  (function () {
    var bad = [], total = 0, techs = {};
    HINT_SET.concat([{ name: "kinh điển rỗng bớt", p: T.fromInput(str(blank(fullGrid(9), 40, R.create(9)))).puzzle }]).forEach(function (hs) {
      var p = hs.p, rp = T.replay(p), st = T.newState(p), sol = p.solution.v;
      if (!rp.length) { bad.push(hs.name + ": replay rỗng"); return; }
      if (rp[0].technique !== "candidates" || !rp[0].diff.d.every(function (e) { return e[0] === "c"; })) bad.push(hs.name + ": bước đầu không phải ghi ứng viên");
      rp.forEach(function (step, k) {
        total++;
        if (!step.text || !step.text.trim() || /undefined|null|NaN/.test(step.text) || !Array.isArray(step.cells) || !step.diff || !step.diff.d.length) bad.push(hs.name + " bước " + k + ": thiếu text/cells/diff");
        (step.why || []).forEach(function (w) { if (!w || /undefined|null|NaN/.test(w)) bad.push(hs.name + " bước " + k + ": why xấu"); });
        techs[step.technique] = (techs[step.technique] || 0) + 1;
        step.diff.d.forEach(function (e) {
          var cur = e[0] === "v" ? st.v[e[1]] : (st.c ? st.c[e[1]] : 0);
          if (cur !== e[2]) bad.push(hs.name + " bước " + k + ": giá trị cũ " + e[2] + " ≠ state " + cur);
          if (e[0] === "v" && (e[2] !== 0 || e[3] !== sol[e[1]])) bad.push(hs.name + " bước " + k + ": điền " + cn(e[1]) + "=" + e[3] + " sai lời giải");
          if (e[0] === "c" && k > 0 && (e[2] & ~e[3]) & (1 << sol[e[1]]) && !step.diff.d.some(function (f) { return f[0] === "v" && f[1] === e[1]; })) bad.push(hs.name + " bước " + k + ": LOẠI nhầm ứng viên đúng " + sol[e[1]] + " ở " + cn(e[1]));
        });
        G.applyDiff(st, step.diff.d, false);
        if (k > 0) for (var i = 0; i < 81; i++) if (!st.v[i] && !(st.c[i] & (1 << sol[i]))) { bad.push(hs.name + " bước " + k + ": ô " + cn(i) + " mất ứng viên đúng"); break; }
      });
      if (!T.check(p, st).solved || js(st.v) !== js(sol)) bad.push(hs.name + ": replay không ra lời giải");
      if (st.c.some(Boolean)) bad.push(hs.name + ": còn ứng viên sót ở ô đã điền");
      for (var r = rp.length - 1; r >= 0; r--) G.applyDiff(st, G.reverseDiff(rp[r].diff.d), false);
      if (js(st.v) !== js(p.initial.v) || st.c.some(Boolean)) bad.push(hs.name + ": hoàn lại toàn bộ replay không về trạng thái đầu");
    });
    t.ok("replay " + total + " bước trên " + (HINT_SET.length + 1) + " đề: diff khớp state, chỉ điền/loại đúng lời giải (độc lập), kết thúc solved, hoàn lại về đầu", bad.length === 0, bad.slice(0, 5));
    t.info("replay — số bước theo kỹ thuật: " + js(techs));
    t.eq("đề đã điền đầy → replay rỗng; đề hỏng → rỗng, không ném lỗi", [T.replay(T.fromInput(str(fullGrid(3))).puzzle).length, T.replay(null).length, T.replay({ initial: { v: [1] } }).length], [0, 0, 0]);
    var ns = T.fromInput(function () { var g = arr(PUBLISHED[0].grid); g[2] = 1; return str(g); }()); // một ô sai-nhưng-hợp-lệ → vô nghiệm → không có puzzle
    t.ok("đề vô nghiệm/nhiều nghiệm: replay vẫn không ném lỗi", T.replay(T.fromInput(str(blank(fullGrid(2), 55, R.create(2)))).puzzle).length >= 0);
  })();

  // ======================================================================== 7b. độ đúng của TỪNG kỹ thuật
  t.group("Sudoku — mọi kỹ thuật của bộ giải người: đúng (không loại nhầm ứng viên thật) và có xuất hiện");
  (function () {
    var ALLT = ["naked-single", "hidden-single", "pointing", "claiming", "naked-pair", "hidden-pair", "naked-triple", "hidden-triple", "x-wing", "swordfish", "xy-wing", "guess"];
    var seen = {}, bad = [], n = 0, t0 = Date.now(), fixed = [];
    function run(p, name) {
      var rp = T.replay(p), st = T.newState(p), sol = p.solution.v;
      n++;
      rp.forEach(function (step, k) {
        if (k > 0) seen[step.technique] = (seen[step.technique] || 0) + 1;
        step.diff.d.forEach(function (e) {
          if (e[0] === "v" && e[3] !== sol[e[1]]) bad.push(name + ": " + step.technique + " điền sai " + cn(e[1]));
          if (e[0] === "c" && k > 0 && (e[2] & ~e[3]) & (1 << sol[e[1]]) && !step.diff.d.some(function (f) { return f[0] === "v" && f[1] === e[1]; })) bad.push(name + ": " + step.technique + " loại nhầm ứng viên đúng ở " + cn(e[1]));
        });
        G.applyDiff(st, step.diff.d, false);
      });
      if (!T.check(p, st).solved) bad.push(name + ": replay không xong");
    }
    for (var s = 1; s <= 20; s++) run(T.generate(s, { tier: "expert" }), "expert/" + s);
    for (s = 1; s <= 4; s++) run(T.generate(s, { tier: "hard" }), "hard/" + s);
    t.ok(n + " đề (expert 1–20, hard 1–4): mọi bước kỹ thuật chỉ điền/loại đúng theo lời giải duy nhất (" + (Date.now() - t0) + " ms)", bad.length === 0, bad.slice(0, 5));
    var missing = ALLT.filter(function (k) { return !seen[k]; });
    t.ok("cả 12 kỹ thuật (single, locked, cặp/bộ ba trần-ẩn, X-Wing, Swordfish, XY-Wing, đoán) đều xuất hiện ít nhất một lần trong replay", missing.length === 0, "thiếu: " + missing.join(", "));
    t.info("số lần mỗi kỹ thuật được dùng: " + js(seen));
  })();

  // ======================================================================== 8. nhập/xuất
  t.group("Sudoku — toFile/fromFile, toText/fromText, fromInput: vòng tròn và đầu vào xấu");
  (function () {
    var bad = [], cases = HINT_SET.map(function (h) { return h.p; });
    cases.push(T.fromInput(str(blank(fullGrid(5), 45, R.create(5)))).puzzle);      // đề nhiều nghiệm cũng phải vòng tròn
    cases.forEach(function (p, i) {
      var f = T.toFile(p), back = T.fromFile(JSON.parse(JSON.stringify(f)));
      if (f.type !== "sudoku" || f.initialState.length !== 81 || f.solution.length !== 81 || f.size !== 9 || f.difficulty !== p.score || f.seed !== p.seed || !f.metadata) bad.push(i + ": toFile thiếu trường " + js(f).slice(0, 120));
      if (!back.ok || js(back.puzzle.initial) !== js(p.initial) || js(back.puzzle.data) !== js(p.data)) bad.push(i + ": fromFile(toFile) không ra initial/data cũ");
      var tx = T.toText(p), bt = T.fromText(tx);
      if (!bt.ok || js(bt.puzzle.initial) !== js(p.initial) || js(bt.puzzle.data) !== js(p.data)) bad.push(i + ": fromText(toText) không ra initial/data cũ");
      var lines = tx.split("\n"), dataLines = lines.filter(function (l) { return /^[0-9.|]+$/.test(l); });
      if (lines.length !== 11 || dataLines.length !== 9 || !dataLines.every(function (l) { return l.replace(/\|/g, "").length === 9 && l.length === 11; }) || lines[3] !== "---+---+---" || lines[7] !== "---+---+---") bad.push(i + ": toText sai khuôn dạng");
    });
    t.ok(cases.length + " đề: toFile→fromFile và toText→fromText giữ nguyên initial và data; toText đúng khuôn 9 dòng + 2 dòng kẻ", bad.length === 0, bad.slice(0, 4));
    var p = cases[0], f = T.toFile(p), md = JSON.parse(JSON.stringify(f)); md.metadata.name = "Đề thử"; md.metadata.note = "ghi chú";
    t.eq("metadata name/note đi qua tệp", [T.fromFile(md).puzzle.meta.name, T.fromFile(md).puzzle.meta.note], ["Đề thử", "ghi chú"]);
    var lie = JSON.parse(JSON.stringify(f)); lie.difficulty = 0.1; lie.solution = new Array(82).join("1");
    var lr = T.fromFile(lie);
    t.ok("fromFile KHÔNG tin difficulty/solution trong tệp: dựng lại, cảnh báo, điểm tính lại", lr.ok && lr.puzzle.score === T.difficulty(lr.puzzle) && lr.puzzle.score > 0.1 && js(lr.puzzle.solution.v) === js(p.solution.v) && lr.warnings.length === 1 && lr.puzzle.tier === "custom", js(lr.warnings));
    // fromText linh hoạt
    var classic = PUBLISHED[0].grid, nice = "53.|.7.|...\r\n6..|195|...\r\n.98|...|.6.\r\n---+---+---\r\n8..|.6.|..3\r\n4..|8.3|..1\r\n7..|.2.|..6\r\n---+---+---\r\n.6.|...|28.\r\n...|419|..5\r\n...|.8.|.79";
    t.ok("fromText nhận dạng gọn 81 ký tự, dạng có | và dòng kẻ (CRLF), khoảng trắng, '.' hoặc 0 là ô trống — cùng một đề", js(T.fromText(classic).puzzle.initial) === js(T.fromText(nice).puzzle.initial) && js(T.fromText(classic.replace(/0/g, ".")).puzzle.initial) === js(T.fromText(classic).puzzle.initial) &&
      js(T.fromText(classic.split("").join(" ")).puzzle.initial) === js(T.fromText(classic).puzzle.initial) && T.fromText(classic).puzzle.initial.v.join("") === classic);
    t.eq("fromInput nhận mảng 81 số, { v }, { initial:{v} }, { text }", [1, 2, 3, 4].map(function (k) { var v = arr(classic); return T.fromInput([v, { v: v }, { initial: { v: v } }, { text: classic }][k - 1]).puzzle.initial.v.join(""); }), [classic, classic, classic, classic]);
    var meta = T.fromInput({ v: arr(classic), name: "  X  ", source: "Wikipedia", note: "n", seed: 42 }).puzzle;
    t.ok("fromInput giữ name/source/note (cắt khoảng trắng) và seed hợp lệ", meta.meta.name === "X" && meta.meta.source === "Wikipedia" && meta.meta.note === "n" && meta.seed === 42);
  })();
  (function () {
    var cl = PUBLISHED[0].grid, bads = [
      ["fromText('')", function () { return T.fromText(""); }], ["fromText('abc')", function () { return T.fromText("abc"); }], ["fromText(80 ký tự)", function () { return T.fromText(cl.slice(1)); }],
      ["fromText(82 ký tự)", function () { return T.fromText(cl + "1"); }], ["fromText(ký tự lạ x)", function () { return T.fromText(cl.slice(0, 40) + "x" + cl.slice(41)); }], ["fromText(chữ cái tiếng Việt)", function () { return T.fromText("Ơ".repeat(81)); }],
      ["fromText(null)", function () { return T.fromText(null); }], ["fromText(số)", function () { return T.fromText(12345); }], ["fromText(chỉ dấu trang trí)", function () { return T.fromText("---+---|||"); }],
      ["fromInput(undefined)", function () { return T.fromInput(undefined); }], ["fromInput(null)", function () { return T.fromInput(null); }], ["fromInput({})", function () { return T.fromInput({}); }], ["fromInput(42)", function () { return T.fromInput(42); }],
      ["fromInput(mảng 80)", function () { return T.fromInput(new Array(80).fill(0)); }], ["fromInput(mảng có 'x')", function () { var a = new Array(81).fill(0); a[7] = "x"; return T.fromInput(a); }], ["fromInput(ô 10)", function () { var a = new Array(81).fill(0); a[7] = 10; return T.fromInput(a); }],
      ["fromInput(ô 1.5)", function () { var a = new Array(81).fill(0); a[7] = 1.5; return T.fromInput(a); }], ["fromInput({v:'abc'})", function () { return T.fromInput({ v: "abc" }); }], ["fromInput({v:{}})", function () { return T.fromInput({ v: {} }); }],
      ["fromFile(null)", function () { return T.fromFile(null); }], ["fromFile([])", function () { return T.fromFile([]); }], ["fromFile('x')", function () { return T.fromFile("x"); }], ["fromFile({})", function () { return T.fromFile({}); }],
      ["fromFile(sai type)", function () { return T.fromFile({ type: "nqueens", initialState: cl }); }], ["fromFile(thiếu initialState)", function () { return T.fromFile({ type: "sudoku" }); }], ["fromFile(initialState ngắn)", function () { return T.fromFile({ type: "sudoku", initialState: "123" }); }],
      ["fromFile(initialState không phải chuỗi)", function () { return T.fromFile({ type: "sudoku", initialState: [1, 2] }); }], ["fromFile(đề trùng số)", function () { return T.fromFile({ type: "sudoku", initialState: "11" + cl.slice(2) }); }],
      ["validate(null)", function () { return T.validate(null); }], ["validate({})", function () { return T.validate({}); }], ["validate(ô sai)", function () { return T.validate({ type: "sudoku", initial: { v: [1, 2, 3] } }); }],
      ["solve(null)", function () { return T.solve(null); }], ["solve({initial:{v:[1]}})", function () { return T.solve({ initial: { v: [1] } }); }]
    ];
    var badList = [];
    bads.forEach(function (b) {
      var r, threw = null;
      try { r = b[1](); } catch (e) { threw = e; }
      var isSolveLike = /^solve/.test(b[0]);
      if (threw) badList.push(b[0] + " ném lỗi: " + threw);
      else if (isSolveLike) { if (r.status !== "none") badList.push(b[0] + ": status " + r.status); }
      else if (r.ok !== false || !(r.errors && r.errors.length) || !r.errors.every(function (e) { return typeof e === "string" && e.trim() && /[a-zà-ỹ]/i.test(e) && !/undefined|null|NaN/.test(e); }) || r.puzzle) badList.push(b[0] + ": " + js(r).slice(0, 140));
    });
    t.ok(bads.length + " đầu vào xấu (rỗng, thiếu trường, sai độ dài, ký tự lạ, sai kiểu, đề trùng số…): ok:false + lỗi tiếng Việt, không ném ngoại lệ", badList.length === 0, badList.slice(0, 5));
    t.ok("toFile/toText/describeCell/isGiven với đầu vào hỏng không ném lỗi", (function () { try { T.toFile(null); T.toFile({}); T.toText(null); T.toText({ initial: { v: [1] } }); T.describeCell(null, null, 5); T.describeCell({}, {}, 999); T.isGiven(null, 3); T.constraintView(null); T.trace(null); return T.toText(null) === ""; } catch (e) { return false; } })());
  })();

  // ======================================================================== 9. constraintView, trace, describeCell
  t.group("Sudoku — constraintView, trace, describeCell");
  (function () {
    var p = P0, cv = T.constraintView(p), givens = p.initial.v.filter(Boolean).length;
    t.ok("constraintView: summary, 81 biến gộp nhóm, 27 ràng buộc all-different, counts", typeof cv.summary === "string" && cv.summary.length > 20 && cv.constraints.length === 27 && cv.counts.variables === 81 && cv.counts.constraints === 27 && cv.counts.givens === givens && cv.counts.blanks === 81 - givens &&
      cv.variables.every(function (x) { return x.name && x.domain && x.count > 0; }) && cv.variables.reduce(function (a, x) { return a + x.count; }, 0) === 81 && cv.variables.length < 12, js(cv.counts));
    t.ok("27 ràng buộc = 9 hàng + 9 cột + 9 block, mỗi chuỗi nêu all-different", cv.constraints.filter(function (s) { return /^Hàng/.test(s); }).length === 9 && cv.constraints.filter(function (s) { return /^Cột/.test(s); }).length === 9 && cv.constraints.filter(function (s) { return /^Block/.test(s); }).length === 9 && cv.constraints.every(function (s) { return /all-different/.test(s) && !/undefined|NaN/.test(s); }));
    t.ok("miền thu hẹp theo ô cho sẵn: nhóm ô trống có miền < 9 giá trị và tổng domainValues khớp bộ ứng viên tính tay", (function () {
      var sum = 0; for (var i = 0; i < 81; i++) { if (p.initial.v[i]) sum++; else for (var d = 1; d <= 9; d++) if (validCell(p.initial.v, i, d)) sum++; }
      return cv.counts.domainValues === sum && cv.variables.some(function (x) { return /thu hẹp/.test(x.domain); });
    })(), js(cv.counts));
  })();
  (function () {
    var cl = T.fromInput(PUBLISHED[0].grid).puzzle, tr = T.trace(cl);
    t.ok("trace đề dễ (giải bằng lan truyền): cây chỉ có nút gốc ở trạng thái solution, note giải thích", tr.kind === "tree" && tr.nodes.length === 1 && tr.nodes[0].status === "solution" && tr.nodes[0].parent === -1 && !tr.truncated && /không cần đoán/.test(tr.note), js(tr).slice(0, 200));
    var hp = T.fromInput(PUBLISHED[2].grid).puzzle, th = T.trace(hp);
    var okShape = function (tr2) {
      return tr2.kind === "tree" && Array.isArray(tr2.nodes) && tr2.nodes.length >= 1 && tr2.nodes.length <= 600 && typeof tr2.truncated === "boolean" && typeof tr2.note === "string" && tr2.note.length > 30 &&
        tr2.nodes.every(function (n, i) { return n.id === i && (i === 0 ? n.parent === -1 : n.parent >= 0 && n.parent < n.id) && typeof n.label === "string" && n.label && /^(fail|dead|ok|solution)$/.test(n.status) && (i === 0 || /^R\dC\d = \d$/.test(n.label)); });
    };
    t.ok("trace đề khó (Inkala): đúng hình dạng mục 3 (≤ 600 nút, cha trước con, label 'R3C4 = 7'), có đúng một nút solution", okShape(th) && th.nodes.length > 1 && th.nodes.filter(function (n) { return n.status === "solution"; }).length === 1 && th.nodes.some(function (n) { return n.status === "fail" || n.status === "dead"; }), th.nodes.length + " nút");
    // đường từ gốc tới nút nghiệm: mọi nút trên đường là ok/solution; nút solution tương ứng lời giải thật
    var byId = th.nodes, sol = byId.filter(function (n) { return n.status === "solution"; })[0], path2 = [], cur = sol;
    while (cur && cur.parent >= 0) { path2.push(cur); cur = byId[cur.parent]; }
    t.ok("mọi nút trên đường tới nghiệm là ok/solution và mọi phép gán trên đó khớp lời giải đúng", path2.every(function (n) { var m = /^R(\d)C(\d) = (\d)$/.exec(n.label); return (n.status === "ok" || n.status === "solution") && hp.solution.v[(+m[1] - 1) * 9 + (+m[2] - 1)] === +m[3]; }) && byId[0].status === "ok");
    var small = T.trace(hp, { maxNodes: 5 });
    t.ok("giới hạn nút tuỳ chọn: maxNodes 5 → ≤ 5 nút và truncated:true", small.nodes.length <= 5 && small.truncated === true && okShape(small));
    var ns = T.fromInput(function () { var g = arr(PUBLISHED[0].grid); return str(g); }()).puzzle;
    var impossible = { v: 1, type: "sudoku", initial: { v: (function () { var g = arr(PUBLISHED[0].grid); for (var i = 0; i < 81; i++) if (!g[i]) for (var d = 1; d <= 9; d++) { if (!validCell(g, i, d)) continue; var g2 = g.slice(); g2[i] = d; if (dlx(g2, 1).count === 0) return g2; } return g; })() }, solution: null };
    var ti = T.trace(impossible);
    t.ok("trace đề vô nghiệm: không có nút solution, gốc không phải solution, vẫn đúng hình dạng", okShape(ti) && ti.nodes.every(function (n) { return n.status !== "solution"; }) && ti.nodes[0].status !== "ok", js(ti.nodes.slice(0, 3)));
    var conflict = { v: 1, type: "sudoku", initial: { v: (function () { var g = new Array(81).fill(0); g[0] = 5; g[1] = 5; return g; })() }, solution: null };
    t.ok("trace đề trùng số: gốc fail", T.trace(conflict).nodes[0].status === "fail");
  })();
  (function () {
    var p = P0, st = T.newState(p), e = p.initial.v.map(function (x, i) { return x ? -1 : i; }).filter(function (i) { return i >= 0; })[0], gv = p.initial.v.findIndex(Boolean);
    var s1 = T.describeCell(p, st, e), s2 = T.describeCell(p, st, gv);
    t.ok("describeCell: ô trống (hàng, cột, trạng thái) và ô cho sẵn (giá trị)", /^Hàng \d, cột \d, ô trống, chưa có ứng viên$/.test(s1) && new RegExp("^Hàng " + (Math.floor(gv / 9) + 1) + ", cột " + (gv % 9 + 1) + ", ô cho sẵn, giá trị " + p.initial.v[gv] + "$").test(s2), s1 + " | " + s2);
    var sc = G.copyState(st); sc.c[e] = (1 << 1) | (1 << 3) | (1 << 7);
    t.eq("describeCell ứng viên đúng dạng 'ứng viên 1 3 7'", T.describeCell(p, sc, e), "Hàng " + (Math.floor(e / 9) + 1) + ", cột " + (e % 9 + 1) + ", ô trống, ứng viên 1 3 7");
    var sf = G.copyState(st); sf.v[e] = 4;
    t.ok("describeCell ô đã điền", /đã điền 4$/.test(T.describeCell(p, sf, e)) && T.describeCell(p, st, 81) === "Ô không hợp lệ");
  })();

  // ======================================================================== 10. solve / hiệu năng đề tự nhập
  t.group("Sudoku — solve: giới hạn nghiệm, ngân sách, kỹ thuật");
  (function () {
    var multi = pz(blank(fullGrid(11), 50, R.create(11))), s2 = T.solve(multi), s1 = T.solve(multi, { limit: 1 }), s5 = T.solve(multi, { limit: 5 });
    t.ok("solve: nhiều nghiệm → status multiple, count ≤ limit (limit 1 → 1, mặc định 2)", s2.status === "multiple" && s2.count === 2 && s1.status === "multiple" && s1.count === 1 && s5.count >= 2 && s5.count <= 5 && isValidFull(s2.solution.v), js([s2.count, s1.count, s5.count]));
    var s0 = T.solve({ type: "sudoku", initial: { v: (function () { var g = fullGrid(12); g[0] = g[1]; return g; })() } });
    t.ok("solve: đề trùng số → none, count 0, solution null, steps rỗng", s0.status === "none" && s0.count === 0 && s0.solution === null && s0.steps.length === 0);
    var sn = T.solve(multi, { steps: false });
    t.ok("solve({steps:false}) bỏ qua bước giải thích", sn.steps.length === 0 && sn.status === "multiple");
    var ten = T.solve(T.fromInput(PUBLISHED[2].grid).puzzle, { maxNodes: 50 });
    t.ok("cạn ngân sách nút → status multiple + cảnh báo 'chưa xác định hết', không treo", ten.status === "multiple" && ten.truncated === true && ten.warnings && /chưa xác định/i.test(ten.warnings[0]), js(ten.warnings));
    var vv = T.validate(pz(arr(PUBLISHED[2].grid)));
    t.ok("validate trả solution khi có", vv.solution && vv.solution.v.length === 81);
    var worst = 0, mx = "";
    PUBLISHED.forEach(function (pub) { var t0 = Date.now(); T.solve(T.fromInput(pub.grid).puzzle); var ms = Date.now() - t0; if (ms > worst) { worst = ms; mx = pub.name; } });
    t.ok("solve + steps (có lời giải thích) ≤ 1 s trên đề công bố, kể cả đề khó (xấu nhất " + worst + " ms)", worst <= 1000 * SLACK, mx);
  })();
};
