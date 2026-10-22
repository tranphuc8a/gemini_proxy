// đối chiếu độc lập: đếm hạt nhân bằng vét cạn p^N (bàn nhỏ) so với nullity từ khử Gauss
var src = require("fs").readFileSync("lo.js", "utf8").replace('"use strict";', ""); src = src.slice(0, src.indexOf("var line ="));
(0, eval)(src);
function kernelBrute(w, h, rule, torus, p) {
  var A = matrixAcc(w, h, rule, torus, p), N = w * h, total = Math.pow(p, N), cnt = 0, x = new Array(N).fill(0);
  for (var t = 0; t < total; t++) {
    var z = t; for (var i = 0; i < N; i++) { x[i] = z % p; z = Math.floor(z / p); }
    var ok = true; for (i = 0; i < N && ok; i++) { var s = 0; for (var j = 0; j < N; j++) s += A[i][j] * x[j]; if (s % p) ok = false; }
    if (ok) cnt++;
  }
  return cnt;
}
var cases = [[3,3,"cross",true,2],[4,4,"cross",false,2],[5,3,"cross",true,2],[3,3,"knight",false,2],[4,3,"x",false,2],[2,2,"cross",false,3],[3,3,"cross",false,3],[4,2,"cross",false,3],[3,3,"king",false,2],[4,4,"cross",true,2],[2,2,"cross",false,5],[4,4,"plus2",false,2]];
var bad = 0; cases.forEach(function (c) { var nl = nul(c[0], c[1], c[2], c[3], c[4]), kb = kernelBrute(c[0], c[1], c[2], c[3], c[4]); var ok = kb === Math.pow(c[4], nl); if (!ok) bad++; console.log(c.join(" "), "nullity", nl, "| vét cạn |ker| =", kb, ok ? "khớp" : "LỆCH"); });
console.log("lệch:", bad);
