import * as _ from 'underscore'
import config from '../config'

interface DescriptiveShortlink {
  userTag?: string
  descriptionTag: string
}

class LinkTools {
  readonly baseUrl : string
  readonly displayServiceUrl : string

  constructor() {
    this.baseUrl = config.PUBLIC_SERVICE_URL
    this.displayServiceUrl = config.DISPLAY_SERVICE_URL
  }

  validateURL(str: string) : boolean {
    try { 
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  sanitizeURLSlug (str: string) : string {
    str = str.replace(/[^a-z0-9\s-]/ig, '')
    str = str.replace(/\s/ig, '-')
    return str
  }

  generateShortlinkFromHash( hash: string ) : string {
    return `${this.baseUrl}/${hash}`
  }

  generateDescriptiveShortlink( { userTag, descriptionTag } : DescriptiveShortlink ) : string {
    const userTagPart = userTag ? userTag : ''
    const descriptionTagPart = '@' + descriptionTag
    return `${this.baseUrl}/${userTagPart}${descriptionTagPart}`
  }

  fixUrl( url: string ) : string {
    let result = url.trim()
    if(result.indexOf('?') == -1) result = result.replace(/\/$/, '')
    
    if(this.validateURL(url)) return result
    
    result = 'https://' + result
    if(this.validateURL(result)) return result

    throw new Error(`URL ${result} is not valid`)
  }

  /* 
    For query array [ 'param1', 'param2', ... ]
    Returns corresponding query values or null [ 'value1', null, ...  ]
   */
  queryUrlSearchParams(queryParam: string[], searchParamsString?: string) : Array<string | null> {
    if(!searchParamsString) return Array.from({length: _.size(queryParam)}, () => null)

    const searchParams = new URLSearchParams(searchParamsString)
    const result : Array<string | null> = []
    _.forEach(queryParam, (param) => {
      result.push(searchParams.get(param))
    })
    _.map(result, (item) => {
      if(item != null) return decodeURIComponent(item)
    })
    return result 
  }

  makeDisplayUrl(rawUrl: string): string {
    let result = (rawUrl || '').trim().replace(/^https?:\/\//ig, '')
    result = result.replace(/^www\./ig, '')
    return result
  }
}

export default new LinkTools()