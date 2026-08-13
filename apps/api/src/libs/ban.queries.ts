import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { banlist, type BanType } from '../db/schema'
import { ExtError } from './utils'

export function matchesBanlist(
  rawValue: string,
  type: BanType,
  rawBanValues: readonly string[]
): boolean {
  const value = rawValue.trim()

  return rawBanValues.some((rawBanValue) => {
    const banValue = rawBanValue.trim()
    if (
      type === 'location' &&
      banValue.startsWith('/') &&
      banValue.endsWith('/') &&
      banValue.length > 1
    ) {
      return new RegExp(banValue.slice(1, -1)).test(value)
    }
    return banValue === value
  })
}

/**
 * Throws a BANNED application error when the value appears in the persisted
 * banlist. Location entries wrapped in slashes are treated as regular
 * expressions; all other entries use exact matching.
 */
export async function checkBanlist(value: string, type: BanType): Promise<void> {
  const entries = db.select({ value: banlist.value })
    .from(banlist)
    .where(eq(banlist.type, type))
    .all()
  if (!matchesBanlist(value, type, entries.map((entry) => entry.value))) return

  throw new ExtError(
    'Sorry, this action is forbidden',
    { code: 'BANNED' }
  )
}

export function isBanlisted(value: string, type: BanType): boolean {
  const entries = db.select({ value: banlist.value })
    .from(banlist)
    .where(eq(banlist.type, type))
    .all()
  return matchesBanlist(value, type, entries.map((entry) => entry.value))
}

export function banLocation(location: string): void {
  const entries = db.select({ value: banlist.value })
    .from(banlist)
    .where(eq(banlist.type, 'location'))
    .all()
  if (entries.some((entry) => entry.value === location)) return

  const now = new Date().toISOString()
  db.insert(banlist).values({
    value: location,
    type: 'location',
    createdAt: now,
    updatedAt: now
  }).run()
}
