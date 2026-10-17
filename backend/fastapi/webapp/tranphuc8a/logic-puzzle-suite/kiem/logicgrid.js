/* kiem/logicgrid.js — kiểm engine Logic Grid (HUONG-DAN-ENGINE.md mục 8).
   Nguồn sự thật ĐỘC LẬP: bộ vét cạn viết riêng trong tệp này (duyệt mọi hoán vị, tự đánh giá từng manh mối theo ngữ nghĩa ghi ở đầu engine) và bộ vét cạn có cắt tỉa
   (so với bộ vét cạn thuần để tự kiểm), KHÔNG dùng Puz.csp. Số nghiệm ví dụ đặc tả 3×3 do tự đếm tay rồi đối chiếu vét cạn.
   Biến môi trường: PUZ_QUICK=1 giảm số seed đo thời gian (từ 20 xuống 6); PUZ_PERF_SLACK nới giới hạn thời gian (qua t.slack). */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("logicgrid"), U = Puz.util, G = Puz.game, R = Puz.rng, APP = path.join(__dirname, "..");
  var QUICK = !!process.env.PUZ_QUICK, NSEED = QUICK ? 6 : 20, SLACK = t.slack || 1;
  function now() { return Date.now(); }

  // ═══════════════════════════════════════════════════════════════ nguồn sự thật độc lập: vét cạn
  function permsOf(n) {
    var out = [];
    (function rec(cur, rest) { if (!rest.length) { out.push(cur); return; } for (var i = 0; i < rest.length; i++) rec(cur.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1))); })([], Array.apply(null, Array(n)).map(function (_, i) { return i; }));
    return out;
  }
  /* asg[c][i] = hàng của mục i nhóm c (asg[0] = đơn vị). Ngữ nghĩa so sánh (xem đầu engine): giá trị_o(ref) = giá trị của MỤC nhóm o ở CÙNG HÀNG với ref. */
  function holds(cats, asg, cl) {
    function rowOf(ref) { return ref[0] === 0 ? ref[1] : asg[ref[0]][ref[1]]; }
    function itemAt(c, row) { if (c === 0) return row; for (var x = 0; x < asg[c].length; x++) if (asg[c][x] === row) return x; return -1; }
    var ra = rowOf(cl.a), i;
    if (cl.t === "eq") return ra === rowOf(cl.b);
    if (cl.t === "neq") return ra !== rowOf(cl.b);
    if (cl.t === "or") { for (i = 0; i < cl.list.length; i++) if (ra === rowOf(cl.list[i])) return true; return false; }
    var vals = cats[cl.o].values, xa = itemAt(cl.o, ra), xb = itemAt(cl.o, rowOf(cl.b)), va = vals[xa], vb = vals[xb];
    var sorted = vals.slice().sort(function (p, q) { return p - q; }), rka = sorted.indexOf(va), rkb = sorted.indexOf(vb);
    if (cl.t === "lt") return va < vb;
    if (cl.t === "offset") return Math.abs(va - (vb + cl.k)) < 1e-9;
    if (cl.t === "next") return Math.abs(rka - rkb) === 1;
    if (cl.t === "nnext") return Math.abs(rka - rkb) !== 1;
    throw new Error("loại manh mối lạ " + cl.t);
  }
  function maxCat(cl) {
    var m = Math.max(cl.a[0], cl.b ? cl.b[0] : 0, cl.o != null ? cl.o : 0);
    if (cl.list) cl.list.forEach(function (r) { m = Math.max(m, r[0]); });
    return m;
  }
  /** Vét cạn THUẦN: duyệt mọi tổ hợp hoán vị, kiểm mọi manh mối. Trả {count, first}. */
  function brutePlain(cats, clues) {
    var K = cats.length, N = cats[0].items.length, P = permsOf(N), count = 0, first = null, asg = [P[0]];
    asg[0] = []; for (var i = 0; i < N; i++) asg[0].push(i);
    (function rec(c) {
      if (c === K) { for (var k = 0; k < clues.length; k++) if (!holds(cats, asg, clues[k])) return; count++; if (!first) first = asg.map(function (a) { return a.slice(); }); return; }
      for (var p = 0; p < P.length; p++) { asg[c] = P[p]; rec(c + 1); }
    })(1);
    return { count: count, first: first };
  }
  /** Vét cạn có cắt tỉa: gán từng nhóm, kiểm sớm các manh mối chỉ dính nhóm đã gán. limit = dừng khi đủ. */
  function bruteSmart(cats, clues, limit) {
    var K = cats.length, N = cats[0].items.length, P = permsOf(N), count = 0, asg = [], i, byLevel = [];
    asg[0] = []; for (i = 0; i < N; i++) asg[0].push(i);
    for (i = 0; i < K; i++) byLevel.push([]);
    clues.forEach(function (cl) { byLevel[maxCat(cl)].push(cl); });
    for (i = 0; i < byLevel[0].length; i++) if (!holds(cats, asg, byLevel[0][i])) return 0;
    (function rec(c) {
      if (count >= limit) return;
      if (c === K) { count++; return; }
      for (var p = 0; p < P.length && count < limit; p++) {
        asg[c] = P[p];
        var ok = true;
        for (var k = 0; k < byLevel[c].length; k++) if (!holds(cats, asg, byLevel[c][k])) { ok = false; break; }
        if (ok) rec(c + 1);
      }
    })(1);
    return count;
  }
  function cellsToAsg(K, N, v) {                         // đọc lời giải từ solution.v theo công thức chỉ số ô ghi ở đầu engine
    var asg = [], c, i, r, b;
    asg.push(Array.apply(null, Array(N)).map(function (_, x) { return x; }));
    for (c = 1; c < K; c++) {
      var blk = c - 1, row = [];                           // khối (0,c) là khối thứ c-1 (các khối nhóm 0 đứng đầu)
      for (i = 0; i < N; i++) { row.push(-1); for (r = 0; r < N; r++) if (v[blk * N * N + r * N + i] === 1) row[i] = r; }
      asg.push(row);
    }
    return asg;
  }
  function dataClues(p) { return p.data.clues; }
  function isUniqueBrute(p) { return bruteSmart(p.data.cats, p.data.clues, 2) === 1; }

  // ═══════════════════════════════════════════════════════════════ 1. giao diện, kích cỡ, thuật toán
  t.group("Logic Grid — siêu dữ liệu");
  t.ok("đã đăng ký, id logicgrid", T && T.id === "logicgrid");
  t.eq("conformance rỗng", Puz.types.conformance(T), []);
  var TIERS = U.TIERS.map(function (x) { return x.id; });
  t.eq("kích cỡ: 3x3, 3x4, 4x4 (mặc định), 4x5, 5x5, params {cats, items}", T.sizes.map(function (s) { return s.id + ":" + s.params.cats + "x" + s.params.items + (s.default ? "*" : ""); }), ["3x3:3x3", "3x4:3x4", "4x4:4x4*", "4x5:4x5", "5x5:5x5"]);
  t.ok("mọi sizes[].tiers là bậc hợp lệ, không rỗng", T.sizes.every(function (s) { return Array.isArray(s.tiers) && s.tiers.length && s.tiers.every(function (x) { return TIERS.indexOf(x) >= 0; }); }), T.sizes.map(function (s) { return s.tiers; }));
  (function () {
    var dir = path.join(APP, "..", "algorithm-notebook", "assets", "data"), text = "";
    fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }).forEach(function (f) { text += fs.readFileSync(path.join(dir, f), "utf8") + "\n"; });
    T.algorithm.links.forEach(function (l) { t.ok("algorithm.links «" + l.id + "» có thật trong lib-*.js", text.indexOf('id: "' + l.id + '"') >= 0); });
    t.ok("algorithm có 3–5 bước", T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5, T.algorithm.steps.length);
  })();
  var vocab = T.vocabulary();
  t.ok("kho từ vựng: ≥ 8 nhóm, các nhóm không thứ tự có ≥ 8 mục", vocab.length >= 8 && vocab.filter(function (v) { return !v.ordered; }).every(function (v) { return v.pool.length >= 8; }), vocab.map(function (v) { return v.name + ":" + (v.pool ? v.pool.length : "ordered"); }));

  // ═══════════════════════════════════════════════════════════════ 2. vét cạn tự kiểm + ví dụ đặc tả
  t.group("Vét cạn: hai bộ đếm độc lập khớp nhau");
  function mkCats(K, N, orderedSpec) {                      // tên mục duy nhất toàn cục; nhóm thứ tự có giá trị KHÔNG tăng theo thứ tự mục
    var NAMES = ["Người", "Màu", "Nghề", "Thú", "Phố", "Món"], ITEMS = [["An", "Bình", "Chi", "Dũng", "Em", "Phát"], ["Đỏ", "Xanh", "Lục", "Vàng", "Tím", "Cam"], ["Bác sĩ", "Kỹ sư", "Giáo viên", "Đầu bếp", "Hoạ sĩ", "Luật sư"],
      ["Mèo", "Chó", "Thỏ", "Chim", "Cá", "Rùa"], ["Huế", "Hà Nội", "Đà Nẵng", "Cần Thơ", "Đà Lạt", "Vinh"], ["Phở", "Bún", "Cơm", "Chè", "Bánh mì", "Xôi"]], cats = [], c;
    for (c = 0; c < K; c++) {
      var o = orderedSpec && orderedSpec[c];
      cats.push({ name: NAMES[c], items: ITEMS[c].slice(0, N), ordered: !!o, values: o ? o.slice(0, N) : null });
    }
    return cats;
  }
  var rr = R.create(20261017), stats = { none: 0, unique: 0, multiple: 0 }, mismatches = [], total = 0, ordCases = 0, cross = [];
  var SHAPES = [[2, 2], [2, 3], [2, 4], [2, 6], [3, 2], [3, 3], [3, 3], [3, 4], [3, 5], [4, 2], [4, 3], [4, 3], [4, 4], [5, 3], [6, 3], [3, 3], [4, 3], [3, 4]];
  function randomCats(rng, K, N) {
    var spec = [], c;
    for (c = 0; c < K; c++) {
      if (rng.chance(0.45)) {
        var pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15], vals = rng.shuffle(pool.slice()).slice(0, N);
        spec.push(vals);
      } else spec.push(null);
    }
    return mkCats(K, N, spec);
  }
  function sampleClue(rng, cats, hidden) {                   // manh mối ngẫu nhiên (đúng hoặc sai); hidden = lời giải ẩn (để lọc "đúng")
    var K = cats.length, N = cats[0].items.length, ords = [], c;
    for (c = 0; c < K; c++) if (cats[c].ordered) ords.push(c);
    var types = ["eq", "neq"]; if (N >= 3) types.push("or"); if (ords.length) types = types.concat(["lt", "lt", "offset", "next", "nnext"]);
    var ty = rng.pick(types), a, b, ca, cb;
    function ref(cc) { return [cc, rng.int(N)]; }
    if (ty === "eq" || ty === "neq" || ty === "or") {
      ca = rng.int(K); do { cb = rng.int(K); } while (cb === ca);
      if (ty === "or") { var n2 = 2 + rng.int(Math.max(1, N - 2)), idx = rng.shuffle(Array.apply(null, Array(N)).map(function (_, x) { return x; })).slice(0, Math.min(n2, N - 1)); return { t: "or", a: ref(ca), list: idx.map(function (x) { return [cb, x]; }) }; }
      return { t: ty, a: ref(ca), b: ref(cb) };
    }
    var O = rng.pick(ords);
    do { a = ref(rng.int(K)); b = ref(rng.int(K)); } while (a[0] === b[0] && a[1] === b[1]);
    if (ty === "offset") return { t: "offset", o: O, a: a, b: b, k: rng.pick([1, 1, 2, 3, 5]) };
    return { t: ty, o: O, a: a, b: b };
  }
  function randomCase(rng) {
    var sh = rng.pick(SHAPES), K = sh[0], N = sh[1], cats = randomCats(rng, K, N), hidden = [Array.apply(null, Array(N)).map(function (_, x) { return x; })], c, clues = [];
    for (c = 1; c < K; c++) hidden.push(rng.shuffle(Array.apply(null, Array(N)).map(function (_, x) { return x; })));
    var mode = rng.int(10), want = mode === 0 ? 0 : 1 + rng.int(K * N + 3), guard = 0;
    while (clues.length < want && guard++ < 400) {
      var cl = sampleClue(rng, cats, hidden);
      if (!holds(cats, hidden, cl)) continue;
      clues.push(cl);
      if (bruteSmart(cats, clues, 2) === 1 && rng.chance(0.55)) break;
    }
    if (clues.length && rng.chance(0.25)) {                 // chèn một manh mối có thể sai → vô nghiệm hoặc ít nghiệm hơn
      var bad = null, g2 = 0; while (g2++ < 200) { var q = sampleClue(rng, cats, hidden); if (!holds(cats, hidden, q)) { bad = q; break; } }
      if (bad) clues[rng.int(clues.length)] = bad;
    }
    return { K: K, N: N, cats: cats, clues: clues, hidden: hidden };
  }
  var RANDOM_N = 260, caseBank = [];
  for (var ci = 0; ci < RANDOM_N; ci++) caseBank.push(randomCase(rr));
  var tinyAgree = 0, tinyTotal = 0;
  caseBank.forEach(function (cs) {
    var combos = Math.pow(Number(Array.apply(null, Array(cs.N)).reduce(function (a, _, i) { return a * (i + 1); }, 1)), cs.K - 1);
    if (combos <= 14400) {
      var a1 = brutePlain(cs.cats, cs.clues).count, a2 = bruteSmart(cs.cats, cs.clues, 1e9);
      tinyTotal++; if (a1 === a2) tinyAgree++;
    }
  });
  t.ok("vét cạn thuần và vét cạn cắt tỉa cho cùng số nghiệm (" + tinyTotal + " đề)", tinyAgree === tinyTotal, tinyAgree + "/" + tinyTotal);

  t.group("Ví dụ đặc tả 3×3 (số nghiệm tự đếm tay: 4)");
  var SPEC = { cats: [{ name: "Người", items: ["Alice", "Bob", "Carol"] }, { name: "Màu", items: ["Đỏ", "Xanh", "Lục"] }, { name: "Nghề", items: ["Bác sĩ", "Kỹ sư", "Giáo viên"] }], clues: ["Alice != Đỏ", "Xanh = Bob", "Carol != Bác sĩ"] };
  /* Đếm tay: Bob = Xanh, Alice ≠ Đỏ ⇒ Alice = Lục, Carol = Đỏ (1 cách chia màu). Nghề: 3! = 6 hoán vị, bỏ 2 hoán vị có Carol = Bác sĩ ⇒ 4. Tổng 1 × 4 = 4. */
  var specR = T.fromInput(SPEC), specBrute = brutePlain(specR.puzzle.data.cats, specR.puzzle.data.clues);
  t.eq("vét cạn đếm đúng 4 nghiệm (khớp số đếm tay)", specBrute.count, 4);
  t.ok("fromInput: ok, status multiple (cảnh báo), count (tới 2) = 2", specR.ok && specR.status === "multiple" && specR.count === 2 && specR.warnings.length >= 1 && specR.errors.length === 0, specR);
  var spec2 = T.fromInput({ cats: SPEC.cats, clues: SPEC.clues.concat(["Alice = Giáo viên"]) });
  t.ok("thêm «Alice = Giáo viên»: duy nhất (vét cạn = 1, status unique)", spec2.ok && spec2.status === "unique" && brutePlain(spec2.puzzle.data.cats, spec2.puzzle.data.clues).count === 1, spec2.status);
  t.eq("lời giải duy nhất đọc từ solution.v: Alice=Lục+Giáo viên, Bob=Xanh+Bác sĩ, Carol=Đỏ+Kỹ sư", (function () {
    var asg = cellsToAsg(3, 3, spec2.puzzle.solution.v); return [asg[1], asg[2]];
  })(), [[2, 1, 0], [1, 2, 0]]);
  t.ok("«Carol = Bác sĩ» thêm vào → vô nghiệm: ok=false, status none", (function () { var r = T.fromInput({ cats: SPEC.cats, clues: SPEC.clues.concat(["Carol = Bác sĩ"]) }); return !r.ok && r.status === "none" && r.errors.length > 0 && r.puzzle === null; })());
  t.ok("câu tiếng Việt cho ví dụ", T.clueText(specR.puzzle, 0) === "Alice không mặc màu Đỏ" && T.clueText(specR.puzzle, 1) === "Người mặc màu Xanh là Bob" && T.clueText(specR.puzzle, 2) === "Carol không làm nghề Bác sĩ", [0, 1, 2].map(function (k) { return T.clueText(specR.puzzle, k); }));

  // ═══════════════════════════════════════════════════════════════ 3. fromInput / validate / solve so với vét cạn
  t.group("fromInput / validate / solve đối chiếu vét cạn (" + RANDOM_N + " đề ngẫu nhiên)");
  var badRows = [], validBad = [], solveBad = [], solBad = [], goodPuzzles = [];
  caseBank.forEach(function (cs, idx) {
    var cnt = bruteSmart(cs.cats, cs.clues, 2), exp = cnt === 0 ? "none" : cnt === 1 ? "unique" : "multiple", r = T.fromInput({ cats: cs.cats, clues: cs.clues });
    stats[exp]++; if (cs.cats.some(function (c) { return c.ordered; }) && cs.clues.some(function (c) { return c.o != null; })) ordCases++;
    if (r.status !== exp || r.ok !== (exp !== "none") || (exp !== "none" && r.count !== cnt)) { badRows.push(idx + ": " + exp + "/" + cnt + " ≠ " + r.status + "/" + r.count + " " + JSON.stringify(r.errors)); return; }
    if (exp === "none") return;
    var p = r.puzzle, v = T.validate(p), s = T.solve(p, { explain: false });
    if (!v.ok || v.status !== exp || v.count !== cnt) validBad.push(idx + " validate " + v.status + "/" + v.count);
    if (s.status !== exp || s.count !== cnt) solveBad.push(idx + " solve " + s.status + "/" + s.count);
    var asg = cellsToAsg(cs.K, cs.N, p.solution.v), all = p.data.clues.every(function (cl) { return holds(p.data.cats, asg, cl); });
    if (!all || asg.some(function (a) { return a.indexOf(-1) >= 0; })) solBad.push(idx + " solution không thoả manh mối");
    goodPuzzles.push({ p: p, cs: cs, exp: exp });
  });
  t.ok("fromInput: status/ok/count khớp vét cạn trên mọi đề", badRows.length === 0, badRows.slice(0, 4));
  t.ok("đủ cả ba loại: vô nghiệm, duy nhất, nhiều nghiệm (mỗi loại ≥ 20 đề)", stats.none >= 20 && stats.unique >= 20 && stats.multiple >= 20, stats);
  t.ok("có đề dùng manh mối thứ tự (≥ 60)", ordCases >= 60, ordCases);
  t.ok("validate khớp vét cạn", validBad.length === 0, validBad.slice(0, 4));
  t.ok("solve (limit 2) khớp vét cạn", solveBad.length === 0, solveBad.slice(0, 4));
  t.ok("solution trong puzzle là một lời giải thật (vét cạn kiểm lại)", solBad.length === 0, solBad.slice(0, 4));
  t.ok("solve({limit:5}) đếm đúng tới 5 trên đề nhiều nghiệm", (function () {
    var bad = 0, tested = 0;
    goodPuzzles.forEach(function (g) { if (g.exp !== "multiple" || tested > 30) return; var real = bruteSmart(g.cs.cats, g.cs.clues, 5), s = T.solve(g.p, { limit: 5, explain: false }); tested++; if (s.count !== real) bad++; });
    return bad === 0 && tested > 10;
  })());
  t.ok("validate: puzzle thiếu/hỏng trả ok:false, không ném lỗi", [null, undefined, {}, { data: null }, { type: "logicgrid", data: { cats: [] } }, { type: "logicgrid", data: { cats: [{ name: "a", items: ["x"] }], clues: [] } }, "x", 5].every(function (x) {
    try { var r = T.validate(x); return r.ok === false && r.errors.length > 0; } catch (e) { return false; }
  }));

  // ═══════════════════════════════════════════════════════════════ 4. DSL: phân tích ↔ định dạng, lỗi tiếng Việt
  t.group("DSL manh mối");
  var dd = T.fromInput({ cats: [{ name: "Người", items: ["An", "Bình", "Chi"] }, { name: "Màu", items: ["Đỏ", "Xanh", "Lục"] }, { name: "Vị trí", items: ["1", "2", "3"], ordered: true }, { name: "Tuổi", items: ["20", "30", "40"], ordered: true }], clues: [] }).puzzle.data;
  function P(s) { return T.parseClue(s, dd); }
  t.eq("An != Đỏ", P("An != Đỏ").clue, { t: "neq", a: [0, 0], b: [1, 0] });
  t.eq("Bình = Xanh", P("Bình = Xanh").clue, { t: "eq", a: [0, 1], b: [1, 1] });
  t.eq("An = Đỏ | Xanh (hoặc)", P("An = Đỏ | Xanh").clue, { t: "or", a: [0, 0], list: [[1, 0], [1, 1]] });
  t.eq("hoặc bằng từ «hoặc» và «or»", [P("An = Đỏ hoặc Xanh").clue, P("An = Đỏ or Xanh").clue], [{ t: "or", a: [0, 0], list: [[1, 0], [1, 1]] }, { t: "or", a: [0, 0], list: [[1, 0], [1, 1]] }]);
  t.eq("An < Bình dùng nhóm thứ tự ĐẦU TIÊN (Vị trí)", P("An < Bình").clue, { t: "lt", o: 2, a: [0, 0], b: [0, 1] });
  t.eq("left-of = <, right-of và > đảo vế", [P("An left-of Bình").clue, P("An right-of Bình").clue, P("Chi > An").clue], [{ t: "lt", o: 2, a: [0, 0], b: [0, 1] }, { t: "lt", o: 2, a: [0, 1], b: [0, 0] }, { t: "lt", o: 2, a: [0, 0], b: [0, 2] }]);
  t.eq("hậu tố @Tuổi chọn nhóm so sánh", P("An < Bình @Tuổi").clue, { t: "lt", o: 3, a: [0, 0], b: [0, 1] });
  t.eq("next-to / not-next-to", [P("An next-to Bình").clue.t, P("An not-next-to Bình").clue.t, P("An !next-to Bình").clue.t], ["next", "nnext", "nnext"]);
  t.eq("offset A = B + k và A = B - k (đảo vế)", [P("An = Bình + 2").clue, P("An = Bình - 1").clue], [{ t: "offset", o: 2, a: [0, 0], b: [0, 1], k: 2 }, { t: "offset", o: 2, a: [0, 1], b: [0, 0], k: 1 }]);
  t.eq("An = Vị trí 2 và An = Position 2 (cùng nghĩa, mục thuộc nhóm thứ tự)", [P("An = Vị trí 2").clue, P("An = Position 2").clue], [{ t: "eq", a: [0, 0], b: [2, 1] }, { t: "eq", a: [0, 0], b: [2, 1] }]);
  t.eq("không phân biệt hoa thường và dấu", [P("an != do").clue, P("AN != ĐỎ").clue, P("  An   !=   Đỏ ").clue], [P("An != Đỏ").clue, P("An != Đỏ").clue, P("An != Đỏ").clue]);
  t.eq("Nhóm:Mục", P("Màu:Đỏ = An").clue, { t: "eq", a: [1, 0], b: [0, 0] });
  var errCases = [["Zed = Đỏ", /Không tìm thấy mục/], ["An < Đỏ @Màu", /không có thứ tự/], ["An ? Bình", /Thiếu phép toán/], ["", /trống/], ["An =", /Thiếu vế/], ["An <= Bình", /Chưa hỗ trợ/], ["An = An", /vô nghĩa|cùng/], ["Đỏ = Xanh", /cùng một nhóm/], ["An < Bình @Nhóm lạ", /Không có nhóm/], ["An = Đỏ | Đỏ", /lặp/]];
  errCases.forEach(function (c) { var r = P(c[0]); t.ok("lỗi «" + c[0] + "» → tiếng Việt khớp " + c[1], !r.ok && c[1].test(r.error), r); });
  t.ok("không có nhóm thứ tự mà dùng < → báo lỗi tiếng Việt", (function () { var d0 = T.fromInput({ cats: SPEC.cats, clues: [] }).puzzle.data, r = T.parseClue("Alice < Bob", d0); return !r.ok && /chưa có nhóm nào có thứ tự/.test(r.error); })());
  t.ok("parseClue không ném lỗi với đầu vào xấu", [null, undefined, 5, {}, [], "<<<", "= =", "a|b|c", "\u0000"].every(function (x) { try { var r = T.parseClue(x, dd); return r && r.ok === false && typeof r.error === "string"; } catch (e) { return false; } }));
  t.ok("parseClue(data = null) không ném lỗi", T.parseClue("a = b", null).ok === false && T.parseClue("a = b", {}).ok === false);
  var rtBad = [], rtN = 0;
  goodPuzzles.forEach(function (g) {
    g.p.data.clues.forEach(function (cl, k) {
      var s = T.formatClue(cl, g.p.data), r = T.parseClue(s, g.p.data); rtN++;
      if (!r.ok || JSON.stringify(r.clue) !== JSON.stringify(cl)) rtBad.push(s + " → " + JSON.stringify(r));
    });
  });
  t.ok("parse(format(clue)) = clue trên mọi manh mối của các đề ngẫu nhiên (" + rtN + " manh mối)", rtBad.length === 0 && rtN > 500, rtBad.slice(0, 3));
  var ddup = T.fromInput({ cats: [{ name: "Người", items: ["An", "Bình"] }, { name: "Bạn", items: ["Bình", "An"] }], clues: ["Người:An = Bạn:Bình"] });
  t.ok("tên mục trùng giữa nhóm: cảnh báo, DSL Nhóm:Mục dùng được, không Nhóm thì báo mơ hồ", ddup.ok && ddup.warnings.some(function (w) { return /nhiều nhóm/.test(w); }) && /nhiều nhóm/.test(T.parseClue("An = Bình", ddup.puzzle.data).error) && T.formatClue(ddup.puzzle.data.clues[0], ddup.puzzle.data) === "Người:An = Bạn:Bình", ddup);

  // ═══════════════════════════════════════════════════════════════ 5. sinh đề: tất định, duy nhất, cần thiết
  t.group("generate — đo thật (" + NSEED + " seed mỗi (cỡ, bậc))");
  var bank = {}, timing = {}, hits = {}, means = {};
  var CASES = [];
  T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tr) { CASES.push([sz.id, tr]); }); });
  CASES.forEach(function (c) {
    var key = c[0] + "/" + c[1], list = [], ms = [], hit = 0, sc = [];
    for (var s = 1; s <= NSEED; s++) {
      var t0 = now(), p = T.generate(100000 + s * 37, { sizeId: c[0], tier: c[1] });
      ms.push(now() - t0);
      if (!p) { list.push(null); continue; }
      list.push(p); sc.push(p.score); if (p.tier === c[1] && U.tierOfScore(p.score).id === c[1]) hit++;
    }
    bank[key] = list; ms.sort(function (a, b) { return a - b; });
    timing[key] = { med: ms[ms.length >> 1], max: ms[ms.length - 1] }; hits[key] = hit / NSEED;
    means[key] = sc.length ? sc.reduce(function (a, b) { return a + b; }, 0) / sc.length : -1;
    t.info(key + ": trúng bậc " + hit + "/" + NSEED + ", thời gian trung vị " + timing[key].med + " ms, tệ nhất " + timing[key].max + " ms, điểm trung bình " + means[key].toFixed(2) + " (min " + Math.min.apply(null, sc) + ", max " + Math.max.apply(null, sc) + ")");
  });
  t.ok("mọi lần generate trả về đề (không null)", Object.keys(bank).every(function (k) { return bank[k].every(function (p) { return !!p; }); }));
  t.ok("generate: trung vị ≤ 1,5 s và xấu nhất ≤ 4 s ở mọi (cỡ, bậc)", CASES.every(function (c) { var m = timing[c[0] + "/" + c[1]]; return m.med <= 1500 * SLACK && m.max <= 4000 * SLACK; }), CASES.map(function (c) { return c[0] + "/" + c[1] + ":" + timing[c[0] + "/" + c[1]].med + "/" + timing[c[0] + "/" + c[1]].max; }).join(" "));
  t.ok("generate: ≥ 90 % seed rơi đúng bậc ở mọi (cỡ, bậc) được quảng cáo", CASES.every(function (c) { return hits[c[0] + "/" + c[1]] >= 0.9; }), CASES.map(function (c) { return c[0] + "/" + c[1] + ":" + Math.round(hits[c[0] + "/" + c[1]] * 100) + "%"; }).join(" "));
  t.ok("puzzle.tier đúng với điểm (trung thực, kể cả khi lệch bậc)", CASES.every(function (c) { return bank[c[0] + "/" + c[1]].every(function (p) { return p.tier === U.tierOfScore(p.score).id || p.tier === c[1] && U.tierOfScore(p.score).id === c[1]; }); }));
  T.sizes.forEach(function (sz) {
    var ms = sz.tiers.map(function (tr) { return means[sz.id + "/" + tr]; }), ok = true;
    for (var i = 1; i < ms.length; i++) if (!(ms[i] > ms[i - 1])) ok = false;
    t.ok("độ khó đơn điệu theo bậc (điểm trung bình tăng) ở cỡ " + sz.id + ": " + ms.map(function (x) { return x.toFixed(1); }).join(" < "), ok);
  });
  t.ok("điểm 0–10, một chữ số thập phân; score khớp difficulty(puzzle)", CASES.every(function (c) { return bank[c[0] + "/" + c[1]].slice(0, 4).every(function (p) { return p.score >= 0 && p.score <= 10 && Math.round(p.score * 10) / 10 === p.score && T.difficulty(p) === p.score; }); }));
  t.ok("cấu trúc puzzle: v, type, id, seed, sizeId, size, data, initial/solution cùng độ dài", CASES.every(function (c) { return bank[c[0] + "/" + c[1]].slice(0, 3).every(function (p) {
    var K = p.size.cats, N = p.size.items, tot = K * (K - 1) / 2 * N * N;
    return p.v === 1 && p.type === "logicgrid" && p.id === U.puzzleId(p) && typeof p.seed === "number" && p.sizeId === c[0] && p.initial.v.length === tot && p.solution.v.length === tot && p.initial.v.every(function (x) { return x === 0; }) && p.solution.v.every(function (x) { return x === 1 || x === 2; });
  }); }));
  t.ok("puzzle là JSON thuần (qua JSON.stringify/parse không đổi)", CASES.every(function (c) { var p = bank[c[0] + "/" + c[1]][0]; return JSON.stringify(JSON.parse(JSON.stringify(p))) === JSON.stringify(p); }));
  t.group("generate — tất định, duy nhất (vét cạn), mọi manh mối cần thiết");
  var detBad = [], uniBad = [], needBad = [], needN = 0, uniN = 0, bruteSizes = { "3x3": 1, "3x4": 1, "4x4": 1, "4x5": 1 };
  CASES.forEach(function (c) {
    var list = bank[c[0] + "/" + c[1]], s;
    for (s = 1; s <= 2; s++) {
      var again = T.generate(100000 + s * 37, { sizeId: c[0], tier: c[1] });
      if (JSON.stringify(again) !== JSON.stringify(list[s - 1])) detBad.push(c.join("/") + "#" + s);
    }
    list.forEach(function (p, i) {
      var sv = T.solve(p, { explain: false });
      if (sv.status !== "unique") uniBad.push(c.join("/") + "#" + i + " solve=" + sv.status);
      if (bruteSizes[c[0]] && (i < (c[0] === "4x5" ? 3 : QUICK ? 4 : 8))) {
        uniN++;
        if (bruteSmart(p.data.cats, p.data.clues, 2) !== 1) uniBad.push(c.join("/") + "#" + i + " vét cạn ≠ 1");
        needN++;
        p.data.clues.forEach(function (cl, k) { var rest = p.data.clues.filter(function (_, q) { return q !== k; }); if (bruteSmart(p.data.cats, rest, 2) < 2) needBad.push(c.join("/") + "#" + i + " bỏ manh mối " + (k + 1) + " vẫn duy nhất"); });
      }
    });
  });
  t.ok("cùng (seed, cỡ, bậc) → cùng puzzle từng bit (2 seed mỗi (cỡ, bậc))", detBad.length === 0, detBad.slice(0, 4));
  t.ok("mọi đề sinh ra: solve báo duy nhất; vét cạn độc lập báo 1 nghiệm trên " + uniN + " đề (cỡ ≤ 4×5)", uniBad.length === 0 && uniN > 20, uniBad.slice(0, 4));
  t.ok("mọi manh mối đều cần thiết: bỏ bất kỳ manh mối nào → ≥ 2 nghiệm (vét cạn, " + needN + " đề)", needBad.length === 0, needBad.slice(0, 4));
  t.ok("không manh mối tầm thường: hai vế khác nhóm, không trùng lặp, đúng với lời giải", CASES.every(function (c) { return bank[c[0] + "/" + c[1]].every(function (p) {
    var asg = cellsToAsg(p.size.cats, p.size.items, p.solution.v), seen = {};
    return p.data.clues.every(function (cl) { var key = JSON.stringify(cl); if (seen[key]) return false; seen[key] = 1; return holds(p.data.cats, asg, cl) && (cl.t !== "eq" && cl.t !== "neq" && cl.t !== "or" || cl.a[0] !== (cl.b ? cl.b[0] : cl.list[0][0])); });
  }); }));
  t.ok("đề dễ chỉ dùng eq/neq; đề khó/chuyên gia có manh mối «hoặc»/thứ tự", (function () {
    var easyOk = true, hardOk = true;
    CASES.forEach(function (c) { bank[c[0] + "/" + c[1]].forEach(function (p) {
      var cx = p.data.clues.filter(function (cl) { return cl.t !== "eq" && cl.t !== "neq"; }).length;
      if (c[1] === "easy" && cx > 0) easyOk = false;
      if ((c[1] === "expert") && cx < 2) hardOk = false;
    }); });
    return easyOk && hardOk;
  })());
  t.ok("không dùng Math.random/Date trong generate: seed khác → đề khác", T.generate(1, { sizeId: "4x4", tier: "medium" }).id !== T.generate(2, { sizeId: "4x4", tier: "medium" }).id);
  t.ok("generate không ném lỗi với tuỳ chọn xấu (cỡ/bậc lạ, seed lạ)", [[1, {}], [2, null], [3, { sizeId: "9x9", tier: "x" }], ["abc", { sizeId: "3x3", tier: "easy" }], [-5, { sizeId: "3x3", tier: "easy" }], [NaN, undefined]].every(function (a) {
    try { var p = T.generate(a[0], a[1]); return p && p.type === "logicgrid" && T.validate(p).status === "unique"; } catch (e) { return false; }
  }));

  // ═══════════════════════════════════════════════════════════════ 6. moveFor / check / mistakes
  t.group("moveFor / check / mistakes");
  var pz = bank["4x4/medium"][0], K4 = pz.size.cats, N4 = pz.size.items, TOT = pz.initial.v.length;
  var s0 = T.newState(pz);
  t.ok("newState: bản sao của initial, c = null", s0.v.length === TOT && s0.c === null && s0.v !== pz.initial.v && s0.v.every(function (x) { return x === 0; }));
  t.ok("không ô nào cố định (isGiven)", Array.apply(null, Array(TOT)).every(function (_, i) { return !T.isGiven(pz, i); }));
  t.eq("cycle: trống → ✗ → ✓ → trống", (function () {
    var st = T.newState(pz), out = [];
    for (var i = 0; i < 4; i++) { var d = T.moveFor(pz, st, { k: "cycle", i: 5 }, {}); G.applyDiff(st, d.d, false); out.push(st.v[5]); }
    return out;
  })(), [2, 1, 0, 2]);
  t.ok("set cùng giá trị / giá trị lạ / ô ngoài khoảng / hành động lạ → null", T.moveFor(pz, s0, { k: "set", i: 3, val: 0 }, {}) === null && T.moveFor(pz, s0, { k: "set", i: 3, val: 7 }, {}) === null && T.moveFor(pz, s0, { k: "set", i: -1, val: 1 }, {}) === null && T.moveFor(pz, s0, { k: "set", i: TOT, val: 1 }, {}) === null && T.moveFor(pz, s0, { k: "zzz", i: 1 }, {}) === null && T.moveFor(pz, s0, null, {}) === null && T.moveFor(pz, s0, { k: "set", i: 1.5, val: 1 }, {}) === null);
  // khối (0,1) là khối đầu: ô (a, b) = a·N + b
  t.ok("autoRemove: ✓ ở (hàng 1, cột 2) khối (0,1) → ✗ mọi ô còn lại của hàng 1 và cột 2 khối đó, một diff", (function () {
    var st = T.newState(pz), d = T.moveFor(pz, st, { k: "set", i: 1 * N4 + 2, val: 1 }, { autoRemove: true }), exp = {}, a, b;
    exp[1 * N4 + 2] = 1;
    for (b = 0; b < N4; b++) if (b !== 2) exp[1 * N4 + b] = 2;
    for (a = 0; a < N4; a++) if (a !== 1) exp[a * N4 + 2] = 2;
    var got = {}; d.d.forEach(function (e) { got[e[1]] = e[3]; });
    // ngoài khối (0,1): bắc cầu qua các khối khác chưa có ✓ nên không có thêm gì
    return JSON.stringify(got) === JSON.stringify(exp) || (Object.keys(exp).every(function (k) { return got[k] === exp[k]; }) && Object.keys(got).length === Object.keys(exp).length);
  })());
  t.ok("autoRemove tắt: chỉ đúng một ô đổi", (function () { var d = T.moveFor(pz, T.newState(pz), { k: "set", i: 6, val: 1 }, { autoRemove: false }); return d.d.length === 1 && d.d[0][1] === 6; })());
  t.ok("autoRemove: ✓ bắc cầu giữa các khối (A=Đỏ, Đỏ=Chó ⇒ A=Chó)", (function () {
    var st = T.newState(pz), i1 = T.cellIndex(pz, 0, 0, 1, 2), i2 = T.cellIndex(pz, 1, 2, 2, 3), i3 = T.cellIndex(pz, 0, 0, 2, 3);
    G.applyDiff(st, T.moveFor(pz, st, { k: "set", i: i1, val: 1 }, { autoRemove: true }).d, false);
    var d = T.moveFor(pz, st, { k: "set", i: i2, val: 1 }, { autoRemove: true });
    return d.d.some(function (e) { return e[1] === i3 && e[3] === 1; });
  })());
  t.ok("autoRemove không ghi đè ô đã có dấu và không tự bịa khi dấu mới mâu thuẫn", (function () {
    var st = T.newState(pz), i = 0, j = 1; G.applyDiff(st, [["v", j, 0, 1]], false);       // ✓ ở (0,0)-(cột 1)
    var d = T.moveFor(pz, st, { k: "set", i: i, val: 1 }, { autoRemove: true });           // ✓ thứ hai cùng hàng → mâu thuẫn
    return d.d.length === 1 && d.d[0][1] === 0;
  })());
  var invBad = [];
  [pz, bank["3x4/hard"][1], bank["5x5/medium"][0]].forEach(function (p, pi) {
    var rng = R.create(77 + pi), st = T.newState(p), tot = p.initial.v.length;
    for (var step = 0; step < 220; step++) {
      var act = rng.chance(0.5) ? { k: "cycle", i: rng.int(tot) } : { k: "set", i: rng.int(tot), val: rng.int(3) }, settings = { autoRemove: rng.chance(0.5) };
      var before = JSON.stringify(st), diff = T.moveFor(p, st, act, settings);
      if (!diff) continue;
      if (!diff.d.every(function (e) { return e[0] === "v" && st.v[e[1]] === e[2] && e[2] !== e[3]; })) { invBad.push("diff không khớp state cũ"); break; }
      var work = G.copyState(st); G.applyDiff(work, diff.d, false); G.applyDiff(work, G.reverseDiff(diff.d), false);
      if (JSON.stringify(work) !== before) { invBad.push("hoàn tác không về đúng"); break; }
      G.applyDiff(st, diff.d, false);
      var chk = T.check(p, st); if (chk.filled !== st.v.filter(Boolean).length || chk.total !== tot) { invBad.push("check.filled/total sai"); break; }
    }
  });
  t.ok("1000+ nước ngẫu nhiên: mọi diff áp rồi hoàn lại ra đúng state cũ; diff khớp state; filled/total đúng", invBad.length === 0, invBad);
  CASES.forEach(function (c) {
    var p = bank[c[0] + "/" + c[1]][0], st = { v: p.solution.v.slice(), c: null }, ck = T.check(p, st);
    t.ok("check(solution) = solved, không xung đột — " + c.join("/"), ck.solved && ck.conflicts.length === 0 && ck.filled === ck.total, ck);
  });
  // conflicts đối chiếu bản viết lại độc lập: thành phần ✓ có hai mục cùng nhóm / ✗ giữa hai mục cùng thành phần / hàng-cột toàn ✗
  function refConflicts(K, N, v) {
    var parent = [], i, out = {}, blk, a, b, r, c0;
    for (i = 0; i < K * N; i++) parent.push(i);
    function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
    var blocks = [];
    for (var ci = 0; ci < K; ci++) for (var cj = ci + 1; cj < K; cj++) blocks.push([ci, cj]);
    blocks.forEach(function (bk, bi) { for (a = 0; a < N; a++) for (b = 0; b < N; b++) if (v[bi * N * N + a * N + b] === 1) parent[find(bk[0] * N + a)] = find(bk[1] * N + b); });
    var seen = {}, bad = {};
    for (i = 0; i < K * N; i++) { var rt = find(i), cat = Math.floor(i / N), key = rt + ":" + cat; if (seen[key]) bad[rt] = 1; seen[key] = 1; }
    blocks.forEach(function (bk, bi) {
      for (a = 0; a < N; a++) for (b = 0; b < N; b++) {
        var cell = bi * N * N + a * N + b, x = find(bk[0] * N + a), y = find(bk[1] * N + b);
        if (v[cell] === 1 && bad[x]) out[cell] = 1;
        if (v[cell] === 2 && x === y) out[cell] = 1;
      }
      for (a = 0; a < N; a++) { var all = true; for (b = 0; b < N; b++) if (v[bi * N * N + a * N + b] !== 2) all = false; if (all) for (b = 0; b < N; b++) out[bi * N * N + a * N + b] = 1; }
      for (b = 0; b < N; b++) { var all2 = true; for (a = 0; a < N; a++) if (v[bi * N * N + a * N + b] !== 2) all2 = false; if (all2) for (a = 0; a < N; a++) out[bi * N * N + a * N + b] = 1; }
    });
    return out;
  }
  var cfBad = [], cfN = 0;
  [bank["3x3/medium"][2], bank["4x4/easy"][1], bank["4x4/hard"][2], bank["3x4/medium"][3]].forEach(function (p, pi) {
    var K = p.size.cats, N = p.size.items, rng = R.create(900 + pi);
    for (var trial = 0; trial < 160; trial++) {
      var v = p.solution.v.map(function (x) { return rng.chance(0.55) ? x : 0; });
      var flips = rng.int(4); for (var f = 0; f < flips; f++) { var q = rng.int(v.length); v[q] = rng.int(3); }
      var st = { v: v, c: null }, ck = T.check(p, st), ref = refConflicts(K, N, v), got = {}; ck.conflicts.forEach(function (x) { got[x] = 1; }); cfN++;
      var missing = Object.keys(ref).filter(function (k) { return !got[k]; });
      if (missing.length) cfBad.push("thiếu xung đột " + missing.slice(0, 3));
      var sol = p.solution.v, onlyTrue = v.every(function (x, i) { return x === 0 || x === sol[i]; });
      if (onlyTrue && ck.conflicts.length) cfBad.push("dấu toàn đúng mà báo xung đột");
      if (!ck.conflicts.length && ck.solved && !v.every(function (x, i) { return x === 0 || x === sol[i]; }) && JSON.stringify(v.map(function (x, i) { return x === 1 ? 1 : 0; })) !== JSON.stringify(sol.map(function (x) { return x === 1 ? 1 : 0; }))) { /* solved với ✓ khác lời giải: chỉ được nếu đề nhiều nghiệm */ cfBad.push("solved nhưng ✓ khác lời giải duy nhất"); }
    }
  });
  t.ok("check.conflicts ⊇ bản viết lại độc lập (thành phần ✓ trùng nhóm, ✗ giữa hai mục cùng nhóm, hàng/cột toàn ✗) và dấu toàn đúng không xung đột (" + cfN + " trạng thái)", cfBad.length === 0, cfBad.slice(0, 4));
  t.ok("hai ✓ cùng hàng trong một khối: cả hai ô bị báo xung đột", (function () {
    var p = pz, st = T.newState(p), sol = p.solution.v, a = 0, c1 = -1, c2 = -1, b;
    for (b = 0; b < N4; b++) if (sol[a * N4 + b] === 1) c1 = b; else if (c2 < 0) c2 = b;
    st.v[a * N4 + c1] = 1; st.v[a * N4 + c2] = 1;
    var ck = T.check(p, st); return ck.conflicts.indexOf(a * N4 + c1) >= 0 && ck.conflicts.indexOf(a * N4 + c2) >= 0 && !ck.solved;
  })());
  t.ok("✓ vô lý với manh mối (không cùng hàng/cột) cũng bị báo", (function () {
    // tìm một ô ✗ của lời giải mà lan truyền manh mối đã loại: đặt ✓ vào đó
    var p = bank["3x3/easy"][0], sol = p.solution.v, found = false, i;
    for (i = 0; i < 9 && !found; i++) if (sol[i] === 2) { var st = T.newState(p); st.v[i] = 1; if (T.check(p, st).conflicts.indexOf(i) >= 0) found = true; }
    return found;
  })());
  t.ok("solved chỉ cần các ✓ nối đủ về nhóm 0 (không cần ✗ và không cần mọi khối)", (function () {
    var p = pz, K = p.size.cats, N = p.size.items, v = p.initial.v.slice(), blk, i;
    for (blk = 0; blk < K - 1; blk++) for (i = 0; i < N * N; i++) if (p.solution.v[blk * N * N + i] === 1) v[blk * N * N + i] = 1;
    return T.check(p, { v: v, c: null }).solved === true;
  })());
  t.ok("thiếu một ✓ → chưa solved; một ✓ sai chỗ → không solved", (function () {
    var p = pz, K = p.size.cats, N = p.size.items, v = p.initial.v.slice(), blk, i, drop = -1;
    for (blk = 0; blk < K - 1; blk++) for (i = 0; i < N * N; i++) if (p.solution.v[blk * N * N + i] === 1) { v[blk * N * N + i] = 1; drop = blk * N * N + i; }
    var w = v.slice(); w[drop] = 0;
    return !T.check(p, { v: w, c: null }).solved && T.check(p, { v: v, c: null }).solved;
  })());
  t.ok("mistakes: ✓ vào ô lời giải là ✗ → 1; ✗ vào ô lời giải là ✓ → 1; nước đúng → 0; xoá → 0", (function () {
    var p = pz, st = T.newState(p), sol = p.solution.v, one = sol.indexOf(1), two = sol.indexOf(2);
    var m1 = T.mistakes(p, st, { d: [["v", two, 0, 1]] }), m2 = T.mistakes(p, st, { d: [["v", one, 0, 2]] }), m3 = T.mistakes(p, st, { d: [["v", one, 0, 1]] }), m4 = T.mistakes(p, st, { d: [["v", two, 0, 2]] }), m5 = T.mistakes(p, st, { d: [["v", two, 1, 0]] });
    return m1 === 1 && m2 === 1 && m3 === 0 && m4 === 0 && m5 === 0;
  })());
  t.ok("mistakes: dấu phụ do autoRemove không đếm thêm (✓ sai kéo theo ✗ 'sai' vẫn là 1 lỗi)", (function () {
    var p = pz, st = T.newState(p), sol = p.solution.v, wrongOne = -1, i;
    for (i = 0; i < N4 * N4; i++) if (sol[i] === 2) { wrongOne = i; break; }
    var d = T.moveFor(p, st, { k: "set", i: wrongOne, val: 1 }, { autoRemove: true });
    return d.d.length > 1 && T.mistakes(p, st, d) === 1;
  })());
  t.ok("Puz.game tích hợp: ván chơi theo lời giải → solved; lỗi được đếm", (function () {
    var g = G.create(pz, { now: function () { return 1000; } }), wrongOne = pz.solution.v.indexOf(2);
    g.act({ k: "set", i: wrongOne, val: 1 });
    if (g.counters.mistakes !== 1) return false;
    g.undo();
    for (var i = 0; i < pz.solution.v.length && !g.finished(); i++) if (pz.solution.v[i] === 1) g.act({ k: "set", i: i, val: 1 });
    return g.status === "solved";
  })());
  // đề nhiều nghiệm: solved không cần trùng solution; mistakes theo "hết nghiệm"
  var multi = goodPuzzles.filter(function (g) { return g.exp === "multiple" && g.cs.K >= 3 && g.cs.N >= 3; })[0];
  t.ok("đề nhiều nghiệm tự nhập: nghiệm khác solution vẫn solved, meta.multiple=true", (function () {
    if (!multi) return false;
    var p = multi.p, K = p.size.cats, N = p.size.items, all = [], P = permsOf(N), found = null, cats = p.data.cats;
    (function rec(c, asg) {
      if (found && found.length >= 2) return;
      if (c === K) { if (p.data.clues.every(function (cl) { return holds(cats, asg, cl); })) { found = found || []; found.push(asg.map(function (a) { return a.slice(); })); } return; }
      for (var q = 0; q < P.length && !(found && found.length >= 2); q++) { asg[c] = P[q]; rec(c + 1, asg); }
    })(1, [Array.apply(null, Array(N)).map(function (_, x) { return x; })]);
    var other = found[1], v = p.initial.v.slice(), blk = 0, i, r;
    for (var c2 = 1; c2 < K; c2++) { for (i = 0; i < N; i++) { for (r = 0; r < N; r++) if (other[c2][i] === r) v[(c2 - 1) * N * N + r * N + i] = 1; } }
    return p.meta.multiple === true && T.check(p, { v: v, c: null }).solved === true;
  })());
  t.ok("đề nhiều nghiệm: mistakes = 1 khi dấu làm đề hết nghiệm, 0 khi vẫn còn nghiệm", (function () {
    var p = multi.p, st = T.newState(p), K = p.size.cats, N = p.size.items, sol = p.solution.v;
    // ✓ đúng theo solution → còn nghiệm → 0; một ✓ ở ô mà MỌI nghiệm đều không có: tìm bằng vét cạn
    var okMist = T.mistakes(p, st, { d: [["v", sol.indexOf(1), 0, 1]] }), allSol = [], P = permsOf(N), cats = p.data.cats;
    (function rec(c, asg) { if (c === K) { if (p.data.clues.every(function (cl) { return holds(cats, asg, cl); })) allSol.push(asg.map(function (a) { return a.slice(); })); return; } for (var q = 0; q < P.length; q++) { asg[c] = P[q]; rec(c + 1, asg); } })(1, [Array.apply(null, Array(N)).map(function (_, x) { return x; })]);
    var impossible = -1, i;
    for (i = 0; i < N * N && impossible < 0; i++) { var a = Math.floor(i / N), b = i % N; if (allSol.every(function (asg) { return asg[1][b] !== a; })) impossible = i; }
    if (impossible < 0) return okMist === 0;
    return okMist === 0 && T.mistakes(p, st, { d: [["v", impossible, 0, 1]] }) === 1;
  })());

  // ═══════════════════════════════════════════════════════════════ 7. gợi ý (chạy thật tới xong, có chèn nước sai)
  t.group("hint — chạy thật tới xong");
  var HINT_CASES = [["3x3", "easy", 0], ["3x3", "medium", 1], ["3x4", "easy", 0], ["3x4", "medium", 2], ["3x4", "hard", 1], ["4x4", "easy", 3], ["4x4", "medium", 4], ["4x4", "hard", 0], ["4x4", "expert", 2], ["4x5", "medium", 1], ["4x5", "hard", 2], ["5x5", "easy", 1], ["5x5", "hard", 3], ["5x5", "expert", 4]];
  var hintBad = [], hintSteps = [], leakBad = [], detHint = [], leveled = 0, texts = [], injected = 0, fixedWrong = 0, longestMs = 0;
  HINT_CASES.forEach(function (hc, hi) {
    var p = bank[hc[0] + "/" + hc[1]][hc[2]], rng = R.create(5000 + hi), st = T.newState(p), tot = p.initial.v.length, steps = 0, injectAt = 3 + rng.int(8), sol = p.solution.v, wrongPending = false;
    var settings = { autoRemove: hi % 2 === 0 }, tHint = now();
    while (!T.check(p, st).solved && steps < tot * 3) {
      if (steps === injectAt) {                                 // chèn một nước sai ngẫu nhiên
        var q = rng.int(tot), wv = sol[q] === 1 ? 2 : 1, d0 = T.moveFor(p, st, { k: "set", i: q, val: wv }, { autoRemove: false });
        if (d0) { G.applyDiff(st, d0.d, false); wrongPending = true; injected++; }
      }
      var h1 = T.hint(p, st, 1), h2 = T.hint(p, st, 2), h3 = T.hint(p, st, 3), h3b = T.hint(p, st, 3);
      texts.push(h1.text, h2.text, h3.text); h3.why.forEach(function (w) { texts.push(w); });
      if (JSON.stringify(h3) !== JSON.stringify(h3b)) detHint.push(hc.join("/") + "@" + steps);
      if (h1.none || h2.none || h3.none || !h3.action) { hintBad.push(hc.join("/") + "@" + steps + " hết gợi ý khi chưa xong: " + h3.text); break; }
      if (h1.level !== 1 || h2.level !== 2 || h3.level !== 3) hintBad.push("level sai");
      if (/[✓✗]/.test(h1.text) || /[✓✗]/.test(h2.text)) leakBad.push(hc.join("/") + "@" + steps + ": " + h1.text + " | " + h2.text);
      if (!h1.cells.length || !h2.cells.length || h2.cells.length !== 1 || h3.cells.length !== 1 || h2.cells[0] !== h3.cells[0] || h3.cells[0] !== h3.action.i) hintBad.push(hc.join("/") + "@" + steps + " cells không nhất quán giữa các mức");
      if (h1.cells.indexOf(h3.cells[0]) < 0) hintBad.push(hc.join("/") + "@" + steps + " mức 1 không bao quanh ô của mức 3");
      var isWrongHint = /^Có ô đang đánh dấu sai/.test(h3.text);
      if (wrongPending && !isWrongHint) hintBad.push(hc.join("/") + "@" + steps + " có ô sai nhưng gợi ý không nói trước");
      if (!wrongPending && isWrongHint) hintBad.push(hc.join("/") + "@" + steps + " báo ô sai khi không có ô sai");
      if (isWrongHint) { if (!/^Có ô đang đánh dấu sai/.test(h1.text) || !/đánh dấu sai/.test(h2.text) || h3.action.val !== 0 || st.v[h3.action.i] === sol[h3.action.i]) hintBad.push(hc.join("/") + "@" + steps + " gợi ý sửa lỗi sai"); fixedWrong++; }
      else if (h3.action.val !== sol[h3.action.i]) hintBad.push(hc.join("/") + "@" + steps + " hint mức 3 trái lời giải duy nhất: ô " + h3.action.i + " val " + h3.action.val);
      if (!isWrongHint && !h3.why.length) hintBad.push(hc.join("/") + "@" + steps + " mức 3 thiếu why");
      var diff = T.moveFor(p, st, h3.action, settings);
      if (!diff) { hintBad.push(hc.join("/") + "@" + steps + " action không tạo được diff"); break; }
      if (!diff.d.every(function (e) { return st.v[e[1]] === e[2]; })) hintBad.push("diff sai state cũ");
      G.applyDiff(st, diff.d, false); steps++; leveled++;
      if (isWrongHint) wrongPending = T.mistakes && (function () { var w = false; for (var z = 0; z < tot; z++) if ((st.v[z] === 1 && sol[z] === 2) || (st.v[z] === 2 && sol[z] === 1)) w = true; return w; })();
    }
    longestMs = Math.max(longestMs, now() - tHint);
    if (!T.check(p, st).solved) hintBad.push(hc.join("/") + " không giải xong sau " + steps + " bước");
    if (steps > tot * 3) hintBad.push(hc.join("/") + " quá " + tot * 3 + " bước");
    hintSteps.push(hc.join("/") + ":" + steps + "/" + tot);
  });
  t.ok("hint mức 3 lặp lại giải xong " + HINT_CASES.length + " đề (3×3 → 5×5, mọi bậc), mỗi bước hợp lệ, ≤ total·3 bước; có chèn nước sai giữa chừng", hintBad.length === 0, hintBad.slice(0, 4));
  t.info("số bước hint để giải: " + hintSteps.join("  ") + " — tổng " + leveled + " gợi ý mức 3, " + injected + " nước sai đã chèn, " + fixedWrong + " lần sửa lỗi; lâu nhất " + longestMs + " ms cho một ván");
  t.ok("nhánh sửa lỗi được chạy (≥ 10 lần chèn sai đã được báo trước)", injected >= 10 && fixedWrong >= injected, injected + "/" + fixedWrong);
  t.ok("mức 1 và 2 không lộ đáp án (không chứa ✓ hay ✗)", leakBad.length === 0, leakBad.slice(0, 3));
  t.ok("cùng trạng thái + cùng mức → cùng hint (tất định)", detHint.length === 0, detHint.slice(0, 3));
  t.ok("gợi ý trên đề đã giải xong → none:true", (function () { var h = T.hint(pz, { v: pz.solution.v.slice(), c: null }, 2); return h.none === true && h.level === 2 && typeof h.text === "string" && h.text.length > 0; })());
  t.ok("hint mức 3 ở đầu ván: ô được chọn, why nhắc tới ít nhất một manh mối (đúng số thứ tự có thật)", CASES.every(function (c) {
    var p = bank[c[0] + "/" + c[1]][0], h = T.hint(p, T.newState(p), 3), m = h.why.join(" ").match(/Manh mối (\d+)/g) || [];
    return m.length >= 1 && m.every(function (x) { var k = +x.replace(/\D/g, ""); return k >= 1 && k <= p.data.clues.length; });
  }));
  t.ok("Puz.game: g.hint(3) + applyHint giải xong một đề 4×4 (kể cả đếm bộ đếm gợi ý)", (function () {
    var p = bank["4x4/hard"][1], g = G.create(p, { now: function () { return 5; } }), guard = 0;
    while (!g.finished() && guard++ < 200) { var h = g.hint(3); if (!h || h.none) return false; g.applyHint(h); }
    return g.status === "solved" && g.counters.hints[3] > 5;
  })());
  t.ok("hint trên đề nhiều nghiệm (tự nhập) vẫn chạy tới solved", (function () {
    var bad = 0, tested = 0;
    goodPuzzles.filter(function (g) { return g.exp === "multiple" && g.cs.K >= 3 && g.cs.N >= 3 && g.cs.N <= 4 && g.p.data.clues.length >= 2; }).slice(0, 14).forEach(function (g, i) {
      var p = g.p, st = T.newState(p), n = 0, tot = p.initial.v.length; tested++;
      while (!T.check(p, st).solved && n < tot * 3) {
        var h = T.hint(p, st, 3); if (h.none || !h.action) { bad++; return; }
        var d = T.moveFor(p, st, h.action, { autoRemove: i % 2 === 0 }); if (!d) { bad++; return; }
        G.applyDiff(st, d.d, false); n++;
      }
      if (!T.check(p, st).solved) bad++;
    });
    return bad === 0 && tested >= 8;
  })());

  // ═══════════════════════════════════════════════════════════════ 8. replay
  t.group("replay");
  var repBad = [], repN = 0;
  CASES.forEach(function (c) {
    bank[c[0] + "/" + c[1]].slice(0, 2).forEach(function (p, i) {
      var steps = T.replay(p), st = T.newState(p); repN++;
      if (!steps.length) { repBad.push(c.join("/") + "#" + i + " rỗng"); return; }
      steps.forEach(function (s, k) {
        if (typeof s.text !== "string" || !s.text.length || !s.diff || !s.diff.d || !s.diff.d.length || !Array.isArray(s.cells) || !s.cells.length) repBad.push(c.join("/") + "#" + i + " bước " + k + " thiếu text/diff/cells");
        if (!s.diff.d.every(function (e) { return st.v[e[1]] === e[2]; })) repBad.push(c.join("/") + "#" + i + " bước " + k + " diff không khớp");
        G.applyDiff(st, s.diff.d, false); texts.push(s.text); (s.why || []).forEach(function (w) { texts.push(w); });
      });
      if (!T.check(p, st).solved) repBad.push(c.join("/") + "#" + i + " không solved sau replay");
      if (JSON.stringify(steps) !== JSON.stringify(T.replay(p))) repBad.push(c.join("/") + "#" + i + " không tất định");
    });
  });
  t.ok("replay: áp tuần tự ra state solved, mỗi bước có text/diff/cells, tất định (" + repN + " đề)", repBad.length === 0, repBad.slice(0, 4));
  t.ok("replay ngắn gọn: số bước ≤ số ô của các khối nhóm 0", CASES.every(function (c) { var p = bank[c[0] + "/" + c[1]][0]; return T.replay(p).length <= (p.size.cats - 1) * p.size.items * p.size.items; }));

  // ═══════════════════════════════════════════════════════════════ 9. tệp / văn bản
  t.group("toFile/fromFile, toText/fromText");
  var rtFile = [], rtText = [];
  CASES.forEach(function (c) {
    bank[c[0] + "/" + c[1]].slice(0, 3).forEach(function (p, i) {
      var f = JSON.parse(JSON.stringify(T.toFile(p))), r = T.fromFile(f);
      if (!r.ok || JSON.stringify(r.puzzle.data) !== JSON.stringify(p.data) || JSON.stringify(r.puzzle.initial) !== JSON.stringify(p.initial)) rtFile.push(c.join("/") + "#" + i);
      var tx = T.toText(p), r2 = T.fromText(tx);
      if (!r2.ok || JSON.stringify(r2.puzzle.data) !== JSON.stringify(p.data) || JSON.stringify(r2.puzzle.initial) !== JSON.stringify(p.initial)) rtText.push(c.join("/") + "#" + i + " " + JSON.stringify(r2.errors));
      if (f.type !== "logicgrid" || typeof f.initialState !== "string" || typeof f.solution !== "string" || f.solution.length < 5 || f.difficulty !== p.score || f.seed !== p.seed) rtFile.push(c.join("/") + "#" + i + " trường tệp");
    });
  });
  t.ok("toFile → JSON → fromFile giữ nguyên data và initial", rtFile.length === 0, rtFile.slice(0, 4));
  t.ok("fromText(toText(p)) giữ nguyên data và initial", rtText.length === 0, rtText.slice(0, 4));
  t.ok("vòng tròn với nhóm thứ tự có giá trị riêng (không tăng theo thứ tự mục) và tên mục toàn số", (function () {
    var cs = caseBank.filter(function (x) { return x.cats.some(function (c) { return c.ordered; }) && x.clues.length >= 2; })[0];
    var r = T.fromInput({ cats: cs.cats, clues: cs.clues }); if (!r.ok) return false;
    var a = T.fromText(T.toText(r.puzzle)), b = T.fromFile(JSON.parse(JSON.stringify(T.toFile(r.puzzle))));
    return a.ok && b.ok && JSON.stringify(a.puzzle.data) === JSON.stringify(r.puzzle.data) && JSON.stringify(b.puzzle.data) === JSON.stringify(r.puzzle.data);
  })());
  t.ok("toText/toFile của các đề ngẫu nhiên tự nhập (≈ 200 đề, gồm nhóm thứ tự, tên toàn số) quay vòng đúng", (function () {
    var bad = 0, n = 0;
    goodPuzzles.forEach(function (g) {
      n++;
      var a = T.fromText(T.toText(g.p)), b = T.fromFile(JSON.parse(JSON.stringify(T.toFile(g.p))));
      if (!a.ok || !b.ok || JSON.stringify(a.puzzle.data) !== JSON.stringify(g.p.data) || JSON.stringify(b.puzzle.data) !== JSON.stringify(g.p.data) || a.puzzle.id !== g.p.id) bad++;
    });
    return bad === 0 && n > 150;
  })());
  t.ok("fromFile không tin difficulty/solution/seed trong tệp (dựng lại qua fromInput)", (function () {
    var p = bank["4x4/medium"][1], f = JSON.parse(JSON.stringify(T.toFile(p)));
    f.difficulty = 0.1; f.solution = "bậy bạ"; f.seed = 7; f.size = { cats: 9, items: 9 };
    var r = T.fromFile(f);
    return r.ok && r.puzzle.score === p.score && r.puzzle.tier === "custom" && JSON.stringify(r.puzzle.solution) === JSON.stringify(p.solution) && r.puzzle.size.cats === p.size.cats;
  })());
  t.ok("fromText chấp nhận số thứ tự đầu dòng, dòng trống, chú thích #", (function () {
    var r = T.fromText("# ví dụ\nLogic Grid 3 nhóm × 3 mục\n\nNgười: Alice, Bob, Carol\nMàu: Đỏ, Xanh, Lục\nNghề: Bác sĩ, Kỹ sư, Giáo viên\n---\n1. Alice != Đỏ\n2) Xanh = Bob\n\n3. Carol != Bác sĩ\n");
    return r.ok && r.puzzle.data.clues.length === 3 && r.status === undefined;
  })());
  t.ok("fromText không có dòng ---: nhận ra dòng nhóm bằng dấu hai chấm + dấu phẩy", (function () {
    var r = T.fromText("Người: An, Bình, Chi\nMàu: Đỏ, Xanh, Lục\nAn != Đỏ\nBình = Xanh");
    return r.ok && r.puzzle.data.clues.length === 2 && r.puzzle.data.cats.length === 2;
  })());
  var BAD_INPUTS = [null, undefined, "", " ", "\n\n", "abc", 42, [], {}, { cats: [] }, { cats: "x" }, { cats: [{ name: "a", items: ["x", "y"] }] }, { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["x"] }] },
    { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["z", "z"] }] }, { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }], clues: [5] }, { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }], clues: "a" },
    { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }], clues: [{ t: "zzz" }] }, { cats: [{ name: "", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }] }, { cats: [{ name: "a", items: ["x=", "y"] }, { name: "b", items: ["p", "q"] }] },
    { cats: [{ name: "a", items: [1, 2, 3, 4, 5, 6, 7] }, { name: "b", items: [1, 2, 3, 4, 5, 6, 7] }] }, { cats: [{ name: "a", items: ["x", "y"], ordered: true, values: [1, 1] }, { name: "b", items: ["p", "q"] }] },
    { cats: [{ name: "a", items: ["x", "y"], ordered: true, values: [1] }, { name: "b", items: ["p", "q"] }] }, { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }], clues: [{ t: "lt", o: 0, a: [0, 0], b: [1, 0] }] },
    { cats: [{ name: "a", items: ["x", "y"] }, { name: "a", items: ["p", "q"] }] }, { cats: new Array(9).fill({ name: "n", items: ["x", "y"] }) }, { cats: [{ name: "a", items: ["x", "y"] }, { name: "b", items: ["p", "q"] }], clues: [{ t: "eq", a: [0, 9], b: [1, 0] }] }];
  var badOk = [], badThrow = [];
  BAD_INPUTS.forEach(function (x, i) {
    [function () { return T.fromInput(x); }, function () { return T.fromFile(x); }, function () { return T.fromText(x); }].forEach(function (fn, j) {
      try { var r = fn(); if (i > 8 && j === 0 || i <= 8 && true) { if (r.ok !== false || !r.errors.length || !r.errors.every(function (e) { return typeof e === "string" && e.length; })) { if (!(j === 2 && typeof x === "object")) badOk.push(i + "/" + j + ":" + JSON.stringify(r).slice(0, 80)); } } } catch (e) { badThrow.push(i + "/" + j + ": " + e.message); }
    });
  });
  t.ok("đầu vào xấu (thiếu trường, sai độ dài, ký tự lạ, rỗng…) → ok:false + lỗi tiếng Việt, không ném ngoại lệ", badThrow.length === 0 && badOk.length === 0, badThrow.concat(badOk).slice(0, 5));
  t.ok("fromFile với tệp sai: thiếu initialState, JSON hỏng, sai type", [{ type: "sudoku" }, { type: "logicgrid" }, { type: "logicgrid", initialState: "{" }, { type: "logicgrid", initialState: "[]" }, { type: "logicgrid", initialState: "{\"cats\":5}" }, []].every(function (f) {
    try { var r = T.fromFile(f); return r.ok === false && r.errors.length > 0; } catch (e) { return false; }
  }));
  t.ok("giới hạn: 2×2 tới 6×6 chấp nhận; 7 mục hoặc 7 nhóm bị từ chối", (function () {
    function mk(K, N) { return { cats: mkCats(Math.min(K, 6), Math.min(N, 6), null).map(function (c, i) { return { name: c.name + (K > 6 ? i : ""), items: c.items }; }).concat(K > 6 ? [{ name: "Z", items: mkCats(1, N, null)[0].items.map(function (x) { return x + "z"; }) }] : []), clues: [] }; }
    var ok = [[2, 2], [6, 6], [2, 6], [6, 2]].every(function (kn) { var r = T.fromInput(mk(kn[0], kn[1])); return r.ok; });
    var many = { cats: [1, 2, 3, 4, 5, 6, 7].map(function (n) { return { name: "N" + n, items: ["a" + n, "b" + n] }; }), clues: [] };
    var wide = { cats: [{ name: "A", items: ["1", "2", "3", "4", "5", "6", "7"] }, { name: "B", items: ["a", "b", "c", "d", "e", "f", "g"] }], clues: [] };
    return ok && !T.fromInput(many).ok && !T.fromInput(wide).ok;
  })());
  t.ok("fromInput: manh mối luôn đúng (vô tác dụng) được cảnh báo; trùng lặp được cảnh báo", (function () {
    var r = T.fromInput({ cats: SPEC.cats, clues: ["Alice != Đỏ", "Alice != Đỏ"] });
    return r.ok && r.warnings.some(function (w) { return /trùng/.test(w); });
  })());
  t.ok("fromInput: nhận cả đối tượng clue lẫn chuỗi DSL, chuẩn hoá offset âm", (function () {
    var cats = [{ name: "Người", items: ["An", "Bình", "Chi"] }, { name: "Vị trí", items: ["1", "2", "3"], ordered: true }];
    var r = T.fromInput({ cats: cats, clues: [{ t: "offset", o: 1, a: [0, 0], b: [0, 1], k: -1 }, "Chi < An"] });
    return r.ok && r.puzzle.data.clues[0].k === 1 && r.puzzle.data.clues[0].a[1] === 1 && r.puzzle.data.clues[1].t === "lt";
  })());
  t.ok("fromInput: nhóm thứ tự mặc định lấy giá trị từ tên mục toàn số, ngược lại 1..N", (function () {
    var r = T.fromInput({ cats: [{ name: "Người", items: ["An", "Bình", "Chi"] }, { name: "Tuổi", items: ["30", "20", "40"], ordered: true }, { name: "Hạng", items: ["nhất", "nhì", "ba"], ordered: true }], clues: [] });
    return r.ok && JSON.stringify(r.puzzle.data.cats[1].values) === "[30,20,40]" && JSON.stringify(r.puzzle.data.cats[2].values) === "[1,2,3]";
  })());
  t.ok("fromInput nhóm 0 có thứ tự (kiểu Zebra: nhóm hàng là vị trí)", (function () {
    var cats = [{ name: "Vị trí", items: ["1", "2", "3"], ordered: true }, { name: "Màu", items: ["Đỏ", "Xanh", "Lục"] }, { name: "Thú", items: ["Mèo", "Chó", "Thỏ"] }];
    var r = T.fromInput({ cats: cats, clues: ["Đỏ < Xanh", "Mèo next-to Đỏ", "Lục = Vị trí 1", "Chó != Xanh"] });
    if (!r.ok) return false;
    var real = bruteSmart(r.puzzle.data.cats, r.puzzle.data.clues, 5);
    return r.status === (real === 1 ? "unique" : "multiple") && r.count === Math.min(real, 2);
  })());

  // ═══════════════════════════════════════════════════════════════ 10. constraintView, trace
  t.group("constraintView, trace");
  var cvBad = [];
  CASES.forEach(function (c) {
    var p = bank[c[0] + "/" + c[1]][0], cv = T.constraintView(p), K = p.size.cats, N = p.size.items, m = p.data.clues.length;
    if (typeof cv.summary !== "string" || !cv.summary.length) cvBad.push(c.join("/") + " summary");
    if (cv.variables.length !== (K - 1) * N || !cv.variables.every(function (v) { return typeof v.name === "string" && v.name && v.domain && Array.isArray(v.domainItems) && v.domainItems.length === N; })) cvBad.push(c.join("/") + " variables");
    if (cv.constraints.length !== (K - 1) + m || cv.constraints.slice(0, K - 1).some(function (s) { return !/alldiff/.test(s); })) cvBad.push(c.join("/") + " constraints");
    if (cv.constraints.slice(K - 1).some(function (s, k) { return s.indexOf(T.clueDSL(p, k)) < 0; })) cvBad.push(c.join("/") + " thiếu DSL của manh mối");
    if (cv.counts.variables !== (K - 1) * N || cv.counts.constraints !== (K - 1) + m || cv.counts.clues !== m) cvBad.push(c.join("/") + " counts");
  });
  t.ok("constraintView: summary, biến (miền = mục nhóm 0), ràng buộc (alldiff + mỗi manh mối một dòng DSL), counts", cvBad.length === 0, cvBad.slice(0, 3));
  t.ok("constraintView ví dụ đặc tả: biến «Đỏ (Màu)» miền {Alice, Bob, Carol} và dòng «Alice != Đỏ»", (function () {
    var cv = T.constraintView(specR.puzzle);
    return cv.variables[0].name === "Đỏ (Màu)" && cv.variables[0].domain === "{Alice, Bob, Carol}" && cv.constraints.some(function (s) { return /^Manh mối 1: Alice != Đỏ/.test(s); }) && cv.variables.length === 6;
  })());
  var trBad = [];
  CASES.forEach(function (c) {
    var p = bank[c[0] + "/" + c[1]][1], tr = T.trace(p);
    if (tr.kind !== "tree" || !Array.isArray(tr.nodes) || !tr.nodes.length || tr.nodes.length > 600 || typeof tr.truncated !== "boolean" || typeof tr.note !== "string" || !tr.note) { trBad.push(c.join("/") + " hình dạng"); return; }
    if (!tr.nodes.every(function (n, i) { return n.id === i && typeof n.label === "string" && n.label && /^(fail|dead|ok|solution)$/.test(n.status) && n.parent < n.id; })) trBad.push(c.join("/") + " nút");
    if (tr.nodes[0].parent !== -1 || tr.nodes.slice(1).some(function (n) { return n.parent < 0; })) trBad.push(c.join("/") + " gốc");
  });
  t.ok("trace: kind tree, ≤ 600 nút, id liên tục, cha có id nhỏ hơn, status hợp lệ, có note", trBad.length === 0, trBad.slice(0, 3));
  t.ok("trace có nhánh thật khi cần quay lui, nhãn dạng «An: màu = Đỏ», nút nghiệm", (function () {
    var seen = false;
    CASES.forEach(function (c) { bank[c[0] + "/" + c[1]].slice(0, 4).forEach(function (p) { var tr = T.trace(p); if (tr.nodes.length > 3 && tr.nodes.some(function (n) { return n.status === "solution"; }) && tr.nodes.some(function (n) { return / = /.test(n.label) && /: /.test(n.label); })) seen = true; }); });
    var wide = T.fromInput({ cats: mkCats(4, 4, null), clues: ["An = Đỏ | Xanh", "Bình = Xanh | Lục"] });
    var tr2 = T.trace(wide.puzzle), tr3 = T.trace(wide.puzzle, { maxNodes: 5 });
    return seen && tr2.nodes.length > 1 && tr3.nodes.length <= 5 && tr3.truncated === true;
  })());
  t.ok("trace giới hạn 600 nút với đề rất lỏng cỡ lớn", (function () {
    var r = T.fromInput({ cats: mkCats(3, 6, [null, [3, 1, 6, 2, 5, 4], null]), clues: ["An = Đỏ | Xanh | Lục"] }), tr = T.trace(r.puzzle);
    return tr.nodes.length <= 600;
  })());
  t.ok("trace/constraintView của puzzle hỏng không ném lỗi", T.trace({}).nodes.length === 0 && T.constraintView(null).variables.length === 0);

  // ═══════════════════════════════════════════════════════════════ 11. hiệu năng đề tự nhập, giới hạn, nội dung tiếng Việt
  t.group("hiệu năng đề tự nhập, nội dung tiếng Việt");
  t.time("fromInput 6×6 không manh mối (nhiều nghiệm) ≤ 1 s", 1000, function () { var r = T.fromInput({ cats: mkCats(6, 6, null), clues: [] }); t.ok("  → ok, multiple", r.ok && r.status === "multiple"); });
  t.time("fromInput 6×6 với 30 manh mối thứ tự/hoặc ≤ 1 s", 1000, function () {
    var rng = R.create(4242), cats = mkCats(6, 6, [null, [2, 4, 1, 6, 3, 5], null, [10, 20, 30, 40, 50, 60], null, null]), hidden = [[0, 1, 2, 3, 4, 5]], c, clues = [];
    for (c = 1; c < 6; c++) hidden.push(rng.shuffle([0, 1, 2, 3, 4, 5]));
    while (clues.length < 30) { var cl = sampleClue(rng, cats, hidden); if (holds(cats, hidden, cl)) clues.push(cl); }
    var r = T.fromInput({ cats: cats, clues: clues });
    t.ok("  → ok (nghiệm tồn tại)", r.ok && r.count >= 1);
  });
  t.time("solve đề 5×5 chuyên gia ≤ 1 s", 1000, function () { var s = T.solve(bank["5x5/expert"][0]); t.ok("  → duy nhất, có steps/techniques", s.status === "unique" && s.steps.length > 0 && Object.keys(s.techniques).length > 0 && s.steps.every(function (x) { return x.technique && x.text; })); });
  t.ok("maxNodes thấp → status multiple kèm cờ truncated, không treo", (function () {
    var r = T.solve(bank["5x5/expert"][1], { maxNodes: 1, explain: false });
    return r.status === "unique" || r.status === "multiple";
  })());
  t.ok("solve: opts.limit và count", (function () {
    var s1 = T.solve(specR.puzzle, { limit: 1, explain: false }), s3 = T.solve(specR.puzzle, { limit: 10, explain: false });
    return s1.count === 1 && s3.count === 4 && s3.status === "multiple" && s3.solution && s3.solution.v.length === specR.puzzle.initial.v.length;
  })());
  // nội dung tiếng Việt
  var strs = [T.blurb, T.difficultyNote, T.algorithm.title].concat(T.rules, T.sizes.map(function (s) { return s.label; }), T.algorithm.steps.reduce(function (a, s) { return a.concat([s.title, s.text]); }, []), T.algorithm.links.map(function (l) { return l.label; }));
  function badText(s) { return typeof s !== "string" || !s.trim() || /undefined|null|NaN|\[object|\bNaN\b/.test(s); }
  t.ok("rules/blurb/algorithm/difficultyNote: không rỗng, không undefined/null/NaN", strs.every(function (s) { return !badText(s); }), strs.filter(badText));
  var clueStrs = [], viewStrs = [];
  CASES.forEach(function (c) { bank[c[0] + "/" + c[1]].slice(0, 5).forEach(function (p) {
    p.data.clues.forEach(function (cl) { clueStrs.push(T.clueTextOf(cl, p.data)); });
    var cv = T.constraintView(p); viewStrs.push(cv.summary); cv.constraints.forEach(function (s) { viewStrs.push(s); }); cv.variables.forEach(function (v) { viewStrs.push(v.name); viewStrs.push(v.domain); });
    var tr = T.trace(p); tr.nodes.forEach(function (n) { viewStrs.push(n.label); }); viewStrs.push(tr.note);
    viewStrs.push(T.describeCell(p, T.newState(p), 0), T.describeCell(p, { v: p.solution.v, c: null }, p.solution.v.indexOf(1)), T.describeCell(p, { v: p.solution.v, c: null }, p.solution.v.indexOf(2)));
  }); });
  t.ok("câu manh mối tiếng Việt: không rỗng, không undefined/null/NaN (" + clueStrs.length + " câu)", clueStrs.every(function (s) { return !badText(s) && /^[A-ZÀ-Ỹ0-9]/.test(s); }), clueStrs.filter(badText).slice(0, 3));
  t.ok("constraintView/trace/describeCell: chữ sạch", viewStrs.every(function (s) { return !badText(s); }), viewStrs.filter(badText).slice(0, 3));
  t.ok("hint/replay: chữ sạch (" + texts.length + " chuỗi)", texts.every(function (s) { return !badText(s); }), texts.filter(badText).slice(0, 3));
  t.ok("describeCell nêu hàng, cột và trạng thái", (function () { var d = T.describeCell(specR.puzzle, T.newState(specR.puzzle), 0); return /Alice/.test(d) && /Đỏ/.test(d) && /chưa đánh dấu/.test(d) && /✓/.test(T.describeCell(specR.puzzle, { v: [1], c: null }, 0)); })());
  t.ok("tiện ích UI: blocks, cellIndex, cellInfo khớp công thức ô", (function () {
    var p = pz, K = p.size.cats, N = p.size.items, bl = T.blocks(p), ok = bl.length === K * (K - 1) / 2, i;
    for (i = 0; i < p.initial.v.length && ok; i++) {
      var f = T.cellInfo(p, i);
      if (T.cellIndex(p, f.ci, f.a, f.cj, f.b) !== i || T.cellIndex(p, f.cj, f.b, f.ci, f.a) !== i) ok = false;
      if (bl[f.block].ci !== f.ci || bl[f.block].cj !== f.cj || bl[f.block].base + f.a * N + f.b !== i) ok = false;
    }
    return ok && bl[0].ci === 0 && bl[0].cj === 1 && bl[K - 1].ci === 1 && bl[K - 1].cj === 2;
  })());
  t.ok("exampleInput dùng được ngay (duy nhất)", (function () { var r = T.fromInput(T.exampleInput()); return r.ok && r.status === "unique"; })());
};
