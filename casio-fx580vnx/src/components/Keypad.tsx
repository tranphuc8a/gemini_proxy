/**
 * The keys.
 *
 * Rendering is one loop over the data in `keypad.ts`; the interesting part is
 * `handle`, which is the single place a key press turns into a change. Keeping
 * it in one function is what makes SHIFT and ALPHA behave consistently — they
 * are consumed by whatever the next key does, with no per-key special cases.
 */

import { useEffect } from 'react'

import { ALPHA_KEYS, FUNCTION_ROWS, NUMBER_ROWS, resolveKey, type Key, type KeyAction } from '../keypad'
import { useStore } from '../store'

interface Props {
  onAction: (action: KeyAction) => void
}

export function Keypad({ onAction }: Props) {
  const shift = useStore((state) => state.shift)
  const alpha = useStore((state) => state.alpha)
  const press = useStore((state) => state.press)
  const toggleShift = useStore((state) => state.toggleShift)
  const toggleAlpha = useStore((state) => state.toggleAlpha)
  const backspace = useStore((state) => state.backspace)
  const clearEntry = useStore((state) => state.clearEntry)
  const execute = useStore((state) => state.execute)
  const moveCursor = useStore((state) => state.moveCursor)
  const recallEntry = useStore((state) => state.recallEntry)

  function handle(key: Key) {
    const { insert, action } = resolveKey(key, shift, alpha)
    if (insert !== undefined) {
      press(insert)
      return
    }
    if (action) run(action)
  }

  function run(action: KeyAction) {
    switch (action) {
      case 'equals':
        execute()
        break
      case 'ac':
        clearEntry()
        break
      case 'del':
        backspace()
        break
      case 'shift':
        toggleShift()
        break
      case 'alpha':
        toggleAlpha()
        break
      case 'left':
        moveCursor(-1)
        break
      case 'right':
        moveCursor(1)
        break
      case 'up':
        recallEntry(-1)
        break
      case 'down':
        recallEntry(1)
        break
      default:
        onAction(action)
    }
  }

  // A physical keyboard is faster than clicking, and this app is on a computer.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      // Never steal a keystroke aimed at a panel's own input.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const direct = KEYBOARD[event.key]
      if (direct !== undefined) {
        event.preventDefault()
        press(direct)
        return
      }

      // Letters go in verbatim, so `sin(30)`, `det(MatA)` and `GCD(12,18)` can
      // be typed rather than hunted for on the keypad. The tokenizer already
      // knows which letter runs are functions and which are memories.
      if (event.key.length === 1 && /[A-Za-z]/.test(event.key)) {
        event.preventDefault()
        press(event.key)
        return
      }

      switch (event.key) {
        case 'Enter':
        case '=':
          event.preventDefault()
          execute()
          break
        case 'Backspace':
          event.preventDefault()
          backspace()
          break
        case 'Escape':
          event.preventDefault()
          clearEntry()
          break
        case 'ArrowLeft':
          event.preventDefault()
          moveCursor(-1)
          break
        case 'ArrowRight':
          event.preventDefault()
          moveCursor(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          recallEntry(-1)
          break
        case 'ArrowDown':
          event.preventDefault()
          recallEntry(1)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press, execute, backspace, clearEntry, moveCursor, recallEntry])

  return (
    <div className="keypad">
      <div className="keypad-modifiers">
        <button
          type="button"
          className={`key key-shift${shift ? ' is-armed' : ''}`}
          onClick={toggleShift}
          aria-pressed={shift}
        >
          SHIFT
        </button>
        <button
          type="button"
          className={`key key-alpha${alpha ? ' is-armed' : ''}`}
          onClick={toggleAlpha}
          aria-pressed={alpha}
        >
          ALPHA
        </button>

        <div className="cursor-pad" role="group" aria-label="Di chuyển con trỏ">
          <button type="button" className="key key-arrow up" onClick={() => run('up')} aria-label="Gọi lại phép tính trước">▲</button>
          <button type="button" className="key key-arrow left" onClick={() => run('left')} aria-label="Sang trái">◀</button>
          <button type="button" className="key key-arrow right" onClick={() => run('right')} aria-label="Sang phải">▶</button>
          <button type="button" className="key key-arrow down" onClick={() => run('down')} aria-label="Gọi lại phép tính sau">▼</button>
        </div>

        <button type="button" className="key key-control" onClick={() => onAction('setup')}>SETUP</button>
      </div>

      <div className="keypad-grid">
        {FUNCTION_ROWS.flat().map((key) => (
          <KeyButton key={key.id} item={key} shift={shift} alpha={alpha} onPress={handle} />
        ))}
      </div>

      <div className="keypad-alpha" role="group" aria-label="Biến nhớ">
        {ALPHA_KEYS.map((key) => (
          <KeyButton key={key.id} item={key} shift={false} alpha={false} onPress={handle} compact />
        ))}
      </div>

      <div className="keypad-grid keypad-numbers">
        {NUMBER_ROWS.flat().map((key) => (
          <KeyButton key={key.id} item={key} shift={shift} alpha={alpha} onPress={handle} />
        ))}
      </div>
    </div>
  )
}

interface ButtonProps {
  item: Key
  shift: boolean
  alpha: boolean
  compact?: boolean
  onPress: (key: Key) => void
}

function KeyButton({ item, shift, alpha, compact, onPress }: ButtonProps) {
  // The label changes with the modifier so the key shows what it will do, not
  // what it does by default — the one thing a physical calculator cannot do.
  const active = shift && (item.shiftLabel ?? item.shiftInsert)
    ? item.shiftLabel ?? item.shiftInsert
    : alpha && (item.alphaLabel ?? item.alphaInsert)
      ? item.alphaLabel ?? item.alphaInsert
      : item.label

  return (
    <button
      type="button"
      className={`key key-${item.tone ?? 'function'}${compact ? ' is-compact' : ''}`}
      onClick={() => onPress(item)}
      title={item.title}
    >
      {!compact && (item.shiftLabel || item.alphaLabel) ? (
        <span className="key-secondary">
          {item.shiftLabel ? <span className="key-shift-label">{item.shiftLabel}</span> : <span />}
          {item.alphaLabel ? <span className="key-alpha-label">{item.alphaLabel}</span> : null}
        </span>
      ) : null}
      <span className="key-main">{active}</span>
    </button>
  )
}

/** Characters a physical keyboard can type straight into the entry line. */
const KEYBOARD: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.', ',': ',', '(': '(', ')': ')',
  '+': '+', '-': '-', '*': '×', '/': '÷', '^': '^',
  '!': '!', '%': '%', ':': ':',
}
