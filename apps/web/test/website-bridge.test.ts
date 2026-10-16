import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installWebsiteBridge } from '../src/js/website-content-script'
import { BRIDGE_CHANNEL, sendWebsiteBridgeMessage } from '../src/js/website-bridge'
import { pingRequest, scheduleRequest } from '../src/js/snooze.protocol'

const origin = window.location.origin
const success = { ok: true, protocol: 1 }
const sendMessage = vi.fn()
let cleanup = () => {}
function dispatch(data: unknown, eventOrigin = origin, source: MessageEventSource | null = window) {
  window.dispatchEvent(new MessageEvent('message', { data, origin: eventOrigin, source }))
}
function request(requestId = 'request-1', message: unknown = pingRequest()) {
  return { channel: BRIDGE_CHANNEL, direction: 'request', requestId, message }
}

beforeEach(() => {
  vi.stubGlobal('browser', { runtime: { id: 'shlk@shlk.cc', sendMessage } })
  sendMessage.mockReset().mockResolvedValue(success)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Firefox website bridge', () => {
  test('relays ping and schedule with correlated concurrent responses', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation((data) => queueMicrotask(() => dispatch(data)))
    cleanup = installWebsiteBridge(origin)
    const schedule = scheduleRequest({ id: 'link-1', location: 'https://example.com', awake: 10000 })
    await expect(Promise.all([
      sendWebsiteBridgeMessage(pingRequest(), origin), sendWebsiteBridgeMessage(schedule, origin)
    ])).resolves.toEqual([success, success])
    expect(sendMessage).toHaveBeenCalledWith(schedule)
    const requests = post.mock.calls.map(([data]) => data).filter((data) => data.direction === 'request')
    expect(new Set(requests.map((data) => data.requestId)).size).toBe(2)
  })

  test('rejects wrong origins, ports, frames, invalid protocol and malformed payloads', async () => {
    cleanup = installWebsiteBridge(origin)
    dispatch(request(), 'https://attacker.example')
    dispatch(request(), `${origin}:9999`)
    dispatch(request(), origin, null)
    dispatch(request('bad-protocol', { type: 'shlk:ping', protocol: 2 }))
    dispatch(request('bad-url', scheduleRequest({ id: 'x', location: 'javascript:alert(1)', awake: 1 })))
    dispatch(request('bad-title', { type: 'shlk:schedule', protocol: 1, item: { id: 'x', location: 'https://example.com', awake: 1, siteTitle: {} } }))
    await Promise.resolve()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  test('does not activate on a different configured origin or in a child frame', () => {
    cleanup = installWebsiteBridge('https://different.example')
    dispatch(request())
    expect(sendMessage).not.toHaveBeenCalled()
    vi.stubGlobal('window', { location: { origin }, top: {} })
    expect(() => installWebsiteBridge(origin)()).not.toThrow()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  test('ignores duplicate in-flight requests and reports background failure', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    cleanup = installWebsiteBridge(origin)
    sendMessage.mockRejectedValue(new Error('background unavailable'))
    dispatch(request()); dispatch(request())
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-1', response: { ok: false, protocol: 1, error: 'background unavailable' }
    }), origin))
    expect(sendMessage).toHaveBeenCalledOnce()
  })

  test('ignores unrelated or forged replies and removes the listener on timeout', async () => {
    vi.useFakeTimers()
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    const remove = vi.spyOn(window, 'removeEventListener')
    const result = sendWebsiteBridgeMessage(pingRequest(), origin)
    const rejected = expect(result).rejects.toThrow('did not respond')
    const data = post.mock.calls[0][0]
    const response = { ...data, direction: 'response', response: success }
    dispatch(response, 'https://attacker.example')
    dispatch(response, origin, null)
    dispatch({ ...response, requestId: 'other' })
    await vi.advanceTimersByTimeAsync(2000)
    await rejected
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function))
  })

  test('rejects incompatible acknowledgements and cleans up on success or failure', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    const remove = vi.spyOn(window, 'removeEventListener')
    const result = sendWebsiteBridgeMessage(pingRequest(), origin)
    dispatch({ ...post.mock.calls[0][0], direction: 'response', response: { ok: true, protocol: 2 } })
    await expect(result).rejects.toThrow('incompatible')
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
