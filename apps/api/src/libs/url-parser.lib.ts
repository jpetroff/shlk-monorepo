import axios, { AxiosRequestConfig, AxiosResponse } from "axios"
import { parse as HTML, HTMLElement } from "node-html-parser"
import metadataTools from "./metadata.tools"
import * as _ from 'underscore'

interface Favicon {
  src: string,
  sizes?: string
}

export namespace URLMeta {
  export interface ResourceMeta {
    type: string
  }
  export interface FileMeta {
    size?: number
    encoding?: string
  }
  export interface HtmlMeta {
    title?: string;
    description?: string,
    image?: string
    url?: string,
    type?: string,
    site_name?: string,
    favicons?: Favicon[]
  }
  export interface SiteMeta extends HtmlMeta {
    og?: Omit<SiteMeta, 'favicons'>
  }
  export type Result = ResourceMeta & FileMeta & SiteMeta
}

const readMT = (el: HTMLElement, name: string) => {
    const prop = el.getAttribute('name') || el.getAttribute('property');
    return prop == name ? el.getAttribute('content') : null;
};

const parse = async (url: string) : Promise<[URLMeta.Result, string, string]> => {
  const prefetch = axios.create({
    url,
    maxBodyLength: 1024*1024*2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10) AppleWebKit (KHTML, like Gecko) Chrome Safari',
      'Referer': 'https://shlk.cc',
      'Viewport-Width': '960',
      'Cache-Control': 'no-cache',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })

  let fetchedHeaders : AxiosResponse<any, any> 
  try { fetchedHeaders = await prefetch.head(url) } 
  catch { return [{type: 'invalid url'}, 'Site not accessible', ''] }

  const contentType = String(fetchedHeaders.headers['content-type'] || 'unknown')
  const contentLength = fetchedHeaders.headers['content-length']
  const contentEncoding = String(fetchedHeaders.headers['content-encoding'] || 'utf-8')
  const partialMeta : URLMeta.Result = {
    type: contentType,
    size: contentLength ? Number.parseInt(String(contentLength), 10) : undefined,
    encoding: contentEncoding
  }

  const meta: URLMeta.SiteMeta = {}
  const og: URLMeta.SiteMeta = {}

  if(partialMeta.type.match(/html/ig) != null) {
    try{
      const urlObject = new URL(url)
      const { data } = await prefetch.get(urlObject.toString())

      const $ = HTML(data)

      const title = $.querySelector('title');
      if (title)
          meta.title = title.text;

      const canonical = $.querySelector('link[rel=canonical]');
      if (canonical) {
          meta.url = canonical.getAttribute('href');
      }

      const favicons = $.querySelectorAll('link[rel~=icon]')
      const faviconList: Favicon[] = []
      for(let i = 0; i < favicons.length; i++) {
        const el = favicons[i]
        const href = el.getAttribute('href')
        if(href && /\.(jpe?g|png|gif|ico)(\?.*$)?/ig.test(href)) {
          let fullUrl : string = ''
          try { 
            fullUrl = (new URL(href, urlObject.origin)).toString() 
            faviconList.push({
              src: fullUrl,
              sizes: el.getAttribute('sizes')
            })
          } catch {}
        }
      }
      if(faviconList.length == 0) {
        try {
          const defaultFaviconUrl = new URL('/favicon.ico', urlObject.origin)
          const hasDefault = await prefetch.head(defaultFaviconUrl.toString())
          if(hasDefault.headers && hasDefault.headers['content-type'] && /image/ig.test(String(hasDefault.headers['content-type'])) )
            faviconList.push({ src: defaultFaviconUrl.toString() })
        } catch {}
      }
      meta.favicons = metadataTools.sortFaviconList(faviconList) || []

      const metas = $.querySelectorAll('meta');

      for (let i = 0; i < metas.length; i++) {
          const el = metas[i];

          ['title', 'description', 'image'].forEach( (s) => {
              const val = readMT(el, s);
              if (val) meta[s as (keyof Omit<URLMeta.SiteMeta, 'favicons'>)] = val;
          });

          ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:type'].forEach(s => {
              const val = readMT(el, s);
              if (val) og[s.split(':')[1] as (keyof Omit<URLMeta.SiteMeta, 'favicons'>)] = val;
          });
      }
    } catch (err) {
      console.log(err)
    }
  }

  const returnMeta : URLMeta.Result = _.extend({}, partialMeta, meta, {og: og}) as URLMeta.Result
  const metaParams = {location: url, urlMetadata: returnMeta}
  const siteTitle = metadataTools.getTitle(metaParams) || ''
  const siteDescription = metadataTools.getDescription(metaParams) || ''
  const defaultFavicon = metadataTools.getDefaultFavicon(returnMeta.favicons)
  if(defaultFavicon) returnMeta.favicons?.splice(0, 0, defaultFavicon)

  return [returnMeta, siteTitle, siteDescription]
}


const parser = parse;

export default parser;

export { parse, parser };


// {
//   date: 'Mon, 06 Feb 2023 08:15:44 GMT',
//   'content-type': 'image/png',
//   'content-length': '1137',
//   connection: 'keep-alive',
//   'cf-ray': '79527090acf1fe28-HEL',
//   'accept-ranges': 'bytes',
//   'access-control-allow-origin': '*',
//   age: '177538',
//   'cache-control': 's-maxage=1814400, max-age=1209600, stale-while-revalidate=900',
//   etag: '"f951b45f62eed792ae0b513053586652"',
//   'last-modified': 'Mon, 30 Sep 2019 08:18:48 GMT',
//   'strict-transport-security': 'max-age=31536000; includeSubDomains',
//   vary: 'Accept',
//   via: '1.1 972139976e4412f67b110b0eeb969592.cloudfront.net (CloudFront)',
//   'cf-cache-status': 'HIT',
//   'access-control-allow-methods': 'GET',
//   'cache-tag': 'F-15104857067,P-1570479,FLS-ALL',
//   'cf-bgj': 'imgq:85,h2pri',
//   'cf-polished': 'status=not_needed',
//   'edge-cache-tag': 'F-15104857067,P-1570479,FLS-ALL',
//   'x-amz-cf-id': '2SUIshnSuAaJaeg6mObjy1_uB4ZpmRfeJXmE8xtiQ9_qbUSEN8PeeQ==',
//   'x-amz-cf-pop': 'CPH50-P1',
//   'x-amz-id-2': 'X3hpy1ycP55SVLbC3PfjvLJ/LvEyI/+N2vmeQednmtzQH+qLfJmpgyLvkpC7EGeyk80riFCto5I=',
//   'x-amz-meta-cache-tag': 'F-15104857067,P-1570479,FLS-ALL',
//   'x-amz-request-id': 'TYFJT6B45GMAAH5X',
//   'x-amz-version-id': 'uIn.f6UKKUx6SUMXaT2FeDz5e5BTd.Eu',
//   'x-cache': 'RefreshHit from cloudfront',
//   'x-hs-cf-lambda': 'us-east-1.enforceAclForReadsProd 15',
//   'x-hs-cf-lambda-enforce': 'us-east-1.enforceAclForReadsProd 15',
//   'x-hs-https-only': 'worker',
//   'set-cookie': [
//     '__cf_bm=pYo7kcJBOmXgFFUVp.FqxHTNjwUc1zZnwss2X4oNfcM-1675671344-0-AbVasE9kR1N+CsItI4okjVc1YryYRuMalhs1McSuISKN1lofOaIh4YMFukszDREFkLAK3Yjta1v0VieuINeYBfQ=; path=/; expires=Mon, 06-Feb-23 08:45:44 GMT; domain=.www.smartly.io; HttpOnly; Secure',
//     '__cfruid=58cb9d4ad2ed19f8812161b62f7b5eceb892ecd5-1675671344; path=/; domain=.www.smartly.io; HttpOnly; Secure; SameSite=None'
//   ],
//   'report-to': '{"endpoints":[{"url":"https:\\/\\/a.nel.cloudflare.com\\/report\\/v3?s=EGqAUkgnuj6yt5tK0I%2FbAw0mTc47MO4lwU1qfJh%2BtozGr7abElXwv1aLLqJUavAVdl1bo%2BySqvaTWXp7eEJb5Dh1YfTOwBLcL97ZngtRWZWjpDcX2EwFl8TTRy0GyvXID4sgw0fHt5h5zPns"}],"group":"cf-nel","max_age":604800}',
//   nel: '{"success_fraction":0.01,"report_to":"cf-nel","max_age":604800}',
//   server: 'cloudflare',
//   'alt-svc': 'h3=":443"; ma=86400, h3-29=":443"; ma=86400'
// }