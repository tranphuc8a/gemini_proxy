/**
 * Templates, the browser's saved drawings, and the server's.
 *
 * All three in one panel because they answer the same question — "what am I
 * opening?" — and because the difference between "in this browser" and "on the
 * server" is exactly what a user needs to see side by side before they trust
 * either one.
 */

import { useEffect, useState } from 'react'
import { useEditor } from '../store'
import { TEMPLATES } from '../lib/templates'
import { listLocal, type LocalEntry } from '../services/graphStorage'
import type { StorageBackend } from '../types'
import './Library.css'

const BACKEND_LABELS: { id: StorageBackend; label: string; hint: string }[] = [
  { id: 'json', label: 'JSON file', hint: 'Không cần database' },
  { id: 'mysql', label: 'MySQL / MariaDB', hint: 'Bền qua mỗi lần deploy' },
  { id: 'mongo', label: 'MongoDB', hint: 'Lưu dạng document' }
]

interface LibraryProps {
  open: boolean
  onClose: () => void
  onOpenAuth: () => void
}

function Library({ open, onClose, onOpenAuth }: LibraryProps) {
  const settings = useEditor((state) => state.settings)
  const backends = useEditor((state) => state.backends)
  const remoteGraphs = useEditor((state) => state.remoteGraphs)
  const isAdmin = useEditor((state) => state.isAdmin)
  const busy = useEditor((state) => state.busy)
  const currentId = useEditor((state) => state.document.id)

  const newDocument = useEditor((state) => state.newDocument)
  const openLocal = useEditor((state) => state.openLocal)
  const refreshRemote = useEditor((state) => state.refreshRemote)
  const openRemote = useEditor((state) => state.openRemote)
  const deleteRemote = useEditor((state) => state.deleteRemote)
  const updateSettings = useEditor((state) => state.updateSettings)

  const [tab, setTab] = useState<'templates' | 'local' | 'remote'>('templates')
  const [local, setLocal] = useState<LocalEntry[]>([])

  // Re-read on open rather than keeping a copy in the store: another tab may
  // have saved since, and this list is cheap to rebuild.
  useEffect(() => {
    if (open) setLocal(listLocal())
  }, [open])

  useEffect(() => {
    if (open && tab === 'remote') void refreshRemote()
  }, [open, tab, settings.backend, refreshRemote])

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="library panel-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Thư viện đồ thị">
        <header className="library-head">
          <nav className="tabs">
            <button className={`tab${tab === 'templates' ? ' is-active' : ''}`} onClick={() => setTab('templates')}>Mẫu</button>
            <button className={`tab${tab === 'local' ? ' is-active' : ''}`} onClick={() => setTab('local')}>Trong trình duyệt ({local.length})</button>
            <button className={`tab${tab === 'remote' ? ' is-active' : ''}`} onClick={() => setTab('remote')}>Trên máy chủ</button>
          </nav>
          <button className="btn btn-icon" onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        {tab === 'templates' && (
          <div className="grid">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="card"
                onClick={() => {
                  newDocument(template.id)
                  onClose()
                }}
              >
                <b>{template.label}</b>
                <small>{template.note}</small>
              </button>
            ))}
          </div>
        )}

        {tab === 'local' && (
          <div className="list">
            {local.length === 0 && <p className="hint">Chưa có bản lưu nào trong trình duyệt này.</p>}
            {local.map((entry) => (
              <div key={entry.id} className={`row-item${entry.id === currentId ? ' is-current' : ''}`}>
                <button
                  className="row-main"
                  onClick={() => {
                    openLocal(entry.id)
                    onClose()
                  }}
                >
                  <b>{entry.title}</b>
                  <small>{entry.kind} · {entry.nodes} đỉnh · {entry.edges} cạnh · {new Date(entry.updatedAt).toLocaleString('vi-VN')}</small>
                </button>
              </div>
            ))}
            <p className="hint">
              Bản lưu cục bộ nằm trong <code>localStorage</code> của riêng trình duyệt này — xoá dữ liệu duyệt web là mất. Muốn giữ lâu dài thì lưu lên máy chủ.
            </p>
          </div>
        )}

        {tab === 'remote' && (
          <div className="list">
            <div className="backend-choices" role="radiogroup" aria-label="Nơi lưu trên máy chủ">
              {BACKEND_LABELS.map((option) => {
                const info = backends.find((entry) => entry.id === option.id)
                const disabled = info ? !info.available : false
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.backend === option.id}
                    className={`backend-choice${settings.backend === option.id ? ' is-active' : ''}`}
                    disabled={disabled}
                    title={disabled ? info?.reason ?? 'Máy chủ chưa cấu hình' : option.hint}
                    onClick={() => updateSettings({ backend: option.id })}
                  >
                    <b>{option.label}</b>
                    <small>{disabled ? info?.reason ?? 'Máy chủ chưa cấu hình' : option.hint}</small>
                  </button>
                )
              })}
            </div>

            <div className="row">
              <button className="btn btn-sm" onClick={() => void refreshRemote()} disabled={busy !== null}>Tải lại</button>
              {!isAdmin && <button className="btn btn-sm" onClick={onOpenAuth}>Mở khoá để lưu/xoá</button>}
              <span className="hint">Mỗi backend là một kho riêng — đồ thị lưu ở kho nào chỉ thấy được ở kho đó.</span>
            </div>

            {busy === 'list' && <p className="hint">Đang tải…</p>}
            {busy !== 'list' && remoteGraphs.length === 0 && <p className="hint">Chưa có đồ thị nào trên backend này.</p>}

            {remoteGraphs.map((entry) => (
              <div key={entry.id} className={`row-item${entry.id === currentId ? ' is-current' : ''}`}>
                <button
                  className="row-main"
                  onClick={() => {
                    void openRemote(entry.id)
                    onClose()
                  }}
                >
                  <b>{entry.title}</b>
                  <small>{entry.kind} · {entry.nodes} đỉnh · {entry.edges} cạnh · bản {entry.revision} · {new Date(entry.updated_at).toLocaleString('vi-VN')}</small>
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={!isAdmin || busy !== null}
                  onClick={() => {
                    // A server delete is not undoable from here, so it asks.
                    if (window.confirm(`Xoá "${entry.title}" khỏi máy chủ? Không hoàn tác được.`)) void deleteRemote(entry.id)
                  }}
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Library
