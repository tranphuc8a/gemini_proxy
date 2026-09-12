import { useEffect } from 'react'

import { ConnectScreen } from './components/ConnectScreen'
import { ServerView } from './components/ServerView'
import { Sidebar } from './components/Sidebar'
import { SqlConsole } from './components/SqlConsole'
import { StructureView } from './components/StructureView'
import { TableBrowser } from './components/TableBrowser'
import { Toasts } from './components/Toasts'
import { Topbar } from './components/Topbar'
import { useStore } from './store'

export default function App() {
  const session = useStore((state) => state.session)
  const restoring = useStore((state) => state.restoring)
  const view = useStore((state) => state.view)
  const theme = useStore((state) => state.theme)
  const restoreSession = useStore((state) => state.restoreSession)

  // A stored token keeps the user signed in across reloads until they log out.
  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  if (restoring) {
    return (
      <div className="splash">
        <div className="spinner" aria-hidden="true" />
        <p>Restoring your session…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <ConnectScreen />
        <Toasts />
      </>
    )
  }

  return (
    <div className="app-shell">
      <Topbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          {view === 'browse' ? <TableBrowser /> : null}
          {view === 'structure' ? <StructureView /> : null}
          {view === 'console' ? <SqlConsole /> : null}
          {view === 'server' ? <ServerView /> : null}
        </main>
      </div>
      <Toasts />
    </div>
  )
}
