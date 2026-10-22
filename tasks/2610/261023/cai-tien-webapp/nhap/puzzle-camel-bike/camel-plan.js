// camel-plan.js — nguyên mẫu "kế hoạch cụ thể" cho gợi ý/replay: (1) chặng gọn theo pha từ trạng thái đầu; (2) tiếp nối tối ưu (LB2) từ trạng thái bất kỳ
// thành DÃY BƯỚC thật (MOVE x / LOAD n / DROP n), rồi CHẠY bằng bộ mô phỏng luật để chắc giá trị = giá trị dự đoán. Chạy: node camel-plan.js
"use strict";
var src = require("fs").readFileSync(__dirname + "/camel.js", "utf8");
src = src.slice(0, src.indexOf("// ---------------------------------------------------------------- chạy"));
var m = { exports: {} }; new Function("module", "require", src + "\nmodule.exports={g:g,farDisc:farDisc,deliverDisc:deliverDisc,farCont:farCont,floorF:floorF,brute:brute};")(m, require);
var K = m.exports;

// ------------------------------------------------ bộ mô phỏng luật (nguồn sự thật của engine)
function simulate(B, C, steps, Mx) {
  var s = { p: 0, load: 0, dep: {}, far: 0 }; s.dep[0] = B;
  for (var i = 0; i < steps.length; i++) {
    var op = steps[i][0], a = steps[i][1];
    if (op === "LOAD") { var have = s.dep[s.p] || 0; if (a < 1 || a > have || s.load + a > C) return { ok: false, at: i, why: "LOAD " + a + " (kho " + have + ", đang chở " + s.load + ")" }; s.dep[s.p] = have - a; s.load += a; }
    else if (op === "DROP") { if (a < 1 || a > s.load) return { ok: false, at: i, why: "DROP " + a }; s.dep[s.p] = (s.dep[s.p] || 0) + a; s.load -= a; }
    else if (op === "MOVE") { var dist = Math.abs(a - s.p); if (a < 0 || a > Mx || dist === 0 || dist > s.load) return { ok: false, at: i, why: "MOVE " + a + " từ " + s.p + " (chở " + s.load + ")" }; s.load -= dist; s.p = a; if (a > s.far) s.far = a; }
    else return { ok: false, at: i, why: "lạ" };
  }
  return { ok: true, s: s };
}
function canon(s, Mx) { var d = new Array(Mx + 1).fill(0); Object.keys(s.dep).forEach(function (k) { d[+k] += s.dep[k]; }); d[s.p] += s.load; return { p: s.p, d: d }; }

// ------------------------------------------------ chặng gọn từ một đống ở L (lạc đà ở L, KHÔNG chở gì — phần chở đã gộp vào kho L)
// Sinh bước sao cho kết quả trùng QHĐ theo km: S_{x+1} = g(S_x) + d[x+1].
function sweepSteps(L, d, C, Mx, goal, D, out) {
  var x = L, S = d[L], stop = goal === "deliver" ? D : Mx;
  // lạc đà đang ở L, kho L = S (chuẩn hoá). Nó cần LOAD để đi.
  while (x < stop && S >= 1) {
    var r0 = K.g(S, C); if (r0.v < 0) break;
    var f = r0.f, P = Math.min(S, f * C), len = 0, Scur = S;
    // kéo dài chặng khi f không đổi, không có kho ở giữa, chuyến đầy đi-về được (2·len ≤ C), chuyến cuối đủ ăn
    while (x + len < stop) {
      var r = K.g(len === 0 ? S : Scur, C);
      if (r.f !== f || r.v < 0) break;
      var nl = len + 1;
      if (f > 1 && 2 * nl > C) break;
      var last = P - (f - 1) * C; if (last < nl) break;
      len = nl; Scur = r.v;                                   // sau km này còn Scur (chưa cộng kho)
      if (d[x + len] > 0) break;                              // gặp kho: dừng để gộp
    }
    if (len === 0) break;
    var y = x + len;
    for (var t = 1; t < f; t++) { out.push(["LOAD", C]); out.push(["MOVE", y]); if (C - 2 * len > 0) out.push(["DROP", C - 2 * len]); out.push(["MOVE", x]); }
    var lastLoad = P - (f - 1) * C; out.push(["LOAD", lastLoad]); out.push(["MOVE", y]);
    S = P - (2 * f - 1) * len + d[y];
    // lạc đà ở y đang chở lastLoad − len; chuẩn hoá: thả hết xuống kho y để vòng sau LOAD lại (giữ dãy bước đơn giản)
    if (lastLoad - len > 0) out.push(["DROP", lastLoad - len]);
    x = y;
  }
  // far: đi tiếp hết sức với phần còn lại (đã nằm trong vòng lặp vì f=1 kéo dài tới khi S cạn)
  return { x: x, S: S };
}
function compactPlan(B, C, goal, D, Mx) {
  var d = new Array(Mx + 1).fill(0); d[0] = B; var steps = [];
  sweepSteps(0, d, C, Mx, goal, D, steps);
  return steps;
}

// ------------------------------------------------ tiếp nối LB2 thành bước cụ thể
function excursionSteps(p, R, L, d, C, out, s0load) {
  var dd = d.slice(), fwd = [], bwd = [], x, y;
  for (x = p; x < R; x++) { y = p; while (y <= x && dd[y] <= 0) y++; if (y > x) return null; dd[y]--; fwd.push(y); }
  for (var z = p; z < R; z++) { var carry = 0; for (var s = z - p; s < fwd.length; s++) if (fwd[s] <= z) carry++; if (carry > C) return null; }
  for (x = L + 1; x <= R; x++) { y = x; while (y <= R && dd[y] <= 0) y++; if (y > R) return null; dd[y]--; bwd.push([x, y]); }
  for (var z2 = R; z2 > L; z2--) { var c2 = 0; bwd.forEach(function (e) { if (e[0] <= z2 && e[1] >= z2) c2++; }); if (c2 > C) return null; }
  // số quả nhặt ở mỗi điểm cho chiều tới / lùi
  var pickF = {}, pickB = {}; fwd.forEach(function (yy) { pickF[yy] = (pickF[yy] || 0) + 1; }); bwd.forEach(function (e) { pickB[e[1]] = (pickB[e[1]] || 0) + 1; });
  return { dd: dd, pickF: pickF, pickB: pickB };
}
/** Từ trạng thái thật s (vị trí, chở, kho) sinh dãy bước tiếp nối theo phương án LB2 tốt nhất. */
function continuation(s, B, C, Mx, goal, D) {
  var c = canon(s, Mx), p = c.p, d = c.d, best = null;
  var Rs = [p]; for (var R = p + 1; R <= Mx; R++) if (d[R] > 0) Rs.push(R);
  var Ls = [p]; for (var L = p - 1; L >= 0; L--) if (d[L] > 0) Ls.push(L);
  Rs.forEach(function (R) { Ls.forEach(function (L) {
    var ex = excursionSteps(p, R, L, d, C); if (!ex) return;
    var v = sweepValue(L, ex.dd, C, Mx, goal, D); if (goal === "far") v = Math.max(v, R, p);
    if (!best || v > best.v) best = { v: v, R: R, L: L, ex: ex };
  }); });
  if (!best) return { v: goal === "far" ? p : d[D], steps: [] };
  // dựng bước: chuẩn hoá lạc đà (thả hết chở xuống kho p), chiều tới, chiều lùi, quét
  var steps = [], cur = p;
  if (s.load > 0) steps.push(["DROP", s.load]);
  function goTo(target, pick) {           // đi từng chặng giữa các điểm nhặt; ở mỗi điểm nhặt LOAD đúng số cần
    var dir = target > cur ? 1 : -1;
    while (cur !== target) {
      var need = pick[cur] || 0; if (need) steps.push(["LOAD", need]);
      var nxt = cur + dir; while (nxt !== target && !pick[nxt]) nxt += dir;
      steps.push(["MOVE", nxt]); cur = nxt;
    }
  }
  if (best.R > p) goTo(best.R, best.ex.pickF);
  if (best.L < best.R) goTo(best.L, best.ex.pickB);
  sweepSteps(best.L, best.ex.dd, C, Mx, goal, D, steps);
  return { v: best.v, steps: steps, R: best.R, L: best.L };
}
function sweepValue(L, d, C, Mx, goal, D) {
  var S = d[L], x = L; if (goal === "deliver" && L === D) return S;
  while (x < Mx) { if (S < 1) break; var r = K.g(S, C); if (r.v < 0) break; S = r.v + d[x + 1]; x++; if (goal === "deliver" && x === D) return S; }
  return goal === "deliver" ? 0 : x;
}
function valueOf(sim, goal, D) { return goal === "far" ? sim.s.far : ((sim.s.dep[D] || 0) + (sim.s.p === D ? sim.s.load : 0)); }

// ------------------------------------------------ chạy
var L0 = console.log;
L0("== 1. Kế hoạch gọn theo pha từ trạng thái đầu: mô phỏng luật phải ra đúng giá trị QHĐ");
var bad = 0, tot = 0, maxSteps = 0, seedv = 99;
function rnd() { seedv = (seedv * 1103515245 + 12345) >>> 0; return seedv / 4294967296; }
var showcase = [[3000, 1000, "far"], [3000, 1000, "deliver", 1000], [2500, 1000, "deliver", 1000], [30, 15, "far"], [30, 15, "deliver", 10], [45, 15, "far"], [45, 15, "deliver", 15], [40, 15, "far"], [420, 105, "far"], [420, 105, "deliver", 100], [1575, 315, "far"], [1575, 315, "deliver", 300], [100, 30, "far"]];
showcase.forEach(function (c) {
  var B = c[0], C = c[1], goal = c[2], D = c[3], Mx = goal === "far" ? K.floorF(K.farCont(B, C).far) + 2 : D;
  var steps = compactPlan(B, C, goal, D, Mx), sim = simulate(B, C, steps, Mx), want = goal === "far" ? K.farDisc(B, C).far : K.deliverDisc(B, C, D);
  var got = sim.ok ? valueOf(sim, goal, D) : "LỖI " + JSON.stringify(sim);
  L0("  B=" + B + " C=" + C + " " + goal + (D ? " D=" + D : "") + ": QHĐ " + want + " | kế hoạch gọn " + got + (got === want ? " ✓" : " ✗") + " | " + steps.length + " bước");
});
for (var i = 0; i < 3000; i++) {
  var C = 2 + Math.floor(rnd() * 60), B = C + Math.floor(rnd() * 5 * C), goal = rnd() < 0.5 ? "far" : "deliver";
  var Mx = K.floorF(K.farCont(B, C).far) + 2, D = goal === "deliver" ? 1 + Math.floor(rnd() * (Mx - 1)) : 0; if (goal === "deliver") Mx = D;
  var steps = compactPlan(B, C, goal, D, Mx), sim = simulate(B, C, steps, Mx), want = goal === "far" ? K.farDisc(B, C).far : K.deliverDisc(B, C, D);
  tot++; maxSteps = Math.max(maxSteps, steps.length);
  if (!sim.ok || valueOf(sim, goal, D) !== want) { bad++; if (bad <= 5) L0("  ✗ B=" + B + " C=" + C + " " + goal + " D=" + D + " muốn " + want + " được " + (sim.ok ? valueOf(sim, goal, D) : JSON.stringify(sim))); }
}
L0("  ngẫu nhiên: " + tot + " bộ, sai " + bad + ", nhiều bước nhất " + maxSteps);

L0("\n== 2. Tiếp nối LB2 từ trạng thái giữa chừng (tiền tố ngẫu nhiên hợp lệ) → bước cụ thể → mô phỏng = giá trị LB2; và = vét cạn ở bộ nhỏ");
var bad2 = 0, tot2 = 0, cmpBrute = 0, badBrute = 0, maxMs = 0;
for (var j = 0; j < 4000; j++) {
  var small = j < 1500;
  var C2 = small ? 3 + Math.floor(rnd() * 5) : 5 + Math.floor(rnd() * 200), B2 = C2 + Math.floor(rnd() * (small ? 3 : 5) * C2), goal2 = rnd() < 0.5 ? "far" : "deliver";
  var Mx2 = K.floorF(K.farCont(B2, C2).far) + 2, D2 = goal2 === "deliver" ? 1 + Math.floor(rnd() * (Mx2 - 1)) : 0; if (goal2 === "deliver") Mx2 = D2;
  // tiền tố ngẫu nhiên: các bước hợp lệ chọn bừa
  var pre = [], st = { p: 0, load: 0, dep: { 0: B2 }, far: 0 }, n = Math.floor(rnd() * 14);
  for (var q = 0; q < n; q++) {
    var r = rnd(), cand;
    if (r < 0.35) { var have = st.dep[st.p] || 0, room = C2 - st.load; if (!have || !room) continue; cand = ["LOAD", 1 + Math.floor(rnd() * Math.min(have, room))]; }
    else if (r < 0.55) { if (!st.load) continue; cand = ["DROP", 1 + Math.floor(rnd() * st.load)]; }
    else { if (!st.load) continue; var to = st.p + (rnd() < 0.7 ? 1 : -1) * (1 + Math.floor(rnd() * st.load)); to = Math.max(0, Math.min(Mx2, to)); if (to === st.p) continue; cand = ["MOVE", to]; }
    var trial = simulate(B2, C2, pre.concat([cand]), Mx2); if (!trial.ok) continue; pre.push(cand); st = trial.s;
  }
  var t0 = Date.now(), cont = continuation(st, B2, C2, Mx2, goal2, D2), ms = Date.now() - t0; maxMs = Math.max(maxMs, ms);
  var full = simulate(B2, C2, pre.concat(cont.steps), Mx2);
  var achieved = full.ok ? valueOf(full, goal2, D2) : null, predicted = goal2 === "far" ? Math.max(st.far, cont.v) : cont.v;
  tot2++;
  if (!full.ok || achieved !== predicted) { bad2++; if (bad2 <= 6) L0("  ✗ B=" + B2 + " C=" + C2 + " " + goal2 + " D=" + D2 + " tiền tố " + JSON.stringify(pre) + " → dự đoán " + predicted + ", chạy được " + (full.ok ? achieved : JSON.stringify(full)) + " | R=" + cont.R + " L=" + cont.L); }
  if (small) {
    cmpBrute++;
    var br = K.brute(B2, C2, Mx2, goal2, D2), cs = canon(st, Mx2), key = cs.p + "|" + cs.d.join(",");
    // V từ trạng thái hiện tại: chạy vét cạn riêng cho trạng thái này
    var memo = br.memo; var vtrue = memo.has(key) ? memo.get(key) : null;
    if (vtrue != null) { var vt = goal2 === "far" ? Math.max(st.far, vtrue) : vtrue; if (vt !== predicted) { badBrute++; if (badBrute <= 4) L0("  ✗ vét cạn " + vt + " ≠ LB2 " + predicted + " tại " + key); } }
  }
}
L0("  " + tot2 + " trạng thái giữa chừng: kế hoạch tiếp nối chạy ra đúng giá trị dự đoán ở " + (tot2 - bad2) + "/" + tot2 + "; so vét cạn (bộ nhỏ) " + cmpBrute + " ca, lệch " + badBrute + "; chậm nhất " + maxMs + " ms");

L0("\n== 3. Thời gian LB2 trên số lớn (B=3000, C=1000, Mx=1535) với kho rải rác");
var dBig = new Array(1536).fill(0); dBig[0] = 1200; dBig[150] = 900; dBig[200] = 600; dBig[350] = 5; dBig[420] = 300;
var sBig = { p: 200, load: 120, dep: {}, far: 420 }; dBig.forEach(function (v, k) { if (v) sBig.dep[k] = v; });
var t1 = Date.now(), cb = continuation(sBig, 3000, 1000, 1535, "far", 0);
L0("  LB2 + dựng bước: " + (Date.now() - t1) + " ms, giá trị " + cb.v + ", " + cb.steps.length + " bước (R=" + cb.R + ", L=" + cb.L + ")");
