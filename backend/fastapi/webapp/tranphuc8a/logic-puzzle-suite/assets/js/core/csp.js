/* core/csp.js — bộ giải bài toán thoả mãn ràng buộc (CSP) TỔNG QUÁT dùng chung cho N-Queens, Logic Grid và màn "Constraint View".
   Biến nhận giá trị nguyên 0..size-1 (miền = bitmask, size ≤ 30). Ràng buộc:
     { kind: "alldiff", vars: [...] }                       — mọi biến khác nhau (cắt miền bằng "đã chốt thì gạt khỏi biến khác" + kiểm bồ câu)
     { kind: "test", vars: [...], test(vals) → bool, label } — ràng buộc bất kỳ, nhất quán cung tổng quát (GAC) bằng liệt kê tuple (hợp cho bậc ≤ 4)
   Giải: quay lui + lan truyền sau mỗi lần gán, chọn biến còn ÍT giá trị nhất (MRV), hoà thì biến nhiều ràng buộc nhất.
   Có thể ghi lại CÂY TÌM KIẾM (cho trực quan hoá) và các bước lan truyền (cho giải thích). Thuần, không đụng DOM.

     var P = Puz.csp.problem({ vars: [{ name: "A", size: 3, labels: ["Đỏ","Xanh","Lục"] }, …], cons: [{ kind: "alldiff", vars: ["A","B","C"] }, …] });
     Puz.csp.solve(P, { limit: 2 })  → { count, solutions: [[v0, v1, …]], nodes, truncated }
     Puz.csp.propagate(P, Puz.csp.domains(P))  → { ok, dom, steps }   (lan truyền một lần, chưa tìm kiếm) */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  function pc(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); x = (x + (x >>> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >>> 24; }
  function low(x) { return 31 - Math.clz32(x & -x); }

  function problem(spec) {
    var names = [], size = [], labels = [], index = {}, i;
    spec.vars.forEach(function (v, k) {
      if (v.size > 30 || v.size < 1) throw new Error("csp: miền của " + v.name + " phải có 1..30 giá trị");
      names.push(v.name); size.push(v.size); labels.push(v.labels || null); index[v.name] = k;
    });
    var cons = (spec.cons || []).map(function (c, k) {
      var vs = c.vars.map(function (x) { var j = typeof x === "number" ? x : index[x]; if (j == null || j < 0 || j >= names.length) throw new Error("csp: biến không có: " + x); return j; });
      return { id: k, kind: c.kind || "test", vars: vs, test: c.test || null, label: c.label || "", meta: c.meta || null };
    });
    var byVar = names.map(function () { return []; });
    cons.forEach(function (c) { c.vars.forEach(function (v) { if (byVar[v].indexOf(c.id) < 0) byVar[v].push(c.id); }); });
    var init = new Int32Array(names.length);
    for (i = 0; i < names.length; i++) init[i] = size[i] >= 31 ? -1 : (1 << size[i]) - 1;
    if (spec.domains) Object.keys(spec.domains).forEach(function (n) { if (index[n] != null) init[index[n]] &= spec.domains[n]; });
    return { names: names, size: size, labels: labels, index: index, cons: cons, byVar: byVar, init: init };
  }
  function domains(p) { return Int32Array.from(p.init); }

  // ---- lan truyền
  /** Cắt miền theo một ràng buộc. Trả: false nếu có miền rỗng; ghi các giá trị bị gạt vào `changed` (mảng chỉ số biến). */
  function reviseAllDiff(c, dom, changed, steps) {
    var vs = c.vars, n = vs.length, i, j, again = true, union = 0;
    while (again) {
      again = false;
      for (i = 0; i < n; i++) {
        var di = dom[vs[i]];
        if (di === 0) return false;
        if ((di & (di - 1)) === 0) {                                  // đã chốt: gạt giá trị này khỏi các biến khác
          for (j = 0; j < n; j++) if (j !== i && (dom[vs[j]] & di)) {
            var nv = dom[vs[j]] & ~di;
            if (steps) steps.push({ con: c.id, v: vs[j], removed: dom[vs[j]] & di, why: "single", by: vs[i] });
            dom[vs[j]] = nv; changed.push(vs[j]); again = true;
            if (nv === 0) return false;
          }
        }
      }
    }
    for (i = 0; i < n; i++) union |= dom[vs[i]];
    if (pc(union) < n) return false;                                   // nguyên lý chuồng bồ câu
    return true;
  }
  function reviseTest(c, dom, changed, steps) {
    var vs = c.vars, n = vs.length, vals = new Array(n), xi, val;
    // support[i] = các giá trị của biến i có ít nhất một tuple thoả
    var support = new Array(n); for (xi = 0; xi < n; xi++) support[xi] = 0;
    // liệt kê tuple (dfs) có cắt sớm khi mọi giá trị của mọi biến đã có support
    var full = vs.map(function (v) { return dom[v]; });
    function rec(k) {
      if (k === n) {
        if (c.test(vals)) for (var t = 0; t < n; t++) support[t] |= 1 << vals[t];
        return;
      }
      var m = dom[vs[k]];
      while (m) { var b = m & -m, v = 31 - Math.clz32(b); m ^= b; vals[k] = v; rec(k + 1); }
    }
    rec(0);
    for (xi = 0; xi < n; xi++) {
      var nv = dom[vs[xi]] & support[xi];
      if (nv !== dom[vs[xi]]) {
        if (steps) steps.push({ con: c.id, v: vs[xi], removed: dom[vs[xi]] & ~nv, why: "test" });
        dom[vs[xi]] = nv; changed.push(vs[xi]);
        if (nv === 0) return false;
      }
    }
    return true;
  }
  /** Lan truyền tới điểm cố định. `dom` bị sửa tại chỗ. from: mảng biến vừa đổi (bỏ trống = xét mọi ràng buộc). */
  function propagate(p, dom, from, steps) {
    var inQ = new Uint8Array(p.cons.length), queue = [], head = 0, i;
    var push = function (ci) { if (!inQ[ci]) { inQ[ci] = 1; queue.push(ci); } };
    if (from) from.forEach(function (v) { p.byVar[v].forEach(push); }); else for (i = 0; i < p.cons.length; i++) push(i);
    while (head < queue.length) {
      var c = p.cons[queue[head++]]; inQ[c.id] = 0;
      var changed = [];
      var ok = c.kind === "alldiff" ? reviseAllDiff(c, dom, changed, steps) : reviseTest(c, dom, changed, steps);
      if (!ok) return false;
      for (i = 0; i < changed.length; i++) p.byVar[changed[i]].forEach(push);          // kể cả chính c: bản GAC một lượt có thể mất support sau khi cắt
    }
    return true;
  }

  // ---- tìm kiếm
  /** opt: { limit (số nghiệm tối đa cần đếm, mặc định 1), keep (số nghiệm giữ lại), maxNodes, rng (xáo thứ tự giá trị), trace (true → ghi cây), traceMax, domains (miền khởi đầu thay mặc định) } */
  function solve(p, opt) {
    opt = opt || {};
    var limit = opt.limit || 1, keep = opt.keep == null ? limit : opt.keep, maxNodes = opt.maxNodes || 2000000, rng = opt.rng || null;
    var res = { count: 0, solutions: [], nodes: 0, truncated: false, traceTruncated: false, trace: null };
    var trace = opt.trace ? [] : null, traceMax = opt.traceMax || 600;
    if (trace) res.trace = trace;
    var dom0 = opt.domains ? Int32Array.from(opt.domains) : domains(p);
    if (!propagate(p, dom0)) return res;

    function pick(dom) {
      var best = -1, bestN = 99, bestDeg = -1, i;
      for (i = 0; i < dom.length; i++) {
        var n = pc(dom[i]); if (n < 2) continue;
        if (n < bestN || (n === bestN && p.byVar[i].length > bestDeg)) { best = i; bestN = n; bestDeg = p.byVar[i].length; }
      }
      return best;
    }
    function node(parent, v, val, depth) {
      if (!trace) return -1;
      if (trace.length >= traceMax) { res.traceTruncated = true; return -1; }       // đã đủ nút ghi: các nút sâu hơn không được vẽ (chỉ ảnh hưởng hiển thị, không ảnh hưởng kết quả tìm kiếm)
      trace.push({ id: trace.length, parent: parent, depth: depth, v: v, val: val, status: "open", kids: 0 });
      return trace.length - 1;
    }
    function dfs(dom, depth, parent) {
      var v = pick(dom), i;
      if (v < 0) {                                                      // mọi biến đã chốt
        res.count++;
        if (res.solutions.length < keep) res.solutions.push(Array.prototype.map.call(dom, function (m) { return low(m); }));
        return true;
      }
      var vals = []; for (var m = dom[v]; m; m &= m - 1) vals.push(low(m));
      if (rng) rng.shuffle(vals);
      var any = false;
      for (i = 0; i < vals.length; i++) {
        if (res.nodes >= maxNodes) { res.truncated = true; return any; }
        res.nodes++;
        var nd = Int32Array.from(dom); nd[v] = 1 << vals[i];
        var id = node(parent, v, vals[i], depth + 1);
        if (id >= 0 && parent >= 0) trace[parent].kids++;
        if (!propagate(p, nd, [v])) { if (id >= 0) trace[id].status = "fail"; continue; }
        var before = res.count, found = dfs(nd, depth + 1, id);
        if (id >= 0) trace[id].status = res.count > before ? "ok" : res.truncated ? "open" : "dead";     // tìm kiếm bị cắt giữa chừng (maxNodes): nhánh đang duyệt dở chưa thể kết luận "chết"
        if (found) any = true;
        if (res.count >= limit) return true;
      }
      return any;
    }
    var root0 = -1;
    dfs(dom0, 0, root0);
    if (trace) trace.forEach(function (t) { if (t.status === "ok" && !t.kids && res.count) t.status = "solution"; });
    return res;
  }

  /** Số nghiệm (dừng ở `limit`): 0, 1, 2 (= "từ 2 trở lên" khi limit = 2). */
  function count(p, limit, opt) { return solve(p, Object.assign({}, opt || {}, { limit: limit || 2, keep: 0 })).count; }

  /** Tả một ràng buộc cho màn Constraint View: dùng `label` nếu có, không thì mô tả theo loại. */
  function describe(p, c) {
    if (c.label) return c.label;
    if (c.kind === "alldiff") return "khác nhau từng đôi: " + c.vars.map(function (v) { return p.names[v]; }).join(", ");
    return "ràng buộc trên " + c.vars.map(function (v) { return p.names[v]; }).join(", ");
  }
  function valueLabel(p, v, val) { var l = p.labels[v]; return l ? l[val] : String(val); }

  P.csp = { problem: problem, domains: domains, propagate: propagate, solve: solve, count: count, describe: describe, valueLabel: valueLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = P.csp;
})(typeof globalThis !== "undefined" ? globalThis : this);
