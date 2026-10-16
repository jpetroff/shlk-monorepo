import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getExtensionApi, isTrustedExtensionSender } from '../src/js/extension.api'
import proxyStorage from '../src/js/proxy-storage.extension'

const config = vi.hoisted(() => ({ target: 'extension', extensionId: 'chrome-id', webAppOrigin: window.location.origin }))
vi.mock('../src/js/config', () => ({ default: config }))
const success = { ok: true, protocol: 1 }
function api(scheme = 'moz-extension:') {
  return {
    runtime: {
      id: 'shlk@shlk.cc', getURL: (path: string) => `${scheme}//installation-id/${path}`,
      sendMessage: vi.fn().mockResolvedValue(success)
    },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]), remove: vi.fn().mockResolvedValue(undefined) },
    alarms: { create: vi.fn(), getAll: vi.fn().mockResolvedValue([]) },
    notifications: { create: vi.fn().mockResolvedValue('notice') },
    storage: { local: { get: vi.fn().mockResolvedValue({ key: 'value' }), set: vi.fn().mockResolvedValue(undefined) }, sync: {} }
  }
}
beforeEach(() => {
  vi.resetModules()
  config.target = 'extension'
  vi.stubGlobal('browser', undefined)
  vi.stubGlobal('chrome', undefined)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('shared extension adapter', () => {
  test.each(['firefox', 'chrome'])('uses %s APIs for tabs, storage, alarms and messaging', async (browser) => {
    const native = api(browser === 'firefox' ? 'moz-extension:' : 'chrome-extension:')
    vi.stubGlobal(browser === 'firefox' ? 'browser' : 'chrome', native)
    const adapter = (await import('../src/js/browser.api')).default
    expect(adapter.isInit).toBe(true)
    await expect(adapter.getTab(true)).resolves.toEqual({ id: 1, url: 'https://example.com' })
    await expect(proxyStorage.getItem('key', 'local')).resolves.toBe('value')
    await expect(adapter.setAlarm('wake', { when: 100 })).resolves.toBeUndefined()
    await expect(adapter.scheduleSnooze({ id: 'x', location: 'https://example.com', awake: 100 })).resolves.toEqual(success)
  })

  test('handles storage/API absence and preserves native storage errors', async () => {
    expect(getExtensionApi()).toBeUndefined()
    expect(proxyStorage.canUse()).toBe(false)
    await expect(proxyStorage.getItem('key')).rejects.toThrow('unavailable')
    const native = api()
    native.storage.local.get.mockRejectedValue(new Error('storage failed'))
    vi.stubGlobal('browser', native)
    await expect(proxyStorage.getItem('key', 'local')).rejects.toThrow('storage failed')
  })

  test.each(['firefox', 'chrome'])('filters notification priority only for Firefox (%s)', async (browser) => {
    const native = api(browser === 'firefox' ? 'moz-extension:' : 'chrome-extension:')
    vi.stubGlobal(browser === 'firefox' ? 'browser' : 'chrome', native)
    const adapter = (await import('../src/js/browser.api')).default
    await adapter.createNotification({ type: 'basic', title: 'Wake up', message: 'Tab restored', iconUrl: '/icon.png', priority: 1 }, 'notice')
    const options = native.notifications.create.mock.calls[0][1]
    expect(options.priority).toBe(browser === 'firefox' ? undefined : 1)
  })

  test('trusts only this extension and top-frame messages from the configured website', () => {
    vi.stubGlobal('browser', api())
    const origin = 'https://shlk.example:8443'
    const sender = { id: 'shlk@shlk.cc', url: origin + '/app', tab: { id: 1 }, frameId: 0 }
    expect(isTrustedExtensionSender(sender, origin)).toBe(true)
    expect(isTrustedExtensionSender({ ...sender, id: 'other' }, origin)).toBe(false)
    expect(isTrustedExtensionSender({ ...sender, frameId: 1 }, origin)).toBe(false)
    expect(isTrustedExtensionSender({ ...sender, url: 'https://shlk.example/app', origin }, origin)).toBe(false)
    expect(isTrustedExtensionSender({ ...sender, url: undefined, origin }, origin)).toBe(false)
    expect(isTrustedExtensionSender({ id: sender.id, url: 'moz-extension://installation-id/index.html' }, origin)).toBe(true)
    expect(isTrustedExtensionSender({ id: sender.id, url: 'moz-extension://other/index.html' }, origin)).toBe(false)
  })

  test('does not resend a website schedule through the bridge after Chrome times out', async () => {
    vi.useFakeTimers()
    config.target = 'webapp'
    const sendMessage = vi.fn((_id, _message, respond) => respond(success))
    vi.stubGlobal('chrome', { runtime: { sendMessage } })
    const post = vi.spyOn(window, 'postMessage')
    const adapter = (await import('../src/js/browser.api')).default
    await expect(adapter.probeSnoozeExtension()).resolves.toBe(true)
    sendMessage.mockImplementation(() => {})
    const scheduled = adapter.scheduleSnooze({ id: 'x', location: 'https://example.com', awake: 100 })
    const rejected = expect(scheduled).rejects.toThrow('did not respond')
    await vi.advanceTimersByTimeAsync(2000)
    await rejected
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(post).not.toHaveBeenCalled()
  })
})
