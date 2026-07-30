import * as _ from 'underscore'

export const StorageType = { local: 'local', sync: 'sync', session: 'session' } as const
export type StorageType = typeof StorageType[keyof typeof StorageType]

export const proxyStorage = {

  async getItem(key: string, storage: StorageType = StorageType.sync) : Promise<any> {
    const result = await chrome.storage[storage].get(key)
    return result[key]
  },

  async setItem(key: string, value: any, storage: StorageType = StorageType.sync) : Promise<void> {
    const newItem : AnyObject = {}
    newItem[key] = value
    await chrome.storage[storage].set(newItem)
  },

  async getAllItems(keys: string[] | null, storage: StorageType = StorageType.sync) : Promise<any> {
    const result = await chrome.storage[storage].get( (keys && keys.length > 0) ? keys : undefined)
    return result
  },

  async setAllItems(items: AnyObject, storage: StorageType = StorageType.sync) : Promise<void> {
    const result = await chrome.storage[storage].set(items)
  },

  canUse() {
    if(chrome.storage.sync) return true
    return false
  },

  async removeItem(key: string, storage: StorageType = StorageType.sync) : Promise<void> {
    await chrome.storage[storage].remove(key)
  },

  async removeAllItems(keys: string[] | null, storage: StorageType = StorageType.sync) : Promise<void> {
    if(!keys || keys.length == 0) {
      await chrome.storage[storage].clear()
    } else {
      await chrome.storage[storage].remove( keys )
    }
  }

}
export default proxyStorage