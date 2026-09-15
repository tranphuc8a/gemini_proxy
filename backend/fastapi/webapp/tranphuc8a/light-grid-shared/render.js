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
   * `lit` holds the on-states, so a 2-state board uses `lit[0]` and a mod-6
   * board the whole row. Each palette keeps its lit colours distinguishable in
   * brightness as well as hue, so they are still tellable apart without colour
   * vision.
   *
   * "Off" is a *pair*, not one colour. A single dark off-colour looked right on
   * the dark theme and turned the light theme unreadable: dark tiles on a light
   * page, with the cell numbers drawn in the light theme's dark ink and so
   * invisible against them. The renderer picks `off` or `offLight` from the
   * theme actually in force.
   */
  const PALETTES = {
    emerald: { label: 'Ngọc lục bảo', off: '#1f2937', offLight: '#e2e8f0', lit: ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc'] },
    amber: { label: 'Hổ phách', off: '#292524', offLight: '#e7e5e4', lit: ['#f59e0b', '#ea580c', '#dc2626', '#65a30d', '#0284c7'] },
    ocean: { label: 'Đại dương', off: '#0f172a', offLight: '#dbeafe', lit: ['#0ea5e9', '#06b6d4', '#8b5cf6', '#ec4899', '#eab308'] },
    mono: { label: 'Đơn sắc', off: '#18181b', offLight: '#f4f4f5', lit: ['#71717a', '#a1a1aa', '#52525b', '#3f3f46', '#27272a'] },
    neon: { label: 'Neon', off: '#0b0b16', offLight: '#1c1c2b', lit: ['#ff2e97', '#00e5ff', '#c6ff00', '#ff9100', '#7c4dff'] },
    paper: { label: 'Giấy', off: '#e7e5e4', offLight: '#e7e5e4', lit: ['#1c1917', '#b91c1c', '#1d4ed8', '#15803d', '#a16207'] }
  }

  /** How a cell is drawn. Shape is independent of the board's topology. */
  const TILE_SHAPES = {
    rounded: 'Bo góc',
    square: 'Vuông',
    circle: 'Tròn',
    hex: 'Lục giác',
    diamond: 'Thoi'
  }

  /**
   * Black or white, whichever is readable on `hex`.
   *
   * The label cannot take its colour from the theme: the "Giấy" palette is a
   * light board *on the dark theme*, so theme-coloured text disappears on it.
   * Deriving the ink from the tile underneath is right for every combination of
   * palette and theme, including ones nobody has tried yet.
   *
   * Uses the WCAG relative-luminance coefficients rather than a plain average:
   * the eye is far more sensitive to green than to blue, and an average call
   * flips to the wrong ink on saturated colours.
   */
  function contrastInk(hex) {
    const value = String(hex).replace('#', '')
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
    const channel = (at) => {
      const srgb = parseInt(full.slice(at, at + 2), 16) / 255
      return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
    }
    if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) return '#000000'
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
    return luminance > 0.42 ? '#0b1020' : '#f8fafc'
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

    /**
     * Colours for this draw, index 0 being "off".
     *
     * The off-colour follows the document's theme so the board stays legible in
     * both; the lit colours do not, because they are the user's choice and a
     * theme has no business overruling it.
     */
    palette() {
      const palette = PALETTES[this.options.palette] || PALETTES.emerald
      const light = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
      return [light ? palette.offLight : palette.off, ...palette.lit]
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
            fill: contrastInk(colors[value % colors.length]),
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
