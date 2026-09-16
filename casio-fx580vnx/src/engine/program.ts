/**
 * Multi-statement entry — the closest thing the fx-580VN X has to programming.
 *
 * Two features, and they compose:
 *
 *   `3→A`      store a value in a memory
 *   `A:B:A+B`  several statements in one line, separated by colons
 *
 * The machine shows each statement's result in turn and pauses; here the whole
 * line runs and every intermediate result is returned, which is the same
 * information without the waiting.
 *
 * A line with no `→` and no `:` is just an expression, so this is safe to route
 * every entry through.
 */

import { evaluate, type Context } from './evaluate'
import { tokenize } from './tokens'
import { MathError, type Value } from './value'

export interface Step {
  source: string
  value: Value
  /** The memory this step wrote to, if it was an assignment. */
  storedIn?: string
}

export interface ProgramResult {
  steps: Step[]
  /** What the display ends up showing: the last statement's value. */
  value: Value
}

/** Memories that can appear on the right of `→`. */
const STORABLE = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z', 'n',
  'MatA', 'MatB', 'MatC', 'MatD',
  'VctA', 'VctB', 'VctC',
])

/** Split on a character, ignoring any inside brackets. */
export function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === separator && depth === 0) {
      parts.push(source.slice(start, i))
      start = i + 1
    }
  }
  parts.push(source.slice(start))
  return parts
}

export function run(source: string, context: Context): ProgramResult {
  const statements = splitTopLevel(source, ':')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (statements.length === 0) throw new MathError('Syntax ERROR: chưa nhập gì')

  const steps: Step[] = []
  for (const statement of statements) {
    steps.push(runStatement(statement, context))
  }

  const value = steps[steps.length - 1].value
  // `Ans` is whatever the display last showed, and it survives into the next
  // entry — which is the whole point of the key.
  context.variables.PreAns = context.variables.Ans ?? value
  context.variables.Ans = value
  return { steps, value }
}

function runStatement(statement: string, context: Context): Step {
  const arrow = splitTopLevel(statement, '→')
  if (arrow.length === 1) {
    return { source: statement, value: evaluate(statement, context) }
  }

  if (arrow.length > 2) throw new MathError('Syntax ERROR: chỉ gán được một lần')
  const [expression, target] = arrow.map((part) => part.trim())
  if (!STORABLE.has(target)) {
    throw new MathError(`Syntax ERROR: không gán được vào “${target}”`)
  }

  const value = evaluate(expression, context)
  if (target.startsWith('Mat') || target.startsWith('Vct')) {
    if (value.kind !== 'matrix' && value.kind !== 'vector') {
      throw new MathError(`Dimension ERROR: ${target} cần ma trận`)
    }
    if (value.kind === 'matrix') context.matrices[target] = value
  } else {
    context.variables[target] = value
  }

  return { source: statement, value, storedIn: target }
}

/**
 * The CALC key: one stored formula, evaluated over and over with new values.
 *
 * The bindings are applied to a copy of the context, so running a formula does
 * not quietly overwrite the memories the user is holding elsewhere.
 */
export function calculate(
  formula: string,
  bindings: Record<string, Value>,
  context: Context,
): Value {
  const scoped: Context = {
    ...context,
    variables: { ...context.variables, ...bindings },
    matrices: { ...context.matrices },
  }
  return run(formula, scoped).value
}

/**
 * Which memories a formula reads, so CALC can ask for exactly those.
 *
 * Tokenized rather than scanned for letters: `sin` and `ln` both contain an
 * `n`, and `Ans` starts with an `A`, so a substring search asks the user for
 * memories the formula never mentions.
 */
export function variablesUsed(formula: string): string[] {
  const found: string[] = []
  for (const token of tokenize(formula)) {
    if (token.type !== 'variable') continue
    // `Ans` already holds a value; there is nothing to ask for.
    if (token.value === 'Ans' || token.value === 'PreAns') continue
    if (!found.includes(token.value)) found.push(token.value)
  }
  return found
}
