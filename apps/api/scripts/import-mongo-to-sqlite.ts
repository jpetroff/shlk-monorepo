import { type Database, type Statement } from 'bun:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import {
  MongoClient,
  ObjectId,
  type Db,
  type Document,
  type IndexDescriptionInfo
} from 'mongodb'
import { runMigrations } from '../src/db/migration-runner'
import { openSQLite } from '../src/db/sqlite-factory'

const COLLECTIONS = ['users', 'banlists', 'shortlinks', 'sessions'] as const
const BATCH_SIZE = 500
const MAX_REPORTED_ISSUES = 100

export type MigrationCollection = typeof COLLECTIONS[number]
type SQLiteValue = string | number | bigint | Uint8Array | null

export interface NormalizedRow {
  key: string
  values: SQLiteValue[]
}

interface CollectionInventory {
  present: boolean
  count: number
  indexes: Array<{
    name: string
    key: Record<string, unknown>
    unique: boolean
    expireAfterSeconds?: number
  }>
}

export interface SourceInventory {
  mongoVersion: string
  collections: Record<MigrationCollection, CollectionInventory>
  unexpectedCollections: string[]
}

export interface MigrationSource {
  connect(): Promise<SourceInventory>
  documents(collection: MigrationCollection): AsyncIterable<Document>
  counts(): Promise<Record<MigrationCollection, number>>
  close(): Promise<void>
}

export interface ImportOptions {
  mongoUri: string
  mongoDatabase: string
  sqlitePath: string
  dryRun: boolean
}

interface CollectionCounts {
  source: number
  read: number
  written: number
  skipped: number
  destination: number
}

interface MigrationIssue {
  collection: MigrationCollection | 'migration'
  code: string
}

interface MigrationReport {
  status: 'running' | 'success' | 'dry-run' | 'failed'
  startedAt: string
  finishedAt?: string
  durationMs?: number
  database: string
  dryRun: boolean
  versions: {
    importer: 1
    mongo?: string
    sqlite?: string
  }
  inventory?: SourceInventory
  counts: Record<MigrationCollection, CollectionCounts>
  hashes: Partial<Record<MigrationCollection, { source: string, destination: string }>>
  fileSha256?: string
  checks: {
    migrations: boolean
    requiredIndexes: boolean
    json: boolean
    integrity: boolean
    foreignKeys: boolean
    stableSourceCounts: boolean
  }
  issueCount: number
  issues: MigrationIssue[]
  error?: string
}

const INSERT_SQL: Record<MigrationCollection, string> = {
  users: `
    INSERT INTO users (
      id, email, name, avatar, user_tag, id_token, access_token, refresh_token,
      ip, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  banlists: `
    INSERT INTO banlist (id, value, type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  shortlinks: `
    INSERT INTO shortlinks (
      id, hash, location, descriptor_user_tag, descriptor_description_tag,
      owner_id, url_metadata, site_title, site_description, snooze_awake,
      snooze_description, tags, search_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  sessions: `
    INSERT INTO sessions (sid, session_json, expires_at, updated_at)
    VALUES (?, ?, ?, ?)
  `
}

const SELECT_SQL: Record<MigrationCollection, string> = {
  users: `
    SELECT id, email, name, avatar, user_tag, id_token, access_token,
      refresh_token, ip, created_at, updated_at FROM users ORDER BY id
  `,
  banlists: `
    SELECT id, value, type, created_at, updated_at FROM banlist ORDER BY id
  `,
  shortlinks: `
    SELECT id, hash, location, descriptor_user_tag, descriptor_description_tag,
      owner_id, url_metadata, site_title, site_description, snooze_awake,
      snooze_description, tags, search_index, created_at, updated_at
    FROM shortlinks ORDER BY id
  `,
  sessions: `
    SELECT sid, session_json, expires_at, updated_at FROM sessions ORDER BY sid
  `
}

const REQUIRED_INDEXES = [
  'banlist_type_idx',
  'sessions_expires_idx',
  'shortlinks_descriptor_uq',
  'shortlinks_hash_uq',
  'shortlinks_owner_created_idx',
  'shortlinks_owner_location_uq',
  'shortlinks_snooze_idx',
  'users_access_token_uq',
  'users_email_uq',
  'users_id_token_uq',
  'users_refresh_token_uq'
] as const

function emptyCounts(): Record<MigrationCollection, CollectionCounts> {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, {
    source: 0,
    read: 0,
    written: 0,
    skipped: 0,
    destination: 0
  }])) as Record<MigrationCollection, CollectionCounts>
}

function emptyChecks(): MigrationReport['checks'] {
  return {
    migrations: false,
    requiredIndexes: false,
    json: false,
    integrity: false,
    foreignKeys: false,
    stableSourceCounts: false
  }
}

function assertPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field}:expected-object`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${field}:unsupported-object`)
  }
  return value as Record<string, unknown>
}

export function canonicalizeJson(value: unknown, field = 'json'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${field}:non-finite-number`)
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error(`${field}:unsafe-integer`)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalizeJson(item, `${field}[${index}]`))
  }
  const object = assertPlainObject(value, field)
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(object).sort()) {
    const item = object[key]
    if (item === undefined) throw new Error(`${field}.${key}:undefined`)
    result[key] = canonicalizeJson(item, `${field}.${key}`)
  }
  return result
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field}:required-string`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`${field}:expected-string`)
  return value
}

function identifier(value: unknown, field: string): string {
  if (value instanceof ObjectId) return value.toHexString()
  return requiredString(value, field)
}

function timestamp(value: unknown, field: string): string {
  const date = value instanceof Date
    ? value
    : typeof value === 'string'
      ? new Date(value)
      : null
  if (!date || !Number.isFinite(date.valueOf())) throw new Error(`${field}:invalid-timestamp`)
  return date.toISOString()
}

function epochMilliseconds(value: unknown, field: string): number {
  const date = value instanceof Date
    ? value
    : typeof value === 'string'
      ? new Date(value)
      : null
  if (!date || !Number.isFinite(date.valueOf())) throw new Error(`${field}:invalid-timestamp`)
  return date.valueOf()
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value == null) return null
  return assertPlainObject(value, field)
}

function jsonText(value: unknown, field: string): string | null {
  if (value == null) return null
  try {
    return JSON.stringify(canonicalizeJson(value, field))
  } catch {
    throw new Error(`${field}:invalid-json-value`)
  }
}

export function normalizeUser(doc: Document): NormalizedRow {
  const key = identifier(doc._id, 'users._id')
  return {
    key,
    values: [
      key,
      requiredString(doc.email, 'users.email'),
      requiredString(doc.name, 'users.name'),
      optionalString(doc.avatar, 'users.avatar'),
      optionalString(doc.userTag, 'users.userTag'),
      optionalString(doc.id_token, 'users.id_token'),
      optionalString(doc.access_token, 'users.access_token'),
      optionalString(doc.refresh_token, 'users.refresh_token'),
      optionalString(doc.ip, 'users.ip'),
      timestamp(doc.createdAt, 'users.createdAt'),
      timestamp(doc.updatedAt, 'users.updatedAt')
    ]
  }
}

export function normalizeBanlist(doc: Document): NormalizedRow {
  const key = identifier(doc._id, 'banlists._id')
  const type = requiredString(doc.type, 'banlists.type')
  if (type !== 'IP' && type !== 'user' && type !== 'location') {
    throw new Error('banlists.type:invalid-value')
  }
  return {
    key,
    values: [
      key,
      requiredString(doc.value, 'banlists.value'),
      type,
      timestamp(doc.createdAt, 'banlists.createdAt'),
      timestamp(doc.updatedAt, 'banlists.updatedAt')
    ]
  }
}

export function normalizeShortlink(doc: Document): NormalizedRow {
  const key = identifier(doc._id, 'shortlinks._id')
  const descriptor = optionalObject(doc.descriptor, 'shortlinks.descriptor')
  const snooze = optionalObject(doc.snooze, 'shortlinks.snooze')
  const location = requiredString(doc.location, 'shortlinks.location')
  const descriptionTag = optionalString(
    descriptor?.descriptionTag,
    'shortlinks.descriptor.descriptionTag'
  )
  const siteTitle = optionalString(doc.siteTitle, 'shortlinks.siteTitle')
  const siteDescription = optionalString(doc.siteDescription, 'shortlinks.siteDescription')

  let snoozeAwake: number | null = null
  if (snooze?.awake != null) {
    if (typeof snooze.awake !== 'number' || !Number.isSafeInteger(snooze.awake)) {
      throw new Error('shortlinks.snooze.awake:unsafe-integer')
    }
    snoozeAwake = snooze.awake
  }

  let tags: string | null = null
  if (doc.tags != null) {
    if (!Array.isArray(doc.tags) || !doc.tags.every((tag) => typeof tag === 'string')) {
      throw new Error('shortlinks.tags:expected-string-array')
    }
    tags = JSON.stringify(doc.tags)
  }

  const searchIndex = [
    location,
    descriptionTag ?? '',
    siteTitle ?? '',
    siteDescription ?? ''
  ].join('|')

  return {
    key,
    values: [
      key,
      requiredString(doc.hash, 'shortlinks.hash'),
      location,
      optionalString(descriptor?.userTag, 'shortlinks.descriptor.userTag'),
      descriptionTag,
      doc.owner == null ? null : identifier(doc.owner, 'shortlinks.owner'),
      jsonText(doc.urlMetadata, 'shortlinks.urlMetadata'),
      siteTitle,
      siteDescription,
      snoozeAwake,
      optionalString(snooze?.description, 'shortlinks.snooze.description'),
      tags,
      searchIndex,
      timestamp(doc.createdAt, 'shortlinks.createdAt'),
      timestamp(doc.updatedAt, 'shortlinks.updatedAt')
    ]
  }
}

export function normalizeSession(doc: Document, importedAt: number): NormalizedRow | null {
  const key = requiredString(doc._id, 'sessions._id')
  const expiresAt = epochMilliseconds(doc.expires, 'sessions.expires')
  if (expiresAt <= importedAt) return null
  const sessionJson = requiredString(doc.session, 'sessions.session')
  let parsed: unknown
  try {
    parsed = JSON.parse(sessionJson)
  } catch {
    throw new Error('sessions.session:invalid-json')
  }
  try {
    canonicalizeJson(assertPlainObject(parsed, 'sessions.session'), 'sessions.session')
  } catch {
    throw new Error('sessions.session:invalid-json-value')
  }
  return { key, values: [key, sessionJson, expiresAt, importedAt] }
}

function normalizeIndex(index: IndexDescriptionInfo): CollectionInventory['indexes'][number] {
  return {
    name: index.name ?? 'unnamed',
    key: Object.fromEntries(Object.entries(index.key ?? {}).map(([key, value]) => [
      key,
      typeof value === 'number' || typeof value === 'string' ? value : String(value)
    ])),
    unique: index.unique === true,
    ...(typeof index.expireAfterSeconds === 'number'
      ? { expireAfterSeconds: index.expireAfterSeconds }
      : {})
  }
}

export class AtlasMigrationSource implements MigrationSource {
  private readonly client: MongoClient
  private database?: Db
  private present = new Set<string>()

  constructor(uri: string, private readonly databaseName: string) {
    this.client = new MongoClient(uri, {
      appName: 'shlk-mongodb-to-sqlite-migration',
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      serverSelectionTimeoutMS: 15_000
    })
  }

  async connect(): Promise<SourceInventory> {
    await this.client.connect()
    this.database = this.client.db(this.databaseName)
    await this.database.command({ ping: 1 })
    const buildInfo = await this.database.command({ buildInfo: 1 }) as { version?: string }
    const names = (await this.database.listCollections({}, { nameOnly: true }).toArray())
      .map(({ name }) => name)
    this.present = new Set(names)
    const unexpectedCollections = names
      .filter((name) => !name.startsWith('system.') && !COLLECTIONS.includes(
        name as MigrationCollection
      ))
      .sort()

    const collections = {} as Record<MigrationCollection, CollectionInventory>
    for (const name of COLLECTIONS) {
      const present = this.present.has(name)
      collections[name] = {
        present,
        count: present ? await this.database.collection(name).countDocuments({}) : 0,
        indexes: present
          ? (await this.database.collection(name).indexes()).map(normalizeIndex)
          : []
      }
    }
    return {
      mongoVersion: buildInfo.version ?? 'unknown',
      collections,
      unexpectedCollections
    }
  }

  async *documents(collection: MigrationCollection): AsyncIterable<Document> {
    if (!this.database) throw new Error('migration-source:not-connected')
    if (!this.present.has(collection)) return
    const cursor = this.database.collection(collection)
      .find({}, { readConcern: { level: 'majority' } })
      .sort({ _id: 1 })
      .batchSize(BATCH_SIZE)
    for await (const document of cursor) yield document
  }

  async counts(): Promise<Record<MigrationCollection, number>> {
    if (!this.database) throw new Error('migration-source:not-connected')
    const result = {} as Record<MigrationCollection, number>
    for (const name of COLLECTIONS) {
      result[name] = this.present.has(name)
        ? await this.database.collection(name).countDocuments({})
        : 0
    }
    return result
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}

function targetSidecars(path: string): string[] {
  return [path, `${path}-wal`, `${path}-shm`, `${path}-journal`]
}

export function assertTargetAvailable(path: string): void {
  const existing = targetSidecars(path).filter(existsSync)
  if (existing.length > 0) throw new Error('target:already-exists')
}

function removeDatabase(path: string): void {
  for (const candidate of targetSidecars(path)) rmSync(candidate, { force: true })
}

function issueCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('UNIQUE constraint failed')) {
    const columns = message.split(':').at(-1)?.trim().replaceAll(', ', '+') ?? 'unknown'
    return `unique:${columns}`
  }
  if (message.includes('FOREIGN KEY constraint failed')) return 'foreign-key'
  if (message.includes('CHECK constraint failed')) return 'check-constraint'
  if (/^[a-z]+(?:\.[a-zA-Z_]+)*(?::[a-z-]+)$/.test(message)) return message
  return 'unexpected-error'
}

function writeReport(path: string, report: MigrationReport): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  chmodSync(temporary, 0o600)
  renameSync(temporary, path)
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function updateDigest(hash: ReturnType<typeof createHash>, row: SQLiteValue[]): void {
  hash.update(`${JSON.stringify(row)}\n`)
}

function destinationDigest(database: Database, collection: MigrationCollection): string {
  const hash = createHash('sha256')
  const rows = database.query(SELECT_SQL[collection]).iterate() as Iterable<
    Record<string, SQLiteValue>
  >
  for (const row of rows) updateDigest(hash, Object.values(row))
  return hash.digest('hex')
}

function destinationCount(database: Database, collection: MigrationCollection): number {
  const table = collection === 'banlists' ? 'banlist' : collection
  const row = database.query(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

function runDatabaseChecks(database: Database, report: MigrationReport): void {
  const migrations = database.query(
    'SELECT count(*) AS count FROM __drizzle_migrations'
  ).get() as { count: number }
  report.checks.migrations = migrations.count > 0

  const indexes = new Set((database.query(
    "SELECT name FROM sqlite_master WHERE type = 'index'"
  ).values() as string[][]).flat())
  report.checks.requiredIndexes = REQUIRED_INDEXES.every((name) => indexes.has(name))

  const invalidJson = database.query(`
    SELECT
      (SELECT count(*) FROM shortlinks
        WHERE url_metadata IS NOT NULL AND json_valid(url_metadata) = 0) +
      (SELECT count(*) FROM shortlinks
        WHERE tags IS NOT NULL AND json_valid(tags) = 0) +
      (SELECT count(*) FROM sessions WHERE json_valid(session_json) = 0) AS count
  `).get() as { count: number }
  report.checks.json = invalidJson.count === 0

  const integrity = database.query('PRAGMA integrity_check').values()
  report.checks.integrity = JSON.stringify(integrity) === JSON.stringify([['ok']])
  report.checks.foreignKeys = database.query('PRAGMA foreign_key_check').values().length === 0

  const failed = Object.entries(report.checks)
    .filter(([name, value]) => name !== 'stableSourceCounts' && !value)
    .map(([name]) => name)
  if (failed.length > 0) throw new Error(`validation:${failed.join('+')}`)
}

function normalizer(
  collection: MigrationCollection,
  importedAt: number
): (document: Document) => NormalizedRow | null {
  switch (collection) {
    case 'users': return normalizeUser
    case 'banlists': return normalizeBanlist
    case 'shortlinks': return normalizeShortlink
    case 'sessions': return (document) => normalizeSession(document, importedAt)
  }
}

function runStatement(statement: Statement, values: SQLiteValue[]): void {
  statement.run(...values)
}

async function importCollection(
  source: MigrationSource,
  target: Database,
  collection: MigrationCollection,
  importedAt: number,
  report: MigrationReport,
  sourceHash: ReturnType<typeof createHash>
): Promise<void> {
  const insert = target.prepare(INSERT_SQL[collection])
  const normalize = normalizer(collection, importedAt)
  const batch: Document[] = []

  const writeBatch = target.transaction((documents: Document[]) => {
    for (const document of documents) {
      report.counts[collection].read += 1
      try {
        const row = normalize(document)
        if (!row) {
          report.counts[collection].skipped += 1
          continue
        }
        runStatement(insert, row.values)
        updateDigest(sourceHash, row.values)
        report.counts[collection].written += 1
      } catch (error) {
        report.issueCount += 1
        if (report.issues.length < MAX_REPORTED_ISSUES) {
          report.issues.push({ collection, code: issueCode(error) })
        }
      }
    }
  })

  for await (const document of source.documents(collection)) {
    batch.push(document)
    if (batch.length === BATCH_SIZE) {
      writeBatch(batch)
      batch.length = 0
    }
  }
  if (batch.length > 0) writeBatch(batch)
}

function redactError(error: unknown, mongoUri: string): string {
  let redacted = (error instanceof Error ? error.message : String(error))
    .replaceAll(mongoUri, '[REDACTED_MONGO_URI]')
  try {
    const parsed = new URL(mongoUri)
    const secrets = [
      parsed.username,
      parsed.password,
      decodeURIComponent(parsed.username),
      decodeURIComponent(parsed.password)
    ].filter((secret) => secret.length > 0)
    for (const secret of secrets) redacted = redacted.replaceAll(secret, '[REDACTED]')
  } catch {
    // The MongoDB driver will report malformed URIs; the exact URI is already redacted.
  }
  return redacted.slice(0, 500)
}

export async function runMongoImport(
  options: ImportOptions,
  providedSource?: MigrationSource
): Promise<MigrationReport> {
  const startedAtMs = Date.now()
  const finalPath = resolve(options.sqlitePath)
  const reportPath = `${finalPath}.migration-report.json`
  const stagingPath = `${finalPath}.importing-${process.pid}-${randomUUID()}`
  const report: MigrationReport = {
    status: 'running',
    startedAt: new Date(startedAtMs).toISOString(),
    database: options.mongoDatabase,
    dryRun: options.dryRun,
    versions: { importer: 1 },
    counts: emptyCounts(),
    hashes: {},
    checks: emptyChecks(),
    issueCount: 0,
    issues: []
  }
  const source = providedSource ?? new AtlasMigrationSource(
    options.mongoUri,
    options.mongoDatabase
  )
  let target: Database | undefined
  let sourceNeedsClose = true

  try {
    assertTargetAvailable(finalPath)
    mkdirSync(dirname(finalPath), { recursive: true, mode: 0o700 })

    const inventory = await source.connect()
    report.inventory = inventory
    report.versions.mongo = inventory.mongoVersion
    if (inventory.unexpectedCollections.length > 0) {
      throw new Error('source:unexpected-collections')
    }
    const totalSourceRows = COLLECTIONS.reduce(
      (total, name) => total + inventory.collections[name].count,
      0
    )
    if (totalSourceRows === 0) throw new Error('source:empty')
    for (const name of COLLECTIONS) {
      report.counts[name].source = inventory.collections[name].count
    }

    target = openSQLite(stagingPath, true)
    chmodSync(stagingPath, 0o600)
    report.versions.sqlite = (target.query(
      'SELECT sqlite_version() AS version'
    ).get() as { version: string }).version
    runMigrations(drizzle({ client: target }))

    const sourceHashes = Object.fromEntries(COLLECTIONS.map((name) => [
      name,
      createHash('sha256')
    ])) as Record<MigrationCollection, ReturnType<typeof createHash>>
    for (const name of COLLECTIONS) {
      await importCollection(source, target, name, startedAtMs, report, sourceHashes[name])
    }

    if (report.issueCount > 0) throw new Error(`source:validation-issues:${report.issueCount}`)

    const finalSourceCounts = await source.counts()
    report.checks.stableSourceCounts = COLLECTIONS.every(
      (name) => finalSourceCounts[name] === report.counts[name].source
    )
    if (!report.checks.stableSourceCounts) throw new Error('source:counts-changed')
    await source.close()
    sourceNeedsClose = false

    for (const name of COLLECTIONS) {
      report.counts[name].destination = destinationCount(target, name)
      if (report.counts[name].destination !== report.counts[name].written) {
        throw new Error(`validation:${name}-count`)
      }
      const sourceDigest = sourceHashes[name].digest('hex')
      const targetDigest = destinationDigest(target, name)
      report.hashes[name] = { source: sourceDigest, destination: targetDigest }
      if (sourceDigest !== targetDigest) throw new Error(`validation:${name}-hash`)
    }

    runDatabaseChecks(target, report)
    target.exec('ANALYZE; PRAGMA optimize; VACUUM;')
    const checkpoint = target.query('PRAGMA wal_checkpoint(TRUNCATE)').get() as {
      busy: number
      log: number
      checkpointed: number
    }
    if (checkpoint.busy !== 0 || checkpoint.log !== 0) {
      throw new Error('target:wal-checkpoint-incomplete')
    }
    target.close(false)
    target = undefined

    for (const sidecar of targetSidecars(stagingPath).slice(1)) rmSync(sidecar, { force: true })
    const remainingSidecars = targetSidecars(stagingPath).slice(1).filter(existsSync)
    if (remainingSidecars.length > 0) throw new Error('target:sqlite-sidecars-remain')
    report.fileSha256 = await sha256File(stagingPath)

    if (options.dryRun) {
      removeDatabase(stagingPath)
      report.status = 'dry-run'
    } else {
      assertTargetAvailable(finalPath)
      renameSync(stagingPath, finalPath)
      chmodSync(finalPath, 0o600)
      report.status = 'success'
    }
  } catch (error) {
    if (target) {
      try {
        target.close(false)
      } catch {
        // Continue cleanup and preserve the original failure.
      }
    }
    removeDatabase(stagingPath)
    report.status = 'failed'
    report.error = redactError(error, options.mongoUri)
  } finally {
    if (sourceNeedsClose) {
      try {
        await source.close()
      } catch (error) {
        if (report.status !== 'failed') {
          report.status = 'failed'
          report.error = redactError(error, options.mongoUri)
          removeDatabase(finalPath)
        }
      }
    }
    const finishedAtMs = Date.now()
    report.finishedAt = new Date(finishedAtMs).toISOString()
    report.durationMs = finishedAtMs - startedAtMs
    writeReport(reportPath, report)
  }

  if (report.status === 'failed') throw new Error(report.error ?? 'migration:failed')
  return report
}

function usage(): string {
  return [
    'Usage: bun run db:import:mongo -- [--dry-run]',
    '',
    'Required environment variables:',
    '  MIGRATION_MONGO_URI       Complete MongoDB Atlas connection URI',
    '  MIGRATION_SQLITE_PATH     New SQLite destination path',
    '',
    'Optional environment variables:',
    '  MIGRATION_MONGO_DB        Source database name (default: shlk)'
  ].join('\n')
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2)
  if (arguments_.includes('--help')) {
    console.log(usage())
    return
  }
  const unsupported = arguments_.filter((argument) => argument !== '--dry-run')
  if (unsupported.length > 0) throw new Error(`Unsupported arguments: ${unsupported.join(', ')}`)

  const mongoUri = process.env.MIGRATION_MONGO_URI?.trim() ?? ''
  const sqlitePath = process.env.MIGRATION_SQLITE_PATH?.trim() ?? ''
  if (!mongoUri) throw new Error('MIGRATION_MONGO_URI is required')
  if (!sqlitePath) throw new Error('MIGRATION_SQLITE_PATH is required')

  const report = await runMongoImport({
    mongoUri,
    mongoDatabase: process.env.MIGRATION_MONGO_DB?.trim() || 'shlk',
    sqlitePath,
    dryRun: arguments_.includes('--dry-run')
  })
  console.log(JSON.stringify({
    status: report.status,
    counts: report.counts,
    fileSha256: report.fileSha256
  }, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
