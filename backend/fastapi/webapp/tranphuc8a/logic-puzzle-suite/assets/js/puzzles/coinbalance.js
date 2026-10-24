/* puzzles/coinbalance.js — CÂN ĐỒNG XU (CW1): n xu giống hệt nhau, đúng MỘT xu giả; chỉ có cân đĩa (hai đĩa, số xu hai bên bằng nhau) và số lần cân tối đa k.
   Phải CHỨNG MINH được xu nào là giả (và nặng hay nhẹ hơn, tuỳ phiên bản) từ kết quả các lần cân — đoán may không tính. Loại 'interactive' (HUONG-DAN-ENGINE.md mục 11).

   Phiên bản (sizes, "Phiên bản"): biết xu giả NẶNG hơn (k = 2, 3) · không biết nặng hay nhẹ, phải nói hướng (k = 3, 4) · có thêm 1 xu chuẩn · chỉ cần chỉ ra xu.
   Tuỳ chọn (options): 'mode' = fixed (xu giả cố định theo seed — mặc định) | adv (ĐỐI THỦ thích nghi: không có xu giả định sẵn, mỗi lần cân đối thủ chọn kết quả khó nhất mà vẫn nhất quán).

   ── Lõi toán ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Mỗi xu thuộc một LỚP theo những gì đã biết: U (có thể nặng HOẶC nhẹ), H (chỉ có thể nặng), L (chỉ có thể nhẹ), G (chắc chắn thật). Trạng thái = (u, h, l, g);
   số khả năng (xu giả × hướng) = 2u + h + l. Cân T trái / P phải (|T| = |P|): lệch trái ⇒ H' = U,H bên trái, L' = U,L bên phải, mọi xu khác thành G; lệch phải đối xứng;
   cân bằng ⇒ mọi xu trên đĩa thành G, xu ngoài giữ lớp. Mỗi khả năng rơi vào ĐÚNG MỘT trong ba kết quả. Trạng thái đóng dưới phép cân nên chỉ cần ĐẾM (u, h, l, g).
   'solv(u,h,l,g,r,goal)' = quy hoạch động nhớ đệm: có phép cân nào mà cả ba nhánh còn giải được trong r−1 lần không (goal 0: biết cả hướng; goal 1: chỉ cần chỉ ra xu).
   Cận thông tin 3^k KHÔNG đủ (13 xu 3 lần: 26 ≤ 27 khả năng nhưng không có chiến lược chắc chắn; 40 xu 4 lần: 80 ≤ 81 cũng không) — nên gợi ý/đối thủ/mistakes luôn dùng DP thật;
   cận 3^r chỉ để CẮT NHÁNH (điều kiện cần). Số xu tối đa (đã kiểm bằng vét cạn tường minh trong kiem/coinbalance.js): biết nặng 3^k · nặng/nhẹ có hướng (3^k−3)/2 ·
   thêm xu chuẩn (3^k−1)/2 · chỉ tìm xu (3^k−1)/2 · tìm xu + xu chuẩn (3^k+1)/2.

   ── Trạng thái (Puz.plan, mục 11.2) ───────────────────────────────────────────────────────────────────────────────────────────
   C = n + ref xu (xu chuẩn, nếu có, mang chỉ số n và luôn thật). Bản ghi của một lần cân (W = C + 1 số): [đĩa của xu 0 … xu C−1, kết quả]
   với đĩa 0 ngoài · 1 trái · 2 phải, kết quả 1 trái nặng hơn · 2 cân bằng · 3 phải nặng hơn. Kết luận = nộp kèm tham số [xu + 1, hướng] (hướng 0 không cần · 1 nặng · 2 nhẹ).
   Oracle TẤT ĐỊNH và kết quả ghi VÀO diff: cố định = bí mật 'data.secret {coin, heavy}'; đối thủ = hàm thuần của lịch sử (chọn nhánh khó nhất theo DP, phá hoà bằng Puz.rng từ băm
   (đề, lịch sử)) — hoàn tác/làm lại/khôi phục/replay áp lại đúng kết quả cũ. Ngân sách k CỨNG; hoàn tác được nhưng grade ghi nhận (không "câu" được kết quả).

   Action: {k:"weigh", L:[chỉ số xu…], R:[…]} · {k:"conclude", coin, heavy?} · {k:"truncate", n} (quay về sau n lần cân / mở lại sau kết luận).
   solved = đã kết luận VÀ kết luận bị lịch sử ép buộc (đúng một khả năng còn lại, khớp). mistakes = lần cân làm mất khả năng thắng chắc (kết quả nào đó thành thế không giải được) hoặc kết luận chưa chứng minh. */
(function (root) {
  "use strict";
  var P = root.Puz;
  var plan = P.plan, G = P.grade;

  var CG = 0, CU = 1, CH = 2, CL = 3;                                  // lớp xu: chắc thật / chưa rõ / chỉ có thể nặng / chỉ có thể nhẹ
  var POW3 = [1, 3, 9, 27, 81, 243, 729, 2187, 6561];
  var MAX_K = 4, MAX_N = 81;
  var OUT_NAME = { 1: "bên trái nặng hơn", 2: "cân bằng", 3: "bên phải nặng hơn" };
  var OUT_SHORT = { 1: "Trái nặng hơn", 2: "Cân bằng", 3: "Phải nặng hơn" };

  function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function copyState(s) { return { v: s.v.slice(), c: null }; }
  function after(s, diff) { var t = copyState(s); P.game.applyDiff(t, diff.d, false); return t; }
  function J(x) { return JSON.stringify(x); }

  // ================================================================================================= ĐẾM LỚP + DP MINIMAX
  var memo = new Map(), memoSize = 0;
  function memoKey(u, h, l, g, r, goal) { return ((((u * 128 + h) * 128 + l) * 128 + g) * 8 + r) * 2 + goal; }
  function nposs(u, h, l) { return 2 * u + h + l; }
  function goalOk(u, h, l, goal) { return goal ? u + h + l <= 1 : 2 * u + h + l <= 1; }

  /** Liệt kê các phép cân CHÍNH TẮC (bỏ đối xứng đổi đĩa) của trạng thái (u,h,l,g) còn r lần cân (kể cả lần này) mà ba nhánh đều qua được cận 3^(r−1).
      visit(w) → true để dừng. w = {u1,h1,l1,u2,h2,l2,g1,g2} (g1/g2 = xu thật bù cho đĩa thiếu). Chỉ cân xu thật ở cả hai đĩa thì vô ích nên bỏ. */
  function enumW(u, h, l, g, r, goal, visit) {
    var B = POW3[r - 1], gg = Math.min(g, u + h + l), u1, u2, h1, h2, l1, l2, u0, h0, l0, a, b, d, p2, w;
    for (u1 = 0; u1 <= u && u1 <= B; u1++) {
      for (u2 = 0; u2 <= u - u1 && u1 + u2 <= B; u2++) {
        if (u2 > u1) break;                                            // chính tắc: (u1,h1,l1) ≥ (u2,h2,l2) theo thứ tự từ điển — u2 > u1 chỉ có thể bị loại
        u0 = u - u1 - u2;
        if ((goal ? u0 : 2 * u0) > B) continue;
        for (h1 = 0; h1 <= h && u1 + u2 + h1 <= B; h1++) {
          for (h2 = 0; h2 <= h - h1 && u1 + u2 + h2 <= B; h2++) {
            if (u1 === u2 && h2 > h1) break;
            h0 = h - h1 - h2;
            for (l1 = 0; l1 <= l && u1 + u2 + h2 + l1 <= B; l1++) {
              for (l2 = 0; l2 <= l - l1 && u1 + u2 + h1 + l2 <= B; l2++) {
                if (u1 === u2 && h1 === h2 && l2 > l1) break;
                a = u1 + h1 + l1; b = u2 + h2 + l2;
                if (a + b === 0) continue;
                d = a - b; if (d > gg || -d > gg) continue;
                l0 = l - l1 - l2;
                p2 = (goal ? u0 : 2 * u0) + h0 + l0;
                if (p2 > B) continue;
                w = { u1: u1, h1: h1, l1: l1, u2: u2, h2: h2, l2: l2, g1: d < 0 ? -d : 0, g2: d > 0 ? d : 0 };
                if (visit(w)) return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
  /** Ba nhánh của phép cân w từ trạng thái s={u,h,l,g}: [{code:1 trái nặng, 2 cân bằng, 3 phải nặng, u,h,l,g}]. g thật = tổng xu − số xu còn nghi. */
  function outcomesOf(s, w) {
    var tot = s.u + s.h + s.l + s.g, out = [
      { code: 1, u: 0, h: w.u1 + w.h1, l: w.u2 + w.l2 },
      { code: 2, u: s.u - w.u1 - w.u2, h: s.h - w.h1 - w.h2, l: s.l - w.l1 - w.l2 },
      { code: 3, u: 0, h: w.u2 + w.h2, l: w.u1 + w.l1 }];
    out.forEach(function (o) { o.g = tot - o.u - o.h - o.l; });
    return out;
  }
  function branchSolved(o, r, goal) { return o.u + o.h + o.l === 0 || solv(o.u, o.h, o.l, o.g, r, goal); }
  /** Còn giải được (chắc chắn, trong r lần cân) không? goal 0: biết cả hướng; 1: chỉ cần chỉ ra xu. */
  function solv(u, h, l, g, r, goal) {
    var cand = u + h + l;
    if (cand === 0 || goalOk(u, h, l, goal)) return true;
    if (r <= 0) return false;
    if ((goal ? cand : 2 * u + h + l) > POW3[r]) return false;
    var gg = g < cand ? g : cand, key = memoKey(u, h, l, gg, r, goal), hit = memo.get(key);
    if (hit !== undefined) return hit;
    var s = { u: u, h: h, l: l, g: gg };
    var res = enumW(u, h, l, gg, r, goal, function (w) {
      var outs = outcomesOf(s, w);
      for (var i = 0; i < 3; i++) if (!branchSolved(outs[i], r - 1, goal)) return false;
      return true;
    });
    if (memoSize > 400000) { memo.clear(); memoSize = 0; }
    memo.set(key, res); memoSize++;
    return res;
  }
  /** Số lần cân ít nhất (≤ cap) để giải chắc chắn; cap + 1 nếu cần nhiều hơn. */
  function need(s, goal, cap) {
    for (var r = 0; r <= cap; r++) if (solv(s.u, s.h, s.l, s.g, r, goal)) return r;
    return cap + 1;
  }
  /** Mọi phép cân AN TOÀN (cả ba nhánh còn giải được trong r−1 lần) + ba nhánh của chúng. */
  function safeWeighings(s, r, goal) {
    var out = [];
    enumW(s.u, s.h, s.l, s.g, r, goal, function (w) {
      var outs = outcomesOf(s, w), ok = true, i;
      for (i = 0; i < 3 && ok; i++) if (!branchSolved(outs[i], r - 1, goal)) ok = false;
      if (ok) out.push({ w: w, outs: outs });
      return false;
    });
    return out;
  }
  /** Phép cân tốt nhất: an toàn, nhánh lớn nhất NHỎ nhất; hoà → tổng bình phương số khả năng nhỏ nhất (cân bằng thông tin); hoà → thứ tự từ điển của (u1,h1,l1,u2,h2,l2). null nếu không có. */
  function bestWeighing(s, r, goal) {
    var list = safeWeighings(s, r, goal), best = null, bk = null;
    list.forEach(function (x) {
      var ps = x.outs.map(function (o) { return nposs(o.u, o.h, o.l); }), k = [Math.max.apply(null, ps), ps[0] * ps[0] + ps[1] * ps[1] + ps[2] * ps[2], -(x.w.u1 + x.w.h1 + x.w.l1 + x.w.u2 + x.w.h2 + x.w.l2), x.w.u1, x.w.h1, x.w.l1, x.w.u2, x.w.h2, x.w.l2];
      if (!bk || lexLess(k, bk)) { best = x; bk = k; }
    });
    return best;
  }
  function lexLess(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; }

  // ================================================================================================= STATE ↔ LỚP XU
  function dataOk(d) { return d && typeof d === "object" && isInt(d.n, 2, MAX_N) && isInt(d.k, 1, MAX_K) && (d.fake === "heavy" || d.fake === "either") && (d.ref === 0 || d.ref === 1) && (d.dir === 0 || d.dir === 1); }
  function layoutOf(d) { return plan.layout(d.k, d.n + d.ref + 1, 2); }
  /** 0 = phải biết cả hướng, 1 = chỉ cần chỉ ra xu. Phiên bản "biết nặng hơn" (không có lớp U) hai mục tiêu trùng nhau nên dir = 0 ⇒ goal 1 là đủ. */
  function goalFor(d) { return d.dir ? 0 : 1; }
  /** Lớp từng xu sau khi áp các lần cân đã ghi. */
  function classesOf(d, s) {
    var C = d.n + d.ref, cls = [], i, L = layoutOf(d), recs = plan.read(s, L);
    for (i = 0; i < d.n; i++) cls.push(d.fake === "heavy" ? CH : CU);
    if (d.ref) cls.push(CG);
    recs.forEach(function (rec) {
      var res = rec[C];
      for (i = 0; i < C; i++) {
        var pan = rec[i], c = cls[i];
        if (res === 2) { if (pan !== 0) cls[i] = CG; }
        else if (res === 1) cls[i] = pan === 1 ? (c === CU || c === CH ? CH : CG) : pan === 2 ? (c === CU || c === CL ? CL : CG) : CG;
        else if (res === 3) cls[i] = pan === 2 ? (c === CU || c === CH ? CH : CG) : pan === 1 ? (c === CU || c === CL ? CL : CG) : CG;
      }
    });
    return cls;
  }
  function countsOf(cls) { var s = { u: 0, h: 0, l: 0, g: 0 }; cls.forEach(function (c) { if (c === CU) s.u++; else if (c === CH) s.h++; else if (c === CL) s.l++; else s.g++; }); return s; }
  function budget(d, s) { return d.k - plan.count(s); }
  /** Phép cân (đếm lớp) của hai tập xu L, R (mảng chỉ số) theo lớp cls. */
  function weighingOf(cls, Lset, Rset) {
    var w = { u1: 0, h1: 0, l1: 0, g1: 0, u2: 0, h2: 0, l2: 0, g2: 0 };
    Lset.forEach(function (i) { var c = cls[i]; if (c === CU) w.u1++; else if (c === CH) w.h1++; else if (c === CL) w.l1++; else w.g1++; });
    Rset.forEach(function (i) { var c = cls[i]; if (c === CU) w.u2++; else if (c === CH) w.h2++; else if (c === CL) w.l2++; else w.g2++; });
    return w;
  }
  /** Chuyển phép cân đếm lớp thành hai tập xu cụ thể: lấy xu chỉ số nhỏ nhất của từng lớp (tất định); đĩa trái lấy trước. */
  function coinsFor(cls, w) {
    var by = { 1: [], 2: [], 3: [], 0: [] }, i, L = [], R = [];
    for (i = 0; i < cls.length; i++) by[cls[i]].push(i);
    function take(c, n, into) { for (var k = 0; k < n; k++) into.push(by[c].shift()); }
    take(CU, w.u1, L); take(CU, w.u2, R); take(CH, w.h1, L); take(CH, w.h2, R); take(CL, w.l1, L); take(CL, w.l2, R);
    var gl = [], gr = []; take(CG, w.g1, gl); take(CG, w.g2, gr);
    return { L: L.concat(gl).sort(function (a, b) { return a - b; }), R: R.concat(gr).sort(function (a, b) { return a - b; }) };
  }
  function candidates(cls) { var o = []; cls.forEach(function (c, i) { if (c !== CG) o.push(i); }); return o; }

  // ================================================================================================= ORACLE
  function panArray(C, Lset, Rset) { var a = zeros(C); Lset.forEach(function (i) { a[i] = 1; }); Rset.forEach(function (i) { a[i] = 2; }); return a; }
  function fixedResult(d, pans) {
    var c = d.secret.coin, hv = d.secret.heavy ? 1 : 0, pan = pans[c];
    if (pan === 0) return 2;
    return (pan === 1) === !!hv ? 1 : 3;
  }
  /** Đối thủ: trong ba kết quả còn nhất quán, chọn nhánh KHÓ nhất — cần nhiều lần cân nhất (cap + 1 = không giải được trong lượt còn lại), hoà → nhiều khả năng hơn, hoà → Puz.rng từ băm (đề, lịch sử). */
  function advResult(p, s, pans) {
    var d = p.data, cls = classesOf(d, s), cnt = countsOf(cls), C = d.n + d.ref, Ls = [], Rs = [], i, goal = goalFor(d), cap = budget(d, s) - 1;
    for (i = 0; i < C; i++) if (pans[i] === 1) Ls.push(i); else if (pans[i] === 2) Rs.push(i);
    var outs = outcomesOf(cnt, weighingOf(cls, Ls, Rs)).filter(function (o) { return nposs(o.u, o.h, o.l) > 0; });
    outs.forEach(function (o) { o.need = need(o, goal, Math.max(0, cap)); o.np = nposs(o.u, o.h, o.l); });
    if (!outs.length) return 2;                                          // state hỏng (sửa tay): không còn nhánh khả dĩ nào — trả "cân bằng" thay vì ném TypeError trong moveFor
    var top = outs[0];
    outs.forEach(function (o) { if (o.need > top.need || (o.need === top.need && o.np > top.np)) top = o; });
    var ties = outs.filter(function (o) { return o.need === top.need && o.np === top.np; });
    if (ties.length === 1) return ties[0].code;
    var hist = plan.read(s, layoutOf(d)).map(function (r) { return r.join(","); }).join(";");
    var r0 = P.rng.create(P.rng.hash32(J([d, p.seed == null ? 0 : p.seed]) + "|" + hist + "|" + pans.join("")));
    return ties[r0.int(ties.length)].code;
  }
  function oracle(p, s, pans) { return p.data.mode === "adv" || !p.data.secret ? advResult(p, s, pans) : fixedResult(p.data, pans); }

  // ================================================================================================= HIỂN THỊ CHỮ
  function ranges(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; }), out = [], i = 0;
    while (i < a.length) { var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; if (j - i >= 2) out.push((a[i] + 1) + "–" + (a[j] + 1)); else for (var k = i; k <= j; k++) out.push(String(a[k] + 1)); i = j + 1; }
    return out.join(", ");
  }
  function setText(arr) { return "{" + ranges(arr) + "}"; }
  function viNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function classText(c, noG) {
    var out = [];
    if (c.u) out.push(c.u + " xu chưa rõ (nặng hoặc nhẹ)");
    if (c.h) out.push(c.h + " xu nghi nặng hơn");
    if (c.l) out.push(c.l + " xu nghi nhẹ hơn");
    if (!noG) out.push(c.g ? c.g + " xu chắc chắn thật" : "chưa có xu nào chắc chắn thật");
    return out.join(", ");
  }
  /** "xu 1–4 nếu nặng hơn, xu 5–8 nếu nhẹ hơn" — nhánh còn lại sau một kết quả (lấy từ các xu cụ thể). */
  function branchWho(cls, o, Lset, Rset) {
    var heavy = [], light = [], either = [], i;
    if (o.code === 1 || o.code === 3) {
      var hs = o.code === 1 ? Lset : Rset, ls = o.code === 1 ? Rset : Lset;
      hs.forEach(function (c) { if (cls[c] === CU || cls[c] === CH) heavy.push(c); });
      ls.forEach(function (c) { if (cls[c] === CU || cls[c] === CL) light.push(c); });
    } else {
      var onPan = {}; Lset.concat(Rset).forEach(function (c) { onPan[c] = 1; });
      for (i = 0; i < cls.length; i++) if (!onPan[i] && cls[i] !== CG) { if (cls[i] === CU) either.push(i); else if (cls[i] === CH) heavy.push(i); else light.push(i); }
    }
    var parts = [];
    if (either.length) parts.push("xu " + setText(either) + " (nặng hoặc nhẹ)");
    if (heavy.length) parts.push("xu " + setText(heavy) + " nếu nặng hơn");
    if (light.length) parts.push("xu " + setText(light) + " nếu nhẹ hơn");
    return parts.join(", ");
  }
  function possText(n) { return n + " khả năng"; }
  function setsText(Ls, Rs) { return setText(Ls) + " với " + setText(Rs); }

  // ================================================================================================= GIẢI THÍCH PHÉP CÂN (lý do an toàn / hỏng)
  /** Vì sao phép cân w từ trạng thái s (còn r lần) KHÔNG an toàn — chuỗi tiếng Việt; null nếu thực ra an toàn. */
  function whyUnsafe(s, r, w, goal) {
    var outs = outcomesOf(s, w), i, B = POW3[r - 1];
    for (i = 0; i < 3; i++) {
      var o = outs[i], np = nposs(o.u, o.h, o.l), cd = o.u + o.h + o.l, lim = goal ? cd : np;
      if (cd === 0) continue;
      if (lim > B) return "nếu " + OUT_NAME[o.code] + " thì còn " + possText(np) + " mà " + (r - 1) + " lần cân còn lại chỉ phân biệt được tối đa " + B + " (mỗi lần 3 kết quả)";
      if (!branchSolved(o, r - 1, goal)) {
        var nd = need(o, goal, 7);
        return "nếu " + OUT_NAME[o.code] + " thì còn " + possText(np) + " (" + classText(o, true) + "), nhưng không có cách cân nào chắc chắn tách hết trong " + (r - 1) + " lần" + (nd <= 7 ? " — cần ít nhất " + nd + " lần" : "");
      }
    }
    return null;
  }
  /** Phép cân "láng giềng" của w (thêm / bớt một xu mỗi đĩa cùng lớp) để so sánh trong lời giải thích. Chỉ xét phép cân đối xứng (không cần xu thật bù). */
  function neighbours(s, w) {
    var out = [];
    if (w.g1 || w.g2) return out;
    ["u", "h", "l"].forEach(function (c) {
      var a = c + "1", b = c + "2", m, q;
      if (w[a] > 0 && w[b] > 0) { m = Object.assign({}, w); m[a]--; m[b]--; if (m.u1 + m.h1 + m.l1 + m.u2 + m.h2 + m.l2 > 0) out.push({ w: m, kind: "bớt" }); }
      if (w[a] + w[b] + 2 <= s[c]) { q = Object.assign({}, w); q[a]++; q[b]++; out.push({ w: q, kind: "thêm" }); }
    });
    return out;
  }

  // ================================================================================================= PHIÊN BẢN, ĐỀ
  var SIZES = [
    { id: "nang2", label: "Biết giả NẶNG hơn · 2 lần", params: { k: 2, fake: "heavy", ref: 0, dir: 0, nMin: 4, nMax: 9 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "nang3", label: "Biết giả NẶNG hơn · 3 lần", params: { k: 3, fake: "heavy", ref: 0, dir: 0, nMin: 10, nMax: 27 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "nn3", label: "Nặng hay nhẹ · 3 lần", params: { k: 3, fake: "either", ref: 0, dir: 1, nMin: 4, nMax: 12 }, default: true, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "nnc3", label: "Nặng hay nhẹ + xu chuẩn · 3 lần", params: { k: 3, fake: "either", ref: 1, dir: 1, nMin: 5, nMax: 13 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "tim3", label: "Chỉ chỉ ra xu · 3 lần", params: { k: 3, fake: "either", ref: 0, dir: 0, nMin: 5, nMax: 13 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "nn4", label: "Nặng hay nhẹ · 4 lần", params: { k: 4, fake: "either", ref: 0, dir: 1, nMin: 13, nMax: 39 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];
  var SIZE_NOTE = {                                                          // mô tả ngắn cho luật chơi/gợi ý
    heavy: "Biết xu giả NẶNG hơn xu thật.", either: "Không biết xu giả nặng hơn hay nhẹ hơn."
  };

  function fixData(d) { return { n: d.n, k: d.k, fake: d.fake, ref: d.ref, dir: d.dir, mode: d.mode, secret: d.secret ? { coin: d.secret.coin, heavy: d.secret.heavy ? 1 : 0 } : null }; }
  function startCounts(d) { return d.fake === "heavy" ? { u: 0, h: d.n, l: 0, g: d.ref } : { u: d.n, h: 0, l: 0, g: d.ref }; }
  /** k* = số lần cân ít nhất chắc chắn đủ; k + 1 nếu k lần không đủ. */
  function bestK(d) { return need(startCounts(d), goalFor(d), d.k); }

  // ---- độ khó: sức ép (số khả năng so với 3^k) và độ HẸP của phép cân đầu (tỉ lệ phép cân đầu chính tắc mà an toàn) — cả hai tăng khi n tiến tới biên
  function firstStats(d) {
    var s = startCounts(d), goal = goalFor(d), safe = 0, all = 0;
    enumAll(s, function (w) { all++; var outs = outcomesOf(s, w), ok = true; for (var i = 0; i < 3 && ok; i++) if (!branchSolved(outs[i], d.k - 1, goal)) ok = false; if (ok) safe++; });
    return { safe: safe, all: Math.max(1, all) };
  }
  /** Mọi phép cân chính tắc (KHÔNG cắt bằng cận) của trạng thái đầu — để đếm tỉ lệ an toàn. */
  function enumAll(s, visit) {
    var u1, u2, h1, h2, l1, l2, gg = Math.min(s.g, s.u + s.h + s.l);
    for (u1 = 0; u1 <= s.u; u1++) for (u2 = 0; u2 <= Math.min(u1, s.u - u1); u2++)
      for (h1 = 0; h1 <= s.h; h1++) for (h2 = 0; h2 <= s.h - h1; h2++) {
        if (u1 === u2 && h2 > h1) break;
        for (l1 = 0; l1 <= s.l; l1++) for (l2 = 0; l2 <= s.l - l1; l2++) {
          if (u1 === u2 && h1 === h2 && l2 > l1) break;
          var a = u1 + h1 + l1, b = u2 + h2 + l2, dd = a - b;
          if (a + b === 0 || dd > gg || -dd > gg) continue;
          visit({ u1: u1, h1: h1, l1: l1, u2: u2, h2: h2, l2: l2, g1: dd < 0 ? -dd : 0, g2: dd > 0 ? dd : 0 });
        }
      }
  }
  var scoreMemo = {};
  /** Điểm 0–10 từ dữ liệu đề (không phụ thuộc xu giả cố định): m = 0,55 · sức ép (số khả năng / 3^k) + 0,45 · độ hẹp của phép cân đầu (1 − tỉ lệ phép cân đầu an toàn);
      điểm = 0,6 + 9 · m, chế độ đối thủ cộng 0,5. Hiệu chỉnh bằng đo: mỗi phiên bản phủ đủ bốn bậc ở CẢ HAI chế độ (kiểm trong kiem/coinbalance.js). */
  function scoreOf(d) {
    var key = [d.n, d.k, d.fake, d.ref, d.dir, d.mode].join("|");
    if (scoreMemo[key] !== undefined) return scoreMemo[key];
    var s = startCounts(d), pressure = Math.min(1, nposs(s.u, s.h, s.l) / POW3[d.k]), fs = firstStats(d), narrow = 1 - fs.safe / fs.all;
    var sc = P.util.clampScore(0.6 + 9 * (0.55 * pressure + 0.45 * narrow) + (d.mode === "adv" ? 0.5 : 0));
    scoreMemo[key] = sc;
    return sc;
  }

  var maxNMemo = {};
  /** Số xu TỐI ĐA có chiến lược chắc chắn trong k lần cho (fake, ref, dir) — 0 nếu không có n nào (quét n = 1…MAX_N; kết quả nhớ đệm). Cho trình soạn nói "tối đa …". */
  function maxN(fake, ref, dir, k) {
    var key = [fake, ref, dir, k].join("|");
    if (maxNMemo[key] !== undefined) return maxNMemo[key];
    var best = 0;
    for (var n = 1; n <= MAX_N; n++) if (bestK({ n: n, k: k, fake: fake, ref: ref, dir: dir }) <= k) best = n;
    maxNMemo[key] = best;
    return best;
  }

  function buildPuzzle(seed, sizeId, sizeParams, d, tier, mode) {
    var L = layoutOf(d), p = { v: 1, type: "coinbalance", seed: seed, sizeId: sizeId, size: { n: d.n, k: d.k }, tier: tier, score: 0, data: fixData(d), initial: { v: plan.empty(L) }, solution: null, meta: {} };
    p.score = scoreOf(p.data);
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    var play = playOptimal(p);
    p.solution = play ? { v: play.state.v } : null;
    p.id = P.util.puzzleId(p);
    return p;
  }

  // ================================================================================================= CHƠI TỐI ƯU (solution, replay)
  function explainWeighing(d, s, w, sol, cls, r) {
    var cnt = countsOf(cls), goal = goalFor(d), lines = [], B = POW3[r - 1], np0 = nposs(cnt.u, cnt.h, cnt.l), Ls = sol.L, Rs = sol.R;
    lines.push("Còn " + possText(goal ? cnt.u + cnt.h + cnt.l : np0) + (goal ? " (xu còn nghi)" : "") + " và " + r + " lần cân. Mỗi lần cân có 3 kết quả nên sau lần này mỗi nhánh phải còn ≤ " + B + (goal ? " xu" : " khả năng") + ".");
    outcomesOf(cnt, weighingOf(cls, Ls, Rs)).forEach(function (o) {
      var np = nposs(o.u, o.h, o.l), cd = o.u + o.h + o.l;
      if (!cd) { lines.push("Nếu " + OUT_NAME[o.code] + ": không thể xảy ra."); return; }
      var who = branchWho(cls, o, Ls, Rs);
      lines.push("Nếu " + OUT_NAME[o.code] + ": " + who + " — " + possText(np) + (np <= B || goal ? " ≤ " + B : "") + (goalOk(o.u, o.h, o.l, goal) ? "; đã đủ để kết luận." : "; còn " + (r - 1) + " lần cân " + (o.g ? "và " + o.g + " xu chắc chắn thật làm mốc." : "(chưa có xu thật làm mốc).")));
    });
    var alts = neighbours(cnt, w), shown = 0;
    alts.forEach(function (a) {
      if (shown >= 2) return;
      var why = whyUnsafe(cnt, r, a.w, goal);
      if (!why) return;
      var m = a.w, na = m.u1 + m.h1 + m.l1;
      lines.push("Vì sao không " + a.kind + " một xu mỗi đĩa (" + na + " với " + na + "): " + why + ".");
      shown++;
    });
    return lines;
  }

  /** Ván chơi tối ưu chống CHÍNH oracle của đề: [{diff, action, text, why, cells}] + trạng thái cuối. null nếu đề không có chiến lược chắc chắn trong k lần. */
  function playOptimal(p) {
    var d = p.data, L = layoutOf(d), s = { v: plan.empty(L), c: null }, steps = [], goal = goalFor(d), guard = 0;
    p = Object.assign({}, p, { solution: null });
    while (guard++ < d.k + 3) {
      var cls = classesOf(d, s), cnt = countsOf(cls), r = budget(d, s);
      if (goalOk(cnt.u, cnt.h, cnt.l, goal)) {
        var cand = candidates(cls), coin = cand[0], heavy = cls[coin] === CH;
        if (!cand.length) return null;
        var act = { k: "conclude", coin: coin }; if (d.dir) act.heavy = heavy;
        var dd = moveFor(p, s, act);
        steps.push({ diff: dd, action: act, cells: [coin], text: "Chỉ còn một khả năng — xu " + (coin + 1) + " là xu giả" + (d.dir ? (heavy ? " (nặng hơn)." : " (nhẹ hơn).") : "."), why: ["Các lần cân trước loại hết các xu còn lại: xu " + (coin + 1) + " là xu duy nhất chưa được chứng minh là thật" + (d.dir ? ", và chỉ " + (heavy ? "nặng hơn" : "nhẹ hơn") + " mới khớp mọi kết quả." : ".")] });
        P.game.applyDiff(s, dd.d, false);
        return { state: s, steps: steps };
      }
      if (r <= 0) return null;
      var best = bestWeighing(cnt, r, goal);
      if (!best) return null;
      var sol = coinsFor(cls, Object.assign({}, best.w)), act2 = { k: "weigh", L: sol.L, R: sol.R }, d2 = moveFor(p, s, act2);
      if (!d2) return null;
      var res = plan.record(after(s, d2), L, plan.count(s))[d.n + d.ref];
      var why = explainWeighing(d, s, best.w, sol, cls, r);
      steps.push({ diff: d2, action: act2, cells: sol.L.concat(sol.R), text: "Lần cân " + (plan.count(s) + 1) + ": " + setsText(sol.L, sol.R) + " → " + OUT_NAME[res] + ".", why: why });
      P.game.applyDiff(s, d2.d, false);
    }
    return null;
  }

  // ================================================================================================= moveFor / check / mistakes / grade
  function listOk(a, C) { return Array.isArray(a) && a.every(function (x) { return isInt(x, 0, C - 1); }); }
  function moveFor(p, s, a) {
    var d = p.data, L = layoutOf(d), C = d.n + d.ref;
    if (!a || typeof a !== "object") return null;
    if (a.k === "weigh") {
      if (!listOk(a.L, C) || !listOk(a.R, C) || a.L.length !== a.R.length || !a.L.length) return null;
      var seen = {}, bad = false;
      a.L.concat(a.R).forEach(function (i) { if (seen[i]) bad = true; seen[i] = 1; });
      if (bad || plan.isSubmitted(s) || plan.count(s) >= d.k) return null;
      var pans = panArray(C, a.L, a.R), res = oracle(p, s, pans), rec = pans.concat([res]);
      return plan.appendDiff(s, L, [rec], "Cân " + setsText(a.L, a.R) + ": " + OUT_SHORT[res].toLowerCase());
    }
    if (a.k === "conclude") {
      if (!isInt(a.coin, 0, d.n - 1) || plan.isSubmitted(s)) return null;
      if (d.dir && typeof a.heavy !== "boolean") return null;
      return plan.submitDiff(s, L, [a.coin + 1, d.dir ? (a.heavy ? 1 : 2) : 0], "Kết luận: xu " + (a.coin + 1) + (d.dir ? (a.heavy ? " nặng hơn" : " nhẹ hơn") : " là xu giả"));
    }
    if (a.k === "truncate") return plan.truncateDiff(s, L, a.n);
    return null;
  }
  function concluded(p, s) {
    var ps = plan.params(s, layoutOf(p.data));
    return plan.isSubmitted(s) ? { coin: ps[0] - 1, dir: ps[1] } : null;
  }
  /** Kết luận (nếu có) có bị lịch sử ÉP BUỘC không: còn đúng một khả năng (hoặc một xu, nếu chỉ cần chỉ ra xu) và khớp. */
  function forcedOk(p, s, cls) {
    var d = p.data, cn = concluded(p, s), cnt = countsOf(cls), goal = goalFor(d);
    if (!cn || !goalOk(cnt.u, cnt.h, cnt.l, goal)) return false;
    var cand = candidates(cls);
    if (cand.length !== 1 || cand[0] !== cn.coin) return false;
    return d.dir ? cn.dir === (cls[cn.coin] === CH ? 1 : 2) : true;
  }
  function check(p, s) {
    var d = p.data, cls = classesOf(d, s), cn = concluded(p, s), solved = !!cn && forcedOk(p, s, cls), conflicts = [];
    if (cn && cn.coin >= 0 && cn.coin < d.n && !solved) {
      var c = cls[cn.coin];
      if (c === CG || (d.dir && ((c === CH && cn.dir === 2) || (c === CL && cn.dir === 1)))) conflicts.push(cn.coin);       // mâu thuẫn với chính các lần cân đã ghi
    }
    var cnt = countsOf(cls);
    return { solved: solved, conflicts: conflicts, filled: plan.count(s), total: p.solution ? plan.count({ v: p.solution.v }) : d.k, complete: goalOk(cnt.u, cnt.h, cnt.l, goalFor(d)) && cnt.u + cnt.h + cnt.l > 0 };
  }
  /** Lần cân (hoặc kết luận) trong diff có làm mất khả năng thắng chắc không (gọi TRƯỚC khi áp diff). */
  function mistakes(p, s, diff) {
    var d = p.data, t = after(s, diff), goal = goalFor(d);
    if (plan.isSubmitted(t) && !plan.isSubmitted(s)) return check(p, t).solved ? 0 : 1;
    if (plan.count(t) > plan.count(s)) {
      var cls = classesOf(d, s), cnt = countsOf(cls), r = budget(d, s);
      if (!solv(cnt.u, cnt.h, cnt.l, cnt.g, r, goal)) return 0;                             // đã mất từ trước — không tính lại
      var C = d.n + d.ref, rec = plan.record(t, layoutOf(d), plan.count(s)), Ls = [], Rs = [], i;
      for (i = 0; i < C; i++) if (rec[i] === 1) Ls.push(i); else if (rec[i] === 2) Rs.push(i);
      var outs = outcomesOf(cnt, weighingOf(cls, Ls, Rs));
      for (i = 0; i < 3; i++) if (!branchSolved(outs[i], r - 1, goal)) return 1;
    }
    return 0;
  }
  function grade(p, s, counters) {
    var d = p.data, c = counters || {}, best = bestK(d), used = plan.count(s), solved = check(p, s).solved, bestV = best <= d.k ? best : d.k;
    var g = G.fromRatio(used, bestV, "min", { digits: 0 });
    if (!solved) { g.stars = 0; g.quality = 0; g.text = plan.isSubmitted(s) ? "Kết luận chưa được chứng minh" : "Chưa kết luận"; return g; }
    var penal = (c.undos || 0) > 0 || (c.hints && c.hints[3] > 0), lucky = (c.mistakes || 0) > 0, slack = used > bestV;
    g.stars = lucky || slack ? 1 : penal ? 2 : 3;
    g.text = lucky ? "Thắng nhưng có sai sót: lần cân mất an toàn (có thể thắng nhờ may) hoặc kết luận chưa được chứng minh" : slack ? "Dùng " + used + " lần cân (đủ trong " + bestV + ")"
      : penal ? "Đủ " + bestV + " lần cân nhưng có hoàn tác hoặc gợi ý mức 3" : used < bestV ? "Tối ưu — còn thắng sớm hơn " + bestV + " lần cân" : "Tối ưu: chắc chắn trong " + bestV + " lần cân, không hoàn tác";
    return g;
  }

  // ================================================================================================= gợi ý
  function lostAt(p, s) {
    var d = p.data, goal = goalFor(d), L = layoutOf(d), recs = plan.read(s, L), j, st = { v: plan.empty(L), c: null };
    for (j = 0; j <= recs.length; j++) {
      var cls = classesOf(d, st), cnt = countsOf(cls);
      if (!solv(cnt.u, cnt.h, cnt.l, cnt.g, d.k - j, goal)) return j;
      if (j < recs.length) { var dd = plan.appendDiff(st, L, [recs[j]]); P.game.applyDiff(st, dd.d, false); }
    }
    return -1;
  }
  function stateAfter(p, s, j) {
    var d = p.data, L = layoutOf(d), recs = plan.read(s, L), st = { v: plan.empty(L), c: null };
    for (var i = 0; i < j; i++) { var dd = plan.appendDiff(st, L, [recs[i]]); P.game.applyDiff(st, dd.d, false); }
    return st;
  }
  function hint(p, s, level) {
    var d = p.data, L = layoutOf(d), goal = goalFor(d), cls = classesOf(d, s), cnt = countsOf(cls), r = budget(d, s), C = d.n + d.ref, cn = concluded(p, s);
    var cand = candidates(cls);
    if (cn) {
      if (check(p, s).solved) return { level: level, text: "Đã kết luận đúng — kết luận được chứng minh từ các lần cân.", why: [], cells: [], none: true };
      var reopen = { k: "truncate", n: plan.count(s) };
      return { level: level, technique: "Mở lại", text: level === 1 ? "Kết luận này chưa được chứng minh từ các lần cân — đoán đúng cũng chưa tính." : "Kết luận xu " + (cn.coin + 1) + " chưa được chứng minh: các lần cân vẫn còn " + possText(nposs(cnt.u, cnt.h, cnt.l)) + (cnt.u + cnt.h + cnt.l > 1 ? " (" + cand.length + " xu còn nghi)" : "") + ".",
        why: ["Chỉ khi các lần cân loại hết mọi xu khác (và hướng, nếu phải nói) thì kết luận mới được tính.", "Mở lại để cân tiếp hoặc hoàn tác về lần cân trước."], cells: [cn.coin], action: level === 3 ? reopen : null };
    }
    var j = lostAt(p, s);
    if (j >= 1) {
      var st0 = stateAfter(p, s, j - 1), cls0 = classesOf(d, st0), cnt0 = countsOf(cls0), rec = plan.record(s, L, j - 1), Ls = [], Rs = [], i;
      for (i = 0; i < C; i++) if (rec[i] === 1) Ls.push(i); else if (rec[i] === 2) Rs.push(i);
      var why0 = whyUnsafe(cnt0, d.k - (j - 1), weighingOf(cls0, Ls, Rs), goal);
      var lines = ["Lần cân thứ " + j + " (" + setsText(Ls, Rs) + ") làm mất an toàn: " + (why0 || "một kết quả khả dĩ không còn giải được trong số lần còn lại") + ".", "Hoàn tác về trước lần cân đó để chọn phép cân khác."];
      return { level: level, technique: "Hoàn tác", cells: Ls.concat(Rs),
        text: level === 1 ? "Từ thế này không còn cách cân nào chắc chắn tìm ra xu giả trong " + r + " lần còn lại — một lần cân trước đã làm mất an toàn." : level === 2 ? "Lần cân thứ " + j + " đã làm mất chiến lược chắc chắn." : "Quay về trước lần cân thứ " + j + ".",
        why: level === 3 ? lines : [], action: level === 3 ? { k: "truncate", n: j - 1 } : null };
    }
    if (j === 0) return { level: level, text: "Đề này không có chiến lược chắc chắn trong " + d.k + " lần cân.", why: [], cells: [], none: true };
    if (goalOk(cnt.u, cnt.h, cnt.l, goal) && cand.length === 1) {
      var coin = cand[0], heavy = cls[coin] === CH, concl = { k: "conclude", coin: coin }; if (d.dir) concl.heavy = heavy;
      var why1 = ["Mỗi xu khác đã được chứng minh là thật qua các lần cân" + (d.dir ? ", và chỉ " + (heavy ? "nặng hơn" : "nhẹ hơn") + " mới khớp mọi kết quả." : ".")];
      return { level: level, technique: "Kết luận", cells: level === 1 ? [] : [coin], text: level === 1 ? "Các lần cân đã đủ thông tin để kết luận — chỉ còn một khả năng." : level === 2 ? "Xu " + (coin + 1) + " là xu giả — hãy bấm Kết luận." : "Kết luận: xu " + (coin + 1) + (d.dir ? (heavy ? " nặng hơn." : " nhẹ hơn.") : " là xu giả."),
        why: level === 3 ? why1 : [], action: level === 3 ? concl : null };
    }
    var best = bestWeighing(cnt, r, goal);
    if (!best) return { level: level, text: "Không còn phép cân an toàn.", why: [], cells: [], none: true };
    var sol = coinsFor(cls, best.w), B = POW3[r - 1], np = nposs(cnt.u, cnt.h, cnt.l), nc = cand.length, w = best.w;
    if (level === 1) return { level: 1, technique: "Chia ba nhánh", cells: cand, text: "Còn " + (goal ? nc + " xu còn nghi" : possText(np)) + " và " + r + " lần cân. Mỗi lần cân có 3 kết quả nên sau lần này mỗi nhánh phải còn ≤ " + B + (goal ? " xu" : " khả năng") + " — hãy chia các xu chưa rõ thành ba nhóm vừa phải (hai đĩa + phần để ngoài).", why: [], action: null };
    var onL = w.u1 + w.h1 + w.l1, onR = w.u2 + w.h2 + w.l2;
    if (level === 2) return { level: 2, technique: "Chia ba nhánh", cells: sol.L.concat(sol.R), text: "Cân hai đĩa, mỗi đĩa " + Math.max(sol.L.length, sol.R.length) + " xu" + (w.g1 + w.g2 ? " (đĩa " + (w.g1 ? "trái" : "phải") + " có " + (w.g1 + w.g2) + " xu thật bù cho đủ số)" : "") + ": " + (onL + onR) + " xu còn nghi nằm trên đĩa" + (nc - onL - onR ? ", " + (nc - onL - onR) + " xu còn nghi để ngoài." : "."), why: [], action: null };
    return { level: 3, technique: "Chia ba nhánh", cells: sol.L.concat(sol.R), text: "Cân " + setsText(sol.L, sol.R) + ".", why: explainWeighing(d, s, w, sol, cls, r), action: { k: "weigh", L: sol.L, R: sol.R } };
  }

  // ================================================================================================= đề tự nhập / kiểm / I-O
  function noStrategyText(d) {
    var k = d.k, t = POW3[k], max = d.fake === "heavy" ? t : d.dir ? (d.ref ? (t - 1) / 2 : (t - 3) / 2) : (d.ref ? (t + 1) / 2 : (t - 1) / 2);
    var kind = d.fake === "heavy" ? "biết xu giả nặng hơn" : d.dir ? "phải nói nặng hay nhẹ" : "chỉ cần chỉ ra xu";
    return d.n + " xu, " + k + " lần cân (" + kind + (d.ref ? ", có xu chuẩn" : "") + ") không có chiến lược chắc chắn" + (d.n > max ? ": tối đa " + max + " xu (giới hạn thông tin / Dyson)." : " dù chưa chạm giới hạn " + max + " — số khả năng ≤ " + t + " chưa đủ, cần cả điều kiện về xu thật làm mốc (xem trang Học).");
  }
  function fail(errors, extra) { return Object.assign({ ok: false, errors: errors, warnings: [], status: "none", count: 0 }, extra || {}); }
  function parseSecret(x) {
    if (!x || typeof x !== "object") return null;
    var coin = typeof x.coin === "string" && /^\d+$/.test(x.coin) ? Number(x.coin) : x.coin, hv = x.heavy === true || x.heavy === 1 || x.heavy === "1" || x.heavy === "heavy" ? 1 : (x.heavy === false || x.heavy === 0 || x.heavy === "0" || x.heavy === "light" ? 0 : null);
    return { coin: coin, heavy: hv };
  }
  /** seed chỉ ảnh hưởng phá hoà của ĐỐI THỦ (băm (đề, seed, lịch sử)) — đề tự nhập seed null; validate(p) truyền p.seed để dựng lại ĐÚNG lời giải p.solution. */
  function fromInput(inp) { return fromInputAt(inp, null); }
  function fromInputAt(inp, seed) {
    if (!inp || typeof inp !== "object") return fail(["Thiếu dữ liệu đề."]);
    var errs = [], num = function (x) { return typeof x === "string" && /^\s*\d+\s*$/.test(x) ? Number(x) : x; };
    var fake = inp.fake === "heavy" ? "heavy" : inp.fake === "either" ? "either" : null;
    var n = num(inp.n), k = num(inp.k), ref = num(inp.ref == null ? 0 : inp.ref), dir = num(inp.dir == null ? (fake === "heavy" ? 0 : 1) : inp.dir), mode = inp.mode === "adv" ? "adv" : inp.mode == null || inp.mode === "fixed" ? "fixed" : null;
    if (fake === null) errs.push("Loại xu giả phải là 'heavy' (biết nặng hơn) hoặc 'either' (nặng hoặc nhẹ).");
    if (!isInt(n, 2, MAX_N)) errs.push("Số xu phải là số nguyên 2–" + MAX_N + ".");
    if (!isInt(k, 1, MAX_K)) errs.push("Số lần cân phải là số nguyên 1–" + MAX_K + ".");
    if (!(ref === 0 || ref === 1 || ref === true || ref === false)) errs.push("Xu chuẩn phải là 0 hoặc 1."); else ref = ref ? 1 : 0;
    if (!(dir === 0 || dir === 1 || dir === true || dir === false)) errs.push("'Nói nặng/nhẹ' phải là 0 hoặc 1."); else dir = dir ? 1 : 0;
    if (mode === null) errs.push("Chế độ phải là 'fixed' hoặc 'adv'.");
    if (errs.length) return fail(errs);
    if (fake === "heavy") dir = 0;
    var secret = null;
    if (mode === "fixed") {
      secret = parseSecret(inp.secret);
      if (!secret) return fail(["Chế độ cố định cần xu giả: secret {coin, heavy} (hoặc chọn chế độ đối thủ)."]);
      if (!isInt(secret.coin, 0, n - 1)) errs.push("Xu giả cố định phải nằm trong 1–" + n + ".");
      if (secret.heavy === null) errs.push("Xu giả cố định phải là nặng hơn hoặc nhẹ hơn.");
      else if (fake === "heavy" && secret.heavy !== 1) errs.push("Phiên bản biết xu giả nặng hơn: xu giả cố định phải nặng hơn.");
      if (errs.length) return fail(errs);
    }
    var d = { n: n, k: k, fake: fake, ref: ref, dir: dir, mode: mode, secret: secret };
    var kstar = bestK(d);
    if (kstar > k) {
      var msg = noStrategyText(d);
      return fail([msg], { statusText: "✗ " + msg, statusKind: "bad" });
    }
    var p = buildPuzzle(seed, "tu-nhap", null, d, "custom", mode);
    if (!p.solution) return fail(["Không dựng được ván chơi tối ưu cho đề này."]);
    var warns = kstar < k ? ["Chỉ cần " + kstar + " lần cân là đủ (đề cho " + k + " lần) — ngân sách còn dư."] : [];
    return { ok: true, puzzle: p, errors: [], warnings: warns, status: "unique", count: 1, statusKind: "ok",
      statusText: "✓ Có chiến lược chắc chắn trong " + kstar + " lần cân" + (mode === "adv" ? " (kể cả khi đối thủ chọn kết quả khó nhất)" : "") };
  }
  function inputOf(d) { return { n: d.n, k: d.k, fake: d.fake, ref: d.ref, dir: d.dir, mode: d.mode, secret: d.secret ? { coin: d.secret.coin, heavy: d.secret.heavy } : null }; }

  // ---- văn bản / tệp
  var KEY_MAP = { "xu": "n", "n": "n", "so xu": "n", "lan can": "k", "k": "k", "so lan can": "k", "xu gia": "fake", "fake": "fake", "xu chuan": "ref", "ref": "ref", "noi nang/nhe": "dir", "noi nang nhe": "dir", "dir": "dir", "che do": "mode", "mode": "mode", "ma": "secret", "secret": "secret", "xu gia co dinh": "secret" };
  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function yes(v) { v = ascii(v); return /^(co|yes|1|true|y)$/.test(v) ? 1 : /^(khong|no|0|false|n)$/.test(v) ? 0 : null; }
  function parseText(text) {
    var m = {}, errs = [];
    String(text == null ? "" : text).split(/\r?\n|;/).forEach(function (line) {
      var i = line.indexOf(":"); if (i < 0) i = line.indexOf("="); if (i < 0) return;
      var key = KEY_MAP[ascii(line.slice(0, i))], val = line.slice(i + 1).trim();
      if (key && m[key] === undefined) m[key] = val;
    });
    if (m.n === undefined || m.k === undefined) return { err: "Thiếu dòng 'xu: …' hoặc 'lần cân: …'." };
    var inp = { n: /^\d+$/.test(m.n) ? Number(m.n) : m.n, k: /^\d+$/.test(m.k) ? Number(m.k) : m.k };
    if (m.fake === undefined) inp.fake = "either";
    else {                                                                 // chặt: giá trị lạ (vd "nhẹ hơn" — phiên bản không hỗ trợ) là LỖI, không lặng lẽ thành "nặng hoặc nhẹ"
      var fk = ascii(m.fake).replace(/\s+/g, " ");
      if (/^(nang hon|nang|heavy)$/.test(fk)) inp.fake = "heavy";
      else if (/^(nang hoac nhe|nang\/nhe|nang nhe|either|ca hai|khong biet)$/.test(fk)) inp.fake = "either";
      else return { err: "'xu giả' phải là 'nặng hơn' (biết trước) hoặc 'nặng hoặc nhẹ' — phiên bản chỉ biết 'nhẹ hơn' không có." };
    }
    if (m.ref !== undefined) { var r = yes(m.ref); if (r === null) return { err: "'xu chuẩn' phải là có/không." }; inp.ref = r; }
    if (m.dir !== undefined) { var di = yes(m.dir); if (di === null) return { err: "'nói nặng/nhẹ' phải là có/không." }; inp.dir = di; }
    if (m.mode !== undefined) { var md = ascii(m.mode); inp.mode = /doi thu|adv/.test(md) ? "adv" : /co dinh|fixed/.test(md) ? "fixed" : "?"; if (inp.mode === "?") return { err: "'chế độ' phải là 'cố định' hoặc 'đối thủ'." }; }
    if (m.secret !== undefined) {
      var mm = /^\s*(\d+)\s*(.*)$/.exec(ascii(m.secret));
      if (!mm) return { err: "'mã' phải dạng '7 nặng' hoặc '7 nhẹ'." };
      var hv = /^(nang|n|h|heavy|\+)$/.test(mm[2].trim()) ? 1 : /^(nhe|e|l|light|-)$/.test(mm[2].trim()) ? 0 : mm[2].trim() === "" ? 1 : null;
      if (hv === null) return { err: "'mã' phải dạng '7 nặng' hoặc '7 nhẹ'." };
      inp.secret = { coin: Number(mm[1]) - 1, heavy: hv };
    }
    return { inp: inp, errs: errs };
  }
  function toText(p) {
    var d = p.data;
    return ["xu: " + d.n, "lần cân: " + d.k, "xu giả: " + (d.fake === "heavy" ? "nặng hơn" : "nặng hoặc nhẹ"), "xu chuẩn: " + (d.ref ? "có" : "không"), "nói nặng/nhẹ: " + (d.dir ? "có" : "không"), "chế độ: " + (d.mode === "adv" ? "đối thủ" : "cố định")]
      .concat(d.secret ? ["mã: " + (d.secret.coin + 1) + " " + (d.secret.heavy ? "nặng" : "nhẹ")] : []).join("\n");
  }
  function fromText(text) {
    var r = parseText(text);
    if (r.err) return { ok: false, errors: [r.err], warnings: [] };
    return fromInput(r.inp);
  }
  function toFile(p) {
    var d = p.data, init = ["n=" + d.n, "k=" + d.k, "fake=" + d.fake, "ref=" + d.ref, "dir=" + d.dir, "mode=" + d.mode].concat(d.secret ? ["secret=" + (d.secret.coin + 1) + (d.secret.heavy ? "n" : "e")] : []).join(";");
    var sol = "";
    try { var recs = plan.read({ v: p.solution.v }, layoutOf(d)); sol = recs.map(function (rec) { var Ls = [], Rs = []; for (var i = 0; i < d.n + d.ref; i++) if (rec[i] === 1) Ls.push(i + 1); else if (rec[i] === 2) Rs.push(i + 1); return Ls.join(",") + "|" + Rs.join(",") + "=" + rec[d.n + d.ref]; }).join(";"); } catch (e) { sol = ""; }
    return { type: "coinbalance", seed: p.seed, difficulty: p.score, size: p.size, initialState: init, solution: sol, metadata: p.meta || {} };
  }
  function fromFile(o) {
    if (!o || typeof o !== "object" || typeof o.initialState !== "string") return { ok: false, errors: ["Thiếu initialState (dạng n=…;k=…;fake=…)."], warnings: [] };
    var m = {}; o.initialState.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) m[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    var inp = { n: Number(m.n), k: Number(m.k), fake: m.fake, ref: Number(m.ref), dir: Number(m.dir), mode: m.mode };
    if (m.secret) { var mm = /^(\d+)([ne])$/.exec(m.secret); if (!mm) return { ok: false, errors: ["secret phải dạng 7n hoặc 7e."], warnings: [] }; inp.secret = { coin: Number(mm[1]) - 1, heavy: mm[2] === "n" ? 1 : 0 }; }
    var r = fromInput(inp);
    if (r.ok && o.metadata && typeof o.metadata === "object" && typeof o.metadata.name === "string") r.puzzle.meta = { name: o.metadata.name.slice(0, 80) };
    return r;
  }

  // ================================================================================================= cây chiến lược, Constraint View, replay
  function strategyTree(d, maxNodes) {
    var nodes = [], goal = goalFor(d), id = 0, truncated = false;
    function add(parent, label, status) { if (nodes.length >= maxNodes) { truncated = true; return -1; } nodes.push({ id: id, parent: parent, label: label, status: status }); return id++; }
    function rec(s, r, parent, label) {
      var np = nposs(s.u, s.h, s.l), cd = s.u + s.h + s.l;
      if (cd === 0) return;
      if (goalOk(s.u, s.h, s.l, goal)) { add(parent, label + " → xong", "solution"); return; }
      var best = bestWeighing(s, r, goal);
      if (!best) { add(parent, label + " → không giải được", "dead"); return; }
      var nid = add(parent, label + " · cân " + (best.w.u1 + best.w.h1 + best.w.l1 + best.w.g1) + "⚖" + (best.w.u2 + best.w.h2 + best.w.l2 + best.w.g2), "ok");
      if (nid < 0) return;
      best.outs.forEach(function (o) { if (o.u + o.h + o.l > 0) rec(o, r - 1, nid, OUT_SHORT[o.code] + " · " + possText(nposs(o.u, o.h, o.l))); });
    }
    var s0 = startCounts(d), rid = add(-1, d.n + " xu · " + possText(goal ? d.n : nposs(s0.u, s0.h, s0.l)) + " · " + d.k + " lần", "ok");
    if (rid >= 0) { var b0 = bestWeighing(s0, d.k, goal); if (b0) { nodes[0].label += " · cân " + (b0.w.u1 + b0.w.h1 + b0.w.l1 + b0.w.g1) + "⚖" + (b0.w.u2 + b0.w.h2 + b0.w.l2 + b0.w.g2); b0.outs.forEach(function (o) { if (o.u + o.h + o.l > 0) rec(o, d.k - 1, rid, OUT_SHORT[o.code] + " · " + possText(nposs(o.u, o.h, o.l))); }); } }
    return { nodes: nodes, truncated: truncated };
  }

  var def = {
    id: "coinbalance", name: "Cân đồng xu", family: "Deduction Puzzle", category: "Suy diễn", icon: "⚖️",
    blurb: "Tìm xu giả bằng cân đĩa trong số lần cân cho trước — phải chứng minh được, không đoán may.",
    rules: [
      "Có n xu giống hệt nhau trừ MỘT xu giả (nặng hơn hoặc nhẹ hơn tuỳ phiên bản). Bạn chỉ có cân đĩa: đặt hai nhóm xu có số xu bằng nhau lên hai đĩa, cân cho biết đĩa nào nặng hơn hoặc cân bằng.",
      "Mỗi ván có số lần cân tối đa cố định. Hết lượt thì không cân được nữa — hãy kết luận.",
      "Kết luận (xu nào là giả, và nặng hay nhẹ nếu phiên bản đòi) chỉ được tính khi các lần cân đã CHỨNG MINH nó; đoán đúng nhờ may mắn không tính.",
      "Ở chế độ \"Đối thủ thích nghi\" không có xu giả định sẵn: mỗi lần cân, đối thủ chọn kết quả khó nhất mà vẫn nhất quán với các lần trước — chỉ chiến lược chắc chắn mới thắng.",
      "Hoàn tác được, nhưng điểm sao ghi nhận: 3★ nếu thắng bằng chiến lược chắc chắn, không hoàn tác, không dùng gợi ý mức 3; thắng mà có sai sót (lần cân mất an toàn — có thể là thắng nhờ may — hoặc một lần kết luận chưa được chứng minh) chỉ 1★."
    ],
    sizes: SIZES.map(function (z) { return { id: z.id, label: z.label, params: z.params, default: z.default || undefined, tiers: z.tiers }; }),
    algorithm: {
      title: "Quy hoạch động minimax trên lớp xu",
      steps: [
        { title: "Phân lớp xu", text: "Sau mỗi lần cân, mỗi xu thuộc một lớp: U (có thể nặng hoặc nhẹ), H (chỉ có thể nặng), L (chỉ có thể nhẹ), G (chắc chắn thật). Chỉ cần ĐẾM (u, h, l, g) — các xu cùng lớp thay thế được cho nhau." },
        { title: "Ba kết quả, ba nhánh", text: "Cân T trái / P phải: lệch trái → xu giả là U,H bên trái (nặng) hoặc U,L bên phải (nhẹ); cân bằng → xu giả nằm ngoài đĩa. Mỗi khả năng (xu × hướng) rơi vào đúng một nhánh." },
        { title: "Cận thông tin chỉ là điều kiện cần", text: "Với r lần cân còn lại, mỗi nhánh phải còn ≤ 3^(r−1) khả năng. Nhưng 13 xu / 3 lần (26 ≤ 27 khả năng) vẫn KHÔNG giải được vì thiếu xu thật làm mốc — nên cần quy hoạch động thật." },
        { title: "DP minimax", text: "solv(u,h,l,g,r) = tồn tại phép cân mà cả ba nhánh solv(…, r−1) đều đúng; nhớ đệm theo (u,h,l,min(g,u+h+l),r). Giới hạn xu: 3^k (biết nặng), (3^k−3)/2 (nặng/nhẹ phải nói hướng), (3^k−1)/2 (có xu chuẩn hoặc chỉ tìm xu)." },
        { title: "Đối thủ & gợi ý", text: "Đối thủ chọn kết quả làm ván con khó nhất theo DP (cần nhiều lần cân nhất). Gợi ý chọn phép cân an toàn có nhánh lớn nhất nhỏ nhất, và nói vì sao các phép cân gần đó hỏng." }
      ],
      links: [{ id: "ternary-search", label: "Tìm kiếm tam phân" }, { id: "backtracking", label: "Quay lui" }, { id: "branch-and-bound", label: "Nhánh cận" }]
    },
    difficultyNote: "Điểm 0–10 theo sức ép (số khả năng so với 3^k), độ HẸP của phép cân đầu (tỉ lệ phép cân đầu còn an toàn — 12 xu / 3 lần chỉ 1 trong 6 lớp phép cân an toàn), loại xu (nặng-hoặc-nhẹ khó hơn biết-nặng; xu chuẩn dễ hơn) và chế độ đối thủ (cộng điểm).",
    kind: "interactive", objective: { sense: "min", label: "Số lần cân", unit: "lần" },
    sizeLabel: "Phiên bản",
    moveLabel: "Số thao tác (cân, kết luận, mở lại — hoàn tác không làm giảm)",                    // chip HUD = game.counters.moves = số lần gọi act; KHÔNG phải số lần cân trong state (bàn đã có dòng "Còn r / k lần cân")
    mistakeLabel: "Sai sót (lần cân mất an toàn hoặc kết luận chưa chứng minh)",                  // mistakes() cộng cả hai thứ
    sizeText: function (p) { var d = p && p.data; return d && isInt(d.n, 2, MAX_N) && isInt(d.k, 1, MAX_K) ? d.n + " xu" + (d.ref ? " + chuẩn" : "") + " · " + d.k + " lần cân" : ""; },    // nhãn kích cỡ cho đề tự nhập (vỏ: "12×3" không tự giải thích)
    options: [{ id: "mode", label: "Chế độ", choices: [
      { id: "fixed", label: "Xu giả cố định", note: "Xu giả được chọn sẵn theo seed — hoàn tác cho phép 'thử rồi lùi', nhưng điểm sao ghi nhận." },
      { id: "adv", label: "Đối thủ thích nghi", note: "Không có xu giả định sẵn: mỗi lần cân đối thủ chọn kết quả khó nhất — chỉ chiến lược chắc chắn mới thắng." }], default: "fixed" }],

    generate: function (seed, o) {
      o = o || {};
      var sz = P.types.sizeOf(def, o.sizeId), prm = sz.params, full = P.types.optionsOf(def, o.options), mode = full.mode, tier = P.util.tier(o.tier) ? o.tier : "easy";
      var r0 = P.rng.create(seed).fork("cb"), band = P.util.tier(tier), cands = [], n;
      for (n = prm.nMin; n <= prm.nMax; n++) {
        var sc = scoreOf({ n: n, k: prm.k, fake: prm.fake, ref: prm.ref, dir: prm.dir, mode: mode });
        if (sc >= band.min && sc < band.max) cands.push(n);
      }
      if (!cands.length) { var tgt = band.target, bestN = prm.nMin, bd = 99; for (n = prm.nMin; n <= prm.nMax; n++) { var dd = Math.abs(scoreOf({ n: n, k: prm.k, fake: prm.fake, ref: prm.ref, dir: prm.dir, mode: mode }) - tgt); if (dd < bd) { bd = dd; bestN = n; } } cands = [bestN]; }
      n = cands[r0.fork("n").int(cands.length)];
      var sr = r0.fork("secret"), secret = null;
      if (mode === "fixed") secret = { coin: sr.int(n), heavy: prm.fake === "heavy" ? 1 : sr.int(2) };
      var d = { n: n, k: prm.k, fake: prm.fake, ref: prm.ref, dir: prm.dir, mode: mode, secret: secret };
      var p = buildPuzzle(seed, sz.id, sz.params, d, tier, mode);
      p.options = P.types.compactOptions(def, full);
      return p;
    },
    fromInput: fromInput,
    validate: function (p) {
      if (!p || !dataOk(p.data)) return { ok: false, errors: ["Đề thiếu dữ liệu."], status: "none", count: 0, solution: null };
      var r = fromInputAt(inputOf(p.data), p.seed == null ? null : p.seed);
      return { ok: r.ok, errors: r.errors, status: r.status, count: r.count, solution: r.ok ? r.puzzle.solution : null };
    },
    solve: function (p) {
      var d = p.data, play = playOptimal(p), k = bestK(d);
      if (!play) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0 };
      return { status: "unique", count: 1, solution: { v: play.state.v }, steps: play.steps.map(function (st) { return { technique: st.action.k === "weigh" ? "Chia ba nhánh" : "Kết luận", text: st.text }; }),
        techniques: { "Chia ba nhánh": play.steps.length - 1, "Kết luận": 1 }, nodes: memo.size, best: k };
    },
    difficulty: function (p) { return scoreOf(p.data); },
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    isGiven: function (p, i) { return p.data.ref === 1 && i === p.data.n; },
    moveFor: moveFor, check: check, mistakes: mistakes, grade: grade, hint: hint,
    replay: function (p) {
      var play = playOptimal(p);
      return play ? play.steps.map(function (st) { return { text: st.text, why: st.why, diff: { d: st.diff.d }, cells: st.cells, technique: st.action.k === "weigh" ? "Chia ba nhánh" : "Kết luận" }; }) : [];
    },
    constraintView: function (p) {
      var d = p.data, goal = goalFor(d), s0 = startCounts(d), np = nposs(s0.u, s0.h, s0.l), t = POW3[d.k], k = bestK(d);
      var vars = [{ name: "xu giả", domain: "{1…" + d.n + "}" }];
      if (d.fake === "either") vars.push({ name: "hướng (nặng / nhẹ)", domain: "{nặng, nhẹ}" });
      vars.push({ name: "kết quả mỗi lần cân (×" + d.k + ")", domain: "{trái nặng, cân bằng, phải nặng}", count: d.k });
      var cons = ["đúng một xu giả trong " + d.n + " xu" + (d.ref ? " (xu chuẩn n+1 chắc chắn thật)" : ""), "mỗi lần cân: |trái| = |phải| ≥ 1, hai đĩa rời nhau",
        "kết quả = dấu(khối lượng trái − khối lượng phải): xu giả ở đĩa nào, nặng hay nhẹ quyết định", "tối đa " + d.k + " lần cân"];
      var secs = [{ title: "Thông tin so với số lần cân", note: "Mỗi lần cân cho một trong 3 kết quả, nên k lần phân biệt được tối đa 3^k = " + t + " trường hợp.",
        items: [(goal ? d.n + " xu cần chỉ ra" : np + " khả năng (xu × hướng)") + " so với " + t + " kết quả của " + d.k + " lần cân.",
          k <= d.k ? "Có chiến lược chắc chắn trong " + k + " lần cân (DP minimax)." : "KHÔNG có chiến lược chắc chắn trong " + d.k + " lần cân.",
          "Cận thông tin chỉ là điều kiện cần: 13 xu 3 lần (26 ≤ 27) vẫn không giải được khi thiếu xu thật làm mốc."] }];
      var sec2 = d.mode === "adv" ? "Chế độ đối thủ: không có xu giả định sẵn; mỗi lần cân đối thủ chọn nhánh cần nhiều lần cân nhất để giải." : "Chế độ cố định: xu giả được chọn từ seed (có trong tệp JSON của đề).";
      secs.push({ title: "Chế độ", items: [sec2] });
      return { summary: d.n + " xu, " + d.k + " lần cân, " + (d.fake === "heavy" ? "biết giả nặng hơn" : d.dir ? "nặng hoặc nhẹ, phải nói hướng" : "nặng hoặc nhẹ, chỉ cần chỉ ra xu") + (d.ref ? ", có xu chuẩn" : ""), variables: vars, constraints: cons, counts: { variables: vars.length, constraints: cons.length, "khả năng": goal ? d.n : np, "kết quả tối đa": t }, sections: secs };
    },
    trace: function (p, opts) {
      var mx = opts && opts.maxNodes ? Math.min(600, opts.maxNodes) : 600, tr = strategyTree(p.data, mx);
      return { kind: "tree", nodes: tr.nodes, truncated: tr.truncated, note: "Cây chiến lược tối ưu theo lớp xu (không phụ thuộc xu giả nào): mỗi nút là một kết quả cân và phép cân kế tiếp; nút xanh đậm = đã đủ để kết luận." };
    },
    toText: toText, fromText: fromText, toFile: toFile, fromFile: fromFile,
    describeCell: function (p, s, i) {
      var d = p.data, C = d.n + d.ref;
      if (d.ref && i === d.n) return "Xu chuẩn, chắc chắn thật";
      if (!isInt(i, 0, C - 1)) return "Xu không hợp lệ";
      var recs = plan.read(s, layoutOf(d)), where = recs.map(function (r) { return r[i] === 1 ? "trái" : r[i] === 2 ? "phải" : "ngoài"; });
      return "Xu " + (i + 1) + (recs.length ? ", đã cân " + recs.length + " lần (" + where.join(", ") + ")" : ", chưa cân lần nào");
    }
  };

  /** Hàm thuần cho bàn chơi và test (không thuộc hợp đồng chung). */
  def.lib = {
    CG: CG, CU: CU, CH: CH, CL: CL, POW3: POW3, MAX_N: MAX_N, MAX_K: MAX_K,
    solv: solv, need: need, nposs: nposs, goalFor: goalFor, bestK: bestK, startCounts: startCounts, outcomesOf: outcomesOf, enumAll: enumAll, safeWeighings: safeWeighings, bestWeighing: bestWeighing,
    classesOf: classesOf, countsOf: countsOf, weighingOf: weighingOf, coinsFor: coinsFor, layoutOf: layoutOf, budget: budget, concluded: concluded, playOptimal: playOptimal, lostAt: lostAt,
    fixedResult: fixedResult, advResult: advResult, panArray: panArray, strategyTree: strategyTree, scoreOf: scoreOf, setText: setText, ranges: ranges, whyUnsafe: whyUnsafe, noStrategyText: noStrategyText,
    maxN: maxN, OUT_NAME: OUT_NAME, OUT_SHORT: OUT_SHORT, SIZES: SIZES, memoSize: function () { return memo.size; }, resetMemo: function () { memo.clear(); memoSize = 0; },
    records: function (p, s) { var d = p.data, C = d.n + d.ref; return plan.read(s, layoutOf(p.data)).map(function (rec) { var Ls = [], Rs = []; for (var i = 0; i < C; i++) if (rec[i] === 1) Ls.push(i); else if (rec[i] === 2) Rs.push(i); return { L: Ls, R: Rs, result: rec[C] }; }); }
  };

  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
