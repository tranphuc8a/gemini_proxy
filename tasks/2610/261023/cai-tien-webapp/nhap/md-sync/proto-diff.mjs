// Nguyên mẫu (scratch) cho thiết kế md-sync: diff dòng Myers có trần D, patch dạng hunk, merge 3 chiều theo dòng.
// Không phụ thuộc thư viện. Mục đích: đo khả thi + kiểm hình dạng dữ liệu trước khi cài thật (TS + Python).

const MAX_D = 2000          // quá số thao tác sửa này thì bỏ cuộc, gửi nguyên văn (một bản viết lại lớn thì patch cũng to)

function intern(aLines, bLines) {
  const ids = new Map()
  const map = (lines) => {
    const out = new Int32Array(lines.length)
    for (let i = 0; i < lines.length; i++) {
      let id = ids.get(lines[i])
      if (id === undefined) { id = ids.size; ids.set(lines[i], id) }
      out[i] = id
    }
    return out
  }
  return [map(aLines), map(bLines)]
}

/** Myers O((N+M)·D), giữ ảnh chụp V từng bước để lần ngược. → mảng thao tác 'e'|'d'|'i' hoặc null nếu D > maxD. */
function myers(a, b, maxD) {
  const n = a.length, m = b.length, max = n + m, off = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace = []
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2))
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) { x++; y++ }
      v[off + k] = x
      if (x >= n && y >= m) return backtrack(trace, n, m)
    }
  }
  return null
}

function backtrack(trace, n, m) {
  const ops = []
  let x = n, y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const snap = trace[d]
    const at = (k) => snap[k + d + 1]
    const k = x - y
    let prevK
    if (d === 0) prevK = 0
    else prevK = (k === -d || (k !== d && at(k - 1) < at(k + 1))) ? k + 1 : k - 1
    const prevX = d === 0 ? 0 : at(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push('e'); x--; y-- }
    if (d > 0) {
      if (x === prevX) { ops.push('i'); y-- } else { ops.push('d'); x-- }
    }
  }
  return ops.reverse()
}

/** Các hunk [o, d, [dòng chèn]]: thay d dòng của bản cũ bắt đầu ở dòng o (0-based) bằng các dòng chèn. */
export function diffLines(oldText, newText, maxD = MAX_D) {
  const A = oldText.split('\n'), B = newText.split('\n')
  let pre = 0
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++
  let suf = 0
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++
  const a0 = A.slice(pre, A.length - suf), b0 = B.slice(pre, B.length - suf)
  const [a, b] = intern(a0, b0)
  const ops = myers(a, b, maxD)
  if (!ops) return null
  const hunks = []
  let x = 0, y = 0, cur = null
  for (const op of ops) {
    if (op === 'e') { if (cur) { hunks.push(cur); cur = null } x++; y++; continue }
    if (!cur) cur = [pre + x, 0, []]
    if (op === 'd') { cur[1]++; x++ } else { cur[2].push(b0[y]); y++ }
  }
  if (cur) hunks.push(cur)
  return hunks
}

export function makePatch(oldText, newText) {
  const h = diffLines(oldText, newText)
  if (!h) return { fallback: true, content: newText }
  const p = { v: 1, h }
  // patch to hơn 60% nguyên văn thì gửi nguyên văn cho gọn
  if (JSON.stringify(p).length > newText.length * 0.6) return { fallback: true, content: newText }
  return p
}

export function applyPatch(text, patch) {
  if (patch.fallback) return patch.content
  const lines = text.split('\n')
  for (let i = patch.h.length - 1; i >= 0; i--) {
    const [o, d, ins] = patch.h[i]
    if (o < 0 || o + d > lines.length) throw new Error('patch lệch bản gốc')
    lines.splice(o, d, ...ins)
  }
  return lines.join('\n')
}

/** Merge 3 chiều theo dòng. Xung đột khi hai bên đổi các khoảng giao nhau của bản gốc, hoặc cùng chèn ở một điểm, với nội dung khác nhau. */
export function merge3(base, ours, theirs, labels = { ours: 'Máy này', theirs: 'Máy chủ' }) {
  const B = base.split('\n')
  const ho = diffLines(base, ours, 1e9).map((h) => ({ side: 'o', h }))
  const ht = diffLines(base, theirs, 1e9).map((h) => ({ side: 't', h }))
  const all = [...ho, ...ht].sort((p, q) => p.h[0] - q.h[0] || p.h[1] - q.h[1])
  const overlaps = (lo, hi, h) => {
    const [o, d] = h
    if (o === lo) return true
    return o < hi && lo < o + d || (d === 0 && o > lo && o < hi)
  }
  const clusters = []
  for (const item of all) {
    const last = clusters[clusters.length - 1]
    if (last && overlaps(last.lo, last.hi, item.h)) {
      last.items.push(item); last.hi = Math.max(last.hi, item.h[0] + item.h[1])
    } else clusters.push({ lo: item.h[0], hi: item.h[0] + item.h[1], items: [item] })
  }
  const out = []
  let pos = 0, conflicts = 0
  const sideText = (c, side) => {
    const seg = B.slice(c.lo, c.hi)
    const hs = c.items.filter((it) => it.side === side).map((it) => it.h).sort((p, q) => q[0] - p[0])
    for (const [o, d, ins] of hs) seg.splice(o - c.lo, d, ...ins)
    return seg
  }
  for (const c of clusters) {
    out.push(...B.slice(pos, c.lo))
    const hasO = c.items.some((it) => it.side === 'o'), hasT = c.items.some((it) => it.side === 't')
    const o = sideText(c, 'o'), t = sideText(c, 't')
    if (!hasT) out.push(...o)
    else if (!hasO) out.push(...t)
    else if (o.join('\n') === t.join('\n')) out.push(...o)
    else {
      conflicts++
      out.push('<<<<<<< ' + labels.ours, ...o, '=======', ...t, '>>>>>>> ' + labels.theirs)
    }
    pos = c.hi
  }
  out.push(...B.slice(pos))
  return { text: out.join('\n'), conflicts }
}

// tự kiểm nhanh khi chạy trực tiếp
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('proto-diff.mjs')) {
  const cases = [['', ''], ['a', 'b'], ['a\nb\nc', 'a\nc'], ['a\nc', 'a\nb\nc'], ['x\ny\nz\n', 'x\nY\nz\n'], ['1\n2\n3\n4\n5', '0\n1\n3\n5\n6'], ['a\r\nb', 'a\r\nb\r\nc']]
  let ok = 0
  for (const [p, q] of cases) {
    const patch = makePatch(p, q)
    const back = applyPatch(p, { v: 1, h: diffLines(p, q) })
    if (back === q && applyPatch(p, patch) === q) ok++
    else console.log('SAI', JSON.stringify([p, q]), JSON.stringify(diffLines(p, q)), JSON.stringify(back))
  }
  // ngẫu nhiên
  let s = 7
  const r = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  let rok = 0
  for (let t = 0; t < 500; t++) {
    const mk = () => Array.from({ length: Math.floor(r() * 12) }, () => 'abcde'[Math.floor(r() * 5)]).join('\n')
    const p = mk(), q = mk()
    if (applyPatch(p, { v: 1, h: diffLines(p, q) }) === q) rok++
    // merge: hai bên không đổi gì ở phía kia → kết quả bằng bên đổi
    const m = merge3(p, q, p)
    if (m.text !== q || m.conflicts) console.log('MERGE SAI', JSON.stringify([p, q, m]))
  }
  console.log(`tự kiểm: ${ok}/${cases.length} ca cố định, ${rok}/500 ca ngẫu nhiên`)
}
