/**
 * Light Grid · Playground — the app you play.
 *
 * Everything mechanical lives in ../light-grid-shared: geometry (which cells
 * exist and what neighbours what), rules (what a press toggles), board (state
 * and history), gf2 (the solver) and render (the SVG). This file is the part
 * that is specific to playing: setup controls, the clock, records, hints, and
 * the win state.
 *
 * Two decisions worth knowing about:
 *
 * * A new puzzle is made by *pressing randomly from solved*, never by filling
 *   cells at random. A board reached by pressing can be cleared by pressing, so
 *   every generated puzzle is solvable. Random fill is offered separately and
 *   labelled, because on a classic 5×5 three random boards in four cannot be
 *   cleared at all -- which is a fact worth meeting, just not by accident.
 * * The hint asks the solver for a *minimum-weight* solution and reveals one
 *   cell of it. Any solution would do to finish, but a hint that lengthens your
 *   game is a poor hint.
 */
(function () {
  'use strict'

  const { PALETTES, TILE_SHAPES, Renderer } = window.LightGridRender
  const { SHAPES } = window.LightGridGeometry
  const { RULES } = window.LightGridRules
  const GF2 = window.LightGridGF2
  const Board = window.LightGridBoard

  const STORAGE_KEY = 'light-grid-v1'
  const RECORDS_KEY = 'light-grid-v1:records'

  const $ = (id) => document.getElementById(id)

  const state = {
    board: new Board({ rows: 5, cols: 5, shape: 'rectangle', rule: 'cross' }),
    renderer: null,
    preview: [],
    hinted: [],
    startedAt: null,
    elapsed: 0,
    tickHandle: null,
    generated: false
  }

  // --- storage -------------------------------------------------------------
  /** localStorage throws in private mode; a lost setting beats a blank page. */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (error) {
      return fallback
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      /* quota or private mode: nothing to do about it */
    }
  }

  /** Records are per configuration: a 5×5 cross record says nothing about 9×9 hex. */
  function recordKey(board) {
    return [board.shape, board.rows, board.cols, board.rule, board.radius, board.states].join('|')
  }

  // --- toasts --------------------------------------------------------------
  function toast(message, tone) {
    const node = document.createElement('div')
    node.className = 'toast' + (tone ? ' is-' + tone : '')
    node.textContent = message
    $('toasts').appendChild(node)
    setTimeout(() => node.remove(), 3200)
  }

  // --- option lists --------------------------------------------------------
  function fillSelect(select, entries, selected) {
    select.textContent = ''
    for (const [value, label] of entries) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      if (value === selected) option.selected = true
      select.appendChild(option)
    }
  }

  function buildOptions() {
    fillSelect($('shape'), Object.entries(SHAPES).map(([id, shape]) => [id, shape.label]), state.board.shape)
    fillSelect($('rule'), Object.entries(RULES).map(([id, rule]) => [id, rule.label]), state.board.rule)
    fillSelect($('palette'), Object.entries(PALETTES).map(([id, palette]) => [id, palette.label]), settings.palette)
    fillSelect($('tileShape'), Object.entries(TILE_SHAPES), settings.tileShape)
  }

  // --- clock ---------------------------------------------------------------
  function formatTime(ms) {
    const total = Math.floor(ms / 1000)
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0')
  }

  function startClock() {
    if (state.tickHandle) return
    state.startedAt = Date.now() - state.elapsed
    state.tickHandle = setInterval(() => {
      state.elapsed = Date.now() - state.startedAt
      $('timer').textContent = formatTime(state.elapsed)
    }, 250)
  }

  function stopClock() {
    clearInterval(state.tickHandle)
    state.tickHandle = null
  }

  function resetClock() {
    stopClock()
    state.elapsed = 0
    $('timer').textContent = '0:00'
  }

  // --- rendering -----------------------------------------------------------
  function decorations() {
    const marks = {}
    for (const index of state.hinted) marks[index] = 'solution'
    if (settings.preview) {
      for (const cell of state.preview) {
        const at = state.board.topology.index(cell.row, cell.col)
        if (at !== -1 && marks[at] === undefined) marks[at] = 'preview'
      }
    }
    return marks
  }

  function render() {
    state.renderer.setOptions({
      palette: settings.palette,
      tileShape: settings.tileShape,
      glow: settings.glow,
      labels: settings.labels
    })
    state.renderer.draw(state.board, decorations())

    $('moves').textContent = state.board.moves
    $('lit').textContent = state.board.litCount()
    $('undo').disabled = state.board.past.length === 0
    $('redo').disabled = state.board.future.length === 0

    const records = read(RECORDS_KEY, {})
    const best = records[recordKey(state.board)]
    $('best').textContent = best ? best.moves + ' nước' : '—'

    const solverUsable = state.board.states === 2
    $('hint').disabled = !solverUsable
    $('solve').disabled = !solverUsable
    $('solverNote').textContent = solverUsable
      ? 'Bộ giải dùng khử Gauss trên GF(2): dựng ma trận nước đi rồi giải A·x = b.'
      : 'Bàn nhiều hơn 2 trạng thái cần đại số trên GF(k) — bộ giải ở đây chỉ làm GF(2), nên đang tắt.'

    write(STORAGE_KEY, { board: state.board.toJSON(), settings, elapsed: state.elapsed })
  }

  function setStatus(text, tone) {
    const badge = $('status')
    badge.textContent = text
    badge.className = 'badge' + (tone ? ' badge-' + tone : '')
  }

  // --- solving -------------------------------------------------------------
  /** One solve, reused by the hint and the auto-solver. */
  function currentSolution() {
    if (state.board.states !== 2) return null
    return GF2.solve(state.board.matrix(), state.board.rhs(), { maxEnumeration: 1 << 16 })
  }

  function showHint() {
    const result = currentSolution()
    if (!result) return
    if (!result.solvable) {
      setStatus('Bàn này không giải được', 'danger')
      toast('Không có tập ô nào tắt hết được bàn này — thử "Ván mới" để có ván chắc chắn giải được.', 'warn')
      return
    }
    const vector = result.minimal || result.solution
    const pending = []
    for (let i = 0; i < vector.length; i++) {
      if (vector[i]) pending.push(i)
    }
    if (!pending.length) {
      setStatus('Đã xong rồi!', null)
      return
    }
    state.hinted = [pending[Math.floor(Math.random() * pending.length)]]
    setStatus(`Cần ${pending.length} nước nữa`, 'info')
    render()
  }

  async function autoSolve() {
    const result = currentSolution()
    if (!result) return
    if (!result.solvable) {
      setStatus('Bàn này không giải được', 'danger')
      toast('Bàn không nằm trong không gian ảnh của ma trận nước đi — xem app Research để biết vì sao.', 'warn')
      return
    }

    const vector = result.minimal || result.solution
    const order = []
    for (let i = 0; i < vector.length; i++) {
      if (vector[i]) order.push(i)
    }
    if (!order.length) {
      toast('Bàn đã tắt hết.', null)
      return
    }

    state.hinted = []
    setStatus(`Đang giải: ${order.length} nước`, 'info')
    // Animated rather than instant: watching the presses land is what shows
    // that the solution really is just a set of cells in some order.
    for (const index of order) {
      state.board.pressIndex(index)
      render()
      await new Promise((resolve) => setTimeout(resolve, 140))
    }
    finishIfSolved()
  }

  // --- game flow -----------------------------------------------------------
  function finishIfSolved() {
    if (!state.board.isSolved()) return false
    stopClock()
    setStatus('Thắng rồi 🎉', null)

    if (state.generated) {
      const records = read(RECORDS_KEY, {})
      const key = recordKey(state.board)
      const previous = records[key]
      if (!previous || state.board.moves < previous.moves) {
        records[key] = { moves: state.board.moves, ms: state.elapsed, at: new Date().toISOString() }
        write(RECORDS_KEY, records)
        toast(`Kỷ lục mới: ${state.board.moves} nước!`)
      }
    }
    render()
    return true
  }

  function press(cell) {
    state.hinted = []
    state.board.press(cell)
    startClock()
    if (!finishIfSolved()) {
      setStatus('Đang chơi', 'info')
      render()
    }
  }

  function newPuzzle() {
    const scrambles = Number($('difficulty').value)
    if (scrambles === 0) {
      state.board.fillRandom(0.5)
      state.generated = false
      setStatus('Ngẫu nhiên — có thể không giải được', 'warn')
    } else {
      state.board.scramble(scrambles)
      state.generated = true
      setStatus('Ván mới — chắc chắn giải được', null)
    }
    state.hinted = []
    resetClock()
    render()
  }

  function rebuild() {
    state.board.configure({
      shape: $('shape').value,
      rows: Number($('rows').value),
      cols: Number($('cols').value),
      rule: $('rule').value,
      radius: Number($('radius').value),
      thickness: Number($('thickness').value),
      states: Number($('states').value)
    })
    state.generated = false
    state.hinted = []
    resetClock()
    updateNotes()
    newPuzzle()
  }

  function updateNotes() {
    const shape = SHAPES[$('shape').value]
    $('shapeNote').textContent = shape ? shape.note : ''
    const rule = RULES[$('rule').value]
    $('ruleNote').textContent = rule ? rule.note : ''
    $('radiusValue').textContent = $('radius').value
    $('statesValue').textContent = $('states').value

    // Only some shapes have a wall to be thick, and only some rules a radius.
    $('thicknessField').style.display = ['ring', 'hexring', 'cross'].includes($('shape').value) ? '' : 'none'
    $('radiusField').style.display = ['manhattan', 'square', 'ring'].includes($('rule').value) ? '' : 'none'
  }

  // --- settings ------------------------------------------------------------
  const saved = read(STORAGE_KEY, null)
  const settings = Object.assign(
    { palette: 'emerald', tileShape: 'rounded', glow: true, labels: false, preview: true, theme: 'dark' },
    saved && saved.settings
  )

  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme
    $('theme').textContent = settings.theme === 'dark' ? '🌙' : '☀️'
  }

  // --- wiring --------------------------------------------------------------
  function bind() {
    for (const id of ['shape', 'rows', 'cols', 'thickness', 'rule', 'radius', 'states']) {
      $(id).addEventListener('change', rebuild)
    }
    $('radius').addEventListener('input', () => { $('radiusValue').textContent = $('radius').value })
    $('states').addEventListener('input', () => { $('statesValue').textContent = $('states').value })

    $('palette').addEventListener('change', () => { settings.palette = $('palette').value; render() })
    $('tileShape').addEventListener('change', () => { settings.tileShape = $('tileShape').value; render() })
    $('glow').addEventListener('change', () => { settings.glow = $('glow').checked; render() })
    $('labels').addEventListener('change', () => { settings.labels = $('labels').checked; render() })
    $('previewOn').addEventListener('change', () => { settings.preview = $('previewOn').checked; render() })

    $('newPuzzle').addEventListener('click', newPuzzle)
    $('clear').addEventListener('click', () => { state.board.clear(); state.hinted = []; resetClock(); setStatus('Đã xoá sạch'); render() })
    $('undo').addEventListener('click', () => { if (state.board.undo()) { state.hinted = []; render() } })
    $('redo').addEventListener('click', () => { if (state.board.redo()) { state.hinted = []; render() } })
    $('hint').addEventListener('click', showHint)
    $('solve').addEventListener('click', () => void autoSolve())

    $('help').addEventListener('click', () => $('helpDialog').showModal())
    $('theme').addEventListener('click', () => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark'
      applyTheme()
      render()
    })

    document.addEventListener('keydown', (event) => {
      if (event.target.matches('input, select, textarea')) return
      const key = event.key.toLowerCase()
      if (key === 'n') newPuzzle()
      else if (key === 'z') { if (state.board.undo()) { state.hinted = []; render() } }
      else if (key === 'y') { if (state.board.redo()) { state.hinted = []; render() } }
      else if (key === 'h') showHint()
      else if (key === 'c') { state.board.clear(); resetClock(); render() }
    })
  }

  // --- start ---------------------------------------------------------------
  function start() {
    if (saved && saved.board) {
      state.board = Board.fromJSON(saved.board)
      state.elapsed = Number(saved.elapsed) || 0
    }

    $('shape').value = state.board.shape
    $('rows').value = state.board.rows
    $('cols').value = state.board.cols
    $('thickness').value = state.board.thickness
    $('rule').value = state.board.rule
    $('radius').value = state.board.radius
    $('states').value = state.board.states
    $('glow').checked = settings.glow
    $('labels').checked = settings.labels
    $('previewOn').checked = settings.preview

    buildOptions()
    $('shape').value = state.board.shape
    $('rule').value = state.board.rule
    $('palette').value = settings.palette
    $('tileShape').value = settings.tileShape

    state.renderer = new Renderer($('stage'), {
      onPress: (cell) => press(cell),
      onHover: (cell) => {
        state.preview = cell ? state.board.preview(cell) : []
        // `decorate`, not `render`: a full redraw empties the <svg> and rebuilds
        // it, which destroys the element the pointer is on. The browser then
        // never sees pointerdown and pointerup on the same element, so no click
        // is dispatched -- the board became unclickable whenever the preview was
        // switched on.
        if (settings.preview) state.renderer.decorate(decorations())
      }
    })

    applyTheme()
    updateNotes()
    bind()
    $('timer').textContent = formatTime(state.elapsed)
    if (!saved || !saved.board) newPuzzle()
    else render()
  }

  start()
})()
