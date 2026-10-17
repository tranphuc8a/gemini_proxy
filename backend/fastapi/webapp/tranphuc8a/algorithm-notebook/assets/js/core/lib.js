/* core/lib.js — thư viện thuật toán dựng sẵn: nhóm, mục (entry), kịch bản câu hỏi; kiểm tra dữ liệu soạn tay.
   Dữ liệu nằm ở assets/data/lib-*.js, mỗi tệp gọi Algo.lib.add([...]) / Algo.lib.scenarios([...]). Cách soạn: assets/data/HUONG-DAN-SOAN.md.
   Chạy được cả trong node (kiem.js, kiem-lib.js) lẫn trình duyệt. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text;

  var CATEGORIES = [
    { id: "ds", name: "Cấu trúc dữ liệu", icon: "ds", blurb: "Mảng, ngăn xếp, hàng đợi, heap, DSU, Fenwick, Segment Tree, Treap…", compare: ["Truy vấn", "Cập nhật điểm", "Cập nhật đoạn", "Bộ nhớ", "Hỗ trợ thêm"] },
    { id: "graph", name: "Đồ thị", icon: "graph", blurb: "Duyệt, đường đi ngắn nhất, cây khung, luồng, ghép cặp, cây…", compare: ["Bài toán giải", "Cạnh âm", "Hợp với đồ thị", "Kết quả cho ra"] },
    { id: "string", name: "Xâu", icon: "string", blurb: "KMP, Z, hash, Trie, Aho-Corasick, Suffix Array…", compare: ["Bài toán giải", "Xây dựng", "Truy vấn", "Bộ nhớ"] },
    { id: "dp", name: "Quy hoạch động", icon: "dp", blurb: "Knapsack, LIS, LCS, bitmask, digit, cây, tối ưu DP…", compare: ["Dạng trạng thái", "Số trạng thái", "Chuyển trạng thái", "Bộ nhớ"] },
    { id: "math", name: "Toán", icon: "math", blurb: "Số nguyên tố, GCD, CRT, tổ hợp, ma trận, FFT, NTT…", compare: ["Bài toán giải", "Ràng buộc", "Độ chính xác"] },
    { id: "tech", name: "Kỹ thuật cơ bản", icon: "tech", blurb: "Tìm nhị phân, hai con trỏ, cửa sổ trượt, sắp xếp, Mo, bit…", compare: ["Dùng khi", "Điều kiện", "Cần dữ liệu đã sắp xếp"] },
    { id: "geo", name: "Hình học", icon: "geo", blurb: "Bao lồi, quét đường, cặp điểm gần nhất, đa giác…", compare: ["Bài toán giải", "Độ chính xác", "Ràng buộc"] },
    { id: "opt", name: "Tối ưu hoá & Heuristic", icon: "opt", blurb: "Hill Climbing, SA, GA, GRASP, Beam Search, Tabu…", compare: ["Loại", "Bảo đảm tối ưu", "Tham số cần chỉnh", "Bộ nhớ"] },
    { id: "sys", name: "Hệ thống & CSDL", icon: "sys", blurb: "LRU, băm nhất quán, Bloom Filter, B+ Tree, Raft…", compare: ["Mục đích", "Đánh đổi", "Dùng trong"] }
  ];
  var CAT = {}; CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  var SITES = { cses: "CSES", cf: "Codeforces", vnoi: "VNOI", atcoder: "AtCoder", lc: "LeetCode", spoj: "SPOJ", other: "Khác" };
  var LANGS = { cpp: "C++", py: "Python", js: "JavaScript", java: "Java" };

  var entries = [], byId = {}, scenarios = [], listeners = [];

  // ------------------------------------------------------------------------------------------------ kiểm tra
  var ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/, TAG_RE = /^[a-z0-9][a-z0-9+#.-]*$/;
  function str(x) { return typeof x === "string" ? x : ""; }
  function strList(x) { return Array.isArray(x) ? x.map(str).filter(Boolean) : []; }

  /** → mảng lỗi (rỗng = hợp lệ). `cses` = tập id CSES được phép (tuỳ chọn). Không kiểm related (cần cả thư viện) — xem validateAll. */
  function validate(e, o) {
    o = o || {};
    var err = [], p = function (m) { err.push((e && e.id || "?") + ": " + m); };
    if (!e || typeof e !== "object") return ["mục không phải object"];
    if (!ID_RE.test(str(e.id)) || e.id.length > 60) p("id phải là slug a-z0-9 và dấu gạch ngang, ≤ 60 ký tự");
    if (!str(e.name).trim() || e.name.length > 80) p("name rỗng hoặc > 80 ký tự");
    if (!CAT[e.category]) p("category không có: " + e.category);
    if (str(e.summary).length < 20 || e.summary.length > 220) p("summary phải 20–220 ký tự (một câu)");
    if (str(e.description).length < 80) p("description quá ngắn (< 80 ký tự)");
    if (!(e.level >= 1 && e.level <= 5 && e.level === Math.floor(e.level))) p("level phải là số nguyên 1–5");
    if (strList(e.tags).length < 2 || e.tags.some(function (t) { return !TAG_RE.test(t); })) p("tags: ≥ 2 thẻ, mỗi thẻ a-z0-9 và - + # .");
    if (!Array.isArray(e.aliases)) p("aliases phải là mảng (có thể rỗng)");
    var c = e.complexity;
    if (!c || !/(O|Θ|Ω)\(|\bO\(/.test(str(c.time))) p("complexity.time phải có dạng O(...)");
    if (c && c.space != null && !/\(/.test(str(c.space)) && !/^\s*—/.test(str(c.space))) p("complexity.space phải có dạng O(...) hoặc —");
    ["conditions", "use_case", "pitfalls"].forEach(function (k) { if (strList(e[k]).length < 1 || strList(e[k]).length !== (e[k] || []).length) p(k + ": cần ≥ 1 chuỗi không rỗng"); });
    if (e.not_for != null && strList(e.not_for).length !== e.not_for.length) p("not_for phải là mảng chuỗi");
    if (e.ops != null && (!Array.isArray(e.ops) || e.ops.some(function (x) { return !Array.isArray(x) || x.length !== 2 || !str(x[0]) || !/\(/.test(str(x[1])); }))) p("ops phải là [[tên thao tác, \"O(...)\"], …]");
    if (e.code != null) {
      if (!e.code || !LANGS[e.code.lang] || !str(e.code.title) || str(e.code.src).length < 40) p("code phải có lang, title, src (≥ 40 ký tự)");
      else if (/\t/.test(e.code.src)) p("code dùng dấu cách, không dùng tab");
      else if (/\bint\s+main\s*\(/.test(e.code.src)) p("code là đoạn dán sẵn vào bài giải: không được có main() (ví dụ chạy đặt trong example)");
      else if (e.code.lang === "cpp" && !/#include\s*<bits\/stdc\+\+\.h>/.test(e.code.src)) p("code C++ phải bắt đầu bằng #include <bits/stdc++.h> và using namespace std; để dán là chạy");
    } else if (!e.nocode) p("thiếu code (nếu thật sự không có mẫu code thì đặt nocode: true và giải thích trong description)");
    var ex = e.example;
    if (!ex || !str(ex.input).trim() || !str(ex.output).trim()) p("example cần input và output (chuỗi)");
    if (!Array.isArray(e.problems)) p("problems phải là mảng (có thể rỗng)");
    else e.problems.forEach(function (q) {
      if (!q || !SITES[q.site] || !str(q.name).trim()) return p("problems: mỗi bài cần site (cses|cf|vnoi|atcoder|lc|spoj|other) và name");
      if (q.site === "cses") { if (!/^\d+$/.test(str(q.id))) p("problems: bài CSES phải có id số (chỉ dùng id trong cses-tasks.txt)"); else if (o.cses && !o.cses[q.id]) p("problems: CSES " + q.id + " không có trong cses-tasks.txt"); else if (o.cses && o.cses[q.id] !== q.name) p("problems: CSES " + q.id + " tên đúng là \"" + o.cses[q.id] + "\", không phải \"" + q.name + "\""); }
      if (q.site === "cf" && q.id != null && !/^\d{1,4}[A-Z][0-9]?$/.test(str(q.id))) p("problems: id Codeforces dạng 20C / 1000A1");
    });
    if (!Array.isArray(e.related)) p("related phải là mảng id");
    if (!e.compare || typeof e.compare !== "object" || Array.isArray(e.compare)) p("compare phải là object");
    else Object.keys(e.compare).forEach(function (k) { if (CAT[e.category] && CAT[e.category].compare.indexOf(k) === -1) p("compare: khoá \"" + k + "\" không thuộc nhóm (dùng: " + CAT[e.category].compare.join(", ") + ")"); if (!str(e.compare[k]).trim()) p("compare." + k + " rỗng"); });
    if (!Array.isArray(e.cards) || e.cards.length < 2 || e.cards.some(function (x) { return !x || !str(x.q).trim() || !str(x.a).trim(); })) p("cards: ≥ 2 thẻ {q, a}");
    return err;
  }

  function validateScenario(s) {
    var err = [], p = function (m) { err.push((s && s.id || "?") + ": " + m); };
    if (!s || !ID_RE.test(str(s.id))) return ["kịch bản: id không hợp lệ"];
    if (str(s.prompt).length < 30) p("prompt quá ngắn (< 30 ký tự): hãy tả dữ liệu, ràng buộc N, các thao tác");
    if (strList(s.answer).length < 1) p("answer: ≥ 1 id thuật toán");
    if (strList(s.wrong).length < 3) p("wrong: ≥ 3 id thuật toán sai nhưng dễ nhầm");
    if (str(s.why).length < 30) p("why: giải thích vì sao đúng / vì sao các đáp án sai (≥ 30 ký tự)");
    return err;
  }

  /** Kiểm toàn thư viện: id trùng, related / answer / wrong phải trỏ tới mục có thật. o.known = tập id được phép trỏ tới (kiểm từng phần); o.cses = {id: tên}. */
  function validateAll(o) {
    o = o || {};
    var err = [], seen = {}, known = o.known || byId;
    entries.forEach(function (e) {
      if (seen[e.id]) err.push(e.id + ": id bị trùng"); seen[e.id] = 1;
      (e.related || []).forEach(function (r) { if (!known[r]) err.push(e.id + ": related trỏ tới id không có: " + r); else if (r === e.id) err.push(e.id + ": related tự trỏ vào chính nó"); });
      err.push.apply(err, validate(e, o));
    });
    var ids = {};
    scenarios.forEach(function (s) {
      if (ids[s.id]) err.push(s.id + ": kịch bản trùng id"); ids[s.id] = 1;
      err.push.apply(err, validateScenario(s));
      [].concat(s.answer || [], s.also || [], s.wrong || []).forEach(function (r) { if (!known[r]) err.push(s.id + ": trỏ tới id không có: " + r); });
    });
    return err;
  }

  // ------------------------------------------------------------------------------------------------ đăng ký
  function norm(e) {
    return Object.assign({ aliases: [], not_for: [], ops: [], problems: [], related: [], compare: {}, cards: [], source: "builtin" }, e);
  }
  function add(list) {
    list.forEach(function (e) { e = norm(e); if (byId[e.id]) { entries[entries.indexOf(byId[e.id])] = e; } else entries.push(e); byId[e.id] = e; });
    listeners.forEach(function (f) { f(); });
  }
  function addScenarios(list) { scenarios = scenarios.concat(list); }
  function reset() { entries = []; byId = {}; scenarios = []; }

  A.lib = {
    CATEGORIES: CATEGORIES, CAT: CAT, SITES: SITES, LANGS: LANGS,
    add: add, scenarios: addScenarios, reset: reset, validate: validate, validateScenario: validateScenario, validateAll: validateAll,
    all: function () { return entries; }, get: function (id) { return byId[id] || null; }, allScenarios: function () { return scenarios; },
    byCategory: function (c) { return entries.filter(function (e) { return e.category === c; }); },
    size: function () { return entries.length; }, onChange: function (f) { listeners.push(f); },
    /** Bài đã đối chiếu với trang gốc: CSES (kiem-lib.js so id + tên với cses-tasks.txt, lấy từ cses.fi) hoặc bài ghi `verified: true`. Còn lại là gợi ý theo tên — tác giả nhớ, chưa kiểm — nên KHÔNG tạo liên kết. */
    problemVerified: function (q) { return q.site === "cses" || q.verified === true; },
    problemUrl: function (q) {
      if (q.site === "cses" && /^\d+$/.test(q.id || "")) return "https://cses.fi/problemset/task/" + q.id;
      if (q.site === "cf" && q.verified === true && /^(\d{1,4})([A-Z][0-9]?)$/.test(q.id || "")) { var m = /^(\d{1,4})([A-Z][0-9]?)$/.exec(q.id); return "https://codeforces.com/problemset/problem/" + m[1] + "/" + m[2]; }
      return q.verified === true && q.url && /^https:\/\//.test(q.url) ? q.url : "";
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = A.lib;
})(typeof globalThis !== "undefined" ? globalThis : this);
