/**
 * Views, functions, procedures and triggers — the parts of a schema that are
 * not tables.
 *
 * They share a panel because they share a shape: each is a named object whose
 * body is SQL, and the useful operations are read it, replace it, drop it. A
 * table needs a grid and a structure editor; these need a text box and a list.
 *
 * Editing a routine means handing over the whole `CREATE PROCEDURE …`. That is
 * unavoidable — a routine body is a program, not a set of fields — and the
 * server refuses anything that is not a CREATE FUNCTION/PROCEDURE, so this box
 * cannot become a second SQL console.
 */

import { useCallback, useEffect, useState } from 'react'

import { api, ApiError } from '../lib/api'
import { useStore } from '../store'
import type { RoutineInfo, TriggerInfo, ViewInfo } from '../types'
import { useConfirm } from './useConfirm'

type Tab = 'views' | 'routines' | 'triggers'

const NEW_VIEW = { name: '', select: 'SELECT 1' }

const ROUTINE_TEMPLATE = `CREATE PROCEDURE ten_thu_tuc(IN tham_so INT)
BEGIN
  SELECT tham_so;
END`

export function ObjectsView() {
  const database = useStore((state) => state.currentDatabase)
  const notify = useStore((state) => state.notify)
  const [confirm, confirmDialog] = useConfirm()

  const [tab, setTab] = useState<Tab>('views')
  const [views, setViews] = useState<ViewInfo[]>([])
  const [routines, setRoutines] = useState<RoutineInfo[]>([])
  const [triggers, setTriggers] = useState<TriggerInfo[]>([])
  const [loading, setLoading] = useState(false)

  const [editingView, setEditingView] = useState<{ name: string; select: string } | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!database) return
    setLoading(true)
    try {
      const [v, r, t] = await Promise.all([
        api.listViews(database),
        api.listRoutines(database),
        api.listTriggers(database),
      ])
      setViews(v)
      setRoutines(r)
      setTriggers(t)
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : 'Không tải được danh sách đối tượng')
    } finally {
      setLoading(false)
    }
  }, [database, notify])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!database) {
    return <div className="empty-state">Chọn một database ở thanh bên để xem view, function và procedure.</div>
  }

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      notify('success', label)
      await refresh()
      return true
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : `Không ${label.toLowerCase()}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const openView = async (name: string) => {
    try {
      const found = await api.getView(database, name)
      // SHOW CREATE VIEW returns the whole statement; the editor wants only the
      // SELECT, so the prefix is trimmed when it is recognisable.
      const definition = found.definition ?? ''
      const at = definition.toUpperCase().lastIndexOf(' AS SELECT')
      setEditingView({
        name: found.name,
        select: at === -1 ? definition : definition.slice(at + 4),
      })
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : 'Không đọc được view')
    }
  }

  const openRoutine = async (routine: RoutineInfo) => {
    try {
      const full = await api.getRoutine(database, routine.kind, routine.name)
      setEditingRoutine(full.definition || ROUTINE_TEMPLATE)
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : 'Không đọc được routine')
    }
  }

  return (
    <div className="objects-view">
      <header className="panel-head">
        <nav className="tabs" role="tablist">
          <button className={`tab${tab === 'views' ? ' is-active' : ''}`} onClick={() => setTab('views')}>
            Views ({views.length})
          </button>
          <button className={`tab${tab === 'routines' ? ' is-active' : ''}`} onClick={() => setTab('routines')}>
            Functions &amp; Procedures ({routines.length})
          </button>
          <button className={`tab${tab === 'triggers' ? ' is-active' : ''}`} onClick={() => setTab('triggers')}>
            Triggers ({triggers.length})
          </button>
        </nav>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </header>

      {tab === 'views' ? (
        <section className="panel-body">
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => setEditingView({ ...NEW_VIEW })}>
              + View mới
            </button>
          </div>

          {views.length === 0 ? (
            <p className="hint">Database này chưa có view nào.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Sửa được?</th>
                  <th>Definer</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {views.map((view) => (
                  <tr key={view.name}>
                    <td className="mono">{view.name}</td>
                    <td>{view.updatable ? 'có' : 'không'}</td>
                    <td className="dim">{view.definer ?? '—'}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => void openView(view.name)}>Sửa</button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={async () => {
                          if (!(await confirm({
                            title: `Xoá view ${view.name}?`,
                            message: 'View sẽ bị xoá khỏi database. Dữ liệu trong bảng gốc không bị ảnh hưởng.',
                            confirmLabel: 'Xoá view',
                            danger: true,
                          }))) return
                          await run('Đã xoá view', () => api.dropView(database, view.name))
                        }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {editingView ? (
            <div className="editor-card">
              <h3>{editingView.name ? `Sửa view ${editingView.name}` : 'View mới'}</h3>
              <label className="field">
                <span>Tên view</span>
                <input
                  value={editingView.name}
                  onChange={(event) => setEditingView({ ...editingView, name: event.target.value })}
                  placeholder="v_ten_view"
                />
              </label>
              <label className="field">
                <span>Câu SELECT</span>
                <textarea
                  className="mono"
                  rows={8}
                  value={editingView.select}
                  onChange={(event) => setEditingView({ ...editingView, select: event.target.value })}
                />
              </label>
              <p className="hint">
                Chỉ nhận đúng một câu SELECT. Máy chủ từ chối nhiều câu lệnh, nên ô này không thể dùng thay console.
              </p>
              <div className="row">
                <button className="btn" onClick={() => setEditingView(null)}>Huỷ</button>
                <button
                  className="btn btn-primary"
                  disabled={busy || !editingView.name.trim() || !editingView.select.trim()}
                  onClick={async () => {
                    const saved = await run('Đã lưu view', () =>
                      api.saveView(database, { name: editingView.name.trim(), select: editingView.select }),
                    )
                    if (saved) setEditingView(null)
                  }}
                >
                  Lưu view
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'routines' ? (
        <section className="panel-body">
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => setEditingRoutine(ROUTINE_TEMPLATE)}>
              + Routine mới
            </button>
          </div>

          {routines.length === 0 ? (
            <p className="hint">Database này chưa có function hay procedure nào.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Tên</th>
                  <th>Tham số</th>
                  <th>Trả về</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {routines.map((routine) => (
                  <tr key={`${routine.kind}:${routine.name}`}>
                    <td><span className="badge">{routine.kind}</span></td>
                    <td className="mono">{routine.name}</td>
                    <td className="dim mono">{routine.parameters || '—'}</td>
                    <td className="dim mono">{routine.returns || '—'}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => void openRoutine(routine)}>Xem/Sửa</button>
                      {routine.kind === 'PROCEDURE' && !routine.parameters ? (
                        <button
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() => void run('Đã gọi procedure', () => api.callRoutine(database, routine.name))}
                        >
                          Gọi
                        </button>
                      ) : null}
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={async () => {
                          if (!(await confirm({
                            title: `Xoá ${routine.kind.toLowerCase()} ${routine.name}?`,
                            message: 'Không hoàn tác được.',
                            confirmLabel: 'Xoá',
                            danger: true,
                          }))) return
                          await run('Đã xoá routine', () => api.dropRoutine(database, routine.kind, routine.name))
                        }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {editingRoutine !== null ? (
            <div className="editor-card">
              <h3>Định nghĩa routine</h3>
              <textarea
                className="mono"
                rows={14}
                value={editingRoutine}
                onChange={(event) => setEditingRoutine(event.target.value)}
              />
              <p className="hint">
                Dán nguyên câu <code>CREATE FUNCTION</code> hoặc <code>CREATE PROCEDURE</code> — không cần
                <code>DELIMITER</code>, máy chủ gửi nguyên khối. Câu lệnh khác sẽ bị từ chối.
              </p>
              <div className="row">
                <button className="btn" onClick={() => setEditingRoutine(null)}>Huỷ</button>
                <button
                  className="btn btn-primary"
                  disabled={busy || !editingRoutine.trim()}
                  onClick={async () => {
                    const saved = await run('Đã lưu routine', () => api.saveRoutine(database, editingRoutine))
                    if (saved) setEditingRoutine(null)
                  }}
                >
                  Lưu routine
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'triggers' ? (
        <section className="panel-body">
          {triggers.length === 0 ? (
            <p className="hint">Database này chưa có trigger nào.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Bảng</th>
                  <th>Thời điểm</th>
                  <th>Sự kiện</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((trigger) => (
                  <tr key={trigger.name}>
                    <td className="mono">{trigger.name}</td>
                    <td className="mono">{trigger.table}</td>
                    <td>{trigger.timing}</td>
                    <td>{trigger.event}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="hint">
            Trigger chỉ xem được ở đây. Tạo hoặc sửa trigger cần <code>DELIMITER</code>, nên hãy dùng tab Console.
          </p>
        </section>
      ) : null}

      {confirmDialog}
    </div>
  )
}
