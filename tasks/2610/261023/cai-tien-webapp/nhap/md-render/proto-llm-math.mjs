// PROTOTYPE (scratch only) of the proposed remarkLlmMath plugin, to validate the design.
// normalizeMathDelimiters: line-preserving rewrite of \( \) \[ \] and bare \begin{env} into $-math,
// skipping ranges that a first parse found to be code/math/html.
import { visit, SKIP } from 'unist-util-visit'

const ENVS = 'equation|align|gather|multline|flalign|alignat|eqnarray|split|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|array|CD|aligned|gathered'
const BEGIN = new RegExp(String.raw`\\begin\{(` + ENVS + String.raw`)(\*?)\}`, 'y')
const MAYBE = /\\[([]|\\begin\{|\$/
const PREFIX_ONLY = /^[ \t]*(?:>[ \t]?)*[ \t]*(?:(?:[-+*]|\d{1,9}[.)])[ \t]+)?$/
const QUOTE_ONLY = /^[ \t]*(?:>[ \t]?)*[ \t]*$/
const DANGER = /^(?:[-+*=#<>~`|]|\d{1,9}[.)])/

function stopBlank(s, from) {
  const re = /\n[ \t>]*\n/g
  re.lastIndex = from
  const m = re.exec(s)
  return m ? m.index : Infinity
}
function lineStart(s, i) { return s.lastIndexOf('\n', i - 1) + 1 }
function lineEnd(s, i) { const e = s.indexOf('\n', i); return e === -1 ? s.length : e }
function backslashRun(s, i) { let j = i; while (s[j] === '\\') j++; return j - i }

/** Index of the first char of the closing `\)`/`\]` (its backslash), or -1. Stops at a blank line or a skip range. */
function findCloser(s, from, closeCh, stopAt) {
  let j = from
  while (j < s.length && j < stopAt) {
    const c = s[j]
    if (c === '\n') {
      // blank line (possibly "> ") ends the paragraph
      const e = lineEnd(s, j + 1)
      if (QUOTE_ONLY.test(s.slice(j + 1, e))) return -1
    }
    if (c === '\\') {
      const r = backslashRun(s, j)
      if (r % 2 === 1 && s[j + r] === closeCh) return j + r - 1
      j += r
      continue
    }
    j++
  }
  return -1
}

function findEnd(s, from, env, stopAt) {
  const re = new RegExp(String.raw`\\(begin|end)\{` + env.replace('*', '\\*') + String.raw`\}`, 'g')
  re.lastIndex = from
  let depth = 1, m
  while ((m = re.exec(s))) {
    if (m.index >= stopAt) return -1
    const between = s.slice(from, m.index)
    if (/\n[ \t>]*\n/.test(between)) return -1
    depth += m[1] === 'begin' ? 1 : -1
    if (depth === 0) return m.index + m[0].length
  }
  return -1
}

function neutralize(content, quoteDepth) {
  const prefix = new RegExp(String.raw`^([ \t]*(?:>[ \t]?){0,` + quoteDepth + String.raw`}[ \t]*)`)
  return content.split('\n').map((line, k) => {
    if (k === 0) return line
    const p = prefix.exec(line)[1]
    const rest = line.slice(p.length)
    return DANGER.test(rest) ? p + '\\relax ' + rest : line
  }).join('\n')
}

function maxDollarRun(t) { let best = 0; for (const m of t.matchAll(/\$+/g)) best = Math.max(best, m[0].length); return best }

export function normalizeMathDelimiters(src, skip) {
  if (!MAYBE.test(src)) return { text: src, display: new Set(), generated: new Set() }
  skip = [...skip].sort((a, b) => a[0] - b[0])
  let out = '', i = 0, si = 0, changedDollar = false
  const display = new Set(), generated = new Set()
  const nextSkipStart = () => (si < skip.length ? skip[si][0] : Infinity)
  while (i < src.length) {
    while (si < skip.length && skip[si][1] <= i) si++
    if (si < skip.length && skip[si][0] <= i) { out += src.slice(i, skip[si][1]); i = skip[si][1]; si++; continue }
    const c = src[i]
    if (c === '$') {
      // pandoc rules for single-dollar math; $$..$$ runs are left alone
      let run = 0; while (src[i + run] === '$') run++
      if (run >= 2) {
        const close = src.indexOf('$'.repeat(run), i + run)
        const stop = Math.min(close === -1 ? Infinity : close, stopBlank(src, i + run))
        if (close !== -1 && close === stop && close < nextSkipStart()) { out += src.slice(i, close + run); i = close + run } else { out += src.slice(i, i + run); i += run }
        continue
      }
      const canOpen = src[i + 1] !== undefined && !/\s/.test(src[i + 1])
      let j = -1
      if (canOpen) {
        const k = src.indexOf('$', i + 1)
        if (k !== -1 && k < stopBlank(src, i + 1) && k < nextSkipStart() && src[k + 1] !== '$' && !/\s/.test(src[k - 1]) && !/\d/.test(src[k + 1] || '')) j = k
      }
      if (j === -1) { out += '\\$'; changedDollar = true; i++; continue }
      out += src.slice(i, j + 1); i = j + 1
      continue
    }
    if (c !== '\\') { out += c; i++; continue }
    const r = backslashRun(src, i)
    const k = i + r - 1 // the delimiter backslash
    const next = src[k + 1]
    const ls = lineStart(src, k)
    const before = src.slice(ls, k)
    const stopAt = nextSkipStart()
    if (r % 2 === 1 && (next === '(' || next === '[')) {
      const closer = findCloser(src, k + 2, next === '(' ? ')' : ']', stopAt)
      if (closer !== -1) {
        const content = src.slice(k + 2, closer)
        out += src.slice(i, k) // even part of the backslash run
        const afterOpen = src.slice(k + 2, lineEnd(src, k + 2))
        const closerLs = lineStart(src, closer)
        const flow = next === '[' && PREFIX_ONLY.test(before) && !afterOpen.trim() &&
          QUOTE_ONLY.test(src.slice(closerLs, closer)) && !src.slice(closer + 2, lineEnd(src, closer + 2)).trim() && content.includes('\n')
        if (flow) {
          out += '$$' + content + '$$'
        } else {
          const n = maxDollarRun(content) + 1
          if (n >= 2 && PREFIX_ONLY.test(before) && content.includes('\n')) { out += src.slice(k, closer + 2); i = closer + 2; continue }
          const depth = (before.match(/>/g) || []).length
          generated.add(out.length)
          if (next === '[') display.add(out.length)
          out += '$'.repeat(n) + neutralize(content, depth) + '$'.repeat(n)
        }
        i = closer + 2
        continue
      }
    }
    if (r === 1 && PREFIX_ONLY.test(before)) {
      BEGIN.lastIndex = i; const m = BEGIN.exec(src)
      if (m) {
        const end = findEnd(src, i + m[0].length, m[1] + m[2], stopAt)
        if (end !== -1) {
          const content = src.slice(i, end)
          const n = maxDollarRun(content) + 1
          if (!(n >= 2 && content.includes('\n'))) {
            const depth = (before.match(/>/g) || []).length
            generated.add(out.length); display.add(out.length)
            out += '$'.repeat(n) + neutralize(content, depth) + '$'.repeat(n)
            i = end
            continue
          }
        }
      }
    }
    // odd run: the last backslash escapes the next character (e.g. \$), copy both
    const take = r % 2 === 1 && k + 1 < src.length ? r + 1 : r
    out += src.slice(i, i + take)
    i += take
  }
  return { text: out, display, generated }
}

const SKIP_TYPES = new Set(['code', 'inlineCode', 'math', 'html'])
function collectSkip(tree) {
  const ranges = []
  visit(tree, (node) => {
    if (SKIP_TYPES.has(node.type) && node.position) { ranges.push([node.position.start.offset, node.position.end.offset]); return SKIP }
  })
  return ranges
}

function fixTex(v) {
  return v
    .replace(/\\(begin|end)\{(multline|flalign)(\*?)\}/g, (m, be, env, star) => `\\${be}{${env === 'multline' ? 'gather' : 'align'}${star}}`)
    .replace(/\\(begin|end)\{eqnarray(\*?)\}/g, (m, be, star) => `\\${be}{align${star}}`)
    .replace(/\\require\{[^{}]*\}/g, '')
}
function setMathValue(node, value) {
  node.value = value
  if (node.type === 'inlineMath') node.data.hChildren = [{ type: 'text', value }]
  else node.data.hChildren[0].children = [{ type: 'text', value }]
}
function blockMath(value, position) {
  return {
    type: 'math', meta: null, value, position,
    data: { hName: 'pre', hChildren: [{ type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-display'] }, children: [{ type: 'text', value }] }] }
  }
}

export default function remarkLlmMath() {
  const self = this
  return (tree, file) => {
    const src = String(file.value)
    let text = src, gen = { display: new Set(), generated: new Set() }
    if (MAYBE.test(src)) {
      const r = normalizeMathDelimiters(src, collectSkip(tree))
      if (r.text !== src) {
        const fresh = self.parse(r.text)
        tree.children = fresh.children
        text = r.text
        gen = r
      }
    }
    visit(tree, (node, index, parent) => {
      if (node.type === 'math' || node.type === 'inlineMath') {
        const v = fixTex(node.value)
        if (v !== node.value) setMathValue(node, v)
      }
      if (node.type === 'paragraph') {
        const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
        if (kids.length === 1 && kids[0].type === 'inlineMath') {
          const off = kids[0].position.start.offset
          const disp = gen.display.has(off) || (!gen.generated.has(off) && text.startsWith('$$', off))
          if (disp) { parent.children[index] = blockMath(fixTex(kids[0].value), node.position); return SKIP }
        }
      }
      if (node.type === 'inlineMath') {
        const off = node.position.start.offset
        if (gen.display.has(off)) node.data.hProperties = { className: ['language-math', 'math-display'] }
        else if (!gen.generated.has(off) && text[off] === '$' && text[off + 1] !== '$' && /\d/.test(text[node.position.end.offset] || '')) {
          parent.children[index] = { type: 'text', value: text.slice(off, node.position.end.offset), position: node.position }
        }
      }
    })
  }
}
