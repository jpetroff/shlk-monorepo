import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ObjectId, type Document } from 'mongodb'
import {
  canonicalizeJson,
  normalizeSession,
  normalizeShortlink,
  runMongoImport,
  type MigrationCollection,
  type MigrationSource,
  type SourceInventory
} from '../scripts/import-mongo-to-sqlite'

const temporaryDirectories: string[] = []
const createdAt = new Date('2024-01-01T00:00:00.000Z')
const updatedAt = new Date('2024-01-02T00:00:00.000Z')
const userId = new ObjectId('65a000000000000000000001')
const linkId = new ObjectId('65a000000000000000000002')
const banId = new ObjectId('65a000000000000000000003')

function temporaryPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'shlk-mongo-import-'))
  temporaryDirectories.push(directory)
  return join(directory, 'shlk.sqlite')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function documents(): Record<MigrationCollection, Document[]> {
  return {
    users: [{
      _id: userId,
      email: 'owner@example.com',
      name: 'Owner',
      userTag: 'owner',
      id_token: 'sensitive-oauth-token',
      createdAt,
      updatedAt
    }],
    banlists: [{
      _id: banId,
      value: '192.0.2.1',
      type: 'IP',
      createdAt,
      updatedAt
    }],
    shortlinks: [{
      _id: linkId,
      hash: 'abcd',
      location: 'https://example.com',
      descriptor: { userTag: 'owner', descriptionTag: 'example' },
      owner: userId,
      urlMetadata: { z: 1, nested: { b: true, a: 'first' } },
      siteTitle: 'Example',
      siteDescription: 'Description',
      snooze: { awake: 4_102_444_800_000, description: 'Later' },
      tags: ['one', 'two'],
      _searchIndex: 'stale value',
      createdAt,
      updatedAt
    }],
    sessions: [{
      _id: 'active-session',
      session: JSON.stringify({
        cookie: { expires: '2099-01-01T00:00:00.000Z' },
        userId: userId.toHexString(),
        marker: 'sensitive-session-value'
      }),
      expires: new Date('2099-01-01T00:00:00.000Z')
    }, {
      _id: 'expired-session',
      session: JSON.stringify({ cookie: {}, marker: 'expired' }),
      expires: new Date('2020-01-01T00:00:00.000Z')
    }]
  }
}

class FakeSource implements MigrationSource {
  closed = false

  constructor(
    private readonly rows: Record<MigrationCollection, Document[]>,
    private readonly unexpectedCollections: string[] = []
  ) {}

  async connect(): Promise<SourceInventory> {
    return {
      mongoVersion: 'fixture',
      unexpectedCollections: this.unexpectedCollections,
      collections: {
        users: this.inventory('users'),
        banlists: this.inventory('banlists'),
        shortlinks: this.inventory('shortlinks'),
        sessions: this.inventory('sessions')
      }
    }
  }

  private inventory(name: MigrationCollection) {
    return {
      present: this.rows[name].length > 0,
      count: this.rows[name].length,
      indexes: []
    }
  }

  async *documents(name: MigrationCollection): AsyncIterable<Document> {
    for (const document of this.rows[name]) yield document
  }

  async counts(): Promise<Record<MigrationCollection, number>> {
    return {
      users: this.rows.users.length,
      banlists: this.rows.banlists.length,
      shortlinks: this.rows.shortlinks.length,
      sessions: this.rows.sessions.length
    }
  }

  async close(): Promise<void> {
    this.closed = true
  }
}

function options(sqlitePath: string, dryRun = false) {
  return {
    mongoUri: 'mongodb+srv://migration-user:super-secret@example.invalid/shlk',
    mongoDatabase: 'shlk',
    sqlitePath,
    dryRun
  }
}

describe('MongoDB to SQLite transformations', () => {
  test('canonicalizes nested JSON and rejects BSON-only values', () => {
    expect(canonicalizeJson({ z: 1, a: { y: true, x: null } })).toEqual({
      a: { x: null, y: true },
      z: 1
    })

    expect(() => normalizeShortlink({
      ...documents().shortlinks[0],
      urlMetadata: { generatedAt: new Date() }
    })).toThrow('invalid-json-value')
  })

  test('recomputes search text and preserves nested values', () => {
    const row = normalizeShortlink(documents().shortlinks[0])
    expect(row.key).toBe(linkId.toHexString())
    expect(row.values[12]).toBe(
      'https://example.com|example|Example|Description'
    )
    expect(JSON.parse(String(row.values[6]))).toEqual({
      nested: { a: 'first', b: true },
      z: 1
    })
  })

  test('skips expired sessions and rejects corrupt active sessions', () => {
    expect(normalizeSession(documents().sessions[1], Date.now())).toBeNull()
    expect(() => normalizeSession({
      _id: 'corrupt',
      session: '{',
      expires: new Date('2099-01-01T00:00:00.000Z')
    }, Date.now())).toThrow('invalid-json')
  })
})

describe('MongoDB to SQLite importer', () => {
  test('publishes a validated database and redacted report', async () => {
    const path = temporaryPath()
    const source = new FakeSource(documents())
    const report = await runMongoImport(options(path), source)

    expect(report.status).toBe('success')
    expect(report.counts.sessions).toMatchObject({
      source: 2,
      read: 2,
      written: 1,
      skipped: 1,
      destination: 1
    })
    expect(report.hashes.users?.source).toBe(report.hashes.users?.destination)
    expect(source.closed).toBe(true)
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).mode & 0o777).toBe(0o600)

    const database = new Database(path, { strict: true })
    const link = database.query(
      'SELECT owner_id, search_index, url_metadata FROM shortlinks'
    ).get() as {
      owner_id: string
      search_index: string
      url_metadata: string
    }
    expect(link.owner_id).toBe(userId.toHexString())
    expect(link.search_index).toBe(
      'https://example.com|example|Example|Description'
    )
    expect(JSON.parse(link.url_metadata)).toEqual({
      nested: { a: 'first', b: true },
      z: 1
    })
    expect(database.query('SELECT count(*) AS count FROM sessions').get()).toEqual({
      count: 1
    })
    database.close()

    const reportText = readFileSync(path + '.migration-report.json', 'utf8')
    expect(reportText).not.toContain('super-secret')
    expect(reportText).not.toContain('sensitive-oauth-token')
    expect(reportText).not.toContain('sensitive-session-value')
  })

  test('dry-run validates fully without publishing a database', async () => {
    const path = temporaryPath()
    const report = await runMongoImport(options(path, true), new FakeSource(documents()))

    expect(report.status).toBe('dry-run')
    expect(report.fileSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(existsSync(path)).toBe(false)
    expect(existsSync(path + '.migration-report.json')).toBe(true)
  })

  test('refuses an existing target before reading source data', async () => {
    const path = temporaryPath()
    const database = new Database(path, { create: true })
    database.close()
    const source = new FakeSource(documents())

    await expect(runMongoImport(options(path), source)).rejects.toThrow(
      'target:already-exists'
    )
    expect(source.closed).toBe(true)
  })

  test('reports constraints and removes every staging artifact', async () => {
    const path = temporaryPath()
    const rows = documents()
    rows.users.push({
      ...rows.users[0],
      _id: new ObjectId('65a000000000000000000004'),
      name: 'Duplicate',
      id_token: null
    })

    await expect(runMongoImport(options(path), new FakeSource(rows))).rejects.toThrow(
      'source:validation-issues'
    )
    expect(existsSync(path)).toBe(false)
    expect(readdirSync(join(path, '..')).some((name) => name.includes('.importing-'))).toBe(false)

    const reportText = readFileSync(path + '.migration-report.json', 'utf8')
    const report = JSON.parse(reportText)
    expect(report.status).toBe('failed')
    expect(report.issues).toContainEqual({
      collection: 'users',
      code: 'unique:users.email'
    })
    expect(reportText).not.toContain('super-secret')
  })

  test('rejects unexpected collections and orphan owners', async () => {
    const unexpectedPath = temporaryPath()
    await expect(runMongoImport(
      options(unexpectedPath),
      new FakeSource(documents(), ['audit_events'])
    )).rejects.toThrow('source:unexpected-collections')

    const orphanPath = temporaryPath()
    const rows = documents()
    rows.shortlinks[0] = {
      ...rows.shortlinks[0],
      owner: new ObjectId('65a000000000000000000099')
    }
    await expect(runMongoImport(options(orphanPath), new FakeSource(rows))).rejects.toThrow(
      'source:validation-issues'
    )
    const report = JSON.parse(readFileSync(
      orphanPath + '.migration-report.json',
      'utf8'
    ))
    expect(report.issues).toContainEqual({
      collection: 'shortlinks',
      code: 'foreign-key'
    })
  })
})
