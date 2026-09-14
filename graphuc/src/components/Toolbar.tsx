/**
 * The top bar: the document's identity, the drawing tools, and everything that
 * takes the drawing out of the editor.
 *
 * The export menu needs the live `<svg>` element, not a copy of the document,
 * because the exporters serialise what is actually on screen. It is looked up
 * from the DOM at click time rather than threaded through as a ref: the canvas
 * is a singleton, and a ref chain through three components for one query is
 * more machinery than the problem deserves.
 */

import { useState } from 'react'
import { encodeShareLink, useEditor } from '../store'
import { KINDS } from '../lib/graph'
import { LAYOUTS } from '../lib/layout'
import type { GraphKind } from '../types'
import { exportAdjacencyCsv, exportDot, exportJson, exportPdf, exportPng, exportSvg } from '../lib/exporters'
import { parseDocument } from '../lib/graph'
import Menu from './Menu'
import './Toolbar.css'

interface ToolbarProps {
  onOpenLibrary: () => void
  onOpenAuth: () => void
  onOpenAlgorithms: () => void
  onOpenHelp: () => void
}

const TOOLS: { id: 'select' | 'node' | 'edge' | 'annotation' | 'pan' | 'erase'; label: string; hint: string; icon: string }[] = [
  { id: 'select', label: 'Chọn', hint: 'V — chọn, kéo, quét vùng', icon: '⬚' },
  { id: 'node', label: 'Đỉnh', hint: 'N — bấm canvas để thêm đỉnh', icon: '●' },
  { id: 'edge', label: 'Cạnh', hint: 'E — bấm đỉnh nguồn rồi đỉnh đích', icon: '⟶' },
  { id: 'annotation', label: 'Ghi chú', hint: 'T — thêm nhãn tự do', icon: 'T' },
  { id: 'pan', label: 'Di chuyển', hint: 'H — kéo canvas', icon: '✥' },
  { id: 'erase', label: 'Xoá', hint: 'X — bấm để xoá đỉnh/cạnh', icon: '⌫' }
]

function Toolbar({ onOpenLibrary, onOpenAuth, onOpenAlgorithms, onOpenHelp }: ToolbarProps) {
  const document_ = useEditor((state) => state.document)
  const tool = useEditor((state) => state.tool)
  const settings = useEditor((state) => state.settings)
  const isAdmin = useEditor((state) => state.isAdmin)
  const past = useEditor((state) => state.past.length)
  const future = useEditor((state) => state.future.length)
  const busy = useEditor((state) => state.busy)

  const setTool = useEditor((state) => state.setTool)
  const setTitle = useEditor((state) => state.setTitle)
  const setKind = useEditor((state) => state.setKind)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const applyLayout = useEditor((state) => state.applyLayout)
  const saveLocalNow = useEditor((state) => state.saveLocal)
  const saveRemote = useEditor((state) => state.saveRemote)
  const replaceDocument = useEditor((state) => state.replaceDocument)
  const pushToast = useEditor((state) => state.pushToast)
  const updateSettings = useEditor((state) => state.updateSettings)
  const lockAdmin = useEditor((state) => state.lockAdmin)

  const [exporting, setExporting] = useState(false)

  const svg = () => window.document.querySelector<SVGSVGElement>('svg.canvas')

  const withSvg = async (label: string, action: (element: SVGSVGElement) => void | Promise<void>) => {
    const element = svg()
    if (!element) {
      pushToast('Không tìm thấy canvas để xuất.', 'error')
      return
    }
    setExporting(true)
    try {
      await action(element)
      pushToast(`Đã xuất ${label}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : `Không xuất được ${label}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  const onImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseDocument(JSON.parse(String(reader.result ?? 'null')))
      if (!parsed) {
        pushToast('File không phải một đồ thị graphuc hợp lệ.', 'error')
        return
      }
      replaceDocument(parsed)
      pushToast(`Đã nhập "${parsed.title}".`, 'success')
    }
    reader.onerror = () => pushToast('Không đọc được file.', 'error')
    reader.readAsText(file)
  }

  const share = async () => {
    const url = encodeShareLink(document_)
    if (url.length > 8000) {
      pushToast('Đồ thị quá lớn để nhét vào URL — hãy lưu lên máy chủ rồi chia sẻ từ đó.', 'warn')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      pushToast('Đã copy link chia sẻ.', 'success')
    } catch {
      window.prompt('Copy link này:', url)
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <div className="brand">
          <span className="brand-mark">◎</span>
          <span className="brand-name">graphuc</span>
        </div>

        <input
          className="title-input"
          value={document_.title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Tên đồ thị"
        />

        <select
          className="kind-select"
          value={document_.kind}
          onChange={(event) => setKind(event.target.value as GraphKind)}
          title={KINDS[document_.kind]?.note}
          aria-label="Loại đồ thị"
        >
          {Object.values(KINDS).map((kind) => (
            <option key={kind.id} value={kind.id}>{kind.label}</option>
          ))}
        </select>

        <div className="spacer" />

        <button className="btn btn-icon" onClick={undo} disabled={!past} title="Hoàn tác (Ctrl+Z)">↶</button>
        <button className="btn btn-icon" onClick={redo} disabled={!future} title="Làm lại (Ctrl+Shift+Z)">↷</button>

        <Menu label="Sắp xếp">
          {LAYOUTS.map((layout) => (
            <button key={layout.id} className="menu-item" onClick={() => applyLayout(layout.id)} title={layout.note}>
              {layout.label}
              <small>{layout.note}</small>
            </button>
          ))}
        </Menu>

        <button className="btn" onClick={onOpenAlgorithms}>Thuật toán</button>
        <button className="btn" onClick={onOpenLibrary}>Thư viện</button>

        <Menu label="Xuất / Nhập">
          <button className="menu-item" onClick={() => exportJson(document_)}>JSON<small>Đầy đủ, nhập lại được</small></button>
          <button className="menu-item" disabled={exporting} onClick={() => void withSvg('PNG', (element) => exportPng(document_, element))}>
            PNG<small>Ảnh raster, nền tối</small>
          </button>
          <button className="menu-item" disabled={exporting} onClick={() => void withSvg('SVG', (element) => exportSvg(document_, element))}>
            SVG<small>Vector, chỉnh được ở Illustrator/Figma</small>
          </button>
          <button className="menu-item" disabled={exporting} onClick={() => void withSvg('PDF', (element) => exportPdf(document_, element, { background: '#ffffff' }))}>
            PDF<small>Một trang A4, nền trắng</small>
          </button>
          <div className="menu-separator" />
          <button className="menu-item" onClick={() => exportDot(document_)}>DOT<small>Cho Graphviz</small></button>
          <button className="menu-item" onClick={() => exportAdjacencyCsv(document_)}>Ma trận kề (CSV)<small>Dạng bài tập hay yêu cầu</small></button>
          <div className="menu-separator" />
          <label className="menu-item">
            Nhập JSON…
            <small>Thay thế đồ thị đang mở</small>
            <input type="file" accept="application/json,.json" onChange={onImport} />
          </label>
        </Menu>

        <Menu label="Lưu" badge={isAdmin ? 'admin' : undefined}>
          <button className="menu-item" onClick={saveLocalNow}>Lưu vào trình duyệt<small>Luôn dùng được, không cần máy chủ</small></button>
          <button className="menu-item" onClick={share}>Copy link chia sẻ<small>Nhúng cả đồ thị vào URL</small></button>
          <div className="menu-separator" />
          <button className="menu-item" disabled={!isAdmin || busy !== null} onClick={() => void saveRemote()}>
            Lưu lên máy chủ<small>{isAdmin ? `Backend: ${settings.backend}` : 'Cần mở khoá admin'}</small>
          </button>
          {isAdmin ? (
            <button className="menu-item" onClick={lockAdmin}>Khoá lại<small>Quên session trên máy này</small></button>
          ) : (
            <button className="menu-item" onClick={onOpenAuth}>Mở khoá bằng admin token…</button>
          )}
        </Menu>

        <button className="btn btn-icon" onClick={onOpenHelp} title="Hướng dẫn">?</button>
        <button
          className="btn btn-icon"
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          title="Đổi giao diện sáng/tối"
        >
          {settings.theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="toolbar-row tools-row">
        <div className="tool-group" role="toolbar" aria-label="Công cụ vẽ">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              className={`tool${tool === item.id ? ' is-active' : ''}`}
              onClick={() => setTool(item.id)}
              title={item.hint}
              aria-pressed={tool === item.id}
            >
              <span className="tool-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <label className="check"><input type="checkbox" checked={settings.showGrid} onChange={(event) => updateSettings({ showGrid: event.target.checked })} /> Lưới</label>
        <label className="check"><input type="checkbox" checked={settings.snapToGrid} onChange={(event) => updateSettings({ snapToGrid: event.target.checked })} /> Bám lưới</label>
        <label className="check"><input type="checkbox" checked={settings.showLabels} onChange={(event) => updateSettings({ showLabels: event.target.checked })} /> Nhãn</label>
        <label className="check"><input type="checkbox" checked={settings.showWeights} onChange={(event) => updateSettings({ showWeights: event.target.checked })} /> Trọng số</label>
      </div>
    </header>
  )
}

export default Toolbar
