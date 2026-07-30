import _ from 'underscore'

export function clearURLTracking (url: URL) : URL {
  const trackingParams = [
    'fbclid',
    'utm_source', 'utm_medium', 'utm_content', 'utm_campaign', 'utm_term',
    '_ga', 'dclid', 'gclid', 'msclkid', 'sessionid'
  ]

  trackingParams.forEach( (param) => url.searchParams.delete(param) )
  return url
}

export function modifyURLSlug (str: string) : string {
  str = str.replace(/[^a-z0-9\s-]/ig, '')
  // str = str.replace(/\s+/ig, ' ').trim()
  str = str.replace(/\s/ig, '-')
  return str
}

/**
 * Adds protocol https://, clears tracking tags, removes trailing slash
 *
 * @param {string} _url Full URL
 * 
 * @return {string}
 */
export function normalizeURL( _url: string ): string {
  let url = _url.trim()
  const protocolRegex = new RegExp('^https?://')

  if(!protocolRegex.test(url)) url = 'https://'+url

  const URLObj = new URL(url)
  let URLString : string = clearURLTracking(URLObj).toString()
  if(URLString.indexOf('?') == -1) URLString = URLString.replace(/\/$/, '')

  return URLString
}

export const cliColors = {
  red:    `\x1b[1;31m`,
  green:  `\x1b[1;32m`,
  yellow: `\x1b[1;33m`,
  end:    `\x1b[0m`,
}


export function allEmpty(...args:any[]) : boolean {
  if(args.length == 0) return false
  if(args.length == 1) return !args[0]

  return _.reduce(args, (prev, curr) => {
    return (!prev) && (!curr)
  })
}

export function sameOrNoOwnerID(_id1: Maybe<string | ObjectId>, _id2: Maybe<string | ObjectId>) : boolean {
  const id1 = _id1 ? _id1.toString() : _id1
  const id2 = _id2 ? _id2.toString() : _id2
  return allEmpty(id1, id2) || id1 == id2
}

export class ExtError extends Error {
  public meta?: AnyObject

  constructor (message?: string, meta?: AnyObject) {
    super(message)

    // assign the error class name in your custom error (as a shortcut)
    this.name = 'Error'

    // capturing the stack trace keeps the reference to your error class
    Error.captureStackTrace(this, this.constructor);

    // you may also assign additional properties to your error
    this.meta = meta
  }
}

/* 
  Byte conversion tool
*/
enum BASE {
  TWO = 2,
  TEN = 10,
}
const UNITS = {
  [BASE.TEN]: ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"],
  [BASE.TWO]: ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
};

function toFixed(value: number, n: number) {
  const m = Math.pow(10, n);
  return Math.round(value * m) / m;
}

function parseBytes(value: number, base: BASE = BASE.TEN) {
  const bytes = Number(value);
  const absValue = Math.abs(bytes);
  const step =
    base === BASE.TWO
      ? 1024 // Math.pow(2, 10)
      : 1000; // Math.pow(10, 3)
  if (!Number.isFinite(absValue)) {
    throw new TypeError("value can not be used as a finite number");
  }
  let i;
  if (absValue === 0) i = 0;
  else {
    i =
      base === BASE.TWO
        ? Math.floor(Math.log2(absValue) / 10)
        : Math.floor(Math.log10(absValue) / 3);
  }
  const j = Math.min(i, UNITS[base].length - 1);
  const v = toFixed(absValue / Math.pow(step, j), 2);
  return {
    value: absValue === 0 ? 0 : v * (value / absValue),
    unit: UNITS[base][j],
  };
}

export function readableBytes(bytes: number, base: BASE = BASE.TWO) {
  const { value, unit } = parseBytes(bytes, base);
  return `${value} ${unit}`;
}