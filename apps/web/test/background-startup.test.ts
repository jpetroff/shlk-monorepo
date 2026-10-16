import { afterEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onInstalled: vi.fn(), onStartup: vi.fn(), onAlarm: vi.fn(), onMessage: vi.fn(), onMessageExternal: vi.fn(),
  setAlarm: vi.fn(), getAlarms: vi.fn().mockResolvedValue([]), removeAlarm: vi.fn(),
  getItem: vi.fn().mockResolvedValue({ items: { future: { id: 'future', location: 'https://example.com', awake: 4102444800000 } }, pendingClear: {} }),
  getAllItems: vi.fn().mockResolvedValue({}), setItem: vi.fn(), removeAllItems: vi.fn()
}))
vi.mock('../src/js/config', () => ({ default: { apiBaseUrl: 'https://api.example', webAppOrigin: 'https://shlk.example' } }))
vi.mock('../src/js/browser.api', () => ({ default: { isInit: true, ...mocks } }))
vi.mock('../src/js/proxy-storage.extension', () => ({ default: mocks, StorageType: { local: 'local', sync: 'sync' } }))
afterEach(() => vi.unstubAllGlobals())

test('registers listeners before work and initializes once per recreated background context', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  const first = await import('../src/js/background')
  await first.initializeBackground()
  mocks.onInstalled.mock.calls[0][0]()
  mocks.onStartup.mock.calls[0][0]()
  await first.initializeBackground()
  expect(mocks.getAllItems).toHaveBeenCalledTimes(1)
  expect(mocks.onMessage.mock.invocationCallOrder[0]).toBeLessThan(mocks.getAllItems.mock.invocationCallOrder[0])
  expect(mocks.setAlarm).toHaveBeenCalledWith('shlk:next-wake', { when: 4102444800000 })
  vi.resetModules()
  const recreated = await import('../src/js/background')
  await recreated.initializeBackground()
  expect(mocks.getAllItems).toHaveBeenCalledTimes(2)
})
