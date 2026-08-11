import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import _ from 'underscore'
import { db } from '../db/client'
import { toShortlink } from '../db/adapters'
import { shortlinks, users } from '../db/schema'
import generateHash from './hash.lib'
import fetchMetadata from './url-parser.lib'
import { ExtError, modifyURLSlug, normalizeURL, sameOrNoOwnerID } from './utils'
import SnoozeTools, {
  StandardTimers,
  SnoozeDay,
  SnoozeTime,
  StandardTimerGroups
} from '../libs/snooze.tools'
import { checkBanlist } from './ban.queries'

export const ShortlinkPublicFields: (keyof ShortlinkDocument)[] = [
  'hash',
  'descriptor',
  'location',
  'urlMetadata'
]

const sortableColumns = {
  createdAt: shortlinks.createdAt,
  updatedAt: shortlinks.updatedAt,
  location: shortlinks.location,
  siteTitle: shortlinks.siteTitle,
  snooze: shortlinks.snoozeAwake,
  'snooze.awake': shortlinks.snoozeAwake
} as const

function ownerPredicate(userId?: Maybe<string>) {
  return userId ? eq(shortlinks.ownerId, userId) : isNull(shortlinks.ownerId)
}

function buildSearchIndex(values: {
  location: string
  descriptionTag?: string
  siteTitle?: string
  siteDescription?: string
}): string {
  return [
    values.location,
    values.descriptionTag ?? '',
    values.siteTitle ?? '',
    values.siteDescription ?? ''
  ].join('|')
}

function isHashConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('shortlinks.hash') || message.includes('shortlinks_hash_uq')
}

function isDescriptorConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('descriptor_user_tag') ||
    message.includes('shortlinks_descriptor_uq')
}

function findUser(userId?: Maybe<string>) {
  if (!userId) return null
  return db.select().from(users).where(eq(users.id, userId)).limit(1).get() ?? null
}

function scheduleMetadataUpdate(shortlink: ShortlinkDocument): void {
  if (!shortlink.owner) return

  setTimeout(() => {
    void fetchMetadata(shortlink.location).then(([urlMetadata, siteTitle, siteDescription]) => {
      const current = db.select().from(shortlinks)
        .where(and(
          eq(shortlinks.id, shortlink._id),
          eq(shortlinks.ownerId, shortlink.owner!)
        ))
        .limit(1)
        .get()
      if (!current) return

      db.update(shortlinks).set({
        urlMetadata,
        siteTitle,
        siteDescription,
        searchIndex: buildSearchIndex({
          location: current.location,
          descriptionTag: current.descriptorDescriptionTag ?? undefined,
          siteTitle,
          siteDescription
        }),
        updatedAt: new Date().toISOString()
      }).where(and(
        eq(shortlinks.id, shortlink._id),
        eq(shortlinks.ownerId, shortlink.owner!)
      )).run()
    }).catch((error: unknown) => {
      console.warn(`Metadata fetch failed for shortlink ${shortlink._id}`, error)
    })
  }, 100)
}

async function createOrGetShortlink(
  rawLocation: string,
  userId?: Maybe<string>,
  requestedHash?: Maybe<string>
): Promise<ShortlinkDocument> {
  const location = normalizeURL(rawLocation)
  await checkBanlist(location, 'location')

  const user = findUser(userId)
  const ownerId = user?.id ?? null

  if (ownerId) {
    const existingForUser = db.select().from(shortlinks).where(and(
      eq(shortlinks.ownerId, ownerId),
      eq(shortlinks.location, location)
    )).limit(1).get()
    if (existingForUser) return toShortlink(existingForUser)
  }

  const initialHash = requestedHash || generateHash()
  const existingHash = db.select().from(shortlinks)
    .where(eq(shortlinks.hash, initialHash))
    .limit(1)
    .get()

  if (
    existingHash &&
    existingHash.location === location &&
    sameOrNoOwnerID(existingHash.ownerId, ownerId)
  ) {
    return toShortlink(existingHash)
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const hash = attempt === 0 && !existingHash ? initialHash : generateHash()
    const now = new Date().toISOString()
    try {
      const row = db.insert(shortlinks).values({
        hash,
        location,
        ownerId,
        createdAt: now,
        updatedAt: now
      }).returning().get()
      const result = toShortlink(row)
      scheduleMetadataUpdate(result)
      return result
    } catch (error) {
      if (!isHashConstraint(error)) throw error
    }
  }

  throw new Error('Could not allocate a unique shortlink hash')
}

export async function createShortlink(
  location: string,
  userId?: Maybe<string>
): Promise<ShortlinkDocument> {
  return createOrGetShortlink(location, userId)
}

export async function createShortlinkDescriptor(
  args: {
    location: string
    descriptionTag: string
    hash?: string
    userTag?: string
    userId?: string
  }
): Promise<ShortlinkDocument | null> {
  const location = normalizeURL(args.location)
  const descriptionTag = modifyURLSlug(args.descriptionTag)

  await checkBanlist(location, 'location')
  const user = findUser(args.userId)
  const userTag = user?.userTag || 'you'

  const existingDescriptor = db.select().from(shortlinks).where(and(
    eq(shortlinks.descriptorUserTag, userTag),
    eq(shortlinks.descriptorDescriptionTag, descriptionTag)
  )).limit(1).get()

  if (
    existingDescriptor &&
    existingDescriptor.location === location &&
    sameOrNoOwnerID(args.userId, existingDescriptor.ownerId)
  ) {
    return toShortlink(existingDescriptor)
  }
  if (existingDescriptor) {
    throw new ExtError(
      `Shortlink '/${userTag}@${descriptionTag}' already exists`,
      { code: 'DUPLICATING_DESCRIPTOR' }
    )
  }

  const shortlink = await createOrGetShortlink(location, args.userId, args.hash)
  try {
    const row = db.update(shortlinks).set({
      descriptorUserTag: userTag,
      descriptorDescriptionTag: descriptionTag,
      searchIndex: buildSearchIndex({
        ...shortlink,
        descriptionTag
      }),
      updatedAt: new Date().toISOString()
    }).where(and(
      eq(shortlinks.id, shortlink._id),
      ownerPredicate(args.userId)
    )).returning().get()
    return row ? toShortlink(row) : null
  } catch (error) {
    if (isDescriptorConstraint(error)) {
      throw new ExtError(
        `Shortlink '/${userTag}@${descriptionTag}' already exists`,
        { code: 'DUPLICATING_DESCRIPTOR' }
      )
    }
    throw error
  }
}

export async function updateShortlink(
  userId: string,
  args: { id: string, shortlink: QIEditableShortlinkProps }
): Promise<ShortlinkDocument | null> {
  const current = db.select().from(shortlinks).where(and(
    eq(shortlinks.id, args.id),
    eq(shortlinks.ownerId, userId)
  )).limit(1).get()
  if (!current) return null

  const user = findUser(userId)
  if (!user) return null

  const updates: Partial<typeof shortlinks.$inferInsert> = {}
  const requested = args.shortlink
  let descriptorDescriptionTag: string | undefined

  if (!requested.descriptor || requested.descriptor.descriptionTag === '') {
    updates.descriptorUserTag = null
    updates.descriptorDescriptionTag = null
  } else {
    descriptorDescriptionTag = modifyURLSlug(requested.descriptor.descriptionTag)
    const userTag = requested.descriptor.userTag || user.userTag || 'you'
    const existingDescriptor = db.select().from(shortlinks).where(and(
      eq(shortlinks.descriptorUserTag, userTag),
      eq(shortlinks.descriptorDescriptionTag, descriptorDescriptionTag)
    )).limit(1).get()
    if (existingDescriptor && existingDescriptor.id !== args.id) {
      throw new ExtError(
        `Shortlink '/${userTag}@${descriptorDescriptionTag}' already exists`,
        { code: 'DUPLICATING_DESCRIPTOR' }
      )
    }
    updates.descriptorUserTag = userTag
    updates.descriptorDescriptionTag = descriptorDescriptionTag
  }

  if (!requested.snooze || !requested.snooze.awake) {
    updates.snoozeAwake = null
    updates.snoozeDescription = null
  } else {
    updates.snoozeAwake = requested.snooze.awake
    updates.snoozeDescription = requested.snooze.description ?? null
  }

  let location = current.location
  if (requested.location) {
    location = normalizeURL(requested.location)
    await checkBanlist(location, 'location')
    updates.location = location
  }

  if ('urlMetadata' in requested) updates.urlMetadata = requested.urlMetadata ?? null
  if ('siteTitle' in requested) updates.siteTitle = requested.siteTitle ?? null
  if ('siteDescription' in requested) {
    updates.siteDescription = requested.siteDescription ?? null
  }
  if ('tags' in requested) updates.tags = requested.tags ?? null

  if (requested.location) {
    const [urlMetadata, siteTitle, siteDescription] = await fetchMetadata(location)
    if (!('urlMetadata' in requested)) updates.urlMetadata = urlMetadata
    if (!('siteTitle' in requested)) updates.siteTitle = siteTitle
    if (!('siteDescription' in requested)) updates.siteDescription = siteDescription
  }

  updates.searchIndex = buildSearchIndex({
    location,
    descriptionTag: descriptorDescriptionTag,
    siteTitle: updates.siteTitle ?? current.siteTitle ?? undefined,
    siteDescription: updates.siteDescription ?? current.siteDescription ?? undefined
  })
  updates.updatedAt = new Date().toISOString()

  try {
    const row = db.update(shortlinks)
      .set(updates)
      .where(and(
        eq(shortlinks.id, args.id),
        eq(shortlinks.ownerId, userId)
      ))
      .returning()
      .get()
    return row ? toShortlink(row) : null
  } catch (error) {
    if (isDescriptorConstraint(error)) {
      throw new ExtError(
        'A shortlink with this descriptor already exists',
        { code: 'DUPLICATING_DESCRIPTOR' }
      )
    }
    throw error
  }
}

export async function getShortlink(
  args: { hash?: string, userTag?: string, descriptionTag: string }
): Promise<ShortlinkDocument | null>
export async function getShortlink(
  args: { hash: string }
): Promise<ShortlinkDocument | null>
export async function getShortlink(
  args: { hash?: string, userTag?: string, descriptionTag?: string }
): Promise<ShortlinkDocument | null> {
  const row = args.hash
    ? db.select().from(shortlinks)
      .where(eq(shortlinks.hash, args.hash))
      .limit(1)
      .get()
    : args.descriptionTag
      ? db.select().from(shortlinks).where(and(
          eq(shortlinks.descriptorUserTag, args.userTag ?? 'you'),
          eq(shortlinks.descriptorDescriptionTag, args.descriptionTag)
        )).limit(1).get()
      : null
  return row ? toShortlink(row) : null
}

export async function queryShortlinks(
  args: { userId: string } & QICommon
): Promise<ShortlinkDocument[]> {
  const sortColumn = sortableColumns[args.sort as keyof typeof sortableColumns]
    ?? shortlinks.createdAt
  const sortDirection = args.order === 'asc' || args.order === '1' || args.order === 1
    ? asc(sortColumn)
    : desc(sortColumn)
  const skip = Math.max(0, args.skip ?? 0)
  const limit = Math.min(100, Math.max(1, args.limit ?? 25))

  const rows = db.select().from(shortlinks).where(and(
    eq(shortlinks.ownerId, args.userId),
    args.search
      ? sql`instr(lower(coalesce(${shortlinks.searchIndex}, '')), lower(${args.search})) > 0`
      : undefined,
    args.isSnooze ? isNotNull(shortlinks.snoozeAwake) : undefined
  ))
    .orderBy(sortDirection, desc(shortlinks.id))
    .offset(skip)
    .limit(limit)
    .all()

  return rows.map(toShortlink)
}

export async function setAwakeTimer(args: {
  userId: string
  location?: string
  hash?: string
  id?: string
  standardTimer?: StandardTimers
  customDay?: SnoozeDay
  customTime?: SnoozeTime
  baseDateISOString?: string
}): Promise<ShortlinkDocument | null> {
  if (!args.userId) return null

  let shortlink: ShortlinkDocument | null = null
  if (args.id) {
    const row = db.select().from(shortlinks).where(and(
      eq(shortlinks.id, args.id),
      eq(shortlinks.ownerId, args.userId)
    )).limit(1).get()
    if (!row) {
      throw new ExtError(
        'Shortlink not found or belongs to another user and cannot be modified',
        { code: 'SNOOZE_MODIFY_ERROR' }
      )
    }
    shortlink = toShortlink(row)
  } else if (args.location) {
    shortlink = await createOrGetShortlink(args.location, args.userId, args.hash)
  }

  if (!shortlink) return null

  const baseDate = args.baseDateISOString ? new Date(args.baseDateISOString) : new Date()
  let awake: number | undefined
  let description: string | undefined

  if (args.standardTimer) {
    awake = SnoozeTools.getStandardSnooze(args.standardTimer, baseDate).valueOf()
    description = SnoozeTools.getStandardDescription(args.standardTimer)
  } else if (args.customDay && args.customTime) {
    awake = SnoozeTools.getCustomSnooze(args.customDay, args.customTime, baseDate).valueOf()
    description = ''
  }

  if (awake == null) return shortlink

  const row = db.update(shortlinks).set({
    snoozeAwake: awake,
    snoozeDescription: description,
    updatedAt: new Date().toISOString()
  }).where(and(
    eq(shortlinks.id, shortlink._id),
    eq(shortlinks.ownerId, args.userId)
  )).returning().get()
  return row ? toShortlink(row) : null
}

export async function queryPredefinedTimers(
  userId?: string
): Promise<{
  groupLabel: string
  label: string
  value: StandardTimers
  dateValue: number
}[]> {
  if (!userId) return []

  const result: {
    groupLabel: string
    groupDate: number[]
    label: string
    value: StandardTimers
    dateValue: number
  }[] = []
  const baseDate = new Date()

  _.each(StandardTimerGroups, (value) => {
    _.each(value.content, (standardSnooze) => {
      result.push({
        groupLabel: value.label,
        groupDate: _.map(value.date, (dateItem) => (
          SnoozeTools.getCustomSnooze(dateItem, {}, baseDate)
        ).valueOf()),
        label: SnoozeTools.getStandardDescription(standardSnooze),
        value: standardSnooze,
        dateValue: SnoozeTools.getStandardSnooze(standardSnooze, baseDate).valueOf()
      })
    })
  })

  return result
}

export async function queryAndDeleteShortlinkSnoozeTimer(
  id: string,
  userId: string
): Promise<ShortlinkDocument | null> {
  const row = db.update(shortlinks).set({
    snoozeAwake: null,
    snoozeDescription: null,
    updatedAt: new Date().toISOString()
  }).where(and(
    eq(shortlinks.id, id),
    eq(shortlinks.ownerId, userId)
  )).returning().get()
  return row ? toShortlink(row) : null
}

export async function deleteShortlink(
  id: string,
  userId: string
): Promise<ShortlinkDocument | null> {
  const row = db.delete(shortlinks).where(and(
    eq(shortlinks.id, id),
    eq(shortlinks.ownerId, userId)
  )).returning().get()
  return row ? toShortlink(row) : null
}
