import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { toUser } from '../db/adapters'
import { users } from '../db/schema'
import { checkBanlist } from './ban.queries'
import { modifyURLSlug } from './utils'

export const UserProfileFields: (keyof UserProfile)[] = ['email', 'name', 'avatar', 'userTag']
export const UserObjectFields: (keyof UserObject)[] = [
  ...UserProfileFields,
  'id_token',
  'access_token',
  'refresh_token',
  'ip'
]

function hasValue(value: unknown): boolean {
  return value != null && (typeof value !== 'string' || value.length > 0)
}

export async function createOrUpdateUser(args: UserObject): Promise<UserDocument> {
  await checkBanlist(args.email, 'user')

  const existing = db.select().from(users).where(eq(users.email, args.email)).limit(1).get()
  const name = hasValue(args.name) ? String(args.name) : args.email
  const now = new Date().toISOString()

  if (!existing) {
    const row = db.insert(users).values({
      email: args.email,
      name,
      avatar: hasValue(args.avatar) ? String(args.avatar) : null,
      userTag: hasValue(args.userTag) ? String(args.userTag) : modifyURLSlug(name.toLowerCase()),
      idToken: hasValue(args.id_token) ? String(args.id_token) : null,
      accessToken: hasValue(args.access_token) ? String(args.access_token) : null,
      refreshToken: hasValue(args.refresh_token) ? String(args.refresh_token) : null,
      ip: hasValue(args.ip) ? String(args.ip) : null,
      createdAt: now,
      updatedAt: now
    }).returning().get()
    return toUser(row)
  }

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: now }
  if (hasValue(args.name)) updates.name = String(args.name)
  if (hasValue(args.avatar)) updates.avatar = String(args.avatar)
  if (hasValue(args.userTag)) updates.userTag = modifyURLSlug(String(args.userTag))
  if (hasValue(args.id_token)) updates.idToken = String(args.id_token)
  if (hasValue(args.access_token)) updates.accessToken = String(args.access_token)
  if (hasValue(args.refresh_token)) updates.refreshToken = String(args.refresh_token)
  if (hasValue(args.ip)) updates.ip = String(args.ip)
  if (!existing.userTag) updates.userTag = modifyURLSlug((updates.name ?? existing.name).toLowerCase())

  const row = db.update(users)
    .set(updates)
    .where(eq(users.id, existing.id))
    .returning()
    .get()
  return toUser(row)
}

export async function updateUserById(
  id: string,
  params: QIUser
): Promise<UserDocument | null> {
  const updates: Partial<typeof users.$inferInsert> = {}
  if (hasValue(params.name)) updates.name = String(params.name)
  if (hasValue(params.avatar)) updates.avatar = String(params.avatar)
  if (hasValue(params.userTag)) updates.userTag = String(params.userTag)
  if (Object.keys(updates).length === 0) return getUser(id)

  updates.updatedAt = new Date().toISOString()
  const row = db.update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning()
    .get()
  return row ? toUser(row) : null
}

export async function getUser(id: string): Promise<UserDocument | null> {
  if (!id) return null
  const row = db.select().from(users).where(eq(users.id, id)).limit(1).get()
  return row ? toUser(row) : null
}
