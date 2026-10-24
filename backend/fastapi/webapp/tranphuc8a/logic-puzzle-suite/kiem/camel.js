/* kiem/camel.js — kiểm LẠC ĐÀ CHỞ CHUỐI V1 (đợt P4). Nguồn sự thật ĐỘC LẬP với QHĐ g(S) / LB2 của engine:
     · VÉT CẠN trên trạng thái chuẩn hoá (vị trí, kho) — mọi kế hoạch, viết riêng trong test: giá trị tối ưu "xa nhất" / "tới D" ở 17 + 11 bộ nhỏ, và LB2 đối chiếu trên MỌI trạng thái đạt được của 12 bộ;
     · VÉT CẠN THÔ nhất (từng quả một: LẤY 1 / ĐẶT 1 / ĐI ±1 km, không gộp chở với kho) ở bộ B ≤ 6 — kiểm cả phép chuẩn hoá lẫn luật;
     · BỘ MÔ PHỎNG LUẬT viết lại trong test (kho dạng bảng thưa, thao tác dạng chữ) so với def.lib.runRecs trên chuỗi thao tác ngẫu nhiên hợp lệ lẫn sai;
     · DẠNG ĐÓNG liên tục tính lại bằng phân số BigInt (vòng lặp trên S, khác công thức pha của engine);
     · kế hoạch gọn + kế hoạch tiếp nối LB2 chạy bằng bộ mô phỏng của test ra đúng giá trị dự đoán (hàng nghìn bộ / trạng thái giữa chừng ngẫu nhiên), và = vét cạn ở bộ nhỏ.
   Công thức trong thiết kế (2k−1 quả/km, pha đầu (B−(k−1)C)/(2k−1), 1533⅓ …) chỉ được dùng như bảng đối chiếu; sự thật là vét cạn. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("camel"), L = T.lib, G = Puz.game, plan = Puz.plan, R = Puz.rng, GR = Puz.grade;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"], MODES = ["far", "deliver"];
  var OPN = { 1: "go", 2: "load", 3: "drop" };
  function J(x) { return JSON.stringify(x); }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function inBand(score, tier) { var b = Puz.util.tier(tier); return score >= b.min && score < b.max; }
  function mk(mode, B, C, D) { var r = T.fromInput({ mode: mode, B: B, C: C, D: D || 0 }); return r.ok ? r.puzzle : null; }
  function apply(p, s, a) { var d = T.moveFor(p, s, a); if (!d) return null; G.applyDiff(s, d.d, false); return d; }
  function recOps(recs) { return recs.map(function (r) { return [OPN[r[1]], r[2]]; }); }
  function sp(x) { return String(x).replace(/ /g, " "); }
  function valueOfSim(mode, D, sim) { return mode === "far" ? sim.far : (sim.dep[D] || 0) + (sim.pos === D ? sim.load : 0); }

  // ====================================================================== nguồn độc lập 1: bộ mô phỏng luật (viết riêng)
  /** ops = [["go", x] | ["load", n] | ["drop", n]]; kho dạng bảng thưa; không dùng gì của engine. */
  function simulate(B, C, Mx, ops) {
    var pos = 0, load = 0, dep = { 0: B }, far = 0;
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i][0], a = ops[i][1], here = dep[pos] || 0;
      if (o === "load") { if (!(Number.isInteger(a) && a >= 1 && a <= here && load + a <= C)) return { ok: false, at: i }; dep[pos] = here - a; load += a; }
      else if (o === "drop") { if (!(Number.isInteger(a) && a >= 1 && a <= load)) return { ok: false, at: i }; dep[pos] = here + a; load -= a; }
      else if (o === "go") {
        if (!(Number.isInteger(a) && a >= 0 && a <= Mx) || a === pos || Math.abs(a - pos) > load) return { ok: false, at: i };
        load -= Math.abs(a - pos); pos = a; if (a > far) far = a;
      } else return { ok: false, at: i };
    }
    return { ok: true, pos: pos, load: load, far: far, dep: dep };
  }

  // ====================================================================== nguồn độc lập 2: vét cạn trên trạng thái chuẩn hoá
  /** Mỗi bước: chọn mang carry ≥ 1 quả từ kho tại p, đi ±1 km (ăn 1), phần còn lại đặt xuống kho q. Trạng thái (p, kho[0..M]); giá trị = điểm xa nhất (far, tính từ p) hoặc số chuối ở D. */
  function bruteCanon(B, C, M, goal, D) {
    var memo = new Map();
    function rec(p, dep) {
      var key = p + ":" + dep.join(","), hit = memo.get(key);
      if (hit !== undefined) return hit;
      var val = goal === "far" ? p : dep[D], lim = Math.min(C, dep[p]);
      for (var carry = 1; carry <= lim; carry++) for (var dir = -1; dir <= 1; dir += 2) {
        var q = p + dir; if (q < 0 || q > M) continue;
        var nd = dep.slice(); nd[p] -= carry; nd[q] += carry - 1;
        var v = rec(q, nd); if (v > val) val = v;
      }
      memo.set(key, val); return val;
    }
    var d0 = zeros(M + 1); d0[0] = B;
    return { value: rec(0, d0), memo: memo };
  }
  /** Vét cạn THÔ: từng quả một — LẤY 1, ĐẶT 1, ĐI ±1 (cần chở ≥ 1, ăn 1). BFS trên (vị trí, chở, kho); giá trị = max điểm xa / max chuối ở D trên mọi trạng thái đạt được. */
  function bruteRaw(B, C, goal, D) {
    var M = B, seen = new Set(), stack = [], best = 0;
    function push(pos, load, dep) { var k = pos + "/" + load + "/" + dep.join(","); if (seen.has(k)) return; seen.add(k); stack.push([pos, load, dep]); }
    var d0 = zeros(M + 1); d0[0] = B; push(0, 0, d0);
    while (stack.length) {
      var s = stack.pop(), pos = s[0], load = s[1], dep = s[2], v = goal === "far" ? pos : dep[D] + (pos === D ? load : 0);
      if (goal === "far" ? v > best : v > best) best = v;
      var nd;
      if (dep[pos] > 0 && load < C) { nd = dep.slice(); nd[pos]--; push(pos, load + 1, nd); }
      if (load > 0) { nd = dep.slice(); nd[pos]++; push(pos, load - 1, nd); }
      if (load > 0) for (var dir = -1; dir <= 1; dir += 2) { var q = pos + dir; if (q >= 0 && q <= M) push(q, load - 1, dep); }
    }
    return best;
  }
  /** Dạng đóng liên tục bằng phân số BigInt (vòng lặp trên S — khác công thức pha của engine). → {n, d} BigInt. */
  function contFar(B, C) {
    var S = [BigInt(B), 1n], pos = [0n, 1n], bigC = BigInt(C);
    function norm(f) { var a = f[0] < 0n ? -f[0] : f[0], b = f[1]; while (b) { var tt = a % b; a = b; b = tt; } a = a || 1n; return [f[0] / a, f[1] / a]; }
    function add(x, y) { return norm([x[0] * y[1] + y[0] * x[1], x[1] * y[1]]); }
    for (var guard = 0; guard < 100; guard++) {
      if (S[0] <= 0n) break;
      var k = (S[0] + S[1] * bigC - 1n) / (S[1] * bigC), len = norm([S[0] - S[1] * (k - 1n) * bigC, S[1] * (2n * k - 1n)]);
      pos = add(pos, len); S = [(k - 1n) * bigC, 1n];
    }
    return pos;
  }
  function fracStr(f) { return f[1] === 1n ? String(f[0]) : f[0] + "/" + f[1]; }
  function floorF(f) { return Number(f[0] / f[1]); }

  // ====================================================================== 0. đăng ký + siêu dữ liệu
  t.group("camel — đăng ký, siêu dữ liệu");
  t.ok("loại đã đăng ký, tuân giao diện, kind optimize, objective max, có grade", !!T && Puz.types.conformance(T).length === 0 && Puz.types.kindOf(T) === "optimize" && T.objective.sense === "max" && typeof T.grade === "function", Puz.types.conformance(T));
  t.ok("nhãn: sizeLabel, moveLabel nói 'thao tác', mistakeLabel = 'Nước làm mất tối ưu'", T.sizeLabel === "Bài toán" && /thao tác/.test(T.moveLabel) && T.mistakeLabel === "Nước làm mất tối ưu");
  t.ok("hai bài: far (mặc định) và deliver, mỗi bài quảng cáo đủ 4 bậc; không dùng options (chọn bằng cỡ)", T.sizes.length === 2 && T.sizes.filter(function (s) { return s.default; }).map(function (s) { return s.id; }).join() === "far" && T.sizes.map(function (s) { return s.id; }).join() === "far,deliver" && !T.options && T.sizes.every(function (s) { return !s.tiers; }));
  t.ok("họ Mathematical Puzzle, nhóm QHĐ", T.family === "Mathematical Puzzle" && T.category === "QHĐ");
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }), text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 2 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("chữ tiếng Việt (luật, thuật toán, ghi chú): không rỗng, không undefined/null/NaN", T.rules.concat(T.algorithm.steps.map(function (s) { return s.title + s.text; }), [T.blurb, T.difficultyNote]).every(function (x) { return typeof x === "string" && x.trim() && !/\b(undefined|null|NaN)\b/.test(x); }));

  // ====================================================================== 1. bộ mô phỏng luật = bộ mô phỏng độc lập
  t.group("camel — luật: def.lib.runRecs = bộ mô phỏng viết riêng (chuỗi thao tác ngẫu nhiên, hợp lệ lẫn sai)");
  (function () {
    var rng = R.create(2026), bad = [], nOk = 0, nBad = 0, total = 0;
    for (var it = 0; it < 1500; it++) {
      var C = rng.range(2, 9), B = rng.range(C, 4 * C), mode = rng.chance(0.5) ? "far" : "deliver", cfg = L.dataOf("far", B, C, 0);
      var D = mode === "deliver" ? rng.range(1, Math.max(1, cfg.best - 1)) : 0, d = L.dataOf(mode, B, C, D), recs = [], n = rng.range(1, 16), pos = 0, load = 0;
      for (var i = 0; i < n; i++) {                                                                 // dựng chuỗi HỢP LỆ (lọc bằng mô phỏng độc lập), thỉnh thoảng chèn thao tác sai ở cuối
        var r = rng.next(), rec;
        if (r < 0.35) rec = [0, 2, rng.range(0, C + 2)]; else if (r < 0.6) rec = [0, 3, rng.range(0, C + 2)]; else rec = [0, 1, rng.range(-1, d.maxX + 2)];
        if (simulate(B, C, d.maxX, recOps(recs.concat([rec]))).ok) recs.push(rec);
        else if (rng.chance(0.012) && recs.length) { recs.push(rec); break; }
      }
      if (!recs.length) continue;
      var mine = simulate(B, C, d.maxX, recOps(recs)), eng = L.runRecs(d, recs);
      total++;
      if (mine.ok !== eng.ok || (!mine.ok && mine.at !== eng.at)) { bad.push({ B: B, C: C, mode: mode, recs: recs, mine: mine.ok ? "ok" : mine.at, eng: eng.ok ? "ok" : eng.at }); continue; }
      if (mine.ok) {
        nOk++;
        var s = eng.sim;
        if (s.pos !== mine.pos || s.load !== mine.load || s.far !== mine.far || valueOfSim(mode, D, mine) !== L.valueOfSim(d, s)) bad.push({ B: B, C: C, recs: recs, why: "trạng thái cuối khác" });
      } else nBad++;
    }
    t.ok("mô phỏng engine khớp mô phỏng độc lập ở " + total + " chuỗi (" + nOk + " hợp lệ trọn, " + nBad + " có thao tác sai — đúng vị trí thao tác sai đầu tiên)", bad.length === 0 && nOk > 800 && nBad > 5, bad.slice(0, 3));
  })();

  // ====================================================================== 2. tối ưu rời rạc = vét cạn
  t.group("camel — tối ưu (QHĐ theo km) đối chiếu vét cạn MỌI kế hoạch");
  var FAR_SETS = [[2, 2], [4, 2], [6, 2], [3, 3], [6, 3], [9, 3], [7, 3], [8, 3], [4, 4], [8, 4], [12, 4], [10, 4], [5, 5], [10, 5], [13, 5], [15, 5], [12, 6]];
  var DEL_SETS = [[6, 2, 2], [6, 2, 3], [9, 3, 2], [9, 3, 3], [9, 3, 4], [12, 4, 3], [12, 4, 5], [8, 3, 2], [10, 4, 3], [15, 5, 4], [15, 5, 6]];
  (function () {
    var bad = [], tot = 0;
    FAR_SETS.forEach(function (c) {
      var B = c[0], C = c[1], M = floorF(contFar(B, C)) + 2, br = bruteCanon(B, C, M, "far", 0);
      tot += br.memo.size;
      var dd = L.dataOf("far", B, C, 0);
      if (br.value !== L.farDisc(B, C) || br.value !== dd.best) bad.push(["far", B, C, br.value, L.farDisc(B, C)]);
    });
    t.ok("'đi xa nhất': farDisc = vét cạn ở " + FAR_SETS.length + " bộ (B ≤ 15, C ≤ 6; " + tot + " trạng thái)", bad.length === 0, bad.slice(0, 3));
    bad = []; tot = 0;
    DEL_SETS.forEach(function (c) {
      var B = c[0], C = c[1], D = c[2], br = bruteCanon(B, C, D, "deliver", D);
      tot += br.memo.size;
      if (br.value !== L.deliverDisc(B, C, D) || br.value !== L.dataOf("deliver", B, C, D).best) bad.push(["deliver", B, C, D, br.value, L.deliverDisc(B, C, D)]);
    });
    t.ok("'chở tới D': deliverDisc = vét cạn ở " + DEL_SETS.length + " bộ (" + tot + " trạng thái)", bad.length === 0, bad.slice(0, 3));
    var big = [[18, 6], [20, 5], [16, 8], [21, 7], [24, 6]], bb = [];
    big.forEach(function (c) { var br = bruteCanon(c[0], c[1], floorF(contFar(c[0], c[1])) + 2, "far", 0); if (br.value !== L.farDisc(c[0], c[1])) bb.push(c.concat([br.value])); });
    t.ok("bộ lớn hơn 18/6 … 24/6 cũng khớp vét cạn", bb.length === 0, bb);
  })();
  (function () {
    var bad = [], n = 0;
    [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [3, 3], [4, 3], [5, 3], [6, 3], [4, 4], [5, 4], [6, 4], [6, 6]].forEach(function (c) { var raw = bruteRaw(c[0], c[1], "far", 0); n++; if (raw !== L.farDisc(c[0], c[1])) bad.push(["far", c, raw, L.farDisc(c[0], c[1])]); });
    [[6, 2, 2], [6, 2, 3], [6, 3, 2], [6, 3, 3], [5, 3, 2], [6, 3, 4], [6, 4, 3], [4, 2, 2]].forEach(function (c) { var raw = bruteRaw(c[0], c[1], "deliver", c[2]); n++; if (raw !== L.deliverDisc(c[0], c[1], c[2])) bad.push(["deliver", c, raw, L.deliverDisc(c[0], c[1], c[2])]); });
    t.ok("vét cạn THÔ (từng quả một, không gộp chở với kho, B ≤ 6) khớp QHĐ ở " + n + " bộ — kiểm cả phép chuẩn hoá lẫn luật", bad.length === 0, bad.slice(0, 3));
  })();
  (function () {
    var bad = [];
    [[3000, 1000], [2500, 1000], [45, 15], [420, 105], [1575, 315], [100, 30], [30, 15], [7, 3], [1000, 1000], [999, 1000]].forEach(function (c) {
      var cf = contFar(c[0], c[1]), le = L.farCont(c[0], c[1]).far, dd = L.farDisc(c[0], c[1]);
      if (BigInt(le.n) * cf[1] !== cf[0] * BigInt(le.d)) bad.push(["cont", c, fracStr(cf), L.fText(le)]);
      if (dd > floorF(cf) || floorF(cf) - dd > 2) bad.push(["rời rạc ≤ ⌊liên tục⌋", c, dd, floorF(cf)]);
    });
    t.ok("dạng đóng liên tục (phân số) = tính lại bằng BigInt; rời rạc ≤ ⌊liên tục⌋ và chỉ kém ≤ 2 ở bảng ví dụ", bad.length === 0, bad.slice(0, 3));
    var ex = [[3000, 1000, "far", 0, 1533, "1 533 1/3"], [3000, 1000, "deliver", 1000, 533, "533 1/3"], [2500, 1000, "deliver", 1000, 433, "433 1/3"], [30, 15, "far", 0, 20, "20"], [30, 15, "deliver", 10, 10, "10"], [45, 15, "far", 0, 23, "23"],
      [45, 15, "deliver", 15, 8, "8"], [40, 15, "far", 0, 22, "22"], [420, 105, "far", 0, 176, "176"], [1575, 315, "far", 0, 563, "563"], [1575, 315, "deliver", 300, 263, "263"], [100, 30, "far", 0, 47, "47 3/7"]];
    var tb = ex.map(function (e) { var r = T.fromInput({ mode: e[2], B: e[0], C: e[1], D: e[3] }); return r.ok ? [r.puzzle.data.best, sp(r.puzzle.data.bestCont)] : null; });
    t.eq("bảng ví dụ thiết kế (3000/1000 → 1533 và 1 533 1/3; 2500/1000 tới D → 433; 45/15 → 23; 1575/315 → 563…): rời rạc + liên tục", tb, ex.map(function (e) { return [e[4], e[5]]; }));
  })();

  // ====================================================================== 3. LB2 = vét cạn trên MỌI trạng thái đạt được
  t.group("camel — LB2 (tối ưu còn đạt từ trạng thái bất kỳ) = vét cạn trên mọi trạng thái đạt được");
  (function () {
    var sets = [["far", 6, 3], ["far", 12, 4], ["far", 15, 5], ["far", 18, 6], ["far", 20, 5], ["far", 16, 8], ["far", 21, 7], ["far", 24, 6], ["deliver", 18, 6, 5], ["deliver", 24, 6, 6], ["deliver", 21, 7, 5], ["deliver", 20, 5, 4]];
    var tot = 0, bad = [], over = 0, line = [];
    sets.forEach(function (c) {
      var mode = c[0], B = c[1], C = c[2], D = c[3] || 0, d = L.dataOf(mode, B, C, D), br = bruteCanon(B, C, d.maxX, mode, D), miss = 0;
      br.memo.forEach(function (val, key) {
        var parts = key.split(":"), p = +parts[0], dep = parts[1].split(",").map(Number), lb = L.lb2(d, { p: p, dep: dep, far: 0 }).v;
        if (lb > val) over++;
        if (lb !== val) { miss++; if (bad.length < 4) bad.push([mode, B, C, D, key, lb, val]); }
      });
      tot += br.memo.size; line.push(mode + " " + B + "/" + C + (D ? "→" + D : "") + ":" + br.memo.size);
      if (br.value !== d.best) bad.push(["tối ưu đầu ≠ best", mode, B, C, D, br.value, d.best]);
    });
    t.ok("LB2 = vét cạn ở MỌI trạng thái đạt được: " + tot + " trạng thái, " + sets.length + " bộ (LB2 > vét cạn: " + over + ")", bad.length === 0 && over === 0, bad.slice(0, 3));
    t.info(line.join("; "));
  })();

  (function () {
    var rng = R.create(5), bad = [], tot = 0, over = 0;
    for (var it = 0; it < 1500; it++) {
      var C = rng.range(2, 4), M = rng.range(4, 8), mode = rng.chance(0.5) ? "far" : "deliver", D = mode === "deliver" ? rng.range(2, M) : 0, Mx = mode === "deliver" ? D : M, dep = zeros(Mx + 1), total = rng.range(3, 12), q;
      for (q = 0; q < total; q++) dep[rng.int(Mx + 1)]++;
      var p = rng.int(Mx + 1), memo = new Map(), d = { mode: mode, B: 1, C: C, D: D, maxX: Mx };
      var rec = function (pp, dd) {
        var key = pp + ":" + dd.join(","), hit = memo.get(key);
        if (hit !== undefined) return hit;
        var val = mode === "far" ? pp : dd[D], lim = Math.min(C, dd[pp]);
        for (var c = 1; c <= lim; c++) for (var dir = -1; dir <= 1; dir += 2) { var qq = pp + dir; if (qq < 0 || qq > Mx) continue; var nd = dd.slice(); nd[pp] -= c; nd[qq] += c - 1; var v = rec(qq, nd); if (v > val) val = v; }
        memo.set(key, val); return val;
      };
      var vt = rec(p, dep), lb = L.lb2(d, { p: p, dep: dep, far: 0 }).v;
      tot++; if (lb > vt) over++; if (lb !== vt) bad.push([mode, C, Mx, D, p, dep.join(","), lb, vt]);
    }
    t.ok("LB2 = vét cạn cả ở " + tot + " trạng thái TUỲ Ý (kho rải ngẫu nhiên, C = 2–4 — làm sức chở thật sự ràng buộc hành trình đi lấy thức ăn/lùi gom); LB2 > vét cạn: " + over, bad.length === 0, bad.slice(0, 3));
  })();

  t.ok("excursion: sức chở C ràng buộc hành trình — tới 4 km chỉ từ kho 8 ở A với C = 2 là KHÔNG làm được (cần chở 4); lùi 4 km từ kho 9 với C = 2 cũng không; C đủ lớn thì được",
    L.excursion(0, 4, 4, [8, 0, 0, 0, 0], 2) === null && L.excursion(0, 4, 4, [8, 0, 0, 0, 0], 4) !== null && L.excursion(4, 4, 0, [0, 0, 0, 0, 9], 2) === null && L.excursion(4, 4, 0, [0, 0, 0, 0, 9], 4) !== null &&
    L.excursion(0, 2, 2, [3, 0, 0], 2) !== null && L.excursion(0, 2, 2, [1, 0, 0], 2) === null);

  // ====================================================================== 4. kế hoạch gọn + tiếp nối LB2 chạy bằng bộ mô phỏng độc lập
  t.group("camel — kế hoạch gọn (lời giải) và kế hoạch tiếp nối: chạy bằng bộ mô phỏng độc lập ra đúng giá trị dự đoán");
  (function () {
    var rng = R.create(99), bad = 0, tot = 0, maxSteps = 0, ex = [];
    for (var i = 0; i < 2500; i++) {
      var C = rng.range(2, 70), B = C + rng.int(5 * C), mode = rng.chance(0.5) ? "far" : "deliver", far = L.farDisc(B, C), D = mode === "deliver" ? rng.range(1, Math.max(1, far - 1)) : 0;
      if (mode === "deliver" && L.deliverDisc(B, C, D) < 1) continue;
      var d = L.dataOf(mode, B, C, D), sol = L.buildSolution(d);
      tot++;
      if (!sol) { bad++; if (ex.length < 4) ex.push(["không dựng được", mode, B, C, D]); continue; }
      maxSteps = Math.max(maxSteps, sol.recs.length);
      var sm = simulate(B, C, d.maxX, recOps(sol.recs));
      if (!sm.ok || valueOfSim(mode, D, sm) !== d.best) { bad++; if (ex.length < 4) ex.push([mode, B, C, D, "mô phỏng", sm.ok ? valueOfSim(mode, D, sm) : "lỗi bước " + sm.at, d.best]); }
    }
    t.ok("kế hoạch gọn: " + tot + " bộ (B, C, bài, D) ngẫu nhiên — chạy bằng mô phỏng độc lập ra ĐÚNG giá trị tối ưu; nhiều bước nhất " + maxSteps + " ≤ " + L.CAP, bad === 0 && maxSteps <= L.CAP, ex);
  })();
  (function () {
    var rng = R.create(7), tot = 0, bad = [], cmpBrute = 0, badBrute = 0, maxMs = 0;
    var brutes = {};
    function table(mode, B, C, D, M) { var k = mode + B + "," + C + "," + D; if (!brutes[k]) brutes[k] = bruteCanon(B, C, M, mode, D).memo; return brutes[k]; }
    for (var j = 0; j < 3500; j++) {
      var small = j < 1200, C = small ? rng.range(3, 7) : rng.range(5, 200), B = C + rng.int((small ? 3 : 5) * C), mode = rng.chance(0.5) ? "far" : "deliver";
      var far = L.farDisc(B, C), D = mode === "deliver" ? rng.range(1, Math.max(1, far - 1)) : 0;
      if (mode === "deliver" && L.deliverDisc(B, C, D) < 1) continue;
      if (small && B > 21) continue;
      var d = L.dataOf(mode, B, C, D), recs = [], sim = L.newSim(d), n = rng.int(14);
      for (var q = 0; q < n; q++) {                                                  // tiền tố ngẫu nhiên HỢP LỆ (chọn bừa rồi lọc bằng bộ mô phỏng độc lập)
        var r = rng.next(), cand, here = sim.dep[sim.pos], room = C - sim.load;
        if (r < 0.35) { if (!here || !room) continue; cand = [0, 2, 1 + rng.int(Math.min(here, room))]; }
        else if (r < 0.55) { if (!sim.load) continue; cand = [0, 3, 1 + rng.int(sim.load)]; }
        else { if (!sim.load) continue; var to = sim.pos + (rng.chance(0.7) ? 1 : -1) * (1 + rng.int(sim.load)); to = Math.max(0, Math.min(d.maxX, to)); if (to === sim.pos) continue; cand = [0, 1, to]; }
        if (!simulate(B, C, d.maxX, recOps(recs.concat([cand]))).ok) continue;
        recs.push(cand); L.stepSim(d, sim, cand[1], cand[2]);
      }
      var t0 = Date.now(), rc = L.reachOf(d, recs), cont = L.continuation(d, rc.sim, rc.lb), ms = Date.now() - t0; maxMs = Math.max(maxMs, ms);
      var full = simulate(B, C, d.maxX, recOps(recs.concat(L.itemsToRecs(cont.items))));
      tot++;
      if (!full.ok || valueOfSim(mode, D, full) !== rc.v || cont.v !== rc.v) { bad.push([mode, B, C, D, J(recs), "dự đoán " + rc.v, full.ok ? valueOfSim(mode, D, full) : "lỗi bước " + full.at]); continue; }
      if (small) {
        cmpBrute++;
        var key = L.canon(rc.sim); var tb = table(mode, B, C, D, d.maxX), val = tb.get(key.p + ":" + key.dep.join(","));
        if (val !== undefined) { var vt = mode === "far" ? Math.max(rc.sim.far, val) : val; if (vt !== rc.v) { badBrute++; if (bad.length < 6) bad.push(["vét cạn", mode, B, C, D, J(recs), vt, rc.v]); } }
      }
    }
    t.ok("kế hoạch tiếp nối từ " + tot + " trạng thái giữa chừng ngẫu nhiên (hợp lệ): chạy bằng mô phỏng độc lập = giá trị LB2 dự đoán; chậm nhất " + maxMs + " ms", bad.length === 0 && tot > 2500, bad.slice(0, 4));
    t.ok("… và LB2 = vét cạn ở " + cmpBrute + " trạng thái giữa chừng của bộ nhỏ (lệch " + badBrute + ")", badBrute === 0 && cmpBrute > 500);
  })();

  // ====================================================================== 5. sinh đề
  t.group("camel — generate: tất định, bậc, tối ưu = vét cạn, ngân sách thời gian");
  (function () {
    var detBad = [], bandBad = [], solBad = [], contBad = [], n = 0, times = [], slow = 0, optBad = [];
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) {
      for (var seed = 1; seed <= 20; seed++) {
        var o = { sizeId: sz.id, tier: tier }, t0 = Date.now(), a = T.generate(seed * 104729 + 17, o), ms = Date.now() - t0;
        times.push(ms); if (ms > 1500) slow++;
        n++;
        if (J(a) !== J(T.generate(seed * 104729 + 17, o))) detBad.push([sz.id, tier, seed]);
        if (!inBand(a.score, tier) || a.tier !== tier) bandBad.push([sz.id, tier, seed, a.score, a.tier]);
        if (!a.solution || !T.check(a, { v: a.solution.v, c: null }).solved || plan.count({ v: a.solution.v }) > L.CAP) solBad.push([sz.id, tier, seed]);
        var d = a.data, sm = simulate(d.B, d.C, d.maxX, recOps(plan.read({ v: a.solution.v }, L.layoutOf())));
        if (!sm.ok || valueOfSim(d.mode, d.D, sm) !== d.best || d.best !== (d.mode === "far" ? L.farDisc(d.B, d.C) : L.deliverDisc(d.B, d.C, d.D))) optBad.push([sz.id, tier, seed]);
        var cf = contFar(d.B, d.C);
        if (d.mode === "far" && (d.contInt ? (cf[1] !== 1n || Number(cf[0]) !== d.best) : (cf[1] === 1n && Number(cf[0]) === d.best))) contBad.push([sz.id, tier, seed, d.B, d.C, fracStr(cf), d.best]);
      }
    }); });
    t.ok("tất định: " + n + " đề sinh hai lần giống hệt từng bit", detBad.length === 0, detBad.slice(0, 3));
    t.ok("điểm trong khoảng bậc ở 100 % của " + n + " đề (2 bài × 4 bậc × 20 seed; yêu cầu ≥ 90 %) và puzzle.tier đúng bậc", bandBad.length === 0, bandBad.slice(0, 4));
    t.ok("solution.v giải xong đề, vừa " + L.CAP + " thao tác, chạy bằng mô phỏng độc lập ra ĐÚNG tối ưu = QHĐ", solBad.length === 0 && optBad.length === 0, solBad.concat(optBad).slice(0, 3));
    t.ok("cờ contInt khớp phân số BigInt (bài xa nhất): đề 'ranh giới nguyên' có liên tục = rời rạc, đề 'không nguyên' thì khác", contBad.length === 0, contBad.slice(0, 3));
    t.ok("sinh đề: tối đa " + Math.max.apply(null, times) + " ms, không đề nào > 1,5 s", slow === 0);
    var mono = T.sizes.map(function (sz) { return TIERS.map(function (tier) { var s = []; for (var seed = 1; seed <= 20; seed++) s.push(T.generate(seed, { sizeId: sz.id, tier: tier }).score); return mean(s); }); });
    t.ok("điểm trung bình đơn điệu theo bậc (Dễ < Vừa < Khó < Chuyên gia) ở cả 2 bài", mono.every(function (a) { return a[0] < a[1] && a[1] < a[2] && a[2] < a[3]; }), mono);
    t.ok("khoá lạ / bậc lạ / kích cỡ lạ không làm sinh đề ném lỗi (rơi về mặc định)", (function () { try { var p = T.generate(1, { sizeId: "khong-co", tier: "x" }); return p.sizeId === "far" && p.tier === "easy"; } catch (e) { return false; } })());
    var intFam = [], bad2 = [];
    for (var s2 = 1; s2 <= 40; s2++) { var q = T.generate(s2, { sizeId: "far", tier: "easy" }); intFam.push(q.data.contInt); }
    t.ok("bài dễ: mọi đề có ranh giới nguyên (rời rạc = liên tục) — đề chơi không bị lệch '533 vs 533⅓'", intFam.every(Boolean));
    t.ok("họ 'không nguyên' (kiểu 3000/1000) có trong bậc Khó/Chuyên gia: lộ khác biệt liên tục ≠ rời rạc", (function () { var c = 0; for (var s = 1; s <= 40; s++) { var a = T.generate(s, { sizeId: "far", tier: "hard" }), b = T.generate(s, { sizeId: "far", tier: "expert" }); if (!a.data.contInt || !b.data.contInt) c++; } return c >= 5; })());
    t.ok("deliver: D nằm sau ranh giới pha đầu và < xa nhất, đáp án ≥ 1", (function () { var okk = true; for (var s = 1; s <= 30; s++) TIERS.forEach(function (tier) { var p = T.generate(s, { sizeId: "deliver", tier: tier }), d = p.data, ph = L.discPhases(d.B, d.C, "far", 0); if (!(d.D > ph[0].to && d.D < L.farDisc(d.B, d.C) && d.best >= 1)) okk = false; }); return okk; })());
  })();

  // ====================================================================== 6. moveFor / check / mistakes / grade
  t.group("camel — moveFor: hợp lệ, hoàn lại bằng reverseDiff, trạng thái luôn chuẩn, dung lượng");
  (function () {
    var p = mk("far", 45, 15), s = T.newState(p), lay = L.layoutOf();
    t.ok("trạng thái đầu: plan.valid, chưa nộp, 0 bước; initial dài 2 + 160·3 = 482", plan.valid(s, lay) && !plan.isSubmitted(s) && plan.count(s) === 0 && s.v.length === 482 && p.initial.v.length === 482);
    t.ok("đi khi chưa chở gì / lấy quá kho / lấy quá sức chở / đặt quá số đang chở / đi ra ngoài bản đồ / đi tại chỗ → moveFor null",
      !T.moveFor(p, s, { k: "go", x: 3 }) && !T.moveFor(p, s, { k: "load", n: 46 }) && !T.moveFor(p, s, { k: "load", n: 16 }) && !T.moveFor(p, s, { k: "drop", n: 1 }) && !T.moveFor(p, s, { k: "go", x: 99999 }) && !T.moveFor(p, s, { k: "go", x: 0 }));
    t.ok("action lạ / sai kiểu / thiếu trường → null, không ném", (function () { try { return [null, undefined, 5, "x", {}, { k: "zzz" }, { k: "go" }, { k: "go", x: 1.5 }, { k: "load", n: "5" }, { k: "steps" }, { k: "steps", ops: [] }, { k: "steps", ops: [{ op: "go", n: 1 }, { op: "__proto__", n: 2 }] }, { k: "steps", ops: [{ op: "constructor", n: 1 }] }, { k: "trip" }, { k: "trip", to: -3 }, { k: "truncate", n: -1 }, { k: "truncate", n: 5 }, { k: "submit" }].every(function (a) { return T.moveFor(p, s, a) === null; }); } catch (e) { return false; } })());
    var seq = [{ k: "load", n: 15 }, { k: "go", x: 3 }, { k: "drop", n: 9 }, { k: "go", x: 0 }, { k: "load", n: 15 }, { k: "go", x: 3 }, { k: "drop", n: 9 }, { k: "go", x: 0 }, { k: "load", n: 15 }, { k: "go", x: 3 }, { k: "load", n: 3 }, { k: "go", x: 8 }], diffs = [], st = T.newState(p), okAll = true;
    seq.forEach(function (a) { var before = J(st.v), dd = apply(p, st, a); if (!dd) { okAll = false; return; } diffs.push([dd, before]); if (!plan.valid(st, lay)) okAll = false; });
    t.ok("chuỗi 12 thao tác hợp lệ (hai chuyến đưa-đón + chuyến cuối): mỗi bước một diff, state luôn plan.valid", okAll && plan.count(st) === 12, st.v.slice(0, 12));
    var rev = true; diffs.slice().reverse().forEach(function (e) { G.applyDiff(st, e[0].d, true); if (J(st.v) !== e[1]) rev = false; });
    t.ok("hoàn lại từng diff bằng reverseDiff cho ĐÚNG state trước đó (12/12)", rev && plan.count(st) === 0);
    var sh = G.create(p, {}); seq.forEach(function (a) { sh.act(a); });
    var snap = J(sh.state.v); sh.undo(); sh.undo(); sh.redo(); sh.redo();
    t.ok("hoàn tác/làm lại qua Puz.game giữ nguyên state", J(sh.state.v) === snap);
    // macro
    var q = T.newState(p), tr = apply(p, q, { k: "trip", to: 3 });
    t.ok("trip tới km 3 (15/45): lấy 15, đi 3, đặt 9, về A — MỘT diff, 4 bản ghi; kho km 3 = 9, lạc đà ở A", !!tr && plan.count(q) === 4 && J(plan.read(q, lay).map(function (r) { return [r[1], r[2]]; })) === "[[2,15],[1,3],[3,9],[1,0]]" && L.simOf(p, q).sim.dep[3] === 9 && L.simOf(p, q).sim.pos === 0 && L.simOf(p, q).sim.load === 0);
    t.ok("trip quá xa (đi-về cần hơn số chở) → null; trip về phía sau / tại chỗ → null", !T.moveFor(p, T.newState(p), { k: "trip", to: 8 }) && !T.moveFor(p, T.newState(p), { k: "trip", to: 0 }));
    var rn = T.newState(p), rd = apply(p, rn, { k: "run" });
    t.ok("run: lấy đầy 15 rồi đi 15 km (hết sức) — hết chuối thì dừng; lần 2 không đi được → null", !!rd && L.simOf(p, rn).sim.pos === 15 && L.simOf(p, rn).sim.far === 15 && !T.moveFor(p, rn, { k: "run" }));
    var sx = T.newState(p), batch = T.moveFor(p, sx, { k: "steps", ops: [{ op: "load", n: 15 }, { op: "go", n: 3 }, { op: "go", n: 99 }] });
    t.ok("steps: một thao tác sai ⇒ KHÔNG áp gì cả (null), không áp một nửa", batch === null && plan.count(sx) === 0);
    // truncate / submit / mở lại
    var u = T.newState(p); apply(p, u, { k: "trip", to: 3 });
    var sd = apply(p, u, { k: "submit" });
    t.ok("submit: cờ nộp trong state, moveFor sau nộp = null (không thêm bước), check.solved", !!sd && plan.isSubmitted(u) && T.check(p, u).solved && !T.moveFor(p, u, { k: "go", x: 5 }) && !T.moveFor(p, u, { k: "submit" }));
    var tn = apply(p, u, { k: "truncate", n: 2 });
    t.ok("truncate khi đã nộp: mở lại + quay về 2 bước, trạng thái chuẩn (ô sau = 0)", !!tn && !plan.isSubmitted(u) && plan.count(u) === 2 && plan.valid(u, lay) && u.v.slice(lay.head + 2 * 3).every(function (x) { return x === 0; }));
    t.ok("nộp kế hoạch rỗng = null (cần ít nhất một bước)", T.moveFor(p, T.newState(p), { k: "submit" }) === null);
    // dung lượng
    var full = T.newState(p), pushed = 0;
    for (var i = 0; i < 200; i++) { var a2 = i % 2 === 0 ? { k: "load", n: 1 } : { k: "drop", n: 1 }; if (!apply(p, full, a2)) break; pushed++; }
    t.ok("kế hoạch đầy " + L.CAP + " thao tác: moveFor trả null, không ném; nộp vẫn được; gợi ý không ném", pushed === L.CAP && T.moveFor(p, full, { k: "go", x: 1 }) === null && (function () { try { var h = T.hint(p, full, 3); return !!h && !!T.moveFor(p, full, { k: "submit" }); } catch (e) { return false; } })());
    t.ok("preview: {ok, error, after} — lỗi nói rõ lý do (kho/ sức chở / ăn dọc đường), không đổi state", (function () {
      var s0 = T.newState(p), before = J(s0.v), a = T.sim.preview(p, s0, { k: "go", x: 3 }), b = T.sim.preview(p, s0, { k: "load", n: 99 }), c = T.sim.preview(p, s0, { k: "trip", to: 3 }), e = T.sim.preview(p, s0, { k: "load", n: 15 });
      return !a.ok && /ăn dọc đường/.test(a.error) && !b.ok && /chỉ có/.test(b.error) && c.ok && c.after.depots.some(function (z) { return z.x === 3 && z.n === 9; }) && c.after.depots.some(function (z) { return z.x === 0 && z.n === 30; }) && e.ok && e.after.load === 15 && J(s0.v) === before;
    })());
  })();

  t.group("camel — check / grade: chất lượng so với tối ưu");
  (function () {
    var p = mk("far", 45, 15), lay = L.layoutOf(), s = T.newState(p);
    t.ok("chưa nộp: check.solved = false, complete = false; filled/total; solution.v: solved + quality 1", !T.check(p, s).solved && !T.check(p, s).complete && T.check(p, { v: p.solution.v, c: null }).solved && GR.errors(T.grade(p, { v: p.solution.v, c: null }, {})).length === 0 && T.grade(p, { v: p.solution.v, c: null }, {}).quality === 1 && T.grade(p, { v: p.solution.v, c: null }, {}).stars === 3);
    apply(p, s, { k: "load", n: 15 }); apply(p, s, { k: "go", x: 15 });
    var g0 = T.grade(p, s, {});
    t.ok("giá trị hiện có hiện ngay (HUD): 15 km, chưa nộp ⇒ 0★, chữ 'Chưa nộp…', đủ trường", g0.value === 15 && g0.best === 23 && g0.stars === 0 && /Chưa nộp/.test(g0.text) && GR.errors(g0).length === 0 && /km/.test(g0.valueText));
    apply(p, s, { k: "submit" });
    var g1 = T.grade(p, s, {});
    t.ok("nộp 15/23 km: quality = 0,652, 1★, 'Đạt 65 %…'; solved nhưng không phải tối ưu", g1.quality === 0.652 && g1.stars === 1 && /Đạt 65 %/.test(g1.text) && T.check(p, s).solved && GR.errors(g1).length === 0, g1);
    var gd = mk("deliver", 45, 15, 15), sd = T.newState(gd); apply(gd, sd, { k: "trip", to: 3 }); apply(gd, sd, { k: "submit" });
    t.ok("bài tới D: giá trị = kho D + phần đang chở nếu đứng ở D; kho 0 ở D ⇒ 0 quả, quality 0", T.grade(gd, sd, {}).value === 0 && T.grade(gd, sd, {}).quality === 0 && T.grade(gd, sd, {}).stars === 0);
    var s3 = T.newState(gd); apply(gd, s3, { k: "load", n: 15 }); apply(gd, s3, { k: "go", x: 15 });
    t.ok("đứng ở D đang chở 0 + kho: giá trị tính cả phần đang chở (chở 0 quả tới D = 0; đặt xuống rồi vẫn 0 — km 15 hết chuối)", T.grade(gd, s3, {}).value === 0);
    var d2 = mk("deliver", 30, 15, 10), s4 = T.newState(d2); apply(d2, s4, { k: "load", n: 15 }); apply(d2, s4, { k: "go", x: 10 });
    t.ok("đang đứng ở D chở 5 quả (chưa đặt): giá trị = 5 (cộng phần đang chở); đặt xuống: vẫn 5", T.grade(d2, s4, {}).value === 5 && (apply(d2, s4, { k: "drop", n: 5 }), T.grade(d2, s4, {}).value === 5));
    var q2 = G.create(p, {}); q2.act({ k: "load", n: 15 }); q2.act({ k: "go", x: 15 }); q2.act({ k: "submit" });
    var rec = q2.record("solved");
    t.ok("record('solved') ghi grade (quality 0,652, 1★) — lịch sử đủ điểm", q2.status === "solved" && rec.grade && rec.grade.quality === 0.652 && rec.grade.stars === 1 && rec.result === "solved");
    var q3 = G.create(p, {}); q3.reveal(); var rv = q3.record("revealed");
    t.ok("Reveal điền lời giải tối ưu nhưng không ghi grade (revealed)", q3.status === "revealed" && !rv.grade && T.check(p, q3.state).solved);
  })();

  t.group("camel — mistakes: nước làm MẤT tối ưu (đối chiếu vét cạn trạng thái)");
  (function () {
    var cases = [["far", 12, 4, 0], ["far", 15, 5, 0], ["deliver", 18, 6, 5]], tot = 0, bad = [], lost = 0, ok = 0;
    cases.forEach(function (c) {
      var mode = c[0], B = c[1], C = c[2], D = c[3], p = mk(mode, B, C, D), d = p.data, br = bruteCanon(B, C, d.maxX, mode, D), rng = R.create(B * 31 + C);
      function V(state) { var sm = L.simOf(p, state); if (!sm.ok) return null; var k = L.canon(sm.sim); return br.memo.get(k.p + ":" + k.dep.join(",")); }
      for (var w = 0; w < 160; w++) {
        var s = T.newState(p), n = rng.range(2, 12);
        for (var i = 0; i < n; i++) {
          var sim = L.simOf(p, s).sim, a, r = rng.next(), here = sim.dep[sim.pos], room = C - sim.load;
          if (r < 0.35) { if (!here || !room) continue; a = { k: "load", n: 1 + rng.int(Math.min(here, room)) }; }
          else if (r < 0.55) { if (!sim.load) continue; a = { k: "drop", n: 1 + rng.int(sim.load) }; }
          else { if (!sim.load) continue; var to = sim.pos + (rng.chance(0.65) ? 1 : -1) * (1 + rng.int(sim.load)); to = Math.max(0, Math.min(d.maxX, to)); if (to === sim.pos) continue; a = { k: "go", x: to }; }
          var diff = T.moveFor(p, s, a); if (!diff) continue;
          var v0 = V(s), m = T.mistakes(p, s, diff), t2 = { v: s.v.slice(), c: null }; G.applyDiff(t2, diff.d, false); var v1 = V(t2);
          var want = v0 !== undefined && v1 !== undefined && (mode === "far" ? Math.max(L.simOf(p, s).sim.far, v0) : v0) >= d.best && (mode === "far" ? Math.max(L.simOf(p, t2).sim.far, v1) : v1) < d.best ? 1 : 0;
          tot++; if (want) lost++; else ok++;
          if (m !== want) bad.push([mode, B, C, D, J(a), m, want, v0, v1]);
          G.applyDiff(s, diff.d, false);
        }
      }
    });
    t.ok("mistakes = 1 ⇔ (trước còn đạt tối ưu theo vét cạn) VÀ (sau thì không): " + tot + " nước ngẫu nhiên (" + lost + " làm mất tối ưu, " + ok + " không)", bad.length === 0 && lost > 30 && ok > 200, bad.slice(0, 3));
    var p = mk("far", 45, 15), s = T.newState(p);
    t.ok("nước vô hại (lấy 15, đi 3, đặt 9, về) không bị tính lỗi; nước phung phí (đi thẳng 15 km rồi đặt hết) = 1 lỗi; truncate/submit không bao giờ tính lỗi", (function () {
      var g = G.create(p, {}); g.act({ k: "trip", to: 3 }); var ok0 = g.counters.mistakes === 0;
      var g2 = G.create(p, {}); g2.act({ k: "load", n: 15 }); g2.act({ k: "go", x: 12 }); var m1 = g2.counters.mistakes;
      g2.act({ k: "truncate", n: 0 }); var m2 = g2.counters.mistakes; g2.act({ k: "load", n: 15 }); g2.act({ k: "submit" });
      return ok0 && m1 === 1 && m2 === 1 && g2.counters.mistakes === 1;
    })());
  })();

  // ====================================================================== 7. gợi ý
  t.group("camel — gợi ý: vòng 'mức 3 → áp dụng' giải xong tối ưu, cả sau nước đi làm mất tối ưu");
  function randomLegal(p, g, rng) {
    var sm = L.simOf(p, g.state), sim = sm.sim, C = p.data.C, here = sim.dep[sim.pos], room = C - sim.load;
    for (var tr = 0; tr < 12; tr++) {
      var r = rng.next();
      if (r < 0.35) { if (here && room) return { k: "load", n: 1 + rng.int(Math.min(here, room)) }; }
      else if (r < 0.55) { if (sim.load) return { k: "drop", n: 1 + rng.int(sim.load) }; }
      else if (sim.load) { var to = sim.pos + (rng.chance(0.6) ? 1 : -1) * (1 + rng.int(sim.load)); to = Math.max(0, Math.min(p.data.maxX, to)); if (to !== sim.pos) return { k: "go", x: to }; }
    }
    return { k: "load", n: 1 };
  }
  function hintLoop(p, rng, inject) {
    var g = G.create(p, {}), total = plan.count({ v: p.solution.v }), steps = 0, limit = total * 3 + 8, lvlBad = [], injected = 0, truncs = 0;
    var injectAt = {}; for (var q = 0; q < inject; q++) injectAt[rng.int(Math.max(1, total))] = 1;
    while (g.status !== "solved" && steps < limit) {
      if (injectAt[steps] && g.status === "playing") { var a0 = randomLegal(p, g, rng); if (g.act(a0).ok) injected++; }
      if (g.status === "ready") g.start();
      var h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
      if (!h3 || h3.none || !h3.action) break;
      var act = h3.action, goTo = null;
      (act.ops || []).forEach(function (o) { if (o.op === "go" && goTo === null) goTo = o.n; });
      if (act.k === "truncate") truncs++;
      if (goTo !== null && new RegExp("km " + goTo + "(?!\\d)").test(h1.text)) lvlBad.push(["mức 1 lộ km đích", goTo, h1.text]);
      if (!(h1.text.length > 8 && h2.text.length > 8 && h3.text.length > 3) || (h3.why || []).length < 1 || h1.text === h3.text) lvlBad.push(["hint ngắn/không why", h1.text, h2.text, h3.text]);
      if (J(g.hint(3)) !== J(h3)) lvlBad.push(["không tất định"]);
      var r = g.applyHint(h3); if (!r.ok) { lvlBad.push(["áp dụng thất bại", J(act), r.reason]); break; }
      steps++;
    }
    return { g: g, steps: steps, limit: limit, lvlBad: lvlBad, injected: injected, truncs: truncs, total: total };
  }
  (function () {
    var rng = R.create(321), tot = 0, bad = [], lvl = [], inj = 0, trn = 0, maxRatio = 0, nOpt = 0;
    var puzzles = [];
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { for (var s = 1; s <= 3; s++) puzzles.push(T.generate(s * 977, { sizeId: sz.id, tier: tier })); }); });
    puzzles.push(mk("far", 3000, 1000), mk("deliver", 3000, 1000, 1000), mk("far", 45, 15), mk("far", 100, 30), mk("deliver", 2500, 1000, 1000));
    puzzles.forEach(function (p) {
      [0, 0, 2, 4].forEach(function (inject) {
        var r = hintLoop(p, rng, inject); tot++; inj += r.injected; trn += r.truncs;
        if (r.g.status !== "solved") { bad.push([p.data.mode, p.data.B, p.data.C, p.data.D, "inject " + inject, "bước " + r.steps + "/" + r.limit]); return; }
        var gr = T.grade(p, r.g.state, r.g.counters);
        if (gr.quality !== 1 || gr.stars !== 3) bad.push([p.data.mode, p.data.B, p.data.C, p.data.D, "không tối ưu", gr.valueText, gr.bestText]); else nOpt++;
        maxRatio = Math.max(maxRatio, r.steps / r.total);
        lvl = lvl.concat(r.lvlBad);
      });
    });
    t.ok("vòng 'gợi ý mức 3 → áp dụng' giải xong với quality 1 (3★) ở " + tot + " ván (" + puzzles.length + " đề × 4 kiểu chèn; " + inj + " nước ngẫu nhiên chèn giữa chừng, " + trn + " lần gợi ý bảo quay về); nhiều bước nhất = " + maxRatio.toFixed(2) + " × số bước lời giải (≤ 3)", bad.length === 0 && nOpt === tot && trn > 0 && maxRatio <= 3, bad.slice(0, 3));
    t.ok("mỗi gợi ý: mức 1/2/3 đều có lời, mức 3 có 'vì sao', mức 1 không lộ km đích của mức 3, tất định", lvl.length === 0, lvl.slice(0, 3));
  })();
  (function () {
    var p = mk("far", 45, 15), g = G.create(p, {}), h = g.hint(3);
    t.ok("trạng thái đầu 45/15: gợi ý mức 3 = chặng đầu (lấy 15, đi tới km 3, đặt 9) với lời giải thích 2f−1", h.action && h.action.k === "steps" && J(h.action.ops) === J([{ op: "load", n: 15 }, { op: "go", n: 3 }, { op: "drop", n: 9 }]) && h.why.length >= 2 && /3 chuyến/.test(h.why[0]) && /5 quả/.test(h.why[0]), h);
    t.ok("mức 1 nói cấu trúc (k chuyến, 2k−1 quả/km) KHÔNG lộ km 3; mức 2 nêu km 3", /3 chuyến/.test(g.hint(1).text) && !/km 3(?!\d)/.test(g.hint(1).text) && /km 3(?!\d)/.test(g.hint(2).text) && g.hint(2).regions.positions.indexOf(3) >= 0 && g.hint(1).regions.positions.length === 0);
    // mất tối ưu: đi thẳng 12 km
    g.act({ k: "load", n: 15 }); g.act({ k: "go", x: 12 });
    var hl = g.hint(3);
    t.ok("đã mất tối ưu: mọi mức nói trước; mức 3 = truncate về trước bước làm mất (bước 2 → n = 1); 'còn tối đa X so với tối ưu 23'", hl.action && hl.action.k === "truncate" && hl.action.n === 1 && /Bước 2/.test(hl.why[1]) && /tối ưu 23/.test(hl.why[0]) && /mất tối ưu/.test(g.hint(1).text) && hl.technique === "Hoàn tác", hl);
    g.applyHint(hl);
    t.ok("áp dụng 'quay về' → còn 1 bước (Lấy 15), mistakes giữ 1 (hoàn tác không xoá lỗi), tiếp tục gợi ý bình thường", plan.count(g.state) === 1 && g.counters.mistakes === 1 && g.hint(3).action.k === "steps");
    // đã đạt tối ưu → nộp
    var q = G.create(p, {}); q.reveal(); var q2 = G.create(p, {}); q2.state = { v: p.solution.v.slice(), c: null }; q2.act({ k: "truncate", n: plan.count(q2.state) });
    var hs = q2.hint(3);
    t.ok("đã đạt giá trị tối ưu (chưa nộp): mức 3 là {k:'submit'}; mức 1 nói 'hãy nộp'", hs.action && hs.action.k === "submit" && /nộp/i.test(q2.hint(1).text) && hs.technique === "Nộp");
    t.ok("ván đã nộp: gợi ý none; kế hoạch hỏng: không ném", (function () { var s = { v: p.solution.v.slice(), c: null }; return T.hint(p, s, 3).none === true; })());
    var gd = G.create(mk("deliver", 3000, 1000, 1000), {}), hd = gd.hint(3);
    t.ok("3000/1000 tới D=1000: chặng đầu = lấy 1000, đi tới km 200, đặt 600 (3 chuyến, 5 quả/km)", J(hd.action.ops) === J([{ op: "load", n: 1000 }, { op: "go", n: 200 }, { op: "drop", n: 600 }]) && /5 quả/.test(hd.why[0]));
  })();
  (function () {
    var p = mk("far", 45, 15), s = T.newState(p), rng = R.create(5);
    var steps = T.replay(p), st = T.newState(p), okk = true, nonText = 0;
    steps.forEach(function (stp) { if (!stp.text || !stp.diff || !stp.diff.d.length || !Array.isArray(stp.cells) || !Array.isArray(stp.why)) nonText++; G.applyDiff(st, stp.diff.d, false); });
    t.ok("replay: " + steps.length + " bước (các chặng + Nộp) áp tuần tự ra state solved; mỗi bước có text, diff, cells, why", steps.length >= 4 && T.check(p, st).solved && nonText === 0 && /^Nộp kế hoạch/.test(steps[steps.length - 1].text));
    t.ok("replay: cells của chặng = chỉ số các bản ghi của chặng; mọi why/ text không chữ rác", (function () { var s2 = T.newState(p), bad = 0, n = 0; steps.forEach(function (stp, i) { if (i < steps.length - 1) { var m = plan.count(s2); stp.cells.forEach(function (c, k) { if (c !== m + k) bad++; }); n += stp.cells.length; } G.applyDiff(s2, stp.diff.d, false); if (/\b(undefined|null|NaN)\b/.test(stp.text + stp.why.join(" "))) bad++; }); return bad === 0 && n === plan.count({ v: p.solution.v }); })());
  })();

  // ====================================================================== 8. đề tự nhập / kiểm / I-O
  t.group("camel — fromInput / validate / solve: đề tự nhập, giới hạn, trạng thái");
  (function () {
    var r = T.fromInput({ mode: "far", B: 3000, C: 1000 }), r2 = T.fromInput({ mode: "deliver", B: 3000, C: 1000, D: 1000 }), r3 = T.fromInput({ mode: "far", B: 45, C: 15 });
    t.ok("3000/1000 xa nhất: ok, unique, tối ưu 1533 'liên tục 1 533 1/3', cảnh báo km nguyên (warn), tier custom, score số", r.ok && r.status === "unique" && r.count === 1 && r.puzzle.data.best === 1533 && /1\s533/.test(r.statusText) && /1\s533 1\/3/.test(r.statusText) && r.statusKind === "warn" && r.warnings.some(function (w) { return /km nguyên/.test(w); }) && r.puzzle.tier === "custom" && typeof r.puzzle.score === "number", r);
    t.ok("3000/1000 tới D=1000: 533 (liên tục 533 1/3)", r2.ok && r2.puzzle.data.best === 533 && sp(r2.puzzle.data.bestCont) === "533 1/3" && /533/.test(r2.statusText));
    t.ok("45/15: liên tục = rời rạc ⇒ statusKind ok, không cảnh báo", r3.ok && r3.statusKind === "ok" && r3.warnings.length === 0 && r3.puzzle.data.contInt === true);
    var bad = [{}, null, 5, { mode: "x", B: 10, C: 5 }, { mode: "far", B: 0, C: 5 }, { mode: "far", B: 10, C: 0 }, { mode: "far", B: 1.5, C: 5 }, { mode: "far", B: "abc", C: 5 }, { mode: "far", B: 20001, C: 5 }, { mode: "far", B: 10, C: 2001 }, { mode: "far", B: 300, C: 10 },
      { mode: "deliver", B: 45, C: 15, D: 0 }, { mode: "deliver", B: 45, C: 15, D: 23 }, { mode: "deliver", B: 45, C: 15, D: 99999 }, { mode: "deliver", B: 45, C: 15 }, { mode: "far", B: -3, C: 5 }];
    t.ok("đầu vào xấu → ok:false + lỗi tiếng Việt, không ném (16 ca: thiếu trường, sai kiểu, quá giới hạn, B/C > " + L.MAX_K + ", D ≥ xa nhất…)", bad.every(function (b) { try { var q = T.fromInput(b); return q.ok === false && q.errors.length >= 1 && q.errors.every(function (e) { return typeof e === "string" && e && !/undefined|NaN|null/.test(e); }); } catch (e) { return false; } }), bad.map(function (b) { try { return T.fromInput(b).ok; } catch (e) { return "ném"; } }));
    t.ok("chuỗi số ('45', '15') được nhận như số; B ≤ C vẫn dựng được kèm cảnh báo 'một chuyến'", (function () { var q = T.fromInput({ mode: "far", B: "45", C: "15" }), z = T.fromInput({ mode: "far", B: 10, C: 15 }); return q.ok && q.puzzle.data.best === 23 && z.ok && z.puzzle.data.best === 10 && z.warnings.some(function (w) { return /một chuyến/.test(w); }); })());
    var big = T.fromInput({ mode: "far", B: 14000, C: 2000 }), t0 = Date.now(), bd = big.ok ? T.hint(big.puzzle, T.newState(big.puzzle), 3) : null, tv = Date.now() - t0;
    t.ok("đề lớn nhất cho phép (B/C = 7, C = 2000): dựng được, kế hoạch tối ưu ≤ " + L.CAP + " thao tác, gợi ý đầu " + tv + " ms (< 1 s)", big.ok && plan.count({ v: big.puzzle.solution.v }) <= L.CAP && !!bd && tv < 1000 * t.slack, big.errors);
    t.time("fromInput + solve + validate đề cỡ lớn ≤ 1 s", 1000, function () { var q = T.fromInput({ mode: "deliver", B: 14000, C: 2000, D: 3000 }); T.solve(q.puzzle); T.validate(q.puzzle); return q; });
    var p = mk("far", 45, 15), v = T.validate(p), sv = T.solve(p);
    t.ok("validate: ok, unique, solution khớp; solve: unique, value = tối ưu, có bước theo pha, techniques", v.ok && v.status === "unique" && J(v.solution) === J(p.solution) && sv.status === "unique" && sv.value === 23 && sv.steps.length === 3 && sv.steps.every(function (s) { return s.text && s.technique; }) && Object.keys(sv.techniques).length >= 2);
    t.ok("validate đề hỏng không ném", (function () { try { return T.validate(null).ok === false && T.validate({ data: {} }).ok === false && T.validate({ data: { mode: "far", B: -1 } }).ok === false; } catch (e) { return false; } })());
    t.ok("difficulty = điểm đề; sizeText của đề tự nhập nói rõ ('45 quả · chở 15 · đi xa nhất')", T.difficulty(p) === p.score && T.sizeText(p) === "45 quả · chở 15 · đi xa nhất" && /tới km 1\s000/.test(T.sizeText(r2.puzzle)) && T.sizeText(null) === "");
  })();

  t.group("camel — I/O: toText/fromText, toFile/fromFile, đầu vào xấu");
  (function () {
    var ps = [mk("far", 3000, 1000), mk("deliver", 3000, 1000, 1000), mk("far", 45, 15), T.generate(5, { sizeId: "deliver", tier: "hard" }), T.generate(8, { sizeId: "far", tier: "expert" })], bad = [];
    ps.forEach(function (p) {
      var a = T.fromText(T.toText(p)), b = T.fromFile(T.toFile(p)), c = T.fromFile(JSON.parse(JSON.stringify(T.toFile(p))));
      [a, b, c].forEach(function (r, i) { if (!r.ok || J(r.puzzle.initial) !== J(p.initial) || J(r.puzzle.data) !== J(p.data)) bad.push([T.toText(p), ["text", "file", "json"][i], r.errors]); });
    });
    t.ok("toText/fromText và toFile/fromFile (cả qua JSON) dựng lại cùng initial + data (5 đề)", bad.length === 0, bad.slice(0, 3));
    t.eq("toText: dạng 'camel far B=3000 C=1000' / 'camel deliver B=… C=… D=…'", [T.toText(ps[0]), T.toText(ps[1])], ["camel far B=3000 C=1000", "camel deliver B=3000 C=1000 D=1000"]);
    var f = T.toFile(ps[1]);
    t.ok("toFile đủ trường spec: type, seed, difficulty, size, initialState, solution (chuỗi kế hoạch), metadata; fromFile KHÔNG tin difficulty/solution trong tệp", f.type === "camel" && f.initialState === "mode=deliver;B=3000;C=1000;D=1000" && /^L1000 G200/.test(f.solution) && (function () { var o = JSON.parse(JSON.stringify(f)); o.difficulty = 0.1; o.solution = "G99999"; var r = T.fromFile(o); return r.ok && r.puzzle.score === ps[1].score && T.check(r.puzzle, { v: r.puzzle.solution.v, c: null }).solved; })());
    var vi = ["camel đi xa nhất B=30 C=15", "CAMEL FAR b=30, c=15", "camel tới D B=45 C=15 D=15", "camel deliver B:45;C:15;D:15", "far B=30 C=15"], ok = vi.map(function (x) { var r = T.fromText(x); return r.ok ? r.puzzle.data.best : r.errors[0]; });
    t.eq("fromText chấp nhận tiếng Việt / hoa thường / dấu , ; : (5 cách viết)", ok, [20, 20, 8, 8, 20]);
    var junk = ["", "   ", "xin chào", "camel", "camel far", "camel far B=abc C=5", "camel far B=30", "camel deliver B=45 C=15", "camel far B=1e9 C=5", "camel far B=30 C=15 constructor=1 __proto__=2", null, undefined, 42, {}];
    t.ok("văn bản xấu (14 ca) → ok:false + lỗi tiếng Việt (hoặc dựng được đề hợp lệ), không ném", junk.every(function (x) { try { var r = T.fromText(x); return r.ok === true || (r.ok === false && r.errors.length >= 1 && r.errors.every(function (e) { return typeof e === "string" && e; })); } catch (e) { return false; } }));
    var fx = [null, {}, { initialState: 5 }, { initialState: "mode=far" }, { initialState: "mode=far;B=x;C=2" }, { initialState: "mode=deliver;B=45;C=15;D=99" }, { initialState: "" }, "chuỗi", 7];
    t.ok("tệp xấu (9 ca) → ok:false + lỗi, không ném", fx.every(function (x) { try { var r = T.fromFile(x); return r.ok === false && r.errors.length >= 1; } catch (e) { return false; } }));
  })();

  t.group("camel — constraintView, trace, describeCell, replay");
  (function () {
    var p = mk("far", 45, 15), cv = T.constraintView(p), tr = T.trace(p, { maxNodes: 600 });
    t.ok("constraintView: summary, biến (có f_x và S_x), ràng buộc nêu 2f−1, counts; sections có bảng pha", cv.summary && cv.variables.length >= 2 && cv.variables.some(function (v) { return /^f_x/.test(v.name); }) && cv.constraints.some(function (c) { return /2f − 1/.test(c); }) && cv.counts.variables === cv.variables.length && cv.sections.length >= 2 && cv.sections[0].items.length === 3);
    t.ok("trace: kind 'matrix', mỗi bước = một pha với bảng tăng dần, pivot, ≤ 60 bước, có note", tr.kind === "matrix" && tr.steps.length === 3 && tr.steps.every(function (s, i) { return s.text && s.matrix.length === i + 2 && s.matrix[0].length === 8 && s.pivot[0] === i + 1; }) && tr.steps.length <= 60 && tr.note);
    t.ok("constraintView + trace + mọi chuỗi: không chữ rác (undefined/null/NaN)", !/\b(undefined|null|NaN)\b/.test(J([cv, tr])));
    var s = T.newState(p); apply(p, s, { k: "load", n: 15 }); apply(p, s, { k: "go", x: 3 });
    t.ok("describeCell: bước đã dùng nói rõ thao tác; bước chưa dùng 'chưa dùng'; ngoài dải không ném", T.describeCell(p, s, 0) === "Bước 1: lấy 15 quả" && T.describeCell(p, s, 1) === "Bước 2: đi tới km 3" && /chưa dùng/.test(T.describeCell(p, s, 2)) && T.describeCell(p, s, -1) && T.describeCell(p, s, 9999));
    t.ok("isGiven luôn false; newState: bản sao initial (không dùng chung mảng)", T.isGiven(p, 0) === false && J(T.newState(p).v) === J(p.initial.v) && T.newState(p).v !== p.initial.v);
    t.ok("kết quả sinh / replay / trace là JSON thuần (qua postMessage được)", (function () { try { return J([p, T.replay(p), cv, tr, T.solve(p)]).length > 100; } catch (e) { return false; } })());
  })();

  // ====================================================================== 9. Daily, engine thuần
  t.group("camel — CHƯA vào Daily (việc của P8)");
  (function () {
    var D = Puz.daily;
    if (!D) { t.ok("core/daily.js có trong ngữ cảnh kiểm", false); return; }
    var types = Puz.types.all().map(function (d) { return d.id; }), bad = [], day = "2026-10-01", n = 0;
    for (var i = 0; i < 800; i++) { var f = D.forDay(day, types); n++; if (!f || f.type === "camel") bad.push(day); day = Puz.util.addDays(day, 1); }
    t.ok("Puz.daily.ORDER và mọi phiên bản SCHEDULE không có camel; 800 ngày liên tiếp không ngày nào ra camel (" + n + " ngày)", D.ORDER.indexOf("camel") < 0 && D.SCHEDULE.every(function (v) { return v.ids.indexOf("camel") < 0; }) && bad.length === 0, bad.slice(0, 3));
  })();
  t.group("camel — engine thuần");
  (function () {
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/camel.js"), "utf8");
    t.ok("không dùng Math.random / Date / performance.now / DOM / Puz.text / Puz.ui / localStorage trong engine", !/Math\.random|Date\.now|new Date|performance\.now|document\.|window\.|localStorage|Puz\.text|Puz\.ui|Puz\.stats/.test(src));
    t.ok("ES5: không class / mũi tên / template literal / BigInt", !/\bclass\s+\w|=>|`|BigInt|\b\d+n\b/.test(src));
  })();
};
