/* core/decide.js — cây quyết định "Thuật toán nên dùng?". Dữ liệu ở assets/data/tree.js:
     Algo.tree.set({ root: "root", nodes: { <id>: { q: "Câu hỏi?", opts: [ { t: "Trả lời", next: "<id nút khác>" } | { t: "Trả lời", result: ["id-thuật-toán", …], note: "ghi chú" } ] } } })
   Một cấu trúc phục vụ cả hai màn: "Wizard" (hỏi từng câu, có Quay lại) và "Cây quyết định" (xem toàn bộ dạng phác thảo). Nút có thể được trỏ tới từ nhiều chỗ (DAG),
   không được có vòng. validate() kiểm: trỏ đúng, không vòng, không nút mồ côi, kết quả là id có thật. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var def = { root: "", nodes: {} };

  function set(d) { def = d; }
  function node(id) { return def.nodes[id] || null; }

  function validate(known) {
    var err = [], nodes = def.nodes, ids = Object.keys(nodes);
    if (!nodes[def.root]) return ["gốc \"" + def.root + "\" không có"];
    ids.forEach(function (id) {
      var n = nodes[id];
      if (!n.q || !Array.isArray(n.opts) || n.opts.length < 2) err.push(id + ": cần câu hỏi và ≥ 2 lựa chọn");
      (n.opts || []).forEach(function (o, i) {
        if (!o.t) err.push(id + "[" + i + "]: thiếu nhãn t");
        var kinds = (o.next ? 1 : 0) + (o.result ? 1 : 0);
        if (kinds !== 1) err.push(id + "[" + i + "]: cần đúng một trong next / result");
        if (o.next && !nodes[o.next]) err.push(id + "[" + i + "]: next trỏ tới nút không có: " + o.next);
        (o.result || []).forEach(function (r) { if (known && !known(r)) err.push(id + "[" + i + "]: kết quả trỏ tới id không có: " + r); });
        if (o.result && !o.result.length) err.push(id + "[" + i + "]: result rỗng");
      });
    });
    var state = {}, seen = {};
    (function visit(id, path) {
      if (state[id] === 1) { err.push("vòng lặp: " + path.concat(id).join(" → ")); return; }
      if (state[id] === 2) return;
      state[id] = 1; seen[id] = 1;
      ((nodes[id] || {}).opts || []).forEach(function (o) { if (o.next && nodes[o.next]) visit(o.next, path.concat(id)); });
      state[id] = 2;
    })(def.root, []);
    ids.forEach(function (id) { if (!seen[id]) err.push(id + ": nút mồ côi (không tới được từ gốc)"); });
    return err;
  }

  /** Phác thảo: { id, q, opts: [{ t, note, result: [id…] | children: outline }] }. Nút dùng chung được bung lại ở mỗi chỗ (độ sâu có giới hạn nên không treo). */
  function outline(id, depth) {
    id = id || def.root; depth = depth || 0;
    var n = def.nodes[id];
    if (!n || depth > 12) return null;
    return { id: id, q: n.q, opts: n.opts.map(function (o) { return { t: o.t, note: o.note || "", result: o.result || null, children: o.next ? outline(o.next, depth + 1) : null }; }) };
  }

  /** Mọi đường tới lá: [{ path: [{q, t}], result: [id], note }] — dùng để test và để xây Quiz "đường đi". */
  function leaves() {
    var out = [];
    (function walk(id, path) {
      def.nodes[id].opts.forEach(function (o) {
        var step = path.concat({ q: def.nodes[id].q, t: o.t });
        if (o.result) out.push({ path: step, result: o.result, note: o.note || "" }); else walk(o.next, step);
      });
    })(def.root, []);
    return out;
  }

  /** Các nút mà thuật toán `algoId` xuất hiện làm kết quả (để chi tiết thuật toán hiện "Cách tìm ra tôi"). */
  function pathsTo(algoId) { return leaves().filter(function (l) { return l.result.indexOf(algoId) !== -1; }); }

  A.tree = { set: set, node: node, root: function () { return def.root; }, size: function () { return Object.keys(def.nodes).length; }, validate: validate, outline: outline, leaves: leaves, pathsTo: pathsTo };
  if (typeof module !== "undefined" && module.exports) module.exports = A.tree;
})(typeof globalThis !== "undefined" ? globalThis : this);
