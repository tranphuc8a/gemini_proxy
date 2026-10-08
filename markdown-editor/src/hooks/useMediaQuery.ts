import { useCallback, useSyncExternalStore } from 'react'

/** False wherever matchMedia is missing or rejects the query (old engines, jsdom). */
export function matchesMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia(query)?.matches === true
  } catch {
    return false
  }
}

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const list = window.matchMedia(query)
  if (typeof list?.addEventListener === 'function') {
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }
  // Safari before 14 only has the deprecated listener API.
  if (typeof list?.addListener === 'function') {
    list.addListener(onChange)
    return () => list.removeListener(onChange)
  }
  return () => undefined
}

/** Live result of a media query, read synchronously so the first paint is already right. */
export function useMediaQuery(query: string): boolean {
  const subscribeToQuery = useCallback((onChange: () => void) => subscribe(query, onChange), [query])
  return useSyncExternalStore(
    subscribeToQuery,
    () => matchesMedia(query),
    () => false
  )
}
