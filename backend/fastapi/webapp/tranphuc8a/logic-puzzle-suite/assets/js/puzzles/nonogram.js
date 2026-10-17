/* puzzles/nonogram.js — ENGINE NONOGRAM (thuần, không DOM; chạy trong node và Web Worker). Xem HUONG-DAN-ENGINE.md.

   Bài toán: lưới w×h, mỗi hàng/cột có clue = dãy độ dài các khối ô tô liên tiếp (giữa hai khối có ≥ 1 ô trống). Tô các ô sao cho mọi hàng và cột khớp clue.

   Biểu diễn
     state.v[i], i = hàng*w + cột:  0 chưa biết · 1 tô · 2 gạch (đánh dấu trống).  initial.v toàn 0 (không có ô cho sẵn, isGiven luôn false).
     puzzle.data = { w, h, rows:[[…]…h], cols:[[…]…w] }; hàng/cột không có khối nào ghi [] (nhập [0] cũng được, sẽ đổi về []).
     puzzle.solution.v = ảnh đáp án: 1 = tô, 2 = trống (để Reveal điền cả ô gạch). Đề tự nhập có thể nhiều nghiệm: solution là MỘT trong số đó.

   Action (UI → engine)
     { k:"fill", cells:[i…], val:0|1|2 }       áp cùng một giá trị cho nhiều ô (kéo ngón tay); bỏ qua ô đã đúng giá trị
     { k:"cycle", i }                          0 → 1 → 2 → 0
     { k:"clearline", axis:"r"|"c", idx }      xoá mọi ô của một hàng/cột về 0

   Thiết kế bộ giải (chọn để vừa nhanh vừa GIẢI THÍCH ĐƯỢC)
     1. Một dòng (hàng hoặc cột) dài n với các ô đã biết: quy hoạch động hai chiều (tiền tố × số khối đã đặt, rồi hậu tố) cho biết, với MỖI ô, có cách đặt hợp lệ nào
        để nó tô / để nó trống không → giao của mọi cách đặt = các ô BẮT BUỘC tô / BẮT BUỘC trống. O(n·k), n ≤ 25 nên cỡ micro-giây; cũng cho vị trí sớm nhất/muộn nhất
        của từng khối (dùng để gán nhãn kỹ thuật: chồng lấn, khối đã chốt, ô không với tới …).
     2. Lan truyền: lặp mọi dòng "bẩn" tới điểm cố định (theo VÒNG: mỗi vòng quét các dòng bẩn; số vòng = độ sâu phụ thuộc giữa hàng và cột).
     3. Còn ô chưa biết → quay lui: chọn dòng "hay gây mâu thuẫn mà còn ít ô chưa biết" (dom/wdeg), thử giá trị nhiều khả năng trước, lan truyền, đếm nghiệm tới `limit`.
        Số lần chọn ô (decisions) = số lần "phải đoán". Đề tự nhập kiểu ảnh nhiễu 25×25 có thể khó đếm hết: ngân sách ĐẾM được (số lần giải dòng `maxWork`, số nút `maxNodes`)
        cạn thì báo "multiple + exhausted" (chưa xác định hết) thay vì treo.
   Mỗi suy luận dòng được gán nhãn kỹ thuật gần đúng (xem TECH) — dùng cho steps/techniques, hint, replay và điểm khó.

   Điểm khó 0–10 (xem scoreOf): kích thước + chi phí kỹ thuật theo dòng + số vòng lan truyền + ô còn lại sau logic + số lần đoán. Ghi trong difficultyNote.
   Sinh đề: ảnh ngẫu nhiên (hình + nhiễu theo "knob" 0..1) → ép duy nhất bằng cách lật ô khác biệt → chấm điểm → chỉnh knob theo bậc mục tiêu; ngân sách là số lần thử và tổng số lần giải dòng.
   Mọi hàm thuần và tất định (không Math.random / Date): cùng đầu vào → cùng kết quả từng bit. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var MAXN = 25, MINN = 2;

  /* ======================================================================================================= */
  /*  Kỹ thuật dòng — id, tên tiếng Việt, trọng số độ khó                                                       */
  /* ======================================================================================================= */
  var TECH = {
    empty: { name: "Dòng trống", w: 0 },
    exact: { name: "Vừa khít", w: 0.3 },
    complete: { name: "Dòng đã đủ", w: 0.3 },
    overlap: { name: "Chồng lấn", w: 1 },
    anchor: { name: "Khối đã chốt vị trí", w: 1 },
    unreachable: { name: "Ô không với tới", w: 1 },
    intersect: { name: "Giao mọi cách đặt", w: 2 },
    probe: { name: "Giả định phản chứng", w: 4 },
    guess: { name: "Đoán", w: 5 }
  };

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lineLabel(axis, idx) { return (axis === "r" ? "hàng " : "cột ") + (idx + 1); }
  function clueStr(B) { return B.length ? B.join(" ") : "0"; }
  /** Vị trí 0-based tăng dần → "2–6, 9" (1-based). */
  function posText(list) {
    var out = [], i = 0, j;
    while (i < list.length) {
      j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      out.push(j > i ? (list[i] + 1) + "–" + (list[j] + 1) : String(list[i] + 1));
      i = j + 1;
    }
    return out.join(", ");
  }
  function cellWord(list) { return (list.length === 1 ? "ô " : "các ô ") + posText(list); }
  /** Khoảng ô 1-based "a–b" (một ô thì chỉ "a"). */
  function span(a, b) { return a === b ? String(a) : a + "–" + b; }

  /* ======================================================================================================= */
  /*  Bộ giải một dòng                                                                                          */
  /* ======================================================================================================= */
  var S_N = 0, S_K = 0, PRE, SUF, CNT, CANF, CANE, MINS, MAXS, COV, LINE;
  function ensure(n, k) {
    if (n <= S_N && k <= S_K) return;
    S_N = Math.max(n, S_N, 32); S_K = Math.max(k, S_K, 17);
    PRE = new Uint8Array((S_K + 1) * (S_N + 2)); SUF = new Uint8Array((S_K + 1) * (S_N + 2));
    CNT = new Int16Array(S_N + 2); CANF = new Uint8Array(S_N + 1); CANE = new Uint8Array(S_N + 1);
    MINS = new Int16Array(S_K + 1); MAXS = new Int16Array(S_K + 1); COV = new Int16Array(S_N + 2); LINE = new Uint8Array(S_N + 1);
  }

  /** Dòng dài n, clue B (mảng số), ô đã biết L (0/1/2). Trả false nếu KHÔNG có cách đặt nào hợp lệ.
      Nếu có: CANF[c]=1 nếu có cách đặt làm ô c được tô; CANE[c]=1 nếu có cách đặt làm ô c trống; MINS/MAXS[j] = vị trí đầu sớm nhất/muộn nhất của khối j. */
  function lineSolve(n, B, L) {
    var k = B.length, W, j, p, s, b, e, v, c, run, okc, ce, mn, mx;
    ensure(n, k);
    W = n + 2;
    CNT[0] = 0; for (c = 0; c < n; c++) CNT[c + 1] = CNT[c] + (L[c] === 2 ? 1 : 0);
    // PRE[j][p]: ô [0,p) xếp được j khối đầu và ô p-1 là ô ngăn (không tô); thêm một ô ảo trống ở vị trí n
    for (j = 0; j <= k; j++) PRE[j * W] = j === 0 ? 1 : 0;
    for (p = 1; p <= n + 1; p++) {
      okc = p - 1 === n ? true : L[p - 1] !== 1;
      for (j = 0; j <= k; j++) {
        v = 0;
        if (okc) {
          if (PRE[j * W + p - 1]) v = 1;
          else if (j > 0) { b = B[j - 1]; s = p - 1 - b; if (s >= 0 && PRE[(j - 1) * W + s] && CNT[s + b] === CNT[s]) v = 1; }
        }
        PRE[j * W + p] = v;
      }
    }
    // SUF[j][p]: ô [p,n] (kể cả ô ảo) xếp được các khối j.. còn lại, với ô p-1 là ô ngăn (hoặc p = 0)
    for (j = 0; j <= k; j++) SUF[j * W + n + 1] = j === k ? 1 : 0;
    for (p = n; p >= 0; p--) {
      okc = p === n ? true : L[p] !== 1;
      for (j = k; j >= 0; j--) {
        v = 0;
        if (okc && SUF[j * W + p + 1]) v = 1;
        else if (j < k) { b = B[j]; e = p + b; if (e <= n && CNT[e] === CNT[p] && (e === n || L[e] !== 1) && SUF[(j + 1) * W + e + 1]) v = 1; }
        SUF[j * W + p] = v;
      }
    }
    if (!SUF[0]) return false;
    for (c = 0; c <= n; c++) COV[c] = 0;
    for (j = 0; j < k; j++) {
      b = B[j]; mn = -1; mx = -1;
      for (s = 0; s + b <= n; s++) {
        if (PRE[j * W + s] && CNT[s + b] === CNT[s] && (s + b === n || L[s + b] !== 1) && SUF[(j + 1) * W + s + b + 1]) {
          if (mn < 0) mn = s;
          mx = s; COV[s]++; COV[s + b]--;
        }
      }
      MINS[j] = mn; MAXS[j] = mx;
    }
    run = 0;
    for (c = 0; c < n; c++) { run += COV[c]; CANF[c] = run > 0 ? 1 : 0; }
    for (c = 0; c < n; c++) {
      ce = 0;
      for (j = 0; j <= k; j++) if (PRE[j * W + c + 1] && SUF[j * W + c + 1]) { ce = 1; break; }
      CANE[c] = ce;
    }
    return true;
  }

  /* ---- gán nhãn kỹ thuật cho một suy luận dòng (dùng MINS/MAXS của lần lineSolve vừa chạy; L = trạng thái TRƯỚC khi áp) ---- */
  function classify(n, B, L, Fp, Ep) {
    var k = B.length, sum = 0, nk = 0, j, i, c, b, mn, mx, ov, fx, reach, nOv, nOther;
    if (!k) return "empty";
    for (j = 0; j < k; j++) sum += B[j];
    if (sum + k - 1 === n) return "exact";
    for (i = 0; i < n; i++) if (L[i] === 1) nk++;
    if (nk === sum) return "complete";
    ov = []; fx = []; reach = [];
    for (i = 0; i < n; i++) { ov.push(0); fx.push(0); reach.push(0); }
    for (j = 0; j < k; j++) {
      b = B[j]; mn = MINS[j]; mx = MAXS[j];
      for (c = mn; c < mx + b; c++) reach[c] = 1;
      for (c = mx; c < mn + b; c++) { if (mn === mx) fx[c] = 1; else ov[c] = 1; }
    }
    if (Fp.length) {
      nOv = 0; nOther = 0;
      for (i = 0; i < Fp.length; i++) { if (ov[Fp[i]]) nOv++; else if (!fx[Fp[i]]) nOther++; }
      if (nOther) return "intersect";
      return nOv ? "overlap" : "anchor";
    }
    for (i = 0; i < Ep.length; i++) if (reach[Ep[i]]) return "intersect";
    return "unreachable";
  }

  /** Giải thích bằng tiếng Việt: { why:[chuỗi…], text }. Fp/Ep = vị trí (0-based, trong dòng) các ô vừa chốt tô / trống. Dùng MINS/MAXS của lineSolve vừa chạy. */
  function explain(axis, idx, n, B, L, Fp, Ep, tech) {
    var k = B.length, sum = 0, j, c, i, marks = 0, b, mn, mx, why = [], act = [], oc, need, slack, lbl = lineLabel(axis, idx), listed = 0, hit, inF;
    for (j = 0; j < k; j++) sum += B[j];
    need = sum + (k ? k - 1 : 0); slack = n - need;
    for (i = 0; i < n; i++) if (L[i]) marks++;
    if (Fp.length) act.push("tô " + cellWord(Fp));
    if (Ep.length) act.push("gạch (trống) " + cellWord(Ep));
    if (tech === "empty") why.push(cap(lbl) + " có clue 0: không có khối nào, nên mọi ô đều trống.");
    else if (tech === "exact") why.push("Các khối " + clueStr(B) + " cần ít nhất " + sum + " ô tô và " + (k - 1) + " ô trống ngăn cách, tổng " + need + " ô — đúng bằng độ dài " + n + " của " + lbl + ", nên chỉ có một cách đặt.");
    else if (tech === "complete") why.push("Đã có đủ " + sum + " ô tô, khớp tổng clue (" + clueStr(B) + "), nên các ô còn lại của " + lbl + " chắc chắn trống.");
    else if (tech === "overlap" || tech === "anchor") {
      inF = {}; for (i = 0; i < Fp.length; i++) inF[Fp[i]] = 1;
      for (j = 0; j < k; j++) {
        b = B[j]; mn = MINS[j]; mx = MAXS[j];
        if (mx >= mn + b || (tech === "overlap") !== (mn !== mx)) continue;
        oc = []; hit = false;
        for (c = mx; c < mn + b; c++) { oc.push(c); if (inF[c]) hit = true; }
        if (!hit) continue;
        listed++;
        if (tech === "overlap") why.push("Khối thứ " + (j + 1) + " (" + b + " ô) sớm nhất phủ ô " + span(mn + 1, mn + b) + ", muộn nhất phủ ô " + span(mx + 1, mx + b) + " → " + cellWord(oc) + " luôn thuộc khối này.");
        else why.push("Khối thứ " + (j + 1) + " (" + b + " ô) chỉ còn một vị trí hợp lệ là ô " + span(mn + 1, mn + b) + " (nhờ các ô đã biết trong " + lbl + ").");
      }
      if (tech === "overlap" && marks === 0) why.push("Cả dòng dài " + n + " ô, các khối cần tối thiểu " + need + " ô ⇒ dư " + slack + " ô; khối nào dài hơn phần dư thì chắc chắn chồng lấn.");
      if (tech === "anchor" && Ep.length) why.push("Hai ô sát đầu khối đã chốt không thể thuộc khối khác nên phải trống.");
      if (!listed && !why.length) why.push("Dựa trên các ô đã biết, vị trí của khối chỉ còn một cách.");
    } else if (tech === "unreachable") why.push("Không khối nào của clue " + clueStr(B) + " có thể phủ tới " + cellWord(Ep) + " (mọi khối đều phải nằm ngoài các ô này), nên chúng trống.");
    else why.push("Xét mọi cách xếp hợp lệ của clue " + clueStr(B) + " vào " + lbl + " (giữ nguyên các ô đã biết): " + (Fp.length ? cellWord(Fp) + " luôn tô" : "") + (Fp.length && Ep.length ? "; " : "") + (Ep.length ? cellWord(Ep) + " luôn trống" : "") + ".");
    return { why: why, text: cap(lbl) + " (clue " + clueStr(B) + ", " + n + " ô) — " + TECH[tech].name + ": " + act.join("; ") + "." };
  }

  /* ======================================================================================================= */
  /*  Lan truyền theo vòng + tìm kiếm quay lui                                                                  */
  /* ======================================================================================================= */
  function newStats(text, cls) { return { waves: 0, lineSteps: 0, calls: 0, tech: {}, steps: [], text: !!text, cls: !!cls, fail: null, cost: 0 }; }

  /** Áp bộ giải một dòng lên grid. Trả số ô vừa chốt, hoặc -1 nếu dòng KHÔNG xếp được (mâu thuẫn). */
  function applyLine(Q, grid, li, st, dirty, pend) {
    var w = Q.w, h = Q.h, isRow = li < h, idx = isRow ? li : li - h, n = isRow ? w : h, B = isRow ? Q.rows[idx] : Q.cols[idx];
    var base = isRow ? idx * w : idx, stride = isRow ? 1 : w, c, g, Fp = [], Ep = [], cross;
    ensure(n, B.length);
    for (c = 0; c < n; c++) LINE[c] = grid[base + c * stride];
    st.calls++;
    if (!lineSolve(n, B, LINE)) { st.fail = { axis: isRow ? "r" : "c", idx: idx }; return -1; }
    for (c = 0; c < n; c++) {
      if (LINE[c]) continue;
      if (CANF[c] && !CANE[c]) Fp.push(c); else if (CANE[c] && !CANF[c]) Ep.push(c);
    }
    if (!Fp.length && !Ep.length) return 0;
    st.lineSteps++;
    if (st.cls) {
      var tech = classify(n, B, LINE, Fp, Ep), step;
      st.tech[tech] = (st.tech[tech] || 0) + 1; st.cost += TECH[tech].w;
      step = { axis: isRow ? "r" : "c", idx: idx, technique: tech, wave: st.waves, fills: [], empties: [] };
      for (g = 0; g < Fp.length; g++) step.fills.push(base + Fp[g] * stride);
      for (g = 0; g < Ep.length; g++) step.empties.push(base + Ep[g] * stride);
      if (st.text) { var ex = explain(step.axis, idx, n, B, LINE, Fp, Ep, tech); step.text = ex.text; step.why = ex.why; }
      st.steps.push(step);
    }
    for (g = 0; g < Fp.length; g++) { c = Fp[g]; grid[base + c * stride] = 1; cross = isRow ? h + c : c; if (!pend[cross]) dirty[cross] = 1; }
    for (g = 0; g < Ep.length; g++) { c = Ep[g]; grid[base + c * stride] = 2; cross = isRow ? h + c : c; if (!pend[cross]) dirty[cross] = 1; }
    return Fp.length + Ep.length;
  }

  /** Lan truyền tới điểm cố định. dirty[li] = 1 cho dòng cần xét (hàng 0..h-1, cột h..h+w-1). false nếu mâu thuẫn (st.fail ghi dòng hỏng). */
  function propagate(Q, grid, dirty, st) {
    var nl = Q.h + Q.w, pend = new Uint8Array(nl), list, li, a;
    for (;;) {
      list = [];
      for (li = 0; li < nl; li++) if (dirty[li]) { list.push(li); pend[li] = 1; dirty[li] = 0; }
      if (!list.length) return true;
      st.waves++;
      for (a = 0; a < list.length; a++) {
        li = list[a]; pend[li] = 0;
        if (applyLine(Q, grid, li, st, dirty, pend) < 0) return false;
      }
    }
  }

  function countZero(g) { var n = 0; for (var i = 0; i < g.length; i++) if (!g[i]) n++; return n; }

  /** Ô để thử khi bế tắc: dòng có (trọng số lỗi + 1) / (số ô chưa biết) lớn nhất (dom/wdeg; wt = null → dòng ít ô chưa biết nhất), lấy ô chưa biết đầu tiên của nó. -1 nếu đã đầy. */
  function pickBranch(Q, grid, wt) {
    var w = Q.w, h = Q.h, best = -1, bestS = -1, r, c, u, s;
    for (r = 0; r < h; r++) { u = 0; for (c = 0; c < w; c++) if (!grid[r * w + c]) u++; if (u) { s = ((wt ? wt[r] : 0) + 1) / u; if (s > bestS) { bestS = s; best = r; } } }
    for (c = 0; c < w; c++) { u = 0; for (r = 0; r < h; r++) if (!grid[r * w + c]) u++; if (u) { s = ((wt ? wt[h + c] : 0) + 1) / u; if (s > bestS) { bestS = s; best = h + c; } } }
    if (best < 0) return -1;
    if (best < h) { for (c = 0; c < w; c++) if (!grid[best * w + c]) return best * w + c; }
    else for (r = 0; r < h; r++) if (!grid[r * w + best - h]) return r * w + best - h;
    return -1;
  }
  /** Thứ tự thử giá trị cho ô: giá trị "nhiều khả năng" trước — ước lượng mật độ tô còn lại của hàng và cột chứa ô (dưới 1/2 → thử trống trước). */
  function valueOrder(Q, g, cell) {
    var w = Q.w, h = Q.h, r = Math.floor(cell / w), c = cell - r * w, sr = 0, kr = 0, ur = 0, sc = 0, kc = 0, uc = 0, i, v, p;
    for (i = 0; i < Q.rows[r].length; i++) sr += Q.rows[r][i];
    for (i = 0; i < Q.cols[c].length; i++) sc += Q.cols[c][i];
    for (i = 0; i < w; i++) { v = g[r * w + i]; if (v === 1) kr++; else if (!v) ur++; }
    for (i = 0; i < h; i++) { v = g[i * w + c]; if (v === 1) kc++; else if (!v) uc++; }
    p = ((sr - kr) / Math.max(1, ur) + (sc - kc) / Math.max(1, uc)) / 2;
    return p < 0.5 ? [2, 1] : [1, 2];
  }

  /** Phân tích đầy đủ một đề Q = {w,h,rows,cols}: lan truyền gốc, rồi quay lui đếm nghiệm tới o.limit.
      o: { limit=2, maxNodes=60000, maxWork=28000 (số lần giải một dòng — ngân sách ĐẾM được, không dựa vào thời gian; ≈ 0,5 s ở cỡ 25×25), text (sinh lời giải thích), cls=true (gán nhãn kỹ thuật),
           known (Uint8Array ô đã biết ban đầu), keep (số nghiệm giữ lại), rootOnly (chỉ lan truyền gốc, không quay lui) }
      Trả: { count, solutions:[Uint8Array…], nodes, calls, decisions, depth, waves, rootUnknown, rootGrid, exhausted, fail, st (thống kê gốc), path (các lần đoán trên đường tới nghiệm đầu tiên) }.
      Quay lui dùng dom/wdeg (dòng hay gây mâu thuẫn được ưu tiên) và thử giá trị nhiều khả năng trước; cạn ngân sách → exhausted (chưa xác định hết). */
  function analyze(Q, o) {
    o = o || {};
    var limit = o.limit || 2, maxNodes = o.maxNodes || 60000, maxWork = o.maxWork || 28000, keep = o.keep == null ? limit : o.keep, w = Q.w, h = Q.h, N = w * h, nl = h + w, i;
    var res = { count: 0, solutions: [], nodes: 0, calls: 0, decisions: 0, depth: 0, waves: 0, rootUnknown: N, rootGrid: null, exhausted: false, fail: null, st: null, path: null };
    var grid = new Uint8Array(N), dirty = new Uint8Array(nl), st = newStats(o.text, o.cls !== false), nst = newStats(false, false), path = [], wt = [];
    for (i = 0; i < nl; i++) wt.push(0);
    if (o.known) for (i = 0; i < N; i++) grid[i] = o.known[i] || 0;
    for (i = 0; i < nl; i++) dirty[i] = 1;
    res.st = st;
    if (!propagate(Q, grid, dirty, st)) { res.fail = st.fail; res.waves = st.waves; res.calls = st.calls; return res; }
    res.waves = st.waves; res.rootGrid = new Uint8Array(grid); res.rootUnknown = countZero(grid);
    if (o.rootOnly) { res.count = res.rootUnknown ? 0 : 1; res.exhausted = res.rootUnknown > 0; res.calls = st.calls; return res; }
    function rec(g, depth) {
      var cell = pickBranch(Q, g, wt), vals, vi, g2, d2, r, c;
      if (cell < 0) { res.count++; if (res.solutions.length < keep) res.solutions.push(g); if (!res.path) res.path = path.slice(); return; }
      res.decisions++; if (depth + 1 > res.depth) res.depth = depth + 1;
      r = Math.floor(cell / w); c = cell - r * w; vals = valueOrder(Q, g, cell);
      for (vi = 0; vi < 2; vi++) {
        if (res.count >= limit || res.exhausted) return;
        if (res.nodes >= maxNodes || st.calls + nst.calls > maxWork) { res.exhausted = true; return; }
        res.nodes++;
        g2 = new Uint8Array(g); g2[cell] = vals[vi];
        d2 = new Uint8Array(nl); d2[r] = 1; d2[h + c] = 1;
        path.push([cell, vals[vi]]); nst.fail = null;
        if (propagate(Q, g2, d2, nst)) rec(g2, depth + 1);
        else if (nst.fail) wt[nst.fail.axis === "r" ? nst.fail.idx : h + nst.fail.idx]++;
        path.pop();
      }
    }
    rec(grid, 0);
    res.calls = st.calls + nst.calls;
    return res;
  }

  /** Clue của một ảnh nhị phân (1 = tô) w×h hàng-trước. */
  function cluesOf(img, w, h) {
    var rows = [], cols = [], r, c, run, cur;
    for (r = 0; r < h; r++) { cur = []; run = 0; for (c = 0; c < w; c++) { if (img[r * w + c] === 1) run++; else if (run) { cur.push(run); run = 0; } } if (run) cur.push(run); rows.push(cur); }
    for (c = 0; c < w; c++) { cur = []; run = 0; for (r = 0; r < h; r++) { if (img[r * w + c] === 1) run++; else if (run) { cur.push(run); run = 0; } } if (run) cur.push(run); cols.push(cur); }
    return { rows: rows, cols: cols };
  }

  /* ======================================================================================================= */
  /*  Sinh ảnh ngẫu nhiên tất định                                                                              */
  /* ======================================================================================================= */
  /** Đóng một hình (chữ nhật / elip / thanh) giá trị val lên ảnh. minF/maxF = tỉ lệ cạnh so với bàn. */
  function stamp(rng, img, w, h, val, minF, maxF) {
    var kind = rng.int(4), bw = rng.range(Math.max(1, Math.round(w * minF)), Math.max(2, Math.round(w * maxF))), bh = rng.range(Math.max(1, Math.round(h * minF)), Math.max(2, Math.round(h * maxF))), x0, y0, r, c, cx, cy, rx, ry, dx, dy;
    if (kind === 3) { if (rng.chance(0.5)) bh = 1 + rng.int(Math.max(1, Math.round(h * 0.15))); else bw = 1 + rng.int(Math.max(1, Math.round(w * 0.15))); }
    if (bw > w) bw = w;
    if (bh > h) bh = h;
    x0 = rng.range(0, w - bw); y0 = rng.range(0, h - bh);
    cx = x0 + (bw - 1) / 2; cy = y0 + (bh - 1) / 2; rx = bw / 2; ry = bh / 2;
    for (r = y0; r < y0 + bh; r++) for (c = x0; c < x0 + bw; c++) {
      if (kind === 1) { dx = (c - cx) / rx; dy = (r - cy) / ry; if (dx * dx + dy * dy > 1) continue; }
      img[r * w + c] = val;
    }
  }
  /** knob 0..1: 0 = ảnh ít khối lớn (dễ), 1 = ảnh nhiễu (khó). Hỗn hợp hình + "xoá" tạo lỗ, rồi lật ô ngẫu nhiên với xác suất tăng theo knob. */
  function makeImage(rng, w, h, knob) {
    var img = new Uint8Array(w * h), ns = rng.range(2 + Math.round(knob * 2), 4 + Math.round(knob * 6)), s, i, noise = 0.5 * knob * knob * Math.sqrt(knob);
    for (s = 0; s < ns; s++) stamp(rng, img, w, h, s > 0 && rng.chance(0.3 + 0.1 * knob) ? 0 : 1, 0.3 - 0.15 * knob, 0.75 - 0.3 * knob);
    for (i = 0; i < img.length; i++) if (noise > 0 && rng.chance(noise)) img[i] ^= 1;
    return img;
  }
  function density(img) { var n = 0; for (var i = 0; i < img.length; i++) if (img[i] === 1) n++; return n / img.length; }

  /* ======================================================================================================= */
  /*  Điểm khó                                                                                                  */
  /* ======================================================================================================= */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  /** log₂(x) xấp xỉ tuyến tính từng khúc (x ≥ 1) — chỉ dùng phép nhân/chia/dịch bit nên kết quả y hệt trên mọi trình duyệt (Math.log/pow chỉ "xấp xỉ theo cài đặt"). */
  function lg2(x) { var e = 31 - Math.clz32(x); return e + (x / (1 << e) - 1); }
  /** Điểm 0–10 từ kích thước + kết quả phân tích an (analyze). Công thức (ghi lại trong difficultyNote):
        n = √(w·h);  cpl = (tổng trọng số kỹ thuật các bước suy luận dòng) / (w+h);  W = số vòng lan truyền;  dec = số lần chọn ô khi quay lui;  u = ô còn lại sau logic dòng / tổng
        raw = ½·chuẩn(cpl; 0,35→1,65) + ½·chuẩn(W; 2→5+0,45·n);  gu = 0,6·chuẩn(lg2(1+dec); 0→3) + 0,4·chuẩn(3u)
        score = (0,5 + 0,13·(n−5)) + (6,5 + 0,2·(n−5)) · clamp(0,8·raw + 0,35·gu)    (n = 10 → nền 1,15, trần 8,65 nên cỡ 10×10 chạm được bậc Chuyên gia khi phải đoán) */
  function scoreOf(w, h, an) {
    var n = Math.sqrt(w * h), cpl = an.st ? an.st.cost / (w + h) : 0, W = an.waves || 0, dec = an.decisions || 0, u = an.rootUnknown / (w * h), raw, gu, hf;
    if (!an.rootGrid) { cpl = 0; W = 0; u = 0; }     // vô nghiệm ngay ở vòng gốc: chỉ tính kích thước
    raw = 0.5 * clamp01((cpl - 0.35) / 1.3) + 0.5 * clamp01((W - 2) / (3 + 0.45 * n));
    gu = 0.6 * clamp01(lg2(1 + dec) / 3) + 0.4 * clamp01(3 * u);
    hf = clamp01(0.8 * raw + 0.35 * gu);
    return P.util.clampScore((0.5 + 0.13 * (n - 5)) + (6.5 + 0.2 * (n - 5)) * hf);
  }

  /* ======================================================================================================= */
  /*  Sinh đề                                                                                                   */
  /* ======================================================================================================= */
  var SIZES = [
    { id: "5", label: "5 × 5", params: { w: 5, h: 5 }, tiers: ["easy", "medium"] },
    { id: "10", label: "10 × 10", params: { w: 10, h: 10 }, default: true, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "15", label: "15 × 15", params: { w: 15, h: 15 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];
  var TIER_KNOB = { easy: 0.1, medium: 0.35, hard: 0.6, expert: 0.9 };
  var MAXTRY = 240, GEN_WORK = 200000;     // ngân sách sinh đề: số lần thử và tổng số lần giải dòng (đếm được → kết quả lặp lại, không phụ thuộc máy)

  function sizeParams(sizeId) {
    var i, m = /^(\d{1,2})x(\d{1,2})$/.exec(String(sizeId));
    for (i = 0; i < SIZES.length; i++) if (SIZES[i].id === String(sizeId)) return SIZES[i].params;
    if (m && +m[1] >= MINN && +m[1] <= MAXN && +m[2] >= MINN && +m[2] <= MAXN) return { w: +m[1], h: +m[2] };
    for (i = 0; i < SIZES.length; i++) if (SIZES[i].default) return SIZES[i].params;
    return { w: 10, h: 10 };
  }
  function sizeIdFor(w, h) { var id = String(w); if (w === h) for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === id) return id; return w + "x" + h; }

  /** Một ứng viên: ảnh ngẫu nhiên → nếu nhiều nghiệm thì lật dần ô nằm trong vùng khác nhau giữa ảnh và một nghiệm khác (tối đa maxRep lần) → null nếu không duy nhất.
      Ngân sách tìm kiếm của bộ giải ở đây nhỏ (400 nút): đề cần quay lui sâu hơn bị coi là "không duy nhất / quá khó" và bỏ. */
  function genCandidate(rng, w, h, knob, maxRep, budget) {
    var img = makeImage(rng.fork("img"), w, h, knob), adj = rng.fork("adj"), it = 0, d = density(img), rep, i, j, S, Ds, Q, an, cl, sol, diff, er, ec, r, c, maxEmpty = Math.max(1, Math.floor(0.15 * (w + h)));
    while ((d < 0.4 || d > 0.66) && it < 8) { stamp(adj, img, w, h, d < 0.4 ? 1 : 0, 0.3, 0.7); d = density(img); it++; }
    if (d < 0.36 || d > 0.7) return null;
    for (rep = 0; rep <= maxRep; rep++) {
      cl = cluesOf(img, w, h);
      er = 0; ec = 0;
      for (i = 0; i < h; i++) if (!cl.rows[i].length) er++;
      for (i = 0; i < w; i++) if (!cl.cols[i].length) ec++;
      if (er + ec > maxEmpty) return null;
      Q = { w: w, h: h, rows: cl.rows, cols: cl.cols };
      an = analyze(Q, { limit: 2, maxNodes: 400, maxWork: 30000 });
      if (budget) { budget.left -= an.calls; if (budget.left < 0) return null; }
      if (an.exhausted) return null;
      if (an.count === 1) { d = density(img); return d < 0.36 || d > 0.7 ? null : { img: img, an: an, Q: Q, rep: rep }; }
      S = null;
      for (i = 0; i < an.solutions.length && !S; i++) { sol = an.solutions[i]; diff = false; for (j = 0; j < sol.length; j++) if ((sol[j] === 1 ? 1 : 0) !== img[j]) { diff = true; break; } if (diff) S = sol; }
      if (!S) return null;
      Ds = [];
      for (j = 0; j < S.length; j++) if ((S[j] === 1 ? 1 : 0) !== img[j]) Ds.push(j);
      img[Ds[adj.int(Ds.length)]] ^= 1;
    }
    return null;
  }

  /* ======================================================================================================= */
  /*  Chuẩn hoá & dựng puzzle                                                                                   */
  /* ======================================================================================================= */
  function intIn(x, lo, hi) { return typeof x === "number" && isFinite(x) && x === Math.floor(x) && x >= lo && x <= hi; }
  /** Một clue nhập tay (mảng số / chuỗi "3 1" / số) → mảng số nguyên dương; [0] hoặc rỗng → []; sai → null. */
  function normLine(x) {
    var arr, out = [], i, v;
    if (typeof x === "string") { x = x.trim(); arr = x ? x.split(/[\s,;]+/) : []; }
    else if (typeof x === "number") arr = [x];
    else if (Array.isArray(x)) arr = x;
    else return null;
    for (i = 0; i < arr.length; i++) {
      v = arr[i];
      if (typeof v === "string") v = /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;
      if (!intIn(v, 0, 999)) return null;
      if (v > 0) out.push(v); else if (arr.length > 1) return null;
    }
    return out;
  }
  /** Kiểm w,h, clue → Q = {w,h,rows,cols} hoặc null (lỗi ghi vào errors, tiếng Việt). */
  function buildQ(w, h, rowsIn, colsIn, errors) {
    var rows = [], cols = [], i, j, line, need, sumR = 0, sumC = 0, e0 = errors.length;
    if (!intIn(w, MINN, MAXN) || !intIn(h, MINN, MAXN)) { errors.push("Cỡ lưới phải là số nguyên từ " + MINN + " đến " + MAXN + " mỗi chiều."); return null; }
    if (!Array.isArray(rowsIn) || rowsIn.length !== h) { errors.push("Cần đúng " + h + " clue hàng (nhận " + (Array.isArray(rowsIn) ? rowsIn.length : "không có") + ")."); return null; }
    if (!Array.isArray(colsIn) || colsIn.length !== w) { errors.push("Cần đúng " + w + " clue cột (nhận " + (Array.isArray(colsIn) ? colsIn.length : "không có") + ")."); return null; }
    function side(list, n, name, out, isRow) {
      for (i = 0; i < list.length; i++) {
        line = normLine(list[i]);
        if (!line) { errors.push("Clue " + name + " " + (i + 1) + " không hợp lệ (chỉ nhận các số nguyên dương, hoặc 0 cho dòng trống)."); out.push([]); continue; }
        need = -1; for (j = 0; j < line.length; j++) need += line[j] + 1;
        if (need > n) errors.push("Clue " + name + " " + (i + 1) + " (" + clueStr(line) + ") cần ít nhất " + need + " ô nhưng " + name + " chỉ dài " + n + " ô.");
        for (j = 0; j < line.length; j++) if (isRow) sumR += line[j]; else sumC += line[j];
        out.push(line);
      }
    }
    side(rowsIn, w, "hàng", rows, true);
    side(colsIn, h, "cột", cols, false);
    if (errors.length > e0) return null;
    if (sumR !== sumC) { errors.push("Tổng số ô tô theo hàng (" + sumR + ") khác tổng theo cột (" + sumC + "): hai bộ clue mâu thuẫn nhau."); return null; }
    return { w: w, h: h, rows: rows, cols: cols };
  }
  var QCACHE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  /** puzzle → { ok, Q, errors }. Không ném lỗi dù puzzle hỏng. */
  function toQ(p) {
    var errors = [], d, Q, hit;
    if (!p || typeof p !== "object" || !p.data || typeof p.data !== "object") return { ok: false, Q: null, errors: ["Thiếu dữ liệu đề (data)."] };
    if (QCACHE && (hit = QCACHE.get(p)) && hit.d === p.data) return hit.r;
    d = p.data; Q = buildQ(d.w, d.h, d.rows, d.cols, errors);
    hit = Q ? { ok: true, Q: Q, errors: [] } : { ok: false, Q: null, errors: errors };
    if (QCACHE) QCACHE.set(p, { d: p.data, r: hit });
    return hit;
  }
  function metaClean(m) {
    var out = {}, k, ks = ["name", "source", "note"], i;
    if (m && typeof m === "object") for (i = 0; i < ks.length; i++) { k = ks[i]; if (typeof m[k] === "string" && m[k].trim()) out[k] = m[k].trim().slice(0, 200); }
    return out;
  }
  /** Dựng puzzle (mục 1 hợp đồng). o: { seed, sizeId, tier, score, solution (Uint8Array/mảng 1|2 hoặc null), meta } */
  function buildPuzzle(Q, o) {
    var init = [], i, p;
    for (i = 0; i < Q.w * Q.h; i++) init.push(0);
    p = { v: 1, type: "nonogram", id: "", seed: o.seed == null ? null : o.seed, sizeId: o.sizeId || sizeIdFor(Q.w, Q.h), size: { w: Q.w, h: Q.h }, tier: o.tier, score: o.score,
      data: { w: Q.w, h: Q.h, rows: Q.rows.map(function (b) { return b.slice(); }), cols: Q.cols.map(function (b) { return b.slice(); }) },
      initial: { v: init }, solution: o.solution ? { v: Array.prototype.slice.call(o.solution) } : null, meta: metaClean(o.meta) };
    p.id = P.util.puzzleId(p);
    return p;
  }
  function imgToSol(img) { var s = new Uint8Array(img.length), i; for (i = 0; i < img.length; i++) s[i] = img[i] === 1 ? 1 : 2; return s; }

  /* ======================================================================================================= */
  /*  generate / difficulty / solve / validate / fromInput                                                      */
  /* ======================================================================================================= */
  function generate(seed, opts) {
    opts = opts || {};
    var sp = sizeParams(opts.sizeId), w = sp.w, h = sp.h, T = P.util.tier(opts.tier) || P.util.tier("medium"), rng = P.rng.create(seed), knob = TIER_KNOB[T.id];
    var best = null, bestD = 1e9, k, cand, sc, dist, step, img, i, cl, Q, an, budget = { left: GEN_WORK };
    for (k = 0; k < MAXTRY + 300; k++) {
      if ((k >= MAXTRY && best) || budget.left < 0) break;
      cand = genCandidate(rng.fork("try" + k), w, h, knob, k < MAXTRY ? 12 : 40, budget);
      if (!cand) continue;
      sc = scoreOf(w, h, cand.an);
      dist = sc < T.min ? T.min - sc : sc >= T.max ? sc - T.max + 0.01 : 0;
      if (dist < bestD) { best = cand; best.score = sc; bestD = dist; }
      if (dist === 0) break;
      step = 0.05 + 0.1 * rng.fork("kn" + k).next();
      knob = clamp01(knob + (sc < T.min ? step : -step));
    }
    if (!best) {                                       // cứu cánh (gần như không bao giờ tới): ảnh kín luôn duy nhất
      img = new Uint8Array(w * h); for (i = 0; i < img.length; i++) img[i] = 1;
      cl = cluesOf(img, w, h); Q = { w: w, h: h, rows: cl.rows, cols: cl.cols }; an = analyze(Q, { limit: 2 });
      best = { img: img, an: an, Q: Q, score: scoreOf(w, h, an) };
    }
    return buildPuzzle(best.Q, { seed: rng.seed, sizeId: sizeIdFor(w, h), tier: P.util.tierOfScore(best.score).id, score: best.score, solution: imgToSol(best.img) });
  }

  /** Điểm khó của một đề (hàm tất định của clue). Đề hỏng/vô nghiệm → 0. */
  function difficulty(puzzle) {
    var q = toQ(puzzle), an;
    if (!q.ok) return 0;
    an = analyze(q.Q, { limit: 2 });          // đúng tham số của fromInput → puzzle.score === difficulty(puzzle) với mọi đề
    return scoreOf(q.Q.w, q.Q.h, an);
  }

  function gridToV(g) { return Array.prototype.slice.call(g); }
  function cellName(w, i) { var r = Math.floor(i / w); return "hàng " + (r + 1) + ", cột " + (i - r * w + 1); }

  /** solve(puzzle, {limit=2, maxNodes, text=true}) → { status, count, solution:{v}|null, steps:[{technique,text,why?,…}], techniques, nodes, decisions, depth, waves, lineSteps, unknownAfterLogic, exhausted, errors? }
      status "none" | "unique" | "multiple". Cạn ngân sách (maxNodes) → status "multiple", exhausted:true (chưa xác định hết). limit < 2 thì status "unique" nghĩa là "đã tìm được một nghiệm". */
  function solve(puzzle, opts) {
    opts = opts || {};
    var q = toQ(puzzle), limit = opts.limit > 0 ? Math.floor(opts.limit) : 2, an, st, steps = [], techniques = {}, k, status, i, s, guessSteps = 0, path, cell, val, r, c;
    if (!q.ok) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, decisions: 0, depth: 0, waves: 0, lineSteps: 0, unknownAfterLogic: 0, exhausted: false, errors: q.errors };
    an = analyze(q.Q, { limit: limit, maxNodes: opts.maxNodes || 60000, text: opts.text !== false, keep: 1 });
    st = an.st;
    for (k in st.tech) techniques[k] = st.tech[k];
    for (i = 0; i < st.steps.length; i++) steps.push(st.steps[i]);
    path = an.path || [];
    for (i = 0; i < path.length; i++) {
      cell = path[i][0]; val = path[i][1]; r = Math.floor(cell / q.Q.w); c = cell - r * q.Q.w;
      guessSteps++;
      steps.push({ technique: "guess", axis: null, idx: -1, fills: val === 1 ? [cell] : [], empties: val === 2 ? [cell] : [], wave: an.waves,
        text: "Logic dòng đã bế tắc — thử giả thiết ô (hàng " + (r + 1) + ", cột " + (c + 1) + ") " + (val === 1 ? "được tô" : "trống") + " rồi lan truyền tiếp (lần đoán thứ " + (i + 1) + ")." });
    }
    if (guessSteps) techniques.guess = guessSteps;
    status = an.count === 0 && !an.exhausted ? "none" : an.count >= 2 || an.exhausted ? "multiple" : "unique";
    return { status: status, count: an.count, solution: an.solutions.length ? { v: gridToV(an.solutions[0]) } : null, steps: steps, techniques: techniques, nodes: an.nodes, decisions: an.decisions, depth: an.depth,
      waves: an.waves, lineSteps: st.lineSteps, unknownAfterLogic: an.rootUnknown, exhausted: an.exhausted, cost: st.cost, fail: an.fail };
  }

  function validate(puzzle) {
    var q = toQ(puzzle), res, errors = [];
    if (!q.ok) return { ok: false, errors: q.errors, status: "none", count: 0 };
    res = solve(puzzle, { limit: 2, text: false });
    if (res.status === "none") errors.push("Đề vô nghiệm: không có cách tô nào khớp mọi clue.");
    return { ok: !errors.length, errors: errors, status: res.status, count: res.count, solution: res.solution || undefined };
  }

  function fromInput(input) {
    var errors = [], warnings = [], w, h, rowsIn, colsIn, img = null, Q, cl, an, status, i, j, sol, failTxt;
    function fail(status) { return { ok: false, puzzle: null, errors: errors, warnings: warnings, status: status || "none", count: 0 }; }
    try {
      if (!input || typeof input !== "object") { errors.push("Dữ liệu nhập trống hoặc sai định dạng."); return fail(); }
      w = input.w; h = input.h; rowsIn = input.rows; colsIn = input.cols;
      if (input.image != null) {
        var im = input.image;
        if (typeof im === "string") { im = im.replace(/\s+/g, "").split(""); for (i = 0; i < im.length; i++) { if (im[i] === "1" || im[i] === "#") im[i] = 1; else if (im[i] === "0" || im[i] === ".") im[i] = 0; else { errors.push("Ảnh có ký tự lạ '" + im[i] + "' (chỉ nhận 0/1 hoặc ./#)."); return fail(); } } }
        else if (Array.isArray(im) && im.length && Array.isArray(im[0])) {
          if (h == null) h = im.length;
          if (w == null) w = im[0].length;
          var flat = [], ragged = false; for (i = 0; i < im.length; i++) { if (!Array.isArray(im[i]) || im[i].length !== im[0].length) ragged = true; else for (j = 0; j < im[i].length; j++) flat.push(im[i][j]); }
          if (ragged) { errors.push("Ảnh có các hàng không cùng độ dài."); return fail(); }
          im = flat;
        }
        else if (im && typeof im === "object" && typeof im.length === "number") im = Array.prototype.slice.call(im);
        else { errors.push("Ảnh phải là mảng 0/1 (hoặc chuỗi) độ dài w×h."); return fail(); }
        if (!intIn(w, MINN, MAXN) || !intIn(h, MINN, MAXN)) { errors.push("Cỡ lưới phải là số nguyên từ " + MINN + " đến " + MAXN + " mỗi chiều."); return fail(); }
        if (im.length !== w * h) { errors.push("Ảnh có " + im.length + " ô, cần đúng " + (w * h) + " (" + w + " × " + h + ")."); return fail(); }
        img = new Uint8Array(w * h);
        for (i = 0; i < im.length; i++) {
          if (im[i] === 1 || im[i] === true) img[i] = 1;
          else if (im[i] === 0 || im[i] === false || im[i] === 2) img[i] = 0;
          else { errors.push("Ảnh có giá trị lạ ở ô " + (i + 1) + " (chỉ nhận 0/1)."); return fail(); }
        }
        cl = cluesOf(img, w, h); rowsIn = cl.rows; colsIn = cl.cols;
      } else {
        if (w == null && Array.isArray(colsIn)) w = colsIn.length;
        if (h == null && Array.isArray(rowsIn)) h = rowsIn.length;
      }
      Q = buildQ(w, h, rowsIn, colsIn, errors);
      if (!Q) return fail();
      an = analyze(Q, { limit: 2 });
      if (an.count === 0 && !an.exhausted) {
        failTxt = an.fail ? " (mâu thuẫn xuất hiện ở " + lineLabel(an.fail.axis, an.fail.idx) + ")" : "";
        errors.push("Đề vô nghiệm: không có cách tô nào khớp mọi clue" + failTxt + ".");
        return fail("none");
      }
      sol = img ? imgToSol(img) : (an.solutions.length ? an.solutions[0] : null);
      if (an.exhausted) { status = "multiple"; warnings.push("Chưa xác định hết số lời giải (quá nhiều khả năng, bộ giải dừng khi cạn ngân sách tìm kiếm)."); }
      else if (an.count >= 2) { status = "multiple"; warnings.push("Đề có nhiều hơn một lời giải (ít nhất 2). Ảnh vẽ tự do thường như vậy — thêm hoặc bớt vài ô để đề duy nhất."); }
      else status = "unique";
      return { ok: true, puzzle: buildPuzzle(Q, { seed: null, tier: "custom", score: scoreOf(Q.w, Q.h, an), solution: sol, meta: input.meta || input }), errors: [], warnings: warnings, status: status, count: an.count };
    } catch (e) {
      errors.push("Không xử lý được dữ liệu nhập.");
      return fail();
    }
  }

  /* ======================================================================================================= */
  /*  Ván chơi: state, moveFor, check, mistakes                                                                 */
  /* ======================================================================================================= */
  function newState(puzzle) {
    var q = toQ(puzzle), N = q.ok ? q.Q.w * q.Q.h : 0, iv = puzzle && puzzle.initial && puzzle.initial.v, v = [], i;
    for (i = 0; i < N; i++) v.push(iv && iv.length === N && (iv[i] === 1 || iv[i] === 2) ? iv[i] : 0);
    return { v: v, c: null };
  }
  function isGiven() { return false; }

  function moveFor(puzzle, state, a, settings) {
    var q = toQ(puzzle), Q, N, v, d = [], i, k, val, seen = {}, n = 0, axis, idx, base, stride, len, label;
    if (!q.ok || !state || !state.v || !a || typeof a !== "object") return null;
    Q = q.Q; N = Q.w * Q.h; v = state.v;
    if (v.length !== N) return null;
    if (a.k === "fill") {
      val = a.val;
      if (!Array.isArray(a.cells) || (val !== 0 && val !== 1 && val !== 2)) return null;
      for (k = 0; k < a.cells.length; k++) {
        i = a.cells[k];
        if (!intIn(i, 0, N - 1) || seen[i]) continue;
        seen[i] = 1;
        if (v[i] !== val) d.push(["v", i, v[i], val]);
      }
      n = d.length;
      label = (val === 1 ? "Tô " : val === 2 ? "Gạch " : "Xoá ") + n + " ô";
    } else if (a.k === "cycle") {
      i = a.i;
      if (!intIn(i, 0, N - 1)) return null;
      d.push(["v", i, v[i], (v[i] + 1) % 3]);
      label = "Đổi ô (" + cellName(Q.w, i) + ")";
    } else if (a.k === "clearline") {
      axis = a.axis; idx = a.idx;
      if ((axis !== "r" && axis !== "c") || !intIn(idx, 0, (axis === "r" ? Q.h : Q.w) - 1)) return null;
      len = axis === "r" ? Q.w : Q.h; base = axis === "r" ? idx * Q.w : idx; stride = axis === "r" ? 1 : Q.w;
      for (k = 0; k < len; k++) { i = base + k * stride; if (v[i] !== 0) d.push(["v", i, v[i], 0]); }
      label = "Xoá " + lineLabel(axis, idx);
    } else return null;
    return d.length ? { d: d, label: label } : null;
  }

  function runsOf(v, base, stride, n) {
    var out = [], run = 0, c;
    for (c = 0; c < n; c++) { if (v[base + c * stride] === 1) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out;
  }
  function sameArr(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function lineInfo(Q, li) { var isRow = li < Q.h, idx = isRow ? li : li - Q.h; return { axis: isRow ? "r" : "c", idx: idx, n: isRow ? Q.w : Q.h, B: isRow ? Q.rows[idx] : Q.cols[idx], base: isRow ? idx * Q.w : idx, stride: isRow ? 1 : Q.w }; }
  /** Mọi hàng và cột có dãy khối tô (ô gạch và ô chưa biết đều tính là trống) khớp clue? */
  function isSolvedGrid(Q, v) {
    var li, L;
    for (li = 0; li < Q.h + Q.w; li++) { L = lineInfo(Q, li); if (!sameArr(runsOf(v, L.base, L.stride, L.n), L.B)) return false; }
    return true;
  }
  /** Ô `i` trong dòng nào bị lỗi? Dòng không xếp được → các ô "thủ phạm": ô đã đánh dấu mà bỏ riêng nó đi (về chưa biết) thì dòng xếp được; nếu không ô đơn lẻ nào cứu được thì mọi ô đã tô. */
  function lineCulprits(Q, v, L) {
    var tmp = [], c, out = [], old, any = false, cul;
    ensure(L.n, L.B.length);
    for (c = 0; c < L.n; c++) tmp.push(v[L.base + c * L.stride]);
    for (c = 0; c < L.n; c++) {
      if (!tmp[c]) continue;
      old = tmp[c]; tmp[c] = 0;
      cul = lineSolve(L.n, L.B, tmp); tmp[c] = old;
      if (cul) { out.push(L.base + c * L.stride); any = true; }
    }
    if (!any) for (c = 0; c < L.n; c++) if (tmp[c] === 1) out.push(L.base + c * L.stride);
    if (!out.length) for (c = 0; c < L.n; c++) if (tmp[c]) out.push(L.base + c * L.stride);
    return out;
  }

  /** check: solved = mọi hàng/cột khớp clue; conflicts = các ô "thủ phạm" của những dòng ĐÃ vi phạm chắc chắn (không còn cách nào hoàn thành dòng đó với các ô đã đánh dấu); filled = số ô đã đánh dấu (tô hoặc gạch). */
  function check(puzzle, state) {
    var q = toQ(puzzle), Q, v, N, li, L, i, flag, conflicts = [], filled = 0, c;
    if (!q.ok || !state || !state.v) return { solved: false, conflicts: [], filled: 0, total: 0 };
    Q = q.Q; v = state.v; N = Q.w * Q.h;
    if (v.length !== N) return { solved: false, conflicts: [], filled: 0, total: N };
    for (i = 0; i < N; i++) if (v[i]) filled++;
    flag = new Uint8Array(N);
    for (li = 0; li < Q.h + Q.w; li++) {
      L = lineInfo(Q, li); ensure(L.n, L.B.length);
      for (c = 0; c < L.n; c++) LINE[c] = v[L.base + c * L.stride];
      if (lineSolve(L.n, L.B, LINE)) continue;
      var cs = lineCulprits(Q, v, L);
      for (i = 0; i < cs.length; i++) flag[cs[i]] = 1;
    }
    for (i = 0; i < N; i++) if (flag[i]) conflicts.push(i);
    return { solved: isSolvedGrid(Q, v), conflicts: conflicts, filled: filled, total: N };
  }

  /* ---- đáp án tham chiếu: đề sinh ra (seed ≠ null, tier ≠ custom) tin solution; đề tự nhập: đếm nghiệm một lần rồi nhớ lại ---- */
  var RCACHE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function satisfies(Q, sv) {
    var N = Q.w * Q.h, g = new Uint8Array(N), i;
    if (!sv || sv.length !== N) return false;
    for (i = 0; i < N; i++) g[i] = sv[i] === 1 ? 1 : 2;
    return isSolvedGrid(Q, g);
  }
  /** → { unique, sol } — sol là mảng 1/2 hợp lệ (một nghiệm) hoặc null. */
  function refInfo(puzzle) {
    var q = toQ(puzzle), hit, r, sv, an;
    if (!q.ok) return { unique: false, sol: null };
    if (RCACHE && (hit = RCACHE.get(puzzle)) && hit.d === puzzle.data) return hit.r;
    sv = puzzle.solution && puzzle.solution.v;
    if (sv && satisfies(q.Q, sv) && puzzle.seed != null && puzzle.tier !== "custom") r = { unique: true, sol: Array.prototype.slice.call(sv) };
    else {
      an = analyze(q.Q, { limit: 2, maxNodes: 20000, maxWork: 12000, cls: false, keep: 1 });
      r = { unique: an.count === 1 && !an.exhausted, sol: sv && satisfies(q.Q, sv) ? Array.prototype.slice.call(sv) : (an.solutions.length ? gridToV(an.solutions[0]) : null) };
    }
    if (RCACHE) RCACHE.set(puzzle, { d: puzzle.data, r: r });
    return r;
  }
  /** Còn lời giải nào khớp mọi ô đã đánh dấu trong marks? deep=false: chỉ lan truyền dòng (rẻ, KHÔNG BAO GIỜ báo sai "hết nghiệm" nhưng có thể bỏ sót); deep=true: có quay lui (cạn ngân sách → coi là còn). */
  function feasible(Q, marks, deep) {
    var an;
    if (!deep) return analyze(Q, { limit: 1, cls: false, known: marks, keep: 0, rootOnly: true }).rootGrid !== null;
    an = analyze(Q, { limit: 1, maxNodes: 5000, maxWork: 30000, cls: false, known: marks, keep: 0 });
    return an.count >= 1 || an.exhausted;
  }
  /** Danh sách ô đánh dấu SAI: đề duy nhất → khác đáp án; đề nhiều nghiệm → ô đầu tiên (theo chỉ số) làm cho tập dấu không còn lời giải nào. */
  function findWrong(Q, v, ref) {
    var N = Q.w * Q.h, out = [], i, M = [], lo, hi, mid, marks, k;
    if (ref.unique && ref.sol) { for (i = 0; i < N; i++) if ((v[i] === 1 && ref.sol[i] !== 1) || (v[i] === 2 && ref.sol[i] === 1)) out.push(i); return out; }
    for (i = 0; i < N; i++) if (v[i]) M.push(i);
    function ok(cnt) { marks = new Uint8Array(N); for (k = 0; k < cnt; k++) marks[M[k]] = v[M[k]]; return feasible(Q, marks, true); }
    if (ok(M.length)) return out;
    lo = 1; hi = M.length;                                   // nhỏ nhất cnt mà tiền tố cnt vô nghiệm
    while (lo < hi) { mid = (lo + hi) >> 1; if (ok(mid)) lo = mid + 1; else hi = mid; }
    out.push(M[lo - 1]);
    return out;
  }

  /** Số nước sai MỚI trong diff (gọi trước khi áp): đề duy nhất → mỗi ô diff mà giá trị mới sai so với đáp án (tô chỗ trống, gạch chỗ tô).
      Đề nhiều nghiệm → 1 nếu diff làm một trạng thái còn lời giải thành hết lời giải (kiểm bằng lan truyền dòng — rẻ, không bao giờ phạt oan), ngược lại 0. */
  function mistakes(puzzle, state, diff) {
    var q = toQ(puzzle), ref, i, e, n = 0, N, nv;
    if (!q.ok || !state || !state.v || !diff || !diff.d) return 0;
    N = q.Q.w * q.Q.h;
    if (state.v.length !== N) return 0;
    ref = refInfo(puzzle);
    if (ref.unique && ref.sol) {
      for (i = 0; i < diff.d.length; i++) { e = diff.d[i]; if (e[0] === "v" && ((e[3] === 1 && ref.sol[e[1]] !== 1) || (e[3] === 2 && ref.sol[e[1]] === 1))) n++; }
      return n;
    }
    nv = new Uint8Array(state.v);
    if (!feasible(q.Q, nv, false)) return 0;
    for (i = 0; i < diff.d.length; i++) { e = diff.d[i]; if (e[0] === "v") nv[e[1]] = e[3]; }
    return feasible(q.Q, nv, false) ? 0 : 1;
  }

  function describeCell(puzzle, state, i) {
    var q = toQ(puzzle), w, r, c, s, val;
    if (!q.ok || !intIn(i, 0, q.Q.w * q.Q.h - 1)) return "Ô không hợp lệ";
    w = q.Q.w; r = Math.floor(i / w); c = i - r * w;
    val = state && state.v ? state.v[i] : 0;
    s = val === 1 ? "đã tô" : val === 2 ? "đã gạch (trống)" : "chưa biết";
    return "Hàng " + (r + 1) + ", cột " + (c + 1) + ", ô " + s;
  }

  /* ======================================================================================================= */
  /*  Bước suy luận kế tiếp (dùng cho hint và replay)                                                           */
  /* ======================================================================================================= */
  function lineCellIdx(Q, li) { var L = lineInfo(Q, li), out = [], c; for (c = 0; c < L.n; c++) out.push(L.base + c * L.stride); return out; }
  function unknownCount(g) { return countZero(g); }

  /** Thử giả định từng ô chưa biết (tối đa 80 ô, ưu tiên ô nằm trong hàng/cột còn ít ô chưa biết): giả định giá trị a mà lan truyền ra mâu thuẫn ⇒ ô phải là giá trị ngược lại. */
  function probeStep(Q, known) {
    var w = Q.w, h = Q.h, nl = h + w, ru = [], cu = [], cand = [], r, c, k, vi, cell, g, dirty, st, ok;
    for (r = 0; r < h; r++) { ru.push(0); for (c = 0; c < w; c++) if (!known[r * w + c]) ru[r]++; }
    for (c = 0; c < w; c++) { cu.push(0); for (r = 0; r < h; r++) if (!known[r * w + c]) cu[c]++; }
    for (r = 0; r < h; r++) for (c = 0; c < w; c++) if (!known[r * w + c]) cand.push({ i: r * w + c, s: ru[r] + cu[c] });
    cand.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    for (k = 0; k < cand.length && k < 80; k++) {
      cell = cand[k].i; r = Math.floor(cell / w); c = cell - r * w;
      for (vi = 1; vi <= 2; vi++) {
        g = new Uint8Array(known); g[cell] = vi; dirty = new Uint8Array(nl); dirty[r] = 1; dirty[h + c] = 1;
        st = newStats(false, false);
        ok = propagate(Q, g, dirty, st);
        if (!ok) return { cell: cell, assumed: vi, forced: 3 - vi, fail: st.fail, lineSteps: st.lineSteps };
      }
    }
    return null;
  }
  function valWord(v) { return v === 1 ? "được tô" : "trống"; }

  /** Bước tiếp theo từ các ô đã biết `known` (Uint8Array 0/1/2, giả định không có ô sai):
        { kind:"line", line, technique, fills:[ô], empties:[ô], text, why:[…] }   — suy luận một dòng (chọn dòng cho nhiều ô chốt nhất, hoà thì kỹ thuật đơn giản hơn, rồi hàng trước cột)
        { kind:"probe", technique:"probe", cell, val, … }                          — logic dòng hết cách: giả định phản chứng (hợp lệ, giải thích được)
        { kind:"guess", technique:"guess", cell, val, … }                           — còn hết cách: chọn theo đáp án (ghi rõ là đoán)
        { kind:"contra" } khi các ô đã biết mâu thuẫn; null khi không còn ô trống. */
  function nextStep(Q, known, sol) {
    var nl = Q.h + Q.w, li, L, c, Fp, Ep, best = null, bestScore = -1, bestW = 0, sc, tech, wgt, any, ex, i, w = Q.w, step, pr, cell, val, r, cc, an, solv;
    if (!unknownCount(known)) return null;
    for (li = 0; li < nl; li++) {
      L = lineInfo(Q, li); ensure(L.n, L.B.length); any = false;
      for (c = 0; c < L.n; c++) { LINE[c] = known[L.base + c * L.stride]; if (!LINE[c]) any = true; }
      if (!any) continue;
      if (!lineSolve(L.n, L.B, LINE)) return { kind: "contra", line: li };
      Fp = []; Ep = [];
      for (c = 0; c < L.n; c++) if (!LINE[c]) { if (CANF[c] && !CANE[c]) Fp.push(c); else if (CANE[c] && !CANF[c]) Ep.push(c); }
      if (!Fp.length && !Ep.length) continue;
      tech = classify(L.n, L.B, LINE, Fp, Ep); wgt = TECH[tech].w; sc = Fp.length * 2 + Ep.length;
      if (sc > bestScore || (sc === bestScore && wgt < bestW)) { best = { li: li, Fp: Fp, Ep: Ep, tech: tech }; bestScore = sc; bestW = wgt; }
    }
    if (best) {
      L = lineInfo(Q, best.li); ensure(L.n, L.B.length);
      for (c = 0; c < L.n; c++) LINE[c] = known[L.base + c * L.stride];
      lineSolve(L.n, L.B, LINE);
      ex = explain(L.axis, L.idx, L.n, L.B, LINE, best.Fp, best.Ep, best.tech);
      step = { kind: "line", line: best.li, axis: L.axis, idx: L.idx, technique: best.tech, fills: [], empties: [], text: ex.text, why: ex.why, n: L.n, B: L.B };
      for (i = 0; i < best.Fp.length; i++) step.fills.push(L.base + best.Fp[i] * L.stride);
      for (i = 0; i < best.Ep.length; i++) step.empties.push(L.base + best.Ep[i] * L.stride);
      return step;
    }
    pr = probeStep(Q, known);
    if (pr) {
      r = Math.floor(pr.cell / w); cc = pr.cell - r * w;
      return { kind: "probe", technique: "probe", cell: pr.cell, val: pr.forced, fills: pr.forced === 1 ? [pr.cell] : [], empties: pr.forced === 2 ? [pr.cell] : [],
        text: "Giả định phản chứng: ô (hàng " + (r + 1) + ", cột " + (cc + 1) + ") phải " + valWord(pr.forced) + ".",
        why: ["Logic từng dòng đã hết cách nên thử giả định: nếu ô (hàng " + (r + 1) + ", cột " + (cc + 1) + ") " + valWord(pr.assumed) + ", lan truyền qua " + pr.lineSteps + " suy luận dòng thì " + lineLabel(pr.fail.axis, pr.fail.idx) + " không còn cách xếp nào khớp clue — mâu thuẫn.",
          "Vậy giả định sai, và ô đó chắc chắn " + valWord(pr.forced) + "."] };
    }
    cell = pickBranch(Q, known);
    if (cell < 0) return null;
    val = sol && (sol[cell] === 1 || sol[cell] === 2) ? sol[cell] : 0;
    if (!val) {
      an = analyze(Q, { limit: 1, maxNodes: 20000, maxWork: 36000, cls: false, known: known, keep: 1 });
      solv = an.solutions.length ? an.solutions[0] : null;
      if (!solv) return { kind: "contra", line: -1 };
      val = solv[cell];
    }
    r = Math.floor(cell / w); cc = cell - r * w;
    return { kind: "guess", technique: "guess", cell: cell, val: val, fills: val === 1 ? [cell] : [], empties: val === 2 ? [cell] : [],
      text: "Thử giả thiết: ô (hàng " + (r + 1) + ", cột " + (cc + 1) + ") " + valWord(val) + ".",
      why: ["Logic dòng thuần và cả giả định phản chứng một ô đều hết cách ở trạng thái này — đề cần quay lui sâu hơn.",
        "Thử giả thiết ô (hàng " + (r + 1) + ", cột " + (cc + 1) + ") " + valWord(val) + " (nước đi được chọn theo đáp án của đề, nên không dẫn tới mâu thuẫn), rồi lan truyền tiếp các dòng."] };
  }

  function sanitizeMarks(v, N) { var g = new Uint8Array(N), i; for (i = 0; i < N; i++) g[i] = v[i] === 1 || v[i] === 2 ? v[i] : 0; return g; }
  var NO_WORDS_HINT = {
    empty: "dòng không có khối nào",
    exact: "tổng các khối cộng khoảng cách tối thiểu đúng bằng độ dài dòng",
    complete: "các khối của clue đã đủ ô",
    overlap: "so vị trí sớm nhất với muộn nhất của từng khối — có ô nằm chung trong mọi cách đặt",
    anchor: "một khối chỉ còn đúng một vị trí nhờ các ô đã biết",
    unreachable: "có ô mà không khối nào với tới được",
    intersect: "xét mọi cách xếp hợp lệ của dòng — có ô giống nhau trong tất cả"
  };

  function hint(puzzle, state, level) {
    level = Math.max(1, Math.min(3, Math.floor(Number(level)) || 1));
    function none(text) { return { level: level, text: text, why: [], cells: [], none: true }; }
    var q = toQ(puzzle), Q, N, known, ref, wrong, st, cell, r, c, i, lbl, cellsAll, w, L;
    if (!q.ok || !state || !Array.isArray(state.v) || state.v.length !== q.Q.w * q.Q.h) return none("Không có gợi ý: đề hoặc trạng thái ván không hợp lệ.");
    Q = q.Q; N = Q.w * Q.h; w = Q.w; known = sanitizeMarks(state.v, N);
    if (isSolvedGrid(Q, known)) return none("Bạn đã giải xong: mọi hàng và cột đều khớp clue.");
    ref = refInfo(puzzle);
    wrong = findWrong(Q, known, ref);
    if (wrong.length) {
      cell = wrong[0]; r = Math.floor(cell / w); c = cell - r * w;
      if (level === 1) { cellsAll = lineCellIdx(Q, r); return { level: 1, text: "Có ô đang đánh dấu sai. Hãy kiểm tra lại hàng " + (r + 1) + ".", why: [], cells: cellsAll, regions: { axis: "r", idx: r } }; }
      if (level === 2) return { level: 2, text: "Ô (hàng " + (r + 1) + ", cột " + (c + 1) + ") đang đánh dấu sai.", why: [], cells: [cell], technique: "fix" };
      return { level: 3, text: "Xoá dấu ở ô (hàng " + (r + 1) + ", cột " + (c + 1) + ").", technique: "fix", cells: [cell], action: { k: "fill", cells: [cell], val: 0 },
        why: [ref.unique && ref.sol ? "Ô này đang " + (known[cell] === 1 ? "tô" : "gạch") + " nhưng theo đáp án duy nhất của đề nó " + (known[cell] === 1 ? "phải để trống" : "phải được tô") + "." : "Với dấu này, các ô đã đánh dấu không còn lời giải nào khớp mọi clue (mâu thuẫn với các ô đánh dấu trước nó).", "Xoá dấu để quay về trạng thái đúng rồi tiếp tục suy luận."] };
    }
    st = nextStep(Q, known, ref.sol);
    if (!st) return none("Không còn ô nào để gợi ý.");
    if (st.kind === "contra") return none("Các ô đã đánh dấu mâu thuẫn nhau; hãy xoá bớt rồi xin gợi ý lại.");
    if (st.kind === "line") {
      lbl = lineLabel(st.axis, st.idx); cellsAll = st.fills.concat(st.empties);
      if (level === 1) return { level: 1, text: "Hãy xem " + lbl + ".", why: [], cells: lineCellIdx(Q, st.line), regions: { axis: st.axis, idx: st.idx } };
      if (level === 2) return { level: 2, text: cap(lbl) + " (clue " + clueStr(st.B) + ", dài " + st.n + " ô): " + NO_WORDS_HINT[st.technique] + ". Có " + cellsAll.length + " ô xác định được ngay.", why: [], cells: cellsAll, regions: { axis: st.axis, idx: st.idx }, technique: st.technique };
      var why = st.why.slice();
      if (st.fills.length && st.empties.length) why.push("Dòng này còn " + st.empties.length + " ô chắc chắn trống — hãy gạch chúng ở bước sau.");
      return { level: 3, text: st.text, why: why, cells: cellsAll, regions: { axis: st.axis, idx: st.idx }, technique: st.technique,
        action: st.fills.length ? { k: "fill", cells: st.fills.slice(), val: 1 } : { k: "fill", cells: st.empties.slice(), val: 2 } };
    }
    cell = st.cell; r = Math.floor(cell / w); c = cell - r * w;
    if (level === 1) return { level: 1, text: "Logic từng dòng đã hết cách. Hãy chú ý hàng " + (r + 1) + " và thử giả định cho một ô.", why: [], cells: lineCellIdx(Q, r), regions: { axis: "r", idx: r } };
    if (level === 2) return { level: 2, text: "Logic từng dòng đã hết cách: hãy thử giả định cho ô (hàng " + (r + 1) + ", cột " + (c + 1) + ") rồi lan truyền.", why: [], cells: [cell], technique: st.technique };
    return { level: 3, text: st.text, why: st.why.slice(), cells: [cell], technique: st.technique, action: { k: "fill", cells: [cell], val: st.val } };
  }

  /** replay: chuỗi bước từ ván trắng tới khi mọi hàng/cột khớp. Mỗi bước gộp các ô chốt (tô + gạch) của một dòng; bước "probe"/"guess" ghi rõ. */
  function replay(puzzle) {
    var q = toQ(puzzle), Q, N, known, ref, steps = [], guard = 0, st, d, i, cells, kind;
    if (!q.ok) return [];
    Q = q.Q; N = Q.w * Q.h; known = new Uint8Array(N); ref = refInfo(puzzle);
    while (!isSolvedGrid(Q, known) && guard++ < N + 5) {
      st = nextStep(Q, known, ref.sol);
      if (!st || st.kind === "contra") break;
      d = []; cells = [];
      for (i = 0; i < st.fills.length; i++) { d.push(["v", st.fills[i], known[st.fills[i]], 1]); known[st.fills[i]] = 1; cells.push(st.fills[i]); }
      for (i = 0; i < st.empties.length; i++) { d.push(["v", st.empties[i], known[st.empties[i]], 2]); known[st.empties[i]] = 2; cells.push(st.empties[i]); }
      kind = st.kind === "line" ? lineLabel(st.axis, st.idx) : st.technique === "probe" ? "giả định phản chứng" : "đoán";
      steps.push({ text: st.text, why: st.why, diff: { d: d, label: cap(kind) }, cells: cells, technique: st.technique });
    }
    return steps;
  }

  /* ======================================================================================================= */
  /*  constraintView, trace                                                                                     */
  /* ======================================================================================================= */
  function constraintView(puzzle) {
    var q = toQ(puzzle), Q, N, vars = [], cons = [], r, c, blocks = 0, filled = 0, j;
    if (!q.ok) return { summary: "Đề không hợp lệ: " + q.errors.join(" "), variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    Q = q.Q; N = Q.w * Q.h;
    if (N < 40) { for (r = 0; r < Q.h; r++) for (c = 0; c < Q.w; c++) vars.push({ name: "Ô (hàng " + (r + 1) + ", cột " + (c + 1) + ")", domain: "{trống, tô}" }); }
    else vars.push({ name: "Ô (hàng, cột) — mỗi ô một biến", domain: "{trống, tô}", count: N });
    for (r = 0; r < Q.h; r++) { cons.push("Hàng " + (r + 1) + ": " + clueStr(Q.rows[r])); blocks += Q.rows[r].length; for (j = 0; j < Q.rows[r].length; j++) filled += Q.rows[r][j]; }
    for (c = 0; c < Q.w; c++) { cons.push("Cột " + (c + 1) + ": " + clueStr(Q.cols[c])); blocks += Q.cols[c].length; }
    return { summary: "Nonogram " + Q.w + "×" + Q.h + ": " + N + " biến nhị phân (ô tô hoặc trống), " + (Q.h + Q.w) + " ràng buộc dạng dãy khối (mỗi hàng/cột phải khớp clue của nó); hai ràng buộc chung nhau đúng một ô.",
      variables: vars, constraints: cons, counts: { variables: N, constraints: Q.h + Q.w, rows: Q.h, cols: Q.w, blocks: blocks, filledCells: filled } };
  }

  function matrixOf(Q, g) {
    var m = [], r, c, row, v;
    for (r = 0; r < Q.h; r++) { row = []; for (c = 0; c < Q.w; c++) { v = g[r * Q.w + c]; row.push(v === 1 ? "#" : v === 2 ? "x" : "."); } m.push(row); }
    return m;
  }
  /** trace: ma trận w×h ('.' chưa biết, '#' tô, 'x' trống) sau từng bước lan truyền (≤ 60 bước). Ít bước → mỗi bước một dòng; nhiều bước → gộp theo vòng. Có phần quay lui thì ghi chú. */
  function trace(puzzle, opts) {
    var q = toQ(puzzle), Q, N, an, steps, grid, out = [], i, s, k, groups, g, rows, cols, first, total, truncated = false, note, final, cap1 = 57;
    if (!q.ok) return { kind: "matrix", title: "Nonogram", steps: [], note: "Đề không hợp lệ: " + q.errors.join(" ") };
    Q = q.Q; N = Q.w * Q.h;
    an = analyze(Q, { limit: 2, maxNodes: 3000, maxWork: 30000, text: true, keep: 1 });
    steps = an.st.steps; grid = new Uint8Array(N); total = steps.length;
    out.push({ text: "Bắt đầu: chưa biết ô nào (mọi ô là '.').", matrix: matrixOf(Q, grid) });
    function apply(st) { var t; for (t = 0; t < st.fills.length; t++) grid[st.fills[t]] = 1; for (t = 0; t < st.empties.length; t++) grid[st.empties[t]] = 2; }
    function pivotOf(st) { var cell = st.fills.length ? st.fills[0] : st.empties[0], r = Math.floor(cell / Q.w); return [r, cell - r * Q.w]; }
    if (total <= cap1) {
      for (i = 0; i < steps.length; i++) { s = steps[i]; apply(s); out.push({ text: s.text, matrix: matrixOf(Q, grid), pivot: pivotOf(s) }); }
      note = "Mỗi bước là một hàng hoặc cột được suy luận (" + total + " bước)";
    } else {
      groups = {}; for (i = 0; i < steps.length; i++) { k = steps[i].wave; (groups[k] || (groups[k] = [])).push(steps[i]); }
      k = 0;
      for (g in groups) {
        if (out.length >= cap1 + 1) { truncated = true; break; }
        rows = []; cols = []; first = groups[g][0];
        for (i = 0; i < groups[g].length; i++) { s = groups[g][i]; apply(s); (s.axis === "r" ? rows : cols).push(s.idx + 1); }
        out.push({ text: "Vòng " + g + ": " + groups[g].length + " dòng có ô mới chốt" + (rows.length ? " — hàng " + rows.join(", ") : "") + (cols.length ? (rows.length ? " ·" : " —") + " cột " + cols.join(", ") : "") + ".", matrix: matrixOf(Q, grid), pivot: pivotOf(first) });
      }
      note = "Có " + total + " bước suy luận dòng nên được gộp theo vòng lan truyền" + (truncated ? " (chỉ ghi " + (out.length - 1) + " vòng đầu)" : "");
    }
    if (an.count >= 1) {
      final = an.solutions[0];
      out.push({ text: an.rootUnknown ? "Logic dòng bế tắc ở " + an.rootUnknown + " ô; quay lui giải nốt (" + an.decisions + " lần chọn ô, " + an.nodes + " nút) — đây là ma trận đáp án." : (truncated ? "Tiếp tục các vòng còn lại: ma trận đáp án (không cần đoán)." : "Hết suy luận: ma trận đã đầy — không cần đoán."), matrix: matrixOf(Q, final) });
    } else out.push({ text: "Lan truyền gặp mâu thuẫn: đề vô nghiệm.", matrix: matrixOf(Q, grid) });
    if (out.length > 60) out.length = 60;
    return { kind: "matrix", title: "Lan truyền theo dòng — Nonogram " + Q.w + "×" + Q.h, steps: out, note: note + "." };
  }

  /* ======================================================================================================= */
  /*  Định dạng chia sẻ                                                                                         */
  /* ======================================================================================================= */
  function clueLine(list) { return list.length ? list.join(",") : "0"; }
  function cluesCompact(Q) { return Q.rows.map(clueLine).join(";") + "|" + Q.cols.map(clueLine).join(";"); }
  function solToBits(p, N) { var sv = p.solution && p.solution.v, s = "", i; if (!sv || sv.length !== N) return ""; for (i = 0; i < N; i++) s += sv[i] === 1 ? "1" : "0"; return s; }

  function toFile(puzzle) {
    var q = toQ(puzzle), Q, md = {}, k;
    if (!q.ok) return { type: "nonogram", seed: null, difficulty: 0, size: null, initialState: "", solution: "", metadata: {} };
    Q = q.Q;
    for (k in (puzzle.meta || {})) if (typeof puzzle.meta[k] === "string") md[k] = puzzle.meta[k];
    md.tier = puzzle.tier; md.sizeId = puzzle.sizeId;
    return { type: "nonogram", seed: puzzle.seed == null ? null : puzzle.seed, difficulty: puzzle.score, size: { w: Q.w, h: Q.h }, initialState: cluesCompact(Q), solution: solToBits(puzzle, Q.w * Q.h), metadata: md };
  }
  function parseCompactSide(s) {
    var out = [], parts = s.split(";"), i, line;
    for (i = 0; i < parts.length; i++) { line = normLine(parts[i].replace(/,/g, " ")); if (!line) return null; out.push(line); }
    return out;
  }
  function fromFile(obj) {
    var errors = [], w, h, parts, rows, cols, res, sz;
    try {
      if (!obj || typeof obj !== "object") return { ok: false, puzzle: null, errors: ["Tệp trống hoặc sai định dạng."], warnings: [] };
      if (obj.type !== "nonogram") return { ok: false, puzzle: null, errors: ["Tệp không phải đề Nonogram (" + (typeof obj.type === "string" ? "type = " + obj.type : "thiếu trường type") + ")."], warnings: [] };
      if (typeof obj.initialState !== "string" || !obj.initialState.trim()) return { ok: false, puzzle: null, errors: ["Thiếu initialState (chuỗi clue \"hàng|cột\")."], warnings: [] };
      parts = obj.initialState.trim().split("|");
      if (parts.length !== 2) return { ok: false, puzzle: null, errors: ["initialState phải có dạng \"clue hàng|clue cột\" (đúng một dấu |)."], warnings: [] };
      rows = parseCompactSide(parts[0]); cols = parseCompactSide(parts[1]);
      if (!rows || !cols) return { ok: false, puzzle: null, errors: ["initialState chứa clue không hợp lệ (chỉ nhận số nguyên dương; dòng trống ghi 0)."], warnings: [] };
      w = cols.length; h = rows.length;
      sz = obj.size;
      if (sz && typeof sz === "object" && (sz.w !== w || sz.h !== h)) return { ok: false, puzzle: null, errors: ["Cỡ ghi trong tệp (" + sz.w + "×" + sz.h + ") không khớp số clue (" + w + " cột × " + h + " hàng)."], warnings: [] };
      res = fromInput({ w: w, h: h, rows: rows, cols: cols, meta: obj.metadata });
      if (res.ok && typeof obj.solution === "string" && obj.solution && !satisfies(toQ(res.puzzle).Q, obj.solution.split("").map(function (ch) { return ch === "1" ? 1 : 2; }))) res.warnings.push("Lời giải ghi trong tệp không khớp clue nên đã bỏ qua (bộ giải tự tìm lại).");
      return { ok: res.ok, puzzle: res.puzzle, errors: res.errors, warnings: res.warnings, status: res.status, count: res.count };
    } catch (e) {
      return { ok: false, puzzle: null, errors: ["Không đọc được tệp."], warnings: [] };
    }
  }

  function toText(puzzle) {
    var q = toQ(puzzle), Q;
    if (!q.ok) return "";
    Q = q.Q;
    return "Nonogram " + Q.w + "x" + Q.h + "\nRows: " + Q.rows.map(clueStr).join(" | ") + "\nCols: " + Q.cols.map(clueStr).join(" | ");
  }
  function fromText(text) {
    var rowsTxt = null, colsTxt = null, lines, i, m, label, head, hw = null, hh = null, rows = [], cols = [], parts, t, line, res, compact;
    try {
      if (typeof text !== "string" || !text.trim()) return { ok: false, puzzle: null, errors: ["Văn bản trống."], warnings: [] };
      lines = text.replace(/\r/g, "").split("\n");
      for (i = 0; i < lines.length; i++) {
        line = lines[i].trim();
        if (!line) continue;
        m = /^([^:：]+)[:：](.*)$/.exec(line);
        if (m) {
          label = m[1].trim().toLowerCase();
          if (/^(rows?|hàng|hang)$/.test(label)) { rowsTxt = m[2]; continue; }
          if (/^(cols?|columns?|cột|cot)$/.test(label)) { colsTxt = m[2]; continue; }
        }
        head = /(\d+)\s*[x×*]\s*(\d+)/.exec(line);
        if (head && /nonogram/i.test(line)) { hw = +head[1]; hh = +head[2]; }
      }
      if (rowsTxt == null || colsTxt == null) {
        compact = text.trim().replace(/\s*\n\s*/g, "");
        parts = compact.split("|");
        if (parts.length === 2 && rowsTxt == null && colsTxt == null) {
          rows = parseCompactSide(parts[0]); cols = parseCompactSide(parts[1]);
          if (!rows || !cols) return { ok: false, puzzle: null, errors: ["Dạng gọn \"hàng|cột\" chứa clue không hợp lệ."], warnings: [] };
          res = fromInput({ w: cols.length, h: rows.length, rows: rows, cols: cols });
          return { ok: res.ok, puzzle: res.puzzle, errors: res.errors, warnings: res.warnings, status: res.status, count: res.count };
        }
        return { ok: false, puzzle: null, errors: ["Không thấy dòng \"Rows:\" và \"Cols:\" (mỗi clue cách nhau bằng dấu |)."], warnings: [] };
      }
      parts = rowsTxt.split("|"); for (i = 0; i < parts.length; i++) { t = normLine(parts[i]); if (!t) return { ok: false, puzzle: null, errors: ["Clue hàng " + (i + 1) + " không hợp lệ."], warnings: [] }; rows.push(t); }
      parts = colsTxt.split("|"); for (i = 0; i < parts.length; i++) { t = normLine(parts[i]); if (!t) return { ok: false, puzzle: null, errors: ["Clue cột " + (i + 1) + " không hợp lệ."], warnings: [] }; cols.push(t); }
      if (hw != null && (hw !== cols.length || hh !== rows.length)) return { ok: false, puzzle: null, errors: ["Tiêu đề ghi " + hw + "x" + hh + " nhưng có " + cols.length + " clue cột và " + rows.length + " clue hàng."], warnings: [] };
      res = fromInput({ w: cols.length, h: rows.length, rows: rows, cols: cols });
      return { ok: res.ok, puzzle: res.puzzle, errors: res.errors, warnings: res.warnings, status: res.status, count: res.count };
    } catch (e) {
      return { ok: false, puzzle: null, errors: ["Không đọc được văn bản."], warnings: [] };
    }
  }

  /* ======================================================================================================= */
  /*  Đăng ký                                                                                                   */
  /* ======================================================================================================= */
  var techNames = {}; (function () { for (var k in TECH) techNames[k] = TECH[k].name; })();

  P.types.register({
    id: "nonogram", name: "Nonogram", family: "Grid Puzzle", category: "Ràng buộc", icon: "▦",
    blurb: "Tô ô theo dãy số gợi ý ở đầu mỗi hàng và cột để hiện ra một bức tranh ẩn.",
    rules: [
      "Tô các ô trong lưới sao cho mỗi hàng và mỗi cột khớp dãy số gợi ý (clue) ghi ở đầu dòng.",
      "Mỗi số trong clue là độ dài của một khối ô tô liền nhau; các khối nằm đúng thứ tự (hàng: từ trái sang phải, cột: từ trên xuống dưới).",
      "Giữa hai khối liên tiếp phải có ít nhất một ô trống. Clue 0 nghĩa là cả dòng không tô ô nào.",
      "Dùng dấu gạch để đánh dấu ô chắc chắn trống — chúng giúp suy luận ở hàng/cột giao nhau. Ô chưa chắc chắn cứ để nguyên.",
      "Đề sinh ra luôn có đúng một lời giải; đề Dễ đến Khó giải được hoàn toàn bằng suy luận từng dòng, đề Chuyên gia đôi khi cần thử giả định."
    ],
    sizes: SIZES,
    algorithm: {
      title: "Giao mọi cách đặt trên từng dòng, lan truyền tới điểm cố định, quay lui khi bế tắc",
      steps: [
        { title: "Một dòng: quy hoạch động tiền tố / hậu tố", text: "Với mỗi hàng hoặc cột (dài n, k khối), tính bảng \"đã xét bao nhiêu ô, đã đặt bao nhiêu khối\" theo chiều xuôi rồi chiều ngược, có tính các ô đã biết. Từ hai bảng đó biết ngay mọi cách đặt hợp lệ trong O(n·k) — rất nhanh với n ≤ 25." },
        { title: "Giao của mọi cách đặt", text: "Ô nào tô trong MỌI cách đặt thì chắc chắn tô; ô nào trống trong mọi cách thì chắc chắn trống. Các kỹ thuật quen thuộc của người chơi (chồng lấn, khối đã chốt vị trí, ô không với tới, dòng đã đủ, dòng vừa khít) đều là trường hợp riêng của phép giao này." },
        { title: "Lan truyền theo vòng tới điểm cố định", text: "Ô vừa chốt làm hàng và cột giao nhau \"bẩn\" nên phải xét lại. Lặp theo vòng cho tới khi không còn ô mới. Số vòng và độ \"nặng\" của các suy luận là một phần của điểm khó." },
        { title: "Quay lui khi bế tắc", text: "Còn ô chưa biết: chọn dòng có ít ô chưa biết nhất, thử tô rồi thử gạch một ô, lan truyền, và đếm nghiệm (tối đa 2) để biết đề vô nghiệm, duy nhất hay nhiều nghiệm. Số lần phải chọn ô chính là \"số lần đoán\"." }
      ],
      links: [{ id: "backtracking", label: "Quay lui (Backtracking)" }, { id: "dfs", label: "DFS — duyệt theo chiều sâu" }]
    },
    difficultyNote: "Điểm 0–10 = nền theo kích thước (√(w·h)) + độ khó logic: chi phí các suy luận dòng (chồng lấn/chốt nhẹ, \"giao mọi cách đặt\" nặng hơn), số vòng lan truyền cần để suy ra hết, và số lần phải đoán cùng số ô còn lại sau logic dòng.",
    techniques: techNames,
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty,
    newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes, hint: hint, replay: replay,
    constraintView: constraintView, trace: trace, describeCell: describeCell,
    toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
