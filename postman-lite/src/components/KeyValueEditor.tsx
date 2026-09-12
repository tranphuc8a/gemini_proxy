import type { KeyValue } from '../types'
import { kv, withBlankRow } from '../lib/util'
import { IconTrash } from './Icons'

interface KeyValueEditorProps {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** Hide the enable/disable checkbox where "disabled" makes no sense. */
  hideToggle?: boolean
}

/**
 * An always-one-blank-row key/value table.
 *
 * Typing into the trailing blank row appends the next one, so adding entries
 * never needs a separate "+" click, and removing the last row leaves one behind
 * rather than an empty area with nothing to type into.
 */
export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  hideToggle,
}: KeyValueEditorProps) {
  const display = withBlankRow(rows)

  const patch = (index: number, next: Partial<KeyValue>) => {
    const updated = display.map((row, i) => (i === index ? { ...row, ...next } : row))
    onChange(withBlankRow(updated))
  }

  const remove = (index: number) => {
    const updated = display.filter((_, i) => i !== index)
    onChange(updated.length ? withBlankRow(updated) : [kv()])
  }

  return (
    <div className="kv-table">
      {display.map((row, index) => (
        <div className={`kv-row${row.enabled ? '' : ' disabled'}`} key={row.id}>
          {hideToggle ? null : (
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => patch(index, { enabled: e.target.checked })}
              aria-label={`Bật dòng ${row.key || index + 1}`}
            />
          )}
          <input
            type="text"
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => patch(index, { key: e.target.value })}
            spellCheck={false}
          />
          <input
            type="text"
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => patch(index, { value: e.target.value })}
            spellCheck={false}
          />
          <button
            className="btn btn-ghost"
            onClick={() => remove(index)}
            aria-label={`Xóa dòng ${row.key || index + 1}`}
            title="Xóa dòng"
          >
            <IconTrash />
          </button>
        </div>
      ))}
    </div>
  )
}
