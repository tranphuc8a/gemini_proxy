/**
 * Maths as chat assistants write it, rewritten into the `$` syntax remark-math reads.
 *
 * remark-math only knows `$…$` and `$$…$$`. ChatGPT and Claude often answer with `\( … \)`, `\[ … \]` or a bare
 * `\begin{align}`; Markdown reads those backslashes as escapes, so the formula came out as plain text with its `\\` line
 * breaks and `_`/`*` eaten. Prices (`$5 and $10`) were the opposite problem: two dollars on a line became a formula.
 *
 * `normalizeMath` fixes both BEFORE the parser runs, in one pass over the text, and never adds or removes a line: the
 * preview's `data-line` anchors (scroll sync, double-click to jump) are source line numbers, so only columns may move.
 * Code, raw HTML blocks and existing `$$` blocks are left exactly as they are (`findSkipRanges`); code spans, inline
 * HTML tags and autolinks are recognised during the scan itself, left to right, the way micromark decides which
 * construct wins (`$a <b c>d$` is a formula, `` `$x$` `` is code).
 *
 * Rules (tasks/2610/261023/cai-tien-webapp/thiet-ke/md-render.md §3.1.2):
 *  - `\[` alone on its line … `\]` alone on its line → a `$$` block (the content is left untouched by Markdown);
 *  - other `\[ … \]` → text math marked `display` (mid-sentence only when the content looks like TeX, so `\[Enter\]`
 *    stays text), `\( … \)` → text math; both must close before a blank line;
 *  - `\begin{align}` (and friends) at the start of a line, up to its `\end{…}` → text math marked `display`;
 *  - a line opening with `$$` + text that closes on a later line → text math marked `display` (micromark would read the
 *    first line as a fence with an info string and throw half the formula away);
 *  - single `$` follows pandoc: the opener needs a non-space on its right, the closer a non-space on its left and no
 *    digit after it; a dollar that does not pair becomes `\$`.
 * Lines inside generated multi-line math that would start a new block (a list marker, `#`, `>`, `$$`…) get a leading
 * `\relax ` (invisible to KaTeX, unlike `{}` which turns `-` into a binary minus).
 *
 * `display` and `generated` hold the offsets (in the returned text) of opening `$` runs; `remarkMathPromote` reads them
 * after parsing to turn a formula that stands alone into a display block.
 */

export type Range = [start: number, end: number]

export interface PreparedMath {
  /** The rewritten source, with exactly as many lines as the input. */
  text: string
  /** Offsets in `text` of opening `$` runs that must render in display style. */
  display: Set<number>
  /** Offsets in `text` of opening `$` runs written here rather than by the author. */
  generated: Set<number>
}

/** Environments that make sense as display maths on their own (KaTeX knows them, or `fixTex` maps them). */
const ENVIRONMENTS =
  'equation|align|gather|multline|flalign|alignat|alignedat|eqnarray|split|cases|dcases|rcases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|array|CD|aligned|gathered'
const BEGIN = new RegExp(String.raw`\\begin\{(` + ENVIRONMENTS + String.raw`)(\*?)\}`, 'y')
/** Characters the scanner stops at; everything else is copied in bulk. */
const INTERESTING = /[\\$`<]/g
/** A line that would start a new block if it appeared inside a paragraph. */
const BLOCK_START = /^(?:[-+*=#<>~`|_$]|\d{1,9}[.)])/
/** `\[ … \]` in the middle of a sentence counts as maths only when its content looks like TeX. */
const TEX_LIKE = /[\\^_{}=]/
const WHITESPACE = /\s/
const DIGIT = /[0-9]/
const URL_START = /^(?:https?:\/\/|www\.)/i
const AUTOLINK = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>|<[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*>/y
const HTML_TAG =
  /<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>|<\?[\s\S]*?\?>|<![A-Za-z][^>]*>|<!\[CDATA\[[\s\S]*?\]\]>/y
/** The `\n` that starts a blank line (spaces, or only `>` markers, before the next line break or the end). */
const BLANK_LINE = /\n[ \t\r]*(?:>[ \t\r]*)*(?=\n|$)/g

const END_CACHE = new Map<string, RegExp>()

/** Where each line starts and what its container prefix looks like. */
interface LineInfo {
  start: number
  /** End of the line, before `\r\n` / `\n`. */
  end: number
  /** Number of `>` blockquote markers in front. */
  quote: number
  /** Column width of the indentation after the blockquote markers. */
  indent: number
  /** Offset of the first non-blank character after the blockquote markers and indentation. */
  bodyStart: number
  blank: boolean
}

function splitLines(src: string): LineInfo[] {
  const lines: LineInfo[] = []
  let start = 0
  while (start <= src.length) {
    let next = src.indexOf('\n', start)
    if (next === -1) next = src.length
    let end = next
    if (end > start && src.charCodeAt(end - 1) === 13) end--
    let p = start
    let quote = 0
    for (;;) {
      let q = p
      let spaces = 0
      while (q < end && spaces < 4 && (src[q] === ' ' || src[q] === '\t')) {
        q++
        spaces++
      }
      if (q < end && src[q] === '>') {
        quote++
        p = q + 1
        if (src[p] === ' ' || src[p] === '\t') p++
        continue
      }
      break
    }
    let indent = 0
    let q = p
    while (q < end && (src[q] === ' ' || src[q] === '\t')) {
      indent += src[q] === '\t' ? 4 - (indent % 4) : 1
      q++
    }
    lines.push({ start, end, quote, indent, bodyStart: q, blank: q >= end })
    if (next >= src.length) break
    start = next + 1
  }
  return lines
}

const LIST_MARKER = /^(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/
const FENCE = /^(`{3,}|~{3,})(.*)$/
const MATH_FENCE = /^(\${2,})(.*)$/
const HTML_TYPE_1 = /^<(?:pre|script|style|textarea)(?:[\s>]|$)/i
const HTML_TYPE_1_END = /<\/(?:pre|script|style|textarea)>/gi
const HTML_COMMENT_END = /-->/g
const HTML_PI_END = /\?>/g
const HTML_CDATA_END = /\]\]>/g
const HTML_DECLARATION_END = />/g
const HTML_TYPE_6 =
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[\s>]|\/>|$)/i
const HTML_TYPE_7 =
  /^(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)\s*$/

/**
 * Block-level ranges the math rewrite must not touch: fenced code (also inside `>` and lists), `$$` blocks with a
 * closing fence, indented code at the top level, and raw HTML blocks (`<pre>`/`<script>`/`<style>`/`<textarea>`,
 * comments, and the block tags that run to the next blank line). Ranges are sorted and do not overlap.
 *
 * A line scanner, not a parser: where it is unsure it errs towards skipping (the text then renders as it did before).
 */
export function findSkipRanges(src: string): Range[] {
  const lines = splitLines(src)
  const ranges: Range[] = []
  let previousBlank = true
  let listContext = false
  const body = (line: LineInfo) => src.slice(line.bodyStart, line.end)

  /**
   * Whether `line` closes a block (opened at `column`, `quote` levels deep, maybe in a list item) without a closing
   * fence: fewer `>` markers end the blockquote, a non-blank line left of the item's content ends the list item.
   */
  const endsImplicitly = (line: LineInfo, quote: number, inList: boolean, column: number) =>
    (quote > 0 && line.quote < quote) || (inList && !line.blank && line.quote === quote && line.indent < column)

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (line.blank) {
      previousBlank = true
      continue
    }
    let text = body(line)

    // Indented code: top level only, never right after a paragraph line, never inside a list.
    if (line.quote === 0 && line.indent >= 4 && previousBlank && !listContext) {
      let last = n
      for (let m = n + 1; m < lines.length; m++) {
        if (lines[m].blank) continue
        if (lines[m].quote === 0 && lines[m].indent >= 4) last = m
        else break
      }
      ranges.push([line.start, lines[last].end])
      n = last
      previousBlank = false
      continue
    }

    // A list marker may sit in front of a fence on the same line ("- ```js").
    let hadMarker = false
    let markerWidth = 0
    for (;;) {
      const marker = LIST_MARKER.exec(text)
      if (!marker) break
      hadMarker = true
      markerWidth += marker[0].length
      text = text.slice(marker[0].length)
    }
    const column = line.indent + markerWidth
    const inList = hadMarker || (listContext && line.indent >= 2)
    const fenceIndentOk = inList || line.quote > 0 || line.indent <= 3

    const fence = fenceIndentOk ? FENCE.exec(text) : null
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
      const ch = fence[1][0]
      const len = fence[1].length
      let endLine = lines.length - 1
      let endOffset = src.length
      for (let m = n + 1; m < lines.length; m++) {
        const l = lines[m]
        if (endsImplicitly(l, line.quote, inList, column)) {
          endLine = m - 1
          endOffset = lines[m - 1].end
          break
        }
        const t = body(l)
        let run = 0
        while (run < t.length && t[run] === ch) run++
        if (l.quote >= line.quote && run >= len && !t.slice(run).trim()) {
          endLine = m
          endOffset = l.end
          break
        }
      }
      ranges.push([line.start, endOffset])
      n = endLine
      previousBlank = false
      continue
    }

    const math = fenceIndentOk ? MATH_FENCE.exec(text) : null
    if (math && !math[2].includes('$')) {
      const len = math[1].length
      let close = -1
      let implicit = -1
      for (let m = n + 1; m < lines.length; m++) {
        const l = lines[m]
        if (endsImplicitly(l, line.quote, inList, column)) {
          implicit = m
          break
        }
        const t = body(l)
        let run = 0
        while (run < t.length && t[run] === '$') run++
        if (run >= len && !t.slice(run).trim()) {
          close = m
          break
        }
      }
      const bare = !math[2].trim()
      if (bare && (close !== -1 || implicit !== -1)) {
        // A real `$$` block: micromark keeps its content raw, so must we.
        const last = close !== -1 ? close : implicit - 1
        ranges.push([line.start, lines[last].end])
        n = last
        previousBlank = false
        continue
      }
      if (!bare && close !== -1) {
        // "$$ formula" + closing fence: normalizeMath rewrites it, but the closing line must not open a new block here.
        n = close
        previousBlank = false
        continue
      }
      // A bare `$$` that never closes is left to normalizeMath, which looks for a `$$` closing a later line.
    }

    if (line.indent <= 3) {
      const raw = body(line)
      let end = -1
      if (HTML_TYPE_1.test(raw) || raw.startsWith('<!--') || raw.startsWith('<?') || /^<![A-Za-z]/.test(raw) || raw.startsWith('<![CDATA[')) {
        const closer = HTML_TYPE_1.test(raw)
          ? HTML_TYPE_1_END
          : raw.startsWith('<!--')
            ? HTML_COMMENT_END
            : raw.startsWith('<?')
              ? HTML_PI_END
              : raw.startsWith('<![CDATA[')
                ? HTML_CDATA_END
                : HTML_DECLARATION_END
        closer.lastIndex = line.bodyStart + (raw.startsWith('<!--') ? 4 : raw.startsWith('<![CDATA[') ? 9 : 2)
        const found = closer.exec(src)
        const stop = found ? found.index : src.length
        let m = n
        while (m + 1 < lines.length && lines[m].end < stop) m++
        end = m
      } else if (HTML_TYPE_6.test(raw) || (previousBlank && HTML_TYPE_7.test(raw))) {
        let m = n
        while (m + 1 < lines.length && !lines[m + 1].blank) m++
        end = m
      }
      if (end !== -1) {
        ranges.push([line.start, lines[end].end])
        n = end
        previousBlank = false
        continue
      }
    }

    if (line.quote === 0) {
      if (hadMarker && line.indent < 4) listContext = true
      else if (line.indent === 0 && previousBlank) listContext = false
    }
    previousBlank = false
  }
  return ranges
}

function maxDollarRun(text: string): number {
  let best = 0
  let run = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 36) {
      run++
      if (run > best) best = run
    } else run = 0
  }
  return best
}

function isBlank(src: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const c = src[i]
    if (c !== ' ' && c !== '\t' && c !== '\r') return false
  }
  return true
}

function lineStart(src: string, i: number): number {
  return src.lastIndexOf('\n', i - 1) + 1
}

function lineEnd(src: string, i: number): number {
  const end = src.indexOf('\n', i)
  return end === -1 ? src.length : end
}

/**
 * -1 if `src[from, to)` holds anything other than blockquote markers, list markers and white space -- that is, if a
 * delimiter at `to` is not at the start of its line. Otherwise the number of `>` markers.
 */
function prefixDepth(src: string, from: number, to: number): number {
  let depth = 0
  let i = from
  while (i < to) {
    const c = src[i]
    if (c === ' ' || c === '\t') {
      i++
    } else if (c === '>') {
      depth++
      i++
    } else if (c === '-' || c === '+' || c === '*') {
      if (i + 1 < to && (src[i + 1] === ' ' || src[i + 1] === '\t')) i += 2
      else return -1
    } else if (c >= '0' && c <= '9') {
      let j = i
      while (j < to && j - i < 9 && src[j] >= '0' && src[j] <= '9') j++
      if (j < to && (src[j] === '.' || src[j] === ')') && j + 1 < to && (src[j + 1] === ' ' || src[j + 1] === '\t')) i = j + 2
      else return -1
    } else {
      return -1
    }
  }
  return depth
}

/** Number of `>` blockquote markers opening the line that starts at `from`. */
function quoteDepth(src: string, from: number): number {
  let depth = 0
  let i = from
  for (;;) {
    while (src[i] === ' ' || src[i] === '\t') i++
    if (src[i] !== '>') return depth
    depth++
    i++
  }
}

/**
 * Lines 2… of multi-line maths that Markdown would read as the start of a new block get `\relax ` in front. When the
 * closing run would itself start a line and is two dollars or more (a `$$` fence there would cut the paragraph),
 * `\relax ` goes in front of it too.
 */
function protectLines(content: string, depth: number, closerRun: number): string {
  if (!content.includes('\n')) return content
  const lines = content.split('\n')
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k]
    let p = 0
    let quotes = 0
    while (p < line.length) {
      const c = line[p]
      if (c === ' ' || c === '\t' || c === '\r') p++
      else if (c === '>' && quotes < depth) {
        quotes++
        p++
      } else break
    }
    const rest = line.slice(p)
    if (BLOCK_START.test(rest)) lines[k] = line.slice(0, p) + '\\relax ' + rest
    else if (k === lines.length - 1 && closerRun >= 2 && !rest) lines[k] = line + '\\relax '
  }
  return lines.join('\n')
}

/**
 * Rewrites LLM-style maths delimiters into `$` syntax (see the module comment). Keeps the line count; `skip` defaults
 * to `findSkipRanges(src)`.
 */
export function normalizeMath(src: string, skip?: Range[]): PreparedMath {
  const display = new Set<number>()
  const generated = new Set<number>()
  if (!src.includes('$') && !src.includes('\\')) return { text: src, display, generated }

  const ranges = skip ?? findSkipRanges(src)
  const length = src.length
  const out: string[] = []
  let outLength = 0
  const emit = (text: string) => {
    if (text) {
      out.push(text)
      outLength += text.length
    }
  }

  // End of the paragraph holding `pos`: the next blank line. Queries move forward, so one cached answer usually fits.
  let paraFrom = -1
  let paraTo = -1
  const paragraphEnd = (pos: number): number => {
    if (pos >= paraFrom && pos <= paraTo) return paraTo
    BLANK_LINE.lastIndex = pos
    const found = BLANK_LINE.exec(src)
    paraFrom = pos
    paraTo = found ? found.index : length
    return paraTo
  }

  let i = 0
  let si = 0
  while (i < length) {
    while (si < ranges.length && ranges[si][1] <= i) si++
    const skipStart = si < ranges.length ? ranges[si][0] : length
    if (skipStart <= i) {
      emit(src.slice(i, ranges[si][1]))
      i = ranges[si][1]
      si++
      continue
    }
    INTERESTING.lastIndex = i
    const found = INTERESTING.exec(src)
    const next = found ? found.index : length
    if (next >= skipStart) {
      emit(src.slice(i, skipStart))
      i = skipStart
      continue
    }
    emit(src.slice(i, next))
    i = next
    const limit = Math.min(paragraphEnd(i), skipStart)
    const c = src[i]

    if (c === '\\') {
      let run = 1
      while (src[i + run] === '\\') run++
      const k = i + run - 1
      const after = src[k + 1]
      if (run % 2 === 1 && (after === '(' || after === '[')) {
        const done = bracket(i, k, after, Math.min(paragraphEnd(k + 2), skipStart))
        if (done !== -1) {
          i = done
          continue
        }
      }
      if (run === 1 && after === 'b') {
        const done = environment(i, limit)
        if (done !== -1) {
          i = done
          continue
        }
      }
      // An odd run escapes the next character (`\$` stays a dollar sign): copy both.
      const take = run % 2 === 1 && k + 1 < length ? run + 1 : run
      emit(src.slice(i, i + take))
      i += take
      continue
    }

    if (c === '`') {
      let run = 1
      while (src[i + run] === '`') run++
      const close = findRun(i + run, '`', run, limit)
      const end = close === -1 ? i + run : close + run
      emit(src.slice(i, end))
      i = end
      continue
    }

    if (c === '<') {
      let end = -1
      if (src.startsWith('<!--', i)) {
        const close = src.indexOf('-->', i + 4)
        if (close !== -1 && close + 3 <= limit) end = close + 3
      } else {
        AUTOLINK.lastIndex = i
        HTML_TAG.lastIndex = i
        const m = AUTOLINK.exec(src) ?? HTML_TAG.exec(src)
        if (m && i + m[0].length <= limit) end = i + m[0].length
      }
      if (end === -1) end = i + 1
      emit(src.slice(i, end))
      i = end
      continue
    }

    // c === '$'
    i = dollar(i, limit)
  }

  return { text: out.join(''), display, generated }

  /**
   * `\(` / `\[` written as a backslash run from `first` to `k` (an odd run: the earlier pairs are escaped backslashes).
   * Returns the offset after the closer, or -1 to leave it alone.
   */
  function bracket(first: number, k: number, open: string, limit: number): number {
    const closeChar = open === '(' ? ')' : ']'
    const closer = findCloser(k + 2, closeChar, limit)
    if (closer === -1) return -1
    const content = src.slice(k + 2, closer)
    if (!content.trim()) return -1
    const lineFrom = lineStart(src, k)
    const atLineStart = prefixDepth(src, lineFrom, k) !== -1
    const depth = quoteDepth(src, lineFrom)
    const afterCloser = isBlank(src, closer + 2, lineEnd(src, closer + 2))
    if (open === '[') {
      const flow =
        atLineStart &&
        content.includes('\n') &&
        isBlank(src, k + 2, lineEnd(src, k + 2)) &&
        prefixDepth(src, lineStart(src, closer), closer) !== -1 &&
        afterCloser
      if (flow) {
        // `\[` and `\]` on lines of their own: a real `$$` block, whose content Markdown leaves alone.
        const fence = '$'.repeat(Math.max(2, maxDollarRun(content) + 1))
        emit(src.slice(first, k))
        emit(fence + content + fence)
        return closer + 2
      }
      if (!(atLineStart && afterCloser) && !TEX_LIKE.test(content)) return -1
    }
    const n = maxDollarRun(content) + 1
    if (n >= 2 && atLineStart && content.includes('\n')) {
      // `$$` at the start of a line would open a block fence; keep the author's text rather than break it.
      emit(src.slice(first, closer + 2))
      return closer + 2
    }
    emit(src.slice(first, k))
    generated.add(outLength)
    if (open === '[') display.add(outLength)
    const fence = '$'.repeat(n)
    emit(fence + protectLines(content, depth, n) + fence)
    return closer + 2
  }

  /** The backslash of the first unescaped `\)` / `\]` in `[from, limit)`, or -1. */
  function findCloser(from: number, closeChar: string, limit: number): number {
    const needle = '\\' + closeChar
    let p = from
    for (;;) {
      const q = src.indexOf(needle, p)
      if (q === -1 || q >= limit) return -1
      let b = q
      while (b > from && src[b - 1] === '\\') b--
      if ((q - b + 1) % 2 === 1) return q
      p = q + 2
    }
  }

  /** A bare `\begin{ENV}` at the start of a line, up to its `\end{ENV}`. Returns the offset after it, or -1. */
  function environment(i: number, limit: number): number {
    const lineFrom = lineStart(src, i)
    if (prefixDepth(src, lineFrom, i) === -1) return -1
    const depth = quoteDepth(src, lineFrom)
    BEGIN.lastIndex = i
    const m = BEGIN.exec(src)
    if (!m) return -1
    const name = m[1] + m[2]
    let re = END_CACHE.get(name)
    if (!re) {
      re = new RegExp(String.raw`\\(begin|end)\{` + name.replace('*', '\\*') + String.raw`\}`, 'g')
      END_CACHE.set(name, re)
    }
    re.lastIndex = i + m[0].length
    let level = 1
    let end = -1
    for (let e = re.exec(src); e; e = re.exec(src)) {
      if (e.index + e[0].length > limit) break
      level += e[1] === 'begin' ? 1 : -1
      if (level === 0) {
        end = e.index + e[0].length
        break
      }
    }
    if (end === -1) return -1
    const content = src.slice(i, end)
    const n = maxDollarRun(content) + 1
    if (n >= 2 && content.includes('\n')) {
      emit(content)
      return end
    }
    generated.add(outLength)
    display.add(outLength)
    const fence = '$'.repeat(n)
    emit(fence + protectLines(content, depth, n) + fence)
    return end
  }

  /** Offset of a run of exactly `size` `ch` characters in `[from, limit)`, or -1. */
  function findRun(from: number, ch: string, size: number, limit: number): number {
    let p = from
    while (p < limit) {
      const q = src.indexOf(ch, p)
      if (q === -1 || q >= limit) return -1
      let run = 1
      while (src[q + run] === ch) run++
      if (run === size && q + run <= limit) return q
      p = q + run
    }
    return -1
  }

  /** A `$` run at `i`. Returns the offset to continue from. */
  function dollar(i: number, limit: number): number {
    let run = 1
    while (src[i + run] === '$') run++

    // A dollar inside a bare URL is part of the address.
    let tokenStart = i
    while (tokenStart > 0 && !WHITESPACE.test(src[tokenStart - 1]) && src[tokenStart - 1] !== '(' && src[tokenStart - 1] !== '<') tokenStart--
    if (tokenStart < i && URL_START.test(src.slice(tokenStart, Math.min(i, tokenStart + 8)))) {
      let end = i
      while (end < limit && !WHITESPACE.test(src[end]) && src[end] !== '<') end++
      emit(src.slice(i, end))
      return end
    }

    const lineFrom = lineStart(src, i)
    const depth = quoteDepth(src, lineFrom)

    if (run >= 2) {
      const close = findRun(i + run, '$', run, limit)
      if (close === -1) {
        emit(src.slice(i, i + run))
        return i + run
      }
      const content = src.slice(i + run, close)
      const end = close + run
      const atLineStart = prefixDepth(src, lineFrom, i) !== -1
      if (atLineStart && content.includes('\n') && !src.slice(i + run, lineEnd(src, i + run)).includes('$')) {
        // "$$ x^2 +" … "y^2 $$": the first line would be a fence with an info string. As single-dollar text maths
        // the whole formula survives; remarkMathPromote shows it as a block.
        if (content.includes('$') || !content.trim()) {
          emit(src.slice(i, end))
          return end
        }
        generated.add(outLength)
        display.add(outLength)
        emit('$' + protectLines(content, depth, 1) + '$')
        return end
      }
      emit(src.slice(i, i + run) + protectLines(content, depth, run) + src.slice(close, end))
      return end
    }

    // Single dollar, pandoc's rule.
    const opens = i + 1 < length && !WHITESPACE.test(src[i + 1])
    if (opens) {
      let p = i + 1
      let close = -1
      while (p < limit) {
        const q = src.indexOf('$', p)
        if (q === -1 || q >= limit) break
        let b = q
        while (b > i + 1 && src[b - 1] === '\\') b--
        if ((q - b) % 2 === 1) {
          p = q + 1 // `\$` inside the formula
          continue
        }
        close = q
        break
      }
      if (close !== -1 && !WHITESPACE.test(src[close - 1]) && !DIGIT.test(src[close + 1] ?? '') && src[close + 1] !== '$') {
        const content = src.slice(i + 1, close)
        if (content.includes('$')) {
          // An escaped dollar inside: in text maths micromark does not honour `\$`, so fence with a longer run.
          const n = maxDollarRun(content) + 1
          generated.add(outLength)
          const fence = '$'.repeat(n)
          emit(fence + protectLines(content, depth, n) + fence)
        } else {
          emit('$' + protectLines(content, depth, 1) + '$')
        }
        return close + 1
      }
    }
    emit('\\$')
    return i + 1
  }
}
