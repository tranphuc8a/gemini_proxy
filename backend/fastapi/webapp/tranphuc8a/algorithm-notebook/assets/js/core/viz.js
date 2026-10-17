/* core/viz.js — các thuật toán trực quan hoá dạng BƯỚC (thuần, không chạm DOM; ui/vizview.js vẽ).
   Mỗi viz: { id, title, kind: "graph"|"rows"|"table"|"tree", blurb, presets: [{name, text}], parse(text) → {params} | {error}, run(params) → {steps, result} }.
   Mỗi bước: { msg, … } theo kind:
     graph  { nodes: [{s: idle|front|cur|done, v}], edges: [idle|try|use], info: [[nhãn, chữ]] }  + định nghĩa đồ thị trong params.graph = {n, edges: [{a,b,w}], directed, weighted}
     rows   { rows: [{label, cells: [{v, s}], marks: {chỉ số: nhãn}}] }       s: idle|cur|range|found|dim|use
     table  { cols: [nhãn], rowsLabels: [nhãn], cells: [[{v, s}]] }
     tree   { nodes: [{v, label, s}] }   (cây nhị phân đủ tầng, chỉ số kiểu heap 1..2^k-1)
   `result` để test đối chiếu với cách tính trực tiếp (kiem.js). Giới hạn kích thước nhập để luôn nhanh và vẽ vừa màn hình. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var MAX_STEPS = 600, INF = Infinity;

  function fail(m) { return { error: m }; }
  function ints(line) { return line.trim().split(/\s+/).filter(Boolean).map(function (x) { return /^-?\d+$/.test(x) ? parseInt(x, 10) : NaN; }); }
  function lines(text) { return String(text || "").split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== "#"; }); }
  function show(x) { return x === INF ? "∞" : String(x); }

  // ---------------------------------------------------------------------------------------------- đồ thị dùng chung
  /** Dòng đầu "n m [nguồn]"; m dòng "u v [w]" (đỉnh đánh số từ 1). */
  function parseGraph(text, o) {
    var ls = lines(text); if (!ls.length) return fail("Nhập đồ thị: dòng đầu \"n m" + (o.source ? " nguồn" : "") + "\", rồi m dòng \"u v" + (o.weighted ? " w" : "") + "\".");
    var h = ints(ls[0]), n = h[0], m = h[1], s = o.source ? h[2] : 1;
    if (!(n >= 1 && n <= 12)) return fail("Số đỉnh phải từ 1 tới 12.");
    if (!(m >= 0 && m <= 30) || ls.length - 1 < m) return fail("Số cạnh phải từ 0 tới 30 và đủ " + m + " dòng cạnh.");
    if (o.source && !(s >= 1 && s <= n)) return fail("Đỉnh nguồn phải trong 1.." + n + ".");
    var edges = [];
    for (var i = 1; i <= m; i++) {
      var e = ints(ls[i]), a = e[0], b = e[1], w = o.weighted ? e[2] : 1;
      if (!(a >= 1 && a <= n && b >= 1 && b <= n) || a === b) return fail("Cạnh dòng " + (i + 1) + ": hai đỉnh phải khác nhau và trong 1.." + n + ".");
      if (o.weighted && !(w >= -99 && w <= 99)) return fail("Trọng số cạnh dòng " + (i + 1) + " phải là số nguyên từ -99 tới 99.");
      if (o.weighted && !o.allowNeg && w < 0) return fail("Thuật toán này không dùng được cạnh âm (thử Bellman-Ford).");
      edges.push({ a: a - 1, b: b - 1, w: w });
    }
    return { params: { graph: { n: n, edges: edges, directed: !!o.directed, weighted: !!o.weighted }, s: s - 1 } };
  }
  function adjacency(g) {
    var adj = []; for (var i = 0; i < g.n; i++) adj.push([]);
    g.edges.forEach(function (e, k) { adj[e.a].push({ v: e.b, w: e.w, k: k }); if (!g.directed) adj[e.b].push({ v: e.a, w: e.w, k: k }); });
    return adj;
  }
  /** Bộ chụp trạng thái đồ thị: gọi snap(msg, info) để thêm bước. */
  function graphRec(g) {
    var node = [], edge = [], steps = [], i;
    for (i = 0; i < g.n; i++) node.push({ s: "idle", v: "" });
    for (i = 0; i < g.edges.length; i++) edge.push("idle");
    return {
      node: node, edge: edge, steps: steps,
      snap: function (msg, info) { if (steps.length < MAX_STEPS) steps.push({ msg: msg, nodes: node.map(function (x) { return { s: x.s, v: x.v }; }), edges: edge.slice(), info: info || [] }); },
      clearEdges: function () { for (var k = 0; k < edge.length; k++) edge[k] = "idle"; }
    };
  }
  var NAME = function (i) { return String.fromCharCode(65 + i); };      // đỉnh 0 → "A"

  // ---------------------------------------------------------------------------------------------- BFS
  function bfs(p) {
    var g = p.graph, adj = adjacency(g), r = graphRec(g), dist = [], q = [p.s], i;
    for (i = 0; i < g.n; i++) dist.push(INF);
    dist[p.s] = 0; r.node[p.s].s = "front"; r.node[p.s].v = "0";
    var info = function () { return [["Hàng đợi", q.map(NAME).join(" → ") || "(rỗng)"], ["dist", dist.map(function (d, k) { return NAME(k) + "=" + show(d); }).join("  ")]]; };
    r.snap("Bắt đầu: dist[" + NAME(p.s) + "] = 0, đưa " + NAME(p.s) + " vào hàng đợi.", info());
    while (q.length) {
      var u = q.shift(); r.node[u].s = "cur"; r.clearEdges();
      r.snap("Lấy " + NAME(u) + " ra khỏi hàng đợi (dist = " + dist[u] + "). Xét các láng giềng.", info());
      adj[u].forEach(function (x) {
        if (dist[x.v] === INF) { dist[x.v] = dist[u] + 1; q.push(x.v); r.node[x.v].s = "front"; r.node[x.v].v = String(dist[x.v]); r.edge[x.k] = "use"; r.snap("Gặp " + NAME(x.v) + " lần đầu: dist[" + NAME(x.v) + "] = " + dist[x.v] + ", đưa vào hàng đợi.", info()); }
        else { r.edge[x.k] = "try"; r.snap(NAME(x.v) + " đã được thăm — bỏ qua.", info()); }
      });
      r.node[u].s = "done"; r.clearEdges();
    }
    r.snap("Xong: hàng đợi rỗng. dist là số cạnh ít nhất từ " + NAME(p.s) + ".", info());
    return { steps: r.steps, result: { dist: dist } };
  }

  // ---------------------------------------------------------------------------------------------- DFS
  function dfs(p) {
    var g = p.graph, adj = adjacency(g), r = graphRec(g), tin = [], tout = [], t = 0, order = [], i;
    for (i = 0; i < g.n; i++) { tin.push(0); tout.push(0); }
    var info = function () { return [["Thứ tự vào", order.map(NAME).join(" → ")], ["tin/tout", tin.map(function (a, k) { return NAME(k) + "=" + (a ? a : "·") + "/" + (tout[k] ? tout[k] : "·"); }).join("  ")]]; };
    r.snap("Bắt đầu DFS từ " + NAME(p.s) + ".", info());
    (function visit(u, via) {
      tin[u] = ++t; order.push(u); r.node[u].s = "cur"; r.node[u].v = String(tin[u]);
      if (via >= 0) r.edge[via] = "use";
      r.snap("Vào " + NAME(u) + " (tin = " + tin[u] + ").", info());
      adj[u].forEach(function (x) {
        if (!tin[x.v]) { visit(x.v, x.k); r.node[u].s = "cur"; r.snap("Quay về " + NAME(u) + ", xét tiếp láng giềng.", info()); }
        else { if (r.edge[x.k] === "idle") r.edge[x.k] = "try"; r.snap(NAME(x.v) + " đã thăm — bỏ qua.", info()); }
      });
      tout[u] = ++t; r.node[u].s = "done"; r.node[u].v = tin[u] + "/" + tout[u];
      r.snap("Ra khỏi " + NAME(u) + " (tout = " + tout[u] + ") — đã duyệt hết nhánh con.", info());
    })(p.s, -1);
    r.snap("Xong: các đỉnh tới được từ " + NAME(p.s) + " đều đã thăm.", info());
    return { steps: r.steps, result: { order: order, tin: tin, tout: tout } };
  }

  // ---------------------------------------------------------------------------------------------- Dijkstra
  function dijkstra(p) {
    var g = p.graph, adj = adjacency(g), r = graphRec(g), dist = [], pq = [[0, p.s]], i;
    for (i = 0; i < g.n; i++) dist.push(INF);
    dist[p.s] = 0; r.node[p.s].s = "front"; r.node[p.s].v = "0";
    var info = function () { return [["Heap (d, đỉnh)", pq.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).map(function (x) { return "(" + x[0] + "," + NAME(x[1]) + ")"; }).join(" ") || "(rỗng)"], ["dist", dist.map(function (d, k) { return NAME(k) + "=" + show(d); }).join("  ")]]; };
    r.snap("Bắt đầu: dist[" + NAME(p.s) + "] = 0, đẩy (0, " + NAME(p.s) + ") vào heap.", info());
    while (pq.length) {
      pq.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var top = pq.shift(), d = top[0], u = top[1];
      if (d > dist[u]) { r.snap("Lấy (" + d + ", " + NAME(u) + ") nhưng dist[" + NAME(u) + "] = " + dist[u] + " < " + d + ": bản ghi cũ, bỏ qua.", info()); continue; }
      r.node[u].s = "cur"; r.clearEdges();
      r.snap("Lấy đỉnh có dist nhỏ nhất: " + NAME(u) + " (dist = " + d + "). Chốt khoảng cách của " + NAME(u) + ", relax các cạnh đi ra.", info());
      adj[u].forEach(function (x) {
        if (dist[u] + x.w < dist[x.v]) {
          dist[x.v] = dist[u] + x.w; pq.push([dist[x.v], x.v]); r.edge[x.k] = "use"; if (r.node[x.v].s === "idle") r.node[x.v].s = "front"; r.node[x.v].v = String(dist[x.v]);
          r.snap("Relax " + NAME(u) + "→" + NAME(x.v) + " (w = " + x.w + "): " + (dist[u]) + " + " + x.w + " = " + dist[x.v] + " < dist cũ → cập nhật dist[" + NAME(x.v) + "] = " + dist[x.v] + ".", info());
        } else { r.edge[x.k] = "try"; r.snap("Cạnh " + NAME(u) + "→" + NAME(x.v) + " (w = " + x.w + "): " + dist[u] + " + " + x.w + " = " + (dist[u] + x.w) + " không nhỏ hơn dist[" + NAME(x.v) + "] = " + show(dist[x.v]) + " — bỏ qua.", info()); }
      });
      r.node[u].s = "done"; r.clearEdges();
    }
    r.snap("Xong: heap rỗng. dist là khoảng cách ngắn nhất từ " + NAME(p.s) + " tới mọi đỉnh (∞ = không tới được).", info());
    return { steps: r.steps, result: { dist: dist } };
  }

  // ---------------------------------------------------------------------------------------------- Bellman-Ford
  function bellmanFord(p) {
    var g = p.graph, r = graphRec(g), dist = [], i;
    for (i = 0; i < g.n; i++) dist.push(INF);
    dist[p.s] = 0; r.node[p.s].s = "cur"; r.node[p.s].v = "0";
    var info = function () { return [["dist", dist.map(function (d, k) { return NAME(k) + "=" + show(d); }).join("  ")]]; };
    r.snap("Bắt đầu: dist[" + NAME(p.s) + "] = 0, các đỉnh khác = ∞. Sẽ relax MỌI cạnh, lặp tối đa V−1 = " + (g.n - 1) + " vòng.", info());
    var negCycle = false, round;
    for (round = 1; round <= g.n; round++) {
      var changed = false;
      for (var k = 0; k < g.edges.length; k++) {
        var e = g.edges[k]; r.clearEdges();
        if (dist[e.a] !== INF && dist[e.a] + e.w < dist[e.b]) {
          dist[e.b] = dist[e.a] + e.w; changed = true; r.edge[k] = "use"; r.node[e.b].v = String(dist[e.b]); if (r.node[e.b].s === "idle") r.node[e.b].s = "front";
          r.snap("Vòng " + round + ", cạnh " + NAME(e.a) + "→" + NAME(e.b) + " (w = " + e.w + "): relax được → dist[" + NAME(e.b) + "] = " + dist[e.b] + (round === g.n ? "  ⚠ vòng thứ V vẫn relax được" : "") + ".", info());
          if (round === g.n) negCycle = true;
        } else { r.edge[k] = "try"; r.snap("Vòng " + round + ", cạnh " + NAME(e.a) + "→" + NAME(e.b) + " (w = " + e.w + "): " + (dist[e.a] === INF ? NAME(e.a) + " chưa tới được" : "không cải thiện") + ".", info()); }
      }
      r.clearEdges();
      if (!changed) { r.snap("Vòng " + round + " không đổi gì → dừng sớm, kết quả đã ổn định.", info()); break; }
      if (round === g.n - 1) r.snap("Hết V−1 vòng. Thử thêm một vòng nữa: nếu còn relax được thì có chu trình âm.", info());
    }
    r.snap(negCycle ? "Có CHU TRÌNH ÂM tới được từ nguồn: khoảng cách ngắn nhất không xác định." : "Không có chu trình âm: dist là khoảng cách ngắn nhất từ " + NAME(p.s) + ".", info());
    return { steps: r.steps, result: { dist: dist, negCycle: negCycle } };
  }

  // ---------------------------------------------------------------------------------------------- Sắp xếp topo (Kahn)
  function topo(p) {
    var g = p.graph, adj = adjacency(g), r = graphRec(g), indeg = [], q = [], order = [], i;
    for (i = 0; i < g.n; i++) indeg.push(0);
    g.edges.forEach(function (e) { indeg[e.b]++; });
    for (i = 0; i < g.n; i++) { r.node[i].v = String(indeg[i]); if (!indeg[i]) { q.push(i); r.node[i].s = "front"; } }
    var info = function () { return [["Hàng đợi (bậc vào 0)", q.map(NAME).join(" → ") || "(rỗng)"], ["Thứ tự topo", order.map(NAME).join(" → ") || "—"]]; };
    r.snap("Tính bậc vào của mỗi đỉnh (số ghi trong nút). Đỉnh có bậc vào 0 không phụ thuộc ai → vào hàng đợi.", info());
    while (q.length) {
      var u = q.shift(); order.push(u); r.node[u].s = "cur"; r.clearEdges();
      r.snap("Lấy " + NAME(u) + " ra, đặt vào thứ tự topo. \"Xoá\" các cạnh đi ra khỏi " + NAME(u) + ".", info());
      adj[u].forEach(function (x) {
        indeg[x.v]--; r.node[x.v].v = String(indeg[x.v]); r.edge[x.k] = "use";
        if (!indeg[x.v]) { q.push(x.v); r.node[x.v].s = "front"; r.snap("Bậc vào của " + NAME(x.v) + " giảm còn 0 → vào hàng đợi.", info()); }
        else r.snap("Bậc vào của " + NAME(x.v) + " giảm còn " + indeg[x.v] + ".", info());
      });
      r.node[u].s = "done"; r.clearEdges();
    }
    r.snap(order.length === g.n ? "Xong: mọi đỉnh đã được xếp — thứ tự hợp lệ." : "Còn " + (g.n - order.length) + " đỉnh không bao giờ có bậc vào 0 → đồ thị CÓ CHU TRÌNH, không có thứ tự topo.", info());
    return { steps: r.steps, result: { order: order, cycle: order.length !== g.n } };
  }

  // ---------------------------------------------------------------------------------------------- DSU
  function parseOps(text, n, kinds) {
    var ops = [], ls = lines(text).slice(1);
    for (var i = 0; i < ls.length; i++) {
      var w = ls[i].split(/\s+/), kind = w[0].toLowerCase(), want = kinds[kind];
      if (!want) return fail("Dòng " + (i + 2) + ": thao tác phải là " + Object.keys(kinds).join(" / ") + ".");
      var args = w.slice(1).map(function (x) { return /^[+-]?\d+$/.test(x) ? parseInt(x, 10) : NaN; });
      if (args.length !== want.length || args.some(function (x, k) { return !(x >= want[k][0] && x <= want[k][1](n)); })) return fail("Dòng " + (i + 2) + ": \"" + kind + "\" cần " + want.length + " số hợp lệ.");
      ops.push({ kind: kind, args: args });
    }
    if (ops.length > 12) return fail("Tối đa 12 thao tác.");
    return ops;
  }
  var nIdx = function (n) { return n; };
  function dsuParse(text) {
    var ls = lines(text), n = ints(ls[0] || "")[0];
    if (!(n >= 2 && n <= 12)) return fail("Dòng đầu: số phần tử n (2..12), các dòng sau: union a b / find a (phần tử đánh số 1..n).");
    var ops = parseOps(text, n, { union: [[1, nIdx], [1, nIdx]], find: [[1, nIdx]] });
    return ops.error ? ops : { params: { n: n, ops: ops } };
  }
  function dsu(p) {
    var n = p.n, par = [], sz = [], steps = [], i;
    for (i = 0; i < n; i++) { par.push(i); sz.push(1); }
    var snap = function (msg, hi, kind) {
      if (steps.length >= MAX_STEPS) return;
      var idx = [], parr = [], szr = [];
      for (var k = 0; k < n; k++) { var s = hi && hi.indexOf(k) !== -1 ? (kind || "cur") : par[k] === k ? "found" : "idle"; idx.push({ v: k + 1, s: "idle" }); parr.push({ v: par[k] + 1, s: s }); szr.push({ v: par[k] === k ? sz[k] : "·", s: par[k] === k ? "found" : "dim" }); }
      steps.push({ msg: msg, rows: [{ label: "phần tử", cells: idx, marks: {} }, { label: "cha (parent)", cells: parr, marks: {} }, { label: "kích thước gốc", cells: szr, marks: {} }] });
    };
    var find = function (x, doSteps) {
      var path = [x], cur = x;
      while (par[cur] !== cur) { cur = par[cur]; path.push(cur); }
      if (doSteps) snap("find(" + (x + 1) + "): đi từ " + (x + 1) + " lên cha tới gốc " + (cur + 1) + " (đường: " + path.map(function (v) { return v + 1; }).join(" → ") + ").", path, "range");
      path.forEach(function (v) { par[v] = cur; });
      if (doSteps && path.length > 2) snap("Nén đường đi: mọi đỉnh trên đường trỏ thẳng về gốc " + (cur + 1) + " — lần find sau gần như O(1).", path, "use");
      return cur;
    };
    snap("Khởi tạo: mỗi phần tử là một tập riêng (cha của chính nó, kích thước 1).");
    var results = [];
    p.ops.forEach(function (op) {
      if (op.kind === "find") { var rt = find(op.args[0] - 1, true); results.push(rt + 1); }
      else {
        var a = find(op.args[0] - 1, false), b = find(op.args[1] - 1, false);
        if (a === b) { snap("union(" + op.args[0] + ", " + op.args[1] + "): cùng một tập (gốc " + (a + 1) + ") — không làm gì.", [a]); return; }
        if (sz[a] < sz[b]) { var t = a; a = b; b = t; }
        par[b] = a; sz[a] += sz[b];
        snap("union(" + op.args[0] + ", " + op.args[1] + "): gốc " + (b + 1) + " (nhỏ hơn) gắn vào gốc " + (a + 1) + "; kích thước mới = " + sz[a] + ".", [a, b], "use");
      }
    });
    snap("Xong. Các ô \"kích thước gốc\" có số là gốc của từng tập.");
    return { steps: steps, result: { parent: par.slice(), finds: results } };
  }

  // ---------------------------------------------------------------------------------------------- Fenwick
  function fenwickParse(text) {
    var ls = lines(text), a = ints(ls[0] || "");
    if (a.length < 2 || a.length > 16 || a.some(function (x) { return !(x >= -99 && x <= 99); })) return fail("Dòng đầu: dãy 2..16 số nguyên (−99..99). Các dòng sau: update i d / query i / range l r.");
    var n = a.length, ops = parseOps(text, n, { update: [[1, nIdx], [-99, function () { return 99; }]], query: [[1, nIdx]], range: [[1, nIdx], [1, nIdx]] });
    if (ops.error) return ops;
    if (ops.some(function (o) { return o.kind === "range" && o.args[0] > o.args[1]; })) return fail("range l r cần l ≤ r.");
    return { params: { a: a, ops: ops } };
  }
  function fenwick(p) {
    var n = p.a.length, bit = [], arr = p.a.slice(), steps = [], i;
    for (i = 0; i <= n; i++) bit.push(0);
    var snap = function (msg, hi, marks, kind) {
      if (steps.length >= MAX_STEPS) return;
      var idx = [], av = [], tv = [];
      for (var k = 1; k <= n; k++) { idx.push({ v: k, s: "idle" }); av.push({ v: arr[k - 1], s: "idle" }); tv.push({ v: bit[k], s: hi && hi.indexOf(k) !== -1 ? (kind || "cur") : "idle" }); }
      steps.push({ msg: msg, rows: [{ label: "chỉ số i", cells: idx, marks: {} }, { label: "a[i]", cells: av, marks: {} }, { label: "tree[i] (tổng " + "(i − lowbit(i), i])", cells: tv, marks: marks || {} }] });
    };
    var add = function (pos, d, show) {
      var path = [];
      for (var x = pos; x <= n; x += x & -x) { bit[x] += d; path.push(x); }
      if (show) snap("update(" + pos + ", " + (d >= 0 ? "+" : "") + d + "): cộng vào tree[" + path.join("], tree[") + "] — mỗi lần nhảy i += lowbit(i).", path, {}, "use");
    };
    var sum = function (pos, show) {
      var s = 0, path = [];
      for (var x = pos; x > 0; x -= x & -x) { s += bit[x]; path.push(x); }
      if (show) snap("query(" + pos + "): cộng tree[" + path.join("] + tree[") + "] = " + s + " — mỗi lần nhảy i −= lowbit(i).", path, {}, "range");
      return s;
    };
    for (i = 1; i <= n; i++) add(i, arr[i - 1], false);
    snap("Xây cây Fenwick từ dãy: tree[i] giữ tổng của lowbit(i) phần tử kết thúc ở i.");
    var results = [];
    p.ops.forEach(function (op) {
      if (op.kind === "update") { arr[op.args[0] - 1] += op.args[1]; add(op.args[0], op.args[1], true); }
      else if (op.kind === "query") { var s = sum(op.args[0], true); results.push(s); snap("Tổng tiền tố a[1.." + op.args[0] + "] = " + s + "."); }
      else { var hi = sum(op.args[1], true), lo = sum(op.args[0] - 1, true); results.push(hi - lo); snap("range(" + op.args[0] + ", " + op.args[1] + ") = query(" + op.args[1] + ") − query(" + (op.args[0] - 1) + ") = " + hi + " − " + lo + " = " + (hi - lo) + "."); }
    });
    return { steps: steps, result: { tree: bit.slice(1), a: arr.slice(), answers: results } };
  }

  // ---------------------------------------------------------------------------------------------- Segment Tree (tổng)
  function segParse(text) {
    var ls = lines(text), a = ints(ls[0] || "");
    if (a.length < 2 || a.length > 8 || a.some(function (x) { return !(x >= -99 && x <= 99); })) return fail("Dòng đầu: dãy 2..8 số nguyên (−99..99). Các dòng sau: update i v / query l r (đánh số từ 1).");
    var ops = parseOps(text, a.length, { update: [[1, nIdx], [-99, function () { return 99; }]], query: [[1, nIdx], [1, nIdx]] });
    if (ops.error) return ops;
    if (ops.some(function (o) { return o.kind === "query" && o.args[0] > o.args[1]; })) return fail("query l r cần l ≤ r.");
    return { params: { a: a, ops: ops } };
  }
  function segTree(p) {
    var n = p.a.length, size = 1; while (size < n) size <<= 1;
    var val = [], lo = [], hi = [], steps = [], i;
    for (i = 0; i < 2 * size; i++) { val.push(0); lo.push(0); hi.push(-1); }
    (function build(x, l, r) { lo[x] = l; hi[x] = r; if (l === r) { val[x] = l < n ? p.a[l] : 0; return; } var m = (l + r) >> 1; build(2 * x, l, m); build(2 * x + 1, m + 1, r); val[x] = val[2 * x] + val[2 * x + 1]; })(1, 0, size - 1);
    var snap = function (msg, st) {
      if (steps.length >= MAX_STEPS) return;
      var nodes = []; for (var x = 1; x < 2 * size; x++) nodes.push({ v: val[x], label: lo[x] === hi[x] ? String(lo[x] + 1) : (lo[x] + 1) + ".." + (hi[x] + 1), s: (st && st[x]) || "idle", pad: lo[x] >= n });
      steps.push({ msg: msg, nodes: nodes });
    };
    snap("Xây cây: mỗi nút lưu TỔNG của đoạn nó phụ trách (nhãn là đoạn chỉ số); nút lá là phần tử gốc. " + (size > n ? "Phần đệm bằng 0 để đủ tầng." : ""));
    var results = [];
    p.ops.forEach(function (op) {
      if (op.kind === "update") {
        var pos = op.args[0] - 1, st = {}, x = 1, path = [];
        for (;;) { path.push(x); if (lo[x] === hi[x]) break; var m = (lo[x] + hi[x]) >> 1; x = pos <= m ? 2 * x : 2 * x + 1; }
        path.forEach(function (y) { st[y] = "cur"; });
        snap("update(" + op.args[0] + ", " + op.args[1] + "): đi từ gốc xuống lá " + op.args[0] + " (các nút sẽ phải tính lại).", st);
        val[path[path.length - 1]] = op.args[1];
        for (var k = path.length - 2; k >= 0; k--) val[path[k]] = val[2 * path[k]] + val[2 * path[k] + 1];
        path.forEach(function (y) { st[y] = "use"; });
        snap("Gán lá = " + op.args[1] + " rồi tính lại tổng ngược lên gốc: chỉ O(log N) nút thay đổi.", st);
      } else {
        var l0 = op.args[0] - 1, r0 = op.args[1] - 1, st2 = {}, total = 0;
        (function q(x) {
          if (hi[x] < l0 || lo[x] > r0) { st2[x] = "dim"; return; }
          if (l0 <= lo[x] && hi[x] <= r0) { st2[x] = "use"; total += val[x]; return; }
          st2[x] = "cur"; q(2 * x); q(2 * x + 1);
        })(1);
        snap("query(" + op.args[0] + ", " + op.args[1] + "): nút nằm TRỌN trong đoạn (xanh) thì lấy luôn tổng, nằm ngoài (mờ) thì bỏ, cắt một phần (vàng) thì chia đôi. Tổng = " + total + ".", st2);
        results.push(total);
      }
    });
    return { steps: steps, result: { answers: results, root: val[1] } };
  }

  // ---------------------------------------------------------------------------------------------- Tìm kiếm nhị phân (lower_bound)
  function bsParse(text) {
    var ls = lines(text), a = ints(ls[0] || ""), x = ints(ls[1] || "")[0];
    if (a.length < 1 || a.length > 16 || a.some(function (v) { return !(v >= -999 && v <= 999); })) return fail("Dòng 1: dãy 1..16 số nguyên (đã sắp xếp tăng). Dòng 2: giá trị cần tìm.");
    for (var i = 1; i < a.length; i++) if (a[i] < a[i - 1]) return fail("Dãy phải được sắp xếp tăng dần (tìm nhị phân chỉ đúng với dãy đã sắp xếp).");
    if (!(x >= -999 && x <= 999)) return fail("Dòng 2: giá trị cần tìm (số nguyên).");
    return { params: { a: a, x: x } };
  }
  function binarySearch(p) {
    var a = p.a, n = a.length, lo = 0, hi = n, steps = [];
    var snap = function (msg, mid, done) {
      var cells = a.map(function (v, k) { var s = done !== undefined ? (k === done && done < n && a[done] === p.x ? "found" : k < lo || k >= hi ? "dim" : "range") : k === mid ? "cur" : k >= lo && k < hi ? "range" : "dim"; return { v: v, s: s }; });
      var marks = {}; if (lo < n) marks[lo] = "lo"; if (hi < n) marks[hi] = (marks[hi] ? marks[hi] + "," : "") + "hi"; if (mid != null && mid < n) marks[mid] = (marks[mid] ? marks[mid] + "," : "") + "mid";
      steps.push({ msg: msg, rows: [{ label: "chỉ số", cells: a.map(function (_, k) { return { v: k, s: "idle" }; }), marks: {} }, { label: "a[i] (tìm " + p.x + ")", cells: cells, marks: marks }] });
    };
    snap("Tìm vị trí ĐẦU TIÊN có a[i] ≥ " + p.x + " (lower_bound) trong nửa đoạn [lo, hi) = [0, " + n + ").");
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      snap("lo = " + lo + ", hi = " + hi + ", mid = (lo + hi) / 2 = " + mid + ". So sánh a[" + mid + "] = " + a[mid] + " với " + p.x + ".", mid);
      if (a[mid] < p.x) { lo = mid + 1; snap("a[" + mid + "] = " + a[mid] + " < " + p.x + " → đáp án nằm bên phải mid: lo = mid + 1 = " + lo + ".", null); }
      else { hi = mid; snap("a[" + mid + "] = " + a[mid] + " ≥ " + p.x + " → mid có thể là đáp án, thu hẹp về bên trái: hi = mid = " + hi + ".", null); }
    }
    snap("lo = hi = " + lo + ": " + (lo < n ? "a[" + lo + "] = " + a[lo] + " là phần tử đầu tiên ≥ " + p.x + (a[lo] === p.x ? " (đúng bằng giá trị cần tìm)." : " (không có phần tử bằng).") : "mọi phần tử đều < " + p.x + " → vị trí chèn là " + n + "."), null, lo);
    return { steps: steps, result: { index: lo, found: lo < n && a[lo] === p.x } };
  }

  // ---------------------------------------------------------------------------------------------- KMP
  function kmpParse(text) {
    var ls = lines(text), t = ls[0] || "", pat = ls[1] || "";
    if (!/^[A-Za-z0-9]{1,24}$/.test(t) || !/^[A-Za-z0-9]{1,10}$/.test(pat)) return fail("Dòng 1: văn bản (chữ + số, ≤ 24 ký tự). Dòng 2: mẫu (≤ 10 ký tự).");
    if (pat.length > t.length) return fail("Mẫu không được dài hơn văn bản.");
    return { params: { t: t, p: pat } };
  }
  function kmp(p) {
    var t = p.t, pat = p.p, m = pat.length, n = t.length, pi = [], steps = [], i, k;
    for (i = 0; i < m; i++) pi.push(0);
    var cells = function (str, hi, st) { return str.split("").map(function (c, x) { return { v: c, s: hi && hi[x] ? hi[x] : st || "idle" }; }); };
    var snapPi = function (msg, cur, from) {
      var hi = {}; if (cur != null) hi[cur] = "cur"; if (from != null) hi[from] = "range";
      steps.push({ msg: msg, rows: [{ label: "mẫu", cells: cells(pat, hi), marks: {} }, { label: "π (tiền tố = hậu tố dài nhất)", cells: pi.map(function (v, x) { return { v: x <= (cur == null ? m : cur) ? v : "·", s: x === cur ? "cur" : "idle" }; }), marks: {} }] });
    };
    snapPi("Bước 1 — hàm tiền tố π: π[i] = độ dài lớn nhất của tiền tố của mẫu cũng là hậu tố của pat[0..i] (không tính cả xâu). π[0] = 0.", 0, null);
    for (i = 1, k = 0; i < m; i++) {
      while (k > 0 && pat[i] !== pat[k]) { snapPi("i = " + i + ": pat[" + i + "] = '" + pat[i] + "' ≠ pat[" + k + "] = '" + pat[k] + "' → lùi k về π[" + (k - 1) + "] = " + pi[k - 1] + ".", i, k); k = pi[k - 1]; }
      if (pat[i] === pat[k]) { k++; }
      pi[i] = k;
      snapPi("i = " + i + ": " + (k ? "khớp, k = " + k : "không khớp ở đầu") + " → π[" + i + "] = " + k + ".", i, k ? k - 1 : null);
    }
    // view: đang so t[i] với pat[j] ("cmp"), vừa khớp t[i] ("ok", j ký tự khớp gồm cả t[i]) hoặc khớp trọn ("match")
    var found = [], view = function (msg, i, j, kind) {
      var off = kind === "cmp" ? i - j : i - j + 1, thi = {}, pcells = [], x, c;
      for (x = off; x <= i; x++) thi[x] = kind === "match" ? "found" : "range";
      if (kind === "cmp") thi[i] = "dim"; else if (kind === "ok" && j > 0) thi[i] = "cur";
      for (c = 0; c < n; c++) { var pj = c - off; pcells.push({ v: pj >= 0 && pj < m ? pat[pj] : "", s: pj < 0 || pj >= m ? "idle" : kind === "match" ? "found" : pj < j ? "range" : kind === "cmp" && pj === j ? "dim" : "idle" }); }
      steps.push({ msg: msg, rows: [{ label: "văn bản", cells: cells(t, thi), marks: {} }, { label: "mẫu (trượt)", cells: pcells, marks: {} }] });
    };
    steps.push({ msg: "π của mẫu \"" + pat + "\" = [" + pi.join(", ") + "]. Bước 2 — so khớp: duyệt văn bản MỘT lần, giữ j = số ký tự mẫu đang khớp; lệch thì lùi j theo π (con trỏ văn bản không lùi).", rows: [{ label: "mẫu", cells: cells(pat), marks: {} }, { label: "π", cells: pi.map(function (v) { return { v: v, s: "found" }; }), marks: {} }] });
    var j = 0;
    for (i = 0; i < n; i++) {
      while (j > 0 && t[i] !== pat[j]) { view("t[" + i + "] = '" + t[i] + "' ≠ pat[" + j + "] = '" + pat[j] + "' → lùi j = π[" + (j - 1) + "] = " + pi[j - 1] + " (con trỏ văn bản đứng yên).", i, j, "cmp"); j = pi[j - 1]; }
      if (t[i] === pat[j]) j++;
      if (j === m) { found.push(i - m + 1); view("Khớp trọn mẫu, bắt đầu tại vị trí " + (i - m + 1) + "! Lùi j = π[" + (m - 1) + "] = " + pi[m - 1] + " để tìm tiếp (cho phép khớp chồng nhau).", i, j, "match"); j = pi[j - 1]; }
      else view("t[" + i + "] = '" + t[i] + "' " + (j ? "khớp → j = " + j : "không khớp ở đầu mẫu, j = 0") + ".", i, j, "ok");
    }
    steps.push({ msg: found.length ? "Xong: mẫu xuất hiện tại vị trí " + found.join(", ") + " (đếm từ 0). Tổng thời gian O(N + M)." : "Xong: mẫu không xuất hiện trong văn bản.", rows: [{ label: "văn bản", cells: cells(t, found.reduce(function (o, st0) { for (var z = 0; z < m; z++) o[st0 + z] = "found"; return o; }, {})), marks: {} }] });
    return { steps: steps, result: { pi: pi, matches: found } };
  }

  // ---------------------------------------------------------------------------------------------- Knapsack 0/1
  function knapParse(text) {
    var ls = lines(text), h = ints(ls[0] || ""), n = h[0], W = h[1];
    if (!(n >= 1 && n <= 6 && W >= 1 && W <= 12)) return fail("Dòng đầu: \"n W\" với n ≤ 6 vật và sức chứa W ≤ 12; rồi n dòng \"khối-lượng giá-trị\".");
    var items = [];
    for (var i = 1; i <= n; i++) { var it = ints(ls[i] || ""); if (!(it[0] >= 1 && it[0] <= 12 && it[1] >= 0 && it[1] <= 99)) return fail("Vật " + i + ": khối lượng 1..12, giá trị 0..99."); items.push({ w: it[0], v: it[1] }); }
    return { params: { items: items, W: W } };
  }
  function knapsack(p) {
    var n = p.items.length, W = p.W, dp = [], steps = [], i, w;
    for (i = 0; i <= n; i++) { dp.push([]); for (w = 0; w <= W; w++) dp[i].push(0); }
    var cols = [], rowsLabels = ["0 vật"];
    for (w = 0; w <= W; w++) cols.push(String(w));
    p.items.forEach(function (it, k) { rowsLabels.push("vật " + (k + 1) + " (w=" + it.w + ", v=" + it.v + ")"); });
    var snap = function (msg, mark, filled) {
      var cells = [];
      for (var r = 0; r <= n; r++) { cells.push([]); for (var c = 0; c <= W; c++) cells[r].push({ v: r < filled.r || (r === filled.r && c <= filled.c) || r === 0 ? dp[r][c] : "·", s: (mark && mark[r + "," + c]) || "idle" }); }
      steps.push({ msg: msg, cols: cols, rowsLabels: rowsLabels, cells: cells });
    };
    snap("dp[i][w] = giá trị lớn nhất khi chỉ xét i vật đầu và sức chứa w. Hàng 0 (không có vật) toàn 0.", null, { r: 0, c: W });
    for (i = 1; i <= n; i++) {
      var it = p.items[i - 1];
      for (w = 0; w <= W; w++) {
        var skip = dp[i - 1][w], take = w >= it.w ? dp[i - 1][w - it.w] + it.v : -1, mk = {};
        mk[i + "," + w] = "cur"; mk[(i - 1) + "," + w] = "range"; if (take >= 0) mk[(i - 1) + "," + (w - it.w)] = "use";
        dp[i][w] = Math.max(skip, take);
        snap("dp[" + i + "][" + w + "] = max(không lấy vật " + i + ": dp[" + (i - 1) + "][" + w + "] = " + skip + (take >= 0 ? ", lấy: dp[" + (i - 1) + "][" + (w - it.w) + "] + " + it.v + " = " + take : ", không đủ chỗ để lấy") + ") = " + dp[i][w] + ".", mk, { r: i, c: w });
      }
    }
    var chosen = [], c = W, mk2 = {};
    for (i = n; i >= 1; i--) { mk2[i + "," + c] = "found"; if (dp[i][c] !== dp[i - 1][c]) { chosen.push(i); c -= p.items[i - 1].w; } }
    mk2["0," + c] = "found";
    snap("Truy vết từ dp[" + n + "][" + W + "] = " + dp[n][W] + ": hàng nào dp đổi so với hàng trên thì vật đó được lấy. Đã lấy vật: " + (chosen.slice().reverse().join(", ") || "không có") + ".", mk2, { r: n, c: W });
    return { steps: steps, result: { best: dp[n][W], chosen: chosen.slice().reverse() } };
  }

  // ---------------------------------------------------------------------------------------------- danh sách
  function gp(o) { return function (t) { return parseGraph(t, o); }; }
  var LIST = [
    { id: "bfs", title: "BFS — duyệt theo tầng", kind: "graph", blurb: "Hàng đợi, dist là số cạnh ít nhất.", parse: gp({ source: true }), run: bfs,
      presets: [{ name: "Đồ thị 8 đỉnh", text: "8 9 1\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n5 8\n6 8\n4 5" }, { name: "Có đỉnh không tới được", text: "6 5 1\n1 2\n2 3\n1 3\n4 5\n5 6" }] },
    { id: "dfs", title: "DFS — duyệt theo chiều sâu", kind: "graph", blurb: "Thời điểm vào / ra mỗi đỉnh (tin / tout).", parse: gp({ source: true }), run: dfs,
      presets: [{ name: "Đồ thị 8 đỉnh", text: "8 9 1\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n5 8\n6 8\n4 5" }, { name: "Cây 7 đỉnh", text: "7 6 1\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7" }] },
    { id: "dijkstra", title: "Dijkstra — đường đi ngắn nhất", kind: "graph", blurb: "Heap + relax; trọng số không âm.", parse: gp({ source: true, weighted: true }), run: dijkstra,
      presets: [{ name: "Ví dụ trong thư viện", text: "5 6 1\n1 2 2\n1 3 4\n2 3 1\n2 4 7\n3 5 3\n4 5 1" }, { name: "Đồ thị 7 đỉnh", text: "7 10 1\n1 2 7\n1 3 9\n1 6 14\n2 3 10\n2 4 15\n3 4 11\n3 6 2\n4 5 6\n5 6 9\n5 7 3" }] },
    { id: "bellman-ford", title: "Bellman-Ford — chấp nhận cạnh âm", kind: "graph", blurb: "Relax mọi cạnh V−1 vòng; phát hiện chu trình âm.", parse: gp({ source: true, weighted: true, directed: true, allowNeg: true }), run: bellmanFord,
      presets: [{ name: "Có cạnh âm, không chu trình âm", text: "5 7 1\n1 2 6\n1 3 7\n2 3 8\n2 4 5\n2 5 -4\n3 4 -3\n4 2 -2" }, { name: "Có chu trình âm", text: "4 5 1\n1 2 1\n2 3 -1\n3 4 -1\n4 2 -1\n1 4 5" }] },
    { id: "topological-sort", title: "Sắp xếp topo (Kahn)", kind: "graph", blurb: "Bậc vào + hàng đợi; phát hiện chu trình.", parse: gp({ directed: true }), run: function (p) { return topo(p); },
      presets: [{ name: "Đồ thị không chu trình", text: "6 6\n1 3\n2 3\n3 4\n3 5\n4 6\n5 6" }, { name: "Có chu trình", text: "4 4\n1 2\n2 3\n3 2\n3 4" }] },
    { id: "dsu", title: "DSU — gộp và tìm tập", kind: "rows", blurb: "Gộp theo kích thước + nén đường đi.", parse: dsuParse, run: dsu,
      presets: [{ name: "Gộp và tìm", text: "8\nunion 1 2\nunion 3 4\nunion 2 4\nunion 5 6\nunion 7 8\nunion 6 8\nunion 4 8\nfind 1" }] },
    { id: "fenwick-tree", title: "Fenwick Tree (BIT)", kind: "rows", blurb: "update / query tiền tố / tổng đoạn trong O(log N).", parse: fenwickParse, run: fenwick,
      presets: [{ name: "Dãy 8 phần tử", text: "3 1 4 1 5 9 2 6\nquery 6\nupdate 3 +5\nquery 6\nrange 3 7" }] },
    { id: "segment-tree", title: "Segment Tree (tổng đoạn)", kind: "tree", blurb: "Các nút phụ trách đoạn; truy vấn chọn nút trọn đoạn.", parse: segParse, run: segTree,
      presets: [{ name: "Dãy 8 phần tử", text: "5 3 8 6 2 7 4 1\nquery 2 7\nupdate 4 10\nquery 2 7" }, { name: "Dãy 6 phần tử (có đệm)", text: "2 4 6 8 10 12\nquery 1 6\nquery 3 4" }] },
    { id: "binary-search", title: "Tìm kiếm nhị phân (lower_bound)", kind: "rows", blurb: "lo, mid, hi thu hẹp nửa đoạn.", parse: bsParse, run: binarySearch,
      presets: [{ name: "Có trong dãy", text: "2 5 8 12 16 23 38 56 72 91\n23" }, { name: "Không có — vị trí chèn", text: "2 5 8 12 16 23 38 56 72 91\n20" }] },
    { id: "kmp", title: "KMP — so khớp xâu", kind: "rows", blurb: "Hàm tiền tố π rồi quét văn bản một lần.", parse: kmpParse, run: kmp,
      presets: [{ name: "Khớp chồng nhau", text: "abababcabababab\nababab" }, { name: "ABABC", text: "ABABDABACDABABCABAB\nABABC" }] },
    { id: "knapsack-01", title: "Knapsack 0/1 — bảng DP", kind: "table", blurb: "Điền bảng dp[i][w] từng ô, rồi truy vết.", parse: knapParse, run: knapsack,
      presets: [{ name: "4 vật, sức chứa 8", text: "4 8\n3 4\n4 5\n5 6\n2 3" }, { name: "3 vật, sức chứa 10", text: "3 10\n5 10\n4 40\n6 30" }] }
  ];
  var byId = {}; LIST.forEach(function (v) { byId[v.id] = v; });

  A.viz = { list: LIST, get: function (id) { return byId[id] || null; }, has: function (id) { return !!byId[id]; }, NAME: NAME, MAX_STEPS: MAX_STEPS };
  if (typeof module !== "undefined" && module.exports) module.exports = A.viz;
})(typeof globalThis !== "undefined" ? globalThis : this);
