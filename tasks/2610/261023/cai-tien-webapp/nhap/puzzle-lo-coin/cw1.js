// CW1 — kiểm công thức cân đĩa tìm xu giả bằng DP trên trạng thái đếm lớp (u,h,l,g) + vét cạn tường minh cho n nhỏ.
// u = xu có thể nặng HOẶC nhẹ, h = chỉ có thể nặng, l = chỉ có thể nhẹ, g = xu đã biết thật (kể cả xu chuẩn thêm).
"use strict";
var memo = new Map();
function key(s, k, mode) { return s.u + "," + s.h + "," + s.l + "," + Math.min(s.g, s.u + s.h + s.l) + "|" + k + "|" + mode; }
function hyps(s, mode) { return mode === "id" ? s.u + s.h + s.l : 2 * s.u + s.h + s.l; }
function terminal(s, mode) { return hyps(s, mode) <= 1 || (mode === "id" && s.u + s.h + s.l <= 1); }
// liệt kê phép cân: (u1,h1,l1,g1) trái, (u2,h2,l2,g2) phải; g1*g2 = 0; đối xứng trái/phải bỏ qua (chọn bản "nhỏ hơn")
function weighings(s) {
  var out = [], G = Math.min(s.g, s.u + s.h + s.l);
  for (var u1 = 0; u1 <= s.u; u1++) for (var u2 = 0; u1 + u2 <= s.u; u2++)
  for (var h1 = 0; h1 <= s.h; h1++) for (var h2 = 0; h1 + h2 <= s.h; h2++)
  for (var l1 = 0; l1 <= s.l; l1++) for (var l2 = 0; l1 + l2 <= s.l; l2++) {
    var a = u1 + h1 + l1, b = u2 + h2 + l2, d = a - b, g1 = 0, g2 = 0;
    if (d > 0) g2 = d; else g1 = -d;
    if (g1 + g2 > G) continue;
    if (a + g1 === 0) continue;
    // đối xứng gương: chỉ giữ (u1,h1,l1) >= (u2,l2,h2) theo thứ tự từ điển (cân gương tương đương khi đổi vai h<->l)
    out.push({ u1: u1, h1: h1, l1: l1, g1: g1, u2: u2, h2: h2, l2: l2, g2: g2 });
  }
  return out;
}
function outcomes(s, w) {
  var tot = s.u + s.h + s.l + s.g, res = [];
  // trái nặng: xu giả nặng ở trái hoặc nhẹ ở phải
  var hL = w.u1 + w.h1, lL = w.u2 + w.l2; res.push({ o: "L", s: { u: 0, h: hL, l: lL, g: tot - hL - lL } });
  var hR = w.u2 + w.h2, lR = w.u1 + w.l1; res.push({ o: "R", s: { u: 0, h: hR, l: lR, g: tot - hR - lR } });
  var u = s.u - w.u1 - w.u2, h = s.h - w.h1 - w.h2, l = s.l - w.l1 - w.l2; res.push({ o: "=", s: { u: u, h: h, l: l, g: tot - u - h - l } });
  return res;
}
function solvable(s, k, mode) {
  if (terminal(s, mode)) return true;
  if (k === 0) return false;
  if (hyps(s, mode === "id" ? "dir" : mode) > Math.pow(3, k) && mode !== "id") return false;
  var kk = key(s, k, mode); if (memo.has(kk)) return memo.get(kk);
  var ok = false, ws = weighings(s);
  for (var i = 0; i < ws.length && !ok; i++) {
    var os = outcomes(s, ws[i]), all = true;
    for (var j = 0; j < os.length && all; j++) { if (hyps(os[j].s, "dir") === 0) continue; if (!solvable(os[j].s, k - 1, mode)) all = false; }
    if (all) ok = true;
  }
  memo.set(kk, ok); return ok;
}
function maxN(k, mode, ref, heavyKnown) {
  var best = 0, fails = [];
  for (var n = 1; n <= 45; n++) {
    var s = heavyKnown ? { u: 0, h: n, l: 0, g: ref ? 1 : 0 } : { u: n, h: 0, l: 0, g: ref ? 1 : 0 };
    if (solvable(s, k, mode)) best = n; else if (n < best + 3) fails.push(n);
  }
  return { best: best, fails: fails };
}
console.log("k | biết nặng | nặng/nhẹ+hướng, không chuẩn | +hướng, có chuẩn | chỉ tìm xu, không chuẩn | chỉ tìm, có chuẩn");
for (var k = 1; k <= 4; k++) {
  var a = maxN(k, "dir", false, true), b = maxN(k, "dir", false, false), c = maxN(k, "dir", true, false), d = maxN(k, "id", false, false), e = maxN(k, "id", true, false);
  var t = Math.pow(3, k);
  console.log(k, "|", a.best, "(3^k=" + t + ")", "|", b.best, "((3^k-3)/2=" + (t - 3) / 2 + ") n lỗi≤:", JSON.stringify(b.fails.filter(function (x) { return x < b.best; })),
    "|", c.best, "((3^k-1)/2=" + (t - 1) / 2 + ")", "|", d.best, "((3^k-1)/2=" + (t - 1) / 2 + ") n lỗi:", JSON.stringify(d.fails.filter(function (x) { return x < d.best; })), "|", e.best, "((3^k+1)/2=" + (t + 1) / 2 + ")");
}

// ---- vét cạn tường minh cho n nhỏ (đối chiếu DP): tập giả thuyết = mảng (coin, dir); phép cân = gán mỗi xu L/R/0, số xu hai bên bằng nhau
function bruteSolvable(n, ref, H, k, mode) {
  var coins = n + (ref ? 1 : 0);
  function term(H) { if (H.length <= 1) return true; if (mode === "id") { var c = H[0][0]; return H.every(function (x) { return x[0] === c; }); } return false; }
  var mm = new Map();
  function rec(H, k) {
    if (term(H)) return true; if (k === 0) return false;
    var kk = JSON.stringify(H) + k; if (mm.has(kk)) return mm.get(kk);
    var total = Math.pow(3, coins), ok = false;
    for (var a = 0; a < total && !ok; a++) {
      var x = a, side = [], L = 0, R = 0;
      for (var i = 0; i < coins; i++) { side.push(x % 3); if (x % 3 === 1) L++; else if (x % 3 === 2) R++; x = Math.floor(x / 3); }
      if (L !== R || L === 0) continue;
      var parts = { L: [], R: [], E: [] };
      H.forEach(function (hy) { var c = hy[0], d = hy[1], sd = side[c], o; if (sd === 0) o = "E"; else if ((sd === 1) === (d === 1)) o = "L"; else o = "R"; parts[o].push(hy); });
      ok = ["L", "R", "E"].every(function (o) { return parts[o].length === 0 || rec(parts[o], k - 1); });
    }
    mm.set(kk, ok); return ok;
  }
  return rec(H, k);
}
function initH(n, heavyKnown) { var H = []; for (var c = 0; c < n; c++) { H.push([c, 1]); if (!heavyKnown) H.push([c, -1]); } return H; }
var mism = 0, checked = 0;
for (var n = 1; n <= 5; n++) for (var k2 = 1; k2 <= 3; k2++) [false, true].forEach(function (ref) { [false, true].forEach(function (hk) { ["dir", "id"].forEach(function (mode) {
  if (hk && mode === "id") return;
  var s = hk ? { u: 0, h: n, l: 0, g: ref ? 1 : 0 } : { u: n, h: 0, l: 0, g: ref ? 1 : 0 };
  var dp = solvable(s, k2, mode), bf = bruteSolvable(n, ref, initH(n, hk), k2, mode); checked++;
  if (dp !== bf) { mism++; console.log("LỆCH", n, k2, ref, hk, mode, dp, bf); }
}); }); });
console.log("Vét cạn tường minh n≤5, k≤3: " + checked + " trường hợp, lệch " + mism);

// ---- tham lam 'cân bằng 3 phần' (min max nhánh) có thể sai? tìm trạng thái (u,h,l,g) nhỏ mà một phép min-max-nhánh KHÔNG giải được trong khi tồn tại phép giải được
var bad = [], advDiff = [];
for (var u = 0; u <= 8; u++) for (var h = 0; h <= 8; h++) for (var l = 0; l <= 8; l++) for (var g = 0; g <= 3; g++) for (var k3 = 1; k3 <= 3; k3++) {
  var s = { u: u, h: h, l: l, g: g }; if (hyps(s, "dir") < 2 || hyps(s, "dir") > Math.pow(3, k3)) continue;
  if (!solvable(s, k3, "dir")) continue;
  var ws = weighings(s), bestMax = 1e9, info = [];
  ws.forEach(function (w) {
    var os = outcomes(s, w), mx = 0, okw = true, sizes = [];
    os.forEach(function (o) { var z = hyps(o.s, "dir"); sizes.push(z); mx = Math.max(mx, z); if (z && !solvable(o.s, k3 - 1, "dir")) okw = false; });
    info.push({ w: w, mx: mx, ok: okw, sizes: sizes, os: os });
    if (mx < bestMax) bestMax = mx;
  });
  var greedyBad = info.filter(function (x) { return x.mx === bestMax && !x.ok; });
  if (greedyBad.length && bad.length < 6) bad.push({ s: s, k: k3, bestMax: bestMax, ex: greedyBad[0].w, sizes: greedyBad[0].sizes, okExample: info.filter(function (x) { return x.ok; })[0].w });
  // đối thủ "nhánh đông nhất" yếu hơn đối thủ minimax? (một phép cân KHÔNG an toàn nhưng nhánh đông nhất lại giải được)
  info.forEach(function (x) {
    if (x.ok) return;
    var mxs = Math.max.apply(null, x.sizes), big = x.os.filter(function (o) { return hyps(o.s, "dir") === mxs; });
    if (big.every(function (o) { return solvable(o.s, k3 - 1, "dir"); }) && advDiff.length < 4) advDiff.push({ s: s, k: k3, w: x.w, sizes: x.sizes });
  });
}
console.log("Phản ví dụ cho tham lam 'chia 3 phần cân bằng nhất' (cần DP thật):", bad.length ? JSON.stringify(bad.slice(0, 3)) : "không có");
console.log("Phản ví dụ: đối thủ 'giữ nhánh đông nhất' để người chơi thoát dù phép cân không an toàn:", advDiff.length ? JSON.stringify(advDiff.slice(0, 3)) : "không có");

// ---- cây quyết định 12 xu/3 lần: số nút, tỉ lệ phép cân đầu an toàn
function countSafe(s, k, mode) { var ws = weighings(s), safe = 0; ws.forEach(function (w) { if (outcomes(s, w).every(function (o) { return hyps(o.s, "dir") === 0 || solvable(o.s, k - 1, mode); })) safe++; }); return { safe: safe, total: ws.length }; }
console.log("12 xu/3 lần (cần hướng): phép cân đầu an toàn (theo lớp đếm)", JSON.stringify(countSafe({ u: 12, h: 0, l: 0, g: 0 }, 3, "dir")));
console.log("11 xu/3 lần:", JSON.stringify(countSafe({ u: 11, h: 0, l: 0, g: 0 }, 3, "dir")), " 8 xu/3 lần:", JSON.stringify(countSafe({ u: 8, h: 0, l: 0, g: 0 }, 3, "dir")));
console.log("39 xu/4 lần:", JSON.stringify(countSafe({ u: 39, h: 0, l: 0, g: 0 }, 4, "dir")), " 13 xu+chuẩn/3:", JSON.stringify(countSafe({ u: 13, h: 0, l: 0, g: 1 }, 3, "dir")));
console.log("memo", memo.size);
