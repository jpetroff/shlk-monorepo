import { validateURL } from './utils'
import config from './config'

import GQLRequest from './request-wrapper.gql'
import AppError from './app-error'


class GQLShortlinkQuery {
  private queryUrl : string

  private gqlClient : GQLRequest

  constructor() {
    this.queryUrl = config.apiBaseUrl + '/api'
    this.gqlClient = new GQLRequest({
      baseURL: this.queryUrl,
      method: 'POST',
      headers: {} 
    })
  }

  private fullShortlinkProperties : string = `
  _id
  hash
  location
  descriptor {
    userTag
    descriptionTag
  }
  owner
  urlMetadata
  snooze {
    awake
    description
  }
  createdAt
  updatedAt
  siteTitle
  siteDescription
  `

  public async createShortlink (location: string, signal?: AbortSignal) : Promise<ShortlinkDocument | null> {
    if (validateURL(location) == false) {
      throw new AppError(`Not a valid URL: '${location}'`, { code: 'INVALID_URL', source: location })
    }
    const query = `
    mutation createShortlinkWithVars (
      $location: String!
    ){
      createShortlink(location: $location) {
        _id
        hash
        location
        descriptor {
          userTag
          descriptionTag
        }
      }
    }
    `

    const response = await this.gqlClient.request(query, { location }, { signal })
    console.log('[GQL] createShortlink\n', response)
    return response.createShortlink
  }

  public async createShortlinkDescriptor (
    { userTag, descriptionTag, location, hash } : { userTag?: string, descriptionTag: string, location: string, hash?: string },
    signal?: AbortSignal
  ) : Promise<ShortlinkDocument | null> {
    if(!descriptionTag || !location) return null

    const query = `
    mutation createDescriptiveShortlinkWithVars(
      $userTag: String
      $descriptionTag: String!
      $location: String!
      $hash: String
    ) {
      createDescriptiveShortlink(
        userTag: $userTag, 
        descriptionTag: $descriptionTag, 
        location: $location, 
        hash: $hash
      ) {
        _id
        hash
        location
        descriptor {
          userTag
          descriptionTag
        }
      }
    }
    `

    const response = await this.gqlClient.request(query, { userTag, descriptionTag, location, hash }, { signal })
    console.log('[GQL] createShortlinkDescriptor\n', response)
    return response.createDescriptiveShortlink
  }

  public async getUserShortlinks<T = ShortlinkDocument>( { limit, skip, sort, order, search, isSnooze } : QICommon, signal?: AbortSignal) : Promise<T[]> {
    const query = `
    query getUserShortlinksWithVars (
      $limit: Int
      $skip: Int
      $sort: String
      $order: String
      $search: String
      $isSnooze: Boolean
    ){
      getUserShortlinks(
        args: {
          limit: $limit
          skip: $skip
          sort: $sort
          order: $order
          search: $search
          isSnooze: $isSnooze
        }
      ) {
        ${this.fullShortlinkProperties}
      }
    }
    `

    const response = await this.gqlClient.request(query, { limit, skip, sort, order, search, isSnooze }, { signal })
    console.log('[GQL] getUserShortlinks\n', response)
    return response.getUserShortlinks
  }

  public async createOrUpdateShortlinkTimer(args: QISnoozeArgs, signal?: AbortSignal) : Promise<ShortlinkDocument | null> {
    const query = `
    mutation createOrUpdateShortlinkTimerWithVars(
      $location: String
      $hash: String
      $id: String
      $standardTimer: String
      $customDay: Mixed
      $customTime: Mixed
      $baseDateISOString: String
    ) {
      createOrUpdateShortlinkTimer (
        args: {
          location: $location
          hash: $hash
          id: $id
          standardTimer: $standardTimer
          customDay: $customDay
          customTime: $customTime
          baseDateISOString: $baseDateISOString
        }
      ) {
        _id
        hash
        location
        siteTitle
        snooze {
          awake
          description
        }
        descriptor {
          userTag
          descriptionTag
        }
      }
    }
    `

    const response = await this.gqlClient.request(query, args, { signal })
    console.log('[GQL] createOrUpdateShortlinkTimer\n', response)
    return response.createOrUpdateShortlinkTimer
  }

  public async deleteShortlinkSnoozeTimer(ids: string[], signal?: AbortSignal) : Promise<ShortlinkDocument[]> {
    const query = `
    mutation deleteShortlinkSnoozeTimerWithVars(
      $ids: [String]
    ) {
      deleteShortlinkSnoozeTimer (
        ids: $ids
      ) {
        _id
        hash
        location
        descriptor {
          userTag
          descriptionTag
        }
      }
    }
    `

    const response = await this.gqlClient.request(query, {ids}, { signal })
    console.log('[GQL] deleteShortlinkSnoozeTimer\n', response)
    return response.deleteShortlinkSnoozeTimer
  }

  public async deleteShortlink(id: string, signal?: AbortSignal) : Promise<ShortlinkDocument | null> {
    const query = `
    mutation deleteShortlink(
      $id: String!
    ) {
      deleteShortlink (
        id: $id
      ) {
        _id
        hash
        location
        descriptor {
          userTag
          descriptionTag
        }
      }
    }
    `

    const response = await this.gqlClient.request(query, {id}, { signal })
    console.log('[GQL] deleteShortlink\n', response)
    return response.deleteShortlink
  }

  public async updateShortlink(id: string, shortlink: Partial<ShortlinkDocument>, signal?: AbortSignal) : Promise<ShortlinkDocument> {
    const query = `
    mutation updateShortlinkWithVars(
      $id: String!
      $shortlink: QIEditableShortlinkProps
    ) {
      updateShortlink (
        id: $id
        shortlink: $shortlink
      ) {
        ${this.fullShortlinkProperties}
      }
    }
    `

    const response = await this.gqlClient.request(query, {id, shortlink}, { signal })
    console.log('[GQL] updateShortlink\n', response)
    return response.updateShortlink
  }
}

export default new GQLShortlinkQuery()