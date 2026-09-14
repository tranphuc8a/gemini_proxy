/**
 * The drawing surface.
 *
 * SVG rather than a `<canvas>`: nodes are individually hit-testable DOM
 * elements, text renders and scales without any work, and the same element tree
 * is what the SVG/PNG/PDF exporters serialise — so an export is the picture,
 * not a re-drawing of it.
 *
 * Pointer handling in one place, because the interactions overlap: a drag on a
 * node moves it, the same drag on the background pans, and both have to know
 * whether the edge tool is armed. Splitting that across components makes the
 * cases impossible to see.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store'
import type { GraphNode } from '../types'
import { parallelIndex } from '../lib/graph'
import { boundaryPoint, edgeGeometry, nodePath, nodeSize, snap } from '../lib/geometry'
import './Canvas.css'

interface Drag {
  kind: 'node' | 'pan' | 'marquee'
  startX: number
  startY: number
  /** Node id → its position when the drag began, so movement is absolute. */
  origins: Map<string, { x: number; y: number }>
  viewOrigin: { x: number; y: number }
  moved: boolean
}

const ARROW_SIZE = 9

function Canvas() {
  const document_ = useEditor((state) => state.document)
  const selection = useEditor((state) => state.selection)
  const tool = useEditor((state) => state.tool)
  const pendingEdgeSource = useEditor((state) => state.pendingEdgeSource)
  const settings = useEditor((state) => state.settings)
  const algorithm = useEditor((state) => state.algorithm)

  const select = useEditor((state) => state.select)
  const addNode = useEditor((state) => state.addNode)
  const addEdge = useEditor((state) => state.addEdge)
  const addAnnotation = useEditor((state) => state.addAnnotation)
  const moveNodes = useEditor((state) => state.moveNodes)
  const setPendingEdgeSource = useEditor((state) => state.setPendingEdgeSource)
  const setView = useEditor((state) => state.setView)
  const deleteSelection = useEditor((state) => state.deleteSelection)
  const setTool = useEditor((state) => state.setTool)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const { view } = document_
  const nodes = useMemo(() => new Map(document_.nodes.map((node) => [node.id, node])), [document_.nodes])

  /** Screen pixels → document coordinates, honouring the current pan and zoom. */
  const toWorld = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (event.clientX - rect.left - view.x) / view.zoom,
        y: (event.clientY - rect.top - view.y) / view.zoom
      }
    },
    [view]
  )

  // --- algorithm highlighting ---------------------------------------------
  const highlight = useMemo(() => {
    const step = algorithm.result?.steps[algorithm.step]
    if (!step) return { active: new Set<string>(), settled: new Set<string>(), edges: new Set<string>(), labels: {} as Record<string, string> }
    return {
      active: new Set(step.active),
      settled: new Set(step.settled),
      edges: new Set(step.edges),
      labels: step.labels ?? {}
    }
  }, [algorithm])

  // --- selection helpers ---------------------------------------------------
  const selectedNodes = selection.type === 'node' ? new Set(selection.ids) : new Set<string>()
  const selectedEdges = selection.type === 'edge' ? new Set(selection.ids) : new Set<string>()
  const selectedAnnotations = selection.type === 'annotation' ? new Set(selection.ids) : new Set<string>()

  // --- pointer handling ----------------------------------------------------
  const onNodePointerDown = (event: React.PointerEvent, node: GraphNode) => {
    event.stopPropagation()

    if (tool === 'erase') {
      select({ type: 'node', ids: [node.id] })
      deleteSelection()
      return
    }

    if (tool === 'edge') {
      if (!pendingEdgeSource) setPendingEdgeSource(node.id)
      else {
        addEdge(pendingEdgeSource, node.id)
        // Chain from the node just connected: drawing a path is the common case,
        // and having to re-click the source every time is needless.
        setPendingEdgeSource(node.id)
      }
      return
    }

    // Shift extends the selection; a plain click on an unselected node replaces it.
    const alreadySelected = selectedNodes.has(node.id)
    const ids = event.shiftKey
      ? alreadySelected
        ? [...selectedNodes].filter((id) => id !== node.id)
        : [...selectedNodes, node.id]
      : alreadySelected
        ? [...selectedNodes]
        : [node.id]
    select(ids.length ? { type: 'node', ids } : { type: 'none' })

    const origins = new Map<string, { x: number; y: number }>()
    for (const id of ids) {
      const found = nodes.get(id)
      if (found) origins.set(id, { x: found.x, y: found.y })
    }
    const world = toWorld(event)
    dragRef.current = { kind: 'node', startX: world.x, startY: world.y, origins, viewOrigin: { x: view.x, y: view.y }, moved: false }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onBackgroundPointerDown = (event: React.PointerEvent) => {
    const world = toWorld(event)

    if (tool === 'node') {
      const x = settings.snapToGrid ? snap(world.x, settings.grid) : world.x
      const y = settings.snapToGrid ? snap(world.y, settings.grid) : world.y
      addNode(x, y)
      return
    }
    if (tool === 'annotation') {
      addAnnotation(world.x, world.y)
      setTool('select')
      return
    }
    if (tool === 'edge') {
      setPendingEdgeSource(null)
      return
    }

    select({ type: 'none' })
    // Middle button and the pan tool pan; the left button on empty space draws
    // a marquee, which is the behaviour every editor has taught people to expect.
    const panning = tool === 'pan' || event.button === 1 || event.altKey
    dragRef.current = {
      kind: panning ? 'pan' : 'marquee',
      startX: panning ? event.clientX : world.x,
      startY: panning ? event.clientY : world.y,
      origins: new Map(),
      viewOrigin: { x: view.x, y: view.y },
      moved: false
    }
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const world = toWorld(event)
    setCursor(world)

    const drag = dragRef.current
    if (!drag) return
    drag.moved = true

    if (drag.kind === 'pan') {
      setView({ ...view, x: drag.viewOrigin.x + (event.clientX - drag.startX), y: drag.viewOrigin.y + (event.clientY - drag.startY) })
      return
    }

    if (drag.kind === 'marquee') {
      setMarquee({
        x: Math.min(drag.startX, world.x),
        y: Math.min(drag.startY, world.y),
        width: Math.abs(world.x - drag.startX),
        height: Math.abs(world.y - drag.startY)
      })
      return
    }

    const deltaX = world.x - drag.startX
    const deltaY = world.y - drag.startY
    const moves = [...drag.origins].map(([id, origin]) => ({
      id,
      x: settings.snapToGrid ? snap(origin.x + deltaX, settings.grid) : origin.x + deltaX,
      y: settings.snapToGrid ? snap(origin.y + deltaY, settings.grid) : origin.y + deltaY
    }))
    // Silent: the checkpoint was taken when the drag started, so one undo puts
    // the nodes back rather than replaying every frame of the drag.
    moveNodes(moves, { silent: true })
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null

    if (drag?.kind === 'marquee' && marquee) {
      const inside = document_.nodes.filter(
        (node) =>
          node.x >= marquee.x &&
          node.x <= marquee.x + marquee.width &&
          node.y >= marquee.y &&
          node.y <= marquee.y + marquee.height
      )
      select(inside.length ? { type: 'node', ids: inside.map((node) => node.id) } : { type: 'none' })
    }
    setMarquee(null)

    // One real history entry for the whole drag, committed at the end.
    if (drag?.kind === 'node' && drag.moved) {
      const moves = [...drag.origins.keys()]
        .map((id) => nodes.get(id))
        .filter((node): node is GraphNode => Boolean(node))
        .map((node) => ({ id: node.id, x: node.x, y: node.y }))
      useEditor.setState((state) => ({
        past: [...state.past, { ...state.document, nodes: state.document.nodes.map((node) => {
          const origin = drag.origins.get(node.id)
          return origin ? { ...node, ...origin } : node
        }) }].slice(-120),
        future: []
      }))
      moveNodes(moves, { silent: true })
    }
  }

  /** Ctrl/⌘ + wheel zooms about the pointer; a plain wheel scrolls the canvas. */
  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) {
      setView({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY })
      return
    }
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const zoom = Math.max(0.2, Math.min(4, view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
    // Keep the point under the cursor fixed while the scale changes.
    setView({
      zoom,
      x: pointerX - ((pointerX - view.x) / view.zoom) * zoom,
      y: pointerY - ((pointerY - view.y) / view.zoom) * zoom
    })
  }

  // Wheel has to be bound natively: React's onWheel is passive, so it cannot
  // preventDefault, and Ctrl+wheel would zoom the whole page instead.
  useEffect(() => {
    const element = svgRef.current
    if (!element) return
    const handler = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault()
    }
    element.addEventListener('wheel', handler, { passive: false })
    return () => element.removeEventListener('wheel', handler)
  }, [])

  // --- rendering -----------------------------------------------------------
  const defaults = document_.defaults

  const renderEdge = (edge: (typeof document_.edges)[number]) => {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    if (!source || !target) return null

    const geometry = edgeGeometry(edge, source, target, defaults, parallelIndex(document_, edge))
    const selected = selectedEdges.has(edge.id)
    const inAlgorithm = highlight.edges.has(edge.id)
    const colour = inAlgorithm ? 'var(--algo-edge)' : edge.color ?? defaults.edgeColor
    const style = edge.style ?? defaults.edgeStyle

    const dash =
      style === 'dashed' ? '10 7' : style === 'dotted' ? '2 7' : undefined

    const label = settings.showLabels
      ? edge.label ?? (settings.showWeights && edge.weight !== undefined ? String(edge.weight) : undefined)
      : undefined

    return (
      <g key={edge.id} className={`edge${selected ? ' is-selected' : ''}${inAlgorithm ? ' is-active' : ''}`}>
        {/* A wide invisible copy: a 2px line is almost impossible to click. */}
        <path
          d={geometry.path}
          className="edge-hit"
          data-export="skip"
          onPointerDown={(event) => {
            event.stopPropagation()
            if (tool === 'erase') {
              select({ type: 'edge', ids: [edge.id] })
              deleteSelection()
            } else {
              select({ type: 'edge', ids: [edge.id] })
            }
          }}
        />
        <path
          d={geometry.path}
          fill="none"
          stroke={colour}
          strokeWidth={inAlgorithm ? 3.5 : selected ? 3 : 1.8}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
        {style === 'double' && (
          <path d={geometry.path} fill="none" stroke={colour} strokeWidth={0.8} transform="translate(0,4)" />
        )}

        {document_.directed && (edge.arrowHead ?? 'arrow') !== 'none' && (
          <ArrowHead point={geometry.endPoint} angle={geometry.endAngle} colour={colour} kind={edge.arrowHead ?? 'arrow'} />
        )}
        {(edge.arrowTail ?? 'none') !== 'none' && (
          <ArrowHead point={geometry.startPoint} angle={geometry.startAngle} colour={colour} kind={edge.arrowTail ?? 'none'} />
        )}

        {label && (
          <g transform={`translate(${geometry.labelPoint.x} ${geometry.labelPoint.y})`}>
            {/* An opaque plate so the label stays readable where it crosses the line. */}
            <rect x={-label.length * 3.6 - 5} y={-9} width={label.length * 7.2 + 10} height={18} rx={5} className="edge-label-plate" />
            <text className="edge-label" textAnchor="middle" dominantBaseline="central">{label}</text>
          </g>
        )}
      </g>
    )
  }

  const renderNode = (node: GraphNode) => {
    const size = nodeSize(node, defaults)
    const selected = selectedNodes.has(node.id)
    const active = highlight.active.has(node.id)
    const settled = highlight.settled.has(node.id)
    const badgeLabel = highlight.labels[node.id]

    return (
      <g
        key={node.id}
        className={`node${selected ? ' is-selected' : ''}${active ? ' is-active' : ''}${settled ? ' is-settled' : ''}${pendingEdgeSource === node.id ? ' is-edge-source' : ''}`}
        onPointerDown={(event) => onNodePointerDown(event, node)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          select({ type: 'node', ids: [node.id] })
        }}
      >
        <path
          d={nodePath(node, defaults)}
          fill={node.fill ?? defaults.nodeFill}
          stroke={active ? 'var(--algo-active)' : settled ? 'var(--algo-settled)' : node.stroke ?? defaults.nodeStroke}
          strokeWidth={selected ? 3.5 : active || settled ? 3 : 2}
        />
        {/* An accepting state in an automaton: the inner ring is the convention. */}
        {(node.shape ?? defaults.nodeShape) === 'doubleCircle' && (
          <path
            d={nodePath({ ...node, width: size.width - 10, height: size.height - 10 }, defaults)}
            fill="none"
            stroke={node.stroke ?? defaults.nodeStroke}
            strokeWidth={1.5}
          />
        )}

        {settings.showLabels && node.label && (
          <text className="node-label" x={node.x} y={node.y} fill={node.textColor ?? defaults.nodeTextColor} textAnchor="middle" dominantBaseline="central">
            {node.label}
          </text>
        )}
        {node.badge && (
          <text className="node-badge" x={node.x + size.width / 2 - 2} y={node.y - size.height / 2 + 2} textAnchor="middle">
            {node.badge}
          </text>
        )}
        {badgeLabel !== undefined && (
          <g transform={`translate(${node.x + size.width / 2 + 4} ${node.y - size.height / 2 - 4})`}>
            <circle r={11} className="algo-badge-bg" />
            <text className="algo-badge" textAnchor="middle" dominantBaseline="central">{badgeLabel}</text>
          </g>
        )}
        {node.note && settings.showLabels && (
          <text className="node-note" x={node.x} y={node.y + size.height / 2 + 13} textAnchor="middle">
            {node.note.length > 28 ? node.note.slice(0, 27) + '…' : node.note}
          </text>
        )}
      </g>
    )
  }

  // The rubber-band line shown while an edge is being drawn.
  const pendingSource = pendingEdgeSource ? nodes.get(pendingEdgeSource) : null
  const pendingLine =
    pendingSource && cursor ? boundaryPoint(pendingSource, cursor, defaults) : null

  return (
    <div className="canvas-host">
      <svg
        ref={svgRef}
        className={`canvas tool-${tool}`}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid-dots" width={settings.grid} height={settings.grid} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} className="grid-dot" />
          </pattern>
        </defs>

        {settings.showGrid && (
          <rect
            data-export="skip"
            x={0}
            y={0}
            width="100%"
            height="100%"
            fill="url(#grid-dots)"
            // The pattern is painted in screen space, so it has to be offset by
            // the pan and scaled by the zoom to stay glued to the document.
            transform={`translate(${view.x % (settings.grid * view.zoom)} ${view.y % (settings.grid * view.zoom)}) scale(${view.zoom})`}
          />
        )}

        <g data-viewport transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          {document_.edges.map(renderEdge)}

          {pendingSource && pendingLine && cursor && (
            <line
              data-export="skip"
              className="pending-edge"
              x1={pendingLine.x}
              y1={pendingLine.y}
              x2={cursor.x}
              y2={cursor.y}
            />
          )}

          {document_.nodes.map(renderNode)}

          {document_.annotations.map((annotation) => (
            <g
              key={annotation.id}
              className={`annotation${selectedAnnotations.has(annotation.id) ? ' is-selected' : ''}`}
              onPointerDown={(event) => {
                event.stopPropagation()
                select({ type: 'annotation', ids: [annotation.id] })
              }}
            >
              <text x={annotation.x} y={annotation.y} fill={annotation.color ?? 'var(--annotation)'}>
                {annotation.text}
              </text>
            </g>
          ))}

          {marquee && (
            <rect
              data-export="skip"
              className="marquee"
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
            />
          )}
        </g>
      </svg>

      {!document_.nodes.length && (
        <div className="canvas-empty">
          <p>Canvas đang trống.</p>
          <p className="hint">
            Chọn công cụ <b>Đỉnh</b> rồi bấm vào canvas, hoặc mở một <b>mẫu</b> ở thanh bên trái.
          </p>
        </div>
      )}
    </div>
  )
}

/** Arrowheads, drawn as a rotated marker rather than an SVG `<marker>`.
 *  A marker inherits the path's stroke width, which makes every arrow on a
 *  highlighted edge balloon; an explicit shape keeps them all the same size. */
function ArrowHead({ point, angle, colour, kind }: { point: { x: number; y: number }; angle: number; colour: string; kind: string }) {
  const transform = `translate(${point.x} ${point.y}) rotate(${angle})`
  if (kind === 'dot') return <circle transform={transform} r={ARROW_SIZE / 2} fill={colour} />
  if (kind === 'diamond') {
    return (
      <polygon
        transform={transform}
        points={`0,0 ${-ARROW_SIZE},${-ARROW_SIZE / 2} ${-ARROW_SIZE * 2},0 ${-ARROW_SIZE},${ARROW_SIZE / 2}`}
        fill={colour}
      />
    )
  }
  return (
    <polygon
      transform={transform}
      points={`0,0 ${-ARROW_SIZE * 1.6},${-ARROW_SIZE * 0.66} ${-ARROW_SIZE * 1.6},${ARROW_SIZE * 0.66}`}
      fill={kind === 'hollow' ? 'var(--canvas-bg)' : colour}
      stroke={colour}
      strokeWidth={kind === 'hollow' ? 1.6 : 0}
    />
  )
}

export default Canvas
