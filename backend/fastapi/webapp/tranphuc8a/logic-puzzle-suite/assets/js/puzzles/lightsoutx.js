/* puzzles/lightsoutx.js — LIGHTS OUT BIẾN THỂ (loại RIÊNG, không đụng Lights Out cổ điển `lightsout`): luật bấm khác, bàn quấn mép (xuyến), k mức trạng thái, ô khoá.

   Ván: mỗi ô có mức 0…k−1 (k = 2: tắt/bật; k = 3, 5: nhiều mức). Bấm ô j CỘNG 1 (mod k) vào mọi ô thuộc "mẫu bấm" của j; mục tiêu: đưa MỌI ô về 0.
   state.v  : w*h số 0…k−1, i = hàng*w + cột. Ô khoá (lỗ) luôn 0, isGiven = true (không bấm được, không bị ảnh hưởng, không có đèn).
   puzzle.data = { w, h, rule, topo, k, holes: [chỉ số ô khoá, tăng dần], presses: [chỉ số ô, LẶP đúng số lần bấm, tăng dần] | null }   (presses = một lời giải ÍT LẦN BẤM NHẤT; độ dài = par K).
   solution.v: toàn 0.   action: { k:"press", i } — bấm ô i (một lần; k lần bấm liên tiếp thì về như cũ).
   input (fromInput): { w, h (2…20) | n, rule?, topo?, k?, holes?: [chỉ số], v: mảng w*h số 0…k−1 | chuỗi ký tự "0"…"4" ('x' = ô khoá), meta? }.

   THIẾT KẾ (xem cả ../HUONG-DAN-ENGINE.md mục 11.14)
   · Toán: ô bấm x_j ∈ Z_k (số lần bấm mod k). Bàn b về 0 ⇔ A·x = −b (mod k), A[i][j] = số lần ô i bị cộng khi bấm ô j (xuyến nhỏ có thể trùng ô ⇒ cộng dồn mod k).
     Mọi mẫu bấm đối xứng (offset d và −d cùng có) nên A đối xứng, cả khi có ô khoá (chỉ bỏ hàng/cột của ô khoá) ⇒ ker Aᵀ = ker A.
   · Giải: khử Gauss–Jordan mod k (k nguyên tố 2, 3, 5 ⇒ trường) trên [A | I] MỘT LẦN cho mỗi cấu hình (w,h,luật,xuyến,k,ô khoá), nhớ E = ma trận biến đổi (E·A = dạng bậc thang rút gọn) trong bộ nhớ đệm (LRU 8);
     mỗi bàn b chỉ tốn y = E·(−b) (O(n²)). Vô nghiệm ⇔ y có thành phần khác 0 ở hàng không-pivot. Nghiệm riêng: ẩn pivot = y, ẩn tự do = 0.
   · Ít bấm nhất: min Σ x_j (x_j ∈ 0…k−1) trên coset x0 + ker A: duyệt MỌI tổ hợp kk^nhân (đồng hồ số hỗn hợp, mỗi bước cộng một vector nhân) khi tổng chi phí ≤ ngân sách; vượt thì leo đồi
     (chỉ cải thiện, `minimal:false`, par chỉ là cận trên). Cùng số bấm: chọn vector có giá trị lớn hơn ở ô khác đầu tiên (= bấm sớm hơn) — với k = 2 trùng "nhỏ nhất theo từ điển" của Lights Out cổ điển.
   · Bất biến khi vô nghiệm: y ∈ ker A có y·b ≢ 0 (mod k) ÍT Ô NHẤT: Σ y_i·(mức ô i) mod k không đổi sau mọi lần bấm (vì y·A = 0), bàn tắt hết có tổng 0 — mâu thuẫn.
   · SINH: bấm m lần ngẫu nhiên từ bàn 0 (luôn giải được), TÍNH LẠI K bằng bộ giải, chấm điểm theo K (hiệu chỉnh theo luật/xuyến/k, xem scoreOf); thử lại bằng rng.fork("try"+k) tới khi điểm rơi bậc.
     Sinh tới 10×10; bàn tự nhập tới 20×20. Ngân sách đếm bằng lần thử, không bằng thời gian.
   · Hint "min": ô đầu tiên (theo chỉ số) có x > 0 trong nghiệm ít bấm nhất tính lại từ trạng thái HIỆN TẠI ⇒ mỗi lần bấm theo hint giảm đúng 1 lần bấm tối thiểu còn lại (x − e_j khả thi nên K' ≤ K − 1;
     K' ≤ K − 2 thì x' + e_j có trọng số ≤ K' + 1 < K, mâu thuẫn). Hint "chase" (đuổi đèn mod k) chỉ cho luật chữ thập, bàn phẳng, không ô khoá, h ≥ 3.
   Mã nguồn dùng ES5 thuần; không DOM; chạy trong node và Web Worker. */
(function (root) {
  "use strict";
  var P = root.Puz, R = P.rng, U = P.util;
  var ID = "lightsoutx", MIN_D = 2, MAX_D = 20, GEN_MAX = 10;
  var MAX_TRIES = 60;
  var STEP_BUDGET = 3000000;           // ngân sách duyệt coset: tổng số ô chạm tới trong toàn bộ vòng duyệt (≈ 30 ms)
  var MAX_COMBOS = 1048576;            // 2^20 tổ hợp
  var TECH = "Khử Gauss mod k";
  var KS = [2, 3, 5];
  var RULES = {
    cross: { name: "Chữ thập", off: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]], note: "ô đó và bốn ô trên, dưới, trái, phải" },
    x: { name: "Chữ X", off: [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]], note: "ô đó và bốn ô chéo" },
    king: { name: "Vua", off: [[0, 0], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]], note: "ô đó và tám ô xung quanh" },
    knight: { name: "Quân mã", off: [[0, 0], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], note: "ô đó và tám ô cách một nước đi của quân mã" },
    plus2: { name: "Chữ thập dài", off: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]], note: "ô đó và hai ô mỗi hướng trên, dưới, trái, phải" }
  };
  var RULE_IDS = ["cross", "x", "king", "knight", "plus2"];
  var TOPO_NAME = { flat: "có mép", torus: "quấn mép (xuyến)" };
  var KREF_FRAC = 0.85;                // Kref = KREF_FRAC · (số bấm tối thiểu TRUNG BÌNH của bàn ngẫu nhiên cùng cấu hình): q = min(1, K/Kref)
  var KM_SAMPLES = 6, KREF_MIN = 5.5;     // sàn của Kref: cấu hình có nhân lớn (K điển hình rất nhỏ) vẫn có bậc Dễ với K = 2 (không rơi về bàn một lần bấm)
  var GAIN_MIN = 0.65, GAIN_SPAN = 0.35, K_BONUS = { 2: 1, 3: 1.05, 5: 1.1 };

  // ---------------------------------------------------------------- tiện ích
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function bad(s) { return s === undefined || s === null || s === ""; }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function rcLabel(w, i) { return "hàng " + (Math.floor(i / w) + 1) + ", cột " + (i % w + 1); }
  function inv(a, p) { for (var x = 1; x < p; x++) if ((a * x) % p === 1) return x; return 0; }
  function ownKey(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function viNum(n) { return String(n); }

  // ---------------------------------------------------------------- cấu hình (spec)
  /** spec = { w, h, rule, topo, k, holes:[tăng dần, duy nhất], holeSet: Uint8Array(w*h) }. Trả về {spec} hoặc {error}. */
  function makeSpec(w, h, rule, topo, k, holes) {
    if (w == null || h == null || w < MIN_D || w > MAX_D || h < MIN_D || h > MAX_D) return { error: "Kích thước bàn phải là w, h nguyên trong " + MIN_D + "…" + MAX_D + "." };
    if (!ownKey(RULES, rule)) return { error: "Luật bấm lạ \"" + rule + "\" (chỉ nhận " + RULE_IDS.join(", ") + ")." };
    if (topo !== "flat" && topo !== "torus") return { error: "Kiểu mép lạ \"" + topo + "\" (chỉ nhận flat hoặc torus)." };
    if (KS.indexOf(k) < 0) return { error: "Số trạng thái k phải là 2, 3 hoặc 5 (nhận " + k + ")." };
    var N = w * h, set = new Uint8Array(N), hl = [], i;
    if (holes != null) {
      if (!Array.isArray(holes)) return { error: "Danh sách ô khoá phải là mảng chỉ số ô." };
      for (i = 0; i < holes.length; i++) {
        var q = toInt(holes[i]);
        if (q == null || q < 0 || q >= N) return { error: "Ô khoá thứ " + (i + 1) + " có chỉ số lạ (cần số nguyên trong 0…" + (N - 1) + ")." };
        if (!set[q]) { set[q] = 1; hl.push(q); }
      }
      hl.sort(function (a, b2) { return a - b2; });
    }
    if (hl.length >= N) return { error: "Mọi ô đều bị khoá — không còn ô nào để chơi." };
    return { spec: { w: w, h: h, N: N, rule: rule, topo: topo, k: k, holes: hl, holeSet: set } };
  }
  function specKey(s) { return s.w + "x" + s.h + "|" + s.rule + "|" + s.topo + "|" + s.k + "|" + s.holes.join(","); }
  function specText(s) {
    return RULES[s.rule].name + " · " + TOPO_NAME[s.topo] + " · " + (s.k === 2 ? "2 trạng thái (bật/tắt)" : s.k + " mức") + (s.holes.length ? " · " + s.holes.length + " ô khoá" : "");
  }
  /** Các (ô, số lần cộng) khi bấm ô i: mảng [[t, cnt]] sắp theo t, cnt ∈ 1…k−1 (cộng dồn mod k, ô khoá bị bỏ). */
  function effectOf(s, i) {
    var r = Math.floor(i / s.w), c = i % s.w, off = RULES[s.rule].off, acc = {}, keys = [], q, out = [];
    for (q = 0; q < off.length; q++) {
      var rr = r + off[q][0], cc = c + off[q][1];
      if (s.topo === "torus") { rr = ((rr % s.h) + s.h) % s.h; cc = ((cc % s.w) + s.w) % s.w; }
      else if (rr < 0 || rr >= s.h || cc < 0 || cc >= s.w) continue;
      var t = rr * s.w + cc;
      if (s.holeSet[t]) continue;
      if (acc[t] === undefined) { acc[t] = 0; keys.push(t); }
      acc[t]++;
    }
    keys.sort(function (a, b2) { return a - b2; });
    for (q = 0; q < keys.length; q++) { var n = acc[keys[q]] % s.k; if (n) out.push([keys[q], n]); }
    return out;
  }

  // ---------------------------------------------------------------- khử Gauss mod k một lần, nhớ E (bộ nhớ đệm LRU)
  var SYS = {}, SYS_ORDER = [];
  /** → { n, cells (ô thật, tăng dần), pos (Int16Array N → vị trí | −1), E (Uint8Array n*n), rank, piv, basis:[Uint8Array n], basisNz:[mảng chỉ số ≠ 0], eff:[[ [vị trí, cnt] ]] } */
  function sysOf(s) {
    var key = specKey(s);
    if (SYS[key]) return SYS[key];
    var p = s.k, N = s.N, cells = [], pos = new Int16Array(N), i, j, q;
    for (i = 0; i < N; i++) { if (s.holeSet[i]) pos[i] = -1; else { pos[i] = cells.length; cells.push(i); } }
    var n = cells.length, W = 2 * n, M = new Array(n), eff = new Array(n);
    for (i = 0; i < n; i++) { M[i] = new Uint8Array(W); M[i][n + i] = 1; }
    for (j = 0; j < n; j++) {
      var e = effectOf(s, cells[j]), ev = [];
      for (q = 0; q < e.length; q++) { var tp = pos[e[q][0]]; M[tp][j] = e[q][1]; ev.push([tp, e[q][1]]); }
      eff[j] = ev;
    }
    var piv = [], r = 0, c;
    for (c = 0; c < n && r < n; c++) {
      var pr = -1;
      for (i = r; i < n; i++) if (M[i][c]) { pr = i; break; }
      if (pr < 0) continue;
      if (pr !== r) { var tmp = M[pr]; M[pr] = M[r]; M[r] = tmp; }
      var prow = M[r], iv = inv(prow[c], p);
      if (iv !== 1) for (j = 0; j < W; j++) if (prow[j]) prow[j] = (prow[j] * iv) % p;
      var nz = [];
      for (j = 0; j < W; j++) if (prow[j]) nz.push(j);
      for (i = 0; i < n; i++) {
        if (i === r) continue;
        var row = M[i], f = row[c];
        if (!f) continue;
        if (p === 2) { for (q = 0; q < nz.length; q++) row[nz[q]] ^= prow[nz[q]]; }
        else { var mf = p - f; for (q = 0; q < nz.length; q++) { var jj = nz[q]; row[jj] = (row[jj] + mf * prow[jj]) % p; } }
      }
      piv.push(c); r++;
    }
    var E = new Uint8Array(n * n);
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) E[i * n + j] = M[i][n + j];
    var isPiv = new Uint8Array(n), basis = [], basisNz = [];
    for (q = 0; q < piv.length; q++) isPiv[piv[q]] = 1;
    for (var f2 = 0; f2 < n; f2++) {
      if (isPiv[f2]) continue;
      var bv = new Uint8Array(n), bn = [];
      bv[f2] = 1;
      for (q = 0; q < piv.length; q++) { var coef = M[q][f2]; if (coef) bv[piv[q]] = (p - coef) % p; }
      for (j = 0; j < n; j++) if (bv[j]) bn.push(j);
      basis.push(bv); basisNz.push(bn);
    }
    var sys = { key: key, n: n, cells: cells, pos: pos, E: E, rank: r, piv: piv, basis: basis, basisNz: basisNz, eff: eff, p: p };
    SYS[key] = sys; SYS_ORDER.push(key);
    while (SYS_ORDER.length > 8) delete SYS[SYS_ORDER.shift()];
    return sys;
  }
  function pow(p, e) { var v = Math.pow(p, e); return v < 9007199254740992 ? v : Infinity; }

  function lexBetter(a, b2) { for (var i = 0; i < a.length; i++) if (a[i] !== b2[i]) return a[i] > b2[i]; return false; }
  function sumOf(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function nzCount(a) { var s = 0; for (var i = 0; i < a.length; i++) if (a[i]) s++; return s; }
  function avgNz(sys) { var t = 0; for (var i = 0; i < sys.basisNz.length; i++) t += sys.basisNz[i].length; return sys.basisNz.length ? t / sys.basisNz.length : 0; }
  /** Duyệt hết coset được không? (số tổ hợp × số ô chạm tới mỗi bước ≤ ngân sách). */
  function canEnumerate(sys) {
    var d = sys.basis.length; if (!d) return true;
    var combos = pow(sys.p, d);
    return combos <= MAX_COMBOS && combos * (avgNz(sys) + 4) <= STEP_BUDGET;
  }
  /** Đồng hồ số hỗn hợp: quay qua mọi p^d tổ hợp hạt nhân, mỗi bước cộng vector nhân vào x (tại chỗ). Giữ w = Σx và sup = số ô ≠ 0 cộng dồn theo ô chạm tới
      (mỗi bước tốn ≈ số ô khác 0 của vector nhân, không phải n; k = 2 dùng mã Gray + XOR, k > 2 đồng hồ số + cộng rồi trừ p — không dùng %); onAdd(t) gọi sau mỗi lần cộng basis[t]; visit(w, sup) sau mỗi bước. */
  function odometer(sys, x, w0, sup0, onAdd, visit) {
    var d = sys.basis.length, p = sys.p, digit = new Uint8Array(d), total = pow(p, d), g, t, q, idx, bn, bv, ow, w = w0, sup = sup0, len, nw;
    if (p === 2) {                                                                 // mã Gray: mỗi bước lật ĐÚNG MỘT vector nhân (đồng hồ số nhị phân tốn trung bình 2)
      for (g = 1; g < total; g++) {
        t = 31 - Math.clz32(g & -g); bn = sys.basisNz[t]; len = bn.length;
        for (q = 0; q < len; q++) { idx = bn[q]; ow = x[idx]; x[idx] = ow ^ 1; w += 1 - 2 * ow; }
        if (onAdd) onAdd(t);
        visit(w, w);
      }
      return;
    }
    for (g = 1; g < total; g++) {
      for (t = 0; t < d; t++) {
        bn = sys.basisNz[t]; bv = sys.basis[t]; len = bn.length;
        for (q = 0; q < len; q++) { idx = bn[q]; ow = x[idx]; nw = ow + bv[idx]; if (nw >= p) nw -= p; x[idx] = nw; w += nw - ow; sup += (nw ? 1 : 0) - (ow ? 1 : 0); }
        if (onAdd) onAdd(t);
        digit[t]++;
        if (digit[t] < p) break;
        digit[t] = 0;
      }
      visit(w, sup);
    }
  }
  var BOUND = {}, BOUND_ORDER = [];
  /** Cận trên đã biết cho một bàn (chỉ dùng khi nhân quá lớn để duyệt hết): hint "min" cất x − e_j cho bàn sau khi bấm j, nên lần hint kế leo đồi từ đó ⇒ số lần bấm còn lại
      giảm đơn điệu và vòng "gợi ý → áp dụng" luôn dừng. Không đổi kết quả của cấu hình duyệt-hết-được (luôn chính xác, thuần). */
  function boundKey(s, v) { return specKey(s) + "#" + v.join(""); }
  function putBound(s, v, x) { var k = boundKey(s, v); if (!ownKey(BOUND, k)) BOUND_ORDER.push(k); BOUND[k] = Uint8Array.from(x); while (BOUND_ORDER.length > 400) delete BOUND[BOUND_ORDER.shift()]; }
  /** Nghiệm ít bấm nhất của coset x0 + ker. → { x, weight, minimal }. seed (tuỳ chọn, chỉ khi không duyệt hết được) = nghiệm đã biết của CÙNG bàn, điểm xuất phát thứ hai. */
  function minimise(sys, x0, seed) {
    var p = sys.p, best = Uint8Array.from(x0), bestW = sumOf(x0);
    if (!sys.basis.length) return { x: best, weight: bestW, minimal: true };
    if (canEnumerate(sys)) {
      var x = Uint8Array.from(x0);
      odometer(sys, x, bestW, nzCount(x0), null, function (w) {
        if (w < bestW || (w === bestW && lexBetter(x, best))) { bestW = w; best = Uint8Array.from(x); }
      });
      return { x: best, weight: bestW, minimal: true };
    }
    if (seed && sumOf(seed) < bestW) { best = Uint8Array.from(seed); bestW = sumOf(seed); }
    var improved = true, rounds = 0, t, m, q, idx, bn, bv;
    while (improved && rounds < 400) {
      improved = false; rounds++;
      for (t = 0; t < sys.basis.length; t++) {
        bn = sys.basisNz[t]; bv = sys.basis[t];
        for (m = 1; m < p; m++) {
          var delta = 0;
          for (q = 0; q < bn.length; q++) { idx = bn[q]; delta += ((best[idx] + m * bv[idx]) % p) - best[idx]; }
          if (delta < 0) { for (q = 0; q < bn.length; q++) { idx = bn[q]; best[idx] = (best[idx] + m * bv[idx]) % p; } bestW += delta; improved = true; }
        }
      }
    }
    return { x: best, weight: bestW, minimal: false };
  }

  /** Giải bàn v (mảng w*h số 0…k−1) cho cấu hình s.
      → { n, rank, nullity, status:"none|unique|multiple", count, presses:[ô, lặp theo số lần]|null, x (theo vị trí ô thật)|null, weight, minimal, obstruction? , sys } */
  function analyse(s, v) {
    var sys = sysOf(s), n = sys.n, p = s.k, i, j, E = sys.E;
    var res = { n: n, rank: sys.rank, nullity: n - sys.rank, status: "none", count: 0, presses: null, x: null, weight: -1, minimal: true, sys: sys };
    var c = new Uint8Array(n), y = new Uint8Array(n);
    for (i = 0; i < n; i++) c[i] = (p - v[sys.cells[i]]) % p;
    for (i = 0; i < n; i++) { var sm = 0, o = i * n; for (j = 0; j < n; j++) if (c[j]) sm += E[o + j] * c[j]; y[i] = sm % p; }
    for (i = sys.rank; i < n; i++) if (y[i]) { res.obstruction = obstructionOf(s, sys, v); return res; }
    var x0 = new Uint8Array(n);
    for (i = 0; i < sys.rank; i++) x0[sys.piv[i]] = y[i];
    var seed = null;
    if (sys.basis.length && !canEnumerate(sys)) { var bk = boundKey(s, v); if (ownKey(BOUND, bk)) seed = BOUND[bk]; }
    var m = minimise(sys, x0, seed);
    res.x = m.x; res.weight = m.weight; res.minimal = m.minimal;
    var pr = [];
    for (i = 0; i < n; i++) for (j = 0; j < m.x[i]; j++) pr.push(sys.cells[i]);
    res.presses = pr;
    res.count = pow(p, res.nullity);
    res.status = res.nullity === 0 ? "unique" : "multiple";
    return res;
  }

  // ---------------------------------------------------------------- bất biến khi vô nghiệm
  /** y ∈ ker A với y·b ≢ 0 (mod k), ÍT Ô NHẤT (khác 0), cùng số ô thì vector lớn nhất theo lexBetter. Chuẩn hoá để thành phần khác 0 đầu tiên = 1.
      → { cells, weights, size, sum, minimal } hoặc null (b giải được). */
  function obstructionOf(s, sys, v) {
    var n = sys.n, p = s.k, d = sys.basis.length, b = new Uint8Array(n), i, q;
    for (i = 0; i < n; i++) b[i] = v[sys.cells[i]];
    function dotB(a) { var t = 0; for (var z = 0; z < n; z++) if (a[z]) t += a[z] * b[z]; return t % p; }
    var bdot = [], t0;
    for (t0 = 0; t0 < d; t0++) bdot.push(dotB(sys.basis[t0]));
    var best = null, bestSupport = Infinity, minimal = true;
    if (canEnumerate(sys)) {
      var x = new Uint8Array(n), dd = 0;
      odometer(sys, x, 0, 0, function (t) { dd = (dd + bdot[t]) % p; }, function (w, sup) {
        if (dd === 0) return;
        if (sup < bestSupport || (sup === bestSupport && lexBetter(x, best))) { bestSupport = sup; best = Uint8Array.from(x); }
      });
      if (!best) for (t0 = 0; t0 < d; t0++) if (bdot[t0]) { best = Uint8Array.from(sys.basis[t0]); break; }   // odometer chỉ đi tổ hợp ≥ 1 bước; cơ sở đơn lẻ đã nằm trong đó, phòng hờ
    } else {
      minimal = false;
      for (t0 = 0; t0 < d && !best; t0++) if (bdot[t0]) best = Uint8Array.from(sys.basis[t0]);
    }
    if (!best) return null;
    var first = 0; while (!best[first]) first++;
    var iv = inv(best[first], p);
    if (iv !== 1) for (q = 0; q < n; q++) if (best[q]) best[q] = (best[q] * iv) % p;
    var cells = [], weights = [];
    for (i = 0; i < n; i++) if (best[i]) { cells.push(sys.cells[i]); weights.push(best[i]); }
    var lit = 0; for (i = 0; i < cells.length; i++) if (v[cells[i]]) lit++;
    return { cells: cells, weights: weights, size: cells.length, sum: dotB(best), lit: lit, minimal: minimal };
  }
  function cellList(w, cells, cap) {
    cap = cap || 12;
    var o = cells.slice(0, cap).map(function (i) { return "(" + (Math.floor(i / w) + 1) + "," + (i % w + 1) + ")"; }).join(" ");
    return cells.length > cap ? o + " … (+" + (cells.length - cap) + " ô)" : o;
  }
  function obstructionText(s, ob) {
    if (s.k === 2) {
      return "Bất biến chẵn–lẻ: xét nhóm " + ob.size + " ô " + cellList(s.w, ob.cells) + ". Bấm ô nào cũng đảo một số CHẴN ô trong nhóm này, nên số ô sáng trong nhóm luôn giữ nguyên tính chẵn/lẻ. " +
        "Bàn tắt hết có 0 ô sáng ở đó (chẵn), bàn này có " + ob.lit + " (lẻ) ⇒ không thể tắt hết.";
    }
    var wt = ob.weights.some(function (x) { return x !== 1; }) ? " với trọng số " + ob.weights.join(",") + " (theo thứ tự các ô)" : "";
    return "Bất biến mod " + s.k + ": xét nhóm " + ob.size + " ô " + cellList(s.w, ob.cells) + wt + ". Tổng Σ trọng số × mức ô (mod " + s.k + ") KHÔNG ĐỔI sau mọi lần bấm (mỗi lần bấm cộng vào tổng một số ≡ 0). " +
      "Bàn tắt hết có tổng 0 nhưng bàn này có tổng " + ob.sum + " (mod " + s.k + ") ⇒ không thể tắt hết.";
  }
  function obstructionInfo(s, ob) { return ob ? { cells: ob.cells.slice(), weights: ob.weights.slice(), size: ob.size, sum: ob.sum, lit: ob.lit, minimal: ob.minimal, text: obstructionText(s, ob) } : null; }

  // ---------------------------------------------------------------- đọc đề, độ khó
  function analyze(puzzle) {
    var out = { ok: false, errors: [] };
    if (!puzzle || typeof puzzle !== "object") { out.errors.push("Đề không phải một đối tượng."); return out; }
    var d = puzzle.data || {}, sz = puzzle.size || {};
    var w = toInt(d.w != null ? d.w : sz.w), h = toInt(d.h != null ? d.h : sz.h);
    var ms = makeSpec(w, h, d.rule == null ? "cross" : d.rule, d.topo == null ? "flat" : d.topo, d.k == null ? 2 : toInt(d.k), d.holes == null ? [] : d.holes);
    if (ms.error) { out.errors.push(ms.error); return out; }
    var s = ms.spec, v = puzzle.initial && puzzle.initial.v;
    if (!Array.isArray(v) || v.length !== s.N) { out.errors.push("Trạng thái đầu phải có đúng " + s.N + " ô (bàn " + s.w + "×" + s.h + ")."); return out; }
    for (var i = 0; i < v.length; i++) {
      if (!(typeof v[i] === "number" && v[i] >= 0 && v[i] < s.k && Math.floor(v[i]) === v[i])) { out.errors.push("Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận số nguyên 0…" + (s.k - 1) + ")."); return out; }
      if (s.holeSet[i] && v[i] !== 0) { out.errors.push("Ô thứ " + (i + 1) + " bị khoá nên phải ở mức 0."); return out; }
    }
    out.ok = true; out.spec = s; out.w = s.w; out.h = s.h; out.N = s.N; out.k = s.k; out.v = v;
    return out;
  }
  function boardOf(a, state) { return state && Array.isArray(state.v) && state.v.length === a.N ? state.v : null; }

  /** Điểm khó 0–10 = 10 · min(1, K / Kref) · min(1, gain), Kref = 0,8 · ρ(luật, mép, k) · (số ô thật), gain = (0,65 + 0,35 · min(1, (ô thật − 4)/45)) · hệ số k (1 ; 1,05 ; 1,1). */
  var KMEAN = {}, KMEAN_ORDER = [];
  /** Số bấm tối thiểu TRUNG BÌNH của KM_SAMPLES bàn ngẫu nhiên giải được của cấu hình (x đều trên Z_k^n; hạt giống cố định theo cấu hình ⇒ thuần, tất định), nhớ đệm.
      Cấu hình có nhân lớn (xuyến n chia hết…) hay mẫu rộng cần ít bấm hơn nhiều ⇒ Kref theo từng cấu hình giữ cho mọi bậc đều với tới được. */
  function kmeanOf(s) {
    var key = specKey(s);
    if (ownKey(KMEAN, key)) return KMEAN[key];
    var sys = sysOf(s), n = sys.n, tot = 0, cnt = 0, q, i;
    for (q = 0; q < KM_SAMPLES; q++) {
      var rr = R.create("kmean:" + key + ":" + q), list = [];
      for (i = 0; i < n; i++) { var c = rr.int(s.k); for (var z = 0; z < c; z++) list.push(sys.cells[i]); }
      var bd = plantedBoard(s, sys, list), an = analyse(s, bd);
      if (an.status !== "none") { tot += an.weight; cnt++; }
    }
    var km = cnt ? tot / cnt : 2;
    KMEAN[key] = km; KMEAN_ORDER.push(key);
    while (KMEAN_ORDER.length > 64) delete KMEAN[KMEAN_ORDER.shift()];
    return km;
  }
  function krefOf(s) { return Math.max(KREF_MIN, KREF_FRAC * kmeanOf(s)); }
  function scoreOf(s, n, K) {
    if (K <= 0) return 0;
    var q = clamp01(K / krefOf(s)), g = GAIN_MIN + GAIN_SPAN * clamp01((n - 4) / 45);
    return U.clampScore(10 * q * Math.min(1, g * K_BONUS[s.k]));
  }
  function difficulty(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return 0;
    var an = analyse(a.spec, a.v);
    return an.status === "none" ? 0 : scoreOf(a.spec, an.n, an.weight);
  }

  // ---------------------------------------------------------------- dựng puzzle
  function buildPuzzle(s, v, an, o) {
    var p = { v: 1, type: ID, id: "", seed: o.seed == null ? null : o.seed, sizeId: o.sizeId || "custom", size: { w: s.w, h: s.h }, tier: o.tier || "custom", score: o.score || 0,
      data: { w: s.w, h: s.h, rule: s.rule, topo: s.topo, k: s.k, holes: s.holes.slice(), presses: an && an.presses ? an.presses.slice() : null },
      initial: { v: v.slice() }, solution: an && an.status !== "none" ? { v: zeros(s.N) } : null, meta: o.meta || {} };
    if (an && an.status !== "none" && !an.minimal) p.data.exact = false;          // nhân quá lớn để duyệt hết: par chỉ là cận trên (ghi rõ để bàn/grade nói "ước lượng")
    p.id = U.puzzleId(p);
    if (o.options) p.options = o.options;
    return p;
  }
  function cleanMeta(m) {
    var o = {};
    if (m && typeof m === "object") ["name", "source", "note"].forEach(function (k) { if (typeof m[k] === "string" && m[k]) o[k] = m[k].slice(0, 200); });
    return o;
  }
  function infoOf(s, an) {
    var o = { rank: an.rank, nullity: an.nullity, solutions: an.count, minPresses: an.weight, presses: an.presses ? an.presses.slice() : null, minimal: an.minimal, k: s.k, rule: s.rule, topo: s.topo, holes: s.holes.length };
    if (an.obstruction) o.obstruction = obstructionInfo(s, an.obstruction);
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
  function holeCount(mode, N) { return mode === "few" ? Math.max(1, Math.round(0.06 * N)) : mode === "some" ? Math.max(2, Math.round(0.12 * N)) : 0; }
  /** Các K (1…n·(k−1)) mà điểm rơi vào bậc `tier` (K = 1 chỉ khi cấu hình quá "rộng" để bậc Dễ có K ≥ 2). */
  function bandOf(s, n, tier) {
    var out = [], cap = Math.max(3, Math.min(n * (s.k - 1), Math.ceil(1.6 * krefOf(s))));
    for (var K = 1; K <= cap; K++) if (U.tierOfScore(scoreOf(s, n, K)).id === tier) out.push(K);
    return out;
  }
  /** Bàn mà bấm đúng danh sách ô list đưa về 0, kèm ghi nhớ "danh sách này là một nghiệm" (cận trên cho bộ giải khi nhân quá lớn để duyệt hết). */
  function plantedBoard(s, sys, list) {
    var v = applyPressList(s, zeros(s.N), list, true);
    if (sys.basis.length && !canEnumerate(sys)) { var x = new Uint8Array(sys.n); for (var q = 0; q < list.length; q++) x[sys.pos[list[q]]] = (x[sys.pos[list[q]]] + 1) % s.k; putBound(s, v, x); }
    return v;
  }
  /** Áp danh sách ô bấm lên bàn v. neg = true: áp NGHỊCH (k−1 lần mỗi lần bấm) ⇒ bàn mới chính là bàn mà bấm đúng danh sách đó sẽ đưa về v (dùng để SINH: bàn luôn giải được bằng ≤ |danh sách| lần bấm). */
  function applyPressList(s, v, list, neg) {
    var o = v.slice(), k = s.k, mul = neg ? k - 1 : 1;
    for (var q = 0; q < list.length; q++) { var e = effectOf(s, list[q]); for (var m = 0; m < e.length; m++) o[e[m][0]] = (o[e[m][0]] + mul * e[m][1]) % k; }
    return o;
  }

  function generate(seed, opt) {
    opt = opt || {};
    var size = pickSize(opt.sizeId), full = P.types.optionsOf(def, opt.options), k = Number(full.k), w = Math.min(size.params.w, GEN_MAX), h = Math.min(size.params.h, GEN_MAX), N = w * h;
    var tier = nearestTier(size, U.tier(opt.tier) ? opt.tier : "medium"), T = U.tier(tier), rng = R.create(seed), i, tr;
    var cells = []; for (i = 0; i < N; i++) cells.push(i);
    var hc = holeCount(full.holes, N), holes = [];
    if (hc) { var hs = cells.slice(); rng.fork("holes").shuffle(hs); holes = hs.slice(0, hc).sort(function (a, b2) { return a - b2; }); }
    var s = makeSpec(w, h, full.rule, full.topo, k, holes).spec, sys = sysOf(s), n = sys.n;
    var band = bandOf(s, n, tier), best = null, low = band.filter(function (K) { return K >= 2; });
    if (low.length) band = low;                                                    // K = 1 (một lần bấm) chỉ khi cấu hình quá rộng để bậc này có K ≥ 2
    if (!band.length) band = [Math.max(2, Math.round(0.3 * n))];
    var act = sys.cells;
    for (tr = 0; tr < MAX_TRIES; tr++) {
      var rk = rng.fork("try" + tr), kt = band[rk.fork("m").int(band.length)], m = kt + (tr >= 8 ? rk.fork("x").int(Math.ceil(kt / 2) + 1) : 0), list = [];
      if (k === 2) { var pool = act.slice(); rk.fork("cells").shuffle(pool); list = pool.slice(0, Math.min(m, n)).sort(function (a, b2) { return a - b2; }); }
      else { var rc = rk.fork("cells"); for (i = 0; i < m; i++) list.push(act[rc.int(n)]); list.sort(function (a, b2) { return a - b2; }); }
      var v = plantedBoard(s, sys, list), an = analyse(s, v);
      if (an.status === "none" || an.weight < Math.min(2, band[0])) continue;
      var score = scoreOf(s, n, an.weight), cand = { v: v, an: an, score: score };
      if (U.tierOfScore(score).id === tier) { best = cand; break; }
      if (!best || Math.abs(score - T.target) < Math.abs(best.score - T.target)) best = cand;
    }
    if (!best) {                                                                   // cấu hình quá lạ (không có bàn nào ≥ 2 lần bấm): lấy bàn một lần bấm — luôn giải được
      var v1 = applyPressList(s, zeros(N), [act[0]], true); best = { v: v1, an: analyse(s, v1), score: 0 };
    }
    return buildPuzzle(s, best.v, best.an, { seed: rng.seed, sizeId: size.id, tier: U.tierOfScore(best.score).id, score: best.score, options: P.types.compactOptions(def, full) });
  }

  // ---------------------------------------------------------------- giải / kiểm đề
  function stepsOf(w, an) {
    var out = [];
    if (!an.presses) return out;
    an.presses.forEach(function (i, q) { out.push({ technique: TECH, text: "Bấm ô (" + rcLabel(w, i) + ") — lần " + (q + 1) + "/" + an.presses.length + " trong tập bấm ít nhất." }); });
    return out;
  }
  function solve(puzzle, opts) {
    opts = opts || {};
    var a = analyze(puzzle);
    if (!a.ok) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, errors: a.errors };
    var board = Array.isArray(opts.board) && opts.board.length === a.N && opts.board.every(function (x, i) { return typeof x === "number" && x >= 0 && x < a.k && Math.floor(x) === x && (!a.spec.holeSet[i] || x === 0); }) ? opts.board : a.v;
    var an = analyse(a.spec, board);
    var out = { status: an.status, count: an.count, solution: an.status === "none" ? null : { v: zeros(a.N) }, steps: stepsOf(a.w, an), techniques: {}, nodes: an.status === "none" ? 0 : pow(a.k, an.nullity),
      presses: an.presses, minPresses: an.weight, info: infoOf(a.spec, an) };
    if (out.steps.length) out.techniques[TECH] = out.steps.length;
    if (!an.minimal) out.warning = "Nhân quá lớn (" + an.nullity + " chiều): chỉ có cận trên số lần bấm, chưa chắc ít nhất.";
    return out;
  }
  function noneText(s, an) {
    var frac = an.nullity ? "chỉ khoảng 1/" + pow(s.k, an.nullity) + " số bàn " + s.w + "×" + s.h + " (cùng luật) giải được" : "";
    return "Bàn này không có lời giải: không cách bấm nào đưa mọi ô về 0" + (frac ? " (" + frac + ")" : "") + ".";
  }
  function validate(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { ok: false, errors: a.errors, status: "none", count: 0 };
    var an = analyse(a.spec, a.v), errors = [];
    if (an.status === "none") { errors.push(noneText(a.spec, an)); if (an.obstruction) errors.push(obstructionText(a.spec, an.obstruction)); }
    else if (an.weight === 0) errors.push("Bàn đã về 0 hết sẵn: không có gì để chơi.");
    var out = { ok: errors.length === 0, errors: errors, status: an.status, count: an.count, info: infoOf(a.spec, an) };
    if (an.status !== "none") out.solution = { v: zeros(a.N) };
    return out;
  }
  function badInput(msg) { return { ok: false, puzzle: null, errors: Array.isArray(msg) ? msg : [msg], warnings: [], status: "none", count: 0 }; }

  /** Đọc bàn từ mảng hoặc chuỗi ('0'…'4', 'x'/'X' = ô khoá). → {v, holes} | {error}. */
  function readBoard(src, N, k, holesIn) {
    var v = zeros(N), holes = Array.isArray(holesIn) ? holesIn.slice() : [], i;
    if (typeof src === "string") {
      var str = src.replace(/\s+/g, "");
      if (str.length !== N) return { error: "Bàn cần đúng " + N + " ô, nhận được " + str.length + " ký tự." };
      for (i = 0; i < N; i++) {
        var ch = str.charAt(i);
        if (ch === "x" || ch === "X") { holes.push(i); continue; }
        if (ch < "0" || ch > "9") return { error: "Ký tự lạ \"" + ch + "\" ở ô thứ " + (i + 1) + " (chỉ nhận 0…" + (k - 1) + " và x = ô khoá)." };
        v[i] = Number(ch);
      }
    } else if (src != null) {
      if (!Array.isArray(src) || src.length !== N) return { error: "Bàn cần đúng " + N + " ô, nhận được " + (Array.isArray(src) ? src.length : "không phải mảng") + "." };
      for (i = 0; i < N; i++) { if (typeof src[i] !== "number" || Math.floor(src[i]) !== src[i]) return { error: "Ô thứ " + (i + 1) + " có giá trị lạ (chỉ nhận số nguyên 0…" + (k - 1) + ")." }; v[i] = src[i]; }
    }
    return { v: v, holes: holes };
  }
  function fromInput(input) {
    try {
      if (!input || typeof input !== "object") return badInput("Dữ liệu nhập không hợp lệ: cần một đối tượng {w, h, rule, topo, k, v}.");
      var w = toInt(input.w != null ? input.w : input.n), h = toInt(input.h != null ? input.h : input.n);
      if (input.size && typeof input.size === "object") { if (w == null) w = toInt(input.size.w); if (h == null) h = toInt(input.size.h); }
      var rule = input.rule == null ? "cross" : input.rule, topo = input.topo == null ? "flat" : input.topo, k = input.k == null ? 2 : toInt(input.k);
      var ms0 = makeSpec(w, h, rule, topo, k, null);
      if (ms0.error) return badInput(ms0.error);
      var N = w * h, rb = readBoard(input.v, N, k, input.holes);
      if (rb.error) return badInput(rb.error);
      var ms = makeSpec(w, h, rule, topo, k, rb.holes);
      if (ms.error) return badInput(ms.error);
      var s = ms.spec, v = rb.v, i;
      for (i = 0; i < N; i++) {
        if (v[i] < 0 || v[i] >= k) return badInput("Ô thứ " + (i + 1) + " có mức " + v[i] + " ngoài 0…" + (k - 1) + ".");
        if (s.holeSet[i] && v[i] !== 0) return badInput("Ô thứ " + (i + 1) + " bị khoá nên phải ở mức 0.");
      }
      var an = analyse(s, v), errors = [];
      if (an.status === "none") { errors.push(noneText(s, an)); if (an.obstruction) errors.push(obstructionText(s, an.obstruction)); }
      else if (an.weight === 0) errors.push("Bàn đang về 0 hết: hãy bật ít nhất một ô.");
      var puzzle = buildPuzzle(s, v, an, { seed: null, tier: "custom", meta: cleanMeta(input.meta) });
      puzzle.score = an.status === "none" ? 0 : scoreOf(s, an.n, an.weight);
      var warnings = [];
      if (an.status !== "none" && !an.minimal) warnings.push("Nhân " + an.nullity + " chiều quá lớn để duyệt hết: số lần bấm par chỉ là cận trên, có thể còn cách ngắn hơn.");
      return { ok: errors.length === 0, puzzle: puzzle, errors: errors, warnings: warnings, status: an.status, count: an.count, info: infoOf(s, an) };
    } catch (e) { return badInput("Không đọc được dữ liệu nhập: " + (e && e.message ? e.message : e)); }
  }

  // ---------------------------------------------------------------- ván chơi
  function newState(puzzle) { return { v: puzzle.initial.v.slice(), c: null }; }
  function isGiven(puzzle, i) { var hl = puzzle && puzzle.data && puzzle.data.holes; return Array.isArray(hl) && hl.indexOf(i) >= 0; }
  function moveFor(puzzle, state, action) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v || !action || action.k !== "press") return null;
    var i = toInt(action.i);
    if (i == null || i < 0 || i >= a.N || a.spec.holeSet[i]) return null;
    var e = effectOf(a.spec, i), d = [];
    for (var q = 0; q < e.length; q++) d.push(["v", e[q][0], v[e[q][0]], (v[e[q][0]] + e[q][1]) % a.k]);
    if (!d.length) return null;
    return { d: d, label: "Bấm ô (" + rcLabel(a.w, i) + ")" };
  }
  function check(puzzle, state) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v) return { solved: false, conflicts: [], filled: 0, total: a.N || 0 };
    var on = 0, free = 0; for (var i = 0; i < v.length; i++) { if (a.spec.holeSet[i]) continue; free++; if (v[i]) on++; }
    return { solved: on === 0, conflicts: [], filled: free - on, total: free };
  }
  function mistakes() { return 0; }
  function describeCell(puzzle, state, i) {
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v || toInt(i) == null || i < 0 || i >= a.N) return "Ô không hợp lệ";
    var pre = "Hàng " + (Math.floor(i / a.w) + 1) + ", cột " + (i % a.w + 1);
    if (a.spec.holeSet[i]) return pre + ", ô khoá";
    return pre + (a.k === 2 ? ", đèn " + (v[i] ? "bật" : "tắt") : ", mức " + v[i] + " trên " + (a.k - 1));
  }

  // ---------------------------------------------------------------- đuổi đèn mod k (chữ thập, phẳng, không ô khoá, h ≥ 3)
  /* Pha 1: đi từ trên xuống, ô (r, c) có mức s ≠ 0 ở hàng r < h−1 → bấm ô NGAY DƯỚI (k − s) lần (mỗi lần cộng 1 cho ô trên nó). Hết pha 1 chỉ hàng cuối còn ≠ 0 (mẫu r).
     Pha 2: tập bấm t ở HÀNG ĐẦU thoả T·t = −r (mod k), cột j của T = mẫu hàng cuối khi bấm ô j hàng đầu trên bàn tối rồi đuổi đèn (đuổi đèn là ánh xạ TUYẾN TÍNH nên cộng được);
     t chính tắc = ít bấm nhất, cùng số bấm thì lexBetter. Nhận ra "pha 2 đang dở" (hàng 2 = S, hàng 1 = vết của S, hàng giữa tối) để trùng thủ tục tay: bấm hết t rồi mới đuổi lại. */
  function chaseOk(s) { return s.rule === "cross" && s.topo === "flat" && s.holes.length === 0 && s.h >= 3 && s.w >= 2; }
  var CHASE_COLS = {};
  function cross4(w, h, i) {
    var r = Math.floor(i / w), c = i % w, o = [];
    if (r > 0) o.push(i - w);
    if (c > 0) o.push(i - 1);
    o.push(i);
    if (c < w - 1) o.push(i + 1);
    if (r < h - 1) o.push(i + w);
    return o;
  }
  function addCross(w, h, k, v, i, times) { var cs = cross4(w, h, i); for (var q = 0; q < cs.length; q++) v[cs[q]] = (v[cs[q]] + times) % k; }
  /** Đuổi đèn tại chỗ trên bản sao. → { presses:[ô lặp], last:[mức hàng cuối], v } */
  function chaseDown(w, h, k, v0) {
    var v = v0.slice(), pr = [], r, c, q;
    for (r = 0; r < h - 1; r++) for (c = 0; c < w; c++) {
      var sv = v[r * w + c];
      if (sv) { var j = (r + 1) * w + c, m = (k - sv) % k; for (q = 0; q < m; q++) pr.push(j); addCross(w, h, k, v, j, m); }
    }
    return { presses: pr, last: v.slice((h - 1) * w, h * w), v: v };
  }
  function chaseCols(w, h, k) {
    var key = w + "x" + h + "x" + k; if (CHASE_COLS[key]) return CHASE_COLS[key];
    var cols = [];
    for (var j = 0; j < w; j++) { var v = zeros(w * h); addCross(w, h, k, v, j, 1); cols.push(chaseDown(w, h, k, v).last); }
    CHASE_COLS[key] = cols; return cols;
  }
  /** Tập bấm hàng đầu chính tắc (mảng số lần bấm theo cột) cho mẫu hàng cuối r: giải T·t = −r mod k. null nếu vô nghiệm. */
  function chaseTop(w, h, k, r) {
    var allZero = true, i, j, c, q; for (i = 0; i < w; i++) if (r[i]) allZero = false;
    if (allZero) return zeros(w);
    var cols = chaseCols(w, h, k), M = [];
    for (i = 0; i < w; i++) { var row = new Array(w + 1); for (j = 0; j < w; j++) row[j] = cols[j][i]; row[w] = (k - r[i]) % k; M.push(row); }
    var piv = [], rk = 0;
    for (c = 0; c < w && rk < w; c++) {
      var p0 = -1; for (i = rk; i < w; i++) if (M[i][c]) { p0 = i; break; }
      if (p0 < 0) continue;
      var tmp = M[p0]; M[p0] = M[rk]; M[rk] = tmp;
      var iv = inv(M[rk][c], k); for (j = 0; j <= w; j++) M[rk][j] = (M[rk][j] * iv) % k;
      for (i = 0; i < w; i++) if (i !== rk && M[i][c]) { var f = M[i][c]; for (j = 0; j <= w; j++) M[i][j] = (M[i][j] + (k - f) * M[rk][j]) % k; }
      piv.push(c); rk++;
    }
    for (i = rk; i < w; i++) if (M[i][w]) return null;
    var x0 = zeros(w), isP = zeros(w), ker = [];
    for (i = 0; i < piv.length; i++) { isP[piv[i]] = 1; x0[piv[i]] = M[i][w]; }
    for (c = 0; c < w; c++) if (!isP[c]) { var kv = zeros(w); kv[c] = 1; for (i = 0; i < piv.length; i++) if (M[i][c]) kv[piv[i]] = (k - M[i][c]) % k; ker.push(kv); }
    var best = x0.slice(), cur = x0.slice(), total = pow(k, ker.length);
    if (total > 262144) return best;
    var digit = zeros(ker.length), g;
    for (g = 1; g < total; g++) {
      for (var t = 0; t < ker.length; t++) {
        for (q = 0; q < w; q++) cur[q] = (cur[q] + ker[t][q]) % k;
        digit[t]++;
        if (digit[t] < k) break;
        digit[t] = 0;
      }
      var cs = sumOf(cur), bs = sumOf(best);
      if (cs < bs || (cs === bs && lexBetter(cur, best))) best = cur.slice();
    }
    return best;
  }
  function triOf(w, k, S) { var o = zeros(w); for (var c = 0; c < w; c++) o[c] = ((c > 0 ? S[c - 1] : 0) + S[c] + (c < w - 1 ? S[c + 1] : 0)) % k; return o; }
  function eqArr(a, b2) { for (var i = 0; i < a.length; i++) if (a[i] !== b2[i]) return false; return true; }
  function rowOf(v, w, r) { return v.slice(r * w, (r + 1) * w); }
  function isZero(a) { for (var i = 0; i < a.length; i++) if (a[i]) return false; return true; }
  /** Một bước đuổi đèn. → {done} | {none} | {phase:1, cell, row, col, times} | {phase:2, cell, last, top, pressed}. */
  function chaseStep(w, h, k, v) {
    var N = w * h, i, r, c;
    for (i = 0; i < N && !v[i]; i++);
    if (i === N) return { done: true };
    if (h >= 3) {
      var dark = true;
      for (i = 2 * w; i < (h - 1) * w && dark; i++) if (v[i]) dark = false;
      var S = rowOf(v, w, 1);
      if (dark && !isZero(S) && eqArr(rowOf(v, w, 0), triOf(w, k, S))) {
        var last = rowOf(v, w, h - 1), t = chaseTop(w, h, k, last);
        if (t !== null) {
          var cm = w - 1; while (!S[cm]) cm--;
          var okp = S[cm] <= t[cm], q;
          for (q = 0; q < cm && okp; q++) if (S[q] !== t[q]) okp = false;
          if (okp && !eqArr(S, t)) {
            var nx = S[cm] < t[cm] ? cm : -1;
            if (nx < 0) for (q = cm + 1; q < w; q++) if (t[q]) { nx = q; break; }
            if (nx >= 0) return { phase: 2, cell: nx, last: last, top: t, pressed: S };
          }
        }
      }
    }
    for (r = 0; r < h - 1; r++) for (c = 0; c < w; c++) if (v[r * w + c]) return { phase: 1, cell: (r + 1) * w + c, row: r, col: c, times: (k - v[r * w + c]) % k, level: v[r * w + c] };
    var r0 = rowOf(v, w, h - 1), t0 = chaseTop(w, h, k, r0);
    if (t0 === null) return { none: true, last: r0 };
    var f0 = 0; while (!t0[f0]) f0++;
    return { phase: 2, cell: f0, last: r0, top: t0, pressed: zeros(w) };
  }
  var CHASE = "Đuổi đèn";
  function maskStr(a) { return a.join(""); }
  function listCols(a) { var o = []; for (var c = 0; c < a.length; c++) if (a[c]) o.push(a[c] > 1 ? (c + 1) + "×" + a[c] : String(c + 1)); return o; }
  function chaseHint(a, v, level) {
    var w = a.w, h = a.h, k = a.k, st = chaseStep(w, h, k, v), i = st.cell, c = i % w, lvTxt = k === 2 ? "đèn sáng" : "ô khác 0";
    if (st.phase === 1) {
      var lit = []; for (var q = 0; q < w; q++) if (v[st.row * w + q]) lit.push(st.row * w + q);
      var times = st.times > 1 ? " " + st.times + " lần" : "";
      if (level === 1) return { level: 1, text: "Đuổi đèn: hàng " + (st.row + 1) + " còn " + lit.length + " " + lvTxt + " — bấm ô ngay DƯỚI mỗi ô đó (ở hàng " + (st.row + 2) + ") để đẩy xuống.", why: [], cells: lit, technique: CHASE };
      if (level === 2) return { level: 2, text: "Bấm ô ngay dưới ô ở hàng " + (st.row + 1) + ", cột " + (st.col + 1) + (k === 2 ? "." : " (đang ở mức " + st.level + ", cần " + st.times + " lần để về 0)."), why: [], cells: [i], technique: CHASE };
      var after = chaseDown(w, h, k, v);
      return { level: 3, text: "Bấm ô " + rcLabel(w, i) + (k === 2 ? "." : " (còn cần" + times + " ở ô này)."), technique: CHASE, cells: [i], action: { k: "press", i: i },
        why: ["Đuổi đèn đi từ trên xuống: ô ở hàng " + (st.row + 1) + ", cột " + (st.col + 1) + " chỉ còn về 0 được bằng ô ngay dưới nó mà không làm đổi các hàng phía trên." + (k === 2 ? "" : " Mỗi lần bấm cộng 1 (mod " + k + ") nên mức " + st.level + " cần " + st.times + " lần."),
          "Làm lần lượt mọi ô khác 0, hàng này qua hàng khác, tới khi chỉ còn hàng cuối khác 0.",
          isZero(after.last) ? "Đuổi hết xuống từ bàn hiện tại là về 0 hết — không cần pha 2." : "Đuổi hết xuống từ bàn hiện tại, hàng cuối sẽ còn mẫu " + maskStr(after.last) + " — khi đó tra bảng hàng cuối (pha 2)."] };
    }
    var pat = maskStr(st.last), all = listCols(st.top), leftArr = st.top.map(function (x, q2) { return x - st.pressed[q2]; }), left = listCols(leftArr), topCells = [];
    for (var q3 = 0; q3 < w; q3++) if (leftArr[q3] > 0) topCells.push(q3);
    var lastCells = []; for (var q4 = 0; q4 < w; q4++) if (st.last[q4]) lastCells.push((h - 1) * w + q4);
    var partial = !isZero(st.pressed);
    var table = "Hàng cuối còn mẫu " + pat + " → tra bảng: bấm ô " + all.join(", ") + " ở hàng 1 rồi đuổi lại.";
    if (level === 1) return { level: 1, technique: CHASE, why: [], cells: partial ? topCells : lastCells,
      text: partial ? "Đuổi đèn — pha 2 đang dở: theo bảng hàng cuối (mẫu " + pat + ") còn phải bấm " + left.length + " ô ở hàng 1 trước khi đuổi lại." : "Đuổi đèn — pha 2: chỉ còn hàng cuối khác 0 (mẫu " + pat + "). Tra bảng hàng cuối để biết phải bấm những ô nào ở HÀNG 1, rồi đuổi lại." };
    if (level === 2) return { level: 2, technique: CHASE, why: [], cells: topCells, text: table + " Ô tiếp theo: hàng 1, cột " + (c + 1) + "." };
    var why = [table, "Bảng tính bằng cách giải T·t = −r trên GF(" + k + "): cột j của T là mẫu hàng cuối khi bấm ô j của hàng 1 trên bàn tối rồi đuổi đèn; chọn cách ít lần bấm nhất."];
    if (partial) why.push("Đã bấm hàng 1 theo " + listCols(st.pressed).join(", ") + "; còn " + left.join(", ") + ". Bấm hết rồi mới đuổi lại từ hàng 1.");
    else why.push("Bấm đủ các ô này ở hàng 1 (thứ tự không quan trọng), xong mới đuổi lại từ trên xuống.");
    return { level: 3, text: "Bấm ô " + rcLabel(w, i) + ".", why: why, cells: [i], technique: CHASE, action: { k: "press", i: i } };
  }

  // ---------------------------------------------------------------- gợi ý
  function rowCells(w, r) { var o = []; for (var c = 0; c < w; c++) o.push(r * w + c); return o; }
  function hintStyle(settings, s) { return settings && settings.loHint === "chase" && (!s || chaseOk(s)) ? "chase" : "min"; }
  function hint(puzzle, state, level, settings) {
    level = Math.max(1, Math.min(3, level | 0 || 1));
    var a = analyze(puzzle), v = a.ok ? boardOf(a, state) : null;
    if (!v) return { level: level, text: "Đề không hợp lệ nên chưa gợi ý được.", why: a.errors.slice(), cells: [], none: true };
    var s = a.spec, an = analyse(s, v);
    if (an.status === "none") {
      var ob = an.obstruction ? obstructionInfo(s, an.obstruction) : null;
      return { level: level, text: "Bàn hiện tại không thể về 0 hết bằng các nước bấm nên không gợi ý được.", why: ob ? [ob.text] : [], cells: ob ? ob.cells : [], none: true, obstruction: ob };
    }
    if (an.weight === 0) return { level: level, text: "Tất cả ô đã về 0 — không còn gì để gợi ý.", why: [], cells: [], none: true };
    if (hintStyle(settings, s) === "chase") return chaseHint(a, v, level);
    var i = an.presses[0];
    if (!an.minimal) {                                                              // cất cận trên cho bàn sau khi bấm ô i (x − e_i) để hint kế tiếp không tệ đi
      var v2 = v.slice(), e2 = effectOf(s, i), x2 = Uint8Array.from(an.x);
      for (var z = 0; z < e2.length; z++) v2[e2[z][0]] = (v2[e2[z][0]] + e2[z][1]) % s.k;
      x2[an.sys.pos[i]]--; putBound(s, v2, x2);
    }
    var r = Math.floor(i / a.w), c = i % a.w, K = an.weight, times = an.presses.filter(function (q) { return q === i; }).length;
    var inRow = {}, rowN = 0; an.presses.forEach(function (q) { if (Math.floor(q / a.w) === r && !inRow[q]) { inRow[q] = 1; rowN++; } });
    if (level === 1) return { level: 1, text: "Bàn này cần ít nhất " + K + " lần bấm nữa. Hãy nhìn vào hàng " + (r + 1) + ".", why: [], cells: rowCells(a.w, r), technique: TECH };
    if (level === 2) return { level: 2, text: "Hàng " + (r + 1) + " còn cần bấm " + rowN + " ô khác nhau. Một ô cần bấm nằm ở cột " + (c + 1) + (times > 1 ? " (ô đó cần " + times + " lần)." : "."), why: [], cells: [i], technique: TECH };
    var why = ["Mỗi ô một phương trình mod " + s.k + ": tổng (số lần bấm các ô có mẫu chạm tới ô này) + mức ô ≡ 0. x = số lần bấm mỗi ô (mod " + s.k + ").",
      "Theo nghiệm của hệ A·x = −b trên GF(" + s.k + ") với trạng thái hiện tại, ô này có x = " + times + " trong nghiệm ít bấm nhất.",
      "Hệ có hạng " + an.rank + ", nhân " + an.nullity + " chiều ⇒ " + (isFinite(an.count) ? an.count : "rất nhiều") + " cách bấm đều về 0; cách ngắn nhất cần " + K + " lần. Bấm ô này xong còn " + (K - 1) + " lần."];
    return { level: 3, text: "Bấm ô " + rcLabel(a.w, i) + ".", why: why, cells: [i], technique: TECH, action: { k: "press", i: i } };
  }
  function replay(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return [];
    var an = analyse(a.spec, a.v); if (an.status === "none" || !an.presses.length) return [];
    var st = newState(puzzle), out = [], K = an.presses.length, distinct = [], seen = {};
    an.presses.forEach(function (i) { if (!seen[i]) { seen[i] = 1; distinct.push(i); } });
    an.presses.forEach(function (i, q) {
      var diff = moveFor(puzzle, st, { k: "press", i: i });
      var why = q === 0 ? ["Giải A·x = −b trên GF(" + a.k + "): hạng " + an.rank + ", nhân " + an.nullity + " chiều; chọn nghiệm ít bấm nhất (" + K + " lần).", "Ô này có x > 0 trong nghiệm đó."] : ["Ô này cũng có x > 0 trong nghiệm ít bấm nhất; thứ tự bấm không quan trọng."];
      var text = (q === 0 ? "Bản đồ lời giải — cần bấm " + K + " lần ở " + distinct.length + " ô (đang tô): " + cellList(a.w, distinct, 40) + "; thứ tự không quan trọng. " : "") + "Bấm ô " + rcLabel(a.w, i) + " (lần " + (q + 1) + "/" + K + "): đổi " + diff.d.length + " ô.";
      var step = { text: text, why: why, diff: diff, cells: q === 0 ? distinct.slice() : diff.d.map(function (e) { return e[1]; }), technique: TECH };
      if (q === 0) step.map = distinct.slice();
      out.push(step);
      P.game.applyDiff(st, diff.d, false);
    });
    return out;
  }

  // ---------------------------------------------------------------- constraint view, trace
  function cellName(w, i) { return "x(" + (Math.floor(i / w) + 1) + "," + (i % w + 1) + ")"; }
  function equationOf(s, sys, v, jpos) {
    var terms = [], q;
    for (var jj = 0; jj < sys.n; jj++) { var ev = sys.eff[jj]; for (q = 0; q < ev.length; q++) if (ev[q][0] === jpos) terms.push((ev[q][1] > 1 ? ev[q][1] + "·" : "") + cellName(s.w, sys.cells[jj])); }
    return terms.join(" + ") + " ≡ " + ((s.k - v[sys.cells[jpos]]) % s.k) + " (mod " + s.k + ")";
  }
  function gridOf(s, cells, vals) {
    var g = [], map = {}, r, c;
    cells.forEach(function (i, q) { map[i] = vals ? vals[q] : 1; });
    for (r = 0; r < s.h; r++) { var t = ""; for (c = 0; c < s.w; c++) { var i = r * s.w + c; t += s.holeSet[i] ? "x" : map[i] ? (s.k === 2 ? "#" : String(map[i])) : "."; } g.push(t); }
    return g;
  }
  var MAX_LISTED = 16;
  function vecCells(sys, x) { var cs = [], vs = []; for (var i = 0; i < sys.n; i++) if (x[i]) { cs.push(sys.cells[i]); vs.push(x[i]); } return { cells: cs, vals: vs }; }
  function silentSections(s, v, an) {
    var sys = an.sys, out = [], basis = sys.basis, q;
    if (basis.length) {
      out.push({ title: "Mẫu bấm im lặng (cơ sở hạt nhân, " + basis.length + " mẫu)", note: "Bấm mẫu (mỗi ô đúng số lần ghi trong lưới) thì mọi ô được cộng một số ≡ 0 (mod " + s.k + ") — bàn không đổi. Cộng một mẫu vào một lời giải ra lời giải khác; " + basis.length + " mẫu độc lập cho " + s.k + "^" + basis.length + " = " + pow(s.k, basis.length) + " cách bấm cùng đúng.",
        items: basis.map(function (b, i) { var vc = vecCells(sys, b); return { text: "Mẫu " + (i + 1) + " — " + vc.cells.length + " ô: " + cellList(s.w, vc.cells, 16), grid: gridOf(s, vc.cells, vc.vals) }; }) });
    } else out.push({ title: "Mẫu bấm im lặng", note: "Hạt nhân 0 chiều: không có tập bấm khác rỗng nào giữ nguyên bàn ⇒ mọi bàn cùng cấu hình giải được và lời giải là duy nhất.", items: [] });
    if (an.status !== "none" && an.x && basis.length && pow(s.k, basis.length) <= MAX_LISTED) {
      var sols = [], cur = Uint8Array.from(an.x), x = Uint8Array.from(an.x), total = pow(s.k, basis.length);
      sols.push(Uint8Array.from(cur));
      odometer(sys, x, 0, 0, null, function () { sols.push(Uint8Array.from(x)); });
      sols.sort(function (a1, b1) { var d = sumOf(a1) - sumOf(b1); return d || (lexBetter(a1, b1) ? -1 : lexBetter(b1, a1) ? 1 : 0); });
      if (sols.length === total) out.push({ title: "Mọi lời giải (" + sols.length + ")", note: "Lời giải đầu là cách ít bấm nhất (gợi ý và replay đi theo nó).",
        items: sols.map(function (sx, i) { var vc = vecCells(sys, sx); return { text: "Cách " + (i + 1) + " — " + sumOf(sx) + " lần bấm" + (i === 0 ? " (ít nhất)" : "") + ": " + cellList(s.w, vc.cells, 16), grid: gridOf(s, vc.cells, vc.vals) }; }) });
    }
    if (an.obstruction) { var ob = obstructionInfo(s, an.obstruction); out.push({ title: "Bất biến: vì sao không giải được", note: ob.text, items: [{ text: "Nhóm " + ob.size + " ô, tổng bất biến = " + ob.sum + " (khác 0).", grid: gridOf(s, ob.cells, ob.weights) }] }); }
    return out;
  }
  function constraintView(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { summary: "Đề không hợp lệ.", variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    var s = a.spec, an = analyse(s, a.v), sys = an.sys, n = sys.n, variables = [], constraints = [], i, r, dom = "{" + Array.apply(null, Array(s.k)).map(function (z, q) { return q; }).join(", ") + "}";
    if (n < 40) for (i = 0; i < n; i++) variables.push({ name: cellName(s.w, sys.cells[i]), domain: dom });
    else for (r = 0; r < s.h; r++) { var cnt = 0; for (i = 0; i < s.w; i++) if (!s.holeSet[r * s.w + i]) cnt++; if (cnt) variables.push({ name: "x(" + (r + 1) + ",1) … x(" + (r + 1) + "," + s.w + ")", domain: dom, count: cnt }); }
    constraints.push("Luật " + RULES[s.rule].name + " (" + RULES[s.rule].note + "), " + TOPO_NAME[s.topo] + ": mỗi ô một phương trình mod " + s.k + " — tổng (số lần bấm các ô có mẫu chạm tới ô này, nhân hệ số trùng) ≡ (" + s.k + " − mức ô) mod " + s.k + ". x = số lần bấm ô." + (s.holes.length ? " Ô khoá không có biến lẫn phương trình." : ""));
    var cap = n <= 40 ? n : 12;
    for (i = 0; i < cap; i++) constraints.push(equationOf(s, sys, a.v, i));
    if (cap < n) constraints.push("… và " + (n - cap) + " phương trình khác cùng dạng (mỗi ô một phương trình).");
    var summary = n + " biến (số lần bấm mỗi ô, mod " + s.k + ") và " + n + " phương trình — hệ A·x = −b trên GF(" + s.k + "). Hạng " + an.rank + ", nhân " + an.nullity + " chiều; " +
      (an.status === "none" ? "bàn này KHÔNG giải được (b ngoài ảnh của A)." : (isFinite(an.count) ? an.count : "rất nhiều") + " nghiệm" + (an.count > 1 ? " (cùng đúng, ít nhất " + an.weight + " lần bấm)" : ", cần " + an.weight + " lần bấm") + ".");
    return { summary: summary, variables: variables, constraints: constraints, counts: { variables: n, constraints: n, rank: an.rank, nullity: an.nullity, solutions: an.count, minPresses: an.weight },
      sections: silentSections(s, a.v, an) };
  }

  function trace(puzzle) {
    var a = analyze(puzzle);
    if (!a.ok) return { kind: "matrix", title: "Khử Gauss", steps: [], note: "Đề không hợp lệ." };
    var s = a.spec, p = s.k, sys = sysOf(s), n = sys.n, cap = Math.max(8, Math.min(60, Math.floor(40000 / (n * (n + 1))))), steps = [], pivots = 0, stop = false, i, j, q;
    var M = [];
    for (i = 0; i < n; i++) { M.push(new Array(n + 1).fill(0)); M[i][n] = (p - a.v[sys.cells[i]]) % p; }
    for (j = 0; j < n; j++) for (q = 0; q < sys.eff[j].length; q++) M[sys.eff[j][q][0]][j] = sys.eff[j][q][1];
    function snap() { return M.map(function (row) { return row.slice(); }); }
    steps.push({ text: "Ma trận mở rộng [A | −b] mod " + p + ": hàng i = phương trình của ô i; cột j = ô j (số lần bấm), cột cuối = (" + p + " − mức ô) mod " + p + ".", matrix: snap() });
    var r = 0, totalPivots = 0, swappedAny;
    for (var c = 0; c < n && r < n; c++) {
      var pr = -1; for (i = r; i < n; i++) if (M[i][c]) { pr = i; break; }
      if (pr < 0) continue;
      var swapped = -1; if (pr !== r) { var tmp = M[pr]; M[pr] = M[r]; M[r] = tmp; swapped = pr; }
      var iv = inv(M[r][c], p); if (iv !== 1) for (j = 0; j <= n; j++) M[r][j] = (M[r][j] * iv) % p;
      var elim = 0;
      for (i = 0; i < n; i++) if (i !== r && M[i][c]) { var f = M[i][c]; for (j = 0; j <= n; j++) M[i][j] = (M[i][j] + (p - f) * M[r][j]) % p; elim++; }
      r++; totalPivots++;
      if (stop) continue;
      if (steps.length >= cap - 1) { stop = true; continue; }
      steps.push({ text: "Cột " + (c + 1) + " (ẩn " + cellName(s.w, sys.cells[c]) + "): " + (swapped >= 0 ? "đổi chỗ hàng " + (swapped + 1) + " lên hàng " + r + " để có pivot; " : "pivot đã ở hàng " + r + "; ") + (p === 2 ? "" : "nhân hàng cho pivot = 1; ") + "trừ bội của hàng pivot khỏi " + elim + " hàng khác có phần tử khác 0 ở cột này.", matrix: snap(), pivot: [r - 1, c] });
      pivots++;
    }
    var consistent = true; for (i = r; i < n; i++) if (M[i][n]) consistent = false;
    var truncated = pivots < totalPivots, nul = n - r;
    var kern = nul ? " Hạt nhân " + nul + " chiều: mỗi ẩn tự do cho một MẪU BẤM IM LẶNG — xem ở Constraint View." : " Hạt nhân 0 chiều: không có mẫu im lặng nên bàn cùng cấu hình nào cũng giải được và lời giải duy nhất.";
    if (!consistent) { var an0 = analyse(s, a.v); if (an0.obstruction) kern += " " + obstructionText(s, an0.obstruction); }
    if (!truncated) {
      var tail = consistent ? "Xong: hạng " + r + ", nhân " + nul + " chiều. Mọi hàng còn lại đều dạng [0 … 0 | 0] nên hệ có nghiệm." : "Xong: hạng " + r + ", nhân " + nul + " chiều. Có hàng dạng [0 … 0 | khác 0] nên hệ VÔ NGHIỆM — bàn này không thể về 0 hết.";
      tail += kern;
      if (steps.length < cap) steps.push({ text: tail, matrix: snap() }); else steps[steps.length - 1].text += " " + tail;
    }
    var note = "Khử Gauss–Jordan trên GF(" + p + "): cộng/trừ hàng theo mod " + p + ". " + n + " hàng × " + (n + 1) + " cột.";
    if (truncated) note += " Chỉ ghi " + steps.length + " bước đầu (" + pivots + "/" + totalPivots + " pivot) để gọn." + kern;
    return { kind: "matrix", title: "Khử Gauss trên GF(" + p + ") — [A | −b] của bàn " + s.w + "×" + s.h + " (" + RULES[s.rule].name + ")", steps: steps, truncated: truncated, note: note, rank: r, nullity: nul, solvable: consistent };
  }

  // ---------------------------------------------------------------- nhập / xuất
  function ch(v, k) { return v === 0 ? "." : k === 2 ? "#" : String(v); }
  function toText(puzzle) {
    var a = analyze(puzzle); if (!a.ok) return "";
    var s = a.spec, rows = ["@ rule=" + s.rule + " topo=" + s.topo + " k=" + s.k], r, c;
    for (r = 0; r < a.h; r++) { var t = []; for (c = 0; c < a.w; c++) t.push(s.holeSet[r * a.w + c] ? "X" : ch(a.v[r * a.w + c], s.k)); rows.push(t.join(" ")); }
    return rows.join("\n");
  }
  function fromText(text) {
    try {
      if (typeof text !== "string") return badInput("Cần một chuỗi văn bản.");
      var raw = text.replace(/\r/g, "").split("\n"), rule = "cross", topo = "flat", k = null, lines = [], li;
      for (li = 0; li < raw.length; li++) {
        var ln = raw[li].trim();
        if (ln.charAt(0) === "@") {
          ln.slice(1).split(/\s+/).forEach(function (tok) {
            var m = /^(rule|topo|k)=([A-Za-z0-9]+)$/.exec(tok); if (!m) return;
            if (m[1] === "rule") rule = m[2]; else if (m[1] === "topo") topo = m[2]; else k = toInt(m[2]);
          });
          continue;
        }
        ln = ln.replace(/[\s|,;│]/g, "");
        if (ln.length) lines.push(ln);
      }
      if (!lines.length) return badInput("Văn bản rỗng.");
      var maxLevel = 1, v = [], holes = [], idx = 0, kk;
      for (li = 0; li < lines.length; li++) for (kk = 0; kk < lines[li].length; kk++) {
        var c = lines[li].charAt(kk);
        if (c === "#" || c === "1") v.push(1);
        else if (c === "." || c === "0" || c === "-" || c === "_") v.push(0);
        else if (c === "X" || c === "x") { holes.push(idx); v.push(0); }
        else if (c >= "2" && c <= "9") { v.push(Number(c)); if (Number(c) > maxLevel) maxLevel = Number(c); }
        else return badInput("Ký tự lạ \"" + c + "\" — dùng . (0), # hoặc số (mức), X (ô khoá).");
        idx++;
      }
      if (k == null) k = maxLevel >= 2 ? (maxLevel <= 2 ? 3 : maxLevel <= 4 ? 5 : 5) : 2;
      var w, h;
      if (lines.length > 1) { h = lines.length; w = lines[0].length; for (li = 0; li < lines.length; li++) if (lines[li].length !== w) return badInput("Các dòng phải cùng độ dài: dòng 1 có " + w + " ô nhưng dòng " + (li + 1) + " có " + lines[li].length + " ô."); }
      else { w = Math.round(Math.sqrt(v.length)); h = w; if (w * h !== v.length) return badInput("Nhập một dòng thì số ô (" + v.length + ") phải là số chính phương; bàn chữ nhật hãy nhập mỗi hàng một dòng."); }
      return fromInput({ w: w, h: h, rule: rule, topo: topo, k: k, holes: holes, v: v });
    } catch (e) { return badInput("Không đọc được văn bản: " + (e && e.message ? e.message : e)); }
  }
  function boardStr(a) { var o = ""; for (var i = 0; i < a.v.length; i++) o += a.spec.holeSet[i] ? "x" : String(a.v[i]); return o; }
  function toFile(puzzle) {
    if (!puzzle || typeof puzzle !== "object") return { type: ID, seed: null, difficulty: 0, size: { w: 0, h: 0 }, initialState: "", solution: "", metadata: {} };
    var a = analyze(puzzle), d = puzzle.data || {};
    return { type: ID, seed: puzzle.seed == null ? null : puzzle.seed, difficulty: puzzle.score, size: { w: a.w || (puzzle.size && puzzle.size.w), h: a.h || (puzzle.size && puzzle.size.h) },
      initialState: a.ok ? boardStr(a) : "", solution: puzzle.solution ? zeros(a.N || 0).map(String).join("") : "",
      metadata: { name: puzzle.meta && puzzle.meta.name, source: puzzle.meta && puzzle.meta.source, note: puzzle.meta && puzzle.meta.note, tier: puzzle.tier, w: a.w, h: a.h,
        rule: a.ok ? a.spec.rule : d.rule, topo: a.ok ? a.spec.topo : d.topo, k: a.ok ? a.spec.k : d.k, holes: a.ok ? a.spec.holes.slice() : [], presses: Array.isArray(d.presses) ? d.presses.slice() : null } };
  }
  function fromFile(obj) {
    try {
      if (!obj || typeof obj !== "object") return badInput("Tệp không phải một đối tượng JSON.");
      if (obj.type === undefined || obj.type === null) return badInput("Tệp thiếu trường type (cần \"lightsoutx\").");
      if (obj.type !== ID) return badInput("Tệp này không phải đề Lights Out biến thể (type = " + JSON.stringify(obj.type) + ").");
      var s = obj.initialState;
      if (typeof s !== "string" || !s.length) return badInput("Thiếu initialState (chuỗi mức 0…4 độ dài w×h, x = ô khoá).");
      if (!/^[0-4xX]+$/.test(s)) return badInput("initialState chỉ được gồm ký tự 0…4 và x.");
      var sz = obj.size, w = toInt(sz && typeof sz === "object" ? sz.w : sz), h = toInt(sz && typeof sz === "object" ? sz.h : sz), md = obj.metadata && typeof obj.metadata === "object" ? obj.metadata : {};
      if (w == null && h == null) { w = Math.round(Math.sqrt(s.length)); h = w; }
      if (w == null || h == null) return badInput("Thiếu kích thước bàn (size.w và size.h).");
      if (w * h !== s.length) return badInput("initialState có " + s.length + " ký tự, không khớp bàn " + w + "×" + h + ".");
      var out = fromInput({ w: w, h: h, rule: md.rule == null ? "cross" : md.rule, topo: md.topo == null ? "flat" : md.topo, k: md.k == null ? 2 : md.k, v: s, meta: md });
      if (out.puzzle && typeof obj.seed === "number" && isFinite(obj.seed)) out.puzzle.seed = R.seedOf(obj.seed);
      return { ok: out.ok, puzzle: out.puzzle, errors: out.errors, warnings: out.warnings };
    } catch (e) { return badInput("Không đọc được tệp: " + (e && e.message ? e.message : e)); }
  }

  // ---------------------------------------------------------------- par + điểm tối ưu (mục 11.4)
  function parOf(puzzle) {
    var d = puzzle && puzzle.data;
    if (d && Array.isArray(d.presses)) return d.presses.length;
    var a = analyze(puzzle); if (!a.ok) return 0;
    var an = analyse(a.spec, a.v); return an.status === "none" ? 0 : an.weight;
  }
  function parStars(moves, K) { return moves <= K ? 3 : moves <= K + Math.ceil(K / 4) ? 2 : 1; }
  function grade(puzzle, state, counters) {
    var K = parOf(puzzle), est = puzzle && puzzle.data && puzzle.data.exact === false, moves = counters && typeof counters.moves === "number" && isFinite(counters.moves) ? Math.max(0, Math.floor(counters.moves)) : 0;
    var G = P.grade, solved = check(puzzle, state).solved;
    if (!K) return { value: moves, best: null, quality: 0, stars: 0, valueText: String(moves), bestText: "—", text: "Bàn này không có par" };
    var g = G.fromRatio(moves, K, "min");
    if (!solved) { g.quality = 0; g.stars = 0; g.text = "Chưa về 0 hết (par " + K + " lần bấm)"; return g; }
    g.stars = parStars(moves, K);
    var over = moves - K;
    g.text = over <= 0 ? "Đúng par: " + K + " lần bấm — " + (est ? "bằng mức tốt nhất app tìm được" : "ít nhất có thể") + "!" : "Hơn par " + over + " lần bấm (par " + K + ")" + (g.stars === 2 ? " — rất gần tối ưu." : ". Thử lại để đạt par?");
    return g;
  }

  // ---------------------------------------------------------------- đăng ký
  var SIZES = [
    { id: "4", label: "4×4", params: { w: 4, h: 4 }, tiers: ["easy", "medium"] },
    { id: "5", label: "5×5", params: { w: 5, h: 5 }, default: true, tiers: ["easy", "medium", "hard"] },
    { id: "6", label: "6×6", params: { w: 6, h: 6 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "7", label: "7×7", params: { w: 7, h: 7 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "8", label: "8×8", params: { w: 8, h: 8 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "9", label: "9×9", params: { w: 9, h: 9 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "10", label: "10×10", params: { w: 10, h: 10 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];

  var def = {
    id: ID, name: "Lights Out biến thể", family: "Mathematical Puzzle", category: "Đại số tuyến tính", icon: "🔆",
    blurb: "Lights Out với luật bấm khác (X, vua, mã…), bàn quấn mép, 3–5 mức đèn và ô khoá — tắt hết với ít lần bấm nhất.",
    rules: [
      "Mỗi ô có một mức 0…k−1 (k = 2: tắt/bật; k = 3 hoặc 5: nhiều mức, bật dần từng nấc). Mục tiêu: đưa MỌI ô về mức 0.",
      "Bấm một ô sẽ cộng 1 (vòng lại về 0 sau mức k−1) vào chính ô đó và các ô thuộc \"mẫu bấm\" của luật đang chọn: chữ thập, chữ X, vua (8 ô xung quanh), quân mã hay chữ thập dài.",
      "Bàn có thể quấn mép (xuyến): ô ở rìa kề với ô ở rìa đối diện. Ô khoá không có đèn, không bấm được và không bị ảnh hưởng.",
      "Thứ tự bấm không quan trọng; bấm một ô k lần thì như không bấm — chỉ cần biết mỗi ô được bấm bao nhiêu lần (mod k).",
      "Đề do app sinh luôn giải được; một bàn có thể có nhiều cách (đều đúng). Par = số lần bấm ít nhất: đúng par ★★★, hơn par không quá một phần tư ★★, còn lại ★ (mọi lần bấm đều tính, kể cả lần đã hoàn tác).",
      "Gợi ý có hai kiểu (công tắc dưới bàn, \"Đuổi đèn\" chỉ dùng với luật chữ thập, bàn phẳng, không ô khoá): \"Ít bấm nhất\" chỉ ô thuộc lời giải ngắn nhất; \"Đuổi đèn\" dạy cách giải bằng tay.",
      "Bàn tự nhập (tối đa 20×20) có thể không giải được — app chỉ ra nhóm ô và trọng số làm tổng bất biến (khác 0) để chứng minh điều đó."
    ],
    sizes: SIZES,
    options: [
      { id: "rule", label: "Luật bấm", choices: [
        { id: "cross", label: "Chữ thập", note: "Như Lights Out cổ điển: ô đó và bốn ô kề." }, { id: "x", label: "Chữ X", note: "Ô đó và bốn ô chéo." },
        { id: "king", label: "Vua", note: "Ô đó và tám ô xung quanh." }, { id: "knight", label: "Quân mã", note: "Ô đó và tám ô cách một nước đi của quân mã." },
        { id: "plus2", label: "Chữ thập dài", note: "Ô đó và hai ô mỗi hướng." }], default: "cross" },
      { id: "topo", label: "Mép bàn", choices: [{ id: "flat", label: "Có mép" }, { id: "torus", label: "Quấn mép", note: "Xuyến: rìa trái nối rìa phải, rìa trên nối rìa dưới." }], default: "flat" },
      { id: "k", label: "Số mức", choices: [{ id: "2", label: "2 (bật/tắt)" }, { id: "3", label: "3 mức", note: "Bấm cộng 1 mod 3." }, { id: "5", label: "5 mức", note: "Bấm cộng 1 mod 5." }], default: "2" },
      { id: "holes", label: "Ô khoá", choices: [{ id: "none", label: "Không" }, { id: "few", label: "Vài ô" }, { id: "some", label: "Nhiều ô" }], default: "none" }
    ],
    sizeText: function (p) {
      var a = p && p.data && typeof p.data === "object" ? p.data : null; if (!a) return "";
      var ms = makeSpec(toInt(a.w), toInt(a.h), a.rule == null ? "cross" : a.rule, a.topo == null ? "flat" : a.topo, a.k == null ? 2 : toInt(a.k), a.holes || []);
      return ms.spec ? ms.spec.w + "×" + ms.spec.h + " · " + specText(ms.spec) : "";
    },
    algorithm: {
      title: "Khử Gauss mod k cho Lights Out biến thể",
      steps: [
        { title: "Bấm k lần là không bấm", text: "Bấm một ô là cộng 1 (mod k) vào mẫu bấm của nó; bấm k lần huỷ nhau và thứ tự không quan trọng. Một lời giải là một vector x: mỗi ô một ẩn x ∈ {0, …, k−1} = số lần bấm." },
        { title: "Hệ tuyến tính A·x = −b trên GF(k)", text: "Ô i về 0 khi Σ A[i][j]·x_j + b_i ≡ 0 (mod k), A[i][j] = số lần ô i được cộng khi bấm ô j (xuyến nhỏ có thể trùng ô nên cộng dồn). k = 2, 3, 5 là số nguyên tố nên Z_k là TRƯỜNG: chia được cho mọi phần tử khác 0, khử Gauss hoạt động như trên số thực." },
        { title: "Khử một lần, nhớ ma trận biến đổi", text: "Khử Gauss–Jordan trên [A | I] đưa A về dạng bậc thang rút gọn R và để lại E với E·A = R. Mỗi bàn mới chỉ cần y = E·(−b): vô nghiệm nếu y còn thành phần khác 0 ở hàng không có pivot, ngược lại ẩn pivot = y và ẩn tự do = 0. Bàn 20×20 mod 3 khử đầy đủ mất cỡ trăm mili giây, nhớ lại thì mỗi bàn chỉ O(n²)." },
        { title: "Hạt nhân và nghiệm ít bấm nhất", text: "Hạt nhân (A·x = 0) có N − r chiều; bàn giải được thì có đúng k^(N − r) nghiệm, mỗi nghiệm khác nhau một vector hạt nhân. Thử mọi tổ hợp hạt nhân (đồng hồ số hỗn hợp, mỗi bước cộng một vector) và giữ cách có Σ x nhỏ nhất. Hạt nhân quá lớn thì chỉ leo đồi và đánh dấu \"chưa chắc ít nhất\"." },
        { title: "Bất biến khi vô nghiệm", text: "A đối xứng nên ker Aᵀ = ker A. Bàn vô nghiệm ⇔ có y trong hạt nhân với y·b ≢ 0 (mod k): tổng Σ y_i·(mức ô i) không đổi sau mọi lần bấm (vì y·A = 0), bàn tắt hết có tổng 0 — mâu thuẫn. App chọn y ít ô nhất để lời giải thích ngắn gọn." }
      ],
      links: [{ id: "gaussian-elimination", label: "Khử Gauss (giải hệ tuyến tính; ở đây mod k, có bộ nhớ đệm ma trận biến đổi)" }, { id: "bit-manipulation", label: "Thao tác bit — XOR (trường hợp k = 2)" }]
    },
    difficultyNote: "Điểm 0–10 = 10 × min(1, K/Kref) × min(1, gain). K = số lần bấm TỐI THIỂU do khử Gauss tính ra (không phải số lần bấm ngẫu nhiên lúc sinh đề); Kref = 0,8 × ρ × (số ô thật) với ρ = số bấm tối thiểu điển hình trên mỗi ô, đo riêng cho từng (luật, mép, k) — nên luật có mẫu rộng hay nhiều mức vẫn với tới mọi bậc; gain = (0,65 + 0,35 × min(1, (ô − 4)/45)) × (1 ; 1,05 ; 1,1 cho k = 2 ; 3 ; 5) làm bàn nhỏ khó chạm bậc Chuyên gia.",
    objective: { sense: "min", label: "Số lần bấm (par = ít nhất)", unit: "lần bấm" },
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty, newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes,
    hint: hint, replay: replay, constraintView: constraintView, trace: trace, describeCell: describeCell, toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText, grade: grade
  };
  def.MIN_D = MIN_D; def.MAX_D = MAX_D; def.GEN_MAX = GEN_MAX;
  /** Hàm thuần cho bàn/trình soạn/test (không thuộc hợp đồng chung). spec = { w, h, rule, topo, k, holes }.
      effect(puzzle, i) → [[ô, số lần cộng]]; effectSpec(spec, i); obstruction(spec, v) → {cells, weights, size, sum, text, …} | null; chaseOk(spec); chaseStep(w,h,k,v); chaseTop; chaseDown;
      par(puzzle); parStars; specOf(input) → {spec}|{error}; specText; RULES/RULE_IDS; analyse(spec, v) (đầy đủ, cho test). */
  def.lib = {
    makeSpec: makeSpec, specText: specText, RULES: RULES, RULE_IDS: RULE_IDS, TOPO_NAME: TOPO_NAME, KS: KS,
    effectSpec: effectOf,
    effect: function (puzzle, i) { var a = analyze(puzzle); return a.ok ? effectOf(a.spec, i) : []; },
    obstruction: function (specIn, v) {
      var ms = makeSpec(specIn.w, specIn.h, specIn.rule, specIn.topo, specIn.k, specIn.holes);
      if (ms.error || !Array.isArray(v) || v.length !== ms.spec.N) return null;
      var an = analyse(ms.spec, v); return an.obstruction ? obstructionInfo(ms.spec, an.obstruction) : null;
    },
    analyse: function (specIn, v) { var ms = makeSpec(specIn.w, specIn.h, specIn.rule, specIn.topo, specIn.k, specIn.holes); return ms.error ? null : analyse(ms.spec, v); },
    scoreOf: function (specIn, K) { var ms = makeSpec(specIn.w, specIn.h, specIn.rule, specIn.topo, specIn.k, specIn.holes); return ms.error ? 0 : scoreOf(ms.spec, sysOf(ms.spec).n, K); },
    chaseOk: function (specIn) { var ms = makeSpec(specIn.w, specIn.h, specIn.rule, specIn.topo, specIn.k, specIn.holes); return !ms.error && chaseOk(ms.spec); },
    chaseStep: chaseStep, chaseTop: chaseTop, chaseDown: chaseDown, par: parOf, parStars: parStars, hintStyle: hintStyle,
    randomPresses: function (specIn, m, rngSeed) {
      var ms = makeSpec(specIn.w, specIn.h, specIn.rule, specIn.topo, specIn.k, specIn.holes); if (ms.error) return null;
      var s = ms.spec, sys = sysOf(s), rr = R.create(rngSeed), list = [], i;
      for (i = 0; i < m; i++) list.push(sys.cells[rr.int(sys.n)]);
      return applyPressList(s, zeros(s.N), list);
    }
  };
  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
