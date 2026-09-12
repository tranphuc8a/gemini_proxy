import { useRef, useState } from 'react'

import { formatDuration, formatNumber } from '../lib/format'
import { statementAtCursor, toCsv, toJson } from '../lib/sql'
import { downloadText } from '../lib/storage'
import { useStore } from '../store'
import { DataGrid } from './DataGrid'
import { DownloadIcon, PlayIcon, TrashIcon } from './Icons'

export function SqlConsole() {
  const sql = useStore((state) => state.sql)
  const setSql = useStore((state) => state.setSql)
  const runSql = useStore((state) => state.runSql)
  const running = useStore((state) => state.running)
  const results = useStore((state) => state.results)
  const history = useStore((state) => state.history)
  const clearHistory = useStore((state) => state.clearHistory)
  const currentDatabase = useStore((state) => state.currentDatabase)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [showHistory, setShowHistory] = useState(false)

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd+Enter runs everything; Ctrl/Cmd+Shift+Enter runs just the
    // statement under the caret, which is how most SQL clients behave.
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        const statement = statementAtCursor(sql, editorRef.current?.selectionStart ?? 0)
        if (statement) void runSql(statement)
      } else {
        void runSql()
      }
    }
  }

  return (
    <div className="panel console">
      <div className="toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void runSql()} disabled={running}>
            <PlayIcon size={14} /> {running ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const statement = statementAtCursor(sql, editorRef.current?.selectionStart ?? 0)
              if (statement) void runSql(statement)
            }}
            disabled={running || !sql.trim()}
            title="Ctrl/Cmd + Shift + Enter"
          >
            Run statement
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setSql('')} disabled={!sql}>
            Clear
          </button>
        </div>
        <div className="toolbar-group console-context">
          <span className="hint">
            Context: <code>{currentDatabase ?? 'server (no database selected)'}</code> · Ctrl/Cmd+Enter to run
          </span>
          <button type="button" className="link-btn" onClick={() => setShowHistory((value) => !value)}>
            History ({history.length})
          </button>
        </div>
      </div>

      <textarea
        ref={editorRef}
        className="sql-editor"
        value={sql}
        spellCheck={false}
        onChange={(event) => setSql(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="SELECT * FROM information_schema.TABLES LIMIT 10;"
        aria-label="SQL editor"
      />

      {showHistory ? (
        <div className="history">
          <div className="history-header">
            <strong>Recent statements</strong>
            <button type="button" className="link-btn" onClick={clearHistory} disabled={history.length === 0}>
              <TrashIcon size={12} /> clear
            </button>
          </div>
          {history.length === 0 ? (
            <p className="panel-note">Nothing run yet in this browser.</p>
          ) : (
            <ul className="history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="history-item" onClick={() => setSql(entry.sql)}>
                    <span className={`history-dot ${entry.ok ? 'is-ok' : 'is-bad'}`} />
                    <code>{entry.sql.length > 120 ? `${entry.sql.slice(0, 120)}…` : entry.sql}</code>
                    <span className="history-meta">
                      {entry.database ?? '—'} · {formatDuration(entry.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="results">
        {results.length === 0 ? (
          <p className="panel-note">Results appear here.</p>
        ) : (
          results.map((result, index) => (
            <section className={`result${result.error ? ' has-error' : ''}`} key={index}>
              <header className="result-header">
                <code className="result-statement">{result.statement}</code>
                <span className="result-meta">
                  {result.error ? (
                    <span className="result-error-flag">failed</span>
                  ) : result.kind === 'read' ? (
                    <>
                      {formatNumber(result.row_count)} row(s)
                      {result.truncated ? ' (truncated)' : ''} · {formatDuration(result.duration_ms)}
                    </>
                  ) : (
                    <>
                      {formatNumber(result.affected_rows)} affected
                      {result.last_insert_id ? ` · id ${result.last_insert_id}` : ''} ·{' '}
                      {formatDuration(result.duration_ms)}
                    </>
                  )}
                  {!result.error && result.kind === 'read' && result.rows.length > 0 ? (
                    <span className="export-group">
                      <DownloadIcon size={12} />
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => downloadText(toCsv(result.columns, result.rows), 'result.csv', 'text/csv')}
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          downloadText(toJson(result.columns, result.rows), 'result.json', 'application/json')
                        }
                      >
                        JSON
                      </button>
                    </span>
                  ) : null}
                </span>
              </header>

              {result.error ? (
                <p className="result-error" role="alert">
                  {result.error}
                </p>
              ) : result.kind === 'read' ? (
                <DataGrid columns={result.columns} rows={result.rows} emptyMessage="Query returned no rows." />
              ) : null}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
