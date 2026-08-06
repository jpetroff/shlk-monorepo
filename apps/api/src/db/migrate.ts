import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export function migrateDatabase(): void {
  migrate(db, { migrationsFolder })
}

if (import.meta.main) migrateDatabase()
