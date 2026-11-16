import { sql } from 'drizzle-orm'
import { bigint, check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
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

/** Append-only record of admin actions, read newest first by id. */
export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  who: text('who').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull().default(''),
})
