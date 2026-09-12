import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { selectActiveTab, useStore } from './store'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { Toasts } from './components/Toasts'
import { CommandPalette, type Command } from './components/CommandPalette'
import {
  DiffDialog,
  EnvironmentsDialog,
  ImportDialog,
  RunnerDialog,
  SaveRequestDialog,
  SettingsDialog,
  WorkspaceDialog,
} from './components/Dialogs'
import { IconClose, IconPlus } from './components/Icons'

type DialogName = 'save' | 'env' | 'settings' | 'import' | 'workspace' | 'diff' | null

export default function App() {
  const init = useStore((s) => s.init)
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const activeTab = useStore(selectActiveTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)
  const newTab = useStore((s) => s.newTab)
  const sendRequest = useStore((s) => s.sendRequest)
  const saveTab = useStore((s) => s.saveTab)
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen)
  const runnerOpen = useStore((s) => s.runnerOpen)
  const setRunnerOpen = useStore((s) => s.setRunnerOpen)
  const collections = useStore((s) => s.collections)
  const requests = useStore((s) => s.requests)
  const openRequest = useStore((s) => s.openRequest)
  const runCollection = useStore((s) => s.runCollection)
  const updateSettings = useStore((s) => s.updateSettings)
  const settings = useStore((s) => s.settings)
  const pullWorkspace = useStore((s) => s.pullWorkspace)
  const pushWorkspace = useStore((s) => s.pushWorkspace)

  const [dialog, setDialog] = useState<DialogName>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [requestRatio, setRequestRatio] = useState(0.5)
  // Files live outside the store: a File is not serialisable, and the store is
  // persisted to localStorage on every change.
  const [filesByTab, setFilesByTab] = useState<Record<string, File[]>>({})

  const panesRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    init()
  }, [init])

  const toggleSidebar = useCallback(() => setSidebarCollapsed((value) => !value), [])

  // ------------------------------------------------------------- shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey
      if (!ctrl) return

      const key = event.key.toLowerCase()
      if (event.key === 'Enter') {
        event.preventDefault()
        if (activeTabId) sendRequest(activeTabId)
      } else if (key === 's') {
        event.preventDefault()
        const tab = useStore.getState().tabs.find((t) => t.id === useStore.getState().activeTabId)
        if (tab?.requestId) saveTab(tab.id)
        else setDialog('save')
      } else if (key === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      } else if (key === 'b') {
        event.preventDefault()
        toggleSidebar()
      } else if (key === 't') {
        event.preventDefault()
        newTab()
      } else if (key === 'w') {
        event.preventDefault()
        if (activeTabId) closeTab(activeTabId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTabId, sendRequest, saveTab, setCommandPaletteOpen, toggleSidebar, newTab, closeTab])

  // -------------------------------------------------------------- splitter
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!draggingRef.current || !panesRef.current) return
      const rect = panesRef.current.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / rect.width
      // Leave both panes usable however hard the user drags.
      setRequestRatio(Math.min(0.8, Math.max(0.2, ratio)))
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ------------------------------------------------------- command palette
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'new-tab', label: 'Tab mới', hint: 'Ctrl+T', run: newTab },
      { id: 'send', label: 'Gửi request', hint: 'Ctrl+Enter', run: () => activeTabId && sendRequest(activeTabId) },
      { id: 'save', label: 'Lưu request…', hint: 'Ctrl+S', run: () => setDialog('save') },
      { id: 'env', label: 'Mở Environments', run: () => setDialog('env') },
      { id: 'workspace', label: 'Workspace: đồng bộ / chia sẻ', run: () => setDialog('workspace') },
      { id: 'pull', label: 'Workspace: tải về từ server', run: () => pullWorkspace() },
      { id: 'push', label: 'Workspace: đẩy lên server', run: () => pushWorkspace() },
      { id: 'import', label: 'Import Postman / OpenAPI', run: () => setDialog('import') },
      { id: 'diff', label: 'So sánh hai response', run: () => setDialog('diff') },
      { id: 'runner', label: 'Mở collection runner', run: () => setRunnerOpen(true) },
      { id: 'settings', label: 'Cài đặt', run: () => setDialog('settings') },
      {
        id: 'theme',
        label: settings.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối',
        run: () => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      { id: 'sidebar', label: 'Ẩn/hiện sidebar', hint: 'Ctrl+B', run: toggleSidebar },
    ]

    for (const request of requests) {
      list.push({
        id: `open-${request.id}`,
        label: `Mở: ${request.name}`,
        hint: request.method,
        run: () => openRequest(request.id),
      })
    }
    for (const collection of collections) {
      list.push({
        id: `run-${collection.id}`,
        label: `Chạy collection: ${collection.name}`,
        run: () => runCollection(collection.id),
      })
    }
    return list
  }, [
    activeTabId, collections, newTab, openRequest, pullWorkspace, pushWorkspace, requests,
    runCollection, sendRequest, setRunnerOpen, settings.theme, toggleSidebar, updateSettings,
  ])

  return (
    <div className="app">
      <Topbar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onOpenSettings={() => setDialog('settings')}
        onOpenWorkspace={() => setDialog('workspace')}
        onOpenEnvironments={() => setDialog('env')}
      />

      <div className="workbench">
        {sidebarCollapsed ? null : <Sidebar onImport={() => setDialog('import')} />}

        <div className="main-area">
          <div className="request-tabs" role="tablist">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`request-tab${tab.id === activeTabId ? ' active' : ''}`}
                role="tab"
                aria-selected={tab.id === activeTabId}
                onClick={() => setActiveTab(tab.id)}
                onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
              >
                <span className={`method-badge method-${tab.draft.method}`}>{tab.draft.method}</span>
                <span className="request-tab-name">{tab.draft.name || 'Không tên'}</span>
                {tab.dirty ? <span className="dirty-dot" title="Chưa lưu" /> : null}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  aria-label="Đóng tab"
                >
                  <IconClose size={11} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={newTab} title="Tab mới (Ctrl+T)" aria-label="Tab mới">
              <IconPlus />
            </button>
          </div>

          <div className="panes" ref={panesRef}>
            {activeTab ? (
              <>
                <div style={{ flex: requestRatio, display: 'flex', minWidth: 0 }}>
                  <RequestPanel
                    tab={activeTab}
                    onSaveAs={() => setDialog('save')}
                    files={filesByTab[activeTab.id] ?? []}
                    onSelectFiles={(files) => setFilesByTab((map) => ({ ...map, [activeTab.id]: files }))}
                  />
                </div>
                <div
                  className="splitter"
                  onMouseDown={() => {
                    draggingRef.current = true
                    document.body.style.cursor = 'col-resize'
                  }}
                  role="separator"
                  aria-orientation="vertical"
                />
                <div style={{ flex: 1 - requestRatio, display: 'flex', minWidth: 0 }}>
                  <ResponsePanel tab={activeTab} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <CommandPalette commands={commands} />
      <Toasts />

      {dialog === 'save' && activeTab ? <SaveRequestDialog tab={activeTab} onClose={() => setDialog(null)} /> : null}
      {dialog === 'env' ? <EnvironmentsDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'settings' ? <SettingsDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'import' ? <ImportDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'workspace' ? <WorkspaceDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'diff' ? <DiffDialog onClose={() => setDialog(null)} /> : null}
      {runnerOpen ? <RunnerDialog onClose={() => setRunnerOpen(false)} /> : null}
    </div>
  )
}
