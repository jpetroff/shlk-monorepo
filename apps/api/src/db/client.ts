import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import config from '../config'

export function isSafeSQLiteVersion(version: string): boolean {
  const [major, minor, patch] = version.split('.').map(Number)
  if (major !== 3 || !Number.isInteger(minor) || !Number.isInteger(patch)) return false
  if (minor > 51) return true
  if (minor === 51) return patch >= 3
  if (minor === 50) return patch >= 7
  return minor === 44 && patch >= 6
}

function openSQLite(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })

  const connection = new Database(path, { create: true, strict: true })
  const version = connection.query('SELECT sqlite_version() AS version').get() as {
    version: string
  }
  if (!isSafeSQLiteVersion(version.version)) {
    connection.close()
    throw new Error(`SQLite ${version.version} is not safe for WAL replication`)
  }

  const journal = connection.query('PRAGMA journal_mode = WAL').get() as {
    journal_mode: string
  }
  const expectedJournal = path === ':memory:' ? 'memory' : 'wal'
  if (journal.journal_mode.toLowerCase() !== expectedJournal) {
    connection.close()
    throw new Error(`SQLite WAL mode unavailable: ${journal.journal_mode}`)
  }

  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = FULL;
  `)

  const foreignKeys = connection.query('PRAGMA foreign_keys').get() as {
    foreign_keys: number
  }
  if (foreignKeys.foreign_keys !== 1) {
    connection.close()
    throw new Error('SQLite foreign keys are off')
  }

  return connection
}

export const sqlite = openSQLite(config.SQLITE_PATH)
export const db = drizzle({ client: sqlite })

export function closeDatabase(): void {
  sqlite.close(false)
}
