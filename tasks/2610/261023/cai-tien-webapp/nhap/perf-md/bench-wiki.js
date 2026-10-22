// Đo trình dựng Markdown tự viết của Personal Wiki (dùng chung với Algorithm Notebook qua sync.py) và những việc chạy MỖI PHÍM
// trong ui/editor.js (setStatus: isDirty + extractCards + words). node bench-wiki.js
const fs = require("fs");
const { performance } = require("perf_hooks");
const ROOT = "C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/personal-wiki/assets/js/core/";
require(ROOT + "text.js"); require(ROOT + "notes.js"); require(ROOT + "markdown.js"); require(ROOT + "highlight.js"); require(ROOT + "flash.js");
const W = globalThis.Wiki, M = W.markdown;

function time(fn, runs) {
  runs = runs || 5; const ts = []; let out;
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); out = fn(); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b); return { ms: +ts[Math.floor(ts.length / 2)].toFixed(1), out };
}
function words(s) { const m = String(s).match(/[\p{L}\p{N}]+/gu); return m ? m.length : 0; }
// bản sao same() của editor.js (so sánh toàn văn)
function same(a, b) { return a.title === b.title && a.content === b.content && a.fav === b.fav && a.kind === b.kind && a.tags.join("\u0001") === b.tags.join("\u0001") && JSON.stringify(a.rel) === JSON.stringify(b.rel) && JSON.stringify(a.meta) === JSON.stringify(b.meta); }

const table = {};
for (const name of ["doc-2k", "wiki-12k", "doc-10k"]) {
  let md = fs.readFileSync("docs/" + name + ".md", "utf8");
  const row = { chars: md.length };
  if (md.length > 500000) { md = md.slice(0, 500000); row.note = "cắt 500k (LIM.content)"; }
  const opts = { highlight: W.highlight, resolve: () => null };
  row.render_full = time(() => M.render(md, opts)).ms;
  row.render_no_highlight = time(() => M.render(md, { resolve: () => null })).ms;
  row.html_KB = Math.round(M.render(md, opts).length / 1024);
  row.headings = time(() => M.headings(md)).ms;
  // mỗi phím: setStatus()
  const a = { title: "t", content: md, tags: [], fav: false, kind: "note", rel: [], meta: {} }, b = Object.assign({}, a, { content: md + "x" });
  row.k_isDirty_same = time(() => same(a, b), 9).ms;
  row.k_extractCards = time(() => W.flash.extractCards("id", md), 5).ms;
  row.k_words = time(() => words(md), 5).ms;
  row.k_setStatus_total = +(row.k_isDirty_same + row.k_extractCards + row.k_words).toFixed(1);
  table[name] = row;
}
console.table(table);
fs.writeFileSync("out/bench-wiki.json", JSON.stringify(table, null, 2));
