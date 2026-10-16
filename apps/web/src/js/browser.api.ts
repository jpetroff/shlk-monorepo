import config from './config'
import {
  pingRequest,
  scheduleRequest,
  type SnoozeMessage,
  type SnoozeMessageResponse,
  type SnoozeScheduleItem
} from './snooze.protocol'

import {
  getExtensionApi, isFirefoxExtension,
  type ExtensionAlarm, type ExtensionAlarmCreateInfo, type ExtensionNotificationOptions,
  type ExtensionTab, type MessageListener
} from './extension.api'
import { sendWebsiteBridgeMessage, validateSnoozeResponse, withMessageTimeout } from './website-bridge'
export type { ExtensionAlarm, ExtensionAlarmCreateInfo, ExtensionNotificationOptions, ExtensionMessageSender } from './extension.api'
export type TabObject = { id: number, url: string }

class BrowserApi {
  public readonly isInit = config.target === 'extension' && Boolean(getExtensionApi()?.runtime?.id)

  public async getTab(active?: boolean): Promise<TabObject | null> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.tabs) return null
    const [tab] = await api.tabs.query({ active, lastFocusedWindow: true })
    return tab?.id != null && tab.url ? { id: tab.id, url: tab.url } : null
  }

  public async findTab(url: string): Promise<TabObject[]> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.tabs) return []
    const tabs = await api.tabs.query({ url })
    return tabs.flatMap((tab) => tab.id != null && tab.url ? [{ id: tab.id, url: tab.url }] : [])
  }

  public async closeTab(tabId: number): Promise<void> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.tabs) return
    await api.tabs.remove(tabId)
  }

  public async closeActiveTab(): Promise<void> {
    const tab = await this.getTab(true)
    if (tab) await this.closeTab(tab.id)
  }

  private websiteTransport: 'chrome' | 'bridge' | undefined
  private probing: Promise<boolean> | undefined

  private sendChromeWebsiteMessage(message: SnoozeMessage): Promise<SnoozeMessageResponse> {
    // Website Chrome messaging is callback-based and requires the store item ID.
    const api = (globalThis as typeof globalThis & { chrome?: {
      runtime?: {
        lastError?: { message?: string }
        sendMessage(id: string, message: unknown, callback: (response: unknown) => void): void
      }
    } }).chrome
    if (!api?.runtime?.sendMessage || !config.extensionId) {
      return Promise.reject(new Error('Extension messaging is unavailable'))
    }
    const runtime = api.runtime
    return withMessageTimeout(() => new Promise<unknown>((resolve, reject) => {
      runtime.sendMessage(config.extensionId, message, (response: unknown) => {
        const error = runtime.lastError
        if (error) reject(new Error(error.message || 'Extension messaging failed'))
        else resolve(response)
      })
    })).then(validateSnoozeResponse)
  }

  private sendRuntimeMessage(message: SnoozeMessage): Promise<SnoozeMessageResponse> {
    if (config.target === 'extension') {
      const api = getExtensionApi()
      if (!this.isInit || !api) return Promise.reject(new Error('Extension messaging is unavailable'))
      return withMessageTimeout(() => api.runtime.sendMessage(message)).then(validateSnoozeResponse)
    }
    if (this.websiteTransport === 'chrome') return this.sendChromeWebsiteMessage(message)
    if (this.websiteTransport === 'bridge') return sendWebsiteBridgeMessage(message, config.webAppOrigin)
    return Promise.reject(new Error('The extension is unavailable; retry detection'))
  }

  public async probeSnoozeExtension(): Promise<boolean> {
    if (config.target === 'extension') return this.isInit
    if (this.probing) return this.probing
    this.probing = this.detectWebsiteTransport()
    try { return await this.probing } finally { this.probing = undefined }
  }

  private async detectWebsiteTransport(): Promise<boolean> {
    this.websiteTransport = undefined
    try {
      await this.sendChromeWebsiteMessage(pingRequest())
      this.websiteTransport = 'chrome'
      return true
    } catch {
      try {
        await sendWebsiteBridgeMessage(pingRequest(), config.webAppOrigin)
        this.websiteTransport = 'bridge'
        return true
      } catch {
        return false
      }
    }
  }

  public async scheduleSnooze(item: SnoozeScheduleItem): Promise<SnoozeMessageResponse> {
    if (config.target !== 'extension' && !this.websiteTransport) await this.probeSnoozeExtension()
    // Never fall back or resend a schedule after an ambiguous transport timeout.
    return this.sendRuntimeMessage(scheduleRequest(item))
  }

  public onMessage(callback: MessageListener): void {
    getExtensionApi()?.runtime?.onMessage?.addListener(callback)
  }

  public onMessageExternal(callback: MessageListener): void {
    getExtensionApi()?.runtime?.onMessageExternal?.addListener(callback)
  }

  public openExternal(url: string): Promise<ExtensionTab | undefined> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.tabs) return Promise.resolve(undefined)
    return api.tabs.create({ url })
  }

  public setAlarm(name: string, alarm: ExtensionAlarmCreateInfo): Promise<void> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.alarms) return Promise.resolve()
    return Promise.resolve(api.alarms.create(name, alarm))
  }

  public onAlarm(callback: (alarm: ExtensionAlarm) => void): void {
    getExtensionApi()?.alarms?.onAlarm.addListener(callback)
  }

  public onInstalled(callback: () => void): void {
    getExtensionApi()?.runtime?.onInstalled.addListener(callback)
  }

  public onStartup(callback: () => void): void {
    getExtensionApi()?.runtime?.onStartup.addListener(callback)
  }

  public getAlarms(): Promise<ExtensionAlarm[]> {
    return getExtensionApi()?.alarms?.getAll() ?? Promise.resolve([])
  }

  public removeAlarm(name: string): Promise<boolean> {
    return getExtensionApi()?.alarms?.clear(name) ?? Promise.resolve(false)
  }

  public createNotification(options: ExtensionNotificationOptions, id?: string): Promise<string | undefined> {
    const api = getExtensionApi()
    if (!this.isInit || !api?.notifications) return Promise.resolve(undefined)
    const { priority, ...basic } = options
    const supported = isFirefoxExtension() ? basic : { ...basic, ...(priority == null ? {} : { priority }) }
    return api.notifications.create(id ?? '', supported)
  }

  public onNotificationClick(callback: (id: string) => void): void {
    getExtensionApi()?.notifications?.onClicked.addListener(callback)
  }
}

export default new BrowserApi()
