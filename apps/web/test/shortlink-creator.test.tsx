import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortlinkCreator } from '../src/apps/ShortlinkBar/use-shortlink-creator'
import { createTestAppContext, TestAppContext } from './context-test-helpers'
import type { AppContextT } from '../src/js/app.context'

const mocks = vi.hoisted(() => ({
  createShortlink: vi.fn(),
  createShortlinkDescriptor: vi.fn(),
  createTimer: vi.fn(),
  checkShortlink: vi.fn(),
  setStorage: vi.fn(),
  awaitStorage: vi.fn(),
  storeShortlink: vi.fn(),
  closeActiveTab: vi.fn(),
  sendMessage: vi.fn()
}))

vi.mock('../src/js/shortlink.gql', () => ({
  default: {
    createShortlink: mocks.createShortlink,
    createShortlinkDescriptor: mocks.createShortlinkDescriptor,
    createOrUpdateShortlinkTimer: mocks.createTimer
  }
}))

vi.mock('../src/js/cache', () => ({
  default: {
    checkShortlink: mocks.checkShortlink,
    setStorage: mocks.setStorage,
    awaitStorage: mocks.awaitStorage,
    storeShortlink: mocks.storeShortlink
  }
}))

vi.mock('../src/js/browser.api', () => ({
  default: {
    isInit: false,
    closeActiveTab: mocks.closeActiveTab,
    sendMessage: mocks.sendMessage
  }
}))
let testContext: AppContextT

function ContextWrapper({ children }: React.PropsWithChildren) {
  return <TestAppContext value={testContext}>{children}</TestAppContext>
}

function StrictContextWrapper({ children }: React.PropsWithChildren) {
  return <React.StrictMode><ContextWrapper>{children}</ContextWrapper></React.StrictMode>
}


beforeEach(() => {
  testContext = createTestAppContext()
  vi.clearAllMocks()
  mocks.setStorage.mockResolvedValue(undefined)
  mocks.awaitStorage.mockResolvedValue([])
  mocks.checkShortlink.mockReturnValue(null)
})

describe('useShortlinkCreator', () => {
  it('returns the submitted network result and persists that exact document', async () => {
    mocks.createShortlink.mockResolvedValue({
      _id: 'one', location: 'https://example.com', hash: 'abc123'
    })
    const { result } = renderHook(() => useShortlinkCreator('', 'alex', 3), { wrapper: StrictContextWrapper })
    let returned: string | undefined
    await act(async () => {
      returned = await result.current.submitLocation('example.com')
    })
    expect(returned).toMatch(/\/abc123$/)
    expect(mocks.createShortlink).toHaveBeenCalledWith('https://example.com', expect.any(AbortSignal))
    expect(mocks.storeShortlink).toHaveBeenCalledWith({
      location: 'https://example.com', hash: 'abc123', descriptor: undefined
    })
    expect(result.current.state.result?.hash).toBe('abc123')
  })

  it('reports an invalid URL through app context instead of rejecting the event handler', async () => {
    const { result } = renderHook(() => useShortlinkCreator('', 'alex', 3), { wrapper: ContextWrapper })

    let returned: string | undefined
    await act(async () => {
      returned = await result.current.submitLocation('not a valid URL ???')
    })

    expect(returned).toBeUndefined()
    expect(testContext.reportError).toHaveBeenCalledWith(expect.objectContaining({
      name: 'AppError', code: 'INVALID_URL'
    }))
    expect(result.current.state.createPhase).toBe('error')
    expect(mocks.createShortlink).not.toHaveBeenCalled()
  })

  it('uses a cached result without issuing a network request', async () => {
    mocks.checkShortlink.mockReturnValue({ location: 'https://cached.example', hash: 'cached' })
    const { result } = renderHook(() => useShortlinkCreator('', 'alex', 3), { wrapper: ContextWrapper })
    let returned: string | undefined
    await act(async () => {
      returned = await result.current.submitLocation('https://cached.example')
    })
    expect(returned).toMatch(/\/cached$/)
    expect(mocks.createShortlink).not.toHaveBeenCalled()
    expect(mocks.storeShortlink).not.toHaveBeenCalled()
    expect(result.current.state.result?.location).toBe('https://cached.example')
  })

  it('aborts a superseded create and ignores its late response', async () => {
    let resolveFirst!: (value: ShortlinkDocument) => void
    let resolveSecond!: (value: ShortlinkDocument) => void
    const signals: AbortSignal[] = []
    mocks.createShortlink.mockImplementation((_location: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<ShortlinkDocument>((resolve) => {
        if (signals.length === 1) resolveFirst = resolve
        else resolveSecond = resolve
      })
    })
    const { result } = renderHook(() => useShortlinkCreator('', 'alex', 3), { wrapper: ContextWrapper })
    let first!: Promise<string | undefined>
    let second!: Promise<string | undefined>
    await act(async () => {
      first = result.current.submitLocation('first.example')
      await Promise.resolve()
    })
    await act(async () => {
      second = result.current.submitLocation('second.example')
      await Promise.resolve()
    })
    expect(signals[0].aborted).toBe(true)
    act(() => resolveSecond({ _id: 'two', location: 'https://second.example', hash: 'second' }))
    await act(async () => { await second })
    act(() => resolveFirst({ _id: 'one', location: 'https://first.example', hash: 'first' }))
    await act(async () => { await first })
    expect(result.current.state.result).toMatchObject({ location: 'https://second.example', hash: 'second' })
    expect(mocks.storeShortlink).toHaveBeenCalledTimes(1)
  })

  it('rejects an obsolete descriptor response after the descriptor changes', async () => {
    vi.useFakeTimers()
    mocks.createShortlink.mockResolvedValue({ _id: 'one', location: 'https://example.com', hash: 'one' })
    const descriptorResolvers: Array<(value: ShortlinkDocument) => void> = []
    mocks.createShortlinkDescriptor.mockImplementation(() => new Promise<ShortlinkDocument>((resolve) => {
      descriptorResolvers.push(resolve)
    }))
    const { result } = renderHook(() => useShortlinkCreator('', 'alex', 3), { wrapper: ContextWrapper })
    await act(async () => { await result.current.submitLocation('example.com') })
    act(() => result.current.dispatch({ type: 'descriptor', value: 'first' }))
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve() })
    expect(mocks.createShortlinkDescriptor).toHaveBeenCalledTimes(1)
    act(() => result.current.dispatch({ type: 'descriptor', value: 'second' }))
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve() })
    expect(mocks.createShortlinkDescriptor).toHaveBeenCalledTimes(2)
    act(() => descriptorResolvers[1]({ _id: 'one', location: 'https://example.com', hash: 'one',
      descriptor: { userTag: 'alex', descriptionTag: 'second' } }))
    await act(async () => { await Promise.resolve() })
    act(() => descriptorResolvers[0]({ _id: 'one', location: 'https://example.com', hash: 'one',
      descriptor: { userTag: 'alex', descriptionTag: 'first' } }))
    await act(async () => { await Promise.resolve() })
    expect(result.current.state.result?.descriptor?.descriptionTag).toBe('second')
    vi.useRealTimers()
  })
})
