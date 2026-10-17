/* graph.js — xếp nút đồ thị (Fruchterman–Reingold + lưới không gian) và hình học nhìn/chạm. Thuần: chạy được trong Web Worker và trong node.

   init(nodes, edges, {centerIndex})  → state     nút đặt ban đầu XÁC ĐỊNH theo id (cùng dữ liệu → cùng bố cục), nút trung tâm ở gốc
   run(state, iterations)             → chuyển động trung bình còn lại (cho biết đã yên chưa)
   Đẩy nhau chỉ tính trong bán kính 4·k nhờ lưới ô vuông ⇒ ~O(n) thay vì O(n²); đủ mượt cho vài nghìn nút.
   view: {x, y, k} = toạ độ góc (tâm màn hình) và tỉ lệ; toWorld/toScreen/fit/hit dùng chung cho chuột, cảm ứng và vẽ. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  if (!W.text && typeof require === "function") require("./text.js");

  var K = 64;                                    // độ dài cạnh lý tưởng (đơn vị thế giới)

  function init(nodes, edges, o) {
    o = o || {};
    var n = nodes.length, s = { n: n, x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), deg: new Int32Array(n), ea: new Int32Array(edges.length), eb: new Int32Array(edges.length), pinned: -1, iter: 0, k: K };
    var idx = {};
    nodes.forEach(function (nd, i) { idx[nd.n] = i; });
    var m = 0;
    edges.forEach(function (e) {
      var a = idx[e.a], b = idx[e.b];
      if (a === undefined || b === undefined || a === b) return;
      s.ea[m] = a; s.eb[m] = b; m++; s.deg[a]++; s.deg[b]++;
    });
    s.m = m;
    var spread = K * Math.sqrt(Math.max(n, 1)) * 0.9;
    nodes.forEach(function (nd, i) {
      var h = W.text.hash53(String(nd.id || nd.n)), a = parseInt(h.slice(0, 7), 16) / 0xFFFFFFF * Math.PI * 2, r = (parseInt(h.slice(7, 14), 16) / 0xFFFFFFF) * spread;
      s.x[i] = Math.cos(a) * r; s.y[i] = Math.sin(a) * r;
    });
    if (o.centerIndex >= 0 && o.centerIndex < n) { s.pinned = o.centerIndex; s.x[s.pinned] = 0; s.y[s.pinned] = 0; }
    return s;
  }

  function run(s, iterations) {
    var n = s.n, k = s.k, cell = 4 * k, cutoff2 = cell * cell, move = 0;
    for (var it = 0; it < iterations; it++) {
      var temp = Math.max(0.02, 1 - s.iter / 400) * k * 0.6, i, j;
      s.iter++;
      var fx = new Float64Array(n), fy = new Float64Array(n), grid = new Map();
      for (i = 0; i < n; i++) {
        var key = Math.floor(s.x[i] / cell) * 100003 + Math.floor(s.y[i] / cell), g = grid.get(key);
        if (!g) grid.set(key, g = []);
        g.push(i);
      }
      for (i = 0; i < n; i++) {
        var cx = Math.floor(s.x[i] / cell), cy = Math.floor(s.y[i] / cell);
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          var cellList = grid.get((cx + dx) * 100003 + (cy + dy));
          if (!cellList) continue;
          for (var q = 0; q < cellList.length; q++) {
            j = cellList[q];
            if (j <= i) continue;
            var ddx = s.x[i] - s.x[j], ddy = s.y[i] - s.y[j], d2 = ddx * ddx + ddy * ddy;
            if (d2 > cutoff2) continue;
            if (d2 < 0.01) { ddx = ((i * 7919) % 13) - 6 || 1; ddy = ((j * 104729) % 11) - 5 || 1; d2 = ddx * ddx + ddy * ddy; }
            var d = Math.sqrt(d2), f = (k * k) / d / d;          // lực đẩy ∝ k²/d, chia d để chuẩn hoá vectơ
            fx[i] += ddx * f; fy[i] += ddy * f; fx[j] -= ddx * f; fy[j] -= ddy * f;
          }
        }
      }
      for (var e = 0; e < s.m; e++) {
        var a = s.ea[e], b = s.eb[e], ex = s.x[a] - s.x[b], ey = s.y[a] - s.y[b], ed = Math.sqrt(ex * ex + ey * ey) || 0.01, fa = ed / k;     // lực kéo ∝ d²/k, chia d
        fx[a] -= ex * fa; fy[a] -= ey * fa; fx[b] += ex * fa; fy[b] += ey * fa;
      }
      move = 0;
      for (i = 0; i < n; i++) {
        fx[i] -= s.x[i] * 0.012; fy[i] -= s.y[i] * 0.012;        // hút nhẹ về gốc để các thành phần rời không trôi mất
        var len = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 0.0001, step = Math.min(len, temp);
        if (i === s.pinned) continue;
        s.x[i] += fx[i] / len * step; s.y[i] += fy[i] / len * step; move += step;
      }
      move = n ? move / n : 0;
    }
    return move;
  }

  /** Khung nhìn vừa khít mọi nút trong w×h (chừa lề). */
  function fit(s, w, h, pad) {
    pad = pad == null ? 48 : pad;
    if (!s.n) return { x: 0, y: 0, k: 1 };
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (var i = 0; i < s.n; i++) { x0 = Math.min(x0, s.x[i]); x1 = Math.max(x1, s.x[i]); y0 = Math.min(y0, s.y[i]); y1 = Math.max(y1, s.y[i]); }
    var gw = Math.max(x1 - x0, 1), gh = Math.max(y1 - y0, 1), k = Math.min((w - pad * 2) / gw, (h - pad * 2) / gh, 2.5);
    return { x: w / 2 - (x0 + gw / 2) * k, y: h / 2 - (y0 + gh / 2) * k, k: Math.max(k, 0.02) };
  }
  function toScreen(v, x, y) { return [x * v.k + v.x, y * v.k + v.y]; }
  function toWorld(v, sx, sy) { return [(sx - v.x) / v.k, (sy - v.y) / v.k]; }
  /** Zoom quanh điểm màn hình (sx, sy): điểm đó đứng yên. */
  function zoomAt(v, sx, sy, factor) {
    var nk = Math.min(8, Math.max(0.03, v.k * factor)), r = nk / v.k;
    return { x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r, k: nk };
  }
  /** Bán kính vẽ của nút theo bậc (đơn vị màn hình, trước khi nhân zoom): 5 … 16. */
  function radius(deg) { return Math.min(16, 5 + Math.sqrt(deg) * 2.2); }
  /** Nút trúng tại điểm màn hình (sx, sy), -1 nếu không. Ưu tiên nút gần tâm nhất; vùng chạm tối thiểu `slop` px cho ngón tay. */
  function hit(s, v, sx, sy, slop) {
    slop = slop == null ? 6 : slop;
    var best = -1, bd = Infinity;
    for (var i = 0; i < s.n; i++) {
      var p = toScreen(v, s.x[i], s.y[i]), dx = p[0] - sx, dy = p[1] - sy, d = dx * dx + dy * dy, r = radius(s.deg[i]) + slop;
      if (d <= r * r && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  W.graph = { init: init, run: run, fit: fit, toScreen: toScreen, toWorld: toWorld, zoomAt: zoomAt, radius: radius, hit: hit, K: K };
  if (typeof module !== "undefined" && module.exports) module.exports = W.graph;
})(typeof globalThis !== "undefined" ? globalThis : this);
