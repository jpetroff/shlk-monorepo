import config from './config'
import {
  isSuccessfulSnoozeResponse,
  pingRequest,
  scheduleRequest,
  type SnoozeMessage,
  type SnoozeMessageResponse,
  type SnoozeScheduleItem
} from './snooze.protocol'

export type ExtensionAlarm = chrome.alarms.Alarm
export type ExtensionAlarmCreateInfo = chrome.alarms.AlarmCreateInfo
export type ExtensionNotificationOptions = chrome.notifications.NotificationOptions
export type ExtensionMessageSender = chrome.runtime.MessageSender
export type TabObject = { id: number, url: string }

const MESSAGE_TIMEOUT_MS = 2_000

function chromeApi(): typeof chrome | undefined {
  return (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome
}

class BrowserApi {
  public readonly isInit = config.target === 'extension' && Boolean(chromeApi()?.runtime?.id)

  public async getTab(active?: boolean): Promise<TabObject | null> {
    const api = chromeApi()
    if (!this.isInit || !api?.tabs) return null
    const [tab] = await api.tabs.query({ active, lastFocusedWindow: true })
    return tab?.id != null && tab.url ? { id: tab.id, url: tab.url } : null
  }

  public async findTab(url: string): Promise<TabObject[]> {
    const api = chromeApi()
    if (!this.isInit || !api?.tabs) return []
    const tabs = await api.tabs.query({ url })
    return tabs.flatMap((tab) => tab.id != null && tab.url ? [{ id: tab.id, url: tab.url }] : [])
  }

  public async closeTab(tabId: number): Promise<void> {
    const api = chromeApi()
    if (!this.isInit || !api?.tabs) return
    await api.tabs.remove(tabId)
  }

  public async closeActiveTab(): Promise<void> {
    const tab = await this.getTab(true)
    if (tab) await this.closeTab(tab.id)
  }

  private sendRuntimeMessage(message: SnoozeMessage): Promise<SnoozeMessageResponse> {
    const api = chromeApi()
    if (!api?.runtime?.sendMessage) return Promise.reject(new Error('Chrome extension messaging is unavailable'))
    if (config.target !== 'extension' && !config.extensionId) {
      return Promise.reject(new Error('The Chrome extension ID is not configured'))
    }

    return new Promise((resolve, reject) => {
      let settled = false
      const timeout = globalThis.setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('The Chrome extension did not respond'))
      }, MESSAGE_TIMEOUT_MS)
      const finish = (response?: unknown) => {
        if (settled) return
        settled = true
        globalThis.clearTimeout(timeout)
        const runtimeError = (api.runtime as typeof api.runtime & { lastError?: { message?: string } }).lastError
        if (runtimeError) { reject(new Error(runtimeError.message || 'Chrome extension messaging failed')); return }
        if (!isSuccessfulSnoozeResponse(response)) {
          const error = response && typeof response === 'object' && 'error' in response
            ? String(response.error) : 'The Chrome extension is incompatible'
          reject(new Error(error))
          return
        }
        resolve(response)
      }
      try {
        const sendMessage = api.runtime.sendMessage as unknown as {
          (message: unknown, callback: (response?: unknown) => void): void
          (extensionId: string, message: unknown, callback: (response?: unknown) => void): void
        }
        if (config.target === 'extension') Reflect.apply(sendMessage, api.runtime, [message, finish])
        else Reflect.apply(sendMessage, api.runtime, [config.extensionId, message, finish])
      } catch (error) {
        if (!settled) {
          settled = true
          globalThis.clearTimeout(timeout)
          reject(error)
        }
      }
    })
  }

  public async probeSnoozeExtension(): Promise<boolean> {
    if (config.target === 'extension') return this.isInit
    try {
      await this.sendRuntimeMessage(pingRequest())
      return true
    } catch {
      return false
    }
  }

  public scheduleSnooze(item: SnoozeScheduleItem): Promise<SnoozeMessageResponse> {
    return this.sendRuntimeMessage(scheduleRequest(item))
  }

  public onMessage(callback: Parameters<typeof chrome.runtime.onMessage.addListener>[0]): void {
    chromeApi()?.runtime?.onMessage?.addListener(callback)
  }

  public onMessageExternal(callback: Parameters<typeof chrome.runtime.onMessageExternal.addListener>[0]): void {
    chromeApi()?.runtime?.onMessageExternal?.addListener(callback)
  }

  public openExternal(url: string): Promise<chrome.tabs.Tab | undefined> {
    const api = chromeApi()
    if (!this.isInit || !api?.tabs) return Promise.resolve(undefined)
    return api.tabs.create({ url })
  }

  public setAlarm(name: string, alarm: ExtensionAlarmCreateInfo): Promise<void> {
    const api = chromeApi()
    if (!this.isInit || !api?.alarms) return Promise.resolve()
    return api.alarms.create(name, alarm)
  }

  public onAlarm(callback: (alarm: ExtensionAlarm) => void): void {
    chromeApi()?.alarms?.onAlarm.addListener(callback)
  }

  public onInstalled(callback: Parameters<typeof chrome.runtime.onInstalled.addListener>[0]): void {
    chromeApi()?.runtime?.onInstalled.addListener(callback)
  }

  public onStartup(callback: () => void): void {
    chromeApi()?.runtime?.onStartup.addListener(callback)
  }

  public getAlarms(): Promise<ExtensionAlarm[]> {
    return chromeApi()?.alarms?.getAll() ?? Promise.resolve([])
  }

  public removeAlarm(name: string): Promise<boolean> {
    return chromeApi()?.alarms?.clear(name) ?? Promise.resolve(false)
  }

  public createNotification(options: ExtensionNotificationOptions, id?: string): Promise<string | undefined> {
    const api = chromeApi()
    if (!this.isInit || !api?.notifications) return Promise.resolve(undefined)
    return id ? api.notifications.create(id, options) : api.notifications.create(options)
  }

  public onNotificationClick(callback: (id: string) => void): void {
    chromeApi()?.notifications?.onClicked.addListener(callback)
  }
}

export default new BrowserApi()
