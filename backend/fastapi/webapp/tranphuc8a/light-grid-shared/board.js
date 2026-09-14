/**
 * The playable board: state, moves, history, and serialisation.
 *
 * State is one `Uint8Array` of values in `0 .. states-1`, indexed the same way
 * as `topology.cells`. Two states is the classic on/off game; three or more
 * turns it into "mod-k Lights Out", where a press advances each affected cell
 * by one instead of flipping it — the same linear algebra, over GF(k) rather
 * than GF(2). The solver only handles k = 2, and says so.
 *
 * Undo and redo are full snapshots rather than move deltas. A snapshot of a
 * few hundred bytes is nothing next to the clarity, and some rules (random
 * fill, import, generate) are not single moves that could be inverted anyway.
 *
 * `window.LightGridBoard`.
 */
(function (global) {
  'use strict'

  const { build: buildTopology } = global.LightGridGeometry
  const Rules = global.LightGridRules

  const HISTORY_LIMIT = 500

  class Board {
    constructor(config = {}) {
      this.configure(config)
    }

    /** Rebuild from scratch. Any existing state is discarded. */
    configure(config) {
      this.shape = config.shape || 'rectangle'
      this.rows = Math.max(1, Math.min(config.rows || 5, 40))
      this.cols = Math.max(1, Math.min(config.cols || 5, 40))
      this.rule = config.rule || 'cross'
      this.radius = Math.max(1, Math.min(config.radius || 1, 8))
      this.thickness = Math.max(1, Math.min(config.thickness || 1, 10))
      this.states = Math.max(2, Math.min(config.states || 2, 6))

      this.topology = buildTopology(this.shape, this.rows, this.cols, { thickness: this.thickness })
      this.cells = new Uint8Array(this.topology.size)
      this.moves = 0
      this.past = []
      this.future = []
      this._matrix = null
      return this
    }

    get size() { return this.topology.size }

    /** Move matrix for the current rule, cached: building it is O(n²). */
    matrix() {
      if (!this._matrix) {
        this._matrix = Rules.moveMatrix(this.rule, this.topology, { radius: this.radius })
      }
      return this._matrix
    }

    setRule(rule, radius) {
      this.rule = rule
      if (radius !== undefined) this.radius = Math.max(1, Math.min(radius, 8))
      this._matrix = null
      return this
    }

    /** Cells a press here would change — the renderer's hover preview. */
    preview(cell) {
      return Rules.apply(this.rule, this.topology, cell, { radius: this.radius })
    }

    snapshot() {
      return { cells: Uint8Array.from(this.cells), moves: this.moves }
    }

    restore(snapshot) {
      this.cells = Uint8Array.from(snapshot.cells)
      this.moves = snapshot.moves
      return this
    }

    /** Record the current state so the next change can be undone. */
    checkpoint() {
      this.past.push(this.snapshot())
      if (this.past.length > HISTORY_LIMIT) this.past.shift()
      // A new action makes the redo stack unreachable, as in any editor.
      this.future.length = 0
      return this
    }

    undo() {
      const previous = this.past.pop()
      if (!previous) return false
      this.future.push(this.snapshot())
      this.restore(previous)
      return true
    }

    redo() {
      const next = this.future.pop()
      if (!next) return false
      this.past.push(this.snapshot())
      this.restore(next)
      return true
    }

    /** Press a cell: advance every affected cell by one, mod `states`. */
    press(cell, options = {}) {
      if (!options.silent) this.checkpoint()
      for (const affected of this.preview(cell)) {
        const at = this.topology.index(affected.row, affected.col)
        if (at !== -1) this.cells[at] = (this.cells[at] + 1) % this.states
      }
      if (!options.silent) this.moves++
      return this
    }

    /** Press by index, for replaying a solution vector. */
    pressIndex(index, options) {
      const cell = this.topology.cells[index]
      if (cell) this.press(cell, options)
      return this
    }

    clear() {
      this.checkpoint()
      this.cells.fill(0)
      this.moves = 0
      return this
    }

    fillRandom(density = 0.5) {
      this.checkpoint()
      for (let i = 0; i < this.cells.length; i++) {
        this.cells[i] = Math.random() < density ? 1 + Math.floor(Math.random() * (this.states - 1)) : 0
      }
      this.moves = 0
      return this
    }

    /**
     * Scramble from solved by making `count` random presses.
     *
     * This is how a puzzle should be generated: a board reached by pressing is
     * reachable by pressing, so it is solvable by construction. Filling cells
     * at random instead gives an unsolvable board most of the time — on the
     * classic 5×5, three boards in four cannot be cleared.
     */
    scramble(count) {
      this.checkpoint()
      this.cells.fill(0)
      const presses = count || Math.max(3, Math.round(this.size / 3))
      for (let i = 0; i < presses; i++) {
        this.pressIndex(Math.floor(Math.random() * this.size), { silent: true })
      }
      this.moves = 0
      // A scramble that happens to land on solved is not a puzzle.
      if (this.isSolved()) this.pressIndex(Math.floor(Math.random() * this.size), { silent: true })
      return this
    }

    isSolved() {
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i]) return false
      }
      return true
    }

    litCount() {
      let total = 0
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i]) total++
      }
      return total
    }

    /** The right-hand side of A·x = b: what has to be turned off. */
    rhs() {
      return Uint8Array.from(this.cells, (value) => value % 2)
    }

    // --- serialisation ---------------------------------------------------
    toJSON() {
      return {
        version: 2,
        shape: this.shape,
        rows: this.rows,
        cols: this.cols,
        rule: this.rule,
        radius: this.radius,
        thickness: this.thickness,
        states: this.states,
        moves: this.moves,
        cells: Array.from(this.cells)
      }
    }

    /**
     * Rebuild from a saved document, tolerating anything.
     *
     * Boards arrive from a URL fragment, a pasted file and localStorage written
     * by an older version, so every field is checked and a wrong one falls back
     * rather than throwing: a corrupt share link should open an empty board,
     * not a broken page.
     */
    static fromJSON(data) {
      if (!data || typeof data !== 'object') return new Board()
      const board = new Board({
        shape: typeof data.shape === 'string' ? data.shape : 'rectangle',
        rows: Number(data.rows) || 5,
        cols: Number(data.cols) || 5,
        rule: typeof data.rule === 'string' ? data.rule : 'cross',
        radius: Number(data.radius) || 1,
        thickness: Number(data.thickness) || 1,
        states: Number(data.states) || 2
      })
      if (Array.isArray(data.cells)) {
        const length = Math.min(data.cells.length, board.cells.length)
        for (let i = 0; i < length; i++) {
          board.cells[i] = Math.max(0, Math.min(Number(data.cells[i]) | 0, board.states - 1))
        }
      }
      board.moves = Number(data.moves) || 0
      return board
    }

    /** Share-link payload: JSON, then URL-safe base64. */
    encode() {
      const json = JSON.stringify(this.toJSON())
      // encodeURIComponent first so non-ASCII survives btoa's latin-1 range.
      return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    static decode(text) {
      try {
        const padded = text.replace(/-/g, '+').replace(/_/g, '/')
        return Board.fromJSON(JSON.parse(decodeURIComponent(escape(atob(padded)))))
      } catch (error) {
        return null
      }
    }
  }

  global.LightGridBoard = Board
})(window)
