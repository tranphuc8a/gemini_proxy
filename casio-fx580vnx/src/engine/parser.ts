/**
 * Tokens to a syntax tree.
 *
 * A precedence-climbing (Pratt) parser, because this grammar is mostly about
 * precedence and the fx-580VN X has some unusual rules:
 *
 *   - `−2²` is −4: the power binds tighter than unary minus, as in mathematics.
 *   - `2^3^2` is 2^(3^2) = 512: exponentiation is right-associative.
 *   - `sin 30` needs no brackets, but `sin 30 + 1` is `sin(30) + 1` — a bare
 *     function argument binds tighter than `+` and looser than `^`.
 *   - `1/2π` is 1/(2π) on this machine: implicit multiplication binds tighter
 *     than division. The tokenizer inserts an explicit `×` for it, and that
 *     token carries a higher precedence than a typed one.
 *
 * Each of those is a line below rather than a comment, so the behaviour can be
 * tested rather than argued about.
 */

import { MathError } from './value'
import { tokenize, type Token } from './tokens'

export type Node =
  | { type: 'number'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'constant'; name: string }
  | { type: 'unary'; op: string; operand: Node }
  | { type: 'postfix'; op: string; operand: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] }

/**
 * Binding power of each infix operator.
 *
 * `·` is the multiplication the tokenizer inserts for adjacency. It sits above
 * `÷` so `1÷2π` reads as `1÷(2π)` — what the machine does, and what anyone
 * writing `1/2π` on paper means.
 */
const INFIX: Record<string, { power: number; rightAssociative?: boolean }> = {
  '=': { power: 1 },
  '<': { power: 2 },
  '>': { power: 2 },
  '≤': { power: 2 },
  '≥': { power: 2 },
  '≠': { power: 2 },
  '+': { power: 10 },
  '-': { power: 10 },
  '−': { power: 10 },
  '×': { power: 20 },
  '*': { power: 20 },
  '÷': { power: 20 },
  '/': { power: 20 },
  'Mod': { power: 20 },
  '·': { power: 25 },  // implicit multiplication, inserted by the tokenizer
  'nPr': { power: 30 },
  'nCr': { power: 30 },
  '∠': { power: 35 },
  '^': { power: 40, rightAssociative: true },
}

/** Unary minus sits below `^`, so `-2²` is `-(2²)`. */
const UNARY_POWER = 15

/**
 * A function called without brackets takes everything up to the next `+`/`−`.
 * `sin 2×3` is `sin(2×3)`, `sin 2+3` is `sin(2)+3` — the machine's own rule.
 */
const BARE_ARGUMENT_POWER = 15

/** Functions that always take a bracketed, comma-separated argument list. */
const MULTI_ARG = new Set([
  'Pol', 'Rec', 'RanInt', 'GCD', 'LCM', 'Mod', 'MOD', 'Round', 'Σ', '∏', '∫', 'd/dx',
  'max', 'min', 'mean', 'sum', 'Identity', 'nPr', 'nCr',
])

/** Names that are values, not functions. */
const CONSTANTS = new Set(['π', 'e', 'i', 'Ran#'])

export function parse(source: string): Node {
  const tokens = tokenize(source)
  let position = 0

  const peek = (): Token => tokens[position]
  const next = (): Token => tokens[position++]

  const expect = (type: Token['type'], value?: string): Token => {
    const token = peek()
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new MathError(`Syntax ERROR: thiếu “${value ?? type}”`)
    }
    return next()
  }

  /** The `×` the tokenizer inserted binds tighter than the one you type. */
  const infixPower = (token: Token): number | null => {
    if (token.type === 'operator') {
      const entry = INFIX[token.value]
      return entry ? entry.power : null
    }
    // `Mod`, `nPr` and `nCr` are written as names but behave as infix.
    if (token.type === 'name' && INFIX[token.value]) return INFIX[token.value].power
    return null
  }

  function parsePrimary(): Node {
    const token = next()

    switch (token.type) {
      case 'number':
        return { type: 'number', value: token.value }

      case 'variable':
        return { type: 'variable', name: token.value }

      case 'lparen': {
        const inner = parseExpression(0)
        expect('rparen')
        return inner
      }

      case 'name': {
        if (CONSTANTS.has(token.value)) return { type: 'constant', name: token.value }

        if (peek().type === 'lparen') {
          next()
          const args: Node[] = []
          if (peek().type !== 'rparen') {
            args.push(parseExpression(0))
            while (peek().type === 'comma') {
              next()
              args.push(parseExpression(0))
            }
          }
          expect('rparen')
          return { type: 'call', name: token.value, args }
        }

        if (MULTI_ARG.has(token.value)) {
          throw new MathError(`Syntax ERROR: ${token.value} cần dấu ngoặc`)
        }
        // `sin 30`, `ln 2`, `√9` with no brackets.
        return { type: 'call', name: token.value, args: [parseExpression(BARE_ARGUMENT_POWER)] }
      }

      case 'operator': {
        if (token.value === '-' || token.value === '−') {
          return { type: 'unary', op: '-', operand: parseExpression(UNARY_POWER) }
        }
        if (token.value === '+') return parseExpression(UNARY_POWER)
        if (token.value === '√' || token.value === '∛') {
          return { type: 'call', name: token.value, args: [parseExpression(BARE_ARGUMENT_POWER)] }
        }
        throw new MathError(`Syntax ERROR: toán tử “${token.value}” đứng sai chỗ`)
      }

      default:
        throw new MathError('Syntax ERROR: biểu thức chưa hoàn chỉnh')
    }
  }

  /**
   * Postfix operators bind tighter than anything: `5!²` is `(5!)²`.
   *
   * `²` and `³` are absent on purpose — the tokenizer rewrites them to `^2` and
   * `^3`, so they arrive as infix and never reach here.
   */
  function parsePostfix(left: Node): Node {
    for (;;) {
      const token = peek()
      if (token.type !== 'operator') return left
      if (!['!', '⁻¹', '°', 'ʳ', 'ᵍ', '%'].includes(token.value)) return left
      next()
      left = { type: 'postfix', op: token.value, operand: left }
    }
  }

  function parseExpression(minimumPower: number): Node {
    let left = parsePostfix(parsePrimary())

    for (;;) {
      const token = peek()
      const power = infixPower(token)
      if (power === null || power < minimumPower) return left

      next()
      const entry = INFIX[token.value]
      const nextMinimum = entry.rightAssociative ? power : power + 1
      const right = parsePostfix(parseExpression(nextMinimum))
      left = parsePostfix({ type: 'binary', op: token.value, left, right })
    }
  }

  const tree = parseExpression(0)
  if (peek().type !== 'end') {
    throw new MathError(`Syntax ERROR: thừa “${peek().value}”`)
  }
  return tree
}
