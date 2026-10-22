// camelN.js — V2: N lạc đà, mỗi con xuất phát ở A chở đầy C (tổng N·C, A không còn chuối). Ăn 1 quả/km khi đi (cả đi lùi), ăn từ phần mình chở.
// Được chuyển chuối giữa lạc đà ở cùng điểm, đặt/lấy kho ở mọi điểm nguyên, đi tới/lùi tuỳ ý.
// V2a (một chiều): tối đa vị trí xa nhất mà một con nào đó đạt được. V2b (phải về): như trên nhưng lúc kết thúc ≥ N−1 con phải ở A.
// Trạng thái chuẩn hoá: (vị trí các con đã sắp xếp, d[]) — phần chở của mỗi con gộp vào kho tại chỗ nó đứng (đổi không tốn gì).
"use strict";
function H(N) { var s = 0; for (var i = 1; i <= N; i++) s += 1 / i; return s; }
function ODD(N) { var s = 0; for (var i = 1; i <= N; i++) s += 1 / (2 * i - 1); return s; }
function brute(N, C, M, needReturn) {
  var memo = new Map();
  function V(pos, d, far) {
    var k = pos.join(",") + "|" + d.join(",") + (needReturn ? "|" + far : "");
    if (memo.has(k)) return memo.get(k);
    var best = -1;
    // kết thúc ở đây được không?
    if (!needReturn) best = Math.max(far, Math.max.apply(null, pos));
    else { var away = pos.filter(function (x) { return x !== 0; }).length; if (away <= 1) best = far; }
    for (var i = 0; i < N; i++) {
      if (i > 0 && pos[i] === pos[i - 1]) continue;          // các con cùng chỗ là như nhau
      var p = pos[i], lim = Math.min(C, d[p]);
      for (var l = 1; l <= lim; l++) for (var dir = -1; dir <= 1; dir += 2) {
        var q = p + dir; if (q < 0 || q > M) continue;
        var nd = d.slice(); nd[p] -= l; nd[q] += l - 1;
        var np = pos.slice(); np[i] = q; np.sort(function (a, b) { return a - b; });
        var nf = Math.max(far, q);
        var v = V(np, nd, needReturn ? nf : 0); if (v > best) best = v;
      }
    }
    memo.set(k, best); return best;
  }
  var d0 = new Array(M + 1).fill(0); d0[0] = N * C;
  var pos0 = new Array(N).fill(0);
  var t0 = Date.now(), v = V(pos0, d0, 0);
  return { v: v, states: memo.size, ms: Date.now() - t0 };
}
var rows = [[2, 2], [2, 3], [2, 4], [2, 6], [3, 2], [3, 3], [2, 5]];
rows.forEach(function (r) {
  var N = r[0], C = r[1];
  var a = brute(N, C, Math.floor(C * H(N)) + 2, false);
  console.log("V2a một chiều N=" + N + " C=" + C + ": vét cạn " + a.v + " | C·H_N = " + (C * H(N)).toFixed(3) + " | " + a.states + " tt, " + a.ms + " ms");
  var b = brute(N, C, Math.floor(C * ODD(N)) + 2, true);
  console.log("V2b phải về  N=" + N + " C=" + C + ": vét cạn " + b.v + " | C·(1+1/3+…+1/(2N−1)) = " + (C * ODD(N)).toFixed(3) + " | " + b.states + " tt, " + b.ms + " ms");
});
