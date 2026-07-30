import axios from 'axios'
import * as _ from 'underscore'
import linkTools from './link.tools'
import { readableBytes } from './utils'

type LinkData = {
  location: string
  urlMetadata?: AnyObject
}

class MetadataTools {
  constructor() {}

  getDefaultFavicon( list?: {src: string, sizes?: string}[] ) : Maybe<{src: string, sizes?: string}> {
    if(!list || list.length < 1) {
      return null
    }
    return list[0]
  }

  sortFaviconList(list?: {src: string, sizes?: string}[] ) : Maybe<{src: string, sizes?: string}[]> {
    if(!list || list.length < 1) {
      return null
    }

    let faviconList = _.map(list, (item) => {
      if(!item.sizes || item.sizes == 'any') {
        item.sizes = '-1'
        return item
      }
      const sizeArray = item.sizes?.split('x')
      item.sizes = sizeArray[0] || '-1'
      return item
    })

    faviconList = _.sortBy(faviconList, (item) => { return parseInt(item.sizes || '-1') } )

    return faviconList
  }

  getTitle( shortlink: LinkData ) : string {
    if(!shortlink.urlMetadata) return linkTools.makeDisplayUrl(shortlink.location)

    return  shortlink.urlMetadata.title || 
            shortlink.urlMetadata.og?.title ||
            shortlink.urlMetadata.site_name ||
            shortlink.urlMetadata.og?.site_name ||
            linkTools.makeDisplayUrl(shortlink.location)
  }

  getDescription( shortlink: LinkData ) : string {
    if(!shortlink.urlMetadata) return ''

    const type = shortlink.urlMetadata.type.replace(/;.*$/ig, '').trim()
    if(/html/ig.test(type)) {
      const v = ( shortlink.urlMetadata.description ||
                  shortlink.urlMetadata.og?.description || 
                  '')
      return v.trim() || ''
    }
    if(/image/ig.test(type)) {
      const strings = [ 'Image' ]
      if(shortlink.urlMetadata.size) strings.push(readableBytes(parseInt(shortlink.urlMetadata.size)))
      return strings.join(' · ')
    }
    if(/video/ig.test(type)) {
      const strings = [ 'Video' ]
      if(shortlink.urlMetadata.size) strings.push(readableBytes(parseInt(shortlink.urlMetadata.size)))
      return strings.join(' · ')
    }
    return ''
  }
}

export default new MetadataTools()