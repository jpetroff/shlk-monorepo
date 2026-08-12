import proxyStorage from './proxy-storage.webapp'
import linkTools from './link.tools'
import GQLShortlinkQuery from './shortlink.gql'
import { deleteURLQueryParam } from './utils'

export type ShortlinkLocal = {
  hash?: string,
  location: string,
  descriptor?: {
    userTag?: string,
    descriptionTag: string
  }
}

type TGetAll = {
  recent?: boolean
  after?: Date,
  limit?: number
}

export type TCachedLink = ShortlinkLocal & {
  createdAt: string
}

export enum CacheMode {
  local = 'local',
  remote = 'remote'
}

export class ShortlinkCache {
  private dateThreshold : Date

  private storage : Array<TCachedLink>
  private storagePromise: Promise<Array<TCachedLink>> = Promise.resolve([])
  private storageGeneration = 0
  private mode: CacheMode = CacheMode.local

  constructor() {
    const _now = new Date()
    this.dateThreshold = new Date(_now.setMonth(_now.getMonth() - 1))
    this.storage = []
    queueMicrotask(() => void this.purgeOutdatedShortlinks())
  }

  public setMode(mode: CacheMode) {
    if (this.mode === mode) return
    this.mode = mode
    ++this.storageGeneration
    this.storage = []
    this.storagePromise = Promise.resolve([])
  }

  public async setStorage() {
    const generation = ++this.storageGeneration
    const storagePromise = this.mode == CacheMode.local
      ? this.getAllFromLocalStorage()
      : this.getAllFromRemote()
    this.storagePromise = storagePromise
    const storage = await storagePromise
    if (generation === this.storageGeneration) this.storage = storage
  }

  public async awaitStorage(): Promise<Array<TCachedLink>> {
    await this.storagePromise
    return this.storage
  }
  public getStorage() : Array<TCachedLink> {
    return this.storage
  }

  public checkShortlink( args: ShortlinkLocal ) : ShortlinkLocal | null {
    const result = this.storage.find((item) =>
      Object.entries(args).every(([key, value]) => item[key as keyof TCachedLink] === value))
    return result || null
  }

  public storeShortlink( shortlink: ShortlinkLocal ) : void {
    const cachedShortlink: TCachedLink = { ...shortlink, createdAt: new Date().toISOString() }
    this.storage = [cachedShortlink, ...this.storage]
    if(this.mode == CacheMode.local) {
      this.storeLocalStorage(cachedShortlink)
    }
  }

  private checkLocalStorageObject(object: any) {
    return (
      typeof object === 'object' &&
      object !== null &&
      Object.keys(object).length > 0 &&
      Object.hasOwn(object, 'location')
    )
  }

  private async purgeOutdatedShortlinks() {
    const storageItems = await proxyStorage.getAllItems(null) as AnyObject | null
    if(!storageItems) return
    let items: Array<TCachedLink & { key: string }> = Object.entries(storageItems)
      .map(([key, item]) => ({ ...(item as TCachedLink), key }))

    const forcePurge = linkTools.queryUrlSearchParams(['purge'], window.location.search)
    if(forcePurge[0] == 'true') { deleteURLQueryParam('purge') }

    items = items.filter((item) => {
      return this.checkLocalStorageObject(item)
    })

    items.sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf())

    const trailingItems = items.slice(30)

    trailingItems.forEach((item) => {
      proxyStorage.removeItem(item.key)
    })
  }

  private storeLocalStorage( args: ShortlinkLocal ) : boolean {
    if (!proxyStorage.canUse()) return false

    const urlKey = encodeURI(args.location)
    const storageItem : TCachedLink = {
      ...args,
      createdAt: (new Date()).toISOString()
    }
    proxyStorage.setItem(urlKey, JSON.stringify(storageItem)).catch((err) => {console.error(err)})
    return true
  }

  private async checkLocalStorage( args: ShortlinkLocal ) : Promise<TCachedLink | null> {
    if (!proxyStorage.canUse()) return null

    const urlKey = encodeURI(args.location)
    const existingShortlink = await proxyStorage.getItem(urlKey)
    if(existingShortlink != null) {
      return JSON.parse(existingShortlink)
    } else {
      return null
    }
  }

  private async getAllFromLocalStorage( limit?: number ) : Promise<Array<TCachedLink>> {
    const storageContent = await proxyStorage.getAllItems(null)
    let result : TCachedLink[] = []

    if(!storageContent || Object.keys(storageContent).length === 0) return result
    
    Object.values(storageContent).forEach((item) => {
      if(
        this.checkLocalStorageObject(item)
      ) {
        result.push(item as TCachedLink)
      }
    })

    result.sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf())

    if(limit) return result.slice(0, limit)
    return result
  }

  private async getAllFromRemote( limit: number = 30 ) : Promise<Array<TCachedLink>> {
    const storageContent = await GQLShortlinkQuery.getUserShortlinks({ limit })
    return storageContent as Array<TCachedLink>
  }
}

export default new ShortlinkCache()