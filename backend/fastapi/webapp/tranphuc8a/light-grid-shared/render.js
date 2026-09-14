/**
 * SVG renderer for a board.
 *
 * SVG rather than a CSS grid of <div>s, which is what these apps used before:
 * a hex board is not a grid, a ring has holes, and every shape needs to scale
 * to the space available. One coordinate system that the geometry module
 * already speaks solves all three at once.
 *
 * The renderer owns no state. It is handed a board and a set of decorations
 * (hover preview, highlighted solution, quiet pattern) and draws them; what is
 * highlighted is the app's business.
 *
 * `window.LightGridRender`.
 */
(function (global) {
  'use strict'

  const SVG_NS = 'http://www.w3.org/2000/svg'

  /**
   * Cell colours by state.
   *
   * Index 0 is "off" and the rest are the lit states, so a 2-state board uses
   * the first two entries and a mod-6 board the whole row. Each palette keeps
   * its lit colours distinguishable in brightness as well as hue, so they are
   * still tellable apart without colour vision.
   */
  const PALETTES = {
    emerald: { label: 'Ngọc lục bảo', colors: ['#1f2937', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc'] },
    amber: { label: 'Hổ phách', colors: ['#292524', '#fbbf24', '#fb923c', '#f87171', '#a3e635', '#38bdf8'] },
    ocean: { label: 'Đại dương', colors: ['#0f172a', '#38bdf8', '#22d3ee', '#a78bfa', '#f472b6', '#facc15'] },
    mono: { label: 'Đơn sắc', colors: ['#18181b', '#e4e4e7', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'] },
    neon: { label: 'Neon', colors: ['#0b0b16', '#ff2e97', '#00e5ff', '#c6ff00', '#ff9100', '#7c4dff'] },
    paper: { label: 'Giấy', colors: ['#e7e5e4', '#1c1917', '#b91c1c', '#1d4ed8', '#15803d', '#a16207'] }
  }

  /** How a cell is drawn. Shape is independent of the board's topology. */
  const TILE_SHAPES = {
    rounded: 'Bo góc',
    square: 'Vuông',
    circle: 'Tròn',
    hex: 'Lục giác',
    diamond: 'Thoi'
  }

  function element(name, attributes) {
    const node = document.createElementNS(SVG_NS, name)
    for (const [key, value] of Object.entries(attributes || {})) {
      node.setAttribute(key, String(value))
    }
    return node
  }

  /** Corner points of a flat-topped-ish hexagon inscribed in the unit cell. */
  function hexPoints(cx, cy, radius) {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30)
      points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
    }
    return points.join(' ')
  }

  function tile(cell, size, gap, shape) {
    const cx = cell.x * size + size / 2
    const cy = cell.y * size + size / 2
    const span = size - gap

    if (shape === 'circle') return element('circle', { cx, cy, r: span / 2 })
    if (shape === 'hex') return element('polygon', { points: hexPoints(cx, cy, span / 2) })
    if (shape === 'diamond') {
      const half = span / 2
      return element('polygon', { points: `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}` })
    }
    return element('rect', {
      x: cx - span / 2,
      y: cy - span / 2,
      width: span,
      height: span,
      rx: shape === 'square' ? 0 : span * 0.22
    })
  }

  class Renderer {
    /**
     * @param {HTMLElement} host    where the <svg> is mounted
     * @param {object}      options palette, tileShape, gap, labels, glow, onPress, onHover
     */
    constructor(host, options = {}) {
      this.host = host
      this.options = Object.assign(
        { palette: 'emerald', tileShape: 'rounded', gap: 0.12, labels: false, glow: true },
        options
      )
      this.svg = element('svg', { class: 'lg-canvas', xmlns: SVG_NS })
      this.host.textContent = ''
      this.host.appendChild(this.svg)
      this.nodes = []
    }

    setOptions(patch) {
      Object.assign(this.options, patch)
      return this
    }

    palette() {
      return (PALETTES[this.options.palette] || PALETTES.emerald).colors
    }

    /**
     * Draw `board`.
     *
     * `decorations` maps a cell index to a class name: 'preview' for the hover
     * outline, 'solution' for a press the solver recommends, 'quiet' for a cell
     * in the quiet pattern being shown. Anything the CSS names works.
     */
    draw(board, decorations = {}) {
      const topology = board.topology
      const size = 100
      const gap = this.options.gap * size
      const width = topology.layout.width * size
      const height = topology.layout.height * size

      this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      this.svg.textContent = ''
      this.nodes = []

      const colors = this.palette()
      const shape = topology.layout.kind === 'hex' ? 'hex' : this.options.tileShape

      topology.cells.forEach((cell, index) => {
        const group = element('g', { class: 'lg-cell', 'data-index': index })
        const node = tile(cell, size, gap, shape)
        const value = board.cells[index]
        node.setAttribute('fill', colors[value % colors.length])
        node.setAttribute('class', 'lg-tile' + (value ? ' is-lit' : ''))
        if (value && this.options.glow) node.setAttribute('filter', 'url(#lg-glow)')

        const mark = decorations[index]
        if (mark) group.setAttribute('class', `lg-cell is-${mark}`)

        group.appendChild(node)

        if (this.options.labels) {
          const label = element('text', {
            x: cell.x * size + size / 2,
            y: cell.y * size + size / 2,
            class: 'lg-label',
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          })
          label.textContent = this.options.labelText ? this.options.labelText(cell, index) : String(index)
          group.appendChild(label)
        }

        group.addEventListener('click', () => this.options.onPress && this.options.onPress(cell, index))
        group.addEventListener('pointerenter', () => this.options.onHover && this.options.onHover(cell, index))
        group.addEventListener('pointerleave', () => this.options.onHover && this.options.onHover(null, -1))

        this.svg.appendChild(group)
        this.nodes.push(group)
      })

      if (this.options.glow) this.svg.appendChild(this.glowFilter())
      return this
    }

    glowFilter() {
      const defs = element('defs', {})
      const filter = element('filter', { id: 'lg-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' })
      filter.appendChild(element('feGaussianBlur', { stdDeviation: 6, result: 'blur' }))
      const merge = element('feMerge', {})
      merge.appendChild(element('feMergeNode', { in: 'blur' }))
      merge.appendChild(element('feMergeNode', { in: 'SourceGraphic' }))
      filter.appendChild(merge)
      defs.appendChild(filter)
      return defs
    }

    /** The current drawing as a standalone SVG document, for export. */
    toSvgText() {
      const clone = this.svg.cloneNode(true)
      clone.setAttribute('xmlns', SVG_NS)
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
    }

    /**
     * Rasterise to a PNG blob.
     *
     * The SVG goes through a data: URL rather than a blob: URL because a canvas
     * that has drawn from a blob: URL is tainted in some browsers, and a
     * tainted canvas cannot be exported at all.
     */
    toPngBlob(scale = 2) {
      return new Promise((resolve, reject) => {
        const viewBox = this.svg.getAttribute('viewBox').split(' ').map(Number)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewBox[2] * scale / 100))
        canvas.height = Math.max(1, Math.round(viewBox[3] * scale / 100))

        const image = new Image()
        image.onload = () => {
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được PNG'))), 'image/png')
        }
        image.onerror = () => reject(new Error('Không dựng được ảnh từ SVG'))
        image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(this.toSvgText())))
      })
    }
  }

  global.LightGridRender = { Renderer, PALETTES, TILE_SHAPES }
})(window)
