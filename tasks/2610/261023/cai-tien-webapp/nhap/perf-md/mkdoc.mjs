// Sinh tài liệu markdown dài "thực tế": heading, đoạn văn (tiếng Việt + Anh), danh sách, việc cần làm, bảng,
// khối code nhiều ngôn ngữ, toán inline + khối, trích dẫn, ảnh https + 1 ảnh data URL, vài sơ đồ mermaid.
// node mkdoc.mjs  -> docs/doc-2k.md, doc-10k.md, doc-30k.md, wiki-12k.md (≈ 480 000 ký tự, dưới trần 500 000 của wiki)
import fs from 'node:fs'

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const WORDS_VI = 'thuật toán dữ liệu cấu trúc đồ thị đường đi ngắn nhất độ phức tạp bộ nhớ đệm hàng đợi ưu tiên cây nhị phân tìm kiếm cân bằng quy hoạch động tham lam chia để trị kiểm thử hiệu năng máy chủ trình duyệt giao diện người dùng đồng bộ ghi chú tài liệu phiên bản'.split(' ')
const WORDS_EN = 'the quick brown fox jumps over lazy dog latency throughput cache invalidation render pipeline virtual scroll worker thread incremental parse block hash memo frame budget'.split(' ')
const LANGS = {
  ts: (r) => [`export function solve${Math.floor(r() * 999)}(input: number[]): number {`, '  let best = -Infinity', '  for (const value of input) {', '    // keep the running maximum', '    best = Math.max(best, value * 2 - 1)', '  }', "  return best === -Infinity ? 0 : best", '}', '', 'const cache = new Map<string, number>()', "console.log(solve([1, 2, 3]), cache.size, `done ${Date.now()}`)"],
  python: (r) => [`def dijkstra_${Math.floor(r() * 999)}(graph, src):`, '    import heapq', '    dist = {src: 0}', '    pq = [(0, src)]', '    while pq:', '        d, u = heapq.heappop(pq)', '        if d > dist.get(u, float("inf")):', '            continue', '        for v, w in graph[u]:', '            nd = d + w', '            if nd < dist.get(v, float("inf")):', '                dist[v] = nd', '                heapq.heappush(pq, (nd, v))', '    return dist  # O((V + E) log V)'],
  cpp: (r) => ['#include <bits/stdc++.h>', 'using namespace std;', `int main${Math.floor(r() * 9)}() {`, '    ios::sync_with_stdio(false);', '    int n; cin >> n;', '    vector<long long> a(n);', '    for (auto &x : a) cin >> x;', '    sort(a.begin(), a.end());', '    long long ans = 0;', '    for (int i = 0; i < n; ++i) ans += a[i] * (i + 1);', '    cout << ans << "\\n";', '    return 0;', '}'],
  bash: () => ['#!/usr/bin/env bash', 'set -euo pipefail', 'for f in *.md; do', '  wc -l "$f"', 'done | sort -n | tail -5', 'echo "total: $(cat *.md | wc -c)"'],
  json: (r) => ['{', `  "id": ${Math.floor(r() * 99999)},`, '  "name": "benchmark",', '  "tags": ["perf", "markdown", "editor"],', '  "nested": { "ok": true, "ratio": 0.75, "list": [1, 2, 3] }', '}'],
  sql: () => ['SELECT u.id, u.name, COUNT(o.id) AS orders', 'FROM users u', 'LEFT JOIN orders o ON o.user_id = u.id', "WHERE u.created_at >= '2026-01-01'", 'GROUP BY u.id, u.name', 'HAVING COUNT(o.id) > 3', 'ORDER BY orders DESC', 'LIMIT 20;'],
  go: () => ['package main', '', 'import "fmt"', '', 'func main() {', '\tch := make(chan int, 4)', '\tgo func() { for i := 0; i < 4; i++ { ch <- i * i }; close(ch) }()', '\tfor v := range ch {', '\t\tfmt.Println(v)', '\t}', '}'],
  rust: () => ['fn main() {', '    let v: Vec<u64> = (1..=10).map(|x| x * x).collect();', '    let s: u64 = v.iter().sum();', '    println!("{:?} {}", v, s);', '}']
}
const LANG_NAMES = Object.keys(LANGS)
const MERMAID = [
  ['flowchart LR', '  A[Gõ phím] --> B{Debounce?}', '  B -->|có| C[Parse khối đổi]', '  B -->|không| D[Chờ]', '  C --> E[Vá DOM]', '  E --> F[Khung hình kế]'],
  ['sequenceDiagram', '  participant U as Người dùng', '  participant E as Editor', '  participant W as Worker', '  U->>E: input', '  E->>W: blocks changed', '  W-->>E: html', '  E-->>U: paint'],
  ['graph TD', '  root --> a', '  root --> b', '  a --> c', '  a --> d', '  b --> e', '  e --> f']
]
const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJElEQVR42mNkYPj/n4GBgYGJAQoYGRn+MzAwMDCgCzCiCzAwAABL4wQGR4l3lQAAAABJRU5ErkJggg=='

function make(targetLines, seed, opts = {}) {
  const r = rng(seed)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const sentence = (n) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(r() < 0.7 ? pick(WORDS_VI) : pick(WORDS_EN))
    let s = out.join(' ')
    s = s[0].toUpperCase() + s.slice(1)
    // một ít inline markup
    if (r() < 0.35) s += ` **${pick(WORDS_VI)} ${pick(WORDS_VI)}**`
    if (r() < 0.25) s += ` *${pick(WORDS_EN)}*`
    if (r() < 0.3) s += ` \`${pick(WORDS_EN)}()\``
    if (r() < 0.2) s += ` [liên kết](https://example.com/${pick(WORDS_EN)})`
    if (r() < 0.15) s += ` công thức $O(n \\log n)$ và $a_i^2 + b_i^2 = c_i^2$`
    return s + '.'
  }
  const lines = []
  let sec = 0
  const mermaidEvery = opts.mermaidEvery ?? 2000
  let nextMermaid = Math.floor(mermaidEvery / 2)
  let dataImg = false
  while (lines.length < targetLines) {
    sec++
    lines.push(`## ${sec}. ${sentence(4).replace(/[.*`$\[\]()]/g, '').slice(0, 60)}`, '')
    const blocks = 6 + Math.floor(r() * 6)
    for (let b = 0; b < blocks && lines.length < targetLines; b++) {
      const k = r()
      if (lines.length >= nextMermaid) {
        lines.push('```mermaid', ...pick(MERMAID), '```', '')
        nextMermaid += mermaidEvery
        continue
      }
      if (k < 0.32) {
        // đoạn văn 2–5 câu, có khi xuống dòng mềm
        const n = 2 + Math.floor(r() * 4)
        for (let i = 0; i < n; i++) lines.push(sentence(10 + Math.floor(r() * 14)))
        lines.push('')
      } else if (k < 0.45) {
        const n = 3 + Math.floor(r() * 6)
        const task = r() < 0.3
        const ordered = !task && r() < 0.3
        for (let i = 0; i < n; i++) {
          const mark = task ? `- [${r() < 0.5 ? 'x' : ' '}] ` : ordered ? `${i + 1}. ` : '- '
          lines.push(mark + sentence(6 + Math.floor(r() * 8)))
          if (r() < 0.2) lines.push('  - ' + sentence(5))
        }
        lines.push('')
      } else if (k < 0.55) {
        const cols = 3 + Math.floor(r() * 3)
        const rows = 4 + Math.floor(r() * 6)
        lines.push('| ' + Array.from({ length: cols }, (_, i) => `Cột ${i + 1}`).join(' | ') + ' |')
        lines.push('|' + Array.from({ length: cols }, (_, i) => (i === 0 ? ':---' : i === cols - 1 ? '---:' : ':---:')).join('|') + '|')
        for (let i = 0; i < rows; i++) lines.push('| ' + Array.from({ length: cols }, () => (r() < 0.3 ? String(Math.floor(r() * 10000)) : `${pick(WORDS_VI)} ${pick(WORDS_EN)}`)).join(' | ') + ' |')
        lines.push('')
      } else if (k < 0.72) {
        const lang = pick(LANG_NAMES)
        lines.push('```' + lang, ...LANGS[lang](r), '```', '')
      } else if (k < 0.78) {
        lines.push('$$', `\\sum_{i=1}^{${Math.floor(r() * 100)}} \\frac{x_i^2}{\\sqrt{1 + y_i}} = \\int_0^1 f(t)\\,dt`, '$$', '')
      } else if (k < 0.84) {
        lines.push('> ' + sentence(12), '> ' + sentence(9), '')
      } else if (k < 0.88) {
        if (!dataImg) { lines.push(`![ảnh nhúng](${PNG_DATA})`, ''); dataImg = true }
        else lines.push(`![hình ${sec}-${b}](https://img.example.test/${sec}-${b}.png)`, '')
      } else if (k < 0.92) {
        lines.push(`### ${sec}.${b} ${sentence(3).replace(/[.*`$\[\]()]/g, '').slice(0, 50)}`, '')
      } else {
        lines.push('---', '')
      }
    }
  }
  return lines.slice(0, targetLines).join('\n') + '\n'
}

function stats(md) {
  const fences = (md.match(/^```/gm) || []).length / 2
  return { lines: md.split('\n').length - 1, kb: Math.round(Buffer.byteLength(md) / 1024), chars: md.length, fences, mermaid: (md.match(/^```mermaid/gm) || []).length, math: (md.match(/^\$\$$/gm) || []).length / 2, tables: (md.match(/^\|(:---|---)/gm) || []).length, headings: (md.match(/^#{2,3} /gm) || []).length, imgs: (md.match(/!\[/g) || []).length }
}

const out = {}
for (const [name, n, seed, o] of [['doc-2k', 2000, 7, { mermaidEvery: 1000 }], ['doc-10k', 10000, 11, { mermaidEvery: 2000 }], ['doc-30k', 30000, 13, { mermaidEvery: 3000 }], ['wiki-12k', 9000, 17, { mermaidEvery: 99999 }]]) {
  let md = make(n, seed, o)
  if (name === 'wiki-12k') md = md.slice(0, 480000)
  fs.writeFileSync(`docs/${name}.md`, md)
  out[name] = stats(md)
}
console.table(out)
