import { afterAll, describe, expect, test } from 'bun:test'
import session, { type SessionData } from 'express-session'
import express from 'express'
import { eq } from 'drizzle-orm'
import { db, isSafeSQLiteVersion, sqlite } from '../src/db/client'
import { migrateDatabase } from '../src/db/migrate'
import { SQLiteSessionStore } from '../src/db/sqlite-session.store'
import { shortlinks, users } from '../src/db/schema'
import {
  deleteShortlink,
  queryAndDeleteShortlinkSnoozeTimer,
  queryShortlinks,
  updateShortlink
} from '../src/libs/shortlink.queries'
import { createOrUpdateUser } from '../src/libs/user.queries'
import { createTestAuthRouter } from '../src/libs/test-auth.routes'

migrateDatabase()

const sessionStore = new SQLiteSessionStore(sqlite)
afterAll(() => sessionStore.close())

function sessionValue(maxAge = 60_000): SessionData {
  const cookie = new session.Cookie()
  cookie.maxAge = maxAge
  return {
    cookie,
    userId: 'session-user',
    tokens: {}
  }
}

function storeSet(sid: string, value: SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    sessionStore.set(sid, value, (error) => error ? reject(error) : resolve())
  })
}

function storeGet(sid: string): Promise<SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    sessionStore.get(sid, (error, value) => error ? reject(error) : resolve(value))
  })
}

function storeTouch(sid: string, value: SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    sessionStore.touch(sid, value, (error) => error ? reject(error) : resolve())
  })
}

function storeDestroy(sid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sessionStore.destroy(sid, (error) => error ? reject(error) : resolve())
  })
}

describe('SQLite bootstrap and schema', () => {
  test('uses a patched SQLite build and required connection pragmas', () => {
    const version = sqlite.query('SELECT sqlite_version() AS version').get() as {
      version: string
    }
    const foreignKeys = sqlite.query('PRAGMA foreign_keys').get() as {
      foreign_keys: number
    }
    const busyTimeout = sqlite.query('PRAGMA busy_timeout').get() as {
      timeout: number
    }
    const synchronous = sqlite.query('PRAGMA synchronous').get() as {
      synchronous: number
    }

    expect(isSafeSQLiteVersion(version.version)).toBe(true)
    expect(foreignKeys.foreign_keys).toBe(1)
    expect(busyTimeout.timeout).toBe(5000)
    expect(synchronous.synchronous).toBe(2)
  })

  test('applies the initial migration to a clean database', () => {
    const tableNames = sqlite.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).values().flat()
    expect(tableNames).toEqual(expect.arrayContaining([
      '__drizzle_migrations',
      'banlist',
      'sessions',
      'shortlinks',
      'users'
    ]))
  })
})

describe('SQLite repositories', () => {
  test('creates users while retaining defaults and allowing null OAuth tokens', async () => {
    const first = await createOrUpdateUser({
      email: 'first@example.com',
      name: 'First User'
    })
    const second = await createOrUpdateUser({
      email: 'second@example.com',
      name: 'Second User'
    })
    const updated = await createOrUpdateUser({
      email: 'first@example.com',
      name: 'First Renamed'
    })

    expect(first.userTag).toBe('first user')
    expect(second._id).not.toBe(first._id)
    expect(updated._id).toBe(first._id)
    expect(updated.userTag).toBe('first user')
    expect(updated.name).toBe('First Renamed')
  })

  test('round-trips nested values and uses literal search with safe sorting', async () => {
    const owner = db.select().from(users)
      .where(eq(users.email, 'first@example.com'))
      .get()!
    const now = new Date().toISOString()
    db.insert(shortlinks).values({
      id: 'round-trip-link',
      hash: 'rt01',
      location: 'https://example.com/path',
      descriptorUserTag: owner.userTag,
      descriptorDescriptionTag: 'hello',
      ownerId: owner.id,
      urlMetadata: { image: { width: 640 } },
      siteTitle: 'Example',
      siteDescription: 'A description',
      snoozeAwake: 4_102_444_800_000,
      snoozeDescription: 'Later',
      tags: ['one', 'two'],
      searchIndex: 'https://example.com/path|hello|Example|A description',
      createdAt: now,
      updatedAt: now
    }).run()

    const results = await queryShortlinks({
      userId: owner.id,
      search: 'EXAMPLE.COM',
      sort: 'created_at; DROP TABLE users',
      order: 'asc',
      limit: 500
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      _id: 'round-trip-link',
      owner: owner.id,
      descriptor: { userTag: owner.userTag, descriptionTag: 'hello' },
      urlMetadata: { image: { width: 640 } },
      snooze: { awake: 4_102_444_800_000, description: 'Later' },
      tags: ['one', 'two']
    })
    expect(sqlite.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).get()).not.toBeNull()
  })

  test('preserves explicitly edited metadata when changing the location', async () => {
    const owner = db.select().from(users)
      .where(eq(users.email, 'first@example.com'))
      .get()!
    const now = new Date().toISOString()
    db.insert(shortlinks).values({
      id: 'edited-metadata-link',
      hash: 'meta01',
      location: 'https://example.com/original',
      ownerId: owner.id,
      createdAt: now,
      updatedAt: now
    }).run()

    const updated = await updateShortlink(owner.id, {
      id: 'edited-metadata-link',
      shortlink: {
        location: 'http://127.0.0.1:1/updated',
        urlMetadata: { title: 'User metadata' },
        siteTitle: 'User title',
        siteDescription: 'User description'
      }
    })

    expect(updated).toMatchObject({
      location: 'http://127.0.0.1:1/updated',
      urlMetadata: { title: 'User metadata' },
      siteTitle: 'User title',
      siteDescription: 'User description'
    })
  })

  test('scopes timer deletion and link deletion to the owner', async () => {
    const owner = db.select().from(users)
      .where(eq(users.email, 'first@example.com'))
      .get()!
    const other = db.select().from(users)
      .where(eq(users.email, 'second@example.com'))
      .get()!

    expect(await queryAndDeleteShortlinkSnoozeTimer('round-trip-link', other.id)).toBeNull()
    const cleared = await queryAndDeleteShortlinkSnoozeTimer('round-trip-link', owner.id)
    expect(cleared?.snooze).toBeUndefined()

    expect(await deleteShortlink('round-trip-link', other.id)).toBeNull()
    expect((await deleteShortlink('round-trip-link', owner.id))?._id).toBe('round-trip-link')
  })
})

describe('SQLite session store', () => {
  test('sets, gets, touches, and destroys sessions', async () => {
    const original = sessionValue()
    await storeSet('active-session', original)
    expect((await storeGet('active-session'))?.userId).toBe('session-user')

    const touched = sessionValue(120_000)
    await storeTouch('active-session', touched)
    const row = sqlite.query(
      'SELECT expires_at FROM sessions WHERE sid = ?'
    ).get('active-session') as { expires_at: number }
    expect(row.expires_at).toBeGreaterThan(Date.now() + 100_000)

    await storeDestroy('active-session')
    expect(await storeGet('active-session')).toBeNull()
  })

  test('removes expired sessions and reports corrupted JSON', async () => {
    const now = Date.now()
    sqlite.query(`
      INSERT INTO sessions (sid, session_json, expires_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('expired-session', '{}', now - 1, now)
    expect(await storeGet('expired-session')).toBeNull()

    sqlite.query(`
      INSERT INTO sessions (sid, session_json, expires_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('corrupt-session', '{', now + 60_000, now)
    await expect(storeGet('corrupt-session')).rejects.toBeInstanceOf(SyntaxError)

    sessionStore.cleanupExpired(now + 120_000)
    expect(sqlite.query('SELECT sid FROM sessions WHERE sid = ?')
      .get('corrupt-session')).toBeNull()
  })
})

describe('test login endpoint', () => {
  test('creates a user and an authenticated application session', async () => {
    const app = express()
    app.use(session({
      secret: 'test-session-secret',
      store: sessionStore,
      resave: false,
      saveUninitialized: false
    }))
    app.use('/api/__e2e', createTestAuthRouter('test-e2e-secret'))
    app.get('/session', (req, res) => res.json({ userId: req.session.userId }))

    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Unable to start test server')
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const browserEntry = await fetch(`${baseUrl}/api/__e2e/browser`)
      expect(browserEntry.status).toBe(200)
      expect(browserEntry.headers.get('cache-control')).toBe('no-store')
      expect(browserEntry.headers.get('content-security-policy')).toContain("script-src 'nonce-")
      const browserHtml = await browserEntry.text()
      expect(browserHtml).toContain('window.location.hash')
      expect(browserHtml).toContain("fetch('/api/__e2e/login'")
      expect(browserHtml).not.toContain('test-e2e-secret')

      const denied = await fetch(`${baseUrl}/api/__e2e/login`, { method: 'POST' })
      expect(denied.status).toBe(404)

      const login = await fetch(`${baseUrl}/api/__e2e/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-e2e-auth': 'test-e2e-secret'
        },
        body: JSON.stringify({
          email: 'browser@example.test',
          name: 'Browser Test'
        })
      })
      expect(login.status).toBe(204)
      const cookie = login.headers.get('set-cookie')?.split(';', 1)[0]
      expect(cookie).toStartWith('connect.sid=')

      const sessionResponse = await fetch(`${baseUrl}/session`, {
        headers: { cookie: cookie! }
      })
      const sessionBody = await sessionResponse.json() as { userId?: string }
      const user = db.select().from(users)
        .where(eq(users.email, 'browser@example.test'))
        .get()
      expect(user?.name).toBe('Browser Test')
      expect(sessionBody.userId).toBe(user?.id)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    }
  })
})
