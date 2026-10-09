import { useEffect, useRef, useState } from 'react'
import {
  IconBold,
  IconCode,
  IconHeading,
  IconImage,
  IconItalic,
  IconLink,
  IconList,
  IconOrderedList,
  IconQuote,
  IconRule,
  IconSparkles,
  IconStrike,
  IconTable,
  IconTask
} from './Icons'
import './FormatToolbar.css'

export type FormatAction =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'strike' }
  | { kind: 'inlineCode' }
  | { kind: 'codeBlock' }
  | { kind: 'heading'; level: number }
  | { kind: 'quote' }
  | { kind: 'bullet' }
  | { kind: 'ordered' }
  | { kind: 'task' }
  | { kind: 'link' }
  | { kind: 'image' }
  | { kind: 'table' }
  | { kind: 'rule' }
  | { kind: 'smartFormat' }

interface FormatToolbarProps {
  disabled: boolean
  onAction: (action: FormatAction) => void
}

function FormatToolbar({ disabled, onAction }: FormatToolbarProps) {
  return (
    <div className="format-toolbar" role="toolbar" aria-label="Formatting">
      <HeadingMenu disabled={disabled} onPick={(level) => onAction({ kind: 'heading', level })} />

      <span className="toolbar-separator" />

      <ToolbarButton label="Bold" shortcut="Ctrl+B" disabled={disabled} onClick={() => onAction({ kind: 'bold' })}>
        <IconBold />
      </ToolbarButton>
      <ToolbarButton label="Italic" shortcut="Ctrl+I" disabled={disabled} onClick={() => onAction({ kind: 'italic' })}>
        <IconItalic />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" shortcut="Ctrl+Shift+X" disabled={disabled} onClick={() => onAction({ kind: 'strike' })}>
        <IconStrike />
      </ToolbarButton>
      <ToolbarButton label="Inline code" shortcut="Ctrl+E" disabled={disabled} onClick={() => onAction({ kind: 'inlineCode' })}>
        <IconCode />
      </ToolbarButton>

      <span className="toolbar-separator" />

      <ToolbarButton label="Bullet list" shortcut="Ctrl+Shift+8" disabled={disabled} onClick={() => onAction({ kind: 'bullet' })}>
        <IconList />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" shortcut="Ctrl+Shift+7" disabled={disabled} onClick={() => onAction({ kind: 'ordered' })}>
        <IconOrderedList />
      </ToolbarButton>
      <ToolbarButton label="Task list" shortcut="Ctrl+Shift+9" disabled={disabled} onClick={() => onAction({ kind: 'task' })}>
        <IconTask />
      </ToolbarButton>
      <ToolbarButton label="Quote" shortcut="Ctrl+Shift+Q" disabled={disabled} onClick={() => onAction({ kind: 'quote' })}>
        <IconQuote />
      </ToolbarButton>

      <span className="toolbar-separator" />

      <ToolbarButton label="Link" shortcut="Ctrl+K" disabled={disabled} onClick={() => onAction({ kind: 'link' })}>
        <IconLink />
      </ToolbarButton>
      <ToolbarButton label="Image" shortcut="Ctrl+Shift+I" disabled={disabled} onClick={() => onAction({ kind: 'image' })}>
        <IconImage />
      </ToolbarButton>
      <ToolbarButton label="Table" disabled={disabled} onClick={() => onAction({ kind: 'table' })}>
        <IconTable />
      </ToolbarButton>
      <ToolbarButton label="Code block" shortcut="Ctrl+Shift+C" disabled={disabled} onClick={() => onAction({ kind: 'codeBlock' })}>
        <span className="toolbar-glyph">{'{ }'}</span>
      </ToolbarButton>
      <ToolbarButton label="Horizontal rule" disabled={disabled} onClick={() => onAction({ kind: 'rule' })}>
        <IconRule />
      </ToolbarButton>

      <span className="toolbar-separator" />

      <ToolbarButton label="Smart format with AI" disabled={disabled} onClick={() => onAction({ kind: 'smartFormat' })}>
        <IconSparkles />
      </ToolbarButton>
    </div>
  )
}

interface ToolbarButtonProps {
  label: string
  shortcut?: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, shortcut, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-btn"
      // Keeps the textarea selection alive: without this the button steals
      // focus on mousedown and the command applies to a collapsed caret.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
    >
      {children}
    </button>
  )
}

/** Matches `.toolbar-popover`'s min-width; used to keep it on screen. */
const POPOVER_WIDTH = 180
const VIEWPORT_MARGIN = 8

function HeadingMenu({ disabled, onPick }: { disabled: boolean; onPick: (level: number) => void }) {
  // Where the popover sits, in viewport coordinates; null while closed.
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const open = anchor !== null
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /**
   * The toolbar scrolls sideways, and `overflow-x: auto` clips vertically too,
   * so an absolutely positioned popover was cut off at the toolbar's bottom
   * edge. Fixed positioning measured from the trigger escapes that clip.
   */
  const toggle = () => {
    if (open) {
      setAnchor(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN)
    setAnchor({ top: rect.bottom + 4, left: Math.min(Math.max(VIEWPORT_MARGIN, rect.left), maxLeft) })
  }

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setAnchor(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setAnchor(null)
      triggerRef.current?.focus()
    }
    // A fixed popover would float away from its trigger, so anything that
    // moves the trigger closes it instead.
    const dismiss = () => setAnchor(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  return (
    <div className="toolbar-menu" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`toolbar-btn${open ? ' is-active' : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        disabled={disabled}
        title="Heading (Ctrl+1 … Ctrl+6)"
        aria-label="Heading level"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <IconHeading />
      </button>
      {anchor && (
        <div className="toolbar-popover" role="menu" style={{ top: anchor.top, left: anchor.left }}>
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button
              key={level}
              type="button"
              className="toolbar-popover-item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(level)
                setAnchor(null)
              }}
              style={{ fontSize: `${17 - level}px` }}
            >
              <span>Heading {level}</span>
              <kbd>Ctrl {level}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default FormatToolbar
