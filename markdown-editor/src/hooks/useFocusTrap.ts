import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/** Tabbable descendants, in document order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest('[hidden], [inert], [aria-hidden="true"]')
  )
}

/**
 * Keeps Tab inside `ref` while `active`, and hands focus back to whatever had
 * it before once the trap is released -- the standard modal-dialog contract.
 *
 * `initialFocus` picks where focus lands; by default it is the container
 * itself, which must then carry tabIndex={-1}. Focusing a text field instead
 * would raise the on-screen keyboard on a phone, which nobody asked for.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, initialFocus?: () => HTMLElement | null) {
  // Held in a ref so an inline callback does not re-run the effect every render.
  const initialRef = useRef(initialFocus)
  initialRef.current = initialFocus

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const target = initialRef.current?.() ?? container
    target.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusableWithin(container)
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      const outside = !container.contains(current) || current === container
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || (outside && current !== container))) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [active, ref])
}
