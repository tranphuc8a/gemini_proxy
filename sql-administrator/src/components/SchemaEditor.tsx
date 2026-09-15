/**
 * Editing a table's structure: columns, the primary key, indexes and foreign
 * keys.
 *
 * Every action here posts a *described operation* — "add this column", "drop
 * that index" — rather than a piece of SQL. The server assembles the statement
 * from validated parts, so a column named `x; DROP TABLE y` is a column named
 * `x; DROP TABLE y`, not two statements. The place to type SQL is the console,
 * and keeping that the only such place is the point.
 *
 * Types are a free-text box on purpose. MySQL has too many to enumerate, the
 * list grows, and a user who wants `ENUM('a','b')` or `DECIMAL(10,2) UNSIGNED`
 * should not have to wait for a dropdown to catch up; the server checks the
 * *shape* of what is typed.
 */

import { useState } from 'react'

import { api, ApiError } from '../lib/api'
import { useStore } from '../store'
import type { ColumnDefinition, ColumnInfo, TableStructure } from '../types'
import { useConfirm } from './useConfirm'

const COMMON_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE',
  'VARCHAR(255)', 'CHAR(36)', 'TEXT', 'LONGTEXT', 'JSON',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'BOOLEAN', 'BLOB',
]

const EMPTY_COLUMN: ColumnDefinition = {
  name: '',
  data_type: 'VARCHAR(255)',
  nullable: true,
  default: '',
  extra: '',
  comment: '',
}

function toDefinition(column: ColumnInfo): ColumnDefinition {
  return {
    name: column.name,
    // `column_type` carries the length and attributes; `data_type` alone would
    // silently turn VARCHAR(255) into VARCHAR(1) on the way back.
    data_type: column.column_type || column.data_type,
    nullable: column.nullable,
    default: column.default === null || column.default === undefined ? '' : String(column.default),
    extra: column.extra ?? '',
    comment: column.comment ?? '',
  }
}

interface Props {
  structure: TableStructure
  onChanged: () => void
}

export function SchemaEditor({ structure, onChanged }: Props) {
  const notify = useStore((state) => state.notify)
  const [confirm, confirmDialog] = useConfirm()

  const [draft, setDraft] = useState<{ mode: 'add' | 'edit'; original?: string; column: ColumnDefinition } | null>(null)
  const [pkDraft, setPkDraft] = useState<string[] | null>(null)
  const [indexDraft, setIndexDraft] = useState<{ name: string; columns: string[]; unique: boolean } | null>(null)
  const [fkDraft, setFkDraft] = useState<{
    name: string
    columns: string[]
    referenced_table: string
    referenced_columns: string
    on_delete: string
    on_update: string
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const { database, table } = structure

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      notify('success', label)
      onChanged()
      return true
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : `${label} thất bại`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveColumn = async () => {
    if (!draft) return
    const payload = { ...draft.column, default: draft.column.default || null, extra: draft.column.extra || null }
    const done =
      draft.mode === 'add'
        ? await run('Đã thêm cột', () => api.addColumn(database, table, payload))
        : await run('Đã sửa cột', () => api.modifyColumn(database, table, draft.original as string, payload))
    if (done) setDraft(null)
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  return (
    <section className="schema-editor">
      <header className="panel-head">
        <h3>Sửa cấu trúc</h3>
        <div className="spacer" />
        <button
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => setDraft({ mode: 'add', column: { ...EMPTY_COLUMN } })}
        >
          + Thêm cột
        </button>
        <button
          className="btn btn-sm"
          disabled={busy}
          onClick={() => setPkDraft(structure.primary_key.length ? [...structure.primary_key] : [])}
        >
          Khoá chính
        </button>
        <button
          className="btn btn-sm"
          disabled={busy}
          onClick={() => setIndexDraft({ name: `ix_${table}_`, columns: [], unique: false })}
        >
          + Index
        </button>
        <button
          className="btn btn-sm"
          disabled={busy}
          onClick={() =>
            setFkDraft({
              name: `fk_${table}_`,
              columns: [],
              referenced_table: '',
              referenced_columns: '',
              on_delete: '',
              on_update: '',
            })
          }
        >
          + Khoá ngoại
        </button>
      </header>

      {/* --- per-column actions ------------------------------------------- */}
      <div className="column-actions">
        {structure.columns.map((column) => (
          <div key={column.name} className="column-chip">
            <span className="mono">{column.name}</span>
            <span className="dim mono">{column.column_type}</span>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => setDraft({ mode: 'edit', original: column.name, column: toDefinition(column) })}
            >
              Sửa
            </button>
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: `Xoá cột ${column.name}?`,
                    message: 'Toàn bộ dữ liệu trong cột này sẽ mất. Không hoàn tác được.',
                    confirmLabel: 'Xoá cột',
                    danger: true,
                    requireText: column.name,
                  }))
                )
                  return
                await run('Đã xoá cột', () => api.dropColumn(database, table, column.name))
              }}
            >
              Xoá
            </button>
          </div>
        ))}
      </div>

      {/* --- index / foreign-key removal ---------------------------------- */}
      {structure.indexes.filter((index) => index.name !== 'PRIMARY').length ? (
        <div className="column-actions">
          {structure.indexes
            .filter((index) => index.name !== 'PRIMARY')
            .map((index) => (
              <div key={index.name} className="column-chip">
                <span className="badge">{index.unique ? 'UNIQUE' : 'INDEX'}</span>
                <span className="mono">{index.name}</span>
                <span className="dim mono">({index.columns.join(', ')})</span>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busy}
                  onClick={() => void run('Đã xoá index', () => api.dropIndex(database, table, index.name))}
                >
                  Xoá
                </button>
              </div>
            ))}
        </div>
      ) : null}

      {structure.foreign_keys.length ? (
        <div className="column-actions">
          {structure.foreign_keys.map((key) => (
            <div key={key.name} className="column-chip">
              <span className="badge">FK</span>
              <span className="mono">{key.name}</span>
              <span className="dim mono">
                {key.column} → {key.referenced_table}.{key.referenced_column}
              </span>
              <button
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => void run('Đã xoá khoá ngoại', () => api.dropForeignKey(database, table, key.name))}
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* --- column editor ------------------------------------------------ */}
      {draft ? (
        <div className="editor-card">
          <h3>{draft.mode === 'add' ? 'Thêm cột' : `Sửa cột ${draft.original}`}</h3>
          <div className="field-grid">
            <label className="field">
              <span>Tên cột</span>
              <input
                value={draft.column.name}
                onChange={(event) => setDraft({ ...draft, column: { ...draft.column, name: event.target.value } })}
              />
            </label>
            <label className="field">
              <span>Kiểu dữ liệu</span>
              <input
                list="mysql-types"
                className="mono"
                value={draft.column.data_type}
                onChange={(event) => setDraft({ ...draft, column: { ...draft.column, data_type: event.target.value } })}
              />
              <datalist id="mysql-types">
                {COMMON_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Giá trị mặc định</span>
              <input
                className="mono"
                placeholder="để trống = không có DEFAULT"
                value={draft.column.default ?? ''}
                onChange={(event) => setDraft({ ...draft, column: { ...draft.column, default: event.target.value } })}
              />
            </label>
            <label className="field">
              <span>Thuộc tính</span>
              <input
                className="mono"
                placeholder="AUTO_INCREMENT, ON UPDATE CURRENT_TIMESTAMP…"
                value={draft.column.extra ?? ''}
                onChange={(event) => setDraft({ ...draft, column: { ...draft.column, extra: event.target.value } })}
              />
            </label>
            <label className="field">
              <span>Ghi chú</span>
              <input
                value={draft.column.comment ?? ''}
                onChange={(event) => setDraft({ ...draft, column: { ...draft.column, comment: event.target.value } })}
              />
            </label>
            <label className="field">
              <span>Đặt sau cột</span>
              <select
                value={draft.column.after ?? '__keep__'}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    column: {
                      ...draft.column,
                      after: event.target.value === '__keep__' ? undefined : event.target.value,
                    },
                  })
                }
              >
                <option value="__keep__">(giữ nguyên vị trí)</option>
                <option value="">Đầu bảng (FIRST)</option>
                {structure.columns
                  .filter((column) => column.name !== draft.original)
                  .map((column) => (
                    <option key={column.name} value={column.name}>
                      sau {column.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={draft.column.nullable}
              onChange={(event) => setDraft({ ...draft, column: { ...draft.column, nullable: event.target.checked } })}
            />
            Cho phép NULL
          </label>

          <p className="hint">
            Đổi <b>tên cột</b> cũng làm ở đây: sửa ô "Tên cột" rồi lưu — máy chủ dùng <code>CHANGE COLUMN</code>,
            nên không cần thao tác riêng để đổi tên.
          </p>

          <div className="row">
            <button className="btn" onClick={() => setDraft(null)}>Huỷ</button>
            <button
              className="btn btn-primary"
              disabled={busy || !draft.column.name.trim() || !draft.column.data_type.trim()}
              onClick={() => void saveColumn()}
            >
              Lưu cột
            </button>
          </div>
        </div>
      ) : null}

      {/* --- primary key --------------------------------------------------- */}
      {pkDraft ? (
        <div className="editor-card">
          <h3>Khoá chính</h3>
          <p className="hint">
            Thứ tự cột <b>có ý nghĩa</b>: khoá (a, b) khác khoá (b, a) vì quy tắc tiền tố trái. Bấm theo thứ tự mong muốn.
          </p>
          <div className="column-actions">
            {structure.columns.map((column) => {
              const position = pkDraft.indexOf(column.name)
              return (
                <button
                  key={column.name}
                  className={`chip-toggle${position !== -1 ? ' is-active' : ''}`}
                  onClick={() => setPkDraft(toggle(pkDraft, column.name))}
                >
                  {position !== -1 ? `${position + 1}. ` : ''}
                  {column.name}
                </button>
              )
            })}
          </div>
          <div className="row">
            <button className="btn" onClick={() => setPkDraft(null)}>Huỷ</button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                if (
                  !pkDraft.length &&
                  !(await confirm({
                    title: 'Xoá khoá chính?',
                    message: 'Bảng sẽ không còn khoá chính. Một số máy chủ từ chối bảng không có khoá chính.',
                    confirmLabel: 'Xoá khoá chính',
                    danger: true,
                  }))
                )
                  return
                const done = await run('Đã cập nhật khoá chính', () => api.setPrimaryKey(database, table, pkDraft))
                if (done) setPkDraft(null)
              }}
            >
              {pkDraft.length ? 'Đặt khoá chính' : 'Xoá khoá chính'}
            </button>
          </div>
        </div>
      ) : null}

      {/* --- index --------------------------------------------------------- */}
      {indexDraft ? (
        <div className="editor-card">
          <h3>Index mới</h3>
          <div className="field-grid">
            <label className="field">
              <span>Tên index</span>
              <input
                className="mono"
                value={indexDraft.name}
                onChange={(event) => setIndexDraft({ ...indexDraft, name: event.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={indexDraft.unique}
                onChange={(event) => setIndexDraft({ ...indexDraft, unique: event.target.checked })}
              />
              UNIQUE
            </label>
          </div>
          <div className="column-actions">
            {structure.columns.map((column) => (
              <button
                key={column.name}
                className={`chip-toggle${indexDraft.columns.includes(column.name) ? ' is-active' : ''}`}
                onClick={() => setIndexDraft({ ...indexDraft, columns: toggle(indexDraft.columns, column.name) })}
              >
                {column.name}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn" onClick={() => setIndexDraft(null)}>Huỷ</button>
            <button
              className="btn btn-primary"
              disabled={busy || !indexDraft.name.trim() || !indexDraft.columns.length}
              onClick={async () => {
                const done = await run('Đã tạo index', () => api.createIndex(database, table, indexDraft))
                if (done) setIndexDraft(null)
              }}
            >
              Tạo index
            </button>
          </div>
        </div>
      ) : null}

      {/* --- foreign key ---------------------------------------------------- */}
      {fkDraft ? (
        <div className="editor-card">
          <h3>Khoá ngoại mới</h3>
          <div className="field-grid">
            <label className="field">
              <span>Tên ràng buộc</span>
              <input
                className="mono"
                value={fkDraft.name}
                onChange={(event) => setFkDraft({ ...fkDraft, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Bảng tham chiếu</span>
              <input
                className="mono"
                placeholder="ten_bang"
                value={fkDraft.referenced_table}
                onChange={(event) => setFkDraft({ ...fkDraft, referenced_table: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Cột tham chiếu</span>
              <input
                className="mono"
                placeholder="id (nhiều cột: ngăn bằng dấu phẩy)"
                value={fkDraft.referenced_columns}
                onChange={(event) => setFkDraft({ ...fkDraft, referenced_columns: event.target.value })}
              />
            </label>
            <label className="field">
              <span>ON DELETE</span>
              <select value={fkDraft.on_delete} onChange={(event) => setFkDraft({ ...fkDraft, on_delete: event.target.value })}>
                <option value="">(mặc định)</option>
                <option value="CASCADE">CASCADE</option>
                <option value="SET NULL">SET NULL</option>
                <option value="RESTRICT">RESTRICT</option>
                <option value="NO ACTION">NO ACTION</option>
              </select>
            </label>
            <label className="field">
              <span>ON UPDATE</span>
              <select value={fkDraft.on_update} onChange={(event) => setFkDraft({ ...fkDraft, on_update: event.target.value })}>
                <option value="">(mặc định)</option>
                <option value="CASCADE">CASCADE</option>
                <option value="SET NULL">SET NULL</option>
                <option value="RESTRICT">RESTRICT</option>
                <option value="NO ACTION">NO ACTION</option>
              </select>
            </label>
          </div>

          <p className="hint">Chọn cột trong bảng này sẽ tham chiếu sang:</p>
          <div className="column-actions">
            {structure.columns.map((column) => (
              <button
                key={column.name}
                className={`chip-toggle${fkDraft.columns.includes(column.name) ? ' is-active' : ''}`}
                onClick={() => setFkDraft({ ...fkDraft, columns: toggle(fkDraft.columns, column.name) })}
              >
                {column.name}
              </button>
            ))}
          </div>

          <div className="row">
            <button className="btn" onClick={() => setFkDraft(null)}>Huỷ</button>
            <button
              className="btn btn-primary"
              disabled={
                busy || !fkDraft.name.trim() || !fkDraft.columns.length ||
                !fkDraft.referenced_table.trim() || !fkDraft.referenced_columns.trim()
              }
              onClick={async () => {
                const done = await run('Đã tạo khoá ngoại', () =>
                  api.createForeignKey(database, table, {
                    name: fkDraft.name.trim(),
                    columns: fkDraft.columns,
                    referenced_table: fkDraft.referenced_table.trim(),
                    referenced_columns: fkDraft.referenced_columns
                      .split(',')
                      .map((part) => part.trim())
                      .filter(Boolean),
                    on_delete: fkDraft.on_delete || null,
                    on_update: fkDraft.on_update || null,
                  }),
                )
                if (done) setFkDraft(null)
              }}
            >
              Tạo khoá ngoại
            </button>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </section>
  )
}
