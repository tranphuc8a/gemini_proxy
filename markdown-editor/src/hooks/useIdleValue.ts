import { useEffect, useState } from 'react'

/**
 * `value`, held back until it has stopped changing for `delayMs`.
 *
 * For derived views that scan the whole document -- word counts, the outline,
 * search matches -- which cost tens of milliseconds on a long file and need
 * not follow every keystroke. The first render already has the real value, so
 * nothing starts out stale; only a burst of changes is collapsed into one.
 *
 * `resetKey` names what the value belongs to (the open file): when it changes
 * the new value is returned at once, so a view never shows -- or offers to
 * jump to -- the previous document's headings or counts.
 */
export function useIdleValue<T>(value: T, delayMs = 400, resetKey?: unknown): T {
  const [settled, setSettled] = useState(value)
  const [key, setKey] = useState(resetKey)

  let current = settled
  if (!Object.is(key, resetKey)) {
    // Adjusting state while rendering: React re-renders before committing, so the stale value never paints.
    setKey(resetKey)
    setSettled(value)
    current = value
  }

  useEffect(() => {
    if (Object.is(value, current)) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, current, delayMs])

  return current
}
