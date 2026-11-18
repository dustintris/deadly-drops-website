import { sql } from 'drizzle-orm'
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import type { Perms } from '@/lib/auth/permissions'
import type { SiteContent } from '@/lib/content-schema'
import type { InfoT, RulesT } from '@/lib/tournaments/schema'

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

/**
 * Tournaments, live on save (no publish step): `visible` false is a draft. `info` and `rules`
 * are validated by src/lib/tournaments/schema.ts. `version` guards the editor against
 * overwriting a newer save; `live_version` will tick on every score/check-in (P3).
 */
export const tournaments = pgTable(
  'tournaments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    days: date('days', { mode: 'string' }).array().notNull().default(sql`'{}'::date[]`),
    info: jsonb('info').$type<InfoT>().notNull(),
    rules: jsonb('rules').$type<RulesT>().notNull(),
    featured: boolean('featured').notNull().default(false),
    visible: boolean('visible').notNull().default(false),
    version: integer('version').notNull().default(1),
    liveVersion: bigint('live_version', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tournaments_one_featured_idx').on(t.featured).where(sql`${t.featured}`)],
)

/** Divisions of a tournament, each on one of its days. Teams and matches (P3) hang off these rows. */
export const divisions = pgTable(
  'divisions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    sort: integer('sort').notNull().default(0),
    name: text('name').notNull(),
    format: text('format').notNull(),
    dayIndex: integer('day_index').notNull().default(0),
    startTime: text('start_time').notNull(),
    minutesPerRound: integer('minutes_per_round').notNull().default(17),
    firstCourt: integer('first_court').notNull().default(1),
    courtCount: integer('court_count').notNull().default(1),
    teamLimit: integer('team_limit'),
    gamesTo: integer('games_to'),
    gamesPerTeam: integer('games_per_team'),
    playoffs: text('playoffs').notNull().default('none'),
    bronze: text('bronze').notNull().default('standings'),
  },
  (t) => [
    index('divisions_tournament_idx').on(t.tournamentId, t.sort),
    check('divisions_format_check', sql`${t.format} in ('mixed', 'mens', 'womens', 'open')`),
    check('divisions_playoffs_check', sql`${t.playoffs} in ('none', 'top4', 'top8')`),
    check('divisions_bronze_check', sql`${t.bronze} in ('standings', 'match')`),
    check('divisions_start_time_check', sql`${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
)

/*
 * Play (Pickle Match). Teams and matches hang off a division; their division link is NO ACTION
 * (checked at the end of the statement), so a division with teams or matches can't vanish on its
 * own, while deleting a whole tournament still cascades through tournament_id.
 */

/** A doubles team in a division. */
export const teams = pgTable(
  'teams',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    divisionId: bigint('division_id', { mode: 'number' }).notNull().references(() => divisions.id),
    sort: integer('sort').notNull().default(0),
    name: text('name').notNull(),
  },
  (t) => [index('teams_division_idx').on(t.divisionId, t.sort), index('teams_tournament_idx').on(t.tournamentId)],
)

/** A player on a team; check-in happens at the desk on the day. */
export const players = pgTable(
  'players',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => teams.id, { onDelete: 'cascade' }),
    sort: integer('sort').notNull().default(0),
    name: text('name').notNull(),
    dupr: text('dupr').notNull().default(''),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    checkedInBy: text('checked_in_by'),
  },
  (t) => [index('players_team_idx').on(t.teamId)],
)

/**
 * One game between two teams. Pool matches come from the schedule; playoff matches (qf/sf/final/
 * bronze) start with empty teams that fill in as earlier rounds finish. `version` guards a score
 * against being overwritten by a phone holding an older copy.
 */
export const matches = pgTable(
  'matches',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    divisionId: bigint('division_id', { mode: 'number' }).notNull().references(() => divisions.id),
    stage: text('stage').notNull().default('pool'),
    round: integer('round').notNull(),
    slot: integer('slot').notNull(),
    court: integer('court'),
    startsAt: text('starts_at'),
    teamAId: bigint('team_a_id', { mode: 'number' }).references(() => teams.id),
    teamBId: bigint('team_b_id', { mode: 'number' }).references(() => teams.id),
    scoreA: integer('score_a'),
    scoreB: integer('score_b'),
    status: text('status').notNull().default('scheduled'),
    version: integer('version').notNull().default(1),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('matches_division_idx').on(t.divisionId, t.stage, t.round, t.slot),
    index('matches_tournament_idx').on(t.tournamentId),
    index('matches_team_a_idx').on(t.teamAId),
    index('matches_team_b_idx').on(t.teamBId),
    // one game per playoff slot (SF1, SF2…): a bracket can never be drawn twice
    uniqueIndex('matches_playoff_slot_idx').on(t.divisionId, t.stage, t.slot).where(sql`${t.stage} <> 'pool'`),
    check('matches_stage_check', sql`${t.stage} in ('pool', 'qf', 'sf', 'final', 'bronze')`),
    check('matches_status_check', sql`${t.status} in ('scheduled', 'live', 'final')`),
    check('matches_score_check', sql`coalesce(${t.scoreA}, 0) between 0 and 99 and coalesce(${t.scoreB}, 0) between 0 and 99`),
  ],
)

/** Small one-off markers, e.g. that the old tournaments were imported. */
export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

/** Append-only record of admin actions, read newest first by id. */
export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  who: text('who').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull().default(''),
})

/** Messages sent from the public Contact form, read in Admin → Inbox (newest first by id). */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    topic: text('topic').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // set when someone in the admin marks it dealt with
    handledAt: timestamp('handled_at', { withTimezone: true }),
    handledBy: text('handled_by'),
  },
  (t) => [
    check('contact_messages_size_check', sql`length(${t.name}) <= 100 and length(${t.email}) <= 254 and length(${t.topic}) <= 40 and length(${t.message}) <= 4000`),
  ],
)

/** The mailing list ("Join the list"): one row per address, stored lower-case. */
export const emailSignups = pgTable(
  'email_signups',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_signups_email_idx').on(t.email),
    check('email_signups_email_check', sql`${t.email} = lower(${t.email}) and length(${t.email}) <= 254`),
  ],
)
