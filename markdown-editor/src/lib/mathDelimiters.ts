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
 *    digit (nor another `$`) after it; a dollar that does not pair becomes `\$`.
 * The author's own `$…$` and `$$…$$` pair only within one Markdown paragraph, as micromark pairs them: never across a
 * line that starts a block (`- 5$/month` then `- 10$/month` are two list items, two prices), and never off a heading
 * or a table row. Their text is left as written. Only formulas written here (`\( \)`, `\[ \]`, `\begin`, the `$$ text`
 * trap) may run over such a line: it gets a leading `\relax ` (invisible to KaTeX, unlike `{}` which turns `-` into a
 * binary minus), and so does a closing `$$` that would start its line.
 *
 * Indented code is recognised at the top level only; inside a blockquote or a list item it is maths-rewritten like text.
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
const BLOCK_START_AT = /(?:[-+*=#<>~`|_$]|\d{1,9}[.)])/y
/** `\[ … \]` in the middle of a sentence counts as maths only when its content looks like TeX. */
const TEX_LIKE = /[\\^_{}=]/
const WHITESPACE = /\s/
const DIGIT = /[0-9]/
const URL_START = /^(?:https?:\/\/|www\.)/i
const AUTOLINK = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>|<[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*>/y
/**
 * An inline open or closing tag. Comments, processing instructions (`<?…?>`), declarations (`<!X…>`) and CDATA run to a
 * terminator that may be far away or missing: the scan finds those with `nextIndex`, never with a regex rerun at
 * every `<` (an unclosed `<?` per line used to rescan the rest of the document each time).
 */
const HTML_TAG =
  /<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>/y
const ASCII_LETTER = /[A-Za-z]/
/** The first character `String.prototype.trim` would keep (`\s` is the same set: WhiteSpace and LineTerminator). */
const NON_SPACE = /\S/g
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
      // A `>` marker may follow at most three columns of white space (a tab counts up to the next multiple of four):
      // "    >>> x" is indented code, as in a Python session pasted after a blank line.
      let q = p
      let column = 0
      while (q < end && (src[q] === ' ' || src[q] === '\t')) {
        column += src[q] === '\t' ? 4 - (column % 4) : 1
        q++
      }
      if (column <= 3 && q < end && src[q] === '>') {
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
/** First characters of a line that can open a list item, a fence, a `$$` block or an HTML block. */
const BLOCK_SIGNAL = /^[-+*0-9`~$<]/
const LIST_SIGNAL = /^[-+*0-9]/
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
 * A line after which no paragraph is open (indented code may follow it): an ATX heading, a thematic break, a setext
 * underline. Matched at the start of the line's text; `===` that is itself paragraph text also counts, on the safe side.
 */
const NOT_PARAGRAPH = /#{1,6}(?:[ \t\r]|$)|(?:\*[ \t]*){3,}\r?$|(?:-[ \t]*){3,}\r?$|(?:_[ \t]*){3,}\r?$|=+[ \t\r]*$|-+[ \t\r]*$/my

/**
 * Block-level ranges the math rewrite must not touch: fenced code (also inside `>` and lists), `$$` blocks with a
 * closing fence, indented code (at the top level and in blockquotes, not in list items), and raw HTML blocks
 * (`<pre>`/`<script>`/`<style>`/`<textarea>`, comments, and the block tags that run to the next blank line), also as
 * the content of a list item. Ranges are sorted and do not overlap.
 *
 * A line scanner, not a parser: where it is unsure it errs towards skipping (the text then renders as it did before).
 */
export function findSkipRanges(src: string): Range[] {
  const lines = splitLines(src)
  const ranges: Range[] = []
  let previousBlank = true
  /** The line before is paragraph text, which indented code cannot interrupt (a heading, a fence, HTML… are not). */
  let paragraphOpen = false
  let listContext = false
  /** A list marker was seen in the blockquote the line is in: an indented line there may be list content. */
  let quoteList = false
  const body = (line: LineInfo) => src.slice(line.bodyStart, line.end)
  /** Whether a paragraph is open after the non-blank `line`, whose text (past any list marker) starts at `from`. */
  const opensParagraph = (from: number) => {
    NOT_PARAGRAPH.lastIndex = from
    return !NOT_PARAGRAPH.test(src)
  }

  /**
   * Whether `line` closes a block (opened at `column`, `quote` levels deep, maybe in a list item) without a closing
   * fence: fewer `>` markers end the blockquote, a non-blank line left of the item's content ends the list item.
   */
  const endsImplicitly = (line: LineInfo, quote: number, inList: boolean, column: number) =>
    (quote > 0 && line.quote < quote) || (inList && !line.blank && line.quote === quote && line.indent < column)

  /** Length of the `$` run a line consists of (nothing but white space after it), or 0. */
  const dollarFence = (line: LineInfo): number => {
    const t = body(line)
    let run = 0
    while (run < t.length && t[run] === '$') run++
    return run > 0 && !t.slice(run).trim() ? run : 0
  }
  /**
   * After a `$$` opener on line `from - 1`: the first line from `from` on that closes it (`close`) or ends its container
   * (`implicit`), -1 for none. Remembered per opener shape: a document of unclosed `$$ text` lines would otherwise be
   * scanned to its end once per line. Valid for any later `from` up to the line it found, as no line before that matches.
   */
  const fenceSearches = new Map<string, { from: number; close: number; implicit: number }>()
  const findMathFenceEnd = (from: number, len: number, quote: number, inList: boolean, column: number) => {
    const key = `${len}|${quote}|${inList ? column : -1}`
    const known = fenceSearches.get(key)
    if (known && known.from <= from) {
      const found = known.close !== -1 ? known.close : known.implicit
      if (found === -1 || found >= from) return known
    }
    const result = { from, close: -1, implicit: -1 }
    for (let m = from; m < lines.length; m++) {
      const l = lines[m]
      if (endsImplicitly(l, quote, inList, column)) {
        result.implicit = m
        break
      }
      if (dollarFence(l) >= len) {
        result.close = m
        break
      }
    }
    fenceSearches.set(key, result)
    return result
  }

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (line.blank) {
      previousBlank = true
      paragraphOpen = false
      continue
    }
    if (line.quote === 0) quoteList = false

    // Indented code: never right after a paragraph line (unless this line opens a deeper blockquote, whose first line
    // it then is), never inside a list item (at the top level, or in the blockquote).
    const previousQuote = n > 0 ? lines[n - 1].quote : 0
    const codeAllowed =
      line.quote === 0 ? !listContext && !paragraphOpen : !quoteList && (!paragraphOpen || previousQuote < line.quote)
    if (line.indent >= 4 && codeAllowed) {
      let last = n
      for (let m = n + 1; m < lines.length; m++) {
        if (lines[m].blank) continue
        if (lines[m].quote === line.quote && lines[m].indent >= 4) last = m
        else break
      }
      ranges.push([line.start, lines[last].end])
      n = last
      previousBlank = false
      paragraphOpen = false
      continue
    }

    // Every construct below starts with one of these characters (list marker, fence, `$$`, HTML); most lines are text.
    if (!BLOCK_SIGNAL.test(src[line.bodyStart])) {
      if (line.quote === 0 && line.indent === 0 && previousBlank) listContext = false
      paragraphOpen = opensParagraph(line.bodyStart)
      previousBlank = false
      continue
    }

    // A list marker may sit in front of a fence on the same line ("- ```js").
    let text = body(line)
    let hadMarker = false
    let markerWidth = 0
    for (;;) {
      const marker = LIST_SIGNAL.test(text) ? LIST_MARKER.exec(text) : null
      if (!marker) break
      hadMarker = true
      markerWidth += marker[0].length
      text = text.slice(marker[0].length)
    }
    if (hadMarker && line.quote > 0) quoteList = true
    const column = line.indent + markerWidth
    const inList = hadMarker || (listContext && line.indent >= 2)
    const fenceIndentOk = inList || line.quote > 0 || line.indent <= 3

    const fence = fenceIndentOk && (text[0] === '`' || text[0] === '~') ? FENCE.exec(text) : null
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
      paragraphOpen = false
      continue
    }

    const math = fenceIndentOk && text[0] === '$' ? MATH_FENCE.exec(text) : null
    if (math && !math[2].includes('$')) {
      const { close, implicit } = findMathFenceEnd(n + 1, math[1].length, line.quote, inList, column)
      const bare = !math[2].trim()
      if (bare && (close !== -1 || implicit !== -1)) {
        // A real `$$` block: micromark keeps its content raw, so must we.
        const last = close !== -1 ? close : implicit - 1
        ranges.push([line.start, lines[last].end])
        n = last
        previousBlank = false
        paragraphOpen = false
        continue
      }
      if (!bare && close !== -1) {
        // "$$ formula" + closing fence: normalizeMath rewrites it into a paragraph, whose closing line must not open a
        // new block here.
        n = close
        previousBlank = false
        paragraphOpen = true
        continue
      }
      // A bare `$$` that never closes is left to normalizeMath, which looks for a `$$` closing a later line.
    }

    // Raw HTML, also as the content of a list item ("- <details>").
    if ((line.indent <= 3 || inList) && text[0] === '<') {
      const raw = text
      const rawStart = line.bodyStart + markerWidth
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
        closer.lastIndex = rawStart + (raw.startsWith('<!--') ? 4 : raw.startsWith('<![CDATA[') ? 9 : 2)
        const found = closer.exec(src)
        const stop = found ? found.index : src.length
        let m = n
        while (m + 1 < lines.length && lines[m].end < stop) m++
        end = m
      } else if (HTML_TYPE_6.test(raw) || ((!paragraphOpen || hadMarker) && HTML_TYPE_7.test(raw))) {
        // Up to a blank line, or the end of the blockquote or list item holding it (HTML has no lazy lines).
        let m = n
        while (m + 1 < lines.length && !lines[m + 1].blank && !endsImplicitly(lines[m + 1], line.quote, inList, column)) m++
        end = m
      }
      if (end !== -1) {
        ranges.push([line.start, lines[end].end])
        n = end
        previousBlank = false
        paragraphOpen = false
        continue
      }
    }

    if (line.quote === 0) {
      if (hadMarker && line.indent < 4) listContext = true
      else if (line.indent === 0 && previousBlank) listContext = false
    }
    paragraphOpen = opensParagraph(line.bodyStart + markerWidth)
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

/**
 * Where the block prefix of the line `[from, to)` ends: the first offset `prefixDepth` would not read as blockquote
 * marker, list marker or white space. A delimiter (`$`, `\`) is never part of a prefix, so `prefixDepth(src, from, d)`
 * can only succeed for a delimiter at `d <= prefixEnd(…)`, that is at exactly this offset.
 */
function prefixEnd(src: string, from: number, to: number): number {
  let i = from
  while (i < to) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '>') {
      i++
    } else if (c === '-' || c === '+' || c === '*') {
      if (i + 1 < to && (src[i + 1] === ' ' || src[i + 1] === '\t')) i += 2
      else return i
    } else if (c >= '0' && c <= '9') {
      let j = i
      while (j < to && j - i < 9 && src[j] >= '0' && src[j] <= '9') j++
      if (j < to && (src[j] === '.' || src[j] === ')') && j + 1 < to && (src[j + 1] === ' ' || src[j + 1] === '\t')) i = j + 2
      else return i
    } else {
      return i
    }
  }
  return i
}

/**
 * The `>` blockquote markers opening the line that starts at `from` (each after at most three columns of white space,
 * as in `splitLines`): their number, and the offset of the first character after them and the white space that follows.
 */
function quotePrefix(src: string, from: number): [depth: number, body: number] {
  let depth = 0
  let i = from
  for (;;) {
    let column = 0
    while (src[i] === ' ' || src[i] === '\t') {
      column += src[i] === '\t' ? 4 - (column % 4) : 1
      i++
    }
    if (column > 3 || src[i] !== '>') return [depth, i]
    depth++
    i++
  }
}

/** Number of `>` blockquote markers opening the line that starts at `from`. */
function quoteDepth(src: string, from: number): number {
  return quotePrefix(src, from)[0]
}

/**
 * What can start a block at the start of a line's text, ending a paragraph that runs into it (CommonMark §4–5, GFM,
 * micromark math): an ATX heading, a list item, a code fence, a `$$` fence, a setext underline or thematic break, or a
 * `>` the quote prefix did not take (four columns in: not a marker, but read as one to stay on the safe side).
 * Indentation is not considered, also on the safe side: a line that only might start a block counts as one.
 */
const BLOCK_OPENER = /#{1,6}(?:[ \t\r]|$)|[-+*](?:[ \t\r]|$)|\d{1,9}[.)](?:[ \t\r]|$)|`{3,}|~{3,}|\${2,}|>|=+[ \t\r]*$|(?:[-*_][ \t\r]*){3,}$/my
/** An ATX heading at the start of a line's text: its inline content is that one line. */
const HEADING_AT = /#{1,6}(?:[ \t\r]|$)/my
/** A GFM table delimiter row: only `|`, `-`, `:` and white space (after `>` markers), with at least one `|` and `-`. */
const TABLE_DELIMITER_ROW = /^(?=[^\n]*\|)(?=[^\n]*-)(?:[ \t]*>)*[|:\- \t]+\r?$/m
/** The start of an HTML block that may interrupt a paragraph (CommonMark types 1–6). */
const HTML_INTERRUPT = /^(?:<!--|<\?|<![A-Za-z]|<!\[CDATA\[)/

/**
 * Lines 2… of multi-line maths written here (never the author's `$…$`, see `pairsAcross`) that Markdown would read as
 * the start of a new block get `\relax ` in front. When the closing run would itself start a line and is two dollars
 * or more (a `$$` fence there would cut the paragraph), `\relax ` goes in front of it too.
 */
function protectLines(content: string, depth: number, closerRun: number): string {
  let newline = content.indexOf('\n')
  if (newline === -1) return content
  // Insert by offset; most formulas need nothing, and then nothing is copied.
  const parts: string[] = []
  let copied = 0
  while (newline !== -1) {
    const next = content.indexOf('\n', newline + 1)
    const end = next === -1 ? content.length : next
    let p = newline + 1
    let quotes = 0
    while (p < end) {
      const c = content[p]
      if (c === ' ' || c === '\t' || c === '\r') p++
      else if (c === '>' && quotes < depth) {
        quotes++
        p++
      } else break
    }
    BLOCK_START_AT.lastIndex = p
    const at = p < end && BLOCK_START_AT.test(content) ? p : next === -1 && closerRun >= 2 && p >= end ? end : -1
    if (at !== -1) {
      parts.push(content.slice(copied, at), '\\relax ')
      copied = at
    }
    newline = next
  }
  if (!parts.length) return content
  parts.push(content.slice(copied))
  return parts.join('')
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
  // The output is the source with some ranges replaced. Text left alone is copied in one slice per replacement rather
  // than one per construct: `copied` is where the source not yet copied starts, `written` the output length before it.
  const out: string[] = []
  let copied = 0
  let written = 0
  /** Output offset of source offset `pos` (at or after every range replaced so far). */
  const offsetOf = (pos: number) => written + (pos - copied)
  /** Source `[from, to)` becomes `text`. */
  const replace = (from: number, to: number, text: string) => {
    if (from > copied) out.push(src.slice(copied, from))
    out.push(text)
    written += from - copied + text.length
    copied = to
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

  // Everything below answers questions about positions that only move forward, from caches, so that no question
  // rescans text an earlier one already covered: a 200 KB line full of `$5` prices or unclosed `\(` stays linear.

  // The line holding a position: start, end (the `\n`), `>` depth, where its block prefix (white space, `>` and list
  // markers) ends. Computed once per line.
  let lineFrom = -1
  let lineTo = -1
  let lineQuotes = -1
  let linePrefixEnd = -1
  const enterLine = (pos: number) => {
    if (lineFrom !== -1 && pos >= lineFrom && pos <= lineTo) return
    lineFrom = pos === 0 ? 0 : src.lastIndexOf('\n', pos - 1) + 1
    lineTo = lineEnd(src, pos)
    lineQuotes = -1
    linePrefixEnd = -1
  }
  const quotesOfLine = (pos: number) => {
    enterLine(pos)
    if (lineQuotes === -1) lineQuotes = quoteDepth(src, lineFrom)
    return lineQuotes
  }
  /** Whether only blockquote markers, list markers and white space come before `pos` on its line. */
  const atLineStart = (pos: number) => {
    enterLine(pos)
    if (linePrefixEnd === -1) linePrefixEnd = prefixEnd(src, lineFrom, lineTo)
    // Past the prefix there is something else; at or before it, the exact check (it runs about once per line).
    return pos <= linePrefixEnd && prefixDepth(src, lineFrom, pos) !== -1
  }
  /** Whether only white space follows `pos` on its line. */
  const restBlank = (pos: number) => {
    let p = pos
    while (p < length && (src[p] === ' ' || src[p] === '\t' || src[p] === '\r')) p++
    return p >= length || src[p] === '\n'
  }
  /** Whether a `$` comes after `from` on the line holding `pos` (the caller knows one comes before the paragraph ends). */
  const dollarLaterOnLine = (pos: number, from: number) => {
    enterLine(pos)
    const next = src.indexOf('$', from)
    return next !== -1 && next < lineTo
  }
  /** Whether the text has a table delimiter row (`|---|---|`) anywhere; -1 until asked. */
  let tables = -1
  /**
   * A search for the first `|` at or after a position that answers from its last result while queries move forward.
   * The opener lines and the lines after them (`pairsAcross`) each have their own: one shared search would be sent
   * back and forth between them, and rescan to the next `|` each time.
   */
  const pipeSearch = () => {
    let from = -1
    let found = -1
    return (at: number) => {
      if (from === -1 || at < from || (found !== -1 && found < at)) {
        from = at
        found = src.indexOf('|', at)
      }
      return found
    }
  }
  const openerPipes = pipeSearch()
  const rowPipes = pipeSearch()
  /** Whether `[from, to)` may be a table row: it holds a `|`, and the text has tables at all. */
  const pipeIn = (from: number, to: number, search: (at: number) => number) => {
    if (tables === -1) tables = TABLE_DELIMITER_ROW.test(src) ? 1 : 0
    if (!tables) return false
    const found = search(from)
    return found !== -1 && found < to
  }
  /** Whether an HTML block that may interrupt a paragraph starts at `body` (its line ends at `end`). */
  const htmlInterrupts = (body: number, end: number) => {
    // The longest tag name of types 1 and 6 is ten letters: sixteen characters decide.
    const head = src.slice(body, Math.min(end, body + 16))
    return HTML_INTERRUPT.test(head) || HTML_TYPE_1.test(head) || HTML_TYPE_6.test(head)
  }

  // Rows: the lines after the opener of an author's formula that runs over lines, read once each for `pairsAcross`.
  // Every opener used to walk its own lines to its closer, so openers whose closers lie past the same block start
  // (dollar runs of many sizes on one line, closed many lines below after a list marker) walked the same lines again,
  // K openers times L lines. The table only grows forward, or starts over further on (openers move forward), and each
  // question about it is answered from a cursor that also only moves forward.
  const rowStart: number[] = []
  const rowEnd: number[] = []
  /** Where the row's text starts, after its `>` markers and white space. */
  const rowBody: number[] = []
  const rowQuotes: number[] = []
  /** Whether the row's text may start a block (BLOCK_OPENER, an HTML block, a table row), its `>` markers aside. */
  const rowOpens: boolean[] = []
  /** The next row with more `>` markers than this one, -1 while none is known (next greater element). */
  const rowDeeper: number[] = []
  /** Rows whose next deeper row is not known yet; their `>` counts never increase from bottom to top. */
  const waiting: number[] = []
  /** Offset where the next row would start; -1 before the first question. */
  let rowsTo = -1
  // firstOpeningRow's cursor: rows [opensFrom, opensScan) do not open a block; opensAt is the first that does, or -1.
  let opensFrom = 0
  let opensScan = 0
  let opensAt = -1
  // deeperRow's cursor: rows [deeperFrom, deeperAt) have at most deeperDepth `>` markers.
  let deeperFrom = -1
  let deeperDepth = -1
  let deeperAt = 0
  const rebaseRows = (start: number) => {
    rowStart.length = rowEnd.length = rowBody.length = rowQuotes.length = rowOpens.length = rowDeeper.length = 0
    waiting.length = 0
    rowsTo = start
    opensFrom = opensScan = 0
    opensAt = -1
    deeperFrom = -1
  }
  /** Reads the line at `rowsTo` into a new row; false past the end of the text. */
  const addRow = (): boolean => {
    if (rowsTo > length) return false
    const start = rowsTo
    const end = lineEnd(src, start)
    const [quotes, body] = quotePrefix(src, start)
    BLOCK_OPENER.lastIndex = body
    const opens = BLOCK_OPENER.test(src) || (src[body] === '<' && htmlInterrupts(body, end)) || pipeIn(start, end, rowPipes)
    const row = rowStart.length
    rowStart.push(start)
    rowEnd.push(end)
    rowBody.push(body)
    rowQuotes.push(quotes)
    rowOpens.push(opens)
    rowDeeper.push(-1)
    while (waiting.length && rowQuotes[waiting[waiting.length - 1]] < quotes) rowDeeper[waiting.pop() as number] = row
    waiting.push(row)
    rowsTo = end + 1
    return true
  }
  /** The last row starting at or before `pos` (the rows reach it). */
  const rowAt = (pos: number) => {
    let lo = 0
    let hi = rowStart.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1
      if (rowStart[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  /**
   * The first row from `s` on that may start a block, looking no further than the row holding `close`; -1 when none
   * does up to there (the rows then reach past `close`, or to the end of the text). An answer found for an earlier `s`
   * still holds for a later one up to it.
   */
  const firstOpeningRow = (s: number, close: number) => {
    if (s < opensFrom || s > opensScan || (opensAt !== -1 && s > opensAt)) {
      opensFrom = opensScan = s
      opensAt = -1
    }
    while (opensAt === -1) {
      if (opensScan === rowStart.length && !addRow()) break
      if (rowStart[opensScan] > close) break
      if (rowOpens[opensScan]) opensAt = opensScan
      else opensScan++
    }
    return opensAt
  }
  /**
   * Whether a row in `[s, e)` has more than `depth` `>` markers (the rows reach `e - 1`). Follows the next-deeper links
   * from `s`: each step adds a marker, so at most `depth + 1` steps for one opener line (whose `depth` markers paid for
   * them), resumed where the last question about the same line stopped.
   */
  const deeperRow = (s: number, e: number, depth: number) => {
    let r = deeperFrom === s && deeperDepth === depth ? deeperAt : s
    while (rowQuotes[r] <= depth && rowDeeper[r] !== -1) r = rowDeeper[r]
    deeperFrom = s
    deeperDepth = depth
    deeperAt = r
    return rowQuotes[r] > depth && r < e
  }

  /**
   * Whether the author's formula opened by the `$` run at `open` may close at `close`, a run of `closerRun` dollars.
   * micromark pairs dollars within one paragraph, but `paragraphEnd` only knows blank lines: a line in between that
   * starts a block (a list item, a heading, a fence, an HTML block, a table row, a deeper blockquote…) ends the
   * paragraph first, and so does the end of the opener's line when that line is a heading or a table row. The two
   * dollars are then in different blocks and pair with nothing.
   *  0: they do not pair;
   *  1: they pair, every line in between continues the paragraph;
   *  2: they pair, but the closing run (two dollars or more) starts its line, where it would open a `$$` fence: the
   *     caller puts `\relax ` in front of it.
   * Linear over a whole document: the lines are read once, as rows (above), however many openers ask about them.
   */
  const pairsAcross =(open: number, close: number, depth: number, closerRun: number): 0 | 1 | 2 => {
    enterLine(open)
    if (close < lineTo) return 1
    if (linePrefixEnd === -1) linePrefixEnd = prefixEnd(src, lineFrom, lineTo)
    HEADING_AT.lastIndex = linePrefixEnd
    if (HEADING_AT.test(src) || pipeIn(lineFrom, lineTo, openerPipes)) return 0
    // The lines after the opener's, up to the closer's (its start decides whether it starts a block), as rows.
    const first = lineTo + 1
    if (rowsTo === -1 || first < rowStart[0] || first >= rowsTo) {
      rebaseRows(first)
      addRow()
    }
    const s = rowAt(first)
    const opener = firstOpeningRow(s, close)
    if (opener !== -1 && rowStart[opener] <= close) {
      // A line in between starts a block, unless it is the closer's own, which starts with the closing run (and is
      // not a deeper blockquote, and neither is a line before it).
      if (close > rowEnd[opener] || closerRun < 2 || rowBody[opener] !== close || rowQuotes[opener] > depth) return 0
      return deeperRow(s, opener, depth) ? 0 : 2
    }
    // No line up to the closer's starts a block (so the closer does not start its line: `$$` there would); one with
    // more `>` markers than the opener's would still start a blockquote.
    return deeperRow(s, rowAt(close) + 1, depth) ? 0 : 1
  }

  // Start of the bare-URL candidate ending at `pos`: back to white space, `(` or `<`.
  let tokenFrom = 0
  let tokenTo = -1
  const tokenStart = (pos: number) => {
    const floor = tokenTo !== -1 && tokenTo <= pos ? tokenTo : 0
    let p = pos
    while (p > floor && !WHITESPACE.test(src[p - 1]) && src[p - 1] !== '(' && src[p - 1] !== '<') p--
    // Reached the previous answer's position without a separator: same token as then.
    const start = p === floor && floor === tokenTo ? tokenFrom : p
    tokenFrom = start
    tokenTo = pos
    return start
  }

  // First occurrence of a needle at or after a position (raw, escapes not considered), remembered per needle.
  const searches = new Map<string, { from: number; found: number }>()
  const nextIndex = (needle: string, from: number) => {
    const known = searches.get(needle)
    if (known && known.from <= from && (known.found === -1 || known.found >= from)) return known.found
    const found = src.indexOf(needle, from)
    searches.set(needle, { from, found })
    return found
  }

  // findCloser's last answer per closing character.
  const closers = new Map<string, { from: number; found: number }>()

  // Runs of `$` and of backticks by length, built on first use: findRun is then a binary search.
  const runIndexes = new Map<string, Map<number, number[]>>()
  const runsOf = (ch: string) => {
    let index = runIndexes.get(ch)
    if (!index) {
      index = new Map()
      for (let p = src.indexOf(ch); p !== -1; ) {
        let run = 1
        while (src[p + run] === ch) run++
        const list = index.get(run)
        if (list) list.push(p)
        else index.set(run, [p])
        p = src.indexOf(ch, p + run)
      }
      runIndexes.set(ch, index)
    }
    return index
  }

  // `\begin{ENV}` → `\end{ENV}` matches found by the last scan for each environment name, valid for the same limit.
  const environmentScans = new Map<string, { limit: number; to: number; ends: Map<number, number> }>()

  // What `\[` asks about its closer (whether it starts its line, whether only white space follows it), remembered for
  // the last closer asked about: every `\[` before a closer shares it, and a later `\[` never has an earlier closer.
  // Indented `\[` lines in front of one closer used to re-read the closer's line once each.
  let closerAt = -1
  let closerStartsLine = -1
  let closerEndsLine = -1
  const closerOpensLine = (closer: number) => {
    if (closer !== closerAt) {
      closerAt = closer
      closerStartsLine = closerEndsLine = -1
    }
    if (closerStartsLine === -1) closerStartsLine = atLineStart(closer) ? 1 : 0
    return closerStartsLine === 1
  }
  const closerClosesLine = (closer: number) => {
    if (closer !== closerAt) {
      closerAt = closer
      closerStartsLine = closerEndsLine = -1
    }
    if (closerEndsLine === -1) closerEndsLine = restBlank(closer + 2) ? 1 : 0
    return closerEndsLine === 1
  }
  /** Whether `[from, to)` is all white space, as `!src.slice(from, to).trim()` but reading only up to the first non-space. */
  const blankBetween = (from: number, to: number) => {
    NON_SPACE.lastIndex = from
    const found = NON_SPACE.exec(src)
    return !found || found.index >= to
  }

  // INTERESTING found nothing in [interestingFrom, interestingAt): a scan that ran on past a skipped range answers
  // again after it. A document of indented code blocks with one `$` at its end used to be rescanned to that `$` once
  // per block.
  let interestingFrom = -1
  let interestingAt = -1

  let i = 0
  let si = 0
  while (i < length) {
    while (si < ranges.length && ranges[si][1] <= i) si++
    const skipStart = si < ranges.length ? ranges[si][0] : length
    if (skipStart <= i) {
      i = ranges[si][1]
      si++
      continue
    }
    if (i < interestingFrom || i > interestingAt) {
      INTERESTING.lastIndex = i
      const found = INTERESTING.exec(src)
      interestingFrom = i
      interestingAt = found ? found.index : length
    }
    const next = interestingAt
    if (next >= skipStart) {
      i = skipStart
      continue
    }
    i = next
    const limit = Math.min(paragraphEnd(i), skipStart)
    const c = src[i]

    if (c === '\\') {
      let run = 1
      while (src[i + run] === '\\') run++
      const k = i + run - 1
      const after = src[k + 1]
      if (run % 2 === 1 && (after === '(' || after === '[')) {
        const done = bracket(k, after, Math.min(paragraphEnd(k + 2), skipStart))
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
      i += take
      continue
    }

    if (c === '`') {
      let run = 1
      while (src[i + run] === '`') run++
      const close = findRun(i + run, '`', run, limit)
      i = close === -1 ? i + run : close + run
      continue
    }

    if (c === '<') {
      let end = -1
      if (src.startsWith('<!--', i)) {
        const close = nextIndex('-->', i + 4)
        if (close !== -1 && close + 3 <= limit) end = close + 3
      } else {
        AUTOLINK.lastIndex = i
        const link = AUTOLINK.exec(src)
        if (link) {
          if (i + link[0].length <= limit) end = i + link[0].length
        } else if (src[i + 1] === '?') {
          // Processing instruction: up to the first `?>` after `<?`.
          const close = nextIndex('?>', i + 2)
          if (close !== -1 && close + 2 <= limit) end = close + 2
        } else if (src.startsWith('<![CDATA[', i)) {
          const close = nextIndex(']]>', i + 9)
          if (close !== -1 && close + 3 <= limit) end = close + 3
        } else if (src[i + 1] === '!' && ASCII_LETTER.test(src[i + 2] ?? '')) {
          // Declaration (`<!DOCTYPE …>`): up to the first `>`.
          const close = nextIndex('>', i + 3)
          if (close !== -1 && close + 1 <= limit) end = close + 1
        } else {
          HTML_TAG.lastIndex = i
          const m = HTML_TAG.exec(src)
          if (m && i + m[0].length <= limit) end = i + m[0].length
        }
      }
      i = end === -1 ? i + 1 : end
      continue
    }

    // c === '$'
    i = dollar(i, limit)
  }

  if (!out.length) return { text: src, display, generated }
  out.push(src.slice(copied))
  return { text: out.join(''), display, generated }

  /**
   * `\(` / `\[` whose backslash is at `k` (the last of an odd run: the earlier pairs are escaped backslashes).
   * Returns the offset after the closer, or -1 to leave it alone.
   */
  function bracket(k: number, open: string, limit: number): number {
    const closeChar = open === '(' ? ')' : ']'
    const closer = findCloser(k + 2, closeChar, limit)
    if (closer === -1) return -1
    // Openers in front of one closer all share it, and each may be left alone (a backtick inside): every question
    // below about the content or the closer reads only text the other openers' questions do not, or is remembered.
    if (blankBetween(k + 2, closer)) return -1
    const content = src.slice(k + 2, closer)
    const opensLine = atLineStart(k)
    const depth = quotesOfLine(k)
    if (open === '[') {
      const flow =
        opensLine && content.includes('\n') && restBlank(k + 2) && closerOpensLine(closer) && closerClosesLine(closer)
      if (flow) {
        // `\[` and `\]` on lines of their own: a real `$$` block, whose content Markdown leaves alone.
        const fence = '$'.repeat(Math.max(2, maxDollarRun(content) + 1))
        replace(k, closer + 2, fence + content + fence)
        return closer + 2
      }
      // TEX_LIKE stops at the next opener's backslash at the latest.
      if (!(opensLine && closerClosesLine(closer)) && !TEX_LIKE.test(content)) return -1
    }
    // A backtick inside (`\( `x` \)`): Markdown reads the backslashes as escapes and the backticks as a code span,
    // which `$…$` would swallow into the formula. Leave the author's text as it was.
    const backtick = nextIndex('`', k + 2)
    if (backtick !== -1 && backtick < closer) return -1
    const n = maxDollarRun(content) + 1
    if (n >= 2 && opensLine && content.includes('\n')) {
      // `$$` at the start of a line would open a block fence; keep the author's text rather than break it.
      return closer + 2
    }
    const at = offsetOf(k)
    generated.add(at)
    if (open === '[') display.add(at)
    const fence = '$'.repeat(n)
    replace(k, closer + 2, fence + protectLines(content, depth, n) + fence)
    return closer + 2
  }

  /**
   * The backslash of the first unescaped `\)` / `\]` in `[from, limit)`, or -1. `src[from - 1]` is the opener's `(`/`[`,
   * so whether a closer is escaped does not depend on `from`: the first unescaped one at or after `from` is remembered
   * and answers every later opener up to it (unclosed `\(` repeated along a line used to rescan the rest each time).
   */
  function findCloser(from: number, closeChar: string, limit: number): number {
    const known = closers.get(closeChar)
    let q: number
    if (known && known.from <= from && (known.found === -1 || known.found >= from)) {
      q = known.found
    } else {
      const needle = '\\' + closeChar
      let p = from
      for (;;) {
        q = src.indexOf(needle, p)
        if (q === -1) break
        let b = q
        while (b > 0 && src[b - 1] === '\\') b--
        if ((q - b + 1) % 2 === 1) break
        p = q + 2
      }
      closers.set(closeChar, { from, found: q })
    }
    return q === -1 || q >= limit ? -1 : q
  }

  /** A bare `\begin{ENV}` at the start of a line, up to its `\end{ENV}`. Returns the offset after it, or -1. */
  function environment(i: number, limit: number): number {
    if (!atLineStart(i)) return -1
    const depth = quotesOfLine(i)
    BEGIN.lastIndex = i
    const m = BEGIN.exec(src)
    if (!m) return -1
    const name = m[1] + m[2]
    const end = environmentEnd(name, i, i + m[0].length, limit)
    if (end === -1) return -1
    const content = src.slice(i, end)
    const n = maxDollarRun(content) + 1
    if (n >= 2 && content.includes('\n')) return end
    const at = offsetOf(i)
    generated.add(at)
    display.add(at)
    const fence = '$'.repeat(n)
    replace(i, end, fence + protectLines(content, depth, n) + fence)
    return end
  }

  /**
   * Offset after the `\end{name}` matching the `\begin{name}` at `begin` (its tag ends at `after`), within `limit`, or
   * -1. One scan pairs every `\begin{name}` it passes, with a stack, and is kept for later queries with the same limit:
   * a paragraph of unmatched `\begin{align}` lines used to be rescanned to its end once per line.
   */
  function environmentEnd(name: string, begin: number, after: number, limit: number): number {
    const known = environmentScans.get(name)
    if (known && known.limit === limit && begin < known.to) {
      const end = known.ends.get(begin)
      if (end !== undefined) return end
    }
    let re = END_CACHE.get(name)
    if (!re) {
      re = new RegExp(String.raw`\\(begin|end)\{` + name.replace('*', '\\*') + String.raw`\}`, 'g')
      END_CACHE.set(name, re)
    }
    const ends = new Map<number, number>()
    const open = [begin]
    let to = limit
    re.lastIndex = after
    for (let e = re.exec(src); e; e = re.exec(src)) {
      const tagEnd = e.index + e[0].length
      if (tagEnd > limit) break
      if (e[1] === 'begin') {
        open.push(e.index)
        continue
      }
      ends.set(open.pop() as number, tagEnd)
      if (!open.length) {
        to = tagEnd
        break
      }
    }
    for (const unmatched of open) ends.set(unmatched, -1)
    environmentScans.set(name, { limit, to, ends })
    return ends.get(begin) as number
  }

  /**
   * Offset of a run of exactly `size` `ch` characters in `[from, limit)`, or -1. `from` always follows a whole run, so
   * the runs from there on are whole runs too: the first one of that length, from the index.
   */
  function findRun(from: number, ch: string, size: number, limit: number): number {
    const starts = runsOf(ch).get(size)
    if (!starts) return -1
    let lo = 0
    let hi = starts.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (starts[mid] < from) lo = mid + 1
      else hi = mid
    }
    if (lo === starts.length) return -1
    const q = starts[lo]
    return q + size <= limit ? q : -1
  }

  /** A `$` run at `i`. Returns the offset to continue from. */
  function dollar(i: number, limit: number): number {
    let run = 1
    while (src[i + run] === '$') run++

    // A dollar inside a bare URL is part of the address.
    const token = tokenStart(i)
    if (token < i && URL_START.test(src.slice(token, Math.min(i, token + 8)))) {
      let end = i
      while (end < limit && !WHITESPACE.test(src[end]) && src[end] !== '<') end++
      return end
    }

    const depth = quotesOfLine(i)

    if (run >= 2) {
      const close = findRun(i + run, '$', run, limit)
      if (close === -1) return i + run
      const content = src.slice(i + run, close)
      const end = close + run
      if (atLineStart(i) && content.includes('\n') && !dollarLaterOnLine(i, i + run)) {
        // "$$ x^2 +" … "y^2 $$": the first line would be a fence with an info string. As single-dollar text maths
        // the whole formula survives; remarkMathPromote shows it as a block.
        if (content.includes('$') || !content.trim()) return end
        const at = offsetOf(i)
        generated.add(at)
        display.add(at)
        replace(i, end, '$' + protectLines(content, depth, 1) + '$')
        return end
      }
      // The author's own `$$…$$` text maths: left as written, when it pairs at all.
      const pairs = pairsAcross(i, close, depth, run)
      if (pairs === 0) return i + run
      if (pairs === 2) replace(close, close, '\\relax ')
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
      if (
        close !== -1 &&
        !WHITESPACE.test(src[close - 1]) &&
        !DIGIT.test(src[close + 1] ?? '') &&
        src[close + 1] !== '$' &&
        pairsAcross(i, close, depth, 1) !== 0
      ) {
        // The author's formula, left as written: no line in it starts a block (pairsAcross).
        const content = src.slice(i + 1, close)
        if (!content.includes('$')) return close + 1
        // An escaped dollar inside: in text maths micromark does not honour `\$`, so fence with a longer run -- unless
        // that run would open the line and the formula go on to the next one (`$$a` there reads as a fence).
        if (!(atLineStart(i) && content.includes('\n'))) {
          const n = maxDollarRun(content) + 1
          generated.add(offsetOf(i))
          const fence = '$'.repeat(n)
          replace(i, close + 1, fence + content + fence)
          return close + 1
        }
      }
    }
    replace(i, i + 1, '\\$')
    return i + 1
  }
}
