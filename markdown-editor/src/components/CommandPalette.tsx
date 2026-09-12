import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { flatten, getPath } from '../lib/tree'
import { extractHeadings } from '../lib/markdown'
import { emitJump } from '../lib/paneSync'
import { exportMarkdown } from '../lib/exporters'
import { rankBySearch } from '../lib/fuzzy'
import { IconFile, IconHash, IconSearch } from './Icons'
import './CommandPalette.css'

interface Command {
  id: string
  label: string
  group: 'Commands' | 'Files' | 'Headings'
  hint?: string
  shortcut?: string
  icon?: React.ReactNode
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenHelp: () => void
}

function CommandPalette({ open, onClose, onOpenHelp }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const files = useEditorStore((state) => state.files)
  const content = useEditorStore((state) => state.currentContent)
  const currentFileId = useEditorStore((state) => state.currentFileId)

  const commands = useMemo<Command[]>(() => {
    const state = useEditorStore.getState()
    const fileName = flatten(files).find((node) => node.id === currentFileId)?.name ?? 'document.md'

    const actions: Command[] = [
      { id: 'view-editor', label: 'View: Editor only', group: 'Commands', shortcut: 'Ctrl+\\', run: () => state.setViewMode('editor') },
      { id: 'view-split', label: 'View: Editor and preview', group: 'Commands', shortcut: 'Ctrl+\\', run: () => state.setViewMode('split') },
      { id: 'view-preview', label: 'View: Preview only', group: 'Commands', shortcut: 'Ctrl+\\', run: () => state.setViewMode('preview') },
      { id: 'theme', label: 'Toggle dark mode', group: 'Commands', run: state.toggleTheme },
      { id: 'theme-system', label: 'Theme: follow the system', group: 'Commands', run: () => state.setTheme('system') },
      { id: 'sidebar', label: 'Toggle sidebar', group: 'Commands', shortcut: 'Ctrl+Shift+B', run: state.toggleSidebar },
      { id: 'outline', label: 'Show document outline', group: 'Commands', shortcut: 'Ctrl+Shift+O', run: () => state.setSidebarTab('outline') },
      { id: 'files', label: 'Show file explorer', group: 'Commands', run: () => state.setSidebarTab('files') },
      { id: 'fullscreen', label: 'Toggle distraction-free mode', group: 'Commands', shortcut: 'F11', run: state.toggleFullscreen },
      { id: 'sync', label: 'Toggle scroll sync', group: 'Commands', run: state.toggleScrollSync },
      { id: 'numbers', label: 'Toggle line numbers', group: 'Commands', run: state.toggleLineNumbers },
      { id: 'wrap', label: 'Toggle word wrap', group: 'Commands', run: state.toggleWordWrap },
      { id: 'save', label: 'Save now', group: 'Commands', shortcut: 'Ctrl+S', run: state.flushPersist },
      { id: 'export-md', label: 'Export as Markdown', group: 'Commands', run: () => exportMarkdown(fileName, content) },
      { id: 'print', label: 'Print or save as PDF', group: 'Commands', shortcut: 'Ctrl+P', run: () => window.print() },
      { id: 'help', label: 'Open help and shortcuts', group: 'Commands', shortcut: 'Ctrl+/', run: onOpenHelp }
    ]

    if (state.isAdmin) {
      actions.push({ id: 'new-file', label: 'New file…', group: 'Commands', run: () => {
        const name = window.prompt('File name', 'untitled.md')
        if (name) state.createFile(state.selectedFolderId ?? files[0]?.id ?? null, name)
      } })
      actions.push({ id: 'new-folder', label: 'New folder…', group: 'Commands', run: () => {
        const name = window.prompt('Folder name', 'New folder')
        if (name) state.createFolder(state.selectedFolderId ?? files[0]?.id ?? null, name)
      } })
      actions.push({ id: 'logout', label: 'Leave admin mode', group: 'Commands', run: state.logout })
    }

    const fileCommands: Command[] = flatten(files)
      .filter((node) => node.type === 'file')
      .map((node) => ({
        id: `file-${node.id}`,
        label: node.name,
        group: 'Files',
        hint: getPath(files, node.id).slice(0, -1).map((part) => part.name).join(' / '),
        icon: <IconFile size={14} />,
        run: () => state.setCurrentFile(node.id)
      }))

    const headingCommands: Command[] = extractHeadings(content).map((heading) => ({
      id: `heading-${heading.line}-${heading.slug}`,
      label: heading.text,
      group: 'Headings',
      hint: `H${heading.level} · line ${heading.line}`,
      icon: <IconHash size={14} />,
      run: () => emitJump({ line: heading.line, source: 'preview' })
    }))

    return [...actions, ...fileCommands, ...headingCommands]
  }, [content, currentFileId, files, onOpenHelp])

  const results = useMemo(() => rankBySearch(commands, query), [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    // Focus after the panel mounts so the caret is not stolen by the overlay.
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((current) => (results.length ? (current + 1) % results.length : 0))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const command = results[index]
      if (command) {
        command.run()
        onClose()
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
  }

  let lastGroup = ''

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <IconSearch size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search commands, files and headings…"
            aria-label="Search commands"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="palette-results" ref={listRef} role="listbox">
          {results.length === 0 && <p className="palette-empty">No matches for “{query}”.</p>}
          {results.map((command, position) => {
            const showGroup = command.group !== lastGroup
            lastGroup = command.group
            return (
              <div key={command.id}>
                {showGroup && <div className="palette-group">{command.group}</div>}
                <button
                  role="option"
                  aria-selected={position === index}
                  className={`palette-item${position === index ? ' is-active' : ''}`}
                  onMouseMove={() => setIndex(position)}
                  onClick={() => {
                    command.run()
                    onClose()
                  }}
                >
                  <span className="palette-icon">{command.icon}</span>
                  <span className="palette-label">{command.label}</span>
                  {command.hint && <span className="palette-hint">{command.hint}</span>}
                  {command.shortcut && <kbd>{command.shortcut}</kbd>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
