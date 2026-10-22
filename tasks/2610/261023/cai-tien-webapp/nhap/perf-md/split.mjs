// splitBlocks — bản mẫu (tách từ blocks-proto.mjs)
const LIST_ITEM = /^ {0,3}([-*+]|\d{1,9}[.)])([ \t]|$)/
const CONTAINER = 'details|div|section|table|figure|blockquote|ul|ol|dl|center|article|aside|nav|header|footer|main|picture|video|audio'
const OPEN_RE = new RegExp(`<(${CONTAINER})(?=[\\s>/])[^>]*?(/?)>`, 'gi')
const CLOSE_RE = new RegExp(`</(${CONTAINER})\\s*>`, 'gi')
const RAW_HTML = [
  [/^ {0,3}<(script|pre|style|textarea)(?=[\s>]|$)/i, /<\/(script|pre|style|textarea)>/i],
  [/^ {0,3}<!--/, /-->/],
  [/^ {0,3}<\?/, /\?>/],
  [/^ {0,3}<![A-Za-z]/, />/],
  [/^ {0,3}<!\[CDATA\[/, /\]\]>/]
]
const DEF_RE = /^ {0,3}\[(\^?)[^\]\n]+\]:/

/** Tách khối. Trả [{start: dòng đầu 1-based, text}], và danh sách dòng định nghĩa (tham chiếu link / footnote). */
export function splitBlocks(src) {
  const lines = src.split('\n')
  const blocks = []
  const defs = []
  let start = 0, fence = null, math = 0, raw = null, depth = 0, lastNonBlank = -1, prevBlank = false
  const blank = (s) => s.length === 0 || /^[ \t]*$/.test(s)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (fence) {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len) fence = null
      lastNonBlank = i; prevBlank = false; continue
    }
    if (math) {
      const m = /^ {0,3}(\${2,})[ \t]*$/.exec(line)
      if (m && m[1].length >= math) math = 0
      lastNonBlank = i; prevBlank = false; continue
    }
    if (raw) {
      if (raw.test(line)) raw = null
      if (!blank(line)) lastNonBlank = i
      prevBlank = blank(line); continue
    }
    if (blank(line)) { prevBlank = true; continue }
    // dòng có chữ, ngoài mọi cấu trúc: có cắt khối trước nó không?
    if (prevBlank && lastNonBlank >= start && depth === 0) {
      const indented = /^( {2,}|\t)/.test(line)
      const listCont = LIST_ITEM.test(line) && (LIST_ITEM.test(lines[lastNonBlank]) || /^( {2,}|\t)/.test(lines[lastNonBlank]))
      if (!indented && !listCont) { blocks.push({ start: start + 1, text: lines.slice(start, i).join('\n') }); start = i }
    }
    prevBlank = false
    lastNonBlank = i
    let m
    if ((m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)) && !(m[1][0] === '`' && m[2].includes('`'))) { fence = { ch: m[1][0], len: m[1].length }; continue }
    if ((m = /^ {0,3}(\${2,})([^$]*)$/.exec(line))) { math = m[1].length; continue }
    for (const [open, close] of RAW_HTML) if (open.test(line)) { if (!close.test(line.replace(open, ''))) raw = close; break }
    if (raw) continue
    if (line.includes('<')) {
      const opens = (line.match(OPEN_RE) || []).filter((t) => !/\/>$/.test(t)).length
      const closes = (line.match(CLOSE_RE) || []).length
      depth = Math.max(0, depth + opens - closes)
    }
    if (DEF_RE.test(line)) defs.push(i)
  }
  if (start < lines.length) blocks.push({ start: start + 1, text: lines.slice(start).join('\n') })
  return { blocks, defs: defs.map((i) => lines[i]) }
}

