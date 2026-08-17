import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export function runMigrations(database: Parameters<typeof migrate>[0]): void {
  migrate(database, { migrationsFolder })
}
