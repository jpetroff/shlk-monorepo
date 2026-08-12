import config from './config'
import browserApi, { type ExtensionAlarm, type ExtensionMessageSender } from './browser.api'
import proxyStorage, { StorageType } from './proxy-storage.extension'
import {
  isSnoozeMessage,
  isSnoozeScheduleItem,
  SNOOZE_PROTOCOL_VERSION,
  type SnoozeMessageResponse,
  type SnoozeScheduleItem
} from './snooze.protocol'

export const NEXT_WAKE_ALARM = 'shlk:next-wake'
export const SYNC_ALARM = 'shlk:sync'
export const SNOOZE_STATE_KEY = 'shlk:snooze-state'
const SYNC_PERIOD_MINUTES = 10
const RETRY_DELAY_MS = 60_000
const PAGE_SIZE = 100

type SnoozeState = {
  items: Record<string, SnoozeScheduleItem>
  pendingClear: Record<string, true>
}

type GraphQLResult<T> = { data?: T, errors?: Array<{ message?: string }> }

function messageResponse(ok: boolean, error?: string): SnoozeMessageResponse {
  return { ok, protocol: SNOOZE_PROTOCOL_VERSION, ...(error ? { error } : {}) }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The snooze request failed'
}

export const AppNetwork = {
  async request<T>(query: string, variables?: AnyObject): Promise<T> {
    const response = await fetch(`${config.apiBaseUrl}/api`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    if (!response.ok) throw new Error(`Snooze API returned ${response.status}`)
    const body = await response.json() as GraphQLResult<T>
    if (body.errors?.length) throw new Error(body.errors[0].message || 'Snooze API request failed')
    if (!body.data) throw new Error('Snooze API returned no data')
    return body.data
  },

  async getShortlinks(): Promise<SnoozeScheduleItem[]> {
    const result: SnoozeScheduleItem[] = []
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const data = await AppNetwork.request<{ getUserShortlinks: ShortlinkDocument[] }>(`
        query SnoozedLinks($limit: Int, $skip: Int) {
          getUserShortlinks(args: {isSnooze: true, sort: "snooze.awake", order: "1", limit: $limit, skip: $skip}) {
            _id location siteTitle snooze { awake }
          }
        }
      `, { limit: PAGE_SIZE, skip })
      const documents = data.getUserShortlinks ?? []
      const page = documents.flatMap((shortlink) => shortlink.snooze ? [{
        id: shortlink._id,
        location: shortlink.location,
        awake: shortlink.snooze.awake,
        ...(shortlink.siteTitle ? { siteTitle: shortlink.siteTitle } : {})
      }] : [])
      result.push(...page)
      if (documents.length < PAGE_SIZE) return result
    }
  },

  async clearShortlinks(ids: string[]): Promise<void> {
    if (!ids.length) return
    await AppNetwork.request<{ deleteShortlinkSnoozeTimer: Array<{ _id: string }> }>(`
      mutation ClearSnoozedLinks($ids: [String]) {
        deleteShortlinkSnoozeTimer(ids: $ids) { _id }
      }
    `, { ids })
  }
}

export const BackgroundApp = {
  operation: Promise.resolve() as Promise<unknown>,

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = BackgroundApp.operation.then(task, task)
    BackgroundApp.operation = result.catch(() => undefined)
    return result
  },

  async readState(): Promise<SnoozeState> {
    const value = await proxyStorage.getItem(SNOOZE_STATE_KEY, StorageType.local) as Partial<SnoozeState> | undefined
    return {
      items: value?.items && typeof value.items === 'object' ? value.items : {},
      pendingClear: value?.pendingClear && typeof value.pendingClear === 'object' ? value.pendingClear : {}
    }
  },

  writeState(state: SnoozeState): Promise<void> {
    return proxyStorage.setItem(SNOOZE_STATE_KEY, state, StorageType.local)
  },

  async migrateLegacyStorage(): Promise<void> {
    const legacy = await proxyStorage.getAllItems(null, StorageType.sync) as Record<string, unknown>
    const keys = Object.keys(legacy).filter((key) => key.startsWith('link_'))
    if (!keys.length) return
    const state = await BackgroundApp.readState()
    for (const key of keys) {
      const value = legacy[key] as {
        _id?: unknown, location?: unknown, siteTitle?: unknown, snooze?: { awake?: unknown }
      } | undefined
      const item = {
        id: typeof value?._id === 'string' ? value._id : key.slice('link_'.length),
        location: value?.location,
        awake: value?.snooze?.awake,
        ...(typeof value?.siteTitle === 'string' ? { siteTitle: value.siteTitle } : {})
      }
      if (isSnoozeScheduleItem(item) && !state.items[item.id]) state.items[item.id] = item
    }
    await BackgroundApp.writeState(state)
    await proxyStorage.removeAllItems(keys, StorageType.sync)
  },

  async scheduleNext(state: SnoozeState, now = Date.now()): Promise<void> {
    const next = Object.values(state.items).reduce<number | undefined>((earliest, item) => (
      earliest == null || item.awake < earliest ? item.awake : earliest
    ), undefined)
    if (next == null) {
      await browserApi.removeAlarm(NEXT_WAKE_ALARM)
      return
    }
    await browserApi.setAlarm(NEXT_WAKE_ALARM, { when: next <= now ? now + RETRY_DELAY_MS : next })
  },

  async ensureSyncAlarm(): Promise<void> {
    const alarms = await browserApi.getAlarms()
    if (!alarms.some((alarm) => alarm.name === SYNC_ALARM)) {
      await browserApi.setAlarm(SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: SYNC_PERIOD_MINUTES })
    }
  },

  async upsert(item: SnoozeScheduleItem): Promise<void> {
    const state = await BackgroundApp.readState()
    state.items[item.id] = item
    delete state.pendingClear[item.id]
    await BackgroundApp.writeState(state)
    if (item.awake <= Date.now()) await BackgroundApp.processDue(state)
    else await BackgroundApp.scheduleNext(state)
  },

  async flushPending(state: SnoozeState): Promise<void> {
    const ids = Object.keys(state.pendingClear)
    if (!ids.length) return
    await AppNetwork.clearShortlinks(ids)
    ids.forEach((id) => delete state.pendingClear[id])
    await BackgroundApp.writeState(state)
  },

  async reconcile(): Promise<void> {
    const state = await BackgroundApp.readState()
    try {
      await BackgroundApp.flushPending(state)
    } catch (error) {
      console.error('Could not clear restored snoozes', error)
    }
    const serverItems = await AppNetwork.getShortlinks()
    state.items = Object.fromEntries(serverItems
      .filter((item) => !state.pendingClear[item.id])
      .map((item) => [item.id, item]))
    await BackgroundApp.writeState(state)
    if (Object.values(state.items).some((item) => item.awake <= Date.now())) {
      await BackgroundApp.processDue(state)
    } else {
      await BackgroundApp.scheduleNext(state)
    }
  },

  async processDue(providedState?: SnoozeState): Promise<void> {
    const state = providedState ?? await BackgroundApp.readState()
    const now = Date.now()
    const due = Object.values(state.items).filter((item) => item.awake <= now)
    const opened: SnoozeScheduleItem[] = []

    for (const item of due) {
      try {
        await browserApi.openExternal(item.location)
        delete state.items[item.id]
        state.pendingClear[item.id] = true
        opened.push(item)
      } catch (error) {
        console.error(`Could not restore snoozed link ${item.id}`, error)
      }
    }

    await BackgroundApp.writeState(state)
    await BackgroundApp.scheduleNext(state, now)
    if (opened.length) {
      const first = opened[0]
      const suffix = opened.length > 1 ? ` and ${opened.length - 1} more` : ''
      await browserApi.createNotification({
        type: 'basic',
        title: `Shlk.cc woke up ${opened.length === 1 ? 'a tab' : `${opened.length} tabs`}`,
        message: `${first.siteTitle || first.location}${suffix}`,
        iconUrl: '/assets/favicon/android-chrome-192x192.png',
        priority: 1
      }, `snooze:${first.id}`)
      try {
        await BackgroundApp.flushPending(state)
      } catch (error) {
        console.error('Restored snoozes will be cleared on the next sync', error)
      }
    }
  },

  async initialize(): Promise<void> {
    await BackgroundApp.migrateLegacyStorage()
    await BackgroundApp.ensureSyncAlarm()
    const state = await BackgroundApp.readState()
    if (Object.values(state.items).some((item) => item.awake <= Date.now())) {
      await BackgroundApp.processDue(state)
    } else {
      await BackgroundApp.scheduleNext(state)
    }
    try {
      await BackgroundApp.reconcile()
    } catch (error) {
      console.error('Could not reconcile snoozed links', error)
    }
  },

  handleAlarm(alarm: ExtensionAlarm): void {
    if (alarm.name === NEXT_WAKE_ALARM) {
      void BackgroundApp.run(() => BackgroundApp.processDue()).catch(console.error)
    } else if (alarm.name === SYNC_ALARM) {
      void BackgroundApp.run(() => BackgroundApp.reconcile()).catch((error) => {
        console.error('Could not reconcile snoozed links', error)
      })
    }
  },

  handleMessage(message: unknown, _sender: ExtensionMessageSender, sendResponse: (response: SnoozeMessageResponse) => void): boolean {
    if (!isSnoozeMessage(message)) {
      sendResponse(messageResponse(false, 'Unsupported snooze message'))
      return false
    }
    if (message.type === 'shlk:ping') {
      sendResponse(messageResponse(true))
      return false
    }
    void BackgroundApp.run(() => BackgroundApp.upsert(message.item))
      .then(() => sendResponse(messageResponse(true)))
      .catch((error) => sendResponse(messageResponse(false, errorMessage(error))))
    return true
  },

  handleExternalMessage(message: unknown, sender: ExtensionMessageSender, sendResponse: (response: SnoozeMessageResponse) => void): boolean {
    if (!config.webAppOrigin || sender.origin !== config.webAppOrigin) {
      sendResponse(messageResponse(false, 'Untrusted website origin'))
      return false
    }
    return BackgroundApp.handleMessage(message, sender, sendResponse)
  }
}

browserApi.onInstalled(() => {
  void BackgroundApp.run(() => BackgroundApp.initialize()).catch(console.error)
})
browserApi.onStartup(() => {
  void BackgroundApp.run(() => BackgroundApp.initialize()).catch(console.error)
})
browserApi.onAlarm(BackgroundApp.handleAlarm)
browserApi.onMessage(BackgroundApp.handleMessage)
browserApi.onMessageExternal(BackgroundApp.handleExternalMessage)
