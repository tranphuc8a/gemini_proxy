/**
 * Board topologies for the Lights Out family.
 *
 * The classic puzzle is a rectangle of square cells, but almost nothing about
 * the problem depends on that. What a rule needs to know is only: which cells
 * exist, and which cells neighbour a given one. Separating that from the rules
 * is what lets the same "cross" rule run on a rectangle, a torus, a ring or a
 * hexagon without a single branch inside the rule itself.
 *
 * A topology is a plain object:
 *
 *   id            machine name
 *   label         what the picker shows
 *   cells         [{ id, row, col, x, y }]  -- x/y are layout coordinates
 *   has(row,col)  does this cell exist?
 *   index(row,col) position in `cells`, or -1
 *   neighbours(cell, kind) cells reachable by a step of that kind
 *   layout        { kind: 'square' | 'hex', width, height }  for the renderer
 *
 * `x`/`y` are in abstract units (one cell = 1 unit wide); the renderer scales.
 *
 * Exposed as `window.LightGridGeometry` -- these apps are static pages served
 * straight from the collection, with no build step to resolve imports.
 */
(function (global) {
  'use strict'

  /** Offsets shared by every grid whose cells sit on a square lattice. */
  const SQUARE_STEPS = {
    orthogonal: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    diagonal: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    all8: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
    knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
  }

  /**
   * Axial neighbours of a hex in "odd-r" offset coordinates.
   *
   * Offset coordinates make the row/column arithmetic of the rest of the engine
   * work unchanged, at the cost of the neighbour set depending on row parity --
   * which is exactly what these two tables encode.
   */
  const HEX_STEPS = {
    even: [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]],
    odd: [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
  }

  /**
   * Build a topology from a membership test.
   *
   * Every shape below is "a rectangle of candidate positions, minus the ones
   * that are not part of this shape", so they all come through here. `wrap`
   * makes the rectangle a torus: stepping off one edge arrives at the other.
   */
  function fromMask(options) {
    const { id, label, rows, cols, member, wrap = false, layout = 'square', note = '' } = options

    const cells = []
    const indexByKey = new Map()
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!member(row, col)) continue
        indexByKey.set(row + ':' + col, cells.length)
        cells.push({
          id: row + ':' + col,
          row,
          col,
          // Hex rows are offset by half a cell and packed vertically at 3/4 pitch.
          x: layout === 'hex' ? col + (row % 2 ? 0.5 : 0) : col,
          y: layout === 'hex' ? row * 0.8660254 : row
        })
      }
    }

    const normalise = wrap
      ? (row, col) => [((row % rows) + rows) % rows, ((col % cols) + cols) % cols]
      : (row, col) => [row, col]

    const index = (row, col) => {
      const [r, c] = normalise(row, col)
      if (r < 0 || c < 0 || r >= rows || c >= cols) return -1
      const at = indexByKey.get(r + ':' + c)
      return at === undefined ? -1 : at
    }

    function step(cell, offsets) {
      const found = []
      for (const [dr, dc] of offsets) {
        const at = index(cell.row + dr, cell.col + dc)
        if (at !== -1) found.push(cells[at])
      }
      return found
    }

    function neighbours(cell, kind) {
      if (layout === 'hex') {
        // A hex has no diagonals; every adjacency is one of its six sides.
        if (kind === 'diagonal') return []
        if (kind === 'knight') return step(cell, SQUARE_STEPS.knight)
        return step(cell, cell.row % 2 ? HEX_STEPS.odd : HEX_STEPS.even)
      }
      return step(cell, SQUARE_STEPS[kind] || SQUARE_STEPS.orthogonal)
    }

    return {
      id,
      label,
      note,
      rows,
      cols,
      wrap,
      cells,
      size: cells.length,
      has: (row, col) => index(row, col) !== -1,
      index,
      cellAt: (row, col) => {
        const at = index(row, col)
        return at === -1 ? null : cells[at]
      },
      neighbours,
      /** Cells sharing a row (or a ring, on a torus). Used by row/column rules. */
      row: (cell) => cells.filter((other) => other.row === cell.row),
      column: (cell) => cells.filter((other) => other.col === cell.col),
      layout: {
        kind: layout,
        width: layout === 'hex' ? cols + 0.5 : cols,
        height: layout === 'hex' ? (rows - 1) * 0.8660254 + 1 : rows
      }
    }
  }

  /**
   * The shapes the apps offer.
   *
   * Each takes the requested rows/cols and returns a topology. `thickness` and
   * friends come from the app's own controls, defaulted here so a caller that
   * does not care gets something sensible.
   */
  const SHAPES = {
    rectangle: {
      label: 'Hình chữ nhật',
      note: 'Bàn cờ Lights Out cổ điển.',
      build: (rows, cols) => fromMask({
        id: 'rectangle', label: 'Hình chữ nhật', rows, cols, member: () => true
      })
    },

    torus: {
      label: 'Xuyến (torus)',
      note: 'Mép trái nối mép phải, mép trên nối mép dưới — không còn ô "góc" nào đặc biệt.',
      build: (rows, cols) => fromMask({
        id: 'torus', label: 'Xuyến (torus)', rows, cols, member: () => true, wrap: true
      })
    },

    ring: {
      label: 'Vành khuyên (ring)',
      note: 'Chỉ giữ lại viền ngoài dày `thickness` ô; phần ruột bị khoét rỗng.',
      build: (rows, cols, options = {}) => {
        const thickness = Math.max(1, Math.min(options.thickness || 1, Math.floor(Math.min(rows, cols) / 2)))
        return fromMask({
          id: 'ring',
          label: 'Vành khuyên (ring)',
          rows,
          cols,
          member: (row, col) =>
            row < thickness || col < thickness || row >= rows - thickness || col >= cols - thickness
        })
      }
    },

    diamond: {
      label: 'Kim cương',
      note: 'Hình thoi Manhattan: giữ các ô có |dr| + |dc| ≤ bán kính.',
      build: (rows, cols) => {
        const midRow = (rows - 1) / 2
        const midCol = (cols - 1) / 2
        const radius = Math.min(midRow, midCol)
        return fromMask({
          id: 'diamond',
          label: 'Kim cương',
          rows,
          cols,
          member: (row, col) => Math.abs(row - midRow) / (midRow || 1) + Math.abs(col - midCol) / (midCol || 1) <= 1 + 1e-9,
          note: 'radius ' + radius
        })
      }
    },

    triangle: {
      label: 'Tam giác',
      note: 'Bậc thang: hàng r có r + 1 ô. Các ô ở cạnh huyền có ít hàng xóm nhất.',
      build: (rows, cols) => fromMask({
        id: 'triangle',
        label: 'Tam giác',
        rows,
        cols,
        member: (row, col) => col <= row && col < cols
      })
    },

    hexagon: {
      label: 'Lục giác',
      note: 'Lưới hex "odd-r": mỗi ô có 6 hàng xóm, không có đường chéo.',
      build: (rows, cols) => fromMask({
        id: 'hexagon',
        label: 'Lục giác',
        rows,
        cols,
        member: () => true,
        layout: 'hex'
      })
    },

    hexring: {
      label: 'Vòng lục giác',
      note: 'Lưới hex bị khoét ruột — kết hợp bậc tự do của hex với tính đối xứng của vành.',
      build: (rows, cols, options = {}) => {
        const thickness = Math.max(1, Math.min(options.thickness || 1, Math.floor(Math.min(rows, cols) / 2)))
        return fromMask({
          id: 'hexring',
          label: 'Vòng lục giác',
          rows,
          cols,
          member: (row, col) =>
            row < thickness || col < thickness || row >= rows - thickness || col >= cols - thickness,
          layout: 'hex'
        })
      }
    },

    cross: {
      label: 'Chữ thập',
      note: 'Chỉ giữ dải giữa theo cả hai chiều.',
      build: (rows, cols, options = {}) => {
        const arm = Math.max(1, options.thickness || Math.max(1, Math.floor(Math.min(rows, cols) / 3)))
        const midRow = (rows - 1) / 2
        const midCol = (cols - 1) / 2
        return fromMask({
          id: 'cross',
          label: 'Chữ thập',
          rows,
          cols,
          member: (row, col) =>
            Math.abs(row - midRow) <= arm / 2 + 0.5 || Math.abs(col - midCol) <= arm / 2 + 0.5
        })
      }
    },

    circle: {
      label: 'Hình tròn',
      note: 'Đĩa Euclid — biên "răng cưa" tạo ra những bất biến rất khác hình chữ nhật.',
      build: (rows, cols) => {
        const midRow = (rows - 1) / 2
        const midCol = (cols - 1) / 2
        const radius = Math.min(midRow, midCol) + 0.5
        return fromMask({
          id: 'circle',
          label: 'Hình tròn',
          rows,
          cols,
          member: (row, col) => (row - midRow) ** 2 + (col - midCol) ** 2 <= radius * radius
        })
      }
    }
  }

  function build(shapeId, rows, cols, options) {
    const shape = SHAPES[shapeId] || SHAPES.rectangle
    const topology = shape.build(rows, cols, options || {})
    // Every shape can end up empty for a small enough board; a board with no
    // cells would break every caller, so fall back rather than return it.
    return topology.size ? topology : SHAPES.rectangle.build(rows, cols)
  }

  global.LightGridGeometry = { SHAPES, build, fromMask, SQUARE_STEPS, HEX_STEPS }
})(window)
