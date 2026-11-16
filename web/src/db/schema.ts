import { sql } from 'drizzle-orm'
import { bigint, boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import type { Perms } from '@/lib/auth/permissions'
import type { SiteContent } from '@/lib/content-schema'

/**
 * Database schema. Change it here, then run `npm run db:generate` to write the
 * SQL migration into drizzle/ (committed). Migrations run when the server starts.
 */

/** The website content: one 'draft' document the MIS edits and one 'published' document the site shows. */
export const siteDocuments = pgTable(
  'site_documents',
  {
    key: text('key').primaryKey(),
    data: jsonb('data').$type<SiteContent>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('site_documents_key_check', sql`${t.key} in ('draft', 'published')`)],
)

/** Previously live versions of the website content, newest last (the store keeps 20). */
export const siteHistory = pgTable('site_history', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  data: jsonb('data').$type<SiteContent>().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Staff accounts. Email is stored in lower case. `perms` gives each area none/view/edit
 * (see src/lib/auth/permissions.ts). Exactly one owner at most: the account named by
 * ADMIN_EMAIL on the server, which has every permission and can't be disabled.
 */
export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    email: text('email').notNull().unique(),
    name: text('name').notNull().default(''),
    passwordHash: text('password_hash').notNull(),
    perms: jsonb('perms').$type<Perms>().notNull().default({} as Perms),
    isOwner: boolean('is_owner').notNull().default(false),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [
    check('users_email_lower_check', sql`${t.email} = lower(${t.email})`),
    uniqueIndex('users_one_owner_idx').on(t.isOwner).where(sql`${t.isOwner}`),
  ],
)

/** Signed-in devices. The cookie holds a random token; only its SHA-256 is stored here. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent').notNull().default(''),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId), index('sessions_expires_at_idx').on(t.expiresAt)],
)

/** Append-only record of admin actions, read newest first by id. */
export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  who: text('who').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull().default(''),
})
