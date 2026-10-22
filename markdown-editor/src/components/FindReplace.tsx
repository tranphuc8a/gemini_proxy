import { useEffect, useMemo, useRef, useState } from 'react'
import { findMatches, type SearchMatch, type SearchOptions } from '../lib/markdown'
import { useIdleValue } from '../hooks/useIdleValue'
import { IconChevron, IconClose } from './Icons'
import './FindReplace.css'

interface FindReplaceProps {
  value: string
  showReplace: boolean
  canEdit: boolean
  onClose: () => void
  onSelectMatch: (match: SearchMatch) => void
  onReplace: (match: SearchMatch, replacement: string) => void
  onReplaceAll: (matches: SearchMatch[], replacement: string) => void
}

function FindReplace({ value, showReplace, canEdit, onClose, onSelectMatch, onReplace, onReplaceAll }: FindReplaceProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false })
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Searching the whole document on every keystroke in the editor is wasted work; the count follows once
  // typing pauses. Anything that acts on a match (`current()`) re-searches the live text, never stale offsets.
  const settled = useIdleValue(value, 150)
  const matches = useMemo(() => findMatches(settled, query, options), [settled, query, options])
  const current = () => (settled === value ? matches : findMatches(value, query, options))

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [showReplace])

  // Keep the cursor inside the result set as the document or query changes.
  useEffect(() => {
    setIndex((current) => (matches.length === 0 ? 0 : Math.min(current, matches.length - 1)))
  }, [matches.length])

  const go = (delta: number) => {
    const live = current()
    if (live.length === 0) return
    const next = (Math.min(index, live.length - 1) + delta + live.length) % live.length
    setIndex(next)
    onSelectMatch(live[next])
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      go(event.shiftKey ? -1 : 1)
    }
  }

  const toggle = (key: keyof SearchOptions) => setOptions((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className="find-bar" role="search" onKeyDown={onKeyDown}>
      <div className="find-row">
        <div className="find-field">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find"
            aria-label="Find"
            spellCheck={false}
          />
          <div className="find-flags">
            <button
              type="button"
              className={`find-flag${options.caseSensitive ? ' is-active' : ''}`}
              onClick={() => toggle('caseSensitive')}
              title="Match case"
              aria-label="Match case"
              aria-pressed={options.caseSensitive}
            >
              Aa
            </button>
            <button
              type="button"
              className={`find-flag${options.wholeWord ? ' is-active' : ''}`}
              onClick={() => toggle('wholeWord')}
              title="Match whole word"
              aria-label="Match whole word"
              aria-pressed={options.wholeWord}
            >
              ab
            </button>
            <button
              type="button"
              className={`find-flag${options.regex ? ' is-active' : ''}`}
              onClick={() => toggle('regex')}
              title="Use a regular expression"
              aria-label="Use a regular expression"
              aria-pressed={options.regex}
            >
              .*
            </button>
          </div>
        </div>

        <span className="find-count" aria-live="polite">
          {query ? (matches.length ? `${index + 1} of ${matches.length}` : 'No results') : ''}
        </span>

        <button type="button" className="btn btn-icon" onClick={() => go(-1)} disabled={!matches.length} title="Previous (Shift+Enter)" aria-label="Previous match">
          <IconChevron className="rotate-up" />
        </button>
        <button type="button" className="btn btn-icon" onClick={() => go(1)} disabled={!matches.length} title="Next (Enter)" aria-label="Next match">
          <IconChevron className="rotate-down" />
        </button>
        <button type="button" className="btn btn-icon" onClick={onClose} title="Close (Esc)" aria-label="Close find">
          <IconClose />
        </button>
      </div>

      {showReplace && (
        <div className="find-row">
          <div className="find-field">
            <input
              type="text"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replace with"
              aria-label="Replace with"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!canEdit || !matches.length}
            onClick={() => {
              const live = current()
              if (!live.length) return
              const at = Math.min(index, live.length - 1)
              onReplace(live[at], replacement)
              setIndex(at >= live.length - 1 ? 0 : at)
            }}
          >
            Replace
          </button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!canEdit || !matches.length}
            onClick={() => {
              const live = current()
              if (live.length) onReplaceAll(live, replacement)
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  )
}

export default FindReplace
