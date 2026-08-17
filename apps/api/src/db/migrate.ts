import { db } from './client'
import { runMigrations } from './migration-runner'

export function migrateDatabase(): void {
  runMigrations(db)
}

if (import.meta.main) migrateDatabase()
