import { useState, type FormEvent } from 'react'

import { useStore } from '../store'
import { storage, type RememberedProfile } from '../lib/storage'
import { IconLeaf } from './Icons'

const BLANK: RememberedProfile = {
  mode: 'fields',
  host: 'localhost',
  port: 27017,
  username: '',
  database: '',
  authSource: '',
  tls: false,
  srv: false,
  uri: '',
}

export function ConnectScreen() {
  const connect = useStore((state) => state.connect)
  const status = useStore((state) => state.status)
  const error = useStore((state) => state.connectError)

  const [form, setForm] = useState<RememberedProfile>(() => ({ ...BLANK, ...(storage.getProfile() ?? {}) }))
  const [password, setPassword] = useState('')
  const connecting = status === 'connecting'

  const update = <K extends keyof RememberedProfile>(key: K, value: RememberedProfile[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (connecting) return
    await connect(
      form.mode === 'uri'
        ? { uri: form.uri.trim() }
        : {
            host: form.host.trim() || 'localhost',
            port: Number(form.port) || 27017,
            username: form.username.trim() || null,
            password,
            database: form.database.trim() || null,
            auth_source: form.authSource.trim() || null,
            tls: form.tls,
            srv: form.srv,
          },
      form,
    )
  }

  return (
    <div className="connect-screen">
      <form className="connect-card" onSubmit={onSubmit}>
        <div className="connect-brand">
          <IconLeaf size={30} />
          <div>
            <h1>Mongo Administrator</h1>
            <p>Connect to any MongoDB deployment</p>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="Connection method">
          <button
            type="button"
            role="tab"
            aria-selected={form.mode === 'fields'}
            className={form.mode === 'fields' ? 'is-active' : ''}
            onClick={() => update('mode', 'fields')}
          >
            Host &amp; port
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={form.mode === 'uri'}
            className={form.mode === 'uri' ? 'is-active' : ''}
            onClick={() => update('mode', 'uri')}
          >
            Connection string
          </button>
        </div>

        {form.mode === 'uri' ? (
          <>
            <label className="field">
              <span>Connection string</span>
              <textarea
                rows={3}
                value={form.uri}
                onChange={(event) => update('uri', event.target.value)}
                placeholder="mongodb+srv://user:password@cluster.example.net/?retryWrites=true"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <p className="hint">
              The password is only remembered on the server, sealed at rest. The string kept in this browser for
              next time has it stripped out.
            </p>
          </>
        ) : (
          <>
            <div className="field-row">
              <label className="field field-grow">
                <span>Host</span>
                <input
                  value={form.host}
                  onChange={(event) => update('host', event.target.value)}
                  placeholder="localhost"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="field field-port">
                <span>Port</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(event) => update('port', Number(event.target.value))}
                  disabled={form.srv}
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field field-grow">
                <span>
                  Username <em>optional</em>
                </span>
                <input
                  value={form.username}
                  onChange={(event) => update('username', event.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="field field-grow">
                <span>
                  Password <em>optional</em>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field field-grow">
                <span>
                  Database <em>optional</em>
                </span>
                <input
                  value={form.database}
                  onChange={(event) => update('database', event.target.value)}
                  placeholder="leave empty to browse all"
                  autoComplete="off"
                />
              </label>
              <label className="field field-grow">
                <span>
                  Auth source <em>optional</em>
                </span>
                <input
                  value={form.authSource}
                  onChange={(event) => update('authSource', event.target.value)}
                  placeholder="admin"
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="field-row field-row-checks">
              <label className="check">
                <input type="checkbox" checked={form.tls} onChange={(event) => update('tls', event.target.checked)} />
                <span>Use TLS</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.srv}
                  onChange={(event) => update('srv', event.target.checked)}
                />
                <span>
                  SRV record <em>(mongodb+srv)</em>
                </span>
              </label>
            </div>
          </>
        )}

        {error ? <div className="connect-error">{error}</div> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>

        <p className="connect-note">
          You stay signed in until you log out, even across a browser or server restart.
        </p>
      </form>
    </div>
  )
}
