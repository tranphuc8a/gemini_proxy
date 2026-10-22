// BẢN MẪU thiết kế "render tăng dần theo khối" cho Markdown Editor Pro:
//  1) splitBlocks(src): tách tài liệu thành các khối cấp cao AN TOÀN (chỉ cắt ở dòng trống không nằm trong rào code, $$…$$, khối HTML thô,
//     thẻ HTML chứa (<details>, <div>…) chưa đóng, mục danh sách / dòng thụt lề tiếp nối).
//  2) render từng khối bằng ĐÚNG pipeline của MarkdownView (react-markdown + plugin thật), cache theo chuỗi khối.
//  3) so sánh khác biệt (differential) với render cả tài liệu sau khi chuẩn hoá data-line / id tiêu đề.
// node blocks-proto.mjs
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { markdownUrlTransform, rehypeEnhance, sanitizeSchema } from './gen/rehypeEnhance.mjs'

import { splitBlocks } from './split.mjs'
// ----------------------------------------------------------------- render (đúng plugin của MarkdownView; CodeBlock/Mermaid thay bằng thẻ đánh dấu)
const components = {
  code: ({ node, className, children, ...props }) => {
    const match = /language-([\w-]+)/.exec(className ?? '')
    const language = match?.[1] ?? ''
    if (!language) return h('code', { className, ...props }, children)
    return h('div', { 'data-component': language === 'mermaid' ? 'MermaidDiagram' : 'CodeBlock', 'data-lang': language }, String(children).replace(/\n$/, ''))
  },
  pre: ({ children }) => h(Fragment, null, children)
}
const REHYPE = [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], [rehypeSanitize, sanitizeSchema], rehypeKatex]
const renderMd = (src) => renderToStaticMarkup(h(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: REHYPE, components, urlTransform: markdownUrlTransform }, src))

const norm = (html) => html
  .replace(/ data-line="\d+"/g, '')
  .replace(/ id="[^"]*"/g, '')
  .replace(/<a href="#[^"]*" class="heading-anchor"/g, '<a class="heading-anchor"')
  .replace(/>\s+</g, '><')
  .trim()

function shiftLines(html, offset) { return html.replace(/ data-line="(\d+)"/g, (_, n) => ` data-line="${+n + offset}"`) }

const cache = new Map()
function renderBlocks(blocks, stats) {
  const out = []
  for (const b of blocks) {
    let html = cache.get(b.text)
    if (html === undefined) { html = renderMd(b.text); cache.set(b.text, html); stats.miss++ } else stats.hit++
    out.push(shiftLines(html, b.start - 1))
  }
  return out.join('\n')
}

// ----------------------------------------------------------------- 1) ca khó (đúng/sai so với render cả tài liệu)
const CASES = {
  loose_list: '- a\n\n- b\n\n  tiếp nối của b\n\n- c\n\nĐoạn sau.',
  ordered_loose: '1. một\n\n2. hai\n\n3. ba',
  nested_fence_in_list: '- mục\n\n  ```js\n  const x = 1\n\n  const y = 2\n  ```\n\n- mục 2',
  fence_with_blanks: '```python\na = 1\n\n\nb = 2\n```\n\nSau.',
  tilde_fence: '~~~\n```\nkhông đóng ở đây\n\n~~~\n\nxong',
  math_block_blanks: '$$\na = b\n\nc = d\n$$\n\nSau.',
  details_md_inside: '<details>\n<summary>Mở</summary>\n\nNội dung **đậm**\n\n- một\n- hai\n\n</details>\n\nSau.',
  html_comment_blanks: '<!--\nchú thích\n\nnhiều dòng\n-->\n\nSau.',
  div_nested: '<div align="center">\n\n![x](https://a.b/c.png)\n\n<div>\n\nbên trong\n\n</div>\n\n</div>\n\nhết',
  indented_code: 'Đoạn.\n\n    mã thụt lề\n\n    còn mã\n\nĐoạn.',
  setext: 'Tiêu đề\n=======\n\nĐoạn\n---\n\nhết',
  table_then_para: '| a | b |\n|---|---|\n| 1 | 2 |\n\nĐoạn.',
  blockquote: '> trích\n> tiếp\n\n> trích mới\n\nđoạn',
  dup_headings: '# Ví dụ\n\ntext\n\n# Ví dụ\n\ntext\n\n## Ví dụ',
  hr_variants: 'a\n\n---\n\n***\n\nb',
  task_list: '- [ ] một\n- [x] hai\n\n- [ ] ba',
  ref_links: 'Xem [trang][r1] và [khác][r2].\n\nĐoạn khác.\n\n[r1]: https://example.com/1\n[r2]: https://example.com/2',
  footnotes: 'Câu có chú thích[^1].\n\nĐoạn khác[^2].\n\n[^1]: Chú thích một.\n[^2]: Chú thích hai.',
  inline_math_dollar: 'Giá $5 và $10.\n\nCông thức $x^2$.',
  mermaid: '```mermaid\ngraph TD\n  a --> b\n\n  b --> c\n```\n\nSau'
}
let bad = 0
const caseRows = {}
for (const [name, src] of Object.entries(CASES)) {
  const full = norm(renderMd(src))
  const { blocks, defs } = splitBlocks(src)
  // định nghĩa tham chiếu: nối vào mọi khối (render ra rỗng) — cách thiết kế đề xuất
  const withDefs = (t) => (defs.length ? t + '\n\n' + defs.join('\n') : t)
  const parts = norm(blocks.map((b) => renderMd(withDefs(b.text))).join(''))
  const ok = parts === full
  if (!ok) bad++
  caseRows[name] = { blocks: blocks.length, defs: defs.length, same: ok }
  if (!ok && process.env.SHOW) console.log('--- ' + name + '\nFULL  ' + full + '\nBLOCK ' + parts)
}
console.table(caseRows)

// ----------------------------------------------------------------- 2) tài liệu sinh: đúng + thời gian
const rows = {}
for (const name of ['doc-2k', 'doc-10k', 'doc-30k']) {
  const md = fs.readFileSync(`docs/${name}.md`, 'utf8')
  const r = {}
  let t0 = performance.now()
  const { blocks } = splitBlocks(md)
  r.split_ms = +(performance.now() - t0).toFixed(1)
  t0 = performance.now(); splitBlocks(md); r.split_ms_warm = +(performance.now() - t0).toFixed(1)
  r.blocks = blocks.length
  const sizes = blocks.map((b) => b.text.length).sort((a, b) => a - b)
  r.block_chars_p50 = sizes[Math.floor(sizes.length / 2)]
  r.block_chars_max = sizes[sizes.length - 1]
  cache.clear()
  const st = { hit: 0, miss: 0 }
  t0 = performance.now()
  const html1 = renderBlocks(blocks, st)
  r.cold_all_blocks_ms = Math.round(performance.now() - t0)
  // per-block thời gian (để đặt ngân sách lát cắt)
  if (name !== 'doc-30k') {
    t0 = performance.now(); const full = renderMd(md); r.full_render_ms = Math.round(performance.now() - t0)
    r.same_as_full = norm(full) === norm(html1)
    // data-line tuyệt đối khớp?
    const dl = (s) => (s.match(/ data-line="\d+"/g) || []).join(',')
    r.data_line_same = dl(full) === dl(html1)
  }
  // gõ 1 ký tự giữa tài liệu: tách lại + tìm trong cache + render 1 khối
  const lines = md.split('\n')
  let mid = Math.floor(lines.length / 2)
  while (!/^[A-ZĐ]/.test(lines[mid])) mid++
  const off = lines.slice(0, mid).join('\n').length + 1 + lines[mid].length
  const edited = md.slice(0, off) + 'z' + md.slice(off)
  const st2 = { hit: 0, miss: 0 }
  t0 = performance.now()
  const sp = splitBlocks(edited)
  const t1 = performance.now()
  renderBlocks(sp.blocks, st2)
  const t2 = performance.now()
  r.keystroke_split_ms = +(t1 - t0).toFixed(1)
  r.keystroke_render_ms = +(t2 - t1).toFixed(1)
  r.keystroke_miss = st2.miss
  rows[name] = r
}
console.table(rows)
console.log('ca khó lệch:', bad)
fs.writeFileSync('out/blocks-proto.json', JSON.stringify({ cases: caseRows, docs: rows }, null, 2))
