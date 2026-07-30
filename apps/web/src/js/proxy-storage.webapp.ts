import * as _ from 'underscore'

export enum StorageType {
  local = 'local',
  sync = 'sync',
  session = 'session',
  default = 'null'
}

export const proxyStorage = {

  async getItem(key : string, storage: StorageType = StorageType.default) : Promise<any> {
    const item = window.localStorage.getItem(key)
    try {
      const result = JSON.parse(item ?? "null")
      return result
    } catch {
      return item || null
    }
  },

  async setItem(key: string, value: any, storage: StorageType = StorageType.default) : Promise<void> {
    try {
      let result : any
      if(!_.isString(value)) {
        result = JSON.stringify(value)
      } else {
        result = value
      }
      window.localStorage.setItem(key, result)
    } catch {
      return
    }
  },

  canUse() {
    if(window.localStorage) return true
    return false
  },

  async getAllItems(keys: string[] | null, storage: StorageType = StorageType.default) : Promise<any> {
    const result : any = {}
    const allKeys = _.keys(window.localStorage)
    _.each(keys ?? allKeys, (key) => {
      if(keys && keys.length != 0 && keys.indexOf(key) == -1) return
      
      const retrievedItem = window.localStorage.getItem(key)
      try {
        result[key] = JSON.parse(retrievedItem ?? "null")
      } catch { 
        result[key] = retrievedItem
      }
    })
    return result
  },

  async setAllItems(items: AnyObject, storage: StorageType = StorageType.default) : Promise<any> {
    const keys = _.keys(items)
    _.each(keys, (key) => {
      proxyStorage.setItem(key, items[key])
    })
  },

  async removeItem(key: string, storage: StorageType = StorageType.default) : Promise<void> {
    window.localStorage.removeItem(key)
  },

  async removeAllItems(keys: string[] | null, storage: StorageType = StorageType.default) : Promise<void> {
    if(!keys) return 
    _.each(keys, (key) => {
      proxyStorage.removeItem(key)
    })
  }

}

export default proxyStorage