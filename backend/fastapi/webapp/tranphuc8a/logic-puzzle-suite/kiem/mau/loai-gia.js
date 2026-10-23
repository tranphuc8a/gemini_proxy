/* kiem/mau/loai-gia.js — HAI LOẠI PUZZLE GIẢ (chỉ để kiểm, KHÔNG nạp vào app) phủ phần hợp đồng mới của HUONG-DAN-ENGINE.md mục 11:

     giatoiuu  "Ba lô mini"   kind:"optimize"    — chọn món bỏ ba lô, nộp lựa chọn, chấm theo tổng giá trị so với tối ưu (QHĐ ba lô);
                                                   có options {so: 5|7 món}, nhãn sizeLabel/moveLabel/mistakeLabel, grade = Puz.grade.fromRatio.
     giadoan   "Đoán số"      kind:"interactive" — hỏi "số ≥ x?" (oracle tất định: số cố định theo seed, hoặc đối thủ thích nghi theo options),
                                                   kết luận = nộp kèm tham số; grade tự đặt sao (phạt hoàn tác / gợi ý mức 3).

   Một tệp dùng ở ba nơi: kiem/core-hop-dong.js (node), kiem/app-worker.js (vm chỉ có các tệp data-pz — như Web Worker) và check.py
   (chèn vào trang thật bằng Blob <script data-pz> để worker sinh đề cũng nạp được). Vì vậy: ES5, không module/DOM, chỉ dùng Puz.rng/util/types/game/plan/grade.
   Tệp KHÔNG tự đăng ký: xuất hàm make(Puz) → { giatoiuu, giadoan } (đăng ký vào sổ thật sẽ làm lệch các test khác). */
(function (root) {
  "use strict";

  function make(P) {
    var plan = P.plan, G = P.grade;

    function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
    function copyState(s) { return { v: s.v.slice(), c: null }; }
    function after(s, diff) { var t = copyState(s); P.game.applyDiff(t, diff.d, false); return t; }
    function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }

    // ================================================================================== giatoiuu — Ba lô mini (optimize)
    function layoutK(p) { return plan.layout(p.data.w.length, 1, 0); }
    function picks(p, s) { return plan.read(s, layoutK(p)).map(function (r) { return r[0] - 1; }); }
    function weightOf(p, list) { var t = 0; list.forEach(function (i) { t += p.data.w[i]; }); return t; }
    function valueOf(p, list) { var t = 0; list.forEach(function (i) { t += p.data.val[i]; }); return t; }
    /** Giá trị lớn nhất đạt được khi BẮT BUỘC giữ các món `list` (QHĐ 0/1 trên phần còn lại). −1 nếu đã quá sức chứa. */
    function bestFrom(d, list) {
      var room = d.cap, i, c;
      list.forEach(function (k) { room -= d.w[k]; });
      if (room < 0) return -1;
      var dp = []; for (c = 0; c <= room; c++) dp.push(0);
      for (i = 0; i < d.w.length; i++) if (list.indexOf(i) < 0) for (c = room; c >= d.w[i]; c--) dp[c] = Math.max(dp[c], dp[c - d.w[i]] + d.val[i]);
      var base = 0; list.forEach(function (k) { base += d.val[k]; });
      return base + dp[room];
    }
    /** Một cách hoàn thành tối ưu từ `list` (chọn món chỉ số nhỏ nhất còn giữ được tối ưu) — null nếu từ đây không còn tối ưu. */
    function completion(d, list) {
      var best = bestFrom(d, []), cur = list.slice(), guard = 0;
      if (bestFrom(d, cur) !== best) return null;
      while (guard++ < 64) {
        var v = 0; cur.forEach(function (k) { v += d.val[k]; });
        if (v >= best) break;
        for (var i = 0; i < d.w.length; i++) if (cur.indexOf(i) < 0 && bestFrom(d, cur.concat([i])) === best) { cur.push(i); break; }
      }
      return cur.slice(list.length);
    }
    function knapPuzzle(seed, sizeId, sz, data, tier) {
      var L = plan.layout(data.w.length, 1, 0), sol = completion(data, []);
      var p = { v: 1, type: "giatoiuu", seed: seed, sizeId: sizeId, size: sz, tier: tier, score: 0, data: data, initial: { v: plan.empty(L) },
        solution: { v: plan.build(L, sol.map(function (i) { return [i + 1]; }), 1) }, meta: {} };
      p.score = knap.difficulty(p);
      if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
      p.id = P.util.puzzleId(p);
      return p;
    }
    function knapInput(inp) {
      var errs = [];
      if (!inp || typeof inp !== "object") return { ok: false, errors: ["Thiếu dữ liệu đề."], warnings: [], status: "none", count: 0 };
      if (!isInt(inp.cap, 1, 40)) errs.push("Sức chứa phải là số nguyên 1–40.");
      if (!Array.isArray(inp.w) || !Array.isArray(inp.val) || inp.w.length !== inp.val.length || inp.w.length < 1 || inp.w.length > 10) errs.push("Cần 1–10 món, mỗi món có khối lượng và giá trị.");
      else if (!inp.w.every(function (x) { return isInt(x, 1, 20); }) || !inp.val.every(function (x) { return isInt(x, 1, 20); })) errs.push("Khối lượng và giá trị là số nguyên 1–20.");
      if (errs.length) return { ok: false, errors: errs, warnings: [], status: "none", count: 0 };
      var data = { cap: inp.cap, w: inp.w.slice(), val: inp.val.slice() };
      data.best = bestFrom(data, []);
      if (data.best <= 0) return { ok: false, errors: ["Không món nào vừa ba lô."], warnings: [], status: "none", count: 0 };
      var p = knapPuzzle(null, "tu-nhap", { cap: data.cap }, data, "custom");
      return { ok: true, puzzle: p, errors: [], warnings: [], status: "unique", count: 1, statusKind: "ok", statusText: "✓ Biết giá trị tối ưu: " + data.best + " điểm" };
    }

    var knap = {
      id: "giatoiuu", name: "Ba lô mini (giả)", family: "Mathematical Puzzle", category: "QHĐ", icon: "🎒",
      blurb: "Loại giả để kiểm hợp đồng puzzle tối ưu.", rules: ["Chọn món bỏ vào ba lô, tổng khối lượng không vượt sức chứa.", "Nộp lựa chọn; điểm = tổng giá trị so với tối ưu."],
      sizes: [{ id: "nho", label: "Ba lô 10", params: { cap: 10 }, default: true, tiers: ["easy"] }, { id: "vua", label: "Ba lô 15", params: { cap: 15 }, tiers: ["easy"] }],
      algorithm: { title: "QHĐ ba lô 0/1", steps: [{ title: "Bảng QHĐ", text: "dp[c] = giá trị lớn nhất với sức chứa c." }] },
      difficultyNote: "Điểm theo số món và sức chứa.",
      kind: "optimize", objective: { sense: "max", label: "Tổng giá trị", unit: "điểm" },
      sizeLabel: "Phiên bản", moveLabel: "Số món đã chọn", mistakeLabel: "Nước làm mất tối ưu",
      options: [{ id: "so", label: "Số món", choices: [{ id: "5", label: "5 món" }, { id: "7", label: "7 món", note: "nhiều lựa chọn hơn" }], default: "5" }],

      generate: function (seed, o) {
        o = o || {};
        var sz = P.types.sizeOf(knap, o.sizeId), full = P.types.optionsOf(knap, o.options), n = +full.so, r = P.rng.create(seed).fork("mon"), w = [], val = [], i;
        for (i = 0; i < n; i++) { w.push(1 + r.int(6)); val.push(1 + r.int(9)); }
        var data = { cap: sz.params.cap, w: w, val: val };
        data.best = bestFrom(data, []);
        if (full.so !== "5") data.so = full.so;                                   // lựa chọn KHÁC mặc định vào data ⇒ puzzleId khác
        var p = knapPuzzle(seed, sz.id, sz.params, data, o.tier || "easy");
        p.options = P.types.compactOptions(knap, full);
        return p;
      },
      fromInput: knapInput,
      validate: function (p) { var r = knapInput({ cap: p.data && p.data.cap, w: p.data && p.data.w, val: p.data && p.data.val }); return { ok: r.ok, errors: r.errors, status: r.status, count: r.count, solution: r.ok ? r.puzzle.solution : null }; },
      solve: function (p) { return { status: "unique", count: 1, solution: p.solution, steps: [{ technique: "QHĐ ba lô", text: "Tối ưu = " + p.data.best + " điểm." }], techniques: { "QHĐ ba lô": 1 }, nodes: p.data.w.length * (p.data.cap + 1) }; },
      difficulty: function (p) { return P.util.clampScore(1 + p.data.w.length * 0.2 + p.data.cap * 0.05); },
      newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
      isGiven: function () { return false; },
      moveFor: function (p, s, a) {
        var L = layoutK(p), list = picks(p, s);
        if (!a) return null;
        if (a.k === "pick") {
          var i = a.i;
          if (!isInt(i, 0, p.data.w.length - 1) || list.indexOf(i) >= 0 || weightOf(p, list) + p.data.w[i] > p.data.cap) return null;
          return plan.appendDiff(s, L, [i + 1], "Chọn món " + (i + 1));
        }
        if (a.k === "truncate") return plan.truncateDiff(s, L, a.n);
        if (a.k === "submit") return list.length ? plan.submitDiff(s, L, [], "Nộp lựa chọn") : null;
        return null;
      },
      check: function (p, s) { var n = plan.count(s); return { solved: plan.isSubmitted(s) && n > 0, complete: n > 0, conflicts: [], filled: n, total: plan.count(p.solution) }; },
      mistakes: function (p, s, diff) {
        var b = p.data.best, before = bestFrom(p.data, picks(p, s)) === b, aft = bestFrom(p.data, picks(p, after(s, diff))) === b;
        return before && !aft ? 1 : 0;
      },
      grade: function (p, s) { return G.fromRatio(valueOf(p, picks(p, s)), p.data.best, "max"); },
      hint: function (p, s, level, settings) {
        var tech = "Ba lô" + (settings && typeof settings === "object" ? " (có cài đặt)" : ""), list = picks(p, s), best = p.data.best, can = bestFrom(p.data, list);
        if (plan.isSubmitted(s)) return { level: level, text: "Đã nộp lựa chọn.", why: [], cells: [], none: true };
        if (can !== best) {
          var j = list.length; while (j > 0 && bestFrom(p.data, list.slice(0, j)) !== best) j--;
          return { level: level, technique: tech, text: "Từ lựa chọn này tối đa còn " + can + " điểm (tối ưu " + best + "): bước " + (j + 1) + " làm mất tối ưu.", why: ["Bỏ các bước từ bước " + (j + 1) + " thì vẫn còn đường tới tối ưu."], cells: [list[j]], action: level === 3 ? { k: "truncate", n: j } : null };
        }
        var v = valueOf(p, list);
        if (v === best) return { level: level, technique: tech, text: "Tổng giá trị đã bằng tối ưu — hãy nộp lựa chọn.", why: ["Tổng hiện tại " + v + " = tối ưu " + best + "."], cells: [], action: level === 3 ? { k: "submit" } : null };
        var i = completion(p.data, list)[0], room = p.data.cap - weightOf(p, list);
        if (level === 1) return { level: 1, technique: tech, text: "Còn sức chứa " + room + ". Hãy tìm món đáng giá nhất trên mỗi đơn vị khối lượng mà vẫn vừa.", why: [], cells: [] };
        if (level === 2) return { level: 2, technique: tech, text: "Món " + (i + 1) + " (nặng " + p.data.w[i] + ", giá trị " + p.data.val[i] + ") nằm trong một lựa chọn tối ưu.", why: [], cells: [i] };
        return { level: 3, technique: tech, text: "Chọn món " + (i + 1) + ".", why: ["Sau khi chọn vẫn đạt được tối ưu " + best + " điểm (QHĐ trên phần còn lại)."], cells: [i], action: { k: "pick", i: i } };
      },
      replay: function (p) {
        var s = knap.newState(p), L = layoutK(p), out = [];
        picks(p, p.solution).forEach(function (i) { var d = plan.appendDiff(s, L, [i + 1]); P.game.applyDiff(s, d.d, false); out.push({ text: "Chọn món " + (i + 1) + " (nặng " + p.data.w[i] + ", giá trị " + p.data.val[i] + ").", diff: { d: d.d }, cells: [i] }); });
        var sd = plan.submitDiff(s, L, []); out.push({ text: "Nộp: tổng giá trị " + p.data.best + " điểm (tối ưu).", diff: { d: sd.d }, cells: [] });
        return out;
      },
      constraintView: function (p) { var n = p.data.w.length; return { summary: n + " món, sức chứa " + p.data.cap, variables: [{ name: "x_i (chọn món i)", domain: "{0, 1}", count: n }], constraints: ["Σ khối lượng · x ≤ " + p.data.cap], counts: { variables: n, constraints: 1 } }; },
      trace: function (p) { return { kind: "matrix", title: "QHĐ ba lô", steps: [{ text: "Khối lượng / giá trị từng món", matrix: [p.data.w.slice(), p.data.val.slice()] }], note: "Tối ưu " + p.data.best + " điểm." }; },
      toText: function (p) { return "giatoiuu\nsuc chua: " + p.data.cap + "\nkhoi luong: " + p.data.w.join(" ") + "\ngia tri: " + p.data.val.join(" "); },
      fromText: function (text) {
        var m = {}; String(text || "").split(/\r?\n/).forEach(function (line) { var k = line.split(":"); if (k.length === 2) m[k[0].trim()] = k[1].trim(); });
        var nums = function (s) { return String(s || "").split(/\s+/).filter(Boolean).map(Number); };
        if (!m["suc chua"]) return { ok: false, errors: ["Thiếu dòng 'suc chua: …'."], warnings: [] };
        return knapInput({ cap: +m["suc chua"], w: nums(m["khoi luong"]), val: nums(m["gia tri"]) });
      },
      toFile: function (p) { return { type: "giatoiuu", seed: p.seed, difficulty: p.score, size: p.size, initialState: "C=" + p.data.cap + ";w=" + p.data.w.join(",") + ";v=" + p.data.val.join(","), solution: picks(p, p.solution).join(","), metadata: {} }; },
      fromFile: function (o) {
        var m = /^C=(\d+);w=([\d,]+);v=([\d,]+)$/.exec(o && o.initialState || "");
        if (!m) return { ok: false, errors: ["initialState không đúng dạng C=…;w=…;v=…"], warnings: [] };
        return knapInput({ cap: +m[1], w: m[2].split(",").map(Number), val: m[3].split(",").map(Number) });
      },
      describeCell: function (p, s, i) { var chosen = picks(p, s).indexOf(i) >= 0; return "Món " + (i + 1) + ": nặng " + p.data.w[i] + ", giá trị " + p.data.val[i] + ", " + (chosen ? "đã chọn" : "chưa chọn"); }
    };

    // ================================================================================== giadoan — Đoán số (interactive)
    var N = 16;
    function layoutD() { return plan.layout(N - 1, 2, 1); }
    function need(size) { var k = 0; while ((1 << k) < size) k++; return k; }                        // ⌈log2 size⌉
    function interval(s) { var lo = 1, hi = N; plan.read(s, layoutD()).forEach(function (r) { if (r[1] === 2) lo = Math.max(lo, r[0]); else hi = Math.min(hi, r[0] - 1); }); return { lo: lo, hi: hi }; }
    /** Oracle tất định: 2 = "có, số ≥ x", 1 = "không". Cố định: so với bí mật. Đối thủ: giữ nhánh đông hơn (hoà → "có") — luôn nhất quán. */
    function answer(p, s, x) {
      if (p.data.secret != null) return p.data.secret >= x ? 2 : 1;
      var iv = interval(s), yes = Math.max(0, iv.hi - Math.max(iv.lo, x) + 1), no = Math.max(0, Math.min(iv.hi, x - 1) - iv.lo + 1);
      return yes >= no ? 2 : 1;
    }
    function bestAsk(iv) { return iv.lo + Math.floor((iv.hi - iv.lo + 1) / 2); }
    function guessPlay(p) {
      var s = { v: plan.empty(layoutD()), c: null }, L = layoutD(), steps = [];
      while (true) {
        var iv = interval(s);
        if (iv.lo >= iv.hi) { var g = plan.submitDiff(s, L, [iv.lo]); steps.push({ diff: g, text: "Chỉ còn số " + iv.lo + " — kết luận." }); P.game.applyDiff(s, g.d, false); break; }
        var x = bestAsk(iv), a = answer(p, s, x), d = plan.appendDiff(s, L, [x, a]);
        steps.push({ diff: d, text: "Hỏi: số ≥ " + x + "? → " + (a === 2 ? "có" : "không") + "." }); P.game.applyDiff(s, d.d, false);
      }
      return { state: s, steps: steps };
    }
    function guessPuzzle(seed, data, tier) {
      var p = { v: 1, type: "giadoan", seed: seed, sizeId: "16", size: { n: N }, tier: tier, score: 2, data: data, initial: { v: plan.empty(layoutD()) }, solution: null, meta: {} };
      p.solution = { v: guessPlay(p).state.v };
      p.id = P.util.puzzleId(p);
      return p;
    }
    var guess = {
      id: "giadoan", name: "Đoán số (giả)", family: "Deduction Puzzle", category: "Suy diễn", icon: "🔢",
      blurb: "Loại giả để kiểm hợp đồng puzzle tương tác.", rules: ["Hỏi 'số bí mật ≥ x?' và nhận câu trả lời.", "Kết luận khi chỉ còn một khả năng."],
      sizes: [{ id: "16", label: "Số 1–16", params: { n: N }, default: true, tiers: ["easy"] }],
      algorithm: { title: "Tìm kiếm nhị phân", steps: [{ title: "Chia đôi", text: "Mỗi câu hỏi loại một nửa khoảng." }] },
      difficultyNote: "Cố định.",
      kind: "interactive", objective: { sense: "min", label: "Số câu hỏi", unit: "câu" }, moveLabel: "Số câu đã hỏi",
      options: [{ id: "che", label: "Chế độ", choices: [{ id: "codinh", label: "Số cố định" }, { id: "doithu", label: "Đối thủ thích nghi", note: "luôn giữ nhánh đông hơn" }], default: "codinh" }],

      generate: function (seed, o) {
        o = o || {};
        var full = P.types.optionsOf(guess, o.options), data = { n: N, secret: null };
        if (full.che === "codinh") data.secret = 1 + P.rng.create(seed).fork("so").int(N); else data.che = full.che;
        var p = guessPuzzle(seed, data, "easy");
        p.options = P.types.compactOptions(guess, full);
        return p;
      },
      fromInput: function (inp) {
        if (!inp || !isInt(inp.secret, 1, N)) return { ok: false, errors: ["Số bí mật phải là số nguyên 1–" + N + "."], warnings: [], status: "none", count: 0 };
        return { ok: true, puzzle: guessPuzzle(null, { n: N, secret: inp.secret }, "custom"), errors: [], warnings: [], status: "unique", count: 1 };
      },
      validate: function (p) { return { ok: true, errors: [], status: "unique", count: 1, solution: p.solution }; },
      solve: function (p) { return { status: "unique", count: 1, solution: p.solution, steps: [{ technique: "Chia đôi", text: need(N) + " câu hỏi là đủ." }], techniques: { "Chia đôi": 1 }, nodes: need(N) }; },
      difficulty: function () { return 2; },
      newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
      isGiven: function () { return false; },
      moveFor: function (p, s, a) {
        var L = layoutD();
        if (!a) return null;
        if (a.k === "ask") { if (!isInt(a.x, 2, N)) return null; return plan.appendDiff(s, L, [a.x, answer(p, s, a.x)], "Hỏi: số ≥ " + a.x + "?"); }
        if (a.k === "guess") return isInt(a.x, 1, N) ? plan.submitDiff(s, L, [a.x], "Kết luận: số " + a.x) : null;
        if (a.k === "truncate") return plan.truncateDiff(s, L, a.n);
        return null;
      },
      check: function (p, s) {
        var iv = interval(s), done = plan.isSubmitted(s) && iv.lo === iv.hi && plan.params(s, layoutD())[0] === iv.lo;
        return { solved: done, complete: done, conflicts: [], filled: plan.count(s), total: need(N) };
      },
      mistakes: function (p, s, diff) {
        var iv = interval(s), t = after(s, diff), size = iv.hi - iv.lo + 1;
        if (plan.isSubmitted(t) && !plan.isSubmitted(s)) return iv.lo === iv.hi && plan.params(t, layoutD())[0] === iv.lo ? 0 : 1;
        if (plan.count(t) > plan.count(s)) {
          var x = plan.record(t, layoutD(), plan.count(t) - 1)[0], yes = Math.max(0, iv.hi - Math.max(iv.lo, x) + 1), no = Math.max(0, Math.min(iv.hi, x - 1) - iv.lo + 1);
          return need(Math.max(yes, no)) > need(size) - 1 ? 1 : 0;
        }
        return 0;
      },
      grade: function (p, s, counters) {
        var asks = plan.count(s), k = need(N), g = G.fromRatio(asks, k, "min", { digits: 0 }), solved = guess.check(p, s).solved, c = counters || {};
        if (!solved) return g;
        var penal = (c.undos || 0) > 0 || (c.hints && c.hints[3] > 0);
        g.stars = asks <= k ? (penal ? 2 : 3) : 1;
        g.text = asks <= k ? (penal ? "Đủ " + k + " câu hỏi nhưng có hoàn tác hoặc gợi ý mức 3" : "Tối ưu: " + k + " câu hỏi") : "Dùng " + asks + " câu (tối ưu " + k + ")";
        return g;
      },
      hint: function (p, s, level) {
        var iv = interval(s), L = layoutD();
        if (plan.isSubmitted(s)) {
          if (guess.check(p, s).solved) return { level: level, text: "Đã kết luận.", why: [], cells: [], none: true };
          return { level: level, text: "Kết luận chưa được chứng minh: còn các số " + iv.lo + "–" + iv.hi + ".", why: ["Mở lại để hỏi tiếp."], cells: [], action: level === 3 ? { k: "truncate", n: plan.count(s) } : null };
        }
        if (iv.lo === iv.hi) return { level: level, text: level === 3 ? "Kết luận: số " + iv.lo + "." : "Chỉ còn một khả năng — hãy kết luận.", why: ["Các câu trả lời loại hết số khác."], cells: [], action: level === 3 ? { k: "guess", x: iv.lo } : null };
        var x = bestAsk(iv), size = iv.hi - iv.lo + 1;
        if (level === 1) return { level: 1, text: "Còn " + size + " khả năng. Hãy hỏi sao cho mỗi câu trả lời loại khoảng một nửa.", why: [], cells: [] };
        if (level === 2) return { level: 2, text: "Hỏi một ngưỡng ở giữa khoảng còn lại.", why: [], cells: [] };
        return { level: 3, text: "Hỏi: số ≥ " + x + "?", why: ["Hai nhánh còn " + (iv.hi - x + 1) + " và " + (x - iv.lo) + " khả năng — đều cần ≤ " + (need(size) - 1) + " câu nữa."], cells: [], action: { k: "ask", x: x } };
      },
      replay: function (p) { return guessPlay(p).steps.map(function (st) { return { text: st.text, diff: { d: st.diff.d }, cells: [] }; }); },
      constraintView: function () { return { summary: "Số bí mật 1–" + N, variables: [{ name: "số bí mật", domain: "1–" + N }], constraints: ["mỗi câu trả lời giới hạn khoảng"], counts: { variables: 1, constraints: 1 } }; },
      trace: function (p) { return { kind: "tree", nodes: [{ id: 0, parent: -1, label: "1–" + N, status: "ok" }], truncated: false, note: "" }; },
      toText: function (p) { return "giadoan " + (p.data.secret == null ? "doithu" : "so=" + p.data.secret); },
      fromText: function (text) { var m = /so=(\d+)/.exec(String(text || "")); return m ? guess.fromInput({ secret: +m[1] }) : { ok: false, errors: ["Thiếu so=…"], warnings: [] }; },
      toFile: function (p) { return { type: "giadoan", seed: p.seed, difficulty: p.score, size: p.size, initialState: p.data.secret == null ? "doithu" : "so=" + p.data.secret, solution: "", metadata: {} }; },
      fromFile: function (o) { return guess.fromText(o && o.initialState); },
      describeCell: function (p, s, i) { var r = plan.record(s, layoutD(), i); return "Câu " + (i + 1) + ": số ≥ " + r[0] + "? " + (r[1] === 2 ? "có" : "không"); }
    };

    return { giatoiuu: knap, giadoan: guess, _bestFrom: bestFrom, _interval: interval, _need: need };
  }

  root.PuzLoaiGia = make;
  if (typeof module !== "undefined" && module.exports) module.exports = make;
})(typeof globalThis !== "undefined" ? globalThis : this);
