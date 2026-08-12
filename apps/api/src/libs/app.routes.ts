import express from 'express'
import path from 'node:path'
import { appRedirect } from './app.controllers'
import { cacheControlForStaticFile, REVALIDATED_ASSET_CACHE_CONTROL } from './asset-cache'

const appRouter = express.Router()
const publicDir = path.resolve(import.meta.dir, '../../../web/dist/web')
const indexPath = path.join(publicDir, 'index.html')

appRouter.get('/rest/ping', (_req, res) => {
  res.sendStatus(200)
})

if (process.env.NODE_ENV === 'production') {
  appRouter.get(
    ['/', '/app', '/app/{*splat}', '/login', '/privacy-policy', '/__graphiql'],
    (_req, res) => {
      res.setHeader('Cache-Control', REVALIDATED_ASSET_CACHE_CONTROL)
      res.sendFile(indexPath)
    }
  )
}

appRouter.get('/:redirectUrl', appRedirect)

const staticRoute = express.static(publicDir, {
  index: false,
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', cacheControlForStaticFile(filePath))
  }
})

export { appRouter, staticRoute }

