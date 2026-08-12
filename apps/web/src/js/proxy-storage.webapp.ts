export enum StorageType {
  local = 'local',
  sync = 'sync',
  session = 'session',
  default = 'null'
}

export const proxyStorage = {
  async getItem(key: string, _storage: StorageType = StorageType.default): Promise<any> {
    const item = window.localStorage.getItem(key)
    try {
      return JSON.parse(item ?? 'null')
    } catch {
      return item || null
    }
  },

  async setItem(key: string, value: any, _storage: StorageType = StorageType.default): Promise<void> {
    try {
      const result = typeof value === 'string' ? value : JSON.stringify(value)
      window.localStorage.setItem(key, result)
    } catch {
      return
    }
  },

  canUse() {
    return Boolean(window.localStorage)
  },

  async getAllItems(keys: string[] | null, _storage: StorageType = StorageType.default): Promise<any> {
    const result: AnyObject = {}
    const selectedKeys = !keys || keys.length === 0 ? Object.keys(window.localStorage) : keys
    for (const key of selectedKeys) {
      if (keys && keys.length !== 0 && !keys.includes(key)) continue
      const retrievedItem = window.localStorage.getItem(key)
      try {
        result[key] = JSON.parse(retrievedItem ?? 'null')
      } catch {
        result[key] = retrievedItem
      }
    }
    return result
  },

  async setAllItems(items: AnyObject, _storage: StorageType = StorageType.default): Promise<void> {
    await Promise.all(Object.keys(items).map((key) => proxyStorage.setItem(key, items[key])))
  },

  async removeItem(key: string, _storage: StorageType = StorageType.default): Promise<void> {
    window.localStorage.removeItem(key)
  },

  async removeAllItems(keys: string[] | null, _storage: StorageType = StorageType.default): Promise<void> {
    if (!keys) return
    await Promise.all(keys.map((key) => proxyStorage.removeItem(key)))
  }
}

export default proxyStorage
