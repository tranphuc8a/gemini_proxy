import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import { blockIndexAtLine, blockKeyTableSize, blockSource, splitBlocks } from '../blocks'
import { markdownComponents, rehypePlugins, remarkPlugins } from '../markdownPipeline'
import { prepareBlock, prepareMarkdown } from '../prepareMarkdown'
import { markdownUrlTransform } from '../rehypeEnhance'
import { longDoc } from '../../test/longDoc'
import { CASES } from './blockCases'
import { NORMALIZE_VECTORS, RENDER_VECTORS, STREAM_ANSWERS } from './mathVectors'

/**
 * Render by block is only right if cutting the document never changes what it renders as (ke-hoach §1.1). Two
 * invariants, on hand-written hard cases, the maths vectors of md-render, the generated long documents and random
 * assemblies of all of those:
 *   1. concat(prepare(block)) == prepare(whole document)
 *   2. render(block) joined == render(whole document)        (heading ids aside: they are set after, headingIds.ts)
 */

const R = String.raw

function html(text: string): string {
  const prepared = text === '' ? prepareMarkdown('') : prepareMarkdown(text)
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={remarkPlugins(prepared)}
      rehypePlugins={rehypePlugins({ blockMode: true })}
      components={markdownComponents({ theme: 'light' })}
      urlTransform={markdownUrlTransform}
    >
      {prepared.text}
    </ReactMarkdown>
  )
}

/** Markup without the whitespace between tags (the whole document renders "\n" between blocks, a block does not). */
const squash = (markup: string) => markup.replace(/\s*\n\s*(?=<)/g, '').replace(/>\s*\n\s*/g, '>').replace(/\n+/g, '\n').trim()

/** A block's markup with `data-line` made absolute, as the whole document renders it. */
function blockHtml(text: string, start: number): string {
  return html(text).replace(/data-line="(\d+)"/g, (_m, n: string) => `data-line="${Number(n) + start - 1}"`)
}

function renderedByBlocks(source: string): { whole: string; blocks: string; needsWhole: boolean } {
  const split = splitBlocks(source)
  const parts = split.blocks.map((block) => blockHtml(blockSource(block, split.defs), block.start))
  return { whole: squash(html(source)), blocks: squash(parts.join('')), needsWhole: split.needsWhole }
}

function expectSame(source: string) {
  const split = splitBlocks(source)
  expect(split.blocks.map((block) => block.text).join('\n')).toBe(source)
  if (split.needsWhole) return
  // 1. preparation
  const preparedByBlocks = split.blocks.map((block) => prepareBlock(block.text).text).join('\n')
  const preparedWhole = prepareMarkdown(source).text
  if (preparedByBlocks !== preparedWhole) {
    let at = 0
    while (at < preparedWhole.length && preparedWhole[at] === preparedByBlocks[at]) at++
    throw new Error(`preparation differs at ${at}: WHOLE ${JSON.stringify(preparedWhole.slice(Math.max(0, at - 120), at + 160))} BLOCKS ${JSON.stringify(preparedByBlocks.slice(Math.max(0, at - 120), at + 160))}`)
  }
  // 2. rendering
  const { whole, blocks } = renderedByBlocks(source)
  if (blocks !== whole) {
    let at = 0
    while (at < whole.length && whole[at] === blocks[at]) at++
    throw new Error(`rendering differs at ${at}: WHOLE ${JSON.stringify(whole.slice(Math.max(0, at - 120), at + 160))} BLOCKS ${JSON.stringify(blocks.slice(Math.max(0, at - 120), at + 160))}`)
  }
}

describe('splitBlocks: shape', () => {
  it('covers every line exactly once and keeps the text', () => {
    const source = 'a\n\nb\nc\n\n\n```\nx\n\ny\n```\n\nd'
    const { blocks, lineCount } = splitBlocks(source)
    expect(lineCount).toBe(source.split('\n').length)
    expect(blocks[0].start).toBe(1)
    blocks.forEach((block, index) => {
      if (index > 0) expect(block.start).toBe(blocks[index - 1].end + 1)
      expect(block.text.split('\n').length).toBe(block.end - block.start + 1)
    })
    expect(blocks[blocks.length - 1].end).toBe(lineCount)
    expect(blocks.map((block) => block.text).join('\n')).toBe(source)
  })

  it('cuts at blank lines and nowhere inside the open regions', () => {
    expect(splitBlocks('one\n\ntwo\n\nthree').blocks.map((b) => b.start)).toEqual([1, 3, 5])
    expect(splitBlocks('```\na\n\nb\n```').blocks).toHaveLength(1)
    expect(splitBlocks('$$\na\n\nb\n$$').blocks).toHaveLength(1)
    expect(splitBlocks('\\[\na\n\nb\n\\]').blocks).toHaveLength(1)
    expect(splitBlocks('\\begin{align}\na\n\nb\n\\end{align}').blocks).toHaveLength(1)
    expect(splitBlocks('@startuml\na\n\nb\n@enduml').blocks).toHaveLength(1)
    expect(splitBlocks('---\na: 1\n\nb: 2\n---\n\ntext').blocks).toHaveLength(2)
    expect(splitBlocks('<details>\n\nx\n\n</details>').blocks).toHaveLength(1)
    expect(splitBlocks('- a\n\n- b').blocks).toHaveLength(1)
    expect(splitBlocks('text\n\n    code').blocks).toHaveLength(1)
  })

  it('a closed region does not glue what follows it', () => {
    expect(splitBlocks('```\na\n```\n\nb').blocks).toHaveLength(2)
    expect(splitBlocks('$$\na\n$$\n\nb').blocks).toHaveLength(2)
    expect(splitBlocks('<div>x</div>\n\nb').blocks).toHaveLength(2)
    expect(splitBlocks('<!-- c -->\n\nb').blocks).toHaveLength(2)
    expect(splitBlocks('a $$x$$ b\n\nc').blocks).toHaveLength(2)
    // a `<div>` mentioned in the middle of prose does not swallow the rest of the document
    expect(splitBlocks('use a <div> here\n\nb\n\nc').blocks).toHaveLength(3)
  })

  it('an unclosed fence keeps the rest of the document in one block', () => {
    expect(splitBlocks('a\n\n```\nb\n\nc\n\nd').blocks).toHaveLength(2)
  })

  it('collects definitions, and refuses to split what it cannot split safely', () => {
    const defined = splitBlocks('x [a]\n\n[a]: https://x.test\n\ny')
    expect(defined.defs).toBe('[a]: https://x.test')
    expect(defined.needsWhole).toBe(false)
    expect(defined.blocks.map((b) => b.needsDefs)).toEqual([true, true, false])
    expect(splitBlocks('x[^1]\n\n[^1]: note').needsWhole).toBe(true)
    expect(splitBlocks('[a]: https://x.test\n\n[a]: https://y.test').needsWhole).toBe(true)
    expect(splitBlocks('[a]:\n  https://x.test').needsWhole).toBe(true)
  })

  it('finds the block of a line by binary search', () => {
    const { blocks } = splitBlocks('a\n\nb\n\nc\n\nd')
    expect([1, 2, 3, 4, 5, 7].map((line) => blockIndexAtLine(blocks, line))).toEqual([0, 0, 1, 1, 2, 3])
  })
})

describe('splitBlocks: stable keys', () => {
  it('equal text keeps its key wherever the block moves, and repeats get their own', () => {
    const before = splitBlocks('alpha\n\nbeta\n\nbeta\n\ngamma')
    const after = splitBlocks('NEW\n\nNEW 2\n\nalpha\n\nbeta\n\nbeta\n\ngamma')
    const keyOf = (r: ReturnType<typeof splitBlocks>, text: string, nth = 0) => r.blocks.filter((b) => b.text.trim() === text)[nth].key
    expect(keyOf(after, 'alpha')).toBe(keyOf(before, 'alpha'))
    expect(keyOf(after, 'gamma')).toBe(keyOf(before, 'gamma'))
    expect(keyOf(after, 'beta', 1)).toBe(keyOf(before, 'beta', 1))
    expect(keyOf(before, 'beta', 0)).not.toBe(keyOf(before, 'beta', 1))
  })

  it('an edited block gets a new key and its neighbours keep theirs', () => {
    const before = splitBlocks('one\n\ntwo\n\nthree')
    const after = splitBlocks('one\n\ntwo!\n\nthree')
    expect(after.blocks[0].key).toBe(before.blocks[0].key)
    expect(after.blocks[1].key).not.toBe(before.blocks[1].key)
    expect(after.blocks[2].key).toBe(before.blocks[2].key)
  })

  it('forgets texts that left the document once the table has outgrown it', () => {
    for (let n = 0; n < 4000; n++) splitBlocks(`edit ${n}\n\nstay`)
    expect(blockKeyTableSize()).toBeLessThan(2 * 2 + 2000 + 5)
  })
})

/**
 * A raw tag that is never closed (`x <a b> y`) stays open for the HTML parser to the end of the document, so the whole
 * document wraps everything after it in that tag; a block ends where its text ends. That is a defect of the whole-document
 * render, not something to reproduce, so pieces holding one are left out of the multi-piece documents.
 */
const BLANK = '\n\n'
const withoutStrayTags =(pieces: string[]) => pieces.filter((piece) => !/<a b>/.test(piece))

describe('render by block == render of the whole document', () => {
  for (const [name, source] of CASES) {
    it(name, () => expectSame(source))
  }

  it('the maths vectors of md-render (as one document and each alone)', () => {
    for (const vector of RENDER_VECTORS) expectSame(vector.md)
    expectSame(withoutStrayTags(RENDER_VECTORS.map((vector) => vector.md)).join(BLANK))
  })

  it('the normalisation vectors (as one document and each alone)', () => {
    for (const [, input] of NORMALIZE_VECTORS) expectSame(input)
    expectSame(withoutStrayTags(NORMALIZE_VECTORS.map(([, input]) => input)).join(BLANK))
  })

  it('whole LLM answers', () => {
    for (const answer of STREAM_ANSWERS) expectSame(answer.md)
  })

  it('the generated documents (2,000 and the first 3,000 lines of 10,000)', () => {
    expectSame(longDoc('doc-2k'))
    expectSame(longDoc('doc-10k').split('\n').slice(0, 3000).join('\n'))
  }, 120_000)

  it('a document with footnotes is left to the whole-document path', () => {
    expect(splitBlocks(`Text[^a].\n\n[^a]: note\n\n${longDoc('doc-2k').slice(0, 2000)}`).needsWhole).toBe(true)
  })

  it('random assemblies of the hard cases, with random blank lines between', () => {
    const pieces = withoutStrayTags([...CASES.map(([, source]) => source), ...RENDER_VECTORS.map((vector) => vector.md), ...NORMALIZE_VECTORS.map(([, input]) => input)])
    let seed = 12345
    const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
    for (let round = 0; round < 300; round++) {
      const count = 2 + Math.floor(next() * 5)
      const chosen: string[] = []
      for (let at = 0; at < count; at++) chosen.push(pieces[Math.floor(next() * pieces.length)].replace(/\r/g, ''))
      const gaps = chosen.map(() => '\n'.repeat(1 + Math.floor(next() * 3)))
      const source = chosen.map((piece, at) => piece + (at < chosen.length - 1 ? gaps[at] : '')).join('')
      try {
        expectSame(source)
      } catch (error) {
        throw new Error(`round ${round} differs for:\n${JSON.stringify(source)}\n${(error as Error).message.slice(0, 600)}`)
      }
    }
  }, 300_000)
})

describe('splitBlocks: speed', () => {
  it('cuts a 10,000-line document in tens of milliseconds', () => {
    const source = longDoc('doc-10k')
    splitBlocks(source)
    const started = performance.now()
    const result = splitBlocks(source)
    const elapsed = performance.now() - started
    const slack = Number(process.env.MD_PERF_SLACK ?? 1)
    expect(result.blocks.length).toBeGreaterThan(1000)
    expect(elapsed).toBeLessThan(60 * 3 * slack)
  })
})

void R
