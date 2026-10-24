/* kiem/coinscale.js — kiểm CÂN ĐIỆN TỬ (CW3, đợt P6b). Nguồn sự thật ĐỘC LẬP với engine:
     · VÉT CẠN TƯỜNG MINH, chồng xu: mọi vectơ "lấy t_i xu" ∈ {0…c}^n, khối lượng TÍNH TỪ vật lý (xu thật 10 g, xu giả 11 g), minimax trên tập chồng giả còn nhất quán —
       không dùng công thức (c+1)^k; so với k* = ⌈log_{c+1} n⌉ và engine (c = 1: n ≤ 10; c = 2: n ≤ 7; c = 3: n ≤ 5).
     · VÉT CẠN TƯỜNG MINH, hai loại: mọi nhóm xu ∈ {0,1}^n, khối lượng từ vật lý (9 g / 10 g), minimax trên mảng vectơ (không bitset, không POP) — A(n), n ≤ 6 (n = 6: chứng minh "3 lần không đủ" bằng vét cạn,
       "4 lần đủ" bằng cây chiến lược của engine mô phỏng với MỌI 64 bí mật bằng khối lượng vật lý).
     · MÔ PHỎNG: oracle cố định = khối lượng vật lý; oracle đối thủ luôn nhất quán với ÍT NHẤT một bí mật (liệt kê tường minh); ván đầu cuối với MỌI bí mật.
   Giá trị m(n) (không thích nghi), Conway–Guy, tiệm cận 2n/log2 n trong thiết kế là [tài liệu]/hoãn — KHÔNG dùng làm nguồn sự thật ở đây. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("coinscale"), L = T.lib, G = Puz.game, plan = Puz.plan, R = Puz.rng, GR = Puz.grade;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"], MODES = ["fixed", "adv"];
  function J(x) { return JSON.stringify(x); }
  function lay(p) { return L.layoutOf(p.data); }
  function apply(p, s, a) { var d = T.moveFor(p, s, a); if (!d) return null; G.applyDiff(s, d.d, false); return d; }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function inBand(score, tier) { var b = Puz.util.tier(tier); return score >= b.min && score < b.max; }
  function fromIn(i) { var r = T.fromInput(i); return r.ok ? r.puzzle : null; }
  function recsOf(p, s) { return plan.read(s, lay(p)); }
  function stackIn(n, c, k, mode, secret) { return { form: "stack", n: n, c: c, k: k, mode: mode || "fixed", secret: secret === undefined ? 0 : secret }; }
  function twoIn(n, k, mode, secret) { return { form: "two", n: n, k: k, mode: mode || "fixed", secret: secret === undefined ? 0 : secret }; }
  function bits(x, n) { var a = []; for (var i = 0; i < n; i++) a.push((x >> i) & 1); return a; }

  // ====================================================================== nguồn độc lập 1: chồng xu, vét cạn tường minh
  /** Số đọc vật lý (gam) khi chồng giả là f và lấy take[i] xu từ chồng i: xu thật 10 g, xu giả 11 g. */
  function physStack(take, f) { var g = 0; for (var i = 0; i < take.length; i++) g += take[i] * (i === f ? 11 : 10); return g; }
  function allTakes(n, c) {
    var out = [], cur = [];
    (function rec(i) { if (i === n) { var s = 0; cur.forEach(function (v) { s += v; }); if (s > 0) out.push(cur.slice()); return; } for (var v = 0; v <= c; v++) { cur.push(v); rec(i + 1); cur.pop(); } })(0);
    return out;
  }
  /** Có chiến lược chắc chắn tìm chồng giả trong k lần cân không — minimax tường minh trên tập chồng nhất quán. */
  function bruteStack(n, c, k) {
    var takes = allTakes(n, c), memo = {};
    function can(set, r) {
      if (set.length <= 1) return true;
      if (r === 0) return false;
      var key = set.join(",") + "|" + r;
      if (memo[key] !== undefined) return memo[key];
      var ok = false;
      for (var w = 0; w < takes.length && !ok; w++) {
        var by = {};
        set.forEach(function (f) { var g = physStack(takes[w], f); (by[g] = by[g] || []).push(f); });
        var groups = Object.keys(by), good = groups.length > 1;
        for (var q = 0; q < groups.length && good; q++) if (!can(by[groups[q]], r - 1)) good = false;
        if (good) ok = true;
      }
      memo[key] = ok; return ok;
    }
    var all = []; for (var i = 0; i < n; i++) all.push(i);
    return can(all, k);
  }
  function bruteKStack(n, c, cap) { for (var k = 0; k <= cap; k++) if (bruteStack(n, c, k)) return k; return cap + 1; }

  // ====================================================================== nguồn độc lập 2: hai loại, vét cạn tường minh (mảng, không bitset)
  /** Số đọc vật lý: nhóm incl[i] ∈ {0,1}, xu i nặng x[i] = 1 (10 g) hay nhẹ (9 g). */
  function physTwo(incl, x) { var g = 0; for (var i = 0; i < incl.length; i++) if (incl[i]) g += x[i] ? 10 : 9; return g; }
  function allVecs(n) { var out = []; for (var m = 0; m < (1 << n); m++) out.push(bits(m, n)); return out; }
  function bruteTwo(n, k) {
    var vecs = allVecs(n), groups = allVecs(n).slice(1), memo = {};
    function can(idx, r) {
      if (idx.length <= 1) return true;
      if (r === 0) return false;
      var key = idx.join(",") + "|" + r;
      if (memo[key] !== undefined) return memo[key];
      var ok = false;
      for (var w = 0; w < groups.length && !ok; w++) {
        var by = {};
        idx.forEach(function (v) { var g = physTwo(groups[w], vecs[v]); (by[g] = by[g] || []).push(v); });
        var keys = Object.keys(by), good = keys.length > 1;
        for (var q = 0; q < keys.length && good; q++) if (!can(by[keys[q]], r - 1)) good = false;
        if (good) ok = true;
      }
      memo[key] = ok; return ok;
    }
    var all = []; for (var i = 0; i < vecs.length; i++) all.push(i);
    return can(all, k);
  }
  function bruteKTwo(n, cap) { for (var k = 0; k <= cap; k++) if (bruteTwo(n, k)) return k; return cap + 1; }

  /** Chơi MỘT ván theo gợi ý mức 3, đo kết quả BẰNG VẬT LÝ độc lập; trả {ok, weighings, concl}. */
  function playByHints(p, secret) {
    var d = p.data, s = T.newState(p), guard = 0, wc = 0;
    while (guard++ < d.k + 4) {
      var h = T.hint(p, s, 3);
      if (!h || h.none || !h.action) return { ok: false, why: "hết hint" };
      if (h.action.k === "weigh") {
        var phys = d.form === "stack" ? physStack(h.action.take, secret) : physTwo(bits(L.wFromAction(d, h.action), d.n), bits(secret, d.n));
        apply(p, s, h.action); wc++;
        var rec = recsOf(p, s).pop();
        if (L.gramsOf(d, rec) !== phys) return { ok: false, why: "oracle ≠ vật lý " + L.gramsOf(d, rec) + " vs " + phys };
      } else if (h.action.k === "conclude") {
        apply(p, s, h.action);
        var c = T.check(p, s);
        var truth = d.form === "stack" ? h.action.stack === secret : J(h.action.x) === J(bits(secret, d.n));
        return { ok: c.solved && truth, weighings: wc, why: c.solved ? (truth ? "" : "kết luận sai") : "chưa solved" };
      } else return { ok: false, why: "hint lạ " + h.action.k };
    }
    return { ok: false, why: "quá nhiều bước" };
  }
  function randomWeigh(p, rng) {
    var d = p.data, i;
    if (d.form === "stack") { var take = []; for (i = 0; i < d.n; i++) take.push(rng.int(d.c + 1)); if (!take.some(function (v) { return v > 0; })) take[rng.int(d.n)] = 1 + rng.int(d.c); return { k: "weigh", take: take }; }
    var set = []; for (i = 0; i < d.n; i++) if (rng.chance(0.5)) set.push(i);
    if (!set.length) set.push(rng.int(d.n));
    return { k: "weigh", set: set };
  }

  // ====================================================================== 0. đăng ký + siêu dữ liệu
  t.group("coinscale — đăng ký, siêu dữ liệu");
  t.ok("loại đã đăng ký, tuân giao diện, kind interactive, objective min 'lần'", !!T && Puz.types.conformance(T).length === 0 && Puz.types.kindOf(T) === "interactive" && T.objective.sense === "min" && T.objective.unit === "lần", Puz.types.conformance(T));
  t.ok("nhãn: sizeLabel 'Phiên bản', moveLabel nói 'thao tác', mistakeLabel nói 'sai sót'", T.sizeLabel === "Phiên bản" && /thao tác/.test(T.moveLabel) && /Sai sót/.test(T.mistakeLabel));
  t.ok("options: mode fixed (mặc định) | adv", T.options.length === 1 && T.options[0].id === "mode" && T.options[0].default === "fixed" && T.options[0].choices.map(function (c) { return c.id; }).join() === "fixed,adv");
  t.ok("2 phiên bản (chong mặc định, hailoai), mỗi phiên bản quảng cáo đủ 4 bậc", T.sizes.length === 2 && T.sizes.filter(function (s) { return s.default; }).length === 1 && T.sizes[0].id === "chong" && T.sizes[0].default && T.sizes.every(function (s) { return s.tiers.length === 4; }));
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }), text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 3 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("chữ tiếng Việt (luật, thuật toán, ghi chú): không rỗng, không undefined/null/NaN", T.rules.concat(T.algorithm.steps.map(function (s) { return s.title + s.text; }), [T.blurb, T.difficultyNote]).every(function (x) { return typeof x === "string" && x.trim() && !/\b(undefined|null|NaN)\b/.test(x); }));

  // ====================================================================== 1. lõi toán chồng xu
  t.group("coinscale — chồng xu: engine = vét cạn tường minh (khối lượng vật lý), k* = ⌈log_{c+1} n⌉");
  (function () {
    var cases = [], bad = [], n, c, nCases = 0;
    for (c = 1; c <= 3; c++) for (n = 2; n <= (c === 1 ? 10 : c === 2 ? 7 : 5); n++) cases.push([n, c]);
    cases.forEach(function (cs) {
      var nn = cs[0], cc = cs[1], bk = bruteKStack(nn, cc, 4), eng = L.bestK({ form: "stack", n: nn, c: cc, k: 4, mode: "fixed", secret: 0 }), lg = 1; while (Math.pow(cc + 1, lg) < nn) lg++;
      nCases++;
      if (bk !== eng || bk !== lg) bad.push([nn, cc, "brute", bk, "engine", eng, "log", lg]);
    });
    t.ok("k* của " + nCases + " cấu hình (c = 1: n ≤ 10; c = 2: n ≤ 7; c = 3: n ≤ 5): vét cạn tường minh = engine = ⌈log_{c+1} n⌉", bad.length === 0, bad.slice(0, 4));
    t.ok("biên khít (vét cạn): c = 1: 2→1, 3→2, 4→2, 5→3, 8→3, 9→4 lần; c = 2: 3→1, 4→2, 7→2", [[2, 1, 1], [3, 1, 2], [4, 1, 2], [5, 1, 3], [8, 1, 3], [9, 1, 4], [3, 2, 1], [4, 2, 2], [7, 2, 2]].every(function (q) { return bruteKStack(q[0], q[1], 4) === q[2]; }));
    t.ok("bài kinh điển 10 chồng × 9 xu: lấy i xu từ chồng i cho 10 số đọc KHÁC nhau (vật lý) ⇒ 1 lần; engine k* = 1; 11 chồng cần 2 (mỗi lần chỉ 10 số đọc)", (function () {
      var seen = {}, take = []; for (var i = 0; i < 10; i++) take.push(i);
      for (var f = 0; f < 10; f++) seen[physStack(take, f)] = 1;
      return Object.keys(seen).length === 10 && L.bestK(stackIn(10, 9, 4)) === 1 && L.bestK(stackIn(11, 9, 4)) === 2;
    })());
    t.ok("solvC chong: |T| ≤ (c+1)^r ⇔ vét cạn (c = 1: |T| ≤ 7; c = 2: |T| ≤ 5; r ≤ 3)", (function () {
      var bd = [];
      for (var cc = 1; cc <= 2; cc++) for (var m = 1; m <= (cc === 1 ? 7 : 5); m++) for (var r = 0; r <= 3; r++) {
        var set = []; for (var i = 0; i < m; i++) set.push(i);
        var b = r === 0 ? m <= 1 : bruteStack(m, cc, r);
        if (b !== L.solvC({ form: "stack", n: m, c: cc, k: 3 }, set, r)) bd.push([m, cc, r]);
      }
      return bd.length === 0 ? true : bd;
    })());
    t.ok("công thức giải mã cơ số c+1: weigh j lấy chữ số thứ j của chỉ số chồng ⇒ MỌI chồng giả phân biệt (n = 27, c = 2, k = 3; n = 16, c = 1, k = 4)", [[27, 2, 3], [16, 1, 4]].every(function (q) {
      var seen = {};
      for (var f = 0; f < q[0]; f++) { var code = []; for (var j = 0; j < q[2]; j++) { var dig = Math.floor(f / Math.pow(q[1] + 1, q[2] - 1 - j)) % (q[1] + 1), take = []; for (var i = 0; i < q[0]; i++) take.push(Math.floor(i / Math.pow(q[1] + 1, q[2] - 1 - j)) % (q[1] + 1)); code.push(physStack(take, f) - physStack(take, -1)); if (code[j] !== dig) return false; } seen[code.join()] = 1; }
      return Object.keys(seen).length === q[0];
    }));
  })();

  // ====================================================================== 2. lõi toán hai loại
  t.group("coinscale — hai loại: A(n) engine = vét cạn tường minh (n ≤ 5); n = 6 = 4 (chứng minh 3 thiếu + mô phỏng cây 4 lần)");
  (function () {
    var bad = [], bk = [];
    for (var n = 1; n <= 5; n++) { var b = bruteKTwo(n, 5), e = L.bestK(twoIn(n, 6)); bk.push(b); if (b !== e) bad.push([n, b, e]); }
    t.ok("A(1..5) vét cạn = engine: " + bk.join(","), bad.length === 0 && bk.join() === "1,2,3,3,4", bad);
    t.time("n = 6: vét cạn tường minh chứng minh 3 lần KHÔNG đủ", 20000, function () { t.ok("bruteTwo(6, 3) = không đủ; engine solvC(6, 3) cũng không", bruteTwo(6, 3) === false && L.bestK(twoIn(6, 6)) === 4); });
    t.ok("n = 6, k = 4: cây chiến lược của engine đúng với MỌI 64 bí mật (khối lượng vật lý), ≤ 4 lần cân, kết luận đúng", (function () {
      var bd = [], mx = 0;
      for (var x = 0; x < 64; x++) { var p = fromIn(twoIn(6, 4, "fixed", x)), r = playByHints(p, x); if (!r.ok) bd.push([x, r.why]); else mx = Math.max(mx, r.weighings); }
      return bd.length === 0 && mx <= 4 ? true : bd.slice(0, 3);
    })());
    t.ok("solvTwo(T, r) trên tập con ngẫu nhiên = vét cạn tường minh (n = 4, 60 tập, r = 1…3)", (function () {
      var rng = R.create(77), vecs = allVecs(4), groups = allVecs(4).slice(1), bd = [];
      function can(idx, r) { if (idx.length <= 1) return true; if (r === 0) return false; for (var w = 0; w < groups.length; w++) { var by = {}; idx.forEach(function (v) { var g = physTwo(groups[w], vecs[v]); (by[g] = by[g] || []).push(v); }); var ks = Object.keys(by), good = ks.length > 1; for (var q = 0; q < ks.length && good; q++) if (!can(by[ks[q]], r - 1)) good = false; if (good) return true; } return false; }
      for (var i = 0; i < 60; i++) { var set = []; for (var v = 0; v < 16; v++) if (rng.chance(0.2 + 0.05 * (i % 10))) set.push(v); for (var r = 1; r <= 3; r++) if (L.solvTwo(4, set, r) !== can(set, r)) bd.push([set.join(), r]); }
      return bd.length === 0 ? true : bd.slice(0, 3);
    })());
    t.time("A(6) lạnh (xoá nhớ đệm) trong luồng chính", 1500, function () { L.resetMemo(); var k = L.bestK(twoIn(6, 6)); t.ok("A(6) = 4 sau khi xoá nhớ đệm", k === 4); });
  })();

  // ====================================================================== 3. generate
  t.group("coinscale — generate: tất định, bậc, ngân sách vừa khít");
  (function () {
    var detBad = [], bandBad = [], solBad = [], budBad = [], optBad = [], n = 0, slow = 0, times = [];
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { MODES.forEach(function (mode) {
      for (var seed = 1; seed <= 20; seed++) {
        var o = { sizeId: sz.id, tier: tier, options: mode === "adv" ? { mode: "adv" } : {} }, t0 = Date.now(), a = T.generate(seed * 104729 + 17, o), ms = Date.now() - t0;
        times.push(ms); if (ms > 1500) slow++;
        n++;
        if (J(a) !== J(T.generate(seed * 104729 + 17, o))) detBad.push([sz.id, tier, mode, seed]);
        if (!inBand(a.score, tier) || a.tier !== tier) bandBad.push([sz.id, tier, mode, seed, a.score, a.tier]);
        if (!a.solution || !T.check(a, { v: a.solution.v, c: null }).solved) solBad.push([sz.id, tier, mode, seed]);
        if (L.bestK(a.data) !== a.data.k || (sz.id === "hailoai" && a.data.n > 6) || (sz.id === "chong" && (a.data.n < 3 || a.data.n > 40))) budBad.push([sz.id, tier, mode, seed, a.data.n]);
        var secOk = mode === "adv" ? a.data.secret === null : (a.data.form === "stack" ? a.data.secret >= 0 && a.data.secret < a.data.n : a.data.secret >= 0 && a.data.secret < (1 << a.data.n));
        if (J(a.options) !== (mode === "adv" ? '{"mode":"adv"}' : "{}") || a.sizeId !== sz.id || !secOk) optBad.push([sz.id, tier, mode, seed]);
      }
    }); }); });
    t.ok("tất định: " + n + " đề sinh hai lần giống hệt từng bit", detBad.length === 0, detBad.slice(0, 3));
    t.ok("điểm trong khoảng bậc ở 100 % của " + n + " đề (2 phiên bản × 4 bậc × 2 chế độ × 20 seed; yêu cầu ≥ 90 %) và puzzle.tier đúng bậc", bandBad.length === 0, bandBad.slice(0, 4));
    t.ok("solution.v giải xong đề (check.solved) ở mọi đề", solBad.length === 0, solBad.slice(0, 3));
    t.ok("ngân sách k vừa khít: k* = k; hailoai n ≤ 6, chong 3 ≤ n ≤ 40", budBad.length === 0, budBad.slice(0, 3));
    t.ok("puzzle.options gọn đúng; chế độ cố định có bí mật hợp lệ, chế độ đối thủ không có secret", optBad.length === 0, optBad.slice(0, 3));
    t.ok("sinh đề: tối đa " + Math.max.apply(null, times) + " ms, không đề nào > 1,5 s", slow === 0);
    var mono = T.sizes.map(function (sz) { return TIERS.map(function (tier) { var s = []; for (var seed = 1; seed <= 20; seed++) s.push(T.generate(seed, { sizeId: sz.id, tier: tier }).score); return mean(s); }); });
    t.ok("điểm trung bình đơn điệu theo bậc (Dễ < Vừa < Khó < Chuyên gia) ở cả 2 phiên bản", mono.every(function (a) { return a[0] < a[1] && a[1] < a[2] && a[2] < a[3]; }), mono);
    var variety = {}; for (var sd = 1; sd <= 30; sd++) variety[J(T.generate(sd, { sizeId: "chong", tier: "medium" }).size)] = 1;
    t.ok("phiên bản chong bậc Vừa có nhiều đề khác nhau (≥ 8 cấu hình trong 30 seed): " + Object.keys(variety).length, Object.keys(variety).length >= 8);
    var d1 = T.generate(5, { sizeId: "chong", tier: "easy" }), d2 = T.generate(5, { sizeId: "chong", tier: "easy", options: { mode: "fixed" } }), d3 = T.generate(5, { sizeId: "chong", tier: "easy", options: { mode: "adv" } });
    t.ok("lựa chọn = mặc định tường minh ⇒ cùng puzzle với không truyền; adv ⇒ id khác", J(d1) === J(d2) && d1.id !== d3.id && d3.options.mode === "adv" && d3.data.mode === "adv");
    t.ok("khoá lạ / bậc lạ / kích cỡ lạ không làm sinh đề ném lỗi (rơi về mặc định)", (function () { try { var p = T.generate(1, { sizeId: "khong-co", tier: "x", options: { mode: "zzz", rác: 1 } }); return p.sizeId === "chong" && p.options && J(p.options) === "{}"; } catch (e) { return String(e); } })());
  })();

  // ====================================================================== 4. oracle
  t.group("coinscale — oracle cố định = mô phỏng khối lượng; đối thủ luôn nhất quán và không để lọt");
  (function () {
    var rng = R.create(2024), bad = [], runs = 0, advBad = [], lostBad = [], detBad = [], advRuns = 0;
    [stackIn(8, 3, 2, "fixed", 5), stackIn(16, 1, 4, "fixed", 11), twoIn(4, 3, "fixed", 6), twoIn(5, 4, "fixed", 19)].forEach(function (inp) {
      var p = fromIn(inp);
      for (var rep = 0; rep < 10; rep++) {
        var s = T.newState(p), steps = 0;
        while (steps++ < p.data.k) {
          var a = randomWeigh(p, rng), d = apply(p, s, a);
          if (!d) { bad.push(["moveFor null", J(a)]); break; }
          var rec = recsOf(p, s).pop(), phys = p.data.form === "stack" ? physStack(a.take, p.data.secret) : physTwo(bits(L.wFromAction(p.data, a), p.data.n), bits(p.data.secret, p.data.n));
          runs++;
          if (L.gramsOf(p.data, rec) !== phys) bad.push([J(inp), J(a), L.gramsOf(p.data, rec), phys]);
        }
      }
    });
    t.ok("cố định: " + runs + " lần cân ngẫu nhiên — số gam của engine = khối lượng vật lý tính riêng", bad.length === 0, bad.slice(0, 3));
    // đối thủ: các số đọc luôn nhất quán với ≥ 1 bí mật (liệt kê tường minh bằng vật lý); tất định; khi đã MẤT, tới hết lượt vẫn còn ≥ 2 khả năng
    [stackIn(10, 2, 3, "adv", null), stackIn(13, 1, 4, "adv", null), twoIn(4, 3, "adv", null), twoIn(5, 4, "adv", null), twoIn(6, 4, "adv", null)].forEach(function (inp) {
      var p = fromIn(inp), d = p.data;
      for (var rep = 0; rep < 12; rep++) {
        var s = T.newState(p), s2 = T.newState(p), hist = [], steps = 0, lostOnce = false, cmp;
        while (steps++ < d.k) {
          var wasOk = L.solvC(d, L.candOf(d, s), L.budget(d, s)), a = randomWeigh(p, rng);
          if (!apply(p, s, a)) break; apply(p, s2, a); advRuns++;
          if (J(s.v) !== J(s2.v)) detBad.push(J(inp));
          hist.push(a);
          var cons = 0, cand = d.form === "stack" ? d.n : (1 << d.n);
          for (var sec = 0; sec < cand; sec++) {
            var ok = recsOf(p, s).every(function (rc) { var aa = d.form === "stack" ? { k: "weigh", take: rc.slice(0, d.n) } : { k: "weigh", set: L.setOfMask(d.n, L.maskOfRec(d, rc)) }; var g = d.form === "stack" ? physStack(aa.take, sec) : physTwo(bits(L.wFromAction(d, aa), d.n), bits(sec, d.n)); return g === L.gramsOf(d, rc); });
            if (ok) cons++;
          }
          if (cons < 1) advBad.push([J(inp), "không bí mật nào nhất quán"]);
          if (cons !== L.candOf(d, s).length) advBad.push([J(inp), "tập ứng viên ≠ liệt kê vật lý", cons, L.candOf(d, s).length]);
          if (!wasOk) lostOnce = true;
          if (lostOnce && !L.solvC(d, L.candOf(d, s), L.budget(d, s)) && L.candOf(d, s).length < 2) lostBad.push([J(inp), steps]);
        }
        if (lostOnce && L.candOf(d, s).length < 2) lostBad.push([J(inp), "hết lượt còn < 2 khả năng sau khi đã mất"]);
      }
    });
    t.ok("đối thủ: " + advRuns + " lần cân — luôn nhất quán với ≥ 1 bí mật và tập ứng viên của engine = liệt kê vật lý", advBad.length === 0, advBad.slice(0, 3));
    t.ok("đối thủ không để lọt: thế đã mất thì tới hết lượt vẫn còn ≥ 2 khả năng (đoán may không tính)", lostBad.length === 0, lostBad.slice(0, 3));
    t.ok("đối thủ tất định: cùng lịch sử → cùng kết quả (áp hai lần)", detBad.length === 0, detBad.slice(0, 2));
  })();

  // ====================================================================== 5. đầu cuối
  t.group("coinscale — đầu cuối: MỌI bí mật đều bị chiến lược tối ưu tìm ra (đo bằng vật lý), cả hai chế độ");
  (function () {
    var bad = [], runs = 0, mx = {};
    [stackIn(10, 9, 1), stackIn(9, 2, 2), stackIn(7, 3, 2), stackIn(16, 1, 4), stackIn(27, 2, 3), stackIn(12, 2, 3), twoIn(2, 2), twoIn(3, 3), twoIn(4, 3), twoIn(5, 4)].forEach(function (base) {
      var nSec = base.form === "stack" ? base.n : (1 << base.n);
      for (var sec = 0; sec < nSec; sec++) {
        var inp = Object.assign({}, base, { secret: sec }), p = fromIn(inp), r = playByHints(p, sec);
        runs++;
        if (!r.ok) bad.push([J(base), sec, r.why]); else { var key = J(base); mx[key] = Math.max(mx[key] || 0, r.weighings); if (r.weighings > p.data.k) bad.push([J(base), sec, "quá k"]); }
      }
    });
    t.ok(runs + " ván cố định (mọi bí mật của 10 cấu hình): gợi ý mức 3 thắng ≤ k lần cân, kết luận đúng, oracle = vật lý", bad.length === 0, bad.slice(0, 4));
    var badA = [];
    [stackIn(10, 2, 3, "adv", null), stackIn(16, 1, 4, "adv", null), twoIn(3, 3, "adv", null), twoIn(5, 4, "adv", null), twoIn(6, 4, "adv", null)].forEach(function (inp) {
      var p = fromIn(inp), r = playByHints(p, -1 === 0 ? 0 : (function () { return 0; })());
      // đối thủ không có bí mật: kiểm bằng chơi theo gợi ý đến solved (kết luận bị ép buộc bởi lịch sử)
      var g = G.create(p, {}), st = 0;
      while (g.status !== "solved" && st++ < p.data.k + 3) { var h = g.hint(3); if (!h || !h.action) break; g.applyHint(h); }
      if (g.status !== "solved" || plan.count(g.state) > p.data.k) badA.push(J(inp));
    });
    t.ok("đối thủ: gợi ý mức 3 giải xong 5 đề (kết luận bị lịch sử ép buộc), trong k lần cân", badA.length === 0, badA);
  })();

  // ====================================================================== 6. moveFor / check
  t.group("coinscale — moveFor: hợp lệ, đảo diff, dung lượng, ngân sách");
  (function () {
    var ps = [fromIn(stackIn(10, 3, 3, "fixed", 4)), fromIn(twoIn(4, 3, "fixed", 5))], bad = [], rng = R.create(5);
    ps.forEach(function (p) {
      var d = p.data, s = T.newState(p), nulls = d.form === "stack"
        ? [null, 5, { k: "weigh" }, { k: "weigh", take: [] }, { k: "weigh", take: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { k: "weigh", take: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { k: "weigh", take: [1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { k: "weigh", take: [1, 2] }, { k: "conclude", stack: 10 }, { k: "conclude", stack: -1 }, { k: "conclude" }, { k: "zzz" }, { k: "truncate", n: 5 }]
        : [null, { k: "weigh", set: [] }, { k: "weigh", set: [4] }, { k: "weigh", set: [0, 0] }, { k: "weigh", set: [-1] }, { k: "weigh" }, { k: "conclude", x: [1, 0] }, { k: "conclude", x: [1, 0, 2, 0] }, { k: "conclude" }, { k: "truncate", n: 3 }];
      nulls.forEach(function (a) { try { if (T.moveFor(p, s, a) !== null) bad.push([d.form, J(a)]); } catch (e) { bad.push([d.form, J(a), String(e)]); } });
      // đảo diff + hợp lệ plan
      var cur = T.newState(p), seq = [], steps = 0;
      while (steps++ < d.k) { var dd = apply(p, cur, randomWeigh(p, rng)); if (!dd) break; seq.push(dd); if (!plan.valid(cur, lay(p))) bad.push([d.form, "plan không hợp lệ"]); }
      if (d.form === "stack" ? T.moveFor(p, cur, { k: "weigh", take: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }) !== null : T.moveFor(p, cur, { k: "weigh", set: [0] }) !== null) bad.push([d.form, "hết ngân sách vẫn cân được"]);
      for (var i = seq.length - 1; i >= 0; i--) G.applyDiff(cur, G.reverseDiff(seq[i].d), false);
      if (J(cur.v) !== J(T.newState(p).v)) bad.push([d.form, "đảo diff không về đầu ván"]);
      // truncate + conclude + mở lại
      var s2 = T.newState(p); apply(p, s2, d.form === "stack" ? { k: "weigh", take: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] } : { k: "weigh", set: [0, 1] });
      var cd = apply(p, s2, d.form === "stack" ? { k: "conclude", stack: 2 } : { k: "conclude", x: [1, 0, 1, 0] });
      if (!cd || !plan.isSubmitted(s2) || T.moveFor(p, s2, d.form === "stack" ? { k: "weigh", take: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] } : { k: "weigh", set: [0] }) !== null) bad.push([d.form, "sau kết luận vẫn cân được"]);
      var tr = apply(p, s2, { k: "truncate", n: plan.count(s2) });
      if (!tr || plan.isSubmitted(s2) || plan.count(s2) !== 1) bad.push([d.form, "mở lại hỏng"]);
    });
    t.ok("hành động sai → null (không ném); hết ngân sách / sau kết luận không cân được; mở lại; đảo diff về đầu; plan luôn hợp lệ", bad.length === 0, bad.slice(0, 4));
    t.ok("oracle ghi kết quả VÀO diff: làm lại (applyDiff) cho đúng state cũ; khôi phục cùng lịch sử → cùng state", (function () {
      var p = ps[1], s = T.newState(p), d1 = apply(p, s, { k: "weigh", set: [0, 2] }), s2 = T.newState(p); G.applyDiff(s2, d1.d, false);
      return J(s.v) === J(s2.v);
    })());
  })();
  t.group("coinscale — check: chỉ tính khi kết luận bị lịch sử ÉP BUỘC; đoán may không tính");
  (function () {
    var p = fromIn(stackIn(10, 9, 1, "fixed", 6)), s = T.newState(p), ok = [];
    ok.push(T.check(p, s).solved === false);
    apply(p, s, { k: "conclude", stack: 6 });
    var c1 = T.check(p, s);
    t.ok("đoán trúng nhờ may (chưa cân gì) → KHÔNG solved, không conflict, complete = false", ok[0] && !c1.solved && !c1.complete && c1.conflicts.length === 0 && plan.isSubmitted(s));
    apply(p, s, { k: "truncate", n: 0 });
    apply(p, s, { k: "weigh", take: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    apply(p, s, { k: "conclude", stack: 6 });
    var c2 = T.check(p, s);
    t.ok("cân đủ rồi kết luận đúng → solved, complete", c2.solved && c2.complete && c2.filled === 1 && c2.total === 1);
    apply(p, s, { k: "truncate", n: 1 }); apply(p, s, { k: "conclude", stack: 3 });
    var c3 = T.check(p, s);
    t.ok("kết luận sai chồng (mâu thuẫn với số đọc) → không solved, conflicts chỉ ra chồng đã kết luận", !c3.solved && c3.conflicts.join() === "3");
    t.ok("đoán trúng chính khả năng ĐẦU TIÊN của tập ứng viên (T[0]) khi còn nhiều khả năng → vẫn KHÔNG solved (chong: chồng 1; hailoai: mọi xu nhẹ)", (function () {
      var a = fromIn(stackIn(10, 9, 1, "fixed", 0)), sa = T.newState(a); apply(a, sa, { k: "conclude", stack: 0 });
      var b = fromIn(twoIn(3, 3, "fixed", 0)), sb = T.newState(b); apply(b, sb, { k: "conclude", x: [0, 0, 0] });
      return L.candOf(a.data, sa)[0] === 0 && L.candOf(b.data, sb)[0] === 0 && !T.check(a, sa).solved && !T.check(b, sb).solved && T.mistakes(a, T.newState(a), T.moveFor(a, T.newState(a), { k: "conclude", stack: 0 })) === 1;
    })());
    var q = fromIn(twoIn(3, 3, "fixed", 5)), s2 = T.newState(q);
    apply(q, s2, { k: "conclude", x: [1, 0, 1] });
    t.ok("hailoai: đoán đúng vectơ khi chưa cân gì → không solved; chốt sai → không solved", !T.check(q, s2).solved);
    var pl = L.playOptimal(q), fin = T.newState(q); pl.steps.forEach(function (st) { G.applyDiff(fin, st.diff.d, false); });
    t.ok("hailoai: chơi tối ưu rồi kết luận đúng → solved; đổi một xu → không solved và conflicts nêu xu mâu thuẫn", T.check(q, fin).solved && (function () {
      var s3 = fin.v.slice(), L0 = lay(q), pp = plan.params({ v: s3 }, L0), t2 = { v: s3.slice(), c: null }, dd = plan.truncateDiff(t2, L0, plan.count(t2)); G.applyDiff(t2, dd.d, false);
      var wrong = pp.map(function (v) { return v === 2 ? 0 : 1; }); wrong[0] = wrong[0] ? 0 : 1;
      var d2 = T.moveFor(q, t2, { k: "conclude", x: wrong }); G.applyDiff(t2, d2.d, false);
      var c = T.check(q, t2); return !c.solved && c.conflicts.length >= 1;
    })());
  })();

  // ====================================================================== 7. mistakes
  t.group("coinscale — mistakes: lần cân làm mất khả năng thắng chắc");
  (function () {
    var ps = fromIn(stackIn(9, 2, 2, "adv", null)), s = T.newState(ps);
    var good = T.moveFor(ps, s, T.hint(ps, s, 3).action), bal = T.moveFor(ps, s, { k: "weigh", take: [0, 0, 0, 1, 1, 1, 2, 2, 2] }), skew = T.moveFor(ps, s, { k: "weigh", take: [0, 0, 0, 0, 0, 0, 0, 0, 1] }), half = T.moveFor(ps, s, { k: "weigh", take: [1, 1, 1, 1, 0, 0, 0, 0, 0] });
    t.ok("chồng (9, c = 2, k = 2): nhóm đều 3-3-3 và phép cân gợi ý → 0 lỗi; dồn 8 chồng vào một kết quả (8 > 3) hoặc 4-5 (cả hai > 3) = mất an toàn", T.mistakes(ps, s, good) === 0 && T.mistakes(ps, s, bal) === 0 && T.mistakes(ps, s, skew) === 1 && T.mistakes(ps, s, half) === 1, [T.mistakes(ps, s, good), T.mistakes(ps, s, bal), T.mistakes(ps, s, skew), T.mistakes(ps, s, half)]);
    var s2 = T.newState(ps); apply(ps, s2, { k: "weigh", take: [0, 0, 0, 0, 0, 0, 0, 0, 1] });
    var again = T.mistakes(ps, s2, T.moveFor(ps, s2, { k: "weigh", take: [1, 0, 0, 0, 0, 0, 0, 0, 0] }));
    t.ok("đã mất từ trước thì không tính lại lỗi; kết luận chưa chứng minh = 1 lỗi, kết luận được ép buộc = 0", again === 0 && (function () {
      var p = fromIn(stackIn(10, 9, 1, "fixed", 2)), st = T.newState(p), cc = T.moveFor(p, st, { k: "conclude", stack: 2 }), m1 = T.mistakes(p, st, cc);
      apply(p, st, { k: "weigh", take: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }); var cd = T.moveFor(p, st, { k: "conclude", stack: 2 });
      return m1 === 1 && T.mistakes(p, st, cd) === 0;
    })());
    // hailoai: đối chiếu độc lập bằng vét cạn — mọi nhóm đầu của n = 4 / k = 3: "mistake" ⇔ vét cạn nói tập con kết quả không giải được trong 2 lần
    var q = fromIn(twoIn(4, 3, "adv", null)), sq = T.newState(q), vecs = allVecs(4), groups = allVecs(4).slice(1), diffs = [];
    function canB(idx, r) { if (idx.length <= 1) return true; if (r === 0) return false; for (var w = 0; w < groups.length; w++) { var by = {}; idx.forEach(function (v) { var g = physTwo(groups[w], vecs[v]); (by[g] = by[g] || []).push(v); }); var ks = Object.keys(by), good = ks.length > 1; for (var z = 0; z < ks.length && good; z++) if (!canB(by[ks[z]], r - 1)) good = false; if (good) return true; } return false; }
    for (var w = 1; w < 16; w++) {
      var by = {}; vecs.forEach(function (v, i) { var g = physTwo(bits(w, 4), v); (by[g] = by[g] || []).push(i); });
      var unsafe = Object.keys(by).some(function (k) { return !canB(by[k], 2); }), m = T.mistakes(q, sq, T.moveFor(q, sq, { k: "weigh", set: L.setOfMask(4, w) }));
      if ((m === 1) !== unsafe) diffs.push([w, m, unsafe]);
    }
    t.ok("hailoai n = 4, k = 3: mistakes của 15 nhóm đầu ⇔ vét cạn tường minh 'có lớp không giải được trong 2 lần'", diffs.length === 0, diffs);
  })();

  // ====================================================================== 8. hint
  t.group("coinscale — gợi ý: vòng 'mức 3 → áp dụng' giải xong, cả hai chế độ, kể cả sau nước đi sai");
  (function () {
    var rng = R.create(404), fail = [], runs = 0, maxSteps = 0, lvlBad = [], whyBad = [], detBad = [];
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) { for (var seed = 1; seed <= 8; seed++) {
      var p = T.generate(seed * 211, { sizeId: sz.id, tier: TIERS[(seed + 1) % 4], options: { mode: mode } }), g = G.create(p, {}), steps = 0, injected = false;
      runs++;
      while (g.status !== "solved" && steps < p.data.k * 3 + 4) {
        if (!injected && steps === 1 && plan.count(g.state) < p.data.k) { injected = true; g.act(randomWeigh(p, rng)); }
        var h3 = g.hint(3);
        if (!h3 || h3.none || !h3.action) { fail.push(["không còn hint", sz.id, mode, seed, steps, h3 && h3.text]); break; }
        if (J(T.hint(p, g.state, 3, {})) !== J(T.hint(p, g.state, 3, { x: 1 }))) detBad.push([sz.id, mode, seed, steps]);
        var r = g.applyHint(h3); if (!r.ok) { fail.push(["áp dụng thất bại", sz.id, mode, seed, steps, J(h3.action)]); break; } steps++;
      }
      maxSteps = Math.max(maxSteps, steps);
      if (g.status !== "solved") fail.push(["chưa giải", sz.id, mode, seed, steps]);
      var gr = g.grade(); if (!gr || GR.errors(gr).length) fail.push(["grade lỗi", sz.id, J(gr)]);
    } }); });
    t.ok("giải xong bằng gợi ý mức 3 ở " + runs + " ván (2 phiên bản × 2 chế độ × 8 seed, có chèn lần cân ngẫu nhiên), ≤ k·3+4 bước (tối đa " + maxSteps + ")", fail.length === 0, fail.slice(0, 3));
    t.ok("hint(…, settings) tất định: cùng trạng thái + mức → cùng kết quả bất kể settings", detBad.length === 0, detBad.slice(0, 3));
    T.sizes.forEach(function (sz) {
      var p = T.generate(8, { sizeId: sz.id, tier: "hard" }), s = T.newState(p), h1 = T.hint(p, s, 1), h2 = T.hint(p, s, 2), h3 = T.hint(p, s, 3);
      var ok = h1.text.length > 20 && h2.cells.length >= 2 && h3.action.k === "weigh" && h3.why.length >= 3 && h1.level === 1 && h2.level === 2 && h3.level === 3 && h1.cells.length === 0 || h1.cells.length > 0;
      if (sz.id === "hailoai") ok = ok && h1.text.indexOf(L.setText(L.setOfMask(p.data.n, L.wFromAction(p.data, h3.action)))) < 0 && h3.cells.join() === h3.action.set.join();
      else ok = ok && h1.text.indexOf("xu từ chồng") < 0;
      if (!ok) lvlBad.push([sz.id, h1.text, h3.text]);
      if (h3.why.some(function (w) { return /\b(undefined|null|NaN)\b/.test(w); }) || /\b(undefined|null|NaN)\b/.test(h1.text + h2.text + h3.text)) whyBad.push(sz.id);
    });
    t.ok("mức 1 không lộ phép cân của mức 3; mức 2 nêu các chồng/xu (cells); mức 3 có ≥ 3 dòng 'vì sao' + action weigh khớp — 2 phiên bản", lvlBad.length === 0, lvlBad.slice(0, 2));
    t.ok("chữ gợi ý không lọt undefined/null/NaN", whyBad.length === 0, whyBad);
  })();
  t.group("coinscale — gợi ý: phép cân tốt nhất an toàn (kiểm vét cạn), thế mất → hoàn tác, kết luận, đã xong");
  (function () {
    var q = fromIn(twoIn(4, 3, "adv", null)), sq = T.newState(q), d = q.data, T0 = L.fullSet(d), best = L.bestWeighing(d, T0, 3), bad = [];
    var vecs = allVecs(4), groups = allVecs(4).slice(1);
    function canB(idx, r) { if (idx.length <= 1) return true; if (r === 0) return false; for (var w = 0; w < groups.length; w++) { var by = {}; idx.forEach(function (v) { var g = physTwo(groups[w], vecs[v]); (by[g] = by[g] || []).push(v); }); var ks = Object.keys(by), good = ks.length > 1; for (var z = 0; z < ks.length && good; z++) if (!canB(by[ks[z]], r - 1)) good = false; if (good) return true; } return false; }
    var by = {}; vecs.forEach(function (v, i) { var g = physTwo(bits(best.w, 4), v); (by[g] = by[g] || []).push(i); });
    var safeB = Object.keys(by).every(function (k) { return canB(by[k], 2); });
    // mọi nhóm an toàn theo vét cạn phải nằm trong safeWeighings và ngược lại
    var engineSafe = L.safeWeighings(d, T0, 3).map(function (x) { return x.w; }).sort(function (a, b) { return a - b; }), brute = [];
    for (var w = 1; w < 16; w++) { var b2 = {}; vecs.forEach(function (v, i) { var g = physTwo(bits(w, 4), v); (b2[g] = b2[g] || []).push(i); }); if (Object.keys(b2).length > 1 && Object.keys(b2).every(function (k) { return canB(b2[k], 2); })) brute.push(w); }
    t.ok("hailoai n = 4, k = 3: bestWeighing an toàn (vét cạn) và tập phép cân an toàn của engine = vét cạn tường minh (" + brute.length + " nhóm)", safeB && J(engineSafe) === J(brute), [engineSafe, brute]);
    // thế mất → hint nói trước + truncate
    var p = fromIn(stackIn(9, 2, 2, "adv", null)), g = G.create(p, {}), mx = 0;
    g.act({ k: "weigh", take: [0, 0, 0, 0, 0, 0, 0, 0, 1] });
    var h = g.hint(3), h1 = g.hint(1);
    t.ok("thế đã mất (dồn 8 chồng vào kết quả 0): hint mức 3 = truncate về trước lần cân đó + 'vì sao'; mức 1 nói 'không còn cách'", h.technique === "Hoàn tác" && h.action && h.action.k === "truncate" && h.action.n === 0 && /mất an toàn/.test(h.why[0]) && /không còn cách/.test(h1.text), [h.text, h1.text]);
    var pc = fromIn(stackIn(10, 9, 1, "fixed", 2)), sc = T.newState(pc); apply(pc, sc, { k: "weigh", take: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    var hc = T.hint(pc, sc, 3);
    t.ok("đã đủ thông tin → mức 3 = conclude đúng chồng; mức 1 nói 'đủ thông tin' và không nêu chồng", hc.action.k === "conclude" && hc.action.stack === 2 && /đủ thông tin/.test(T.hint(pc, sc, 1).text) && T.hint(pc, sc, 1).text.indexOf("3") < 0);
    apply(pc, sc, hc.action);
    t.ok("đã giải → none:true", T.hint(pc, sc, 2).none === true);
    var pu = fromIn(stackIn(10, 9, 1, "fixed", 2)), su = T.newState(pu); apply(pu, su, { k: "conclude", stack: 2 });
    var hu = T.hint(pu, su, 3);
    t.ok("kết luận chưa chứng minh → hint 'Mở lại' + truncate n = số lần cân", hu.technique === "Mở lại" && hu.action.k === "truncate" && hu.action.n === 0);
    // thế thắng nhờ may sau lần cân mất an toàn: KHÔNG khuyên hoàn tác (cố định, bí mật rơi vào lớp lành)
    var pl = fromIn(stackIn(9, 2, 2, "fixed", 3)), sl = T.newState(pl); apply(pl, sl, { k: "weigh", take: [0, 0, 0, 0, 0, 0, 0, 0, 1] });
    var hl = T.hint(pl, sl, 3), scan = L.lossScan(pl, sl);
    t.ok("thế hiện tại còn thắng chắc dù lần cân đầu có thể mất an toàn → không khuyên hoàn tác (hint nói về thế hiện tại)", (scan.now === -1 && hl.technique !== "Hoàn tác") || scan.now >= 1, [scan, hl.technique]);
  })();
  t.group("coinscale — gợi ý: MỌI thế giữa ván (chơi ngẫu nhiên, 2 phiên bản × 2 chế độ): 'Hoàn tác / không còn cách' ⇔ thế hiện tại không còn giải được");
  (function () {
    var rng = R.create(909), bad = [], n = 0;
    [stackIn(10, 2, 3, "fixed", 4), stackIn(10, 2, 3, "adv", null), twoIn(4, 3, "fixed", 9), twoIn(5, 4, "adv", null)].forEach(function (inp) {
      var p = fromIn(inp), d = p.data;
      for (var rep = 0; rep < 12; rep++) {
        var s = T.newState(p), steps = 0;
        while (steps++ <= d.k) {
          var cand = L.candOf(d, s), r = L.budget(d, s), solvable = L.solvC(d, cand, r), h = T.hint(p, s, 3);
          n++;
          if (!plan.isSubmitted(s)) { var isBack = h.technique === "Hoàn tác" || h.none === true && cand.length > 1; if (isBack !== (!solvable && cand.length > 1)) { if (!(solvable === false && cand.length > 1 && r === 0)) bad.push([J(inp), steps, solvable, h.technique, h.none]); } }
          if (r === 0 || !apply(p, s, randomWeigh(p, rng))) break;
        }
      }
    });
    t.ok("hint theo THẾ HIỆN TẠI ở " + n + " thế giữa ván: nói 'hoàn tác' khi và chỉ khi thế đã mất", bad.length === 0, bad.slice(0, 3));
  })();

  // ====================================================================== 9. grade
  t.group("coinscale — grade: sao theo hoàn tác / gợi ý mức 3 / may mắn");
  (function () {
    var p = fromIn(stackIn(13, 2, 3, "fixed", 6)), done = T.newState(p); T.replay(p).forEach(function (st) { G.applyDiff(done, st.diff.d, false); });
    var clean = { moves: 4, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false };
    var g0 = T.grade(p, done, clean), gU = T.grade(p, done, Object.assign({}, clean, { undos: 1 })), gH = T.grade(p, done, Object.assign({}, clean, { hints: { 1: 2, 2: 1, 3: 1 } })), gL = T.grade(p, done, Object.assign({}, clean, { mistakes: 1 }));
    t.ok("thắng chắc chắn, không hoàn tác, không gợi ý mức 3 → 3★, quality 1, 'Tối ưu'", g0.stars === 3 && g0.quality === 1 && g0.value === 3 && g0.best === 3 && /Tối ưu/.test(g0.text), g0);
    t.ok("có hoàn tác → 2★; có gợi ý mức 3 → 2★ (gợi ý mức 1–2 không phạt)", gU.stars === 2 && gH.stars === 2 && T.grade(p, done, Object.assign({}, clean, { hints: { 1: 3, 2: 3, 3: 0 } })).stars === 3);
    t.ok("thắng mà có sai sót → 1★, chữ nói rõ", gL.stars === 1 && /sai sót/.test(gL.text) && /nhờ may/.test(gL.text));
    t.ok("chưa kết luận → 0★; kết luận chưa chứng minh → 0★", (function () { var s = T.newState(p), a = T.grade(p, s, clean); apply(p, s, { k: "conclude", stack: 6 }); var b = T.grade(p, s, clean); return a.stars === 0 && /Chưa kết luận/.test(a.text) && b.stars === 0 && /chưa được chứng minh/.test(b.text); })());
    t.ok("Puz.grade.errors rỗng ở mọi trạng thái (đầu, cuối) và mọi counters; hailoai cũng vậy", (function () {
      var q = fromIn(twoIn(4, 3, "fixed", 6)), f2 = T.newState(q); T.replay(q).forEach(function (st) { G.applyDiff(f2, st.diff.d, false); });
      return [[p, T.newState(p)], [p, done], [q, T.newState(q)], [q, f2]].every(function (pr) { return [clean, { moves: 9, mistakes: 3, undos: 5, hints: { 1: 1, 2: 1, 3: 1 }, revealed: false }, undefined].every(function (c) { return GR.errors(T.grade(pr[0], pr[1], c)).length === 0; }); });
    })());
    t.ok("ván THẬT qua game.act: giải sạch → record.grade 3★; có Hoàn tác → 2★; Reveal → không có grade", (function () {
      var g = G.create(p, {}), play = L.playOptimal(p);
      play.steps.forEach(function (st) { g.act(st.action); });
      var r = g.record("solved"), g2 = G.create(p, {}); play.steps.forEach(function (st, i) { g2.act(st.action); if (i === 0) { g2.undo(); g2.act(st.action); } });
      var g3 = G.create(p, {}); g3.reveal(); var r3 = g3.record("revealed");
      return g.status === "solved" && r.grade && r.grade.stars === 3 && g2.record("solved").grade.stars === 2 && !r3.grade;
    })());
    t.ok("đề tự nhập k > k*: dùng nhiều lần cân hơn k* → 1★ 'đủ trong k*'", (function () {
      var q = fromIn(stackIn(5, 2, 3, "fixed", 1)), s = T.newState(q);
      apply(q, s, { k: "weigh", take: [0, 1, 0, 0, 0] }); apply(q, s, { k: "weigh", take: [0, 0, 1, 0, 0] }); apply(q, s, { k: "weigh", take: [0, 0, 0, 1, 0] });
      apply(q, s, { k: "conclude", stack: 1 });
      var gg = T.grade(q, s, clean);
      return T.check(q, s).solved && gg.value === 3 && gg.best === 2 && gg.stars === 1 && /đủ trong 2/.test(gg.text);
    })());
  })();

  // ====================================================================== 10. fromInput / validate / solve
  t.group("coinscale — fromInput / validate / solve: chiến lược chắc chắn hay không");
  (function () {
    var okIn = [stackIn(10, 9, 1), stackIn(27, 2, 3), twoIn(6, 4), twoIn(4, 3), twoIn(5, 4, "adv", null)], notIn = [stackIn(10, 8, 1), stackIn(28, 2, 3), stackIn(17, 1, 4), twoIn(6, 3), twoIn(5, 3), twoIn(4, 2)];
    t.ok("đề đạt: status unique + statusText '✓'; đề thiếu: ok = false + statusKind bad + lý do", okIn.every(function (i) { var r = T.fromInput(i); return r.ok && r.status === "unique" && r.count === 1 && /^✓/.test(r.statusText) && r.statusKind === "ok" && r.puzzle.tier === "custom" && r.puzzle.solution; }) && notIn.every(function (i) { var r = T.fromInput(i); return !r.ok && r.statusKind === "bad" && /^✗/.test(r.statusText) && r.errors.length === 1; }), [okIn.map(function (i) { return T.fromInput(i).ok; }), notIn.map(function (i) { return T.fromInput(i).ok; })]);
    t.ok("thông báo thiếu nêu đúng cận: chong 'tối đa 9' (c = 2, k = 2); hai loại nêu 'cần ít nhất 4'", /tối đa 9/.test(T.fromInput(stackIn(10, 2, 2)).errors[0]) && /cần ít nhất 4/.test(T.fromInput(twoIn(6, 3)).errors[0]));
    t.ok("giá trị hợp lệ hay không: n = 7 hailoai bị từ chối (vượt ngân sách tính); n = 41 chong; c = 10; k = 5 chong; chuỗi số được chấp nhận", !T.fromInput(twoIn(7, 6)).ok && !T.fromInput(stackIn(41, 9, 2)).ok && !T.fromInput(stackIn(10, 10, 1)).ok && !T.fromInput(stackIn(10, 9, 5)).ok && T.fromInput({ form: "stack", n: "10", c: "9", k: "1", mode: "fixed", secret: "3" }).ok);
    t.ok("chế độ cố định thiếu / sai bí mật → lỗi; chế độ đối thủ không cần bí mật; hailoai nhận chuỗi 0/1, mảng, bitmask", !T.fromInput({ form: "stack", n: 10, c: 9, k: 1, mode: "fixed" }).ok && !T.fromInput(stackIn(10, 9, 1, "fixed", 10)).ok && T.fromInput(stackIn(10, 9, 1, "adv", null)).ok && T.fromInput({ form: "two", n: 3, k: 3, mode: "fixed", secret: "101" }).puzzle.data.secret === 5 && T.fromInput({ form: "two", n: 3, k: 3, mode: "fixed", secret: [1, 0, 1] }).puzzle.data.secret === 5 && !T.fromInput({ form: "two", n: 3, k: 3, mode: "fixed", secret: "10" }).ok);
    t.ok("đầu vào xấu không ném: null, số, mảng, form lạ, mode lạ", [null, 5, [], {}, { form: "x" }, { form: "stack", mode: "q", n: 3, c: 1, k: 2 }].every(function (i) { try { var r = T.fromInput(i); return r.ok === false && r.errors.length >= 1; } catch (e) { return false; } }));
    t.ok("k > k*: ok kèm cảnh báo 'ngân sách còn dư'", (function () { var r = T.fromInput(stackIn(5, 4, 3)); return r.ok && r.warnings.length === 1 && /còn dư/.test(r.warnings[0]); })());
    t.ok("validate/solve: đề sinh ra → unique, solution = p.solution (cả đối thủ, nhờ seed); đề sai → none", (function () {
      var bad = [];
      T.sizes.forEach(function (sz) { MODES.forEach(function (mode) { for (var sd = 1; sd <= 6; sd++) { var p = T.generate(sd * 7, { sizeId: sz.id, tier: TIERS[sd % 4], options: { mode: mode } }), v = T.validate(p), sv = T.solve(p); if (!v.ok || v.status !== "unique" || J(v.solution.v) !== J(p.solution.v) || sv.status !== "unique" || !T.check(p, sv.solution).solved) bad.push([sz.id, mode, sd]); } }); });
      return bad.length === 0 ? T.validate({ data: { form: "stack", n: 99 } }).ok === false : bad.slice(0, 3);
    })());
  })();

  // ====================================================================== 11. I/O
  t.group("coinscale — I/O: toText/fromText, toFile/fromFile, tệp xấu");
  (function () {
    var bad = [];
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) { for (var sd = 1; sd <= 5; sd++) {
      var p = T.generate(sd * 13, { sizeId: sz.id, tier: TIERS[sd % 4], options: { mode: mode } }), r1 = T.fromText(T.toText(p)), r2 = T.fromFile(JSON.parse(JSON.stringify(T.toFile(p))));
      if (!r1.ok || J(r1.puzzle.data) !== J(p.data) || J(r1.puzzle.initial) !== J(p.initial)) bad.push(["text", sz.id, mode, sd, T.toText(p)]);
      if (!r2.ok || J(r2.puzzle.data) !== J(p.data)) bad.push(["file", sz.id, mode, sd]);
    } }); });
    t.ok("vòng tròn text/file giữ nguyên data + initial (2 phiên bản × 2 chế độ × 5 seed)", bad.length === 0, bad.slice(0, 2));
    t.ok("fromText chấp nhận khoá ASCII và dạng gọn; bỏ qua dòng lạ", (function () {
      var a = T.fromText("dang: chong xu\nchong: 10\nxu moi chong: 9\nlan can: 1\nche do: co dinh\nma: 4\nrac: 1"), b = T.fromText("form=two;n=3;k=3;mode=adv");
      return a.ok && a.puzzle.data.secret === 3 && b.ok && b.puzzle.data.mode === "adv";
    })());
    t.ok("tệp / văn bản xấu → ok:false + lỗi tiếng Việt, không ném (khoá 'constructor'/'__proto__' không là khoá)", [function () { return T.fromText(""); }, function () { return T.fromText("xu: 3"); }, function () { return T.fromText("constructor: 5\n__proto__: 1\nlần cân: 2"); }, function () { return T.fromText("dạng: lạ\nxu: 3\nlần cân: 2"); }, function () { return T.fromText("dạng: hai loại\nxu: 3\nlần cân: 3\nmã: 12"); },
      function () { return T.fromFile(null); }, function () { return T.fromFile({}); }, function () { return T.fromFile({ initialState: "n=3;k=2" }); }, function () { return T.fromFile({ initialState: "form=stack;n=10;c=9;k=1;mode=fixed;secret=abc" }); }].every(function (f) { try { var r = f(); return r.ok === false && r.errors.length >= 1 && /[à-ỹ]/i.test(r.errors[0]); } catch (e) { return false; } }));
    t.ok("fromFile không tin difficulty/solution trong tệp (dựng lại qua fromInput)", (function () { var o = T.toFile(T.generate(3, { sizeId: "chong", tier: "easy" })); o.difficulty = 9.9; o.solution = "rác"; var r = T.fromFile(o); return r.ok && r.puzzle.score < 9; })());
  })();

  // ====================================================================== 12. constraintView, trace, replay, describeCell
  t.group("coinscale — constraintView, trace (cây chiến lược), replay, describeCell");
  (function () {
    var bad = [], trBad = [], rpBad = [], dcBad = [];
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { MODES.forEach(function (mode) {
      var p = T.generate(31, { sizeId: sz.id, tier: tier, options: { mode: mode } }), cv = T.constraintView(p), tr = T.trace(p, {}), rp = T.replay(p), s = T.newState(p);
      if (!cv.summary || !cv.variables.length || !cv.constraints.length || !cv.sections || !cv.sections.length || cv.variables.some(function (v) { return !v.name || !v.domain; }) || /\b(undefined|null|NaN)\b/.test(J(cv))) bad.push([sz.id, tier, mode]);
      if (tr.kind !== "tree" || !tr.nodes.length || tr.nodes.length > 600 || tr.nodes[0].parent !== -1 || tr.nodes.some(function (nd) { return !["ok", "fail", "dead", "solution"].includes(nd.status); }) || /\b(undefined|null|NaN)\b/.test(J(tr))) trBad.push([sz.id, tier, mode, tr.nodes.length]);
      rp.forEach(function (st) { G.applyDiff(s, st.diff.d, false); });
      if (!rp.length || !T.check(p, s).solved || rp.some(function (st) { return !st.text || !st.why || !st.why.length || /\b(undefined|null|NaN)\b/.test(st.text + st.why.join(" ")); }) || rp[rp.length - 1].diff.d.length === 0) rpBad.push([sz.id, tier, mode]);
      for (var i = 0; i < p.data.n; i++) if (!/^(Chồng|Xu) \d+/.test(T.describeCell(p, s, i)) || /\b(undefined|null|NaN)\b/.test(T.describeCell(p, s, i))) dcBad.push([sz.id, i]);
    }); }); });
    t.ok("constraintView: summary, biến, ràng buộc, sections — 16 đề", bad.length === 0, bad.slice(0, 2));
    t.ok("trace: cây ≤ 600 nút, gốc parent −1, status hợp lệ — 16 đề", trBad.length === 0, trBad.slice(0, 2));
    t.ok("replay: áp tuần tự ra state solved; mỗi bước có text + why; bước cuối là kết luận — 16 đề", rpBad.length === 0, rpBad.slice(0, 2));
    t.ok("describeCell: 'Chồng/Xu i…' không rác", dcBad.length === 0, dcBad.slice(0, 2));
    t.ok("trace cỡ lớn nhất: chong 40 chồng c = 2, k = 4 và hailoai n = 6 vẫn ≤ 600 nút, nhanh", (function () { var a = T.trace(fromIn(stackIn(40, 2, 4, "adv", null)), {}), b = T.trace(fromIn(twoIn(6, 4, "adv", null)), {}); return a.nodes.length <= 600 && b.nodes.length <= 600 && b.nodes.length > 20; })());
    t.ok("replay hailoai: mọi bước cân nêu 'CÓ BAO NHIÊU xu nặng'; có bước nêu vì sao nhóm lân cận hỏng (n = 5 và n = 4)", [twoIn(5, 4, "adv", null), twoIn(4, 3, "adv", null)].every(function (inp) { var rp = T.replay(fromIn(inp)); return rp.slice(0, -1).every(function (st) { return /CÓ BAO NHIÊU xu nặng/.test(st.why[0]); }) && rp.some(function (st) { return st.why.some(function (w) { return /^Vì sao không/.test(w); }); }); }));
  })();

  // ====================================================================== 13. phép cân tối ưu = cân bằng; giải thích chữ
  t.group("coinscale — chữ giải thích đúng số: lớp 'N ≤ B' có N ≤ B; số đọc gam trong chữ khớp vật lý");
  (function () {
    var bad = [];
    [stackIn(10, 2, 3), stackIn(27, 2, 3), stackIn(16, 1, 4), stackIn(40, 2, 4)].forEach(function (inp) {
      var p = fromIn(Object.assign({}, inp, { mode: "adv", secret: null })), d = p.data, T0 = L.fullSet(d), rb = L.bestWeighing(d, T0, d.k), B = Math.pow(d.c + 1, d.k - 1);
      var sizes = rb.parts.map(function (q) { return q.T.length; });
      if (Math.max.apply(null, sizes) > B || sizes.reduce(function (a, b) { return a + b; }, 0) !== d.n) bad.push([J(inp), sizes, B]);
      var rp = T.replay(p)[0].why;
      rp.slice(1).forEach(function (line) { var m = /: chồng \{[^}]*\} — (\d+) chồng(?: ≤ (\d+))?/.exec(line); if (m && m[2] && Number(m[1]) > Number(m[2])) bad.push([J(inp), line]); });
    });
    t.ok("chong: các lớp của phép cân đầu đều ≤ (c+1)^(k−1), tổng = n; dòng 'N chồng ≤ B' có N ≤ B", bad.length === 0, bad.slice(0, 3));
    var bad2 = [];
    [twoIn(4, 3), twoIn(5, 4), twoIn(6, 4)].forEach(function (inp) {
      var p = fromIn(Object.assign({}, inp, { mode: "adv", secret: null })), d = p.data, s = T.newState(p), h = T.hint(p, s, 3), set = d.n && L.wFromAction(d, h.action);
      h.why.forEach(function (line) { var m = /^Nếu (\d+) g \((\d+) xu nặng\): (\d+) khả năng/.exec(line); if (m) { var cnt = L.POP[set]; if (Number(m[1]) !== cnt * 9 + Number(m[2])) bad2.push([J(inp), line]); var real = 0; allVecs(d.n).forEach(function (v) { if (physTwo(bits(set, d.n), v) === Number(m[1])) real++; }); if (real !== Number(m[3])) bad2.push([J(inp), line, real]); } });
    });
    t.ok("hailoai: mỗi dòng 'Nếu G g (j xu nặng): q khả năng' có G = 9·|nhóm| + j và q = số vectơ cho đúng G gam (đếm vật lý)", bad2.length === 0, bad2.slice(0, 3));
  })();

  // ====================================================================== 14. nhãn, Daily, engine thuần
  t.group("coinscale — CHƯA vào Daily (việc của P8)");
  (function () {
    var D = Puz.daily;
    if (!D) { t.ok("core/daily.js có trong ngữ cảnh kiểm", false); return; }
    var types = Puz.types.all().map(function (d) { return d.id; }), bad = [], day = "2026-10-01", n = 0;
    for (var i = 0; i < 800; i++) { var f = D.forDay(day, types); n++; if (!f || f.type === "coinscale") bad.push(day); day = Puz.util.addDays(day, 1); }
    t.ok("Puz.daily.ORDER và mọi phiên bản SCHEDULE không có coinscale; 800 ngày liên tiếp không ngày nào ra coinscale (" + n + " ngày)", D.ORDER.indexOf("coinscale") < 0 && D.SCHEDULE.every(function (v) { return v.ids.indexOf("coinscale") < 0; }) && bad.length === 0, bad.slice(0, 2));
  })();
  t.group("coinscale — nhãn HUD đúng với bộ đếm THẬT của vỏ + sizeText cho đề tự nhập");
  (function () {
    var p = fromIn(stackIn(10, 9, 1, "fixed", 3)), g = G.create(p, {});
    g.act({ k: "weigh", take: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }); g.act({ k: "truncate", n: 0 });
    t.ok("chip 'Số thao tác' = số lần gọi act (hoàn tác/mở lại không làm giảm), khác số lần cân trong state", g.counters.moves === 2 && plan.count(g.state) === 0 && /thao tác/.test(T.moveLabel));
    t.ok("sizeText: đề tự nhập hiện '10 chồng × 9 xu · 1 lần cân' / '5 xu hai loại · 4 lần cân'; đề hỏng → rỗng", T.sizeText(p) === "10 chồng × 9 xu · 1 lần cân" && T.sizeText(fromIn(twoIn(5, 4))) === "5 xu hai loại · 4 lần cân" && T.sizeText(null) === "" && T.sizeText({ data: { form: "stack" } }) === "");
  })();
  t.group("coinscale — engine thuần");
  (function () {
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/coinscale.js"), "utf8");
    t.ok("không dùng Math.random / Date / performance.now / DOM / Puz.text / Puz.ui / localStorage trong engine", !/Math\.random|Date\.now|new Date|performance\.now|document\.|window\.|localStorage|Puz\.text|Puz\.ui|Puz\.stats/.test(src));
    t.ok("ES5: không class / mũi tên / template literal", !/\bclass\s+\w|=>|`/.test(src));
  })();
};
