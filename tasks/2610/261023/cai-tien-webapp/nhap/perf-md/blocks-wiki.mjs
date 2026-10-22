// BẢN MẪU cho Personal Wiki: tách khối (cùng splitBlocks) → render từng khối bằng markdown.js THẬT → so với render cả note.
// node blocks-wiki.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { splitBlocks } from './split.mjs'

const require = createRequire(import.meta.url)
const ROOT = 'C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/personal-wiki/assets/js/core/'
for (const f of ['text', 'notes', 'markdown', 'highlight']) require(ROOT + f + '.js')
const W = globalThis.Wiki, M = W.markdown
const opts = { highlight: W.highlight, resolve: (t) => (t.length % 2 ? { id: 'x' + t.length, status: 'active' } : null) }
const norm = (s) => s.replace(/ id="h-[^"]*"/g, '')

const CASES = {
  list_blank: '- a\n\n- b\n\n  tiếp\n\nĐoạn',
  fence_blank: '```js\na\n\nb\n```\n\nSau',
  quote: '> a\n> b\n\n> c',
  qa: 'Q: hỏi\nA: đáp\n\nQ: hai\nA: ba',
  table: '| a | b |\n|---|---|\n| 1 | 2 |\n\ntext',
  wiki: 'Xem [[Trang A]] và [[depends_on::B]].\n\n[[C|bí danh]]',
  dup_h: '# Ví dụ\n\nx\n\n# Ví dụ'
}
const rows = {}
for (const [k, src] of Object.entries(CASES)) {
  const full = norm(M.render(src, opts))
  const parts = norm(splitBlocks(src).blocks.map((b) => M.render(b.text, opts)).join(''))
  rows[k] = { same: full === parts }
}
for (const name of ['doc-2k', 'wiki-12k']) {
  const md = fs.readFileSync('docs/' + name + '.md', 'utf8')
  let t0 = performance.now()
  const full = M.render(md, opts)
  const tFull = performance.now() - t0
  t0 = performance.now()
  const { blocks } = splitBlocks(md)
  const tSplit = performance.now() - t0
  const cache = new Map()
  t0 = performance.now()
  const html = blocks.map((b) => { let x = cache.get(b.text); if (x === undefined) { x = M.render(b.text, opts); cache.set(b.text, x) } return x }).join('')
  const tCold = performance.now() - t0
  // gõ 1 ký tự giữa note
  const lines = md.split('\n'); let mid = Math.floor(lines.length / 2); while (!/^[A-ZĐ]/.test(lines[mid])) mid++
  const off = lines.slice(0, mid).join('\n').length + 1 + lines[mid].length
  const ed = md.slice(0, off) + 'z' + md.slice(off)
  t0 = performance.now()
  const sp = splitBlocks(ed).blocks
  let miss = 0
  for (const b of sp) if (!cache.has(b.text)) { cache.set(b.text, M.render(b.text, opts)); miss++ }
  const tKey = performance.now() - t0
  rows[name] = { same: norm(full) === norm(html), blocks: blocks.length, full_ms: +tFull.toFixed(1), split_ms: +tSplit.toFixed(1), cold_ms: +tCold.toFixed(1), keystroke_ms: +tKey.toFixed(1), miss }
}
console.log(JSON.stringify(rows, null, 1))
fs.writeFileSync('out/blocks-wiki.json', JSON.stringify(rows, null, 2))
