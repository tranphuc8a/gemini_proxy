// react-syntax-highlighter (cùng bản 16.1.1 mà CodeBlock.tsx dùng): useInlineStyles=true (mặc định, hiện tại) vs false (class + CSS).
// Đo đúng phần tạo phần tử React của mọi khối code trong tài liệu (renderToStaticMarkup ≈ chi phí render, không gồm commit DOM).
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light.js'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js'
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript.js'
import py from 'react-syntax-highlighter/dist/esm/languages/prism/python.js'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp.js'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json.js'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql.js'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go.js'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust.js'

for (const [n, l] of Object.entries({ typescript: ts, python: py, cpp, bash, json, sql, go, rust })) SyntaxHighlighter.registerLanguage(n, l)
const alias = { ts: 'typescript', python: 'python', cpp: 'cpp', bash: 'bash', json: 'json', sql: 'sql', go: 'go', rust: 'rust' }

for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['doc-2k', 'doc-10k']) {
  const md = fs.readFileSync(`docs/${name}.md`, 'utf8')
  const blocks = []
  const re = /^```(\w+)\n([\s\S]*?)\n```$/gm
  let m
  while ((m = re.exec(md))) if (m[1] !== 'mermaid') blocks.push([alias[m[1]] || m[1], m[2]])
  const run = (inline) => {
    const t0 = performance.now()
    let tokens = 0
    for (const [lang, code] of blocks) {
      const html = renderToStaticMarkup(h(SyntaxHighlighter, { language: lang, style: oneLight, useInlineStyles: inline, PreTag: 'div', customStyle: { margin: 0 } }, code))
      tokens += (html.match(/<span/g) || []).length
    }
    return { ms: +(performance.now() - t0).toFixed(1), tokens }
  }
  run(true); run(false) // làm nóng JIT
  console.log(name, 'blocks', blocks.length, 'inlineStyles=true', run(true), 'inlineStyles=false', run(false))
}
