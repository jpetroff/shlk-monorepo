import express, { type ErrorRequestHandler, type Express } from 'express'
import session, { type CookieOptions, type Store } from 'express-session'
import Helmet, { type HelmetOptions } from 'helmet'
import config from '../config'
import { graphqlHttpHandler } from '../graphql/http'
import { appRouter, staticRoute } from './app.routes'
import { checkBanlist } from './ban.queries'
import { oauthRouter } from './oauth.routes'

const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", '*'],
      'img-src': ["'self'", '*']
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}

export function extensionCorsOrigin(value: string): string {
  const url = new URL(value)
  return `${url.protocol}//${url.host}`
}

function useApiCors(app: Express): void {
  const allowedOrigins = new Set([
    new URL(config.WEB_APP_URL).origin,
    extensionCorsOrigin(config.EXTENSION_ORIGIN)
  ])
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin')
    const allowed = origin != null && allowedOrigins.has(origin)
    if (origin && allowed) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin'
      })
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(allowed ? 204 : 403)
      return
    }
    next()
  })
}

export function sessionCookieOptions(production: boolean): CookieOptions {
  return {
    maxAge: 1000 * 60 * 60 * 24 * 30 * 6,
    httpOnly: true,
    secure: production,
    sameSite: 'lax'
  }
}

export function createApp(store: Store): Express {
  const app = express()
  const production = config.NODE_ENV === 'production'

  if (config.TRUST_PROXY !== false) app.set('trust proxy', config.TRUST_PROXY)

  // Static requests must not create a session.
  app.use(staticRoute)
  if (production) app.use(Helmet(helmetOptions))
  app.use(async (req, res, next) => {
    try {
      await checkBanlist(req.ip ?? '', 'IP')
      next()
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Sorry, this action is forbidden'
      res.status(500).json(message)
    }
  })
  useApiCors(app)

  app.use(session({
    secret: config.APP_SESSION_SECRET,
    name: 'sid',
    cookie: sessionCookieOptions(production),
    store,
    resave: false,
    saveUninitialized: false
  }))

  app.use('/api', express.json({ limit: '1mb' }), graphqlHttpHandler)
  app.use('/', oauthRouter)
  app.use('/', appRouter)

  const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (!(error instanceof SyntaxError)) {
      next(error)
      return
    }
    res.status(400).type('application/graphql-response+json').json({
      errors: [{
        message: 'Request body must be valid JSON',
        extensions: { code: 'BAD_REQUEST' }
      }]
    })
  }
  app.use(jsonErrorHandler)
  return app
}

