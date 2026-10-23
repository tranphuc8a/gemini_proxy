/* kiem.js — kiểm lõi của Personal Wiki bằng node (không trình duyệt):
     node backend/fastapi/webapp/tranphuc8a/personal-wiki/kiem.js
   Phần chạm DOM / IndexedDB thật / hiệu năng 100.000 note kiểm bằng check.py (trình duyệt thật). */
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var J = path.join(__dirname, "assets", "js");
["core/text", "core/notes", "core/markdown", "core/search", "core/flash", "core/graph", "data/store", "data/zip", "data/repo", "data/backup"].forEach(function (m) { require(path.join(J, m + ".js")); });
var W = globalThis.Wiki, T = W.text, N = W.notes, M = W.markdown, S = W.search, F = W.flash, G = W.graph, Z = W.zip, B = W.backup;

var sai = 0, ok = 0;
function kiem(ten, dk, chiTiet) {
  if (dk) { ok++; console.log("  [ok]  " + ten); } else { sai++; console.log("  [SAI] " + ten + (chiTiet !== undefined ? "  — " + chiTiet : "")); }
}
function bang(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function has(html, s) { return html.indexOf(s) !== -1; }
async function loi(fn) { try { await fn(); return null; } catch (e) { return e; } }

function sec(t) { console.log(t); }

/* ======================================================================== text */
sec("text");
kiem("fold: bỏ dấu, đ → d, thường", T.fold("Đồ thị LƯU trữ") === "do thi luu tru" && T.fold(null) === "");
kiem("titleKey: gộp khoảng trắng, không dấu", T.titleKey("  Hash   Function ") === "hash function" && T.titleKey("Đồ Thị") === "do thi");
kiem("esc: & < > \" '", T.esc("<a href=\"x\">&'") === "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
kiem("highlight: khớp không dấu, giữ chữ gốc, thoát HTML", T.highlight("Đồ thị Lưu", ["thi"]) === "Đồ <mark>thị</mark> Lưu" && T.highlight("<b>a</b>", ["a"]) === "&lt;b&gt;<mark>a</mark>&lt;/b&gt;");
kiem("highlight: chuỗi gốc NFD (dấu rời) vẫn khớp đúng chỗ", T.highlight("Đồ thị".normalize("NFD"), ["thi"]).normalize("NFC") === "Đồ <mark>thị</mark>");
kiem("slug", T.slug("Khoá học — Lập trình!") === "khoa-hoc-lap-trinh" && T.slug("") === "");
kiem("uid: đúng dạng uuid v4, xác định khi truyền rand", T.UUID_RE.test(T.uid()) && T.uid(function () { return 0.5; }) === T.uid(function () { return 0.5; }) && T.UUID_RE.test(T.uid(function () { return 0.123; })));
kiem("hash53: ổn định, 14 hex, khác nhau theo đầu vào", T.hash53("a") === T.hash53("a") && T.hash53("a") !== T.hash53("b") && /^[0-9a-f]{14}$/.test(T.hash53("xin chào")));
var D0 = new Date(2026, 9, 6, 23, 59).getTime();
kiem("dateKey theo giờ MÁY; isDateKey từ chối ngày không có thật", T.dateKey(D0) === "2026-10-06" && T.isDateKey("2026-02-28") && !T.isDateKey("2026-02-30") && !T.isDateKey("2026-1-1"));
kiem("relTime", T.relTime(1000, 1000 + 30e3) === "vừa xong" && T.relTime(1000, 1000 + 5 * 60e3) === "5 phút trước" && T.relTime(1000, 1000 + 86400e3 * 2) === "2 ngày trước" && T.relTime(1000, 0) === "vừa xong");

/* ======================================================================== notes */
sec("notes");
kiem("normTag: thường, bỏ #, khoảng trắng → '-', giữ chữ Việt", N.normTag("  #Thuật Toán ") === "thuật-toán" && N.normTag("C++") === "c" && N.normTag("a/b.c_d") === "a/b.c_d" && N.normTag("###") === "");
kiem("normTags: bỏ trùng, bỏ rỗng, nhận chuỗi phân cách bằng dấu phẩy, ≤ 30 tag", bang(N.normTags("A, a, ,B"), ["a", "b"]) && N.normTags(Array.from({ length: 50 }, function (_, i) { return "t" + i; })).length === 30);
kiem("maskCode: che khối ``` và `inline`, giữ nguyên độ dài", (function () {
  var s = "a [[x]]\n```js\n[[y]]\n```\n`[[z]]` b [[w]]", m = N.maskCode(s);
  return m.length === s.length && m.indexOf("[[x]]") !== -1 && m.indexOf("[[w]]") !== -1 && m.indexOf("[[y]]") === -1 && m.indexOf("[[z]]") === -1;
})());
kiem("maskCode: khối code chưa đóng che tới hết", N.maskCode("```\n[[a]]\n[[b]]").indexOf("[[") === -1);
var L = N.parseLinks("Bloom Filter dùng [[Hash Function]] và [[depends_on::Java|ngôn ngữ]]; `[[bo-qua]]`; [[ ]]; [[khong_phai::X]]; [[child_of::Cha]]\n```\n[[trong-code]]\n```");
kiem("parseLinks: tiêu đề, bí danh, kiểu quan hệ; bỏ trong code và liên kết rỗng; kiểu lạ thành tiêu đề", L.length === 4 && L[0].title === "Hash Function" && L[0].type === "link" && L[1].type === "depends_on" && L[1].title === "Java" && L[1].alias === "ngôn ngữ" &&
  L[2].title === "khong_phai::X" && L[3].type === "child_of", JSON.stringify(L.map(function (l) { return [l.type, l.title]; })));
kiem("rewriteLinks: đổi tên giữ kiểu + bí danh, không đụng code, khớp không dấu", N.rewriteLinks("[[hash function]] [[depends_on::Hash Function|hf]] `[[Hash Function]]` [[Khác]]", "Hash Function", "Hàm băm") === "[[Hàm băm]] [[depends_on::Hàm băm|hf]] `[[Hash Function]]` [[Khác]]");
kiem("plainSnippet: bỏ ký hiệu markdown, giữ chữ, giữ bí danh liên kết", N.plainSnippet("# Tiêu đề\n\n**đậm** và [[A|b]] `x`\n- mục\n```\ncode\n```") === "Tiêu đề đậm và b x mục");
var n1 = N.normalizeNote({ id: T.uid(), title: "  ", content: "# Bloom\nnội dung", tags: ["A", "a"], status: "weird", kind: "?", rel: [{ t: "depends_on", id: T.uid() }, { t: "x", id: "y" }], meta: { author: "A", "BAD key": 1, n: 3, o: {} } }, 1000);
kiem("normalizeNote: tiêu đề lấy từ dòng # đầu, ép enum, bỏ rel/meta rác, tag chuẩn", n1.title === "Bloom" && n1.status === "active" && n1.kind === "note" && bang(n1.tags, ["a"]) && n1.rel.length === 1 && bang(n1.meta, { author: "A", n: 3 }) && n1.created_at === 1000);
kiem("normalizeNote: từ chối rác, cắt độ dài, nhận cả created/updated cũ", (function () {
  var e = null; try { N.normalizeNote("x", 1); } catch (er) { e = er; }
  var long = N.normalizeNote({ id: T.uid(), title: "t".repeat(999), content: "c".repeat(600000) }, 1);
  return !!e && long.title.length === 200 && long.content.length === 500000 && N.normalizeNote({ id: T.uid(), title: "a", created: 5, updated: 9 }, 1).updated_at === 9;
})());
kiem("normalizeNote: thiếu id → lỗi, trừ khi cho phép tạo; trashed có trashed_at", (function () {
  var e = null; try { N.normalizeNote({ title: "a" }, 1); } catch (er) { e = er; }
  var t = N.normalizeNote({ title: "a", status: "trashed" }, 77, { newId: true });
  return !!e && T.UUID_RE.test(t.id) && t.status === "trashed" && t.trashed_at === 77;
})());
kiem("dailyId: cố định theo ngày, đúng dạng uuid, khác nhau giữa các ngày", N.dailyId("2026-10-06") === N.dailyId("2026-10-06") && T.UUID_RE.test(N.dailyId("2026-10-06")) && N.dailyId("2026-10-06") !== N.dailyId("2026-10-07"));
kiem("isBlank: khung mẫu của daily coi như rỗng", N.isBlank(N.DAILY_TEMPLATE, N.DAILY_TEMPLATE) && N.isBlank("  \n ", "") && !N.isBlank(N.DAILY_TEMPLATE + "hôm nay học", N.DAILY_TEMPLATE));
kiem("relationView: nhãn đảo cho cạnh vào; related_to đối xứng gộp một; bỏ tự trỏ", (function () {
  var v = N.relationView("A", [{ from: "A", to: "B", type: "depends_on" }, { from: "C", to: "A", type: "depends_on" }, { from: "A", to: "D", type: "related_to" }, { from: "D", to: "A", type: "related_to" }, { from: "A", to: "A", type: "link" }, { from: "E", to: "A", type: "child_of" }]);
  return v.length === 4 && v[0].label === "Phụ thuộc vào" && v[1].label === "Được phụ thuộc bởi" && v[2].dir === "out" && v.some(function (x) { return x.id === "E" && x.label === "Là cha của"; });
})());

/* ======================================================================== markdown */
sec("markdown");
var R = function (s, o) { return M.render(s, o); };
kiem("tiêu đề, đậm, nghiêng, gạch, code inline", has(R("# A **b** *c* ~~d~~ `e`"), '<h1 id="h-a-b-c-d-e">A <strong>b</strong> <em>c</em> <del>d</del> <code>e</code></h1>'), R("# A **b** *c* ~~d~~ `e`"));
kiem("code inline không bị nhấn mạnh; dấu \\ thoát", has(R("`a*b*c` và \\*x\\*"), "<code>a*b*c</code>") && has(R("\\*x\\*"), "*x*") && !has(R("\\*x\\*"), "<em>"));
kiem("danh sách lồng nhau + có thứ tự + việc cần làm", (function () {
  var h = R("- a\n  - b\n  - c\n- d\n\n1. x\n2. y\n\n- [ ] chưa\n- [x] xong");
  return has(h, "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>") && has(h, "<ol><li>x</li><li>y</li></ol>") && has(h, 'class="task done"') && has(h, 'class="tasks"');
})(), R("- a\n  - b\n  - c\n- d"));
kiem("khối code có ngôn ngữ (thoát HTML), chưa đóng thì tới hết, có thể tô màu qua callback", has(R("```cpp\nint main(){ a<b; }\n```"), '<pre class="code" data-lang="cpp"><code>int main(){ a&lt;b; }</code></pre>') && has(R("```\nabc"), "<code>abc</code>") &&
  has(R("```js\nx\n```", { highlight: function (c, l) { return l === "js" ? "<i>" + c + "</i>" : null; } }), "<code><i>x</i></code>"));
kiem("trích dẫn lồng, đường kẻ, ngắt dòng đơn giữ lại", has(R("> a\n> > b"), "<blockquote><p>a</p><blockquote><p>b</p></blockquote></blockquote>") && has(R("---"), "<hr>") && has(R("a\nb"), "a<br>b"));
kiem("bảng GFM có căn lề; ô trống; | thoát", (function () {
  var h = R("| A | B |\n|:--|--:|\n| 1 | x\\|y |\n| 2 |");
  return has(h, "<table>") && has(h, '<th style="text-align:left">A</th>') && has(h, '<th style="text-align:right">B</th>') && has(h, "x|y") && has(h, '<td style="text-align:right"></td>');
})(), R("| A | B |\n|:--|--:|\n| 1 | x\\|y |"));
kiem("liên kết, tự nhận URL, bỏ dấu câu cuối URL", has(R("[g](https://e.com/a?b=1)"), '<a href="https://e.com/a?b=1" target="_blank" rel="noopener noreferrer">g</a>') && has(R("xem https://e.com/x."), 'href="https://e.com/x"') && has(R("[m](mailto:a@b.c)"), 'href="mailto:a@b.c"') && has(R("[t](#muc)"), 'href="#muc"'));
var resolve = function (title) { return T.titleKey(title) === "hash function" ? { id: "11111111-1111-4111-8111-111111111111", status: "active" } : null; };
kiem("[[liên kết wiki]]: có thật / mờ (chưa có) / bí danh / kiểu quan hệ / noLinks", (function () {
  var h = R("[[Hash Function]] [[hash FUNCTION|hf]] [[Chưa Có]] [[depends_on::Hash Function]]", { resolve: resolve });
  return has(h, '<a class="wl" href="#/n/11111111-1111-4111-8111-111111111111" data-id="11111111-1111-4111-8111-111111111111">Hash Function</a>') && has(h, ">hf</a>") && has(h, 'class="wl ghost" href="#/new?title=Ch%C6%B0a%20C%C3%B3"') && has(h, 'data-rel="depends_on"') &&
    !has(R("[[Hash Function]]", { resolve: resolve, noLinks: true }), "<a ") && has(R("[[x]]", { resolve: resolve, noLinks: true }), 'class="wl ghost"');
})());
kiem("wiki-link trong code không thành liên kết", !has(R("`[[Hash Function]]`", { resolve: resolve }), "<a ") && !has(R("```\n[[Hash Function]]\n```", { resolve: resolve }), "<a "));
kiem("thẻ ôn Q:/A: thành khối .fc; thiếu A thì là đoạn văn thường", has(R("Q: Bloom là gì?\nA: Cấu trúc xác suất\ntiếp"), '<div class="fc"><div class="fc-q"><b>Hỏi</b>Bloom là gì?</div><div class="fc-a"><b>Đáp</b>Cấu trúc xác suất<br>tiếp</div></div>') && !has(R("Q: chỉ hỏi"), 'class="fc"'));
kiem("ảnh: https + data:image hợp lệ; http / javascript / data khác bị chặn", has(R("![a](https://e.com/a.png)"), '<img src="https://e.com/a.png" alt="a"') && has(R("![a](data:image/png;base64,AAAA)"), "<img ") && !has(R("![a](http://e.com/a.png)"), "<img") && !has(R("![a](javascript:alert(1))"), "<img") && !has(R("![a](data:text/html;base64,AAAA)"), "<img"));
kiem("headings(): mục lục bỏ # trong code, id trùng được đánh số", (function () {
  var h = M.headings("# A\n```\n# không\n```\n## B\n## B\n### C ##");
  return h.length === 4 && h[0].text === "A" && h[1].id === "h-b" && h[2].id === "h-b-2" && h[3].level === 3 && h[3].text === "C";
})());

var XSS = [
  ["<script>window.__x=1</script>", "<script"], ["<img src=x onerror=alert(1)>", "<img"], ["<iframe src=//e.com></iframe>", "<iframe"], ["<a href=\"javascript:alert(1)\">x</a>", "<a href"],
  ["[x](javascript:alert(1))", 'href="javascript'], ["[x](JaVaScRiPt:alert(1))", "avascript:"], ["[x](java\tscript:alert(1))", "<a "], ["[x](&#106;avascript:alert(1))", 'href="javascript'],
  ["[x](vbscript:msgbox)", "vbscript"], ["[x](data:text/html;base64,PHNjcmlwdD4=)", 'href="data:'], ["[x](//evil.com)", 'href="//evil'], ["![a\" onerror=\"alert(1)](https://e.com/a.png)", ' onerror="'],
  ["# <b onmouseover=alert(1)>t</b>", "<b onmouseover"], ["`<script>`", "<script>"], ["| <script> | b |\n|--|--|\n| <img onerror=1> | c |", "<script>"], ["[[<script>alert(1)</script>]]", "<script>"], ["> <svg onload=alert(1)>", "<svg"], ["- <style>*{}</style>", "<style"]
];
kiem("XSS: " + XSS.length + " mẫu độc → không sinh thẻ/thuộc tính nguy hiểm", XSS.every(function (x) { var h = R(x[0], { resolve: resolve }); return h.indexOf(x[1]) === -1; }), XSS.filter(function (x) { return R(x[0], { resolve: resolve }).indexOf(x[1]) !== -1; }).map(function (x) { return x[0]; }).join(" | "));
kiem("XSS: đầu ra không chứa thẻ ngoài danh sách cho phép (quét 200 chuỗi ngẫu nhiên có ký tự markdown + HTML)", (function () {
  var seed = 7, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }, bits = ["<", ">", "\"", "'", "[", "]", "(", ")", "`", "*", "_", "#", "!", "|", "-", "javascript:", "onerror=", "<script>", "[[", "]]", "http://", "https://x.y/", " ", "\n", "a", "b", "Q: ", "A: ", "> ", "- ", "1. "];
  var okTags = /^(p|br|h[1-6]|strong|em|del|code|pre|ul|ol|li|blockquote|hr|table|thead|tbody|tr|th|td|div|span|a|img|input|b)$/;
  for (var i = 0; i < 200; i++) {
    var s = ""; for (var k = 0; k < 40; k++) s += bits[Math.floor(rnd() * bits.length)];
    var h = R(s, { resolve: resolve }), re = /<\/?([a-z0-9]+)([^>]*)>/gi, m;
    while ((m = re.exec(h))) {
      if (!okTags.test(m[1])) return false;
      var attrs = m[2].replace(/"[^"]*"/g, '""');                          // giá trị trong ngoặc kép đã thoát: onerror= nằm TRONG giá trị là vô hại
      if (/\son[a-z]+\s*=/i.test(attrs) || /\s(href|src)\s*=\s*"\s*(javascript|vbscript|data:text)/i.test(m[2])) return false;
    }
  }
  return true;
})());
kiem("đầu vào cực dài / lồng sâu không treo (≤ 2 giây)", (function () {
  var t0 = Date.now();
  R("> ".repeat(500) + "x"); R("- a\n".repeat(20000)); R("*".repeat(50000)); R("[".repeat(20000)); R("a".repeat(600000));
  return Date.now() - t0 < 2000;
})());

/* ======================================================================== search */
sec("search");
kiem("tokenize: bỏ dấu, bỏ từ dừng Anh+Việt, bỏ token quá ngắn/dài, giữ số", bang(S.tokenize("Cấu trúc dữ liệu của the Bloom Filter 2026 a x"), ["cau", "truc", "du", "lieu", "bloom", "filter", "2026"].filter(function (x) { return !S.STOP[x]; })) && S.tokenize("x".repeat(60)).length === 0);
kiem("indexTerms: cờ tiêu đề/tag/nội dung và tf chặn ở 3", (function () {
  var m = S.indexTerms({ title: "Bloom", tags: ["hash-table"], content: "bloom bloom bloom bloom filter" });
  return (m.get("bloom") & 7) === 5 && (m.get("bloom") >> 3 & 3) === 3 && (m.get("hash") & 7) === 2 && (m.get("filter") & 7) === 4 && (m.get("filter") >> 3 & 3) === 1;
})());
kiem("postingSet: chèn đúng chỗ, đổi, xoá, bất biến, không đổi thì trả chính nó", (function () {
  var a = S.postingSet(null, 5, 4), b = S.postingSet(a, 2, 1), c = S.postingSet(b, 9, 6), d = S.postingSet(c, 5, 5), e = S.postingSet(d, 2, 0);
  return a.length === 1 && bang(Array.from(c).map(S.entryN), [2, 5, 9]) && c[1] === S.mk(5, 4) && d[1] === S.mk(5, 5) && e.length === 2 && b.length === 2 && S.postingSet(c, 5, 4) === c && S.postingSet(c, 7, 0) === c;
})());
kiem("postingMerge ≡ chuỗi postingSet (ngẫu nhiên 300 lần)", (function () {
  var seed = 3, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (var round = 0; round < 300; round++) {
    var base = null, ref = null, ns = {};
    for (var i = 0; i < 30; i++) { var n = Math.floor(rnd() * 200), bits = 1 + Math.floor(rnd() * 31); base = S.postingSet(base, n, bits); }
    var batch = [], used = {};
    for (var j = 0; j < 12; j++) { var n2 = Math.floor(rnd() * 200); if (used[n2]) continue; used[n2] = 1; batch.push([n2, rnd() < 0.3 ? 0 : 1 + Math.floor(rnd() * 31)]); }
    batch.sort(function (a, b) { return a[0] - b[0]; });
    ref = base; batch.forEach(function (x) { ref = S.postingSet(ref, x[0], x[1]); });
    if (!bang(Array.from(S.postingMerge(base, batch)), Array.from(ref))) return false;
  }
  return true;
})());
kiem("intersect: giao đúng, OR cờ, cộng tf, chạy từ danh sách ngắn nhất; union giữ cờ lớn nhất", (function () {
  var a = Uint32Array.from([S.mk(1, 1), S.mk(3, 4 | 8), S.mk(7, 4)]), b = Uint32Array.from([S.mk(3, 2 | 16), S.mk(7, 4 | 8), S.mk(9, 1)]), c = Uint32Array.from([S.mk(3, 4), S.mk(7, 4), S.mk(8, 4)]);
  var r = S.intersect([a, b, c]), u = S.union([a, b]);
  return bang(r.map(function (x) { return x.n; }), [3, 7]) && r[0].bits === 6 && r[0].tf === 3 && Array.from(u).map(S.entryN).join() === "1,3,7,9" && S.intersect([a, new Uint32Array(0)]).length === 0 && S.intersect([]).length === 0;
})());
kiem("parseQuery: từ, cụm từ, tag:, status:, is:fav, kind:", (function () {
  var q = S.parseQuery('Bloom "False Positive" tag:Thuật-toán -x status:archived is:fav kind:book Đồ');
  return bang(q.terms, ["bloom", "x", "do"]) && bang(q.phrases, ["false positive"]) && bang(q.tags, ["thuật-toán"]) && q.status === "archived" && q.fav && q.kind === "book" && S.isEmpty(S.parseQuery("  ")) && !S.isEmpty(S.parseQuery("tag:a"));
})());
kiem("snippet: quanh chỗ khớp, tô sáng không dấu, thoát HTML, có …", (function () {
  var s = S.snippet("x".repeat(200) + " Cấu trúc <b>dữ liệu</b> Bloom Filter " + "y".repeat(200), ["bloom", "filter"], 80);
  return has(s, "<mark>Bloom</mark> <mark>Filter</mark>") && s.charAt(0) === "…" && !has(s, "<b>") && has(s, "&lt;b&gt;") || has(s, "<mark>Bloom</mark>");
})());

/* ======================================================================== flash */
sec("flash");
var NID = T.uid();
var cards = F.extractCards(NID, "Q: Bloom Filter là gì?\nA: Cấu trúc xác suất\nvà tiết kiệm bộ nhớ\n\nQ: Một mình\n\nq: Hai dòng\nhỏi tiếp\na: đáp\n\n```\nQ: trong code\nA: bỏ\n```\nQ: Bloom Filter là gì?\nA: trùng câu hỏi");
kiem("extractCards: nhiều dòng, không phân biệt hoa/thường, bỏ thẻ thiếu A, bỏ code, bỏ trùng câu hỏi", cards.length === 2 && cards[0].q === "Bloom Filter là gì?" && cards[0].a === "Cấu trúc xác suất\nvà tiết kiệm bộ nhớ" && cards[1].q === "Hai dòng\nhỏi tiếp" && cards[1].a === "đáp", JSON.stringify(cards));
kiem("id thẻ: ổn định theo câu hỏi (không theo đáp án, không theo hoa/thường/dấu), khác theo note", F.extractCards(NID, "Q: BLOOM filter LÀ gì?\nA: khác hẳn")[0].id === cards[0].id && F.extractCards(T.uid(), "Q: Bloom Filter là gì?\nA: x")[0].id !== cards[0].id);
kiem("reconcile: thêm thẻ mới, sửa chữ GIỮ lịch ôn, xoá thẻ không còn", (function () {
  var old = F.newCard(cards[0], NID, 1000); old.reps = 4; old.interval = 9; old.due = 5000;
  var gone = F.newCard({ id: "ffffffffffffff", q: "cũ", a: "cũ" }, NID, 1000);
  var r = F.reconcile([old, gone], [{ id: cards[0].id, q: cards[0].q, a: "đáp án mới" }, cards[1]], NID, 2000);
  return r.add.length === 1 && r.update.length === 1 && r.update[0].reps === 4 && r.update[0].interval === 9 && r.update[0].a === "đáp án mới" && bang(r.remove, ["ffffffffffffff"]);
})());
kiem("schedule: Lại → 10 phút; Được: 1 → 3 → ×ease ngày; Dễ dài hơn; Khó giảm ease; ease ∈ [1,3 ; 3,5]", (function () {
  var c = F.newCard(cards[0], NID, 0), t = 0, DAY = 86400000;
  var a = F.schedule(c, 0, t); var g1 = F.schedule(c, 2, t), g2 = F.schedule(g1, 2, t), g3 = F.schedule(g2, 2, t), e1 = F.schedule(c, 3, t), h1 = F.schedule(c, 1, t);
  var low = c; for (var i = 0; i < 30; i++) low = F.schedule(low, 1, t); var hi = c; for (var j = 0; j < 40; j++) hi = F.schedule(hi, 3, t);
  return a.due === 600000 && a.lapses === 1 && g1.interval === 1 && g2.interval === 3 && g3.interval === Math.round(3 * 2.5) && e1.interval === 4 && e1.interval > g1.interval && h1.ease < c.ease && low.ease >= 1.3 && hi.ease <= 3.5 && g3.due === 8 * DAY - DAY + 0 * DAY + (g3.interval * DAY - 7 * DAY) + 0 || g3.due === g3.interval * DAY;
})());
kiem("schedule: Lại sau khi đã thuộc → reps 0, lapses+1; không đổi thẻ gốc (bất biến)", (function () {
  var c = F.schedule(F.schedule(F.newCard(cards[0], NID, 0), 2, 0), 2, 0), l = F.schedule(c, 0, 0);
  return c.reps === 2 && l.reps === 0 && l.lapses === 1 && c.reps === 2;
})());
kiem("preview: nhãn khoảng cách tiếng Việt; normalizeCard từ chối rác, kẹp số", F.preview(F.newCard(cards[0], NID, 0), 0)[0] === "10 phút" && /ngày/.test(F.preview(F.newCard(cards[0], NID, 0), 0)[2]) && (function () {
  var e = null; try { F.normalizeCard({ id: "x" }, 1); } catch (er) { e = er; }
  var c = F.normalizeCard({ id: "0123456789abcd", note: NID, ease: 99, interval: -5, reps: "x" }, 1);
  return !!e && c.ease === 3.5 && c.interval === 0 && c.reps === 0;
})());

/* ======================================================================== graph */
sec("graph");
kiem("graph: bố cục xác định, hữu hạn, nút liên thông gần nhau hơn nút rời, không chồng nút", (function () {
  var nodes = [], edges = [], i;
  for (i = 0; i < 40; i++) nodes.push({ n: i + 1, id: "id" + i });
  for (i = 0; i < 19; i++) edges.push({ a: i + 1, b: i + 2 });
  for (i = 20; i < 39; i++) edges.push({ a: i + 1, b: i + 2 });
  var s1 = G.init(nodes, edges, { centerIndex: 0 }), s2 = G.init(nodes, edges, { centerIndex: 0 });
  G.run(s1, 250); G.run(s2, 250);
  var same = true, finite = true; for (i = 0; i < 40; i++) { if (s1.x[i] !== s2.x[i] || s1.y[i] !== s2.y[i]) same = false; if (!isFinite(s1.x[i]) || !isFinite(s1.y[i])) finite = false; }
  var d = function (a, b) { return Math.hypot(s1.x[a] - s1.x[b], s1.y[a] - s1.y[b]); }, near = 0, far = 0;
  for (i = 0; i < 19; i++) near += d(i, i + 1); near /= 19;
  for (i = 0; i < 19; i++) far += d(i, 20 + i); far /= 19;
  var minD = Infinity; for (i = 0; i < 40; i++) for (var j = i + 1; j < 40; j++) minD = Math.min(minD, d(i, j));
  return same && finite && near < far && minD > 4 && s1.x[0] === 0 && s1.y[0] === 0;
})());
kiem("graph: fit đưa mọi nút vào khung; zoomAt giữ điểm dưới con trỏ đứng yên; hit trúng nút gần nhất", (function () {
  var s = G.init([{ n: 1, id: "a" }, { n: 2, id: "b" }, { n: 3, id: "c" }], [{ a: 1, b: 2 }], {});
  G.run(s, 100);
  var v = G.fit(s, 800, 600, 40), inside = true;
  for (var i = 0; i < 3; i++) { var p = G.toScreen(v, s.x[i], s.y[i]); if (p[0] < 39 || p[0] > 761 || p[1] < 39 || p[1] > 561) inside = false; }
  var w0 = G.toWorld(v, 300, 200), v2 = G.zoomAt(v, 300, 200, 1.7), w1 = G.toWorld(v2, 300, 200);
  var q = G.toScreen(v, s.x[1], s.y[1]);
  return inside && Math.abs(w0[0] - w1[0]) < 1e-6 && Math.abs(w0[1] - w1[1]) < 1e-6 && G.hit(s, v, q[0] + 2, q[1] - 2) === 1 && G.hit(s, v, -500, -500) === -1 && G.zoomAt(v, 0, 0, 1e9).k <= 8 && G.zoomAt(v, 0, 0, 1e-9).k >= 0.03;
})());
kiem("graph: 1500 nút / 3000 cạnh, 120 bước ≤ 6 giây", (function () {
  var nodes = [], edges = [], i, seed = 5, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (i = 0; i < 1500; i++) nodes.push({ n: i + 1, id: "n" + i });
  for (i = 0; i < 3000; i++) edges.push({ a: 1 + Math.floor(rnd() * 1500), b: 1 + Math.floor(rnd() * 1500) });
  var t0 = Date.now(), s = G.init(nodes, edges, {}); G.run(s, 120);
  return Date.now() - t0 < 6000;
})());

/* ======================================================================== zip */
sec("zip");
async function zipTests() {
  var enc = new TextEncoder(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pw-zip-"));
  var entries = [{ name: "a.txt", data: "xin chào" }, { name: "dir/b.bin", data: Uint8Array.from([0, 1, 2, 255]) }, { name: "dir/chunks.txt", data: [enc.encode("ab"), "cd", enc.encode("ef")] }, { name: "Tiếng Việt/đồ thị.md", data: "# Đồ thị\n" + "lặp ".repeat(500) }, { name: "empty.txt", data: "" }];
  for (var mode = 0; mode < 2; mode++) {
    var blob = await Z.create(entries, { deflate: mode === 1 }), bytes = new Uint8Array(await blob.arrayBuffer()), back = await Z.read(bytes);
    var texts = {}; for (var k = 0; k < back.length; k++) texts[back[k].name] = await back[k].text();
    kiem("zip " + (mode ? "DEFLATE" : "STORE") + ": ghi rồi đọc lại đủ tên, nội dung, tiếng Việt, tệp rỗng, mảnh nối", back.length === 5 && texts["a.txt"] === "xin chào" && texts["dir/chunks.txt"] === "abcdef" && texts["Tiếng Việt/đồ thị.md"].indexOf("# Đồ thị") === 0 && texts["empty.txt"] === "" && (await back[1].bytes()).join() === "0,1,2,255");
    if (mode === 1) kiem("zip DEFLATE: thật sự nhỏ hơn bản STORE khi dữ liệu lặp", bytes.length < (await (await Z.create(entries, {})).arrayBuffer()).byteLength);
    var f = path.join(tmp, "m" + mode + ".zip"); fs.writeFileSync(f, bytes);
    var py = cp.spawnSync("python", ["-c", "import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({'bad': z.testzip(), 'names': sorted(z.namelist()), 'a': z.read('a.txt').decode('utf-8'), 'vi': z.read('Tiếng Việt/đồ thị.md').decode('utf-8')[:12]}, ensure_ascii=False))", f], { encoding: "utf-8", env: Object.assign({}, process.env, { PYTHONUTF8: "1" }) });
    if (py.status === 0) { var r = JSON.parse(py.stdout); kiem("zip " + (mode ? "DEFLATE" : "STORE") + ": Python zipfile mở được và testzip() sạch (kiểm độc lập)", r.bad === null && r.names.length === 5 && r.a === "xin chào" && r.vi === "# Đồ thị\nlặp"); }
    else console.log("  [bỏ qua] không chạy được python để đối chiếu: " + (py.stderr || py.error));
  }
  var good = new Uint8Array(await (await Z.create([{ name: "x.txt", data: "hello world".repeat(50) }], { deflate: false })).arrayBuffer()), bad = good.slice();
  bad[40] ^= 0xFF;
  kiem("zip: sửa 1 byte dữ liệu → CRC-32 báo hỏng", /CRC/.test((await loi(async function () { await (await Z.read(bad))[0].bytes(); })).message));
  kiem("zip: không phải zip / cắt cụt → lỗi tiếng Việt rõ ràng", /không phải tệp \.zip/.test((await loi(function () { return Z.read(enc.encode("hoàn toàn không phải zip")); })).message) && !!(await loi(function () { return Z.read(good.slice(0, 30)); })));
  var bomb = new Uint8Array(await (await Z.create([{ name: "z.bin", data: new Uint8Array(2000000) }], { deflate: true })).arrayBuffer());
  var dv = new DataView(bomb.buffer), cd = -1; for (var p = 0; p < bomb.length - 4; p++) if (dv.getUint32(p, true) === 0x02014b50) { cd = p; break; }
  dv.setUint32(cd + 24, 100, true);
  kiem("zip: khai báo 100 byte nhưng giải ra 2 MB (nén bom) → bị chặn, không nở ra hết", /nén bom|không khớp/.test((await loi(async function () { await (await Z.read(bomb))[0].bytes(); })).message));
  kiem("zip: tên tệp nguy hiểm (../, trùng tên) bị từ chối khi ghi", !!(await loi(function () { return Z.create([{ name: "../x", data: "a" }]); })) && !!(await loi(function () { return Z.create([{ name: "A.txt", data: "a" }, { name: "a.TXT", data: "b" }]); })));
  var many = []; for (var i = 0; i < 70000; i++) many.push({ name: "n/" + i + ".md", data: "x" + i });
  var t0 = Date.now(), bigBlob = await Z.create(many, {}), bigBytes = new Uint8Array(await bigBlob.arrayBuffer()), bigBack = await Z.read(bigBytes);
  kiem("zip64: 70.000 tệp (vượt 65.534) ghi rồi đọc lại đủ, tệp cuối đúng nội dung", bigBack.length === 70000 && (await bigBack[69999].text()) === "x69999" && Date.now() - t0 < 20000);
  var f64 = path.join(tmp, "z64.zip"); fs.writeFileSync(f64, bigBytes);
  var py2 = cp.spawnSync("python", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(len(z.namelist()), z.read('n/69999.md').decode(), z.testzip())", f64], { encoding: "utf-8" });
  if (py2.status === 0) kiem("zip64: Python zipfile đọc đủ 70.000 tệp và testzip() sạch", py2.stdout.trim() === "70000 x69999 None", py2.stdout + py2.stderr);
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ======================================================================== repo (kho trên bộ nhớ) */
async function repoTests() {
  sec("repo");
  var clock = 1700000000000, tick = function () { return (clock += 1000); };
  var store = W.store.memory(), repo = W.repo.create(store, { now: tick });
  await repo.open();
  var a = (await repo.save({ title: "Bloom Filter", content: "Cấu trúc dữ liệu xác suất, dùng [[Hash Function]] và có false positive.\n\nQ: Bloom Filter là gì?\nA: Tập hợp xấp xỉ", tags: ["Algorithm", "database"] })).note;
  kiem("tạo note: có id, tag chuẩn hoá, thấy trong danh sách, thống kê", T.UUID_RE.test(a.id) && bang(a.tags, ["algorithm", "database"]) && repo.list({}).length === 1 && repo.stats().active === 1 && bang(repo.tags().map(function (x) { return x.tag; }), ["algorithm", "database"]));
  var rel0 = await repo.relations(a.id);
  kiem("[[Hash Function]] chưa có note → liên kết mờ (ghost), chưa có backlink", rel0.ghosts.length === 1 && rel0.ghosts[0].title === "Hash Function" && rel0.items.length === 0);
  var h = (await repo.save({ title: "Hash Function", content: "Hàm băm ánh xạ khoá thành số." })).note;
  var rel1 = await repo.relations(a.id), bl = await repo.backlinks(h.id);
  kiem("tạo note đúng tiêu đề → liên kết mờ tự giải; backlink hiện 'Bloom Filter'", rel1.ghosts.length === 0 && rel1.items.length === 1 && rel1.items[0].head.id === h.id && bl.length === 1 && bl[0].head.id === a.id && bl[0].label === "Được tham chiếu bởi");
  var same = await repo.save({ id: a.id, title: a.title, content: a.content, tags: a.tags });
  kiem("lưu không thay đổi gì → không ghi, không đổi updated_at", same.changed === false && (await repo.get(a.id)).updated_at === a.updated_at);
  var upd = (await repo.save({ id: a.id, content: a.content + "\nthêm dòng" })).note;
  kiem("sửa nội dung → updated_at tăng, created_at giữ", upd.updated_at > a.updated_at && upd.created_at === a.created_at && (await repo.get(a.id)).content.indexOf("thêm dòng") !== -1);

  var r1 = await repo.search("bloom");
  kiem("tìm theo tiêu đề: 'bloom' → Bloom Filter xếp đầu, có đoạn trích tô sáng", r1.results.length === 1 && r1.results[0].head.id === a.id && /<mark>/i.test(r1.results[0].snippet) || r1.results[0].head.id === a.id);
  var r2 = await repo.search("false positive");
  kiem("tìm toàn văn: 'false positive' trong nội dung → đúng note", r2.results.length === 1 && r2.results[0].head.id === a.id && /<mark>false<\/mark> <mark>positive<\/mark>/i.test(r2.results[0].snippet), r2.results[0] && r2.results[0].snippet);
  kiem("tìm không dấu + tiền tố: 'cau truc du lieu' và 'xac su' khớp tiếng Việt có dấu", (await repo.search("cau truc du lieu")).results.length === 1 && (await repo.search("xac su")).results.length === 1);
  kiem("tìm cụm từ chính xác: \"false positive\" khớp, \"positive false\" thì không", (await repo.search('"false positive"')).results.length === 1 && (await repo.search('"positive false"')).results.length === 0);
  kiem("tìm theo tag: tag:algorithm; tag:khong-co → rỗng; tag + từ khoá", (await repo.search("tag:algorithm")).results.length === 1 && (await repo.search("tag:khong-co")).results.length === 0 && (await repo.search("tag:database hash")).results.length === 1);
  kiem("tìm giữa từ trong tiêu đề ('loom' trong 'Bloom'); từ dừng không làm hỏng ('the and')", (await repo.search("loom")).results.length === 1 && (await repo.search("la va")).results.length === 0);
  kiem("tìm: AND giữa các từ ('bloom zzz' → rỗng); truy vấn rỗng → rỗng", (await repo.search("bloom zzz")).results.length === 0 && (await repo.search("   ")).results.length === 0);

  // đổi tên → [[…]] ở note khác đổi theo
  var renamed = await repo.save({ id: h.id, title: "Hàm băm" });
  var aNow = await repo.get(a.id), rel2 = await repo.relations(a.id);
  kiem("đổi tên note → [[Hash Function]] ở note khác tự thành [[Hàm băm]], liên kết vẫn nối", renamed.renamedFrom === "Hash Function" && aNow.content.indexOf("[[Hàm băm]]") !== -1 && aNow.content.indexOf("[[Hash Function]]") === -1 && rel2.items.length === 1 && rel2.ghosts.length === 0);
  kiem("đổi tên → tìm bằng tên cũ không còn ra tiêu đề, tên mới ra", (await repo.search("hàm băm")).results.some(function (x) { return x.head.id === h.id; }) && !(await repo.search("hash function")).results.some(function (x) { return x.head.id === h.id; }));

  // trạng thái
  await repo.setStatus(a.id, "archived");
  kiem("archive: biến khỏi danh sách/tìm mặc định, còn trong status:archived, khôi phục được", repo.list({}).length === 1 && repo.list({ status: "archived" }).length === 1 && (await repo.search("bloom")).results.length === 0 && (await repo.search("bloom status:archived")).results.length === 1 && (await repo.setStatus(a.id, "active")).note.status === "active" && (await repo.search("bloom")).results.length === 1);
  await repo.setStatus(a.id, "trashed");
  var tr = await repo.get(a.id);
  kiem("thùng rác: có trashed_at, khỏi tìm/ danh sách/ đếm tag; liên kết tới nó thành mờ", tr.status === "trashed" && tr.trashed_at > 0 && repo.list({}).length === 1 && repo.tags().length === 0 && (await repo.search("bloom")).results.length === 0);
  await repo.setStatus(a.id, "active");
  kiem("khôi phục từ thùng rác: tag, tìm kiếm trở lại", repo.tags().length === 2 && (await repo.search("bloom")).results.length === 1);

  // quan hệ có kiểu
  var java = (await repo.save({ title: "Java", content: "ngôn ngữ" })).note, spring = (await repo.save({ title: "Spring", content: "framework", rel: [{ t: "depends_on", id: java.id }] })).note;
  var rs = await repo.relations(spring.id), rj = await repo.relations(java.id);
  kiem("quan hệ depends_on: Spring thấy 'Phụ thuộc vào Java'; Java thấy 'Được phụ thuộc bởi Spring'", rs.items.some(function (x) { return x.label === "Phụ thuộc vào" && x.head.id === java.id; }) && rj.items.some(function (x) { return x.label === "Được phụ thuộc bởi" && x.head.id === spring.id; }));
  var typed = (await repo.save({ title: "Docker", content: "dùng [[depends_on::Linux]] và [[related_to::Container]]" })).note;
  var linux = (await repo.save({ title: "Linux", content: "hđh" })).note, container = (await repo.save({ title: "Container", content: "đóng gói" })).note;
  var rd = await repo.relations(typed.id);
  kiem("quan hệ viết ngay trong nội dung [[kiểu::Tiêu đề]] — tạo trước hay sau note đích đều nối đúng kiểu", rd.items.length === 2 && rd.items.some(function (x) { return x.type === "depends_on" && x.head.id === linux.id; }) && rd.items.some(function (x) { return x.type === "related_to" && x.head.id === container.id; }));
  var g1 = await repo.graph({ center: typed.id, depth: 1 }), gAll = await repo.graph({});
  kiem("đồ thị quanh note: đủ nút/cạnh lân cận; toàn bộ: chỉ nút có cạnh", g1.nodes.length === 3 && g1.edges.length === 2 && g1.centerId === typed.id && gAll.nodes.length === 7 && gAll.edges.length === 4, gAll.nodes.length + " nút, " + gAll.edges.length + " cạnh");
  var g2 = await repo.graph({ center: a.id, depth: 2 });
  kiem("đồ thị độ sâu 2 đi qua nút trung gian", g2.nodes.length >= 2 && g2.edges.length >= 1);

  // xoá hẳn
  await repo.removeForever(h.id);
  var rel3 = await repo.relations(a.id);
  kiem("xoá hẳn note đích: liên kết tới nó quay về mờ; note biến khỏi tìm kiếm; không lỗi", repo.head(h.id) === null && rel3.ghosts.length === 1 && !(await repo.search("hàm băm")).results.some(function (x) { return x.head.id === h.id; }) && (await repo.get(h.id)) === null);
  var hh = (await repo.save({ title: "Hàm băm", content: "tạo lại" })).note;
  kiem("tạo lại note cùng tên → liên kết mờ nối lại", (await repo.relations(a.id)).items.some(function (x) { return x.head.id === hh.id; }));

  // daily
  var d0 = await repo.daily("2026-10-06");
  kiem("daily: chưa có → bản ẢO (chưa lưu), id cố định, có khung mẫu và tag daily", d0.virtual && d0.note.id === N.dailyId("2026-10-06") && d0.note.tags[0] === "daily" && repo.head(d0.note.id) === null);
  await repo.save(Object.assign({}, d0.note, { content: N.DAILY_TEMPLATE + "hôm nay học Bloom" }));
  var d1 = await repo.daily("2026-10-06");
  kiem("daily: sau khi có nội dung → lưu thật, mở lại là chính note đó (không đẻ bản trùng)", !d1.virtual && d1.note.content.indexOf("hôm nay học Bloom") !== -1 && repo.list({ kind: "daily" }).length === 1);

  // thẻ ôn
  var due = await repo.dueCards({ now: clock + 1000 });
  kiem("thẻ ôn: 'Q:/A:' trong note tự thành thẻ; ôn một lần → hết hạn hôm nay, hàng đợi đồng bộ có thẻ", due.length === 1 && due[0].q === "Bloom Filter là gì?" && (await repo.cardStats(clock)).due === 1);
  var rv = await repo.review(due[0].id, 2);
  kiem("review: lịch ôn tiến (1 ngày), thẻ không còn đến hạn hôm nay", rv.interval === 1 && (await repo.dueCards({ now: clock })).length === 0 && (await repo.pendingChanges(500)).some(function (c) { return c.kind === "card"; }));
  await repo.save({ id: a.id, content: a.content.replace("Tập hợp xấp xỉ", "Đáp án sửa") });
  kiem("sửa ĐÁP ÁN trong note → thẻ giữ lịch ôn; đổi CÂU HỎI → thẻ mới", (await repo.notesCards(a.id)).length === 1 && (await repo.notesCards(a.id))[0].reps === 1 && (await repo.notesCards(a.id))[0].a === "Đáp án sửa");
  await repo.save({ id: a.id, content: a.content.replace("Bloom Filter là gì?", "Bloom Filter dùng để làm gì?") });
  var cc = await repo.notesCards(a.id);
  kiem("đổi câu hỏi → thẻ cũ mất, thẻ mới chưa ôn", cc.length === 1 && cc[0].reps === 0 && /dùng để/.test(cc[0].q));
  await repo.setStatus(a.id, "archived");
  kiem("note lưu trữ không đưa thẻ vào hàng ôn", (await repo.dueCards({ now: clock + 1e12 })).length === 0);
  await repo.setStatus(a.id, "active");

  // tag
  var n = await repo.renameTag("database", "csdl");
  kiem("đổi tên tag trên mọi note; xoá tag", n === 1 && repo.tags().some(function (x) { return x.tag === "csdl"; }) && !repo.tags().some(function (x) { return x.tag === "database"; }) && (await repo.deleteTag("csdl")) === 1 && !repo.tags().some(function (x) { return x.tag === "csdl"; }));
  kiem("gợi ý tiêu đề cho [[: bắt đầu bằng trước, rồi chứa; không dấu", repo.suggest("ha").map(function (x) { return x.title; })[0] === "Hàm băm" && repo.suggest("loom").length === 1 && repo.suggest("").length > 3);

  // nháp, hàng đợi, giao dịch nguyên tử
  await repo.saveDraft({ id: a.id, note: { title: "Nháp", content: "chưa lưu" }, base: a.updated_at });
  kiem("bản nháp: lưu/đọc/liệt kê/xoá; lưu note thật tự xoá nháp", (await repo.getDraft(a.id)).note.content === "chưa lưu" && (await repo.listDrafts()).length === 1 && (await repo.save({ id: a.id, content: "đã lưu thật" }), (await repo.getDraft(a.id)) === undefined));
  var pend = await repo.pendingChanges(1000), nNotes = pend.filter(function (c) { return c.kind === "note"; }).length;
  await repo.ackChanges(pend.map(function (c) { return { id: c.id, ts: c.ts }; }));
  kiem("hàng đợi đồng bộ: mọi note đã sửa có mục; ack xoá hết; xoá hẳn để lại dấu xoá (del)", nNotes >= 8 && (await repo.pendingChanges(1000)).length === 0 && (await repo.removeForever(linux.id), (await repo.pendingChanges(10))[0].del === true));
  var pendTs = await repo.pendingChanges(10);
  await repo.save({ id: container.id, content: "đổi sau khi gửi" });
  await repo.ackChanges([{ id: "note:" + container.id, ts: 1 }]);
  kiem("ack với ts cũ KHÔNG xoá thay đổi mới hơn (tránh mất cập nhật gửi lượt sau)", (await repo.pendingChanges(10)).some(function (c) { return c.id === "note:" + container.id; }) && pendTs.length === 1);

  var before = repo.stats().total, failing = W.repo.create(Object.assign({}, store, { tx: function (names, mode, fn) { return store.tx(names, mode, function (t) { var put = t.put; var cnt = 0; return fn(Object.assign({}, t, { put: function (nm, v) { if (nm === "links" && ++cnt >= 1) return Promise.reject(new Error("mất điện giữa chừng")); return put(nm, v); } })); }); } }), { now: tick });
  await failing.open();
  var fe = await loi(function () { return failing.save({ title: "Sẽ hỏng", content: "[[Java]] để có cạnh" }); });
  var after = await W.repo.create(store, { now: tick }).open();
  kiem("giao dịch nguyên tử: lỗi GIỮA CHỪNG khi ghi → không để lại gì (không note mồ côi, không chỉ mục treo, bộ đếm n không nhảy)", !!fe && after.size() === before && (await after.search("sẽ hỏng")).results.length === 0 && (await after.search("hong")).results.length === 0);
  var reopened = await W.repo.create(store, { now: tick }).open();
  kiem("mở lại kho từ dữ liệu đã lưu: đủ note, tag, tìm kiếm, backlink như trước", reopened.size() === repo.size() && reopened.tags().length === repo.tags().length && (await reopened.search("bloom")).results.length === 2 && (await reopened.relations(a.id)).items.length === (await repo.relations(a.id)).items.length, [reopened.size(), repo.size(), reopened.tags().length, repo.tags().length, (await reopened.relations(a.id)).items.length, (await repo.relations(a.id)).items.length, "bloom=" + (await reopened.search("bloom")).results.length + "/" + (await repo.search("bloom")).results.length, (await reopened.search("bloom")).results.map(function (x) { return x.head.title; })].join(" / "));
  var rr = await repo.save({ title: "Tự trỏ", content: "[[Tự trỏ]] và [[Java]]" });
  kiem("note tự trỏ vào chính nó không tạo cạnh/mờ vòng", (await repo.relations(rr.note.id)).ghosts.length === 0 && (await repo.relations(rr.note.id)).items.length === 1);
  kiem("bỏ qua: liên kết trong code không tạo cạnh", await (async function () { var x = (await repo.save({ title: "CodeLink", content: "`[[Java]]`\n```\n[[Spring]]\n```" })).note; var r = await repo.relations(x.id); return r.items.length === 0 && r.ghosts.length === 0; })());

  // purge thùng rác
  var old = (await repo.save({ title: "Cũ lắm", content: "x" })).note;
  await repo.setStatus(old.id, "trashed");
  var purged0 = await repo.purgeTrash(clock + 10 * 86400000), purged1 = await repo.purgeTrash(clock + 31 * 86400000);
  kiem("thùng rác tự dọn sau 30 ngày (trước đó thì không)", purged0 === 0 && purged1 >= 1 && repo.head(old.id) === null);

  // wipe
  var w2 = W.repo.create(W.store.memory(), { now: tick }); await w2.open();
  await w2.save({ title: "A", content: "x" }); await w2.wipe();
  kiem("wipe: sạch note, chỉ mục, thẻ; lưu lại bình thường", w2.size() === 0 && (await w2.search("a")).results.length === 0 && (await w2.save({ title: "B", content: "y" })).note.title === "B" && (await w2.search("b")).results.length === 1);

  // lô lớn
  var batch = []; for (var i = 0; i < 4000; i++) batch.push({ id: T.uid(), title: "Ghi chú số " + i, content: "nội dung riêng " + i + " về chủ đề_" + (i % 50) + (i === 1234 ? " duynhat9999" : "") + (i % 10 === 0 ? " liên kết [[Ghi chú số " + (i + 1) + "]]" : ""), tags: ["t" + (i % 7)], created_at: 1000 + i, updated_at: 1000 + i });
  var bulk = W.repo.create(W.store.memory(), { now: tick }); await bulk.open();
  var t0 = Date.now(), added = await bulk.bulkAdd(batch);
  kiem("bulkAdd 4.000 note: đủ note, tìm được từ hiếm đúng 1 kết quả, liên kết đã giải ở pha 2", added === 4000 && bulk.size() === 4000 && (await bulk.search("duynhat9999")).results.length === 1 && (await bulk.search("tag:t3")).total === Math.ceil((4000 - 3) / 7) &&
    (await bulk.relations(batch[1].id)).items.length === 1, "mất " + (Date.now() - t0) + " ms");
  var dupAdded = await bulk.bulkAdd(batch.slice(0, 10));
  kiem("bulkAdd bỏ qua id đã có", dupAdded === 0 && bulk.size() === 4000);
  var seen = 0; await bulk.forEachNote(function (b) { seen += b.length; });
  kiem("forEachNote duyệt đủ mọi note theo lô, không nạp hết vào RAM", seen === 4000);
  var re = W.repo.create(bulk.store, { now: tick }); await re.open();
  kiem("kho nhập hàng loạt mở lại được, search/list/tag khớp", re.size() === 4000 && (await re.search("duynhat9999")).results.length === 1 && re.list({ sort: "title" }).length === 4000 && re.tags().length === 7);
  var s1 = Date.now(); for (var q = 0; q < 20; q++) await bulk.search("noi dung rieng chu de_" + q);
  kiem("tìm kiếm nhiều từ trên 4.000 note: trung bình < 50 ms/lần", (Date.now() - s1) / 20 < 50, ((Date.now() - s1) / 20).toFixed(1) + " ms");
  return { repo: repo, bulk: bulk };
}

/* ======================================================================== sao lưu / xuất / nhập */
async function backupTests(ctx) {
  sec("backup");
  var repo = ctx.repo, clock = 1800000000000, copy = W.repo.create(W.store.memory(), { now: function () { return (clock += 10); } });
  await copy.open();
  var out = await B.build(repo, { deflate: true });
  kiem("sao lưu: tên backup_YYYYMMDD.zip, manifest đúng số note", /^backup_\d{8}\.zip$/.test(out.name) && out.counts.notes === repo.size() && out.manifest.app === "personal-wiki");
  var bytes = new Uint8Array(await out.blob.arrayBuffer());
  var res = await B.restore(copy, bytes, { mode: "merge" });
  var sample = repo.list({})[0], rb1 = (await copy.search("bloom")).results.length, rb2 = (await repo.search("bloom")).results.length;
  kiem("khôi phục vào kho trống: đủ note", res.added === repo.size() && copy.size() === repo.size(), JSON.stringify(res) + " / " + repo.size() + " / " + copy.size());
  kiem("khôi phục: tìm kiếm cho CÙNG kết quả với kho gốc", rb1 === rb2 && (await copy.search("hash")).results.length === (await repo.search("hash")).results.length, rb1 + " vs " + rb2);
  kiem("khôi phục: backlink/quan hệ giống kho gốc ở mọi note", await (async function () { var ids = repo.list({}).map(function (h) { return h.id; }); for (var i = 0; i < ids.length; i++) { var x = await repo.relations(ids[i]), y = await copy.relations(ids[i]); if (x.items.length !== y.items.length || x.ghosts.length !== y.ghosts.length) return false; } return true; })());
  kiem("khôi phục: thẻ đã ôn giữ nguyên lịch", (await copy.allCards()).filter(function (c) { return c.reps > 0; }).length === (await repo.allCards()).filter(function (c) { return c.reps > 0; }).length);
  var res2 = await B.restore(copy, bytes, { mode: "merge" });
  kiem("khôi phục lần hai (merge): không nhân đôi, chỉ bỏ qua", res2.added === 0 && res2.skipped === repo.size() && copy.size() === repo.size());
  var one = repo.list({})[0], newer = await repo.save({ id: one.id, content: (await repo.get(one.id)).content + "\nmới hơn" });
  var out2 = await B.build(repo, {}), res3 = await B.restore(copy, new Uint8Array(await out2.blob.arrayBuffer()), { mode: "merge" });
  kiem("merge: bản trong tệp MỚI hơn thì đè, cũ hơn thì giữ", res3.updated === 1 && (await copy.get(one.id)).content.indexOf("mới hơn") !== -1);
  var rep2 = await B.restore(copy, bytes, { mode: "replace" });
  kiem("replace: thay hẳn bằng nội dung tệp (bản 'mới hơn' biến mất)", rep2.added === repo.size() && (await copy.get(one.id)).content.indexOf("mới hơn") === -1 && copy.size() === repo.size());
  var broken = await loi(function () { return B.restore(copy, new TextEncoder().encode("PK rác")); });
  var notBackup = await loi(async function () { return B.restore(copy, new Uint8Array(await (await Z.create([{ name: "x.txt", data: "a" }], {})).arrayBuffer())); });
  var wrongApp = await loi(async function () { return B.restore(copy, new Uint8Array(await (await Z.create([{ name: "manifest.json", data: JSON.stringify({ app: "khac", v: 1 }) }], {})).arrayBuffer())); });
  var tooNew = await loi(async function () { return B.restore(copy, new Uint8Array(await (await Z.create([{ name: "manifest.json", data: JSON.stringify({ app: "personal-wiki", v: 99 }) }], {})).arrayBuffer())); });
  var short = await loi(async function () { return B.restore(copy, new Uint8Array(await (await Z.create([{ name: "manifest.json", data: JSON.stringify({ app: "personal-wiki", v: 1, counts: { notes: 5 } }) }, { name: "notes.jsonl", data: "" }], {})).arrayBuffer())); });
  kiem("khôi phục từ tệp sai: không phải zip / thiếu manifest / app khác / phiên bản mới hơn / thiếu note → lỗi tiếng Việt, kho KHÔNG bị đụng", !!broken && /manifest/.test(notBackup.message) && /không phải sao lưu/.test(wrongApp.message) && /phiên bản mới hơn/.test(tooNew.message) && /không đủ/.test(short.message) && copy.size() === repo.size());
  var withBad = await Z.create([{ name: "manifest.json", data: JSON.stringify({ app: "personal-wiki", v: 1, counts: { notes: 3 } }) }, { name: "notes.jsonl", data: JSON.stringify({ id: T.uid(), title: "Tốt", content: "ok" }) + "\nkhông-phải-json\n" + JSON.stringify({ title: "thiếu id" }) + "\n" }], {});
  var rb = await B.restore(W.repo.create(W.store.memory()).open ? await (async function () { var r = W.repo.create(W.store.memory(), { now: Date.now }); await r.open(); return r; })() : null, new Uint8Array(await withBad.arrayBuffer()), {});
  kiem("dòng hỏng trong sao lưu: nhập phần tốt, đếm và báo dòng hỏng (không hỏng cả lần khôi phục)", rb.added === 1 && rb.bad.length === 2 && /dòng 2/.test(rb.bad[0]));
  var js = await B.exportJson(repo, {}), parsed = JSON.parse(await js.blob.text());
  kiem("xuất JSON: hợp lệ, có đủ note + thẻ, tên personal-wiki_YYYYMMDD.json", parsed.app === "personal-wiki" && parsed.notes.length === repo.size() && /^personal-wiki_\d{8}\.json$/.test(js.name));
  var mdz = await B.exportMarkdown(repo, {}), files = await Z.read(new Uint8Array(await mdz.blob.arrayBuffer()));
  var names = files.map(function (f) { return f.name; });
  kiem("xuất Markdown ZIP: mỗi note một .md (không thùng rác), thư mục theo loại, không trùng tên, tên an toàn", mdz.count === repo.list({}).length + repo.list({ status: "archived" }).length && names.every(function (x) { return /^(notes|daily|books|archive)\/[^\\:*?"<>|]+\.md$/.test(x); }) && new Set(names.map(function (x) { return x.toLowerCase(); })).size === names.length && names.some(function (x) { return x.indexOf("daily/2026-10-06") === 0; }), names.slice(0, 5).join(", "));
  var bloomFile = files.filter(function (f) { return /Bloom Filter\.md$/.test(f.name); })[0], text = await bloomFile.text(), fm = B.parseFrontMatter(text);
  kiem("front-matter: id, title, tags, status, created/updated, relations; nội dung nguyên vẹn", /^---\nid: [0-9a-f-]{36}\ntitle: "Bloom Filter"\ntags: \["algorithm"/.test(text) && fm.data.title === "Bloom Filter" && fm.data.tags[0] === "algorithm" && fm.body.indexOf("đã lưu thật") !== -1, text.slice(0, 200));
  var imp = await B.importMarkdown([{ name: "x.zip", bytes: function () { return mdz.blob.arrayBuffer().then(function (b) { return new Uint8Array(b); }); } }, { name: "Ghi nhanh.md", text: function () { return Promise.resolve("# Ghi nhanh\nkhông front-matter [[Java]]"); } }, { name: "voi-fm.md", text: function () { return Promise.resolve('---\ntitle: "Có \\"dấu\\" kép"\ntags: [a, "b c"]\nfavorite: true\nstatus: archived\n---\nthân'); } }], 123);
  var byTitle = {}; imp.notes.forEach(function (n) { byTitle[n.title] = n; });
  kiem("nhập Markdown: .md không front-matter lấy tên tệp; có front-matter đọc đủ trường; zip .md hàng loạt; id hợp lệ được giữ", byTitle["Ghi nhanh"] && byTitle["Ghi nhanh"].content.indexOf("[[Java]]") !== -1 && byTitle["Có \"dấu\" kép"].fav === true && byTitle["Có \"dấu\" kép"].status === "archived" && bang(byTitle["Có \"dấu\" kép"].tags, ["a", "b-c"]) && imp.notes.length === mdz.count + 2 && imp.notes.some(function (n) { return n.id === one.id; }));
  kiem("safeName: ký tự cấm, tên thiết bị Windows, dấu chấm cuối, quá dài, rỗng", B.safeName('a/b:c*?"<>|d') === "a b c d" && B.safeName("CON") === "note CON" && B.safeName("x. ") === "x" && B.safeName("é".repeat(300)).length <= 100 && B.safeName("") === "note" && B.safeName("..") === "note");
}

/* ======================================================================== hai thẻ trình duyệt dùng chung một kho + đồng bộ */
async function sharedStoreTests() {
  sec("hai thẻ trình duyệt, một kho");
  var store = W.store.memory(), a = W.repo.create(store, { now: Date.now }), b = W.repo.create(store, { now: Date.now });
  await a.open(); await b.open();
  var ra = await a.save({ title: "Từ thẻ A", content: "a" }), rb = await b.save({ title: "Từ thẻ B", content: "b" });
  var notes = []; await a.forEachNote(function (batch) { notes = notes.concat(batch); });
  var ns = notes.map(function (n) { return n.title; }).sort();
  kiem("hai kho cùng lưu note mới: cả hai đều vào, không ghi đè nhau (số thứ tự n cấp từ bộ đếm trong kho)", ns.length === 2 && ns[0] === "Từ thẻ A" && ns[1] === "Từ thẻ B");
  var seen = []; var off = a.on(function (ev) { if (ev.remote) seen.push(ev.id); });
  var changed = await a.reload();
  kiem("reload(): kho A thấy note do B ghi và phát sự kiện remote cho note đã đổi", a.size() === 2 && changed === 1 && seen.length === 1 && seen[0] === rb.note.id);
  var r2 = await a.search("thẻ", {});
  kiem("tìm kiếm ở A thấy cả note do B ghi (chỉ mục chung)", r2.total === 2);
  off();
}

/* Máy chủ /wiki giả. `prefix` = API_PREFIX của nó ("/api" mặc định; "" = API ở gốc như .env thật). Gọi ngoài <prefix>/wiki/… thì trả
   404 KHÔNG có mã /wiki (như trang 404 của FastAPI khi sai tiền tố). srv.urls ghi đường dẫn thật đã gọi. */
function fakeServer(prefix) {
  var base = (prefix == null ? "/api" : prefix) + "/wiki";
  var spaces = {}, stamp = 1000, calls = [], urls = [], srv = { reject: {}, down: false, pageCap: 0, calls: calls, urls: urls, spaces: spaces };
  function res(status, body, headers) { return { ok: status < 400, status: status, headers: { get: function (k) { return (headers || {})[k] || null; } }, text: function () { return Promise.resolve(body === undefined ? "" : JSON.stringify(body)); } }; }
  function err(status, code, extra) { return res(status, { status_code: status, message: "lỗi " + code, data: Object.assign({ code: code }, extra || {}) }); }
  function wins(n, o) { return n.updatedAt !== o.updatedAt ? n.updatedAt > o.updatedAt : !!(n.deleted && !o.deleted); }
  srv.fetch = function (url, init) {
    if (srv.down) return Promise.reject(new TypeError("Failed to fetch"));
    var u = new URL(url, "http://x"), method = (init && init.method) || "GET", key = init && init.headers && init.headers["X-Wiki-Key"];
    urls.push(u.pathname);
    if (u.pathname !== base && u.pathname.indexOf(base + "/") !== 0) { calls.push(method + " !" + u.pathname); return Promise.resolve(res(404, { detail: "Not Found" })); }
    var parts = u.pathname.slice(base.length).split("/").filter(Boolean);
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push(method + " /" + parts.join("/") + (u.search || ""));
    if (parts[0] === "backends") return Promise.resolve(res(200, { default: srv.defaultBackend || "json", backends: [{ id: "json", label: "JSON", available: true, persistent: true, reason: "" }] }));
    if (parts[0] === "workspaces" && method === "POST") { var id = "ws" + (Object.keys(spaces).length + 1), k = "key-" + id; spaces[id] = { key: k, items: new Map() }; return Promise.resolve(res(201, { workspaceId: id, key: k })); }
    var be = u.searchParams.get("backend");
    if (be && srv.missingIn && srv.missingIn[be]) return Promise.resolve(err(404, "wiki_not_found"));   // kho không nằm ở nơi lưu này
    var ws = spaces[parts[0]];
    if (!ws) return Promise.resolve(err(404, "wiki_not_found"));
    if (ws.key !== key) return Promise.resolve(err(401, "wiki_unauthorized"));
    if (parts.length === 1 && method === "DELETE") { delete spaces[parts[0]]; return Promise.resolve(res(200, { deleted: true })); }
    if (parts[1] === "items" && method === "GET") {
      var since = +u.searchParams.get("since") || 0, limit = Math.min(+u.searchParams.get("limit") || 200, srv.pageCap || 200);
      var found = Array.from(ws.items.values()).filter(function (r) { return r.serverUpdatedAt > since; }).sort(function (x, y) { return x.serverUpdatedAt - y.serverUpdatedAt; });
      var more = found.length > limit, page = found.slice(0, limit);
      return Promise.resolve(res(200, { items: JSON.parse(JSON.stringify(page)), serverTime: more ? page[page.length - 1].serverUpdatedAt : Math.max(since, stamp), more: more }));
    }
    if (parts[1] === "items" && method === "PUT") {
      for (var i = 0; i < body.items.length; i++) {
        if (srv.reject[body.items[i].id]) return Promise.resolve(err(400, "wiki_bad_item", { itemId: body.items[i].id }));
        if (srv.clockBad) return Promise.resolve(err(400, "wiki_bad_clock", { itemId: body.items[i].id }));
        if (srv.full) return Promise.resolve(err(400, "wiki_workspace_full", { limit: 1 }));
      }
      var held = body.items.map(function (r) {
        var old = ws.items.get(r.id);
        if (!old || wins(r, old)) ws.items.set(r.id, Object.assign({}, r, { data: r.deleted ? {} : r.data, serverUpdatedAt: ++stamp }));
        return ws.items.get(r.id);
      });
      return Promise.resolve(res(200, { items: JSON.parse(JSON.stringify(held)), serverTime: stamp }));
    }
    return Promise.resolve(err(404, "wiki_not_found"));
  };
  return srv;
}

async function syncTests() {
  sec("đồng bộ (/wiki) với máy chủ giả");
  var Y = require(path.join(J, "data/sync.js"));
  var srv = fakeServer(), tick = 1.8e12;
  var mk = async function () { var r = W.repo.create(W.store.memory(), { now: function () { return (tick += 1000); } }); await r.open(); return r; };
  var timers = [];
  var mkSync = function (repo) { return Y.create(repo, { fetch: srv.fetch, apiBase: "/api", now: function () { return tick; }, setTimeout: function (f, ms) { timers.push(ms); return timers.length; }, clearTimeout: function () {} }); };
  var A = await mk(), B = await mk(), sa = mkSync(A), sb = mkSync(B);
  await sa.start(); await sb.load();
  var n1 = await A.save({ title: "Một", content: "nối tới [[Hai]]\n\nQ: thủ đô Pháp?\nA: Paris\n", tags: ["x"] }), n2 = await A.save({ title: "Hai", content: "hai", fav: true });
  var codeA = await sa.create("");
  kiem("tạo kho: có mã nối dạng <backend>.<mã kho>.<khoá>", /^default\.ws1\.key-ws1$/.test(codeA) && sa.state().configured);
  kiem("hàng đợi chứa mọi note sau khi tạo kho (markAllChanged)", (await A.pendingCount()) === 2);
  await sa.cycle();
  kiem("chu kỳ đồng bộ A: đẩy hết, hàng đợi rỗng, ghi nhận lần cuối", (await A.pendingCount()) === 0 && sa.state().phase === "idle" && sa.state().last > 0 && srv.spaces.ws1.items.size === 2);
  var rec = srv.spaces.ws1.items.get(n1.note.id);
  kiem("bản ghi gửi lên: id note, kind note, updatedAt = updated_at, data = cả ghi chú", rec.kind === "note" && rec.updatedAt === n1.note.updated_at && rec.data.title === "Một" && rec.data.tags[0] === "x" && !rec.deleted);
  var bad = await loi(function () { return sb.join("rác"); });
  kiem("mã nối sai dạng bị từ chối trước khi gọi máy chủ", !!bad && bad.code === "bad_code");
  var badKey = await loi(function () { return sb.join("default.ws1.sai-khoa"); });
  kiem("mã nối sai khoá → 401, không lưu gì", !!badKey && badKey.status === 401 && !sb.state().configured);
  await sb.join(codeA); await sb.cycle();
  kiem("thiết bị B nối + kéo: có đủ 2 note, đúng nội dung, đúng thời gian sửa", B.size() === 2 && (await B.get(n1.note.id)).content.indexOf("[[Hai]]") !== -1 && (await B.get(n1.note.id)).updated_at === n1.note.updated_at && B.head(n2.note.id).f === 1);
  kiem("kéo về không làm đầy hàng đợi của B (không dội ngược)", (await B.pendingCount()) === 0);
  var relB = await B.relations(n1.note.id);
  kiem("liên kết [[Hai]] ở B đã được giải thành note thật (bulkAdd pha 2)", relB.items.length === 1 && relB.ghosts.length === 0);
  var cardsB = await B.allCards();
  kiem("thẻ Q:/A: sinh ở B từ nội dung note (không cần đồng bộ riêng)", cardsB.length === 1 && cardsB[0].q.indexOf("thủ đô") !== -1);

  // thẻ ôn: lịch của A sang B
  var cardA = (await A.allCards())[0]; await A.review(cardA.id, 3);
  await sa.cycle(); await sb.cycle();
  var cb = (await B.allCards())[0];
  kiem("lịch ôn thẻ (reps/interval/due) của A sang B", cb.reps === 1 && cb.interval === (await A.allCards())[0].interval && cb.due === (await A.allCards())[0].due);

  // sửa ở B → A
  var seenRemote = []; A.on(function (ev) { if (ev.remote) seenRemote.push(ev.id); });
  await B.save({ id: n2.note.id, content: "hai — sửa ở B", title: "Hai" });
  await sb.cycle(); await sa.cycle();
  kiem("sửa ở B sang A, A nhận qua sự kiện remote, hàng đợi A vẫn rỗng", (await A.get(n2.note.id)).content === "hai — sửa ở B" && seenRemote.indexOf(n2.note.id) !== -1 && (await A.pendingCount()) === 0);
  kiem("kéo lần sau chỉ lấy phần mới (con trỏ serverTime được nhớ)", srv.calls.filter(function (c) { return /items\?since=0&limit=200/.test(c); }).length >= 2 && srv.calls.some(function (c) { return /items\?since=[1-9]/.test(c); }));

  // xung đột: cả hai sửa khi chưa đồng bộ — bản mới hơn thắng, hai bên hội tụ
  var CARD = "\n\nQ: thủ đô Pháp?\nA: Paris\n";
  await A.save({ id: n1.note.id, content: "A sửa trước" + CARD });
  await B.save({ id: n1.note.id, content: "B sửa sau" + CARD });
  await sa.cycle(); await sb.cycle(); await sa.cycle();
  var ca = (await A.get(n1.note.id)).content, cbb = (await B.get(n1.note.id)).content;
  kiem("xung đột: bản có updated_at mới hơn (B) thắng và cả hai máy hội tụ", ca === "B sửa sau" + CARD && cbb === "B sửa sau" + CARD);

  // xoá hẳn → tombstone → máy kia xoá theo
  await A.removeForever(n2.note.id);
  await sa.cycle(); await sb.cycle();
  kiem("xoá hẳn ở A → bản ghi đánh dấu xoá; B xoá theo; máy chủ giữ tombstone không giữ nội dung", !B.head(n2.note.id) && srv.spaces.ws1.items.get(n2.note.id).deleted === true && Object.keys(srv.spaces.ws1.items.get(n2.note.id).data).length === 0);
  // sửa SAU lúc bên kia xoá → bản sửa sống lại
  var n3 = await A.save({ title: "Ba", content: "ba" }); await sa.cycle(); await sb.cycle();
  await A.removeForever(n3.note.id);
  await B.save({ id: n3.note.id, content: "B sửa sau khi A xoá" });
  await sa.cycle(); await sb.cycle(); await sa.cycle();
  kiem("B sửa sau lúc A xoá (chưa nhận tombstone): bản sửa thắng, note sống lại ở cả hai", !!A.head(n3.note.id) && (await A.get(n3.note.id)).content === "B sửa sau khi A xoá" && !!B.head(n3.note.id));

  // một bản ghi bị máy chủ từ chối không chặn hàng đợi
  var okN = await A.save({ title: "Tốt", content: "tốt" }), badN = await A.save({ title: "Hỏng", content: "hỏng" });
  srv.reject[badN.note.id] = true;
  await sa.cycle();
  kiem("bản ghi bị từ chối (400 + itemId) bị loại khỏi hàng đợi và đếm; các bản ghi khác vẫn lên máy chủ", srv.spaces.ws1.items.has(okN.note.id) && !srv.spaces.ws1.items.has(badN.note.id) && sa.state().skipped === 1 && (await A.pendingCount()) === 0 && sa.state().phase === "idle");
  delete srv.reject[badN.note.id];

  // đồng hồ lệch / kho đầy: lỗi của CẢ máy hoặc kho, không được coi là "một bản ghi hỏng" rồi bỏ qua
  srv.clockBad = true; await A.save({ title: "Giờ lệch", content: "x" });
  await sa.cycle();
  kiem("máy chủ báo đồng hồ lệch (400 + itemId): KHÔNG bỏ bản ghi, báo lỗi, giữ hàng đợi", sa.state().phase === "error" && sa.state().skipped === 1 && (await A.pendingCount()) >= 1 && /đồng hồ|lỗi/i.test(sa.state().error));
  srv.clockBad = false; srv.full = true; await sa.cycle(); timers.length = 0; await sa.cycle();
  kiem("kho đầy: lỗi dứt khoát (fatal), thông báo tiếng Việt, không hẹn thử lại", sa.state().fatal === true && /đầy/.test(sa.state().error) && timers.length === 0);
  srv.full = false; await sa.now();
  kiem("hết lỗi → đồng bộ lại bình thường, hàng đợi sạch", (await A.pendingCount()) === 0 && sa.state().phase === "idle" && !sa.state().fatal);

  // mạng chết: không mất gì, lùi dần
  srv.down = true;
  await A.save({ title: "Khi mất mạng", content: "x" });
  timers.length = 0;
  var okDown = await sa.cycle();
  kiem("mất mạng: chu kỳ thất bại êm (không ném lỗi), dữ liệu cục bộ còn, hàng đợi còn, hẹn thử lại", okDown === false && sa.state().phase === "error" && (await A.pendingCount()) === 1 && timers.length === 1 && timers[0] === 15000);
  await sa.cycle(); await sa.cycle();
  kiem("lùi dần: 15 s → 30 s → 60 s", bang(timers, [15000, 30000, 60000]));
  srv.down = false; await sa.now();
  kiem("có lại mạng: đẩy bù, hết lỗi", (await A.pendingCount()) === 0 && sa.state().phase === "idle" && sa.state().error === "");

  // con trỏ bền qua khởi động lại
  var sa2 = mkSync(A); await sa2.load(); srv.calls.length = 0; await sa2.cycle();
  kiem("khởi động lại: nhớ kho + con trỏ, chỉ hỏi phần mới (since > 0)", sa2.state().configured && srv.calls.some(function (c) { return /items\?since=[1-9]/.test(c); }) && !srv.calls.some(function (c) { return /since=0&/.test(c); }));

  // kéo nhiều trang + thẻ đến trước note của nó
  srv.pageCap = 1;
  var C = await mk(), sc = mkSync(C); await sc.load(); await sc.join(codeA); await sc.cycle();
  kiem("kéo nhiều trang (mỗi trang 1 bản ghi): đủ note, đủ lịch thẻ dù thẻ đến trước note", C.size() === A.size() - 1 && (await C.allCards()).filter(function (c) { return c.reps > 0; }).length === 1, "C=" + C.size() + " A=" + A.size() + " thẻ đã ôn ở C=" + (await C.allCards()).filter(function (c) { return c.reps > 0; }).length + " state=" + JSON.stringify(sc.state()));
  srv.pageCap = 0;

  // 450 note: kéo hàng loạt bằng bulkAdd
  var list = []; for (var i = 0; i < 450; i++) list.push({ title: "Hàng loạt " + i, content: "nội dung " + i, tags: ["h"] });
  await A.bulkAdd(list);
  await new Promise(function (r) { setTimeout(r, 30); });                                  // bộ nghe sự kiện bulk xếp hàng đợi bất đồng bộ
  await sa.cycle();
  kiem("nhập hàng loạt ở A (bulkAdd) được tự xếp vào hàng đợi rồi lên máy chủ", srv.spaces.ws1.items.size >= 450 + 3, "máy chủ có " + srv.spaces.ws1.items.size + ", A có " + A.size() + ", chờ gửi " + (await A.pendingCount()) + " state=" + JSON.stringify(sa.state()));
  var D = await mk(), sd = mkSync(D); await sd.load(); await sd.join(codeA); await sd.cycle();
  kiem("thiết bị mới kéo 450+ note qua nhiều trang: đủ và tìm được ngay", D.size() === A.size() && (await D.search("Hàng loạt 449", {})).total === 1, "D=" + D.size() + " A=" + A.size() + " state=" + JSON.stringify(sd.state()));

  // sai khoá / kho bị xoá → dừng hẳn, không vòng lặp
  srv.spaces.ws1.key = "doi-khoa"; timers.length = 0;
  await sb.cycle();
  kiem("khoá bị đổi / kho không còn: lỗi dứt khoát (fatal), không hẹn thử lại", sb.state().fatal === true && /nối lại/.test(sb.state().error) && timers.length === 0);
  srv.spaces.ws1.key = "key-ws1";

  // rời kho, xoá kho
  await sb.leave();
  kiem("ngắt kết nối: quên khoá + con trỏ, giữ nguyên ghi chú trên máy", !sb.state().configured && B.size() > 0 && (await B.getMeta("sync")) === null);
  var deleted = await sa.deleteRemote();
  kiem("xoá kho trên máy chủ rồi ngắt kết nối", deleted === true && !srv.spaces.ws1 && !sa.state().configured);

  // xoá sạch dữ liệu máy → ngắt đồng bộ (không đẩy hàng loạt tombstone)
  var E = await mk(), se = mkSync(E); await se.start();
  await se.create(""); await E.save({ title: "E1", content: "e" }); await se.cycle();
  await E.wipe();
  await new Promise(function (r) { setTimeout(r, 30); });
  kiem("xoá sạch dữ liệu trên máy → đồng bộ tự ngắt (kho trên máy chủ không bị xoá theo)", !se.state().configured && Object.keys(srv.spaces).length === 1 && srv.spaces[Object.keys(srv.spaces)[0]].items.size >= 1);
  se.stop();
}

/* "Có máy chủ" = có cấu hình. API_PREFIX trống (apiBase "") là CÓ máy chủ — lỗi gốc 22/10: `available: !!apiBase` khoá đồng bộ khi .env để
   API_PREFIX rỗng. 404 không mã ≠ mất kho. Mã nối ghi rõ nơi lưu. Wiki.api là chỗ duy nhất đọc gốc API (W3 dùng cho AI). */
async function apiTests() {
  sec("có máy chủ hay không (API_PREFIX trống, thiếu cấu hình, sai tiền tố)");
  var Y = require(path.join(J, "data/sync.js"));
  var A = W.api, tick = 1.9e12, timers = [];
  var mk = async function () { var r = W.repo.create(W.store.memory(), { now: function () { return (tick += 1000); } }); await r.open(); return r; };
  var mkSync = function (repo, srv, apiBase) { return Y.create(repo, { fetch: srv.fetch, apiBase: apiBase, now: function () { return tick; }, setTimeout: function (f, ms) { timers.push(ms); return timers.length; }, clearTimeout: function () {} }); };

  kiem("Wiki.api.read: apiBase \"\" (API_PREFIX trống) = CÓ máy chủ, API ở gốc cùng origin", bang(A.read({ apiBase: "" }), { has: true, base: "" }));
  kiem("Wiki.api.read: bỏ '/' cuối; không có cấu hình / apiBase null / không phải chuỗi = KHÔNG có máy chủ",
    bang(A.read({ apiBase: "/api/v1/" }), { has: true, base: "/api/v1" }) && !A.read(undefined).has && !A.read(null).has && !A.read({}).has && !A.read({ apiBase: null }).has && !A.read({ apiBase: 5 }).has && !A.read("x").has);

  // (a) API_PREFIX trống: máy chủ phục vụ /wiki/* ở gốc
  var rootSrv = fakeServer("");
  var R = await mk(), sr = mkSync(R, rootSrv, "");
  await sr.load();
  kiem("apiBase \"\": available = true (trước đây false → Cài đặt chỉ báo 'Cần mở app qua máy chủ')", sr.state().available === true);
  await R.save({ title: "Ở gốc", content: "x" });
  var bk = await sr.backends(), codeR = await sr.create("");
  kiem("apiBase \"\": gọi đúng /wiki/backends rồi /wiki/workspaces (không thêm tiền tố)", rootSrv.urls[0] === "/wiki/backends" && rootSrv.urls[1] === "/wiki/workspaces" && bk.default === "json", rootSrv.urls.join(" "));
  await sr.cycle();
  kiem("apiBase \"\": chu kỳ đồng bộ đầy đủ (đẩy lên, hàng đợi rỗng, idle)", sr.state().phase === "idle" && rootSrv.spaces.ws1.items.size === 1 && (await R.pendingCount()) === 0 && rootSrv.urls.indexOf("/wiki/ws1/items") !== -1);
  kiem("mã nối ghi rõ nơi lưu mặc định đã biết (json.<kho>.<khoá>) và tạo kho với ?backend=json", /^json\.ws1\.key-ws1$/.test(codeR) && rootSrv.calls.indexOf("POST /workspaces?backend=json") !== -1 && sr.state().backend === "json", codeR + " · " + rootSrv.calls.join(" | "));
  var R2 = await mk(), sr2 = mkSync(R2, rootSrv, ""); await sr2.load(); await sr2.join(codeR); await sr2.cycle();
  kiem("thiết bị khác nối bằng mã json.…: kéo về đủ, gọi kèm ?backend=json", R2.size() === 1 && sr2.state().backend === "json" && rootSrv.calls.some(function (c) { return /^GET \/ws1\/items\?backend=json&since=/.test(c); }));
  var R3 = await mk(), sr3 = mkSync(R3, rootSrv, ""); await sr3.load(); await sr3.join("default.ws1.key-ws1"); await sr3.cycle();
  kiem("mã nối cũ default.<kho>.<khoá> vẫn nối được (nơi lưu mặc định của máy chủ)", R3.size() === 1 && sr3.state().backend === "");
  var e0 = await loi(function () { return sr3.join("sqlite.ws1.key-ws1"); });
  kiem("mã nối với nơi lưu lạ bị từ chối trước khi gọi máy chủ", !!e0 && e0.code === "bad_code");

  // (b) không có cấu hình (file://): không gọi mạng
  var none = fakeServer("");
  var N1 = await mk(), sNo = mkSync(N1, none, undefined), sNull = mkSync(N1, none, null);
  await sNo.load();
  var e1 = await loi(function () { return sNo.create(""); }), e2 = await loi(function () { return sNull.backends(); }), ranNo = await sNo.cycle();
  kiem("apiBase undefined / null: available = false", sNo.state().available === false && sNull.state().available === false);
  kiem("không có máy chủ: tạo kho / hỏi máy chủ bị từ chối (no_server), chu kỳ không chạy, KHÔNG có yêu cầu mạng nào", !!e1 && e1.code === "no_server" && !!e2 && e2.code === "no_server" && ranNo === false && none.urls.length === 0);

  // (c) sai tiền tố: trang nghĩ API ở /api/v1, máy chủ phục vụ ở gốc → 404 không mã
  var wrong = fakeServer("");
  var Wr = await mk(), sw = mkSync(Wr, wrong, "/api/v1"); await sw.load();
  var e3 = await loi(function () { return sw.backends(); });
  kiem("404 KHÔNG mã (sai tiền tố API) → code wiki_no_api, báo 'không có API đồng bộ', không nói 'kho đã bị xoá'", !!e3 && e3.status === 404 && e3.code === "wiki_no_api" && /không có API đồng bộ/.test(e3.message) && !/nối lại|bị xoá/.test(e3.message), e3 && (e3.code + " " + e3.message));
  var e4 = await loi(function () { return sw.join("json.ws1.key-ws1"); });
  kiem("nối kho khi địa chỉ không có API: lỗi wiki_no_api, không lưu khoá", !!e4 && e4.code === "wiki_no_api" && !sw.state().configured && (await Wr.getMeta("sync")) == null);
  var sBad = mkSync(R, wrong, "/api/v1"); await sBad.load(); timers.length = 0; await sBad.cycle();
  kiem("chu kỳ gặp 404 không mã: dừng (fatal), errorCode wiki_no_api, KHÔNG bảo nối lại, không hẹn thử lại", sBad.state().fatal === true && sBad.state().errorCode === "wiki_no_api" && /không có API đồng bộ/.test(sBad.state().error) && !/nối lại/.test(sBad.state().error) && timers.length === 0, JSON.stringify(sBad.state()));
  kiem("…và vẫn giữ khoá kho trên máy (không coi là mất kho)", sBad.state().configured === true && !!(await R.getMeta("sync")));

  // (d) 404 + wiki_not_found = kho mất thật → dừng, bảo nối lại
  delete rootSrv.spaces.ws1; timers.length = 0;
  await R.save({ title: "Sau khi kho mất", content: "y" }); await sr.cycle();
  kiem("404 + wiki_not_found (kho không còn trên máy chủ) → fatal, errorCode wiki_not_found, thông báo 'nối lại'", sr.state().fatal === true && sr.state().errorCode === "wiki_not_found" && /nối lại/.test(sr.state().error) && timers.length === 0);

  // (e) Wiki.sync.start đọc window.__WEBAPP_CONFIG__ qua Wiki.api
  var had = Object.prototype.hasOwnProperty.call(globalThis, "__WEBAPP_CONFIG__"), saved = globalThis.__WEBAPP_CONFIG__;
  var S1 = await mk();
  globalThis.__WEBAPP_CONFIG__ = { apiBase: "", webappBase: "/webapp" };
  await Y.start({ repo: S1 }); var st1 = Y.instance.state(); Y.instance.stop();
  kiem("Wiki.sync.start với cấu hình apiBase \"\": available = true; Wiki.api = {has: true, base: \"\"}; url('/wiki/backends') = '/wiki/backends'", st1.available === true && W.api.has === true && W.api.base === "" && W.api.url("/wiki/backends") === "/wiki/backends");
  globalThis.__WEBAPP_CONFIG__ = { apiBase: "/api/v1/" };
  await Y.start({ repo: S1 }); var st2 = Y.instance.state(); Y.instance.stop();
  kiem("Wiki.sync.start với apiBase '/api/v1/': available, Wiki.api.base = '/api/v1'", st2.available === true && W.api.base === "/api/v1" && W.api.url("/ai/wiki") === "/api/v1/ai/wiki");
  delete globalThis.__WEBAPP_CONFIG__;
  await Y.start({ repo: S1 }); var st3 = Y.instance.state(); Y.instance.stop();
  kiem("Wiki.sync.start KHÔNG có cấu hình (mở file://): available = false, Wiki.api.has = false", st3.available === false && W.api.has === false && W.api.base === "");
  if (had) globalThis.__WEBAPP_CONFIG__ = saved;
  Y.instance = null;
}

/* W2 (23/10): giao diện đồng bộ dựa trên các hàm thuần của sync.js — thông điệp phân biệt file:// / thiếu cấu hình / ngoại tuyến / mất kho,
   chọn sẵn nơi lưu bền, liên kết nối, chữ của chỉ báo trạng thái, mã nối không phụ thuộc "default.". */
async function syncUxTests() {
  sec("đồng bộ — hàm thuần cho giao diện (W2)");
  var Y = require(path.join(J, "data/sync.js"));
  kiem("blocker: file:// → 'file'; http(s) không cấu hình → 'no_config' (kể cả khi offline); có máy chủ + offline → 'offline'; dùng được → ''",
    Y.blocker({ available: false, protocol: "file:", online: true }) === "file" && Y.blocker({ available: false, protocol: "http:", online: true }) === "no_config" &&
    Y.blocker({ available: false, protocol: "https:", online: false }) === "no_config" && Y.blocker({ available: true, protocol: "http:", online: false }) === "offline" &&
    Y.blocker({ available: true, protocol: "https:", online: true }) === "" && Y.blocker(undefined) === "no_config");

  var J_TAM = { id: "json", label: "JSON", available: true, persistent: false }, J_BEN = { id: "json", label: "JSON", available: true, persistent: true };
  var MY = { id: "mysql", label: "MySQL", available: true, persistent: true }, MY_HONG = { id: "mysql", label: "MySQL", available: false, persistent: true }, MO = { id: "mongo", label: "MongoDB", available: true, persistent: true };
  kiem("chooseBackend: mặc định của máy chủ bền → chọn nó", bang(Y.chooseBackend({ default: "json", backends: [J_BEN, MY] }), { id: "json", ephemeral: false, none: false }));
  kiem("chooseBackend: mặc định là kho TẠM (JSON ở /tmp) nhưng có MySQL bền → chọn MySQL, không cảnh báo", bang(Y.chooseBackend({ default: "json", backends: [J_TAM, MY, MO] }), { id: "mysql", ephemeral: false, none: false }));
  kiem("chooseBackend: mặc định không dùng được → kho bền dùng được đầu tiên", Y.chooseBackend({ default: "mysql", backends: [J_TAM, MY_HONG, MO] }).id === "mongo");
  kiem("chooseBackend: chỉ còn kho tạm → vẫn chọn, ephemeral = true (giao diện cảnh báo)", bang(Y.chooseBackend({ default: "json", backends: [J_TAM, MY_HONG] }), { id: "json", ephemeral: true, none: false }));
  kiem("chooseBackend: không nơi lưu nào dùng được / dữ liệu rác / nơi lưu lạ → none",
    Y.chooseBackend({ default: "json", backends: [MY_HONG] }).none && Y.chooseBackend(null).none && Y.chooseBackend({ backends: "x" }).none && Y.chooseBackend({ default: "sqlite", backends: [{ id: "sqlite", available: true, persistent: true }] }).none);
  kiem("isEphemeral: chỉ đúng với nơi lưu dùng được mà không bền", Y.isEphemeral({ backends: [J_TAM, MY] }, "json") && !Y.isEphemeral({ backends: [J_TAM, MY] }, "mysql") && !Y.isEphemeral({ backends: [MY_HONG] }, "mysql") && !Y.isEphemeral(null, "json"));

  kiem("joinLink: dựng từ địa chỉ THƯ MỤC (bỏ index.html, ?source=pwa, #…) + #/join/<mã>",
    Y.joinLink("https://h.vn/webapp/tranphuc8a/personal-wiki/index.html?source=pwa#/settings/sync", "json.wk_A-b.k_9-x") === "https://h.vn/webapp/tranphuc8a/personal-wiki/#/join/json.wk_A-b.k_9-x" &&
    Y.joinLink("http://127.0.0.1:5000/webapp/tranphuc8a/personal-wiki/#/notes", "mysql.a.b") === "http://127.0.0.1:5000/webapp/tranphuc8a/personal-wiki/#/join/mysql.a.b" &&
    Y.joinLink("http://x/a/", "a b/c") === "http://x/a/#/join/a%20b%2Fc");
  kiem("parseCode (mức mô-đun, dùng chung với bộ đồng bộ): đúng dạng → {backend, ws, key}; 'default.' → backend ''; sai dạng → null",
    bang(Y.parseCode(" json.wk_A.k-1 "), { backend: "json", ws: "wk_A", key: "k-1" }) && bang(Y.parseCode("default.wk_A.k"), { backend: "", ws: "wk_A", key: "k" }) &&
    Y.parseCode("sqlite.wk_A.k") === null && Y.parseCode("json.wk_A") === null && Y.parseCode("json.wk A.k") === null && Y.parseCode("") === null && Y.parseCode(null) === null);
  kiem("sameStore: so theo KHO (mã kho + khoá) — mã cũ 'default.<kho>.<khoá>' và liên kết 'json.<kho>.<khoá>' là cùng kho (không mời 'THAY kho đó')",
    Y.sameStore("default.wk_A.k1", "json.wk_A.k1") && Y.sameStore("json.wk_A.k1", "default.wk_A.k1") && Y.sameStore("mysql.wk_A.k1", " mysql.wk_A.k1") && Y.sameStore("default.wk_A.k1", "default.wk_A.k1"));
  kiem("sameStore: khác mã kho / khác khoá / cả hai ghi rõ nơi lưu khác nhau / mã sai dạng → khác kho",
    !Y.sameStore("json.wk_A.k1", "json.wk_B.k1") && !Y.sameStore("json.wk_A.k1", "json.wk_A.k2") && !Y.sameStore("json.wk_A.k1", "mysql.wk_A.k1") &&
    !Y.sameStore("json.wk_A.k1", "") && !Y.sameStore("", "") && !Y.sameStore("rác", "rác"));

  var t0 = 1.95e12, V = function (s) { return Y.statusView(Object.assign({ available: true, loaded: true, configured: true, online: true, phase: "idle", last: 0, pending: 0, done: 0, total: 0, error: "", fatal: false, lost: false }, s), t0); };
  kiem("statusView: không có máy chủ → ẩn; chưa đọc cài đặt → loading; chưa nối kho → 'Bật đồng bộ'",
    V({ available: false }).kind === "none" && V({ loaded: false }).kind === "loading" && V({ configured: false }).kind === "off" && V({ configured: false }).text === "Bật đồng bộ");
  kiem("statusView: đã đồng bộ → 'Đã đồng bộ 2 phút trước'; chưa lần nào → chờ", V({ last: t0 - 2 * 60e3 }).kind === "ok" && V({ last: t0 - 2 * 60e3 }).text === "Đã đồng bộ 2 phút trước" && V({}).kind === "busy", V({ last: t0 - 2 * 60e3 }).text);
  kiem("statusView: đang gửi còn N; đang nhận; ngoại tuyến (phase hoặc trình duyệt offline) kèm số thay đổi chờ gửi",
    V({ phase: "push", total: 12, done: 2 }).text === "Đang gửi 10…" && V({ phase: "pull" }).kind === "busy" && V({ phase: "offline" }).kind === "offline" &&
    V({ online: false, last: t0, pending: 3 }).kind === "offline" && /còn 3 thay đổi/.test(V({ online: false, last: t0, pending: 3 }).title));
  kiem("statusView: lỗi tự thử lại → 'error' (không phải fatal); mất kho → 'Mất kho đồng bộ'; địa chỉ không có API → 'Đồng bộ đã dừng'",
    V({ phase: "error", error: "Chưa kết nối được máy chủ — sẽ thử lại." }).kind === "error" && V({ phase: "error", fatal: true, lost: true, error: "x" }).text === "Mất kho đồng bộ" &&
    V({ phase: "error", fatal: true, errorCode: "wiki_no_api", error: Y.NO_API }).text === "Đồng bộ đã dừng" && V({ phase: "error", fatal: true, lost: true, error: "abc" }).title === "abc");

  // state(): loaded, lost
  var tick = 1.96e12, mk = async function () { var r = W.repo.create(W.store.memory(), { now: function () { return (tick += 1000); } }); await r.open(); return r; };
  var mkSync = function (repo, srv) { return Y.create(repo, { fetch: srv.fetch, apiBase: "", now: function () { return tick; }, setTimeout: function () { return 1; }, clearTimeout: function () {} }); };
  var srv = fakeServer(""), A = await mk(), sa = mkSync(A, srv);
  kiem("state().loaded = false trước khi đọc khoá kho trên máy (giao diện chưa mời 'Tạo kho'), true sau load()", sa.state().loaded === false && (await sa.load(), sa.state().loaded === true));
  await A.save({ title: "Một", content: "x" }); await sa.create(""); await sa.cycle();
  delete srv.spaces.ws1; await A.save({ title: "Hai", content: "y" }); await sa.cycle();
  kiem("kho mất thật (404 wiki_not_found) → state().lost = true, fatal", sa.state().lost === true && sa.state().fatal === true);
  srv.down = true; await sa.now();
  kiem("Đồng bộ ngay sau đó gặp lỗi mạng → lost về false (lỗi tạm, không phải mất kho)", sa.state().lost === false && sa.state().fatal === false && sa.state().errorCode === "network");
  srv.down = false;
  var wrong = fakeServer(""), Bw = await mk(), sw = Y.create(Bw, { fetch: wrong.fetch, apiBase: "/api/v1", setTimeout: function () { return 1; }, clearTimeout: function () {} });
  await sw.load(); await Bw.setMeta("sync", { ws: "ws1", key: "k", backend: "json" }); await sw.load(); await sw.cycle();
  kiem("địa chỉ không có API (404 không mã) → fatal nhưng lost = false (giao diện không bảo nối lại)", sw.state().fatal === true && sw.state().lost === false && sw.state().errorCode === "wiki_no_api");

  // fullCode: mã cũ "default." → ghi hẳn nơi lưu
  var s2 = fakeServer(""), C = await mk(), sc = mkSync(C, s2), D = await mk(), sd = mkSync(D, s2);
  await sc.load(); await sd.load();
  kiem("fullCode khi chưa nối kho → ''", (await sc.fullCode()) === "");
  await C.save({ title: "C", content: "c" }); await sc.create(""); await sc.cycle();        // chưa hỏi backends() → mã "default.ws1.key-ws1"
  kiem("(tiền đề) kho tạo khi chưa biết nơi lưu mặc định có mã default.", sc.code() === "default.ws1.key-ws1");
  await sd.join("default.ws1.key-ws1");
  s2.urls.length = 0; s2.calls.length = 0;
  var full = await sd.fullCode();
  kiem("fullCode: mã default.<kho>.<khoá> → hỏi nơi lưu mặc định, xác nhận kho Ở ĐÓ (?backend=json, limit=1) → json.<kho>.<khoá>",
    full === "json.ws1.key-ws1" && sd.code() === full && sd.state().backend === "json" && s2.calls.some(function (c) { return /^GET \/ws1\/items\?backend=json&since=0&limit=1$/.test(c); }), full + " · " + s2.calls.join(" | "));
  kiem("…và ghi bền vào khoá kho trên máy (khởi động lại vẫn là json.)", (await D.getMeta("sync")).backend === "json" && (await (async function () { var again = mkSync(D, s2); await again.load(); return again.code(); })()) === "json.ws1.key-ws1");
  s2.calls.length = 0; await sd.fullCode();
  kiem("fullCode lần sau: không gọi máy chủ nữa", s2.calls.length === 0);
  var E = await mk(), se = mkSync(E, s2); await se.load(); await se.join("default.ws1.key-ws1");
  s2.defaultBackend = "mongo"; s2.missingIn = { mongo: true };
  var kept = await se.fullCode();
  kiem("fullCode: kho KHÔNG nằm ở nơi lưu mặc định hiện tại (máy chủ đã đổi mặc định) → giữ nguyên mã default., không ghi sai nơi lưu", kept === "default.ws1.key-ws1" && se.state().backend === "" && (await E.getMeta("sync")).backend === "");
  s2.defaultBackend = ""; s2.missingIn = null; s2.down = true;
  kiem("fullCode: mất mạng → giữ nguyên mã cũ, không ném lỗi", (await se.fullCode()) === "default.ws1.key-ws1");
  s2.down = false;
}

/* Mã QR: bản chép trong wiki (assets/js/core/qr.js, không gian tên Wiki.qr) phải cho ĐÚNG ma trận như bản gốc của cổng (_portal) trên cùng đầu vào. */
function qrTests() {
  sec("mã QR — bản chép so với bản gốc của cổng");
  var mine = require(path.join(J, "core/qr.js")), orig = require(path.join(__dirname, "..", "..", "_portal", "assets", "js", "core", "qr.js"));
  kiem("Wiki.qr là bản chép (không dùng chung đối tượng với Portal.qr)", W.qr === mine && mine !== orig && typeof mine.encode === "function");
  var seed = 20261023, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  var ALPHA = "abcxyzABCXYZ0189-_.~/:#?&=%ăâđêôơưếộữ €😀中文 ";
  var inputs = ["", "a", "http://x/", "https://wiki.example.vn/webapp/tranphuc8a/personal-wiki/#/join/json.wk_AbCdEfGhIjKlMnOp.q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6",
    "http://127.0.0.1:51234/webapp/tranphuc8a/personal-wiki/#/join/mysql.wk_x.y", "Tiếng Việt có dấu — ắằẳẵặ", "😀".repeat(30)];
  for (var n = 1; n <= 271; n += (n < 40 ? 1 : 7)) { var s = ""; for (var i = 0; i < n; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789/:.#-_"[Math.floor(rnd() * 42)]; inputs.push(s); }
  var AL = Array.from(ALPHA);                                          // theo điểm mã: không cắt đôi cặp thay thế của emoji
  for (var k = 0; k < 60; k++) { var t = "", len = 1 + Math.floor(rnd() * 70); for (var j = 0; j < len; j++) t += AL[Math.floor(rnd() * AL.length)]; inputs.push(t); }
  var bad = [], same = 0;
  inputs.forEach(function (x) {
    var a = null, b = null, ea = null, eb = null;
    try { a = mine.encode(x); } catch (e) { ea = e.message; }
    try { b = orig.encode(x); } catch (e) { eb = e.message; }
    if (ea || eb) { if (ea !== eb) bad.push(JSON.stringify(x).slice(0, 40) + ": lỗi khác nhau " + ea + " / " + eb); else same++; return; }
    if (a.size !== b.size || a.version !== b.version || a.ecl !== b.ecl || a.mask !== b.mask || JSON.stringify(a.modules) !== JSON.stringify(b.modules) || mine.toSvg(a, 4) !== orig.toSvg(b, 4)) bad.push(JSON.stringify(x).slice(0, 40));
    else same++;
  });
  kiem("cùng " + inputs.length + " đầu vào (1–271 byte, ASCII, tiếng Việt, emoji, CJK, liên kết nối thật): ma trận + phiên bản + mức sửa lỗi + mặt nạ + SVG trùng khớp bản gốc", !bad.length && same === inputs.length, bad.slice(0, 4).join(" ; "));
  var tooLong = null, tooLong2 = null; try { mine.encode("x".repeat(272)); } catch (e) { tooLong = e.message; } try { orig.encode("x".repeat(272)); } catch (e) { tooLong2 = e.message; }
  kiem("quá sức chứa (272 byte): cả hai ném cùng lỗi tiếng Việt", !!tooLong && tooLong === tooLong2, tooLong);
  var link = Wiki.sync ? Wiki.sync.joinLink("https://a-very-long-production-host.example.com/webapp/tranphuc8a/personal-wiki/index.html?source=pwa", "mysql.wk_" + "A".repeat(16) + "." + "k".repeat(32)) : "";
  kiem("liên kết nối dài nhất thực tế (~150 byte) vừa một mã QR (≤ phiên bản 10)", !!link && mine.encode(link).version <= 10, link.length + " byte");
}

/* Đếm từ (editor.js, perf-md W1): bản quét mã ký tự phải cho đúng số như định nghĩa cũ `s.match(/[\p{L}\p{N}]+/gu).length`, và rẻ hơn. */
function wordTests() {
  sec("đếm từ của trình soạn (perf W1)");
  W.ui = W.ui || {};                                                   // editor.js là tệp giao diện: chỉ đọc W.ui khi dựng, không chạm DOM lúc nạp
  require(path.join(J, "ui/editor.js"));
  var wc = W.ui.editor && W.ui.editor.wordCount, old = function (s) { var m = String(s).match(/[\p{L}\p{N}]+/gu); return m ? m.length : 0; };
  kiem("Wiki.ui.editor.wordCount có", typeof wc === "function");
  if (typeof wc !== "function") return;
  var fixed = ["", " ", "một", "Đồ thị — LƯU trữ", "a1 b2", "x_y-z.w", "é café", "中文字 日本語", "😀 hi 😀", "𝒜𝒷 𐐷x", "٣٤ ½ ² x²", "\uD800 lẻ \uDC00 cặp 𝒜", "tab\tnewline\nend", "C++ và C#", "[[Liên kết]] `code` **đậm**"];
  var badF = fixed.filter(function (s) { return wc(s) !== old(s); });
  kiem("khớp định nghĩa cũ trên " + fixed.length + " ca khó (dấu rời NFD, CJK, emoji, chữ ngoài BMP, chữ số Ả Rập, ½ ², nửa cặp thay thế)", !badF.length, badF.map(function (s) { return JSON.stringify(s) + " " + wc(s) + "≠" + old(s); }).join(" ; "));
  var seed = 7, rnd = function () { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  var POOL = ["a", "Z", "9", " ", "\n", ".", ",", "-", "_", "ắ", "đ", "Ư", "́", "̣", "中", "語", "😀", "🧠", "𝒜", "𐐷", "\uD800", "\uDC00", "٣", "½", "²", "€", " ", "​", "ـ", "ß", "ﬁ", "Ⅻ", "①"];
  var badR = 0, firstBad = "";
  for (var k = 0; k < 3000; k++) { var s = "", len = Math.floor(rnd() * 40); for (var i = 0; i < len; i++) s += POOL[Math.floor(rnd() * POOL.length)]; if (wc(s) !== old(s)) { badR++; if (!firstBad) firstBad = JSON.stringify(s) + " " + wc(s) + "≠" + old(s); } }
  kiem("khớp định nghĩa cũ trên 3.000 chuỗi ngẫu nhiên đủ loại ký tự", badR === 0, badR + " lệch, vd " + firstBad);
  var big = ""; while (big.length < 400000) big += "Tiếng Việt có dấu: thuật toán 42 bước, cấu trúc dữ liệu — cây nhị phân (BST) và đồ thị; mã `x = y + 1`. 中文 😀\n";
  kiem("note 400k ký tự: cùng số từ", wc(big) === old(big), wc(big) + " ≠ " + old(big));
  // Đo xen kẽ (mới, cũ, mới, cũ…) và lấy lần NHANH NHẤT của mỗi bản: một đợt máy bận rơi vào cả hai, và lần nhanh nhất ít nhiễu nhất.
  // Máy rất chậm/đông vẫn đỏ chập chờn thì nới bằng PW_PERF_SLACK (mặc định 1, vd PW_PERF_SLACK=2 node kiem.js).
  var slack = Math.max(1, Number(process.env.PW_PERF_SLACK) || 1);
  function once(f) { var t0 = process.hrtime.bigint(); f(big); return Number(process.hrtime.bigint() - t0) / 1e6; }
  once(wc); once(old);
  var tNew = Infinity, tOld = Infinity;
  for (var r = 0; r < 5; r++) { tNew = Math.min(tNew, once(wc)); tOld = Math.min(tOld, once(old)); }
  kiem("note 400k ký tự: bản mới nhanh hơn bản cũ (nhanh nhất trong 5 lần xen kẽ: " + tNew.toFixed(1) + " ms so với " + tOld.toFixed(1) + " ms" + (slack > 1 ? ", PW_PERF_SLACK=" + slack : "") + ")", tNew < tOld * slack);
}

(async function main() {
  try {
    await zipTests();
    var ctx = await repoTests();
    await backupTests(ctx);
    await sharedStoreTests();
    await syncTests();
    await apiTests();
    await syncUxTests();
    qrTests();
    wordTests();
  } catch (e) { sai++; console.log("  [SAI] ngoại lệ không bắt: " + (e && e.stack || e)); }
  console.log("\n" + "=".repeat(58));
  if (sai) { console.log("SAI " + sai + " / " + (ok + sai) + " phép kiểm"); process.exit(1); }
  console.log("Đạt — " + ok + " phép kiểm.");
})();
