import { describe, expect, it } from 'vitest';
import { normalizeMath } from '../mathDelimiters';
import { fixTex } from '../remarkMathPromote';
import { KATEX_MACROS, katexOptions } from '../katexOptions';
import { NORMALIZE_VECTORS, STREAM_ANSWERS, streamPrefixFailure } from './mathVectors';

/**
 * The synced copy of Markdown Editor Pro's maths modules (scripts/sync-math.mjs), run on the same vectors the editor
 * runs (mathVectors.ts is synced too). The editor keeps the timing and randomised tests; here the point is that the
 * copy gemini-chat ships behaves exactly as the source does, and holds up while an answer streams in.
 */
describe('normalizeMath (synced copy): the shared vectors', () => {
  it('has the editor\'s vectors', () => {
    expect(NORMALIZE_VECTORS.length).toBeGreaterThanOrEqual(90);
  });

  it.each(NORMALIZE_VECTORS)('%s', (_name, input, expected, display, generated) => {
    const result = normalizeMath(input);
    expect(result.text).toBe(expected);
    expect(result.text.split('\n').length).toBe(input.split('\n').length);
    if (display) expect([...result.display]).toEqual(display);
    if (generated) expect([...result.generated]).toEqual(generated);
    for (const offset of [...result.display, ...result.generated]) expect(result.text[offset]).toBe('$');
  });
});

describe('normalizeMath (synced copy): streaming', () => {
  it.each(STREAM_ANSWERS)('cut at every character: $name', ({ md }) => {
    for (let cut = 1; cut <= md.length; cut++) {
      const prefix = md.slice(0, cut);
      expect(streamPrefixFailure(prefix, normalizeMath(prefix).text), JSON.stringify(prefix)).toBe('');
    }
    expect(normalizeMath(md).text).not.toMatch(/\\[[(]/);
  });

  it('the check itself is not blind: it fails a rewrite that converts an open \\[', () => {
    expect(streamPrefixFailure('a\n\\[\nx +', 'a\n$$\nx +')).toMatch(/open \\\[/);
    expect(streamPrefixFailure('a \\( x', 'a $ x')).toMatch(/open \\\(/);
    expect(streamPrefixFailure('a\nb', 'a b')).toMatch(/lines/);
  });
});

describe('remarkMathPromote and katexOptions (synced copies)', () => {
  it('maps environments KaTeX lacks and drops \\require', () => {
    expect(fixTex('\\begin{multline}a\\end{multline}')).toBe('\\begin{gather}a\\end{gather}');
    expect(fixTex('\\begin{eqnarray*}a\\end{eqnarray*}')).toBe('\\begin{align*}a\\end{align*}');
    expect(fixTex('\\require{cancel}\\cancel{x}')).toBe('\\cancel{x}');
  });

  it('gives KaTeX fresh macros every time (\\gdef writes into the object it is given)', () => {
    const a = katexOptions();
    const b = katexOptions();
    expect(a.macros).not.toBe(b.macros);
    expect(a.macros).toEqual(KATEX_MACROS);
    expect(a.strict).toBe('ignore');
    expect(Object.isFrozen(KATEX_MACROS)).toBe(true);
  });
});
