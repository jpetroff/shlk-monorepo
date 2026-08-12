import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stored: undefined as unknown,
  setAlarm: vi.fn(),
  removeAlarm: vi.fn(),
  getAlarms: vi.fn(),
  openExternal: vi.fn(),
  createNotification: vi.fn(),
  onInstalled: vi.fn(),
  onStartup: vi.fn(),
  onAlarm: vi.fn(),
  onMessage: vi.fn(),
  onMessageExternal: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  getAllItems: vi.fn(),
  removeAllItems: vi.fn()
}))

vi.mock('../src/js/config', () => ({ default: {
  apiBaseUrl: 'https://shlk.example',
  webAppOrigin: 'https://shlk.example'
} }))
vi.mock('../src/js/browser.api', () => ({ default: {
  setAlarm: mocks.setAlarm,
  removeAlarm: mocks.removeAlarm,
  getAlarms: mocks.getAlarms,
  openExternal: mocks.openExternal,
  createNotification: mocks.createNotification,
  onInstalled: mocks.onInstalled,
  onStartup: mocks.onStartup,
  onAlarm: mocks.onAlarm,
  onMessage: mocks.onMessage,
  onMessageExternal: mocks.onMessageExternal
} }))
vi.mock('../src/js/proxy-storage.extension', () => ({
  StorageType: { local: 'local', sync: 'sync' },
  default: {
    getItem: mocks.getItem, setItem: mocks.setItem,
    getAllItems: mocks.getAllItems, removeAllItems: mocks.removeAllItems
  }
}))

import { AppNetwork, BackgroundApp, NEXT_WAKE_ALARM } from '../src/js/background'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.stored = { items: {}, pendingClear: {} }
  mocks.getItem.mockImplementation(async () => structuredClone(mocks.stored))
  mocks.setItem.mockImplementation(async (_key: string, value: unknown) => { mocks.stored = structuredClone(value) })
  mocks.setAlarm.mockResolvedValue(undefined)
  mocks.removeAlarm.mockResolvedValue(true)
  mocks.getAlarms.mockResolvedValue([])
  mocks.openExternal.mockResolvedValue({ id: 1 })
  mocks.createNotification.mockResolvedValue('notice')
  mocks.getAllItems.mockResolvedValue({})
  mocks.removeAllItems.mockResolvedValue(undefined)
  BackgroundApp.operation = Promise.resolve()
})

describe('background snooze scheduler', () => {
  test('migrates valid legacy sync records without overwriting new local state', async () => {
    mocks.stored = { items: {
      current: { id: 'current', location: 'https://current.example', awake: 30_000 }
    }, pendingClear: {} }
    mocks.getAllItems.mockResolvedValue({
      link_legacy: {
        _id: 'legacy', location: 'https://legacy.example', siteTitle: 'Legacy',
        snooze: { awake: 20_000 }
      },
      unrelated: { keep: true }
    })

    await BackgroundApp.migrateLegacyStorage()

    expect(mocks.stored).toMatchObject({ items: {
      current: expect.any(Object),
      legacy: { id: 'legacy', location: 'https://legacy.example', awake: 20_000, siteTitle: 'Legacy' }
    } })
    expect(mocks.removeAllItems).toHaveBeenCalledWith(['link_legacy'], 'sync')
  })

  test('schedules the exact future timestamp and never schedules a past timestamp', async () => {
    await BackgroundApp.scheduleNext({
      items: { future: { id: 'future', location: 'https://example.com', awake: 20_000 } },
      pendingClear: {}
    }, 10_000)
    expect(mocks.setAlarm).toHaveBeenLastCalledWith(NEXT_WAKE_ALARM, { when: 20_000 })

    await BackgroundApp.scheduleNext({
      items: { late: { id: 'late', location: 'https://example.com', awake: 5_000 } },
      pendingClear: {}
    }, 10_000)
    expect(mocks.setAlarm).toHaveBeenLastCalledWith(NEXT_WAKE_ALARM, { when: 70_000 })
  })

  test('opens only due links and keeps failed tab creations for retry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000)
    mocks.stored = { items: {
      due: { id: 'due', location: 'https://due.example', awake: 9_000 },
      failed: { id: 'failed', location: 'https://failed.example', awake: 9_000 },
      future: { id: 'future', location: 'https://future.example', awake: 20_000 }
    }, pendingClear: {} }
    mocks.openExternal.mockImplementation(async (url: string) => {
      if (url.includes('failed')) throw new Error('tab create failed')
      return { id: 1 }
    })
    vi.spyOn(AppNetwork, 'clearShortlinks').mockResolvedValue(undefined)

    await BackgroundApp.processDue()

    expect(mocks.openExternal).toHaveBeenCalledTimes(2)
    expect(mocks.stored).toMatchObject({ items: {
      failed: expect.any(Object), future: expect.any(Object)
    }, pendingClear: {} })
    expect(mocks.setAlarm).toHaveBeenLastCalledWith(NEXT_WAKE_ALARM, { when: 70_000 })
  })

  test('does not reopen successfully created tabs when API cleanup fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000)
    mocks.stored = { items: {
      due: { id: 'due', location: 'https://due.example', awake: 9_000 }
    }, pendingClear: {} }
    vi.spyOn(AppNetwork, 'clearShortlinks').mockRejectedValue(new Error('offline'))

    await BackgroundApp.processDue()
    await BackgroundApp.processDue()

    expect(mocks.openExternal).toHaveBeenCalledOnce()
    expect(mocks.stored).toMatchObject({ items: {}, pendingClear: { due: true } })
  })

  test('rejects external messages from any origin except the configured website', () => {
    const respond = vi.fn()
    const keepChannel = BackgroundApp.handleExternalMessage(
      { type: 'shlk:ping', protocol: 1 },
      { origin: 'https://attacker.example' } as chrome.runtime.MessageSender,
      respond
    )
    expect(keepChannel).toBe(false)
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'Untrusted website origin' }))
  })
})
