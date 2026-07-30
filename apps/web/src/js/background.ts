import config from './config'
import browserApi, { ExtensionAlarm, ExtensionMessageSender } from './browser.api'
import proxyStorage, { StorageType } from './proxy-storage.extension'

type ShortlinksDocument = {
  _id: string
  location: string
  siteTitle: string
  snooze: {
    awake: number
  }
}

type LocalAppState = {
  isSyncInProgress: boolean,
  lastSynced: number
}

type StorageData = {
  [id: string]: ShortlinksDocument 
}

const ALARM_NAME = 'checkInTact'

const ALARM_PERIOD = config.mode == 'production' ? 10 : 1

const AppNetwork = {

  updateRestoredTabs: async function (ids: string[]) : Promise<string> {
    const response = await fetch(config.apiBaseUrl+'/api', {
      method: 'POST',
      credentials: 'include',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `
        mutation (
          $ids: [String]
        )
        {
          deleteShortlinkSnoozeTimer(
            ids: $ids
          ) {
            _id
          }
        }
        `,
        variables: {
          ids
        }
      })
    })

    const responseBody = await response.json()
    return responseBody.data?.deleteShortlinkSnoozeTimer || ''
  },

  getShortlinks: async function(skip: number) : Promise<ShortlinksDocument[]> {
    const response = await fetch(config.apiBaseUrl+'/api', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        query: `
        {
          getUserShortlinks(args: {isSnooze: true, sort: "snooze.awake", order: "1", limit: 30, skip:${skip}}) {
            _id location snooze { awake } siteTitle
          } 
        }
        `
      }),
      headers: {
        "Content-Type": "application/json"
      }
    })
    if(response.status != 200) return []
  
    const responseBody = await response.json()
    return responseBody.data?.getUserShortlinks || []
  }
}

const BackgroundApp = {

  appState: async function(newState?: LocalAppState) : Promise<LocalAppState> {
    if(newState) {
      await proxyStorage.setItem('appState', newState, StorageType.local)
    } 

    const result = await proxyStorage.getItem('appState', StorageType.local)
    console.log('App state ', result)
    return result
  },

  getSyncOnlineThreshold: function() : number {
    const threshold = new Date()
    threshold.setHours(threshold.getHours() - 1)
    return threshold.valueOf()
  },

  getAwakeSyncThreshold: function() : number {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + 7)

    return threshold.valueOf()
  },

  getRestoreTimerThreshold: function() : number {
    const threshold = new Date()
    threshold.setMinutes(threshold.getMinutes() + 5)
    return threshold.valueOf()
  },

  setCheckInAlarm: function() {
    browserApi.setAlarm(ALARM_NAME, {
      periodInMinutes: ALARM_PERIOD
    })
  },

  install: async function () {
    await BackgroundApp.appState({
      isSyncInProgress: false,
      lastSynced: BackgroundApp.getSyncOnlineThreshold()
    })
    BackgroundApp.setCheckInAlarm()
  },

  startup: async function() {
    const alarms = await browserApi.getAlarms()
    if(!alarms.some((alarm) => alarm.name === ALARM_NAME)) BackgroundApp.setCheckInAlarm()
  },

  loadSnoozedTabs: async function() : Promise<StorageData> {
    let snoozedLinks: ShortlinksDocument[] = []
    let next : boolean = true

    const threshold = BackgroundApp.getAwakeSyncThreshold()

    while(next) {
      const chunk = await AppNetwork.getShortlinks(snoozedLinks.length)
      snoozedLinks = snoozedLinks.concat(chunk)
    
      if(chunk.length < 30 || chunk[chunk.length - 1].snooze.awake >= threshold)
        next = false
    }
    
    const result : StorageData = {}

    snoozedLinks.forEach( (shortlink: ShortlinksDocument) => {
      result[shortlink._id] = shortlink
    })
    return result
  },

  getExistingAlarms: async function() : Promise<StorageData> {
    const alarmsArray = await browserApi.getAlarms()
    const result : StorageData = {}

    const alarmIDs : string[] = []
    alarmsArray.forEach((alarm) => { if (alarm.name != 'syncSnoozedTabs') alarmIDs.push(alarm.name) })

    const shortlinkMetadata = (await proxyStorage.getAllItems(alarmIDs)) as StorageData

    alarmIDs.forEach( (id: string) => {
      result[id] = shortlinkMetadata[id]
    })

    return result
  },

  updateAlarms: async function() {
    const currentState = await BackgroundApp.appState()
    console.log(currentState)

    await BackgroundApp.appState({
      isSyncInProgress: true,
      lastSynced: currentState.lastSynced
    })

    const synced = await BackgroundApp.loadSnoozedTabs()

    await proxyStorage.removeAllItems(null)
    BackgroundApp.createAlarms(synced)

    await BackgroundApp.appState({
      isSyncInProgress: false,
      lastSynced: (new Date()).valueOf()
    })

    await BackgroundApp.restoreSnoozedTabs()
  },

  getAllAlarms: async function() : Promise<StorageData> {
    const allSyncStorage = await proxyStorage.getAllItems(null)
    const keys = Object.getOwnPropertyNames(allSyncStorage)

    const result : StorageData = {}

    console.log(allSyncStorage)

    keys.forEach( (key) => {
      try {
        if(/^link_/.test(key)) {
          const id = (key.split('_'))[1]
          result[id] = allSyncStorage[key]
        }
      } catch {}
    })

    return result
  },

  createAlarms: async function(items: StorageData) {
    const prefixedItems : StorageData = {}
    const keys = Object.getOwnPropertyNames(items)
    keys.forEach( (key) => {
      prefixedItems[`link_${key}`] = items[key]
    })
    await proxyStorage.setAllItems(prefixedItems)
    console.log('Created ', prefixedItems)
  },

  removeAlarms: async function(ids: string[]) {
    const prefixedIds : string[] = []
    ids.forEach( (id) => {
      prefixedIds.push(`link_${id}`)
    })

    AppNetwork.updateRestoredTabs(ids)
    await proxyStorage.removeAllItems(prefixedIds)
    console.log('Removed ', prefixedIds)
  },

  openTab: async function(url: string) {
    browserApi.openExternal(url)
  },

  handleNotificationClick: async function(url: string) {
    const tabs = await browserApi.findTab(url)
    const tabId = tabs[0]?.id
    if (tabId == null) return
    chrome.tabs.update(tabId, { active: true })
  },

  handleAlarm: async function(alarm: ExtensionAlarm) {
    if(alarm.name == ALARM_NAME) {

      // check if update is in progress
      const appState = await proxyStorage.getItem('appState', StorageType.local)
      if(appState.isSyncInProgess) return

      // check if need sync: last synced is more than 1 hour ago
      if(appState.lastSynced < BackgroundApp.getSyncOnlineThreshold()) {
        BackgroundApp.updateAlarms()
      } else {
        BackgroundApp.restoreSnoozedTabs()
      }
    }
  },

  restoreSnoozedTabs: async function() {
    const existingAlarms = await BackgroundApp.getAllAlarms()
    const existingAlarmKeys = Object.getOwnPropertyNames(existingAlarms)

    console.log(existingAlarms)

    const restoredTabs : StorageData = {}
    const awakeTime = BackgroundApp.getRestoreTimerThreshold()

    existingAlarmKeys.forEach( (id) => {
      if(existingAlarms[id] && existingAlarms[id].snooze.awake < awakeTime) {
        restoredTabs[id] = existingAlarms[id]
      }
    })

    console.log(restoredTabs)

    const restoredTabIDs = Object.getOwnPropertyNames(restoredTabs)
    if(restoredTabIDs.length > 0) {
      BackgroundApp.removeAlarms( restoredTabIDs )

      restoredTabIDs.forEach( (id) => {
        BackgroundApp.openTab(restoredTabs[id].location)
      })

      const title = `Shlk.cc woke up tabs (${restoredTabIDs.length})`
      let message = `${restoredTabs[restoredTabIDs[0]].siteTitle || restoredTabs[restoredTabIDs[0]].location}`
      message += restoredTabIDs.length > 1 ? `and ${restoredTabIDs.length - 1} more` : ``

      browserApi.createNotification({
        type: 'basic',
        title,
        message,
        iconUrl: '/assets/favicon/android-chrome-192x192.png',
        priority: 1
      }, restoredTabIDs[0], (result: any) => {
        console.log('Notification: '+result)
      })
    }
    
  },

  handleMessage: function (message: any, sender: ExtensionMessageSender, sendResponse?: () => void) : boolean {
    //if(message.command == 'sync') BackgroundApp.updateAlarms()
    return true
  }
}

browserApi.onInstalled(BackgroundApp.install)

browserApi.onStartup(BackgroundApp.startup)

browserApi.onAlarm(BackgroundApp.handleAlarm)

browserApi.onNotificationClick(BackgroundApp.handleNotificationClick)

browserApi.onMessage(BackgroundApp.handleMessage)