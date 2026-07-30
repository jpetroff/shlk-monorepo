import * as _ from 'underscore'
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

class ShortlinkCache {
  private dateThreshold : Date

  private storage : Array<TCachedLink>
  private storagePromise: Promise<Array<TCachedLink>> = Promise.resolve([])
  public mode: CacheMode = CacheMode.local

  constructor() {
    const _now = new Date()
    this.dateThreshold = new Date(_now.setMonth(_now.getMonth() - 1))
    this.storage = []
    queueMicrotask(() => void this.purgeOutdatedShortlinks())
  }

  public async setStorage() {
    if(this.mode == CacheMode.local) {
      this.storagePromise = this.getAllFromLocalStorage()
    } else {
      this.storagePromise = this.getAllFromRemote()
    }
    this.storage = await this.storagePromise
  }

  public async awaitStorage(): Promise<Array<TCachedLink>> {
    await this.storagePromise
    return this.storage
  }
  public getStorage() : Array<TCachedLink> {
    return this.storage
  }

  public checkShortlink( args: ShortlinkLocal ) : ShortlinkLocal | null {
    const result = _.findWhere(this.storage, args)
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
      _.isObject(object) && 
      !_.isEmpty(object) && 
      _.keys(object).includes('location')
    )
  }

  private async purgeOutdatedShortlinks() {
    let items = await proxyStorage.getAllItems(null)
    if(!items) return

    const forcePurge = linkTools.queryUrlSearchParams(['purge'], window.location.search)
    if(forcePurge[0] == 'true') { deleteURLQueryParam('purge') }

    items = _.filter(items, (item) => {
      return this.checkLocalStorageObject(item)
    })

    items = _.sortBy(items, (item) => {
      return Date.now() - (new Date(item.createdAt)).valueOf()
    })

    const trailingItems = _.last(items, items.length - 30)

    _.each(trailingItems, (item) => {
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

    if(_.isEmpty(storageContent)) return result
    
    _.each(storageContent, (item) => {
      if(
        this.checkLocalStorageObject(item)
      ) {
        result.push(item as TCachedLink)
      }
    })

    result = _.sortBy(result, (item) => {
      return Date.now() - (new Date(item.createdAt)).valueOf()
    })

    if(limit) return _.first(result, limit)
    return result
  }

  private async getAllFromRemote( limit: number = 30 ) : Promise<Array<TCachedLink>> {
    try {
      const storageContent = await GQLShortlinkQuery.getUserShortlinks({
        limit
      })
      return storageContent as Array<TCachedLink>
    } catch(error: any) {
      console.error(error)
      return []
    }
  }
}

export default new ShortlinkCache()