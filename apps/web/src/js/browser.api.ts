import _ from 'underscore'
import config from './config'

export type ExtensionAlarm = chrome.alarms.Alarm
export type ExtensionAlarmCreateInfo = chrome.alarms.AlarmCreateInfo
export type ExtensionNotificationOptions = chrome.notifications.NotificationOptions
export type ExtensionMessageSender = chrome.runtime.MessageSender

export type TabObject = Partial<chrome.tabs.Tab>

class BrowserApi {
  public isInit : boolean

  constructor() {
    try {
      if(!chrome) {
        this.isInit = false
      } else {
        this.isInit = true	
      }
    } catch {
      this.isInit = false
    }
  }

  public async getTab(active?: boolean) : Promise<TabObject | null> {
    if(!this.isInit) return null
    const tabs = await chrome.tabs.query({active: active, lastFocusedWindow: true})
    const tab = tabs[0]
    if(tab && tab.url) {
      return {
        url: tab.url
      }
    }
    return null
  }

  public async findTab(url: string) : Promise<TabObject[]> {
    if(!this.isInit) return []
    return chrome.tabs.query({
      url
    })
  }

  public async closeActiveTab() : Promise<void> {
    if(!this.isInit) return
    const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true})
    const tabId = tabs[0]?.id
    if (tabId != null) await chrome.tabs.remove(tabId)
  }

  public extensionId() {
    return chrome.runtime.id
  }

  public async sendMessage(msg: AnyObject) : Promise<any> {
    await chrome.runtime.reload
    const response = await chrome.runtime.sendMessage(this.extensionId(), msg)
  }

  public addListener(callback: (command: string, tab?: chrome.tabs.Tab) => void ) : void {
    return chrome.commands.onCommand.addListener(callback)
  }

  public onMessage(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse?: () => void) => boolean ) {
    return chrome.runtime.onMessage.addListener(callback)
  }

  public openExternal(url: string) {
    if(!this.isInit) return
    chrome.tabs.create({ url })
  }

  public setAlarm(name: string, alarm: ExtensionAlarmCreateInfo) {
    if(!this.isInit) return
    chrome.alarms.create(name, alarm)
  }

  public onAlarm( callback: (alarm: ExtensionAlarm) => void ) {
    if(!this.isInit) return
    chrome.alarms.onAlarm.addListener(callback)
  }

  public onInstalled( callback: (details: {
      reason: chrome.runtime.OnInstalledReason;
      previousVersion?: string;
      id?: string;
  }) => void ) {
    if(!this.isInit) return null
    chrome.runtime.onInstalled.addListener(callback)
  }
  
  public onStartup( callback: () => void ) {
    if(!this.isInit) return void 0
    chrome.runtime.onStartup.addListener(callback)
  }

  public async getAlarms() : Promise<ExtensionAlarm[]> {
    if(!this.isInit) return []
    return chrome.alarms.getAll()
  }

  public async removeAlarm(name: string) : Promise<boolean> {
    if(!this.isInit) return false
    return chrome.alarms.clear(name)
  }

  public async removeAllAlarms() : Promise<boolean> {
    if(!this.isInit) return false
    return chrome.alarms.clearAll()
  }

  public createNotification(options: ExtensionNotificationOptions, id?: string, callback?: (result: any) => void) : void {
    if(!this.isInit) return void 0
    if(id) {
      chrome.notifications.create(id, options, callback)
    } else {
      chrome.notifications.create(options, callback)
    }
  }

  public onNotificationClick( callback: (id: string) => void ) {
    if(!this.isInit) return void 0
    chrome.notifications.onClicked.addListener(callback)
  }
}

export default new BrowserApi()