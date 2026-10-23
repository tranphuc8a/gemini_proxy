/**
 * Maths test vectors shared by Markdown Editor Pro and gemini-chat.
 *
 * SOURCE: markdown-editor/src/lib/__tests__/mathVectors.ts. The copy in frontend/src/lib/__tests__/ is written by
 * `node scripts/sync-math.mjs` (`--kiem` fails when it drifts), together with the code these vectors test:
 * mathDelimiters.ts, remarkMathPromote.ts and katexOptions.ts. Edit here, then run the script.
 *
 * Data and DOM helpers only, no app code: each app renders the vectors through its own Markdown component.
 */
import { expect } from 'vitest'

const R = String.raw

/** [name, input, expected text, offsets marked display, offsets marked generated] */
export type NormalizeVector = [string, string, string, number[]?, number[]?]

/**
 * Input → prepared text. Cases from md-render.md §1.2 / §3.1.2 (what LLM answers really contain), plus the code and
 * HTML regions the rewrite must leave alone.
 */
export const NORMALIZE_VECTORS: NormalizeVector[] = [
  ['\\[ \\] on lines of their own → $$ block', '\\[\nE = mc^2\n\\]', '$$\nE = mc^2\n$$', [], []],
  ['\\[ \\] on one line → display text maths', R`\[ E = mc^2 \]`, '$ E = mc^2 $', [0], [0]],
  ['\\[ opener with content, closer later', '\\[ x^2 +\ny^2 = z^2 \\]', '$ x^2 +\ny^2 = z^2 $', [0], [0]],
  ['\\( \\) mid-sentence', R`Energy \( E = mc^2 \) here`, 'Energy $ E = mc^2 $ here', [], [7]],
  ['\\( \\) at the start of a line', R`\(f\) is continuous`, '$f$ is continuous', [], [0]],
  ['\\( \\) protects _ and *', R`Let \( x_1 * x_2 = a_i * b_j \) hold`, 'Let $ x_1 * x_2 = a_i * b_j $ hold', [], [4]],
  ['\\[ aligned \\] keeps \\\\', '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]', '$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$', [], []],
  ['bare align keeps \\\\', '\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}', '$\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}$', [0], [0]],
  ['bare align: + / - lines get \\relax', '\\begin{align}\nf(x) &= x^2\n+ 2x \\\\\n- 3 &= 0\n\\end{align}', '$\\begin{align}\nf(x) &= x^2\n\\relax + 2x \\\\\n\\relax - 3 &= 0\n\\end{align}$', [0], [0]],
  ['bare pmatrix on one line', R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`, R`$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$`, [0], [0]],
  ['bare equation*', '\\begin{equation*}\nE = mc^2\n\\end{equation*}', '$\\begin{equation*}\nE = mc^2\n\\end{equation*}$', [0], [0]],
  ['nested environments of the same name', '\\begin{array}{c}\n\\begin{array}{c} a \\end{array}\n\\end{array}', '$\\begin{array}{c}\n\\begin{array}{c} a \\end{array}\n\\end{array}$', [0], [0]],
  ['\\begin mid-sentence is left alone', R`where \begin{pmatrix} a \end{pmatrix} is`, R`where \begin{pmatrix} a \end{pmatrix} is`],
  ['unknown environment is left alone', '\\begin{tikzcd}\nA \\arrow[r] & B\n\\end{tikzcd}', '\\begin{tikzcd}\nA \\arrow[r] & B\n\\end{tikzcd}'],
  ['\\begin inside an existing $$ block is untouched', '$$\n\\begin{align}\na &= b\n\\end{align}\n$$', '$$\n\\begin{align}\na &= b\n\\end{align}\n$$'],
  ['$$x$$ alone stays (remarkMathPromote shows it as a block)', R`$$x = \frac{-b}{2a}$$`, R`$$x = \frac{-b}{2a}$$`],
  ['$$x$$ mid-sentence stays', R`Area is $$A=\pi r^2$$ ok`, R`Area is $$A=\pi r^2$$ ok`],
  ['\\[ \\] mid-sentence with TeX → display', R`So \[ a^2 \] is display`, 'So $ a^2 $ is display', [3], [3]],
  ['\\[Enter\\] mid-sentence without TeX stays text', R`Press \[Enter\] now`, R`Press \[Enter\] now`],
  ['\\[x\\] alone on its line is maths even without TeX', R`\[x\]`, '$x$', [0], [0]],
  ['\\[ \\] inside a blockquote', '> \\[\n> a^2\n> \\]', '> $$\n> a^2\n> $$'],
  ['\\[ \\] inside a list item', '- item\n  \\[\n  a^2\n  \\]\n- next', '- item\n  $$\n  a^2\n  $$\n- next'],
  ['\\( \\) in a table cell', '| a | b |\n|---|---|\n| \\(x^2\\) | $y$ |', '| a | b |\n|---|---|\n| $x^2$ | $y$ |', [], [22]],
  ['code span untouched', 'Use `\\(x\\)` and `$5` literally', 'Use `\\(x\\)` and `$5` literally'],
  ['double-backtick code span untouched', 'Use `` `\\(x\\)` `` here', 'Use `` `\\(x\\)` `` here'],
  ['fenced code untouched', '```\n\\[ x \\]\n$5 and $10\n```', '```\n\\[ x \\]\n$5 and $10\n```'],
  ['tilde fence untouched', '~~~tex\n\\begin{align}\na\n\\end{align}\n~~~', '~~~tex\n\\begin{align}\na\n\\end{align}\n~~~'],
  ['fence inside a list item untouched', '- ```js\n  const a = "$5 and $10"\n  ```\n- \\(x\\)', '- ```js\n  const a = "$5 and $10"\n  ```\n- $x$', [], [41]],
  ['fence inside a blockquote untouched', '> ```\n> \\(x\\)\n> ```\n> \\(y\\)', '> ```\n> \\(x\\)\n> ```\n> $y$', [], [22]],
  ['indented code untouched', 'para\n\n    $5 and \\(x\\)\n', 'para\n\n    $5 and \\(x\\)\n'],
  ['indented continuation of a paragraph is not code', 'para\n    not code \\(x\\)', 'para\n    not code $x$', [], [18]],
  ['HTML block (div) untouched, the paragraph after it converted', '<div>\n\\(x\\)\n</div>\n\n\\(y\\)', '<div>\n\\(x\\)\n</div>\n\n$y$', [], [20]],
  ['HTML comment untouched', '<!-- \\(x\\) $5 -->\n\n\\(y\\)', '<!-- \\(x\\) $5 -->\n\n$y$', [], [19]],
  ['<pre> block untouched', '<pre>\n\\(x\\) $5\n\n$6\n</pre>\n\n$y$', '<pre>\n\\(x\\) $5\n\n$6\n</pre>\n\n$y$'],
  ['inline HTML attribute keeps its dollars', '<abbr title="$5 or $10">price</abbr> and $y$', '<abbr title="$5 or $10">price</abbr> and $y$'],
  ['autolink keeps its dollar', '<https://x.test/?p=$5> and $z$', '<https://x.test/?p=$5> and $z$'],
  ['bare URL keeps its dollar', 'see https://x.test/a$5 and $z$', 'see https://x.test/a$5 and $z$'],
  ['escaped backslash before [ is not a delimiter', R`\\[ not math \\]`, R`\\[ not math \\]`],
  ['three backslashes: an escaped one, then a delimiter', R`\\\( x \)`, '\\\\$ x $', [], [2]],
  ['prices: $5 and $10', R`It costs $5 and $10 total`, R`It costs \$5 and \$10 total`],
  ['price before real maths', R`Pay $5 for $x$ items`, R`Pay \$5 for $x$ items`],
  ['ChatGPT plan prices', R`Plus costs $20/month and Pro $200/month.`, R`Plus costs \$20/month and Pro \$200/month.`],
  ['price range $5-$10', R`between $5-$10 each`, R`between \$5-\$10 each`],
  ['already escaped dollar', R`Literal \$5 and $y$`, R`Literal \$5 and $y$`],
  ['$ x $ with inner spaces is not maths (pandoc)', R`$ x $`, R`\$ x \$`],
  ['dollar in a link destination (an address, left alone)', R`[a](http://x.com/?p=$5) and $z$`, R`[a](http://x.com/?p=$5) and $z$`],
  ['dollar in a relative link destination', R`[a](/buy?p=$5) and $z$`, R`[a](/buy?p=\$5) and $z$`],
  ['closer followed by a digit is not a closer', R`$x$5`, R`\$x\$5`],
  ['escaped dollar inside $…$ fences with $$', R`$\$5$ ok`, R`$$\$5$$ ok`, [], [0]],
  ['escaped dollar inside \\( \\)', R`Price \(\$5\) ok`, R`Price $$\$5$$ ok`, [], [6]],
  ['mhchem inside \\( \\)', R`\(\ce{H2O + CO2 -> H2CO3}\)`, R`$\ce{H2O + CO2 -> H2CO3}$`, [], [0]],
  ['"$$ formula" over two lines (fence-with-info trap)', '$$ x^2 +\ny^2 $$', '$ x^2 +\ny^2 $', [0], [0]],
  ['"$$ formula" closed by a fence line', '$$ x^2 +\ny^2\n$$\n\nafter', '$ x^2 +\ny^2\n$\n\nafter', [0], [0]],
  ['bare $$ never fenced, closed at the end of a line', '$$\nx^2 $$\n\nafter', '$\nx^2 $\n\nafter', [0], [0]],
  ['$$ ending a line, closing $$ starting one: \\relax keeps the paragraph', 'Text $$\nx\n$$', 'Text $$\nx\n\\relax $$'],
  ['closing $$ starting a line in the same blockquote: \\relax', '> Text $$\n> x\n> $$', '> Text $$\n> x\n> \\relax $$'],
  ['closing $$ after a deeper blockquote line: no pairing, no \\relax', 'Text $$\n> x\n$$', 'Text $$\n> x\n$$'],
  ['closing $$ starting a deeper blockquote line: no pairing, no \\relax', '> Text $$\nx\n>> $$', '> Text $$\nx\n>> $$'],
  // The author's own dollars pair within one paragraph only, as in micromark: never across a line that starts a block.
  ['$ does not pair into a list item in a blockquote', '> a $x\n> + y$', '> a \\$x\n> + y\\$'],
  ['prices in list items (two items, two prices)', '- Gói cơ bản: 5$/tháng\n- Gói pro: 10$/tháng', '- Gói cơ bản: 5\\$/tháng\n- Gói pro: 10\\$/tháng'],
  ['prices before a full stop in list items', '- Gói A: 5$.\n- Gói B: 10$.', '- Gói A: 5\\$.\n- Gói B: 10\\$.'],
  ['prices in an ordered list', '1. Gói A 5$/tháng\n2. Gói B 10$/tháng', '1. Gói A 5\\$/tháng\n2. Gói B 10\\$/tháng'],
  ['prices in table rows', '| Gói | Giá |\n| --- | --- |\n| Basic | 5$/mo |\n| Pro | 10$/mo |', '| Gói | Giá |\n| --- | --- |\n| Basic | 5\\$/mo |\n| Pro | 10\\$/mo |'],
  ['prices around a heading', 'Ghi chú: phí 2$/lần\n# Tiêu đề\nthêm 3$/lần', 'Ghi chú: phí 2\\$/lần\n# Tiêu đề\nthêm 3\\$/lần'],
  ['a heading holds one line', '# Giá 5$\nchỉ 10$/tháng', '# Giá 5\\$\nchỉ 10\\$/tháng'],
  ['$ does not pair over a setext underline', 'Giá 5$/x\n---\nthêm 10$/y', 'Giá 5\\$/x\n---\nthêm 10\\$/y'],
  ['$ does not pair into a deeper blockquote', 'a 5$/x\n> b 10$/y', 'a 5\\$/x\n> b 10\\$/y'],
  ['$$ does not pair into the next list item', '- a $$x\n- b$$', '- a $$x\n- b$$'],
  ['multi-line $…$ in a paragraph stays as written', '$a +\nb$ ok', '$a +\nb$ ok'],
  ['multi-line $…$ in a list item stays as written', '- $a +\n  b$', '- $a +\n  b$'],
  ['"= b" and "-b" do not start a block: no \\relax', '$a\n= b$ and $c\n-d$', '$a\n= b$ and $c\n-d$'],
  ['lazy line of a blockquote continues its paragraph', '> $a +\nb$', '> $a +\nb$'],
  ['a | line pairs when the text has no table', '$|x|\ny|$ ok', '$|x|\ny|$ ok'],
  ['escaped dollar, formula opening a line and going on: not fenced with $$', '$a\n\\$b$', '\\$a\n\\$b\\$'],
  // Code the rewrite must not touch.
  ['indented code starting with >>> (Python session)', 'Ví dụ:\n\n    >>> price = "$5 and $10"\n    >>> print(price)\n', 'Ví dụ:\n\n    >>> price = "$5 and $10"\n    >>> print(price)\n'],
  ['tab then > is indented code, not a blockquote', '\t> x_1 5$/x and $5', '\t> x_1 5$/x and $5'],
  ['indented code right after a heading', '# T\n    code $5 and $10', '# T\n    code $5 and $10'],
  ['indented code in a blockquote', '> para\n>\n>     echo "$HOME" $5', '> para\n>\n>     echo "$HOME" $5'],
  ['indented code opening a blockquote', 'para\n>     echo "$HOME" $5', 'para\n>     echo "$HOME" $5'],
  ['indented continuation inside a blockquote is not code', '> para\n>     not code $5 and $10', '> para\n>     not code \\$5 and \\$10'],
  ['HTML block as a list item', '- <details><summary>Giá</summary>Gói 5$/tháng</details>', '- <details><summary>Giá</summary>Gói 5$/tháng</details>'],
  ['code span inside \\( \\) leaves the author text alone', 'Dùng \\( `x` \\) ở đây', 'Dùng \\( `x` \\) ở đây'],
  ['inline HTML tag inside maths stays maths', '$a <b c>d$ and x <a b> $y$', '$a <b c>d$ and x <a b> $y$'],
  ['empty \\(\\) left alone', R`a\(\)b`, R`a\(\)b`],
  ['unclosed \\( left alone', R`a \( b`, R`a \( b`],
  ['\\( does not close across a blank line', 'a \\( b\n\nc \\) d', 'a \\( b\n\nc \\) d'],
  ['$$ inside \\[ \\] uses a longer fence', '\\[\n$$x$$\n\\]', '$$$\n$$x$$\n$$$'],
  ['text without any delimiter is returned as is', 'plain words only', 'plain words only'],
  // Streaming (gemini-chat renders the answer as it arrives): an opener whose closer has not arrived yet stays text.
  // Turning it into maths would swallow everything after it until the closer comes.
  ['stream: \\[ alone on its line, closer not here yet', '\\[\nx^2 +', '\\[\nx^2 +'],
  ['stream: \\[ with content, closer not here yet', R`So \[ x^2 +`, R`So \[ x^2 +`],
  ['stream: cut right after the closer\'s backslash', '\\[\nx\n\\', '\\[\nx\n\\'],
  ['stream: \\( cut after the closer\'s backslash', '\\( x \\', '\\( x \\'],
  ['stream: bare \\begin before its \\end arrives', '\\begin{align}\na &= b \\\\', '\\begin{align}\na &= b \\\\'],
  ['stream: \\begin inside an open \\[', '\\[\n\\begin{aligned}\na &= b \\\\\n', '\\[\n\\begin{aligned}\na &= b \\\\\n'],
  ['stream: open \\[ in a list item', '- \\[\n  x +', '- \\[\n  x +'],
  ['stream: a finished formula before an open \\[ still converts', 'Let \\(a\\) be\n\n\\[\nx +', 'Let $a$ be\n\n\\[\nx +', [], [4]],
  ['stream: a dollar whose closer has not arrived is text until it does', '$x^2 + y', '\\$x^2 + y'],
  ['stream: the closer arrives, the block appears', '\\[\nx\n\\]', '$$\nx\n$$', [], []]
]

/** KaTeX output counted in a rendered element: display formulas, inline formulas, KaTeX errors. */
export function countMaths(root: HTMLElement) {
  const display = root.querySelectorAll('.katex-display').length
  return {
    display,
    inline: root.querySelectorAll('.katex').length - display,
    errors: root.querySelectorAll('.katex-error').length + (root.innerHTML.includes('#cc0000') ? 1 : 0)
  }
}

/** Visible text with every formula replaced by «TeX». */
export function textOf(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.katex').forEach((node) => {
    const tex = node.querySelector('annotation')?.textContent ?? '?'
    node.replaceWith(document.createTextNode(`«${tex}»`))
  })
  return copy.textContent ?? ''
}

export interface RenderVector {
  name: string
  md: string
  display: number
  inline: number
  /** Substrings the visible text must contain. */
  has?: string[]
  /** Substrings the visible text must not contain. */
  hasNot?: string[]
  /** Extra checks on the rendered DOM. */
  check?: (root: HTMLElement) => void
}

export const RENDER_VECTORS: RenderVector[] = [
  { name: '$…$ inline', md: 'Euler $e^{i\\pi}+1=0$ ok', display: 0, inline: 1 },
  { name: '$$ block', md: '$$\nx^2 + y^2 = z^2\n$$', display: 1, inline: 0 },
  { name: '$$x$$ alone on its line (Gemini) → block', md: R`$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$`, display: 1, inline: 0 },
  { name: '$$ x $$ alone with spaces → block', md: '$$ x^2 + y^2 = z^2 $$', display: 1, inline: 0 },
  {
    name: '"$$ x^2 +" then "y^2 = z^2 $$" → one block, nothing lost',
    md: '$$ x^2 +\ny^2 = z^2 $$\n\nafter',
    display: 1,
    inline: 0,
    check: (root) => {
      expect(root.querySelector('annotation')?.textContent).toContain('y^2 = z^2')
      expect(Array.from(root.querySelectorAll('p')).pop()?.textContent).toBe('after')
    }
  },
  { name: '$$ block inside a paragraph', md: 'Text before\n$$\nE = mc^2\n$$\ntext after', display: 1, inline: 0, has: ['Text before', 'text after'] },
  { name: '\\[ \\] on lines of their own (ChatGPT)', md: '\\[\nE = mc^2\n\\]', display: 1, inline: 0, hasNot: ['[', ']'] },
  { name: '\\[ \\] on one line', md: R`\[ E = mc^2 \]`, display: 1, inline: 0, hasNot: ['['] },
  { name: '\\( \\) inline (ChatGPT)', md: R`Energy \( E = mc^2 \) here`, display: 0, inline: 1, has: ['Energy «E = mc^2» here'] },
  {
    name: '\\( \\) keeps _ and * as maths',
    md: R`Let \( x_1 * x_2 = a_i * b_j * c \) hold`,
    display: 0,
    inline: 1,
    check: (root) => expect(root.querySelector('em')).toBeNull()
  },
  {
    name: '\\[ aligned \\] keeps its \\\\ line breaks',
    md: '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('annotation')?.textContent).toContain('a &= b \\\\')
  },
  {
    name: 'bare \\begin{align} keeps its \\\\',
    md: '\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('annotation')?.textContent).toContain('a &= b \\\\')
  },
  { name: 'bare equation with \\tag', md: '\\begin{equation}\nE = mc^2 \\tag{1}\n\\end{equation}', display: 1, inline: 0 },
  { name: 'bare pmatrix on one line', md: R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`, display: 1, inline: 0 },
  { name: 'bare cases', md: R`\begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}`, display: 1, inline: 0 },
  {
    name: 'bare align with lines starting + and - stays one formula',
    md: '\\begin{align}\nf(x) &= x^2\n+ 2x \\\\\n- 3 &= 0\n\\end{align}',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('ul, li')).toBeNull()
  },
  { name: '```math fence', md: '```math\n\\frac{a}{b}\n```', display: 1, inline: 0 },
  { name: '$$ \\begin{align} $$ (Gemini)', md: '$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$', display: 1, inline: 0 },
  { name: '\\boxed and \\tag', md: '$$\n\\boxed{x = 2} \\tag{2}\n$$', display: 1, inline: 0 },
  { name: 'mhchem \\ce and \\pu', md: R`$\ce{H2O}$ and $\pu{123 kJ}$`, display: 0, inline: 2 },
  { name: 'mhchem inside \\( \\)', md: R`\(\ce{H2O + CO2 -> H2CO3}\)`, display: 0, inline: 1 },
  { name: 'prices $5 and $10 are not maths', md: 'It costs $5 and $10 total', display: 0, inline: 0, has: ['It costs $5 and $10 total'] },
  { name: 'a price before real maths', md: 'Pay $5 for $x$ items', display: 0, inline: 1, has: ['Pay $5 for «x» items'] },
  { name: 'plan prices', md: 'Plus costs $20/month and Pro $200/month.', display: 0, inline: 0, has: ['$20/month and Pro $200/month.'] },
  { name: 'price range', md: 'between $5-$10 each', display: 0, inline: 0, has: ['between $5-$10 each'] },
  { name: 'escaped dollar stays a dollar', md: 'Literal \\$5 and $y$', display: 0, inline: 1, has: ['Literal $5 and «y»'] },
  { name: '$ x $ with inner spaces is text (pandoc)', md: '$ x $', display: 0, inline: 0, has: ['$ x $'] },
  { name: '$$…$$ mid-sentence stays inline', md: 'The area is $$A = \\pi r^2$$ for a circle.', display: 0, inline: 1 },
  {
    name: '\\[ \\] inside a blockquote',
    md: '> \\[\n> a^2\n> \\]',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('blockquote .katex-display')).not.toBeNull()
  },
  {
    name: '\\[ \\] inside a list item',
    md: '- item\n  \\[\n  a^2\n  \\]\n- next',
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelectorAll('li')).toHaveLength(2)
  },
  { name: '\\( \\) in a table cell', md: '| a | b |\n|---|---|\n| \\(x^2\\) | $y$ |', display: 0, inline: 2 },
  { name: '\\\\[ (copied from JSON) is text', md: R`\\[ x^2 \\]`, display: 0, inline: 0, has: ['\\[ x^2 \\]'] },
  { name: 'escaped brackets of a link-like text', md: R`See [docs](http://a.b) and \[not math]`, display: 0, inline: 0, has: ['[not math]'] },
  { name: '\\[Enter\\] mid-sentence is text', md: R`Press \[Enter\] to continue`, display: 0, inline: 0, has: ['Press [Enter] to continue'] },
  {
    name: 'code span untouched',
    md: 'Use `\\(x\\)` literally',
    display: 0,
    inline: 0,
    check: (root) => expect(root.querySelector('code')?.textContent).toBe('\\(x\\)')
  },
  { name: 'fenced code untouched', md: '```\n\\[ x \\] costs $5 and $10\n```', display: 0, inline: 0, has: ['\\[ x \\] costs $5 and $10'] },
  {
    name: '\\label, \\tag and \\eqref',
    md: '\\[\nx = 1 \\label{eq:a} \\tag{1}\n\\]\nSee \\(\\eqref{eq:a}\\).',
    display: 1,
    inline: 1,
    check: (root) => expect(Array.from(root.querySelectorAll('.katex-html')).pop()?.textContent).toContain('(eq:a)')
  },
  { name: '\\ref', md: R`Equation \(\ref{eq:a}\) holds`, display: 0, inline: 1 },
  { name: '\\require (MathJax) is dropped', md: R`$$\require{cancel}\cancel{x}$$`, display: 1, inline: 0 },
  { name: 'multline → gather', md: '\\begin{multline}\na + b \\\\\nc\n\\end{multline}', display: 1, inline: 0 },
  { name: 'eqnarray → align', md: '\\begin{eqnarray}\na &=& b\n\\end{eqnarray}', display: 1, inline: 0 },
  { name: 'flalign → align', md: '$$\n\\begin{flalign}\na &= b\n\\end{flalign}\n$$', display: 1, inline: 0 },
  {
    name: '\\[ \\] mid-sentence renders in display style',
    md: R`So \[ a^2 \] is display`,
    display: 1,
    inline: 0,
    check: (root) => expect(root.querySelector('p .katex-display')).not.toBeNull()
  },
  { name: 'escaped dollar inside \\( \\)', md: R`Price \(\$5\) ok`, display: 0, inline: 1 },
  { name: 'escaped dollar inside $…$', md: R`$\$5$ ok`, display: 0, inline: 1 },
  { name: '\\( \\) at the start of a line', md: R`\(f\) is continuous`, display: 0, inline: 1 },
  { name: 'inline HTML inside maths stays maths', md: '$a <b c>d$ and $y$', display: 0, inline: 2 },
  {
    name: 'dollar in a link address',
    md: '[buy](http://x.test/?p=$5) and $z$',
    display: 0,
    inline: 1,
    check: (root) => expect(root.querySelector('a')?.getAttribute('href')).toBe('http://x.test/?p=$5')
  },
  { name: 'maths in a heading', md: '## Energy $E=mc^2$', display: 0, inline: 1 },
  {
    name: 'inline, block and dollar maths in one paragraph',
    md: 'Inline \\(a\\), display\n\\[\nb\n\\]\nand $c$',
    display: 1,
    inline: 2
  },
  {
    name: '\\[ \\] in <details> after a blank line',
    md: '<details>\n<summary>Proof</summary>\n\n\\[\nx^2\n\\]\n\n</details>',
    display: 1,
    inline: 0
  },
  { name: '"Text $$" … "$$" across lines', md: 'Text $$\nx\n$$', display: 0, inline: 1 },
  // Prices after the number (5$/tháng) are common in Vietnamese; a dollar never pairs with one in another block.
  {
    name: 'prices in list items stay two items',
    md: '- Gói cơ bản: 5$/tháng\n- Gói pro: 10$/tháng',
    display: 0,
    inline: 0,
    has: ['Gói cơ bản: 5$/tháng', 'Gói pro: 10$/tháng'],
    check: (root) => expect(root.querySelectorAll('li')).toHaveLength(2)
  },
  {
    name: 'prices before a full stop in list items',
    md: '- Gói A: 5$.\n- Gói B: 10$.',
    display: 0,
    inline: 0,
    check: (root) => expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['Gói A: 5$.', 'Gói B: 10$.'])
  },
  {
    name: 'prices in table rows',
    md: '| Gói | Giá |\n| --- | --- |\n| Basic | 5$/mo |\n| Pro | 10$/mo |',
    display: 0,
    inline: 0,
    hasNot: ['relax'],
    check: (root) => expect(Array.from(root.querySelectorAll('td')).map((td) => td.textContent)).toEqual(['Basic', '5$/mo', 'Pro', '10$/mo'])
  },
  {
    name: 'prices around a heading',
    md: 'Ghi chú: phí 2$/lần\n# Tiêu đề\nthêm 3$/lần',
    display: 0,
    inline: 0,
    has: ['phí 2$/lần', 'thêm 3$/lần'],
    check: (root) => {
      expect(root.querySelectorAll('h1')).toHaveLength(1)
      expect(root.querySelector('h1')?.textContent).toContain('Tiêu đề')
      expect(root.querySelectorAll('p')).toHaveLength(2)
    }
  },
  { name: 'a $…$ formula over two lines of one paragraph', md: 'Sum $a +\nb$ here', display: 0, inline: 1 },
  {
    name: 'a Python session in indented code keeps its dollars',
    md: 'Ví dụ:\n\n    >>> price = "$5 and $10"\n    >>> print(price)\n',
    display: 0,
    inline: 0,
    has: ['>>> price = "$5 and $10"'],
    hasNot: ['\\$']
  },
  {
    name: 'an HTML block as a list item keeps its dollar',
    md: '- <details><summary>Giá</summary>Gói 5$/tháng</details>',
    display: 0,
    inline: 0,
    has: ['Gói 5$/tháng'],
    hasNot: ['\\$']
  },
  {
    name: 'a ChatGPT answer',
    md: [
      'The quadratic formula gives the roots of \\(ax^2 + bx + c = 0\\):',
      '',
      '\\[',
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      '\\]',
      '',
      'For example, if the course costs $49 and the book $15, the total is $64.',
      '',
      '1. Compute the discriminant \\( \\Delta = b^2 - 4ac \\).',
      '2. If \\( \\Delta < 0 \\), there are no real roots.'
    ].join('\n'),
    display: 1,
    inline: 3,
    has: ['costs $49 and the book $15, the total is $64.']
  },
  {
    name: 'a Gemini answer',
    md: ['Phương trình Schrödinger:', '', '$$i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat H \\Psi$$', '', 'với $\\hbar = h / 2\\pi$.'].join('\n'),
    display: 1,
    inline: 1
  }
]

/** Whole answers as a chat model streams them; the tests cut them at many points (`streamCuts`). */
export interface StreamAnswer {
  name: string
  md: string
  /** Formulas once the whole answer is in. */
  display: number
  inline: number
}

export const STREAM_ANSWERS: StreamAnswer[] = [
  {
    name: 'ChatGPT style: \\( \\), \\[ \\], bare align, prices, mhchem, \\eqref',
    md: [
      'Nghiệm của phương trình \\( ax^2 + bx + c = 0 \\) là:',
      '',
      '\\[',
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      '\\]',
      '',
      'Với biệt thức \\( \\Delta = b^2 - 4ac \\):',
      '',
      '1. Nếu \\( \\Delta > 0 \\), có hai nghiệm phân biệt.',
      '2. Nếu \\( \\Delta = 0 \\), có nghiệm kép \\[ x = -\\frac{b}{2a} \\]',
      '',
      'Khóa học giá $49 và sách $15, tổng $64.',
      '',
      '\\begin{align}',
      'f(x) &= x^2 + 2x \\\\',
      '&= (x+1)^2 - 1',
      '\\end{align}',
      '',
      'Phản ứng \\(\\ce{2H2 + O2 -> 2H2O}\\), xem \\(\\eqref{eq:1}\\).'
    ].join('\n'),
    display: 3,
    inline: 6
  },
  {
    name: 'Gemini style: $$x$$ alone, $…$, a price after the number, a $$ block',
    md: [
      'Phương trình Schrödinger:',
      '',
      '$$i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat H \\Psi$$',
      '',
      'với $\\hbar = h / 2\\pi$. Gói Pro 20$/tháng.',
      '',
      '$$',
      'E = mc^2',
      '$$'
    ].join('\n'),
    display: 2,
    inline: 1
  }
]

/**
 * Where to cut an answer to imitate streaming in a render test (rendering is slow; `normalizeMath` alone is checked at
 * every character): after every backslash, dollar, bracket and parenthesis (a delimiter cut in half, just opened or
 * just closed), one character later (the first character of a formula), at every line end, and at the end.
 */
export function streamCuts(md: string): number[] {
  const cuts: number[] = []
  const after = (cut: number) => cut >= 1 && '\\$[]()\n'.includes(md[cut - 1])
  for (let cut = 1; cut <= md.length; cut++) if (cut === md.length || after(cut) || after(cut - 1)) cuts.push(cut)
  return cuts
}

/** Offset of the last `\[` or `\(` in `prefix` still waiting for its closer, or -1. */
export function openDelimiterAt(prefix: string): number {
  let open = -1
  for (const [opener, closer] of [['\\[', '\\]'], ['\\(', '\\)']]) {
    const at = prefix.lastIndexOf(opener)
    if (at === -1 || prefix[at - 1] === '\\' || prefix.indexOf(closer, at + 2) !== -1) continue
    open = Math.max(open, at)
  }
  return open
}

/**
 * What `normalizeMath` must make of an answer cut anywhere (`prepared` is its text): the same number of lines, and an
 * open `\[` or `\(` kept as written, up to the end. Returns '' when that holds, else what went wrong.
 */
export function streamPrefixFailure(prefix: string, prepared: string): string {
  if (prepared.split('\n').length !== prefix.split('\n').length) return 'the number of lines changed'
  const at = openDelimiterAt(prefix)
  if (at !== -1 && !prepared.endsWith(prefix.slice(at))) return `the open ${prefix.slice(at, at + 2)} was rewritten: ${JSON.stringify(prepared.slice(-(prefix.length - at) - 8))}`
  return ''
}
