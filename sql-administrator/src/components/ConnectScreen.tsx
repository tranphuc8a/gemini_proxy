import { useState, type FormEvent } from 'react'

import { storage } from '../lib/storage'
import { useStore } from '../store'
import { DatabaseIcon } from './Icons'

export function ConnectScreen() {
  const connect = useStore((state) => state.connect)
  const connecting = useStore((state) => state.connecting)
  const connectError = useStore((state) => state.connectError)

  const remembered = storage.getProfile()
  const [host, setHost] = useState(remembered?.host ?? 'localhost')
  const [port, setPort] = useState(String(remembered?.port ?? 3306))
  const [username, setUsername] = useState(remembered?.username ?? 'root')
  const [password, setPassword] = useState('')
  const [database, setDatabase] = useState(remembered?.database ?? '')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await connect({
      host: host.trim(),
      port: Number(port) || 3306,
      username: username.trim(),
      password,
      database: database.trim(),
    })
  }

  return (
    <div className="connect-screen">
      <form className="connect-card" onSubmit={handleSubmit}>
        <div className="connect-brand">
          <DatabaseIcon size={28} />
          <div>
            <h1>SQL Administrator</h1>
            <p>Connect to any MySQL or MariaDB server</p>
          </div>
        </div>

        <div className="field-row">
          <label className="field field-grow">
            <span>Host</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="localhost"
              autoComplete="off"
              required
            />
          </label>
          <label className="field field-port">
            <span>Port</span>
            <input
              value={port}
              onChange={(event) => setPort(event.target.value)}
              inputMode="numeric"
              placeholder="3306"
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        <label className="field">
          <span>
            Database <em>optional</em>
          </span>
          <input
            value={database}
            onChange={(event) => setDatabase(event.target.value)}
            placeholder="Leave empty to browse every database"
            autoComplete="off"
          />
        </label>

        {connectError ? (
          <p className="connect-error" role="alert">
            {connectError}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>

        <p className="connect-note">
          The session stays open until you log out. Your password is held by the API bridge, sealed at rest, and is
          never stored in this browser.
        </p>
      </form>
    </div>
  )
}
