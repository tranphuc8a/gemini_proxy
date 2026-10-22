// CW2 — bộ quả cân ít nhất để cân mọi khối lượng nguyên 1..N trên cân đĩa (bài toán Bachet).
"use strict";
// tập khối lượng đo được: hai đĩa → hệ số {-1,0,1}; một đĩa → {0,1}
function measurable(W, both) {
  var s = new Set([0]);
  W.forEach(function (w) { var nx = new Set(); s.forEach(function (v) { nx.add(v); nx.add(v + w); if (both) nx.add(v - w); }); s = nx; });
  return s;
}
function covers(W, N, both) { var s = measurable(W, both); for (var x = 1; x <= N; x++) if (!s.has(x)) return false; return true; }
// tìm m nhỏ nhất bằng vét cạn tập tăng dần (giá trị ≤ N), đếm số bộ tối ưu
function bestSets(N, both, cap) {
  for (var m = 1; m <= 8; m++) {
    var found = [], W = [];
    (function rec(start, reach) {
      if (found.length > cap) return;
      if (W.length === m) { if (covers(W, N, both)) found.push(W.slice()); return; }
      // cắt tỉa: tổng còn lại tối đa
      for (var w = start; w <= N; w++) {
        // phần tử tiếp theo không thể lớn hơn (2*reach+1) (hai đĩa) hay (reach+1) (một đĩa) nếu muốn phủ liên tục — nhưng tập không cần sắp theo phủ; vẫn cắt cho nhanh:
        if (w > (both ? 2 * reach + 1 : reach + 1) + (N)) break;
        W.push(w); rec(w + 1, reach + w); W.pop();
      }
    })(1, 0);
    if (found.length) return { m: m, count: found.length > cap ? ">" + cap : found.length, sample: found.slice(0, 4) };
  }
  return null;
}
var ok = true;
for (var N = 1; N <= 40; N++) {
  var b2 = bestSets(N, true, 200), b1 = bestSets(N, false, 200);
  var f2 = Math.ceil(Math.log(2 * N + 1) / Math.log(3) - 1e-12), f1 = Math.ceil(Math.log2(N + 1) - 1e-12);
  if (b2.m !== f2 || b1.m !== f1) { ok = false; console.log("LỆCH N=" + N, b2.m, f2, b1.m, f1); }
  if ([4, 13, 40, 7, 15, 10, 20, 30].indexOf(N) >= 0) console.log("N=" + N + ": hai đĩa m*=" + b2.m + " (" + b2.count + " bộ, vd " + JSON.stringify(b2.sample) + ")  |  một đĩa m*=" + b1.m + " (" + b1.count + " bộ, vd " + JSON.stringify(b1.sample) + ")");
}
console.log("Công thức m*=⌈log3(2N+1)⌉ (hai đĩa) và ⌈log2(N+1)⌉ (một đĩa) đúng với N=1..40:", ok);
// đặt quả cân: số quả cân ít nhất để cân vật x với bộ W (hai đĩa), quy hoạch động
function minPlace(W, x) {
  var best = null;
  (function rec(i, sum, used, plan) {
    if (best && used >= best.used) return;
    if (i === W.length) { if (sum === x) best = { used: used, plan: plan.slice() }; return; }
    rec(i + 1, sum, used, plan.concat([0]));
    rec(i + 1, sum + W[i], used + 1, plan.concat([1]));     // đĩa đối diện vật
    rec(i + 1, sum - W[i], used + 1, plan.concat([-1]));    // cùng đĩa với vật
  })(0, 0, 0, []);
  return best;
}
console.log("Cân vật 25 g với {1,3,9,27}:", JSON.stringify(minPlace([1, 3, 9, 27], 25)), "(cân bằng tam phân 25 = 27 - 3 + 1)");
console.log("Cân vật 14 g với {1,2,5,10,20}:", JSON.stringify(minPlace([1, 2, 5, 10, 20], 14)));
