import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAbortControllers, useDebouncedValue, useMediaQuery } from '../src/js/react-hooks'

afterEach(() => vi.useRealTimers())

it('subscribes to a media query and removes the same listener on cleanup', () => {
  let matches = false
  const listeners = new Set<() => void>()
  const mediaQuery = {
    get matches() { return matches },
    media: '(max-width: 600px)',
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }
  vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery as unknown as MediaQueryList)
  const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 600px)'))
  expect(result.current).toBe(false)
  act(() => {
    matches = true
    listeners.forEach((listener) => listener())
  })
  expect(result.current).toBe(true)
  unmount()
  expect(mediaQuery.removeEventListener).toHaveBeenCalledOnce()
  expect(listeners.size).toBe(0)
})

it('debounces the latest value and cancels pending timers on unmount', () => {
  vi.useFakeTimers()
  const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 200), {
    initialProps: { value: 'first' }
  })
  rerender({ value: 'second' })
  expect(result.current).toBe('first')
  act(() => vi.advanceTimersByTime(199))
  expect(result.current).toBe('first')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current).toBe('second')
  rerender({ value: 'third' })
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

describe('request cancellation', () => {
  it('aborts a superseded request with the same key', () => {
    const { result } = renderHook(() => useAbortControllers())
    const first = result.current.nextController('load')
    const second = result.current.nextController('load')
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
  })

  it('aborts every active request on unmount', () => {
    const { result, unmount } = renderHook(() => useAbortControllers())
    const first = result.current.nextController('load')
    const second = result.current.nextController('save')
    unmount()
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(true)
  })
})
