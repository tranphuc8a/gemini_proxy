/**
 * Editor state.
 *
 * One rule shapes this file: **every change to the document goes through
 * `commit`**. It is what pushes the undo checkpoint, stamps `updatedAt`,
 * re-runs validation and schedules the local save. A mutation that sets
 * `document` directly would leave a change the user cannot undo, and that is
 * the bug an editor cannot afford.
 *
 * History holds whole documents rather than deltas. A hand-drawn graph is a few
 * kilobytes, and a delta log would need an inverse for every operation --
 * including the layouts, which move everything at once.
 */

import { create } from 'zustand'
import type {
  AlgorithmId
} from './lib/algorithms'
import type {
  BackendInfo,
  GraphDocument,
  GraphEdge,
  GraphKind,
  GraphNode,
  GraphSummary,
  Selection,
  StorageBackend,
  Toast,
  Tool,
  Violation
} from './types'
import { runAlgorithm, type AlgorithmResult } from './lib/algorithms'
import { KINDS, emptyDocument, makeEdge, makeNode, parseDocument, validate } from './lib/graph'
import { runLayout, type LayoutId } from './lib/layout'
import { createId } from './lib/id'
import { templateById } from './lib/templates'
import * as storage from './services/graphStorage'

const HISTORY_LIMIT = 120
const AUTOSAVE_MS = 600

export interface EditorSettings {
  theme: 'dark' | 'light'
  grid: number
  showGrid: boolean
  showLabels: boolean
  showWeights: boolean
  snapToGrid: boolean
  backend: StorageBackend
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'dark',
  grid: 20,
  showGrid: true,
  showLabels: true,
  showWeights: true,
  snapToGrid: true,
  backend: 'json'
}

export interface AlgorithmState {
  id: AlgorithmId | null
  result: AlgorithmResult | null
  step: number
  playing: boolean
  startNode: string | null
}

interface EditorStore {
  document: GraphDocument
  past: GraphDocument[]
  future: GraphDocument[]
  selection: Selection
  tool: Tool
  /** The node an edge is being drawn from, while the edge tool is armed. */
  pendingEdgeSource: string | null
  violations: Violation[]
  settings: EditorSettings
  toasts: Toast[]
  isAdmin: boolean
  backends: BackendInfo[]
  remoteGraphs: GraphSummary[]
  busy: string | null
  algorithm: AlgorithmState

  // document
  commit: (next: GraphDocument, options?: { silent?: boolean }) => void
  replaceDocument: (next: GraphDocument) => void
  setTitle: (title: string) => void
  setKind: (kind: GraphKind) => void
  setDefaults: (patch: Partial<GraphDocument['defaults']>) => void
  setView: (view: GraphDocument['view']) => void

  // nodes and edges
  addNode: (x: number, y: number, label?: string) => string
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  moveNodes: (moves: { id: string; x: number; y: number }[], options?: { silent?: boolean }) => void
  deleteSelection: () => void
  addEdge: (source: string, target: string) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  addAnnotation: (x: number, y: number) => void
  updateAnnotation: (id: string, patch: { text?: string; x?: number; y?: number; color?: string }) => void

  // selection and tools
  select: (selection: Selection) => void
  setTool: (tool: Tool) => void
  setPendingEdgeSource: (id: string | null) => void

  // history
  undo: () => void
  redo: () => void

  // layout and algorithms
  applyLayout: (layout: LayoutId) => void
  runAlgorithm: (id: AlgorithmId) => void
  setAlgorithmStep: (step: number) => void
  setAlgorithmStart: (id: string | null) => void
  stopAlgorithm: () => void

  // storage
  newDocument: (templateId?: string) => void
  saveLocal: () => void
  openLocal: (id: string) => void
  refreshBackends: () => Promise<void>
  refreshRemote: () => Promise<void>
  saveRemote: () => Promise<void>
  openRemote: (id: string) => Promise<void>
  deleteRemote: (id: string) => Promise<void>
  unlockAdmin: (key: string) => Promise<boolean>
  restoreAdmin: () => Promise<void>
  lockAdmin: () => void

  // misc
  updateSettings: (patch: Partial<EditorSettings>) => void
  pushToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  hydrate: () => void
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export const useEditor = create<EditorStore>((set, get) => {
  /** Debounced local save. The editor is usable offline, so this is the real save. */
  const scheduleSave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      storage.saveLocal(get().document)
    }, AUTOSAVE_MS)
  }

  return {
    document: emptyDocument('graph'),
    past: [],
    future: [],
    selection: { type: 'none' },
    tool: 'select',
    pendingEdgeSource: null,
    violations: [],
    settings: { ...DEFAULT_SETTINGS },
    toasts: [],
    isAdmin: false,
    backends: [],
    remoteGraphs: [],
    busy: null,
    algorithm: { id: null, result: null, step: 0, playing: false, startNode: null },

    /**
     * The single path every document change takes.
     *
     * `silent` skips the history push, and exists for exactly one case: the
     * hundreds of intermediate documents produced while a node is being
     * dragged. The drag's *start* is checkpointed once, so one undo puts the
     * node back where it was rather than replaying the drag frame by frame.
     */
    commit: (next, options = {}) => {
      const state = get()
      const stamped: GraphDocument = { ...next, updatedAt: new Date().toISOString() }
      set({
        document: stamped,
        past: options.silent ? state.past : [...state.past, state.document].slice(-HISTORY_LIMIT),
        future: options.silent ? state.future : [],
        violations: validate(stamped)
      })
      scheduleSave()
    },

    replaceDocument: (next) => {
      set({
        document: next,
        past: [],
        future: [],
        selection: { type: 'none' },
        pendingEdgeSource: null,
        violations: validate(next),
        algorithm: { id: null, result: null, step: 0, playing: false, startNode: null }
      })
      storage.saveLocal(next)
    },

    setTitle: (title) => get().commit({ ...get().document, title }),

    /**
     * Change the kind, and follow the kind's own answers for direction and
     * weighting.
     *
     * Nothing is deleted: turning a graph into a tree when it has a cycle leaves
     * the cycle in place and reports it. Silently pruning edges to satisfy a
     * constraint would destroy work the user can never get back.
     */
    setKind: (kind) => {
      const spec = KINDS[kind]
      const document = get().document
      get().commit({
        ...document,
        kind,
        directed: spec.directed,
        weighted: spec.weighted || document.weighted,
        defaults: { ...document.defaults, nodeShape: spec.nodeShape ?? document.defaults.nodeShape }
      })
    },

    setDefaults: (patch) => {
      const document = get().document
      get().commit({ ...document, defaults: { ...document.defaults, ...patch } })
    },

    // The viewport is not part of the drawing, so panning must not be undoable
    // and must not stamp the document as edited.
    setView: (view) => set((state) => ({ document: { ...state.document, view } })),

    addNode: (x, y, label) => {
      const document = get().document
      const node = makeNode(x, y, label ?? String(document.nodes.length + 1))
      get().commit({ ...document, nodes: [...document.nodes, node] })
      set({ selection: { type: 'node', ids: [node.id] } })
      return node.id
    },

    updateNode: (id, patch) => {
      const document = get().document
      get().commit({
        ...document,
        nodes: document.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
      })
    },

    moveNodes: (moves, options) => {
      const document = get().document
      const byId = new Map(moves.map((move) => [move.id, move]))
      get().commit(
        {
          ...document,
          nodes: document.nodes.map((node) => {
            const move = byId.get(node.id)
            return move ? { ...node, x: move.x, y: move.y } : node
          })
        },
        options
      )
    },

    deleteSelection: () => {
      const { document, selection } = get()
      if (selection.type === 'none') return

      if (selection.type === 'node') {
        const doomed = new Set(selection.ids)
        get().commit({
          ...document,
          nodes: document.nodes.filter((node) => !doomed.has(node.id)),
          // Edges to a deleted node have to go: a dangling edge breaks every
          // layout and traversal, and the user has no way to repair one.
          edges: document.edges.filter((edge) => !doomed.has(edge.source) && !doomed.has(edge.target))
        })
      } else if (selection.type === 'edge') {
        const doomed = new Set(selection.ids)
        get().commit({ ...document, edges: document.edges.filter((edge) => !doomed.has(edge.id)) })
      } else {
        const doomed = new Set(selection.ids)
        get().commit({ ...document, annotations: document.annotations.filter((item) => !doomed.has(item.id)) })
      }
      set({ selection: { type: 'none' } })
    },

    addEdge: (source, target) => {
      const document = get().document
      const spec = KINDS[document.kind]

      if (source === target && !spec.allowSelfLoops) {
        get().pushToast(`${spec.label} không cho phép khuyên.`, 'warn')
        return
      }
      if (!spec.allowParallel) {
        const key = (edge: GraphEdge) =>
          document.directed ? `${edge.source}>${edge.target}` : [edge.source, edge.target].sort().join('-')
        const candidate = { source, target } as GraphEdge
        if (document.edges.some((edge) => key(edge) === key(candidate))) {
          get().pushToast('Cạnh này đã tồn tại — kiểu đồ thị hiện tại không cho phép cạnh song song.', 'warn')
          return
        }
      }

      const edge = makeEdge(source, target, document.weighted ? { weight: 1, label: '1' } : {})
      get().commit({ ...document, edges: [...document.edges, edge] })
      set({ selection: { type: 'edge', ids: [edge.id] } })
    },

    updateEdge: (id, patch) => {
      const document = get().document
      get().commit({
        ...document,
        edges: document.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge))
      })
    },

    addAnnotation: (x, y) => {
      const document = get().document
      const annotation = { id: createId('a'), text: 'Ghi chú', x, y }
      get().commit({ ...document, annotations: [...document.annotations, annotation] })
      set({ selection: { type: 'annotation', ids: [annotation.id] } })
    },

    updateAnnotation: (id, patch) => {
      const document = get().document
      get().commit({
        ...document,
        annotations: document.annotations.map((item) => (item.id === id ? { ...item, ...patch } : item))
      })
    },

    select: (selection) => set({ selection }),
    setTool: (tool) => set({ tool, pendingEdgeSource: null }),
    setPendingEdgeSource: (id) => set({ pendingEdgeSource: id }),

    undo: () => {
      const { past, document, future } = get()
      const previous = past[past.length - 1]
      if (!previous) return
      set({
        document: previous,
        past: past.slice(0, -1),
        future: [document, ...future].slice(0, HISTORY_LIMIT),
        violations: validate(previous),
        selection: { type: 'none' }
      })
      scheduleSave()
    },

    redo: () => {
      const { past, document, future } = get()
      const next = future[0]
      if (!next) return
      set({
        document: next,
        past: [...past, document].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        violations: validate(next),
        selection: { type: 'none' }
      })
      scheduleSave()
    },

    applyLayout: (layout) => {
      const document = get().document
      if (!document.nodes.length) {
        get().pushToast('Chưa có đỉnh nào để sắp xếp.', 'info')
        return
      }
      const { positions, note } = runLayout(document, layout)
      get().commit({
        ...document,
        nodes: document.nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) }))
      })
      if (note) get().pushToast(note, 'warn')
    },

    runAlgorithm: (id) => {
      const { document, algorithm } = get()
      const result = runAlgorithm(document, id, algorithm.startNode ?? undefined)
      if (result.error) {
        get().pushToast(result.error, 'warn')
        set({ algorithm: { ...algorithm, id, result: null, step: 0, playing: false } })
        return
      }
      set({ algorithm: { ...algorithm, id, result, step: 0, playing: false } })
    },

    setAlgorithmStep: (step) => {
      const { algorithm } = get()
      if (!algorithm.result) return
      set({ algorithm: { ...algorithm, step: Math.max(0, Math.min(step, algorithm.result.steps.length - 1)) } })
    },

    setAlgorithmStart: (id) => set((state) => ({ algorithm: { ...state.algorithm, startNode: id } })),
    stopAlgorithm: () => set({ algorithm: { id: null, result: null, step: 0, playing: false, startNode: null } }),

    newDocument: (templateId) => {
      const template = templateId ? templateById(templateId) : undefined
      const document = template ? template.build() : emptyDocument('graph')
      get().replaceDocument(document)
      get().pushToast(template ? `Đã mở mẫu "${template.label}".` : 'Đã tạo đồ thị mới.', 'success')
    },

    saveLocal: () => {
      const saved = storage.saveLocal(get().document)
      get().pushToast(saved ? 'Đã lưu vào trình duyệt.' : 'Không lưu được — bộ nhớ trình duyệt đã đầy hoặc bị chặn.', saved ? 'success' : 'error')
    },

    openLocal: (id) => {
      const document = storage.loadLocal(id)
      if (!document) {
        get().pushToast('Không đọc được bản lưu này.', 'error')
        return
      }
      get().replaceDocument(document)
      get().pushToast(`Đã mở "${document.title}".`, 'success')
    },

    refreshBackends: async () => {
      try {
        set({ backends: await storage.listBackends() })
      } catch {
        // Not worth a toast: the picker just shows every backend, and a save
        // against a missing one reports the real reason.
        set({ backends: [] })
      }
    },

    refreshRemote: async () => {
      set({ busy: 'list' })
      try {
        set({ remoteGraphs: await storage.listRemote(get().settings.backend) })
      } catch (error) {
        get().pushToast(error instanceof Error ? error.message : 'Không tải được danh sách', 'error')
      } finally {
        set({ busy: null })
      }
    },

    saveRemote: async () => {
      set({ busy: 'save' })
      try {
        const summary = await storage.saveRemote(get().document, get().settings.backend)
        get().pushToast(`Đã lưu lên máy chủ (bản ${summary.revision}).`, 'success')
        await get().refreshRemote()
      } catch (error) {
        get().pushToast(error instanceof Error ? error.message : 'Lưu thất bại', 'error')
      } finally {
        set({ busy: null })
      }
    },

    openRemote: async (id) => {
      set({ busy: 'open' })
      try {
        const document = await storage.loadRemote(id, get().settings.backend)
        get().replaceDocument(document)
        get().pushToast(`Đã mở "${document.title}" từ máy chủ.`, 'success')
      } catch (error) {
        get().pushToast(error instanceof Error ? error.message : 'Không mở được', 'error')
      } finally {
        set({ busy: null })
      }
    },

    deleteRemote: async (id) => {
      set({ busy: 'delete' })
      try {
        await storage.deleteRemote(id, get().settings.backend)
        get().pushToast('Đã xoá trên máy chủ.', 'success')
        await get().refreshRemote()
      } catch (error) {
        get().pushToast(error instanceof Error ? error.message : 'Xoá thất bại', 'error')
      } finally {
        set({ busy: null })
      }
    },

    unlockAdmin: async (key) => {
      const accepted = await storage.unlock(key)
      if (accepted) {
        set({ isAdmin: true })
        get().pushToast('Đã mở khoá quyền admin.', 'success')
      }
      return accepted
    },

    restoreAdmin: async () => {
      if (await storage.restoreSession()) set({ isAdmin: true })
    },

    lockAdmin: () => {
      storage.lock()
      set({ isAdmin: false })
      get().pushToast('Đã khoá lại — chỉ còn xem và lưu cục bộ.', 'info')
    },

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch }
      set({ settings })
      storage.writeSettings(settings)
    },

    pushToast: (message, tone = 'info') => {
      const toast: Toast = { id: createId('t'), message, tone }
      set((state) => ({ toasts: [...state.toasts, toast] }))
      setTimeout(() => get().dismissToast(toast.id), 4200)
    },

    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

    hydrate: () => {
      const settings = storage.readSettings<EditorSettings>(DEFAULT_SETTINGS)
      set({ settings: { ...DEFAULT_SETTINGS, ...settings } })

      // A shared link wins over the last local document: following a link and
      // landing on somebody else's old drawing would be baffling.
      const shared = decodeShared()
      if (shared) {
        get().replaceDocument(shared)
        get().pushToast('Đã mở đồ thị từ link chia sẻ.', 'success')
      } else {
        const [latest] = storage.listLocal()
        const document = latest ? storage.loadLocal(latest.id) : null
        if (document) set({ document, violations: validate(document) })
      }

      void get().restoreAdmin()
      void get().refreshBackends()
    }
  }
})

/** `#g=<base64 JSON>` in the URL, for sharing a drawing without a server. */
function decodeShared(): GraphDocument | null {
  if (typeof location === 'undefined' || !location.hash.startsWith('#g=')) return null
  try {
    const padded = location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')
    return parseDocument(JSON.parse(decodeURIComponent(escape(atob(padded)))))
  } catch {
    return null
  }
}

export function encodeShareLink(document: GraphDocument): string {
  const json = JSON.stringify(document)
  // encodeURIComponent first so non-ASCII labels survive btoa's latin-1 range.
  const encoded = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${location.origin}${location.pathname}#g=${encoded}`
}
