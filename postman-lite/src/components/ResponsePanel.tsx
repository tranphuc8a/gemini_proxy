import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { ResponseData, Tab } from '../types'
import {
  copyToClipboard,
  decodeBytes,
  download,
  formatBytes,
  isTextualContentType,
  prettyJson,
  statusClass,
  toBlobPart,
} from '../lib/util'
import { IconCopy, IconDiff, IconDownload } from './Icons'

type ViewTab = 'body' | 'headers' | 'preview' | 'tests' | 'raw'

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Colourise pretty-printed JSON. Input must already be escaped. */
function highlightJson(escaped: string): string {
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, literal, number) => {
      if (str) return `<span class="${colon ? 'json-key' : 'json-string'}">${str}</span>${colon ?? ''}`
      if (literal) return `<span class="json-literal">${literal}</span>`
      if (number) return `<span class="json-number">${number}</span>`
      return match
    },
  )
}

function markMatches(html: string, term: string): string {
  if (!term) return html
  // The haystack is escaped, so escape the needle the same way to make a search
  // for "<div>" line up with the rendered text.
  const needle = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(needle, 'gi'), (match) => `<mark>${match}</mark>`)
}

export function ResponsePanel({ tab }: { tab: Tab }) {
  const [view, setView] = useState<ViewTab>('body')
  const [search, setSearch] = useState('')
  const [wrap, setWrap] = useState(true)
  const setDiff = useStore((s) => s.setDiff)
  const toast = useStore((s) => s.toast)

  const response = tab.response

  if (tab.sending && !response) {
    return (
      <section className="pane" style={{ flex: 1 }}>
        <div className="empty">
          <div className="empty-icon">⏳</div>
          Đang gửi request…
        </div>
      </section>
    )
  }

  if (tab.failure) {
    return (
      <section className="pane" style={{ flex: 1 }}>
        <div className="tab-body">
          <div className="notice notice-error">{tab.failure.message}</div>
          {tab.failure.hint ? <div className="notice">{tab.failure.hint}</div> : null}
        </div>
      </section>
    )
  }

  if (!response) {
    return (
      <section className="pane" style={{ flex: 1 }}>
        <div className="empty">
          <div className="empty-icon">📡</div>
          Response sẽ hiện ở đây.
          <br />
          Nhấn <b>Ctrl+Enter</b> để gửi.
        </div>
      </section>
    )
  }

  const failedTests = tab.testResults?.filter((t) => !t.passed).length ?? 0

  return (
    <section className="pane" style={{ flex: 1 }}>
      <div className="response-meta">
        <span className={`status-pill ${statusClass(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="chip">{response.timeMs} ms</span>
        <span className="chip">{formatBytes(response.sizeBytes)}</span>
        <span className={`chip ${response.via === 'proxy' ? 'chip-purple' : 'chip-accent'}`} title={response.finalUrl}>
          {response.via === 'proxy' ? 'qua proxy' : 'trực tiếp'}
        </span>
        {tab.testResults?.length ? (
          <span className={`chip ${failedTests ? 'chip-danger' : 'chip-ok'}`}>
            {tab.testResults.length - failedTests}/{tab.testResults.length} test pass
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" title="Đưa vào ô so sánh trái" onClick={() => setDiff('left', response)}>
          <IconDiff /> A
        </button>
        <button className="btn btn-ghost btn-sm" title="Đưa vào ô so sánh phải" onClick={() => setDiff('right', response)}>
          <IconDiff /> B
        </button>
      </div>

      {response.fellBackFrom ? (
        <div style={{ padding: '0 10px' }}>
          <div className="notice">
            Gửi trực tiếp bị chặn ({response.fallbackReason}) — đã tự động gửi lại qua proxy backend.
          </div>
        </div>
      ) : null}
      {response.truncated ? (
        <div style={{ padding: '0 10px' }}>
          <div className="notice notice-warn">
            Body bị cắt bớt: chỉ nhận {formatBytes(response.bytes.length)} trong tổng {formatBytes(response.sizeBytes)}{' '}
            (giới hạn PROXY_MAX_BYTES của backend).
          </div>
        </div>
      ) : null}

      <nav className="subtabs">
        {(['body', 'headers', 'preview', 'tests', 'raw'] as ViewTab[]).map((id) => (
          <button key={id} className={`subtab${view === id ? ' active' : ''}`} onClick={() => setView(id)}>
            {id === 'body' ? 'Body' : id === 'headers' ? 'Headers' : id === 'preview' ? 'Preview' : id === 'tests' ? 'Tests' : 'Raw'}
            {id === 'headers' ? <span className="subtab-count">{response.headers.length}</span> : null}
            {id === 'tests' && tab.testResults?.length ? (
              <span className="subtab-count">{tab.testResults.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {view === 'body' || view === 'raw' ? (
        <div className="response-toolbar">
          <input
            type="search"
            value={search}
            placeholder="Tìm trong body…"
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm trong response"
          />
          <label className="checkbox">
            <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} /> Wrap
          </label>
          <button
            className="btn btn-sm"
            onClick={async () => {
              const ok = await copyToClipboard(decodeBytes(response.bytes, response.contentType))
              toast(ok ? 'success' : 'error', ok ? 'Đã copy body' : 'Trình duyệt chặn clipboard')
            }}
          >
            <IconCopy /> Copy
          </button>
          <button
            className="btn btn-sm"
            onClick={() =>
              download(
                `response-${Date.now()}.${extensionFor(response.contentType)}`,
                toBlobPart(response.bytes),
                response.contentType || 'application/octet-stream',
              )
            }
          >
            <IconDownload /> Tải về
          </button>
        </div>
      ) : null}

      {view === 'body' ? <BodyView response={response} search={search} wrap={wrap} pretty /> : null}
      {view === 'raw' ? <BodyView response={response} search={search} wrap={wrap} /> : null}
      {view === 'headers' ? <HeadersView response={response} /> : null}
      {view === 'preview' ? <PreviewView response={response} /> : null}
      {view === 'tests' ? <TestsView tab={tab} /> : null}
    </section>
  )
}

function extensionFor(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('csv')) return 'csv'
  return ct.split('/')[1]?.split(';')[0] || 'txt'
}

function BodyView({
  response,
  search,
  wrap,
  pretty,
}: {
  response: ResponseData
  search: string
  wrap: boolean
  pretty?: boolean
}) {
  const isText = isTextualContentType(response.contentType)

  const html = useMemo(() => {
    if (!isText) return null
    const text = decodeBytes(response.bytes, response.contentType)
    const shown = pretty && response.contentType.toLowerCase().includes('json') ? prettyJson(text) : text
    let output = escapeHtml(shown)
    // Highlighting and search marking both inject tags; running one over the
    // other corrupts the markup, and while searching the plain text is the point.
    if (pretty && !search && response.contentType.toLowerCase().includes('json')) output = highlightJson(output)
    return markMatches(output, search)
  }, [response, search, pretty, isText])

  if (!isText) {
    return (
      <div className="viewer">
        <em className="faint">
          [dữ liệu nhị phân · {formatBytes(response.sizeBytes)} · {response.contentType || 'không rõ kiểu'}]
          <br />
          Xem ở tab Preview hoặc bấm "Tải về".
        </em>
      </div>
    )
  }

  return <pre className={`viewer${wrap ? '' : ' nowrap'}`} dangerouslySetInnerHTML={{ __html: html ?? '' }} />
}

function HeadersView({ response }: { response: ResponseData }) {
  return (
    <div className="viewer" style={{ whiteSpace: 'normal' }}>
      {response.headersComplete ? null : (
        <div className="notice notice-warn">
          Trình duyệt chỉ cho đọc 6 header an toàn với response cross-origin. Đổi chế độ gửi sang <b>Proxy</b> để thấy
          đầy đủ.
        </div>
      )}
      {response.headers.length ? (
        <dl className="header-grid">
          {response.headers.map(([name, value], index) => (
            <div key={`${name}-${index}`} style={{ display: 'contents' }}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <em className="faint">Không có header</em>
      )}
    </div>
  )
}

function PreviewView({ response }: { response: ResponseData }) {
  const [url, setUrl] = useState<string | null>(null)
  const previous = useRef<string | null>(null)
  const ct = response.contentType.toLowerCase()
  const isImage = ct.includes('image/')
  const isPdf = ct.includes('application/pdf')

  useEffect(() => {
    if (!isImage && !isPdf) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(new Blob([toBlobPart(response.bytes)], { type: response.contentType.split(';')[0] }))
    setUrl(objectUrl)
    previous.current = objectUrl
    return () => {
      URL.revokeObjectURL(objectUrl)
      previous.current = null
    }
  }, [response, isImage, isPdf])

  if (ct.includes('html')) {
    // No allow-scripts: a response body is untrusted input and we are only
    // showing what it looks like, not running it.
    return (
      <div className="viewer" style={{ padding: 0 }}>
        <iframe className="preview-frame" sandbox="" srcDoc={decodeBytes(response.bytes, response.contentType)} title="Preview" />
      </div>
    )
  }

  if (isImage && url) {
    return (
      <div className="viewer">
        <img className="preview-image" src={url} alt="Response" />
      </div>
    )
  }

  if (isPdf && url) {
    return (
      <div className="viewer" style={{ padding: 0 }}>
        <iframe className="preview-frame" src={url} title="PDF preview" />
      </div>
    )
  }

  if (isTextualContentType(response.contentType)) {
    return <pre className="viewer">{decodeBytes(response.bytes, response.contentType)}</pre>
  }

  return (
    <div className="viewer">
      <em className="faint">Không có preview cho kiểu dữ liệu này.</em>
    </div>
  )
}

function TestsView({ tab }: { tab: Tab }) {
  if (!tab.draft.tests.trim()) {
    return (
      <div className="empty">
        Chưa có test script. Viết ở tab <b>Tests</b> bên trái, ví dụ:
        <pre className="viewer" style={{ textAlign: 'left', marginTop: 10 }}>
          {'pm.test("OK", () => pm.response.to.have.status(200))'}
        </pre>
      </div>
    )
  }

  if (!tab.testResults?.length) {
    return <div className="empty">Gửi request để chạy test.</div>
  }

  return (
    <div className="viewer" style={{ whiteSpace: 'normal', padding: 0 }}>
      {tab.testResults.map((result, index) => (
        <div className="test-row" key={`${result.name}-${index}`}>
          <span className={result.passed ? 'test-pass' : 'test-fail'}>{result.passed ? 'PASS' : 'FAIL'}</span>
          <span style={{ flex: 1 }}>
            {result.name}
            {result.error ? <div className="faint">{result.error}</div> : null}
          </span>
        </div>
      ))}
    </div>
  )
}
