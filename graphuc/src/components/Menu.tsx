/**
 * A dropdown that closes on a command and stays open on a control.
 *
 * Closing on every click inside the popover is the obvious implementation and
 * the wrong one: it makes any control in the menu — a select, a radio, a file
 * input — impossible to use, because pressing it counts as a click and the menu
 * unmounts before the interaction finishes. (That exact bug was reported in the
 * markdown editor's storage picker.) So a `.menu-item` dismisses the menu and
 * anything marked `data-keep-open` does not.
 */

import { useEffect, useRef, useState } from 'react'
import './Menu.css'

interface MenuProps {
  label: string
  badge?: string
  children: React.ReactNode
}

function Menu({ label, badge, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const closeIfCommand = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-keep-open]')) return
    // A file input inside a label is a command, but the dialog it opens is
    // asynchronous — closing now is still right, the picker outlives the menu.
    if (target.closest('.menu-item')) setOpen(false)
  }

  return (
    <div className="menu" ref={ref}>
      <button className={`btn${open ? ' is-active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        {label}
        {badge && <span className="menu-badge">{badge}</span>}
      </button>
      {open && (
        <div className="menu-popover" role="menu" onClick={closeIfCommand}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Menu
