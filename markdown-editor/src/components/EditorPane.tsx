import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { columnAtOffset, lineAtOffset, offsetAtLine, type SearchMatch } from '../lib/markdown'
import {
  continueList,
  deleteLines,
  duplicateLines,
  indentSelection,
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertLink,
  insertTable,
  moveLines,
  outdentSelection,
  toggleHeading,
  toggleLinePrefix,
  toggleWrap,
  wrapSelectionWithPair,
  type EditorSelection
} from '../lib/editorCommands'
import { createSyncLock, emitJump, emitScrollSync, lineForOffset, offsetForLine, onJump, onScrollSync, type LineAnchor } from '../lib/paneSync'
import FormatToolbar, { type FormatAction } from './FormatToolbar'
import FindReplace from './FindReplace'
import { IconNumbers, IconWrap } from './Icons'
import './EditorPane.css'

/** Beyond this a per-line mirror costs more than the alignment is worth. */
const MAX_MEASURED_LINES = 6000

function EditorPane() {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const content = useEditorStore((state) => state.currentContent)
  const currentFileId = useEditorStore((state) => state.currentFileId)
  const setContent = useEditorStore((state) => state.setContent)
  const commitHistory = useEditorStore((state) => state.commitHistory)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const scrollSync = useEditorStore((state) => state.scrollSync)
  const showLineNumbers = useEditorStore((state) => state.showLineNumbers)
  const wordWrap = useEditorStore((state) => state.wordWrap)
  const toggleLineNumbers = useEditorStore((state) => state.toggleLineNumbers)
  const toggleWordWrap = useEditorStore((state) => state.toggleWordWrap)
  const pushToast = useEditorStore((state) => state.pushToast)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(createSyncLock())

  const [find, setFind] = useState<{ open: boolean; replace: boolean }>({ open: false, replace: false })
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const [metrics, setMetrics] = useState<{ tops: number[]; height: number }>({ tops: [], height: 0 })

  const lines = useMemo(() => content.split('\n'), [content])
  const measured = lines.length <= MAX_MEASURED_LINES
  const readOnly = !isAdmin

  /**
   * Measures each logical line against a hidden mirror that shares the
   * textarea's font and width. That is what makes the gutter and the scroll
   * sync stay correct once lines start wrapping.
   */
  const measure = useCallback(() => {
    const mirror = mirrorRef.current
    const textarea = textareaRef.current
    if (!mirror || !textarea) return
    // Match the textarea's *content* width, which excludes its scrollbar, so
    // both wrap at exactly the same column.
    mirror.style.width = `${textarea.clientWidth}px`
    const children = Array.from(mirror.children) as HTMLElement[]
    // offsetTop is measured from the mirror's padding edge, so the first line
    // already sits at padding-top. Rebasing on it makes every offset relative
    // to the start of the text, which is what both consumers expect.
    const base = children[0]?.offsetTop ?? 0
    const tops = children.map((child) => child.offsetTop - base)
    setMetrics({ tops, height: mirror.scrollHeight - base })
  }, [])

  useLayoutEffect(() => {
    if (!measured) {
      setMetrics({ tops: [], height: 0 })
      return
    }
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [content, measured, wordWrap, measure])

  // Re-measure when the pane is resized: wrapping changes with the width.
  useEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror || !measured) return
    const observer = new ResizeObserver(measure)
    observer.observe(mirror)
    return () => observer.disconnect()
  }, [measured, measure])

  const anchors = useMemo<LineAnchor[]>(() => metrics.tops.map((top, index) => ({ line: index + 1, top })), [metrics])

  const syncCaret = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const offset = textarea.selectionStart
    setCaret({ line: lineAtOffset(textarea.value, offset), column: columnAtOffset(textarea.value, offset) + 1 })
  }, [])

  /** Applies a pure command and restores the selection it asks for. */
  const apply = useCallback(
    (transform: (selection: EditorSelection) => EditorSelection | null) => {
      const textarea = textareaRef.current
      if (!textarea || readOnly) return

      const current: EditorSelection = { value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }
      const next = transform(current)
      if (!next || next.value === current.value) {
        if (next) textarea.setSelectionRange(next.start, next.end)
        return
      }

      setContent(next.value)
      // React re-renders from the store, so the selection has to be restored
      // after the value lands back on the element.
      requestAnimationFrame(() => {
        textarea.setSelectionRange(next.start, next.end)
        textarea.focus()
        syncCaret()
      })
    },
    [readOnly, setContent, syncCaret]
  )

  const runAction = useCallback(
    (action: FormatAction) => {
      switch (action.kind) {
        case 'bold':
          return apply((sel) => toggleWrap(sel, '**'))
        case 'italic':
          return apply((sel) => toggleWrap(sel, '*'))
        case 'strike':
          return apply((sel) => toggleWrap(sel, '~~'))
        case 'inlineCode':
          return apply((sel) => toggleWrap(sel, '`'))
        case 'codeBlock':
          return apply((sel) => insertCodeBlock(sel))
        case 'heading':
          return apply((sel) => toggleHeading(sel, action.level))
        case 'quote':
          return apply((sel) => toggleLinePrefix(sel, 'quote'))
        case 'bullet':
          return apply((sel) => toggleLinePrefix(sel, 'bullet'))
        case 'ordered':
          return apply((sel) => toggleLinePrefix(sel, 'ordered'))
        case 'task':
          return apply((sel) => toggleLinePrefix(sel, 'task'))
        case 'link':
          return apply((sel) => insertLink(sel))
        case 'image':
          return apply((sel) => insertImage(sel))
        case 'table':
          return apply((sel) => insertTable(sel))
        case 'rule':
          return apply((sel) => insertHorizontalRule(sel))
      }
    },
    [apply]
  )

  /** Scrolls the textarea so `line` sits near the top. */
  const scrollToLine = useCallback(
    (line: number, behavior: ScrollBehavior = 'auto') => {
      const textarea = textareaRef.current
      if (!textarea) return
      const top = anchors.length ? offsetForLine(anchors, line) : (line - 1) * estimateLineHeight(textarea)
      textarea.scrollTo({ top, behavior })
    },
    [anchors]
  )

  const focusLine = useCallback(
    (line: number) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const offset = offsetAtLine(textarea.value, line)
      textarea.focus()
      textarea.setSelectionRange(offset, offset)
      scrollToLine(Math.max(1, line - 3), 'smooth')
      syncCaret()
    },
    [scrollToLine, syncCaret]
  )

  // Follow the preview's scroll position and its double-click jumps.
  useEffect(() => {
    const offScroll = onScrollSync((event) => {
      if (event.source === 'editor' || !scrollSync) return
      lockRef.current.engage()
      scrollToLine(event.line)
    })
    const offJump = onJump((event) => {
      if (event.source === 'editor') return
      focusLine(event.line)
    })
    return () => {
      offScroll()
      offJump()
    }
  }, [scrollSync, scrollToLine, focusLine])

  const onScroll = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || !gutterRef.current) return
    gutterRef.current.scrollTop = textarea.scrollTop

    if (!scrollSync || lockRef.current.locked) return
    const line = anchors.length ? lineForOffset(anchors, textarea.scrollTop) : Math.round(textarea.scrollTop / estimateLineHeight(textarea)) + 1
    emitScrollSync({ line, source: 'editor' })
  }, [anchors, scrollSync])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      // Find and replace stay available to anonymous readers.
      if (mod && key === 'f') {
        event.preventDefault()
        event.stopPropagation()
        setFind({ open: true, replace: false })
        return
      }
      if (mod && key === 'h') {
        event.preventDefault()
        event.stopPropagation()
        setFind({ open: true, replace: true })
        return
      }

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        undo()
        return
      }
      if ((mod && key === 'z' && event.shiftKey) || (mod && key === 'y')) {
        event.preventDefault()
        event.stopPropagation()
        redo()
        return
      }

      if (readOnly) return

      if (event.key === 'Tab') {
        event.preventDefault()
        apply((sel) => (event.shiftKey ? outdentSelection(sel) : indentSelection(sel)))
        return
      }

      if (event.key === 'Enter' && !event.shiftKey && !mod) {
        const textarea = event.currentTarget
        const result = continueList({ value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd })
        if (result) {
          event.preventDefault()
          apply(() => result)
        }
        return
      }

      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        apply((sel) => moveLines(sel, event.key === 'ArrowUp' ? -1 : 1))
        return
      }

      if (mod && event.shiftKey && key === 'k') {
        event.preventDefault()
        event.stopPropagation()
        apply(deleteLines)
        return
      }

      if (mod && key === 'd' && !event.shiftKey) {
        event.preventDefault()
        apply(duplicateLines)
        return
      }

      if (mod && !event.shiftKey && /^[1-6]$/.test(event.key)) {
        event.preventDefault()
        runAction({ kind: 'heading', level: Number(event.key) })
        return
      }

      if (mod && !event.shiftKey) {
        const map: Record<string, FormatAction> = {
          b: { kind: 'bold' },
          i: { kind: 'italic' },
          e: { kind: 'inlineCode' },
          k: { kind: 'link' }
        }
        const action = map[key]
        if (action) {
          event.preventDefault()
          // Stops Ctrl+K from also opening the command palette.
          event.stopPropagation()
          runAction(action)
          return
        }
      }

      if (mod && event.shiftKey) {
        const map: Record<string, FormatAction> = {
          x: { kind: 'strike' },
          c: { kind: 'codeBlock' },
          i: { kind: 'image' },
          q: { kind: 'quote' },
          '&': { kind: 'ordered' },
          '*': { kind: 'bullet' },
          '(': { kind: 'task' },
          '7': { kind: 'ordered' },
          '8': { kind: 'bullet' },
          '9': { kind: 'task' }
        }
        const action = map[event.key] ?? map[key]
        if (action) {
          event.preventDefault()
          event.stopPropagation()
          runAction(action)
          return
        }
      }

      // Typing a bracket with text selected wraps it instead of replacing it.
      if (!mod && !event.altKey && event.key.length === 1) {
        const textarea = event.currentTarget
        if (textarea.selectionStart !== textarea.selectionEnd) {
          const wrapped = wrapSelectionWithPair(
            { value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd },
            event.key
          )
          if (wrapped) {
            event.preventDefault()
            apply(() => wrapped)
          }
        }
      }
    },
    [apply, readOnly, redo, runAction, undo]
  )

  /** A pasted URL over a selection becomes a link rather than raw text. */
  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return
      const textarea = event.currentTarget
      const text = event.clipboardData.getData('text/plain')
      const hasSelection = textarea.selectionStart !== textarea.selectionEnd

      if (hasSelection && /^https?:\/\/\S+$/i.test(text.trim())) {
        event.preventDefault()
        apply((sel) => insertLink(sel, text.trim()))
        return
      }

      const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'))
      if (image) {
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = () => apply((sel) => insertImage(sel, String(reader.result ?? ''), image.name.replace(/\.[^.]+$/, '')))
        reader.onerror = () => pushToast('Could not read the pasted image', 'error')
        reader.readAsDataURL(image)
      }
    },
    [apply, pushToast, readOnly]
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      const file = event.dataTransfer.files[0]
      if (!file || readOnly) return
      event.preventDefault()

      const reader = new FileReader()
      if (file.type.startsWith('image/')) {
        reader.onload = () => apply((sel) => insertImage(sel, String(reader.result ?? ''), file.name.replace(/\.[^.]+$/, '')))
        reader.readAsDataURL(file)
      } else {
        reader.onload = () => apply((sel) => ({ ...sel, value: sel.value.slice(0, sel.start) + String(reader.result ?? '') + sel.value.slice(sel.end) }))
        reader.readAsText(file)
      }
    },
    [apply, readOnly]
  )

  const selectMatch = useCallback(
    (match: SearchMatch) => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(match.start, match.end)
      scrollToLine(Math.max(1, lineAtOffset(textarea.value, match.start) - 3), 'smooth')
      syncCaret()
    },
    [scrollToLine, syncCaret]
  )

  const replaceMatch = useCallback(
    (match: SearchMatch, replacement: string) => {
      apply((sel) => ({
        value: sel.value.slice(0, match.start) + replacement + sel.value.slice(match.end),
        start: match.start + replacement.length,
        end: match.start + replacement.length
      }))
    },
    [apply]
  )

  const replaceAllMatches = useCallback(
    (matches: SearchMatch[], replacement: string) => {
      apply((sel) => {
        // Walk backwards so earlier offsets stay valid.
        let value = sel.value
        for (let index = matches.length - 1; index >= 0; index -= 1) {
          value = value.slice(0, matches[index].start) + replacement + value.slice(matches[index].end)
        }
        return { value, start: sel.start, end: sel.start }
      })
      pushToast(`Replaced ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`, 'success')
    },
    [apply, pushToast]
  )

  // Reset the view when the open file changes.
  useEffect(() => {
    textareaRef.current?.scrollTo({ top: 0 })
    setCaret({ line: 1, column: 1 })
  }, [currentFileId])

  return (
    <section className="editor-pane" aria-label="Markdown editor">
      <div className="pane-header">
        <span className="pane-title">Editor</span>
        <div className="pane-header-actions">
          <span className="pane-meta">
            Ln {caret.line}, Col {caret.column}
          </span>
          <button
            className={`btn btn-icon${showLineNumbers ? ' is-active' : ''}`}
            onClick={toggleLineNumbers}
            title="Toggle line numbers"
            aria-label="Toggle line numbers"
            aria-pressed={showLineNumbers}
          >
            <IconNumbers size={14} />
          </button>
          <button
            className={`btn btn-icon${wordWrap ? ' is-active' : ''}`}
            onClick={toggleWordWrap}
            title="Toggle word wrap"
            aria-label="Toggle word wrap"
            aria-pressed={wordWrap}
          >
            <IconWrap size={14} />
          </button>
        </div>
      </div>

      <FormatToolbar disabled={readOnly} onAction={runAction} />

      {find.open && (
        <FindReplace
          value={content}
          showReplace={find.replace}
          canEdit={!readOnly}
          onClose={() => {
            setFind({ open: false, replace: false })
            textareaRef.current?.focus()
          }}
          onSelectMatch={selectMatch}
          onReplace={replaceMatch}
          onReplaceAll={replaceAllMatches}
        />
      )}

      <div className={`editor-body${wordWrap ? '' : ' no-wrap'}`}>
        {showLineNumbers && (
          <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
            <div className="gutter-inner" style={metrics.height ? { height: metrics.height } : undefined}>
              {lines.map((_, index) => (
                <div
                  key={index}
                  className={`gutter-line${index + 1 === caret.line ? ' is-current' : ''}`}
                  style={metrics.tops[index] === undefined ? undefined : { top: metrics.tops[index] }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="editor-main">
          <textarea
          ref={textareaRef}
          className="editor-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          onBlur={commitHistory}
          onScroll={onScroll}
          onPaste={onPaste}
          onDrop={onDrop}
          onDoubleClick={(event) => {
            if (!scrollSync) return
            emitJump({ line: lineAtOffset(event.currentTarget.value, event.currentTarget.selectionStart), source: 'editor' })
          }}
          readOnly={readOnly}
          spellCheck={false}
          placeholder={readOnly ? 'Read-only. Unlock admin mode to edit.' : 'Write Markdown here…'}
          aria-label="Markdown source"
          wrap={wordWrap ? 'soft' : 'off'}
          />

          {/* Invisible twin of the textarea; its per-line boxes drive the
              gutter and the line-accurate scroll sync. */}
          {measured && (
            <div className="editor-mirror" ref={mirrorRef} aria-hidden="true">
              {lines.map((line, index) => (
                <div key={index} className="mirror-line">
                  {line === '' ? '​' : line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function estimateLineHeight(element: HTMLElement): number {
  const parsed = parseFloat(getComputedStyle(element).lineHeight)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 21
}


export default EditorPane
