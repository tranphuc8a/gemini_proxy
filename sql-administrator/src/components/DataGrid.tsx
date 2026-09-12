import { isNumericColumn, renderCell, truncate } from '../lib/format'
import type { CellValue, ColumnInfo } from '../types'

interface Props {
  columns: string[]
  rows: CellValue[][]
  /** Column metadata, when known, drives alignment and key badges. */
  meta?: ColumnInfo[]
  sort?: { column: string; direction: 'asc' | 'desc' } | null
  onSort?: (column: string) => void
  selectable?: boolean
  selected?: number[]
  onToggleRow?: (index: number) => void
  onToggleAll?: () => void
  onEditRow?: (index: number) => void
  emptyMessage?: string
}

export function DataGrid({
  columns,
  rows,
  meta,
  sort,
  onSort,
  selectable = false,
  selected = [],
  onToggleRow,
  onToggleAll,
  onEditRow,
  emptyMessage = 'No rows',
}: Props) {
  const metaByName = new Map((meta ?? []).map((column) => [column.name, column]))
  const allSelected = rows.length > 0 && selected.length === rows.length

  if (columns.length === 0) {
    return <p className="grid-empty">{emptyMessage}</p>
  }

  return (
    <div className="grid-scroll">
      <table className="grid">
        <thead>
          <tr>
            {selectable ? (
              <th className="grid-select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll?.()}
                  aria-label="Select all rows on this page"
                />
              </th>
            ) : null}
            {onEditRow ? <th className="grid-actions" /> : null}
            {columns.map((column) => {
              const info = metaByName.get(column)
              const active = sort?.column === column
              return (
                <th
                  key={column}
                  className={`${isNumericColumn(info) ? 'is-numeric' : ''}${onSort ? ' is-sortable' : ''}`}
                  onClick={onSort ? () => onSort(column) : undefined}
                  title={info ? `${info.column_type}${info.nullable ? ' NULL' : ' NOT NULL'}` : column}
                >
                  <span className="grid-th">
                    {column}
                    {info?.key === 'PRI' ? <span className="badge badge-pk">PK</span> : null}
                    {active ? <span className="sort-arrow">{sort?.direction === 'asc' ? '▲' : '▼'}</span> : null}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="grid-empty" colSpan={columns.length + (selectable ? 1 : 0) + (onEditRow ? 1 : 0)}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={selected.includes(rowIndex) ? 'is-selected' : undefined}>
                {selectable ? (
                  <td className="grid-select">
                    <input
                      type="checkbox"
                      checked={selected.includes(rowIndex)}
                      onChange={() => onToggleRow?.(rowIndex)}
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </td>
                ) : null}
                {onEditRow ? (
                  <td className="grid-actions">
                    <button type="button" className="link-btn" onClick={() => onEditRow(rowIndex)}>
                      edit
                    </button>
                  </td>
                ) : null}
                {row.map((value, cellIndex) => {
                  const info = metaByName.get(columns[cellIndex])
                  const { text, isNull, isBinary } = renderCell(value)
                  return (
                    <td
                      key={cellIndex}
                      className={[
                        isNumericColumn(info) ? 'is-numeric' : '',
                        isNull ? 'is-null' : '',
                        isBinary ? 'is-binary' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={isNull || isBinary ? text : String(text)}
                    >
                      {truncate(text)}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
