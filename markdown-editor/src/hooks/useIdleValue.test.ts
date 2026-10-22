import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdleValue } from './useIdleValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useIdleValue', () => {
  it('starts with the real value, never a stale one', () => {
    const { result } = renderHook(() => useIdleValue('first', 400))
    expect(result.current).toBe('first')
  })

  it('collapses a burst of changes into one, after the value stops changing', () => {
    const { result, rerender } = renderHook(({ value }) => useIdleValue(value, 400), { initialProps: { value: 'a' } })
    for (const value of ['ab', 'abc', 'abcd']) {
      rerender({ value })
      act(() => vi.advanceTimersByTime(300))
      expect(result.current).toBe('a')
    }
    act(() => vi.advanceTimersByTime(400))
    expect(result.current).toBe('abcd')
  })

  it('drops a pending update when the value returns to the settled one', () => {
    const { result, rerender } = renderHook(({ value }) => useIdleValue(value, 400), { initialProps: { value: 'x' } })
    rerender({ value: 'y' })
    rerender({ value: 'x' })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe('x')
  })
})
