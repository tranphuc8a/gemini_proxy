/**
 * Linear algebra over GF(2) — the mathematics Lights Out actually is.
 *
 * Pressing a cell twice undoes it, and the order of presses does not matter.
 * So a solution is a *set* of cells, a set is a vector over GF(2) = {0,1}, and
 * the puzzle "turn every light off" is the linear system
 *
 *     A · x = b        (arithmetic mod 2)
 *
 * where column j of A is the pattern that pressing cell j toggles, b is the
 * board you were given, and x says which cells to press. Everything the solver
 * reports follows from that one equation:
 *
 * * **rank(A)** — how many independent effects the rules give you.
 * * **nullity = n − rank** — the dimension of the *quiet patterns*: sets of
 *   presses that change nothing. Every solvable board has exactly 2^nullity
 *   solutions, one per quiet pattern added to any one of them.
 * * **solvability** — b must lie in the column space. Equivalently b must be
 *   orthogonal to every vector in the left null space, and those vectors are
 *   the classic "invariants" that prove certain boards impossible.
 * * **minimum-weight solution** — the fewest presses, found by adding each of
 *   the 2^nullity quiet patterns to one particular solution. That is why the
 *   5×5 game has exactly 4 solutions to any solvable board: its nullity is 2.
 *
 * Rows are `Uint8Array`s of 0/1 rather than packed bits. A packed
 * representation would be several times faster, but every board these apps
 * draw is well under a few thousand cells, and a reader following the algebra
 * can see each entry.
 *
 * `window.LightGridGF2`.
 */
(function (global) {
  'use strict'

  function clone(matrix) {
    return matrix.map((row) => Uint8Array.from(row))
  }

  function addInto(target, source) {
    for (let i = 0; i < target.length; i++) target[i] ^= source[i]
  }

  function weight(vector) {
    let total = 0
    for (let i = 0; i < vector.length; i++) total += vector[i]
    return total
  }

  /**
   * Row-reduce [A | b] and record every step.
   *
   * `trace` is what makes the "show your working" view possible: each entry is
   * a swap or an elimination, with the pivot that caused it. Collecting it
   * costs one object per operation and nothing in the common path, so it is
   * always on.
   */
  function eliminate(matrixIn, rhsIn) {
    const matrix = clone(matrixIn)
    const rows = matrix.length
    const cols = rows ? matrix[0].length : 0
    const rhs = rhsIn ? Uint8Array.from(rhsIn) : new Uint8Array(rows)

    const pivotOfColumn = new Int32Array(cols).fill(-1)
    const pivotColumns = []
    const trace = []
    let pivotRow = 0

    for (let column = 0; column < cols && pivotRow < rows; column++) {
      let found = -1
      for (let row = pivotRow; row < rows; row++) {
        if (matrix[row][column]) { found = row; break }
      }
      if (found === -1) continue // a free column: its variable is unconstrained

      if (found !== pivotRow) {
        const swap = matrix[found]; matrix[found] = matrix[pivotRow]; matrix[pivotRow] = swap
        const carry = rhs[found]; rhs[found] = rhs[pivotRow]; rhs[pivotRow] = carry
        trace.push({ kind: 'swap', a: pivotRow, b: found, column })
      }

      // Reduce *every* other row, not just the ones below: the result is the
      // reduced row echelon form, from which a solution can be read directly.
      for (let row = 0; row < rows; row++) {
        if (row === pivotRow || !matrix[row][column]) continue
        addInto(matrix[row], matrix[pivotRow])
        rhs[row] ^= rhs[pivotRow]
        trace.push({ kind: 'eliminate', target: row, using: pivotRow, column })
      }

      pivotOfColumn[column] = pivotRow
      pivotColumns.push(column)
      pivotRow++
    }

    return { matrix, rhs, rank: pivotRow, pivotColumns, pivotOfColumn, rows, cols, trace }
  }

  /**
   * A basis for the null space: the quiet patterns.
   *
   * One basis vector per free column, built by setting that free variable to 1
   * and reading off what each pivot variable must then be.
   */
  function nullSpace(reduced) {
    const { matrix, cols, pivotColumns, pivotOfColumn } = reduced
    const isPivot = new Uint8Array(cols)
    for (const column of pivotColumns) isPivot[column] = 1

    const basis = []
    for (let free = 0; free < cols; free++) {
      if (isPivot[free]) continue
      const vector = new Uint8Array(cols)
      vector[free] = 1
      for (const column of pivotColumns) {
        // In RREF the pivot row reads: x_pivot + sum(free terms) = 0.
        if (matrix[pivotOfColumn[column]][free]) vector[column] = 1
      }
      basis.push(vector)
    }
    return basis
  }

  /** Transpose, so the left null space can be found with the same machinery. */
  function transpose(matrix) {
    const rows = matrix.length
    const cols = rows ? matrix[0].length : 0
    const out = Array.from({ length: cols }, () => new Uint8Array(rows))
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < cols; column++) out[column][row] = matrix[row][column]
    }
    return out
  }

  function multiply(matrix, vector) {
    const out = new Uint8Array(matrix.length)
    for (let row = 0; row < matrix.length; row++) {
      let bit = 0
      const line = matrix[row]
      for (let column = 0; column < line.length; column++) bit ^= line[column] & vector[column]
      out[row] = bit
    }
    return out
  }

  /**
   * Solve A·x = b, and describe the whole solution set.
   *
   * Returns:
   *   solvable        false when b is outside the column space
   *   solution        one solution (free variables zero), or null
   *   minimal         the fewest-presses solution, when the search was feasible
   *   solutionCount   2^nullity, as a number when it fits and a string when not
   *   quietPatterns   null-space basis: press these and nothing happens
   *   obstructions    left-null-space vectors b violates -- the reason it is unsolvable
   *   searched        whether `minimal` is proven minimal or just the first found
   *
   * `maxEnumeration` caps the search for the minimum. 2^20 combinations is
   * about a second of work; beyond that the honest answer is "here is *a*
   * solution, proving it is the shortest would take too long", which is what
   * `searched: false` says.
   */
  function solve(matrix, rhs, options = {}) {
    const maxEnumeration = options.maxEnumeration ?? (1 << 20)
    const reduced = eliminate(matrix, rhs)
    const { rank, pivotColumns, cols, rows } = reduced

    // Rows of the reduced system that read "0 = 1" are the contradictions.
    let solvable = true
    for (let row = rank; row < rows; row++) {
      if (reduced.rhs[row]) { solvable = false; break }
    }

    const quietPatterns = nullSpace(reduced)
    const nullity = cols - rank
    const solutionCount = nullity < 53 ? Math.pow(2, nullity) : '2^' + nullity

    // The left null space: y with yᵀA = 0. Each such y is an invariant -- the
    // parity of b restricted to y's support can never change, so y·b ≠ 0 is a
    // proof of impossibility rather than a failure to search hard enough.
    const obstructions = []
    if (!solvable) {
      for (const y of nullSpace(eliminate(transpose(matrix)))) {
        let parity = 0
        for (let i = 0; i < rhs.length; i++) parity ^= y[i] & rhs[i]
        if (parity) obstructions.push(y)
      }
    }

    if (!solvable) {
      return { solvable: false, solution: null, minimal: null, solutionCount: 0, quietPatterns, obstructions, reduced, searched: true }
    }

    // Particular solution: free variables 0, pivot variables read off the RREF.
    const solution = new Uint8Array(cols)
    pivotColumns.forEach((column, index) => { solution[column] = reduced.rhs[index] })

    let minimal = solution
    let searched = true
    if (quietPatterns.length) {
      const combinations = Math.pow(2, quietPatterns.length)
      if (combinations > maxEnumeration) {
        searched = false
      } else {
        // Gray-code order: each step flips exactly one quiet pattern in or out,
        // so the running candidate is updated with one XOR instead of rebuilt.
        const candidate = Uint8Array.from(solution)
        let best = Uint8Array.from(solution)
        let bestWeight = weight(solution)
        let previous = 0
        for (let mask = 1; mask < combinations; mask++) {
          const gray = mask ^ (mask >> 1)
          const changed = gray ^ previous
          previous = gray
          addInto(candidate, quietPatterns[Math.log2(changed) | 0])
          const candidateWeight = weight(candidate)
          if (candidateWeight < bestWeight) {
            bestWeight = candidateWeight
            best = Uint8Array.from(candidate)
          }
        }
        minimal = best
      }
    }

    return { solvable: true, solution, minimal, solutionCount, quietPatterns, obstructions: [], reduced, searched }
  }

  /** Rank and nullity alone, for a UI that only wants the headline numbers. */
  function analyse(matrix) {
    const reduced = eliminate(matrix)
    const nullity = reduced.cols - reduced.rank
    return {
      rank: reduced.rank,
      nullity,
      solvableFraction: nullity === reduced.cols ? 1 : Math.pow(2, -nullity),
      quietPatterns: nullSpace(reduced),
      reduced
    }
  }

  /** Is this board reachable at all? Cheaper than solving when that is all you ask. */
  function isSolvable(matrix, rhs) {
    const reduced = eliminate(matrix, rhs)
    for (let row = reduced.rank; row < reduced.rows; row++) {
      if (reduced.rhs[row]) return false
    }
    return true
  }

  global.LightGridGF2 = {
    eliminate, nullSpace, transpose, multiply, solve, analyse, isSolvable, weight, clone
  }
})(window)
