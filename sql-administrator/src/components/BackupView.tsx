/**
 * Dump a database, and load one back.
 *
 * Two things this panel takes seriously, because both are ways to lose data:
 *
 * * **A dump can be incomplete.** `max_rows_per_table` exists so one huge table
 *   cannot exhaust memory, and a dump that quietly stopped at the cap would be
 *   a backup you find out is short only when you need it. The server reports
 *   which tables it cut, and that warning is shown, not buried.
 * * **A restore is destructive.** A dump taken with "DROP IF EXISTS" begins by
 *   dropping every table it is about to recreate. So restoring asks the user to
 *   type the database name, and the server independently refuses a restore
 *   whose confirmation does not match the target.
 */

import { useState } from 'react'

import { api, ApiError } from '../lib/api'
import { formatBytes } from '../lib/format'
import { useStore } from '../store'
import type { BackupResult, RestoreResult } from '../types'
import { useConfirm } from './useConfirm'

export function BackupView() {
  const database = useStore((state) => state.currentDatabase)
  const notify = useStore((state) => state.notify)
  const [confirm, confirmDialog] = useConfirm()

  const [options, setOptions] = useState({
    include_schema: true,
    include_data: true,
    include_views: true,
    include_routines: true,
    drop_if_exists: true,
    max_rows_per_table: 100000,
  })
  const [backup, setBackup] = useState<BackupResult | null>(null)
  const [restoreText, setRestoreText] = useState('')
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [stopOnError, setStopOnError] = useState(true)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)

  if (!database) {
    return <div className="empty-state">Chọn một database ở thanh bên để sao lưu hoặc phục hồi.</div>
  }

  const toggle = (key: keyof typeof options) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setOptions({ ...options, [key]: event.target.checked })

  const runBackup = async () => {
    setBusy('backup')
    setBackup(null)
    try {
      const result = await api.backupDatabase(database, options)
      setBackup(result)
      notify('success', `Đã sao lưu ${result.tables} bảng, ${result.rows} dòng`)
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : 'Sao lưu thất bại')
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
    reader.onerror = () => notify('error', 'Không đọc được file')
    reader.readAsText(file)
  }

  const runRestore = async () => {
    const ok = await confirm({
      title: `Phục hồi vào ${database}?`,
      message:
        'Bản sao lưu có thể chứa DROP TABLE, nghĩa là dữ liệu hiện tại trong database này sẽ bị ghi đè. ' +
        'Không hoàn tác được.',
      confirmLabel: 'Phục hồi',
      danger: true,
      // Typing the name is the last guard before an irreversible write.
      requireText: database,
    })
    if (!ok) return

    setBusy('restore')
    setRestoreResult(null)
    try {
      const result = await api.restoreDatabase(database, restoreText, { stopOnError })
      setRestoreResult(result)
      notify(
        // A partial restore is a failure to report, not a warning to shrug at:
        // the panel below lists exactly which statements did not run.
        result.failed ? 'error' : 'success',
        result.failed
          ? `Chạy ${result.executed}/${result.statements} câu lệnh, ${result.failed} lỗi`
          : `Đã chạy ${result.executed} câu lệnh`,
      )
    } catch (cause) {
      notify('error', cause instanceof ApiError ? cause.message : 'Phục hồi thất bại')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="backup-view">
      <section className="panel-body">
        <h3>Sao lưu <code>{database}</code></h3>

        <div className="checkbox-grid">
          <label className="check"><input type="checkbox" checked={options.include_schema} onChange={toggle('include_schema')} /> Cấu trúc bảng</label>
          <label className="check"><input type="checkbox" checked={options.include_data} onChange={toggle('include_data')} /> Dữ liệu</label>
          <label className="check"><input type="checkbox" checked={options.include_views} onChange={toggle('include_views')} /> Views</label>
          <label className="check"><input type="checkbox" checked={options.include_routines} onChange={toggle('include_routines')} /> Functions &amp; procedures</label>
          <label className="check"><input type="checkbox" checked={options.drop_if_exists} onChange={toggle('drop_if_exists')} /> Thêm DROP IF EXISTS</label>
        </div>

        <label className="field field-narrow">
          <span>Tối đa số dòng mỗi bảng</span>
          <input
            type="number"
            min={1}
            max={1000000}
            value={options.max_rows_per_table}
            onChange={(event) =>
              setOptions({ ...options, max_rows_per_table: Number(event.target.value) || 1 })
            }
          />
        </label>

        <div className="row">
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => void runBackup()}>
            {busy === 'backup' ? 'Đang sao lưu…' : 'Tạo bản sao lưu'}
          </button>
          {backup ? <button className="btn" onClick={download}>⬇ Tải file .sql</button> : null}
        </div>

        {backup ? (
          <div className="result-card">
            <div className="stat-row">
              <div className="stat"><span>Bảng</span><b>{backup.tables}</b></div>
              <div className="stat"><span>Dòng</span><b>{backup.rows}</b></div>
              <div className="stat"><span>Views</span><b>{backup.views}</b></div>
              <div className="stat"><span>Routines</span><b>{backup.routines}</b></div>
              <div className="stat"><span>Kích thước</span><b>{formatBytes(backup.bytes)}</b></div>
            </div>

            {backup.truncated_tables.length ? (
              <p className="notice notice-warn">
                Các bảng sau bị cắt bớt ở mức {options.max_rows_per_table} dòng:{' '}
                <b>{backup.truncated_tables.join(', ')}</b>. Bản sao lưu này <b>không đầy đủ</b> — tăng giới hạn
                rồi chạy lại nếu cần bản đầy đủ.
              </p>
            ) : null}

            <details>
              <summary>Xem nội dung ({formatBytes(backup.bytes)})</summary>
              <pre className="dump-preview">{backup.content.slice(0, 20000)}</pre>
              {backup.content.length > 20000 ? <p className="hint">Chỉ hiển thị 20.000 ký tự đầu.</p> : null}
            </details>
          </div>
        ) : null}
      </section>

      <section className="panel-body">
        <h3>Phục hồi vào <code>{database}</code></h3>
        <p className="notice notice-danger">
          Phục hồi sẽ chạy nguyên nội dung dưới đây trên database <b>{database}</b>. Nếu bản sao lưu có
          <code>DROP TABLE</code>, dữ liệu hiện tại sẽ mất.
        </p>

        <div className="row">
          <label className="btn btn-sm">
            ⬆ Chọn file .sql
            <input type="file" accept=".sql,text/plain" hidden onChange={loadFile} />
          </label>
          <label className="check">
            <input type="checkbox" checked={stopOnError} onChange={(event) => setStopOnError(event.target.checked)} />
            Dừng ở lỗi đầu tiên
          </label>
          <span className="hint">
            Tắt để chạy tiếp qua lỗi — hữu ích khi một câu lệnh hỏng không nên chặn 999 câu còn lại.
          </span>
        </div>

        <textarea
          className="mono"
          rows={10}
          placeholder="Dán nội dung .sql vào đây, hoặc chọn file ở trên"
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
              <div className="stat"><span>Câu lệnh</span><b>{restoreResult.statements}</b></div>
              <div className="stat"><span>Đã chạy</span><b>{restoreResult.executed}</b></div>
              <div className="stat"><span>Lỗi</span><b>{restoreResult.failed}</b></div>
              <div className="stat"><span>Thời gian</span><b>{Math.round(restoreResult.duration_ms)} ms</b></div>
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
