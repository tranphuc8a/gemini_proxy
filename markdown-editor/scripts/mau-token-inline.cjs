// Đáp án chuẩn cho phép kiểm màu khối code (kiem-pwa.py mục 9): style mà chế độ INLINE gốc của react-syntax-highlighter
// (cách app tô trước đợt M1) gán cho token mang đúng danh sách lớp đó — tính bằng chính hàm `createStyleObject` của thư
// viện và chuỗi style do React viết ra — để so với màu Edge tính được trên DOM thật của app.
//
//   node markdown-editor/scripts/mau-token-inline.cjs < vao.json > dap-an.json
//
// Vào (stdin): {"theme": "light" | "dark", "blocks": [[["token", "tag", "attr-name"], ...], ...]}  (lớp của từng span)
// Ra (stdout): {"wrapper": "<style khung khối code>", "blocks": [["<style>", ...], ...]}  (chuỗi đã giải mã HTML)
//
// Lấy danh sách lớp từ DOM của app (không tự tô lại mã nguồn) vì cây token phụ thuộc grammar nào đã nạp lúc tô: bản
// async-light của app nạp từng ngôn ngữ một, bản đầy đủ trong node có sẵn tất cả, nên cùng mã có thể ra cây khác nhau.
'use strict'
const path = require('path')

const req = (name) => require(path.join(__dirname, '..', 'node_modules', name))
const React = req('react')
const { renderToStaticMarkup } = req('react-dom/server')
const { createStyleObject } = req('react-syntax-highlighter/dist/cjs/create-element')
const SyntaxHighlighter = req('react-syntax-highlighter/dist/cjs/prism').default
const themes = {
  light: req('react-syntax-highlighter/dist/cjs/styles/prism/one-light').default,
  dark: req('react-syntax-highlighter/dist/cjs/styles/prism/one-dark').default
}

const decode = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** The style attribute React writes for this style object ('' when it writes none). */
const styleText = (style) => {
  const html = renderToStaticMarkup(React.createElement('span', { style }))
  const match = /style="([^"]*)"/.exec(html)
  return match ? decode(match[1]) : ''
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  const { theme, blocks } = JSON.parse(input)
  const sheet = themes[theme]
  // The wrapper with the props CodeBlock passed before M1 (src/components/CodeBlock.tsx at HEAD~1).
  const html = renderToStaticMarkup(
    React.createElement(
      SyntaxHighlighter,
      {
        language: 'text',
        style: sheet,
        PreTag: 'div',
        customStyle: { margin: 0, background: 'transparent', padding: '14px 16px', fontSize: '0.85em' },
        codeTagProps: { style: { fontFamily: 'var(--font-mono)' } }
      },
      'x'
    )
  )
  const wrapper = /^<div style="([^"]*)"/.exec(html)
  const out = {
    wrapper: wrapper ? decode(wrapper[1]) : '',
    blocks: blocks.map((spans) => spans.map((classes) => styleText(createStyleObject(classes, {}, sheet))))
  }
  process.stdout.write(JSON.stringify(out))
})
