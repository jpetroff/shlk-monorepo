import express from 'express'
import path from 'node:path'
import { appRedirect } from './app.controllers'

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
      res.sendFile(indexPath)
    }
  )
}

appRouter.get('/:redirectUrl', appRedirect)

const staticRoute = express.static(publicDir, { index: false })

export { appRouter, staticRoute }

