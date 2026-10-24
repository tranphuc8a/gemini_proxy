import { describe, expect, it } from 'vitest'
import { MAX_BATCH, batchSize, initialBlocks, nextBatch, orderFrom } from '../progressive'

describe('orderFrom', () => {
  it('is a permutation of every block', () => {
    for (const [index, count] of [[0, 1], [0, 30], [15, 30], [29, 30], [200, 30], [-5, 30]]) {
      const order = orderFrom(index, count)
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, at) => at))
    }
    expect(orderFrom(0, 0)).toEqual([])
  })

  it('builds around the viewed block first, then down, then up', () => {
    const order = orderFrom(50, 100)
    expect(order[0]).toBe(50)
    expect(order.slice(0, 11)).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 49, 48])
    expect(order.slice(11, 41)).toEqual(Array.from({ length: 30 }, (_, at) => 59 + at))
    expect(order[order.length - 1]).toBe(0)
  })
})

describe('batches', () => {
  it('sizes a slice by the budget, at least one block and never more than the cap', () => {
    expect(batchSize(12, 4)).toBe(3)
    expect(batchSize(12, 50)).toBe(1)
    expect(batchSize(12, 0.001)).toBe(MAX_BATCH)
    expect(batchSize(12, 0)).toBe(1)
    expect(batchSize(12, Number.NaN)).toBe(1)
  })

  it('takes the first unbuilt blocks in order', () => {
    const done = new Set([3, 4])
    expect(nextBatch([3, 4, 5, 6, 7, 8], (index) => done.has(index), 12, 4)).toEqual([5, 6, 7])
    expect(nextBatch([3, 4], (index) => done.has(index), 12, 4)).toEqual([])
  })

  it('the build finishes in a bounded number of slices and the viewed block goes first', () => {
    const built = new Set<number>()
    const order = orderFrom(70, 200)
    let slices = 0
    let firstSlice: number[] = []
    while (built.size < 200 && slices < 1000) {
      const batch = nextBatch(order, (index) => built.has(index), 12, 4)
      if (slices === 0) firstSlice = batch
      batch.forEach((index) => built.add(index))
      slices += 1
    }
    expect(built.size).toBe(200)
    expect(slices).toBe(Math.ceil(200 / 3))
    expect(firstSlice[0]).toBe(70)
  })
})

describe('initialBlocks', () => {
  it('fills about a few screens from the top, within the block limits', () => {
    expect(initialBlocks(Array(500).fill(5))).toHaveLength(18)
    expect(initialBlocks(Array(500).fill(60))).toHaveLength(6)
    expect(initialBlocks(Array(500).fill(1))).toHaveLength(40)
    expect(initialBlocks([5, 5])).toEqual([0, 1])
    expect(initialBlocks([])).toEqual([])
  })
})
