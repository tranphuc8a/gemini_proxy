import { IconClose } from './Icons'
import './HelpModal.css'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: 'Workspace',
    items: [
      ['Ctrl Shift P', 'Command palette — commands, files and headings'],
      ['Ctrl K', 'Same, when the editor does not have focus'],
      ['Ctrl \\', 'Cycle editor / split / preview'],
      ['Ctrl Shift B', 'Show or hide the sidebar'],
      ['Ctrl Shift O', 'Jump to the document outline'],
      ['Ctrl S', 'Save to browser storage now'],
      ['Ctrl G', 'Go to line'],
      ['F11', 'Distraction-free mode'],
      ['Esc', 'Close a dialog, or leave full screen']
    ]
  },
  {
    group: 'Formatting',
    items: [
      ['Ctrl B', 'Bold'],
      ['Ctrl I', 'Italic'],
      ['Ctrl Shift X', 'Strikethrough'],
      ['Ctrl E', 'Inline code'],
      ['Ctrl Shift C', 'Code block'],
      ['Ctrl K', 'Insert link (while editing)'],
      ['Ctrl Shift I', 'Insert image'],
      ['Ctrl 1 … 6', 'Heading level, pressed again to clear'],
      ['Ctrl Shift 8', 'Bullet list'],
      ['Ctrl Shift 7', 'Numbered list'],
      ['Ctrl Shift 9', 'Task list'],
      ['Ctrl Shift Q', 'Block quote']
    ]
  },
  {
    group: 'Editing',
    items: [
      ['Tab / Shift Tab', 'Indent or outdent the selected lines'],
      ['Enter', 'Continue the list or quote you are in'],
      ['Alt ↑ / ↓', 'Move the current lines'],
      ['Ctrl D', 'Duplicate the current lines'],
      ['Ctrl Shift K', 'Delete the current lines'],
      ['Ctrl F', 'Find'],
      ['Ctrl H', 'Find and replace'],
      ['Ctrl Z / Ctrl Y', 'Undo and redo']
    ]
  }
]

function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="panel help-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <header className="help-head">
          <div>
            <p className="help-eyebrow">Markdown Editor</p>
            <h2 id="help-title">Help and shortcuts</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close help">
            <IconClose />
          </button>
        </header>

        <div className="help-body">
          <section className="help-section">
            <h3>Getting around</h3>
            <ul className="help-list">
              <li>
                The <strong>editor</strong> is on the left and the live <strong>preview</strong> on the right. Drag the divider
                to resize them, or double-click it to snap back to an even split.
              </li>
              <li>
                <strong>Double-click</strong> any block in the preview to put the caret on the line that produced it — and
                double-click in the editor to scroll the preview to the matching spot.
              </li>
              <li>
                Tick a <strong>checkbox</strong> in the preview and the source updates with it.
              </li>
              <li>
                <strong>Drag files and folders</strong> in the sidebar to reorganise them. Drop onto the empty area below the
                tree to move something to the top level.
              </li>
              <li>
                Paste a URL over selected text to turn it into a link, or paste an image to embed it.
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h3>What renders</h3>
            <p className="help-text">
              GitHub-flavoured Markdown: tables, task lists, footnotes and strikethrough, plus KaTeX maths (
              <code>$…$</code> and <code>$$…$$</code>), Mermaid diagrams in a <code>mermaid</code> code fence, syntax
              highlighting for fenced code, and sanitised inline HTML.
            </p>
          </section>

          {SHORTCUTS.map((section) => (
            <section key={section.group} className="help-section">
              <h3>{section.group}</h3>
              <dl className="help-shortcuts">
                {section.items.map(([keys, description]) => (
                  <div key={keys + description} className="help-shortcut">
                    <dt>
                      {keys.split(' ').map((part, index) => (
                        <kbd key={`${part}-${index}`}>{part}</kbd>
                      ))}
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="help-section">
            <h3>Saving</h3>
            <p className="help-text">
              Work is written to this browser's local storage automatically; the status bar shows when it last succeeded.
              Turn on <strong>backend sync</strong> from the toolbar to load and save the whole file tree through the FastAPI
              API instead — saving there needs admin access.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}

export default HelpModal
