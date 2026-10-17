/* puzzles/nqueens.js — N-QUEENS: đặt đủ N hậu trên bàn N×N sao cho không hai hậu nào cùng hàng, cùng cột, cùng đường chéo.
   Đề = bàn có SẴN vài hậu cố định; người chơi đặt nốt. Đề sinh ra có ĐÚNG MỘT cách hoàn thành.

   state.v  : n*n số, i = hàng*n + cột.  0 = trống · 1 = hậu · 2 = "chấm loại" (người chơi tự đánh dấu ô không thể đặt; chỉ để ghi chú —
              check/solved/mistakes/hint đều chỉ tính ô = 1).
   initial.v: chỉ có 0 và 1; ô = 1 là hậu CHO SẴN (isGiven → true, không sửa được).     puzzle.data = { n }.    solution.v = bàn n×n có n hậu.
   action   : { k:"set", i, val }   val 0/1/2 (đặt hậu / chấm loại / xoá)
              { k:"cycle", i }      0 → 1 → 2 → 0  (trống → hậu → chấm loại → trống; bàn cảm ứng bấm lặp)
              { k:"clear" }         bỏ MỌI thứ người chơi đã thêm (hậu và chấm), giữ hậu cho sẵn
              { k:"clearmarks" }    chỉ bỏ các chấm loại
   input (fromInput): { n: 4..24, v?: mảng n*n 0/1 | chuỗi n*n ký tự 0/1, queens?: [chỉ số ô], meta? } — v/queens bỏ trống = bàn trống.

   THIẾT KẾ
   · Bộ giải RIÊNG bằng bitmask (không dùng Puz.csp cho việc sinh/đếm): mỗi hàng giữ một mặt nạ cột còn an toàn; đặt hậu thì AND bỏ cột + hai đường chéo
     khỏi mọi hàng còn lại (O(n) một nút), chọn hàng ÍT cột nhất (MRV), cắt khi có hàng hết cột hoặc có cột hết hàng.
     Puz.csp vẫn được dùng cho `trace` (cây quay lui để vẽ) và test đối chiếu độc lập. ĐO THẬT (không phải phỏng đoán): csp đủ nhanh cho N-Queens vì lan truyền
     GAC cắt rất mạnh — 96 phép "bỏ một hậu rồi đếm tới 2" ở N = 16 mất 168 ms bằng csp so với 5 ms bằng bitmask (chậm ≈ 30×), vẫn lọt ngân sách sinh đề.
     Bitmask được chọn vì còn dư địa cho hint/mistakes gọi lặp và đề tự nhập N tới 24, và để test có HAI bộ giải khác nhau mà đối chiếu.
   · SINH: lấy một lời giải ngẫu nhiên → giữ TẤT CẢ hậu làm đề → bỏ dần từng hậu (thứ tự xáo bằng rng) nếu phần còn lại vẫn có đúng 1 cách hoàn thành
     (đếm tới 2), ghi lại CHUỖI mọi tập hậu cho sẵn đã đi qua (từ n hậu xuống tập "tối giản" — mỗi hậu đều cần thiết) cùng điểm khó của từng tập; rồi chọn một tập
     có điểm rơi đúng bậc (không có thì lấy tập gần bậc nhất, thử lại với lời giải khác). Nhờ vậy bậc đạt được không phụ thuộc "bỏ bao nhiêu hậu" phải đoán trước.
     Thử lại bằng rng.fork("try"+k), ngân sách đếm bằng LẦN THỬ/NÚT, không bằng giờ.
   · ĐỘ KHÓ: xem difficultyNote; "số nút quay lui đơn giản" = số lần đặt hậu của quay lui thường (hàng trên → dưới, cột trái → phải, kiểm an toàn với
     MỌI hậu đang có kể cả hậu cho sẵn) khi duyệt HẾT cây để chứng minh duy nhất, chặn ở PLAIN_CAP nút.
   · HINT từng bậc kỹ thuật: hàng chỉ còn một cột → cột chỉ còn một hàng → thử-và-loại bằng suy diễn → thử-và-loại bằng tìm kiếm. Có hậu SAI → báo gỡ nó trước.
   · mistakes: một hậu vừa đặt bị tính sai nếu (a) cùng các hậu cho sẵn nó đã không thể thuộc lời giải nào, hoặc (b) nó làm một bàn còn đường tới lời giải
     (cho sẵn + hậu hiện có) thành hết đường. Kiểm bằng tìm kiếm thật nên ĐÚNG CẢ với đề tự nhập nhiều lời giải (không so với `solution` duy nhất);
     bàn đã hỏng từ trước không bị tính lại ở các hậu sau (trừ khi chính hậu đó đã sai một mình). Tìm kiếm có trần nút; cạn trần ⇒ không buộc lỗi. */
(function (root) {
  "use strict";
  var P = root.Puz, R = P.rng, U = P.util;
  var ID = "nqueens", MIN_N = 4, MAX_N = 24;
  var PLAIN_CAP = 1000000;          // trần số nút của "quay lui đơn giản" dùng chấm độ khó
  var SEARCH_CAP = 600000;          // trần nút khi đếm nghiệm đề tự nhập (≤ ~0,5 s)
  var ALIVE_CAP = 150000;           // trần nút cho một phép "còn đường tới lời giải không?" (hint, mistakes)
  var MAX_TRIES = 16;
  // trọng số điểm khó (xem difficultyNote)
  var W_FREE = 0.30, W_NODE = 0.58, W_SIZE = 0.12, NODE_REF = 3162;

  // ---------------------------------------------------------------- bit
  function pc(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); x = (x + (x >>> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >>> 24; }
  function bitsList(m) { var o = []; while (m) { var b = m & -m; o.push(31 - Math.clz32(b)); m ^= b; } return o; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function absd(a, b) { return a > b ? a - b : b - a; }

  var ATK_MEMO = {};
  /** Bảng nhớ: bit cột bị một hậu ở cột c chặn trên hàng cách d hàng = cột c, c+d, c-d (đã cắt vào 0..n-1). Chỉ phụ thuộc n → nhớ đệm trong suốt. */
  function atk(n) {
    var t = ATK_MEMO[n]; if (t) return t;
    t = new Int32Array(n * n);
    for (var c = 0; c < n; c++) for (var d = 0; d < n; d++) { var m = 1 << c; if (c + d < n) m |= 1 << (c + d); if (c - d >= 0) m |= 1 << (c - d); t[c * n + d] = m; }
    ATK_MEMO[n] = t; return t;
  }
  function rcLabel(r, c) { return "hàng " + (r + 1) + ", cột " + (c + 1); }

  // ---------------------------------------------------------------- bộ giải bitmask (MRV + kiểm tiến)
  /** given: mảng n (cột của hậu cho sẵn ở hàng đó, -1 = trống). opt: {limit, keep, maxNodes, rng}. → {count, solutions:[cols[]], nodes, truncated, contradiction} */
  function search(n, given, opt) {
    opt = opt || {};
    var limit = opt.limit || 1, keep = opt.keep == null ? limit : opt.keep, maxNodes = opt.maxNodes || 2000000, rng = opt.rng || null;
    var res = { count: 0, solutions: [], nodes: 0, truncated: false, contradiction: false };
    var T = atk(n), full = (1 << n) - 1, avs = [], d, r, c, r2;
    for (d = 0; d <= n; d++) avs.push(new Int32Array(n));
    var pcol = new Int32Array(n), av0 = avs[0], placed0 = 0, used0 = 0, depth0 = 0;
    for (r = 0; r < n; r++) av0[r] = full;
    for (r = 0; r < n; r++) if (given[r] >= 0) {
      c = given[r];
      if (!(av0[r] & (1 << c))) { res.contradiction = true; return res; }
      pcol[r] = c; placed0 |= 1 << r; used0 |= 1 << c; depth0++;
      for (r2 = 0; r2 < n; r2++) {
        if ((placed0 >> r2) & 1) continue;
        av0[r2] &= ~T[c * n + absd(r2, r)];
        if (!av0[r2]) { res.contradiction = true; return res; }
      }
    }
    function dfs(depth, av, placed, used) {
      var best = -1, bestN = 99, k, rr, ci, m;
      if (depth === n) { res.count++; if (res.solutions.length < keep) res.solutions.push(Array.prototype.slice.call(pcol)); return res.count >= limit; }
      for (rr = 0; rr < n; rr++) if (!((placed >> rr) & 1)) { k = pc(av[rr]); if (k < bestN) { bestN = k; best = rr; if (k <= 1) break; } }
      var cols = bitsList(av[best]);
      if (rng) rng.shuffle(cols);
      var nxt = avs[depth + 1];
      for (ci = 0; ci < cols.length; ci++) {
        if (res.nodes >= maxNodes) { res.truncated = true; return true; }
        res.nodes++;
        var cc = cols[ci], ok = true, union = 0;
        for (rr = 0; rr < n; rr++) {
          if (((placed >> rr) & 1) || rr === best) { nxt[rr] = 0; continue; }
          m = av[rr] & ~T[cc * n + absd(rr, best)];
          if (!m) { ok = false; break; }
          nxt[rr] = m; union |= m;
        }
        if (!ok) continue;
        var used2 = used | (1 << cc);
        if (union !== (full & ~used2)) continue;                     // còn cột chưa có hậu mà không hàng nào đặt được
        pcol[best] = cc;
        if (dfs(depth + 1, nxt, placed | (1 << best), used2)) return true;
      }
      return false;
    }
    dfs(depth0, av0, placed0, used0);
    return res;
  }

  /** "Quay lui đơn giản" để chấm độ khó: hậu cho sẵn đặt trước; các hàng trống duyệt trên → dưới, cột trái → phải; đếm số lần đặt hậu tới khi duyệt hết (hoặc chạm trần). */
  function plainCount(n, given, cap) {
    var T = atk(n), full = (1 << n) - 1, forbid = new Int32Array(n), r, s;
    for (r = 0; r < n; r++) if (given[r] >= 0) {
      for (s = 0; s < n; s++) if (s !== r) forbid[s] |= T[given[r] * n + absd(r, s)];
    }
    for (r = 0; r < n; r++) if (given[r] >= 0 && (forbid[r] & (1 << given[r]))) return { nodes: 0, solutions: 0, conflict: true, capped: false };
    var nodes = 0, sols = 0, capped = false;
    function rec(row, cols, ld, rd) {
      if (capped) return;
      if (row === n) { sols++; return; }
      if (given[row] >= 0) { rec(row + 1, cols, (ld << 1) & full, rd >> 1); return; }
      var av = full & ~(cols | ld | rd | forbid[row]);
      while (av) {
        var b = av & -av; av ^= b; nodes++;
        if (nodes >= cap) { capped = true; return; }
        rec(row + 1, cols | b, ((ld | b) << 1) & full, (rd | b) >> 1);
        if (capped) return;
      }
    }
    rec(0, 0, 0, 0);
    return { nodes: nodes, solutions: sols, conflict: false, capped: capped };
  }

  // ---------------------------------------------------------------- trạng thái lan truyền (cho hint)
  function newProp(n) {
    var S = { n: n, av: new Int32Array(n), placed: 0, used: 0, pcol: new Int32Array(n), fail: null }, full = (1 << n) - 1;
    for (var r = 0; r < n; r++) { S.av[r] = full; S.pcol[r] = -1; }
    return S;
  }
  function cloneProp(S) { return { n: S.n, av: Int32Array.from(S.av), placed: S.placed, used: S.used, pcol: Int32Array.from(S.pcol), fail: null }; }
  /** Đặt hậu (r,c) vào trạng thái lan truyền. false nếu có hàng khác hết ô (S.fail ghi hàng đó). */
  function put(S, r, c) {
    var n = S.n, T = atk(n), r2;
    S.pcol[r] = c; S.placed |= 1 << r; S.used |= 1 << c;
    for (r2 = 0; r2 < n; r2++) {
      if ((S.placed >> r2) & 1) continue;
      S.av[r2] &= ~T[c * n + absd(r2, r)];
      if (!S.av[r2]) { S.fail = { kind: "row", index: r2 }; return false; }
    }
    return true;
  }
  /** Dựng trạng thái từ danh sách ô có hậu; null nếu hai hậu ăn nhau / cùng hàng, hoặc có hàng hết ô. */
  function propFrom(n, cells) {
    var S = newProp(n);
    for (var k = 0; k < cells.length; k++) {
      var r = (cells[k] / n) | 0, c = cells[k] % n;
      if ((S.placed >> r) & 1) return null;
      if (!(S.av[r] & (1 << c))) return null;
      if (!put(S, r, c)) return null;
    }
    return S;
  }
  /** Lan truyền tới điểm cố định bằng hai luật: hàng chỉ còn 1 cột; cột chỉ còn 1 hàng. false nếu mâu thuẫn (S.fail nói vì sao). */
  function closure(S) {
    var n = S.n, changed = true, r, c, cnt, last, m;
    while (changed) {
      changed = false;
      for (r = 0; r < n; r++) {
        if ((S.placed >> r) & 1) continue;
        m = S.av[r];
        if (!m) { S.fail = { kind: "row", index: r }; return false; }
        if ((m & (m - 1)) === 0) { if (!put(S, r, 31 - Math.clz32(m))) return false; changed = true; }
      }
      for (c = 0; c < n; c++) {
        if ((S.used >> c) & 1) continue;
        cnt = 0; last = -1;
        for (r = 0; r < n; r++) if (!((S.placed >> r) & 1) && ((S.av[r] >> c) & 1)) { cnt++; last = r; }
        if (cnt === 0) { S.fail = { kind: "col", index: c }; return false; }
        if (cnt === 1) { if (!put(S, last, c)) return false; changed = true; }
      }
    }
    return true;
  }
  function failText(f) {
    if (!f) return "dẫn tới mâu thuẫn";
    return f.kind === "row" ? "hàng " + (f.index + 1) + " hết ô an toàn" : "cột " + (f.index + 1) + " không còn hàng nào đặt được hậu";
  }

  // ---------------------------------------------------------------- phân tích đề / trạng thái
  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }

  /** Đọc đề: {ok, errors, n, given[], isGiven[], givenCells[], givenCount}. Không ném lỗi. */
  function analyze(puzzle) {
    var out = { ok: false, errors: [], n: 0, given: [], isGiven: [], givenCells: [], givenCount: 0 };
    if (!puzzle || typeof puzzle !== "object") { out.errors.push("Đề không phải một đối tượng."); return out; }
    var n = toInt(puzzle.data && puzzle.data.n != null ? puzzle.data.n : (puzzle.size && puzzle.size.n));
    if (n == null || n < MIN_N || n > MAX_N) { out.errors.push("Kích thước N phải là số nguyên từ " + MIN_N + " đến " + MAX_N + "."); return out; }
    var v = puzzle.initial && puzzle.initial.v;
    if (!Array.isArray(v) || v.length !== n * n) { out.errors.push("Trạng thái đầu phải có đúng " + (n * n) + " ô (bàn " + n + "×" + n + ")."); return out; }
    var i, r, c;
    out.n = n;
    for (r = 0; r < n; r++) out.given.push(-1);
    for (i = 0; i < n * n; i++) {
      if (v[i] !== 0 && v[i] !== 1) { out.errors.push("Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận 0 hoặc 1)."); return out; }
      out.isGiven.push(v[i] === 1);
      if (v[i] === 1) {
        r = (i / n) | 0; c = i % n;
        if (out.given[r] >= 0) out.errors.push("Hàng " + (r + 1) + " có hơn một hậu cho sẵn.");
        out.given[r] = c; out.givenCells.push(i);
      }
    }
    out.givenCount = out.givenCells.length;
    out.ok = out.errors.length === 0;
    return out;
  }
  function stateV(a, state) { return state && Array.isArray(state.v) && state.v.length === a.n * a.n ? state.v : null; }
  function queensIn(v) { var q = []; for (var i = 0; i < v.length; i++) if (v[i] === 1) q.push(i); return q; }

  /** Các hậu đang ăn nhau (cùng hàng/cột/đường chéo với hậu khác): {cells:[chỉ số], pairs:[[i,j]…]} */
  function conflictsOf(n, queens) {
    var cells = [], pairs = [], seen = {}, i, j, a, b;
    for (i = 0; i < queens.length; i++) for (j = i + 1; j < queens.length; j++) {
      a = queens[i]; b = queens[j];
      var ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n;
      if (ra === rb || ca === cb || absd(ra, rb) === absd(ca, cb)) { pairs.push([a, b]); seen[a] = 1; seen[b] = 1; }
    }
    for (i = 0; i < queens.length; i++) if (seen[queens[i]]) cells.push(queens[i]);
    return { cells: cells, pairs: pairs };
  }

  /** Có một lời giải đầy đủ chứa mọi hậu trong `cells` không? Cạn trần nút ⇒ true (không buộc tội khi chưa chứng minh được). */
  function aliveCells(n, cells, maxNodes) {
    var given = [], r, k;
    for (r = 0; r < n; r++) given.push(-1);
    for (k = 0; k < cells.length; k++) { r = (cells[k] / n) | 0; var c = cells[k] % n; if (given[r] >= 0 && given[r] !== c) return false; given[r] = c; }
    var res = search(n, given, { limit: 1, keep: 0, maxNodes: maxNodes || ALIVE_CAP });
    return res.count > 0 || res.truncated;
  }

  function colsToV(n, cols) { var v = new Array(n * n), i; for (i = 0; i < n * n; i++) v[i] = 0; for (var r = 0; r < n; r++) v[r * n + cols[r]] = 1; return v; }
  function vToGiven(n, v) { var g = [], r; for (r = 0; r < n; r++) g.push(-1); for (var i = 0; i < n * n; i++) if (v[i] === 1) g[(i / n) | 0] = i % n; return g; }

  // ---------------------------------------------------------------- độ khó
  function scoreOf(n, givens, nodes) {
    var freeTerm = (n - givens) / n, nodeTerm = clamp01(Math.log(1 + nodes) / Math.log(1 + NODE_REF)), sizeTerm = clamp01((n - 4) / 12);
    return U.clampScore(10 * (W_FREE * freeTerm + W_NODE * nodeTerm + W_SIZE * sizeTerm));
  }
  function difficulty(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return 0;
    return scoreOf(a.n, a.givenCount, plainCount(a.n, a.given, PLAIN_CAP).nodes);
  }

  // ---------------------------------------------------------------- dựng puzzle
  function sizeIdOf(n) { for (var i = 0; i < SIZES.length; i++) if (SIZES[i].params.n === n) return SIZES[i].id; return "custom"; }
  function buildPuzzle(n, v, o) {
    var p = { v: 1, type: ID, id: "", seed: o.seed == null ? null : o.seed, sizeId: o.sizeId || sizeIdOf(n), size: { n: n }, tier: o.tier || "custom", score: o.score || 0,
      data: { n: n }, initial: { v: v.slice() }, solution: o.solutionCols ? { v: colsToV(n, o.solutionCols) } : null, meta: o.meta || {} };
    p.id = U.puzzleId(p);
    return p;
  }
  function cleanMeta(m) {
    var o = {};
    if (m && typeof m === "object") ["name", "source", "note"].forEach(function (k) { if (typeof m[k] === "string" && m[k]) o[k] = m[k].slice(0, 200); });
    return o;
  }

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
  function randomSolution(n, rng) {
    var g = [], r; for (r = 0; r < n; r++) g.push(-1);
    var res = search(n, g, { limit: 1, keep: 1, maxNodes: 200000, rng: rng });
    return res.solutions[0] || null;
  }
  /** Bỏ dần hậu (thứ tự xáo bằng rng) khi phần còn lại vẫn có đúng một cách hoàn thành; trả CHUỖI các tập hậu cho sẵn đã đi qua
      (từ n hậu xuống tới tập tối giản), mỗi phần tử {given, g, score}. Chỉ giữ các tập còn ≥ minFree hậu để người chơi đặt. */
  function removalChain(n, solution, rng, minFree) {
    var given = solution.slice(), order = [], r, cnt = n, chain = [];
    for (r = 0; r < n; r++) order.push(r);
    rng.shuffle(order);
    function push() { if (n - cnt >= minFree) chain.push({ given: given.slice(), g: cnt, score: scoreOf(n, cnt, plainCount(n, given, PLAIN_CAP).nodes) }); }
    push();
    for (var k = 0; k < order.length; k++) {
      r = order[k];
      var keepC = given[r]; given[r] = -1;
      var res = search(n, given, { limit: 2, keep: 0, maxNodes: 300000 });
      if (res.count === 1 && !res.truncated) { cnt--; push(); } else given[r] = keepC;
    }
    return chain;
  }

  function generate(seed, opt) {
    opt = opt || {};
    var size = pickSize(opt.sizeId), n = size.params.n, tier = nearestTier(size, U.tier(opt.tier) ? opt.tier : "medium"), T = U.tier(tier);
    var rng = R.create(seed), best = null, k, minFree = 3;
    for (k = 0; k < MAX_TRIES; k++) {
      var rk = rng.fork("try" + k), sol = randomSolution(n, rk.fork("sol"));
      if (!sol) continue;
      var chain = removalChain(n, sol, rk.fork("min"), minFree), inBand = [], bi = -1, i;
      for (i = 0; i < chain.length; i++) {
        if (U.tierOfScore(chain[i].score).id === tier) inBand.push(i);
        if (bi < 0 || Math.abs(chain[i].score - T.target) < Math.abs(chain[bi].score - T.target)) bi = i;
      }
      var pickI = inBand.length ? inBand[rk.fork("pick").int(inBand.length)] : bi;
      if (pickI < 0) continue;
      var cand = { given: chain[pickI].given, sol: sol, score: chain[pickI].score };
      if (inBand.length) { best = cand; break; }
      if (!best || Math.abs(cand.score - T.target) < Math.abs(best.score - T.target)) best = cand;
    }
    var v = new Array(n * n), i2; for (i2 = 0; i2 < n * n; i2++) v[i2] = 0;
    for (var rr = 0; rr < n; rr++) if (best.given[rr] >= 0) v[rr * n + best.given[rr]] = 1;
    return buildPuzzle(n, v, { seed: rng.seed, sizeId: size.id, tier: U.tierOfScore(best.score).id, score: best.score, solutionCols: best.sol });
  }

  // ---------------------------------------------------------------- giải / kiểm đề
  function solveCore(a, opts) {
    var limit = opts && opts.limit > 0 ? opts.limit : 2, maxNodes = opts && opts.maxNodes > 0 ? opts.maxNodes : SEARCH_CAP;
    var keep = opts && opts.keep != null ? opts.keep : 1;
    var res = search(a.n, a.given, { limit: limit, keep: Math.max(keep, 1), maxNodes: maxNodes });
    return res;
  }
  function statusOf(res) { return res.count === 0 && !res.truncated ? "none" : (res.count === 1 && !res.truncated ? "unique" : (res.count === 0 ? "none" : "multiple")); }

  function solve(puzzle, opts) {
    opts = opts || {};
    var a = analyze(puzzle);
    if (!a.ok) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, errors: a.errors };
    var limit = opts.limit > 0 ? opts.limit : 2;
    var res = solveCore(a, opts), status = statusOf(res);
    var out = { status: status, count: res.count, solution: res.solutions.length ? { v: colsToV(a.n, res.solutions[0]) } : null, steps: [], techniques: {}, nodes: res.nodes };
    if (opts.keep > 1) out.solutions = res.solutions.map(function (s) { return { v: colsToV(a.n, s) }; });
    if (res.truncated) { out.truncated = true; out.warning = "Chưa xác định hết số lời giải (đã dừng sau " + res.nodes + " nút)."; }
    var wantSteps = opts.steps !== undefined ? !!opts.steps : limit <= 2;
    if (wantSteps && res.count > 0) {
      replay(puzzle).forEach(function (s) { out.steps.push({ technique: s.technique, text: s.text }); out.techniques[s.technique] = (out.techniques[s.technique] || 0) + 1; });
    }
    return out;
  }
  function validate(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { ok: false, errors: a.errors, status: "none", count: 0 };
    var errors = [], res = solveCore(a, { limit: 2 }), status = statusOf(res), n = a.n;
    var cf = conflictsOf(n, a.givenCells);
    if (cf.pairs.length) errors.push("Các hậu cho sẵn ăn nhau: " + rcLabel((cf.pairs[0][0] / n) | 0, cf.pairs[0][0] % n) + " và " + rcLabel((cf.pairs[0][1] / n) | 0, cf.pairs[0][1] % n) + ".");
    else if (res.count === 0 && !res.truncated) errors.push("Đề vô nghiệm: với các hậu cho sẵn không thể đặt đủ " + n + " hậu không ăn nhau.");
    var out = { ok: res.count > 0, errors: errors, status: status, count: res.count };
    if (res.truncated) out.warning = "Chưa xác định hết số lời giải.";
    if (res.count > 0) out.solution = { v: colsToV(n, res.solutions[0]) };
    return out;
  }

  function badInput(msg, extra) { var errs = Array.isArray(msg) ? msg : [msg]; return { ok: false, puzzle: null, errors: errs, warnings: [], status: "none", count: 0 }; }

  function fromInput(input) {
    try {
      if (!input || typeof input !== "object") return badInput("Dữ liệu nhập không hợp lệ: cần một đối tượng {n, v}.");
      var n = toInt(input.n != null ? input.n : (input.size && typeof input.size === "object" ? input.size.n : input.size));
      if (n == null || n < MIN_N || n > MAX_N) return badInput("Kích thước N phải là số nguyên từ " + MIN_N + " đến " + MAX_N + ".");
      var v = [], i, errors = [], warnings = [];
      for (i = 0; i < n * n; i++) v.push(0);
      var src = input.v;
      if (typeof src === "string") { if (!/^[01]*$/.test(src)) return badInput("Chuỗi bàn chỉ được gồm ký tự 0 và 1."); src = src.split("").map(Number); }
      if (src != null) {
        if (!Array.isArray(src) || src.length !== n * n) return badInput("Bàn " + n + "×" + n + " cần đúng " + (n * n) + " ô, nhận được " + (Array.isArray(src) ? src.length : "không phải mảng") + ".");
        for (i = 0; i < src.length; i++) { if (src[i] !== 0 && src[i] !== 1) return badInput("Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận 0 hoặc 1)."); v[i] = src[i]; }
      } else if (input.queens != null) {
        if (!Array.isArray(input.queens)) return badInput("Danh sách hậu cho sẵn (queens) phải là một mảng chỉ số ô.");
        for (i = 0; i < input.queens.length; i++) { var q = toInt(input.queens[i]); if (q == null || q < 0 || q >= n * n) return badInput("Chỉ số ô hậu thứ " + (i + 1) + " nằm ngoài bàn."); v[q] = 1; }
      }
      var cells = queensIn(v), a = { n: n, given: vToGiven(n, v), givenCells: cells, givenCount: cells.length };
      var rowDup = {}; for (i = 0; i < cells.length; i++) { var rr = (cells[i] / n) | 0; if (rowDup[rr]) errors.push("Hàng " + (rr + 1) + " có hơn một hậu cho sẵn."); rowDup[rr] = 1; }
      var cf = conflictsOf(n, cells);
      if (!errors.length && cf.pairs.length) errors.push("Các hậu cho sẵn ăn nhau: " + rcLabel((cf.pairs[0][0] / n) | 0, cf.pairs[0][0] % n) + " và " + rcLabel((cf.pairs[0][1] / n) | 0, cf.pairs[0][1] % n) + ".");
      var res = errors.length ? { count: 0, solutions: [], nodes: 0, truncated: false } : solveCore(a, { limit: 2 });
      var status = errors.length ? "none" : statusOf(res);
      if (!errors.length && res.count === 0 && !res.truncated) errors.push("Đề vô nghiệm: với các hậu cho sẵn không thể đặt đủ " + n + " hậu không ăn nhau.");
      if (res.count >= 2) warnings.push("Đề có nhiều hơn một lời giải (đã tìm thấy ít nhất 2). Vẫn chơi được: mọi bàn đủ " + n + " hậu không ăn nhau, đúng các hậu cho sẵn, đều được tính là giải xong.");
      if (res.truncated) warnings.push("Chưa xác định hết số lời giải (đã dừng sau " + res.nodes + " nút) — coi như có thể nhiều lời giải.");
      var sol = res.solutions.length ? res.solutions[0] : null;
      var puzzle = buildPuzzle(n, v, { seed: null, sizeId: sizeIdOf(n), tier: "custom", score: 0, solutionCols: sol, meta: cleanMeta(input.meta) });
      puzzle.score = difficulty(puzzle);
      return { ok: errors.length === 0, puzzle: puzzle, errors: errors, warnings: warnings, status: status, count: res.count };
    } catch (e) {
      return badInput("Không đọc được dữ liệu nhập: " + (e && e.message ? e.message : e));
    }
  }

  // ---------------------------------------------------------------- ván chơi: state / nước đi / kiểm
  function newState(puzzle) { return { v: puzzle.initial.v.slice(), c: null }; }
  function isGiven(puzzle, i) { return !!(puzzle && puzzle.initial && puzzle.initial.v && puzzle.initial.v[i] === 1); }

  function moveFor(puzzle, state, action, settings) {
    var a = analyze(puzzle); if (!a.ok || !action || !stateV(a, state)) return null;
    var v = state.v, n = a.n, i, d = [];
    switch (action.k) {
      case "set": case "cycle":
        i = toInt(action.i);
        if (i == null || i < 0 || i >= n * n || a.isGiven[i]) return null;
        var cur = v[i] === 1 || v[i] === 2 ? v[i] : 0, val;
        if (action.k === "set") { val = toInt(action.val); if (val !== 0 && val !== 1 && val !== 2) return null; }
        else val = (cur + 1) % 3;
        if (val === cur) return null;
        return { d: [["v", i, v[i], val]], label: val === 1 ? "Đặt hậu (" + rcLabel((i / n) | 0, i % n) + ")" : val === 2 ? "Đánh dấu loại (" + rcLabel((i / n) | 0, i % n) + ")" : "Xoá ô (" + rcLabel((i / n) | 0, i % n) + ")" };
      case "clear":
        for (i = 0; i < n * n; i++) if (!a.isGiven[i] && v[i] !== 0) d.push(["v", i, v[i], 0]);
        return d.length ? { d: d, label: "Xoá bàn (giữ hậu cho sẵn)" } : null;
      case "clearmarks":
        for (i = 0; i < n * n; i++) if (v[i] === 2) d.push(["v", i, 2, 0]);
        return d.length ? { d: d, label: "Xoá các chấm loại" } : null;
      default: return null;
    }
  }

  function check(puzzle, state) {
    var a = analyze(puzzle), v = a.ok ? stateV(a, state) : null;
    if (!v) return { solved: false, conflicts: [], filled: 0, total: a.n || 0 };
    var q = queensIn(v), cf = conflictsOf(a.n, q);
    return { solved: q.length === a.n && cf.cells.length === 0, conflicts: cf.cells, filled: q.length, total: a.n };
  }

  /** Số nước sai MỚI trong diff (gọi trước khi áp diff). Xem chú thích đầu tệp: kiểm bằng tìm kiếm, đúng cả với đề nhiều lời giải. */
  function mistakes(puzzle, state, diff) {
    var a = analyze(puzzle), v = a.ok ? stateV(a, state) : null;
    if (!v || !diff || !diff.d) return 0;
    var n = a.n, newQ = [], removed = {}, k, e;
    for (k = 0; k < diff.d.length; k++) { e = diff.d[k]; if (e[0] !== "v") continue; if (e[3] === 1 && e[2] !== 1) newQ.push(e[1]); if (e[2] === 1 && e[3] !== 1) removed[e[1]] = 1; }
    if (!newQ.length) return 0;
    var E = []; for (k = 0; k < v.length; k++) if (v[k] === 1 && !a.isGiven[k] && !removed[k]) E.push(k);
    var sol = puzzle.solution && puzzle.solution.v, inSol = function (i) { return !!(sol && sol[i] === 1); };
    var base = a.givenCells.concat(E), baseInSol = base.every(inSol), baseAlive = null, bad = 0;
    for (k = 0; k < newQ.length; k++) {
      var q = newQ[k];
      if (baseInSol && inSol(q)) continue;                                        // đường tắt: tất cả nằm trong lời giải đã biết
      var aloneAlive = inSol(q) && a.givenCells.every(inSol) ? true : aliveCells(n, a.givenCells.concat([q]), ALIVE_CAP);
      if (!aloneAlive) { bad++; continue; }
      if (baseAlive === null) baseAlive = baseInSol ? true : aliveCells(n, base, ALIVE_CAP);
      if (baseAlive && !aliveCells(n, base.concat([q]), ALIVE_CAP)) bad++;
    }
    return bad;
  }

  function describeCell(puzzle, state, i) {
    var a = analyze(puzzle), v = a.ok ? stateV(a, state) : null;
    if (!v || toInt(i) == null || i < 0 || i >= a.n * a.n) return "Ô không hợp lệ";
    var n = a.n, r = (i / n) | 0, c = i % n, s = "Hàng " + (r + 1) + ", cột " + (c + 1) + ", ", q = queensIn(v), cf = conflictsOf(n, q), k, cnt = 0;
    if (v[i] === 1) {
      s += a.isGiven[i] ? "hậu cho sẵn" : "có hậu";
      if (cf.cells.indexOf(i) >= 0) s += ", đang ăn hậu khác";
    } else if (v[i] === 2) s += "đã đánh dấu loại";
    else {
      for (k = 0; k < q.length; k++) { var qr = (q[k] / n) | 0, qc = q[k] % n; if (qr === r || qc === c || absd(qr, r) === absd(qc, c)) cnt++; }
      s += "ô trống" + (cnt ? ", đang bị " + cnt + " hậu chặn" : ", chưa bị hậu nào chặn");
    }
    return s;
  }

  // ---------------------------------------------------------------- gợi ý
  /** Mỗi ô bị chặn → hậu đầu tiên (theo hàng) chặn nó; trả [{qr,qc, cols:[…], kinds}] gom theo hậu. */
  function blockerOf(queens, n, r, c) {
    for (var k = 0; k < queens.length; k++) {
      var qr = (queens[k] / n) | 0, qc = queens[k] % n;
      if (qc === c) return { k: k, qr: qr, qc: qc, kind: "cùng cột" };
      if (qr !== r && absd(qr, r) === absd(qc, c)) return { k: k, qr: qr, qc: qc, kind: "đường chéo" };
    }
    return null;
  }
  function listVi(arr) { return arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " và " + arr[arr.length - 1]; }
  /** Lời giải thích "hàng r chỉ còn cột t": mỗi hậu chặn những cột nào của hàng r. */
  function whyRow(queens, n, r, t) {
    var groups = {}, order = [], c, b;
    for (c = 0; c < n; c++) {
      if (c === t) continue;
      b = blockerOf(queens, n, r, c); if (!b) continue;
      if (!groups[b.k]) { groups[b.k] = { qr: b.qr, qc: b.qc, same: [], diag: [] }; order.push(b.k); }
      (b.kind === "cùng cột" ? groups[b.k].same : groups[b.k].diag).push(c + 1);
    }
    var lines = order.map(function (k) {
      var g = groups[k], parts = [];
      if (g.same.length) parts.push("cột " + listVi(g.same) + " (cùng cột)");
      if (g.diag.length) parts.push((g.diag.length > 1 ? "các cột " : "cột ") + listVi(g.diag) + " (đường chéo)");
      return "Hậu ở " + rcLabel(g.qr, g.qc) + " chặn " + parts.join("; ") + " của hàng " + (r + 1) + ".";
    });
    lines.push("→ Hàng " + (r + 1) + " chỉ còn cột " + (t + 1) + " an toàn.");
    return lines;
  }
  /** "cột t chỉ còn hàng r": mỗi hậu chặn ô cột t của những hàng trống nào. */
  function whyCol(queens, n, S, r, t) {
    var groups = {}, order = [], rr, b;
    for (rr = 0; rr < n; rr++) {
      if (rr === r || ((S.placed >> rr) & 1)) continue;
      b = blockerOf(queens, n, rr, t); if (!b) continue;
      if (!groups[b.k]) { groups[b.k] = { qr: b.qr, qc: b.qc, rows: [] }; order.push(b.k); }
      groups[b.k].rows.push(rr + 1);
    }
    var lines = order.map(function (k) { var g = groups[k]; return "Hậu ở " + rcLabel(g.qr, g.qc) + " chặn ô cột " + (t + 1) + " của hàng " + listVi(g.rows) + " (đường chéo)."; });
    lines.push("→ Mỗi cột phải có đúng một hậu, mà trong cột " + (t + 1) + " chỉ hàng " + (r + 1) + " còn đặt được.");
    return lines;
  }

  /** Kế hoạch gợi ý cho một trạng thái: {type:"done"|"unsolvable"|"fix"|"place", …}. Tất định theo (đề, trạng thái). */
  function planOf(puzzle, state) {
    var a = analyze(puzzle), v = a.ok ? stateV(a, state) : null;
    if (!v) return { type: "unsolvable" };
    var n = a.n, queens = queensIn(v), i, k;
    if (!aliveCells(n, a.givenCells, 400000)) return { type: "unsolvable" };
    if (!aliveCells(n, queens, ALIVE_CAP)) {
      var cf = conflictsOf(n, queens), inCf = {}; cf.cells.forEach(function (c) { inCf[c] = 1; });
      var player = queens.filter(function (q) { return !a.isGiven[q]; });
      player.sort(function (x, y) { var dx = inCf[x] ? 0 : 1, dy = inCf[y] ? 0 : 1; return dx - dy || x - y; });
      if (!player.length) return { type: "unsolvable" };
      var culprit = -1, reason = "";
      for (k = 0; k < player.length && culprit < 0; k++) if (!aliveCells(n, a.givenCells.concat([player[k]]), ALIVE_CAP)) { culprit = player[k]; reason = "dead"; }
      for (k = 0; k < player.length && culprit < 0; k++) if (aliveCells(n, queens.filter(function (q) { return q !== player[k]; }), ALIVE_CAP)) { culprit = player[k]; reason = "incompatible"; }
      if (culprit < 0) { culprit = player[0]; reason = "incompatible"; }
      var cr = (culprit / n) | 0, cc = culprit % n, why = [];
      if (reason === "dead") why.push("Hậu ở " + rcLabel(cr, cc) + " không thuộc lời giải nào: cùng với các hậu cho sẵn, không thể đặt đủ " + n + " hậu không ăn nhau.");
      else why.push("Hậu ở " + rcLabel(cr, cc) + " không đi cùng được với các hậu khác đang đặt; gỡ nó đi thì bàn còn đường tới lời giải.");
      cf.pairs.forEach(function (p) { if (p[0] === culprit || p[1] === culprit) { var o = p[0] === culprit ? p[1] : p[0]; if (why.length < 3) why.push("Nó đang ăn hậu ở " + rcLabel((o / n) | 0, o % n) + "."); } });
      return { type: "fix", cell: culprit, row: cr, col: cc, why: why, technique: "Gỡ hậu sai" };
    }
    if (queens.length >= n) return { type: "done" };
    var S = propFrom(n, queens), r, c, m;
    if (!S) return { type: "unsolvable" };
    function placeOf(r0, c0, technique, key, level2, why, safe) {
      return { type: "place", cell: r0 * n + c0, row: r0, col: c0, technique: technique, key: key, level2: level2, why: why, safe: safe };
    }
    function safeCells(r0) { return bitsList(S.av[r0]).map(function (cc2) { return r0 * n + cc2; }); }
    // 1. hàng chỉ còn một cột
    for (r = 0; r < n; r++) if (!((S.placed >> r) & 1) && pc(S.av[r]) === 1) {
      c = bitsList(S.av[r])[0];
      return placeOf(r, c, "Hàng chỉ còn một cột", "row", "Hàng " + (r + 1) + " chỉ còn 1 cột an toàn.", whyRow(queens, n, r, c), safeCells(r));
    }
    // 2. cột chỉ còn một hàng
    for (c = 0; c < n; c++) {
      if ((S.used >> c) & 1) continue;
      var cnt = 0, last = -1;
      for (r = 0; r < n; r++) if (!((S.placed >> r) & 1) && ((S.av[r] >> c) & 1)) { cnt++; last = r; }
      if (cnt === 1) return placeOf(last, c, "Cột chỉ còn một hàng", "col", "Có một cột mà chỉ hàng " + (last + 1) + " còn đặt được hậu vào.", whyCol(queens, n, S, last, c), safeCells(last));
    }
    // 3. thử-và-loại: với mỗi hàng (ít ô an toàn trước), loại các ô dẫn tới mâu thuẫn bằng lan truyền; còn đúng một ô → chốt; nếu cần thì tìm kiếm
    var rows = [];
    for (r = 0; r < n; r++) if (!((S.placed >> r) & 1)) rows.push({ r: r, k: pc(S.av[r]) });
    rows.sort(function (x, y) { return x.k - y.k || x.r - y.r; });
    for (i = 0; i < rows.length && i < 8; i++) {
      r = rows[i].r;
      var cand = bitsList(S.av[r]), keepC = [], reasons = {}, usedSearch = false;
      for (k = 0; k < cand.length; k++) {
        var T = cloneProp(S);
        if (!put(T, r, cand[k])) { reasons[cand[k]] = failText(T.fail); continue; }
        if (!closure(T)) { reasons[cand[k]] = failText(T.fail); continue; }
        keepC.push(cand[k]);
      }
      var aliveC = keepC;
      if (keepC.length > 1) {
        aliveC = keepC.filter(function (cc2) { return aliveCells(n, queens.concat([r * n + cc2]), ALIVE_CAP); });
        keepC.forEach(function (cc2) { if (aliveC.indexOf(cc2) < 0) { reasons[cc2] = "thử mọi cách đặt tiếp đều bế tắc (tìm kiếm hết nhánh)"; usedSearch = true; } });
      }
      if (aliveC.length === 1) {
        var t = aliveC[0], lines = [];
        cand.forEach(function (cc2) { if (cc2 !== t) lines.push("Nếu đặt hậu ở " + rcLabel(r, cc2) + " thì " + reasons[cc2] + "."); });
        lines.push("→ Chỉ còn ô " + rcLabel(r, t) + " là không dẫn tới vô nghiệm.");
        return placeOf(r, t, usedSearch ? "Thử và loại sâu" : "Thử và loại", usedSearch ? "deep" : "try",
          "Hàng " + (r + 1) + " có " + cand.length + " cột chưa bị chặn, nhưng chỉ một trong số đó không dẫn tới vô nghiệm.", lines, cand.map(function (cc2) { return r * n + cc2; }));
      }
    }
    // 4. đề có nhiều lời giải: chọn ô theo một lời giải còn lại (vẫn là nước đi hợp lệ, không làm mất đường tới lời giải)
    var given = [], rr;
    for (rr = 0; rr < n; rr++) given.push(-1);
    queens.forEach(function (q) { given[(q / n) | 0] = q % n; });
    var res = search(n, given, { limit: 1, keep: 1, maxNodes: 400000 });
    var row0 = rows[0].r, col0 = res.solutions.length ? res.solutions[0][row0] : bitsList(S.av[row0])[0];
    return placeOf(row0, col0, "Chọn một nhánh", "branch",
      "Hàng " + (row0 + 1) + " còn nhiều cột đặt được; chọn một cột nằm trong một lời giải.",
      ["Đề này có nhiều hơn một lời giải nên không có ô nào bị ép.", "Ô " + rcLabel(row0, col0) + " nằm trong một lời giải còn lại, đặt nó không làm bàn mất đường tới lời giải."], safeCells(row0));
  }

  function rowCells(n, r) { var o = []; for (var c = 0; c < n; c++) o.push(r * n + c); return o; }

  function hint(puzzle, state, level) {
    level = Math.max(1, Math.min(3, level | 0 || 1));
    var a = analyze(puzzle);
    if (!a.ok) return { level: level, text: "Đề không hợp lệ nên chưa gợi ý được.", why: a.errors.slice(), cells: [], none: true };
    var n = a.n, plan = planOf(puzzle, state);
    if (plan.type === "done") return { level: level, text: "Bàn đã đủ " + n + " hậu và không hậu nào ăn nhau — không còn gì để gợi ý.", why: [], cells: [], none: true };
    if (plan.type === "unsolvable") return { level: level, text: "Với các hậu cho sẵn, đề này không có lời giải nên không gợi ý được.", why: [], cells: [], none: true };
    var r = plan.row, c = plan.col;
    if (plan.type === "fix") {
      if (level === 1) return { level: 1, text: "Có hậu đang đặt sai. Hãy xem lại hàng " + (r + 1) + ".", why: [], cells: rowCells(n, r), technique: plan.technique };
      if (level === 2) return { level: 2, text: "Hậu ở " + rcLabel(r, c) + " không thể thuộc lời giải nào.", why: [plan.why[0]], cells: [plan.cell], technique: plan.technique };
      return { level: 3, text: "Gỡ hậu ở " + rcLabel(r, c) + ".", why: plan.why.slice(), cells: [plan.cell], technique: plan.technique, action: { k: "set", i: plan.cell, val: 0 } };
    }
    if (level === 1) return { level: 1, text: "Hãy nhìn hàng " + (r + 1) + ".", why: [], cells: rowCells(n, r), technique: plan.technique };
    if (level === 2) return { level: 2, text: plan.level2, why: [], cells: plan.safe.slice(), technique: plan.technique };
    return { level: 3, text: "Đặt hậu ở " + rcLabel(r, c) + ".", why: plan.why.slice(), cells: [plan.cell], technique: plan.technique, action: { k: "set", i: plan.cell, val: 1 } };
  }

  function replay(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return [];
    var st = newState(puzzle), out = [], guard = 0, n = a.n;
    while (guard++ < n * 3 + 3) {
      if (check(puzzle, st).solved) break;
      var plan = planOf(puzzle, st);
      if (plan.type !== "place") break;
      var diff = moveFor(puzzle, st, { k: "set", i: plan.cell, val: 1 }, {});
      if (!diff) break;
      out.push({ text: "Đặt hậu ở " + rcLabel(plan.row, plan.col) + " (" + plan.technique.toLowerCase() + ").", why: plan.why.slice(), diff: diff, cells: [plan.cell], technique: plan.technique });
      P.game.applyDiff(st, diff.d, false);
    }
    return out;
  }

  // ---------------------------------------------------------------- constraint view, trace
  function cspFor(n, given) {
    var vars = [], cons = [], domains = {}, r, s;
    for (r = 0; r < n; r++) { vars.push({ name: "Hàng " + (r + 1), size: n }); if (given[r] >= 0) domains["Hàng " + (r + 1)] = 1 << given[r]; }
    for (r = 0; r < n; r++) for (s = r + 1; s < n; s++) (function (r, s) {
      var d = s - r;
      cons.push({ vars: [r, s], test: function (vals) { return vals[0] !== vals[1] && Math.abs(vals[0] - vals[1]) !== d; }, label: "Hậu hàng " + (r + 1) + " và hàng " + (s + 1) + ": khác cột, khác đường chéo" });
    })(r, s);
    return P.csp.problem({ vars: vars, cons: cons, domains: domains });
  }

  function constraintView(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { summary: "Đề không hợp lệ.", variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    var n = a.n, pairs = n * (n - 1) / 2, variables = [], constraints = [], r, s;
    for (r = 0; r < n; r++) variables.push({ name: "Hàng " + (r + 1), domain: a.given[r] >= 0 ? "{cột " + (a.given[r] + 1) + "} (cho sẵn)" : "{cột 1 … cột " + n + "}" });
    constraints.push("Mỗi hàng có đúng một hậu: " + n + " biến, biến của hàng r là CỘT của hậu hàng r.");
    if (pairs <= 40) {
      for (r = 0; r < n; r++) for (s = r + 1; s < n; s++) constraints.push("Hậu hàng " + (r + 1) + " và hàng " + (s + 1) + ": khác cột, khác đường chéo (|cột − cột| ≠ " + (s - r) + ").");
    } else {
      constraints.push("Mọi cặp hàng (r, s) với r < s — " + pairs + " cặp: cột r ≠ cột s và |cột r − cột s| ≠ s − r.");
      constraints.push("Ví dụ: hàng 1 và hàng 2 → khác cột và |cột 1 − cột 2| ≠ 1; hàng 1 và hàng 3 → |cột 1 − cột 3| ≠ 2; …");
    }
    for (r = 0; r < n; r++) if (a.given[r] >= 0) constraints.push("Hàng " + (r + 1) + " đã có hậu cho sẵn ở cột " + (a.given[r] + 1) + " (miền chỉ còn một giá trị).");
    return {
      summary: n + " biến (mỗi hàng một biến, miền " + n + " cột) và " + pairs + " ràng buộc cặp \"khác cột, khác đường chéo\"; " + a.givenCount + " biến đã được chốt bởi hậu cho sẵn, còn " + (n - a.givenCount) + " biến cần tìm.",
      variables: variables, constraints: constraints,
      counts: { variables: n, constraints: pairs + a.givenCount, pairConstraints: pairs, givens: a.givenCount, free: n - a.givenCount }
    };
  }

  function trace(puzzle, opts) {
    var a = analyze(puzzle);
    if (!a.ok) return { kind: "tree", nodes: [], truncated: false, note: "Đề không hợp lệ." };
    opts = opts || {};
    var n = a.n, shown = Math.min(600, opts.maxNodes > 0 ? opts.maxNodes : 600);
    // Cho tìm kiếm dừng đúng khi cây ghi đầy (shown − 1 lần thử, gồm cả nút gốc là shown): mọi nút đã ghi đều có trạng thái chính xác, trừ nhánh đang duyệt dở lúc cắt.
    // (csp ≈ 0,3 ms/nút ở N = 16, ≈ 1 ms/nút ở N = 24 → trace ≤ ~0,6 s.)
    var prob = cspFor(n, a.given), res = P.csp.solve(prob, { limit: 1e9, keep: 0, trace: true, traceMax: shown - 1, maxNodes: shown - 1 });
    var rec = res.trace || [], nodes = [{ id: 0, parent: -1, label: "Đề (" + a.givenCount + " hậu cho sẵn)", status: res.count > 0 ? "ok" : "fail", depth: 0 }];
    rec.forEach(function (t) {
      nodes.push({ id: t.id + 1, parent: t.parent < 0 ? 0 : t.parent + 1, label: "Hàng " + (t.v + 1) + " → cột " + (t.val + 1), status: /^(fail|dead|ok|solution)$/.test(t.status) ? t.status : "dead", depth: t.depth, row: t.v, col: t.val });
    });
    if (res.truncated && nodes.length > 1) {                                  // tìm kiếm bị cắt giữa chừng: nhánh đang duyệt dở chưa chứng minh được "ngõ cụt" → tô như nhánh còn sống
      for (var id = nodes.length - 1; id >= 0; id = nodes[id].parent) { if (nodes[id].status === "dead") nodes[id].status = "ok"; if (id === 0) break; }
    }
    var truncated = !!res.truncated;
    var note = "Quay lui từ đề với lan truyền ràng buộc, chọn hàng ít cột nhất trước (Puz.csp). Mỗi nút = một lần thử đặt hậu; đỏ = mâu thuẫn ngay, xám = ngõ cụt, xanh = dẫn tới lời giải.";
    if (truncated) note += " Cây dài nên chỉ hiện " + nodes.length + " nút đầu (tìm kiếm cũng dừng tại đó)" + "; nhánh đang duyệt dở lúc cắt được tô xanh.";
    return { kind: "tree", nodes: nodes, truncated: truncated, note: note, solutions: res.count };
  }

  // ---------------------------------------------------------------- nhập / xuất
  function toText(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return "";
    var rows = [], r, c;
    for (r = 0; r < a.n; r++) { var t = []; for (c = 0; c < a.n; c++) t.push(puzzle.initial.v[r * a.n + c] === 1 ? "Q" : "."); rows.push(t.join(" ")); }
    return rows.join("\n");
  }
  var QUEEN_CH = "Qq1♛♕", EMPTY_CH = ".0-_";
  function fromText(text) {
    try {
      if (typeof text !== "string") return badInput("Cần một chuỗi văn bản.");
      var lines = text.replace(/\r/g, "").split("\n").map(function (l) { return l.replace(/[\s|,;│]/g, ""); }).filter(function (l) { return l.length > 0; });
      if (!lines.length) return badInput("Văn bản rỗng.");
      var chars = [], li, k;
      for (li = 0; li < lines.length; li++) for (k = 0; k < lines[li].length; k++) {
        var ch = lines[li].charAt(k);
        if (QUEEN_CH.indexOf(ch) >= 0) chars.push(1); else if (EMPTY_CH.indexOf(ch) >= 0) chars.push(0);
        else return badInput("Ký tự lạ \"" + ch + "\" — dùng Q (hậu) và . (ô trống).");
      }
      var n;
      if (lines.length > 1) { n = lines.length; for (li = 0; li < lines.length; li++) if (lines[li].length !== n) return badInput("Bàn phải vuông: có " + n + " dòng nhưng dòng " + (li + 1) + " có " + lines[li].length + " ô."); }
      else { n = Math.round(Math.sqrt(chars.length)); if (n * n !== chars.length) return badInput("Số ô (" + chars.length + ") không phải số chính phương nên không thành bàn vuông."); }
      return fromInput({ n: n, v: chars });
    } catch (e) { return badInput("Không đọc được văn bản: " + (e && e.message ? e.message : e)); }
  }
  function vToStr(v) { return v.map(function (x) { return x === 1 ? "1" : "0"; }).join(""); }
  function toFile(puzzle) {
    var a = analyze(puzzle);
    if (!puzzle || typeof puzzle !== "object") return { type: ID, seed: null, difficulty: 0, size: { n: 0 }, initialState: "", solution: "", metadata: {} };
    return { type: ID, seed: puzzle.seed == null ? null : puzzle.seed, difficulty: puzzle.score, size: { n: a.n || (puzzle.size && puzzle.size.n) },
      initialState: a.ok ? vToStr(puzzle.initial.v) : "", solution: puzzle.solution ? vToStr(puzzle.solution.v) : "",
      metadata: { name: puzzle.meta && puzzle.meta.name, source: puzzle.meta && puzzle.meta.source, note: puzzle.meta && puzzle.meta.note, tier: puzzle.tier, n: a.n, givens: a.givenCount } };
  }
  function fromFile(obj) {
    try {
      if (!obj || typeof obj !== "object") return badInput("Tệp không phải một đối tượng JSON.");
      if (obj.type === undefined || obj.type === null) return badInput("Tệp thiếu trường type (cần \"nqueens\").");
      if (obj.type !== ID) return badInput("Tệp này không phải đề N-Queens (type = " + JSON.stringify(obj.type) + ").");
      var s = obj.initialState;
      if (typeof s !== "string" || !s.length) return badInput("Thiếu initialState (chuỗi 0/1 độ dài n×n).");
      if (!/^[01]+$/.test(s)) return badInput("initialState chỉ được gồm ký tự 0 và 1.");
      var n = toInt(obj.size && typeof obj.size === "object" ? obj.size.n : obj.size);
      if (n == null) n = Math.round(Math.sqrt(s.length));
      if (n * n !== s.length) return badInput("initialState có " + s.length + " ký tự, không khớp bàn " + n + "×" + n + ".");
      var out = fromInput({ n: n, v: s, meta: obj.metadata });
      if (out.puzzle && typeof obj.seed === "number" && isFinite(obj.seed)) { out.puzzle.seed = R.seedOf(obj.seed); }
      return { ok: out.ok, puzzle: out.puzzle, errors: out.errors, warnings: out.warnings };
    } catch (e) { return badInput("Không đọc được tệp: " + (e && e.message ? e.message : e)); }
  }

  // ---------------------------------------------------------------- đăng ký
  var SIZES = [
    { id: "6", label: "6×6", params: { n: 6 }, tiers: ["easy", "medium"] },
    { id: "8", label: "8×8", params: { n: 8 }, default: true, tiers: ["easy", "medium", "hard"] },
    { id: "10", label: "10×10", params: { n: 10 }, tiers: ["easy", "medium", "hard"] },
    { id: "12", label: "12×12", params: { n: 12 }, tiers: ["easy", "medium", "hard"] },
    { id: "16", label: "16×16", params: { n: 16 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];

  var def = {
    id: ID, name: "N-Queens", family: "Constraint Puzzle", category: "Ràng buộc", icon: "♛",
    blurb: "Đặt đủ N quân hậu lên bàn N×N sao cho không hai hậu nào ăn nhau — đề cho sẵn vài hậu, bạn đặt nốt.",
    rules: [
      "Bàn N×N cần đúng N quân hậu.",
      "Hai hậu bất kỳ không được cùng hàng, cùng cột hoặc cùng đường chéo.",
      "Một vài hậu đã được cho sẵn (có khoá) và không thể di chuyển; hãy đặt các hậu còn lại.",
      "Có thể bấm lặp một ô để đổi giữa trống → hậu → chấm loại; chấm loại chỉ là ghi chú, không tính vào luật.",
      "Đề do app sinh ra luôn có đúng một cách hoàn thành."
    ],
    sizes: SIZES,
    algorithm: {
      title: "Quay lui và lan truyền ràng buộc cho N-Queens",
      steps: [
        { title: "Mô hình hoá thành bài toán ràng buộc", text: "Mỗi hàng có đúng một hậu nên chỉ cần N biến: biến của hàng r là cột của hậu hàng r (miền 1…N). Hai hàng r < s hợp lệ khi cột khác nhau và |cột r − cột s| ≠ s − r (không cùng đường chéo). Hậu cho sẵn thu miền của hàng tương ứng về một giá trị." },
        { title: "Quay lui (backtracking)", text: "Đặt hậu lần lượt từng hàng, thử từng cột còn an toàn; hết cột thì lùi lại hàng trước và thử cột kế tiếp. Số lần đặt hậu chính là kích thước cây tìm kiếm — con số app dùng để chấm độ khó." },
        { title: "Lan truyền ràng buộc và chọn hàng ít cột nhất", text: "Sau mỗi hậu, gạt cột và hai đường chéo của nó khỏi miền mọi hàng còn lại. Hàng chỉ còn một cột thì chốt luôn; cột chỉ còn một hàng thì chốt luôn; có hàng hết cột hoặc cột hết hàng thì lùi ngay. Luôn xử lý hàng ít lựa chọn nhất trước (MRV) để cây nhỏ lại hàng nghìn lần." },
        { title: "Bitmask cho tốc độ", text: "Miền cột của mỗi hàng là một số nguyên, mỗi bit là một cột; gạt cột và hai chéo chỉ là một phép AND với mặt nạ dựng sẵn nên mỗi nút tốn O(N). Nhờ vậy việc đếm nghiệm \"chỉ có đúng 1?\" chạy được hàng trăm lần khi sinh đề." },
        { title: "Sinh đề có nghiệm duy nhất", text: "Lấy một lời giải ngẫu nhiên rồi bỏ dần từng hậu: chỉ bỏ nếu phần còn lại vẫn có đúng một cách hoàn thành (đếm nghiệm dừng ở 2). Càng ít hậu cho sẵn, đề càng khó." }
      ],
      links: [{ id: "backtracking", label: "Quay lui (Backtracking)" }, { id: "bitmask-dp", label: "Bitmask — biểu diễn tập bằng bit" }]
    },
    difficultyNote: "Điểm 0–10 = 10 × (0,30 · tỉ lệ hậu người chơi phải tự đặt + 0,58 · log₁₀(1 + số nút quay lui đơn giản)/3,5 + 0,12 · (N − 4)/12), mỗi thành phần chặn trong [0, 1]; quay lui đơn giản đặt hậu cho sẵn trước rồi duyệt hết cây (hàng trên → dưới, cột trái → phải), chặn ở 10⁶ nút. Ít hậu cho sẵn và cây lớn = khó; bàn nhỏ không với tới bậc Chuyên gia.",
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty, newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes,
    hint: hint, replay: replay, constraintView: constraintView, trace: trace, describeCell: describeCell, toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText
  };
  def.MIN_N = MIN_N; def.MAX_N = MAX_N;
  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
