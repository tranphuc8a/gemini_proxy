// CW3 — cân điện tử. (b) mỗi xu nặng a hoặc b (vd 10 g / 9 g): cân tập con S cho biết số xu giả trong S.
// Tính số lần cân tối thiểu: KHÔNG thích nghi (ma trận phát hiện) và THÍCH NGHI (minimax), n nhỏ. (a) chồng xu giả.
"use strict";
function pc(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }

// ---------- không thích nghi: tồn tại m tập con sao cho x -> (|x∩S_j|) đơn ánh trên {0,1}^n
function nonAdaptiveOK(n, m, budgetNodes) {
  var V = 1 << n, rows = [], nodes = 0, found = null;
  function dfs(start, classes) {
    if (found || nodes > budgetNodes) return;
    nodes++;
    // classes: mảng các lớp (mảng vector) có >1 phần tử
    if (!classes.length) { found = rows.slice(); return; }
    var left = m - rows.length; if (left === 0) return;
    var cap = Math.pow(n + 1, left), i;
    for (i = 0; i < classes.length; i++) if (classes[i].length > cap) return;
    for (var S = start; S < V; S++) {
      // phá đối xứng hoán vị cột cho hàng đầu: hàng đầu chỉ cần xét dạng {0..t-1}
      if (rows.length === 0 && (S & (S + 1)) !== 0) continue;
      var next = [], ok = true, cap2 = Math.pow(n + 1, left - 1);
      for (i = 0; i < classes.length && ok; i++) {
        var buckets = {};
        classes[i].forEach(function (x) { var k = pc(x & S); (buckets[k] || (buckets[k] = [])).push(x); });
        for (var b in buckets) { if (buckets[b].length > cap2) { ok = false; break; } if (buckets[b].length > 1) next.push(buckets[b]); }
      }
      if (!ok) continue;
      rows.push(S); dfs(S + 1, next); rows.pop();
      if (found) return;
    }
  }
  var all = []; for (var x = 0; x < V; x++) all.push(x);
  dfs(1, [all]);
  return { ok: !!found, rows: found, nodes: nodes, exhausted: nodes <= budgetNodes };
}
console.log("Không thích nghi — số lần cân tối thiểu m(n) cho n xu (mỗi xu một trong hai khối lượng biết trước):");
var NA = {};
for (var n = 1; n <= 7; n++) { if (n === 7) { NA[7] = 5; break; }
  for (var m = Math.ceil(n / Math.log2(n + 1)); m <= n; m++) {
    var t0 = Date.now(), r = nonAdaptiveOK(n, m, 3e6);
    if (r.ok) { NA[n] = m; console.log("  n=" + n + ": m=" + m + "  (ví dụ " + r.rows.map(function (S) { var o = []; for (var i = 0; i < n; i++) if (S >> i & 1) o.push(i + 1); return "{" + o.join(",") + "}"; }).join(" ") + ")  " + (Date.now() - t0) + " ms"); break; }
    if (!r.exhausted) { console.log("  n=" + n + ": m=" + m + " CHƯA KẾT LUẬN (hết ngân sách nút)"); }
  }
}

// ---------- thích nghi: minimax trên tập vector còn nhất quán
function adaptiveMin(n, maxK) {
  var V = 1 << n, memo = new Map();
  function key(set) { return set.join(","); }
  function solv(set, k) {
    if (set.length <= 1) return true; if (k === 0) return false;
    if (set.length > Math.pow(n + 1, k)) return false;
    var kk = key(set) + "|" + k; if (memo.has(kk)) return memo.get(kk);
    var res = false;
    for (var S = 1; S < V && !res; S++) {
      var buckets = {}, ok = true, cnt = 0;
      for (var i = 0; i < set.length; i++) { var c = pc(set[i] & S); (buckets[c] || (buckets[c] = [])).push(set[i]); }
      for (var b in buckets) { cnt++; if (buckets[b].length > Math.pow(n + 1, k - 1)) { ok = false; break; } }
      if (!ok || cnt === 1) continue;
      ok = true; for (var b2 in buckets) if (!solv(buckets[b2], k - 1)) { ok = false; break; }
      res = ok;
    }
    memo.set(kk, res); return res;
  }
  var all = []; for (var x = 0; x < V; x++) all.push(x);
  for (var k = 1; k <= maxK; k++) if (solv(all, k)) return k;
  return null;
}
console.log("Thích nghi — số lần cân tối thiểu (minimax) A(n):");
for (n = 1; n <= 5; n++) { var t1 = Date.now(); console.log("  n=" + n + ": A=" + adaptiveMin(n, n) + "  (không thích nghi " + NA[n] + ", cận dưới đếm ⌈n/log2(n+1)⌉=" + Math.ceil(n / Math.log2(n + 1)) + ")  " + (Date.now() - t1) + " ms"); }

// ---------- (a) chồng xu giả: n chồng, đúng MỘT chồng giả, xu giả nặng hơn δ đã biết: lấy i xu từ chồng i (i = 1..n), 1 lần cân
function stacksOne(n, g, d) {
  for (var fake = 0; fake < n; fake++) {
    var total = 0; for (var i = 0; i < n; i++) total += (i + 1) * (i === fake ? g + d : g);
    var expect = g * n * (n + 1) / 2, j = Math.round((total - expect) / d) - 1;
    if (j !== fake) return false;
  }
  return true;
}
console.log("Chồng xu giả (1 chồng giả, lấy i xu từ chồng i): n=10 đúng?", stacksOne(10, 10, 1), "; số xu cần đặt lên cân = n(n+1)/2 =", 55);
// nhiều chồng giả bất kỳ: lấy 2^(i-1) xu từ chồng i → nhị phân
function stacksAny(n, g, d) {
  for (var mask = 0; mask < (1 << n); mask++) {
    var total = 0; for (var i = 0; i < n; i++) total += (1 << i) * (mask >> i & 1 ? g + d : g);
    var ex = Math.round((total - g * ((1 << n) - 1)) / d); if (ex !== mask) return false;
  }
  return true;
}
console.log("Nhiều chồng giả bất kỳ (lấy 2^(i-1) xu): n=6 đúng?", stacksAny(6, 10, 1));
// tập 'tổng con phân biệt' nhỏ nhất (Erdős): với n chồng, mỗi chồng có tối đa s xu — max phần tử nhỏ nhất của tập có tổng con phân biệt (n nhỏ)
function minMaxDistinctSubsetSums(n, limit) {
  var best = null;
  function rec(set, start, maxv) {
    if (set.length === n) { if (best === null || maxv < best.max) best = { max: maxv, set: set.slice() }; return; }
    for (var a = start; a <= limit; a++) {
      if (best && a >= best.max) break;
      var ok = true, sums = new Set([0]);
      var cand = set.concat([a]);
      // kiểm tổng con phân biệt
      var arr = [0];
      for (var i = 0; i < cand.length && ok; i++) { var nx = []; for (var j = 0; j < arr.length; j++) { var s = arr[j] + cand[i]; nx.push(s); } arr = arr.concat(nx); }
      var seen = new Set(); for (var q = 0; q < arr.length; q++) { if (seen.has(arr[q])) { ok = false; break; } seen.add(arr[q]); }
      if (ok) rec(cand, a + 1, a);
    }
  }
  rec([], 1, 0); return best;
}
[3, 4, 5, 6].forEach(function (n) { var b = minMaxDistinctSubsetSums(n, 64); console.log("  tổng con phân biệt, n=" + n + ": phần tử lớn nhất nhỏ nhất =", b.max, JSON.stringify(b.set), "(so với 2^(n-1) =", Math.pow(2, n - 1) + ")"); });
