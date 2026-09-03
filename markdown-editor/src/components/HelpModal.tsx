import { useEffect, useState } from 'react'
import { useEditorStore } from '../store'
import './HelpModal.css'

function HelpModal() {
  const [open, setOpen] = useState(false)
  const isDarkMode = useEditorStore((state) => state.isDarkMode)
  const fullscreen = useEditorStore((state) => state.fullscreen)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (open) {
        setOpen(false)
      } else if (fullscreen) {
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreen, open, toggleFullscreen])

  return (
    <>
      <div className="help-floating-actions">
        <button
          className="help-floating-button"
          onClick={() => setOpen(true)}
          title="Open usage guide"
          aria-label="Open usage guide"
        >
          ?
        </button>
        <ExitFullscreenButton />
      </div>

      {open && (
        <div className="help-overlay" onClick={() => setOpen(false)}>
          <section
            className={`help-modal ${isDarkMode ? 'dark-mode' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-header">
              <div>
                <p className="help-eyebrow">Markdown Editor</p>
                <h2 id="help-title">Usage guide</h2>
              </div>
              <button className="help-close-button" onClick={() => setOpen(false)} aria-label="Close help">×</button>
            </div>
            <div className="help-modal-content">
              <p><strong>Getting stuck in fullscreen?</strong> Click the green fullscreen button at the bottom-right, or press <kbd>Escape</kbd>.</p>
              <h3>Workspace</h3>
              <ul>
                <li><strong>Editor</strong> writes Markdown and <strong>Preview</strong> renders it live.</li>
                <li>Choose <strong>Editor</strong>, <strong>Both</strong>, or <strong>Preview</strong> from the view switcher.</li>
                <li>Drag the divider between the two panes to resize them.</li>
                <li>Use <strong>Hide files</strong> to collapse the sidebar.</li>
              </ul>
              <h3>Files</h3>
              <ul>
                <li>Click a folder to select it, then use <strong>+</strong> to create a file or folder inside it.</li>
                <li>Hover a node for rename, copy, and move actions. Copy/move targets the selected folder.</li>
                <li>Use <strong>Import</strong> for `.md` files and <strong>Export</strong> to download Markdown.</li>
              </ul>
              <h3>Writing and preview</h3>
              <ul>
                <li>Supports GFM tables, links, images, HTML, math, Mermaid, and language code blocks.</li>
                <li>Click <strong>Copy</strong> on a highlighted code block to copy its source.</li>
                <li>Scroll either pane to synchronize position. Double-click Preview to focus the matching editor area.</li>
              </ul>
              <h3>Useful shortcuts</h3>
              <p><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Z</kbd> undo, <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Y</kbd> redo, <kbd>Tab</kbd> inserts two spaces, and <kbd>Escape</kbd> closes this guide.</p>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function ExitFullscreenButton() {
  const fullscreen = useEditorStore((state) => state.fullscreen)
  const toggleFullscreen = useEditorStore((state) => state.toggleFullscreen)

  if (!fullscreen) return null

  return (
    <button
      className="exit-fullscreen-floating-button"
      onClick={toggleFullscreen}
      title="Exit fullscreen"
      aria-label="Exit fullscreen"
    >
      ↙
    </button>
  )
}

export default HelpModal
