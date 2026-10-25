/* kiem/coinbalance.js — kiểm CÂN ĐỒNG XU (CW1, đợt P3). Nguồn sự thật ĐỘC LẬP với DP đếm lớp (u,h,l,g) của engine:
     · VÉT CẠN TƯỜNG MINH: mỗi xu gán trái/phải/ngoài (3^C cách, |trái| = |phải|), tập GIẢ THUYẾT (xu, hướng) lọc bằng phép so sánh khối lượng — không dùng lớp xu, không dùng cận 3^k;
       n ≤ 5, k ≤ 3, đủ các phiên bản (biết nặng · nặng/nhẹ phải nói hướng · chỉ tìm xu) × có/không xu chuẩn;
     · VÉT CẠN Ở MỨC TẬP GIẢ THUYẾT (chỉ giả định các xu cùng "chữ ký" thay thế được cho nhau — chính giả định đã được vét cạn tường minh ở trên kiểm chứng) cho biên 3^k, (3^k−3)/2, (3^k−1)/2, (3^k+1)/2 tới k = 3
       (k = 4: 39 / 40 / 41 theo định lý Dyson — [tài liệu], chỉ kiểm bằng DP của engine);
     · MÔ PHỎNG VẬT LÝ: xu thật 100 g, giả nặng 101 g, giả nhẹ 99 g; kết quả cân = so tổng khối lượng. Oracle cố định, tập giả thuyết còn nhất quán, lớp xu của engine và đối thủ đều đối chiếu với nó;
     · ĐẦU CUỐI: với MỌI xu giả có thể (2n khả năng) chiến lược tối ưu của engine tìm đúng xu (và hướng) trong ≤ k lần cân.
   Công thức trong thiết kế (Dyson: 3^k, (3^k−3)/2, (3^k−1)/2, (3^k+1)/2) chỉ được dùng như bảng đối chiếu; sự thật là phép vét cạn. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("coinbalance"), L = T.lib, G = Puz.game, plan = Puz.plan, R = Puz.rng, GR = Puz.grade;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"], MODES = ["fixed", "adv"];
  function J(x) { return JSON.stringify(x); }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function lay(p) { return L.layoutOf(p.data); }
  function apply(p, s, a) { var d = T.moveFor(p, s, a); if (!d) return null; G.applyDiff(s, d.d, false); return d; }
  function press(p) { return { p: p, s: T.newState(p) }; }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function inBand(score, tier) { var b = Puz.util.tier(tier); return score >= b.min && score < b.max; }
  function mkInput(prm, mode, secret) { return { n: prm.n, k: prm.k, fake: prm.fake, ref: prm.ref, dir: prm.dir, mode: mode || "fixed", secret: secret || null }; }
  function fromIn(i) { var r = T.fromInput(i); return r.ok ? r.puzzle : null; }

  // ====================================================================== nguồn độc lập 1: vét cạn tường minh
  /** Tập giả thuyết [xu, dir] (dir 1 = nặng, −1 = nhẹ). */
  function hyps0(n, fake) { var H = []; for (var c = 0; c < n; c++) { H.push([c, 1]); if (fake === "either") H.push([c, -1]); } return H; }
  /** Kết quả cân bằng so sánh KHỐI LƯỢNG: 1 trái nặng hơn, 2 cân bằng, 3 phải nặng hơn. side[i] ∈ {0,1,2}. */
  function weigh(side, coin, dir) {
    var l = 0, r = 0;
    for (var i = 0; i < side.length; i++) { var wgt = i === coin ? 100 + dir : 100; if (side[i] === 1) l += wgt; else if (side[i] === 2) r += wgt; }
    return l > r ? 1 : l === r ? 2 : 3;
  }
  function bruteSolvable(n, ref, fake, needDir, k) {
    var coins = n + ref, memo = {}, total = Math.pow(3, coins);
    function term(H) { if (H.length <= 1) return true; if (needDir) return false; for (var i = 1; i < H.length; i++) if (H[i][0] !== H[0][0]) return false; return true; }
    function rec(H, r) {
      if (term(H)) return true;
      if (r === 0) return false;
      var key = J(H) + "/" + r; if (memo[key] !== undefined) return memo[key];
      var ok = false;
      for (var a = 0; a < total && !ok; a++) {
        var x = a, side = [], nl = 0, nr = 0, i;
        for (i = 0; i < coins; i++) { var sd = x % 3; side.push(sd); if (sd === 1) nl++; else if (sd === 2) nr++; x = Math.floor(x / 3); }
        if (nl !== nr || nl === 0) continue;
        var parts = { 1: [], 2: [], 3: [] };
        H.forEach(function (hy) { parts[weigh(side, hy[0], hy[1])].push(hy); });
        ok = [1, 2, 3].every(function (o) { return !parts[o].length || rec(parts[o], r - 1); });
      }
      memo[key] = ok; return ok;
    }
    return rec(hyps0(n, fake), k);
  }

  // ====================================================================== nguồn độc lập 2: vét cạn mức tập giả thuyết (xu cùng chữ ký thay thế được cho nhau)
  /** H0 (tuỳ chọn): bắt đầu từ MỘT TẬP GIẢ THUYẾT cho trước (thế giữa ván, lọc bằng mô phỏng vật lý) thay cho tập đầy đủ — để kiểm "thế hiện tại còn thắng chắc không" độc lập với DP đếm lớp. */
  function setSolvable(n, ref, fake, needDir, k, H0) {
    var memo = {};
    function sig(H, coins) { var s = []; for (var c = 0; c < coins; c++) s.push({ h: false, l: false }); H.forEach(function (hy) { if (hy[1] === 1) s[hy[0]].h = true; else s[hy[0]].l = true; }); return s; }
    function term(H) { if (H.length <= 1) return true; if (needDir) return false; for (var i = 1; i < H.length; i++) if (H[i][0] !== H[0][0]) return false; return true; }
    function rec(H, r) {
      if (term(H)) return true;
      if (r === 0) return false;
      var coins = n + ref, sg = sig(H, coins), groups = { U: [], Hh: [], Ll: [], Gg: [] };
      sg.forEach(function (s, c) { (s.h && s.l ? groups.U : s.h ? groups.Hh : s.l ? groups.Ll : groups.Gg).push(c); });
      var key = [groups.U.length, groups.Hh.length, groups.Ll.length, Math.min(groups.Gg.length, H.length), r].join(",");
      if (memo[key] !== undefined) return memo[key];
      var names = ["U", "Hh", "Ll", "Gg"], ok = false;
      (function pick(gi, side, nl, nr) {
        if (ok) return;
        if (gi === 4) {
          if (nl !== nr || nl === 0) return;
          var parts = { 1: [], 2: [], 3: [] };
          H.forEach(function (hy) { parts[weigh(side, hy[0], hy[1])].push(hy); });
          ok = [1, 2, 3].every(function (o) { return !parts[o].length || rec(parts[o], r - 1); });
          return;
        }
        var g = groups[names[gi]];
        for (var a = 0; a <= g.length; a++) for (var b = 0; a + b <= g.length; b++) {
          if (ok) return;
          var s2 = side.slice(), i;
          for (i = 0; i < a; i++) s2[g[i]] = 1;
          for (i = 0; i < b; i++) s2[g[a + i]] = 2;
          pick(gi + 1, s2, nl + a, nr + b);
        }
      })(0, zeros(coins), 0, 0);
      memo[key] = ok; return ok;
    }
    return rec(H0 || hyps0(n, fake), k);
  }
  function maxBy(f, k, hi) { var best = 0; for (var n = 1; n <= hi; n++) if (f(n, k)) best = n; return best; }

  // ====================================================================== mô phỏng vật lý trên log của engine
  function recsOf(p, s) { return plan.read(s, lay(p)); }
  /** Mọi giả thuyết (xu, dir) nhất quán với MỌI lần cân đã ghi (so khối lượng). */
  function consistent(p, s) {
    var d = p.data, C = d.n + d.ref, out = [], recs = recsOf(p, s);
    hyps0(d.n, d.fake).forEach(function (hy) { if (recs.every(function (r) { return weigh(r.slice(0, C), hy[0], hy[1]) === r[C]; })) out.push(hy); });
    return out;
  }
  function randomWeighing(p, s, rng) {
    var d = p.data, C = d.n + d.ref, pool = [], i, m, a = [], b = [];
    for (i = 0; i < C; i++) pool.push(i);
    rng.shuffle(pool); m = 1 + rng.int(Math.max(1, Math.floor(C / 2)));
    for (i = 0; i < m; i++) { a.push(pool[i]); b.push(pool[m + i]); }
    return { k: "weigh", L: a.sort(function (x, y) { return x - y; }), R: b.sort(function (x, y) { return x - y; }) };
  }

  // ====================================================================== 0. đăng ký + siêu dữ liệu
  t.group("coinbalance — đăng ký, siêu dữ liệu");
  t.ok("loại đã đăng ký, tuân giao diện, kind interactive, objective min 'lần'", !!T && Puz.types.conformance(T).length === 0 && Puz.types.kindOf(T) === "interactive" && T.objective.sense === "min" && T.objective.unit === "lần", Puz.types.conformance(T));
  t.ok("nhãn: sizeLabel 'Phiên bản', moveLabel nói 'thao tác', mistakeLabel nói 'sai sót' (xem nhóm 'sửa sau kiểm')", T.sizeLabel === "Phiên bản" && /thao tác/.test(T.moveLabel) && /Sai sót/.test(T.mistakeLabel));
  t.ok("options: mode fixed (mặc định) | adv", T.options.length === 1 && T.options[0].id === "mode" && T.options[0].default === "fixed" && T.options[0].choices.map(function (c) { return c.id; }).join() === "fixed,adv");
  t.ok("6 phiên bản, đúng một mặc định (nn3), mỗi phiên bản quảng cáo đủ 4 bậc", T.sizes.length === 6 && T.sizes.filter(function (s) { return s.default; }).length === 1 && T.sizes.filter(function (s) { return s.default; })[0].id === "nn3" && T.sizes.every(function (s) { return J(s.tiers) === J(TIERS); }));
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }), text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 3 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("chữ tiếng Việt (luật, thuật toán, ghi chú): không rỗng, không undefined/null/NaN", T.rules.concat(T.algorithm.steps.map(function (s) { return s.title + s.text; }), [T.blurb, T.difficultyNote]).every(function (x) { return typeof x === "string" && x.trim() && !/\b(undefined|null|NaN)\b/.test(x); }));

  // ====================================================================== 1. lõi toán: vét cạn tường minh
  t.group("coinbalance — DP đối chiếu vét cạn TƯỜNG MINH (n ≤ 5, k ≤ 3)");
  (function () {
    var checked = 0, bad = [], t0 = Date.now(), variants = [["heavy", false], ["either", true], ["either", false]];
    for (var n = 2; n <= 5; n++) for (var k = 1; k <= 3; k++) [0, 1].forEach(function (ref) { variants.forEach(function (v) {
      var d = { n: n, k: k, fake: v[0], ref: ref, dir: v[1] ? 1 : 0 }, bf = bruteSolvable(n, ref, v[0], v[1], k), dp = L.bestK(d) <= k;
      checked++; if (bf !== dp) bad.push([n, k, ref, v[0], v[1], "bf", bf, "dp", dp]);
    }); });
    t.ok("DP = vét cạn tường minh trên " + checked + " trường hợp (" + (Date.now() - t0) + " ms)", checked >= 72 && bad.length === 0, bad.slice(0, 4));
    t.ok("n = 2, 3 không giải được khi phải nói hướng và không có xu chuẩn (3 lần): vét cạn và DP cùng 'không' ở n = 2", !bruteSolvable(2, 0, "either", true, 3) && L.bestK({ n: 2, k: 3, fake: "either", ref: 0, dir: 1 }) > 3);
    t.ok("12 xu / 3 lần giải được, 13 xu / 3 lần KHÔNG (dù 26 ≤ 27 khả năng) — cận thông tin không đủ", setSolvable(12, 0, "either", true, 3) === true && setSolvable(13, 0, "either", true, 3) === false && L.bestK({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }) === 3 && L.bestK({ n: 13, k: 3, fake: "either", ref: 0, dir: 1 }) > 3);
  })();

  t.group("coinbalance — biên số xu (vét cạn mức tập giả thuyết; k = 4 theo định lý Dyson [tài liệu])");
  (function () {
    var rows = [
      ["biết nặng", function (n, k) { return setSolvable(n, 0, "heavy", false, k); }, "heavy", 0, 0, function (k) { return Math.pow(3, k); }],
      ["nặng/nhẹ + hướng", function (n, k) { return setSolvable(n, 0, "either", true, k); }, "either", 0, 1, function (k) { return (Math.pow(3, k) - 3) / 2; }],
      ["nặng/nhẹ + hướng + xu chuẩn", function (n, k) { return setSolvable(n, 1, "either", true, k); }, "either", 1, 1, function (k) { return (Math.pow(3, k) - 1) / 2; }],
      ["chỉ tìm xu", function (n, k) { return setSolvable(n, 0, "either", false, k); }, "either", 0, 0, function (k) { return (Math.pow(3, k) - 1) / 2; }],
      ["chỉ tìm xu + xu chuẩn", function (n, k) { return setSolvable(n, 1, "either", false, k); }, "either", 1, 0, function (k) { return (Math.pow(3, k) + 1) / 2; }]];
    rows.forEach(function (row) {
      var got = [], eng = [], engLarge = [];
      for (var k = 1; k <= 3; k++) {
        var hi = row[5](k) + 1, bf = maxBy(row[1], k, hi), en = 0;                      // quét n = 1…(biên công thức + 1): n > biên + 1 chỉ có thể "không" (đơn điệu — đã thấy ở biên + 1)
        for (var n = 1; n <= hi + 3; n++) if (L.bestK({ n: n, k: k, fake: row[2], ref: row[3], dir: row[4] }) <= k) en = n;
        got.push(bf); eng.push(en);
      }
      for (var k4 = 4; k4 <= 4; k4++) { var e4 = 0; for (var m = 1; m <= 90; m++) if (L.bestK({ n: m, k: k4, fake: row[2], ref: row[3], dir: row[4] }) <= k4) e4 = m; engLarge.push(e4); }
      var want = [1, 2, 3].map(row[5]), want4 = row[5](4);
      t.ok(row[0] + ": số xu tối đa k = 1…3 vét cạn = " + J(got) + ", DP = " + J(eng) + ", công thức = " + J(want), J(got) === J(eng) && J(got) === J(want), [got, eng, want]);
      t.ok(row[0] + ": k = 4 → DP " + engLarge[0] + " = công thức Dyson " + want4, engLarge[0] === want4, [engLarge, want4]);
    });
    t.ok("mọi phiên bản quảng cáo: n ∈ [nMin, nMax] cần ĐÚNG k lần (ngân sách vừa khít), nMin−1 cần ít hơn k lần, nMax là biên, nMax+1 vô nghiệm", T.sizes.every(function (sz) {
      var pr = sz.params, ok = true;
      for (var n = pr.nMin; n <= pr.nMax; n++) ok = ok && L.bestK({ n: n, k: pr.k, fake: pr.fake, ref: pr.ref, dir: pr.dir }) === pr.k;
      return ok && L.bestK({ n: pr.nMin - 1, k: pr.k, fake: pr.fake, ref: pr.ref, dir: pr.dir }) < pr.k && L.bestK({ n: pr.nMax + 1, k: pr.k, fake: pr.fake, ref: pr.ref, dir: pr.dir }) > pr.k;
    }));
  })();

  t.group("coinbalance — hiệu năng DP");
  L.resetMemo();
  t.time("DP lạnh: 39 xu / 4 lần (nặng/nhẹ + hướng) + phép cân tốt nhất ≤ 400 ms", 400, function () { return L.bestWeighing({ u: 39, h: 0, l: 0, g: 0 }, 4, 0); });
  L.resetMemo();
  t.time("DP lạnh: 40 xu + xu chuẩn / 4 lần ≤ 400 ms", 400, function () { return L.bestWeighing({ u: 40, h: 0, l: 0, g: 1 }, 4, 0); });
  t.time("DP: 81 xu biết nặng / 4 lần ≤ 200 ms", 200, function () { return L.bestWeighing({ u: 0, h: 81, l: 0, g: 0 }, 4, 0); });
  t.time("DP: chứng minh 40 xu / 4 lần (không chuẩn) KHÔNG giải được ≤ 400 ms", 400, function () { return L.bestK({ n: 40, k: 4, fake: "either", ref: 0, dir: 1 }); });

  // ====================================================================== 2. đề: sinh, tất định, bậc
  t.group("coinbalance — generate: tất định, bậc, ngân sách vừa khít");
  (function () {
    var detBad = [], bandBad = [], solBad = [], budBad = [], optBad = [], n = 0, slow = 0, times = [];
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { MODES.forEach(function (mode) {
      var scores = [];
      for (var seed = 1; seed <= 20; seed++) {
        var o = { sizeId: sz.id, tier: tier, options: mode === "adv" ? { mode: "adv" } : {} }, t0 = Date.now(), a = T.generate(seed * 104729 + 17, o), ms = Date.now() - t0;
        times.push(ms); if (ms > 1500) slow++;
        n++;
        if (J(a) !== J(T.generate(seed * 104729 + 17, o))) detBad.push([sz.id, tier, mode, seed]);
        scores.push(a.score);
        if (!inBand(a.score, tier) || a.tier !== tier) bandBad.push([sz.id, tier, mode, seed, a.score, a.tier]);
        if (!a.solution || !T.check(a, { v: a.solution.v, c: null }).solved) solBad.push([sz.id, tier, mode, seed]);
        if (L.bestK(a.data) !== a.data.k || a.data.n < sz.params.nMin || a.data.n > sz.params.nMax) budBad.push([sz.id, tier, mode, seed, a.data.n]);
        if (J(a.options) !== (mode === "adv" ? '{"mode":"adv"}' : "{}") || a.sizeId !== sz.id || !(mode === "adv" ? a.data.secret === null : a.data.secret && a.data.secret.coin < a.data.n)) optBad.push([sz.id, tier, mode, seed]);
      }
    }); }); });
    t.ok("tất định: " + n + " đề sinh hai lần giống hệt từng bit", detBad.length === 0, detBad.slice(0, 3));
    t.ok("điểm trong khoảng bậc ở 100 % của " + n + " đề (6 phiên bản × 4 bậc × 2 chế độ × 20 seed; yêu cầu ≥ 90 %) và puzzle.tier đúng bậc", bandBad.length === 0, bandBad.slice(0, 4));
    t.ok("solution.v giải xong đề (check.solved) ở mọi đề", solBad.length === 0, solBad.slice(0, 3));
    t.ok("ngân sách k vừa khít: k* = k và n nằm trong [nMin, nMax] của phiên bản", budBad.length === 0, budBad.slice(0, 3));
    t.ok("puzzle.options gọn đúng; chế độ cố định có xu giả hợp lệ, chế độ đối thủ không có secret", optBad.length === 0, optBad.slice(0, 3));
    t.ok("sinh đề: tối đa " + Math.max.apply(null, times) + " ms, không đề nào > 1,5 s", slow === 0);
    var mono = T.sizes.map(function (sz) { var avg = TIERS.map(function (tier) { var s = []; for (var seed = 1; seed <= 20; seed++) s.push(T.generate(seed, { sizeId: sz.id, tier: tier }).score); return mean(s); }); return avg; });
    t.ok("điểm trung bình đơn điệu theo bậc (Dễ < Vừa < Khó < Chuyên gia) ở cả 6 phiên bản", mono.every(function (a) { return a[0] < a[1] && a[1] < a[2] && a[2] < a[3]; }), mono);
    var d1 = T.generate(5, { sizeId: "nn3", tier: "easy" }), d2 = T.generate(5, { sizeId: "nn3", tier: "easy", options: { mode: "fixed" } }), d3 = T.generate(5, { sizeId: "nn3", tier: "easy", options: { mode: "adv" } });
    t.ok("lựa chọn = mặc định tường minh ⇒ cùng puzzle với không truyền; adv ⇒ id khác", J(d1) === J(d2) && d1.id !== d3.id && d3.options.mode === "adv" && d3.data.mode === "adv");
    t.ok("điểm đối thủ cao hơn cố định cùng (phiên bản, n) — chế độ adv cộng điểm", L.scoreOf({ n: 12, k: 3, fake: "either", ref: 0, dir: 1, mode: "adv" }) > L.scoreOf({ n: 12, k: 3, fake: "either", ref: 0, dir: 1, mode: "fixed" }));
    t.ok("khoá lạ / bậc lạ / kích cỡ lạ không làm sinh đề ném lỗi (rơi về mặc định)", (function () { try { var p = T.generate(1, { sizeId: "khong-co", tier: "x", options: { mode: "zzz", rác: 1 } }); return p.sizeId === "nn3" && p.options && J(p.options) === "{}"; } catch (e) { return false; } })());
  })();
  t.group("coinbalance — thời gian sinh đề");
  T.sizes.forEach(function (sz) {
    var worst = 0, med = [];
    TIERS.forEach(function (tier) { for (var seed = 1; seed <= 5; seed++) { var t0 = Date.now(); T.generate(seed * 31, { sizeId: sz.id, tier: tier, options: { mode: "adv" } }); var ms = Date.now() - t0; worst = Math.max(worst, ms); med.push(ms); } });
    med.sort(function (a, b) { return a - b; });
    t.ok(sz.id + ": sinh 20 đề đối thủ — trung vị " + med[10] + " ms ≤ 1500, xấu nhất " + worst + " ms ≤ 4000", med[10] <= 1500 * t.slack && worst <= 4000 * t.slack);
  });

  // ====================================================================== 3. oracle: vật lý, nhất quán, tất định
  t.group("coinbalance — oracle cố định = mô phỏng khối lượng; lớp xu = tập giả thuyết nhất quán");
  (function () {
    var rng = R.create(2026), badOracle = [], badCls = [], runs = 0, steps = 0;
    T.sizes.forEach(function (sz) {
      for (var seed = 1; seed <= 12; seed++) {
        var p = T.generate(seed * 977, { sizeId: sz.id, tier: TIERS[seed % 4] }), st = T.newState(p), d = p.data, C = d.n + d.ref;
        runs++;
        for (var step = 0; step < d.k; step++) {
          var a = randomWeighing(p, st, rng), diff = apply(p, st, a);
          if (!diff) { badOracle.push(["moveFor null", sz.id, seed]); break; }
          steps++;
          var rec = recsOf(p, st)[step], side = rec.slice(0, C), want = weigh(side, d.secret.coin, d.secret.heavy ? 1 : -1);
          if (rec[C] !== want) badOracle.push([sz.id, seed, step, rec[C], want]);
          // lớp xu của engine = tập giả thuyết nhất quán (vật lý)
          var cons = consistent(p, st), cls = L.classesOf(d, st), eng = [];
          cls.forEach(function (c, i) { if (i >= d.n) return; if (c === L.CU || c === L.CH) eng.push(i + ":h"); if (c === L.CU || c === L.CL) eng.push(i + ":l"); });
          var phys = cons.map(function (hy) { return hy[0] + ":" + (hy[1] === 1 ? "h" : "l"); });
          if (J(eng.sort()) !== J(phys.sort()) || !phys.length) badCls.push([sz.id, seed, step, eng.length, phys.length]);
        }
      }
    });
    t.ok("oracle cố định khớp mô phỏng khối lượng trên " + steps + " lần cân ngẫu nhiên của " + runs + " đề", badOracle.length === 0 && steps > 200, badOracle.slice(0, 3));
    t.ok("lớp xu engine (U/H/L/G) = đúng tập giả thuyết nhất quán theo vật lý sau MỖI lần cân", badCls.length === 0, badCls.slice(0, 3));
  })();

  t.group("coinbalance — oracle đối thủ: luôn nhất quán, tất định, không để lọt khi đi sai");
  (function () {
    var rng = R.create(77), incons = [], notDet = [], leaked = [], leakedN = 0, safeBad = [], safeN = 0;
    T.sizes.forEach(function (sz) {
      for (var seed = 1; seed <= 14; seed++) {
        var p = T.generate(seed * 1303, { sizeId: sz.id, tier: TIERS[seed % 4], options: { mode: "adv" } }), d = p.data, goal = L.goalFor(d), C = d.n + d.ref;
        // (a) chơi NGẪU NHIÊN tới hết lượt: luôn nhất quán; thế đã mất (không giải được) thì tới cuối vẫn còn ≥ 2 khả năng
        var st = T.newState(p), lost = false, i;
        for (i = 0; i < d.k; i++) {
          var cls = L.classesOf(d, st), cnt = L.countsOf(cls);
          if (!L.solv(cnt.u, cnt.h, cnt.l, cnt.g, L.budget(d, st), goal)) lost = true;
          var a = randomWeighing(p, st, rng), snap = st.v.slice();
          apply(p, st, a);
          var again = { v: snap.slice(), c: null }; apply(p, again, a);
          if (J(again.v) !== J(st.v)) notDet.push([sz.id, seed, i]);
          if (!consistent(p, st).length) incons.push([sz.id, seed, i]);
        }
        var fin = consistent(p, st), coins = {}; fin.forEach(function (hy) { coins[hy[0]] = 1; });
        if (lost) { leakedN++; if (goal ? Object.keys(coins).length < 2 : fin.length < 2) leaked.push([sz.id, seed, fin.length]); }
        // (b) chơi AN TOÀN (chọn ngẫu nhiên trong các phép cân an toàn): đối thủ không thể ngăn kết luận — cuối cùng chỉ còn đúng một khả năng
        var s2 = T.newState(p), ok = true;
        for (i = 0; i < d.k; i++) {
          var c2 = L.classesOf(d, s2), n2 = L.countsOf(c2);
          var safe = L.safeWeighings(n2, L.budget(d, s2), goal);
          if (!safe.length) break;
          var w = safe[rng.int(safe.length)].w, sol = L.coinsFor(c2, w);
          apply(p, s2, { k: "weigh", L: sol.L, R: sol.R });
        }
        var f2 = consistent(p, s2), co2 = {}; f2.forEach(function (hy) { co2[hy[0]] = 1; });
        safeN++;
        if (goal ? Object.keys(co2).length !== 1 : f2.length !== 1) safeBad.push([sz.id, seed, f2.length]);
      }
    });
    t.ok("đối thủ không bao giờ mâu thuẫn: ≥ 1 giả thuyết vật lý nhất quán sau mỗi lần cân ngẫu nhiên (84 ván)", incons.length === 0, incons.slice(0, 3));
    t.ok("đối thủ tất định: áp lại cùng lần cân từ cùng lịch sử cho đúng cùng kết quả", notDet.length === 0, notDet.slice(0, 3));
    t.ok("thế đã mất (có lần cân không an toàn) ⇒ đối thủ giữ ≥ 2 khả năng tới HẾT lượt (" + leakedN + " ván có thế mất)", leaked.length === 0, leaked.slice(0, 3));
    t.ok("chơi toàn phép cân an toàn ⇒ cuối ván chỉ còn đúng một khả năng dù đối thủ chọn nhánh khó nhất (" + safeN + " ván)", safeBad.length === 0, safeBad.slice(0, 3));
  })();

  t.group("coinbalance — đầu cuối: MỌI xu giả có thể đều bị chiến lược tối ưu tìm ra");
  (function () {
    var bad = [], total = 0, t0 = Date.now(), cfgs = [
      { n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 13, k: 3, fake: "either", ref: 1, dir: 1 }, { n: 13, k: 3, fake: "either", ref: 0, dir: 0 }, { n: 9, k: 2, fake: "heavy", ref: 0, dir: 0 },
      { n: 27, k: 3, fake: "heavy", ref: 0, dir: 0 }, { n: 8, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 39, k: 4, fake: "either", ref: 0, dir: 1 }, { n: 4, k: 3, fake: "either", ref: 0, dir: 1 }];
    cfgs.forEach(function (c) {
      for (var coin = 0; coin < c.n; coin++) [1, 0].forEach(function (hv) {
        if (c.fake === "heavy" && !hv) return;
        var p = fromIn(mkInput(c, "fixed", { coin: coin, heavy: hv }));
        if (!p) { bad.push(["fromInput", c.n, coin, hv]); return; }
        total++;
        var st = T.newState(p); T.replay(p).forEach(function (s) { G.applyDiff(st, s.diff.d, false); });
        var cn = L.concluded(p, st), cls = L.classesOf(p.data, st), nW = plan.count(st);
        var okDir = c.dir ? cn.dir === (hv ? 1 : 2) : true;
        if (!T.check(p, st).solved || cn.coin !== coin || !okDir || nW > c.k) bad.push([c.n, c.k, coin, hv, "nW", nW, cn]);
        // thế mất an toàn không xảy ra ở mọi lần cân của chiến lược tối ưu
        var s2 = T.newState(p), mis = 0; T.replay(p).forEach(function (s) { mis += T.mistakes(p, s2, { d: s.diff.d }); G.applyDiff(s2, s.diff.d, false); });
        if (mis) bad.push(["mistakes>0", c.n, coin, hv]);
      });
    });
    t.ok("chiến lược tối ưu của engine tìm ĐÚNG xu giả (và hướng) trong ≤ k lần cân, với MỌI xu giả cố định có thể — " + total + " ca (8 cấu hình), vật lý độc lập đã đối chiếu oracle", bad.length === 0 && total > 200, bad.slice(0, 4));
    t.info("đầu cuối " + total + " ca trong " + (Date.now() - t0) + " ms");
  })();

  // ====================================================================== 4. moveFor / check / mistakes
  t.group("coinbalance — moveFor: hợp lệ, đảo diff, dung lượng, ngân sách");
  (function () {
    var p = T.generate(11, { sizeId: "nn3", tier: "medium" }), s = T.newState(p), d = p.data, LL = lay(p), C = d.n + d.ref;
    t.ok("moveFor từ chối: tập rỗng, hai đĩa lệch số xu, trùng xu, xu ngoài khoảng, kiểu lạ, null, kết luận thiếu hướng", [
      { k: "weigh", L: [], R: [] }, { k: "weigh", L: [0, 1], R: [2] }, { k: "weigh", L: [0], R: [0] }, { k: "weigh", L: [0, 0], R: [1, 2] }, { k: "weigh", L: [-1], R: [1] }, { k: "weigh", L: [0], R: [C] }, { k: "weigh", L: "a", R: "b" },
      { k: "weigh" }, { k: "lạ" }, null, { k: "conclude", coin: 0 }, { k: "conclude", coin: d.n, heavy: true }, { k: "conclude", coin: 1.5, heavy: true }, { k: "truncate", n: 5 }, { k: "truncate", n: -1 }].every(function (a) { return T.moveFor(p, s, a) === null; }));
    var seen = [], st = T.newState(p), rng = R.create(5);
    for (var i = 0; i < d.k; i++) { var a = randomWeighing(p, st, rng), before = st.v.slice(), diff = T.moveFor(p, st, a); G.applyDiff(st, diff.d, false); seen.push([before, diff]); if (!plan.valid(st, LL)) seen.push("invalid"); }
    t.ok("mỗi lần cân là MỘT diff, trạng thái luôn plan.valid, " + d.k + " lần cân ghi đúng " + d.k + " bản ghi", seen.indexOf("invalid") < 0 && plan.count(st) === d.k);
    var rev = st.v.slice(); for (i = seen.length - 1; i >= 0; i--) { if (seen[i] === "invalid") continue; G.applyDiff({ v: rev, c: null }, G.reverseDiff(seen[i][1].d), false); }
    t.ok("hoàn lại bằng reverseDiff ra đúng trạng thái đầu", J(rev) === J(T.newState(p).v));
    t.ok("hết ngân sách k = " + d.k + ": weigh trả null (không ném lỗi); vẫn kết luận và quay về (truncate) được", T.moveFor(p, st, { k: "weigh", L: [0], R: [1] }) === null && !!T.moveFor(p, st, { k: "conclude", coin: 0, heavy: true }) && !!T.moveFor(p, st, { k: "truncate", n: 1 }));
    var s3 = T.newState(p); apply(p, s3, { k: "weigh", L: [0, 1], R: [2, 3] }); var c1 = apply(p, s3, { k: "conclude", coin: 5, heavy: false });
    t.ok("sau kết luận: weigh trả null; truncate n = len MỞ LẠI (xoá cờ + tham số) và áp lại được; truncate về 0 xoá hết", c1 && T.moveFor(p, s3, { k: "weigh", L: [4], R: [5] }) === null && (function () { var x = { v: s3.v.slice(), c: null }, dd = T.moveFor(p, x, { k: "truncate", n: 1 }); G.applyDiff(x, dd.d, false); var re = plan.isSubmitted(x) === false && plan.count(x) === 1 && plan.valid(x, LL); var z = T.moveFor(p, x, { k: "truncate", n: 0 }); G.applyDiff(x, z.d, false); return re && J(x.v) === J(T.newState(p).v); })());
    t.ok("conclude hai lần không được (đã nộp ⇒ null); conclude với hướng sai kiểu ('nặng' chuỗi) bị từ chối", (function () { var x = T.newState(p); apply(p, x, { k: "conclude", coin: 0, heavy: true }); return T.moveFor(p, x, { k: "conclude", coin: 1, heavy: false }) === null && T.moveFor(p, T.newState(p), { k: "conclude", coin: 0, heavy: "nặng" }) === null; })());
    t.ok("phiên bản 'chỉ tìm xu': conclude không cần hướng; 'biết nặng': cũng không cần", (function () { var q = T.generate(3, { sizeId: "tim3", tier: "easy" }), h = T.generate(3, { sizeId: "nang2", tier: "easy" }); return !!T.moveFor(q, T.newState(q), { k: "conclude", coin: 0 }) && !!T.moveFor(h, T.newState(h), { k: "conclude", coin: 0 }); })());
    t.ok("trạng thái khôi phục (JSON) + áp lại các lần cân cho đúng cùng kết quả (oracle tất định, cả hai chế độ)", MODES.every(function (mode) {
      var q = T.generate(21, { sizeId: "nn3", tier: "hard", options: { mode: mode } }), g1 = G.create(q, {}), r1 = R.create(9), acts = [];
      for (var j = 0; j < q.data.k; j++) { var a2 = randomWeighing(q, g1.state, r1); acts.push(a2); g1.act(a2); }
      var saved = JSON.parse(JSON.stringify(g1.serialize())), g2 = G.restore(saved, {}), g3 = G.create(q, {}); acts.forEach(function (a3) { g3.act(a3); });
      g1.undo(); g1.undo(); g1.redo(); g1.redo();
      return J(g2.state.v) === J(g1.state.v) && J(g3.state.v) === J(g1.state.v);
    }));
  })();

  t.group("coinbalance — check: chỉ tính khi kết luận bị lịch sử ÉP BUỘC; đoán may không tính");
  (function () {
    var c = { n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, pz = fromIn(mkInput(c, "fixed", { coin: 6, heavy: 0 }));
    var s0 = T.newState(pz);
    t.ok("chưa cân mà kết luận (kể cả ĐÚNG xu và hướng) không tính là giải", (function () { var s = { v: s0.v.slice(), c: null }; apply(pz, s, { k: "conclude", coin: 6, heavy: false }); var ck = T.check(pz, s); return !ck.solved && T.check(pz, s0).solved === false; })());
    // cân đúng theo chiến lược, nhưng kết luận sai xu / sai hướng ⇒ không tính, có xung đột nếu mâu thuẫn log
    var sol = T.newState(pz); T.replay(pz).slice(0, -1).forEach(function (st) { G.applyDiff(sol, st.diff.d, false); });
    var fin = L.concluded(pz, { v: pz.solution.v, c: null });
    var good = { v: sol.v.slice(), c: null }; apply(pz, good, { k: "conclude", coin: 6, heavy: false });
    var wrongDir = { v: sol.v.slice(), c: null }; apply(pz, wrongDir, { k: "conclude", coin: 6, heavy: true });
    var wrongCoin = { v: sol.v.slice(), c: null }; apply(pz, wrongCoin, { k: "conclude", coin: 0, heavy: false });
    t.ok("kết luận đúng xu + đúng hướng sau đủ lần cân ⇒ solved; sai hướng ⇒ không; sai xu ⇒ không", T.check(pz, good).solved && !T.check(pz, wrongDir).solved && !T.check(pz, wrongCoin).solved && fin.coin === 6 && fin.dir === 2);
    t.ok("kết luận sai hướng / sai xu mâu thuẫn với chính các lần cân ⇒ conflicts chỉ đúng xu đó", J(T.check(pz, wrongDir).conflicts) === J([6]) && J(T.check(pz, wrongCoin).conflicts) === J([0]) && T.check(pz, good).conflicts.length === 0);
    t.ok("check thuần: filled = số lần cân, total = số lần cân của lời giải, complete khi đã đủ thông tin", T.check(pz, good).filled === plan.count(sol) && T.check(pz, good).total === plan.count({ v: pz.solution.v }) && T.check(pz, good).complete === true && T.check(pz, s0).complete === false);
    // may mắn: 'cân bằng' ngay ở lần đầu rồi kết luận trong ván cố định, với đề mà xu giả cố định nằm ngoài đĩa — vẫn chưa ép buộc ⇒ không tính
    var lucky = fromIn(mkInput(c, "fixed", { coin: 10, heavy: 1 })), sl = T.newState(lucky); apply(lucky, sl, { k: "weigh", L: [0, 1, 2, 3], R: [4, 5, 6, 7] }); apply(lucky, sl, { k: "conclude", coin: 10, heavy: true });
    t.ok("ván cố định: cân 4–4 thăng bằng rồi 'đoán' đúng xu 11 nặng ⇒ KHÔNG tính (còn 8 khả năng)", !T.check(lucky, sl).solved && T.check(lucky, sl).conflicts.length === 0);
    // dùng mô phỏng vật lý độc lập để khẳng định: kết luận được tính ⇔ đúng một giả thuyết nhất quán và khớp
    var rng = R.create(31), disagree = [], tried = 0;
    for (var it = 0; it < 120; it++) {
      var pp = T.generate(it * 53 + 1, { sizeId: T.sizes[it % T.sizes.length].id, tier: TIERS[it % 4], options: { mode: MODES[it % 2] } }), st = T.newState(pp), nn = rng.int(pp.data.k + 1);
      for (var q = 0; q < nn; q++) apply(pp, st, randomWeighing(pp, st, rng));
      var cons = consistent(pp, st), coin = rng.int(pp.data.n), hv = rng.int(2) === 1, a = { k: "conclude", coin: coin }; if (pp.data.dir) a.heavy = hv;
      var s4 = { v: st.v.slice(), c: null }; apply(pp, s4, a); tried++;
      var coins = {}; cons.forEach(function (h2) { coins[h2[0]] = 1; });
      var want = pp.data.dir ? cons.length === 1 && cons[0][0] === coin && (cons[0][1] === 1) === hv : Object.keys(coins).length === 1 && coins[coin] === 1;
      if (T.check(pp, s4).solved !== want) disagree.push([it, pp.data.n, coin, hv, cons.length]);
    }
    t.ok("solved ⇔ (theo vật lý độc lập) kết luận khớp với DUY NHẤT giả thuyết còn nhất quán — " + tried + " tổ hợp ngẫu nhiên", disagree.length === 0, disagree.slice(0, 3));
  })();

  t.group("coinbalance — mistakes: lần cân làm mất khả năng thắng chắc");
  (function () {
    var p = fromIn(mkInput({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 3, heavy: 1 })), s = T.newState(p);
    function mis(st, a) { var d = T.moveFor(p, st, a); return T.mistakes(p, st, d); }
    t.ok("12 xu / 3 lần: 4–4 an toàn (0), 5–5 / 3–3 / 1–1 mất an toàn (1)", mis(s, { k: "weigh", L: [0, 1, 2, 3], R: [4, 5, 6, 7] }) === 0 && mis(s, { k: "weigh", L: [0, 1, 2, 3, 4], R: [5, 6, 7, 8, 9] }) === 1 && mis(s, { k: "weigh", L: [0, 1, 2], R: [3, 4, 5] }) === 1 && mis(s, { k: "weigh", L: [0], R: [1] }) === 1);
    t.ok("6–6 (hết 12 xu) mất an toàn; cân hai tập toàn xu cùng 'ngoài' vô ích (1 xu mỗi bên khi chỉ còn…) tính theo DP", mis(s, { k: "weigh", L: [0, 1, 2, 3, 4, 5], R: [6, 7, 8, 9, 10, 11] }) === 1);
    var g = G.create(p, {}); g.act({ k: "weigh", L: [0, 1, 2, 3, 4], R: [5, 6, 7, 8, 9] }); var m1 = g.counters.mistakes;
    g.act({ k: "weigh", L: [0], R: [1] }); g.act({ k: "weigh", L: [0], R: [2] });
    t.ok("mistakes cộng dồn qua game.act: lần sai đầu +1; khi thế ĐÃ MẤT, các lần cân sau không bị tính lại (0)", m1 === 1 && g.counters.mistakes === 1, [m1, g.counters.mistakes]);
    var sp = T.newState(p); T.replay(p).forEach(function (st) { G.applyDiff(sp, st.diff.d, false); });
    var s2 = T.newState(p); apply(p, s2, { k: "weigh", L: [0, 1, 2, 3, 4], R: [5, 6, 7, 8, 9] });
    t.ok("kết luận chưa được chứng minh = 1 lỗi; kết luận đã chứng minh = 0 lỗi", mis(s2, { k: "conclude", coin: 3, heavy: true }) === 1 && (function () { var x = T.newState(p); T.replay(p).slice(0, -1).forEach(function (st) { G.applyDiff(x, st.diff.d, false); }); var cn = L.concluded(p, { v: p.solution.v, c: null }); return mis(x, { k: "conclude", coin: cn.coin, heavy: cn.dir === 1 }) === 0; })());
    t.ok("truncate không tính lỗi", (function () { var x = T.newState(p); apply(p, x, { k: "weigh", L: [0, 1, 2, 3, 4], R: [5, 6, 7, 8, 9] }); return mis(x, { k: "truncate", n: 0 }) === 0; })());
    // đối chiếu độc lập: lần cân an toàn ⇔ mọi kết quả khả dĩ còn giải được (vét cạn tập giả thuyết, n nhỏ)
    var bad = [], cnt = 0;
    [{ n: 5, k: 2, fake: "heavy", ref: 0, dir: 0 }, { n: 4, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 5, k: 3, fake: "either", ref: 1, dir: 1 }].forEach(function (c) {
      var pp = fromIn(mkInput(c, "adv")), C = c.n + c.ref, total = Math.pow(3, C);
      for (var a = 0; a < total; a++) {
        var x = a, side = [], nl = 0, nr = 0, i;
        for (i = 0; i < C; i++) { var sd = x % 3; side.push(sd); if (sd === 1) nl++; else if (sd === 2) nr++; x = Math.floor(x / 3); }
        if (nl !== nr || nl === 0) continue;
        var Ls = [], Rs = []; side.forEach(function (v, j) { if (v === 1) Ls.push(j); else if (v === 2) Rs.push(j); });
        var st = T.newState(pp), d = T.moveFor(pp, st, { k: "weigh", L: Ls, R: Rs });
        var parts = { 1: [], 2: [], 3: [] }; hyps0(c.n, c.fake).forEach(function (hy) { parts[weigh(side, hy[0], hy[1])].push(hy); });
        // thế sau mỗi kết quả giải được trong k−1 lần? (vét cạn tường minh trên tập con giả thuyết — dùng bruteSolvable cho tập ĐẦY ĐỦ không được, nên đệ quy trực tiếp)
        var safe = [1, 2, 3].every(function (o) { return !parts[o].length || subSolvable(parts[o], C, c.k - 1, c.dir === 1); });
        cnt++; if ((T.mistakes(pp, st, d) === 0) !== safe) bad.push([c.n, c.k, J(Ls), J(Rs)]);
      }
    });
    t.ok("mistakes = 0 ⇔ mọi kết quả khả dĩ còn giải được (vét cạn tập giả thuyết) — " + cnt + " phép cân ở 3 cấu hình nhỏ", bad.length === 0 && cnt > 100, bad.slice(0, 3));
    function subSolvable(H, coins, r, needDir) {
      function term(Hs) { if (Hs.length <= 1) return true; if (needDir) return false; for (var i = 1; i < Hs.length; i++) if (Hs[i][0] !== Hs[0][0]) return false; return true; }
      var memo = {};
      function rec(Hs, rr) {
        if (term(Hs)) return true; if (rr === 0) return false;
        var key = J(Hs) + rr; if (memo[key] !== undefined) return memo[key];
        var ok = false, total = Math.pow(3, coins);
        for (var a = 0; a < total && !ok; a++) {
          var x = a, side = [], nl = 0, nr = 0, i;
          for (i = 0; i < coins; i++) { var sd = x % 3; side.push(sd); if (sd === 1) nl++; else if (sd === 2) nr++; x = Math.floor(x / 3); }
          if (nl !== nr || nl === 0) continue;
          var parts = { 1: [], 2: [], 3: [] }; Hs.forEach(function (hy) { parts[weigh(side, hy[0], hy[1])].push(hy); });
          ok = [1, 2, 3].every(function (o) { return !parts[o].length || rec(parts[o], rr - 1); });
        }
        memo[key] = ok; return ok;
      }
      return rec(H, r);
    }
  })();

  // ====================================================================== 5. gợi ý
  t.group("coinbalance — gợi ý: vòng 'mức 3 → áp dụng' giải xong, cả hai chế độ, kể cả sau nước đi sai");
  (function () {
    var rng = R.create(404), fail = [], runs = 0, maxSteps = 0, lvlBad = [], whyBad = [], detBad = [];
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) { for (var seed = 1; seed <= 6; seed++) {
      var p = T.generate(seed * 211, { sizeId: sz.id, tier: TIERS[(seed + 1) % 4], options: { mode: mode } }), g = G.create(p, {}), steps = 0, injected = false;
      runs++;
      while (g.status !== "solved" && steps < p.data.k * 3 + 4) {
        if (!injected && steps === 1 && plan.count(g.state) < p.data.k) { injected = true; g.act(randomWeighing(p, g.state, rng)); }   // chèn một lần cân ngẫu nhiên (thường mất an toàn)
        var h3 = g.hint(3);
        if (!h3 || h3.none || !h3.action) { fail.push(["không còn hint", sz.id, mode, seed, steps, h3 && h3.text]); break; }
        if (J(T.hint(p, g.state, 3, {})) !== J(T.hint(p, g.state, 3, { x: 1 }))) detBad.push([sz.id, mode, seed, steps]);
        var r = g.applyHint(h3); if (!r.ok) { fail.push(["áp dụng thất bại", sz.id, mode, seed, steps, J(h3.action)]); break; } steps++;
      }
      maxSteps = Math.max(maxSteps, steps);
      if (g.status !== "solved") fail.push(["chưa giải", sz.id, mode, seed, steps]);
      var gr = g.grade(); if (!gr || GR.errors(gr).length) fail.push(["grade lỗi", sz.id, J(gr)]);
    } }); });
    t.ok("giải xong bằng gợi ý mức 3 ở " + runs + " ván (6 phiên bản × 2 chế độ × 6 seed, có chèn lần cân ngẫu nhiên), ≤ k·3+4 bước (tối đa " + maxSteps + ")", fail.length === 0, fail.slice(0, 3));
    t.ok("hint(…, settings) tất định: cùng trạng thái + mức → cùng kết quả bất kể settings", detBad.length === 0, detBad.slice(0, 3));
    // mức 1 không lộ phép cân của mức 3; mức 2 chỉ ra xu (cells); mức 3 có why + action
    T.sizes.forEach(function (sz) {
      var p = T.generate(8, { sizeId: sz.id, tier: "medium" }), s = T.newState(p), h1 = T.hint(p, s, 1), h2 = T.hint(p, s, 2), h3 = T.hint(p, s, 3), set3 = h3.text.replace(/^Cân /, "").replace(/\.$/, "");
      var ok = h1.text.length > 20 && h1.text.indexOf(set3) < 0 && h1.text.indexOf(L.setText(h3.action.L)) < 0 && h2.cells.length >= 2 && h3.action.k === "weigh" && h3.why.length >= 4 && h3.cells.length === h3.action.L.length + h3.action.R.length && h1.level === 1 && h2.level === 2 && h3.level === 3;
      if (!ok) lvlBad.push([sz.id, h1.text, h3.text]);
      if (h3.why.some(function (w) { return /\b(undefined|null|NaN)\b/.test(w); }) || /\b(undefined|null|NaN)\b/.test(h1.text + h2.text + h3.text)) whyBad.push(sz.id);
    });
    t.ok("mức 1 không lộ phép cân của mức 3; mức 2 nêu các xu (cells); mức 3 có ≥ 4 dòng 'vì sao' + action weigh khớp cells — 6 phiên bản", lvlBad.length === 0, lvlBad.slice(0, 2));
    t.ok("chữ gợi ý không lọt undefined/null/NaN", whyBad.length === 0, whyBad);
  })();
  t.group("coinbalance — phép cân tốt nhất = an toàn VÀ cân bằng nhất (nhánh lớn nhất nhỏ nhất)");
  (function () {
    // nguồn độc lập: biết nặng, h xu, k lần cân — chia ba nhóm (a, a, h − 2a) mỗi nhóm ≤ 3^(k−1) ⇒ chọn a làm nhánh lớn nhất nhỏ nhất (tính tay, không dùng DP)
    function handBest(h, k) { var B = Math.pow(3, k - 1), best = null; for (var a = 1; 2 * a <= h; a++) { var mx = Math.max(a, h - 2 * a); if (mx <= B && (!best || mx < best.mx)) best = { a: a, mx: mx }; } return best; }
    [[20, 3], [22, 3], [14, 3], [26, 3], [5, 2], [8, 2]].forEach(function (c) {
      var p = fromIn(mkInput({ n: c[0], k: c[1], fake: "heavy", ref: 0, dir: 0 }, "adv")), h = T.hint(p, T.newState(p), 3), hb = handBest(c[0], c[1]);
      t.ok("biết nặng " + c[0] + " xu / " + c[1] + " lần: gợi ý cân " + hb.a + " với " + hb.a + " (nhánh lớn nhất " + hb.mx + ", tính tay)", !!h.action && h.action.L.length === hb.a && h.action.R.length === hb.a, h.text);
    });
    var rng = R.create(606), bad = [], cnt = 0;
    for (var it = 0; it < 60; it++) {
      var sz = T.sizes[it % T.sizes.length], p2 = T.generate(it * 17 + 3, { sizeId: sz.id, tier: TIERS[it % 4], options: { mode: "adv" } }), st = T.newState(p2), steps = rng.int(2);
      for (var q = 0; q < steps; q++) { var cl = L.classesOf(p2.data, st), cn = L.countsOf(cl), sf = L.safeWeighings(cn, L.budget(p2.data, st), L.goalFor(p2.data)); if (!sf.length) break; var ww = sf[rng.int(sf.length)].w, so = L.coinsFor(cl, ww); apply(p2, st, { k: "weigh", L: so.L, R: so.R }); }
      var cls = L.classesOf(p2.data, st), cnt2 = L.countsOf(cls), r = L.budget(p2.data, st), goal = L.goalFor(p2.data);
      if (cnt2.u + cnt2.h + cnt2.l <= 1) continue;
      var safe = L.safeWeighings(cnt2, r, goal), best = L.bestWeighing(cnt2, r, goal); if (!safe.length || !best) continue;
      var mxOf = function (x) { return Math.max.apply(null, x.outs.map(function (o) { return L.nposs(o.u, o.h, o.l); })); };
      cnt++;
      if (mxOf(best) !== Math.min.apply(null, safe.map(mxOf))) bad.push([sz.id, it]);
    }
    t.ok("bestWeighing có nhánh lớn nhất = NHỎ nhất trong mọi phép cân an toàn — " + cnt + " trạng thái ngẫu nhiên giữa ván", bad.length === 0 && cnt > 30, bad.slice(0, 3));
  })();
  t.group("coinbalance — gợi ý: ví dụ 12 xu / 3 lần, thế mất, kết luận, đã xong");
  (function () {
    var p = fromIn(mkInput({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 3, heavy: 1 })), s = T.newState(p), h = T.hint(p, s, 3);
    t.ok("đầu ván: 'Cân {1–4} với {5–8}.' (phép an toàn DUY NHẤT theo lớp)", h.text === "Cân {1–4} với {5–8}." && J(h.action) === J({ k: "weigh", L: [0, 1, 2, 3], R: [4, 5, 6, 7] }));
    t.ok("lời giải thích nêu số khả năng và 3 nhánh: 24 khả năng, ≤ 9 mỗi nhánh", h.why[0].indexOf("24 khả năng") >= 0 && h.why[0].indexOf("≤ 9") >= 0 && h.why.some(function (w) { return /^Nếu bên trái nặng hơn: .*8 khả năng/.test(w); }) && h.why.some(function (w) { return /^Nếu cân bằng: .*8 khả năng/.test(w); }) && h.why.some(function (w) { return /^Nếu bên phải nặng hơn/.test(w); }));
    t.ok("lời giải thích nói VÌ SAO phép cân gần đó hỏng (thêm một xu mỗi đĩa: nhánh lệch 10 > 9)", h.why.some(function (w) { return /^Vì sao không thêm một xu mỗi đĩa \(5 với 5\): nếu bên trái nặng hơn thì còn 10 khả năng/.test(w); }) && h.why.some(function (w) { return /^Vì sao không bớt một xu mỗi đĩa \(3 với 3\)/.test(w); }), h.why);
    var g = G.create(p, {}); g.act({ k: "weigh", L: [0, 1, 2, 3, 4], R: [5, 6, 7, 8, 9] });
    var hh = g.hint(3);
    t.ok("sau lần cân 5–5 (mất an toàn): hint nói trước + action truncate n = 0; mức 1 chỉ nói chung, mức 2 nêu lần cân", hh.action && hh.action.k === "truncate" && hh.action.n === 0 && /mất an toàn/.test(hh.why[0]) && /5 với 5|\{1–5\} với \{6–10\}/.test(hh.why[0]) && /Từ thế này không còn cách cân nào chắc chắn/.test(g.hint(1).text) && /Lần cân thứ 1/.test(g.hint(2).text), hh);
    g.applyHint(hh);
    t.ok("áp truncate quay về đầu; sau đó hint lại ra phép cân an toàn", plan.count(g.state) === 0 && g.hint(3).action.k === "weigh" && J(g.hint(3).action.L) === J([0, 1, 2, 3]));
    var q = G.create(p, {}); T.replay(p).slice(0, -1).forEach(function (st) { G.applyDiff(q.state, st.diff.d, false); });
    var hc1 = T.hint(p, q.state, 1), hc2 = T.hint(p, q.state, 2), hc3 = T.hint(p, q.state, 3);
    t.ok("đã đủ thông tin: mức 1 'đủ để kết luận' (không lộ xu), mức 2 nêu xu, mức 3 action conclude có hướng", /đủ thông tin/.test(hc1.text) && hc1.cells.length === 0 && hc2.cells.length === 1 && hc3.action.k === "conclude" && hc3.action.coin === 3 && hc3.action.heavy === true);
    q.act(hc3.action);
    t.ok("kết luận đúng → solved; hint sau đó 'none'", q.status === "solved" && T.hint(p, q.state, 1).none === true);
    var u = G.create(p, {}); u.act({ k: "conclude", coin: 3, heavy: true });
    var hu = u.hint(3);
    t.ok("kết luận chưa chứng minh (dù đúng): hint nói rõ, action truncate n = len mở lại", u.status === "playing" && /chưa được chứng minh/.test(u.hint(1).text) && hu.action.k === "truncate" && hu.action.n === 0);
    u.applyHint(hu);
    t.ok("mở lại → cân tiếp được", plan.isSubmitted(u.state) === false && !!T.moveFor(p, u.state, { k: "weigh", L: [0], R: [1] }));
    var x = fromIn(mkInput({ n: 9, k: 2, fake: "heavy", ref: 0, dir: 0 }, "fixed", { coin: 4, heavy: 1 })), hx = T.hint(x, T.newState(x), 3);
    t.ok("biết nặng 9 xu / 2 lần: cân {1–3} với {4–6}; vì sao: nhánh nào cũng còn 3 xu ≤ 3", hx.text === "Cân {1–3} với {4–6}." && hx.why.some(function (w) { return /Nếu cân bằng: .*3 xu còn nghi ≤ 3/.test(w); }));
  })();

  // ====================================================================== 6. grade
  t.group("coinbalance — grade: sao theo hoàn tác / gợi ý mức 3 / may mắn");
  (function () {
    var c = { n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, p = fromIn(mkInput(c, "fixed", { coin: 3, heavy: 1 }));
    var done = T.newState(p); T.replay(p).forEach(function (st) { G.applyDiff(done, st.diff.d, false); });
    var clean = { moves: 4, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false };
    var g0 = T.grade(p, done, clean), gU = T.grade(p, done, Object.assign({}, clean, { undos: 1 })), gH = T.grade(p, done, Object.assign({}, clean, { hints: { 1: 2, 2: 1, 3: 1 } })), gL = T.grade(p, done, Object.assign({}, clean, { mistakes: 1 }));
    t.ok("thắng chắc chắn, không hoàn tác, không gợi ý mức 3 → 3★, quality 1, 'Tối ưu'", g0.stars === 3 && g0.quality === 1 && g0.value === 3 && g0.best === 3 && /Tối ưu/.test(g0.text), g0);
    t.ok("có hoàn tác → 2★; có gợi ý mức 3 → 2★ (gợi ý mức 1–2 không phạt)", gU.stars === 2 && gH.stars === 2 && T.grade(p, done, Object.assign({}, clean, { hints: { 1: 3, 2: 3, 3: 0 } })).stars === 3);
    t.ok("thắng mà có sai sót (có lần cân mất an toàn — có thể nhờ may) → 1★, chữ nói rõ", gL.stars === 1 && /sai sót/.test(gL.text) && /nhờ may/.test(gL.text));
    t.ok("chưa kết luận → 0★ ('Chưa kết luận'); kết luận chưa chứng minh → 0★; value = số lần cân", (function () { var s = T.newState(p); apply(p, s, { k: "weigh", L: [0, 1, 2, 3], R: [4, 5, 6, 7] }); var a = T.grade(p, s, clean); apply(p, s, { k: "conclude", coin: 3, heavy: true }); var b = T.grade(p, s, clean); return a.stars === 0 && a.value === 1 && /Chưa kết luận/.test(a.text) && b.stars === 0 && /chưa được chứng minh/.test(b.text); })());
    t.ok("Puz.grade.errors rỗng ở mọi trạng thái (đầu, giữa, cuối, đủ loại counters), valueText/bestText không đơn vị", [T.newState(p), done].every(function (s) { return [clean, { moves: 9, mistakes: 3, undos: 5, hints: { 1: 1, 2: 1, 3: 1 }, revealed: false }, undefined].every(function (cc) { return GR.errors(T.grade(p, s, cc)).length === 0; }); }) && g0.valueText === "3" && g0.bestText === "3");
    t.ok("thắng SỚM hơn k* (cố định, may mắn khớp): quality 1 và chữ nói rõ", (function () {
      var q = fromIn(mkInput({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 0, heavy: 1 })), s = T.newState(q), c2;
      T.replay(q).forEach(function (st) { G.applyDiff(s, st.diff.d, false); });
      c2 = T.grade(q, s, clean); return c2.value <= c2.best && c2.quality === 1 && c2.stars === 3;
    })());
    t.ok("ván THẬT qua game.act: giải sạch bằng chiến lược → record.grade 3★; có Hoàn tác → 2★; Reveal → không có grade", (function () {
      var steps = T.replay(p), g = G.create(p, {}), play = L.playOptimal(p);
      play.steps.forEach(function (st) { g.act(st.action); });
      var r = g.record("solved"), g2 = G.create(p, {}); play.steps.forEach(function (st, i) { g2.act(st.action); if (i === 0) { g2.undo(); g2.act(st.action); } });
      var g3 = G.create(p, {}); g3.reveal(); var r3 = g3.record("revealed");
      return g.status === "solved" && r.grade && r.grade.stars === 3 && g2.record("solved").grade.stars === 2 && !r3.grade && steps.length === play.steps.length;
    })());
  })();

  // ====================================================================== 7. fromInput / validate / solve / tự nhập
  t.group("coinbalance — fromInput / validate / solve: chiến lược chắc chắn hay không (giới hạn Dyson)");
  (function () {
    var yes = [{ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 13, k: 3, fake: "either", ref: 1, dir: 1 }, { n: 13, k: 3, fake: "either", ref: 0, dir: 0 }, { n: 27, k: 3, fake: "heavy", ref: 0, dir: 0 }, { n: 39, k: 4, fake: "either", ref: 0, dir: 1 }, { n: 3, k: 3, fake: "heavy", ref: 0, dir: 0 }];
    var no = [{ n: 13, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 14, k: 3, fake: "either", ref: 1, dir: 1 }, { n: 14, k: 3, fake: "either", ref: 0, dir: 0 }, { n: 28, k: 3, fake: "heavy", ref: 0, dir: 0 }, { n: 40, k: 4, fake: "either", ref: 0, dir: 1 }, { n: 2, k: 3, fake: "either", ref: 0, dir: 1 }, { n: 5, k: 1, fake: "either", ref: 0, dir: 1 }];
    var yok = yes.map(function (c) { return T.fromInput(mkInput(c, "adv")); }), nok = no.map(function (c) { return T.fromInput(mkInput(c, "adv")); });
    t.ok("giải được: ok, status unique, count 1, statusText '✓ Có chiến lược chắc chắn…', statusKind ok, có lời giải", yok.every(function (r) { return r.ok && r.status === "unique" && r.count === 1 && /^✓ Có chiến lược chắc chắn trong \d lần cân/.test(r.statusText) && r.statusKind === "ok" && r.puzzle.solution && r.puzzle.tier === "custom" && r.puzzle.sizeId === "tu-nhap"; }), yok.map(function (r) { return r.statusText; }));
    t.ok("không giải được (13/3 không chuẩn, 14/3 có chuẩn, 28 biết nặng, 40/4, n=2, k=1…): ok:false, status none, statusKind bad, lời giải thích giới hạn", nok.every(function (r) { return !r.ok && r.status === "none" && r.count === 0 && r.statusKind === "bad" && /không có chiến lược chắc chắn/.test(r.errors[0]); }) && /tối đa 12 xu/.test(nok[0].errors[0]) && /tối đa 13 xu/.test(nok[1].errors[0]), nok.map(function (r) { return r.errors[0]; }));
    t.ok("khớp vét cạn mức tập giả thuyết ở các ca nhỏ (13/3 → không; 12/3 → có; 13+chuẩn → có)", [[13, 0, "either", true, 3, false], [12, 0, "either", true, 3, true], [13, 1, "either", true, 3, true], [14, 1, "either", true, 3, false], [14, 0, "either", false, 3, false], [13, 0, "either", false, 3, true]].every(function (c) {
      return setSolvable(c[0], c[1], c[2], c[3], c[4]) === c[5] && (L.bestK({ n: c[0], k: c[4], fake: c[2], ref: c[1], dir: c[3] ? 1 : 0 }) <= c[4]) === c[5];
    }));
    t.ok("ngân sách dư (n = 3 biết nặng, k = 3): ok kèm cảnh báo 'Chỉ cần 1 lần cân' và grade dùng k* = 1", (function () { var r = yok[5]; return r.ok && r.warnings.length === 1 && /Chỉ cần 1 lần cân/.test(r.warnings[0]) && L.bestK(r.puzzle.data) === 1; })());
    t.ok("validate(puzzle) ra đúng như fromInput; solve có steps tiếng Việt và 'unique'", (function () {
      var p = T.generate(3, { sizeId: "nn3", tier: "hard" }), v = T.validate(p), s = T.solve(p, { limit: 2 });
      return v.ok && v.status === "unique" && v.count === 1 && J(v.solution) === J(p.solution) && s.status === "unique" && s.count === 1 && s.steps.length >= 2 && s.steps.every(function (st) { return st.text.length > 5; }) && J(s.solution) === J(p.solution);
    })());
    t.ok("đầu vào xấu → ok:false + lỗi tiếng Việt, KHÔNG ném lỗi (30 kiểu xấu)", (function () {
      var bads = [null, undefined, 5, "x", [], {}, { n: 12 }, { n: 12, k: 3 }, { n: 12, k: 3, fake: "x" }, { n: 1, k: 3, fake: "either" }, { n: 82, k: 3, fake: "heavy" }, { n: 12, k: 0, fake: "either" }, { n: 12, k: 5, fake: "either" }, { n: 12.5, k: 3, fake: "either", mode: "adv" },
        { n: "abc", k: 3, fake: "either" }, { n: 12, k: 3, fake: "either", ref: 2 }, { n: 12, k: 3, fake: "either", dir: 7, mode: "adv" }, { n: 12, k: 3, fake: "either", mode: "zz" }, { n: 12, k: 3, fake: "either", mode: "fixed" }, { n: 12, k: 3, fake: "either", mode: "fixed", secret: null },
        { n: 12, k: 3, fake: "either", mode: "fixed", secret: { coin: 12, heavy: 1 } }, { n: 12, k: 3, fake: "either", mode: "fixed", secret: { coin: -1, heavy: 1 } }, { n: 12, k: 3, fake: "either", mode: "fixed", secret: { coin: 1 } }, { n: 9, k: 2, fake: "heavy", mode: "fixed", secret: { coin: 1, heavy: 0 } },
        { n: 12, k: 3, fake: "either", mode: "fixed", secret: "7" }, { n: Infinity, k: 3, fake: "either" }, { n: NaN, k: NaN, fake: "either" }, { n: 12, k: 3, fake: "either", mode: "fixed", secret: { coin: "x", heavy: 1 } }, { n: [12], k: [3], fake: "either" }, { n: 12, k: 3, fake: { toString: 1 } }];
      return bads.every(function (b) { try { var r = T.fromInput(b); return r && r.ok === false && r.errors.length >= 1 && r.errors.every(function (e) { return typeof e === "string" && e.length > 3; }); } catch (e) { return false; } });
    })());
    t.ok("số ở dạng chuỗi chữ số được nhận ('12', '3'); secret.heavy nhận true/1/'1'", (function () { var r = T.fromInput({ n: "12", k: "3", fake: "either", mode: "fixed", secret: { coin: "5", heavy: true } }); return r.ok && r.puzzle.data.secret.coin === 5 && r.puzzle.data.secret.heavy === 1 && r.puzzle.data.n === 12; })());
    t.ok("đề tự nhập chạy được trọn vòng: lời giải solved, gợi ý giải xong, replay solved", (function () {
      var r = T.fromInput(mkInput({ n: 7, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 2, heavy: 0 })), g = G.create(r.puzzle, {}), n = 0;
      while (g.status !== "solved" && n++ < 12) { var h = g.hint(3); if (!h.action) break; g.applyHint(h); }
      var st = T.newState(r.puzzle); T.replay(r.puzzle).forEach(function (s) { G.applyDiff(st, s.diff.d, false); });
      return g.status === "solved" && T.check(r.puzzle, st).solved;
    })());
  })();

  t.group("coinbalance — I/O: toText/fromText, toFile/fromFile, tệp xấu");
  (function () {
    var rt = [], rf = [], n = 0;
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) { for (var seed = 1; seed <= 4; seed++) {
      var p = T.generate(seed * 61, { sizeId: sz.id, tier: TIERS[seed % 4], options: { mode: mode } }); n++;
      var a = T.fromText(T.toText(p)), b = T.fromFile(JSON.parse(JSON.stringify(T.toFile(p))));
      if (!a.ok || J(a.puzzle.initial) !== J(p.initial) || J(a.puzzle.data) !== J(p.data)) rt.push([sz.id, mode, seed, a.errors]);
      if (!b.ok || J(b.puzzle.initial) !== J(p.initial) || J(b.puzzle.data) !== J(p.data) || b.puzzle.id !== p.id) rf.push([sz.id, mode, seed, b.errors]);
    } }); });
    t.ok("fromText(toText(p)) cho lại đúng initial + data ở " + n + " đề (cả hai chế độ, 6 phiên bản)", rt.length === 0, rt.slice(0, 3));
    t.ok("fromFile(toFile(p)) cho lại đúng initial + data + cùng id (yêu thích/thư viện nhận ra cùng đề)", rf.length === 0, rf.slice(0, 3));
    var p = T.generate(3, { sizeId: "nn3", tier: "hard" });
    t.ok("toText có các dòng 'khoá: giá trị' tiếng Việt: xu, lần cân, xu giả, xu chuẩn, nói nặng/nhẹ, chế độ, mã", /^xu: \d+\nlần cân: 3\nxu giả: nặng hoặc nhẹ\nxu chuẩn: không\nnói nặng\/nhẹ: có\nchế độ: cố định\nmã: \d+ (nặng|nhẹ)$/.test(T.toText(p)), T.toText(p));
    t.ok("fromText chấp nhận khoá ASCII (n,k,fake,ref,dir,mode,secret), bỏ dấu, hoa/thường, dấu = và ; ngăn dòng", (function () {
      var r = T.fromText("n=12; k=3; fake=either; ref=0; dir=1; mode=fixed; secret=5 heavy"), q = T.fromText("XU: 12\nLAN CAN: 3\nxu giả: nặng hoặc nhẹ\nche do: doi thu"), z = T.fromText("xu: 9\nlần cân: 2\nxu giả: nặng hơn\nmã: 5");
      return r.ok && r.puzzle.data.secret.coin === 4 && r.puzzle.data.secret.heavy === 1 && q.ok && q.puzzle.data.mode === "adv" && z.ok && z.puzzle.data.fake === "heavy" && z.puzzle.data.secret.coin === 4;
    })());
    t.ok("fromFile KHÔNG tin difficulty/solution trong tệp: sửa difficulty=0 và solution rác ⇒ vẫn ra điểm/lời giải tính lại", (function () {
      var f = JSON.parse(JSON.stringify(T.toFile(p))); f.difficulty = 0.1; f.solution = "rác"; f.metadata = { name: "<b>x</b>" };
      var r = T.fromFile(f); return r.ok && r.puzzle.score === p.score && J(r.puzzle.solution) === J(p.solution) && r.puzzle.meta.name === "<b>x</b>";
    })());
    t.ok("tệp xấu / văn bản xấu → ok:false + lỗi tiếng Việt, không ném lỗi (25 kiểu)", (function () {
      var fs2 = [null, undefined, 3, "x", {}, { initialState: 5 }, { initialState: "" }, { initialState: "n=12" }, { initialState: "n=12;k=3;fake=zz;ref=0;dir=1;mode=fixed;secret=5n" }, { initialState: "n=12;k=3;fake=either;ref=0;dir=1;mode=fixed;secret=zz" }, { initialState: "n=12;k=3;fake=either;ref=0;dir=1;mode=fixed" }, { initialState: "n=99999;k=3;fake=either;ref=0;dir=1;mode=adv" }];
      var ts = [null, undefined, 5, "", "   ", "xu: 12", "xu: 12\nlần cân: 3\nmã: abc", "xu: 12\nlần cân: 3\nchế độ: zz", "xu: 12\nlần cân: 3\nxu chuẩn: có thể", "xu: -4\nlần cân: 3", "xu: 12\nlần cân: x", "\u0000\u0001", "xu: 12\nlần cân: 3\nmã: 99 nặng\nchế độ: cố định", "xu: 12\nlần cân: 3\nnói nặng/nhẹ: ?"];
      return fs2.every(function (f) { try { var r = T.fromFile(f); return r.ok === false && r.errors.length >= 1; } catch (e) { return false; } }) && ts.every(function (x) { try { var r = T.fromText(x); return r.ok === false && r.errors.length >= 1; } catch (e) { return false; } });
    })());
    t.ok("toFile/toText có nội dung JSON thuần (postMessage / IndexedDB / xuất tệp được)", (function () { var f = T.toFile(p); return typeof f.initialState === "string" && f.type === "coinbalance" && JSON.parse(JSON.stringify(f)).solution === f.solution && typeof f.solution === "string" && f.solution.length > 3; })());
    var files = Puz.files;
    if (files) t.ok("CSV danh sách puzzle (core/files.puzzlesCsv): có dòng coinbalance với trạng thái đầu 'n=…;k=…' được trích dẫn đúng, không công thức lạ", (function () {
      var csv = files.puzzlesCsv([p]), line = csv.split("\r\n")[1];
      return /^coinbalance,/.test(line) && line.indexOf('"n=') > 0 && !/^[=+@-]/.test(line);
    })());
    if (files) t.ok("nhập/xuất qua core/files: JSON một puzzle và TXT '#puzzle type=coinbalance' đều nhập lại được", (function () {
      var j = files.importText(files.exportJson([p])), x = files.importText(files.exportText(p));
      return j.ok && j.puzzles.length === 1 && j.puzzles[0].id === p.id && x.ok && x.puzzles[0].type === "coinbalance" && x.puzzles[0].data.n === p.data.n;
    })());
  })();

  // ====================================================================== 8. constraintView / trace / replay / mô tả
  t.group("coinbalance — constraintView, trace (cây chiến lược), replay, describeCell");
  (function () {
    var shapeBad = [], treeBad = [], repBad = [], descBad = [];
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) {
      var p = T.generate(9, { sizeId: sz.id, tier: "hard", options: { mode: mode } }), cv = T.constraintView(p), tr = T.trace(p, { maxNodes: 600 }), rp = T.replay(p);
      if (!cv.summary || !cv.variables.length || !cv.constraints.length || !cv.counts || !Array.isArray(cv.sections) || cv.sections.some(function (s) { return !s.title || !s.items.length; }) || /\b(undefined|null|NaN)\b/.test(J(cv))) shapeBad.push([sz.id, mode, "cv"]);
      var ids = {}; tr.nodes.forEach(function (nd) { ids[nd.id] = nd; });
      if (tr.kind !== "tree" || !tr.nodes.length || tr.nodes.length > 600 || tr.nodes[0].parent !== -1 || tr.nodes.some(function (nd) { return nd.parent !== -1 && !ids[nd.parent]; }) || tr.nodes.some(function (nd) { return ["fail", "dead", "ok", "solution"].indexOf(nd.status) < 0 || !nd.label || /\b(undefined|null|NaN)\b/.test(nd.label); }) || !tr.nodes.some(function (nd) { return nd.status === "solution"; })) treeBad.push([sz.id, mode, tr.nodes.length]);
      var st = T.newState(p); rp.forEach(function (s) { G.applyDiff(st, s.diff.d, false); });
      if (!T.check(p, st).solved || rp.some(function (s) { return !s.text || /\b(undefined|null|NaN)\b/.test(s.text + (s.why || []).join(" ")) || !s.diff || !s.diff.d.length; }) || !/^Chỉ còn một khả năng/.test(rp[rp.length - 1].text) || rp.length !== plan.count(st) + 1) repBad.push([sz.id, mode]);
      for (var i = 0; i < p.data.n + p.data.ref; i++) { var tx = T.describeCell(p, st, i); if (!tx || /\b(undefined|null|NaN)\b/.test(tx)) descBad.push([sz.id, i]); }
    }); });
    t.ok("constraintView đúng hình dạng (summary, variables, constraints, counts, sections) ở 12 đề", shapeBad.length === 0, shapeBad.slice(0, 3));
    t.ok("trace kiểu cây: ≤ 600 nút, gốc parent −1, cha tồn tại, status hợp lệ, có lá 'solution'", treeBad.length === 0, treeBad.slice(0, 3));
    t.ok("replay: áp tuần tự ra trạng thái solved, mỗi bước có text, cuối là 'Chỉ còn một khả năng', số bước = lần cân + 1", repBad.length === 0, repBad.slice(0, 3));
    t.ok("describeCell không rỗng, không chữ rác (mọi xu, kể cả xu chuẩn)", descBad.length === 0, descBad.slice(0, 3));
    var big = T.trace(fromIn(mkInput({ n: 39, k: 4, fake: "either", ref: 0, dir: 1 }, "adv")), { maxNodes: 600 });
    t.ok("cây chiến lược 39 xu / 4 lần ≤ 600 nút và không bị cắt (" + big.nodes.length + " nút)", big.nodes.length <= 600 && !big.truncated, big.nodes.length);
    t.ok("trace tôn trọng maxNodes (cắt khi vượt: truncated = true)", (function () { var x = T.trace(fromIn(mkInput({ n: 39, k: 4, fake: "either", ref: 0, dir: 1 }, "adv")), { maxNodes: 30 }); return x.nodes.length <= 30 && x.truncated === true; })());
    var p = T.generate(2, { sizeId: "nn3", tier: "easy" }), st = T.newState(p);
    t.ok("describeCell: 'Xu 5, chưa cân lần nào' rồi 'Xu 1, đã cân 1 lần (trái)' — không lộ suy luận", T.describeCell(p, st, 4) === "Xu 5, chưa cân lần nào" && (function () { apply(p, st, { k: "weigh", L: [0], R: [1] }); return T.describeCell(p, st, 0) === "Xu 1, đã cân 1 lần (trái)" && T.describeCell(p, st, 1) === "Xu 2, đã cân 1 lần (phải)" && T.describeCell(p, st, 2) === "Xu 3, đã cân 1 lần (ngoài)"; })());
    t.ok("xu chuẩn: isGiven + describeCell 'Xu chuẩn, chắc chắn thật'; xu thường không phải ô cho sẵn", (function () { var q = T.generate(2, { sizeId: "nnc3", tier: "easy" }); return T.isGiven(q, q.data.n) === true && T.isGiven(q, 0) === false && T.describeCell(q, T.newState(q), q.data.n) === "Xu chuẩn, chắc chắn thật" && T.isGiven(p, 0) === false; })());
  })();

  t.group("coinbalance — vào Daily từ 2026-10-30 (P8)");
  (function () {
    var D = Puz.daily;
    if (!D) { t.ok("core/daily.js có trong ngữ cảnh kiểm", false); return; }
    var types = Puz.types.all().map(function (d) { return d.id; }), bad = [], late = 0, day = "2026-10-01", n = 0;
    for (var i = 0; i < 800; i++) { var f = D.forDay(day, types); n++; if (!f) bad.push(day); else if (f.type === "coinbalance") { if (day < "2026-10-30") bad.push(day); else late++; } day = Puz.util.addDays(day, 1); }
    t.ok("coinbalance nằm trong Puz.daily.ORDER và đúng một phiên bản SCHEDULE (tu 2026-10-30, không phiên bản nào trước đó); {n} ngày từ 01/10: không ngày nào TRƯỚC 30/10 ra coinbalance, từ 30/10 ra đều ({late} ngày)".replace("{n}", n).replace("{late}", late), D.ORDER.indexOf("coinbalance") >= 0 && D.SCHEDULE.filter(function (v) { return v.ids.indexOf("coinbalance") >= 0; }).map(function (v) { return v.tu; }).join() === "2026-10-30" && bad.length === 0 && late >= 50, bad.slice(0, 3));
  })();

  // ====================================================================== 10. sửa sau kiểm độc lập (P3)
  t.group("coinbalance — sửa sau kiểm: nhãn HUD đúng với bộ đếm THẬT của vỏ");
  (function () {
    var p = fromIn(mkInput({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 3, heavy: 1 })), g = G.create(p, {}), w = { k: "weigh", L: [0, 1, 2, 3], R: [4, 5, 6, 7] };
    g.act(w); g.undo(); g.act(w);
    t.ok("chip HUD đếm game.counters.moves (số lần gọi act, hoàn tác không giảm) ≠ số lần cân trong state: cân → hoàn tác → cân lại = " + g.counters.moves + " so với " + plan.count(g.state), g.counters.moves === 2 && plan.count(g.state) === 1);
    t.ok("moveLabel không tự nhận là 'số lần cân' (bàn đã có dòng 'Còn r / k lần cân' — hai con số mâu thuẫn); nói đó là số thao tác", /thao tác/i.test(T.moveLabel) && !/^s[ốo] l[ầa]n c[âa]n/i.test(T.moveLabel), T.moveLabel);
    var q = G.create(p, {}); q.act({ k: "conclude", coin: 3, heavy: true });
    t.ok("mistakes cộng cả 'kết luận chưa chứng minh' (không có lần cân mất an toàn nào: lostAt = −1) ⇒ mistakeLabel là 'Sai sót' chung, nêu cả hai thứ", q.counters.mistakes === 1 && L.lostAt(p, q.state) === -1 && /^Sai sót/.test(T.mistakeLabel) && /mất an toàn/.test(T.mistakeLabel) && /kết luận/.test(T.mistakeLabel), T.mistakeLabel);
    q.act({ k: "truncate", n: 0 }); L.playOptimal(p).steps.forEach(function (st) { q.act(st.action); });
    var rr = q.record("solved");
    t.ok("thắng sau một lần kết luận sớm bị mở lại: 1★ và chữ nêu ĐÚNG 'sai sót … kết luận chưa được chứng minh' (không đổ cho lần cân mất an toàn)", q.status === "solved" && rr.grade.stars === 1 && /sai sót/.test(rr.grade.text) && /kết luận chưa được chứng minh/.test(rr.grade.text), rr.grade);
    t.ok("luật chơi (rules) nói 'sai sót' và nhắc cả kết luận chưa chứng minh ở mục sao", T.rules.some(function (x) { return /sai sót/.test(x) && /kết luận chưa được chứng minh/.test(x) && /1★/.test(x); }));
  })();

  t.group("coinbalance — grade: nhánh dùng NHIỀU hơn k* (đề tự nhập k > k*)");
  (function () {
    var sl = fromIn(mkInput({ n: 3, k: 3, fake: "heavy", ref: 0, dir: 0 }, "fixed", { coin: 2, heavy: 1 })), cl = { moves: 3, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false };
    var s1 = T.newState(sl); apply(sl, s1, { k: "weigh", L: [0], R: [1] }); apply(sl, s1, { k: "conclude", coin: 2 });
    var s2 = T.newState(sl);
    [{ k: "weigh", L: [0], R: [1] }, { k: "weigh", L: [0], R: [2] }, { k: "weigh", L: [1], R: [2] }, { k: "conclude", coin: 2 }].forEach(function (a) { apply(sl, s2, a); });
    var g1 = T.grade(sl, s1, cl), g2 = T.grade(sl, s2, cl), g3 = T.grade(sl, s2, Object.assign({}, cl, { undos: 1 }));
    t.ok("k* = 1 (3 xu biết nặng): 1 lần cân → 3★ 'Tối ưu'", L.bestK(sl.data) === 1 && g1.stars === 3 && g1.value === 1 && g1.best === 1 && /Tối ưu/.test(g1.text), g1);
    t.ok("cùng đề, dùng 3 lần cân rồi kết luận ĐÚNG (check.solved, không sai sót, không hoàn tác) → chỉ 1★, value 3, best 1, chữ 'Dùng 3 lần cân (đủ trong 1)'", T.check(sl, s2).solved && g2.stars === 1 && g2.value === 3 && g2.best === 1 && /Dùng 3 lần cân \(đủ trong 1\)/.test(g2.text) && g2.quality < g1.quality, g2);
    t.ok("dùng nhiều hơn k* cộng hoàn tác vẫn 1★ (không 'lên' 2★)", g3.stars === 1, g3);
  })();

  t.group("coinbalance — replay: cells của từng bước = đúng các xu của lần cân đó; bước cuối = xu kết luận");
  (function () {
    var bad = [], n = 0, byNum = function (a, b) { return a - b; };
    T.sizes.forEach(function (sz) { MODES.forEach(function (mode) {
      var q = T.generate(15, { sizeId: sz.id, tier: "hard", options: { mode: mode } }), rp = T.replay(q), st = T.newState(q);
      rp.forEach(function (step, i) {
        G.applyDiff(st, step.diff.d, false); n++;
        if (i < rp.length - 1) {
          var rec = L.records(q, st)[i], want = rec.L.concat(rec.R).sort(byNum);
          if (J(step.cells.slice().sort(byNum)) !== J(want) || J(step.cells.slice(0, rec.L.length)) !== J(rec.L)) bad.push([sz.id, mode, i, step.cells, want]);
        } else {
          var cn = L.concluded(q, st);
          if (!cn || J(step.cells) !== J([cn.coin]) || (mode === "fixed" && cn.coin !== q.data.secret.coin)) bad.push([sz.id, mode, "cuối", step.cells, cn]);
        }
      });
    }); });
    t.ok("12 đề × mọi bước replay (" + n + " bước): cells của bước cân = (đĩa trái rồi đĩa phải) của bản ghi lần cân; bước kết luận = [xu kết luận] (= xu giả cố định ở chế độ cố định)", bad.length === 0 && n > 30, bad.slice(0, 3));
  })();

  t.group("coinbalance — đối thủ: phá hoà 'nhiều khả năng hơn' và state hỏng");
  (function () {
    var rng = R.create(4242), cases = 0, npTies = 0, bad = [];
    T.sizes.forEach(function (sz) {
      for (var seed = 1; seed <= 10; seed++) {
        var p = T.generate(seed * 7919, { sizeId: sz.id, tier: TIERS[seed % 4], options: { mode: "adv" } }), d = p.data, goal = L.goalFor(d), C = d.n + d.ref, st = T.newState(p);
        for (var i = 0; i < d.k; i++) {
          var a = randomWeighing(p, st, rng), cls = L.classesOf(d, st), cnt = L.countsOf(cls), cap = Math.max(0, L.budget(d, st) - 1);
          var outs = L.outcomesOf(cnt, L.weighingOf(cls, a.L, a.R)).filter(function (o) { return L.nposs(o.u, o.h, o.l) > 0; });
          outs.forEach(function (o) { o.need = L.need(o, goal, cap); o.np = L.nposs(o.u, o.h, o.l); });
          var mx = Math.max.apply(null, outs.map(function (o) { return o.need; })), hard = outs.filter(function (o) { return o.need === mx; }), mp = Math.max.apply(null, hard.map(function (o) { return o.np; }));
          var want = hard.filter(function (o) { return o.np === mp; }).map(function (o) { return o.code; }), got = L.advResult(p, st, L.panArray(C, a.L, a.R));
          cases++; if (hard.some(function (o) { return o.np !== mp; })) npTies++;
          if (want.indexOf(got) < 0) bad.push([sz.id, seed, i, got, want]);
          apply(p, st, a);
        }
      }
    });
    t.ok("kết quả đối thủ ∈ {nhánh cần nhiều lần cân nhất, trong đó nhiều khả năng hơn} ở " + cases + " lần cân ngẫu nhiên (" + npTies + " lần phải phá hoà bằng số khả năng, nhánh ít khả năng hơn KHÔNG được chọn)", bad.length === 0 && npTies >= 20, [npTies, bad.slice(0, 3)]);
    var hp = fromIn(mkInput({ n: 4, k: 3, fake: "either", ref: 0, dir: 1 }, "adv")), hs = T.newState(hp), br = plan.appendDiff(hs, lay(hp), [[1, 1, 2, 2, 2]], "state hỏng: mọi xu đều thành 'thật'"), thrown = null, dd = null;
    G.applyDiff(hs, br.d, false);
    t.ok("state hỏng/sửa tay (không còn giả thuyết nào): L.advResult trả 2 thay vì ném TypeError", (function () { try { return L.advResult(hp, hs, L.panArray(4, [0], [1])) === 2; } catch (e) { thrown = e; return false; } })(), thrown && thrown.message);
    thrown = null;
    try { dd = T.moveFor(hp, hs, { k: "weigh", L: [0], R: [1] }); } catch (e) { thrown = e; }
    t.ok("…và game.act / moveFor trên state hỏng không ném: ghi lần cân 'cân bằng' (kết quả 2)", !thrown && !!dd && (function () { G.applyDiff(hs, dd.d, false); return plan.read(hs, lay(hp))[1][4] === 2; })(), thrown && thrown.message);
  })();

  t.group("coinbalance — validate dựng lại ĐÚNG lời giải (seed đi theo); văn bản 'xu giả' chặt; sizeText");
  (function () {
    var bad = [], n = 0;
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { MODES.forEach(function (mode) { [1, 2].forEach(function (sd) {
      var p = T.generate(sd * 977, { sizeId: sz.id, tier: tier, options: { mode: mode } }), v = T.validate(p); n++;
      if (!v.ok || J(v.solution) !== J(p.solution)) bad.push([sz.id, tier, mode, sd]);
    }); }); }); });
    t.ok("validate(p).solution ≡ p.solution ở " + n + " đề (đối thủ phá hoà bằng băm có seed — trước đây validate bỏ seed nên 121/144 đề đối thủ ra lời giải KHÁC)", bad.length === 0, bad.slice(0, 3));
    t.ok("đề tự nhập (seed null) vẫn validate ≡ chính nó", (function () { var r = T.fromInput(mkInput({ n: 12, k: 3, fake: "either", ref: 0, dir: 1 }, "adv")); return r.ok && J(T.validate(r.puzzle).solution) === J(r.puzzle.solution); })());
    var base = "xu: 12\nlần cân: 3\nchế độ: đối thủ\nxu giả: ";
    t.ok("fromText: 'xu giả' lạ ('nhẹ hơn', 'light', 'xyz', rỗng) là LỖI nêu đúng khoá — không lặng lẽ thành 'nặng hoặc nhẹ'", ["nhẹ hơn", "light", "xyz", ""].every(function (v) { var r = T.fromText(base + v); return r.ok === false && /xu giả/.test(r.errors[0]); }));
    t.ok("fromText: các cách viết đúng vẫn nhận ('nặng hơn', 'heavy', 'nặng hoặc nhẹ', 'either', 'Nặng/Nhẹ') và cho đúng loại xu", [["nặng hơn", "heavy", "xu: 9\nlần cân: 2\nchế độ: đối thủ\nxu giả: "], ["heavy", "heavy", "xu: 9\nlần cân: 2\nchế độ: đối thủ\nxu giả: "], ["nặng hoặc nhẹ", "either", base], ["either", "either", base], ["Nặng/Nhẹ", "either", base]].every(function (c) { var r = T.fromText(c[2] + c[0]); return r.ok && r.puzzle.data.fake === c[1]; }));
    var rin = T.fromInput({ n: 13, k: 3, fake: "either", ref: 1, dir: 1, mode: "adv" }), gen = T.generate(4, { sizeId: "nn3", tier: "easy" });
    t.ok("sizeText: đề tự nhập hiện '13 xu + chuẩn · 3 lần cân' (không phải '13×3'); đề sinh ra cũng có nhãn; đề lạ → chuỗi rỗng, không ném lỗi", T.sizeText(rin.puzzle) === "13 xu + chuẩn · 3 lần cân" && T.sizeText(gen) === gen.data.n + " xu · 3 lần cân" && T.sizeText({ data: null }) === "" && T.sizeText(null) === "" && Puz.types.conformance(T).length === 0, T.sizeText(rin.puzzle));
  })();

  // ====================================================================== 11. sửa sau kiểm (P3 — vòng 2): gợi ý theo thế HIỆN TẠI; đơn vị của mục tiêu "chỉ ra xu"
  /** Thế giữa ván còn thắng chắc không — nguồn ĐỘC LẬP với DP đếm lớp (k ≤ 3): tập giả thuyết lọc bằng mô phỏng khối lượng + vét cạn mức tập giả thuyết. k = 4 chỉ có DP của engine. */
  function indepWin(p, st) {
    var d = p.data, r = L.budget(d, st);
    if (d.k > 3) { var c = L.countsOf(L.classesOf(d, st)); return L.solv(c.u, c.h, c.l, c.g, r, L.goalFor(d)); }
    return setSolvable(d.n, d.ref, d.fake, !!d.dir, r, consistent(p, st));
  }
  function cloneAfter(p, st, action) { var dd = T.moveFor(p, st, action), q = { v: st.v.slice(), c: null }; if (!dd) return null; G.applyDiff(q, dd.d, false); return q; }

  t.group("coinbalance — gợi ý theo thế HIỆN TẠI: lần cân mất an toàn trong quá khứ nhưng nhờ may thế đã thắng chắc ⇒ KHÔNG khuyên hoàn tác");
  (function () {
    var p = fromIn(mkInput({ n: 9, k: 2, fake: "heavy", ref: 0, dir: 0 }, "fixed", { coin: 2, heavy: 1 })), g = G.create(p, {});
    g.act({ k: "weigh", L: [1, 7], R: [4, 8] });          // 2 với 2 từ 9 xu nặng / 2 lần: nhánh cân bằng còn 5 xu > 3 ⇒ MẤT AN TOÀN; xu giả (chỉ số 2) nằm ngoài đĩa ⇒ cân bằng, thế mất thật
    var lostHint = g.hint(3), lostNow = L.lostAt(p, g.state);
    t.ok("ngay sau lần cân mất an toàn (thế mất thật, nguồn độc lập): lostAt = 1, mistakes = 1, hint 'Hoàn tác' + truncate n = 0, mức 1 nói 'không còn cách' — ĐÚNG",
      lostNow === 1 && g.counters.mistakes === 1 && !indepWin(p, g.state) && lostHint.technique === "Hoàn tác" && lostHint.action.k === "truncate" && lostHint.action.n === 0 && /không còn cách cân nào chắc chắn/.test(g.hint(1).text), [lostNow, lostHint]);
    g.act({ k: "weigh", L: [1, 5, 8], R: [2, 4, 7] });    // chỉ số 2 (nặng) ở đĩa phải; 1, 4, 7, 8 đã là xu thật ⇒ phải nặng hơn ⇒ chỉ còn xu chỉ số 2: nhờ MAY thế đã thắng chắc
    var c = T.check(p, g.state), sc = L.lossScan(p, g.state), h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
    t.ok("sau đó nhờ may: còn đúng 1 xu nghi (complete), thế thắng chắc (nguồn độc lập), mistakes vẫn 1; lostAt = −1 (thế hiện tại không mất), drop = 1 (từng mất ở lần cân 1)",
      c.complete === true && c.solved === false && indepWin(p, g.state) && g.counters.mistakes === 1 && L.lostAt(p, g.state) === -1 && sc.now === -1 && sc.drop === 1, [c, sc, g.counters.mistakes]);
    t.ok("mức 1 KHÔNG nói 'không còn cách'; cả ba mức KHÔNG phải 'Hoàn tác'; mức 2 chỉ xu cần kết luận; mức 3 action = conclude (không phải truncate n = 0 xoá cả kế hoạch)",
      h1.technique === "Kết luận" && !/không còn cách/.test(h1.text) && h2.technique === "Kết luận" && J(h2.cells) === "[2]" && h3.technique === "Kết luận" && !!h3.action && h3.action.k === "conclude" && h3.action.coin === 2 && g.hint(3).action.k !== "truncate", [h1.text, h2.text, h3.action]);
    t.ok("mức 3 có dòng 'Lưu ý' CUỐI nêu lần cân mất an toàn và 'tối đa 1★'; mức 1–2 không có why", /^Lưu ý: lần cân thứ 1 \(\{2, 8\} với \{5, 9\}\) đã làm mất an toàn — nếu .*tối đa 1★/.test(h3.why[h3.why.length - 1]) && h1.why.length === 0 && h2.why.length === 0, h3.why);
    g.applyHint(h3);
    var gr = g.grade();
    t.ok("làm theo gợi ý → solved nhưng đúng 1★ (sai sót đã tính, 'thắng nhờ may')", g.status === "solved" && gr.stars === 1 && /sai sót/.test(gr.text), gr);
    // mất → may thắng lại → mất lại: "Hoàn tác" quay về trước lần cân MỚI NHẤT làm mất (thế thắng gần nhất), không quay về đầu ván
    var pa = fromIn(mkInput({ n: 7, k: 3, fake: "either", ref: 0, dir: 1 }, "fixed", { coin: 4, heavy: 1 })), ga = G.create(pa, {}), flags = [];
    [{ L: [2], R: [5] }, { L: [1, 4], R: [3, 5] }, { L: [3], R: [5] }].forEach(function (w) { ga.act({ k: "weigh", L: w.L, R: w.R }); flags.push(indepWin(pa, ga.state)); });
    var sa = L.lossScan(pa, ga.state), ha = ga.hint(3);
    t.ok("7 xu / 3 lần, giả = xu 5 nặng: cân 1–1 (xu giả ngoài đĩa) làm MẤT, lần 2 nhờ may THẮNG lại, lần 3 (3 với 5 thật) lại MẤT — nguồn độc lập: [mất, thắng, mất]", J(flags) === J([false, true, false]), flags);
    t.ok("lossScan = {now: 3, drop: 1}; hint = Hoàn tác về trước lần cân thứ 3 (truncate n = 2, thế thắng gần nhất), KHÔNG về đầu ván (n = 0); lời giải thích nêu lần cân thứ 3", sa.now === 3 && sa.drop === 1 && ha.technique === "Hoàn tác" && ha.action.k === "truncate" && ha.action.n === 2 && /^Lần cân thứ 3 /.test(ha.why[0]) && /Quay về trước lần cân thứ 3/.test(ha.text), [sa, ha]);
    ga.applyHint(ha);
    var winAfter = indepWin(pa, ga.state) && plan.count(ga.state) === 2, na = 0; while (ga.status !== "solved" && na++ < 6) { var hx = ga.hint(3); if (!hx.action) break; ga.applyHint(hx); }
    t.ok("áp truncate n = 2 → còn 2 lần cân và thế thắng chắc (nguồn độc lập); làm theo gợi ý tiếp giải xong ván", winAfter && ga.status === "solved", [winAfter, plan.count(ga.state), ga.status]);
    // cùng ván nhưng cân an toàn: KHÔNG có dòng lưu ý
    var gs = G.create(p, {}); gs.act({ k: "weigh", L: [0, 1, 2], R: [3, 4, 5] });
    t.ok("ván cân an toàn: không có dòng 'Lưu ý' trong hint mức 3, drop = −1", L.lossScan(p, gs.state).drop === -1 && !gs.hint(3).why.some(function (w) { return /^Lưu ý/.test(w); }));
  })();

  t.group("coinbalance — gợi ý: MỌI thế giữa ván (chơi ngẫu nhiên, 6 phiên bản × 2 chế độ): 'Hoàn tác / không còn cách' ⇔ thế hiện tại MẤT (nguồn độc lập)");
  (function () {
    var rng = R.create(7001), bad = [], scanBad = [], states = 0, lostN = 0, luckN = 0, againN = 0, t0 = Date.now();
    T.sizes.forEach(function (sz, si) { MODES.forEach(function (mode) { for (var seed = 1; seed <= 8; seed++) {
      var p = T.generate(seed * 313 + si, { sizeId: sz.id, tier: TIERS[seed % 4], options: { mode: mode } }), g = G.create(p, {});
      for (var step = 0; step <= p.data.k; step++) {
        var st = g.state, win = indepWin(p, st), sc = L.lossScan(p, st), h1 = T.hint(p, st, 1), h2 = T.hint(p, st, 2), h3 = T.hint(p, st, 3), tag = [sz.id, mode, seed, step];
        states++;
        if ((sc.now >= 0) === win) scanBad.push(tag.concat([sc, win]));                 // lossScan.now ≥ 0 ⇔ thế hiện tại không giải được
        if (win) {
          if (sc.drop >= 1) luckN++;
          if (h1.technique === "Hoàn tác" || h2.technique === "Hoàn tác" || h3.technique === "Hoàn tác" || (h3.action && h3.action.k === "truncate") || /không còn cách/.test(h1.text + h2.text + h3.text)) bad.push(tag.concat(["thế thắng chắc mà gợi ý bảo hoàn tác", h3.text]));
          var last = h3.why.length ? h3.why[h3.why.length - 1] : "";
          if (sc.drop >= 1 !== /^Lưu ý: lần cân thứ \d+ /.test(last)) bad.push(tag.concat(["dòng 'Lưu ý' sai chỗ", sc.drop, last.slice(0, 40)]));
        } else {
          lostN++; if (sc.drop >= 1 && sc.now > sc.drop) againN++;
          var q = h3.action && h3.action.k === "truncate" ? cloneAfter(p, st, h3.action) : null;
          if (h3.technique !== "Hoàn tác" || !q || !indepWin(p, q) || h3.action.n !== sc.now - 1 || !/không còn cách cân nào chắc chắn/.test(h1.text)) bad.push(tag.concat(["thế mất mà gợi ý không đưa về thế thắng", h3.text, h3.action]));
        }
        if (step === p.data.k) break;
        g.act(randomWeighing(p, st, rng));
      }
    } }); });
    t.ok("khớp ở " + states + " thế (" + lostN + " thế mất · " + luckN + " thế thắng-sau-từng-mất · " + againN + " thế mất-lại-sau-khi-may): gợi ý 'Hoàn tác' ⇔ mất thật; hoàn tác đưa về thế thắng chắc; thế thắng chắc không bao giờ bị khuyên hoàn tác (" + (Date.now() - t0) + " ms)", bad.length === 0 && states > 250, bad.slice(0, 3));
    t.ok("lossScan.now ≥ 0 ⇔ thế hiện tại không giải được (nguồn độc lập) ở mọi thế đó", scanBad.length === 0, scanBad.slice(0, 3));
    t.ok("phép kiểm thật sự phủ hai tình huống chính: thế mất (≥ 40) và thắng-sau-từng-mất = đúng ca của lỗi cũ (≥ 4)", lostN >= 40 && luckN >= 4, [lostN, luckN, againN]);
  })();

  t.group("coinbalance — chữ giải thích: 'N khả năng ≤ B' / 'N xu còn nghi ≤ B' có N ≤ B và đúng ĐẠI LƯỢNG của mục tiêu (6 phiên bản × 4 bậc × 2 chế độ × 3 seed)");
  (function () {
    var NAMES = { 1: "bên trái nặng hơn", 2: "cân bằng", 3: "bên phải nặng hơn" }, bad = [], texts = 0, claims = 0, overs = 0, exact = 0, m, re;
    T.sizes.forEach(function (sz) { TIERS.forEach(function (tier) { MODES.forEach(function (mode) { [1, 2, 3].forEach(function (seed) {
      var p = T.generate(seed * 131 + 7, { sizeId: sz.id, tier: tier, options: { mode: mode } }), d = p.data, goal = L.goalFor(d), unit = goal ? "xu còn nghi" : "khả năng", all = [], g = G.create(p, {}), n = 0, tag = [sz.id, tier, mode, seed];
      T.replay(p).forEach(function (stp) { all.push((stp.text || "") + "\n" + (stp.why || []).join("\n")); });
      while (g.status !== "solved" && n++ < d.k + 2) {                        // hint mức 3 từng bước; đối chiếu SỐ in ra với số THẬT của nhánh (từ outcomesOf)
        var st0 = g.state, h = T.hint(p, st0, 3); if (!h.action) break;
        all.push(h.text + "\n" + h.why.join("\n"));
        if (h.action.k === "weigh") {
          var cls = L.classesOf(d, st0), cnt = L.countsOf(cls), first = /^Còn (\d+) (khả năng|xu còn nghi) và /.exec(h.why[0]);
          exact++;
          if (!first || Number(first[1]) !== (goal ? cnt.u + cnt.h + cnt.l : L.nposs(cnt.u, cnt.h, cnt.l)) || first[2] !== unit) bad.push(tag.concat(["dòng đầu sai số/đơn vị", h.why[0]]));
          L.outcomesOf(cnt, L.weighingOf(cls, h.action.L, h.action.R)).forEach(function (o) {
            var cd = o.u + o.h + o.l, want = goal ? cd : L.nposs(o.u, o.h, o.l);
            if (!cd) return;
            var line = h.why.filter(function (w) { return w.indexOf("Nếu " + NAMES[o.code] + ":") === 0; })[0], mm = line && /— (\d+) (khả năng|xu còn nghi)/.exec(line);
            exact++;
            if (!mm || Number(mm[1]) !== want || mm[2] !== unit) bad.push(tag.concat(["nhánh " + NAMES[o.code] + ": số/đơn vị sai (cần " + want + " " + unit + ")", line]));
          });
        }
        g.applyHint(h);
      }
      all.forEach(function (tx) {
        texts++;
        re = /(\d+) (khả năng|xu còn nghi) ≤ (\d+)/g;
        while ((m = re.exec(tx))) { claims++; if (Number(m[1]) > Number(m[3]) || m[2] !== unit) bad.push(tag.concat(["'" + m[0] + "'"])); }
        re = /thì còn (\d+) (khả năng|xu còn nghi) mà \d+ lần cân còn lại chỉ phân biệt được tối đa (\d+)/g;
        while ((m = re.exec(tx))) { overs++; if (Number(m[1]) <= Number(m[3]) || m[2] !== unit) bad.push(tag.concat(["'" + m[0] + "' (phải VƯỢT cận)"])); }
      });
    }); }); }); });
    t.ok("không câu nào tự mâu thuẫn ('10 khả năng ≤ 9'), đơn vị khớp mục tiêu (nặng/nhẹ có hướng: khả năng · chỉ ra xu: xu còn nghi) — " + texts + " đoạn chữ, " + claims + " câu '≤ B', " + overs + " câu 'vượt cận', " + exact + " số đối chiếu với số thật", bad.length === 0 && claims > 300 && overs >= 10 && exact > 400, bad.slice(0, 4));
    // cùng đơn vị ở cây chiến lược (trace)
    var trBad = [];
    T.sizes.forEach(function (sz) {
      var p = T.generate(5, { sizeId: sz.id, tier: "hard" }), goal = L.goalFor(p.data), labs = T.trace(p, { maxNodes: 400 }).nodes.map(function (nd) { return nd.label; });
      if (labs.some(function (lb) { return goal ? /khả năng/.test(lb) : /xu còn nghi/.test(lb); }) || !labs.some(function (lb) { return goal ? /xu còn nghi/.test(lb) : /khả năng/.test(lb); })) trBad.push([sz.id, labs.slice(0, 3)]);
    });
    t.ok("cây chiến lược (trace): nhãn nút đếm cùng đại lượng với mục tiêu — chỉ-ra-xu/biết-nặng dùng 'xu còn nghi', nặng/nhẹ có hướng dùng 'khả năng' (gốc không còn 'N xu · N khả năng')", trBad.length === 0, trBad.slice(0, 2));
  })();

  t.group("coinbalance — đề không giải được: n = 2 thiếu xu chuẩn nói đúng lý do (mọi k); đó là ca DUY NHẤT dưới giới hạn mà vẫn không giải được");
  (function () {
    var msgBad = [], POW = [1, 3, 9, 27, 81];
    [1, 2, 3, 4].forEach(function (k) { [0, 1].forEach(function (dir) {
      var r = T.fromInput(mkInput({ n: 2, k: k, fake: "either", ref: 0, dir: dir }, "adv"));
      if (r.ok || !/không có chiến lược chắc chắn/.test(r.errors[0]) || !/KHÁC nhau/.test(r.errors[0]) || /dù chưa chạm giới hạn/.test(r.errors[0])) msgBad.push([k, dir, r.errors]);
    }); });
    t.ok("n = 2, không xu chuẩn, 'nặng hoặc nhẹ' (k = 1…4 × có/không nói hướng): lý do 'cân hai xu chỉ biết chúng KHÁC nhau', không còn 'dù chưa chạm giới hạn … điều kiện mốc'", msgBad.length === 0, msgBad.slice(0, 2));
    t.ok("vét cạn tường minh: 2 xu 'nặng hoặc nhẹ' không xu chuẩn KHÔNG giải được dù cân 3 lần (cả hai mục tiêu)", !bruteSolvable(2, 0, "either", true, 3) && !bruteSolvable(2, 0, "either", false, 3));
    var odd = [];
    for (var k = 2; k <= 4; k++) [["either", 0, 1], ["either", 0, 0], ["either", 1, 1], ["either", 1, 0], ["heavy", 0, 0], ["heavy", 1, 0]].forEach(function (c) {
      var tt = POW[k], max = c[0] === "heavy" ? tt : c[2] ? (c[1] ? (tt - 1) / 2 : (tt - 3) / 2) : (c[1] ? (tt + 1) / 2 : (tt - 1) / 2);
      for (var n = 2; n <= max; n++) if (L.bestK({ n: n, k: k, fake: c[0], ref: c[1], dir: c[2] }) > k && !(n === 2 && c[0] === "either" && c[1] === 0)) odd.push([k, c.join("/"), n]);
    });
    t.ok("k = 2…4, 6 cấu hình, mọi 2 ≤ n ≤ giới hạn công thức: không giải được ⇒ chỉ khi n = 2, 'nặng hoặc nhẹ', không xu chuẩn (nên câu 'dù chưa chạm giới hạn' chỉ còn là lời giải thích của chính ca đó)", odd.length === 0, odd.slice(0, 3));
  })();

  t.group("coinbalance — đối thủ: phá hoà bằng băm CÓ seed (không luôn chọn nhánh đầu); fromText không tra khoá bằng thuộc tính đối tượng");
  (function () {
    var p = fromIn(mkInput({ n: 9, k: 2, fake: "heavy", ref: 0, dir: 0 }, "adv")), st = T.newState(p), pans = L.panArray(9, [0, 1, 2], [3, 4, 5]), seen = {}, stable = true;
    for (var sd = 1; sd <= 60; sd++) { var ps = Object.assign({}, p, { seed: sd }), a = L.advResult(ps, st, pans); seen[a] = (seen[a] || 0) + 1; if (a !== L.advResult(ps, st, pans)) stable = false; }
    t.ok("3 với 3 từ 9 xu nặng / 2 lần: ba nhánh hoà tuyệt đối (3 xu, cần 1 lần) ⇒ qua 60 seed ra đủ cả ba kết quả 1, 2, 3 (mỗi kết quả ≥ 8 lần), cùng seed luôn cùng kết quả", Object.keys(seen).sort().join() === "1,2,3" && stable && [1, 2, 3].every(function (c) { return seen[c] >= 8; }), seen);
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/coinbalance.js"), "utf8"), base = "xu: 12\nlần cân: 3\nchế độ: đối thủ\nxu giả: nặng hoặc nhẹ", r0 = T.fromText(base), r1 = T.fromText("constructor: 99\n__proto__: x\ntoString: 5\nhasOwnProperty: 1\n" + base);
    t.ok("khoá 'constructor' / '__proto__' / 'toString' / 'hasOwnProperty' bị bỏ qua đúng như khoá lạ: cùng kết quả, không nhiễm prototype; mã tra KEY_MAP bằng hasOwnProperty", r0.ok && r1.ok && J(r1.puzzle.data) === J(r0.puzzle.data) && ({}).x === undefined && ({}).polluted === undefined && /hasOwnProperty\.call\(KEY_MAP/.test(src) && !/KEY_MAP\[ascii\(/.test(src));
  })();

  // ====================================================================== 9. pure: engine không phụ thuộc ngoài data-pz
  t.group("coinbalance — engine thuần");
  (function () {
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/coinbalance.js"), "utf8");
    t.ok("không dùng Math.random / Date / performance.now / DOM / Puz.text / Puz.ui / localStorage trong engine", !/Math\.random|Date\.now|new Date|performance\.now|document\.|window\.|localStorage|Puz\.text|Puz\.ui|Puz\.stats/.test(src));
    t.ok("ES5: không class / mũi tên / template literal", !/\bclass\s+\w|=>|`/.test(src));
  })();
};
