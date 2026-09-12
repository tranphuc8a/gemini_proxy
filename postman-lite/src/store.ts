/**
 * One store for the whole app.
 *
 * Tabs hold *drafts*: editing a request never touches the saved copy until the
 * user saves, so an experiment in one tab cannot corrupt what the collection
 * holds. `dirty` is what tells them apart.
 */

import { create } from 'zustand'
import type {
  Collection,
  Environment,
  ExtractRule,
  HttpMethod,
  KeyValue,
  RequestSpec,
  ResponseData,
  RunnerRow,
  Tab,
  TestResult,
  ToastMessage,
  WorkspaceLink,
} from './types'
import { ApiError, api } from './lib/api'
import { envTable, findUnresolvedInSpec, resolveSpec } from './lib/env'
import { runExtracts } from './lib/extract'
import { ProxyError, send } from './lib/sender'
import { buildContext, runTests } from './lib/testRunner'
import {
  DEFAULT_SETTINGS,
  EMPTY_STATE,
  type Settings,
  clearAll as clearStorage,
  loadSettings,
  loadState,
  loadWorkspace,
  saveSettings,
  saveState,
  saveWorkspace,
} from './lib/storage'
import { kv, uid } from './lib/util'

export function blankRequest(overrides: Partial<RequestSpec> = {}): RequestSpec {
  return {
    id: uid('req_'),
    name: 'Request mới',
    collectionId: null,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    cookies: [],
    auth: { type: 'none' },
    bodyMode: 'none',
    body: '',
    formFields: [],
    tests: '',
    extracts: [],
    ...overrides,
  }
}

function newTab(draft: RequestSpec, requestId: string | null = null): Tab {
  return { id: uid('tab_'), requestId, draft, sending: false, dirty: false }
}

/** Structural comparison that ignores the timestamps the editor does not own. */
function sameSpec(a: RequestSpec, b: RequestSpec): boolean {
  const strip = (spec: RequestSpec) => {
    const copy = { ...spec }
    delete copy.createdAt
    delete copy.updatedAt
    return copy
  }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

export interface StoreState {
  // data
  collections: Collection[]
  requests: RequestSpec[]
  environments: Environment[]
  activeEnvironmentId: string | null
  expandedCollections: string[]

  // ui
  tabs: Tab[]
  activeTabId: string
  settings: Settings
  toasts: ToastMessage[]
  sidebarFilter: string
  sidebarTab: 'collections' | 'history'
  commandPaletteOpen: boolean

  // runner
  runnerRows: RunnerRow[]
  runnerRunning: boolean
  runnerOpen: boolean

  // diff
  diffLeft: ResponseData | null
  diffRight: ResponseData | null

  // workspace
  workspace: WorkspaceLink | null
  syncing: boolean
  proxyAvailable: boolean | null

  // in-flight
  abortControllers: Record<string, AbortController>
}

export interface StoreActions {
  init: () => void
  persist: () => void

  // toasts
  toast: (kind: ToastMessage['kind'], text: string) => void
  dismissToast: (id: string) => void

  // tabs
  openRequest: (requestId: string) => void
  openDraft: (draft: RequestSpec, requestId?: string | null) => void
  newTab: () => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  patchDraft: (tabId: string, patch: Partial<RequestSpec>) => void

  // sending
  sendRequest: (tabId: string) => Promise<void>
  cancelRequest: (tabId: string) => void

  // collections & requests
  addCollection: (name: string, parentId?: string | null) => Collection
  updateCollection: (id: string, patch: Partial<Collection>) => void
  deleteCollection: (id: string) => void
  toggleCollection: (id: string) => void
  moveRequest: (requestId: string, collectionId: string | null) => void
  moveCollection: (id: string, parentId: string | null) => boolean
  saveTab: (tabId: string, name?: string, collectionId?: string | null) => void
  deleteRequest: (id: string) => void
  duplicateRequest: (id: string) => void
  importBundle: (bundle: { collections: Collection[]; requests: RequestSpec[]; environments: Environment[] }) => void

  // environments
  addEnvironment: (name: string) => Environment
  updateEnvironment: (id: string, patch: Partial<Environment>) => void
  deleteEnvironment: (id: string) => void
  setActiveEnvironment: (id: string | null) => void
  setEnvVar: (name: string, value: string) => void

  // settings
  updateSettings: (patch: Partial<Settings>) => void

  // ui
  setSidebarFilter: (term: string) => void
  setSidebarTab: (tab: 'collections' | 'history') => void
  setCommandPaletteOpen: (open: boolean) => void
  setDiff: (side: 'left' | 'right', response: ResponseData | null) => void

  // runner
  setRunnerOpen: (open: boolean) => void
  runCollection: (collectionId: string) => Promise<void>

  // workspace
  createWorkspace: (name: string) => Promise<void>
  connectWorkspace: (id: string, accessKey: string) => Promise<void>
  pullWorkspace: () => Promise<void>
  pushWorkspace: (force?: boolean) => Promise<void>
  disconnectWorkspace: () => void
  toggleShare: (enabled: boolean) => Promise<void>
  checkProxy: () => Promise<void>
  resetEverything: () => void
}

export type Store = StoreState & StoreActions

export const useStore = create<Store>((set, get) => ({
  ...EMPTY_STATE,
  tabs: [],
  activeTabId: '',
  settings: DEFAULT_SETTINGS,
  toasts: [],
  sidebarFilter: '',
  sidebarTab: 'collections',
  commandPaletteOpen: false,
  runnerRows: [],
  runnerRunning: false,
  runnerOpen: false,
  diffLeft: null,
  diffRight: null,
  workspace: null,
  syncing: false,
  proxyAvailable: null,
  abortControllers: {},

  // ------------------------------------------------------------------ setup
  init: () => {
    const state = loadState()
    const settings = loadSettings()
    const workspace = loadWorkspace()
    const first = newTab(blankRequest())

    set({ ...state, settings, workspace, tabs: [first], activeTabId: first.id })
    document.documentElement.dataset.theme = settings.theme

    get().checkProxy()
    if (workspace && settings.autoSync) get().pullWorkspace()
  },

  persist: () => {
    const { collections, requests, environments, activeEnvironmentId, expandedCollections } = get()
    const ok = saveState({ collections, requests, environments, activeEnvironmentId, expandedCollections })
    if (!ok) {
      get().toast('warn', 'Không lưu được vào bộ nhớ trình duyệt (đầy hoặc chế độ riêng tư).')
    }
  },

  // ----------------------------------------------------------------- toasts
  toast: (kind, text) => {
    const item: ToastMessage = { id: uid('toast_'), kind, text }
    set((s) => ({ toasts: [...s.toasts, item] }))
    const ms = kind === 'error' ? 7000 : kind === 'warn' ? 5000 : 2800
    setTimeout(() => get().dismissToast(item.id), ms)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ------------------------------------------------------------------- tabs
  openRequest: (requestId) => {
    const existing = get().tabs.find((tab) => tab.requestId === requestId)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const request = get().requests.find((r) => r.id === requestId)
    if (!request) return
    const tab = newTab(structuredClone(request), request.id)
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  openDraft: (draft, requestId = null) => {
    const tab = newTab(draft, requestId)
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  newTab: () => get().openDraft(blankRequest()),

  closeTab: (tabId) => {
    get().cancelRequest(tabId)
    set((s) => {
      const remaining = s.tabs.filter((tab) => tab.id !== tabId)
      // Never leave the editor with no tab at all.
      if (!remaining.length) {
        const fresh = newTab(blankRequest())
        return { tabs: [fresh], activeTabId: fresh.id }
      }
      const activeTabId = s.activeTabId === tabId ? remaining[remaining.length - 1].id : s.activeTabId
      return { tabs: remaining, activeTabId }
    })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  patchDraft: (tabId, patch) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const draft = { ...tab.draft, ...patch }
        const saved = tab.requestId ? s.requests.find((r) => r.id === tab.requestId) : null
        return { ...tab, draft, dirty: saved ? !sameSpec(draft, saved) : true }
      }),
    })),

  // ---------------------------------------------------------------- sending
  sendRequest: async (tabId) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === tabId)
    if (!tab || tab.sending) return

    if (!tab.draft.url.trim()) {
      state.toast('error', 'Vui lòng nhập URL')
      return
    }

    const environment = state.environments.find((e) => e.id === state.activeEnvironmentId)
    const vars = envTable(environment)
    const missing = findUnresolvedInSpec(tab.draft, vars)
    if (missing.length) {
      state.toast('warn', `Biến chưa có giá trị, sẽ gửi nguyên văn: ${missing.map((v) => `{{${v}}}`).join(', ')}`)
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, Math.max(1, state.settings.timeoutSeconds) * 1000)

    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, sending: true, failure: undefined, testResults: undefined } : t)),
      abortControllers: { ...s.abortControllers, [tabId]: controller },
    }))

    try {
      const response = await send(resolveSpec(tab.draft, vars), {
        mode: state.settings.sendMode,
        signal: controller.signal,
        timeoutSeconds: state.settings.timeoutSeconds,
        followRedirects: state.settings.followRedirects,
        withCredentials: state.settings.withCredentials,
      })

      // Extract rules run before the tests, so a test can assert on what the
      // request just stored in the environment.
      const outcomes = runExtracts(tab.draft.extracts, response)
      for (const outcome of outcomes) {
        if (outcome.value !== null) get().setEnvVar(outcome.target, outcome.value)
        else if (outcome.error) get().toast('warn', `Extract "${outcome.target}": ${outcome.error}`)
      }
      if (outcomes.some((o) => o.value !== null)) {
        const applied = outcomes.filter((o) => o.value !== null).map((o) => o.target)
        get().toast('info', `Đã cập nhật biến: ${applied.join(', ')}`)
      }

      let testResults: TestResult[] | undefined
      if (tab.draft.tests.trim()) {
        const current = get()
        const currentEnv = current.environments.find((e) => e.id === current.activeEnvironmentId)
        const outcome = await runTests(tab.draft.tests, buildContext(response, envTable(currentEnv)))
        testResults = outcome.results
        for (const [name, value] of Object.entries(outcome.envSets)) get().setEnvVar(name, value)
        if (outcome.error) get().toast('error', `Test script lỗi: ${outcome.error}`)
        if (outcome.logs.length) console.info('[postman-lite-pro tests]', ...outcome.logs)
      }

      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, sending: false, response, testResults, failure: undefined } : t)),
      }))

      if (response.fellBackFrom) {
        get().toast('info', 'Gửi trực tiếp bị CORS chặn — đã tự động gửi lại qua proxy backend.')
      }

      const workspace = get().workspace
      if (workspace) {
        api
          .addHistory(workspace.id, workspace.accessKey, {
            method: tab.draft.method,
            url: response.finalUrl,
            status: response.status,
            duration_ms: response.timeMs,
            size_bytes: response.sizeBytes,
            via: response.via,
            success: response.status < 400,
            spec: tab.draft as unknown as Record<string, unknown>,
          })
          // History is a convenience; failing to record it must not disturb a
          // successful request.
          .catch(() => {})
      }
    } catch (err) {
      const failure = describeFailure(err, timedOut, state.settings.sendMode, state.settings.timeoutSeconds)
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, sending: false, failure, response: undefined } : t)),
      }))
      if (failure.kind !== 'aborted') get().toast('error', failure.message)
    } finally {
      clearTimeout(timer)
      set((s) => {
        const rest = { ...s.abortControllers }
        delete rest[tabId]
        return { abortControllers: rest }
      })
    }
  },

  cancelRequest: (tabId) => {
    const controller = get().abortControllers[tabId]
    if (controller) controller.abort()
  },

  // ------------------------------------------------------ collections/reqs
  addCollection: (name, parentId = null) => {
    const collection: Collection = { id: uid('col_'), name, parentId, createdAt: new Date().toISOString() }
    set((s) => ({
      collections: [...s.collections, collection],
      expandedCollections: parentId ? [...new Set([...s.expandedCollections, parentId])] : s.expandedCollections,
    }))
    get().persist()
    return collection
  },

  updateCollection: (id, patch) => {
    set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
    get().persist()
  },

  deleteCollection: (id) => {
    const { collections, requests } = get()
    const doomed = new Set<string>()
    const walk = (collectionId: string) => {
      doomed.add(collectionId)
      collections.filter((c) => c.parentId === collectionId && !doomed.has(c.id)).forEach((c) => walk(c.id))
    }
    walk(id)

    set({
      collections: collections.filter((c) => !doomed.has(c.id)),
      requests: requests.filter((r) => !r.collectionId || !doomed.has(r.collectionId)),
    })
    get().persist()
  },

  toggleCollection: (id) => {
    set((s) => ({
      expandedCollections: s.expandedCollections.includes(id)
        ? s.expandedCollections.filter((x) => x !== id)
        : [...s.expandedCollections, id],
    }))
    get().persist()
  },

  moveRequest: (requestId, collectionId) => {
    set((s) => ({
      requests: s.requests.map((r) => (r.id === requestId ? { ...r, collectionId } : r)),
      expandedCollections: collectionId ? [...new Set([...s.expandedCollections, collectionId])] : s.expandedCollections,
    }))
    get().persist()
  },

  moveCollection: (id, parentId) => {
    if (id === parentId) return false
    if (parentId && isDescendant(get().collections, id, parentId)) {
      // Dropping a folder into its own descendant detaches the whole branch from
      // the root, and everything inside it vanishes from the tree.
      get().toast('error', 'Không thể kéo một collection vào chính nó hoặc vào collection con của nó')
      return false
    }
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, parentId } : c)),
      expandedCollections: parentId ? [...new Set([...s.expandedCollections, parentId])] : s.expandedCollections,
    }))
    get().persist()
    return true
  },

  saveTab: (tabId, name, collectionId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return

    const now = new Date().toISOString()
    const draft: RequestSpec = {
      ...tab.draft,
      name: name ?? tab.draft.name,
      collectionId: collectionId !== undefined ? collectionId : tab.draft.collectionId,
      updatedAt: now,
    }

    set((s) => {
      const exists = tab.requestId && s.requests.some((r) => r.id === tab.requestId)
      const saved: RequestSpec = exists
        ? { ...draft, id: tab.requestId! }
        : { ...draft, id: draft.id, createdAt: now }
      return {
        requests: exists ? s.requests.map((r) => (r.id === saved.id ? saved : r)) : [...s.requests, saved],
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, requestId: saved.id, draft: saved, dirty: false } : t)),
        expandedCollections: saved.collectionId
          ? [...new Set([...s.expandedCollections, saved.collectionId])]
          : s.expandedCollections,
      }
    })
    get().persist()
    get().toast('success', 'Đã lưu request')
  },

  deleteRequest: (id) => {
    set((s) => ({
      requests: s.requests.filter((r) => r.id !== id),
      // A tab editing it becomes an unsaved draft rather than closing under the
      // user's hands - they may still want what they typed.
      tabs: s.tabs.map((t) => (t.requestId === id ? { ...t, requestId: null, dirty: true } : t)),
    }))
    get().persist()
  },

  duplicateRequest: (id) => {
    const request = get().requests.find((r) => r.id === id)
    if (!request) return
    const copy: RequestSpec = { ...structuredClone(request), id: uid('req_'), name: `${request.name} (copy)` }
    set((s) => ({ requests: [...s.requests, copy] }))
    get().persist()
    get().toast('success', 'Đã nhân bản request')
  },

  importBundle: ({ collections, requests, environments }) => {
    set((s) => ({
      collections: [...s.collections, ...collections],
      requests: [...s.requests, ...requests],
      environments: [...s.environments, ...environments],
      activeEnvironmentId: s.activeEnvironmentId ?? environments[0]?.id ?? null,
      expandedCollections: [...new Set([...s.expandedCollections, ...collections.map((c) => c.id)])],
    }))
    get().persist()
  },

  // ----------------------------------------------------------- environments
  addEnvironment: (name) => {
    const environment: Environment = { id: uid('env_'), name, vars: [kv()] }
    set((s) => ({
      environments: [...s.environments, environment],
      activeEnvironmentId: s.activeEnvironmentId ?? environment.id,
    }))
    get().persist()
    return environment
  },

  updateEnvironment: (id, patch) => {
    set((s) => ({ environments: s.environments.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
    get().persist()
  },

  deleteEnvironment: (id) => {
    set((s) => ({
      environments: s.environments.filter((e) => e.id !== id),
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
    }))
    get().persist()
  },

  setActiveEnvironment: (id) => {
    set({ activeEnvironmentId: id })
    get().persist()
  },

  /** Write a variable into the active environment, creating one if needed. */
  setEnvVar: (name, value) => {
    const state = get()
    let targetId = state.activeEnvironmentId
    let environments = state.environments

    if (!targetId || !environments.some((e) => e.id === targetId)) {
      const created: Environment = { id: uid('env_'), name: 'Extracted', vars: [] }
      environments = [...environments, created]
      targetId = created.id
    }

    environments = environments.map((environment) => {
      if (environment.id !== targetId) return environment
      const index = environment.vars.findIndex((row) => row.key === name)
      const vars =
        index > -1
          ? environment.vars.map((row, i) => (i === index ? { ...row, value, enabled: true } : row))
          : [...environment.vars, kv(name, value)]
      return { ...environment, vars }
    })

    set({ environments, activeEnvironmentId: targetId })
    get().persist()
  },

  // --------------------------------------------------------------- settings
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    saveSettings(settings)
    if (patch.theme) document.documentElement.dataset.theme = patch.theme
  },

  // --------------------------------------------------------------------- ui
  setSidebarFilter: (term) => set({ sidebarFilter: term }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setDiff: (side, response) => set(side === 'left' ? { diffLeft: response } : { diffRight: response }),

  // ----------------------------------------------------------------- runner
  setRunnerOpen: (open) => set({ runnerOpen: open }),

  runCollection: async (collectionId) => {
    const state = get()
    if (state.runnerRunning) return

    const ids = new Set<string>()
    const walk = (id: string) => {
      ids.add(id)
      state.collections.filter((c) => c.parentId === id).forEach((c) => walk(c.id))
    }
    walk(collectionId)

    const targets = state.requests.filter((r) => r.collectionId && ids.has(r.collectionId))
    if (!targets.length) {
      state.toast('warn', 'Collection này chưa có request nào')
      return
    }

    set({
      runnerRunning: true,
      runnerOpen: true,
      runnerRows: targets.map((r) => ({ requestId: r.id, name: r.name, status: 'pending', tests: [] })),
    })

    for (const request of targets) {
      set((s) => ({
        runnerRows: s.runnerRows.map((row) => (row.requestId === request.id ? { ...row, status: 'running' } : row)),
      }))

      try {
        // Read the environment fresh each iteration: an extract rule in request
        // N is supposed to feed request N+1, which is the whole point of a run.
        const current = get()
        const vars = envTable(current.environments.find((e) => e.id === current.activeEnvironmentId))
        const response = await send(resolveSpec(request, vars), {
          mode: current.settings.sendMode,
          timeoutSeconds: current.settings.timeoutSeconds,
          followRedirects: current.settings.followRedirects,
          withCredentials: current.settings.withCredentials,
        })

        for (const outcome of runExtracts(request.extracts, response)) {
          if (outcome.value !== null) get().setEnvVar(outcome.target, outcome.value)
        }

        let tests: TestResult[] = []
        if (request.tests.trim()) {
          const after = get()
          const outcome = await runTests(
            request.tests,
            buildContext(response, envTable(after.environments.find((e) => e.id === after.activeEnvironmentId))),
          )
          tests = outcome.results
          for (const [name, value] of Object.entries(outcome.envSets)) get().setEnvVar(name, value)
          if (outcome.error) tests = [...tests, { name: 'Script', passed: false, error: outcome.error }]
        }

        set((s) => ({
          runnerRows: s.runnerRows.map((row) =>
            row.requestId === request.id
              ? { ...row, status: 'done', httpStatus: response.status, timeMs: response.timeMs, tests }
              : row,
          ),
        }))
      } catch (err) {
        set((s) => ({
          runnerRows: s.runnerRows.map((row) =>
            row.requestId === request.id
              ? { ...row, status: 'failed', error: (err as Error).message, tests: [] }
              : row,
          ),
        }))
      }
    }

    set({ runnerRunning: false })
    const rows = get().runnerRows
    const failed = rows.filter((row) => row.status === 'failed' || row.tests.some((t) => !t.passed)).length
    get().toast(failed ? 'warn' : 'success', failed ? `Chạy xong: ${failed}/${rows.length} request có lỗi` : `Chạy xong ${rows.length} request, tất cả đều pass`)
  },

  // -------------------------------------------------------------- workspace
  createWorkspace: async (name) => {
    set({ syncing: true })
    try {
      const created = await api.createWorkspace(name)
      const link: WorkspaceLink = {
        id: created.id,
        name: created.name,
        accessKey: created.access_key,
        revision: created.revision,
      }
      set({ workspace: link })
      saveWorkspace(link)
      await get().pushWorkspace(true)
      get().toast('success', 'Đã tạo workspace và đẩy dữ liệu hiện tại lên')
    } catch (err) {
      get().toast('error', `Không tạo được workspace: ${(err as Error).message}`)
    } finally {
      set({ syncing: false })
    }
  },

  connectWorkspace: async (id, accessKey) => {
    set({ syncing: true })
    try {
      const dto = await api.getWorkspace(id, accessKey)
      const link: WorkspaceLink = {
        id: dto.id,
        name: dto.name,
        accessKey,
        revision: dto.revision,
        shareToken: dto.share_token,
        lastSyncedAt: new Date().toISOString(),
      }
      set({
        workspace: link,
        collections: dto.collections as Collection[],
        requests: dto.requests as RequestSpec[],
        environments: dto.environments as Environment[],
      })
      saveWorkspace(link)
      get().persist()
      get().toast('success', `Đã kết nối workspace "${dto.name}"`)
    } catch (err) {
      get().toast('error', `Không kết nối được: ${(err as Error).message}`)
    } finally {
      set({ syncing: false })
    }
  },

  pullWorkspace: async () => {
    const workspace = get().workspace
    if (!workspace) return
    set({ syncing: true })
    try {
      const dto = await api.getWorkspace(workspace.id, workspace.accessKey)
      set({
        collections: dto.collections as Collection[],
        requests: dto.requests as RequestSpec[],
        environments: dto.environments as Environment[],
        workspace: { ...workspace, revision: dto.revision, shareToken: dto.share_token, lastSyncedAt: new Date().toISOString() },
      })
      saveWorkspace(get().workspace)
      get().persist()
      get().toast('success', `Đã tải về revision ${dto.revision}`)
    } catch (err) {
      get().toast('error', `Tải về thất bại: ${(err as Error).message}`)
    } finally {
      set({ syncing: false })
    }
  },

  pushWorkspace: async (force = false) => {
    const state = get()
    const workspace = state.workspace
    if (!workspace) return

    set({ syncing: true })
    try {
      const dto = await api.saveWorkspace(workspace.id, workspace.accessKey, {
        revision: workspace.revision,
        name: workspace.name,
        collections: state.collections,
        requests: state.requests,
        environments: state.environments,
      })
      const link = { ...workspace, revision: dto.revision, lastSyncedAt: new Date().toISOString() }
      set({ workspace: link })
      saveWorkspace(link)
      if (!force) get().toast('success', `Đã đẩy lên revision ${dto.revision}`)
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Somebody else saved first. Refuse rather than clobber, and say what to do.
        const current = (err.payload as any)?.current
        get().toast(
          'error',
          `Workspace đã đổi trên server (revision ${current?.revision ?? '?'}). Hãy "Tải về" rồi đẩy lại.`,
        )
      } else {
        get().toast('error', `Đẩy lên thất bại: ${(err as Error).message}`)
      }
    } finally {
      set({ syncing: false })
    }
  },

  disconnectWorkspace: () => {
    set({ workspace: null })
    saveWorkspace(null)
    get().toast('info', 'Đã ngắt kết nối workspace. Dữ liệu vẫn còn trong trình duyệt.')
  },

  toggleShare: async (enabled) => {
    const workspace = get().workspace
    if (!workspace) return
    try {
      const result = await api.setShare(workspace.id, workspace.accessKey, enabled)
      const link = { ...workspace, shareToken: result.share_token }
      set({ workspace: link })
      saveWorkspace(link)
      get().toast('success', enabled ? 'Đã bật link chia sẻ' : 'Đã thu hồi link chia sẻ')
    } catch (err) {
      get().toast('error', `Không đổi được trạng thái chia sẻ: ${(err as Error).message}`)
    }
  },

  checkProxy: async () => {
    try {
      const status = await api.proxyStatus()
      set({ proxyAvailable: status.enabled })
    } catch {
      set({ proxyAvailable: false })
    }
  },

  resetEverything: () => {
    clearStorage()
    const fresh = newTab(blankRequest())
    set({ ...EMPTY_STATE, tabs: [fresh], activeTabId: fresh.id, workspace: null, runnerRows: [] })
    get().toast('success', 'Đã xóa toàn bộ dữ liệu cục bộ')
  },
}))

// ---------------------------------------------------------------------------
export function isDescendant(collections: Collection[], collectionId: string, candidateParentId: string): boolean {
  const byId = new Map(collections.map((c) => [c.id, c]))
  let cursor = byId.get(candidateParentId)
  const seen = new Set<string>()
  while (cursor) {
    if (cursor.id === collectionId) return true
    if (seen.has(cursor.id)) return true // pre-existing cycle; refuse anyway
    seen.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return false
}

export function describeFailure(
  err: unknown,
  timedOut: boolean,
  mode: string,
  timeoutSeconds: number,
): { message: string; kind: 'aborted' | 'timeout' | 'network' | 'proxy' | 'unknown'; hint?: string } {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return timedOut
      ? { kind: 'timeout', message: `Request quá ${timeoutSeconds}s và đã bị hủy (timeout).` }
      : { kind: 'aborted', message: 'Request đã bị hủy.' }
  }
  if (err instanceof ProxyError) {
    return {
      kind: 'proxy',
      message: err.message,
      hint: 'Kiểm tra PROXY_ENABLED và PROXY_ALLOWED_HOSTS trong .env của backend FastAPI.',
    }
  }
  if (err instanceof TypeError) {
    // The browser refuses to say whether this was CORS, DNS or a refused
    // connection, so spell out the option that fixes the common case.
    return {
      kind: 'network',
      message: `Trình duyệt không gửi được request: ${err.message}`,
      hint:
        mode === 'direct'
          ? 'Thường là CORS: server đích không trả Access-Control-Allow-Origin. Đổi chế độ gửi sang Proxy hoặc Auto.'
          : 'Kiểm tra URL, DNS, hoặc server đích có đang chạy không.',
    }
  }
  return { kind: 'unknown', message: (err as Error)?.message ?? 'Lỗi không xác định' }
}

// Convenience selectors used across components.
export const selectActiveTab = (s: Store): Tab | undefined => s.tabs.find((t) => t.id === s.activeTabId)
export const selectActiveEnv = (s: Store): Environment | undefined =>
  s.environments.find((e) => e.id === s.activeEnvironmentId)

export type { KeyValue, ExtractRule, HttpMethod }
