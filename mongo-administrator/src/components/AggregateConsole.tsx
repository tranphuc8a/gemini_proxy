import { useStore } from '../store'
import { toShell } from '../lib/ejson'
import { formatDuration, formatTimestamp } from '../lib/format'
import { downloadText } from '../lib/storage'
import { IconDownload, IconPlay, IconTrash } from './Icons'
import { JsonEditor } from './JsonEditor'

const SNIPPETS: { label: string; pipeline: string }[] = [
  { label: 'Count by field', pipeline: '[\n  { $group: { _id: "$status", n: { $sum: 1 } } },\n  { $sort: { n: -1 } }\n]' },
  { label: 'Recent first', pipeline: '[\n  { $sort: { _id: -1 } },\n  { $limit: 20 }\n]' },
  { label: 'Field coverage', pipeline: '[\n  { $project: { hasField: { $cond: [{ $ifNull: ["$email", false] }, 1, 0] } } },\n  { $group: { _id: null, withField: { $sum: "$hasField" }, total: { $sum: 1 } } }\n]' },
  { label: 'Explain a lookup', pipeline: '[\n  { $lookup: { from: "other", localField: "_id", foreignField: "ref", as: "joined" } },\n  { $limit: 5 }\n]' },
]

export function AggregateConsole() {
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const pipelineText = useStore((state) => state.pipelineText)
  const setPipelineText = useStore((state) => state.setPipelineText)
  const runAggregate = useStore((state) => state.runAggregate)
  const result = useStore((state) => state.aggregateResult)
  const error = useStore((state) => state.aggregateError)
  const history = useStore((state) => state.history)
  const applyHistory = useStore((state) => state.applyHistory)
  const clearHistory = useStore((state) => state.clearHistory)

  if (!activeDb || !activeCollection) {
    return <div className="placeholder">Select a collection to run an aggregation.</div>
  }

  const relevantHistory = history.filter((entry) => entry.kind === 'aggregate')

  return (
    <div className="console">
      <div className="console-main">
        <JsonEditor
          value={pipelineText}
          onChange={setPipelineText}
          onSubmit={runAggregate}
          rows={12}
          label={`Pipeline on ${activeDb}.${activeCollection}`}
          placeholder='[ { $match: { status: "active" } }, { $limit: 10 } ]'
        />

        <div className="console-actions">
          <button type="button" className="btn btn-primary" onClick={() => runAggregate()}>
            <IconPlay />
            Run
          </button>
          <span className="modal-hint">⌘/Ctrl + Enter</span>
          <div className="snippets">
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                className="link-btn"
                onClick={() => setPipelineText(snippet.pipeline)}
              >
                {snippet.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="query-error">{error}</div> : null}

        {result ? (
          <div className="console-result">
            <div className="console-result-head">
              <span>
                {result.row_count} document{result.row_count === 1 ? '' : 's'} ·{' '}
                {formatDuration(result.duration_ms)}
                {result.truncated ? ' · truncated' : ''}
              </span>
              <button
                type="button"
                className="icon-btn"
                title="Download as JSON"
                onClick={() =>
                  downloadText(
                    JSON.stringify(result.documents, null, 2),
                    `${activeDb}.${activeCollection}.aggregate.json`,
                    'application/json',
                  )
                }
              >
                <IconDownload />
              </button>
            </div>
            {result.documents.length === 0 ? (
              <div className="placeholder">The pipeline returned no documents.</div>
            ) : (
              <div className="json-list">
                {result.documents.map((document, index) => (
                  <article key={index} className="json-card">
                    <header>
                      <span className="json-card-index">#{index + 1}</span>
                    </header>
                    <pre>{toShell(document)}</pre>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <aside className="console-history">
        <div className="sidebar-heading">
          <span>History</span>
          {relevantHistory.length > 0 ? (
            <button type="button" className="icon-btn icon-btn-danger" title="Clear history" onClick={clearHistory}>
              <IconTrash size={12} />
            </button>
          ) : null}
        </div>
        {relevantHistory.length === 0 ? (
          <p className="sidebar-empty">Pipelines you run are listed here.</p>
        ) : (
          <ul className="history-list">
            {relevantHistory.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => applyHistory(entry)}>
                  <code>{entry.text.replace(/\s+/g, ' ').slice(0, 90)}</code>
                  <em>
                    {entry.namespace} · {formatTimestamp(entry.at)}
                  </em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
