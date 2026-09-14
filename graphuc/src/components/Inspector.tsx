/**
 * The right-hand panel: properties of whatever is selected, plus the rules the
 * current document kind imposes and how the drawing measures up to them.
 *
 * Formatting lives here rather than on the canvas: a click on a node should
 * select it, not open a floating toolbar that covers the graph you are trying
 * to look at.
 */

import { useEditor } from '../store'
import { KINDS, inDegree, nodeKey, outDegree } from '../lib/graph'
import { componentCount } from '../lib/layout'
import type { EdgeShape, EdgeStyle, GraphEdge, GraphNode, NodeShape } from '../types'
import './Inspector.css'

const NODE_SHAPES: { id: NodeShape; label: string }[] = [
  { id: 'circle', label: 'Tròn' },
  { id: 'doubleCircle', label: 'Tròn viền đôi' },
  { id: 'rounded', label: 'Chữ nhật bo góc' },
  { id: 'rect', label: 'Chữ nhật' },
  { id: 'stadium', label: 'Viên thuốc' },
  { id: 'diamond', label: 'Thoi (quyết định)' },
  { id: 'hexagon', label: 'Lục giác' },
  { id: 'parallelogram', label: 'Bình hành (vào/ra)' },
  { id: 'cylinder', label: 'Trụ (CSDL)' }
]

const EDGE_STYLES: { id: EdgeStyle; label: string }[] = [
  { id: 'solid', label: 'Liền' },
  { id: 'dashed', label: 'Nét đứt' },
  { id: 'dotted', label: 'Chấm' },
  { id: 'double', label: 'Đôi' }
]

const EDGE_SHAPES: { id: EdgeShape; label: string }[] = [
  { id: 'straight', label: 'Thẳng' },
  { id: 'curved', label: 'Cong' },
  { id: 'orthogonal', label: 'Gấp khúc' }
]

const ARROWS = [
  { id: 'arrow', label: 'Mũi tên' },
  { id: 'hollow', label: 'Mũi rỗng' },
  { id: 'dot', label: 'Chấm tròn' },
  { id: 'diamond', label: 'Thoi' },
  { id: 'none', label: 'Không' }
]

const SWATCHES = ['#1e293b', '#0f766e', '#7f1d1d', '#78350f', '#14532d', '#4c1d95', '#0c4a6e', '#334155', '#e2e8f0']

function Inspector() {
  const document_ = useEditor((state) => state.document)
  const selection = useEditor((state) => state.selection)
  const violations = useEditor((state) => state.violations)
  const updateNode = useEditor((state) => state.updateNode)
  const updateEdge = useEditor((state) => state.updateEdge)
  const updateAnnotation = useEditor((state) => state.updateAnnotation)
  const setDefaults = useEditor((state) => state.setDefaults)
  const deleteSelection = useEditor((state) => state.deleteSelection)
  const select = useEditor((state) => state.select)

  const kind = KINDS[document_.kind]

  const selectedNodes =
    selection.type === 'node' ? document_.nodes.filter((node) => selection.ids.includes(node.id)) : []
  const selectedEdges =
    selection.type === 'edge' ? document_.edges.filter((edge) => selection.ids.includes(edge.id)) : []
  const selectedAnnotations =
    selection.type === 'annotation' ? document_.annotations.filter((item) => selection.ids.includes(item.id)) : []

  return (
    <aside className="inspector">
      <section className="panel">
        <h3>Kiểu: {kind.label}</h3>
        <p className="hint">{kind.note}</p>
        <div className="stat-row">
          <div className="stat"><span>Đỉnh</span><b>{document_.nodes.length}</b></div>
          <div className="stat"><span>Cạnh</span><b>{document_.edges.length}</b></div>
          <div className="stat"><span>Thành phần</span><b>{componentCount(document_)}</b></div>
        </div>
        {violations.length ? (
          <ul className="violations">
            {violations.map((violation) => (
              <li key={violation.rule}>
                <button
                  className="violation"
                  onClick={() => {
                    // Selecting what is wrong is the fastest route to fixing it.
                    if (violation.nodeIds?.length) select({ type: 'node', ids: violation.nodeIds })
                    else if (violation.edgeIds?.length) select({ type: 'edge', ids: violation.edgeIds })
                  }}
                >
                  {violation.message}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ok">✓ Thoả mọi ràng buộc của kiểu này.</p>
        )}
      </section>

      {selectedNodes.length > 0 && <NodePanel nodes={selectedNodes} onChange={updateNode} onDelete={deleteSelection} />}
      {selectedEdges.length > 0 && (
        <EdgePanel edges={selectedEdges} weighted={document_.weighted} directed={document_.directed} onChange={updateEdge} onDelete={deleteSelection} />
      )}
      {selectedAnnotations.length > 0 && (
        <section className="panel">
          <h3>Ghi chú</h3>
          {selectedAnnotations.map((annotation) => (
            <div className="field" key={annotation.id}>
              <textarea
                rows={3}
                value={annotation.text}
                onChange={(event) => updateAnnotation(annotation.id, { text: event.target.value })}
              />
              <input
                type="color"
                value={annotation.color ?? '#94a3b8'}
                onChange={(event) => updateAnnotation(annotation.id, { color: event.target.value })}
              />
            </div>
          ))}
          <button className="btn btn-danger" onClick={deleteSelection}>Xoá ghi chú</button>
        </section>
      )}

      {selection.type === 'none' && (
        <section className="panel">
          <h3>Định dạng mặc định</h3>
          <p className="hint">Áp cho mọi đỉnh và cạnh chưa có định dạng riêng.</p>
          <div className="field">
            <label>Hình đỉnh</label>
            <select value={document_.defaults.nodeShape} onChange={(event) => setDefaults({ nodeShape: event.target.value as NodeShape })}>
              {NODE_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
            </select>
          </div>
          <div className="field-inline">
            <div className="field"><label>Nền</label><input type="color" value={document_.defaults.nodeFill} onChange={(event) => setDefaults({ nodeFill: event.target.value })} /></div>
            <div className="field"><label>Viền</label><input type="color" value={document_.defaults.nodeStroke} onChange={(event) => setDefaults({ nodeStroke: event.target.value })} /></div>
            <div className="field"><label>Chữ</label><input type="color" value={document_.defaults.nodeTextColor} onChange={(event) => setDefaults({ nodeTextColor: event.target.value })} /></div>
            <div className="field"><label>Cạnh</label><input type="color" value={document_.defaults.edgeColor} onChange={(event) => setDefaults({ edgeColor: event.target.value })} /></div>
          </div>
          <div className="field-inline">
            <div className="field">
              <label>Rộng {document_.defaults.nodeWidth}px</label>
              <input type="range" min={30} max={160} value={document_.defaults.nodeWidth} onChange={(event) => setDefaults({ nodeWidth: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Cao {document_.defaults.nodeHeight}px</label>
              <input type="range" min={30} max={120} value={document_.defaults.nodeHeight} onChange={(event) => setDefaults({ nodeHeight: Number(event.target.value) })} />
            </div>
          </div>
          <div className="field">
            <label>Kiểu cạnh</label>
            <select value={document_.defaults.edgeShape} onChange={(event) => setDefaults({ edgeShape: event.target.value as EdgeShape })}>
              {EDGE_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
            </select>
          </div>
          <p className="hint">Chọn một đỉnh hoặc cạnh để chỉnh riêng nó.</p>
        </section>
      )}
    </aside>
  )
}

function NodePanel({
  nodes,
  onChange,
  onDelete
}: {
  nodes: GraphNode[]
  onChange: (id: string, patch: Partial<GraphNode>) => void
  onDelete: () => void
}) {
  const document_ = useEditor((state) => state.document)
  const incoming = inDegree(document_)
  const outgoing = outDegree(document_)
  const single = nodes.length === 1 ? nodes[0] : null

  /** Applying to every selected node is what makes a multi-selection useful. */
  const patchAll = (patch: Partial<GraphNode>) => {
    for (const node of nodes) onChange(node.id, patch)
  }

  return (
    <section className="panel">
      <h3>{single ? 'Đỉnh' : `${nodes.length} đỉnh`}</h3>

      {single && (
        <>
          <div className="field">
            <label htmlFor="node-label">Nhãn</label>
            <input id="node-label" value={single.label} onChange={(event) => onChange(single.id, { label: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="node-note">Ghi chú</label>
            <textarea id="node-note" rows={2} value={single.note ?? ''} onChange={(event) => onChange(single.id, { note: event.target.value })} />
          </div>
          <div className="field-inline">
            <div className="field"><label>x</label><input type="number" value={Math.round(single.x)} onChange={(event) => onChange(single.id, { x: Number(event.target.value) })} /></div>
            <div className="field"><label>y</label><input type="number" value={Math.round(single.y)} onChange={(event) => onChange(single.id, { y: Number(event.target.value) })} /></div>
          </div>
          <div className="stat-row">
            <div className="stat"><span>Bậc vào</span><b>{incoming.get(single.id) ?? 0}</b></div>
            <div className="stat"><span>Bậc ra</span><b>{outgoing.get(single.id) ?? 0}</b></div>
            {nodeKey(single) !== null && <div className="stat"><span>Khoá</span><b>{nodeKey(single)}</b></div>}
          </div>
        </>
      )}

      <div className="field">
        <label>Hình dạng</label>
        <select value={single?.shape ?? ''} onChange={(event) => patchAll({ shape: (event.target.value || undefined) as NodeShape })}>
          <option value="">(theo mặc định)</option>
          {NODE_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Màu nền</label>
        <div className="swatches" data-keep-open>
          {SWATCHES.map((colour) => (
            <button key={colour} className="swatch" style={{ background: colour }} onClick={() => patchAll({ fill: colour })} aria-label={`Màu ${colour}`} />
          ))}
          <input type="color" value={single?.fill ?? '#1e293b'} onChange={(event) => patchAll({ fill: event.target.value })} />
        </div>
      </div>

      <div className="field-inline">
        <div className="field"><label>Viền</label><input type="color" value={single?.stroke ?? '#38bdf8'} onChange={(event) => patchAll({ stroke: event.target.value })} /></div>
        <div className="field"><label>Chữ</label><input type="color" value={single?.textColor ?? '#e2e8f0'} onChange={(event) => patchAll({ textColor: event.target.value })} /></div>
        <div className="field"><label>Dấu</label><input value={single?.badge ?? ''} maxLength={2} onChange={(event) => patchAll({ badge: event.target.value || undefined })} placeholder="★" /></div>
      </div>

      <label className="check">
        <input type="checkbox" checked={Boolean(single?.pinned)} onChange={(event) => patchAll({ pinned: event.target.checked })} />
        Ghim (không bị sắp xếp tự động di chuyển)
      </label>

      <div className="row">
        <button className="btn" onClick={() => patchAll({ fill: undefined, stroke: undefined, textColor: undefined, shape: undefined })}>Trả về mặc định</button>
        <button className="btn btn-danger" onClick={onDelete}>Xoá</button>
      </div>
    </section>
  )
}

function EdgePanel({
  edges,
  weighted,
  directed,
  onChange,
  onDelete
}: {
  edges: GraphEdge[]
  weighted: boolean
  directed: boolean
  onChange: (id: string, patch: Partial<GraphEdge>) => void
  onDelete: () => void
}) {
  const single = edges.length === 1 ? edges[0] : null
  const patchAll = (patch: Partial<GraphEdge>) => {
    for (const edge of edges) onChange(edge.id, patch)
  }

  return (
    <section className="panel">
      <h3>{single ? 'Cạnh' : `${edges.length} cạnh`}</h3>

      {single && (
        <>
          <div className="field">
            <label htmlFor="edge-label">Nhãn</label>
            <input id="edge-label" value={single.label ?? ''} onChange={(event) => onChange(single.id, { label: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="edge-note">Ghi chú</label>
            <textarea id="edge-note" rows={2} value={single.note ?? ''} onChange={(event) => onChange(single.id, { note: event.target.value })} />
          </div>
          <div className="field-inline">
            <div className="field">
              <label htmlFor="edge-weight">Trọng số</label>
              <input
                id="edge-weight"
                type="number"
                value={single.weight ?? ''}
                placeholder={weighted ? '1' : '—'}
                onChange={(event) => {
                  const value = event.target.value
                  // An empty box means "unweighted", not "weight 0" — storing a
                  // zero would quietly change what Dijkstra and MST compute.
                  const weight = value === '' ? undefined : Number(value)
                  onChange(single.id, { weight, label: weight === undefined ? single.label : String(weight) })
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="edge-capacity">Sức chứa</label>
              <input id="edge-capacity" type="number" value={single.capacity ?? ''} onChange={(event) => onChange(single.id, { capacity: event.target.value === '' ? undefined : Number(event.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="edge-flow">Luồng</label>
              <input id="edge-flow" type="number" value={single.flow ?? ''} onChange={(event) => onChange(single.id, { flow: event.target.value === '' ? undefined : Number(event.target.value) })} />
            </div>
          </div>
        </>
      )}

      <div className="field-inline">
        <div className="field">
          <label>Nét</label>
          <select value={single?.style ?? ''} onChange={(event) => patchAll({ style: (event.target.value || undefined) as EdgeStyle })}>
            <option value="">(mặc định)</option>
            {EDGE_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Dáng</label>
          <select value={single?.shape ?? ''} onChange={(event) => patchAll({ shape: (event.target.value || undefined) as EdgeShape })}>
            <option value="">(mặc định)</option>
            {EDGE_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Màu</label><input type="color" value={single?.color ?? '#64748b'} onChange={(event) => patchAll({ color: event.target.value })} /></div>
      </div>

      {directed && (
        <div className="field-inline">
          <div className="field">
            <label>Đầu mũi tên</label>
            <select value={single?.arrowHead ?? 'arrow'} onChange={(event) => patchAll({ arrowHead: event.target.value as GraphEdge['arrowHead'] })}>
              {ARROWS.map((arrow) => <option key={arrow.id} value={arrow.id}>{arrow.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Đuôi</label>
            <select value={single?.arrowTail ?? 'none'} onChange={(event) => patchAll({ arrowTail: event.target.value as GraphEdge['arrowTail'] })}>
              {ARROWS.map((arrow) => <option key={arrow.id} value={arrow.id}>{arrow.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <label>Độ cong {single?.curvature ?? 0}</label>
        <input
          type="range"
          min={-120}
          max={120}
          value={single?.curvature ?? 0}
          onChange={(event) => patchAll({ curvature: Number(event.target.value) || undefined })}
        />
      </div>

      <button className="btn btn-danger" onClick={onDelete}>Xoá cạnh</button>
    </section>
  )
}

export default Inspector
