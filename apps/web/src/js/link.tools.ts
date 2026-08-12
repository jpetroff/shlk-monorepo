import constants from './constants'
import config from './config'
import AppError from './app-error'

interface DescriptiveShortlink {
  userTag?: string
  descriptionTag: string
}

class LinkTools {
  readonly baseUrl : string
  readonly displayServiceUrl : string

  constructor() {
    this.baseUrl = config.serviceUrl
    this.displayServiceUrl = config.displayServiceUrl
  }

  validateURL(str: string) : boolean {
    return constants.regexWeburl.test(str)
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
    
    if(!/^(https?|ftp):\/\/.*/ig.test(result)) {
      result = 'https://' + result
      if(this.validateURL(result)) return result
    }

    throw new AppError(`URL ${result} is not valid`, { code: 'INVALID_URL', source: url })
  }

  /* 
    For query array [ 'param1', 'param2', ... ]
    Returns corresponding query values or null [ 'value1', null, ...  ]
   */
  queryUrlSearchParams(queryParam: string[], searchParamsString?: string) : Array<string | null> {
    if(!searchParamsString) return Array.from({length: queryParam.length}, () => null)

    const searchParams = new URLSearchParams(searchParamsString)
    return queryParam.map((param) => searchParams.get(param))
  }

  makeDisplayUrl(rawUrl: string): string {
    let result = (rawUrl || '').trim().replace(/^https?:\/\//ig, '')
    result = result.replace(/^www\./ig, '')
    return result
  }

  makeDisplayShortlink(hash: string): string;
  makeDisplayShortlink( {userTag, descriptionTag} : {userTag?: string, descriptionTag: string} ): string;
  makeDisplayShortlink( prop: string | {userTag?: string, descriptionTag: string} ):string {
    if(typeof prop === 'object' && prop !== null) {
      const userTagPart = prop.userTag ? prop.userTag : ''
      const descriptionTagPart = '@' + prop.descriptionTag
      return `${this.displayServiceUrl}/${userTagPart}${descriptionTagPart}`
    } else {
      return `${this.displayServiceUrl}/${prop}`
    }
  }
}

export default new LinkTools()