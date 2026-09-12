import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { api } from '../lib/api'
import { formatRelativeTime } from '../lib/util'
import { type TreeNode, buildTree } from '../lib/tree'
import {
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFolder,
  IconPlay,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from './Icons'

interface SidebarProps {
  onImport: () => void
}

export function Sidebar({ onImport }: SidebarProps) {
  const collections = useStore((s) => s.collections)
  const requests = useStore((s) => s.requests)
  const expanded = useStore((s) => s.expandedCollections)
  const filter = useStore((s) => s.sidebarFilter)
  const sidebarTab = useStore((s) => s.sidebarTab)
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)

  const setSidebarFilter = useStore((s) => s.setSidebarFilter)
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const toggleCollection = useStore((s) => s.toggleCollection)
  const openRequest = useStore((s) => s.openRequest)
  const addCollection = useStore((s) => s.addCollection)
  const deleteCollection = useStore((s) => s.deleteCollection)
  const updateCollection = useStore((s) => s.updateCollection)
  const deleteRequest = useStore((s) => s.deleteRequest)
  const duplicateRequest = useStore((s) => s.duplicateRequest)
  const moveRequest = useStore((s) => s.moveRequest)
  const moveCollection = useStore((s) => s.moveCollection)
  const runCollection = useStore((s) => s.runCollection)

  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const openRequestId = tabs.find((tab) => tab.id === activeTabId)?.requestId ?? null

  const tree = useMemo(() => buildTree(collections, requests, filter), [collections, requests, filter])

  const startDrag = (event: React.DragEvent, kind: 'collection' | 'request', id: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ kind, id }))
  }

  const handleDrop = (event: React.DragEvent, targetCollectionId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverId(null)
    try {
      const payload = JSON.parse(event.dataTransfer.getData('text/plain'))
      if (payload.kind === 'request') moveRequest(payload.id, targetCollectionId)
      else if (payload.kind === 'collection') moveCollection(payload.id, targetCollectionId)
    } catch {
      /* not our payload */
    }
  }

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (node.kind === 'request') {
      const request = node.data
      return (
        <div
          key={request.id}
          className={`tree-node${openRequestId === request.id ? ' active' : ''}`}
          draggable
          onDragStart={(e) => startDrag(e, 'request', request.id)}
          onClick={() => openRequest(request.id)}
          title={request.url}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openRequest(request.id)}
        >
          <span className="tree-caret" />
          <span className={`method-badge method-${request.method}`}>{request.method}</span>
          <span className="tree-label">{request.name}</span>
          <span className="tree-actions">
            <button
              className="btn btn-ghost btn-sm"
              title="Nhân bản"
              onClick={(e) => {
                e.stopPropagation()
                duplicateRequest(request.id)
              }}
            >
              <IconCopy size={12} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Xóa"
              onClick={(e) => {
                e.stopPropagation()
                deleteRequest(request.id)
              }}
            >
              <IconTrash size={12} />
            </button>
          </span>
        </div>
      )
    }

    const collection = node.data
    const isOpen = expanded.includes(collection.id) || Boolean(filter)
    return (
      <div key={collection.id}>
        <div
          className={`tree-node${dragOverId === collection.id ? ' drag-over' : ''}`}
          draggable
          onDragStart={(e) => startDrag(e, 'collection', collection.id)}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(collection.id)
          }}
          onDragLeave={() => setDragOverId((id) => (id === collection.id ? null : id))}
          onDrop={(e) => handleDrop(e, collection.id)}
          onClick={() => toggleCollection(collection.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleCollection(collection.id)}
        >
          <span className="tree-caret">{isOpen ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}</span>
          <IconFolder size={13} />
          <span className="tree-label">{collection.name}</span>
          <span className="tree-actions">
            <button
              className="btn btn-ghost btn-sm"
              title="Chạy cả collection"
              onClick={(e) => {
                e.stopPropagation()
                runCollection(collection.id)
              }}
            >
              <IconPlay size={12} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Thêm collection con"
              onClick={(e) => {
                e.stopPropagation()
                const name = prompt('Tên collection con:')
                if (name?.trim()) addCollection(name.trim(), collection.id)
              }}
            >
              <IconPlus size={12} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Đổi tên"
              onClick={(e) => {
                e.stopPropagation()
                const name = prompt('Tên mới:', collection.name)
                if (name?.trim()) updateCollection(collection.id, { name: name.trim() })
              }}
            >
              ✎
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Xóa collection và mọi thứ bên trong"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Xóa "${collection.name}" cùng toàn bộ request và collection con bên trong?`)) {
                  deleteCollection(collection.id)
                }
              }}
            >
              <IconTrash size={12} />
            </button>
          </span>
        </div>
        {isOpen && node.children.length ? (
          <div className="tree-children">{node.children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${sidebarTab === 'collections' ? ' active' : ''}`}
          onClick={() => setSidebarTab('collections')}
        >
          Collections
        </button>
        <button
          className={`sidebar-tab${sidebarTab === 'history' ? ' active' : ''}`}
          onClick={() => setSidebarTab('history')}
        >
          History
        </button>
      </div>

      <div className="sidebar-toolbar">
        <IconSearch className="faint" />
        <input
          type="search"
          value={filter}
          placeholder="Lọc theo tên hoặc URL…"
          onChange={(e) => setSidebarFilter(e.target.value)}
          aria-label="Lọc"
        />
        <button
          className="btn btn-ghost"
          title="Tạo collection"
          onClick={() => {
            const name = prompt('Tên collection:')
            if (name?.trim()) addCollection(name.trim(), null)
          }}
        >
          <IconPlus />
        </button>
        <button className="btn btn-ghost" title="Import Postman / OpenAPI" onClick={onImport}>
          <IconUpload />
        </button>
      </div>

      <div
        className="sidebar-body"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, null)}
        title="Thả vào vùng trống để đưa request ra ngoài mọi collection"
      >
        {sidebarTab === 'collections' ? (
          tree.length ? (
            tree.map((node) => renderNode(node, 0))
          ) : (
            <div className="empty">
              <div className="empty-icon">📂</div>
              {filter ? `Không có gì khớp "${filter}"` : 'Chưa có gì ở đây. Tạo collection hoặc import từ Postman/OpenAPI.'}
            </div>
          )
        ) : (
          <HistoryList />
        )}
      </div>

      <div className="sidebar-footer">
        <span>{collections.length} collection</span>
        <span>{requests.length} request</span>
      </div>
    </aside>
  )
}

/** Server-side history, when a workspace is connected. */
function HistoryList() {
  const workspace = useStore((s) => s.workspace)
  const openDraft = useStore((s) => s.openDraft)
  const [items, setItems] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!workspace) return
    setError(null)
    try {
      const page = await api.listHistory(workspace.id, workspace.accessKey, 100)
      setItems(page.items)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!workspace) {
    return (
      <div className="empty">
        <div className="empty-icon">☁️</div>
        Kết nối workspace để lưu lịch sử trên server và xem được từ máy khác.
      </div>
    )
  }

  if (items === null) {
    return (
      <div className="empty">
        <button className="btn btn-sm" onClick={load}>
          Tải lịch sử từ server
        </button>
        {error ? <p className="notice notice-error">{error}</p> : null}
      </div>
    )
  }

  if (!items.length) return <div className="empty">Chưa có request nào được ghi lại.</div>

  return (
    <>
      <button className="btn btn-sm" onClick={load} style={{ width: '100%', marginBottom: 6 }}>
        Làm mới
      </button>
      {items.map((item) => (
        <div
          key={item.id}
          className="tree-node"
          role="button"
          tabIndex={0}
          onClick={() => item.spec && openDraft({ ...item.spec, id: item.spec.id ?? item.id })}
          onKeyDown={(e) => e.key === 'Enter' && item.spec && openDraft(item.spec)}
          title={item.url}
        >
          <span className={`method-badge method-${item.method}`}>{item.method}</span>
          <span className="tree-label">{item.url}</span>
          <span className="faint" style={{ fontSize: 10 }}>
            {item.status ?? '—'} · {formatRelativeTime(item.timestamp)}
          </span>
        </div>
      ))}
    </>
  )
}

