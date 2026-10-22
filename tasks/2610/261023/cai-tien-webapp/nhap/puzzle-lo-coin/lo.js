// Lights Out biến thể — số chiều hạt nhân (nullity) theo luật/topo/mod p, đuổi đèn, nghiệm ít bấm nhất, thời gian khử.
"use strict";
var RULES = {
  cross: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
  x: [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
  king: [[0, 0], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  knight: [[0, 0], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
  plus2: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]],
  neigh: [[-1, 0], [1, 0], [0, -1], [0, 1]]            // chỉ hàng xóm, không tự đảo
};
function matrix(w, h, rule, torus, mask) {
  var cells = [], idx = {}, r, c;
  for (r = 0; r < h; r++) for (c = 0; c < w; c++) if (!mask || mask[r * w + c]) { idx[r * w + c] = cells.length; cells.push(r * w + c); }
  var N = cells.length, A = [];
  for (var j = 0; j < N; j++) A.push(new Uint8Array(N));
  cells.forEach(function (cell, j) {          // cột j = mẫu bị đổi khi bấm ô j; A[i][j]
    var r0 = Math.floor(cell / w), c0 = cell % w;
    RULES[rule].forEach(function (d) {
      var rr = r0 + d[0], cc = c0 + d[1];
      if (torus) { rr = (rr % h + h) % h; cc = (cc % w + w) % w; } else if (rr < 0 || rr >= h || cc < 0 || cc >= w) return;
      var t = idx[rr * w + cc]; if (t === undefined) return;
      A[t][j] = 1;                              // ô bị lặp (xuyến nhỏ) thì đảo 2 lần: mod p cộng dồn
    });
  });
  if (torus) { /* cộng dồn khi trùng (w hoặc h nhỏ) */ }
  return { A: A, N: N, cells: cells };
}
function matrixAcc(w, h, rule, torus, p) { // bản cộng dồn mod p (đúng cho xuyến nhỏ)
  var N = w * h, A = []; for (var i = 0; i < N; i++) A.push(new Uint8Array(N));
  for (var j = 0; j < N; j++) { var r0 = Math.floor(j / w), c0 = j % w; RULES[rule].forEach(function (d) { var rr = r0 + d[0], cc = c0 + d[1]; if (torus) { rr = (rr % h + h) % h; cc = (cc % w + w) % w; } else if (rr < 0 || rr >= h || cc < 0 || cc >= w) return; var t = rr * w + cc; A[t][j] = (A[t][j] + 1) % p; }); }
  return A;
}
function inv(a, p) { for (var x = 1; x < p; x++) if ((a * x) % p === 1) return x; return 0; }
function rankMod(Ain, p) {
  var A = Ain.map(function (r) { return Uint8Array.from(r); }), N = A.length, M = A[0].length, rank = 0;
  for (var c = 0; c < M && rank < N; c++) {
    var piv = -1; for (var i = rank; i < N; i++) if (A[i][c] % p) { piv = i; break; }
    if (piv < 0) continue;
    var t = A[piv]; A[piv] = A[rank]; A[rank] = t;
    var iv = inv(A[rank][c], p); for (var k = 0; k < M; k++) A[rank][k] = (A[rank][k] * iv) % p;
    for (i = 0; i < N; i++) if (i !== rank && A[i][c]) { var f = A[i][c]; for (k = 0; k < M; k++) A[i][k] = (A[i][k] + (p - f) * A[rank][k]) % p; }
    rank++;
  }
  return rank;
}
function nul(w, h, rule, torus, p) { return w * h - rankMod(matrixAcc(w, h, rule, torus, p || 2), p || 2); }
var line = function (rule, torus, p, from, to) { var o = []; for (var n = from; n <= to; n++) o.push(nul(n, n, rule, torus, p)); return o.join(","); };
console.log("cross, chữ nhật, mod 2, n=2..20 :", line("cross", false, 2, 2, 20));
console.log("cross, XUYẾN,    mod 2, n=3..12 :", line("cross", true, 2, 3, 12));
console.log("cross, chữ nhật, mod 3, n=2..12 :", line("cross", false, 3, 2, 12));
console.log("cross, chữ nhật, mod 5, n=2..9  :", line("cross", false, 5, 2, 9));
console.log("x (chéo), mod 2, n=2..10        :", line("x", false, 2, 2, 10));
console.log("king (8 kề), mod 2, n=2..10     :", line("king", false, 2, 2, 10));
console.log("knight (mã), mod 2, n=3..10     :", line("knight", false, 2, 3, 10));
console.log("plus2 (chữ thập lớn), n=3..10   :", line("plus2", false, 2, 3, 10));
console.log("neigh (không tự đảo), n=2..10   :", line("neigh", false, 2, 2, 10));

// thời gian khử: 20×20 mod 2 (Uint8 không đóng gói) và mod 3; 25×25 mod 2
function T(label, f) { var t = Date.now(); var r = f(); console.log(label, r, (Date.now() - t) + " ms"); }
T("rank 20×20 mod 2 (Uint8, không đóng gói):", function () { return rankMod(matrixAcc(20, 20, "cross", false, 2), 2); });
T("rank 20×20 mod 3 (Uint8):", function () { return rankMod(matrixAcc(20, 20, "cross", false, 3), 3); });
T("rank 15×15 mod 5 (Uint8):", function () { return rankMod(matrixAcc(15, 15, "cross", false, 5), 5); });

// đuổi đèn 5×5 mod 2: bảng "hàng cuối còn sáng → bấm gì ở hàng đầu"
function chase(w, h, b, p) { // trả về {presses, last}
  var v = b.slice(), x = new Array(w * h).fill(0);
  function press(i, t) { x[i] = (x[i] + t) % p; var r = Math.floor(i / w), c = i % w; [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { var rr = r + d[0], cc = c + d[1]; if (rr >= 0 && rr < h && cc >= 0 && cc < w) v[rr * w + cc] = (v[rr * w + cc] + t) % p; }); }
  for (var r = 0; r < h - 1; r++) for (var c = 0; c < w; c++) { var s = v[r * w + c]; if (s) press((r + 1) * w + c, (p - s) % p); }
  return { x: x, last: v.slice((h - 1) * w) };
}
// ma trận T: bấm đơn vị ở hàng đầu → mẫu hàng cuối sau khi đuổi (bàn trống)
function topTable(w, h) {
  var res = {};
  for (var m = 1; m < (1 << w); m++) {
    var b = new Array(w * h).fill(0), cs = [];
    for (var c = 0; c < w; c++) if (m >> c & 1) { cs.push(c + 1); [[0, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { var rr = d[0], cc = c + d[1]; if (cc >= 0 && cc < w && rr < h) b[rr * w + cc] ^= 1; }); }
    var last = chase(w, h, b, 2).last.join("");
    // bấm tập cs ở hàng đầu rồi đuổi tạo ra hàng cuối 'last' ⇒ gặp hàng cuối 'last' thì bấm cs ở hàng đầu
    if (!res[last] || res[last].length > cs.length) res[last] = cs;
  }
  return res;
}
var tt = topTable(5, 5); console.log("5×5: hàng cuối sau đuổi → bấm ở hàng 1 (" + Object.keys(tt).length + " mẫu):", JSON.stringify(tt));
// nghiệm ít bấm nhất của 5×5 sáng hết: 15
function minWeightAllOn(n) {
  var N = n * n, A = matrixAcc(n, n, "cross", false, 2), b = new Array(N).fill(1);
  // vét cạn 2^n hàng đầu + đuổi → mọi nghiệm (đúng vì hàng đầu quyết định), lấy ít bấm nhất
  var best = 1e9;
  for (var m = 0; m < (1 << n); m++) {
    var v = b.slice(), x = new Array(N).fill(0);
    function press(i) { x[i] ^= 1; var r = Math.floor(i / n), c = i % n; [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { var rr = r + d[0], cc = c + d[1]; if (rr >= 0 && rr < n && cc >= 0 && cc < n) v[rr * n + cc] ^= 1; }); }
    for (var c = 0; c < n; c++) if (m >> c & 1) press(c);
    for (var r = 0; r < n - 1; r++) for (c = 0; c < n; c++) if (v[r * n + c]) press((r + 1) * n + c);
    if (v.slice((n - 1) * n).every(function (z) { return z === 0; })) { var wgt = x.reduce(function (a, z) { return a + z; }, 0); if (wgt < best) best = wgt; }
  }
  return best;
}
console.log("Bàn sáng hết: ít bấm nhất 3×3..7×7 =", [3, 4, 5, 6, 7].map(minWeightAllOn).join(","));
