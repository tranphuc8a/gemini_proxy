import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store'
import './Editor.css'

function Editor() {
  const isAdmin = useEditorStore((state) => state.isAdmin)
  const currentContent = useEditorStore((state) => state.currentContent)
  const setContent = useEditorStore((state) => state.setContent)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault()
        redo()
      }
      // Tab: Insert 2 spaces instead of moving focus
      if (e.key === 'Tab') {
        e.preventDefault()
        const start = editorRef.current!.selectionStart
        const end = editorRef.current!.selectionEnd
        const before = currentContent.substring(0, start)
        const after = currentContent.substring(end)
        const newContent = before + '  ' + after
        setContent(newContent)
        setTimeout(() => {
          editorRef.current!.selectionStart = editorRef.current!.selectionEnd = start + 2
        }, 0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentContent, undo, redo, setContent])

  useEffect(() => {
    const handlePreviewScroll = (event: Event) => {
      if (!editorRef.current) return
      const ratio = (event as CustomEvent<number>).detail
      const range = editorRef.current.scrollHeight - editorRef.current.clientHeight
      editorRef.current.scrollTop = ratio * Math.max(0, range)
    }
    const handlePreviewFocus = (event: Event) => {
      if (!editorRef.current) return
      const viewportY = (event as CustomEvent<number>).detail
      const preview = document.querySelector('.preview-content')
      const ratio = preview && preview.clientHeight > 0 ? Math.max(0, Math.min(1, viewportY / preview.clientHeight)) : 0
      const line = Math.round(ratio * currentContent.split('\n').length)
      const position = currentContent.split('\n').slice(0, line).join('\n').length
      editorRef.current.focus()
      editorRef.current.setSelectionRange(position, position)
    }
    window.addEventListener('preview-scroll', handlePreviewScroll)
    window.addEventListener('preview-focus-editor', handlePreviewFocus)
    return () => {
      window.removeEventListener('preview-scroll', handlePreviewScroll)
      window.removeEventListener('preview-focus-editor', handlePreviewFocus)
    }
  }, [currentContent])

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <h3>✏️ Editor</h3>
        <span className="editor-hint">{isAdmin ? 'Edit' : 'View Only'}</span>
      </div>
      <textarea
        ref={editorRef}
        className="editor"
        value={currentContent}
        onChange={(e) => setContent(e.target.value)}
        onScroll={(e) => {
          const element = e.currentTarget
          const range = element.scrollHeight - element.clientHeight
          window.dispatchEvent(new CustomEvent('editor-scroll', { detail: range > 0 ? element.scrollTop / range : 0 }))
        }}
        readOnly={!isAdmin}
        placeholder="Enter your markdown here..."
        spellCheck="false"
      />
    </div>
  )
}

export default Editor
