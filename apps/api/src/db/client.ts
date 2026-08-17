import { drizzle } from 'drizzle-orm/bun-sqlite'
import config from '../config'
import { isSafeSQLiteVersion, openSQLite } from './sqlite-factory'

export { isSafeSQLiteVersion, openSQLite } from './sqlite-factory'

export const sqlite = openSQLite(config.SQLITE_PATH)
export const db = drizzle({ client: sqlite })

export function closeDatabase(): void {
  sqlite.close(false)
}
