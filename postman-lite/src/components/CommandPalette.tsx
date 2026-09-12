import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { fuzzy } from '../lib/util'

export interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

/**
 * Ctrl+K. Everything reachable by clicking is reachable by typing, which is what
 * makes a tool like this fast once you know it.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const open = useStore((s) => s.commandPaletteOpen)
  const setOpen = useStore((s) => s.setCommandPaletteOpen)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    inputRef.current?.focus()
  }, [open])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return commands.slice(0, 40)
    return commands
      .map((command) => {
        const label = command.label.toLowerCase()
        // Prefix beats substring, so "req" surfaces "Request mới" before
        // "Xóa request".
        const score = label.startsWith(term) ? 3 : label.includes(term) ? 2 : fuzzy(label, term) ? 1 : 0
        return { command, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((entry) => entry.command)
  }, [commands, query])

  if (!open) return null

  const choose = (command: Command | undefined) => {
    if (!command) return
    setOpen(false)
    command.run()
  }

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          value={query}
          placeholder="Gõ để tìm lệnh…"
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(matches[index])
            }
          }}
        />
        <div className="palette-list">
          {matches.length ? (
            matches.map((command, i) => (
              <button
                key={command.id}
                className={`palette-item${i === index ? ' active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(command)}
              >
                <span>{command.label}</span>
                {command.hint ? <span className="palette-hint">{command.hint}</span> : null}
              </button>
            ))
          ) : (
            <div className="empty">Không có lệnh nào khớp</div>
          )}
        </div>
      </div>
    </div>
  )
}

