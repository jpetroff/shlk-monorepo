import { getShortlink } from './shortlink.queries'
import _ from 'underscore'
import express from 'express'
import { isBanlisted } from './ban.queries'
import { scheduleThreatCheck } from './threat-check.service'

const SHORTLINK_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer'
} as const

function sendRedirect(res: express.Response, result: ShortlinkDocument): void {
  const location = _.unescape(result.location)
  res.status(301).set({
    ...SHORTLINK_HEADERS,
    Location: location
  }).end()
}

function sendNotFound(res: express.Response): void {
  res.status(404).set(SHORTLINK_HEADERS).type('text/plain').send('Shortlink not found')
}

function sendBlocked(res: express.Response): void {
  res.status(410).set(SHORTLINK_HEADERS).type('text/plain').send('Shortlink unavailable')
}

export async function appRedirect(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const redirectUrl = String(req.params.redirectUrl)
  const isDescriptiveUrl = redirectUrl.includes('@')

  try {
    let result: ShortlinkDocument | null
    if (isDescriptiveUrl) {
      const [userTag, descriptionTag] = redirectUrl.split('@')
      result = await getShortlink({ userTag, descriptionTag })
    } else {
      result = await getShortlink({ hash: redirectUrl })
    }

    if (!result) {
      sendNotFound(res)
      return
    }

    const location = _.unescape(result.location)
    if (isBanlisted(location, 'location')) {
      console.warn('Blocked shortlink redirect', { shortlink: redirectUrl })
      sendBlocked(res)
      return
    }

    scheduleThreatCheck(location)
    sendRedirect(res, result)
  } catch (error) {
    next(error)
  }
}
