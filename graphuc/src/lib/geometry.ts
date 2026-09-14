/**
 * The maths the canvas draws with: node outlines, edge paths, hit testing.
 *
 * Kept away from React so it can be unit-tested without rendering anything, and
 * so the exporters can reuse the exact same path strings the screen shows.
 */

import type { GraphDefaults, GraphEdge, GraphNode, NodeShape } from '../types'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export function nodeSize(node: GraphNode, defaults: GraphDefaults): Size {
  return {
    width: node.width ?? defaults.nodeWidth,
    height: node.height ?? defaults.nodeHeight
  }
}

/**
 * The node outline as an SVG path.
 *
 * A path for every shape rather than a mix of `<circle>`, `<rect>` and
 * `<polygon>`: one element type means one place to apply fill, stroke and the
 * selection outline, and the exporters do not need a case per shape.
 */
export function nodePath(node: GraphNode, defaults: GraphDefaults): string {
  const { width, height } = nodeSize(node, defaults)
  const shape: NodeShape = node.shape ?? defaults.nodeShape
  const halfWidth = width / 2
  const halfHeight = height / 2
  const { x, y } = node

  switch (shape) {
    case 'rect':
      return rectPath(x - halfWidth, y - halfHeight, width, height, 0)
    case 'rounded':
      return rectPath(x - halfWidth, y - halfHeight, width, height, 10)
    case 'stadium':
      return rectPath(x - halfWidth, y - halfHeight, width, height, halfHeight)
    case 'diamond':
      return `M ${x} ${y - halfHeight} L ${x + halfWidth} ${y} L ${x} ${y + halfHeight} L ${x - halfWidth} ${y} Z`
    case 'parallelogram': {
      const slant = Math.min(18, halfWidth / 2)
      return `M ${x - halfWidth + slant} ${y - halfHeight} L ${x + halfWidth} ${y - halfHeight} ` +
             `L ${x + halfWidth - slant} ${y + halfHeight} L ${x - halfWidth} ${y + halfHeight} Z`
    }
    case 'hexagon': {
      const inset = Math.min(16, halfWidth / 2)
      return `M ${x - halfWidth + inset} ${y - halfHeight} L ${x + halfWidth - inset} ${y - halfHeight} ` +
             `L ${x + halfWidth} ${y} L ${x + halfWidth - inset} ${y + halfHeight} ` +
             `L ${x - halfWidth + inset} ${y + halfHeight} L ${x - halfWidth} ${y} Z`
    }
    case 'cylinder': {
      // A database symbol: body plus an elliptical lid.
      const lid = Math.min(12, halfHeight / 2)
      return `M ${x - halfWidth} ${y - halfHeight + lid} ` +
             `A ${halfWidth} ${lid} 0 0 1 ${x + halfWidth} ${y - halfHeight + lid} ` +
             `L ${x + halfWidth} ${y + halfHeight - lid} ` +
             `A ${halfWidth} ${lid} 0 0 1 ${x - halfWidth} ${y + halfHeight - lid} Z`
    }
    case 'doubleCircle':
    case 'circle':
    default:
      return ellipsePath(x, y, halfWidth, halfHeight)
  }
}

function rectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2)
  if (r <= 0) return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
  return (
    `M ${x + r} ${y} H ${x + width - r} A ${r} ${r} 0 0 1 ${x + width} ${y + r} ` +
    `V ${y + height - r} A ${r} ${r} 0 0 1 ${x + width - r} ${y + height} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + height - r} ` +
    `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  )
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
}

/**
 * Where a line from `from` towards `to` leaves the `from` node.
 *
 * Solved on the bounding ellipse (or rectangle) rather than by walking the real
 * outline: it is one closed-form expression, and the error on a diamond or a
 * hexagon is a couple of pixels — invisible once the arrowhead is drawn.
 */
export function boundaryPoint(node: GraphNode, towards: Point, defaults: GraphDefaults): Point {
  const { width, height } = nodeSize(node, defaults)
  const shape: NodeShape = node.shape ?? defaults.nodeShape
  const dx = towards.x - node.x
  const dy = towards.y - node.y
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y }

  const halfWidth = width / 2
  const halfHeight = height / 2

  if (shape === 'circle' || shape === 'doubleCircle' || shape === 'stadium') {
    const scale = 1 / Math.hypot(dx / halfWidth, dy / halfHeight)
    return { x: node.x + dx * scale, y: node.y + dy * scale }
  }

  // Rectangular shapes: the exit is on whichever side the ray reaches first.
  const scale = Math.min(halfWidth / Math.abs(dx || 1e-6), halfHeight / Math.abs(dy || 1e-6))
  return { x: node.x + dx * scale, y: node.y + dy * scale }
}

export interface EdgeGeometry {
  path: string
  /** Where a label sits, and where the arrowhead points. */
  labelPoint: Point
  endPoint: Point
  startPoint: Point
  /** Direction at the target end, in degrees, for rotating the arrowhead. */
  endAngle: number
  startAngle: number
}

/**
 * The path for one edge, including self-loops and parallel-edge separation.
 *
 * `index`/`total` come from `parallelIndex`: with three edges between the same
 * pair, one is drawn straight and the others bow to either side. Drawn without
 * that they overlap exactly and a multigraph looks like a simple graph.
 */
export function edgeGeometry(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  defaults: GraphDefaults,
  parallel: { index: number; total: number } = { index: 0, total: 1 }
): EdgeGeometry {
  if (source.id === target.id) return selfLoop(source, defaults, parallel.index)

  const shape = edge.shape ?? defaults.edgeShape
  const start = boundaryPoint(source, target, defaults)
  const end = boundaryPoint(target, source, defaults)

  // Spread siblings symmetrically about the straight line: 0, +1, -1, +2, …
  const spread = parallel.total > 1 ? (parallel.index - (parallel.total - 1) / 2) * 34 : 0
  const bow = edge.curvature ?? (shape === 'curved' ? 40 : 0)
  const offset = spread + (spread === 0 ? bow : 0)

  if (shape === 'orthogonal') {
    const midX = (start.x + end.x) / 2
    const path = `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`
    return {
      path,
      startPoint: start,
      endPoint: end,
      labelPoint: { x: midX, y: (start.y + end.y) / 2 },
      // The last leg is horizontal, so the arrow points along x.
      endAngle: end.x >= midX ? 0 : 180,
      startAngle: start.x <= midX ? 0 : 180
    }
  }

  if (offset === 0) {
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
    return {
      path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      startPoint: start,
      endPoint: end,
      labelPoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      endAngle: angle,
      startAngle: angle + 180
    }
  }

  // Quadratic curve: the control point sits `offset` away from the midpoint,
  // perpendicular to the straight line.
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
  const normalX = -(end.y - start.y) / length
  const normalY = (end.x - start.x) / length
  const controlX = midX + normalX * offset
  const controlY = midY + normalY * offset

  // A quadratic Bézier passes through its control point's "pull" at t = 0.5,
  // which is where a label reads best.
  const labelPoint = { x: 0.25 * start.x + 0.5 * controlX + 0.25 * end.x, y: 0.25 * start.y + 0.5 * controlY + 0.25 * end.y }

  return {
    path: `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`,
    startPoint: start,
    endPoint: end,
    labelPoint,
    // Tangent at t = 1 points from the control point to the end.
    endAngle: (Math.atan2(end.y - controlY, end.x - controlX) * 180) / Math.PI,
    startAngle: (Math.atan2(start.y - controlY, start.x - controlX) * 180) / Math.PI
  }
}

/** A loop drawn above the node; siblings are stacked at increasing radius. */
function selfLoop(node: GraphNode, defaults: GraphDefaults, index: number): EdgeGeometry {
  const { width, height } = nodeSize(node, defaults)
  const radius = 26 + index * 14
  const left = { x: node.x - width * 0.28, y: node.y - height / 2 }
  const right = { x: node.x + width * 0.28, y: node.y - height / 2 }
  const top = node.y - height / 2 - radius * 1.8

  return {
    path: `M ${left.x} ${left.y} C ${left.x - radius} ${top} ${right.x + radius} ${top} ${right.x} ${right.y}`,
    startPoint: left,
    endPoint: right,
    labelPoint: { x: node.x, y: top + radius * 0.5 },
    endAngle: 115,
    startAngle: 245
  }
}

/** Is this point inside the node's box? Used for click hit-testing. */
export function hitsNode(node: GraphNode, point: Point, defaults: GraphDefaults): boolean {
  const { width, height } = nodeSize(node, defaults)
  return (
    point.x >= node.x - width / 2 &&
    point.x <= node.x + width / 2 &&
    point.y >= node.y - height / 2 &&
    point.y <= node.y + height / 2
  )
}

/** Distance from a point to the segment AB, for edge hit-testing. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  // Clamped projection: the nearest point on the *segment*, not the infinite line.
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

/** Bounding box of everything drawn, with padding. Used to fit and to export. */
export function contentBounds(
  nodes: GraphNode[],
  annotations: { x: number; y: number }[],
  defaults: GraphDefaults,
  padding = 60
): { x: number; y: number; width: number; height: number } {
  if (!nodes.length && !annotations.length) return { x: 0, y: 0, width: 800, height: 600 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const { width, height } = nodeSize(node, defaults)
    minX = Math.min(minX, node.x - width / 2)
    maxX = Math.max(maxX, node.x + width / 2)
    minY = Math.min(minY, node.y - height / 2)
    maxY = Math.max(maxY, node.y + height / 2)
  }
  for (const annotation of annotations) {
    minX = Math.min(minX, annotation.x)
    maxX = Math.max(maxX, annotation.x + 180)
    minY = Math.min(minY, annotation.y - 20)
    maxY = Math.max(maxY, annotation.y + 20)
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  }
}

/** Snap a coordinate to the grid, or leave it alone when the grid is off. */
export function snap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value
}
