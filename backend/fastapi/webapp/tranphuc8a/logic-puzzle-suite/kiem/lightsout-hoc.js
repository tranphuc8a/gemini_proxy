/* kiem/lightsout-hoc.js — phần "học" của Lights Out thêm ở đợt P2 (thiết kế puzzle-lo-coin.md, việc B2–B6):
   bất biến khi vô nghiệm, mẫu bấm im lặng + mọi lời giải (Constraint View), bản đồ lời giải (replay), gợi ý "Đuổi đèn", par + grade.
   Nguồn sự thật ĐỘC LẬP với khử Gauss của engine:
     · hạt nhân bằng VÉT CẠN 2^N tập bấm (N ≤ 16) hoặc bằng ĐUỔI ĐÈN (mọi hàng 1 có dư hàng cuối = 0 cho đúng một mẫu im lặng — mọi w ≤ 10);
     · bảng hàng cuối 5×5 kinh điển (10001 → ô 1, 2; 01010 → 1, 4; 11100 → 2; 00111 → 4; 10110 → 5; 01101 → 1; 11011 → 3 — bảng in sẵn trong các
       bài viết về Lights Out, vd Jaap's Puzzle Page) và vét cạn 2^w hàng 1 cho mọi cỡ khác;
     · thủ tục đuổi đèn bằng tay viết lại ở đây (đuổi → tra bảng → bấm hàng 1 → đuổi lại) để so từng nước với gợi ý;
     · mô phỏng: bấm ngẫu nhiên 300 lần, tính chẵn lẻ số đèn sáng trong nhóm bất biến không bao giờ đổi. */
"use strict";
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("lightsout"), G = Puz.game, R = Puz.rng, GR = Puz.grade, L = T.lib;
  var TIERS = ["easy", "medium", "hard", "expert"];

  // ------------------------------------------------------------ nguồn độc lập
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function crossSet(w, h, i) { var r = Math.floor(i / w), c = i % w, o = []; for (var j = 0; j < w * h; j++) if (Math.abs(Math.floor(j / w) - r) + Math.abs(j % w - c) <= 1) o.push(j); return o; }
  function press(w, h, st, i) { crossSet(w, h, i).forEach(function (j) { st[j] ^= 1; }); }
  function applyAll(w, h, b, presses) { var st = b.slice(); presses.forEach(function (i) { press(w, h, st, i); }); return st; }
  function allOff(v) { return v.every(function (x) { return x === 0; }); }
  function lexCmp(a, b) { for (var i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }
  function better(a, b) { return !b || a.length < b.length || (a.length === b.length && lexCmp(a, b) < 0); }
  /** Đuổi đèn với hàng 1 = mặt nạ p: {pressed, last (mảng 0/1 hàng cuối), st}. */
  function chaseWith(w, h, board, p) {
    var st = board.slice(), pressed = [];
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var doIt = r === 0 ? (p >> c) & 1 : st[(r - 1) * w + c];
      if (doIt) { pressed.push(r * w + c); press(w, h, st, r * w + c); }
    }
    return { pressed: pressed, st: st };
  }
  /** Hạt nhân (mẫu im lặng) bằng đuổi đèn trên bàn tối: mọi hàng 1 mà đuổi xong tối hết. Gồm cả tập rỗng. */
  function kernelByChase(w, h) { var out = []; for (var p = 0; p < (1 << w); p++) { var c = chaseWith(w, h, zeros(w * h), p); if (allOff(c.st)) out.push(c.pressed); } return out; }
  /** Hạt nhân bằng vét cạn 2^N (N ≤ 16): y ∈ ker ⇔ mọi lần bấm đảo số chẵn ô của y. */
  function kernelBrute(w, h) {
    var N = w * h, masks = [], i, out = [];
    for (i = 0; i < N; i++) { var m = 0; crossSet(w, h, i).forEach(function (j) { m |= 1 << j; }); masks.push(m); }
    for (var y = 0; y < (1 << N); y++) {
      var ok = true;
      for (i = 0; i < N && ok; i++) { var x = masks[i] & y, s = 0; while (x) { x &= x - 1; s++; } if (s & 1) ok = false; }
      if (ok) { var cells = []; for (i = 0; i < N; i++) if ((y >> i) & 1) cells.push(i); out.push(cells); }
    }
    return out;
  }
  function dot(cells, b) { var s = 0; cells.forEach(function (i) { s += b[i]; }); return s; }
  /** Bất biến nhỏ nhất (theo số ô, rồi từ điển) từ danh sách hạt nhân; null nếu bàn giải được. */
  function minObstruction(kernel, b) { var best = null; kernel.forEach(function (y) { if (y.length && (dot(y, b) & 1) && better(y, best)) best = y; }); return best; }
  function solvable(w, h, b) { for (var p = 0; p < (1 << w); p++) if (allOff(chaseWith(w, h, b, p).st)) return true; return false; }
  function randBoard(rr, N) { var b = []; for (var i = 0; i < N; i++) b.push(rr.int(2)); return b; }
  function solvableBoard(rr, w, h, m) { var st = zeros(w * h); for (var k = 0; k < m; k++) press(w, h, st, rr.int(w * h)); return st; }
  function bad(s) { return s === undefined || s === null || s === "" || /undefined|null|NaN|\[object/.test(String(s)); }
  function J(x) { return JSON.stringify(x); }

  // ============================================================ B2. bất biến khi vô nghiệm
  t.group("Lights Out — B2 bất biến khi vô nghiệm: y ∈ ker(A), y·b lẻ, ít ô nhất (đối chiếu vét cạn / đuổi đèn)");
  (function () {
    var SMALL = [[2, 2], [2, 3], [3, 2], [2, 4], [4, 2], [2, 5], [5, 2], [3, 4], [4, 3], [2, 6], [6, 2], [4, 4], [2, 8], [3, 5]];
    var bads = [], nUns = 0, nSol = 0, rr = R.create(4401);
    SMALL.forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h, kb = kernelBrute(w, h), kc = kernelByChase(w, h);
      if (J(kb.map(function (y) { return y.join(","); }).sort()) !== J(kc.map(function (y) { return y.join(","); }).sort())) bads.push({ w: w, h: h, why: "hai nguồn hạt nhân lệch nhau" });
      var boards = [];
      if (N <= 12) for (var m = 0; m < (1 << N); m++) { var b = []; for (var i = 0; i < N; i++) b.push((m >> i) & 1); boards.push(b); }
      else for (var k = 0; k < 400; k++) boards.push(randBoard(rr, N));
      boards.forEach(function (b) {
        var want = minObstruction(kb, b), ob = L.obstruction(w, h, b);
        if (!want) { nSol++; if (ob !== null) bads.push({ w: w, h: h, b: b.join(""), why: "bàn giải được mà có bất biến" }); return; }
        nUns++;
        if (!ob) { bads.push({ w: w, h: h, b: b.join(""), why: "vô nghiệm mà không có bất biến" }); return; }
        if (J(ob.cells) !== J(want) || ob.size !== want.length || ob.lit !== dot(want, b) || !(ob.lit & 1) || ob.minimal !== true) bads.push({ w: w, h: h, b: b.join(""), got: ob.cells, want: want });
      });
    });
    t.ok("vét cạn: bất biến của engine là mẫu im lặng ít ô nhất (rồi nhỏ nhất theo từ điển) có số đèn sáng lẻ — " + nUns + " bàn vô nghiệm, " + nSol + " bàn giải được (không có bất biến), " + SMALL.length + " cỡ", bads.length === 0, bads.slice(0, 3));
  })();
  (function () {
    var rr = R.create(4402), bads = [], n = 0, sizes = [[5, 5], [4, 4], [9, 9], [4, 9], [10, 4], [5, 8], [8, 5], [7, 9], [9, 4], [4, 7], [11 - 1, 9]];
    sizes.forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h, kc = kernelByChase(w, h);
      if (kc.length === 1) return;
      for (var k = 0; k < 30; k++) {
        var b = randBoard(rr, N), want = minObstruction(kc, b), ob = L.obstruction(w, h, b);
        if (!want) { if (ob) bads.push({ w: w, h: h, why: "giải được mà có bất biến" }); continue; }
        n++;
        if (!ob || J(ob.cells) !== J(want)) bads.push({ w: w, h: h, got: ob && ob.cells, want: want });
      }
    });
    t.ok("bàn lớn (hạt nhân lấy bằng đuổi đèn): bất biến ít ô nhất khớp — " + n + " bàn vô nghiệm trên 4×4, 5×5, 9×9 và chữ nhật", bads.length === 0, bads.slice(0, 2));
  })();
  (function () {
    var rr = R.create(4403), bads = [];
    [[4, 4], [5, 5], [9, 9], [4, 9]].forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h;
      for (var k = 0; k < 6; k++) {
        var b = randBoard(rr, N); if (solvable(w, h, b)) continue;
        var ob = L.obstruction(w, h, b), st = b.slice();
        for (var m = 0; m < 300; m++) { press(w, h, st, rr.int(N)); if (!(dot(ob.cells, st) & 1)) { bads.push({ w: w, h: h, m: m }); break; } }
      }
    });
    t.ok("mô phỏng: bấm ngẫu nhiên 300 lần, số đèn sáng trong nhóm bất biến LUÔN lẻ (đúng như lời giải thích)", bads.length === 0, bads.slice(0, 2));
  })();
  (function () {
    var one = zeros(16); one[0] = 1;
    var o = T.fromInput({ w: 4, h: 4, v: one }), val = T.validate(o.puzzle), sv = T.solve(o.puzzle), h1 = T.hint(o.puzzle, T.newState(o.puzzle), 1);
    var ob = o.info.obstruction;
    t.ok("fromInput 4×4 một đèn: errors[0] giữ câu cũ (1/16), errors[1] là bất biến tiếng Việt nêu số ô và số đèn lẻ", !o.ok && o.errors.length === 2 && /1\/16/.test(o.errors[0]) && /Bất biến chẵn–lẻ/.test(o.errors[1]) && o.errors[1].indexOf("nhóm " + ob.size + " ô") >= 0 && o.errors[1].indexOf("có 1 (lẻ)") >= 0, o.errors);
    t.ok("validate / solve / fromInput cùng trả info.obstruction {cells, size, lit, minimal, text} như nhau", ob && J(val.info.obstruction) === J(ob) && J(sv.info.obstruction) === J(ob) && ob.text === o.errors[1] && val.errors[1] === ob.text && !bad(ob.text), [val.info.obstruction, sv.info.obstruction]);
    t.ok("hint trên bàn vô nghiệm: none, tô đúng các ô của bất biến, 'vì sao' là lời bất biến (mọi mức, mọi kiểu gợi ý)", [1, 2, 3].every(function (l) { return ["min", "chase"].every(function (sty) { var hh = T.hint(o.puzzle, T.newState(o.puzzle), l, { loHint: sty }); return hh.none === true && J(hh.cells) === J(ob.cells) && hh.why[0] === ob.text && hh.obstruction && hh.obstruction.size === ob.size; }); }) && h1.level === 1, h1);
    var sol = T.fromInput({ w: 5, h: 5, v: solvableBoard(R.create(3), 5, 5, 9) });
    t.ok("bàn giải được: fromInput/validate/solve không có info.obstruction, errors rỗng (không có câu bất biến)", sol.ok && !("obstruction" in sol.info) && sol.errors.length === 0 && !("obstruction" in T.validate(sol.puzzle).info) && !("obstruction" in T.solve(sol.puzzle).info));
    t.ok("bàn tự nhập 3×3/6×6 (hạt nhân 0 chiều) luôn giải được → không bao giờ có bất biến (200 bàn ngẫu nhiên)", (function () { var rr = R.create(9); for (var k = 0; k < 200; k++) { var n = k % 2 ? 3 : 6; if (L.obstruction(n, n, randBoard(rr, n * n))) return false; } return true; })());
  })();

  // ============================================================ B3. mẫu im lặng, mọi lời giải, bản đồ lời giải, trace
  t.group("Lights Out — B3 Constraint View: mẫu bấm im lặng, mọi lời giải (≤ 16), bất biến; trace nêu hạt nhân; replay có bản đồ lời giải");
  (function () {
    var rr = R.create(4404), bads = [], seen = 0;
    [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [9, 9], [4, 5], [5, 4], [4, 9]].forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h, kc = kernelByChase(w, h), nul = Math.round(Math.log(kc.length) / Math.LN2);
      var b = solvableBoard(rr, w, h, Math.max(2, N >> 2)), p = T.fromInput({ w: w, h: h, v: b }).puzzle, cv = T.constraintView(p), secs = cv.sections || [];
      var ker = secs[0], all = secs.filter(function (s) { return /^Mọi lời giải/.test(s.title); })[0];
      if (!ker || !Array.isArray(ker.items) || ker.items.length !== nul || bad(ker.title) || bad(ker.note)) { bads.push({ w: w, h: h, why: "mục mẫu im lặng sai số mẫu", got: ker && ker.items.length, want: nul }); return; }
      ker.items.forEach(function (it) {
        var cells = []; it.grid.forEach(function (row, r) { row.split("").forEach(function (ch, c) { if (ch === "#") cells.push(r * w + c); }); });
        if (it.grid.length !== h || !it.grid.every(function (row) { return row.length === w && /^[#.]+$/.test(row); })) bads.push({ w: w, h: h, why: "lưới mẫu sai hình" });
        if (!cells.length || !allOff(applyAll(w, h, zeros(N), cells))) bads.push({ w: w, h: h, why: "mẫu không im lặng (bấm cả mẫu làm đổi đèn)", cells: cells });
        if (bad(it.text) || it.text.indexOf(cells.length + " ô") < 0) bads.push({ w: w, h: h, why: "chữ của mẫu", text: it.text });
      });
      // các mẫu độc lập tuyến tính: span đủ 2^nul phần tử
      var span = {}, basis = ker.items.map(function (it) { var m = []; it.grid.join("").split("").forEach(function (ch, i) { if (ch === "#") m.push(i); }); return m; });
      for (var g = 0; g < (1 << basis.length); g++) { var acc = zeros(N); basis.forEach(function (bb, k) { if ((g >> k) & 1) bb.forEach(function (i) { acc[i] ^= 1; }); }); span[acc.join("")] = 1; }
      if (Object.keys(span).length !== Math.pow(2, nul)) bads.push({ w: w, h: h, why: "mẫu không độc lập" });
      var sols = kc.map(function (y) { var x = zeros(N); y.forEach(function (i) { x[i] ^= 1; }); p.data.presses.forEach(function (i) { x[i] ^= 1; }); var o = []; x.forEach(function (v, i) { if (v) o.push(i); }); return o; });
      if (sols.length <= 16) {
        seen++;
        if (!all || all.items.length !== sols.length) { bads.push({ w: w, h: h, why: "thiếu 'Mọi lời giải'" }); return; }
        var got = all.items.map(function (it) { var o = []; it.grid.join("").split("").forEach(function (ch, i) { if (ch === "#") o.push(i); }); return o; });
        var want = sols.slice().sort(function (x, y) { return x.length - y.length || lexCmp(x, y); });
        if (J(got) !== J(want) || J(got[0]) !== J(p.data.presses) || !got.every(function (x) { return allOff(applyAll(w, h, b, x)); }) || !/\(ít nhất\)/.test(all.items[0].text)) bads.push({ w: w, h: h, why: "danh sách lời giải sai", got: got.length });
      } else if (all) bads.push({ w: w, h: h, why: "liệt kê khi > 16 lời giải" });
    });
    t.ok("mẫu im lặng = cơ sở hạt nhân (số mẫu = số chiều theo đuổi đèn, mỗi mẫu bấm cả mẫu không đổi đèn, độc lập); 'Mọi lời giải' khớp tập nghiệm độc lập, sắp theo số bấm, đầu = data.presses (" + seen + " cỡ có ≤ 16 lời giải)", bads.length === 0, bads.slice(0, 3));
    var cv3 = T.constraintView(T.fromInput({ w: 3, h: 3, v: [1, 0, 0, 0, 0, 0, 0, 0, 0] }).puzzle);
    t.ok("3×3 (hạt nhân 0 chiều): mục mẫu im lặng nói rõ 'không có' và lời giải duy nhất được liệt kê", cv3.sections[0].items.length === 0 && /0 chiều/.test(cv3.sections[0].note) && cv3.sections[1].items.length === 1, cv3.sections.map(function (s) { return s.title; }));
    var one = zeros(16); one[0] = 1;
    var cvU = T.constraintView(T.fromInput({ w: 4, h: 4, v: one }).puzzle), sU = cvU.sections.filter(function (s) { return /Bất biến/.test(s.title); })[0];
    t.ok("bàn vô nghiệm: Constraint View có mục 'Bất biến' (lưới nhóm ô + lời), không có 'Mọi lời giải'", sU && sU.items.length === 1 && /Bất biến chẵn–lẻ/.test(sU.note) && !cvU.sections.some(function (s) { return /^Mọi lời giải/.test(s.title); }), cvU.sections.map(function (s) { return s.title; }));
    var all9 = T.constraintView(T.fromInput({ w: 10, h: 10, v: solvableBoard(R.create(8), 10, 10, 30) }).puzzle);
    t.ok("mọi chữ trong sections sạch (không undefined/null/NaN) — kể cả bàn 10×10", [cv3, cvU, all9].every(function (cv) { return cv.sections.every(function (s) { return !bad(s.title) && !bad(s.note) && s.items.every(function (it) { return !bad(it.text) && it.grid.every(function (g) { return !bad(g); }); }); }); }));
  })();
  (function () {
    var tr4 = T.trace(T.fromInput({ w: 4, h: 4, v: solvableBoard(R.create(2), 4, 4, 5) }).puzzle), tr3 = T.trace(T.fromInput({ w: 3, h: 3, v: [0, 1, 0, 1, 1, 1, 0, 1, 0] }).puzzle);
    var one = zeros(16); one[0] = 1;
    var trU = T.trace(T.fromInput({ w: 4, h: 4, v: one }).puzzle), tr10 = T.trace(T.fromInput({ w: 10, h: 10, v: solvableBoard(R.create(3), 10, 10, 30) }).puzzle);
    var last = function (tr) { return tr.steps[tr.steps.length - 1].text; };
    t.ok("trace: bước cuối nêu hạt nhân (4×4: 4 chiều + 'MẪU BẤM IM LẶNG'; 3×3: 0 chiều, duy nhất); vô nghiệm nêu bất biến; bàn cắt gọn ghi vào note", /Hạt nhân 4 chiều/.test(last(tr4)) && /MẪU BẤM IM LẶNG/.test(last(tr4)) && /Hạt nhân 0 chiều/.test(last(tr3)) && /VÔ NGHIỆM/.test(last(trU)) && /Bất biến chẵn–lẻ/.test(last(trU)) && tr10.truncated && /Hạt nhân 0 chiều/.test(tr10.note), [last(tr3)]);
  })();
  (function () {
    var bads = [], n = 0;
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        [1, 20261017].forEach(function (seed) {
          var p = T.generate(seed, { sizeId: sz.id, tier: tier }), rep = T.replay(p), K = p.data.presses.length, w = p.size.w, h = p.size.h, st = T.newState(p);
          n++;
          if (rep.length !== K) { bads.push({ id: p.id, why: "số bước" }); return; }
          if (J(rep[0].cells.slice().sort(function (a, b) { return a - b; })) !== J(p.data.presses) || J(rep[0].map) !== J(p.data.presses) || rep[0].text.indexOf("Bản đồ lời giải — cần bấm " + K + " ô") !== 0) bads.push({ id: p.id, why: "bước 1 không phải bản đồ lời giải", cells: rep[0].cells });
          rep.forEach(function (s, k) {
            var before = st.v.slice(); G.applyDiff(st, s.diff.d, false);
            var flipped = []; st.v.forEach(function (v, i) { if (v !== before[i]) flipped.push(i); });
            if (J(flipped) !== J(crossSet(w, h, p.data.presses[k]))) bads.push({ id: p.id, step: k, why: "diff không phải đúng một lần bấm" });
            if (k > 0 && J(s.cells.slice().sort(function (a, b) { return a - b; })) !== J(flipped)) bads.push({ id: p.id, step: k, why: "bước sau phải tô các ô vừa đổi" });
            if (k > 0 && "map" in s) bads.push({ id: p.id, step: k, why: "chỉ bước đầu có map" });
          });
          if (!allOff(st.v)) bads.push({ id: p.id, why: "không tắt hết" });
        });
      });
    });
    t.ok("replay: bước 1 tô MỌI ô cần bấm (= data.presses, có step.map + chữ 'Bản đồ lời giải — cần bấm K ô'), mỗi bước vẫn đúng một lần bấm, các bước sau tô ô vừa đổi (" + n + " đề)", bads.length === 0, bads.slice(0, 3));
  })();

  // ============================================================ B4. đuổi đèn
  t.group("Lights Out — B4 gợi ý 'Đuổi đèn': bảng hàng cuối, thủ tục tay, vòng gợi ý tới khi tắt hết");
  (function () {
    var TABLE = { "10001": [1, 2], "01010": [1, 4], "11100": [2], "00111": [4], "10110": [5], "01101": [1], "11011": [3] };
    var got = {};
    Object.keys(TABLE).forEach(function (s) { var m = 0; for (var c = 0; c < 5; c++) if (s[c] === "1") m |= 1 << c; var tt = L.chaseTop(5, 5, m), cols = []; for (c = 0; c < 5; c++) if ((tt >> c) & 1) cols.push(c + 1); got[s] = cols; });
    t.eq("bảng hàng cuối 5×5 khớp bảng kinh điển (7 mẫu)", got, TABLE);
  })();
  /** Bảng hàng cuối độc lập: vét 2^w hàng 1 trên bàn tối → dư hàng cuối; với mỗi mẫu dư, hàng 1 ít ô nhất rồi nhỏ nhất theo từ điển. */
  function tableBrute(w, h) {
    var tab = {};
    for (var p = 0; p < (1 << w); p++) {
      var c = chaseWith(w, h, zeros(w * h), p), last = 0, cols = [];
      for (var k = 0; k < w; k++) { if (c.st[(h - 1) * w + k]) last |= 1 << k; if ((p >> k) & 1) cols.push(k); }
      if (!tab[last] || better(cols, tab[last].cols)) tab[last] = { p: p, cols: cols };
    }
    return tab;
  }
  (function () {
    var bads = [], nPat = 0;
    for (var w = 2; w <= 8; w++) for (var h = 2; h <= 8; h++) {
      var tab = tableBrute(w, h);
      for (var r = 0; r < (1 << w); r++) {
        var got = L.chaseTop(w, h, r), want = tab[r];
        nPat++;
        if (!want) { if (got !== null) bads.push({ w: w, h: h, r: r, why: "mẫu không đạt được mà có lời" }); }
        else if (got !== (r ? want.p : 0)) bads.push({ w: w, h: h, r: r, got: got, want: want.p });
      }
    }
    t.ok("bảng hàng cuối của engine = vét cạn 2^w hàng 1 (ít ô nhất, rồi từ điển; mẫu không đạt được → null) — mọi w, h ∈ 2…8, " + nPat + " mẫu", bads.length === 0, bads.slice(0, 3));
  })();
  /** Thủ tục đuổi đèn bằng tay (độc lập): đuổi xuống → tra bảng vét cạn → bấm hàng 1 theo thứ tự tăng → đuổi lại. → dãy ô bấm. */
  function manual(w, h, b) {
    var seq = [], st = b.slice(), r, c;
    function chaseNow() { for (r = 0; r < h - 1; r++) for (c = 0; c < w; c++) if (st[r * w + c]) { seq.push((r + 1) * w + c); press(w, h, st, (r + 1) * w + c); } }
    chaseNow();
    var last = 0; for (c = 0; c < w; c++) if (st[(h - 1) * w + c]) last |= 1 << c;
    if (last) { var e = tableBrute(w, h)[last]; if (!e) return null; e.cols.forEach(function (k) { seq.push(k); press(w, h, st, k); }); chaseNow(); }
    return allOff(st) ? seq : null;
  }
  function runChase(p, inject, rr) {
    var g = G.create(p, { now: function () { return 0; }, settings: { loHint: "chase" } }), seq = [], issues = [], w = p.size.w, h = p.size.h, N = w * h, guard = 0;
    while (!g.finished() && guard++ < 4 * N) {
      if (inject && seq.length === inject) { var ex = rr.int(N); g.act({ k: "press", i: ex }); seq.push(-1 - ex); continue; }
      var s0 = J(g.state), h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
      if (J(g.state) !== s0) issues.push("hint đổi state");
      if (!h3 || h3.none || !h3.action || h3.technique !== "Đuổi đèn" || h1.technique !== "Đuổi đèn") { issues.push("không có nước đuổi đèn"); break; }
      if (J(T.hint(p, g.state, 3, { loHint: "chase" })) !== J(h3)) issues.push("không tất định");
      var i = h3.action.i, r = Math.floor(i / w), c = i % w, v = g.state.v;
      if (r > 0 && v[(r - 1) * w + c] === 1) {                                   // pha 1: ô ngay dưới một đèn sáng ở hàng trên, và là đèn sáng ĐẦU TIÊN theo thứ tự đọc
        var first = -1; for (var q = 0; q < (h - 1) * w; q++) if (v[q]) { first = q; break; }
        if (first !== (r - 1) * w + c && !(r === 0)) issues.push("pha 1 không bắt đầu từ đèn sáng đầu tiên");
        if (h1.cells.indexOf((r - 1) * w + c) < 0 || h1.text.indexOf("hàng " + r + " còn") < 0 || h2.cells[0] !== i) issues.push("chữ/ô mức 1-2 pha 1");
      } else if (r === 0) {
        if (!/Hàng cuối còn mẫu [01]+ → tra bảng/.test(h3.why[0]) || h2.cells.indexOf(i) < 0) issues.push("pha 2 thiếu bảng hàng cuối");
      } else issues.push("nước đuổi đèn không ở hàng 1 cũng không ngay dưới đèn sáng (ô " + i + ")");
      if ([h1, h2, h3].some(function (x) { return bad(x.text) || x.why.some(bad); })) issues.push("chữ rác");
      g.act(h3.action); seq.push(i);
    }
    return { g: g, seq: seq, issues: issues };
  }
  (function () {
    var bads = [], same = 0, n = 0, worst = 0, injected = 0, rr = R.create(4405);
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        for (var s = 0; s < 6; s++) {
          var p = T.generate(1000003 * (s + 1) + 29, { sizeId: sz.id, tier: tier }), w = p.size.w, h = p.size.h, N = w * h, run = runChase(p, 0);
          n++;
          if (run.g.status !== "solved" || run.issues.length) { bads.push({ id: p.id, status: run.g.status, issues: run.issues.slice(0, 2) }); continue; }
          if (run.seq.length > 2 * N - w) bads.push({ id: p.id, why: "quá 2N − w nước", n: run.seq.length });
          worst = Math.max(worst, run.seq.length / (2 * N - w));
          if (J(run.seq) === J(manual(w, h, p.initial.v))) same++;
          var run2 = runChase(p, 2 + (s % 3), rr); injected++;
          if (run2.g.status !== "solved" || run2.issues.length) bads.push({ id: p.id, why: "chèn nước lạ giữa chừng", issues: run2.issues.slice(0, 2) });
        }
      });
    });
    t.ok("lặp gợi ý mức 3 kiểu Đuổi đèn giải xong MỌI đề mẫu (" + n + " ván + " + injected + " ván chèn một nước bất kỳ giữa chừng); mỗi nước là pha 1 (ngay dưới đèn sáng đầu tiên) hoặc pha 2 (hàng 1, có bảng); tất định; không đổi state", bads.length === 0, bads.slice(0, 3));
    t.ok("số nước ≤ 2N − w (đo tối đa " + worst.toFixed(2) + " × (2N − w))", worst <= 1, worst);
    t.ok("dãy nước TRÙNG từng nước với thủ tục đuổi đèn bằng tay viết độc lập (đuổi → tra bảng → bấm hàng 1 → đuổi lại): " + same + "/" + n + " ván", same === n, same);
  })();
  (function () {
    var rr = R.create(4406), bads = [], n = 0;
    [[2, 5], [5, 2], [2, 9], [3, 7], [7, 3], [3, 3], [10, 10], [10, 4], [4, 10], [8, 9], [6, 2]].forEach(function (sz) {
      var w = sz[0], h = sz[1], N = w * h;
      for (var k = 0; k < 8; k++) {
        var b = solvableBoard(rr, w, h, rr.range(1, N)); if (allOff(b)) continue;
        var p = T.fromInput({ w: w, h: h, v: b }).puzzle, run = runChase(p, 0); n++;
        if (run.g.status !== "solved" || run.issues.length) bads.push({ w: w, h: h, issues: run.issues.slice(0, 2), status: run.g.status });
        else if (run.seq.length > (h >= 3 ? 2 * N - w : 3 * N)) bads.push({ w: w, h: h, why: "quá nhiều nước", n: run.seq.length });
      }
    });
    t.ok("bàn tự nhập chữ nhật 2×5 … 10×10 (cả h = 2): đuổi đèn giải xong, ≤ 2N − w nước (h = 2: ≤ 3N) — " + n + " bàn", bads.length === 0, bads.slice(0, 3));
  })();
  (function () {
    var p = T.generate(20261017, { sizeId: "5", tier: "medium" }), st = T.newState(p);
    var a = T.hint(p, st, 3), b = T.hint(p, st, 3, {}), c = T.hint(p, st, 3, { loHint: "xyz" }), d = T.hint(p, st, 3, { loHint: "min" }), e = T.hint(p, st, 3, { loHint: "chase" });
    t.ok("kiểu mặc định (không settings / settings rỗng / giá trị lạ / 'min') = gợi ý ít bấm nhất như cũ; chỉ 'chase' đổi kiểu", J(a) === J(b) && J(a) === J(c) && J(a) === J(d) && a.technique === "Khử Gauss GF(2)" && e.technique === "Đuổi đèn" && L.hintStyle(null) === "min" && L.hintStyle({ loHint: "chase" }) === "chase");
    var g = G.create(p, { now: function () { return 0; } }); g.setSettings({ loHint: "chase" });
    t.ok("game.setSettings({loHint:'chase'}) → game.hint đi qua tham số settings tới engine", g.hint(1).technique === "Đuổi đèn");
    // pha 2 của 5×5: dựng bàn chỉ còn hàng cuối 10001 → tra bảng: bấm ô 1, 2 ở hàng 1
    var v = zeros(25); v[20] = 1; v[24] = 1;
    var pz = T.fromInput({ w: 5, h: 5, v: v }).puzzle, h1 = T.hint(pz, { v: v }, 1, { loHint: "chase" }), h3 = T.hint(pz, { v: v }, 3, { loHint: "chase" });
    t.ok("5×5 chỉ còn hàng cuối 10001: mức 1 tô hàng cuối + 'pha 2'; mức 3 = 'tra bảng: bấm ô 1, 2 ở hàng 1 rồi đuổi lại', bấm (1,1)", J(h1.cells) === J([20, 24]) && /pha 2/.test(h1.text) && h3.action.i === 0 && h3.why[0] === "Hàng cuối còn mẫu 10001 → tra bảng: bấm ô 1, 2 ở hàng 1 rồi đuổi lại.", [h1.text, h3.why[0]]);
    var v2 = v.slice(); press(5, 5, v2, 0);
    var g3 = T.hint(pz, { v: v2 }, 3, { loHint: "chase" }), g2 = T.hint(pz, { v: v2 }, 1, { loHint: "chase" });
    t.ok("… đã bấm ô 1 hàng 1 (hàng 1–2 sáng lại): vẫn nhận ra pha 2 đang dở, bảo bấm tiếp ô 2 hàng 1 (không đuổi vội)", g3.action.i === 1 && /đang dở/.test(g2.text) && /Đã bấm ô 1 ở hàng 1; còn ô 2/.test(g3.why[2]), [g3.action, g2.text]);
  })();

  // ============================================================ B6. par + grade
  t.group("Lights Out — B6 par + grade (HUONG-DAN-ENGINE.md 11.4): 3★ = K lần bấm, 2★ ≤ K + ⌈K/4⌉, 1★ còn lại");
  (function () {
    t.ok("def.grade + objective {sense: min, unit: 'lần bấm'}; vẫn là loại static (không có ô giá trị trên HUD)", typeof T.grade === "function" && T.objective.sense === "min" && T.objective.unit === "lần bấm" && Puz.types.kindOf(T) === "static" && Puz.types.conformance(T).length === 0);
    var bads = [], n = 0;
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        var p = T.generate(424242, { sizeId: sz.id, tier: tier }), K = p.data.presses.length, done = { v: p.solution.v.slice(), c: null }, C = function (m) { return { moves: m, mistakes: 0, undos: 0, hints: { 1: 0, 2: 0, 3: 0 }, revealed: false }; };
        var two = K + Math.ceil(K / 4);
        [[K, 3], [two, 2], [two + 1, 1], [3 * K + 5, 1]].forEach(function (x) {
          var gr = T.grade(p, done, C(x[0])); n++;
          if (GR.errors(gr).length || gr.stars !== x[1] || gr.value !== x[0] || gr.best !== K || gr.quality !== GR.quality(x[0], K, "min")) bads.push({ id: p.id, moves: x[0], K: K, gr: gr, err: GR.errors(gr) });
        });
        var un = T.grade(p, T.newState(p), C(1));
        if (GR.errors(un).length || un.stars !== 0 || un.quality !== 0 || !/Chưa tắt hết/.test(un.text)) bads.push({ id: p.id, why: "chưa giải mà có sao", un: un });
        if (!/^Đúng par: \d+ lần bấm/.test(T.grade(p, done, C(K)).text) || T.grade(p, done, C(two)).text.indexOf("Hơn par " + (two - K)) !== 0) bads.push({ id: p.id, why: "chữ" });
      });
    });
    t.ok("grade đủ trường (Puz.grade.errors rỗng), sao theo par ở mọi cỡ/bậc: K → 3★, K + ⌈K/4⌉ → 2★, hơn nữa → 1★, chưa tắt hết → 0★; quality = K/số lần bấm (" + n + " ca)", bads.length === 0, bads.slice(0, 2));
    var p = T.generate(20261017, { sizeId: "5", tier: "hard" }), K = p.data.presses.length;
    var g = G.create(p, { now: function () { return 0; } }); p.data.presses.forEach(function (i) { g.act({ k: "press", i: i }); });
    var rec = g.record("solved");
    t.ok("ván bấm đúng data.presses: record.grade 3★, value = best = K = " + K, g.status === "solved" && rec.grade && rec.grade.stars === 3 && rec.grade.value === K && rec.grade.best === K && rec.grade.quality === 1, rec.grade);
    var g2 = G.create(p, { now: function () { return 0; } }); g2.act({ k: "press", i: 0 }); g2.undo(); p.data.presses.forEach(function (i) { g2.act({ k: "press", i: i }); });
    t.ok("bấm thừa một ô rồi hoàn tác: lần bấm vẫn tính (K + 1 = " + (K + 1) + ") → " + T.lib.parStars(K + 1, K) + "★", g2.status === "solved" && g2.record("solved").grade.value === K + 1 && g2.record("solved").grade.stars === T.lib.parStars(K + 1, K) && T.lib.parStars(K + 1, K) === 2);
    var g3 = G.create(p, { now: function () { return 0; } }); g3.reveal();
    t.ok("Reveal: không có grade trong lịch sử (theo vỏ chung)", !("grade" in g3.record()));
    var o = T.fromInput({ w: 4, h: 4, v: (function () { var v = zeros(16); v[0] = 1; return v; })() });
    t.ok("bàn không có par (vô nghiệm) → grade vẫn đủ trường, 0★, không ném", GR.errors(T.grade(o.puzzle, T.newState(o.puzzle), { moves: 0 })).length === 0 && T.grade(o.puzzle, T.newState(o.puzzle), {}).stars === 0 && T.grade(null, null, null).stars === 0);
    t.ok("par(puzzle) = data.presses.length; puzzle không có presses thì tính lại bằng bộ giải", T.lib.par(p) === K && T.lib.par({ type: "lightsout", data: { w: 5, h: 5 }, size: { w: 5, h: 5 }, initial: { v: p.initial.v.slice() } }) === K);
    var pChase = T.generate(7, { sizeId: "6", tier: "hard" }), run = runChase(pChase, 0);
    t.ok("giải bằng đuổi đèn (" + run.seq.length + " nước, par " + pChase.data.presses.length + ") → điểm theo par (" + run.g.record("solved").grade.stars + "★), nêu 'Hơn par' khi thừa", run.g.status === "solved" && run.g.record("solved").grade.value === run.seq.length && (run.seq.length === pChase.data.presses.length || /Hơn par/.test(run.g.record("solved").grade.text)));
  })();
};
