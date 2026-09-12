import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Environment, Tab } from '../types'
import { KeyValueEditor } from './KeyValueEditor'
import { Modal } from './Modal'
import { exportPostmanCollection, importAny } from '../lib/importers'
import { copyToClipboard, download, formatRelativeTime, kv } from '../lib/util'
import { collectionPaths } from '../lib/tree'
import { diffLines, diffableBody } from '../lib/diff'
import { IconCheck, IconLink, IconTrash } from './Icons'

// ---------------------------------------------------------------------------
// Save request
// ---------------------------------------------------------------------------
export function SaveRequestDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const collections = useStore((s) => s.collections)
  const saveTab = useStore((s) => s.saveTab)
  const addCollection = useStore((s) => s.addCollection)

  const [name, setName] = useState(tab.draft.name)
  const [collectionId, setCollectionId] = useState(tab.draft.collectionId ?? '')

  const paths = useMemo(() => collectionPaths(collections), [collections])

  const submit = () => {
    if (!name.trim()) return
    saveTab(tab.id, name.trim(), collectionId || null)
    onClose()
  }

  return (
    <Modal
      title="Lưu request"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
            Lưu
          </button>
        </>
      }
    >
      <div className="form-group">
        <label htmlFor="save-name">Tên request</label>
        <input
          id="save-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="form-group">
        <label htmlFor="save-collection">Collection</label>
        <select id="save-collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
          <option value="">— Không thuộc collection nào —</option>
          {paths.map(({ id, path }) => (
            <option key={id} value={id}>
              {path}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn btn-sm"
        onClick={() => {
          const newName = prompt('Tên collection mới:')
          if (newName?.trim()) setCollectionId(addCollection(newName.trim(), null).id)
        }}
      >
        Tạo collection mới
      </button>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------
export function EnvironmentsDialog({ onClose }: { onClose: () => void }) {
  const environments = useStore((s) => s.environments)
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId)
  const addEnvironment = useStore((s) => s.addEnvironment)
  const updateEnvironment = useStore((s) => s.updateEnvironment)
  const deleteEnvironment = useStore((s) => s.deleteEnvironment)
  const setActiveEnvironment = useStore((s) => s.setActiveEnvironment)

  const [selectedId, setSelectedId] = useState(activeEnvironmentId ?? environments[0]?.id ?? '')
  const selected: Environment | undefined = environments.find((e) => e.id === selectedId)

  return (
    <Modal
      title="Environments"
      onClose={onClose}
      wide
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Xong
        </button>
      }
    >
      <div className="field-row">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">— Chọn environment —</option>
          {environments.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          onClick={() => {
            const name = prompt('Tên environment:')
            if (name?.trim()) setSelectedId(addEnvironment(name.trim()).id)
          }}
        >
          Tạo mới
        </button>
        {selected ? (
          <>
            <button
              className="btn btn-sm"
              onClick={() => {
                const name = prompt('Tên mới:', selected.name)
                if (name?.trim()) updateEnvironment(selected.id, { name: name.trim() })
              }}
            >
              Đổi tên
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setActiveEnvironment(selected.id)}
              disabled={activeEnvironmentId === selected.id}
            >
              {activeEnvironmentId === selected.id ? (
                <>
                  <IconCheck /> Đang dùng
                </>
              ) : (
                'Dùng cái này'
              )}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (confirm(`Xóa environment "${selected.name}"?`)) {
                  deleteEnvironment(selected.id)
                  setSelectedId('')
                }
              }}
            >
              <IconTrash /> Xóa
            </button>
          </>
        ) : null}
      </div>

      {selected ? (
        <KeyValueEditor
          rows={selected.vars.length ? selected.vars : [kv()]}
          onChange={(vars) => updateEnvironment(selected.id, { vars })}
          keyPlaceholder="Tên biến"
          valuePlaceholder="Giá trị"
        />
      ) : (
        <div className="empty">Chọn hoặc tạo một environment để sửa biến.</div>
      )}

      <p className="hint">
        Dùng <code>{'{{TÊN_BIẾN}}'}</code> trong URL, header, cookie, auth và body. Giá trị chỉ được thay lúc gửi, form
        của bạn vẫn giữ nguyên template — nên đổi environment là đổi được cả request.
      </p>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const proxyAvailable = useStore((s) => s.proxyAvailable)
  const checkProxy = useStore((s) => s.checkProxy)
  const resetEverything = useStore((s) => s.resetEverything)

  return (
    <Modal
      title="Cài đặt"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Xong
        </button>
      }
    >
      <div className={`notice ${proxyAvailable ? 'notice-ok' : 'notice-warn'}`}>
        {proxyAvailable
          ? 'Proxy backend đang sẵn sàng — request bị CORS chặn sẽ được gửi hộ.'
          : 'Không thấy proxy backend. Chạy FastAPI và đặt PROXY_ENABLED=true, nếu không chế độ Auto/Proxy sẽ lỗi.'}
        <div style={{ marginTop: 6 }}>
          <button className="btn btn-sm" onClick={checkProxy}>
            Kiểm tra lại
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="set-timeout">Timeout (giây)</label>
        <input
          id="set-timeout"
          type="number"
          min={1}
          max={600}
          value={settings.timeoutSeconds}
          onChange={(e) => updateSettings({ timeoutSeconds: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>

      <div className="form-group">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.followRedirects}
            onChange={(e) => updateSettings({ followRedirects: e.target.checked })}
          />
          Tự động đi theo redirect (3xx)
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.withCredentials}
            onChange={(e) => updateSettings({ withCredentials: e.target.checked })}
          />
          Gửi kèm cookie của trình duyệt (chỉ có tác dụng ở chế độ Direct)
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox">
          <input type="checkbox" checked={settings.autoSync} onChange={(e) => updateSettings({ autoSync: e.target.checked })} />
          Tự tải workspace về khi mở app
        </label>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <button
        className="btn btn-danger"
        onClick={() => {
          if (confirm('Xóa toàn bộ collections, requests và environments trong trình duyệt?\nWorkspace trên server không bị ảnh hưởng.')) {
            resetEverything()
            onClose()
          }
        }}
      >
        <IconTrash /> Xóa toàn bộ dữ liệu cục bộ
      </button>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const importBundle = useStore((s) => s.importBundle)
  const collections = useStore((s) => s.collections)
  const requests = useStore((s) => s.requests)
  const toast = useStore((s) => s.toast)
  const [text, setText] = useState('')

  const doImport = () => {
    try {
      const result = importAny(text)
      importBundle(result)
      const summary = `${result.collections.length} collection, ${result.requests.length} request`
      toast('success', `Đã import ${summary}`)
      result.warnings.forEach((warning) => toast('warn', warning))
      onClose()
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  return (
    <Modal
      title="Import / Export"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={doImport} disabled={!text.trim()}>
            Import
          </button>
        </>
      }
    >
      <div className="form-group">
        <label htmlFor="import-file">Chọn file JSON</label>
        <input
          id="import-file"
          type="file"
          accept="application/json,.json,.yaml,.yml"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) setText(await file.text())
          }}
        />
      </div>

      <textarea
        className="code-area"
        style={{ minHeight: 190 }}
        value={text}
        placeholder="…hoặc dán nội dung vào đây: Postman Collection v2.x, OpenAPI 3, Swagger 2"
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

      <p className="hint">
        Nhận diện định dạng tự động. Với OpenAPI, mỗi <code>tag</code> thành một collection con và server URL được đưa
        vào biến <code>{'{{BASE_URL}}'}</code>.
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div className="field-row">
        <span className="field-label">Export</span>
        <button
          className="btn btn-sm"
          onClick={() =>
            download(
              `postman-lite-pro-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify(exportPostmanCollection(collections, requests), null, 2),
              'application/json',
            )
          }
        >
          Tải về dạng Postman Collection v2.1
        </button>
      </div>
      <p className="hint">File này import ngược lại được vào Postman thật, hoặc vào chính app này.</p>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Workspace sync
// ---------------------------------------------------------------------------
export function WorkspaceDialog({ onClose }: { onClose: () => void }) {
  const workspace = useStore((s) => s.workspace)
  const syncing = useStore((s) => s.syncing)
  const createWorkspace = useStore((s) => s.createWorkspace)
  const connectWorkspace = useStore((s) => s.connectWorkspace)
  const pullWorkspace = useStore((s) => s.pullWorkspace)
  const pushWorkspace = useStore((s) => s.pushWorkspace)
  const disconnectWorkspace = useStore((s) => s.disconnectWorkspace)
  const toggleShare = useStore((s) => s.toggleShare)
  const toast = useStore((s) => s.toast)

  const [name, setName] = useState('My Workspace')
  const [joinId, setJoinId] = useState('')
  const [joinKey, setJoinKey] = useState('')

  const shareUrl = workspace?.shareToken
    ? `${location.origin}${location.pathname}?share=${workspace.shareToken}`
    : ''

  return (
    <Modal
      title="Workspace"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {workspace ? (
        <>
          <div className="notice notice-ok">
            Đang kết nối <b>{workspace.name}</b> · revision {workspace.revision}
            {workspace.lastSyncedAt ? ` · đồng bộ ${formatRelativeTime(workspace.lastSyncedAt)}` : ''}
          </div>

          <div className="field-row">
            <button className="btn" onClick={() => pullWorkspace()} disabled={syncing}>
              Tải về
            </button>
            <button className="btn btn-primary" onClick={() => pushWorkspace()} disabled={syncing}>
              Đẩy lên
            </button>
            <button className="btn btn-danger" onClick={() => { disconnectWorkspace(); onClose() }}>
              Ngắt kết nối
            </button>
          </div>

          <p className="hint">
            Lưu bằng khoá lạc quan: nếu ai đó đã lưu trước bạn, server từ chối và nhắc bạn "Tải về" rồi đẩy lại — thay vì
            im lặng ghi đè công của họ.
          </p>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>ID &amp; access key (dùng để mở workspace này trên máy khác)</label>
            <input readOnly value={workspace.id} onFocus={(e) => e.target.select()} />
            <input readOnly value={workspace.accessKey} onFocus={(e) => e.target.select()} style={{ marginTop: 4 }} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <label className="checkbox">
            <input type="checkbox" checked={Boolean(workspace.shareToken)} onChange={(e) => toggleShare(e.target.checked)} />
            Bật link chia sẻ chỉ-đọc
          </label>

          {shareUrl ? (
            <div className="field-row" style={{ marginTop: 8 }}>
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const ok = await copyToClipboard(shareUrl)
                  toast(ok ? 'success' : 'error', ok ? 'Đã copy link' : 'Trình duyệt chặn clipboard')
                }}
              >
                <IconLink /> Copy
              </button>
            </div>
          ) : null}

          <p className="hint">
            Link chia sẻ chỉ để lộ collection và request. <b>Environment không nằm trong link</b> — đó là chỗ chứa token
            và mật khẩu.
          </p>
        </>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Workspace lưu collection, request và environment lên backend FastAPI, để mở được từ máy khác và không mất khi
            xoá cache trình duyệt.
          </p>

          <div className="form-group">
            <label htmlFor="ws-name">Tạo workspace mới</label>
            <div className="field-row">
              <input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => createWorkspace(name.trim() || 'My Workspace')} disabled={syncing}>
                Tạo
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div className="form-group">
            <label htmlFor="ws-id">Hoặc kết nối workspace có sẵn</label>
            <input id="ws-id" placeholder="Workspace ID (ws_…)" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
            <input
              placeholder="Access key"
              value={joinKey}
              onChange={(e) => setJoinKey(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
          <button
            className="btn"
            onClick={() => connectWorkspace(joinId.trim(), joinKey.trim())}
            disabled={syncing || !joinId.trim() || !joinKey.trim()}
          >
            Kết nối
          </button>
          <p className="hint">
            Kết nối sẽ <b>thay thế</b> dữ liệu đang có trong trình duyệt bằng dữ liệu trên server. Export trước nếu bạn
            chưa lưu gì.
          </p>
        </>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
export function RunnerDialog({ onClose }: { onClose: () => void }) {
  const rows = useStore((s) => s.runnerRows)
  const running = useStore((s) => s.runnerRunning)

  const totals = rows.reduce(
    (acc, row) => {
      acc.tests += row.tests.length
      acc.failed += row.tests.filter((t) => !t.passed).length + (row.status === 'failed' ? 1 : 0)
      return acc
    },
    { tests: 0, failed: 0 },
  )

  return (
    <Modal
      title={running ? 'Collection runner — đang chạy…' : 'Collection runner'}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className="btn"
            onClick={() =>
              download(
                `runner-${Date.now()}.json`,
                JSON.stringify(rows, null, 2),
                'application/json',
              )
            }
            disabled={!rows.length}
          >
            Xuất kết quả
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      {rows.length ? (
        <>
          <div className="field-row">
            <span className="chip">{rows.length} request</span>
            <span className="chip">{totals.tests} test</span>
            <span className={`chip ${totals.failed ? 'chip-danger' : 'chip-ok'}`}>{totals.failed} lỗi</span>
          </div>
          <table className="runner-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Status</th>
                <th>Thời gian</th>
                <th>Tests</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.requestId}>
                  <td>{row.name}</td>
                  <td>
                    {row.status === 'running' ? (
                      <span className="chip">đang chạy…</span>
                    ) : row.status === 'pending' ? (
                      <span className="chip faint">chờ</span>
                    ) : row.status === 'failed' ? (
                      <span className="chip chip-danger" title={row.error}>
                        lỗi
                      </span>
                    ) : (
                      <span className={`status-pill ${row.httpStatus && row.httpStatus < 400 ? 'status-2xx' : 'status-4xx'}`}>
                        {row.httpStatus}
                      </span>
                    )}
                  </td>
                  <td>{row.timeMs != null ? `${row.timeMs} ms` : '—'}</td>
                  <td>
                    {row.error ? <div className="test-fail">{row.error}</div> : null}
                    {row.tests.map((test, index) => (
                      <div key={index} className={test.passed ? 'test-pass' : 'test-fail'}>
                        {test.passed ? '✓' : '✗'} {test.name}
                        {test.error ? <div className="faint">{test.error}</div> : null}
                      </div>
                    ))}
                    {!row.tests.length && !row.error ? <span className="faint">không có test</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="empty">
          Bấm ▶ trên một collection ở sidebar để chạy toàn bộ request bên trong, theo thứ tự.
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------
export function DiffDialog({ onClose }: { onClose: () => void }) {
  const left = useStore((s) => s.diffLeft)
  const right = useStore((s) => s.diffRight)
  const setDiff = useStore((s) => s.setDiff)

  const lines = useMemo(() => {
    if (!left || !right) return null
    return diffLines(diffableBody(left.bytes, left.contentType), diffableBody(right.bytes, right.contentType))
  }, [left, right])

  return (
    <Modal
      title="So sánh response"
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              setDiff('left', null)
              setDiff('right', null)
            }}
          >
            Xóa cả hai
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      {!left || !right ? (
        <div className="empty">
          Chọn hai response để so sánh: bấm <b>A</b> rồi <b>B</b> ở thanh meta của response.
          <div style={{ marginTop: 8 }}>
            A: {left ? `${left.status} · ${formatRelativeTime(left.receivedAt)}` : 'chưa chọn'} · B:{' '}
            {right ? `${right.status} · ${formatRelativeTime(right.receivedAt)}` : 'chưa chọn'}
          </div>
        </div>
      ) : (
        <>
          <div className="field-row">
            <span className="chip">A · {left.status} · {left.timeMs} ms</span>
            <span className="chip">B · {right.status} · {right.timeMs} ms</span>
          </div>
          <div className="diff-grid">
            <div className="diff-side">
              {lines!.map((line, index) => (
                <div key={index} className={`diff-line ${line.leftClass}`}>
                  <span className="ln">{line.leftNo ?? ''}</span>
                  <span>{line.left ?? ''}</span>
                </div>
              ))}
            </div>
            <div className="diff-side">
              {lines!.map((line, index) => (
                <div key={index} className={`diff-line ${line.rightClass}`}>
                  <span className="ln">{line.rightNo ?? ''}</span>
                  <span>{line.right ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

