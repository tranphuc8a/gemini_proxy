/* puzzles/lightsout.js — LIGHTS OUT: bấm một ô thì đảo đèn ở ô đó và bốn ô kề (trên, dưới, trái, phải — nếu có); mục tiêu: TẮT HẾT đèn.

   state.v  : w*h số 0/1 (1 = BẬT, 0 = TẮT), i = hàng*w + cột. Không có ô cố định (isGiven luôn false). initial.v = bàn đã xáo.
   solution.v: toàn 0 (bàn đích).   puzzle.data = { w, h, presses: [chỉ số ô cần bấm — tập ÍT NHẤT, tăng dần] }   (presses = null nếu bàn không giải được).
   action   : { k:"press", i }  — bấm ô i. Diff đảo đúng các ô chữ thập; TỰ NGHỊCH ĐẢO (bấm lần nữa là hoàn tác).
   input (fromInput): { w: 2..10, h: 2..10 (hoặc n cho bàn vuông), v: mảng w*h 0/1 | chuỗi w*h ký tự 0/1, meta? }.

   THIẾT KẾ
   · Toán: bấm hai lần = không bấm và thứ tự không quan trọng ⇒ lời giải là một TẬP ô = vector x ∈ GF(2)^N (N = w*h). Đèn ô i tắt khi
     x_i + x_trên + x_dưới + x_trái + x_phải ≡ b_i (mod 2) ⇒ hệ tuyến tính A·x = b (cột j của A = mẫu bị đảo khi bấm j; A đối xứng).
   · Giải: khử Gauss–Jordan trên GF(2), mỗi hàng đóng gói vào Uint32 (bit j = hệ số của x_j, bit N = vế phải) nên một lần khử 10×10 chỉ vài chục nghìn phép XOR.
     hạng r, nhân = N − r chiều; b giải được ⇔ không có hàng dạng [0…0 | 1]; khi đó có ĐÚNG 2^(N−r) nghiệm. Nghiệm ÍT BẤM NHẤT: lấy nghiệm riêng (ẩn tự do = 0)
     rồi duyệt 2^(N−r) tổ hợp vector nhân theo mã Gray (mỗi bước một phép XOR); cùng số bấm thì chọn tập có chỉ số nhỏ nhất theo thứ tự từ điển (tất định).
     (Phần logic khử/nhân/duyệt Gray tham khảo ../light-grid-shared/gf2.js — ở đây viết lại cho tự chứa, offline, và đóng gói bit.)
   · Nhiều nghiệm là BÌNH THƯỜNG ở Lights Out (4×4 nhân 4 chiều, 5×5 nhân 2 chiều): fromInput/validate đặt ok = true và KHÔNG cảnh báo "nhiều nghiệm";
     số nghiệm + số bấm tối thiểu nằm ở trường `info`. `count` ở đây là SỐ NGHIỆM ĐÚNG (2^nhân), không cắt ở `limit` vì biết miễn phí.
   · Bàn KHÔNG giải được (b ∉ ảnh của A, vd 15/16 số bàn 4×4) → status "none", ok = false. Bàn đã tắt hết sẵn cũng bị từ chối (không có gì để chơi).
   · SINH: chọn số lần bấm mục tiêu m trong dải của bậc, bấm m ô ngẫu nhiên (rng) từ bàn tắt hết ⇒ luôn giải được; rồi TÍNH LẠI số bấm tối thiểu K bằng bộ giải
     (K ≤ m, bằng m khi nhân 0 chiều) và chấm điểm theo K — "khó" = cần nhiều bấm tối thiểu, bàn lớn. Thử lại bằng rng.fork("try"+k) tới khi điểm rơi đúng bậc.
   · HINT luôn giải lại A·x = b với trạng thái HIỆN TẠI nên mọi nước bấm "sai" tự được tính vào (không có nhánh báo lỗi); mỗi lần bấm theo hint mức 3 giảm đúng 1 lần
     bấm tối thiểu còn lại (nếu K' < K − 1 thì x' + e_j sẽ là nghiệm của bàn cũ nhẹ hơn K — mâu thuẫn), nên K lần hint đưa tới tắt hết. */
(function (root) {
  "use strict";
  var P = root.Puz, R = P.rng, U = P.util;
  var ID = "lightsout", MIN_D = 2, MAX_D = 10;
  var MAX_NULL_ENUM = 22;            // duyệt 2^nhân tổ hợp tới nhân 22 chiều (≈ 4 triệu); lớn hơn thì chỉ trả nghiệm riêng, minimal = false
  var MAX_TRIES = 40;
  var GAIN_MIN = 0.65, GAIN_SPAN = 0.35;   // hệ số cỡ bàn của điểm khó: 0,65 … 1,0 (xem difficultyNote)
  var TECH = "Khử Gauss GF(2)";

  // ---------------------------------------------------------------- bit
  function pc(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); x = (x + (x >>> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >>> 24; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function getBit(row, j) { return (row[j >>> 5] >>> (j & 31)) & 1; }
  function setBit(row, j) { row[j >>> 5] |= 1 << (j & 31); }
  function bad(s) { return s === undefined || s === null || s === ""; }
  function rcLabel(w, i) { return "hàng " + (Math.floor(i / w) + 1) + ", cột " + (i % w + 1); }

  // ---------------------------------------------------------------- luật chữ thập
  /** Chỉ số các ô bị đảo khi bấm ô i (tăng dần). */
  function crossCells(w, h, i) {
    var r = Math.floor(i / w), c = i % w, out = [];
    if (r > 0) out.push(i - w);
    if (c > 0) out.push(i - 1);
    out.push(i);
    if (c < w - 1) out.push(i + 1);
    if (r < h - 1) out.push(i + w);
    return out;
  }
  function applyPresses(w, h, v, presses) { var o = v.slice(); for (var k = 0; k < presses.length; k++) { var cs = crossCells(w, h, presses[k]); for (var m = 0; m < cs.length; m++) o[cs[m]] ^= 1; } return o; }

  // ---------------------------------------------------------------- khử Gauss–Jordan trên GF(2), mỗi hàng đóng gói Uint32
  function unpack(row, bits) { var o = new Array(bits); for (var j = 0; j < bits; j++) o[j] = getBit(row, j); return o; }
  /** Ghép [A | b]; khử; rec (tuỳ chọn) được gọi để ghi từng bước: rec("init", null, rows) / rec("pivot", {col,row,swapped,elim}, rows). */
  function eliminate(w, h, b, rec) {
    var N = w * h, W = (N + 32) >>> 5, rows = new Array(N), i, k, c, r;
    for (i = 0; i < N; i++) {
      var row = new Uint32Array(W), cs = crossCells(w, h, i);
      for (k = 0; k < cs.length; k++) setBit(row, cs[k]);
      if (b[i]) setBit(row, N);
      rows[i] = row;
    }
    if (rec) rec("init", null, rows);
    var pivotCols = [];
    r = 0;
    for (c = 0; c < N && r < N; c++) {
      var wd = c >>> 5, bit = 1 << (c & 31), p = -1;
      for (i = r; i < N; i++) if (rows[i][wd] & bit) { p = i; break; }
      if (p < 0) continue;
      var swapped = -1;
      if (p !== r) { var tmp = rows[p]; rows[p] = rows[r]; rows[r] = tmp; swapped = p; }
      var elim = 0;
      for (i = 0; i < N; i++) if (i !== r && (rows[i][wd] & bit)) { var ri = rows[i], rp = rows[r]; for (k = 0; k < W; k++) ri[k] ^= rp[k]; elim++; }
      pivotCols.push(c); r++;
      if (rec) rec("pivot", { col: c, row: r - 1, swapped: swapped, elim: elim }, rows);
    }
    var consistent = true;
    for (i = r; i < N; i++) if (getBit(rows[i], N)) { consistent = false; break; }
    return { N: N, W: W, rows: rows, pivotCols: pivotCols, rank: r, consistent: consistent };
  }

  /** Giải A·x = b, mô tả cả tập nghiệm. board: mảng 0/1 độ dài w*h.
      → {status, count, rank, nullity, presses:[…]|null, weight, minimal, N}. status: none | unique | multiple. */
  function analyse(w, h, board) {
    var el = eliminate(w, h, board), N = el.N, nullity = N - el.rank, res = { N: N, rank: el.rank, nullity: nullity, status: "none", count: 0, presses: null, weight: -1, minimal: true };
    if (!el.consistent) return res;
    var W0 = (N + 31) >>> 5, x0 = new Uint32Array(W0), k, f, j, isPivot = new Uint8Array(N);
    for (k = 0; k < el.pivotCols.length; k++) { isPivot[el.pivotCols[k]] = 1; if (getBit(el.rows[k], N)) setBit(x0, el.pivotCols[k]); }
    var basis = [];
    for (f = 0; f < N; f++) {
      if (isPivot[f]) continue;
      var v = new Uint32Array(W0); setBit(v, f);
      for (k = 0; k < el.pivotCols.length; k++) if (getBit(el.rows[k], f)) setBit(v, el.pivotCols[k]);
      basis.push(v);
    }
    function weight(a) { var s = 0; for (var q = 0; q < W0; q++) s += pc(a[q]); return s; }
    function lexLess(a, b2) { for (var q = 0; q < W0; q++) { var d = a[q] ^ b2[q]; if (d) { var low = d & -d; return !!(a[q] & low); } } return false; }
    var best = x0, bestW = weight(x0);
    if (basis.length && basis.length <= MAX_NULL_ENUM) {
      var cur = Uint32Array.from(x0), total = Math.pow(2, basis.length);
      for (var g = 1; g < total; g++) {
        var t = g & -g, idx = 31 - Math.clz32(t), bv = basis[idx];                   // mã Gray: mỗi bước lật đúng một vector nhân
        for (j = 0; j < W0; j++) cur[j] ^= bv[j];
        var wt = weight(cur);
        if (wt < bestW || (wt === bestW && lexLess(cur, best))) { bestW = wt; best = Uint32Array.from(cur); }
      }
    } else if (basis.length) res.minimal = false;
    var presses = []; for (j = 0; j < N; j++) if (getBit(best, j)) presses.push(j);
    res.presses = presses; res.weight = presses.length;
    res.count = nullity < 52 ? Math.pow(2, nullity) : Infinity;
    res.status = nullity === 0 ? "unique" : "multiple";
    return res;
  }

  // ---------------------------------------------------------------- đọc đề / điểm khó
  function analyze(puzzle) {
    var out = { ok: false, errors: [], w: 0, h: 0, N: 0 };
    if (!puzzle || typeof puzzle !== "object") { out.errors.push("Đề không phải một đối tượng."); return out; }
    var d = puzzle.data || {}, s = puzzle.size || {};
    var w = toInt(d.w != null ? d.w : s.w), h = toInt(d.h != null ? d.h : s.h);
    if (w == null || h == null || w < MIN_D || w > MAX_D || h < MIN_D || h > MAX_D) { out.errors.push("Kích thước bàn phải là w, h nguyên trong " + MIN_D + "…" + MAX_D + "."); return out; }
    var v = puzzle.initial && puzzle.initial.v;
    if (!Array.isArray(v) || v.length !== w * h) { out.errors.push("Trạng thái đầu phải có đúng " + (w * h) + " ô (bàn " + w + "×" + h + ")."); return out; }
    for (var i = 0; i < v.length; i++) if (v[i] !== 0 && v[i] !== 1) { out.errors.push("Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận 0 hoặc 1)."); return out; }
    out.ok = true; out.w = w; out.h = h; out.N = w * h; out.v = v;
    return out;
  }
  function boardOf(a, state) { return state && Array.isArray(state.v) && state.v.length === a.N ? state.v : null; }

  function scoreOf(N, K) {
    if (K <= 0) return 0;
    var sizeTerm = clamp01((N - 4) / 45), pressTerm = clamp01(K / (0.5 * N + 1));
    return U.clampScore(10 * pressTerm * (GAIN_MIN + GAIN_SPAN * sizeTerm));
  }
  function difficulty(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return 0;
    var an = analyse(a.w, a.h, a.v);
    return an.status === "none" ? 0 : scoreOf(a.N, an.weight);
  }

  // ---------------------------------------------------------------- dựng puzzle
  function sizeIdOf(w, h) { if (w === h) for (var i = 0; i < SIZES.length; i++) if (SIZES[i].params.w === w) return SIZES[i].id; return "custom"; }
  function zeros(N) { var z = new Array(N); for (var i = 0; i < N; i++) z[i] = 0; return z; }
  function buildPuzzle(w, h, v, an, o) {
    var p = { v: 1, type: ID, id: "", seed: o.seed == null ? null : o.seed, sizeId: o.sizeId || sizeIdOf(w, h), size: { w: w, h: h }, tier: o.tier || "custom", score: o.score || 0,
      data: { w: w, h: h, presses: an && an.presses ? an.presses.slice() : null }, initial: { v: v.slice() }, solution: an && an.status !== "none" ? { v: zeros(w * h) } : null, meta: o.meta || {} };
    p.id = U.puzzleId(p);
    return p;
  }
  function cleanMeta(m) {
    var o = {};
    if (m && typeof m === "object") ["name", "source", "note"].forEach(function (k) { if (typeof m[k] === "string" && m[k]) o[k] = m[k].slice(0, 200); });
    return o;
  }
  function infoOf(an) { return { rank: an.rank, nullity: an.nullity, solutions: an.count, minPresses: an.weight, presses: an.presses ? an.presses.slice() : null, minimal: an.minimal }; }

  // ---------------------------------------------------------------- sinh
  function pickSize(sizeId) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === String(sizeId)) return SIZES[i];
    for (i = 0; i < SIZES.length; i++) if (SIZES[i].default) return SIZES[i];
    return SIZES[0];
  }
  function nearestTier(size, tier) {
    var tiers = size.tiers || ["easy", "medium", "hard", "expert"], order = ["easy", "medium", "hard", "expert"];
    if (tiers.indexOf(tier) >= 0) return tier;
    var want = order.indexOf(tier), best = tiers[0], bd = 99;
    tiers.forEach(function (t) { var d = Math.abs(order.indexOf(t) - want); if (d < bd) { bd = d; best = t; } });
    return best;
  }
  /** Các số bấm tối thiểu K (2…0,65·N) mà điểm rơi vào bậc `tier`. */
  function bandOf(N, tier) {
    var out = [], cap = Math.max(3, Math.ceil(0.65 * N));
    for (var K = 2; K <= cap; K++) if (U.tierOfScore(scoreOf(N, K)).id === tier) out.push(K);
    return out;
  }

  function generate(seed, opt) {
    opt = opt || {};
    var size = pickSize(opt.sizeId), w = size.params.w, h = size.params.h, N = w * h;
    var tier = nearestTier(size, U.tier(opt.tier) ? opt.tier : "medium"), T = U.tier(tier), band = bandOf(N, tier);
    var rng = R.create(seed), best = null, k, i;
    if (!band.length) band = [Math.max(2, Math.round(0.3 * N))];
    for (k = 0; k < MAX_TRIES; k++) {
      var rk = rng.fork("try" + k), m = band[rk.fork("m").int(band.length)], cells = [];
      for (i = 0; i < N; i++) cells.push(i);
      rk.fork("cells").shuffle(cells);
      var x = cells.slice(0, Math.min(m, N)).sort(function (p, q) { return p - q; });
      var v = applyPresses(w, h, zeros(N), x), an = analyse(w, h, v);
      if (an.status === "none" || an.weight < 2) continue;
      var score = scoreOf(N, an.weight), cand = { v: v, an: an, score: score };
      if (U.tierOfScore(score).id === tier) { best = cand; break; }
      if (!best || Math.abs(score - T.target) < Math.abs(best.score - T.target)) best = cand;
    }
    return buildPuzzle(w, h, best.v, best.an, { seed: rng.seed, sizeId: size.id, tier: U.tierOfScore(best.score).id, score: best.score });
  }

  // ---------------------------------------------------------------- giải / kiểm đề
  function stepsOf(w, h, an) {
    var out = [];
    if (!an.presses) return out;
    an.presses.forEach(function (i, k) { out.push({ technique: TECH, text: "Bấm ô (" + rcLabel(w, i) + ") — lần " + (k + 1) + "/" + an.presses.length + " trong tập bấm ít nhất." }); });
    return out;
  }
  function solve(puzzle, opts) {
    opts = opts || {};
    var a = analyze(puzzle);
    if (!a.ok) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, errors: a.errors };
    var board = Array.isArray(opts.board) && opts.board.length === a.N && opts.board.every(function (x) { return x === 0 || x === 1; }) ? opts.board : a.v;
    var an = analyse(a.w, a.h, board);
    var out = { status: an.status, count: an.count, solution: an.status === "none" ? null : { v: zeros(a.N) }, steps: stepsOf(a.w, a.h, an), techniques: {}, nodes: an.status === "none" ? 0 : Math.pow(2, an.nullity),
      presses: an.presses, minPresses: an.weight, info: infoOf(an) };
    if (out.steps.length) out.techniques[TECH] = out.steps.length;
    if (!an.minimal) out.warning = "Nhân quá lớn (" + an.nullity + " chiều): chỉ trả một nghiệm, chưa chắc ít bấm nhất.";
    return out;
  }
  function noneText(w, h, an) {
    var frac = an.nullity ? "chỉ khoảng 1/" + Math.pow(2, an.nullity) + " số bàn " + w + "×" + h + " giải được" : "";
    return "Bàn này không có lời giải: không tập ô bấm nào tắt hết đèn" + (frac ? " (" + frac + ")" : "") + ".";
  }
  function validate(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { ok: false, errors: a.errors, status: "none", count: 0 };
    var an = analyse(a.w, a.h, a.v), errors = [];
    if (an.status === "none") errors.push(noneText(a.w, a.h, an));
    else if (an.weight === 0) errors.push("Bàn đã tắt hết đèn sẵn: không có gì để chơi.");
    var out = { ok: errors.length === 0, errors: errors, status: an.status, count: an.count, info: infoOf(an) };
    if (an.status !== "none") out.solution = { v: zeros(a.N) };
    return out;
  }
  function badInput(msg) { return { ok: false, puzzle: null, errors: Array.isArray(msg) ? msg : [msg], warnings: [], status: "none", count: 0 }; }

  function fromInput(input) {
    try {
      if (!input || typeof input !== "object") return badInput("Dữ liệu nhập không hợp lệ: cần một đối tượng {w, h, v}.");
      var w = toInt(input.w != null ? input.w : input.n), h = toInt(input.h != null ? input.h : input.n);
      if (input.size && typeof input.size === "object") { if (w == null) w = toInt(input.size.w); if (h == null) h = toInt(input.size.h); }
      if (w == null || h == null || w < MIN_D || w > MAX_D || h < MIN_D || h > MAX_D) return badInput("Kích thước bàn phải là w, h nguyên trong " + MIN_D + "…" + MAX_D + ".");
      var N = w * h, v = zeros(N), src = input.v, i;
      if (typeof src === "string") { if (!/^[01]*$/.test(src)) return badInput("Chuỗi bàn chỉ được gồm ký tự 0 và 1."); src = src.split("").map(Number); }
      if (src != null) {
        if (!Array.isArray(src) || src.length !== N) return badInput("Bàn " + w + "×" + h + " cần đúng " + N + " ô, nhận được " + (Array.isArray(src) ? src.length : "không phải mảng") + ".");
        for (i = 0; i < N; i++) { if (src[i] !== 0 && src[i] !== 1) return badInput("Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận 0 hoặc 1)."); v[i] = src[i]; }
      }
      var an = analyse(w, h, v), errors = [];
      if (an.status === "none") errors.push(noneText(w, h, an));
      else if (an.weight === 0) errors.push("Bàn đang tắt hết đèn: hãy bật ít nhất một đèn.");
      var puzzle = buildPuzzle(w, h, v, an, { seed: null, tier: "custom", meta: cleanMeta(input.meta) });
      puzzle.score = difficulty(puzzle);
      return { ok: errors.length === 0, puzzle: puzzle, errors: errors, warnings: [], status: an.status, count: an.count, info: infoOf(an) };
    } catch (e) { return badInput("Không đọc được dữ liệu nhập: " + (e && e.message ? e.message : e)); }
  }

  // ---------------------------------------------------------------- ván chơi
  function newState(puzzle) { return { v: puzzle.initial.v.slice(), c: null }; }
  function isGiven() { return false; }
  function moveFor(puzzle, state, action) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v || !action || action.k !== "press") return null;
    var i = toInt(action.i);
    if (i == null || i < 0 || i >= a.N) return null;
    var cs = crossCells(a.w, a.h, i), d = [];
    for (var k = 0; k < cs.length; k++) d.push(["v", cs[k], v[cs[k]], v[cs[k]] ? 0 : 1]);
    return { d: d, label: "Bấm ô (" + rcLabel(a.w, i) + ")" };
  }
  function check(puzzle, state) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v) return { solved: false, conflicts: [], filled: 0, total: a.N || 0 };
    var on = 0; for (var i = 0; i < v.length; i++) if (v[i]) on++;
    return { solved: on === 0, conflicts: [], filled: a.N - on, total: a.N };
  }
  function mistakes() { return 0; }          // Lights Out không có "nước sai": mọi nước bấm đều được tính vào lời giải mới (xem hint)
  function describeCell(puzzle, state, i) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v || toInt(i) == null || i < 0 || i >= a.N) return "Ô không hợp lệ";
    return "Hàng " + (Math.floor(i / a.w) + 1) + ", cột " + (i % a.w + 1) + ", đèn " + (v[i] ? "bật" : "tắt");
  }

  // ---------------------------------------------------------------- gợi ý
  function rowCells(w, r) { var o = []; for (var c = 0; c < w; c++) o.push(r * w + c); return o; }
  function hint(puzzle, state, level) {
    level = Math.max(1, Math.min(3, level | 0 || 1));
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v) return { level: level, text: "Đề không hợp lệ nên chưa gợi ý được.", why: a.errors.slice(), cells: [], none: true };
    var an = analyse(a.w, a.h, v);
    if (an.status === "none") return { level: level, text: "Bàn hiện tại không thể tắt hết đèn bằng các nước bấm nên không gợi ý được.", why: [], cells: [], none: true };
    if (an.weight === 0) return { level: level, text: "Tất cả đèn đã tắt — không còn gì để gợi ý.", why: [], cells: [], none: true };
    var i = an.presses[0], r = Math.floor(i / a.w), c = i % a.w, K = an.weight, inRow = an.presses.filter(function (q) { return Math.floor(q / a.w) === r; }).length;
    if (level === 1) return { level: 1, text: "Bàn này cần ít nhất " + K + " lần bấm nữa. Hãy nhìn vào hàng " + (r + 1) + ".", why: [], cells: rowCells(a.w, r), technique: TECH };
    if (level === 2) return { level: 2, text: "Hàng " + (r + 1) + " còn cần bấm " + inRow + " ô. Một ô cần bấm nằm ở cột " + (c + 1) + ".", why: [], cells: [i], technique: TECH };
    var why = ["Mỗi ô có một phương trình: x(ô) + x(trên) + x(dưới) + x(trái) + x(phải) = trạng thái ô (mod 2), với x = 1 nếu ô được bấm.",
      "Theo nghiệm của hệ Ax = b trên GF(2) với trạng thái hiện tại, ô này có hệ số 1 trong nghiệm ít bấm nhất.",
      "Hệ có hạng " + an.rank + ", nhân " + an.nullity + " chiều ⇒ " + an.count + " cách bấm đều tắt hết; cách ngắn nhất cần " + K + " lần. Bấm ô này xong còn " + (K - 1) + " lần."];
    return { level: 3, text: "Bấm ô " + rcLabel(a.w, i) + ".", why: why, cells: [i], technique: TECH, action: { k: "press", i: i } };
  }
  function replay(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return [];
    var an = analyse(a.w, a.h, a.v); if (an.status === "none" || !an.presses.length) return [];
    var st = newState(puzzle), out = [], K = an.presses.length;
    an.presses.forEach(function (i, k) {
      var diff = moveFor(puzzle, st, { k: "press", i: i });
      var why = k === 0 ? ["Giải A·x = b trên GF(2): hạng " + an.rank + ", nhân " + an.nullity + " chiều, " + an.count + " nghiệm; chọn nghiệm ít bấm nhất (" + K + " lần).", "Ô này có hệ số 1 trong nghiệm đó."] : ["Ô này cũng có hệ số 1 trong nghiệm ít bấm nhất; thứ tự bấm không quan trọng."];
      out.push({ text: "Bấm ô " + rcLabel(a.w, i) + " (lần " + (k + 1) + "/" + K + "): đảo " + diff.d.length + " đèn.", why: why, diff: diff, cells: diff.d.map(function (e) { return e[1]; }), technique: TECH });
      P.game.applyDiff(st, diff.d, false);
    });
    return out;
  }

  // ---------------------------------------------------------------- constraint view, trace
  function cellName(w, i) { return "x(" + (Math.floor(i / w) + 1) + "," + (i % w + 1) + ")"; }
  function equationOf(w, h, v, i) {
    var r = Math.floor(i / w), c = i % w, terms = [cellName(w, i)];
    if (r > 0) terms.push(cellName(w, i - w));
    if (r < h - 1) terms.push(cellName(w, i + w));
    if (c > 0) terms.push(cellName(w, i - 1));
    if (c < w - 1) terms.push(cellName(w, i + 1));
    return terms.join(" + ") + " = " + v[i] + " (mod 2)";
  }
  function constraintView(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { summary: "Đề không hợp lệ.", variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    var w = a.w, h = a.h, N = a.N, an = analyse(w, h, a.v), variables = [], constraints = [], i, r;
    if (N < 40) for (i = 0; i < N; i++) variables.push({ name: cellName(w, i), domain: "{0, 1}" });
    else for (r = 0; r < h; r++) variables.push({ name: "x(" + (r + 1) + ",1) … x(" + (r + 1) + "," + w + ")", domain: "{0, 1}", count: w });
    constraints.push("Mỗi ô một phương trình mod 2: x(ô) + x(trên) + x(dưới) + x(trái) + x(phải) = trạng thái ô (ô ở rìa có ít số hạng hơn). x = 1 nghĩa là ô được bấm.");
    var cap = N <= 40 ? N : 12;
    for (i = 0; i < cap; i++) constraints.push(equationOf(w, h, a.v, i));
    if (cap < N) constraints.push("… và " + (N - cap) + " phương trình khác cùng dạng (mỗi ô một phương trình).");
    var summary = N + " biến nhị phân (ô có được bấm không) và " + N + " phương trình mod 2 — hệ A·x = b trên GF(2). Hạng " + an.rank + ", nhân " + an.nullity + " chiều; " +
      (an.status === "none" ? "bàn này KHÔNG giải được (b ngoài ảnh của A)." : an.count + " nghiệm" + (an.count > 1 ? " (cùng đúng, ít nhất " + an.weight + " lần bấm)" : ", cần " + an.weight + " lần bấm") + ".");
    return { summary: summary, variables: variables, constraints: constraints, counts: { variables: N, constraints: N, rank: an.rank, nullity: an.nullity, solutions: an.count, minPresses: an.weight } };
  }

  function trace(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { kind: "matrix", title: "Khử Gauss trên GF(2)", steps: [], note: "Đề không hợp lệ." };
    var w = a.w, h = a.h, N = a.N, cap = Math.max(8, Math.min(60, Math.floor(40000 / (N * (N + 1))))), steps = [], pivots = 0, total = 0, stop = false;
    function snap(rows) { return rows.map(function (row) { return unpack(row, N + 1); }); }
    var el = eliminate(w, h, a.v, function (kind, info, rows) {
      if (kind === "init") { steps.push({ text: "Ma trận mở rộng [A | b]: hàng i = phương trình của ô i; cột j = ô j (có được bấm không), cột cuối = trạng thái đèn b.", matrix: snap(rows) }); return; }
      total++;
      if (stop) return;
      if (steps.length >= cap - 1) { stop = true; return; }
      var txt = "Cột " + (info.col + 1) + " (ẩn " + cellName(w, info.col) + "): " + (info.swapped >= 0 ? "đổi chỗ hàng " + (info.swapped + 1) + " lên hàng " + (info.row + 1) + " để có pivot 1; " : "pivot 1 đã ở hàng " + (info.row + 1) + "; ") + "cộng (XOR) hàng pivot vào " + info.elim + " hàng khác có 1 ở cột này.";
      steps.push({ text: txt, matrix: snap(rows), pivot: [info.row, info.col] }); pivots++;
    });
    var truncated = pivots < el.pivotCols.length;
    if (!truncated) {
      var tail = el.consistent ? "Xong: hạng " + el.rank + ", nhân " + (N - el.rank) + " chiều. Mọi hàng còn lại đều dạng [0 … 0 | 0] nên hệ có nghiệm; mỗi cột pivot cho một ẩn, cột không pivot là ẩn tự do (" + (N - el.rank) + " ẩn)."
        : "Xong: hạng " + el.rank + ", nhân " + (N - el.rank) + " chiều. Có hàng dạng [0 … 0 | 1] (0 = 1) nên hệ VÔ NGHIỆM — bàn này không thể tắt hết.";
      if (steps.length < cap) steps.push({ text: tail, matrix: snap(el.rows) }); else steps[steps.length - 1].text += " " + tail;
    }
    var note = "Khử Gauss–Jordan trên GF(2): cộng hàng = XOR. " + N + " hàng × " + (N + 1) + " cột.";
    if (truncated) note += " Chỉ ghi " + steps.length + " bước đầu (" + pivots + "/" + el.pivotCols.length + " pivot) để gọn.";
    return { kind: "matrix", title: "Khử Gauss trên GF(2) — [A | b] của bàn " + w + "×" + h, steps: steps, truncated: truncated, note: note, rank: el.rank, nullity: N - el.rank, solvable: el.consistent };
  }

  // ---------------------------------------------------------------- nhập / xuất
  function toText(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return "";
    var rows = [], r, c;
    for (r = 0; r < a.h; r++) { var t = []; for (c = 0; c < a.w; c++) t.push(a.v[r * a.w + c] ? "#" : "."); rows.push(t.join(" ")); }
    return rows.join("\n");
  }
  var ON_CH = "#1XxOo*", OFF_CH = ".0-_";
  function fromText(text) {
    try {
      if (typeof text !== "string") return badInput("Cần một chuỗi văn bản.");
      var lines = text.replace(/\r/g, "").split("\n").map(function (l) { return l.replace(/[\s|,;│]/g, ""); }).filter(function (l) { return l.length > 0; });
      if (!lines.length) return badInput("Văn bản rỗng.");
      var v = [], li, k;
      for (li = 0; li < lines.length; li++) for (k = 0; k < lines[li].length; k++) {
        var ch = lines[li].charAt(k);
        if (ON_CH.indexOf(ch) >= 0) v.push(1); else if (OFF_CH.indexOf(ch) >= 0) v.push(0);
        else return badInput("Ký tự lạ \"" + ch + "\" — dùng # (đèn bật) và . (đèn tắt).");
      }
      var w, h;
      if (lines.length > 1) { h = lines.length; w = lines[0].length; for (li = 0; li < lines.length; li++) if (lines[li].length !== w) return badInput("Các dòng phải cùng độ dài: dòng 1 có " + w + " ô nhưng dòng " + (li + 1) + " có " + lines[li].length + " ô."); }
      else { w = Math.round(Math.sqrt(v.length)); h = w; if (w * h !== v.length) return badInput("Nhập một dòng thì số ô (" + v.length + ") phải là số chính phương; bàn chữ nhật hãy nhập mỗi hàng một dòng."); }
      return fromInput({ w: w, h: h, v: v });
    } catch (e) { return badInput("Không đọc được văn bản: " + (e && e.message ? e.message : e)); }
  }
  function vToStr(v) { return v.map(function (x) { return x ? "1" : "0"; }).join(""); }
  function toFile(puzzle) {
    if (!puzzle || typeof puzzle !== "object") return { type: ID, seed: null, difficulty: 0, size: { w: 0, h: 0 }, initialState: "", solution: "", metadata: {} };
    var a = analyze(puzzle);
    return { type: ID, seed: puzzle.seed == null ? null : puzzle.seed, difficulty: puzzle.score, size: { w: a.w || (puzzle.size && puzzle.size.w), h: a.h || (puzzle.size && puzzle.size.h) },
      initialState: a.ok ? vToStr(a.v) : "", solution: puzzle.solution ? vToStr(puzzle.solution.v) : "",
      metadata: { name: puzzle.meta && puzzle.meta.name, source: puzzle.meta && puzzle.meta.source, note: puzzle.meta && puzzle.meta.note, tier: puzzle.tier, w: a.w, h: a.h, presses: puzzle.data && puzzle.data.presses ? puzzle.data.presses.slice() : null } };
  }
  function fromFile(obj) {
    try {
      if (!obj || typeof obj !== "object") return badInput("Tệp không phải một đối tượng JSON.");
      if (obj.type === undefined || obj.type === null) return badInput("Tệp thiếu trường type (cần \"lightsout\").");
      if (obj.type !== ID) return badInput("Tệp này không phải đề Lights Out (type = " + JSON.stringify(obj.type) + ").");
      var s = obj.initialState;
      if (typeof s !== "string" || !s.length) return badInput("Thiếu initialState (chuỗi 0/1 độ dài w×h).");
      if (!/^[01]+$/.test(s)) return badInput("initialState chỉ được gồm ký tự 0 và 1.");
      var sz = obj.size, w = toInt(sz && typeof sz === "object" ? sz.w : sz), h = toInt(sz && typeof sz === "object" ? sz.h : sz);
      if (w == null && h == null) { w = Math.round(Math.sqrt(s.length)); h = w; }
      if (w == null || h == null) return badInput("Thiếu kích thước bàn (size.w và size.h).");
      if (w * h !== s.length) return badInput("initialState có " + s.length + " ký tự, không khớp bàn " + w + "×" + h + ".");
      var out = fromInput({ w: w, h: h, v: s, meta: obj.metadata });
      if (out.puzzle && typeof obj.seed === "number" && isFinite(obj.seed)) out.puzzle.seed = R.seedOf(obj.seed);
      return { ok: out.ok, puzzle: out.puzzle, errors: out.errors, warnings: out.warnings };
    } catch (e) { return badInput("Không đọc được tệp: " + (e && e.message ? e.message : e)); }
  }

  // ---------------------------------------------------------------- đăng ký
  var SIZES = [
    { id: "3", label: "3×3", params: { w: 3, h: 3 }, tiers: ["easy", "medium", "hard"] },
    { id: "4", label: "4×4", params: { w: 4, h: 4 }, tiers: ["easy", "medium"] },
    { id: "5", label: "5×5", params: { w: 5, h: 5 }, default: true, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "6", label: "6×6", params: { w: 6, h: 6 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "7", label: "7×7", params: { w: 7, h: 7 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];

  var def = {
    id: ID, name: "Lights Out", family: "Mathematical Puzzle", category: "Đại số tuyến tính", icon: "💡",
    blurb: "Bấm một ô sẽ đảo đèn ở ô đó và bốn ô kề — hãy tắt hết đèn, ít lần bấm nhất có thể.",
    rules: [
      "Mỗi ô là một chiếc đèn: bật (sáng) hoặc tắt (tối). Mục tiêu là tắt TẤT CẢ đèn.",
      "Bấm một ô sẽ đảo trạng thái của chính ô đó và của các ô kề phía trên, phía dưới, bên trái, bên phải (nếu có).",
      "Bấm hai lần cùng một ô thì trở lại như cũ, và thứ tự bấm không quan trọng — chỉ cần biết ô nào được bấm một số LẺ lần.",
      "Đề do app sinh luôn giải được. Một bàn có thể có nhiều cách tắt hết đèn (đều đúng); gợi ý luôn theo cách ít lần bấm nhất.",
      "Bàn chữ nhật tự nhập có thể không giải được — app sẽ báo cho bạn."
    ],
    sizes: SIZES,
    algorithm: {
      title: "Khử Gauss trên GF(2) cho Lights Out",
      steps: [
        { title: "Bấm hai lần là không bấm", text: "Bấm một ô là phép XOR lên chữ thập của nó; bấm hai lần huỷ nhau và thứ tự không quan trọng. Vì vậy một lời giải chỉ là TẬP các ô được bấm: mỗi ô một ẩn x ∈ {0, 1} (1 = bấm)." },
        { title: "Mô hình hoá thành hệ tuyến tính A·x = b", text: "Đèn ô i tắt khi x(ô i) + x(trên) + x(dưới) + x(trái) + x(phải) ≡ b(ô i) (mod 2), với b là trạng thái đèn lúc đầu. Gộp N ô lại: A·x = b trên GF(2) (cộng mod 2), cột j của A là mẫu đèn bị đảo khi bấm ô j." },
        { title: "Khử Gauss (Gauss–Jordan) bằng XOR", text: "Biến ma trận mở rộng [A | b] thành dạng bậc thang bằng cách đổi chỗ hàng và cộng (XOR) hàng pivot vào các hàng khác. Số pivot là hạng r. Có hàng dạng [0 … 0 | 1] thì vô nghiệm; cột không có pivot là ẩn tự do. Mỗi hàng đóng gói vào các số 32-bit nên một phép cộng hàng chỉ vài lệnh XOR." },
        { title: "Hạt nhân và nghiệm ít bấm nhất", text: "Hạt nhân là các tập bấm \"không đổi gì\" (A·x = 0), có N − r chiều. Bàn giải được thì có đúng 2^(N − r) nghiệm — mỗi nghiệm khác nhau một vector hạt nhân. Thử cộng mọi tổ hợp vector hạt nhân (mã Gray, mỗi bước một XOR) vào một nghiệm để tìm cách ít bấm nhất; N − r nhỏ nên chỉ cỡ vài trăm tổ hợp." },
        { title: "Vì sao 4×4 chỉ 1/16 bàn giải được", text: "Bàn 4×4 có hạt nhân 4 chiều nên ảnh của A chỉ có 2^(16 − 4) = 4096 trong 65536 bàn — đúng 1/16; bàn 5×5 (nhân 2 chiều) giải được 1/4 số bàn và mỗi bàn có 4 cách, còn 3×3 và 6×6 (nhân 0 chiều) thì bàn nào cũng giải được và cách giải duy nhất." }
      ],
      links: [{ id: "gaussian-elimination", label: "Khử Gauss (giải hệ tuyến tính, có bản GF(2) bằng bitset)" }, { id: "bit-manipulation", label: "Thao tác bit — XOR" }]
    },
    difficultyNote: "Điểm 0–10 = 10 × min(1, K/(0,5·N + 1)) × (0,65 + 0,35 · min(1, (N − 4)/45)), với N = số ô và K = số lần bấm TỐI THIỂU do khử Gauss tính ra (không phải số lần bấm ngẫu nhiên lúc sinh đề). Cần nhiều lần bấm tối thiểu và bàn lớn = khó; hệ số cỡ bàn làm bàn nhỏ (3×3, 4×4) không với tới bậc Chuyên gia.",
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty, newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes,
    hint: hint, replay: replay, constraintView: constraintView, trace: trace, describeCell: describeCell, toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText
  };
  def.MIN_D = MIN_D; def.MAX_D = MAX_D;
  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
