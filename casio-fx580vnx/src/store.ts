/**
 * Everything the calculator remembers.
 *
 * Modelled on the machine rather than on a web app: there is one entry line, a
 * cursor in it, a history, and a set of memories that outlive any particular
 * calculation. Modes (COMP, CMPLX, MATRIX, …) change what the keys mean and
 * which workspace is shown, but they share the memories — switching to STAT and
 * back does not lose what is in A.
 *
 * The engine is kept out of here except at the two points where a key press
 * actually computes something, so the maths stays testable without a store.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { emptyContext, type AngleMode, type Context } from './engine/evaluate'
import { formatValue, type FormatOptions } from './engine/format'
import { run } from './engine/program'
import { addValues } from './engine/evaluate'
import { MathError, ZERO, neg, type Value } from './engine/value'

export type Mode =
  | 'comp'    // ordinary calculation
  | 'complex' // CMPLX
  | 'base'    // BASE-N
  | 'matrix'  // MATRIX
  | 'vector'  // VECTOR
  | 'stat'    // STAT
  | 'table'   // TABLE
  | 'equation' // EQN
  | 'ratio'   // RATIO

export type DisplayFormat = 'norm' | 'fix' | 'sci'

export interface HistoryEntry {
  id: number
  input: string
  /**
   * The answer itself, not its rendering.
   *
   * Kept as a value so changing Fix/Sci in SETUP re-renders the whole history
   * rather than leaving old rows in the old notation.
   */
  value: Value | null
  error: string | null
  /** Which of the available forms is showing, for S⇔D. */
  form: number
}

export interface StatRow {
  x: string
  y: string
  freq: string
}

interface State {
  mode: Mode
  angle: AngleMode
  format: DisplayFormat
  /** Decimal places for FIX, significant digits for SCI. */
  digits: number
  /** Base-N radix: 2, 8, 10 or 16. */
  radix: number

  entry: string
  cursor: number
  /** SHIFT and ALPHA are one-shot, exactly as on the machine. */
  shift: boolean
  alpha: boolean
  /** True while a result is showing, so the next digit starts a new entry. */
  settled: boolean

  history: HistoryEntry[]
  /** Which history entry the ▲/▼ keys are pointing at, or null for the live line. */
  recall: number | null

  /** The engine context: memories, matrices, statistics. */
  context: Context
  /** A redraw counter, because the context is mutated in place by the engine. */
  revision: number

  statRows: StatRow[]
  /** Whether the STAT editor shows a y column, a frequency column, or both. */
  statColumns: { y: boolean; freq: boolean }

  error: string | null
}

interface Actions {
  setMode: (mode: Mode) => void
  setAngle: (angle: AngleMode) => void
  setFormat: (format: DisplayFormat, digits?: number) => void
  setRadix: (radix: number) => void

  press: (text: string) => void
  setEntry: (entry: string, cursor?: number) => void
  moveCursor: (delta: number) => void
  setCursor: (cursor: number) => void
  backspace: () => void
  clearEntry: () => void
  clearAll: () => void
  toggleShift: () => void
  toggleAlpha: () => void

  execute: () => void
  cycleForm: (id: number) => void
  recallEntry: (delta: number) => void
  reuseEntry: (id: number) => void
  clearHistory: () => void

  store: (name: string, value: Value) => void
  memoryAdd: (sign: 1 | -1) => void
  clearMemories: () => void

  setStatRows: (rows: StatRow[]) => void
  setStatColumns: (columns: { y: boolean; freq: boolean }) => void

  setMatrix: (name: string, value: Value) => void
}

let nextId = 1

/**
 * A fresh context with the memories carried over.
 *
 * Needed because `emptyContext` also resets matrices and statistics, and
 * clearing a memory should not wipe MatA.
 */
function contextWith(angle: AngleMode): Context {
  const context = emptyContext()
  context.angle = angle
  return context
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      mode: 'comp',
      angle: 'deg',
      format: 'norm',
      digits: 3,
      radix: 10,

      entry: '',
      cursor: 0,
      shift: false,
      alpha: false,
      settled: false,

      history: [],
      recall: null,

      context: contextWith('deg'),
      revision: 0,

      statRows: [{ x: '', y: '', freq: '1' }],
      statColumns: { y: false, freq: false },

      error: null,

      setMode: (mode) =>
        set((state) => {
          // Switching mode clears the entry line on the real machine, and
          // keeping a half-typed CMPLX expression around in BASE-N would only
          // produce a Syntax ERROR the user did not ask for.
          state.context.angle = state.angle
          return { mode, entry: '', cursor: 0, error: null, settled: false, shift: false, alpha: false }
        }),

      setAngle: (angle) =>
        set((state) => {
          state.context.angle = angle
          return { angle, revision: state.revision + 1 }
        }),

      setFormat: (format, digits) => set((state) => ({ format, digits: digits ?? state.digits })),
      setRadix: (radix) => set({ radix }),

      press: (text) =>
        set((state) => {
          // A digit typed while a result is showing starts fresh; an operator
          // continues from the answer, which is what `Ans` is for.
          const continuing = state.settled && /^[-+×÷^]|^Mod|^nPr|^nCr/.test(text)
          const base = state.settled ? (continuing ? 'Ans' : '') : state.entry
          const at = state.settled ? base.length : state.cursor
          const entry = base.slice(0, at) + text + base.slice(at)
          return {
            entry,
            cursor: at + text.length,
            shift: false,
            alpha: false,
            settled: false,
            error: null,
            recall: null,
          }
        }),

      setEntry: (entry, cursor) =>
        set({ entry, cursor: cursor ?? entry.length, settled: false, error: null }),

      moveCursor: (delta) =>
        set((state) => ({
          cursor: Math.max(0, Math.min(state.entry.length, state.cursor + delta)),
          settled: false,
        })),

      setCursor: (cursor) =>
        set((state) => ({ cursor: Math.max(0, Math.min(state.entry.length, cursor)) })),

      backspace: () =>
        set((state) => {
          if (state.settled) return { settled: false, error: null }
          if (state.cursor === 0) return {}
          // Delete the whole token, not one character: `sin(` goes in with one
          // key, so it should come out with one.
          const removed = tokenBefore(state.entry, state.cursor)
          return {
            entry: state.entry.slice(0, state.cursor - removed) + state.entry.slice(state.cursor),
            cursor: state.cursor - removed,
            error: null,
          }
        }),

      clearEntry: () => set({ entry: '', cursor: 0, error: null, settled: false }),

      clearAll: () =>
        set((state) => ({
          entry: '',
          cursor: 0,
          error: null,
          settled: false,
          history: [],
          recall: null,
          context: contextWith(state.angle),
          revision: state.revision + 1,
        })),

      toggleShift: () => set((state) => ({ shift: !state.shift, alpha: false })),
      toggleAlpha: () => set((state) => ({ alpha: !state.alpha, shift: false })),

      execute: () => {
        const state = get()
        const source = state.entry.trim()
        if (!source) return

        const entry: HistoryEntry = { id: nextId++, input: source, value: null, error: null, form: 0 }
        try {
          entry.value = run(source, state.context).value
        } catch (error) {
          entry.error = error instanceof MathError ? error.message : String(error)
        }

        set((current) => ({
          history: [...current.history, entry].slice(-100),
          settled: entry.error === null,
          error: entry.error,
          recall: null,
          revision: current.revision + 1,
          shift: false,
          alpha: false,
        }))
      },

      cycleForm: (id) =>
        set((state) => ({
          history: state.history.map((item) => {
            if (item.id !== id || !item.value) return item
            const count = formatValue(item.value, displayOptions(state)).forms.length
            return { ...item, form: (item.form + 1) % count }
          }),
        })),

      recallEntry: (delta) =>
        set((state) => {
          if (state.history.length === 0) return {}
          const at = state.recall ?? state.history.length
          const next = Math.max(0, Math.min(state.history.length - 1, at + delta))
          const item = state.history[next]
          return { recall: next, entry: item.input, cursor: item.input.length, settled: false }
        }),

      reuseEntry: (id) =>
        set((state) => {
          const item = state.history.find((entry) => entry.id === id)
          if (!item) return {}
          return { entry: item.input, cursor: item.input.length, settled: false, error: null }
        }),

      clearHistory: () => set({ history: [], recall: null }),

      store: (name, value) =>
        set((state) => {
          state.context.variables[name] = value
          return { revision: state.revision + 1 }
        }),

      memoryAdd: (sign) =>
        set((state) => {
          // M+ adds what the display is showing to M; with nothing showing
          // there is nothing to add, so the key is simply inert.
          const last = state.history[state.history.length - 1]
          if (!last?.value) return {}
          const current = state.context.variables.M ?? ZERO
          const addend = sign === 1 ? last.value : applyUnary(last.value)
          try {
            state.context.variables.M = addValues(current, addend)
          } catch {
            return { error: 'Math ERROR: không cộng được vào M' }
          }
          return { revision: state.revision + 1 }
        }),

      clearMemories: () =>
        set((state) => {
          state.context.variables = {}
          return { revision: state.revision + 1 }
        }),

      setStatRows: (statRows) => set({ statRows }),
      setStatColumns: (statColumns) => set({ statColumns }),

      setMatrix: (name, value) =>
        set((state) => {
          if (value.kind === 'matrix') state.context.matrices[name] = value
          return { revision: state.revision + 1 }
        }),
    }),
    {
      name: 'casio-fx580vnx',
      // The context holds BigInts, which JSON cannot carry, and the history
      // holds rendered strings that are cheap to keep. So only the settings and
      // the typed text are persisted; the memories reset with the page, as they
      // do when the machine's battery is pulled.
      partialize: (state) => ({
        mode: state.mode,
        angle: state.angle,
        format: state.format,
        digits: state.digits,
        radix: state.radix,
        entry: state.entry,
        statRows: state.statRows,
        statColumns: state.statColumns,
      }),
    },
  ),
)

/** Negate any value kind, for M−. */
function applyUnary(value: Value): Value {
  if (value.kind === 'real') return neg(value)
  if (value.kind === 'complex') return { ...value, re: neg(value.re), im: neg(value.im) }
  if (value.kind === 'matrix') return { ...value, cells: value.cells.map(neg) }
  return { ...value, cells: value.cells.map(neg) }
}

/** The SETUP choices, in the shape the formatter wants. */
export function displayOptions(state: Pick<State, 'format' | 'digits'>): FormatOptions {
  return state.format === 'norm' ? {} : { notation: state.format, digits: state.digits }
}

/**
 * How many characters the backspace key should remove.
 *
 * One key press put `sin(` in; one should take it out. Anything not recognised
 * falls back to a single character.
 */
const MULTI_CHARACTER_TOKENS = [
  'sinh⁻¹', 'cosh⁻¹', 'tanh⁻¹', 'sin⁻¹', 'cos⁻¹', 'tan⁻¹',
  'RanInt(', 'Identity(', 'Round(', 'Conjg(', 'MatAns', 'PreAns',
  'sinh(', 'cosh(', 'tanh(', 'sin(', 'cos(', 'tan(',
  'log(', 'ln(', 'GCD(', 'LCM(', 'Pol(', 'Rec(', 'Arg(', 'Abs(',
  'det(', 'Trn(', 'Int(', 'Intg(', 'Frac(', 'Ran#',
  'MatA', 'MatB', 'MatC', 'MatD', 'VctA', 'VctB', 'VctC',
  'd/dx(', 'Mod', 'nPr', 'nCr', 'Ans', '⁻¹', '×10^',
]

export function tokenBefore(entry: string, cursor: number): number {
  const before = entry.slice(0, cursor)
  const match = MULTI_CHARACTER_TOKENS.find((token) => before.endsWith(token))
  return match ? match.length : 1
}
