import { shortlinks, users } from './schema'

type ShortlinkRow = typeof shortlinks.$inferSelect
type UserRow = typeof users.$inferSelect

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

export function toUser(row: UserRow): UserDocument {
  return {
    _id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar ?? undefined,
    userTag: row.userTag ?? undefined,
    id_token: row.idToken ?? undefined,
    access_token: row.accessToken ?? undefined,
    refresh_token: row.refreshToken ?? undefined,
    ip: row.ip ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
