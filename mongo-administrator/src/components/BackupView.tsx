/**
 * Dump a database to Extended JSON, and load one back.
 *
 * Extended JSON rather than BSON, because `mongodump` is not available here
 * (no mongo tools in the process, nowhere to install them on a serverless
 * platform) and because a dump you can open in an editor and diff is worth
 * more than a compact one. ObjectId, dates, Decimal128 and binary all survive
 * the round trip — that is what the `$oid`/`$date` wrappers are for.
 *
 * Two guards, both because a restore can destroy data:
 *
 * * "Xoá collection trước khi nạp" is **off** by default. A restore that
 *   silently discarded what was already there would be a trap.
 * * With it on, the user types the database name, and the server independently
 *   refuses a restore whose confirmation does not match the target.
 */

import { useState } from 'react'

import { api } from '../lib/api'
import { useStore } from '../store'
import { useConfirm } from './useConfirm'

interface BackupResult {
  database: string
  filename: string
  media_type: string
  content: string
  collections: number
  documents: number
  indexes: number
  bytes: number
  truncated_collections: string[]
}

interface RestoreResult {
  database: string
  collections: number
  documents: number
  indexes: number
  failed: number
  duration_ms: number
  errors: string[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupView() {
  const database = useStore((state) => state.activeDb)
  const toast = useStore((state) => state.toast)
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [includeDocuments, setIncludeDocuments] = useState(true)
  const [includeIndexes, setIncludeIndexes] = useState(true)
  const [maxDocuments, setMaxDocuments] = useState(10000)
  const [backup, setBackup] = useState<BackupResult | null>(null)

  const [restoreText, setRestoreText] = useState('')
  const [dropExisting, setDropExisting] = useState(false)
  const [stopOnError, setStopOnError] = useState(true)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)

  if (!database) {
    return <div className="empty-state">Chọn một database ở thanh bên để sao lưu hoặc phục hồi.</div>
  }

  const runBackup = async () => {
    setBusy('backup')
    setBackup(null)
    try {
      const result = await api.backupDatabase(database, {
        include_documents: includeDocuments,
        include_indexes: includeIndexes,
        max_documents_per_collection: maxDocuments,
      })
      setBackup(result)
      toast('success', `Đã sao lưu ${result.collections} collection, ${result.documents} document`)
    } catch (cause) {
      toast('error', cause instanceof Error ? cause.message : 'Sao lưu thất bại')
    } finally {
      setBusy(null)
    }
  }

  const download = () => {
    if (!backup) return
    const blob = new Blob([backup.content], { type: backup.media_type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = backup.filename
    anchor.click()
    // Revoked late: revoking immediately can beat the download starting.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const loadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRestoreText(String(reader.result ?? ''))
    reader.onerror = () => toast('error', 'Không đọc được file')
    reader.readAsText(file)
  }

  const runRestore = async () => {
    const ok = await confirm({
      title: `Phục hồi vào ${database}?`,
      body: dropExisting
        ? `Mỗi collection trong bản sao lưu sẽ bị XOÁ rồi nạp lại trong "${database}". Không hoàn tác được.`
        : `Các document trong bản sao lưu sẽ được chèn thêm vào "${database}". Document trùng _id sẽ gây lỗi.`,
      confirmLabel: 'Phục hồi',
      danger: true,
      // Only demanded for the destructive variant: making people type a name to
      // add documents would train them to type it without reading.
      confirmWord: dropExisting ? database : undefined,
    })
    if (!ok) return

    setBusy('restore')
    setRestoreResult(null)
    try {
      const result = await api.restoreDatabase(database, restoreText, {
        drop_existing: dropExisting,
        stop_on_error: stopOnError,
      })
      setRestoreResult(result)
      toast(
        result.failed ? 'error' : 'success',
        result.failed
          ? `${result.collections} collection, ${result.failed} lỗi`
          : `Đã nạp ${result.documents} document vào ${result.collections} collection`,
      )
    } catch (cause) {
      toast('error', cause instanceof Error ? cause.message : 'Phục hồi thất bại')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="backup-view">
      <section className="panel-body">
        <h3>Sao lưu <code>{database}</code></h3>

        <div className="checkbox-grid">
          <label className="check">
            <input type="checkbox" checked={includeDocuments} onChange={(event) => setIncludeDocuments(event.target.checked)} />
            Document
          </label>
          <label className="check">
            <input type="checkbox" checked={includeIndexes} onChange={(event) => setIncludeIndexes(event.target.checked)} />
            Index
          </label>
        </div>

        <label className="field field-narrow">
          <span>Tối đa document mỗi collection</span>
          <input
            type="number"
            min={1}
            max={200000}
            value={maxDocuments}
            onChange={(event) => setMaxDocuments(Number(event.target.value) || 1)}
          />
        </label>

        <div className="row">
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => void runBackup()}>
            {busy === 'backup' ? 'Đang sao lưu…' : 'Tạo bản sao lưu'}
          </button>
          {backup ? <button className="btn" onClick={download}>⬇ Tải file .json</button> : null}
        </div>

        {backup ? (
          <div className="result-card">
            <div className="stat-row">
              <div className="stat"><span>Collection</span><b>{backup.collections}</b></div>
              <div className="stat"><span>Document</span><b>{backup.documents}</b></div>
              <div className="stat"><span>Index</span><b>{backup.indexes}</b></div>
              <div className="stat"><span>Kích thước</span><b>{formatBytes(backup.bytes)}</b></div>
            </div>

            {backup.truncated_collections.length ? (
              <p className="notice notice-warn">
                Bị cắt ở mức {maxDocuments} document: <b>{backup.truncated_collections.join(', ')}</b>.
                Bản sao lưu này <b>không đầy đủ</b>.
              </p>
            ) : null}

            <details>
              <summary>Xem nội dung</summary>
              <pre className="dump-preview">{backup.content.slice(0, 20000)}</pre>
              {backup.content.length > 20000 ? <p className="hint">Chỉ hiển thị 20.000 ký tự đầu.</p> : null}
            </details>
          </div>
        ) : null}
      </section>

      <section className="panel-body">
        <h3>Phục hồi vào <code>{database}</code></h3>

        <div className="row">
          <label className="btn btn-sm">
            ⬆ Chọn file .json
            <input type="file" accept=".json,application/json" hidden onChange={loadFile} />
          </label>
          <label className="check">
            <input type="checkbox" checked={dropExisting} onChange={(event) => setDropExisting(event.target.checked)} />
            Xoá collection trước khi nạp
          </label>
          <label className="check">
            <input type="checkbox" checked={stopOnError} onChange={(event) => setStopOnError(event.target.checked)} />
            Dừng ở lỗi đầu tiên
          </label>
        </div>

        {dropExisting ? (
          <p className="notice notice-danger">
            Mỗi collection có trong bản sao lưu sẽ bị <b>xoá sạch</b> rồi nạp lại. Dữ liệu hiện tại của chúng sẽ mất.
          </p>
        ) : (
          <p className="hint">
            Không xoá gì — document được chèn thêm. Nếu database đã có document trùng <code>_id</code>, lệnh chèn sẽ báo lỗi.
          </p>
        )}

        <textarea
          className="mono"
          rows={10}
          placeholder="Dán nội dung Extended JSON vào đây, hoặc chọn file ở trên"
          value={restoreText}
          onChange={(event) => setRestoreText(event.target.value)}
        />

        <div className="row">
          <button
            className="btn btn-danger"
            disabled={busy !== null || !restoreText.trim()}
            onClick={() => void runRestore()}
          >
            {busy === 'restore' ? 'Đang phục hồi…' : 'Phục hồi'}
          </button>
        </div>

        {restoreResult ? (
          <div className="result-card">
            <div className="stat-row">
              <div className="stat"><span>Collection</span><b>{restoreResult.collections}</b></div>
              <div className="stat"><span>Document</span><b>{restoreResult.documents}</b></div>
              <div className="stat"><span>Index</span><b>{restoreResult.indexes}</b></div>
              <div className="stat"><span>Lỗi</span><b>{restoreResult.failed}</b></div>
            </div>
            {restoreResult.errors.length ? (
              <details open>
                <summary>{restoreResult.errors.length} lỗi</summary>
                <ul className="error-list">
                  {restoreResult.errors.map((error, index) => (
                    <li key={index} className="mono">{error}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      {confirmDialog}
    </div>
  )
}
