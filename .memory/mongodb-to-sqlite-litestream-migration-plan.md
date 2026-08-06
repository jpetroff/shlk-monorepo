# MongoDB to SQLite migration plan (optional Litestream replication)

Status: research and implementation plan only  
Prepared: 2026-08-04  
Repository: SHLK Bun monorepo  
Scope rule: this document is the only project artifact created. No backend,
frontend, package, lock, Docker, environment, or database files were changed.

## 1. Recommended outcome

Replace Mongoose and MongoDB with:

- **SQLite through Bun's built-in `bun:sqlite` driver**. No separate native
  SQLite npm driver is needed.
- **Drizzle ORM** for typed schemas, queries, and checked-in SQL migrations.
- **A small `express-session` Store implemented on the same SQLite connection**
  (or a separate session database if forced logout after restore is preferred).
- **Litestream 0.5.x as an optional sidecar** replicating the SQLite file to S3
  or an S3-compatible destination. Pin a patch release and image digest; the
  researched current image is `litestream/litestream:0.5.15`.

Keep the GraphQL schema and client contract stable. Continue returning `_id`,
`owner`, `createdAt`, `updatedAt`, nested `descriptor`, nested `snooze`, `tags`,
and `urlMetadata` in their current shapes. Preserve every existing Mongo
ObjectId as its 24-character text value during import. New rows can use
`crypto.randomUUID()` because GraphQL `ID` is opaque and the frontend treats IDs
as arbitrary strings.

This is a good fit only while SHLK runs **one writable application instance on
one host-local disk**. SQLite WAL permits concurrent readers but only one writer
at a time. Litestream is asynchronous disaster-recovery replication, not a
multi-writer database, automatic failover service, or zero-data-loss system.

## 2. Key decisions to approve before implementation

| Decision | Recommendation | Reason |
| --- | --- | --- |
| SQLite access | Drizzle ORM + `bun:sqlite` | Typed, SQL-like query API; no native npm driver; migration files can be reviewed and committed. |
| IDs | Preserve Mongo IDs as `TEXT`; UUIDs for new rows | Keeps sessions, owners, GraphQL IDs, and browser state valid without retaining Mongo at runtime. |
| Embedded objects | Flatten `descriptor` and `snooze`; JSON text for `urlMetadata` and `tags` | Frequently queried fields get normal columns/indexes; genuinely flexible fields retain their shape. |
| Sessions | Same SQLite file initially | Preserves logins and gives one backup/restore unit. Expired-row cleanup must replace Mongo TTL behavior. |
| Search | Case-insensitive literal substring over `_search_index` initially | Closest behavior to the current escaped Mongo regex. Consider FTS5 only after measuring. |
| Cutover | Offline final import in a maintenance window | Avoids dual-write complexity and makes the source snapshot internally consistent. |
| Litestream | Optional sidecar, local named volume, S3 replica | Fits the current Compose deployment and keeps backup concerns outside application code. |
| Durability | Start with `synchronous=FULL` | SHLK is not write-heavy enough to justify accepting the power-loss window of `NORMAL` before benchmarking. |
| Schema rollout | Generated, reviewed SQL migrations; never production `push` | Produces reproducible, auditable database state. |

## 3. What is Mongo-specific in this repository

### Direct persistence coupling

- [`apps/api/src/libs/connect.db.ts`](../apps/api/src/libs/connect.db.ts) connects
  Mongoose and constructs the `connect-mongo` session store.
- [`apps/api/src/models/user.ts`](../apps/api/src/models/user.ts),
  [`shortlink.ts`](../apps/api/src/models/shortlink.ts), and
  [`banlist.ts`](../apps/api/src/models/banlist.ts) define Mongoose schemas,
  indexes, timestamps, `ObjectId`, mixed objects, and unique-validator plugins.
- [`apps/api/src/models/declarations.d.ts`](../apps/api/src/models/declarations.d.ts)
  globally aliases Mongoose hydrated documents, queries, and ObjectIds.
- [`apps/api/src/libs/user.queries.ts`](../apps/api/src/libs/user.queries.ts),
  [`shortlink.queries.ts`](../apps/api/src/libs/shortlink.queries.ts), and
  [`ban.queries.ts`](../apps/api/src/libs/ban.queries.ts) use Mongoose query
  builders, document mutation, `.save()`, `.lean()`, `.toObject()`, Mongo update
  operators, regular expressions, and dynamic Mongo sorting.
- [`apps/api/src/libs/utils.ts`](../apps/api/src/libs/utils.ts) accepts ObjectIds
  in `sameOrNoOwnerID()`.

### Callers that assume hydrated Mongoose documents

- [`apps/api/src/graphql/resolvers/auth.resolvers.ts`](../apps/api/src/graphql/resolvers/auth.resolvers.ts)
  and [`public.resolvers.ts`](../apps/api/src/graphql/resolvers/public.resolvers.ts)
  call `.toObject()`.
- [`apps/api/src/libs/oauth.controllers.ts`](../apps/api/src/libs/oauth.controllers.ts)
  converts `user._id` to a string before placing it in the session.
- [`apps/api/src/libs/app.controllers.ts`](../apps/api/src/libs/app.controllers.ts)
  receives `ShortlinkDocument` from the query layer, but otherwise has no Mongo
  behavior.

### Configuration, packages, tests, and deployment

- [`apps/api/src/config.ts`](../apps/api/src/config.ts) requires and validates
  `MONGO_URI`.
- [`apps/api/src/index.ts`](../apps/api/src/index.ts) connects Mongo before
  creating the app and session store.
- [`apps/api/package.json`](../apps/api/package.json) contains `connect-mongo`,
  `mongodb`, `mongoose`, and `mongoose-unique-validator`.
- [`apps/api/test/migration.test.ts`](../apps/api/test/migration.test.ts) embeds a
  production-valid `MONGO_URI` fixture but has no database integration tests.
- [`compose.yaml`](../compose.yaml) provisions Mongo, credentials, health checks,
  dependency ordering, and `mongo-data`; the app container is read-only.
- [`Dockerfile`](../Dockerfile) has no writable database directory or SQL
  migration artifacts in the runtime image.
- [`.env.example`](../.env.example), [`.env.docker.example`](../.env.docker.example),
  [`docs/development.md`](../docs/development.md), and
  [`docs/mongodb-migration.md`](../docs/mongodb-migration.md) document Mongo.
- [`docker/mongo-init.js`](../docker/mongo-init.js) becomes obsolete only after
  the rollback window closes.

### GraphQL and frontend impact

No GraphQL package needs to change. The schema files contain no Mongoose APIs.
The frontend treats `_id` and `owner` as strings and does not validate ObjectId
format, so it needs no database-driven changes if row adapters preserve the
existing response shape.

The resolver implementation does need to stop calling `.toObject()`: repository
functions should return plain domain objects ready for GraphQL serialization.

## 4. Required package changes (during the later implementation)

Do not run these commands now. They show the intended dependency delta.

```sh
# Runtime dependency: ORM only. bun:sqlite ships with Bun.
bun add --cwd apps/api drizzle-orm

# Development dependency: schema diff and checked-in migration generator.
bun add --cwd apps/api --dev drizzle-kit

# After the importer has run, the rollback window has closed, and no code imports them:
bun remove --cwd apps/api connect-mongo mongoose mongoose-unique-validator mongodb
```

Package policy:

- Pin exact versions in `apps/api/package.json`/`bun.lock` as the repository does
  today, after testing the current stable Drizzle release with Bun 1.3.14.
- Keep `mongodb` temporarily for the one-time importer. Prefer putting the
  importer under `apps/api/scripts/` and removing both script and dependency
  after archival, or run it from a dedicated migration workspace/container.
- Do **not** add `sqlite3`, `better-sqlite3`, `connect-sqlite3`, or
  `better-sqlite3-session-store` when using the recommended design. They add a
  second SQLite driver/native binding and make driver/version behavior harder to
  reason about.
- Litestream is an operational binary/container, not an npm dependency.
- GraphQL, GraphQL Tools, Express, and `express-session` remain.

Useful scripts to add later:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:check": "drizzle-kit check",
    "db:migrate": "bun src/db/migrate.ts",
    "db:import:mongo": "bun scripts/import-mongo-to-sqlite.ts"
  }
}
```

Use `drizzle-kit generate` plus a reviewed runtime migrator for production.
Reserve `drizzle-kit push` for disposable local development databases.

## 5. Target schema

### Mapping

| Mongo source | SQLite target | Transformation |
| --- | --- | --- |
| `users._id` | `users.id TEXT PRIMARY KEY` | `ObjectId.toHexString()` |
| `users.email` | `users.email TEXT NOT NULL` | Preserve exact bytes; unique index. Decide separately whether future login should normalize case. |
| optional OAuth tokens | nullable `TEXT` columns | Unique only when non-null. SQLite naturally permits multiple nulls. |
| `shortlinks._id` | `shortlinks.id TEXT PRIMARY KEY` | Preserve existing ID; UUID for new rows. |
| `shortlinks.owner` | `shortlinks.owner_id TEXT` | ObjectId string; FK to `users.id`, `ON DELETE SET NULL`. |
| `descriptor` | `descriptor_user_tag`, `descriptor_description_tag` | Reconstruct nested object at repository boundary. |
| `snooze` | `snooze_awake INTEGER`, `snooze_description TEXT` | Milliseconds remain safe within JS and SQLite signed 64-bit integer ranges. |
| `urlMetadata` | `url_metadata TEXT` in JSON mode | Validate/normalize BSON values during import. |
| `tags` | `tags TEXT` in JSON mode | Store JSON array; return `string[]`. |
| `_searchIndex` | `search_index TEXT` | Preserve initially; recompute missing/stale values in importer. |
| Mongo timestamps | ISO-8601 UTC `TEXT` | Keeps the current GraphQL `String` contract and lexicographic ordering. |
| `banlists` | `banlist` table | Preserve IDs/data; add type check and type index. |
| `sessions` | `sessions` table | `_id` -> `sid`, session JSON text, `expires` -> epoch milliseconds. |

Mongoose pluralizes the current model names, so expected source collections are
`users`, `shortlinks`, and `banlists`, plus explicitly configured `sessions`.
The importer must still call `listCollections()` and fail if reality differs.

### Drizzle schema sketch

This is a design snippet, not a drop-in patch. Generated SQL must be reviewed,
especially partial indexes and check constraints.

```ts
// apps/api/src/db/schema.ts
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

type JsonObject = Record<string, unknown>

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  userTag: text('user_tag'),
  idToken: text('id_token'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  ip: text('ip'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  uniqueIndex('users_email_uq').on(table.email),
  uniqueIndex('users_id_token_uq').on(table.idToken)
    .where(sql`${table.idToken} IS NOT NULL`),
  uniqueIndex('users_access_token_uq').on(table.accessToken)
    .where(sql`${table.accessToken} IS NOT NULL`),
  uniqueIndex('users_refresh_token_uq').on(table.refreshToken)
    .where(sql`${table.refreshToken} IS NOT NULL`)
])

export const shortlinks = sqliteTable('shortlinks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  hash: text('hash').notNull(),
  location: text('location').notNull(),
  descriptorUserTag: text('descriptor_user_tag'),
  descriptorDescriptionTag: text('descriptor_description_tag'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  urlMetadata: text('url_metadata', { mode: 'json' }).$type<JsonObject>(),
  siteTitle: text('site_title'),
  siteDescription: text('site_description'),
  snoozeAwake: integer('snooze_awake'),
  snoozeDescription: text('snooze_description'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  searchIndex: text('search_index'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  uniqueIndex('shortlinks_hash_uq').on(table.hash),
  index('shortlinks_owner_created_idx').on(table.ownerId, table.createdAt),
  index('shortlinks_snooze_idx').on(table.ownerId, table.snoozeAwake),

  // Recommended hardening after the duplicate audit passes:
  uniqueIndex('shortlinks_descriptor_uq')
    .on(table.descriptorUserTag, table.descriptorDescriptionTag)
    .where(sql`${table.descriptorDescriptionTag} IS NOT NULL`),
  uniqueIndex('shortlinks_owner_location_uq')
    .on(table.ownerId, table.location)
    .where(sql`${table.ownerId} IS NOT NULL`)
])

export const banlist = sqliteTable('banlist', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  value: text('value').notNull(),
  type: text('type', { enum: ['IP', 'user', 'location'] }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  index('banlist_type_idx').on(table.type),
  check('banlist_type_ck', sql`${table.type} IN ('IP', 'user', 'location')`)
])

export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sessionJson: text('session_json').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  index('sessions_expires_idx').on(table.expiresAt)
])
```

The descriptor and owner/location unique indexes are stricter than the current
database, but they encode behavior the application already tries to enforce.
They close race windows. Do not create them until the audit proves there are no
duplicates or an explicit deduplication policy has been approved.

Do not make `user_tag` unique silently. It is currently non-unique, yet it
participates in public descriptive URLs. Audit collisions and decide whether a
separate product change should enforce uniqueness.

## 6. Database bootstrap and migrations

Create one connection and share it through the repositories and session store.
Assert every important pragma; do not assume defaults.

```ts
// apps/api/src/db/client.ts
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import config from '../config'

export const sqlite = new Database(config.SQLITE_PATH, {
  create: true,
  strict: true
})

const journal = sqlite.query('PRAGMA journal_mode = WAL').get() as {
  journal_mode: string
}
if (journal.journal_mode.toLowerCase() !== 'wal') {
  throw new Error(`SQLite WAL mode unavailable: ${journal.journal_mode}`)
}

sqlite.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = FULL;
`)

const foreignKeys = sqlite.query('PRAGMA foreign_keys').get() as {
  foreign_keys: number
}
if (foreignKeys.foreign_keys !== 1) throw new Error('SQLite foreign keys are off')

export const db = drizzle({ client: sqlite })
```

Notes:

- WAL mode is required for Litestream and improves read/write concurrency.
- `foreign_keys` is connection-local and must be enabled on every connection.
- `busy_timeout=5000` lets application writes wait through brief Litestream
  checkpoint locks.
- Keep SQLite's automatic checkpointing initially. Litestream 0.5 detects
  checkpoints; disabling `wal_autocheckpoint` is only worth considering after a
  high-write-load test shows a need.
- Run Drizzle migrations before accepting traffic. Only one application instance
  may run migrations.
- Handle `SIGTERM`/`SIGINT`: stop accepting requests, clear the session cleanup
  timer, close SQLite, and let Litestream complete its bounded shutdown sync.

### WAL version safety gate

SQLite disclosed a rare WAL reset race affecting versions through 3.51.2 when
multiple processes/connections write or checkpoint concurrently. It is fixed in
3.51.3+, plus backports 3.44.6 and 3.50.7. This matters because Litestream is a
second process that checkpoints the same WAL.

The repository's pinned local Bun 1.3.14 reported SQLite **3.53.0** during this
research, which is fixed. Add a CI/runtime-image assertion for
`select sqlite_version()` and reject unpatched versions after any Bun image
change. Test the exact Linux runtime image, not only a developer workstation.

## 7. Domain row adapters: preserve GraphQL shapes

Drizzle returns plain flat rows. Convert them once in the persistence layer, not
in every resolver.

```ts
type ShortlinkRow = typeof shortlinks.$inferSelect

export function toShortlink(row: ShortlinkRow): ShortlinkDocument {
  return {
    _id: row.id,
    hash: row.hash,
    location: row.location,
    owner: row.ownerId ?? undefined,
    descriptor: row.descriptorDescriptionTag == null
      ? undefined
      : {
          userTag: row.descriptorUserTag ?? undefined,
          descriptionTag: row.descriptorDescriptionTag
        },
    urlMetadata: row.urlMetadata ?? undefined,
    siteTitle: row.siteTitle ?? undefined,
    siteDescription: row.siteDescription ?? undefined,
    snooze: row.snoozeAwake == null
      ? undefined
      : {
          awake: row.snoozeAwake,
          description: row.snoozeDescription ?? undefined
        },
    tags: row.tags ?? undefined,
    _searchIndex: row.searchIndex ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
```

Replace `ResultDoc<T>`, `QueryType<T>`, and `ObjectId` with database-independent
domain types using string IDs. Repository functions should return
`ShortlinkDocument`, `UserDocument`, and `BanItem` plain objects. Then remove all
`.toObject()`, `.lean()`, and `.save()` assumptions from resolvers/controllers.

## 8. Query rewrite snippets

These examples show the important semantic replacements. Exact module names can
be chosen during implementation.

### Read by hash or descriptor

```ts
import { and, eq } from 'drizzle-orm'

export function getShortlink(args: {
  hash?: string
  userTag?: string
  descriptionTag?: string
}): ShortlinkDocument | null {
  const predicate = args.hash
    ? eq(shortlinks.hash, args.hash)
    : and(
        eq(shortlinks.descriptorUserTag, args.userTag ?? 'you'),
        eq(shortlinks.descriptorDescriptionTag, args.descriptionTag!)
      )

  const row = db.select().from(shortlinks).where(predicate).limit(1).get()
  return row ? toShortlink(row) : null
}
```

Confirm whether missing `userTag` should mean `'you'` or SQL `NULL`; the current
Mongoose exact-object query effectively uses the provided value and needs a
behavioral test before changing it.

### Paginated user list, snooze filter, search, and safe sort

Never interpolate GraphQL `sort` into SQL. Whitelist allowed columns.

```ts
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'

const sortable = {
  createdAt: shortlinks.createdAt,
  updatedAt: shortlinks.updatedAt,
  location: shortlinks.location,
  siteTitle: shortlinks.siteTitle,
  snooze: shortlinks.snoozeAwake
} as const

export function queryShortlinks(args: { userId: string } & QICommon) {
  const sortColumn = sortable[args.sort as keyof typeof sortable]
    ?? shortlinks.createdAt
  const sortDirection = args.order === 'asc' || args.order === '1'
    ? asc(sortColumn)
    : desc(sortColumn)

  const rows = db.select().from(shortlinks).where(and(
    eq(shortlinks.ownerId, args.userId),
    args.search
      ? sql`instr(lower(coalesce(${shortlinks.searchIndex}, '')), lower(${args.search})) > 0`
      : undefined,
    args.isSnooze ? isNotNull(shortlinks.snoozeAwake) : undefined
  ))
    .orderBy(sortDirection)
    .offset(Math.max(0, args.skip ?? 0))
    .limit(Math.min(100, Math.max(1, args.limit ?? 25)))
    .all()

  return rows.map(toShortlink)
}
```

This preserves literal, case-insensitive substring behavior without treating
user input as SQL wildcards or a regular expression. SQLite's built-in
case-folding is ASCII-oriented; add tests for non-ASCII search terms before
claiming exact Unicode equivalence.

### Owner-scoped update/delete with `RETURNING`

All user mutations must include `owner_id = session.userId` in the SQL predicate.

```ts
export function deleteShortlink(id: string, userId: string) {
  const row = db.delete(shortlinks)
    .where(and(eq(shortlinks.id, id), eq(shortlinks.ownerId, userId)))
    .returning()
    .get()
  return row ? toShortlink(row) : null
}

export function clearSnooze(id: string, userId: string) {
  const row = db.update(shortlinks)
    .set({
      snoozeAwake: null,
      snoozeDescription: null,
      updatedAt: new Date().toISOString()
    })
    .where(and(eq(shortlinks.id, id), eq(shortlinks.ownerId, userId)))
    .returning()
    .get()
  return row ? toShortlink(row) : null
}
```

This also fixes two existing authorization gaps:

- `deleteShortlinkSnoozeTimer` obtains `userId` but the current helper updates by
  ID alone.
- `deleteShortlink` obtains `userId` but the current helper deletes by ID alone.

The SQL rewrite must pass `userId` into both helpers and return `null`/a forbidden
error when the owner predicate does not match. `updateShortlink` and timer writes
must use the same owner-scoped rule rather than relying on a prior read.

### Unique hash creation without a race

The current check-then-insert loop can race. Let the unique index arbitrate and
retry only hash collisions.

```ts
for (let attempt = 0; attempt < 10; attempt += 1) {
  const hash = requestedHash ?? generateHash()
  try {
    const row = db.insert(shortlinks).values({
      id: crypto.randomUUID(),
      hash,
      location,
      ownerId: userId,
      createdAt: now,
      updatedAt: now
    }).returning().get()
    return toShortlink(row)
  } catch (error) {
    if (!isUniqueConstraint(error, 'shortlinks_hash_uq')) throw error
  }
}
throw new Error('Could not allocate a unique shortlink hash')
```

If the `(owner_id, location)` constraint fires, select and return the existing
row. If the descriptor constraint fires, translate it to the existing
`DUPLICATING_DESCRIPTOR` GraphQL extension code.

### Metadata background update

Mongoose currently mutates a document and saves it in a delayed callback. With
plain rows, insert first and issue a narrow update later:

```ts
void fetchMetadata(location).then(([urlMetadata, siteTitle, siteDescription]) =>
  db.update(shortlinks).set({
    urlMetadata,
    siteTitle,
    siteDescription,
    searchIndex: buildSearchIndex({
      location,
      descriptionTag,
      siteTitle,
      siteDescription
    }),
    updatedAt: new Date().toISOString()
  }).where(and(
    eq(shortlinks.id, id),
    eq(shortlinks.ownerId, userId)
  )).run()
).catch((error) => logger.warn({ error, id }, 'metadata fetch failed'))
```

Avoid an unhandled promise and avoid overwriting unrelated fields with a stale
in-memory document.

### Banlist

Select only `value` by `type`, then keep `matchesBanlist()` unchanged. SQLite
does not need to execute user-authored regex entries; JavaScript can retain that
logic.

## 9. SQLite-backed session store

`connect-mongo` currently provides storage and TTL expiry. A custom store can use
the same `bun:sqlite` connection and keep the existing `express-session` API.

```ts
// apps/api/src/db/sqlite-session.store.ts
import session, { type SessionData } from 'express-session'
import type { Database } from 'bun:sqlite'

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

export class SQLiteSessionStore extends session.Store {
  constructor(private readonly sqlite: Database) {
    super()
  }

  get(sid: string, callback: (error?: unknown, value?: SessionData | null) => void) {
    try {
      const row = this.sqlite.query(`
        SELECT session_json, expires_at
        FROM sessions WHERE sid = ?
      `).get(sid) as { session_json: string; expires_at: number } | null

      if (!row || row.expires_at <= Date.now()) {
        if (row) this.sqlite.query('DELETE FROM sessions WHERE sid = ?').run(sid)
        callback(undefined, null)
        return
      }
      callback(undefined, JSON.parse(row.session_json) as SessionData)
    } catch (error) {
      callback(error)
    }
  }

  set(sid: string, value: SessionData, callback?: (error?: unknown) => void) {
    try {
      const expiresAt = value.cookie.expires?.getTime()
        ?? Date.now() + (value.cookie.maxAge ?? SIX_MONTHS_MS)
      this.sqlite.query(`
        INSERT INTO sessions (sid, session_json, expires_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          session_json = excluded.session_json,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `).run(sid, JSON.stringify(value), expiresAt, Date.now())
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  destroy(sid: string, callback?: (error?: unknown) => void) {
    try {
      this.sqlite.query('DELETE FROM sessions WHERE sid = ?').run(sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  touch(sid: string, value: SessionData, callback?: (error?: unknown) => void) {
    try {
      const expiresAt = value.cookie.expires?.getTime()
        ?? Date.now() + (value.cookie.maxAge ?? SIX_MONTHS_MS)
      this.sqlite.query(`
        UPDATE sessions SET expires_at = ?, updated_at = ? WHERE sid = ?
      `).run(expiresAt, Date.now(), sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }
}
```

Add a non-overlapping hourly cleanup timer:

```ts
const cleanup = setInterval(() => {
  sqlite.query('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}, 60 * 60 * 1000)
cleanup.unref()
```

Test `get`, `set`, `touch`, `destroy`, corrupted JSON, expiry, logout, and cleanup.
Keep `APP_SESSION_SECRET` unchanged across cutover or all cookies become invalid.
If sessions are not imported by deliberate choice, announce a forced logout.

## 10. Mongo inventory and data-quality audit

Run this against a staging copy first. Store outputs securely because token and
session fields are sensitive.

1. Record MongoDB server and Database Tools versions.
2. Record `listCollections()`, `getIndexes()`, collection options, counts, and
   sizes. Fail on an unexpected collection rather than silently dropping it.
3. Sample every distinct BSON type in every field, especially `urlMetadata`,
   `tags`, timestamps, OAuth tokens, and the `sessions` document shape.
4. Check required fields, invalid owner IDs, orphan owners, invalid ban types,
   malformed session JSON, and non-finite snooze values.
5. Detect duplicates that would violate target constraints.

Example `mongosh` audit fragments:

```javascript
const source = db.getSiblingDB('shlk')

source.getCollectionInfos().forEach((info) => printjson(info))
for (const name of source.getCollectionNames()) {
  printjson({
    name,
    count: source.getCollection(name).countDocuments({}),
    indexes: source.getCollection(name).getIndexes()
  })
}

// Duplicate descriptors.
source.shortlinks.aggregate([
  { $match: { 'descriptor.descriptionTag': { $exists: true, $ne: null } } },
  { $group: {
      _id: {
        userTag: '$descriptor.userTag',
        descriptionTag: '$descriptor.descriptionTag'
      },
      ids: { $push: '$_id' },
      count: { $sum: 1 }
  } },
  { $match: { count: { $gt: 1 } } }
]).forEach(printjson)

// Duplicate owned locations.
source.shortlinks.aggregate([
  { $match: { owner: { $exists: true, $ne: null } } },
  { $group: {
      _id: { owner: '$owner', location: '$location' },
      ids: { $push: '$_id' },
      count: { $sum: 1 }
  } },
  { $match: { count: { $gt: 1 } } }
]).forEach(printjson)

// Orphan owners.
source.shortlinks.aggregate([
  { $match: { owner: { $exists: true, $ne: null } } },
  { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'user' } },
  { $match: { user: { $size: 0 } } },
  { $project: { _id: 1, owner: 1 } }
]).forEach(printjson)
```

Also audit duplicate emails, hashes, non-null token values, and user tags. Do not
auto-deduplicate. Produce a reviewed resolution file mapping every duplicate to
`keep`, `merge`, `rename`, or `reject migration`.

## 11. One-time importer sketch

Use the MongoDB Node driver already present, and write into an **empty** SQLite
database created by reviewed Drizzle migrations. Import in dependency order:
users, banlist, shortlinks, then sessions. Keep foreign keys enabled.

```ts
// apps/api/scripts/import-mongo-to-sqlite.ts (temporary)
import { Database } from 'bun:sqlite'
import { BSON, MongoClient, ObjectId } from 'mongodb'

const mongoUri = process.env.MIGRATION_MONGO_URI
const sqlitePath = process.env.MIGRATION_SQLITE_PATH
if (!mongoUri || !sqlitePath) throw new Error('Migration paths are required')

const mongo = new MongoClient(mongoUri)
await mongo.connect()
const source = mongo.db(process.env.MIGRATION_MONGO_DB ?? 'shlk')
const target = new Database(sqlitePath, { create: false, strict: true })
target.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

const names = (await source.listCollections({}, { nameOnly: true }).toArray())
  .map(({ name }) => name).sort()
for (const expected of ['banlists', 'sessions', 'shortlinks', 'users']) {
  if (!names.includes(expected)) throw new Error(`Missing collection: ${expected}`)
}

function id(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString()
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(`Invalid ID: ${String(value)}`)
}

function iso(value: unknown, fallbackId: unknown): string {
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString()
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  if (fallbackId instanceof ObjectId) return fallbackId.getTimestamp().toISOString()
  throw new Error('Missing/invalid timestamp')
}

function json(value: unknown): string | null {
  if (value == null) return null
  // Relaxed EJSON exposes otherwise lossy BSON values. Audit and explicitly
  // normalize any $date/$numberLong/$binary/$oid forms before accepting them.
  const serialized = BSON.EJSON.serialize(value, { relaxed: true })
  return JSON.stringify(serialized)
}

const insertUser = target.prepare(`
  INSERT INTO users (
    id, email, name, avatar, user_tag, id_token, access_token, refresh_token,
    ip, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const writeUsers = target.transaction((rows: any[]) => {
  for (const doc of rows) insertUser.run(
    id(doc._id), doc.email, doc.name, doc.avatar ?? null, doc.userTag ?? null,
    doc.id_token ?? null, doc.access_token ?? null, doc.refresh_token ?? null,
    doc.ip ?? null, iso(doc.createdAt, doc._id), iso(doc.updatedAt, doc._id)
  )
})

async function importInBatches(
  collection: string,
  write: (rows: any[]) => void,
  batchSize = 500
) {
  let batch: any[] = []
  for await (const doc of source.collection(collection).find({}).sort({ _id: 1 })) {
    batch.push(doc)
    if (batch.length === batchSize) {
      write(batch)
      batch = []
    }
  }
  if (batch.length) write(batch)
}

await importInBatches('users', writeUsers)
// Repeat with explicit prepared statements for banlists, shortlinks, sessions.

target.exec('ANALYZE; PRAGMA optimize;')
const integrity = target.query('PRAGMA integrity_check').values()
const foreignKeys = target.query('PRAGMA foreign_key_check').values()
if (JSON.stringify(integrity) !== JSON.stringify([['ok']])) {
  throw new Error(`Integrity check failed: ${JSON.stringify(integrity)}`)
}
if (foreignKeys.length !== 0) {
  throw new Error(`Foreign key check failed: ${JSON.stringify(foreignKeys)}`)
}

target.close()
await mongo.close()
```

Importer requirements omitted from the sketch but required in production:

- Refuse a non-empty target; no `INSERT OR REPLACE` and no silent upsert.
- Log per-collection read/write/rejected counts without logging secrets.
- Use bounded batches and a transaction per batch. A single transaction for a
  very large database creates a large WAL and a long rollback window.
- Convert `descriptor`, `snooze`, `urlMetadata`, and `tags` explicitly; validate
  the resulting JSON with `json_valid()`.
- Recompute `search_index` deterministically when absent or stale.
- Decide how to handle missing timestamps before the rehearsal. The ObjectId
  timestamp fallback is a proposal, not an implicit data repair.
- For `connect-mongo` sessions, verify the actual document shape. Expected fields
  are `_id`, serialized `session`, and `expires`; convert expiry to epoch ms. If
  the shape is unexpected, fail rather than invalidating logins silently.
- Write a canonical manifest containing counts and SHA-256 hashes over stable,
  sorted, normalized rows from both databases.

`mongoexport` may help inspect Extended JSON, but MongoDB explicitly states it is
not a deployment backup tool. Use `mongodump` for the rollback archive and the
driver-based importer for transformation.

## 12. Migration and cutover procedure

### Phase A — feasibility and baseline

- [ ] Record total database size, collection/index sizes, peak read/write QPS,
  longest query time, and current backup RPO/RTO.
- [ ] Confirm one app instance is sufficient and no external worker writes Mongo.
- [ ] Confirm the production volume is host-local/block storage, not NFS, SMB,
  GlusterFS, or another distributed/network filesystem.
- [ ] Run the inventory/audit and resolve all constraint conflicts.
- [ ] Decide whether sessions are migrated or users are deliberately logged out.
- [ ] Define acceptable Litestream `sync-interval`, RPO, retention, and restore RTO.
- [ ] Preserve current GraphQL acceptance responses as fixtures.

Exit gate: data shape is known, SQLite capacity is adequate, all exceptional rows
have a reviewed policy, and rollback ownership is assigned.

### Phase B — implement behind tests

- [ ] Add Drizzle and migration scripts; create initial SQL schema migration.
- [ ] Add SQLite bootstrap with asserted WAL, foreign keys, busy timeout,
  synchronous mode, and safe SQLite version.
- [ ] Replace model modules with schema/domain/adapter modules.
- [ ] Rewrite user, shortlink, and banlist repositories.
- [ ] Add owner predicates to every authenticated mutation.
- [ ] Replace hydrated-document use in GraphQL resolvers and OAuth controller.
- [ ] Implement and test SQLite session store plus expiry cleanup.
- [ ] Replace `MONGO_URI` with `SQLITE_PATH` (recommended production value:
  `/var/lib/shlk/shlk.sqlite`). Add Litestream settings only when enabled.
- [ ] Run SQL migrations before the HTTP listener starts.
- [ ] Keep GraphQL schema and frontend queries unchanged.
- [ ] Build the importer and verification manifest tooling.

Exit gate: unit/integration tests, typecheck, lint, build, importer rehearsal, and
GraphQL contract comparison pass.

### Phase C — rehearsal

- [ ] Restore a recent `mongodump` into isolated MongoDB.
- [ ] Import into a new SQLite file on the same OS/filesystem type as production.
- [ ] Compare counts, IDs, relationships, normalized row hashes, sampled objects,
  and GraphQL results.
- [ ] Exercise OAuth/login/logout, session continuation, public redirects,
  descriptor conflicts, search/sort/pagination, metadata updates, snooze, bans,
  and owner authorization.
- [ ] Load test expected peak concurrency and observe `SQLITE_BUSY`, p95 latency,
  WAL size, disk growth, and event-loop delay.
- [ ] Start Litestream, force writes, sync, destroy the disposable local DB,
  restore to a new path, run integrity/foreign-key checks, and rerun smoke tests.
- [ ] Measure total import time and restore RTO; turn those into the maintenance
  window estimate.

Exit gate: two successful rehearsals, including one full Litestream restore.

### Phase D — final offline cutover

- [ ] Announce maintenance and stop all application/background writers.
- [ ] Verify Mongo has no remaining app connections/writes.
- [ ] Create a final encrypted/restricted `mongodump` archive and checksum it.
- [ ] Record final source counts and canonical manifest.
- [ ] Import into a brand-new SQLite file; abort on any rejected row/conflict.
- [ ] Run `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, counts, hashes, and
  representative SQL/GraphQL queries.
- [ ] Run `VACUUM` only now, before Litestream begins tracking the database.
- [ ] Put the database on the production local named volume with correct UID/GID
  and restrictive permissions.
- [ ] Start/verify Litestream and wait for the initial snapshot/sync.
- [ ] Start exactly one app instance, apply any pending schema migration, and run
  internal smoke tests while public traffic remains closed.
- [ ] Make a go/no-go decision. Reopen traffic only on go.
- [ ] Monitor error rate, p95/p99 latency, busy errors, WAL size, disk free space,
  Litestream last-successful-sync/heartbeat, and redirect correctness.

### Phase E — stabilization and decommission

- [ ] Perform and document a fresh restore drill after real production writes.
- [ ] Retain the final Mongo dump and stopped Mongo volume for the agreed rollback
  period with access controls and checksums.
- [ ] After sign-off, remove Mongo services/secrets/volume references, init script,
  runtime dependencies, importer, and stale documentation.
- [ ] Do not delete the old Mongo volume as part of the migration change itself;
  schedule that as a separately approved destructive operation.

## 13. Litestream option

### Configuration sketch for Litestream 0.5.15

```yaml
# docker/litestream.yml
addr: ":9090"
logging:
  level: info
  type: json

snapshot:
  interval: 24h
  retention: 168h

shutdown-sync-timeout: 30s
shutdown-sync-interval: 500ms

dbs:
  - path: /data/shlk.sqlite
    restore-if-db-not-exists: true
    busy-timeout: 5s
    checkpoint-interval: 1m
    min-checkpoint-page-count: 1000
    truncate-page-n: 121359
    replica:
      url: ${LITESTREAM_REPLICA_URL}
      sync-interval: 10s
```

Adjust retention and sync interval to the approved RPO/cost model. At a constant
write rate, shorter sync intervals produce more object-store requests. Expose
metrics only on the private backend network. Add a heartbeat URL or alert on
replication lag; a running container is not proof that backups are current.

Credentials should come from `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, workload
identity, or a secret manager, not from committed YAML. Use a path-restricted,
least-privilege bucket policy. Enable bucket encryption and versioning/object
lock as appropriate because the database contains OAuth tokens and sessions.

### Compose topology sketch

```yaml
services:
  sqlite-restore:
    image: litestream/litestream:0.5.15
    command:
      - restore
      - -if-db-not-exists
      - -if-replica-exists
      - -integrity-check
      - full
      - /data/shlk.sqlite
    volumes:
      - sqlite-data:/data
      - ./docker/litestream.yml:/etc/litestream.yml:ro
    environment: &litestream-env
      LITESTREAM_REPLICA_URL: ${LITESTREAM_REPLICA_URL:?required}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:?required}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:?required}
    networks: [backend]
    restart: "no"

  litestream:
    image: litestream/litestream:0.5.15
    command: [replicate]
    depends_on:
      sqlite-restore:
        condition: service_completed_successfully
    volumes:
      - sqlite-data:/data
      - ./docker/litestream.yml:/etc/litestream.yml:ro
    environment: *litestream-env
    networks: [backend]
    restart: unless-stopped

  app:
    # Keep root filesystem read-only, but mount the database directory read/write.
    read_only: true
    volumes:
      - sqlite-data:/var/lib/shlk
    depends_on:
      sqlite-restore:
        condition: service_completed_successfully
      litestream:
        condition: service_started
    environment:
      SQLITE_PATH: /var/lib/shlk/shlk.sqlite

volumes:
  sqlite-data:
```

This is a topology illustration. Before implementing it:

- Make `/data` and `/var/lib/shlk` refer to the same named volume content and
  confirm both containers' UID/GID can read/write it. The runtime image needs a
  pre-created, `bun`-owned `/var/lib/shlk` directory or an explicit safe volume
  permission-init step.
- Pin Litestream by immutable digest after multi-architecture verification.
- Decide the no-backup first-boot behavior. `-if-replica-exists` lets an empty
  installation proceed; the app migration then creates the database.
- Ensure restore finishes before the app can create/open the target path.
- Make the app readiness check include successful schema migration and a trivial
  database query, not only HTTP process health.
- Test signal/shutdown ordering so the application closes its connection and
  Litestream completes a final sync.
- Never scale the app or Litestream replicator above one writer/replicator for the
  same file.
- Use a named local volume on Docker Desktop; do not bind-mount the database from
  macOS/Windows into a Linux container.

### Restore runbook

1. Stop the app and Litestream before overwriting/restoring a database.
2. Restore to a **new path** first, preferably with `-integrity-check full`.
3. Run `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, schema version, and
   application smoke queries.
4. For point-in-time recovery, run `litestream restore -dry-run -timestamp ...`
   first. Restore granularity is at retained LTX-file boundaries, not every
   individual SQLite transaction.
5. Atomically switch the approved restored file while no process has it open.
6. Start Litestream, confirm it recognizes the restored state, then start the app.
7. Never restore over a live database and never separate/copy only the main DB
   file from its active `-wal` state.

Litestream's `restore` refuses to overwrite an existing file unless forced. Keep
that safety behavior in automation; avoid `-force` in normal startup.

## 14. Tests required before cutover

### Schema and repository integration tests

- Migrations apply from empty and from each prior schema version.
- WAL, foreign keys, busy timeout, SQLite version, and schema version are asserted.
- User upsert retains an existing `userTag` when OAuth omits it.
- Optional token uniqueness accepts multiple nulls and rejects duplicate values.
- Hash and descriptor collisions map to current GraphQL error codes.
- Same owner/location returns the existing link; anonymous behavior is unchanged.
- JSON metadata/tags and nested descriptor/snooze round-trip exactly.
- Search is literal, case-insensitive for covered characters, and cannot inject
  sort/query SQL.
- Pagination is deterministic and limits are bounded.
- All update/delete/snooze operations reject another user's row.
- Ban exact and regex behavior is unchanged.
- Metadata background failure is handled and narrow updates do not lose writes.

### GraphQL/HTTP contract tests

- Snapshot all current operations and public/private field visibility.
- Verify `_id`, `owner`, timestamps, mixed metadata, and long snooze values.
- Verify OAuth callback stores the string user ID and an existing migrated session
  remains authenticated with the unchanged session secret.
- Verify redirects by hash and descriptor.
- Run current `bun run typecheck`, `bun run lint`, `bun run test`, and build.

### Migration verification

- Per-table counts match approved source counts after exclusions.
- Every source ID occurs exactly once in SQLite.
- Every owner is preserved or appears in the approved orphan resolution list.
- Stable canonical hashes match field-for-field transforms.
- `PRAGMA integrity_check` returns `ok`; `foreign_key_check` returns no rows.
- `json_valid(url_metadata)` and `json_valid(tags)` pass for all non-null values.
- Random samples plus boundary rows (oldest/newest, null-heavy, largest metadata,
  snoozed, descriptive, banned) compare correctly.

### Litestream acceptance

- Initial and incremental sync succeed with no credential leakage in logs.
- Backup lag alert and heartbeat failure are observable.
- Restore to empty disk meets RTO and contains latest expected committed write
  within the stated RPO.
- Point-in-time dry run and restore work.
- WAL remains bounded under peak load and no sustained `SQLITE_BUSY` occurs.
- Disk-full behavior, object-store outage, app crash, Litestream crash, and host
  reboot are rehearsed.

## 15. Rollback strategy

The clean rollback point is **before reopening public writes**:

1. Stop the SQLite app and Litestream.
2. Preserve the failed SQLite file, WAL, metadata, and logs for diagnosis.
3. Restore the prior application configuration and restart Mongo from the final
   verified snapshot/unchanged stopped database.
4. Run Mongo-backed smoke tests, then reopen traffic.

After SQLite accepts production writes, a direct rollback to the frozen Mongo
snapshot loses those writes. Choose one of these policies before cutover:

- Treat reopening traffic as the point of no return and recover SQLite through
  Litestream/repair, or
- Build and rehearse a reverse SQLite-to-Mongo delta exporter with conflict rules.

For this application's likely scale, the first policy is simpler and safer, but
it requires a strict pre-traffic go/no-go gate and proven Litestream restore.

## 16. Risks and mitigations

| Risk | Mitigation/release gate |
| --- | --- |
| One writer becomes a bottleneck | Baseline/load test; short transactions; one app instance; bounded busy timeout; do not choose SQLite if peak writes fail. |
| Host/local volume loss | Litestream, monitored RPO, encrypted bucket, routine restore drills; remember replication is asynchronous. |
| WAL/filesystem corruption | Local disk only, fixed SQLite version, WAL assertion, graceful shutdown, integrity checks, no manual live-file copying. |
| Hidden BSON types are lost | Type inventory, explicit conversion, EJSON-assisted audit, fail closed on unknown types. |
| Mongoose behavior changes | Domain adapters and GraphQL golden tests; preserve IDs/timestamps/null semantics and error codes. |
| Constraint addition blocks import | Duplicate audit and approved resolution before schema hardening. |
| Sessions never expire | Indexed `expires_at`, get-time deletion, periodic cleanup, cleanup tests. |
| Backup exists but is stale/unrestorable | Metrics/heartbeat plus scheduled full restore drills; process health alone is insufficient. |
| OAuth tokens/sessions exposed in backup | Least privilege, encryption, no secrets in logs/config, restricted local permissions, defined retention/deletion. |
| Unauthorized mutation behavior is carried over | Owner-scoped SQL predicates on every mutation and cross-user integration tests. |

## 17. Primary research references

- [Bun SQLite driver: WAL and transactions](https://bun.sh/docs/runtime/sqlite)
- [Drizzle with Bun SQLite](https://orm.drizzle.team/docs/get-started/bun-sqlite-new)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [SQLite WAL documentation, including the 2026 WAL-reset fix](https://www.sqlite.org/wal.html)
- [SQLite foreign-key enablement](https://www.sqlite.org/foreignkeys.html)
- [SQLite JSON functions](https://www.sqlite.org/json1.html)
- [Litestream: how replication and restore work](https://litestream.io/how-it-works/)
- [Litestream Docker/volume guidance](https://litestream.io/guides/docker/)
- [Litestream configuration reference (v0.5 syntax)](https://litestream.io/reference/config/)
- [Litestream tips: busy timeout, WAL, foreign keys, synchronous mode](https://litestream.io/tips/)
- [Litestream restore command](https://litestream.io/reference/restore/)
- [Litestream WAL truncate/checkpoint strategy](https://litestream.io/guides/wal-truncate-threshold/)
- [MongoDB Node driver Extended JSON](https://www.mongodb.com/docs/drivers/node/current/data-formats/extended-json/)
- [MongoDB `mongoexport` documentation and backup warning](https://www.mongodb.com/docs/database-tools/mongoexport/)
- [Mongoose model-to-collection pluralization](https://mongoosejs.com/docs/models.html)

