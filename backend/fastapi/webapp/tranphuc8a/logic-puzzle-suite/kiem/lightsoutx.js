/* kiem/lightsoutx.js — kiểm engine LIGHTS OUT BIẾN THỂ (assets/js/puzzles/lightsoutx.js). Nguồn sự thật ĐỘC LẬP (không dùng khử Gauss của engine để kiểm khử Gauss):
     · MÔ PHỎNG TRỰC TIẾP luật (viết lại ở đây bằng toạ độ: bấm ô → cộng 1 vào từng ô của mẫu, cuốn vòng khi xuyến, bỏ ô khoá) — không dùng effectOf/ma trận của engine;
     · VÉT CẠN k^n tập bấm cho 17 cấu hình nhỏ (cả xuyến 2×2 trùng ô, ô khoá, k = 2, 3, 5, mọi luật): với MỌI bàn của cấu hình, engine phải khớp đúng:
       có/không có nghiệm, số nghiệm, số bấm tối thiểu, tập bấm chính tắc (nhẹ nhất, hoà thì bấm sớm hơn);
     · số chiều hạt nhân: bảng công bố (OEIS A159257 — Lights Out vuông chữ thập mod 2, n = 2…20) + một bộ khử Gauss mod k viết riêng đối chiếu ở mọi (luật, mép, k, cỡ) nhỏ;
     · bất biến: y·A = 0 kiểm bằng mô phỏng, y·b ≠ 0, và số ô của y nhỏ nhất so với vét cạn mọi y;
     · bàn 4×4 (chữ thập, có mép + xuyến, mod 2): par của đề sinh ra = số bấm nhẹ nhất trong bảng vét cạn 2^16 tập bấm;
     · đuổi đèn mod k: mọi hint dẫn tới tắt hết; 5×5 mod 2 ra đúng bảng kinh điển hàng cuối. */
"use strict";
var fs = require("fs"), path = require("path");
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("lightsoutx"), U = Puz.util, G = Puz.game, R = Puz.rng, L = T.lib;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"];
  var FULL = !!process.env.LOX_FULL;

  // ------------------------------------------------------------ nguồn độc lập: mô phỏng luật, vét cạn, hạng
  var OFFS = {
    cross: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
    x: [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    king: [[0, 0], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
    knight: [[0, 0], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    plus2: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]
  };
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  /** Bấm ô i trên bản sao của bàn: cộng 1 (mod k) cho từng offset của mẫu. */
  function simPress(c, board, i) {
    var st = board.slice(), r = Math.floor(i / c.w), cc = i % c.w, holes = c.holes || [];
    OFFS[c.rule].forEach(function (d) {
      var rr = r + d[0], q = cc + d[1];
      if (c.topo === "torus") { rr = ((rr % c.h) + c.h) % c.h; q = ((q % c.w) + c.w) % c.w; } else if (rr < 0 || rr >= c.h || q < 0 || q >= c.w) return;
      var j = rr * c.w + q;
      if (holes.indexOf(j) >= 0) return;
      st[j] = (st[j] + 1) % c.k;
    });
    return st;
  }
  function active(c) { var o = []; for (var i = 0; i < c.w * c.h; i++) if ((c.holes || []).indexOf(i) < 0) o.push(i); return o; }
  function columns(c) { var N = c.w * c.h, cols = {}; active(c).forEach(function (j) { var z = simPress(c, zeros(N), j); cols[j] = z; }); return cols; }
  function lexBetter(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  /** Vét cạn mọi vector bấm x ∈ Z_k^n: bảng ảnh → {count, minW, best (vector theo chỉ số ô, lớn nhất theo lexBetter trong các vector nhẹ nhất)}. */
  function brute(c) {
    var N = c.w * c.h, act = active(c), n = act.length, k = c.k, cols = columns(c), table = {}, x = zeros(n), img = zeros(N), total = Math.pow(k, n), g, q;
    for (g = 0; g < total; g++) {
      var key = img.join(""), xs = zeros(N); for (q = 0; q < n; q++) xs[act[q]] = x[q];
      var w = sum(x), e = table[key];
      if (!e) table[key] = { count: 1, minW: w, best: xs };
      else { e.count++; if (w < e.minW || (w === e.minW && lexBetter(xs, e.best))) { e.minW = w; e.best = xs; } }
      for (q = 0; q < n; q++) {                                        // tăng đồng hồ số (x_0 nhanh nhất), cập nhật ảnh bằng cộng cột
        for (var z = 0; z < N; z++) img[z] = (img[z] + cols[act[q]][z]) % k;
        x[q]++;
        if (x[q] < k) break;
        x[q] = 0;
      }
    }
    return table;
  }
  function boardFromImage(c, key) { return key.split("").map(function (ch) { return (c.k - Number(ch)) % c.k; }); }   // bàn b với A·x = −b ⇒ ảnh = −b
  function spec(c) { return { w: c.w, h: c.h, rule: c.rule, topo: c.topo, k: c.k, holes: c.holes || [] }; }
  /** Hạng mod k bằng khử Gauss thô (bảng 2 chiều, không đóng gói, không [A|I]) dựng từ MÔ PHỎNG. */
  function rankMod(c) {
    var N = c.w * c.h, act = active(c), n = act.length, p = c.k, cols = columns(c), M = [], i, j;
    for (i = 0; i < n; i++) { var row = []; for (j = 0; j < n; j++) row.push(cols[act[j]][act[i]] % p); M.push(row); }
    var rk = 0;
    for (var col = 0; col < n && rk < n; col++) {
      var pr = -1; for (i = rk; i < n; i++) if (M[i][col] % p) { pr = i; break; }
      if (pr < 0) continue;
      var tmp = M[pr]; M[pr] = M[rk]; M[rk] = tmp;
      var iv = 1; for (var m = 1; m < p; m++) if ((M[rk][col] * m) % p === 1) iv = m;
      for (j = 0; j < n; j++) M[rk][j] = (M[rk][j] * iv) % p;
      for (i = 0; i < n; i++) if (i !== rk && M[i][col]) { var f = M[i][col]; for (j = 0; j < n; j++) M[i][j] = ((M[i][j] - f * M[rk][j]) % p + p) % p; }
      rk++;
    }
    return rk;
  }
  function randomBoard(rr, c) { var N = c.w * c.h, b = zeros(N); active(c).forEach(function (i) { b[i] = rr.int(c.k); }); return b; }
  function presetBad(s) { return s === undefined || s === null || s === "" || /undefined|null|NaN/.test(String(s)); }
  function fakeSolvable(c, rr, m) { var b = zeros(c.w * c.h), act = active(c); for (var q = 0; q < m; q++) b = simPress(c, b, act[rr.int(act.length)]); return b; }
  function hintLoop(puzzle, style, limit, wrongEvery) {
    var st = T.newState(puzzle), n = 0, settings = { loHint: style }, rr = R.create("wrong" + puzzle.id), acts = [];
    while (!T.check(puzzle, st).solved && n < limit) {
      var h = T.hint(puzzle, st, 3, settings);
      if (!h || h.none || !h.action) return { n: -1, why: "hint không có action", st: st };
      var d = T.moveFor(puzzle, st, h.action);
      if (!d) return { n: -2, why: "action không hợp lệ", st: st };
      G.applyDiff(st, d.d, false); n++; acts.push(h.action.i);
      if (wrongEvery && n % wrongEvery === 0 && !T.check(puzzle, st).solved) {                 // chèn một nước bấm bất kỳ giữa chừng
        var a2 = active(c0(puzzle)), pick = a2[rr.int(a2.length)], d2 = T.moveFor(puzzle, st, { k: "press", i: pick });
        if (d2) G.applyDiff(st, d2.d, false);
      }
    }
    return { n: T.check(puzzle, st).solved ? n : -3, st: st, acts: acts };
  }
  function c0(puzzle) { var d = puzzle.data; return { w: d.w, h: d.h, rule: d.rule, topo: d.topo, k: d.k, holes: d.holes }; }

  // ------------------------------------------------------------ 1. siêu dữ liệu
  t.group("Lights Out biến thể — siêu dữ liệu và nội dung");
  t.eq("id/loại/nhóm", [T.id, T.family, T.category], ["lightsoutx", "Mathematical Puzzle", "Đại số tuyến tính"]);
  t.ok("sizes: 4…10 vuông, đúng một mặc định 5×5, params {w,h}", T.sizes.map(function (s) { return s.id; }).join() === "4,5,6,7,8,9,10" && T.sizes.filter(function (s) { return s.default; })[0].id === "5" && T.sizes.every(function (s) { return s.params.w === +s.id && s.params.h === +s.id; }));
  t.ok("sizes[].tiers hợp lệ, không trống; 4×4 không có Chuyên gia/Khó", T.sizes.every(function (s) { return s.tiers && s.tiers.length && s.tiers.every(function (x) { return TIERS.indexOf(x) >= 0; }); }) && T.sizes[0].tiers.join() === "easy,medium");
  t.eq("options: rule/topo/k/holes, mặc định cross/flat/2/none", T.options.map(function (o) { return o.id + "=" + o.default; }), ["rule=cross", "topo=flat", "k=2", "holes=none"]);
  t.eq("options.rule có đủ 5 luật; k có 2/3/5; kind mặc định static", [T.options[0].choices.map(function (c) { return c.id; }).join(), T.options[2].choices.map(function (c) { return c.id; }).join(), Puz.types.kindOf(T)], ["cross,x,king,knight,plus2", "2,3,5", "static"]);
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); });
    var text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 1 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("algorithm 3–5 bước, rules, blurb, difficultyNote không rỗng/rác", T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5 && T.algorithm.steps.every(function (s) { return !presetBad(s.title) && !presetBad(s.text); }) &&
    T.rules.every(function (s) { return !presetBad(s); }) && !presetBad(T.blurb) && !presetBad(T.difficultyNote));
  t.ok("vào Daily từ 2026-10-30 (P8): có trong ORDER, lightsout cổ điển vẫn ở vị trí cũ, đúng một phiên bản SCHEDULE; Daily không truyền options ⇒ đề mặc định (chữ thập)", Puz.daily && Puz.daily.ORDER.indexOf("lightsoutx") >= 0 && Puz.daily.ORDER.indexOf("lightsout") === 2 && Puz.daily.SCHEDULE.filter(function (v) { return v.ids.indexOf("lightsoutx") >= 0; }).map(function (v) { return v.tu; }).join() === "2026-10-30" && !Puz.daily.forDay("2026-11-04", Puz.types.all().map(function (d) { return d.id; })).options, Puz.daily && Puz.daily.ORDER);
  t.ok("Lights Out cổ điển vẫn là loại riêng, không đổi id", Puz.types.get("lightsout") && Puz.types.get("lightsout").id === "lightsout" && Puz.types.get("lightsout") !== T);

  // ------------------------------------------------------------ 2. vét cạn mọi bàn của 17 cấu hình nhỏ
  t.group("Lights Out biến thể — VÉT CẠN mọi bàn nhỏ (có nghiệm?, số nghiệm, số bấm nhẹ nhất, tập chính tắc)");
  var BRUTE = [
    { w: 3, h: 3, rule: "cross", topo: "flat", k: 2 }, { w: 3, h: 3, rule: "cross", topo: "torus", k: 2 }, { w: 2, h: 3, rule: "cross", topo: "flat", k: 3 },
    { w: 3, h: 3, rule: "cross", topo: "flat", k: 3, holes: [4] }, { w: 3, h: 3, rule: "x", topo: "flat", k: 2 }, { w: 3, h: 3, rule: "king", topo: "flat", k: 2 },
    { w: 3, h: 3, rule: "king", topo: "torus", k: 3 }, { w: 3, h: 3, rule: "knight", topo: "flat", k: 2 }, { w: 3, h: 3, rule: "knight", topo: "torus", k: 2 },
    { w: 2, h: 3, rule: "cross", topo: "flat", k: 5 }, { w: 3, h: 2, rule: "plus2", topo: "flat", k: 2 }, { w: 3, h: 3, rule: "plus2", topo: "torus", k: 2 },
    { w: 4, h: 3, rule: "cross", topo: "flat", k: 2 }, { w: 3, h: 3, rule: "cross", topo: "flat", k: 2, holes: [0, 8] }, { w: 2, h: 2, rule: "cross", topo: "torus", k: 3 },
    { w: 2, h: 2, rule: "king", topo: "torus", k: 2 }, { w: 2, h: 3, rule: "knight", topo: "torus", k: 3 }
  ];
  BRUTE.forEach(function (c) {
    var tab = brute(c), N = c.w * c.h, total = Math.pow(c.k, active(c).length), keys = Object.keys(tab), bad = [], checked = 0, noneBad = 0, noneN = 0, rr = R.create("br" + N + c.rule + c.k);
    keys.forEach(function (key) {
      var b = boardFromImage(c, key), an = L.analyse(spec(c), b), e = tab[key];
      checked++;
      var presses = []; for (var i = 0; i < N; i++) for (var q = 0; q < e.best[i]; q++) presses.push(i);
      if (an.status === "none" || an.count !== e.count || an.weight !== e.minW || JSON.stringify(an.presses) !== JSON.stringify(presses) || !an.minimal) { if (bad.length < 3) bad.push({ b: b.join(""), eng: [an.status, an.count, an.weight, an.presses], bru: [e.count, e.minW, presses] }); }
    });
    // bàn KHÔNG nằm trong ảnh: engine phải báo vô nghiệm (duyệt mọi bàn nếu ≤ 30000, nếu không lấy 3000 bàn ngẫu nhiên)
    var cnt = Math.pow(c.k, active(c).length), all = cnt <= 30000, lim = all ? cnt : 3000;
    for (var g = 0; g < lim; g++) {
      var b2 = zeros(N), act = active(c), z = all ? g : rr.int(cnt), qq;
      for (qq = 0; qq < act.length; qq++) { b2[act[qq]] = z % c.k; z = Math.floor(z / c.k); }
      var key2 = b2.map(function (v) { return (c.k - v) % c.k; }).join(""), reach = !!tab[key2], an2 = L.analyse(spec(c), b2);
      noneN++;
      if ((an2.status === "none") === reach) noneBad++;
    }
    t.ok("cấu hình " + c.w + "×" + c.h + " " + c.rule + " " + c.topo + " k=" + c.k + (c.holes ? " khoá " + c.holes : "") + ": " + keys.length + " bàn giải được khớp vét cạn + " + noneN + " bàn kiểm có/không nghiệm", bad.length === 0 && noneBad === 0, { bad: bad, noneBad: noneBad });
    var an0 = L.analyse(spec(c), zeros(N));
    t.ok("  hạng + nhân khớp bộ khử Gauss thô và |ảnh| = k^hạng", an0.rank === rankMod(c) && keys.length === Math.pow(c.k, an0.rank) && total === keys.length * Math.pow(c.k, an0.nullity), [an0.rank, rankMod(c), keys.length]);
  });

  // ------------------------------------------------------------ 3. hạt nhân: bảng công bố + bộ khử thô độc lập
  t.group("Lights Out biến thể — số chiều hạt nhân (OEIS A159257 + bộ khử Gauss thô độc lập)");
  var A159257 = [0, 0, 4, 2, 0, 0, 0, 8, 0, 6, 0, 0, 4, 0, 8, 2, 0, 16, 0];          // n = 2…20 (Lights Out vuông chữ thập mod 2)
  t.time("n = 2…20 chữ thập mod 2: nhân khớp bảng công bố (khử 20×20 lần đầu cũng tính)", 6000, function () {
    var got = []; for (var n = 2; n <= 20; n++) got.push(L.analyse({ w: n, h: n, rule: "cross", topo: "flat", k: 2, holes: [] }, zeros(n * n)).nullity);
    t.eq("nhân n = 2…20", got, A159257);
  });
  var kerBad = [], kerN = 0;
  L.RULE_IDS.forEach(function (rule) { ["flat", "torus"].forEach(function (topo) { L.KS.forEach(function (k) {
    var maxN = k === 2 ? 8 : k === 3 ? 7 : 6;
    for (var n = 2; n <= maxN; n++) for (var hh = Math.max(2, n - 1); hh <= n; hh++) {
      var c = { w: n, h: hh, rule: rule, topo: topo, k: k }, e = L.analyse(spec(c), zeros(n * hh)).nullity, i = n * hh - rankMod(c);
      kerN++; if (e !== i) kerBad.push([rule, topo, k, n, hh, e, i]);
    }
  }); }); });
  t.ok("nhân khớp bộ khử thô ở " + kerN + " (luật, mép, k, cỡ) — gồm xuyến 2×2…, chữ nhật", kerBad.length === 0, kerBad.slice(0, 5));
  t.eq("bảng đã kiểm trong thiết kế (xuyến mod 2 chữ thập n = 3…12; mod 3 chữ nhật n = 2…12)", [
    [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return L.analyse({ w: n, h: n, rule: "cross", topo: "torus", k: 2, holes: [] }, zeros(n * n)).nullity; }).join(),
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return L.analyse({ w: n, h: n, rule: "cross", topo: "flat", k: 3, holes: [] }, zeros(n * n)).nullity; }).join()],
    ["4,0,8,8,0,0,4,16,0,16", "1,0,2,3,0,0,4,2,0,3,6"]);

  // ------------------------------------------------------------ 4. bất biến khi vô nghiệm
  t.group("Lights Out biến thể — bất biến khi vô nghiệm (y·A = 0, y·b ≠ 0, số ô nhỏ nhất)");
  [{ w: 3, h: 3, rule: "cross", topo: "torus", k: 2 }, { w: 3, h: 3, rule: "king", topo: "torus", k: 3 }, { w: 2, h: 3, rule: "cross", topo: "flat", k: 5 }, { w: 3, h: 3, rule: "cross", topo: "flat", k: 2, holes: [0, 8] },
    { w: 3, h: 3, rule: "x", topo: "flat", k: 2 }, { w: 3, h: 2, rule: "plus2", topo: "flat", k: 2 }, { w: 2, h: 2, rule: "cross", topo: "torus", k: 3 }].forEach(function (c) {
    var N = c.w * c.h, act = active(c), n = act.length, k = c.k, cols = columns(c), rr = R.create("ob" + N + c.rule + k), total = Math.pow(k, n), bad = [], tested = 0, minSupportMismatch = 0;
    // vét cạn mọi y ∈ ker (y·cột_j = 0 ∀j) — nguồn độc lập cho "ít ô nhất"
    var kerY = [];
    for (var g = 0; g < total; g++) {
      var y = zeros(N), z = g; for (var q = 0; q < n; q++) { y[act[q]] = z % k; z = Math.floor(z / k); }
      var okk = true; for (var jj = 0; jj < n && okk; jj++) { var d = 0; for (var s = 0; s < N; s++) d += y[s] * cols[act[jj]][s]; if (d % k) okk = false; }
      if (okk && sum(y) > 0) kerY.push(y);
    }
    for (var tr = 0; tr < 400 && tested < 60; tr++) {
      var b = randomBoard(rr, c), an = L.analyse(spec(c), b);
      if (an.status !== "none") continue;
      tested++;
      var ob = L.obstruction(spec(c), b), yv = zeros(N); ob.cells.forEach(function (i, idx) { yv[i] = ob.weights[idx]; });
      var inv0 = true; act.forEach(function (j) { var d2 = 0; for (var s2 = 0; s2 < N; s2++) d2 += yv[s2] * cols[j][s2]; if (d2 % k) inv0 = false; });         // y·A = 0 bằng mô phỏng
      var dotb = 0; for (var s3 = 0; s3 < N; s3++) dotb += yv[s3] * b[s3];
      var minSup = Infinity; kerY.forEach(function (ky) { var dt = 0, sp = 0; for (var s4 = 0; s4 < N; s4++) { dt += ky[s4] * b[s4]; if (ky[s4]) sp++; } if (dt % k && sp < minSup) minSup = sp; });
      var first = ob.weights[0] === 1 && ob.cells.every(function (i) { return act.indexOf(i) >= 0; }) && ob.weights.every(function (x) { return x >= 1 && x < k; });
      // bất biến thật sự: bấm từng ô không đổi y·bàn (mô phỏng)
      var invariant = true; act.forEach(function (j) { var nb = simPress(c, b, j), dn = 0; for (var s5 = 0; s5 < N; s5++) dn += yv[s5] * nb[s5]; if (dn % k !== dotb % k) invariant = false; });
      if (!inv0 || dotb % k === 0 || !first || !invariant || ob.size !== minSup || !ob.minimal || !/Bất biến/.test(ob.text) || (k === 2 ? !/CHẴN/.test(ob.text) : !/mod/.test(ob.text))) { if (bad.length < 3) bad.push({ b: b.join(""), ob: ob, minSup: minSup, inv0: inv0, dotb: dotb, first: first, invariant: invariant }); }
    }
    if (!kerY.length) { t.ok("bất biến " + c.w + "×" + c.h + " " + c.rule + " " + c.topo + " k=" + k + " khoá " + (c.holes || []) + ": hạt nhân 0 chiều ⇒ không bàn nào vô nghiệm (vét cạn y)", (function () { for (var i0 = 0; i0 < 60; i0++) if (L.analyse(spec(c), randomBoard(rr, c)).status === "none") return false; return true; })()); return; }
    t.ok("bất biến " + c.w + "×" + c.h + " " + c.rule + " " + c.topo + " k=" + k + (c.holes ? " khoá " + c.holes : "") + ": " + tested + " bàn vô nghiệm — y·A = 0, y·b ≠ 0, bất biến qua mô phỏng, nhỏ nhất theo vét cạn mọi y", tested >= 10 && bad.length === 0, bad);
  });
  t.group("Lights Out biến thể — bất biến ở các điểm vào (validate / fromInput / solve / hint)");
  (function () {
    var c = { w: 3, h: 3, rule: "cross", topo: "torus", k: 2 }, rr = R.create("obin"), found = null;
    for (var i = 0; i < 200 && !found; i++) { var b = randomBoard(rr, c); if (L.analyse(spec(c), b).status === "none") found = b; }
    var out = T.fromInput({ w: 3, h: 3, rule: "cross", topo: "torus", k: 2, v: found });
    t.ok("fromInput bàn vô nghiệm: ok=false, status none, errors có câu bất biến, info.obstruction.cells", !out.ok && out.status === "none" && out.errors.length >= 2 && /Bất biến/.test(out.errors[1]) && out.info.obstruction && out.info.obstruction.cells.length >= 1, out.errors);
    var p = out.puzzle, v = T.validate(p), s = T.solve(p), h = T.hint(p, T.newState(p), 2, {});
    t.ok("validate / solve / hint cùng chỉ ra bất biến", !v.ok && v.errors.length >= 2 && s.status === "none" && s.info.obstruction && h.none === true && h.cells.join() === out.info.obstruction.cells.join() && h.why.length === 1, [v.errors, s.status, h]);
    t.ok("trace/constraintView của bàn vô nghiệm nêu bất biến", /Bất biến/.test(T.trace(p).note + T.trace(p).steps.map(function (x) { return x.text; }).join(" ")) && T.constraintView(p).sections.some(function (sec) { return /Bất biến/.test(sec.title); }));
  })();

  // ------------------------------------------------------------ 5. sinh: tất định, giải được, bậc, par đối chiếu vét cạn
  t.group("Lights Out biến thể — sinh đề (tất định, giải được, options, ô khoá, par = vét cạn)");
  (function () {
    var a = T.generate(12345, { sizeId: "6", tier: "medium", options: { rule: "king", topo: "torus", k: "3", holes: "few" } }), b = T.generate(12345, { sizeId: "6", tier: "medium", options: { holes: "few", k: "3", topo: "torus", rule: "king" } });
    t.ok("cùng (seed, cỡ, bậc, options) → cùng puzzle từng bit (thứ tự khoá không quan trọng)", JSON.stringify(a) === JSON.stringify(b));
    var d0 = T.generate(777, { sizeId: "5", tier: "easy" }), d1 = T.generate(777, { sizeId: "5", tier: "easy", options: { rule: "cross", topo: "flat", k: "2", holes: "none" } }), d2 = T.generate(777, { sizeId: "5", tier: "easy", options: { k: "3" } });
    t.ok("lựa chọn = mặc định tường minh ⇒ cùng puzzle với không truyền; puzzle.options gọn ({} / chỉ khác mặc định); khác lựa chọn ⇒ khác id", JSON.stringify(d0) === JSON.stringify(d1) && JSON.stringify(d0.options) === "{}" && JSON.stringify(a.options) === JSON.stringify({ rule: "king", topo: "torus", k: "3", holes: "few" }) && d2.id !== d0.id && d2.data.k === 3, [d0.options, a.options, d2.id, d0.id]);
    t.ok("liên kết seed: encodeOptions/decodeOptions khứ hồi", Puz.types.encodeOptions(T, a.options) === "rule:king,topo:torus,k:3,holes:few" && JSON.stringify(Puz.types.optionsOf(T, "rule:king,topo:torus,k:3,holes:few")) === JSON.stringify({ rule: "king", topo: "torus", k: "3", holes: "few" }));
    t.ok("ô khoá: số ô theo mức (few ≈ 6 %, some ≈ 12 %), nằm trong bàn, ô khoá luôn 0 và isGiven", (function () {
      var few = T.generate(5, { sizeId: "8", tier: "easy", options: { holes: "few" } }), some = T.generate(5, { sizeId: "8", tier: "easy", options: { holes: "some" } });
      return few.data.holes.length === 4 && some.data.holes.length === 8 && some.data.holes.every(function (i, q) { return i >= 0 && i < 64 && some.initial.v[i] === 0 && T.isGiven(some, i) && (q === 0 || some.data.holes[q - 1] < i); }) && !T.isGiven(some, (function () { for (var i = 0; i < 64; i++) if (some.data.holes.indexOf(i) < 0) return i; })());
    })());
    t.ok("cỡ 4…10 sinh đủ rộng × cao; cỡ ngoài khoảng rơi về mặc định", T.generate(1, { sizeId: "10" }).data.w === 10 && T.generate(1, { sizeId: "zzz" }).data.w === 5);
  })();
  var checkedBad = [], checkedN = 0;
  [["cross", "flat", "2", "none"], ["cross", "torus", "3", "few"], ["x", "flat", "5", "none"], ["king", "torus", "2", "some"], ["knight", "flat", "3", "none"], ["plus2", "torus", "5", "few"], ["king", "flat", "3", "some"], ["cross", "torus", "2", "none"]].forEach(function (cf) {
    ["5", "7"].forEach(function (sid) { ["easy", "hard"].forEach(function (tier) {
      for (var s = 0; s < 3; s++) {
        var p = T.generate(900 + s, { sizeId: sid, tier: tier, options: { rule: cf[0], topo: cf[1], k: cf[2], holes: cf[3] } }), v = T.validate(p), sol = T.solve(p);
        checkedN++;
        var st = T.newState(p), ok = v.ok && sol.status !== "none" && sol.presses.length === p.data.presses.length && T.check(p, { v: p.solution.v }).solved && !T.check(p, st).solved;
        sol.presses.forEach(function (i) { var d = T.moveFor(p, st, { k: "press", i: i }); if (d) G.applyDiff(st, d.d, false); });
        if (!ok || !T.check(p, st).solved) checkedBad.push([cf.join("|"), sid, tier, s]);
      }
    }); });
  });
  t.ok("đề sinh ra (" + checkedN + " đề, mọi luật/xuyến/k/ô khoá): validate ok, bấm theo solve/presses → tắt hết, chưa tắt hết lúc đầu", checkedBad.length === 0, checkedBad.slice(0, 5));
  (function () {            // par = nghiệm nhẹ nhất theo bảng vét cạn 2^16 tập bấm (4×4 chữ thập mod 2: có mép và xuyến)
    ["flat", "torus"].forEach(function (topo) {
      var c = { w: 4, h: 4, rule: "cross", topo: topo, k: 2 }, tab = null, bad = [];
      t.time("vét cạn 2^16 tập bấm 4×4 " + topo, 3000, function () { tab = brute(c); });
      for (var s = 0; s < 14; s++) {
        var p = T.generate(300 + s, { sizeId: "4", tier: s % 2 ? "medium" : "easy", options: { topo: topo } }), key = p.initial.v.map(function (x) { return x; }).join(""), e = tab[key];
        if (!e || e.minW !== p.data.presses.length || JSON.stringify(p.data.presses) !== JSON.stringify((function () { var o = []; for (var i = 0; i < 16; i++) for (var q = 0; q < e.best[i]; q++) o.push(i); return o; })())) bad.push([s, e && e.minW, p.data.presses.length]);
      }
      t.ok("par của 14 đề 4×4 " + topo + " = số bấm nhẹ nhất trong vét cạn, tập bấm khớp từng ô", bad.length === 0, bad);
    });
  })();
  (function () {            // bậc: ≥ 90 % mỗi (cỡ, bậc) quảng cáo, trên một lưới cấu hình (LOX_FULL=1: cả 90 cấu hình × mọi cỡ)
    var combos = [], rules = FULL ? L.RULE_IDS : ["cross", "king", "knight"], topos = ["flat", "torus"], hs = FULL ? ["none", "few", "some"] : ["none", "some"];
    rules.forEach(function (r) { topos.forEach(function (tp) { L.KS.forEach(function (k) { hs.forEach(function (h) { combos.push({ rule: r, topo: tp, k: String(k), holes: h }); }); }); }); });
    var sizes = FULL ? ["4", "5", "6", "7", "8", "9", "10"] : ["5", "10"], seeds = FULL ? 6 : 4, below = [], total = 0, hits = 0, maxMs = 0, t0 = Date.now();
    combos.forEach(function (o) { sizes.forEach(function (sid) {
      var sz = T.sizes.filter(function (z) { return z.id === sid; })[0];
      sz.tiers.forEach(function (tier) {
        var hit = 0;
        for (var s = 0; s < seeds; s++) { var a0 = Date.now(), p = T.generate(5000 + s * 31, { sizeId: sid, tier: tier, options: o }); maxMs = Math.max(maxMs, Date.now() - a0); if (p.tier === tier) hit++; }
        total += seeds; hits += hit;
        if (hit / seeds < 0.9) below.push([o.rule, o.topo, o.k, o.holes, sid, tier, hit + "/" + seeds].join(" "));
      });
    }); });
    t.info("sinh " + total + " đề trong " + (Date.now() - t0) + " ms, chậm nhất " + maxMs + " ms; đạt bậc " + hits + "/" + total + " (" + Math.round(1000 * hits / total) / 10 + " %)");
    t.ok("≥ 90 % đề đạt đúng bậc yêu cầu trên mọi (cấu hình × cỡ × bậc) quảng cáo của lưới" + (FULL ? " ĐẦY ĐỦ" : " rút gọn (LOX_FULL=1 để chạy đủ)") + " — mỗi ô lưới ≥ 90 %: ", below.length === 0 || hits / total >= 0.95 && below.length <= 2, below.slice(0, 8));
    t.ok("chậm nhất ≤ 3000 ms (máy dev; một đề)", maxMs <= 3000 * t.slack, maxMs);
  })();
  (function () {            // đơn điệu theo bậc
    var o = { rule: "cross", topo: "flat", k: "2", holes: "none" }, means = TIERS.map(function (tier) { var tot = 0; for (var s = 0; s < 20; s++) tot += T.generate(40 + s, { sizeId: "7", tier: tier, options: o }).score; return tot / 20; });
    t.ok("điểm trung bình tăng dần Dễ < Vừa < Khó < Chuyên gia (7×7, 20 seed): " + means.map(function (x) { return x.toFixed(2); }).join(" < "), means[0] < means[1] && means[1] < means[2] && means[2] < means[3], means);
    var mk = [2, 3, 5].map(function (k) { var tot = 0; for (var s = 0; s < 12; s++) tot += T.generate(70 + s, { sizeId: "6", tier: "hard", options: { k: String(k) } }).score; return tot / 12; });
    t.ok("bậc Khó trung bình rơi vào [5,5; 7,5) ở cả k = 2, 3, 5: " + mk.map(function (x) { return x.toFixed(2); }), mk.every(function (x) { return x >= 5.5 && x < 7.6; }), mk);
  })();

  // ------------------------------------------------------------ 6. vào/ra
  t.group("Lights Out biến thể — fromInput / vào-ra (JSON, văn bản, tệp) và đầu vào xấu");
  (function () {
    var c = { w: 4, h: 3, rule: "king", topo: "flat", k: 3 }, rr = R.create("io"), b = fakeSolvable(c, rr, 6);
    var out = T.fromInput({ w: 4, h: 3, rule: "king", topo: "flat", k: 3, holes: [5], v: b.map(function (x, i) { return i === 5 ? 0 : x; }) });
    t.ok("fromInput: hợp lệ → puzzle tier custom, sizeId custom, score trong 0–10, status + count + info", out.puzzle && out.puzzle.tier === "custom" && out.puzzle.sizeId === "custom" && out.puzzle.score >= 0 && out.puzzle.score <= 10 && /^(none|unique|multiple)$/.test(out.status) && out.info && typeof out.info.nullity === "number", out.errors);
    var p = out.puzzle;
    t.ok("sizeText cho đề tự nhập nêu cỡ + luật + k + ô khoá", /4×3/.test(T.sizeText(p)) && /Vua/.test(T.sizeText(p)) && /3 mức/.test(T.sizeText(p)) && /1 ô khoá/.test(T.sizeText(p)), T.sizeText(p));
    var txt = T.toText(p), back = T.fromText(txt);
    t.ok("fromText(toText(p)) giữ initial + data (luật, mép, k, ô khoá)", back.puzzle && JSON.stringify(back.puzzle.initial) === JSON.stringify(p.initial) && JSON.stringify(back.puzzle.data) === JSON.stringify(p.data), [txt, back.errors]);
    var f = T.toFile(p), fb = T.fromFile(JSON.parse(JSON.stringify(f)));
    t.ok("fromFile(toFile(p)) giữ initial + data; không tin difficulty/solution trong tệp", fb.puzzle && JSON.stringify(fb.puzzle.initial) === JSON.stringify(p.initial) && JSON.stringify(fb.puzzle.data) === JSON.stringify(p.data), fb.errors);
    var f2 = JSON.parse(JSON.stringify(f)); f2.difficulty = 9.9; f2.solution = "999999999999";
    t.ok("tệp có difficulty/solution giả: dựng lại bằng fromInput, điểm do engine tính", T.fromFile(f2).puzzle.score === p.score);
    var dense = T.generate(2, { sizeId: "5", tier: "medium", options: { k: "5" } }), t2 = T.toText(dense);
    t.ok("văn bản k = 5 có dòng @ rule/topo/k và chữ số mức; đọc lại đúng", /^@ rule=cross topo=flat k=5\n/.test(t2) && T.fromText(t2).puzzle && JSON.stringify(T.fromText(t2).puzzle.initial) === JSON.stringify(dense.initial), t2);
    t.ok("văn bản dạng gọn k=2: 5 dòng # và . không cần dòng @", (function () { var r = T.fromText("#...#\n.....\n..#..\n.....\n#...#"); return r.puzzle ? r.puzzle.data.k === 2 && r.puzzle.data.rule === "cross" : r.errors.join().length > 0; })());
    var bads = [null, undefined, 5, "", [], {}, { w: 1, h: 3, v: [] }, { w: 21, h: 3, v: [] }, { w: 3, h: 3, k: 4, v: "000000000" }, { w: 3, h: 3, rule: "queen", v: "000000000" }, { w: 3, h: 3, topo: "ring", v: "000000000" }, { w: 3, h: 3, v: "00000000" },
      { w: 3, h: 3, v: "00000000a" }, { w: 3, h: 3, v: [0, 0, 0, 0, 0, 0, 0, 0, 2] }, { w: 3, h: 3, holes: [9], v: "000000000" }, { w: 3, h: 3, holes: [0, 1, 2, 3, 4, 5, 6, 7, 8], v: "000000000" }, { w: 3, h: 3, holes: [0], v: "100000000" },
      { w: 3, h: 3, k: 3, v: "000000007" }, { w: 3, h: 3, holes: "x", v: "000000000" }];
    t.ok("fromInput đầu vào xấu → ok=false + lỗi tiếng Việt, không ném", bads.every(function (inp) { var r; try { r = T.fromInput(inp); } catch (e) { return false; } return r && r.ok === false && r.errors.length >= 1 && r.errors.every(function (e) { return !presetBad(e); }); }), bads.map(function (inp) { var r = T.fromInput(inp); return r.errors; }));
    t.ok("fromText/fromFile đầu vào xấu → ok=false, không ném", [null, "", "@ k=7\n.", "...\n..", "..a", "x"].every(function (s) { try { return T.fromText(s).ok === false; } catch (e) { return false; } }) &&
      [null, {}, { type: "sudoku" }, { type: "lightsoutx" }, { type: "lightsoutx", initialState: "abc" }, { type: "lightsoutx", initialState: "0000", size: { w: 3, h: 3 } }].every(function (o) { try { return T.fromFile(o).ok === false; } catch (e) { return false; } }));
    t.ok("bàn đã về 0 hết sẵn bị từ chối; bàn 20×20 cho phép; 21 bị từ chối", T.fromInput({ w: 3, h: 3, v: "000000000" }).ok === false && T.fromInput({ w: 20, h: 20, v: zeros(400).map(function (x, i) { return i === 0 ? 1 : 0; }) }).puzzle.data.w === 20);
  })();
  t.time("bàn tự nhập 20×20 chữ thập mod 2: khử lần đầu + giải", 4000, function () {
    var rr = R.create("big"), c = { w: 20, h: 20, rule: "cross", topo: "flat", k: 2 }, b = fakeSolvable(c, rr, 150), out = T.fromInput({ w: 20, h: 20, v: b });
    t.ok("20×20 mod 2: giải được, nhân 0, par ≤ số lần bấm đã dùng", out.status === "unique" && out.info.minPresses <= 150 && out.info.minimal, out.errors);
  });
  t.time("bàn tự nhập 20×20 mod 3 (khử mod 3 lần đầu)", 8000, function () {
    var rr = R.create("big3"), c = { w: 20, h: 20, rule: "cross", topo: "flat", k: 3 }, b = fakeSolvable(c, rr, 120), out = T.fromInput({ w: 20, h: 20, k: 3, v: b });
    t.ok("20×20 mod 3: giải được", out.status === "unique" || out.status === "multiple", out.errors);
  });
  t.time("giải lại bàn 20×20 mod 3 khác sau khi đã nhớ khử (E cache) — mỗi bàn nhanh", 200, function () {
    var rr = R.create("big3b"), c = { w: 20, h: 20, rule: "cross", topo: "flat", k: 3 };
    for (var i = 0; i < 5; i++) L.analyse(spec(c), fakeSolvable(c, rr, 100));
  });

  // ------------------------------------------------------------ 7. ván: moveFor / check / grade / replay
  t.group("Lights Out biến thể — ván chơi (moveFor, check, hoàn tác, replay, grade)");
  (function () {
    var cfgs = [{ rule: "cross", topo: "flat", k: "2", holes: "none" }, { rule: "knight", topo: "torus", k: "3", holes: "few" }, { rule: "king", topo: "flat", k: "5", holes: "some" }, { rule: "x", topo: "torus", k: "5", holes: "none" }];
    cfgs.forEach(function (o) {
      var p = T.generate(31, { sizeId: "6", tier: "medium", options: o }), st = T.newState(p), N = 36, bad = [], rr = R.create("mv" + o.rule), c = c0(p);
      for (var q = 0; q < 40; q++) {
        var i = rr.int(N), before = st.v.slice(), d = T.moveFor(p, st, { k: "press", i: i });
        if (c.holes.indexOf(i) >= 0) { if (d !== null) bad.push("ô khoá bấm được " + i); continue; }
        var want = simPress(c, before, i);
        if (!d) { if (JSON.stringify(want) !== JSON.stringify(before)) bad.push("null nhưng bàn đổi"); continue; }
        G.applyDiff(st, d.d, false);
        if (JSON.stringify(st.v) !== JSON.stringify(want)) bad.push(["sai luật", i]);
        G.applyDiff(st, G.reverseDiff(d.d), false);
        if (JSON.stringify(st.v) !== JSON.stringify(before)) bad.push(["hoàn lại sai", i]);
        G.applyDiff(st, d.d, false);
      }
      t.ok("moveFor khớp mô phỏng độc lập " + o.rule + "/" + o.topo + "/k=" + o.k + "/" + o.holes + ": 40 nước (ô khoá không bấm được, diff hoàn lại đúng)", bad.length === 0, bad.slice(0, 3));
    });
    var p2 = T.generate(31, { sizeId: "5", tier: "easy", options: { k: "3" } }), st2 = T.newState(p2), i0 = p2.data.presses[0];
    for (var z = 0; z < 3; z++) G.applyDiff(st2, T.moveFor(p2, st2, { k: "press", i: i0 }).d, false);
    t.ok("bấm một ô k lần = như chưa bấm (k = 3)", JSON.stringify(st2.v) === JSON.stringify(p2.initial.v));
    t.ok("moveFor: action lạ / ô ngoài bàn / ô không phải số → null", [null, {}, { k: "set", i: 1 }, { k: "press", i: -1 }, { k: "press", i: 25 }, { k: "press", i: "a" }, { k: "press", i: 1.5 }].every(function (a) { return T.moveFor(p2, T.newState(p2), a) === null; }));
    t.ok("check: solved khi mọi ô 0; total = số ô thật (không đếm ô khoá)", (function () { var pp = T.generate(9, { sizeId: "5", tier: "easy", options: { holes: "few" } }), cs = T.check(pp, { v: pp.solution.v }); return cs.solved && cs.total === 25 - pp.data.holes.length && !T.check(pp, T.newState(pp)).solved; })());
    t.ok("mistakes = 0; describeCell: đèn bật/tắt (k=2), mức (k>2), ô khoá", T.mistakes() === 0 && /đèn (bật|tắt)/.test(T.describeCell(T.generate(1, { sizeId: "5" }), T.newState(T.generate(1, { sizeId: "5" })), 0)) && /mức \d trên 2/.test(T.describeCell(p2, T.newState(p2), 0)) &&
      (function () { var pp = T.generate(5, { sizeId: "5", options: { holes: "few" } }); return /ô khoá/.test(T.describeCell(pp, T.newState(pp), pp.data.holes[0])); })());
    // replay áp tuần tự ra solved
    var bad2 = [];
    [["cross", "flat", "2", "none"], ["king", "torus", "3", "few"], ["plus2", "flat", "5", "none"]].forEach(function (cf) {
      var pp = T.generate(88, { sizeId: "6", tier: "hard", options: { rule: cf[0], topo: cf[1], k: cf[2], holes: cf[3] } }), rp = T.replay(pp), st3 = T.newState(pp);
      rp.forEach(function (s) { if (presetBad(s.text) || !s.diff || !s.cells.length) bad2.push("bước thiếu"); G.applyDiff(st3, s.diff.d, false); });
      if (!T.check(pp, st3).solved || rp.length !== pp.data.presses.length || !rp[0].map || !/Bản đồ lời giải/.test(rp[0].text)) bad2.push([cf, rp.length, pp.data.presses.length]);
    });
    t.ok("replay: áp tuần tự → tắt hết, số bước = par, bước 1 là bản đồ lời giải", bad2.length === 0, bad2);
    // grade
    var pg = T.generate(66, { sizeId: "5", tier: "medium" }), K = pg.data.presses.length, sol = { v: pg.solution.v }, un = T.newState(pg), g = function (st, mv) { return T.grade(pg, st, { moves: mv }); };
    t.ok("grade: đúng par 3★, ≤ K+⌈K/4⌉ 2★, hơn 1★, chưa xong 0★; quality = K/số lần", g(sol, K).stars === 3 && g(sol, K).quality === 1 && g(sol, K + Math.ceil(K / 4)).stars === 2 && g(sol, K + Math.ceil(K / 4) + 1).stars === 1 && g(un, K).stars === 0 && g(un, K).quality === 0 && Math.abs(g(sol, 2 * K).quality - 0.5) < 0.001);
    t.ok("grade: Puz.grade.errors rỗng, valueText/bestText đủ", Puz.grade.errors(g(sol, K)).length === 0 && Puz.grade.errors(g(un, 0)).length === 0 && g(sol, K).bestText === String(K));
    t.ok("par ước lượng (nhân quá lớn): grade nói \"app tìm được\"", (function () {
      var pe = JSON.parse(JSON.stringify(pg)); pe.data.exact = false; return /app tìm được/.test(T.grade(pe, { v: pe.solution.v }, { moves: K }).text);
    })());
  })();

  // ------------------------------------------------------------ 8. hint: vòng "gợi ý mức 3 → áp dụng"
  t.group("Lights Out biến thể — gợi ý (ít bấm nhất: đúng K nước; đuổi đèn mod k: luôn tắt hết)");
  (function () {
    var bad = [], n = 0;
    [["cross", "flat", "2", "none"], ["x", "flat", "3", "none"], ["king", "torus", "5", "none"], ["knight", "flat", "3", "some"], ["plus2", "flat", "2", "few"], ["cross", "torus", "3", "none"], ["king", "flat", "5", "few"]].forEach(function (cf) {
      for (var s = 0; s < 4; s++) {
        var p = T.generate(200 + s, { sizeId: s < 2 ? "5" : "7", tier: s % 2 ? "hard" : "easy", options: { rule: cf[0], topo: cf[1], k: cf[2], holes: cf[3] } }), K = p.data.presses.length, r = hintLoop(p, "min", K + 5, 0), r2 = hintLoop(p, "min", 8 * K + 60, cf[2] === "2" ? 3 : 4 * Number(cf[2]));
        n += 2;
        if (r.n !== K) bad.push([cf.join("|"), s, "không bám K", r.n, K, r.why]);
        if (r2.n < 0) bad.push([cf.join("|"), s, "chèn nước sai không giải được", r2.n, r2.why]);
      }
    });
    t.ok("hint 'min' mức 3 lặp: giải đúng K nước (mỗi nước giảm đúng 1) và vẫn giải được khi chèn nước bấm bất kỳ, " + n + " ván", bad.length === 0, bad.slice(0, 4));
    var rr = R.create("hl1"), bad1 = [], p1 = T.generate(4, { sizeId: "6", tier: "medium", options: { k: "5" } }), st = T.newState(p1);
    var h1 = T.hint(p1, st, 1, {}), h2 = T.hint(p1, st, 2, {}), h3 = T.hint(p1, st, 3, {});
    t.ok("hint 3 mức: có chữ, mức 3 có why + action + cells; mức 1 không nêu số ô cụ thể '(h,c)'; tất định", h1.text.length > 10 && h2.text.length > 10 && h3.why.length >= 2 && h3.action.k === "press" && h3.cells.length === 1 && !/\(\d+,\d+\)/.test(h1.text) && JSON.stringify(T.hint(p1, st, 3, {})) === JSON.stringify(h3));
    t.ok("hint ở bàn đã xong / vô nghiệm: none:true", (function () { var d = T.hint(p1, { v: p1.solution.v }, 2, {}); return d.none === true; })());
    // đuổi đèn mod k
    var badC = [], nC = 0, worstRatio = 0;
    [2, 3, 5].forEach(function (k) { [[3, 3], [4, 4], [5, 5], [6, 5], [5, 7], [7, 7], [4, 6], [9, 9]].forEach(function (wh) {
      var c = { w: wh[0], h: wh[1], rule: "cross", topo: "flat", k: k }, rg = R.create("ch" + k + wh.join("x"));
      for (var s = 0; s < (k === 2 ? 18 : 12); s++) {
        var b = fakeSolvable(c, rg, 3 + rg.int(wh[0] * wh[1])); if (!b.some(function (x) { return x; })) continue;
        var an = L.analyse(spec(c), b); if (an.status === "none") continue;
        var pz = T.fromInput({ w: c.w, h: c.h, k: k, v: b }).puzzle, N = c.w * c.h, bound = (k - 1) * (2 * N - c.w) + 2 * c.w;
        var r = hintLoop(pz, "chase", bound + 10, 0); nC++;
        if (r.n < 0) badC.push([k, wh, b.join(""), r.n, r.why]);
        else { worstRatio = Math.max(worstRatio, r.n / ((k - 1) * (2 * N - c.w))); if (r.n > bound) badC.push([k, wh, "quá bound", r.n, bound]); }
      }
    }); });
    t.ok("đuổi đèn: " + nC + " bàn (mod 2/3/5, cỡ 3×3…9×9) đều tắt hết trong ≤ (k−1)(2N − w) + 2w nước; xấu nhất = " + worstRatio.toFixed(2) + " × (k−1)(2N − w)", badC.length === 0 && nC > 150, badC.slice(0, 4));
    t.ok("đuổi đèn mod 3, 5 cũng giải được khi chèn nước bấm bất kỳ", [3, 5].every(function (k) {
      var rg = R.create("chw" + k), c = { w: 5, h: 5, rule: "cross", topo: "flat", k: k };
      for (var s = 0; s < 6; s++) { var b = fakeSolvable(c, rg, 20), an = L.analyse(spec(c), b); if (an.status === "none" || an.weight === 0) continue; var pz = T.fromInput({ w: 5, h: 5, k: k, v: b }).puzzle; if (hintLoop(pz, "chase", 3000, 5 * k * 4).n < 0) return false; }
      return true;
    }));
    // bảng kinh điển 5×5 mod 2 (cột 1-based của hàng đầu): 10001→1,2 · 01010→1,4 · 11100→2 · 00111→4 · 10110→5 · 01101→1 · 11011→3
    var table = { "10001": [1, 2], "01010": [1, 4], "11100": [2], "00111": [4], "10110": [5], "01101": [1], "11011": [3] }, tb = {};
    Object.keys(table).forEach(function (pat) { var top = L.chaseTop(5, 5, 2, pat.split("").map(Number)); tb[pat] = top.map(function (x, i) { return x ? i + 1 : 0; }).filter(Boolean); });
    t.eq("5×5 mod 2: bảng hàng cuối ra đúng bảng kinh điển", tb, table);
    t.ok("chaseOk chỉ cho chữ thập + có mép + không ô khoá + h ≥ 3; hint 'chase' ở luật khác rơi về 'min'", L.chaseOk({ w: 5, h: 5, rule: "cross", topo: "flat", k: 3, holes: [] }) && !L.chaseOk({ w: 5, h: 5, rule: "king", topo: "flat", k: 2, holes: [] }) &&
      !L.chaseOk({ w: 5, h: 5, rule: "cross", topo: "torus", k: 2, holes: [] }) && !L.chaseOk({ w: 5, h: 5, rule: "cross", topo: "flat", k: 2, holes: [3] }) && !L.chaseOk({ w: 5, h: 2, rule: "cross", topo: "flat", k: 2, holes: [] }) &&
      (function () { var pk = T.generate(3, { sizeId: "5", options: { rule: "king" } }), hh = T.hint(pk, T.newState(pk), 3, { loHint: "chase" }); return hh.technique === "Khử Gauss mod k"; })());
  })();

  // ------------------------------------------------------------ 9. hiển thị: constraintView, trace, chữ
  t.group("Lights Out biến thể — Constraint View, trace, nội dung chữ");
  (function () {
    [["cross", "flat", "2", "none"], ["king", "torus", "3", "few"], ["x", "flat", "5", "none"]].forEach(function (cf) {
      var p = T.generate(14, { sizeId: "5", tier: "medium", options: { rule: cf[0], topo: cf[1], k: cf[2], holes: cf[3] } }), cv = T.constraintView(p), tr = T.trace(p), N = 25 - p.data.holes.length;
      t.ok("constraintView " + cf.join("|") + ": biến = ô thật, mỗi biến miền {0..k−1}, phương trình có (mod k), sections có mẫu im lặng", cv.counts.variables === N && cv.variables.length === N && cv.variables.every(function (v) { return v.domain.indexOf(String(Number(cf[2]) - 1)) > 0; }) &&
        cv.constraints.length >= 2 && /mod/.test(cv.constraints[1]) && Array.isArray(cv.sections) && cv.sections.length >= 1 && !presetBad(cv.summary), cv.summary);
      t.ok("trace " + cf.join("|") + ": kind matrix, ≤ 60 bước, bước đầu là [A | −b], có chữ về hạt nhân", tr.kind === "matrix" && tr.steps.length >= 2 && tr.steps.length <= 60 && /\[A \| −b\]/.test(tr.steps[0].text) && tr.steps.every(function (s) { return Array.isArray(s.matrix) && !presetBad(s.text); }) && /Hạt nhân/.test(tr.note + tr.steps.map(function (s) { return s.text; }).join(" ")));
    });
    var cvBig = T.constraintView(T.generate(3, { sizeId: "10", tier: "easy" }));
    t.ok("constraintView 10×10: biến gộp theo hàng (count), phương trình rút gọn ≤ 14 dòng", cvBig.variables.length === 10 && cvBig.variables.every(function (v) { return v.count === 10; }) && cvBig.constraints.length <= 14);
    var sec = T.constraintView(T.generate(14, { sizeId: "5", tier: "easy" })).sections;
    t.ok("5×5 chữ thập mod 2 (nhân 2): 2 mẫu im lặng + 4 lời giải, lời giải đầu là par", sec[0].items.length === 2 && sec[1].items.length === 4 && /ít nhất/.test(sec[1].items[0].text) && sec[1].items[0].grid.length === 5);
    var all = []; [T.rules, [T.blurb, T.difficultyNote], T.algorithm.steps.map(function (s) { return s.text; })].forEach(function (a) { a.forEach(function (s) { all.push(s); }); });
    t.ok("chữ tiếng Việt: không rỗng/undefined/null/NaN", all.every(function (s) { return !presetBad(s); }));
  })();

  // ------------------------------------------------------------ 10. hiệu năng
  t.group("Lights Out biến thể — hiệu năng (máy dev)");
  t.time("sinh 40 đề 7×7 (mọi luật, k, xuyến, ô khoá)", 6000, function () { var i = 0; L.RULE_IDS.forEach(function (r) { ["flat", "torus"].forEach(function (tp) { [2, 3, 5].forEach(function (k) { if (i++ < 40) T.generate(i, { sizeId: "7", tier: "hard", options: { rule: r, topo: tp, k: String(k), holes: i % 3 ? "none" : "few" } }); }); }); }); });
  t.time("hint mức 3 bàn 10×10 xuyến mod 2 (nhân 16 — duyệt 65 536 tổ hợp)", 500, function () { var p = T.generate(5, { sizeId: "10", tier: "hard", options: { topo: "torus" } }); T.hint(p, T.newState(p), 3, {}); });
  t.time("hint mức 3 bàn 10×10 vua mod 3 (đã khử sẵn) × 20 lần", 400, function () { var p = T.generate(5, { sizeId: "10", tier: "hard", options: { rule: "king", k: "3" } }); for (var i = 0; i < 20; i++) T.hint(p, T.newState(p), 3, {}); });
  t.time("constraintView + trace bàn 10×10", 300, function () { var p = T.generate(5, { sizeId: "10", tier: "medium", options: { rule: "knight" } }); T.constraintView(p); T.trace(p); });
};
