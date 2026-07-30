import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShortlinkListSubsection, useShortlinkList } from '../src/apps/ShortlinkList'

const getUserShortlinks = vi.hoisted(() => vi.fn())

vi.mock('../src/js/shortlink.gql', () => ({
  default: { getUserShortlinks }
}))

const first: ShortlinkDocument = { _id: 'one', hash: '1', location: 'https://one.example' }
const second: ShortlinkDocument = { _id: 'two', hash: '2', location: 'https://two.example' }
const third: ShortlinkDocument = { _id: 'three', hash: '3', location: 'https://three.example' }

beforeEach(() => {
  getUserShortlinks.mockReset()
  document.cookie = 'content-display=; Max-Age=0; path=/'
})

describe('useShortlinkList', () => {
  it('loads pages independently and stops appending after a short page', async () => {
    getUserShortlinks
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([third])
    const { result } = renderHook(() => useShortlinkList(2, ShortlinkListSubsection.all))
    await waitFor(() => expect(result.current.state.shortlinks).toHaveLength(2))
    expect(result.current.state.hasMore).toBe(true)
    act(() => result.current.append())
    await waitFor(() => expect(result.current.state.shortlinks).toHaveLength(3))
    expect(getUserShortlinks.mock.calls[1][0]).toMatchObject({ skip: 2, limit: 2 })
    expect(result.current.state.hasMore).toBe(false)
    act(() => result.current.append())
    expect(getUserShortlinks).toHaveBeenCalledTimes(2)
  })

  it('debounces search and replaces the current page with matching results', async () => {
    getUserShortlinks
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second])
    const { result } = renderHook(() => useShortlinkList(30, ShortlinkListSubsection.all))
    await waitFor(() => expect(result.current.state.shortlinks).toEqual([first]))
    act(() => result.current.dispatch({ type: 'search', value: 'two' }))
    expect(getUserShortlinks).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getUserShortlinks).toHaveBeenCalledTimes(2))
    expect(getUserShortlinks.mock.calls[1][0]).toMatchObject({ search: 'two', skip: 0, limit: 30 })
    await waitFor(() => expect(result.current.state.shortlinks).toEqual([second]))
  })

  it('aborts the previous route request and ignores its late response', async () => {
    let resolveFirst!: (value: ShortlinkDocument[]) => void
    let resolveSecond!: (value: ShortlinkDocument[]) => void
    const signals: AbortSignal[] = []
    getUserShortlinks.mockImplementation((_params: QICommon, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<ShortlinkDocument[]>((resolve) => {
        if (signals.length === 1) resolveFirst = resolve
        else resolveSecond = resolve
      })
    })
    const { result, rerender } = renderHook(
      ({ subsection }) => useShortlinkList(30, subsection),
      { initialProps: { subsection: ShortlinkListSubsection.all } }
    )
    await waitFor(() => expect(getUserShortlinks).toHaveBeenCalledOnce())
    rerender({ subsection: ShortlinkListSubsection.snoozed })
    await waitFor(() => expect(getUserShortlinks).toHaveBeenCalledTimes(2))
    expect(signals[0].aborted).toBe(true)
    expect(getUserShortlinks.mock.calls[1][0]).toMatchObject({ isSnooze: true, sort: 'snooze.awake' })
    act(() => resolveSecond([second]))
    await waitFor(() => expect(result.current.state.shortlinks).toEqual([second]))
    act(() => resolveFirst([first]))
    await Promise.resolve()
    expect(result.current.state.shortlinks).toEqual([second])
  })

  it('exposes a recoverable error and retries replacement loading', async () => {
    getUserShortlinks
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([first])
    const { result } = renderHook(() => useShortlinkList(30, ShortlinkListSubsection.all))
    await waitFor(() => expect(result.current.state.error).toBe('offline'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.state.shortlinks).toEqual([first]))
    expect(result.current.state.error).toBeNull()
  })
})
