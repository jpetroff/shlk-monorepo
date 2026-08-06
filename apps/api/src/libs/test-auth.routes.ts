import { randomBytes, timingSafeEqual } from 'node:crypto'
import express from 'express'
import { createOrUpdateUser } from './user.queries'

const DEFAULT_TEST_EMAIL = 'playwright@example.test'
const DEFAULT_TEST_NAME = 'Playwright User'

function secretsMatch(actual: string | undefined, expected: string): boolean {
  if (!actual) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}
function browserLoginPage(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Test login</title>
</head>
<body>
  <p id="status">Signing in…</p>
  <script nonce="${nonce}">
    (() => {
      const status = document.getElementById('status')
      const params = new URLSearchParams(window.location.hash.slice(1))
      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      const secret = params.get('secret')
      if (!secret) {
        status.textContent = 'Missing test login secret.'
        return
      }

      const requestedRedirect = params.get('redirect') || '/app'
      const redirectUrl = new URL(requestedRedirect, window.location.origin)
      const redirect = redirectUrl.origin === window.location.origin
        ? redirectUrl.pathname + redirectUrl.search + redirectUrl.hash
        : '/app'

      fetch('/api/__e2e/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-e2e-auth': secret
        },
        body: JSON.stringify({
          email: params.get('email') || undefined,
          name: params.get('name') || undefined
        })
      }).then((response) => {
        if (!response.ok) throw new Error('Test login failed with status ' + response.status)
        window.location.replace(redirect)
      }).catch((error) => {
        status.textContent = error instanceof Error ? error.message : 'Test login failed.'
      })
    })()
  </script>
</body>
</html>`
}

export function createTestAuthRouter(secret: string): express.Router {
  const router = express.Router()
  router.get('/browser', (_req, res) => {
    const nonce = randomBytes(16).toString('base64')
    res.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'`,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    })
    res.type('html').send(browserLoginPage(nonce))
  })

  router.use((req, res, next) => {
    if (!secretsMatch(req.get('x-e2e-auth'), secret)) {
      res.sendStatus(404)
      return
    }
    next()
  })

  router.post('/login', express.json({ limit: '10kb' }), async (req, res, next) => {
    try {
      const email = optionalString(req.body?.email) ?? DEFAULT_TEST_EMAIL
      const name = optionalString(req.body?.name) ?? DEFAULT_TEST_NAME
      if (!email.includes('@')) {
        res.status(400).json({ message: 'email must be a valid email address' })
        return
      }

      const user = await createOrUpdateUser({ email, name, ip: req.ip })
      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          next(regenerateError)
          return
        }

        req.session.userId = user._id
        req.session.tokens = {}
        req.session.save((saveError) => {
          if (saveError) next(saveError)
          else res.sendStatus(204)
        })
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
