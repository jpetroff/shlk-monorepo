import Banlist, { type BanType } from '../models/banlist'
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
  const entries = await Banlist.find({ type }, { value: 1, _id: 0 }).lean()
  if (!matchesBanlist(value, type, entries.map((entry) => entry.value))) return

  throw new ExtError(
    'Sorry, this action is forbidden',
    { code: 'BANNED' }
  )
}
