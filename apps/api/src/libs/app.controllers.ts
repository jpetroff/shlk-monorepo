import { getShortlink } from './shortlink.queries'
import _ from 'underscore'
import express from 'express'

function sendDescriptiveRedirect (res: express.Response, result: ShortlinkDocument) {
  const location = _.unescape(result.location)
  res.redirect(302, location)
  res.end()
}

function sendRedirect (res: express.Response, result: ShortlinkDocument) {
  const location = _.unescape(result.location)
  res.redirect(302, location)
  res.end()
}

function sendErrorResponse (res: express.Response, error: Error) {
  res.status(400).send(error.message)
}

export function appRedirect (req: express.Request, res: express.Response) {
  const redirectUrl = String(req.params.redirectUrl)
  const isDecriptiveUrl = /.*?@.*?/.test(redirectUrl)

  if(isDecriptiveUrl) {
    const [ userTag , descriptionTag ] = redirectUrl.split('@')
    getShortlink({
      userTag,
      descriptionTag
    }).then( (result) => {
      if(!result) throw new Error(`Shortlink '/${redirectUrl}' not found`)
      return sendDescriptiveRedirect(res, result)
    }).catch( (err) => {
      return sendErrorResponse(res, err)
    }) 

  } else {
    const hash = redirectUrl
    getShortlink({
      hash
    }).then( (result) => {
      if(!result) throw new Error(`Shortlink '/${redirectUrl}' not found`)
      return sendRedirect(res, result)
    }).catch( (err) => {
      return sendErrorResponse(res, err)
    })

  }
}