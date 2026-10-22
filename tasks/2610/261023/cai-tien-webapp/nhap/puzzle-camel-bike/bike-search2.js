// bike-search2.js — tìm kiếm có cấu trúc (k = 1, cách hiểu A): họ kế hoạch "đưa-đón nhiều chặng + có thể bỏ xe cuối".
// Kế hoạch: take(a,b) → [ride x_i, off (người sau), meet (người đi bộ được chọn)]* → (tuỳ chọn) ride y, off cả hai (bỏ xe), take bởi người phía sau → ride B.
// Duyệt mọi thứ tự đón (người đi bộ nào) tới độ sâu d, toạ độ trên lưới 1/G, leo đồi theo từng toạ độ từ nhiều điểm khởi đầu ngẫu nhiên.
"use strict";
var B = require("./bike.js");
var seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
function build(n, seq, xs, park) {
  // seq: danh sách người được đón theo thứ tự (sau người lái 0 và khách đầu seq[0]); xs: điểm thả mỗi chặng (tăng dần không bắt buộc)
  var c = [["take", 0, seq[0]]];
  for (var i = 0; i < xs.length; i++) {
    c.push(["ride", B.Q(xs[i][0], xs[i][1])]);
    c.push(["off", seq[i]]);
    if (i + 1 < seq.length) c.push(["meet", seq[i + 1]]);
  }
  if (park) { c.push(["ride", B.Q(park.y[0], park.y[1])]); var last = seq[xs.length] != null ? seq[xs.length] : null; if (last != null) c.push(["off", last]); c.push(["off", 0]); c.push(["take", park.a, park.b]); }
  return [c];
}
function evalP(n, m, seq, xs, park) { var r = B.simulate(n, 1, m, build(n, seq, xs, park), "A"); return r.ok ? B.qf(r.T) : Infinity; }
function search(n, m, G, depthMax, restarts) {
  var best = Infinity, bestDesc = "";
  var lp = B.lpA(n, 1, m, "A")[4];
  for (var d = n - 1; d <= depthMax; d++) for (var rs = 0; rs < restarts; rs++) {
    // thứ tự đón: người 1..n−1 lặp vòng, đôi khi đổi
    var seq = []; for (var i = 0; i <= d; i++) seq.push(1 + (i % (n - 1)));
    if (rnd() < 0.5) for (var s = 0; s < seq.length; s++) if (rnd() < 0.3) seq[s] = 1 + Math.floor(rnd() * (n - 1));
    var xs = []; for (var j = 0; j < d; j++) xs.push([1 + Math.floor(rnd() * (G - 1)), G]);
    var usePark = rnd() < 0.5, park = usePark ? { y: [1 + Math.floor(rnd() * (G - 1)), G], a: 1 + Math.floor(rnd() * (n - 1)), b: 1 + Math.floor(rnd() * (n - 1)) } : null;
    if (park && park.a === park.b) park.b = null;
    var cur = evalP(n, m, seq, xs, park);
    for (var pass = 0; pass < 40; pass++) {
      var improved = false;
      for (var q = 0; q < xs.length + (park ? 1 : 0); q++) for (var dir = -1; dir <= 1; dir += 2) for (var step = 1; step <= 4; step *= 2) {
        var xs2 = xs.map(function (e) { return e.slice(); }), park2 = park ? { y: park.y.slice(), a: park.a, b: park.b } : null;
        if (q < xs.length) xs2[q][0] = Math.max(1, Math.min(G, xs2[q][0] + dir * step)); else park2.y[0] = Math.max(1, Math.min(G, park2.y[0] + dir * step));
        var v = evalP(n, m, seq, xs2, park2);
        if (v < cur - 1e-15) { cur = v; xs = xs2; park = park2; improved = true; }
      }
      if (!improved) break;
    }
    if (cur < best) { best = cur; bestDesc = "đón " + JSON.stringify(seq) + " thả " + JSON.stringify(xs.map(function (e) { return e[0] + "/" + e[1]; })) + (park ? " bỏ xe tại " + park.y[0] + "/" + park.y[1] + " cho " + park.a + (park.b != null ? "," + park.b : "") : ""); }
  }
  var cf = B.TA(n, 1, m);
  console.log("n=" + n + " k=1 m=" + m + ": tốt nhất tìm được " + best.toFixed(5) + " | cận dưới LP " + lp.toFixed(5) + " | đưa-đón " + B.TshuttleR(n - 1, m).toFixed(5) + " | tiếp sức " + B.TrelayR(n, 1, m).toFixed(5) + (best < lp - 1e-12 ? "  ✗ THẤP HƠN LP!" : "") + "\n     " + bestDesc);
}




search(5, 2, 48, 7, 150);
search(3, 4, 48, 5, 120);
