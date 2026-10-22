// camel.js — kiểm chứng bài lạc đà chở chuối V1 (1 lạc đà). Chạy: node camel.js
// Mô hình RỜI RẠC (vị trí nguyên km, chuối nguyên quả): lạc đà ăn 1 quả mỗi km đi (cả khi đi về), ăn từ phần nó đang chở;
// sức chở C; được đặt/lấy chuối ở mọi vị trí nguyên. Trạng thái chuẩn hoá: (p, d[]) với d[p] gộp cả phần lạc đà chở
// (đổi chở <-> kho tại chỗ không tốn gì). Nước đi: chọn chở l (1..min(C,d[p])), đi sang p±1: d[p]-=l, d[p±1]+=l-1.
"use strict";

// ---------------------------------------------------------------- phân số BigInt
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
function F(n, d) { n = BigInt(n); d = d === undefined ? 1n : BigInt(d); if (d < 0n) { n = -n; d = -d; } var g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; }
function add(a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return F(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return F(a.n * b.n, a.d * b.d); }
function div(a, b) { return F(a.n * b.d, a.d * b.n); }
function cmp(a, b) { var x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
function fs(a) { return a.d === 1n ? a.n.toString() : a.n + "/" + a.d + " (≈" + (Number(a.n) / Number(a.d)).toFixed(3) + ")"; }
function floorF(a) { var q = a.n / a.d; if (a.n < 0n && q * a.d !== a.n) q -= 1n; return Number(q); }

// ---------------------------------------------------------------- dạng đóng (liên tục)
function loadsOf(S, C) { return Math.ceil(S / C); }          // số chuyến chở k = ceil(S/C)
/** Quãng đường xa nhất (liên tục): pha k chuyến dài (S-(k-1)C)/(2k-1), rồi C/(2j-1) cho j = k-1..1. */
function farCont(B, C) {
  var k = loadsOf(B, C), tot = F(B - (k - 1) * C, 2 * k - 1), phases = [{ loads: k, len: F(B - (k - 1) * C, 2 * k - 1) }];
  for (var j = k - 1; j >= 1; j--) { tot = add(tot, F(C, 2 * j - 1)); phases.push({ loads: j, len: F(C, 2 * j - 1) }); }
  return { far: tot, phases: phases };
}
/** Số chuối tới đích D (liên tục). */
function deliverCont(B, C, D) {
  var pos = F(0), S = F(B), Df = F(D), log = [];
  for (var guard = 0; guard < 100; guard++) {
    if (cmp(S, F(0)) <= 0) return { left: F(0), log: log };
    var k = Math.ceil(Number(S.n) / Number(S.d) / C - 1e-12); if (k < 1) k = 1;
    var seg = div(sub(S, F((k - 1) * C)), F(2 * k - 1));
    if (cmp(add(pos, seg), Df) >= 0) { var rest = sub(Df, pos); S = sub(S, mul(F(2 * k - 1), rest)); log.push({ loads: k, from: pos, to: Df }); return { left: cmp(S, F(0)) < 0 ? F(0) : S, log: log }; }
    log.push({ loads: k, from: pos, to: add(pos, seg) }); pos = add(pos, seg); S = F((k - 1) * C);
  }
}

// ---------------------------------------------------------------- QHĐ rời rạc theo từng km (đơn điệu ⇒ tham lam đúng)
function g(S, C) {                // chuyển cả đống S sang km kế: f chuyến, bỏ lại phần thừa nếu có lợi
  var best = -Infinity, bf = 0;
  for (var f = 1; f <= Math.ceil(S / C) + 1; f++) { var m = Math.min(S, f * C); if (m < 2 * f - 1) continue; var v = m - (2 * f - 1); if (v > best) { best = v; bf = f; } }
  return { v: best, f: bf };
}
function farDisc(B, C) { var S = B, x = 0, best = Math.min(S, C), trail = [S]; while (S >= 1) { var r = g(S, C); if (r.v < 0) break; S = r.v; x++; trail.push(S); best = Math.max(best, x + Math.min(S, C)); } return { far: best, trail: trail }; }
function deliverDisc(B, C, D) { var S = B; for (var x = 0; x < D; x++) { if (S < 1) return 0; S = g(S, C).v; } return S; }

// ---------------------------------------------------------------- vét cạn trên trạng thái chuẩn hoá
function brute(B, C, M, goal, D) {
  var memo = new Map(), Mx = goal === "deliver" ? D : M;
  function key(p, d) { return p + "|" + d.join(","); }
  function V(p, d) {
    var k = key(p, d); if (memo.has(k)) return memo.get(k);
    var best = goal === "far" ? p : d[D];
    var lim = Math.min(C, d[p]);
    for (var l = 1; l <= lim; l++) for (var dir = -1; dir <= 1; dir += 2) {
      var q = p + dir; if (q < 0 || q > Mx) continue;
      var nd = d.slice(); nd[p] -= l; nd[q] += l - 1;
      var v = V(q, nd); if (v > best) best = v;
    }
    memo.set(k, best); return best;
  }
  var d0 = new Array(Mx + 1).fill(0); d0[0] = B;
  var v0 = V(0, d0);
  return { value: v0, memo: memo, states: memo.size };
}

// ---------------------------------------------------------------- bộ đánh giá cho gợi ý: LB (kế hoạch dựng được) và UB (nới lỏng luồng)
// Trạng thái chuẩn hoá (p, d). goal far: giá trị = vị trí xa nhất CÒN đạt được (không tính lịch sử); deliver: chuối ở D.
function sweepFrom(L, dArr, C, Mx, goal, D) {   // quét từ L (lạc đà ở L, không chở gì; d đã trừ phần ăn khi quay lui)
  var S = dArr[L], x = L, far = L;
  while (x < Mx) {
    if (S < 1) break;
    var r = g(S, C); if (r.v < 0) break;
    S = r.v + dArr[x + 1]; x++; far = x;
    if (goal === "far") { /* tiếp */ }
  }
  if (goal === "far") { return Math.max(far, x + 0); }
  return x >= D ? (x === D ? S : 0) : (D === L ? dArr[L] : 0);
}
function sweepPlan(L, dArr, C, Mx, goal, D) {   // giá trị của "quét từ L" (dùng g, kho phía phải cộng dần)
  var S = dArr[L], x = L;
  if (goal === "deliver" && L === D) return S;
  while (x < Mx) {
    if (S < 1) break;
    var r = g(S, C); if (r.v < 0) break;
    S = r.v + dArr[x + 1]; x++;
    if (goal === "deliver" && x === D) return S;
  }
  if (goal === "deliver") return 0;
  // far: cuối cùng còn S ở x, đi tiếp được min(S,C) km nhưng các kho phía phải đã được cộng trong vòng lặp ⇒ x là điểm dừng khi S<1
  return x;
}
/** LB: thử mọi L ≤ p (L = p hoặc vị trí có kho), quay lui p→L lấy thức ăn ở kho GẦN NHẤT phía phải (tham lam), rồi quét. */
function LB(p, d, C, Mx, goal, D) {
  var best = goal === "far" ? p : (p === D ? d[D] : d[D]);
  best = Math.max(best, sweepPlan(p, d, C, Mx, goal, D));
  for (var L = p - 1; L >= 0; L--) {
    if (d[L] <= 0) continue;
    var dd = d.slice(), okk = true;
    // đoạn [x-1,x] cho x = p..L+1 (đi lùi): cần 1 quả lấy từ vị trí ≥ x, chọn vị trí NHỎ NHẤT còn chuối (rẻ nhất), và phải mang được (≤ C)
    for (var x = L + 1; x <= p; x++) {
      var y = x; while (y <= p && dd[y] <= 0) y++;
      if (y > p) { okk = false; break; }
      dd[y]--;
    }
    if (!okk) continue;
    // kiểm sức chở khi quay lui: lượng mang khi rời vị trí y về trái = số quả lấy ở ≥ y dùng cho các đoạn bên trái y
    // (đơn giản: tải tối đa = khoảng cách dài nhất giữa hai điểm cấp liên tiếp) — kiểm bên dưới
    var take = new Array(p + 1).fill(0); for (var z = 0; z <= p; z++) take[z] = d[z] - dd[z];
    var carry = 0, capOk = true; for (var z2 = p; z2 > L; z2--) { carry += take[z2]; if (carry > C) { capOk = false; break; } carry -= 1; }
    if (!capOk) continue;
    var v = sweepPlan(L, dd, C, Mx, goal, D);
    if (v > best) best = v;
  }
  return best;
}
/** UB: nới lỏng luồng — mỗi đoạn [x,x+1] bên trái p bị qua f lần tới + f lần lui: ròng ≤ min(S,fC) − 2f; bên phải p: ≤ min(S,fC) − (2f−1). Cho phép nợ (S âm). */
function hfun(S, C, back) {   // back = true: đoạn trái p (f tới, f lui), false: đoạn phải p (f tới, f−1 lui)
  var best = -Infinity; for (var f = 1; f <= Math.max(1, Math.ceil(Math.max(S, 0) / C) + 1); f++) { var v = Math.min(S, f * C) - (back ? 2 * f : 2 * f - 1); if (v > best) best = v; } return best;
}
function UB(p, d, C, Mx, goal, D) {
  // far: X đạt được nếu ∃L ≤ min(p,X): S_X ≥ 0 (và mọi đoạn phải p có S ≥ 1 trước khi qua — nới: chỉ đòi S_X ≥ 0)
  var best = goal === "far" ? p : (p === D ? d[D] : d[D]);
  for (var L = p; L >= 0; L--) {
    if (L < p && d[L] <= 0) continue;
    var S = d[L], x = L;
    var target = goal === "far" ? Mx : D;
    while (x < target) {
      var back = x < p; var nx = hfun(S, C, back) + d[x + 1];
      if (!back && S < 1) break;   // bên phải p: không mang được gì thì không qua (không có nguồn phía phải chưa tới)
      S = nx; x++;
      if (goal === "far" && x >= p && S >= 0 && x > best) best = x;
    }
    if (goal === "deliver" && x === D && S > best) best = S;
  }
  return best;
}

// ---------------------------------------------------------------- chạy
function line(s) { console.log(s); }
line("== 1. Dạng đóng liên tục vs QHĐ rời rạc (ví dụ kinh điển + bộ tham số sinh đề)");
[[3000, 1000, 1000], [2500, 1000, 1000], [3000, 1000, null], [45, 15, null], [45, 15, 15], [30, 15, null], [420, 105, null], [1575, 315, null], [3, 3, null], [2000, 1000, 1000], [100, 30, null], [8, 3, null]].forEach(function (t) {
  var B = t[0], C = t[1], D = t[2];
  var fc = farCont(B, C), fd = farDisc(B, C);
  var s = "B=" + B + " C=" + C + " : xa nhất liên tục " + fs(fc.far) + " | rời rạc " + fd.far + " | pha: " + fc.phases.map(function (p) { return p.loads + " chuyến × " + fs(p.len); }).join(", ");
  if (D) { var dc = deliverCont(B, C, D), dd = deliverDisc(B, C, D); s += "\n      tới D=" + D + ": liên tục " + fs(dc.left) + " | rời rạc " + dd + " | ranh giới pha: " + dc.log.map(function (l) { return l.loads + "ch [" + fs(l.from) + "→" + fs(l.to) + "]"; }).join(", "); }
  line("  " + s);
});

line("\n== 2. Vét cạn (mọi kế hoạch rời rạc) vs QHĐ rời rạc, và kiểm LB/UB trên MỌI trạng thái đạt được");
var cases = [[2, 2], [4, 2], [6, 2], [3, 3], [6, 3], [9, 3], [7, 3], [8, 3], [4, 4], [8, 4], [12, 4], [10, 4], [5, 5], [10, 5], [13, 5], [15, 5], [12, 6]];
var totalStates = 0, lbMiss = 0, ubMiss = 0, lbMissEx = [], ubMissEx = [], lbLow = 0, ubHigh = 0;
cases.forEach(function (c) {
  var B = c[0], C = c[1], fc = farCont(B, C), M = floorF(fc.far) + 2;
  var t0 = Date.now(), br = brute(B, C, M, "far");
  var fd = farDisc(B, C);
  var okDP = br.value === fd.far;
  // kiểm LB/UB trên mọi trạng thái đã ghi nhớ
  var miss = 0, missU = 0;
  br.memo.forEach(function (val, k) {
    var parts = k.split("|"), p = +parts[0], d = parts[1].split(",").map(Number);
    var lb = LB(p, d, C, M, "far"), ub = UB(p, d, C, M, "far");
    if (lb > val) { lbMissEx.length < 5 && lbMissEx.push(["LB>V", B, C, k, lb, val]); }
    if (ub < val) { ubMissEx.length < 5 && ubMissEx.push(["UB<V", B, C, k, ub, val]); }
    if (lb !== val) { miss++; lbLow++; if (lbMissEx.length < 8) lbMissEx.push(["LB≠V", B, C, k, "LB=" + lb, "V=" + val, "UB=" + ub]); }
    if (ub !== val) { missU++; ubHigh++; }
  });
  totalStates += br.memo.size; lbMiss += miss; ubMiss += missU;
  line("  B=" + B + " C=" + C + " far: vét cạn " + br.value + " | QHĐ " + fd.far + (okDP ? " ✓" : " ✗") + " | liên tục " + fs(fc.far) + " | " + br.states + " trạng thái, LB lệch " + miss + ", UB lệch " + missU + " (" + (Date.now() - t0) + " ms)");
});
line("  Tổng: " + totalStates + " trạng thái; LB ≠ V: " + lbMiss + "; UB ≠ V: " + ubMiss);
lbMissEx.slice(0, 8).forEach(function (e) { line("    vd " + JSON.stringify(e)); });
ubMissEx.slice(0, 5).forEach(function (e) { line("    vd " + JSON.stringify(e)); });

line("\n== 3. Mục tiêu 'giao tới D': vét cạn vs QHĐ rời rạc + LB/UB");
var dl = 0, dlu = 0, dtot = 0, dex = [];
[[6, 2, 2], [6, 2, 3], [9, 3, 2], [9, 3, 3], [9, 3, 4], [12, 4, 3], [12, 4, 5], [8, 3, 2], [10, 4, 3], [15, 5, 4], [15, 5, 6]].forEach(function (c) {
  var B = c[0], C = c[1], D = c[2];
  var br = brute(B, C, D, "deliver", D), dd = deliverDisc(B, C, D), dc = deliverCont(B, C, D);
  var miss = 0, missU = 0;
  br.memo.forEach(function (val, k) {
    var parts = k.split("|"), p = +parts[0], d = parts[1].split(",").map(Number);
    var lb = LB(p, d, C, D, "deliver", D), ub = UB(p, d, C, D, "deliver", D);
    if (lb !== val) { miss++; if (dex.length < 6) dex.push(["LB", B, C, D, k, lb, val, ub]); }
    if (ub !== val) missU++;
  });
  dl += miss; dlu += missU; dtot += br.memo.size;
  line("  B=" + B + " C=" + C + " D=" + D + ": vét cạn " + br.value + " | QHĐ " + dd + (br.value === dd ? " ✓" : " ✗") + " | liên tục " + fs(dc.left) + " | " + br.states + " tt, LB lệch " + miss + ", UB lệch " + missU);
});
line("  Tổng " + dtot + " trạng thái; LB ≠ V: " + dl + "; UB ≠ V: " + dlu);
dex.forEach(function (e) { line("    vd " + JSON.stringify(e)); });

module.exports = { farCont: farCont, farDisc: farDisc, deliverCont: deliverCont, deliverDisc: deliverDisc, g: g, F: F, fs: fs };
