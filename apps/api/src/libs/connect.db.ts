import config from '../config'
import { migrateDatabase } from '../db/migrate'
import { sqlite } from '../db/client'
import { SQLiteSessionStore } from '../db/sqlite-session.store'
import { cliColors } from './utils'

export async function connectDatabase(): Promise<void> {
  console.log(`[…] Opening SQLite database at ${config.SQLITE_PATH}`)
  migrateDatabase()
  const foreignKeyViolations = sqlite.query('PRAGMA foreign_key_check').values()
  if (foreignKeyViolations.length > 0) {
    throw new Error(`SQLite foreign key check failed (${foreignKeyViolations.length} violations)`)
  }
  console.log(`${cliColors.green}[✓]${cliColors.end} SQLite database ready`)
}

export function createSessionStore(): SQLiteSessionStore {
  return new SQLiteSessionStore(sqlite)
}
