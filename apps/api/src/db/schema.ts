import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  userTag: text('user_tag'),
  idToken: text('id_token'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  ip: text('ip'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  uniqueIndex('users_email_uq').on(table.email),
  uniqueIndex('users_id_token_uq').on(table.idToken)
    .where(sql`${table.idToken} IS NOT NULL`),
  uniqueIndex('users_access_token_uq').on(table.accessToken)
    .where(sql`${table.accessToken} IS NOT NULL`),
  uniqueIndex('users_refresh_token_uq').on(table.refreshToken)
    .where(sql`${table.refreshToken} IS NOT NULL`)
])

export const shortlinks = sqliteTable('shortlinks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  hash: text('hash').notNull(),
  location: text('location').notNull(),
  descriptorUserTag: text('descriptor_user_tag'),
  descriptorDescriptionTag: text('descriptor_description_tag'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  urlMetadata: text('url_metadata', { mode: 'json' }).$type<AnyObject>(),
  siteTitle: text('site_title'),
  siteDescription: text('site_description'),
  snoozeAwake: integer('snooze_awake'),
  snoozeDescription: text('snooze_description'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  searchIndex: text('search_index'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  uniqueIndex('shortlinks_hash_uq').on(table.hash),
  index('shortlinks_owner_created_idx').on(table.ownerId, table.createdAt),
  index('shortlinks_snooze_idx').on(table.ownerId, table.snoozeAwake),
  uniqueIndex('shortlinks_descriptor_uq')
    .on(table.descriptorUserTag, table.descriptorDescriptionTag)
    .where(sql`${table.descriptorDescriptionTag} IS NOT NULL`),
  uniqueIndex('shortlinks_owner_location_uq')
    .on(table.ownerId, table.location)
    .where(sql`${table.ownerId} IS NOT NULL`)
])

export const banlist = sqliteTable('banlist', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  value: text('value').notNull(),
  type: text('type', { enum: ['IP', 'user', 'location'] }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  index('banlist_type_idx').on(table.type),
  check('banlist_type_ck', sql`${table.type} IN ('IP', 'user', 'location')`)
])

export type BanType = typeof banlist.$inferSelect['type']

export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sessionJson: text('session_json').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  index('sessions_expires_idx').on(table.expiresAt)
])
