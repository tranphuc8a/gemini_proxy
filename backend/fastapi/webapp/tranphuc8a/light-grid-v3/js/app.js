/**
 * Light Grid · Research — the app that shows the mathematics.
 *
 * The previous version of this page had a "Solve" button that printed the list
 * of lit cells and called it a solver, and a "Rank" field that displayed
 * `min(rows*cols, rows+cols)` — a guess, not a rank. Everything here is now
 * computed: the move matrix is built from the rule, reduced over GF(2), and
 * every number on screen falls out of that reduction.
 *
 * What each panel is for:
 *
 * * **Lời giải** — the full solution set. There is never "the" solution: a
 *   solvable board has exactly 2^nullity of them, and they are listed.
 * * **Mẫu im lặng** — the null-space basis. Pressing one changes nothing, which
 *   is a claim the panel lets you check by pressing it.
 * * **Ma trận A** — A and its reduced row echelon form, drawn as a bitmap.
 * * **Khử Gauss** — the elimination replayed one row operation at a time.
 * * **Đuổi đèn** — light chasing, the hand method, and why the last row decides
 *   solvability.
 * * **Lý thuyết** — the argument written out, with this board's own numbers
 *   substituted in.
 */
(function () {
  'use strict'

  const { PALETTES, Renderer } = window.LightGridRender
  const { SHAPES } = window.LightGridGeometry
  const { RULES } = window.LightGridRules
  const GF2 = window.LightGridGF2
  const Board = window.LightGridBoard

  const STORAGE_KEY = 'light-grid-v3'
  const $ = (id) => document.getElementById(id)

  const state = {
    board: new Board({ rows: 5, cols: 5, rule: 'cross' }),
    renderer: null,
    analysis: null,
    result: null,
    highlight: {},        // cell index -> decoration class
    chasingRow: 1,
    chasingPresses: [],
    theme: 'dark',
    paint: true
  }

  // --- helpers -------------------------------------------------------------
  function toast(message, tone) {
    const node = document.createElement('div')
    node.className = 'toast' + (tone ? ' is-' + tone : '')
    node.textContent = message
    $('toasts').appendChild(node)
    setTimeout(() => node.remove(), 3600)
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (error) { return fallback }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch (error) { /* private mode */ }
  }

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

  function kvRows(host, rows) {
    host.innerHTML = ''
    for (const [label, value] of rows) {
      const row = document.createElement('div')
      row.className = 'kv'
      row.innerHTML = '<span></span><b></b>'
      row.firstChild.textContent = label
      row.lastChild.textContent = String(value)
      host.appendChild(row)
    }
  }

  function indicesOf(vector) {
    const out = []
    for (let i = 0; i < vector.length; i++) {
      if (vector[i]) out.push(i)
    }
    return out
  }

  /** Human-readable cell name: "r3c1" is easier to find than "index 16". */
  function cellName(index) {
    const cell = state.board.topology.cells[index]
    return cell ? `r${cell.row + 1}c${cell.col + 1}` : '#' + index
  }

  // --- rendering -----------------------------------------------------------
  function render() {
    state.renderer.setOptions({ palette: 'ocean', tileShape: 'rounded', glow: true, labels: state.board.size <= 64 })
    state.renderer.draw(state.board, state.highlight)
    write(STORAGE_KEY, { board: state.board.toJSON(), theme: state.theme })
  }

  function highlight(indices, kind) {
    state.highlight = {}
    for (const index of indices) state.highlight[index] = kind
    render()
  }

  // --- analysis ------------------------------------------------------------
  /** Everything downstream of the configuration. Called when the board changes. */
  function recompute() {
    const matrix = state.board.matrix()
    state.analysis = GF2.analyse(matrix)
    state.result = GF2.solve(matrix, state.board.rhs(), { maxEnumeration: 1 << 18 })

    renderVerdict()
    renderSolutions()
    renderQuiet()
    renderMatrix()
    renderElimination()
    renderChasing()
    renderTheory()
  }

  function renderVerdict() {
    const { analysis, result } = state
    const host = $('verdict')
    host.innerHTML = ''

    const headline = document.createElement('div')
    headline.className = 'row'
    const badge = document.createElement('span')
    if (result.solvable) {
      badge.className = 'badge'
      badge.textContent = '✓ Giải được'
    } else {
      badge.className = 'badge badge-danger'
      badge.textContent = '✗ Không giải được'
    }
    headline.appendChild(badge)

    const summary = document.createElement('span')
    summary.className = 'hint'
    summary.textContent = result.solvable
      ? `${GF2.weight(result.minimal || result.solution)} nước bấm là ít nhất; có ${result.solutionCount} lời giải.`
      : `Bàn vi phạm ${result.obstructions.length} bất biến — không có tập ô nào tắt hết được.`
    headline.appendChild(summary)
    host.appendChild(headline)

    const stats = document.createElement('div')
    stats.className = 'analysis'
    kvRows(stats, [
      ['Số ô n', state.board.size],
      ['Hạng A', analysis.rank],
      ['Số chiều nhân', analysis.nullity],
      ['Đèn đang sáng', state.board.litCount()]
    ])
    host.appendChild(stats)

    if (!result.solvable && result.obstructions.length) {
      const note = document.createElement('p')
      note.className = 'hint'
      note.textContent = 'Bấm để xem bất biến đầu tiên bị vi phạm — tổng số đèn sáng trên tập ô đó luôn giữ nguyên tính chẵn lẻ, dù bấm thế nào.'
      const button = document.createElement('button')
      button.className = 'btn btn-sm'
      button.textContent = 'Xem bất biến bị vi phạm'
      button.addEventListener('click', () => {
        highlight(indicesOf(result.obstructions[0]), 'obstruction')
        toast('Tô đỏ: tập ô của bất biến. Số đèn sáng trên tập này luôn lẻ, nên không bao giờ về 0.')
      })
      host.appendChild(note)
      host.appendChild(button)
    }
  }

  function renderSolutions() {
    const { result } = state
    kvRows($('solutionSummary'), [
      ['Giải được', result.solvable ? 'có' : 'không'],
      ['Số lời giải', result.solvable ? result.solutionCount : 0],
      ['Số nước ít nhất', result.solvable ? GF2.weight(result.minimal || result.solution) : '—'],
      ['Đã duyệt hết?', result.solvable ? (result.searched ? 'có' : 'không — quá nhiều tổ hợp') : '—']
    ])

    $('applyMinimal').disabled = !result.solvable
    $('stepSolution').disabled = !result.solvable

    const list = $('solutionList')
    list.innerHTML = ''
    if (!result.solvable) {
      list.innerHTML = '<p class="hint">Không có lời giải nào để liệt kê.</p>'
      return
    }

    // Enumerate the coset: particular solution + every subset of quiet patterns.
    // Capped because 2^nullity is 256 by the time the nullity reaches 8, and a
    // list longer than that is not something anyone reads.
    const quiet = result.quietPatterns
    const total = Math.pow(2, quiet.length)
    const cap = Math.min(total, 64)
    const solutions = []
    for (let mask = 0; mask < cap; mask++) {
      const vector = Uint8Array.from(result.solution)
      for (let bit = 0; bit < quiet.length; bit++) {
        if (mask & (1 << bit)) {
          for (let i = 0; i < vector.length; i++) vector[i] ^= quiet[bit][i]
        }
      }
      solutions.push(vector)
    }
    solutions.sort((a, b) => GF2.weight(a) - GF2.weight(b))

    solutions.forEach((vector, rank) => {
      const chip = document.createElement('button')
      chip.className = 'chip'
      chip.textContent = `${GF2.weight(vector)} nước`
      chip.title = indicesOf(vector).map(cellName).join(', ') || 'không cần bấm gì'
      if (rank === 0) chip.classList.add('is-best')
      chip.addEventListener('click', () => {
        highlight(indicesOf(vector), 'solution')
        toast(`Tô vàng: ${GF2.weight(vector)} ô cần bấm.`)
      })
      list.appendChild(chip)
    })

    if (total > cap) {
      const note = document.createElement('p')
      note.className = 'hint'
      note.textContent = `Hiển thị ${cap} trong ${total} lời giải.`
      list.appendChild(note)
    }
  }

  function renderQuiet() {
    const list = $('quietList')
    list.innerHTML = ''
    $('quietDetail').innerHTML = ''

    const quiet = state.analysis.quietPatterns
    if (!quiet.length) {
      list.innerHTML = '<p class="hint">Không có mẫu im lặng nào: ma trận khả nghịch, nên mọi bàn giải được và lời giải duy nhất.</p>'
      return
    }

    quiet.forEach((vector, index) => {
      const chip = document.createElement('button')
      chip.className = 'chip'
      chip.textContent = `Mẫu ${index + 1} · ${GF2.weight(vector)} ô`
      chip.addEventListener('click', () => {
        highlight(indicesOf(vector), 'quiet')
        $('quietDetail').innerHTML = ''
        const check = document.createElement('button')
        check.className = 'btn btn-sm'
        check.textContent = 'Bấm hết mẫu này (bàn sẽ không đổi)'
        check.addEventListener('click', () => {
          const before = Array.from(state.board.cells).join('')
          state.board.checkpoint()
          for (const at of indicesOf(vector)) state.board.pressIndex(at, { silent: true })
          const after = Array.from(state.board.cells).join('')
          render()
          toast(before === after ? 'Đúng như dự đoán: bàn không đổi gì.' : 'Bàn đã đổi — mẫu này không im lặng!', before === after ? null : 'error')
        })
        $('quietDetail').appendChild(check)
      })
      list.appendChild(chip)
    })
  }

  // --- matrix bitmaps ------------------------------------------------------
  /**
   * Draw a 0/1 matrix as a bitmap.
   *
   * A canvas rather than a table: a 20×20 board gives a 400×400 matrix, which
   * is 160 000 cells — as DOM nodes that is a frozen tab, as pixels it is
   * instant. `highlightRow`/`highlightColumn` tint the row operation currently
   * being shown in the elimination panel.
   */
  function drawMatrix(canvas, matrix, options = {}) {
    const rows = matrix.length
    const cols = rows ? matrix[0].length : 0
    const maxPixels = 420
    const scale = Math.max(1, Math.floor(maxPixels / Math.max(rows, cols, 1)))

    canvas.width = cols * scale
    canvas.height = rows * scale
    canvas.style.width = Math.min(cols * scale, maxPixels) + 'px'

    const style = getComputedStyle(document.documentElement)
    const context = canvas.getContext('2d')
    context.fillStyle = style.getPropertyValue('--bg-sunken').trim() || '#0b0f16'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const one = style.getPropertyValue('--accent').trim() || '#34d399'
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < cols; column++) {
        if (!matrix[row][column]) continue
        context.fillStyle = one
        context.fillRect(column * scale, row * scale, scale, scale)
      }
    }

    if (options.highlightRows) {
      context.fillStyle = 'rgba(251, 191, 36, 0.35)'
      for (const row of options.highlightRows) context.fillRect(0, row * scale, canvas.width, scale)
    }
    if (options.highlightColumn !== undefined && options.highlightColumn >= 0) {
      context.fillStyle = 'rgba(96, 165, 250, 0.3)'
      context.fillRect(options.highlightColumn * scale, 0, scale, canvas.height)
    }
  }

  function renderMatrix() {
    const reduced = state.analysis.reduced
    const matrix = $('showReduced').checked ? reduced.matrix : state.board.matrix()
    drawMatrix($('matrixCanvas'), matrix)
    const density = matrix.reduce((sum, row) => sum + GF2.weight(row), 0)
    $('matrixNote').textContent =
      `${matrix.length}×${matrix.length ? matrix[0].length : 0}, ${density} số 1 ` +
      `(${((density / Math.max(1, matrix.length * matrix.length)) * 100).toFixed(1)}% mật độ). ` +
      (($('showReduced').checked) ? `Hạng = số hàng khác 0 = ${reduced.rank}.` : 'Cột j = tập ô bị lật khi bấm ô j.')
  }

  /**
   * Replay the elimination.
   *
   * Replaying from A rather than storing a matrix per step: the trace is a few
   * thousand entries on a big board, and a matrix each would be tens of
   * megabytes. Replaying up to step k is O(k · n), which is instant at these
   * sizes and uses no memory at all.
   */
  function matrixAtStep(step) {
    const trace = state.analysis.reduced.trace
    const matrix = GF2.clone(state.board.matrix())
    for (let i = 0; i < step && i < trace.length; i++) {
      const operation = trace[i]
      if (operation.kind === 'swap') {
        const carry = matrix[operation.a]
        matrix[operation.a] = matrix[operation.b]
        matrix[operation.b] = carry
      } else {
        for (let column = 0; column < matrix[operation.target].length; column++) {
          matrix[operation.target][column] ^= matrix[operation.using][column]
        }
      }
    }
    return matrix
  }

  function renderElimination() {
    const trace = state.analysis.reduced.trace
    $('stepSlider').max = String(trace.length)
    $('stepSlider').value = '0'
    $('stepCount').textContent = `${trace.length} phép biến đổi hàng`
    showStep(0)
  }

  function showStep(step) {
    const trace = state.analysis.reduced.trace
    const operation = step > 0 ? trace[step - 1] : null
    $('stepLabel').textContent = operation
      ? operation.kind === 'swap'
        ? `Bước ${step}: đổi chỗ hàng ${operation.a} ↔ ${operation.b} (trục ở cột ${operation.column})`
        : `Bước ${step}: hàng ${operation.target} += hàng ${operation.using} (khử cột ${operation.column})`
      : 'Bắt đầu: ma trận A ban đầu'
    drawMatrix($('stepCanvas'), matrixAtStep(step), {
      highlightRows: operation ? (operation.kind === 'swap' ? [operation.a, operation.b] : [operation.target, operation.using]) : [],
      highlightColumn: operation ? operation.column : -1
    })
  }

  // --- light chasing -------------------------------------------------------
  /**
   * Light chasing works on a rectangle under the cross rule and nowhere else.
   *
   * It relies on "the only press that can still change row r is a press in row
   * r+1", which is a property of that particular neighbourhood on that
   * particular shape. Saying so is more useful than quietly producing nonsense
   * on a hex board.
   */
  function chasingApplies() {
    return (state.board.shape === 'rectangle' || state.board.shape === 'torus') && state.board.rule === 'cross'
  }

  function renderChasing() {
    const ok = chasingApplies()
    $('chaseStep').disabled = !ok
    $('chaseAll').disabled = !ok
    $('chaseReset').disabled = !ok
    $('chasingNote').innerHTML = ok
      ? '<p class="hint">Áp dụng được cho cấu hình hiện tại.</p>'
      : '<p class="hint badge-warn-text">Đuổi đèn chỉ đúng với hình chữ nhật (hoặc xuyến) và luật Cross: nó dựa vào việc "chỉ nước bấm ở hàng dưới mới còn ảnh hưởng tới hàng trên". Với hình dạng hoặc luật khác, hãy dùng khử Gauss ở tab bên cạnh.</p>'
    updateChasingState()
  }

  function updateChasingState() {
    kvRows($('chasingState'), [
      ['Hàng đang quét', chasingApplies() ? `${state.chasingRow + 1} / ${state.board.rows}` : '—'],
      ['Đã bấm', state.chasingPresses.length + ' ô'],
      ['Đèn còn sáng', state.board.litCount()],
      ['Hàng cuối còn sáng', chasingApplies() ? lastRowPattern() : '—']
    ])
  }

  function lastRowPattern() {
    const last = state.board.rows - 1
    let pattern = ''
    for (let col = 0; col < state.board.cols; col++) {
      const at = state.board.topology.index(last, col)
      pattern += at === -1 ? '·' : (state.board.cells[at] ? '●' : '○')
    }
    return pattern
  }

  function chaseOneRow() {
    if (!chasingApplies() || state.chasingRow >= state.board.rows) return
    const row = state.chasingRow
    const pressed = []
    for (let col = 0; col < state.board.cols; col++) {
      const above = state.board.topology.index(row - 1, col)
      if (above !== -1 && state.board.cells[above]) {
        const at = state.board.topology.index(row, col)
        if (at !== -1) {
          state.board.pressIndex(at, { silent: true })
          pressed.push(at)
        }
      }
    }
    state.chasingPresses.push(...pressed)
    state.chasingRow++
    highlight(pressed, 'solution')
    updateChasingState()

    if (state.chasingRow >= state.board.rows) {
      const stuck = state.board.litCount()
      toast(stuck === 0
        ? 'Quét xong và bàn đã tắt hết — lời giải chỉ gồm các ô vừa bấm.'
        : `Quét xong, còn ${stuck} đèn ở hàng cuối. Chính hàng cuối này quyết định phải bấm gì thêm ở hàng đầu — hoặc bàn không giải được.`,
        stuck === 0 ? null : 'warn')
    }
  }

  function chaseAll() {
    while (state.chasingRow < state.board.rows) chaseOneRow()
  }

  function resetChasing() {
    state.chasingRow = 1
    state.chasingPresses = []
    state.highlight = {}
    render()
    updateChasingState()
  }

  // --- theory --------------------------------------------------------------
  function renderTheory() {
    const { analysis, result } = state
    const n = state.board.size
    const solvableShare = Math.pow(2, -analysis.nullity)
    $('theory').innerHTML = `
      <p><b>1. Một nước đi là một vector.</b> Bấm hai lần vào cùng một ô thì mọi thứ trở lại như cũ, và thứ tự bấm không quan trọng. Nên điều duy nhất có ý nghĩa là <i>tập ô</i> bạn bấm — tức một vector <code>x ∈ GF(2)<sup>${n}</sup></code>.</p>

      <p><b>2. Luật chơi là một ma trận.</b> Cột <code>j</code> của <code>A</code> ghi những ô bị lật khi bấm ô <code>j</code>. Bấm theo tập <code>x</code> thì tổng tác động là <code>A·x</code>, cộng mod 2.</p>

      <p><b>3. Trò chơi là một hệ phương trình.</b> Gọi <code>b</code> là bàn hiện tại. "Tắt hết đèn" chính là <code>A·x = b</code>. Không có gì khác ngoài đại số tuyến tính trên GF(2).</p>

      <p><b>4. Với cấu hình hiện tại:</b></p>
      <ul>
        <li>Hạng của <code>A</code> là <b>${analysis.rank}</b> trên tổng số <b>${n}</b> ô.</li>
        <li>Số chiều nhân là <b>${analysis.nullity}</b>, nên có <b>${analysis.quietPatterns.length}</b> mẫu im lặng độc lập.</li>
        <li>Đúng <b>${analysis.nullity === 0 ? 'toàn bộ' : (solvableShare * 100).toFixed(solvableShare < 0.01 ? 4 : 2) + '%'}</b> số bàn có thể giải được.</li>
        <li>Mỗi bàn giải được có đúng <b>2<sup>${analysis.nullity}</sup> = ${analysis.nullity < 30 ? Math.pow(2, analysis.nullity) : '…'}</b> lời giải.</li>
        <li>Bàn đang mở: <b>${result.solvable ? 'giải được' : 'không giải được'}</b>.</li>
      </ul>

      <p><b>5. Vì sao có bàn không giải được.</b> <code>A·x</code> chỉ chạy khắp không gian cột của <code>A</code>. Nếu <code>b</code> nằm ngoài đó thì không tập ô nào chạm tới được. Cách kiểm tra: mọi vector <code>y</code> thoả <code>yᵀA = 0</code> (hạt nhân trái) cho một bất biến — đại lượng <code>y·b</code> không bao giờ đổi khi bấm. Nếu <code>y·b = 1</code> thì bàn vĩnh viễn không về 0 được. Đó là một <i>chứng minh</i> bất khả thi, không phải "tìm mãi không ra".</p>

      <p><b>6. Ván ngẫu nhiên khác ván xáo.</b> Tô ngẫu nhiên cho ra một <code>b</code> bất kỳ, và chỉ ${analysis.nullity === 0 ? '100' : (solvableShare * 100).toFixed(1)}% trong số đó giải được. Xáo bằng cách bấm ngẫu nhiên từ bàn đã tắt thì <code>b = A·x</code> theo đúng định nghĩa — nên luôn giải được.</p>

      <p class="hint">Đọc thêm: Anderson &amp; Feil, “Turning Lights Out with Linear Algebra”, Mathematics Magazine 71 (1998).</p>
    `
  }

  // --- configuration -------------------------------------------------------
  function syncControls() {
    $('shape').value = state.board.shape
    $('rows').value = state.board.rows
    $('cols').value = state.board.cols
    $('thickness').value = state.board.thickness
    $('rule').value = state.board.rule
    $('radius').value = state.board.radius
    $('thicknessField').style.display = ['ring', 'hexring', 'cross'].includes(state.board.shape) ? '' : 'none'
    $('radiusField').style.display = ['manhattan', 'square', 'ring'].includes(state.board.rule) ? '' : 'none'
    $('configNote').textContent =
      (SHAPES[state.board.shape] ? SHAPES[state.board.shape].note + ' ' : '') +
      (RULES[state.board.rule] ? RULES[state.board.rule].note : '')
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
    state.highlight = {}
    resetChasing()
    syncControls()
    recompute()
    render()
  }

  function afterBoardChange() {
    state.highlight = {}
    state.chasingRow = 1
    state.chasingPresses = []
    recompute()
    render()
  }

  // --- export --------------------------------------------------------------
  function exportMatrixCsv() {
    const matrix = state.board.matrix()
    const header = ['cell', ...state.board.topology.cells.map((_, index) => cellName(index))].join(',')
    const lines = matrix.map((row, index) => [cellName(index), ...row].join(','))
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'light-grid-matrix.csv'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // --- wiring --------------------------------------------------------------
  function bind() {
    $('apply').addEventListener('click', applyConfiguration)
    $('shape').addEventListener('change', syncControls)
    $('rule').addEventListener('change', syncControls)

    $('scramble').addEventListener('click', () => { state.board.scramble(); afterBoardChange() })
    $('random').addEventListener('click', () => { state.board.fillRandom(0.5); afterBoardChange() })
    $('allOn').addEventListener('click', () => { state.board.checkpoint(); state.board.cells.fill(1); afterBoardChange() })
    $('clear').addEventListener('click', () => { state.board.clear(); afterBoardChange() })
    $('paintMode').addEventListener('change', () => { state.paint = $('paintMode').checked })

    $('applyMinimal').addEventListener('click', () => {
      const vector = state.result.minimal || state.result.solution
      state.board.checkpoint()
      for (const at of indicesOf(vector)) state.board.pressIndex(at, { silent: true })
      afterBoardChange()
      toast('Đã áp dụng lời giải ngắn nhất.')
    })

    $('stepSolution').addEventListener('click', async () => {
      const order = indicesOf(state.result.minimal || state.result.solution)
      for (const at of order) {
        highlight([at], 'solution')
        await new Promise((resolve) => setTimeout(resolve, 260))
        state.board.pressIndex(at, { silent: true })
        render()
      }
      afterBoardChange()
    })

    $('showReduced').addEventListener('change', renderMatrix)
    $('stepSlider').addEventListener('input', () => showStep(Number($('stepSlider').value)))

    $('chaseStep').addEventListener('click', chaseOneRow)
    $('chaseAll').addEventListener('click', chaseAll)
    $('chaseReset').addEventListener('click', resetChasing)

    $('exportMatrix').addEventListener('click', exportMatrixCsv)
    $('share').addEventListener('click', () => {
      const url = location.origin + location.pathname + '#b=' + state.board.encode()
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Đã copy link.'), () => window.prompt('Copy link:', url))
      else window.prompt('Copy link:', url)
    })

    $('theme').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = state.theme
      $('theme').textContent = state.theme === 'dark' ? '🌙' : '☀️'
      render()
      renderMatrix()
      showStep(Number($('stepSlider').value))
    })

    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => {
        for (const other of document.querySelectorAll('.tab')) other.classList.toggle('is-active', other === tab)
        for (const panel of document.querySelectorAll('.tab-panel')) {
          panel.hidden = panel.dataset.panel !== tab.dataset.tab
        }
        // Canvases sized while hidden come out 0 wide, so redraw on reveal.
        if (tab.dataset.tab === 'matrix') renderMatrix()
        if (tab.dataset.tab === 'elimination') showStep(Number($('stepSlider').value))
      })
    }
  }

  // --- start ---------------------------------------------------------------
  function start() {
    fillSelect($('shape'), Object.entries(SHAPES).map(([id, shape]) => [id, shape.label]))
    fillSelect($('rule'), Object.entries(RULES).map(([id, rule]) => [id, rule.label]))

    const shared = location.hash.startsWith('#b=') && Board.decode(location.hash.slice(3))
    const saved = read(STORAGE_KEY, null)
    if (shared) state.board = shared
    else if (saved && saved.board) {
      state.board = Board.fromJSON(saved.board)
      state.theme = saved.theme || 'dark'
    }

    document.documentElement.dataset.theme = state.theme
    $('theme').textContent = state.theme === 'dark' ? '🌙' : '☀️'

    state.renderer = new Renderer($('stage'), {
      onPress: (cell, index) => {
        if (state.paint) {
          state.board.checkpoint()
          state.board.cells[index] ^= 1
        } else {
          state.board.press(cell)
        }
        afterBoardChange()
      }
    })

    syncControls()
    bind()
    recompute()
    render()
  }

  start()
})()
