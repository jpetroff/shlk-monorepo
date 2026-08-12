import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../src/js/config', () => ({ default: {
  target: 'webapp',
  extensionId: 'bjkhbppdemdfngnceocjmeapcfckfkok'
} }))

function setChrome(runtime?: AnyObject) {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: runtime ? { runtime } : undefined
  })
}

beforeEach(() => {
  vi.resetModules()
  setChrome(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  setChrome(undefined)
})

describe('website extension bridge', () => {
  test('detects a compatible extension through a versioned acknowledgement', async () => {
    const sendMessage = vi.fn((_id: string, _message: unknown, callback: (response: unknown) => void) => {
      callback({ ok: true, protocol: 1 })
    })
    setChrome({ sendMessage })
    const browserApi = (await import('../src/js/browser.api')).default

    await expect(browserApi.probeSnoozeExtension()).resolves.toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(
      'bjkhbppdemdfngnceocjmeapcfckfkok',
      { type: 'shlk:ping', protocol: 1 },
      expect.any(Function)
    )
  })

  test('treats missing APIs and incompatible responses as unavailable', async () => {
    let browserApi = (await import('../src/js/browser.api')).default
    await expect(browserApi.probeSnoozeExtension()).resolves.toBe(false)

    vi.resetModules()
    setChrome({ sendMessage: vi.fn((_id: string, _message: unknown, callback: (response: unknown) => void) => {
      callback({ ok: true, protocol: 2 })
    }) })
    browserApi = (await import('../src/js/browser.api')).default
    await expect(browserApi.probeSnoozeExtension()).resolves.toBe(false)
  })

  test('times out a service worker that does not acknowledge the request', async () => {
    vi.useFakeTimers()
    setChrome({ sendMessage: vi.fn() })
    const browserApi = (await import('../src/js/browser.api')).default
    const probe = browserApi.probeSnoozeExtension()
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(probe).resolves.toBe(false)
  })
})
