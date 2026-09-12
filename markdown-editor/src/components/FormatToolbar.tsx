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

function HeadingMenu({ disabled, onPick }: { disabled: boolean; onPick: (level: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="toolbar-menu" ref={ref}>
      <button
        type="button"
        className={`toolbar-btn${open ? ' is-active' : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        title="Heading (Ctrl+1 … Ctrl+6)"
        aria-label="Heading level"
        aria-expanded={open}
      >
        <IconHeading />
      </button>
      {open && (
        <div className="toolbar-popover" role="menu">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button
              key={level}
              type="button"
              className="toolbar-popover-item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(level)
                setOpen(false)
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
