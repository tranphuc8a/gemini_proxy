/* puzzles/coinscale.js — CÂN ĐIỆN TỬ (CW3): cân cho SỐ GAM (không phải so hai đĩa). Hai phiên bản (sizes, nhãn "Phiên bản"). Loại 'interactive' (HUONG-DAN-ENGINE.md mục 11).

   · chong  — "Chồng xu": n chồng, mỗi chồng c xu; MỘT chồng toàn xu giả, nặng hơn xu thật đúng 1 g (xu thật 10 g). Mỗi lần cân bạn lấy t_i xu (0…c) từ chồng i, cân đọc ra tổng gam
              ⇒ phần DƯ so với "toàn xu thật" = số xu giả đã lấy = t[chồng giả] ∈ {0…c}: mỗi lần cân chỉ có c+1 kết quả. Phải chứng minh được chồng giả trong k lần.
   · hailoai — "Xu hai loại": n xu (n ≤ 6), mỗi xu NHẸ (9 g) hoặc NẶNG (10 g) chưa biết; cân một nhóm bất kỳ cho tổng gam = 9·|nhóm| + (số xu nặng trong nhóm). Phải xác định ĐÚNG từng xu (nặng hay nhẹ)
              trong k = A(n) lần cân, A = 1, 2, 3, 3, 4, 4 (n = 1…6; chiến lược THÍCH NGHI). Chế độ KẾ HOẠCH (không thích nghi, m(n)) và nhiều chồng giả (chongN) HOÃN (ke-hoach §6 Q8) — xem 'lệch thiết kế' ở dot/P6b.md.
   Tuỳ chọn (options): 'mode' = fixed (bí mật cố định theo seed — mặc định) | adv (ĐỐI THỦ thích nghi: không có bí mật định sẵn, mỗi lần cân đối thủ chọn kết quả khó nhất mà vẫn nhất quán).

   ── Lõi toán ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Trạng thái hiểu biết = TẬP ỨNG VIÊN T (các khả năng còn nhất quán với mọi lần cân đã ghi). solv(T, r) = có chiến lược chắc chắn xác định ra khả năng đúng trong r lần cân không.
   · chong: T = tập chỉ số chồng. Lần cân cho c+1 kết quả (số xu giả đã lấy) nên solv(T, r) ⇔ |T| ≤ (c+1)^r (≥ 2: cận đếm; đủ: gán mỗi chồng một chữ số cơ số c+1 — cách chia theo khối ⌊hạng/B⌋, B = (c+1)^(r−1)).
              k* = ⌈log_{c+1} n⌉. Phép cân AN TOÀN ⇔ mọi nhóm kết quả còn ≤ (c+1)^(r−1) chồng.
   · hailoai: T = tập vectơ x ∈ {0,1}^n (bit i = xu i nặng) — tối đa 64. Cân nhóm S cho đọc |x ∩ S| nên chia T thành các lớp theo số xu nặng trong S. solv = QUY HOẠCH ĐỘNG minimax nhớ đệm theo bitset T (kiểm bằng vét cạn độc lập
              trong kiem/coinscale.js). Cận đếm (n+1)^r chỉ để cắt nhánh. n = 7 (chứng minh "4 lần không đủ" ≈ 14 s) vượt ngân sách luồng chính ⇒ giới hạn n ≤ 6.

   ── Trạng thái (Puz.plan, mục 11.2) ───────────────────────────────────────────────────────────────────────────────────────────
   Bản ghi một lần cân (W = n + 1 số): [lấy t_0 … t_{n−1} (chong) | 1 nếu xu i trên cân (hailoai), kết quả] với kết quả = số xu giả đã lấy (chong) / số xu nặng trong nhóm (hailoai) — KHÔNG phải số gam
   (gam = suy ra: chong Σ10·t_i + kết quả; hailoai 9·|nhóm| + kết quả). Kết luận = nộp kèm tham số: chong [chồng + 1]; hailoai [n số: 1 nhẹ · 2 nặng]. Oracle TẤT ĐỊNH và kết quả ghi VÀO diff:
   cố định = bí mật 'data.secret' (chỉ số chồng / bitmask xu nặng); đối thủ = hàm thuần của lịch sử (chọn lớp kết quả khó nhất theo DP, phá hoà bằng Puz.rng từ băm (đề, lịch sử, phép cân)).
   Ngân sách k CỨNG; hoàn tác được nhưng grade ghi nhận.

   Action: {k:"weigh", take:[t_0…t_{n−1}]} (chong) · {k:"weigh", set:[chỉ số xu…]} (hailoai) · {k:"conclude", stack} (chong) / {k:"conclude", x:[0|1 …n]} (hailoai, 1 = nặng) · {k:"truncate", n}.
   solved = đã kết luận VÀ kết luận bị lịch sử ÉP BUỘC (T chỉ còn đúng khả năng đó). mistakes = lần cân làm mất khả năng thắng chắc hoặc kết luận chưa chứng minh. */
(function (root) {
  "use strict";
  var P = root.Puz;
  var plan = P.plan, G = P.grade;

  var MAX_S = 40, MAX_C = 9, MAX_KS = 4;                               // chong: số chồng, xu mỗi chồng, số lần cân tối đa
  var MAX_N2 = 6, MAX_K2 = 6;                                          // hailoai: số xu, số lần cân tối đa
  var W_REAL = 10, W_LIGHT = 9;                                        // gam: xu thật (chong) / xu nhẹ (hailoai); xu giả & xu nặng = +1 g
  var POP = [];
  (function () { for (var i = 0; i < 64; i++) { var c = 0, x = i; while (x) { c += x & 1; x >>= 1; } POP.push(c); } })();

  function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function copyState(s) { return { v: s.v.slice(), c: null }; }
  function after(s, diff) { var t = copyState(s); P.game.applyDiff(t, diff.d, false); return t; }
  function J(x) { return JSON.stringify(x); }
  function powCap(b, e) { var r = 1; for (var i = 0; i < e; i++) { r *= b; if (r > 1e9) return 1e9; } return r; }
  function viNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function ranges(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; }), out = [], i = 0;
    while (i < a.length) { var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; if (j - i >= 2) out.push((a[i] + 1) + "–" + (a[j] + 1)); else for (var k = i; k <= j; k++) out.push(String(a[k] + 1)); i = j + 1; }
    return out.join(", ");
  }
  function setText(arr) { return "{" + ranges(arr) + "}"; }
  function isStack(d) { return d.form === "stack"; }

  // ================================================================================================= DỮ LIỆU ĐỀ, LAYOUT
  function dataOk(d) {
    if (!d || typeof d !== "object" || (d.mode !== "fixed" && d.mode !== "adv")) return false;
    if (d.form === "stack") return isInt(d.n, 2, MAX_S) && isInt(d.c, 1, MAX_C) && isInt(d.k, 1, MAX_KS) && (d.secret === null || isInt(d.secret, 0, d.n - 1));
    if (d.form === "two") return isInt(d.n, 2, MAX_N2) && isInt(d.k, 1, MAX_K2) && (d.secret === null || isInt(d.secret, 0, (1 << d.n) - 1));
    return false;
  }
  function layoutOf(d) { return plan.layout(d.k, d.n + 1, isStack(d) ? 1 : d.n); }
  function fixData(d) { return isStack(d) ? { form: "stack", n: d.n, c: d.c, k: d.k, mode: d.mode, secret: d.secret == null ? null : d.secret } : { form: "two", n: d.n, k: d.k, mode: d.mode, secret: d.secret == null ? null : d.secret }; }
  function budget(d, s) { return d.k - plan.count(s); }
  function fullSet(d) { var T = [], m = isStack(d) ? d.n : (1 << d.n), i; for (i = 0; i < m; i++) T.push(i); return T; }
  function maskOfRec(d, rec) { var m = 0; for (var i = 0; i < d.n; i++) if (rec[i] === 1) m |= 1 << i; return m; }
  function setOfMask(n, m) { var o = []; for (var i = 0; i < n; i++) if (m & (1 << i)) o.push(i); return o; }

  // ---- phép cân w: chong = mảng take; hailoai = bitmask nhóm xu
  function wFromRec(d, rec) { return isStack(d) ? rec.slice(0, d.n) : maskOfRec(d, rec); }
  function recOf(d, w, res) {
    if (isStack(d)) return w.concat([res]);
    var a = zeros(d.n); for (var i = 0; i < d.n; i++) if (w & (1 << i)) a[i] = 1;
    return a.concat([res]);
  }
  function actionOf(d, w) { return isStack(d) ? { k: "weigh", take: w.slice() } : { k: "weigh", set: setOfMask(d.n, w) }; }
  function wFromAction(d, a) {
    var i;
    if (isStack(d)) {
      if (!Array.isArray(a.take) || a.take.length !== d.n) return null;
      var sum = 0;
      for (i = 0; i < d.n; i++) { if (!isInt(a.take[i], 0, d.c)) return null; sum += a.take[i]; }
      return sum > 0 ? a.take.slice() : null;
    }
    if (!Array.isArray(a.set) || !a.set.length) return null;
    var m = 0;
    for (i = 0; i < a.set.length; i++) { if (!isInt(a.set[i], 0, d.n - 1) || (m & (1 << a.set[i]))) return null; m |= 1 << a.set[i]; }
    return m;
  }
  /** Số gam cân đọc ra cho bản ghi rec. */
  function gramsOf(d, rec) {
    var i, s = 0;
    if (isStack(d)) { for (i = 0; i < d.n; i++) s += rec[i] * W_REAL; return s + rec[d.n]; }
    for (i = 0; i < d.n; i++) s += rec[i];
    return s * W_LIGHT + rec[d.n];
  }
  function gramsText(g) { return viNum(g) + " g"; }
  /** Số gam của "mọi xu đều là loại nhẹ/thật" đối với phép cân w (mức nền để người chơi trừ ra). */
  function baseOf(d, w) {
    var i, s = 0;
    if (isStack(d)) { for (i = 0; i < d.n; i++) s += w[i]; return s * W_REAL; }
    return POP[w] * W_LIGHT;
  }

  // ================================================================================================= TẬP ỨNG VIÊN + CHIA LỚP
  function candOf(d, s) {
    var recs = plan.read(s, layoutOf(d)), T = fullSet(d);
    recs.forEach(function (rec) {
      var res = rec[d.n];
      if (isStack(d)) T = T.filter(function (i) { return rec[i] === res; });
      else { var m = maskOfRec(d, rec); T = T.filter(function (x) { return POP[x & m] === res; }); }
    });
    return T;
  }
  /** Chia tập ứng viên T theo kết quả của phép cân w: [{res, T}] theo kết quả tăng dần (chỉ lớp khác rỗng). */
  function partsOf(d, T, w) {
    var by = {}, keys = [];
    T.forEach(function (x) {
      var res = isStack(d) ? w[x] : POP[x & w];
      if (!by[res]) { by[res] = []; keys.push(res); }
      by[res].push(x);
    });
    keys.sort(function (a, b) { return a - b; });
    return keys.map(function (k) { return { res: k, T: by[k] }; });
  }

  // ================================================================================================= solv (DP minimax)
  var memo2 = new Map(), memoSize = 0;
  function keyOf(n, T) {
    var lo = 0, hi = 0;
    for (var i = 0; i < T.length; i++) { var x = T[i]; if (x < 32) lo |= (1 << x); else hi |= (1 << (x - 32)); }
    return n + "_" + (lo >>> 0) + "_" + (hi >>> 0);
  }
  function splitTwo(n, T, S) {                                         // các lớp (≥ 2) của T theo |x ∩ S|; null nếu S không tách được gì
    var b = [], i, c = 0, out = [];
    for (i = 0; i <= n; i++) b.push(null);
    for (i = 0; i < T.length; i++) { var q = POP[T[i] & S]; if (!b[q]) { b[q] = []; c++; } b[q].push(T[i]); }
    if (c < 2) return null;
    for (i = 0; i <= n; i++) if (b[i]) out.push({ res: i, T: b[i] });
    return out;
  }
  function solvTwo(n, T, r) {
    var m = T.length;
    if (m <= 1) return true;
    if (r <= 0) return false;
    var key = keyOf(n, T), e = memo2.get(key);
    if (e) { if (r >= e[0]) return true; if (r <= e[1]) return false; }
    else { if (memoSize > 300000) { memo2.clear(); memoSize = 0; } e = [99, -1]; memo2.set(key, e); memoSize++; }
    var res = false;
    if (m <= powCap(n + 1, r)) {
      var full = (1 << n) - 1, B = powCap(n + 1, r - 1);
      for (var S = 1; S <= full && !res; S++) {
        var parts = splitTwo(n, T, S);
        if (!parts) continue;
        var ok = true, i;
        parts.sort(function (a, b) { return b.T.length - a.T.length; });
        for (i = 0; i < parts.length && ok; i++) if (parts[i].T.length > B || !solvTwo(n, parts[i].T, r - 1)) ok = false;
        if (ok) res = true;
      }
    }
    if (res) { if (r < e[0]) e[0] = r; } else if (r > e[1]) e[1] = r;
    return res;
  }
  function solvC(d, T, r) { return isStack(d) ? (T.length <= 1 || (r > 0 && T.length <= powCap(d.c + 1, r))) : solvTwo(d.n, T, r); }
  /** Số lần cân ít nhất (≤ cap) để giải chắc chắn; cap + 1 nếu cần nhiều hơn. */
  function needC(d, T, cap) { for (var r = 0; r <= cap; r++) if (solvC(d, T, r)) return r; return cap + 1; }
  function bestK(d) { return needC(d, fullSet(d), d.k); }
  function lexLess(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; }

  /** Mọi phép cân AN TOÀN của T với r lần còn lại (kể cả lần này): cả các lớp kết quả đều còn giải được trong r−1 lần, và tách được T. [{w, parts}]. */
  function safeWeighings(d, T, r) {
    var out = [], S, parts, ok, i;
    if (isStack(d)) {
      var b = best1Stack(d, T, r);
      return b ? [b] : out;
    }
    for (S = 1; S < (1 << d.n); S++) {
      parts = splitTwo(d.n, T, S);
      if (!parts) continue;
      ok = true;
      for (i = 0; i < parts.length && ok; i++) if (!solvTwo(d.n, parts[i].T, r - 1)) ok = false;
      if (ok) out.push({ w: S, parts: parts });
    }
    return out;
  }
  /** chong: phép cân chính tắc — chia các chồng nghi theo KHỐI: hạng j trong T lấy ⌊j / B⌋ xu, B = (c+1)^(rn−1), rn = số lần cân tối thiểu (≥ 1). Chồng đã loại không lấy xu nào. */
  function best1Stack(d, T, r) {
    var rn = needC(d, T, r);
    if (T.length < 2 || rn < 1 || rn > r) return null;
    var B = powCap(d.c + 1, rn - 1), w = zeros(d.n);
    T.forEach(function (x, j) { w[x] = Math.floor(j / B); });
    return { w: w, parts: partsOf(d, T, w), B: B };
  }
  /** Phép cân tốt nhất: an toàn, lớp lớn nhất NHỎ nhất; hoà → tổng bình phương nhỏ nhất; hoà → ít xu hơn; hoà → bitmask nhỏ nhất. null nếu không có. */
  function bestWeighing(d, T, r) {
    if (isStack(d)) return best1Stack(d, T, r);
    var list = safeWeighings(d, T, r), best = null, bk = null;
    list.forEach(function (x) {
      var ps = x.parts.map(function (q) { return q.T.length; }), ss = 0;
      ps.forEach(function (v) { ss += v * v; });
      var k = [Math.max.apply(null, ps), ss, POP[x.w], x.w];
      if (!bk || lexLess(k, bk)) { best = x; bk = k; }
    });
    return best;
  }

  // ================================================================================================= ORACLE
  function fixedResult(d, w) { return isStack(d) ? w[d.secret] : POP[d.secret & w]; }
  /** Đối thủ: trong các lớp kết quả còn nhất quán chọn lớp KHÓ nhất — cần nhiều lần cân nhất (cap + 1 = không giải được trong lượt còn lại), hoà → nhiều khả năng hơn, hoà → Puz.rng từ băm. */
  function advResult(p, s, w) {
    var d = p.data, T = candOf(d, s), parts = partsOf(d, T, w), cap = Math.max(0, budget(d, s) - 1);
    if (!parts.length) return 0;                                        // state hỏng (sửa tay): không còn khả năng — trả 0 thay vì ném lỗi
    parts.forEach(function (q) { q.need = needC(d, q.T, cap); q.np = q.T.length; });
    var top = parts[0];
    parts.forEach(function (q) { if (q.need > top.need || (q.need === top.need && q.np > top.np)) top = q; });
    var ties = parts.filter(function (q) { return q.need === top.need && q.np === top.np; });
    if (ties.length === 1) return ties[0].res;
    var hist = plan.read(s, layoutOf(d)).map(function (r) { return r.join(","); }).join(";");
    var r0 = P.rng.create(P.rng.hash32(J([d, p.seed == null ? 0 : p.seed]) + "|" + hist + "|" + J(w)));
    return ties[r0.int(ties.length)].res;
  }
  function oracle(p, s, w) { return p.data.mode === "adv" || p.data.secret == null ? advResult(p, s, w) : fixedResult(p.data, w); }

  // ================================================================================================= CHỮ HIỂN THỊ
  function possText(d, n) { return n + (isStack(d) ? " chồng còn nghi" : " khả năng"); }
  function readName(d, res, w) {
    if (isStack(d)) return "dư " + res + " g (lấy " + res + " xu giả)";
    return gramsText(POP[w] * W_LIGHT + res) + " (" + res + " xu nặng)";
  }
  function candName(d, x) {                                            // chong: "chồng 3"; hailoai: vectơ "xu 1, 3 nặng"
    if (isStack(d)) return "chồng " + (x + 1);
    var h = setOfMask(d.n, x);
    return h.length ? "xu " + setText(h) + " nặng" : "mọi xu nhẹ";
  }
  /** hailoai: những gì đã chắc từ tập T ("xu 1, 2 chắc chắn nặng; xu 3 chắc nhẹ; chưa rõ: xu 4"). */
  function knownText(d, T) {
    var all1 = (1 << d.n) - 1, all0 = all1, i;
    T.forEach(function (x) { all1 &= x; all0 &= ~x; });
    var hv = [], lt = [], un = [];
    for (i = 0; i < d.n; i++) { if (all1 & (1 << i)) hv.push(i); else if (all0 & (1 << i)) lt.push(i); else un.push(i); }
    var out = [];
    if (hv.length) out.push("xu " + setText(hv) + " chắc nặng");
    if (lt.length) out.push("xu " + setText(lt) + " chắc nhẹ");
    if (un.length) out.push("chưa rõ xu " + setText(un));
    return out.join("; ");
  }
  function partLine(d, q, w, r, B) {
    var np = q.T.length, head = "Nếu " + readName(d, q.res, w) + ": ";
    if (isStack(d)) return head + "chồng " + setText(q.T) + " — " + np + " chồng" + (np <= B ? " ≤ " + B : "") + (np === 1 ? "; đã đủ để kết luận." : "; còn " + (r - 1) + " lần cân.");
    return head + np + " khả năng — " + knownText(d, q.T) + (np === 1 ? "; đã đủ để kết luận." : "; còn " + (r - 1) + " lần cân.");
  }
  function wText(d, w) { return isStack(d) ? "lấy " + w.map(function (t, i) { return t > 0 ? t + " xu từ chồng " + (i + 1) : ""; }).filter(Boolean).join(", ") : "cân nhóm " + setText(setOfMask(d.n, w)) + " (" + POP[w] + " xu)"; }
  function wShort(d, w) { return isStack(d) ? "{" + w.map(function (t, i) { return t > 0 ? (i + 1) + "×" + t : ""; }).filter(Boolean).join(", ") + "}" : setText(setOfMask(d.n, w)); }

  // ================================================================================================= GIẢI THÍCH PHÉP CÂN
  /** Vì sao phép cân w (hailoai) từ T với r lần còn lại KHÔNG an toàn; null nếu thực ra an toàn. */
  function whyUnsafeTwo(d, T, r, S) {
    var parts = splitTwo(d.n, T, S);
    if (!parts) return "nhóm này không tách được khả năng nào (mọi khả năng cho cùng một số đọc) — lãng phí một lần cân";
    var worst = null, nd = 0, i;
    for (i = 0; i < parts.length; i++) if (!solvTwo(d.n, parts[i].T, r - 1)) { var nn = needC(d, parts[i].T, 8); if (!worst || nn > nd || (nn === nd && parts[i].T.length > worst.T.length)) { worst = parts[i]; nd = nn; } }
    if (!worst) return null;
    return "nếu đọc " + gramsText(POP[S] * W_LIGHT + worst.res) + " (" + worst.res + " xu nặng) thì còn " + worst.T.length + " khả năng (" + knownText(d, worst.T) + "), nhưng không có cách cân nào chắc chắn tách hết trong " + (r - 1) + " lần" + (nd <= 8 ? " — cần ít nhất " + nd + " lần" : "");
  }
  /** Các phép cân "gần" S (đổi một xu vào/ra nhóm) mà KHÔNG an toàn, tối đa lim — để so sánh trong lời giải thích. */
  function neighbours(d, T, r, S, lim) {
    var out = [], i;
    for (i = 0; i < d.n && out.length < lim; i++) {
      var S2 = S ^ (1 << i);
      if (S2 === 0 || S2 >= (1 << d.n)) continue;
      var why = whyUnsafeTwo(d, T, r, S2);
      if (why) out.push({ S: S2, kind: (S & (1 << i)) ? "bớt xu " + (i + 1) : "thêm xu " + (i + 1), why: why });
    }
    return out;
  }
  function explainWeighing(d, T, w, r, best) {
    var lines = [], parts = best ? best.parts : partsOf(d, T, w);
    if (isStack(d)) {
      var B = powCap(d.c + 1, r - 1), m = T.length;
      lines.push("Còn " + m + " chồng nghi và " + r + " lần cân. Cân đọc tổng gam nên phần dư so với \"toàn xu thật\" chính là SỐ xu giả đã lấy — chỉ có " + (d.c + 1) + " kết quả (0…" + d.c + "). Sau lần này mỗi kết quả phải còn ≤ (" + (d.c + 1) + ")^" + (r - 1) + " = " + B + " chồng.");
      parts.forEach(function (q) { lines.push(partLine(d, q, w, r, B)); });
      if (r >= 1 && B + 1 <= m) lines.push("Vì sao không dồn " + (B + 1) + " chồng vào cùng một kết quả: nếu rơi đúng kết quả đó thì còn " + (B + 1) + " chồng mà " + (r - 1) + " lần cân còn lại chỉ phân biệt được tối đa " + B + " chồng.");
      return lines;
    }
    lines.push("Còn " + T.length + " khả năng (mỗi xu 9 g hoặc 10 g) và " + r + " lần cân. Cân nhóm " + setText(setOfMask(d.n, w)) + " (" + POP[w] + " xu): số đọc = " + W_LIGHT + "×" + POP[w] + " + (số xu nặng trong nhóm) — chỉ cho biết CÓ BAO NHIÊU xu nặng, không biết xu nào.");
    parts.forEach(function (q) { lines.push(partLine(d, q, w, r, 0)); });
    var alts = neighbours(d, T, r, w, 2);
    alts.forEach(function (a) { lines.push("Vì sao không " + a.kind + " (" + setText(setOfMask(d.n, a.S)) + "): " + a.why + "."); });
    return lines;
  }

  // ================================================================================================= PHIÊN BẢN, ĐỀ, ĐỘ KHÓ
  var SIZES = [
    { id: "chong", label: "Chồng xu · tìm chồng giả", params: { form: "stack" }, default: true, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "hailoai", label: "Xu hai loại 9 g / 10 g", params: { form: "two" }, tiers: ["easy", "medium", "hard", "expert"] }
  ];
  var scoreMemo = {};
  /** Điểm 0–10 (số nguyên /10 nên bậc đúng tuyệt đối).
      chong: 0,3 + 1,6·(k−1) + 3·n/(c+1)^k (+0,5 đối thủ) — k = số lần cân tối thiểu, n/(c+1)^k = độ KHÍT của cận đếm (1 = khít).
      hailoai: 1,0 + 1,4·(n−1) (+0,5 đối thủ) — số khả năng 2^n gấp đôi mỗi xu mà số lần cân tối thiểu chỉ tăng ~ 2n/log2 n. Hiệu chỉnh bằng đo (kiem/coinscale.js: mỗi bậc đủ ứng viên ở cả hai chế độ). */
  function scoreOf(d) {
    var key = J(fixData(d)), adv = d.mode === "adv" ? 0.5 : 0;
    if (scoreMemo[key] !== undefined) return scoreMemo[key];
    var sc = isStack(d) ? 0.3 + 1.6 * (bestK(d) - 1) + 3 * d.n / powCap(d.c + 1, bestK(d)) + adv : 1.0 + 1.4 * (d.n - 1) + adv;
    sc = P.util.clampScore(sc);
    scoreMemo[key] = sc;
    return sc;
  }
  /** Số chồng tối đa chắc chắn tìm được với c xu mỗi chồng trong k lần cân = (c+1)^k (chặn MAX_S để hiển thị). */
  function maxStacks(c, k) { return powCap(c + 1, k); }

  function buildPuzzle(seed, sizeId, d, tier) {
    var L = layoutOf(d), p = { v: 1, type: "coinscale", seed: seed, sizeId: sizeId, size: isStack(d) ? { n: d.n, c: d.c, k: d.k } : { n: d.n, k: d.k }, tier: tier, score: 0, data: fixData(d), initial: { v: plan.empty(L) }, solution: null, meta: {} };
    p.score = scoreOf(p.data);
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    var play = playOptimal(p);
    p.solution = play ? { v: play.state.v } : null;
    p.id = P.util.puzzleId(p);
    return p;
  }

  // ================================================================================================= CHƠI TỐI ƯU (solution, replay)
  function concludeAction(d, T) {
    var x = T[0];
    if (isStack(d)) return { k: "conclude", stack: x };
    var a = []; for (var i = 0; i < d.n; i++) a.push((x >> i) & 1);
    return { k: "conclude", x: a };
  }
  function concludeText(d, T) {
    var x = T[0];
    if (isStack(d)) return "Chỉ còn một khả năng — chồng " + (x + 1) + " là chồng xu giả.";
    var hv = setOfMask(d.n, x), lt = setOfMask(d.n, ((1 << d.n) - 1) & ~x);
    return "Chỉ còn một khả năng — " + (hv.length ? "xu " + setText(hv) + " nặng" : "không xu nào nặng") + (lt.length ? ", xu " + setText(lt) + " nhẹ." : ".");
  }
  function concludeWhy(d, T) {
    return [isStack(d) ? "Mọi chồng khác đã bị loại bởi các số đọc: chỉ chồng " + (T[0] + 1) + " cho đúng các độ dư đã đo."
      : "Chỉ một vectơ nặng/nhẹ cho đúng mọi số đọc đã ghi — " + knownText(d, T) + "."];
  }
  function playOptimal(p) {
    var d = p.data, L = layoutOf(d), s = { v: plan.empty(L), c: null }, steps = [], guard = 0;
    p = Object.assign({}, p, { solution: null });
    while (guard++ < d.k + 3) {
      var T = candOf(d, s), r = budget(d, s);
      if (T.length === 1) {
        var act = concludeAction(d, T), dd = moveFor(p, s, act);
        steps.push({ diff: dd, action: act, cells: isStack(d) ? [T[0]] : setOfMask(d.n, T[0]).concat(setOfMask(d.n, ((1 << d.n) - 1) & ~T[0])), text: concludeText(d, T), why: concludeWhy(d, T) });
        P.game.applyDiff(s, dd.d, false);
        return { state: s, steps: steps };
      }
      if (r <= 0 || !T.length) return null;
      var best = bestWeighing(d, T, r);
      if (!best) return null;
      var act2 = actionOf(d, best.w), d2 = moveFor(p, s, act2);
      if (!d2) return null;
      var res = plan.record(after(s, d2), L, plan.count(s))[d.n];
      steps.push({ diff: d2, action: act2, cells: isStack(d) ? candidatesOf(T) : setOfMask(d.n, best.w), text: "Lần cân " + (plan.count(s) + 1) + ": " + wText(d, best.w) + " → " + gramsText(gramsOf(d, recOf(d, best.w, res))) + ".", why: explainWeighing(d, T, best.w, r, best) });
      P.game.applyDiff(s, d2.d, false);
    }
    return null;
  }
  function candidatesOf(T) { return T.slice(); }

  // ================================================================================================= moveFor / check / mistakes / grade
  function moveFor(p, s, a) {
    var d = p.data, L = layoutOf(d), i;
    if (!a || typeof a !== "object") return null;
    if (a.k === "weigh") {
      var w = wFromAction(d, a);
      if (w === null || plan.isSubmitted(s) || plan.count(s) >= d.k) return null;
      var res = oracle(p, s, w), rec = recOf(d, w, res);
      return plan.appendDiff(s, L, [rec], "Cân " + wShort(d, w) + ": " + gramsText(gramsOf(d, rec)));
    }
    if (a.k === "conclude") {
      if (plan.isSubmitted(s)) return null;
      if (isStack(d)) {
        if (!isInt(a.stack, 0, d.n - 1)) return null;
        return plan.submitDiff(s, L, [a.stack + 1], "Kết luận: chồng " + (a.stack + 1) + " là chồng giả");
      }
      if (!Array.isArray(a.x) || a.x.length !== d.n) return null;
      var ps = [];
      for (i = 0; i < d.n; i++) { if (a.x[i] !== 0 && a.x[i] !== 1) return null; ps.push(a.x[i] ? 2 : 1); }
      return plan.submitDiff(s, L, ps, "Kết luận: " + a.x.map(function (v, j) { return (j + 1) + (v ? "n" : "e"); }).join(" "));
    }
    if (a.k === "truncate") return plan.truncateDiff(s, L, a.n);
    return null;
  }
  /** Kết luận đã nộp (nếu có): chong {stack}; hailoai {x: bitmask}. */
  function concluded(p, s) {
    var d = p.data, ps = plan.params(s, layoutOf(d));
    if (!plan.isSubmitted(s)) return null;
    if (isStack(d)) return { stack: ps[0] - 1 };
    var m = 0; for (var i = 0; i < d.n; i++) if (ps[i] === 2) m |= 1 << i;
    return { x: m, set: ps.every(function (v) { return v === 1 || v === 2; }) };
  }
  function concValue(d, cn) { return isStack(d) ? cn.stack : cn.x; }
  function forcedOk(p, s, T) {
    var d = p.data, cn = concluded(p, s);
    if (!cn || T.length !== 1) return false;
    if (!isStack(d) && !cn.set) return false;
    return T[0] === concValue(d, cn);
  }
  function check(p, s) {
    var d = p.data, T = candOf(d, s), cn = concluded(p, s), solved = !!cn && forcedOk(p, s, T), conflicts = [], i;
    if (cn && !solved) {
      if (isStack(d)) { if (T.indexOf(cn.stack) < 0 && cn.stack >= 0 && cn.stack < d.n) conflicts.push(cn.stack); }
      else if (cn.set && T.indexOf(cn.x) < 0 && T.length) {                         // các xu mà MỌI khả năng còn lại đều đồng ý nhưng kết luận khác
        var a1 = (1 << d.n) - 1, a0 = a1;
        T.forEach(function (x) { a1 &= x; a0 &= ~x; });
        for (i = 0; i < d.n; i++) { var gh = (cn.x >> i) & 1; if ((a1 >> i) & 1 && !gh) conflicts.push(i); else if ((a0 >> i) & 1 && gh) conflicts.push(i); }
      }
    }
    return { solved: solved, conflicts: conflicts, filled: plan.count(s), total: p.solution ? plan.count({ v: p.solution.v }) : d.k, complete: T.length === 1 };
  }
  function mistakes(p, s, diff) {
    var d = p.data, t = after(s, diff);
    if (plan.isSubmitted(t) && !plan.isSubmitted(s)) return check(p, t).solved ? 0 : 1;
    if (plan.count(t) > plan.count(s)) {
      var T = candOf(d, s), r = budget(d, s);
      if (!solvC(d, T, r)) return 0;                                    // đã mất từ trước — không tính lại
      var w = wFromRec(d, plan.record(t, layoutOf(d), plan.count(s))), parts = partsOf(d, T, w);
      for (var i = 0; i < parts.length; i++) if (!solvC(d, parts[i].T, r - 1)) return 1;
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
  function stateAfter(p, s, j) {
    var d = p.data, L = layoutOf(d), recs = plan.read(s, L), st = { v: plan.empty(L), c: null };
    for (var i = 0; i < j; i++) { var dd = plan.appendDiff(st, L, [recs[i]]); P.game.applyDiff(st, dd.d, false); }
    return st;
  }
  /** Duyệt lịch sử: now = lần cân đầu của đợt "mất" ĐANG kéo dài tới thế hiện tại (−1 nếu thế hiện tại còn giải được; 0 nếu đề không giải được từ đầu);
      drop = lần cân ĐẦU TIÊN đưa thế từ giải được sang không giải được (−1 nếu chưa có; vẫn ≥ 1 khi sau đó nhờ MAY thế giải lại được). Cùng ngữ nghĩa với coinbalance. */
  function lossScan(p, s) {
    var d = p.data, L = layoutOf(d), recs = plan.read(s, L), j, st = { v: plan.empty(L), c: null }, now = -1, drop = -1, prevOk = true;
    for (j = 0; j <= recs.length; j++) {
      var ok = solvC(d, candOf(d, st), d.k - j);
      if (ok) now = -1; else { if (now < 0) now = j; if (prevOk && j >= 1 && drop < 0) drop = j; }
      prevOk = ok;
      if (j < recs.length) { var dd = plan.appendDiff(st, L, [recs[j]]); P.game.applyDiff(st, dd.d, false); }
    }
    return { now: now, drop: drop };
  }
  function lostAt(p, s) { return lossScan(p, s).now; }
  /** Lần cân thứ j (1…) của lịch sử: phép cân + lý do KHÔNG an toàn (từ thế TRƯỚC lần cân; null nếu thực ra an toàn). */
  function weighingAt(p, s, j) {
    var d = p.data, L = layoutOf(d), st0 = stateAfter(p, s, j - 1), T0 = candOf(d, st0), rec = plan.record(s, L, j - 1), w = wFromRec(d, rec), r = d.k - (j - 1), why = null;
    if (isStack(d)) {
      var parts = partsOf(d, T0, w), B = powCap(d.c + 1, r - 1), worst = null;
      parts.forEach(function (q) { if (!solvC(d, q.T, r - 1) && (!worst || q.T.length > worst.T.length)) worst = q; });
      if (worst) why = "nếu " + readName(d, worst.res, w) + " thì còn " + worst.T.length + " chồng mà " + (r - 1) + " lần cân còn lại chỉ phân biệt được tối đa " + B + " (mỗi lần " + (d.c + 1) + " kết quả)";
    } else why = whyUnsafeTwo(d, T0, r, w);
    return { w: w, why: why };
  }
  function hint(p, s, level) {
    var d = p.data, T = candOf(d, s), r = budget(d, s), cn = concluded(p, s), m = T.length;
    if (cn) {
      if (check(p, s).solved) return { level: level, text: "Đã kết luận đúng — kết luận được chứng minh từ các lần cân.", why: [], cells: [], none: true };
      var reopen = { k: "truncate", n: plan.count(s) };
      return { level: level, technique: "Mở lại", text: level === 1 ? "Kết luận này chưa được chứng minh từ các lần cân — đoán đúng cũng chưa tính." : "Kết luận chưa được chứng minh: các lần cân vẫn còn " + possText(d, m) + ".",
        why: ["Chỉ khi các lần cân loại hết mọi khả năng khác thì kết luận mới được tính.", "Mở lại để cân tiếp hoặc hoàn tác về lần cân trước."], cells: isStack(d) && cn.stack >= 0 && cn.stack < d.n ? [cn.stack] : [], action: level === 3 ? reopen : null };
    }
    var scan = lossScan(p, s), j = scan.now;
    if (j >= 1) {
      var wj = weighingAt(p, s, j), lines = ["Lần cân thứ " + j + " (" + wShort(d, wj.w) + ") làm mất an toàn: " + (wj.why || "một kết quả khả dĩ không còn giải được trong số lần còn lại") + ".", "Hoàn tác về trước lần cân đó để chọn phép cân khác."];
      return { level: level, technique: "Hoàn tác", cells: isStack(d) ? [] : setOfMask(d.n, wj.w),
        text: level === 1 ? "Từ thế này không còn cách cân nào chắc chắn xác định được trong " + r + " lần còn lại — một lần cân trước đã làm mất an toàn." : level === 2 ? "Lần cân thứ " + j + " đã làm mất chiến lược chắc chắn." : "Quay về trước lần cân thứ " + j + ".",
        why: level === 3 ? lines : [], action: level === 3 ? { k: "truncate", n: j - 1 } : null };
    }
    if (j === 0) return { level: level, text: "Đề này không có chiến lược chắc chắn trong " + d.k + " lần cân.", why: [], cells: [], none: true };
    var lk = scan.drop >= 1 ? weighingAt(p, s, scan.drop) : null;
    var luckLine = lk ? ["Lưu ý: lần cân thứ " + scan.drop + " (" + wShort(d, lk.w) + ") đã làm mất an toàn" + (lk.why ? " — " + lk.why : "") + ". Kết quả thật may mắn nên thế hiện tại vẫn giải được chắc chắn, nhưng ván này chỉ còn tối đa 1★ (sai sót đã được tính, hoàn tác không xoá)."] : [];
    if (m === 1) {
      var act = concludeAction(d, T);
      return { level: level, technique: "Kết luận", cells: level === 1 ? [] : (isStack(d) ? [T[0]] : setOfMask(d.n, T[0]).concat(setOfMask(d.n, ((1 << d.n) - 1) & ~T[0]))),
        text: level === 1 ? "Các lần cân đã đủ thông tin để kết luận — chỉ còn một khả năng." : level === 2 ? (isStack(d) ? "Chồng " + (T[0] + 1) + " là chồng giả — hãy bấm Kết luận." : "Đã xác định được từng xu — hãy bấm Kết luận.") : "Kết luận: " + concludeText(d, T).replace(/^Chỉ còn một khả năng — /, ""),
        why: level === 3 ? concludeWhy(d, T).concat(luckLine) : [], action: level === 3 ? act : null };
    }
    var best = bestWeighing(d, T, r);
    if (!best) return { level: level, text: "Không còn phép cân an toàn.", why: [], cells: [], none: true };
    var w = best.w, sc = isStack(d) ? candidatesOf(T) : setOfMask(d.n, w);
    if (isStack(d)) {
      var rn = needC(d, T, r), B = powCap(d.c + 1, rn - 1);
      if (level === 1) return { level: 1, technique: "Chia theo kết quả", cells: sc, text: "Còn " + m + " chồng nghi và " + r + " lần cân. Mỗi lần cân chỉ có " + (d.c + 1) + " kết quả (số xu giả đã lấy: 0…" + d.c + ") nên sau lần này mỗi kết quả phải còn ≤ " + powCap(d.c + 1, r - 1) + " chồng — hãy lấy số xu KHÁC NHAU từ các chồng để chia chúng thành các nhóm cùng cỡ.", why: [], action: null };
      if (level === 2) return { level: 2, technique: "Chia theo kết quả", cells: sc, text: "Chia " + m + " chồng nghi thành " + best.parts.length + " nhóm, mỗi nhóm ≤ " + B + " chồng: các chồng trong cùng nhóm lấy cùng số xu, nhóm sau lấy nhiều hơn nhóm trước 1 xu (lấy từ 0 đến " + (best.parts.length - 1) + " xu).", why: [], action: null };
      return { level: 3, technique: "Chia theo kết quả", cells: sc, text: wText(d, w).replace(/^l/, "L") + ".", why: explainWeighing(d, T, w, r, best).concat(luckLine), action: actionOf(d, w) };
    }
    if (level === 1) return { level: 1, technique: "Chia theo số đọc", cells: [], text: "Còn " + m + " khả năng và " + r + " lần cân. Cân chỉ cho biết CÓ BAO NHIÊU xu nặng trong nhóm đã cân (không biết xu nào) — hãy chọn nhóm sao cho các số đọc có thể chia các khả năng thật đều.", why: [], action: null };
    if (level === 2) return { level: 2, technique: "Chia theo số đọc", cells: sc, text: "Cân một nhóm gồm " + POP[w] + " xu: cách chia này làm mỗi số đọc chỉ còn tối đa " + Math.max.apply(null, best.parts.map(function (q) { return q.T.length; })) + " khả năng.", why: [], action: null };
    return { level: 3, technique: "Chia theo số đọc", cells: sc, text: "Cân " + setText(sc) + ".", why: explainWeighing(d, T, w, r, best).concat(luckLine), action: actionOf(d, w) };
  }

  // ================================================================================================= đề tự nhập / kiểm / I-O
  function noStrategyText(d) {
    if (isStack(d)) return d.n + " chồng, mỗi chồng " + d.c + " xu, " + d.k + " lần cân không có chiến lược chắc chắn: mỗi lần cân chỉ có " + (d.c + 1) + " kết quả nên " + d.k + " lần phân biệt tối đa " + powCap(d.c + 1, d.k) + " chồng (cần ít nhất " + needC(d, fullSet(d), 12) + " lần).";
    var kn = needC(d, fullSet(d), 8);
    return d.n + " xu, " + d.k + " lần cân không đủ để xác định chắc chắn từng xu — cần ít nhất " + (kn <= 8 ? kn : "nhiều hơn 8") + " lần (quy hoạch động minimax).";
  }
  function fail(errors, extra) { return Object.assign({ ok: false, errors: errors, warnings: [], status: "none", count: 0 }, extra || {}); }
  function parseSecretTwo(x, n) {
    if (typeof x === "number") return isInt(x, 0, (1 << n) - 1) ? x : null;
    if (typeof x === "string") { x = x.trim(); if (/^\d+$/.test(x) && x.length === n && /^[01]+$/.test(x)) { var m = 0; for (var i = 0; i < n; i++) if (x[i] === "1") m |= 1 << i; return m; } return null; }
    if (Array.isArray(x) && x.length === n && x.every(function (v) { return v === 0 || v === 1; })) { var m2 = 0; for (var j = 0; j < n; j++) if (x[j]) m2 |= 1 << j; return m2; }
    return null;
  }
  function fromInput(inp) { return fromInputAt(inp, null); }
  function fromInputAt(inp, seed) {
    if (!inp || typeof inp !== "object") return fail(["Thiếu dữ liệu đề."]);
    var errs = [], num = function (x) { return typeof x === "string" && /^\s*\d+\s*$/.test(x) ? Number(x) : x; };
    var form = inp.form === "two" ? "two" : inp.form === "stack" || inp.form == null ? "stack" : null;
    var mode = inp.mode === "adv" ? "adv" : inp.mode == null || inp.mode === "fixed" ? "fixed" : null;
    if (form === null) return fail(["Dạng phải là 'stack' (chồng xu) hoặc 'two' (xu hai loại)."]);
    if (mode === null) return fail(["Chế độ phải là 'fixed' hoặc 'adv'."]);
    var n = num(inp.n), k = num(inp.k), c = num(inp.c), secret = null;
    if (form === "stack") {
      if (!isInt(n, 2, MAX_S)) errs.push("Số chồng phải là số nguyên 2–" + MAX_S + ".");
      if (!isInt(c, 1, MAX_C)) errs.push("Số xu mỗi chồng phải là số nguyên 1–" + MAX_C + ".");
      if (!isInt(k, 1, MAX_KS)) errs.push("Số lần cân phải là số nguyên 1–" + MAX_KS + ".");
      if (errs.length) return fail(errs);
      if (mode === "fixed") {
        secret = num(inp.secret);
        if (inp.secret == null) return fail(["Chế độ cố định cần chồng giả: secret (chỉ số 0…" + (n - 1) + ") — hoặc chọn chế độ đối thủ."]);
        if (!isInt(secret, 0, n - 1)) return fail(["Chồng giả cố định phải nằm trong 1–" + n + "."]);
      }
    } else {
      if (!isInt(n, 2, MAX_N2)) errs.push("Số xu phải là số nguyên 2–" + MAX_N2 + " (n = 7 vượt ngân sách tính toán của luồng chính).");
      if (!isInt(k, 1, MAX_K2)) errs.push("Số lần cân phải là số nguyên 1–" + MAX_K2 + ".");
      if (errs.length) return fail(errs);
      if (mode === "fixed") {
        if (inp.secret == null) return fail(["Chế độ cố định cần bí mật: secret (xu nào nặng) — hoặc chọn chế độ đối thủ."]);
        secret = parseSecretTwo(inp.secret, n);
        if (secret === null) return fail(["Bí mật phải là chuỗi 0/1 dài " + n + " (1 = xu nặng), mảng 0/1 hoặc số bitmask."]);
      }
    }
    var d = form === "stack" ? { form: "stack", n: n, c: c, k: k, mode: mode, secret: secret } : { form: "two", n: n, k: k, mode: mode, secret: secret };
    var kstar = bestK(d);
    if (kstar > k) { var msg = noStrategyText(d); return fail([msg], { statusText: "✗ " + msg, statusKind: "bad" }); }
    var p = buildPuzzle(seed, "tu-nhap", d, "custom");
    if (!p.solution) return fail(["Không dựng được ván chơi tối ưu cho đề này."]);
    var warns = kstar < k ? ["Chỉ cần " + kstar + " lần cân là đủ (đề cho " + k + " lần) — ngân sách còn dư."] : [];
    return { ok: true, puzzle: p, errors: [], warnings: warns, status: "unique", count: 1, statusKind: "ok",
      statusText: "✓ Có chiến lược chắc chắn trong " + kstar + " lần cân" + (mode === "adv" ? " (kể cả khi đối thủ chọn kết quả khó nhất)" : "") };
  }
  function secretText(d) {
    if (d.secret == null) return null;
    if (isStack(d)) return String(d.secret + 1);
    var s = ""; for (var i = 0; i < d.n; i++) s += (d.secret >> i) & 1; return s;
  }
  function inputOf(d) { return isStack(d) ? { form: "stack", n: d.n, c: d.c, k: d.k, mode: d.mode, secret: d.secret } : { form: "two", n: d.n, k: d.k, mode: d.mode, secret: d.secret }; }

  var KEY_MAP = { "dang": "form", "form": "form", "chong": "n", "so chong": "n", "stacks": "n", "xu": "n", "n": "n", "so xu": "n", "xu moi chong": "c", "xu/chong": "c", "c": "c", "lan can": "k", "k": "k", "so lan can": "k", "che do": "mode", "mode": "mode", "ma": "secret", "secret": "secret", "bi mat": "secret" };
  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function parseText(text) {
    var m = {};
    String(text == null ? "" : text).split(/\r?\n|;/).forEach(function (line) {
      var i = line.indexOf(":"); if (i < 0) i = line.indexOf("="); if (i < 0) return;
      var k0 = ascii(line.slice(0, i)).replace(/\s+/g, " "), key = Object.prototype.hasOwnProperty.call(KEY_MAP, k0) ? KEY_MAP[k0] : undefined, val = line.slice(i + 1).trim();
      if (key && m[key] === undefined) m[key] = val;
    });
    if (m.n === undefined || m.k === undefined) return { err: "Thiếu dòng 'chồng/xu: …' hoặc 'lần cân: …'." };
    var inp = { n: /^\d+$/.test(m.n) ? Number(m.n) : m.n, k: /^\d+$/.test(m.k) ? Number(m.k) : m.k };
    var form = "stack";
    if (m.form !== undefined) { var f = ascii(m.form); form = /chong|stack/.test(f) ? "stack" : /hai loai|two/.test(f) ? "two" : "?"; if (form === "?") return { err: "'dạng' phải là 'chồng xu' hoặc 'hai loại'." }; }
    inp.form = form;
    if (form === "stack") { if (m.c === undefined) return { err: "Thiếu dòng 'xu mỗi chồng: …'." }; inp.c = /^\d+$/.test(m.c) ? Number(m.c) : m.c; }
    if (m.mode !== undefined) { var md = ascii(m.mode); inp.mode = /doi thu|adv/.test(md) ? "adv" : /co dinh|fixed/.test(md) ? "fixed" : "?"; if (inp.mode === "?") return { err: "'chế độ' phải là 'cố định' hoặc 'đối thủ'." }; }
    if (m.secret !== undefined) {
      var sv = m.secret.trim();
      if (form === "stack") { if (!/^\d+$/.test(sv)) return { err: "'mã' phải là số thứ tự chồng giả (1…)." }; inp.secret = Number(sv) - 1; }
      else { if (!/^[01]+$/.test(sv)) return { err: "'mã' phải là chuỗi 0/1 (1 = xu nặng), vd 0110." }; inp.secret = sv; }
    }
    return { inp: inp };
  }
  function toText(p) {
    var d = p.data, st = secretText(d);
    return (isStack(d) ? ["dạng: chồng xu", "chồng: " + d.n, "xu mỗi chồng: " + d.c] : ["dạng: hai loại", "xu: " + d.n]).concat(["lần cân: " + d.k, "chế độ: " + (d.mode === "adv" ? "đối thủ" : "cố định")]).concat(st != null ? ["mã: " + st] : []).join("\n");
  }
  function fromText(text) {
    var r = parseText(text);
    if (r.err) return { ok: false, errors: [r.err], warnings: [] };
    return fromInput(r.inp);
  }
  function toFile(p) {
    var d = p.data, st = secretText(d), init = (isStack(d) ? ["form=stack", "n=" + d.n, "c=" + d.c] : ["form=two", "n=" + d.n]).concat(["k=" + d.k, "mode=" + d.mode]).concat(st != null ? ["secret=" + st] : []).join(";");
    var sol = "";
    try {
      var recs = plan.read({ v: p.solution.v }, layoutOf(d));
      sol = recs.map(function (rec) { var items = []; for (var i = 0; i < d.n; i++) { if (isStack(d)) { if (rec[i]) items.push((i + 1) + "x" + rec[i]); } else if (rec[i]) items.push(i + 1); } return items.join(",") + "=" + rec[d.n]; }).join(";");
    } catch (e) { sol = ""; }
    return { type: "coinscale", seed: p.seed, difficulty: p.score, size: p.size, initialState: init, solution: sol, metadata: p.meta || {} };
  }
  function fromFile(o) {
    if (!o || typeof o !== "object" || typeof o.initialState !== "string") return { ok: false, errors: ["Thiếu initialState (dạng form=…;n=…;k=…)."], warnings: [] };
    var m = {}; o.initialState.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) m[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    var inp = { form: m.form, n: Number(m.n), k: Number(m.k), mode: m.mode };
    if (m.form === "stack") inp.c = Number(m.c);
    if (m.secret !== undefined && m.secret !== "") {
      if (m.form === "stack") { if (!/^\d+$/.test(m.secret)) return { ok: false, errors: ["secret phải là số thứ tự chồng (1…)."], warnings: [] }; inp.secret = Number(m.secret) - 1; }
      else inp.secret = m.secret;
    }
    var r = fromInput(inp);
    if (r.ok && o.metadata && typeof o.metadata === "object" && typeof o.metadata.name === "string") r.puzzle.meta = { name: o.metadata.name.slice(0, 80) };
    return r;
  }

  // ================================================================================================= cây chiến lược
  function strategyTree(d, maxNodes) {
    var nodes = [], id = 0, truncated = false;
    function add(parent, label, status) { if (nodes.length >= maxNodes) { truncated = true; return -1; } nodes.push({ id: id, parent: parent, label: label, status: status }); return id++; }
    function rec(T, r, parent, label) {
      if (T.length === 0) return;
      if (T.length === 1) { add(parent, label + " → xong: " + candName(d, T[0]), "solution"); return; }
      var best = bestWeighing(d, T, r);
      if (!best) { add(parent, label + " → không giải được", "dead"); return; }
      var nid = add(parent, label + " · " + wShort(d, best.w), "ok");
      if (nid < 0) return;
      best.parts.forEach(function (q) { rec(q.T, r - 1, nid, (isStack(d) ? "dư " + q.res + " g" : gramsText(POP[best.w] * W_LIGHT + q.res)) + " · " + q.T.length + (isStack(d) ? " chồng" : " khả năng")); });
    }
    var T0 = fullSet(d), rid = add(-1, (isStack(d) ? d.n + " chồng" : d.n + " xu · " + T0.length + " khả năng") + " · " + d.k + " lần", "ok");
    if (rid >= 0) { var b0 = bestWeighing(d, T0, d.k); if (b0) { nodes[0].label += " · " + wShort(d, b0.w); b0.parts.forEach(function (q) { rec(q.T, d.k - 1, rid, (isStack(d) ? "dư " + q.res + " g" : gramsText(POP[b0.w] * W_LIGHT + q.res)) + " · " + q.T.length + (isStack(d) ? " chồng" : " khả năng")); }); } }
    return { nodes: nodes, truncated: truncated };
  }

  var def = {
    id: "coinscale", name: "Cân điện tử", family: "Mathematical Puzzle", category: "Lý thuyết số", icon: "🔢",
    blurb: "Cân cho số gam: tìm chồng xu giả, hoặc xác định từng xu nặng / nhẹ, trong số lần cân ít nhất.",
    rules: [
      "Cân điện tử cho SỐ GAM của những gì đặt lên, không phải so hai đĩa. Mỗi ván có số lần cân tối đa cố định; hết lượt thì chỉ còn kết luận.",
      "Chồng xu: n chồng, mỗi chồng c xu; xu thật 10 g, MỘT chồng toàn xu giả 11 g. Mỗi lần cân bạn lấy một số xu (0…c) từ mỗi chồng; phần dư so với \"toàn xu thật\" cho biết số xu giả đã lấy. Hãy tìm chồng giả.",
      "Xu hai loại: n xu, mỗi xu nhẹ 9 g hoặc nặng 10 g (chưa biết xu nào); cân một nhóm xu tuỳ chọn, số gam = 9 × số xu + số xu nặng. Hãy xác định ĐÚNG từng xu nặng hay nhẹ.",
      "Kết luận chỉ được tính khi các lần cân đã CHỨNG MINH nó; đoán đúng nhờ may mắn không tính. Ở chế độ \"Đối thủ thích nghi\" không có bí mật định sẵn: mỗi lần cân đối thủ chọn kết quả khó nhất mà vẫn nhất quán.",
      "Hoàn tác được, nhưng điểm sao ghi nhận: 3★ nếu thắng bằng chiến lược chắc chắn, đủ số lần cân tối ưu, không hoàn tác, không dùng gợi ý mức 3; thắng mà có sai sót chỉ 1★."
    ],
    sizes: SIZES.map(function (z) { return { id: z.id, label: z.label, params: z.params, default: z.default || undefined, tiers: z.tiers }; }),
    algorithm: {
      title: "Đếm kết quả + quy hoạch động minimax trên tập khả năng",
      steps: [
        { title: "Tập khả năng còn nhất quán", text: "Mỗi lần cân là một phép đo; những khả năng cho CÙNG số đọc rơi vào cùng một nhóm. Chiến lược tốt chia tập khả năng thành các nhóm càng đều càng tốt, và chỉ cần xét nhóm xấu nhất (minimax)." },
        { title: "Chồng xu: mã cơ số c + 1", text: "Lấy t xu từ một chồng giả cho đúng t g dư — chỉ có c + 1 kết quả (0…c) mỗi lần. Vậy k lần cân phân biệt tối đa (c + 1)^k chồng, và chia theo chữ số cơ số c + 1 đạt đúng cận: k* = ⌈log_{c+1} n⌉ (cận đếm cũng là điều kiện đủ)." },
        { title: "Xu hai loại: cận thông tin chưa đủ", text: "Cân một nhóm chỉ cho biết số xu nặng trong nhóm, ít nhất 2^n khả năng phải được tách. Cận đếm (n + 1)^k chỉ để cắt nhánh; câu trả lời thật cần minimax: A(n) = 1, 2, 3, 3, 4, 4 với n = 1…6 (thích nghi; chiến lược lập kế hoạch trước có thể cần nhiều lần hơn)." },
        { title: "DP nhớ đệm theo tập", text: "solv(T, r) = tồn tại nhóm S sao cho mọi lớp {x ∈ T : |x ∩ S| = j} đều solv(·, r − 1). Tập T ≤ 64 vectơ được nén thành bitset làm khoá nhớ đệm." },
        { title: "Đối thủ & gợi ý", text: "Đối thủ chọn lớp kết quả khó nhất (cần nhiều lần cân nhất); gợi ý chọn phép cân an toàn có lớp lớn nhất nhỏ nhất và nói vì sao các phép cân gần đó hỏng." }
      ],
      links: [{ id: "meet-in-the-middle", label: "Meet in the middle" }, { id: "bitmask-dp", label: "QHĐ bitmask" }, { id: "backtracking", label: "Quay lui" }, { id: "branch-and-bound", label: "Nhánh cận" }]
    },
    difficultyNote: "Chồng xu: 0,3 + 1,6 × (số lần cân tối thiểu − 1) + 3 × độ KHÍT của cận đếm n / (c + 1)^k (khít = 1); xu hai loại: tăng theo số xu (số khả năng 2^n gấp đôi mỗi xu). Chế độ đối thủ cộng 0,5.",
    kind: "interactive", objective: { sense: "min", label: "Số lần cân", unit: "lần" },
    sizeLabel: "Phiên bản",
    moveLabel: "Số thao tác (cân, kết luận, mở lại — hoàn tác không làm giảm)",
    mistakeLabel: "Sai sót (lần cân mất an toàn hoặc kết luận chưa chứng minh)",
    sizeText: function (p) {
      var d = p && p.data;
      if (!dataOk(d)) return "";
      return isStack(d) ? d.n + " chồng × " + d.c + " xu · " + d.k + " lần cân" : d.n + " xu hai loại · " + d.k + " lần cân";
    },
    options: [{ id: "mode", label: "Chế độ", choices: [
      { id: "fixed", label: "Bí mật cố định", note: "Chồng giả / xu nặng được chọn sẵn theo seed — hoàn tác cho phép 'thử rồi lùi', nhưng điểm sao ghi nhận." },
      { id: "adv", label: "Đối thủ thích nghi", note: "Không có bí mật định sẵn: mỗi lần cân đối thủ chọn kết quả khó nhất — chỉ chiến lược chắc chắn mới thắng." }], default: "fixed" }],

    generate: function (seed, o) {
      o = o || {};
      var sz = P.types.sizeOf(def, o.sizeId), full = P.types.optionsOf(def, o.options), mode = full.mode, tier = P.util.tier(o.tier) ? o.tier : "easy";
      var r0 = P.rng.create(seed).fork("cs"), band = P.util.tier(tier), cands = [], i, d;
      if (sz.params.form === "stack") {
        var c, n, ks;
        for (c = 1; c <= MAX_C; c++) for (n = 3; n <= MAX_S; n++) {
          ks = 1; while (powCap(c + 1, ks) < n) ks++;
          if (ks > MAX_KS) continue;
          d = { form: "stack", n: n, c: c, k: ks, mode: mode, secret: null };
          var sc = scoreOf(d);
          if (sc >= band.min && sc < band.max) cands.push(d);
        }
        if (!cands.length) cands.push({ form: "stack", n: 10, c: 9, k: 1, mode: mode, secret: null });
        d = Object.assign({}, cands[r0.fork("n").int(cands.length)]);
        d.secret = mode === "fixed" ? r0.fork("secret").int(d.n) : null;
      } else {
        for (i = 2; i <= MAX_N2; i++) {
          d = { form: "two", n: i, k: 0, mode: mode, secret: null };
          var s2 = P.util.clampScore(1.0 + 1.4 * (i - 1) + (mode === "adv" ? 0.5 : 0));
          if (s2 >= band.min && s2 < band.max) cands.push(i);
        }
        if (!cands.length) cands.push(2);
        var nn = cands[r0.fork("n").int(cands.length)];
        d = { form: "two", n: nn, k: bestK({ form: "two", n: nn, k: MAX_K2 }), mode: mode, secret: null };
        d.secret = mode === "fixed" ? r0.fork("secret").int(1 << nn) : null;
      }
      var p = buildPuzzle(seed, sz.id, d, tier);
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
      return { status: "unique", count: 1, solution: { v: play.state.v }, steps: play.steps.map(function (st) { return { technique: st.action.k === "weigh" ? "Chia theo số đọc" : "Kết luận", text: st.text }; }),
        techniques: { "Chia theo số đọc": play.steps.length - 1, "Kết luận": 1 }, nodes: memo2.size, best: k };
    },
    difficulty: function (p) { return scoreOf(p.data); },
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    isGiven: function () { return false; },
    moveFor: moveFor, check: check, mistakes: mistakes, grade: grade, hint: hint,
    replay: function (p) {
      var play = playOptimal(p);
      return play ? play.steps.map(function (st) { return { text: st.text, why: st.why, diff: { d: st.diff.d }, cells: st.cells, technique: st.action.k === "weigh" ? "Chia theo số đọc" : "Kết luận" }; }) : [];
    },
    constraintView: function (p) {
      var d = p.data, k = bestK(d), vars, cons, secs, T0 = fullSet(d).length;
      if (isStack(d)) {
        vars = [{ name: "chồng giả", domain: "{1…" + d.n + "}" }, { name: "số xu lấy từ mỗi chồng mỗi lần (×" + d.n + "×" + d.k + ")", domain: "{0…" + d.c + "}", count: d.n * d.k }, { name: "số đọc mỗi lần cân (×" + d.k + ")", domain: "{0…" + d.c + "} g dư", count: d.k }];
        cons = ["đúng một chồng toàn xu giả (11 g), các chồng khác toàn xu thật (10 g)", "mỗi lần cân: lấy 0…" + d.c + " xu từ mỗi chồng, ít nhất 1 xu", "số đọc − 10 × (số xu lấy) = số xu giả đã lấy = t[chồng giả]", "tối đa " + d.k + " lần cân"];
        secs = [{ title: "Đếm kết quả", note: "Mỗi lần cân chỉ có " + (d.c + 1) + " kết quả (0…" + d.c + " xu giả) nên " + d.k + " lần phân biệt tối đa " + powCap(d.c + 1, d.k) + " chồng.", items: [d.n + " chồng so với " + powCap(d.c + 1, d.k) + " kết quả.", k <= d.k ? "Có chiến lược chắc chắn trong " + k + " lần cân (⌈log_" + (d.c + 1) + " " + d.n + "⌉)." : "KHÔNG có chiến lược chắc chắn trong " + d.k + " lần cân."] }];
      } else {
        vars = [{ name: "loại mỗi xu (×" + d.n + ")", domain: "{nhẹ 9 g, nặng 10 g}", count: d.n }, { name: "nhóm xu của mỗi lần cân (×" + d.k + ")", domain: "tập con của {1…" + d.n + "}", count: d.k }, { name: "số đọc mỗi lần cân (×" + d.k + ")", domain: "{0…" + d.n + "} xu nặng", count: d.k }];
        cons = ["mỗi xu nhẹ (9 g) hoặc nặng (10 g)", "mỗi lần cân: nhóm khác rỗng; số đọc = 9 × |nhóm| + số xu nặng trong nhóm", "kết luận phải đúng loại của TỪNG xu", "tối đa " + d.k + " lần cân"];
        secs = [{ title: "Cận thông tin chưa đủ", note: "Cân một nhóm chỉ cho biết số xu nặng, không biết xu nào.", items: [T0 + " khả năng (2^" + d.n + ") so với " + powCap(d.n + 1, d.k) + " kết quả tối đa của " + d.k + " lần cân (mỗi lần ≤ " + (d.n + 1) + " kết quả).", k <= d.k ? "Có chiến lược thích nghi chắc chắn trong " + k + " lần cân (DP minimax)." : "KHÔNG có chiến lược chắc chắn trong " + d.k + " lần cân.", "A(n) với n = 1…6: 1, 2, 3, 3, 4, 4."] }];
      }
      secs.push({ title: "Chế độ", items: [d.mode === "adv" ? "Chế độ đối thủ: không có bí mật định sẵn; mỗi lần cân đối thủ chọn lớp kết quả cần nhiều lần cân nhất để giải." : "Chế độ cố định: bí mật được chọn từ seed (có trong tệp JSON của đề)."] });
      return { summary: isStack(d) ? d.n + " chồng × " + d.c + " xu, " + d.k + " lần cân" : d.n + " xu hai loại (9 g / 10 g), " + d.k + " lần cân", variables: vars, constraints: cons, counts: { variables: vars.length, constraints: cons.length, "khả năng": T0, "kết quả tối đa": isStack(d) ? powCap(d.c + 1, d.k) : powCap(d.n + 1, d.k) }, sections: secs };
    },
    trace: function (p, opts) {
      var mx = opts && opts.maxNodes ? Math.min(600, opts.maxNodes) : 600, tr = strategyTree(p.data, mx);
      return { kind: "tree", nodes: tr.nodes, truncated: tr.truncated, note: "Cây chiến lược tối ưu theo tập khả năng (không phụ thuộc bí mật): mỗi nút là một số đọc và phép cân kế tiếp; nút xanh đậm = đã đủ để kết luận." };
    },
    toText: toText, fromText: fromText, toFile: toFile, fromFile: fromFile,
    describeCell: function (p, s, i) {
      var d = p.data;
      if (!isInt(i, 0, d.n - 1)) return isStack(d) ? "Chồng không hợp lệ" : "Xu không hợp lệ";
      var recs = plan.read(s, layoutOf(d));
      if (isStack(d)) {
        var takes = recs.map(function (r) { return r[i]; });
        return "Chồng " + (i + 1) + " (" + d.c + " xu)" + (recs.length ? ", đã lấy " + takes.join(", ") + " xu qua " + recs.length + " lần cân" : ", chưa cân lần nào");
      }
      var where = recs.map(function (r) { return r[i] ? "trên cân" : "ngoài"; });
      return "Xu " + (i + 1) + (recs.length ? ", đã cân " + recs.length + " lần (" + where.join(", ") + ")" : ", chưa cân lần nào");
    }
  };

  /** Hàm thuần cho bàn chơi và test (không thuộc hợp đồng chung). */
  def.lib = {
    MAX_S: MAX_S, MAX_C: MAX_C, MAX_KS: MAX_KS, MAX_N2: MAX_N2, MAX_K2: MAX_K2, W_REAL: W_REAL, W_LIGHT: W_LIGHT, POP: POP, SIZES: SIZES,
    solvC: solvC, needC: needC, bestK: bestK, fullSet: fullSet, candOf: candOf, partsOf: partsOf, bestWeighing: bestWeighing, safeWeighings: safeWeighings, solvTwo: solvTwo,
    fixedResult: fixedResult, advResult: advResult, layoutOf: layoutOf, budget: budget, concluded: concluded, playOptimal: playOptimal, lossScan: lossScan, lostAt: lostAt, weighingAt: weighingAt,
    wFromRec: wFromRec, recOf: recOf, gramsOf: gramsOf, baseOf: baseOf, gramsText: gramsText, actionOf: actionOf, wFromAction: wFromAction, setOfMask: setOfMask, maskOfRec: maskOfRec,
    scoreOf: scoreOf, setText: setText, ranges: ranges, noStrategyText: noStrategyText, strategyTree: strategyTree, maxStacks: maxStacks, powCap: powCap, whyUnsafeTwo: whyUnsafeTwo, knownText: knownText,
    memoSize: function () { return memo2.size; }, resetMemo: function () { memo2.clear(); memoSize = 0; },
    records: function (p, s) {
      var d = p.data;
      return plan.read(s, layoutOf(d)).map(function (rec) { return { w: wFromRec(d, rec), take: isStack(d) ? rec.slice(0, d.n) : null, set: isStack(d) ? null : setOfMask(d.n, maskOfRec(d, rec)), result: rec[d.n], grams: gramsOf(d, rec), base: baseOf(d, wFromRec(d, rec)) }; });
    }
  };

  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
