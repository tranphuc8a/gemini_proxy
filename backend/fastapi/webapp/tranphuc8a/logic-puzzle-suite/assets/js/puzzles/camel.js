/* puzzles/camel.js — LẠC ĐÀ CHỞ CHUỐI (V1: MỘT lạc đà): kho B quả chuối ở A, sức chở C quả, mỗi km đi ăn 1 quả (KỂ CẢ khi quay về), vị trí là số km NGUYÊN,
   được đặt kho trung gian ở mọi km. Hai bài: "đi xa nhất" (điểm xa A nhất lạc đà từng tới) và "chở tới đích D" (số chuối có ở km D). Loại optimize
   (HUONG-DAN-ENGINE.md mục 11): người chơi LẬP KẾ HOẠCH (lấy / đặt / đi tới), engine mô phỏng kiểm luật, NỘP kế hoạch → chấm so với tối ưu (Puz.grade.fromRatio).

   ── Lõi toán ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Luồng qua một đoạn [x, x+1]: lạc đà đi qua theo chiều tới f lần và chiều lùi f−1 lần; mỗi lượt tới chở ≤ C và ăn 1, mỗi lượt lùi phải mang ≥ 1 (để ăn). Gọi S_x là
   số chuối dồn được tới km x thì S_{x+1} ≤ g(S_x), g(S) = max_{f≥1} [min(S, f·C) − (2f−1)]. g không giảm ⇒ THAM LAM theo từng km là tối ưu (luôn giữ S lớn nhất) và đạt được
   bằng đưa-đón. Vậy (rời rạc, luật của game): S_0 = B, S_{x+1} = g(S_x); "xa nhất" = max_x (x + min(S_x, C)); "tới D" = S_D. g tự quyết định BỎ LẠI phần thừa
   (S = 1001, C = 1000: đi 1 chuyến mang 1000 ⇒ 999 tốt hơn 2 chuyến ⇒ 998). Dạng đóng liên tục: S ∈ ((k−1)C, kC] cần k = ⌈S/C⌉ chuyến ⇒ 2k−1 quả/km;
   pha đầu dài (B−(k−1)C)/(2k−1), các pha sau C/(2j−1), j = k−1…1 (bài jeep). Hai đáp án trùng nhau khi mọi ranh giới pha là số nguyên — bộ sinh chọn số như vậy
   (cho đáp án nguyên km = đáp án liên tục), riêng họ "không nguyên" (3000/1000: liên tục 533⅓ nhưng km nguyên chỉ 533) cố ý để lộ khác biệt đó.
   Cả QHĐ lẫn bộ đánh giá LB2 đã được kiểm bằng vét cạn MỌI kế hoạch (kiem/camel.js); chưa có chứng minh hình thức cho LB2 nên gợi ý chỉ khẳng định theo cách an toàn
   (xem lb2 / hint).

   ── Trạng thái (Puz.plan, mục 11.2) ───────────────────────────────────────────────────────────────────────────────────────────
   layout(cap = 160, W = 3, extra = 0): bản ghi [lạc đà, thao tác, đối số]; lạc đà luôn 0 (chỗ dành cho V2 — đoàn lạc đà, hoãn); thao tác 1 = ĐI tới km x, 2 = LẤY n quả từ kho
   tại chỗ, 3 = ĐẶT n quả xuống kho tại chỗ. Cờ "đã nộp" nằm trong state (solution.v có cờ ⇒ Reveal và check(solution) chạy đúng).
   Action: {k:"go", x} · {k:"load", n} · {k:"drop", n} · {k:"steps", ops:[{op:"go"|"load"|"drop", n}]} (nhiều thao tác = một diff, hợp lệ cả lô hoặc không gì)
         · {k:"trip", to} (chuyến tiếp tế: lấy đầy, đi tới km, đặt phần thừa giữ đủ ăn để về, quay về — một diff) · {k:"run"} (lấy đầy và đi hết sức về phía trước)
         · {k:"truncate", n} (quay kế hoạch về n bước / mở lại sau khi nộp) · {k:"submit"}.
   def.sim.preview(puzzle, state, action) → {ok, error, after} cho bàn xem trước (bàn không tự cài luật).

   solved = đã nộp VÀ kế hoạch không rỗng. grade = fromRatio(giá trị, tối ưu, "max"). mistakes = số nước làm MẤT tối ưu (LB2 trước = tối ưu, sau < tối ưu). */
(function (root) {
  "use strict";
  var P = root.Puz;
  var plan = P.plan, G = P.grade;

  var CAP = 160, W = 3;
  var MAX_B = 20000, MAX_C = 2000, MAX_K = 7, MAX_X = 5000;                // giới hạn đề tự nhập (LB2 < 1 s, kế hoạch tối ưu vừa CAP)
  var OP_GO = 1, OP_LOAD = 2, OP_DROP = 3;
  var LAYOUT = plan.layout(CAP, W, 0);
  var BUDGET = 6e7;                                                          // ngân sách công việc của LB2 (số ứng viên × độ dài bản đồ)

  function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function copyState(s) { return { v: s.v.slice(), c: null }; }
  function after(s, diff) { var t = copyState(s); P.game.applyDiff(t, diff.d, false); return t; }
  function nf(n) { return G.fmt(n, 0); }

  // ================================================================================================= phân số nhỏ (dạng đóng liên tục) — số nguyên thường, mẫu ≤ lcm lẻ nhỏ
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function F(n, d) { d = d === undefined ? 1 : d; if (d < 0) { n = -n; d = -d; } var g = gcd(n, d); return { n: n / g, d: d / g }; }
  function fadd(a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fsub(a, b) { return F(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fmul(a, b) { return F(a.n * b.n, a.d * b.d); }
  function fdiv(a, b) { return F(a.n * b.d, a.d * b.n); }
  function fcmp(a, b) { var x = a.n * b.d - b.n * a.d; return x < 0 ? -1 : x > 0 ? 1 : 0; }
  function fval(a) { return a.n / a.d; }
  /** "533" · "533 1/3" · "2/3". */
  function fText(a) {
    if (a.d === 1) return nf(a.n);
    var w = Math.floor(a.n / a.d), r = a.n - w * a.d;
    return (w ? nf(w) + " " : "") + r + "/" + a.d;
  }
  /** Số chuyến chở để mang hết S: k = ⌈S/C⌉ (S phân số). */
  function loadsOfF(S, C) { return Math.max(1, Math.ceil(S.n / (S.d * C))); }

  /** Xa nhất (liên tục): pha đầu k chuyến dài (B−(k−1)C)/(2k−1), rồi C/(2j−1) cho j = k−1…1. */
  function farCont(B, C) {
    var k = Math.max(1, Math.ceil(B / C)), first = F(B - (k - 1) * C, 2 * k - 1), tot = first, phases = [{ loads: k, len: first }];
    for (var j = k - 1; j >= 1; j--) { var ln = F(C, 2 * j - 1); tot = fadd(tot, ln); phases.push({ loads: j, len: ln }); }
    return { far: tot, phases: phases };
  }
  /** Số chuối tới đích D (liên tục) + các pha đã đi qua. */
  function deliverCont(B, C, D) {
    var pos = F(0), S = F(B), Df = F(D), log = [], zero = F(0);
    for (var guard = 0; guard < 200; guard++) {
      if (fcmp(S, zero) <= 0) return { left: zero, log: log };
      var k = loadsOfF(S, C), seg = fdiv(fsub(S, F((k - 1) * C)), F(2 * k - 1));
      if (fcmp(fadd(pos, seg), Df) >= 0) {
        var rest = fsub(Df, pos), left = fsub(S, fmul(F(2 * k - 1), rest));
        log.push({ loads: k, from: pos, to: Df });
        return { left: fcmp(left, zero) < 0 ? zero : left, log: log };
      }
      log.push({ loads: k, from: pos, to: fadd(pos, seg) });
      pos = fadd(pos, seg); S = F((k - 1) * C);
    }
    return { left: zero, log: log };
  }

  // ================================================================================================= QHĐ rời rạc theo từng km
  /** Chuyển CẢ đống S sang km kế: chọn f chuyến (mang min(S, f·C), ăn 2f−1 quả/km), bỏ lại phần thừa nếu có lợi. v < 0 nếu không đi nổi. */
  function gstep(S, C) {
    var best = -1, bf = 0, top = Math.ceil(S / C) + 1;
    for (var f = 1; f <= top; f++) { var m = Math.min(S, f * C); if (m < 2 * f - 1) continue; var v = m - (2 * f - 1); if (v > best) { best = v; bf = f; } }
    return { v: best, f: bf };
  }
  function farDisc(B, C) {
    var S = B, x = 0, best = Math.min(S, C);
    while (S >= 1) { var r = gstep(S, C); if (r.v < 0) break; S = r.v; x++; if (x + Math.min(S, C) > best) best = x + Math.min(S, C); }
    return best;
  }
  function deliverDisc(B, C, D) { var S = B; for (var x = 0; x < D; x++) { if (S < 1) return 0; S = gstep(S, C).v; if (S < 0) return 0; } return S; }
  /** Các pha rời rạc của chuỗi tham lam: [{from, to, S0, f, len, S1, left}] (left = chuối bỏ lại ở km đầu pha). goal "deliver" dừng ở D. */
  function discPhases(B, C, goal, D) {
    var S = B, x = 0, out = [], stop = goal === "deliver" ? D : 1e9;
    while (S >= 1 && x < stop) {
      var r = gstep(S, C); if (r.v < 0) break;
      var cur = { from: x, S0: S, f: r.f, len: 0, left: Math.max(0, S - r.f * C) };
      while (S >= 1 && x < stop) {
        var q = gstep(S, C); if (q.v < 0 || q.f !== cur.f) break;
        S = q.v; x++; cur.len++;
      }
      if (!cur.len) break;
      cur.to = x; cur.S1 = S; out.push(cur);
    }
    return out;
  }

  // ================================================================================================= đề: dữ liệu, bố cục, độ khó
  function layoutOf() { return LAYOUT; }
  function modeOk(m) { return m === "far" || m === "deliver"; }
  function dataOf(mode, B, C, D) {
    var best = mode === "far" ? farDisc(B, C) : deliverDisc(B, C, D), cont = mode === "far" ? farCont(B, C).far : deliverCont(B, C, D).left;
    var ph = discPhases(B, C, mode, D).slice(0, 12).map(function (q) { return { loads: q.f, from: q.from, to: q.to }; });
    return { mode: mode, B: B, C: C, D: mode === "deliver" ? D : 0, cap: CAP, maxX: mode === "far" ? best + 1 : D, best: best, bestCont: fText(cont), contInt: cont.d === 1 && cont.n === best, phases: ph };
  }
  function dataOk(d) { return !!d && modeOk(d.mode) && isInt(d.B, 1, MAX_B) && isInt(d.C, 1, MAX_C) && isInt(d.D, 0, MAX_X) && isInt(d.best, 0, MAX_B) && isInt(d.maxX, 1, MAX_X + 1) && d.cap === CAP; }

  var scoreMemo = {};
  /** Điểm 0–10 (số nguyên /10, nên bậc đúng tuyệt đối): 1 + 1,7·(k−1) + 1,4·[pha đầu lẻ: B không chia hết C] + 0,6·[tới D] + 1,5·[ranh giới không nguyên: liên tục ≠ rời rạc],
      k = ⌈B/C⌉ = số chuyến chở ở pha đầu. Dễ 2,7–3,3 · Vừa 4,1–5,0 · Khó 5,6–6,7 · Chuyên gia ≥ 7,5. */
  function scoreOf(d) {
    var key = [d.mode, d.B, d.C, d.D].join("|");
    if (scoreMemo[key] !== undefined) return scoreMemo[key];
    var k = Math.max(1, Math.ceil(d.B / d.C)), odd = d.B % d.C !== 0 ? 1 : 0, dl = d.mode === "deliver" ? 1 : 0;
    var best = d.mode === "far" ? farDisc(d.B, d.C) : deliverDisc(d.B, d.C, d.D), cont = d.mode === "far" ? farCont(d.B, d.C).far : deliverCont(d.B, d.C, d.D).left;
    var nonint = cont.d === 1 && cont.n === best ? 0 : 1;
    var sc = P.util.clampScore((10 + 17 * (k - 1) + 14 * odd + 6 * dl + 15 * nonint) / 10);
    scoreMemo[key] = sc;
    return sc;
  }

  // ================================================================================================= mô phỏng luật
  function newSim(d) { var dep = zeros(d.maxX + 1); dep[0] = d.B; return { pos: 0, load: 0, dep: dep, far: 0 }; }
  /** Áp MỘT thao tác lên sim; trả chuỗi lỗi (tiếng Việt) hoặc null. */
  function stepSim(d, sim, op, arg) {
    if (op === OP_GO) {
      if (!isInt(arg, 0, d.maxX)) return "Km " + arg + " nằm ngoài bản đồ" + (d.mode === "deliver" ? " (đích D ở km " + d.D + ")." : ".");
      var dist = Math.abs(arg - sim.pos);
      if (dist === 0) return "Lạc đà đang ở km " + arg + " rồi.";
      if (dist > sim.load) return "Đi " + dist + " km cần " + dist + " quả để ăn dọc đường nhưng chỉ đang chở " + sim.load + ".";
      sim.load -= dist; sim.pos = arg; if (arg > sim.far) sim.far = arg;
      return null;
    }
    if (op === OP_LOAD) {
      if (!isInt(arg, 1, 1e9)) return "Số quả phải là số nguyên dương.";
      if (arg > sim.dep[sim.pos]) return "Kho ở km " + sim.pos + " chỉ có " + sim.dep[sim.pos] + " quả.";
      if (sim.load + arg > d.C) return "Sức chở tối đa " + d.C + " quả (đang chở " + sim.load + ").";
      sim.dep[sim.pos] -= arg; sim.load += arg;
      return null;
    }
    if (op === OP_DROP) {
      if (!isInt(arg, 1, 1e9)) return "Số quả phải là số nguyên dương.";
      if (arg > sim.load) return "Chỉ đang chở " + sim.load + " quả.";
      sim.dep[sim.pos] += arg; sim.load -= arg;
      return null;
    }
    return "Thao tác lạ.";
  }
  /** Chạy cả danh sách bản ghi [[lạc đà, op, arg]…]; {sim, ok, at, why}. */
  function runRecs(d, recs) {
    var sim = newSim(d);
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], why = r[0] !== 0 ? "Chỉ có một lạc đà." : stepSim(d, sim, r[1], r[2]);
      if (why) return { sim: sim, ok: false, at: i, why: why };
    }
    return { sim: sim, ok: true, at: -1, why: null };
  }
  function valueOfSim(d, sim) { return d.mode === "far" ? sim.far : sim.dep[d.D] + (sim.pos === d.D ? sim.load : 0); }
  function recsOf(p, s) { return plan.read(s, LAYOUT); }
  function simOf(p, s) { return runRecs(p.data, recsOf(p, s)); }
  function valueOf(p, s) { var r = simOf(p, s); return r.ok ? valueOfSim(p.data, r.sim) : null; }

  // ================================================================================================= LB2 — "từ trạng thái này còn đạt tối đa bao nhiêu, và đi thế nào"
  /** Trạng thái chuẩn hoá: gộp phần đang chở vào kho tại chỗ (đổi chở ↔ kho tại chỗ không tốn gì). */
  function canon(sim) { var dep = sim.dep.slice(); dep[sim.pos] += sim.load; return { p: sim.pos, dep: dep, far: sim.far }; }
  /** Quét từ L bằng QHĐ S_{x+1} = g(S_x) + dep[x+1] (kho phía trước được cộng khi đi qua). far: điểm xa nhất đạt; deliver: số chuối ở D. */
  function sweepValue(d, L, dd) {
    var S = dd[L], x = L, Mx = d.maxX;
    if (d.mode === "deliver" && L === d.D) return S;
    while (x < Mx) {
      if (S < 1) break;
      var r = gstep(S, d.C); if (r.v < 0) break;
      S = r.v + dd[x + 1]; x++;
      if (d.mode === "deliver" && x === d.D) return S;
    }
    return d.mode === "deliver" ? 0 : x;
  }
  /** Hành trình p → R (đi tới lấy thức ăn) → L (lùi gom kho cũ): đoạn tới [x,x+1] ăn 1 quả lấy ở vị trí NHỎ NHẤT còn chuối trong [p..x]; đoạn lùi [x−1,x] ăn 1 quả lấy ở vị trí
      nhỏ nhất còn chuối trong [x..R]; kiểm sức chở C ở mọi lúc. Trả {dd (kho sau hành trình), pickF, pickB} hoặc null nếu không làm được. O(độ dài + số kho). */
  function excursion(p, R, L, dep, C) {
    var dd = dep.slice(), pickF = {}, pickB = {}, x, y, z, acc;
    if (R > p) {
      y = p;
      for (x = p; x < R; x++) { while (y <= x && dd[y] <= 0) y++; if (y > x) return null; dd[y]--; pickF[y] = (pickF[y] || 0) + 1; }
      acc = 0;
      for (z = p; z < R; z++) { acc += pickF[z] || 0; if (acc - (z - p) > C) return null; }          // mang khi rời z = số lấy ở ≤ z trừ số đoạn đã ăn
    }
    if (L < R) {
      var diff = {}, q = L + 1, cur = 0;
      for (x = L + 1; x <= R; x++) {
        if (q < x) q = x;
        while (q <= R && dd[q] <= 0) q++;
        if (q > R) return null;
        dd[q]--; pickB[q] = (pickB[q] || 0) + 1;
        diff[x] = (diff[x] || 0) + 1; diff[q + 1] = (diff[q + 1] || 0) - 1;                       // mỗi đoạn lùi (x, nguồn q) chiếm một chỗ mang trên z ∈ [x, q]
      }
      for (z = L + 1; z <= R; z++) { cur += diff[z] || 0; if (cur > C) return null; }
    }
    return { dd: dd, pickF: pickF, pickB: pickB };
  }
  function trimList(a, n) { return a.length <= n ? a : a.slice(0, n - 4).concat(a.slice(a.length - 4)); }
  /** LB2: giá trị lớn nhất của MỘT kế hoạch dựng được từ trạng thái chuẩn hoá st (luôn ≤ tối ưu thật; kiểm vét cạn: bằng tối ưu ở mọi trạng thái đạt được của 15 bộ).
      Trả {v, R, L, ex, approx} — v là giá trị tính từ trạng thái chuẩn hoá (far: chưa gộp điểm xa đã tới trước đó). */
  function lb2(d, st) {
    var p = st.p, dep = st.dep, Mx = d.maxX, Rs = [p], Ls = [p], R, L, i;
    for (R = p + 1; R <= Mx; R++) if (dep[R] > 0) Rs.push(R);
    for (L = p - 1; L >= 0; L--) if (dep[L] > 0) Ls.push(L);
    var approx = false;
    if (Rs.length * Ls.length * (Mx + 1) > BUDGET) { Rs = trimList(Rs, 12); Ls = trimList(Ls, 12); approx = true; }
    var best = { v: d.mode === "far" ? p : dep[d.D], R: p, L: p, ex: null, approx: approx };
    for (i = 0; i < Rs.length; i++) for (var j = 0; j < Ls.length; j++) {
      var ex = excursion(p, Rs[i], Ls[j], dep, d.C);
      if (!ex) continue;
      var v = sweepValue(d, Ls[j], ex.dd);
      if (d.mode === "far" && Rs[i] > v) v = Rs[i];
      if (v > best.v) best = { v: v, R: Rs[i], L: Ls[j], ex: ex, approx: approx };
    }
    return best;
  }

  var reachMemo = {}, reachCount = 0;
  /** Giá trị lớn nhất còn đạt được từ kế hoạch recs (far: gộp điểm xa đã tới) + bộ mô phỏng. null nếu kế hoạch không hợp lệ. */
  function reachOf(d, recs) {
    var key = d.mode + d.B + "," + d.C + "," + d.D + ":" + recs.join(";");
    if (reachMemo[key] !== undefined) return reachMemo[key];
    var run = runRecs(d, recs), out = null;
    if (run.ok) {
      var l = lb2(d, canon(run.sim)), v = d.mode === "far" ? Math.max(run.sim.far, l.v) : l.v;
      out = { sim: run.sim, v: v, lb: l, now: valueOfSim(d, run.sim) };
    }
    if (reachCount > 200) { reachMemo = {}; reachCount = 0; }
    reachMemo[key] = out; reachCount++;
    return out;
  }

  // ================================================================================================= kế hoạch cụ thể: chặng theo pha + hành trình LB2
  /** Mục kế hoạch: {op, arg, tag, note}. tag của lệnh ĐI: "out" (chuyến đi, mang tiếp tế) · "back" (quay về) · "fetch" (đi lấy thức ăn) · "gather" (lùi gom kho). */
  function item(op, arg, tag, note) { return { op: op, arg: arg, tag: tag || null, note: note || null }; }
  /** Chặng gọn từ đống S ở L (lạc đà ở L, KHÔNG chở gì — phần chở đã gộp vào kho L): kết quả bằng QHĐ theo km. */
  function sweepItems(d, L, dd, out) {
    var C = d.C, x = L, S = dd[L], stop = d.mode === "deliver" ? d.D : d.maxX;
    while (x < stop && S >= 1) {
      var r0 = gstep(S, C); if (r0.v < 0) break;
      var f = r0.f, Pm = Math.min(S, f * C), len = 0, Scur = S;
      while (x + len < stop) {
        var r = gstep(len === 0 ? S : Scur, C);
        if (r.f !== f || r.v < 0) break;
        var nl = len + 1;
        if (f > 1 && 2 * nl > C) break;
        if (Pm - (f - 1) * C < nl) break;
        len = nl; Scur = r.v;
        if (dd[x + len] > 0) break;
      }
      if (len === 0) break;
      var y = x + len, lastLoad = Pm - (f - 1) * C, note = { f: f, len: len, x: x, y: y, S: S, left: S - Pm, C: C };
      for (var t = 1; t < f; t++) {
        out.push(item(OP_LOAD, C), item(OP_GO, y, "out", Object.assign({ trip: t, last: false }, note)));
        if (C - 2 * len > 0) out.push(item(OP_DROP, C - 2 * len));
        out.push(item(OP_GO, x, "back", Object.assign({ trip: t }, note)));
      }
      out.push(item(OP_LOAD, lastLoad), item(OP_GO, y, "out", Object.assign({ trip: f, last: true, final: Pm - (2 * f - 1) * len + dd[y] < 1 }, note)));
      if (lastLoad - len > 0) out.push(item(OP_DROP, lastLoad - len));
      S = Pm - (2 * f - 1) * len + dd[y]; x = y;
    }
  }
  /** Gộp mỗi đoạn LẤY/ĐẶT liên tiếp (không có ĐI xen giữa) thành MỘT thao tác ròng — đổi chở ↔ kho tại chỗ không tốn gì nên kết quả y hệt. */
  function mergeRuns(items) {
    var out = [], net = 0;
    function flush() { if (net > 0) out.push(item(OP_LOAD, net)); else if (net < 0) out.push(item(OP_DROP, -net)); net = 0; }
    items.forEach(function (it) {
      if (it.op === OP_GO) { flush(); out.push(it); } else net += it.op === OP_LOAD ? it.arg : -it.arg;
    });
    flush();
    return out;
  }
  function itemsToRecs(items) { return items.map(function (it) { return [0, it.op, it.arg]; }); }
  /** Kế hoạch gọn từ trạng thái ĐẦU (lời giải). */
  function compactItems(d) {
    var dep = zeros(d.maxX + 1), out = []; dep[0] = d.B;
    sweepItems(d, 0, dep, out);
    return mergeRuns(out);
  }
  /** Kế hoạch tiếp nối từ trạng thái THẬT (sim): hành trình LB2 rồi chặng quét, gộp theo tải hiện có. Trả {v, items} (v = giá trị dự đoán, gộp điểm xa đã tới). */
  function continuation(d, sim, known) {
    var st = canon(sim), l = known || lb2(d, st), items = [], p = st.p, cur = p;
    if (sim.load > 0) items.push(item(OP_DROP, sim.load));
    function goTo(target, pick, tag) {
      var dir = target > cur ? 1 : -1;
      while (cur !== target) {
        var need = pick[cur] || 0; if (need) items.push(item(OP_LOAD, need));
        var nxt = cur + dir; while (nxt !== target && !pick[nxt]) nxt += dir;
        items.push(item(OP_GO, nxt, tag, { from: cur, to: nxt, R: l.R, L: l.L, p: p })); cur = nxt;
      }
    }
    var sweepFrom = p, dd = st.dep;
    if (l.ex) {
      if (l.R > p) goTo(l.R, l.ex.pickF, "fetch");
      if (l.L < l.R) goTo(l.L, l.ex.pickB, "gather");
      sweepFrom = l.L; dd = l.ex.dd;
    } else { dd = st.dep; sweepFrom = p; }
    sweepItems(d, sweepFrom, dd, items);
    var v = d.mode === "far" ? Math.max(sim.far, l.v) : l.v;
    return { v: v, items: mergeRuns(items), R: l.R, L: l.L, approx: l.approx };
  }

  // ================================================================================================= solution, replay (chặng)
  function buildSolution(d) {
    var items = compactItems(d), recs = itemsToRecs(items), run = runRecs(d, recs);
    if (!run.ok || recs.length < 1 || recs.length > CAP || valueOfSim(d, run.sim) !== d.best) return null;
    return { items: items, recs: recs, v: plan.build(LAYOUT, recs, 1, []) };
  }
  /** Cắt kế hoạch thành các CHẶNG: mỗi chặng kết thúc sau một lệnh ĐI cộng một lệnh ĐẶT liền sau (lệnh LẤY thuộc chặng kế). */
  function chunksOf(items) {
    var out = [], cur = [];
    for (var i = 0; i < items.length; i++) {
      cur.push(items[i]);
      if (items[i].op === OP_GO) { if (i + 1 < items.length && items[i + 1].op === OP_DROP) cur.push(items[++i]); out.push(cur); cur = []; }
    }
    if (cur.length) out.push(cur);
    return out;
  }
  function recText(r) { return r[1] === OP_GO ? "đi tới km " + r[2] : r[1] === OP_LOAD ? "lấy " + r[2] + " quả" : "đặt " + r[2] + " quả"; }
  function opsText(items) { return items.map(function (it) { return it.op === OP_GO ? "đi tới km " + it.arg : it.op === OP_LOAD ? "lấy " + it.arg + " quả" : "đặt " + it.arg + " quả"; }).join(", ").replace(/^./, function (c) { return c.toUpperCase(); }); }
  function goOf(items) { for (var i = 0; i < items.length; i++) if (items[i].op === OP_GO) return items[i]; return null; }
  /** Lời giải thích (text + why[]) của một chặng, dựa trên ghi chú gắn vào lệnh ĐI. */
  function explainChunk(d, items, level) {
    var go = goOf(items), n = go && go.note, C = d.C, why = [], head = opsText(items) + ".";
    if (!go) return { text: head, why: [] };
    if (go.tag === "out" && n) {
      var per = 2 * n.f - 1;
      if (n.f > 1 && !n.last) {
        why.push("Kho ở km " + n.x + " có " + nf(n.S) + " quả, sức chở " + nf(C) + " ⇒ cần f = ⌈" + nf(n.S) + "/" + nf(C) + "⌉ = " + n.f + " chuyến chở; mỗi km lạc đà đi tới ăn 1, đi về ăn thêm 1 ⇒ " + per + " quả tiêu hao cho mỗi km.");
        why.push("Chuyến " + n.trip + "/" + n.f + ": mang đầy " + nf(C) + ", đi " + nf(n.len) + " km (ăn " + nf(n.len) + "), đặt " + nf(C - 2 * n.len) + " quả làm kho tại km " + n.y + ", giữ " + nf(n.len) + " quả vừa đủ ăn lúc quay về.");
        why.push("Đoạn dài " + nf(n.len) + " km: tới đó kho " + n.x + " còn đúng (f − 1)·C = " + nf((n.f - 1) * C) + " quả (hoặc tới ranh giới kế) nên từ đây chỉ cần " + (n.f - 1) + " chuyến.");
      } else if (n.f > 1) {
        why.push("Chuyến cuối " + n.f + "/" + n.f + " của đoạn không quay về: mang nốt phần còn lại, đi " + nf(n.len) + " km tới km " + n.y + " và đặt xuống để cộng vào kho đã tích.");
        if (n.left > 0) why.push("Bỏ lại " + nf(n.left) + " quả ở km " + n.x + ": thêm một chuyến chở nữa làm mỗi km tốn thêm 2 quả mà phần chở thêm không bù nổi.");
      } else {
        why.push(n.final ? "Chỉ còn một chuyến: mang " + nf(Math.min(n.S, C)) + " quả đi thẳng — mỗi km ăn 1 quả nên đi được " + nf(n.len) + " km, tới km " + n.y + " là hết chuối." : "Một chuyến chở " + nf(Math.min(n.S, C)) + " quả (mỗi km ăn 1) tới km " + n.y + ".");
        if (n.left > 0) why.push("Bỏ lại " + nf(n.left) + " quả ở km " + n.x + " (mang thêm một chuyến nữa tốn nhiều hơn số quả chở được thêm).");
      }
      return { text: head + (go.note.final ? " Đây là đoạn cuối." : ""), why: why };
    }
    if (go.tag === "back" && n) return { text: head + " Quay về kho cũ.", why: ["Quay về km " + n.x + " với đúng " + nf(n.len) + " quả để ăn trên đường — đưa-đón: mỗi chuyến đi rồi về, chuyến cuối không về."] };
    if (go.tag === "fetch") return { text: head + " Đi lấy thức ăn.", why: ["Muốn quay lại gom kho đã đặt ở phía sau, lạc đà phải có chuối để ăn trên đường lùi; kho ở phía trước gần nhất cho thức ăn rẻ nhất.", "Đoạn tới ăn 1 quả/km lấy từ kho gần nhất còn chuối."] };
    if (go.tag === "gather") return { text: head + " Lùi gom kho cũ.", why: ["Chuối nằm lại phía sau không bao giờ được dùng nếu không quay lại — gom về để dồn tiếp phía trước.", "Mỗi km lùi ăn 1 quả; sức chở tối đa " + nf(C) + " ở mọi lúc."] };
    return { text: head, why: [] };
  }
  /** Các bước replay: mỗi bước = MỘT chặng (một diff) + bước "Nộp". */
  function replaySteps(p) {
    var d = p.data, sol = buildSolution(d);
    if (!sol) return [];
    var s = { v: plan.empty(LAYOUT), c: null }, out = [];
    chunksOf(sol.items).forEach(function (ch, i) {
      var recs = itemsToRecs(ch), n0 = plan.count(s), dd = plan.appendDiff(s, LAYOUT, recs, "Chặng " + (i + 1));
      if (!dd) return;
      var ex = explainChunk(d, ch);
      P.game.applyDiff(s, dd.d, false);
      var cells = []; for (var j = 0; j < recs.length; j++) cells.push(n0 + j);
      out.push({ text: "Chặng " + (i + 1) + ": " + ex.text, why: ex.why, diff: { d: dd.d }, cells: cells, technique: "Đưa-đón" });
    });
    var sd = plan.submitDiff(s, LAYOUT, [], "Nộp kế hoạch");
    if (sd) out.push({ text: "Nộp kế hoạch: " + (d.mode === "far" ? "điểm xa nhất " + nf(d.best) + " km" : nf(d.best) + " quả tới km " + d.D) + " — mức tối ưu theo quy hoạch động từng km.", why: ["Không kế hoạch nào đi xa hơn (hay chở nhiều hơn) được: mỗi đoạn [x, x+1] cần ít nhất 2f − 1 quả với f chuyến, và quy hoạch động theo km chọn f tốt nhất."], diff: { d: sd.d }, cells: [], technique: "Nộp" });
    return out;
  }

  // ================================================================================================= moveFor / check / mistakes / grade
  var OPS = { go: OP_GO, load: OP_LOAD, drop: OP_DROP };
  function opsFromAction(a) {
    if (a.k === "go") return isInt(a.x, 0, 1e9) ? [[0, OP_GO, a.x]] : null;
    if (a.k === "load") return isInt(a.n, 1, 1e9) ? [[0, OP_LOAD, a.n]] : null;
    if (a.k === "drop") return isInt(a.n, 1, 1e9) ? [[0, OP_DROP, a.n]] : null;
    if (a.k === "steps") {
      if (!Array.isArray(a.ops) || !a.ops.length || a.ops.length > CAP) return null;
      var out = [];
      for (var i = 0; i < a.ops.length; i++) {
        var o = a.ops[i], op = o && Object.prototype.hasOwnProperty.call(OPS, o.op) ? OPS[o.op] : 0;
        if (!op || !isInt(o.n, op === OP_GO ? 0 : 1, 1e9)) return null;
        out.push([0, op, o.n]);
      }
      return out;
    }
    return null;
  }
  /** Chuyến tiếp tế tới km to (> vị trí): lấy đầy, đi, đặt phần thừa (giữ đủ ăn để về), quay về. {ops} hoặc {error}. */
  function tripOps(d, sim, to) {
    var p = sim.pos, dist = to - p;
    if (!isInt(to, 0, d.maxX)) return { error: "Km " + to + " nằm ngoài bản đồ." };
    if (dist <= 0) return { error: "Chuyến tiếp tế chỉ đi về phía trước — chọn km lớn hơn " + p + "." };
    var fill = Math.min(d.C - sim.load, sim.dep[p]), L = sim.load + fill, ops = [];
    if (2 * dist > L) return { error: "Đi-về " + dist + " km cần " + (2 * dist) + " quả nhưng chỉ chở được " + L + (L < d.C && fill < d.C - sim.load ? " (kho chỉ có thêm " + fill + ")" : " (sức chở " + d.C + ")") + "." };
    if (fill > 0) ops.push([0, OP_LOAD, fill]);
    ops.push([0, OP_GO, to]);
    if (L - 2 * dist > 0) ops.push([0, OP_DROP, L - 2 * dist]);
    ops.push([0, OP_GO, p]);
    return { ops: ops };
  }
  /** Lấy đầy và đi hết sức về phía trước (không vượt bản đồ). */
  function runOps(d, sim) {
    var p = sim.pos, fill = Math.min(d.C - sim.load, sim.dep[p]), L = sim.load + fill, to = Math.min(p + L, d.maxX), ops = [];
    if (to <= p) return { error: "Không đi được: chưa có chuối để ăn dọc đường (lấy chuối từ kho trước)." };
    if (fill > 0) ops.push([0, OP_LOAD, fill]);
    ops.push([0, OP_GO, to]);
    return { ops: ops };
  }
  function labelOf(ops) {
    return ops.length === 1 ? (ops[0][1] === OP_GO ? "Đi tới km " + ops[0][2] : ops[0][1] === OP_LOAD ? "Lấy " + ops[0][2] + " quả" : "Đặt " + ops[0][2] + " quả") : null;
  }
  /** → {ops, label} hoặc {error} hoặc null (action lạ). Không áp lên state. */
  function resolve(p, s, a) {
    var d = p.data;
    if (!a || typeof a !== "object") return null;
    var cur = null;
    if (a.k === "trip" || a.k === "run") { cur = simOf(p, s); if (!cur.ok) return null; }
    if (a.k === "trip") { var t = tripOps(d, cur.sim, a.to); return t.error ? { error: t.error } : { ops: t.ops, label: "Chuyến tiếp tế tới km " + a.to }; }
    if (a.k === "run") { var r = runOps(d, cur.sim); return r.error ? { error: r.error } : { ops: r.ops, label: "Đi hết sức" }; }
    var ops = opsFromAction(a);
    return ops ? { ops: ops, label: a.k === "steps" ? "Gợi ý: " + ops.length + " thao tác" : labelOf(ops) } : null;
  }
  function moveFor(p, s, a) {
    if (!a || typeof a !== "object" || !dataOk(p.data)) return null;
    if (a.k === "truncate") return plan.truncateDiff(s, LAYOUT, a.n);
    if (a.k === "submit") return plan.count(s) >= 1 ? plan.submitDiff(s, LAYOUT, [], "Nộp kế hoạch") : null;
    if (plan.isSubmitted(s)) return null;
    var rs = resolve(p, s, a);
    if (!rs || rs.error) return null;
    var recs = plan.read(s, LAYOUT).concat(rs.ops), run = runRecs(p.data, recs);
    if (!run.ok || recs.length > CAP) return null;
    return plan.appendDiff(s, LAYOUT, rs.ops, rs.label);
  }
  /** Xem trước (cho bàn): {ok, error, after:{pos, load, far, value, depots:[{x,n}], cost}}. Không đổi state. */
  function preview(p, s, a) {
    var d = p.data, cur = simOf(p, s);
    if (!cur.ok) return { ok: false, error: "Kế hoạch hiện tại không hợp lệ: " + cur.why };
    if (plan.isSubmitted(s)) return { ok: false, error: "Đã nộp — hãy mở lại kế hoạch để sửa." };
    var rs = resolve(p, s, a);
    if (!rs) return { ok: false, error: "Thao tác không hợp lệ." };
    if (rs.error) return { ok: false, error: rs.error };
    var sim = { pos: cur.sim.pos, load: cur.sim.load, dep: cur.sim.dep.slice(), far: cur.sim.far };
    if (plan.count(s) + rs.ops.length > CAP) return { ok: false, error: "Kế hoạch tối đa " + CAP + " thao tác — hãy dùng chặng dài hơn." };
    for (var i = 0; i < rs.ops.length; i++) {
      var why = stepSim(d, sim, rs.ops[i][1], rs.ops[i][2]);
      if (why) return { ok: false, error: why };
    }
    return { ok: true, error: null, ops: rs.ops, after: viewOf(d, sim) };
  }
  function viewOf(d, sim) {
    var depots = []; for (var x = 0; x < sim.dep.length; x++) if (sim.dep[x] > 0) depots.push({ x: x, n: sim.dep[x] });
    return { pos: sim.pos, load: sim.load, far: sim.far, value: valueOfSim(d, sim), depots: depots };
  }
  function check(p, s) {
    var d = p.data, n = plan.count(s), run = simOf(p, s);
    return { solved: plan.isSubmitted(s) && run.ok && n >= 1, conflicts: [], filled: n, total: p.solution ? plan.count({ v: p.solution.v }) : 0, complete: run.ok && n >= 1 };
  }
  function unitOf(d) { return d.mode === "far" ? " km" : " quả"; }
  function grade(p, s) {
    var d = p.data, v = valueOf(p, s), g = G.fromRatio(v, d.best, "max", { fmt: function (x) { return nf(x) + unitOf(d); } });
    if (!plan.isSubmitted(s)) { g.stars = 0; g.text = "Chưa nộp kế hoạch"; return g; }
    if (g.quality >= 1) g.text = "Tối ưu! " + (d.mode === "far" ? "Đi xa " + nf(v) + " km" : nf(v) + " quả tới km " + d.D) + " — không kế hoạch nào hơn được.";
    else g.text = "Đạt " + Math.floor(g.quality * 100) + " % mức tối ưu (" + nf(v) + " so với " + nf(d.best) + unitOf(d) + ").";
    return g;
  }
  /** Nước (diff) làm MẤT tối ưu: trước còn đạt tối ưu, sau thì không (LB2 — kế hoạch dựng được). Đã mất từ trước / nộp / bộ đánh giá xấp xỉ → 0. */
  function mistakes(p, s, diff) {
    var d = p.data, t = after(s, diff);
    if (plan.isSubmitted(t) || plan.isSubmitted(s)) return 0;
    var r0 = reachOf(d, recsOf(p, s)), r1 = reachOf(d, recsOf(p, t));
    if (!r0 || !r1 || r0.lb.approx || r1.lb.approx) return 0;
    return r0.v >= d.best && r1.v < d.best ? 1 : 0;
  }

  // ================================================================================================= gợi ý
  /** Tiền tố dài nhất còn đạt tối ưu (nhị phân; tiền tố 0 luôn đạt) — kế hoạch recs đang MẤT tối ưu. */
  function lastGoodPrefix(d, recs) {
    var lo = 0, hi = recs.length;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1, r = reachOf(d, recs.slice(0, mid));
      if (r && r.v >= d.best) lo = mid; else hi = mid;
    }
    return lo;
  }
  function stepsAction(items) { return { k: "steps", ops: items.map(function (it) { return { op: it.op === OP_GO ? "go" : it.op === OP_LOAD ? "load" : "drop", n: it.arg }; }) }; }
  function mkHint(level, tech, text, why, cells, regions, action) { return { level: level, technique: tech, text: text, why: why || [], cells: cells || [], regions: regions || {}, action: action || null }; }
  function hint(p, s, level) {
    var d = p.data, recs = recsOf(p, s), n = recs.length, unit = d.mode === "far" ? "km" : "quả";
    if (plan.isSubmitted(s)) return { level: level, text: "Đã nộp kế hoạch.", why: [], cells: [], none: true };
    var rc = reachOf(d, recs);
    if (!rc) return { level: level, text: "Kế hoạch hiện tại không hợp lệ.", why: [], cells: [], none: true };
    // ---- 1. đã MẤT tối ưu
    if (rc.v < d.best) {
      var j = lastGoodPrefix(d, recs), bad = recs[j] || [0, 0, 0];
      var lines = ["Từ kế hoạch hiện tại, tốt nhất chỉ còn " + nf(rc.v) + " " + unit + " (tối ưu " + nf(d.best) + " " + unit + ").", "Bước " + (j + 1) + " (" + recText(bad) + ") là bước đầu tiên làm không còn đường tới tối ưu.", "Quay về trước bước đó để chọn lại — hoàn tác không xoá lỗi đã tính."];
      return mkHint(level, "Hoàn tác", level === 1 ? "Kế hoạch này không còn đạt được mức tối ưu — một bước trước đã làm mất tối ưu." : level === 2 ? "Bước " + (j + 1) + " (" + recText(bad) + ") làm mất tối ưu: từ đây tối đa " + nf(rc.v) + " " + unit + " thay vì " + nf(d.best) + "." : "Quay về trước bước " + (j + 1) + ".",
        level === 3 ? lines : [], [j], { positions: [bad[1] === OP_GO ? bad[2] : rc.sim.pos] }, level === 3 ? { k: "truncate", n: j } : null);
    }
    // ---- 2. đã đạt giá trị tối ưu → nộp
    if (rc.now >= d.best) {
      return mkHint(level, "Nộp", level === 1 ? "Kế hoạch hiện tại đã đạt mức tối ưu — hãy nộp." : "Kế hoạch đã đạt " + nf(rc.now) + " " + unit + " = mức tối ưu: nộp kế hoạch.", level === 3 ? ["Không kế hoạch nào hơn được (quy hoạch động theo km và bộ vét cạn đều cho " + nf(d.best) + " " + unit + ")."] : [],
        [], {}, level === 3 ? { k: "submit" } : null);
    }
    // ---- 3. còn đường tới tối ưu → chặng kế tiếp của một kế hoạch tối ưu
    var ct = continuation(d, rc.sim, rc.lb), chunk = chunksOf(ct.items)[0], go = chunk && goOf(chunk);
    if (!chunk || !go) return { level: level, text: "Không còn gợi ý (kế hoạch tiếp nối rỗng).", why: [], cells: [], none: true };
    var nt = go.note || {}, ex = explainChunk(d, chunk), y = go.arg;
    var pos = rc.sim.pos, depots = [];
    var t1, t2;
    if (go.tag === "out" && nt.f) {
      t1 = "Kho có " + nf(nt.S) + " quả, sức chở " + nf(d.C) + " ⇒ cần " + nt.f + " chuyến chở nên mỗi km tốn " + (2 * nt.f - 1) + " quả. " + (nt.f > 1 ? "Đừng đi một mạch: hãy dời cả kho tiến lên một đoạn ngắn rồi mới đi tiếp." : "Chỉ một chuyến — mang tối đa và đi thẳng.");
      t2 = nt.f > 1 ? "Kho kế tiếp nên đặt ở km " + y + " (cách " + nf(nt.len) + " km): tới đó kho còn đúng " + nf((nt.f - 1) * d.C) + " quả nên chỉ cần " + (nt.f - 1) + " chuyến. " + (nt.last ? "Đây là chuyến cuối của đoạn, không quay về." : "Chuyến " + nt.trip + "/" + nt.f + ": mang đầy " + nf(d.C) + ", đặt " + nf(d.C - 2 * nt.len) + " quả, về lấy tiếp.") : "Đi tới km " + y + " (" + nf(nt.len) + " km) rồi dừng.";
    } else if (go.tag === "back") {
      t1 = "Chuyến đưa-đón: sau khi đặt kho, lạc đà quay về kho cũ bằng đúng phần chuối đã giữ lại.";
      t2 = "Quay về km " + y + ".";
    } else if (go.tag === "fetch") {
      t1 = "Còn chuối nằm lại sau lưng đáng gom, nhưng muốn lùi phải có thức ăn: hãy lấy thức ăn ở kho phía trước trước.";
      t2 = "Đi tới km " + y + " lấy thức ăn rồi mới lùi gom kho cũ.";
    } else if (go.tag === "gather") {
      t1 = "Có kho cũ ở phía sau đáng gom về — chuối bỏ lại sau lưng không bao giờ được dùng.";
      t2 = "Lùi về km " + y + " gom kho cũ.";
    } else {
      t1 = "Hãy tiến theo kế hoạch đưa-đón: dời kho từng đoạn, không đi một mạch.";
      t2 = "Chặng kế tiếp: " + opsText(chunk).toLowerCase() + ".";
    }
    var cellsAhead = [];
    chunk.forEach(function (_, i) { cellsAhead.push(n + i); });
    var pts = [pos]; chunk.forEach(function (it) { if (it.op === OP_GO) pts.push(it.arg); });
    return mkHint(level, "Đưa-đón", level === 1 ? t1 : level === 2 ? t2 : ex.text, level === 3 ? ex.why : [], level === 1 ? [] : cellsAhead, { positions: level === 1 ? [] : pts }, level === 3 ? stepsAction(chunk) : null);
  }

  // ================================================================================================= đề tự nhập / kiểm / I-O
  function fail(errors, extra) { return Object.assign({ ok: false, errors: errors, warnings: [], status: "none", count: 0 }, extra || {}); }
  function num(x) { return typeof x === "string" && /^\s*\d+\s*$/.test(x) ? Number(x) : x; }
  function buildPuzzle(seed, sizeId, mode, B, C, D, tier) {
    var d = dataOf(mode, B, C, D), sol = buildSolution(d);
    if (!sol) return null;
    var p = { v: 1, type: "camel", seed: seed, sizeId: sizeId, size: { mode: mode }, tier: tier, score: scoreOf(d), data: d, initial: { v: plan.empty(LAYOUT) }, solution: { v: sol.v }, meta: {} };
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    p.id = P.util.puzzleId(p);
    return p;
  }
  function fromInputAt(inp, seed) {
    if (!inp || typeof inp !== "object") return fail(["Thiếu dữ liệu đề."]);
    var errs = [], mode = inp.mode === "far" || inp.mode === "deliver" ? inp.mode : null, B = num(inp.B), C = num(inp.C), D = inp.D == null || inp.D === "" ? 0 : num(inp.D);
    if (!mode) errs.push("Chế độ phải là 'far' (đi xa nhất) hoặc 'deliver' (chở tới đích D).");
    if (!isInt(B, 1, MAX_B)) errs.push("Số chuối ở kho A (B) phải là số nguyên 1–" + nf(MAX_B) + ".");
    if (!isInt(C, 1, MAX_C)) errs.push("Sức chở (C) phải là số nguyên 1–" + nf(MAX_C) + ".");
    if (errs.length) return fail(errs);
    if (Math.ceil(B / C) > MAX_K) return fail(["Cần quá nhiều chuyến chở: B/C phải ≤ " + MAX_K + " (kế hoạch tối ưu phải vừa " + CAP + " thao tác)."]);
    var far = farDisc(B, C);
    if (far > MAX_X) return fail(["Bản đồ quá dài (" + nf(far) + " km > " + nf(MAX_X) + ")."]);
    if (mode === "deliver") {
      if (!isInt(D, 1, MAX_X)) return fail(["Đích D phải là số nguyên km 1–" + nf(MAX_X) + "."]);
      if (D >= far) return fail(["Đích D = " + nf(D) + " km quá xa: lạc đà không thể tới đó với " + nf(B) + " quả (xa nhất chỉ " + nf(far) + " km). Chọn D < " + nf(far) + "."]);
    }
    var p = buildPuzzle(seed, "tu-nhap", mode, B, C, D, "custom");
    if (!p) return fail(["Không dựng được kế hoạch tối ưu cho đề này (quá dài cho " + CAP + " thao tác)."]);
    var d = p.data, contText = d.bestCont, discText = nf(d.best), warns = [];
    if (!d.contInt) warns.push("Mô hình liên tục cho " + contText + ", nhưng lạc đà chỉ dừng ở km nguyên và chuối nguyên quả nên tối ưu thật là " + discText + ".");
    if (Math.ceil(B / C) === 1) warns.push("B ≤ C: chỉ một chuyến — bài toán tầm thường (mang hết, đi thẳng).");
    if (C < 15 && Math.ceil(B / C) >= 3) warns.push("Sức chở nhỏ so với B: chênh lệch giữa mô hình liên tục và km nguyên có thể lớn.");
    return { ok: true, puzzle: p, errors: [], warnings: warns, status: "unique", count: 1, statusKind: d.contInt ? "ok" : "warn",
      statusText: "✓ Tối ưu rời rạc: " + discText + (mode === "far" ? " km" : " quả tới km " + D) + " (liên tục " + contText + ")" };
  }
  function fromInput(inp) { return fromInputAt(inp, null); }
  function inputOf(d) { return { mode: d.mode, B: d.B, C: d.C, D: d.D }; }

  var KEYS = { "b": "B", "chuoi": "B", "kho": "B", "c": "C", "d": "D", "dich": "D" };
  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function parseText(text) {
    var t = ascii(text == null ? "" : text), mode = /deliver|toi d|toi dich|cho toi|giao/.test(t) ? "deliver" : /far|xa nhat/.test(t) ? "far" : null, m = {}, re = /([a-z]+)\s*[=:]\s*(\d+)/g, q;
    while ((q = re.exec(t)) !== null) if (Object.prototype.hasOwnProperty.call(KEYS, q[1]) && m[KEYS[q[1]]] === undefined) m[KEYS[q[1]]] = Number(q[2]);
    if (!mode && m.D) mode = "deliver";
    if (!mode) return { err: "Thiếu chế độ: 'camel far B=… C=…' (đi xa nhất) hoặc 'camel deliver B=… C=… D=…' (chở tới D)." };
    if (m.B === undefined || m.C === undefined) return { err: "Thiếu B (số chuối ở kho) hoặc C (sức chở): ví dụ 'camel far B=3000 C=1000'." };
    return { inp: { mode: mode, B: m.B, C: m.C, D: m.D || 0 } };
  }
  function toText(p) { var d = p.data; return "camel " + d.mode + " B=" + d.B + " C=" + d.C + (d.mode === "deliver" ? " D=" + d.D : ""); }
  function fromText(text) { var r = parseText(text); return r.err ? { ok: false, errors: [r.err], warnings: [] } : fromInput(r.inp); }
  function planText(p) {
    try { return plan.read({ v: p.solution.v }, LAYOUT).map(function (r) { return (r[1] === OP_GO ? "G" : r[1] === OP_LOAD ? "L" : "D") + r[2]; }).join(" "); } catch (e) { return ""; }
  }
  function toFile(p) {
    var d = p.data;
    return { type: "camel", seed: p.seed, difficulty: p.score, size: p.size, initialState: "mode=" + d.mode + ";B=" + d.B + ";C=" + d.C + ";D=" + d.D, solution: planText(p), metadata: p.meta || {} };
  }
  function fromFile(o) {
    if (!o || typeof o !== "object" || typeof o.initialState !== "string") return { ok: false, errors: ["Thiếu initialState (dạng mode=far;B=…;C=…;D=…)."], warnings: [] };
    var m = {}; o.initialState.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) m[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    var r = fromInput({ mode: m.mode, B: m.B === undefined ? NaN : Number(m.B), C: m.C === undefined ? NaN : Number(m.C), D: m.D === undefined ? 0 : Number(m.D) });
    if (r.ok && o.metadata && typeof o.metadata === "object" && typeof o.metadata.name === "string") r.puzzle.meta = { name: o.metadata.name.slice(0, 80) };
    return r;
  }

  // ================================================================================================= Constraint View, trace
  function phaseRows(d) { return discPhases(d.B, d.C, d.mode, d.D); }
  function constraintView(p) {
    var d = p.data, ph = phaseRows(d), k = Math.max(1, Math.ceil(d.B / d.C));
    var vars = [{ name: "f_x — số lượt lạc đà đi TỚI qua đoạn [x, x+1]", domain: "{1, 2, …, " + k + "}", count: ph.length },
      { name: "S_x — số chuối dồn được tới km x", domain: "{0, 1, …, " + nf(d.B) + "}" },
      { name: "Kế hoạch (lấy / đặt / đi tới)", domain: "≤ " + CAP + " thao tác" }];
    var cons = ["S_0 = " + nf(d.B) + " (kho A)", "S_{x+1} ≤ min(S_x, f·C) − (2f − 1)  (f lượt tới, f − 1 lượt lùi, mỗi lượt ăn 1 quả/km)", "0 ≤ chở ≤ " + nf(d.C) + " ở mọi lúc; không đủ chuối ăn thì không đi được", "vị trí và số quả đều NGUYÊN",
      d.mode === "far" ? "mục tiêu: max_x (x + min(S_x, C)) — điểm xa nhất" : "mục tiêu: S_" + d.D + " — số chuối ở km " + d.D];
    var secs = [{ title: "Quy hoạch động từng km", note: "g(S) = max_f [min(S, f·C) − (2f − 1)] không giảm theo S nên tham lam theo từng km là tối ưu.",
      items: ph.map(function (q, i) { return "Pha " + (i + 1) + ": km " + q.from + " → " + q.to + ", " + nf(q.S0) + " quả, " + q.f + " chuyến chở (" + (2 * q.f - 1) + " quả/km), còn " + nf(q.S1) + (q.left ? "; bỏ lại " + nf(q.left) + " quả" : ""); }) },
      { title: "Liên tục và rời rạc", items: ["Mô hình liên tục: " + d.bestCont + (d.mode === "far" ? " km" : " quả") + "; rời rạc (luật game): " + nf(d.best) + ".", d.contInt ? "Hai đáp án trùng nhau vì mọi ranh giới pha là số nguyên." : "Khác nhau vì ranh giới pha không nguyên (chỉ dừng ở km nguyên, chuối nguyên quả)."] }];
    return { summary: nf(d.B) + " quả, sức chở " + nf(d.C) + ", " + (d.mode === "far" ? "đi xa nhất" : "chở tới km " + d.D) + ", ăn 1 quả/km (cả khi về)", variables: vars, constraints: cons, counts: { variables: vars.length, constraints: cons.length, "pha": ph.length, "chuyến ở pha đầu": k }, sections: secs };
  }
  function trace(p) {
    var d = p.data, ph = phaseRows(d), head = ["Pha", "Từ km", "Tới km", "Chuối đầu pha", "Số chuyến f", "Quả/km (2f−1)", "Chuối cuối pha", "Bỏ lại"], rows = [head], steps = [];
    ph.slice(0, 60).forEach(function (q, i) {
      rows = rows.concat([[i + 1, q.from, q.to, nf(q.S0), q.f, 2 * q.f - 1, nf(q.S1), q.left ? nf(q.left) : "0"]]);
      steps.push({ text: "Pha " + (i + 1) + ": ở km " + q.from + " có " + nf(q.S0) + " quả ⇒ " + q.f + " chuyến chở ⇒ " + (2 * q.f - 1) + " quả mỗi km; đi " + q.len + " km tới km " + q.to + " còn " + nf(q.S1) + " quả" + (q.left ? " (bỏ lại " + nf(q.left) + ")" : "") + ".", matrix: rows.map(function (r) { return r.slice(); }), pivot: [i + 1, 0] });
    });
    return { kind: "matrix", title: "Các pha của quy hoạch động theo km", steps: steps, note: "Mỗi pha là một đoạn đường mà lạc đà cần cùng số chuyến chở f: đoạn đầu tốn nhiều quả/km nhất, càng xa càng nhẹ — đến pha 1 chuyến thì mang nốt và đi thẳng." };
  }

  // ================================================================================================= đăng ký
  var SIZES = [
    { id: "far", label: "1 lạc đà — đi xa nhất", params: { mode: "far" }, default: true },
    { id: "deliver", label: "1 lạc đà — chở tới đích D", params: { mode: "deliver" } }
  ];

  // ---- sinh đề: các họ (B, C) có ranh giới pha nguyên, họ "pha đầu lẻ" và họ "không nguyên" — bậc chọn theo điểm (scoreOf)
  var poolMemo = null;
  function pairPool() {
    if (poolMemo) return poolMemo;
    var out = [], L = { 2: 3, 3: 15, 4: 105, 5: 315 }, seen = {};
    function add(B, C) { var key = B + "/" + C; if (!seen[key] && B > C && Math.ceil(B / C) <= 5) { seen[key] = 1; out.push([B, C]); } }
    var Cs = { 2: [], 3: [], 4: [], 5: [] }, t, k, r;
    for (t = 2; t <= 20; t++) Cs[2].push(3 * t);
    for (t = 1; t <= 6; t++) Cs[3].push(15 * t);
    for (t = 1; t <= 3; t++) Cs[4].push(105 * t);
    Cs[5].push(315);
    [10, 20, 25, 40, 50, 100, 200, 250, 500, 1000].forEach(function (c) { for (k = 2; k <= 4; k++) Cs[k].push(c); });        // họ "không nguyên" (ví dụ kinh điển 3000/1000, 1000-chở)
    for (k = 2; k <= 5; k++) Cs[k].forEach(function (C) {
      add(k * C, C);
      var step = 2 * k - 1, cnt = Math.floor((C - 1) / step), pick = {}, i;
      for (i = 1; i <= Math.min(cnt, 6); i++) pick[i] = 1;
      for (i = Math.max(1, cnt - 2); i <= cnt; i++) pick[i] = 1;
      if (cnt > 12) pick[Math.floor(cnt / 2)] = 1;
      for (r in pick) if (Object.prototype.hasOwnProperty.call(pick, r)) add((k - 1) * C + step * Number(r), C);                   // pha đầu lẻ: B = (k−1)C + (2k−1)·r
    });
    poolMemo = out;
    return out;
  }
  function inBand(score, band) { return score >= band.min && score < band.max; }
  function chooseFar(rng, band) {
    var pool = pairPool(), cands = pool.filter(function (q) { return inBand(scoreOf({ mode: "far", B: q[0], C: q[1], D: 0 }), band); });
    if (!cands.length) { var bd = 99; pool.forEach(function (q) { var dd = Math.abs(scoreOf({ mode: "far", B: q[0], C: q[1], D: 0 }) - band.target); if (dd < bd) { bd = dd; cands = [q]; } }); }
    var q = cands[rng.fork("pair").int(cands.length)];
    return { B: q[0], C: q[1], D: 0 };
  }
  function chooseDeliver(rng, band) {
    var pool = pairPool().filter(function (q) {                                                                                      // lọc nhanh theo (k, lẻ): điểm cơ sở + 1,5 nếu không nguyên có thể vào bậc
      var k = Math.ceil(q[0] / q[1]), base = (10 + 17 * (k - 1) + 14 * (q[0] % q[1] !== 0 ? 1 : 0) + 6) / 10;
      return base < band.max && base + 1.5 >= band.min;
    });
    if (!pool.length) pool = pairPool();
    var order = rng.fork("order").shuffle(pool.slice()), fb = null, fbd = 99;
    for (var i = 0; i < order.length; i++) {
      var B = order[i][0], C = order[i][1], far = farDisc(B, C), ph = discPhases(B, C, "far", 0), b1 = ph.length ? ph[0].to : 1;
      var lo = b1 + 1, hi = far - 1; if (lo > hi) continue;
      var span = hi - lo + 1, step = Math.max(1, Math.floor(span / 40)), start = lo + rng.fork("d" + i).int(step), good = [];
      for (var D = start; D <= hi; D += step) {
        var d = { mode: "deliver", B: B, C: C, D: D }, sc = scoreOf(d);
        if (deliverDisc(B, C, D) < 1) continue;
        if (inBand(sc, band)) good.push(D); else if (Math.abs(sc - band.target) < fbd) { fbd = Math.abs(sc - band.target); fb = { B: B, C: C, D: D }; }
      }
      if (good.length) return { B: B, C: C, D: good[rng.fork("pickD").int(good.length)] };
    }
    return fb || { B: 90, C: 30, D: 10 };
  }

  var def = {
    id: "camel", name: "Lạc đà chở chuối", family: "Mathematical Puzzle", category: "QHĐ", icon: "🐪",
    blurb: "Một lạc đà phải vận chuyển chuối qua sa mạc: đi xa nhất hoặc chở nhiều nhất tới đích — lập kế hoạch đưa-đón kho trung gian.",
    rules: [
      "Kho A có B quả chuối, lạc đà đứng ở A, chở tối đa C quả. Vị trí là số km nguyên (A = km 0), chuối đếm nguyên quả.",
      "Mỗi km đi — tới hay QUAY VỀ — lạc đà ăn 1 quả lấy từ chính số nó đang chở. Không đủ chuối để ăn cho quãng định đi thì không đi được.",
      "Tại km bất kỳ (kể cả A) bạn được ĐẶT bớt chuối xuống thành kho hoặc LẤY chuối từ kho tại chỗ (không vượt sức chở). Kho không hỏng, không ai ăn.",
      "Bài \"đi xa nhất\": giá trị = điểm xa A nhất lạc đà từng tới. Bài \"chở tới đích D\": giá trị = số chuối đang có ở km D khi nộp (kho D + phần đang chở nếu đứng ở D).",
      "Bạn lập KẾ HOẠCH (lấy / đặt / đi tới, hoặc dùng chuyến tiếp tế) rồi NỘP: ván kết thúc và được chấm so với mức tối ưu (100 % = \"Tối ưu!\"). Gợi ý và bàn đếm \"nước làm mất tối ưu\" — hoàn tác được, nhưng lỗi đã tính."
    ],
    sizes: SIZES.map(function (z) { return { id: z.id, label: z.label, params: z.params, default: z.default || undefined }; }),
    algorithm: {
      title: "Quy hoạch động theo từng km + đưa-đón kho trung gian",
      steps: [
        { title: "Mô hình rời rạc", text: "Vị trí nguyên km, chuối nguyên quả; đổi phần đang chở ↔ kho tại chỗ không tốn gì, nên trạng thái chỉ cần (vị trí lạc đà, số chuối ở mỗi kho)." },
        { title: "Luồng qua một đoạn", text: "Lạc đà bắt đầu bên trái, kết thúc bên phải mỗi đoạn [x, x+1]: đi tới f lần và lùi f − 1 lần. Mỗi lượt tới mang ≤ C và ăn 1, mỗi lượt lùi cũng ăn 1 ⇒ để chuyển S quả sang km kế cần f = ⌈S/C⌉ chuyến và tốn 2f − 1 quả/km." },
        { title: "QHĐ theo km, tham lam đúng", text: "S_{x+1} = g(S_x), g(S) = max_f [min(S, f·C) − (2f − 1)] không giảm ⇒ luôn giữ S lớn nhất ở mỗi km là tối ưu. g còn quyết định BỎ LẠI phần thừa khi nó không đáng một chuyến nữa." },
        { title: "Dạng đóng (bài jeep)", text: "Khi ranh giới nguyên: pha đầu k chuyến dài (B − (k−1)C)/(2k−1), các pha sau C/(2j−1) với j = k−1…1; \"xa nhất\" = tổng các pha. Ví dụ 3000/1000: 200 + 1000/3 + 1000 = 1533⅓ liên tục, 1533 km nguyên." },
        { title: "Đánh giá giữa chừng (LB2)", text: "Từ trạng thái bất kỳ: thử hành trình đi tới lấy thức ăn (R) → lùi gom kho (L) → quét theo QHĐ. Đây là một kế hoạch dựng được nên luôn ≤ tối ưu; kiểm vét cạn cho thấy bằng tối ưu ở mọi trạng thái đạt được của các bộ nhỏ — nên dùng được để báo \"nước làm mất tối ưu\" và gợi ý." }
      ],
      links: [{ id: "binary-search", label: "Tìm kiếm nhị phân" }, { id: "coin-change", label: "Đổi tiền (QHĐ một chiều)" }]
    },
    difficultyNote: "Điểm 0–10 = 1 + 1,7·(k−1) + 1,4·[pha đầu lẻ] + 0,6·[bài tới D] + 1,5·[ranh giới pha không nguyên], k = ⌈B/C⌉ là số chuyến chở ở pha đầu: Dễ 2 chuyến chẵn · Vừa 3 chuyến · Khó 4 chuyến hoặc pha đầu lẻ · Chuyên gia 5 chuyến hoặc 4 chuyến lẻ/không nguyên.",
    kind: "optimize", objective: { sense: "max", label: "Kết quả (km xa nhất hoặc số quả tới đích)", unit: "" },
    sizeLabel: "Bài toán",
    moveLabel: "Số thao tác (lấy, đặt, đi, chuyến tiếp tế, nộp — hoàn tác không làm giảm)",
    mistakeLabel: "Nước làm mất tối ưu",
    sizeText: function (p) { var d = p && p.data; return d && dataOk(d) ? nf(d.B) + " quả · chở " + nf(d.C) + (d.mode === "deliver" ? " · tới km " + nf(d.D) : " · đi xa nhất") : ""; },

    generate: function (seed, o) {
      o = o || {};
      var sz = P.types.sizeOf(def, o.sizeId), mode = sz.params.mode, tier = P.util.tier(o.tier) ? o.tier : "easy", band = P.util.tier(tier), rng = P.rng.create(seed).fork("camel");
      var c = mode === "far" ? chooseFar(rng, band) : chooseDeliver(rng, band);
      var p = buildPuzzle(seed, sz.id, mode, c.B, c.C, c.D, tier);
      if (!p) { c = mode === "far" ? { B: 30, C: 15, D: 0 } : { B: 30, C: 15, D: 10 }; p = buildPuzzle(seed, sz.id, mode, c.B, c.C, c.D, tier); }
      return p;
    },
    fromInput: fromInput,
    validate: function (p) {
      if (!p || !dataOk(p.data)) return { ok: false, errors: ["Đề thiếu dữ liệu."], status: "none", count: 0, solution: null };
      var r = fromInputAt(inputOf(p.data), p.seed == null ? null : p.seed);
      return { ok: r.ok, errors: r.errors, status: r.status, count: r.count, solution: r.ok ? r.puzzle.solution : null };
    },
    solve: function (p) {
      var d = p.data, sol = buildSolution(d);
      if (!sol) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0 };
      var ph = phaseRows(d);
      return { status: "unique", count: 1, solution: { v: sol.v }, value: d.best, bestCont: d.bestCont, nodes: d.mode === "far" ? d.best : d.D,
        steps: ph.map(function (q, i) { return { technique: q.f > 1 ? "Đưa-đón " + q.f + " chuyến" : "Một chuyến", text: "Pha " + (i + 1) + ": km " + q.from + " → " + q.to + ", " + nf(q.S0) + " quả, " + q.f + " chuyến chở, còn " + nf(q.S1) + (q.left ? " (bỏ lại " + nf(q.left) + ")" : "") + "." }; }),
        techniques: ph.reduce(function (acc, q) { var k = q.f > 1 ? "Đưa-đón " + q.f + " chuyến" : "Một chuyến"; acc[k] = (acc[k] || 0) + 1; return acc; }, {}) };
    },
    difficulty: function (p) { return scoreOf(p.data); },
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    isGiven: function () { return false; },
    moveFor: moveFor, check: check, mistakes: mistakes, grade: grade, hint: hint,
    replay: replaySteps,
    constraintView: constraintView, trace: trace,
    toText: toText, fromText: fromText, toFile: toFile, fromFile: fromFile,
    describeCell: function (p, s, i) {
      var n = plan.count(s);
      if (!isInt(i, 0, CAP - 1)) return "Bước không hợp lệ";
      if (i >= n) return "Bước " + (i + 1) + ": chưa dùng";
      return "Bước " + (i + 1) + ": " + recText(plan.record(s, LAYOUT, i));
    }
  };

  /** Hàm thuần cho bàn chơi và test (không thuộc hợp đồng chung). */
  def.sim = { preview: preview, view: function (p, s) { var r = simOf(p, s); return r.ok ? { ok: true, view: viewOf(p.data, r.sim) } : { ok: false, error: r.why, at: r.at }; } };
  def.lib = {
    CAP: CAP, W: W, MAX_B: MAX_B, MAX_C: MAX_C, MAX_K: MAX_K, MAX_X: MAX_X, OP_GO: OP_GO, OP_LOAD: OP_LOAD, OP_DROP: OP_DROP, layoutOf: layoutOf, F: F, fText: fText, fval: fval,
    farCont: farCont, deliverCont: deliverCont, gstep: gstep, farDisc: farDisc, deliverDisc: deliverDisc, discPhases: discPhases, dataOf: dataOf, scoreOf: scoreOf,
    newSim: newSim, stepSim: stepSim, runRecs: runRecs, valueOfSim: valueOfSim, valueOf: valueOf, simOf: simOf, canon: canon, excursion: excursion, sweepValue: sweepValue, lb2: lb2, reachOf: reachOf,
    continuation: continuation, compactItems: compactItems, mergeRuns: mergeRuns, itemsToRecs: itemsToRecs, chunksOf: chunksOf, explainChunk: explainChunk, buildSolution: buildSolution, tripOps: tripOps, runOps: runOps,
    lastGoodPrefix: lastGoodPrefix, pairPool: pairPool, recText: recText, viewOf: viewOf, resolve: resolve, fromInputAt: fromInputAt, planText: planText
  };

  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
