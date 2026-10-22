// bike-search.js — tìm kiếm ngẫu nhiên + leo đồi trên kế hoạch (lưới vị trí 1/G) bằng bộ mô phỏng hữu tỉ: không kế hoạch nào được thấp hơn cận dưới LP.
"use strict";
var B = require("./bike.js");
var seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
function ri(n) { return Math.floor(rnd() * n); }
function randPlan(n, k, G, len) {
  var plan = [];
  for (var b = 0; b < k; b++) {
    var c = [], a = ri(n), q = rnd() < 0.8 ? ri(n) : null; if (q === a) q = null;
    c.push(q == null ? ["take", a] : ["take", a, q]);
    for (var i = 0; i < len; i++) {
      var r = rnd();
      if (r < 0.4) c.push(["ride", B.Q(1 + ri(G), G)]);
      else if (r < 0.65) c.push(["off", ri(n)]);
      else if (r < 0.9) c.push(["meet", ri(n)]);
      else { var a2 = ri(n), q2 = ri(n); c.push(q2 === a2 ? ["take", a2] : ["take", a2, q2]); }
    }
    plan.push(c);
  }
  return plan;
}
function mutate(plan, n, G) {
  var p = JSON.parse(JSON.stringify(plan, function (k, v) { return typeof v === "bigint" ? { __b: v.toString() } : v; }), function (k, v) { return v && v.__b !== undefined ? BigInt(v.__b) : v; });
  var b = ri(p.length), c = p[b]; if (!c.length) return p;
  var i = ri(c.length), cmd = c[i];
  if (cmd[0] === "ride") { var num = Number(cmd[1].n * BigInt(G) / cmd[1].d) + (rnd() < 0.5 ? -1 : 1); num = Math.max(1, Math.min(G, num)); c[i] = ["ride", B.Q(num, G)]; }
  else if (rnd() < 0.3) c.splice(i, 1);
  else c[i] = randPlan(n, 1, G, 1)[0][1] || cmd;
  return p;
}
function run(n, k, m, G, iters, interp) {
  interp = interp || "A";
  var lp = B.lpA(n, k, m, interp)[4], best = Infinity, bestPlan = null, valid = 0, below = 0;
  for (var it = 0; it < iters; it++) {
    var plan = randPlan(n, k, G, 3 + ri(8)), r = B.simulate(n, k, m, plan, interp);
    if (!r.ok) continue; valid++;
    var T = B.qf(r.T); if (T < lp - 1e-12) below++;
    // leo đồi ngắn
    var cur = plan, curT = T;
    for (var h = 0; h < 60; h++) { var mp = mutate(cur, n, G), rr = B.simulate(n, k, m, mp, interp); if (rr.ok && B.qf(rr.T) <= curT) { cur = mp; curT = B.qf(rr.T); if (curT < lp - 1e-12) below++; } }
    if (curT < best) { best = curT; bestPlan = cur; }
  }
  console.log("n=" + n + " k=" + k + " m=" + m + " (" + interp + ", lưới 1/" + G + "): " + iters + " kế hoạch gốc, " + valid + " hợp lệ; tốt nhất tìm được T = " + best.toFixed(5) + " | cận dưới LP " + lp.toFixed(5) + " | dạng đóng (nếu chia hết) " + (interp === "A" ? B.TA(n, k, m) : B.TB(n, k, m)).toFixed(5) + " | số lần thấp hơn LP: " + below);
  return bestPlan;
}
run(4, 1, 5, 24, 20000);
run(4, 1, 2, 24, 20000);
run(3, 1, 4, 24, 20000);
run(3, 1, 2, 24, 30000);
run(5, 2, 4, 24, 20000);
run(3, 1, 5, 24, 20000, "B");
