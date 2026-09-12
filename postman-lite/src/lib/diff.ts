/** Line-by-line comparison of two response bodies. */

export interface DiffRow {
  left: string | null
  right: string | null
  leftNo: number | null
  rightNo: number | null
  leftClass: string
  rightClass: string
}

/**
 * Line diff via the classic LCS table.
 *
 * The inputs are one HTTP response each, so the quadratic table is fine; the cap
 * is what keeps a pathological 50k-line payload from locking up the UI thread.
 */
export function diffLines(a: string, b: string, maxLines = 4000): DiffRow[] {
  const left = a.split('\n').slice(0, maxLines)
  const right = b.split('\n').slice(0, maxLines)

  const lcs: number[][] = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0))
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lcs[i][j] = left[i] === right[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ left: left[i], right: right[j], leftNo: i + 1, rightNo: j + 1, leftClass: '', rightClass: '' })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ left: left[i], right: null, leftNo: i + 1, rightNo: null, leftClass: 'diff-removed', rightClass: '' })
      i++
    } else {
      rows.push({ left: null, right: right[j], leftNo: null, rightNo: j + 1, leftClass: '', rightClass: 'diff-added' })
      j++
    }
  }
  while (i < left.length) {
    rows.push({ left: left[i], right: null, leftNo: i + 1, rightNo: null, leftClass: 'diff-removed', rightClass: '' })
    i++
  }
  while (j < right.length) {
    rows.push({ left: null, right: right[j], leftNo: null, rightNo: j + 1, leftClass: '', rightClass: 'diff-added' })
    j++
  }
  return rows
}

/** Pretty-print JSON so a diff compares structure rather than one long line. */
export function diffableBody(bytes: Uint8Array, contentType: string): string {
  const text = new TextDecoder().decode(bytes)
  if (!contentType.toLowerCase().includes('json')) return text
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
