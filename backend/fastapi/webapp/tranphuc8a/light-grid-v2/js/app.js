/**
 * Light Grid · Lab — the app you experiment with.
 *
 * Where the Playground asks "can you clear this board", the Lab asks "what is
 * this *configuration* like": how many of its boards are solvable, how long its
 * solutions are, what a sequence of moves looks like played back.
 *
 * Three things here that the other two apps do not have:
 *
 * * **A move tape.** Every press is recorded with the board it started from, so
 *   the scrubber can rebuild any point by replaying from the start. Storing the
 *   start plus the moves rather than a snapshot per step keeps a thousand-move
 *   tape small, and replaying forward is the only way to be sure the tape and
 *   the board agree.
 * * **Batch trials.** Sampling random boards and asking the solver about each
 *   turns the algebra into a number you can feel: on a 5×5 cross board roughly
 *   one board in four is solvable, and the trial run shows it happening.
 * * **Paint mode.** Sometimes you want a specific position, not a reachable
 *   one. Painting sets single cells and deliberately ignores the rule.
 */
(function () {
  'use strict'

  const { PALETTES, TILE_SHAPES, Renderer } = window.LightGridRender
  const { SHAPES } = window.LightGridGeometry
  const { RULES } = window.LightGridRules
  const GF2 = window.LightGridGF2
  const Board = window.LightGridBoard

  const STORAGE_KEY = 'light-grid-v2'
  const $ = (id) => document.getElementById(id)

  /**
   * Configurations worth starting from.
   *
   * Each is a question as much as a setting: the 4×4 is the smallest board most
   * of whose positions are unsolvable, the torus removes every boundary, the
   * knight rule makes a move matrix with almost no local structure.
   */
  const PRESETS = {
    classic: { label: 'Cổ điển 5×5', note: 'Trò Lights Out của Tiger Electronics. Hạng 23, số chiều nhân 2 — đúng 4 lời giải cho mỗi bàn giải được, và chỉ 1/4 số bàn là giải được.', config: { shape: 'rectangle', rows: 5, cols: 5, rule: 'cross' } },
    tiny: { label: 'Nhỏ 3×3', note: 'Ma trận nước đi khả nghịch: mọi bàn đều giải được, và lời giải là duy nhất.', config: { shape: 'rectangle', rows: 3, cols: 3, rule: 'cross' } },
    stubborn: { label: 'Bướng bỉnh 4×4', note: 'Số chiều nhân 4 — chỉ 1/16 số bàn giải được, nhưng bàn nào giải được thì có tận 16 lời giải.', config: { shape: 'rectangle', rows: 4, cols: 4, rule: 'cross' } },
    torus: { label: 'Xuyến 5×5', note: 'Bỏ hết biên. Đối xứng tăng vọt nên số chiều nhân cũng tăng theo.', config: { shape: 'torus', rows: 5, cols: 5, rule: 'cross' } },
    hex: { label: 'Lục giác 6×6', note: 'Mỗi ô 6 hàng xóm thay vì 4 — cấu trúc kề hoàn toàn khác.', config: { shape: 'hexagon', rows: 6, cols: 6, rule: 'cross' } },
    ring: { label: 'Vành khuyên 8×8', note: 'Bàn bị khoét ruột: chỉ còn một vòng, gần với một đồ thị chu trình.', config: { shape: 'ring', rows: 8, cols: 8, rule: 'cross', thickness: 2 } },
    knight: { label: 'Nước mã 6×6', note: 'Tác động nhảy xa nên đồ thị gần như không còn tính địa phương.', config: { shape: 'rectangle', rows: 6, cols: 6, rule: 'knight' } },
    lines: { label: 'Hàng + cột 6×6', note: 'Một nước chạm cả hàng lẫn cột. Hạng rất thấp — phần lớn bàn không giải được.', config: { shape: 'rectangle', rows: 6, cols: 6, rule: 'rowColumn' } },
    big: { label: 'Lớn 12×12', note: 'Đủ lớn để thấy khử Gauss bắt đầu tốn thời gian, vẫn đủ nhỏ để chạy tức thì.', config: { shape: 'rectangle', rows: 12, cols: 12, rule: 'cross' } }
  }

  const state = {
    board: new Board({ rows: 5, cols: 5, rule: 'cross' }),
    renderer: null,
    analysis: null,
    tape: null,          // { start: JSON, moves: number[] }
    recording: false,
    litHistory: []
  }

  const settings = { palette: 'ocean', tileShape: 'rounded', glow: true, labels: false, theme: 'dark', paint: false }

  // --- storage -------------------------------------------------------------
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (error) {
      return fallback
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch (error) { /* private mode */ }
  }

  function toast(message, tone) {
    const node = document.createElement('div')
    node.className = 'toast' + (tone ? ' is-' + tone : '')
    node.textContent = message
    $('toasts').appendChild(node)
    setTimeout(() => node.remove(), 3400)
  }

  function setStatus(text, tone) {
    $('status').textContent = text
    $('status').className = 'badge' + (tone ? ' badge-' + tone : '')
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

  // --- analysis ------------------------------------------------------------
  /**
   * Rank, nullity and the solution count for the current configuration.
   *
   * Recomputed only when the configuration changes, not on every press: it is
   * a property of the rules and the shape, and the board's own state plays no
   * part in it.
   */
  function analyseConfiguration() {
    const analysis = GF2.analyse(state.board.matrix())
    state.analysis = analysis

    const n = state.board.size
    const solvableShare = Math.pow(2, -analysis.nullity)
    $('rank').textContent = analysis.rank
    $('nullity').textContent = analysis.nullity
    $('solutions').textContent = analysis.nullity < 30 ? Math.pow(2, analysis.nullity) : '2^' + analysis.nullity

    $('analysis').innerHTML = ''
    const rows = [
      ['Số ô (n)', n],
      ['Hạng ma trận A', analysis.rank],
      ['Số chiều nhân (n − hạng)', analysis.nullity],
      ['Số bàn giải được', analysis.nullity === 0 ? 'toàn bộ 2^' + n : '1 / ' + Math.pow(2, analysis.nullity) + ' số bàn'],
      ['Lời giải cho mỗi bàn giải được', analysis.nullity < 30 ? Math.pow(2, analysis.nullity) : '2^' + analysis.nullity],
      ['Mẫu im lặng', analysis.quietPatterns.length]
    ]
    for (const [label, value] of rows) {
      const row = document.createElement('div')
      row.className = 'kv'
      row.innerHTML = `<span></span><b></b>`
      row.firstChild.textContent = label
      row.lastChild.textContent = String(value)
      $('analysis').appendChild(row)
    }

    const explain = document.createElement('p')
    explain.className = 'hint'
    explain.textContent = analysis.nullity === 0
      ? 'Ma trận nước đi khả nghịch: mọi bàn đều giải được và lời giải duy nhất.'
      : `Có ${analysis.quietPatterns.length} mẫu im lặng — tập ô bấm vào mà bàn không đổi. Cộng chúng vào một lời giải sẽ ra ${Math.pow(2, analysis.nullity)} lời giải khác nhau, và chỉ ${(solvableShare * 100).toFixed(solvableShare < 0.01 ? 3 : 1)}% số bàn là giải được.`
    $('analysis').appendChild(explain)
  }

  // --- rendering -----------------------------------------------------------
  function render() {
    state.renderer.setOptions({
      palette: settings.palette,
      tileShape: settings.tileShape,
      glow: settings.glow,
      labels: settings.labels
    })
    state.renderer.draw(state.board, {})
    $('moves').textContent = state.board.moves
    $('lit').textContent = state.board.litCount()
    $('undo').disabled = state.board.past.length === 0
    $('redo').disabled = state.board.future.length === 0
    drawLitChart()
    write(STORAGE_KEY, { board: state.board.toJSON(), settings, tape: state.tape })
  }

  /**
   * Lit-count over the current session.
   *
   * Drawn on a canvas by hand rather than with a chart library: it is one
   * polyline, and pulling in a charting dependency for it would be heavier than
   * the whole app.
   */
  function drawLitChart() {
    const canvas = $('litChart')
    const width = canvas.clientWidth || 260
    const height = canvas.height
    canvas.width = width

    const context = canvas.getContext('2d')
    const style = getComputedStyle(document.documentElement)
    context.clearRect(0, 0, width, height)

    const series = state.litHistory
    if (series.length < 2) {
      context.fillStyle = style.getPropertyValue('--text-faint').trim() || '#888'
      context.font = '12px system-ui'
      context.fillText('Bấm vài nước để thấy đồ thị', 8, height / 2)
      return
    }

    const max = Math.max(1, ...series)
    const stepX = width / (series.length - 1)
    context.strokeStyle = style.getPropertyValue('--accent').trim() || '#34d399'
    context.lineWidth = 2
    context.beginPath()
    series.forEach((value, index) => {
      const x = index * stepX
      const y = height - 6 - (value / max) * (height - 16)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()

    context.fillStyle = style.getPropertyValue('--text-faint').trim() || '#888'
    context.font = '11px system-ui'
    context.fillText(String(max), 4, 12)
    context.fillText('0', 4, height - 4)
  }

  // --- moves ---------------------------------------------------------------
  function press(cell, index) {
    if (settings.paint) {
      // Paint ignores the rule on purpose: this is how a specific position gets
      // built, and going through the rule would make that impossible.
      state.board.checkpoint()
      state.board.cells[index] = (state.board.cells[index] + 1) % state.board.states
    } else {
      state.board.press(cell)
      if (state.recording && state.tape) state.tape.moves.push(index)
    }
    state.litHistory.push(state.board.litCount())
    if (state.litHistory.length > 400) state.litHistory.shift()
    updateTapeUi()
    setStatus(state.board.isSolved() ? 'Đã tắt hết' : 'Đang chỉnh', state.board.isSolved() ? null : 'info')
    render()
  }

  function solveNow() {
    const result = GF2.solve(state.board.matrix(), state.board.rhs(), { maxEnumeration: 1 << 18 })
    if (!result.solvable) {
      setStatus('Không giải được', 'danger')
      toast(`Bàn này nằm ngoài không gian ảnh của A — có ${result.obstructions.length} bất biến bị vi phạm.`, 'warn')
      return
    }
    const vector = result.minimal || result.solution
    const count = GF2.weight(vector)
    for (let i = 0; i < vector.length; i++) {
      if (vector[i]) state.board.pressIndex(i, { silent: true })
    }
    state.litHistory.push(state.board.litCount())
    setStatus(result.searched ? `Đã giải bằng ${count} nước (tối thiểu)` : `Đã giải bằng ${count} nước (chưa chắc tối thiểu)`, null)
    render()
  }

  // --- move tape -----------------------------------------------------------
  function startRecording() {
    state.tape = { start: state.board.toJSON(), moves: [] }
    state.recording = true
    updateTapeUi()
    toast('Đang ghi. Mọi nước bấm từ giờ sẽ vào băng.')
  }

  function stopRecording() {
    state.recording = false
    updateTapeUi()
    toast(`Đã ghi ${state.tape ? state.tape.moves.length : 0} nước.`)
  }

  function updateTapeUi() {
    const length = state.tape ? state.tape.moves.length : 0
    $('recordToggle').textContent = state.recording ? '⏹ Dừng ghi' : '⏺ Bắt đầu ghi'
    $('replay').disabled = length === 0
    $('replayPanel').hidden = length === 0
    $('tapeLength').textContent = length
    $('scrubber').max = String(length)
  }

  /** Rebuild the board as it was after `count` moves of the tape. */
  function seekTape(count) {
    if (!state.tape) return
    const board = Board.fromJSON(state.tape.start)
    for (let i = 0; i < count && i < state.tape.moves.length; i++) {
      board.pressIndex(state.tape.moves[i], { silent: true })
    }
    board.moves = count
    state.board = board
    render()
  }

  async function replayTape() {
    if (!state.tape) return
    for (let step = 0; step <= state.tape.moves.length; step++) {
      $('scrubber').value = String(step)
      seekTape(step)
      await new Promise((resolve) => setTimeout(resolve, 160))
    }
    setStatus('Phát lại xong', null)
  }

  // --- batch trials --------------------------------------------------------
  /**
   * Sample random boards and ask the solver about each.
   *
   * The solvable share is a prediction the algebra already makes (2^-nullity);
   * running it is how that prediction stops being a formula. The minimum-weight
   * statistics are not predicted by anything simple, which is the other reason
   * to sample.
   */
  function runTrials() {
    const trials = Math.max(10, Math.min(Number($('trials').value) || 300, 5000))
    const matrix = state.board.matrix()
    const n = state.board.size
    // Enumerating the quiet-pattern coset per trial would dominate the run, and
    // the headline numbers do not need it -- so minima are computed only when
    // the nullity is small enough to be cheap.
    const enumerate = state.analysis && state.analysis.nullity <= 12

    let solvable = 0
    let weightSum = 0
    let weightMin = Infinity
    let weightMax = 0
    const started = performance.now()

    for (let trial = 0; trial < trials; trial++) {
      const rhs = new Uint8Array(n)
      for (let i = 0; i < n; i++) rhs[i] = Math.random() < 0.5 ? 1 : 0
      const result = GF2.solve(matrix, rhs, { maxEnumeration: enumerate ? 1 << 13 : 0 })
      if (!result.solvable) continue
      solvable++
      const weight = GF2.weight(result.minimal || result.solution)
      weightSum += weight
      weightMin = Math.min(weightMin, weight)
      weightMax = Math.max(weightMax, weight)
    }

    const elapsed = Math.round(performance.now() - started)
    const predicted = state.analysis ? Math.pow(2, -state.analysis.nullity) : null
    const observed = solvable / trials

    $('trialResult').innerHTML = ''
    const rows = [
      ['Số bàn thử', trials],
      ['Giải được', `${solvable} (${(observed * 100).toFixed(1)}%)`],
      ['Lý thuyết dự đoán', predicted === null ? '—' : (predicted * 100).toFixed(predicted < 0.01 ? 3 : 1) + '%'],
      ['Số nước trung bình', solvable ? (weightSum / solvable).toFixed(1) : '—'],
      ['Ít nhất / nhiều nhất', solvable ? `${weightMin} / ${weightMax}` : '—'],
      ['Thời gian', elapsed + ' ms']
    ]
    for (const [label, value] of rows) {
      const row = document.createElement('div')
      row.className = 'kv'
      row.innerHTML = '<span></span><b></b>'
      row.firstChild.textContent = label
      row.lastChild.textContent = String(value)
      $('trialResult').appendChild(row)
    }

    if (!enumerate) {
      const note = document.createElement('p')
      note.className = 'hint'
      note.textContent = 'Số chiều nhân quá lớn để duyệt hết mẫu im lặng, nên số nước ở trên là của một lời giải bất kỳ, chưa chắc ngắn nhất.'
      $('trialResult').appendChild(note)
    }
  }

  // --- import / export -----------------------------------------------------
  function download(name, blob) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    // Revoke on the next turn: revoking immediately can beat the download start.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportJson() {
    const payload = { board: state.board.toJSON(), tape: state.tape, exportedAt: new Date().toISOString() }
    download('light-grid-board.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  }

  async function exportPng() {
    try {
      download('light-grid-board.png', await state.renderer.toPngBlob(8))
    } catch (error) {
      toast('Không xuất được PNG: ' + error.message, 'error')
    }
  }

  function importJson(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result))
        state.board = Board.fromJSON(payload.board || payload)
        state.tape = payload.tape && Array.isArray(payload.tape.moves) ? payload.tape : null
        syncControls()
        analyseConfiguration()
        updateTapeUi()
        render()
        toast('Đã nhập bàn.')
      } catch (error) {
        toast('File không đọc được: ' + error.message, 'error')
      }
    }
    reader.onerror = () => toast('Không đọc được file.', 'error')
    reader.readAsText(file)
  }

  function shareLink() {
    const url = location.origin + location.pathname + '#b=' + state.board.encode()
    const copy = navigator.clipboard && navigator.clipboard.writeText(url)
    if (copy) copy.then(() => toast('Đã copy link vào clipboard.'), () => window.prompt('Copy link này:', url))
    else window.prompt('Copy link này:', url)
  }

  // --- configuration -------------------------------------------------------
  /**
   * Show or hide the fields that only some shapes and rules use.
   *
   * Reads the *controls*, not the board. Reading the board is what broke the
   * pickers: this ran on every `change`, so choosing a new shape immediately
   * wrote the board's old shape back into the select and the choice appeared to
   * be ignored. Nothing here may write to a control the user is operating.
   */
  function updateDependentFields() {
    $('radiusValue').textContent = $('radius').value
    $('thicknessField').style.display = ['ring', 'hexring', 'cross'].includes($('shape').value) ? '' : 'none'
    $('radiusField').style.display = ['manhattan', 'square', 'ring'].includes($('rule').value) ? '' : 'none'
  }

  /**
   * Push the board's configuration back into the controls.
   *
   * Only for when the board changed underneath them -- a preset, an import, a
   * shared link. Never from a control's own `change` handler.
   */
  function syncControls() {
    $('shape').value = state.board.shape
    $('rows').value = state.board.rows
    $('cols').value = state.board.cols
    $('thickness').value = state.board.thickness
    $('rule').value = state.board.rule
    $('radius').value = state.board.radius
    updateDependentFields()
  }

  function applyConfiguration() {
    state.board.configure({
      shape: $('shape').value,
      rows: Number($('rows').value),
      cols: Number($('cols').value),
      rule: $('rule').value,
      radius: Number($('radius').value),
      thickness: Number($('thickness').value)
    })
    state.litHistory = []
    state.tape = null
    state.recording = false
    syncControls()
    analyseConfiguration()
    updateTapeUi()
    setStatus('Đã dựng lại bàn', null)
    render()
  }

  function applyPreset(id) {
    const preset = PRESETS[id]
    if (!preset) return
    $('presetNote').textContent = preset.note
    state.board.configure(Object.assign({ thickness: 1, states: 2 }, preset.config))
    state.litHistory = []
    state.tape = null
    syncControls()
    analyseConfiguration()
    updateTapeUi()
    render()
  }

  // --- wiring --------------------------------------------------------------
  function bind() {
    $('preset').addEventListener('change', () => applyPreset($('preset').value))
    $('apply').addEventListener('click', applyConfiguration)
    $('shape').addEventListener('change', updateDependentFields)
    $('rule').addEventListener('change', updateDependentFields)
    $('radius').addEventListener('input', () => { $('radiusValue').textContent = $('radius').value })
    $('density').addEventListener('input', () => { $('densityValue').textContent = $('density').value })

    $('scramble').addEventListener('click', () => {
      state.board.scramble(Math.max(3, Math.round(state.board.size / 3)))
      state.litHistory = [state.board.litCount()]
      setStatus('Đã xáo — chắc chắn giải được', null)
      render()
    })
    $('random').addEventListener('click', () => {
      state.board.fillRandom(Number($('density').value) / 100)
      state.litHistory = [state.board.litCount()]
      setStatus('Ngẫu nhiên — chưa chắc giải được', 'warn')
      render()
    })
    $('allOn').addEventListener('click', () => {
      state.board.checkpoint()
      state.board.cells.fill(1)
      state.board.moves = 0
      state.litHistory = [state.board.litCount()]
      render()
    })
    $('clear').addEventListener('click', () => {
      state.board.clear()
      state.litHistory = [0]
      setStatus('Đã xoá sạch', null)
      render()
    })

    $('paintMode').addEventListener('change', () => {
      settings.paint = $('paintMode').checked
      setStatus(settings.paint ? 'Chế độ vẽ' : 'Chế độ chơi', 'info')
    })
    $('palette').addEventListener('change', () => { settings.palette = $('palette').value; render() })
    $('tileShape').addEventListener('change', () => { settings.tileShape = $('tileShape').value; render() })
    $('glow').addEventListener('change', () => { settings.glow = $('glow').checked; render() })
    $('labels').addEventListener('change', () => { settings.labels = $('labels').checked; render() })

    $('undo').addEventListener('click', () => { if (state.board.undo()) render() })
    $('redo').addEventListener('click', () => { if (state.board.redo()) render() })
    $('solveNow').addEventListener('click', solveNow)

    $('recordToggle').addEventListener('click', () => (state.recording ? stopRecording() : startRecording()))
    $('replay').addEventListener('click', () => void replayTape())
    $('clearTape').addEventListener('click', () => { state.tape = null; state.recording = false; updateTapeUi() })
    $('scrubber').addEventListener('input', () => seekTape(Number($('scrubber').value)))

    $('runTrials').addEventListener('click', runTrials)
    $('exportJson').addEventListener('click', exportJson)
    $('exportPng').addEventListener('click', () => void exportPng())
    $('share').addEventListener('click', shareLink)
    $('importFile').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0]
      event.target.value = ''
      if (file) importJson(file)
    })

    $('theme').addEventListener('click', () => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = settings.theme
      $('theme').textContent = settings.theme === 'dark' ? '🌙' : '☀️'
      render()
    })

    window.addEventListener('resize', drawLitChart)
  }

  // --- start ---------------------------------------------------------------
  function start() {
    fillSelect($('preset'), Object.entries(PRESETS).map(([id, preset]) => [id, preset.label]), 'classic')
    fillSelect($('shape'), Object.entries(SHAPES).map(([id, shape]) => [id, shape.label]))
    fillSelect($('rule'), Object.entries(RULES).map(([id, rule]) => [id, rule.label]))
    fillSelect($('palette'), Object.entries(PALETTES).map(([id, palette]) => [id, palette.label]), settings.palette)
    fillSelect($('tileShape'), Object.entries(TILE_SHAPES), settings.tileShape)

    // A shared link wins over whatever this browser last had open: following a
    // link and landing on somebody else's old board would be baffling.
    const shared = location.hash.startsWith('#b=') && Board.decode(location.hash.slice(3))
    const saved = read(STORAGE_KEY, null)
    if (shared) {
      state.board = shared
      toast('Đã mở bàn từ link chia sẻ.')
    } else if (saved && saved.board) {
      state.board = Board.fromJSON(saved.board)
      Object.assign(settings, saved.settings || {})
      if (saved.tape && Array.isArray(saved.tape.moves)) state.tape = saved.tape
    }

    document.documentElement.dataset.theme = settings.theme
    $('theme').textContent = settings.theme === 'dark' ? '🌙' : '☀️'
    $('palette').value = settings.palette
    $('tileShape').value = settings.tileShape
    $('glow').checked = settings.glow
    $('labels').checked = settings.labels
    $('presetNote').textContent = PRESETS.classic.note

    state.renderer = new Renderer($('stage'), { onPress: press })
    state.litHistory = [state.board.litCount()]

    syncControls()
    analyseConfiguration()
    updateTapeUi()
    bind()
    render()
  }

  start()
})()
