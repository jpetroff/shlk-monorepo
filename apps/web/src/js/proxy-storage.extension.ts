import { getExtensionApi, type StorageArea } from './extension.api'


export const StorageType = { local: 'local', sync: 'sync', session: 'session' } as const
export type StorageType = typeof StorageType[keyof typeof StorageType]

function storageArea(storage: StorageType): StorageArea {
  const area = getExtensionApi()?.storage?.[storage]
  if (!area) throw new Error(`Extension ${storage} storage is unavailable`)
  return area
}

export const proxyStorage = {

  async getItem(key: string, storage: StorageType = StorageType.sync) : Promise<any> {
    const result = await storageArea(storage).get(key)
    return result[key]
  },

  async setItem(key: string, value: any, storage: StorageType = StorageType.sync) : Promise<void> {
    const newItem : AnyObject = {}
    newItem[key] = value
    await storageArea(storage).set(newItem)
  },

  async getAllItems(keys: string[] | null, storage: StorageType = StorageType.sync) : Promise<any> {
    const result = await storageArea(storage).get( (keys && keys.length > 0) ? keys : null)
    return result
  },

  async setAllItems(items: AnyObject, storage: StorageType = StorageType.sync) : Promise<void> {
    const result = await storageArea(storage).set(items)
  },

  canUse() {
    return Boolean(getExtensionApi()?.storage?.sync)
  },

  async removeItem(key: string, storage: StorageType = StorageType.sync) : Promise<void> {
    await storageArea(storage).remove(key)
  },

  async removeAllItems(keys: string[] | null, storage: StorageType = StorageType.sync) : Promise<void> {
    if(!keys || keys.length == 0) {
      await storageArea(storage).clear()
    } else {
      await storageArea(storage).remove( keys )
    }
  }

}
export default proxyStorage