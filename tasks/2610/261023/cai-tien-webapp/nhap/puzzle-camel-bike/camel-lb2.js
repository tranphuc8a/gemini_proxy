// camel-lb2.js — LB2: hành trình p → R (lấy thức ăn phía phải) → L (lùi gom kho) → quét. Đối chiếu vét cạn trên mọi trạng thái đạt được.
"use strict";
var src = require("fs").readFileSync(__dirname + "/camel.js", "utf8");
src = src.slice(0, src.indexOf("// ---------------------------------------------------------------- chạy"));
var m = { exports: {} }; new Function("module", "require", src + "\nmodule.exports={brute:brute,LB:LB,sweepPlan:sweepPlan,farCont:farCont,farDisc:farDisc,deliverDisc:deliverDisc,floorF:floorF};")(m, require);
var K = m.exports;
/** Ăn 1 quả cho mỗi lần qua đoạn; đoạn đi TỚI [x,x+1] lấy từ vị trí nhỏ nhất trong [p..x] còn chuối; đoạn LÙI [x-1,x] lấy từ vị trí nhỏ nhất trong [x..R] còn chuối.
    Kiểm sức chở: lượng mang theo không quá C ở mọi lúc. Trả d sau hành trình hoặc null nếu không làm được. */
function excursion(p, R, L, d, C) {
  var dd = d.slice(), take = {}, x, y;
  // chiều tới
  var fwdSrc = [];
  for (x = p; x < R; x++) { y = p; while (y <= x && dd[y] <= 0) y++; if (y > x) return null; dd[y]--; fwdSrc.push(y); }
  // sức chở chiều tới: khi rời vị trí z, mang số quả lấy ở ≤ z dùng cho các đoạn ≥ z
  for (var z = p; z < R; z++) { var carry = 0; for (var s = z - p; s < fwdSrc.length; s++) if (fwdSrc[s] <= z) carry++; if (carry > C) return null; }
  // chiều lùi
  var bwdSrc = [];
  for (x = L + 1; x <= R; x++) { y = x; while (y <= R && dd[y] <= 0) y++; if (y > R) return null; dd[y]--; bwdSrc.push([x, y]); }
  for (var z2 = R; z2 > L; z2--) { var c2 = 0; bwdSrc.forEach(function (e) { if (e[0] <= z2 && e[1] >= z2) c2++; }); if (c2 > C) return null; }
  return dd;
}
function LB2(p, d, C, Mx, goal, D) {
  var best = goal === "far" ? p : d[D], R, L, cand;
  var Rs = [p]; for (R = p + 1; R <= Mx; R++) if (d[R] > 0) Rs.push(R);
  var Ls = [p]; for (L = p - 1; L >= 0; L--) if (d[L] > 0) Ls.push(L);
  Rs.forEach(function (R) { Ls.forEach(function (L) {
    var dd = excursion(p, R, L, d, C); if (!dd) return;
    var v = K.sweepPlan(L, dd, C, Mx, goal, D);
    if (goal === "far") v = Math.max(v, R);
    if (v > best) best = v;
  }); });
  return best;
}
var tot = 0, totMiss = 0;
[[6, 3, "far"], [12, 4, "far"], [15, 5, "far"], [18, 6, "far"], [20, 5, "far"], [16, 8, "far"], [21, 7, "far"], [24, 6, "far"], [20, 10, "far"], [27, 9, "far"], [18, 6, "deliver", 5], [24, 6, "deliver", 6], [21, 7, "deliver", 5], [20, 5, "deliver", 4], [27, 9, "deliver", 6]].forEach(function (c) {
  var B = c[0], C = c[1], goal = c[2], D = c[3];
  var M = goal === "far" ? K.floorF(K.farCont(B, C).far) + 2 : D;
  var t0 = Date.now(), br = K.brute(B, C, M, goal, D), miss = 0, ex = [], over = 0;
  br.memo.forEach(function (val, k) { var parts = k.split("|"), p = +parts[0], d = parts[1].split(",").map(Number); var lb = LB2(p, d, C, M, goal, D); if (lb > val) over++; if (lb !== val) { miss++; if (ex.length < 2) ex.push([k, lb, val]); } });
  tot += br.memo.size; totMiss += miss;
  console.log("B=" + B + " C=" + C + " " + goal + (D ? " D=" + D : "") + ": " + br.states + " trạng thái, LB2 lệch " + miss + " (LB2 > V: " + over + ")" + (ex.length ? " vd " + JSON.stringify(ex) : "") + " (" + (Date.now() - t0) + " ms)");
});
console.log("Tổng " + tot + " trạng thái, LB2 lệch " + totMiss);
