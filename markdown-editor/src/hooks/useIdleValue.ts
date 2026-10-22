import { useEffect, useState } from 'react'

/**
 * `value`, held back until it has stopped changing for `delayMs`.
 *
 * For derived views that scan the whole document -- word counts, the outline,
 * search matches -- which cost tens of milliseconds on a long file and need
 * not follow every keystroke. The first render already has the real value, so
 * nothing starts out stale; only a burst of changes is collapsed into one.
 */
export function useIdleValue<T>(value: T, delayMs = 400): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    if (Object.is(value, settled)) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, settled, delayMs])

  return settled
}
