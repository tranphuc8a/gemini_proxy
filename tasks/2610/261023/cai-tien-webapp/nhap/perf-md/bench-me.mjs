// Đo pipeline của Markdown Editor Pro (markdown-editor/src/components/MarkdownView.tsx) theo TỪNG BƯỚC, trong node.
// Plugin thật, rehypeEnhance.ts thật (transpile bởi gen.mjs). Mermaid không chạy được trong node (đo trong trình duyệt).
// node bench-me.mjs [doc...]
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx, jsxs } from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { refractor } from 'refractor/core'
import tsLang from 'refractor/typescript'
import pyLang from 'refractor/python'
import cppLang from 'refractor/cpp'
import bashLang from 'refractor/bash'
import jsonLang from 'refractor/json'
import sqlLang from 'refractor/sql'
import goLang from 'refractor/go'
import rustLang from 'refractor/rust'
import { markdownUrlTransform, rehypeEnhance, sanitizeSchema } from './gen/rehypeEnhance.mjs'
import { getDocumentStats, extractHeadings } from './gen/markdown.mjs'
import { setNodeContent } from './gen/tree.mjs'

for (const l of [tsLang, pyLang, cppLang, bashLang, jsonLang, sqlLang, goLang, rustLang]) refractor.register(l)

const docs = process.argv.slice(2).length ? process.argv.slice(2) : ['doc-2k', 'doc-10k', 'doc-30k']
const RUNS = Number(process.env.RUNS || 3)

function time(fn, runs = RUNS) {
  const ts = []
  let out
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    out = fn()
    ts.push(performance.now() - t0)
  }
  ts.sort((a, b) => a - b)
  return { ms: ts[Math.floor(ts.length / 2)], out }
}
const f = (x) => (x >= 100 ? x.toFixed(0) : x.toFixed(1))

const components = {
  code: ({ node, className, children, ...props }) => {
    const match = /language-([\w-]+)/.exec(className ?? '')
    const language = match?.[1] ?? ''
    if (!language) return h('code', { className, ...props }, children)
    return h('div', { 'data-component': language === 'mermaid' ? 'MermaidDiagram' : 'CodeBlock', 'data-lang': language }, String(children))
  },
  pre: ({ children }) => h(Fragment, null, children)
}
const REHYPE = [rehypeRaw, [rehypeEnhance, { idPrefix: '' }], [rehypeSanitize, sanitizeSchema], rehypeKatex]

const results = {}
for (const name of docs) {
  const md = fs.readFileSync(`docs/${name}.md`, 'utf8')
  const kb = Buffer.byteLength(md) / 1024
  const row = { KB: Math.round(kb) }

  // 0) toàn bộ react-markdown (đúng đường của MarkdownView) → chuỗi HTML (renderToStaticMarkup ~ chi phí tạo cây React, KHÔNG gồm DOM commit)
  row.full_reactMarkdown_SSR = time(() => renderToStaticMarkup(h(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: REHYPE, components, urlTransform: markdownUrlTransform }, md))).ms

  // 1..n) từng bước
  const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
  const { ms: parse, out: mdast } = time(() => parser.parse(md))
  row.s1_parse_micromark_gfm_math = parse
  const tr1 = unified().use(remarkGfm).use(remarkMath).use(remarkRehype, { allowDangerousHtml: true })
  const { ms: m2h, out: hast0 } = time(() => tr1.runSync(structuredClone(mdast)))
  row.s2_mdast_to_hast = m2h
  const steps = [['s3_rehypeRaw', [rehypeRaw]], ['s4_rehypeEnhance', [[rehypeEnhance, { idPrefix: '' }]]], ['s5_sanitize', [[rehypeSanitize, sanitizeSchema]]], ['s6_katex', [rehypeKatex]]]
  let tree = hast0
  for (const [label, plugins] of steps) {
    const proc = unified()
    for (const p of plugins) Array.isArray(p) ? proc.use(p[0], p[1]) : proc.use(p)
    const input = tree
    const { ms, out } = time(() => proc.runSync(structuredClone(input)), 1)
    row[label] = ms
    tree = out
  }
  const { ms: jsxMs, out: el } = time(() => toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passKeys: true, passNode: true, ignoreInvalidStyle: true }))
  row.s7_toJsxRuntime = jsxMs
  row.s8_reactSSR_of_tree = time(() => renderToStaticMarkup(el)).ms

  // khối code: CodeBlock dùng react-syntax-highlighter (refractor) — tô lại MỖI lần Preview render vì CodeBlock không memo
  const blocks = []
  ;(function walk(n) { if (n.type === 'code' && n.lang && n.lang !== 'mermaid') blocks.push(n); (n.children || []).forEach(walk) })(mdast)
  const alias = { python: 'python', ts: 'typescript', cpp: 'cpp', bash: 'bash', json: 'json', sql: 'sql', go: 'go', rust: 'rust' }
  row.codeBlocks = blocks.length
  row.s9_refractor_all_blocks = time(() => { for (const b of blocks) refractor.highlight(b.value, alias[b.lang] || 'markup') }).ms

  // đếm phần tử
  let elements = 0, dataLine = 0
  ;(function walk(n) { if (n.type === 'element') { elements++; if (n.properties && n.properties['data-line'] != null) dataLine++ } (n.children || []).forEach(walk) })(tree)
  row.hastElements = elements
  row.dataLineAnchors = dataLine

  // Những việc chạy MỖI PHÍM (không debounce) ở EditorPane/StatusBar/Outline/store
  row.k_split_lines = time(() => md.split('\n'), 9).ms
  row.k_getDocumentStats = time(() => getDocumentStats(md), 5).ms
  row.k_extractHeadings = time(() => extractHeadings(md), 5).ms
  const files = [{ id: 'root', name: 'r', type: 'folder', children: [{ id: 'a', name: 'a.md', type: 'file', content: md, parentId: 'root' }, { id: 'b', name: 'b.md', type: 'file', content: 'x'.repeat(5000), parentId: 'root' }] }]
  row.k_setNodeContent = time(() => setNodeContent(files, 'a', md + 'x'), 9).ms
  row.autosave_JSON_stringify = time(() => JSON.stringify({ version: 2, files, currentFileId: 'a', expandedFolders: ['root'] }), 5).ms
  row.load_JSON_parse = (() => { const s = JSON.stringify({ files }); return time(() => JSON.parse(s), 5).ms })()
  // bộ nhớ một bản sao trong history (chuỗi 2 byte/ký tự vì có tiếng Việt)
  row.history_copy_MB = +(md.length * 2 / 1048576).toFixed(2)
  row.history_200_copies_MB = Math.round(md.length * 2 * 200 / 1048576)
  results[name] = row
}

const keys = Object.keys(results[docs[0]])
const table = {}
for (const k of keys) { table[k] = {}; for (const d of docs) { const v = results[d][k]; table[k][d] = typeof v === 'number' && !Number.isInteger(v) ? f(v) : v } }
console.table(table)
fs.writeFileSync('out/bench-me.json', JSON.stringify(results, null, 2))
