import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { AuthType, BodyMode, ExtractRule, HttpMethod, KeyValue, Tab } from '../types'
import { HTTP_METHODS } from '../types'
import { buildUrl, extractParams, stripQuery } from '../lib/sender'
import { CODE_LANGUAGES, type CodeLanguage, generateCode } from '../lib/codegen'
import { buildCurl, curlToSpec, parseCurl } from '../lib/curl'
import { envTable, findUnresolvedInSpec } from '../lib/env'
import { copyToClipboard, objectToKv, prettyJson, uid } from '../lib/util'
import { KeyValueEditor } from './KeyValueEditor'
import { IconCode, IconCopy, IconPlay, IconSave, IconSend, IconStop, IconTrash } from './Icons'

type SubTab = 'params' | 'headers' | 'auth' | 'body' | 'cookies' | 'tests' | 'extract' | 'code'

const BODY_MODES: { id: BodyMode; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'json', label: 'JSON' },
  { id: 'text', label: 'Text' },
  { id: 'xml', label: 'XML' },
  { id: 'form', label: 'Form URL-encoded' },
  { id: 'multipart', label: 'Multipart' },
]

const SAMPLE_TEST = `pm.test("Status là 200", function () {
  pm.response.to.have.status(200)
})

pm.test("Trả về JSON có field id", function () {
  const body = pm.response.json()
  pm.expect(body).to.have.property("id")
})`

interface RequestPanelProps {
  tab: Tab
  onSaveAs: () => void
  onSelectFiles: (files: File[]) => void
  files: File[]
}

export function RequestPanel({ tab, onSaveAs, onSelectFiles, files }: RequestPanelProps) {
  const patchDraft = useStore((s) => s.patchDraft)
  const sendRequest = useStore((s) => s.sendRequest)
  const cancelRequest = useStore((s) => s.cancelRequest)
  const saveTab = useStore((s) => s.saveTab)
  const toast = useStore((s) => s.toast)
  const environments = useStore((s) => s.environments)
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId)

  const [subTab, setSubTab] = useState<SubTab>('params')
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('curl')
  const [curlInput, setCurlInput] = useState('')

  const draft = tab.draft
  const patch = (next: Parameters<typeof patchDraft>[1]) => patchDraft(tab.id, next)

  const vars = useMemo(
    () => envTable(environments.find((e) => e.id === activeEnvironmentId)),
    [environments, activeEnvironmentId],
  )
  const missingVars = useMemo(() => findUnresolvedInSpec(draft, vars), [draft, vars])

  /** The URL bar and the Params tab describe one query string; keep them equal. */
  const onUrlChange = (value: string) => {
    patch({ url: value, params: objectToKv(extractParams(value)) })
  }

  const onParamsChange = (rows: KeyValue[]) => {
    const enabled: Record<string, string> = {}
    for (const row of rows) {
      if (row.enabled && row.key.trim()) enabled[row.key.trim()] = row.value
    }
    patch({ params: rows, url: buildUrl(stripQuery(draft.url), enabled) })
  }

  const activeCount = (rows: KeyValue[]) => rows.filter((r) => r.enabled && r.key.trim()).length

  const generated = useMemo(() => {
    if (subTab !== 'code') return ''
    try {
      return generateCode(draft, codeLanguage)
    } catch (err) {
      return `// Không sinh được code: ${(err as Error).message}`
    }
  }, [subTab, draft, codeLanguage])

  return (
    <section className="pane pane-request" style={{ flex: 1 }}>
      <div className="url-bar">
        <select
          className="method"
          value={draft.method}
          onChange={(e) => patch({ method: e.target.value as HttpMethod })}
          aria-label="HTTP method"
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <input
          className="url"
          value={draft.url}
          placeholder="https://api.example.com/users hoặc {{BASE_URL}}/users"
          onChange={(e) => onUrlChange(e.target.value)}
          spellCheck={false}
          aria-label="URL"
        />

        {tab.sending ? (
          <button className="btn btn-danger" onClick={() => cancelRequest(tab.id)} title="Hủy request">
            <IconStop /> Hủy
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => sendRequest(tab.id)} title="Gửi (Ctrl+Enter)">
            <IconSend /> Gửi
          </button>
        )}

        <button
          className="btn"
          onClick={() => (tab.requestId ? saveTab(tab.id) : onSaveAs())}
          title="Lưu request (Ctrl+S)"
        >
          <IconSave /> Lưu
        </button>

        {missingVars.length ? (
          <span className="chip chip-warn" title={missingVars.map((v) => `{{${v}}}`).join(', ')}>
            {missingVars.length} biến thiếu
          </span>
        ) : null}
      </div>

      <nav className="subtabs">
        <SubTabButton id="params" current={subTab} onSelect={setSubTab} count={activeCount(draft.params)}>
          Params
        </SubTabButton>
        <SubTabButton id="headers" current={subTab} onSelect={setSubTab} count={activeCount(draft.headers)}>
          Headers
        </SubTabButton>
        <SubTabButton id="auth" current={subTab} onSelect={setSubTab} dot={draft.auth.type !== 'none'}>
          Auth
        </SubTabButton>
        <SubTabButton id="body" current={subTab} onSelect={setSubTab} dot={draft.bodyMode !== 'none'}>
          Body
        </SubTabButton>
        <SubTabButton id="cookies" current={subTab} onSelect={setSubTab} count={activeCount(draft.cookies)}>
          Cookies
        </SubTabButton>
        <SubTabButton id="tests" current={subTab} onSelect={setSubTab} dot={Boolean(draft.tests.trim())}>
          Tests
        </SubTabButton>
        <SubTabButton id="extract" current={subTab} onSelect={setSubTab} count={draft.extracts.filter((r) => r.enabled).length}>
          Extract
        </SubTabButton>
        <SubTabButton id="code" current={subTab} onSelect={setSubTab}>
          Code
        </SubTabButton>
      </nav>

      <div className="tab-body">
        {subTab === 'params' ? (
          <>
            <KeyValueEditor rows={draft.params} onChange={onParamsChange} keyPlaceholder="Tên param" />
            <p className="hint">Param ở đây và query string trên thanh URL luôn được đồng bộ hai chiều.</p>
          </>
        ) : null}

        {subTab === 'headers' ? (
          <>
            <KeyValueEditor rows={draft.headers} onChange={(rows) => patch({ headers: rows })} keyPlaceholder="Tên header" />
            <p className="hint">
              Header như <code>Cookie</code>, <code>Referer</code>, <code>User-Agent</code> bị trình duyệt cấm — chỉ gửi
              được ở chế độ <b>Proxy</b> hoặc <b>Auto</b>.
            </p>
          </>
        ) : null}

        {subTab === 'auth' ? <AuthEditor draft={draft} patch={patch} /> : null}

        {subTab === 'body' ? (
          <BodyEditor draft={draft} patch={patch} files={files} onSelectFiles={onSelectFiles} toast={toast} />
        ) : null}

        {subTab === 'cookies' ? (
          <>
            <KeyValueEditor rows={draft.cookies} onChange={(rows) => patch({ cookies: rows })} keyPlaceholder="Tên cookie" />
            <p className="hint">
              Cookie ở đây được gộp thành header <code>Cookie</code>. Trình duyệt cấm header này, nên request sẽ tự động
              đi qua proxy.
            </p>
          </>
        ) : null}

        {subTab === 'tests' ? (
          <>
            <div className="field-row">
              <span className="field-label">Test script</span>
              <button className="btn btn-sm" onClick={() => patch({ tests: SAMPLE_TEST })}>
                Chèn ví dụ
              </button>
              <button className="btn btn-sm" onClick={() => patch({ tests: '' })}>
                Xóa
              </button>
            </div>
            <textarea
              className="code-area"
              value={draft.tests}
              placeholder={SAMPLE_TEST}
              onChange={(e) => patch({ tests: e.target.value })}
              spellCheck={false}
            />
            <p className="hint">
              Chạy sau mỗi response, trong Web Worker riêng (không truy cập được DOM, có timeout nên vòng lặp vô hạn
              không treo tab). Dùng được <code>pm.test</code>, <code>pm.expect</code>, <code>pm.response</code>,{' '}
              <code>pm.environment.get/set</code>.
            </p>
          </>
        ) : null}

        {subTab === 'extract' ? <ExtractEditor draft={draft} patch={patch} /> : null}

        {subTab === 'code' ? (
          <>
            <div className="field-row">
              <select value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value as CodeLanguage)}>
                {CODE_LANGUAGES.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const ok = await copyToClipboard(generated)
                  toast(ok ? 'success' : 'error', ok ? 'Đã copy' : 'Trình duyệt chặn clipboard')
                }}
              >
                <IconCopy /> Copy
              </button>
            </div>
            <pre className="viewer" style={{ maxHeight: '40vh' }}>
              {generated}
            </pre>

            <div className="field-row" style={{ marginTop: 14 }}>
              <span className="field-label">Nhập từ cURL</span>
            </div>
            <textarea
              className="code-area"
              style={{ minHeight: 110 }}
              value={curlInput}
              placeholder={"curl -X POST 'https://api.example.com/items' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"foo\"}'"}
              onChange={(e) => setCurlInput(e.target.value)}
              spellCheck={false}
            />
            <div className="field-row" style={{ marginTop: 6 }}>
              <button
                className="btn btn-sm"
                onClick={() => {
                  try {
                    const parsed = parseCurl(curlInput)
                    const spec = curlToSpec(parsed, draft.name)
                    // Keep this tab's identity; only the request content changes.
                    patch({ ...spec, id: draft.id, name: draft.name, collectionId: draft.collectionId })
                    if (parsed.unsupported.length) toast('warn', `Bỏ qua: ${parsed.unsupported.join(', ')}`)
                    else toast('success', 'Đã nạp lệnh cURL')
                  } catch (err) {
                    toast('error', (err as Error).message)
                  }
                }}
              >
                <IconCode /> Parse &amp; fill
              </button>
              <span className="hint" style={{ margin: 0 }}>
                Hỗ trợ nối dòng bằng <code>\</code>, <code>$'...'</code> và <code>^</code> của cmd.
              </span>
            </div>
            <p className="hint">
              Lệnh curl tương đương request hiện tại:
              <br />
              <code style={{ whiteSpace: 'pre-wrap' }}>{buildCurl(draft, { multiline: false })}</code>
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}

function SubTabButton({
  id,
  current,
  onSelect,
  children,
  count,
  dot,
}: {
  id: SubTab
  current: SubTab
  onSelect: (id: SubTab) => void
  children: React.ReactNode
  count?: number
  dot?: boolean
}) {
  return (
    <button className={`subtab${current === id ? ' active' : ''}`} onClick={() => onSelect(id)}>
      {children}
      {count ? <span className="subtab-count">{count}</span> : null}
      {!count && dot ? <span className="dirty-dot" style={{ background: 'var(--accent)' }} /> : null}
    </button>
  )
}

function AuthEditor({ draft, patch }: { draft: Tab['draft']; patch: (p: any) => void }) {
  const auth = draft.auth
  const setAuth = (next: Partial<typeof auth>) => patch({ auth: { ...auth, ...next } })

  return (
    <>
      <div className="field-row">
        <span className="field-label">Loại</span>
        <select value={auth.type} onChange={(e) => setAuth({ type: e.target.value as AuthType })}>
          <option value="none">None</option>
          <option value="basic">Basic</option>
          <option value="bearer">Bearer token</option>
          <option value="apikey">API key</option>
        </select>
      </div>

      {auth.type === 'basic' ? (
        <>
          <div className="form-group">
            <label htmlFor="auth-user">Username</label>
            <input id="auth-user" value={auth.username ?? ''} onChange={(e) => setAuth({ username: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="auth-pass">Password</label>
            <input
              id="auth-pass"
              type="password"
              value={auth.password ?? ''}
              onChange={(e) => setAuth({ password: e.target.value })}
            />
          </div>
        </>
      ) : null}

      {auth.type === 'bearer' ? (
        <div className="form-group">
          <label htmlFor="auth-token">Token</label>
          <input
            id="auth-token"
            value={auth.token ?? ''}
            placeholder="{{ACCESS_TOKEN}}"
            onChange={(e) => setAuth({ token: e.target.value })}
          />
        </div>
      ) : null}

      {auth.type === 'apikey' ? (
        <>
          <div className="form-group">
            <label htmlFor="auth-key-name">Tên key</label>
            <input
              id="auth-key-name"
              value={auth.keyName ?? ''}
              placeholder="X-API-Key"
              onChange={(e) => setAuth({ keyName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="auth-key-value">Giá trị</label>
            <input id="auth-key-value" value={auth.keyValue ?? ''} onChange={(e) => setAuth({ keyValue: e.target.value })} />
          </div>
          <div className="field-row">
            <span className="field-label">Đặt ở</span>
            <select value={auth.location ?? 'header'} onChange={(e) => setAuth({ location: e.target.value as 'header' | 'query' })}>
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </div>
        </>
      ) : null}

      <p className="hint">Mọi ô ở đây đều nhận biến environment, ví dụ <code>{'{{ACCESS_TOKEN}}'}</code>.</p>
    </>
  )
}

function BodyEditor({
  draft,
  patch,
  files,
  onSelectFiles,
  toast,
}: {
  draft: Tab['draft']
  patch: (p: any) => void
  files: File[]
  onSelectFiles: (files: File[]) => void
  toast: (kind: 'success' | 'info' | 'warn' | 'error', text: string) => void
}) {
  const isStructured = draft.bodyMode === 'form' || draft.bodyMode === 'multipart'

  return (
    <>
      <div className="field-row">
        <span className="field-label">Kiểu body</span>
        <select value={draft.bodyMode} onChange={(e) => patch({ bodyMode: e.target.value as BodyMode })}>
          {BODY_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
        {draft.bodyMode === 'json' ? (
          <button
            className="btn btn-sm"
            onClick={() => {
              const formatted = prettyJson(draft.body)
              if (formatted === draft.body && draft.body.trim()) toast('error', 'Body không phải JSON hợp lệ')
              else patch({ body: formatted })
            }}
          >
            Format JSON
          </button>
        ) : null}
      </div>

      {draft.bodyMode === 'none' ? (
        <p className="hint">Request này không gửi body.</p>
      ) : isStructured ? (
        <>
          <KeyValueEditor rows={draft.formFields} onChange={(rows) => patch({ formFields: rows })} keyPlaceholder="Tên field" />
          {draft.bodyMode === 'multipart' ? (
            <div className="field-row" style={{ marginTop: 10 }}>
              <span className="field-label">File</span>
              <input type="file" multiple onChange={(e) => onSelectFiles([...(e.target.files ?? [])])} />
              {files.length ? <span className="chip">{files.length} file</span> : null}
            </div>
          ) : null}
          <p className="hint">
            {draft.bodyMode === 'form'
              ? 'Được encode thành a=1&b=2.'
              : 'File được gửi kèm cả ở chế độ proxy — multipart được dựng tay rồi mã hoá base64.'}
          </p>
        </>
      ) : (
        <textarea
          className="code-area"
          value={draft.body}
          placeholder={draft.bodyMode === 'json' ? '{\n  "name": "foo"\n}' : ''}
          onChange={(e) => patch({ body: e.target.value })}
          spellCheck={false}
        />
      )}
    </>
  )
}

function ExtractEditor({ draft, patch }: { draft: Tab['draft']; patch: (p: any) => void }) {
  const rules = draft.extracts

  const update = (id: string, next: Partial<ExtractRule>) =>
    patch({ extracts: rules.map((rule) => (rule.id === id ? { ...rule, ...next } : rule)) })

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Sau khi có response, lấy giá trị ra và ghi vào biến environment — để request sau dùng luôn mà không phải copy tay.
      </p>

      <div className="kv-table">
        {rules.map((rule) => (
          <div className="kv-row" key={rule.id}>
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => update(rule.id, { enabled: e.target.checked })}
              aria-label="Bật rule"
            />
            <select value={rule.source} onChange={(e) => update(rule.id, { source: e.target.value as ExtractRule['source'] })}>
              <option value="body">Body</option>
              <option value="header">Header</option>
              <option value="status">Status</option>
            </select>
            <input
              type="text"
              value={rule.path}
              placeholder={rule.source === 'header' ? 'Tên header' : rule.source === 'status' ? '(không cần)' : 'data.token'}
              disabled={rule.source === 'status'}
              onChange={(e) => update(rule.id, { path: e.target.value })}
            />
            <span className="faint">→</span>
            <input
              type="text"
              value={rule.target}
              placeholder="ACCESS_TOKEN"
              onChange={(e) => update(rule.id, { target: e.target.value })}
            />
            <button
              className="btn btn-ghost"
              onClick={() => patch({ extracts: rules.filter((r) => r.id !== rule.id) })}
              aria-label="Xóa rule"
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn btn-sm"
        style={{ marginTop: 8 }}
        onClick={() =>
          patch({ extracts: [...rules, { id: uid('ex_'), enabled: true, source: 'body', path: '', target: '' }] })
        }
      >
        <IconPlay /> Thêm rule
      </button>

      <p className="hint">
        Đường dẫn hỗ trợ <code>data.token</code>, <code>items.0.id</code> và <code>items[0].id</code>.
      </p>
    </>
  )
}
