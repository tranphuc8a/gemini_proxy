/**
 * Turning what is on the display into tokens.
 *
 * The input is not plain text: the fx-580VN X shows `√(`, `∫`, `Σ`, `x⁻¹` and
 * fraction boxes, and the keypad enters those as single characters. So the
 * tokenizer works on that character set directly rather than on an ASCII
 * transliteration — which also means the display string and the parser input
 * are the same string, with nothing to keep in sync.
 *
 * The one genuinely awkward part is **implicit multiplication**. `2π`, `3(4)`,
 * `2sin30` and `AB` all mean a product on the real machine, but `sin` is a
 * name, not a variable times a variable, and `Pol(` is a function. That is
 * resolved here, where the token stream still shows what was adjacent to what.
 */

import { MathError } from './value'

export type TokenType =
  | 'number'
  | 'name'      // a function or a constant: sin, log, π, Ran#
  | 'variable'  // A–F, x, y, M
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'end'

export interface Token {
  type: TokenType
  value: string
  /** Where it started, so an error can point at it. */
  at: number
}

/**
 * Multi-character names, longest first.
 *
 * Order matters: `sinh` has to be tried before `sin`, or `sinh(1)` parses as
 * `sin` applied to `h(1)`.
 */
export const FUNCTION_NAMES = [
  'sinh⁻¹', 'cosh⁻¹', 'tanh⁻¹',
  'sin⁻¹', 'cos⁻¹', 'tan⁻¹',
  'sinh', 'cosh', 'tanh',
  'sin', 'cos', 'tan',
  'log', 'ln', 'exp',
  'Pol', 'Rec', 'RanInt', 'Ran#',
  'GCD', 'LCM', 'Int', 'Intg', 'Abs', 'abs',
  'Round', 'Rnd', 'Frac', 'Fix', 'Sci',
  'Arg', 'Conjg', 'Real', 'Imag',
  'det', 'Trn', 'Identity', 'Ref', 'Rref',
  'Mod', 'MOD', 'Rand',
  'Q…r', 'Qr',
  'Σ', '∏', '∫', 'd/dx',
  'max', 'min', 'mean', 'sum',
  'nPr', 'nCr',
  'i',
] as const

/**
 * Names that are written between their arguments, not in front of them.
 *
 * `7 Mod 3` looks like `7` next to a name, which is the shape that normally
 * means multiply — so adjacency has to stay quiet in front of these or the
 * parser is handed `7 × Mod 3`.
 */
export const INFIX_NAMES = new Set(['Mod', 'MOD', 'nPr', 'nCr'])

/** Constants that stand alone. */
export const CONSTANT_NAMES = ['π', 'e', 'i'] as const

const VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z', 'n'] as const

/**
 * Values whose names are longer than one letter.
 *
 * Tried before the function names, because `Ans` would otherwise be read as the
 * variable `A` next to something called `ns`, and `MatA` as `M × a × t × A`.
 */
const NAMED_VALUES = [
  'MatAns', 'MatA', 'MatB', 'MatC', 'MatD',
  'VctAns', 'VctA', 'VctB', 'VctC',
  'PreAns', 'Ans',
] as const

/** Single characters that are operators. `−` and `×` come from the keypad. */
const OPERATORS = new Set([
  '+', '-', '−', '*', '×', '/', '÷', '^', '!', '%',
  '²', '³', '⁻¹', '√', '∛', '°', 'ʳ', 'ᵍ', '<', '>', '=', '≤', '≥', '≠',
  '∠', '→',
])

const SUPERSCRIPTS: Record<string, string> = { '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6' }

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let at = 0

  const previous = () => tokens[tokens.length - 1]

  /**
   * Does a `×` belong between the last token and what comes next?
   *
   * True when the last token can *end* a value (a number, a variable, a closing
   * bracket, a postfix operator) — because then whatever follows starts a new
   * one, and on this machine adjacency means multiply.
   */
  const needsImplicitTimes = (): boolean => {
    const token = previous()
    if (!token) return false
    if (token.type === 'number' || token.type === 'variable' || token.type === 'rparen') return true
    if (token.type === 'name' && (CONSTANT_NAMES as readonly string[]).includes(token.value)) return true
    if (token.type === 'operator' && ['!', '²', '³', '⁻¹', '°', '%'].includes(token.value)) return true
    return false
  }

  /**
   * `·` rather than `×`, so the parser can tell the two apart.
   *
   * On this machine `1÷2π` is `1÷(2π)`: a multiplication you did not type binds
   * tighter than one you did. That is only expressible if the token records
   * which kind it is.
   */
  const pushImplicitTimes = () => {
    if (needsImplicitTimes()) tokens.push({ type: 'operator', value: '·', at })
  }

  while (at < source.length) {
    const char = source[at]

    if (char === ' ') {
      at++
      continue
    }

    // --- numbers ---------------------------------------------------------
    if (/[0-9.]/.test(char)) {
      const start = at
      while (at < source.length && /[0-9.]/.test(source[at])) at++
      // An exponent written with the machine's ×10ˣ key arrives as `E`.
      if (source[at] === 'E' && /[0-9+-]/.test(source[at + 1] ?? '')) {
        at++
        if (/[+-]/.test(source[at])) at++
        while (at < source.length && /[0-9]/.test(source[at])) at++
      }
      pushImplicitTimes()
      tokens.push({ type: 'number', value: source.slice(start, at), at: start })
      continue
    }

    // --- superscript powers ----------------------------------------------
    if (SUPERSCRIPTS[char]) {
      tokens.push({ type: 'operator', value: '^', at })
      tokens.push({ type: 'number', value: SUPERSCRIPTS[char], at })
      at++
      continue
    }

    // --- the reciprocal key sends two characters --------------------------
    if (source.startsWith('⁻¹', at)) {
      tokens.push({ type: 'operator', value: '⁻¹', at })
      at += 2
      continue
    }

    // --- named values -----------------------------------------------------
    const named = NAMED_VALUES.find((candidate) => source.startsWith(candidate, at))
    if (named) {
      pushImplicitTimes()
      tokens.push({ type: 'variable', value: named, at })
      at += named.length
      continue
    }

    // --- names ------------------------------------------------------------
    const name = FUNCTION_NAMES.find((candidate) => source.startsWith(candidate, at))
    if (name) {
      if (!INFIX_NAMES.has(name)) pushImplicitTimes()
      tokens.push({ type: 'name', value: name, at })
      at += name.length
      continue
    }

    if (char === 'π' || char === 'e') {
      pushImplicitTimes()
      tokens.push({ type: 'name', value: char, at })
      at++
      continue
    }

    if ((VARIABLE_NAMES as readonly string[]).includes(char)) {
      pushImplicitTimes()
      tokens.push({ type: 'variable', value: char, at })
      at++
      continue
    }

    // --- brackets ---------------------------------------------------------
    if (char === '(') {
      pushImplicitTimes()
      tokens.push({ type: 'lparen', value: '(', at })
      at++
      continue
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: ')', at })
      at++
      continue
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: ',', at })
      at++
      continue
    }

    // --- operators ---------------------------------------------------------
    if (OPERATORS.has(char)) {
      // A root sits where a value goes, so `2√3` is a product like `2π`.
      if (char === '√' || char === '∛') pushImplicitTimes()
      tokens.push({ type: 'operator', value: char, at })
      at++
      continue
    }

    throw new MathError(`Syntax ERROR: ký tự không hợp lệ “${char}”`)
  }

  tokens.push({ type: 'end', value: '', at })
  return tokens
}
