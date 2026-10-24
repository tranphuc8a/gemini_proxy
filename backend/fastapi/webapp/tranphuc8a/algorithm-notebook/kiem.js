/* kiem.js — kiểm lõi của Algorithm Notebook bằng node (không trình duyệt):
     node backend/fastapi/webapp/tranphuc8a/algorithm-notebook/kiem.js
   Phần DOM / IndexedDB thật / hiệu năng 10.000 mục / offline kiểm bằng check.py; mẫu code C++ kiểm bằng kiem-code.py. */
"use strict";
/* Luoi an toan chong "xanh gia": mot Promise khong bao gio xong lam Node thoat ma 0 va bo qua im lang cac phan sau
   (xem ../khung-kiem.js). Thoat som -> "[SAI] KHONG CHAY HET" + exit 1. */
var gac = require("../khung-kiem.js").canhGac("algorithm-notebook/kiem.js");
var fs = require("fs"), path = require("path");
var J = path.join(__dirname, "assets", "js"), D = path.join(__dirname, "assets", "data");
["core/text", "core/notes", "core/markdown", "core/lib", "core/catalog", "core/find", "core/srs", "core/compare", "core/quiz", "core/decide", "core/viz", "data/schema", "data/store", "data/zip", "data/user"].forEach(function (m) { require(path.join(J, m + ".js")); });
var A = globalThis.Algo, T = A.text, lib = A.lib, C = A.catalog, F = A.find, S = A.srs, V = A.viz;
var MASTER = JSON.parse(fs.readFileSync(path.join(__dirname, "master-ids.json"), "utf8"));
var masterIds = []; MASTER.forEach(function (g) { g.items.forEach(function (it) { masterIds.push(it[0]); }); });

var sai = 0, ok = 0;
function kiem(ten, dk, chiTiet) { if (dk) { ok++; console.log("  [ok]  " + ten); } else { sai++; console.log("  [SAI] " + ten + (chiTiet !== undefined ? "  — " + chiTiet : "")); } }
function bang(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sec(t) { console.log(t); }
function prng(seed) { var s = seed >>> 0; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// nạp thư viện dựng sẵn (mọi lib-*.js), tree.js, roadmaps.js
var loadErr = [];
fs.readdirSync(D).filter(function (f) { return /^lib-.*\.js$/.test(f); }).forEach(function (f) { try { require(path.join(D, f)); } catch (e) { loadErr.push(f + ": " + String(e && e.message || e).split("\n")[0]); } });
require(path.join(D, "tree.js")); require(path.join(D, "roadmaps.js"));
var libComplete = masterIds.every(function (id) { return !!lib.get(id); });

/* ======================================================================== thư viện dựng sẵn */
sec("thư viện dựng sẵn");
kiem("mọi tệp lib-*.js nạp được (không lỗi cú pháp)", loadErr.length === 0, loadErr.join(" | "));
kiem("có mục dijkstra mẫu và nhóm danh mục đủ 9 nhóm", !!lib.get("dijkstra") && lib.CATEGORIES.length === 9);
if (libComplete) {
  var cses = {};
  fs.readFileSync(path.join(__dirname, "..", "..", "..", "..", "..", "tasks", "2610", "261017", "algorithm-notebook", "cses-tasks.txt"), "utf8").split("\n").forEach(function (line) {
    if (/^\s*(#|\[|$)/.test(line)) return; line.split(" | ").forEach(function (c) { var m = /^\s*(\d+) (.+?)\s*$/.exec(c); if (m) cses[m[1]] = m[2]; });
  });
  var errs = lib.validateAll({ cses: cses });
  kiem("mọi mục hợp lệ (trường, độ phức tạp, mã, ví dụ, bài tập CSES đúng id + tên, related trỏ đúng, compare đúng khoá nhóm)", errs.length === 0, errs.slice(0, 5).join(" | "));
  kiem("đủ mọi id trong master-ids.json (" + masterIds.length + " mục)", lib.size() === masterIds.length, lib.size());
  var allProbs = []; lib.all().forEach(function (e) { e.problems.forEach(function (p) { allProbs.push(p); }); });
  var cs = allProbs.filter(function (p) { return p.site === "cses"; }), nonCs = allProbs.filter(function (p) { return p.site !== "cses"; });
  kiem("bài CSES (" + cs.length + ") đều đã đối chiếu và có liên kết cses.fi; bài nguồn khác (" + nonCs.length + ") chưa kiểm → không có liên kết",
    cs.every(function (p) { return lib.problemVerified(p) && /^https:\/\/cses\.fi\/problemset\/task\/\d+$/.test(lib.problemUrl(p)); }) && nonCs.every(function (p) { return !lib.problemVerified(p) && lib.problemUrl(p) === ""; }),
    nonCs.filter(function (p) { return lib.problemUrl(p) !== ""; }).map(function (p) { return p.name; }).slice(0, 3).join(","));
  var noCode = lib.all().filter(function (e) { return !e.code; }).map(function (e) { return e.id; });
  kiem("chỉ vài mục không có code (nocode) và đều ở nhóm hệ thống", noCode.every(function (id) { return lib.get(id).category === "sys"; }) && noCode.length <= 6, noCode.join(","));
  var viz = lib.all().filter(function (e) { return e.viz; });
  kiem("mọi mục gắn viz đều có trình trực quan hoá thật", viz.every(function (e) { return V.has(e.viz); }), viz.filter(function (e) { return !V.has(e.viz); }).map(function (e) { return e.id; }).join(","));
  var terr = A.tree.validate(function (id) { return !!lib.get(id); });
  kiem("cây quyết định: trỏ đúng, không vòng, không nút mồ côi, mọi kết quả là id có thật", terr.length === 0, terr.slice(0, 4).join(" | "));
  var inTree = {}; A.tree.leaves().forEach(function (l) { l.result.forEach(function (id) { inTree[id] = 1; }); });
  var core = ["dijkstra", "bellman-ford", "fenwick-tree", "segment-tree", "dsu", "kmp", "knapsack-01", "lis", "sieve", "dinic", "kruskal", "bfs", "binary-search"];
  kiem("cây quyết định phủ các thuật toán cốt lõi (" + Object.keys(inTree).length + " mục có mặt ở lá)", core.every(function (id) { return inTree[id]; }), core.filter(function (id) { return !inTree[id]; }).join(","));
  var bad = [];
  A.roadmaps.forEach(function (r) { r.stages.forEach(function (st) { st.ids.forEach(function (id) { if (!lib.get(id)) bad.push(r.id + ":" + id); }); }); });
  A.compareSets.forEach(function (s) { s.ids.forEach(function (id) { if (!lib.get(id)) bad.push(s.name + ":" + id); }); });
  kiem("lộ trình và bộ so sánh gợi ý chỉ trỏ id có thật", bad.length === 0, bad.join(","));
  var dup = []; A.roadmaps.forEach(function (r) { var seen = {}; r.stages.forEach(function (st) { st.ids.forEach(function (id) { if (seen[id]) dup.push(r.id + ":" + id); seen[id] = 1; }); }); });
  kiem("mỗi lộ trình không lặp thuật toán", dup.length === 0, dup.join(","));
} else console.log("  (bỏ qua kiểm toàn thư viện: còn thiếu " + masterIds.filter(function (id) { return !lib.get(id); }).length + " / " + masterIds.length + " mục so với master-ids.json)");

/* ======================================================================== catalog */
sec("catalog (mục của tôi)");
var now0 = 1.8e12;
var it = C.normalizeItem({ name: "  Cây Zeta Riêng ", category: "dp", tags: "CHT, Li-Chao #dp", code: { lang: "cpp", title: "lichao.cpp", src: "#include <bits/stdc++.h>" }, conditions: "a\nb\n\n", link: "javascript:alert(1)", origin: "cp-algorithms" }, now0);
kiem("normalizeItem: cắt tên, tag chữ thường không dấu #, bỏ dòng rỗng, chặn link không phải http(s), id u-uuid", it.name === "Cây Zeta Riêng" && bang(it.tags, ["cht", "li-chao", "dp"]) && bang(it.conditions, ["a", "b"]) && it.link === "" && /^u-[0-9a-f-]{36}$/.test(it.id) && it.source === "user" && it.origin === "cp-algorithms");
var nameErr = null; try { C.normalizeItem({ name: "  " }, now0); } catch (e) { nameErr = e; }
kiem("thiếu tên → lỗi tiếng Việt", !!nameErr && /tên/.test(nameErr.message));
kiem("nhóm lạ rơi về 'mine'; mức khó ngoài 1–5 thành 3", C.normalizeItem({ name: "x", category: "nope", level: 9 }, now0).category === "mine" && C.normalizeItem({ name: "x", level: 9 }, now0).level === 3);
C.setUser([it]);
kiem("danh mục hợp nhất: tìm theo id và theo tên/bí danh (không dấu, hoa thường)", C.get(it.id).name === "Cây Zeta Riêng" && C.byName("cay zeta rieng").id === it.id && C.byName("DIJKSTRA") === lib.get("dijkstra") && C.categories().some(function (c) { return c.id === "dp"; }));
C.setUser([]);

/* ======================================================================== tìm kiếm */
sec("tìm kiếm");
function mk(id, name, o) { return Object.assign({ id: id, name: name, aliases: [], category: "graph", tags: ["graph", "x"], summary: "tóm tắt", description: "", conditions: [], complexity: { time: "O(N)", space: "O(N)" }, ops: [], use_case: [], pitfalls: [], not_for: [] }, o || {}); }
var fake = [
  mk("dijkstra", "Dijkstra", { aliases: ["đường đi ngắn nhất một nguồn"], tags: ["graph", "shortest-path"], complexity: { time: "O((V+E) log V)" }, use_case: ["đường ngắn nhất trên bản đồ"] }),
  mk("bellman-ford", "Bellman-Ford", { tags: ["graph", "shortest-path"], complexity: { time: "O(VE)" } }),
  mk("fenwick-tree", "Fenwick Tree (BIT)", { category: "ds", tags: ["range-query", "tree"], complexity: { time: "O(log N)" }, ops: [["Cập nhật", "O(log N)"], ["Truy vấn", "O(log N)"]], use_case: ["tổng tiền tố có cập nhật điểm", "range query"] }),
  mk("segment-tree", "Segment Tree", { category: "ds", tags: ["range-query", "tree"], complexity: { time: "O(N log N)" }, ops: [["Truy vấn", "O(log N)"]], use_case: ["range query min max"] }),
  mk("sorting", "Sắp xếp", { category: "tech", tags: ["sort"], complexity: { time: "O(N log N)" } }),
  mk("kmp", "KMP", { category: "string", tags: ["string-matching"], complexity: { time: "O(N + M)" } })
];
var idx = F.build(fake), s1 = function (q, o) { return F.search(idx, q, o).results.map(function (r) { return r.e.id; }); };
kiem("tìm theo tên: gõ dở 'dijk' ra Dijkstra đứng đầu", s1("dijk")[0] === "dijkstra");
kiem("tìm không dấu theo bí danh tiếng Việt: 'duong di ngan nhat' → Dijkstra", s1("duong di ngan nhat")[0] === "dijkstra");
kiem("tìm theo tag: 'tag:shortest-path' → hai thuật toán đường ngắn nhất; '#range-query' → hai cấu trúc", bang(s1("tag:shortest-path").sort(), ["bellman-ford", "dijkstra"]) && bang(s1("#range-query").sort(), ["fenwick-tree", "segment-tree"]));
kiem("tìm theo độ phức tạp: 'O(logN)' = 'O(log N)' (bỏ dấu cách, hoa thường)", s1("O(logN)").indexOf("fenwick-tree") !== -1 && s1("o(log n)").indexOf("segment-tree") !== -1 && s1("O(logN)").indexOf("sorting") === -1);
kiem("O(NlogN) khớp O(N log N) nhưng KHÔNG khớp O(log N)", bang(s1("O(NlogN)").sort(), ["segment-tree", "sorting"]));
kiem("tìm theo use case: 'range query' → hai cấu trúc; 'tổng tiền tố' → Fenwick", bang(s1("range query").sort(), ["fenwick-tree", "segment-tree"]) && s1("tong tien to")[0] === "fenwick-tree");
kiem("gõ sai một chữ vẫn tìm ra ('dikjstra' không; 'dijkstrs' → Dijkstra)", s1("dijkstrs")[0] === "dijkstra" && s1("zzzz").length === 0);
kiem("lọc theo nhóm 'cat:ds' và bộ lọc ngoài (filter)", bang(s1("cat:ds").sort(), ["fenwick-tree", "segment-tree"]) && bang(s1("", { filter: function (e) { return e.category === "string"; } }), ["kmp"]));
kiem("truy vấn rỗng trả mọi mục theo tên; giới hạn kết quả", s1("").length === 6 && s1("", { limit: 2 }).length === 2 && F.search(idx, "", { limit: 2 }).total === 6);
var rnd = prng(7), big = [];
for (var i = 0; i < 10000; i++) big.push(mk("u-" + i, "Mục " + Math.floor(rnd() * 1e6) + " alpha" + (i % 97), { tags: ["t" + (i % 50), "tag"], use_case: ["dùng khi " + (i % 13) + " range query"], description: "văn bản dài ".repeat(60), complexity: { time: i % 3 ? "O(N log N)" : "O(N)" }, ops: [["x", "O(log N)"]] }));
var bigIdx = F.build(big), t0 = process.hrtime.bigint(), rs = F.search(bigIdx, "alpha5 range", {});
var ms = Number(process.hrtime.bigint() - t0) / 1e6, t1 = process.hrtime.bigint(); F.search(bigIdx, "O(NlogN)", {}); var ms2 = Number(process.hrtime.bigint() - t1) / 1e6;
kiem("10.000 mục: tìm hai từ " + ms.toFixed(1) + " ms, tìm độ phức tạp " + ms2.toFixed(1) + " ms (< 100 ms)", ms < 100 && ms2 < 100 && rs.total > 0);

/* ======================================================================== SRS */
sec("flashcard (SM-2)");
var c0 = S.fresh("a:x:0", 1000), c1 = S.schedule(c0, 2, 1000), c2 = S.schedule(c1, 2, c1.due), c3 = S.schedule(c2, 3, c2.due), lapse = S.schedule(c3, 0, c3.due);
kiem("lịch ôn tăng dần khi nhớ: 1 → 4 → ≥ 5 ngày", c1.interval === 1 && c2.interval === 4 && c3.interval > c2.interval);
kiem("quên (Lại): về 10 phút, reps = 0, ease giảm, đếm lapses", lapse.reps === 0 && lapse.due - c3.due === 600000 && lapse.ease < c3.ease && lapse.lapses === 1);
kiem("không sửa thẻ cũ; nhãn xem trước cho 4 nút", c0.reps === 0 && S.preview(c0, 1000).length === 4 && /phút/.test(S.preview(c0, 1000)[0]));

/* ======================================================================== so sánh */
sec("so sánh");
var tb = A.compare.build([fake[2], fake[3]]);
var labels = tb.rows.map(function (r) { return r.label; });
kiem("bảng so sánh: có thời gian, bộ nhớ, thao tác chung 'Truy vấn', độ khó; thao tác chỉ một bên ('Cập nhật') không thành hàng", labels.indexOf("Thời gian") === 0 && labels.indexOf("Truy vấn") !== -1 && labels.indexOf("Cập nhật") === -1 && labels.indexOf("Độ khó cài đặt") !== -1);
var tq = tb.rows.filter(function (r) { return r.label === "Truy vấn"; })[0], tt = tb.rows[0];
kiem("hàng giống nhau không đánh dấu diff, hàng khác nhau có diff", tq.diff === false && tt.diff === true && tt.cells[0] === "O(log N)" && tt.cells[1] === "O(N log N)");
kiem("tối đa 4 cột; xuất Markdown có tiêu đề và đủ hàng", A.compare.build(fake).cols.length === 4 && /^\| Tiêu chí \| Fenwick Tree \(BIT\) \| Segment Tree \|/.test(A.compare.toMarkdown(tb)));

/* ======================================================================== quiz */
sec("quiz");
var qs = [{ id: "q1", prompt: "N = 100000, cập nhật điểm và tổng tiền tố, 100000 thao tác (đủ dài).", answer: ["fenwick-tree"], also: ["segment-tree"], wrong: ["sorting", "kmp", "dijkstra"], why: "Fenwick đủ và ngắn; Segment Tree cũng được; các cái còn lại sai bài toán." }];
var made = A.quiz.make(fake, qs, { n: 4, rnd: prng(3) }), sc = made.filter(function (q) { return q.type === "scenario"; })[0];
kiem("sinh câu hỏi: có kịch bản, đáp án đúng nằm trong lựa chọn, không lặp mục", !!sc && sc.options.some(function (o) { return o.id === "fenwick-tree"; }) && sc.options.length >= 4 && made.length >= 3 && new Set(made.map(function (q) { return q.type + q.ref[0]; })).size === made.length);
kiem("chấm: đúng / chấp nhận được (also) / sai", A.quiz.grade(sc, "fenwick-tree") === "right" && A.quiz.grade(sc, "segment-tree") === "ok" && A.quiz.grade(sc, "kmp") === "wrong");
var cq = A.quiz.make(fake, [], { n: 6, types: ["complexity"], rnd: prng(5) });
kiem("câu hỏi độ phức tạp: đáp án đúng là độ phức tạp thật của mục, lựa chọn không trùng", cq.length > 0 && cq.every(function (q) { var e = fake.filter(function (x) { return x.id === q.ref[0]; })[0]; return q.correct[0] === e.complexity.time && new Set(q.options.map(function (o) { return o.label; })).size === q.options.length; }));
kiem("tỉ lệ sai theo nhóm chỉ tính khi đủ 3 câu", bang(A.quiz.weakAreas([{ answers: [{ cat: "dp", r: "wrong" }, { cat: "dp", r: "right" }, { cat: "dp", r: "wrong" }, { cat: "ds", r: "wrong" }] }]), { dp: 2 / 3 }));

/* ======================================================================== trực quan hoá: đối chiếu cách tính trực tiếp */
sec("trực quan hoá");
function randGraph(rnd, n, m, directed, wmin, wmax) {
  var lines = [n + " " + m + " 1"], seen = {}, edges = [];
  while (edges.length < m) { var a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a === b) continue; var k = directed ? a + "," + b : Math.min(a, b) + "," + Math.max(a, b); if (seen[k]) continue; seen[k] = 1; edges.push([a, b, wmin + Math.floor(rnd() * (wmax - wmin + 1))]); }
  edges.forEach(function (e) { lines.push((e[0] + 1) + " " + (e[1] + 1) + " " + e[2]); });
  return { text: lines.join("\n"), edges: edges, n: n };
}
function floyd(n, edges, directed) {
  var d = []; for (var i = 0; i < n; i++) { d.push([]); for (var j = 0; j < n; j++) d[i].push(i === j ? 0 : Infinity); }
  edges.forEach(function (e) { d[e[0]][e[1]] = Math.min(d[e[0]][e[1]], e[2]); if (!directed) d[e[1]][e[0]] = Math.min(d[e[1]][e[0]], e[2]); });
  for (var k = 0; k < n; k++) for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) if (d[a][k] + d[k][b] < d[a][b]) d[a][b] = d[a][k] + d[k][b];
  return d;
}
var gr = prng(11), okD = true, okB = true, okBF = true, okNeg = true, okTopo = true, okDfs = true, shapeOk = true;
for (var it2 = 0; it2 < 200; it2++) {
  var n = 2 + Math.floor(gr() * 8), m = Math.min(Math.floor(gr() * 14), n * (n - 1) / 2), g = randGraph(gr, n, m, false, 0, 9), ref = floyd(n, g.edges, false)[0];
  var pd = V.get("dijkstra").parse(g.text); var rd = V.get("dijkstra").run(pd.params);
  if (!bang(rd.result.dist, ref)) okD = false;
  var gu = randGraph(gr, n, m, false, 1, 1), pb = V.get("bfs").parse(gu.text), rb = V.get("bfs").run(pb.params);
  if (!bang(rb.result.dist, floyd(n, gu.edges, false)[0])) okB = false;
  var gd = randGraph(gr, n, Math.min(Math.floor(gr() * 14), n * (n - 1)), true, -3, 9), pn = V.get("bellman-ford").parse(gd.text), rn = V.get("bellman-ford").run(pn.params);
  var fl = floyd(n, gd.edges, true), negCyc = false; for (var q = 0; q < n; q++) if (fl[q][q] < 0 && fl[0][q] < Infinity) negCyc = true;
  if (rn.result.negCycle !== negCyc) okNeg = false; else if (!negCyc && !bang(rn.result.dist, fl[0])) okBF = false;
  var pf = V.get("dfs").parse(gu.text), rf = V.get("dfs").run(pf.params), reach = rb.result.dist.filter(function (d) { return d < Infinity; }).length;
  if (rf.result.order.length !== reach || rf.result.order[0] !== 0) okDfs = false;
  [[rd, m], [rb, m], [rf, m], [rn, gd.edges.length]].forEach(function (x) { x[0].steps.forEach(function (st) { if (!st.msg || st.nodes.length !== n || st.edges.length !== x[1]) shapeOk = false; }); });
  var dag = []; for (var e0 = 0; e0 < gd.edges.length; e0++) { var ed = gd.edges[e0]; if (ed[0] < ed[1]) dag.push(ed); }
  var dtext = [n + " " + dag.length].concat(dag.map(function (e) { return (e[0] + 1) + " " + (e[1] + 1); })).join("\n"), rt = V.get("topological-sort").run(V.get("topological-sort").parse(dtext).params);
  var pos = {}; rt.result.order.forEach(function (v, k) { pos[v] = k; });
  if (rt.result.cycle || rt.result.order.length !== n || dag.some(function (e) { return pos[e[0]] > pos[e[1]]; })) okTopo = false;
}
kiem("Dijkstra từng bước cho dist giống Floyd (200 đồ thị ngẫu nhiên, trọng số 0..9)", okD);
kiem("BFS từng bước cho dist giống Floyd trên đồ thị đơn vị", okB);
kiem("Bellman-Ford: dist giống Floyd; phát hiện chu trình âm đúng (200 đồ thị có cạnh âm)", okBF && okNeg);
kiem("DFS thăm đúng các đỉnh tới được; Topo cho thứ tự hợp lệ trên DAG ngẫu nhiên", okDfs && okTopo);
kiem("mọi bước của viz đồ thị đủ trường (msg, trạng thái đỉnh, trạng thái cạnh)", shapeOk);
var cyc = V.get("topological-sort").run(V.get("topological-sort").parse(V.get("topological-sort").presets[1].text).params);
kiem("Topo phát hiện chu trình (preset 'Có chu trình')", cyc.result.cycle === true);

var pr = prng(21), okDsu = true, okFw = true, okSeg = true, okBs = true, okKmp = true, okKn = true;
for (var t = 0; t < 150; t++) {
  var nn = 2 + Math.floor(pr() * 10), opsT = [], par = []; for (var i2 = 0; i2 < nn; i2++) par.push(i2);
  var fnd = function (x) { while (par[x] !== x) x = par[x]; return x; }, wantFinds = [];
  for (var o = 0; o < 10; o++) { var x = 1 + Math.floor(pr() * nn), y = 1 + Math.floor(pr() * nn); if (pr() < 0.6) { opsT.push("union " + x + " " + y); par[fnd(x - 1)] = fnd(y - 1); } else opsT.push("find " + x); }
  var dres = V.get("dsu").run(V.get("dsu").parse(nn + "\n" + opsT.join("\n")).params);
  var rootsRef = {}; for (var k2 = 0; k2 < nn; k2++) rootsRef[fnd(k2)] = (rootsRef[fnd(k2)] || 0) + 1;
  var rootOf = function (x) { while (dres.result.parent[x] !== x) x = dres.result.parent[x]; return x; };
  for (var a2 = 0; a2 < nn; a2++) for (var b2 = 0; b2 < nn; b2++) if ((fnd(a2) === fnd(b2)) !== (rootOf(a2) === rootOf(b2))) okDsu = false;
  var na = 2 + Math.floor(pr() * 14), arr = [], ftxt; for (var i3 = 0; i3 < na; i3++) arr.push(Math.floor(pr() * 40) - 20);
  var fo = []; for (var o2 = 0; o2 < 8; o2++) { var r1 = pr(); if (r1 < 0.4) fo.push("update " + (1 + Math.floor(pr() * na)) + " " + (Math.floor(pr() * 20) - 10)); else if (r1 < 0.7) fo.push("query " + (1 + Math.floor(pr() * na))); else { var l = 1 + Math.floor(pr() * na), r = l + Math.floor(pr() * (na - l + 1)); fo.push("range " + l + " " + r); } }
  var fres = V.get("fenwick-tree").run(V.get("fenwick-tree").parse(arr.join(" ") + "\n" + fo.join("\n")).params), ref2 = arr.slice(), answers = [];
  fo.forEach(function (line) { var w = line.split(" "); if (w[0] === "update") ref2[+w[1] - 1] += +w[2]; else if (w[0] === "query") answers.push(ref2.slice(0, +w[1]).reduce(function (s, v) { return s + v; }, 0)); else answers.push(ref2.slice(+w[1] - 1, +w[2]).reduce(function (s, v) { return s + v; }, 0)); });
  if (!bang(fres.result.answers, answers)) okFw = false;
  var ns = 2 + Math.floor(pr() * 7), sarr = []; for (var i4 = 0; i4 < ns; i4++) sarr.push(Math.floor(pr() * 40) - 20);
  var so = []; for (var o3 = 0; o3 < 6; o3++) { if (pr() < 0.4) so.push("update " + (1 + Math.floor(pr() * ns)) + " " + (Math.floor(pr() * 20) - 10)); else { var l2 = 1 + Math.floor(pr() * ns), r2 = l2 + Math.floor(pr() * (ns - l2 + 1)); so.push("query " + l2 + " " + r2); } }
  var sres = V.get("segment-tree").run(V.get("segment-tree").parse(sarr.join(" ") + "\n" + so.join("\n")).params), ref3 = sarr.slice(), ans3 = [];
  so.forEach(function (line) { var w = line.split(" "); if (w[0] === "update") ref3[+w[1] - 1] = +w[2]; else ans3.push(ref3.slice(+w[1] - 1, +w[2]).reduce(function (s, v) { return s + v; }, 0)); });
  if (!bang(sres.result.answers, ans3)) okSeg = false;
  var nb = 1 + Math.floor(pr() * 15), sorted = []; for (var i5 = 0; i5 < nb; i5++) sorted.push(Math.floor(pr() * 30)); sorted.sort(function (p, q) { return p - q; });
  var target = Math.floor(pr() * 32), lb = sorted.findIndex(function (v) { return v >= target; }); if (lb < 0) lb = nb;
  var bres = V.get("binary-search").run(V.get("binary-search").parse(sorted.join(" ") + "\n" + target).params);
  if (bres.result.index !== lb) okBs = false;
  var alpha = "ab", tl = 3 + Math.floor(pr() * 18), tx = "", pl = 1 + Math.floor(pr() * Math.min(5, tl)), pt = ""; for (var i6 = 0; i6 < tl; i6++) tx += alpha[Math.floor(pr() * 2)]; for (var i7 = 0; i7 < pl; i7++) pt += alpha[Math.floor(pr() * 2)];
  var kres = V.get("kmp").run(V.get("kmp").parse(tx + "\n" + pt).params), naive = []; for (var s0 = 0; s0 + pl <= tl; s0++) if (tx.substr(s0, pl) === pt) naive.push(s0);
  if (!bang(kres.result.matches, naive)) okKmp = false;
  var ni = 1 + Math.floor(pr() * 5), W = 1 + Math.floor(pr() * 12), items = [], ktxt = [ni + " " + W]; for (var i8 = 0; i8 < ni; i8++) { var it3 = { w: 1 + Math.floor(pr() * 8), v: Math.floor(pr() * 30) }; items.push(it3); ktxt.push(it3.w + " " + it3.v); }
  var best = 0; for (var mask = 0; mask < (1 << ni); mask++) { var tw = 0, tv = 0; for (var b3 = 0; b3 < ni; b3++) if (mask >> b3 & 1) { tw += items[b3].w; tv += items[b3].v; } if (tw <= W && tv > best) best = tv; }
  var kn = V.get("knapsack-01").run(V.get("knapsack-01").parse(ktxt.join("\n")).params), chosenV = kn.result.chosen.reduce(function (s, i) { return s + items[i - 1].v; }, 0), chosenW = kn.result.chosen.reduce(function (s, i) { return s + items[i - 1].w; }, 0);
  if (kn.result.best !== best || chosenV !== best || chosenW > W) okKn = false;
}
kiem("DSU từng bước: quan hệ cùng-tập giống DSU tham chiếu (150 ca ngẫu nhiên)", okDsu);
kiem("Fenwick từng bước: mọi truy vấn khớp tính tay (update, query, range)", okFw);
kiem("Segment Tree từng bước: tổng đoạn khớp tính tay sau các cập nhật", okSeg);
kiem("Tìm nhị phân từng bước cho đúng lower_bound", okBs);
kiem("KMP từng bước: mọi vị trí khớp giống tìm vét cạn (kể cả khớp chồng nhau)", okKmp);
kiem("Knapsack 0/1: giá trị tốt nhất khớp vét cạn; tập vật truy vết có tổng giá trị đó và vừa sức chứa", okKn);
var badIn = ["", "3 1 9\n1 2 5", "13 0 1", "3 1 1\n1 1 5", "5 1 1\n1 2 -4"], rej = badIn.map(function (t) { return !!V.get("dijkstra").parse(t).error; });
kiem("nhập sai bị từ chối bằng lời tiếng Việt (rỗng, nguồn ngoài khoảng, quá 12 đỉnh, tự trỏ, cạnh âm cho Dijkstra)", rej.every(Boolean) && /Bellman/.test(V.get("dijkstra").parse("5 1 1\n1 2 -4").error));
kiem("mọi preset của mọi viz chạy được và ≤ " + V.MAX_STEPS + " bước", V.list.every(function (v) { return v.presets.every(function (p) { var pp = v.parse(p.text); if (pp.error) return false; var r = v.run(pp.params); return r.steps.length > 1 && r.steps.length <= V.MAX_STEPS && r.steps.every(function (s) { return !!s.msg; }); }); }));

/* ======================================================================== dữ liệu người dùng (kho bộ nhớ) */
/* ======================================================================== markdown (bản chép từ personal-wiki): toán + dấu $ trong chữ thư viện */
sec("markdown — toán");
(function () {
  var MD = A.markdown, R = function (s) { return MD.render(s, {}); }, n = function (h) { return (h.match(/class="math/g) || []).length; };
  kiem("toán: \\( \\), $…$, khối \\[ \\] thành nút .math giữ nguyên TeX trong data-tex", n(R("a \\(x_1\\) b $y*z$")) === 2 && /<div class="math math-d" data-tex="E=mc\^2">/.test(R("\\[\nE=mc^2\n\\]")) && /data-tex="x_1"/.test(R("\\(x_1\\)")) && R("\\(x_1 * x_2\\)").indexOf("<em>") === -1);
  kiem("giá tiền không phải công thức: $5 và $10, $20/tháng và $200/tháng", n(R("Giá $5 và $10")) === 0 && n(R("$20/tháng và $200/tháng")) === 0 && R("Giá $5 và $10").indexOf("$5 và $10") !== -1);
  // Lỗi cũ (lib-string.js, thẻ Z-function): hai dấu $ trong chữ thường dính nhau thành công thức giả. Luật pandoc KHÔNG tự cứu ca này, nên dữ liệu phải bọc `code`.
  var cardOld = "Tính z của P + '$' + T. Vị trí i của T khớp. Ký tự '$' không được xuất hiện trong P, T.", cardNew = "Tính z của `P + '$' + T`. Vị trí i của T khớp. Ký tự `'$'` không được xuất hiện trong P, T.";
  kiem("thẻ Z-function: chữ cũ sinh công thức giả, chữ đã sửa (code span) thì không", n(R(cardOld)) === 1 && n(R(cardNew)) === 0);
  var zCard = lib.get("z-function"), zCards = zCard ? zCard.cards.filter(function (c) { return c.a.indexOf("'$'") !== -1; }) : [];
  kiem("lib-string.js: thẻ Z-function còn '$' đều nằm trong code span (không sinh .math)", !!zCard && zCards.length >= 1 && zCards.every(function (c) { return n(R(c.a)) === 0 && n(R(c.q)) === 0; }));
  kiem("XSS: TeX có \" ' < > không thoát khỏi data-tex", (function () {
    var h = R("$x\" onmouseover=\"alert(1)$ và \\(<img src=x onerror=alert(1)>\\)");
    var tags = h.match(/<[^>]*>/g) || [];                                      // chỉ nhìn BÊN TRONG thẻ: chữ "onmouseover=" nằm trong nội dung (đã thoát) là vô hại
    return n(h) === 2 && h.indexOf("<img") === -1 && tags.every(function (t) { return !/\son[a-z]+\s*=/i.test(t.replace(/"[^"]*"/g, '""')); }) && h.indexOf("&lt;img") !== -1;
  })());
})();

async function userTests() {
  sec("dữ liệu người dùng");
  var tick = now0, store = A.store.memory(), U = A.user.create(store, { now: function () { return (tick += 1000); } });
  await U.open();
  var a = await U.saveItem({ name: "Li Chao Tree", category: "dp", tags: "cht", description: "Cây Li Chao", code: { lang: "cpp", title: "lichao.cpp", src: "struct X{};" } });
  kiem("thêm mục cá nhân: vào danh mục hợp nhất ngay", C.get(a.id).name === "Li Chao Tree" && U.items().length === 1 && C.all().some(function (e) { return e.id === a.id; }));
  var b = await U.saveItem({ id: a.id, name: "Li Chao Tree (sửa)" });
  kiem("sửa giữ nguyên ngày tạo, tăng ngày sửa, không tạo bản thứ hai", b.id === a.id && b.created === a.created && b.updated > a.updated && U.items().length === 1 && C.get(a.id).name === "Li Chao Tree (sửa)");
  await U.saveNote("dijkstra", "Nhớ: **dist** dùng long long");
  await U.saveNote(a.id, "ghi chú của mục tôi");
  kiem("ghi chú cá nhân cho mục dựng sẵn và mục của tôi; lưu rỗng thì xoá", U.note("dijkstra").text.indexOf("long long") !== -1 && (await U.saveNote("dijkstra", "  ")) === null && U.note("dijkstra") === null);
  await U.setMark("dijkstra", { bm: 1 }); await U.setMark("dijkstra", { st: 2 }); await U.setMark("dsu", { st: 1 });
  kiem("bookmark và trạng thái học độc lập, giữ nhau; trạng thái chỉ 0–3", U.isBookmarked("dijkstra") && U.status("dijkstra") === 2 && U.status("dsu") === 1 && (await U.setMark("dsu", { st: 99 })).st === 3);
  await U.setMark("dsu", { st: 0 });
  kiem("bỏ hết dấu thì xoá bản ghi (không rác)", U.marks().every(function (m) { return m.id !== "dsu"; }));
  var tpl = await U.saveTemplate({ title: "dsu.cpp", lang: "cpp", src: "struct DSU{};", tags: "Graph, DSU", algo: "dsu" });
  var noTitle = null; try { await U.saveTemplate({ title: " ", src: "x" }); } catch (e) { noTitle = e; }
  kiem("template: lưu, sửa theo id, thiếu tên bị từ chối", tpl.id.indexOf("t-") === 0 && bang(tpl.tags, ["graph", "dsu"]) && !!noTitle && (await U.saveTemplate({ id: tpl.id, title: "dsu.cpp", src: "v2" })).src === "v2" && U.templates().length === 1);
  var cs = await U.review("c1", 2); var cs2 = await U.review("c1", 3);
  kiem("ôn thẻ: trạng thái lưu và nối tiếp (reps tăng)", cs.reps === 1 && cs2.reps === 2 && U.cardState("c1").reps === 2);
  await U.logQuiz({ type: "mix", score: 3, total: 4, answers: [{ cat: "ds", r: "right" }] });
  kiem("lịch sử quiz được ghi", U.quizLog().length === 1 && U.quizLog()[0].score === 3);
  await U.saveDraft("note:dijkstra", "chưa lưu"); var dr = await U.getDraft("note:dijkstra");
  kiem("bản nháp lưu và đọc lại được; lưu ghi chú xoá nháp", dr.value === "chưa lưu" && (await U.saveNote("dijkstra", "chốt"), (await U.getDraft("note:dijkstra")) === undefined));
  var dump = JSON.parse(JSON.stringify(U.dump()));
  var U2 = A.user.create(A.store.memory(), { now: function () { return (tick += 1000); } }); await U2.open();
  var st = await U2.restore(dump, "merge");
  kiem("khôi phục (gộp) vào kho trống: đủ mục, ghi chú, template, dấu, thẻ, quiz", U2.items().length === 1 && U2.notes().length === 2 && U2.templates().length === 1 && U2.isBookmarked("dijkstra") && U2.cardState("c1").reps === 2 && U2.quizLog().length === 1 && st.added > 0);
  var again = await U2.restore(dump, "merge");
  kiem("khôi phục lần hai: không nhân đôi, bỏ qua bản không mới hơn", again.added === 0 && again.skipped > 0 && U2.items().length === 1);
  dump.items[0].name = "Tên mới hơn"; dump.items[0].updated += 1e6;
  await U2.restore(dump, "merge");
  kiem("bản trong tệp mới hơn thì đè", C.get(a.id).name === "Tên mới hơn");
  var junk = await U2.restore({ items: [{ id: "x", name: "hỏng" }, null, { id: "u-" + T.uid(), name: "" }], marks: [{ id: "a" }] }, "merge");
  kiem("dữ liệu hỏng trong tệp sao lưu bị bỏ qua, không làm hỏng kho", junk.added === 0 && U2.items().length === 1);
  await U2.restore({ items: [] }, "replace");
  kiem("khôi phục kiểu thay thế xoá hết dữ liệu cũ", U2.items().length === 0 && U2.notes().length === 0 && U2.templates().length === 0);
  await U.wipe();
  kiem("xoá sạch: kho và danh mục hợp nhất trống", U.items().length === 0 && C.userItems().length === 0 && U.marks().length === 0);
  C.setUser([]);
  // 10.000 mục cá nhân + ghi chú
  var Ub = A.user.create(A.store.memory(), { now: function () { return (tick += 1); } }); await Ub.open();
  var list = []; for (var i = 0; i < 10000; i++) list.push({ id: "u-" + T.uid(), name: "Mục cá nhân " + i, category: "mine", tags: ["t" + (i % 40)], description: "nội dung " + i, created: now0, updated: now0 });
  var t0b = Date.now(); await Ub.restore({ items: list, notes: list.slice(0, 2000).map(function (x) { return { id: x.id, text: "ghi chú " + x.name, updated: now0 }; }) }, "merge");
  kiem("nhập 10.000 mục + 2.000 ghi chú vào kho (" + (Date.now() - t0b) + " ms) và đọc lại đủ", Ub.items().length === 10000 && Ub.notes().length === 2000 && C.all().length >= 10000);
  var bi = F.build(C.all()), tc = Date.now(), cold = F.search(bi, "mục cá nhân 777", {}), msCold = Date.now() - tc;
  var tw = Date.now(); while (!F.warm(bi, 50)); var msWarmUp = Date.now() - tw, ts = Date.now(), res = F.search(bi, "mục cá nhân 778", {}), msWarm = Date.now() - ts;
  var slack = +process.env.ALGO_PERF_SLACK || 1;
  kiem("tìm sâu giữa 10.000 mục thật: lần ĐẦU (gấp toàn văn) " + msCold + " ms (< " + 400 * slack + "); gấp sẵn lúc rảnh hết " + msWarmUp + " ms; sau đó " + msWarm + " ms (< " + 100 * slack + ")", msCold < 400 * slack && msWarm < 100 * slack && cold.results[0].e.name === "Mục cá nhân 777" && res.results[0].e.name === "Mục cá nhân 778");
  C.setUser([]);
}

(async function main() {
  try { await userTests(); } catch (e) { sai++; console.log("  [SAI] ngoại lệ không bắt: " + (e && e.stack || e)); }
  gac.xong();
  console.log("\n" + "=".repeat(58));
  if (sai) { console.log("SAI " + sai + " / " + (ok + sai) + " phép kiểm"); process.exit(1); }
  console.log("Đạt — " + ok + " phép kiểm.");
})();
