import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import express from 'express'
import type { Server } from 'node:http'
import { db } from '../src/db/client'
import { migrateDatabase } from '../src/db/migrate'
import { shortlinks } from '../src/db/schema'
import { appRouter } from '../src/libs/app.routes'
import { banLocation } from '../src/libs/ban.queries'

migrateDatabase()

const app = express()
app.use(appRouter)

let server: Server
let baseUrl: string

beforeAll(async () => {
  const now = new Date().toISOString()
  db.insert(shortlinks).values([
    {
      id: 'canonical-redirect-link',
      hash: 'canon',
      location: 'https://example.com/article?item=1',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'descriptive-redirect-link',
      hash: 'descr',
      location: 'https://example.org/preview',
      descriptorUserTag: 'alice',
      descriptorDescriptionTag: 'preview',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'blocked-redirect-link',
      hash: 'block',
      location: 'https://blocked.example/phishing',
      createdAt: now,
      updatedAt: now
    }
  ]).run()
  banLocation('https://blocked.example/phishing')

  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to start test server')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

function expectRedirectHeaders(response: Response, location: string): void {
  expect(response.status).toBe(301)
  expect(response.headers.get('location')).toBe(location)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-robots-tag')).toBe('noindex')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
}

describe('shortlink redirect HTTP contract', () => {
  test('redirects hash and descriptive URLs permanently with canonical headers', async () => {
    const hashResponse = await fetch(`${baseUrl}/canon`, { redirect: 'manual' })
    const descriptiveResponse = await fetch(`${baseUrl}/alice@preview`, {
      redirect: 'manual'
    })

    expectRedirectHeaders(hashResponse, 'https://example.com/article?item=1')
    expectRedirectHeaders(descriptiveResponse, 'https://example.org/preview')
    expect(await hashResponse.text()).toBe('')
    expect(await descriptiveResponse.text()).toBe('')
  })

  test('handles HEAD like GET and does not vary behavior by crawler user-agent', async () => {
    const userAgents = [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'Slackbot 1.0 (+https://api.slack.com/robots)',
      'TelegramBot (like TwitterBot)'
    ]
    const links = [
      ['/canon', 'https://example.com/article?item=1'],
      ['/alice@preview', 'https://example.org/preview']
    ] as const

    for (const userAgent of userAgents) {
      for (const [path, location] of links) {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'HEAD',
          redirect: 'manual',
          headers: { 'User-Agent': userAgent }
        })
        expectRedirectHeaders(response, location)
        expect(await response.text()).toBe('')
      }
    }
  })

  test('uses the edited destination on the next uncached request', async () => {
    db.update(shortlinks).set({
      location: 'https://example.net/updated',
      updatedAt: new Date().toISOString()
    }).where(eq(shortlinks.id, 'canonical-redirect-link')).run()

    const response = await fetch(`${baseUrl}/canon`, { redirect: 'manual' })
    expectRedirectHeaders(response, 'https://example.net/updated')
  })

  test('returns non-indexable 404 and 410 responses without a Location header', async () => {
    const missing = await fetch(`${baseUrl}/missing`, { redirect: 'manual' })
    const blocked = await fetch(`${baseUrl}/block`, { redirect: 'manual' })

    expect(missing.status).toBe(404)
    expect(missing.headers.get('location')).toBeNull()
    expect(missing.headers.get('x-robots-tag')).toBe('noindex')

    expect(blocked.status).toBe(410)
    expect(blocked.headers.get('location')).toBeNull()
    expect(blocked.headers.get('x-robots-tag')).toBe('noindex')
  })

  test('ships a permissive robots policy', async () => {
    const robotsUrl = new URL('../../web/public/robots.txt', import.meta.url)
    const robots = await Bun.file(robotsUrl).text()
    expect(robots).toBe('User-agent: *\nDisallow:\n')
  })
})
