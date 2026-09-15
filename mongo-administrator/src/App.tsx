import { useEffect } from 'react'

import { useStore } from './store'
import { AggregateConsole } from './components/AggregateConsole'
import { BackupView } from './components/BackupView'
import { ConnectScreen } from './components/ConnectScreen'
import { DocumentBrowser } from './components/DocumentBrowser'
import { IndexView } from './components/IndexView'
import { ServerView } from './components/ServerView'
import { Sidebar } from './components/Sidebar'
import { StatsView } from './components/StatsView'
import { Toasts } from './components/Toasts'
import { Topbar } from './components/Topbar'

export default function App() {
  const status = useStore((state) => state.status)
  const tab = useStore((state) => state.tab)
  const bootstrap = useStore((state) => state.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  if (status === 'restoring') {
    return (
      <div className="splash">
        <span className="spinner" />
        <p>Restoring your session…</p>
      </div>
    )
  }

  if (status !== 'connected') {
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
          {tab === 'documents' ? <DocumentBrowser /> : null}
          {tab === 'indexes' ? <IndexView /> : null}
          {tab === 'aggregate' ? <AggregateConsole /> : null}
          {tab === 'stats' ? <StatsView /> : null}
          {tab === 'backup' ? <BackupView /> : null}
          {tab === 'server' ? <ServerView /> : null}
        </main>
      </div>
      <Toasts />
    </div>
  )
}
