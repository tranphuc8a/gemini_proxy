import { useEffect, useState } from 'react'

import { toShell } from '../lib/ejson'
import type { EjsonDocument } from '../types'
import { JsonEditor } from './JsonEditor'

interface Props {
  mode: 'insert' | 'edit'
  document?: EjsonDocument | null
  namespace: string
  onSave: (text: string) => Promise<boolean>
  onClose: () => void
}

const INSERT_TEMPLATE = '{\n  \n}'

/**
 * Documents are edited as text, in mongosh spelling.
 *
 * A field-by-field form cannot express what MongoDB documents actually are —
 * nested arrays, mixed types, `ObjectId`s — and every tool that tries ends up
 * with a text box anyway.
 */
export function DocumentEditor({ mode, document, namespace, onSave, onClose }: Props) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(mode === 'edit' && document ? toShell(document) : INSERT_TEMPLATE)
  }, [mode, document])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (invalid || saving) return
    setSaving(true)
    const ok = await onSave(text)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'insert' ? 'Insert document' : 'Edit document'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 className="modal-title">
          {mode === 'insert' ? 'Insert into' : 'Edit document in'} <code>{namespace}</code>
        </h3>

        <JsonEditor
          value={text}
          onChange={setText}
          onValidity={setInvalid}
          onSubmit={save}
          rows={18}
          autoFocus
          placeholder={'{\n  name: "example",\n  created: ISODate("2026-09-13T00:00:00Z")\n}'}
        />

        <p className="hint">
          {mode === 'insert'
            ? 'Pass an array to insert several documents at once. Shell spellings such as ObjectId("…") and ISODate("…") are understood.'
            : 'Saving replaces the whole document. The _id is left as it is.'}
        </p>

        <div className="modal-actions">
          <span className="modal-hint">⌘/Ctrl + Enter to save</span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!!invalid || saving} onClick={save}>
            {saving ? 'Saving…' : mode === 'insert' ? 'Insert' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
