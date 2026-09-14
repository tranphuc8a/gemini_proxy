/**
 * Toggle rules: which cells change when you press one.
 *
 * A rule is a pure function `(topology, cell, options) -> cells[]`. It never
 * touches the board state, which is what makes the same rule usable three ways:
 * to play a move, to build the move matrix the GF(2) solver works on, and to
 * draw the preview that shows a beginner what a press will do.
 *
 * `window.LightGridRules`.
 */
(function (global) {
  'use strict'

  /** Drop repeats so a cell pressed twice by one rule is not toggled twice. */
  function unique(cells) {
    const seen = new Set()
    const out = []
    for (const cell of cells) {
      if (seen.has(cell.id)) continue
      seen.add(cell.id)
      out.push(cell)
    }
    return out
  }

  function within(topology, cell, options, predicate) {
    const radius = Math.max(1, options.radius || 1)
    const out = []
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (!predicate(dr, dc, radius)) continue
        const found = topology.cellAt(cell.row + dr, cell.col + dc)
        if (found) out.push(found)
      }
    }
    return out
  }

  const RULES = {
    self: {
      label: 'Self',
      note: 'Chỉ ô được bấm. Bài toán tầm thường — hữu ích để vẽ trạng thái ban đầu.',
      apply: (_topology, cell) => [cell]
    },

    cross: {
      label: 'Cross (+)',
      note: 'Luật Lights Out cổ điển: ô bấm và 4 ô kề cạnh.',
      apply: (topology, cell) => unique([cell, ...topology.neighbours(cell, 'orthogonal')])
    },

    neighboursOnly: {
      label: 'Chỉ hàng xóm',
      note: 'Bốn ô kề cạnh nhưng KHÔNG gồm ô bấm — ma trận không còn đường chéo đơn vị.',
      apply: (topology, cell) => topology.neighbours(cell, 'orthogonal')
    },

    x: {
      label: 'X (chéo)',
      note: 'Ô bấm và 4 ô chéo. Trên lưới hex không có đường chéo nên chỉ còn chính ô đó.',
      apply: (topology, cell) => unique([cell, ...topology.neighbours(cell, 'diagonal')])
    },

    neighbours8: {
      label: '8 hàng xóm',
      note: 'Toàn bộ vùng 3×3 quanh ô bấm.',
      apply: (topology, cell) => unique([cell, ...topology.neighbours(cell, 'all8')])
    },

    knight: {
      label: 'Nước mã',
      note: 'Ô bấm và 8 ô cách nó một nước mã. Đồ thị tác động rời rạc hơn hẳn.',
      apply: (topology, cell) => unique([cell, ...topology.neighbours(cell, 'knight')])
    },

    row: {
      label: 'Cả hàng',
      note: 'Toàn bộ hàng chứa ô bấm.',
      apply: (topology, cell) => topology.row(cell)
    },

    column: {
      label: 'Cả cột',
      note: 'Toàn bộ cột chứa ô bấm.',
      apply: (topology, cell) => topology.column(cell)
    },

    rowColumn: {
      label: 'Hàng + cột',
      note: 'Chữ thập kéo dài hết bàn. Ô giao bị lật hai lần nên phải khử trùng lặp.',
      apply: (topology, cell) => unique([...topology.row(cell), ...topology.column(cell)])
    },

    checkerboard: {
      label: 'Bàn cờ',
      note: 'Mọi ô cùng màu bàn cờ với ô bấm. Một nước đi chạm nửa bàn.',
      apply: (topology, cell) => {
        const parity = (cell.row + cell.col) % 2
        return topology.cells.filter((other) => (other.row + other.col) % 2 === parity)
      }
    },

    manhattan: {
      label: 'Bán kính Manhattan',
      note: 'Mọi ô có |dr| + |dc| ≤ R — một hình thoi quanh ô bấm.',
      apply: (topology, cell, options) =>
        within(topology, cell, options, (dr, dc, radius) => Math.abs(dr) + Math.abs(dc) <= radius)
    },

    square: {
      label: 'Bán kính vuông',
      note: 'Khối (2R+1)×(2R+1) quanh ô bấm.',
      apply: (topology, cell, options) => within(topology, cell, options, () => true)
    },

    ring: {
      label: 'Vòng bán kính R',
      note: 'Chỉ viền của khối bán kính R — ô bấm và phần ruột không đổi.',
      apply: (topology, cell, options) =>
        within(topology, cell, options, (dr, dc, radius) => Math.max(Math.abs(dr), Math.abs(dc)) === radius)
    },

    diagonalLine: {
      label: 'Hai đường chéo',
      note: 'Cả hai đường chéo đi qua ô bấm, kéo dài hết bàn.',
      apply: (topology, cell) =>
        topology.cells.filter(
          (other) =>
            other.row - other.col === cell.row - cell.col || other.row + other.col === cell.row + cell.col
        )
    }
  }

  /**
   * Cells a press on `cell` toggles.
   *
   * Unknown rule ids fall back to the classic cross rather than throwing: a
   * board shared through a URL may name a rule a later version renamed, and
   * playing the classic game beats a blank screen.
   */
  function apply(ruleId, topology, cell, options) {
    const rule = RULES[ruleId] || RULES.cross
    return unique(rule.apply(topology, cell, options || {}))
  }

  /**
   * The move matrix A over GF(2): column j is the effect of pressing cell j.
   *
   * Stored as an array of row bitsets (`Uint8Array`, one byte per cell) because
   * every consumer wants rows: Gaussian elimination reduces rows, and A·x reads
   * rows. The matrix is symmetric for the classic rules but not for all of them
   * (`knight` on a triangle, for instance), so nothing here assumes it is.
   */
  function moveMatrix(ruleId, topology, options) {
    const n = topology.size
    const matrix = Array.from({ length: n }, () => new Uint8Array(n))
    topology.cells.forEach((cell, column) => {
      for (const affected of apply(ruleId, topology, cell, options)) {
        const row = topology.index(affected.row, affected.col)
        if (row !== -1) matrix[row][column] ^= 1
      }
    })
    return matrix
  }

  global.LightGridRules = { RULES, apply, moveMatrix, unique }
})(window)
