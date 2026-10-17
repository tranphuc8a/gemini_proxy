/* core/compare.js — bảng so sánh 2–4 thuật toán cạnh nhau.
   Hàng: độ phức tạp thời gian · bộ nhớ · từng THAO TÁC chung (cùng tên ở ≥ 2 mục: "Truy vấn", "Cập nhật"…) · các thuộc tính `compare` theo khoá của nhóm · độ khó cài đặt ·
   điều kiện · dùng khi · không dùng khi. Hàng nào các cột khác nhau được đánh dấu `diff` để nhìn ra điểm phân biệt ngay. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text;
  var LEVEL = ["", "Rất dễ", "Dễ", "Vừa", "Khó", "Rất khó"];
  var MAX = 4;

  function dash(x) { return x == null || x === "" ? "—" : String(x); }

  /** → { cols: [entry], rows: [{label, kind, cells: [string], diff: bool}] } */
  function build(entries) {
    entries = entries.slice(0, MAX);
    var rows = [];
    function row(label, kind, fn) {
      var cells = entries.map(function (e) { return dash(fn(e)); });
      var seen = {}; cells.forEach(function (c) { seen[c] = 1; });
      rows.push({ label: label, kind: kind, cells: cells, diff: Object.keys(seen).length > 1 });
    }
    row("Thời gian", "cx", function (e) { return e.complexity && e.complexity.time; });
    row("Bộ nhớ", "cx", function (e) { return e.complexity && e.complexity.space; });

    // thao tác chung
    var opNames = {}, order = [];
    entries.forEach(function (e) { (e.ops || []).forEach(function (o) { var k = T.titleKey(o[0]); if (!opNames[k]) { opNames[k] = { label: o[0], n: 0 }; order.push(k); } opNames[k].n++; }); });
    order.filter(function (k) { return opNames[k].n >= 2 && !/^bo nho$|toan bo/.test(k); }).forEach(function (k) {
      row(opNames[k].label, "op", function (e) { var o = (e.ops || []).filter(function (x) { return T.titleKey(x[0]) === k; })[0]; return o && o[1]; });
    });

    // thuộc tính so sánh theo khoá nhóm (nhóm của mục đầu trước)
    var keys = [], cats = [];
    entries.forEach(function (e) { if (cats.indexOf(e.category) === -1) cats.push(e.category); });
    cats.forEach(function (c) { ((A.lib.CAT[c] && A.lib.CAT[c].compare) || []).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
    entries.forEach(function (e) { Object.keys(e.compare || {}).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
    keys.forEach(function (k) { if (rows.some(function (r) { return r.label === k; })) return;          // "Bộ nhớ" đã có hàng từ complexity.space
      if (entries.some(function (e) { return e.compare && e.compare[k]; })) row(k, "attr", function (e) { return e.compare && e.compare[k]; }); });

    row("Độ khó cài đặt", "level", function (e) { return LEVEL[e.level] || ""; });
    row("Điều kiện áp dụng", "list", function (e) { return (e.conditions || []).slice(0, 2).join("; "); });
    row("Dùng khi", "list", function (e) { return (e.use_case || [])[0]; });
    row("Không dùng khi", "list", function (e) { return (e.not_for || [])[0]; });
    return { cols: entries, rows: rows };
  }

  /** Bảng dạng Markdown (để xuất / sao chép). */
  function toMarkdown(table) {
    var esc = function (s) { return String(s).replace(/\|/g, "\\|").replace(/\n/g, " "); };
    var head = "| Tiêu chí | " + table.cols.map(function (c) { return esc(c.name); }).join(" | ") + " |\n|---|" + table.cols.map(function () { return "---|"; }).join("") + "\n";
    return head + table.rows.map(function (r) { return "| " + esc(r.label) + " | " + r.cells.map(esc).join(" | ") + " |"; }).join("\n") + "\n";
  }

  A.compare = { build: build, toMarkdown: toMarkdown, MAX: MAX, LEVEL: LEVEL };
  if (typeof module !== "undefined" && module.exports) module.exports = A.compare;
})(typeof globalThis !== "undefined" ? globalThis : this);
