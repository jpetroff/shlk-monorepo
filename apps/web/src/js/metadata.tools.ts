import linkTools from './link.tools'

type LinkData = {
  location: string
  siteTitle?: string
  siteDescription?: string
  urlMetadata?: AnyObject
}

class MetadataTools {
  constructor() {}

  getFavicon( shortlink : LinkData ) : string {
    if(!shortlink.urlMetadata) return '/assets/default-favicon.png'
    return shortlink.urlMetadata.favicons?.[0]?.src || '/assets/default-favicon.png'
  }

  getTitle( shortlink: LinkData ) : string {
    if(shortlink.siteTitle) return shortlink.siteTitle
    if(!shortlink.urlMetadata) return linkTools.makeDisplayUrl(shortlink.location)

    return  shortlink.urlMetadata.title ||
            shortlink.urlMetadata.og?.title || 
            shortlink.urlMetadata.site_name ||
            shortlink.urlMetadata.og?.site_name ||
            linkTools.makeDisplayUrl(shortlink.location)
  }

  getDescription( shortlink: LinkData ) : string {
    if(shortlink.siteDescription) return shortlink.siteDescription
    if(!shortlink.urlMetadata) return ''

    const type = shortlink.urlMetadata.type.replace(/;.*$/ig, '').trim()
    if(/html/ig.test(type)) {
      const v1 =  (shortlink.urlMetadata.description ||
                  shortlink.urlMetadata.og?.description || 
                  '')
      const v2 =  [
                    shortlink.urlMetadata.og?.type || '',
                    shortlink.urlMetadata.og?.site_name || ''
                  ].join(' · ')
      return v1.trim() || v2.trim() || ''
    }
    if(/image/ig.test(type)) {
      return [
        'Image',
        shortlink.urlMetadata.size || ''
      ].join(' · ')
    }
    if(/video/ig.test(type)) {
    }
    return ''
  }
}

export default new MetadataTools()
